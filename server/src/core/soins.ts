import type { LignesDesSoins, ProfileStore } from '../auth/profiles'
import { jourDe } from '../../../shared/jour'
import { hasardDe } from '../../../shared/missions'
import { compagnon as compagnonDuCatalogue, pourLAvoir } from '../../../shared/compagnons'
import {
  ECART_ENTRE_DEUX_CUEILLETTES_MS,
  ENVIES,
  enviesQuiRestent,
  ETOILES_DE_LA_CUEILLETTE,
  estUneEnvie,
  etoilesDeLaCueillette,
  lireLeScore,
  NOM_DE_L_ENVIE,
  prochainCadeauGrand,
  tourDuJour,
  type CadeauOuvert,
  type CueilletteEcrite,
  type Envie,
  type SoinsDuCompagnon,
  type SoinsDuProfil,
} from '../../../shared/soins'
import { EXPLOITS_DU_JARDIN, exploitsAtteints, inventaire, jardinMontre, niveauDuTerrain, tirerUneTrouvaille, TROUVAILLES, verifierLeJardin } from '../../../shared/trouvailles'

// S'occuper de son compagnon, côté serveur (`shared/soins.ts`,
// `shared/trouvailles.ts`) : lire ses soins du jour, combler une envie,
// ouvrir son cadeau, écrire une cueillette, aménager son jardin. Le magasin
// des profils garde les tables ; ce module juge, tire et vérifie. Tout se
// relit des journaux à chaque lecture — ses envies, sa complicité, ses
// trouvailles, ses records — : seul s'écrit ce qui est fait.

export interface DepsDesSoins {
  profiles: Pick<ProfileStore, 'compagnonsOf' | 'lignesDesSoins' | 'comblerUneEnvie' | 'ecrireLeCadeau' | 'ecrireLaCueillette' | 'ecrireLeJardin'>
  /** L'horloge du quiz du jour, que les tests font passer minuit. */
  maintenant: () => number
  /** Le hasard du cadeau, dans [0, 1[ : les tests le fixent. Sinon, une graine par profil, compagnon et jour. */
  hasard?: () => number
}

/**
 * Ses soins dérivés de ce que la base garde : la complicité de chacun (ses
 * cadeaux ouverts), ses trouvailles (les cadeaux, et les légendaires de ses
 * exploits), ses envies du jour, son jardin relu à son terrain.
 */
export function soinsDe(cles: readonly string[], jour: string, l: LignesDesSoins): SoinsDuProfil {
  const complicite = new Map<string, number>()
  for (const g of l.cadeaux) complicite.set(g.compagnon, (complicite.get(g.compagnon) ?? 0) + 1)
  const trouvailles = inventaire(
    l.cadeaux.map(g => g.objet),
    exploitsAtteints([...complicite.values()], l.troisEtoiles),
  )
  const compagnons = cles.map((cle): SoinsDuCompagnon => {
    const n = complicite.get(cle) ?? 0
    const duJour = l.cadeaux.find(g => g.compagnon === cle && g.jour === jour)
    return {
      compagnon: cle,
      envies: Object.fromEntries(ENVIES.map(e => [e, l.envies.some(x => x.compagnon === cle && x.envie === e)])) as Record<Envie, boolean>,
      cadeau: duJour ? { objet: duJour.objet, grand: duJour.grand } : null,
      complicite: n,
      record: l.records.get(cle) ?? 0,
      jardin: jardinMontre(l.jardins.get(cle) ?? {}, niveauDuTerrain(n), trouvailles),
    }
  })
  return { jour, compagnons, trouvailles, troisEtoiles: l.troisEtoiles }
}

