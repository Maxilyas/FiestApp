import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { SERVEUR } from '../racine'
import { ETIQUETTES_ECARTEES } from './baseCampagne'
import { empreinteDe } from './jour'
import type { Categorie } from '../../../shared/categories'
import { MAX_REPONSE } from '../../../shared/campagne'
import { ETIQUETTES, SOUS_THEMES } from '../../../shared/etiquettes'

// La consigne qu'on donne à une IA pour agrandir la base de la campagne
// (`core/baseCampagne.ts`) — à la main, par lots que le script range dans le
// dépôt (`scripts/base-campagne.ts`), ou chaque matin par la routine qui
// dépose au serveur (`/api/campagne/base`, MISE-EN-LIGNE.md, étape 8) : une
// seule consigne pour les deux, comme celle du quiz du jour.

/** Au-delà, l'intitulé se lit mal sur un téléphone : un avertissement, pas un refus. */
export const TEXTE_CONSEILLE = 160
export const REPONSE_CONSEILLEE = 45

/** Une ligne de la part à écrire : un sous-thème, combien de questions, et leur difficulté quand la commande la fixe. */
export interface QuotaDEcriture {
  cle: string
  n: number
  difficulte?: number
}

/**
 * Comment l'IA travaille : par fichiers dans un dossier, vérifiés au fur et
 * à mesure (`lots`), ou d'un seul fichier que la routine lui nomme
 * (`routine`). La routine du matin n'a pas le dépôt — ni son vérificateur,
 * ni ses agents : sa consigne l'envoyait lancer `verifier` depuis un dossier
 * qui n'existe pas chez elle. C'est le serveur qui relit à l'envoi, avec le
 * même juge, et lui rend chaque refus avec son motif. Ou d'un seul fichier
 * que sa consigne nomme, vérifié jusqu'à zéro refus (`fichier`) : un des
 * lots d'une génération en nombre (`scripts/generer-campagne.ts`), écrits en
 * même temps par autant d'agents.
 */
export type TravailDUnLot = { sorte: 'lots'; lot: string; dossier: string } | { sorte: 'routine' } | { sorte: 'fichier'; fichier: string }

/** Les intitulés des quiz livrés : la base ne les reprend pas, le quiz du jour s'en est amorcé. */
export function empreintesDesLivres(): Set<string> {
  const dossier = path.join(SERVEUR, 'content/quiz')
  const vues = new Set<string>()
  for (const f of readdirSync(dossier).filter(f => f.endsWith('.json'))) {
    const quiz = JSON.parse(readFileSync(path.join(dossier, f), 'utf8')) as { questions?: { text?: string }[] }
    for (const q of quiz.questions ?? []) if (q.text) vues.add(empreinteDe(q.text))
  }
  return vues
}

