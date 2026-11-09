# Retour de Camille — 45 ans, téléphone Android (vision deutéranopie)

## En une phrase
Une soirée agréable où je n'ai jamais été perdue côté couleurs (les formes sauvent tout), mais la question des poumons rejouée n'est jamais arrivée sur mon téléphone, et je n'ai pas vu la situation « deux Camille » que je voulais regarder (il n'y avait qu'une seule Camille, avec Karim en chat).

## Mon parcours
- Avant : j'ai attendu 9 min qu'une autre « Camille » apparaisse (jamais venue), puis `scanner`. Écran d'entrée : Jouer sans compte / Me connecter / Créer un profil.
- Arrivée : connexion avec mon profil (camille.d) sans souci, puis choix d'équipe (Pizzaïolos), « Rejoindre la soirée ». Salle d'attente : classement avec tout le monde à 0, « En attente du prochain quiz… ».
- Jeu (quiz 1, 10 questions) : réponses rapides, bien lisibles. Questions pop culture (My Fair Lady, Bee Gees) : je devine et me trompe, comme ma fiche. Estimations à 450 g (pile) et 2700 m (à 6 m près) très satisfaisantes.
- Incident : Q6 (poumons) révélée trop tôt par Nadia, puis « reposée » : mon téléphone est resté sur la révélation, Nadia a annulé la question. Sofia a vécu la même chose.
- Podium : 5e, 1315 pts. Quiz 2 « Spécial Sam » (4 questions) : 1 juste (tiramisu, au hasard), 2 fausses, 1 estimation à 112 km.
- Fin de soirée : 6e sur 7, 1630 pts, +50 XP, 2 trophées (le Cancre Magnifique, le Franc-Tireur : drôle). Bilan complet, page profil.

## Ce qui m'a plu
- Les réponses ont une forme (triangle, losange, rond, carré) : je n'ai jamais eu à distinguer vert et rouge.
- La révélation sur le téléphone dit en toutes lettres « Raté… tu avais dit X » et « La bonne réponse : Y » avec la forme. Très clair sans couleur.
- Le « Le saviez-vous ? », la ligne « 5 sur 6 ont trouvé », le classement des plus rapides avec mon nom surligné.
- Connexion au profil depuis l'entrée simple, mon renard 🦊 et mon niveau reconnus.
- Fin de soirée et bilan généreux, ton léger.

## Ce qui m'a gêné
- **Où** : question rejouée (Q6, poumons), téléphone. **Attendu** : revoir la question et répondre. **Arrivé** : mon écran est resté sur la révélation « Pas de réponse à cette question », sans signe que la question était rejouée ; il a fallu que je le dise à voix haute. **Gravité** : gênant (question perdue pour plusieurs). **Captures** : /home/user/FiestApp/export/tablee/2026-11-09-20h22/captures/camille-d/008-rev6.png
- **Où** : révélation de la Q6, « La bonne réponse : 2 » avec un rond bleu. **Attendu** : le texte de la réponse comme ailleurs. **Arrivé** : un simple « 2 », ambigu (numéro de l'option ou valeur ?). **Gravité** : détail. Même capture.
- **Où** : télé, podium, « Les équipes après ce quiz ». Pizzaïolos : « 2 membres · 2535 pts au total » mais « 1368 points d'équipe » (moyenne ?). **Attendu** : un chiffre qui se comprenne. **Gravité** : détail. Capture : .../captures/camille-d/010-tele.png
- **Où** : choix d'équipe, deux équipes qui ne se distinguent que par l'emoji et le texte ; correct sans couleur, mais pas de forme/label d'équipe sur ma ligne de classement (juste un petit emoji 🌶️ à côté du nom, petit). **Gravité** : détail. Capture : .../captures/camille-d/009-podium.png
- **Où** : question Vrai/Faux. Triangle gris pour Vrai, losange doré pour Faux : seuls un gris et un doré les différencient, les formes aident, mais les boutons ne sont pas franchement colorés/contrastés. **Gravité** : détail. Capture : .../captures/camille-d/012-vf.png
- **Où** : écran de fin, « 4 réponses fausses » mais j'en ai eu moins que ça sur 14 questions (je n'en ai pas compté 4 exactement : 3 fausses au quiz 1 dont une non répondue, 2 au quiz 2) — trophée peut-être compté sur la question annulée. À vérifier. **Gravité** : détail.

## Bugs constatés
- Question rejouée non reproposée sur le téléphone (Camille et Sofia) : étapes : l'animatrice révèle trop tôt (Q6), puis repose la question ; attendu : l'écran de réponse revient ; obtenu : l'écran reste sur la révélation « Pas de réponse à cette question ». Captures : 008-rev6.png. `console` : rien signalé.
- `console` n'a signalé que deux 401 sur `/api/auth/me` (avant connexion, normal).
- Je n'ai pas pu observer le cas « deux Camille au même renard » : personne d'autre ne s'est présenté sous ce prénom.

## Mes idées
- Quand une question est rejouée, afficher clairement sur tous les téléphones « La question est reposée » et rouvrir les réponses.
- Écrire le texte de la bonne réponse même pour les questions à chiffres/options numériques.
- Clarifier « au total » vs « points d'équipe » sur la télé.
- Doubler les couleurs par la forme partout (déjà bien fait aux réponses) y compris les équipes (forme/icône plus grande dans le classement).
- Permettre de choisir/changer d'équipe plus tard (plusieurs invités n'ont pas vu le bouton « Changer »).

## Mes notes
- Entrer dans la soirée : 4/5
- Plaisir de jeu (ou d'animer) : 4/5
- Lisibilité — textes, boutons, couleurs : 4/5
- Envie de revenir, de recommander : 4/5
