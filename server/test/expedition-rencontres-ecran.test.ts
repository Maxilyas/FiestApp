// L'écran d'une rencontre, revu pour qui découvre. Le propriétaire, le 18
// octobre 2026 : « Tu peux aussi modifier les cartes et la main de manière à
// que ce soit plus simple, esthétique et accès sur la compréhension. Je veux
// que ce soit très simple à comprendre. J'aime bien le principe d'envoyer des
// cartes avant la question […] mais je veux que ce soit bien compréhensible
// pour des novices. » Des mots de tous les jours — l'adversaire perd des
// points, un bouclier, un pari —, jamais « sceaux », « Charge » ni « Garde » ;
// levée, une carte dit ce qu'elle changerait — et ce qu'elle annonce, le
// serveur le fait. Puis la revue du même soir : « Trop d'infos écrites sur la
// page on s'y perd » — la main sans un mot, les règles au « ? », les cartes
// posées en haut. Rendu ici tel que la page le sert (`renderToStaticMarkup`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { GARDIEN, pliDeLExpedition, vueDeLaRencontre, type CarteDUnActe, type DepartDExpedition, type EtatDeLExpedition, type GesteDExpedition, type QuestionPosee, type VueDeLExpedition } from '../../shared/expedition'
import {
  CARTES_DES_RENCONTRES,
  VERSION_DE_LA_QUESTION_AU_CENTRE,
  ameliorer,
  carteALaVersion,
  carteDeRencontre,
  seJoueEnQuestion,
  type ApercuDuTour,
  type CarteDeRencontre,
  type VueDeLaRencontre,
} from '../../shared/rencontres'

Object.assign(globalThis, { React, window: { location: { pathname: '/expedition', search: '', hash: '' } } })

// ── Un journal, comme le serveur l'écrit ────────────────────────────────────

/** Une carte faite à la main : une question d'Histoire au bas, le campement, le gardien. */
function carte(): CarteDUnActe {
  return {
    depart: ['e00'],
    chanceDuGardien: 0.6,
    escales: [
      { id: 'e00', etage: 0, colonne: 0, sorte: 'question', theme: { categories: ['Histoire'] }, forme: 'quatre', chance: 0.7, suite: ['cg'] },
      { id: 'cg', etage: 6, colonne: 0, sorte: 'campement', suite: [GARDIEN] },
      { id: GARDIEN, etage: 7, colonne: 0, sorte: 'gardien', suite: [] },
    ],
  }
}

/** Le Dragon d'Or et la Salamandre : Le trésor, posé pour toute la rencontre, et Peau de feu, un bouclier. */
const depart = (graine: string): DepartDExpedition => ({
  v: 5,
  graine,
  numero: 10_000,
  gardiens: ['lg:kraken', 'lg:dragon', 'lg:oracle'],
  cartes: [carte(), carte(), carte()],
  moyen: true,
  equipee: ['lg:dragon', 'lg:salamandre'],
  invite: 'lg:licorne',
  chanceDeLaSource: 0.6,
  fetiche: 'Histoire',
})

class Journal {
  gestes: GesteDExpedition[] = []
  questions: QuestionPosee[] = []
  constructor(readonly depart: DepartDExpedition) {}
  etat(): EtatDeLExpedition {
    return pliDeLExpedition(this.depart, this.gestes, this.questions, new Map())
  }
  geste(g: GesteDExpedition): EtatDeLExpedition {
    this.gestes.push(g)
    const e = this.etat()
    for (let k = 0; e.aTirer && k < e.aTirer.combien; k++) {
      this.questions.push({ escale: e.aTirer.escale, acte: e.aTirer.acte, reponses: 4, niveau: 'facile', tiree: 'quatre', six: true, datee: true, categorie: 'Histoire' })
    }
    return this.etat()
  }
  jouer(cle: string) {
    return this.geste({ quoi: 'jouer', joker: cle, position: this.etat().enAttente! })
  }
  voir(mise: number) {
    return this.geste({ quoi: 'voir', mise, position: this.etat().enAttente! })
  }
  vue(): VueDeLaRencontre {
    return vueDeLaRencontre(this.depart, this.etat(), this.questions)!
  }
}

/** Une graine dont la première main tient ces cartes : cherchée, jamais choisie — le vrai hasard du pli. */
function rencontreAvec(cles: string[]): Journal {
  for (let n = 0; n < 2000; n++) {
    const j = new Journal(depart(`ecran:${cles.join()}:${n}`))
    const main = j.geste({ quoi: 'avancer', vers: 'e00' }).rencontre!.main
    if (cles.every(c => main.includes(c))) return j
  }
  throw new Error(`aucune main ne tient ${cles.join(', ')}`)
}

// ── La page ─────────────────────────────────────────────────────────────────

type Composant = (props: Record<string, unknown>) => React.ReactNode
interface Pieces {
  PreparationDeLaRencontre: Composant
  MainDeRencontre: Composant
  CarteLevee: Composant
  Apercu: Composant
  FeuilleDesCartes: Composant
  CartesAPrendre: Composant
  FeuilleDesRegles: Composant
  RangeeDeCartes: Composant
  apercuALaMise: (r: VueDeLaRencontre, mise: number, fetiche: string | undefined, avec?: string) => ApercuDuTour | undefined
  changementDeLaCarte: (r: VueDeLaRencontre, mise: number, fetiche: string | undefined, cle: string) => { avant: ApercuDuTour; apres: ApercuDuTour } | null
}
/** Les pièces des rencontres, chargées par leur adresse : le typage du serveur ne lit pas le JSX du client. */
const pieces = (): Promise<Pieces> => import(new URL('../../client/src/views/RencontresDExpedition.tsx', import.meta.url).href)

const rien = () => {}

async function rendre(composant: Composant, props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(composant, props))
}

/** Ce qu'on lit à l'écran : le texte seul, ses espaces fines rendues ordinaires. */
const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/[\s  ]+/g, ' ')

/** Le téléphone : un guide déjà vu, ou jamais — un stockage refusé le remontre. */
function stockage(vu: boolean) {
  Object.assign(globalThis, { localStorage: { getItem: () => (vu ? 'vu' : null), setItem: rien, removeItem: rien } })
}

/** La préparation telle que la page l'assemble : la barre, puis ce que `PreparationDeLaRencontre` pose. */
async function preparation(j: Journal): Promise<string> {
  const { PreparationDeLaRencontre } = await pieces()
  // L'énergie de chaque acte, telle que le serveur la dit d'un départ en version 5 : trois partout — et sa version, que les règles lisent.
  const vue = {
    gardiens: j.depart.gardiens.map(cle => ({ cle, vaincu: false })),
    acte: 0,
    fetiche: 'Histoire',
    cartes: { v: j.depart.v, paquet: j.etat().paquet, route: [], refus: {}, energie: [3, 3, 3] },
  } as unknown as VueDeLExpedition
  return rendre(PreparationDeLaRencontre, { vue, r: j.vue(), barre: React.createElement('div', { className: 'exp-barre' }), busy: false, erreur: '', onJouer: rien, onVoir: rien })
}

/** Les mots du code, jamais ceux de l'écran — l'inspiration non plus : l'écran dit « énergie » (« l'histoire de l'inspiration n'est pas du tout claire »). */
const JARGON = /sceau|\bCharge\b|\bGarde\b|inspiration|✦/i

// ── Les cartes ──────────────────────────────────────────────────────────────

/** Une phrase coupée comme le navigateur la coupe : aux espaces, en lignes de `n` signes au plus. */
function lignes(phrase: string, n: number): string[] {
  const out: string[] = []
  for (const mot of phrase.split(' ')) {
    const derniere = out.at(-1)
    if (derniere !== undefined && derniere.length + 1 + mot.length <= n) out[out.length - 1] = `${derniere} ${mot}`
    else out.push(mot)
  }
  return out
}

/**
 * Chaque carte telle que le codex la joue, telle qu'une expédition d'avant le
 * codex la montre encore, quand il l'a retouchée — et améliorée (le jeu
 * complet), quand elle s'améliore ; et telle que la question au centre la joue
 * (v10), améliorée comprise, quand elle y est encore.
 */
const TOUTES_LES_VERSIONS: CarteDeRencontre[] = CARTES_DES_RENCONTRES.flatMap(c => [
  c,
  ...(c.avantLeCodex ? [{ ...c, ...c.avantLeCodex }] : []),
  ...(c.amelioration ? [carteDeRencontre(ameliorer(c.cle))!] : []),
  ...[c.cle, ...(c.amelioration ? [ameliorer(c.cle)] : [])].filter(seJoueEnQuestion).map(cle => carteALaVersion(cle, VERSION_DE_LA_QUESTION_AU_CENTRE)!),
])

