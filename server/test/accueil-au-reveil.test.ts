// L'accueil d'un profil au réveil du serveur.
//
// Le 6 novembre 2026, au réveil de la production, `GET /api/joueur/moi` a mis
// 27,8 s à répondre (`retours/2026-11-06/stabilite-des-joueurs.md`), et le
// client renonce à vingt secondes (`DELAI_REQUETE_MS`). L'accueil prenait ce
// renoncement pour « pas de profil » : à son animateur, les trois gros
// boutons d'un invité, « J'anime » au-dessus — sa console, lue en mémoire,
// avait répondu à temps (le retour du propriétaire du 6 novembre 2026,
// capture à l'appui : « j'ai cette page au démarrage qui ensuite tombe sur
// l'accueil normal »). Rien ne relisait le profil ensuite : l'accueil normal
// n'arrivait qu'au rechargement, le serveur chaud.
//
// Rejoué dans Chromium avant la correction — la lecture du profil retenue
// vingt-cinq secondes, l'accueil d'un invité à la vingt et unième, et pour de
// bon. Vérifié ici sans navigateur, comme le quiz du jour
// (`jour-telephone.test.ts`) : les modules que la page appelle, son écran
// d'avant le profil rendu en HTML, et, pour son câblage, sa source.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { ecrireAttente } from '../src/core/page'
import { MOTIFS } from '../../shared/erreurs'
import { espacesFines } from '../../shared/typographie'

// Le client compile son JSX pour un `React` global, et la page lit son adresse et ses balises en se chargeant.
const memoire = new Map<string, string>()
Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/', search: '', hash: '', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false, querySelector: () => null },
  localStorage: { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => memoire.set(k, v), removeItem: (k: string) => memoire.delete(k) },
  history: { state: null },
})

const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)
/** Un module du client, à part des autres chargements du même fichier : `currentMe` ne demande qu'une fois par module. */
const duClient = (f: string, instance = ''): Promise<any> => import(`${client(f).href}${instance && `?${instance}`}`)
const boutons = (html: string) => [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim())

/** Ce que le serveur répond, ou `'delai'` : rien dans les vingt secondes, et le client renonce (`AbortError`). */
type Reponse = 'delai' | { statut: number; corps: unknown }

/**
 * Le serveur qui se réveille, vu du téléphone : chaque requête reçoit la réponse suivante. Un délai dépassé
 * avance l'horloge des vingt secondes que le client a attendues avant de renoncer — ce que `auReveil` lit pour
 * relancer sans attendre de plus. Rend les adresses demandées.
 */
