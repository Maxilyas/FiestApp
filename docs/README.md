# La documentation de FiestApp

> FiestApp est un quiz de soirée auto-hébergé : un écran commun pour la salle, le téléphone de chacun pour répondre, et rien à installer. Entre deux soirées, les joueurs qui ont un profil continuent au quiz du jour, en campagne, sur les sentiers du savoir et en duel. Cette documentation dit ce que fait l'application et comment elle est construite, telle qu'elle est dans le code aujourd'hui.

Pour une présentation en images, ouvre [la vitrine](https://maxilyas.github.io/FiestApp/) : `docs/vitrine/`, publiée sur GitHub Pages à chaque fusion sur `main` qui la touche ([la mise en ligne](exploitation/mise-en-ligne.md#11-la-vitrine-sur-github-pages)).

## Par où commencer

| Tu veux… | Lis |
|---|---|
| Comprendre ce qu'est FiestApp en cinq minutes | [FiestApp en une page](produit/vue-d-ensemble.md) |
| Lancer l'application chez toi et jouer un premier quiz | [La première soirée](guides/premiere-soiree.md) |
| Animer une vraie soirée | [Animer une soirée](guides/animer-une-soiree.md) |
| Expliquer le jeu à tes invités | [Jouer](guides/jouer.md) |
| Mettre FiestApp en ligne, gratuitement | [La mise en ligne](exploitation/mise-en-ligne.md) |
| Veiller sur le serveur et sur les joueurs | [Administrer](guides/administrer.md) · [Exploiter](exploitation/exploiter.md) |
| Modifier le code | [Démarrer](contribuer/demarrer.md), puis [la vue d'ensemble de l'architecture](architecture/vue-d-ensemble.md) |
| Retrouver une route, un événement, une table, une constante | [La référence](#la-référence) |

## Le produit

Ce que fait FiestApp, mode par mode, pour tout le monde — le code n'y vient qu'en fin de page, dans « Comment c'est construit ».

- [FiestApp en une page](produit/vue-d-ensemble.md) — les modes de jeu, les publics, les partis pris, la carte des pages
- [La soirée](produit/la-soiree.md) — de la salle d'attente au podium : le cycle d'une question, les équipes, le programme
- [Les questions](produit/les-questions.md) — chaque sorte de question, ce que voient l'invité et la salle, comment elle se note
- [Après la soirée](produit/apres-la-soiree.md) — la clôture, la fin de soirée sur chaque téléphone et son écran des gains, le souvenir, le bilan, les prix, l'historique
- [Les quiz](produit/les-quiz.md) — la bibliothèque : écrire, coller une liste, importer, partager, les modèles, le quiz tout prêt
- [Le quiz du jour](produit/le-quiz-du-jour.md) — dix questions par jour, la série, le classement, le calendrier, le rappel du soir
- [La campagne](produit/la-campagne.md) — les séries, le carnet de révision, le défi de la semaine, la base de questions
- [Les sentiers du savoir](produit/les-sentiers-du-savoir.md) — les branches, les paliers, les vies, les portraits à gagner
- [Les duels](produit/les-duels.md) — la cote, les ligues, Automate, les défis entre amis
- [Le profil](produit/le-profil.md) — l'accueil, la loge, la collection, la carrière, la carte d'un joueur, la sécurité du profil
- [Les récompenses](produit/les-recompenses.md) — l'expérience, les niveaux, les trophées et leurs pistes, les légendaires, les Divins, les écussons
- [La boutique](produit/la-boutique.md) — les confettis, ce qu'ils achètent, et le catalogue : thèmes, fonds, gerbes, compagnons
- [Les missions du jour](produit/les-missions.md) — trois missions par jour, la carte à tampons, le coffre de la semaine et son trésor, « À la une »

## Les guides

Pas à pas, pour une tâche précise.

- [La première soirée](guides/premiere-soiree.md) — de zéro à un quiz joué avec de vrais téléphones, en local
- [Animer une soirée](guides/animer-une-soiree.md) — avant, le jour J, pendant (la console, les imprévus), après
- [Jouer](guides/jouer.md) — pour les invités : rejoindre, répondre, retrouver sa place, garder sa progression
- [Administrer](guides/administrer.md) — le QG : surveiller, aider un joueur, modérer, veiller sur les salons et sur les réserves de questions

## L'architecture

Comment c'est construit, et pourquoi.

- [Vue d'ensemble](architecture/vue-d-ensemble.md) — le système d'un coup d'œil, les couches, le chemin d'une réponse, les principes
- [Le serveur](architecture/serveur.md) — le démarrage, les registres et les magasins, le moteur, l'organisation des routes
- [Le temps réel](architecture/temps-reel.md) — la liaison Socket.io, l'instantané, les vues filtrées, l'horloge, les accusés
- [Les données](architecture/donnees.md) — les deux bases, les journaux, le miroir, les archives, les dérivations, le recalcul
- [Le client](architecture/client.md) — l'application React : les pages, le routage, le chargement, l'état, l'installation, les thèmes
- [La sécurité](architecture/securite.md) — les comptes, les sessions, les limites, le cloisonnement, ce qui ne quitte jamais le serveur
- [Les décisions](architecture/decisions.md) — les choix structurants et leur pourquoi

## La référence

Exhaustive, et gardée pour l'essentiel par un test qui la relit contre le code.

- [Les adresses](reference/adresses.md) — chaque page de l'application
- [L'API HTTP](reference/api-http.md) — chaque route : méthode, chemin, accès, rôle
- [Les événements temps réel](reference/evenements-temps-reel.md) — chaque message Socket.io, dans les deux sens
- [La base de données](reference/base-de-donnees.md) — chaque table, de la base locale et de la base permanente
- [La configuration](reference/configuration.md) — chaque variable d'environnement
- [Les commandes](reference/commandes.md) — chaque script npm et chaque outil de `server/scripts/`
- [Les barèmes](reference/baremes.md) — chaque constante de produit : sa valeur, son fichier, ce que la changer implique
- [Le glossaire](reference/glossaire.md) — le vocabulaire de FiestApp, et son nom dans le code

## L'exploitation

- [La mise en ligne](exploitation/mise-en-ligne.md) — Render et Turso, pas à pas : production, préproduction, veille, routine du matin
- [Exploiter](exploitation/exploiter.md) — surveiller, sauvegarder, restaurer, dépanner, et le repli tout en local

## Contribuer

- [Démarrer](contribuer/demarrer.md) — installer, lancer, le tour du dépôt, le cycle d'une modification
- [Les conventions](contribuer/conventions.md) — le code, les commentaires, les noms, les textes, le CSS
- [Les tests](contribuer/tests.md) — `npm run verify`, le banc d'essai, écrire un test, les pièges
- [Les recettes](contribuer/recettes.md) — faire évoluer : une sorte de question, un trophée, un thème, une route, une table…
- [Travailler avec Claude](contribuer/outillage-claude.md) — la mémoire du dépôt, les règles, les skills, la tablée
- [L'historique](contribuer/historique.md) — ce qui a été livré, et les chemins ouverts

## Comment cette documentation reste juste

Elle a été réécrite le 14 octobre 2026 à partir du code, domaine par domaine, chaque affirmation vérifiée contre sa source. Ce qui peut se vérifier sans la relire l'est à chaque `npm test`, par `server/test/documentation.test.ts` : chaque fichier cité existe, chaque lien mène à une page, chaque route, événement, variable d'environnement, table et adresse de l'application a sa ligne dans la référence — et, adresses mises à part, aucune ligne n'y survit à ce qu'elle décrit —, et chaque barème numérique de [la page des barèmes](reference/baremes.md) vaut bien ce que dit le code.

Le reste tient à une habitude : **une modification qui change un comportement change la page qui le décrit, dans la même proposition de modification.** Chaque page dit, dans sa section « Comment c'est construit » ou ses chemins cités, où vit ce qu'elle décrit.

Les agents qui travaillent sur le dépôt ont leur propre mémoire, plus courte : `CLAUDE.md` et les règles de `.claude/rules/` — voir [Travailler avec Claude](contribuer/outillage-claude.md).
