// Ce qui se relit d'une partie du Cabinet : son départ figé
// (`campagne_series.cabinet`), un geste — envoyé par la page, ou écrit
// (`cabinet_gestes`) —, son bilan (`campagne_series.bilan`). Champ par champ,
// chaque objet refait à neuf : un champ que le format n'a pas ne voyage pas,
// un champ mal formé rend le tout illisible plutôt que de tromper le pli.
//
// Une version qu'on ne connaît pas se refuse (le gabarit de
// `lireDepartDExpedition`), et chaque version connue se relit telle qu'elle
// s'est écrite, sa version gardée : le pli joue la règle de la sienne. Chacune
// a son épreuve, écrite en dur (`cabinet-regles.test.ts`) — l'Expédition a
// perdu ses bilans à une v8 oubliée de la liste.
//
// Un départ, un geste écrit, un bilan sont des faits : ils se relisent à leur
// forme, jamais aux chiffres du jour. Le cartel d'une œuvre et « Mes réponses »
// relisent des parties finies depuis des mois ; un recul du Filet allongé, une
// mise baissée, un nom coupé plus court les auraient rendues illisibles — ou
// rejouées autrement que le journal ne les a écrites. Ce que le barème pose ou
// non, le tireur l'a jugé au départ, la règle du jeu au geste.
//
// Ce que la page envoie passe ici avant tout : un geste de cinq mille signes,
// un objet pris pour un nombre, une clé du prototype, `clore` qu'elle n'a pas
// le droit d'écrire. Ce qui dépend du contenu — le bon nombre de lettres, un
// index parmi les réponses montrées — sa règle le relit ensuite, et le refuse
// en mots.

import { CATEGORIES } from '../categories'
import { NIVEAUX, type Niveau } from '../campagne'
import { tronquer } from '../avatars'
import { jourValide } from '../jour'
import { ETOILES_D_UNE_PARTIE, MANCHES_PAR_PARTIE, SIGNES_D_UN_GESTE_MAX } from './bareme'
import type { Fiche, Lieu, Replique } from './contenu'
import { estUneOeuvre } from './oeuvres'
import { POUVOIRS, type CleDePouvoir, type Force } from './pouvoirs'
import {
  ISSUES,
  VERSIONS_DU_BILAN_DU_CABINET,
  VERSIONS_DU_DEPART,
  type BilanDUnePartie,
  type CarteDuDepart,
  type ChronoDuDepart,
  type DepartDUnePartie,
  type GesteDuCabinet,
  type Manche,
  type ReponseDUnJeu,
  type VersionDuBilan,
  type VersionDuDepart,
} from './partie'
import { regleDe, type ContenuTire } from './jeux/index'
import { CLES_DES_JEUX, type CleDeJeu } from './jeux/regle'
import type { QuestionTiree } from './jeux/outils'
import type { AffirmationTiree, EclairTire } from './jeux/eclair'
import type { DetailTire } from './jeux/detail'
import type { EpingleTiree } from './jeux/epingle'
import { TAILLES_DU_FILET, type FiletTire } from './jeux/filet'
import type { EvenementTire, FriseTiree } from './jeux/frise'
import type { IndicesTires } from './jeux/indices'
import type { MotTire } from './jeux/mot'
import type { PariTire } from './jeux/pari'
import type { RepliqueTiree } from './jeux/replique'

// ── Les briques ───────────────────────────────────────────────────────────

type Brut = Readonly<Record<string, unknown>>

