// Ce qui se relit d'une partie du Cabinet : son départ figé
// (`campagne_series.cabinet`), un geste — envoyé par la page, ou écrit
// (`cabinet_gestes`) —, son bilan (`campagne_series.bilan`). Champ par champ,
// chaque objet refait à neuf : un champ que le format n'a pas ne voyage pas,
// un champ mal formé rend le tout illisible plutôt que de tromper le pli.
//
// Une version qu'on ne connaît pas se refuse (le gabarit de
// `lireDepartDExpedition`) : relue à une autre règle, une manche en route
// changerait d'échéance ou de barème. Chaque version connue a son épreuve
// (`cabinet-regles.test.ts`) — l'Expédition a perdu ses bilans à une v8
// oubliée de la liste.
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
import { ETOILES_D_UNE_PARTIE, ETOILES_PAR_MANCHE, EVENEMENTS_D_UNE_FRISE_A_THEME, MANCHES_PAR_PARTIE, SIGNES_D_UN_GESTE_MAX, BONUS_DE_MISE } from './bareme'
import type { Fiche, Lieu, Replique } from './contenu'
import { estUneOeuvre } from './oeuvres'
import { POUVOIRS, type CleDePouvoir, type Force } from './pouvoirs'
import { ISSUES, VERSION_DU_BILAN, VERSION_DU_DEPART, type BilanDUnePartie, type CarteDuDepart, type DepartDUnePartie, type GesteDuCabinet, type Manche, type ReponseDUnJeu } from './partie'
import type { ContenuTire } from './jeux/index'
import { CLES_DES_JEUX, type CleDeJeu } from './jeux/regle'
import type { QuestionTiree } from './jeux/outils'
import type { AffirmationTiree, EclairTire } from './jeux/eclair'
import type { DetailTire } from './jeux/detail'
import type { EpingleTiree } from './jeux/epingle'
import { TAILLES_DU_FILET, seTendAuFilet, type FiletTire } from './jeux/filet'
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
const parmi = <T extends string>(x: unknown, liste: readonly T[]): x is T => chaine(x) && (liste as readonly string[]).includes(x)
const estUneManche = (x: unknown): x is Manche => entier(x, 0, MANCHES_PAR_PARTIE - 1)

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

/** Le Filet relit sa piste contre l'année du départ : une année plus récente que son recul ne s'y pose pas (`seTendAuFilet`). */
function leFilet(x: Brut, annee: number): FiletTire | null {
  const question = laQuestion(x.question)
  const p = x.piste
  if (!question || !fini(x.valeur) || typeof x.annee !== 'boolean' || (x.unite !== undefined && !chaine(x.unite)) || !objet(p)) return null
  if (!fini(p.min) || !fini(p.max) || !fini(p.pas) || p.pas <= 0 || p.max <= p.min || x.valeur < p.min || x.valeur > p.max) return null
  if (!seTendAuFilet(x.valeur, x.annee, annee)) return null
  return { jeu: 'filet', question, valeur: x.valeur, annee: x.annee, ...(x.unite !== undefined && { unite: x.unite }), piste: { min: p.min, max: p.max, pas: p.pas } }
}

function leDetail(x: Brut): DetailTire | null {
  const t = x.tableau
  if (!objet(t) || !chaine(t.qid) || !chaine(t.titre) || !chaine(t.peintre) || !Number.isInteger(t.annee)) return null
  if (!Array.isArray(x.titres) || x.titres.length < 2) return null
  const titres = tous(x.titres.map((p: unknown) => (objet(p) && chaine(p.titre) && chaine(p.peintre) ? { titre: p.titre, peintre: p.peintre } : null)))
  if (!titres || !entier(x.bonne, 0, titres.length - 1) || !chaineOuNull(x.anecdote) || !chaine(x.categorie)) return null
  return { jeu: 'detail', tableau: { qid: t.qid, titre: t.titre, peintre: t.peintre, annee: t.annee as number }, titres, bonne: x.bonne, anecdote: x.anecdote, categorie: x.categorie }
}