function commentTravailler(travail: TravailDUnLot): string {
  if (travail.sorte === 'routine') {
    return `COMMENT TRAVAILLER
1. Écris toutes tes questions d'un seul coup dans le fichier que te nomme ta mission : le tableau JSON, rien d'autre — chacune avec la catégorie de sa part.
2. Relis chaque question comme un correcteur exigeant avant de l'envoyer : la bonne réponse est-elle certaine et la seule possible ? Chaque leurre est-il certainement faux ? L'anecdote est-elle exacte ? Au moindre doute, remplace la question. Mieux vaut une question simple et sûre qu'une question brillante et fausse.
3. À l'envoi, le serveur relit chaque question avec le juge de la base : il range celles qu'il accepte et te rend chaque refusée avec son motif. Corrige ou remplace chaque refusée — une question que la base a déjà, ou dont elle pose déjà le fait, se remplace par une autre —, et renvoie seulement celles-là.`
  }
  if (travail.sorte === 'fichier') {
    // D'autres agents écrivent les autres lots en même temps : rien ne se touche hors de son fichier.
    const { fichier } = travail
    return `COMMENT TRAVAILLER
1. Écris toutes tes questions d'un seul coup dans ${fichier} : le tableau JSON, rien d'autre.
2. Puis lance : cd ${SERVEUR} && npx tsx scripts/base-campagne.ts verifier ${fichier} — corrige ou remplace chaque question REFUSÉE et chaque AVERTISSEMENT, et relance jusqu'à zéro refus. Une question que la base a déjà, ou dont elle pose déjà le fait, se remplace par une autre.
3. Relis chaque question comme un correcteur exigeant avant de l'écrire : la bonne réponse est-elle certaine et la seule possible ? Chaque leurre est-il certainement faux ? L'anecdote est-elle exacte ? Au moindre doute, remplace la question. Mieux vaut une question simple et sûre qu'une question brillante et fausse.
4. N'écris rien d'autre que ce fichier : d'autres écrivent les lots voisins en même temps, et un correcteur relira le tien.`
  }
  const { dossier, lot } = travail
  return `COMMENT TRAVAILLER
1. Écris par fichiers de 30 à 40 questions, dans ${dossier}/${lot}-01.json, puis ${lot}-02.json, etc. Un fichier ne contient que le tableau JSON, rien d'autre.
2. Après chaque fichier, lance : cd ${SERVEUR} && npx tsx scripts/base-campagne.ts verifier ${dossier}/${lot}-NN.json — puis corrige ou remplace chaque question REFUSÉE et chaque AVERTISSEMENT, et relance jusqu'à zéro refus.
3. Avant d'écrire un nouveau fichier, relis tes intitulés déjà écrits : jamais deux questions sur le même fait, même dans deux fichiers.
4. Relis chaque question comme un correcteur exigeant avant de l'écrire : la bonne réponse est-elle certaine et la seule possible ? Chaque leurre est-il certainement faux ? L'anecdote est-elle exacte ? Au moindre doute, remplace la question. Mieux vaut une question simple et sûre qu'une question brillante et fausse.
5. À la fin, vérifie tous tes fichiers d'un coup (verifier ${dossier}/${lot}-*.json : zéro refus, aucun doublon) et rends un bilan court : le nombre de questions par sous-thème et par difficulté. N'écris rien ailleurs que dans tes fichiers ${lot}-NN.json.`
}

/**
 * La consigne d'écriture d'un lot : ce qu'on donne à une IA pour écrire des
 * questions de la base, déjà étiquetées — la consigne commune, puis la part
 * de sa catégorie. Ses champs sont ceux de la consigne d'étiquetage de la
 * réserve (`core/etiquetage.ts`), et le même juge les relit
 * (`lireEtiquetage`, par `lireQuestionDeLaBase`) : un champ qu'elle
 * décrirait autrement serait refusé à la vérification, pas rangé.
 *
 * Trois façons de travailler : à la main, par lots rangés ensuite dans le
 * dépôt (`scripts/base-campagne.ts consigne`) ; chaque matin, par la
 * routine qui dépose ses questions au serveur (`/api/campagne/base`) — sa
 * commande dit alors la difficulté de chaque question, et la consigne
 * commune ne s'y lit qu'une fois pour ses douze parts — ; ou par milliers
 * (`scripts/generer-campagne.ts`), un fichier par agent, tous écrits en même
 * temps.
 */
export function consigneDEcriture(
  categorie: Categorie,
  quotas: readonly QuotaDEcriture[],
  travail: TravailDUnLot,
  /** Les intitulés déjà écrits dans les sous-thèmes de la part : une IA ne sait pas ce que ses voisines ont écrit. */
  deja: readonly string[] = [],
): string {
  return `${consigneCommune(travail)}\n${partDeLaCategorie(categorie, quotas, deja)}`
}

