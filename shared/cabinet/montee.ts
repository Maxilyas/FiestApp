// La tour du Cabinet : neuf étages, un par salle — le Vestibule d'abord, puis
// les huit salles dans l'ordre du musée —, qu'on monte en ouvrant une porte à
// chaque étage. Derrière chaque porte, une partie de trois manches, la même
// que partout ailleurs au Cabinet (`partie.ts`) : elle s'ouvre au seuil figé de
// son départ, comme une œuvre se gagne. Ouverte, elle donne ce qu'elle
// montrait — son œuvre, un cœur, les étoiles de l'étage doublées — ; fermée,
// elle coûte un cœur, et l'on monte quand même. La montée s'arrête au dernier
// cœur, au sommet, ou à minuit.
//
// Pourquoi une tour : « on aime bien tous les mini-jeux du Cabinet, mais il
// manque le monde aventure — garder une progression et monter étage en
// étage », et « l'essentiel de pourquoi le faire, qu'est-ce qu'on gagne, n'y
// est pas » (les retours que le propriétaire a rapportés le 31 octobre 2026).
// Une porte montre donc l'œuvre qu'elle garde, sa peinture comprise : le cadre
// vide du musée la tait toujours, la porte la promet.
//
// Rien ne s'écrit pour la montée elle-même : chaque partie fige son étage dans
// son départ (`MonteeDuDepart`), et la montée se relit des parties du jour
// (`monteeDesParties`), comme la visite se relit du musée — un pli pur, que le
// serveur, la page et les tests lisent (invariant 14). Seul le record s'écrit
// à part (`cabinet_records`), à la fin de la partie qui le bat : il survit au
// jour. Les portes d'un étage se tirent de la graine secrète du profil, du
// jour, de la montée et de l'étage (`portesDeLEtage`) : les mêmes à chaque
// page, sans rien écrire ; le départ revérifie qu'elles n'ont pas changé
// entre-temps (`cadreDuDepart`, `shared/cabinet/musee.ts`).

import { hasardDe } from '../missions'
import { COEURS_D_UNE_MONTEE, COEURS_D_UNE_PORTE, ETAGES_DU_COFFRE, ETOILES_D_UNE_PORTE, SEUILS_DES_RARETES, SEUIL_D_UNE_PORTE } from './bareme'
import { possedees, tirerPese, type Musee, type PartieDuJour } from './musee'
import { JEU_DE_L_OEUVRE, OEUVRES, oeuvresDeLaSalle, type CleDOeuvre, type Oeuvre, type Rarete } from './oeuvres'
import { JEUX_PRETS } from './ouverture'
import type { ButinDUnePorte } from './partie'
import { SALLES, type CleDeSalle } from './salles'
import { battre } from './jeux/outils'
import type { CleDeJeu } from './jeux/regle'

// ── La tour ───────────────────────────────────────────────────────────────

/** Les étages, du bas vers le haut : le Vestibule, qui est pour tout le monde, puis les huit salles dans l'ordre du musée. */
export const ORDRE_DE_LA_TOUR: readonly CleDeSalle[] = ['vestibule', ...SALLES.map(s => s.cle).filter(c => c !== 'vestibule')]
/** Neuf : un étage par salle. */
export const ETAGES_DE_LA_TOUR = ORDRE_DE_LA_TOUR.length

/** La salle d'un étage, compté de 1 ; rien hors de la tour. */
export const salleDeLEtage = (etage: number): CleDeSalle | undefined => (Number.isInteger(etage) ? ORDRE_DE_LA_TOUR[etage - 1] : undefined)
/** L'étage d'une salle, compté de 1. */
export const etageDeLaSalle = (salle: CleDeSalle): number => ORDRE_DE_LA_TOUR.indexOf(salle) + 1
/** Un étage dont l'unique porte garde un coffre (`ETAGES_DU_COFFRE`). */
export const estUnCoffre = (etage: number): boolean => ETAGES_DU_COFFRE.includes(etage)

// ── Les portes ────────────────────────────────────────────────────────────

/** Une porte d'un étage : le jeu derrière elle, ce qu'elle promet, l'œuvre qu'elle garde, les étoiles qui l'ouvrent. */
export interface PorteDeLEtage {
  porte: number
  jeu: CleDeJeu
  butin: ButinDUnePorte
  /** L'œuvre qu'elle garde ; null pour un cœur ou les étoiles doublées. */
  cible: CleDOeuvre | null
  /** Le seuil de sa rareté pour une œuvre (`SEUILS_DES_RARETES`), sinon `SEUIL_D_UNE_PORTE`. */
  seuil: number
  coffre: boolean
}

/** Ce qui fait les portes d'un étage : la graine secrète du profil (celle de la visite), le jour, la montée, l'étage, ses cœurs et son musée. */
export interface CeQueTirentLesPortes {
  graine: string
  jour: string
  n: number
  etage: number
  coeurs: number
  possede: ReadonlySet<CleDOeuvre>
  jeux: readonly CleDeJeu[]
}

