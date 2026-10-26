// Les écrans des trois jeux au contenu neuf du Cabinet — l'Épingle, les
// Indices, la Réplique — et tes murs, rendus en HTML (`renderToStaticMarkup`)
// sur les vues qu'un vrai serveur rend à des joueurs qui jouent par les routes,
// les réponses lues dans le plan en base. Un fichier à part de
// `cabinet-ecran.test.ts`, qui tient le musée et les six premiers jeux — l'unité
// accordée du Filet et son échéance sans un geste s'écrivent pourtant ici,
// après la tablée du 26 octobre 2026 — : chacun sous la minute (règle
// `tests.md`). Sans navigateur : seul le premier rendu se lit ; les écrans se
// regardent au téléphone par la skill `regarder-le-rendu`.
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
  laPage,
  lire,
  ok,
  ouvrir,
  repliqueDe,
  type BancDuCabinet,
} from './cabinet-banc'
import { importsStatiques } from './chemin-des-imports'
import { GRACE_D_UNE_MANCHE_MS, KM_DE_L_EPINGLE, SIGNES_D_UN_GESTE_MAX } from '../../shared/cabinet/bareme'
import { DANS_LA_FRANCE, HAUTEUR_DE_LA_CARTE, LARGEUR_DE_LA_CARTE, distanceKm, projeter, type Point } from '../../shared/cabinet/france'
import { pointADistance, type EpingleMontree, type EpingleRevelee } from '../../shared/cabinet/jeux/epingle'
import type { Lieu } from '../../shared/cabinet/contenu'
import type { FiletMontre, FiletRevele } from '../../shared/cabinet/jeux/filet'
import type { IndicesMontres, IndicesReveles } from '../../shared/cabinet/jeux/indices'
import type { RepliqueMontree, RepliqueRevelee } from '../../shared/cabinet/jeux/replique'
import { CLES_DES_JEUX } from '../../shared/cabinet/jeux/regle'
import type { MursDuCabinet, VueDeLaPartie } from '../../shared/cabinet/vues'
import { anneeDite } from '../../shared/frise'
import { espacesFines } from '../../shared/typographie'

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

