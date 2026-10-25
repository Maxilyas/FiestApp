// Le magasin du Cabinet de curiosités (`CabinetStore`) : les musées et les
// parties en mémoire, ce qui se lit à froid, ce qui s'écrit, et ce qui
// s'oublie. Pas une règle de jeu : il replie (`pliDeLaPartie`), écrit
// (`ecriture.ts`), garde, oublie — les règles sont pures, dans
// `shared/cabinet/`, et la vue choisit ses champs un à un (`vue.ts`).
//
// Il ne connaît la campagne que par sa porte (`core/porteDeLaCampagne.ts`) :
// le verrou du profil, la base jouable et sa mesure, le journal des réponses
// rattrapé, et le rituel d'une réponse en une fonction (`ecrireDesReponses`).
//
// Chaud, une page ne coûte rien : le musée et la partie en cours vivent en
// mémoire, les légendaires se lisent dans les profils. Froid, un seul lot de
// lectures, le journal rattrapé au bout. Un geste coûte un aller-retour, son
// verdict compris ; la fin en ajoute pour l'expérience, les paliers et le
// compagnon (la porte). À tout échec d'écriture, et à toute garde qui n'a rien
// écrit (`rowsAffected = 0`), le musée et la partie s'oublient : écrite ou non,
// on ne le sait pas, et la base fait foi — le magasin relit à froid et rejoue
// le geste une fois sur l'état vrai (le gabarit `ecrireLExpedition`).
//
// L'heure est celle de la campagne (`maintenant`, que le banc règle) : jamais
// l'horloge de la machine ici (`cabinet-chronos.test.ts`). Le plafond des départs, lui,
// compte en temps de la machine (`Budget`) : ce n'est pas une échéance.
import { createHmac, randomUUID } from 'node:crypto'
import type { ResultSet } from '@libsql/client'
import { Budget } from '../budget'
import type { QuestionDeLaBase } from '../baseCampagne'
import type { FinDUnePartie, PorteDeLaCampagne, ReponsesEcrites } from '../porteDeLaCampagne'
import type { calendrierDuCabinet } from '../saisons'
import { lotDeLOubli, lotDuDepart, lotDuGeste, type FinAEcrire, type OeuvreAEcrire } from './ecriture'
import { lecturesDeLaPartie, lecturesDuMusee, laPartieLue, lireLeMusee, type PartieLueEnBase } from './tables'
import { fichierDuCadrage } from '../details'
import { preparerLesTas } from './tirages/tas'
import { themeDuPlan, tirerLePlan } from './tirages/index'
import { CHANGEMENTS_PAR_PARTIE, DEPARTS_PAR_HEURE } from '../../../../shared/cabinet/bareme'
import { lireLeBilan, lireUnGeste } from '../../../../shared/cabinet/lecture'
import {
  cadreDuDepart,
  dorees,
  jeuDeLEchange,
  museeDe,
  possedees,
  visiteDuJour,
  visitesAGarder,
  type DemandeDeDepart,
  type LigneDOeuvre,
  type LigneDuProfil,
  type Musee,
  type PartieDuJour,
  type VisiteDuJour,
} from '../../../../shared/cabinet/musee'
import { JEUX_PRETS } from '../../../../shared/cabinet/ouverture'
import {
  PARTIE_FINIE,
  VERSION_DU_DEPART,
  bilanDe,
  chronoDuDepart,
  estDUnJourDAvant,
  jouerUnGeste,
  pliDeLaPartie,
  type BilanDUnePartie,
  type DepartDUnePartie,
  type EtatDeLaPartie,
  type GesteDuCabinet,
  type GesteEcrit,
} from '../../../../shared/cabinet/partie'
import { estUneOeuvre } from '../../../../shared/cabinet/oeuvres'
import { vuesDuCabinet } from '../../../../shared/cabinet/vues'
import { CLES_DES_JEUX, JEUX, type CleDeJeu } from '../../../../shared/cabinet/jeux/regle'
import { refusDuCadrage, type DetailTire, type EtatDuDetail } from '../../../../shared/cabinet/jeux/detail'
import { jourAvant, jourDe } from '../../../../shared/jour'
import { minuitDe } from '../../../../shared/qg'
import type { Saison } from '../../../../shared/saisons'

/** Les musées gardés en mémoire, au plus : le plus anciennement servi s'en va. Un réglage de la mémoire, pas un barème. */
export const MUSEES_GARDES = 500
/** Les parties en cours gardées en mémoire, au plus, de même. */
export const PARTIES_GARDEES = 200

/** Ce que le Cabinet lit des profils : les légendaires qu'il a, par quelque voie que ce soit, en mémoire. */
export interface ProfilsDuCabinet {
  legendairesOf(profileId: string): readonly string[]
}

export interface ReglagesDuCabinet {
  /** L'heure de la campagne (`maintenantDuJour`, que le banc règle). */
  maintenant: () => number
  /** Le calendrier des fêtes du Cabinet (`calendrierDuCabinet`) : le banc et le smoke le ferment. */
  calendrier: Pick<typeof calendrierDuCabinet, 'periodeDu'>
  /**
   * Le hasard que le Cabinet tire lui-même — l'ordre des catégories de
   * l'Éclair, l'affirmation proposée, les voisins et l'ordre des titres du
   * Détail, le sujet d'une frise, ses sept événements et leurs vagues — :
   * celui du serveur, `Math.random` à défaut. Le tirage à la pièce garde le
   * sien (`tirerPourUneEscale`, `laMoinsVue`, `versQuestionDeSerie`,
   * `core/tirageALaPiece.ts`), le même que les autres modes : aucun des deux
   * ne vient d'une graine que la page connaîtrait.
   */
  hasard?: () => number
}