/**
 * Les portes d'un étage. Deux d'ordinaire : l'une garde une œuvre de la salle
 * qui lui manque — une commune ou une rare d'abord, au poids de sa rareté —,
 * à jouer au jeu où elle se trouve (`JEU_DE_L_OEUVRE`, comme sa chasse) et au
 * seuil de sa rareté ; l'autre, un autre jeu, rend un cœur — ou double les
 * étoiles de l'étage quand rien n'a été perdu. Une seule aux étages du coffre :
 * une rare, une maudite ou une épique. Une salle complète promet une œuvre
 * d'ailleurs — la porte en garde toujours une tant que le musée n'est pas
 * plein. L'ordre des portes se tire aussi : l'œuvre n'est pas toujours à
 * gauche.
 */
export function portesDeLEtage(o: CeQueTirentLesPortes): PorteDeLEtage[] {
  const salle = salleDeLEtage(o.etage)
  if (!salle || o.jeux.length === 0) return []
  const hasard = hasardDe(`${o.graine}:tour:${o.jour}:${o.n}:${o.etage}`)
  const aGagner = (liste: readonly Oeuvre[], raretes: readonly Rarete[]) =>
    liste.filter(x => !o.possede.has(x.cle) && raretes.includes(x.rarete) && o.jeux.includes(JEU_DE_L_OEUVRE[x.cle]))
  const premiere = (...listes: Oeuvre[][]): Oeuvre | null => {
    for (const l of listes) if (l.length > 0) return tirerPese(l, hasard)
    return null
  }
  const deLaSalle = oeuvresDeLaSalle(salle)
  const jeux = battre(o.jeux, hasard)
  const porteDe = (cible: Oeuvre | null, jeu: CleDeJeu, sansOeuvre: ButinDUnePorte, coffre: boolean): PorteDeLEtage =>
    cible
      ? { porte: 0, jeu: JEU_DE_L_OEUVRE[cible.cle], butin: 'oeuvre', cible: cible.cle, seuil: SEUILS_DES_RARETES[cible.rarete], coffre }
      : { porte: 0, jeu, butin: sansOeuvre, cible: null, seuil: SEUIL_D_UNE_PORTE, coffre }
  if (estUnCoffre(o.etage)) {
    const precieuse = premiere(
      aGagner(deLaSalle, ['rare', 'maudit', 'epique']),
      aGagner(deLaSalle, ['commun']),
      aGagner(OEUVRES, ['rare', 'maudit', 'epique']),
      aGagner(OEUVRES, ['commun']),
    )
    return [porteDe(precieuse, jeux[0], 'etoiles', true)]
  }
  const oeuvre = premiere(aGagner(deLaSalle, ['commun', 'rare']), aGagner(deLaSalle, ['maudit', 'epique']), aGagner(OEUVRES, ['commun', 'rare']), aGagner(OEUVRES, ['maudit', 'epique']))
  const sonJeu = oeuvre ? JEU_DE_L_OEUVRE[oeuvre.cle] : jeux[0]
  const autreJeu = jeux.find(j => j !== sonJeu) ?? sonJeu
  const portes = [porteDe(oeuvre, sonJeu, 'etoiles', false), porteDe(null, autreJeu, o.coeurs < COEURS_D_UNE_MONTEE ? 'coeur' : 'etoiles', false)]
  return battre(portes, hasard).map((p, k) => ({ ...p, porte: k }))
}

// ── La montée ─────────────────────────────────────────────────────────────

/** Un étage joué, ou qui se joue : sa porte, et ce qu'elle a fait. */
export interface EtageJoue {
  etage: number
  jeu: CleDeJeu
  butin: ButinDUnePorte
  cible: string | null
  seuil: number
  /** Les étoiles de sa partie ; null tant qu'elle se joue. */
  total: number | null
  /** La porte s'est-elle ouverte ? null tant que sa partie se joue. */
  ouverte: boolean | null
  /** Ce qu'il ajoute aux étoiles de la montée : le total, doublé derrière la porte qui double. */
  etoiles: number
}

/** Une montée du jour, telle que ses parties la disent. */
export interface EtatDeLaMontee {
  /** Sa place dans la journée : la première, la deuxième… */
  n: number
  /** La carte-bonus de toute la montée, choisie au premier étage. */
  carte: string | null
  coeurs: number
  etoiles: number
  etages: EtageJoue[]
  /** Le dernier étage joué jusqu'au bout ; zéro avant le premier. */
  hauteur: number
  /** Une partie de la montée se joue. */
  enCours: boolean
  finie: boolean
  /** Les neuf étages joués. */
  sommet: boolean
  /** L'étage à jouer ; null : finie, ou une partie attend. */
  prochain: number | null
}

/** La montée la plus récente du jour, par son numéro ; null : aucune aujourd'hui. */
export function derniereMontee(parties: readonly PartieDuJour[]): number | null {
  let n: number | null = null
  for (const p of parties) if (p.origine === 'montee' && p.montee && (n === null || p.montee.n > n)) n = p.montee.n
  return n
}

/**
 * La montée `n` du jour, de ses parties : chaque porte franchie dans l'ordre
 * des étages, ouverte à son seuil figé. Une partie quittée, ou close le
 * lendemain, a fini ; ses étoiles comptent, et sa porte s'ouvre si elles
 * suffisent. Deux parties au même étage — deux serveurs pendant une mise en
 * ligne, que la garde du départ refuse déjà — : la première commencée compte.
 */