function laFrise(x: Brut): FriseTiree | null {
  if (!parmi(x.sorte, ['theme', 'sujet'] as const) || !chaine(x.cle) || !chaine(x.theme) || !chaineOuNull(x.savais) || !chaine(x.categorie)) return null
  if (x.niveau !== undefined && !parmi<Niveau>(x.niveau, NIVEAUX)) return null
  if (!Array.isArray(x.evenements) || x.evenements.length === 0 || x.evenements.length > EVENEMENTS_D_UNE_FRISE_A_THEME) return null
  const evenements = tous(
    x.evenements.map((e: unknown): EvenementTire | null =>
      objet(e) && chaine(e.libelle) && Number.isInteger(e.annee) && (e.id === undefined || chaine(e.id))
        ? { libelle: e.libelle, annee: e.annee as number, ...(e.id !== undefined && { id: e.id as string }) }
        : null,
    ),
  )
  if (!evenements || !Array.isArray(x.vagues) || x.vagues.length === 0) return null
  const vagues = tous(x.vagues.map((v: unknown) => (Array.isArray(v) && v.every(r => entier(r, 0, evenements.length - 1)) ? [...(v as number[])] : null)))
  // Chaque événement une fois, dans une seule vague : un rang posé deux fois serait ancre et nouveau venu.
  if (!vagues || new Set(vagues.flat()).size !== vagues.flat().length || !entier(x.vague, 0, vagues.length - 1)) return null
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
  if (!lieu || !objet(d) || !fini(d.cap) || !fini(d.km) || d.km < 0) return null
  return { jeu: 'epingle', lieu, decalage: { cap: d.cap, km: d.km } }
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

/** Les versions de départ que ce code relit : chacune la sienne, et son épreuve. */
export const VERSIONS_DU_DEPART_LUES: readonly number[] = [VERSION_DU_DEPART]

function laCarte(c: unknown): CarteDuDepart | null | undefined {
  if (c === null) return null
  if (!objet(c) || !chaine(c.cle) || !parmi<CleDePouvoir>(c.pouvoir, Object.keys(POUVOIRS) as CleDePouvoir[]) || !entier(c.force, 1, 3)) return undefined
  return { cle: c.cle, pouvoir: c.pouvoir, force: c.force as Force }
}

/**
 * Le départ figé d'une partie, relu ; null : illisible, ou d'une version que
 * ce code ne joue pas. Chaque contenu tiré se relit à la variante de son jeu —
 * l'épingle et son décalage, la réplique et l'ordre de ses effacés compris —,
 * tous du jeu de la partie ; la Frise, trois vagues d'une même frise, aucune
 * rechange.
 */
export function lireLeDepart(brut: unknown): DepartDUnePartie | null {
  const d = json(brut)
  if (!objet(d) || !VERSIONS_DU_DEPART_LUES.includes(d.v as number)) return null
  const { jeu, origine, visite, jour, cible, but, retente, seuil, payee, graine, theme } = d
  if (!parmi<CleDeJeu>(jeu, CLES_DES_JEUX) || !parmi(origine, ['visite', 'chasse', 'libre'] as const) || !jourValide(jour)) return null
  if (origine === 'visite' ? !estUneManche(visite) : visite !== undefined) return null
  if (!(cible === null || estUneOeuvre(cible)) || !(but === null || parmi(but, ['gagner', 'dorer'] as const)) || !(retente === undefined || retente === true)) return null
  if (!(seuil === null || entier(seuil, 0, ETOILES_D_UNE_PARTIE)) || typeof payee !== 'boolean' || !chaine(graine) || graine === '' || !(theme === undefined || chaine(theme))) return null
  const carte = laCarte(d.carte)
  if (carte === undefined || !Array.isArray(d.tirages) || d.tirages.length < MANCHES_PAR_PARTIE) return null
  const annee = Number(jour.slice(0, 4))
  const tirages = tous(d.tirages.map((t: unknown) => leContenu(t, jeu, annee)))
  if (!tirages) return null
  // La Frise se construit d'un bout à l'autre : ses trois vagues, chacune à sa manche, et jamais de rechange.
  if (jeu === 'frise' && (tirages.length !== MANCHES_PAR_PARTIE || tirages.some((t, k) => (t as FriseTiree).vague !== k))) return null
  return {
    v: VERSION_DU_DEPART,
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
      return Array.isArray(x.reponses) && x.reponses.length <= 20 && x.reponses.every(v => v === null || typeof v === 'boolean')
        ? { eclair: { reponses: [...(x.reponses as (boolean | null)[])] } }
        : undefined
    case 'filet':
      return fini(x.x) && parmi(x.taille, TAILLES_DU_FILET) ? { filet: { x: x.x, taille: x.taille } } : undefined
    case 'detail':
      return unIndex(x.titre) ? { detail: { titre: x.titre } } : undefined
    case 'frise':
      return Array.isArray(x.ordre) && x.ordre.length <= EVENEMENTS_D_UNE_FRISE_A_THEME && x.ordre.every(unIndex) && new Set(x.ordre).size === x.ordre.length
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
 * d'être jugé et écrit. `clore` ne se lit que d'un geste écrit par le serveur
 * (`duServeur`) : la page n'a pas à clore une partie.
 */
export function lireUnGeste(brut: unknown, o: { duServeur?: boolean } = {}): GesteDuCabinet | null {
  const g = json(brut)
  if (!objet(g) || !chaine(g.quoi)) return null
  if (g.quoi === 'quitter') return { quoi: 'quitter' }
  if (g.quoi === 'clore') return o.duServeur && g.pourquoi === 'lendemain' ? { quoi: 'clore', pourquoi: 'lendemain' } : null
  const { manche } = g
  if (!estUneManche(manche)) return null
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
      return chaine(g.lettres) && g.lettres.length <= SIGNES_D_UN_GESTE_MAX && /^[A-Z]+$/.test(g.lettres) ? { quoi: 'essai', manche, lettres: g.lettres } : null
    case 'nom':
      return chaine(g.texte) ? { quoi: 'nom', manche, texte: tronquer(g.texte, SIGNES_D_UN_GESTE_MAX) } : null
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

/** Les versions de bilan que ce code relit. */
export const VERSIONS_DU_BILAN_LUES: readonly number[] = [VERSION_DU_BILAN]

/** Les étoiles d'une manche après les pouvoirs : au plus trois, ou trois et la plus forte mise. */
const ETOILES_MAX_D_UNE_MANCHE = ETOILES_PAR_MANCHE + Math.max(...Object.values(BONUS_DE_MISE))

/** Le bilan figé d'une partie finie ; null : illisible, ou d'une version que ce code ne lit pas. */
export function lireLeBilan(brut: unknown): BilanDUnePartie | null {
  const b = json(brut)
  if (!objet(b) || !VERSIONS_DU_BILAN_LUES.includes(b.v as number)) return null
  const troisEntiers = (x: unknown, max: number): x is [number, number, number] => Array.isArray(x) && x.length === MANCHES_PAR_PARTIE && x.every(n => entier(n, 0, max))
  const { etoiles, naturel, aidee, total, quittee, lendemain, issue, poussiere, oeuvre, cartel } = b
  if (!troisEntiers(etoiles, ETOILES_MAX_D_UNE_MANCHE) || !troisEntiers(naturel, ETOILES_PAR_MANCHE) || typeof aidee !== 'boolean' || !entier(total, 0, ETOILES_D_UNE_PARTIE)) return null
  if (!(quittee === undefined || quittee === true) || !(lendemain === undefined || lendemain === true) || !parmi(issue, ISSUES) || !entier(poussiere, 0, Number.MAX_SAFE_INTEGER)) return null
  if (!(oeuvre === undefined || estUneOeuvre(oeuvre)) || !(cartel === null || estUneManche(cartel))) return null
  return {
    v: VERSION_DU_BILAN,
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
