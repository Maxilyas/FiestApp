// L'écran du Filet en deux temps (`client/src/views/cabinet/jeux/FiletEnDeuxTemps.tsx` ; le cahier des charges,
// `retours/2026-11-09/le-nouveau-filet.md`, § 3.1, 3.6 et 3.8), rendu en HTML (`renderToStaticMarkup`) sur les vues qu'un
// vrai serveur rend à une joueuse qui joue par les routes — le serveur tire le nouveau Filet sur de vraies questions de
// son contenu, les réponses lues dans le plan en base —, et l'aiguillage des deux Filets (`FILETS`, `Filet.tsx`) : une
// partie commencée avant le nouveau garde son écran. Un fichier à part de `cabinet-ecran.test.ts` et de
// `cabinet-ecran-neufs.test.ts`, chacun sous la minute (règle `tests.md`). Sans navigateur : seul le premier rendu se lit ;
// l'écran se regarde au téléphone par la skill `regarder-le-rendu`.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { inscrireProfil } from './banc'
import { bancDuCabinet, baseDuCabinet, commencer, departEnBase, fermerLesMagasins, jouer, ok, ouvrir, vraiesQuestionsDuFilet, type BancDuCabinet } from './cabinet-banc'
import { importsStatiques } from './chemin-des-imports'
import { GRACE_D_UNE_MANCHE_MS } from '../../shared/cabinet/bareme'
import type { FiletMontre } from '../../shared/cabinet/jeux/filet'
import {
  AIDES_DU_FILET,
  ceQueCouvreLeFilet,
  cranDe,
  cransDe,
  milieuDeLaTranche,
  valeurAuCran,
  type FiletEnDeuxTempsMontre,
  type FiletEnDeuxTempsRevele,
  type FiletEnDeuxTempsTire,
  type TrancheDuFilet,
} from '../../shared/cabinet/jeux/filetEnDeuxTemps'
import type { VueDeLaPartie } from '../../shared/cabinet/vues'
import { formatNumber } from '../../shared/typographie'
import { uniteAccordee } from '../../shared/unites'

// Le client compile son JSX pour un `React` global, et `state.ts` lit son adresse à l'import : posés avant tout composant.
Object.assign(globalThis, { React, window: { location: { pathname: '/cabinet', search: '', hash: '', origin: 'http://banc' }, addEventListener: () => {} } })

const client = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/src')
const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href
const source = (fichier: string) => readFileSync(path.join(client, fichier), 'utf8')

/** Ce qu'on lit d'un rendu : son texte, sans balises, les espaces insécables en espaces, le gluon de l'inversion effacé. */
const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/⁠/g, '')
    .replace(/[  ]/g, ' ')
    .replace(/\s+/g, ' ')
