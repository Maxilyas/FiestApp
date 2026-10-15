// La pastille rouge des nouveautés (le souhait du propriétaire du 14 octobre
// 2026 : « un petit indicateur rouge, un peu comme les notifications de
// duels », pour donner envie d'aller voir son profil) : ce que le serveur
// retient qu'un profil a vu dans sa loge, et ce qu'il compte de neuf — pour
// tous ses appareils. Retenu sur le téléphone, ce qu'on regardait sur
// l'ordinateur se redisait nouveau sur le téléphone, et seule la page du
// profil savait le compter.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import React from 'react'
import { connexionAnimateur, cookieDe, demarrer, ecrire, inscrireProfil } from './banc'
import { ceQuIlAPorter, retenirLesVus } from '../../shared/loge'
import { CLES_VUES_MAX, compteDesNouveautes, lireLesVus, premierePieceNeuve } from '../../shared/piecesDeLaLoge'
import { LEGENDAIRES } from '../../shared/legendaires'
import { DIVINS } from '../../shared/divins'
import { BRANCHES } from '../../shared/branches'
import { COMPAGNONS } from '../../shared/compagnons'
import { LIGUES } from '../../shared/duels'
import { FINITIONS } from '../../shared/profil'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const lire = async (url: string, chemin: string, cookie?: string) => (await fetch(`${url}${chemin}`, { headers: cookie ? { Cookie: cookie } : {} })).json() as Promise<any>
const RIEN = { nouveautes: 0, pieces: {} }

test('le serveur compte ce qu’il a de neuf à porter : rien d’abord, puis ce qui arrive, jusqu’à ce qu’il le regarde — sur tous ses appareils', async () => {
  const banc = await demarrer()
  try {
    const telephone = await inscrireProfil(banc.url, 'neuf', 'Léa')
    // Sans profil, rien : un invité n'est pas une erreur.
    assert.deepEqual(await lire(banc.url, '/api/joueur/nouveautes'), RIEN)
    // Jamais passé par sa loge : rien de nouveau — la première visite ne crie pas « nouveau » sur
    // tout ce qu'il a —, et tout ce qu'il a se retient vu, d'un coup.
    assert.deepEqual(await lire(banc.url, '/api/joueur/nouveautes', telephone), RIEN)
    const { profile } = await lire(banc.url, '/api/joueur/moi', telephone)
    assert.deepEqual(profile.vusDeLaLoge, retenirLesVus(ceQuIlAPorter(profile), {}, null))

    // Un thème lui arrive : un de neuf, dans la pièce du thème.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      db.prepare('INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 0, 1)').run(profile.id, 'jungle')
    } finally {
      db.close()
    }
    assert.deepEqual(await lire(banc.url, '/api/joueur/nouveautes', telephone), { nouveautes: 1, pieces: { theme: 1 } })
    // Sur l'ordinateur — une autre session —, le même compte, et le détail le même vu.
    const connexion = await ecrire(banc.url, '/api/joueur/connexion', { login: 'neuf', password: 'motdepasse1' })
    assert.equal(connexion.status, 200)
    const ordinateur = cookieDe(connexion, 'qz_joueur')
    assert.deepEqual(await lire(banc.url, '/api/joueur/nouveautes', ordinateur), { nouveautes: 1, pieces: { theme: 1 } })

    // Il regarde sa pièce « Thème » sur l'ordinateur : la page retient, le serveur garde — plus rien, téléphone compris.
    const detail = (await lire(banc.url, '/api/joueur/moi', ordinateur)).profile
    const regardee = retenirLesVus(ceQuIlAPorter(detail), detail.vusDeLaLoge, 'theme')
    const retenue = await ecrire(banc.url, '/api/joueur/vus', { vus: regardee }, ordinateur, 'PUT')
    assert.equal(retenue.status, 200)
    assert.deepEqual(await lire(banc.url, '/api/joueur/nouveautes', telephone), RIEN)
    assert.deepEqual((await lire(banc.url, '/api/joueur/moi', telephone)).profile.vusDeLaLoge, regardee)
  } finally {
    await banc.close()
  }
})

test('un haut fait neuf se compte une fois, titre et vitrine à la fois ; la loge s’ouvre sur la première pièce qui a du neuf', () => {
  const neufs = { avatar: [], titre: ['hf:phenix'], vitrine: ['hf:phenix'], fond: [], theme: ['jungle'], gerbe: [] }
  assert.deepEqual(compteDesNouveautes(neufs), { nouveautes: 2, pieces: { titre: 1, vitrine: 1, theme: 1 } })
  assert.equal(premierePieceNeuve(compteDesNouveautes(neufs)), 'titre')
  assert.equal(premierePieceNeuve(compteDesNouveautes({ ...neufs, titre: [], vitrine: [], theme: [] })), null)
})