/** Les écrans des trois jeux, tels que la page les charge à la demande — et celui du Filet, pour son unité et son échéance. */
async function ecrans() {
  const epingle = (await import(url('views/cabinet/jeux/Epingle.tsx'))).EPINGLE
  const indices = (await import(url('views/cabinet/jeux/Indices.tsx'))).INDICES
  const replique = (await import(url('views/cabinet/jeux/Replique.tsx'))).REPLIQUE
  const filet = (await import(url('views/cabinet/jeux/Filet.tsx'))).FILET
  return { epingle, indices, replique, filet } as Record<
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

/** Le dessin de la carte de France d'une page rendue — la mer, la terre, les villes repères. */
const dessinDe = (html: string) => /<svg class="cab-carte-dessin"[\s\S]*?<\/svg>/.exec(html)?.[0] ?? ''
/** La tête d'une partie rendue : ses comptes, « Quitter » et le chrono. */
const teteDe = (html: string) => /<header class="cab-tete-partie">[\s\S]*?<\/header>/.exec(html)?.[0] ?? ''

/**
 * Ce qu'une page rendue écrit du lieu d'une manche : sa commune, son département, sa latitude, sa longitude, sa place sur le
 * dessin. Hors de ce qui ne dépend pas du lieu mais en écrit les mots — le dessin (« Lyon », le 85.3,243.6 de son contour), la
 * tête (« Manche 1 sur 3 »), les tracés des icônes —, et un mot entre ses lettres, un nombre entre ses chiffres : cherché en
 * sous-chaîne dans la page entière, le lieu rougissait l'épreuve selon le tirage, huit sur quatre-vingt-dix — l'affaire Calas
 * (43.6), la mère Brazier (Lyon), la fonderie de Villedieu (la Manche).
 */
async function ceQuiDitLeLieu(html: string, lieu: Lieu): Promise<string[]> {
  const reste = html
    .replace(dessinDe(html), '')
    .replace(teteDe(html), '')
    .replace(/<svg class="icon"[\s\S]*?<\/svg>/g, '')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
  const mot = (s: string) => new RegExp(`(?<![\\p{L}\\p{N}])${echapper(s)}(?![\\p{L}\\p{N}])`, 'u')
  const nombre = (n: number) => `(?<![\\w.])${echapper(String(n))}(?!\\w|\\.\\d)`
  const ici = await surLeDessin(lieu)
  const secrets: [string, RegExp][] = [
    [lieu.commune, mot(lieu.commune)],
    [lieu.departement, mot(lieu.departement)],
    [String(lieu.lat), new RegExp(nombre(lieu.lat))],
    [String(lieu.lon), new RegExp(nombre(lieu.lon))],
    [`${ici.x} ${ici.y}`, new RegExp(`${nombre(ici.x)}[ ,]${nombre(ici.y)}`)],
  ]
  return secrets.filter(([, r]) => r.test(reste)).map(([s]) => s)
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
  assert.match(t, /Au clavier, les flèches la mènent — un pas fait \d+ km, un grand \d+ —, Maj à grands pas, et Entrée la plante\./)
  assert.doesNotMatch(html, /cab-carte-epingle|cab-carte-lieu|cab-carte-zone/)
  // Sous le pouce, collés : la carte-bonus qui sert encore, puis « Pas à pas », fermé, et « Planter ici », qui attend une épingle.
  // Où est l'épingle ne s'y dit plus — la consigne, au-dessus de la carte, en tient la place —, et les pas de l'épingle attendent
  // qu'on les ouvre : le pied plus court laisse la question et la carte tenir ensemble entre la tête et lui (la tablée du
  // 25 octobre 2026 : 381 px demandés pour une bande de 277).
  const pied = piedDe(html)
  assert.ok(pied.startsWith('<div class="cab-pied-partie"><button type="button" class="btn btn-block cab-pouvoir">'), 'la carte-bonus d’abord')
  assert.doesNotMatch(pied, /cab-ou-est|cab-pas-de-l-epingle/)
  assert.match(pied, /<div class="cab-planter-ici"><button type="button" class="btn cab-pas-a-pas" aria-expanded="false">Pas à pas<\/button><button type="button" class="btn btn-primary btn-big cab-planter" aria-disabled="true">Planter ici<\/button><\/div>/)
  assert.match(html, /<p class="cab-ligne cab-consigne-carte" aria-live="polite">Touche la carte de France pour planter ton épingle\.<\/p>/)
  // Jamais le lieu : ni sa commune, ni son département, ni ses coordonnées, ni sa place sur le dessin. Le dessin et la tête n'en
  // disent rien — le même dessin à la troisième manche, d'un autre lieu ; la même tête aux Indices, qui n'en ont pas —, et la
  // recherche les écarte (`ceQuiDitLeLieu`) ; elle trouve pourtant chacun des cinq secrets glissé dans la page.
  const lieu = epingleDe(b, v.id, v.tirage!).lieu
  const ailleurs = vues.epingleTroisieme
  assert.notEqual(epingleDe(b, ailleurs.id, ailleurs.tirage!).lieu.id, lieu.id, 'la troisième manche a un autre lieu')
  assert.equal(dessinDe(await laPartie(ailleurs)), dessinDe(html), 'le dessin ne dépend pas du lieu')
  // Au même chrono : rendues à l'heure du téléphone, deux échéances différentes y écriraient deux secondes différentes.
  assert.equal(teteDe(await laPartie({ ...vues.indices, chrono: v.chrono, maintenant: v.maintenant })), teteDe(html), 'la tête ne dépend pas du jeu')
  assert.deepEqual(await ceQuiDitLeLieu(html, lieu), [], 'la manche ne dit rien du lieu')
  const ici = await surLeDessin(lieu)
  const fuite = `<p data-lieu="${lieu.lat},${lieu.lon}">${lieu.commune} (${lieu.departement})</p><g transform="translate(${ici.x} ${ici.y})"></g>`
  assert.equal((await ceQuiDitLeLieu(html.replace('</h2>', `</h2>${fuite}`), lieu)).length, 5, 'chaque secret glissé se trouve')
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
  // Où est l'épingle, à la place de la consigne au-dessus de la carte — sa hauteur gardée : la carte ne glisse pas sous le doigt qui
  // corrige (sa feuille, plus bas) —, dite à l'oreille à chaque épingle posée, d'un toucher, d'une flèche ou d'un pas.
  const consigne = /<p class="cab-ligne cab-consigne-carte cab-ou-est" aria-live="polite">(.*?)<\/p>/.exec(html)
  assert.ok(consigne, 'où est l’épingle, à la place de la consigne')
  assert.equal(texte(consigne[1]).trim(), 'Ton épingle : Près de Lyon')
  assert.equal([...html.matchAll(/cab-consigne-carte/g)].length, 1)
  const pied = piedDe(html)
  assert.doesNotMatch(pied, /cab-ou-est|Près de Lyon/)
  assert.match(pied, /<button type="button" class="btn btn-primary btn-big cab-planter">Planter ici<\/button>/)
  // Revenu sur la carte, le lecteur d'écran entend la consigne, ce qui la mène sans clavier, puis où est l'épingle — que la
  // consigne a dite en la posant.
  const aide = /aria-describedby="([^"]+)"/.exec(html)![1]
  assert.match(
    texte(new RegExp(`<p id="${echapper(aide)}" class="sr-only">(.*?)</p>`).exec(html)![1]),
    /Entrée la plante\. Sans clavier, « Pas à pas », au bas de l’écran, ouvre les boutons qui la mènent, et « Partir de… », qui la pose sur une ville\. Ton épingle : Près de Lyon\./,
  )
  // Ce que la page tient part à l'échéance ; sans épingle, rien : la manche se juge « Pas d'épingle ».
  assert.deepEqual(EPINGLE.aLEcheance(m, { epingle: lyon }), { epingle: lyon })
  assert.equal(EPINGLE.aLEcheance(m, { epingle: null }), undefined)
  // Au départ d'une manche : pas d'épingle, et les boutons de direction fermés, à petits pas.
  assert.deepEqual(EPINGLE.localDe(m), { epingle: null, grands: false, pasAPas: false })
  // « Changer » pose un autre lieu : l'épingle d'avant ne lui dit rien ; la zone d'Éclairer ne change pas la manche.
  assert.equal(EPINGLE.cleDe(m), EPINGLE.cleDe(vues.epingleEclairee.enCours))
  assert.notEqual(EPINGLE.cleDe(m), EPINGLE.cleDe({ ...m, question: `${m.question} encore` }))
})

