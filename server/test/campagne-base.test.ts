// La base de la campagne (`server/content/campagne/`), telle que le dépôt la
// livre : des questions écrites et étiquetées d'avance, rien qu'à la
// campagne. Une entrée défectueuse n'y entre pas en silence — le serveur
// l'écarterait à sa lecture —, et la base ne recule jamais.
//
// Elle a grandi lot par lot (`scripts/base-campagne.ts`) : le plancher
// `AU_MOINS` monte avec elle, et chaque catégorie, chaque sous-thème et
// chaque marche ont leur minimum — une catégorie qu'un fichier écrasé
// viderait, ou une marche qu'un lot trop facile laisserait à sec, se verrait
// ici avant de se jouer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { DOSSIER_DE_LA_BASE, QUESTIONS_PAR_TRANCHE, fichierDeCategorie, lireLaBase, lireLaBaseSansBloquer, lireQuestionDeLaBase } from '../src/core/baseCampagne'
import { empreinteDe } from '../src/core/jour'
import { SERVEUR } from '../src/racine'
import { CATEGORIES } from '../../shared/categories'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { NIVEAUX, QUESTIONS_PAR_SERIE, niveauDeQuestion, type Niveau } from '../../shared/campagne'
import { sansAccent } from '../../shared/homonymes'

/**
 * Ce que la base a déjà : elle ne descend jamais sous ce nombre (un fichier
 * écrasé, un rangement raté). Un retrait voulu le baisse dans le même commit,
 * et dit pourquoi : le 10 octobre 2026, trente-huit questions qui posaient le
 * même fait qu'une autre (`voisines`, `retirer`) — 5 012 questions, 4 974
 * faits —, puis deux retournées (Lacoste et son crocodile, Chichén Itzá).
 * Le même jour, la première génération en nombre en a rangé 306 : 5 278 ;
 * puis le pilote tiré de Wikidata (`faits-wikidata.ts`), 296 : 5 574. Le
 * 11 octobre 2026, ses deux vagues suivantes, 258 puis 779 : 6 611 ; puis ce
 * qui manquait aux chapitres des sentiers (`preparer --sentiers`), 723 : 7 334 ;
 * puis mille de plus aux huit catégories les moins fournies, 973, et douze
 * difficiles au thème des mythes et légendes (`preparer --theme`) : 8 319 ;
 * puis mille à la musique, au sport, aux jeux et à la fête, 968, et sept de
 * sport sauvées d'un lot dont l'indice de la bonne réponse était décalé : 9 294 ;
 * puis mille aux six catégories restées sous 700, 986 : 10 280 ; puis cinq
 * cents aux sous-thèmes maigres du cinéma et des arts — répliques, coulisses,
 * sagas, bande dessinée, philosophie… —, 489 : 10 769. Puis, le même jour,
 * des questions à nombre pour les estimations du quiz tout prêt
 * (`consigne --nombres`), 290 : 11 059. Le 13 octobre 2026, la base relue
 * en entier une seconde fois, par Opus et sur le crédit de l'API, en a
 * retiré vingt-deux : neuf doublons d'un fait déjà posé, sept dont un leurre
 * était juste aussi (un caméléon est un lézard, deux ans de mariage font
 * les noces de cuir en France), deux autres noces de la liste américaine,
 * une réponse que l'intitulé soufflait (« le blues grec ») et trois faits
 * périmés ou que les sources ne départagent pas (les seuils de la confiture
 * « extra », le krill de la baleine bleue, le berceau du Rummikub) : 11 037.
 * Puis, le même jour, mille questions à nombre écrites et relues par Opus
 * pour les estimations du quiz tout prêt, là où elles manquaient le plus
 * (neuf de difficulté 1 et 137 de difficulté 2 sur 644 jouables au plus
 * près), 904 : 11 941 — 1 546 jouables au plus près, dont 517 de difficulté 2.
 * Puis le reste du crédit en questions neuves écrites par Opus, par tranches
 * de trois mille, 250 par catégorie là où les sous-thèmes manquaient le plus :
 * la première, 2 873 rangées sur 3 000 demandées (88 refusées comme un fait,
 * un intitulé ou une question que la base avait déjà, 20 retirées à la
 * relecture) : 14 814 ; la deuxième, 2 793 (163 refusées, 151 d'entre elles
 * comme un fait que la base posait déjà — plus elle grandit, plus le
 * rédacteur y retombe —, 22 retirées à la relecture) : 17 607 ; la
 * troisième, 2 753 (194 refusées, dont 180 pour un fait déjà posé, 25
 * retirées à la relecture) : 20 360 ; la dernière, mille sept cents pour
 * finir le crédit à dix dollars près, 1 527 (165 refusées, dont 153 pour un
 * fait déjà posé, 8 retirées à la relecture) : 21 887. Le 15 octobre 2026,
 * deux thèmes neufs, la danse et les métiers de la santé : six cents
 * questions demandées à chacun, famille par famille de leurs inventaires
 * (`preparer --inventaire=danse,sante`), 1 121 rangées (59 refusées comme
 * un fait ou un intitulé que la base ou un autre lot posait déjà, 20
 * retirées à la relecture) : 23 008 ; puis une par sujet qu'aucune
 * n'abordait encore (`--manques`), 48 : 23 056 ; puis vingt de plus par
 * thème pour atteindre les six cents, 40 : 23 096. Puis le bal et le ballet,
 * nés ce jour-là, remis au niveau des autres sous-thèmes de leur catégorie
 * (95 et 216 questions, quand leurs voisins en avaient 236 et 319 : une
 * série tire autant dans chacun), 277 rangées sur 280 : 23 373. Puis les
 * quatre plus petits thèmes de « Sur quoi ? » — les mythes, les premières
 * fois, les surnoms, les années 50 —, deux cents questions de plus pour
 * chacun là où il vit déjà (`preparer --sujet`), 758 rangées sur 800 (32
 * refusées comme un fait ou un intitulé déjà posé, 10 retirées à la
 * relecture) : 24 131. Le 17 octobre 2026, les cinq thèmes neufs —
 * l'informatique, l'astronomie, les jeux vidéo, la BD et le manga, les
 * monuments —, cent questions de plus chacun (`preparer --sujet`), 496
 * rangées sur 500 (2 refusées comme un fait déjà posé, 2 retirées à la
 * relecture) : 24 627.
 */
