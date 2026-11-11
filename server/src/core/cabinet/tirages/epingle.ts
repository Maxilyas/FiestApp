// Le tireur de l'Épingle : trois lieux d'un même thème (`server/content/cabinet/lieux.json`,
// dix thèmes de neuf lieux) — « 1429 · Les grands sièges » se lit comme un fil,
// d'une manche à l'autre —, et ses rechanges d'un autre thème : Changer ôte
// un lieu qu'il ne situe pas, et un voisin du même fil lui aurait demandé ce
// qu'il ignore déjà. Le thème se fige au départ avec le plan
// (`DepartDUnePartie.theme`, `themeDuPlan`).
//
// Le thème est le moins vu : celui dont les trois lieux les moins vus sont
// hors des sept jours (`JOURS_SANS_REDITE`) d'abord, puis jamais vus, puis
// celui qu'il a visité le plus anciennement — deux parties d'un même thème ne
// s'enchaînent pas tant qu'un autre attend —, le hasard du serveur entre les
// égaux. Dans son thème, ses trois lieux les moins vus (`laMoinsVue`) : un
// lieu se compte vu par son identifiant au journal (`cab:lieu:<id>`), d'un jeu
// à l'autre. Dix thèmes de neuf, trois parties par jour au même jeu au pire :
// sept jours sans un lieu revu (`cabinet-contenu.test.ts`).
//
// Chaque lieu tiré emporte le décalage de sa zone d'Éclairer, du hasard du
// tireur (`epingleTiree`) — celui du serveur, jamais la graine de la partie :
// qui saurait le décalage remonterait du centre de la zone au lieu.
//
// Et ses deux indices (le 11 novembre 2026), figés avec lui : sa piste, écrite
// avec le lieu, puis son repère, calculé ici (`indicesDuLieu`).
import { laMoinsVue, passeAvant } from '../../tirageALaPiece'
import { contenuDuCabinet, ecritDans } from '../contenu'
import { MANCHES_PAR_PARTIE } from '../../../../../shared/cabinet/bareme'
import type { Lieu } from '../../../../../shared/cabinet/contenu'
import { epingleTiree, type EpingleTiree } from '../../../../../shared/cabinet/jeux/epingle'
import { battre } from '../../../../../shared/cabinet/jeux/outils'
import { idDuLieu } from '../../../../../shared/cabinet/pieces'
import { faconsDeDireCePoint } from '../../../../../shared/cabinet/villesReperes'
import { FENETRE_DU_CABINET_MS, type ContexteDuTirage } from './communs'

/** Jamais vu : avant toute vue, dans un rang qui se lit du plus petit au plus grand. */
const JAMAIS = Number.NEGATIVE_INFINITY

/**
 * Le repère d'un lieu, son second indice : où il est, dit par une ville de la
 * carte — « À 260 km au sud-est de Paris. » —, dans les mots mêmes où la page
 * dit où est l'épingle : il n'y a plus qu'à mener l'une sur l'autre, et la
 * manche vaut alors son étoile presque à coup sûr. Calculé de ses coordonnées,
 * jamais écrit : un rédacteur qui se trompe d'une direction envoie le joueur à
 * l'autre bout de la carte. La première façon de le dire qui n'écrit ni sa
 * commune ni son département (invariant 1) : un lieu de Lyon ne se dit pas
 * « près de Lyon », ni un lieu du Nord « au nord » de quoi que ce soit — il se
 * dit alors par ses distances à deux villes, sans direction. Null : aucune ne
 * passe, et le lieu n'a que sa piste.
 */
export function repereDuLieu(l: Lieu): string | null {
  const dit = faconsDeDireCePoint(l).find(f => !ecritDans(f, l.commune) && !ecritDans(f, l.departement))
  return dit === undefined ? null : `${dit}.`
}

/** Les indices d'un lieu, du plus large au plus précis : sa piste, puis son repère ; aucun pour un lieu sans piste. */
export function indicesDuLieu(l: Lieu): string[] {
  if (!l.piste) return []
  const repere = repereDuLieu(l)
  return repere === null ? [l.piste] : [l.piste, repere]
}

/**
 * Le rang d'un thème, à lire de gauche à droite, le plus petit d'abord : ses
 * trois lieux les moins vus — combien l'ont été ces sept jours, puis combien
 * l'ont été tout court —, puis sa dernière visite. Un thème qui a de quoi
 * passe devant une révision, et la révision devant une redite.
 */
function rangDuTheme(ctx: ContexteDuTirage, lieux: readonly Lieu[]): number[] {
  const vues = lieux.map(l => ctx.vues.get(idDuLieu(l.id)) ?? JAMAIS).sort((a, b) => a - b)
  const siens = vues.slice(0, MANCHES_PAR_PARTIE)
  return [siens.filter(le => ctx.maintenant - le < FENETRE_DU_CABINET_MS).length, siens.filter(le => le !== JAMAIS).length, vues[vues.length - 1]]
}

/** Les thèmes du contenu livré qui font une partie, chacun ses lieux. */
function themesDe(lieux: readonly Lieu[]): Lieu[][] {
  const parTheme = new Map<string, Lieu[]>()
  for (const l of lieux) parTheme.set(l.theme, [...(parTheme.get(l.theme) ?? []), l])
  return [...parTheme.values()].filter(t => t.length >= MANCHES_PAR_PARTIE)
}

/**
 * Le plan d'une partie de l'Épingle : ses trois manches d'un même thème, puis
 * jusqu'à `rechanges` lieux d'autres thèmes ; null sans thème qui fasse une
 * partie. Jamais deux fois le même lieu, rechanges comprises.
 */
export function tirerUneEpingle(ctx: ContexteDuTirage, rechanges: number): EpingleTiree[] | null {
  const lieux = contenuDuCabinet().lieux
  let theme: Lieu[] | null = null
  let sonRang: number[] | null = null
  // Battus d'abord : à rang égal, le premier venu est celui du hasard du serveur.
  for (const t of battre(themesDe(lieux), ctx.hasard)) {
    const r = rangDuTheme(ctx, t)
    if (!sonRang || passeAvant(r, sonRang)) [theme, sonRang] = [t, r]
  }
  // Le thème qu'une épreuve de traversée a promis sur sa carte passe devant le moins vu, s'il a ses trois lieux.
  const promis = ctx.vise?.theme ? themesDe(lieux).find(t => t[0].theme === ctx.vise?.theme && t.length >= MANCHES_PAR_PARTIE) : undefined
  if (promis) theme = promis
  if (!theme) return null
  const nom = theme[0].theme
  const posees = new Set<string>()
  const prendre = (parmi: readonly Lieu[]): EpingleTiree | null => {
    const l = laMoinsVue(
      parmi.filter(x => !posees.has(x.id)),
      x => idDuLieu(x.id),
      ctx.vues,
    )
    if (!l) return null
    posees.add(l.id)
    return epingleTiree(l, ctx.hasard, indicesDuLieu(l))
  }
  const plan: EpingleTiree[] = []
  for (let k = 0; k < MANCHES_PAR_PARTIE; k++) plan.push(prendre(theme)!)
  const ailleurs = lieux.filter(l => l.theme !== nom)
  for (let k = 0; k < rechanges; k++) {
    const t = prendre(ailleurs)
    if (!t) break
    plan.push(t)
  }
  return plan
}
