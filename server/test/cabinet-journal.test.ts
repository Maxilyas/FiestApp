// Ce que le Cabinet de curiosités écrit au journal des réponses de la
// campagne (`campagne_reponses`), que l'expérience, les confettis, le carnet
// et la mesure lisent sans rien savoir de lui : une ligne par pièce — une par
// manche, deux au Pari parié —, juste dès deux étoiles naturelles, sa forme
// (`forme`, la clé de son jeu, sauf la première question du Pari, nue), le
// pouvoir qui l'a aidée (`joker`, jamais la clé d'une carte-bonus), et `cab:`
// devant tout ce qui n'est pas une question de la base. L'expérience se
// crédite une fois, à la fin ; une réponse ne se modifie ni ne s'efface.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inscrireProfil } from './banc'
import {
  DIX_HEURES,
  aLaMain,
  baseDuCabinet,
  bancDuCabinet,
  commencer,
  departEnBase,
  enBase,
  filetDe,
  jouer,
  jouerUnEclair,
  jouerUnFilet,
  jouerUnMot,
  jouerUnPari,
  laPage,
  lire,
  motDe,
  ok,
  ouvrir,
  pariDe,
  piecesALaMain,
  poster,
  questionDuCabinet,
  unPariParfait,
  type BancDuCabinet,
} from './cabinet-banc'
import { ProfileStore } from '../src/auth/profiles'
import { BaseDeLaCampagne } from '../src/core/baseCampagne'
import { CATEGORIES } from '../../shared/categories'
import { JOKER_D_ECLAIRER, PREFIXE_DU_CABINET } from '../../shared/cabinet/pieces'
import { JUSTES_DOUBLEES_PAR_JOUR, XP_PAR_JUSTE } from '../../shared/campagne'
import type { EclairTire } from '../../shared/cabinet/jeux/eclair'
import { JEU_DE_L_OEUVRE, oeuvre } from '../../shared/cabinet/oeuvres'
import type { PariTire } from '../../shared/cabinet/jeux/pari'

// L'Éclat tombe une fois sur quarante à un palier : l'expérience se compte ici au point près (règle `tests.md`).
ProfileStore.tirageEclat = () => false

let b: BancDuCabinet
before(async () => {
  b = await bancDuCabinet()
})
after(() => b?.banc.close())

interface Ligne {
  position: number
  reserve_id: string
  choix: number | null
  juste: number
  forme: string | null
  joker: string | null
}
const lignesDe = (serie: string) =>
  enBase(b.fichier, db => db.prepare('SELECT position, reserve_id, choix, juste, forme, joker FROM campagne_reponses WHERE serie_id = ? ORDER BY position').all(serie) as Ligne[])
const idDe = async (cookie: string) => (await lire(b, cookie, '/api/joueur/moi?leger')).corps.profile.id as string
const xpDeCampagne = (id: string) =>
  enBase(b.fichier, db => (db.prepare("SELECT xp FROM profile_xp WHERE profile_id = ? AND soiree_id = '#campagne'").get(id) as { xp: number } | undefined)?.xp ?? 0)

