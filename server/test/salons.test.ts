// Le salon d'un profil, et son code à six chiffres.
//
// Tout le monde peut animer : « Créer un salon » ouvre l'espace du profil
// la première fois, sans compte d'animateur à demander, et tire le code
// qu'on dicte à la table (« 482 157 ») — celui que le QR porte. Plus
// d'adresse au prénom : pas de « chez-antoine-2 », pas de prénom dans une
// adresse publique. Le code mène à l'adresse de l'espace, celle de ses
// souvenirs ; il tombe une demi-heure après la soirée, et un million de
// codes ne s'énumèrent pas : vingt essais manqués, puis deux par minute.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  connecter,
  connexionAnimateur,
  attendre,
  cookieDe,
  creerQuiz,
  ecranCommun,
  ecrire,
  emitAck,
  demarrer,
  inscrireProfil,
  instantane,
  invite,
  qcm,
  type Banc,
} from './banc'
import { SalonStore, SURSIS_APRES_CLOTURE_MS } from '../src/core/salons'
import { decrirePage, INTROUVABLE, TROP_D_ESSAIS } from '../src/core/apercus'
import { CODE_DU_SALON, ecrireCode, isValidSlug } from '../../shared/space'
import { parseRoute } from '../../shared/adresses'
import type { PublicSpace } from '../../shared/space'

// ── Les règles pures ───────────────────────────────────────────────────────

test('six chiffres sont un code, jamais le nom d’un espace — et se dictent en deux groupes', () => {
  assert.equal(isValidSlug('123456'), false, 'un espace « 123456 » masquerait le salon qui tirerait ce code')
  assert.equal(isValidSlug('12345'), true)
  assert.equal(isValidSlug('s-k3f9x2'), true)
  assert.deepEqual(parseRoute('/482157'), { kind: 'join', slug: '482157' }, 'le client ouvre l’entrée, le serveur a redirigé avant')
  assert.equal(ecrireCode('482157'), '482 157')
  assert.equal(ecrireCode('48 21-57'), '482 157')
  assert.ok(CODE_DU_SALON.test('000042'))
})

test('une adresse de six chiffres mène chez son salon, ou nulle part — sans deviner de voisin', () => {
  const espace = { slug: 's-k3f9x2', title: 'Chez Léa' } as PublicSpace
  const parCode = (code: string) => (code === '482157' ? espace : undefined)
  const rien = () => undefined
  assert.deepEqual(decrirePage('/482157', rien, parCode), { redirection: '/s-k3f9x2' })
  assert.deepEqual(decrirePage('/482157/souvenir', rien, parCode), { redirection: '/s-k3f9x2/souvenir' })
  assert.equal(decrirePage('/482158', rien, parCode), INTROUVABLE)
  // « chez-482158 » ne se devine pas : un code n'est pas un prénom.
  assert.equal(decrirePage('/482158', s => (s === 'chez-482158' ? espace : undefined), parCode), INTROUVABLE)
  assert.equal(decrirePage('/482157', rien, () => null), TROP_D_ESSAIS)
})

// ── Le magasin des codes ───────────────────────────────────────────────────

describe('les codes, dans la base permanente', () => {
  let dir: string
  before(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'quizz-salons-'))
  })
  after(() => rmSync(dir, { recursive: true, force: true }))

  test('un salon garde son code tant qu’il vaut — redémarrage compris —, puis en tire un neuf', async () => {
    let maintenant = 1_000_000
    const url = `file:${path.join(dir, 'permanente.db')}`
    const salons = new SalonStore(url, undefined, () => maintenant)
    await salons.init()
    const code = await salons.ouvrir('espace-a')
    assert.match(code, /^\d{6}$/)
    assert.equal(await salons.ouvrir('espace-a'), code, 'rouvrir rend le même code')
    assert.equal(salons.espaceDuCode(code), 'espace-a')
    assert.equal(salons.codeDe('espace-a'), code)
    const autre = await salons.ouvrir('espace-b')
    assert.notEqual(autre, code, 'deux salons ouverts n’ont jamais le même code')
    assert.equal(salons.espaceDuCode('12345'), undefined, 'cinq chiffres ne sont pas un code')

    // La soirée se clôt : le code vaut encore le temps du sursis…
    await salons.fermer('espace-a')
    maintenant += SURSIS_APRES_CLOTURE_MS - 1
    assert.equal(salons.espaceDuCode(code), 'espace-a', 'le retardataire le retrouve')
    // … et « Encore un quiz avec eux » le rouvre tel quel.
    assert.equal(await salons.ouvrir('espace-a'), code)
    await salons.fermer('espace-a')

    // Un redémarrage relit ce qui vaut encore.
    const relu = new SalonStore(url, undefined, () => maintenant)
    await relu.init()
    assert.equal(relu.espaceDuCode(code), 'espace-a')
    assert.equal(relu.espaceDuCode(autre), 'espace-b')

    // Passé le sursis — compté depuis la dernière clôture —, il ne mène plus nulle part.
    maintenant += SURSIS_APRES_CLOTURE_MS
    assert.equal(relu.espaceDuCode(code), undefined, 'la photo d’un vieux QR n’ouvre pas la soirée suivante')
    assert.equal(relu.codeDe('espace-a'), null)
    const neuf = await relu.ouvrir('espace-a')
    assert.match(neuf, /^\d{6}$/)
    assert.equal(relu.espaceDuCode(neuf), 'espace-a')
    assert.equal(relu.espaceDuCode(autre), 'espace-b', 'le salon voisin n’a pas bougé')

    // Le ménage du démarrage efface ce qui a passé le sursis.
    await relu.removeSpace('espace-b')
    assert.equal(relu.espaceDuCode(autre), undefined)
    salons.close()
    relu.close()
  })
})

