// L'écran de la carte d'un acte, revu deux fois le 18 octobre 2026 à la
// demande du propriétaire. D'abord : « il faudrait uniquement illuminer la
// node sur laquelle on est et pas tout le chemin. Une fois vaincu ça nous
// proposerait uniquement les nodes de devant que l'on peut atteindre » — le
// tracé le plus sûr s'allumait d'ici au campement, et l'escale où l'on était
// se perdait parmi elles. Puis : « Je n'aime pas le design de comment sont
// matérialisé les cartes, ça serait possible que ce soit de vrais cartes en
// bas ? […] Pareil ma main c'est pas ouf ». L'acte se voit maintenant en petit
// en haut, tout entier ; les escales proposées sont des cartes en bas ; la
// main, des cartes au cadre de leur rareté, qui se lèvent. Rendu ici tel que
// la page le sert (`renderToStaticMarkup`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { GARDIEN, carteDUnActe, type CarteDUnActe, type JokersEnJeu, type VueDeLExpedition } from '../../shared/expedition'

Object.assign(globalThis, { React, window: { location: { pathname: '/expedition', search: '', hash: '' } } })

/** Une carte de l'acte 1, ses chances posées comme la vue les pose. */
function uneCarte(graine: string): CarteDUnActe {
  const carte = carteDUnActe(graine, 0, [])
  for (const e of carte.escales) if (e.sorte === 'question' || e.sorte === 'elite' || e.sorte === 'source') e.chance = e.sorte === 'elite' ? 0.55 : 0.8
  return carte
}

function uneVue(carte: CarteDUnActe, ici: string | null, trace: string[], permises: string[]): VueDeLExpedition {
  const gardiens = ['lg:kraken', 'lg:dragon', 'lg:oracle'].map(cle => ({ cle, vaincu: false }))
  return { id: 'x', numero: 12_345, acte: 0, gardiens, carte, ici, trace, permises, vies: 3, justes: trace.length, issue: 'en-route', moyen: true, rang: trace.length, equipee: [] }
}

/** La page, chargée par son adresse : le typage du serveur ne lit pas le JSX du client. */
type Composant = (props: Record<string, unknown>) => React.ReactNode
async function page(): Promise<{ CarteDeLActe: Composant; Main: Composant; JokerLeve: Composant }> {
  return import(new URL('../../client/src/views/ExpeditionApp.tsx', import.meta.url).href)
}

const rien = () => {}

async function rendre(vue: VueDeLExpedition): Promise<string> {
  const { CarteDeLActe } = await page()
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(CarteDeLActe, { vue, carte: vue.carte!, busy: false, erreur: '', onAvancer: rien, onAbandonner: rien, onPartir: rien, onJouer: rien }))
}

/** Les escales du plan, en haut : leurs classes. */
function points(html: string) {
  return [...html.matchAll(/<span class="exp-point ([^"]+)" data-escale="([^"]+)"/g)].map(m => ({ id: m[2], classes: m[1].split(' ') }))
}

/** Les cartes des escales proposées, en bas : dans leur ordre, choisie ou non, la plus sûre, ce qu'elles montrent. */
function cartes(html: string) {
  return [...html.matchAll(/<button type="button" class="exp-carte-escale ([^"]+)" data-escale="([^"]+)" aria-label="([^"]*)" aria-pressed="(true|false)"( aria-describedby="exp-dit-sure")?>([\s\S]*?)<\/button>/g)].map(m => ({
    id: m[2],
    classes: m[1].split(' '),
    nom: m[3],
    choisie: m[4] === 'true',
    sure: !!m[5],
    sorte: /class="exp-carte-sorte"[^>]*>([^<]*)</.exec(m[6])?.[1],
    /** Ce qu'elle rapporte, dans l'ordre : `ecus:+10`, `joker:+1`, `vie:+1`, `tampon:`. */
    gains: [...m[6].matchAll(/data-gain="(\w+)">(?:<svg[\s\S]*?<\/svg>|<i class="exp-glyphe-joker"><\/i>)([^<]*)</g)].map(g => `${g[1]}:${g[2]}`),
    contenu: m[6],
  }))
}

