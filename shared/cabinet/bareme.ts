// Les chiffres du Cabinet de curiosités : chaque seuil, chaque prix, chaque
// barème de manche, chaque durée, chaque borne du contenu neuf. Des choix de
// produit (CLAUDE.md), tous ici et nulle part ailleurs — les règles des neuf
// jeux, le pli d'une partie, la page, le juge du contenu et le calibrage les
// lisent, aucun ne les recopie —, chacun sa ligne dans
// `docs/reference/baremes.md` : `documentation.test.ts` relit chaque ligne
// contre ce fichier, `cabinet-catalogue.test.ts` chaque constante contre la
// page.
//
// Les valeurs sont celles de la maquette que trois agents ont jouée deux fois
// chacun avant la proposition (`retours/2026-10-24/maquette/jeu.js`), et ce
// que ces tours ont fait changer : l'Épingle plus tolérante, l'Éclair à 45 s,
// un chrono par étape à la Réplique, les dorures baissées de 40 %. Puis ce que
// le calibrage sur le vrai code (`server/scripts/calibrage-cabinet.ts`) a fait
// changer le 25 octobre 2026, avant qu'une partie se joue hors des bases
// jetables : deux étoiles gardées au Pari, deux erreurs qui ne valent plus une
// étoile à la Frise, un indice de plus à chaque étoile des Indices, l'Éclair à
// 55 s, les dorures doublées et le double divisé par deux.
//
// Ce qu'un changement fait au passé dépend du chemin de chaque chiffre, que
// sa ligne de `baremes.md` dit : un seuil se fige au départ d'une partie ; la
// juste de chaque pièce s'écrit avec sa ligne au journal des réponses ; les
// étoiles et la poussière d'une partie finie, avec son bilan ; un prix, avec
// l'achat ; une durée, la grâce et la pause, avec le chrono du départ. Ce que
// le pli juge au barème du code — un barème de manche, ce que fait un
// pouvoir — monte la version du départ, qui garde la règle d'avant sous la
// sienne : le cartel et « Mes réponses » repassent par le pli d'une partie
// finie. Rien ne reprend une œuvre déjà entrée (invariant 22).
//
// Ce fichier n'importe que des types : tout le Cabinet le lit sans rien tirer.

import type { Niveau } from '../campagne'
import type { CleDeJeu } from './jeux/regle'
import type { Rarete } from './oeuvres'
import type { Force } from './pouvoirs'

// ── Une partie ────────────────────────────────────────────────────────────

/** Trois manches de trois étoiles : une partie de deux minutes, qui se lit d'un coup d'œil. */
export const MANCHES_PAR_PARTIE = 3
export const ETOILES_PAR_MANCHE = 3
/** Le total d'une partie, plafonné là même quand une mise gagnée y ajoute : neuf, c'est « parfait ». */
export const ETOILES_D_UNE_PARTIE = ETOILES_PAR_MANCHE * MANCHES_PAR_PARTIE

/**
 * Une pièce — ce qu'un verdict juge d'un coup — est juste dès deux étoiles
 * naturelles : « il a su ». Chaque ligne juste paie un confetti, l'expérience
 * d'une bonne réponse et un pas du compagnon : trois au plus par partie, six
 * au Pari, quel que soit le jeu. Le Pari, lui, juge sa bonne réponse.
 */
export const ETOILES_D_UNE_JUSTE = 2

/**
 * Les étoiles qu'il faut, sur neuf, pour gagner une œuvre : la rareté fait le
 * seuil. Figé au départ de chaque partie — un seuil changé ne vaut que pour
 * celles qui commencent, et une œuvre gagnée ne se reprend jamais.
 */
export const SEUILS_DES_RARETES: Readonly<Record<Rarete, number>> = { commun: 5, rare: 6, maudit: 6, epique: 7 }

// ── La poussière d'or ─────────────────────────────────────────────────────
// La monnaie du Cabinet, qui n'en sort jamais : ni confettis, ni écus (la
// décision du propriétaire, le 24 octobre 2026). Ce qu'une partie rapporte se
// fige dans son bilan ; un achat garde le prix payé.

