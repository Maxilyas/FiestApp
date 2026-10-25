// L'album « Mes avatars » : une seule collection, rangée par rareté (la
// maquette 1, choisie le 13 octobre 2026). Trois lignes de « Ma collection »
// séparaient les portraits, les légendaires et les emojis de collection, et
// les gens étaient « confus » : ici, la règle pure de l'album — la rareté de
// chaque avatar, où il se gagne, ses pages, et comment l'obtenir —, et ce que
// le Cabinet de curiosités y ajoute, son drapeau forcé : la règle, la fiche et
// la galerie des compagnons, rendues en HTML. L'écran : `ma-collection.test.ts`.
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
import { LEGENDAIRES, LEGENDAIRES_DU_CABINET } from '../../shared/legendaires'
import { CABINET_EN_PRODUCTION } from '../../shared/cabinet/ouverture'
import { GARDIENS_DE_SAISON } from '../../shared/cabinet/salles'
import { OEUVRES, oeuvresDeLaSalle } from '../../shared/cabinet/oeuvres'
import { JOURS_DU_SCARABEE } from '../../shared/cabinet/bareme'
import { DIVINS } from '../../shared/divins'
import { BRANCHES, PORTRAITS } from '../../shared/branches'
import { AVATARS, COLLECTION } from '../../shared/avatars'
import { COMPAGNONS, FORMES_DES_COMPAGNONS, METAMORPHOSES } from '../../shared/compagnons'
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
  // Les légendaires, les portraits, les formes des compagnons et leurs
  // métamorphoses, les emojis de collection, les Divins — pas ceux de
  // l'inscription, à tout le monde.
  assert.equal(AVATARS_DE_L_ALBUM.length, LEGENDAIRES.length + PORTRAITS.length + FORMES_DES_COMPAGNONS.length + METAMORPHOSES.length + COLLECTION.length + DIVINS.length)
  assert.equal(new Set(AVATARS_DE_L_ALBUM.map(a => a.cle)).size, AVATARS_DE_L_ALBUM.length)
  for (const emoji of AVATARS) assert.equal(avatarDeLAlbum(emoji), undefined, emoji)
  const parPage = Object.fromEntries(RARETES_D_AVATAR.map(r => [r, AVATARS_DE_L_ALBUM.filter(a => a.rarete === r).length]))
  // Cinq compagnons, une forme sur chacune des pages commune, rare, épique et légendaire — et la métamorphose de
  // chacun, légendaire : la luciole a la sienne depuis le 20 octobre 2026, le panda roux la sienne le même jour.
  assert.deepEqual(parPage, { commune: 23, peucommune: 18, rare: 29, epique: 17, legendaire: 48, divin: 6 })
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
  // L'expédition ouverte (l'étape 2), sa voie se montre : chacun de ceux qui ont leur joker s'y gagne aussi — ceux de
  // saison, partie à leur saison (le 18 octobre 2026).
  assert.deepEqual(lieux, {
    phenix: 'soiree jour expedition',
    dragon: 'soiree jour expedition',
    oracle: 'soiree expedition',
    chouette: 'soiree jour expedition',
    tigre: 'soiree jour expedition',
    licorne: 'soiree jour',
    lion: 'soiree jour expedition',
    renard: 'soiree jour expedition',
    comete: 'soiree expedition',
    kraken: 'soiree jour expedition',
    fantome: 'soiree jour expedition',
    'trou-noir': 'soiree expedition',
    sphinx: 'jour expedition',
    citrouille: 'saison expedition',
    sapin: 'saison expedition',
    bouquet: 'saison expedition',
    aigle: 'jour',
    ouroboros: 'jour expedition',
    scarabee: 'jour expedition',
    coq: 'jour expedition',
    'chauve-souris': 'jour expedition',
    salamandre: 'campagne expedition',
    elephant: 'campagne',
    serpent: 'campagne expedition',
    // Les trois mondes à la fois — ou l'expédition.
    chimere: 'soiree jour campagne expedition',
    janus: 'soiree jour expedition',
  })
  for (const p of PORTRAITS) assert.deepEqual(avatarDeLAlbum(p.key)!.lieux, ['sentiers'], p.key)
  for (const c of COLLECTION) assert.deepEqual(avatarDeLAlbum(c.emoji)!.lieux, ['niveau'], c.emoji)
  for (const d of DIVINS) assert.deepEqual(avatarDeLAlbum(d.key)!.lieux, [], d.key)
  // Un compagnon s'achète — la luciole se gagne en expédition — ; ses formes suivantes, dans sa niche ; sa métamorphose, par l'Éclat.
  for (const f of FORMES_DES_COMPAGNONS) {
    const vient = f.compagnon === 'luciole' ? 'expedition' : 'boutique'
    assert.deepEqual(avatarDeLAlbum(f.key)!.lieux, f.rang === 0 ? [vient] : [vient, 'niche'], f.key)
  }
  for (const f of METAMORPHOSES) {
    assert.deepEqual(avatarDeLAlbum(f.key)!.lieux, [f.compagnon === 'luciole' ? 'expedition' : 'boutique', 'niche', 'eclat'], f.key)
  }
  // D'une phrase, à l'oreille : ses voies sont l'une ou l'autre, les étapes d'une voie toutes à la fois.
  const dit = (cle: string) => ouIlSeGagne(avatarDeLAlbum(cle)!)
  assert.equal(dit('lg:licorne'), 'en soirée ou au quiz du jour')
  // Voie par voie : un seul mot pour tous ses lieux, « en soirée, au quiz du jour, en campagne ou en expédition »,
  // disait qu'un seul suffisait à la Chimère.
  assert.equal(dit('lg:chimere'), 'en soirée, au quiz du jour et en campagne, ou en expédition')
  assert.equal(dit('lg:janus'), 'en soirée et au quiz du jour, ou en expédition')
  assert.equal(dit('lg:phenix'), 'en soirée, au quiz du jour ou en expédition')
  assert.equal(dit('lg:sphinx'), 'au quiz du jour ou en expédition')
  assert.equal(dit('lg:aigle'), 'au quiz du jour', 'sans joker, pas de voie de l’expédition')
  assert.equal(dit('lg:bouquet'), 'pour le Nouvel An')
  assert.equal(dit('br:lynx'), 'sur les sentiers')
  assert.equal(dit('🐳'), 'au niveau 12')
  assert.equal(dit('dv:seraphin'), '')
  assert.equal(dit('cp:loup-louveteau'), 'en boutique')
  assert.equal(dit('cp:chat-adulte'), 'en boutique, puis à 300 bonnes réponses avec lui')
  // Chacun à son genre : « en le portant » se lisait de travers sous la tortue.
  assert.equal(dit('cp:tortue-ile'), 'en boutique, puis à 500 bonnes réponses avec elle')
  assert.equal(dit('cp:tortue-fleurs'), 'en boutique, puis à 500 bonnes réponses avec elle et par l’Éclat')
  // La luciole ne s'achète pas : sa première forme se gagne en expédition, la Première traversée (le 20 octobre 2026).
  assert.equal(dit('cp:luciole-ver'), 'en expédition')
  assert.equal(dit('cp:luciole-constellation'), 'en expédition, puis à 500 bonnes réponses avec elle')
  assert.equal(dit('cp:luciole-aurore'), 'en expédition, puis à 500 bonnes réponses avec elle et par l’Éclat')
})

