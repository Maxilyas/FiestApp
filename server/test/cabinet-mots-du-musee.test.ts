// Ce que disent l'œuvre, les règles, la salle, l'Éclair, le musée et le bilan
// (la tablée du 26 octobre 2026, le lot « les-mots-du-musee ») : chaque phrase
// que la tablée a lue de travers, rendue en HTML (`renderToStaticMarkup`) sur
// ce qu'un vrai serveur rend à des joueurs qui jouent par les routes — les
// réponses lues dans le plan en base. Une œuvre gagnée à la visite à un autre
// jeu que le sien ne se dit plus « à rejouer » ; deux cadres vides ne portent
// plus le même nom à l'oreille ; le carnet de l'Éclair se nomme ; le Scarabée
// et la série disent qu'un jour se gagne en répondant ; la visite ne promet
// plus deux minutes ; l'œuvre gagnée a son titre au bilan. Sans navigateur :
// seul le premier rendu se lit ; les écrans se regardent au téléphone par
// `server/scripts/rendu-cabinet.ts` (skill `regarder-le-rendu`).
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { inscrireProfil } from './banc'
import {
  bancDuCabinet,
  commencer,
  departEnBase,
  fermerLesMagasins,
  jouer,
  jouerDesIndices,
  jouerUnDetail,
  jouerUnEclair,
  jouerUneEpingle,
  jouerUneFrise,
  jouerUneReplique,
  jouerUnFilet,
  jouerUnMot,
  jouerUnPari,
  laPage,
  lire,
  ok,
  ouvrir,
  type BancDuCabinet,
} from './cabinet-banc'
import { CASES_DE_LA_VISITE, ETOILES_PAR_MANCHE, JOURS_DU_SCARABEE, SEUILS_DES_RARETES } from '../../shared/cabinet/bareme'
import { JEUX, type CleDeJeu } from '../../shared/cabinet/jeux/regle'
import { JEU_DE_L_OEUVRE, oeuvre as oeuvreDe, type CleDOeuvre } from '../../shared/cabinet/oeuvres'
import { conditionDuGardien } from '../../shared/cabinet/salles'
import type { Cartel, PageDuCabinet, VueDeLaPartie } from '../../shared/cabinet/vues'

// Le client compile son JSX pour un `React` global, et `state.ts` lit son adresse à l'import : posés avant tout composant.
Object.assign(globalThis, { React, window: { location: { pathname: '/cabinet', search: '', hash: '', origin: 'http://banc' }, addEventListener: () => {} } })

const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href

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
    .replace(/⁠/g, '')
    .replace(/[  ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Ce que l'œil lit d'un rendu, sans ce qui ne se dit qu'à l'oreille (`.sr-only`). */
const aLOeil = (html: string) => texte(html.replace(/<span class="sr-only">[^<]*<\/span>/g, ''))

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Une phrase de l'écran, cherchée telle que `texte()` la lit. */
const phrase = (s: string) => new RegExp(echapper(texte(s)))

/** Les balises qui n'ont pas de fin. */
const VIDES = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'wbr'])

/**
 * Le nom qu'un lecteur d'écran donne à un lien : son texte, sans ce que
 * `aria-hidden` cache — le cadre peint d'un cadre vide l'est —, le texte de
 * remplacement d'une image en plus. Chaque morceau séparé d'un blanc : c'est
 * ainsi qu'Hugo les entendait (« Commune à la Frise »).
 */
function nomALOreille(html: string): string {
  const morceaux: string[] = []
  const caches: boolean[] = []
  for (const [, fin, balise, attributs, brut] of html.matchAll(/<(\/?)([a-z0-9]+)([^>]*)>|([^<]+)/g)) {
    const cache = caches.includes(true)
    if (brut !== undefined) {
      if (!cache) morceaux.push(brut)
    } else if (fin) caches.pop()
    else {
      const altDe = /\balt="([^"]*)"/.exec(attributs)
      if (balise === 'img' && altDe && !cache) morceaux.push(altDe[1])
      if (!VIDES.has(balise) && !attributs.endsWith('/')) caches.push(/aria-hidden="true"/.test(attributs))
    }
  }
  return texte(morceaux.join(' '))
}

const rien = () => {}

// ── Des joueurs, par les vraies routes ────────────────────────────────────

let b: BancDuCabinet
/** Une joueuse qui vient d'arriver : ses quatre œuvres offertes, rien d'autre. */
let neuve: PageDuCabinet

