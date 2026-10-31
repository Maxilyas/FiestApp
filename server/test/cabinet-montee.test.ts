// La tour du Cabinet (`shared/cabinet/montee.ts`) : neuf étages, une porte à
// choisir à chacun, une partie de trois manches derrière. La règle pure
// d'abord — le pli d'une montée, ses portes tirées de la graine, son départ, son
// record —, puis une montée jouée par les routes : une porte ouverte qui fait
// entrer son œuvre, des portes fermées qui coûtent un cœur, la montée qui
// s'arrête au dernier, le record qui survit au redémarrage, et une porte
// périmée refusée en mots.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { inscrireProfil } from './banc'
import {
  bancDuCabinet,
  commencer,
  fermerLesMagasins,
  jouer,
  jouerDesIndices,
  jouerUnDetail,
  jouerUnEclair,
  jouerUneEpingle,
  jouerUneFrise,
  jouerUneReplique,
  jouerUnFilet,
  jouerUnMot,
  jouerUnPari,
  laPage,
  ok,
  ouvrir,
  type BancDuCabinet,
} from './cabinet-banc'
import {
  COEURS_D_UNE_MONTEE,
  ETAGES_DU_COFFRE,
  ETOILES_D_UNE_PORTE,
  SEUILS_DES_RARETES,
  SEUIL_D_UNE_PORTE,
} from '../../shared/cabinet/bareme'
import {
  ETAGES_DE_LA_TOUR,
  ORDRE_DE_LA_TOUR,
  batLeRecord,
  monteeDesParties,
  portesDeLEtage,
  recordDeLaMontee,
  salleDeLEtage,
  tourDuJour,
} from '../../shared/cabinet/montee'
import {
  CHOISIS_UNE_PORTE,
  DEMANDE_ILLISIBLE,
  LA_MONTEE_A_CHANGE,
  LA_PORTE_A_CHANGE,
  cadreDuDepart,
  laPartieAttend,
  museeDe,
  possedees,
  visiteDuJour,
  type DemandeDeMontee,
  type PartieDuJour,
} from '../../shared/cabinet/musee'
import { JEU_DE_L_OEUVRE, OEUVRES, oeuvre, oeuvresDeLaSalle } from '../../shared/cabinet/oeuvres'
import { JEUX_PRETS } from '../../shared/cabinet/ouverture'
import type { ButinDUnePorte } from '../../shared/cabinet/partie'
import { SALLES } from '../../shared/cabinet/salles'
import type { PageDuCabinet, PorteVue, VueDeLaPartie } from '../../shared/cabinet/vues'

after(fermerLesMagasins)

const JOUR = '2026-10-31'
const GRAINE = 'graine-de-la-tour'
const MIDI = Date.UTC(2026, 9, 31, 11, 0)

/** Une partie de la tour, telle que le lot froid la relit : son étage, ce que promettait sa porte, son total. */
function etage(n: number, etage: number, total: number | null, o: { butin?: ButinDUnePorte; seuil?: number; carte?: string | null; le?: number } = {}): PartieDuJour {
  return {
    id: `t${n}-${etage}-${o.le ?? 0}`,
    commenceeLe: MIDI + etage * 60_000 + (o.le ?? 0),
    finieLe: total === null ? null : MIDI + etage * 60_000 + 30_000,
    issue: total === null ? null : 'libre',
    origine: 'montee',
    visite: null,
    jeu: 'pari',
    cible: null,
    payee: false,
    total,
    seuil: o.seuil ?? SEUIL_D_UNE_PORTE,
    montee: { n, etage, porte: 0, butin: o.butin ?? 'etoiles', carte: o.carte ?? null },
  }
}

test('la tour : neuf étages, le Vestibule d’abord, puis chaque salle une fois', () => {
  assert.equal(ETAGES_DE_LA_TOUR, SALLES.length)
  assert.equal(ORDRE_DE_LA_TOUR[0], 'vestibule')
  assert.deepEqual([...ORDRE_DE_LA_TOUR].sort(), SALLES.map(s => s.cle).sort())
  assert.equal(salleDeLEtage(1), 'vestibule')
  assert.equal(salleDeLEtage(0), undefined)
  assert.equal(salleDeLEtage(10), undefined)
  assert.ok(ETAGES_DU_COFFRE.every(e => e >= 1 && e <= ETAGES_DE_LA_TOUR))
})

