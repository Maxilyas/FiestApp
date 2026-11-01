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
// 55 s, les dorures doublées et le double divisé par deux. Puis ce que la
// tablée du même soir et le calibrage corrigé du lendemain ont fait trancher
// (le 26 octobre 2026) : la pause de « Quitter ? » à dix secondes, ★★★ en un ou
// deux indices, la mise de la force 3 ramenée à celle de la force 2, la zone
// d'Éclairer à l'Épingle élargie et décalée plus loin, la marche qui suit
// l'enjeu, la Frise serrée pour une épique. Puis ce que la tablée du 26 a
// fait trancher : une manche ratée que Protéger relève d'une seule étoile.
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

/**
 * Trois manches de trois étoiles : une partie de quelques minutes, qui se lit d'un coup d'œil. Pas « de deux minutes » : le Mot
 * en donne deux par manche, et la page ne le promet plus (la tablée du 26 octobre 2026).
 */
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
/**
 * … et quatre au moins, même ratée, pourvu qu'il ait répondu à une manche :
 * une partie de quelques minutes fait toujours avancer. Quittée d'emblée, elle en
 * rapportait autant — de quoi en tirer sans jouer (la tablée du 25 octobre
 * 2026) ; elle ne rapporte plus rien depuis le lendemain.
 */
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
/**
 * Un jeu de la visite qu'on peut changer chaque jour, tant que sa case n'est
 * pas jouée. Un seul, et son type le tient : la visite figée ne garde qu'une
 * case échangée (`VisiteFigee.echange`), que la règle des échanges et la garde
 * de la base lisent (`refusDeLEchange`, `lotDeLEchange`). Monté seul, le chiffre
 * ferait promettre à la page un second échange que le serveur refuserait : en
 * permettre deux change d'abord la forme de la visite figée.
 */
export const ECHANGES_PAR_JOUR: 1 = 1
/** Les jeux des visites des deux jours d'avant passent après les autres : la visite varie d'un jour à l'autre. */
export const JOURS_QUI_PASSENT_APRES = 2
/**
 * Le poids de chaque rareté parmi les œuvres qui lui manquaient à minuit,
 * quand la visite tire celles qu'elle met en jeu : surtout des communes, une
 * maudite ou une épique de temps en temps.
 */
export const POIDS_DES_CIBLES: Readonly<Record<Rarete, number>> = { commun: 6, rare: 3, maudit: 1, epique: 1 }
/**
 * Les chasses de chaque jour : toucher un cadre vide et jouer au jeu où l'œuvre se trouve, ou jouer une œuvre à soi à son jeu
 * pour la dorer — jamais la « rejouer » : offerte ou achetée, elle n'a souvent jamais été jouée.
 */
export const CHASSES_PAR_JOUR = 2
/** « Rien ne revient avant sept jours », d'un jeu à l'autre : le Pari et l'Éclair puisent dans le même tas. */
export const JOURS_SANS_REDITE = 7
/**
 * La série la plus longue — jours de visite ou de chasse d'affilée — qui
 * réveille le Scarabée. Un jour ne compte qu'à la première manche répondue de
 * sa visite ou de sa chasse : compté au départ, une visite commencée puis
 * quittée chaque jour le réveillait au trentième (la tablée du 25 octobre 2026).
 */
export const JOURS_DU_SCARABEE = 30
/**
 * Le plafond des départs d'un profil : trente d'un coup, puis un toutes les
 * deux minutes (trente par heure). Toutes les parties s'écrivent, libres
 * comprises : il borne ce qu'un seul joueur écrit à la base.
 */
export const DEPARTS_PAR_HEURE = 30