/** Une manche jouée sans faute, quel que soit le jeu que la visite a mis dans la case : trois étoiles. */
const SANS_FAUTE: Record<CleDeJeu, (cookie: string, v: VueDeLaPartie, k: number) => Promise<VueDeLaPartie>> = {
  pari: (c, v, k) => jouerUnPari(b, c, v, k),
  eclair: (c, v, k) => jouerUnEclair(b, c, v, k),
  frise: (c, v, k) => jouerUneFrise(b, c, v, k),
  detail: (c, v, k) => jouerUnDetail(b, c, v, k),
  mot: (c, v, k) => jouerUnMot(b, c, v, k),
  filet: (c, v, k) => jouerUnFilet(b, c, v, k),
  epingle: (c, v, k) => jouerUneEpingle(b, c, v, k),
  indices: (c, v, k) => jouerDesIndices(b, c, v, k),
  replique: (c, v, k) => jouerUneReplique(b, c, v, k),
}

/** L'œuvre qu'une partie de la visite a gagnée à un autre jeu que le sien, et ce que le serveur en dit. */
interface GagneeAUnAutreJeu {
  cookie: string
  cle: CleDOeuvre
  /** Le jeu de la case de la visite, où elle a été gagnée. */
  jeuDeLaVisite: CleDeJeu
  /** La vue de la partie finie, son bilan compris. */
  fin: VueDeLaPartie
}
let gagnee: GagneeAUnAutreJeu

/**
 * Comme Lucas, Théo et Ophélie : une case de la visite qui met en jeu une œuvre
 * dont le jeu n'est pas le sien — onze des quatorze œuvres gagnées à la visite
 * dans la base de la tablée. La visite tire ses jeux dans l'ordre du jour et
 * ses œuvres à part (`shared/cabinet/musee.ts`), de la graine secrète du profil :
 * on lit le départ en base, et une case qui met en jeu une œuvre de son propre
 * jeu, ou une épique — sept étoiles, qu'on n'atteint pas sans le cadre doré —,
 * se quitte, au profil suivant s'il le faut. Deux manches sans faute, puis
 * « Quitter » : six étoiles, l'œuvre gagnée, sans cadre doré — dorée, sa fiche
 * n'aurait plus rien à jouer.
 */
async function uneOeuvreGagneeAUnAutreJeu(): Promise<GagneeAUnAutreJeu> {
  for (let i = 0; i < 6; i++) {
    const cookie = await inscrireProfil(b.banc.url, `visiteur${i}`, `Visiteur ${i}`)
    for (let k = 0; k < CASES_DE_LA_VISITE; k++) {
      let v = ok(await commencer(b, cookie, { origine: 'visite', case: k, carte: null }), `la case ${k}`)
      const d = departEnBase(b.fichier, v.id)
      const cle = d.cible as CleDOeuvre | null
      if (cle === null || JEU_DE_L_OEUVRE[cle] === d.jeu || d.seuil === null || d.seuil > 2 * ETOILES_PAR_MANCHE) {
        ok(await jouer(b, cookie, v, { quoi: 'quitter' }), 'quitter la case')
        continue
      }
      v = await SANS_FAUTE[d.jeu](cookie, v, 0)
      v = await ouvrir(b, cookie, v, 1)
      v = await SANS_FAUTE[d.jeu](cookie, v, 1)
      const fin = ok(await jouer(b, cookie, v, { quoi: 'quitter' }), 'quitter après deux manches')
      return { cookie, cle, jeuDeLaVisite: d.jeu, fin }
    }
  }
  throw new Error('aucune case de la visite ne met en jeu une œuvre d’un autre jeu')
}

before(async () => {
  b = await bancDuCabinet()
  neuve = ok(await laPage(b, await inscrireProfil(b.banc.url, 'hugo', 'Hugo')), 'la page neuve')
  gagnee = await uneOeuvreGagneeAUnAutreJeu()
})
after(() => b?.banc.close())
after(fermerLesMagasins)

const lOeuvre = (page: PageDuCabinet, cle: string, cartel: object) =>
  rendu('views/cabinet/Oeuvre', 'Oeuvre', { page, cle, cartel, carte: null, busy: false, onCarte: rien, onAcheter: rien, onDorer: rien, onJouer: rien })

// ── L'œuvre gagnée à la visite : son jeu, et pourquoi ─────────────────────