test('une montée se relit de ses parties du jour : chaque porte ouverte à son seuil figé, fermée elle coûte un cœur', () => {
  const parties = [
    etage(1, 1, 6, { butin: 'oeuvre', seuil: 6, carte: 'concentration' }),
    etage(1, 2, 2, { butin: 'coeur' }),
    etage(1, 3, 5, { butin: 'etoiles' }),
  ]
  const m = monteeDesParties(parties, 1)
  assert.equal(m.carte, 'concentration', 'la carte de toute la montée, choisie au premier étage')
  assert.equal(m.coeurs, COEURS_D_UNE_MONTEE - 1)
  assert.deepEqual(m.etages.map(e => e.ouverte), [true, false, true])
  assert.equal(m.etoiles, 6 + 2 + 5 * ETOILES_D_UNE_PORTE, 'la porte qui double ne double que son étage, ouverte')
  assert.deepEqual([m.hauteur, m.prochain, m.enCours, m.finie], [3, 4, false, false])
  // Une partie qui se joue arrête la montée à son étage : rien à jouer tant qu'elle attend.
  const enRoute = monteeDesParties([...parties, etage(1, 4, null)], 1)
  assert.deepEqual([enRoute.enCours, enRoute.prochain, enRoute.hauteur], [true, null, 3])
  // Une porte au cœur ouverte en rend un, jamais au-delà des cœurs du départ.
  const rendu = monteeDesParties([...parties, etage(1, 4, 7, { butin: 'coeur' }), etage(1, 5, 9, { butin: 'coeur' })], 1)
  assert.equal(rendu.coeurs, COEURS_D_UNE_MONTEE)
  // Trois portes fermées : la montée s'arrête là, et la suivante repart du premier étage.
  const fermees = [etage(2, 1, 0), etage(2, 2, 4), etage(2, 3, 1)]
  const finie = monteeDesParties([...parties, ...fermees], 2)
  assert.deepEqual([finie.coeurs, finie.finie, finie.prochain, finie.hauteur], [0, true, null, 3])
  // Les neuf étages joués : le sommet.
  const sommet = monteeDesParties(
    Array.from({ length: ETAGES_DE_LA_TOUR }, (_, k) => etage(3, k + 1, 9)),
    3,
  )
  assert.deepEqual([sommet.sommet, sommet.finie, sommet.hauteur, sommet.coeurs], [true, true, ETAGES_DE_LA_TOUR, COEURS_D_UNE_MONTEE])
  // Deux parties au même étage — deux serveurs pendant une mise en ligne — : la première commencée compte.
  const doublee = monteeDesParties([etage(4, 1, 9), etage(4, 1, 0, { le: 1 })], 4)
  assert.deepEqual([doublee.etages.length, doublee.coeurs], [1, COEURS_D_UNE_MONTEE])
})