const avec = (classe: string, toutes: { id: string; classes: string[] }[]) => toutes.filter(e => e.classes.includes(classe)).map(e => e.id).sort()

test('au départ : l’acte en petit, le départ qui brille ; les escales du bas en cartes, de gauche à droite, la plus sûre à son ruban', async () => {
  const carte = uneCarte('carte-ecran:1')
  const html = await rendre(uneVue(carte, null, [], carte.depart))
  const plan = points(html)
  assert.match(html, /class="exp-petit-depart exp-ici"/)
  assert.deepEqual(avec('exp-ici', plan), [])
  assert.deepEqual(avec('exp-a-portee', plan), [...carte.depart].sort())
  // Plus de tracé qui s'allume : ni escale dorée, ni lien d'or avant qu'il choisisse.
  assert.doesNotMatch(html, /exp-tracee|lien-prevu|lien-choisi|exp-choisie/)
  // Pas la classe de la réponse proposée d'un vrai ou faux : sa règle en faisait des cartes carrées.
  assert.doesNotMatch(html, /exp-proposee/)
  // Le reste attend plus loin, en retrait ; le gardien, le but, non.
  assert.ok(avec('exp-plus-loin', plan).length > 10)
  assert.ok(!avec('exp-plus-loin', plan).includes(GARDIEN))
  // Le plan est un dessin, sans un mot : touché, il s'ouvre en grand — et n'est pas rendu d'avance. « Le plan », plus
  // « La carte » : le même mot disait la carte de l'acte et les cartes de la main, sur le même écran (le codex, le
  // 18 octobre 2026).
  assert.match(html, /<button type="button" class="exp-plan" aria-haspopup="dialog"><span class="exp-petit-plan" aria-hidden="true">/)
  assert.match(html, /<\/svg>Le plan<\/span><span class="sr-only">, tu es au départ<\/span><\/button>/)
  assert.doesNotMatch(html, /id="escale-|exp-etiquette|exp-sa-chance|class="exp-legende"/)
  // D'ici, un trait vers chaque proposée.
  assert.equal(html.match(/class="lien-propose"/g)?.length, carte.depart.length)

  // Une carte par escale proposée, de gauche à droite comme sur le plan.
  const enBas = cartes(html)
  const colonne = (id: string) => carte.escales.find(e => e.id === id)!.colonne
  assert.deepEqual(
    enBas.map(c => c.id),
    [...carte.depart].sort((a, b) => colonne(a) - colonne(b)),
  )
  for (const c of enBas) {
    // Le premier étage ne pose que des questions : chacune dit sa sorte, sa chance, et sa description le reste.
    assert.equal(c.sorte, 'Question', c.id)
    assert.match(c.contenu, /class="exp-carte-chance">[\s\S]*80 %/, `${c.id} : sa chance`)
    // Une expédition d'avant les écus ne dit pas d'écus.
    assert.deepEqual(c.gains, [], c.id)
    assert.match(c.nom, /pour un joueur moyen/, `${c.id} : sa description dit à qui est la chance`)
    assert.equal(c.choisie, false)
  }
  // La plus sûre : un ruban sur une carte, que sa description dit aussi.
  assert.equal(enBas.filter(c => c.sure).length, 1)
  assert.match(enBas.find(c => c.sure)!.contenu, /class="exp-la-plus-sure" aria-hidden="true">la plus sûre</)
  assert.match(html, /<span id="exp-dit-sure" hidden="">La plus sûre des escales proposées<\/span>/)
  // Rien de choisi : le bouton attend ; les chances d'un joueur moyen se disent.
  assert.match(html, /aria-disabled="true">Choisis ton escale/)
  assert.match(html, /class="exp-note small">Les chances d’un joueur moyen/)
  // « Abandonner l'expédition » vit dans la feuille de la carte : l'écran tient en un écran.
  assert.doesNotMatch(html, /Abandonner/)
})

test('arrivé à une escale, elle seule brille ; ses suites seules sont en cartes, les autres escales du bas hors de route', async () => {
  // Une escale du bas qui mène à deux : il a un choix à faire.
  let carte = uneCarte('carte-ecran:2')
  for (let k = 3; !carte.escales.some(e => e.etage === 0 && e.suite.length === 2); k++) carte = uneCarte(`carte-ecran:${k}`)
  const x = carte.escales.find(e => e.etage === 0 && e.suite.length === 2)!
  const html = await rendre(uneVue(carte, x.id, [x.id], x.suite))
  const plan = points(html)
  assert.deepEqual(avec('exp-ici', plan), [x.id])
  assert.doesNotMatch(html, /class="exp-petit-depart exp-ici"/)
  assert.deepEqual(avec('exp-a-portee', plan), [...x.suite].sort())
  for (const id of carte.depart.filter(id => id !== x.id)) assert.ok(avec('exp-loin', plan).includes(id), id)
  assert.deepEqual(cartes(html).map(c => c.id).sort(), [...x.suite].sort())
  assert.equal(html.match(/class="lien-propose"/g)?.length, 2)
  assert.match(html, /class="lien-fait"/, 'le pas fait, éteint')
  assert.match(html, /<span class="sr-only">, tu es à l’escale [^<]+<\/span><\/button>/)
  assert.match(html, /aria-disabled="true">Choisis ton escale/)
})

test('au campement, le gardien seul est en carte : choisi d’office, sa chance de le vaincre, « Affronter »', async () => {
  const carte = uneCarte('carte-ecran:1')
  const camp = carte.escales.find(e => e.sorte === 'campement')!
  const html = await rendre(uneVue(carte, camp.id, [camp.id], [GARDIEN]))
  const [gardien, ...autres] = cartes(html)
  assert.equal(autres.length, 0)
  assert.equal(gardien.id, GARDIEN)
  assert.ok(gardien.choisie, 'choisi d’office')
  assert.equal(gardien.sorte, 'Gardien')
  assert.match(gardien.contenu, /class="exp-carte-nom" aria-hidden="true">Le Kraken</)
  assert.match(gardien.contenu, /class="exp-carte-chance"/, 'sa chance de le vaincre')
  // Sur le plan, son escale se dore, et le trait qui y mène.
  assert.ok(points(html).find(p => p.id === GARDIEN)!.classes.includes('exp-choisie'))
  assert.match(html, /class="lien-propose lien-choisi"/)
  assert.match(html, /<h2 class="label" id="exp-panneau-titre">Le Kraken t’attend<\/h2>/)
  assert.match(html, />Affronter le Kraken<svg/)
  assert.doesNotMatch(html, /aria-disabled/)
})

test('sous L’écholocation, ni chance sur les cartes, ni la plus sûre', async () => {
  const carte = uneCarte('carte-ecran:1')
  // La vue retire les chances de la carte : la page n'en a plus aucune.
  for (const e of carte.escales) delete e.chance
  const html = await rendre({ ...uneVue(carte, null, [], carte.depart), sansChances: true })
  assert.doesNotMatch(html, /exp-carte-chance|exp-la-plus-sure|joueur moyen/)
  assert.match(html, /L’écholocation est posée/)
})

test('les cartes d’escale disent ce qu’elles rapportent : écus, joker, vie, tampon', async () => {
  // Une carte au premier étage de quatre escales, forcées : une élite, une source, un coffre, une question d'un thème pointu à tamponner.
  let carte = uneCarte('carte-ecran:1')
  for (let k = 3; carte.escales.filter(e => e.etage === 0).length < 4; k++) carte = uneCarte(`carte-ecran:${k}`)
  const sortes = ['elite', 'source', 'coffre', 'question'] as const
  carte.escales
    .filter(e => e.etage === 0)
    .forEach((e, i) => {
      e.sorte = sortes[i]
      if (e.sorte === 'coffre') delete e.chance
      if (e.sorte === 'question') Object.assign(e, { theme: { sujet: 'halloween' }, aTamponner: true, chance: 0.5 })
    })
  const html = await rendre({ ...uneVue(carte, null, [], carte.depart), ecus: 0, jokers: { main: [], paquet: [], defausse: [], poses: [], refus: {} } })
  const parSorte = new Map(cartes(html).map(c => [c.sorte, c]))
  assert.deepEqual([...parSorte.keys()].sort(), ['Coffre', 'Question', 'Source', 'Élite'])
  // Une élite trouvée : un joker au choix, et ses écus — la prime de l'élite comprise.
  assert.deepEqual(parSorte.get('Élite')!.gains[0], 'joker:+1')
  assert.match(parSorte.get('Élite')!.gains[1], /^ecus:\+\d{2}$/)
  // Une source retrouvée rend une vie ; un coffre, un joker, sans chance à dire.
  assert.deepEqual(parSorte.get('Source')!.gains, ['vie:+1'])
  assert.deepEqual(parSorte.get('Coffre')!.gains, ['joker:+1'])
  assert.doesNotMatch(parSorte.get('Coffre')!.contenu, /exp-carte-chance/)
  assert.match(parSorte.get('Coffre')!.contenu, /class="exp-carte-nom" aria-hidden="true">Un joker au choix</)
  // Un thème pointu : son nom, ses écus doublés, son tampon.
  assert.match(parSorte.get('Question')!.contenu, /class="exp-carte-nom" aria-hidden="true">Halloween</)
  assert.deepEqual(parSorte.get('Question')!.gains, ['ecus:+20', 'tampon:'])
})

/** Une main : un joker de carte qui se joue, un joker de question qui ne se joue pas sur la carte, un maudit ; un posé. */
const MAIN: JokersEnJeu = {
  main: ['detour', 'coup-d-oeil', 'tout-ou-rien'],
  paquet: ['echange', 'echange'],
  defausse: ['sursis'],
  poses: ['tresor'],
  refus: { detour: null, 'coup-d-oeil': 'Ce joker se joue sur une question', 'tout-ou-rien': 'Ce joker se joue sur une question' },
}

/** Les cartes d'une main rendue : leur clé, leur gemme, éteintes ou non, ce qu'elles portent. */
function cartesDeLaMain(main: string) {
  return [...main.matchAll(/<button type="button" class="exp-carte-joker([^"]*)" style="--gemme:(#[0-9a-f]{6})" data-joker="([^"]+)" aria-haspopup="dialog">([\s\S]*?)<\/button>/g)].map(m => ({
    cle: m[3],
    gemme: m[2],
    refuse: m[1].includes('exp-refuse'),
    contenu: m[4],
  }))
}

