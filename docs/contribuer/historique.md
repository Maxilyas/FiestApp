# L'historique

> Ce qui a été livré, lot après lot, depuis les fondations de FiestApp, et les chemins que le code laisse ouverts. Pour qui veut comprendre d'où vient une fonctionnalité, ou pourquoi elle est faite ainsi.

Les détails de chaque livraison vivent dans sa proposition de modification sur GitHub (`Maxilyas/FiestApp`, onglet « Pull requests ») et dans les rapports datés de [`retours/`](../../retours/) — retours des tablées d'agents, audits d'experts et leur vérification. Cette page en donne le fil.

## En bref

| Période | Ce qui est arrivé |
|---|---|
| Les fondations | Le quiz en soirée : écran commun, téléphones, bibliothèque, équipes, statistiques et prix |
| 19 – 22 septembre 2026 | Le bilan, l'historique, les comptes et les espaces, les profils, l'intégration continue |
| 23 – 25 septembre | Les récompenses, la télécommande, les Divins, deux tablées d'agents, les nouvelles sortes de questions |
| 26 – 29 septembre | Le quiz du jour, la collection, les avatars du savoir, les médaillons peints, les confettis et les thèmes |
| 3 – 6 octobre | La nouvelle architecture du joueur, la campagne, les sentiers du savoir, le rappel du soir |
| 10 – 11 octobre | La base de la campagne en milliers de questions, les duels, le quiz tout prêt, les défis entre amis |
| 12 – 13 octobre | La télé branchée, la loge, les bordures de ligue, Automate, les compagnons, le QG, l'album des trophées et l'écran des gains |

Près de deux cents propositions de modification ont été fusionnées entre le 19 septembre et le 13 octobre 2026, chacune vérifiée par l'intégration continue (`.github/workflows/ci.yml`).

## Les fondations

Avant la première proposition de modification suivie sur GitHub, douze lots ont posé l'application :

1. Le nettoyage : une application cent pour cent quiz.
2. La bibliothèque en base, et l'éditeur de quiz dans le navigateur.
3. Les questions d'estimation, l'entrée en cours de quiz, les révélations enrichies.
4. L'habillage de spectacle : le mode scène, la barre de temps, le podium animé, les sons.
5. Le déploiement gratuit (Render et Turso), le QR code public, un test de charge à cinquante joueurs.
6. Des scores à l'abri d'un redémarrage, un écran commun qui tient dans la hauteur.
7. Les commandes d'animation : la pause, la question reposée, les invités gérés.
8. Le podium de la soirée et la page souvenir.
9. L'import en masse, l'aperçu, la veille des téléphones, les prénoms en double.
10. Les équipes : points individuels, classement collectif, barème des équipes.
11. La photo à mémoriser, et les classements annoncés entre deux questions.
12. Le journal des réponses, les statistiques, les prix de fin de soirée et l'écran de victoire.

## Septembre 2026 : la soirée devient un produit

**19 – 22 septembre.** Ivoire, le thème clair de l'écran commun, pour les vidéoprojecteurs (n° 1). Le bilan question par question (n° 2) et l'historique des soirées (n° 3). Les comptes et les espaces : un animateur par compte, chacun chez soi (n° 4), puis les pages publiques reliées et la suppression d'un compte (n° 5). Les réponses qui se perdaient — accusé de réception, heure du serveur, marges de fin de question —, les profils joueurs et les badges (n° 9). Un filet et une mémoire pour le dépôt : l'intégration continue et `CLAUDE.md` (n° 10). Deux environnements, production et préproduction (n° 11). L'entrée d'une soirée : se connecter, ou passer — et deux Camille qui se distinguent (n° 12).

**23 septembre.** Les récompenses : « Clore la soirée » et l'historique qui s'écrit seul, une expérience qui se mérite, les hauts faits, les avatars légendaires, la carte d'un joueur, les catégories (n° 16). L'écran commun se pilote depuis un téléphone (n° 18). Les Divins (n° 19). Les légendaires se méritent sur la durée (n° 20). Un barème plus juste : l'estimation paie la distance, le QCM offre le temps de lecture (n° 23). La première tablée : une soirée jouée par des agents, et leurs retours (n° 24).

**24 – 25 septembre.** Les treize axes de la première tablée — l'éditeur, une console aux gestes sûrs, le lendemain d'une soirée, les mots, l'accessibilité, l'écran commun en 1366 × 768, les nombres tapés comme on les écrit, le coup d'œil des estimations (n° 25 à 37). La deuxième tablée : trois soirées en même temps, dix-neuf experts (n° 38), et ses treize axes, de la télécommande au téléphone perdu (n° 39 à 53). La gestion des quiz : le programme de la soirée, le partage, les modèles, et quatre nouvelles sortes de questions — plusieurs réponses, l'ordre, « Qui dans la salle ? », l'estimation en direct — avec le blind test (n° 54). Sa place à chaque révélation (n° 56).

**26 – 29 septembre.** Le quiz du jour et le profil en onglets (n° 58). La collection, les paliers du jour, le Sphinx, le laurier, les écussons, les fonds de carte, les saisons (n° 59). Les avatars du savoir : douze branches, six portraits chacune (n° 63). La production tenue éveillée de 7 h à minuit (n° 64, 69). Les lumières des finitions 15, 20 et 25 (n° 68). Les portraits, les légendaires et les Divins peints (n° 70, 73). Les confettis et trente thèmes pour le téléphone d'un profil, puis leur boutique (n° 75, 76).