const AU_MOINS = 24627

const { questions, refusees } = lireLaBase()

test('chaque entrée de la base se relit sans défaut', () => {
  assert.deepEqual(refusees.slice(0, 10), [], `${refusees.length} entrée(s) que le serveur écarterait`)
})

test('la base ne recule jamais', () => {
  assert.ok(questions.length >= AU_MOINS, `${questions.length} questions, ${AU_MOINS} au moins`)
})

test('une série peut monter jusqu’à l’expert', () => {
  const compte: Record<Niveau, number> = { facile: 0, moyen: 0, difficile: 0, expert: 0 }
  for (const q of questions) compte[niveauDeQuestion(q.meta.difficulte)]++
  // Après les quinze premières, une série joue l'expert jusqu'au bout : il en faut au moins une série entière.
  for (const n of NIVEAUX) assert.ok(compte[n] >= QUESTIONS_PAR_SERIE, `${n} : ${compte[n]}`)
})

test('chaque catégorie a de quoi tenir plusieurs séries', () => {
  for (const c of CATEGORIES) {
    const n = questions.filter(q => q.meta.categorie === c).length
    assert.ok(n >= 150, `${c} : ${n} questions, 150 au moins`)
  }
})

test('chaque sous-thème a ses questions : aucun n’est resté vide', () => {
  for (const c of CATEGORIES) {
    for (const st of SOUS_THEMES[c]) {
      const n = questions.filter(q => q.meta.categorie === c && q.meta.sousTheme === st.cle).length
      assert.ok(n >= 15, `${c} › ${st.cle} : ${n} questions, 15 au moins`)
    }
  }
})