const objet = (x: unknown): x is Brut => typeof x === 'object' && x !== null && !Array.isArray(x)
const chaine = (x: unknown): x is string => typeof x === 'string'
const fini = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const entier = (x: unknown, min: number, max: number): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= max
const chaineOuNull = (x: unknown): x is string | null => x === null || chaine(x)
const chaines = (x: unknown, min = 0): x is string[] => Array.isArray(x) && x.length >= min && x.every(chaine)
/** Une clé lue parmi celles d'une liste, jamais par `TABLE[cle]` : un objet répond aussi de son prototype. */
const parmi = <T extends string | number>(x: unknown, liste: readonly T[]): x is T => (chaine(x) || fini(x)) && (liste as readonly unknown[]).includes(x)
const estUneManche = (x: unknown): x is Manche => entier(x, 0, MANCHES_PAR_PARTIE - 1)
/**
 * Ce qu'une réponse de la page porte d'éléments, au plus : les affirmations de
 * l'Éclair, les jetons de la Frise. Une borne de taille, pas une règle — la
 * règle du jeu borne ensuite à ce qu'elle a montré —, et assez large pour ne
 * jamais suivre le barème : abaissée avec lui, elle aurait rendu illisibles les
 * gestes déjà écrits.
 */
const ELEMENTS_D_UNE_REPONSE_MAX = 20

/** Le texte d'une colonne, ou l'objet d'une requête : une colonne se relit d'abord en JSON. */
function json(brut: unknown): unknown {
  if (!chaine(brut)) return brut
  try {
    return JSON.parse(brut)
  } catch {
    return undefined
  }
}

/** Le premier `null` d'une suite de lectures rend tout illisible. */
const tous = <T>(lus: readonly (T | null)[]): T[] | null => (lus.every(l => l !== null) ? (lus as T[]) : null)

// ── Le contenu tiré ───────────────────────────────────────────────────────

function laQuestion(x: unknown): QuestionTiree | null {
  if (!objet(x)) return null
  const { id, texte, reponses, bonne, categorie, anecdote, niveau, sousTheme } = x
  if (!chaine(id) || !chaine(texte) || !chaines(reponses, 2) || !entier(bonne, 0, reponses.length - 1)) return null
  if (!chaineOuNull(categorie) || !chaineOuNull(anecdote) || !parmi<Niveau>(niveau, NIVEAUX) || (sousTheme !== undefined && !chaine(sousTheme))) return null
  return { id, texte, reponses: [...reponses], bonne, categorie, anecdote, niveau, ...(sousTheme !== undefined && { sousTheme }) }
}

function lePari(x: Brut): PariTire | null {
  const q1 = laQuestion(x.q1)
  const q2 = laQuestion(x.q2)
  return q1 && q2 ? { jeu: 'pari', q1, q2 } : null
}

function lEclair(x: Brut): EclairTire | null {
  if (!Array.isArray(x.affirmations) || x.affirmations.length === 0) return null
  const affirmations = tous(
    x.affirmations.map((a: unknown): AffirmationTiree | null => {
      if (!objet(a)) return null
      const question = laQuestion(a.question)
      return question && entier(a.proposee, 0, question.reponses.length - 1) ? { question, proposee: a.proposee } : null
    }),
  )
  return affirmations ? { jeu: 'eclair', affirmations } : null
}

function leMot(x: Brut): MotTire | null {
  const question = laQuestion(x.question)
  if (!question || !chaine(x.lettres) || !/^[A-Z]+$/.test(x.lettres) || !chaine(x.affiche)) return null
  return { jeu: 'mot', question, lettres: x.lettres, affiche: x.affiche }
}

/**
 * Le Filet : une piste qui contient sa réponse ; une année, entière, sur une
 * piste coupée à l'année du départ — une réponse dans l'avenir n'a jamais été
 * tirée. Le recul qu'une année doit avoir pour se poser (`seTendAuFilet`), le
 * tireur l'a jugé au départ ; relu ici au barème du jour, un recul allongé
 * aurait rendu illisibles les parties déjà jouées.
 */
