// Le codex de l'Expédition (`shared/codex.ts`, la version 7 du départ), tranché
// le 18 octobre 2026 au soir — « Go tout faire avec tes recommandations » : la
// renommée qu'une expédition rapporte, perdue aussi ; le niveau qu'elle fait ;
// l'échelle de ce que chaque niveau ouvre ; les offres qui ne tirent que les
// cartes ouvertes, pesées par les familles de son paquet ; le trésor d'un
// gardien vaincu ; le pari et les talismans qui attendent leur niveau ; les
// cartes que le codex a retouchées — à leurs chiffres d'avant dans une
// expédition d'avant. Par les routes — la renommée relue des bilans,
// rattrapée, le départ qui fige son codex — : `expedition-codex.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ECHELLE,
  NIVEAUX,
  NIVEAU_MAX,
  RENOMMEE,
  VERSION_DU_BILAN,
  codexDuNiveau,
  ecrireLeBilan,
  lireLeBilan,
  niveauDe,
  niveauDeLaRegle,
  offreDuCodex,
  ouvertureDe,
  progressionDe,
  regleOuverte,
  renommeeDe,
} from '../../shared/codex'
import {
  CARTES_DES_RENCONTRES,
  CARTES_PAR_OFFRE,
  RARETES_D_UNE_ELITE,
  RARETES_D_UNE_RENCONTRE,
  VERSION_DU_CODEX,
  carteALaVersion,
  carteDeRencontre,
  chiffresApresLaCarte,
  enPlusDeLaBibliotheque,
  refusDeLaCarte,
  type ContexteDUneCarte,
} from '../../shared/rencontres'
import {
  GARDIEN,
  bilanDuPli,
  pliDeLExpedition,
  refusDeLaMise,
  vueDeLaRencontre,
  type CarteDUnActe,
  type DepartDExpedition,
  type EtatDeLExpedition,
  type GesteDExpedition,
  type QuestionPosee,
} from '../../shared/expedition'

// ── L'échelle et la renommée ────────────────────────────────────────────────

test('l’échelle : chaque carte sans légendaire une fois, des communes au niveau 1 ; le pari au 2, les talismans au 4, la fétiche au 5 ; Sursis attend le 6', () => {
  const echelonnees = ECHELLE.flatMap(m => m.cartes)
  assert.deepEqual([...echelonnees].sort(), CARTES_DES_RENCONTRES.filter(c => !c.legendaire).map(c => c.cle).sort(), 'toutes, une fois')
  assert.equal(new Set(echelonnees).size, echelonnees.length)
  assert.deepEqual(
    ECHELLE.map(m => m.niveau),
    Array.from({ length: NIVEAU_MAX }, (_, i) => i + 1),
  )
  // « Mettre des basiques seulement et obtenir des rares plus tard » (la revue du 18 octobre 2026).
  assert.deepEqual(
    ECHELLE[0].cartes.filter(cle => carteDeRencontre(cle)!.rarete !== 'commun'),
    [],
    'le niveau 1 n’ouvre que des communes',
  )
  assert.deepEqual([niveauDeLaRegle('pari'), niveauDeLaRegle('talismans'), niveauDeLaRegle('fetiche')], [2, 4, 5])
  // Mesurée seule ouverte au niveau 1, elle menait le joueur moyen au bout une fois sur deux : plus qu'avec tout le codex.
  assert.deepEqual(ouvertureDe('sursis'), { niveau: 6 })
  assert.deepEqual(ouvertureDe('plume'), { niveau: niveauDeLaRegle('fetiche') }, 'Plume s’ouvre avec la catégorie fétiche qui la fait vivre')
  assert.deepEqual(ouvertureDe('renaissance'), { legendaire: 'lg:phenix' }, 'une carte de légendaire s’ouvre en ayant son légendaire')
  assert.equal(ouvertureDe('inconnue'), null)
})