test('le Pari : une ligne par question jouée — la première nue, celle du pari à la forme de son jeu —, juste à sa bonne réponse', async () => {
  const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
  let v = ok(await commencer(b, lea, { origine: 'libre', jeu: 'pari', carte: null }), 'commencer')
  const plan = [0, 1, 2].map(k => pariDe(b, v.id, k))
  v = await jouerUnPari(b, lea, v, 0, 'parier-juste')
  v = await ouvrir(b, lea, v, 1)
  v = await jouerUnPari(b, lea, v, 1, 'garder')
  v = await ouvrir(b, lea, v, 2)
  v = await jouerUnPari(b, lea, v, 2, 'rater')
  assert.equal(v.phase, 'finie')
  assert.deepEqual(lignesDe(v.id), [
    { position: 0, reserve_id: plan[0].q1.id, choix: plan[0].q1.bonne, juste: 1, forme: null, joker: null },
    { position: 1, reserve_id: plan[0].q2.id, choix: plan[0].q2.bonne, juste: 1, forme: 'pari', joker: null },
    { position: 2, reserve_id: plan[1].q1.id, choix: plan[1].q1.bonne, juste: 1, forme: null, joker: null },
    { position: 3, reserve_id: plan[2].q1.id, choix: (plan[2].q1.bonne + 1) % 4, juste: 0, forme: null, joker: null },
  ])
  // Les pièces au bout de la partie, une par ligne, à sa position : le journal y relit la catégorie et la marche.
  const questions = enBase(b.fichier, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(v.id) as { questions: string }).questions)) as { id: string; cabinet: { manche: number } }[]
  assert.deepEqual(
    questions.map(q => [q.id, q.cabinet.manche]),
    [
      [plan[0].q1.id, 0],
      [plan[0].q2.id, 0],
      [plan[1].q1.id, 1],
      [plan[2].q1.id, 2],
    ],
  )
})

test('l’Éclair : une ligne par manche, hors de la base (`cab:`), à la forme de son jeu, juste dès deux étoiles', async () => {
  const tom = await inscrireProfil(b.banc.url, 'tom', 'Tom')
  let v = ok(await commencer(b, tom, { origine: 'libre', jeu: 'eclair', carte: null }), 'commencer')
  v = await jouerUnEclair(b, tom, v, 0, true)
  v = await ouvrir(b, tom, v, 1)
  v = await jouerUnEclair(b, tom, v, 1, false)
  v = ok(await jouer(b, tom, v, { quoi: 'quitter' }), 'quitter')
  const lignes = lignesDe(v.id)
  assert.equal(lignes.length, 2, 'la troisième, jamais ouverte, ne laisse pas de pièce')
  assert.ok(lignes.every(l => l.reserve_id.startsWith(`${PREFIXE_DU_CABINET}eclair:`) && l.forme === 'eclair' && l.joker === null))
  assert.deepEqual(
    lignes.map(l => l.juste),
    [1, 0],
  )
  // Le composé se déplie en ses cinq questions de la base.
  const t = departEnBase(b.fichier, v.id).tirages[0] as EclairTire
  assert.equal(lignes[0].reserve_id, `${PREFIXE_DU_CABINET}eclair:${t.affirmations.map(a => a.question.id).join('+')}`)
})

test('Éclairer marque la ligne de son pouvoir, jamais de la carte-bonus ; la pièce aidée prend la forme de son jeu', async () => {
  const ines = await inscrireProfil(b.banc.url, 'ines', 'Inès')
  let v = ok(await commencer(b, ines, { origine: 'libre', jeu: 'pari', carte: 'coup-d-oeil' }), 'commencer')
  v = ok(await jouer(b, ines, v, { quoi: 'eclairer', manche: 0 }), 'éclairer')
  v = await jouerUnPari(b, ines, v, 0, 'garder')
  const [ligne] = lignesDe(v.id)
  assert.equal(ligne.joker, JOKER_D_ECLAIRER)
  assert.equal(ligne.forme, 'pari', 'aidée, la première question n’est plus nue : la mesure ne la lit pas')
})

