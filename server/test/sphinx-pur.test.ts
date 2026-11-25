// Le Sphinx de l'accueil, en dérivations pures (le plan du 24 novembre 2026,
// `retours/2026-11-24/le-sphinx/plan.md`) : comment il lit une réponse, qui
// est un habitué, quand il passe, quelle énigme il pose, ce qu'il laisse voir
// de la phrase d'un Divin, le mot qu'il souffle, et le Divin du moment. Sur
// un serveur jetable : `sphinx-accueil.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  CHANCE_D_UNE_VISITE,
  ENIGMES_DEJA_VUES_DU_PROPRIETAIRE,
  MOTS_NEUFS_PAR_JOUR,
  ORDRE_DU_SPHINX,
  VISITES_FACILES,
  appliquerLeGeste,
  choisirLEnigme,
  choisirLeMot,
  divinDuMoment,
  enigmesDuSphinx,
  estUnNombre,
  jugerLaReponse,
  joursJoues,
  laSuivanteSurgit,
  motsDeLaLegende,
  motsEgaux,
  normaliser,
  phraseVue,
  phrasesReconstituees,
  quiADesMotsPour,
  tirageDeLaVisite,
  visiteEnCours,
  type Enigme,
} from '../src/core/sphinx'
import type { LigneDuSphinx } from '../src/auth/profiles'
import { legendeDe } from '../src/core/divins'
import { DIVINS } from '../../shared/divins'
import { AUCUNE_ACTIVITE, type ActiviteDuJour } from '../../shared/missions'
import { ESSAIS_DU_SPHINX, JOURS_DE_L_HABITUE, QUI_A_DES_MOTS_MONTRES } from '../../shared/sphinx'
import { jourAvant } from '../../shared/jour'
import { hasardDe } from '../../shared/missions'

/** Les Divins qui ont leur légende : tous ceux du catalogue (`divins.test.ts` y veille). */
const RECITS_CONNUS = DIVINS.map(d => d.key).filter(cle => legendeDe(cle) !== null)

// ── La réponse ────────────────────────────────────────────────────────────

test('une réponse se lit sans casse, sans accents, sans ponctuation, sans article ni « c’est »', () => {
  for (const r of ['L’éclair', "c'est l'éclair", 'un éclair', 'Un ÉCLAIR !', '  l\'Éclair. ', "C’est un éclair", 'de l’éclair']) assert.equal(normaliser(r), 'eclair', r)
  assert.equal(normaliser('les yeux'), 'yeux')
  assert.equal(normaliser('la lettre U'), 'lettre u')
  assert.equal(normaliser('Fer à cheval'), 'fer a cheval')
  assert.equal(normaliser('Un œil'), 'oeil', 'la ligature se déplie')
  assert.equal(normaliser('Couvre-chef'), 'couvre chef', 'le trait d’union est une ponctuation')
  assert.equal(normaliser('0'), '0', 'un chiffre reste : « zéro » s’écrit aussi « 0 »')
  assert.equal(normaliser('la'), 'la', 'un article seul n’est pas un article de tête')
})

/** Une énigme de la réserve, par son numéro. */
const enigme = (numero: string): Enigme => {
  const e = enigmesDuSphinx().find(x => x.numero === numero)
  assert.ok(e, `l’énigme n° ${numero}`)
  return e
}

test('le Sphinx juge sur les réponses acceptées, et une réponse proche brûle', () => {
  const eclair = enigme('32')
  assert.equal(jugerLaReponse(eclair, 'L’éclair'), 'juste')
  assert.equal(jugerLaReponse(eclair, 'des éclairs'), 'juste')
  assert.equal(jugerLaReponse(eclair, 'le tonnerre'), 'brulant')
  assert.equal(jugerLaReponse(eclair, 'la pluie'), 'faux')
  assert.equal(jugerLaReponse(eclair, ''), 'faux')
  // Une acceptée écrite avec son article ou son trait d'union se lit comme la réponse du joueur.
  assert.equal(jugerLaReponse(enigme('8'), 'Les yeux'), 'juste')
  assert.equal(jugerLaReponse(enigme('8'), 'œil'), 'juste')
  // Sans espaces : « pente-côte », « pentecôte » et « pente côte » sont la même réponse.
  const charade = enigmesDuSphinx().find(e => e.acceptees.some(a => a.includes('-')))
  if (charade) {
    const avec = charade.acceptees.find(a => a.includes('-'))!
    assert.equal(jugerLaReponse(charade, avec.replace(/-/g, '')), 'juste', avec)
  }
})

