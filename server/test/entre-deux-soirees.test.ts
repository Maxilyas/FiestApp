// Entre deux soirées, le téléphone. Le propriétaire du dépôt, le 28 septembre
// 2026 : « Lorsqu'on finit une soirée, on est obligé de rejoindre la soirée
// suivante, qui est complètement pas intuitif. Et si on va depuis la console
// animateur et qu'on met jouer sur ce téléphone, ça va au résumé de la
// soirée avec soirée suivante, alors que ça ne devrait plus apparaître. »
//
// La fin de soirée se rouvrait à chaque chargement de `/<espace>` pendant
// douze heures, et ne partait que par « Rejoindre la soirée suivante » : son
// seul geste de sortie, un bouton toujours là, vers une soirée qui
// n'existait pas encore. L'onglet de jeu laissé en arrière-plan pendant la
// clôture la recevait aussi, au réveil de son jeton (`soiree-close`), quand
// l'animateur le rouvrait depuis sa console. Elle ne se rouvre plus qu'au
// retour sur la page — un rechargement, le retour du navigateur — ; qui
// arrive — un lien, le QR, « Jouer depuis cet appareil » — trouve l'entrée,
// la soirée close en une ligne ; et la suivante ne se propose qu'une fois
// commencée. Chaque test échouait avant, sauf celui du retour sur la page :
// il garde ce qui marchait.
//
// Pas de navigateur en intégration continue : le module d'état du téléphone
// chargé dans Node, sous l'adresse de l'espace, avec ce que le navigateur
// dit de son chargement ; la fin rendue en HTML ; pour le câblage de la page,
// sa source.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { estUnRetour, suivanteCommencee, type FinDeSoiree } from '../../shared/fin'
import type { PublicPlayer, SessionSummary } from '../../shared/types'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const SLUG = 'chez-nadia'
const soiree = { id: '2026-09-27-k7x2q', titre: 'La soirée de Nadia', slug: SLUG }
const FIN: FinDeSoiree = {
  soiree,
  joueurId: 'p1',
  nom: 'Jeanne',
  avatar: '🦊',
  rang: 1,
  points: 1200,
  joueurs: 6,
  aJoue: true,
  hautsFaits: [],
}
/** Le jeton de Jeanne, retenu sur son téléphone pour la soirée qui vient de se clore. */
const SON_JETON = { [`quizz.me.${SLUG}`]: JSON.stringify({ playerId: 'p1', token: 'jeton-de-jeanne' }) }

/** Ce que le test lit du module — écrit à la main : le typecheck du serveur ne suit pas le client. */
interface EtatDuTelephone {
  getState(): { fin: FinDeSoiree | null; me: { token: string } | null }
  finRouverte(): boolean
  garderFin(slug: string, fin: FinDeSoiree): void
  recevoirFinRendue(slug: string, fin: FinDeSoiree): void
  premierEcranMontre(): void
  soireeGardee(slug: string): { soiree: { id: string }; joueurId?: string; fin?: FinDeSoiree; ouverte: boolean } | null
}

/** Le stockage d'un téléphone : ce que son navigateur garde d'une page à l'autre. */
function stockage(depart: Record<string, string> = {}) {
  const cles = new Map(Object.entries(depart))
  return {
    getItem: (k: string) => cles.get(k) ?? null,
    setItem: (k: string, v: string) => void cles.set(k, v),
    removeItem: (k: string) => void cles.delete(k),
  }
}
type Stockage = ReturnType<typeof stockage>

/**
 * La page de l'espace qui se charge sur ce téléphone : une instance neuve du
 * module d'état, sous l'adresse de l'espace, avec ce que le navigateur dit de
 * la navigation — `navigate` (un lien, le QR, « Jouer depuis cet
 * appareil »), `reload`, `back_forward`.
 */
async function page(chargement: string, telephone: Stockage, instance: string): Promise<EtatDuTelephone> {
  Object.assign(globalThis, {
    window: { location: { pathname: `/${SLUG}`, search: '', hash: '' } },
    localStorage: telephone,
  })
  const perf = performance as { getEntriesByType: (type: string) => unknown[] }
  const origine = perf.getEntriesByType
  perf.getEntriesByType = type => (type === 'navigation' ? [{ type: chargement }] : origine.call(performance, type))
  try {
    return await import(`${new URL('../../client/src/state.ts', import.meta.url).href}?${instance}`)
  } finally {
    perf.getEntriesByType = origine
  }
}

