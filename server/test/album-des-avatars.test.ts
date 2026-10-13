// L'album « Mes avatars » : une seule collection, rangée par rareté (la
// maquette 1, choisie le 13 octobre 2026). Trois lignes de « Ma collection »
// séparaient les portraits, les légendaires et les emojis de collection, et
// les gens étaient « confus » : ici, la règle pure de l'album — la rareté de
// chaque avatar, où il se gagne, ses pages, et comment l'obtenir. L'écran :
// `ma-collection.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  AVATARS_DE_L_ALBUM,
  RARETES_D_AVATAR,
  avatarDeLAlbum,
  compteDeLAlbum,
  ouIlSeGagne,
  pageDuDebut,
  pageDuProchain,
  pagesDeLAlbum,
  voiesDeLAvatar,
} from '../../shared/album'
import { compteDeLaCollection } from '../../shared/collection'
import { LEGENDAIRES } from '../../shared/legendaires'
import { DIVINS } from '../../shared/divins'
import { BRANCHES, PORTRAITS } from '../../shared/branches'
import { AVATARS, COLLECTION } from '../../shared/avatars'
import { hautFait, type HautFaitVu } from '../../shared/hautsfaits'

/** Un haut fait du catalogue, tel que la page du profil le reçoit. */
function vu(key: string, fois: number, plus: Partial<HautFaitVu> = {}): HautFaitVu {
  const h = hautFait(key)!
  return { key, famille: h.famille, emoji: h.emoji, title: h.title, rule: 'règle', ton: 'ton' in h ? h.ton : 'eclat', fois, ...plus } as HautFaitVu
}

/** Léa : le Phénix, le Séraphin, deux portraits de la forêt, le niveau 8 — et quelques hauts faits en route. */
const LEA = {
  avatar: '🦊',
  legendaire: 'lg:phenix' as string | null,
  niveau: 8,
  legendaires: ['lg:phenix'],
  divins: [{ key: 'dv:seraphin', legende: 'Il est descendu un soir de grand vent.', ton: 'eclat' as const }],
  sentiers: { foret: 5 },
  hautsFaits: [
    vu('hf:phenix', 1),
    vu('hf:seul-contre-tous', 1),
    vu('hf:seul-au-monde', 0, { origine: 'jour' }),
    vu('hf:habitue', 1, { valeur: 4, prochain: 10 }),
    vu('hf:assidu', 0, { origine: 'jour', valeur: 2, prochain: 7 }),
    vu('hf:podium', 1, { valeur: 3, prochain: 15 }),
    vu('hf:alpiniste', 2, { origine: 'campagne', valeur: 17, prochain: 20 }),
  ],
}

test('l’album : tous les avatars qui se gagnent, une fois chacun, rangés en six pages', () => {
  // Les légendaires, les portraits, les emojis de collection, les Divins — pas ceux de l'inscription, à tout le monde.
  assert.equal(AVATARS_DE_L_ALBUM.length, LEGENDAIRES.length + PORTRAITS.length + COLLECTION.length + DIVINS.length)
  assert.equal(new Set(AVATARS_DE_L_ALBUM.map(a => a.cle)).size, AVATARS_DE_L_ALBUM.length)
  for (const emoji of AVATARS) assert.equal(avatarDeLAlbum(emoji), undefined, emoji)
  const parPage = Object.fromEntries(RARETES_D_AVATAR.map(r => [r, AVATARS_DE_L_ALBUM.filter(a => a.rarete === r).length]))
  assert.deepEqual(parPage, { commune: 18, peucommune: 18, rare: 24, epique: 12, legendaire: 38, divin: 6 })
})

