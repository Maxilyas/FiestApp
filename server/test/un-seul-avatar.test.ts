// Un joueur n'a qu'un avatar (le retour du propriétaire du 14 octobre 2026 :
// « il y a encore une confusion entre emoji et légendaire. Maintenant cela
// doit être une seule entité ») : il portait un légendaire, et la rangée des
// bordures de la loge, les albums des finitions et des bordures de « Ma
// collection », les vainqueurs du défi de la semaine le montraient en emoji —
// et une trentaine d'autres endroits avec eux. Partout où son avatar se
// montre, c'est celui qu'il porte ; l'emoji d'en dessous ne tient la place
// que le temps que le dessin arrive, et sous un Divin, qui ne prend ni
// finition ni bordure, un aperçu les montre seules.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import React from 'react'
import { createClient } from '@libsql/client'
import { avatarDeLApercu, sonAvatar } from '../../shared/sonAvatar'
import { formeDeCompagnon } from '../../shared/compagnons'
import { FINITIONS } from '../../shared/profil'
import { LIGUES } from '../../shared/duels'
import { ArchiveStore } from '../src/core/archive'
import { buildRecap } from '../src/core/recap'
import { buildReview } from '../src/core/review'
import { computeStats } from '../src/core/stats'
import type { AnswerRow } from '../src/core/answers'
import type { ProfileBadge } from '../src/core/party'
import type { PartyArchive } from '../../shared/archive'
import type { PublicPlayer } from '../../shared/types'
import { horloge, salle, sondage } from './salle'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/profil', search: '', hash: '', origin: 'http://banc' } },
  location: { pathname: '/profil', search: '', hash: '', origin: 'http://banc' },
})

const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href

async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(url(`${fichier}.tsx`))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** Les dessins arrivent à la demande (`medaillons.ts`) ; chargés, `Avatar` les montre. */
async function dessins() {
  await import(url('components/Legendaire.tsx'))
  await import(url('components/Divin.tsx'))
}

/**
 * Léa : le Phénix au cou, éclaté, en Or ; ses bordures de bronze, sertie, et
 * d'argent, trois crans. Son emoji d'inscription, le renard, ne se porte plus.
 */
const LEA = {
  id: 'p1',
  login: 'lea',
  name: 'Léa',
  avatar: '🦊',
  niveau: 12,
  finition: 'or',
  finitionChoisie: 'auto',
  ouvertes: ['mat', 'argent', 'or', 'holo'],
  eclats: ['lg:phenix'],
  eclatsEteints: [],
  legendaire: 'lg:phenix',
  legendaires: ['lg:phenix'],
  divins: [],
  sentiers: {},
  compagnons: [],
  hautsFaits: [],
  titre: null,
  titresDates: [],
  vitrine: [],
  vitrineChoisie: null,
  fonds: [],
  fond: null,
  gerbes: ['confettis'],
  gerbe: 'confettis',
  bordures: [
    { ligue: 'bronze', crans: 12 },
    { ligue: 'argent', crans: 3 },
  ],
  bordureChoisie: 'auto',
  theme: null,
}
/** La même, le Séraphin au cou : un Divin a sa propre lumière. */
const LEA_DIVINE = { ...LEA, legendaire: 'dv:seraphin', divins: ['dv:seraphin'] }

const loge = { essai: {}, essayer: () => {}, busy: false }

// ── 1. La règle ───────────────────────────────────────────────────────────

test('son avatar : ce qu’il porte, son Éclat compris — et sous un Divin, l’aperçu d’une finition ou d’une bordure n’a rien dedans', () => {
  assert.deepEqual(sonAvatar(LEA), { avatar: '🦊', legendaire: 'lg:phenix', eclat: true })
  assert.deepEqual(sonAvatar({ ...LEA, eclatsEteints: ['lg:phenix'] }), { avatar: '🦊', legendaire: 'lg:phenix', eclat: false }, 'éteint, il porte la version d’origine')
  assert.deepEqual(sonAvatar({ ...LEA, legendaire: null, eclats: ['🦊'] }), { avatar: '🦊', eclat: true }, 'sans rien au cou, son emoji, éclaté')
  assert.deepEqual(avatarDeLApercu(LEA), sonAvatar(LEA))
  // Ni l'emoji qu'il ne porte pas, ni le Divin, qui ne montrerait rien de la finition.
  assert.deepEqual(avatarDeLApercu(LEA_DIVINE), { avatar: '', eclat: false })
})

