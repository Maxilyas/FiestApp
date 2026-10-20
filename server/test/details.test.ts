// Les images du « détail » de l'Expédition (`scripts/details.ts`) : la fiche
// livrée dans `server/content/details/` et ses images. Quatre cadrages par
// tableau, emboîtés, du détail au tableau entier, 40 Ko au plus chacun ; un
// peintre mort en 1955 au plus tard, soixante-dix ans révolus ; ni doublon ni
// image sans fiche ; et chaque tableau demandé par une question de la base,
// d'où la forme tirera ses leurres.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { lireLaBase } from '../src/core/baseCampagne'
import { DOSSIER_DES_DETAILS, ECHELLES, FICHE_DES_DETAILS, MORT_AU_PLUS_TARD, cadragesDe, refusDeLaFiche, type TableauDuDetail } from '../scripts/details'

const fiche: TableauDuDetail[] = JSON.parse(readFileSync(FICHE_DES_DETAILS, 'utf8'))
const images = readdirSync(DOSSIER_DES_DETAILS).filter(f => f.endsWith('.webp'))
const poids = (nom: string) => readFileSync(path.join(DOSSIER_DES_DETAILS, nom)).length

test('la fiche livrée : quatre images par tableau, 40 Ko au plus, des cadrages emboîtés, le domaine public, ni doublon ni image sans fiche', () => {
  assert.ok(fiche.length >= 80, `une centaine de tableaux attendus, ${fiche.length}`)
  assert.deepEqual(refusDeLaFiche(fiche, images, poids), [])
  assert.equal(images.length, fiche.length * 4)
  assert.equal(new Set(fiche.map(t => t.titre)).size, fiche.length, 'deux tableaux du même titre')
  for (const t of fiche) {
    assert.ok(t.mortDuPeintre <= MORT_AU_PLUS_TARD, `${t.titre} : ${t.peintre} mort en ${t.mortDuPeintre}`)
    assert.equal(t.statut, 'domaine public')
    assert.match(t.qid, /^Q\d+$/)
    assert.ok(t.page.startsWith('https://commons.wikimedia.org/wiki/File:'), t.page)
  }
})

test("les images restent hors du client : servies d'avance, le tableau entier se téléchargeait avant la réponse", () => {
  const publics = path.join(DOSSIER_DES_DETAILS, '..', '..', '..', 'client', 'public', 'details')
  assert.ok(!existsSync(publics))
})

test('chaque tableau est demandé par une question de la base, qui le nomme', () => {
  const parId = new Map(lireLaBase().questions.map(q => [q.id, q]))
  for (const t of fiche) {
    assert.ok(t.questions.length > 0, t.titre)
    for (const id of t.questions) {
      const q = parId.get(id)
      assert.ok(q, `${t.titre} : la question ${id} n'est plus dans la base`)
      assert.ok((q.meta.entites ?? []).some(e => e.nom === t.titre), `${t.titre} : la question ${id} ne le nomme pas`)
    }
  }
})

test('les cadrages : emboîtés, au rapport du tableau, même pour un détail posé au bord', () => {
  for (const centre of [[0.5, 0.5], [0, 0], [1, 1], [0.03, 0.97], [0.9, 0.2]] as const) {
    const c = cadragesDe(centre)
    assert.equal(c.length, 4)
    assert.deepEqual(c[3], [0, 0, 1, 1])
    assert.deepEqual(
      c.map(r => r[2]),
      [...ECHELLES],
    )
    for (const r of c) assert.equal(r[2], r[3], 'un cadrage garde le rapport du tableau')
    const t: TableauDuDetail = { qid: 'Q1', titre: 't', peintre: 'p', annee: 1500, mortDuPeintre: 1519, fichier: 'f.jpg', page: '', statut: 'domaine public', cadrages: c, questions: ['x'] }
    assert.deepEqual(refusDeLaFiche([t], ['Q1-1.webp', 'Q1-2.webp', 'Q1-3.webp', 'Q1-4.webp'], () => 1000), [])
  }
})

test('la vérification refuse ce qui ne se livre pas', () => {
  const bon = { qid: 'Q1', titre: 't', peintre: 'p', annee: 1937, mortDuPeintre: 1973, fichier: 'f.jpg', page: '', statut: 'domaine public' as const, cadrages: cadragesDe([0.5, 0.5]), questions: ['x'] }
  const refus = refusDeLaFiche(
    [bon, { ...bon, mortDuPeintre: 1900, cadrages: [bon.cadrages[1], bon.cadrages[0], bon.cadrages[2], bon.cadrages[3]] }],
    ['Q1-1.webp', 'Q1-2.webp', 'Q1-3.webp', 'Q2-1.webp'],
    nom => (nom === 'Q1-2.webp' ? 50_000 : 1000),
  )
  const dit = (motif: RegExp) => assert.ok(refus.some(r => motif.test(r)), `${motif} attendu dans ${JSON.stringify(refus)}`)
  dit(/Q1 : deux fois/)
  dit(/mort en 1973/)
  dit(/n'emboîte pas/)
  dit(/Q1-4\.webp manque/)
  dit(/Q1-2\.webp pèse 49 Ko/)
  dit(/Q2-1\.webp : aucune fiche/)
})
