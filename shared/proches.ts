// Les objectifs les plus proches d'un profil, pour sa page : les légendaires
// qu'il n'a pas encore, et le palier suivant de chaque haut fait de carrière,
// rangés par ce qui manque.
//
// La fin de soirée dit ce qui a avancé ce soir (« Tu t'en approches »,
// `server/src/core/objectifs.ts`) ; la page du profil dit tout ce qu'il a
// déjà commencé — de quoi savoir quoi chasser à la prochaine soirée. Une
// dérivation pure de ce que le profil reçoit déjà : rien ne s'y calcule au
// serveur, et rien ne s'écrit.

import { HAUTS_FAITS_DE_CARRIERE, clePalier, hautFait, type HautFaitVu } from './hautsfaits'
import { LEGENDAIRES } from './legendaires'

/** Un objectif commencé : un légendaire (`lg:…`) ou un palier de carrière (`hf:…:2`), et où il en est. */
export interface Proche {
  key: string
  acquis: number
  requis: number
  /** Le haut fait que la jauge compte, pour un légendaire à deux voies : celle où il en est le plus loin. */
  hautFait?: string
}

/**
 * Les paliers que la page dit déjà autrement : La Légende suit le niveau,
 * que sa barre montre ; les Éclats se tirent, ils ne se chassent pas.
 */
const DEJA_DITS = new Set(['hf:legende', 'hf:eclats'])

/**
 * Ce qu'un profil a rangé, reconstitué depuis le catalogue qu'il voit :
 * chaque haut fait de soirée et le nombre de fois, chaque palier atteint.
 */
export function recompensesDe(hautsFaits: readonly HautFaitVu[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const h of hautsFaits) {
    if (h.famille === 'soiree') {
      if (h.fois > 0) m.set(h.key, h.fois)
    } else {
      for (let p = 1; p <= h.fois; p++) m.set(clePalier(h.key, p), 1)
    }
  }
  return m
}

/**
 * Les `n` objectifs les plus avancés — seulement ceux qu'il a commencés :
 * « 0 sur 10 » ne s'approche de rien. À égalité, le légendaire d'abord :
 * c'est lui qu'on chasse. Un légendaire qui se gagne par un palier (le
 * Renard, L'Habitué · Argent) le représente : le palier ne se montre pas une
 * seconde fois.
 */
export function lesPlusProches(hautsFaits: readonly HautFaitVu[], legendaires: readonly string[], n = 3): Proche[] {
  const recompenses = recompensesDe(hautsFaits)
  const valeur = new Map(hautsFaits.filter(h => h.famille === 'carriere').map(h => [h.key, h.valeur ?? 0]))
  const candidats: (Proche & { legendaire: boolean })[] = []
  const representes = new Set<string>()
  for (const l of LEGENDAIRES) {
    if (legendaires.includes(l.key)) continue
    // Une voie, ou deux (le Sphinx) : la plus avancée le représente, et
    // chacun de ses paliers ne se montre plus à part.
    let meilleure: (Proche & { legendaire: boolean }) | null = null
    for (const c of l.aussi ? [l.condition, l.aussi] : [l.condition]) {
      let voie: { acquis: number; requis: number } | null = null
      if ('fois' in c) {
        voie = { acquis: Math.min(c.fois, recompenses.get(c.hautFait) ?? 0), requis: c.fois }
      } else {
        const h = hautFait(c.hautFait)
        if (h?.famille !== 'carriere') continue
        representes.add(clePalier(h.key, c.palier))
        voie = { acquis: valeur.get(h.key) ?? 0, requis: h.paliers[c.palier - 1] }
      }
      if (voie.acquis <= 0 || voie.acquis >= voie.requis) continue
      if (meilleure && voie.acquis / voie.requis <= meilleure.acquis / meilleure.requis) continue
      meilleure = { key: l.key, ...voie, legendaire: true, ...(l.aussi && { hautFait: c.hautFait }) }
    }
    if (meilleure) candidats.push(meilleure)
  }
  for (const h of HAUTS_FAITS_DE_CARRIERE) {
    if (DEJA_DITS.has(h.key)) continue
    const palier = [1, 2, 3].find(p => !recompenses.has(clePalier(h.key, p)))
    if (!palier || representes.has(clePalier(h.key, palier))) continue
    const [acquis, requis] = [valeur.get(h.key) ?? 0, h.paliers[palier - 1]]
    if (acquis > 0 && acquis < requis) candidats.push({ key: clePalier(h.key, palier), acquis, requis, legendaire: false })
  }
  return candidats
    .sort(
      (a, b) =>
        b.acquis / b.requis - a.acquis / a.requis || Number(b.legendaire) - Number(a.legendaire) || a.key.localeCompare(b.key),
    )
    .slice(0, n)
    .map(({ legendaire: _, ...proche }) => proche)
}
