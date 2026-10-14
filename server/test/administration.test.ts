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
  // Le journal, le serveur et les six écrans, à leur adresse ; les ancres d'avant y mènent encore.
  assert.match(page, /const ECRANS: readonly Ecran\[\] = \['journal', 'serveur', 'soirees', 'profils', 'salons', 'catalogue', 'jour', 'campagne', 'duels'\]/)
  assert.match(page, /const ANCIENNES: Record<string, Ecran> = \{ 'les-profils': 'profils', 'quiz-du-jour': 'jour' \}/)
  assert.match(page, /history\.pushState\(\{ \.\.\.history\.state, depuisAdmin: true \}, '', e \? `\/admin#\$\{e\}` : '\/admin'\)/)
  // À l'ordinateur, la barre de côté mène à chaque écran ; au téléphone, la
  // liste des pages, qui dit ce qu'on y trouve — la campagne y compte ses
  // signalements.
  for (const e of ['journal', 'serveur', 'soirees', 'profils', 'salons', 'catalogue', 'jour', 'campagne', 'duels']) assert.match(page, new RegExp(`\\{ ecran: '${e}', nom: '[^']+', icone: '[a-z-]+' \\}`), e)
  for (const nom of ['Le journal', 'Le serveur', 'Les soirées', 'Les profils', 'Les salons', 'Le catalogue', 'Le quiz du jour']) assert.match(page, new RegExp(`<Ligne\\s+icone="[a-z]+"\\s+nom="${nom}"`), nom)
  assert.match(page, /<Ligne\s+icone="target"\s+nom="La campagne"/)
  assert.match(page, /<Ligne\s+icone="swords"\s+nom="Les duels"/)
  // La barre du menu, comme « Mon compte » ; celle de l'animateur pour qui n'a pas de profil.
  assert.match(page, /<MenuBarre ici="compte" \/>/)
  assert.match(page, /\{!me\.profil && <NavAnimateur ici="admin" slug=\{me\.space\.slug\} admin \/>\}/)
  // Le direct et la vue se relisent tant que l'onglet se voit — jamais derrière un autre, à lire Turso pour personne.
  assert.match(page, /document\.visibilityState === 'visible'/)
  // La lueur balaie, sauf si le système demande moins de mouvement.
  const css = source('styles.css')
  assert.match(css, /\.admin-hud::after \{[^}]*animation: admin-balayage/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.admin-hud::after \{ animation: none; display: none; \}\s*\.admin-pouls \{ animation: none; \}/)
  // Les couleurs des modes ont été vérifiées sur l'écran nocturne, dans cet
  // ordre de pile : on ne les change pas sans refaire la vérification.
  assert.match(css, /\.qg-ecran \{[^}]*--mode-soiree: #c98500;\s*--mode-campagne: #199e70;\s*--mode-jour: #d95926;\s*--mode-duel: #3987e5;/)
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
