// Les outils que partagent les neuf jeux du Cabinet : la lecture de ce que la
// page envoie, le hasard d'un tirage ou d'Éclairer, le refus d'Éclairer quand
// il ne reste rien à souffler, et la pièce qu'une manche laisse au journal des
// réponses — d'une question de la base (le Pari, l'Éclair, le Mot mystère, le
// Filet) ou du contenu neuf (l'Épingle, les Indices, la Réplique).
//
// Une seule copie. Les trois lots qui ont écrit les jeux en avaient chacun la
// leur, mot pour mot (`deLaBase.ts`, `aides.ts`, `duContenu.ts`) : trois
// copies d'une règle de lecture finissent par en dire trois — un `reponse`
// lu par le prototype d'un objet chez l'un, pas chez l'autre.
//
// Le contrat avec le pli (`pliDeLaPartie`, `shared/cabinet/partie.ts`), le
// même pour les neuf : `trancheLaManche` (`regle.ts`) dit d'abord où va un
// geste — à `juger`, qui rend le verdict, ou à `apresLeGeste`, qui rend l'état
// d'après ou son refus en mots. Un geste qui tranche ne passe jamais par
// `apresLeGeste` : s'il s'y perd, il s'y refuse (`GESTE_A_JUGER`) sans rien
// changer, plutôt que d'être compté deux fois. Et l'état reste celui d'avant
// le geste qui tranche : la révélation relit ce qu'il portait dans le verdict
// (`choix`, `composee`), que le journal garde aussi — une partie finie se
// révèle par le même chemin que la manche en cours (invariant 14).

import type { PieceDuCabinet } from '../pieces'
import { refusDuPouvoir } from '../pouvoirs'
import type { CleDeJeu, RegleDuJeu, VerdictDUneManche } from './regle'

// ── Ce qu'une manche tire ─────────────────────────────────────────────────

/**
 * Une question de la base telle que la partie l'a tirée au départ : le cœur
 * d'une question de série — ses réponses mélangées, sa bonne, son anecdote, sa
 * marche mesurée —, celui que la pièce garde au journal. Elle ne part jamais
 * entière au téléphone (invariant 1) : chaque jeu en montre ce qu'il veut.
 */
export type QuestionTiree = Omit<PieceDuCabinet, 'forme' | 'cabinet'>

/** Les trois jeux du contenu neuf, écrit pour le Cabinet (`shared/cabinet/contenu.ts`). */
export type JeuDuContenu = Extract<CleDeJeu, 'epingle' | 'indices' | 'replique'>

// ── Le verdict ────────────────────────────────────────────────────────────

/** Ce que rend `apresLeGeste` d'un geste qui tranche : il se juge, et rien ne change. Le pli ne l'y envoie pas. */
export const GESTE_A_JUGER = 'Ce geste se juge avec sa manche : recharge la page'

/** Ce qu'une `composee` écrit à la place d'une réponse qui n'est pas venue — comme une affirmation pas répondue à l'Éclair. */
export const SANS_REPONSE = '.'

/** Les étoiles naturelles d'un barème — un chiffre de `bareme.ts`, typé `number` — bornées à ce qu'une manche vaut. */
export function naturelDe(etoiles: number): VerdictDUneManche['naturel'] {
  return Math.max(0, Math.min(3, Math.round(etoiles))) as VerdictDUneManche['naturel']
}

/**
 * La colonne `choix` d'une pièce qui n'est pas un QCM : 0 juste, −1 fausse,
 * null quand rien n'a été répondu — il l'a vue, elle compte aux vues, sans
 * réponse. Une manche quittée l'écrit nulle, même avec ce qu'il avait fait
 * (le seul Pari gardé à part) ; une manche expirée garde ce qui était acquis
 * — le mot de la Réplique, les erreurs des Indices, les essais du Mot.
 */
export const choixDe = (repondue: boolean, juste: boolean): 0 | -1 | null => (!repondue ? null : juste ? 0 : -1)

// ── Le hasard ─────────────────────────────────────────────────────────────

/**
 * Un élément tiré du hasard qu'on lui donne. Celui d'Éclairer est rejoué de la
 * graine de la partie (`hasardDe`) : la même graine redonne le même —
 * recharger ne change ni la réponse effacée, ni la lettre soufflée —, et
 * cette graine est un secret du serveur, tirée au départ, que la page ne voit
 * jamais : qui la rejouerait saurait, de la mauvaise réponse effacée, où est
 * la bonne. Le dernier si le hasard rend 1, qu'un hasard d'essai peut rendre.
 */
export function auHasard<T>(liste: readonly T[], hasard: () => number): T {
  return liste[Math.min(liste.length - 1, Math.floor(hasard() * liste.length))]
}

/**
 * Fisher-Yates, sur le hasard qu'on lui donne : d'ordinaire celui du tireur,
 * au départ — la reprise relit le plan battu, elle ne rebat rien. Borné au
 * dernier si le hasard rend 1, qu'un hasard d'essai peut rendre.
 */
export function battre<T>(tas: readonly T[], hasard: () => number): T[] {
  const battu = [...tas]
  for (let i = battu.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(hasard() * (i + 1)))
    ;[battu[i], battu[j]] = [battu[j], battu[i]]
  }
  return battu
}

// ── Éclairer ──────────────────────────────────────────────────────────────

/**
 * Le refus d'Éclairer quand la manche n'a plus rien à souffler, dit par la
 * seule règle des pouvoirs (`refusDuPouvoir`) : ses comptes à zéro, il n'y
 * reste que `aEclairer: false`. Chaque jeu le rend d'abord, quelle que soit la
 * cible — d'où `eclairerSertEncore` : le pli sait s'il sert encore, et la page
 * grise sans rien recopier.
 */