test('une page par rareté : ce qu’on a d’abord, puis ce qui reste, chacun dans l’ordre du catalogue — le compte de la collection est le sien', () => {
  const pages = pagesDeLAlbum(LEA)
  assert.deepEqual(
    pages.map(p => `${p.rarete} ${p.acquis}/${p.total}`),
    // Le blaireau (palier 4) et l'écureuil (palier 2) ; cinq emojis jusqu'au niveau 8 ; le Phénix ; le Séraphin.
    ['commune 6/23', 'peucommune 1/18', 'rare 0/29', 'epique 0/17', 'legendaire 1/48', 'divin 1/6'],
  )
  const commune = pages[0].avatars
  assert.deepEqual(
    commune.filter(a => a.aLui).map(a => a.avatar.cle),
    ['br:ecureuil', '🦚', '🐢', '🦈', '🦔', '🐝'],
  )
  assert.ok(commune.findIndex(a => !a.aLui) === 6 && commune.slice(6).every(a => !a.aLui), 'ce qui reste vient ensuite')
  // Le Phénix d'abord, puis les vingt-cinq autres légendaires, puis les douze
  // formes ultimes des sentiers, et les quatre des compagnons, chacune suivie
  // de sa métamorphose.
  const legendaires = pages[4].avatars.map(a => a.avatar.cle)
  assert.equal(legendaires[0], 'lg:phenix')
  assert.deepEqual(legendaires.slice(1, 26), LEGENDAIRES.filter(l => l.key !== 'lg:phenix').map(l => l.key))
  assert.deepEqual(legendaires.slice(26, 38), BRANCHES.map(b => b.portraits[5].key))
  assert.deepEqual(legendaires.slice(38), [
    'cp:loup-ultime',
    'cp:loup-tempete',
    'cp:chat-esprit',
    'cp:chat-soleil',
    'cp:tortue-ile',
    'cp:tortue-fleurs',
    'cp:luciole-constellation',
    'cp:luciole-aurore',
    'cp:panda-erable',
    'cp:panda-sakura',
  ])
  assert.deepEqual(legendaires.slice(38), COMPAGNONS.flatMap(c => [c.formes[3].key, ...(c.lumiere ? [c.lumiere.key] : [])]))
  // Une seule règle compte l'album, sa ligne de « Ma collection » et son total.
  assert.deepEqual(compteDeLAlbum(LEA), { acquis: 9, total: 141 })
  assert.deepEqual(compteDeLAlbum(LEA), { acquis: pages.reduce((s, p) => s + p.acquis, 0), total: pages.reduce((s, p) => s + p.total, 0) })
  const avatars = compteDeLaCollection({ ...LEA, ouvertes: [], prix: [], ecussons: [] } as any).familles.find(f => f.famille === 'avatars')!
  assert.deepEqual(avatars.parties, [{ partie: 'avatars', acquis: 9, total: 141 }])
})