// ── La tour ───────────────────────────────────────────────────────────────
// La montée : neuf étages, un par salle, du Vestibule au Téméraire ; à chaque
// étage, une porte à choisir et une partie de trois manches derrière elle
// (`shared/cabinet/montee.ts`). Une porte ouverte donne ce qu'elle montrait ;
// fermée, elle coûte un cœur. Tout se relit des parties du jour, que leur
// départ fige ; seul le record s'écrit à part (`cabinet_records`). Le
// propriétaire a joué la maquette le 31 octobre 2026 : « une seule question par
// étage, ça ne fait pas beaucoup » — d'où une partie entière derrière chaque
// porte.

/** Les cœurs d'une montée : une porte qui reste fermée en coûte un, et la montée s'arrête au dernier. */
export const COEURS_D_UNE_MONTEE = 3
/** Les étages dont la porte, seule, garde un coffre : une œuvre rare, maudite ou épique de leur salle. */
export const ETAGES_DU_COFFRE: readonly number[] = [3, 6, 9]
/**
 * Les étoiles qu'il faut, sur neuf, pour ouvrir une porte sans œuvre — un cœur, les étoiles doublées : deux manches justes
 * et un peu plus. Celle d'une œuvre demande le seuil de sa rareté (`SEUILS_DES_RARETES`), le même qu'en chasse.
 */
export const SEUIL_D_UNE_PORTE = 5
/** Ce qu'une porte au cœur rend, une fois ouverte, sans jamais passer les cœurs du départ. */
export const COEURS_D_UNE_PORTE = 1
/** Ce que fait aux étoiles de son étage la porte qui les double, une fois ouverte. */
export const ETOILES_D_UNE_PORTE = 2

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
 * imparfaite qu'une réponse a tranchée — jamais au-delà de trois. +3 vidait
 * les seuils de leur sens, une faille que les agents ont fermée. Une manche
 * quittée, ou expirée sans réponse, ne se relève pas : quitter d'emblée sous
 * Prudence valait une étoile (la tablée du 25 octobre 2026) ; une manche
 * gardée au Pari non plus — un choix, pas une manche imparfaite.
 */
export const BONUS_DE_PROTECTION: Readonly<Record<Force, number>> = { 1: 1, 2: 1, 3: 2 }
/**
 * … mais une manche ratée — zéro étoile — n'en gagne que tant, à toute force.
 * Relevée de deux à la force 3, elle faisait avec une manche juste au hasard
 * les cinq étoiles d'une commune : au Détail, un titre sur quatre tombé juste
 * en trois essais la gagnait 57,8 fois sur cent sans rien savoir, au-delà de la
 * borne d'une sur trois qui a fermé Éclairer 3 à l'Épingle et Miser 3 au
 * Détail (le calibrage du 26 octobre 2026). Prudence, à +1, n'y perd rien.
 */
export const BONUS_D_UNE_MANCHE_RATEE = 1
/** Prendre son temps : les secondes de plus à chaque manche et à chaque étape, par point de force — figées au départ avec le chrono. */
export const SECONDES_PAR_FORCE = 10
/**
 * Miser : les étoiles en plus d'une manche misée sans l'avoir vue, si elle est
 * parfaite ; sinon, zéro. La mise à ×2 dorait une épique en deux manches. La
 * force 3 en ajoutait quatre jusqu'au 26 octobre 2026 : une manche misée
 * parfaite faisait sept, le seuil d'une épique, et deviner un titre du Détail au
 * premier coup d'œil la gagnait une partie sur quatre sans rien savoir. À trois,
 * la loterie des épiques se ferme — il faut encore une manche parfaite —, et la
 * commune et la rare ne bougent pas.
 */
export const BONUS_DE_MISE: Readonly<Record<Force, number>> = { 1: 2, 2: 3, 3: 3 }
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
 * sans rien changer à ses étoiles. Le Quiz, 80 s pour ses quatre questions :
 * vingt secondes chacune — le calibrage en prête quatorze à une question du
 * Pari au joueur moyen, et une minute aurait pris de court quiconque lit moins
 * vite que lui.
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
  quiz: 80,
}
/**
 * Le réseau d'un téléphone : un geste arrivé jusqu'à tant après l'échéance est
 * encore à l'heure — une réponse, Éclairer, un essai —, et « Prendre son
 * temps » ne sert qu'au-delà de la durée normale et de cette grâce. Figée au
 * départ avec les durées ; la page lit l'échéance dans la vue, elle ne recopie
 * pas ce chiffre.
 */
