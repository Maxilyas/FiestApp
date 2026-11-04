// L'administration (`/admin`), refaite à la manière de « Mon compte » (la
// remarque du propriétaire du 3 octobre 2026), puis devenue le QG (le
// 13 octobre, `qg.test.ts`) : une vue d'ensemble, puis une page par sujet à
// son adresse — les profils, les salons, le catalogue, le quiz du jour, la
// campagne. Plus de « Créer un compte » — chacun ouvre son salon depuis son
// profil — ni de tableau des comptes, où « p-k3x9… en attente » ne disait à
// qui était quoi : « Les salons » nomme chaque espace par son titulaire, et
// garde celui qui n'en a plus.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil } from './banc'
import type { EspaceDAdministration } from '../../shared/space'
import { MODES_DU_QG } from '../../shared/qg'

const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')
const lire = (url: string, cookie: string, chemin: string) =>
  fetch(`${url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

test('« Les salons » : chaque espace, son titulaire, ses quiz — et le salon d’un profil supprimé reste, sans titulaire', async () => {
  const banc = await demarrer()
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    await ecrire(banc.url, '/api/joueur/espace', {}, lea)
    const leaId = (await lire(banc.url, lea, '/api/joueur/moi')).corps.profile.id as string

    const espaces = (await lire(banc.url, admin, '/api/admin/espaces')).corps as EspaceDAdministration[]
    const sien = espaces.find(e => e.toi)
    assert.ok(sien, 'l’espace de l’administrateur, marqué')
    assert.equal(sien.salon, false, 'un compte à mot de passe n’est pas un salon')
    const salon = espaces.find(e => e.titulaire?.nom === 'Léa')
    assert.ok(salon, 'le salon de Léa, à son nom')
    assert.deepEqual([salon.salon, salon.quiz, salon.toi, salon.titulaire?.avatar], [true, 0, false, '🦊'])

    assert.equal((await ecrire(banc.url, `/api/admin/profils/${leaId}`, undefined, admin, 'DELETE')).status, 200)
    const apres = ((await lire(banc.url, admin, '/api/admin/espaces')).corps as EspaceDAdministration[]).find(e => e.id === salon.id)
    assert.ok(apres, 'le salon reste : les souvenirs de ses soirées s’ouvrent toujours')
    assert.deepEqual([apres.salon, apres.titulaire], [true, null], 'détaché, il reste un salon — sans titulaire')
  } finally {
    await banc.close()
  }
})

test('/admin : le QG — la vue d’ensemble d’abord, son journal et son serveur, puis six pages, chacune à son adresse', () => {
  // Le QG (le souhait du propriétaire du 13 octobre 2026) a remplacé le
  // tableau de bord à la manière de « Mon compte » : la vue d'ensemble, une
  // barre de côté à l'ordinateur, la liste des pages au téléphone.
  const page = source('views/AdminApp.tsx')
  // Ce qui ne sert plus est parti : la création de compte et le tableau des comptes.
  assert.doesNotMatch(page, /CreateForm|<h2>Créer un compte|accounts-table|<h2>Tous les comptes/)
  assert.doesNotMatch(source('api.ts'), /create: \(input: \{ login: string; name: string; slug: string \}\)/)
  // Le journal, le serveur et les écrans, à leur adresse — l'activité de tous les modes depuis le 17 octobre 2026, la
  // maintenance à côté du serveur depuis le 19 (`maintenance.test.ts`), et le même jour les annonces, sous « Animer »
  // (`annonces.test.ts`), et les erreurs à trier, avant le serveur (`qg-erreurs.test.ts`) ; les nouveautés à l'affiche, après
  // les annonces, le 1er novembre 2026 (`affiches.test.ts`) ; la base et le miroir, sortis du serveur, le 4 novembre
  // 2026 (le QG 2, `qg-serveur-routes.test.ts`), le direct, le même jour (`qg-direct.test.ts`), les alertes et leurs
  // incidents (`qg-alertes.test.ts`), les joueurs, en tête de l'audience (`qg-joueurs.test.ts`), les téléphones
  // (`qg-telephones.test.ts`), et le Cabinet de curiosités, après la campagne (`qg-cabinet.test.ts`) ; l'activité devenue
  // les modes côte à côte au lot 5, à la même adresse (`qg-modes.test.ts`) ; les questions jouées et les réserves, sous
  // « Contenu », avant les signalements (`qg-contenu.test.ts`) ; les animateurs à la place des salons, sous « Audience » — les
  // salons en sont l'onglet (`qg-animateurs.test.ts`) ; les ancres d'avant y mènent encore, `#salons` compris.
  assert.match(
    page,
    /const ECRANS: readonly Ecran\[\] = \['journal', 'erreurs', 'serveur', 'maintenance', 'activite', 'soirees', 'profils', 'animateurs', 'catalogue', 'jour', 'campagne', 'cabinet', 'duels', 'economie', 'signalements', 'annonces', 'affiches', 'base', 'direct', 'alertes', 'joueurs', 'telephones', 'questions', 'reserves'\]/,
  )
  assert.match(page, /const ANCIENNES: Record<string, Ecran> = \{ 'les-profils': 'profils', 'quiz-du-jour': 'jour' \}/)
  // « Les salons » est devenu l'onglet des animateurs : son adresse d'avant ouvre cet onglet, pas le carnet.
  assert.match(page, /const ONGLETS_D_AVANT: Record<string, \{ ecran: Ecran; onglet: string \}> = \{ salons: \{ ecran: 'animateurs', onglet: 'salons' \} \}/)
  // L'onglet ouvert est dans l'adresse (`/admin#serveur/gels`) : le retour du navigateur et un lien partagé le gardent.
  assert.match(page, /history\.pushState\(\{ \.\.\.history\.state, depuisAdmin: true \}, '', adresseDe\(e, o\)\)/)
  assert.match(page, /const adresseDe = \(e: Ecran \| null, onglet\?: string \| null\) => \(e \? `\/admin#\$\{e\}\$\{onglet \? `\/\$\{onglet\}` : ''\}` : '\/admin'\)/)
  // À l'ordinateur, le rail mène à chaque écran ; au téléphone, la feuille « Pages », tirée du même rail — mêmes groupes,
  // mêmes noms, même ordre, ses pastilles — : écrite à la main à côté, elle ne lui ressemblait plus (la revue
  // d'ergonomie du 4 novembre 2026). Chaque page dit ce qu'on y trouve, que la palette cherche aussi.
  for (const e of ['journal', 'erreurs', 'serveur', 'maintenance', 'activite', 'soirees', 'profils', 'animateurs', 'catalogue', 'jour', 'campagne', 'cabinet', 'duels', 'economie', 'signalements', 'annonces', 'affiches', 'base', 'direct', 'alertes', 'joueurs', 'telephones', 'questions', 'reserves']) {
    assert.match(page, new RegExp(`\\{ ecran: '${e}', nom: '[^']+', icone: '[a-z-]+', description: '[^']+'`), e)
  }
  assert.doesNotMatch(page, /<Ligne\s/, 'plus de liste des pages écrite à la main')
  assert.equal([...page.matchAll(/PAGES_DU_QG\.map\(\(\{ groupe, pages \}\) =>/g)].length, 2, 'le rail et la feuille « Pages » lisent la même liste')
  assert.match(page, /<Feuille titre="Les pages du QG"/)
  // Une icône par page : l'œil disait « En direct » et « Joueurs », le triangle « Maintenance » et les alertes.
  const icones = [...page.matchAll(/\{ ecran: (?:'[a-z]+'|null), nom: '[^']+', icone: '([a-z-]+)'/g)].map(m => m[1])
  assert.equal(new Set(icones).size, icones.length, `une icône par page : ${icones.join(', ')}`)
  // Le rail par moment d'usage : une panne se voit, se comprend, se ferme et se dit sans quitter « Commande ».
  const groupe = (nom: string) => page.slice(page.indexOf(`groupe: '${nom}'`), page.indexOf(']', page.indexOf(`groupe: '${nom}'`)))
  assert.deepEqual(
    [...groupe('Commande').matchAll(/ecran: ('[a-z]+'|null)/g)].map(m => m[1]),
    ['null', "'direct'", "'alertes'", "'erreurs'", "'maintenance'", "'journal'"],
  )
  assert.deepEqual([...groupe('Technique').matchAll(/ecran: '([a-z]+)'/g)].map(m => m[1]), ['serveur', 'base', 'telephones'])
  assert.deepEqual([...groupe('Animer').matchAll(/ecran: '([a-z]+)'/g)].map(m => m[1]), ['annonces', 'affiches'])
  // L'économie vit des modes ; « Profils » ressemblait à « Joueurs » : on y cherche quelqu'un.
  assert.match(groupe('Modes'), /\{ ecran: 'duels'[^}]*\},\s*(\/\/[^\n]*\n\s*)*\{ ecran: 'economie'/)
  assert.match(groupe('Audience'), /\{ ecran: 'profils', nom: 'Chercher un joueur'/)
  // Le contenu : ce que chaque question jouée donne, puis ce qui nourrit les modes — avant les signalements, où l'on relit.
  assert.match(
    page,
    /\{ ecran: 'questions', nom: 'Questions', icone: 'bulb'[^}]*\},\s*\{ ecran: 'reserves', nom: 'Réserves et base', icone: 'book'[^}]*\},\s*\{ ecran: 'signalements', nom: 'Signalements', icone: 'flag'/,
  )
  // Le Cabinet dans les modes, juste après la campagne, qui le garde parmi ses sous-modes ; sa tuile du poste de commande y mène.
  assert.match(page, /\{ ecran: 'campagne', nom: 'Campagne', icone: 'target'[^}]*\},\s*\{ ecran: 'cabinet', nom: 'Cabinet', icone: 'landmark'/)
  assert.match(source('components/QgVueDEnsemble.tsx'), /cabinet: 'cabinet'/)
  // Au téléphone, une console : la barre du QG sous le pouce — le poste, ce qui attend, le direct, les pages — à la place
  // de celle du joueur ; la ligne de l'animateur, pour qui n'a pas de profil, au pied du rail et de la feuille « Pages ».
  assert.doesNotMatch(page, /<MenuBarre/)
  assert.match(page, /<nav className="qg-bas" aria-label="Le QG">/)
  assert.match(page, /const sortir = me\.profil \?[\s\S]*?: \(\s*<NavAnimateur ici="admin" slug=\{me\.space\.slug\} admin \/>\s*\)/)
  assert.match(page, /<div className="qg-cote-pied">\{sortir\}<\/div>/)
  assert.match(page, /<div className="qg-pages-pied">\{sortir\}<\/div>/)
  // La pastille de la barre compte ce qui attend un geste, à la couleur de sa pire ligne, et en ouvre la liste.
  assert.match(page, /<BoutonATraiter n=\{choses\.length\} pire=\{pireGravite\(choses\)\}/)
  assert.match(page, /<Feuille titre="À traiter"/)
  // Le direct et la vue se relisent tant que l'onglet se voit — jamais derrière un autre, à lire Turso pour personne.
  assert.match(page, /document\.visibilityState === 'visible'/)
  // La lueur balaie, sauf si le système demande moins de mouvement.
  const css = source('styles.css')
  assert.match(css, /\.admin-hud::after \{[^}]*animation: admin-balayage/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.admin-hud::after \{ animation: none; display: none; \}\s*\.admin-pouls \{ animation: none; \}/)
  // Les couleurs des modes ont été vérifiées sur l'écran nocturne, dans cet
  // ordre de pile : on ne les change pas sans refaire la vérification.
  assert.match(css, /\.qg-ecran \{[^}]*--mode-soiree: #c98500;\s*--mode-campagne: #199e70;\s*--mode-cabinet: #9085e9;\s*--mode-jour: #d95926;\s*--mode-duel: #3987e5;/)
  // La pile suit `MODES_DU_QG` : le violet du Cabinet loin du bleu des duels, qu'il imite aux yeux qui confondent le rouge.
  assert.deepEqual(MODES_DU_QG, ['soiree', 'campagne', 'cabinet', 'jour', 'duel'])
  // Une ligne ouvre sa feuille : la corbeille au bout d'une ligne se touchait en faisant défiler.
  assert.doesNotMatch(source('components/AdminProfils.tsx'), /aria-label=\{`Supprimer le profil de/)
  assert.match(source('components/AdminProfils.tsx'), /<Feuille titre=\{ouvert\.nom\}/)
})

test('un salon se lit par son titulaire ; le lien d’activation ne vaut que pour un compte à mot de passe', async () => {
  Object.assign(globalThis, { React, window: { location: { pathname: '/admin', search: '', hash: '#salons', origin: 'http://banc' } } })
  const module = await import(new URL('../../client/src/components/AdminSalons.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const espace = (e: Partial<EspaceDAdministration>): EspaceDAdministration => ({
    id: 'x', login: 'p-k3x9', name: 'Léa', slug: 's-k3x9', role: 'host', status: 'pending', createdAt: 0, lastLoginAt: null,
    salon: true, titulaire: { nom: 'Antoine', avatar: '🦁' }, quiz: 2, toi: false, ...e,
  })
  const html = renderToStaticMarkup(
    React.createElement(module.AdminSalons, {
      espaces: [
        espace({ id: 'a' }),
        espace({ id: 'b', titulaire: null, name: 'Bob' }),
        espace({ id: 'c', salon: false, titulaire: null, name: 'Chez Nadia', login: 'nadia', status: 'active' }),
        espace({ id: 'd', salon: false, titulaire: null, name: 'Fermé', login: 'ferme', status: 'disabled' }),
      ],
      onChange: () => {},
    }),
  )
  const noms = [...html.matchAll(/<span class="admin-espace-texte"><b>([^<]+)<\/b>/g)].map(m => m[1])
  assert.deepEqual(noms, ['Le salon d’Antoine', 'Un salon sans titulaire · Bob', 'Chez Nadia', 'Fermé'])
  assert.match(html, /<span class="etiquette admin-etat-orphelin">sans titulaire<\/span>/)
  assert.match(html, /<span class="etiquette admin-etat-ferme">désactivé<\/span>/)
  // Les filtres comptent ce qu'ils montrent.
  assert.match(html, /Sans titulaire <span class="rayon-compte">1<\/span>/)
  assert.match(html, /Désactivés <span class="rayon-compte">1<\/span>/)
  assert.match(source('components/AdminSalons.tsx'), /\{!e\.salon && !e\.toi && e\.status !== 'disabled' && \(/)
})