function leFilet(x: Brut, annee: number): FiletTire | null {
  const question = laQuestion(x.question)
  const p = x.piste
  if (!question || !fini(x.valeur) || typeof x.annee !== 'boolean' || (x.unite !== undefined && !chaine(x.unite)) || !objet(p)) return null
  if (!fini(p.min) || !fini(p.max) || !fini(p.pas) || p.pas <= 0 || p.max <= p.min || x.valeur < p.min || x.valeur > p.max) return null
  if (x.annee && (!Number.isInteger(x.valeur) || p.max > annee)) return null
  return { jeu: 'filet', question, valeur: x.valeur, annee: x.annee, ...(x.unite !== undefined && { unite: x.unite }), piste: { min: p.min, max: p.max, pas: p.pas } }
}

function leDetail(x: Brut): DetailTire | null {
  const t = x.tableau
  if (!objet(t) || !chaine(t.qid) || !chaine(t.titre) || !chaine(t.peintre) || !Number.isInteger(t.annee)) return null
  if (!Array.isArray(x.titres) || x.titres.length < 2) return null
  // L'identifiant de chaque titre, que la pièce porte pour compter ses leurres vus : absent d'un départ écrit avant lui
  // (le 26 octobre 2026), le titre se relit sans — ses leurres ne se comptent pas, rien d'autre ne change.
  const titres = tous(
    x.titres.map((p: unknown) => (objet(p) && chaine(p.titre) && chaine(p.peintre) ? { titre: p.titre, peintre: p.peintre, ...(chaine(p.qid) && { qid: p.qid }) } : null)),
  )
  if (!titres || !entier(x.bonne, 0, titres.length - 1) || !chaineOuNull(x.anecdote) || !chaine(x.categorie)) return null
  return { jeu: 'detail', tableau: { qid: t.qid, titre: t.titre, peintre: t.peintre, annee: t.annee as number }, titres, bonne: x.bonne, anecdote: x.anecdote, categorie: x.categorie }
}

function laFrise(x: Brut): FriseTiree | null {
  if (!parmi(x.sorte, ['theme', 'sujet'] as const) || !chaine(x.cle) || !chaine(x.theme) || !chaineOuNull(x.savais) || !chaine(x.categorie)) return null
  if (x.niveau !== undefined && !parmi<Niveau>(x.niveau, NIVEAUX)) return null
  if (!Array.isArray(x.evenements) || x.evenements.length === 0) return null
  const evenements = tous(
    x.evenements.map((e: unknown): EvenementTire | null =>
      objet(e) && chaine(e.libelle) && Number.isInteger(e.annee) && (e.id === undefined || chaine(e.id))
        ? { libelle: e.libelle, annee: e.annee as number, ...(e.id !== undefined && { id: e.id as string }) }
        : null,
    ),
  )
  if (!evenements || !Array.isArray(x.vagues) || x.vagues.length === 0) return null
  const vagues = tous(x.vagues.map((v: unknown) => (Array.isArray(v) && v.every(r => entier(r, 0, evenements.length - 1)) ? [...(v as number[])] : null)))
  // Chaque événement une fois, dans une seule vague : un rang posé deux fois serait ancre et nouveau venu, un rang
  // oublié ne se poserait jamais. Leur nombre est celui de la frise tirée, jamais relu au barème du jour.
  const poses = vagues?.flat() ?? []
  if (!vagues || new Set(poses).size !== poses.length || poses.length !== evenements.length || !entier(x.vague, 0, vagues.length - 1)) return null
  return {
    jeu: 'frise',
    sorte: x.sorte,
    cle: x.cle,
    theme: x.theme,
    evenements,
    vagues,
    vague: x.vague,
    savais: x.savais,
    categorie: x.categorie,
    ...(x.niveau !== undefined && { niveau: x.niveau as Niveau }),
  }
}

/** Une catégorie de la base : le contenu neuf en porte une, que les missions lisent. */
const uneCategorie = (x: unknown): x is Lieu['categorie'] => parmi(x, CATEGORIES)

