import { CATEGORIES } from '../../../shared/categories'
import { ETIQUETTES, SOUS_THEMES } from '../../../shared/etiquettes'

/**
 * La consigne d'étiquetage : ce qu'on donne à une IA pour décrire les
 * questions de la réserve — leur sous-thème, leurs étiquettes, leur
 * difficulté estimée, leur public, leurs leurres, d'où vérifier la réponse.
 * Essayée sur les soixante questions du dépôt puis sur cinquante neuves
 * (cinq versions, le 3 octobre 2026) : un modèle fort la tient, et une
 * seconde passe de vérification attrape encore de vraies erreurs de fait.
 *
 * Ses listes se lisent dans le catalogue partagé (`shared/etiquettes.ts`),
 * qui relit aussi ce qu'elle rend (`lireEtiquetage`) : elle ne propose
 * aucune clé que la relecture refuserait.
 */
export function consigneDEtiquetage(n: number): string {
  const sousThemes = Object.entries(SOUS_THEMES)
    .map(([categorie, liste]) => `- ${categorie} : ${liste.map(s => `${s.cle} (${s.nom})`).join(', ')}`)
    .join('\n')
  const etiquettes = ETIQUETTES.map(f =>
    f.regle
      ? `${f.famille} — ${f.regle} : ${f.etiquettes.map(e => `${e.cle} (${e.nom})`).join(', ')}`
      : [f.famille, ...f.etiquettes.map(e => `- ${e.cle} : ${e.definition}`)].join('\n'),
  ).join('\n')
  return `L'ÉTIQUETAGE DES QUESTIONS DE FIESTAPP — ${n} QUESTIONS À DÉCRIRE

FiestApp est un quiz de soirée et une campagne solo, joués sur téléphone par des joueurs francophones de tous âges. Chaque question de la base est rangée avec des métadonnées qui servent à la choisir, à doser une partie, à filtrer pour un public et à décerner des récompenses. Tu reçois des questions déjà écrites : tu ne les réécris pas, tu les décris. Une description sûre et sobre vaut mieux qu'une description riche et fausse.

CE QUE TU REÇOIS
Un tableau JSON. Chaque question a un id et un texte, puis selon son type :
- un QCM : ses réponses et l'index de la bonne (bonne) ;
- un vrai ou faux : un QCM à deux réponses, « Vrai » et « Faux » ;
- une estimation : une cible (cible) et son unité, sans propositions.
Une question peut aussi avoir une photo (photo), une anecdote et la catégorie choisie par son auteur.

LES QUESTIONS QUE TU NE DÉCRIS PAS
Rends seulement {"id", "aRelire": ["hors-base"], "raison"} quand la question :
- se répond en regardant sa photo ou en écoutant son extrait, montrés juste avant (mémoire, observation) : raison "support" ;
- dépend des personnes présentes (un prénom à remplacer, « Qui dans la salle… ? ») : raison "personnes" ;
- n'a pas de bonne réponse (un sondage) : raison "sans-reponse".
Une question qui a une photo mais se répond sans elle (un monument qu'on reconnaît, un drapeau) se décrit normalement.

CE QUE TU RENDS — du JSON, rien d'autre
Un tableau, une entrée par question, dans le même ordre, avec exactement ces champs :

- id : recopié tel quel.

- categorie et sousTheme : une catégorie parmi ${CATEGORIES.join(', ')} ; puis la clé d'un sous-thème qui appartient à cette catégorie, et à elle seule (liste plus bas : vérifie-le). L'ordre de priorité : 1. le savoir demandé — ce qu'il faut savoir pour répondre ; 2. les règles de partage, plus bas, quand ce savoir hésite entre deux catégories ; 3. la catégorie de l'auteur, quand rien d'autre ne décide.

- etiquettes : de zéro à trois clés de la liste plus bas, chacune seulement si sa définition s'applique à la lettre à la question ou à sa bonne réponse — jamais à un leurre. Aucune vaut mieux qu'une étiquette douteuse ; la plupart des questions n'en ont qu'une, ou aucune.

- difficulte : de 1 à 5, la part d'adultes francophones qui trouveraient la bonne réponse. L'échelle dépend du type :
  QCM à quatre réponses (le hasard donne 25 %) : 1 = 90 % et plus (« Combien de jours compte une année bissextile ? ») ; 2 = 70 % (« Quel peintre a peint La Nuit étoilée ? ») ; 3 = 50 % ; 4 = 35 % (« Quelle est la capitale de l'Australie ? ») ; 5 = moins de 25 %, un piège qui fait tomber sous le hasard.
  Vrai ou faux (le hasard donne 50 %) : 1 = 95 % et plus ; 2 = 85 % ; 3 = 70 % ; 4 = 55 % ; 5 = moins de 50 %, l'idée reçue l'emporte.
  Estimation (la part qui tombe à 10 % près de la cible, ou à cinq ans près pour une année) : 1 = 70 % et plus ; 2 = 50 % ; 3 = 30 % ; 4 = 15 % ; 5 = moins de 5 %.
  Les leurres comptent : entourée de leurres absurdes, une réponse est plus facile ; un piège la rend plus difficile.

- ageMin : 6, 10, 14 ou 18 — le plus jeune âge où la question est à la fois convenable et compréhensible. 6 : ce qu'un enfant connaît avant de savoir bien lire (animaux familiers, dessins animés, couleurs). 10 : l'école primaire (tables de multiplication, fleuves de France, planètes). 14 : le collège, ou un sujet qui demande de la maturité — 14 demande un motif ; dans le doute entre 10 et 14, mets 10. 18 : réservé aux adultes. Ce n'est pas la difficulté : une question facile sur le vin reste à 18.

- date : {"valeur", "precision"}, à la précision la plus fine que tu connais avec certitude : le jour s'il est sûr, sinon le mois, sinon l'année. valeur s'écrit AAAA, AAAA-MM ou AAAA-MM-JJ, une année avant notre ère en négatif et sans zéros devant (« -27 ») ; precision vaut jour, mois, annee, decennie ou siecle. Une décennie ou un siècle s'écrit par sa première année : les années 1990 = « 1990 », le XIXe siècle = « 1801 », le XXVIe siècle avant notre ère = « -2600 ».
  Une œuvre, un monument et un événement reçoivent toujours leur date, même si la question ne porte pas sur elle : sortie ou publication, achèvement, jour de l'événement. C'est elle qui les place sur la frise. Ce qui s'étale sur plus de dix ans (la Grande Muraille, la Joconde, peinte de 1503 à 1519) reçoit sa date de début ; un chantier ou une œuvre de moins de dix ans, sa date d'achèvement ou de sortie (la tour Eiffel : 1889-03-31). Une œuvre déclinée en livre et en film reçoit la date de la version de sa catégorie (Cinéma : le premier film ; Arts & lettres : le premier livre). Un jour est celui que donnent les sources, dans le pays de l'événement ; seul un événement suivi en direct depuis la France à cheval sur minuit prend le jour de Paris (le premier pas sur la Lune : 1969-07-21). Un symbole, une théorie, une invention ou une institution reçoivent la date de leur création ou de leur publication si elle est certaine (le drapeau européen : 1955-12-08 ; la relativité restreinte : 1905). Une personne reçoit la date de l'événement que cite la question, et null si la question n'en cite aucun (« Qui fut le dernier tsar de Russie ? »). null pour un fait sans date : une capitale, un animal, une règle, un mot, une mesure.

- entites : de une à trois choses dont parle la question, la plus importante d'abord : {"nom", "type", "description"}. Le type, parmi :
  personne (réelle : Victor Hugo, Neil Armstrong) ; personnage (de fiction : Olaf, Hedwige) ; lieu (ville, pays, fleuve, montagne, monument, bâtiment, musée, astre : Canberra, la Loire, la tour Eiffel, Jupiter — il n'y a pas de type « monument ») ; oeuvre (film, livre, tableau, chanson, jeu : La Joconde) ; organisation (entreprise, équipe, institution, État ou régime même disparu : Apple, l'équipe de France de football, l'Empire byzantin) ; groupe (peuple, civilisation, dynastie : les Incas, les Pères pèlerins) ; espece (animal ou plante : le guépard, la tomate) ; evenement (daté, y compris la signature d'un texte de loi ou d'un traité : Apollo 11, la chute du mur de Berlin, l'édit de Nantes) ; objet (chose fabriquée ou matière : l'iPhone, le diamant, le miel) ; notion (idée, phénomène, règle, unité, organe ou partie du corps : la foudre, l'année bissextile, le cœur).
  La description ne sert qu'à retrouver l'entité dans Wikidata, et aucun joueur ne la voit : quelques mots qui lèvent l'homonymie (« ville d'Australie », « fleuve du nord de la France »), rien de plus. Ne donne jamais d'identifiant Wikidata : un programme les retrouvera.

- portee : france si un adulte qui n'a pas grandi en France a peu de chances de la connaître ; francophonie si elle suppose la culture francophone au-delà de la France (Belgique, Suisse, Québec, Afrique) ; monde sinon. Une œuvre ou un lieu français connus dans le monde entier (Le Petit Prince, la Joconde au Louvre) sont « monde » ; un jeu joué surtout en France (le tarot) et un emblème national (le coq) sont « france ».

- valeur : quand la bonne réponse est un nombre ou une année — QCM compris (« 8 », « 2007 ») —, {"nombre", "unite"}, l'unité vide ("") pour un nombre pur ; pour une estimation, sa cible et son unité ; null sinon.

- leurres : les mauvaises réponses, de la plus vraisemblable à la moins vraisemblable.
  QCM : SIX À HUIT, TOUJOURS — les mauvaises réponses de la question n'y suffisent jamais : ajoutes-en. Celles de la question y sont toutes, recopiées caractère pour caractère (apostrophes, majuscules, articles), et classées avec les autres, pas forcément en tête. Cherche d'abord dans le même univers (les autres hiboux de Harry Potter, les autres villes du pays). Ceux que tu ajoutes ont la même nature que la bonne réponse et la même forme que celles de la question : articles, majuscules et apostrophes telles qu'elles y sont écrites. Seule exception au minimum : quand il existe en tout moins de six réponses possibles (les cinq océans, les quatre saisons), donne-les toutes.
  Vrai ou faux : la seule autre réponse, ["Faux"] ou ["Vrai"]. Estimation : un tableau vide.
  Chaque leurre est certainement faux — vérifie qu'aucun ne pourrait être juste —, de même nature et de même forme que la bonne ; ni « aucune », ni « toutes », ni blague.

- dureeDeVie : "stable" si la réponse ne peut pas changer ; sinon {"revoirLe": "AAAA-MM-JJ"}, la date où elle risque de changer (prochaine élection, prochaine édition, prochain recensement), à un an au plus. Une estimation tolère un petit écart : une altitude remesurée de quelques mètres reste « stable ».

- explication : une phrase, 200 caractères au plus, qui dit pourquoi la bonne réponse est la bonne et, s'il y a un piège, pourquoi il trompe. N'y ajoute aucun fait au-delà de ce qui justifie la réponse : ni date, ni chiffre, ni nom que tu ne connais pas exactement ; un détail exact mais inutile alourdit sans rien apporter. Elle ne répète pas l'anecdote. Refusée : « La Loire, longue de 625 km, est le plus long fleuve français » (un chiffre qu'on croit savoir). Acceptée : « Le Rhône prend sa source en Suisse : il n'est pas entièrement français. »

- source : le titre exact de l'article où vérifier la réponse, {"titre", "site"}, site valant wikipedia-fr, wikipedia-en ou wikidata. Jamais d'adresse.

- confiance : 3 seulement si chaque nom, nombre, date et fait que tu écris (explication, leurres, date, valeur, source) est certain ; 2 si un seul élément te fait hésiter ; 1 si la question elle-même te semble poser problème.

- aRelire : les raisons de faire relire la question par un humain, parmi :
  plusieurs-bonnes-reponses ; fait-douteux (un fait de la question ou de l'anecdote dont tu n'es pas sûr) ; fait-perime (la réponse est déjà fausse aujourd'hui — ce qui peut changer un jour se dit dans dureeDeVie) ; leurre-juste (une réponse de la question pourrait être juste) ; formulation-ambigue ; anecdote-douteuse ; sensible (toute étiquette de la famille Prudence). Un tableau vide si rien ne cloche.

LES SOUS-THÈMES — chaque clé n'existe que dans sa catégorie
${sousThemes}

LES ÉTIQUETTES — clé : ce qu'elle veut dire
${etiquettes}

LES RÈGLES DE PARTAGE — elles tranchent quand le savoir demandé hésite, et l'emportent sur la catégorie de l'auteur
- Animaux, plantes et dinosaures → Nature ; les poissons, de mer comme d'eau douce → Nature (aquatique).
- Corps humain, espace, astres → Sciences ; un phénomène météo → Sciences (terre) ; arithmétique, tables et géométrie → Sciences (maths) ; convertir une grandeur physique (des degrés Fahrenheit) → Sciences (physique-chimie) ; un appareil ou une technologie → Sciences (techno).
- Un événement daté — qui, quand — → Histoire, même s'il touche à l'espace ou aux sciences (le premier pas sur la Lune : Histoire, explorations) ; comment une chose fonctionne → Sciences. La sortie d'un produit (le premier iPhone) n'est pas un événement historique : elle suit le produit (Sciences, techno).
- Le calendrier, l'heure et leurs calculs (les secondes d'une journée) → Culture générale (mesures), avec l'étiquette calcul s'il faut compter ; l'origine d'un mot, même étranger, une écriture ou un alphabet (le braille, l'alphabet grec, les chiffres romains) → Culture générale (langue), avec l'étiquette etymologie pour l'origine d'un mot ; mythologie → Culture générale (mythes).
- Un monument ou un lieu célèbre → Géographie (sites) quand la réponse est le lieu ou un fait sur le lieu : où il est, ce qu'il mesure, à quoi il servait. Quand la réponse est une personne, un peuple ou une date — qui l'a bâti, quelle civilisation, en quelle année —, c'est de l'Histoire (« Quelle civilisation a bâti le Machu Picchu ? » : Histoire, civilisations). Ce qu'on y observe suit le savoir demandé (voir la Grande Muraille depuis la Lune : Sciences, espace).
- Une œuvre à la fois livre et film, quand la question ne dit pas lequel (« Dans Harry Potter… ») : la catégorie de l'auteur ; sans elle, celle de sa forme d'origine.
- BD et manga → Arts & lettres (bd), mais un film tiré d'une BD → Cinéma ; une musique de film → Musique (ecrans) ; un aliment ou une boisson → Cuisine, l'alcool dans Cuisine (boissons), le miel, le sel et le sucre dans Cuisine (ingredients).
- C'est le savoir demandé qui décide : « Quel acteur joue Indiana Jones ? » est du cinéma, pas une célébrité.
- Autour de la fête ne reçoit que les questions que leur auteur y a rangées, écrites pour une fête et ses invités. Une coutume que tout le monde connaît (les noces d'or, la galette des rois) va dans Culture générale (societe) ou Cuisine ; une coutume de Noël dans un pays lointain va à Géographie (peuples), avec l'étiquette noel.
- Les étiquettes ne répètent jamais ce qu'un autre champ dit déjà : ni le continent, ni le pays, ni l'époque, ni la catégorie. etymologie fait exception : elle marque l'origine d'un mot dans toutes les catégories, sous-thème langue compris.
- alcool ne vaut que si la question ou sa bonne réponse parle d'alcool, jamais pour un leurre (la bière parmi les boissons proposées). alcool et sexualite imposent ageMin 18, violence au moins 14 ; toute étiquette Prudence ajoute « sensible » à aRelire.

CE QUE TU NE FAIS JAMAIS
- Réécrire le texte, les réponses ou l'anecdote : si la question est fausse ou ambiguë, dis-le dans aRelire.
- Écrire un fait dont tu n'es pas sûr sans baisser la confiance.
- Inventer une clé ou mettre un sous-thème dans une autre catégorie que la sienne : l'entrée entière serait rejetée.

AVANT DE RENDRE
Relis chaque entrée : le sous-thème est-il bien dans la liste de sa catégorie ? Chaque étiquette répond-elle à sa définition ? Les leurres de la question sont-ils recopiés à l'identique ? Chaque chiffre de l'explication est-il exact ? Au moindre doute, retire le détail plutôt que de le garder.

EXEMPLE — ce qu'on t'envoie
[
  {"id": "q_7f3a2c", "texte": "Quelle est la capitale de l'Australie ?", "reponses": ["Canberra", "Sydney", "Melbourne", "Perth"], "bonne": 0, "anecdote": "Canberra a été bâtie exprès pour devenir la capitale : Sydney et Melbourne se disputaient le titre."},
  {"id": "q_2b8104", "texte": "Combien de joueurs une équipe de rugby à XV aligne-t-elle sur le terrain ?", "reponses": ["11", "13", "15", "18"], "bonne": 2, "anecdote": null},
  {"id": "q_5c0711", "texte": "Le Soleil est une étoile.", "reponses": ["Vrai", "Faux"], "bonne": 0, "anecdote": null},
  {"id": "q_8e4402", "texte": "Combien de kilomètres mesure la Seine ?", "cible": 777, "unite": "km", "anecdote": null},
  {"id": "q_3d1990", "texte": "Combien y avait-il de chats sur l'image ?", "reponses": ["2", "3", "4", "5"], "bonne": 1, "photo": "chats.jpg", "anecdote": null}
]

EXEMPLE — ce que tu rends
[
  {"id": "q_7f3a2c", "categorie": "Géographie", "sousTheme": "capitales", "etiquettes": ["piege"], "difficulte": 4, "ageMin": 10, "date": null, "entites": [{"nom": "Canberra", "type": "lieu", "description": "ville d'Australie"}, {"nom": "Australie", "type": "lieu", "description": "pays d'Océanie"}], "portee": "monde", "valeur": null, "leurres": ["Sydney", "Melbourne", "Brisbane", "Perth", "Adélaïde", "Darwin"], "dureeDeVie": "stable", "explication": "Sydney est la plus grande ville du pays, d'où le piège ; la capitale est Canberra.", "source": {"titre": "Canberra", "site": "wikipedia-fr"}, "confiance": 3, "aRelire": []},
  {"id": "q_2b8104", "categorie": "Sport", "sousTheme": "rugby", "etiquettes": [], "difficulte": 2, "ageMin": 10, "date": null, "entites": [{"nom": "Rugby à XV", "type": "notion", "description": "sport collectif au ballon ovale"}], "portee": "monde", "valeur": {"nombre": 15, "unite": "joueurs"}, "leurres": ["13", "14", "16", "11", "12", "18"], "dureeDeVie": "stable", "explication": "Le nom le dit : le rugby à XV se joue à quinze ; treize, c'est le rugby à XIII, une autre discipline.", "source": {"titre": "Rugby à XV", "site": "wikipedia-fr"}, "confiance": 3, "aRelire": []},
  {"id": "q_5c0711", "categorie": "Sciences", "sousTheme": "espace", "etiquettes": [], "difficulte": 2, "ageMin": 10, "date": null, "entites": [{"nom": "Soleil", "type": "lieu", "description": "astre au centre du système solaire"}], "portee": "monde", "valeur": null, "leurres": ["Faux"], "dureeDeVie": "stable", "explication": "Le Soleil est une étoile comme celles du ciel nocturne ; il nous paraît différent parce qu'il est bien plus proche.", "source": {"titre": "Soleil", "site": "wikipedia-fr"}, "confiance": 3, "aRelire": []},
  {"id": "q_8e4402", "categorie": "Géographie", "sousTheme": "eaux", "etiquettes": [], "difficulte": 4, "ageMin": 10, "date": null, "entites": [{"nom": "Seine", "type": "lieu", "description": "fleuve du nord de la France"}], "portee": "france", "valeur": {"nombre": 777, "unite": "km"}, "leurres": [], "dureeDeVie": "stable", "explication": "La Seine parcourt 777 km, du plateau de Langres jusqu'à la Manche.", "source": {"titre": "Seine", "site": "wikipedia-fr"}, "confiance": 3, "aRelire": []},
  {"id": "q_3d1990", "aRelire": ["hors-base"], "raison": "support"}
]
`
}