// ── 2. La loge et « Ma collection » : ce que le propriétaire a vu ─────────

test('dans la loge, chaque bordure entoure ce qu’il porte — sous un Divin, la bordure seule', async () => {
  await dessins()
  const html = await rendu('components/Apparence', 'MesBordures', { profil: LEA, ...loge })
  // Auto, Sans, puis le bronze et l'argent : trois bordures autour du Phénix, « Sans » n'a que son pointillé.
  const pastilles = html.split('finition-choix bordure-choix').slice(1)
  assert.equal(pastilles.length, 4)
  assert.equal(pastilles.filter(p => p.includes('av-legendaire')).length, 3, 'le Phénix dans chaque bordure')
  assert.ok(pastilles.some(p => p.includes('bordure-sans')))
  assert.doesNotMatch(html, /🦊/, 'le renard d’en dessous ne s’y montre plus')

  const divine = await rendu('components/Apparence', 'MesBordures', { profil: LEA_DIVINE, ...loge })
  assert.doesNotMatch(divine, /🦊|av-legendaire|av-divin/, 'ni l’emoji, ni le Séraphin qui ne la porterait pas')
  assert.match(divine, /Le Séraphin a sa propre lumière : ta bordure se voit sous tes autres avatars\./)
})

test('« Ma collection » : les albums des finitions et des bordures montrent ce qu’il porte — sous un Divin, la finition ou la bordure seule', async () => {
  await dessins()
  for (const [partie, n, mot] of [
    ['finitions', FINITIONS.length, 'ta finition'],
    ['bordures', LIGUES.length, 'ta bordure'],
  ] as const) {
    const html = await rendu('components/AlbumDuStyle', 'AlbumDuStyle', { partie, profil: LEA })
    const cases = html.split('trophee-case style-case').slice(1)
    assert.equal(cases.length, n, partie)
    assert.ok(
      cases.every(c => c.includes('av-legendaire')),
      `${partie} : le Phénix dans chaque case`,
    )
    assert.doesNotMatch(html, /🦊/, `${partie} : plus le renard d’en dessous`)
    const divine = await rendu('components/AlbumDuStyle', 'AlbumDuStyle', { partie, profil: LEA_DIVINE })
    assert.doesNotMatch(divine, /🦊|av-legendaire/, `${partie} : sous un Divin, rien dedans`)
    assert.match(divine, new RegExp(`Le Séraphin a sa propre lumière : ${mot} se voit sous tes autres avatars\\.`))
  }
})

// ── 3. Dans une phrase ────────────────────────────────────────────────────

test('dans une phrase, chacun avec l’avatar qu’il porte, à la française — les vainqueurs du défi, d’hier, du souvenir, de l’historique', async () => {
  await dessins()
  const phrase = await rendu('components/Avatar', 'Nommes', {
    joueurs: [
      { nom: 'Léa', avatar: '🦊', legendaire: 'lg:phenix', finition: 'or' },
      { nom: 'Tom', avatar: '🐻' },
      { nom: 'Zoé', avatar: '🐸' },
    ],
  })
  // (React 19 annonce l'image du médaillon en tête : `<link rel="preload">`.)
  assert.match(
    phrase,
    /^(<link [^>]*>)*<span class="av av-en-ligne av-legendaire[^"]*">.*?<\/span> Léa, <span class="av av-en-ligne"><span class="av-emoji">🐻<\/span><\/span> Tom et <span class="av av-en-ligne"><span class="av-emoji">🐸<\/span><\/span> Zoé$/,
  )
  assert.doesNotMatch(phrase, /🦊/)
  const seuls = await rendu('components/Avatar', 'AvatarsEnLigne', { joueurs: [{ avatar: '🦊', legendaire: 'lg:phenix' }, { avatar: '🐻' }] })
  assert.match(seuls, /^(<link [^>]*>)*<span class="av av-en-ligne av-legendaire[^"]*">.*<\/span> <span class="av av-en-ligne"><span class="av-emoji">🐻<\/span><\/span> $/)
})