test('l’Épingle sans clavier : « Pas à pas » ouvre quatre pas, nord, sud, ouest, est, et la bascule des grands pas, au pied — de la France entière à la Corse', async () => {
  // Sous TalkBack, un double toucher plante au centre de la carte, et seules les flèches la mènent (Hugo, à la tablée du
  // 25 octobre 2026) : ces boutons font au doigt ce que font les flèches, d'où qu'en soit l'épingle — du milieu de la France s'il
  // n'y en a pas encore. Fermés d'office, derrière « Pas à pas », sur la ligne de « Planter ici » : ouverts, avec la carte-bonus,
  // le pied ne laissait plus voir la question et la carte ensemble en 277 × 492.
  const v = vues.epingle
  const ferme = piedDe(await laPartie(v))
  assert.match(ferme, /<button type="button" class="btn cab-pas-a-pas" aria-expanded="false">Pas à pas<\/button>/)
  assert.doesNotMatch(ferme, /Vers le nord|Grands pas/)
  const ouvert = { epingle: null, grands: false, pasAPas: true }
  const pied = piedDe(await laPartie(v, { local: ouvert }))
  // Ouverts, au-dessus de la ligne de « Planter ici », que « Pas à pas » désigne — avec « Partir de… », au-dessus d'eux.
  const rangee = /<div id="([^"]+)" class="cab-pas-de-l-epingle" role="group" aria-label="Mener l’épingle pas à pas">(.*?)<\/div><div class="cab-planter-ici">/.exec(pied)
  assert.ok(rangee, 'les pas, au-dessus de « Planter ici »')
  assert.match(pied, new RegExp(`<button type="button" class="btn cab-pas-a-pas" aria-expanded="true" aria-controls="[^"]+ ${echapper(rangee[1])}">Pas à pas</button>`))
  const pas = rangee[2]
  const noms = [...pas.matchAll(/<button type="button" class="([^"]+)"[^>]*aria-label="([^"]+)"/g)].map(m => m[2])
  assert.deepEqual(noms, ['Vers l’ouest', 'Vers le nord', 'Vers le sud', 'Vers l’est', 'Grands pas, 55 km'])
  // La bascule : un nom fixe — ce que vaut un grand pas compris —, l'état par `aria-pressed`, petits pas d'office.
  assert.match(pas, /<button type="button" class="cab-pas cab-pas-grands" aria-label="Grands pas, 55 km" aria-pressed="false">/)
  assert.match(piedDe(await laPartie(v, { local: { ...ouvert, grands: true } })), /aria-label="Grands pas, 55 km" aria-pressed="true"/)
  // Chacun mène l'épingle comme sa flèche — `deplacer`, la règle même du clavier —, et Planter ici la plante.
  const { EPINGLE, pasDeLEpingle } = await import(url('views/cabinet/jeux/Epingle.tsx'))
  const { deplacer, MILIEU_DE_LA_FRANCE } = await import(url('views/cabinet/contourDeLaFrance.ts'))
  assert.deepEqual(EPINGLE.localDe(v.enCours), { epingle: null, grands: false, pasAPas: false })
  assert.deepEqual(pasDeLEpingle(ouvert, 'ArrowUp'), { epingle: deplacer(MILIEU_DE_LA_FRANCE, 'ArrowUp', false), grands: false, pasAPas: true })
  const lyon = { lat: 45.76, lon: 4.84 }
  assert.deepEqual(pasDeLEpingle({ ...ouvert, epingle: lyon, grands: true }, 'ArrowRight'), { epingle: deplacer(lyon, 'ArrowRight', true), grands: true, pasAPas: true })
  // De la France entière à Corte, en grands pas, chacun vers le plus près : moins de vingt — et à moins de quarante kilomètres, ce
  // qui vaut trois étoiles.
  const corte = { lat: 42.31, lon: 9.15 }
  let ici = { epingle: null as Point | null, grands: true, pasAPas: true }
  let n = 0
  for (; n < 30; n++) {
    if (ici.epingle && distanceKm(ici.epingle, corte) < 40) break
    const essais = (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const).map(f => pasDeLEpingle(ici, f))
    ici = essais.sort((a, c) => distanceKm(a.epingle!, corte) - distanceKm(c.epingle!, corte))[0]
  }
  assert.ok(n < 20, `${n} grands pas jusqu’à Corte`)
  // Au doigt, chacun par `toucher` (l'écho d'un doigt ne rejoue pas un pas), et la cible d'un doigt.
  assert.doesNotMatch(pas, /onClick/)
  const section = readFileSync(path.join(client, 'styles.css'), 'utf8')
  assert.match(section, /\n\.cab-pas \{[^}]*width: 44px; height: 44px;/)
  // « Pas à pas » et « Planter ici » sur une ligne, sans un pixel de plus au pied ; ouvert, l'or pâle des choix, au bronze du survol.
  assert.match(section, /\n\.cab-planter-ici \{ display: flex; gap: 8px; \}/)
  assert.match(section, /\n\.cab-page \.cab-pas-a-pas\[aria-expanded='true'\] \{[^}]*background: var\(--accent-soft\); color: var\(--accent-text-hover\);/)
  // L'épingle posée par un pas se dit, comme d'un toucher : la consigne au-dessus de la carte est une région qui se dit.
  assert.match(texte(await laPartie(v, { local: pasDeLEpingle(ouvert, 'ArrowUp') })), /Ton épingle : /)
})

test('l’Épingle éclairée : la zone entourée sur la carte, dite en mots — et la carte-bonus qui ne sert plus se pose sous la manche', async () => {
  const v = vues.epingleEclairee
  const m = v.enCours as EpingleMontree
  assert.ok(m.zone, 'Éclairer a donné sa zone')
  const html = await laPartie(v)
  // L'indice prend la place de la consigne, à sa hauteur gardée : la carte ne descend pas sous le doigt qui vient d'Éclairer.
  const consigne = /<p class="cab-ligne cab-consigne-carte cab-souffle" aria-live="polite">(.*?)<\/p>/.exec(html)
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
  // Une épingle posée avant Éclairer : la ligne dit d'abord la zone qui vient d'arriver — elle disait toujours l'épingle, et au
  // lecteur d'écran rien n'annonçait la zone (la relecture du lot page-1) — ; l'épingle bougée ensuite, où elle est. L'une après
  // l'autre, la plus neuve des deux, dans la même région qui se dit.
  const { poserLEpingle } = await import(url('views/cabinet/jeux/Epingle.tsx'))
  const lyon = { lat: 45.76, lon: 4.84 }
  const ligne = (h: string) => /<p class="cab-ligne cab-consigne-carte( cab-souffle| cab-ou-est)?" aria-live="polite">(.*?)<\/p>/.exec(h)
  const avant = poserLEpingle({ epingle: null, grands: false, pasAPas: false }, lyon, vues.epingle.enCours)
  const zoneDAbord = ligne(await laPartie(v, { local: avant }))!
  assert.equal(zoneDAbord[1], ' cab-souffle')
  assert.match(texte(zoneDAbord[2]), /Indice : c’est quelque part dans la zone entourée\./)
  const apres = poserLEpingle(avant, lyon, m)
  const epingleEnsuite = ligne(await laPartie(v, { local: apres }))!
  assert.equal(epingleEnsuite[1], ' cab-ou-est')
  assert.equal(texte(epingleEnsuite[2]).trim(), 'Ton épingle : Près de Lyon')
  // Où qu'elle se dise, l'épingle se dit aussi sur la carte, à qui y revient (`aide`).
  assert.match(texte(await laPartie(v, { local: avant })), /Ton épingle : Près de Lyon\./)
  // Un toucher, une flèche, un pas : toutes les épingles posées passent par là.
  const epingle = source('views/cabinet/jeux/Epingle.tsx')
  assert.equal([...epingle.matchAll(/setLocal\(poserLEpingle\(local, /g)].length, 2, 'la carte et les pas')
  assert.doesNotMatch(epingle, /epingle: p \}|\.\.\.local, epingle:/)
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

// ── 3 bis. L'Épingle à l'oreille ──────────────────────────────────────────

/**
 * Un stockage du navigateur en mémoire, le temps d'une épreuve, puis celui d'avant : Node n'en a pas, et la page sans stockage se
 * joue pareil — elle oublie seulement.
 */
async function avecUnStockage<T>(f: (memoire: Map<string, string>) => Promise<T>): Promise<T> {
  const avant = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const memoire = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => void memoire.set(k, v), removeItem: (k: string) => void memoire.delete(k) },
  })
  try {
    return await f(memoire)
  } finally {
    if (avant) Object.defineProperty(globalThis, 'localStorage', avant)
    else delete (globalThis as Record<string, unknown>).localStorage
  }
}

