// Le quiz du jour au téléphone : ce que la page fait quand le réseau, le
// doigt ou l'horloge la trahissent — et ce qu'elle dit au lecteur d'écran.
//
// L'audit du 27 septembre 2026 l'a joué dans un vrai Chromium
// (`retours/2026-09-27/reproductions/jour-ecran/`) : la page figée sur
// « Réponses closes » quand le réseau revenait après l'échéance, une réponse
// enregistrée sur une question que personne n'avait lue, « touche-la à
// nouveau » après un refus définitif, le chrono hors de l'écran au texte
// agrandi, ni la question ni le résultat dits au lecteur d'écran, une
// horloge recalée qui fermait chaque question dès son affichage — et, côté
// serveur, le vainqueur d'hier sans son laurier à sa première visite.
//
// Pas de navigateur en intégration continue : ce que la page décide se
// rejoue ici sans lui — les modules qu'elle appelle, ses écrans rendus en
// HTML, et, pour leur câblage, sa source, comme la console
// (`accessibilite.test.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import React from 'react'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { gesteAccepte } from '../../shared/console'

ProfileStore.tirageEclat = () => false

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const SOURCE = readFileSync(new URL('../../client/src/views/JourApp.tsx', import.meta.url), 'utf8')

/** Un écran de la page du jour, rendu en HTML. Elle lit son adresse à l'évaluation (`routes.ts`) : on lui en donne une. */
async function rendu(composant: string, props: object): Promise<string> {
  const avant = (globalThis as { window?: unknown }).window
  Object.assign(globalThis, { window: { location: { pathname: '/jour', search: '', hash: '' } } })
  try {
    const module = await import(new URL('../../client/src/views/JourApp.tsx', import.meta.url).href)
    const { renderToStaticMarkup } = await import('react-dom/server')
    return renderToStaticMarkup(React.createElement(module[composant], props))
  } finally {
    Object.assign(globalThis, { window: avant })
  }
}

/** Un module du client, chargé sans que le typecheck du serveur le suive : il n'a pas le DOM. */
const duClient = (chemin: string): Promise<any> => import(new URL(`../../client/src/${chemin}`, import.meta.url).href)

/** Laisse passer les promesses qu'un minuteur vient de lancer. */
const laisser = () => new Promise(resolve => setImmediate(resolve))

// ── 1. Le lendemain d'une victoire ─────────────────────────────────────────

test('le lendemain, la page du vainqueur porte son laurier et son podium dès la première visite', async () => {
  const JOUR = '2026-09-26'
  const horloge = { t: Date.UTC(2026, 8, 26, 8, 0) }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const poster = (cookie: string, chemin: string, corps: unknown = {}) =>
      ecrire(banc.url, chemin, corps, cookie).then(async r => (await r.json()) as any)
    const tirage = (): { bonne: number; reponses: string[] }[] => {
      const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
      try {
        return JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(JOUR) as { questions: string }).questions)
      } finally {
        db.close()
      }
    }
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    // Alice trouve tout, Bob se trompe aux quatre premières : Alice gagne la journée.
    for (const [cookie, juste] of [
      [alice, () => true],
      [bob, (i: number) => i > 3],
    ] as const) {
      let etat = await poster(cookie, '/api/jour/commencer')
      const q = tirage()
      while (etat.question) {
        const i = etat.question.index
        await poster(cookie, '/api/jour/repondre', { jour: JOUR, index: i, choix: juste(i) ? q[i].bonne : (q[i].bonne + 1) % q[i].reponses.length })
        etat = await poster(cookie, '/api/jour/suivante')
      }
    }

    // Le lendemain matin, l'accueil est la première page qu'elle ouvre : il
    // clôt la nuit — et doit la lire close.
    horloge.t = Date.UTC(2026, 8, 27, 7, 30)
    const lire = async () => ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: alice } })).json()) as any).profile
    const premiere = await lire()
    const seconde = await lire()
    assert.equal(seconde.laurier, true, 'rechargée, la page porte le laurier')
    assert.equal(premiere.laurier, true, 'dès la première visite du jour, le vainqueur d’hier porte son laurier')
    assert.equal(premiere.xp, seconde.xp, 'et son expérience compte déjà le podium de la nuit')
  } finally {
    await banc.close()
  }
})

