// Les thèmes pointus de l'Expédition depuis la refonte des sujets de la
// campagne (le 17 octobre 2026 : les fêtes, les univers, les pays, les
// époques redécoupées, et chaque sous-thème en rubrique). Le compte des
// sujets (`sujetsComptes`) les sert tous, rubriques et époques remplacées
// comprises ; une carte ne tire que ceux de l'onglet des thèmes (`SUJETS`).
// Une rubrique n'est qu'un morceau de sa catégorie, à son emblème : sur la
// carte, on la prendrait pour une escale de la catégorie, payée double. Une
// époque remplacée ne se propose plus nulle part. Sur la vraie base : c'est
// elle qui les sert.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { SUJETS, estRemplace, sujetParCle } from '../../shared/sujets'
import type { DepartDExpedition } from '../../shared/expedition'

/** Le départ tel que l'expédition le garde : ses trois cartes, thèmes compris. */
function departDe(banc: Banc, id: string): DepartDExpedition {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    return JSON.parse((db.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(id) as { expedition: string }).expedition)
  } finally {
    db.close()
  }
}

test('une carte ne tire ses thèmes pointus que parmi les sujets de l’onglet des thèmes : ni rubrique, ni époque remplacée', async () => {
  const banc = await demarrer()
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const tires: string[] = []
    // Huit départs, abandonnés aussitôt : une carte neuve chaque fois, quatre thèmes pointus en moyenne.
    for (let n = 0; n < 8; n++) {
      const partie = await ecrire(banc.url, '/api/expedition', {}, lea)
      const v = (await partie.json()) as { id: string; error?: string }
      assert.ok(partie.ok, v.error)
      for (const carte of departDe(banc, v.id).cartes) for (const e of carte.escales) if (e.theme && 'sujet' in e.theme) tires.push(e.theme.sujet)
      const abandon = await ecrire(banc.url, `/api/expedition/${v.id}/abandon`, {}, lea)
      assert.ok(abandon.ok, `abandon : ${abandon.status}`)
    }
    assert.ok(tires.length >= 8, `${tires.length} thèmes pointus en huit expéditions`)
    const permis = new Set(SUJETS.map(s => s.cle))
    for (const cle of tires) {
      assert.ok(!estRemplace(cle), `${cle} : une époque remplacée`)
      assert.ok(permis.has(cle), `${cle} : ${sujetParCle(cle)?.famille === 'rubrique' ? 'une rubrique' : 'hors de l’onglet des thèmes'}`)
    }
  } finally {
    await banc.close()
  }
})