/** Une partie de visite ou de chasse rapporte deux poussières par étoile… */
export const POUSSIERE_PAR_ETOILE = 2
/** … et quatre au moins, même ratée : une partie de deux minutes fait toujours avancer. */
export const POUSSIERE_MIN = 4
/**
 * Une œuvre qu'il avait déjà, regagnée en visite sans cadre doré : ce double
 * paie en plus. Divisé par deux au calibrage du 25 octobre 2026, avec les
 * dorures doublées : un double épique payait les trois quarts de sa dorure
 * (120 pour 160), et tout dorer ne prenait qu'un mois au complétionniste.
 */
export const POUSSIERE_DU_DOUBLE: Readonly<Record<Rarete, number>> = { commun: 15, rare: 30, maudit: 30, epique: 60 }
/**
 * Les parties libres qui paient chaque jour (deux poussières par étoile) ; les
 * suivantes se jouent pour le plaisir — la maquette donnait une poussière
 * infinie en partie libre, une faille qu'un agent a trouvée.
 */
export const LIBRES_QUI_PAIENT = 5
/** Acheter une œuvre précise qui lui manque. */
export const PRIX_D_UNE_OEUVRE: Readonly<Record<Rarete, number>> = { commun: 200, rare: 400, maudit: 400, epique: 700 }
/**
 * Dorer le cadre d'une œuvre qu'il a. La maquette les avait baissés de 40 %
 * pour que tout dorer reste atteignable en quelques mois ; sur le vrai code,
 * le complétionniste dorait tout en trente jours, le moyen en quarante : la
 * longue traîne n'existait plus. Doublés au calibrage du 25 octobre 2026,
 * avec les autres retouches du jour : 41,5 jours au complétionniste, 61 au
 * moyen, 193 à l'occasionnel — tout posséder ne bouge qu'à deux jours près,
 * sauf pour qui joue au hasard, que la Frise ne nourrit plus.
 */
export const PRIX_D_UNE_DORURE: Readonly<Record<Rarete, number>> = { commun: 100, rare: 200, maudit: 200, epique: 320 }

// ── La journée ────────────────────────────────────────────────────────────

/** La visite du jour : trois parties, trois jeux différents, chacune une œuvre à gagner sans la nommer. */
export const CASES_DE_LA_VISITE = 3
/** Un jeu de la visite qu'on peut changer chaque jour, tant que sa case n'est pas jouée. */
export const ECHANGES_PAR_JOUR = 1
/** Les jeux des visites des deux jours d'avant passent après les autres : la visite varie d'un jour à l'autre. */
export const JOURS_QUI_PASSENT_APRES = 2
/**
 * Le poids de chaque rareté parmi les œuvres qui lui manquaient à minuit,
 * quand la visite tire celles qu'elle met en jeu : surtout des communes, une
 * maudite ou une épique de temps en temps.
 */
export const POIDS_DES_CIBLES: Readonly<Record<Rarete, number>> = { commun: 6, rare: 3, maudit: 1, epique: 1 }
/** Les chasses de chaque jour : toucher un cadre vide et jouer au jeu où l'œuvre se trouve, ou rejouer une œuvre pour la dorer. */
export const CHASSES_PAR_JOUR = 2
/** « Rien ne revient avant sept jours », d'un jeu à l'autre : le Pari et l'Éclair puisent dans le même tas. */
export const JOURS_SANS_REDITE = 7
/** La série la plus longue — jours de visite ou de chasse d'affilée — qui réveille le Scarabée. */
export const JOURS_DU_SCARABEE = 30
/**
 * Le plafond des départs d'un profil : trente d'un coup, puis un toutes les
 * deux minutes (trente par heure). Toutes les parties s'écrivent, libres
 * comprises : il borne ce qu'un seul joueur écrit à la base.
 */
export const DEPARTS_PAR_HEURE = 30

// ── Les cartes-bonus ──────────────────────────────────────────────────────
// Le pouvoir d'une carte-bonus vient de sa famille ; sa rareté le rend plus
// fort (`shared/cabinet/pouvoirs.ts`). La carte se fige au départ, avec sa
// force, et ne s'use jamais.