/**
 * La part d'une catégorie : combien de questions, dans quels sous-thèmes, à
 * quelle difficulté, et ce que ces sous-thèmes ont déjà. Ceux-là seulement :
 * la catégorie entière faisait des consignes de plus en plus longues à mesure
 * que la base grandissait, et un fait déjà posé ailleurs, le juge le refuse
 * avec son motif (`IndexDesFaits`, `core/memeFait.ts`).
 */
export function partDeLaCategorie(categorie: Categorie, quotas: readonly QuotaDEcriture[], deja: readonly string[] = []): string {
  const total = quotas.reduce((s, q) => s + q.n, 0)
  const sousThemes = SOUS_THEMES[categorie]
  const lignes = quotas
    .map(q => {
      const nom = sousThemes.find(s => s.cle === q.cle)?.nom
      const combien = `${q.n} question${q.n > 1 ? 's' : ''}`
      return q.difficulte ? `- ${q.cle} (${nom}) : ${combien} de difficulté ${q.difficulte}` : `- ${q.cle} (${nom}) : ${combien}`
    })
    .join('\n')
  // La commande de la routine dit la difficulté de chaque question ; un lot écrit à la main la répartit.
  const dosage = quotas.every(q => q.difficulte)
    ? `Chaque ligne dit la difficulté à viser (échelle plus haut) : tiens-la, c'est ce qui manque à la base. Une 4 ou une 5 n'est pas obscure pour autant.`
    : `Dans chaque sous-thème, la difficulté (échelle plus haut) se répartit ainsi : environ 10 % de 1, 25 % de 2, 30 % de 3, 22 % de 4, 13 % de 5. Les faciles viennent toutes seules : écris d'abord les 4 et les 5, sans les rendre obscures.`
  const dejaEcrites =
    deja.length > 0
      ? `\nDÉJÀ ÉCRITES DANS CES SOUS-THÈMES — n'en reprends aucune, même reformulée ou retournée\n${deja.map(t => `- ${t.replace(/\s+/g, ' ').trim()}`).join('\n')}\n`
      : ''
  return `TA PART — ${total} QUESTIONS À ÉCRIRE, CATÉGORIE « ${categorie} »
${lignes}
${dosage} Un fait que la base pose déjà, dans n'importe quelle catégorie, est refusé : préfère les faits moins courus.
${dejaEcrites}`
}

/**
 * Ce qui ne dépend ni de la catégorie ni de la commande : la base, ce qui
 * fait une bonne question, l'échelle, le format, les sous-thèmes, les
 * étiquettes, les règles de partage, comment travailler, l'exemple. Recopiée
 * dans chacune des douze parts du matin, elle faisait les trois quarts des
 * 250 000 caractères que la routine lisait — et le 10 octobre 2026, la
 * routine s'arrêtait sur sa limite d'usage.
 */
