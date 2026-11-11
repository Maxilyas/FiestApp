// Le Détail ne se promet qu'à qui il reste du neuf (`leDetailSePromet`, `server/src/core/cabinet/tirages/detail.ts`) :
// en production, du 1er au 10 novembre 2026, le joueur le plus assidu avait vu les cent tableaux d'alors — quatre de ses
// manches du Détail sur dix étaient des redites, plus de la moitié vues la veille, réussies à 71 % contre 44 % sur un
// tableau neuf (`retours/2026-11-08/le-cabinet-en-production.md`). Le tireur n'y pouvait rien : faute de fenêtre neuve, il
// repose la plus anciennement vue. C'est la carte qui cesse de le promettre, et ses gardiens avec elle — le temps que ses
// tableaux passent la semaine (`JOURS_SANS_REDITE`).
//
// Ici : le compte des fenêtres neuves, en pur ; la promesse sur les tableaux livrés ; puis une traversée qui commence, par
// les routes d'un vrai serveur — sa carte et les assauts de ses gardiens, relus dans son départ en base.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { inscrireProfil } from './banc'
import { bancDuCabinet, enBase, fermerLesMagasins, lire, ok, piecesALaMain, poster, type BancDuCabinet } from './cabinet-banc'
import { tableauxDuDetail, type TableauDuDetail } from '../src/core/details'
import { fenetresNeuves, leDetailSePromet } from '../src/core/cabinet/tirages/detail'
import { FENETRE_DU_CABINET_MS } from '../src/core/cabinet/tirages/communs'
import { FENETRES_POUR_PROMETTRE_LE_DETAIL, JOURS_SANS_REDITE, MANCHES_PAR_PARTIE, TITRES_DU_DETAIL } from '../../shared/cabinet/bareme'
import { idDuTableau } from '../../shared/cabinet/pieces'
import { lireLeDepartDeLaTraversee, type DepartDeLaTraversee } from '../../shared/cabinet/traversee'
import type { PageDeLaTraversee } from '../../shared/cabinet/vues'

const JOUR = 24 * 3_600_000
const MAINTENANT = Date.UTC(2026, 10, 11, 8, 0)

/** Des tableaux d'essai, un par année : leur rang est leur place dans le temps. */
const tableaux = (n: number): TableauDuDetail[] => Array.from({ length: n }, (_, i) => ({ qid: `Q${i + 1}`, titre: `Tableau ${i + 1}`, peintre: 'Peintre', annee: 1500 + i, questions: [] }))
/** Ceux-là vus à cette heure, par leur rang (de 1). */
const vus = (rangs: readonly number[], le: number) => new Map<string, number | undefined>(rangs.map(r => [`Q${r}`, le]))

test('les fenêtres neuves se comptent sans un tableau commun, suite par suite de tableaux pas vus de la semaine', () => {
  const depuis = MAINTENANT - FENETRE_DU_CABINET_MS
  assert.equal(TITRES_DU_DETAIL, 4)
  assert.equal(fenetresNeuves(tableaux(3), new Map(), depuis), 0, 'sous quatre tableaux, aucune fenêtre')
  assert.equal(fenetresNeuves(tableaux(4), new Map(), depuis), 1)
  assert.equal(fenetresNeuves(tableaux(11), new Map(), depuis), 2, 'onze tableaux : deux fenêtres, trois tableaux de reste')
  assert.equal(fenetresNeuves(tableaux(12), new Map(), depuis), 3)
  // Un tableau vu coupe la suite : cinq, puis six — une fenêtre de chaque côté, et non les deux que onze tableaux feraient.
  assert.equal(fenetresNeuves(tableaux(12), vus([6], MAINTENANT - JOUR), depuis), 2)
  // Trois tableaux de part et d'autre de chaque vu : plus une seule fenêtre.
  assert.equal(fenetresNeuves(tableaux(11), vus([4, 8], MAINTENANT - JOUR), depuis), 0)
  // Vu il y a plus d'une semaine, il compte de nouveau : rien ne revient avant sept jours, tout peut revenir après.
  assert.equal(fenetresNeuves(tableaux(12), vus([6], MAINTENANT - (JOURS_SANS_REDITE + 1) * JOUR), depuis), 3)
  // L'ordre du temps, pas celui du fichier ; et un seul tableau par titre, comme les fenêtres du jeu.
  assert.equal(fenetresNeuves([...tableaux(8)].reverse(), vus([4], MAINTENANT), depuis), 1)
  assert.equal(fenetresNeuves([...tableaux(4), { ...tableaux(1)[0], qid: 'Q99', annee: 1600 }], new Map(), depuis), 1, 'le même titre deux fois ne fait pas un cinquième tableau')
})