/** La force que donne chaque rareté ; un gardien a toujours la plus haute. */
export const FORCES_DES_RARETES: Readonly<Record<Rarete | 'legendaire', Force>> = { commun: 1, rare: 2, maudit: 2, epique: 3, legendaire: 3 }
/** Éclairer : les indices d'une partie, à chaque force. */
export const ECLAIRAGES_PAR_PARTIE: Readonly<Record<Force, number>> = { 1: 1, 2: 2, 3: 3 }
/**
 * Protéger : les étoiles qu'il ajoute, une fois, à la première manche
 * imparfaite — jamais au-delà de trois. +3 vidait les seuils de leur sens, une
 * faille que les agents ont fermée.
 */
export const BONUS_DE_PROTECTION: Readonly<Record<Force, number>> = { 1: 1, 2: 1, 3: 2 }
/** Prendre son temps : les secondes de plus à chaque manche et à chaque étape, par point de force — figées au départ avec le chrono. */
export const SECONDES_PAR_FORCE = 10
/**
 * Miser : les étoiles en plus d'une manche misée sans l'avoir vue, si elle est
 * parfaite ; sinon, zéro. La mise à ×2 dorait une épique en deux manches.
 */
export const BONUS_DE_MISE: Readonly<Record<Force, number>> = { 1: 2, 2: 3, 3: 4 }
/** Changer : les manches qu'on remplace, chacune par une rechange tirée au départ. */
export const CHANGEMENTS_PAR_PARTIE: Readonly<Record<Force, number>> = { 1: 1, 2: 2, 3: 3 }

// ── Le chrono, à l'heure du serveur (invariant 6) ─────────────────────────

/**
 * La durée de chaque jeu, en secondes : par manche, par étape au Pari et à la
 * Réplique, pour les cinq affirmations à l'Éclair, pour les cinq essais au Mot
 * mystère. « Prendre son temps » s'y ajoute. Figée au départ de chaque partie
 * (`DepartDUnePartie.chrono`), avec la grâce et la pause : relue ici à chaque
 * réveil, une durée changée aurait fait changer d'échéance une manche en
 * route. Changée, elle ne vaut que pour les parties qui commencent.
 *
 * L'Éclair, passé de 45 à 55 s au calibrage du 25 octobre 2026 : cinq
 * affirmations à lire, l'échéance prenait l'occasionnel de court à une manche
 * sur neuf (11,1 %), quand aucun autre jeu ne dépassait 1,1 % ; 2,9 % à 55 s,
 * sans rien changer à ses étoiles.
 */
export const DUREES_DES_JEUX: Readonly<Record<CleDeJeu, number>> = {
  epingle: 45,
  frise: 60,
  mot: 120,
  detail: 45,
  filet: 45,
  pari: 35,
  eclair: 55,
  indices: 75,
  replique: 25,
}
/**
 * Le réseau d'un téléphone : un geste arrivé jusqu'à tant après l'échéance est
 * encore à l'heure — une réponse, Éclairer, un essai —, et « Prendre son
 * temps » ne sert qu'au-delà de la durée normale et de cette grâce. Figée au
 * départ avec les durées ; la page lit l'échéance dans la vue, elle ne recopie
 * pas ce chiffre.
 */
export const GRACE_D_UNE_MANCHE_MS = 1_500
/** La pause de « Quitter ? », au plus, par manche, sous un voile : la confirmation ne s'achète pas du temps de recherche. Figée au départ avec les durées. */
export const PAUSE_MAX_MS = 30_000
/**
 * Les pauses de « Quitter ? » qu'une manche accepte, ses trente secondes
 * partagées entre elles ; au-delà, ou ses trente secondes passées, la pause se
 * refuse et le chrono continue. Une garde des écritures autant qu'un choix :
 * chaque pause et sa reprise s'écrivent, et rien ne bornait leur nombre — une
 * page qui les enchaînait écrivait des centaines de gestes par manche, que
 * chaque relecture repliait. Lue par le pli au barème du code : relevée, rien
 * ne change aux parties jouées ; abaissée, elle monte la version du départ.
 */