// ── Sur un vrai serveur ────────────────────────────────────────────────────

describe('« Créer un salon », depuis son profil', () => {
  let banc: Banc
  before(async () => {
    // Le code se résout en servant la page : il faut un client compilé, même de trois lignes.
    const dist = mkdtempSync(path.join(tmpdir(), 'quizz-dist-'))
    writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><head><title>FiestApp</title></head><body></body></html>')
    banc = await demarrer({ clientDist: dist })
  })
  after(() => banc.close())

  const lire = (chemin: string) => fetch(banc.url + chemin, { redirect: 'manual' })

  test('sans profil, pas de salon', async () => {
    assert.equal((await ecrire(banc.url, '/api/joueur/salon', {})).status, 401)
    assert.equal((await ecrire(banc.url, '/api/joueur/espace', {})).status, 401)
  })

  test('préparer sa soirée ouvre l’espace et sa console, sans tirer de code', async () => {
    const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo')
    const res = await ecrire(banc.url, '/api/joueur/espace', {}, hugo)
    assert.equal(res.status, 200)
    const { espace, nouveau } = (await res.json()) as { espace: PublicSpace; nouveau: boolean }
    assert.equal(nouveau, true)
    const console_ = cookieDe(res)
    // Ses quiz vivent dans son espace : la console ouverte les crée.
    const quiz = await ecrire(banc.url, '/api/quizzes', { title: 'Le quiz d’Hugo' }, console_)
    assert.ok(quiz.ok)
    // Le salon s'ouvre ensuite, et tire son code.
    const salon = await ecrire(banc.url, '/api/joueur/salon', {}, hugo)
    const { code, espace: meme } = (await salon.json()) as { code: string; espace: PublicSpace }
    assert.equal(meme.slug, espace.slug)
    assert.match(code, /^\d{6}$/)
  })

  test('le premier salon crée l’espace du profil, sans prénom dans l’adresse ; le second le retrouve', async () => {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const res = await ecrire(banc.url, '/api/joueur/salon', {}, lea)
    assert.equal(res.status, 200)
    const salon = (await res.json()) as { espace: PublicSpace; code: string; nouveau: boolean }
    assert.equal(salon.nouveau, true)
    assert.match(salon.espace.slug, /^s-[a-z2-9]{6}$/, 'une adresse neutre : ni prénom, ni homonyme à numéroter')
    assert.match(salon.code, /^\d{6}$/)
    // La console de son espace est ouverte sur ce navigateur.
    const console_ = cookieDe(res)
    const moi = (await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: lea } })).json()) as { espace?: PublicSpace | null }
    assert.equal(moi.espace?.slug, salon.espace.slug, 'l’accueil sait maintenant qu’elle anime')

    const encore = await ecrire(banc.url, '/api/joueur/salon', {}, lea)
    const deux = (await encore.json()) as typeof salon
    assert.deepEqual([deux.nouveau, deux.espace.slug, deux.code], [false, salon.espace.slug, salon.code], 'un profil, un espace, un code tant qu’il vaut')

    // Le code mène chez elle, à l'adresse de l'espace.
    const page = await lire(`/${salon.code}`)
    assert.equal(page.status, 302)
    assert.equal(page.headers.get('location'), `/${salon.espace.slug}`)

    // Ses écrans et les téléphones de la salle le lisent dans l'instantané.
    const ecran = await ecranCommun(banc.url, console_)
    assert.equal((await instantane(ecran)).code, salon.code)
    const sofia = await invite(banc.url, 'Sofia', '🐼', { slug: salon.espace.slug })
    assert.equal((await instantane(sofia.socket)).code, salon.code)
  })

  test('« Ouvrir le salon » : les quiz choisis font le programme de ce soir, que la console propose dans l’ordre', async () => {
    const nadia = await inscrireProfil(banc.url, 'nadia', 'Nadia')
    const espace = await ecrire(banc.url, '/api/joueur/espace', {}, nadia)
    const console_ = cookieDe(espace)
    const un = await creerQuiz(banc.url, console_, [qcm('Un ?')], 'Le premier')
    const deux = await creerQuiz(banc.url, console_, [qcm('Deux ?')], 'Le second')
    // Ce que fait la page : le programme, puis le salon.
    const prog = await ecrire(banc.url, '/api/programmes', { titre: 'Ce soir', entrees: [{ quizId: deux, multiplier: 2 }, { quizId: un, multiplier: 1 }] }, console_)
    assert.ok(prog.ok, `le programme (${prog.status})`)
    const salon = (await (await ecrire(banc.url, '/api/joueur/salon', {}, nadia)).json()) as { code: string }
    assert.match(salon.code, /^\d{6}$/)
    const ecran = await ecranCommun(banc.url, console_)
    const choix = attendre<any>(ecran, 'session:view', p => p.view.phase === 'pickPack', 'le choix du quiz')
    ;(ecran as any).emit('host:launch')
    const { view } = await choix
    assert.equal(view.programme?.prochain, deux, 'le premier du programme, celui qu’on a mis en tête')
    assert.equal(view.programme?.ensuite, un)
  })

  test('la feuille du salon ne propose que les modèles qui se jouent tels quels', async () => {
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé')
    const console_ = cookieDe(await ecrire(banc.url, '/api/joueur/espace', {}, zoe))
    const modeles = (await (await fetch(`${banc.url}/api/modeles`, { headers: { Cookie: console_ } })).json()) as {
      id: string
      questionCount: number
      pretes: number
    }[]
    const parId = new Map(modeles.map(m => [m.id, m]))
    assert.equal(parId.get('culture-generale')?.pretes, parId.get('culture-generale')?.questionCount, 'la culture générale se joue d’un toucher')
    assert.equal(parId.get('noel-en-famille')?.pretes, 0, 'Noël en famille attend ses ✏️ : copié tel quel, le salon n’aurait rien eu à lancer')
  })

  test('l’espace d’un animateur d’avant reçoit son code au premier écran qui se présente', async () => {
    const admin = await connexionAnimateur(banc.url)
    const ecran = await ecranCommun(banc.url, admin)
    const snap = await instantane<{ code?: string; space: PublicSpace }>(ecran, s => !!s.code, 'le code du salon')
    assert.match(snap.code!, /^\d{6}$/)
    const page = await lire(`/${snap.code}`)
    assert.equal(page.headers.get('location'), `/${snap.space.slug}`)
  })

  test('un code inconnu ne mène nulle part ; vingt essais manqués, et même le bon ne se cherche plus', async () => {
    const admin = await connexionAnimateur(banc.url)
    const ecran = connecter(banc.url, admin)
    await emitAck(ecran, 'host:hello', {})
    const { code } = await instantane<{ code?: string }>(ecran, s => !!s.code, 'le code du salon')
    const faux = (n: number) => String((Number(code) + n) % 1_000_000).padStart(6, '0')
    assert.equal((await lire(`/${faux(1)}`)).status, 404)
    // Un bon code ne coûte rien.
    for (let i = 0; i < 5; i++) assert.equal((await lire(`/${code}`)).status, 302)
    for (let i = 2; i <= 20; i++) await lire(`/${faux(i)}`)
    const refuse = await lire(`/${code}`)
    assert.equal(refuse.status, 429, 'la réserve est épuisée : le bon code est refusé comme les autres')
    assert.equal(refuse.headers.get('location'), null)
  })
})

