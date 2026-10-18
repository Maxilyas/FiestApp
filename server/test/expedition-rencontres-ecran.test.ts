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
  const vue = { gardiens: j.depart.gardiens.map(cle => ({ cle, vaincu: false })), acte: 0, fetiche: 'Histoire', cartes: { paquet: j.etat().paquet, route: [], refus: {} } } as unknown as VueDeLExpedition
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

test('chaque carte se résume en deux lignes de neuf signes, et son chiffre tient dans son médaillon', () => {
  // « 2 questions » ne tenait pas : « questions » coupé, la carte disait « 2 questio… ». Le résumé se dit à l'oreille, et dans les lignes d'une offre.
  for (const c of CARTES_DES_RENCONTRES) {
    const l = lignes(c.resume, 9)
    assert.ok(l.length <= 2 && l.every(x => x.length <= 9), `${c.cle} : « ${c.resume} » se coupe en ${l.map(x => `« ${x} »`).join(', ')}`)
    // Le chiffre de la main : quelques signes, sans un mot (« trop de détails écrits en dessous de chaque icône »).
    if (c.valeur !== undefined) assert.match(c.valeur, /^[+×]?\d+(,\d)?( s)?$/, `${c.cle} : « ${c.valeur} »`)
  }
})

test('les cartes parlent la langue de tout le monde : ni sceaux, ni Charge, ni Garde, ni inspiration', () => {
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
  const refus = { concentration: null, 'troisieme-oeil': 'Il lui faut 2 d’énergie : il t’en reste 1', echange: null }
  const html = await rendre(MainDeRencontre, { cles: ['concentration', 'troisieme-oeil', 'echange'], refus, busy: false, inspiration: 1, pile, onJouer: rien })
  assert.match(html, /aria-label="1 d’énergie pour jouer tes cartes"><b class="exp-vc-cout" aria-hidden="true">1<\/b>/)
  const cout = (cle: string) => new RegExp(`data-carte="${cle}"[^>]*><span class="exp-vc[^"]*"[^>]*><span class="([^"]*)">(\\d)<\\/span>`).exec(html)
  assert.deepEqual(cout('concentration')?.slice(1), ['exp-vc-cout', '1'])
  assert.deepEqual(cout('troisieme-oeil')?.slice(1), ['exp-vc-cout exp-vc-manque', '2'], 'deux, quand il en a un : rouge')
  assert.deepEqual(cout('echange')?.slice(1), ['exp-vc-cout', '0'], 'gratuite : zéro, dans le même orbe')
  // Ce qui se dit à l'oreille dit l'énergie aussi.
  assert.match(texte(html), /Troisième œil : Indices \+3, 2 d’énergie, pas maintenant/)
  assert.doesNotMatch(texte(html), JARGON)
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

test('le plan, plus « la carte » : le même mot disait la carte de l’acte et les cartes de la main', async () => {
  // La recommandation du codex, validée le 18 octobre 2026 : « Le même mot désigne aujourd'hui la carte de l'acte et les cartes
  // de la main, sur le même écran. » Ce que lit le joueur — une carte, un joker, un talisman, un refus, les règles — dit « le plan ».
  const CARTE_DE_L_ACTE = /sur (la|cette|ta) carte|(La|la) carte ne dit|La carte ·|Retour à la carte|carte n°/i
  const { JOKERS_DES_LEGENDAIRES, JOKERS_SANS_LEGENDAIRE, TALISMANS } = await import('../../shared/jokers')
  for (const x of [...CARTES_DES_RENCONTRES, ...JOKERS_DES_LEGENDAIRES, ...JOKERS_SANS_LEGENDAIRE, ...TALISMANS]) assert.doesNotMatch(x.effet, CARTE_DE_L_ACTE, `${x.cle} : « ${x.effet} »`)
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