function leLieu(l: unknown): Lieu | null {
  if (!objet(l)) return null
  const { id, theme, nom, commune, departement, lat, lon, annee, date, recit, question, savais, categorie } = l
  if (![id, theme, nom, commune, departement, date, recit, question, savais].every(chaine) || !fini(lat) || !fini(lon) || !Number.isInteger(annee) || !uneCategorie(categorie)) return null
  return { id, theme, nom, commune, departement, lat, lon, annee, date, recit, question, savais, categorie } as Lieu
}

function lEpingle(x: Brut): EpingleTiree | null {
  const lieu = leLieu(x.lieu)
  const d = x.decalage
  // Le rayon se relit avec le décalage, plus grand que lui : le lieu reste dans la zone, quel que soit le barème du jour.
  if (!lieu || !objet(d) || !fini(d.cap) || !fini(d.km) || d.km < 0 || !fini(d.rayonKm) || d.rayonKm <= d.km) return null
  return { jeu: 'epingle', lieu, decalage: { cap: d.cap, km: d.km, rayonKm: d.rayonKm } }
}

function lesIndices(x: Brut): IndicesTires | null {
  const f = x.fiche
  if (!objet(f) || !chaine(f.id) || !chaine(f.reponse) || !chaines(f.cles, 1) || !chaines(f.indices, 1) || !chaine(f.savais) || !uneCategorie(f.categorie)) return null
  const fiche: Fiche = { id: f.id, reponse: f.reponse, cles: [...f.cles], indices: [...f.indices], savais: f.savais, categorie: f.categorie }
  return { jeu: 'indices', fiche }
}

function laReplique(x: Brut): RepliqueTiree | null {
  const r = x.replique
  if (!objet(r) || ![r.id, r.avant, r.mot, r.apres, r.qui, r.source, r.savais].every(chaine) || !chaines(r.leurres) || !chaines(r.autres) || !uneCategorie(r.categorie)) return null
  const replique = { id: r.id, avant: r.avant, mot: r.mot, apres: r.apres, leurres: [...r.leurres], qui: r.qui, autres: [...r.autres], source: r.source, savais: r.savais, categorie: r.categorie } as Replique
  if (!chaines(x.mots, 2) || !chaines(x.personnes, 2) || !entier(x.bonMot, 0, x.mots.length - 1) || !entier(x.bonneQui, 0, x.personnes.length - 1)) return null
  const o = x.ordreDesEffaces
  // L'ordre où Éclairer efface, figé au départ : des rangs de l'étape, chacun une fois — ce qu'il effacera ne se rebat pas.
  const ordre = (rangs: unknown, n: number) => (Array.isArray(rangs) && rangs.every(k => entier(k, 0, n - 1)) && new Set(rangs).size === rangs.length ? [...(rangs as number[])] : null)
  if (!Array.isArray(o) || o.length !== 2) return null
  const mots = ordre(o[0], x.mots.length)
  const personnes = ordre(o[1], x.personnes.length)
  if (!mots || !personnes) return null
  return { jeu: 'replique', replique, mots: [...x.mots], personnes: [...x.personnes], bonMot: x.bonMot, bonneQui: x.bonneQui, ordreDesEffaces: [mots, personnes] }
}

/** Un contenu tiré, relu selon la variante de son jeu ; null : illisible, ou d'un autre jeu que sa partie. */
function leContenu(x: unknown, jeu: CleDeJeu, annee: number): ContenuTire | null {
  if (!objet(x) || x.jeu !== jeu) return null
  switch (jeu) {
    case 'pari':
      return lePari(x)
    case 'eclair':
      return lEclair(x)
    case 'mot':
      return leMot(x)
    case 'filet':
      return leFilet(x, annee)
    case 'detail':
      return leDetail(x)
    case 'frise':
      return laFrise(x)
    case 'epingle':
      return lEpingle(x)
    case 'indices':
      return lesIndices(x)
    case 'replique':
      return laReplique(x)
  }
}

// ── Le départ ─────────────────────────────────────────────────────────────