test('la main, sous une question : de vraies cartes au cadre de leur rareté, leur nom en clair, éteintes quand elles ne se jouent pas ; la pioche au bout', async () => {
  const { Main } = await page()
  const { renderToStaticMarkup } = await import('react-dom/server')
  const carte = uneCarte('carte-ecran:1')
  const html = renderToStaticMarkup(React.createElement(Main, { vue: { ...uneVue(carte, null, [], carte.depart), jokers: MAIN }, jokers: MAIN, busy: false, onJouer: rien }))
  const main = /^<section class="exp-main" aria-label="Ta main">([\s\S]*?)<\/section>$/.exec(html)?.[1] ?? ''
  const enMain = cartesDeLaMain(main)
  assert.deepEqual(
    enMain.map(c => c.cle),
    MAIN.main,
  )
  // Le cadre de la rareté, la gemme de l'album : argent pour un commun, le pourpre de l'épique pour un maudit.
  assert.equal(enMain[0].gemme, '#a8b3bf')
  assert.equal(enMain[2].gemme, '#b77bff')
  // Son nom se voit ; celle qui ne se joue pas maintenant le dit à l'oreille.
  assert.match(enMain[0].contenu, /<b class="exp-joker-nom">Le détour<\/b>$/)
  assert.deepEqual(
    enMain.map(c => c.refuse),
    [false, true, true],
  )
  assert.match(enMain[1].contenu, /<span class="sr-only">, pas maintenant<\/span>$/)
  // La pioche : le paquet compté, la défausse dite.
  assert.match(main, /class="exp-pioche" aria-haspopup="dialog"><b aria-hidden="true">2<\/b><span aria-hidden="true">paquet<\/span><span class="sr-only">Ton paquet : 2 jokers, ta défausse : 1<\/span>/)
  // Vide, elle le dit, et la pioche reste.
  const vide = renderToStaticMarkup(React.createElement(Main, { vue: uneVue(carte, null, [], carte.depart), jokers: { ...MAIN, main: [], refus: {} }, busy: false, onJouer: rien }))
  assert.match(vide, /class="exp-main-vide">Ta main est vide : tu tires un joker à chaque question, tant que ton paquet en a\.<\/p><button type="button" class="exp-pioche"/)
})

