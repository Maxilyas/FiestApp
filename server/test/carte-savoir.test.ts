// Son savoir et ses sentiers : les deux faces de plus de la carte d'un joueur
// (le souhait du propriétaire du 31 octobre 2026 : « une carte radar pour les
// joueurs où on peut voir les forces et faiblesses en fonction des catégories
// […] que l'on pourrait swipe pour avoir plus d'info. Aussi de voir les
// paliers de la campagne / maître obtenu » — puis, sur la maquette, « Tout le
// monde voit les faiblesses »).
//
// Les règles pures (`radarDuSavoir`, `sentiersDeLaCarte`), les faces et leur
// retournement (`facesDeLaCarte`, `tourDApres`, `placeDeLaFace`), les deux
// faces rendues en HTML, puis le serveur qui les remplit de ce qu'il lisait
// déjà. Le rendu au téléphone, le doigt qui glisse compris, se regarde avec
// `server/scripts/rendu-carte.ts`. Chaque épreuve échouait avant.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import React from 'react'
import { ADMIN, demarrer, inscrireProfil, type Banc } from './banc'
import { ProfileStore, VERSION_BAREME } from '../src/auth/profiles'
import { CATEGORIES } from '../../shared/categories'
import { QCM_POUR_LE_RADAR, radarDuSavoir, sentiersDeLaCarte, type SavoirDUneCategorie } from '../../shared/carte'
import { gainVide, releveVide, totalGain } from '../../shared/profil'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

// L'Éclat se tire une chance sur quarante : ici, il ne tombe jamais.
ProfileStore.tirageEclat = () => false

const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href

/** Léa, une habituée : ses douze catégories ont leurs dix QCM — l'or en histoire, l'argent au cinéma et en musique. */
const SAVOIR_DE_LEA: SavoirDUneCategorie[] = [
  { categorie: 'Culture générale', questions: 100, justes: 70 },
  { categorie: 'Histoire', questions: 262, justes: 212 },
  { categorie: 'Géographie', questions: 83, justes: 52 },
  { categorie: 'Sciences', questions: 69, justes: 38 },
  { categorie: 'Nature', questions: 92, justes: 66 },
  { categorie: 'Cinéma & séries', questions: 212, justes: 182 },
  { categorie: 'Musique', questions: 164, justes: 121 },
  { categorie: 'Arts & lettres', questions: 50, justes: 24 },
  { categorie: 'Sport', questions: 29, justes: 9 },
  { categorie: 'Cuisine', questions: 52, justes: 31 },
  { categorie: 'Jeux & pop culture', questions: 93, justes: 64 },
  { categorie: 'Autour de la fête', questions: 67, justes: 44 },
]

/** Ses sentiers : maître du grand écran et des mythologies, le stade à peine entamé. */
const SENTIERS_DE_LEA = { monde: 8, mythes: 13, oceans: 6, espace: 5, foret: 10, ecran: 13, scene: 11, contes: 4, stade: 1, brigade: 6, arcade: 8, carnaval: 7 }

// ── 1. Les règles ───────────────────────────────────────────────────────────

test('le radar : un rayon par catégorie, sa part dès dix QCM, ses forces et ce qui lui reste à conquérir', () => {
  const r = radarDuSavoir(SAVOIR_DE_LEA)!
  // Toujours douze rayons, dans l'ordre des catégories.
  assert.deepEqual(
    r.rayons.map(x => x.categorie),
    [...CATEGORIES],
  )
  assert.equal(r.connus, 12)
  const cinema = r.rayons.find(x => x.categorie === 'Cinéma & séries')!
  // Sa part et sur combien de QCM : 182 sur 212, 86 %.
  assert.deepEqual([cinema.justes, cinema.questions, cinema.pourcent], [182, 212, 86])
  // L'écusson de chaque rayon, de ses bonnes réponses : celui de sa page.
  assert.deepEqual(
    r.rayons.filter(x => x.ecusson > 1).map(x => [x.categorie, x.ecusson]),
    [
      ['Histoire', 3],
      ['Cinéma & séries', 2],
      ['Musique', 2],
    ],
  )
  assert.equal(r.rayons.find(x => x.categorie === 'Sport')!.ecusson, 0)
  // Ses trois forces, la plus sûre d'abord ; ses deux faiblesses, la plus faible d'abord — tout le monde les voit.
  assert.deepEqual(r.forces, ['Cinéma & séries', 'Histoire', 'Musique'])
  assert.deepEqual(r.aConquerir, ['Sport', 'Arts & lettres'])
})