export function rienAEclairer(jeu: CleDeJeu): string {
  const refus = refusDuPouvoir({ pouvoir: 'eclairer', force: 1, jeu, servi: 0, aEclairer: false })
  // Sans refus, le pli prendrait la réponse pour un état : une règle des pouvoirs changée doit se voir.
  if (refus === null) throw new TypeError('refusDuPouvoir ne refuse plus Éclairer quand il ne reste rien à éclairer')
  return refus
}

/**
 * Éclairer sert-il encore dans cette manche ? Ce que le pli pose dans
 * `UsageDUnPouvoir.aEclairer`. Le jeu le dit en refusant mot pour mot
 * `rienAEclairer` ; tout autre refus — « Choisis l'affirmation à éclairer » à
 * l'Éclair, appelé sans cible — laisse Éclairer jouable. Un essai pur, au
 * hasard nul : rien ne s'en garde.
 */
export function eclairerSertEncore<T, E>(r: Pick<RegleDuJeu<T, E, never, unknown, unknown>, 'cle' | 'eclairer'>, t: T, e: E): boolean {
  return r.eclairer(t, e, () => 0) !== rienAEclairer(r.cle)
}

// ── Ce que la page envoie ─────────────────────────────────────────────────

/**
 * La règle d'un jeu, et ce qui dit au pli si un geste tranche la manche,
 * quand `repondre` ne suffit pas à le dire : « Reculer » au Détail ne la
 * tranche pas, une réponse si ; un nom juste aux Indices, ou faux au dernier
 * indice ; « Qui l'a dit ? » à la seconde étape de la Réplique ; une épingle
 * plantée en France.
 */
export type RegleQuiTranche<Tiree, Etat, Geste, Montree, Revelee> = RegleDuJeu<Tiree, Etat, Geste, Montree, Revelee> & {
  tranche(t: Tiree, e: Etat, g: Geste): boolean
}

const estObjet = (x: unknown): x is Readonly<Record<string, unknown>> => typeof x === 'object' && x !== null && !Array.isArray(x)

/**
 * Le geste tel que la page l'envoie — `{ quoi: 'repondre', reponse: { pari: {
 * choix } } }`, `{ quoi: 'essai', lettres }`, `{ quoi: 'nom', texte }` —,
 * réduit à ses champs ; la manche et le rang, le pli les a déjà lus. Null : ce
 * n'est pas un geste.
 */
export function champsDuGeste(brut: unknown): (Readonly<Record<string, unknown>> & { quoi: string }) | null {
  return estObjet(brut) && typeof brut.quoi === 'string' ? (brut as Readonly<Record<string, unknown>> & { quoi: string }) : null
}

/**
 * Ce qu'un `repondre` porte, rangé sous la clé de son jeu (`reponse.filet`).
 * Undefined : rien n'est parti — la page envoie d'elle-même à l'échéance ce
 * qu'elle a sous les yeux, et parfois rien ; null : illisible, ou d'un autre jeu.
 */
export function reponseEnvoyee(g: Readonly<Record<string, unknown>>, jeu: CleDeJeu): Readonly<Record<string, unknown>> | null | undefined {
  if (g.reponse === undefined || g.reponse === null) return undefined
  if (!estObjet(g.reponse)) return null
  // Sa propre clé seulement : un objet répond aussi de son prototype.
  const siens = Object.hasOwn(g.reponse, jeu) ? g.reponse[jeu] : undefined
  return estObjet(siens) ? siens : null
}

/** Un index que la page envoie : un entier parmi tant de propositions. */
export const estUnIndex = (x: unknown, propositions: number): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) < propositions

// ── La pièce ──────────────────────────────────────────────────────────────

/**
 * La pièce d'une question de la base, telle que la partie l'a tirée : ses
 * réponses copiées — le plan figé du départ ne bouge pas avec elle —, sa forme
 * si elle en a une. Sans forme, la ligne est nue : elle mesure (seul le Pari
 * en écrit, sur sa première question).
 */
export function pieceDeLaQuestion(q: QuestionTiree, cabinet: PieceDuCabinet['cabinet'], forme?: string): PieceDuCabinet {
  return { ...q, reponses: [...q.reponses], ...(forme !== undefined && { forme }), cabinet: { ...cabinet } }
}

/** Ce que la pièce d'un contenu neuf dit d'elle : ce qu'elle demandait, sa réponse en clair, d'où vient sa catégorie. */
export interface ContenuDUnePiece {
  /** L'identifiant préfixé (`idDuLieu`, `idDeLaFiche`, `idDeLaReplique`) : hors de la base, ni carnet, ni signalement, ni mesure. */
  id: string
  texte: string
  /** La réponse dite (« Orléans (Loiret), 1429 ») : le cartel et « Mes réponses » la relisent. */
  reponse: string
  categorie: string
  /** « Le savais-tu ? » du contenu. */
  anecdote: string | null
}

/**
 * La pièce d'un contenu neuf, telle que `campagne_series.questions` la garde à
 * la position de sa réponse : la réponse dite pour seule réponse, et la marche
 * `moyen` — un contenu neuf n'a pas de marche mesurée. Elle porte toujours la
 * forme de son jeu : jamais nue, elle ne compte ni à la mesure ni à L'Érudit.
 */
export function pieceDuContenu(c: ContenuDUnePiece, jeu: JeuDuContenu, i: { manche: 0 | 1 | 2; tirage: number }): PieceDuCabinet {
  return {
    id: c.id,
    texte: c.texte,
    reponses: [c.reponse],
    bonne: 0,
    categorie: c.categorie,
    anecdote: c.anecdote,
    niveau: 'moyen',
    forme: jeu,
    cabinet: { jeu, manche: i.manche, tirage: i.tirage },
  }
}