test('les compagnons dans l’album : chaque forme à sa page, achetées en boutique, puis grandies dans sa niche', () => {
  for (const c of COMPAGNONS) {
    assert.deepEqual(
      c.formes.map(f => avatarDeLAlbum(f.key)!.rarete),
      ['commune', 'rare', 'epique', 'legendaire'],
      c.key,
    )
  }
  // Le loup acheté et grandi d'une forme : ses deux premières sont à lui, le reste à gagner.
  const AVEC_LE_LOUP = {
    ...LEA,
    legendaire: 'cp:loup-jeune',
    compagnons: [{ compagnon: 'loup' as const, rang: 1 }],
    boutique: { confettis: { gagnes: 0, depenses: 0, solde: 0 }, possedes: [], porte: null, jour: '2026-10-13', compagnons: [{ compagnon: 'loup' as const, rang: 1, justes: 162 }] },
  }
  assert.deepEqual(compteDeLAlbum(AVEC_LE_LOUP), { acquis: 11, total: 141 })
  assert.equal(pageDuDebut(AVEC_LE_LOUP), 'rare', 'il porte le jeune loup : la page rare')
  assert.equal(pageDuProchain(LEA, 'compagnon'), 'commune', 'aucun acheté : la première forme de chacun')
  assert.equal(pageDuProchain(AVEC_LE_LOUP, 'compagnon'), 'commune', 'le chat et la tortue restent à acheter')
  // Comment l'obtenir : l'acheter ; puis tant de bonnes réponses dans sa niche, et où il en est.
  assert.deepEqual(voiesDeLAvatar('cp:tortue-bebe', LEA), [
    [{ lieu: 'boutique', titre: 'En boutique : 1000 confettis', regle: 'La Tortue-île s’achète à sa première forme, puis grandit avec toi', tenue: false, progres: null }],
  ])
  // La luciole ne s'achète pas : la Première traversée l'amène, une expédition menée au bout, sans jauge (le 20 octobre 2026).
  assert.deepEqual(voiesDeLAvatar('cp:luciole-ver', LEA), [
    [
      {
        lieu: 'expedition',
        titre: 'En expédition : la Première traversée',
        regle: 'Mène une expédition au bout — le troisième gardien vaincu — : elle te rejoint, puis grandit avec toi',
        tenue: false,
        progres: null,
      },
    ],
  ])
  assert.equal(voiesDeLAvatar('cp:luciole-jeune', { ...LEA, compagnons: [{ compagnon: 'luciole', rang: 0 }] })[0][0].tenue, true, 'à lui : sa première étape est tenue')
  const [[achat, adulte]] = voiesDeLAvatar('cp:loup-adulte', AVEC_LE_LOUP)
  assert.equal(achat.tenue, true)
  assert.deepEqual(adulte, {
    lieu: 'niche',
    titre: 'Dans sa niche : 300 bonnes réponses',
    regle: 'Celles qui rapportent un confetti, en soirée, au quiz du jour et en campagne',
    tenue: false,
    progres: { acquis: 162, requis: 300, dit: '162 sur 300' },
  })
  // Pas encore acheté : rien à compter.
  assert.equal(voiesDeLAvatar('cp:chat-jeune', AVEC_LE_LOUP)[0][1].progres, null)
  assert.equal(voiesDeLAvatar('cp:tortue-jeune', AVEC_LE_LOUP)[0][1].titre, 'Dans sa niche : 100 bonnes réponses')
  // Atteinte, une forme le reste : sa jauge est pleine, même si ses bonnes réponses ont redescendu.
  assert.deepEqual(voiesDeLAvatar('cp:loup-jeune', { ...AVEC_LE_LOUP, boutique: { ...AVEC_LE_LOUP.boutique, compagnons: [{ compagnon: 'loup', rang: 1, justes: 40 }] } })[0][1].progres, {
    acquis: 100,
    requis: 100,
    dit: '100 sur 100',
  })
  // Sa métamorphose : l'acheter, sa forme ultime, puis l'Éclat en portant l'une de ses formes — un tirage, sans jauge.
  const [[, ultime, eclat]] = voiesDeLAvatar('cp:loup-tempete', AVEC_LE_LOUP)
  assert.equal(ultime.titre, 'Dans sa niche : 500 bonnes réponses')
  assert.deepEqual(eclat, {
    lieu: 'eclat',
    titre: 'Par l’Éclat : en portant l’une de ses formes',
    regle: 'Une chance sur 40 par soirée à deux ou quiz du jour, sur 20 au défi de la semaine',
    tenue: false,
    progres: null,
  })
  // L'Éclat tombé — sur le louveteau, il y a longtemps — : tenu ; sa métamorphose s'ouvre à sa forme ultime, et pas avant.
  const ECLATE = { ...AVEC_LE_LOUP, compagnons: [{ compagnon: 'loup' as const, rang: 1, eclat: true as const }] }
  assert.equal(voiesDeLAvatar('cp:loup-tempete', ECLATE)[0][2].tenue, true)
  assert.deepEqual(compteDeLAlbum(ECLATE), { acquis: 11, total: 141 })
  const ULTIME = { ...ECLATE, compagnons: [{ compagnon: 'loup' as const, rang: 3, eclat: true as const }] }
  assert.deepEqual(compteDeLAlbum(ULTIME), { acquis: 14, total: 141 }, 'ses quatre formes, et sa métamorphose')
  // La luciole éclatée à sa forme ultime : ses quatre formes, et sa luciole-aurore (le 20 octobre 2026) ; sans l'Éclat, les quatre seules.
  const LUCIOLE = { ...LEA, compagnons: [{ compagnon: 'luciole' as const, rang: 3, eclat: true as const }] }
  assert.deepEqual(compteDeLAlbum(LUCIOLE), { acquis: 14, total: 141 })
  assert.deepEqual(compteDeLAlbum({ ...LEA, compagnons: [{ compagnon: 'luciole' as const, rang: 3 }] }), { acquis: 13, total: 141 })
  assert.ok(pagesDeLAlbum(ULTIME)[4].avatars.some(a => a.aLui && a.avatar.cle === 'cp:loup-tempete'))
  // Sa voie part de l'expédition, comme ses formes : la Première traversée, sa forme ultime, puis l'Éclat.
  assert.deepEqual(
    voiesDeLAvatar('cp:luciole-aurore', LEA)[0].map(e => [e.lieu, e.titre]),
    [
      ['expedition', 'En expédition : la Première traversée'],
      ['niche', 'Dans sa niche : 500 bonnes réponses'],
      ['eclat', 'Par l’Éclat : en portant l’une de ses formes'],
    ],
  )
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
  // Un légendaire de saison : ses dates, sans jauge — gardé au bout d'une expédition partie ces jours-là aussi, qui le met en gardien.
  assert.deepEqual(voiesDeLAvatar('lg:citrouille', LEA), [
    [
      {
        lieu: 'saison',
        titre: 'Pour Halloween, du 25 octobre au 1er novembre',
        regle: '3 jours de quiz du jour, une soirée ces jours-là, ou le garder au bout d’une expédition partie ces jours-là',
        tenue: false,
        progres: null,
      },
    ],
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
  // Un titre ne dit jamais une clé brute — un haut fait, une voie rangée : une voie montrée que l'album ne sait pas
  // dire tombait sur « En soirée : « cabinet:phenix » » (la voie du Cabinet, que l'album tait tant qu'il est fermé).
  for (const l of LEGENDAIRES) {
    const voies = voiesDeLAvatar(l.key, LEA)
    assert.ok(voies.length > 0 && voies.every(v => v.length > 0 && v.every(e => e.titre && !/\b(hf|saison|expedition|cabinet):/.test(e.titre))), l.key)
  }
  assert.deepEqual(voiesDeLAvatar('🦊', LEA), [])
  assert.deepEqual(voiesDeLAvatar('lg:inconnu', LEA), [])
})

test('une voie rangée se dit tenue s’il a le légendaire : les hauts faits que la page reçoit ne la portent jamais', () => {
  // Le Kraken gardé au bout de l'acte 3 : une ligne `expedition:kraken`, qu'aucun haut fait ne dit. Lue des hauts faits,
  // l'étape se disait à faire, le légendaire en main.
  const kraken = (legendaires: string[]) => voiesDeLAvatar('lg:kraken', { ...LEA, legendaires }).flat().find(e => e.lieu === 'expedition')!
  assert.equal(kraken(['lg:phenix', 'lg:kraken']).tenue, true)
  assert.equal(kraken(['lg:phenix']).tenue, false)
  // Une voie qui se compte, elle, se lit toujours de ses hauts faits : le Kraken à lui n'en fait pas trois lanternes rouges.
  const lanterne = voiesDeLAvatar('lg:kraken', { ...LEA, legendaires: ['lg:kraken'] })[0][0]
  assert.equal(lanterne.lieu, 'soiree')
  assert.equal(lanterne.tenue, false)
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

// ── Le Cabinet de curiosités ───────────────────────────────────────────────
// Vingt gardiens s'y réveillent, les trois de saison à leur fête, et la luciole
// à la première salle complète (le 25 octobre 2026). L'album tait la voie tant
// que le Cabinet est fermé en production (`voiesMontrees`, le drapeau du code,
// comme l'Expédition) ; forcé, il se lit tel qu'il sera à l'ouverture.

/** Les vingt-trois gardiens : les vingt à voie, et les trois de saison, dont le Cabinet range la condition même. */
const GARDIENS = [...LEGENDAIRES_DU_CABINET, ...GARDIENS_DE_SAISON]

test('le Cabinet ouvert, chaque gardien s’y gagne aussi : son lieu, sa phrase, voie après voie', () => {
  assert.equal(GARDIENS.length, 23)
  for (const l of LEGENDAIRES) {
    const ferme = avatarDeLAlbum(l.key, false)!.lieux
    const ouvert = avatarDeLAlbum(l.key, true)!.lieux
    // Une voie de plus, au bout : rien de ce qu'il disait ne bouge, la pastille non plus (son premier lieu).
    assert.deepEqual(ouvert, GARDIENS.includes(l.key) ? [...ferme, 'cabinet'] : ferme, l.key)
  }
  assert.deepEqual(avatarDeLAlbum('lg:phenix', true)!.lieux, ['soiree', 'jour', 'expedition', 'cabinet'])
  assert.deepEqual(avatarDeLAlbum('lg:citrouille', true)!.lieux, ['saison', 'expedition', 'cabinet'], 'sa fête, au Cabinet aussi')
  assert.deepEqual(avatarDeLAlbum('lg:licorne', true)!.lieux, ['soiree', 'jour'], 'sans joker, pas de gardien')
  const dit = (cle: string) => ouIlSeGagne(avatarDeLAlbum(cle, true)!, true)
  assert.equal(dit('lg:phenix'), 'en soirée, au quiz du jour, en expédition ou au Cabinet')
  assert.equal(dit('lg:sphinx'), 'au quiz du jour, en expédition ou au Cabinet')
  // Une voie de plusieurs lieux : chaque « ou » se dit, sans quoi le Cabinet se lisait dans la même voie que l'expédition.
  assert.equal(dit('lg:chimere'), 'en soirée, au quiz du jour et en campagne, ou en expédition, ou au Cabinet')
  assert.equal(dit('lg:janus'), 'en soirée et au quiz du jour, ou en expédition, ou au Cabinet')
  assert.equal(dit('lg:licorne'), 'en soirée ou au quiz du jour')
  assert.equal(dit('lg:citrouille'), 'pour Halloween', 'un légendaire de saison se dit par sa fête')
})

test('comment l’obtenir au Cabinet : la salle à compléter ou à dorer, la série, le musée entier — sans jauge, tenu s’il a le légendaire', () => {
  const auCabinet = (cle: string, p = LEA) => voiesDeLAvatar(cle, p, true).flat().filter(e => e.lieu === 'cabinet')
  // Le premier gardien d'une salle, quand elle est complète ; le second, ses cadres tous dorés.
  const rempart = oeuvresDeLaSalle('rempart').length
  assert.deepEqual(auCabinet('lg:phenix'), [
    { lieu: 'cabinet', titre: 'Au Cabinet : compléter la salle du Rempart', regle: `Ses ${rempart} œuvres, gagnées en jouant ou achetées avec la poussière d’or`, tenue: true, progres: null },
  ])
  assert.deepEqual(auCabinet('lg:ouroboros'), [
    { lieu: 'cabinet', titre: 'Au Cabinet : dorer la salle du Rempart', regle: `Ses ${rempart} cadres dorés, chacun en jouant sans faute ou avec la poussière d’or`, tenue: false, progres: null },
  ])
  // Le Vestibule se dit seul, au masculin, et compte ses vingt œuvres — les quatre de départ comprises.
  const vestibule = oeuvresDeLaSalle('vestibule').length
  assert.equal(auCabinet('lg:coq')[0].titre, 'Au Cabinet : compléter le Vestibule')
  assert.equal(auCabinet('lg:coq')[0].regle, `Ses ${vestibule} œuvres, gagnées en jouant ou achetées avec la poussière d’or`)
  assert.equal(auCabinet('lg:chimere')[0].titre, 'Au Cabinet : dorer le Vestibule')
  assert.equal(auCabinet('lg:chouette')[0].titre, 'Au Cabinet : compléter la salle de l’Érudit')
  assert.deepEqual(auCabinet('lg:scarabee')[0], {
    lieu: 'cabinet',
    titre: `Au Cabinet : ${JOURS_DU_SCARABEE} jours d’affilée`,
    regle: 'Une partie de la visite ou une chasse chaque jour, sans en manquer un',
    tenue: false,
    progres: null,
  })
  assert.deepEqual(auCabinet('lg:trou-noir')[0], { lieu: 'cabinet', titre: `Au Cabinet : les ${OEUVRES.length} œuvres`, regle: 'Toutes ses salles complètes, le Vestibule compris', tenue: false, progres: null })
  // Une voie à elle, au bout : celle de l'Expédition reste, l'une ou l'autre suffit.
  const phenix = voiesDeLAvatar('lg:phenix', LEA, true)
  assert.deepEqual(phenix.slice(0, -1), voiesDeLAvatar('lg:phenix', LEA, false))
  assert.deepEqual(phenix.at(-1)!.map(e => e.lieu), ['cabinet'])
  // Sa tenue se lit des légendaires qu'il a : la ligne `cabinet:kraken` n'est pas un haut fait que la page reçoive.
  assert.equal(auCabinet('lg:kraken', { ...LEA, legendaires: ['lg:kraken'] })[0].tenue, true)
  assert.equal(auCabinet('lg:kraken')[0].tenue, false)
  // Chacun des vingt a la sienne, dite en mots — jamais « En soirée : « cabinet:phenix » », qu'un lieu oublié faisait lire.
  for (const cle of LEGENDAIRES_DU_CABINET) {
    const [e] = auCabinet(cle)
    assert.ok(e && e.titre.startsWith('Au Cabinet : ') && e.regle && e.progres === null, cle)
  }
  for (const l of LEGENDAIRES) {
    for (const e of voiesDeLAvatar(l.key, LEA, true).flat()) assert.doesNotMatch(e.titre, /\b(hf|saison|expedition|cabinet):/, l.key)
  }
  // Ceux de saison n'ont pas de voie à eux : leur fête se gagne aussi au Cabinet, dite dans ses dates.
  assert.deepEqual(voiesDeLAvatar('lg:citrouille', LEA, true), [
    [
      {
        lieu: 'saison',
        titre: 'Pour Halloween, du 25 octobre au 1er novembre',
        regle: '3 jours de quiz du jour, une soirée ces jours-là, une œuvre gagnée en jouant au Cabinet ces jours-là, ou le garder au bout d’une expédition partie ces jours-là',
        tenue: false,
        progres: null,
      },
    ],
  ])
  // Ni l'Aigle, ni la Licorne, ni l'Éléphant : ils ne gardent rien. Un Divin, toujours rien (invariant 21).
  for (const cle of ['lg:aigle', 'lg:licorne', 'lg:elephant']) assert.deepEqual(voiesDeLAvatar(cle, LEA, true), voiesDeLAvatar(cle, LEA, false), cle)
  for (const d of DIVINS) {
    assert.deepEqual(voiesDeLAvatar(d.key, LEA, true), [], d.key)
    assert.deepEqual(avatarDeLAlbum(d.key, true)!.lieux, [], d.key)
  }
})

test('la luciole, le Cabinet ouvert : sa première salle complète l’amène, dite d’abord — l’une ou l’autre voie, puis sa niche', () => {
  // Le Cabinet d'abord : l'Expédition ferme son départ le jour où il ouvre en production ; l'expédition en route
  // l'amène encore, sa voie reste dite.
  const premiere = voiesDeLAvatar('cp:luciole-ver', LEA, true)
  assert.deepEqual(premiere, [
    [{ lieu: 'cabinet', titre: 'Au Cabinet : compléter une salle', regle: 'Complète une salle de ton musée : elle te rejoint, puis grandit avec toi', tenue: false, progres: null }],
    voiesDeLAvatar('cp:luciole-ver', LEA, false)[0],
  ])
  // Ses formes suivantes : chaque voie la fait venir, puis grandir — « ou » entre les voies, « et » entre leurs étapes.
  assert.deepEqual(
    voiesDeLAvatar('cp:luciole-aurore', LEA, true).map(v => v.map(e => e.lieu)),
    [
      ['cabinet', 'niche', 'eclat'],
      ['expedition', 'niche', 'eclat'],
    ],
  )
  const sienne = { ...LEA, compagnons: [{ compagnon: 'luciole' as const, rang: 0 }] }
  assert.ok(voiesDeLAvatar('cp:luciole-ver', sienne, true).every(v => v[0].tenue), 'à lui : sa venue est tenue, par où qu’elle soit venue')
  for (const f of FORMES_DES_COMPAGNONS.filter(f => f.compagnon === 'luciole')) {
    assert.deepEqual(avatarDeLAlbum(f.key, true)!.lieux, f.rang === 0 ? ['cabinet', 'expedition'] : ['cabinet', 'expedition', 'niche'], f.key)
  }
  assert.deepEqual(avatarDeLAlbum('cp:luciole-aurore', true)!.lieux, ['cabinet', 'expedition', 'niche', 'eclat'])
  const dit = (cle: string) => ouIlSeGagne(avatarDeLAlbum(cle, true)!, true)
  assert.equal(dit('cp:luciole-ver'), 'au Cabinet ou en expédition')
  assert.equal(dit('cp:luciole-constellation'), 'au Cabinet ou en expédition, puis à 500 bonnes réponses avec elle')
  assert.equal(dit('cp:luciole-aurore'), 'au Cabinet ou en expédition, puis à 500 bonnes réponses avec elle et par l’Éclat')
  // Ceux de la boutique ne changent pas.
  assert.equal(dit('cp:loup-louveteau'), 'en boutique')
  assert.deepEqual(voiesDeLAvatar('cp:tortue-bebe', LEA, true), voiesDeLAvatar('cp:tortue-bebe', LEA, false))
})

/** Un composant du client, rendu en HTML. Son JSX est compilé pour un `React` global : posé avant d'importer le premier. */
async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const React = (await import('react')).default
  Object.assign(globalThis, { React })
  const module = await import(`../../client/src/components/${fichier}.tsx`)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** La fiche d'un avatar dans l'album, le drapeau du Cabinet donné. */
const ficheDeLAlbum = (cle: string, cabinet: boolean) =>
  rendu('AlbumDesAvatars', 'FicheDeLAvatar', { a: avatarDeLAlbum(cle, cabinet), aLui: false, porte: false, profil: { ...LEA, eclats: [] }, dessin: null, cabinet })

test('la fiche de l’album, le Cabinet ouvert : son étape sous l’arche du Cabinet, et son chemin', async () => {
  // L'icône du lieu : l'arche du gros bouton de l'accueil.
  const arche = await rendu('Icon', 'Icon', { name: 'landmark' })
  // Les espaces insécables de `espacesFines`, lues comme des espaces.
  const ouroboros = (await ficheDeLAlbum('lg:ouroboros', true)).replace(/[  ]/g, ' ')
  assert.ok(ouroboros.includes(`<span class="album-etape-icone" aria-hidden="true">${arche}</span><span class="album-etape-texte"><b>Au Cabinet : dorer la salle du Rempart</b>`), 'l’étape du Cabinet, sous son arche')
  assert.match(ouroboros, /<span class="album-ou">ou<\/span><div class="album-voie">(?:(?!album-ou).)*Au Cabinet/, 'une voie de plus, après un « ou »')
  assert.doesNotMatch(await ficheDeLAlbum('lg:ouroboros', false), /Cabinet/)
  // La luciole : le Cabinet d'abord, et son chemin.
  assert.match(await ficheDeLAlbum('cp:luciole-ver', true), /<a class="btn btn-small album-aller" href="\/cabinet">Aller au Cabinet<\/a>/)
  assert.match(await ficheDeLAlbum('cp:luciole-ver', false), /<a class="btn btn-small album-aller" href="\/expedition">Partir en expédition<\/a>/)
})

/** La galerie des compagnons (« Tous les voir ») : la grille, ou la fiche d'un compagnon. */
const galerie = (cabinet: boolean | undefined, ouverteSur: string | null = null) =>
  rendu('GalerieDesCompagnons', 'GalerieDesCompagnons', {
    siens: [],
    niche: null,
    solde: 0,
    busy: false,
    ouverteSur,
    onAdopter: async () => null,
    onInstaller: () => {},
    onNommer: async () => null,
    onFermer: () => {},
    cabinet,
  })

test('la galerie des compagnons : la luciole se gagne au Cabinet, le Cabinet ouvert — fermé, rien ne change', async () => {
  // La grille : sa pastille dit où elle se gagne, et sa case à l'oreille.
  const fermee = await galerie(false)
  assert.match(fermee, /aria-label="La Luciole : se gagne en expédition"/)
  assert.match(fermee, /<span class="galerie-condition en-expedition">Expédition<\/span>/)
  assert.doesNotMatch(fermee, /Cabinet/)
  const ouverte = await galerie(true)
  assert.match(ouverte, /aria-label="La Luciole : se gagne au Cabinet ou en expédition"/)
  assert.match(ouverte, /<span class="galerie-condition en-expedition"><svg[^>]*>[\s\S]*?<\/svg>Cabinet<\/span>/)
  // Sa fiche : comment l'avoir, le Cabinet d'abord, puis l'expédition ; et le chemin du Cabinet.
  const ficheFermee = await galerie(false, 'luciole')
  assert.match(ficheFermee, /<b>Mène une expédition au bout<\/b>/)
  assert.match(ficheFermee, /<a class="btn galerie-cta" href="\/expedition">Partir en expédition<\/a>/)
  assert.doesNotMatch(ficheFermee, /Cabinet/)
  const fiche = await galerie(true, 'luciole')
  // Les espaces fines de `espacesFines` devant les deux-points.
  assert.match(fiche, /<b>Complète une salle du Cabinet<\/b><span class="muted small">Ta première salle complète\s: elle te rejoint\. Elle ne s’achète pas\.<\/span>/)
  assert.match(fiche, /<b>Ou mène une expédition au bout<\/b>/)
  assert.ok(fiche.indexOf('Complète une salle du Cabinet') < fiche.indexOf('Ou mène une expédition au bout'), 'le Cabinet d’abord')
  assert.match(fiche, /<a class="btn galerie-cta" href="\/cabinet">Aller au Cabinet<\/a>/)
  assert.doesNotMatch(fiche, /href="\/expedition"/, 'un seul chemin : celui du Cabinet')
  // Sous sa première forme, ce qui l'amène — le mot de sa pastille.
  assert.match(fiche, /<span class="galerie-forme-seuil" aria-hidden="true">Cabinet<\/span>/)
  assert.match(ficheFermee, /<span class="galerie-forme-seuil" aria-hidden="true">Expédition<\/span>/)
  // D'office, le drapeau du code.
  assert.equal(await galerie(undefined), CABINET_EN_PRODUCTION ? ouverte : fermee)
  // Ceux de la boutique ne changent pas.
  assert.equal(await galerie(true, 'loup'), await galerie(false, 'loup'))
})

test('le Cabinet fermé, l’album ne dit rien de lui — et le drapeau du code décide d’office', () => {
  for (const a of AVATARS_DE_L_ALBUM) {
    const ferme = avatarDeLAlbum(a.cle, false)!
    assert.ok(!ferme.lieux.includes('cabinet'), a.cle)
    assert.doesNotMatch(ouIlSeGagne(ferme, false), /Cabinet/, a.cle)
    assert.ok(!voiesDeLAvatar(a.cle, LEA, false).flat().some(e => e.lieu === 'cabinet' || /Cabinet/.test(e.titre + e.regle)), a.cle)
    // Le drapeau d'office, celui du code : l'album de la page est celui-là.
    assert.deepEqual(avatarDeLAlbum(a.cle), avatarDeLAlbum(a.cle, CABINET_EN_PRODUCTION), a.cle)
    assert.equal(ouIlSeGagne(a), ouIlSeGagne(avatarDeLAlbum(a.cle, CABINET_EN_PRODUCTION)!, CABINET_EN_PRODUCTION), a.cle)
    assert.deepEqual(voiesDeLAvatar(a.cle, LEA), voiesDeLAvatar(a.cle, LEA, CABINET_EN_PRODUCTION), a.cle)
  }
  // Les pages et les comptes ne lisent pas les lieux : ouvert ou fermé, l'album compte autant.
  assert.equal(AVATARS_DE_L_ALBUM.length, 141)
})