test('la rareté dit ce qu’un avatar demande : plus haut sur le sentier, plus rare ; sa forme ultime, légendaire', () => {
  // Chaque branche : le visage commun, le deuxième peu commun, le geste et la lumière rares, le débord épique, la forme ultime légendaire.
  for (const b of BRANCHES) {
    assert.deepEqual(
      b.portraits.map(p => avatarDeLAlbum(p.key)!.rarete),
      ['commune', 'peucommune', 'rare', 'rare', 'epique', 'legendaire'],
      b.key,
    )
  }
  // Les légendaires des hauts faits sont légendaires ; les Divins, à part.
  for (const l of LEGENDAIRES) assert.equal(avatarDeLAlbum(l.key)!.rarete, 'legendaire', l.key)
  for (const d of DIVINS) assert.equal(avatarDeLAlbum(d.key)!.rarete, 'divin', d.key)
  // Les emojis de collection : communs jusqu'au niveau 10 — l'anneau de la loge passe au bleu au même niveau —, peu communs après.
  assert.deepEqual(
    COLLECTION.map(c => `${c.emoji} ${avatarDeLAlbum(c.emoji)!.rarete}`),
    ['🦚 commune', '🐢 commune', '🦈 commune', '🦔 commune', '🐝 commune', '🦩 commune', '🦥 peucommune', '🐳 peucommune', '🦜 peucommune', '🦦 peucommune', '🐲 peucommune', '🪐 peucommune'],
  )
})

test('chaque avatar dit où il se gagne — voie après voie ; un Divin, nulle part', () => {
  const lieux = Object.fromEntries(LEGENDAIRES.map(l => [l.key.slice(3), avatarDeLAlbum(l.key)!.lieux.join(' ')]))
  assert.deepEqual(lieux, {
    phenix: 'soiree jour',
    dragon: 'soiree jour',
    oracle: 'soiree',
    chouette: 'soiree jour',
    tigre: 'soiree jour',
    licorne: 'soiree jour',
    lion: 'soiree jour',
    renard: 'soiree jour',
    comete: 'soiree',
    kraken: 'soiree jour',
    fantome: 'soiree jour',
    'trou-noir': 'soiree',
    sphinx: 'jour',
    citrouille: 'saison',
    sapin: 'saison',
    bouquet: 'saison',
    aigle: 'jour',
    ouroboros: 'jour',
    scarabee: 'jour',
    coq: 'jour',
    'chauve-souris': 'jour',
    salamandre: 'campagne',
    elephant: 'campagne',
    serpent: 'campagne',
    // Les trois mondes à la fois.
    chimere: 'soiree jour campagne',
    janus: 'soiree jour',
  })
  for (const p of PORTRAITS) assert.deepEqual(avatarDeLAlbum(p.key)!.lieux, ['sentiers'], p.key)
  for (const c of COLLECTION) assert.deepEqual(avatarDeLAlbum(c.emoji)!.lieux, ['niveau'], c.emoji)
  for (const d of DIVINS) assert.deepEqual(avatarDeLAlbum(d.key)!.lieux, [], d.key)
  // D'une phrase, à l'oreille : ses voies sont l'une ou l'autre, les étapes d'une voie toutes à la fois.
  const dit = (cle: string) => ouIlSeGagne(avatarDeLAlbum(cle)!)
  assert.equal(dit('lg:licorne'), 'en soirée ou au quiz du jour')
  assert.equal(dit('lg:chimere'), 'en soirée, au quiz du jour et en campagne')
  assert.equal(dit('lg:janus'), 'en soirée et au quiz du jour')
  assert.equal(dit('lg:sphinx'), 'au quiz du jour')
  assert.equal(dit('lg:bouquet'), 'pour le Nouvel An')
  assert.equal(dit('br:lynx'), 'sur les sentiers')
  assert.equal(dit('🐳'), 'au niveau 12')
  assert.equal(dit('dv:seraphin'), '')
})