test('le radar se tait sous dix QCM : une catégorie à découvrir, et pas de face du tout sans aucune', () => {
  assert.equal(QCM_POUR_LE_RADAR, 10)
  // Une sur une, ce serait 100 % : rien ne paraît en deçà de dix.
  assert.equal(radarDuSavoir(undefined), null)
  assert.equal(radarDuSavoir([]), null)
  assert.equal(radarDuSavoir([{ categorie: 'Histoire', questions: 9, justes: 9 }]), null)
  const debutante = radarDuSavoir([
    { categorie: 'Histoire', questions: 9, justes: 9 },
    { categorie: 'Musique', questions: 10, justes: 4 },
  ])!
  assert.equal(debutante.connus, 1)
  const histoire = debutante.rayons.find(x => x.categorie === 'Histoire')!
  assert.deepEqual([histoire.part, histoire.pourcent, histoire.questions], [null, null, 9])
  assert.equal(debutante.rayons.find(x => x.categorie === 'Musique')!.pourcent, 40)
  // Une seule connue : sa force, et rien à conquérir — elle serait les deux à la fois.
  assert.deepEqual(debutante.forces, ['Musique'])
  assert.deepEqual(debutante.aConquerir, [])
  // Dès cinq connues, deux à conquérir — jamais une de ses forces.
  const cinq = radarDuSavoir(SAVOIR_DE_LEA.slice(0, 5))!
  assert.equal(cinq.connus, 5)
  assert.equal(cinq.forces.length + cinq.aConquerir.length, 5)
  assert.ok(cinq.aConquerir.every(c => !cinq.forces.includes(c)))
  const quatre = radarDuSavoir(SAVOIR_DE_LEA.slice(0, 4))!
  assert.deepEqual(quatre.aConquerir, [], 'à quatre, rien à conquérir')
  // Une catégorie hors de la liste fixe — un quiz d'avant les catégories — n'a pas de rayon.
  assert.equal(radarDuSavoir([{ categorie: 'Cinéma', questions: 40, justes: 30 }]), null)
  // Un compte illisible vaut zéro, et une part ne passe jamais 100 %.
  const bizarre = radarDuSavoir([{ categorie: 'Sport', questions: 12, justes: 15 }, { categorie: 'Cuisine', questions: Number.NaN, justes: 3 }])!
  assert.equal(bizarre.rayons.find(x => x.categorie === 'Sport')!.pourcent, 100)
  assert.equal(bizarre.rayons.find(x => x.categorie === 'Cuisine')!.questions, 0)
})

test('les forces se rangent en entiers : à part égale, le plus de bonnes réponses, puis l’ordre des catégories', () => {
  // 7 sur 10 et 70 sur 100 : la même part, mais l'un a plus prouvé que l'autre (invariant 15 : jamais en flottants).
  const r = radarDuSavoir([
    { categorie: 'Sport', questions: 10, justes: 7 },
    { categorie: 'Cuisine', questions: 100, justes: 70 },
    { categorie: 'Musique', questions: 20, justes: 14 },
    { categorie: 'Histoire', questions: 20, justes: 14 },
  ])!
  assert.deepEqual(r.forces, ['Cuisine', 'Histoire', 'Musique'])
})