// ── 2. Le réseau revenu après l'échéance ──────────────────────────────────

test('hors ligne à l’échéance, la page redemande sa révélation toutes les trois secondes, et dès que le réseau revient', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { insister, REESSAI_MS } = await duClient('insister.ts')
  const veilleur = new EventTarget()
  let enLigne = false
  let essais = 0
  let revelee = false
  const arreter = insister(
    async () => {
      essais++
      if (!enLigne) throw new TypeError('Failed to fetch')
      revelee = true
    },
    { premier: 2100, veilleur },
  )
  t.mock.timers.tick(2099)
  await laisser()
  // Le réseau qui revient en pleine question ne relit rien : rien ne presse encore.
  veilleur.dispatchEvent(new Event('online'))
  await laisser()
  assert.equal(essais, 0, 'rien avant le rendez-vous de l’échéance')
  t.mock.timers.tick(1)
  await laisser()
  assert.equal(essais, 1, 'l’échéance passée, elle demande ce qu’elle révèle')
  t.mock.timers.tick(REESSAI_MS)
  await laisser()
  assert.equal(essais, 2, 'hors ligne, elle réessaie au lieu de se taire')
  enLigne = true
  veilleur.dispatchEvent(new Event('online'))
  await laisser()
  assert.equal(essais, 3, 'le réseau revenu, elle redemande sur-le-champ')
  assert.ok(revelee)
  t.mock.timers.tick(REESSAI_MS * 5)
  await laisser()
  assert.equal(essais, 3, 'puis plus rien : la révélation est là')
  arreter()
  assert.match(
    SOURCE,
    /return insister\(\(\) => api\.jour\.etat\(\)\.then\(p => n === gestes\.current && recevoir\(p\)\), \{\s*premier: Math\.max\(0, question\.echeance - serverNow\(\)\) \+ APRES_ECHEANCE_MS,/,
    'la page du jour insiste à l’échéance',
  )
})

// ── 3. Un refus n'est pas une réponse perdue ──────────────────────────────

test('une réponse refusée par le serveur ne se retouche pas ; perdue en route, si', async t => {
  const { api, refusDuServeur } = await duClient('api.ts')
  const suivantes: (() => Promise<Response>)[] = []
  t.mock.method(globalThis, 'fetch', () => suivantes.shift()!())
  const essai = async (reponse: () => Promise<Response>) => {
    suivantes.push(reponse)
    return api.jour.repondre('2026-09-26', 1, 0).then(
      () => assert.fail('la réponse devait échouer'),
      (e: Error) => e,
    )
  }
  const corps = (statut: number, error: string) => async () => new Response(JSON.stringify({ error }), { status: statut })

  // Touchée à minuit passé : chaque retouche recevrait le même refus.
  const minuit = await essai(corps(400, 'Minuit est passé : le quiz d’hier est clos'))
  assert.equal(minuit.message, 'Minuit est passé : le quiz d’hier est clos')
  assert.equal(refusDuServeur(minuit), true)
  // Le réseau coupé, le serveur qui redémarre ou qui a un souci : la retoucher finit par passer.
  assert.equal(refusDuServeur(await essai(async () => Promise.reject(new TypeError('Failed to fetch')))), false)
  assert.equal(refusDuServeur(await essai(corps(503, 'Service Unavailable'))), false)
  assert.equal(refusDuServeur(await essai(corps(500, 'Erreur serveur'))), false)

  // La page le lit ainsi : un refus relit la partie, sans « touche-la à nouveau ».
  assert.match(
    SOURCE,
    /if \(refusDuServeur\(e\)\) \{\s*setEnvoi\(\{ qIndex: q\.index, choice: action\.choice, etat: 'refusee' \}\)\s*relire\(\)\s*\} else setEnvoi\(\{ qIndex: q\.index, choice: action\.choice, etat: 'perdue' \}\)/,
  )
})

// ── 4. L'horloge qui saute ────────────────────────────────────────────────

test('une horloge de téléphone recalée de trente secondes se remesure, même plus lentement', async () => {
  const { applySample, resetClock, serverNow } = await duClient('clock.ts')
  resetClock()
  // La page s'ouvre : une mesure rapide, les deux horloges d'accord.
  let local = Date.now()
  applySample({ serverTime: local - 20, sentAt: local - 40, receivedAt: local })
  assert.ok(Math.abs(serverNow() - Date.now()) < 50)
  // Le téléphone se recale de trente secondes ; la mesure suivante, sur un
  // réseau mobile ordinaire, est plus lente que la première.
  local = Date.now()
  applySample({ serverTime: local - 30_000 - 95, sentAt: local - 190, receivedAt: local })
  const ecart = serverNow() - (Date.now() - 30_000)
  assert.ok(Math.abs(ecart) < 50, `le chrono lit l’heure du serveur, pas celle d’avant le recalage (écart ${ecart} ms)`)
  // Une mesure plus lente qui s'accorde avec elle ne la remplace pas : la plus rapide reste la meilleure.
  local = Date.now()
  applySample({ serverTime: local - 30_000 - 150 + 100, sentAt: local - 300, receivedAt: local })
  assert.ok(Math.abs(serverNow() - (Date.now() - 30_000)) < 50)

  // Et la page remet la mesure à zéro au retour au premier plan, comme une soirée à chaque connexion.
  assert.match(SOURCE, /document\.addEventListener\('visibilitychange', auRetour\)/)
  assert.match(SOURCE, /if \(document\.visibilityState === 'visible'\) resetClock\(\)/)
})

// ── 5. Le double toucher ──────────────────────────────────────────────────

test('le second toucher d’un double toucher ne répond pas à la question qui vient de paraître', () => {
  // « Question suivante » est à la place de la grille de la question d'après :
  // le second toucher, 150 ms plus tard, y enregistrait une réponse définitive.
  const affichee = 10_000
  assert.equal(gesteAccepte(affichee, affichee + 150), false, 'le second toucher, 150 ms après')
  assert.equal(gesteAccepte(affichee, affichee + 450), false, 'ou 450 ms, avec la latence du réseau')
  assert.equal(gesteAccepte(affichee, affichee + 2_500), true, 'une réponse lue, elle, compte')
  // La page date chaque écran, et sa réponse comme sa révélation lisent la garde.
  assert.match(SOURCE, /changement\.current = performance\.now\(\)/)
  assert.match(SOURCE, /const repondre = \(action: QuizAction\) => \{[\s\S]*?if \(!gesteAccepte\(changement\.current, performance\.now\(\)\)\) return[\s\S]*?api\.jour\s*\.repondre\(/)
  assert.match(SOURCE, /if \(gesteAccepte\(changement\.current, performance\.now\(\)\)\) void geste\(revelation\.derniere \? api\.jour\.etat : api\.jour\.suivante\)/)
})

// ── 6. Chaque écran commence en haut, le focus perdu revient ──────────────

test('le focus perdu avec le bouton touché se pose sur le résultat, sinon sur le titre — et jamais ne se vole', async () => {
  const { rendreLeFocus } = await duClient('focus.ts')
  const recus: [string, unknown][] = []
  const element = (nom: string) => ({ nom, tabIndex: 0, focus: (o: unknown) => void recus.push([nom, o]) })
  const body = element('page')
  const ecran = (contenu: Record<string, ReturnType<typeof element>>) => ({ querySelector: (s: string) => contenu[s] ?? null }) as any
  const cibles = ['.result-banner', 'h1', 'h2']

  // La révélation : le résultat, qu'un lecteur d'écran dit aussitôt.
  const resultat = element('Bien joué !')
  assert.equal(rendreLeFocus(ecran({ '.result-banner': resultat, h2: element('titre') }), cibles, { activeElement: body, body } as any), resultat)
  assert.deepEqual(recus, [['Bien joué !', { preventScroll: true }]], 'sans défiler : l’écran commence en haut')
  assert.equal(resultat.tabIndex, -1, 'par programme seulement')
  // La question : son intitulé.
  recus.length = 0
  rendreLeFocus(ecran({ h2: element('La capitale de l’Italie ?') }), cibles, { activeElement: null, body } as any)
  assert.deepEqual(recus.map(r => r[0]), ['La capitale de l’Italie ?'])
  // Un focus qui ne s'est pas perdu reste où il est.
  recus.length = 0
  assert.equal(rendreLeFocus(ecran({ h1: element('titre') }), cibles, { activeElement: element('champ'), body } as any), null)
  assert.deepEqual(recus, [])

  // Le câblage : à chaque écran de la page du jour, en haut, puis le focus.
  assert.match(
    SOURCE,
    /useLayoutEffect\(\(\) => \{[\s\S]*?changement\.current = performance\.now\(\)\s*window\.scrollTo\(0, 0\)[\s\S]*?rendreLeFocus\(document\.querySelector\('\.player-shell'\), CE_QUE_L_ECRAN_DIT\)\s*\}, \[cleDEcran\]\)/,
  )
  assert.match(SOURCE, /const CE_QUE_L_ECRAN_DIT = \['\.result-banner', 'h1', 'h2'\] as const/)
})

// ── 7. La correction se lit ───────────────────────────────────────────────

test('dans la correction, chaque marque dit juste, faux, sans réponse ou annulée — et « Sans réponse » s’écrit', async () => {
  const q = (o: object) => ({
    texte: 'Question ?',
    reponses: ['Rome', 'Milan'],
    bonne: 0,
    categorie: null,
    anecdote: null,
    trouveePar: null,
    choix: null,
    juste: false,
    points: 0,
    repondue: true,
    ...o,
  })
  const html = await rendu('QuestionsCorrigees', {
    questions: [q({ choix: 0, juste: true, points: 900 }), q({ choix: 1 }), q({}), q({ choix: 1, annulee: true }), q({ repondue: false })],
  })
  const marques = [...html.matchAll(/<span class="correction-marque" role="img" aria-label="([^"]+)">(.*?)<\/span>/g)]
  assert.deepEqual(
    marques.map(m => m[1]),
    ['Juste', 'Faux', 'Sans réponse', 'Annulée', 'Sans réponse'],
  )
  assert.doesNotMatch(marques[3][2], /<svg/, 'une question annulée ne garde pas de croix')
  const lignes = html.split('<li').slice(1)
  assert.match(lignes[1], /Tu avais dit : Milan/)
  assert.match(lignes[2], /<span class="muted small">Sans réponse<\/span>/, 'pour l’œil aussi')
  assert.doesNotMatch(lignes[0], /Sans réponse|Tu avais dit/)
})

// ── 8. Sans réseau au chargement ──────────────────────────────────────────

test('sans réseau au chargement, la page du jour propose de réessayer', async () => {
  const html = await rendu('EchecDuChargement', { erreur: 'Pas de réseau — vérifie ton Wi-Fi ou ta 4G, puis réessaie', onReessayer: () => {} })
  assert.match(html, /Pas de réseau/)
  assert.match(html, /<button class="btn btn-primary btn-big btn-block">.*Réessayer<\/button>/)
  assert.ok(html.indexOf('Réessayer') < html.indexOf('Retour à l’accueil'))
  assert.match(SOURCE, /if \(erreur\) return <EchecDuChargement erreur=\{erreur\} onReessayer=\{charger\} \/>/)
})