/** Un musée en mémoire : des reflets, des faits d'acquisition, les parties du jour sans leur plan. */
interface MuseeGarde {
  profil: LigneDuProfil | null
  oeuvres: Map<string, LigneDOeuvre>
  duJour: { jour: string; parties: PartieDuJour[] }
  enCours: { id: string; jeu: CleDeJeu } | null
  expeditionEnRoute: string | null
}

/** Une partie en mémoire : son départ figé, ses gestes écrits, le pli qui en dit l'état. */
export interface PartieGardee {
  id: string
  profileId: string
  depart: DepartDUnePartie
  gestes: GesteEcrit[]
  etat: EtatDeLaPartie
  /** Son bilan figé, une fois finie. */
  bilan: BilanDUnePartie | null
}

/** Une partie telle que la route la montre (`vueDeLaPartie`) — et, au geste qui la finit, ce que la fin a rapporté. */
export interface PartieLue extends PartieGardee {
  /** L'heure du serveur où la vue la dit : son chrono, son pouvoir, et l'heure que la page mesure (invariant 6). */
  lueA: number
  gains?: { xp: readonly number[]; recompenses: ReponsesEcrites['recompenses'] }
}

/** Ce que la page du Cabinet lit (`pageDuCabinet`). */
export interface LectureDuCabinet {
  maintenant: number
  jour: string
  musee: Musee
  visite: VisiteDuJour
  /** Le jeu qu'un échange donnerait aujourd'hui (`jeuDeLEchange`) : la règle des échanges le lit, la graine reste ici. */
  jeuDeLEchange: CleDeJeu | null
  enCours: PartieLue | null
  expeditionEnRoute: boolean
  /** La fête du jour, au calendrier du Cabinet. */
  fete: Saison | null
  jeux: readonly CleDeJeu[]
}

/** Un geste reçu : la partie d'après, ou ce qui le refuse sans rien écrire. */
export type IssueDuGeste =
  | { partie: PartieLue }
  /** Celle d'un autre profil, ou qui n'existe pas (invariant 3). */
  | { introuvable: true }
  /** Un rang qui n'est plus le suivant — un double toucher, un autre onglet, une réponse perdue puis rejouée —, ou une partie finie : la vue d'à présent, que la page reprend. */
  | { passe: PartieLue; pourquoi: string }

export const PARTIE_INTROUVABLE = 'Cette partie est introuvable'
export const GESTE_PASSE = 'Ce geste est passé : ta partie a continué sans lui'
export const TROP_DE_DEPARTS = 'Tu joues vite : souffle une minute, puis reprends'
export const DEMANDE_ILLISIBLE = 'Choisis une partie de la visite, une chasse ou un jeu libre'
export const RIEN_A_TIRER = 'Ce jeu n’a pas de quoi jouer aujourd’hui : choisis-en un autre'
export const DEPART_CROISE = 'Une autre partie a commencé en même temps : recharge la page'
export const GESTE_CROISE = 'Ce geste en a croisé un autre : recharge la page'
export const TABLEAU_INTROUVABLE = 'Ce tableau n’est pas dans ta partie : recharge la page'

/** Ce que la route d'un cadrage du Détail sert : son fichier, ou pourquoi pas. */
export type IssueDuCadrage =
  | { fichier: string }
  /** La partie d'un autre profil, ou qui n'existe pas (invariant 3). */
  | { introuvable: 'partie' }
  /** Un tableau qu'aucune manche de sa partie ne joue : une rechange pas prise, un tableau que Changer a remplacé, une manche pas ouverte, un autre jeu. */
  | { introuvable: 'tableau' }
  /** Un cadrage pas encore atteint, ou qui n'existe pas : la phrase de la règle (`refusDuCadrage`). */
  | { refus: string }

/** Une clé courte venue du téléphone, ou rien : une carte-bonus, une œuvre, un jeu se lisent ensuite par leur règle. */
const cle = (x: unknown): string | null => (typeof x === 'string' && x.length > 0 && x.length <= 40 ? x : null)

/**
 * Ce que la page demande à « Commencer », relu champ par champ : la règle des
 * départs (`cadreDuDepart`) juge ensuite, en mots. Une carte-bonus absente
 * vaut « aucune ».
 */
export function lireLaDemande(brut: unknown): DemandeDeDepart | null {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) return null
  const b = brut as Record<string, unknown>
  const carte = b.carte === undefined || b.carte === null ? null : cle(b.carte)
  if (carte === null && b.carte !== undefined && b.carte !== null) return null
  switch (b.origine) {
    case 'visite':
      return Number.isInteger(b.case) ? { origine: 'visite', case: b.case as number, carte } : null
    case 'chasse': {
      const oeuvre = cle(b.oeuvre)
      if (!oeuvre || !(b.retente === undefined || b.retente === true)) return null
      const jeu = b.jeu === undefined ? undefined : (CLES_DES_JEUX as readonly unknown[]).includes(b.jeu) ? (b.jeu as CleDeJeu) : null
      if (jeu === null) return null
      return { origine: 'chasse', oeuvre, carte, ...(b.retente === true && { retente: true as const }), ...(jeu !== undefined && { jeu }) }
    }
    case 'libre': {
      const jeu = cle(b.jeu)
      return jeu ? { origine: 'libre', jeu, carte } : null
    }
    default:
      return null
  }
}

