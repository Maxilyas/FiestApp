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
//
// La tablée du 25 octobre 2026 a trouvé le modèle faux là où les barèmes du
// même jour s'étaient décidés : le rang où l'on reconnaît ne suivait pas la
// force — aux Indices, le complétionniste plafonnait à 6,45 étoiles sur neuf
// quand la tablée en faisait 8,75 —, le Filet ignorait sa marche, le tableau
// des jeux ne comptait pas les quatre œuvres de départ, Changer aux Indices
// savait d'avance s'il reconnaîtrait la personne, et le joueur sans savoir
// ignorait la zone d'Éclairer. Les épreuves qui suivent les premières le
// gardent (axes 9 et 10 de `retours/2026-10-25/synthese.md`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as BAREME from '../../shared/cabinet/bareme'
import { JEUX, CLES_DES_JEUX } from '../../shared/cabinet/jeux/regle'
import { POUVOIRS } from '../../shared/cabinet/pouvoirs'
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

/** Le joueur au hasard seul, sans le musée ni la zone de l'Épingle — qui ne dépend d'aucun joueur : quelques secondes. */
const AU_HASARD = ['--parties', '400', '--mesures', '20', '--sections', 'jeux,cartes,confettis', '--joueurs', 'hasard']
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

/** Les lignes d'une section, de son titre à la ligne vide qui la clôt. */
function sectionDe(sortie: string, titre: string): string[] {
  const toutes = sortie.split('\n')
  const debut = toutes.findIndex(l => l.startsWith(titre))
  assert.ok(debut >= 0, `pas de section « ${titre} » :\n${sortie}`)
  const fin = toutes.findIndex((l, i) => i > debut && l.trim() === '')
  return toutes.slice(debut + 1, fin < 0 ? undefined : fin)
}

/** Une part écrite en pour cent par le calibrage (« 25,3 % », « 25 »), en fraction. */
const enFraction = (texte: string) => {
  const n = lireNombre(texte.replace('%', '').trim())
  assert.ok(n !== null, `« ${texte} » n'est pas une part`)
  return n / 100
}

/**
 * Une case du tableau des cartes-bonus : au seuil dit, pour ce jeu et ce
 * joueur, la part sans carte (`null`) ou celle d'un pouvoir à une force — ses
 * trois forces s'écrivent dans une même case, « 1 · 2 · 3 ».
 */