test('l’expérience d’une partie se crédite une fois, à sa fin ; ses confettis, à chaque bonne réponse écrite', async () => {
  const max = await inscrireProfil(b.banc.url, 'max', 'Max')
  const id = await idDe(max)
  const solde = async () => (await lire(b, max, '/api/joueur/moi')).corps.profile.boutique.confettis.gagnes as number
  const avant = await solde()
  let v = ok(await commencer(b, max, { origine: 'libre', jeu: 'pari', carte: null }), 'commencer')
  v = await jouerUnPari(b, max, v, 0, 'parier-juste')
  assert.equal(xpDeCampagne(id), 0, 'rien de crédité avant la fin')
  assert.equal((await solde()) - avant, 2, 'un confetti par bonne réponse, dès qu’elle s’écrit')
  v = await ouvrir(b, max, v, 1)
  v = await jouerUnPari(b, max, v, 1, 'parier-juste')
  v = await ouvrir(b, max, v, 2)
  v = await jouerUnPari(b, max, v, 2, 'parier-juste')
  assert.equal(v.phase, 'finie')
  const attendue = 6 * XP_PAR_JUSTE * 2
  assert.ok(6 <= JUSTES_DOUBLEES_PAR_JOUR, 'six parmi les vingt premières du jour, au double')
  assert.equal(xpDeCampagne(id), attendue)
  assert.equal(v.bilan?.gains?.xp, attendue, 'la fin le dit')
  assert.equal(v.bilan?.gains?.confettis, 6)
  assert.equal((await solde()) - avant, 6)
  // Une seconde partie ne recrédite pas la première : la ligne se réécrit entière.
  const seconde = ok(await commencer(b, max, { origine: 'libre', jeu: 'eclair', carte: null }), 'la seconde')
  ok(await jouer(b, max, seconde, { quoi: 'quitter' }), 'quitter')
  assert.equal(xpDeCampagne(id), attendue)
})

test('le carnet reçoit la question de la base ratée au Pari, jamais une pièce `cab:` — et le relit après un redémarrage', async () => {
  const noe = await inscrireProfil(b.banc.url, 'noe', 'Noé')
  let pari = ok(await commencer(b, noe, { origine: 'libre', jeu: 'pari', carte: null }), 'le Pari')
  pari = await jouerUnPari(b, noe, pari, 0, 'rater')
  ok(await jouer(b, noe, pari, { quoi: 'quitter' }), 'quitter le Pari')
  let eclair = ok(await commencer(b, noe, { origine: 'libre', jeu: 'eclair', carte: null }), 'l’Éclair')
  eclair = await jouerUnEclair(b, noe, eclair, 0, false)
  ok(await jouer(b, noe, eclair, { quoi: 'quitter' }), 'quitter l’Éclair')
  const carnet = async () => (await lire(b, noe, '/api/campagne/carnet')).corps as { aRevoir: number; demain: number; plusTard: number }
  assert.deepEqual(await carnet().then(c => [c.aRevoir, c.demain, c.plusTard]), [0, 1, 0])
  await b.banc.redemarrer()
  assert.deepEqual(await carnet().then(c => [c.aRevoir, c.demain, c.plusTard]), [0, 1, 0], 'relu de la base au réveil')
})