/**
 * Ce que la route sert d'un tableau de cette partie : le fichier du cadrage,
 * si une manche joue ce tableau — son indice dans le plan figé — et l'a
 * atteint, ou tous la manche tranchée (`refusDuCadrage`, la règle du jeu).
 */
function cadrageDeLaPartie(p: PartieGardee, tirage: number, cadrage: number): Exclude<IssueDuCadrage, { introuvable: 'partie' }> {
  const m = p.depart.jeu === 'detail' ? p.etat.manches.find(x => x.tirage === tirage) : undefined
  if (!m) return { introuvable: 'tableau' }
  // Une manche du Détail tient l'état de son jeu : le cadrage atteint, les titres effacés.
  const refus = refusDuCadrage(m.etat as EtatDuDetail, cadrage, m.verdict !== null || p.etat.fin !== null)
  if (refus) return { refus }
  return { fichier: fichierDuCadrage((p.depart.tirages[m.tirage] as DetailTire).tableau.qid, cadrage) }
}

/**
 * Ce cadrage se servira-t-il jamais de cette partie, quoi que l'autre serveur
 * d'une mise en ligne y ait joué ? Un autre jeu, un indice hors de son plan
 * figé, un cadrage hors des quatre : jamais — le départ seul le dit, et un
 * refus n'a rien à relire. Une page qui se trompe ne paie donc pas un
 * aller-retour par demande, sous le verrou du profil.
 */
function peutSeServir(d: DepartDUnePartie, tirage: number, cadrage: number): boolean {
  if (d.jeu !== 'detail' || !Number.isInteger(tirage) || tirage < 0 || tirage >= d.tirages.length) return false
  return refusDuCadrage({ cadrage: 0, effaces: [] }, cadrage, true) === null
}

export class CabinetStore {
  private readonly musees = new Map<string, MuseeGarde>()
  private readonly parties = new Map<string, PartieGardee>()
  /** Trente départs, puis un toutes les deux minutes (`DEPARTS_PAR_HEURE`) : toutes les parties s'écrivent, libres comprises. */
  private readonly departs = new Budget(DEPARTS_PAR_HEURE, DEPARTS_PAR_HEURE / 60)
  private readonly maintenant: () => number
  private readonly hasard: () => number
  /**
   * Les tas de la dernière liste de jouables, et leur préparation : la liste
   * change d'identité — la réserve du jour, un retrait, une base relue —, et
   * ses tas, gardés par elle (`tirages/tas.ts`), avec. Une liste neuve se
   * prépare une fois, en rendant la main entre deux catégories, qu'elle
   * vienne d'une page (`prechauffer`) ou d'un départ, qui l'attend.
   */
  private tas: { jouables: readonly QuestionDeLaBase[]; prets: Promise<void> } | null = null

  constructor(
    private readonly porte: PorteDeLaCampagne,
    private readonly profils: ProfilsDuCabinet,
    private readonly reglages: ReglagesDuCabinet,
  ) {
    this.maintenant = reglages.maintenant
    this.hasard = reglages.hasard ?? Math.random
  }

  // ── La mémoire ────────────────────────────────────────────────────────

  /** Le plus récemment servi passe au bout : le plus anciennement servi s'en va le premier. */
  private garder<T>(table: Map<string, T>, cle: string, valeur: T, max: number): T {
    table.delete(cle)
    table.set(cle, valeur)
    while (table.size > max) table.delete(table.keys().next().value as string)
    return valeur
  }

  /** Écrite ou non, on ne le sait pas : la base fait foi, et la page suivante relit. */
  private oublier(profileId: string, serie?: string) {
    this.musees.delete(profileId)
    if (serie) this.parties.delete(serie)
    for (const [id, p] of this.parties) if (p.profileId === profileId) this.parties.delete(id)
  }

  /** Le musée tel que les règles le lisent : ses légendaires relus des profils, en mémoire — un gardien gagné ailleurs compte aussitôt. */
  private museeVu(profileId: string, g: MuseeGarde): Musee {
    return museeDe({
      jour: g.duJour.jour,
      profil: g.profil,
      oeuvres: [...g.oeuvres.values()],
      parties: g.duJour.parties,
      legendaires: this.profils.legendairesOf(profileId),
      enCours: g.enCours,
    })
  }

  /**
   * Son musée, de la mémoire, sinon d'un seul lot de lectures — le journal des
   * réponses rattrapé au bout, que le tirage d'un départ lit ensuite sans
   * aller-retour. Un jour neuf repart d'une journée vide : les parties d'hier
   * ne comptent plus aux droits du jour, et ce que l'autre serveur d'une mise
   * en ligne aurait écrit entre-temps, la base le recompte au départ (D9).
   */
  private async musee(profileId: string, t: number): Promise<MuseeGarde> {
    const jour = jourDe(t)
    const garde = this.musees.get(profileId)
    if (garde) {
      if (garde.duJour.jour !== jour) garde.duJour = { jour, parties: [] }
      return this.garder(this.musees, profileId, garde, MUSEES_GARDES)
    }
    const { lus } = await this.porte.lireAvecLeJournal(lecturesDuMusee(profileId, minuitDe(t)))
    const lu = lireLeMusee(lus)
    if (lu.partieIllisible) await this.rendreLaPartieIllisible(profileId, lu.partieIllisible)
    const enCours = lu.enCours ? this.garderLaPartie(profileId, lu.enCours, null) : null
    return this.garder(
      this.musees,
      profileId,
      {
        profil: lu.profil && (lu.partieIllisible ? { ...lu.profil, partie: null } : lu.profil),
        oeuvres: new Map(lu.oeuvres.map(l => [l.oeuvre, l])),
        duJour: { jour, parties: lu.parties },
        enCours: enCours ? { id: enCours.id, jeu: enCours.depart.jeu } : null,
        expeditionEnRoute: lu.expeditionEnRoute,
      },
      MUSEES_GARDES,
    )
  }