test('l’Épingle au lecteur d’écran : « Pas à pas » et « Grands pas » retenus au profil d’une manche à l’autre, sans rien d’un autre profil', async () => {
  // À « Manche suivante », « Pas à pas » se refermait, « Grands pas » se relâchait, et Hugo, au lecteur d'écran, les rouvrait à
  // chaque manche, sous un chrono qui courait pendant le récit (la tablée du 26 octobre 2026, Ajaccio en une vingtaine de
  // pressions). Ils se retiennent au profil, comme la carte-bonus : la page lit ce que retient son profil à son ouverture.
  const { EPINGLE, basculerLesPas } = await import(url('views/cabinet/jeux/Epingle.tsx'))
  const retenu = await import(url('views/cabinet/retenu.ts'))
  assert.match(source('views/CabinetApp.tsx'), /setCarte\(carteRetenue\(id\)\)/, 'la page lit ce que retient son profil, dès le profil léger lu')
  const premiere = vues.epingle.enCours as EpingleMontree
  const suivante = vues.epingleTroisieme.enCours as EpingleMontree
  await avecUnStockage(async memoire => {
    retenu.carteRetenue('hugo')
    let l = EPINGLE.localDe(premiere)
    assert.deepEqual(l, { epingle: null, grands: false, pasAPas: false }, 'rien de retenu : fermés, à petits pas')
    l = basculerLesPas(basculerLesPas(l, 'pasAPas'), 'grands')
    assert.deepEqual(l, { epingle: null, grands: true, pasAPas: true })
    assert.deepEqual([...memoire.keys()], ['quizz.cabinet.pas-a-pas.hugo'])
    // La manche suivante — et la partie suivante — les rouvre tels qu'il les a laissés, l'épingle à poser.
    const l2 = EPINGLE.localDe(suivante)
    assert.deepEqual(l2, { epingle: null, grands: true, pasAPas: true })
    const pied = piedDe(await laPartie(vues.epingleTroisieme, { local: l2 }))
    assert.match(pied, /aria-label="Grands pas, \d+ km" aria-pressed="true"/)
    assert.match(pied, /<button type="button" class="btn cab-pas-a-pas" aria-expanded="true"/)
    // Refermés, ils se rouvrent refermés, et rien ne reste écrit.
    basculerLesPas(basculerLesPas(l2, 'grands'), 'pasAPas')
    assert.deepEqual(EPINGLE.localDe(suivante), { epingle: null, grands: false, pasAPas: false })
    assert.equal(memoire.size, 0, 'rien de retenu : la clé s’efface')
    // « Pas à pas » seul, à petits pas.
    basculerLesPas(EPINGLE.localDe(suivante), 'pasAPas')
    assert.deepEqual(EPINGLE.localDe(suivante), { epingle: null, grands: false, pasAPas: true })
    // Léa, sur le même téléphone : rien de Hugo.
    retenu.carteRetenue('lea')
    assert.deepEqual(EPINGLE.localDe(suivante), { epingle: null, grands: false, pasAPas: false })
    retenu.carteRetenue('hugo')
    assert.deepEqual(EPINGLE.localDe(suivante), { epingle: null, grands: false, pasAPas: true })
  })
  // Sans stockage — des cookies bloqués —, rien ne casse : fermés, et la bascule bascule encore.
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('SecurityError')
    },
  })
  try {
    assert.deepEqual(EPINGLE.localDe(premiere), { epingle: null, grands: false, pasAPas: false })
    assert.deepEqual(basculerLesPas(EPINGLE.localDe(premiere), 'grands'), { epingle: null, grands: true, pasAPas: false })
  } finally {
    delete (globalThis as Record<string, unknown>).localStorage
  }
  // Au pied, « Pas à pas » et « Grands pas » basculent par la règle qui les retient, jamais par un `setLocal` à la main.
  const epingle = source('views/cabinet/jeux/Epingle.tsx')
  assert.match(epingle, /setLocal\(basculerLesPas\(local, 'pasAPas'\)\)/)
  assert.match(epingle, /setLocal\(basculerLesPas\(local, 'grands'\)\)/)
  assert.doesNotMatch(epingle, /grands: !local\.grands|pasAPas: !local\.pasAPas/)
})

