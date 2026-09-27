// Le laurier à minuit, dans dix salles ouvertes de trente invités : ce que
// sa pose coûte en instantanés et en octets, et à qui. Alice a gagné le quiz
// du jour de la veille et joue dans la salle 0 ; Bob, second, dans la salle 5 ;
// les huit autres n'ont que des anonymes. Minuit passe, un invité arrive dans
// la salle 5 : sa diffusion (Bob a un profil) réclame les lauriers, la nuit se
// clôt en arrière-plan. Une salle sans profil ne les réclame jamais.
//
// Mesure, avec la latence de Turso simulée (50 ms) — rien n'échoue.
//   nice -n 10 node --import tsx --test --test-timeout=600000 ../export/evaluations/perf-serveur/laurier.test.ts
import { test } from 'node:test'
import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import Database from 'better-sqlite3'
import { compteur, mesurer } from './compteur'
import { ADMIN, connexionAnimateur, demarrer, ecrire, inscrireProfil, invite, patienter, type Invite } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false

/** Samedi 26 septembre 2026, 20 h à Paris. */
const SOIR = Date.UTC(2026, 8, 26, 18, 0)
const SALLES = 10
const INVITES = 30

test('le laurier à minuit dans dix salles de trente', async () => {
  const horloge = { t: SOIR }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  const sortie: Record<string, unknown> = { charge: execSync('uptime').toString().trim() }
  try {
    // Alice et Bob jouent le quiz du jour ; Alice gagne.
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const jouer = async (cookie: string, juste: boolean) => {
      let e = (await ecrire(banc.url, '/api/jour/commencer', {}, cookie).then(r => r.json())) as any
      const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
      const qs = JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(e.jour) as any).questions)
      db.close()
      while (e.question) {
        const i = e.question.index
        await ecrire(banc.url, '/api/jour/repondre', { jour: e.jour, index: i, choix: juste ? qs[i].bonne : (qs[i].bonne + 1) % qs[i].reponses.length }, cookie)
        e = await ecrire(banc.url, '/api/jour/suivante', {}, cookie).then(r => r.json())
      }
    }
    await jouer(alice, true)
    await jouer(bob, false)

    // Dix salles : la banc et neuf voisines.
    const admin = await connexionAnimateur(banc.url)
    const slugs = [ADMIN.slug]
    for (let s = 1; s < SALLES; s++) {
      const slug = `salle-${s}`
      const r = await ecrire(banc.url, '/api/admin/accounts', { login: `anim${s}`, name: `Salle ${s}`, slug }, admin)
      if (r.status !== 201) throw new Error(`salle ${s} : ${r.status}`)
      slugs.push(slug)
    }
    const salles: Invite[][] = []
    for (const [s, slug] of slugs.entries()) {
      const invites: Invite[] = []
      if (s === 0) invites.push(await invite(banc.url, 'Alice', '', { slug, cookie: alice }))
      // Bob joue ailleurs : sa salle réclame les lauriers à chaque diffusion.
      if (s === 5) invites.push(await invite(banc.url, 'Bob', '', { slug, cookie: bob }))
      while (invites.length < INVITES) invites.push(await invite(banc.url, `Invité ${s}-${invites.length}`, '🐸', { slug }))
      salles.push(invites)
    }
    await patienter(1500)

    // Ce que chaque téléphone reçoit à partir de maintenant.
    const recus = salles.map(() => ({ messages: 0, octets: 0, avecLaurier: 0 }))
    salles.forEach((invites, s) =>
      invites.forEach(i =>
        i.socket.on('party:snapshot', (snap: any) => {
          recus[s].messages++
          recus[s].octets += JSON.stringify(snap).length
          if (snap.players.some((p: any) => p.laurier)) recus[s].avecLaurier++
        }),
      ),
    )
    // La taille d'un invité à profil dans l'instantané, avec et sans laurier.
    const avant = await new Promise<any>(res => salles[0][1].socket.once('party:snapshot', res).emit('party:watch', { slug: ADMIN.slug }, () => {}))
    const aliceAvant = avant.players.find((p: any) => p.name === 'Alice')
    recus.forEach(r => Object.assign(r, { messages: 0, octets: 0, avecLaurier: 0 }))

    // Minuit passe. Un invité arrive dans la salle 5.
    horloge.t = SOIR + 4 * 3600_000 + 30_000
    const { mesure } = await mesurer(
      'minuit : une arrivée dans la salle 5, la nuit close en arrière-plan',
      async () => {
        await invite(banc.url, 'Retardataire', '🐙', { slug: slugs[5] })
        // Assez pour que la nuit se close à 50 ms l'aller-retour, et que la
        // salle d'Alice ait reçu sa rediffusion.
        for (let k = 0; k < 60 && recus[0].avecLaurier === 0; k++) await patienter(100)
        await patienter(1000)
      },
      50,
    )
    const apres = await new Promise<any>(res => salles[0][1].socket.once('party:snapshot', res).emit('party:watch', { slug: ADMIN.slug }, () => {}))
    const aliceApres = apres.players.find((p: any) => p.name === 'Alice')
    sortie.mesure = mesure
    sortie.recusParSalle = recus
    sortie.instantaneSalle0 = { octetsSansLaurier: JSON.stringify(avant).length, octetsAvecLaurier: JSON.stringify(apres).length }
    sortie.alice = { avant: aliceAvant, apres: aliceApres, octetsEnPlus: JSON.stringify(aliceApres).length - JSON.stringify(aliceAvant).length }
    console.log(JSON.stringify(sortie, null, 1))
    writeFileSync(new URL('./mesures-laurier.json', import.meta.url), JSON.stringify(sortie, null, 1))
  } finally {
    compteur.rtt = 0
    await banc.close()
  }
})