  /**
   * Une partie que sa ligne dit en cours et que ce code ne relit pas — un
   * départ d'une version inconnue, un geste troué : jamais par une règle de
   * jeu, toujours par un bogue. Le profil ne doit pas rester bloqué derrière
   * elle (« une partie à la fois ») : sa ligne la rend, et le journal le dit.
   */
  private async rendreLaPartieIllisible(profileId: string, serie: string) {
    console.error(`[cabinet] la partie ${serie} ne se relit pas : le profil la rend pour en commencer une autre`)
    await this.porte.client.execute({ sql: 'UPDATE cabinet_profils SET partie = NULL WHERE profile_id = ? AND partie = ?', args: [profileId, serie] })
  }

  /** Une partie relue, repliée et gardée ; ce que le pli ne retrouve pas de la base se dit au journal. */
  private garderLaPartie(profileId: string, lue: PartieLueEnBase, bilan: BilanDUnePartie | null): PartieGardee {
    const etat = pliDeLaPartie(lue.depart, lue.gestes)
    if (etat.ignores > 0) console.warn(`[cabinet] partie ${lue.id} : ${etat.ignores} geste(s) écrit(s) que la relecture refuse — une règle a changé sans monter la version du départ`)
    if (etat.pieces.length !== lue.position) console.warn(`[cabinet] partie ${lue.id} : ${lue.position} pièce(s) en base, le pli en range ${etat.pieces.length}`)
    const partie: PartieGardee = { id: lue.id, profileId, depart: lue.depart, gestes: lue.gestes, etat, bilan }
    return etat.fin ? partie : this.garder(this.parties, lue.id, partie, PARTIES_GARDEES)
  }

  /**
   * Une partie de ce profil : en mémoire, sinon d'un lot de deux lectures
   * cloisonnées ; null pour celle d'un autre, ou qui n'existe pas.
   *
   * Relue finie quand son musée gardé la dit encore en cours, l'autre serveur
   * d'une mise en ligne l'a finie — un cadrage, une page relisent ici la partie
   * qu'il a jouée — : ce musée ne dit plus vrai (la partie rendue, sa
   * poussière, son œuvre), et s'oublie. Gardé, il refusait tout départ
   * (« Ta partie au Détail t'attend ») derrière une partie que plus rien ne
   * pouvait finir, jusqu'au redémarrage. Ici seulement : la fin écrite par ce
   * serveur a déjà rendu la partie à son musée (`retenirLaFin`).
   */
  private async partieDe(profileId: string, serie: string): Promise<PartieGardee | null> {
    const gardee = this.parties.get(serie)
    if (gardee) return gardee.profileId === profileId ? this.garder(this.parties, serie, gardee, PARTIES_GARDEES) : null
    const [ligne, gestes] = await this.porte.client.batch(lecturesDeLaPartie(profileId, serie), 'read')
    const brute = ligne.rows[0] as Record<string, unknown> | undefined
    const lue = laPartieLue(brute, gestes.rows as Record<string, unknown>[])
    if (!lue) {
      if (brute) console.error(`[cabinet] la partie ${serie} ne se relit pas`)
      return null
    }
    const partie = this.garderLaPartie(profileId, lue, brute?.bilan ? lireLeBilan(brute.bilan) : null)
    if (partie.etat.fin && this.musees.get(profileId)?.enCours?.id === serie) this.musees.delete(profileId)
    return partie
  }

  /** La graine de sa visite du jour : `HMAC-SHA256(secret du Cabinet, profil)` — au serveur seul, faite d'un secret que la page n'a pas. */
  private graineDe(profileId: string): string {
    return createHmac('sha256', this.porte.secretDuCabinet()).update(profileId).digest('hex')
  }

  private visiteDe(profileId: string, musee: Musee, t: number): VisiteDuJour {
    return visiteDuJour(musee, { graine: this.graineDe(profileId), jour: jourDe(t), minuit: minuitDe(t), jeux: JEUX_PRETS })
  }

  // ── La page ───────────────────────────────────────────────────────────

  /**
   * Ce que la page du Cabinet lit : chaud, rien ; froid, un lot. Une partie
   * d'un jour d'avant — un téléphone éteint en pleine manche, un joueur
   * jamais revenu — se clôt ici, la seule écriture d'une lecture : idempotente
   * par sa garde, sous le verrou du profil, un aller-retour, une fois.
   */
  async page(profileId: string): Promise<LectureDuCabinet> {
    return this.porte.avecVerrou(profileId, async () => {
      const t = this.maintenant()
      let garde = await this.musee(profileId, t)
      let enCours = garde.enCours ? await this.partieDe(profileId, garde.enCours.id) : null
      if (enCours?.etat.fin) {
        // Finie par l'autre serveur : son musée vient de s'oublier (`partieDe`), il se relit pour cette page-ci.
        garde = await this.musee(profileId, t)
        enCours = null
      }
      if (enCours && !enCours.etat.fin && estDUnJourDAvant(enCours.depart, jourDe(t))) {
        await this.clore(profileId, enCours, t)
        garde = await this.musee(profileId, t)
        enCours = null
      }
      const musee = this.museeVu(profileId, garde)
      const visite = this.visiteDe(profileId, musee, t)
      return {
        maintenant: t,
        jour: jourDe(t),
        musee,
        visite,
        jeuDeLEchange: jeuDeLEchange(musee, visite, { graine: this.graineDe(profileId), jeux: JEUX_PRETS }),
        enCours: enCours && !enCours.etat.fin ? { ...enCours, lueA: t } : null,
        expeditionEnRoute: garde.expeditionEnRoute !== null,
        fete: this.reglages.calendrier.periodeDu(jourDe(t))?.saison ?? null,
        jeux: JEUX_PRETS,
      }
    })
  }