test('la main, sur la carte : en petit, en tête du panneau — le dessin seul, le nom à l’oreille — ; les posés dans la barre', async () => {
  const carte = uneCarte('carte-ecran:1')
  const html = await rendre({ ...uneVue(carte, null, [], carte.depart), jokers: MAIN })
  const main = /<section class="exp-main exp-main-en-petit" aria-label="Ta main">([\s\S]*?)<\/section>/.exec(html)?.[1] ?? ''
  const enMain = cartesDeLaMain(main)
  assert.deepEqual(
    enMain.map(c => c.cle),
    MAIN.main,
  )
  assert.match(enMain[0].contenu, /<b class="sr-only">Le détour<\/b>$/)
  assert.match(main, /class="exp-pioche" aria-haspopup="dialog"><b aria-hidden="true">2<\/b><span class="sr-only">Ton paquet : 2 jokers, ta défausse : 1<\/span>/)
  // En tête du panneau, avant les cartes des escales : posée au bas, elle prenait au plan sa hauteur.
  assert.ok(html.indexOf('id="exp-panneau-titre"') < html.indexOf('class="exp-main') && html.indexOf('class="exp-main') < html.indexOf('class="exp-cartes-escale"'))
  // Le posé, dans la barre : son cadre et son nom à l'oreille.
  assert.match(html, /class="exp-talismans" role="img" aria-label="Posés : Le trésor"><span class="exp-pose" style="--gemme:#f2b84b">/)
})