function laCarte(c: unknown): CarteDuDepart | null | undefined {
  if (c === null) return null
  if (!objet(c) || !chaine(c.cle) || !parmi<CleDePouvoir>(c.pouvoir, Object.keys(POUVOIRS) as CleDePouvoir[]) || !entier(c.force, 1, 3)) return undefined
  return { cle: c.cle, pouvoir: c.pouvoir, force: c.force as Force }
}

/** Une durée du chrono, en millisecondes entières. */
const duree = (x: unknown, min: number): x is number => entier(x, min, Number.MAX_SAFE_INTEGER)

/**
 * Le chrono figé d'un départ : une durée par étape de son jeu, et du temps en
 * plus seulement sous la carte qui le donne. Ses chiffres sont ceux de son
 * départ, jamais comparés au barème du jour (`ChronoDuDepart`).
 */
function leChrono(c: unknown, jeu: CleDeJeu, carte: CarteDuDepart | null): ChronoDuDepart | null {
  if (!objet(c) || !Array.isArray(c.etapesMs) || c.etapesMs.length !== regleDe(jeu).etapes || !c.etapesMs.every(x => duree(x, 1))) return null
  if (!duree(c.enPlusMs, 0) || (c.enPlusMs > 0 && carte?.pouvoir !== 'temps') || !duree(c.graceMs, 0) || !duree(c.pauseMs, 0)) return null
  return { etapesMs: [...(c.etapesMs as number[])], enPlusMs: c.enPlusMs, graceMs: c.graceMs, pauseMs: c.pauseMs }
}

/**
 * Le départ figé d'une partie, relu ; null : illisible, ou d'une version que
 * ce code ne joue pas. Sa version se garde telle qu'écrite : le pli joue la
 * règle de la sienne. Chaque contenu tiré se relit à la variante de son jeu —
 * l'épingle et son décalage, la réplique et l'ordre de ses effacés compris —,
 * tous du jeu de la partie ; la Frise, trois vagues d'une même frise, aucune
 * rechange ; le chrono, à ses chiffres d'alors.
 */
export function lireLeDepart(brut: unknown): DepartDUnePartie | null {
  const d = json(brut)
  if (!objet(d)) return null
  const { v, jeu, origine, visite, jour, cible, but, retente, seuil, payee, graine, theme } = d
  if (!parmi<VersionDuDepart>(v, VERSIONS_DU_DEPART) || !parmi<CleDeJeu>(jeu, CLES_DES_JEUX) || !parmi(origine, ['visite', 'chasse', 'libre'] as const) || !jourValide(jour)) return null
  if (origine === 'visite' ? !estUneManche(visite) : visite !== undefined) return null
  if (!(cible === null || estUneOeuvre(cible)) || !(but === null || parmi(but, ['gagner', 'dorer'] as const)) || !(retente === undefined || retente === true)) return null
  // Le seuil se lit sur les étoiles d'une partie, trois manches de trois : la forme du jeu, pas un barème qui bouge.
  if (!(seuil === null || entier(seuil, 0, ETOILES_D_UNE_PARTIE)) || typeof payee !== 'boolean' || !chaine(graine) || graine === '' || !(theme === undefined || chaine(theme))) return null
  const carte = laCarte(d.carte)
  if (carte === undefined) return null
  const chrono = leChrono(d.chrono, jeu, carte)
  if (!chrono || !Array.isArray(d.tirages) || d.tirages.length < MANCHES_PAR_PARTIE) return null
  const annee = Number(jour.slice(0, 4))
  const tirages = tous(d.tirages.map((t: unknown) => leContenu(t, jeu, annee)))
  if (!tirages) return null
  // La Frise se construit d'un bout à l'autre : ses trois vagues, chacune à sa manche, et jamais de rechange.
  if (jeu === 'frise' && (tirages.length !== MANCHES_PAR_PARTIE || tirages.some((t, k) => (t as FriseTiree).vague !== k))) return null
  return {
    v,
    jeu,
    origine,
    ...(origine === 'visite' && { visite: visite as Manche }),
    jour,
    cible,
    but,
    ...(retente && { retente: true as const }),
    seuil,
    payee,
    carte,
    chrono,
    graine,
    ...(theme !== undefined && { theme }),
    tirages,
  }
}