  /** La partie d'hier, close par le serveur (`clore`) : le pli la finit comme un « Quitter », et la fin s'écrit. */
  private async clore(profileId: string, p: PartieGardee, t: number) {
    const issue = await this.ecrireUnGeste(profileId, p, { quoi: 'clore', pourquoi: 'lendemain' }, p.etat.rang, t)
    if ('refus' in issue) console.error(`[cabinet] la partie ${p.id} d’un jour d’avant ne se clôt pas : ${issue.refus}`)
  }

  // ── Commencer ─────────────────────────────────────────────────────────

  /**
   * Une partie qui commence : le plafond des départs,
   * le verrou du profil, la partie d'hier close d'abord, la règle des départs
   * en mots, le plan tiré sur le journal rattrapé, puis un seul lot gardé —
   * l'ouverture de la première manche comprise, son chrono parti avec la
   * réponse. Devancé par un autre onglet ou l'autre serveur d'une mise en
   * ligne, le musée s'oublie, se relit, et le départ se rejoue une fois sur
   * l'état vrai : il part, ou se refuse en mots.
   *
   * Deux heures : l'arrivée de la requête (`recueLe`, avant le verrou) dit le
   * jour, minuit et la date de la partie ; l'ouverture de la première manche
   * se prend une fois le plan tiré, juste avant le lot. Datée de l'arrivée, la
   * manche courait déjà pendant le verrou, le lot froid, la base de la
   * campagne au premier départ d'un réveil — des secondes au dixième de cœur
   * de l'hébergeur —, et le joueur voyait sa question le chrono entamé.
   */
  async commencer(profileId: string, brut: unknown): Promise<PartieLue> {
    const recueLe = this.maintenant()
    if (!this.departs.take(profileId)) throw new Error(TROP_DE_DEPARTS)
    const demande = lireLaDemande(brut)
    if (!demande) throw new Error(DEMANDE_ILLISIBLE)
    return this.porte.avecVerrou(profileId, async () => {
      for (let essai = 0; ; essai++) {
        const t = recueLe
        const jour = jourDe(t)
        const garde = await this.musee(profileId, t)
        if (garde.enCours) {
          const p = await this.partieDe(profileId, garde.enCours.id)
          if (p && !p.etat.fin && estDUnJourDAvant(p.depart, jour)) await this.clore(profileId, p, t)
        }
        const g = await this.musee(profileId, t)
        const musee = this.museeVu(profileId, g)
        const visite = this.visiteDe(profileId, musee, t)
        const cadre = cadreDuDepart(musee, demande, visite, JEUX_PRETS)
        if (typeof cadre === 'string') throw new Error(cadre)
        // Le journal rattrapé : rien à relire si une lecture est partie après la dernière réponse écrite ici.
        const { journal } = await this.porte.lireAvecLeJournal([])
        const [jouables, mesures] = await Promise.all([this.porte.jouables(), this.porte.mesures()])
        // Les tas d'une liste neuve se préparent en rendant la main : le tireur ne passe jamais toute la base d'un bloc.
        await this.tasDe(jouables)
        // Des rechanges pour Changer, là seulement où il sert : la Frise n'en tire aucune, et sa relecture n'en admet pas.
        const rechanges = cadre.carte?.pouvoir === 'changer' && JEUX[cadre.jeu].changeable ? CHANGEMENTS_PAR_PARTIE[cadre.carte.force] : 0
        const tirages = tirerLePlan(
          cadre.jeu,
          { porte: this.porte, jouables, mesures, vues: vuesDuCabinet(journal.vuesDe(profileId).vues), maintenant: t, hasard: this.hasard },
          rechanges,
        )
        if (!tirages) throw new Error(RIEN_A_TIRER)
        const theme = themeDuPlan(tirages)
        const depart: DepartDUnePartie = {
          v: VERSION_DU_DEPART,
          jeu: cadre.jeu,
          origine: cadre.origine,
          ...(cadre.visite !== undefined && { visite: cadre.visite }),
          jour,
          cible: cadre.cible,
          but: cadre.but,
          ...(cadre.retente && { retente: true as const }),
          seuil: cadre.seuil,
          payee: cadre.payee,
          carte: cadre.carte,
          chrono: chronoDuDepart(cadre.jeu, cadre.carte),
          // La graine du hasard d'Éclairer : un secret du serveur, tiré ici, jamais envoyé (`cabinet-secret.test.ts`).
          graine: randomUUID(),
          ...(theme !== undefined && { theme }),
          tirages,
        }
        const serie = randomUUID()
        // Sous une carte de Miser, la mise se décide avant de voir la manche : la page l'ouvre elle-même.
        const ouverture = cadre.carte?.pouvoir === 'miser' ? null : { geste: { quoi: 'ouvrir', manche: 0 } as GesteDuCabinet, uid: randomUUID() }
        const visites = JSON.stringify(visitesAGarder(visite, g.profil?.visites ?? []))
        // Le zéro du chrono de la première manche : le plan tiré, à l'heure du serveur (invariant 6).
        const ouverteLe = this.maintenant()
        let lus: ResultSet[]
        try {
          lus = await this.porte.client.batch(
            lotDuDepart({ profileId, serie, depart, t, ouverteLe, jour, veille: jourAvant(jour), minuit: minuitDe(t), visites, ouverture }),
            'write',
          )
        } catch (e) {
          this.oublier(profileId)
          throw e
        }
        if (lus[0].rowsAffected !== 1 || lus[1].rows.length !== 1) {
          // Devancé : quelqu'un a pris la partie, la chasse ou la case. Le refus juste se dit sur l'état vrai.
          this.oublier(profileId)
          if (essai === 0) continue
          throw new Error(DEPART_CROISE)
        }
        const payee = depart.origine === 'libre' ? Number(lus[1].rows[0].payee) === 1 : true
        const figee: DepartDUnePartie = { ...depart, payee }
        this.retenirLeDepart(g, figee, serie, t, visite)
        const gestes: GesteEcrit[] = ouverture ? [{ geste: ouverture.geste, faitLe: ouverteLe }] : []
        const partie: PartieGardee = { id: serie, profileId, depart: figee, gestes, etat: pliDeLaPartie(figee, gestes), bilan: null }
        return { ...this.garder(this.parties, serie, partie, PARTIES_GARDEES), lueA: this.maintenant() }
      }
    })
  }

