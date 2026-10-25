// Le calibrage du Cabinet de curiosités (`scripts/calibrage-cabinet.ts`) : ses
// chiffres, datés dans `docs/reference/baremes.md`, décident des barèmes avant
// l'ouverture. Ils ne s'éprouvent pas un à un — ce que sait chaque joueur est
// un modèle —, mais ce qui les rendrait faux sans un mot, si : jouer autre
// chose que les règles du code — une constante du barème recopiée, une règle
// chargée avant l'essai d'un barème, qui ne le verrait pas, un essai que
// `bareme.ts` ne suivrait qu'à moitié —, manquer un plancher que les règles
// fixent d'elles-mêmes, une mesure qui changerait selon les joueurs simulés
// avant elle, ou une séance où le plafond des départs dirait le contraire de
// la minute. Au hasard, le Filet fait une commune à la part de piste que ses
// filets couvrent, lancés vers le seuil (3,5 %), et le Détail à la chance de
// deviner deux tableaux sur trois du premier coup (15,6 %). Le Mot mystère,
// jamais : son zéro tient au modèle, qui n'y tape pas le mot — une chance sur
// douze millions à cinq lettres —, et au pli, qui ne donne pas une étoile à
// cinq essais faux.
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
/** Le code sans ses commentaires : l'exemple d'un essai (`ERREURS_DE_LA_FRISE=0/1/2`) ne déclare rien. */
const sansCommentaires = (texte: string) => texte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