export const PAUSES_PAR_MANCHE = 3

// ── Les neuf jeux ─────────────────────────────────────────────────────────
// Chaque barème dit ce qui vaut ★★★, ★★ puis ★ ; en deçà, zéro.

/** L'Épingle : à moins de 40 km ★★★, de 120 ★★, de 300 ★ — « l'Épingle plus tolérante » des tests. */
export const KM_DE_L_EPINGLE: readonly [number, number, number] = [40, 120, 300]
/** L'Épingle, Éclairer : une zone de ce rayon qui contient toujours le lieu. */
export const RAYON_D_ECLAIRER_KM = 170
/** … son centre décalé du lieu d'une distance tirée entre ces deux-là, dans une direction tirée : la zone ne dit jamais le lieu. */
export const DECALAGE_DE_LA_ZONE_KM: readonly [number, number] = [40, 140]

/** La Frise : les nouveaux venus de chaque manche — trois, puis deux, puis deux : une frise qui grandit jusqu'à sept. */
export const VAGUES_DE_LA_FRISE: readonly number[] = [3, 2, 2]
/** La Frise : l'écart, en années, entre deux événements voisins — deux années trop proches se rangeraient au hasard. */
export const ECART_DES_ANNEES_DE_LA_FRISE = 3
/**
 * La Frise : au plus tant d'erreurs pour ★★★, ★★, ★ — sans faute, une erreur ;
 * deux ne valent plus rien. Une borne qui ne monte pas laisse une étoile que
 * rien n'atteint, et l'annonce la tait (`baremeDesErreurs`). Deux erreurs
 * valaient ★ jusqu'au calibrage du 25 octobre 2026 : avec des vagues de deux,
 * une manche où les deux nouveaux venus sont posés ne descendait jamais sous
 * ★, et qui rangeait au hasard gagnait une commune 28,2 fois sur cent — 12,2
 * désormais, quand l'occasionnel en garde 86,7.
 */
export const ERREURS_DE_LA_FRISE: readonly [number, number, number] = [0, 1, 1]
/** La Frise : un nouveau venu laissé de côté compte autant que la pire place — la sienne, et celle du voisin qu'il contredit : poser n'est jamais pire que s'abstenir. */
export const ERREURS_D_UN_OUBLI = 2

/** Le Mot mystère : ses essais. */
export const ESSAIS_DU_MOT = 5
/** Le Mot mystère : trouvé en tant d'essais au plus pour ★★★, ★★, ★ — un ou deux, trois ou quatre, cinq. */
export const ESSAIS_DES_ETOILES: readonly [number, number, number] = [2, 4, 5]
/** Le Mot mystère : une bonne réponse d'un seul mot, de tant de lettres après son article. */
export const LETTRES_DU_MOT_MIN = 5
export const LETTRES_DU_MOT_MAX = 7

/** Le Détail : les étoiles au cadrage où il reconnaît le tableau, du premier au tableau entier ; reculer coûte une étoile. */
export const ETOILES_AU_CADRAGE: readonly number[] = [3, 2, 1, 0]
/** Le Détail : les titres proposés, le bon et trois d'époques voisines… */
export const TITRES_DU_DETAIL = 4
/** … tirés parmi les tableaux les plus proches en années : deviner à l'époque ne suffit pas. */
export const VOISINS_EN_ANNEES = 5
/** Éclairer au Détail, au Pari et à la Réplique : ce qu'il efface de propositions, au plus, dans une manche ou une étape… */
export const EFFACES_AU_PLUS = 2
/**
 * … sans jamais en laisser moins de tant : une seule serait la réponse. La
 * seconde étape de la Réplique n'a que trois personnes — un seul nom s'y
 * efface (`effacablesAuPlus`, `pouvoirs.ts`).
 */
export const PROPOSITIONS_LAISSEES = 2

