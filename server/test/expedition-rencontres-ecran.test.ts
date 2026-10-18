// L'écran d'une rencontre, revu pour qui découvre. Le propriétaire, le 18
// octobre 2026 : « Tu peux aussi modifier les cartes et la main de manière à
// que ce soit plus simple, esthétique et accès sur la compréhension. Je veux
// que ce soit très simple à comprendre. J'aime bien le principe d'envoyer des
// cartes avant la question […] mais je veux que ce soit bien compréhensible
// pour des novices. » Des mots de tous les jours — l'adversaire perd des
// points, un bouclier, un pari —, jamais « sceaux », « Charge » ni « Garde » ;
// chaque carte de la main dit ce qu'elle fait sans qu'on la lève ; levée, ce
// qu'elle changerait — et ce qu'elle annonce, le serveur le fait. Rendu ici
// tel que la page le sert (`renderToStaticMarkup`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { GARDIEN, pliDeLExpedition, vueDeLaRencontre, type CarteDUnActe, type DepartDExpedition, type EtatDeLExpedition, type GesteDExpedition, type QuestionPosee, type VueDeLExpedition } from '../../shared/expedition'
import { CARTES_DES_RENCONTRES, type ApercuDuTour, type VueDeLaRencontre } from '../../shared/rencontres'

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
  const vue = { gardiens: j.depart.gardiens.map(cle => ({ cle, vaincu: false })), acte: 0, fetiche: 'Histoire', cartes: { paquet: j.etat().paquet, route: [], refus: {} } } as unknown as VueDeLExpedition
  return rendre(PreparationDeLaRencontre, { vue, r: j.vue(), barre: React.createElement('div', { className: 'exp-barre' }), busy: false, erreur: '', onJouer: rien, onVoir: rien })
}

const JARGON = /sceau|\bCharge\b|\bGarde\b/i

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

test('chaque carte dit ce qu’elle fait en deux lignes de neuf signes : on la lit dans la main, sans la lever', () => {
  // « 2 questions » ne tenait pas : « questions » coupé, la carte disait « 2 questio… ».
  for (const c of CARTES_DES_RENCONTRES) {
    const l = lignes(c.resume, 9)
    assert.ok(l.length <= 2 && l.every(x => x.length <= 9), `${c.cle} : « ${c.resume} » se coupe en ${l.map(x => `« ${x} »`).join(', ')}`)
  }
})

test('les cartes parlent la langue de tout le monde : ni sceaux, ni Charge, ni Garde', () => {
  for (const c of CARTES_DES_RENCONTRES) {
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
  // La main : chaque carte dit ce qu'elle fait ; celles de pendant la question à part, éteintes.
  assert.match(html, /data-carte="concentration"[^>]*>[\s\S]*?<span class="exp-face-dit" aria-hidden="true">\+4 si juste<\/span>/)
  assert.match(html, /class="exp-cartes-groupe exp-cartes-plus-tard"[^>]*><span class="exp-cartes-quand">Pendant la question<\/span><div class="exp-cartes-main"><button type="button" class="exp-face exp-face-eteinte"[^>]*data-carte="coup-d-oeil"/)
  assert.doesNotMatch(html, /exp-cartes-plus-tard[\s\S]*data-carte="concentration"/, 'une carte d’avant la question n’attend pas la question')
  // L'inspiration, en étincelles : trois, toutes allumées.
  assert.match(html, /aria-label="3 d’inspiration pour jouer tes cartes"/)
  assert.match(lu, /Parier \? Non/)
  // Le guide, déjà vu : à la demande seulement.
  assert.doesNotMatch(html, /feuille-guide/)
  assert.match(html, /class="link-inline small exp-comment"/)
})

test('à la première rencontre, le guide s’ouvre de lui-même : cinq lignes, « Compris »', async () => {
  stockage(false)
  const html = await preparation(rencontreAvec(['concentration']))
  assert.match(html, /class="carte-feuille feuille-guide"/)
  const guide = texte(html.slice(html.indexOf('feuille-guide')))
  assert.match(guide, /Réponds juste : l’adversaire perd des points\. À zéro, il tombe\./)
  assert.match(guide, /Si tu te trompes, il t’attaque : tu perds du courage\./)
  assert.match(guide, /Avant de voir la question, joue des cartes/)
  assert.match(guide, /Compris/)
  assert.equal((html.match(/class="exp-guide-icone"/g) ?? []).length, 5)
  // Pas même à la place du jeu : l'écran reste dessous, entier.
  assert.match(html, /exp-voir/)
  stockage(true)
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
  assert.match(html, /aria-label="Elle coûte 1 d’inspiration"/)
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
  // Un pouvoir posé, lui, reste en vue : il agit sur la question à l'écran.
  const pose = await rendre(MainDeRencontre, { cles: ['concentration'], refus, busy: false, inspiration: 2, phase: 'question', poses: ['tresor'], pile, onJouer: rien })
  assert.match(texte(pose), /Le trésor/)
  assert.doesNotMatch(pose, /data-carte=|exp-cartes-rangs/)
})
