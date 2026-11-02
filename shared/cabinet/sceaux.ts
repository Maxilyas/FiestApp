// Ce que les défis de tes cartes et les épreuves de maître laissent sur le
// profil, lu sans la traversée : leurs clés sur l'étagère, leurs noms, et ce
// qu'ils rapportent (`shared/cabinet/defis.ts` dit comment ils se gagnent).
// Léger exprès : le solde des confettis (`ProfileStore.boutiqueEtDons`), les
// titres (`nomDuTitre`, `shared/sentiers.ts`), la loge et les gerbes le
// lisent, et rien de la traversée — ni la carte, ni le pli — n'a à descendre
// avec eux. Il n'importe que le barème (`bareme.ts`, qui n'importe que des
// types) et des types.
//
// Un sceau se range sous `#cabinet`, comme un gardien réveillé et le légendaire
// choisi au bout d'une traversée, et sous le préfixe des voies du Cabinet
// (`cabinet:`) : l'étagère et le compte des badges l'écartent d'office
// (`PREFIXES_DES_VOIES_RANGEES`) — ce n'est pas un trophée de soirée —, et la
// ligne ne se reprend jamais (invariant 22).

import { ACTES_DES_RANGS, ACTES_D_UNE_TRAVERSEE, ARGENTS_POUR_LA_GERBE, CONFETTIS_D_UN_RANG, MISES_DU_FLAMBEUR, ORS_POUR_LE_LEGENDAIRE, OR_DU_TRESORIER, OR_D_UNE_MAITRISE } from './bareme'
import type { CleDeCarte } from './traversee'

/** Un rang : 1 le Bronze, 2 l'Argent, 3 l'Or. */
export type RangDUnDefi = 1 | 2 | 3
export const RANGS: readonly RangDUnDefi[] = [1, 2, 3]
/** Le nom d'un rang, à l'écran — les mots des récompenses : Bronze · Argent · Or, et rien d'autre. */
export const RANGS_DITS: Readonly<Record<RangDUnDefi, string>> = { 1: 'Bronze', 2: 'Argent', 3: 'Or' }

/**
 * Le nom du défi de chaque carte, que l'Or fait porter comme un titre : écrit ici, une seule fois, dans l'ordre
 * des cartes (`CARTES`, `traversee.ts` — `cabinet-defis.test.ts` les compare).
 */
export const NOMS_DES_DEFIS: Readonly<Record<CleDeCarte, string>> = {
  'coup-d-oeil': 'L’Œil nu',
  echange: 'L’Obstiné',
  'quitte-ou-double': 'Le Flambeur',
  concentration: 'Le Sang-Froid',
  parade: 'Sans filet',
  cagnotte: 'Le Trésorier',
  panacee: 'L’Increvable',
  pourboire: 'L’Avare',
  'coup-de-grace': 'L’Exécuteur',
  'second-souffle': 'Le Revenant',
}
const CARTES_DES_DEFIS = Object.keys(NOMS_DES_DEFIS) as CleDeCarte[]

/**
 * Le nom de chaque carte, lu sans la traversée : l'album des trophées dit au dos de laquelle est chaque défi
 * (`CARTES`, `traversee.ts` — `cabinet-defis.test.ts` les compare).
 */
export const NOMS_DES_CARTES: Readonly<Record<CleDeCarte, string>> = {
  'coup-d-oeil': 'Coup d’œil',
  echange: 'Échange',
  'quitte-ou-double': 'Quitte ou double',
  concentration: 'Concentration',
  parade: 'Parade',
  cagnotte: 'Cagnotte',
  panacee: 'Panacée',
  pourboire: 'Pourboire',
  'coup-de-grace': 'Coup de grâce',
  'second-souffle': 'Second souffle',
}

// ── Ce que chaque rang demande, en mots ───────────────────────────────────
// Composé des chiffres du barème : la règle qui juge chaque rang vit dans `defis.ts` (`DEFIS`), qui lit ses phrases
// ici — l'album des trophées les dit sans tirer la traversée.