export function consigneCommune(travail: TravailDUnLot): string {
  const etiquettes = ETIQUETTES.map(f =>
    f.regle
      ? `${f.famille} — ${f.regle} : ${f.etiquettes.map(e => `${e.cle} (${e.nom})`).join(', ')}`
      : [f.famille, ...f.etiquettes.filter(e => !ETIQUETTES_ECARTEES.includes(e.cle)).map(e => `- ${e.cle} : ${e.definition}`)].join('\n'),
  ).join('\n')
  const tousLesSousThemes = Object.entries(SOUS_THEMES)
    .map(([c, liste]) => `- ${c} : ${liste.map(s => s.cle).join(', ')}`)
    .join('\n')
  return `LA BASE DE LA CAMPAGNE DE FIESTAPP — LA CONSIGNE D'ÉCRITURE

FiestApp est un quiz joué sur téléphone par des francophones de tous âges, surtout des adultes en France. Sa campagne solo pose des questions qui montent en difficulté — faciles, moyennes, difficiles, puis expertes —, sans chronomètre : en série, avec trois vies, ou palier par palier sur les sentiers du savoir, où l'on gagne ses avatars ; après chaque réponse, le joueur découvre la bonne et une anecdote : c'est là qu'il apprend. La campagne puise dans une très grande base écrite d'avance, pour qu'un joueur n'y croise jamais deux fois la même question. Tu écris une partie de cette base : des questions sûres, variées, bien dosées, et déjà décrites par leurs métadonnées, dans un format qu'un programme relit et refuse au moindre écart. Ce que tu écris — combien, dans quelle catégorie, quels sous-thèmes, à quelle difficulté — est dit par ta part, après cette consigne.

CE QUI FAIT UNE BONNE QUESTION
- Un fait sûr, qui ne changera pas : ni actualité, ni « actuel », ni « aujourd'hui », ni record qui peut tomber, ni palmarès en cours, ni chiffre approximatif. Un fait daté se date dans l'intitulé (« En 1998, … »). Si tu n'es pas certain à cent pour cent de la bonne réponse ET des trois autres, change de question.
- Une seule bonne réponse, sans discussion possible, et trois mauvaises certainement fausses.
- Quatre réponses courtes (${REPONSE_CONSEILLEE} caractères au plus de préférence, ${MAX_REPONSE} au maximum), de même nature, de même forme et toutes plausibles : quatre villes du même pays, quatre années proches, quatre peintres de la même époque. Jamais de réponse absurde ou comique, jamais « Aucune » ou « Toutes », jamais la réponse ni un mot de la réponse dans l'intitulé, jamais de négation (« Lequel n'est pas… »).
- Un intitulé court et clair (${TEXTE_CONSEILLE} caractères au plus de préférence), qui se comprend seul : pas de photo, pas de son, pas de « ci-dessus ».
- Une anecdote vraie, toujours, en une ou deux phrases (220 caractères au plus) : elle apprend autre chose que la réponse, et ne contient aucun chiffre ni nom dont tu ne sois pas sûr.
- Le vrai ou faux est rare : au plus une question sur dix, seulement pour démentir une idée reçue (étiquette idee-recue) ; ses réponses sont exactement ["Vrai", "Faux"].
- Des sujets variés : jamais deux questions sur le même fait, ni la même question retournée (« Quelle est la capitale de X ? » puis « X a pour capitale… ? »). Varie les tournures : pas vingt « Quel est… ? » d'affilée.
- De France et du monde : environ un tiers de questions de culture française (portée france), le reste connu au-delà.
- Pas d'emoji, pas de sexualité, pas de politique d'aujourd'hui, rien qui révèle la fin d'un film, d'une série ou d'un livre, rien de cruel pour une personne réelle ou un peuple. Une question sur l'alcool est permise (ageMin 18), avec mesure.
- Le français soigné : accents, majuscules, apostrophes droites ('), une espace avant ? ! : ;, des guillemets « » autour d'un titre cité seulement s'il le faut.

L'ÉCHELLE DE DIFFICULTÉ — la part d'adultes francophones qui trouveraient la bonne réponse parmi les quatre
1 = presque tout le monde, 90 % et plus (« Quel fleuve traverse Paris ? ») ;
2 = la plupart, environ 70 % (« Quel peintre a peint La Nuit étoilée ? ») ;
3 = une personne sur deux (« Dans quel pays se trouve la ville de Porto ? ») ;
4 = un amateur éclairé, environ 35 % (« Quelle est la capitale de l'Australie ? ») ;
5 = un passionné, ou un piège qui fait tomber sous le hasard : moins de 25 % (« Quel est le plus long fleuve de France ? » — la Loire ; la Seine attire). Une 5 n'est pas obscure pour autant : en lisant la réponse, on se dit « j'aurais pu le savoir », ou « tiens ! ».
Les leurres règlent la difficulté : quatre réponses très proches rendent une question plus dure.
Vrai ou faux (le hasard donne 50 %) : 1 = 95 % et plus ; 2 = 85 % ; 3 = 70 % ; 4 = 55 % ; 5 = moins de 50 %, l'idée reçue l'emporte.

LE FORMAT — un fichier = un tableau JSON, une entrée par question, exactement ces champs, dans cet ordre :
- texte : l'intitulé.
- reponses : quatre chaînes, ou ["Vrai", "Faux"]. Place la bonne au hasard parmi les quatre (pas toujours en premier) : le jeu les mélange, mais une base dont la bonne est toujours la première trahit sa paresse.
- bonne : l'index (0 à 3) de la bonne réponse dans reponses.
- anecdote : une ou deux phrases (voir plus haut).
- categorie : celle de ta part, recopiée telle quelle.
- sousTheme : la clé d'un sous-thème de ta part. Une question qui, à la réflexion, relève d'une autre catégorie (règles de partage plus bas) : ne l'écris pas, écris-en une autre.
- etiquettes : de zéro à trois clés de la liste plus bas, chacune seulement si sa définition s'applique à la lettre à la question ou à sa bonne réponse, jamais à un leurre. La plupart des questions n'en ont qu'une, ou aucune.
- difficulte : de 1 à 5 (échelle plus haut).
- ageMin : 6, 10, 14 ou 18 — le plus jeune âge où la question est à la fois convenable et compréhensible. 6 : ce qu'un enfant connaît avant de bien lire ; 10 : l'école primaire ; 14 : le collège, ou un sujet qui demande de la maturité — dans le doute entre 10 et 14, mets 10 ; 18 : réservé aux adultes (l'alcool). Ce n'est pas la difficulté.
- date : {"valeur", "precision"} pour une œuvre, un monument, un événement, une invention ou une institution — sa sortie, son achèvement, son jour —, à la précision que tu connais avec certitude (jour, mois, annee, decennie ou siecle) ; valeur s'écrit AAAA, AAAA-MM ou AAAA-MM-JJ, une année avant notre ère en négatif sans zéros devant (« -27 »), une décennie ou un siècle par sa première année (les années 1990 = « 1990 », le XIXe siècle = « 1801 »). Une personne reçoit la date de l'événement que cite la question, null si elle n'en cite aucun. null pour un fait sans date : une capitale, un animal, une règle, un mot, une mesure.
- entites : de une à trois choses dont parle la question, la plus importante d'abord : {"nom", "type", "description"}. type parmi personne (réelle), personnage (de fiction), lieu (ville, pays, fleuve, monument, bâtiment, astre…), oeuvre, organisation (entreprise, équipe, institution, État même disparu), groupe (peuple, civilisation, dynastie), espece (animal ou plante), evenement (daté, y compris un traité), objet (chose fabriquée ou matière), notion (idée, phénomène, règle, unité, organe). description : quelques mots qui lèvent l'homonymie (« fleuve du nord de la France »). Jamais d'identifiant Wikidata.
- portee : france si un adulte qui n'a pas grandi en France a peu de chances de la connaître ; francophonie si elle suppose la culture francophone au-delà de la France ; monde sinon.
- valeur : quand la bonne réponse est un nombre ou une année, {"nombre", "unite"} (l'unité vide "" pour un nombre pur) ; null sinon.
- leurres : SIX À HUIT mauvaises réponses, de la plus vraisemblable à la moins vraisemblable : les trois de la question y sont toutes, recopiées caractère pour caractère, classées avec les autres ; celles que tu ajoutes ont la même nature et la même forme que la bonne, et sont certainement fausses. Seule exception : quand il existe en tout moins de sept réponses possibles (les cinq océans), donne-les toutes. Vrai ou faux : la seule autre réponse, ["Faux"] ou ["Vrai"].
- dureeDeVie : "stable", toujours — tu n'écris que des faits qui ne changeront pas.
- explication : une phrase de 200 caractères au plus qui dit pourquoi la bonne réponse est la bonne et, s'il y a un piège, pourquoi il trompe. Aucun fait au-delà de ce qui justifie la réponse, et elle ne répète pas l'anecdote.
- source : {"titre", "site"} : le titre exact de l'article où vérifier la réponse, site valant wikipedia-fr, wikipedia-en ou wikidata. Jamais d'adresse.
- confiance : 3, toujours — une question dont un seul élément te fait hésiter (la réponse, un leurre, l'anecdote, l'explication, la date) ne s'écrit pas : remplace-la.
- aRelire : [] — s'il y aurait quelque chose à relire, la question ne s'écrit pas. Seule exception : une étiquette de la famille Prudence s'accompagne de ["sensible"].

LES SOUS-THÈMES DE TOUTE LA BASE — pour savoir où s'arrête ta catégorie
${tousLesSousThemes}

LES ÉTIQUETTES — clé : ce qu'elle veut dire
${etiquettes}

LES RÈGLES DE PARTAGE — elles disent à quelle catégorie appartient un savoir
- Animaux, plantes et dinosaures → Nature ; corps humain, espace, astres, météo, maths, technologies → Sciences.
- Un événement daté — qui, quand — → Histoire, même s'il touche aux sciences (le premier pas sur la Lune : Histoire, explorations) ; comment une chose fonctionne → Sciences.
- Le calendrier, l'heure, les unités et leurs calculs → Culture générale (mesures) ; l'origine d'un mot, une écriture, un alphabet → Culture générale (langue) ; la mythologie → Culture générale (mythes).
- Un monument ou un lieu célèbre → Géographie (sites) quand la réponse est le lieu ou un fait sur le lieu ; quand la réponse est une personne, un peuple ou une date — qui l'a bâti, en quelle année —, c'est de l'Histoire.
- BD et manga → Arts & lettres (bd) ; un film tiré d'une BD → Cinéma ; une musique de film → Musique (ecrans) ; un aliment ou une boisson → Cuisine, l'alcool dans Cuisine (boissons).
- C'est le savoir demandé qui décide : « Quel acteur joue Indiana Jones ? » est du cinéma, pas une célébrité.
- Les étiquettes ne répètent jamais ce qu'un autre champ dit déjà : ni le pays, ni l'époque, ni la catégorie.

${commentTravailler(travail)}

EXEMPLE — deux entrées (Géographie et Sport) ; n'en reprends pas les questions
[
  {"texte": "Quelle est la capitale de l'Australie ?", "reponses": ["Sydney", "Melbourne", "Canberra", "Perth"], "bonne": 2, "anecdote": "Canberra a été bâtie exprès pour devenir la capitale : Sydney et Melbourne se disputaient le titre.", "categorie": "Géographie", "sousTheme": "capitales", "etiquettes": ["piege"], "difficulte": 4, "ageMin": 10, "date": null, "entites": [{"nom": "Canberra", "type": "lieu", "description": "ville d'Australie"}, {"nom": "Australie", "type": "lieu", "description": "pays d'Océanie"}], "portee": "monde", "valeur": null, "leurres": ["Sydney", "Melbourne", "Brisbane", "Perth", "Adélaïde", "Darwin"], "dureeDeVie": "stable", "explication": "Sydney est la plus grande ville du pays, d'où le piège ; la capitale fédérale est Canberra.", "source": {"titre": "Canberra", "site": "wikipedia-fr"}, "confiance": 3, "aRelire": []},
  {"texte": "Combien de joueurs une équipe de rugby à XV aligne-t-elle sur le terrain ?", "reponses": ["11", "13", "15", "18"], "bonne": 2, "anecdote": "Le sport tient son nom de la ville anglaise de Rugby, dont le collège passe pour l'avoir vu naître au XIXe siècle.", "categorie": "Sport", "sousTheme": "rugby", "etiquettes": [], "difficulte": 1, "ageMin": 10, "date": null, "entites": [{"nom": "Rugby à XV", "type": "notion", "description": "sport collectif au ballon ovale"}], "portee": "monde", "valeur": {"nombre": 15, "unite": "joueurs"}, "leurres": ["13", "14", "16", "11", "12", "18"], "dureeDeVie": "stable", "explication": "Le nom le dit : le rugby à XV se joue à quinze ; à treize, c'est le rugby à XIII, une autre discipline.", "source": {"titre": "Rugby à XV", "site": "wikipedia-fr"}, "confiance": 3, "aRelire": []}
]
`
}

