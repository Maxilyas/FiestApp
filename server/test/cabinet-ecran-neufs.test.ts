// Les écrans des trois jeux au contenu neuf du Cabinet — l'Épingle, les
// Indices, la Réplique — et tes murs, rendus en HTML (`renderToStaticMarkup`)
// sur les vues qu'un vrai serveur rend à des joueurs qui jouent par les routes,
// les réponses lues dans le plan en base. Un fichier à part de
// `cabinet-ecran.test.ts`, qui tient le musée et les six premiers jeux : chacun
// sous la minute (règle `tests.md`). Sans navigateur : seul le premier rendu se
// lit ; les écrans se regardent au téléphone par la skill `regarder-le-rendu`.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { inscrireProfil } from './banc'
import {
  bancDuCabinet,
  commencer,
  epingleDe,
  ficheDe,
  fermerLesMagasins,
  jouer,
  jouerDesIndices,
  jouerUneEpingle,
  jouerUneFrise,
  jouerUneReplique,
  lire,
  ok,
  ouvrir,
  repliqueDe,
  type BancDuCabinet,
} from './cabinet-banc'
import { importsStatiques } from './chemin-des-imports'
import { GRACE_D_UNE_MANCHE_MS, SIGNES_D_UN_GESTE_MAX } from '../../shared/cabinet/bareme'
import { DANS_LA_FRANCE, HAUTEUR_DE_LA_CARTE, LARGEUR_DE_LA_CARTE, distanceKm, projeter, type Point } from '../../shared/cabinet/france'
import { pointADistance, type EpingleMontree, type EpingleRevelee } from '../../shared/cabinet/jeux/epingle'
import type { IndicesMontres, IndicesReveles } from '../../shared/cabinet/jeux/indices'
import type { RepliqueMontree, RepliqueRevelee } from '../../shared/cabinet/jeux/replique'
import { CLES_DES_JEUX } from '../../shared/cabinet/jeux/regle'
import type { MursDuCabinet, VueDeLaPartie } from '../../shared/cabinet/vues'
import { anneeDite } from '../../shared/frise'

// Le client compile son JSX pour un `React` global, et `state.ts` lit son adresse à l'import : posés avant tout composant.
Object.assign(globalThis, { React, window: { location: { pathname: '/cabinet', search: '', hash: '', origin: 'http://banc' }, addEventListener: () => {} } })

const client = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/src')
const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href
const source = (fichier: string) => readFileSync(path.join(client, fichier), 'utf8')