test('les portes se tirent de la graine : les mêmes à chaque page, et chacune dit ce qu’elle promet', () => {
  const vide = museeDe({ jour: JOUR })
  const possede = possedees(vide)
  const tirer = (etageVise: number, coeurs = COEURS_D_UNE_MONTEE, aLui = possede) =>
    portesDeLEtage({ graine: GRAINE, jour: JOUR, n: 1, etage: etageVise, coeurs, possede: aLui, jeux: JEUX_PRETS })
  assert.deepEqual(tirer(1), tirer(1), 'tirées deux fois, les mêmes')
  const [a, b] = [...tirer(1)].sort((x, y) => (x.butin === 'oeuvre' ? -1 : 1) - (y.butin === 'oeuvre' ? -1 : 1))
  assert.equal(tirer(1).length, 2)
  assert.equal(a.butin, 'oeuvre')
  const o = oeuvre(a.cible)!
  assert.equal(o.salle, 'vestibule', 'l’œuvre de la salle de l’étage')
  assert.ok(!possede.has(o.cle), 'une œuvre qui lui manque')
  assert.ok(o.rarete === 'commun' || o.rarete === 'rare', 'une commune ou une rare d’abord')
  assert.equal(a.jeu, JEU_DE_L_OEUVRE[o.cle], 'au jeu où elle se trouve, comme sa chasse')
  assert.equal(a.seuil, SEUILS_DES_RARETES[o.rarete])
  assert.equal(b.butin, 'etoiles', 'tous ses cœurs : la porte double les étoiles')
  assert.notEqual(b.jeu, a.jeu, 'deux portes, deux jeux')
  assert.equal(b.seuil, SEUIL_D_UNE_PORTE)
  assert.ok(tirer(1, COEURS_D_UNE_MONTEE - 1).some(p => p.butin === 'coeur'), 'un cœur perdu : une porte le rend')
  // Le coffre : une seule porte, une œuvre précieuse de sa salle.
  const coffre = tirer(ETAGES_DU_COFFRE[0])
  assert.equal(coffre.length, 1)
  assert.equal(coffre[0].coffre, true)
  assert.ok(['rare', 'maudit', 'epique'].includes(oeuvre(coffre[0].cible)!.rarete))
  assert.equal(oeuvre(coffre[0].cible)!.salle, salleDeLEtage(ETAGES_DU_COFFRE[0]))
  // Une salle complète promet une œuvre d'ailleurs ; un musée plein, plus d'œuvre du tout.
  const erudit = new Set([...possede, ...oeuvresDeLaSalle('erudit').map(x => x.cle)])
  const ailleurs = tirer(2, COEURS_D_UNE_MONTEE, erudit).find(p => p.butin === 'oeuvre')
  assert.ok(ailleurs && oeuvre(ailleurs.cible)!.salle !== 'erudit')
  const tout = new Set(OEUVRES.map(x => x.cle))
  assert.ok(tirer(2, COEURS_D_UNE_MONTEE, tout).every(p => p.cible === null))
})

test('un départ en montée : la porte telle que la page l’a vue, la carte de toute la montée', () => {
  const m = museeDe({ jour: JOUR })
  const visite = visiteDuJour(m, { graine: GRAINE, jour: JOUR, minuit: MIDI - 11 * 3_600_000 })
  const tour = tourDuJour(m, { graine: GRAINE, jour: JOUR })
  assert.equal(tour.montee, null)
  assert.deepEqual([tour.aJouer?.n, tour.aJouer?.etage, tour.aJouer?.coeurs], [1, 1, COEURS_D_UNE_MONTEE])
  const p = tour.aJouer!.portes[0]
  const demande: DemandeDeMontee = { origine: 'montee', n: 1, etage: 1, porte: p.porte, jeu: p.jeu, oeuvre: p.cible, carte: 'concentration' }
  const cadre = cadreDuDepart(m, demande, visite, JEUX_PRETS, tour)
  assert.ok(typeof cadre !== 'string', String(cadre))
  assert.deepEqual([cadre.origine, cadre.jeu, cadre.cible, cadre.seuil, cadre.payee], ['montee', p.jeu, p.cible, p.seuil, false])
  assert.deepEqual(cadre.montee, { n: 1, etage: 1, porte: p.porte, butin: p.butin, carte: 'concentration' })
  assert.equal(cadre.carte?.cle, 'concentration')
  // Une porte qui a changé, une montée qui a changé, une porte qui n'est pas de l'étage : refusées en mots.
  const autreJeu = JEUX_PRETS.find(j => j !== p.jeu)!
  assert.equal(cadreDuDepart(m, { ...demande, jeu: autreJeu }, visite, JEUX_PRETS, tour), LA_PORTE_A_CHANGE)
  assert.equal(cadreDuDepart(m, { ...demande, etage: 2 }, visite, JEUX_PRETS, tour), LA_MONTEE_A_CHANGE)
  assert.equal(cadreDuDepart(m, { ...demande, porte: 7 }, visite, JEUX_PRETS, tour), CHOISIS_UNE_PORTE)
  assert.equal(cadreDuDepart(m, demande, visite, JEUX_PRETS, null), DEMANDE_ILLISIBLE)
  // Au deuxième étage, la carte est celle que la montée a emportée, quoi que la demande nomme.
  const apres = museeDe({ jour: JOUR, parties: [etage(1, 1, 9, { carte: 'concentration' })] })
  const tour2 = tourDuJour(apres, { graine: GRAINE, jour: JOUR })
  assert.equal(tour2.aJouer?.etage, 2)
  const q = tour2.aJouer!.portes[0]
  const cadre2 = cadreDuDepart(apres, { origine: 'montee', n: 1, etage: 2, porte: q.porte, jeu: q.jeu, oeuvre: q.cible, carte: 'prudence' }, visite, JEUX_PRETS, tour2)
  assert.ok(typeof cadre2 !== 'string', String(cadre2))
  assert.equal(cadre2.carte?.cle, 'concentration')
  // Une partie qui attend : rien ne part, la porte comprise.
  const attend = museeDe({ jour: JOUR, enCours: { id: 's', jeu: 'mot' } })
  assert.equal(cadreDuDepart(attend, demande, visite, JEUX_PRETS, tour), laPartieAttend('mot'))
})