/** Le Filet : la demi-largeur de chaque filet, en part de la piste. */
export const LARGEURS_DU_FILET: Readonly<Record<'petit' | 'moyen' | 'grand', number>> = { petit: 0.035, moyen: 0.09, grand: 0.2 }
/** Le Filet : ce que vaut la réponse prise dans chaque filet — petit, il rapporte plus. */
export const ETOILES_DU_FILET: Readonly<Record<'petit' | 'moyen' | 'grand', number>> = { petit: 3, moyen: 2, grand: 1 }
/** Le Filet, Éclairer : une zone dorée de cette part de la piste, qui contient la réponse. */
export const ZONE_DU_FILET = 0.3
/**
 * Le Filet : où tombe la réponse sur sa piste, tirée au départ. Jamais au
 * milieu d'office — le curseur part du milieu, et y rester payait toujours
 * dans la maquette d'avant les tests.
 */
export const POSITION_DE_LA_REPONSE: readonly [number, number] = [0.08, 0.92]
/** Le Filet : la longueur, en années, de la piste d'une année, tirée entre ces deux-là. */
export const PISTE_DES_ANNEES: readonly [number, number] = [50, 119]
/** Le Filet : la piste d'un nombre se parcourt en tant de pas (un an, pour une année). */
export const PAS_DE_LA_PISTE = 200
/** Le Filet : une année entière, dès celle-ci… */
export const ANNEE_MIN_DU_FILET = 1001
/** … ou une estimation d'au moins tant : sous dix, la piste n'a pas de quoi tendre un filet. */
export const VALEUR_MIN_DU_FILET = 10
/** Le Filet : la marche des questions qu'il pose. */
export const MARCHES_DU_FILET: readonly Niveau[] = ['facile', 'moyen']

/**
 * Le Pari : garder ses étoiles, ou les parier sur une question plus difficile —
 * réussie, ★★★ ; ratée, rien. Garder en valait une jusqu'au calibrage du
 * 25 octobre 2026 : trois manches gardées faisaient trois étoiles, et une
 * commune exigeait trois premières questions justes et un pari gagné sur une
 * question difficile — 3,1 % des parties de l'occasionnel. À deux, trois
 * premières justes la font : 24,6 %, au hasard 3,7 %, et pas un confetti de
 * plus (une pièce est juste à sa bonne réponse, pas aux étoiles).
 */
export const ETOILES_DU_PARI: Readonly<Record<'garder' | 'parier', number>> = { garder: 2, parier: 3 }
/** Le Pari : la marche mesurée de sa première question, puis de celle du pari — « difficile » doit l'être vraiment. */
export const MARCHES_DU_PARI: Readonly<Record<'question' | 'pari', readonly Niveau[]>> = { question: ['facile', 'moyen'], pari: ['difficile', 'expert'] }

/** L'Éclair : ses affirmations, d'une même catégorie. */
export const AFFIRMATIONS_DE_L_ECLAIR = 5
/** L'Éclair : au moins tant de justes pour ★★★, ★★, ★. */
export const JUSTES_DE_L_ECLAIR: readonly [number, number, number] = [5, 4, 3]
/** L'Éclair : la part des affirmations qui proposent la bonne réponse ; les autres, une des mauvaises. */
export const PART_DES_VRAIES = 0.5
/** L'Éclair : la marche des questions qu'il récrit en affirmations. */
export const MARCHES_DE_L_ECLAIR: readonly Niveau[] = ['facile', 'moyen']

/**
 * Les Indices : au plus tant d'indices comptés pour ★★★, puis ★★ ; au-delà, ★
 * — les indices vus, moins ceux qu'Éclairer offre, plus les erreurs. Un cran
 * plus large depuis le calibrage du 25 octobre 2026 : à deux et trois,
 * l'occasionnel n'y gagnait une commune qu'une partie sur cinq (21,2 %) ;
 * 37 % désormais, au hasard 0,3 % (0,2 avant).
 */