test('le Mot mystère et le Filet écrivent la question de la base, à la forme de leur jeu : une erreur entre au carnet, et se signale', async () => {
  const rose = await inscrireProfil(b.banc.url, 'rose', 'Rose')
  // Le Mot trouvé du premier coup, puis jamais ; le Filet dans le moyen filet, puis à côté.
  let mot = ok(await commencer(b, rose, { origine: 'libre', jeu: 'mot', carte: null }), 'le Mot')
  mot = await jouerUnMot(b, rose, mot, 0, 1)
  mot = await ouvrir(b, rose, mot, 1)
  mot = await jouerUnMot(b, rose, mot, 1, null)
  ok(await jouer(b, rose, mot, { quoi: 'quitter' }), 'quitter le Mot')
  let filet = ok(await commencer(b, rose, { origine: 'libre', jeu: 'filet', carte: null }), 'le Filet')
  filet = await jouerUnFilet(b, rose, filet, 0, 'moyen')
  filet = await ouvrir(b, rose, filet, 1)
  filet = await jouerUnFilet(b, rose, filet, 1, 'petit', false)
  ok(await jouer(b, rose, filet, { quoi: 'quitter' }), 'quitter le Filet')
  const [m0, m1] = [0, 1].map(k => motDe(b, mot.id, k))
  const [f0, f1] = [0, 1].map(k => filetDe(b, filet.id, k))
  assert.deepEqual(lignesDe(mot.id), [
    { position: 0, reserve_id: m0.question.id, choix: 0, juste: 1, forme: 'mot', joker: null },
    { position: 1, reserve_id: m1.question.id, choix: -1, juste: 0, forme: 'mot', joker: null },
  ])
  assert.deepEqual(lignesDe(filet.id), [
    { position: 0, reserve_id: f0.question.id, choix: 0, juste: 1, forme: 'filet', joker: null },
    { position: 1, reserve_id: f1.question.id, choix: -1, juste: 0, forme: 'filet', joker: null },
  ])
  // Les deux erreurs, des questions de la base : au carnet, relues par le journal en mémoire puis par la base au réveil.
  const carnet = async () => (await lire(b, rose, '/api/campagne/carnet')).corps as { aRevoir: number; demain: number; plusTard: number }
  assert.deepEqual(await carnet().then(c => [c.aRevoir, c.demain, c.plusTard]), [0, 2, 0])
  // « Signaler une erreur » passe par la route de la série, à la position de la pièce : la question de la base qu'elle a posée.
  for (const [serie, texte] of [
    [mot.id, 'Le mot me semble faux.'],
    [filet.id, 'La valeur me semble fausse.'],
  ]) {
    const signale = await poster(b, rose, `/api/campagne/serie/${serie}/signalement`, { index: 1, texte })
    assert.deepEqual([signale.status, signale.corps], [200, { ok: true }], serie)
  }
  const signalees = enBase(b.fichier, db =>
    db.prepare('SELECT question_id, serie_id FROM campagne_signalements WHERE serie_id IN (?, ?) ORDER BY question_id').all(mot.id, filet.id),
  )
  assert.deepEqual(
    signalees,
    [
      { question_id: m1.question.id, serie_id: mot.id },
      { question_id: f1.question.id, serie_id: filet.id },
    ].sort((x, y) => x.question_id.localeCompare(y.question_id)),
  )
  await b.banc.redemarrer()
  assert.deepEqual(await carnet().then(c => [c.aRevoir, c.demain, c.plusTard]), [0, 2, 0], 'relu de la base au réveil')
})

test('rien ne revient avant sept jours, d’un jeu à l’autre : l’Éclair ne repose pas ce que le Pari vient de poser', async () => {
  const eva = await inscrireProfil(b.banc.url, 'eva', 'Éva')
  const pari = ok(await commencer(b, eva, { origine: 'libre', jeu: 'pari', carte: null }), 'le Pari')
  const fin = await unPariParfait(b, eva, pari)
  assert.equal(fin.phase, 'finie')
  const posees = new Set((departEnBase(b.fichier, pari.id).tirages as PariTire[]).flatMap(t => [t.q1.id, t.q2.id]))
  const eclair = ok(await commencer(b, eva, { origine: 'libre', jeu: 'eclair', carte: null }), 'l’Éclair')
  const tirees = (departEnBase(b.fichier, eclair.id).tirages as EclairTire[]).flatMap(t => t.affirmations.map(a => a.question.id))
  assert.deepEqual(
    tirees.filter(id => posees.has(id)),
    [],
  )
  ok(await jouer(b, eva, eclair, { quoi: 'quitter' }), 'quitter')
  assert.equal(ok(await laPage(b, eva), 'la page').enCours, null)
})