// ── La commande du matin ─────────────────────────────────────────────────

/**
 * Ce que la routine écrit chaque matin, par catégorie : soixante questions
 * par jour pour les douze, de quoi faire grandir la base sans l'inonder —
 * chacune est encore relue avant d'entrer (le choix du 5 octobre 2026).
 */
export const QUESTIONS_PAR_CATEGORIE_ET_PAR_JOUR = 5

/** Au-delà, une catégorie refuse ce qu'on lui dépose ce jour-là : une routine qui s'emballe ne noie pas la base. */
export const PLAFOND_PAR_CATEGORIE_ET_PAR_JOUR = 2 * QUESTIONS_PAR_CATEGORIE_ET_PAR_JOUR

/** Ce qu'un dépôt porte au plus : une catégorie, et de la marge. */
export const DEPOT_MAX = 40

/**
 * La difficulté vers laquelle la base grandit (de 1 à 5) : plus de 4 et de
 * 5 qu'elle n'en a — les derniers paliers des sentiers et les paliers de
 * maître en demandent beaucoup —, sans oublier les faciles, que la série et
 * les premiers paliers posent à chaque partie.
 */
export const CIBLE_DES_DIFFICULTES: Readonly<Record<number, number>> = { 1: 0.08, 2: 0.17, 3: 0.27, 4: 0.28, 5: 0.2 }