test('chaque marche a de quoi composer des séries, en tout et dans chaque catégorie', () => {
  // La marche d'une question se lit comme le serveur la lit à l'écriture, avant toute mesure des réponses.
  const compte = (garde: (q: (typeof questions)[number]) => boolean, n: Niveau) =>
    questions.filter(q => garde(q) && niveauDeQuestion(q.meta.difficulte) === n).length
  for (const n of NIVEAUX) {
    assert.ok(compte(() => true, n) >= 300, `${n} : ${compte(() => true, n)} questions en tout, 300 au moins`)
    for (const c of CATEGORIES) {
      const k = compte(q => q.meta.categorie === c, n)
      assert.ok(k >= 10, `${c} › ${n} : ${k} questions, 10 au moins`)
    }
  }
})

test('les douze fichiers de catégorie sont là', () => {
  const presents = new Set(readdirSync(DOSSIER_DE_LA_BASE).filter(f => f.endsWith('.json')))
  assert.equal(CATEGORIES.length, 12)
  for (const c of CATEGORIES) assert.ok(presents.has(fichierDeCategorie(c)), `${fichierDeCategorie(c)} manque`)
})

test('la base ne reprend aucune question des quiz livrés, dont le quiz du jour s’est amorcé', () => {
  const dossier = path.join(SERVEUR, 'content/quiz')
  const livres = new Set<string>()
  for (const f of readdirSync(dossier).filter(f => f.endsWith('.json'))) {
    for (const q of (JSON.parse(readFileSync(path.join(dossier, f), 'utf8')) as { questions: { text: string }[] }).questions) livres.add(empreinteDe(q.text))
  }
  assert.deepEqual(
    questions.filter(q => livres.has(q.empreinte)).map(q => q.texte),
    [],
  )
})

test('un fichier par catégorie, une question par ligne : une relecture de PR se fait question par question', () => {
  const connus = new Set(CATEGORIES.map(fichierDeCategorie))
  for (const f of readdirSync(DOSSIER_DE_LA_BASE).filter(f => f.endsWith('.json'))) {
    assert.ok(connus.has(f), `${f} n’est le fichier d’aucune catégorie`)
    const lignes = readFileSync(path.join(DOSSIER_DE_LA_BASE, f), 'utf8').trimEnd().split('\n')
    assert.equal(lignes[0], '[', f)
    assert.equal(lignes.at(-1), ']', f)
    for (const l of lignes.slice(1, -1)) assert.match(l, /^\{"id":"[a-z0-9]{8}",.*\},?$/, `${f} : ${l.slice(0, 60)}`)
  }
})

test('le serveur lit la base sans se figer : il rend la main toutes les quelques centaines de questions', async () => {
  // Lue d'un bloc, la base tenait le serveur 0,4 s : aucune soirée ne
  // recevait rien pendant ce temps, ni question ni accusé de réponse.
  let tours = 0
  let lue = false
  const tourner = () => {
    if (lue) return
    tours++
    setImmediate(tourner)
  }
  setImmediate(tourner)
  const base = await lireLaBaseSansBloquer()
  lue = true
  assert.equal(base.questions.length, questions.length, 'la même base que d’une traite')
  assert.ok(tours >= Math.floor(questions.length / QUESTIONS_PAR_TRANCHE), `${tours} tours de boucle pendant la lecture de ${questions.length} questions`)
})

