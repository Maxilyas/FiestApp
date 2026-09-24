# Retour de Lucas — 16 ans, iPhone

## En une phrase
Une bonne soirée, bien rythmée, où j'ai fini 2e sans prix — mais un bouton retour qui m'a viré sur une page blanche et un pseudo massacré à l'entrée m'ont un peu gâché l'arrivée.

## Mon parcours
J'ai scanné dès que l'écran de Nadia s'est allumé (elle a mis un moment à le lancer, mais bon, c'est elle qui gère). Direct "Jouer sans compte", j'ai tapé un pseudo bien stylé avec des flammes, avatar couronne parce que je suis venu pour gagner. Nadia m'a mis chez les Carbonara puis m'a bougé chez les Randonneurs pour équilibrer les équipes, pas grave. Le quiz "Spécial Sam" a démarré avec 9 questions sur le tonton de la soirée : un peu de rock, de cuisine, de géo, une question photo à mémoriser (le gâteau), une estimation en kilomètres. J'ai répondu vite à chaque fois, changé d'avis une fois pour tester, cliqué deux fois la même réponse une autre fois, essayé le bouton retour du téléphone en pleine question (mauvaise surprise), et ouvert un deuxième onglet pour voir si je pouvais jouer en double (non, ça m'a juste montré la même chose). Résultat : 2e sur 7 avec 1501 pts, derrière Camille qui a tout raflé. Après le quiz il y a eu la remise des prix (aucun pour moi, la loose), puis Nadia a clos la soirée direct après. J'ai fouillé le souvenir et mon bilan question par question en détail pour voir si j'avais été le plus rapide quelque part — jamais, toujours Sofia ou Camille (2) devant moi de quelques dixièmes.

## Ce qui m'a plu
- Ça va vite : scanner, taper son prénom, choisir un avatar, et hop on est dans la salle. Pas besoin de compte pour jouer.
- Le podium et le classement de la soirée sont hyper clairs, avec les couronnes et tout, ça donne envie de gagner.
- Mon bilan détaillé après coup : je vois question par question ce que j'ai répondu, en combien de temps, ce que la salle et mon équipe ont choisi, et qui était le plus rapide. J'ai adoré fouiller ça.
- Le classement dit que je suis 1er de mon équipe (Les Randonneurs) même si je suis 2e au général — ça console un peu.
- Nadia qui chambre à l'oral pendant le quiz ("pas si boss"), l'ambiance est bonne.

## Ce qui m'a gêné
- **Où** : en pleine question 6, j'ai appuyé sur le bouton retour du téléphone (comme n'importe qui pourrait le faire par réflexe ou par erreur).
  **Ce que j'attendais** : revenir à l'écran d'avant, ou au pire rester sur la question.
  **Ce qui s'est passé** : mon écran est devenu complètement blanc, plus aucun texte, plus aucun bouton — j'étais sorti de l'appli. J'ai dû retaper l'adresse de la soirée moi-même pour revenir (et là ça a remarché, remis pile sur la bonne question, donc au moins je n'ai rien perdu).
  **Gravité** : gênant — si je n'avais pas su qu'il fallait retaper l'adresse, j'étais bloqué dehors en pleine partie.
  **Captures** : `/home/user/FiestApp/export/tablee/2026-09-23-21h14/captures/lucas/006-retour-page-blanche.png`
- **Où** : l'écran d'entrée, en tapant mon pseudo (celui avec les flammes et les emojis).
  **Ce que j'attendais** : soit que ça accepte mon pseudo en entier, soit qu'on me dise clairement "trop long".
  **Ce qui s'est passé** : le champ a coupé mon pseudo tout seul sans rien dire (silencieux), et une fois dans la salle d'attente, le nom affiché en haut de mon écran déborde carrément hors du cadre du téléphone (pas de "…", juste coupé par le bord), alors que dans le classement juste en dessous le même nom est proprement coupé avec des points de suspension. Les deux endroits ne gèrent pas le nom trop long de la même façon.
  **Gravité** : détail — mais ça fait un peu bricolé, et perso j'étais déçu de perdre mon pseudo stylé sans explication.
  **Captures** : `/home/user/FiestApp/export/tablee/2026-09-23-21h14/captures/lucas/002-pseudo-enorme.png` et `/home/user/FiestApp/export/tablee/2026-09-23-21h14/captures/lucas/003-salle-attente.png`