test('chaque carte se résume en deux lignes de neuf signes, et son chiffre tient dans son médaillon', () => {
  // « 2 questions » ne tenait pas : « questions » coupé, la carte disait « 2 questio… ». Le résumé se dit à l'oreille, et dans les lignes d'une offre.
  for (const c of TOUTES_LES_VERSIONS) {
    const l = lignes(c.resume, 9)
    assert.ok(l.length <= 2 && l.every(x => x.length <= 9), `${c.cle} : « ${c.resume} » se coupe en ${l.map(x => `« ${x} »`).join(', ')}`)
    // Le chiffre de la main : quelques signes, sans un mot (« trop de détails écrits en dessous de chaque icône »).
    if (c.valeur !== undefined) assert.match(c.valeur, /^[+×]?\d+(,\d)?( s)?$/, `${c.cle} : « ${c.valeur} »`)
  }
})

test('les cartes parlent la langue de tout le monde : ni sceaux, ni Charge, ni Garde, ni inspiration', () => {
  for (const c of TOUTES_LES_VERSIONS) {
    for (const t of [c.effet, c.resume]) assert.doesNotMatch(t, JARGON, `${c.cle} : « ${t} »`)
  }
})

test('levée, une carte dit ce qu’elle changerait — et le serveur fait ce qu’elle a dit', async () => {
  const { apercuALaMise, changementDeLaCarte } = await pieces()
  const j = rencontreAvec(['concentration', 'tresor', 'peau-de-feu', 'prudence'])
  const jouees: string[] = []
  // Dix écus pariés : Le trésor change ce que le pari rapporte, Peau de feu ce que l'erreur coûte.
  for (const cle of ['concentration', 'tresor', 'peau-de-feu', 'prudence']) {
    const avant = j.vue()
    if (avant.refus[cle] !== null) {
      assert.equal(changementDeLaCarte(avant, 10, 'Histoire', cle), null, `${cle}, refusée, ne promet rien`)
      continue
    }
    const promis = changementDeLaCarte(avant, 10, 'Histoire', cle)!
    assert.deepEqual(promis.avant, apercuALaMise(avant, 10, 'Histoire'))
    j.jouer(cle)
    assert.deepEqual(promis.apres, apercuALaMise(j.vue(), 10, 'Histoire'), `${cle} : la carte levée annonçait ce que le serveur a fait`)
    jouees.push(cle)
  }
  assert.deepEqual(jouees, ['concentration', 'tresor', 'peau-de-feu'], 'trois d’inspiration, trois cartes')
  // La question vue, son pari dit : l'aperçu du serveur est celui que la page montrait.
  const dernier = apercuALaMise(j.vue(), 10, 'Histoire')
  j.voir(10)
  assert.deepEqual(j.vue().apercu, dernier)
})

// ── La préparation ──────────────────────────────────────────────────────────

test('la préparation, dans l’ordre où l’on joue : l’adversaire et sa question, ce que la réponse fera, les cartes, le pari, puis « Voir la question »', async () => {
  stockage(true)
  const j = rencontreAvec(['concentration', 'coup-d-oeil'])
  const r = j.vue()
  const html = await preparation(j)
  const lu = texte(html)
  const places = ['class="exp-adversaire ', 'class="exp-sa-question"', 'class="exp-apercu"', 'class="exp-cartes"', 'class="exp-mises"', 'exp-voir'].map(x => html.indexOf(x))
  assert.ok(places.every((p, k) => p >= 0 && (k === 0 || p > places[k - 1])), `dans l’ordre : ${places.join(', ')}`)
  assert.doesNotMatch(lu, JARGON)
  // L'adversaire : ce qu'il lui reste, en points ; la question qu'il pose, sans son texte (invariant 1).
  assert.match(lu, new RegExp(`Le Scribe ${r.sceaux} points`))
  assert.match(lu, /Sa question : Histoire · facile/)
  // Ce que la réponse fera, en deux tuiles : les chiffres du serveur.
  assert.match(lu, new RegExp(`Si tu as juste Il perd ${r.apercu!.juste.brises} `))
  assert.match(lu, new RegExp(`Si tu te trompes Tu perds ${r.apercu!.faux.perdu} de courage`))
  // La main : chaque carte dessinée, sans un mot — son dessin, son coût, son chiffre (« trop de détails écrits en dessous de
  // chaque icône, ne pas les mettre direct mais les faire apparaître si on clique dessus ») ; ce qu'elle fait se dit à l'oreille,
  // et levée. Celles de pendant la question à part, éteintes.
  assert.match(html, /data-carte="concentration"[^>]*><span class="exp-vc exp-vc-main"[^>]*><span class="exp-vc-cout">1<\/span><span class="exp-vc-art">[\s\S]*?<\/span><b class="exp-vc-valeur">\+4<\/b><span class="exp-vc-gemme"><\/span><\/span><span class="sr-only">Concentration : \+4 si juste, 1 d’énergie<\/span>/)
  assert.doesNotMatch(html.slice(html.indexOf('class="exp-cartes"')), /exp-vc-texte|exp-vc-nom/, 'aucun mot sur les cartes de la main')
  assert.match(html, /class="exp-cartes-groupe exp-cartes-plus-tard"[^>]*><span class="exp-cartes-quand">Pendant la question<\/span><div class="exp-cartes-main"><button type="button" class="exp-face exp-face-eteinte"[^>]*data-carte="coup-d-oeil"/)
  assert.doesNotMatch(html, /exp-cartes-plus-tard[\s\S]*data-carte="concentration"/, 'une carte d’avant la question n’attend pas la question')
  // L'énergie : son orbe, son chiffre, son mot.
  assert.match(html, /<span class="exp-energie" role="img" aria-label="3 d’énergie pour jouer tes cartes"><b class="exp-vc-cout" aria-hidden="true">3<\/b><span aria-hidden="true">d’énergie<\/span><\/span>/)
  assert.match(lu, /Parier \? Non/)
  // Les règles, déjà vues : au « ? » de la barre, plus sous le bouton (« Comment ça marche ? »).
  assert.doesNotMatch(html, /feuille-regles|exp-comment|Comment ça marche/)
})

test('à la première rencontre, les règles s’ouvrent d’elles-mêmes, la rencontre d’abord, « Compris »', async () => {
  // « Pas besoin d'explication pour tout, il faudrait juste un onglet règles qu'on peut consulter de n'importe quelle page. »
  stockage(false)
  const html = await preparation(rencontreAvec(['concentration']))
  assert.match(html, /class="carte-feuille feuille-regles" role="dialog" aria-modal="true" aria-label="Les règles"/)
  const regles = html.slice(html.indexOf('feuille-regles'))
  assert.deepEqual(
    [...regles.matchAll(/<h3 class="label" id="exp-regles-[^"]+">([^<]*)<\/h3>/g)].map(m => m[1]),
    ['Une rencontre', 'Tes cartes', 'Le pari', 'L’expédition', 'Le plan', 'Tes récompenses', 'Ton équipe', 'Ton passeport'],
  )
  const lu = texte(regles)
  assert.match(lu, /Réponds juste : l’adversaire perd des points\. À zéro, il tombe\./)
  assert.match(lu, /Trompe-toi : il t’attaque, et tu perds du courage\./)
  assert.match(lu, /Chaque carte coûte de l’énergie — le chiffre dans son coin\. Tu en as 3 à chaque question\./)
  assert.match(lu, /Une carte posée pour toute la rencontre se montre en haut de l’écran/)
  assert.match(lu, /Compris/)
  assert.doesNotMatch(lu, JARGON)
  // Pas même à la place du jeu : l'écran reste dessous, entier.
  assert.match(html, /exp-voir/)
  stockage(true)
})

test('les règles disent les cartes que tire chaque acte, telles que le serveur les donne', async () => {
  const { FeuilleDesRegles } = await pieces()
  const v6 = texte(await rendre(FeuilleDesRegles, { rencontres: true, parQuestion: [3, 4, 5], onFermer: rien }))
  assert.match(v6, /Tu tires 3 cartes à chaque question de l’acte 1, 4 à l’acte 2, 5 à l’acte 3\./)
  // Une expédition partie avant la main qui grandit : cinq partout.
  assert.match(texte(await rendre(FeuilleDesRegles, { rencontres: true, parQuestion: [5, 5, 5], onFermer: rien })), /Tu tires 5 cartes à chaque question\./)
  // Aux règles d'avant — la production —, trois vies et des jokers ; `debut` met sa section en tête.
  const jokers = await rendre(FeuilleDesRegles, { rencontres: false, debut: 'plan', onFermer: rien })
  assert.equal(/<h3 class="label" id="exp-regles-([^"]+)">/.exec(jokers)?.[1], 'plan')
  assert.match(texte(jokers), /Trois vies : chaque erreur en coûte une\./)
  assert.doesNotMatch(texte(jokers), /énergie|courage/)
})

