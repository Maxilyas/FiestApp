// L'historique des duels (les souhaits du propriétaire du 13 octobre 2026 :
// « pareil pour l'historique, je trouve cela un peu pauvre niveau
// métriques », et « ça en affiche un maximum de 3 ») : son bilan et ses
// records, ses face-à-face, la courbe de sa cote, puis tous ses duels, page
// par page — relus du journal à chaque lecture, comme la cote. Un résultat
// qu'il n'a pas encore vu n'y compte nulle part : sa carte se retourne
// d'abord.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import React from 'react'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { VIES } from '../../shared/campagne'
import {
  COTE_DE_DEPART,
  DUELS_DE_L_HISTOIRE,
  JOURS_DE_L_HISTOIRE,
  POINTS_DE_LA_COURBE,
  bilanDesDuels,
  pageDeLHistoire,
  releverLesDuels,
  type DuelRaconte,
} from '../../shared/duels'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/duels', search: '', hash: '', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
})
const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)

const semaine = () => '2026-10-12'
const JOUR_MS = 24 * 3_600_000

/** Un journal fabriqué : `contre` '' pour Automate, un duel par minute. */
function journal(...duels: [contre: string, justes: number, sesJustes: number, plus?: Partial<DuelRaconte>][]): DuelRaconte[] {
  const t = Date.UTC(2026, 9, 12, 8)
  return duels.map(([contre, justes, sesJustes, plus], i) => ({ serie: `s${String(i + 1).padStart(3, '0')}`, justes, sesJustes, finiLe: t + i * 60_000, contre, ...plus }))
}

test('le bilan relit le journal : ses victoires, ses séries — une égalité rompt la sienne —, sa plus haute cote, sa plus belle victoire, ses face-à-face, la courbe ; un résultat pas vu n’y compte pas', () => {
  const duels = journal(
    ['', 9, 8],
    ['', 10, 8],
    ['tom', 5, 7, { code: 'TOM1', coteAdverse: 1100 }],
    ['tom', 8, 8, { code: 'TOM2', coteAdverse: 1100 }],
    ['hugo', 9, 4, { code: 'HUG1', coteAdverse: 1300 }],
    ['', 9, 8],
    ['tom', 9, 3, { code: 'TOM3', coteAdverse: 1050 }],
    // Joué des deux côtés, mais il n'a pas encore retourné sa carte.
    ['hugo', 2, 9, { code: 'HUG2', coteAdverse: 1300, aVoir: true }],
  )
  const { ecarts } = releverLesDuels(duels, semaine)
  const b = bilanDesDuels(duels, ecarts)
  assert.deepEqual([b.joues, b.victoires, b.defaites, b.egalites], [7, 5, 1, 1])
  assert.deepEqual([b.serie, b.meilleureSerie], [3, 3], 'deux victoires, la défaite et l’égalité, puis trois victoires')
  const apres = duels.slice(0, 7).map(d => ecarts.get(d.serie)!.avant + ecarts.get(d.serie)!.ecart)
  assert.equal(b.plusHaute, Math.max(COTE_DE_DEPART, ...apres))
  // La plus belle : la victoire qui a le plus rapporté — battre Hugo, classé à 1300.
  const gagnees = [0, 1, 4, 5, 6].map(i => duels[i])
  const plusBelle = gagnees.reduce((m, d) => (ecarts.get(d.serie)!.ecart >= ecarts.get(m.serie)!.ecart ? d : m))
  assert.equal(plusBelle.contre, 'hugo')
  assert.deepEqual(b.plusBelle, { contre: 'hugo', justes: 9, sesJustes: 4, ecart: ecarts.get(plusBelle.serie)!.ecart, le: plusBelle.finiLe })
  // Les plus affrontés d'abord ; à nombre égal, le plus récent : Tom (trois, le dernier joué), Automate (trois), Hugo — son duel pas vu ne compte pas.
  assert.deepEqual(b.faceAFace, [
    { contre: 'tom', victoires: 1, defaites: 1, egalites: 1 },
    { contre: '', victoires: 3, defaites: 0, egalites: 0 },
    { contre: 'hugo', victoires: 1, defaites: 0, egalites: 0 },
  ])
  // Sa cote avant le premier, puis après chacun de ceux qu'il a vus.
  assert.deepEqual(b.courbe, [COTE_DE_DEPART, ...apres])

  // Rien de joué : rien à dire, sauf la cote de départ.
  assert.deepEqual(bilanDesDuels([], new Map()), { joues: 0, victoires: 0, defaites: 0, egalites: 0, serie: 0, meilleureSerie: 0, plusHaute: COTE_DE_DEPART, faceAFace: [], courbe: [] })
  // Une égalité en dernier : plus de série en cours.
  const egal = journal(['', 9, 8], ['', 9, 9])
  assert.equal(bilanDesDuels(egal, releverLesDuels(egal, semaine).ecarts).serie, 0)
  // Une longue carrière : la courbe garde ses derniers duels, la cote d'avant le premier d'entre eux en tête.
  const long = journal(...Array.from({ length: 45 }, (_, i): [string, number, number] => ['', 8 + (i % 3), 8]))
  const relu = releverLesDuels(long, semaine).ecarts
  const courbe = bilanDesDuels(long, relu).courbe
  assert.equal(courbe.length, POINTS_DE_LA_COURBE + 1)
  assert.equal(courbe[0], relu.get(long[45 - POINTS_DE_LA_COURBE].serie)!.avant)
})