  /** Ce que le lot du départ a écrit, appliqué au musée gardé — la même règle que la base : la série, la visite figée, la partie du jour. */
  private retenirLeDepart(g: MuseeGarde, d: DepartDUnePartie, serie: string, t: number, visite: VisiteDuJour) {
    const compte = d.origine !== 'libre'
    const avant = g.profil
    const veille = jourAvant(d.jour)
    const serieDuJour = !compte ? (avant?.serie ?? 0) : avant?.serieJour && avant.serieJour >= d.jour ? avant.serie : avant?.serieJour === veille ? avant.serie + 1 : 1
    g.profil = {
      poussiere: avant?.poussiere ?? 0,
      serie: serieDuJour,
      serieJour: !compte ? (avant?.serieJour ?? null) : avant?.serieJour && avant.serieJour > d.jour ? avant.serieJour : d.jour,
      serieRecord: Math.max(avant?.serieRecord ?? 0, serieDuJour),
      visites: avant?.visites.some(v => v.jour === d.jour) ? avant.visites : visitesAGarder(visite, avant?.visites ?? []),
      partie: serie,
    }
    g.duJour.parties.push({
      id: serie,
      commenceeLe: t,
      finieLe: null,
      issue: null,
      origine: d.origine,
      visite: d.visite ?? null,
      jeu: d.jeu,
      cible: d.cible,
      payee: d.payee,
      total: null,
    })
    g.enCours = { id: serie, jeu: d.jeu }
  }

  // ── Un geste ──────────────────────────────────────────────────────────

  /**
   * Un geste de la page : l'heure d'arrivée prise avant
   * le verrou, la partie cloisonnée au profil, son rang (invariant 12), le
   * geste relu champ par champ, la seule règle des refus (le pli), puis ce que
   * le pli a tranché, en un lot gardé par le geste. Le rang déjà pris par
   * l'autre serveur, la partie s'oublie, se relit, et le geste se rejoue une
   * fois sur l'état vrai : il rend alors la vue de ce qui était déjà fait.
   *
   * Un rang en avance sur la mémoire dit que l'autre serveur d'une mise en
   * ligne a joué la partie depuis : la page tient sa vue de lui. Elle s'oublie
   * et se relit une fois — un aller-retour, sur ce seul cas —, et le geste se
   * joue sur l'état vrai ; sinon le refus rendait la vue de la mémoire, une
   * manche déjà tranchée encore « à jouer », que la page reprenait. Un rang en
   * retard (un double toucher, une réponse perdue puis rejouée, le cas
   * ordinaire) ne relit rien : c'est la page qui est en retard.
   */
  async geste(profileId: string, serie: string, rang: unknown, brut: unknown): Promise<IssueDuGeste> {
    const recueLe = this.maintenant()
    return this.porte.avecVerrou(profileId, async () => {
      for (let essai = 0; ; essai++) {
        const enMemoire = this.parties.has(serie)
        const p = await this.partieDe(profileId, serie)
        if (!p) return { introuvable: true }
        if (p.etat.fin) return { passe: { ...p, lueA: this.maintenant() }, pourquoi: PARTIE_FINIE }
        if (rang !== p.etat.rang && enMemoire && essai === 0 && typeof rang === 'number' && rang > p.etat.rang) {
          this.oublier(profileId, serie)
          continue
        }
        if (rang !== p.etat.rang) return { passe: { ...p, lueA: this.maintenant() }, pourquoi: GESTE_PASSE }
        const geste = lireUnGeste(brut)
        if (!geste) throw new Error('Ce geste ne se lit pas : recharge la page')
        const issue = await this.ecrireUnGeste(profileId, p, geste, p.etat.rang, recueLe)
        if ('refus' in issue) throw new Error(issue.refus)
        if ('partie' in issue) return issue
        if (essai > 0) throw new Error(GESTE_CROISE)
      }
    })
  }

