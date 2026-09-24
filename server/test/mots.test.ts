// Les mots de l'application : les noms qu'on lit, et ceux qu'on relit.
//
// La tablée du 24 septembre 2026 a lu « Le Sans-Faute » décerné à 67 %, et
// « Le Devin » pour deux règles différentes — un prix du coup d'œil et un haut
// fait des estimations exactes. Les prix ont changé de nom ; leurs clés, écrites
// sur les étagères des profils, non.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ProfileStore } from '../src/auth/profiles'
import { titreDuPrix } from '../src/core/stats'
import { hautFait } from '../../shared/hautsfaits'
import { GLOSSAIRE } from '../../shared/glossaire'
import { DIVINS } from '../../shared/divins'
import { raconter } from '../src/core/divins'
import { connecter, connexionAnimateur, demarrer, ecrire, emitAck, invite, ADMIN } from './banc'

test('un prix et un haut fait ne portent jamais le même nom', () => {
  assert.equal(titreDuPrix('sansfaute'), 'Le Plus Précis', 'un prix décerné à 67 % ne promet pas un sans-faute')
  assert.equal(titreDuPrix('devin'), "Le Compas dans l'Œil")
  assert.equal(hautFait('hf:devin')?.title, 'Le Devin', 'le haut fait garde son nom')
  assert.notEqual(titreDuPrix('devin'), hautFait('hf:devin')?.title)
  assert.equal(titreDuPrix('inconnu'), undefined)
})

test('l’étagère relit un prix renommé sous son nom du jour, une seule fois', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-mots-'))
  const profils = new ProfileStore(`file:${path.join(dir, 'permanente.db').replace(/\\/g, '/')}`)
  try {
    await profils.init()
    const { profile } = await profils.register({ login: 'ines', password: 'motdepasse1', name: 'Inès', avatar: '🦊' })
    // Une soirée d'avant le renommage : la base garde l'ancien nom…
    await profils.remplacerRecompensesDeSoiree('soiree-1', 'espace', [
      { profileId: profile.id, badge: 'sansfaute', emoji: '💯', title: 'Le Sans-Faute' },
      { profileId: profile.id, badge: 'devin', emoji: '🔮', title: 'Le Devin' },
    ])
    // … et une soirée d'après, le nouveau.
    await profils.remplacerRecompensesDeSoiree('soiree-2', 'espace', [
      { profileId: profile.id, badge: 'sansfaute', emoji: '💯', title: 'Le Plus Précis' },
    ])
    const etagere = await profils.badgesOf(profile.id)
    const sansFaute = etagere.filter(b => b.key === 'sansfaute')
    assert.equal(sansFaute.length, 1, 'deux noms en base, une seule ligne d’étagère')
    assert.equal(sansFaute[0].title, 'Le Plus Précis')
    assert.equal(sansFaute[0].fois, 2)
    assert.equal(etagere.find(b => b.key === 'devin')?.title, "Le Compas dans l'Œil")
  } finally {
    ;(profils as any).close?.()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('les erreurs disent quoi faire : soirée complète, son propre compte, une photo', async () => {
  // « La soirée est complète ! », « Pas ton propre compte », « Format d'image
  // non supporté » : trois constats sans geste à faire, lus dans le noir.
  const banc = await demarrer()
  const sockets: { close(): void }[] = []
  try {
    const cookie = await connexionAnimateur(banc.url)
    assert.ok((await ecrire(banc.url, '/api/space/settings', { maxPlayers: 2 }, cookie, 'PUT')).ok)
    sockets.push((await invite(banc.url, 'Alice')).socket, (await invite(banc.url, 'Bob')).socket)
    const troisieme = connecter(banc.url)
    sockets.push(troisieme)
    await emitAck(troisieme, 'party:watch', { slug: ADMIN.slug })
    const refus = await emitAck<{ ok: boolean; error?: string }>(troisieme, 'player:join', { slug: ADMIN.slug, name: 'Chloé', avatar: '🐼' })
    assert.equal(refus.ok, false)
    assert.match(refus.error ?? '', /complète.*préviens l’animateur/)

    const moi = (await (await fetch(`${banc.url}/api/auth/me`, { headers: { Cookie: cookie } })).json()) as any
    const desactiver = await ecrire(banc.url, `/api/admin/accounts/${moi.account.id}/disable`, {}, cookie)
    assert.equal(desactiver.status, 400)
    assert.equal(((await desactiver.json()) as any).error, 'Tu ne peux pas désactiver ton propre compte')

    const gif = await ecrire(banc.url, '/api/images', { dataUrl: 'data:image/gif;base64,R0lGOD' }, cookie)
    assert.equal(gif.status, 400)
    assert.match(((await gif.json()) as any).error, /choisis-la en JPEG, PNG ou WebP/)
    const lourde = await ecrire(banc.url, '/api/images', { dataUrl: 'x'.repeat(2_500_000) }, cookie)
    assert.match(((await lourde.json()) as any).error ?? '', /choisis-en une plus petite/)
  } finally {
    for (const s of sockets) s.close()
    await banc.close()
  }
})

test('le glossaire : une phrase courte par mot, et rien des règles des Divins', () => {
  const lignes = Object.values(GLOSSAIRE)
  assert.equal(new Set(lignes.map(l => l.terme)).size, lignes.length, 'un mot, une définition')
  for (const { terme, sens } of lignes) {
    // Lue au téléphone, dépliée sous la page : deux lignes au plus en 360 px.
    assert.ok(sens.length <= 100, `${terme} : trop long (${sens.length})`)
    assert.match(sens, /[.!]$/, `${terme} : une phrase`)
    assert.doesNotMatch(sens, /'/, `${terme} : l’apostrophe courbe`)
  }
  // Invariant 21 : le nom et le mystère, jamais la règle ni la légende.
  const divin = GLOSSAIRE.divin.sens
  for (const { legende } of raconter(DIVINS.map(d => d.key))) assert.ok(!divin.includes(legende), legende)
  assert.match(divin, /Personne ne sait/)
  // La précision ne compte que les QCM : le glossaire le dit.
  assert.match(GLOSSAIRE.precision.sens, /QCM/)
})

test('le glossaire ne promet pas un niveau qui ne redescend jamais', () => {
  // Un invité exclu, « C'était un essai » ou une soirée retirée de
  // l'historique reprennent l'expérience d'une soirée, et le niveau en dérive
  // (invariants 10 et 22) : il ne redescend pas pendant une soirée, c'est tout.
  assert.doesNotMatch(GLOSSAIRE.niveau.sens, /jamais/)
  assert.match(GLOSSAIRE.niveau.sens, /pendant une soirée/)
})