export function monteeDesParties(parties: readonly PartieDuJour[], n: number): EtatDeLaMontee {
  const parEtage = new Map<number, PartieDuJour & { montee: NonNullable<PartieDuJour['montee']> }>()
  for (const p of parties) {
    if (p.origine !== 'montee' || !p.montee || p.montee.n !== n) continue
    const avant = parEtage.get(p.montee.etage)
    if (!avant || p.commenceeLe < avant.commenceeLe) parEtage.set(p.montee.etage, { ...p, montee: p.montee })
  }
  const siennes = [...parEtage.values()].sort((a, b) => a.montee.etage - b.montee.etage)
  let coeurs = COEURS_D_UNE_MONTEE
  let etoiles = 0
  let enCours = false
  let hauteur = 0
  const etages: EtageJoue[] = []
  for (const p of siennes) {
    const seuil = p.seuil ?? SEUIL_D_UNE_PORTE
    const porte = { etage: p.montee.etage, jeu: p.jeu, butin: p.montee.butin, cible: p.cible, seuil }
    if (p.finieLe === null || p.total === null) {
      enCours = true
      etages.push({ ...porte, total: null, ouverte: null, etoiles: 0 })
      continue
    }
    const ouverte = p.total >= seuil
    const gagnees = ouverte && p.montee.butin === 'etoiles' ? p.total * ETOILES_D_UNE_PORTE : p.total
    etoiles += gagnees
    if (!ouverte) coeurs = Math.max(0, coeurs - 1)
    else if (p.montee.butin === 'coeur') coeurs = Math.min(COEURS_D_UNE_MONTEE, coeurs + COEURS_D_UNE_PORTE)
    hauteur = p.montee.etage
    etages.push({ ...porte, total: p.total, ouverte, etoiles: gagnees })
  }
  const sommet = !enCours && hauteur >= ETAGES_DE_LA_TOUR
  const finie = !enCours && (coeurs === 0 || sommet)
  return { n, carte: siennes[0]?.montee.carte ?? null, coeurs, etoiles, etages, hauteur, enCours, finie, sommet, prochain: enCours || finie ? null : hauteur + 1 }
}

// ── La tour du jour ───────────────────────────────────────────────────────

/** Ce que la tour tire de son hasard : la graine secrète du profil, la même que la visite (`GraineDeLaVisite`). */
export interface GraineDeLaTour {
  graine: string
  jour: string
  /** Les jeux livrés (`JEUX_PRETS`) ; un essai en passe d'autres. */
  jeux?: readonly CleDeJeu[]
}

/** L'étage que « Monter » ou « Continuer » ouvre : sa montée, son étage, les cœurs qu'elle a, ses portes. */
export interface EtageAJouer {
  n: number
  etage: number
  coeurs: number
  portes: PorteDeLEtage[]
}

/** La tour d'un profil, aujourd'hui : sa montée la plus récente, et l'étage à jouer — null tant qu'une partie de la montée attend. */
export interface TourDuJour {
  montee: EtatDeLaMontee | null
  aJouer: EtageAJouer | null
}

/**
 * La tour du jour : la montée en route continue à son étage suivant ; finie, ou
 * sans montée aujourd'hui, la suivante part du premier étage, trois cœurs.
 */
export function tourDuJour(m: Musee, o: GraineDeLaTour): TourDuJour {
  const parties = m.duJour.jour === o.jour ? m.duJour.parties : []
  const n = derniereMontee(parties)
  const montee = n === null ? null : monteeDesParties(parties, n)
  if (montee?.enCours) return { montee, aJouer: null }
  const suite = montee && !montee.finie && montee.prochain !== null ? { n: montee.n, etage: montee.prochain, coeurs: montee.coeurs } : { n: (n ?? 0) + 1, etage: 1, coeurs: COEURS_D_UNE_MONTEE }
  const portes = portesDeLEtage({ graine: o.graine, jour: o.jour, ...suite, possede: possedees(m), jeux: o.jeux ?? JEUX_PRETS })
  return { montee, aJouer: { ...suite, portes } }
}

// ── Le record ─────────────────────────────────────────────────────────────

/** La plus haute montée d'un profil : l'étage atteint, puis ses étoiles pour départager (`cabinet_records`). */
export interface RecordDeLaTour {
  etage: number
  etoiles: number
}

/** Ce qu'une montée vaut au record. */
export const recordDeLaMontee = (m: Pick<EtatDeLaMontee, 'hauteur' | 'etoiles'>): RecordDeLaTour => ({ etage: m.hauteur, etoiles: m.etoiles })

/** Le record `b` bat-il `a` ? Plus haut, ou aussi haut avec plus d'étoiles — la règle même de l'instruction qui l'écrit (`lotDuGeste`). */
export const batLeRecord = (a: RecordDeLaTour | null, b: RecordDeLaTour): boolean => b.etage > 0 && (!a || b.etage > a.etage || (b.etage === a.etage && b.etoiles > a.etoiles))