export const GRACE_D_UNE_MANCHE_MS = 1_500
/**
 * La pause de « Quitter ? », au plus, par manche — toutes ses pauses
 * ensemble —, sous un voile : le temps de lire la confirmation, jamais du temps
 * de recherche à vendre. Trente secondes jusqu'au 26 octobre 2026 : la manche
 * restait derrière le voile de la page, mais rien ne marquait la réponse ni
 * n'ôtait le cadre doré, quand « Prendre son temps », qui en vend, les marque —
 * 25 s devenaient 55 à la Réplique (la tablée du 25 octobre 2026). Figée au
 * départ avec les durées : une partie commencée garde la sienne.
 */
export const PAUSE_MAX_MS = 10_000
/**
 * Les pauses de « Quitter ? » qu'une manche accepte, ses dix secondes
 * partagées entre elles ; au-delà, ou ses dix secondes passées, la pause se
 * refuse et le chrono continue. Une garde des écritures autant qu'un choix :
 * chaque pause et sa reprise s'écrivent, et rien ne bornait leur nombre — une
 * page qui les enchaînait écrivait des centaines de gestes par manche, que
 * chaque relecture repliait. Lue par le pli au barème du code : relevée, rien
 * ne change aux parties jouées ; abaissée, elle monte la version du départ.
 */
export const PAUSES_PAR_MANCHE = 3

// ── Les dix jeux ──────────────────────────────────────────────────────────
// Chaque barème dit ce qui vaut ★★★, ★★ puis ★ ; en deçà, zéro.

/** L'Épingle : à moins de 40 km ★★★, de 120 ★★, de 300 ★ — « l'Épingle plus tolérante » des tests. */
export const KM_DE_L_EPINGLE: readonly [number, number, number] = [40, 120, 300]
/**
 * L'Épingle, Éclairer : une zone de ce rayon qui contient toujours le lieu,
 * figé avec le décalage de son centre dans le tirage de chaque manche
 * (`EpingleTiree.decalage`) — une partie commencée garde la sienne.
 */
export const RAYON_D_ECLAIRER_KM = 300
/**
 * … son centre décalé du lieu d'une distance tirée entre ces deux-là, dans une
 * direction tirée : la zone ne dit jamais le lieu. De 40 à 140 km dans une zone
 * de 170 jusqu'au 26 octobre 2026 : planter au milieu de la terre que la zone
 * couvre valait ★★ presque toujours, et trois zones — Éclairer à la force 3 —
 * faisaient gagner une commune 95 fois sur cent à qui ne savait rien. Plus loin
 * dans une zone plus grande, le centre ne vaut jamais plus qu'une étoile, et
 * celui qui ne sait rien ne passe plus le tiers des communes, quand Éclairer
 * lui rapporte encore une étoile par manche (le calibrage corrigé du même jour).
 */
export const DECALAGE_DE_LA_ZONE_KM: readonly [number, number] = [120, 294]

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
 * désormais, quand l'occasionnel en garde 86,7. La première manche, sans
 * ancre, se joue ainsi tout ou rien : deux voisins dans le désordre y sont faux
 * tous deux, un oubli en compte deux, et une seule erreur n'y est pas possible.
 */
