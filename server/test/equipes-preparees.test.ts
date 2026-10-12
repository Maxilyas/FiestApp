// Préparer les équipes avant de créer le salon (le souhait du propriétaire du
// 12 octobre 2026). Le choix « En équipes » dormait dans les réglages repliés,
// et la barre du chef créait deux équipes une fois le salon ouvert : on les
// renommait la salle déjà là. Désormais « Créer un salon » montre les
// équipes de ce soir — deux proposées, un toucher en renomme une, « Ajouter
// une équipe » en ajoute une —, et « Ouvrir le salon » les pose avant le
// premier invité, qui choisit la sienne en entrant.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cookieDe, demarrer, ecranCommun, ecrire, inscrireProfil, instantane, type Banc } from './banc'
import { EQUIPES_PROPOSEES, MAX_EQUIPES, equipeSuivante, lireEquipesPreparees } from '../../shared/teams'

const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

// ── Ce qu'un salon reçoit ──────────────────────────────────────────────────

test('des équipes préparées se lisent comme le serveur les coupe : deux au moins, dix au plus, des noms et des emojis', () => {
  assert.deepEqual(lireEquipesPreparees([{ nom: '  Les Renards ', emoji: '🦊' }, { nom: 'Les Hiboux', emoji: ' 🦉 ' }]), [
    { nom: 'Les Renards', emoji: '🦊' },
    { nom: 'Les Hiboux', emoji: '🦉' },
  ])
  // Coupé comme le serveur coupe un nom d'équipe : vingt caractères, jamais une moitié d'emoji.
  assert.equal(lireEquipesPreparees([{ nom: 'Les Fêtards du soir du samedi', emoji: '🎉' }, { nom: 'B', emoji: '🎺' }])![0].nom, 'Les Fêtards du soir')
  // Une seule équipe ne joue contre personne : rien.
  assert.equal(lireEquipesPreparees([{ nom: 'Seuls', emoji: '🌙' }]), null)
  // Sans nom ou sans emoji, une équipe ne compte pas ; ce qui n'est pas une liste ne vaut rien, sans rien faire tomber.
  assert.equal(lireEquipesPreparees([{ nom: '   ', emoji: '🌙' }, { nom: 'Les Lunes', emoji: '' }, { nom: 'Les Soleils', emoji: '☀️' }]), null)
  for (const n of [null, undefined, 'Les Renards', 42, {}, [null, 3, 'x']]) assert.equal(lireEquipesPreparees(n), null)
  // Dix au plus : au-delà, le choix d'équipe ne tient plus sur un téléphone.
  const trop = Array.from({ length: MAX_EQUIPES + 3 }, (_, i) => ({ nom: `Équipe ${i + 1}`, emoji: '⭐' }))
  assert.equal(lireEquipesPreparees(trop)!.length, MAX_EQUIPES)
})

test('« Ajouter une équipe » propose la suivante : un nom qu’aucune ne porte, un emoji qu’aucune n’a', () => {
  assert.deepEqual(equipeSuivante(EQUIPES_PROPOSEES.slice(0, 2)), EQUIPES_PROPOSEES[2])
  // Renommées, les proposées se reprennent dans l'ordre ; et l'emoji suit ceux qui restent.
  assert.deepEqual(equipeSuivante([{ nom: 'Les Renards', emoji: '💃' }, { nom: 'Les Hiboux', emoji: '🕺' }]), { nom: 'Les Salseras', emoji: '🎤' })
  // Toutes prises : « Équipe 7 ».
  assert.equal(equipeSuivante(EQUIPES_PROPOSEES).nom, 'Équipe 7')
})

// ── Sur un vrai serveur ────────────────────────────────────────────────────

let banc: Banc
before(async () => {
  banc = await demarrer()
})
after(() => banc.close())

/** Un profil qui prépare son salon : sa console ouverte, comme « Créer un salon » l'ouvre. */
async function chef(login: string) {
  const profil = await inscrireProfil(banc.url, login, login)
  const console_ = cookieDe(await ecrire(banc.url, '/api/joueur/espace', {}, profil))
  return { profil, console_ }
}