function partAvecLaCarte(sortie: string, seuil: number, jeu: string, joueur: string, pouvoir: string | null, force?: 1 | 2 | 3): number {
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

// ── Le modèle corrigé après la tablée du 25 octobre 2026 ─────────────────

test('aux Indices, le rang où l’on reconnaît suit la force : le complétionniste passe le plafond du modèle d’avant', async () => {
  // Tiré sans la force, le rang plafonnait tout joueur à 6,45 étoiles sur neuf — ★★★ au troisième indice au plus,
  // 45 % des manches, même à reconnaître toujours —, quand la tablée en faisait 8,75 ; le logit ordinal en attend 6,6
  // du complétionniste. Le joueur moyen garde les parts du modèle.
  const { code, sortie, erreurs } = await calibrer(['--sections', 'jeux', '--jeux', 'indices', '--joueurs', 'moyen,complétionniste', '--parties', '1500'])
  assert.equal(code, 0, erreurs)
  const etoiles = (joueur: string) => lireNombre(ligneDuJeu(sortie, JEUX.indices.nom, joueur)[3])!
  assert.ok(etoiles('complétionniste') > 6.45, `le complétionniste aux Indices : ${etoiles('complétionniste')} étoiles sur neuf`)
  assert.ok(etoiles('complétionniste') > etoiles('moyen') + 1, `${etoiles('complétionniste')} contre ${etoiles('moyen')} au moyen`)
  // La colonne « = 9 » : les parties parfaites, jouées pour dorer — ce que vise un joueur fort, et ce que compte une tablée.
  assert.match(sortie, /≥ 5 · ≥ 6 · ≥ 7 · = 9/)
  const parts = (joueur: string) => ligneDuJeu(sortie, JEUX.indices.nom, joueur)[2].split(' · ').map(enFraction)
  for (const joueur of ['moyen', 'complétionniste']) {
    const [, , sept, neuf] = parts(joueur)
    assert.ok(neuf !== undefined && neuf <= sept + 0.03, `${joueur} : ${parts(joueur).join(' · ')}`)
  }
  assert.ok(parts('complétionniste')[3] > parts('moyen')[3], parts('complétionniste').join(' · '))
})

test('au Filet, ce que le joueur sait suit la marche de la question', async () => {
  // `--essai MARCHES_DU_FILET=moyen/difficile` rendait la même sortie au chiffre près : le modèle ne lisait pas la marche.
  const filet = ['--sections', 'jeux', '--jeux', 'filet', '--joueurs', 'moyen', '--parties', '800']
  const [duCode, essai] = await Promise.all([calibrer(filet), calibrer([...filet, '--essai', 'MARCHES_DU_FILET=moyen/difficile'])])
  assert.equal(duCode.code, 0, duCode.erreurs)
  assert.equal(essai.code, 0, essai.erreurs)
  const parts = (s: string) => ligneDuJeu(s, JEUX.filet.nom, 'moyen')[2].split(' · ').map(enFraction)
  const [avant, apres] = [parts(duCode.sortie), parts(essai.sortie)]
  // Plus difficiles, ses questions se savent moins : la commune et l'épique s'éloignent.
  assert.ok(apres[0] < avant[0] - 0.05 && apres[2] < avant[2] - 0.05, `le Filet du moyen : ${avant.join(' · ')} au code, ${apres.join(' · ')} à l'essai`)
})

test('les cartes-bonus, jeu par jeu : la mise au Détail sans rien savoir, et Changer aux Indices sans lire l’avenir', async () => {
  const { code, sortie, erreurs } = await calibrer(['--sections', 'cartes', '--jeux', 'detail,indices,epingle', '--joueurs', 'moyen,hasard', '--mesures', '400'])
  assert.equal(code, 0, erreurs)
  // Qui ne sait rien mise la première manche du Détail et devine un titre au premier coup d'œil : parfaite une fois
  // sur quatre, elle vaut trois étoiles et le bonus de la mise ; les deux autres, trois une fois sur quatre. Ce que
  // la règle en attend, des chiffres du barème — 25 % d'épiques au barème du 25 octobre 2026 (+4 à la force 3).
  const p = 1 / BAREME.TITRES_DU_DETAIL
  const parfaite = BAREME.ETOILES_AU_CADRAGE[0]
  const misee = parfaite + BAREME.BONUS_DE_MISE[3]
  let attendu = 0
  for (const [a, pa] of [[misee, p], [0, 1 - p]] as const)
    for (const [b, pb] of [[parfaite, p], [0, 1 - p]] as const)
      for (const [c, pc] of [[parfaite, p], [0, 1 - p]] as const) if (Math.min(BAREME.ETOILES_D_UNE_PARTIE, a + b + c) >= BAREME.SEUILS_DES_RARETES.epique) attendu += pa * pb * pc
  const epique = partAvecLaCarte(sortie, BAREME.SEUILS_DES_RARETES.epique, JEUX.detail.nom, 'hasard', POUVOIRS.miser.nom, 3)
  assert.ok(Math.abs(epique - attendu) < 0.06, `au Détail, au hasard, Miser 3 : ${epique} d'épiques, ${attendu} attendus`)
  // Changer décide sur ce qu'il voit — le premier indice, le plus obscur —, plus sur ce qu'il saurait au cinquième :
  // avec cet oracle, Changer 3 menait le moyen à une commune 87 fois sur 100, contre 53 sans carte.
  const commune = BAREME.SEUILS_DES_RARETES.commun
  const sans = partAvecLaCarte(sortie, commune, JEUX.indices.nom, 'moyen', null)
  const changer = partAvecLaCarte(sortie, commune, JEUX.indices.nom, 'moyen', POUVOIRS.changer.nom, 3)
  assert.ok(changer < sans + 0.15, `aux Indices, le moyen : ${changer} avec Changer 3, ${sans} sans carte`)
  // Qui ne sait rien lit la zone d'Éclairer : il ne plante plus n'importe où (0,5 % de communes, autant que sans carte).
  const zone = partAvecLaCarte(sortie, commune, JEUX.epingle.nom, 'hasard', POUVOIRS.eclairer.nom, 3)
  const sansZone = partAvecLaCarte(sortie, commune, JEUX.epingle.nom, 'hasard', null)
  assert.ok(zone > sansZone + 0.1, `à l'Épingle, au hasard : ${zone} avec Éclairer 3, ${sansZone} sans carte`)
})

test('le tableau des jeux compte aussi les quatre œuvres de départ, que tout profil emporte', async () => {
  const { code, sortie, erreurs } = await auHasardSeul()
  assert.equal(code, 0, erreurs)
  const lignes = sectionDe(sortie, 'Les jeux, un à un — avec les quatre œuvres de départ').map(cases)
  for (const jeu of CLES_DES_JEUX) {
    const avec = lignes.find(c => c[0] === JEUX[jeu].nom && c[1] === 'hasard')
    assert.ok(avec, `pas de ligne pour ${JEUX[jeu].nom} :\n${lignes.join('\n')}`)
    // La meilleure des quatre, ou aucune : jamais moins que sans carte, au bruit de la mesure près.
    const sans = ligneDuJeu(sortie, JEUX[jeu].nom, 'hasard')[2].split(' · ').map(enFraction)
    const [cinq] = avec[2].split(' · ').map(enFraction)
    assert.ok(cinq >= sans[0] - 0.04, `${JEUX[jeu].nom} : ${cinq} avec les œuvres de départ, ${sans[0]} sans carte`)
  }
})

test('une question du Pari se répond au temps d’une question de série', async () => {
  // À 9 s contre 14 en série — l'anecdote à part, que le Cabinet lit à la révélation —, le Pari payait ses confettis
  // plus vite que la série au seul temps posé, et décidait de la condition du troisième choix délégué.
  const { code, sortie, erreurs } = await auHasardSeul()
  assert.equal(code, 0, erreurs)
  const temps = /une série à (\d+) s la question au joueur moyen, dont (\d+) s d'anecdote ; une question du Pari à (\d+) s/.exec(sortie)
  assert.ok(temps, `le temps d'une question :\n${sortie}`)
  const [serie, anecdote, pari] = temps.slice(1).map(Number)
  assert.equal(pari, serie - anecdote)
})

/** La ligne d'une règle de la zone, à la section de l'Épingle : sa part de communes, au centre · au milieu de la terre · au meilleur point. */
function communesALEpingle(sortie: string, regle: string): number[] {
  const ligne = sectionDe(sortie, "Éclairer à l'Épingle")
    .map(cases)
    .find(c => c[0] === regle)
  assert.ok(ligne, `pas de ligne « ${regle} » :\n${sectionDe(sortie, "Éclairer à l'Épingle").join('\n')}`)
  return ligne[1].split(' · ').map(enFraction)
}

test('à l’Épingle, qui ne sait rien lit la zone d’Éclairer : la règle du code et ses pistes', async () => {
  const epingle = ['--sections', 'epingle', '--parties', '600']
  const [duCode, essai] = await Promise.all([calibrer(epingle), calibrer([...epingle, '--essai', 'DECALAGE_DE_LA_ZONE_KM=120/165'])])
  assert.equal(duCode.code, 0, duCode.erreurs)
  assert.equal(essai.code, 0, essai.erreurs)
  const auMieux = (s: string, regle: string) => Math.max(...communesALEpingle(s, regle))
  // La règle du 25 octobre 2026 : trois zones font une commune à qui ne sait rien plus de neuf fois sur dix — 93 % au
  // milieu de la terre que la zone couvre, dit la contre-expertise.
  assert.ok(auMieux(duCode.sortie, 'de 40 à 140 km, rayon 170 km') > 0.85)
  // La piste de l'expert ne tient pas : la couronne se lit, et la mer fait le reste (45 à 56 %).
  const couronne = auMieux(duCode.sortie, 'de 120 à 165 km, rayon 170 km')
  assert.ok(couronne > 0.35 && couronne < 0.75, `de 120 à 165 km : ${couronne}`)
  // Le lieu partout dans un disque de 300 km : il n'y a plus de couronne à lire (15 à 32 %).
  assert.ok(auMieux(duCode.sortie, 'partout dans le disque, rayon 300 km') < 0.4)
  // La ligne du code suit le barème, essai compris : elle dit son décalage et son rayon, et vaut la piste qui a les mêmes.
  const duBareme = (s: string) => sectionDe(s, "Éclairer à l'Épingle").map(cases).find(c => c[0].startsWith('le code'))!
  for (const s of [duCode.sortie, essai.sortie]) {
    const ligne = duBareme(s)
    assert.ok(ligne, s)
    const regle = ligne[0].replace(/^le code : /, '')
    const piste = sectionDe(s, "Éclairer à l'Épingle").map(cases).find(c => c[0] === regle)
    if (piste) assert.ok(Math.abs(Math.max(...ligne[1].split(' · ').map(enFraction)) - Math.max(...piste[1].split(' · ').map(enFraction))) < 0.07, `${ligne.join(' | ')}\n${piste.join(' | ')}`)
  }
  assert.match(duBareme(essai.sortie)[0], /^le code : de 120 à 165 km/)
})

test('le joueur « tablée » a sa ligne à chaque jeu, au-dessus du complétionniste', async () => {
  // Les agents d'une tablée en savent plus que tout joueur (θ ≈ +2,5) : sa synthèse compare chaque jeu à cette ligne.
  const { code, sortie, erreurs } = await calibrer(['--sections', 'jeux', '--joueurs', 'complétionniste,tablée', '--parties', '300'])
  assert.equal(code, 0, erreurs)
  for (const jeu of CLES_DES_JEUX) {
    const etoiles = (joueur: string) => lireNombre(ligneDuJeu(sortie, JEUX[jeu].nom, joueur)[3])!
    assert.ok(etoiles('tablée') >= etoiles('complétionniste') - 0.2, `${JEUX[jeu].nom} : ${etoiles('tablée')} à la tablée, ${etoiles('complétionniste')} au complétionniste`)
  }
})

test('le chasseur chasse dans la salle du prochain gardien, et l’éveille plus tôt que l’occasionnel', async () => {
  // L'occasionnel attendait son premier gardien au 36ᵉ jour : la visite remplit les neuf salles à la fois. Le même
  // joueur, aux mêmes jours, qui chasse là où la page lui dit le prochain gardien, l'éveille plus tôt.
  const { code, sortie, erreurs } = await calibrer(['--sections', 'musee', '--joueurs', 'occasionnel,chasseur', '--parcours', '2', '--jours', '80', '--mesures', '30'])
  assert.equal(code, 0, erreurs)
  const premier = (joueur: string) => {
    const bloc = sortie.slice(sortie.indexOf(`\n  ${joueur}\n`))
    const m = /le premier gardien réveillé en jouant : (\S+) j/.exec(bloc)
    assert.ok(m, `${joueur} :\n${sortie}`)
    return lireNombre(m[1])!
  }
  assert.ok(premier('chasseur') < premier('occasionnel'), `le premier gardien : au ${premier('chasseur')}ᵉ jour au chasseur, au ${premier('occasionnel')}ᵉ à l'occasionnel`)
})