export const ERREURS_DE_LA_FRISE: readonly [number, number, number] = [0, 1, 1]
/** La Frise : un nouveau venu laissé de côté compte autant que la pire place — la sienne, et celle du voisin qu'il contredit : poser n'est jamais pire que s'abstenir. */
export const ERREURS_D_UN_OUBLI = 2
/**
 * La Frise d'une épique : une frise serrée, dont la moitié au moins des
 * voisins se suivent à tant d'années au plus (`estUneFriseSerree`) — tant que
 * le tireur en a une. Une frise se range d'autant plus vite que ses années
 * s'écartent : « Les rois de France » ont un siècle entre deux voisins,
 * « L'aviation » trois ans ; l'épique tirait l'une comme l'autre (la tablée du
 * 25 octobre 2026). La moitié des dix-huit frises à thème le sont. Tirée au
 * départ : une partie commencée garde sa frise.
 */
export const ECART_D_UNE_FRISE_EPIQUE = 20

/** Le Mot mystère : ses essais. */
export const ESSAIS_DU_MOT = 5
/** Le Mot mystère : trouvé en tant d'essais au plus pour ★★★, ★★, ★ — un ou deux, trois ou quatre, cinq. */
export const ESSAIS_DES_ETOILES: readonly [number, number, number] = [2, 4, 5]
/** Le Mot mystère : une bonne réponse d'un seul mot, de tant de lettres après son article. */
export const LETTRES_DU_MOT_MIN = 5
export const LETTRES_DU_MOT_MAX = 7

/** Le Détail : les étoiles au cadrage où il reconnaît le tableau, du premier au tableau entier ; reculer coûte une étoile. */
export const ETOILES_AU_CADRAGE: readonly number[] = [3, 2, 1, 0]
/**
 * Le Détail : les titres proposés, le bon et trois d'époques voisines — une
 * fenêtre d'autant de tableaux qui se suivent dans le temps
 * (`fenetresDuDetail`), la moins vue d'abord, le bon au hasard parmi eux. Les
 * leurres se tiraient jusqu'au 26 octobre 2026 parmi les cinq plus proches en
 * années du bon, qui s'y désignait sans qu'on regarde le tableau (la tablée du
 * 25 octobre 2026).
 */
export const TITRES_DU_DETAIL = 4
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
/** Le Filet : la marche des questions qu'il pose, et ce que l'enjeu y ajoute (`MARCHES_DES_ENJEUX`). */
export const MARCHES_DU_FILET: readonly Niveau[] = ['facile', 'moyen']

/**
 * Le Pari : garder ses étoiles, ou les parier sur une question plus difficile —
 * réussie, ★★★ ; ratée, rien. Garder en valait une jusqu'au calibrage du
 * 25 octobre 2026 : trois manches gardées faisaient trois étoiles, et une
 * commune exigeait trois premières questions justes et un pari gagné sur une
 * question difficile — 3,1 % des parties de l'occasionnel. À deux, trois
 * premières justes la font : 24,6 %, au hasard 3,7 %, et pas un confetti de
 * plus (une pièce est juste à sa bonne réponse, pas aux étoiles). Ses mots
 * s'accordent au nombre d'ici, d'une seule source (`MOTS_DU_PARI`).
 */
export const ETOILES_DU_PARI: Readonly<Record<'garder' | 'parier', number>> = { garder: 2, parier: 3 }
/**
 * Le Pari : la marche mesurée de sa première question — et ce que l'enjeu y
 * ajoute (`MARCHES_DES_ENJEUX`) —, puis de celle du pari : « difficile » doit
 * l'être vraiment.
 */
export const MARCHES_DU_PARI: Readonly<Record<'question' | 'pari', readonly Niveau[]>> = { question: ['facile', 'moyen'], pari: ['difficile', 'expert'] }

/** L'Éclair : ses affirmations, d'une même catégorie. */
export const AFFIRMATIONS_DE_L_ECLAIR = 5
/** L'Éclair : au moins tant de justes pour ★★★, ★★, ★. */
export const JUSTES_DE_L_ECLAIR: readonly [number, number, number] = [5, 4, 3]
/** L'Éclair : la part des affirmations qui proposent la bonne réponse ; les autres, une des mauvaises. */
export const PART_DES_VRAIES = 0.5
/** L'Éclair : la marche des questions qu'il récrit en affirmations, et ce que l'enjeu y ajoute (`MARCHES_DES_ENJEUX`). */
export const MARCHES_DE_L_ECLAIR: readonly Niveau[] = ['facile', 'moyen']

