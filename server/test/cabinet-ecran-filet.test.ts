// L'écran du Filet en deux temps (`client/src/views/cabinet/jeux/FiletEnDeuxTemps.tsx` ; le cahier des charges,
// `retours/2026-11-09/le-nouveau-filet.md`, § 3.1, 3.6 et 3.8 ; une décision par écran depuis le 12 novembre 2026,
// `retours/2026-11-12/le-filet-en-deux-ecrans.md`), rendu en HTML (`renderToStaticMarkup`) sur les vues qu'un
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
  tientEclairer?: (m: unknown) => boolean
  aUnPied?: (m: unknown) => boolean
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
/** Les quatre époques de la révélation, en frise, dans l'ordre : leur nom à l'oreille, la bonne et son choix. */
const epoquesDe = (html: string) => [...html.matchAll(/<button type="button" class="(cab-tranche[^"]*)"([^>]*)>/g)].map(m => ({ classes: m[1], attributs: m[2] }))
/** Les quatre époques de la manche, une ligne chacune : leur nom à l'oreille, si elles sont pressées ou éteintes, ce qu'elles écrivent. */
const lignesDe = (html: string) =>
  [...html.matchAll(/<button type="button" class="(cab-epoque[^"]*)"([^>]*)>([\s\S]*?)<\/button>/g)].map(m => ({ classes: m[1], attributs: m[2], dedans: m[3] }))
/** Le pied collé de la partie : ce que le jeu y pose, sous le pouce. */
const piedDe = (html: string) => /<div class="cab-pied-partie">([\s\S]*)$/.exec(html)?.[1] ?? ''
/** Le repère qu'une tranche porte, comme sa ligne le dit : son fait pour une année, sa grandeur devant pour une grandeur. */
const repereDe = (m: FiletEnDeuxTempsMontre, u: TrancheDuFilet) => {
  const r = m.reperes.find(x => x.valeur >= u.de && x.valeur <= u.a)
  return r ? (m.annee ? r.texte : `${dire(m, r.valeur)} · ${r.texte}`) : null
}
const attribut = (attributs: string, nom: string) => new RegExp(`${nom}="([^"]*)"`).exec(attributs)?.[1]

// ── La manche ────────────────────────────────────────────────────────────

test('l’écran des époques : la question, quatre lignes qui disent leurs bornes et leur repère, les aides au pied — rien de la réponse (invariant 1)', async () => {
  const m = vues.manche.enCours as FiletEnDeuxTempsMontre
  assert.equal(m.deuxTemps, true)
  const t = tirages[0]
  const html = await laPartie(vues.manche)
  const corps = texte(corpsDe(html))
  assert.match(corps, new RegExp(echapper(lu(m.texte))))
  // Une ligne de consigne, puis quatre lignes qui disent leurs bornes et le repère qu'elles portent, aucune pressée.
  assert.match(corps, new RegExp(m.annee ? 'Choisis l’époque , la bonne vaut une étoile' : 'Choisis l’ordre de grandeur , le bon vaut une étoile'))
  const lignes = lignesDe(html)
  assert.equal(lignes.length, m.tranches.length)
  m.tranches.forEach((u, k) => {
    const repere = repereDe(m, u)
    assert.equal(attribut(lignes[k].attributs, 'aria-pressed'), 'false')
    // Une grandeur dit son unité, sur sa ligne comme à l'oreille : « 10 – 30 ans », « De 10 à 30 ans ».
    assert.equal(lu(attribut(lignes[k].attributs, 'aria-label') ?? ''), lu(`De ${borne(m, u.de)} à ${dire(m, u.a)}${repere ? `, repère : ${repere}` : ''}`))
    assert.ok(texte(lignes[k].dedans).includes(texte(`${borne(m, u.de)} – ${dire(m, u.a)}`)), texte(lignes[k].dedans))
    if (repere) assert.ok(texte(lignes[k].dedans).includes(lu(repere).trim()), `${texte(lignes[k].dedans)} : ${repere}`)
  })
  assert.ok(m.reperes.length <= m.tranches.length, 'un repère par époque, au plus')
  // Plus de frise ni de légende pendant la manche : les repères sont sur leurs lignes.
  assert.doesNotMatch(html, /cab-tranches|cab-epoques-legende/)
  // Les aides, au pied collé : leur phrase, puis une chacune, son nom. Léa a emporté Éclairer : sa prochaine aide est
  // offerte, les deux boutons le disent, et la carte n'a pas le sien — elle faisait deux fois la même aide.
  const pied = texte(piedDe(html))
  assert.match(pied, new RegExp(`^ ?Éclairer t’offre ta prochaine aide\\. ${m.annee ? 'Deux époques de moins' : 'Deux ordres de moins'} Un indice ?$`), pied)
  assert.doesNotMatch(html, /cab-pouvoir/, 'pas de bouton pour la carte qui éclaire')
  // Rien à lancer sans époque, et pas de piste avant elle.
  assert.doesNotMatch(html, /cab-lancer|cab-curseur|cab-filet-anneaux/)
  // Ni la valeur — sauf si elle est une borne, que sa ligne écrit pour tout le monde —, ni l'indice avant qu'il le prenne.
  if (!m.tranches.some(u => u.de === t.valeur || u.a === t.valeur))
    assert.doesNotMatch(corps, new RegExp(`(?<![\\d,])${echapper(texte(formatNumber(t.valeur)))}(?![\\d]|,\\d)`), 'la valeur')
  assert.ok(t.indice && !corps.includes(lu(t.indice).trim()), 'l’indice')
  assert.doesNotMatch(html, /autoFocus|autofocus/)
  assert.doesNotMatch(corps, /★/, 'les étoiles se dessinent ou se disent')
})