const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Un texte tel que `texte()` le lit : ses apostrophes droites en typographiques, ses espaces fines en espaces. */
const lu = (s: string) => texte(s.replace(/'/g, '’'))

/** Ce que l'écran écrit d'une valeur : « 1946 », « 12 500 km » ; une borne, en nombre seul. */
const dire = (m: { unite?: string }, v: number) => `${formatNumber(v)}${m.unite ? ` ${uniteAccordee(m.unite, v)}` : ''}`
const borne = (m: { annee: boolean }, v: number) => (m.annee ? String(v) : formatNumber(v))

const rien = () => {}

// ── Une joueuse, par les vraies routes ───────────────────────────────────

/** L'aiguillage et ses deux écrans, tels que la page les charge à la demande. */
type Ecran = {
  localDe: (m: unknown) => unknown
  cleDe: (m: unknown) => string
  aLEcheance: (m: unknown, l: unknown) => unknown
  cibleDEclairer?: (m: unknown, l: unknown) => number | undefined
  sousEcranDe?: (m: unknown, l: unknown) => string
  Manche: (p: object) => React.ReactNode
  Revelation: (p: object) => React.ReactNode
}
async function lesEcrans() {
  const filet = await import(url('views/cabinet/jeux/Filet.tsx'))
  const deuxTemps = await import(url('views/cabinet/jeux/FiletEnDeuxTemps.tsx'))
  return { FILETS: filet.FILETS as Ecran, FILET: filet.FILET as Ecran, FILET_EN_DEUX_TEMPS: deuxTemps.FILET_EN_DEUX_TEMPS as Ecran, ...deuxTemps }
}

let b: BancDuCabinet
let lea: string
const vues: Record<string, VueDeLaPartie> = {}
let tirages: FiletEnDeuxTempsTire[] = []

before(async () => {
  // De vraies questions de l'acte I, chacune son indice jugé : la partie libre tire à l'acte I.
  b = await bancDuCabinet({ filetEnDeuxTemps: true, baseDeLaCampagne: baseDuCabinet(8, vraiesQuestionsDuFilet(10, { avecIndice: true })) })
  // Léa, Coup d'œil emporté : « Deux époques de moins » payée, l'indice offert, puis le lancer pile dessus ; à la deuxième
  // manche, un lancer dans l'époque la plus loin ; la troisième laissée au temps, sans rien toucher.
  lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
  let v = (vues.manche = ok(await commencer(b, lea, { origine: 'libre', jeu: 'filet', carte: 'coup-d-oeil' }), 'le Filet'))
  tirages = departEnBase(b.fichier, v.id).tirages as FiletEnDeuxTempsTire[]
  const t0 = tirages[0]
  v = vues.aidee = ok(await jouer(b, lea, v, { quoi: 'aide', manche: 0, aide: 'epoques' }), 'deux époques de moins')
  v = vues.eclairee = ok(await jouer(b, lea, v, { quoi: 'eclairer', manche: 0, affirmation: AIDES_DU_FILET.indexOf('indice') }), 'l’indice offert')
  v = vues.revelee = ok(await jouer(b, lea, v, { quoi: 'repondre', manche: 0, reponse: { filet: { epoque: t0.bonnes[0], x: t0.valeur } } }), 'le lancer')
  v = await ouvrir(b, lea, v, 1)
  const t1 = tirages[v.tirage ?? 1]
  const loin = t1.bonnes[0] <= 1 ? 3 : 0
  v = vues.aCote = ok(await jouer(b, lea, v, { quoi: 'repondre', manche: 1, reponse: { filet: { epoque: loin, x: milieuDeLaTranche(t1.tranches[loin]) } } }), 'à côté')
  v = vues.troisieme = await ouvrir(b, lea, v, 2)
  b.horloge.t = v.chrono!.echeance + (v.chrono!.pauseResteMs ?? 0) + GRACE_D_UNE_MANCHE_MS + 1
  vues.sansLancer = ok(await jouer(b, lea, v, { quoi: 'repondre', manche: 2, auto: true }), 'laissée au temps')
})
after(() => b?.banc.close())
after(fermerLesMagasins)

/** Une partie à l'écran, sur la vue du serveur, par l'aiguillage que la page charge : ce que la page tient, ou celui qu'on donne. */
async function laPartie(vue: VueDeLaPartie, plus: Record<string, unknown> = {}) {
  const { FILETS } = await lesEcrans()
  const { chronoMontre } = await import(url('views/cabinet/Partie.tsx'))
  const module = await import(url('views/cabinet/Partie.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(
    React.createElement(module.EcranDeLaPartie, {
      vue,
      ecran: FILETS,
      local: vue.enCours ? FILETS.localDe(vue.enCours) : null,
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
    }),
  )
}

/** Le corps d'une manche rendue, de sa question à la fin : la tête — son chrono, ses comptes — n'en est pas. */
const corpsDe = (html: string) => html.slice(html.indexOf('<h2 class="quiz-question'))
/** Les boutons des quatre époques, dans l'ordre : leur nom à l'oreille, et s'ils sont pressés ou éteints. */
const epoquesDe = (html: string) => [...html.matchAll(/<button type="button" class="(cab-tranche[^"]*)"([^>]*)>/g)].map(m => ({ classes: m[1], attributs: m[2] }))
const attribut = (attributs: string, nom: string) => new RegExp(`${nom}="([^"]*)"`).exec(attributs)?.[1]

// ── La manche ────────────────────────────────────────────────────────────

test('la manche du Filet en deux temps : la question, quatre époques qui disent leurs bornes, les aides et leur prix en mots — rien de la réponse (invariant 1)', async () => {
  const m = vues.manche.enCours as FiletEnDeuxTempsMontre
  assert.equal(m.deuxTemps, true)
  const t = tirages[0]
  const html = await laPartie(vues.manche)
  const corps = texte(corpsDe(html))
  assert.match(corps, new RegExp(echapper(lu(m.texte))))
  // Une ligne de consigne, puis quatre boutons qui disent leurs bornes, aucun pressé.
  assert.match(corps, new RegExp(`Choisis ${m.annee ? 'l’époque' : 'l’ordre de grandeur'} , la bonne vaut une étoile`))
  const epoques = epoquesDe(html)
  assert.deepEqual(
    epoques.map(e => [attribut(e.attributs, 'aria-label'), attribut(e.attributs, 'aria-pressed')]),
    m.tranches.map(u => [`De ${borne(m, u.de)} à ${borne(m, u.a)}`, 'false']),
  )
  // Les aides, chacune son prix en mots — jamais un signe d'étoile, que le lecteur d'écran disait « moins un, une étoile ».
  assert.match(corps, new RegExp(`${m.annee ? 'Deux époques de moins' : 'Deux ordres de moins'} Coûte une étoile`))
  assert.match(corps, /Un indice Coûte une étoile/)
  assert.match(corps, /Une aide coûte une étoile, jamais un cœur\./)
  // Rien à lancer sans époque, et pas de piste avant elle.
  assert.match(html, /<button type="button" class="btn btn-primary btn-big btn-block cab-lancer" aria-disabled="true"[^>]*>Choisis d’abord (une époque|un ordre de grandeur)<\/button>/)
  assert.doesNotMatch(html, /cab-curseur|cab-filet-anneaux/)
  // Ni la valeur — sauf si elle est une borne, que la frise écrit pour tout le monde —, ni l'indice avant qu'il le prenne.
  if (!m.tranches.some(u => u.de === t.valeur || u.a === t.valeur))
    assert.doesNotMatch(corps, new RegExp(`(?<![\\d,])${echapper(texte(formatNumber(t.valeur)))}(?![\\d]|,\\d)`), 'la valeur')
  assert.ok(t.indice && !corps.includes(lu(t.indice).trim()), 'l’indice')
  assert.doesNotMatch(html, /autoFocus|autofocus/)
  assert.doesNotMatch(corps, /★/, 'les étoiles se dessinent ou se disent')
})

test('une époque touchée : le curseur en son milieu, ce que couvrent les deux anneaux, la piste et ses traits, les grands pas', async () => {
  const { choisirLEpoque, cransDUnGrandPas, FILET_EN_DEUX_TEMPS } = await lesEcrans()
  const m = vues.manche.enCours as FiletEnDeuxTempsMontre
  const k = 1
  const u = m.tranches[k]
  const local = choisirLEpoque(m, FILET_EN_DEUX_TEMPS.localDe(m), k) as { epoque: number; x: number }
  assert.deepEqual(local, { epoque: k, x: milieuDeLaTranche(u) }, 'le milieu, d’emblée : « elle devrait se placer directement au milieu »')
  const html = await laPartie(vues.manche, { local })
  const corps = texte(corpsDe(html))
  assert.equal(attribut(epoquesDe(html)[k].attributs, 'aria-pressed'), 'true')
  assert.match(corps, new RegExp(`${m.annee ? 'L’époque' : 'L’ordre de grandeur'} , la bonne vaut une étoile`))
  // La valeur en grand, et ce que couvrent les deux anneaux : trois étoiles pour le petit, deux pour le grand, dessinées.
  assert.match(html, new RegExp(`<output class="cab-filet-valeur" aria-live="off">${echapper(borne(m, local.x))}`))
  const c = ceQueCouvreLeFilet(m, local.x, u.pas >= 1)
  const anneaux = /<p class="cab-filet-anneaux">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? ''
  const morceau = (r: { de: number; a: number }) => (r.de === r.a ? `pile sur ${borne(m, r.de)}` : `${borne(m, r.de)}–${borne(m, r.a)}`)
  assert.match(texte(anneaux), new RegExp(echapper(texte(morceau(c.trois)))))
  assert.match(anneaux, /aria-label="3 étoiles sur 3"/)
  if (morceau(c.deux) !== morceau(c.trois)) {
    assert.match(texte(anneaux), new RegExp(echapper(texte(morceau(c.deux)))))
    assert.match(anneaux, /aria-label="2 étoiles sur 3"/)
  }
  // La piste de l'époque : ses bornes, son cran, sa vraie valeur dite ; un trait à chaque grand pas ; « − » et « + », les grands pas.
  const curseur = /<input type="range" class="cab-curseur"([^>]*)\/>/.exec(html)?.[1] ?? ''
  assert.deepEqual(
    ['min', 'max', 'step', 'value', 'aria-label', 'aria-valuetext'].map(a => attribut(curseur, a)),
    [String(u.de), String(u.a), String(u.pas), String(local.x), m.annee ? 'L’année' : 'La valeur', dire(m, local.x)],
  )
  const grand = cransDUnGrandPas(u)
  assert.equal((html.match(/class="cab-filet-trait"/g) ?? []).length, Math.ceil(cransDe(u) / grand) - 1)
  const grandDit = m.annee ? `${grand * u.pas} ans` : dire(m, grand * u.pas)
  assert.match(texte(html), new RegExp(`− ${echapper(texte(grandDit))} \\+ ${echapper(texte(grandDit))}`))
  assert.ok(html.includes(`aria-label="${grandDit.replace(' ', ' ')} de plus"`) || html.includes(`aria-label="${grandDit} de plus"`), 'un grand pas dit sa taille')
  assert.match(html, /<button type="button" class="btn btn-primary btn-big btn-block cab-lancer"[^>]*>Lancer le filet<\/button>/)
  assert.doesNotMatch(/<button type="button" class="btn btn-primary btn-big btn-block cab-lancer"([^>]*)>/.exec(html)?.[1] ?? '', /aria-disabled/)
})

test('ce que la page tient : l’époque touchée garde la valeur qui y tient, un grand pas d’une graduation ronde, ce qui part à l’échéance', async () => {
  const { choisirLEpoque, poserAuCran, cransDUnGrandPas, FILET_EN_DEUX_TEMPS, aideAOffrir } = await lesEcrans()
  const annees: Pick<FiletEnDeuxTempsMontre, 'tranches' | 'retirees' | 'annee'> = {
    annee: true,
    retirees: [],
    tranches: [
      { de: 1900, a: 1924, pas: 1 },
      { de: 1925, a: 1949, pas: 1 },
      { de: 1950, a: 1974, pas: 1 },
      { de: 1975, a: 1999, pas: 1 },
    ],
  }
  const rienDeTouche = { epoque: null, x: null }
  const au1937 = poserAuCran(annees, choisirLEpoque(annees, rienDeTouche, 1), cranDe(annees.tranches[1], 1937))
  assert.deepEqual(au1937, { epoque: 1, x: 1937 })
  // Une autre époque où la valeur ne tient pas : son milieu ; revenue, la sienne aussi — elle n'est plus dedans.
  assert.deepEqual(choisirLEpoque(annees, au1937, 2), { epoque: 2, x: milieuDeLaTranche(annees.tranches[2]) })
  // Une époque retirée ne se touche pas ; sans époque, un cran ne pose rien.
  assert.deepEqual(choisirLEpoque({ ...annees, retirees: [0, 3] }, au1937, 3), au1937)
  assert.deepEqual(poserAuCran(annees, rienDeTouche, 4), rienDeTouche)
  // Un grand pas : une graduation ronde, huit au plus sur la piste — 5 ans sur 25, 100 de 300 à 1 000, 50 de 100 à 300.
  const pasDe = (u: TrancheDuFilet) => cransDUnGrandPas(u) * u.pas
  assert.deepEqual([pasDe({ de: 1925, a: 1949, pas: 1 }), pasDe({ de: 300, a: 1000, pas: 5 }), pasDe({ de: 100, a: 300, pas: 1 }), pasDe({ de: 1500, a: 1549, pas: 1 })], [5, 100, 50, 10])
  // À l'échéance : ce qui est posé part tel quel ; rien de touché, rien ; une époque que l'aide a retirée, rien non plus.
  const m = { ...(vues.manche.enCours as FiletEnDeuxTempsMontre), ...annees }
  assert.equal(FILET_EN_DEUX_TEMPS.aLEcheance(m, rienDeTouche), undefined)
  assert.deepEqual(FILET_EN_DEUX_TEMPS.aLEcheance(m, au1937), { filet: { epoque: 1, x: 1937 } })
  assert.equal(FILET_EN_DEUX_TEMPS.aLEcheance({ ...m, retirees: [1, 3] }, au1937), undefined)
  // La carte Coup d'œil offre l'indice d'abord, puis l'autre aide ; plus rien, rien à viser.
  const aides = (indice: 'payee' | null, epoques: 'payee' | null) => ({
    aides: [
      { cle: 'epoques', prise: epoques },
      { cle: 'indice', prise: indice },
    ],
  })
  assert.equal(aideAOffrir(aides(null, null)), AIDES_DU_FILET.indexOf('indice'))
  assert.equal(aideAOffrir(aides('payee', null)), AIDES_DU_FILET.indexOf('epoques'))
  assert.equal(aideAOffrir(aides('payee', 'payee')), undefined)
  assert.equal(aideAOffrir({ aides: [{ cle: 'epoques', prise: null }] }), AIDES_DU_FILET.indexOf('epoques'), 'sans indice honnête, l’autre')
  // Une époque touchée ouvre sa piste, et ce qui était sous le doigt glisse : le cadre relance sa garde. Un cran, non.
  const sous = FILET_EN_DEUX_TEMPS.sousEcranDe!
  assert.notEqual(sous(m, rienDeTouche), sous(m, au1937))
  assert.equal(sous(m, au1937), sous(m, poserAuCran(annees, au1937, 3)))
  // « Changer » pose une autre question : la page repart de zéro ; une aide n'y change rien.
  assert.equal(FILET_EN_DEUX_TEMPS.cleDe(vues.aidee.enCours), FILET_EN_DEUX_TEMPS.cleDe(vues.manche.enCours))
  assert.notEqual(FILET_EN_DEUX_TEMPS.cleDe(vues.troisieme.enCours), FILET_EN_DEUX_TEMPS.cleDe(vues.manche.enCours))
})

test('après « Deux époques de moins » : ce qui reste se dit, les retirées se barrent, l’aide dit ce qu’elle a pris — jamais un cœur', async () => {
  const m = vues.aidee.enCours as FiletEnDeuxTempsMontre
  const t = tirages[0]
  assert.deepEqual(m.retirees, [...t.retirables])
  const html = await laPartie(vues.aidee)
  const corps = texte(corpsDe(html))
  const restent = m.tranches.filter((_, i) => !m.retirees.includes(i)).map(u => `${borne(m, u.de)}–${borne(m, u.a)}`)
  assert.match(html, /<p class="cab-ligne cab-filet-restent" tabindex="-1">/, 'le focus s’y pose')
  assert.match(corps, new RegExp(echapper(texte(`Il reste ${restent.join(' et ')}.`))))
  const epoques = epoquesDe(html)
  for (const i of m.retirees) {
    assert.match(epoques[i].classes, /cab-tranche-retiree/)
    assert.match(attribut(epoques[i].attributs, 'aria-label') ?? '', /, retirée$/)
    assert.equal(attribut(epoques[i].attributs, 'aria-disabled'), 'true')
  }
  assert.match(corps, /Prise · une étoile en moins/)
  // Une aide payée : « Ton aide » — « Tes aides » dès la seconde.
  assert.match(corps, /Ton aide : une étoile en moins, jamais un cœur\./)
  // L'étoile de l'époque, l'aide l'a prise : la consigne ne la promet plus.
  assert.doesNotMatch(corps, /la bonne vaut une étoile/)
})

test('Éclairer offre l’indice : il paraît sous la frise, le focus s’y pose, et l’aide dit qu’elle était offerte', async () => {
  const m = vues.eclairee.enCours as FiletEnDeuxTempsMontre
  const t = tirages[0]
  assert.equal(m.indice, t.indice)
  const html = await laPartie(vues.eclairee)
  const corps = texte(corpsDe(html))
  assert.match(html, /<p class="cab-souffle" tabindex="-1">/)
  assert.ok(corps.includes(lu(`Indice : ${t.indice}`).trim()), corps)
  assert.match(corps, /Un indice Prise · offerte/)
  // L'aide payée avant parle toujours : ce qu'elle a pris, jamais un cœur — l'offerte n'en est pas une de plus.
  assert.match(corps, /Ton aide : une étoile en moins, jamais un cœur\./)
  // L'ordre de l'écran : la frise, ce qui reste, l'indice, puis les aides — sous les aides, l'indice passait derrière le bouton du bas.
  const ici = (s: string) => html.indexOf(s)
  assert.ok(ici('class="cab-tranches"') < ici('cab-filet-restent') && ici('cab-filet-restent') < ici('class="cab-souffle"') && ici('class="cab-souffle"') < ici('class="cab-filet-aides"'))
})

// ── La révélation ────────────────────────────────────────────────────────

test('la révélation : la réponse et ce qu’il visait, la frise — la bonne et son choix écrits —, d’où viennent les étoiles, ce que l’aide a pris', async () => {
  const r = vues.revelee.revelation!.corps as FiletEnDeuxTempsRevele
  const t = tirages[0]
  assert.deepEqual([r.avantLesAides, r.payees, r.etoiles], [3, 1, 2])
  const html = await laPartie(vues.revelee)
  const tout = texte(html)
  // Le titre, où le focus se pose ; la note de la manche dit l'aide payée et l'aide offerte.
  assert.match(html, new RegExp(`<h2 class="cab-titre-revele">${echapper(r.titre)}</h2>`))
  assert.match(tout, /−1 : ton aide · éclairée/)
  assert.ok(tout.includes(lu(`La réponse : ${dire(r, t.valeur)}`)), tout)
  assert.ok(tout.includes(lu(`tu visais ${dire(r, t.valeur)} · pile dessus`)), tout)
  // La frise : la bonne et son choix écrits dans leur case, la réponse et le lancer dits en mots dans la légende.
  const bonne = epoquesDe(html)[t.bonnes[0]]
  assert.match(bonne.classes, /cab-tranche-bonne cab-tranche-choisie/)
  assert.match(attribut(bonne.attributs, 'aria-label') ?? '', /, la bonne, ton choix$/)
  assert.match(html, /<span class="cab-tranche-dit" aria-hidden="true">la bonne, ton choix<\/span>/)
  assert.ok(tout.includes(lu(`La réponse, ${dire(r, t.valeur)}`)) && tout.includes(lu(`Ton lancer, ${dire(r, t.valeur)}`)), tout)
  assert.match(html, /class="cab-epoques-reponse"/)
  assert.match(html, /class="cab-epoques-lancer"/)
  // D'où viennent les étoiles, en une ligne, chaque critère sa marque et ses mots ; puis ce que l'aide a pris.
  const juge = texte(/<p class="cab-filet-juge">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '')
  const pres = (n: number) => (r.annee ? `à ${n} an${n > 1 ? 's' : ''} près` : `à ${n} % près`)
  for (const dit of [r.annee ? 'la bonne époque' : 'le bon ordre de grandeur', pres(r.anneaux.deux), pres(r.anneaux.trois)]) assert.ok(juge.includes(`✓ oui, ${dit}`), `${dit} : ${juge}`)
  assert.match(juge, /ton aide : une étoile en moins/)
  // L'indice qu'il avait pris, et l'anecdote, au cadre.
  assert.ok(tout.includes(lu(`Indice : ${t.indice}`).trim()))
  if (t.question.anecdote) assert.match(tout, /Le savais-tu \?/)
  assert.doesNotMatch(texte(corpsDe(html)), /★/)
})

test('la révélation d’un lancer à côté, et d’une manche laissée au temps sans rien toucher', async () => {
  const r = vues.aCote.revelation!.corps as FiletEnDeuxTempsRevele
  assert.equal(r.etoiles, 0)
  const html = await laPartie(vues.aCote)
  const juge = texte(/<p class="cab-filet-juge">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '')
  assert.match(juge, /✗ non, (la bonne époque|le bon ordre de grandeur)/)
  assert.match(texte(html), new RegExp(`tu visais ${echapper(texte(dire(r, r.lancer!.x)))} · [\\d  ,]+ (ans?|%) d’écart`))
  const choisie = epoquesDe(html)[r.lancer!.epoque]
  assert.match(choisie.classes, /cab-tranche-choisie/)
  assert.doesNotMatch(choisie.classes, /cab-tranche-bonne/)
  assert.match(attribut(choisie.attributs, 'aria-label') ?? '', /, ton choix$/)
  assert.match(attribut(epoquesDe(html)[r.bonnes[0]].attributs, 'aria-label') ?? '', /, la bonne$/)
  // Laissée au temps : la réponse, et rien de ce qu'il aurait visé.
  const sans = texte(await laPartie(vues.sansLancer))
  assert.match(sans, /tu n’as pas lancé/)
  assert.doesNotMatch(sans, /tu visais|Ton lancer/)
})

// ── L'aiguillage, et ce que l'écran importe ──────────────────────────────

test('l’aiguillage des deux Filets : chaque manche prend son écran par sa forme, et une partie d’avant garde le sien', async () => {
  const { FILETS, FILET, FILET_EN_DEUX_TEMPS } = await lesEcrans()
  const avant: FiletMontre = { jeu: 'filet', categorie: 'Histoire', texte: 'En quelle année ?', annee: true, piste: { min: 1800, max: 1900, pas: 1 }, zone: null }
  const nouveau = vues.manche.enCours as FiletEnDeuxTempsMontre
  assert.deepEqual(FILETS.localDe(avant), FILET.localDe(avant))
  assert.deepEqual(FILETS.localDe(nouveau), FILET_EN_DEUX_TEMPS.localDe(nouveau))
  assert.equal(FILETS.cleDe(avant), FILET.cleDe(avant))
  assert.equal(FILETS.cleDe(nouveau), FILET_EN_DEUX_TEMPS.cleDe(nouveau))
  assert.equal(FILETS.cibleDEclairer?.(avant, FILET.localDe(avant)), undefined, 'au Filet d’avant, Éclairer ne vise rien')
  assert.equal(FILETS.cibleDEclairer?.(nouveau, FILETS.localDe(nouveau)), AIDES_DU_FILET.indexOf('indice'))
  assert.equal(FILETS.sousEcranDe?.(avant, FILET.localDe(avant)), '', 'rien ne glisse sous le doigt au Filet d’avant')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const manche = (montree: unknown) =>
    renderToStaticMarkup(React.createElement(FILETS.Manche, { montree, local: FILETS.localDe(montree), setLocal: rien, envoyer: rien, garde: () => true, gardeDeLEcran: () => true, busy: false, partie: 'p' }))
  assert.match(manche(avant), /cab-tailles/, 'les trois filets d’avant')
  assert.doesNotMatch(manche(avant), /cab-tranches/)
  assert.match(manche(nouveau), /cab-tranches/)
  assert.doesNotMatch(manche(nouveau), /cab-tailles/)
  // La page le charge à la demande, comme avant.
  assert.match(source('views/cabinet/Partie.tsx'), /filet: aLaDemande\(\(\) => import\('\.\/jeux\/Filet'\)\.then\(m => m\.FILETS/)
})

test('l’écran du Filet en deux temps : de sa règle des types et ce qui ne juge pas, sans l’heure du téléphone, des classes à lui', () => {
  const s = source('views/cabinet/jeux/FiletEnDeuxTemps.tsx')
  const deLaRegle = /import \{([^}]*)\} from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/shared\/cabinet\/jeux\/filetEnDeuxTemps'/.exec(s)
  assert.ok(deLaRegle, 'il importe sa règle')
  const importees = deLaRegle[1]
    .split(',')
    .map(x => x.trim())
    .filter(x => x && !x.startsWith('type '))
  // Des chiffres de la frise et de la piste, et l'ordre des aides : rien du jugement, ni du tirage.
  assert.deepEqual(importees.sort(), ['AIDES_DU_FILET', 'ceQueCouvreLeFilet', 'cranDe', 'cransDe', 'milieuDeLaTranche', 'valeurAuCran'])
  const chemin = importsStatiques(path.join(client, 'views/cabinet/jeux/FiletEnDeuxTemps.tsx'))
  for (const f of ['shared/cabinet/partie.ts', 'shared/cabinet/jeux/index.ts', 'shared/cabinet/lecture.ts', 'shared/cabinet/jeux/filets.ts']) {
    assert.ok(!chemin.has(path.resolve(client, '../..', f)), `${f} ne part pas avec l’écran`)
  }
  const code = s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(code, /Date\.now\(\)/)
  assert.doesNotMatch(s, /autoFocus/)
  assert.doesNotMatch(code, /★/, 'les étoiles se dessinent (`Etoiles`) ou se disent en mots')
  assert.match(s, /export const FILET_EN_DEUX_TEMPS: JeuALEcran</)
  // `.cab-frise` est la Frise : la frise des époques a ses classes à elle (`.cab-epoques`), et la feuille les pose toutes.
  assert.doesNotMatch(s, /cab-frise/)
  const feuille = readFileSync(path.join(client, 'styles.css'), 'utf8')
  for (const classe of new Set([...s.matchAll(/cab-(?:epoques|tranche|filet-(?:anneau|trait|repere|aide|juge|oui|non|consigne|restent|etape))[a-z-]*/g)].map(m => m[0])))
    assert.match(feuille, new RegExp(`\\.${classe}\\b`), `.${classe} a sa règle`)
})