test('le bilan nomme chacun avec l’avatar qu’il porte : la plus rapide, le plus proche, la tête du classement', async () => {
  await dessins()
  const { makeCtx, JoueurDuBilan } = await import(url('components/BilanQuestion.tsx'))
  const review = buildReview({
    rows: [reponse('jeanne', 300)],
    players: [joueur('jeanne', 'Jeanne', '🦊', { score: 300, finition: 'or', legendaire: 'lg:phenix' })],
    teams: [],
    bonuses: [],
    packsBySession: new Map(),
    library: [],
  })
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html = renderToStaticMarkup(React.createElement(JoueurDuBilan, { ctx: makeCtx(review), id: 'jeanne' }))
  assert.match(html, /^(<link [^>]*>)*<span class="av av-en-ligne av-legendaire[^"]*">.*<\/span> Jeanne$/)
  assert.equal(renderToStaticMarkup(React.createElement(JoueurDuBilan, { ctx: makeCtx(review), id: 'parti' })), '???')
})

test('l’Éclat tombé sur un compagnon porté : son dessin et son nom — sa clé s’écrivait en toutes lettres', async () => {
  const forme = formeDeCompagnon('cp:loup-jeune')!
  const html = await rendu('components/Ouverts', 'EclatTombe', { cle: forme.key, avatar: '🦊', chance: 20 })
  assert.doesNotMatch(html, /cp:loup/)
  assert.match(html, new RegExp(`<h2>${forme.nom} a éclaté !</h2>`))
  assert.match(html, /Il brille, désormais, sous toutes ses formes/)
  // À la clôture, sur l'écran commun, de même.
  assert.match(readFileSync(new URL('../../client/src/components/Cloture.tsx', import.meta.url), 'utf8'), /legendaire\(e\.eclate\) \|\| portrait\(e\.eclate\) \|\| formeDeCompagnon\(e\.eclate\)/)
})

test('l’Éclat tombé sur sa forme ultime : la carte montre la métamorphose qui s’ouvre, et « Le porter » — plus jeune, elle l’annonce', async () => {
  const carte = (cle: string) => rendu('components/Ouverts', 'EclatTombe', { cle, avatar: '🦊', chance: 40 })
  // L'Éclat tombe sur ce qu'il porte : sa forme ultime portée, sa métamorphose
  // s'ouvre maintenant — une forme de plus, qui ne remplace rien (le
  // propriétaire, le 19 octobre 2026 : « je veux que ce soit un choix »).
  const ultime = await carte('cp:loup-ultime')
  assert.match(ultime, /<h2>Le loup des étoiles a éclaté !<\/h2>/)
  assert.match(ultime, /<section class="card fin-legendaire fin-metamorphose"><span class="label">Sa métamorphose s’ouvre<\/span>/)
  assert.match(ultime, /<h2>Le loup-tempête<\/h2><p class="serif-note">Éclairs d’aurore et glace qui vole\.<\/p>/)
  assert.match(ultime, /<button class="btn btn-primary">Le porter<\/button>/)
  assert.match(ultime, /Elle s’ajoute à ses formes, sans rien remplacer/)
  // Plus jeune : ses paillettes, et ce que sa forme ultime lui réserve.
  const jeune = await carte('cp:tortue-jeune')
  assert.doesNotMatch(jeune, /fin-legendaire|Le porter/)
  assert.match(jeune, /Dès sa forme ultime, l’Éclat lui ouvre sa métamorphose\s: l’île en fleurs\./)
  // Un emoji, un légendaire : rien de cela.
  for (const cle of ['🦊', 'lg:phenix']) assert.doesNotMatch(await carte(cle), /métamorphose/, cle)
})

// ── 4. Ce que le serveur envoie ───────────────────────────────────────────

