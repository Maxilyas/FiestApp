// Phase « après » de l'épreuve de migration : le code d'aujourd'hui (b57035c)
// démarre sur la base que le code d'avant #58 a fabriquée (`phase-avant.ts`),
// une soirée en cours au milieu d'une question — deux fois : disque gardé
// (un PC, un redémarrage sans effacement), puis disque effacé (Render, à
// chaque réveil) où tout repart du miroir écrit par l'ancien code.
//
// Ce qu'on vérifie : il démarre ; chaque profil garde son expérience, son
// niveau, son étagère, ses légendaires ; la partie reprend là où elle en
// était ; la clôture ne dédouble ni l'archive ni l'expérience (invariants 10,
// 11, 13) ; et le quiz du jour s'installe à côté sans rien toucher.
//
//   cd server && nice -n 10 node --import tsx ../export/evaluations/persistance/migration/phase-avant.ts ../export/evaluations/persistance/migration/base-avant
//   cd server && nice -n 10 node --import tsx --test --test-timeout=240000 ../export/evaluations/persistance/migration/apres.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { createQuizServer } from '../../../../server/src/server'
import { ProfileStore } from '../../../../server/src/auth/profiles'
import {
  ADMIN,
  attendre,
  clore,
  comptes,
  connecter,
  emitAck,
  fermerTout,
  invite,
  lire,
  lireJson,
  patienter,
  type Invite,
  type Socket,
} from '../outils'

ProfileStore.tirageEclat = () => false

const BASE = path.join(import.meta.dirname, 'base-avant')
const avant = JSON.parse(readFileSync(path.join(BASE, 'avant.json'), 'utf8'))

/** Ce qu'un profil dit de lui-même, réduit à ce qui ne doit pas bouger d'une version à l'autre. */
const essentiel = (p: any) => ({
  xp: p.xp,
  niveau: p.niveau,
  badges: p.badges,
  legendaires: p.legendaires,
  eclats: p.eclats,
  soirees: (p.soirees ?? []).map((s: any) => [s.soireeId ?? s.id, s.xp]),
})

/** Pilote la partie en cours jusqu'à son podium, quelle que soit la phase où le réveil l'a laissée. */
async function finirLaPartie(host: Socket, sessionId: string, vue: any, joueurs: Invite[]) {
  const prochaine = (pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 30_000)
  for (let tour = 0; tour < 40 && vue.phase !== 'finished'; tour++) {
    if (vue.phase === 'question') {
      const revelee = prochaine(v => v.phase === 'reveal' && v.qIndex === vue.qIndex, `révélation ${vue.qIndex + 1}`)
      for (const j of joueurs) {
        await emitAck<any>(j.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } }).catch(() => null)
      }
      ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
      vue = (await revelee).view
    } else {
      const q = vue.qIndex
      const suite = prochaine(v => v.phase === 'finished' || (v.qIndex ?? -1) > q || (v.phase !== vue.phase && v.phase !== 'reveal'), `après ${q + 1}`)
      ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
      vue = (await suite).view
    }
  }
  assert.equal(vue.phase, 'finished', 'la partie reprise va jusqu’à son podium')
  ;(host as any).emit('host:endSession', { sessionId })
}

async function migrer(nom: string, disqueEfface: boolean) {
  const dir = path.join(import.meta.dirname, `apres-${nom}`)
  rmSync(dir, { recursive: true, force: true })
  cpSync(BASE, dir, { recursive: true })
  if (disqueEfface) for (const s of ['', '-wal', '-shm']) rmSync(path.join(dir, `locale.db${s}`), { force: true })
  const dbPath = path.join(dir, 'locale.db')
  const permanente = path.join(dir, 'permanente.db')
  const journal: string[] = []
  const origines = { log: console.log, warn: console.warn, error: console.error }
  for (const k of ['log', 'warn', 'error'] as const) {
    console[k] = (...a: unknown[]) => {
      journal.push(`[${k}] ${a.map(x => (typeof x === 'string' ? x : x instanceof Error ? x.stack : JSON.stringify(x))).join(' ')}`)
      origines[k](...a)
    }
  }
  const debut = Date.now()
  const server = await createQuizServer({ port: 0, dbPath, quizDbUrl: `file:${permanente}`, admin: ADMIN })
  const demarrage = Date.now() - debut
  const url = `http://localhost:${server.port}`
  return { dir, dbPath, permanente, server, url, journal, demarrage, restaurer: () => Object.assign(console, origines) }
}