test('la renommée : chaque chose faite, à son barème — perdue aussi ; le niveau qu’elle fait ; le bilan gardé à sa version', () => {
  assert.deepEqual(RENOMMEE, { escales: 1, adversaires: 3, elites: 6, gardiens: 12, auBout: 25 })
  assert.equal(renommeeDe({ escales: 10, adversaires: 5, elites: 1, gardiens: 1, auBout: false }), 10 + 15 + 6 + 12)
  assert.equal(renommeeDe({ escales: 18, adversaires: 12, elites: 2, gardiens: 3, auBout: true }), 18 + 36 + 12 + 36 + 25)
  // Un premier acte joué jusqu'à son gardien, même perdu ensuite, passe le niveau 2.
  assert.ok(renommeeDe({ escales: 8, adversaires: 4, elites: 0, gardiens: 1, auBout: false }) >= NIVEAUX[1])
  assert.deepEqual([niveauDe(0), niveauDe(NIVEAUX[1] - 1), niveauDe(NIVEAUX[1]), niveauDe(100_000)], [1, 1, 2, NIVEAU_MAX])
  assert.deepEqual(progressionDe(NIVEAUX[2] + 5), { niveau: 3, depuis: NIVEAUX[2], prochain: NIVEAUX[3] })
  assert.deepEqual(progressionDe(NIVEAUX[NIVEAU_MAX - 1]), { niveau: NIVEAU_MAX, depuis: NIVEAUX[NIVEAU_MAX - 1], prochain: null }, 'au dernier, plus rien à gagner')
  for (let k = 1; k < NIVEAUX.length; k++) assert.ok(NIVEAUX[k] - NIVEAUX[k - 1] >= NIVEAUX[k - 1] - (NIVEAUX[k - 2] ?? 0), 'chaque niveau demande au moins autant que le précédent')
  const bilan = { escales: 8, adversaires: 4, elites: 1, gardiens: 1, auBout: false }
  assert.deepEqual(lireLeBilan(ecrireLeBilan(bilan)), bilan)
  assert.equal(JSON.parse(ecrireLeBilan(bilan)).v, VERSION_DU_BILAN)
  // Un bilan d'une autre version, ou qui ne se lit pas, se refait du pli.
  for (const brut of [null, '', '{', 42, JSON.stringify({ ...bilan, v: VERSION_DU_BILAN + 1 }), JSON.stringify({ ...bilan, v: VERSION_DU_BILAN, escales: -1 }), JSON.stringify({ ...bilan, v: VERSION_DU_BILAN, adversaires: 1.5 })]) {
    assert.equal(lireLeBilan(brut), null, String(brut))
  }
})

test('le codex d’un niveau : ses cartes dans l’ordre du catalogue, la carte de chaque légendaire qu’il a, ses règles ; une expédition d’avant les a toutes', () => {
  const un = codexDuNiveau(1, [])
  assert.deepEqual(
    un.cartes,
    CARTES_DES_RENCONTRES.filter(c => ECHELLE[0].cartes.includes(c.cle)).map(c => c.cle),
  )
  assert.deepEqual(un.regles, [])
  const cinq = codexDuNiveau(5, ['lg:phenix'])
  assert.deepEqual(cinq.regles, ['pari', 'talismans', 'fetiche'])
  assert.ok(cinq.cartes.includes('renaissance') && cinq.cartes.includes('plume'), 'la carte du Phénix qu’il a, et Plume du niveau 5')
  assert.ok(!cinq.cartes.includes('sursis') && !cinq.cartes.includes('sagesse'), 'ni Sursis du niveau 6, ni la carte de la Chouette qu’il n’a pas')
  assert.equal(codexDuNiveau(NIVEAU_MAX, []).cartes.length, CARTES_DES_RENCONTRES.filter(c => !c.legendaire).length, 'le codex entier, sans légendaire')
  assert.equal(regleOuverte({ v: 6 }, 'pari'), true, 'une expédition d’avant le codex se joue à ses règles')
  assert.equal(regleOuverte({ v: VERSION_DU_CODEX, codex: un }, 'pari'), false)
  assert.equal(regleOuverte({ v: VERSION_DU_CODEX, codex: cinq }, 'fetiche'), true)
})

// ── Les offres ──────────────────────────────────────────────────────────────