test('la bonne réponse écrite dans l’intitulé se refuse en mot entier, où qu’elle soit', () => {
  // Le juge ne compile plus une expression par question : le verdict, lui, ne bouge pas.
  const brutes: { texte: string; reponses: string[]; bonne: number }[] = JSON.parse(readFileSync(path.join(DOSSIER_DE_LA_BASE, fichierDeCategorie('Histoire')), 'utf8'))
  const entree = brutes.find(e => e.reponses.length === 4 && /^[a-z]{5,}$/.test(sansAccent(e.reponses[e.bonne])))
  assert.ok(entree, 'une entrée dont la bonne réponse est un seul mot')
  const mot = entree.reponses[entree.bonne]
  const verdict = (texte: string) => {
    const lu = lireQuestionDeLaBase({ ...entree, texte })
    return 'refus' in lu ? lu.refus : 'acceptée'
  }
  const ecrite = 'la bonne réponse est écrite dans l’intitulé'
  assert.equal(verdict(`${mot}, est-ce la bonne réponse à cette question ?`), ecrite, 'en tête')
  assert.equal(verdict(`Quelle est la bonne réponse, sinon ${mot} ?`), ecrite, 'entre deux espaces')
  assert.equal(verdict(`Quelle est la bonne réponse ? (${mot.toUpperCase()})`), ecrite, 'sans casse, entre parenthèses')
  assert.equal(verdict(`Entre ${mot}s et ${mot}, quelle est la bonne réponse ?`), ecrite, 'la seconde fois seulement en mot entier')
  assert.equal(verdict(`Quelle est la bonne réponse, des ${mot}s mises à part ?`), 'acceptée', 'au milieu d’un mot plus long')
  assert.equal(verdict(`Quelle est la bonne réponse, au sur${mot} près ?`), 'acceptée', 'collée à la fin d’un mot')
  assert.equal(verdict('Quelle est donc la bonne réponse à cette question-ci ?'), 'acceptée')
})

test('le nom de famille d’une personne qui répond se refuse dans l’intitulé, pas un titre ni un nom de règne', () => {
  // « …plus connu sous le nom de La Mère de Whistler » pour James Abbott
  // McNeill Whistler : le juge ne cherchait que le nom entier, et seul le
  // correcteur l'a vu (le 10 octobre 2026, le premier lot écrit sur des
  // faits de Wikidata). La base en avait une : « l'album Mingus Ah Um ».
  const modele = JSON.parse(readFileSync(path.join(DOSSIER_DE_LA_BASE, fichierDeCategorie('Arts & lettres')), 'utf8'))[0]
  const verdict = (texte: string, juste: string, type = 'personne') => {
    const autres = ['Gustave Courbet', 'Mary Cassatt', 'Winslow Homer']
    const lu = lireQuestionDeLaBase({
      ...modele,
      texte,
      reponses: [juste, ...autres],
      bonne: 0,
      entites: [{ nom: juste, type, description: 'la réponse' }],
      leurres: [...autres, 'Edgar Degas', 'Thomas Eakins', 'Albert Bierstadt'],
    })
    return 'refus' in lu ? lu.refus : 'acceptée'
  }
  const whistler = 'James Abbott McNeill Whistler'
  assert.equal(verdict('Qui a peint « Arrangement en gris et noir », plus connu sous le nom de « La Mère de Whistler » ?', whistler), 'le nom de la bonne réponse (Whistler) est écrit dans l’intitulé')
  assert.equal(verdict('Quel peintre a signé « Arrangement en gris et noir n° 1 », portrait de sa mère ?', whistler), 'acceptée')
  assert.equal(verdict('Qui a peint « La Mère de Whistler » ?', whistler, 'oeuvre'), 'acceptée', 'la réponse n’est pas une personne de la question')
  assert.equal(verdict('Qui a peint « Le Dénombrement de Bethléem », comme son fils Brueghel le Jeune ?', 'Pieter Brueghel l’Ancien'), 'le nom de la bonne réponse (Brueghel) est écrit dans l’intitulé', 'derrière son surnom')
  assert.equal(verdict('Quelle reine de France a donné son nom à une prune ?', 'Claude de France'), 'acceptée', 'un titre, « de France », n’est pas un nom de famille')
  assert.equal(verdict('Quel fils de Napoléon Ier fut surnommé l’Aiglon ?', 'Napoléon II'), 'acceptée', 'un nom de règne est celui de toute la lignée')
  assert.equal(verdict('Quel peintre a fait des whistler une marque ?', whistler), 'acceptée', 'un nom propre s’écrit avec sa capitale')
})