test('le record : plus haut, puis autant d’étages et plus d’étoiles ; jamais un étage zéro', () => {
  assert.ok(batLeRecord(null, { etage: 1, etoiles: 0 }))
  assert.ok(!batLeRecord(null, { etage: 0, etoiles: 9 }))
  assert.ok(batLeRecord({ etage: 3, etoiles: 20 }, { etage: 4, etoiles: 0 }))
  assert.ok(batLeRecord({ etage: 3, etoiles: 20 }, { etage: 3, etoiles: 21 }))
  assert.ok(!batLeRecord({ etage: 3, etoiles: 20 }, { etage: 3, etoiles: 20 }))
  assert.deepEqual(recordDeLaMontee({ hauteur: 5, etoiles: 31 }), { etage: 5, etoiles: 31 })
})

// ── Par les routes ────────────────────────────────────────────────────────

/** Une manche jouée sans faute, quel que soit le jeu que la porte a tiré. */
function uneMancheParfaite(b: BancDuCabinet, cookie: string, vue: VueDeLaPartie, k: number): Promise<VueDeLaPartie> {
  switch (vue.jeu) {
    case 'pari':
      return jouerUnPari(b, cookie, vue, k, 'parier-juste')
    case 'eclair':
      return jouerUnEclair(b, cookie, vue, k)
    case 'frise':
      return jouerUneFrise(b, cookie, vue, k)
    case 'detail':
      return jouerUnDetail(b, cookie, vue, k)
    case 'mot':
      return jouerUnMot(b, cookie, vue, k, 1)
    case 'filet':
      return jouerUnFilet(b, cookie, vue, k, 'petit')
    case 'epingle':
      return jouerUneEpingle(b, cookie, vue, k, 0)
    case 'indices':
      return jouerDesIndices(b, cookie, vue, k)
    case 'replique':
      return jouerUneReplique(b, cookie, vue, k)
  }
}

async function unePartieParfaite(b: BancDuCabinet, cookie: string, vue: VueDeLaPartie): Promise<VueDeLaPartie> {
  let v = vue
  for (let k = 0; k < 3; k++) {
    if (k > 0) v = await ouvrir(b, cookie, v, k)
    v = await uneMancheParfaite(b, cookie, v, k)
  }
  return v
}

const laDemande = (tour: PageDuCabinet['tour'], p: PorteVue) => ({ origine: 'montee', n: tour.aJouer!.n, etage: tour.aJouer!.etage, porte: p.porte, jeu: p.jeu, oeuvre: p.oeuvre, carte: null })