test('une offre du codex : trois cartes qu’il a ouvertes — jamais Concentration ni Prudence, ni une légendaire hors du trésor —, la même à chaque lecture, plus souvent de la famille de son paquet', () => {
  const ouvertes = codexDuNiveau(NIVEAU_MAX, ['lg:phenix', 'lg:chouette']).cartes
  const rempart = (paquet: string[]) => {
    let n = 0
    for (let k = 0; k < 400; k++) {
      const offre = offreDuCodex(`codex:${k}`, k % 5, ouvertes, paquet, RARETES_D_UNE_RENCONTRE)
      assert.equal(offre.length, CARTES_PAR_OFFRE)
      assert.equal(new Set(offre).size, CARTES_PAR_OFFRE, 'trois distinctes')
      assert.deepEqual(offreDuCodex(`codex:${k}`, k % 5, ouvertes, paquet, RARETES_D_UNE_RENCONTRE), offre, 'recharger ne la change pas')
      for (const cle of offre) {
        const c = carteDeRencontre(cle)!
        assert.ok(ouvertes.includes(cle), `${cle} est de son codex`)
        assert.ok(c.rarete !== 'legendaire' && cle !== 'concentration' && cle !== 'prudence', cle)
        if (c.famille === 'rempart') n++
      }
    }
    return n
  }
  // « Prends deux cartes du Rempart, on t'en proposera d'autres » : son paquet prend une couleur sans qu'on lui demande rien.
  const sansFamille = rempart(['concentration', 'prudence'])
  const duRempart = rempart(['concentration', 'prudence', 'parade', 'parade', 'contre-attaque', 'contre-attaque'])
  assert.ok(duRempart > 2 * sansFamille, `du Rempart : ${duRempart} contre ${sansFamille}`)
  // Au niveau 1, les seules cartes à gagner.
  const deUn = codexDuNiveau(1, []).cartes
  for (let k = 0; k < 100; k++) {
    for (const cle of offreDuCodex(`un:${k}`, k, deUn, [], RARETES_D_UNE_ELITE)) assert.ok(['coup-d-oeil', 'echange', 'pioche', 'arret-sur-image'].includes(cle), cle)
  }
})

test('le trésor d’un gardien : une légendaire de son codex qu’il n’a pas dans son paquet, puis deux autres ; sans légendaire à lui, trois cartes', () => {
  const ouvertes = codexDuNiveau(3, ['lg:phenix', 'lg:chouette']).cartes
  for (let k = 0; k < 50; k++) {
    const offre = offreDuCodex(`tresor:${k}`, 0, ouvertes, ['concentration', 'renaissance'], RARETES_D_UNE_ELITE, true)
    assert.equal(offre[0], 'sagesse', 'la carte de la Chouette : celle du Phénix est déjà dans son paquet')
    assert.equal(offre.length, CARTES_PAR_OFFRE)
    assert.ok(offre.slice(1).every(cle => carteDeRencontre(cle)!.rarete !== 'legendaire'))
  }
  const sansLegendaire = offreDuCodex('tresor:vide', 0, codexDuNiveau(3, []).cartes, [], RARETES_D_UNE_ELITE, true)
  assert.equal(sansLegendaire.length, CARTES_PAR_OFFRE)
  assert.ok(sansLegendaire.every(cle => carteDeRencontre(cle)!.rarete !== 'legendaire'))
})

// ── Les cartes retouchées ───────────────────────────────────────────────────