## Octobre 2026 : le jeu continue entre deux soirées

**3 – 6 octobre.** La nouvelle architecture du joueur : le salon et son code, le menu, la régie, la campagne (n° 78). Un seul profil par personne : plus d'animateur d'un côté et de joueur de l'autre (n° 84). La campagne a sa propre base de questions ; on peut y signaler une erreur (n° 88). Le rappel du soir du quiz du jour (n° 94, 95). L'application s'installe sur l'écran d'accueil (n° 96). Les sentiers du savoir : les avatars se gagnent dans la campagne (n° 99). Le quiz du jour et la campagne récompensent aussi : champion du mois, calendrier, défi de la semaine, légendaires, thèmes peints et gerbe (n° 104). L'Éclat se tire aussi au quiz du jour et au défi (n° 107). L'affichage des pages, mesuré puis accéléré (n° 108). « Ma collection » (n° 111). Le solo récompense vite (n° 114).

**10 – 11 octobre.** La mémoire de Claude : une racine courte, le détail par domaine (n° 117). Le carnet de révision, les sentiers à thème, la rencontre d'un inconnu (n° 119). La base de la campagne grandit de milliers de questions, dont 1 333 tirées de Wikidata (n° 120 à 130). Les défis entre amis (n° 125, 135). Les duels : une cote, des ligues qui paient chaque lundi (n° 141). Le quiz tout prêt, composé d'un geste dans la base de la campagne, jusqu'à l'écran commun (n° 143 à 145).

**12 – 13 octobre.** La télé branchée par un code (n° 158). Les prix se remettent pour le plaisir (n° 159). Les équipes se préparent avant d'ouvrir le salon (n° 160). Des tirages sans redites (n° 161, 162). La loge : essayer, puis tout porter d'un coup (n° 172 à 175). Les bordures de ligue autour de l'avatar, jusque sur l'écran commun (n° 178, 179). Les duels en cockpit, et Automate, l'adversaire toujours disponible, tenu à deux niveaux du sien (n° 182 à 189). Les compagnons peints et l'album des avatars par rareté (n° 190), puis leur boutique (n° 199). Le modèle du savoir, qui apprend à Automate ce que les joueurs savent (n° 193). La base de la campagne relue une seconde fois et portée à 21 887 questions (n° 194). Le QG de l'administrateur : la vue d'ensemble, le journal des gestes, les soirées (n° 195), la fiche d'un joueur (n° 198), la santé du serveur (n° 201), puis la première page d'un mode, le quiz du jour : son tirage question par question, son classement du mois, ses séries, son rappel du soir (n° 202). Les duels : historique et classement refaits (n° 200). Les trophées, après « très confus, les trophées que les gens gagnent » : un album par mode dans « Ma collection », le même écran des gains à la fin de chaque mode — « Ce que tu gagnes », « Nouveaux trophées », « À porter » —, et des mots fixés : un trophée, bronze · argent · or pour les étapes d'une piste, des étoiles pour la note d'une partie, un palier pour l'étape d'un sentier (n° 203).

**Le 14 octobre.** La documentation réécrite contre le code, rangée par besoin du lecteur dans `docs/`, gardée par `server/test/documentation.test.ts`, et cette vitrine : [`docs/vitrine/index.html`](../vitrine/index.html).

## Ce qui est en chantier

- **Le QG, mode par mode.** Après la vue d'ensemble, le journal, les soirées, la fiche d'un joueur, la santé du serveur et la page du quiz du jour (n° 202), trois pages restent annoncées : la campagne et le réglage des paliers, les duels, l'économie. Elles arrivent une par une.
- **Les trophées.** L'album par mode et l'écran des gains (n° 203) ouvrent une refonte qui continue.
- **La Conquête.** Un brief pour un troisième mode de jeu, et sa maquette, attend une décision ; rien n'en est dans le code.

## Les chemins ouverts

Ce que le code rend naturel, avec ce qu'il en coûterait. Rien n'est promis.

**Un second module de jeu en soirée.** Le moteur ne connaît aucune règle : il route des actions, des commandes et des chronomètres vers un module de jeu, et le quiz en est la seule implémentation (`server/src/games/quiz.ts`). Un autre jeu de salle se poserait dessus ; le coût réel serait dans les vues, les sons et l'écran commun, écrits pour le quiz. Voir [le serveur](../architecture/serveur.md).

**Ce qui n'est volontairement pas fait.** Comparer les soirées d'un espace à l'autre : chaque animateur est chez lui. Seuls les modes que jouent les profils — le quiz du jour, le défi de la semaine, les duels — se classent sur tout le serveur. Une application native : le navigateur suffit, et l'application s'installe depuis lui. Tout ce qui demanderait un hébergement ou une base payants.

## Pour aller plus loin

- [Les décisions](../architecture/decisions.md) — le pourquoi des choix structurants
- [`retours/`](../../retours/) — les rapports datés des tablées et des audits
- [Travailler avec Claude](outillage-claude.md) — comment le dépôt se fait aider, et garde sa mémoire