test('l’historique se lit page par page, les plus récents d’abord, un mois au plus : rien de perdu entre deux pages, pas même deux duels de la même milliseconde', () => {
  const duels = journal(...Array.from({ length: 24 }, (_, i): [string, number, number] => [i % 2 ? 'tom' : '', 9, 8]))
  // Deux duels finis à la même milliseconde, de part et d'autre de la limite d'une page.
  duels[13].finiLe = duels[14].finiLe
  // Un trop ancien, un pas encore vu.
  duels[0].finiLe -= 40 * JOUR_MS
  duels[23].aVoir = true
  const { ecarts } = releverLesDuels(duels, semaine)
  const depuis = duels[23].finiLe - JOURS_DE_L_HISTOIRE * JOUR_MS
  const lus: string[] = []
  let page = pageDeLHistoire(duels, ecarts, depuis, DUELS_DE_L_HISTOIRE)
  lus.push(...page.duels.map(d => d.serie))
  while (page.suite) {
    const dernier = page.duels[page.duels.length - 1]
    page = pageDeLHistoire(duels, ecarts, depuis, DUELS_DE_L_HISTOIRE, { le: dernier.finiLe, cle: dernier.serie })
    lus.push(...page.duels.map(d => d.serie))
  }
  const attendus = duels
    .filter(d => !d.aVoir && d.finiLe >= depuis)
    .sort((a, b) => b.finiLe - a.finiLe || (a.serie < b.serie ? 1 : -1))
    .map(d => d.serie)
  assert.deepEqual(lus, attendus)
  assert.equal(lus.length, 22, 'ni le trop ancien, ni celui qu’il n’a pas vu')
  assert.ok(lus.includes(duels[13].serie) && lus.includes(duels[14].serie), 'les deux de la même milliseconde')
  assert.equal(pageDeLHistoire(duels, ecarts, depuis, 30).duels[0].ecart, ecarts.get(duels[22].serie)!.ecart, 'chacun avec son écart')
})

// ── Sur un vrai serveur ─────────────────────────────────────────────────────