let instant = 1_000
function reponse(playerId: string, points: number, extra: Partial<AnswerRow> = {}): AnswerRow {
  return {
    sessionId: 's1',
    quizTitle: 'Quiz',
    qIndex: 0,
    kind: 'choice',
    playerId,
    answered: true,
    correct: points > 0,
    choice: points > 0 ? 0 : 1,
    value: null,
    target: null,
    ms: 5_000,
    changes: 0,
    points,
    durationMs: 20_000,
    observed: false,
    createdAt: ++instant,
    ...extra,
  }
}

function joueur(id: string, name: string, avatar: string, extra: Partial<PublicPlayer> = {}): PublicPlayer {
  return { id, name, avatar, connected: false, score: 0, teamId: null, ...extra }
}

test('le souvenir, ses chiffres et ses prix recopient ce que chacun porte — l’emoji pour qui joue sans profil', () => {
  // Jeanne porte le Phénix, en Or, dans l'équipe A ; Bob, sans profil, dans la B, gagne.
  const jeanne = joueur('jeanne', 'Jeanne', '🦊', { score: 400, teamId: 'a', finition: 'or', legendaire: 'lg:phenix' })
  const bob = joueur('bob', 'Bob', '🐻', { score: 500, teamId: 'b' })
  const answers = [reponse('jeanne', 300), reponse('jeanne', 100, { qIndex: 1 }), reponse('bob', 500, { qIndex: 2 })]
  const scores = answers.map(r => ({ playerId: r.playerId, sessionId: 's1', points: r.points, reason: `Quiz « Quiz » — Q${r.qIndex + 1}`, createdAt: r.createdAt }))
  const recap = buildRecap({ players: [jeanne, bob], teams: [], bonuses: [], scores, answers })
  const porte = { finition: 'or', legendaire: 'lg:phenix' }
  assert.deepEqual(recap.steadiest, { name: 'Jeanne', avatar: '🦊', ...porte, count: 2 }, 'le plus régulier : son Phénix')
  assert.deepEqual(recap.bestShot, { name: 'Bob', avatar: '🐻', points: 500, reason: 'Quiz « Quiz » — Q3' }, 'Bob, sans profil : son emoji, rien de plus')
  assert.deepEqual(recap.quizWinners, [{ title: 'Quiz', name: 'Bob', avatar: '🐻', points: 500, sessionId: 's1' }])

  const stats = computeStats(answers, [jeanne, bob])
  const sienne = stats.players.find(s => s.playerId === 'jeanne')!
  assert.deepEqual([sienne.finition, sienne.legendaire], ['or', 'lg:phenix'], '« Les chiffres » : sa ligne')
  // Chaque lauréat d'un prix porte ce que sa ligne porte.
  const laureats = stats.awards.filter(a => a.player)
  assert.ok(laureats.length > 0)
  for (const a of laureats) {
    const s = stats.players.find(x => x.playerId === a.player!.playerId)!
    assert.equal(a.player!.legendaire, s.legendaire, a.key)
  }
  // Le Coup de Pouce l'écrit en toutes lettres : son emoji seulement s'il le porte.
  assert.equal(stats.awards.find(a => a.key === 'coupdepouce')?.detail, 'Jeanne ferme la marche avec 400 points')
  const sansLui = computeStats(answers, [{ ...jeanne, legendaire: undefined }, bob])
  assert.equal(sansLui.awards.find(a => a.key === 'coupdepouce')?.detail, '🦊 Jeanne ferme la marche avec 400 points')
})