test('la réserve : quatre-vingt-six pièces, sans les traces du test à l’aveugle, chacune sa source', () => {
  const toutes = enigmesDuSphinx()
  assert.equal(toutes.length, 86)
  assert.equal(new Set(toutes.map(e => e.numero)).size, 86, 'un numéro chacune')
  assert.deepEqual(
    { enigme: toutes.filter(e => e.sorte === 'enigme').length, charade: toutes.filter(e => e.sorte === 'charade').length },
    { enigme: 55, charade: 31 },
  )
  for (const e of toutes) {
    assert.ok(e.vers.length > 0 && e.solution && e.acceptees.length > 0, e.numero)
    assert.ok(['facile', 'moyenne', 'difficile'].includes(e.difficulte), e.numero)
    assert.match(e.facSimile, /^https:\/\/fr\.wikisource\.org\/wiki\/Page:.*\.djvu\/\d+$/, e.numero)
    assert.ok(e.page, e.numero)
    // La solution du livre est toujours une réponse juste.
    assert.equal(jugerLaReponse(e, e.solution), 'juste', `n° ${e.numero} : « ${e.solution} »`)
    // Une réponse qui brûle ne coûte pas d'essai ; acceptée aussi (« jour », au n° 286), elle est juste : la relecture
    // l'a jugée bonne, le doute profite au joueur.
    for (const p of e.presque) assert.equal(jugerLaReponse(e, p), e.acceptees.includes(p) ? 'juste' : 'brulant', `n° ${e.numero} : « ${p} »`)
  }
  for (const n of ENIGMES_DEJA_VUES_DU_PROPRIETAIRE) assert.ok(toutes.some(e => e.numero === n), `n° ${n}`)
  // Le test à l'aveugle reste dans `retours/` : ni les réponses des joueurs simulés, ni le verdict de la relecture.
  const brut = readFileSync(fileURLToPath(new URL('../content/sphinx/enigmes.json', import.meta.url)), 'utf8')
  assert.doesNotMatch(brut, /"(aveugle|raison|retenue|lot)"\s*:/)
})

// ── L'habitué ─────────────────────────────────────────────────────────────

const AUJOURDHUI = '2026-11-24'
const joue: ActiviteDuJour = { ...AUCUNE_ACTIVITE, joue: true }
const activites = (...ilYa: number[]) => new Map(ilYa.map(n => [jourAvant(AUJOURDHUI, n), joue]))

test('un habitué a joué quatre jours sur les sept derniers, aujourd’hui compris', () => {
  assert.equal(JOURS_DE_L_HABITUE, 4)
  assert.equal(joursJoues(activites(0, 1, 2, 3), AUJOURDHUI), 4)
  assert.equal(joursJoues(activites(0, 2, 4, 6), AUJOURDHUI), 4)
  assert.equal(joursJoues(activites(1, 2, 3, 7), AUJOURDHUI), 3, 'il y a sept jours, c’est hors de la fenêtre')
  // Un jour où il n'a joué qu'une soirée seul : présent dans ses journaux, pas joué.
  const seul = activites(0, 1, 2)
  seul.set(jourAvant(AUJOURDHUI, 3), { ...AUCUNE_ACTIVITE, joue: false })
  assert.equal(joursJoues(seul, AUJOURDHUI), 3)
  // Demain, ce n'est pas encore aujourd'hui.
  const demain = activites(1, 2, 3)
  demain.set(jourAvant(AUJOURDHUI, -1), joue)
  assert.equal(joursJoues(demain, AUJOURDHUI), 3)
})

// ── La visite ─────────────────────────────────────────────────────────────