/**
 * Une page de l'espace chargée dans son propre processus : l'adresse de la
 * page ouverte se lit une fois pour toutes (`routes.ts`), et ce fichier-ci
 * est sous celle du jeu. Rend la fin qu'elle met à l'écran, et ce que le
 * téléphone garde ensuite.
 */
function pageAPart(
  chemin: string,
  chargement: string,
  depart: Record<string, string>,
): { fin: FinDeSoiree | null; garde: Record<string, string> } {
  const script = `
    const cles = new Map(Object.entries(${JSON.stringify(depart)}))
    globalThis.window = { location: { pathname: ${JSON.stringify(chemin)}, search: '', hash: '' } }
    globalThis.localStorage = { getItem: k => cles.get(k) ?? null, setItem: (k, v) => void cles.set(k, v), removeItem: k => void cles.delete(k) }
    const origine = performance.getEntriesByType.bind(performance)
    performance.getEntriesByType = type => (type === 'navigation' ? [{ type: ${JSON.stringify(chargement)} }] : origine(type))
    const etat = await import(${JSON.stringify(new URL('../../client/src/state.ts', import.meta.url).href)})
    process.stdout.write(JSON.stringify({ fin: etat.getState().fin, garde: Object.fromEntries(cles) }))
  `
  const sortie = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', script], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8',
  })
  return JSON.parse(sortie)
}

/** Les liens et boutons d'un rendu, dans l'ordre : leur texte, et où ils mènent. */
function gestes(html: string): string[] {
  return [...html.matchAll(/<(a|button)\b([^>]*)>(.*?)<\/\1>/g)].map(([, balise, attributs, contenu]) => {
    const texte = contenu.replace(/<[^>]+>/g, '').trim()
    const href = /href="([^"]*)"/.exec(attributs)?.[1]
    return `${texte}${href ? ` → ${href.replace(/&amp;/g, '&')}` : ''}${balise === 'button' ? ' [bouton]' : ''}`
  })
}