async function serveurQuiSeReveille<T>(reponses: Reponse[], faire: () => Promise<T>): Promise<{ lu: T; demandes: string[] }> {
  const demandes: string[] = []
  const avant = { fetch: globalThis.fetch, now: Date.now }
  let horloge = Date.UTC(2026, 10, 6, 5, 52)
  Date.now = () => horloge
  globalThis.fetch = (async (adresse: string) => {
    demandes.push(adresse)
    const r = reponses.shift()
    if (!r) throw new Error(`une demande de trop : ${adresse}`)
    if (r === 'delai') {
      horloge += 20_000
      throw Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })
    }
    return new Response(JSON.stringify(r.corps), { status: r.statut, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  try {
    return { lu: await faire(), demandes }
  } finally {
    globalThis.fetch = avant.fetch
    Date.now = avant.now
  }
}

const CAMILLE = { id: 'p-camille', name: 'Camille', avatar: '🦊' }
const SON_SALON = { slug: 's-camille', title: 'La soirée de Camille', eyebrow: 'La soirée', headline: 'de Camille' }

test('avant son profil, l’accueil attend, puis dit l’échec : jamais les trois gros boutons d’un invité', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { AvantLeProfil } = await duClient('views/ProfilApp.tsx')
  const rendre = (props: { reveil: boolean; panne: string }) =>
    renderToStaticMarkup(React.createElement(AvantLeProfil, { ...props, onReessayer: () => {}, onRejoindre: () => {} }))

  // L'attente, celle même que le serveur a écrite dans la page : rien ne bouge quand React la remplace.
  // L'accueil y mettait son « Chargement… » à lui, en serif, et la page sautait.
  assert.equal(rendre({ reveil: false, panne: '' }), ecrireAttente('<div id="root"></div>').replace(/^<div id="root">|<\/div>$/g, ''))

  // Le réveil : ce qui se passe, et qu'il n'y a rien à faire — sans un bouton.
  const reveil = rendre({ reveil: true, panne: '' })
  assert.match(reveil, /<div class="attente" role="status"><p class="muted">Réveil du serveur…<\/p>/)
  assert.ok(reveil.includes(espacesFines('Ça prend parfois une minute : ta page arrive d’elle-même.')), reveil)
  assert.deepEqual(boutons(reveil), [])

  // Le serveur se tait toujours : pourquoi, de quoi réessayer, et la soirée qu'on rejoint sans profil.
  for (const motif of [MOTIFS.silence, MOTIFS.redemarrage, MOTIFS.panne]) {
    const echec = rendre({ reveil: true, panne: motif })
    assert.ok(echec.includes(`<p class="error">${espacesFines(motif)}</p>`), echec)
    assert.match(echec, /role="status"/, 'dit au lecteur d’écran, à la place du réveil')
    assert.deepEqual(boutons(echec), ['Réessayer', 'Rejoindre une soirée'])
    for (const invite of ['Jouer sans compte', 'Me connecter', 'Créer un profil', 'J’anime']) assert.ok(!echec.includes(invite), invite)
  }
})

test('la page ne montre l’accueil d’un invité que sur la réponse du serveur', () => {
  const source = readFileSync(client('views/ProfilApp.tsx'), 'utf8')
  // La première lecture attend le réveil, le dit, et son échec se dit.
  const debut = source.indexOf('const lireAuDepart = () => {')
  assert.ok(debut > 0, 'la première lecture de la page')
  const lecture = source.slice(debut, source.indexOf('\n  }\n', debut))
  assert.match(lecture, /auReveil\(\(\) => relire\(\{ missionsDemandees: VUE === 'accueil' \}\), \{ surAttente: \(\) => setReveil\(true\) \}\)/)
  assert.match(lecture, /\(\) => setChargement\(false\),\n\s*\(e: unknown\) => setPanne\(motifDe\(e\)\),/)
  // Un échec n'est pas une absence : seul `r.profile`, la réponse du serveur, pose un profil vide.
  assert.doesNotMatch(source, /setProfil\(null\)/, 'l’échec d’une lecture faisait l’accueil d’un invité')
  assert.equal([...source.matchAll(/setChargement\(false\)/g)].length, 1, 'l’accueil ne paraît qu’une lecture faite')
  // Tant que le serveur n'a rien dit, la page attend ou dit pourquoi — « Réessayer » relance la même lecture.
  assert.match(source, /if \(chargement\) return <AvantLeProfil reveil=\{reveil\} panne=\{panne\} onReessayer=\{lireAuDepart\} onRejoindre=\{\(\) => setRejoindre\(true\)\} \/>/)
  // Et la page la lance à son ouverture, après ses missions — qu'aucun de ses essais ne redemande.
  assert.match(source, /if \(VUE === 'accueil'\) void relireLesMissions\(\)\.catch\(\(\) => \{\}\)\n\s*lireAuDepart\(\)\n\s*\}, \[\]\)/)
})

test('au réveil, la lecture de l’accueil relance là où elle a renoncé, et rend le profil', async () => {
  const { api, auReveil } = await duClient('api.ts', 'accueil')
  let prevenu = 0
  const { lu, demandes } = await serveurQuiSeReveille<{ profile: typeof CAMILLE | null }>(
    ['delai', { statut: 200, corps: { profile: CAMILLE, espace: SON_SALON, enCours: [] } }],
    // Ce que lance la page (`lireAuDepart`), sans ce qu'elle pose de la réponse.
    () => auReveil(() => api.joueur.moiAccueil(), { surAttente: () => prevenu++ }),
  )
  assert.equal(lu.profile?.name, 'Camille', 'le profil, pas un invité')
  assert.deepEqual(demandes, ['/api/joueur/moi?accueil', '/api/joueur/moi?accueil'], 'la même adresse que le préchargement')
  assert.equal(prevenu, 1, '« Réveil du serveur… », une fois')
})

test('au réveil, la console attend aussi le serveur : un délai dépassé n’est pas une console fermée', async () => {
  const { currentMe } = await duClient('api.ts', 'console')
  const { lu, demandes } = await serveurQuiSeReveille<{ space: typeof SON_SALON } | null>(
    ['delai', 'delai', { statut: 200, corps: { account: { slug: SON_SALON.slug }, space: SON_SALON } }],
    () => currentMe(),
  )
  // Renoncée, elle ôtait la carte « J'anime » de l'accueil d'un animateur sans profil, jusqu'au rechargement.
  assert.equal(lu?.space.title, 'La soirée de Camille')
  assert.deepEqual(demandes, ['/api/auth/me', '/api/auth/me', '/api/auth/me'])
})

test('un invité reçoit 401 à la console : personne, sans rien attendre', async () => {
  const { currentMe } = await duClient('api.ts', 'invite')
  const { lu, demandes } = await serveurQuiSeReveille([{ statut: 401, corps: { error: 'Connexion requise' } }], () => currentMe())
  assert.equal(lu, null)
  assert.deepEqual(demandes, ['/api/auth/me'], 'un refus ne se rejoue pas')
})