test('ce qu’une page envoie à retenir se lit avant de s’écrire : sans profil, refusé ; illisible, refusé ; démesuré, réduit', async () => {
  const banc = await demarrer()
  try {
    const cookie = await inscrireProfil(banc.url, 'vus', 'Tom')
    assert.equal((await ecrire(banc.url, '/api/joueur/vus', { vus: { theme: ['velours'] } }, undefined, 'PUT')).status, 401)
    for (const vus of [undefined, 'tout', ['theme'], { inconnue: ['x'] }, {}]) {
      const res = await ecrire(banc.url, '/api/joueur/vus', { vus }, cookie, 'PUT')
      assert.equal(res.status, 400, JSON.stringify(vus))
      assert.deepEqual(await res.json(), { error: 'Rien à retenir : recharge la page.' })
    }
    // Des clés qui ne sont pas du texte, trop longues, en double, trop nombreuses : réduites, jamais gardées telles quelles.
    const brut = { theme: ['velours', 'velours', 3, '', 'x'.repeat(81), ...Array.from({ length: CLES_VUES_MAX + 50 }, (_, i) => `t${i}`)], gerbe: 'confettis' }
    assert.equal((await ecrire(banc.url, '/api/joueur/vus', { vus: brut }, cookie, 'PUT')).status, 200)
    const garde = (await lire(banc.url, '/api/joueur/moi', cookie)).profile.vusDeLaLoge
    assert.equal(garde.theme.length, CLES_VUES_MAX)
    assert.equal(garde.theme[0], 'velours')
    assert.ok(!('gerbe' in garde), 'une pièce qui n’est pas une liste ne se retient pas')
    assert.deepEqual(garde, lireLesVus(brut))
  } finally {
    await banc.close()
  }
})

test('ce qu’il a vu part avec son profil', async () => {
  const banc = await demarrer()
  try {
    const cookie = await inscrireProfil(banc.url, 'parti', 'Zoé')
    assert.deepEqual(await lire(banc.url, '/api/joueur/nouveautes', cookie), RIEN)
    const id = (await lire(banc.url, '/api/joueur/moi', cookie)).profile.id
    const compter = () => {
      const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
      try {
        return (db.prepare('SELECT COUNT(*) AS n FROM profile_loge_vus WHERE profile_id = ?').get(id) as { n: number }).n
      } finally {
        db.close()
      }
    }
    assert.equal(compter(), 1)
    const admin = await connexionAnimateur(banc.url)
    const suppression = await fetch(`${banc.url}/api/admin/profils/${id}`, { method: 'DELETE', headers: { Cookie: admin, 'X-Requested-With': 'quizz' } })
    assert.equal(suppression.status, 200)
    assert.equal(compter(), 0)
  } finally {
    await banc.close()
  }
})

// ── Dans la loge, la pastille mène jusqu'à ce qui est neuf ───────────────
// Le retour du propriétaire du 15 octobre 2026 : un nouvel avatar, la pastille
// sur « Profil », sur « M'habiller », sur l'avatar même — pas sur sa rareté,
// alors que la grille s'ouvre sur la page de ce qu'il porte : « plus de
// pastille à suivre ». Ce qui se compte en rouge se trouve en suivant le rouge.

const composant = async (fichier: string) => import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)

/** Un composant du client, rendu en HTML. */
async function rendu(fichier: string, nom: string, props: object): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement((await composant(fichier))[nom], props))
}

/** Les éléments d'un arbre, en profondeur. */
function elements(noeud: any): any[] {
  if (Array.isArray(noeud)) return noeud.flatMap(elements)
  if (!noeud || typeof noeud !== 'object') return []
  return [noeud, ...elements(noeud.props?.children)]
}

/** Jeanne : le Phénix porté sur sa grenouille, le Dragon, un Divin, la forêt au cinquième palier, le louveteau grandi d'une forme, deux ligues. */
const JEANNE = {
  id: 'p-jeanne',
  login: 'jeanne',
  name: 'Jeanne',
  avatar: '🐸',
  finition: 'holo',
  finitionChoisie: 'holo',
  niveau: 14,
  ouvertes: ['mat', 'argent', 'or', 'holo'],
  eclats: ['🦊', 'cp:loup-jeune'],
  eclatsEteints: [],
  legendaire: 'lg:phenix',
  legendaires: ['lg:phenix', 'lg:dragon'],
  divins: [{ key: 'dv:seraphin', legende: 'Il est descendu un soir de grand vent.', ton: 'eclat' }],
  hautsFaits: [],
  vitrine: [],
  titresDates: [],
  sentiers: { foret: 5, mythes: 2 },
  compagnons: [{ compagnon: 'loup', rang: 1 }],
  bordures: [
    { ligue: 'bronze', crans: 12 },
    { ligue: 'argent', crans: 4 },
  ],
  bordureChoisie: 'auto',
}

