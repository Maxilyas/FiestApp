// La carte d'un joueur qui ne joue qu'en solo (l'experte du jeu solo, le 11
// octobre 2026, constat 9) : ouverte depuis le classement du défi de la
// semaine, elle disait « Soirées 0 · Quiz gagnés 0 · Coup d'œil — · Réflexe
// — », des mesures de soirée qu'il n'a jamais prises. Elle porte maintenant sa
// campagne — son record, ses bonnes réponses, ses paliers —, et sans soirée,
// ses cadrans sont ceux-là.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import React from 'react'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import type { CarteDeJoueur } from '../../shared/carte'

Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/', search: '', hash: '', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
})
const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)

const lire = async (banc: Banc, cookie: string, chemin: string) => {
  const r = await fetch(`${banc.url}${chemin}`, { headers: { cookie, 'X-Requested-With': 'fiestapp' } })
  return { status: r.status, corps: (await r.json().catch(() => null)) as any }
}

/** Joue une série par l'API : `justes[i]` dit si la i-ième est juste ; elle finit à la troisième faute. */
async function jouerUneSerie(banc: Banc, cookie: string, justes: boolean[]) {
  const { id } = (await (await ecrire(banc.url, '/api/campagne/serie', {}, cookie)).json()) as { id: string }
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
  const questions = JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(id) as { questions: string }).questions) as { bonne: number; reponses: string[] }[]
  db.close()
  for (let i = 0; i < justes.length; i++) {
    const q = questions[i]
    const r = (await (await ecrire(banc.url, `/api/campagne/serie/${id}/reponse`, { index: i, choix: justes[i] ? q.bonne : (q.bonne + 1) % q.reponses.length }, cookie)).json()) as { finie?: boolean }
    if (r.finie) return
  }
}

test('la carte porte sa campagne : son record, ses bonnes réponses, ses paliers — rien pour qui n’y a pas joué', async () => {
  const banc = await demarrer({ baseDeLaCampagne: baseDEssai(60) })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    await jouerUneSerie(banc, lea, [true, true, true, true, false, false, false])
    const idDe = async (cookie: string) => (await lire(banc, cookie, '/api/joueur/moi')).corps.profile.id as string
    const deLea = await lire(banc, tom, `/api/joueur/carte/${await idDe(lea)}`)
    assert.equal(deLea.status, 200)
    assert.deepEqual(deLea.corps.profil.campagne, { record: 4, justes: 4, paliers: 0 })
    assert.equal(deLea.corps.profil.fiche.soirees, 0)
    // Tom n'a rien gagné en campagne : l'absence, pas « 0 ».
    const deTom = await lire(banc, lea, `/api/joueur/carte/${await idDe(tom)}`)
    assert.equal('campagne' in deTom.corps.profil, false)
  } finally {
    await banc.close()
  }
})

/** Un profil de carte, sans rien : on règle ce que le test regarde. */
const profil = (fiche: Partial<NonNullable<CarteDeJoueur['profil']>['fiche']>, plus: Partial<NonNullable<CarteDeJoueur['profil']>> = {}): NonNullable<CarteDeJoueur['profil']> => ({
  prenom: 'Léa',
  niveau: 3,
  legendaires: [],
  divins: [],
  vitrine: [],
  hautsFaits: 2,
  fiche: { soirees: 0, precision: 0.75, qcm: 40, justes: 30, coupDOeil: null, estimationsComparees: 0, reflexeMoyenMs: null, quizGagnes: 0, meilleureSerie: 0, ...fiche },
  ...plus,
})

test('sans soirée, ses cadrans sont ceux du solo — ceux des soirées pour qui en a joué', async () => {
  const { cadransDeLaCarte } = await import(client('components/CarteJoueur.tsx').href)
  const titres = (p: NonNullable<CarteDeJoueur['profil']>) => (cadransDeLaCarte(p) as [string, string, string?][]).map(c => c[0])
  // Que du solo : ni « Soirées 0 », ni « Coup d'œil — », ni « Réflexe — ».
  const solo = cadransDeLaCarte(profil({}, { campagne: { record: 17, justes: 412, paliers: 1 } })) as [string, string, string?][]
  assert.deepEqual(
    solo.map(c => c[0]),
    ['Hauts faits', 'Précision', 'Record', 'Sentiers', 'Justes'],
  )
  assert.deepEqual(solo.find(c => c[0] === 'Record'), ['Record', '17', 'en série'])
  assert.deepEqual(solo.find(c => c[0] === 'Sentiers'), ['Sentiers', '1', 'palier validé'])
  assert.deepEqual((cadransDeLaCarte(profil({}, { campagne: { record: 3, justes: 9, paliers: 4 } })) as string[][]).find(c => c[0] === 'Sentiers'), ['Sentiers', '4', 'paliers validés'])
  // Que des séries : pas de « Sentiers 0 », un zéro de plus.
  assert.deepEqual(titres(profil({}, { campagne: { record: 6, justes: 9, paliers: 0 } })), ['Hauts faits', 'Précision', 'Record', 'Justes'])
  // Ni soirée ni campagne : ce qu'il a, rien qui dise ce qui lui manque.
  assert.deepEqual(titres(profil({})), ['Hauts faits', 'Précision'])
  // Des soirées : leurs cadrans, comme avant — la campagne passe en pastille.
  assert.deepEqual(titres(profil({ soirees: 4, quizGagnes: 2, reflexeMoyenMs: 4200 }, { campagne: { record: 17, justes: 412, paliers: 1 } })), [
    'Soirées',
    'Quiz gagnés',
    'Hauts faits',
    'Précision',
    'Coup d’œil',
    'Réflexe',
  ])
  const carte = readFileSync(client('components/CarteJoueur.tsx'), 'utf8')
  assert.match(carte, /\{p\.campagne && p\.fiche\.soirees > 0 && \(/, 'la pastille de la campagne, sous les cadrans des soirées')
  // Le glossaire ne dit que les mots que la carte montre.
  assert.match(carte, /mots\.push\('precision', \.\.\.\(p\.fiche\.soirees > 0 \? \(\['coupDOeil', 'reflexe'\] as const\) : \[\]\)\)/)
})