test('en soirée : la régie, le panneau des absents et les candidats de « Qui dans la salle ? » montrent ce que chacun porte', async () => {
  await dessins()
  const h = horloge()
  // Léa joue avec son profil, le Phénix au cou ; Hugo, sans.
  const s = salle([{ id: 'q', title: 'Sondage', questions: [sondage('Qui ?')] }], {
    badgeOf: profileId => (profileId === 'profil-lea' ? { niveau: 14, finition: 'or', eclat: false, legendaire: 'lg:phenix' } : undefined),
  })
  try {
    const lea = s.inscrire('Léa', '🦊')
    s.party.bindProfile(lea, 'profil-lea')
    s.inscrire('Hugo', '🐻')
    s.lancer(h.avancer)
    // Les candidats, au même rang que leur emoji : rien pour qui ne porte rien.
    const vue = s.vueDe('Hugo')!
    const i = s.st.candidats.indexOf(lea)
    assert.deepEqual(vue.apparences?.[i], { finition: 'or', legendaire: 'lg:phenix' })
    assert.deepEqual(vue.apparences?.[1 - i], {})
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { QuizPlayer } = await import(url('games/quiz/PlayerView.tsx'))
    const telephone = renderToStaticMarkup(React.createElement(QuizPlayer, { view: vue, send: () => {}, teams: [], myTeamId: null }))
    const boutons = [...telephone.matchAll(/<button[^>]*sondage-btn[^>]*>(.*?)<\/button>/gs)].map(m => m[1])
    assert.ok(boutons[i].includes('av-legendaire') && !boutons[i].includes('🦊'), 'le bouton de Léa : son Phénix')
    assert.ok(boutons[1 - i].includes('🐻'))
    // La régie attend Léa : son Phénix, que le panneau des absents recopie.
    const attendue = s.vueHote()!.attendus!.find(a => a.playerId === lea)
    assert.deepEqual([attendue?.avatar, attendue?.finition, attendue?.legendaire], ['🦊', 'or', 'lg:phenix'])
    const absents = readFileSync(new URL('../../client/src/components/Absents.tsx', import.meta.url), 'utf8')
    assert.match(absents, /<Avatar avatar=\{l\.avatar\} finition=\{l\.finition\} legendaire=\{l\.legendaire\} eclat=\{l\.eclat\} \/>/)
    assert.match(absents, /\.\.\.apparenceDeLAvatar\(a\),/, 'les attendus de la question')
    assert.match(absents, /\.\.\.apparenceDeLAvatar\(p\), horsLigne: true/, 'les autres hors ligne')
  } finally {
    s.fermer()
    h.arreter()
  }
})