/**
 * La commande d'une catégorie : `n` questions, chacune avec son sous-thème
 * — le moins fourni d'abord, l'ordre du catalogue départageant — et sa
 * difficulté — celle qui manque le plus à la catégorie au regard de la
 * cible. Regroupées par sous-thème et difficulté. Pure : la consigne la dit
 * telle quelle, et l'épreuve la relit.
 */
export function commandeDeLaCategorie(
  categorie: Categorie,
  existantes: readonly { sousTheme: string; difficulte: number }[],
  n: number,
): QuotaDEcriture[] {
  const parSousTheme = new Map(SOUS_THEMES[categorie].map(s => [s.cle, 0]))
  const parDifficulte = new Map([1, 2, 3, 4, 5].map(d => [d, 0]))
  for (const q of existantes) {
    const s = parSousTheme.get(q.sousTheme)
    if (s !== undefined) parSousTheme.set(q.sousTheme, s + 1)
    const d = parDifficulte.get(q.difficulte)
    if (d !== undefined) parDifficulte.set(q.difficulte, d + 1)
  }
  let total = existantes.length
  const lignes: QuotaDEcriture[] = []
  for (let i = 0; i < n; i++) {
    total++
    let difficulte = 3
    let retard = -Infinity
    for (const [d, compte] of parDifficulte) {
      const r = (CIBLE_DES_DIFFICULTES[d] ?? 0) * total - compte
      if (r > retard) {
        retard = r
        difficulte = d
      }
    }
    parDifficulte.set(difficulte, parDifficulte.get(difficulte)! + 1)
    let cle = ''
    let moins = Infinity
    for (const [s, compte] of parSousTheme) {
      if (compte < moins) {
        moins = compte
        cle = s
      }
    }
    parSousTheme.set(cle, moins + 1)
    const deja = lignes.find(l => l.cle === cle && l.difficulte === difficulte)
    if (deja) deja.n++
    else lignes.push({ cle, n: 1, difficulte })
  }
  return lignes
}