  /**
   * Le geste joué au pli à `t`, puis écrit : rien que lui, ses pièces sous lui,
   * et la fin au dernier — par la porte dès qu'une réponse s'écrit, pour son
   * rituel. Rend la partie d'après, le refus en mots (rien d'écrit), ou
   * `devance` : le rang était pris, la mémoire est oubliée.
   */
  private async ecrireUnGeste(
    profileId: string,
    p: PartieGardee,
    geste: GesteDuCabinet,
    rang: number,
    t: number,
  ): Promise<{ partie: PartieLue } | { refus: string } | { devance: true }> {
    const apres = jouerUnGeste(p.depart, p.etat, geste, t)
    if (typeof apres === 'string') return { refus: apres }
    const pieces = apres.pieces.slice(p.etat.pieces.length)
    const finit = apres.fin !== null && p.etat.fin === null
    const uid = randomUUID()
    const garde = finit ? await this.musee(profileId, t) : null
    const fin = garde ? this.laFin(profileId, garde, p, apres) : null
    const lot = lotDuGeste({ serie: p.id, rang, geste, faitLe: t, uid, pieces, compagnon: this.porte.compagnonDeLaNiche(profileId), fin: fin?.aEcrire ?? null })
    let ecrites: ReponsesEcrites
    try {
      if (pieces.length === 0 && !fin) ecrites = { lus: await this.porte.client.batch(lot, 'write'), xp: [], recompenses: {} }
      else {
        const finDuRituel: FinDUnePartie | undefined = fin
          ? { serieId: p.id, quand: t, justes: apres.pieces.filter(x => x.juste).map(x => x.repondueLe), ecrite: ([g]) => g.rowsAffected === 1 }
          : undefined
        ecrites = await this.porte.ecrireDesReponses(profileId, lot, finDuRituel)
      }
    } catch (e) {
      this.oublier(profileId, p.id)
      throw e
    }
    if (ecrites.lus[0].rowsAffected !== 1) {
      this.oublier(profileId, p.id)
      return { devance: true }
    }
    const gestes = [...p.gestes, { geste, faitLe: t }]
    const suite: PartieGardee = { ...p, gestes, etat: apres, bilan: fin?.aEcrire.bilan ?? null }
    if (fin && garde) {
      this.retenirLaFin(garde, suite, fin.aEcrire, t)
      this.parties.delete(p.id)
      return { partie: { ...suite, lueA: this.maintenant(), gains: { xp: ecrites.xp, recompenses: ecrites.recompenses } } }
    }
    this.garder(this.parties, p.id, suite, PARTIES_GARDEES)
    return { partie: { ...suite, lueA: this.maintenant() } }
  }

  /** Ce que la fin écrit : le bilan, l'œuvre telle que son musée la tient à présent — une chasse du matin, un achat entre-temps l'ont pu changer. */
  private laFin(profileId: string, garde: MuseeGarde, p: PartieGardee, apres: EtatDeLaPartie): { aEcrire: FinAEcrire } {
    const musee = this.museeVu(profileId, garde)
    const cible = p.depart.cible
    const aLui = cible !== null && estUneOeuvre(cible) ? { possedee: possedees(musee).has(cible), doree: dorees(musee).has(cible) } : null
    const bilan = bilanDe(p.depart, apres, aLui)
    return { aEcrire: { profileId, bilan, oeuvre: this.oeuvreDeLaFin(garde, bilan, p.depart.jour) } }
  }

  /** L'œuvre que la fin touche, en une seule instruction : le gain, la dorure, le cartel d'un double. */
  private oeuvreDeLaFin(garde: MuseeGarde, bilan: BilanDUnePartie, jourDuDepart: string): OeuvreAEcrire | null {
    const cle = bilan.oeuvre
    if (cle === undefined || !estUneOeuvre(cle)) return null
    const ligne = garde.oeuvres.get(cle)
    const cartel = bilan.cartel !== null && !ligne?.serieId
    if (bilan.issue === 'gagnee' || bilan.issue === 'gagnee-doree') {
      // La saison se lit au jour de son départ, comme sa case et sa poussière, au calendrier du Cabinet — que le banc
      // ferme : une partie du 24 octobre close à la page du 25 n'est pas d'Halloween, celle du 31 finie après minuit l'est.
      const saison = this.reglages.calendrier.periodeDu(jourDuDepart)?.saison.key ?? null
      return { cle, origine: 'partie', saison, cartel: bilan.cartel !== null, doree: bilan.issue === 'gagnee-doree' }
    }
    const doree = bilan.issue === 'doree'
    if (!doree && !cartel) return null
    // Une œuvre de départ n'a pas de ligne : la sienne naît pour son cartel ou son cadre doré.
    return { cle, origine: ligne ? 'partie' : 'depart', saison: null, cartel, doree }
  }

  /** Ce que le lot de fin a écrit, appliqué au musée gardé : la poussière au reflet, la partie rendue si c'est la sienne, l'œuvre, la partie du jour. */
  private retenirLaFin(g: MuseeGarde, p: PartieGardee, fin: FinAEcrire, t: number) {
    if (g.profil) g.profil = { ...g.profil, poussiere: g.profil.poussiere + fin.bilan.poussiere, partie: g.profil.partie === p.id ? null : g.profil.partie }
    if (g.enCours?.id === p.id) g.enCours = null
    const duJour = g.duJour.parties.find(x => x.id === p.id)
    if (duJour) Object.assign(duJour, { finieLe: t, issue: fin.bilan.issue, total: fin.bilan.total })
    const o = fin.oeuvre
    if (!o) return
    const avant = g.oeuvres.get(o.cle)
    g.oeuvres.set(o.cle, {
      oeuvre: o.cle,
      origine: avant?.origine ?? o.origine,
      gagneeLe: avant?.gagneeLe ?? t,
      saison: avant ? avant.saison : o.origine === 'partie' ? o.saison : null,
      serieId: avant?.serieId ?? (o.cartel ? p.id : null),
      prix: avant?.prix ?? null,
      doreeLe: avant?.doreeLe ?? (o.doree ? t : null),
      dorure: avant?.dorure ?? (o.doree ? 'partie' : null),
      prixDorure: avant?.prixDorure ?? null,
      serieDoree: avant?.serieDoree ?? (o.doree ? p.id : null),
    })
  }

