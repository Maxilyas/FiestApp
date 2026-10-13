// Le quiz du jour au QG (`/admin#jour`, les choix du 13 octobre 2026) : le
// tirage d'aujourd'hui question par question — et l'annuler sans attendre un
// signalement —, le classement du mois et son « Masquer », les séries qui
// tiennent encore, le rappel du soir gardé soir par soir.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createECDH, randomBytes } from 'node:crypto'
import React from 'react'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, patienter, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { partDesBonnes, recueilDeLaQuestion, repartirLesSeries, type QuestionDuSuivi, type SuiviDuJour } from '../../shared/qgDuJour'

ProfileStore.tirageEclat = () => false

/** Paris, l'heure qu'on veut : septembre, deux heures devant UTC. */
const aParis = (jour: number, heure: number, minute = 0) => Date.UTC(2026, 8, jour, heure - 2, minute)
const sansInsecables = (s: string) => s.replace(/[  ]/g, ' ')

const lire = <T = any>(banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as T }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Le tirage d'un jour, lu en base : les bonnes réponses que le téléphone ne voit jamais. */
function tirage(banc: Banc, jour: string): { bonne: number; reponses: string[]; duree: number }[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    const r = db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(jour) as { questions: string } | undefined
    return r ? JSON.parse(r.questions) : []
  } finally {
    db.close()
  }
}

/**
 * Joue la partie du jour : `juste(i)` dit s'il trouve la question i ; `jusqua`
 * arrête avant la question qui porte ce numéro, servie mais pas répondue.
 */
async function jouer(banc: Banc, cookie: string, juste: (i: number) => boolean, jusqua = Infinity) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  const questions = tirage(banc, etat.jour)
  while (etat.question && etat.question.index < jusqua) {
    const i = etat.question.index
    const choix = juste(i) ? questions[i].bonne : (questions[i].bonne + 1) % questions[i].reponses.length
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  return etat
}

const suiviDe = async (banc: Banc, admin: string) => {
  const r = await lire<SuiviDuJour>(banc, admin, '/api/admin/jour/suivi')
  assert.equal(r.status, 200)
  return r.corps
}

test('les séries se rangent par longueur ; une question annulée ne compte plus, une laissée au temps compte comme une faute', () => {
  assert.deepEqual(repartirLesSeries([0, 1, 6, 7, 29, 30, 99, 100, 250]), [2, 2, 2, 2])
  assert.deepEqual(repartirLesSeries([]), [0, 0, 0, 0])
  const q = (parReponse: number[], sansReponse: number, annulee = false) => ({ parReponse, sansReponse, bonne: 0, annulee })
  assert.deepEqual(partDesBonnes([q([3, 1, 0, 0], 1), q([0, 2, 0, 0], 0), q([5, 0, 0, 0], 0, true)]), { justes: 3, sur: 7 })
  // Un choix hors des réponses ne se compte nulle part ; seuls les temps des réponses données font la moyenne.
  assert.deepEqual(
    recueilDeLaQuestion(3, [
      [0, 2, 8_000, 2],
      [2, 1, 6_000, 1],
      [null, 4, null, 0],
      [7, 1, 1_000, 1],
    ]),
    { parReponse: [2, 0, 1], sansReponse: 4, msMoyen: 4_667 },
  )
  assert.deepEqual(recueilDeLaQuestion(2, []), { parReponse: [0, 0], sansReponse: 0, msMoyen: null })
})