test('les cartes que le codex a retouchées font toujours un peu, et plus dans leur cas — une expédition d’avant le codex les joue à leurs chiffres d’alors', () => {
  for (const [cle, avant, codex] of [
    ['parade', 2, 1],
    ['troisieme-oeil', 2, 1],
    ['lucidite', 1, 0],
  ] as const) {
    assert.deepEqual([carteALaVersion(cle, 6)!.cout, carteALaVersion(cle, VERSION_DU_CODEX)!.cout], [avant, codex], cle)
  }
  assert.equal(carteALaVersion('concentration', 5), carteDeRencontre('concentration'), 'une carte que rien n’a retouchée reste la même')
  assert.equal(carteALaVersion('echauffement', 6)!.resume, 'Série +1')
  const avant = { inspiration: 3, charge: 0, garde: 0, serie: 2 }
  const ch = (cle: string, v: number, plus: { fetiche?: boolean; effacees?: number } = {}) => chiffresApresLaCarte(cle, avant, [], { v, ...plus })
  // Lancée compte la bonne réponse qu'elle vise : la première d'une série ne frappait pas.
  assert.deepEqual([ch('lancee', 6).charge, ch('lancee', 7).charge], [4, 6])
  assert.deepEqual([ch('echauffement', 6).charge, ch('echauffement', 6).serie, ch('echauffement', 7).charge, ch('echauffement', 7).serie], [0, 3, 2, 3])
  // Plume et Lucidité ne se jouaient que dans leur cas : ailleurs, des cartes mortes en main.
  assert.deepEqual([ch('plume', 6, { fetiche: true }).charge, ch('plume', 7).charge, ch('plume', 7, { fetiche: true }).charge], [5, 2, 6])
  assert.deepEqual([ch('lucidite', 6, { effacees: 1 }).charge, ch('lucidite', 7).charge, ch('lucidite', 7, { effacees: 1 }).charge], [5, 2, 5])
  assert.deepEqual([ch('parade', 6).inspiration, ch('parade', 7).inspiration, ch('parade', 7).garde], [1, 2, 6])
  const contexte = (v: number, plus: Partial<ContexteDUneCarte> = {}): ContexteDUneCarte => ({
    v,
    tour: { phase: 'preparation', inspiration: 3, jouees: [], surLaQuestion: [] },
    main: CARTES_DES_RENCONTRES.map(c => c.cle),
    pouvoirs: [],
    question: { reponses: 4, tiree: 'quatre', forme: 'quatre', six: true, nombre: false, datee: true, categorie: 'Sport' },
    fetiche: 'Histoire',
    courage: 50,
    derniereFrappe: 0,
    defausse: 0,
    ...plus,
  })
  assert.equal(refusDeLaCarte(contexte(6), 'plume'), 'La question n’est pas de ta catégorie fétiche, Histoire')
  assert.equal(refusDeLaCarte(contexte(VERSION_DU_CODEX), 'plume'), null, 'au codex, elle se joue partout')
  const enQuestion = { tour: { phase: 'question' as const, inspiration: 0, jouees: [], surLaQuestion: [] } }
  assert.equal(refusDeLaCarte(contexte(6, enQuestion), 'lucidite'), 'Il lui faut 1 d’énergie : il t’en reste 0')
  assert.equal(refusDeLaCarte(contexte(VERSION_DU_CODEX, enQuestion), 'lucidite'), null, 'gratuite, sans réponse effacée')
  assert.equal(refusDeLaCarte(contexte(VERSION_DU_CODEX, enQuestion), 'parade'), 'Il lui faut 1 d’énergie : il t’en reste 0')
  // La Bibliothèque frappe sur toutes ses bonnes réponses, plus fort sur sa catégorie fétiche.
  const biblio = (v: number, categorie: string) => enPlusDeLaBibliotheque({ v, pouvoirs: ['bibliotheque'], fetiche: 'Histoire', categorie })
  assert.deepEqual([biblio(6, 'Sport'), biblio(6, 'Histoire'), biblio(7, 'Sport'), biblio(7, 'Histoire')], [0, 3, 1, 3])
  assert.equal(enPlusDeLaBibliotheque({ v: 7, pouvoirs: [], fetiche: 'Histoire', categorie: 'Histoire' }), 0, 'posée seulement')
})

// ── Le pli au codex ─────────────────────────────────────────────────────────

/** Une carte faite à la main : deux questions en bas, un coffre et une élite, une source et une question, deux questions, le campement, le gardien. */
function carte(): CarteDUnActe {
  const q = (categorie: string) => ({ theme: { categories: [categorie] }, forme: 'quatre' as const, chance: 0.7 })
  return {
    depart: ['e00', 'e01'],
    chanceDuGardien: 0.6,
    escales: [
      { id: 'e00', etage: 0, colonne: 0, sorte: 'question', ...q('Histoire'), suite: ['e10', 'e11'] },
      { id: 'e01', etage: 0, colonne: 1, sorte: 'question', ...q('Sport'), suite: ['e11'] },
      { id: 'e10', etage: 1, colonne: 0, sorte: 'coffre', suite: ['e20'] },
      { id: 'e11', etage: 1, colonne: 1, sorte: 'elite', ...q('Sport'), suite: ['e20', 'e21'] },
      { id: 'e20', etage: 2, colonne: 0, sorte: 'source', suite: ['e30'], chance: 0.6 },
      { id: 'e21', etage: 2, colonne: 1, sorte: 'question', ...q('Arts & lettres'), suite: ['e31'] },
      { id: 'e30', etage: 3, colonne: 0, sorte: 'question', ...q('Musique'), suite: ['cg'] },
      { id: 'e31', etage: 3, colonne: 1, sorte: 'question', ...q('Cinéma & séries'), suite: ['cg'] },
      { id: 'cg', etage: 6, colonne: 0, sorte: 'campement', suite: [GARDIEN] },
      { id: GARDIEN, etage: 7, colonne: 0, sorte: 'gardien', suite: [] },
    ],
  }
}