test('la carte levée : ce qu’elle fait en une phrase, quand elle se joue, ce qu’elle changerait ; refusée, pourquoi', async () => {
  const { CarteLevee, changementDeLaCarte } = await pieces()
  const j = rencontreAvec(['concentration', 'coup-d-oeil'])
  const r = j.vue()
  const base = r.apercu!.juste.brises
  const html = await rendre(CarteLevee, { cle: 'concentration', refus: null, busy: false, changement: changementDeLaCarte(r, 0, 'Histoire', 'concentration'), onJouer: rien, onReposer: rien })
  const lu = texte(html)
  assert.match(lu, /Concentration Si tu réponds juste, l’adversaire perd 4 de plus\. Avant de voir la question/)
  assert.match(lu, new RegExp(`Avec cette carte Si tu as juste : il perd ${base} il perd ${base + 4}`))
  assert.match(lu, /Jouer « Concentration »/)
  assert.match(lu, /Elle coûte 1 d’énergie\./)
  // Dessinée en grand : l'orbe de son coût au coin, son illustration, son nom au bandeau.
  assert.match(html, /<span class="exp-vc exp-vc-levee" style="[^"]*"><span class="exp-vc-cout">1<\/span><span class="exp-vc-art">[\s\S]*?<\/span><b class="exp-vc-nom">Concentration<\/b>/)
  // Refusée : pourquoi, sans rien promettre ni rien à jouer.
  const refusee = await rendre(CarteLevee, { cle: 'coup-d-oeil', refus: r.refus['coup-d-oeil'], busy: false, changement: changementDeLaCarte(r, 0, 'Histoire', 'coup-d-oeil'), onJouer: rien, onReposer: rien })
  assert.match(texte(refusee), /Elle se joue pendant la question : vois-la d’abord/)
  assert.doesNotMatch(refusee, /Avec cette carte|btn-primary/)
})

test('ce que la réponse fera : la perte de courage toujours dite, son attaque et ce que le bouclier en pare', async () => {
  const { Apercu } = await pieces()
  const a = (faux: Partial<ApercuDuTour['faux']>): ApercuDuTour => ({ juste: { brises: 10, tombe: false, ecus: 5 }, faux: { frappe: 5, absorbee: 0, perdu: 5, ecus: 10, contre: 0, charge: false, ...faux } })
  // Tout paré : « Tu ne perds rien » à côté de « −10 écus de ton pari » se contredisait.
  const pare = texte(await rendre(Apercu, { a: a({ absorbee: 5, perdu: 0 }) }))
  assert.match(pare, /Si tu te trompes Tu perds 0 de courage son attaque fait 5 : ton bouclier pare tout −10 écus de ton pari/)
  const entame = texte(await rendre(Apercu, { a: a({ frappe: 9, absorbee: 5, perdu: 4 }) }))
  assert.match(entame, /Tu perds 4 de courage son attaque fait 9, ton bouclier en pare 5/)
  assert.match(texte(await rendre(Apercu, { a: a({ frappe: 0, perdu: 0 }) })), /Tu perds 0 de courage il ne t’attaque pas/)
  // Ce que ses cartes ajoutent se dit à part ; la question sous les yeux, les deux chiffres seuls.
  const base: ApercuDuTour = { juste: { brises: 6, tombe: false, ecus: 0 }, faux: a({}).faux }
  assert.match(texte(await rendre(Apercu, { a: a({}), base })), /Il perd 10 dont \+4 grâce à tes cartes \+5 écus de ton pari/)
  assert.equal(texte(await rendre(Apercu, { a: a({}), compact: true })).trim(), 'Si tu as juste Il perd 10 Si tu te trompes Tu perds 5 de courage')
})

test('la question vue, la main ne montre que les cartes qui se jouent pendant — et rien s’il n’y en a pas', async () => {
  const { MainDeRencontre } = await pieces()
  const pile = { compte: 4, mot: 'pioche', dit: 'Ta pioche : 4 cartes', onOuvrir: rien }
  const refus = { concentration: 'Elle se joue avant de voir la question', 'coup-d-oeil': null }
  const html = await rendre(MainDeRencontre, { cles: ['concentration', 'coup-d-oeil'], refus, busy: false, inspiration: 2, phase: 'question', pile, onJouer: rien })
  assert.match(html, /data-carte="coup-d-oeil"/)
  assert.doesNotMatch(html, /data-carte="concentration"|exp-cartes-quand/)
  assert.equal(await rendre(MainDeRencontre, { cles: ['concentration'], refus, busy: false, inspiration: 2, phase: 'question', pile, onJouer: rien }), '')
})

test('les cartes posées pour toute la rencontre se montrent en haut, comme un talisman ; touchée, elle se lève — à côté du « ? » des règles', async () => {
  // « Pour les cartes qui restent toute la manche, peut-être qu'il faudrait un icône en haut pour montrer qu'on l'a tout le long
  // (ex : comme un talisman visible). Parce que des trucs écrits partout c'est trop d'infos. » Elles se disaient en toutes lettres sous la main.
  const { Barre } = (await import(new URL('../../client/src/views/ExpeditionApp.tsx', import.meta.url).href)) as { Barre: Composant }
  const j = rencontreAvec(['tresor'])
  j.jouer('tresor')
  const r = j.vue()
  assert.deepEqual(r.pouvoirs, ['tresor'])
  const html = await rendre(Barre, { vue: { ecus: 25, vies: 3, talismans: [], courage: 50, rencontre: r, cartes: { paquet: j.etat().paquet, route: [], refus: {}, parQuestion: [3, 4, 5] } }, onPartir: rien })
  assert.match(
    html,
    /<span class="exp-posees" role="group" aria-label="Posées pour toute la rencontre"><button type="button" class="exp-pose" style="--gemme:#[0-9a-f]{6}" data-carte="tresor" aria-haspopup="dialog" aria-label="Le trésor">/,
  )
  // Le « ? » des règles, juste après « ← Partir » : de n'importe quelle page.
  assert.match(html, /<button type="button" class="exp-regles" aria-haspopup="dialog" aria-label="Les règles">/)
  assert.ok(html.indexOf('exp-regles') < html.indexOf('exp-posees'))
  // La main, elle, ne les redit plus.
  const { MainDeRencontre } = await pieces()
  const main = await rendre(MainDeRencontre, { cles: r.main, refus: r.refus, busy: false, inspiration: r.inspiration, pile: { compte: 0, mot: 'pioche', dit: '', onOuvrir: rien }, onJouer: rien })
  assert.doesNotMatch(main, /exp-cartes-posees|Le trésor/)
})

// ── L'énergie et les vraies cartes ──────────────────────────────────────────

test('l’énergie : un orbe chiffré au-dessus de la main, le même au coin de chaque carte — rouge, quand il n’en reste pas assez', async () => {
  // « L'histoire de l'inspiration n'est pas du tout claire » : des étincelles allumées et éteintes ne disaient ni ce qu'elles comptaient, ni ce qu'une carte en prenait.
  const { MainDeRencontre } = await pieces()
  const pile = { compte: 4, mot: 'pioche', dit: 'Ta pioche : 4 cartes', onOuvrir: rien }
  const refus = { concentration: null, sursis: 'Il lui faut 2 d’énergie : il t’en reste 1', echange: null }
  const html = await rendre(MainDeRencontre, { cles: ['concentration', 'sursis', 'echange'], refus, busy: false, inspiration: 1, pile, onJouer: rien })
  assert.match(html, /aria-label="1 d’énergie pour jouer tes cartes"><b class="exp-vc-cout" aria-hidden="true">1<\/b>/)
  const cout = (cle: string) => new RegExp(`data-carte="${cle}"[^>]*><span class="exp-vc[^"]*"[^>]*><span class="([^"]*)">(\\d)<\\/span>`).exec(html)
  assert.deepEqual(cout('concentration')?.slice(1), ['exp-vc-cout', '1'])
  assert.deepEqual(cout('sursis')?.slice(1), ['exp-vc-cout exp-vc-manque', '2'], 'deux, quand il en a un : rouge')
  assert.deepEqual(cout('echange')?.slice(1), ['exp-vc-cout', '0'], 'gratuite : zéro, dans le même orbe')
  // Ce qui se dit à l'oreille dit l'énergie aussi.
  assert.match(texte(html), /Sursis : Erreur gratuite, 2 d’énergie, pas maintenant/)
  assert.doesNotMatch(texte(html), JARGON)
})

