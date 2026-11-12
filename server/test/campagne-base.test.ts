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
 * relecture) : 24 627. Puis la langue française, son sous-thème neuf écrit
 * famille par famille de son inventaire (`preparer --inventaire=francais`),
 * 390 rangées sur 400 (7 refusées comme un fait ou un intitulé déjà posé, 3
 * retirées à la relecture) : 25 017 ; puis une question par sujet que
 * l'inventaire laissait sans question (`--manques`), 15 : 25 032. Puis
 * l'anglais et l'espagnol, deux sous-thèmes neufs écrits de même
 * (`preparer --inventaire=anglais,espagnol`), 488 rangées sur 500 (8
 * refusées comme un fait déjà posé, 4 retirées à la relecture) : 25 520 ;
 * puis une question par sujet que leurs inventaires laissaient sans
 * question (`--manques`), 9 : 25 529. Puis les quatre univers et les trois
 * pays à qui manquaient des questions — Harry Potter, Star Wars, le Seigneur
 * des anneaux, James Bond, l'Égypte, l'Inde, le Mexique —, chacun ce qui
 * lui manquait, avec de la marge (`preparer --sujet=james-bond:75,…`), 301
 * rangées sur 320 (15 refusées comme un fait ou un intitulé déjà posé, 4
 * retirées à la relecture) : 25 830. Puis l'outre-mer, fil rouge neuf du
 * même soir, à 92 questions : trente de plus là où il vit déjà
 * (`preparer --sujet=outre-mer:30`), 29 rangées (une refusée comme un fait
 * déjà posé) : 25 859. Puis le second lot de sujets du même soir — huit
 * pays, des thèmes de leur seule étiquette —, ce qui manquait à dix d'entre
 * eux pour leurs cent questions (`preparer --sujet=coree:65,…`), 432
 * rangées sur 455 (18 refusées comme un fait ou un intitulé déjà posé, 5
 * retirées à la relecture) : 26 291. Le 19 octobre 2026, cent plats « D'où
 * vient ce plat ? » pour la curiosité de l'Expédition
 * (`retours/2026-10-19/les-curiosites.md`), un lot par région du monde et
 * un pour la France, 103 rangés sur 108 (5 retirés à la relecture : une de
 * leurs mauvaises réponses mangeait aussi le plat sous ce nom) : 26 394.
 * Le 1er novembre 2026, des questions sur les œuvres elles-mêmes — ni une
 * date, ni un nombre, ni le nom de qui les a faites — là où la base n'avait
 * presque que cela, après le plafond des questions par cœur des sentiers
 * (`seSaitParCoeur`) : le cinéma du monde (90 écrites, 14 % de ses
 * questions ne demandaient ni une date ni une personne), le cinéma français
 * (60), la littérature du monde (60), la littérature française, la peinture
 * et la musique classique (30 chacune), un lot par sous-thème et par vague ;
 * 295 rangées sur 300 (5 retirées à la relecture, dont deux faits posés
 * deux fois, au cinéma et en littérature) : 26 689. Le même jour,
 * l'univers Stargate, que la base ne posait pas : des faits relevés sur
 * Wikipédia, huit lots écrits à partir d'eux (le film, SG-1, Atlantis,
 * Universe, les coulisses, les mots de la saga), 173 rangées sur 206
 * (24 refusées comme un fait qu'un autre lot posait déjà, 9 retirées à la
 * relecture — des résumés d'épisodes faux, des leurres pas certainement
 * faux) : 26 862 ; puis une seconde vague sur ce qui en manquait — les
 * coulisses, des épisodes marquants, l'univers —, 33 rangées sur 35 (2
 * retirées à la relecture) : 26 895. Puis, le même soir, deux séries de
 * fans et un thème d'histoire : Kaamelott et Lost, écrits de la même façon
 * à partir de faits relevés sur Wikipédia, 179 et 204 questions avec celles
 * que la base posait déjà (la relecture a retiré près d'un quart des
 * questions de Kaamelott, que les résumés de la série ne permettaient pas
 * de confirmer) ; et la Seconde Guerre mondiale, posée sur 124 questions de
 * la base et écrite là où elle vit (`preparer --sujet`), 144 rangées sur
 * 150 : 27 405. Le lendemain, une question de Stargate retirée — elle
 * donnait Halla pour planète-mère des Asgard, qui est Othala — : 27 404.
 * Le 9 novembre 2026, un lot pilote de géographie à nombre que chaque
 * Français saurait placer, pour le nouveau Filet : 47 faits essayés, 13 déjà
 * dans la base, 10 écrits et rangés (une anecdote corrigée, la Loire
 * « jamais endiguée ») : 27 414. Puis sa seconde moitié, en sport, ce que
 * chaque Français saurait estimer : 37 faits essayés, 12 déjà dans la base,
 * 10 écrits, 9 rangés (la longueur d'un terrain de football retirée : les
 * lois du jeu en laissent une fourchette) : 27 423. Le même jour, un
 * doublon que le juge des faits ne voyait pas retiré — deux questions de
 * Lost sur le code de 108 minutes, sous deux entités écrites autrement
 * (« Le Cygne », « Station Cygne ») ; i3uqyd02 s'en va, k9n359l1 reste :
 * 27 422. Le soir, quatre lots pour le premier acte du nouveau Filet, là où
 * il n'avait pas de quoi tirer — la Nature, la Cuisine, les Arts & lettres,
 * la Géographie —, des années et des grandeurs que la plupart des Français
 * placeraient : 140 écrites ; 37 redites que le vérificateur ne voyait pas
 * — leur réponse chiffrée déjà écrite dans l'intitulé d'une autre question
 * sur le même sujet, ou la canette de 330 ml en centilitres —, remplacées
 * dans trois lots, retirées de la cuisine ; 15 retirées pour un gabarit
 * répété (des morts d'auteurs étrangers, les apports de référence des
 * étiquettes) et 7 à la relecture : 110 rangées, 27 532. Puis un second
 * lot de géographie, à qui il manquait une valeur : 12 écrites et rangées,
 * la longueur de l'équateur passée aux Sciences : 27 544.
 * Le même jour encore, l'équitation et la plongée, deux disciplines que la
 * base ne posait pas : un sous-thème neuf chacune en Sport et un inventaire
 * de six familles, 260 questions écrites en douze lots d'une seule vague —
 * 4 refusées entre lots comme un fait déjà posé, 9 retirées et 20 corrigées
 * à la relecture (Salinero donné pour le cheval d'Anky van Grunsven dès
 * 2000, qui était Bonfire), 5 retirées encore au coup d'œil sur tous les
 * lots : le mot « apnée » et les palmes, demandés par trois familles que
 * leurs relecteurs ne lisaient pas ensemble — 242 rangées : 27 786. Puis
 * un lot de complément, les faciles et les moyennes qui manquaient encore
 * aux deux montées de leur parcours, 29 rangées sur 30 : 27 815 — 135
 * questions d'équitation, 136 de plongée. Le 10 novembre 2026, le juge des
 * faits reconnaît deux réponses chiffrées de même grandeur (`grandeurDe`,
 * `core/memeFait.ts` : « 50 ans » et « 50 », « 40 h » et « 40 heures »,
 * « 1 litre » et « 100 cl ») : il en relevait dix-neuf paires dans la base,
 * dix-huit vrais doublons — les noces d'or et d'argent, les 24 carats de
 * l'or pur, les 230 V du secteur, la chope de l'Oktoberfest, le magnum… —,
 * dont une question sort : celle que le Filet du Cabinet ne pose pas, sinon
 * la moins bien notée de son panel, sauf deux que les frises datent (c'est
 * alors leur jumelle qui sort) : 27 797. La dix-neuvième, le quinquennat et
 * le mandat du président, pose deux faits : elle reste. Les réponses
 * chiffrées retournées que le même juge relevait ce jour-là — une question
 * à nombre dont la réponse est écrite dans l'intitulé d'une autre, sur le
 * même sujet — restent aussi : la règle ne vaut que pour les questions
 * neuves, le choix du propriétaire, la plupart servant au Filet.
 * Le même jour, « des thèmes que les gens ont envie de tester » :
 * les quatre licences les plus connues, qui étaient aussi les plus maigres
 * — Harry Potter, Star Wars, Marvel, Le Seigneur des anneaux, de 110 à 116
 * questions —, étoffées de 320 écrites (`preparer --sujet`) : 10 refusées
 * entre lots, 1 retirée et 32 corrigées à la relecture, 5 retirées au coup
 * d'œil — deux formules de Harry Potter qu'un intitulé corrigé pour nommer
 * la saga a fait retomber sur un fait de la base —, 304 rangées : 28 101.
 * Puis quatre univers ouverts, Astérix, Tintin, Pokémon, Mario et
 * Nintendo : leur étiquette posée sur 269 questions de la base (468
 * candidates de mots-clés triées une à une), et 260 écrites — 6 refusées
 * entre lots, 5 retirées et 23 corrigées à la relecture, 14 retirées pour
 * un gabarit répété (huit « dans les traductions anglaises », huit « dans
 * quelle ville de Kanto ») —, 235 rangées : 28 336. Enfin 22 de ces
 * questions neuves retirées : elles reposaient, sous d'autres mots, un
 * fait que la base posait déjà pour leur univers (Lumos, Chewbacca, la
 * Comté, Ralph Fiennes en Voldemort), que le juge des faits ne voyait pas
 * — trouvées en comparant chaque bonne réponse neuve à celles de la base,
 * univers par univers : 28 314. Le même contrôle sur l'équitation et la
 * plongée de la veille en retire 5 (le département de Deauville, le
 * parc national des Calanques, le pays du Yucatán et du Sinaï, le mâle de
 * la jument) : 28 309. Et le juge du jour, arrivé de `main` pendant que
 * ces lots s'écrivaient, y relève trois réponses chiffrées retournées :
 * deux années que la base écrivait déjà dans un intitulé — le premier tome
 * de Harry Potter, « Astérix et Obélix : Au service de Sa Majesté » —,
 * retirées, et un « (2001) » ôté d'un intitulé sur La Communauté de
 * l'anneau, qui soufflait l'année demandée ailleurs : 28 307.
 * Le même jour encore, deux séries validées avec ces univers, Friends et
 * Game of Thrones : 25 et 29 questions de la base étiquetées, puis 213
 * écrites à partir de faits relevés sur Wikipédia en français — douze lots
 * d'une seule vague, un par facette (qui est qui, chaque groupe de saisons,
 * les coulisses, les romans), chacun son fichier de faits —, 3 retirées et
 * une vingtaine corrigées à la relecture, 28 retirées à la lecture de tous
 * les lots ensemble (ce que deux facettes posaient l'une et l'autre —
 * Gunther, Mélisandre, la Banque de Fer —, deux révélations de l'intrigue,
 * une réponse hors de l'univers) : 182 rangées, 28 489. Et « Langues et
 * écritures du monde », tombée à cinquante-cinq questions et sans rubrique
 * depuis que le français, l'anglais et l'espagnol avaient pris les leurs :
 * 150 écrites en six familles, 6 retirées et 8 corrigées à la relecture (le
 * picard et le breton, qui sont au français), 7 retirées au coup d'œil —
 * sept « Quelle langue parle-t-on à… ? » dont trois de trop, le yiddish et
 * le copte posés par deux familles, un outil que les sources nomment de
 * deux façons — : 137 rangées, 28 626. Puis les faits que chaque Français
 * sait placer, pour le premier acte du Filet (le 12 novembre 2026,
 * `retours/2026-11-12/acte-i-du-filet.md`), en trois tours : des lots à pistes
 * (32 rangées), des faits criblés par script puis classés à l'aveugle (57),
 * le rattrapage de ceux que le crible croyait bloqués (6) — 95 rangées,
 * 28 721. Deux doublons que ni `verifier` ni `voisines` ne voyaient, trouvés
 * par un recoupement des mots et des réponses avec la base, sont partis : les
 * régions de 2016 et le match de football à 90 minutes.
 */
const AU_MOINS = 28721

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