test('le suivi du jour : chaque réponse comptée, une question annulée sans signalement, un profil masqué du classement du mois, les séries', async () => {
  const horloge = { t: aParis(25, 10) }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const admin = await connexionAnimateur(banc.url)
    const [lea, bob, cleo] = await Promise.all([
      inscrireProfil(banc.url, 'lea', 'Léa', '🦊'),
      inscrireProfil(banc.url, 'bob', 'Bob', '🐻'),
      inscrireProfil(banc.url, 'cleo', 'Cléo', '🐝'),
    ])
    // La veille, Léa joue : demain, sa série en fera deux.
    await jouer(banc, lea, () => true)

    horloge.t = aParis(26, 10)
    const JOUR = '2026-09-26'
    let suivi = await suiviDe(banc, admin)
    assert.equal(suivi.jour, JOUR)
    assert.deepEqual(suivi.questions, [], 'personne n’a joué : rien n’est tiré')
    assert.deepEqual(suivi.parties, { commencees: 0, finies: 0 })
    assert.equal(tirage(banc, JOUR).length, 0, 'le QG ne tire pas le quiz du jour')
    assert.deepEqual(
      suivi.series.plusLongues.map(s => [s.nom, s.serie, s.tenue]),
      [['Léa', 1, false]],
      'jouée hier, la série tient jusqu’à minuit',
    )

    // Léa trouve tout, Bob rien ; Cléo répond à trois questions, la quatrième lui reste à l'écran.
    await jouer(banc, lea, () => true)
    await jouer(banc, bob, () => false)
    await jouer(banc, cleo, () => true, 3)
    // Le temps de la quatrième passe : sa demande suivante l'écrit sans réponse.
    horloge.t += (tirage(banc, JOUR)[3].duree + 10) * 1000
    await lire(banc, cleo, '/api/jour')
    assert.equal((await poster(banc, lea, '/api/jour/signaler', { jour: JOUR, index: 5, texte: 'Deux réponses justes' })).status, 200)

    suivi = await suiviDe(banc, admin)
    const questions = tirage(banc, JOUR)
    assert.equal(suivi.questions.length, 10)
    assert.deepEqual(suivi.parties, { commencees: 3, finies: 2 })
    const q0 = suivi.questions[0]
    assert.equal(q0.texte.length > 0, true)
    assert.equal(q0.bonne, questions[0].bonne)
    assert.equal(q0.parReponse[q0.bonne], 2, 'Léa et Cléo')
    assert.equal(q0.parReponse[(q0.bonne + 1) % q0.reponses.length], 1, 'Bob')
    assert.notEqual(q0.msMoyen, null)
    assert.deepEqual([suivi.questions[3].parReponse.reduce((n, x) => n + x, 0), suivi.questions[3].sansReponse], [2, 1], 'la quatrième de Cléo, laissée au temps')
    assert.equal(suivi.questions[5].signalements, 1)
    assert.deepEqual(suivi.bonnes.aujourdhui, { justes: 13, sur: 24 }, 'Léa 10, Cléo 3 — sur 10 + 10 + 4 questions posées')
    assert.deepEqual(suivi.bonnes.hier, { justes: 10, sur: 10 })

    // Annulée sans attendre un signalement : elle ne compte plus pour personne.
    assert.equal((await poster(banc, admin, '/api/admin/jour/annuler', { jour: JOUR, index: 3 })).status, 200)
    suivi = await suiviDe(banc, admin)
    assert.equal(suivi.questions[3].annulee, true)
    assert.deepEqual(suivi.bonnes.aujourdhui, { justes: 12, sur: 21 })

    // Le classement du mois, tel que les joueurs le voient ; « Masquer » l'en retire.
    assert.deepEqual(
      suivi.mois.lignes.map(l => l.nom),
      ['Léa', 'Cléo', 'Bob'],
    )
    const idBob = suivi.mois.lignes.find(l => l.nom === 'Bob')!.profileId
    assert.equal((await poster(banc, admin, '/api/admin/jour/masquer', { profileId: idBob, masque: true })).status, 200)
    suivi = await suiviDe(banc, admin)
    assert.deepEqual(
      suivi.mois.lignes.map(l => l.nom),
      ['Léa', 'Cléo'],
    )
    assert.equal(suivi.mois.masques, 1)
    assert.equal(suivi.mois.joueurs, 2)

    // Les séries se relisent toutes les dix minutes : elles bougent avec les parties, pas avec les clics.
    assert.equal(suivi.series.total, 1, 'encore celles de dix heures')
    horloge.t += 11 * 60_000
    suivi = await suiviDe(banc, admin)
    assert.deepEqual(suivi.series.parTranche, [3, 0, 0, 0])
    const [premiere, ...exAequo] = suivi.series.plusLongues.map(s => [s.nom, s.serie, s.tenue])
    assert.deepEqual(premiere, ['Léa', 2, true])
    // Bob et Cléo à égalité : leur ordre ne dit rien.
    assert.deepEqual(
      exAequo.sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      [
        ['Bob', 1, true],
        ['Cléo', 1, true],
      ],
    )
    assert.equal(suivi.series.sabliersDuMois, 0)
  } finally {
    await banc.close()
  }
})

