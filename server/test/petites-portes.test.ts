// Les petites portes du téléphone et de la console : ce que l'audit du 27
// septembre 2026 (`retours/2026-09-27/`, axe 15) a trouvé côté client, hors
// des lots numérotés — une épreuve par constat. Sans navigateur : les sources
// telles qu'on les écrit, et ce qui se calcule sans page ; les reproductions
// de l'audit, rejouées dans Chromium, le disent au navigateur.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/** Une source du client, telle qu'on l'écrit. */
const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

test('un jeton d’une soirée passée ne fait pas voir une salle d’attente vide avant l’entrée', () => {
  // Le téléphone éteint à la clôture, exclu pendant son sommeil : la salle
  // d'attente d'un invité sans prénom, « 0 pt », puis l'entrée [client-7].
  const s = source('views/PlayerApp.tsx')
  assert.match(s, /setJetonEnVol\(true\)\s*try \{\s*await representer\(token\)\s*\} finally \{\s*setJetonEnVol\(false\)\s*\}/)
  // Le premier écran seulement : une reconnexion en pleine question garde sa question.
  assert.match(s, /const attendreReprise = !dejaVu && jetonEnVol/)
  assert.match(s, /if \(!snap \|\| !presente \|\| attendreDessins \|\| attendreReprise\) return <AttenteConnexion \/>/)
  assert.match(s, /const affiche = !!s\.snapshot && presente && !attendreDessins && !attendreReprise/)
})

test('la carte ouverte en salle d’attente se ferme avec l’arrivée du quiz', () => {
  // Elle se rouvrait toute seule à la fin du quiz, redemandée au serveur [client-8].
  assert.match(source('views/PlayerApp.tsx'), /useEffect\(\(\) => \{\s*setEnvoi\(null\)[\s\S]{0,200}?setCarte\(null\)\s*\}, \[sessionId\]\)/)
})

test('« Me déconnecter » garde le profil ouvert, et le dit, tant que le serveur n’a pas fermé la session', () => {
  // La requête perdue montrait le formulaire de connexion sans un mot, et
  // le téléphone prêté rouvrait le profil de son propriétaire [client-9].
  const s = source('views/ProfilApp.tsx')
  assert.doesNotMatch(s, /deconnexion\(\)\.catch\(\(\) => \{\}\)/)
  assert.match(s, /try \{\s*await api\.joueur\.deconnexion\(\)\s*\} catch \(e\) \{\s*return setErreur\(motifDe\(e\)\)\s*\}\s*retenirProfil\(false\)\s*setProfil\(null\)/)
})

test('« Qui manque ? » oublie les codes périmés, et son minuteur avec eux', async () => {
  // Un code demandé restait dans la liste, périmé compris : le panneau se
  // redessinait toutes les cinq secondes jusqu'à la fin de la soirée [client-11].
  const React = (await import('react')).default
  Object.assign(globalThis, {
    React,
    location: new URL('http://127.0.0.1:1/banc'),
    document: { addEventListener() {}, visibilityState: 'visible' },
    window: globalThis,
  })
  ;(globalThis as any).addEventListener ??= () => {}
  ;(globalThis as any).removeEventListener ??= () => {}
  const { sansPerimes } = await import(new URL('../../client/src/components/Absents.tsx', import.meta.url).href)
  const codes = { a: { code: 'AAA', expiresAt: 1000, montre: false }, b: { code: 'BBB', expiresAt: 3000, montre: true } }
  assert.equal(sansPerimes(codes, 500), codes, 'rien à retirer : le même objet, pas un rendu de plus')
  assert.deepEqual(sansPerimes(codes, 2000), { b: codes.b })
  assert.deepEqual(sansPerimes(codes, 3000), {}, 'plus un code : `enCours` retombe, le minuteur s’arrête')
  assert.match(source('components/Absents.tsx'), /setCodes\(c => sansPerimes\(c, serverNow\(\)\)\)/, 'lu à l’heure du serveur (invariant 6)')
})

test('« Copier le lien » d’activation passe par `copierTexte`, et dit quand le navigateur refuse', () => {
  // Hors https, `navigator.clipboard` n'existe pas : l'appel levait avant son
  // `.catch`, et la boîte se fermait sans copie ni un mot [client-12].
  const s = source('views/AdminApp.tsx')
  assert.doesNotMatch(s, /navigator\.clipboard/)
  assert.match(s, /if \(await copierTexte\(link\)\) return showToast\(\{ kind: 'info', message: 'Lien copié' \}\)/)
  assert.match(s, /Le navigateur n’a pas voulu le copier/)
})

test('« Clore la soirée » n’attend pas le titre déjà rangé plus de trois secondes', () => {
  // Une liaison gelée retenait la boîte sans fin, et l'animateur retouchait « Clore » [client-13].
  const s = source('views/HostApp.tsx')
  assert.match(s, /fetch\(dataUrl\(slug, 'soirees\.json'\), \{ signal: AbortSignal\.timeout\(ATTENTE_DU_TITRE_MS\) \}\)/)
  assert.match(s, /const ATTENTE_DU_TITRE_MS = 3000/)
})

test('le pire cas de l’écran commun ne donne aux anonymes aucun emoji de collection', async () => {
  // 🐝 et 🐢 sont réservés aux profils depuis #59 : Ophélie et Bo, anonymes
  // de `rendu-ecran.ts`, entraient en 🎉 dans chaque capture [design-recompenses-13].
  const { COLLECTION } = await import('../../shared/avatars')
  const script = readFileSync(new URL('../scripts/rendu-ecran.ts', import.meta.url), 'utf8')
  const avatars = /const avatar = \[([^\]]*)\]\[i\]/.exec(script)?.[1].match(/'([^']+)'/g)?.map(a => a.slice(1, -1)) ?? []
  const avecProfil = Number(/const profil = i < (\d+) \?/.exec(script)?.[1])
  assert.equal(avatars.length, 10, 'la liste des avatars du script est lue')
  assert.ok(avecProfil > 0 && avecProfil < avatars.length, 'le script dit qui a un profil')
  const deCollection = new Set(COLLECTION.map(c => c.emoji))
  assert.deepEqual(avatars.slice(avecProfil).filter(a => deCollection.has(a)), [])
})
