// Les inventaires des sous-thèmes (`core/inventaires.ts`) : la danse et les
// métiers de la santé, que le propriétaire voulait couvrir en entier le
// 15 octobre 2026 — « toutes les danses, et tous les métiers de la médecine
// et du paramédical, qu'il faudra regrouper ». Un sous-thème seul laissait le
// rédacteur aux faits qu'il connaît le mieux : vingt tangos, pas une kizomba.
// Ce qui doit tenir : chaque inventaire vit dans un sous-thème qui existe, et
// d'un thème ; la consigne le donne à qui écrit pour lui, la routine du matin
// comprise ; une commande en nombre le suit famille par famille, et deux
// familles d'un sous-thème s'écrivent en même temps, jamais deux morceaux
// d'une même famille ; la couverture dit ce qui reste à zéro, et ce qui
// reste à zéro se commande, un sujet par question.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { INVENTAIRES, couverture, inventaireDe, inventairesDuTheme, lireLeSujet, repartirLesFamilles, type QuestionCouverte } from '../src/core/inventaires'
import { consigneDEcriture } from '../src/core/consigneCampagne'
import { lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { SUJETS, sujetParCle } from '../../shared/sujets'
import type { Categorie } from '../../shared/categories'
import { QUESTIONS_PAR_LOT, commandeDeLInventaire, commandeDesManques, planDeLaGeneration, preparer, type Contexte } from '../scripts/generer-campagne'

const danse = sujetParCle('danse')!
const sante = sujetParCle('sante')!

test('chaque inventaire vit dans un sous-thème de sa catégorie, et d’un thème', () => {
  const vus = new Set<string>()
  for (const i of INVENTAIRES) {
    const ou = `${i.categorie} › ${i.sousTheme}`
    assert.ok(SOUS_THEMES[i.categorie]?.some(s => s.cle === i.sousTheme), `${ou} : un sous-thème de sa catégorie`)
    assert.ok(!vus.has(ou), `${ou} : un seul inventaire`)
    vus.add(ou)
    assert.ok(
      SUJETS.some(s => s.famille === 'theme' && s.sousThemes?.[i.categorie]?.includes(i.sousTheme)),
      `${ou} : un thème le lit — sinon sa commande n'aurait pas de thème`,
    )
    assert.ok(i.perimetre.length > 0 && i.familles.length > 0, ou)
    assert.equal(new Set(i.familles.map(f => f.nom)).size, i.familles.length, `${ou} : deux familles du même nom`)
    const sujets = i.familles.flatMap(f => f.sujets.map(s => lireLeSujet(s).nom))
    assert.equal(new Set(sujets).size, sujets.length, `${ou} : un sujet dans deux familles`)
    for (const f of i.familles) {
      assert.ok(f.poids > 0 && f.sujets.length > 0, `${ou} › ${f.nom}`)
      for (const s of f.sujets) assert.ok(lireLeSujet(s).racines.length > 0, `${ou} › ${s} : de quoi le retrouver`)
    }
  }
  // La danse et la santé, chacune ses sous-thèmes neufs.
  assert.deepEqual(
    inventairesDuTheme(danse).map(i => `${i.categorie} › ${i.sousTheme}`),
    ['Musique › danses', 'Arts & lettres › ballet', 'Autour de la fête › bal'],
  )
  assert.deepEqual(
    inventairesDuTheme(sante).map(i => `${i.categorie} › ${i.sousTheme}`),
    ['Culture générale › sante', 'Sciences › medecine'],
    'le corps humain est du thème, sans inventaire : il ne se commande pas',
  )
})

test('la salsa et ce qui l’entoure : le son, le danzón, la rumba, l’afro et chacun des orishas', () => {
  const musique = inventaireDe('Musique', 'danses')!
  const noms = (famille: string) => musique.familles.find(f => f.nom === famille)!.sujets.map(s => lireLeSujet(s).nom).join(' · ')
  for (const attendu of ['salsa cubaine', 'son cubain', 'danzón', 'cha-cha-chá', 'timba']) assert.ok(noms('Salsa et danses cubaines').includes(attendu), attendu)
  for (const attendu of ['rumba cubaine', 'afro-cubain', 'Elegguá', 'Ogún', 'Changó', 'Yemayá', 'Ochún', 'Oyá', 'Babalú Ayé', 'Obatalá', 'batá']) {
    assert.ok(noms('Rumba et danses afro-cubaines').includes(attendu), attendu)
  }
})

test('six cents questions réparties à proportion des poids, au plus fort reste : le compte tombe juste', () => {
  for (const theme of [danse, sante]) {
    const inventaires = inventairesDuTheme(theme)
    const poids = inventaires.flatMap(i => i.familles).reduce((s, f) => s + f.poids, 0)
    const parts = repartirLesFamilles(inventaires, 600)
    assert.equal(parts.reduce((s, p) => s + p.n, 0), 600, theme.cle)
    for (const p of parts) assert.ok(Math.abs(p.n - (600 * p.famille.poids) / poids) < 1, `${p.famille.nom} : ${p.n}`)
  }
  assert.ok(repartirLesFamilles(inventairesDuTheme(danse), 0).every(p => p.n === 0))
})

/** Une question de l'inventaire, réduite à ce que la couverture lit. */
const q = (texte: string, bonne: string, leurres: string[] = ['Autre', 'Encore', 'Ailleurs'], entites: string[] = []): QuestionCouverte => ({
  texte,
  reponses: [bonne, ...leurres],
  bonne: 0,
  meta: { entites: entites.map(nom => ({ nom, type: 'notion' as const, description: '' })) },
})

test('la couverture : une racine au début d’un mot, un sigle en mot entier, jamais un leurre', () => {
  const sante = inventaireDe('Culture générale', 'sante')!
  const compte = (questions: QuestionCouverte[], famille: string, sujet: string) =>
    couverture(sante, questions)
      .find(f => f.famille === famille)!
      .sujets.find(s => s.nom.startsWith(sujet))!.questions
  const questions = [
    q('Quel professionnel rééduque la marche après une entorse ?', 'Le masseur-kinésithérapeute'),
    q('Comment appelle-t-on familièrement le kiné ?', 'Un masso', undefined, ['Kiné']),
    q('Quel médecin soigne les oreilles, le nez et la gorge ?', "L'ORL"),
    q('Dans quelle ville est née Jeanne d’Arc, la Pucelle d’Orléans ?', 'Domrémy'),
    q('Quel professionnel corrige la vision binoculaire ?', "L'orthoptiste", ["L'orthophoniste", "L'ergothérapeute", 'Le podologue']),
  ]
  assert.equal(compte(questions, 'Rééducation et réadaptation', 'masseur-kinésithérapeute'), 2, 'la racine au début du mot, et une entité')
  assert.equal(compte(questions, 'Médecins et spécialités', 'ORL'), 1, '« orl » en mot entier : Orléans ne compte pas')
  assert.equal(compte(questions, 'Rééducation et réadaptation', 'orthoptiste'), 1)
  assert.equal(compte(questions, 'Rééducation et réadaptation', 'orthophoniste'), 0, 'un leurre ne couvre rien')
})

test('la consigne donne l’inventaire : les familles visées, ou toutes pour la routine du matin', () => {
  const lot = consigneDEcriture('Musique', [{ cle: 'danses', n: 25, famille: 'Rumba et danses afro-cubaines' }], { sorte: 'fichier', fichier: '/tmp/lots/d1-01.json' })
  assert.match(lot, /^- danses \(Danses de couple, de rue et du monde\) › Rumba et danses afro-cubaines : 25 questions$/m)
  assert.match(lot, /^L'INVENTAIRE DE TA PART/m)
  assert.match(lot, /^- Rumba et danses afro-cubaines : .*Yemayá/m)
  assert.doesNotMatch(lot, /^- Salsa et danses cubaines :/m, 'les familles d’un autre lot restent à leur lot')
  assert.match(lot, /^Prudence : Les orishas/m)
  assert.match(lot, /dose chaque famille selon ce qu'elle a de connu/)

  // La routine du matin vise le sous-thème : tout l'inventaire, chaque ligne à sa difficulté.
  const routine = consigneDEcriture('Arts & lettres', [{ cle: 'ballet', n: 3, difficulte: 4 }], { sorte: 'routine' })
  assert.match(routine, /^- ballet \(Ballet et danse de scène\) : 3 questions de difficulté 4$/m)
  for (const f of inventaireDe('Arts & lettres', 'ballet')!.familles) assert.match(routine, new RegExp(`^- ${f.nom} : `, 'm'), f.nom)

  // Les sujets qui manquent se nomment sur la ligne ; un sous-thème sans inventaire n'en parle pas.
  const manques = consigneDEcriture('Autour de la fête', [{ cle: 'bal', n: 2, famille: 'Danses de groupe et en ligne', sujets: ['la conga', 'le limbo'] }], { sorte: 'routine' })
  assert.match(manques, /› Danses de groupe et en ligne : 2 questions, une sur chacun de ces sujets : la conga, le limbo$/m)
  assert.doesNotMatch(consigneDEcriture('Sport', [{ cle: 'rugby', n: 5 }], { sorte: 'routine' }), /INVENTAIRE/)
})

test('la commande par familles : chaque famille à part, deux familles d’un sous-thème dans la même vague, jamais deux morceaux d’une famille', () => {
  const commande = commandeDeLInventaire(danse, 600)
  const lignes = [...commande.values()].flat()
  assert.equal(lignes.reduce((s, l) => s + l.n, 0), 600)
  assert.ok(lignes.every(l => l.famille && l.difficulte === undefined), 'une famille par ligne, la difficulté dosée par la part')
  assert.deepEqual([...commande.keys()].sort(), ['Arts & lettres', 'Autour de la fête', 'Musique'])

  const vagues = planDeLaGeneration([], { nom: 'd1', questions: 0, commandes: commande })
  const lots = vagues.flatMap(v => v.lots)
  assert.equal(lots.reduce((s, l) => s + l.quotas.reduce((t, x) => t + x.n, 0), 0), 600)
  for (const l of lots) assert.ok(l.quotas.reduce((t, x) => t + x.n, 0) <= QUESTIONS_PAR_LOT, l.id)
  for (const [i, v] of vagues.entries()) {
    const vues = new Set<string>()
    for (const l of v.lots) {
      for (const x of l.quotas) {
        const cle = `${l.categorie}/${x.cle}/${x.famille}`
        assert.ok(!vues.has(cle), `vague ${i + 1} : ${cle} dans deux lots`)
        vues.add(cle)
      }
    }
  }
  const premiere = vagues[0].lots.filter(l => l.categorie === 'Musique')
  assert.ok(premiere.length >= 5, 'les familles de la musique s’écrivent ensemble, au lieu d’une vague chacune')
  assert.ok(vagues.length <= 3, `${vagues.length} vagues : une famille de cinquante questions en fait deux`)
  assert.throws(() => commandeDeLInventaire(sujetParCle('animaux')!, 100), /n'a pas d'inventaire/)
})

/** Une question de la base, du sous-thème qu'on veut, sur le sujet qu'on veut. */
function questionDuTheme(i: number, categorie: Categorie, sousTheme: string, texte: string, bonne: string): QuestionDeLaBase {
  const leurres = [`Leurre ${i} a`, `Leurre ${i} b`, `Leurre ${i} c`]
  const lu = lireQuestionDeLaBase({
    id: `inv${String(i).padStart(5, '0')}`,
    texte,
    reponses: [bonne, ...leurres],
    bonne: 0,
    anecdote: null,
    categorie,
    sousTheme,
    etiquettes: [],
    difficulte: 3,
    ageMin: 10,
    date: null,
    entites: [],
    portee: 'monde',
    valeur: null,
    leurres: [...leurres, `Leurre ${i} d`, `Leurre ${i} e`, `Leurre ${i} f`],
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(lu.refus)
  return lu.question
}

test('ce qui manque : un sujet sans question, une question, nommé dans sa famille', () => {
  const tout = commandeDesManques(danse, [])
  const sujets = inventairesDuTheme(danse).flatMap(i => i.familles.flatMap(f => f.sujets))
  assert.equal([...tout.values()].flat().reduce((s, l) => s + l.n, 0), sujets.length, 'une base vide : chaque sujet')

  const base = [
    questionDuTheme(1, 'Musique', 'danses', 'De quel pays la kizomba est-elle originaire ?', 'Angola'),
    questionDuTheme(2, 'Autour de la fête', 'bal', 'Sous quoi passe-t-on, à reculons, en dansant le limbo ?', 'Une barre'),
    // Hors du thème, elle ne compte pas : une question de sport sur la conga n'aurait pas son étiquette.
    questionDuTheme(3, 'Sport', 'rugby', 'Quel club de rugby a pour hymne une conga ?', 'Le Stade toulousain'),
  ]
  const commande = commandeDesManques(danse, base)
  const groupe = commande.get('Autour de la fête')!.find(l => l.famille === 'Danses de groupe et en ligne')!
  assert.equal(groupe.n, groupe.sujets!.length)
  assert.ok(!groupe.sujets!.includes('le limbo'), 'le limbo a déjà sa question')
  assert.ok(groupe.sujets!.includes('la conga'), 'la question de rugby ne compte pas pour le thème')
  assert.ok(!commande.get('Musique')!.some(l => l.sujets?.includes('kizomba')))

  // Le plan garde ses sujets, lot par lot : chacun le sien, une fois.
  const plan = planDeLaGeneration([], { nom: 'm1', questions: 0, commandes: commande, parLot: 10 }).flatMap(v => v.lots)
  const repartis = plan.flatMap(l => l.quotas.flatMap(x => x.sujets ?? []))
  const attendus = [...commande.values()].flat().flatMap(l => l.sujets ?? [])
  assert.deepEqual([...repartis].sort(), [...attendus].sort())
  for (const l of plan) for (const x of l.quotas) assert.equal(x.n, x.sujets!.length, `${l.id} : une question par sujet`)
})

test('préparer par l’inventaire : --questions ou --manques, jamais avec --theme', () => {
  const contexte = (): Contexte => ({ dossier: mkdtempSync(path.join(tmpdir(), 'inventaire-')), base: [], livres: new Set(), dire: () => {} })
  const ctx = contexte()
  try {
    assert.equal(preparer(ctx, { inventaire: 'sante', questions: 600, nom: 's1' }).generation.demandees, 600)
    assert.throws(() => preparer(contexte(), { inventaire: 'danse', theme: 'danse', questions: 10 }), /un seul à la fois|ne se mêle/)
    assert.throws(() => preparer(contexte(), { inventaire: 'danse' }), /--questions=<nombre>, ou avec --manques/)
    assert.throws(() => preparer(contexte(), { inventaire: 'danse', questions: 10, manques: true }), /l’un ou l’autre/)
    assert.throws(() => preparer(contexte(), { manques: true, questions: 10 }), /--manques ne va qu’avec --inventaire/)
    assert.throws(() => preparer(contexte(), { inventaire: 'animaux', questions: 10 }), /un thème qui a un inventaire \(danse, sante\)/)
    const manques = preparer(contexte(), { inventaire: 'danse', manques: true, nom: 'm1' })
    assert.equal(manques.generation.demandees, inventairesDuTheme(danse).flatMap(i => i.familles.flatMap(f => f.sujets)).length)
  } finally {
    rmSync(ctx.dossier, { recursive: true, force: true })
  }
})