/**
 * Le Quiz : les questions d'une manche, quatre réponses chacune, sur le thème
 * de l'épreuve — une catégorie, un sujet, une rubrique. Le jeu des questions
 * « classiques » que le propriétaire voulait sur tous les thèmes (le
 * 1er novembre 2026) : quatre, pour qu'une manche répondue au hasard ne vaille
 * ★★ qu'une fois sur vingt (5 %) — à trois questions, une fois sur six.
 */
export const QUESTIONS_DU_QUIZ = 4
/** Le Quiz : au moins tant de justes pour ★★★, ★★, ★ — sans faute, une erreur, deux. Au hasard, ★ une manche sur quatre. */
export const JUSTES_DU_QUIZ: readonly [number, number, number] = [4, 3, 2]
/** Le Quiz : la marche de ses questions hors d'une traversée — dans une traversée, celle de l'acte (`MARCHES_DES_ACTES`). */
export const MARCHES_DU_QUIZ: readonly Niveau[] = ['facile', 'moyen']
/**
 * Le Quiz : les QCM du Cabinet qu'un sujet ou une rubrique doit avoir, au
 * moins, pour qu'une épreuve de la carte le promette — trois manches de quatre
 * et leurs rechanges, sans reposer la semaine ce qu'il a déjà vu. Sous ce
 * nombre, il n'est pas proposé : une épreuve promise qui joue un autre thème
 * mentirait.
 */
export const QCM_D_UN_THEME_DU_QUIZ = 40

/**
 * Les Indices : au plus tant d'indices comptés pour ★★★, puis ★★ ; au-delà, ★
 * — les indices vus, moins ceux qu'Éclairer offre, plus les erreurs. Élargi à
 * trois et quatre au calibrage du 25 octobre 2026, sur un modèle où le rang
 * où l'on reconnaît ne suivait pas la force : l'élargissement profitait au
 * joueur fort plus qu'à l'occasionnel, et la tablée du même soir y faisait
 * presque toujours neuf sur neuf. Resserré le lendemain à deux pour ★★★ —
 * reconnaître au premier ou au deuxième indice —, la pièce juste gardée à
 * quatre au compte : un indice puis une erreur la font toujours.
 */
export const INDICES_DES_ETOILES: readonly [number, number] = [2, 4]
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

/** Le Mot mystère : la marche des questions dont il cache la réponse, et ce que l'enjeu y ajoute (`MARCHES_DES_ENJEUX`). */
export const MARCHES_DU_MOT: readonly Niveau[] = ['facile', 'moyen']
/**
 * La marche suit l'enjeu : ce qu'une partie ajoute aux marches des jeux qui
 * posent des questions de la base — la première question du Pari, l'Éclair, le
 * Mot mystère, le Filet —, selon l'œuvre qu'elle vise (`marchesDeLEnjeu`). Une
 * épique, et une partie pour dorer, y ajoutent le difficile ; une commune, une
 * rare, une maudite, une partie libre restent faciles ou moyennes. Jusqu'au
 * 26 octobre 2026, une épique tirait les mêmes marches qu'une commune, et 47 %
 * de la base — difficile ou experte — ne sortait jamais de ces quatre jeux
 * (la tablée du 25 octobre 2026) ; durcir pour tous aurait fermé l'occasionnel
 * plus que tendu le joueur fort. Tirée au départ, avec le plan : une partie
 * commencée garde ses questions.
 */
export const MARCHES_DES_ENJEUX: Readonly<Record<Rarete | 'dorer', readonly Niveau[]>> = { commun: [], rare: [], maudit: [], epique: ['difficile'], dorer: ['difficile'] }
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