test('ses sentiers : ceux qu’il a commencés, leur dernier avatar, le prochain, ses maîtres', () => {
  assert.equal(sentiersDeLaCarte(undefined), null)
  assert.equal(sentiersDeLaCarte({}), null)
  assert.equal(sentiersDeLaCarte({ foret: 0 }), null, 'l’absence, pas « 0 sur 12 »')
  const s = sentiersDeLaCarte(SENTIERS_DE_LEA)!
  // Dans l'ordre des branches — celui des catégories.
  assert.deepEqual(
    s.sentiers.map(x => x.branche.key),
    ['monde', 'mythes', 'oceans', 'espace', 'foret', 'ecran', 'scene', 'contes', 'stade', 'brigade', 'arcade', 'carnaval'],
  )
  const de = (cle: string) => s.sentiers.find(x => x.branche.key === cle)!
  // Le maître : ses douze paliers comptés, son treizième à part.
  assert.deepEqual([de('ecran').paliers, de('ecran').maitre, de('ecran').portrait?.key, de('ecran').prochain], [12, true, 'br:star', null])
  // La forêt au palier 10 : l'ours gagné, le cerf au palier 12.
  assert.deepEqual([de('foret').portrait?.key, de('foret').prochain?.key, de('foret').prochain?.palier], ['br:ours', 'br:cerf', 12])
  // Le stade, un palier : pas encore d'avatar, la nageuse au deuxième.
  assert.deepEqual([de('stade').portrait, de('stade').prochain?.key], [null, 'br:nageuse'])
  // 90 paliers sur 144, 43 avatars, deux maîtres.
  assert.deepEqual([s.paliers, s.portraits, s.maitres], [90, 43, 2])
  // Seulement ceux qu'il a commencés.
  assert.deepEqual(
    sentiersDeLaCarte({ foret: 3, ecran: 1 })!.sentiers.map(x => x.branche.key),
    ['foret', 'ecran'],
  )
})

// ── 2. Les faces, et comment elle se retourne ───────────────────────────────

test('ses faces : le recto seul pour l’invité, puis ses chiffres, son savoir et ses sentiers — chacune s’il a de quoi la remplir', async () => {
  const { facesDeLaCarte } = await import(url('components/CarteJoueur.tsx'))
  const radar = radarDuSavoir(SAVOIR_DE_LEA)
  const sentiers = sentiersDeLaCarte(SENTIERS_DE_LEA)
  assert.deepEqual(facesDeLaCarte(false, radar, sentiers), ['recto'], 'un invité sans profil, ou l’avatar en grand')
  assert.deepEqual(facesDeLaCarte(true, null, null), ['recto', 'chiffres'])
  assert.deepEqual(facesDeLaCarte(true, radar, null), ['recto', 'chiffres', 'savoir'])
  assert.deepEqual(facesDeLaCarte(true, null, sentiers), ['recto', 'chiffres', 'sentiers'])
  assert.deepEqual(facesDeLaCarte(true, radar, sentiers), ['recto', 'chiffres', 'savoir', 'sentiers'])
})

test('elle se retourne de face en face : la montrée du côté qui fait face, la quittée de l’autre, les autres rangées', async () => {
  const { TOUR_DE_DEPART, placeDeLaFace, tourDApres } = await import(url('components/CarteJoueur.tsx'))
  const faces = ['recto', 'chiffres', 'savoir', 'sentiers'] as const
  const places = (t: unknown) => faces.map(f => placeDeLaFace(f, faces, t))
  // Au départ : le recto, rien d'autre.
  assert.deepEqual(places(TOUR_DE_DEPART), ['endroit', 'rangee', 'rangee', 'rangee'])
  // « Retourner la carte » : ses chiffres à l'envers, que le demi-tour amène devant ; le recto tourne encore de l'autre côté.
  let t = tourDApres(TOUR_DE_DEPART, 4, 1, 1)
  assert.deepEqual([t.face, t.depuis, t.demi, t.faits], [1, 0, 1, 1])
  assert.deepEqual(places(t), ['endroit', 'envers', 'rangee', 'rangee'])
  // Encore : son savoir revient à l'endroit, le recto se range.
  t = tourDApres(t, 4, 1, 1)
  assert.deepEqual(places(t), ['rangee', 'envers', 'endroit', 'rangee'])
  // Le doigt vers la droite : la face précédente, d'un demi-tour dans son sens.
  t = tourDApres(t, 4, -1, 1)
  assert.deepEqual([t.face, t.demi], [1, 3])
  assert.deepEqual(places(t), ['rangee', 'envers', 'endroit', 'rangee'])
  // Les faces bouclent : de ses sentiers, la suivante est le recto.
  assert.equal(tourDApres({ face: 3, depuis: 2, demi: 3, faits: 3 }, 4, 1, 1).face, 0)
  assert.equal(tourDApres(TOUR_DE_DEPART, 4, -1, -1).face, 3)
  // Quel que soit le chemin, la face montrée est du côté que ses demi-tours tournent vers nous.
  let hasard = 7
  t = TOUR_DE_DEPART
  for (let k = 0; k < 200; k++) {
    hasard = (hasard * 48271) % 2147483647
    t = tourDApres(t, 4, hasard % 2 ? 1 : -1, hasard % 3 ? 1 : -1)
    const p = places(t)
    assert.equal(p[t.face], t.demi % 2 === 0 ? 'endroit' : 'envers', `tour ${k}`)
    assert.equal(p.filter(x => x !== 'rangee').length, t.face === t.depuis ? 1 : 2)
  }
})