/** Ce que reçoit une pièce de la loge : rien d'essayé, et ce qui est neuf. */
const piece = (profil: object, neufs: readonly string[]) => ({ profil, essai: {}, essayer: () => {}, busy: false, neufs: new Set(neufs) })

/** Les gemmes qui ont leur point rouge. */
const gemmesNeuves = (html: string) =>
  html
    .split('<button id="loge-gemme-')
    .slice(1)
    .filter(b => b.slice(0, b.indexOf('</button>')).includes('<span class="gemme-neuf" aria-hidden="true"></span>'))
    .map(b => b.slice(0, b.indexOf('"')))

/** Ce que les cases marquées d'une pièce essaient : la clé de chacune, dite comme ses nouveautés. */
async function marquees(nom: string, props: object): Promise<string[]> {
  const essais: Record<string, string>[] = []
  const arbre = (await composant('components/Apparence'))[nom]({ ...props, essayer: (e: Record<string, string>) => essais.push(e) })
  const cles: string[] = []
  for (const b of elements(arbre).filter(e => e.type === 'button' && /(^| )neuve( |$)/.test(e.props.className))) {
    essais.length = 0
    b.props.onClick()
    const e = essais[0]
    cles.push(e.legendaire ?? e.avatar ?? (e.finition ? `finition:${e.finition}` : `bordure:${e.bordure}`))
  }
  return cles
}

/** Les cases marquées de chaque page de sa grille, page par page. */
async function casesNeuves(profil: object, neufs: readonly string[]): Promise<Record<string, string[]>> {
  const { pagesDeLaLoge } = await composant('components/Apparence')
  const pages: Record<string, string[]> = {}
  for (const page of pagesDeLaLoge(profil)) {
    const cles = await marquees('PageDAvatars', { ...piece(profil, neufs), page })
    if (cles.length > 0) pages[page.page] = cles
  }
  return pages
}

test('un avatar neuf rangé sur une autre rareté que celle qu’il porte : sa gemme a le point rouge, et sa case', async () => {
  // Le portrait du blaireau arrive : la grille s'ouvre sur les légendaires — le Phénix, qu'elle porte —, et la gemme « Peu com. » dit où aller.
  const html = await rendu('components/Apparence', 'MesAvatars', piece(JEANNE, ['br:blaireau']))
  assert.match(html, /aria-labelledby="loge-gemme-legendaire"/)
  assert.deepEqual(gemmesNeuves(html), ['peucommune'])
  // À l'oreille aussi, comme la pièce qui a du neuf.
  assert.match(html, /<button id="loge-gemme-peucommune"[^>]*aria-label="Peu commune, 5 à toi, du nouveau"/)
  assert.match(html, /<button id="loge-gemme-commune"[^>]*aria-label="Commune, 9 à toi"/)
  // Au bout du chemin, sa case.
  assert.deepEqual(await casesNeuves(JEANNE, ['br:blaireau']), { peucommune: ['br:blaireau'] })

  // Le neuf est sur la page ouverte — le Dragon, parmi les légendaires : ses cases le disent, aucune gemme n'a à le dire.
  const surLaPage = await rendu('components/Apparence', 'MesAvatars', piece(JEANNE, ['lg:dragon']))
  assert.deepEqual(gemmesNeuves(surLaPage), [])
  assert.deepEqual(await casesNeuves(JEANNE, ['lg:dragon']), { legendaire: ['lg:dragon'] })
  // Ce qui n'est pas un avatar — une finition, une bordure — ne marque aucune gemme : sa rangée est au-dessus d'elles.
  assert.deepEqual(gemmesNeuves(await rendu('components/Apparence', 'MesAvatars', piece(JEANNE, ['finition:holo', 'bordure:argent']))), [])
  // Rien de neuf : aucun point, et le lecteur d'écran n'entend rien de plus.
  const rien = await rendu('components/Apparence', 'MesAvatars', piece(JEANNE, []))
  assert.doesNotMatch(rien, /gemme-neuf|du nouveau/)
})

