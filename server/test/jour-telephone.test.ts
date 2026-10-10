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
// Le propriétaire du dépôt, le 28 septembre 2026 : « Voir le classement »,
// depuis l'accueil, puis « Retour », menait à la fin de la partie au lieu de
// l'accueil ; et sur cette fin, « Retour à l'accueil » ne se voyait qu'en
// faisant défiler. Les parcours ont été rejoués dans Chromium en 360 × 640.
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

/** Sous l'adresse de la page du jour : elle la lit à l'évaluation (`routes.ts`), et le classement y lit sa période. */
async function aLAdresseDuJour<T>(faire: (page: any) => T, hash = ''): Promise<Awaited<T>> {
  const avant = (globalThis as { window?: unknown }).window
  Object.assign(globalThis, { window: { location: { pathname: '/jour', search: '', hash } } })
  try {
    return await faire(await import(new URL('../../client/src/views/JourApp.tsx', import.meta.url).href))
  } finally {
    Object.assign(globalThis, { window: avant })
  }
}

/** Un écran de la page du jour, rendu en HTML. */
async function rendu(composant: string, props: object, hash = ''): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server')
  return aLAdresseDuJour(page => renderToStaticMarkup(React.createElement(page[composant], props)), hash)
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
    // Le laurier dit l'allure de ses victoires (`niveauDuLaurier`) : vert, à la première.
    assert.equal(seconde.laurier, 1, 'rechargée, la page porte le laurier')
    assert.equal(premiere.laurier, 1, 'dès la première visite du jour, le vainqueur d’hier porte son laurier')
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

test('« Plus que 5 secondes » se dit une fois au lecteur d’écran, à chaque question', async () => {
  // Il lui faut onze à quatorze secondes d'écoute avant de pouvoir toucher
  // une réponse ; le chronomètre ne s'annonce pas — il parlerait chaque
  // seconde. L'arbitrage du 27 septembre 2026 garde le délai, pas le
  // silence [accessibilite-4].
  // À l'heure du serveur, comme la page : une épreuve d'avant a pu recaler l'horloge du client.
  const { serverNow } = await duClient('clock.ts')
  const dans = (ms: number) => rendu('AnnonceDeLaFin', { echeance: serverNow() + ms })
  assert.equal(await dans(15_000), '<p class="sr-only" role="status"></p>', 'rien tant qu’il reste du temps')
  assert.equal(await dans(4_200), '<p class="sr-only" role="status">Plus que 5 secondes</p>')
  assert.equal(await dans(800), '<p class="sr-only" role="status">Plus que 5 secondes</p>', 'le même texte jusqu’au bout : dit une fois')
  assert.equal(await dans(-500), '<p class="sr-only" role="status"></p>')
  // Une région par question : la suivante repart muette.
  assert.match(SOURCE, /<AnnonceDeLaFin key=\{partie\.question\.index\} echeance=\{partie\.question\.echeance\} \/>/)
})

// ── 9. « Retour » mène là d'où l'on vient ─────────────────────────────────