/** Un départ au codex, à ce niveau, avec ces légendaires : l'invité du jour prête sa carte, la renommée de son niveau. */
const depart = (graine: string, niveau: number, legendaires: string[] = []): DepartDExpedition => ({
  v: VERSION_DU_CODEX,
  graine,
  numero: 10_000,
  gardiens: ['lg:kraken', 'lg:dragon', 'lg:oracle'],
  cartes: [carte(), carte(), carte()],
  moyen: true,
  equipee: ['lg:licorne'],
  invite: 'lg:licorne',
  chanceDeLaSource: 0.6,
  codex: { ...codexDuNiveau(niveau, legendaires), renommee: NIVEAUX[niveau - 1] },
})

/** Un journal qu'on écrit comme le serveur : chaque geste, puis ce que le pli demande de tirer — une question d'Histoire, facile, à quatre choix. */
class Journal {
  gestes: GesteDExpedition[] = []
  questions: QuestionPosee[] = []
  reponses = new Map<number, boolean>()
  constructor(readonly depart: DepartDExpedition) {}
  etat(): EtatDeLExpedition {
    return pliDeLExpedition(this.depart, this.gestes, this.questions, this.reponses)
  }
  private tirer() {
    const e = this.etat()
    if (!e.aTirer) return
    for (let k = 0; k < e.aTirer.combien; k++) {
      this.questions.push({ escale: e.aTirer.escale, acte: e.aTirer.acte, reponses: 4, niveau: 'facile', tiree: 'quatre', six: true, datee: true, categorie: 'Histoire' })
    }
  }
  geste(g: GesteDExpedition): EtatDeLExpedition {
    this.gestes.push(g)
    this.tirer()
    return this.etat()
  }
  avancer(vers: string) {
    return this.geste({ quoi: 'avancer', vers })
  }
  voir(mise = 0) {
    return this.geste({ quoi: 'voir', mise, position: this.etat().enAttente! })
  }
  repondre(juste: boolean) {
    let e = this.etat()
    if (e.rencontre?.tour.phase === 'preparation') e = this.voir()
    this.reponses.set(e.enAttente!, juste)
    this.tirer()
    return this.etat()
  }
  prendre(cartes: string[] = []) {
    return this.geste({ quoi: 'prendre', jokers: cartes })
  }
  /** Tout juste, jusqu'au bout de ce qui attend : une rencontre, une source, un gardien. */
  gagner(): EtatDeLExpedition {
    let e = this.etat()
    for (let n = 0; n < 30 && (e.rencontre || e.enAttente !== null); n++) e = this.repondre(true)
    return e
  }
  /** Un acte entier, d'une question en bas au gardien vaincu, les offres laissées en route. */
  acte(): EtatDeLExpedition {
    for (const vers of ['e00', 'e10', 'e20', 'e30']) {
      this.avancer(vers)
      if (this.gagner().offre) this.prendre()
    }
    this.avancer('cg')
    this.geste({ quoi: 'camper' })
    this.avancer(GARDIEN)
    return this.gagner()
  }
}