async function lever(props: { cle: string; refus: string | null; onMontrer?: () => void }): Promise<string> {
  const { JokerLeve } = await page()
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(JokerLeve, { busy: false, onJouer: rien, onReposer: rien, ...props }))
}

test('une carte levée : le joker en grand — sa rareté, son effet, d’où il vient — puis « Jouer », ou pourquoi il ne se joue pas', async () => {
  const detour = await lever({ cle: 'detour', refus: null })
  assert.match(detour, /<div class="carte-voile exp-leve-voile"><div class="exp-leve" role="dialog" aria-modal="true" aria-label="Le détour" tabindex="-1">/)
  assert.match(detour, /class="exp-carte-joker exp-carte-levee" style="--gemme:#a8b3bf"/)
  assert.match(detour, /<span class="exp-joker-rarete"><i aria-hidden="true"><\/i>commun<\/span>/)
  assert.match(detour, /class="exp-joker-effet">Ton pas suivant peut aller à n’importe quelle escale de l’étage du dessus\.</)
  assert.match(detour, /class="exp-joker-origine">Sur le plan, entre deux escales</)
  assert.match(detour, />Jouer « Le détour »<\/button>/)
  assert.match(detour, />Reposer la carte<\/button>/)

  // Refusé : la raison, et aucun geste.
  const refuse = await lever({ cle: 'coup-d-oeil', refus: 'Ce joker se joue sur une question' })
  assert.match(refuse, /<p class="exp-refus">Ce joker se joue sur une question<\/p>/)
  assert.doesNotMatch(refuse, /btn-primary/)

  // Posé, pas joué ; d'un légendaire, il le dit.
  const tresor = await lever({ cle: 'tresor', refus: null })
  assert.match(tresor, />Poser « Le trésor »<\/button>/)
  assert.match(tresor, /style="--gemme:#f2b84b"/)
  assert.match(tresor, /le joker du Dragon d’Or/)

  // Le Commandement choisit sa catégorie avant de se jouer.
  const commandement = await lever({ cle: 'commandement', refus: null })
  assert.equal(commandement.match(/class="pill-btn" aria-pressed="false"/g)?.length, 12)
  assert.match(commandement, /aria-disabled="true">Choisis une catégorie<\/button>/)

  // La Prédiction se montre sur la question : la carte rend la main à la réponse à toucher.
  const prediction = await lever({ cle: 'prediction', refus: null, onMontrer: rien })
  assert.match(prediction, />Montrer une réponse à l’Oracle<\/button>/)
})