test('un Éclat neuf marque l’avatar où il est tombé, et sa gemme ; une bordure sertie marque sa ligue', async () => {
  // L'Éclat se comptait sur « Profil » et sur « M'habiller », et rien dans la loge ne disait où il était tombé.
  assert.deepEqual(await casesNeuves(JEANNE, ['eclat:🦊']), { offert: ['🦊'] })
  assert.deepEqual(gemmesNeuves(await rendu('components/Apparence', 'MesAvatars', piece(JEANNE, ['eclat:🦊']))), ['offert'])
  // Celui d'un compagnon brille sur toutes ses formes : chacune est neuve, à la page de sa rareté.
  assert.deepEqual(await casesNeuves(JEANNE, ['eclat:cp:loup-jeune']), { commune: ['cp:loup-louveteau'], rare: ['cp:loup-jeune'] })
  assert.deepEqual(gemmesNeuves(await rendu('components/Apparence', 'MesAvatars', piece(JEANNE, ['eclat:cp:loup-jeune']))), ['commune', 'rare'])
  // Une bordure qu'il vient de sertir — son douzième cran — se dit sur sa ligue, comme une ligue qu'il vient d'atteindre.
  assert.deepEqual(await marquees('MesBordures', piece(JEANNE, ['bordure:bronze:sertie'])), ['bordure:bronze'])
  assert.deepEqual(await marquees('MesBordures', piece(JEANNE, ['bordure:argent'])), ['bordure:argent'])
  assert.deepEqual(await marquees('MesFinitions', piece(JEANNE, ['finition:holo'])), ['finition:holo'])
})

test('chaque nouveauté de la pièce « Avatar » a sa marque dans la loge, et sa gemme le point rouge, hors de la page ouverte', async () => {
  // Tout ce qui se porte, et chaque clé neuve à son tour : aucune ne doit se compter sans se trouver.
  const tout = {
    ...JEANNE,
    // L'emoji de l'inscription, porté : la grille s'ouvre sur les offerts.
    legendaire: null,
    niveau: 60,
    ouvertes: [...FINITIONS],
    legendaires: LEGENDAIRES.map(l => l.key),
    divins: DIVINS.map(d => ({ key: d.key, legende: '…', ton: 'eclat' })),
    sentiers: Object.fromEntries(BRANCHES.map(b => [b.key, 12])),
    compagnons: COMPAGNONS.map(c => ({ compagnon: c.key, rang: 3 })),
    bordures: LIGUES.map(l => ({ ligue: l.cle, crans: 12 })),
    eclats: ['🐸', 'lg:dragon', 'br:blaireau', 'cp:chat-jeune', '🐝'],
  }
  // Ce qu'un Éclat fait briller : l'avatar où il est tombé — toutes les formes, pour un compagnon.
  const BRILLENT: Record<string, string[]> = {
    '🐸': ['🐸'],
    'lg:dragon': ['lg:dragon'],
    'br:blaireau': ['br:blaireau'],
    'cp:chat-jeune': ['cp:chat-chaton', 'cp:chat-jeune', 'cp:chat-adulte', 'cp:chat-esprit'],
    '🐝': ['🐝'],
  }
  const cles = ceQuIlAPorter(tout as any).avatar
  assert.ok(cles.length > 100, `${cles.length} nouveautés possibles`)
  for (const cle of cles) {
    const cases = await casesNeuves(tout, [cle])
    const finitions = await marquees('MesFinitions', piece(tout, [cle]))
    const bordures = await marquees('MesBordures', piece(tout, [cle]))
    if (cle.startsWith('finition:')) {
      assert.deepEqual([finitions, bordures, cases], [[cle], [], {}], cle)
      continue
    }
    if (cle.startsWith('bordure:')) {
      assert.deepEqual([finitions, bordures, cases], [[], [cle.split(':').slice(0, 2).join(':')], {}], cle)
      continue
    }
    assert.deepEqual([finitions, bordures], [[], []], cle)
    const attendues = cle.startsWith('eclat:') ? BRILLENT[cle.slice('eclat:'.length)] : [cle]
    assert.deepEqual(Object.values(cases).flat().sort(), [...attendues].sort(), cle)
    // Chaque page qui garde une case neuve a son point rouge sur sa gemme — sauf la page ouverte, où l'on voit déjà la case.
    const html = await rendu('components/Apparence', 'MesAvatars', piece(tout, [cle]))
    assert.deepEqual(
      gemmesNeuves(html),
      Object.keys(cases).filter(p => p !== 'offert'),
      cle,
    )
  }
})