test('une œuvre gagnée à la visite à un autre jeu que le sien : « La jouer » à son jeu, et la fiche dit que la visite l’avait mise en jeu ailleurs', async () => {
  const { cookie, cle, jeuDeLaVisite, fin } = gagnee
  const sonJeu = JEUX[JEU_DE_L_OEUVRE[cle]]
  assert.notEqual(JEU_DE_L_OEUVRE[cle], jeuDeLaVisite, 'gagnée à un autre jeu que le sien')
  assert.equal(fin.bilan?.issue, 'gagnee', 'gagnée, sans cadre doré')
  const page = ok(await laPage(b, cookie), 'la page')
  const vue = page.salles.flatMap(s => s.oeuvres).find(x => x.cle === cle)!
  assert.ok(vue.possedee && !vue.doree)
  // Son cartel, tel que le serveur le rend : la partie de la visite, à son jeu à elle.
  const cartel = ok(await lire<Cartel>(b, cookie, `/api/cabinet/oeuvre/${cle}`), 'le cartel')
  assert.equal(cartel.partie?.jeu, jeuDeLaVisite)
  const t = texte(await lOeuvre(page, cle, { etat: 'lu', cartel }))
  assert.match(t, phrase(`Gagnée ${JEUX[jeuDeLaVisite].a}`))
  // « La rejouer » était faux huit fois sur neuf : elle n'a jamais été jouée à ce jeu-là. « Rejoue-la » non plus (`/rejou/`).
  assert.doesNotMatch(t, /rejou/i)
  assert.match(t, phrase(`La jouer ${sonJeu.a} pour la dorer · une chasse`))
  // Pourquoi un autre jeu que celui du cartel : chaque œuvre a le sien, et la visite l'avait mise en jeu ailleurs.
  assert.match(t, phrase(`Chaque œuvre a son jeu : la sienne se joue ${sonJeu.a}. La visite l’avait mise en jeu ${JEUX[jeuDeLaVisite].a}.`))
  // Gagnée à son propre jeu — en chasse —, rien à expliquer : la fiche ne dit que « La jouer ».
  const aSonJeu = texte(await lOeuvre(page, cle, { etat: 'lu', cartel: { ...cartel, partie: { ...cartel.partie!, jeu: JEU_DE_L_OEUVRE[cle] } } }))
  assert.match(aSonJeu, phrase(`La jouer ${sonJeu.a} pour la dorer`))
  assert.doesNotMatch(aSonJeu, /Chaque œuvre a son jeu|La visite l’avait/)
  // Le cartel en chemin : rien ne se devine avant lui.
  assert.doesNotMatch(texte(await lOeuvre(page, cle, { etat: 'chargement' })), /Chaque œuvre a son jeu|La visite l’avait/)
  // Une œuvre offerte à l'arrivée, sans partie à raconter : son jeu, sans rien de la visite. Son cartel, la phrase du serveur,
  // ne dit pas non plus « Rejoue-la » d'une œuvre qu'on n'a jamais jouée : il tombait juste au-dessus de « La jouer » (la
  // relecture du lot) — `/rejouer/` le laissait passer.
  const offerte = page.salles.flatMap(s => s.oeuvres).find(x => x.possedee && !x.doree && x.cle !== cle)!
  const sonCartel = ok(await lire<Cartel>(b, cookie, `/api/cabinet/oeuvre/${offerte.cle}`), 'le cartel d’une offerte')
  assert.equal(sonCartel.partie, undefined)
  assert.equal(sonCartel.dit, 'Offerte à ton arrivée. Joue-la à son jeu pour dorer son cadre : elle gardera ici ce que tu auras appris.')
  const tOfferte = texte(await lOeuvre(page, offerte.cle, { etat: 'lu', cartel: sonCartel }))
  assert.match(tOfferte, phrase(`La jouer ${JEUX[offerte.jeu].a} pour la dorer`))
  assert.doesNotMatch(tOfferte, /rejou|La visite l’avait/i)
})