// ── Un geste ──────────────────────────────────────────────────────────────

/** Un index que la page envoie, avant que sa règle ne le borne aux propositions montrées. */
const unIndex = (x: unknown): x is number => entier(x, 0, 99)

/**
 * Ce qu'un `repondre` porte, sous une seule clé de jeu, chaque champ relu :
 * undefined, rien de lisible ; null, rien d'envoyé — la page à l'échéance, les
 * mains vides.
 */
function laReponse(r: unknown): ReponseDUnJeu | null | undefined {
  if (r === undefined || r === null) return null
  if (!objet(r)) return undefined
  const cles = Object.keys(r)
  if (cles.length !== 1) return undefined
  const [jeu] = cles
  const x = r[jeu]
  if (!objet(x)) return undefined
  switch (jeu) {
    case 'pari':
      return unIndex(x.choix) ? { pari: { choix: x.choix } } : undefined
    case 'eclair':
      return Array.isArray(x.reponses) && x.reponses.length <= ELEMENTS_D_UNE_REPONSE_MAX && x.reponses.every(v => v === null || typeof v === 'boolean')
        ? { eclair: { reponses: [...(x.reponses as (boolean | null)[])] } }
        : undefined
    case 'filet':
      return fini(x.x) && parmi(x.taille, TAILLES_DU_FILET) ? { filet: { x: x.x, taille: x.taille } } : undefined
    case 'detail':
      return unIndex(x.titre) ? { detail: { titre: x.titre } } : undefined
    case 'frise':
      return Array.isArray(x.ordre) && x.ordre.length <= ELEMENTS_D_UNE_REPONSE_MAX && x.ordre.every(unIndex) && new Set(x.ordre).size === x.ordre.length
        ? { frise: { ordre: [...(x.ordre as number[])] } }
        : undefined
    case 'epingle':
      return fini(x.lat) && fini(x.lon) ? { epingle: { lat: x.lat, lon: x.lon } } : undefined
    case 'replique':
      return unIndex(x.qui) ? { replique: { qui: x.qui } } : undefined
    default:
      return undefined
  }
}

/**
 * Un geste, relu champ par champ ; null : il ne se lit pas (« Ce geste ne se
 * lit pas : recharge la page »). La manche dans ses trois, des lettres en
 * capitales sans accents, une épingle en nombres finis, un curseur fini, des
 * index entiers ; le nom tapé coupé par `tronquer` à `SIGNES_D_UN_GESTE_MAX`
 * — jamais par `slice`, un emoji à la frontière laisserait sa moitié —, avant
 * d'être jugé et écrit. Un geste écrit (`duServeur`) se relit tel qu'il s'est
 * écrit : coupé à son arrivée, il ne se recoupe pas au barème du jour — un nom
 * jugé sur soixante signes, recoupé à cinquante, se serait jugé autrement à la
 * relecture. `clore` ne se lit que d'un geste écrit par le serveur : la page
 * n'a pas à clore une partie.
 */