test('une carte se lit à la version de son départ : retouchée par le codex, elle garde ses chiffres d’avant dans une expédition d’avant', async () => {
  const { MainDeRencontre, VersionDesCartes } = (await pieces()) as Pieces & { VersionDesCartes: React.Context<number> }
  const pile = { compte: 4, mot: 'pioche', dit: 'Ta pioche : 4 cartes', onOuvrir: rien }
  const main = (v: number) =>
    rendre(
      (() => React.createElement(VersionDesCartes.Provider, { value: v }, React.createElement(MainDeRencontre, { cles: ['troisieme-oeil', 'echauffement'], refus: { 'troisieme-oeil': null, echauffement: null }, busy: false, inspiration: 3, pile, onJouer: rien }))) as Composant,
      {},
    )
  const cout = (html: string, cle: string) => new RegExp(`data-carte="${cle}"[^>]*><span class="exp-vc[^"]*"[^>]*><span class="[^"]*">(\\d)<\\/span>`).exec(html)?.[1]
  const valeur = (html: string, cle: string) => new RegExp(`data-carte="${cle}"[\\s\\S]*?<b class="exp-vc-valeur">([^<]*)</b>`).exec(html)?.[1]
  const codex = await main(7)
  assert.deepEqual([cout(codex, 'troisieme-oeil'), valeur(codex, 'echauffement')], ['1', '+2'], 'le codex : Troisième œil coûte un, Échauffement frappe')
  assert.match(texte(codex), /Échauffement : \+2, série \+1, gratuite/)
  const avant = await main(6)
  assert.deepEqual([cout(avant, 'troisieme-oeil'), valeur(avant, 'echauffement')], ['2', '+1'], 'une expédition partie avant le codex se joue — et se lit — à ses chiffres d’alors')
  assert.match(texte(avant), /Échauffement : Série \+1, gratuite/)
})

test('ses tas en vraies cartes qui défilent : une par sorte, « ×4 » au coin ; touchée, elle se montre en grand', async () => {
  // « Voir la pioche on voit uniquement des noms, ça serait pas possible de voir les vraies cartes, de pouvoir les faire défiler ? »
  const { FeuilleDesCartes } = await pieces()
  const j = rencontreAvec(['concentration'])
  const html = await rendre(FeuilleDesCartes, { paquet: j.etat().paquet, rencontre: j.vue(), onFermer: rien })
  assert.doesNotMatch(html, /exp-jeton/, 'plus de noms en jetons')
  const rangees = [...html.matchAll(/<h3 class="label">([^<]*)<\/h3>(?:<ul class="exp-rangee" aria-label="[^"]*">([\s\S]*?)<\/ul>|<p[^>]*>([^<]*)<\/p>)/g)].map(m => ({ titre: m[1], cartes: [...(m[2] ?? '').matchAll(/data-carte="([^"]+)"/g)].map(x => x[1]), vide: m[3] }))
  assert.deepEqual(
    rangees.map(r => r.titre.replace(/ · \d+$/, '')),
    ['Ta pioche', 'Ta défausse', 'Tout ton paquet'],
  )
  // Tout son paquet : chaque sorte une fois, dans l'ordre du catalogue, son nombre au coin.
  const paquet = rangees[2]
  assert.deepEqual(paquet.cartes, ['concentration', 'prudence', 'coup-d-oeil', 'echange', 'peau-de-feu', 'tresor'])
  assert.match(html, /data-carte="concentration"[^>]*><span class="exp-vc exp-vc-rangee"[\s\S]*?<b class="exp-vc-nombre">×4<\/b>/)
  assert.match(rangees[1].vide ?? '', /Rien en défausse/)
  assert.equal(rangees[0].titre, `Ta pioche · ${j.vue().pioche}`)
  // Chaque carte est un bouton qui la montre en grand.
  assert.equal((html.match(/class="exp-rangee-carte"[^>]*aria-haspopup="dialog"/g) ?? []).length, rangees.reduce((n, r) => n + r.cartes.length, 0))
})

test('l’offre : trois vraies cartes côte à côte ; la touchée s’éclaire, et sa phrase se lit dessous', async () => {
  const { CartesAPrendre } = await pieces()
  const html = await rendre(CartesAPrendre, { cles: ['corser', 'banco', 'sursis'], prises: ['banco'], onToucher: rien })
  const cartes = [...html.matchAll(/<button type="button" class="(exp-a-prendre-carte[^"]*)" aria-pressed="(true|false)" data-carte="([^"]+)">/g)].map(m => [m[3], m[2], m[1]])
  assert.deepEqual(cartes, [
    ['corser', 'false', 'exp-a-prendre-carte'],
    ['banco', 'true', 'exp-a-prendre-carte exp-choisi'],
    ['sursis', 'false', 'exp-a-prendre-carte'],
  ])
  assert.equal((html.match(/class="exp-vc exp-vc-rangee"/g) ?? []).length, 3)
  const dit = texte(html.slice(html.indexOf('exp-a-prendre-dit')))
  assert.match(dit, /Banco rare Si tu as juste, ton pari frappe aussi : l’adversaire perd 1 de plus par tranche de cinq écus pariés\. 1 d’énergie · Avant de voir la question/)
  // Sur la carte, son nom et son chiffre — sa phrase ne se lit que touchée.
  assert.match(html, /data-carte="corser">[\s\S]*?<b class="exp-vc-valeur">×1,5<\/b><b class="exp-vc-nom">Corser<\/b><span class="exp-vc-gemme">/)
  assert.doesNotMatch(html.slice(0, html.indexOf('exp-a-prendre-dit')), /exp-vc-texte/)
  // Rien de touché, rien dessous : le détail apparaît au toucher.
  assert.doesNotMatch(await rendre(CartesAPrendre, { cles: ['corser', 'banco', 'sursis'], prises: [], onToucher: rien }), /exp-a-prendre-dit|Touche une carte/)
})

// ── Le codex et le plan ─────────────────────────────────────────────────────

