// Les dessins des légendaires et des Divins, chargés à la demande
// (`client/src/components/medaillons.ts`) : ce qu'un invité anonyme ne
// télécharge pas, et ce que devient la page quand ils ne viennent pas — un
// fichier en 404 après un redéploiement, une 4G qui ne répond plus.
// Pas de serveur : des modules du client, rendus en HTML.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const client = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/src')
const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href

/**
 * Une instance neuve du module des dessins : chaque test simule sa propre
 * panne, et l'état du module vaut pour toute la page — comme au navigateur.
 */
async function medaillons(instance = ''): Promise<Medaillons> {
  return await import(`${url('components/medaillons.ts')}${instance && `?${instance}`}`)
}

/**
 * Ce que le test lit du module — écrit à la main : le typecheck du serveur
 * ne compile pas le JSX du client, qu'un `typeof import` lui ferait suivre.
 */
interface Medaillons {
  chargeur: { importer: (sorte: Sorte) => Promise<unknown> }
  chargerDessins(sortes?: readonly Sorte[]): Promise<void>
  chargerDessinsAuPlus(sortes: readonly Sorte[], ms?: number): Promise<void>
  complets(d?: unknown, sortes?: readonly Sorte[]): boolean
  sortesDe(cles: readonly (string | null | undefined)[]): Sorte[]
  ATTENTE_MAX_DESSINS: number
}
type Sorte = 'legendaire' | 'divin'

/** Un composant du client, rendu en HTML — la même recette que `eclat.test.ts`. */
async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const React = (await import('react')).default
  Object.assign(globalThis, { React })
  const module = await import(url(`${fichier}.tsx`))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

// ── 1. Le chemin de l'invité ──────────────────────────────────────────────

