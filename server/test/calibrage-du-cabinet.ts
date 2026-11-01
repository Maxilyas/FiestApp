// Le calibrage du Cabinet de curiosités (`scripts/calibrage-cabinet.ts`), tel
// que ses épreuves le lancent et le lisent : `cabinet-calibrage.test.ts` (ce
// qu'il joue du code) et le modèle corrigé après la tablée du 25 octobre 2026 —
// ce que le joueur sait (`cabinet-calibrage-modele.test.ts`), ses cartes-bonus
// (`cabinet-calibrage-cartes.test.ts`), ses parties et le musée
// (`cabinet-calibrage-parties.test.ts`). Chaque épreuve lance un calibrage à
// part, du calcul pur : un seul fichier d'épreuves en durait plus d'une minute,
// puis le modèle 117 s à huit fichiers à la fois (le 1er novembre 2026). Coupés
// sur leurs thèmes, ils tiennent chacun loin des deux minutes qu'un fichier a
// (règle `tests.md`).
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lireNombre } from '../../shared/nombres'

export const SERVEUR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const SCRIPT = 'scripts/calibrage-cabinet.ts'
export const SOURCE = readFileSync(path.join(SERVEUR, SCRIPT), 'utf8')
/** Le code sans ses commentaires : l'exemple d'un essai (`ERREURS_DE_LA_FRISE=0/1/2`) ne déclare rien. */
export const sansCommentaires = (texte: string) => texte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

export type Lancement = { code: number | null; sortie: string; erreurs: string }
/** Le script, lancé comme on le lance. */
export function calibrer(args: string[]): Promise<Lancement> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ['--import', 'tsx', SCRIPT, ...args], { cwd: SERVEUR, stdio: ['ignore', 'pipe', 'pipe'] })
    let sortie = ''
    let erreurs = ''
    proc.stdout.on('data', d => (sortie += d))
    proc.stderr.on('data', d => (erreurs += d))
    proc.on('error', reject)
    proc.on('close', code => resolve({ code, sortie, erreurs }))
  })
}

/** Les cases d'une ligne de tableau : le script sépare ses colonnes de deux blancs au moins, et n'en met qu'un dans une case. */
export const cases = (ligne: string) => ligne.trim().split(/\s{2,}/)

/** La part des parties à une commune, au hasard, jeu par jeu : la ligne que le calibrage en écrit. */
export function auHasard(sortie: string): Map<string, number> {
  const ligne = sortie.split('\n').find(l => l.includes('Au hasard, une commune'))
  assert.ok(ligne, `pas de ligne « Au hasard » :\n${sortie}`)
  const parts = ligne.slice(ligne.indexOf(' : ') + 3).split(' · ')
  return new Map(
    parts.map(p => {
      const m = /^(.+) (\S+) %$/.exec(p.trim())
      assert.ok(m, `« ${p} » ne se lit pas`)
      return [m[1], lireNombre(m[2])! / 100]
    }),
  )
}

/** La ligne d'un jeu, pour un joueur, au tableau des jeux un à un : ses parts, ses étoiles en moyenne, ses justes… */
export function ligneDuJeu(sortie: string, jeu: string, joueur: string): string[] {
  const ligne = sortie.split('\n').map(cases).find(c => c[0] === jeu && c[1] === joueur)
  assert.ok(ligne, `pas de ligne pour ${jeu} et ${joueur} :\n${sortie}`)
  return ligne
}

/** Les jeux qui se jouent autrement vers chaque seuil, que la sortie nomme : « Le Détail, Le Filet et Le Pari ». */
export function jeuxQuiVisent(sortie: string): string[] {
  const visent = /chacune jouée vers ce seuil — (.+) s'y jouent autrement/.exec(sortie)
  assert.ok(visent, `les jeux qui visent le seuil :\n${sortie}`)
  return visent[1].split(/, | et /)
}

/** Les lignes d'une section, de son titre à la ligne vide qui la clôt. */
export function sectionDe(sortie: string, titre: string): string[] {
  const toutes = sortie.split('\n')
  const debut = toutes.findIndex(l => l.startsWith(titre))
  assert.ok(debut >= 0, `pas de section « ${titre} » :\n${sortie}`)
  const fin = toutes.findIndex((l, i) => i > debut && l.trim() === '')
  return toutes.slice(debut + 1, fin < 0 ? undefined : fin)
}

/** Une part écrite en pour cent par le calibrage (« 25,3 % », « 25 »), en fraction. */
export const enFraction = (texte: string) => {
  const n = lireNombre(texte.replace('%', '').trim())
  assert.ok(n !== null, `« ${texte} » n'est pas une part`)
  return n / 100
}

/**
 * Une case du tableau des cartes-bonus : au seuil dit, pour ce jeu et ce
 * joueur, la part sans carte (`null`) ou celle d'un pouvoir à une force — ses
 * trois forces s'écrivent dans une même case, « 1 · 2 · 3 ».
 */
export function partAvecLaCarte(sortie: string, seuil: number, jeu: string, joueur: string, pouvoir: string | null, force?: 1 | 2 | 3): number {
  const lignes = sectionDe(sortie, 'Les cartes-bonus, jeu par jeu')
  const debut = lignes.findIndex(l => l.trim().startsWith(`au moins ${seuil} étoiles`))
  assert.ok(debut >= 0, `pas de tableau à ${seuil} étoiles :\n${lignes.join('\n')}`)
  const entete = cases(lignes[debut + 1])
  const ligne = lignes
    .slice(debut + 2)
    .map(cases)
    .find(c => c[0] === jeu && c[1] === joueur)
  assert.ok(ligne, `pas de ligne pour ${jeu} et ${joueur} à ${seuil} étoiles :\n${lignes.join('\n')}`)
  const k = entete.indexOf(pouvoir ?? 'sans carte')
  assert.ok(k > 1, `pas de colonne ${pouvoir ?? 'sans carte'} : ${entete.join(' | ')}`)
  return enFraction(pouvoir === null ? ligne[k] : ligne[k].split(' · ')[force! - 1])
}

/** Les lignes des confettis à la minute, joueur par joueur : de l'en-tête du tableau à l'expérience. */
export function lignesDesConfettis(sortie: string): string[] {
  const toutes = sortie.split('\n')
  const debut = toutes.findIndex(l => l.includes('Cabinet /min, son meilleur jeu'))
  const fin = toutes.findIndex((l, i) => i > debut && l.includes("L'expérience suit les confettis"))
  assert.ok(debut > 0 && fin > debut, `pas de tableau des confettis :\n${sortie}`)
  return toutes.slice(debut + 1, fin)
}