/** « goûter et câlin » : les envies qui restent, dites dans une phrase. */
function enLettres(envies: readonly Envie[]): string {
  const noms = envies.map(e => NOM_DE_L_ENVIE[e].toLowerCase())
  return noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}` : noms[0]
}

export class Soins {
  constructor(private readonly deps: DepsDesSoins) {}

  /** Ses soins d'aujourd'hui, pour tous ses compagnons. */
  async duJour(profileId: string): Promise<SoinsDuProfil> {
    return (await this.lire(profileId, jourDe(this.deps.maintenant()))).soins
  }

  private async lire(profileId: string, jour: string): Promise<{ lignes: LignesDesSoins; soins: SoinsDuProfil }> {
    const lignes = await this.deps.profiles.lignesDesSoins(profileId, jour)
    const cles = this.deps.profiles.compagnonsOf(profileId).map(c => c.compagnon)
    return { lignes, soins: soinsDe(cles, jour, lignes) }
  }

  /** Le compagnon nommé, s'il est à lui ; sinon un refus qui dit où l'avoir. */
  private sien(profileId: string, cle: unknown): string {
    const c = compagnonDuCatalogue(cle)
    if (!c) throw new Error('Ce compagnon n’existe pas')
    if (!this.deps.profiles.compagnonsOf(profileId).some(a => a.compagnon === c.key)) throw new Error(pourLAvoir(c))
    return c.key
  }

  /** Comble une envie du jour — le goûter ou le câlin ; la partie de cueillette comble la sienne en s'écrivant. */
  async combler(profileId: string, cle: unknown, envie: unknown): Promise<SoinsDuProfil> {
    const c = this.sien(profileId, cle)
    if (!estUneEnvie(envie) || envie === 'jeu') throw new Error('Cette envie ne se comble pas ainsi : recharge la page.')
    const quand = this.deps.maintenant()
    const jour = jourDe(quand)
    await this.deps.profiles.comblerUneEnvie(profileId, c, jour, envie, quand)
    return (await this.lire(profileId, jour)).soins
  }

  /**
   * Ouvre son cadeau du jour, ses trois envies comblées : une trouvaille tirée
   * à sa rareté — grande tous les sept jours de complicité —, une fois. Rouvert,
   * il redonne ce qu'il a donné, et dit encore ce que ce jour a ouvert.
   */
  async ouvrirLeCadeau(profileId: string, cle: unknown): Promise<CadeauOuvert> {
    const c = this.sien(profileId, cle)
    const quand = this.deps.maintenant()
    const jour = jourDe(quand)
    const avant = await this.lire(profileId, jour)
    const lui = avant.soins.compagnons.find(s => s.compagnon === c)
    if (lui && !lui.cadeau) {
      const restent = enviesQuiRestent(lui.envies)
      if (restent.length > 0) throw new Error(`Son cadeau attend ses trois envies : encore ${enLettres(restent)}.`)
      const grand = prochainCadeauGrand(lui.complicite)
      const objet = tirerUneTrouvaille(grand, avant.soins.trouvailles, this.deps.hasard ?? hasardDe(`${profileId}:${c}:${jour}:cadeau`))
      await this.deps.profiles.ecrireLeCadeau(profileId, c, jour, objet, grand, quand)
    }
    const { soins } = await this.lire(profileId, jour)
    const apres = soins.compagnons.find(s => s.compagnon === c)
    if (!apres?.cadeau) throw new Error('Son cadeau ne s’ouvre pas : recharge la page.')
    const n = apres.complicite
    // Ce que ce jour ouvre se lit de sa complicité : le cadeau rouvert le redit, sans rien donner deux fois.
    const fontaine = TROUVAILLES.find(t => t.exploit === 'cent-jours')
    const centJours = n === EXPLOITS_DU_JARDIN['cent-jours'].seuil && !soins.compagnons.some(s => s.compagnon !== c && s.complicite >= n)
    return {
      ...apres.cadeau,
      complicite: n,
      terrain: niveauDuTerrain(n) > niveauDuTerrain(n - 1) ? niveauDuTerrain(n) : null,
      tour: tourDuJour(n),
      exploit: centJours && fontaine ? fontaine.cle : null,
      soins,
    }
  }

  /**
   * Écrit une partie de cueillette : son score, son record, ses étoiles — la
   * première du jour comble son envie de jouer. Deux parties ne s'écrivent pas
   * à moins de vingt-cinq secondes d'écart (`ECART_ENTRE_DEUX_CUEILLETTES_MS`).
   */
  async cueillir(profileId: string, cle: unknown, brut: unknown): Promise<CueilletteEcrite> {
    const c = this.sien(profileId, cle)
    const score = lireLeScore(brut)
    const quand = this.deps.maintenant()
    const jour = jourDe(quand)
    const avant = await this.lire(profileId, jour)
    const derniere = avant.lignes.derniereCueillette
    if (derniere !== null && quand - derniere < ECART_ENTRE_DEUX_CUEILLETTES_MS) throw new Error('Une partie dure trente secondes : joue-la jusqu’au bout.')
    const lui = avant.soins.compagnons.find(s => s.compagnon === c)
    await this.deps.profiles.ecrireLaCueillette(profileId, c, jour, score, quand)
    const { soins } = await this.lire(profileId, jour)
    const etoiles = etoilesDeLaCueillette(score)
    const ancien = lui?.record ?? 0
    const etoile = TROUVAILLES.find(t => t.exploit === 'trois-etoiles')
    const exploit = etoiles === ETOILES_DE_LA_CUEILLETTE.length && avant.soins.troisEtoiles < EXPLOITS_DU_JARDIN['trois-etoiles'].seuil && soins.troisEtoiles >= EXPLOITS_DU_JARDIN['trois-etoiles'].seuil
    return { score, etoiles, ancien, nouveauRecord: score > ancien, envie: !lui?.envies.jeu, exploit: exploit && etoile ? etoile.cle : null, soins }
  }

  /** Aménage son jardin : chaque place vérifiée — ouverte à son terrain, la trouvaille à sa sorte et à lui. */
  async amenager(profileId: string, cle: unknown, brut: unknown): Promise<SoinsDuProfil> {
    const c = this.sien(profileId, cle)
    const { soins } = await this.lire(profileId, jourDe(this.deps.maintenant()))
    const lui = soins.compagnons.find(s => s.compagnon === c)
    const jardin = verifierLeJardin(brut, niveauDuTerrain(lui?.complicite ?? 0), soins.trouvailles)
    await this.deps.profiles.ecrireLeJardin(profileId, c, jardin)
    return { ...soins, compagnons: soins.compagnons.map(s => (s.compagnon === c ? { ...s, jardin } : s)) }
  }
}