test('« Ouvrir le salon » pose les équipes préparées, avant le premier invité — et jamais par-dessus celles d’une soirée en cours', async () => {
  const c = await chef('nadia')
  const ouvert = await ecrire(banc.url, '/api/joueur/salon', { equipes: [{ nom: 'Les Renards', emoji: '🦊' }, { nom: 'Les Hiboux', emoji: '🦉' }, { nom: 'Les Loups', emoji: '🐺' }] }, c.profil)
  assert.equal(ouvert.status, 200)
  const ecran = await ecranCommun(banc.url, c.console_)
  const snap = await instantane<any>(ecran, s => s.teams.length > 0, 'les équipes du salon')
  assert.deepEqual(
    snap.teams.map((t: any) => `${t.emoji} ${t.name}`),
    ['🦊 Les Renards', '🦉 Les Hiboux', '🐺 Les Loups'],
    'dans l’ordre où il les a préparées',
  )
  assert.equal(snap.players.length, 0, 'avant le premier invité')

  // Rouvert — « Encore un quiz », ou la page du salon rechargée —, il garde
  // les équipes de sa soirée : les remplacer jetterait ses invités hors de la leur.
  assert.equal((await ecrire(banc.url, '/api/joueur/salon', { equipes: [{ nom: 'Les Autres', emoji: '🌙' }, { nom: 'Les Mêmes', emoji: '⭐' }] }, c.profil)).status, 200)
  const apres = await instantane<any>(ecran)
  assert.deepEqual(apres.teams.map((t: any) => t.name), ['Les Renards', 'Les Hiboux', 'Les Loups'])
})

test('une seule équipe, ou rien de lisible : le salon s’ouvre sans équipe, comme avant', async () => {
  for (const [login, corps] of [
    ['marc', { equipes: [{ nom: 'Seuls', emoji: '🌙' }] }],
    ['lea', { equipes: 'les renards' }],
    ['tom', {}],
  ] as const) {
    const c = await chef(login)
    assert.equal((await ecrire(banc.url, '/api/joueur/salon', corps, c.profil)).status, 200, 'le salon s’ouvre quand même')
    const snap = await instantane<any>(await ecranCommun(banc.url, c.console_))
    assert.equal(snap.teams.length, 0, `${login} : pas d’équipe`)
  }
})

// ── La page qui les prépare ────────────────────────────────────────────────

test('la page du salon montre les équipes de ce soir, hors des réglages, et les envoie avec l’ouverture', () => {
  const salon = source('views/SalonApp.tsx')
  // Deux proposées d'office ; un toucher en renomme une (sa feuille, celle de la barre du chef) ; « Ajouter une équipe » ajoute la suivante.
  assert.match(salon, /useState<EquipePreparee\[\]>\(\(\) => EQUIPES_PROPOSEES\.slice\(0, 2\)\)/)
  assert.match(salon, /<section className="salon-bloc" aria-labelledby="salon-equipes">/)
  assert.match(salon, /aria-label=\{`Renommer \$\{e\.nom\}`\} onClick=\{\(\) => setEquipeOuverte\(i\)\}/)
  assert.match(salon, /setLesEquipes\(avant => \[\.\.\.avant, equipeSuivante\(avant\)\]\)/)
  // Deux au moins : la dernière paire ne se supprime pas ; et rien à confirmer, personne n'y est encore.
  assert.match(salon, /onRetirer=\{lesEquipes\.length > 2 \? /)
  assert.match(salon, /<FeuilleDEquipe[\s\S]*?sansMembres[\s\S]*?\/>/)
  // Les réglages repliés ne les cachent plus.
  const reglages = salon.slice(salon.indexOf('<details className="reglages-salon">'), salon.indexOf('</details>', salon.indexOf('<details className="reglages-salon">')))
  assert.doesNotMatch(reglages, /Équipes|Chacun pour soi|En équipes/)
  // Elles partent avec « Ouvrir le salon » — en équipes seulement —, et le téléphone les retient.
  assert.match(salon, /api\.joueur\.salon\(equipes \? \{ equipes: lesEquipes \} : \{\}\)/)
  assert.match(salon, /retenirChef\(\{ slug: salon\.espace\.slug, joue, rythme, equipes, equipesPreparees: lesEquipes \}\)/)
  // La barre du chef garde son filet : sans équipe préparée (une page d'avant), deux d'office.
  assert.match(source('components/BarreDuChef.tsx'), /if \(c\.snapshot\.teams\.length === 0\) equipesParDefaut\(\)/)
})

test('le téléphone du chef retient ses équipes préparées, et une liste abîmée ne fait rien tomber', async () => {
  const stock = new Map<string, string>()
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => stock.get(k) ?? null,
      setItem: (k: string, v: string) => void stock.set(k, v),
      removeItem: (k: string) => void stock.delete(k),
    },
  })
  const { chefIci, retenirChef } = await import(new URL('../../client/src/chef.ts', import.meta.url).href)
  const equipesPreparees = [
    { nom: 'Les Renards', emoji: '🦊' },
    { nom: 'Les Hiboux', emoji: '🦉' },
  ]
  retenirChef({ slug: 's-abc234', joue: true, rythme: 5, equipes: true, equipesPreparees })
  assert.deepEqual(chefIci('s-abc234'), { slug: 's-abc234', joue: true, rythme: 5, equipes: true, equipesPreparees })
  stock.set('quizz.chef', JSON.stringify({ slug: 's-abc234', joue: true, rythme: 5, equipes: true, equipesPreparees: [{ nom: 3 }] }))
  assert.deepEqual(chefIci('s-abc234'), { slug: 's-abc234', joue: true, rythme: 5, equipes: true })
})