test('l’Épingle sans clavier : « Partir de… » pose l’épingle sur une ville repère ou en Corse, et chaque lieu livré est à trois étoiles en dix touchers au plus', async () => {
  // Depuis le milieu de la France, trois étoiles demandaient dix-huit grands pas pour Ajaccio, treize pour Brest ou Nice (la tablée
  // du 26 octobre 2026) : les villes repères étaient dessinées, mais ne se rejoignaient pas d'un geste.
  const { DEPARTS_DE_L_EPINGLE, departNomme, VILLES_REPERES } = await import(url('views/cabinet/contourDeLaFrance.ts'))
  const { pasDeLEpingle, poserLEpingle } = await import(url('views/cabinet/jeux/Epingle.tsx'))
  const noms = DEPARTS_DE_L_EPINGLE.map((d: { nom: string }) => d.nom)
  // Les sept villes dessinées, et la Corse — du nord au sud.
  assert.deepEqual([...noms].filter((n: string) => n !== 'la Corse').sort(), VILLES_REPERES.map((v: { nom: string }) => v.nom).sort())
  assert.ok(noms.includes('la Corse'))
  const lats = DEPARTS_DE_L_EPINGLE.map((d: { point: Point }) => d.point.lat)
  assert.deepEqual(lats, [...lats].sort((a: number, b: number) => b - a), 'du nord au sud')
  for (const d of DEPARTS_DE_L_EPINGLE as { nom: string; point: Point }[]) {
    assert.deepEqual(departNomme(d.nom), d.point)
    const ville = VILLES_REPERES.find((v: { nom: string }) => v.nom === d.nom)
    if (ville) assert.deepEqual(d.point, { lat: ville.lat, lon: ville.lon }, `${d.nom} : sur son point dessiné`)
  }
  // Un nom venu de la page se lit par la liste, jamais par `TABLE[nom]` : son prototype ne répond pas.
  for (const faux of ['', 'constructor', 'toString', 'Toulouse']) assert.equal(departNomme(faux), null, faux)
  // Chaque lieu livré, depuis le départ le plus proche : « Pas à pas », « Grands pas », le départ, puis des grands pas vers lui,
  // jusqu'à trois étoiles — dix touchers au plus. Un grand pas fait 55 km de côté : à mi-chemin de quatre, on est à 39 km.
  const lieux = JSON.parse(readFileSync(path.resolve(client, '../../server/content/cabinet/lieux.json'), 'utf8')) as Lieu[]
  assert.ok(lieux.length >= 90)
  const corte = { lat: 42.31, lon: 9.15 }
  let pire = 0
  for (const lieu of [...lieux, { ...lieux[0], nom: 'Corte', lat: corte.lat, lon: corte.lon }]) {
    const depart = [...(DEPARTS_DE_L_EPINGLE as { point: Point }[])].sort((a, b) => distanceKm(a.point, lieu) - distanceKm(b.point, lieu))[0]
    let ici = poserLEpingle({ epingle: null, grands: true, pasAPas: true }, depart.point, { zone: null })
    let pas = 0
    while (distanceKm(ici.epingle!, lieu) >= KM_DE_L_EPINGLE[0] && pas < 20) {
      ici = (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const)
        .map(f => pasDeLEpingle(ici, f))
        .sort((a, c) => distanceKm(a.epingle!, lieu) - distanceKm(c.epingle!, lieu))[0]
      pas++
    }
    assert.ok(distanceKm(ici.epingle!, lieu) < KM_DE_L_EPINGLE[0], `${lieu.nom} : jamais à trois étoiles`)
    pire = Math.max(pire, 3 + pas)
  }
  assert.ok(pire <= 10, `${pire} touchers au pire`)
  // Depuis le milieu de la France, Corte en demandait dix-huit.
  let milieu = { epingle: null as Point | null, grands: true, pasAPas: true }
  let n = 0
  while ((!milieu.epingle || distanceKm(milieu.epingle, corte) >= KM_DE_L_EPINGLE[0]) && n < 30) {
    milieu = (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const).map(f => pasDeLEpingle(milieu, f)).sort((a, c) => distanceKm(a.epingle!, corte) - distanceKm(c.epingle!, corte))[0]
    n++
  }
  assert.ok(n > 10, `${n} grands pas depuis le milieu de la France`)

  // À l'écran : « Partir de… » sous la carte, que « Pas à pas » ouvre et désigne avec les pas ; fermé, rien. Collée au pied, sa
  // ligne prenait à la question et à la carte la place qu'il leur fallait pour tenir ensemble, en 360 × 640 au texte agrandi (le
  // rendu du 26 octobre 2026, `[épingle]`) : le pied ne grandit pas plus qu'avant elle.
  const v = vues.epingle
  assert.doesNotMatch(await laPartie(v), /<select/)
  const html = await laPartie(v, { local: { epingle: null, grands: false, pasAPas: true } })
  const pied = piedDe(html)
  assert.doesNotMatch(pied, /<select/)
  const choix = /<select id="([^"]+)" class="btn btn-block" aria-label="Partir d’une ville">(.*?)<\/select>/.exec(html)
  assert.ok(choix, '« Partir de… », une liste nommée')
  const ou = html.indexOf(choix[0])
  assert.ok(html.indexOf('<svg class="cab-carte-dessin"') < ou && ou < html.indexOf('<div class="cab-pied-partie">'), 'sous la carte, avant le pied')
  const options = [...choix[2].matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map(m => [m[1], texte(m[2]).trim()])
  assert.deepEqual(options[0], ['', 'Partir de…'], 'sa première ligne la dit, sans rien poser')
  assert.deepEqual(
    options.slice(1).map(o => o[1]),
    noms,
    'puis chaque départ, dans l’ordre',
  )
  const rangee = /<div id="([^"]+)" class="cab-pas-de-l-epingle"/.exec(pied)![1]
  assert.match(pied, new RegExp(`aria-expanded="true" aria-controls="${echapper(choix[1])} ${echapper(rangee)}">Pas à pas</button>`))
  // Choisi, le départ pose l'épingle par la règle de la carte (`poser`) : la plus neuve des deux, l'épingle ou la zone, se dit.
  const epingle = source('views/cabinet/jeux/Epingle.tsx')
  assert.match(epingle, /const p = departNomme\(e\.currentTarget\.value\)\s+if \(p\) poser\(p\)/)
  assert.match(epingle, /<PartirDe poser=\{poser\} \/>/)
  assert.equal([...epingle.matchAll(/setLocal\(poserLEpingle\(local, /g)].length, 2, 'la carte et les départs, les pas du pied')
})

test('l’Épingle dit la taille de son pas : « Grands pas, 55 km » à l’oreille, et la carte, « un pas fait 11 km, un grand 55 »', async () => {
  // Un pas valait 11,1 km et un grand 55,6, mais la page n'en disait que « ×5 » à l'œil et « Grands pas » à l'oreille (Hugo, à la
  // tablée du 26 octobre 2026). Le chiffre vient de la règle même des pas (`deplacer`), jamais d'un nombre écrit à la main.
  const { KM_D_UN_PAS, GRAND_PAS, deplacer, MILIEU_DE_LA_FRANCE } = await import(url('views/cabinet/contourDeLaFrance.ts'))
  assert.equal(KM_D_UN_PAS, Math.round(distanceKm(MILIEU_DE_LA_FRANCE, deplacer(MILIEU_DE_LA_FRANCE, 'ArrowUp'))))
  assert.equal(KM_D_UN_PAS, 11)
  const grand = KM_D_UN_PAS * GRAND_PAS
  assert.ok(Math.abs(distanceKm(MILIEU_DE_LA_FRANCE, deplacer(MILIEU_DE_LA_FRANCE, 'ArrowUp', true)) - grand) < 1)
  const v = vues.epingle
  const pied = piedDe(await laPartie(v, { local: { epingle: null, grands: false, pasAPas: true } }))
  assert.match(pied, new RegExp(`<button type="button" class="cab-pas cab-pas-grands" aria-label="Grands pas, ${grand} km" aria-pressed="false">`))
  const html = await laPartie(v)
  const aide = /aria-describedby="([^"]+)"/.exec(html)![1]
  const dite = texte(new RegExp(`<p id="${echapper(aide)}" class="sr-only">(.*?)</p>`).exec(html)![1])
  assert.match(dite, new RegExp(`un pas fait ${KM_D_UN_PAS} km, un grand ${grand}`))
  assert.match(dite, /« Partir de… »/)
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