// ── La traversée : trois actes, trois gardiens ────────────────────────────
// Le Cabinet en trois actes (le propriétaire, le 31 octobre 2026 ; la maquette
// jouée, `retours/2026-10-31/la-partie.md`) : une carte à chemins par acte,
// des épreuves de trois manches, un coffre, un marchand, un gardien. Quatre
// notions, pas une de plus — les cœurs, l'or, tes cartes, la carte. Ce qui se
// joue se fige au départ de la traversée (la carte, ses jeux, ses thèmes, ses
// gardiens) ; l'or et les cœurs se relisent de ses gestes au barème de sa
// version : un chiffre changé vaut aussi pour la traversée en cours, qui ne
// dure qu'une soirée — sauf s'il pouvait la perdre après coup (un cœur de moins
// au départ) ou refuser un achat déjà fait : il monte alors la version, et
// celle d'avant garde ses chiffres (`traversee.ts`). Rien n'en sort que le
// légendaire choisi au bout, rangé une fois pour toutes (invariant 22).

/** Les actes d'une traversée : un gardien au bout de chacun. */
export const ACTES_D_UNE_TRAVERSEE = 3
/** Les rangées d'étapes d'un acte, avant le marchand et le gardien… */
export const RANGEES_D_UN_ACTE = 3
/** … les chemins de chaque rangée, qui filent tout droit et se croisent par des diagonales… */
export const CHEMINS_D_UNE_RANGEE = 3
/** … et la rangée où l'une des étapes est un coffre (la deuxième). */
export const RANGEE_DU_COFFRE = 2
/** Les cartes choisies au départ parmi les dix : les seules de la traversée — on les améliore, on n'en gagne pas d'autre. */
export const CARTES_D_UNE_TRAVERSEE = 3
// Le 1er novembre 2026, la traversée était trop facile — le joueur moyen du calibrage en gagnait quatre sur cinq, le fort
// toutes, ses trois cartes au plus haut dès le deuxième gardien —, et « je ne veux pas qu'on rende les cartes inutiles ou
// tous les mêmes » (le propriétaire) : la version 2 de la traversée (`VERSIONS_DE_LA_TRAVERSEE`) ne touche à aucune
// carte. Un cœur de moins au départ, une étoile qui paie moins, les gardiens des actes II et III plus solides, et la
// carte ++ qui ne s'achète que chez le marchand : le moyen en gagne une sur trois, le fort huit sur dix — la cible de
// l'Expédition —, et toutes ses cartes au plus haut se méritent au dernier gardien (`calibrage-cabinet.ts --sections
// traversee`, ses chiffres dans `baremes.md`). La version 1 garde les siens, écrits en dur dans `traversee.ts`.

/** Les cœurs au départ, sans la Panacée : une manche ratée en coûte un. Cinq jusqu'à la version 2. */
export const COEURS_DE_DEPART = 4
/** L'or de chaque étoile gagnée à une manche : douze pièces pour une manche parfaite. Cinq par étoile jusqu'à la version 2. */
export const OR_PAR_ETOILE = 4
/** L'or d'un gardien vaincu, qui rend aussi les cœurs au complet et offre une amélioration. */
export const OR_D_UN_GARDIEN = 30
/** L'or d'une amélioration offerte (un coffre, un gardien) qu'aucune de ses cartes ne peut plus prendre. */
export const OR_SANS_AMELIORATION = 40
/**
 * Ce qu'une amélioration offerte — le coffre, le gardien vaincu — donne au plus : la carte +. La carte ++ ne
 * s'achète que chez le marchand (`PRIX_DU_MARCHAND.auPlusHaut`) : offerte, elle montait les trois cartes au plus
 * haut avant le dernier acte. Jusqu'à la version 2, une amélioration offerte allait jusqu'au plus haut.
 */