test('une page par rareté : ce qu’on a d’abord, puis ce qui reste, chacun dans l’ordre du catalogue — le compte de la collection est le sien', () => {
  const pages = pagesDeLAlbum(LEA)
  assert.deepEqual(
    pages.map(p => `${p.rarete} ${p.acquis}/${p.total}`),
    // Le blaireau (palier 4) et l'écureuil (palier 2) ; cinq emojis jusqu'au niveau 8 ; le Phénix ; le Séraphin.
    ['commune 6/18', 'peucommune 1/18', 'rare 0/24', 'epique 0/12', 'legendaire 1/38', 'divin 1/6'],
  )
  const commune = pages[0].avatars
  assert.deepEqual(
    commune.filter(a => a.aLui).map(a => a.avatar.cle),
    ['br:ecureuil', '🦚', '🐢', '🦈', '🦔', '🐝'],
  )
  assert.ok(commune.findIndex(a => !a.aLui) === 6 && commune.slice(6).every(a => !a.aLui), 'ce qui reste vient ensuite')
  // Le Phénix d'abord, puis les vingt-cinq autres légendaires, puis les douze formes ultimes.
  const legendaires = pages[4].avatars.map(a => a.avatar.cle)
  assert.equal(legendaires[0], 'lg:phenix')
  assert.deepEqual(legendaires.slice(1, 26), LEGENDAIRES.filter(l => l.key !== 'lg:phenix').map(l => l.key))
  assert.deepEqual(legendaires.slice(26), BRANCHES.map(b => b.portraits[5].key))
  // Une seule règle compte l'album, sa ligne de « Ma collection » et son total.
  assert.deepEqual(compteDeLAlbum(LEA), { acquis: 9, total: 116 })
  assert.deepEqual(compteDeLAlbum(LEA), { acquis: pages.reduce((s, p) => s + p.acquis, 0), total: pages.reduce((s, p) => s + p.total, 0) })
  const avatars = compteDeLaCollection({ ...LEA, ouvertes: [], prix: [], ecussons: [] } as any).familles.find(f => f.famille === 'avatars')!
  assert.deepEqual(avatars.parties, [{ partie: 'avatars', acquis: 9, total: 116 }])
})

test('l’album s’ouvre sur la page de ce qu’il porte, sinon sur la première où il reste à gagner', () => {
  assert.equal(pageDuDebut(LEA), 'legendaire')
  assert.equal(pageDuDebut({ ...LEA, legendaire: 'br:blaireau' }), 'peucommune')
  assert.equal(pageDuDebut({ ...LEA, legendaire: 'dv:seraphin' }), 'divin')
  assert.equal(pageDuDebut({ ...LEA, legendaire: null, avatar: '🐝' }), 'commune')
  // Un emoji de l'inscription : la première page où il reste à gagner.
  assert.equal(pageDuDebut({ ...LEA, legendaire: null }), 'commune')
  // Un emoji de collection au-dessus de son niveau ne se porte pas : il ne compte pas.
  assert.equal(pageDuDebut({ ...LEA, legendaire: null, avatar: '🪐' }), 'commune')
  // « N à gagner : où ? », dans la loge : la page du prochain de sa sorte.
  assert.equal(pageDuProchain(LEA, 'legendaire'), 'legendaire')
  assert.equal(pageDuProchain(LEA, 'portrait'), 'commune')
  assert.equal(pageDuProchain(LEA, 'emoji'), 'commune')
  assert.equal(pageDuProchain({ ...LEA, niveau: 9 }, 'emoji'), 'peucommune')
  assert.equal(pageDuProchain({ ...LEA, niveau: 30 }, 'emoji'), null)
  assert.equal(pageDuProchain({ ...LEA, sentiers: Object.fromEntries(BRANCHES.map(b => [b.key, 6])) }, 'portrait'), 'rare')
})

