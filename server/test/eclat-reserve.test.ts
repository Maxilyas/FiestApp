// L'Éclat en réserve (le souhait du 20 octobre 2026 : « quand on porte un
// avatar déjà éclaté, on n'a rien si on a de nouveau un Éclat […] l'avoir
// comme une monnaie, où l'on choisit ensuite n'importe quel avatar qu'on
// possède »). Un tirage heureux qui tombe sur un avatar déjà éclaté ne se perd
// plus : il attend en réserve, et se dépense — pour toujours — sur un autre
// avatar à lui.
//
// Ce qui doit tenir : la réserve ne compte pas pour les Éclats (ni pour La
// Pluie d'Éclats) avant d'être dépensée ; elle ne se dépense que sur un avatar
// à lui, jamais sur un Divin ni sur un avatar déjà éclaté ; la dépense garde la
// soirée où l'Éclat est tombé, et un essai effacé le reprend ; un redémarrage
// la retrouve. Chaque test échouait avant : l'Éclat tombait dans le vide.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { ProfileStore } from '../src/auth/profiles'
import { estEnReserve } from '../../shared/legendaires'

ProfileStore.tirageEclat = () => false

async function dansUneBase(scenario: (profils: ProfileStore, id: string, ouvrir: () => ProfileStore, lire: <T>(fn: (db: Database.Database) => T) => T) => Promise<void>) {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-eclat-reserve-'))
  const fichier = path.join(dir, 'permanente.db')
  const adresse = `file:${fichier.replace(/\\/g, '/')}`
  const ouverts: ProfileStore[] = []
  const ouvrir = () => {
    const p = new ProfileStore(adresse)
    ouverts.push(p)
    return p
  }
  try {
    const profils = ouvrir()
    await profils.init()
    const { profile } = await profils.register({ login: 'lea', password: 'motdepasse1', name: 'Léa', avatar: '🦊' })
    const lire = <T>(fn: (db: Database.Database) => T): T => {
      const db = new Database(fichier)
      try {
        return fn(db)
      } finally {
        db.close()
      }
    }
    await scenario(profils, profile.id, ouvrir, lire)
  } finally {
    for (const p of ouverts) (p as any).close?.()
    rmSync(dir, { recursive: true, force: true })
  }
}

const lignes = (lire: <T>(fn: (db: Database.Database) => T) => T, id: string) =>
  lire(db => db.prepare('SELECT avatar, soiree_id FROM profile_eclats WHERE profile_id = ? ORDER BY created_at, avatar').all(id)) as { avatar: string; soiree_id: string }[]

test('un Éclat sur un avatar déjà éclaté attend en réserve, au lieu de se perdre', () =>
  dansUneBase(async (profils, id, _ouvrir, lire) => {
    // Le premier fait éclater ce qu'il porte, comme avant.
    assert.equal(await profils.donnerUnEclat(id, '🦊', 'soiree-1'), '🦊')
    assert.equal(profils.reserveOf(id), 0)
    assert.equal(profils.toPublic((await profils.byId(id))!).eclatsEnReserve, 0)

    // Le second tombe sur la même cible : il attend, rangé sous sa soirée.
    const cle = await profils.donnerUnEclat(id, '🦊', 'soiree-2')
    assert.ok(estEnReserve(cle), cle)
    assert.equal(profils.reserveOf(id), 1)
    const pub = profils.toPublic((await profils.byId(id))!)
    assert.equal(pub.eclatsEnReserve, 1)
    assert.deepEqual(pub.eclats, ['🦊'], 'rien n’a éclaté de plus')
    assert.deepEqual(
      lignes(lire, id).map(l => l.soiree_id),
      ['soiree-1', 'soiree-2'],
    )
  }))

test('la réserve se dépense sur un avatar à lui : il éclate pour toujours, sous la soirée de l’Éclat', () =>
  dansUneBase(async (profils, id, _ouvrir, lire) => {
    await profils.donnerUnEclat(id, '🦊', 'soiree-1')
    await profils.donnerUnEclat(id, '🦊', 'soiree-2')

    const rec = await profils.update(id, { eclatDeReserve: '🐸' })
    const pub = profils.toPublic(rec)
    assert.deepEqual([...pub.eclats].sort(), ['🐸', '🦊'].sort())
    assert.equal(pub.eclatsEnReserve, 0)
    // La ligne de la réserve est devenue celle de l'avatar : même soirée, rien d'ajouté.
    assert.deepEqual(lignes(lire, id), [
      { avatar: '🦊', soiree_id: 'soiree-1' },
      { avatar: '🐸', soiree_id: 'soiree-2' },
    ])
    // Plus rien à dépenser.
    await assert.rejects(profils.update(id, { eclatDeReserve: '🐼' }), /aucun Éclat en réserve/)
  }))