test('une œuvre doublée à la visite se dit « Jouée » sur son cartel et au bilan, jamais « Rejouée » : offerte, elle n’avait jamais été jouée', async () => {
  const { ceQueLaPartieAFait, titreAuBilan } = await import(url('views/cabinet/Cartel.tsx'))
  assert.deepEqual(ceQueLaPartieAFait('double'), { appris: 'en la jouant', partie: 'Jouée' })
  // Au bilan de la partie qui la double, le même mot — la fin dit qu'elle devient son cartel, ou non.
  assert.equal(titreAuBilan({ issue: 'double', devientSonCartel: true, gains: {} }), 'Son cartel : ce que tu as appris en la jouant')
  assert.equal(titreAuBilan({ issue: 'double', gains: {} }), 'Ce que tu as appris en la jouant')
  // Coup d'œil, offerte à l'arrivée, puis doublée à une case de la visite pour la dorer : sans cartel, elle prend celui de cette
  // partie (`BilanVu.devientSonCartel`). Un double ne vient que d'une œuvre à lui (`issueDe`) — souvent l'une des quatre
  // offertes, ou une achetée : son cartel la disait « Rejouée » la première fois qu'elle était jouée.
  const cartel = {
    oeuvre: 'coup-d-oeil',
    origine: 'depart',
    doree: false,
    partie: { id: 'p', jeu: 'pari', jour: 'le 26 octobre 2026', total: 7, issue: 'double', sujet: 'Une question ?', reponse: 'Sa réponse', anecdote: null },
  }
  const t = texte(await rendu('views/cabinet/Cartel', 'CartelDeLOeuvre', { lu: { etat: 'lu', cartel } }))
  assert.match(t, /^Ce que tu as appris en la jouant /)
  assert.match(t, phrase(`Jouée ${JEUX.pari.a} · 7 sur 9`))
  assert.doesNotMatch(t, /rejou/i)
})

test('la feuille des règles dit que chaque œuvre a son jeu, celui de son cadre vide, et que la visite met les siennes en jeu aux jeux du jour ; nulle part qu’une œuvre se « rejoue »', async () => {
  const t = texte(await rendu('views/cabinet/Regles', 'Regles', { jeux: neuve.jeux }))
  assert.match(t, /Chaque œuvre a son jeu, celui que son cadre vide affiche : on l’y cherche, on l’y dore ; la visite, elle, met ses œuvres en jeu aux jeux du jour\./)
  // « Où se jouent sa chasse et sa dorure » contredisait la ligne d'au-dessus : une case manquée se retente au jeu de la case,
  // pour une chasse, et une case de la visite dore aussi, au jeu du jour (la relecture du lot).
  assert.doesNotMatch(t, /où se jouent sa chasse/)
  // Le glossaire de la même feuille : une œuvre offerte, jamais jouée, ne se « rejoue » pas, et son cartel ne vient pas d'une
  // partie « rejouée ». Seule une partie quittée « ne se rejoue pas » — celle-là, on l'a jouée.
  assert.match(t, /Chasse Jouer l’œuvre de ton choix à son jeu : pour la gagner, ou pour la dorer si elle est à toi\./)
  assert.match(t, /Cartel La plaque sous une œuvre : ce que tu as appris en jouant pour elle\./)
  assert.doesNotMatch(t.replace('Quitter une partie la compte avec ses étoiles : elle ne se rejoue pas.', ''), /rejou/i)
})

// ── Les cadres vides, à l'oreille ─────────────────────────────────────────

test('les cadres vides d’une salle ont chacun leur nom à l’oreille — « Cadre vide », et leur rang entre jumeaux —, rien de changé à l’œil, et aucun ne nomme son œuvre', async () => {
  const vestibule = neuve.salles.find(s => s.cle === 'vestibule')!
  const html = await rendu('views/cabinet/Salle', 'Salle', { salle: vestibule, page: neuve })
  const liens = [...html.matchAll(/<a class="cab-oeuvre cab-vide" href="#oeuvre-([^"]+)"[^>]*>(.*?)<\/a>/g)].map(([, cle, dedans]) => ({ cle, dedans, nom: nomALOreille(dedans) }))
  assert.equal(liens.length, vestibule.oeuvres.filter(o => !o.possedee).length, 'un lien par cadre vide')
  // Hugo entendait deux fois « Commune à la Frise », et jamais « cadre vide ».
  for (const l of liens) assert.match(l.nom, /^Cadre vide : /, l.nom)
  const noms = liens.map(l => l.nom)
  assert.equal(new Set(noms).size, noms.length, `deux cadres vides portent le même nom : ${noms.join(' | ')}`)
  // Deux communes du Vestibule à la Frise — la table gelée : un rang les sépare, « 1 sur 2 » et « 2 sur 2 ».
  const jumeaux = vestibule.oeuvres.filter(o => !o.possedee && o.rarete === 'commun' && o.jeu === 'frise')
  assert.equal(jumeaux.length, 2, 'deux communes du Vestibule à la Frise')
  const dits = jumeaux.map(o => liens.find(l => l.cle === o.cle)!.nom)
  assert.match(dits[0], /\(1 sur 2\)$/)
  assert.match(dits[1], /\(2 sur 2\)$/)
  // Un cadre vide sans jumeau n'a pas de rang.
  const seul = liens.find(l => !/sur \d+\)$/.test(l.nom))
  assert.ok(seul, 'un cadre sans jumeau, sans rang')
  for (const l of liens) {
    // Rien ne change à l'œil : la rareté et le jeu, comme avant.
    const vu = aLOeil(l.dedans)
    assert.doesNotMatch(vu, /Cadre vide|sur \d/, vu)
    // Ni le nom ni la peinture de son œuvre : on la découvre en la gagnant (invariant 1).
    assert.ok(!l.nom.includes(oeuvreDe(l.cle)!.nom), `${l.nom} nomme son œuvre`)
    assert.doesNotMatch(l.dedans, /<img/)
  }
})