async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(url(`${fichier}.tsx`))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** Ce qu'on lit d'un rendu : son texte, sans balises, les espaces insécables en espaces, le gluon de l'inversion effacé. */
const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/\u2060/g, '')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s+/g, ' ')

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Un texte du contenu tel que `texte()` le lit : son apostrophe droite y devient la typographique, ses espaces fines des espaces. */
const lu = (s: string) => echapper(texte(s.replace(/'/g, '’')))

/**
 * Les mots de l'écran : « carte de France », « carte-bonus », jamais « carte » seule ; rien du lexique d'avant ; aucun champ qui
 * prend le focus. Le contenu tiré n'est pas un mot de l'écran : l'indice d'Usain Bolt compte ses « médailles d'or » (`contenu`, ses
 * textes ôtés avant de lire).
 */
function sansJargon(html: string, ou: string, contenu: readonly string[] = []) {
  const t = contenu.reduce((s, c) => s.split(texte(c.replace(/'/g, '’')).trim()).join(' '), texte(html))
  assert.doesNotMatch(t, /\bcartes?\b(?!-bonus| de France)/i, `${ou} : « carte » seule`)
  assert.doesNotMatch(t, /\bbadges?\b|médaille/i, `${ou} : le lexique des récompenses`)
  assert.doesNotMatch(html, /autoFocus|autofocus/, `${ou} : aucun champ ne prend le focus d'office`)
}

const rien = () => {}

// ── Des joueurs, par les vraies routes ────────────────────────────────────

let b: BancDuCabinet
let rose: string
let pierre: string
let alice: string
let zoe: string
const vues: Record<string, VueDeLaPartie> = {}

/** La page passe le temps de l'étape qui court, sa pause et sa grâce : la réponse qui part d'elle-même arrive en retard. */
const apresLEcheance = (v: VueDeLaPartie) => {
  b.horloge.t = v.chrono!.echeance + (v.chrono!.pauseResteMs ?? 0) + GRACE_D_UNE_MANCHE_MS + 1
}

before(async () => {
  b = await bancDuCabinet()
  // Rose, à l'Épingle, Coup d'œil emporté : la première manche éclairée et plantée sur le lieu, la deuxième à deux cents
  // kilomètres, la troisième laissée au temps sans épingle ; puis une Frise rangée jusqu'au bout, pour ses murs.
  rose = await inscrireProfil(b.banc.url, 'rose', 'Rose')
  let e = (vues.epingle = ok(await commencer(b, rose, { origine: 'libre', jeu: 'epingle', carte: 'coup-d-oeil' }), 'l’Épingle'))
  e = vues.epingleEclairee = ok(await jouer(b, rose, e, { quoi: 'eclairer', manche: 0 }), 'éclairer l’Épingle')
  e = vues.epingleSurLeLieu = await jouerUneEpingle(b, rose, e, 0)
  e = await ouvrir(b, rose, e, 1)
  e = vues.epingleLoin = await jouerUneEpingle(b, rose, e, 1, 200)
  e = vues.epingleTroisieme = await ouvrir(b, rose, e, 2)
  apresLEcheance(e)
  vues.epingleSans = ok(await jouer(b, rose, e, { quoi: 'repondre', manche: 2, auto: true }), 'l’Épingle laissée au temps')
  let f = ok(await commencer(b, rose, { origine: 'libre', jeu: 'frise', carte: null }), 'la Frise')
  for (let k = 0; k < 3; k++) {
    if (k > 0) f = await ouvrir(b, rose, f, k)
    f = await jouerUneFrise(b, rose, f, k)
  }

  // Pierre, aux Indices, Coup d'œil emporté : un nom faux, un indice offert, puis la réponse ; à la deuxième manche, tous les
  // indices vus, puis un nom faux au dernier, qui tranche ; la troisième quittée.
  pierre = await inscrireProfil(b.banc.url, 'pierre', 'Pierre')
  let i = (vues.indices = ok(await commencer(b, pierre, { origine: 'libre', jeu: 'indices', carte: 'coup-d-oeil' }), 'les Indices'))
  i = vues.indicesFaux = ok(await jouer(b, pierre, i, { quoi: 'nom', manche: 0, texte: 'Personne Inconnue' }), 'un nom faux')
  i = vues.indicesOffert = ok(await jouer(b, pierre, i, { quoi: 'eclairer', manche: 0 }), 'un indice offert')
  i = vues.indicesTrouve = ok(await jouer(b, pierre, i, { quoi: 'nom', manche: 0, texte: ficheDe(b, i.id, 0).fiche.reponse }), 'trouvé')
  i = await ouvrir(b, pierre, i, 1)
  for (let k = 0; k < 4; k++) i = ok(await jouer(b, pierre, i, { quoi: 'indice', manche: 1 }), 'un indice de plus')
  vues.indicesTousVus = i
  i = vues.indicesRate = await jouerDesIndices(b, pierre, i, 1, { juste: false })
  i = await ouvrir(b, pierre, i, 2)
  ok(await jouer(b, pierre, i, { quoi: 'quitter' }), 'quitter les Indices')

  // Alice, à la Réplique, Coup d'œil emporté : un mot effacé, le bon mot, la bonne personne ; à la deuxième manche, « Quitter ? »
  // ouvert à l'étape du mot, et la réponse qui part d'elle-même à son échéance ouvre « Qui l'a dit ? » ; à la troisième, le bon
  // mot, puis quittée.
  alice = await inscrireProfil(b.banc.url, 'alice', 'Alice')
  let r = (vues.replique = ok(await commencer(b, alice, { origine: 'libre', jeu: 'replique', carte: 'coup-d-oeil' }), 'la Réplique'))
  r = vues.repliqueEclairee = ok(await jouer(b, alice, r, { quoi: 'eclairer', manche: 0 }), 'éclairer la Réplique')
  const t0 = repliqueDe(b, r.id, 0)
  r = vues.repliqueQui = ok(await jouer(b, alice, r, { quoi: 'mot', manche: 0, choix: t0.bonMot }), 'le mot')
  r = vues.repliqueRevelee = ok(await jouer(b, alice, r, { quoi: 'repondre', manche: 0, reponse: { replique: { qui: t0.bonneQui } } }), 'qui')
  r = await ouvrir(b, alice, r, 1)
  r = vues.repliquePause = ok(await jouer(b, alice, r, { quoi: 'pause', manche: 1 }), 'la pause du mot')
  apresLEcheance(r)
  r = vues.repliqueMotPerdu = ok(await jouer(b, alice, r, { quoi: 'repondre', manche: 1, auto: true }), 'le mot laissé au temps')
  r = await jouerUneRepliqueALaSeconde(r, 1, false)
  r = await ouvrir(b, alice, r, 2)
  r = ok(await jouer(b, alice, r, { quoi: 'mot', manche: 2, choix: repliqueDe(b, r.id, 2).bonMot }), 'le bon mot')
  ok(await jouer(b, alice, r, { quoi: 'quitter' }), 'quitter la Réplique au bon mot')
  vues.repliqueRelue = ok(await lire<VueDeLaPartie>(b, alice, `/api/cabinet/partie/${r.id}`), '« Mes réponses »')

  // Zoé n'a rien joué : ses murs sont vides.
  zoe = await inscrireProfil(b.banc.url, 'zoe', 'Zoé')
})
after(() => b?.banc.close())
after(fermerLesMagasins)

/** « Qui l'a dit ? » d'une manche dont le mot est déjà joué — ou perdu : la bonne personne, ou une autre. */
async function jouerUneRepliqueALaSeconde(v: VueDeLaPartie, k: number, juste: boolean) {
  const t = repliqueDe(b, v.id, k)
  const qui = juste ? t.bonneQui : (t.bonneQui + 1) % t.personnes.length
  return ok(await jouer(b, alice, v, { quoi: 'repondre', manche: k as 0 | 1 | 2, reponse: { replique: { qui } } }), 'qui l’a dite')
}

/** Les écrans des trois jeux, tels que la page les charge à la demande. */
async function ecrans() {
  const epingle = (await import(url('views/cabinet/jeux/Epingle.tsx'))).EPINGLE
  const indices = (await import(url('views/cabinet/jeux/Indices.tsx'))).INDICES
  const replique = (await import(url('views/cabinet/jeux/Replique.tsx'))).REPLIQUE
  return { epingle, indices, replique } as Record<
    string,
    {
      localDe: (m: unknown) => unknown
      cleDe: (m: unknown) => string
      aLEcheance: (m: unknown, l: unknown) => unknown
      Revelation: (p: object) => React.ReactNode
    }
  >
}

/** Une partie à l'écran, sur la vue du serveur : le chrono lu à son heure, ce que la page tient au départ de la manche. */
async function laPartie(vue: VueDeLaPartie, plus: Record<string, unknown> = {}) {
  const ecran = (await ecrans())[vue.jeu]
  const { chronoMontre } = await import(url('views/cabinet/Partie.tsx'))
  return rendu('views/cabinet/Partie', 'EcranDeLaPartie', {
    vue,
    ecran,
    local: vue.enCours ? ecran.localDe(vue.enCours) : null,
    setLocal: rien,
    chrono: chronoMontre(vue, vue.maintenant),
    busy: false,
    miser: null,
    garde: () => true,
    gardeDeLEcran: () => true,
    onGeste: rien,
    onQuitter: rien,
    onSuivante: rien,
    onMiser: rien,
    onSignaler: rien,
    onMusee: rien,
    ...plus,
  })
}

/** Le pied collé d'une partie rendue : ce qui est sous le pouce. */
const piedDe = (html: string) => html.slice(html.lastIndexOf('<div class="cab-pied-partie">'))

/** Un point du dessin, comme la carte l'écrit. */
async function surLeDessin(p: Point): Promise<{ x: number; y: number }> {
  return (await import(url('views/cabinet/contourDeLaFrance.ts'))).surLeDessin(p)
}

// ── 1. Les écrans, au registre ────────────────────────────────────────────

test('les neuf jeux ont leur écran, chacun à la demande — sans le pli ni la lecture des gestes, sans l’heure du téléphone, sans un chiffre du barème recopié', () => {
  const partie = source('views/cabinet/Partie.tsx')
  for (const jeu of CLES_DES_JEUX) assert.match(partie, new RegExp(`\\n  ${jeu}: aLaDemande\\(\\(\\) => import\\('\\./jeux/`), `${jeu} a son écran`)
  // De la règle de chaque jeu, qui juge, l'écran ne prend que des types et ce qu'elle exporte pour lui : la géométrie de la zone, la
  // question des Indices, la soudure d'une réplique — jamais le jugement ni Éclairer.
  for (const [jeu, regle, valeurs] of [
    ['Epingle', 'epingle', ['pointADistance']],
    ['Indices', 'indices', ['QUESTION_DES_INDICES']],
    ['Replique', 'replique', ['repliqueEntiere']],
  ] as const) {
    const s = source(`views/cabinet/jeux/${jeu}.tsx`)
    const deLaRegle = new RegExp(`import \\{([^}]*)\\} from '\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./shared/cabinet/jeux/${regle}'`).exec(s)
    assert.ok(deLaRegle, `${jeu}.tsx importe sa règle`)
    assert.deepEqual(
      deLaRegle[1]
        .split(',')
        .map(x => x.trim())
        .filter(x => x && !x.startsWith('type '))
        .sort(),
      [...valeurs],
      jeu,
    )
    const chemin = importsStatiques(path.join(client, `views/cabinet/jeux/${jeu}.tsx`))
    for (const f of ['shared/cabinet/partie.ts', 'shared/cabinet/jeux/index.ts', 'shared/cabinet/lecture.ts']) {
      assert.ok(!chemin.has(path.resolve(client, '../..', f)), `${f} ne part pas avec l’écran ${jeu}`)
    }
    const code = s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    assert.doesNotMatch(code, /Date\.now\(\)/, jeu)
    assert.doesNotMatch(s, /autoFocus/, jeu)
    assert.doesNotMatch(code, /★|\b\d+ km\b|\b\d étoiles?\b/, `${jeu} : un chiffre du barème s’importe, il ne se recopie pas`)
  }
  // Le refus d'un nom faux ne promet plus « une étoile de moins » : au premier indice, il n'en coûte pas (le barème du 25 octobre).
  assert.doesNotMatch(source('views/cabinet/jeux/Indices.tsx'), /étoile de moins/)
})

test('la carte de France et tes murs viennent à la demande : la page du musée ne les télécharge pas', () => {
  const chemin = importsStatiques(path.join(client, 'views/CabinetApp.tsx'))
  for (const f of ['views/cabinet/Murs.tsx', 'views/cabinet/CarteDeFrance.tsx', 'views/cabinet/contourDeLaFrance.ts']) {
    assert.ok(!chemin.has(path.join(client, f)), `${f} ne part pas avec le Cabinet`)
  }
  assert.match(source('views/CabinetApp.tsx'), /const LES_MURS = aLaDemande\(\(\) => import\('\.\/cabinet\/Murs'\)\)/)
  assert.match(source('views/CabinetApp.tsx'), /case 'murs':\s+return avecLeToast\(<MursALaDemande \/>\)/)
  // Le cadre dit à chaque révélation comment sa manche s'est tranchée : quittée au bon mot, la Réplique le dit.
  assert.match(source('views/cabinet/Partie.tsx'), /<ecran\.Revelation corps=\{r\.corps\} partie=\{vue\.id\} tirage=\{r\.tirage\} fin=\{r\.fin\} \/>/)
})

// ── 2. La carte de France ─────────────────────────────────────────────────

test('la carte de France : un toucher relu dans le cadre de l’Épingle, les flèches, et où est l’épingle, en mots', async () => {
  const { pointDuToucher, deplacer, ouEstLEpingle, dansLeCadre, VILLES_REPERES, MILIEU_DE_LA_FRANCE } = await import(url('views/cabinet/contourDeLaFrance.ts'))
  const dessin = { largeur: LARGEUR_DE_LA_CARTE, hauteur: HAUTEUR_DE_LA_CARTE }
  // La carte de toute la largeur d'un 360 × 640 : 324 pixels pour le dessin, où qu'elle soit dans la page.
  const rect = { left: 18, top: 300, width: 324, height: (324 * HAUTEUR_DE_LA_CARTE) / LARGEUR_DE_LA_CARTE }
  const lyon = VILLES_REPERES.find((v: { nom: string }) => v.nom === 'Lyon')!
  const { x, y } = projeter(lyon)
  const touche = pointDuToucher({ x: rect.left + (x * rect.width) / LARGEUR_DE_LA_CARTE, y: rect.top + (y * rect.height) / HAUTEUR_DE_LA_CARTE }, rect, dessin)
  assert.ok(distanceKm(touche, lyon) < 1, 'un toucher sur Lyon plante à Lyon')
  // Un pixel du doigt fait moins de cinq kilomètres : la grand-mère vise à quarante.
  const voisin = pointDuToucher({ x: rect.left + (x * rect.width) / LARGEUR_DE_LA_CARTE + 1, y: rect.top + (y * rect.height) / HAUTEUR_DE_LA_CARTE }, rect, dessin)
  assert.ok(distanceKm(touche, voisin) < 5, `${distanceKm(touche, voisin)} km par pixel`)
  // La mer de l'ouest, la marge des noms à l'est : un doigt posé là plante au bord du cadre, jamais hors de France.
  for (const coin of [{ x: rect.left, y: rect.top }, { x: rect.left + rect.width, y: rect.top + rect.height }, { x: rect.left + rect.width, y: rect.top }]) {
    const p = pointDuToucher(coin, rect, dessin)
    assert.ok(p.lat >= DANS_LA_FRANCE.latMin && p.lat <= DANS_LA_FRANCE.latMax && p.lon >= DANS_LA_FRANCE.lonMin && p.lon <= DANS_LA_FRANCE.lonMax, JSON.stringify(p))
  }
  assert.deepEqual(dansLeCadre({ lat: 60, lon: -20 }), { lat: DANS_LA_FRANCE.latMax, lon: DANS_LA_FRANCE.lonMin })
  // Au clavier : un pas d'une dizaine de kilomètres, cinq fois plus sous Maj, jamais hors du cadre.
  const pas = deplacer(MILIEU_DE_LA_FRANCE, 'ArrowUp')
  assert.ok(Math.abs(distanceKm(pas, MILIEU_DE_LA_FRANCE) - 11) < 1)
  assert.ok(Math.abs(distanceKm(deplacer(MILIEU_DE_LA_FRANCE, 'ArrowRight'), MILIEU_DE_LA_FRANCE) - 11) < 1, 'vers l’est aussi')
  assert.ok(Math.abs(distanceKm(deplacer(MILIEU_DE_LA_FRANCE, 'ArrowLeft', true), MILIEU_DE_LA_FRANCE) - 55) < 3, 'Maj : cinq pas')
  assert.equal(deplacer({ lat: DANS_LA_FRANCE.latMax, lon: 2 }, 'ArrowUp').lat, DANS_LA_FRANCE.latMax)
  // Où est l'épingle : près d'une ville repère, ou sa distance et sa direction — une ligne à elle seule, sa capitale en tête.
  assert.equal(ouEstLEpingle(lyon), 'Près de Lyon')
  const paris = VILLES_REPERES.find((v: { nom: string }) => v.nom === 'Paris')!
  assert.equal(ouEstLEpingle(pointADistance(paris, 120, 225)), 'À 120 km au sud-ouest de Paris')
  assert.equal(ouEstLEpingle(pointADistance(lyon, 63, 90)), 'À 60 km à l’est de Lyon')
})

test('la carte de France prend le doigt comme `toucher` : son écho ne rejoue ni la carte ni un bouton venu sous lui, et hors du dessin rien ne se plante', async () => {
  const { gestesDeLaCarte } = await import(url('views/cabinet/CarteDeFrance.tsx'))
  const { VILLES_REPERES } = await import(url('views/cabinet/contourDeLaFrance.ts'))
  const { toucher } = await import(url('toucher.ts'))
  const poses: Point[] = []
  let plantee = 0
  const gestes = gestesDeLaCarte({ epingle: null, poser: (p: Point) => poses.push(p), planter: () => plantee++, aide: '' })
  // En 1366 × 768, le dessin s'arrête à 460 pixels ; une page plus large que lui laisserait une bande de chaque côté.
  const hauteur = (460 * HAUTEUR_DE_LA_CARTE) / LARGEUR_DE_LA_CARTE
  const dessin = { left: 532, top: 300, right: 992, bottom: 300 + hauteur, width: 460, height: hauteur }
  const cadre = { ...dessin, left: 500, right: 1024, width: 524 }
  const currentTarget = { querySelector: () => ({ getBoundingClientRect: () => dessin }), getBoundingClientRect: () => cadre }
  const lyon = VILLES_REPERES.find((v: { nom: string }) => v.nom === 'Lyon')!
  const { x, y } = projeter(lyon)
  const surLyon = { clientX: dessin.left + (x * dessin.width) / LARGEUR_DE_LA_CARTE, clientY: dessin.top + (y * dessin.height) / HAUTEUR_DE_LA_CARTE, currentTarget }
  const doigt = (ou: object, timeStamp: number) => gestes.onPointerUp({ pointerType: 'touch', button: 0, timeStamp, ...ou })
  doigt(surLyon, 10_000)
  assert.equal(poses.length, 1)
  assert.ok(distanceKm(poses[0], lyon) < 1, 'le doigt levé sur Lyon y pose l’épingle')
  // Le `click` qui suit n'est que l'écho du doigt : il ne repose pas l'épingle, et le pied, qui a grandi d'une ligne, a pu faire
  // venir « Éclairer » sous lui — l'écho ne le joue pas non plus : il aurait dépensé la carte-bonus sans qu'on le veuille.
  gestes.onClick({ ...surLyon, timeStamp: 10_200 })
  assert.equal(poses.length, 1, 'l’écho ne repose pas l’épingle')
  let eclaire = 0
  toucher(() => eclaire++).onClick({ timeStamp: 10_200 } as never)
  assert.equal(eclaire, 0, 'l’écho du doigt sur la carte ne joue pas le bouton venu sous lui')
  // La souris garde son clic, bien après.
  gestes.onClick({ ...surLyon, timeStamp: 20_000 })
  assert.equal(poses.length, 2)
  // À côté du dessin — la bande vide, ou la marge d'un cadre plus large que lui —, ni le doigt ni la souris ne plantent : ramené
  // dans le cadre de l'Épingle, le point serait parti au bord de l'Atlantique, à des centaines de kilomètres de l'épingle posée.
  const aCote = { clientX: cadre.left + 10, clientY: surLyon.clientY, currentTarget }
  doigt(aCote, 30_000)
  gestes.onClick({ ...aCote, timeStamp: 40_000 })
  doigt({ ...surLyon, clientY: dessin.bottom + 4 }, 50_000)
  assert.equal(poses.length, 2, 'rien hors du dessin')
  // Au clavier : une flèche part du milieu de la France, Entrée plante.
  const touche = (key: string) => gestes.onKeyDown({ key, shiftKey: false, preventDefault: () => {} })
  touche('ArrowUp')
  assert.equal(poses.length, 3)
  touche('Enter')
  assert.equal(plantee, 1)
})

// ── 3. L'Épingle ──────────────────────────────────────────────────────────

test('une manche de l’Épingle : la date, le thème, le récit, la question, la carte de toute la largeur, « Planter ici » sous le pouce — jamais le lieu', async () => {
  const v = vues.epingle
  const m = v.enCours as EpingleMontree
  assert.equal(m.jeu, 'epingle')
  const html = await laPartie(v)
  const t = texte(html)
  assert.match(t, new RegExp(lu(`${m.date} · ${m.theme}`)))
  assert.match(t, new RegExp(lu(m.recit)))
  // La question est son titre, où le focus se pose quand la manche s'ouvre.
  const titre = /<h2 class="quiz-question cab-question[^"]*">(.*?)<\/h2>/.exec(html)
  assert.ok(titre, 'la question en titre')
  assert.equal(texte(titre[1]).trim(), texte(m.question.replace(/'/g, '’')).trim())
  assert.match(t, /Touche la carte de France pour planter ton épingle\./)
  // La carte : jouable au doigt et au clavier, son dessin entier — la métropole, la Corse, sept villes repères —, aucune épingle.
  assert.match(html, /<div class="cab-carte-de-france cab-carte-jouable" role="application" tabindex="0" aria-label="La carte de France" aria-describedby="[^"]+">/)
  assert.match(html, new RegExp(`<svg class="cab-carte-dessin" viewBox="0 0 ${LARGEUR_DE_LA_CARTE} ${HAUTEUR_DE_LA_CARTE}" aria-hidden="true">`))
  assert.equal([...html.matchAll(/<polygon class="cab-carte-terre"/g)].length, 2, 'la métropole et la Corse')
  for (const ville of ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Lille', 'Nantes', 'Strasbourg']) assert.match(html, new RegExp(`>${ville}</text>`), ville)
  assert.match(t, /Au clavier, les flèches la mènent, Maj à grands pas, et Entrée la plante\./)
  assert.doesNotMatch(html, /cab-carte-epingle|cab-carte-lieu|cab-carte-zone/)
  // Sous le pouce, collés : la carte-bonus qui sert encore, où est l'épingle — rien encore, la consigne le dit —, puis « Planter
  // ici », qui l'attend.
  const pied = piedDe(html)
  assert.ok(pied.startsWith('<div class="cab-pied-partie"><button type="button" class="btn btn-block cab-pouvoir">'), 'la carte-bonus d’abord')
  assert.match(pied, /<p class="cab-ou-est" aria-live="polite"><\/p>/)
  assert.match(pied, /<button type="button" class="btn btn-primary btn-big btn-block cab-planter" aria-disabled="true">Planter ici<\/button>/)
  // Jamais le lieu : ni sa commune, ni son département, ni ses coordonnées, ni sa place sur le dessin.
  const lieu = epingleDe(b, v.id, v.tirage!).lieu
  for (const secret of [lieu.commune, lieu.departement, String(lieu.lat), String(lieu.lon)]) assert.doesNotMatch(html, new RegExp(echapper(secret)), secret)
  const ici = await surLeDessin(lieu)
  assert.doesNotMatch(html, new RegExp(`${ici.x}[ ,]${ici.y}\\b`))
  sansJargon(html, 'une manche de l’Épingle', [m.recit, m.question, m.theme])
})

test('l’Épingle posée : sur la carte à sa place, dite par sa ville repère, « Planter ici » qui la plante — et elle part d’elle-même à l’échéance', async () => {
  const v = vues.epingle
  const m = v.enCours as EpingleMontree
  const { EPINGLE } = await import(url('views/cabinet/jeux/Epingle.tsx'))
  const lyon = { lat: 45.76, lon: 4.84 }
  const html = await laPartie(v, { local: { epingle: lyon } })
  const ici = await surLeDessin(lyon)
  assert.match(html, new RegExp(`<g class="cab-carte-epingle" transform="translate\\(${ici.x} ${ici.y}\\)">`))
  assert.match(texte(html), /Touche ailleurs pour déplacer ton épingle\./)
  const pied = piedDe(html)
  assert.match(texte(pied), /Ton épingle : Près de Lyon/)
  assert.match(pied, /<button type="button" class="btn btn-primary btn-big btn-block cab-planter">Planter ici<\/button>/)
  // La consigne garde sa place d'une épingle à l'autre : la carte ne glisse pas sous le doigt qui corrige (sa feuille, plus bas).
  assert.match(html, /<p class="cab-ligne cab-consigne-carte">/)
  // Revenu sur la carte, le lecteur d'écran entend la consigne, puis où est l'épingle — que le pied a dite en la posant.
  const aide = /aria-describedby="([^"]+)"/.exec(html)![1]
  assert.match(texte(new RegExp(`<p id="${echapper(aide)}" class="sr-only">(.*?)</p>`).exec(html)![1]), /Entrée la plante\. Ton épingle : Près de Lyon\./)
  // Ce que la page tient part à l'échéance ; sans épingle, rien : la manche se juge « Pas d'épingle ».
  assert.deepEqual(EPINGLE.aLEcheance(m, { epingle: lyon }), { epingle: lyon })
  assert.equal(EPINGLE.aLEcheance(m, { epingle: null }), undefined)
  assert.deepEqual(EPINGLE.localDe(m), { epingle: null })
  // « Changer » pose un autre lieu : l'épingle d'avant ne lui dit rien ; la zone d'Éclairer ne change pas la manche.
  assert.equal(EPINGLE.cleDe(m), EPINGLE.cleDe(vues.epingleEclairee.enCours))
  assert.notEqual(EPINGLE.cleDe(m), EPINGLE.cleDe({ ...m, question: `${m.question} encore` }))
})

test('l’Épingle éclairée : la zone entourée sur la carte, dite en mots — et la carte-bonus qui ne sert plus se pose sous la manche', async () => {
  const v = vues.epingleEclairee
  const m = v.enCours as EpingleMontree
  assert.ok(m.zone, 'Éclairer a donné sa zone')
  const html = await laPartie(v)
  // L'indice prend la place de la consigne, à sa hauteur gardée : la carte ne descend pas sous le doigt qui vient d'Éclairer.
  const consigne = /<p class="cab-ligne cab-consigne-carte cab-souffle">(.*?)<\/p>/.exec(html)
  assert.ok(consigne, 'l’indice à la place de la consigne')
  assert.match(texte(consigne[1]), /Indice : c’est quelque part dans la zone entourée\./)
  assert.equal([...html.matchAll(/cab-consigne-carte/g)].length, 1)
  const zone = /<polygon class="cab-carte-zone" points="([^"]+)"/.exec(html)
  assert.ok(zone, 'la zone est dessinée')
  // Son tour, pris sur la Terre : chaque point à son rayon du centre, et le lieu dedans.
  const { tourDeLaZone } = await import(url('views/cabinet/jeux/Epingle.tsx'))
  const tour: Point[] = tourDeLaZone(m.zone)
  assert.equal(tour.length, 24)
  for (const p of tour) assert.ok(Math.abs(distanceKm(p, m.zone) - m.zone.rayonKm) < 0.5)
  const lieu = epingleDe(b, v.id, v.tirage!).lieu
  assert.ok(distanceKm(lieu, m.zone) < m.zone.rayonKm, 'le lieu est dans la zone')
  assert.ok(html.indexOf('<div class="cab-pied-partie cab-pied-pose">') > 0, 'Coup d’œil a servi : posé sous la manche')
  assert.match(piedDe(html), /Planter ici/)
})

test('la révélation de l’Épingle : le lieu nommé, sa commune, sa date, la carte — le lieu, l’épingle, le trait, la zone — et la légende en mots', async () => {
  const v = vues.epingleSurLeLieu
  const r = v.revelation!.corps as EpingleRevelee
  assert.equal(r.jeu, 'epingle')
  const html = await laPartie(v)
  const t = texte(html)
  assert.match(html, /<h2 class="cab-titre-revele">À 0 km<\/h2>/)
  assert.match(t, new RegExp(lu(r.lieu.nom)))
  assert.match(t, new RegExp(lu(`${r.lieu.commune} (${r.lieu.departement}) · ${r.lieu.date}`)))
  assert.match(html, /<svg class="cab-carte-dessin" viewBox="[^"]+" role="img" aria-label="Le lieu et ton épingle, sur la carte de France">/)
  const lieu = await surLeDessin(r.lieu)
  assert.match(html, new RegExp(`<circle class="cab-carte-lieu" cx="${lieu.x}" cy="${lieu.y}" r="7">`))
  const epingle = await surLeDessin(r.epingle!)
  assert.match(html, new RegExp(`<g class="cab-carte-epingle" transform="translate\\(${epingle.x} ${epingle.y}\\)">`))
  assert.match(html, /<line class="cab-carte-trait"/)
  assert.match(html, /<polygon class="cab-carte-zone"/)
  assert.match(t, /le lieu ton épingle la zone d’Éclairer/)
  // Un lieu de l'Épingle n'est pas une question de la base : rien à signaler.
  assert.doesNotMatch(t, /Signaler/)
  // La deuxième, à deux cents kilomètres : leur distance au titre.
  assert.match(await laPartie(vues.epingleLoin), /<h2 class="cab-titre-revele">À (19\d|200) km<\/h2>/)
  // La troisième, laissée au temps sans épingle : le lieu seul, et la légende sans épingle.
  const sans = await laPartie(vues.epingleSans)
  assert.match(sans, /<h2 class="cab-titre-revele">Pas d’épingle<\/h2>/)
  assert.match(sans, /aria-label="Le lieu, sur la carte de France"/)
  assert.doesNotMatch(sans, /cab-carte-epingle|cab-carte-trait/)
  assert.doesNotMatch(texte(sans), /ton épingle/)
  sansJargon(html, 'la révélation de l’Épingle', [r.lieu.nom, r.savais])
})

// ── 4. Les Indices ────────────────────────────────────────────────────────

test('une manche des Indices : « Qui suis-je ? », ce que vaut la réponse, le premier indice, le champ au pied — jamais la réponse ni les indices cachés', async () => {
  const v = vues.indices
  const m = v.enCours as IndicesMontres
  assert.equal(m.jeu, 'indices')
  const html = await laPartie(v)
  const t = texte(html)
  assert.match(html, /<h2 class="quiz-question cab-question">Qui suis-je \?<\/h2>/)
  assert.match(html, /<p class="cab-vaut">Ta réponse vaut <span class="sentier-etoiles" role="img" aria-label="3 étoiles sur 3">/)
  assert.equal([...html.matchAll(/<li class="cab-indice">/g)].length, 1)
  assert.match(t, new RegExp(lu(m.indices[0])))
  assert.match(t, /1 indice sous tes yeux · encore 4 cachés/)
  // Au pied collé, dans un `.join` que le clavier du téléphone ne cache pas : le champ — aucun focus d'office —, et ses deux gestes.
  const pied = piedDe(html)
  assert.match(pied, /<form class="join cab-nom">/)
  const champ = /<input id="[^"]+" class="input" type="text"[^>]*\/>/.exec(pied)?.[0] ?? ''
  assert.ok(champ, 'le champ du nom')
  // Ni correcteur ni saisie semée de propositions : un nom propre ; « Envoyer » au clavier ; coupé au barème, comme au serveur.
  for (const a of ['placeholder="Ta réponse : un nom"', 'autoComplete="off"', 'autoCapitalize="words"', 'autoCorrect="off"', 'spellCheck="false"', 'enterKeyHint="send"', `maxLength="${SIGNES_D_UN_GESTE_MAX}"`, 'value=""']) {
    assert.ok(champ.includes(a), a)
  }
  assert.match(pied, /<label class="sr-only" for="[^"]+">Ta réponse : un nom<\/label>/)
  assert.match(pied, /<button type="button" class="btn">Un indice de plus<\/button>/)
  assert.match(pied, /<button type="button" class="btn btn-primary" aria-disabled="true">Répondre<\/button>/)
  // Un nom tapé : « Répondre » le prend.
  assert.match(piedDe(await laPartie(v, { local: { texte: 'Victor' } })), /<button type="button" class="btn btn-primary">Répondre<\/button>/)
  // Jamais la réponse, ses clés, ni les indices encore cachés.
  const fiche = ficheDe(b, v.id, v.tirage!).fiche
  for (const secret of [fiche.reponse, ...fiche.indices.slice(1)]) assert.doesNotMatch(t, new RegExp(lu(secret), 'i'), secret)
  for (const cle of fiche.cles) assert.doesNotMatch(t, new RegExp(`\\b${echapper(cle)}\\b`, 'i'), cle)
  sansJargon(html, 'une manche des Indices', fiche.indices)
})

test('un nom faux aux Indices : « Déjà essayé », le champ vidé, « Non » dit — et ce que vaut la réponse, lu de la vue, jamais « une étoile de moins »', async () => {
  const v = vues.indicesFaux
  const m = v.enCours as IndicesMontres
  assert.deepEqual(m.essayes, ['Personne Inconnue'])
  const html = await laPartie(v)
  const t = texte(html)
  assert.match(t, /Déjà essayé : Personne Inconnue/)
  // Un indice de plus, le dernier venu marqué d'un liseré : celui qu'on n'a pas encore lu.
  assert.deepEqual(
    [...html.matchAll(/<li class="(cab-indice[^"]*)">/g)].map(x => x[1]),
    ['cab-indice', 'cab-indice cab-indice-neuf'],
  )
  assert.match(html, new RegExp(`aria-label="${m.vaut} étoiles? sur 3"`), 'ce que vaut la réponse : celle de la vue')
  assert.doesNotMatch(t, /étoile de moins/)
  const pied = piedDe(html)
  const non = /<p class="cab-ligne cab-non" role="status">(.*?)<\/p>/.exec(pied)
  assert.ok(non, 'la ligne du refus, une région qui se dit')
  assert.equal(texte(non[1]).trim(), 'Non, ce n’est pas « Personne Inconnue ».')
  // Le nom refusé vide le champ (la manche change de clé) ; un indice de plus, demandé ou offert, laisse le nom qui s'écrivait.
  const { INDICES } = await import(url('views/cabinet/jeux/Indices.tsx'))
  assert.notEqual(INDICES.cleDe(vues.indices.enCours), INDICES.cleDe(m))
  assert.equal(INDICES.cleDe(m), INDICES.cleDe(vues.indicesOffert.enCours))
  assert.equal(INDICES.aLEcheance(m, { texte: 'Victor Hugo' }), undefined, 'un nom tapé et pas envoyé ne compte pas')
  // Un nom qui s'écrit : la ligne du refus se tait.
  assert.match(piedDe(await laPartie(v, { local: { texte: 'V' } })), /<p class="cab-ligne cab-non" role="status"><\/p>/)
  // L'indice offert par Éclairer se compte à part.
  assert.match(texte(await laPartie(vues.indicesOffert)), /3 indices sous tes yeux, dont 1 offert · encore 2 cachés/)
})

test('tous les indices vus : « Un indice de plus » s’éteint, la page le dit', async () => {
  const html = await laPartie(vues.indicesTousVus)
  assert.match(texte(html), /5 indices sous tes yeux · tous les indices sont là/)
  assert.match(piedDe(html), /<button type="button" class="btn" aria-disabled="true">Un indice de plus<\/button>/)
})

test('la révélation des Indices : trouvé, et avec quoi sous les yeux ; ou qui c’était — et les cinq indices', async () => {
  const trouve = await laPartie(vues.indicesTrouve)
  const r = vues.indicesTrouve.revelation!.corps as IndicesReveles
  assert.match(trouve, /<h2 class="cab-titre-revele">Trouvé<\/h2>/)
  assert.match(texte(trouve), new RegExp(lu(r.detail!)))
  assert.equal([...trouve.matchAll(/<li class="cab-indice">/g)].length, 5)
  const rate = await laPartie(vues.indicesRate)
  const r2 = vues.indicesRate.revelation!.corps as IndicesReveles
  assert.match(texte(rate), new RegExp(`C’était ${lu(r2.reponse)}`))
  assert.equal([...rate.matchAll(/<li class="cab-indice">/g)].length, 5)
  const fiche = ficheDe(b, vues.indicesTrouve.id, vues.indicesTrouve.revelation!.tirage!).fiche
  sansJargon(trouve, 'la révélation des Indices', [...fiche.indices, fiche.savais])
})

test('chaque nom des Indices retient le souffle de la niche — juste, ou faux au dernier indice, il tranche —, et le nom refusé le relâche', async () => {
  const { leGesteRetientLeSouffle, leSouffleSeRelache } = (await import(url('views/cabinet/Partie.tsx'))) as {
    leGesteRetientLeSouffle: (g: { quoi: string }) => boolean
    leSouffleSeRelache: (g: { quoi: string }, apres: VueDeLaPartie) => boolean
  }
  // Aux Indices, c'est un nom qui trouve la personne : sans souffle retenu, la partie ne se jouait pas pour la niche, et une forme
  // du compagnon atteinte au bilan ne le faisait pas sortir — le défaut que l'essai du Mot avait eu.
  const nom = { quoi: 'nom', manche: 0, texte: 'Personne Inconnue' }
  assert.ok(leGesteRetientLeSouffle(nom))
  // Refusé, il revient la manche encore à jouer, un indice de plus : le souffle se relâche jusqu'au nom suivant.
  assert.equal(vues.indicesFaux.phase, 'jouer')
  assert.ok(leSouffleSeRelache(nom, vues.indicesFaux))
  // Trouvé, ou faux quand tous les indices sont là : la révélation dit le verdict.
  assert.ok(!leSouffleSeRelache(nom, vues.indicesTrouve))
  assert.ok(!leSouffleSeRelache(nom, vues.indicesRate))
  // Un indice demandé ne tranche jamais, ni le mot de la Réplique : il ouvre « Qui l'a dit ? ».
  for (const quoi of ['indice', 'mot']) assert.ok(!leGesteRetientLeSouffle({ quoi }), quoi)
})

// ── 5. La Réplique ────────────────────────────────────────────────────────

test('la Réplique, première étape : la réplique et son trou, les quatre mots — rien de qui l’a dite', async () => {
  const v = vues.replique
  const m = v.enCours as RepliqueMontree
  assert.equal(m.etape, 1)
  const html = await laPartie(v)
  const t = texte(html)
  assert.match(html, /<h2 class="cab-question cab-surtitre">1 · Le mot qui manque<\/h2>/)
  // Le trou, et ce qui s'y soude (le point final), sur la même ligne : seul, le point passait à la ligne suivante.
  assert.match(html, /<blockquote class="cab-replique">[^<]*<span class="cab-insecable"><span class="cab-trou"><span class="sr-only">le mot qui manque<\/span><\/span>/)
  const plan = repliqueDe(b, v.id, v.tirage!)
  assert.equal([...html.matchAll(/<button type="button" class="ans-btn"/g)].length, 4)
  for (const mot of plan.mots) assert.match(t, new RegExp(lu(mot)), mot)
  // Ni qui l'a dite, ni les deux autres, ni d'où elle vient.
  for (const secret of [plan.replique.qui, ...plan.replique.autres, plan.replique.source]) assert.doesNotMatch(t, new RegExp(lu(secret)), secret)
  sansJargon(html, 'la Réplique', [m.avant, m.apres, ...plan.mots])
  // Éclairer efface un mauvais mot, en sourdine et dit tel à l'oreille ; jamais le bon.
  const eclairee = await laPartie(vues.repliqueEclairee)
  const efface = [...eclairee.matchAll(/<button type="button" class="ans-btn cab-effacee" aria-disabled="true">.*?<span class="ans-text">([^<]+)<\/span><span class="sr-only">, effacé<\/span><\/button>/g)].map(x => x[1])
  assert.equal(efface.length, 1)
  assert.notEqual(texte(efface[0]).trim(), plan.replique.mot)
})

test('la Réplique, seconde étape : le mot choisi dans le trou, les trois noms — jamais s’il était le bon ; le temps du mot écoulé, le trou reste vide', async () => {
  const v = vues.repliqueQui
  const m = v.enCours as RepliqueMontree
  assert.equal(m.etape, 2)
  const plan = repliqueDe(b, v.id, v.tirage!)
  const html = await laPartie(v)
  assert.match(html, /<h2 class="cab-question cab-surtitre">2 · Qui l’a dit \?<\/h2>/)
  const rempli = /<span class="cab-trou cab-trou-rempli">([^<]+)<\/span>/.exec(html)
  assert.ok(rempli, 'le mot choisi dans le trou')
  assert.equal(texte(rempli[1]).trim(), texte(plan.replique.mot.replace(/'/g, '’')).trim())
  assert.equal([...html.matchAll(/<button type="button" class="ans-btn"/g)].length, 3)
  for (const nom of plan.personnes) assert.match(texte(html), new RegExp(lu(nom)), nom)
  assert.doesNotMatch(html, /bon mot|cab-repondu/i, 'rien ne dit si le mot était le bon')
  // Le temps du mot écoulé, sous « Quitter ? » : « Qui l'a dit ? » s'ouvre quand même, le trou vide.
  const perdu = await laPartie(vues.repliqueMotPerdu)
  assert.match(texte(perdu), /Temps écoulé pour le mot\./)
  assert.match(perdu, /<span class="cab-trou"><span class="sr-only">le mot qui manque<\/span><\/span>/)
  assert.match(texte(perdu), /2 · Qui l’a dit \?/)
})

test('la réponse partie d’elle-même à l’échéance du mot ferme « Quitter ? » : l’étape a tourné sous elle — chaque étape son écran', async () => {
  const { laReponseTourneLaPage } = await import(url('views/cabinet/Partie.tsx'))
  assert.equal(vues.repliquePause.phase, 'pause')
  assert.equal(vues.repliqueMotPerdu.phase, 'jouer')
  assert.equal(laReponseTourneLaPage(vues.repliquePause, vues.repliqueMotPerdu), true)
  // Revenue sur la même étape — l'autre onglet l'a rejouée —, la confirmation reste ouverte.
  assert.equal(laReponseTourneLaPage(vues.repliquePause, vues.repliquePause), false)
  // L'étape change la clé de la manche : chaque étape repart de zéro.
  const { REPLIQUE } = await import(url('views/cabinet/jeux/Replique.tsx'))
  assert.notEqual(REPLIQUE.cleDe(vues.replique.enCours), REPLIQUE.cleDe(vues.repliqueQui.enCours))
  assert.equal(REPLIQUE.aLEcheance(vues.replique.enCours, null), undefined, 'rien ne part à l’échéance : le serveur a déjà le mot')
})

test('la révélation de la Réplique : la réplique entière, qui l’a dite et d’où, ce qu’il avait répondu — et quittée au bon mot, elle le dit', async () => {
  const v = vues.repliqueRevelee
  const r = v.revelation!.corps as RepliqueRevelee
  const html = await laPartie(v)
  const t = texte(html)
  assert.match(html, /<h2 class="cab-titre-revele">Le bon mot<\/h2>/)
  assert.match(t, new RegExp(lu(`« ${r.entiere} »`)))
  assert.match(t, new RegExp(lu(`${r.qui} · ${r.source}`)))
  assert.match(t, new RegExp(`Le mot : « ${lu(r.repondu.mot!)} », juste`))
  assert.match(t, new RegExp(`Qui l’a dit : ${lu(r.repondu.qui!)}, juste`))
  assert.doesNotMatch(t, /quittée/i)
  sansJargon(html, 'la révélation de la Réplique', [r.entiere, r.source, r.qui, r.savais])
  // La partie relue — celle de « Mes réponses » —, quittée au bon mot : la troisième manche se titre « Le bon mot », et ne rapporte
  // rien. L'écran de la Réplique le dit, de ce que la vue en sait (`RevelationVue.fin`) — à condition qu'on le lui passe : le cadre
  // le fait, « Mes réponses » (`Bilan.tsx`) pas encore, et c'est le seul écran qui montre une manche quittée.
  const relue = vues.repliqueRelue
  const derniere = relue.manches[2].revelation!
  assert.equal(derniere.fin, 'quittee')
  assert.equal((derniere.corps as RepliqueRevelee).bonMot, true)
  assert.equal(relue.manches[2].etoiles, 0)
  const { replique: REPLIQUE } = await ecrans()
  const { renderToStaticMarkup } = await import('react-dom/server')
  const quittee = renderToStaticMarkup(React.createElement(REPLIQUE.Revelation as React.FC<Record<string, unknown>>, { corps: derniere.corps, fin: derniere.fin, partie: relue.id }))
  assert.match(texte(quittee), /Manche quittée avant « Qui l’a dit \? » : même le bon mot ne compte pas\./)
  assert.match(texte(quittee), /Qui l’a dit : pas de réponse/)
  // Le cadre la lui passe : le bandeau et le corps le disent. (Une partie quittée s'ouvre sur son bilan : le cadre ne montre une
  // manche quittée qu'ici, rendu à la main.)
  const cadre = await rendu('views/cabinet/Partie', 'RevelationDeLaManche', { vue: relue, revelation: derniere, ecran: REPLIQUE, onSignaler: rien })
  assert.match(texte(cadre), /Manche quittée .*même le bon mot ne compte pas/)
})

// ── 6. Tes murs ───────────────────────────────────────────────────────────

test('tes murs ont leur adresse, `api.cabinet.murs` les demande au serveur, et les règles y mènent en fermant leur feuille', async () => {
  const { ecranDeLAdresse, adresseDe } = await import(url('views/cabinet/ecrans.ts'))
  assert.equal(adresseDe({ e: 'murs' }), '#murs')
  assert.deepEqual(ecranDeLAdresse('#murs'), { e: 'murs' })
  const { api } = await import(url('api.ts'))
  const avant = globalThis.fetch
  const adresses: string[] = []
  globalThis.fetch = ((u: string, init: RequestInit = {}) => {
    adresses.push(u)
    return avant(`${b.banc.url}${u}`, { ...init, headers: { ...(init.headers as object), Cookie: rose } })
  }) as typeof fetch
  try {
    const murs = (await api.cabinet.murs()) as MursDuCabinet
    assert.deepEqual(adresses, ['/api/cabinet/murs'])
    assert.equal(murs.lieux.length, 3)
  } finally {
    globalThis.fetch = avant
  }
  const regles = await rendu('views/cabinet/Regles', 'Regles', { jeux: CLES_DES_JEUX })
  assert.match(regles, /<a class="cab-lien-en-ligne" href="#murs">tes murs<\/a>/)
  assert.match(source('views/cabinet/Regles.tsx'), /<Regles jeux=\{jeux\} parties=\{parties\} onMurs=\{onFermer\} \/>/)
})

/** Le dessin de tes murs, tel que la page le charge à la demande. */
const dessinDesMurs = async () => (await import(url('views/cabinet/Murs.tsx'))).LesMurs

test('tes murs : chaque lieu épinglé sur la carte de France et en mots, ta frise du plus ancien au plus récent', async () => {
  const murs = ok(await lire<MursDuCabinet>(b, rose, '/api/cabinet/murs'), 'les murs de Rose')
  assert.equal(murs.lieux.length, 3)
  assert.equal(murs.dates.length, 7)
  const html = await rendu('views/CabinetApp', 'EcranDesMurs', { etat: { etat: 'lus', murs }, dessin: await dessinDesMurs() })
  const t = texte(html)
  assert.match(html, /<h1>Tes murs<\/h1>/)
  assert.match(html, /<svg class="cab-carte-dessin" viewBox="[^"]+" role="img" aria-label="Ta carte de France : 3 lieux épinglés">/)
  for (const l of murs.lieux) {
    const ici = await surLeDessin(l)
    assert.match(html, new RegExp(`<circle class="cab-carte-lieu" cx="${ici.x}" cy="${ici.y}" r="5">`), l.id)
    assert.match(t, new RegExp(`${lu(l.nom)} ${lu(`${l.commune} (${l.departement}) · ${l.date}`)}`), l.id)
  }
  // La frise : chaque date à son année, dans l'ordre que le serveur rend — du plus ancien au plus récent.
  const annees = [...html.matchAll(/<li class="cab-evenement"><b class="cab-annee">([^<]+)<\/b>/g)].map(x => x[1])
  assert.deepEqual(annees, murs.dates.map(d => anneeDite(d.annee)))
  assert.ok(t.indexOf('↑ Plus ancien') < t.indexOf('↓ Plus récent'))
  assert.match(html, /<ol class="cab-frise" aria-label="Ta frise, du plus ancien au plus récent">/)
  sansJargon(html, 'tes murs', [...murs.lieux.map(l => l.nom), ...murs.dates.map(d => d.libelle)])
})

test('des murs vides le disent, la page qui les attend aussi, et une panne a son « Réessayer »', async () => {
  const vides = ok(await lire<MursDuCabinet>(b, zoe, '/api/cabinet/murs'), 'les murs de Zoé')
  assert.deepEqual(vides, { lieux: [], dates: [] })
  const dessin = await dessinDesMurs()
  const html = await rendu('views/CabinetApp', 'EcranDesMurs', { etat: { etat: 'lus', murs: vides }, dessin })
  const t = texte(html)
  assert.match(t, /Encore vide : une partie de l’Épingle la commencera\./)
  assert.match(t, /Encore vide : une partie de la Frise la commencera\./)
  assert.match(html, /aria-label="Ta carte de France : 0 lieu épinglé"/)
  // En route : les murs que le serveur n'a pas encore dits, ou leur dessin pas encore venu.
  assert.match(await rendu('views/CabinetApp', 'EcranDesMurs', { etat: { etat: 'chargement' }, dessin }), /aria-busy="true">Chargement…/)
  assert.match(await rendu('views/CabinetApp', 'EcranDesMurs', { etat: { etat: 'lus', murs: vides }, dessin: null }), /aria-busy="true">Chargement…/)
  const perdu = await rendu('views/CabinetApp', 'EcranDesMurs', { etat: { etat: 'perdu', motif: 'Pas de réseau' }, dessin, onRelire: rien })
  assert.match(perdu, /<p class="error">Pas de réseau<\/p>/)
  assert.match(perdu, />Réessayer<\/button>/)
  // Le dessin perdu en route — le navigateur garde l'échec d'un `import()` : recharger seul le redemande.
  assert.match(texte(await rendu('views/CabinetApp', 'EcranDesMurs', { etat: { etat: 'lus', murs: vides }, dessin: 'perdu' })), /Tes murs ne se sont pas chargés : recharge la page\./)
})

test('tes murs gardent leur titre quand leur dessin arrive : le focus que la page y a posé ne tombe pas sur la page', async () => {
  // La page pose le focus au titre de l'écran qui s'ouvre (`rendreLeFocus`), le dessin encore en route ; s'il remplaçait l'écran
  // d'attente à son arrivée, React démontait le titre, et le lecteur d'écran perdait sa place. Le cadre est le même élément, d'un
  // bout à l'autre : seul ce qu'il y a sous le titre change.
  const app = source('views/CabinetApp.tsx')
  const corps = /\nfunction MursALaDemande\(\) \{\n([^]*?)\n\}\n/.exec(app)?.[1] ?? ''
  assert.ok(corps, 'MursALaDemande')
  assert.equal([...corps.matchAll(/\breturn\s*(?:<|\(\s*<)/g)].length, 1, 'un seul rendu, quoi qu’il soit venu')
  assert.match(corps, /return <EcranDesMurs etat=\{etat\} dessin=\{dessin\} onRelire=\{lire\} \/>/)
  // Ce qui précède ce qui change — la sortie, le titre — s'écrit pareil avant et après.
  const vides = { lieux: [], dates: [] }
  const avant = await rendu('views/CabinetApp', 'EcranDesMurs', { etat: { etat: 'chargement' }, dessin: null })
  const apres = await rendu('views/CabinetApp', 'EcranDesMurs', { etat: { etat: 'lus', murs: vides }, dessin: await dessinDesMurs() })
  const tete = (html: string) => html.slice(0, html.indexOf('</h1>'))
  assert.ok(tete(avant).includes('Tes murs'))
  assert.equal(tete(avant), tete(apres))
  // Les murs se demandent avec leur dessin, pas après lui : l'un n'attend pas l'autre.
  assert.match(corps, /useALaDemande\(LES_MURS\)/)
  assert.match(corps, /api\.cabinet\.murs\(\)/)
})

// ── 7. La feuille ─────────────────────────────────────────────────────────

test('la feuille de la carte et des trois jeux : la carte de toute la largeur, ses noms à dix-sept pixels au téléphone, rien qui glisse sous le doigt', () => {
  const css = readFileSync(path.join(client, 'styles.css'), 'utf8')
  const debut = css.indexOf('/* ── Le Cabinet de curiosités')
  const section = css.slice(debut, css.indexOf('/* ── ', debut + 10)).replace(/\/\*[\s\S]*?\*\//g, '')
  // Toute la largeur : 320 pixels de page en 360 × 640, deux de plus de chaque côté — 324 pour le dessin ; 460 au plus, centrée,
  // la carte qu'on touche aussi large que son dessin : plus large, elle laissait de chaque côté une bande vide où le doigt plantait
  // au bord du cadre de l'Épingle, dans l'Atlantique.
  assert.match(section, /\.cab-carte-de-france \{ margin: 0 max\(-2px, \(100% - 460px\) \/ 2\); \}/)
  assert.match(section, /\.cab-carte-dessin \{ display: block; width: 100%; height: auto; \}/)
  // Où est l'épingle, au pied : une ligne gardée dès avant la première — remplie, elle faisait monter le pied de 25 pixels sur la
  // carte, et l'écho du doigt tombait sur la carte-bonus venue sous lui.
  assert.match(section, /\.cab-ou-est \{[^}]*min-height: [^;]+;/)
  // Les noms des villes, en unités du dessin : rendus à 324 pixels de large, dix-sept pixels au moins.
  const nom = /\.cab-carte-ville text \{[^}]*font-size: (\d+)px;/.exec(section)
  assert.ok(nom, 'les noms des villes ont leur taille')
  assert.ok((Number(nom[1]) * 324) / LARGEUR_DE_LA_CARTE >= 17, `${nom[1]} unités font ${(Number(nom[1]) * 324) / LARGEUR_DE_LA_CARTE} pixels`)
  // Au doigt : rien ne se surligne ni n'ouvre de menu, et la page défile à travers elle.
  assert.match(section, /\.cab-carte-jouable \{[^}]*touch-action: manipulation;[^}]*user-select: none;[^}]*-webkit-touch-callout: none;/)
  // Au-dessus de la carte, rien ne change de hauteur d'une épingle à l'autre.
  assert.match(section, /\.cab-consigne-carte \{ min-height: calc\(2 \* 1\.45em\);/)
  // Le champ des Indices dans un `.join` — que le clavier du téléphone ne cache pas —, sans rien de la mise en page d'une entrée.
  assert.match(section, /\.join\.cab-nom \{ width: 100%; min-height: 0; margin: 0; padding: 0;/)
  assert.match(section, /\.cab-page \.input \{[^}]*font-size: 1\.0625rem;/)
})