const DEBUT = Date.UTC(2026, 9, 6, 8, 0)
const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) => base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Des duels au dé contre Automate, écrits dans le journal : chacun `justes` contre `sesJustes`, un par minute à partir de `depuis`. Rend leurs séries. */
function contreAutomate(banc: Banc, profileId: string, scores: [justes: number, sesJustes: number][], depuis: number): string[] {
  return base(banc, db =>
    scores.map(([justes, sesJustes], i) => {
      const id = randomUUID()
      const adversaire = { serie: randomUUID(), profil: '', simule: true, reponses: [...Array(sesJustes).fill(true), ...Array(VIES).fill(false)] }
      db.prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, adversaire)
         VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'rencontre', ?)`,
      ).run(id, profileId, justes + VIES, justes, depuis + i * 60_000, depuis + i * 60_000 + 30_000, JSON.stringify(adversaire))
      return id
    }),
  )
}

/** Joue une tentative jusqu'à sa fin : `justes` bonnes réponses, puis des fautes. */
async function jouer(banc: Banc, cookie: string, serie: string, justes: number): Promise<any> {
  const qs = base(banc, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions)) as { bonne: number; reponses: string[] }[]
  for (let i = 0; i < qs.length; i++) {
    const r = await poster(banc, cookie, `/api/campagne/serie/${serie}/reponse`, { index: i, choix: i < justes ? qs[i].bonne : (qs[i].bonne + 1) % qs[i].reponses.length })
    assert.equal(r.status, 200, r.corps.error)
    if (r.corps.finie) return r.corps
  }
}

/** Un duel classé lancé par `de` contre `contre`, joué des deux côtés : `justes` contre `sesJustes`. Rend son code. */
async function duelJoue(banc: Banc, de: string, contre: string, idContre: string, justes: number, sesJustes: number): Promise<string> {
  const d = await poster(banc, de, '/api/campagne/duel', { adversaire: idContre })
  assert.equal(d.status, 200, d.corps.error)
  await jouer(banc, de, d.corps.serie.id, justes)
  await jouer(banc, contre, (await poster(banc, contre, `/api/campagne/duel/${d.corps.code}`)).corps.id, sesJustes)
  return d.corps.code
}

test('sa page dit son bilan, ses face-à-face nommés et ses dix derniers duels — chacun ce qu’un toucher rouvre —, puis la suite au « Voir plus » ; un résultat pas vu attend sa carte', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐼')
    const [deLea, deTom, deHugo] = ['lea', 'tom', 'hugo'].map(l => idDe(banc, l))
    // Douze duels au dé, il y a deux jours : huit gagnés, quatre perdus.
    const auDe = contreAutomate(banc, deLea, Array.from({ length: 12 }, (_, i): [number, number] => (i % 3 === 2 ? [6, 9] : [10, 8])), horloge.t - 2 * JOUR_MS)
    // Puis contre Tom : elle le défie et gagne — et le voit ; il la défie et gagne.
    horloge.t += 60_000
    const sienContreTom = await duelJoue(banc, lea, tom, deTom, 6, 3)
    assert.equal((await lire(banc, lea, `/api/campagne/duel/${sienContreTom}`)).corps.nouveau, true, 'vu')
    horloge.t += 60_000
    const sienDeTom = await duelJoue(banc, tom, lea, deLea, 7, 4)
    // Enfin contre Hugo, qu'elle a défié : joué des deux côtés, elle ne l'a pas encore vu.
    horloge.t += 60_000
    const pasVu = await duelJoue(banc, lea, hugo, deHugo, 2, 5)

    const etat = (await lire(banc, lea, '/api/duels')).corps
    assert.equal(etat.joues, 15, 'sa cote compte tout')
    const { bilan, historique } = etat
    assert.deepEqual([bilan.joues, bilan.victoires, bilan.defaites, bilan.egalites], [14, 9, 5, 0], 'son bilan, sans le résultat qu’elle n’a pas vu')
    assert.equal(bilan.serie, 0, 'perdu contre Tom en dernier')
    assert.deepEqual(
      bilan.faceAFace.map((f: any) => [f.contre.nom, f.contre.avatar, f.contre.profileId, f.victoires, f.defaites]),
      [
        ['Automate', '🤖', undefined, 8, 4],
        ['Tom', '🐻', deTom, 1, 1],
      ],
      'Automate n’a pas de profil à ouvrir ; Hugo attend que sa carte se retourne',
    )
    assert.ok(bilan.courbe.length >= 2)
    // Ses dix derniers : Tom deux fois, puis le dé ; chacun ce qu'un toucher rouvre.
    assert.equal(historique.duels.length, 10)
    assert.equal(historique.suite, true)
    assert.deepEqual(
      historique.duels.slice(0, 3).map((d: any) => [d.contre.nom, d.justes, d.sesJustes, d.code, d.serie === undefined]),
      [
        ['Tom', 4, 7, sienDeTom, true],
        ['Tom', 6, 3, sienContreTom, true],
        ['Automate', 6, 9, undefined, false],
      ],
    )
    assert.ok(!historique.duels.some((d: any) => d.code === pasVu), 'pas le résultat qu’elle n’a pas vu')
    assert.equal(etat.contre.find((d: any) => d.code === pasVu).nouveau, true, 'il l’attend dans « En cours »')
    const auDeLu = historique.duels[2]
    assert.equal(auDeLu.serie, auDe[11], 'le dernier duel au dé')
    assert.equal((await lire(banc, lea, `/api/campagne/serie/${auDeLu.serie}/correction`)).status, 200, 'sa correction s’ouvre de sa ligne')

    // « Voir plus » : la suite, après le dernier qu'elle a sous les yeux — sans rien redire ni rien sauter.
    const dernier = historique.duels[historique.duels.length - 1]
    const suite = await lire(banc, lea, `/api/duels/historique?le=${dernier.le}&cle=${encodeURIComponent(dernier.cle)}`)
    assert.equal(suite.status, 200, suite.corps.error)
    assert.equal(suite.corps.suite, false)
    assert.deepEqual(
      [...historique.duels, ...suite.corps.duels].map((d: any) => d.cle),
      [...new Set([...historique.duels, ...suite.corps.duels].map((d: any) => d.cle))],
      'rien de redit',
    )
    assert.equal(historique.duels.length + suite.corps.duels.length, 14, 'rien de sauté')
    const refus = await lire(banc, lea, '/api/duels/historique?le=bientot&cle=x')
    assert.equal(refus.status, 400)
    assert.equal(refus.corps.error, 'Cette page de ton historique est introuvable : recharge la page')

    // Vu, le résultat contre Hugo rejoint son bilan et son historique.
    await lire(banc, lea, `/api/campagne/duel/${pasVu}`)
    const apres = (await lire(banc, lea, '/api/duels')).corps
    assert.equal(apres.bilan.joues, 15)
    assert.equal(apres.historique.duels[0].code, pasVu)
    assert.deepEqual(apres.bilan.faceAFace.map((f: any) => f.contre.nom), ['Automate', 'Tom', 'Hugo'])

    // Masqué, Tom quitte ses face-à-face ; ses lignes disent « Un joueur ».
    const admin = await connexionAnimateur(banc.url)
    assert.equal((await ecrire(banc.url, '/api/admin/jour/masquer', { profileId: deTom, masque: true }, admin)).status, 200)
    const masque = (await lire(banc, lea, '/api/duels')).corps
    assert.deepEqual(masque.bilan.faceAFace.map((f: any) => f.contre.nom), ['Automate', 'Hugo'])
    assert.deepEqual(
      masque.historique.duels.filter((d: any) => d.code === sienDeTom || d.code === sienContreTom).map((d: any) => [d.contre.nom, d.contre.profileId]),
      [
        ['Un joueur', undefined],
        ['Un joueur', undefined],
      ],
    )
  } finally {
    await banc.close()
  }
})

// ── À l'écran ───────────────────────────────────────────────────────────────

test('à l’écran : son bilan en trois chiffres et ses records, la courbe et ses ligues, ses face-à-face, puis tous ses duels — pas trois —, et « Voir plus »', async () => {
  const { PanneauHistorique, quandCourt } = await import(client('views/Duels.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const maintenant = new Date(2026, 9, 13, 18).getTime()
  assert.equal(quandCourt(new Date(2026, 9, 13, 9).getTime(), maintenant), 'aujourd’hui')
  assert.equal(quandCourt(new Date(2026, 9, 12, 23).getTime(), maintenant), 'hier')
  assert.equal(quandCourt(new Date(2026, 9, 1, 12).getTime(), maintenant), '1er oct.')
  assert.equal(quandCourt(new Date(2026, 8, 28, 12).getTime(), maintenant), '28 sept.')

  const tom = { profileId: 'tom', nom: 'Tom', avatar: '🐻', ligue: 'or' }
  const automate = { nom: 'Automate', avatar: '🤖' }
  const ligne = (i: number) => ({ cle: `s${i}`, contre: i % 2 ? tom : automate, justes: 8, sesJustes: i % 3 ? 6 : 9, ecart: i % 3 ? 12 : -14, le: maintenant - i * 3_600_000, ...(i % 2 ? { code: `C${i}` } : { serie: `s${i}` }) })
  const etat = {
    contre: [],
    dernieres: [],
    bilan: {
      joues: 21,
      victoires: 12,
      defaites: 7,
      egalites: 2,
      serie: 3,
      meilleureSerie: 5,
      plusHaute: 1212,
      plusBelle: { contre: tom, justes: 9, sesJustes: 4, ecart: 31, le: maintenant },
      faceAFace: [
        { contre: tom, victoires: 3, defaites: 1, egalites: 1 },
        { contre: automate, victoires: 9, defaites: 6, egalites: 1 },
      ],
      courbe: [1040, 1080, 1120, 1190, 1212, 1198],
    },
    historique: { duels: Array.from({ length: 10 }, (_, i) => ligne(i + 1)), suite: true },
  }
  const html = renderToStaticMarkup(React.createElement(PanneauHistorique, { etat, onOuvrir() {}, onCorrection() {}, onJoueur() {} }))
  // Le bilan : trois chiffres, la phrase entière pour qui ne les voit pas.
  assert.match(html, /<span class="duels-chiffre duels-chiffre-v"><b class="num">12<\/b>victoires<\/span>/)
  assert.match(html, /<b class="num">57<small>%<\/small><\/b>gagnés/)
  assert.match(html, /<p class="sr-only">21\sduels : 12\svictoires, 7\sdéfaites, 2\ségalités, 57 % de victoires\.<\/p>/)
  // Ses records : sa série, la meilleure, sa plus haute cote à la couleur de sa ligue, sa plus belle victoire.
  for (const r of ['Série en cours', 'Meilleure série', 'Plus haute cote', 'Plus belle victoire']) assert.match(html, new RegExp(`<span class="duels-record-titre">${r}</span>`))
  assert.match(html, /<span class="duels-record-icone ligue-or">/)
  assert.match(html, /<b>\+31<\/b><span>9–4 contre Tom<\/span>/)
  // La courbe : dite à l'oreille, l'argent et l'or qu'elle traverse, sa cote au bout.
  assert.match(html, /aria-label="Ta cote sur tes 5 derniers duels : de 1040 à 1198, au plus haut 1212\."/)
  assert.match(html, /<g class="ligue-argent">.*?>Argent<\/text><\/g><g class="ligue-or">.*?>Or<\/text><\/g>/)
  assert.match(html, /<text class="duels-courbe-cote"[^>]*>1198<\/text>/)
  // Ses face-à-face : Tom s'ouvre, Automate non.
  assert.match(html, /<button type="button" class="duels-rival">.*?<b>Tom<\/b>.*?<span class="duels-plus">3<\/span>–<span class="duels-moins">1<\/span><span class="duels-rival-egal"> · 1 =<\/span>/)
  assert.match(html, /<span class="duels-rival">.*?<b>Automate<\/b>/)
  // Tous ses duels en lignes — dix, pas trois —, chacun quand ; « Voir plus » pour la suite.
  assert.equal(html.match(/class="duels-joue"/g)?.length, 10)
  assert.match(html, /<span class="duels-joue-quand">aujourd’hui<\/span>/)
  assert.match(html, /Voir plus<\/button>/)
  // Sans série ni record de série : ils ne se disent pas ; sans suite, pas de « Voir plus ».
  const sobre = renderToStaticMarkup(
    React.createElement(PanneauHistorique, {
      etat: { ...etat, bilan: { ...etat.bilan, serie: 1, meilleureSerie: 1, plusBelle: undefined }, historique: { duels: [ligne(1)], suite: false } },
      onOuvrir() {},
      onCorrection() {},
      onJoueur() {},
    }),
  )
  assert.doesNotMatch(sobre, /Série en cours|Meilleure série|Plus belle victoire|Voir plus/)
  // Un serveur d'avant, sans bilan ni historique : ses derniers duels, comme avant.
  const avant = renderToStaticMarkup(
    React.createElement(PanneauHistorique, {
      etat: { contre: [], dernieres: [{ serie: 'r', adversaire: { nom: 'Max', avatar: '🦉', justes: 8 }, justes: 9, issue: 'gagnee', le: maintenant, ecart: 12 }] },
      onOuvrir() {},
      onCorrection() {},
      onJoueur() {},
    }),
  )
  assert.match(avant, /<span class="duels-joue-nom">Max<\/span>/)
  assert.doesNotMatch(avant, /duels-chiffres|duels-courbe|duels-rivaux/)
})
