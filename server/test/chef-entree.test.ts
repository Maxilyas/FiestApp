// Le chef de salon et la porte de sa soirée (la remarque du propriétaire du
// 3 octobre 2026) : il y entre sans « Entrer dans la soirée » — il vient de
// dire, en ouvrant le salon, qui il est et s'il joue —, et il en sort vers
// l'accueil quand la soirée s'efface sans rien de joué, au lieu de retomber
// sur l'entrée d'une soirée qui n'existe plus.
//
// Côté serveur, rien ne change : une soirée close sans réponse s'efface comme
// un essai et ses téléphones reçoivent `party:reset` (`cloture.test.ts`).
// C'est le téléphone du chef qui en fait autre chose ; ces épreuves relisent
// son câblage — le rendu se regarde dans Chromium.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (f: string) => readFileSync(new URL(`../../client/src/${f}`, import.meta.url), 'utf8')

test('« Ouvrir le salon » marque l’entrée, et la page de la soirée la fait une fois, toute seule', () => {
  const salon = source('views/SalonApp.tsx')
  assert.match(salon, /retenirChef\(\{[^}]*\}\)\s*demanderEntree\(salon\.espace\.slug\)\s*[\s\S]{0,400}window\.location\.assign\(spacePath\(salon\.espace\.slug\)\)/)

  // La marque se lit sans s'effacer (un rendu se rejoue sous StrictMode), et
  // s'efface dès qu'elle a servi : le lendemain, la page du salon montre l'entrée.
  const chef = source('chef.ts')
  assert.match(chef, /return sessionStorage\.getItem\(ENTREE\) === slug/)
  assert.match(chef, /sessionStorage\.removeItem\(ENTREE\)/)

  const joueur = source('views/PlayerApp.tsx')
  assert.match(joueur, /useState\(\(\) => entreeDemandee\(slug\)\)/)
  const effet = joueur.slice(joueur.indexOf('if (!entreeAuto || entreeLancee.current'))
  assert.match(effet.slice(0, 900), /entreeLancee\.current = true\s*[\s\S]*?oublierEntree\(\)/, 'une seule fois, la marque oubliée')
  assert.match(effet.slice(0, 900), /if \(s\.me \|\| !profil \|\| !chef\) return setEntreeAuto\(false\)/, 'jamais sans profil, ni par-dessus une place déjà prise')
  // Qui joue en équipes choisit la sienne ; les autres entrent sans rien toucher.
  assert.match(effet.slice(0, 900), /if \(chef\.joue && s\.snapshot\.teams\.length > 0\) \{\s*setEquipeDAbord\(true\)/)
  assert.match(effet.slice(0, 900), /void rejoindre\(\{ teamId: null \}\)/)
  // Pendant ce temps, l'attente plutôt que l'entrée, qu'on verrait passer.
  assert.match(joueur, /if \(!snap \|\| !presente \|\| attendreDessins \|\| attendreReprise \|\| attendreEntree\) return <AttenteConnexion \/>/)
  assert.match(source('components/Entree.tsx'), /profil \? \(equipeDAbord && choisirEquipe \? 'equipe' : 'retour'\)/)
})

test('une soirée effacée sans rien de joué ramène le chef à l’accueil, l’invité à l’entrée', () => {
  const socket = source('socket.ts')
  const reset = socket.slice(socket.indexOf("socket.on('party:reset'"))
  // Le jeton seul, sans vider l'état : la garde du retour, démontée, faisait
  // un `history.back()` qui annulait le départ vers l'accueil.
  assert.match(reset.slice(0, 900), /if \(slug && chefIci\(slug\)\) \{\s*oublierJeton\(slug\)\s*return window\.location\.replace\('\/'\)\s*\}/)
  assert.ok(reset.indexOf('chefIci(slug)') < reset.indexOf('oublierIdentite(slug)'), 'le chef avant l’invité')
  assert.match(source('retour.ts'), /if \(demandes === 0 && gardee\(\)\) history\.back\(\)/)
})