type Lancement = { code: number | null; sortie: string; erreurs: string }
/** Le script, lancé comme on le lance. */
function calibrer(args: string[]): Promise<Lancement> {
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

/** Le joueur au hasard seul, sans le musée : quelques secondes. */
const AU_HASARD = ['--parties', '400', '--mesures', '20', '--sans-musee', '--joueurs', 'hasard']
let auHasardLance: Promise<Lancement> | null = null
/** Lancé une fois, lu par plusieurs épreuves. */
const auHasardSeul = () => (auHasardLance ??= calibrer(AU_HASARD))

/** Les cases d'une ligne de tableau : le script sépare ses colonnes de deux blancs au moins, et n'en met qu'un dans une case. */
const cases = (ligne: string) => ligne.trim().split(/\s{2,}/)

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

/** La ligne d'un jeu, pour un joueur, au tableau des jeux un à un : ses parts, ses étoiles en moyenne, ses justes… */
function ligneDuJeu(sortie: string, jeu: string, joueur: string): string[] {
  const ligne = sortie.split('\n').map(cases).find(c => c[0] === jeu && c[1] === joueur)
  assert.ok(ligne, `pas de ligne pour ${jeu} et ${joueur} :\n${sortie}`)
  return ligne
}

/** Les lignes des confettis à la minute, joueur par joueur : de l'en-tête du tableau à l'expérience. */
function lignesDesConfettis(sortie: string): string[] {
  const toutes = sortie.split('\n')
  const debut = toutes.findIndex(l => l.includes('Cabinet /min, son meilleur jeu'))
  const fin = toutes.findIndex((l, i) => i > debut && l.includes("L'expérience suit les confettis"))
  assert.ok(debut > 0 && fin > debut, `pas de tableau des confettis :\n${sortie}`)
  return toutes.slice(debut + 1, fin)
}

/**
 * Le plancher du Filet au hasard, des seules constantes du barème : un curseur
 * posé n'importe où prend la réponse à la part de piste que le filet couvre —
 * deux demi-largeurs —, et chaque manche lance le filet qui donne le plus de
 * chances d'atteindre le seuil.
 */
function filetAuHasard(seuil: number): number {
  const tailles = Object.keys(BAREME.LARGEURS_DU_FILET) as (keyof typeof BAREME.LARGEURS_DU_FILET)[]
  const V = (reste: number, s: number): number =>
    reste === 0
      ? s >= seuil
        ? 1
        : 0
      : Math.max(
          ...tailles.map(t => {
            const prise = 2 * BAREME.LARGEURS_DU_FILET[t]
            return prise * V(reste - 1, s + BAREME.ETOILES_DU_FILET[t]) + (1 - prise) * V(reste - 1, s)
          }),
        )
  return V(BAREME.MANCHES_PAR_PARTIE, 0)
}

test('au hasard, chaque jeu a le plancher que ses règles lui font', async () => {
  const { code, sortie, erreurs } = await auHasardSeul()
  assert.equal(code, 0, erreurs)
  const parts = auHasard(sortie)
  assert.deepEqual([...parts.keys()].sort(), CLES_DES_JEUX.map(j => JEUX[j].nom).sort(), 'les neuf jeux, chacun une fois')
  // Le modèle ne tape jamais le mot au hasard ; que cinq essais faux ne valent rien, c'est le pli qui le juge : pas une étoile, en moyenne.
  assert.equal(parts.get(JEUX.mot.nom), 0, 'aucun mot ne se trouve au hasard')
  assert.equal(lireNombre(ligneDuJeu(sortie, JEUX.mot.nom, 'hasard')[3]), 0, 'cinq essais faux ne rapportent pas une étoile')
  // Le Filet lancé vers le seuil : jouer la moyenne, c'était le grand filet, une étoile par manche, et zéro commune — la stratégie, pas la règle.
  const filet = parts.get(JEUX.filet.nom)!
  const attendu = filetAuHasard(BAREME.SEUILS_DES_RARETES.commun)
  assert.ok(Math.abs(filet - attendu) < 0.025, `le Filet au hasard : ${filet}, pour ${attendu} de filets lancés vers le seuil`)
  // Deviner un titre sur quatre au premier cadrage, deux manches sur trois : 3 × (1/4)² × 3/4 + (1/4)³.
  const detail = parts.get(JEUX.detail.nom)!
  assert.ok(detail > 0.08 && detail < 0.24, `le Détail au hasard : ${detail}, pour 15,6 % de deviner`)
  // Les jeux qui ne visent pas le seuil se lisent sur les mêmes parties : jamais plus de parties à six étoiles qu'à cinq.
  const visent = /chacune jouée vers ce seuil — (.+) s'y jouent autrement/.exec(sortie)
  assert.ok(visent, `les jeux qui visent le seuil :\n${sortie}`)
  assert.deepEqual(visent[1].split(' et ').sort(), [JEUX.filet.nom, JEUX.pari.nom].sort(), 'le Pari et le Filet se jouent vers le seuil')
  for (const jeu of CLES_DES_JEUX.filter(j => !visent[1].split(' et ').includes(JEUX[j].nom))) {
    const [cinq, six, sept] = ligneDuJeu(sortie, JEUX[jeu].nom, 'hasard')[2].split(' · ').map(x => lireNombre(x.replace(' %', ''))!)
    assert.ok(cinq >= six && six >= sept, `${JEUX[jeu].nom} : ${cinq} · ${six} · ${sept}`)
  }
})

test('le plafond des départs ne dit pas le contraire de la minute : le temps qu’il libère va à la série', async () => {
  const { code, sortie, erreurs } = await auHasardSeul()
  assert.equal(code, 0, erreurs)
  let serie: number | null = null
  let lues = 0
  for (const ligne of lignesDesConfettis(sortie)) {
    const c = cases(ligne)
    const cabinet = c.find(x => /^\S+ \(.+\)$/.test(x))
    if (!cabinet) continue
    if (c[0] === 'hasard') serie = lireNombre(c[2])
    assert.ok(serie !== null, `la série d'abord :\n${ligne}`)
    const parMinute = lireNombre(cabinet.split(' ')[0])!
    const seances = c.filter(x => / contre /.test(x)).map(x => x.split(' contre ').map(n => lireNombre(n)!))
    assert.equal(seances.length, 2, `une heure et trois heures :\n${ligne}`)
    // Le Cabinet qui paie mieux à la minute paie mieux en séance, plafond compris ; moins bien, moins bien.
    for (const [auCabinet, enSerie] of seances) {
      if (parMinute > serie + 0.02) assert.ok(auCabinet > enSerie, `${parMinute} la minute contre ${serie}, mais ${auCabinet} contre ${enSerie} en séance :\n${ligne}`)
      if (parMinute < serie - 0.02) assert.ok(auCabinet < enSerie, `${parMinute} la minute contre ${serie}, mais ${auCabinet} contre ${enSerie} en séance :\n${ligne}`)
    }
    lues++
  }
  assert.equal(lues, 2, 'sans carte-bonus, puis avec le meilleur gardien')
  assert.match(sortie, /ne laisserait payer que ses \d+ parties du jour — au plus \S+ de plus par jour/)
})

test('une mesure ne dépend pas des joueurs simulés avant elle', async () => {
  const [seul, apres] = await Promise.all([auHasardSeul(), calibrer([...AU_HASARD, '--joueurs', 'moyen,hasard'])])
  assert.equal(apres.code, 0, apres.erreurs)
  // Le joueur au hasard, jeu par jeu, puis ses confettis : sans carte, et avec un gardien qui éclaire — le hasard d'Éclairer vient de la graine du départ.
  const duHasard = (s: string) => {
    const jeux = s.split('\n').filter(l => cases(l)[1] === 'hasard')
    const confettis = lignesDesConfettis(s)
    const debut = confettis.findIndex(l => cases(l)[0] === 'hasard')
    return [...jeux, ...confettis.slice(debut)]
  }
  assert.ok(duHasard(seul.sortie).length > CLES_DES_JEUX.length, seul.sortie)
  assert.deepEqual(duHasard(apres.sortie), duHasard(seul.sortie))
})

test('un barème s’essaie en mémoire, et ce sont les règles du code qui le lisent', async () => {
  // Le barème d'avant le calibrage du 25 octobre 2026, essayé contre celui du code : deux erreurs y valaient ★.
  assert.deepEqual([...BAREME.ERREURS_DE_LA_FRISE], [0, 1, 1], 'le barème du code')
  const [avant, essai] = await Promise.all([auHasardSeul(), calibrer([...AU_HASARD, '--essai', 'ERREURS_DE_LA_FRISE=0/1/2'])])
  assert.equal(essai.code, 0, essai.erreurs)
  assert.match(essai.sortie, /Essai : ERREURS_DE_LA_FRISE = \[0,1,2\]/)
  const frise = (s: string) => auHasard(s).get(JEUX.frise.nom)!
  // Deux erreurs valent de nouveau une étoile : la frise rangée au hasard tient bien plus souvent la commune.
  assert.ok(frise(essai.sortie) > frise(avant.sortie) + 0.05, `la Frise au hasard : ${frise(avant.sortie)} au barème du code, ${frise(essai.sortie)} à l’essai`)
  // Le reste n'a pas bougé : la même graine, les mêmes parties.
  assert.equal(auHasard(essai.sortie).get(JEUX.detail.nom), auHasard(avant.sortie).get(JEUX.detail.nom))
})

test('ce qui ne s’essaie pas se refuse en mots, avant de jouer', async () => {
  const [nombre, inconnue, forme, marche, vagues, memeSomme] = await Promise.all([
    calibrer(['--essai', 'POUSSIERE_MIN=2']),
    calibrer(['--essai', 'PAS_UNE_CONSTANTE=1']),
    calibrer(['--essai', 'KM_DE_L_EPINGLE=40/120']),
    calibrer(['--essai', 'MARCHES_DU_PARI=pari:tres-dur']),
    // Les frises livrées comptent leurs sept événements : bareme.ts les tire des vagues à son chargement, avant l'essai.
    calibrer(['--essai', 'VAGUES_DE_LA_FRISE=2/2/2']),
    calibrer(['--sans-musee', '--joueurs', 'hasard', '--parties', '20', '--mesures', '2', '--essai', 'VAGUES_DE_LA_FRISE=4/2/1']),
  ])
  assert.equal(nombre.code, 1)
  assert.match(nombre.erreurs, /un nombre exporté ne se réécrit pas/)
  assert.equal(inconnue.code, 1)
  assert.match(inconnue.erreurs, /n'est pas une constante de shared\/cabinet\/bareme\.ts/)
  assert.equal(forme.code, 1)
  assert.match(forme.erreurs, /3 valeurs attendues/)
  assert.equal(marche.code, 1)
  assert.match(marche.erreurs, /n'est pas une marche/)
  assert.equal(vagues.code, 1, vagues.sortie)
  assert.match(vagues.erreurs, new RegExp(`ces vagues posent 6 événements, et les frises livrées en comptent ${BAREME.EVENEMENTS_D_UNE_FRISE_A_THEME}`))
  assert.doesNotMatch(vagues.erreurs, /que le serveur ne relirait pas/)
  // Des vagues d'autant d'événements se jouent : le refus ne tient qu'à la somme.
  assert.equal(memeSomme.code, 0, memeSomme.erreurs)
  assert.match(memeSomme.sortie, /Essai : VAGUES_DE_LA_FRISE = \[4,2,1\]/)
})

test('le musée se remplit jour après jour, par les règles du musée', async () => {
  // Un joueur moyen qui arrive neuf et joue chaque jour : tout est à lui en moins d'un mois. Jusqu'au 25 octobre 2026,
  // l'épreuve faisait arriver un explorateur avec soixante œuvres de l'Expédition : la migration s'est abandonnée
  // (la décision du propriétaire, chacun commence à zéro), et chacun arrive neuf.
  const { code, sortie, erreurs } = await calibrer(['--parties', '100', '--mesures', '20', '--parcours', '1', '--jours', '30', '--joueurs', 'moyen'])
  assert.equal(code, 0, erreurs)
  assert.match(sortie, /chacun arrive neuf : les 4 œuvres de départ, rien de l'Expédition/)
  assert.doesNotMatch(sortie, /rapportées/)
  const jours = /tout posséder : (\d+) j/.exec(sortie)
  assert.ok(jours && lireNombre(jours[1])! <= 30, `tout posséder :\n${sortie}`)
  assert.match(sortie, /par jour joué : \d+ parties/)
  assert.match(sortie, /gardiens réveillés, semaine/)
})

test('le calibrage joue les règles du code, sans en recopier une', () => {
  // Aucune constante du barème redéclarée : une copie suivrait un barème d'avant sans un mot.
  const code = sansCommentaires(SOURCE)
  const redites = Object.keys(BAREME).filter(nom => new RegExp(`\\b(const|let|var)\\s+${nom}\\b|\\b${nom}\\s*=\\s*[[{0-9]`).test(code))
  assert.deepEqual(redites, [], 'constantes du barème redéclarées dans le calibrage')
  // Avant l'essai d'un barème, rien qui le lise : de proche en proche, ses imports statiques ne chargent du
  // Cabinet que le barème lui-même, qui n'importe que des types — une règle chargée avant l'essai aurait tiré
  // d'une valeur d'avant ce qu'elle en garde (les étoiles gardées du Pari, le recul d'une année du Filet).
  const racine = path.join(SERVEUR, '..')
  const charges = [...importsStatiques(path.join(SERVEUR, SCRIPT))].map(f => path.relative(racine, f).split(path.sep).join('/'))
  assert.deepEqual(charges.filter(f => f.startsWith('shared/cabinet/') || f.startsWith('server/src/')), ['shared/cabinet/bareme.ts'])
  const essai = SOURCE.indexOf('const ESSAIS =')
  assert.ok(essai > 0 && SOURCE.indexOf('await import(') > essai, 'les règles se chargent après l’essai')
  // Les imports ne disent pas tout : ce que bareme.ts tire lui-même d'un tableau à son chargement (les événements
  // d'une frise, de ses vagues) garde la valeur d'avant l'essai. Chaque tableau dont une autre constante se tire
  // a donc sa garde au calibrage (`DERIVEES`), qui refuse en mots l'essai qu'elle ne suivrait pas.
  const declarations = sansCommentaires(readFileSync(path.join(racine, 'shared/cabinet/bareme.ts'), 'utf8')).split(/^export const /m).slice(1)
  const tableaux = Object.keys(BAREME).filter(nom => typeof (BAREME as Record<string, unknown>)[nom] === 'object')
  const tires = declarations.flatMap(d => {
    const [, nom, valeur] = /^(\w+)[^=]*=([\s\S]*)$/.exec(d) ?? []
    return tableaux.filter(t => t !== nom && new RegExp(`\\b${t}\\b`).test(valeur ?? '')).map(t => ({ nom, de: t }))
  })
  assert.deepEqual(tires, [{ nom: 'EVENEMENTS_D_UNE_FRISE_A_THEME', de: 'VAGUES_DE_LA_FRISE' }], 'les constantes que bareme.ts tire d’un tableau')
  const gardes = SOURCE.slice(SOURCE.indexOf('const DERIVEES'))
  for (const { de } of tires) assert.ok(gardes.includes(`'${de}',`), `${de} : un essai changerait le tableau sans ce que bareme.ts en tire`)
})