test('un indice neuf se dit à l’oreille : demandé, offert par Éclairer, montré après un nom faux — et pas une seconde fois quand on tape', async () => {
  // Hugo, au lecteur d'écran (la tablée du 25 octobre 2026) : « Un indice de plus » ne disait rien — la zone de statut ne disait
  // que le nom refusé. Une région à part, que l'œil ne lit pas — l'indice est déjà dans la liste —, dit le dernier venu ; elle ne
  // change qu'avec lui : la ligne du refus se vide dès qu'on tape, et dite dans la même région, elle aurait redit l'indice à la
  // première lettre.
  const neuf = (html: string) => /<p class="sr-only" role="status">(.*?)<\/p>/.exec(piedDe(html))?.[1]
  /** Ce que la page écrit d'un texte, tel que `texte()` le lit : ses espaces fines posées, son apostrophe typographique. */
  const dit = (s: string) => texte(espacesFines(s).replace(/'/g, '’')).trim()
  // Le premier, d'office : rien à dire.
  assert.equal(neuf(await laPartie(vues.indices)), '')
  // Un nom faux en montre un de plus.
  const faux = vues.indicesFaux.enCours as IndicesMontres
  assert.equal(texte(neuf(await laPartie(vues.indicesFaux)) ?? '').trim(), dit(`Indice 2 : ${faux.indices[1]}`))
  // Offert par Éclairer ; demandés jusqu'au dernier.
  const offert = vues.indicesOffert.enCours as IndicesMontres
  assert.equal(texte(neuf(await laPartie(vues.indicesOffert)) ?? '').trim(), dit(`Indice ${offert.indices.length} : ${offert.indices.at(-1)}`))
  const tous = vues.indicesTousVus.enCours as IndicesMontres
  assert.equal(tous.indices.length, 5)
  assert.equal(texte(neuf(await laPartie(vues.indicesTousVus)) ?? '').trim(), dit(`Indice 5 : ${tous.indices[4]}`))
  // Un nom qui s'écrit ne la change pas : la ligne du refus se tait, l'indice reste dit, tel quel.
  assert.equal(neuf(await laPartie(vues.indicesFaux, { local: { texte: 'V' } })), neuf(await laPartie(vues.indicesFaux)))
  // La ligne du refus garde sa place et ses mots.
  assert.match(piedDe(await laPartie(vues.indicesFaux)), /<p class="cab-ligne cab-non" role="status">Non, ce n’est pas/)
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
  // le fait, et « Mes réponses » (`Bilan.tsx`), le seul écran qui montre une manche quittée.
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
  // « Mes réponses » aussi, sur la partie que la route relit : sans `fin`, la manche quittée au bon mot s'y titrait « Le bon mot »
  // sans dire pourquoi elle ne comptait pas — et c'est là seulement qu'on la revoit, une partie quittée s'ouvrant sur son bilan.
  const reponses = texte(await rendu('views/cabinet/Bilan', 'MesReponses', { vue: relue, ecran: REPLIQUE, onFermer: rien }))
  assert.match(reponses, /Manche 3 · Le bon mot/)
  assert.match(reponses, /Manche quittée avant « Qui l’a dit \? » : même le bon mot ne compte pas\./)
  // Les deux manches jouées jusqu'au bout ne disent rien de tel : `fin` vient de chacune.
  assert.equal([...reponses.matchAll(/Manche quittée/g)].length, 1)
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

// ── 6 bis. Le Filet : son unité accordée, et rien de lancé sans un geste ──

/**
 * Ce que dit l'unité d'une valeur sous deux, unité par unité du contenu livré : les symboles et les mots qui ne changent pas, tels
 * quels ; les pluriels qui ne perdent pas qu'un s, écrits ici ; tout autre mot perd son s. Une unité neuve qui n'est ni l'un ni
 * l'autre — ni un s à perdre — rougit l'épreuve : on l'écrit dans la bonne liste.
 */
const SYMBOLES = new Set([
  'm', 'km', 'cm', '%', '°C', 'g', 'min', 'mm', 'km/h', 'kg', 'Hz', 'cl', 's', '°', '°F', 'L', '€', 'h', 'm²', 'km/s', 't', '$', 'mL',
  'ml', 'K', 'av. J.-C.', 'cm²', 'cm³', 'hPa', 'm/s', 'M$', 'e', 'mph', 'SHU', 'g/L', 'g/m²', 'A', 'W', 'km²', 'm³', '£', 'MW', 'DU',
  'µm', 'g/mol', 'Ma', 'kg/m³', 'g/cm³', 'kHz', 'Mbit/s', 'cm3',
])
const MOTS_QUI_NE_CHANGENT_PAS = new Set(['fois', 'mois', 'pays', 'os', 'pas', 'vers', 'hertz', 'cure-dents', 'Pokémon'])
const PLURIELS_A_PART: Record<string, string> = {
  anneaux: 'anneau',
  tableaux: 'tableau',
  vaisseaux: 'vaisseau',
  maréchaux: 'maréchal',
  yeux: 'œil',
  pence: 'penny',
  Länder: 'Land',
  'miles/h': 'mile/h',
  'millions °C': 'million °C',
  'grands tours': 'grand tour',
}

test('le Filet accorde son unité sous deux — « 1 jour », « 1,5 jour », « 17 jours » —, chaque unité du contenu livré', async () => {
  // « Ton filet : de 1 jours à 17 jours » (Camille, à la tablée du 26 octobre 2026) : l'unité se collait telle que la base l'écrit.
  const { lireLaBase } = await import('../src/core/baseCampagne')
  const { valeurDuFilet } = await import('../src/core/cabinet/tirages/tas')
  const { seTendAuFilet } = await import('../../shared/cabinet/jeux/filet')
  const { uniteAccordee } = await import('../../shared/unites')
  const unites = new Set<string>()
  for (const q of lireLaBase().questions) {
    const v = valeurDuFilet(q)
    if (v?.unite && seTendAuFilet(v.valeur, v.annee, 2026)) unites.add(v.unite)
  }
  assert.ok(unites.size > 200, `${unites.size} unités`)
  const aClasser: string[] = []
  for (const u of unites) {
    const attendue = SYMBOLES.has(u) || MOTS_QUI_NE_CHANGENT_PAS.has(u) ? u : (PLURIELS_A_PART[u] ?? (u.endsWith('s') ? u.slice(0, -1) : null))
    if (attendue === null) {
      aClasser.push(u)
      continue
    }
    assert.equal(uniteAccordee(u, 1), attendue, `1 ${u}`)
    assert.equal(uniteAccordee(u, 1.5), attendue, `1,5 ${u}`)
    assert.equal(uniteAccordee(u, 0), attendue, `0 ${u} — zéro est au singulier, comme « 0 pt »`)
    assert.equal(uniteAccordee(u, -1), attendue, `−1 ${u}`)
    // À deux et au-delà, l'unité telle que la base l'écrit — au pluriel.
    for (const n of [2, 17, 1889, -2, 2.5]) assert.equal(uniteAccordee(u, n), u, `${n} ${u}`)
  }
  assert.deepEqual(aClasser, [], 'des unités neuves, ni symbole, ni mot qui ne change pas, ni pluriel en s : à classer ici')
  // Les listes ne gardent rien que le contenu n'ait plus : une unité partie, sa ligne part.
  for (const u of [...SYMBOLES, ...MOTS_QUI_NE_CHANGENT_PAS, ...Object.keys(PLURIELS_A_PART)]) assert.ok(unites.has(u), `« ${u} » n’est plus au Filet`)
  // Ce qui n'est pas un nombre à dire ne s'accorde pas.
  assert.equal(uniteAccordee('jours', Number.NaN), 'jours')
  assert.equal(uniteAccordee('', 1), '')
})

test('le Filet à l’écran dit son unité accordée : ses bornes, ce que son filet prend, son grand pas, sa révélation', async () => {
  const { FILET } = await import(url('views/cabinet/jeux/Filet.tsx'))
  const montree = { jeu: 'filet', categorie: 'Histoire', texte: 'Combien de jours a duré le siège ?', annee: false, unite: 'jours', piste: { min: 1, max: 11, pas: 0.5 }, zone: null }
  const vue = { ...vues.epingle, jeu: 'filet', enCours: montree, revelation: undefined } as unknown as VueDeLaPartie
  const t = texte(await laPartie(vue, { ecran: FILET, local: { x: 1.5, taille: 'grand', touche: true } }))
  assert.match(t, /Ton filet : de 1 jour à 3,5 jours/)
  assert.match(t, / 1 jour 11 jours /, 'les bornes')
  assert.match(t, /\+ 1 jour /, 'un grand pas d’un jour')
  assert.match(t, /1,5 jour /, 'le curseur')
  assert.doesNotMatch(t, /\b1 jours|1,5 jours/)
  const r ={ jeu: 'filet', texte: montree.texte, annee: false, unite: 'jours', piste: montree.piste, zone: null, valeur: 1, lancer: { x: 1.5, taille: 'petit' }, dedans: true }
  const { renderToStaticMarkup } = await import('react-dom/server')
  assert.match(texte(renderToStaticMarkup(React.createElement(FILET.Revelation, { corps: r }))), /La réponse : 1 jour · tu visais 1,5 jour/)
})

test('le Filet laissé sans un geste ne se lance pas : rien ne part à l’échéance, et la chasse quittée ne tient pas la série — touché, il se lance', async () => {
  // Le curseur au milieu, moyen, que la page lançait d'elle-même à l'échéance, comptait « répondu » : la poussière minimale,
  // Protéger et le jour de série se payaient à qui laissait l'écran allumé, quand la page fermée — le pli jouant la réponse vide —
  // n'en donnait rien (la relecture des régressions du 26 octobre 2026). Comme l'Épingle sans épingle : sans un geste, rien.
  const { FILET, bouger, cran, grandPas, prendreLaTaille } = await import(url('views/cabinet/jeux/Filet.tsx'))
  const { aEnvoyerALEcheance } = await import(url('views/cabinet/Partie.tsx'))
  const { milieuDeLaPiste } = await import('../../shared/cabinet/jeux/filet')
  const { JEU_DE_L_OEUVRE, OEUVRES, OEUVRES_DE_DEPART } = await import('../../shared/cabinet/oeuvres')
  const lucas = await inscrireProfil(b.banc.url, 'lucas', 'Lucas')
  const camille = await inscrireProfil(b.banc.url, 'camille', 'Camille')
  const cible = OEUVRES.find(o => JEU_DE_L_OEUVRE[o.cle] === 'filet' && !OEUVRES_DE_DEPART.includes(o.cle))!
  const chasse = async (qui: string) => ok(await commencer(b, qui, { origine: 'chasse', oeuvre: cible.cle, carte: null }), 'la chasse au Filet')

  // Lucas n'y touche pas : ce que la page tient part du milieu, moyen, et rien n'en part à l'échéance.
  const v = await chasse(lucas)
  const m = v.enCours as FiletMontre
  const intact = FILET.localDe(m)
  assert.deepEqual(intact, { x: milieuDeLaPiste(m.piste), taille: 'moyen' })
  assert.equal(FILET.aLEcheance(m, intact), undefined)
  const envoi = aEnvoyerALEcheance(v, v.maintenant, FILET)
  assert.ok(envoi, 'la page prévoit son envoi à l’échéance')
  const geste = envoi.geste(intact)
  assert.deepEqual(geste, { quoi: 'repondre', manche: 0, auto: true }, 'la réponse vide, comme la page fermée')
  const avant = ok(await laPage(b, lucas), 'sa page').poussiere
  b.horloge.t = v.maintenant + envoi.dans
  const pasDeLancer = ok(await jouer(b, lucas, v, geste), 'l’échéance sans un geste')
  assert.equal((pasDeLancer.revelation?.corps as FiletRevele).titre, 'Pas de lancer')
  const quittee = ok(await jouer(b, lucas, pasDeLancer, { quoi: 'quitter' }), 'quitter')
  assert.deepEqual([quittee.bilan?.total, quittee.bilan?.poussiere], [0, 0], 'rien : ni étoile, ni poussière d’or')
  const page = ok(await laPage(b, lucas), 'sa page, après')
  assert.equal(page.serie.jours, 0, 'la chasse ne tient pas la série')
  assert.equal(page.poussiere, avant)

  // Chaque geste sur la piste ou le filet le dit touché : ce qu'il a formé part à l'échéance, même revenu au milieu.
  const plus = cran(m, intact, 1)
  for (const [quoi, l] of [
    ['un cran', plus],
    ['un grand pas', grandPas(m, intact, -1)],
    ['le curseur glissé', bouger(m, intact, m.piste.min)],
    ['revenu au milieu', cran(m, plus, -1)],
    ['la taille', prendreLaTaille(intact, 'petit')],
  ] as const) {
    assert.deepEqual(FILET.aLEcheance(m, l), { filet: { x: l.x, taille: l.taille } }, quoi)
  }
  // Camille touche un cran : son lancer part à l'échéance, et compte — la série tient.
  const w = await chasse(camille)
  const touche = cran(w.enCours as FiletMontre, FILET.localDe(w.enCours), 1)
  const sien = aEnvoyerALEcheance(w, w.maintenant, FILET)!
  b.horloge.t = w.maintenant + sien.dans
  const lance = ok(await jouer(b, camille, w, sien.geste(touche)), 'le lancer à l’échéance')
  assert.notEqual((lance.revelation?.corps as FiletRevele).titre, 'Pas de lancer')
  ok(await jouer(b, camille, lance, { quoi: 'quitter' }), 'quitter')
  assert.equal(ok(await laPage(b, camille), 'sa page').serie.jours, 1, 'un lancer qu’il a formé tient la série')
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
  // Où est l'épingle prend la place de la consigne au-dessus de la carte, qui garde ses deux lignes (plus bas) : rien ne change de
  // hauteur sous le doigt d'une épingle à l'autre — au pied, sa ligne faisait monter le pied de 25 pixels sur la carte, et l'écho du
  // doigt tombait sur la carte-bonus venue sous lui.
  assert.doesNotMatch(section, /(?:^|\n)\.cab-ou-est \{/, 'plus de ligne à part au pied')
  assert.match(section, /\.cab-consigne-carte\.cab-ou-est \{[^}]*justify-content: flex-start;/)
  // La question et la carte tiennent ensemble entre la tête et le pied collés : la question se colle sous la tête, sur un sol plein,
  // et la carte se borne à ce qui reste — en 277 × 492, le texte à 130 %, elle n'y tenait jamais (381 px pour une bande de 277).
  assert.match(section, /\.cab-manche:has\(\.cab-carte-jouable\) > \.cab-question \{ position: sticky; top: var\(--cab-tete, 0px\); z-index: 1; background: var\(--bg\);/)
  // Collée, elle couvre aussi les 8 pixels du fondu de la tête au-dessus d'elle, et l'air qu'elle laisse à la carte dessous : la
  // ligne passée sous elle s'y lisait en trace — « Près de Marseille » coupé sous le chrono, le bas de l'indice au-dessus de la
  // carte (la relecture du lot page-1). Huit pixels de chaque côté, dans l'écart de 14 qui la sépare du récit et de la consigne :
  // la page en haut, ils ne couvrent rien.
  assert.match(section, /\.cab-manche:has\(\.cab-carte-jouable\) > \.cab-question \{[^}]*box-shadow: 0 -8px 0 var\(--bg\), 0 8px 0 var\(--bg\);/)
  assert.match(source('views/cabinet/bande.ts'), /export const AIR_SOUS_LA_QUESTION = 8\b/)
  assert.match(section, /\.cab-manche \.cab-carte-jouable \{[^}]*width: min\([^;]*var\(--cab-place[^;]*\);[^}]*margin: 0 auto;/)
  // Jamais sous son plancher, qui laisse une question de trois lignes tenir avec la carte au plus serré : 277 × 492, la niche posée,
  // la carte-bonus au pied, il reste 133 pixels de place, 152 de large. À 180, « Où Voltaire achète-t-il ce domaine ? » et la carte
  // ne tenaient jamais ensemble (la relecture du lot page-1). Ni beaucoup plus bas : un pixel du doigt y ferait dix kilomètres.
  const plancher = Number(/\.cab-manche \.cab-carte-jouable \{[^}]*width: min\([^;]*max\((\d+)px, var\(--cab-place/.exec(section)?.[1])
  assert.ok(plancher >= 140 && plancher <= Math.floor((133 * LARGEUR_DE_LA_CARTE) / HAUTEUR_DE_LA_CARTE), `un plancher de ${plancher} px`)
  // La place se convertit en largeur par les mesures mêmes du dessin (`shared/cabinet/france.ts`), écrites dans la feuille : un
  // dessin retouché d'un côté seulement, la carte bornée n'aurait plus tenu dans sa place, ou l'aurait laissée vide.
  const proportion = /\.cab-carte-de-france \{[^}]*--cab-carte-l: (\d+); --cab-carte-h: (\d+);/.exec(section)
  assert.ok(proportion, 'les mesures du dessin dans la feuille')
  assert.deepEqual([Number(proportion[1]), Number(proportion[2])], [LARGEUR_DE_LA_CARTE, HAUTEUR_DE_LA_CARTE])
  // Les deux gestes du nom aux Indices : « Répondre » ne se coupe jamais — sa colonne garde la largeur de son mot, et c'est « Un
  // indice de plus » qui passe sur deux lignes (« épondr », sur l'accent, à 130 %, à la tablée du 25 octobre 2026).
  const gestes = /\.cab-gestes-du-nom \{[^}]*grid-template-columns: ([^;]+);/.exec(section)?.[1] ?? ''
  const colonnes = [...gestes.matchAll(/minmax\(([^,]+), ([^)]+)\)/g)].map(m => [m[1].trim(), m[2].trim()])
  assert.equal(colonnes.length, 2, gestes)
  assert.equal(colonnes[1][0], 'max-content', `la colonne de « Répondre » ne descend pas sous son mot : ${gestes}`)
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