test('« Retour » du classement ramène là d’où l’on vient : l’écran d’ici, la page de l’accueil, sinon l’accueil', async () => {
  const retour = await aLAdresseDuJour(page => page.retourDuJour as (etat: unknown, provenance: string, origine: string, entrees: number) => string)
  const ICI = 'http://banc'
  // Ouvert d'ici — la fin, « Déjà 12 joueurs », la correction d'hier — : un
  // cran en arrière, jusqu'à l'écran qu'on quittait.
  assert.equal(retour({ fiestappJourOuvert: true }, 'http://banc/', ICI, 3), 'reculer')
  assert.equal(retour({ fiestappJourOuvert: true }, '', ICI, 2), 'reculer', 'rechargée, l’entrée garde sa marque')
  // Ouvert par la carte de l'accueil, ou par « Mes jours » : on y retourne,
  // telle qu'on l'a laissée. Il affichait la fin de la partie, qu'on n'avait
  // pas vue en venant.
  assert.equal(retour(null, 'http://banc/', ICI, 2), 'reculer')
  assert.equal(retour(null, 'http://banc/profil', ICI, 6), 'reculer')
  // Un onglet neuf n'a rien derrière lui : reculer ne ferait rien.
  assert.equal(retour(null, 'http://banc/', ICI, 1), 'accueil')
  // Un lien reçu, une adresse tapée : reculer quitterait l'application.
  assert.equal(retour(null, 'https://web.whatsapp.com/', ICI, 4), 'accueil')
  assert.equal(retour(null, '', ICI, 4), 'accueil')
  assert.equal(retour(null, 'pas une adresse', ICI, 4), 'accueil')
  // La marque d'une autre page ne vaut pas celle-ci.
  assert.equal(retour({ fiestappGarde: true }, '', ICI, 4), 'accueil')

  // Le câblage : chaque écran s'ouvre avec sa marque, et « Retour » suit la
  // décision — l'accueil remplace l'entrée : le retour du téléphone ne
  // rouvre pas le classement qu'on vient de quitter.
  assert.match(SOURCE, /const ouvrir = \(vers: 'classement' \| 'correction'\) => \{\s*history\.pushState\(\{ \[OUVERT_ICI\]: true \}, '', `#\$\{vers\}`\)\s*setEcran\(vers\)/)
  assert.match(
    SOURCE,
    /if \(retourDuJour\(history\.state, document\.referrer, window\.location\.origin, history\.length\) === 'reculer'\) history\.back\(\)\s*else window\.location\.replace\('\/'\)/,
  )
  assert.match(SOURCE, /<Classement partie=\{partie\} onRetour=\{revenir\} \/>/)
  assert.match(SOURCE, /<Correction jour=\{jour\} onRetour=\{revenir\} \/>/)
  // Une entrée posée par `location.hash`, sans marque, passerait pour venue d'ailleurs.
  assert.doesNotMatch(SOURCE, /location\.hash\s*=(?!=)/)
})

// ── 10. La sortie de la fin, dès l'arrivée ────────────────────────────────

test('la fin du jour montre sa sortie en tête : « Retour à l’accueil » attendait deux écrans plus bas', async () => {
  // Une partie qui monte d'un niveau et ouvre son emoji : 1 200 px en
  // 360 × 640, et le bas de page à 1 131 px.
  const partie = {
    jour: '2026-09-28',
    maintenant: 0,
    total: 10,
    categories: [],
    etat: 'finie',
    points: 1800,
    justes: 9,
    xp: 67,
    medaille: 'argent',
    rang: 2,
    joueurs: 3,
    devant: { nom: 'Hugo', ecart: 200 },
    pointsPossibles: 2000,
    comptees: 10,
    serie: 1,
    vainqueursDHier: [],
    paliers: [],
    legendaires: [],
    portraits: [],
    niveauAvant: 1,
    niveauApres: 2,
  }
  const profil = { niveau: 2, acquis: 7, requis: 180, legendaire: null }
  const html = await rendu('Fin', { partie, profil, onClassement: () => {}, onCorrection: () => {} })
  // Son premier geste mène à l'accueil — avant le titre, le score et la fête.
  const premier = /<(a|button)\b[^>]*>(.*?)<\/\1>/.exec(html)!
  assert.match(premier[0], /^<a class="lien-discret jour-sortie" href="\/">/)
  assert.equal(premier[2].replace(/<[^>]+>/g, ''), 'Accueil')
  assert.ok(html.indexOf('jour-sortie') < html.indexOf('fin-tete'), 'avant l’en-tête')
  // À la taille d'un pouce : la ligne fine de l'animateur n'a que 32 px.
  const CSS = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8')
  assert.match(/\.jour-sortie\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '', /min-height:\s*44px/)
  // Le bas de page garde ses gestes, pour qui a tout lu — et la campagne,
  // pour qui veut rejouer tout de suite, sans repasser par l'accueil.
  const bas = html.slice(html.indexOf('fin-actions'))
  for (const geste of ['Voir le classement', 'Revoir mes réponses', 'Retour à l’accueil']) assert.ok(bas.includes(geste), geste)
  assert.match(bas, /href="\/campagne"[^>]*>.*Continuer en solo : la campagne<\/a>/)
})

test('revenue après la partie, la page du jour montre le jour joué, pas la fête de la fin', async () => {
  // Le propriétaire du dépôt, le 3 octobre 2026 : revenir au quiz du jour
  // après sa partie rouvrait chaque fois la fin et sa fête ; on venait voir
  // sa place et ses réponses.
  const partie = {
    jour: '2026-10-03',
    maintenant: 0,
    total: 10,
    categories: [],
    etat: 'finie',
    points: 1640,
    justes: 8,
    xp: 41,
    medaille: 'argent',
    rang: 2,
    joueurs: 3,
    pointsPossibles: 2000,
    comptees: 10,
    serie: 5,
    vainqueursDHier: [],
  }
  const html = await rendu('JourJoue', { partie, onClassement: () => {}, onCorrection: () => {} })
  const premier = /<(a|button)\b[^>]*>(.*?)<\/\1>/.exec(html)!
  assert.match(premier[0], /^<a class="lien-discret jour-sortie" href="\/">/, 'la sortie d’abord')
  assert.equal(premier[2].replace(/<[^>]+>/g, ''), 'Accueil')
  for (const attendu of [
    'Le quiz du jour · joué',
    '2ᵉ place sur 3 pour l’instant',
    '8 bonnes réponses sur 10',
    'Médaille d’argent',
    'Revoir mes réponses',
    'Le classement du jour',
    'Voir tout le classement',
    'Dix nouvelles questions dans',
  ])
    assert.ok(html.includes(attendu), attendu)
  assert.doesNotMatch(html, /fin-tete|points d’expérience/, 'ni l’en-tête ni la fête de la fin')
  // Le câblage : la partie déjà finie à l'arrivée ouvre le jour joué ; celle qui finit sous les yeux garde sa fin.
  assert.match(SOURCE, /setFinieALArrivee\(avant => avant \?\? p\.etat === 'finie'\)/)
  assert.match(SOURCE, /finieALArrivee \? \(\s*<JourJoue /)
})

test('le jour joué dit sa place et ses bonnes réponses en toutes lettres : « 7 sur 10 » se lisait comme une place', async () => {
  // Le propriétaire du dépôt, le 4 octobre 2026 : « il y a 15 personnes qui
  // ont participé, mais ça me met 7/10 ». C'étaient ses bonnes réponses,
  // seules sous les points, sans un mot pour les dire.
  const partie = (rang: number) => ({
    jour: '2026-10-04',
    maintenant: 0,
    total: 10,
    categories: [],
    etat: 'finie',
    points: 1_260,
    justes: 7,
    xp: 32,
    medaille: 'bronze',
    rang,
    joueurs: 15,
    pointsPossibles: 2000,
    comptees: 10,
    serie: 1,
    vainqueursDHier: [],
  })
  const resultat = (html: string) => html.slice(html.indexOf('jour-resultat'), html.indexOf('Revoir mes réponses'))
  const septieme = resultat(await rendu('JourJoue', { partie: partie(7), onClassement: () => {}, onCorrection: () => {} }))
  assert.match(septieme, /7ᵉ place sur 15 pour l’instant/, 'sa place, sur les quinze qui ont joué')
  assert.match(septieme, /7 bonnes réponses sur 10/, 'ses bonnes réponses, dites comme telles')
  assert.doesNotMatch(septieme, /\b7 sur 10\b/, 'plus de « 7 sur 10 » sans un mot')
  // Dans la moitié basse, la place se tait (`placeDuJour`) — le classement
  // dessous la montre —, et les bonnes réponses se disent toujours.
  const douzieme = resultat(await rendu('JourJoue', { partie: partie(12), onClassement: () => {}, onCorrection: () => {} }))
  assert.doesNotMatch(douzieme, /place/)
  assert.match(douzieme, /7 bonnes réponses sur 10/)
})

test('le lien vers tout le classement dit ce qu’il ouvre', async () => {
  // « Hier, le mois : tout le classement » ne se comprenait pas (le
  // propriétaire du dépôt, le 4 octobre 2026) ; hier et le mois sont des
  // onglets du classement qu'il ouvre.
  const partie = { jour: '2026-10-04', etat: 'finie', points: 0, justes: 0, comptees: 10, xp: 0, medaille: null, rang: 0, joueurs: 3, serie: 0 }
  const html = await rendu('JourJoue', { partie, onClassement: () => {}, onCorrection: () => {} })
  assert.match(html, /<button type="button" class="link-inline jour-tout-classement">Voir tout le classement<\/button>/)
  assert.doesNotMatch(html, /Hier, le mois/)
})

test('le classement et la correction s’ouvrent sur « ← Retour », en tête — et le gardent en bas, sous la liste', async () => {
  // Le propriétaire du dépôt, le 4 octobre 2026 : une flèche pour revenir,
  // en haut, comme les autres pages ; et en bas, pour qui a fait défiler
  // tout le classement.
  for (const [composant, props, hash] of [
    ['Classement', { partie: { jour: '2026-10-04' }, onRetour: () => {} }, '#classement'],
    ['Correction', { jour: '2026-10-04', onRetour: () => {} }, '#correction'],
  ] as const) {
    const html = await rendu(composant, props, hash)
    const gestes = [...html.matchAll(/<(a|button)\b[^>]*>(.*?)<\/\1>/g)]
    const texte = (g: RegExpMatchArray) => g[2].replace(/<[^>]+>/g, '')
    assert.match(gestes[0][0], /^<a class="lien-discret jour-sortie" href="\/jour">/, `${composant} : la sortie de toutes les pages, d’abord`)
    assert.match(gestes[0][2], /<svg[^>]*>/, `${composant} : avec sa flèche`)
    assert.equal(texte(gestes[0]), 'Retour')
    assert.ok(html.indexOf('jour-sortie') < html.indexOf('jour-titre'), `${composant} : avant le titre`)
    assert.equal(texte(gestes.at(-1)!), 'Retour', `${composant} : et en bas, toujours`)
  }
  // Les deux suivent la même décision que le retour du bas (`revenir`) : un
  // cran en arrière quand on vient d'ici, l'accueil sinon.
  assert.equal(SOURCE.match(/<Sortie vers="Retour" href="\/jour" onClick=\{onRetour\} \/>/g)?.length, 2)
})

test('« Voir le classement », depuis la fin, mène au jour joué : le retour n’y rouvre plus « mon résultat »', () => {
  // Le propriétaire du dépôt, le 4 octobre 2026 : « Voir le classement »
  // devait mener au quiz du jour, où se trouve le classement ; le retour du
  // classement, puis celui de la correction, rouvraient la fin de partie.
  // La fin ne se voit qu'une fois : quittée, elle laisse la place au jour
  // joué, sur la même entrée d'historique — rien de poussé derrière elle.
  const fin = SOURCE.slice(SOURCE.indexOf('<Fin\n'), SOURCE.indexOf('/>', SOURCE.indexOf('<Fin\n')))
  assert.match(fin, /onClassement=\{\(\) => setFinieALArrivee\(true\)\}/, 'le classement : le jour joué, sans entrée d’historique')
  assert.doesNotMatch(fin, /ouvrir\('classement'\)/, 'plus le classement par-dessus la fin')
  assert.match(fin, /onCorrection=\{\(\) => \{\s*setFinieALArrivee\(true\)\s*ouvrir\('correction'\)/, 'la correction : son retour ramène au jour joué')
  // Le jour joué remplace la fin : un écran neuf, qui commence en haut.
  assert.match(SOURCE, /`partie:\$\{partie\.jour\}:\$\{partie\.etat\}\$\{finieALArrivee \? ':jouee' : ''\}`/)
})

test('le rendez-vous de demain se compte jusqu’à minuit à Paris, changement d’heure compris', async () => {
  const { minutesAvantMinuit } = await import('../../shared/jour')
  assert.equal(minutesAvantMinuit(Date.UTC(2026, 9, 3, 21, 55)), 5, '23 h 55 à Paris, à l’heure d’été')
  assert.equal(minutesAvantMinuit(Date.UTC(2026, 11, 1, 22, 59)), 1, '23 h 59 à Paris, à l’heure d’hiver')
  assert.equal(minutesAvantMinuit(Date.UTC(2026, 9, 3, 22, 0)), 24 * 60, 'minuit pile : un jour entier')
  assert.equal(minutesAvantMinuit(Date.UTC(2026, 2, 29, 0, 30)), 21 * 60 + 30, '1 h 30 la nuit du passage à l’heure d’été : vingt et une heures et demie, pas vingt-deux')
})

// ── 11. « Le classement du mois » s'ouvre sur le mois ─────────────────────

test('« Le classement du mois » s’ouvre sur le mois, et la période choisie reste dans l’adresse', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server')
  // Le lien de « Mes jours », sur la page du profil : il ouvrait le
  // classement du jour, et il fallait trouver l'onglet du mois.
  const jour = {
    joues: 1,
    serie: 1,
    record: 1,
    medailles: { or: 0, argent: 1, bronze: 0 },
    meilleurScore: 1800,
    podiums: 0,
    victoires: 0,
    jours: [{ jour: '2026-09-28', points: 1800, rang: 2, joueurs: 3, xp: 67, medaille: 'argent', comptees: 10, justes: 9, tempsJustesMs: 40_000 }],
  }
  const mesJours = await aLAdresseDuJour(async () => {
    const { MesJours } = await import(new URL('../../client/src/components/Jour.tsx', import.meta.url).href)
    return renderToStaticMarkup(React.createElement(MesJours, { jour }))
  })
  assert.match(mesJours, /<a class="link-inline small" href="\/jour#classement-mois">Le classement du mois<\/a>/)

  // Chaque période a son adresse ; `#classement`, celle des liens d'avant,
  // reste aujourd'hui.
  const page = await aLAdresseDuJour(p => p)
  for (const hash of ['#classement', '#classement-hier', '#classement-mois']) assert.equal(page.ecranDe(hash), 'classement', hash)
  assert.equal(page.ecranDe('#correction'), 'correction')
  assert.equal(page.ecranDe(''), 'partie')
  assert.equal(page.periodeDe('#classement-mois'), 'mois')
  assert.equal(page.periodeDe('#correction'), null)

  // Le classement s'ouvre sur la période de son adresse.
  const partie = { jour: '2026-09-28' }
  const ouvert = async (hash: string) =>
    /<button[^>]*aria-selected="true"[^>]*>([^<]*)<\/button>/.exec(await rendu('Classement', { partie, onRetour: () => {} }, hash))?.[1]
  assert.equal(await ouvert('#classement-mois'), 'Septembre')
  assert.equal(await ouvert('#classement-hier'), 'Hier')
  assert.equal(await ouvert('#classement'), 'Aujourd’hui')

  // Changer de période réécrit l'adresse — sur la même entrée, marque
  // comprise : « Retour » ne repasse pas par chaque onglet.
  assert.match(SOURCE, /onChoisir=\{choisir\}/)
  assert.match(SOURCE, /const choisir = \(p: Periode\) => \{\s*setPeriode\(p\)\s*history\.replaceState\(history\.state, '', ADRESSE_DE_PERIODE\[p\]\)/)
})