export const NIVEAU_OFFERT: Force = 2
/** Les points de vie des trois gardiens, acte par acte : chaque étoile gagnée contre lui en retire un. 6, 8, 10 jusqu'à la version 2. */
export const PV_DES_GARDIENS: readonly [number, number, number] = [6, 15, 22]
/** Le marchand, avant chaque gardien : un cœur, une amélioration vers la carte +, et vers la carte ++ — 45 aussi jusqu'à la version 2. */
export const PRIX_DU_MARCHAND: Readonly<Record<'coeur' | 'amelioration' | 'auPlusHaut', number>> = { coeur: 25, amelioration: 45, auPlusHaut: 150 }
/** Un prix ne descend jamais sous tant de pièces, Pourboire compris. */
export const PRIX_MIN = 5
/** Les marches des épreuves, acte par acte : la première tire, les suivantes la valent (`tirerDesQuestions`). */
export const MARCHES_DES_ACTES: readonly (readonly Niveau[])[] = [['facile'], ['moyen'], ['difficile']]
/** … et celles des gardiens, un cran au-dessus. */
export const MARCHES_DES_GARDIENS: readonly (readonly Niveau[])[] = [['moyen'], ['difficile'], ['difficile', 'expert']]
/** Quitte ou double : les mises par épreuve, niveau par niveau… */
export const MISES_PAR_EPREUVE: Readonly<Record<Force, number>> = { 1: 1, 2: 1, 3: 2 }
/** … ce qu'une mise gagnée multiplie — l'or de sa manche, et ses coups contre un gardien… */
export const MULTIPLICATEUR_DE_LA_MISE: Readonly<Record<Force, number>> = { 1: 2, 2: 3, 3: 3 }
/** … et les cœurs qu'une mise perdue coûte. */
export const COEURS_D_UNE_MISE_PERDUE = 2
/** Parade : les manches ratées qui ne coûtent rien, à chaque épreuve… */
export const ERREURS_PAREES: Readonly<Record<Force, number>> = { 1: 1, 2: 1, 3: 2 }
/** … et le niveau dès lequel elle pare aussi contre les gardiens. */
export const PARADE_CONTRE_LES_GARDIENS: Force = 2
/** Cagnotte : l'or de plus à chaque manche gagnée. */
export const OR_DE_LA_CAGNOTTE: Readonly<Record<Force, number>> = { 1: 5, 2: 10, 3: 15 }
/** Panacée : les cœurs de plus au maximum. */
export const COEURS_DE_LA_PANACEE: Readonly<Record<Force, number>> = { 1: 1, 2: 2, 3: 3 }
/** Pourboire : la remise sur chaque achat. */
export const REMISE_DU_POURBOIRE: Readonly<Record<Force, number>> = { 1: 10, 2: 20, 3: 30 }
/** Coup de grâce : les points de vie que chaque gardien a en moins (un au moins). */
export const PV_DU_COUP_DE_GRACE: Readonly<Record<Force, number>> = { 1: 2, 2: 3, 3: 4 }
/** Second souffle : les cœurs qu'on retrouve au dernier perdu, une fois par traversée ; null : tous. */
export const COEURS_DU_SECOND_SOUFFLE: Readonly<Record<Force, number | null>> = { 1: 2, 2: 4, 3: null }
/**
 * Les thèmes qu'une épreuve du Quiz propose au choix, sur la carte — on en choisit un en y entrant (le propriétaire, le
 * 1er novembre 2026 : « C'est possible que les QCM, ce soit des nodes où on doit choisir entre plusieurs thèmes ? »).
 */
export const THEMES_AU_CHOIX_DU_QUIZ = 3
/** Ce qu'un jeu peut faire d'épreuves dans une traversée, au plus — le contenu écrit à la main ; les autres n'ont pas de plafond. */
export const EPREUVES_D_UN_JEU_MAX: Readonly<Partial<Record<CleDeJeu, number>>> = { frise: 3, epingle: 4, detail: 3, indices: 3, replique: 3 }