for (const [nom, disqueEfface] of [
  ['disque-garde', false],
  ['disque-efface', true],
] as const) {
  test(`migration a6fc98b → b57035c, ${nom} : rien ne se perd, rien ne se dédouble`, async () => {
    const m = await migrer(nom, disqueEfface)
    try {
      console.log(`\n[${nom}] démarré en ${m.demarrage} ms`)
      assert.ok(!m.journal.some(l => l.startsWith('[error]')), `aucune erreur au démarrage :\n${m.journal.join('\n')}`)

      // 1. Chaque profil se relit tel que l'ancien code le montrait.
      for (const [cle, p] of Object.entries<any>(avant.profils)) {
        const { status, corps } = await lireJson(m.url, '/api/joueur/moi', p.cookie)
        assert.equal(status, 200)
        assert.ok(corps.profile, `${cle} est toujours connecté (sa session a survécu)`)
        assert.deepEqual(essentiel(corps.profile), essentiel(avant.vus[cle].profile), `${cle} : ce que sa page dit de lui`)
        if (corps.profile.avatar !== avant.vus[cle].profile.avatar) {
          console.log(`[${nom}] ${cle} : avatar ${avant.vus[cle].profile.avatar} → ${corps.profile.avatar} (niveau ${corps.profile.niveau})`)
        }
      }

      // 1 bis. La soirée rangée par l'ancien code se relit : liste, souvenir, bilan, cartes.
      const liste = (await lireJson(m.url, `/s/${ADMIN.slug}/soirees.json`)).corps
      const vieille = avant.soirees.archives[0]
      const relue = liste.archives.find((a: any) => a.id === vieille.id)
      assert.ok(relue, 'la soirée close par l’ancien code est dans l’historique')
      assert.deepEqual(
        { players: relue.players, questions: relue.questions, winners: relue.winners },
        { players: vieille.players, questions: vieille.questions, winners: vieille.winners },
        'sa fiche dit la même chose',
      )
      for (const page of ['recap', 'bilan']) {
        const r = await lireJson(m.url, `/s/${ADMIN.slug}/soirees/${vieille.id}/${page}.json`)
        assert.equal(r.status, 200, `${page} de la soirée d’avant : ${JSON.stringify(r.corps).slice(0, 200)}`)
      }
      for (const [cle, j] of Object.entries<any>(avant.jetons)) {
        const r = await lireJson(m.url, `/s/${ADMIN.slug}/joueurs/${j.playerId}.json`)
        assert.equal(r.status, 200, `la carte de ${cle}`)
      }

      // 2. La soirée en cours reprend : l'écran commun, puis chaque téléphone par son jeton.
      const host = connecter(m.url, avant.cookie)
      const premiereVue = attendre<any>(host, 'session:view', p => p.sessionId === avant.enCours, 'la partie reprise', 20_000)
      const hello = await emitAck<any>(host, 'host:hello', {})
      assert.equal(hello.ok, true)
      const vue = (await premiereVue).view
      console.log(`[${nom}] la partie reprend en phase ${vue.phase}, question ${vue.qIndex + 1}`)
      const joueurs: Invite[] = []
      for (const [cle, j] of Object.entries<any>(avant.jetons)) {
        const p = avant.profils[cle]
        joueurs.push(await invite(m.url, j.nom, '🎉', { token: j.token, ...(p && { cookie: p.cookie }) }))
      }
      assert.deepEqual(
        joueurs.map(j => j.playerId),
        Object.values<any>(avant.jetons).map(j => j.playerId),
        'chaque téléphone retrouve SA fiche',
      )
      await finirLaPartie(host, avant.enCours, vue, joueurs)
      await patienter(800)
      const toast = await clore(host, 'La soirée du déploiement')
      assert.equal(toast.kind, 'info', `la clôture passe : ${toast.message}`)
      await patienter(500)

      // 3. Ni archive ni expérience en double (invariants 10 et 11).
      const archives = lire<any>(m.permanente, 'SELECT id, title FROM soirees ORDER BY held_at')
      console.log(`[${nom}] archives :`, archives)
      assert.equal(archives.length, 2, 'deux soirées, pas trois : la soirée reprise garde son nom')
      assert.equal(archives[1].id, avant.soirees.current.id, 'la soirée reprise se range sous le nom tiré par l’ancien code')
      const lignes = lire<any>(m.permanente, "SELECT profile_id, soiree_id, xp FROM profile_xp WHERE soiree_id NOT LIKE '#%' ORDER BY profile_id, soiree_id")
      const parProfil = new Map<string, string[]>()
      for (const l of lignes) parProfil.set(l.profile_id, [...(parProfil.get(l.profile_id) ?? []), l.soiree_id])
      for (const [profil, soirees] of parProfil) {
        assert.deepEqual(soirees, archives.map(a => a.id).sort(), `une ligne par soirée pour ${profil}`)
      }
      const totaux = lire<any>(
        m.permanente,
        'SELECT p.id, p.xp, (SELECT COALESCE(SUM(xp), 0) FROM profile_xp WHERE profile_id = p.id) AS somme FROM profiles p',
      )
      for (const t of totaux) assert.equal(t.xp, t.somme, `le total de ${t.id} est la somme de ses lignes`)

      // 4. Le miroir est vide après la clôture, et le quiz du jour s'est installé.
      const apres = comptes(m.permanente)
      console.log(`[${nom}] base permanente après la clôture :`, apres)
      for (const t of ['party_players', 'party_answers', 'party_scores', 'party_sessions', 'party_soiree']) {
        assert.equal(apres[t], 0, `${t} vidée par la clôture`)
      }
      assert.ok(apres.jour_reserve > 0, 'la réserve du quiz du jour est amorcée')
      host.close()
    } finally {
      fermerTout()
      await m.server.close()
      m.restaurer()
    }
  })
}
