# Retour de Hugo — 30 ans, Android + TalkBack (aveugle)

## En une phrase
Le jeu se joue très bien au lecteur d'écran (question, réponse, révélation, podium, bilan sont lisibles), mais plusieurs changements d'écran arrivent sans annonce, je n'ai jamais pu choisir d'équipe, et une question remise par l'animatrice n'est jamais arrivée sur mon téléphone.

## Mon parcours
- Avant : rien. Karim a « scanné » pour moi (`scanner`), l'écran commun a mis longtemps à s'allumer ; arrivée sur « La soirée de Nadia ».
- Entrée : « Jouer sans compte », champ « Ton prénom » correctement étiqueté, bouton « Rejoindre la soirée ». Facile.
- Attente : salle d'attente avec classement et « En attente du prochain quiz… ». Nadia a parlé d'équipes (Randonneurs, Pizzaïolos) : je n'ai rien entendu de tel sur mon téléphone.
- Quiz 1 (10 questions) : réponses rapides, 8 justes sur 10 QCM, deux estimations pile-poil (450 g, 2706 m). 1er du podium avec 1800 pts.
- Question 6 (poumons) : l'animatrice a révélé trop tôt, puis l'a reposée ; mon téléphone est resté sur la révélation (voir gênes).
- Quiz « Spécial Sam » (4 questions) : deviné, 2115 points au total, 2e sur 7.
- Fin de soirée, « Plus » puis « Mon bilan » : tout relu au lecteur.

## Ce qui m'a plu
- Entrée sans compte : champ étiqueté, boutons nommés, avatars « Avatar 🦊 » avec nom clair.
- `question` : énoncé, numéro, catégorie et temps restant (50 s) annoncés ; « Réponse enregistrée · tu peux encore changer » confirme que ma réponse est prise.
- Révélation lisible : « Bien joué ! », « La bonne réponse : … », liste des réponses de la salle avec temps et points, anecdote « Le saviez-vous ? ».
- Podium : `status` « Quiz terminé · 1ʳᵉ place sur 7 · 1800 pts », régions « Le podium des joueurs » et listes. Très bien structuré.
- Bilan : titres (h1, h2, h3 par question), chaque réponse avec « TOI » et « la bonne réponse » en texte, pas seulement en couleur. Très utile pour relire.

## Ce qui m'a gêné
- **Où** : toute la soirée, choix d'équipe (salle d'attente, podium, fin).
  **Attendu** : le bouton « Changer » près de « Les équipes » dont parle Nadia. **Arrivé** : aucun bouton ni choix d'équipe dans `lecteur`, ni pour moi, ni pour Jeanne, Sofia, Lucas. Je suis resté « sans équipe ». Je l'ai dit à voix haute.
  **Gravité** : gênant (on ne sait pas si c'est un bug ou si c'est caché ; l'animatrice ne peut pas le faire à ma place).
  Extrait de la salle d'attente : `heading « Classement de la soirée » [level=3]`, `button « La carte d'Hugo — rang 1, 0 point »`, `paragraph « En attente du prochain quiz… »` — rien sur les équipes.
- **Où** : question 6 reposée après une révélation trop tôt.
  **Attendu** : la question revient sur mon téléphone. **Arrivé** : `question` a indiqué « ton téléphone : revelation » pendant plus de 100 s ; Nadia et Camille ont constaté que la question reposée n'arrivait pas, elle a été annulée. Pour moi, rien n'annonçait qu'il y avait quelque chose à faire.
  **Gravité** : gênant.
- **Où** : tous les changements d'écran (question qui s'ouvre, révélation, podium, fin de soirée).
  **Attendu** : une annonce (zone live). **Arrivé** : je n'ai vu aucune région live/alerte dans `lecteur` pendant les révélations ; le `status` n'apparaît qu'au podium. Avec TalkBack je ne saurais pas qu'une nouvelle question s'est ouverte sans retourner voir. (Ici, `question` simule l'annonce : je n'ai pas pu vérifier ce que ferait vraiment TalkBack.)
  **Gravité** : gênant, probablement le plus important pour moi.
- **Où** : révélation, « Ce quiz : en tête ex æquo, 200 points… » et le « + » séparé de « 200 pts ».
  Extrait : `« + »` puis `« 200 pts »` ; bilan : `strong « Ton plus beau coup : + »` `« 200 pts »`. Lu en deux morceaux. **Gravité** : détail.
- **Où** : bilan, en-tête. Extrait : `« 7 » « joueur » « s » « · » « 13 » « question » « s » « · » « 2 » « quiz »` ; et `« 50 » « S »` pour chaque question (« 50 S » = 50 secondes ?), `« 1ʳᵉ place »`, `« 2ᵉ »`. Les pluriels coupés en deux et les nombres isolés sont lus par fragments. **Gravité** : détail/gênant.
- **Où** : classement, résumé de ligne. Extrait : `button « La carte d'Hugo — rang 1, 0 point »` est bien nommé, mais ses enfants répètent `« Rang » « 1 » « 🍩 » « Hugo » « 0 » « point »` ; les emojis (🍩, 👑, 🌶️) sont lus à voix haute dans les listes. **Gravité** : détail.
- **Où** : fin de soirée, trophées. Extrait : `region « NOUVEAUX TROPHÉES »` puis `« Le Compas dans l'Œil »`, `« Le Pile-Poil »`… en simples textes, pas des titres. Les emojis des trophées sont présents côté bilan (`🔮`, `🎯`, `🐑`). **Gravité** : détail.
- **Où** : fin de soirée, `group` avec `DisclosureTriangle « Plus »` : le lien « Revoir la soirée » est caché derrière ce « Plus » vague. **Gravité** : détail.
- **Où** : plusieurs noms en capitales dans l'arbre (« JOUER SANS COMPTE », « REJOINDRE LA SOIRÉE »). Probablement un style CSS ; je le note au cas où certains lecteurs épellent. **Gravité** : détail.

Je n'ai pas fait de captures (je ne vois pas l'écran).

## Bugs constatés
- Question reposée non reçue par le téléphone : étapes — l'animatrice révèle trop tôt la Q6 puis la « repose ». Attendu : mon téléphone repasse en question ouverte. Obtenu : il reste sur la révélation (`question` : « ton téléphone : revelation »), idem chez Camille. Bilan : la Q6 n'y figure pas (Q5 puis Q7), 13 questions comptées.
- Choix d'équipe absent pour les joueurs entrés « sans compte » après l'ouverture des équipes (Hugo, Jeanne, Sofia, Lucas) : Nadia voit un « Changer » côté animatrice, aucun côté joueur. À confirmer.
- `console` : non consulté.

## Mes idées
1. Annoncer les changements d'état (nouvelle question, révélation, fin de soirée) par une zone live polie.
2. Rendre le choix d'équipe accessible à tous les joueurs, avec un bouton nommé et un titre « Les équipes » côté joueur.
3. Si une question est reposée, que le téléphone revienne dessus et que ce soit annoncé.
4. Rendre les nombres et unités d'un seul tenant (« 2 joueurs », « 200 pts », « 50 secondes ») pour éviter la lecture hachée.
5. Cacher les emojis décoratifs au lecteur d'écran dans les listes (déjà fait pour les cartes de classement avec un nom complet).
6. Mettre les trophées en titres, et renommer « Plus ».

## Mes notes
- Entrer dans la soirée : 5/5
- Plaisir de jeu (ou d'animer) : 4/5
- Lisibilité — textes, boutons, couleurs : 3/5
- Envie de revenir, de recommander : 4/5