- **Où** : sur plusieurs questions, juste après avoir touché une réponse (question 1 en changeant d'avis, question 4, question 5).
  **Ce que j'attendais** : que le jeu me confirme tout de suite que mon clic est pris en compte.
  **Ce qui s'est passé** : le message "réponse enregistrée" n'était pas encore affiché juste après le clic (revérifié une seconde après, c'était bon). Ça ne m'a jamais fait louper de points, mais sur le coup je n'étais pas sûr d'avoir bien cliqué.
  **Gravité** : détail — surtout gênant pour le stress au moment du clic.
  **Captures** : aucune, c'était trop rapide pour en prendre une.

## Bugs constatés
- Le bouton retour du navigateur, pendant une question, ramène sur `about:blank` (page totalement vide, hors de l'application), au lieu de rester dans l'appli ou d'afficher un message. Reproduit une fois pendant la question 6 du quiz. Rouvrir directement l'adresse de la soirée (`/chez-nadia`) restaure bien la session et remet sur la question en cours, donc rien n'est perdu côté données — mais rien à l'écran n'indique quoi faire pendant qu'on est sur la page blanche. Capture : `/home/user/FiestApp/export/tablee/2026-09-23-21h14/captures/lucas/006-retour-page-blanche.png`. Rien dans `console` à ce moment-là (pas d'erreur JS).
- Dans la page Souvenir de la soirée, section "Les équipes au quiz", le nom de mon équipe est affiché "Les Randonneur" (sans le "s" final) alors que partout ailleurs sur le site c'est bien "Les Randonneurs". On dirait une troncature d'un caractère de trop dans cette carte précise. Capture : `/home/user/FiestApp/export/tablee/2026-09-23-21h14/captures/lucas/012-souvenir-palmares.png` (en haut de l'image).
- Le pilote a signalé deux fois (question 1 après un changement de réponse à 19,9 s, question 4 à 5,8 s, question 5 à 6,7 s) que l'écran n'affichait pas encore la réponse comme enregistrée juste après le clic, alors que la relecture de l'écran juste après montrait bien "Réponse enregistrée". `console` n'a rien signalé d'anormal (les deux seules lignes présentes sont des 401 normaux sur `/api/auth/me`, un joueur sans compte). Pas systématique : ça ne s'est pas produit sur toutes les réponses rapides (ex. question 6 à 5,7 s, rien à signaler).

## Mes idées
1. Empêcher le bouton retour du téléphone de sortir complètement de l'appli pendant une partie — ou au moins mettre quelque chose sur cette page vide (un bouton "Revenir à la soirée") pour ceux qui ne pensent pas à retaper l'adresse.
2. Prévenir tout de suite quand le pseudo tapé est trop long (par exemple en bloquant la frappe une fois la limite atteinte, plutôt que de couper après coup sans le dire), et harmoniser l'affichage d'un nom trop long partout (soit toujours avec "…", soit toujours sur plusieurs lignes — jamais un débordement brut hors du cadre).
3. Un prix "vitesse" qui tienne compte de la régularité et pas seulement du meilleur temps unique, pour les gens qui répondent vite sur toutes les questions sans jamais être le numéro 1 sur une seule (je n'ai eu ni L'Éclair ni aucun autre prix alors que j'ai été plutôt rapide toute la soirée).

## Mes notes
- Entrer dans la soirée : 4/5
- Plaisir de jeu : 4/5
- Lisibilité — textes, boutons, couleurs : 4/5
- Envie de revenir, de recommander : 5/5
