# La nuit du 12 octobre 2026 — la télé branchée

Le propriétaire a demandé, le 12 octobre au soir, « une revue sur le scénario
où on branche une télé ». Elle a été faite en rejouant le scénario entier sur
un serveur jetable, une télé en 1920 × 1080 et le téléphone du chef en
360 × 640 (`server/scripts/rendu-tele.ts`, nouveau) : `/tele` et son code,
« Créer un salon » et « Sur une télé », le code tapé, le salon ouvert, quatre
invités, une question et sa révélation, le téléphone du chef qui s'en va
puis revient, la télé rechargée, le serveur qui redémarre, le podium, la
clôture. Le journal du script dit, à chaque moment, si la télé montre la
salle ou la console de l'animateur, et ce qui s'y toucherait.

## En bref

**La télé d'un salon montrait la console de l'animateur**, du branchement
jusqu'à la clôture : le panneau des invités et la création d'équipes,
« Lancer un quiz », « Mes quiz », « Mon compte », « Historique »,
« Accueil », « Clore la soirée », puis pendant la partie « Révéler »,
« Pause », « Suivante », « Reposer », « Annuler les points » — sur une télé
que personne ne peut toucher. La salle d'attente vue de loin, faite pour elle
le 3 octobre (le code du salon en grand, le QR, ceux qui arrivent, « Nadia
lance la partie depuis son téléphone »), ne s'affichait jamais : elle
attendait une télécommande déclarée, et la barre du chef n'en déclarait pas.

Le reste du scénario tient : le code se lit de loin et se tape sans
ambiguïté, la télé s'ouvre deux secondes après sa validation, rechargée elle
revient où elle était, et après un redémarrage du serveur la télé et la
barre du chef reprennent d'elles-mêmes la question en cours.

## Les constats

| # | Constat | Verdict |
|---|---|---|
| 1 | La télé d'un salon montre toute la console, du branchement à la clôture | **Corrigé** : branchée par un code, la télé est un écran de salle dès son branchement (`ecranDeSalle`) |
| 2 | Un téléphone qui se verrouille rend la console à la télé (la télécommande partie, la télé « reprend la main ») | **Corrigé**, par la même règle ; quand personne ne l'anime, un lien discret, « Piloter d'ici », rend la console à qui a une souris |
| 3 | Pendant le choix du quiz, la télé montre le panneau des invités et la liste des quiz | **Corrigé** : la salle d'attente vue de loin, et les coulisses restent au téléphone |
| 4 | Les consignes se contredisent : la télécommande dit d'ouvrir `/host` sur la télé, qui « pourra alors piloter ta soirée » ; le salon et la télé disent `/tele` ; « Mon compte » ne connaît que l'ordinateur relié à la télé | **Corrigé** : `/tele` partout, et la télé « montre » la soirée |
| 5 | « Télé branchée » est sans retour : la télé rechargée entre-temps montre un code neuf, l'ancien n'ouvre plus rien, et le champ ne revient qu'en rechargeant la page — et ses choix avec | **Corrigé** : « Télé branchée : elle s'ouvre dans un instant », et « Une autre télé ? » rouvre le champ |
| 6 | « Terminer le quiz » sur le dernier du programme clôt la soirée sans le dire : la boîte parle d'un quiz seul, et le chef qui voulait encore le podium tombe sur sa fin de soirée | **Corrigé** : « Terminer ce quiz et la soirée ? », lu dans l'état de la partie (une barre rechargée le sait encore) |
| 7 | Une télé branchée garde sa connexion au-delà de sa soirée : un écran de salle ne fait aucun geste qui relirait sa session de 24 heures, et allumée chez un ami elle recevait ses soirées des jours plus tard | **Corrigé** : sa connexion tombe à l'heure de sa fin, et sa page revient à son code |
| 8 | « 0 joueur » s'écrit en chiffres à l'ancienne : « O joueur » de l'autre bout de la pièce | **Corrigé** (`lining-nums`) |
| 9 | Deux écrans de salle dans la même pièce jouent la fanfare deux fois | Laissé : rare, et les couper demanderait de désigner l'un des deux |
| 10 | La tablée (`npm run tablee`) ne sait pas jouer une télé branchée par `/tele` | Laissé : l'outillage des agents, pas le produit |
| 11 | Aucun script ne rejouait la télé | **Fait** : `rendu-tele.ts` |

Les tests : `tele-salle.test.ts` (la règle de l'écran de salle, « Piloter
d'ici », les consignes), `appairage.test.ts` (la connexion qui tombe à la fin
de la soirée), `cloture-auto.test.ts` (le dernier quiz du programme dans la
vue d'animateur).