test('une montée par les routes : l’œuvre d’une porte ouverte entre au musée, chaque porte fermée coûte un cœur, le record survit', async () => {
  const b = await bancDuCabinet()
  try {
    const lou = await inscrireProfil(b.banc.url, 'lou', 'Lou')
    let page = ok(await laPage(b, lou), 'la page')
    assert.equal(page.tour.montee, null)
    assert.equal(page.tour.record, null)
    assert.deepEqual([page.tour.aJouer?.n, page.tour.aJouer?.etage, page.tour.aJouer?.coeurs, page.tour.coeurs], [1, 1, COEURS_D_UNE_MONTEE, COEURS_D_UNE_MONTEE])
    // Le premier étage : la porte qui garde une œuvre, jouée sans faute.
    const aOeuvre = page.tour.aJouer!.portes.find(p => p.butin === 'oeuvre')!
    assert.ok(aOeuvre && aOeuvre.oeuvre, 'une porte montre l’œuvre qu’elle garde')
    const depart = ok(await commencer(b, lou, laDemande(page.tour, aOeuvre)), 'la première porte')
    assert.deepEqual([depart.origine, depart.jeu, depart.seuil], ['montee', aOeuvre.jeu, aOeuvre.seuil])
    const finie = await unePartieParfaite(b, lou, depart)
    assert.ok(finie.bilan && ['gagnee', 'gagnee-doree'].includes(finie.bilan.issue), JSON.stringify(finie.bilan))
    assert.equal(finie.bilan.poussiere, 0, 'la tour paie en œuvres, pas en poussière')
    page = ok(await laPage(b, lou), 'la page après le premier étage')
    assert.ok(page.salles.flatMap(s => s.oeuvres).find(o => o.cle === aOeuvre.oeuvre)?.possedee, 'l’œuvre de la porte est entrée au musée')
    assert.deepEqual([page.tour.montee?.hauteur, page.tour.montee?.coeurs, page.tour.montee?.etages[0].ouverte], [1, COEURS_D_UNE_MONTEE, true])
    assert.equal(page.tour.aJouer?.etage, 2)
    // Une porte d'un étage passé se refuse en mots.
    const perimee = await commencer(b, lou, { ...laDemande(page.tour, page.tour.aJouer!.portes[0]), etage: 1 })
    assert.deepEqual([perimee.status, (perimee.corps as unknown as { error: string }).error], [400, LA_MONTEE_A_CHANGE])
    // Les étages suivants, quittés d'emblée : chaque porte reste fermée et coûte un cœur, jusqu'au dernier.
    for (let e = 2; e <= 1 + COEURS_D_UNE_MONTEE; e++) {
      const p: PorteVue = page.tour.aJouer!.portes[0]
      assert.equal(page.tour.aJouer!.etage, e)
      if (ETAGES_DU_COFFRE.includes(e)) assert.deepEqual([page.tour.aJouer!.portes.length, p.coffre], [1, true])
      const v = ok(await commencer(b, lou, laDemande(page.tour, p)), `la porte de l’étage ${e}`)
      // La même porte, deux fois : la partie qui attend la refuse.
      const deux = await commencer(b, lou, laDemande(page.tour, p))
      assert.equal(deux.status, 400)
      ok(await jouer(b, lou, v, { quoi: 'quitter' }), `quitter l’étage ${e}`)
      page = ok(await laPage(b, lou), `la page après l’étage ${e}`)
      assert.equal(page.tour.montee?.coeurs, COEURS_D_UNE_MONTEE - (e - 1))
    }
    assert.deepEqual([page.tour.montee?.finie, page.tour.montee?.hauteur], [true, 1 + COEURS_D_UNE_MONTEE])
    assert.deepEqual([page.tour.aJouer?.n, page.tour.aJouer?.etage, page.tour.aJouer?.coeurs], [2, 1, COEURS_D_UNE_MONTEE], 'la suivante repart du premier étage')
    const record = page.tour.record
    assert.deepEqual(record?.etage, 1 + COEURS_D_UNE_MONTEE)
    assert.equal(record?.etoiles, page.tour.montee?.etoiles)
    // Le record est en base : un redémarrage le relit, la montée du jour aussi.
    await b.banc.redemarrer()
    page = ok(await laPage(b, lou), 'la page après le redémarrage')
    assert.deepEqual(page.tour.record, record)
    assert.deepEqual([page.tour.montee?.finie, page.tour.aJouer?.n], [true, 2])
  } finally {
    await b.banc.close()
  }
})