test('le magasin déplie les composés avant de tirer : les questions d’un Éclair ne reviennent pas au Pari de la semaine', async () => {
  // Une catégorie, dix-huit faciles ou moyennes, quatre difficiles : le hasard n'a plus de place. Le Pari d'hier en voit
  // trois ; l'Éclair d'aujourd'hui prend les quinze autres, jamais vues, sous trois pièces composées
  // (`cab:eclair:a+…+e`) ; le Pari qui suit ne peut plus reprendre que celles d'hier, vues avant — à condition que le
  // magasin déplie les composés. Sans le dépliage, les quinze de l'Éclair passaient pour jamais vues, et revenaient les
  // premières : l'épreuve d'au-dessus, dans l'autre sens et sur une base large, ne le voyait qu'une fois sur quelques-unes.
  const [categorie] = CATEGORIES
  const base = new BaseDeLaCampagne([
    ...Array.from({ length: 18 }, (_, i) => questionDuCabinet(i, categorie, i % 2 === 0 ? 2 : 3)),
    ...Array.from({ length: 4 }, (_, i) => questionDuCabinet(100 + i, categorie, 4)),
  ])
  const c = await bancDuCabinet({ baseDeLaCampagne: base })
  try {
    const ana = await inscrireProfil(c.banc.url, 'ana', 'Ana')
    const premieres = (serie: string) => (departEnBase(c.fichier, serie).tirages as PariTire[]).map(t => t.q1.id)
    let hier = ok(await commencer(c, ana, { origine: 'libre', jeu: 'pari', carte: null }), 'le Pari d’hier')
    const vuesHier = new Set(premieres(hier.id))
    for (let k = 0; k < 3; k++) {
      if (k > 0) hier = await ouvrir(c, ana, hier, k)
      hier = await jouerUnPari(c, ana, hier, k, 'garder')
    }
    assert.equal(hier.phase, 'finie')

    c.horloge.t += 24 * 3_600_000
    let eclair = ok(await commencer(c, ana, { origine: 'libre', jeu: 'eclair', carte: null }), 'l’Éclair')
    const vuesALEclair = new Set((departEnBase(c.fichier, eclair.id).tirages as EclairTire[]).flatMap(t => t.affirmations.map(a => a.question.id)))
    assert.equal(vuesALEclair.size, 15)
    assert.deepEqual([...vuesALEclair].filter(id => vuesHier.has(id)), [], 'l’Éclair passe celles d’hier après les jamais vues')
    for (let k = 0; k < 3; k++) {
      if (k > 0) eclair = await ouvrir(c, ana, eclair, k)
      eclair = await jouerUnEclair(c, ana, eclair, k)
    }
    assert.equal(eclair.phase, 'finie')

    const pari = ok(await commencer(c, ana, { origine: 'libre', jeu: 'pari', carte: null }), 'le Pari d’aujourd’hui')
    const reprises = premieres(pari.id)
    assert.deepEqual(
      reprises.filter(id => vuesALEclair.has(id)),
      [],
      'une question de l’Éclair, vue tout à l’heure dans un composé, reposée devant une vue hier',
    )
    assert.deepEqual(new Set(reprises), vuesHier, 'toutes vues : la moins récemment vue revient d’abord')
  } finally {
    await c.banc.close()
  }
})

test('le magasin tire sous l’enjeu de la partie : une chasse à une épique tire le difficile à l’Éclair', async () => {
  // Le tireur lit l'enjeu du contexte (`cabinet-jeux-base.test.ts`) ; c'est le magasin qui le lui donne, de l'œuvre que
  // vise le départ (`enjeuDuTirage`). Donné ordinaire, la marche des épiques disparaissait du jeu sans qu'une épreuve
  // rougisse (la relecture du 26 octobre 2026). Toutes les faciles et les moyennes vues ces jours-ci : à l'étape qui
  // les lit avec la difficile, la fraîcheur ne prend que la difficile, jamais vue — et sans l'enjeu, une vue.
  const c = await bancDuCabinet()
  try {
    const ugo = await inscrireProfil(c.banc.url, 'ugo', 'Ugo')
    const id = (await lire(c, ugo, '/api/joueur/moi?leger')).corps.profile.id as string
    const vues = baseDuCabinet().questions.filter(q => q.meta.difficulte <= 3)
    piecesALaMain(c.fichier, id, vues.map(q => ({ id: q.id, mode: 'cabinet', le: DIX_HEURES - 3_600_000 })))
    await c.banc.redemarrer()
    assert.equal(JEU_DE_L_OEUVRE.baroud, 'eclair')
    assert.equal(oeuvre('baroud')?.rarete, 'epique')
    const chasse = ok(await commencer(c, ugo, { origine: 'chasse', oeuvre: 'baroud', carte: null }), 'la chasse')
    const niveaux = (departEnBase(c.fichier, chasse.id).tirages as EclairTire[]).flatMap(t => t.affirmations.map(a => a.question.niveau))
    assert.equal(niveaux.length, 15)
    assert.deepEqual(new Set(niveaux), new Set(['difficile']), 'la marche que l’épique ajoute')
  } finally {
    await c.banc.close()
  }
})