export const INDICES_DES_ETOILES: readonly [number, number] = [3, 4]
/** Les Indices : une faute de frappe se tolère dans un mot dès tant de lettres. */
export const LETTRES_POUR_UNE_FAUTE = 5
/** Les Indices : une réponse tient en tant de mots au plus — la réponse fourre-tout reste fermée. */
export const MOTS_D_UNE_IDENTITE_MAX = 4
/**
 * Un texte venu du téléphone dans un geste, au plus, en signes : le nom tapé
 * aux Indices se coupe là (`tronquer`, `lireUnGeste`) avant d'être jugé et
 * écrit, et des lettres du Mot mystère au-delà ne se lisent pas. Un nom de
 * cinq mille signes s'écrivait tel quel au journal des gestes, et revenait à
 * chaque relecture de la partie.
 */
export const SIGNES_D_UN_GESTE_MAX = 60

/** La Réplique : le bon mot ★★, puis la bonne personne ★, additionnés. */
export const ETOILES_DE_LA_REPLIQUE: Readonly<Record<'mot' | 'qui', number>> = { mot: 2, qui: 1 }

/** Le Mot mystère : la marche des questions dont il cache la réponse. */
export const MARCHES_DU_MOT: readonly Niveau[] = ['facile', 'moyen']
/** Le Pari et l'Éclair : un intitulé de QCM tient en tant de signes au plus — il se lit en 360 pixels, chrono en marche… */
export const INTITULE_MAX_DU_QCM = 130
/** … et chaque réponse en tant de signes. */
export const REPONSE_MAX_DU_QCM = 34

// ── Le contenu neuf ───────────────────────────────────────────────────────
// Les bornes que le juge du serveur applique à chaque entrée écrite pour le
// Cabinet (sa forme : `contenu.ts`), et que le script de rangement relit. En
// 360 pixels, chrono en marche : ce qui dépasse ne se lit plus à temps.

/** Le récit d'un lieu de l'Épingle, en signes… */
export const RECIT_MAX = 200
/** … sa question « Où ? »… */
export const QUESTION_MAX = 80
/** … et « Le savais-tu ? », de chaque entrée. */
export const SAVAIS_MAX = 180
/**
 * Les indices d'une fiche, du plus obscur au plus évident : autant que la
 * manche peut en montrer. Au dernier, une erreur tranche à zéro — mais le
 * compte des étoiles, lui, monte au-delà (`INDICES_DES_ETOILES`).
 */
export const INDICES_D_UNE_FICHE = 5
/** … et la longueur de chacun, en signes. */
export const INDICE_MAX = 110
/** Les clés d'une fiche, au plus : sans l'une d'elles, une réponse ne trouve personne. */
export const CLES_MAX = 3
/** Une réplique se lit d'un coup : tant de mots au plus, trou compris. */
export const MOTS_D_UNE_REPLIQUE_MAX = 15
/** Les mots qui pourraient aller dans le trou, et ne sont pas le bon : quatre à choisir, à la première étape. */
export const LEURRES_D_UNE_REPLIQUE = 3
/** Les personnes plausibles qui ne l'ont pas dite : trois à choisir, à la seconde étape. */
export const AUTRES_D_UNE_REPLIQUE = 2
/** Les événements d'une frise à thème : autant que ses trois vagues en posent — la somme, jamais un chiffre recopié. */
export const EVENEMENTS_D_UNE_FRISE_A_THEME = VAGUES_DE_LA_FRISE.reduce((n, vague) => n + vague, 0)
/**
 * Deux lieux de l'Épingle à moins de tant de kilomètres sont le même : deux
 * épingles au même endroit, deux fois la même réponse sous deux récits. Le
 * chargement du serveur l'applique aussi : relevée, elle écarterait des lieux
 * servis. Le 25 octobre 2026, les deux lieux livrés les plus proches étaient à
 * 3,4 km (la Rance et le départ de la Route du Rhum).
 */
export const LIEUX_VOISINS_KM = 2

// ── Les reflets ───────────────────────────────────────────────────────────

/**
 * La version des règles qui se dérivent du musée — les gardiens dus, les
 * reflets d'un profil. Une règle de gardien qui change la monte : au
 * démarrage suivant, chaque profil se relit et range ce qui lui manque, sans
 * rien reprendre (invariant 20). `VERSION_BAREME` ne bouge pas : elle ne relit
 * que les soirées.
 */
export const VERSION_DU_CABINET = 1