test('le rappel du soir se garde soir par soir : un redémarrage ne l’efface plus', async () => {
  const recus: string[] = []
  const service = createServer((req, res) => {
    req.resume()
    req.on('end', () => {
      recus.push(req.url ?? '')
      res.statusCode = 201
      res.end()
    })
  })
  await new Promise<void>(resolve => service.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${(service.address() as AddressInfo).port}`
  const horloge = { t: aParis(26, 10) }
  const banc = await demarrer({
    horlogeDuJour: () => horloge.t,
    rappels: { intervalleMs: 20, servicesDePush: u => u.hostname === '127.0.0.1' },
  })
  /** La tournée de ce soir, faite par le serveur en cours, telle que `/healthz` la dit. */
  const tournee = async (jour: string) => {
    for (let essai = 0; essai < 750; essai++) {
      const sante = (await (await fetch(`${banc.url}/healthz`)).json()) as { rappels: { jour: string } | null }
      if (sante.rappels?.jour === jour) return
      await patienter(20)
    }
    throw new Error(`la tournée du ${jour} n’est pas venue`)
  }
  try {
    const admin = await connexionAnimateur(banc.url)
    const [lea, bob] = await Promise.all([inscrireProfil(banc.url, 'lea', 'Léa'), inscrireProfil(banc.url, 'bob', 'Bob')])
    for (const [cookie, nom] of [
      [lea, 'lea'],
      [bob, 'bob'],
    ] as const) {
      const ecdh = createECDH('prime256v1')
      ecdh.generateKeys()
      const abonnement = { endpoint: `${url}/push/${nom}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } }
      assert.equal((await ecrire(banc.url, '/api/jour/rappel', { abonnement }, cookie)).status, 200)
    }
    // Bob a fini sa partie : rien à lui rappeler.
    await jouer(banc, bob, () => true)
    let suivi = await suiviDe(banc, admin)
    assert.deepEqual([suivi.rappel.telephones, suivi.rappel.profils, suivi.rappel.tournees], [2, 2, []])

    horloge.t = aParis(26, 18, 5)
    await tournee('2026-09-26')
    const ceSoir = { jour: '2026-09-26', envoyes: 1, finis: 1, retires: 0, echecs: 0 }
    // L'écriture du bilan suit la tournée : on la laisse arriver.
    for (let essai = 0; essai < 100 && (await suiviDe(banc, admin)).rappel.tournees.length === 0; essai++) await patienter(20)
    suivi = await suiviDe(banc, admin)
    assert.deepEqual(suivi.rappel.tournees, [ceSoir])
    assert.deepEqual(recus, ['/push/lea'])

    // Réveillé dans la soirée, le serveur refait sa tournée : Léa est déjà servie, Bob a toujours fini.
    await banc.redemarrer()
    await tournee('2026-09-26')
    await patienter(100)
    const admin2 = await connexionAnimateur(banc.url)
    assert.deepEqual((await suiviDe(banc, admin2)).rappel.tournees, [ceSoir], 'ni effacé par le réveil, ni compté deux fois')
    assert.deepEqual(recus, ['/push/lea'])
  } finally {
    await banc.close()
    await new Promise<void>(resolve => service.close(() => resolve()))
  }
})