  // ── Un cadrage du Détail ──────────────────────────────────────────────

  /**
   * Un cadrage d'un tableau du Détail, par l'indice du tableau dans le plan
   * figé — jamais la manche : après « Changer », la même manche joue un autre
   * tableau, et l'adresse d'avant aurait rendu du cache l'image d'avant. Seul
   * se sert le tableau qu'une manche joue — ni une rechange pas encore prise,
   * ni celui que Changer a remplacé, ni celui d'une manche pas ouverte : tirés
   * d'avance, ils se verraient avant leur tour —, et de lui le cadrage déjà
   * atteint, le premier à l'ouverture, un de plus à chaque « Reculer », tous la
   * manche tranchée (`refusDuCadrage`, invariant 1). La partie se lit en
   * mémoire, zéro aller-retour ; finie, elle n'y est plus et se relit d'un lot,
   * par sa clé. Sous le verrou du profil, comme tout ce qui lit sa partie : la
   * mémoire ne se remplit jamais derrière un geste en route.
   *
   * Refusé sur la mémoire, un cadrage qui peut se servir (`peutSeServir`) se
   * relit une fois : l'autre serveur d'une mise en ligne a pu jouer la partie
   * depuis — « Reculer », « Changer », la manche suivante, la fin —, et la page
   * tient sa vue de lui. La mémoire n'est jamais en avance sur la base (elle ne
   * prend que ce qui s'est écrit) : relue, la partie ne recule pas, et la base
   * fait foi ; relue finie, son musée s'oublie avec elle (`partieDe`). Une page
   * qui suit sa vue n'est jamais refusée : ce rattrapage ne coûte rien
   * d'ordinaire.
   */
  async cadrage(profileId: string, serie: string, tirage: number, cadrage: number): Promise<IssueDuCadrage> {
    return this.porte.avecVerrou(profileId, async () => {
      for (let essai = 0; ; essai++) {
        const enMemoire = this.parties.has(serie)
        const p = await this.partieDe(profileId, serie)
        if (!p) return { introuvable: 'partie' }
        const issue = cadrageDeLaPartie(p, tirage, cadrage)
        if ('fichier' in issue || !enMemoire || essai > 0 || !peutSeServir(p.depart, tirage, cadrage)) return issue
        this.parties.delete(serie)
      }
    })
  }

  // ── Le reste ──────────────────────────────────────────────────────────

  /**
   * La base de la campagne et les tas du Cabinet, lus en fond : la page du
   * Cabinet la lance derrière sa réponse, comme l'accueil (`prechauffageAuProfil`,
   * `server.ts`) — le premier départ d'un réveil ne les attend pas. Chaque
   * page la relance : une liste de jouables neuve depuis la dernière refait
   * ses tas en fond, avant que le départ qui suit ne les demande. Ne rejette
   * jamais : ce qui manque, le départ le refera.
   */
  prechauffer(): Promise<void> {
    this.porte.prechauffer()
    return this.porte.jouables().then(
      jouables => this.tasDe(jouables),
      e => console.error('[cabinet] base de la campagne non lue, le premier départ la lira :', e),
    )
  }

  /**
   * Les tas de cette liste de jouables, prêts : rien si c'est la dernière
   * préparée, sinon sa préparation — une catégorie par tour de boucle
   * (`preparerLesTas`), jamais d'un bloc. Un départ l'attend plutôt que de
   * passer vingt-cinq mille questions au crible sur son chemin (près d'une
   * seconde ici, dix fois plus au dixième de cœur de l'hébergeur). Ne rejette
   * jamais : ratée, elle se redemande, et le tireur fait ce qui manque.
   */
  private tasDe(jouables: readonly QuestionDeLaBase[]): Promise<void> {
    if (this.tas?.jouables !== jouables) {
      const prets: Promise<void> = preparerLesTas(this.porte, jouables).catch(e => {
        if (this.tas?.prets === prets) this.tas = null
        console.error('[cabinet] tas non préparés, le tireur fera ce qui manque :', e)
      })
      this.tas = { jouables, prets }
    }
    return this.tas.prets
  }

  /**
   * Un profil supprimé : ses gestes, ses reflets et ses œuvres, **avant** que
   * la campagne efface ses séries — les gestes se trouvent par elles
   * (`supprimerProfil`, `server.ts`). Sous le verrou du profil, comme la
   * campagne : un départ ou un geste déjà en route — authentifié avant que
   * ses sessions tombent — finit d'abord, et ce qu'il a écrit s'efface avec
   * le reste ; sans lui, il recréait `cabinet_profils` derrière l'oubli, et
   * laissait des gestes sans partie au nom d'un profil supprimé. Le verrou
   * n'est pas réentrant : `supprimerProfil` appelle la campagne ensuite, qui
   * le reprend.
   */
  oublierProfil(profileId: string): Promise<void> {
    return this.porte.avecVerrou(profileId, async () => {
      this.oublier(profileId)
      await this.porte.client.batch(lotDeLOubli(profileId), 'write')
      this.oublier(profileId)
    })
  }
}