/** Un dossier jetable, effacé quoi qu'il arrive. */
async function dansUnDossier(fn: (dir: string) => Promise<void>) {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-un-seul-avatar-'))
  try {
    await fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('l’historique montre ses vainqueurs tels qu’ils se montrent aujourd’hui — les fiches d’avant aussi, relues une fois dans leur archive', async () => {
  await dansUnDossier(async dir => {
    const base = `file:${path.join(dir, 'permanente.db')}`
    const store = new ArchiveStore(base)
    await store.init('espace')
    const brut = createClient({ url: base })
    try {
      // Jeanne, à profil, gagne ; Bob joue sans.
      const archive: PartyArchive = {
        version: 1,
        players: [
          { id: 'jeanne', name: 'Jeanne', avatar: '🦊', teamId: null, profileId: 'profil-jeanne', createdAt: 1 },
          { id: 'bob', name: 'Bob', avatar: '🐻', teamId: null, profileId: null, createdAt: 2 },
        ],
        teams: [],
        bonuses: [],
        scores: [
          { playerId: 'jeanne', sessionId: 's1', points: 300, reason: 'Quiz « Quiz » — Q1', createdAt: 10 },
          { playerId: 'bob', sessionId: 's1', points: 100, reason: 'Quiz « Quiz » — Q1', createdAt: 11 },
        ],
        answers: [reponse('jeanne', 300), reponse('bob', 100)],
        packs: {},
      }
      await store.save('espace', 'soiree-1', 1, archive, 'Chez Jeanne')
      const demandes: string[][] = []
      const apparencesDe = async (ids: readonly string[]) => {
        demandes.push([...ids])
        return (profileId: string): ProfileBadge | undefined =>
          profileId === 'profil-jeanne' ? { niveau: 14, finition: 'or', eclat: false, legendaire: 'lg:phenix', laurier: 1 } : undefined
      }
      const attendu = [{ name: 'Jeanne', avatar: '🦊', finition: 'or', legendaire: 'lg:phenix', points: 300 }]
      assert.deepEqual((await store.list('espace', apparencesDe))[0].winners, attendu, 'le Phénix, pas le renard — ni le laurier, qui dirait « hier »')
      assert.deepEqual(demandes, [['profil-jeanne']], 'seuls ses vainqueurs se lisent')
      // Sans lecteur de profils — l'export —, l'emoji, comme avant.
      assert.deepEqual((await store.list('espace'))[0].winners, [{ name: 'Jeanne', avatar: '🦊', points: 300 }])

      // Une fiche d'avant le 14 octobre : ni profils, ni marque. La liste les
      // relit dans l'archive même, une fois, et réécrit la fiche.
      const lire = async () => JSON.parse(String((await brut.execute("SELECT summary FROM soirees WHERE id = 'soiree-1'")).rows[0].summary))
      const fiche = await lire()
      delete fiche.profils
      for (const i of fiche.invites) delete i.profileId
      await brut.execute({ sql: "UPDATE soirees SET summary = ? WHERE id = 'soiree-1'", args: [JSON.stringify(fiche)] })
      assert.deepEqual((await store.list('espace', apparencesDe))[0].winners, attendu, 'retrouvée dans son archive')
      const reecrite = await lire()
      assert.equal(reecrite.profils, true)
      assert.deepEqual(
        reecrite.invites.map((i: { id: string; profileId?: string }) => [i.id, i.profileId ?? null]),
        [
          ['jeanne', 'profil-jeanne'],
          ['bob', null],
        ],
      )

      // Une archive illisible ne fait pas tomber la liste : ses vainqueurs gardent leur emoji.
      for (const i of fiche.invites) delete i.profileId
      await brut.batch(
        [{ sql: "UPDATE soirees SET summary = ? WHERE id = 'soiree-1'", args: [JSON.stringify(fiche)] }, "UPDATE soirees SET data = 'illisible'"],
        'write',
      )
      assert.deepEqual((await store.list('espace', apparencesDe))[0].winners, [{ name: 'Jeanne', avatar: '🦊', points: 300 }])
    } finally {
      brut.close()
      store.close()
    }
  })
})

// ── 5. Plus un seul écran pour l'oublier ──────────────────────────────────

/** Tous les composants du client, par leur chemin depuis `client/src`. */
function composants(dossier = ''): string[] {
  const ici = path.join(new URL('../../client/src/', import.meta.url).pathname, dossier)
  return readdirSync(ici, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? composants(path.join(dossier, e.name)) : e.name.endsWith('.tsx') ? [path.join(dossier, e.name)] : [],
  )
}

test('aucun écran ne dessine plus un joueur par son seul emoji', () => {
  // Les pages de l'administrateur qui reconnaissent un profil gardent son
  // emoji enregistré, tel quel (« on reconnaît quelqu'un, on ne regarde pas
  // la salle », `ProfilDAdministration.avatar`) ; « Tous les liens » écrit
  // un texte à coller, l'emoji seulement à qui le porte ; la place reprise
  // par un code n'est jamais celle d'un profil.
  const permis = new Set([
    'components/AdminProfils.tsx',
    'components/AdminDuJour.tsx',
    'components/AdminSalons.tsx',
    'components/QgFicheJoueur.tsx',
    'views/BilanApp.tsx',
    'views/PlayerApp.tsx',
  ])
  const fautes: string[] = []
  for (const fichier of composants()) {
    const texte = readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')
    // Un `<Avatar avatar={x.avatar} … />` dit aussi ce qu'il porte à sa place.
    for (const m of texte.matchAll(/<Avatar\b(.*?)\/>/gs)) {
      if (/avatar=\{[^}]*\.avatar\}/.test(m[1]) && !/legendaire=|\{\.\.\./.test(m[1])) fautes.push(`${fichier} : ${m[0].replace(/\s+/g, ' ')}`)
    }
    // Un emoji d'avatar écrit en texte : `{x.avatar}`, `${x.avatar}`.
    if (permis.has(fichier)) continue
    for (const m of texte.matchAll(/(?<!=)\{[\w.?!]+\.avatar\}|\$\{[\w.?!]+\.avatar\}/g)) fautes.push(`${fichier} : ${m[0]}`)
  }
  assert.deepEqual(fautes, [])
})