test('la visite se tire de la graine du profil et du jour : stable, une chance sur trois en moyenne', () => {
  assert.equal(CHANCE_D_UNE_VISITE, 1 / 3)
  assert.equal(tirageDeLaVisite('p1|2026-11-24'), tirageDeLaVisite('p1|2026-11-24'), 'la même graine, le même tirage')
  let visites = 0
  const essais = 6000
  for (let i = 0; i < essais; i++) if (tirageDeLaVisite(`profil-${i}|2026-11-${String((i % 28) + 1).padStart(2, '0')}`) < CHANCE_D_UNE_VISITE) visites++
  const part = visites / essais
  assert.ok(part > 0.3 && part < 0.37, `${Math.round(part * 100)} % des jours`)
})

/** Une réserve inventée : six faciles, six moyennes, six difficiles. */
const reserve: Enigme[] = (['facile', 'moyenne', 'difficile'] as const).flatMap(difficulte =>
  Array.from({ length: 6 }, (_, i) => ({ ...enigme('32'), numero: `${difficulte}-${i}`, difficulte })),
)

test('l’énigme : jamais une déjà vue, des faciles pour ses trois premières visites, puis mêlées — les difficiles moins souvent', () => {
  assert.equal(VISITES_FACILES, 3)
  for (let v = 0; v < VISITES_FACILES; v++) {
    for (let g = 0; g < 50; g++) assert.equal(choisirLEnigme(reserve, new Set(), v, hasardDe(`g${g}`))?.difficulte, 'facile')
  }
  // Ensuite, mêlées : sur mille tirages, chaque difficulté sort, les difficiles moins que les autres.
  const sorties = { facile: 0, moyenne: 0, difficile: 0 }
  for (let g = 0; g < 1000; g++) sorties[choisirLEnigme(reserve, new Set(), VISITES_FACILES, hasardDe(`m${g}`))!.difficulte]++
  assert.ok(sorties.difficile > 100 && sorties.difficile < sorties.facile && sorties.difficile < sorties.moyenne, JSON.stringify(sorties))
  // Jamais une vue ; plus de faciles, les premières visites prennent ce qui reste.
  const vues = new Set(reserve.filter(e => e.difficulte === 'facile').map(e => e.numero))
  for (let g = 0; g < 50; g++) assert.notEqual(choisirLEnigme(reserve, vues, 0, hasardDe(`v${g}`))?.difficulte, 'facile')
  // Toutes vues : plus d'énigme, donc pas de visite.
  assert.equal(choisirLEnigme(reserve, new Set(reserve.map(e => e.numero)), 9, hasardDe('x')), null)
})

// ── La phrase d'un Divin ──────────────────────────────────────────────────