test('le Détail se promet tant qu’il reste deux épreuves de fenêtres neuves, et plus en dessous', () => {
  assert.equal(FENETRES_POUR_PROMETTRE_LE_DETAIL, 2 * MANCHES_PAR_PARTIE, 'deux épreuves de trois manches')
  const juste = tableaux(FENETRES_POUR_PROMETTRE_LE_DETAIL * TITRES_DU_DETAIL)
  const le = (t: TableauDuDetail, quand: number) => [idDuTableau(t.qid), quand] as const
  assert.equal(leDetailSePromet(new Map(), MAINTENANT, juste), true, 'six fenêtres neuves : promis')
  assert.equal(leDetailSePromet(new Map([le(juste[0], MAINTENANT - JOUR)]), MAINTENANT, juste), false, 'un tableau vu hier, cinq fenêtres : plus promis')
  assert.equal(leDetailSePromet(new Map([le(juste[0], MAINTENANT - (JOURS_SANS_REDITE + 1) * JOUR)]), MAINTENANT, juste), true, 'vu il y a huit jours : promis de nouveau')
  // Une question de la base qui nomme le tableau le dit vu aussi : son titre y était écrit.
  const nomme = juste.map((t, i) => (i === 0 ? { ...t, questions: ['q-qui-a-peint'] } : t))
  assert.equal(leDetailSePromet(new Map([['q-qui-a-peint', MAINTENANT - JOUR]]), MAINTENANT, nomme), false)
})

test('les tableaux livrés : promis à qui n’a rien vu, à qui a tout vu il y a huit jours — pas à qui a tout vu cette semaine', () => {
  const livres = tableauxDuDetail()
  const tousVus = (quand: number) => new Map(livres.map(t => [idDuTableau(t.qid), quand]))
  assert.equal(leDetailSePromet(new Map(), MAINTENANT), true)
  assert.equal(leDetailSePromet(tousVus(MAINTENANT - JOUR), MAINTENANT), false)
  assert.equal(leDetailSePromet(tousVus(MAINTENANT - (JOURS_SANS_REDITE + 1) * JOUR), MAINTENANT), true)
  // Après une semaine de traversées jouées par le tireur, il se promet encore : `cabinet-contenu.test.ts` la joue.
})

// ── Par les routes ──────────────────────────────────────────────────────────

let b: BancDuCabinet
before(async () => {
  b = await bancDuCabinet()
})
after(() => b?.banc.close())
after(fermerLesMagasins)

const idDe = async (cookie: string) => (await lire(b, cookie, '/api/joueur/moi?leger')).corps.profile.id as string
/** Le départ d'une traversée qui commence, relu en base : sa carte et les assauts de ses gardiens, que la page ne dit pas. */
async function departDe(cookie: string): Promise<DepartDeLaTraversee> {
  const t = ok(await poster<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee', {}), 'le départ').traversee!
  const depart = lireLeDepartDeLaTraversee(JSON.parse(enBase(b.fichier, db => (db.prepare('SELECT depart FROM cabinet_traversees WHERE id = ?').get(t.id) as { depart: string }).depart)))
  assert.ok(depart, 'son départ se relit')
  return depart
}
const jeuxDeLaCarte = (d: DepartDeLaTraversee) => new Set(d.actes.flatMap(a => a.etapes.flatMap(e => (e.jeu ? [e.jeu] : []))))
const jeuxDesGardiens = (d: DepartDeLaTraversee) => new Set(d.actes.flatMap(a => a.assauts ?? []))

test('une traversée qui commence : le Détail sur la carte et chez les gardiens de qui a du neuf, nulle part chez qui a tout vu cette semaine', async () => {
  const [neuf, repu, revenu] = await Promise.all(['neuf', 'repu', 'revenu'].map(p => inscrireProfil(b.banc.url, `detail-${p}`, `Détail ${p}`)))
  const livres = tableauxDuDetail()
  // Derrière le dos du serveur : l'un a vu tous les tableaux il y a une heure, l'autre il y a huit jours. Un serveur déjà
  // réveillé ne lit ces pièces qu'au redémarrage (règle `tests.md`).
  piecesALaMain(b.fichier, await idDe(repu), livres.map(t => ({ id: idDuTableau(t.qid), mode: 'cabinet' as const, le: b.horloge.t - 3_600_000 })))
  piecesALaMain(b.fichier, await idDe(revenu), livres.map(t => ({ id: idDuTableau(t.qid), mode: 'cabinet' as const, le: b.horloge.t - (JOURS_SANS_REDITE + 1) * JOUR })))
  await b.banc.redemarrer()

  // Dix jeux pour les vingt-quatre épreuves d'une carte, les moins placés d'abord : chacun y est, le Détail compris — et
  // chaque gardien bat tous ses jeux.
  const duNeuf = await departDe(neuf)
  assert.ok(jeuxDeLaCarte(duNeuf).has('detail'), 'sur la carte de qui n’a rien vu')
  assert.ok(jeuxDesGardiens(duNeuf).has('detail'), 'chez ses gardiens')

  const duRepu = await departDe(repu)
  assert.ok(!jeuxDeLaCarte(duRepu).has('detail'), 'plus sur la carte de qui a tout vu cette semaine')
  assert.ok(!jeuxDesGardiens(duRepu).has('detail'), 'ni chez ses gardiens')
  // Les neuf autres font sa carte : aucune étape sans jeu, aucun gardien sans assaut.
  assert.equal(jeuxDeLaCarte(duRepu).size, 9)
  for (const a of duRepu.actes) {
    assert.equal(a.assauts?.length, 8, 'huit jeux contre un gardien : les dix, sans la Frise ni le Détail')
    for (const e of a.etapes) if (e.sorte === 'epreuve') assert.ok(e.jeu, `${e.id} : une épreuve a son jeu`)
  }

  const duRevenu = await departDe(revenu)
  assert.ok(jeuxDeLaCarte(duRevenu).has('detail'), 'de retour sur la carte une fois la semaine passée')
})