// ── L'Éclair : quel carnet ────────────────────────────────────────────────

test('la révélation de l’Éclair nomme le carnet de révision de la campagne, jamais « le carnet » seul', async () => {
  const cookie = await inscrireProfil(b.banc.url, 'theo', 'Théo')
  const v = await jouerUnEclair(b, cookie, ok(await commencer(b, cookie, { origine: 'libre', jeu: 'eclair', carte: null }), 'l’Éclair'), 0, false)
  const r = v.revelation!
  const { ECLAIR } = await import(url('views/cabinet/jeux/Eclair.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  const t = texte(renderToStaticMarkup(React.createElement(ECLAIR.Revelation, { corps: r.corps, partie: v.id, tirage: r.tirage, fin: r.fin })))
  // Théo, Jeanne et Camille demandaient « quel carnet ? » : aucune page du Cabinet n'en présente un.
  assert.doesNotMatch(t, /au carnet(?! de révision)/)
  assert.match(t, /Ces affirmations ne vont pas au carnet de révision de la campagne\./)
})

// ── La série et le Scarabée : un jour se gagne en répondant ───────────────

test('la condition du Scarabée et la série du musée disent qu’un jour ne compte qu’à une manche répondue', async () => {
  // La reproduction de la relecture (`serveur-textes-de-l-ancienne-regle.test.ts`, épreuve 1) : « 30 jours de visite ou de chasse
  // d'affilée » se lisait « commencer une visite chaque jour ».
  const condition = conditionDuGardien('lg:scarabee')!
  assert.match(condition, /répond/, condition)
  assert.match(condition, new RegExp(`^${JOURS_DU_SCARABEE} jours`))
  // Telle que le serveur l'envoie à la fiche du gardien endormi.
  const scarabee = neuve.gardiens.tous.find(g => g.legendaire === 'lg:scarabee')!
  assert.equal(scarabee.condition, condition)
  const fiche = texte(await rendu('views/cabinet/Gardiens', 'FicheDuGardien', { gardien: scarabee, carte: null, onCarte: rien, onFermer: rien }))
  assert.match(fiche, /Pour le réveiller : \d+ jours d’affilée à répondre à une manche de visite ou de chasse\./)
  // Le musée : la série se garde en répondant, comme la visite le dit.
  const musee = texte(
    await rendu('views/cabinet/Musee', 'Musee', { page: { ...neuve, serie: { jours: 12, aJouer: true, record: 12 } }, bienvenue: false, onRegles: rien, onReprendre: rien, onBienvenueLue: rien }),
  )
  assert.match(musee, /12 jours de visite d’affilée\. Réponds à une manche aujourd’hui pour garder ta série\./)
  assert.doesNotMatch(musee, /Joue aujourd’hui/)
})

// ── La visite ne promet plus deux minutes ─────────────────────────────────

test('le musée ne promet plus des parties de deux minutes : le Mot en donne deux par manche', async () => {
  const musee = (bienvenue: boolean) => rendu('views/cabinet/Musee', 'Musee', { page: neuve, bienvenue, onRegles: rien, onReprendre: rien, onBienvenueLue: rien })
  // Ophélie additionnait les chronos, deux minutes à six au Mot : la promesse tenait 53 parties sur 54, pas toutes.
  for (const html of [await musee(false), await musee(true)]) assert.doesNotMatch(texte(html), /deux minutes/)
  assert.match(texte(await musee(false)), new RegExp(`${neuve.visite.cases.length} petites parties · 0 sur ${neuve.visite.cases.length} faite`))
  assert.match(texte(await musee(true)), /de petits jeux de quelques minutes/)
})

// ── La documentation, des mêmes mots ──────────────────────────────────────

const doc = (fichier: string) => readFileSync(new URL(`../../${fichier}`, import.meta.url), 'utf8')

test('la documentation dit les mots de l’écran : de petits jeux de quelques minutes, et une œuvre qui se joue à son jeu pour la dorer, jamais « rejouée »', () => {
  // La relecture du lot : la page ne promettait plus deux minutes, le produit et le sommaire si ; elle ne disait plus « la
  // rejouer », le produit et la référence si — d'une œuvre offerte ou achetée, jamais jouée.
  const produit = doc('docs/produit/le-cabinet.md')
  assert.doesNotMatch(produit, /jeux de deux minutes/i)
  assert.doesNotMatch(produit, /rejou/i)
  assert.match(produit, /petits jeux de quelques minutes/)
  const sommaire = doc('docs/README.md').split('\n').find(l => l.includes('produit/le-cabinet.md'))!
  assert.doesNotMatch(sommaire, /deux minutes/, sommaire)
  const reference = doc('docs/reference/glossaire.md').split('\n')
  for (const mot of ['Cadre doré', 'Cartel', 'Chasse']) {
    const ligne = reference.find(l => l.startsWith(`| ${mot} |`))!
    assert.doesNotMatch(ligne, /rejou/i, ligne)
  }
})

// ── L'œuvre gagnée, au bilan ──────────────────────────────────────────────

test('au bilan, l’œuvre gagnée a son titre à son nom ; sa peinture levée se tait, son bandeau la nomme ; un cadre vide ne montre rien', async () => {
  const { cle, fin } = gagnee
  const o = oeuvreDe(cle)!
  const html = await rendu('views/cabinet/Bilan', 'BilanDeLaPartie', { vue: fin, ecran: null, onMusee: rien })
  const section = /<section class="cab-oeuvre-gagnee" aria-labelledby="([^"]+)">(.*?)<\/section>/.exec(html)
  assert.ok(section, 'l’œuvre gagnée, une section titrée')
  const [, id, dedans] = section
  // Hugo, au lecteur d'écran : une région nommée sans titre, qu'on ne trouvait pas en sautant de titre en titre.
  const titre = new RegExp(`<h2 id="${echapper(id)}"[^>]*>(.*?)</h2>`).exec(dedans)
  assert.ok(titre, 'son titre, un h2')
  assert.equal(texte(titre[1]), texte(o.nom))
  assert.equal([...dedans.matchAll(/<h2/g)].length, 1)
  // Sa peinture levée : son bandeau dit déjà son nom, juste dessous — un texte de remplacement le ferait dire deux fois.
  assert.match(dedans, /<img class="exp-vc-peinture"[^>]* alt=""/)
  assert.equal(texte(/<b class="exp-vc-nom">(.*?)<\/b>/.exec(dedans)?.[1] ?? ''), texte(o.nom))
  // De même sur sa fiche : son nom en titre, juste sous la peinture.
  const page = ok(await laPage(b, gagnee.cookie), 'la page')
  const fiche = await lOeuvre(page, cle, { etat: 'chargement' })
  assert.match(fiche, /<img class="exp-vc-peinture"[^>]* alt=""/)
  // Un cadre vide : ni peinture ni nom, à l'œil comme à l'oreille (invariant 1).
  const vide = page.salles.flatMap(s => s.oeuvres).find(x => !x.possedee)!
  const cadre = await lOeuvre(page, vide.cle, { etat: 'chargement' })
  assert.doesNotMatch(cadre, /<img/)
  assert.ok(!texte(cadre).includes(texte(oeuvreDe(vide.cle)!.nom)), 'le cadre vide ne nomme pas son œuvre')
  // Gagnée à six étoiles, sous le seuil d'une épique : la visite n'a mis en jeu qu'une commune, une rare ou une maudite.
  assert.ok(fin.bilan!.total >= SEUILS_DES_RARETES[o.rarete])
})
