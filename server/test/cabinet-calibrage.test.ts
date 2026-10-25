// Le calibrage du Cabinet de curiosités (`scripts/calibrage-cabinet.ts`) : ses
// chiffres, datés dans `docs/reference/baremes.md`, décident des barèmes avant
// l'ouverture. Ils ne s'éprouvent pas un à un — ce que sait chaque joueur est
// un modèle —, mais ce qui les rendrait faux sans un mot, si : jouer autre
// chose que les règles du code — une constante du barème recopiée, une règle
// chargée avant l'essai d'un barème, qui ne le verrait pas —, ou manquer un
// plancher que les règles fixent d'elles-mêmes. Au hasard, le Mot mystère et le
// Filet ne font jamais cinq étoiles (aucun mot ne se tape au hasard, et le grand
// filet ne vaut qu'une étoile par manche), et le Détail les fait à la chance de
// deviner deux tableaux sur trois du premier coup : 15,6 %.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as BAREME from '../../shared/cabinet/bareme'
import { JEUX, CLES_DES_JEUX } from '../../shared/cabinet/jeux/regle'
import { lireNombre } from '../../shared/nombres'
import { importsStatiques } from './chemin-des-imports'

const SERVEUR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = 'scripts/calibrage-cabinet.ts'
const SOURCE = readFileSync(path.join(SERVEUR, SCRIPT), 'utf8')

/** Le script, lancé comme on le lance. */
function calibrer(args: string[]): Promise<{ code: number | null; sortie: string; erreurs: string }> {
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

/** La part des parties à une commune, au hasard, jeu par jeu : la ligne que le calibrage en écrit. */
function auHasard(sortie: string): Map<string, number> {
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

/** Le joueur au hasard seul, sans le musée : quelques secondes. */
const AU_HASARD = ['--parties', '400', '--mesures', '20', '--sans-musee', '--joueurs', 'hasard']

test('au hasard, chaque jeu a le plancher que ses règles lui font', async () => {
  const { code, sortie, erreurs } = await calibrer(AU_HASARD)
  assert.equal(code, 0, erreurs)
  const parts = auHasard(sortie)
  assert.deepEqual([...parts.keys()].sort(), CLES_DES_JEUX.map(j => JEUX[j].nom).sort(), 'les neuf jeux, chacun une fois')
  assert.equal(parts.get(JEUX.mot.nom), 0, 'aucun mot ne se trouve au hasard')
  assert.equal(parts.get(JEUX.filet.nom), 0, 'le grand filet ne fait qu’une étoile par manche')
  // Deviner un titre sur quatre au premier cadrage, deux manches sur trois : 3 × (1/4)² × 3/4 + (1/4)³.
  const detail = parts.get(JEUX.detail.nom)!
  assert.ok(detail > 0.08 && detail < 0.24, `le Détail au hasard : ${detail}, pour 15,6 % de deviner`)
})

test('un barème s’essaie en mémoire, et ce sont les règles du code qui le lisent', async () => {
  const [avant, essai] = await Promise.all([calibrer(AU_HASARD), calibrer([...AU_HASARD, '--essai', 'ERREURS_DE_LA_FRISE=0/1/1'])])
  assert.equal(essai.code, 0, essai.erreurs)
  assert.match(essai.sortie, /Essai : ERREURS_DE_LA_FRISE = \[0,1,1\]/)
  const frise = (s: string) => auHasard(s).get(JEUX.frise.nom)!
  // Deux erreurs ne valent plus une étoile : la frise rangée au hasard ne tient plus si souvent la commune.
  assert.ok(frise(essai.sortie) < frise(avant.sortie) - 0.05, `la Frise au hasard : ${frise(avant.sortie)} au barème du code, ${frise(essai.sortie)} à l’essai`)
  // Le reste n'a pas bougé : la même graine, les mêmes parties.
  assert.equal(auHasard(essai.sortie).get(JEUX.detail.nom), auHasard(avant.sortie).get(JEUX.detail.nom))
})

test('ce qui ne s’essaie pas se refuse en mots, avant de jouer', async () => {
  const nombre = await calibrer(['--essai', 'POUSSIERE_MIN=2'])
  assert.equal(nombre.code, 1)
  assert.match(nombre.erreurs, /un nombre exporté ne se réécrit pas/)
  const inconnue = await calibrer(['--essai', 'PAS_UNE_CONSTANTE=1'])
  assert.equal(inconnue.code, 1)
  assert.match(inconnue.erreurs, /n'est pas une constante de shared\/cabinet\/bareme\.ts/)
  const forme = await calibrer(['--essai', 'KM_DE_L_EPINGLE=40/120'])
  assert.equal(forme.code, 1)
  assert.match(forme.erreurs, /3 valeurs attendues/)
  const marche = await calibrer(['--essai', 'MARCHES_DU_PARI=pari:tres-dur'])
  assert.equal(marche.code, 1)
  assert.match(marche.erreurs, /n'est pas une marche/)
})

test('le musée se remplit jour après jour, par les règles du musée', async () => {
  // Un explorateur qui rapporte soixante œuvres et joue chaque jour : tout est à lui en une semaine ou deux.
  const { code, sortie, erreurs } = await calibrer(['--parties', '100', '--mesures', '20', '--parcours', '1', '--jours', '30', '--joueurs', 'moyen', '--arrivees', '60'])
  assert.equal(code, 0, erreurs)
  assert.match(sortie, /un explorateur au niveau 3 \(30 œuvres rapportées\), au niveau 6 \(60\)/)
  const jours = /tout posséder : (\d+) j/.exec(sortie)
  assert.ok(jours && Number(jours[1]) <= 30, `tout posséder :\n${sortie}`)
  assert.match(sortie, /par jour joué : \d+ parties/)
  assert.match(sortie, /gardiens réveillés, semaine/)
})

test('le calibrage joue les règles du code, sans en recopier une', () => {
  // Aucune constante du barème redéclarée : une copie suivrait un barème d'avant sans un mot. Les commentaires
  // (l'exemple d'un essai, `ERREURS_DE_LA_FRISE=0/1/1`) ne déclarent rien.
  const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const redites = Object.keys(BAREME).filter(nom => new RegExp(`\\b(const|let|var)\\s+${nom}\\b|\\b${nom}\\s*=\\s*[[{0-9]`).test(code))
  assert.deepEqual(redites, [], 'constantes du barème redéclarées dans le calibrage')
  // Avant l'essai d'un barème, rien qui le lise : de proche en proche, ses imports statiques ne chargent du
  // Cabinet que le barème lui-même, qui n'importe que des types — une règle chargée avant l'essai aurait tiré
  // d'une valeur d'avant ce qu'elle en garde (l'étoile gardée du Pari, le recul d'une année du Filet).
  const racine = path.join(SERVEUR, '..')
  const charges = [...importsStatiques(path.join(SERVEUR, SCRIPT))].map(f => path.relative(racine, f).split(path.sep).join('/'))
  assert.deepEqual(charges.filter(f => f.startsWith('shared/cabinet/') || f.startsWith('server/src/')), ['shared/cabinet/bareme.ts'])
  const essai = SOURCE.indexOf('const ESSAIS =')
  assert.ok(essai > 0 && SOURCE.indexOf('await import(') > essai, 'les règles se chargent après l’essai')
})