test('le magasin donne à l’Éclair les leurres que la campagne choisit : chaque affirmation fausse propose la mauvaise réponse la plus choisie', async () => {
  // Le tireur les lit du contexte (`cabinet-jeux-base.test.ts`), le journal les compte (`journal-des-reponses.test.ts`) ;
  // c'est le magasin qui les lui passe (`leurresChoisis`). Chaque question de la base — l'Éclair récrit aussi les mots et
  // les valeurs qui ont quatre réponses courtes — ratée une fois en série, toujours sur la même mauvaise réponse — en
  // texte, telle que la série l'a posée —, et réussie une fois.
  const c = await bancDuCabinet()
  try {
    const ana = await inscrireProfil(c.banc.url, 'ana', 'Ana')
    const id = (await lire(c, ana, '/api/joueur/moi?leger')).corps.profile.id as string
    const qcm = baseDuCabinet().questions
    const leurreDe = new Map(qcm.map(q => [q.id, q.reponses.filter((_, k) => k !== q.bonne).at(-1)!]))
    const pieces = qcm.flatMap(q => [{ id: q.id, reponses: q.reponses }, { id: q.id, reponses: q.reponses }])
    const le = DIX_HEURES - 3_600_000
    aLaMain(
      c.fichier,
      [
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le)
         VALUES ('les-leurres', '${id}', '${JSON.stringify(pieces).replace(/'/g, "''")}', ${pieces.length}, 0, ${qcm.length}, ${le}, ${le});`,
        ...qcm.map(
          (q, k) =>
            `INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES
             ('les-leurres', ${2 * k}, '${q.id}', ${q.reponses.indexOf(leurreDe.get(q.id)!)}, 0, ${le}), ('les-leurres', ${2 * k + 1}, '${q.id}', ${q.bonne}, 1, ${le});`,
        ),
      ].join('\n'),
    )
    await c.banc.redemarrer()
    const zia = await inscrireProfil(c.banc.url, 'zia', 'Zia')
    const eclair = ok(await commencer(c, zia, { origine: 'libre', jeu: 'eclair', carte: null }), 'l’Éclair')
    const fausses = (departEnBase(c.fichier, eclair.id).tirages as EclairTire[]).flatMap(t => t.affirmations.filter(a => a.proposee !== a.question.bonne))
    assert.ok(fausses.length > 0, 'une affirmation fausse au moins, une fois sur deux chacune')
    for (const a of fausses) assert.equal(a.question.reponses[a.proposee], leurreDe.get(a.question.id), a.question.id)
  } finally {
    await c.banc.close()
  }
})

test('le Cabinet ne modifie ni n’efface jamais une réponse : les tranches du journal s’effaceraient toutes', () => {
  const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src')
  const fichiers = ['cabinet.ts', ...readdirSync(path.join(racine, 'core/cabinet'), { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.ts')).map(f => `core/cabinet/${f}`)]
  for (const f of fichiers) {
    assert.doesNotMatch(readFileSync(path.join(racine, f), 'utf8'), /(UPDATE\s+campagne_reponses|DELETE\s+FROM\s+campagne_reponses)\b/i, f)
  }
})