const FINIS_DITS = ['Un acte fini', 'Deux actes finis'] as const
const NOMBRES_DITS = ['Zéro', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf', 'Dix'] as const
const nombreDit = (n: number) => NOMBRES_DITS[n] ?? String(n)
const actesFinis = (n: number) => (n >= ACTES_D_UNE_TRAVERSEE ? 'La traversée gagnée' : (FINIS_DITS[n - 1] ?? `${n} actes finis`))
/** Les rangs d'un défi « sans » : un, deux, puis trois actes finis sans que ceci ait servi. */
const phrasesSans = (fin: string): readonly [string, string, string] => [`${actesFinis(ACTES_DES_RANGS[0])} ${fin}`, `${actesFinis(ACTES_DES_RANGS[1])} ${fin}`, `${actesFinis(ACTES_DES_RANGS[2])} ${fin}`]

/** Chaque rang de chaque défi en une phrase, Bronze, Argent, Or. */
export const PHRASES_DES_DEFIS: Readonly<Record<CleDeCarte, readonly [string, string, string]>> = {
  'coup-d-oeil': phrasesSans('sans un Coup d’œil'),
  echange: phrasesSans('sans un Échange'),
  'quitte-ou-double': [
    `${nombreDit(MISES_DU_FLAMBEUR.gagnees)} mises gagnées dans une traversée`,
    `${nombreDit(MISES_DU_FLAMBEUR.daffilee[0])} mises gagnées d’affilée`,
    `${nombreDit(MISES_DU_FLAMBEUR.daffilee[1])} mises gagnées d’affilée`,
  ],
  concentration: phrasesSans('sans puiser dans le temps en plus'),
  parade: phrasesSans('sans qu’une Parade serve'),
  cagnotte: [
    `${OR_DU_TRESORIER[0]} pièces en poche à la chute d’un gardien`,
    `${OR_DU_TRESORIER[1]} pièces en poche à la chute d’un gardien`,
    `${OR_DU_TRESORIER[2]} pièces en poche à la chute du dernier`,
  ],
  panacee: phrasesSans('sans perdre un cœur'),
  pourboire: phrasesSans('sans rien acheter'),
  // Un gardien de l'acte I tombe presque toujours au premier assaut — six fois sur sept chez le joueur moyen du
  // calibrage — : le Bronze demande de l'abattre dès la deuxième manche ; ceux des actes II et III, eux, ont plus de
  // points de vie qu'un assaut n'a d'étoiles, sans mise ni Coup de grâce ++.
  'coup-de-grace': ['Un gardien abattu dès la deuxième manche de ton premier assaut', 'Un gardien de l’acte II ou III vaincu au premier assaut', 'Le gardien de l’acte III vaincu au premier assaut'],
  'second-souffle': ['Ton Second souffle sert, et tu finis l’acte quand même', 'La traversée gagnée après ton Second souffle', 'Ton Second souffle sert avant l’acte III, et la traversée est gagnée'],
}

// ── Les épreuves de maître, en mots ───────────────────────────────────────

/** Ce qu'une épreuve de maître demande : la règle de chacune vit dans `defis.ts` (`CONDITIONS_DE_MAITRISE`). */
export type SorteDeMaitrise = 'unSeulAssaut' | 'sansFaute' | 'sansPerdreUnCoeur' | 'toutesLesEtoiles' | 'surUneMise' | 'dEntree' | 'orEnPoche' | 'apresUnCoeurPerdu' | 'apresLeSouffle'

const DITS_DES_MAITRISES: Readonly<Record<Exclude<SorteDeMaitrise, 'orEnPoche'>, string>> = {
  unSeulAssaut: 'au premier assaut',
  sansFaute: 'sans rater une manche contre lui',
  sansPerdreUnCoeur: 'sans perdre un cœur contre lui',
  toutesLesEtoiles: 'avec trois étoiles à chaque manche contre lui',
  surUneMise: 'd’un coup porté sur une mise',
  dEntree: 'dès la deuxième manche de ton premier assaut',
  apresUnCoeurPerdu: 'dans l’assaut même où tu perds un cœur',
  apresLeSouffle: 'après que ton Second souffle t’a relevé contre lui',
}

const COURTS_DES_MAITRISES: Readonly<Record<Exclude<SorteDeMaitrise, 'orEnPoche'>, string>> = {
  unSeulAssaut: 'Au premier assaut',
  sansFaute: 'Sans rater une manche',
  sansPerdreUnCoeur: 'Sans perdre un cœur',
  toutesLesEtoiles: '★★★ à chaque manche',
  surUneMise: 'Sur une mise',
  dEntree: 'En deux manches',
  apresUnCoeurPerdu: 'Après un cœur perdu',
  apresLeSouffle: 'Après le Second souffle',
}

/** Un acte de la traversée : 0, 1, 2. */
type ActeDuGardien = 0 | 1 | 2

/**
 * L'épreuve de maître de chaque gardien de la traversée, et l'acte où il se rencontre, dans l'ordre des actes — celui
 * de leurs cercles (`GARDIENS_DES_ACTES`, `traversee.ts`, la Citrouille à l'acte I : `cabinet-defis.test.ts` les
 * compare). Chacune dans l'esprit de sa devise : le Dragon garde son or, le Phénix renaît de ses cendres, la Comète ne
 * passe qu'une fois. On la lit dès l'écran des trois gardiens, avant de choisir ses cartes : certaines s'y préparent
 * — sur une mise, après le Second souffle.
 */
export const MAITRISES: ReadonlyMap<string, { acte: ActeDuGardien; sorte: SorteDeMaitrise }> = new Map(
  (
    [
      // L'acte I : des gardiens doux — au calibrage, le joueur moyen qui les vainc les maîtrise une fois sur cinq à peu près.
      [0, { 'lg:renard': 'toutesLesEtoiles', 'lg:coq': 'dEntree', 'lg:chouette': 'toutesLesEtoiles', 'lg:tigre': 'dEntree', 'lg:chauve-souris': 'apresUnCoeurPerdu', 'lg:scarabee': 'orEnPoche', 'lg:citrouille': 'surUneMise' }],
      // L'acte II : une fois sur cinq à dix ; le Lion, roi de sa carte, une fois sur vingt-cinq.
      [1, { 'lg:sphinx': 'sansFaute', 'lg:janus': 'surUneMise', 'lg:phenix': 'apresUnCoeurPerdu', 'lg:fantome': 'sansPerdreUnCoeur', 'lg:salamandre': 'orEnPoche', 'lg:lion': 'unSeulAssaut', 'lg:oracle': 'sansFaute', 'lg:serpent': 'sansPerdreUnCoeur' }],
      // L'acte III : une fois sur dix à quatre ; la Comète, qui ne passe qu'une fois, presque jamais.
      [2, { 'lg:dragon': 'orEnPoche', 'lg:kraken': 'apresLeSouffle', 'lg:chimere': 'sansFaute', 'lg:ouroboros': 'apresUnCoeurPerdu', 'lg:trou-noir': 'sansPerdreUnCoeur', 'lg:comete': 'unSeulAssaut' }],
    ] as const satisfies readonly (readonly [ActeDuGardien, Readonly<Record<string, SorteDeMaitrise>>])[]
  ).flatMap(([acte, gardiens]) => Object.entries(gardiens).map(([gardien, sorte]) => [gardien, { acte, sorte }] as const)),
)

/** Son épreuve, par la clé du gardien — une `Map`, jamais `TABLE[cle]`. */
const maitriseDe = (gardien: unknown) => (typeof gardien === 'string' ? MAITRISES.get(gardien) : undefined)

/** L'épreuve de maître d'un gardien, en une phrase — « Le vaincre avec 300 pièces en poche » ; null : pas un gardien de la traversée. */
export function maitriseDite(gardien: unknown): string | null {
  const m = maitriseDe(gardien)
  if (!m) return null
  return `Le vaincre ${m.sorte === 'orEnPoche' ? `avec ${OR_D_UNE_MAITRISE[m.acte]} pièces en poche` : DITS_DES_MAITRISES[m.sorte]}`
}

/**
 * La même, en quelques mots, sous le médaillon du gardien (« Sans perdre un cœur ») : l'écran des trois gardiens en
 * disait la phrase entière de chacun, trois phrases sous trois médaillons — « trop de texte, pas assez visuel et
 * sobre » (le propriétaire, le 1er novembre 2026). L'annonce du gardien la redit en entier (`maitriseDite`).
 */
export function maitriseCourte(gardien: unknown): string | null {
  const m = maitriseDe(gardien)
  if (!m) return null
  return m.sorte === 'orEnPoche' ? `${OR_D_UNE_MAITRISE[m.acte]} pièces en poche` : COURTS_DES_MAITRISES[m.sorte]
}
const estUneCarte = (x: string): x is CleDeCarte => (CARTES_DES_DEFIS as readonly string[]).includes(x)

/** Les préfixes de ce qui se range : un rang d'un défi (`cabinet:defi:cagnotte:2`), une épreuve de maître (`cabinet:maitrise:dragon`). */
export const PREFIXE_DES_DEFIS = 'cabinet:defi:'
export const PREFIXE_DES_MAITRISES = 'cabinet:maitrise:'
export const cleDuRang = (carte: CleDeCarte, rang: RangDUnDefi): string => `${PREFIXE_DES_DEFIS}${carte}:${rang}`
export const cleDeLaMaitrise = (gardien: string): string => `${PREFIXE_DES_MAITRISES}${gardien.replace(/^lg:/, '')}`

/** Un rang lu d'une clé : sa carte et son rang ; null : une autre clé, ou une clé abîmée. */
export function rangDeLaCle(cle: string): { carte: CleDeCarte; rang: RangDUnDefi } | null {
  if (!cle.startsWith(PREFIXE_DES_DEFIS)) return null
  const [carte, rang, ...reste] = cle.slice(PREFIXE_DES_DEFIS.length).split(':')
  const n = Number(rang)
  return reste.length === 0 && estUneCarte(carte) && (n === 1 || n === 2 || n === 3) ? { carte, rang: n } : null
}

/** Le gardien d'une épreuve de maître lue d'une clé (`lg:dragon`) ; null : une autre clé. */
export const gardienDeLaMaitrise = (cle: string): string | null => (cle.startsWith(PREFIXE_DES_MAITRISES) && cle.length > PREFIXE_DES_MAITRISES.length ? `lg:${cle.slice(PREFIXE_DES_MAITRISES.length)}` : null)

/** Ce qu'un profil tient : le rang de chaque carte (0 à 3), et les gardiens qu'il a vaincus en maître. */
export interface DefisTenus {
  rangs: Readonly<Record<CleDeCarte, 0 | RangDUnDefi>>
  maitrises: readonly string[]
}

/** Les défis qu'un profil tient, d'après les clés de son étagère — une clé inconnue ou abîmée se tait. */
export function defisTenus(cles: Iterable<string>): DefisTenus {
  const rangs = Object.fromEntries(CARTES_DES_DEFIS.map(c => [c, 0])) as Record<CleDeCarte, 0 | RangDUnDefi>
  const maitrises: string[] = []
  for (const cle of cles) {
    const r = rangDeLaCle(cle)
    if (r && r.rang > rangs[r.carte]) rangs[r.carte] = r.rang
    const g = gardienDeLaMaitrise(cle)
    if (g && !maitrises.includes(g)) maitrises.push(g)
  }
  return { rangs, maitrises }
}

/** Combien de défis il tient à ce rang au moins : les cinq Argent de la gerbe, les dix Or du légendaire. */
export const defisAuMoins = (t: Pick<DefisTenus, 'rangs'>, rang: RangDUnDefi): number => CARTES_DES_DEFIS.filter(c => t.rangs[c] >= rang).length

/**
 * Les confettis des défis : chaque rang tenu, une fois — le Bronze, puis l'Argent en plus (`CONFETTIS_D_UN_RANG`).
 * Relus à chaque lecture du solde, comme toute source (`boutiqueEtDons`) : un rang compte s'il est rangé, jamais
 * autant de fois que de lignes.
 */
export function confettisDesDefis(recompenses: ReadonlyMap<string, number>): number {
  let n = 0
  for (const [cle, fois] of recompenses) {
    const r = fois > 0 ? rangDeLaCle(cle) : null
    if (r) n += CONFETTIS_D_UN_RANG[r.rang - 1]
  }
  return n
}

/** Le titre qu'un défi tenu à l'Or fait porter — sa clé même : « Le Trésorier ». Null : pas un Or. */
export function nomDuTitreDuDefi(cle: string): string | null {
  const r = rangDeLaCle(cle)
  return r && r.rang === 3 ? NOMS_DES_DEFIS[r.carte] : null
}

/** Les titres qu'il peut porter, ses défis tenus à l'Or, dans l'ordre des cartes. */
export const titresDesDefis = (t: Pick<DefisTenus, 'rangs'>): string[] => CARTES_DES_DEFIS.filter(c => t.rangs[c] === 3).map(c => cleDuRang(c, 3))

/** La gerbe du Cabinet tombe-t-elle : assez de défis tenus à l'Argent. */
export const gerbeDesDefis = (t: Pick<DefisTenus, 'rangs'>): boolean => defisAuMoins(t, 2) >= ARGENTS_POUR_LA_GERBE
/** Le légendaire du Cabinet tombe-t-il : tous les défis tenus à l'Or. */
export const legendaireDesDefis = (t: Pick<DefisTenus, 'rangs'>): boolean => defisAuMoins(t, 3) >= ORS_POUR_LE_LEGENDAIRE
