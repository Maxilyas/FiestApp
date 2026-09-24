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