test('une époque touchée, l’écran de la valeur : l’époque choisie, le nombre entre ses deux crans, la piste et son repère, ce que le filet prend, « Lancer le filet » au pied', async () => {
  const { choisirLEpoque, cransDUnGrandPas, FILET_EN_DEUX_TEMPS } = await lesEcrans()
  const m = vues.manche.enCours as FiletEnDeuxTempsMontre
  const k = 1
  const u = m.tranches[k]
  const local = choisirLEpoque(m, FILET_EN_DEUX_TEMPS.localDe(m), k) as { epoque: number; x: number }
  assert.deepEqual(local, { epoque: k, x: milieuDeLaTranche(u) }, 'le milieu, d’emblée : « elle devrait se placer directement au milieu »')
  const html = await laPartie(vues.manche, { local })
  // Un autre écran : la question en rappel, l'époque choisie et de quoi en changer — plus les quatre lignes, ni les aides.
  assert.match(html, /<h2 class="quiz-question cab-question[^"]* cab-filet-rappel"/)
  assert.equal(lignesDe(html).length, 0)
  assert.doesNotMatch(html, /cab-filet-aides|cab-filet-consigne/)
  const choisie = /<button type="button" class="cab-filet-choisie"([^>]*)>([\s\S]*?)<\/button>/.exec(html)
  assert.ok(choisie, 'l’époque choisie')
  assert.equal(lu(attribut(choisie[1], 'aria-label') ?? ''), lu(`${m.annee ? 'Époque choisie' : 'Ordre de grandeur choisi'} : de ${borne(m, u.de)} à ${dire(m, u.a)}. ${m.annee ? 'Changer d’époque' : 'Changer d’ordre de grandeur'}`))
  assert.ok(texte(choisie[2]).includes(texte(`${borne(m, u.de)} – ${dire(m, u.a)}`)) && texte(choisie[2]).includes(m.annee ? 'changer d’époque' : 'changer'), texte(choisie[2]))
  // La valeur en grand, entre « − » et « + ».
  assert.match(html, new RegExp(`aria-label="Un cran de moins"[\\s\\S]*?<output class="cab-filet-valeur" aria-live="off">${echapper(borne(m, local.x))}[\\s\\S]*?aria-label="Un cran de plus"`))
  // Ce que le filet prend : trois étoiles pour le petit anneau, deux pour le grand, dessinées — « à tant d'ans » pour une
  // année, qui ne bouge pas avec le curseur ; les réponses qu'il prendrait, en nombres, pour une grandeur.
  const c = ceQueCouvreLeFilet(m, local.x, u.pas >= 1)
  const anneaux = /<p class="cab-filet-anneaux">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? ''
  const ans = (n: number) => `à ${n} an${n > 1 ? 's' : ''}`
  const morceau = (r: { de: number; a: number }) => (r.de === r.a ? `pile sur ${borne(m, r.de)}` : `${borne(m, r.de)}–${borne(m, r.a)}`)
  const trois = m.annee ? ans(m.anneaux.trois) : morceau(c.trois)
  const deux = m.annee ? ans(m.anneaux.deux) : morceau(c.deux)
  assert.match(texte(anneaux), new RegExp(echapper(texte(trois))))
  assert.match(anneaux, /aria-label="3 étoiles sur 3"/)
  if (deux !== trois) {
    assert.match(texte(anneaux), new RegExp(echapper(texte(deux))))
    assert.match(anneaux, /aria-label="2 étoiles sur 3"/)
  }
  // La piste de l'époque : ses bornes, son cran, sa vraie valeur dite ; un trait à chaque grand pas ; les grands pas.
  const curseur = /<input type="range" class="cab-curseur"([^>]*)\/>/.exec(html)?.[1] ?? ''
  assert.deepEqual(
    ['min', 'max', 'step', 'value', 'aria-label', 'aria-valuetext'].map(a => attribut(curseur, a)),
    [String(u.de), String(u.a), String(u.pas), String(local.x), m.annee ? 'L’année' : 'La valeur', dire(m, local.x)],
  )
  const grand = cransDUnGrandPas(u)
  assert.equal((html.match(/class="cab-filet-trait"/g) ?? []).length, Math.ceil(cransDe(u) / grand) - 1)
  const grandDit = m.annee ? `${grand * u.pas} ans` : dire(m, grand * u.pas)
  assert.match(texte(html), new RegExp(`− ${echapper(texte(grandDit))} \\+ ${echapper(texte(grandDit))}`))
  assert.ok(html.includes(`aria-label="${grandDit.replace(' ', '\u{a0}')} de plus"`) || html.includes(`aria-label="${grandDit} de plus"`), 'un grand pas dit sa taille')
  // Le repère de l'époque, écrit au-dessus de son mât : sa valeur, puis son fait.
  const repere = m.reperes.find(x => x.valeur >= u.de && x.valeur <= u.a)
  if (repere) {
    const drapeau = texte(/<p class="cab-filet-drapeau[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '')
    assert.ok(drapeau.includes(texte(borne(m, repere.valeur))) && drapeau.includes(lu(repere.texte).trim()), drapeau)
    assert.equal((html.match(/class="cab-filet-repere/g) ?? []).length, 1)
  } else assert.doesNotMatch(html, /cab-filet-drapeau|class="cab-filet-repere/)
  // « Lancer le filet », seul au pied collé, sous le pouce : sous la piste, il passait sous le pli.
  assert.match(piedDe(html), /^<button type="button" class="btn btn-primary btn-big btn-block cab-lancer">Lancer le filet<\/button><\/div>/)
})

test('ce que la page tient : l’époque touchée garde la valeur qui y tient, un grand pas d’une graduation ronde, ce qui part à l’échéance', async () => {
  const { choisirLEpoque, poserAuCran, rouvrirLesEpoques, ecranDe, phraseDesAides, cransDUnGrandPas, FILET_EN_DEUX_TEMPS } = await lesEcrans()
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
  // Les deux écrans : les époques tant que rien n'est touché, la valeur ensuite ; « changer d'époque » rend les époques, la
  // sienne et son curseur gardés — ce qui part à l'échéance n'en change pas —, et la toucher de nouveau rouvre la piste.
  assert.equal(ecranDe(m, rienDeTouche), 'epoque')
  assert.equal(ecranDe(m, au1937), 'valeur')
  const rouvertes = rouvrirLesEpoques(au1937)
  assert.deepEqual(rouvertes, { epoque: 1, x: 1937, rechoisit: true })
  assert.equal(ecranDe(m, rouvertes), 'epoque')
  assert.deepEqual(FILET_EN_DEUX_TEMPS.aLEcheance(m, rouvertes), { filet: { epoque: 1, x: 1937 } })
  assert.deepEqual(choisirLEpoque(annees, rouvertes, 1), au1937)
  assert.deepEqual(rouvrirLesEpoques(rienDeTouche), rienDeTouche)
  // « Deux époques de moins » a retiré la sienne : le choix revient à faire, aux époques.
  assert.equal(ecranDe({ ...m, retirees: [1, 3] }, au1937), 'epoque')
  // Ce que les aides coûtent, en une phrase : la carte qui éclaire offre la prochaine tant qu'elle peut servir et qu'il en
  // reste une ; payée, ce qu'elle a pris, jamais un cœur ; offerte seule, rien.
  const aides = (indice: 'payee' | 'offerte' | null, epoques: 'payee' | 'offerte' | null) => ({
    prixDUneAide: 1,
    aides: [
      { cle: 'epoques', prise: epoques },
      { cle: 'indice', prise: indice },
    ],
  })
  const coupDOeil = (jouable: boolean) => ({ nom: 'Coup d’œil', jouable })
  assert.equal(phraseDesAides(aides(null, null)), 'Une aide : une étoile, jamais un cœur.')
  assert.equal(phraseDesAides(aides(null, null), coupDOeil(true)), 'Coup d’œil t’offre ta prochaine aide.')
  assert.equal(phraseDesAides(aides(null, null), coupDOeil(false)), 'Une aide : une étoile, jamais un cœur.')
  assert.equal(phraseDesAides(aides('offerte', null), coupDOeil(false)), 'Ton aide était offerte.')
  assert.equal(phraseDesAides(aides('payee', null), coupDOeil(true)), 'Coup d’œil t’offre ta prochaine aide.')
  assert.equal(phraseDesAides(aides('payee', 'offerte'), coupDOeil(false)), 'Ton aide : une étoile, jamais un cœur.')
  assert.equal(phraseDesAides(aides('payee', 'payee'), coupDOeil(true)), 'Tes aides : deux étoiles, jamais un cœur.', 'plus rien à offrir')
  // Une époque touchée change l'écran, et « changer d'époque » le rend : le cadre relance sa garde. Un cran, non.
  const sous = FILET_EN_DEUX_TEMPS.sousEcranDe!
  assert.notEqual(sous(m, rienDeTouche), sous(m, au1937))
  assert.notEqual(sous(m, au1937), sous(m, rouvertes))
  assert.equal(sous(m, au1937), sous(m, poserAuCran(annees, au1937, 3)))
  // « Changer » pose une autre question : la page repart de zéro ; une aide n'y change rien.
  assert.equal(FILET_EN_DEUX_TEMPS.cleDe(vues.aidee.enCours), FILET_EN_DEUX_TEMPS.cleDe(vues.manche.enCours))
  assert.notEqual(FILET_EN_DEUX_TEMPS.cleDe(vues.troisieme.enCours), FILET_EN_DEUX_TEMPS.cleDe(vues.manche.enCours))
})

test('après « Deux époques de moins » : les retirées se replient, barrées, ce qui reste se dit à l’oreille, l’aide dit qu’elle a servi', async () => {
  const m = vues.aidee.enCours as FiletEnDeuxTempsMontre
  const t = tirages[0]
  assert.deepEqual(m.retirees, [...t.retirables])
  const html = await laPartie(vues.aidee)
  const corps = texte(corpsDe(html))
  const restent = m.tranches.filter((_, i) => !m.retirees.includes(i)).map(u => `${borne(m, u.de)}–${borne(m, u.a)}`)
  // Ce qui reste, à l'oreille, où le focus se pose : à l'œil, les lignes retirées se sont repliées.
  assert.match(html, /<p class="sr-only cab-filet-restent" tabindex="-1">/, 'le focus s’y pose')
  assert.match(corps, new RegExp(echapper(texte(`Il reste ${restent.join(' et ')}.`))))
  const lignes = lignesDe(html)
  m.tranches.forEach((u, i) => {
    if (!m.retirees.includes(i)) return assert.doesNotMatch(lignes[i].classes, /cab-epoque-retiree/)
    assert.match(lignes[i].classes, /cab-epoque-retiree/)
    assert.equal(lu(attribut(lignes[i].attributs, 'aria-label') ?? ''), lu(`De ${borne(m, u.de)} à ${dire(m, u.a)}, retirée`))
    assert.equal(attribut(lignes[i].attributs, 'aria-disabled'), 'true')
    assert.doesNotMatch(lignes[i].dedans, /cab-epoque-repere/, 'une époque retirée ne garde que ses bornes')
  })
  // L'aide dit qu'elle a servi, sous son nom, accordée à lui ; l'autre reste à prendre, et la carte de Léa l'offre encore.
  const pied = texte(piedDe(html))
  assert.match(pied, new RegExp(`${m.annee ? 'Deux époques de moins retirées' : 'Deux ordres de moins retirés'} Un indice ?$`), pied)
  assert.match(pied, /Éclairer t’offre ta prochaine aide\./)
  // L'étoile de l'époque, l'aide l'a prise : la consigne ne la promet plus.
  assert.doesNotMatch(corps, /la bonne vaut une étoile/)
})

test('Éclairer offre l’indice : il paraît sous la question, le focus s’y pose, et l’aide dit qu’elle était offerte', async () => {
  const m = vues.eclairee.enCours as FiletEnDeuxTempsMontre
  const t = tirages[0]
  assert.equal(m.indice, t.indice)
  const html = await laPartie(vues.eclairee)
  const corps = texte(corpsDe(html))
  assert.match(html, /<p class="cab-souffle cab-filet-indice" tabindex="-1">/)
  assert.ok(corps.includes(lu(`Indice : ${t.indice}`).trim()), corps)
  const pied = texte(piedDe(html))
  assert.match(pied, /Un indice offert ?$/, pied)
  // L'aide payée avant parle toujours : ce qu'elle a pris, jamais un cœur — l'offerte n'en est pas une de plus, et la carte a servi.
  assert.match(pied, /^ ?Ton aide : une étoile, jamais un cœur\./, pied)
  // L'ordre de l'écran : la question, l'indice, les époques, et les aides au pied — sous les aides, l'indice passait
  // derrière le bouton du bas. Il prend la place de la catégorie, que la manche a dite en s'ouvrant.
  const ici = (x: string) => html.indexOf(x)
  assert.ok(ici('class="quiz-question') < ici('cab-filet-indice') && ici('cab-filet-indice') < ici('class="cab-epoques-liste') && ici('class="cab-epoques-liste') < ici('class="cab-filet-aides"'))
  assert.doesNotMatch(html, /quiz-categorie/)
  assert.match(await laPartie(vues.manche), /quiz-categorie/)
  // Sur l'écran de la valeur, il reste sous les yeux, entre l'époque choisie et le nombre.
  const { choisirLEpoque, FILET_EN_DEUX_TEMPS } = await lesEcrans()
  const libre = m.tranches.findIndex((_, i) => !m.retirees.includes(i))
  const valeur = await laPartie(vues.eclairee, { local: choisirLEpoque(m, FILET_EN_DEUX_TEMPS.localDe(m), libre) })
  const la = (x: string) => valeur.indexOf(x)
  assert.ok(la('cab-filet-choisie') < la('cab-filet-indice') && la('cab-filet-indice') < la('cab-filet-valeur'))
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
  // Au Filet d'avant, Éclairer pose sa zone dorée par le bouton de la carte, que le cadre garde ; au nouveau, il offre une
  // aide que ses boutons disent, et le jeu colle son pied.
  assert.equal(FILETS.cibleDEclairer, undefined, 'Éclairer ne vise plus rien de lui-même : l’aide touchée dit son rang')
  assert.deepEqual([FILETS.tientEclairer?.(avant), FILETS.tientEclairer?.(nouveau)], [false, true])
  assert.deepEqual([FILETS.aUnPied?.(avant), FILETS.aUnPied?.(nouveau)], [false, true])
  assert.equal(FILETS.sousEcranDe?.(avant, FILET.localDe(avant)), '', 'rien ne glisse sous le doigt au Filet d’avant')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const manche = (montree: unknown) =>
    renderToStaticMarkup(React.createElement(FILETS.Manche, { montree, local: FILETS.localDe(montree), setLocal: rien, envoyer: rien, garde: () => true, gardeDeLEcran: () => true, busy: false, partie: 'p' }))
  assert.match(manche(avant), /cab-tailles/, 'les trois filets d’avant')
  assert.doesNotMatch(manche(avant), /cab-epoques-liste/)
  assert.match(manche(nouveau), /cab-epoques-liste/)
  assert.doesNotMatch(manche(nouveau), /cab-tailles/)
  // Par le cadre : une partie du Filet d'avant garde le bouton de sa carte, et aucun pied de jeu.
  const { EcranDeLaPartie, chronoMontre } = await import(url('views/cabinet/Partie.tsx'))
  const dAvant = { ...vues.manche, enCours: avant }
  const html = renderToStaticMarkup(
    React.createElement(EcranDeLaPartie, { vue: dAvant, ecran: FILETS, local: FILETS.localDe(avant), setLocal: rien, chrono: chronoMontre(dAvant, dAvant.maintenant), busy: false, miser: null, garde: () => true, gardeDeLEcran: () => true, onGeste: rien, onQuitter: rien, onSuivante: rien, onMiser: rien, onSignaler: rien, onMusee: rien }),
  )
  assert.match(html, /cab-pouvoir/, 'le bouton de la carte qui éclaire')
  assert.doesNotMatch(html, /cab-filet-aides/)
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
  for (const classe of new Set([...s.matchAll(/cab-(?:epoques?|tranche|filet-(?:anneau|trait|repere|aide|juge|oui|non|consigne|restent|etape|choisie|nombre|glissiere|drapeau|indice|rappel|prix))[a-z-]*/g)].map(m => m[0])))
    assert.match(feuille, new RegExp(`\\.${classe}\\b`), `.${classe} a sa règle`)
})