test('elle ne se dépense ni sur un avatar déjà éclaté, ni sur un Divin, ni sur ce qu’il n’a pas', () =>
  dansUneBase(async (profils, id) => {
    await profils.donnerUnEclat(id, '🦊', 'soiree-1')
    await assert.rejects(profils.update(id, { eclatDeReserve: '🐸' }), /aucun Éclat en réserve/, 'sans réserve, rien')
    await profils.donnerUnEclat(id, '🦊', 'soiree-2')

    await assert.rejects(profils.update(id, { eclatDeReserve: '🦊' }), /déjà éclaté/)
    await assert.rejects(profils.update(id, { eclatDeReserve: 'dv:helios' }), /Divin/)
    await assert.rejects(profils.update(id, { eclatDeReserve: 'lg:phenix' }), /pas encore à toi|Choisis un de tes avatars/)
    await assert.rejects(profils.update(id, { eclatDeReserve: 'pas un avatar' }), /Choisis un de tes avatars/)
    await assert.rejects(profils.update(id, { eclatDeReserve: 42 }), /Choisis un de tes avatars/)
    assert.equal(profils.reserveOf(id), 1, 'un refus ne dépense rien')
    assert.deepEqual(profils.eclatsOf(id), ['🦊'])
  }))

test('deux dépenses parties ensemble ne prennent pas le même Éclat, ni le même avatar', () =>
  dansUneBase(async (profils, id) => {
    await profils.donnerUnEclat(id, '🦊', 'soiree-1')
    await profils.donnerUnEclat(id, '🦊', 'soiree-2')
    await profils.donnerUnEclat(id, '🦊', 'soiree-3')

    // Une seule réserve utile pour le même avatar : l'une prend, l'autre est refusée.
    const memes = await Promise.allSettled([profils.update(id, { eclatDeReserve: '🐸' }), profils.update(id, { eclatDeReserve: '🐸' })])
    assert.deepEqual(memes.map(r => r.status).sort(), ['fulfilled', 'rejected'])
    assert.equal(profils.reserveOf(id), 1)

    // Deux avatars différents, mais une seule réserve : un seul passe, et rien ne se perd.
    const deux = await Promise.allSettled([profils.update(id, { eclatDeReserve: '🐼' }), profils.update(id, { eclatDeReserve: '🦄' })])
    assert.deepEqual(deux.map(r => r.status).sort(), ['fulfilled', 'rejected'].sort())
    assert.equal(profils.reserveOf(id), 0)
    assert.equal(profils.eclatsOf(id).length, 3)
  }))

test('elle ne compte pas pour La Pluie d’Éclats avant d’être dépensée', () =>
  dansUneBase(async (profils, id, _ouvrir, lire) => {
    ProfileStore.tirageEclat = () => true
    try {
      const premier = await profils.tirerUnEclat(id, 'jour:2026-10-06', 40)
      assert.equal(premier?.avatar, '🦊')
      assert.ok(premier?.paliers.length, 'le premier Éclat fait tomber le bronze')
      const palier = () =>
        lire(db => db.prepare(`SELECT badge, soiree_id FROM profile_badges WHERE profile_id = ? AND badge LIKE 'hf:eclats:%' ORDER BY badge`).all(id)) as { badge: string; soiree_id: string }[]
      assert.deepEqual(
        palier().map(p => p.badge),
        ['hf:eclats:1'],
      )

      // Le second tombe sur la même cible : en réserve, il n'ajoute rien.
      const second = await profils.tirerUnEclat(id, 'jour:2026-10-07', 40)
      assert.ok(second && estEnReserve(second.avatar), 'l’Éclat est dit en réserve')
      assert.deepEqual(second.paliers, [])
      assert.equal(profils.eclatsOf(id).length, 1)
    } finally {
      ProfileStore.tirageEclat = () => false
    }
  }))

test('la réserve se retrouve au redémarrage, et une soirée retirée reprend son Éclat en réserve', () =>
  dansUneBase(async (profils, id, ouvrir, lire) => {
    await profils.donnerUnEclat(id, '🦊', 'soiree-1')
    await profils.donnerUnEclat(id, '🦊', 'soiree-2')

    // Un autre processus relit la base : la réserve est là, hors des Éclats éclatés.
    const relu = ouvrir()
    await relu.init()
    const rec = await relu.byId(id)
    assert.ok(rec)
    assert.equal(relu.reserveOf(id), 1)
    assert.deepEqual(relu.eclatsOf(id), ['🦊'])

    // Retirée (un essai effacé), la soirée reprend l'Éclat qu'elle avait fait tomber.
    await relu.retirerSoiree(id, 'soiree-2')
    assert.equal(relu.reserveOf(id), 0)
    assert.deepEqual(
      lignes(lire, id).map(l => l.avatar),
      ['🦊'],
    )
  }))