test('la forme d’une phrase : un trait par lettre, l’apostrophe et le trait d’union montrés, les petits mots offerts — sauf un nombre', () => {
  const mots = motsDeLaLegende('Dix réponses, pas une faute : il n’a pas tremblé — vingt-cinq fois, 12 jours.')
  assert.deepEqual(
    mots.map(m => [m.texte, m.cache, m.forme]),
    [
      ['Dix', true, '___'],
      ['réponses', true, '________'],
      ['pas', false, '___'],
      ['une', true, '___'],
      ['faute', true, '_____'],
      ['il', false, '__'],
      ['n’a', false, '_’_'],
      ['pas', false, '___'],
      ['tremblé', true, '_______'],
      ['vingt-cinq', true, '_____-____'],
      ['fois', true, '____'],
      ['12', true, '__'],
      ['jours', true, '_____'],
    ],
  )
  for (const n of ['six', 'Dix', 'un', 'une', 'cent', 'mille', 'onze', 'dix-huit', '3', 'Vingt-cinq']) assert.ok(estUnNombre(n), n)
  for (const n of ['il', 'pas', 'les', 'sur', 'fil', 'lui']) assert.ok(!estUnNombre(n), n)
  // Aucune légende n'offre un nombre, ni un mot de plus de trois lettres.
  for (const cle of RECITS_CONNUS) {
    for (const m of motsDeLaLegende(legendeDe(cle)!)) {
      if (m.cache) continue
      assert.ok(!estUnNombre(m.texte) && m.texte.replace(/[’'-]/g, '').length <= 3, `${cle} offre « ${m.texte} »`)
    }
  }
})

test('ce qu’un profil voit d’une phrase : ses mots, les petits mots, la forme du reste — et combien tous en ont trouvé, jamais lesquels', () => {
  const legende = 'Dix réponses, pas une faute : il n’a pas tremblé.'
  const divin = { key: 'dv:essai', nom: 'L’Essai' }
  const vue = phraseVue(divin, legende, { siens: new Set([1]), deTous: new Set([1, 4, 8]) })
  assert.deepEqual(vue.mots[0], { forme: '___' }, 'un nombre, caché')
  assert.deepEqual(vue.mots[1], { forme: '________', texte: 'réponses', sien: true })
  assert.deepEqual(vue.mots[2], { forme: '___', texte: 'pas', offert: true })
  assert.deepEqual(vue.mots[4], { forme: '_____' }, 'trouvé par un autre : il ne le voit pas')
  assert.deepEqual([vue.aTrouver, vue.siens, vue.parTous, vue.reconstituee], [5, 1, 3, false])
  assert.ok(!JSON.stringify(vue).includes('faute') && !JSON.stringify(vue).includes('tremblé'))
  // Tous les mots trouvés, par tous : retrouvée — elle ne s'impose plus (la décision du 24 novembre 2026). Rien de plus
  // que ses mots ne part, et elle dit qu'elle se dévoile à sa demande.
  const retrouvee = phraseVue(divin, legende, { siens: new Set([1]), deTous: new Set([0, 1, 3, 4, 8]) })
  assert.deepEqual([retrouvee.reconstituee, retrouvee.aDevoiler, retrouvee.legende], [true, true, undefined])
  assert.deepEqual(retrouvee.mots.map(m => m.texte), [undefined, 'réponses', 'pas', undefined, undefined, 'il', 'n’a', 'pas', undefined])
  assert.ok(!JSON.stringify(retrouvee).includes('faute') && !JSON.stringify(retrouvee).includes('tremblé'))
  // Choisie (`lue`), elle se montre entière, sa ponctuation comprise.
  const entiere = phraseVue(divin, legende, { siens: new Set(), deTous: new Set([0, 1, 3, 4, 8]), lue: true })
  assert.equal(entiere.reconstituee, true)
  assert.equal(entiere.aDevoiler, undefined)
  assert.deepEqual(entiere.mots.map(m => m.texte), ['Dix', 'réponses', 'pas', 'une', 'faute', 'il', 'n’a', 'pas', 'tremblé'])
  assert.equal(entiere.legende, legende)
  // Lue avant d'être retrouvée — une ligne d'un serveur d'avant : rien de plus.
  assert.equal(phraseVue(divin, legende, { siens: new Set([1]), deTous: new Set([1, 4, 8]), lue: true }).legende, undefined)
  // Qui a trouvé chaque mot caché lui-même la voit entière, sans geste.
  const sienne = phraseVue(divin, legende, { siens: new Set([0, 1, 3, 4, 8]), deTous: new Set([0, 1, 3, 4, 8]) })
  assert.deepEqual([sienne.aDevoiler, sienne.legende], [undefined, legende])
  // Son porteur en connaît la légende : elle se montre entière à lui.
  const porteur = phraseVue(divin, legende, { siens: new Set(), deTous: new Set(), porteur: true })
  assert.equal(porteur.porteur, true)
  assert.equal(porteur.mots.every(m => m.texte), true)
  assert.equal(porteur.legende, legende)
  // Retrouvée par tous, son porteur n'a rien à dévoiler.
  assert.equal(phraseVue(divin, legende, { siens: new Set(), deTous: new Set([0, 1, 3, 4, 8]), porteur: true }).aDevoiler, undefined)
})

// Le premier retour de la production, le 24 novembre 2026 : « Je vois nulle
// part où rentrer le mot des autres. » Un mot qu'un autre lui a dit s'inscrit
// sur son trait (`Sphinx.inscrire`) : appris, il se montre à lui comme les
// siens, en argent — et compte pour la lire entière, qu'il a gagnée en
// coopérant.
test('un mot appris se montre à qui l’a inscrit, à part des siens, et compte pour lire la phrase entière', () => {
  const legende = 'Dix réponses, pas une faute : il n’a pas tremblé.'
  const divin = { key: 'dv:essai', nom: 'L’Essai' }
  const vue = phraseVue(divin, legende, { siens: new Set([1]), appris: new Set([4]), deTous: new Set([1, 4, 8]) })
  assert.deepEqual(vue.mots[4], { forme: '_____', texte: 'faute', appris: true })
  assert.deepEqual(vue.mots[8], { forme: '_______' }, 'trouvé par un autre, pas inscrit : il ne le voit pas')
  assert.deepEqual([vue.siens, vue.appris, vue.parTous], [1, 1, 3])
  assert.ok(!JSON.stringify(vue).includes('tremblé'))
  // Trouvés ou appris, tous ses mots cachés : la phrase est à lui, entière — sans attendre qu'elle soit retrouvée par tous.
  const entiere = phraseVue(divin, legende, { siens: new Set([1, 3]), appris: new Set([0, 4, 8]), deTous: new Set([1, 3, 4, 8]) })
  assert.deepEqual([entiere.legende, entiere.aDevoiler], [legende, undefined])
  // Un mot qu'il a aussi trouvé reste le sien, en or.
  assert.deepEqual(phraseVue(divin, legende, { siens: new Set([4]), appris: new Set([4]), deTous: new Set([4]) }).mots[4], { forme: '_____', texte: 'faute', sien: true })
})

test('un mot inscrit se lit comme on le tape : sans casse, sans accents, l’élision et le trait d’union permis', () => {
  // Les mots de la phrase inventée de la maquette, jamais ceux d'une légende.
  for (const [tape, texte] of [
    ['DEFIE', 'défie'],
    ['  défie ', 'défie'],
    ["l'heure", 'l’heure'],
    ['heure', 'l’heure'],
    ['rendez vous', 'rendez-vous'],
    ['rendezvous', 'rendez-vous'],
  ] as const) {
    assert.ok(motsEgaux(tape, texte), `« ${tape} » pour « ${texte} »`)
  }
  for (const [tape, texte] of [
    ['defi', 'défie'],
    ['l', 'l’heure'],
    ['', 'défie'],
    ['temps', 'défie'],
  ] as const) {
    assert.ok(!motsEgaux(tape, texte), `« ${tape} » n’est pas « ${texte} »`)
  }
})

test('à qui demander : ceux qui ont des mots, ses amis d’abord puis les plus riches — jamais lui, ni un masqué', () => {
  const t = (id: string, name: string, mots: number, le: number) => ({ id, name, avatar: '🦊', legendaire: null, le, mots })
  const trouveurs = [t('lea', 'Léa', 3, 1), t('tom', 'Tom', 1, 2), t('moi', 'Moi', 2, 3), t('zoe', 'Zoé', 2, 4), t('cache', 'Caché', 5, 5)]
  const { liste, autres } = quiADesMotsPour(trouveurs, 'moi', new Set(['tom']), id => id === 'cache')
  assert.deepEqual(
    liste.map(q => [q.nom, q.mots, q.ami ?? false]),
    [
      ['Tom', 1, true],
      ['Léa', 3, false],
      ['Zoé', 2, false],
    ],
  )
  assert.equal(autres, 0)
  // Au-delà de la liste, combien d'autres.
  const nombreux = Array.from({ length: QUI_A_DES_MOTS_MONTRES + 3 }, (_, i) => t(`p${i}`, `P${i}`, 1, i))
  const grande = quiADesMotsPour(nombreux, 'moi', new Set(), () => false)
  assert.deepEqual([grande.liste.length, grande.autres], [QUI_A_DES_MOTS_MONTRES, 3])
  // Deux homonymes au même visage se marquent à l'affichage (invariant 17).
  const deux = quiADesMotsPour([t('a', 'Léa', 1, 1), t('b', 'Léa', 1, 2)], 'moi', new Set(), () => false)
  assert.deepEqual(
    deux.liste.map(q => q.nom),
    ['Léa', 'Léa (2)'],
  )
})

test('le mot soufflé : d’abord un que personne n’a encore, sinon un qu’il n’a pas, au hasard de sa graine', () => {
  const caches = [0, 1, 3, 4, 8]
  for (let g = 0; g < 50; g++) assert.equal(choisirLeMot(caches, new Set([0]), new Set([0, 1, 3, 4]), hasardDe(`a${g}`)), 8)
  const pris = new Set<number>()
  for (let g = 0; g < 200; g++) pris.add(choisirLeMot(caches, new Set([0, 1]), new Set(caches), hasardDe(`b${g}`))!)
  assert.deepEqual([...pris].sort((a, b) => a - b), [3, 4, 8], 'tous trouvés par d’autres : un des siens qui manque, n’importe lequel')
  assert.equal(choisirLeMot(caches, new Set(caches), new Set(caches), hasardDe('c')), null, 'il les a tous')
  assert.equal(choisirLeMot(caches, new Set(), new Set(), hasardDe('d')), choisirLeMot(caches, new Set(), new Set(), hasardDe('d')), 'la même graine, le même mot')
})

// Le choix du propriétaire du 25 novembre 2026, « un mot neuf par jour » : à quinze habitués, la première phrase tombait
// en trois jours. Le mot neuf du jour parti, le Sphinx souffle un mot que d'autres ont déjà trouvé et qu'il n'a pas.
test('le mot neuf du jour parti, un mot déjà trouvé qu’il n’a pas ; s’il les a tous, un neuf quand même', () => {
  const caches = [0, 1, 3, 4, 8]
  const pris = new Set<number>()
  for (let g = 0; g < 200; g++) pris.add(choisirLeMot(caches, new Set([0]), new Set([0, 1, 3]), hasardDe(`e${g}`), { neufPermis: false })!)
  assert.deepEqual([...pris].sort((a, b) => a - b), [1, 3], 'trouvés par d’autres, qu’il n’a pas — jamais 4 ni 8')
  // Il a tous ceux qu'on a trouvés : le plus assidu ne repart pas les mains vides, un neuf quand même.
  assert.equal(choisirLeMot(caches, new Set([0, 1, 3]), new Set([0, 1, 3]), hasardDe('f'), { neufPermis: false }) !== null, true)
  assert.ok([4, 8].includes(choisirLeMot(caches, new Set([0, 1, 3]), new Set([0, 1, 3]), hasardDe('f'), { neufPermis: false })!))
  // Permis, rien ne change : d'abord un que personne n'a.
  assert.equal(choisirLeMot(caches, new Set([0]), new Set([0, 1, 3, 4]), hasardDe('g'), { neufPermis: true }), 8)
  assert.equal(MOTS_NEUFS_PAR_JOUR, 1)
})

test('le Divin du moment : le premier de l’ordre dont tous n’ont pas trouvé chaque mot caché ; reconstituée, sa phrase passe au suivant', () => {
  // L'ordre nomme chacun des Divins une fois, ceux qui ont un récit.
  assert.deepEqual([...ORDRE_DU_SPHINX].sort(), [...RECITS_CONNUS].sort())
  const catalogue = new Set(DIVINS.map(d => d.key))
  const [premier, second, troisieme] = ORDRE_DU_SPHINX
  assert.equal(divinDuMoment(new Map(), catalogue), premier)
  const tous = (cle: string) => new Set(motsDeLaLegende(legendeDe(cle)!).flatMap((m, i) => (m.cache ? [i] : [])))
  // Tous les mots du premier, sauf un : il reste le Divin du moment.
  const presque = tous(premier)
  presque.delete([...presque][0])
  assert.equal(divinDuMoment(new Map([[premier, presque]]), catalogue), premier)
  // Tous : le suivant prend sa place, et la phrase du premier se montre entière.
  const mots = new Map([[premier, tous(premier)]])
  assert.equal(divinDuMoment(mots, catalogue), second)
  assert.deepEqual(phrasesReconstituees(mots, catalogue).map(p => [p.divin.key, p.legende]), [[premier, legendeDe(premier)]])
  // Un Divin pas encore au catalogue ne se tire pas : le Sphinx passe au suivant.
  assert.equal(divinDuMoment(mots, new Set([...catalogue].filter(c => c !== second))), troisieme)
  // Tous reconstitués : plus de Divin du moment.
  assert.equal(divinDuMoment(new Map(ORDRE_DU_SPHINX.map(c => [c, tous(c)])), catalogue), null)
})

// ── Le verdict ────────────────────────────────────────────────────────────

test('trois essais ; une réponse qui brûle n’en coûte pas, la même réponse fausse non plus ; le chat clôt', () => {
  assert.equal(ESSAIS_DU_SPHINX, 3)
  const e = enigme('32')
  let ligne = { etat: 'proposee' as const, essais: 0, reponses: [] as string[] }
  const geste = (g: Parameters<typeof appliquerLeGeste>[1], reponse?: string): any => {
    const r = appliquerLeGeste(ligne, g, reponse, e)
    if ('refus' in r) return r
    ligne = { ...ligne, ...r.apres } as typeof ligne
    return r
  }
  assert.deepEqual(geste('plus-tard'), { apres: { etat: 'plus-tard', essais: 0, reponses: [] } })
  assert.equal(ligne.etat, 'plus-tard')
  assert.equal(geste('ecouter').apres?.etat, 'proposee')
  assert.equal((geste('repondre', 'le tonnerre') as any).verdict, 'brulant')
  assert.equal(ligne.essais, 0, 'brûlant : pas un essai de moins')
  assert.equal((geste('repondre', 'la pluie') as any).verdict, 'faux')
  const redite = geste('repondre', 'La pluie !') as any
  assert.deepEqual([redite.verdict, redite.dejaDite, ligne.essais], ['faux', true, 1], 'la même, redite : pas un second essai')
  assert.equal((geste('repondre', 'le vent') as any).verdict, 'faux')
  assert.equal((geste('repondre', 'la neige') as any).verdict, 'perdu')
  assert.deepEqual([ligne.etat, ligne.essais], ['perdue', 3])
  assert.ok('refus' in geste('repondre', 'éclair'), 'close : plus rien ne se joue')
  // Juste au premier essai ; le chat, à tout moment avant la fin.
  ligne = { etat: 'proposee', essais: 0, reponses: [] }
  assert.deepEqual([(geste('repondre', 'éclair') as any).verdict, ligne.etat], ['juste', 'resolue'])
  ligne = { etat: 'plus-tard' as any, essais: 1, reponses: ['pluie'] }
  assert.deepEqual([(geste('chat') as any).verdict, ligne.etat], ['abandon', 'abandonnee'])
  // Une réponse vide ne coûte rien : elle se refuse.
  ligne = { etat: 'proposee', essais: 0, reponses: [] }
  assert.ok('refus' in geste('repondre', '  ! '))
})

// Le retour du propriétaire du 24 novembre 2026 : « il devrait interpeller
// une seule fois, puis c'est à l'utilisateur d'ouvrir l'énigme quand il le
// souhaite ». Son arrivée sur l'accueil se dit au serveur (`surgir`) : elle
// ne change rien à la visite, ni son état, ni ses essais, ni ses réponses.
test('surgir ne change rien à la visite : ni son état, ni ses essais, ni ses réponses', () => {
  const e = enigme('32')
  for (const avant of [
    { etat: 'proposee' as const, essais: 0, reponses: [] as string[] },
    { etat: 'plus-tard' as const, essais: 1, reponses: ['pluie'] },
  ]) {
    assert.deepEqual(appliquerLeGeste(avant, 'surgir', undefined, e), { apres: avant })
  }
  assert.ok('refus' in appliquerLeGeste({ etat: 'resolue', essais: 1, reponses: [] }, 'surgir', undefined, e), 'close : rien à surgir')
})

// ── L'énigme qui attend ───────────────────────────────────────────────────

// Le choix du propriétaire du 25 novembre 2026 : « garder l'énigme pas
// uniquement la journée mais jusqu'à la résolution », et ne pas interpeller
// tous les trois jours qui « s'en fout ». Elle mourait à minuit ; elle attend
// maintenant sa fin, et la suivante ne surgit que s'il a joué celle d'avant.
const midiDu = (jour: number) => Date.UTC(2026, 8, jour, 10, 0)
const uneVisite = (jour: string, etat: LigneDuSphinx['etat'], plus: Partial<LigneDuSphinx> = {}): LigneDuSphinx => ({
  jour,
  enigme: `e-${jour}`,
  divin: ORDRE_DU_SPHINX[0],
  etat,
  essais: 0,
  reponses: [],
  mot: null,
  proposeeLe: 1,
  ecouteeLe: null,
  closeLe: null,
  ...plus,
})

test('la visite en cours : sa dernière tant qu’elle n’est pas close, de quelque jour qu’elle date, ou finie aujourd’hui', () => {
  const aujourdhui = '2026-09-26'
  const finie = uneVisite('2026-09-20', 'resolue', { essais: 1, closeLe: midiDu(20) })
  // Posée il y a trois jours, remise à plus tard : elle attend encore.
  assert.equal(visiteEnCours([finie, uneVisite('2026-09-23', 'plus-tard')], aujourdhui)?.jour, '2026-09-23')
  assert.equal(visiteEnCours([finie, uneVisite('2026-09-23', 'proposee', { essais: 2 })], aujourdhui)?.essais, 2, 'ses essais la suivent')
  // Finie aujourd'hui, même posée avant : c'est la sienne du jour, et aucune autre ne vient ce jour-là.
  const finieAujourdhui = uneVisite('2026-09-23', 'resolue', { essais: 1, closeLe: midiDu(26) })
  assert.equal(visiteEnCours([finie, finieAujourdhui], aujourdhui), finieAujourdhui)
  // Finie un autre jour : plus rien en cours.
  assert.equal(visiteEnCours([finie, uneVisite('2026-09-23', 'perdue', { essais: 3, closeLe: midiDu(24) })], aujourdhui), undefined)
  // Une visite d'avant, restée ouverte sous la règle de minuit et qu'une autre a suivie, ne revient pas : seule la
  // dernière peut attendre.
  assert.equal(visiteEnCours([uneVisite('2026-09-20', 'proposee'), uneVisite('2026-09-22', 'abandonnee', { closeLe: midiDu(22) })], aujourdhui), undefined)
  // Les lignes à part ne sont pas des visites, même rangées après elles.
  assert.equal(visiteEnCours([finie, uneVisite('vue:32', 'vue'), uneVisite('appris:dv:x:3', 'appris'), uneVisite('inscrits:2026-09-26', 'inscrits')], aujourdhui), undefined)
  assert.equal(visiteEnCours([], aujourdhui), undefined)
})

test('la suivante ne surgit que s’il a joué celle d’avant — une réponse au moins — ; sa toute première surgit toujours', () => {
  assert.equal(laSuivanteSurgit(undefined), true, 'sa première visite')
  assert.equal(laSuivanteSurgit(uneVisite('2026-09-20', 'abandonnee')), false, 'la langue au chat, sans un essai')
  assert.equal(laSuivanteSurgit(uneVisite('2026-09-20', 'abandonnee', { essais: 1 })), true, 'un essai, puis le chat')
  assert.equal(laSuivanteSurgit(uneVisite('2026-09-20', 'resolue', { essais: 1 })), true)
  assert.equal(laSuivanteSurgit(uneVisite('2026-09-20', 'perdue', { essais: 3 })), true)
  // Une visite d'avant laissée sans une réponse jusqu'à minuit, sous la règle d'avant : il ne l'a pas jouée.
  assert.equal(laSuivanteSurgit(uneVisite('2026-09-20', 'proposee')), false)
})