test('le codex : toutes les cartes de l’expédition, une page par rareté en onglets qui comptent ; touchée, une carte se lève', async () => {
  // « Est-ce que l'on ferait pas un codex de carte global aussi, avec de commun à légendaire ? » (le 18 octobre 2026)
  const { FeuilleDuCodex } = (await pieces()) as unknown as { FeuilleDuCodex: Composant }
  assert.equal(typeof FeuilleDuCodex, 'function', 'le codex est une feuille (`FeuilleDuCodex`)')
  const html = await rendre(FeuilleDuCodex, { onFermer: rien })
  assert.match(html, /class="carte-feuille feuille-codex" role="dialog" aria-modal="true" aria-label="Ton codex"/)
  // Les onglets : toutes, puis de la commune à la légendaire, chacun son compte.
  const compte = (r: string) => CARTES_DES_RENCONTRES.filter(c => c.rarete === r).length
  assert.deepEqual(
    [...html.matchAll(/role="tab" aria-selected="(true|false)"[^>]*>([^<]+)<span class="onglet-pastille" aria-hidden="true">(\d+)<\/span>/g)].map(m => [m[2], Number(m[3]), m[1]]),
    [
      ['Toutes', CARTES_DES_RENCONTRES.length, 'true'],
      ['Communes', compte('commun'), 'false'],
      ['Rares', compte('rare'), 'false'],
      // Le jeu complet : une page de plus, entre les rares et les légendaires.
      ['Épiques', compte('epique'), 'false'],
      ['Maudites', compte('maudit'), 'false'],
      ['Légendaires', compte('legendaire'), 'false'],
    ],
  )
  // Toutes ses cartes, dans l'ordre du catalogue, en vraies cartes qu'on touche pour les lever.
  const grille = html.slice(html.indexOf('class="exp-codex"'))
  assert.deepEqual(
    [...grille.matchAll(/<button type="button" class="exp-codex-carte" data-carte="([^"]+)" aria-haspopup="dialog">/g)].map(m => m[1]),
    CARTES_DES_RENCONTRES.map(c => c.cle),
  )
  assert.equal((grille.match(/class="exp-vc exp-vc-rangee/g) ?? []).length, CARTES_DES_RENCONTRES.length)
  assert.match(texte(grille), /Concentration, commune : \+4 si juste/)
})

// ── Le codex qui s'ouvre en jouant (la version 7) ─────────────────────────────

/** Les pièces du codex : sa feuille, son niveau, ce que la fin rapporte. */
const piecesDuCodex = async () => (await pieces()) as unknown as Pieces & { FeuilleDuCodex: Composant; RenommeeGagnee: Composant; NiveauDExplorateur: Composant }

test('le codex à son niveau : sa jauge de renommée en tête, ce qu’il a sur ce qu’il y a ; les cartes qu’il n’a pas éteintes, comment les ouvrir dessous', async () => {
  const { FeuilleDuCodex, CarteLevee } = await piecesDuCodex()
  const { NIVEAUX, codexDuNiveau } = await import('../../shared/codex')
  const ouvert = codexDuNiveau(3, ['lg:phenix'])
  const html = await rendre(FeuilleDuCodex, { codex: { renommee: NIVEAUX[2] + 20, ...ouvert }, onFermer: rien })
  const t = texte(html)
  assert.match(t, new RegExp(`Niveau 3 d’explorateur : ${NIVEAUX[2] + 20} de renommée, ${NIVEAUX[3]} pour le niveau 4\\.`))
  assert.match(t, new RegExp(`${ouvert.cartes.length} cartes sur ${CARTES_DES_RENCONTRES.length} sont à toi`))
  const fermees = [...html.matchAll(/<li class="exp-codex-fermee"><button type="button" class="exp-codex-carte" data-carte="([^"]+)"/g)].map(m => m[1])
  assert.deepEqual(fermees, CARTES_DES_RENCONTRES.filter(c => !ouvert.cartes.includes(c.cle)).map(c => c.cle), 'toutes les autres, éteintes')
  assert.ok(!fermees.includes('renaissance') && fermees.includes('sagesse'), 'la carte du Phénix, qu’il a ; pas celle de la Chouette')
  // Dessous, en court : le niveau qui l'ouvre, ou le légendaire qui la donne ; à l'oreille, en phrase.
  assert.match(html, /data-carte="detour"[\s\S]*?<span class="exp-codex-ouverture" aria-hidden="true">[\s\S]*?Niveau 4<\/span>/)
  assert.match(t, /Le détour, commune : Va où tu veux\. Elle s’ouvre au niveau 4 d’explorateur\./)
  assert.match(t, /Sagesse, légendaire : [^.]+\. Elle s’ouvre quand la Chouette d’Argent est à toi — gagnée en soirée, au quiz du jour, en campagne ou en expédition\./)
  // Levée, une carte fermée dit comment l'ouvrir.
  assert.match(texte(await rendre(CarteLevee, { cle: 'detour', ouverture: 'Elle s’ouvre au niveau 4 d’explorateur.', onReposer: rien })), /Elle s’ouvre au niveau 4 d’explorateur\./)
  // Sans codex — une expédition d'avant —, tout est ouvert, comme avant.
  assert.doesNotMatch(await rendre(FeuilleDuCodex, { onFermer: rien }), /exp-codex-fermee/)
})

test('la fin dit la renommée qu’elle rapporte, et le niveau qu’elle fait passer : ses cartes neuves en vraies cartes, la règle qui s’ouvre', async () => {
  const { RenommeeGagnee } = await piecesDuCodex()
  const { ECHELLE, NIVEAUX } = await import('../../shared/codex')
  const monte = await rendre(RenommeeGagnee, { avant: NIVEAUX[1] - 10, gagnee: 30 })
  assert.match(texte(monte), /\+30 de renommée Tu passes au niveau 2 Niveau 2 d’explorateur/)
  const duNiveau2 = ECHELLE.find(m => m.niveau === 2)!.cartes
  assert.deepEqual([...monte.matchAll(/class="exp-codex-carte" data-carte="([^"]+)"/g)].map(m => m[1]), [...duNiveau2], 'les cartes du niveau 2, à lever')
  assert.match(texte(monte), new RegExp(`Ces ${duNiveau2.length} cartes rejoignent ton codex : tes récompenses les proposeront dès ta prochaine expédition\\.`))
  assert.match(texte(monte), /Le pari s’ouvre : avant de voir une question, parie des écus\./)
  // Sans niveau passé : la renommée et la jauge, rien de neuf.
  const sansNiveau = await rendre(RenommeeGagnee, { avant: NIVEAUX[1], gagnee: 5 })
  assert.match(texte(sansNiveau), /\+5 de renommée/)
  assert.doesNotMatch(sansNiveau, /exp-renommee-niveau|exp-codex-carte|exp-renommee-regle/)
  assert.doesNotMatch(texte(monte), JARGON)
})

test('les règles au codex : la renommée et ce que chaque niveau ouvre ; une règle fermée dit le niveau qui l’ouvre ; plus d’équipe', async () => {
  const { FeuilleDesRegles } = await pieces()
  // Au niveau 1, la catégorie fétiche seule (« Ton style », le 19 octobre 2026 : l'Érudit en vit dès le départ).
  const fermees = texte(await rendre(FeuilleDesRegles, { rencontres: true, parQuestion: [3, 4, 5], codex: { regles: ['fetiche'] }, onFermer: rien }))
  assert.match(fermees, /Ton codex/)
  assert.match(fermees, /Chaque expédition, même perdue, te rapporte de la renommée : \+1 par escale, \+3 par adversaire tombé, \+6 par élite, \+12 par gardien, \+25 au bout\./)
  for (const r of [/Il s’ouvre au niveau 2 d’explorateur\./, /Elles s’ouvrent au niveau 3 d’explorateur\./, /Les talismans s’ouvrent au niveau 4 d’explorateur\./]) {
    assert.match(fermees, r)
  }
  assert.match(fermees, /Ta catégorie fétiche, que choisit l’Érudit : Plume, Bibliothèque et Génie frappent plus fort sur ses questions\./)
  assert.match(fermees, /Un gardien vaincu, aux actes 1 et 2 : son trésor propose une carte légendaire de ton codex\./)
  assert.doesNotMatch(fermees, /Ton équipe|Les légendaires que tu emmènes/, 'au codex, plus d’équipe à choisir')
  // Une expédition partie avant, son codex figé sans elle : elle s'ouvre à la prochaine — « au niveau 1 » se lirait comme une erreur.
  const avant = texte(await rendre(FeuilleDesRegles, { rencontres: true, parQuestion: [3, 4, 5], codex: { regles: [] }, onFermer: rien }))
  assert.match(avant, /Ta catégorie fétiche s’ouvre dès ta prochaine expédition\./)
  assert.doesNotMatch(avant, /au niveau 1 d’explorateur/)
  const ouvertes = texte(await rendre(FeuilleDesRegles, { rencontres: true, parQuestion: [3, 4, 5], codex: { regles: ['fetiche', 'pari', 'fioles', 'talismans'] }, onFermer: rien }))
  assert.doesNotMatch(ouvertes, /s’ouvrent? (au niveau|dès)/)
  for (const t of [fermees, avant, ouvertes]) assert.doesNotMatch(t, JARGON)
})

test('les exploits : une carte qu’un exploit ouvre le dit dessous ; au pied du codex, les quatre — faits ou à faire —, le dos doré ; la fin et les règles les disent', async () => {
  // La proposition du codex : « Dans le codex, une carte verrouillée dit toujours comment l'obtenir : un niveau, un exploit ou un légendaire. »
  const { FeuilleDuCodex, RenommeeGagnee, FeuilleDesRegles, MainDeRencontre } = await piecesDuCodex()
  const { codexDuNiveau, NIVEAUX } = await import('../../shared/codex')
  const ouvert = codexDuNiveau(3, [], ['gardien-intact'])
  const html = await rendre(FeuilleDuCodex, { codex: { renommee: NIVEAUX[2], ...ouvert }, onFermer: rien })
  const t = texte(html)
  assert.match(html, /data-carte="banco"[\s\S]*?<span class="exp-codex-ouverture" aria-hidden="true">[\s\S]*?Exploit<\/span>/)
  assert.match(t, /Banco, rare : Le pari frappe\. Elle s’ouvre par un exploit : gagner un pari de 40 écus\./)
  assert.match(t, /Tes exploits · 1 sur 4/)
  assert.deepEqual(
    [...html.matchAll(/<li class="exp-exploit( exp-exploit-fait)?">/g)].map(m => !!m[1]),
    [false, false, false, true],
    'dans leur ordre ; le gardien sans perdre de courage, fait',
  )
  assert.match(t, /gagner un pari de 40 écus Ouvre Banco\./)
  assert.match(t, /vaincre le gardien de l’acte 3 sans perdre de courage Fait : le dos doré est à toi\./)
  assert.match(html, /class="exp-pioche exp-dos-miniature exp-dos-dore"/, 'le dos doré tel que la pioche le porte')
  // La fin : chaque exploit neuf, ce qu'il ouvre ; ses cartes avec celles du niveau.
  const fin = await rendre(RenommeeGagnee, { avant: NIVEAUX[1], gagnee: 5, exploits: ['une-seule-reponse', 'gardien-intact'] })
  const tf = texte(fin)
  assert.match(tf, /Exploit : faire tomber une élite d’une seule réponse — Génie rejoint ton codex\./)
  assert.match(tf, /Exploit : vaincre le gardien de l’acte 3 sans perdre de courage — le dos doré est à toi\./)
  assert.deepEqual([...fin.matchAll(/class="exp-codex-carte" data-carte="([^"]+)"/g)].map(m => m[1]), ['genie'])
  assert.match(tf, /Elle rejoint ton codex : tes récompenses la proposeront dès ta prochaine expédition\./)
  // Les règles : une ligne par exploit, au codex seulement.
  const regles = texte(await rendre(FeuilleDesRegles, { rencontres: true, parQuestion: [3, 4, 5], codex: { regles: [] }, onFermer: rien }))
  for (const r of [
    /Les exploits/,
    /Un exploit se fait une fois, dans n’importe quelle expédition — même perdue ensuite\./,
    /Exploit : gagner un pari de 40 écus — Banco rejoint ton codex\./,
    /Exploit : faire tomber une élite d’une seule réponse — Génie rejoint ton codex\./,
    /Exploit : répondre juste 20 fois d’affilée — Inarrêtable rejoint ton codex\./,
    /Exploit : vaincre le gardien de l’acte 3 sans perdre de courage — le dos doré est à toi\./,
  ]) {
    assert.match(regles, r)
  }
  assert.doesNotMatch(texte(await rendre(FeuilleDesRegles, { rencontres: true, parQuestion: [3, 4, 5], onFermer: rien })), /Les exploits/, 'avant le codex, aucun')
  // Le dos doré sur le plan : la pioche du paquet en or.
  const pile = { compte: 12, mot: 'paquet', dit: 'Ton paquet : 12 cartes', onOuvrir: rien }
  assert.match(await rendre(MainDeRencontre, { cles: [], refus: {}, busy: false, enPetit: true, pile, dos: 'dore', onJouer: rien }), /class="exp-pioche exp-dos-dore"/)
  assert.match(await rendre(MainDeRencontre, { cles: [], refus: {}, busy: false, enPetit: true, pile, onJouer: rien }), /class="exp-pioche"/)
  for (const x of [t, tf, regles]) assert.doesNotMatch(x, JARGON)
})

test('les exploits neufs : ceux que son codex n’avait pas au départ — un départ d’avant les exploits n’en dit aucun ; le dos doré, de son codex', async () => {
  const { exploitsNeufs, dosDuPaquet } = (await pieces()) as unknown as {
    exploitsNeufs: (v: unknown) => string[]
    dosDuPaquet: (v: unknown) => string | undefined
  }
  const codex = (exploits?: string[]) => ({ cartes: { codex: { niveau: 3, regles: [], ...(exploits && { exploits }) } } })
  assert.deepEqual(exploitsNeufs({ exploits: ['d-affilee', 'gardien-intact'], ...codex(['gardien-intact']) }), ['d-affilee'])
  assert.deepEqual(exploitsNeufs({ exploits: ['d-affilee'], ...codex() }), [], 'il aurait pu dire neuf un exploit déjà fait')
  assert.deepEqual(exploitsNeufs({ exploits: ['d-affilee'] }), [], 'avant le codex, rien')
  assert.equal(dosDuPaquet(codex(['gardien-intact'])), 'dore')
  assert.equal(dosDuPaquet({ exploits: ['gardien-intact'], ...codex([]) }), undefined, 'fait en route : il dorera la suivante')
})

test('au niveau 1, la préparation ne propose pas de pari : la première expédition n’a que ses cartes, son énergie et son courage', async () => {
  const { codexDuNiveau } = await import('../../shared/codex')
  stockage(true)
  const un = new Journal({ ...depart('sans-pari'), v: 7, codex: { ...codexDuNiveau(1, []), renommee: 0 } })
  un.geste({ quoi: 'avancer', vers: 'e00' })
  const html = await preparation(un)
  assert.doesNotMatch(html, /class="exp-mises"/, 'pas de pari')
  assert.match(html, /exp-voir/, '« Voir la question » reste')
  const deux = new Journal({ ...depart('avec-pari'), v: 7, codex: { ...codexDuNiveau(2, []), renommee: 30 } })
  deux.geste({ quoi: 'avancer', vers: 'e00' })
  assert.match(await preparation(deux), /class="exp-mises"/, 'au niveau 2, il parie')
})

test('le plan, plus « la carte » : le même mot disait la carte de l’acte et les cartes de la main', async () => {
  // La recommandation du codex, validée le 18 octobre 2026 : « Le même mot désigne aujourd'hui la carte de l'acte et les cartes
  // de la main, sur le même écran. » Ce que lit le joueur — une carte, un joker, un talisman, un refus, les règles — dit « le plan ».
  const CARTE_DE_L_ACTE = /sur (la|cette|ta) carte|(La|la) carte ne dit|La carte ·|Retour à la carte|carte n°/i
  const { JOKERS_DES_LEGENDAIRES, JOKERS_SANS_LEGENDAIRE, TALISMANS } = await import('../../shared/jokers')
  for (const x of [...TOUTES_LES_VERSIONS, ...JOKERS_DES_LEGENDAIRES, ...JOKERS_SANS_LEGENDAIRE, ...TALISMANS]) assert.doesNotMatch(x.effet, CARTE_DE_L_ACTE, `${x.cle} : « ${x.effet} »`)
  const { FeuilleDesRegles, CarteLevee } = await pieces()
  for (const rencontres of [true, false]) {
    const regles = texte(await rendre(FeuilleDesRegles, { rencontres, onFermer: rien }))
    assert.doesNotMatch(regles, CARTE_DE_L_ACTE)
    assert.match(regles, /Le plan/)
  }
  // Une carte de route dit quand elle se joue ; son refus en rencontre, `expedition-rencontres.test.ts`.
  assert.match(texte(await rendre(CarteLevee, { cle: 'detour', onReposer: rien })), /Sur le plan, une fois par acte/)
})

test('au campement, la carte à retirer se choisit parmi ses vraies cartes', async () => {
  const { RangeeDeCartes } = await pieces()
  const html = await rendre(RangeeDeCartes, { cles: ['concentration', 'concentration', 'prudence', 'echange'], vide: '', nom: 'La carte à retirer', choisie: 'prudence', onRegarder: rien })
  assert.deepEqual(
    [...html.matchAll(/class="(exp-rangee-carte[^"]*)" data-carte="([^"]+)" aria-pressed="(true|false)"/g)].map(m => [m[2], m[3], m[1]]),
    [
      ['concentration', 'false', 'exp-rangee-carte'],
      ['prudence', 'true', 'exp-rangee-carte exp-choisi'],
      ['echange', 'false', 'exp-rangee-carte'],
    ],
  )
  assert.doesNotMatch(html, /aria-haspopup/, 'touchée, elle se choisit : rien ne se lève')
})

// ── Les objets (le codex) : les fioles et les dos ───────────────────────────

interface PiecesDesObjets {
  SesFioles: Composant
  FioleLevee: Composant
  ChoixDuDos: Composant
  BoireUneFiole: React.Context<((fiole: string) => void) | null>
  dosDuPaquet: (v: unknown) => string | undefined
}
const piecesDesObjets = async () => (await pieces()) as unknown as PiecesDesObjets

test('les fioles, dans la barre : celles qu’il porte, rien sans elles ; levée, ce qu’elle fait et « La boire » — ou pourquoi pas maintenant ; sans le geste, elle se regarde', async () => {
  const { SesFioles, FioleLevee, BoireUneFiole } = await piecesDesObjets()
  assert.equal(await rendre(SesFioles, { fioles: { tenues: [], refus: {} } }), '', 'deux places vides ne diraient rien qu’on ne lise aux règles')
  const deux = await rendre(SesFioles, { fioles: { tenues: ['courage', 'clairvoyance'], refus: { courage: null, clairvoyance: 'Elle se boit la question sous les yeux' } } })
  assert.deepEqual([...deux.matchAll(/data-fiole="([^"]+)" aria-haspopup="dialog" aria-label="([^"]+)"/g)].map(m => [m[1], m[2]]), [
    ['courage', 'Fiole de courage'],
    ['clairvoyance', 'Fiole de clairvoyance'],
  ])
  const { renderToStaticMarkup } = await import('react-dom/server')
  const levee = (refus: string | null) =>
    texte(renderToStaticMarkup(React.createElement(BoireUneFiole.Provider, { value: rien }, React.createElement(FioleLevee, { cle: 'courage', refus, onReposer: rien }))))
  const buvable = levee(null)
  assert.match(buvable, /Fiole de courage/)
  assert.match(buvable, /\+10 de courage\./)
  assert.match(buvable, /Une fiole ne sert qu’une fois, quand tu veux — même la question sous les yeux\. Tu en portes 2 au plus\./)
  assert.match(buvable, /La boire/)
  const refusee = levee('Ton courage est au plus haut')
  assert.match(refusee, /Ton courage est au plus haut/)
  assert.doesNotMatch(refusee, /La boire/)
  assert.doesNotMatch(texte(await rendre(FioleLevee, { cle: 'energie', refus: null, onReposer: rien })), /La boire/, 'la révélation d’une réponse ne la boit pas')
  for (const t of [buvable, refusee]) assert.doesNotMatch(t, JARGON)
})

test('la barre : les écus et le courage toujours en haut à droite ; ce qu’il porte après eux, d’un bloc, qui passe à la ligne quand il ne tient plus', async () => {
  // Posé entre le « ? » et les écus, sur une ligne qui ne revenait pas, ce qu'il porte poussait le courage hors de l'écran : trois
  // cartes posées, trois talismans et deux fioles faisaient la page large de 509 pixels sur 360 ; deux fioles seules, de 18 de trop.
  const { Barre } = (await import(new URL('../../client/src/views/ExpeditionApp.tsx', import.meta.url).href)) as { Barre: Composant }
  const j = rencontreAvec(['tresor'])
  j.jouer('tresor')
  const vue = {
    ecus: 285,
    vies: 3,
    talismans: ['loupe', 'boussole'],
    courage: 50,
    rencontre: j.vue(),
    cartes: { paquet: j.etat().paquet, route: [], refus: {}, parQuestion: [3, 4, 5] },
    fioles: { tenues: ['courage', 'energie'], refus: {} },
  }
  const html = await rendre(Barre, { vue, onPartir: rien })
  const ordre = ['exp-regles', 'exp-ecus', 'exp-courage', 'exp-sac', 'exp-posees', 'exp-talismans', 'exp-fioles'].map(c => html.indexOf(`class="${c}`))
  assert.ok(
    ordre.every((i, k) => i >= 0 && (k === 0 || i > ordre[k - 1])),
    `le « ? », les écus, le courage, puis le sac — les cartes posées, les talismans, les fioles : ${ordre.join(', ')}`,
  )
  // Le sac est un seul bloc : il passe à la ligne entier, sous les écus, et rien d'autre ne bouge.
  assert.match(html, /<span class="exp-sac"><span class="exp-posees"[\s\S]*<span class="exp-fioles"[\s\S]*<\/span><\/span><\/div>$/)
  const css = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8')
  assert.match(css, /\n\.exp-barre \{[^}]*flex-wrap: wrap[^}]*justify-content: flex-end/, 'la barre revient à la ligne, à droite')
  assert.doesNotMatch(css, /\.exp-barre \.exp-(ecus|courage|posees|talismans|fioles|sac) \{[^}]*margin-left: auto/, 'une marge automatique à droite couperait la barre en deux à la ligne suivante')
  // Rien à porter, pas de sac vide.
  const nu = await rendre(Barre, { vue: { ...vue, talismans: [], rencontre: undefined, fioles: { tenues: [], refus: {} } }, onPartir: rien })
  assert.doesNotMatch(nu, /exp-sac/)
})

test('les règles des fioles : ce que chacune fait, où elles se trouvent ; fermées, le niveau qui les ouvre ; aux règles d’avant, aucune', async () => {
  const { FeuilleDesRegles } = await pieces()
  const ouvertes = texte(await rendre(FeuilleDesRegles, { rencontres: true, parQuestion: [3, 4, 5], codex: { regles: ['pari', 'fioles'] }, onFermer: rien }))
  for (const r of [
    /Les fioles/,
    /Une fiole ne sert qu’une fois : bois-la quand tu veux, même la question sous les yeux\. Tu en portes 2 au plus\./,
    /Fiole de courage : \+10 de courage\./,
    /Fiole d’énergie : \+2 d’énergie pour cette question\./,
    /Fiole de clairvoyance : efface une mauvaise réponse\./,
    /L’échoppe en vend une, 25 écus ; un coffre en cache une, à prendre à la place d’une carte\./,
  ]) {
    assert.match(ouvertes, r)
  }
  assert.doesNotMatch(ouvertes, /Elles s’ouvrent/)
  assert.doesNotMatch(ouvertes, JARGON)
  assert.doesNotMatch(texte(await rendre(FeuilleDesRegles, { rencontres: true, parQuestion: [3, 4, 5], onFermer: rien })), /Les fioles/, 'avant le codex, aucune')
})

test('les dos de cartes : au codex, ceux qu’il a et comment s’ouvrent les autres ; la fin du niveau 6 le dit ; au départ, il choisit — seul, rien à choisir', async () => {
  const { FeuilleDuCodex, RenommeeGagnee } = await piecesDuCodex()
  const { ChoixDuDos, dosDuPaquet } = await piecesDesObjets()
  const { codexDuNiveau, NIVEAUX } = await import('../../shared/codex')
  const html = await rendre(FeuilleDuCodex, { codex: { renommee: NIVEAUX[5], ...codexDuNiveau(6, []) }, onFermer: rien })
  const t = texte(html)
  assert.match(t, /Tes dos de cartes · 2 sur 3/)
  assert.match(t, /le dos ordinaire À toi : choisis-le au départ\. le dos étoilé À toi : choisis-le au départ\./)
  assert.match(t, /le dos doré Exploit : vaincre le gardien de l’acte 3 sans perdre de courage\./)
  assert.deepEqual([...html.matchAll(/<li class="exp-un-dos( exp-dos-ferme)?">/g)].map(m => !m[1]), [true, true, false], 'le doré, qu’il n’a pas, éteint')
  assert.match(html, /class="exp-pioche exp-dos-miniature exp-dos-etoile"/, 'l’étoilé tel que la pioche le portera')
  assert.match(texte(await rendre(FeuilleDuCodex, { codex: { renommee: NIVEAUX[4], ...codexDuNiveau(5, []) }, onFermer: rien })), /le dos étoilé Il s’ouvre au niveau 6 d’explorateur\./)
  // La fin qui fait passer le niveau 6 : son dos neuf ; celle du niveau 3, les fioles.
  assert.match(texte(await rendre(RenommeeGagnee, { avant: NIVEAUX[5] - 5, gagnee: 10 })), /Un dos neuf pour ton paquet : le dos étoilé\. Choisis-le au départ\./)
  assert.match(
    texte(await rendre(RenommeeGagnee, { avant: NIVEAUX[2] - 5, gagnee: 10 })),
    /Les fioles s’ouvrent : l’échoppe en vend, les coffres en cachent — 2 dans ton sac, à boire quand tu veux\./,
  )
  // Au départ : ses dos, celui qui partira coché ; un seul, rien à choisir.
  const choix = await rendre(ChoixDuDos, { siens: ['ordinaire', 'etoile'], dos: 'etoile', onChoisir: rien })
  assert.deepEqual([...choix.matchAll(/role="radio" aria-checked="(true|false)" aria-label="([^"]+)"/g)].map(m => [m[1], m[2]]), [
    ['false', 'le dos ordinaire'],
    ['true', 'le dos étoilé'],
  ])
  assert.equal(await rendre(ChoixDuDos, { siens: ['ordinaire'], dos: 'ordinaire', onChoisir: rien }), '')
  // Sur le plan, celui que le départ a pris ; un départ d'avant les dos, le doré de son exploit.
  const codex = { niveau: 6, regles: [], exploits: ['gardien-intact'] }
  assert.equal(dosDuPaquet({ cartes: { dos: 'etoile', codex } }), 'etoile')
  assert.equal(dosDuPaquet({ cartes: { codex } }), 'dore')
  assert.doesNotMatch(t, JARGON)
})

// ── L'Ascension (le codex) ──────────────────────────────────────────────────

interface PiecesDeLAscension {
  ChoixDeLAscension: Composant
  RenommeeGagnee: Composant
  ascensionRetenue: (ouverte: number) => number
  retenirLAscension: (cran: number, ouverte: number) => void
}
const piecesDeLAscension = async () => (await pieces()) as unknown as Pieces & PiecesDeLAscension

/** La règle d'un cran au milieu d'une phrase, telle que les règles et la fin l'écrivent. */
const auMilieu = (regle: string) => regle.charAt(0).toLowerCase() + regle.slice(1)

test('l’Ascension au départ : ses crans ouverts, « Sans » d’abord ; ce que le cran choisi ajoute, ceux d’en dessous compris ; au plus haut, ce qu’une victoire ouvrirait — et le cran retenu sur le téléphone', async () => {
  const { ChoixDeLAscension, ascensionRetenue, retenirLAscension } = await piecesDeLAscension()
  const { ASCENSION, ASCENSION_MAX } = await import('../../shared/codex')
  const html = await rendre(ChoixDeLAscension, { ouverte: 3, cran: 2, onChoisir: rien })
  assert.deepEqual(
    [...html.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>(.*?)<\/button>/g)].map(m => [texte(m[2]).trim(), m[1]]),
    [
      ['Sans cran', 'false'],
      ['Cran 1', 'false'],
      ['Cran 2', 'true'],
      ['Cran 3', 'false'],
    ],
    'les crans qu’il a ouverts, pas un de plus',
  )
  const t = texte(html)
  assert.match(t, new RegExp(`${ASCENSION[0].regle}\\. ${ASCENSION[1].regle}\\.`), 'le cran 2 et celui d’en dessous')
  assert.doesNotMatch(t, new RegExp(ASCENSION[2].regle))
  assert.doesNotMatch(t, /s’ouvre/, 'sous son plus haut cran, sa victoire n’ouvrirait rien')
  assert.match(texte(await rendre(ChoixDeLAscension, { ouverte: 3, cran: 3, onChoisir: rien })), /Va au bout à ce cran : le cran 4 s’ouvre\./)
  assert.match(texte(await rendre(ChoixDeLAscension, { ouverte: 3, cran: 0, onChoisir: rien })), /Sans cran : l’expédition de toujours\./)
  assert.doesNotMatch(texte(await rendre(ChoixDeLAscension, { ouverte: ASCENSION_MAX, cran: ASCENSION_MAX, onChoisir: rien })), /s’ouvre/, 'au dernier, plus rien à ouvrir')
  // Retenu sur le téléphone : rien, aucun cran ; un cran sous le plus haut y reste ; au plus haut, la victoire qui ouvre le suivant l'y mène.
  const memoire = new Map<string, string>()
  Object.assign(globalThis, { localStorage: { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => memoire.set(k, v), removeItem: (k: string) => memoire.delete(k) } })
  assert.equal(ascensionRetenue(3), 0, 'l’Ascension se choisit : elle ne durcit personne d’office')
  retenirLAscension(1, 3)
  assert.deepEqual([ascensionRetenue(3), ascensionRetenue(4)], [1, 1])
  retenirLAscension(3, 3)
  assert.deepEqual([ascensionRetenue(3), ascensionRetenue(4)], [3, 4])
  memoire.set('quizz.expedition.ascension', '4')
  assert.equal(ascensionRetenue(2), 2, 'celui d’un autre profil du téléphone : le plus haut des siens')
  const refuse = () => {
    throw new Error('stockage refusé')
  }
  Object.assign(globalThis, { localStorage: { getItem: refuse, setItem: refuse, removeItem: refuse } })
  assert.equal(ascensionRetenue(3), 0, 'un stockage refusé : aucun cran')
  retenirLAscension(2, 3)
})

test('l’Ascension dans les règles et à la fin : comment elle s’ouvre et chaque cran ; le cran de l’expédition, ce que rendent le campement et la source ; la victoire qui ouvre un cran, et l’expédition qui le dit', async () => {
  const { FeuilleDesRegles, RenommeeGagnee } = await piecesDeLAscension()
  const { ASCENSION, NIVEAUX, reposALAscension } = await import('../../shared/codex')
  const { COURAGE_D_UNE_SOURCE, COURAGE_D_UN_CAMPEMENT } = await import('../../shared/rencontres')
  const regles = async (ascension?: number) =>
    texte(await rendre(FeuilleDesRegles, { rencontres: true, parQuestion: [3, 4, 5], codex: { regles: [] }, ...(ascension !== undefined && { ascension }), onFermer: rien }))
  const sans = await regles()
  assert.match(sans, /L’Ascension Va au bout d’une expédition : l’Ascension s’ouvre\. Choisis ton cran au départ ; une victoire à ton plus haut cran ouvre le suivant\./)
  for (const c of ASCENSION) assert.match(sans, new RegExp(`Cran ${c.cran} : ${auMilieu(c.regle)}\\.`))
  assert.match(sans, new RegExp(`Une source : une question de ton carnet, ${COURAGE_D_UNE_SOURCE} de courage si tu la retrouves\\.`))
  assert.match(sans, new RegExp(`Un campement, avant le gardien : ${COURAGE_D_UN_CAMPEMENT} de courage`))
  const auTrois = await regles(3)
  assert.match(auTrois, /Ton expédition est au cran 3 : les règles des crans 1 à 3 s’ajoutent\./)
  assert.match(auTrois, new RegExp(`Une source : une question de ton carnet, ${reposALAscension(COURAGE_D_UNE_SOURCE, 3)} de courage si tu la retrouves\\.`))
  assert.match(auTrois, new RegExp(`Un campement, avant le gardien : ${reposALAscension(COURAGE_D_UN_CAMPEMENT, 3)} de courage`))
  assert.doesNotMatch(texte(await rendre(FeuilleDesRegles, { rencontres: true, parQuestion: [3, 4, 5], onFermer: rien })), /L’Ascension/, 'avant le codex, aucune')
  // La fin : la victoire qui ouvre un cran le dit, avec ce qu'il ajoute.
  assert.match(texte(await rendre(RenommeeGagnee, { avant: NIVEAUX[9], gagnee: 150, ascension: 1 })), new RegExp(`L’Ascension s’ouvre : au départ, choisis son cran 1 — ${auMilieu(ASCENSION[0].regle)}\\.`))
  assert.match(texte(await rendre(RenommeeGagnee, { avant: NIVEAUX[9], gagnee: 150, ascension: 3 })), new RegExp(`Le cran 3 de l’Ascension s’ouvre\\. En plus des autres : ${auMilieu(ASCENSION[2].regle)}\\.`))
  assert.doesNotMatch(texte(await rendre(RenommeeGagnee, { avant: NIVEAUX[9], gagnee: 150 })), /Ascension/)
  // L'expédition menée au bout à son plus haut cran : la fin dit son cran, et le suivant qui s'ouvre ; plus bas, rien ne s'ouvre.
  Object.assign(globalThis, { window: { location: { pathname: '/expedition', search: '', hash: '' } } })
  const { FinDeLExpedition } = (await import(new URL('../../client/src/views/ExpeditionApp.tsx', import.meta.url).href)) as { FinDeLExpedition: Composant }
  const vaincus = ['lg:kraken', 'lg:dragon', 'lg:oracle'].map(cle => ({ cle, vaincu: true }))
  const fin = (ascensionOuverte: number) => {
    const cartes = { v: 7, paquet: [], route: [], refus: {}, parQuestion: [3, 4, 5], ascension: 2, codex: { niveau: 10, regles: [], renommee: NIVEAUX[9], exploits: [], ascensionOuverte } }
    const vue = { id: 'x', numero: 7, acte: 3, gardiens: vaincus, carte: null, ici: null, trace: [], permises: [], vies: 2, justes: 31, issue: 'legendaire', garde: 'lg:dragon', moyen: false, rang: 40, courage: 22, cartes, renommee: 150, exploits: [] }
    return rendre(FinDeLExpedition, { fin: { e: 'fin', vue, tombe: { legendaires: [] }, correction: null }, gains: { xp: 0, justes: 0, tampons: [] }, erreur: '', onCorrection: rien, onAutre: rien })
  }
  const auPlusHaut = texte(await fin(2))
  assert.match(auPlusHaut, /Trois gardiens vaincus au cran 2 de l’Ascension, 31 bonnes réponses\./)
  assert.match(auPlusHaut, /Le cran 3 de l’Ascension s’ouvre/)
  assert.doesNotMatch(texte(await fin(4)), /de l’Ascension s’ouvre/, 'sous son plus haut cran, sa victoire n’ouvre rien')
  for (const t of [sans, auTrois, auPlusHaut]) assert.doesNotMatch(t, JARGON)
})