test('comment l’obtenir : ses voies — l’une suffit —, chacune ses étapes, son lieu et où il en est', () => {
  // La Licorne : en soirée, ou au quiz du jour — la maquette de la fiche.
  assert.deepEqual(voiesDeLAvatar('lg:licorne', LEA), [
    [
      {
        lieu: 'soiree',
        titre: 'En soirée : 3 fois « Seul contre tous »',
        regle: 'Seul de la salle à trouver une question, six réponses au moins',
        tenue: false,
        progres: { acquis: 1, requis: 3, dit: '1 sur 3' },
      },
    ],
    [
      {
        lieu: 'jour',
        titre: 'Au quiz du jour : 3 fois « Seul au monde »',
        regle: 'Seul de tous les joueurs du jour à trouver une question',
        tenue: false,
        progres: { acquis: 0, requis: 3, dit: '0 sur 3' },
      },
    ],
  ])
  // Un palier de carrière : ce qu'il compte, et où il en est.
  const [habitue, assidu] = voiesDeLAvatar('lg:renard', LEA).map(v => v[0])
  assert.equal(habitue.titre, 'En soirée : « L’Habitué » · Argent')
  assert.equal(habitue.regle, '10 soirées jouées')
  assert.deepEqual(habitue.progres, { acquis: 4, requis: 10, dit: '4 sur 10' })
  assert.equal(assidu.titre, 'Au quiz du jour : « L’Assidu » · Argent')
  assert.deepEqual(assidu.progres, { acquis: 2, requis: 30, dit: '2 sur 30' })
  // La Chimère : une seule voie, trois étapes à la fois — chacune son lieu ; celle qu'il a déjà, tenue.
  const [chimere] = voiesDeLAvatar('lg:chimere', LEA)
  assert.deepEqual(
    chimere.map(e => [e.lieu, e.titre, e.tenue, e.progres?.dit ?? null]),
    [
      ['soiree', 'En soirée : « L’Habitué du Podium » · Bronze', true, '3 sur 3'],
      // Un seul jour suffit au bronze : rien à compter.
      ['jour', 'Au quiz du jour : « Le Champion du jour » · Bronze', false, null],
      ['campagne', 'En campagne : « L’Alpiniste » · Or', false, '17 sur 20'],
    ],
  )
  // Un haut fait qu'il suffit de décrocher une fois : pas de jauge.
  assert.deepEqual(voiesDeLAvatar('lg:phenix', LEA)[0], [
    { lieu: 'soiree', titre: 'En soirée : « Le Phénix »', regle: 'Gagner un quiz après avoir fini dans la moitié basse du précédent', tenue: true, progres: null },
  ])
  // Un légendaire de saison : ses dates, sans jauge.
  assert.deepEqual(voiesDeLAvatar('lg:citrouille', LEA), [
    [{ lieu: 'saison', titre: 'Pour Halloween, du 25 octobre au 1er novembre', regle: '3 jours de quiz du jour, ou une soirée ces jours-là', tenue: false, progres: null }],
  ])
  // Un portrait : le palier de son sentier ; un emoji de collection : son niveau.
  assert.deepEqual(voiesDeLAvatar('br:lynx', LEA), [
    [
      {
        lieu: 'sentiers',
        titre: 'Sur les sentiers : le palier 6 du sentier de la forêt',
        regle: 'Un portrait tous les deux paliers d’un sentier du savoir, dans la campagne',
        tenue: false,
        progres: { acquis: 5, requis: 6, dit: 'palier 5 sur 6' },
      },
    ],
  ])
  assert.deepEqual(voiesDeLAvatar('🐳', LEA)[0][0].titre, 'Au niveau 12')
  assert.deepEqual(voiesDeLAvatar('🐳', LEA)[0][0].progres, { acquis: 8, requis: 12, dit: 'niveau 8 sur 12' })
  assert.equal(voiesDeLAvatar('🐝', LEA)[0][0].tenue, true)
  // Chaque légendaire a au moins une voie, chaque étape son titre ; ni l'emoji de l'inscription ni une clé inconnue n'en ont.
  for (const l of LEGENDAIRES) {
    const voies = voiesDeLAvatar(l.key, LEA)
    assert.ok(voies.length > 0 && voies.every(v => v.length > 0 && v.every(e => e.titre && !e.titre.includes('hf:'))), l.key)
  }
  assert.deepEqual(voiesDeLAvatar('🦊', LEA), [])
  assert.deepEqual(voiesDeLAvatar('lg:inconnu', LEA), [])
})

test('un Divin ne dit pas comment il descend : ni voie, ni lieu, ni progression — descendu ou non (invariant 21)', () => {
  for (const d of DIVINS) {
    assert.deepEqual(voiesDeLAvatar(d.key, LEA), [], d.key)
    assert.deepEqual(voiesDeLAvatar(d.key, { ...LEA, divins: DIVINS.map(x => ({ key: x.key, legende: '…', ton: 'eclat' as const })) }), [], d.key)
  }
  // L'album ne connaît des Divins que leur liste publique.
  const source = readFileSync(new URL('../../shared/album.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /core\/divins|regleDuDivin|descend(re|u) si/)
  assert.match(source, /import \{ DIVINS \} from '\.\/divins'/)
})