// ── 3. Les deux faces, rendues ──────────────────────────────────────────────

async function rendu(composant: string, props: object): Promise<string> {
  const module = await import(url('components/CarteJoueur.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

const texte = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

test('son savoir : douze rayons qui se touchent, sa meilleure catégorie dite, ses forces et ce qui lui reste à conquérir', async () => {
  const html = await rendu('SonSavoir', { radar: radarDuSavoir(SAVOIR_DE_LEA), sentiers: sentiersDeLaCarte(SENTIERS_DE_LEA) })
  // Ses douze catégories en boutons autour du radar, la plus sûre choisie d'office.
  const etiquettes = [...html.matchAll(/<button type="button" class="carte-radar-etiquette[^"]*"[^>]*aria-pressed="(true|false)" aria-label="([^"]+)"/g)]
  assert.equal(etiquettes.length, 12)
  assert.deepEqual(
    etiquettes.filter(e => e[1] === 'true').map(e => e[2]),
    ['Cinéma &amp; séries, 86 %'],
  )
  // Ses douze catégories connues : une forme, le radar d'une fiche de joueur, et la pierre de son écusson au bout de chaque rayon.
  assert.match(html, /<polygon class="carte-radar-forme" points="/)
  assert.equal([...html.matchAll(/<circle class="carte-radar-pierre palier-\d/g)].length, 12)
  // La catégorie touchée : sa part et sur combien, son écusson, son sentier.
  const t = texte(html)
  assert.match(t, /86 % 182 sur 212 QCM Cinéma &amp; séries Argent Maître du grand écran/)
  // Ses forces et ce qui lui reste à conquérir.
  assert.match(t, /Ses forces Cinéma 86 % Histoire 81 % Musique 74 % À conquérir Sport 31 % Arts 48 %/)
})

test('le radar d’une débutante : des pétales pour ce qu’elle connaît, le reste à découvrir', async () => {
  const radar = radarDuSavoir([
    { categorie: 'Culture générale', questions: 14, justes: 9 },
    { categorie: 'Histoire', questions: 6, justes: 3 },
    { categorie: 'Cinéma & séries', questions: 21, justes: 15 },
  ])
  const html = await rendu('SonSavoir', { radar, sentiers: null })
  // Relier deux rayons par-dessus un inconnu dessinerait une part qu'elle n'a pas.
  assert.doesNotMatch(html, /<polygon class="carte-radar-forme"/)
  assert.match(html, /<path class="carte-radar-forme" d="M/)
  assert.match(html, /<path class="carte-radar-a-decouvrir" d="M/)
  assert.equal([...html.matchAll(/class="carte-radar-etiquette carte-radar-inconnue"/g)].length, 10)
  assert.equal([...html.matchAll(/<circle class="carte-radar-pierre/g)].length, 2)
  assert.match(texte(html), /Une catégorie paraît dès 10 QCM\./)
  // À trois catégories, rien à conquérir : la rangée ne paraît pas.
  assert.doesNotMatch(html, /À conquérir/)
})

test('ses sentiers : un anneau par sentier commencé, ses maîtres couronnés, ses avatars seulement la carte retournée', async () => {
  const sentiers = sentiersDeLaCarte(SENTIERS_DE_LEA)
  const fermee = await rendu('SesSentiers', { sentiers, portraits: false })
  assert.equal([...fermee.matchAll(/<button type="button" class="carte-sentier[ "]/g)].length, 12)
  assert.equal([...fermee.matchAll(/class="carte-sentier carte-sentier-maitre"/g)].length, 2)
  // Les cadrans : ses paliers sur 144, ses avatars sur 72, ses maîtres sur 12.
  assert.match(texte(fermee), /Paliers 90 sur 144 Avatars 43 sur 72 Maîtres 2 sur 12/)
  // Le maître d'abord : la face s'ouvre sur lui.
  assert.match(texte(fermee), /Maître des mythologies · Histoire : les douze paliers, et celui du maître\./)
  // Pas retournée, la carte ne demande aucun avatar : la salle ne télécharge pas douze branches.
  assert.doesNotMatch(fermee, /sentier-portrait/)
  const retournee = await rendu('SesSentiers', { sentiers, portraits: true })
  // Onze avatars : le stade n'en a pas encore, son emblème tient sa place.
  assert.equal([...retournee.matchAll(/class="sentier-portrait"/g)].length, 11)
  // Sans maître, pas de cadran des maîtres ; un sentier sans maître dit où il en est et le prochain avatar.
  const debutante = await rendu('SesSentiers', { sentiers: sentiersDeLaCarte({ foret: 3, ecran: 1 }), portraits: false })
  assert.doesNotMatch(texte(debutante), /Maître/)
  assert.match(texte(debutante), /La forêt · Nature : palier 3 sur 12 — le blaireau au palier 4\./)
})

// ── 4. Sur le serveur ───────────────────────────────────────────────────────

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const profilDe = (banc: Banc, login: string) => base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

const lire = async (banc: Banc, cookie: string, chemin: string) => {
  const r = await fetch(`${banc.url}${chemin}`, { headers: { cookie, 'X-Requested-With': 'fiestapp' } })
  return { status: r.status, corps: (await r.json().catch(() => null)) as any }
}

test('le serveur pose son savoir et ses sentiers sur sa carte — les chiffres de sa page, rien pour qui n’a pas joué', async () => {
  const banc = await demarrer()
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const idLea = profilDe(banc, 'lea')
    base(banc, db => {
      // Une soirée qui compte, rangée dans sa carrière : ses QCM par catégorie
      // — et une catégorie d'avant la liste fixe, qui n'a pas de rayon.
      const espace = (db.prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
      const categories = { Histoire: { questions: 14, justes: 11 }, Sport: { questions: 12, justes: 3 }, Cinéma: { questions: 9, justes: 9 } }
      const gain = { ...gainVide(), reponses: 50 }
      db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
        idLea,
        'une-soiree',
        espace,
        totalGain(gain),
        JSON.stringify({ v: VERSION_BAREME, gain, releve: { ...releveVide(), categories } }),
        Date.now(),
      )
      // Deux sentiers : la forêt au palier 5, maître de l'arcade.
      const acquis = db.prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, ?)')
      acquis.run(idLea, 'foret', 5, Date.now())
      acquis.run(idLea, 'arcade', 13, Date.now())
    })
    await banc.redemarrer()
    // Sa carte, vue par Tom hors d'une soirée, et la sienne, depuis sa page.
    const vue = await lire(banc, tom, `/api/joueur/carte/${idLea}`)
    assert.equal(vue.status, 200)
    assert.deepEqual(vue.corps.profil.savoir, [
      { categorie: 'Histoire', questions: 14, justes: 11 },
      { categorie: 'Sport', questions: 12, justes: 3 },
    ])
    assert.deepEqual(vue.corps.profil.sentiers, { foret: 5, arcade: 13 })
    const sienne = await lire(banc, lea, '/api/joueur/carte')
    assert.deepEqual([sienne.corps.profil.savoir, sienne.corps.profil.sentiers], [vue.corps.profil.savoir, vue.corps.profil.sentiers])
    // Les chiffres de « Ma carrière », catégorie par catégorie : la salle ne lit pas d'autres chiffres que lui.
    const page = (await lire(banc, lea, '/api/joueur/moi')).corps.profile.categories
    for (const s of vue.corps.profil.savoir) assert.deepEqual(page[s.categorie], { questions: s.questions, justes: s.justes }, s.categorie)
    // Tom n'a rien joué : ni savoir, ni sentiers — l'absence, pas des zéros.
    const deTom = await lire(banc, lea, `/api/joueur/carte/${profilDe(banc, 'tom')}`)
    assert.equal(deTom.status, 200)
    assert.equal('savoir' in deTom.corps.profil, false)
    assert.equal('sentiers' in deTom.corps.profil, false)
  } finally {
    await banc.close()
  }
})