test('la page lit le tirage, le classement, les séries et le rappel sans rien laisser deviner du reste', async () => {
  Object.assign(globalThis, { React, window: { location: { pathname: '/admin', search: '', hash: '#jour', origin: 'http://banc' } } })
  const { AujourdhuiDuJour, QuestionsDuJour, ClassementDuMoisAuQg, SeriesDuJourAuQg, RappelDuSoirAuQg } = await import(
    new URL('../../client/src/components/QgDuJour.tsx', import.meta.url).href
  )
  const { renderToStaticMarkup } = await import('react-dom/server')
  const rendre = (composant: unknown, props: object) => sansInsecables(renderToStaticMarkup(React.createElement(composant as never, props)).replace(/<!-- -->/g, ''))
  const question = (index: number, texte: string, parReponse: number[], extra: Partial<QuestionDuSuivi> = {}): QuestionDuSuivi => ({
    index,
    reserveId: `r${index}`,
    texte,
    categorie: 'Histoire',
    reponses: ['1997', '1998', '2001', '1995'],
    bonne: 0,
    parReponse,
    sansReponse: 0,
    msMoyen: 11_000,
    annulee: false,
    signalements: 0,
    ...extra,
  })
  const suivi: SuiviDuJour = {
    maintenant: aParis(13, 21),
    jour: '2026-09-13',
    parties: { commencees: 118, finies: 109 },
    bonnes: { aujourdhui: { justes: 600, sur: 1000 }, hier: { justes: 58, sur: 100 } },
    questions: [
      question(0, 'Quelle est la capitale de l’Australie ?', [81, 10, 5, 4]),
      question(3, 'En quelle année est sorti le premier Harry Potter ?', [38, 41, 14, 7], { signalements: 3 }),
      question(4, 'Quel est le symbole chimique de l’or ?', [66, 34, 0, 0], { annulee: true }),
    ],
    mois: {
      mois: '2026-09',
      joueurs: 312,
      lignes: [{ profileId: 'h', nom: 'Hugo', avatar: '🦁', niveau: 12, finition: null, points: 2140, rang: 1 } as never],
      masques: 1,
    },
    series: { parTranche: [48, 31, 9, 2], total: 90, plusLongues: [{ profileId: 'h', nom: 'Hugo', avatar: '🦁', serie: 141, tenue: true }], sabliersDuMois: 14 },
    rappel: {
      telephones: 96,
      profils: 81,
      tournees: [
        { jour: '2026-09-13', envoyes: 87, finis: 6, retires: 2, echecs: 3 },
        { jour: '2026-09-12', envoyes: 84, finis: 9, retires: 0, echecs: 2 },
      ],
    },
  }
  const html = [
    rendre(AujourdhuiDuJour, { suivi, vue: null }),
    rendre(QuestionsDuJour, { suivi, enPanne: false, occupe: false, annuler: () => {}, retirer: () => {} }),
    rendre(ClassementDuMoisAuQg, { suivi, occupe: false, masquer: () => {} }),
    rendre(SeriesDuJourAuQg, { suivi }),
    rendre(RappelDuSoirAuQg, { suivi }),
  ].join('\n')
  for (const attendu of [
    '109 finies',
    '600 sur 1000 questions posées · hier 58 %',
    'la plus longue : 141 jours',
    'ce soir : 87 envoyés, 3 échecs',
    'Quelle est la capitale de l’Australie ?',
    '81 %',
    '38 %',
    '3 signalements',
    'annulée',
    'septembre 2026 · 312 joueurs classés',
    'Hugo',
    '2140 pts',
    'Masquer',
    '1 profil masqué',
    '100 jours et plus',
    'Les plus longues : 🦁 Hugo, 141 jours.',
    'Ce mois-ci, 14 sabliers achetés pour sauver une série.',
    'la veille : 2',
  ]) {
    assert.ok(html.includes(attendu), `la page dit « ${attendu} »`)
  }
  // Repliée, une question ne dit pas sa bonne réponse : il faut la toucher.
  assert.ok(!html.includes('1998'), 'les réponses attendent qu’on touche la question')
})