/** La fin de soirée, rendue en HTML. */
async function rendu(props: object): Promise<string> {
  // La page qu'elle habite lit son adresse et son stockage à l'évaluation.
  Object.assign(globalThis, { window: { location: { pathname: `/${SLUG}`, search: '', hash: '' } }, localStorage: stockage() })
  const module = await import(new URL('../../client/src/components/FinDeSoiree.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module.FinDeSoiree, props))
}

const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

// ── 1. Arriver ou revenir ─────────────────────────────────────────────────

test('ce qui fait un retour sur la page, et ce qui fait une arrivée', () => {
  // Le navigateur le dit (Navigation Timing), ou son ancien chiffre.
  for (const retour of ['reload', 'back_forward', 1, 2]) assert.equal(estUnRetour(retour), true, String(retour))
  // Un lien, le QR, une adresse tapée — et un navigateur muet.
  for (const arrivee of ['navigate', 'prerender', 0, undefined]) assert.equal(estUnRetour(arrivee), false, String(arrivee))
})

test('« Jouer depuis cet appareil », après la clôture : l’entrée, jamais la fin d’avant', async () => {
  // La soirée s'est close sous les yeux de Nadia, qui jouait sur son
  // téléphone : sa fin est gardée, à rouvrir.
  const telephone = stockage()
  ;(await page('navigate', telephone, 'la-cloture')).garderFin(SLUG, FIN)

  // De sa console, « Jouer depuis cet appareil » rouvre l'onglet de jeu :
  // une arrivée. Elle vient jouer la suivante.
  const arrivee = await page('navigate', telephone, 'depuis-la-console')
  assert.equal(arrivee.getState().fin, null, 'la fin d’avant ne se rouvre pas')
  assert.equal(arrivee.finRouverte(), false)
  // L'entrée propose la soirée close en une ligne, « mon bilan » compris…
  const gardee = arrivee.soireeGardee(SLUG)
  assert.equal(gardee?.soiree.id, soiree.id)
  assert.equal(gardee?.joueurId, 'p1')
  // …et sa fin ne se rouvrira plus, pas même au rechargement de l'entrée.
  assert.equal(gardee?.ouverte, false)
  assert.equal(gardee?.fin, undefined)
  assert.equal((await page('reload', telephone, 'l-entree-rechargee')).getState().fin, null)
})

test('revenu sur la page — rechargement, retour du bilan —, le téléphone retrouve sa fin', async () => {
  for (const chargement of ['reload', 'back_forward']) {
    const telephone = stockage()
    ;(await page('navigate', telephone, `${chargement}-la-cloture`)).garderFin(SLUG, FIN)
    const revenu = await page(chargement, telephone, chargement)
    assert.equal(revenu.getState().fin?.nom, 'Jeanne', chargement)
    assert.equal(revenu.finRouverte(), true, chargement)
  }
})

test('« Mon bilan », puis le retour du navigateur : le bilan ne ferme pas la fin', () => {
  // Le bilan, que la fin ouvre dans son onglet, lit aussi le module d'état —
  // arrivé par un lien, il la fermait, et le retour ne la retrouvait plus.
  const cle = `quizz.fin.${SLUG}`
  const gardee = JSON.stringify({ v: 1, soiree, joueurId: 'p1', fin: FIN, recueLe: Date.now(), ouverte: true })
  const bilan = pageAPart(`/${SLUG}/soirees/${soiree.id}/bilan`, 'navigate', { [cle]: gardee })
  assert.equal(bilan.fin, null, 'le bilan ne montre pas la fin')
  assert.equal(bilan.garde[cle], gardee, 'et n’y touche pas')
  const retour = pageAPart(`/${SLUG}`, 'back_forward', bilan.garde)
  assert.equal(retour.fin?.nom, 'Jeanne', 'le retour du navigateur la retrouve')
})

test('le jeton d’une soirée close : réveillé sur la page, sa fin ; arrivé pour jouer, l’entrée', async () => {
  // L'onglet de jeu, en arrière-plan pendant la clôture, n'a pas reçu sa fin :
  // il porte encore le jeton de la soirée close, et le serveur la lui rend
  // (`soiree-close`). Rouvert depuis la console, il arrive pour jouer.
  const arrive = await page('navigate', stockage(SON_JETON), 'jeton-a-l-arrivee')
  assert.equal(arrive.getState().me?.token, 'jeton-de-jeanne', 'il se présente avec son jeton')
  arrive.recevoirFinRendue(SLUG, FIN)
  assert.equal(arrive.getState().fin, null, 'la fin d’avant ne s’affiche pas')
  assert.equal(arrive.getState().me, null, 'il n’incarne plus personne : l’entrée s’ouvre')
  assert.equal(arrive.soireeGardee(SLUG)?.joueurId, 'p1', 'la soirée close en une ligne, « mon bilan » compris')
  assert.equal(arrive.soireeGardee(SLUG)?.ouverte, false)

  // Le téléphone qui jouait là, réveillé après la clôture : sa fin, comme
  // s'il avait été là — et il la retrouve au retour.
  const reveille = await page('navigate', stockage(SON_JETON), 'jeton-au-reveil')
  reveille.premierEcranMontre()
  reveille.recevoirFinRendue(SLUG, FIN)
  assert.equal(reveille.getState().fin?.nom, 'Jeanne')
  assert.equal(reveille.soireeGardee(SLUG)?.ouverte, true)

  // Revenu sur la page, la même.
  const recharge = await page('reload', stockage(SON_JETON), 'jeton-au-retour')
  recharge.recevoirFinRendue(SLUG, FIN)
  assert.equal(recharge.getState().fin?.nom, 'Jeanne')
})

// ── 2. La soirée suivante, une fois commencée ─────────────────────────────

test('la soirée suivante commence au premier invité inscrit, ou au premier quiz', () => {
  const invite = { id: 'p9', name: 'Zoé', avatar: '🦋', score: 0, teamId: null } satisfies PublicPlayer
  const quiz: SessionSummary = { id: 's1', participantIds: [] }
  assert.equal(suivanteCommencee(null), false, 'pas encore d’instantané')
  assert.equal(suivanteCommencee({ players: [], session: null }), false, 'la salle vide de la clôture')
  assert.equal(suivanteCommencee({ players: [invite], session: null }), true, 'un invité inscrit')
  assert.equal(suivanteCommencee({ players: [], session: quiz }), true, 'un quiz lancé')
})

test('la fin ne propose la soirée suivante qu’une fois commencée, et en haut', async () => {
  const bilan = `/${SLUG}/soirees/${soiree.id}/bilan#p=p1`
  const souvenir = `/${SLUG}/soirees/${soiree.id}/souvenir`
  // Rien de commencé : relire sa soirée, créer son profil — rien vers une
  // soirée qui n'existe pas encore.
  const close = await rendu({ fin: FIN, profil: null, onSuivante: () => {} })
  assert.doesNotMatch(close, /soirée suivante|La rejoindre/)
  assert.deepEqual(gestes(close), [
    `Mon bilan → ${bilan}`,
    `Revoir la soirée → ${souvenir}`,
    'Créer mon profil → /profil?creer=1&prenom=Jeanne&avatar=%F0%9F%A6%8A',
  ])

  // Un invité s'est inscrit à la suivante : elle se propose, avant tout le reste.
  const commencee = await rendu({ fin: FIN, profil: null, suivante: true, onSuivante: () => {} })
  assert.match(commencee, /<div class="card notice fin-suivante" role="status"><span id="fin-suivante">La soirée suivante commence<\/span>/)
  assert.equal(gestes(commencee)[0], 'La rejoindre [bouton]')
  // Hors de sa phrase — la liste des boutons d'un lecteur d'écran —, elle le décrit encore.
  assert.match(commencee, /<button type="button" class="btn btn-primary btn-small" aria-describedby="fin-suivante">La rejoindre<\/button>/)
  assert.ok(commencee.indexOf('fin-suivante') < commencee.indexOf('fin-moi'), 'au-dessus de sa soirée')
})

// ── 3. Le câblage de la page ──────────────────────────────────────────────

test('la page câble le premier écran, la fin rendue et la soirée suivante', () => {
  const joueur = source('views/PlayerApp.tsx')
  // Le premier écran montré, le téléphone n'arrive plus : il y est.
  assert.match(joueur, /if \(!affiche\) return\s*setDejaVu\(true\)[\s\S]{0,300}?premierEcranMontre\(\)/)
  // La fin que le serveur rend au jeton d'une soirée close passe par la règle de l'arrivée.
  assert.match(joueur, /ack\.reason === 'soiree-close'\) \{\s*if \(ack\.fin\) \{\s*recevoirFinRendue\(slug, ack\.fin\)/)
  assert.doesNotMatch(joueur, /garderFin\(/)
  // La fin sait si la suivante a commencé.
  assert.match(joueur, /suivante=\{suivanteCommencee\(snap\)\}/)
  // La clôture en direct, elle, s'affiche toujours : le téléphone était là.
  assert.match(source('socket.ts'), /socket\.on\('soiree:fin', fin => \{[\s\S]*?garderFin\(slug, fin\)\s*\}\s*setState\(\{ fin, gain: null \}\)/)
})

test('sous sa fin de soirée, le chef du salon a deux gestes de plus : encore un quiz avec eux, ou ce n’était qu’un essai', async () => {
  const chef = gestes(await rendu({ fin: FIN, profil: null, onSuivante: () => {}, chef: true }))
  assert.ok(chef.includes('Encore un quiz, avec eux → /salon'), chef.join(' | '))
  assert.ok(chef.includes('C’était un essai [bouton]'))
  const invite = gestes(await rendu({ fin: FIN, profil: null, onSuivante: () => {} }))
  assert.ok(!invite.some(g => g.includes('/salon') || g.includes('essai')), 'un invité ne les voit pas')
  // « C'était un essai » retire la soirée de l'historique, crédits compris (`retirerSoireeEntiere`).
  assert.match(source('components/FinDeSoiree.tsx'), /await api\.archives\.remove\(fin\.soiree\.id\)/)
  assert.match(source('views/PlayerApp.tsx'), /chef=\{chefIci\(slug\) !== null\}/)
})