/** Les fichiers qu'une page importe statiquement, de proche en proche. */
function importsStatiques(depart: string): Set<string> {
  const vus = new Set<string>()
  const pile = [depart]
  while (pile.length) {
    const fichier = pile.pop()!
    if (vus.has(fichier)) continue
    vus.add(fichier)
    const texte = readFileSync(fichier, 'utf8')
      // Un commentaire qui cite un import ne charge rien.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    // `import type` s'efface à la compilation, et `import('…')` est justement
    // le chargement à la demande : seuls comptent les imports de valeurs, et
    // ceux qui ne gardent rien (`import './Legendaire'` l'évaluerait aussi).
    const cibles = [
      ...[...texte.matchAll(/^\s*(?:import|export)\s+(type\s+)?[^'"]*?from\s+['"](\.[^'"]+)['"]/gm)].filter(m => !m[1]).map(m => m[2]),
      ...[...texte.matchAll(/^\s*import\s+['"](\.[^'"]+)['"]/gm)].map(m => m[1]),
    ]
    for (const cible of cibles) {
      const base = path.resolve(path.dirname(fichier), cible)
      const trouve = [base, `${base}.tsx`, `${base}.ts`].find(f => /\.tsx?$/.test(f) && existsSync(f))
      if (trouve) pile.push(trouve)
    }
  }
  return vus
}

test('le téléphone de l’invité n’importe les dessins qu’à la demande', () => {
  const chemin = importsStatiques(path.join(client, 'views/PlayerApp.tsx'))
  // Le parcours voit bien le chemin : sinon ce test ne garderait rien.
  assert.ok(chemin.has(path.join(client, 'components/Avatar.tsx')), 'Avatar est sur le chemin')
  assert.ok(chemin.has(path.join(client, 'components/medaillons.ts')), 'medaillons est sur le chemin')
  for (const dessin of ['components/Legendaire.tsx', 'components/Divin.tsx', 'components/Lumiere.tsx', 'components/Carriere.tsx']) {
    assert.ok(!chemin.has(path.join(client, dessin)), `${dessin} ne part pas avec la page de l’invité`)
  }
})

test('l’accueil anonyme n’importe ni les dessins ni les onglets du profil', () => {
  // Il ne montre que « Me connecter » et « Rejoindre une soirée », et
  // téléchargeait pourtant les dessins et les onglets du profil : 21 Ko et
  // 179 ms en 4G (recompenses-vitrine-9, mesuré par perf-client-5).
  const chemin = importsStatiques(path.join(client, 'views/ProfilApp.tsx'))
  assert.ok(chemin.has(path.join(client, 'components/Avatar.tsx')), 'Avatar est sur le chemin')
  assert.ok(chemin.has(path.join(client, 'components/choix.ts')), 'ce que le profil annonce reste là')
  for (const f of ['components/Legendaire.tsx', 'components/Divin.tsx', 'components/Lumiere.tsx', 'components/Apparence.tsx', 'components/Trophees.tsx']) {
    assert.ok(!chemin.has(path.join(client, f)), `${f} ne part pas avec l’accueil anonyme`)
  }
})

test('l’accueil ne télécharge pas la liaison temps réel : elle ne sert qu’en soirée', () => {
  // Le formulaire du profil prenait deux fonctions à l'entrée d'une soirée
  // (`Entree.tsx`), et avec elle toute la liaison : socket.io, 13 Ko, sur le
  // chemin de chaque ouverture de l'accueil, pour une page qui ne s'y branche
  // jamais (`retours/2026-10-05/affichage-des-pages.md`, piste 3).
  const accueil = importsStatiques(path.join(client, 'views/ProfilApp.tsx'))
  assert.ok(accueil.has(path.join(client, 'components/ProfilForm.tsx')), 'le formulaire du profil est sur le chemin')
  assert.ok(accueil.has(path.join(client, 'components/inscription.ts')), 'ce qu’il partage avec l’entrée aussi')
  for (const f of ['components/Entree.tsx', 'components/Reprendre.tsx', 'socket.ts']) {
    assert.ok(!accueil.has(path.join(client, f)), `${f} ne part pas avec l’accueil`)
  }
  const liaison = (chemin: Set<string>) => [...chemin].filter(f => /from\s+['"]socket\.io-client['"]/.test(readFileSync(f, 'utf8')))
  assert.deepEqual(liaison(accueil), [], 'aucun fichier de l’accueil n’importe socket.io')
  // Le parcours la voit bien là où elle sert : sinon ce test ne garderait rien.
  assert.deepEqual(liaison(importsStatiques(path.join(client, 'views/PlayerApp.tsx'))), [path.join(client, 'socket.ts')])
})

test('le téléphone de l’invité ne télécharge pas avant l’entrée ce qui ne sert qu’après', () => {
  // La carte d'un joueur (au toucher d'un nom), la fin de soirée (à la
  // clôture) et le quiz du jour (pour une seule icône, la flamme) passaient
  // devant l'écran d'entrée : 69 à 259 ms de plus depuis #58 (perf-client-2).
  const chemin = importsStatiques(path.join(client, 'views/PlayerApp.tsx'))
  assert.ok(chemin.has(path.join(client, 'components/Entree.tsx')), 'Entree est sur le chemin')
  for (const f of ['components/CarteJoueur.tsx', 'components/FinDeSoiree.tsx', 'components/Jour.tsx']) {
    assert.ok(!chemin.has(path.join(client, f)), `${f} ne part pas avec l’écran d’entrée`)
  }
})

test('le quiz du jour ne télécharge pas la fin de soirée pour ses cartes de fin', () => {
  // Il l'importait pour la collection, les portraits et le médaillon
  // ouverts : toute la fin de soirée (17 Ko) à chaque ouverture de sa page.
  const chemin = importsStatiques(path.join(client, 'views/JourApp.tsx'))
  assert.ok(chemin.has(path.join(client, 'components/Ouverts.tsx')), 'ses cartes de fin sont sur le chemin')
  assert.ok(!chemin.has(path.join(client, 'components/FinDeSoiree.tsx')), 'la fin de soirée ne part pas avec le quiz du jour')
})

test('ce qui vient à la demande vient une fois, et sans faire attendre React', async () => {
  const { aLaDemande } = await import(url('aLaDemande.ts'))
  let appels = 0
  const module = { Composant: () => null }
  const source = aLaDemande(() => {
    appels++
    return Promise.resolve(module)
  })
  assert.equal(source.charge(), null)
  await Promise.all([source.charger(), source.charger()])
  await source.charger()
  assert.equal(appels, 1, 'un seul import pour toute la page')
  // Déjà là, il se rend au premier rendu : pas de `Suspense`, qui retient
  // trois dixièmes de seconde ce qui sort d'une attente.
  assert.equal(source.charge(), module)
  const perdu = aLaDemande(() => {
    appels++
    return Promise.reject(new TypeError('Failed to fetch dynamically imported module'))
  })
  await assert.rejects(perdu.charger())
  await assert.rejects(perdu.charger())
  assert.equal(appels, 2, 'un échec vaut pour la page')
  assert.equal(perdu.charge(), null)
  // Les pages qui en dépendent ne passent pas par `lazy` : la grille du
  // profil paraissait 350 ms plus tard, préchargée ou non, et la fin de
  // soirée passait par « Connexion… ».
  for (const f of ['views/ProfilApp.tsx', 'views/PlayerApp.tsx']) {
    const texte = readFileSync(path.join(client, f), 'utf8')
    assert.doesNotMatch(texte, /\blazy\(|<Suspense/, f)
    assert.match(texte, /aLaDemande\(\(\) => import\(/, f)
  }
})

// ── 2. Sans les dessins, l'emoji ──────────────────────────────────────────

test('sans ses dessins, un légendaire porté rend l’emoji, sans exception', async () => {
  const html = await rendu('components/Avatar', 'Avatar', { avatar: '🦊', legendaire: 'lg:phenix', finition: 'or' })
  assert.ok(html.includes('🦊'), html)
  assert.ok(!html.includes('av-legendaire'), 'pas de classe de médaillon autour d’un emoji')
  // Un Divin aussi : l'emoji nu, sans finition.
  const divin = await rendu('components/Avatar', 'Avatar', { avatar: '🐼', legendaire: 'dv:seraphin', finition: 'or' })
  assert.ok(divin.includes('🐼') && !divin.includes('av-or'), divin)
})

// ── 3. Un échec vaut pour toute la page ───────────────────────────────────

test('un chargement qui échoue ne se relance plus, et ne rejette jamais', async () => {
  const m = await medaillons('echec')
  const appels: Sorte[] = []
  m.chargeur.importer = sorte => {
    appels.push(sorte)
    return Promise.reject(new TypeError('Failed to fetch dynamically imported module'))
  }
  await m.chargerDessins()
  // Deux fichiers, un essai chacun.
  assert.deepEqual([...appels].sort(), ['divin', 'legendaire'])
  // Chaque nouvel avatar le redemande : le navigateur garde l'échec d'un
  // `import()`, redemander ne ferait que redessiner la page à chaque fois.
  for (let i = 0; i < 5; i++) await m.chargerDessins()
  await m.chargerDessinsAuPlus(['legendaire', 'divin'], 10)
  assert.equal(appels.length, 2, 'un seul essai par fichier pour toute la page')
  assert.equal(m.complets(), false)
})

test('un légendaire ne fait pas venir les Divins', async () => {
  const m = await medaillons('sortes')
  const appels: Sorte[] = []
  m.chargeur.importer = sorte => {
    appels.push(sorte)
    return Promise.resolve()
  }
  // Ce qu'une salle porte : un légendaire, un emoji, un anonyme, une clé
  // inconnue — les Divins, plus rares que tout, n'y sont pour rien.
  const salle = ['lg:phenix', '🦊', null, undefined, 'lg:inconnu']
  assert.deepEqual(m.sortesDe(salle), ['legendaire'])
  assert.deepEqual(m.sortesDe(['dv:seraphin']), ['divin'])
  assert.deepEqual(m.sortesDe(['🦊', null]), [], 'une salle d’anonymes ne demande rien')
  assert.deepEqual(m.sortesDe(['dv:lotus', 'lg:phenix']), ['legendaire', 'divin'])
  await m.chargerDessins(m.sortesDe(salle))
  await m.chargerDessinsAuPlus(m.sortesDe(salle), 10)
  assert.deepEqual(appels, ['legendaire'], 'les Divins ne sont pas venus')
  // Rien à attendre, rien à charger.
  await m.chargerDessinsAuPlus([], 10)
  assert.deepEqual(appels, ['legendaire'])
})

test('une requête de dessins muette ne retient personne plus que la borne', async () => {
  const m = await medaillons('muet')
  m.chargeur.importer = () => new Promise(() => {})
  const t0 = Date.now()
  await m.chargerDessinsAuPlus(['legendaire'], 50)
  assert.ok(Date.now() - t0 < 1000, `rendu la main après ${Date.now() - t0} ms`)
  assert.ok(m.ATTENTE_MAX_DESSINS <= 3000, 'la borne des pages reste de l’ordre de deux secondes')
})

test('rechargé en pleine question, le téléphone n’attend pas les dessins d’un autre', () => {
  // Le chrono du serveur tourne : « Connexion… » coûtait jusqu'à 2,5 s de
  // question pour le médaillon de quelqu'un d'autre — l'arbitrage du 27
  // septembre 2026 [recompenses-vitrine-10]. La salle d'attente, elle,
  // attend toujours, une fois.
  const page = readFileSync(path.join(client, 'views/PlayerApp.tsx'), 'utf8')
  assert.match(page, /const enPleineQuestion = !!enCours && PHASES_PLEINES\.has\(enCours\.phase\)/)
  assert.match(page, /const attendreDessins = !dejaVu && !!s\.me && !enPleineQuestion && attendus\(dessins, sortesDeLaSalle\)/)
  assert.match(page, /const PHASES_PLEINES = new Set<QuizPlayerView\['phase'\]>\(\['getReady', 'observe', 'question'\]\)/)
})

// ── 4. Ce qui n'a pas d'emoji le dit ──────────────────────────────────────

test('à la fin de soirée, un médaillon qui ne viendra plus mène au profil', async () => {
  // L'instance que lisent `Avatar` et `FinDeSoiree` : sa panne est celle de la page.
  const m = await medaillons()
  const fin = {
    soiree: { id: '2026-09-24-k7x2q', titre: 'La soirée de Nadia', slug: 'chez-nadia' },
    nom: 'Jeanne',
    avatar: '🦊',
    rang: 1,
    points: 1200,
    joueurs: 6,
    aJoue: true,
    hautsFaits: [],
    profil: {
      xp: 180,
      niveauAvant: 3,
      niveauApres: 4,
      paliers: [],
      legendaires: ['lg:phenix'],
      divins: [{ key: 'dv:seraphin', legende: '', ton: 'eclat' }],
      finitions: [],
    },
  }
  // La fin de soirée vit dans la page de l'invité, qui lit son adresse à
  // l'évaluation (`routes.ts`) : on lui en donne une.
  Object.assign(globalThis, { window: { location: { pathname: '/chez-nadia', search: '', hash: '' } } })
  const props = { fin, profil: null, onSuivante: () => {} }
  // En chemin, sa place est gardée, vide : pas encore de lien.
  assert.ok(!(await rendu('components/FinDeSoiree', 'FinDeSoiree', props)).includes('Le voir sur ton profil'))
  m.chargeur.importer = () => Promise.reject(new TypeError('404'))
  await m.chargerDessins()
  const html = await rendu('components/FinDeSoiree', 'FinDeSoiree', props)
  // Le légendaire et le Divin gagnés ce soir : chacun son lien vers le profil.
  assert.equal(html.split('Le voir sur ton profil').length - 1, 2, html)
  assert.ok(html.includes('href="/profil"'))
  // Ailleurs, un médaillon manquant garde sa place vide : la page dit le reste.
  assert.equal(await rendu('components/Avatar', 'Dessin', { cle: 'lg:phenix' }), '<span class="lg" aria-hidden="true"></span>')
})

// ── 5. Figés dans les listes, animés là où ils sont le sujet ──────────────

test('au podium du quiz, le téléphone anime ses trois médaillons', async () => {
  const podium = [
    { id: 'a', name: 'Jeanne', avatar: '🦊', points: 900, legendaire: 'lg:phenix', finition: 'or' },
    { id: 'b', name: 'Bob', avatar: '🐼', points: 600 },
    { id: 'c', name: 'Léa', avatar: '🐸', points: 300, legendaire: 'dv:seraphin' },
  ]
  const html = await rendu('games/quiz/PlayerView', 'QuizPlayer', {
    view: { phase: 'finished', podium, yourQuizRank: 2, yourQuizTotal: 600 },
    send: () => {},
    teams: [],
  })
  // `.av.lb-avatar:not(.av-sujet)` fige un médaillon dans une liste : les
  // trois marches, elles, sont le sujet de l'écran.
  const avatars = [...html.matchAll(/class="(av [^"]*)"/g)].map(m => m[1])
  assert.equal(avatars.length, 3, html)
  for (const classes of avatars) assert.ok(classes.split(' ').includes('av-sujet'), classes)
})

/**
 * Les règles de la feuille commune, une par sélecteur, avec l'`@media` qui
 * les enferme (vide au premier niveau) : les commentaires ôtés, les
 * sélecteurs sur une ligne.
 */
function regles(): { contexte: string; selecteurs: string[]; corps: string }[] {
  const css = readFileSync(path.join(client, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const trouvees: { contexte: string; selecteurs: string[]; corps: string }[] = []
  const contextes: string[] = []
  let debut = 0
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '}') {
      contextes.pop()
      debut = i + 1
    } else if (css[i] === '{') {
      const tete = css.slice(debut, i).trim()
      if (tete.startsWith('@')) {
        contextes.push(tete)
        debut = i + 1
        continue
      }
      const fin = css.indexOf('}', i)
      trouvees.push({ contexte: contextes.join(' '), selecteurs: tete.split(',').map(s => s.trim().replace(/\s+/g, ' ')), corps: css.slice(i + 1, fin) })
      i = fin
      debut = fin + 1
    }
  }
  return trouvees
}

/** Une règle du premier niveau — pas seulement « réduire les animations » — fige-t-elle ce sélecteur ? */
function fige(selecteur: string, important = false): boolean {
  return regles().some(
    r => r.contexte === '' && r.selecteurs.includes(selecteur) && (important ? /animation:\s*none\s*!important/ : /animation:\s*none/).test(r.corps),
  )
}

/** Un profil d'habitué : le Phénix porté, un second légendaire, un Divin descendu, Holo. */
const HABITUE = {
  id: 'p1',
  login: 'jeanne',
  name: 'Jeanne',
  avatar: '🦊',
  finition: 'holo',
  finitionChoisie: 'holo',
  niveau: 14,
  ouvertes: ['mat', 'argent', 'or', 'holo'],
  eclats: [],
  legendaire: 'lg:phenix',
  legendaires: ['lg:phenix', 'lg:triple'],
  divins: [{ key: 'dv:seraphin', legende: '', ton: 'eclat' }],
  hautsFaits: [],
}

test('un Divin verrouillé se tient tranquille, comme un légendaire verrouillé', async () => {
  // Dix formes animées par nébuleuse, que le navigateur ne compose pas : les
  // cinq de la grille d'Apparence — l'onglet par défaut de tout profil, même
  // neuf — tenaient le téléphone à 45 % de son processeur (perf-client-1).
  assert.ok(fige('.lg-verrou *', true), 'témoin : la règle des légendaires verrouillés')
  assert.ok(fige('.dv-voile *', true), 'une règle fige les formes d’un Divin verrouillé')
  const html = await rendu('components/Divin', 'Divin', { cle: 'dv:seraphin', verrouille: true })
  assert.match(html, /<svg class="dv dv-seraphin dv-voile"/)
})

test('dans la grille des avatars, seuls bougent le porté, l’ouvert et celui qu’on survole', async () => {
  // 219 animations chez un habitué, pour un seul avatar regardé
  // (design-recompenses-4) : les halos de finition sous chaque emoji, les
  // formes de chaque médaillon.
  // Une famille à la fois (`familleInitiale`) : chacune a sa grille.
  const cases: { classes: string[]; nom: string }[] = []
  for (const familleInitiale of ['branches', 'emojis', 'legendaires']) {
    const html = await rendu('components/Apparence', 'MesAvatars', { profil: HABITUE, busy: false, enregistrer: () => {}, familleInitiale })
    assert.match(html, /class="emoji-grid grille-unique/)
    // Les cases des grilles : pas les lignes des branches, qui déplient sans rien animer.
    for (const m of html.matchAll(/<button[^>]*class="([^"]*)"[^>]*aria-label="([^"]*)"/g)) {
      if (m[1] !== 'ligne-branche') cases.push({ classes: m[1].split(' '), nom: m[2] })
    }
  }
  assert.ok(cases.length > 40, 'les grilles sont rendues')
  for (const c of cases) assert.ok(c.classes.includes('case-avatar'), c.nom)
  // Le porté, et lui seul, est `selected` : c'est lui que la feuille laisse bouger.
  assert.deepEqual(
    cases.filter(c => c.classes.includes('selected')).map(c => c.nom),
    ['Le Phénix, légendaire, porté'],
  )
  for (const dedans of ['.lg *', '.dv *', '.pt *', '.av::before', '.av::after']) {
    const selecteur = `.grille-unique .case-avatar:not(.selected):not(.ouverte):not(:hover) ${dedans}`
    assert.ok(fige(selecteur), selecteur)
  }
})

test('les aperçus des finitions bougent portés ou survolés, pas avant', async () => {
  // Sous un légendaire porté, chaque aperçu redessinait son médaillon et son
  // cercle, sans fin (perf-client-1).
  const html = await rendu('components/Apparence', 'MesFinitions', { profil: HABITUE, busy: false, enregistrer: () => {} })
  assert.match(html, /<div class="finitions">/)
  const boutons = [...html.matchAll(/<button[^>]*class="(finition-btn[^"]*)"/g)].map(m => m[1].split(' '))
  assert.equal(boutons.length, 8, 'la plus belle, et les sept')
  assert.equal(boutons.filter(b => b.includes('selected')).length, 1, 'une seule portée')
  for (const dedans of ['.av::before', '.av::after', '.lg *']) {
    const selecteur = `.finitions .finition-btn:not(.selected):not(:hover) ${dedans}`
    assert.ok(fige(selecteur), selecteur)
  }
})

test('dans les galeries d’une carte, seul le médaillon qu’on regarde bouge', () => {
  // Trois médaillons animés prenaient le tiers du fil principal d'un
  // téléphone moyen, et les galeries d'un habitué le saturaient
  // (perf-client-4) : la carte a déjà son sujet, l'avatar qu'il porte.
  const carte = readFileSync(path.join(client, 'components/CarteJoueur.tsx'), 'utf8')
  assert.equal(carte.split('className="carte-legendaire"').length - 1, 2, 'les deux galeries, Divins et légendaires')
  for (const dedans of ['.lg *', '.dv *']) assert.ok(fige(`.carte-legendaire:not(:hover) ${dedans}`), dedans)
})

test('dans une liste, les halos des finitions et les paillettes de l’Éclat se tiennent tranquilles aussi', () => {
  // Un seul Éclat dans la salle d'attente recalculait le style soixante fois
  // par seconde, toute la soirée ; les halos d'une salle d'habitués tournaient
  // tous au mur — l'arbitrage du 27 septembre 2026 [perf-client-7]. Ils
  // bougent là où ils sont le sujet (`av-sujet`).
  for (const selecteur of [
    '.av.lb-avatar:not(.av-sujet)::before',
    '.av.lb-avatar:not(.av-sujet)::after',
    '.player-chip .av::before',
    '.player-chip .av::after',
  ])
    assert.ok(fige(selecteur), selecteur)
})
