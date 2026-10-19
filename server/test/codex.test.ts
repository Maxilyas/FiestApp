// Le codex de l'Expédition (`shared/codex.ts`, la version 7 du départ), tranché
// le 18 octobre 2026 au soir — « Go tout faire avec tes recommandations » : la
// renommée qu'une expédition rapporte, perdue aussi ; le niveau qu'elle fait ;
// l'échelle de ce que chaque niveau ouvre ; les offres qui ne tirent que les
// cartes ouvertes, pesées par les familles de son paquet ; le trésor d'un
// gardien vaincu ; le pari et les talismans qui attendent leur niveau ; les
// cartes que le codex a retouchées — à leurs chiffres d'avant dans une
// expédition d'avant. Puis les exploits — un but précis, une récompense
// précise —, relevés dans le pli, gardés par le bilan ; puis les objets — les
// fioles, une règle de son codex, et les dos de cartes ; puis l'Ascension —
// ses crans ouverts par les victoires, ce que chacun durcit. Par les routes — la
// renommée et les exploits relus des bilans, rattrapés, le départ qui fige
// son codex et prend son dos — : `expedition-codex.test.ts` ; une fiole
// achetée et bue : `expedition-rencontres-routes.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ASCENSION,
  ASCENSION_MAX,
  BONNES_D_AFFILEE,
  DOS_DES_CARTES,
  ECHELLE,
  ENERGIE_EN_ASCENSION,
  EXPLOITS,
  FRAPPE_EN_ASCENSION,
  GARDIENS_EN_ASCENSION,
  NIVEAUX,
  NIVEAU_MAX,
  PARI_DE_L_EXPLOIT,
  POINTS_EN_ASCENSION,
  RENOMMEE,
  VERSION_DU_BILAN,
  ascensionOuverte,
  codexDuNiveau,
  cranOuvertParLaVictoire,
  dosOuverts,
  ecrireLeBilan,
  lireLeBilan,
  niveauDe,
  niveauDeLaRegle,
  offreDuCodex,
  ouvertureDe,
  ouvertureDuDos,
  progressionDe,
  regleOuverte,
  renommeeDe,
  reposALAscension,
  type BilanDUneExpedition,
  type CleDExploit,
} from '../../shared/codex'
import {
  CARTES_DES_RENCONTRES,
  CARTES_PAR_OFFRE,
  CLAIRVOYANCE_SUR_LA_QUESTION,
  COURAGE_D_UN_CAMPEMENT,
  COURAGE_D_UNE_FIOLE,
  COURAGE_D_UNE_SOURCE,
  COURAGE_MAX,
  ENERGIE_D_UNE_FIOLE,
  FIOLES,
  FIOLES_MAX,
  INSPIRATION_PAR_QUESTION,
  RARETES_D_UNE_ELITE,
  RARETES_D_UNE_RENCONTRE,
  VERSION_DU_CODEX,
  carteALaVersion,
  carteDeRencontre,
  chiffresApresLaCarte,
  effaceesDuTour,
  enPlusDeLaBibliotheque,
  frappeDe,
  refusDeLaCarte,
  sceauxDe,
  type CleDeFiole,
  type ContexteDUneCarte,
} from '../../shared/rencontres'
import {
  GARDIEN,
  PRIX_DE_L_ECHOPPE,
  ascensionDuDepart,
  bilanDuPli,
  pliDeLExpedition,
  refusDeLAchat,
  refusDeLaFiole,
  refusDeLaMise,
  vueDeLaRencontre,
  type CarteDUnActe,
  type DepartDExpedition,
  type EtatDeLExpedition,
  type GesteDExpedition,
  type QuestionPosee,
} from '../../shared/expedition'

// ── L'échelle et la renommée ────────────────────────────────────────────────

