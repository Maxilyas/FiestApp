// Ce que les listes du QG coûtent à la base permanente. Le 17 octobre 2026,
// la seule erreur serveur d'une heure de production : `GET
// /api/admin/espaces`, dans l'heure du seul aller-retour vers Turso tombé en
// route (`qg_sante`, `connexions.echecs`). « Les salons » comptait les quiz de
// chaque espace d'un aller-retour chacun, « Les profils » ceux de chaque
// salon — vingt-quatre espaces, près de cinquante allers-retours partis
// ensemble à chaque ouverture du QG et à chaque retour d'une page. Une
// rafale prend toutes les connexions libres, la plus ancienne comprise,
// celle que Turso referme à 5 s (règle `journaux-et-miroir.md`), et un seul
// aller-retour tombé faisait répondre 500 à toute la liste. On compte sur le
// fichier `file:` qui tient lieu de Turso, comme `profil-charge.test.ts` :
// rien ne dépend de la charge de la machine.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { baseDEssai, connexionAnimateur, cookieDe, creerQuiz, demarrer, ecrire, inscrireProfil, qcm, type Banc } from './banc'
import type { EspaceDAdministration } from '../../shared/space'
import type { ProfilDAdministration } from '../../shared/profil'

// ── Le compteur ───────────────────────────────────────────────────────────

/** Ce que la base permanente a servi pendant une mesure : un aller-retour par `execute` ou `batch`, et chacune de ses instructions. */
const compte = { actif: false, allersRetours: 0, instructions: [] as string[] }

const sqlDe = (s: unknown) => (typeof s === 'string' ? s : (s as { sql: string }).sql).replace(/\s+/g, ' ').trim()

const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = function (this: unknown, ...args: unknown[]) {
    if (compte.actif) {
      compte.allersRetours++
      for (const s of methode === 'batch' ? (args[0] as unknown[]) : [args[0]]) compte.instructions.push(sqlDe(s))
    }
    return origine.apply(this, args)
  }
}

async function mesurer<T>(travail: () => Promise<T>): Promise<{ allersRetours: number; lecturesDesQuiz: number; resultat: T }> {
  Object.assign(compte, { actif: true, allersRetours: 0, instructions: [] })
  try {
    const resultat = await travail()
    return { allersRetours: compte.allersRetours, lecturesDesQuiz: compte.instructions.filter(sql => /\bFROM quizzes\b/.test(sql)).length, resultat }
  } finally {
    compte.actif = false
  }
}

// ── Huit salons, et l'espace de l'administrateur ──────────────────────────

const SALONS = 8
let banc: Banc
let admin: string

const lire = async <T>(chemin: string): Promise<T> => {
  const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: admin } })
  const lu = (await r.json()) as T & { error?: string }
  assert.equal(r.status, 200, `${chemin} : ${r.status} ${lu.error ?? ''}`)
  return lu
}

before(async () => {
  // Le préchauffage de la campagne lit la base : loin des mesures.
  banc = await demarrer({ baseDeLaCampagne: baseDEssai(10), prechauffageCampagneMs: 3_600_000 })
  admin = await connexionAnimateur(banc.url)
  for (let i = 0; i < SALONS; i++) {
    const joueur = await inscrireProfil(banc.url, `salon${i}`, `Joueur ${i}`)
    const console_ = cookieDe(await ecrire(banc.url, '/api/joueur/espace', {}, joueur))
    // Le premier salon a deux quiz, les autres aucun : chacun garde son compte.
    if (i === 0) for (const titre of ['Le premier', 'Le second']) await creerQuiz(banc.url, console_, [qcm('Un ?')], titre)
  }
  // Au réveil, comme en production : les titulaires ne sont plus en mémoire,
  // et rien de la mise en place n'est encore en vol.
  await banc.redemarrer()
})

after(() => banc.close())

test('« Les salons » comptent les quiz de tous les espaces d’une seule lecture, pas d’un aller-retour par espace', async () => {
  const { allersRetours, lecturesDesQuiz, resultat: espaces } = await mesurer(() => lire<EspaceDAdministration[]>('/api/admin/espaces'))
  assert.equal(espaces.length, SALONS + 1, 'les huit salons, et l’espace de l’administrateur')
  assert.equal(lecturesDesQuiz, 1, 'une seule lecture des quiz, quel que soit le nombre d’espaces')
  assert.ok(allersRetours <= 2, `les titulaires d’un aller-retour, les quiz d’un autre — ${allersRetours}`)

  const salons = espaces.filter(e => e.salon)
  assert.equal(salons.length, SALONS)
  assert.deepEqual(
    salons.map(e => [e.titulaire?.nom, e.quiz]).sort(),
    Array.from({ length: SALONS }, (_, i) => [`Joueur ${i}`, i === 0 ? 2 : 0]).sort(),
    'chaque salon, son titulaire et ses quiz',
  )
  const sien = espaces.find(e => e.toi)
  assert.ok(sien, 'l’espace de l’administrateur, marqué')
  assert.equal(sien.quiz, (await lire<unknown[]>('/api/quizzes')).length, 'ses quiz, ceux de sa bibliothèque')
})

test('« Les profils » de même : les quiz de leurs salons, d’une seule lecture', async () => {
  const { allersRetours, lecturesDesQuiz, resultat } = await mesurer(() => lire<{ total: number; profils: ProfilDAdministration[] }>('/api/admin/profils'))
  const avecSalon = resultat.profils.filter(p => p.salon)
  assert.equal(avecSalon.length, SALONS)
  assert.equal(lecturesDesQuiz, 1, 'une seule lecture des quiz, quel que soit le nombre de salons')
  assert.ok(allersRetours <= 4, `la page, les soirées, les profils et les quiz — ${allersRetours}`)
  assert.deepEqual(
    avecSalon.map(p => [p.login, p.salon?.quiz]).sort(),
    Array.from({ length: SALONS }, (_, i) => [`salon${i}`, i === 0 ? 2 : 0]).sort(),
    'chaque salon, ses quiz',
  )

  // La fiche d'un joueur dit les mêmes.
  const premier = avecSalon.find(p => p.login === 'salon0')!
  const fiche = await lire<ProfilDAdministration>(`/api/admin/profils/${premier.id}`)
  assert.equal(fiche.salon?.quiz, 2, 'sa fiche compte ses deux quiz')
})