// ── Au téléphone ───────────────────────────────────────────────────────────

test('« Rejoindre une soirée » demande six chiffres, au pavé numérique ; le nom d’une soirée d’avant reste à un toucher', async () => {
  const React = (await import('react')).default
  Object.assign(globalThis, { React, window: { location: { host: 'banc', pathname: '/', search: '', hash: '', origin: 'http://banc' } } })
  const { FormulaireSoiree } = await import(new URL('../../client/src/components/Rejoindre.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const rendu = (props: object) => renderToStaticMarkup(React.createElement(FormulaireSoiree, props))

  const vide = rendu({})
  assert.match(vide, /inputMode="numeric"|inputmode="numeric"/, 'le pavé numérique, pas le clavier')
  assert.match(vide, /placeholder="482 157"/)
  assert.ok(!/autofocus/i.test(vide), 'pas d’autoFocus : le clavier pousserait le bouton hors de l’écran')
  assert.match(vide, /<button class="btn btn-primary btn-big btn-block" disabled="">Rejoindre la soirée<\/button>/, 'éteint avant le sixième chiffre')
  assert.match(vide, /J’ai le nom de la soirée/)

  const perduCode = rendu({ perdu: '482157' })
  assert.match(perduCode, /Le code 482 157 ne mène à aucun salon — ou plus\./)
  assert.match(perduCode, /value="482 157"/, 'le code tapé reste là, à corriger')
  assert.match(perduCode, /<button class="btn btn-primary btn-big btn-block">Rejoindre la soirée<\/button>/)

  const perduNom = rendu({ perdu: 'nadia' })
  assert.match(perduNom, /« nadia » ne mène à aucune soirée\./)
  assert.match(perduNom, /id="space-name"[^>]*value="nadia"/, 'un nom perdu rouvre le champ du nom')
  assert.match(perduNom, /J’ai un code à six chiffres/)
})