test('au niveau 1, ni pari ni talisman : la mise se refuse et la page ne la propose pas ; au niveau 2, il parie', () => {
  const un = new Journal(depart('pari:1', 1))
  let e = un.avancer('e00')
  assert.equal(e.pari, false)
  assert.equal(refusDeLaMise(e, 10), 'Le pari s’ouvre au niveau 2 d’explorateur')
  assert.equal(refusDeLaMise(e, 0), null, 'sans pari, il voit la question')
  const vue = vueDeLaRencontre(un.depart, e, un.questions)!
  assert.equal(vue.pari, false, 'la page ne le propose pas')
  assert.equal(vue.mises?.[10], 'Le pari s’ouvre au niveau 2 d’explorateur')
  e = un.voir(10)
  assert.deepEqual([e.rencontre!.tour.phase, e.rencontre!.tour.mise], ['preparation', 0], 'refusée, la mise ne fait rien : le pli l’ignore, le serveur la refuse')
  const deux = new Journal(depart('pari:2', 2))
  e = deux.avancer('e00')
  assert.equal(refusDeLaMise(e, 10), null)
  assert.equal(vueDeLaRencontre(deux.depart, e, deux.questions)!.pari, undefined)
  e = deux.voir(10)
  assert.deepEqual([e.rencontre!.tour.phase, e.rencontre!.tour.mise], ['question', 10])
})

test('ses offres ne tirent que les cartes de son codex ; les talismans attendent le niveau 4', () => {
  const ouvertes = new Set(codexDuNiveau(1, []).cartes)
  let talismans = 0
  for (let n = 0; n < 60; n++) {
    const un = new Journal(depart(`offres:${n}`, 1))
    un.avancer('e00')
    let e = un.gagner()
    for (const cle of e.offre?.jokers ?? []) assert.ok(ouvertes.has(cle), `${n} : ${cle}, hors de son codex`)
    un.prendre()
    e = un.avancer('e10')
    assert.ok(e.offre, 'le coffre')
    for (const cle of e.offre!.jokers) assert.ok(ouvertes.has(cle), `${n} : ${cle}, hors de son codex`)
    assert.equal(e.offre!.talisman, undefined, 'au niveau 1, aucun talisman')
    const quatre = new Journal(depart(`offres:${n}`, 4))
    quatre.avancer('e00')
    quatre.gagner()
    quatre.prendre()
    if (quatre.avancer('e10').offre?.talisman) talismans++
  }
  assert.ok(talismans > 0, 'au niveau 4, les coffres en proposent')
})

test('le trésor d’un gardien vaincu : une carte légendaire de son codex qu’il n’a pas, parmi trois ; jamais au dernier, qu’on garde', () => {
  const j = new Journal(depart('tresor', 3, ['lg:phenix']))
  let e = j.acte()
  assert.deepEqual([e.vaincus, e.acte], [1, 1])
  assert.equal(e.offre?.gardien, true)
  assert.equal(e.offre!.jokers.length, CARTES_PAR_OFFRE)
  assert.ok(e.offre!.jokers.includes('renaissance'), 'la carte du Phénix, qu’il a')
  assert.ok(e.paquet.includes('abysses'), 'le Kraken vaincu glisse toujours sa carte dans son paquet')
  e = j.prendre(['renaissance'])
  assert.ok(e.paquet.includes('renaissance'))
  e = j.acte()
  assert.equal(e.offre?.gardien, true, 'le deuxième aussi')
  assert.ok(!e.offre!.jokers.some(cle => carteDeRencontre(cle)!.rarete === 'legendaire'), 'sa seule légendaire est déjà dans son paquet')
  j.prendre()
  e = j.acte()
  assert.deepEqual([e.issue, e.offre], ['au-bout', null], 'au troisième, il garde un gardien : pas de trésor')
})

test('le bilan du pli : les escales, les adversaires et les élites tombés, les gardiens, le bout — la renommée qu’il en tire', () => {
  const j = new Journal(depart('bilan', 1))
  j.avancer('e00')
  let e = j.gagner()
  assert.deepEqual(e.bilan, { escales: 1, adversaires: 1, elites: 0 })
  j.prendre()
  j.avancer('e11')
  e = j.gagner()
  assert.deepEqual(bilanDuPli(e), { escales: 2, adversaires: 1, elites: 1, gardiens: 0, auBout: false })
  assert.equal(renommeeDe(bilanDuPli(e)), 2 * RENOMMEE.escales + RENOMMEE.adversaires + RENOMMEE.elites)
  // Un acte entier : son gardien compte.
  const acte = new Journal(depart('bilan:acte', 1))
  e = acte.acte()
  assert.deepEqual([bilanDuPli(e).escales, bilanDuPli(e).gardiens, bilanDuPli(e).auBout], [6, 1, false], 'quatre escales, le campement, le gardien')
})