export function lireUnGeste(brut: unknown, o: { duServeur?: boolean } = {}): GesteDuCabinet | null {
  const g = json(brut)
  if (!objet(g) || !chaine(g.quoi)) return null
  if (g.quoi === 'quitter') return { quoi: 'quitter' }
  if (g.quoi === 'clore') return o.duServeur && g.pourquoi === 'lendemain' ? { quoi: 'clore', pourquoi: 'lendemain' } : null
  const { manche } = g
  if (!estUneManche(manche)) return null
  const signes = o.duServeur ? Number.POSITIVE_INFINITY : SIGNES_D_UN_GESTE_MAX
  switch (g.quoi) {
    case 'ouvrir':
      if (!(g.miser === undefined || typeof g.miser === 'boolean')) return null
      return { quoi: 'ouvrir', manche, ...(g.miser === true && { miser: true as const }) }
    case 'pause':
    case 'reprendre':
    case 'changer':
    case 'reculer':
    case 'indice':
    case 'garder':
    case 'parier':
      return { quoi: g.quoi, manche }
    case 'eclairer':
      if (!(g.affirmation === undefined || unIndex(g.affirmation))) return null
      return { quoi: 'eclairer', manche, ...(g.affirmation !== undefined && { affirmation: g.affirmation as number }) }
    case 'essai':
      return chaine(g.lettres) && g.lettres.length <= signes && /^[A-Z]+$/.test(g.lettres) ? { quoi: 'essai', manche, lettres: g.lettres } : null
    case 'nom':
      return chaine(g.texte) ? { quoi: 'nom', manche, texte: tronquer(g.texte, signes) } : null
    case 'mot':
      return unIndex(g.choix) ? { quoi: 'mot', manche, choix: g.choix } : null
    case 'repondre': {
      if (!(g.auto === undefined || typeof g.auto === 'boolean')) return null
      const reponse = laReponse(g.reponse)
      if (reponse === undefined) return null
      return { quoi: 'repondre', manche, ...(g.auto === true && { auto: true as const }), ...(reponse !== null && { reponse }) }
    }
    default:
      return null
  }
}

// ── Le bilan ──────────────────────────────────────────────────────────────

/**
 * Ce qu'un bilan de chaque version peut porter, figé avec elle : les étoiles
 * d'une manche après les pouvoirs — trois, et la plus forte mise de son temps,
 * quatre —, ses étoiles naturelles, le total. Jamais lues au barème du jour :
 * une mise baissée aurait rendu illisible chaque bilan qui en portait une plus
 * forte, écrit et jamais réécrit. Le barème du jour doit tenir dans les bornes
 * de la version qu'il écrit (`cabinet-regles.test.ts`) : une mise relevée en
 * monte la version (`VERSIONS_DU_BILAN_DU_CABINET`), avec ses bornes.
 */
export const BORNES_DES_BILANS: Readonly<Record<VersionDuBilan, { etoiles: number; naturel: number; total: number }>> = {
  1: { etoiles: 7, naturel: 3, total: 9 },
}

/** Le bilan figé d'une partie finie, sa version gardée ; null : illisible, ou d'une version que ce code ne lit pas. */
export function lireLeBilan(brut: unknown): BilanDUnePartie | null {
  const b = json(brut)
  if (!objet(b)) return null
  const { v } = b
  if (!parmi<VersionDuBilan>(v, VERSIONS_DU_BILAN_DU_CABINET)) return null
  const bornes = BORNES_DES_BILANS[v]
  const troisEntiers = (x: unknown, max: number): x is [number, number, number] => Array.isArray(x) && x.length === MANCHES_PAR_PARTIE && x.every(n => entier(n, 0, max))
  const { etoiles, naturel, aidee, total, quittee, lendemain, issue, poussiere, oeuvre, cartel } = b
  if (!troisEntiers(etoiles, bornes.etoiles) || !troisEntiers(naturel, bornes.naturel) || typeof aidee !== 'boolean' || !entier(total, 0, bornes.total)) return null
  if (!(quittee === undefined || quittee === true) || !(lendemain === undefined || lendemain === true) || !parmi(issue, ISSUES) || !entier(poussiere, 0, Number.MAX_SAFE_INTEGER)) return null
  if (!(oeuvre === undefined || estUneOeuvre(oeuvre)) || !(cartel === null || estUneManche(cartel))) return null
  return {
    v,
    etoiles: [...etoiles],
    naturel: [...naturel],
    aidee,
    total,
    ...(quittee && { quittee: true as const }),
    ...(lendemain && { lendemain: true as const }),
    issue,
    poussiere,
    ...(oeuvre !== undefined && { oeuvre }),
    cartel,
  }
}