test('l’échelle et les exploits : chaque carte sans légendaire une fois — par son niveau, ou par son exploit —, des communes au niveau 1 ; le pari au 2, les talismans au 4, la fétiche au 5 ; Sursis attend le 6', () => {
  const echelonnees = ECHELLE.flatMap(m => m.cartes)
  const parExploit = EXPLOITS.flatMap(x => x.carte ?? [])
  assert.deepEqual([...echelonnees, ...parExploit].sort(), CARTES_DES_RENCONTRES.filter(c => !c.legendaire).map(c => c.cle).sort(), 'toutes, une fois')
  assert.equal(new Set([...echelonnees, ...parExploit]).size, echelonnees.length + parExploit.length)
  // « Dans le codex, une carte verrouillée dit toujours comment l'obtenir : un niveau, un exploit ou un légendaire. »
  assert.deepEqual(
    ['banco', 'lancee', 'echauffement'].map(ouvertureDe),
    [{ exploit: 'pari-de-40' }, { exploit: 'une-seule-reponse' }, { exploit: 'd-affilee' }],
    'Banco, Lancée et Échauffement : leur exploit seul les ouvre',
  )
  assert.deepEqual(EXPLOITS.find(x => x.cle === 'gardien-intact'), { cle: 'gardien-intact', but: 'vaincre le gardien de l’acte 3 sans perdre de courage', dos: 'dore' })
  // Des exploits, pas des cadeaux (la carrière de `calibrage-rencontres.ts`) : vingt d'affilée, une élite, le dernier gardien.
  assert.equal(BONNES_D_AFFILEE, 20)
  assert.ok(ECHELLE.every(m => m.cartes.length > 0), 'chaque niveau ouvre au moins une carte')
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
  assert.deepEqual(lireLeBilan(ecrireLeBilan(bilan)), { ...bilan, exploits: [] })
  assert.equal(JSON.parse(ecrireLeBilan(bilan)).v, VERSION_DU_BILAN)
  // Ses exploits, dans l'ordre des exploits ; un exploit que le code ne connaît plus se tait.
  assert.deepEqual(lireLeBilan(ecrireLeBilan({ ...bilan, exploits: ['gardien-intact', 'pari-de-40'] }))?.exploits, ['pari-de-40', 'gardien-intact'])
  assert.deepEqual(lireLeBilan(JSON.stringify({ ...bilan, v: VERSION_DU_BILAN, exploits: ['d-affilee', 'disparu'] }))?.exploits, ['d-affilee'])
  assert.equal(renommeeDe({ ...bilan, exploits: ['pari-de-40', 'gardien-intact'] }), renommeeDe(bilan), 'un exploit ne rapporte pas de renommée')
  // Un bilan d'une autre version — la 1, d'avant les exploits, comprise —, ou qui ne se lit pas, se refait du pli.
  for (const brut of [
    null,
    '',
    '{',
    42,
    JSON.stringify({ ...bilan, v: 1 }),
    JSON.stringify({ ...bilan, v: VERSION_DU_BILAN }),
    JSON.stringify({ ...bilan, v: VERSION_DU_BILAN + 1, exploits: [] }),
    JSON.stringify({ ...bilan, v: VERSION_DU_BILAN, exploits: [], escales: -1 }),
    JSON.stringify({ ...bilan, v: VERSION_DU_BILAN, exploits: [], adversaires: 1.5 }),
  ]) {
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
  assert.deepEqual(cinq.regles, ['pari', 'fioles', 'talismans', 'fetiche'])
  assert.ok(cinq.cartes.includes('renaissance') && cinq.cartes.includes('plume'), 'la carte du Phénix qu’il a, et Plume du niveau 5')
  assert.ok(!cinq.cartes.includes('sursis') && !cinq.cartes.includes('sagesse'), 'ni Sursis du niveau 6, ni la carte de la Chouette qu’il n’a pas')
  // Au dernier niveau, tout ce que les niveaux ouvrent ; les cartes des exploits attendent leur exploit.
  const sansLegendaire = CARTES_DES_RENCONTRES.filter(c => !c.legendaire).length
  const toutEnJouant = codexDuNiveau(NIVEAU_MAX, [])
  assert.equal(toutEnJouant.cartes.length, sansLegendaire - 3)
  assert.ok(!toutEnJouant.cartes.includes('banco') && !toutEnJouant.cartes.includes('lancee') && !toutEnJouant.cartes.includes('echauffement'))
  const tous = EXPLOITS.map(x => x.cle)
  assert.equal(codexDuNiveau(NIVEAU_MAX, [], tous).cartes.length, sansLegendaire, 'le codex entier, sans légendaire, ses exploits faits')
  // Un exploit ouvre sa carte à tout niveau ; le codex garde ses exploits, dans leur ordre.
  const unExploit = codexDuNiveau(1, [], ['gardien-intact', 'pari-de-40'])
  assert.ok(unExploit.cartes.includes('banco') && !unExploit.cartes.includes('double-chance'))
  assert.deepEqual(unExploit.exploits, ['pari-de-40', 'gardien-intact'])
  assert.deepEqual(codexDuNiveau(1, []).exploits, [])
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
  // Au niveau 1, les seules cartes à gagner : celles qu'il ouvre, sans les deux de base.
  const deUn = codexDuNiveau(1, []).cartes
  const aGagner = ECHELLE[0].cartes.filter(cle => cle !== 'concentration' && cle !== 'prudence')
  for (let k = 0; k < 100; k++) {
    for (const cle of offreDuCodex(`un:${k}`, k, deUn, [], RARETES_D_UNE_ELITE)) assert.ok(aGagner.includes(cle), cle)
  }
  // Le jeu complet en ouvre huit dès le niveau 1, là où il n'y en avait que quatre à gagner.
  assert.ok(aGagner.length >= 8, `${aGagner.length} cartes à gagner au niveau 1`)
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
  assert.deepEqual(bilanDuPli(e), { escales: 2, adversaires: 1, elites: 1, gardiens: 0, auBout: false, exploits: [] })
  assert.equal(renommeeDe(bilanDuPli(e)), 2 * RENOMMEE.escales + RENOMMEE.adversaires + RENOMMEE.elites)
  // Un acte entier : son gardien compte.
  const acte = new Journal(depart('bilan:acte', 1))
  e = acte.acte()
  assert.deepEqual([bilanDuPli(e).escales, bilanDuPli(e).gardiens, bilanDuPli(e).auBout], [6, 1, false], 'quatre escales, le campement, le gardien')
})

// ── Les exploits ────────────────────────────────────────────────────────────

/** Jusqu'au gardien d'un acte, tout juste, les offres laissées en route : le gardien attend sa première question. */
function jusquAuGardien(j: Journal) {
  for (const vers of ['e00', 'e10', 'e20', 'e30']) {
    j.avancer(vers)
    if (j.gagner().offre) j.prendre()
  }
  j.avancer('cg')
  j.geste({ quoi: 'camper' })
  return j.avancer(GARDIEN)
}

test(`trois actes sans faute : ${BONNES_D_AFFILEE} bonnes réponses d’affilée, puis le gardien de l’acte 3 sans perdre de courage — ceux des premiers actes n’en sont pas ; le bilan les garde`, () => {
  const j = new Journal(depart('exploits:propre', 1))
  let e = j.acte()
  assert.equal(e.vaincus, 1)
  assert.ok(e.justes < BONNES_D_AFFILEE, `${e.justes} bonnes réponses au premier acte`)
  assert.deepEqual(e.exploits, [], 'le gardien de l’acte 1 sans perdre de courage : pas encore l’exploit')
  j.prendre()
  e = j.acte()
  assert.deepEqual(e.exploits, ['d-affilee'], `${e.justes} bonnes réponses d’affilée`)
  j.prendre()
  e = j.acte()
  assert.equal(e.issue, 'au-bout')
  assert.deepEqual(e.exploits, ['d-affilee', 'gardien-intact'], 'dans l’ordre où ils sont tombés')
  assert.deepEqual(bilanDuPli(e).exploits, ['d-affilee', 'gardien-intact'])
  // Deux réponses et plus par adversaire, sans carte : aucune élite n'est tombée d'une seule.
  assert.ok(!e.exploits.includes('une-seule-reponse'))
})

test('une erreur repart de zéro, et face au gardien de l’acte 3 elle lui coûte son exploit : du courage perdu — un exploit déjà fait reste', () => {
  const j = new Journal(depart('exploits:touche', 1))
  j.acte()
  j.prendre()
  j.acte()
  j.prendre()
  let e = jusquAuGardien(j)
  assert.deepEqual(e.exploits, ['d-affilee'])
  const courage = e.courage!
  e = j.repondre(false)
  assert.ok(e.courage! < courage, 'il frappe : du courage perdu')
  assert.equal(e.affilee, 0, 'une erreur repart de zéro')
  e = j.gagner()
  assert.equal(e.issue, 'au-bout', 'vaincu quand même')
  assert.ok(e.affilee < BONNES_D_AFFILEE, `${e.affilee} d’affilée depuis l’erreur`)
  assert.deepEqual(e.exploits, ['d-affilee'], 'pas le gardien sans perdre de courage ; les vingt d’affilée, faits avant, restent')
})

test(`un pari de ${PARI_DE_L_EXPLOIT} écus gagné est un exploit — pas un plus petit, ni un perdu`, () => {
  const j = new Journal(depart('exploits:pari', 2))
  j.avancer('e00')
  j.voir(20)
  let e = j.repondre(true)
  j.voir(20)
  e = j.repondre(true)
  assert.ok(e.ecus >= PARI_DE_L_EXPLOIT, `${e.ecus} écus`)
  assert.ok(!e.exploits.includes('pari-de-40'), 'deux paris de 20 : pas un exploit')
  if (e.offre) j.prendre()
  // Perdu, le gros pari ne compte pas.
  const perdu = new Journal(depart('exploits:pari', 2))
  perdu.gestes = [...j.gestes]
  perdu.questions = [...j.questions]
  perdu.reponses = new Map(j.reponses)
  perdu.avancer('e11')
  perdu.voir(PARI_DE_L_EXPLOIT)
  assert.ok(!perdu.repondre(false).exploits.includes('pari-de-40'))
  j.avancer('e11')
  e = j.voir(PARI_DE_L_EXPLOIT)
  assert.equal(e.rencontre?.tour.mise, PARI_DE_L_EXPLOIT, 'il a de quoi parier')
  e = j.repondre(true)
  assert.ok(e.exploits.includes('pari-de-40'))
})

test('une élite tombée d’une seule réponse — un dévoilement difficile trouvé au premier mot frappe trois fois — est un exploit ; un adversaire ordinaire, non', () => {
  const j = new Journal(depart('exploits:un-coup', 1))
  let e = j.avancer('e00')
  const premiere = e.enAttente!
  j.questions[premiere] = { ...j.questions[premiere], forme: 'devoilement', devoile: { mots: 1, sur: 10 } }
  e = j.repondre(true)
  assert.equal(e.rencontre, null, 'tombé à sa première réponse')
  // Au premier réglage, n'importe quel adversaire : le joueur moyen le faisait à sa première expédition.
  assert.deepEqual(e.exploits, [], 'un adversaire ordinaire : pas un exploit')
  if (e.offre) j.prendre()
  e = j.avancer('e11')
  assert.equal(e.rencontre?.sorte, 'elite')
  const i = e.enAttente!
  j.questions[i] = { ...j.questions[i], niveau: 'difficile', forme: 'devoilement', devoile: { mots: 1, sur: 10 } }
  e = j.repondre(true)
  assert.equal(e.rencontre, null, 'l’élite tombée à sa première réponse')
  assert.deepEqual(e.exploits, ['une-seule-reponse'])
})

/** Un acte par ses escales à question — une élite comprise —, les offres laissées en route : aux règles d'avant, de quoi enchaîner. */
function acteParLesQuestions(j: Journal) {
  for (const vers of ['e00', 'e11', 'e21', 'e31']) {
    j.avancer(vers)
    if (j.gagner().offre) j.prendre()
  }
  j.avancer('cg')
  j.geste({ quoi: 'camper' })
  j.avancer(GARDIEN)
  return j.gagner()
}

test(`les exploits se relèvent aussi aux règles d’avant : une expédition aux jokers garde ses ${BONNES_D_AFFILEE} bonnes réponses d’affilée — rétroactifs, comme la renommée`, () => {
  const j = new Journal({ ...depart('exploits:jokers', 1), v: 4, codex: undefined, equipee: [] })
  acteParLesQuestions(j)
  acteParLesQuestions(j)
  const e = acteParLesQuestions(j)
  assert.equal(e.issue, 'au-bout')
  assert.ok(e.justes >= BONNES_D_AFFILEE, `${e.justes} bonnes réponses`)
  assert.deepEqual(e.exploits, ['d-affilee'], 'ni pari ni rencontre aux règles d’avant')
  const exploits: readonly CleDExploit[] = bilanDuPli(e).exploits ?? []
  assert.deepEqual(exploits, ['d-affilee'])
})

// ── Les objets : les fioles et les dos ──────────────────────────────────────

/** Le premier acte jusqu'à son coffre : la rencontre d'en bas gagnée, son offre laissée. */
function jusquAuCoffre(j: Journal) {
  j.avancer('e00')
  j.gagner()
  j.prendre()
  return j.avancer('e10')
}

/** Un départ au niveau 3, d'une graine où le coffre du premier acte cache cette fiole. */
function aSaFiole(prefixe: string, fiole: CleDeFiole): Journal {
  for (let k = 0; k < 300; k++) {
    const j = new Journal(depart(`${prefixe}:${k}`, 3))
    if (jusquAuCoffre(j).offre?.fiole === fiole) return j
  }
  throw new Error(`aucune graine ne cache ${fiole} (${prefixe})`)
}

/** La fiole du coffre prise, puis la source, puis la rencontre de l'étage 3 : elle attend sa première question, qu'il prépare. */
function jusquALaRencontre(j: Journal, fiole: CleDeFiole) {
  j.geste({ quoi: 'prendre', jokers: [], fiole })
  j.avancer('e20')
  j.gagner()
  return j.avancer('e30')
}

/** La carte faite à la main, une échoppe à la place de sa source. */
function carteAvecEchoppe(): CarteDUnActe {
  const c = carte()
  return { ...c, escales: c.escales.map(x => (x.id === 'e20' ? { id: x.id, etage: x.etage, colonne: x.colonne, sorte: 'echoppe' as const, suite: x.suite } : x)) }
}

test('les fioles s’ouvrent au niveau 3 : une expédition d’avant le codex, ou partie avant elles, n’en a pas', () => {
  assert.equal(niveauDeLaRegle('fioles'), 3)
  assert.equal(regleOuverte({ v: 6 }, 'fioles'), false, 'une expédition d’avant le codex finit à ses règles d’alors')
  assert.equal(regleOuverte({ v: 6 }, 'talismans'), true)
  assert.equal(regleOuverte({ v: VERSION_DU_CODEX, codex: codexDuNiveau(2, []) }, 'fioles'), false)
  assert.equal(regleOuverte({ v: VERSION_DU_CODEX, codex: codexDuNiveau(3, []) }, 'fioles'), true)
  assert.equal(jusquAuCoffre(new Journal(depart('fioles:niveau-2', 2))).offre?.fiole, undefined, 'au niveau 2, son coffre n’en cache pas')
  // Partie au niveau 5 avant les fioles : son codex figé n'en avait pas la règle — elle finit sans.
  const avant = new Journal({ ...depart('fioles:avant', 5), codex: { ...codexDuNiveau(5, []), regles: ['pari', 'talismans', 'fetiche'], renommee: NIVEAUX[4] } })
  const e = jusquAuCoffre(avant)
  assert.equal(e.offre?.fiole, undefined)
  assert.deepEqual(avant.geste({ quoi: 'boire', fiole: 'courage' }).fioles, [], 'ni à boire')
})

test('un coffre cache une fiole, à prendre à la place d’une carte — de son propre hasard : ses cartes ne bougent pas', () => {
  const j = new Journal(depart('fioles:coffre', 3))
  let e = jusquAuCoffre(j)
  const fiole = e.offre!.fiole!
  assert.ok(FIOLES.some(f => f.cle === fiole), fiole)
  assert.equal(e.offre!.jokers.length, CARTES_PAR_OFFRE, 'et ses trois cartes')
  // Le même départ sans la règle : les mêmes cartes — la fiole a son propre hasard, elle ne décale aucun tirage.
  const sans = new Journal({ ...depart('fioles:coffre', 3), codex: { ...codexDuNiveau(3, []), regles: ['pari'], renommee: NIVEAUX[2] } })
  assert.deepEqual(jusquAuCoffre(sans).offre!.jokers, e.offre!.jokers)
  const { paquet, ecus } = e
  e = j.geste({ quoi: 'prendre', jokers: [], fiole })
  assert.deepEqual(e.fioles, [fiole])
  assert.deepEqual([e.paquet, e.ecus], [paquet, ecus], 'à la place d’une carte — et un coffre ouvert ne paie pas ses écus')
})

test(`l’échoppe vend sa fiole, une fois, ${PRIX_DE_L_ECHOPPE.fiole} écus ; ${FIOLES_MAX} places au plus — la troisième attend qu’il en boive une`, () => {
  const j = new Journal({ ...depart('fioles:echoppe', 3), cartes: [carteAvecEchoppe(), carteAvecEchoppe(), carteAvecEchoppe()] })
  let e = jusquAuCoffre(j)
  const premiere = e.offre!.fiole!
  j.geste({ quoi: 'prendre', jokers: [], fiole: premiere })
  e = j.avancer('e20')
  const vendue = e.echoppe!.fiole!
  assert.ok(FIOLES.some(f => f.cle === vendue), vendue)
  const ecus = e.ecus
  assert.ok(ecus >= PRIX_DE_L_ECHOPPE.fiole, `${ecus} écus`)
  e = j.geste({ quoi: 'acheter', article: 'fiole' })
  assert.deepEqual([e.fioles, e.ecus], [[premiere, vendue], ecus - PRIX_DE_L_ECHOPPE.fiole])
  assert.equal(refusDeLAchat(e, { article: 'fiole' }), 'Déjà achetée')
  assert.equal(refusDeLAchat({ ...e, echoppe: { ...e.echoppe!, achats: [] } }, { article: 'fiole' }), `Tes ${FIOLES_MAX} places de fiole sont prises : bois-en une d’abord`)
  // Le coffre de l'acte 2 en cache une autre : son sac plein, elle reste au coffre.
  j.avancer('e30')
  j.gagner()
  j.prendre()
  j.avancer('cg')
  j.geste({ quoi: 'camper' })
  j.avancer(GARDIEN)
  j.gagner()
  j.prendre()
  e = jusquAuCoffre(j)
  assert.equal(e.acte, 1)
  const troisieme = e.offre!.fiole!
  e = j.geste({ quoi: 'prendre', jokers: [], fiole: troisieme })
  assert.deepEqual(e.fioles, [premiere, vendue], 'deux places : la troisième ne se prend pas')
})

test('boire du courage quand il en manque — même la question sous les yeux, sa position portée ; au plein, elle reste au sac', () => {
  const j = aSaFiole('fioles:courage', 'courage')
  let e = j.geste({ quoi: 'prendre', jokers: [], fiole: 'courage' })
  assert.equal(refusDeLaFiole(e, 'courage', j.questions), 'Ton courage est au plus haut')
  assert.deepEqual(j.geste({ quoi: 'boire', fiole: 'courage' }).fioles, ['courage'], 'refusée, le pli l’ignore')
  j.avancer('e20')
  j.gagner()
  j.avancer('e30')
  j.repondre(false)
  e = j.repondre(false)
  const reste = e.courage!
  assert.ok(reste + COURAGE_D_UNE_FIOLE < COURAGE_MAX, `${reste} de courage`)
  e = j.geste({ quoi: 'boire', fiole: 'courage' })
  assert.deepEqual([e.courage, e.fioles], [reste, ['courage']], 'une question attend : sans sa position, le geste ne se joue pas par-dessus')
  e = j.geste({ quoi: 'boire', fiole: 'courage', position: e.enAttente! })
  assert.deepEqual([e.courage, e.fioles], [reste + COURAGE_D_UNE_FIOLE, []])
})

test('boire de l’énergie en rencontre : pour la question en cours seulement — sur le plan, elle attend', () => {
  const j = aSaFiole('fioles:energie', 'energie')
  let e = j.geste({ quoi: 'prendre', jokers: [], fiole: 'energie' })
  assert.equal(refusDeLaFiole(e, 'energie', j.questions), 'Elle se boit en rencontre : son énergie ne dure qu’une question')
  j.avancer('e20')
  j.gagner()
  e = j.avancer('e30')
  assert.equal(e.rencontre?.tour.phase, 'preparation')
  e = j.geste({ quoi: 'boire', fiole: 'energie', position: e.enAttente! })
  assert.deepEqual([e.rencontre!.tour.inspiration, e.fioles], [INSPIRATION_PAR_QUESTION + ENERGIE_D_UNE_FIOLE, []])
  e = j.repondre(true)
  assert.ok(e.rencontre, 'il tient encore')
  assert.equal(e.rencontre!.tour.inspiration, INSPIRATION_PAR_QUESTION, 'la question suivante repart de la sienne')
})

test('boire la clairvoyance, la question sous les yeux : une mauvaise réponse effacée, comptée avec celles des cartes — ni sur un vrai ou faux, ni plus de deux sur quatre', () => {
  const j = aSaFiole('fioles:clairvoyance', 'clairvoyance')
  let e = jusquALaRencontre(j, 'clairvoyance')
  assert.equal(refusDeLaFiole(e, 'clairvoyance', j.questions), 'Elle se boit la question sous les yeux', 'en préparation, la question est cachée')
  e = j.voir()
  assert.equal(refusDeLaFiole(e, 'clairvoyance', j.questions), null)
  const vraiFaux = j.questions.map((q, i) => (i === e.enAttente ? { ...q, reponses: 2 } : q))
  assert.equal(refusDeLaFiole(e, 'clairvoyance', vraiFaux), 'Pas sur un vrai ou faux : elle répondrait à ta place')
  e = j.geste({ quoi: 'boire', fiole: 'clairvoyance', position: e.enAttente! })
  const t = e.rencontre!.tour
  assert.deepEqual([t.surLaQuestion, e.fioles], [[CLAIRVOYANCE_SUR_LA_QUESTION], []])
  assert.equal(effaceesDuTour(t.surLaQuestion, e.rencontre!.pouvoirs, { reponses: 4 }), 1)
  assert.equal(vueDeLaRencontre(j.depart, e, j.questions)!.effacees, 1, 'la page le sait ; le serveur seul dit laquelle')
  // Deux effacées sur quatre : il n'en reste que deux, une de plus répondrait à sa place.
  const deux = { ...e, fioles: ['clairvoyance' as const], rencontre: { ...e.rencontre!, tour: { ...t, surLaQuestion: [...t.surLaQuestion, 'coup-d-oeil'] } } }
  assert.equal(refusDeLaFiole(deux, 'clairvoyance', j.questions), 'Il ne reste que deux réponses : plus rien à effacer')
})

test('les dos de cartes : l’ordinaire d’office, l’étoilé au niveau 6, le doré par l’exploit du gardien — chacun une fois', () => {
  assert.deepEqual(
    DOS_DES_CARTES.map(d => d.cle),
    ['ordinaire', 'etoile', 'dore'],
    'du plus commun au plus rare : un départ sans choix prend le dernier qu’il a',
  )
  assert.deepEqual(
    DOS_DES_CARTES.map(d => ouvertureDuDos(d.cle)),
    [{ niveau: 1 }, { niveau: 6 }, { exploit: 'gardien-intact' }],
  )
  for (const d of DOS_DES_CARTES.slice(1)) assert.equal(ECHELLE.filter(m => m.dos === d.cle).length + EXPLOITS.filter(x => x.dos === d.cle).length, 1, d.cle)
  assert.deepEqual(dosOuverts(5, []), ['ordinaire'])
  assert.deepEqual(dosOuverts(6, []), ['ordinaire', 'etoile'])
  assert.deepEqual(dosOuverts(1, ['gardien-intact']), ['ordinaire', 'dore'])
  assert.deepEqual(codexDuNiveau(NIVEAU_MAX, [], ['gardien-intact']).dos, ['ordinaire', 'etoile', 'dore'], 'le codex les dit, le départ en prend un')
})

// ── L'Ascension ─────────────────────────────────────────────────────────────

test('l’Ascension s’ouvre par les victoires : la première ouvre le cran 1, une victoire à son plus haut cran le suivant — plus bas ou perdue, rien ; le dernier au plus — et le bilan garde son cran', () => {
  const b = (auBout: boolean, ascension?: number): BilanDUneExpedition => ({ escales: 9, adversaires: 5, elites: 1, gardiens: auBout ? 3 : 1, auBout, exploits: [], ...(ascension !== undefined && { ascension }) })
  assert.deepEqual(
    ASCENSION.map(c => c.cran),
    Array.from({ length: ASCENSION_MAX }, (_, i) => i + 1),
  )
  assert.equal(ascensionOuverte([]), 0)
  assert.equal(ascensionOuverte([b(false), b(false, 3)]), 0, 'perdues, elles n’ouvrent rien')
  assert.equal(ascensionOuverte([b(true)]), 1, 'une victoire d’avant l’Ascension l’ouvre')
  assert.equal(ascensionOuverte([b(true), b(true, 1)]), 2)
  assert.equal(ascensionOuverte([b(true, 2), b(true)]), 3, 'une victoire plus bas ne reprend rien')
  assert.equal(ascensionOuverte([b(true, ASCENSION_MAX)]), ASCENSION_MAX, 'le dernier au plus')
  assert.equal(cranOuvertParLaVictoire(0, 0), 1)
  assert.equal(cranOuvertParLaVictoire(0, 1), null, 'sous son plus haut cran, la victoire n’ouvre rien')
  assert.equal(cranOuvertParLaVictoire(2, 2), 3)
  assert.equal(cranOuvertParLaVictoire(ASCENSION_MAX, ASCENSION_MAX), null)
  // Relu, un cran se borne au dernier ; illisible, il ne compte pas — sans cran, le bilan se lit sans.
  const perdue = b(false)
  assert.deepEqual(lireLeBilan(ecrireLeBilan({ ...perdue, ascension: 2 })), { ...perdue, ascension: 2 })
  assert.deepEqual(lireLeBilan(ecrireLeBilan(perdue)), perdue)
  assert.deepEqual(lireLeBilan(JSON.stringify({ v: VERSION_DU_BILAN, ...perdue, ascension: 99 })), { ...perdue, ascension: ASCENSION_MAX })
  assert.deepEqual(lireLeBilan(JSON.stringify({ v: VERSION_DU_BILAN, ...perdue, ascension: 'trois' })), perdue)
})

/** Le départ du codex entier, à ce cran. */
const aSonCran = (graine: string, ascension: number): DepartDExpedition => ({ ...depart(graine, NIVEAU_MAX), ...(ascension > 0 && { ascension }) })

test('chaque cran durcit l’expédition et garde ceux d’en dessous : les points des adversaires, leur frappe, l’énergie de chaque question, les gardiens ; le bilan dit son cran', () => {
  for (let cran = 0; cran <= ASCENSION_MAX; cran++) {
    const e = new Journal(aSonCran(`ascension:${cran}`, cran)).avancer('e00')
    assert.equal(e.ascension, cran)
    assert.equal(e.courage, COURAGE_MAX, 'le courage du départ ne bouge pas')
    assert.equal(e.rencontre!.tour.inspiration, INSPIRATION_PAR_QUESTION - (cran >= 4 ? ENERGIE_EN_ASCENSION : 0), `cran ${cran} : l’énergie de la question`)
    assert.deepEqual([e.rencontre!.sceaux, e.rencontre!.max], Array(2).fill(sceauxDe('question', 0) + (cran >= 1 ? POINTS_EN_ASCENSION : 0)), `cran ${cran} : ses points`)
    assert.equal(e.rencontre!.frappe, frappeDe('question', 0) + (cran >= 2 ? FRAPPE_EN_ASCENSION : 0), `cran ${cran} : sa frappe`)
    const g = jusquAuGardien(new Journal(aSonCran(`ascension:gardien:${cran}`, cran)))
    const points = sceauxDe('gardien', 0) + (cran >= 1 ? POINTS_EN_ASCENSION : 0)
    assert.equal(g.rencontre!.max, cran >= 5 ? Math.round(points * GARDIENS_EN_ASCENSION) : points, `cran ${cran} : le gardien`)
    assert.equal(bilanDuPli(g).ascension, cran > 0 ? cran : undefined)
  }
})

test('dès le cran 3, le campement et la source rendent moitié moins de courage, arrondi au-dessus', () => {
  assert.deepEqual(
    [reposALAscension(COURAGE_D_UNE_SOURCE, 3), reposALAscension(COURAGE_D_UN_CAMPEMENT, 3)],
    [Math.ceil(COURAGE_D_UNE_SOURCE / 2), Math.ceil(COURAGE_D_UN_CAMPEMENT / 2)],
  )
  for (const cran of [2, 3]) {
    const j = new Journal(aSonCran(`ascension:repos:${cran}`, cran))
    // Trois erreurs d'abord : ni la source ni le campement ne le remontent au plein.
    j.avancer('e00')
    for (let k = 0; k < 3; k++) j.repondre(false)
    j.gagner()
    j.prendre()
    j.avancer('e10')
    j.prendre()
    let avant = j.avancer('e20').courage!
    let e = j.gagner()
    assert.equal(e.courage! - avant, reposALAscension(COURAGE_D_UNE_SOURCE, cran), `cran ${cran} : la source`)
    j.avancer('e30')
    j.gagner()
    j.prendre()
    avant = j.avancer('cg').courage!
    e = j.geste({ quoi: 'camper' })
    assert.equal(e.courage! - avant, reposALAscension(COURAGE_D_UN_CAMPEMENT, cran), `cran ${cran} : le campement`)
  }
})

test('un cran ne se lit qu’au codex : une expédition d’avant lui l’ignore — et au-delà du dernier, c’est le dernier', () => {
  const avant: DepartDExpedition = { ...aSonCran('ascension:avant', ASCENSION_MAX), v: 6, codex: undefined }
  assert.equal(ascensionDuDepart(avant), 0)
  const e = new Journal(avant).avancer('e00')
  assert.deepEqual([e.ascension, e.courage, e.rencontre!.max], [0, COURAGE_MAX, sceauxDe('question', 0)])
  assert.equal(ascensionDuDepart(aSonCran('ascension:trop', 9)), ASCENSION_MAX)
})
