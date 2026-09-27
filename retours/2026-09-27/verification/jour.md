# Contre-expertise du groupe `jour` : le quiz du jour (`jour-regles`, `jour-ecran`)

## En bref

J'ai relu les 29 constats des deux rapports : 17 pour `jour-regles` et 12 pour `jour-ecran`. Rien n'est réfuté.
- Les reproductions échouent toutes pour la raison annoncée : 7 fichiers `node:test` de `jour-regles`, les 6 épreuves au navigateur et les 3 épreuves serveur de `jour-ecran`. `ce-qui-tient` passe (6 sur 6), comme promis.
- Les deux experts ont lu le code juste.

Je corrige trois choses.

1. **Le P1 (le second profil qui souffle) est réel, mais c'est une tension, de gravité P2.**
   - La triche est ouverte, triviale, et aucune garde ne l'arrête.
   - La correction proposée ne la ferme pas. Ma reproduction recopie les réponses **par leur texte**, en 2,5 s par question : 2 000 points quand même. Le bonus de rapidité ne fond qu'après le temps de lecture offert, qui va de 4,1 à 6,7 s au tirage du jour. Mélanger les réponses par profil ne change donc rien au score du tricheur.
   - Le test de l'expert passerait avec ce mélange, alors que la porte resterait ouverte.
2. **« Une salle faite de soi-même »** (`jour-regles-4`) passe de P2 à une tension P3. Seul le tricheur y gagne, et seulement sur un serveur où il joue presque seul.
3. **« Question suivante » perdue dans un tunnel** (`jour-ecran-5`) passe de P2 à P3. Il faut que la liaison tombe pendant les quelques dixièmes de seconde où la demande est en vol. Un toucher hors ligne n'atteint jamais le serveur et ne lance aucun chrono.

`jour-regles-17` était « non confirmé » : je l'ai rejoué, et le mécanisme tient (dix questions « posées » de trop). Le déclencheur reste rare : deux processus sur la même base.

Quatre constats de `jour-regles` font doublon avec d'autres rapports : n° 2 = `concurrence-3`, n° 6 = `persistance-5`, n° 7 = `concurrence-7`, n° 8 = `recompenses-comptes-5`. Ils sont confirmés ici, à corriger une seule fois.

## Tableau

| Constat | Annoncée | Verdict | Retenue | Pourquoi, en une ligne |
|---|---|---|---|---|
| jour-regles-1 · le second profil souffle les réponses | P1 | **tension** | **P2** | Réelle et triviale, mais délibérée, aux enjeux cosmétiques et bornés, et que la modération rattrape avant minuit ; la fermer demande un profil qui prouve quelqu'un (parti pris n° 2). Le mélange par profil ne la ferme pas (rejoué). |
| jour-regles-2 · classement gardé périmé, podium payé dessus | P2 | confirmé · doublon de concurrence-3 | P2 | Rejoué ; la révision est lue après les `await` (`jour.ts:885`) ; la piste, jouée, passe. |
| jour-regles-3 · « 3 sur 3 » sans Citrouille | P2 | confirmé | P2 | Rejoué ; la saison perdue pour un an. La moitié L'Assidu est P3 : le palier ne fait qu'attendre. |
| jour-regles-4 · un joueur et son second profil font une salle | P2 | **tension** | **P3** | Rejoué ; profite au seul tricheur, sur un serveur de 1 ou 2 vrais joueurs ; même astuce en soirée (un second téléphone) ; masquer le second profil le sort de la salle. |
| jour-regles-5 · « Question suivante » après minuit dit « pas de quiz » | P2 | confirmé | P2 | Rejoué ; `suivante` ne tire ni ne clôt (`jour.ts:624-628`). Un onglet resté ouvert peut faire croire qu'il n'y a rien à jouer aujourd'hui, et coûter la série. |
| jour-regles-6 · nuit interrompue, podium jamais payé | P3 | confirmé · doublon de persistance-5 | P3 | Rejoué ; l'expérience revient à la réponse suivante du joueur (`enregistrer` → `ecrireXp`), le Champion à sa prochaine partie finie. |
| jour-regles-7 · réponse de 23 h 59 écrite après la clôture | P3 | confirmé · doublon de concurrence-7 | P3 | Rejoué ; la fenêtre est d'un aller-retour Turso à minuit. |
| jour-regles-8 · Citrouille des deux façons, perdue avec la soirée | P3 | confirmé · doublon de recompenses-comptes-5 | P3 | Rejoué ; `accorderSaison` ne range rien si la clé existe déjà (`profiles.ts:1503`). |
| jour-regles-9 · « en cours » dans un classement figé | P3 | confirmé | P3 | Rejoué, par deux experts. |
| jour-regles-10 · rang d'hier relu aux masques du jour ; médaille des parties inachevées | P3 | confirmé | P3 | Première moitié rejouée par moi : Alice lit « rang 1, +15 XP », et aucun vainqueur d'hier n'apparaît. La seconde est discutable : six bonnes réponses font bien six bonnes réponses. |
| jour-regles-11 · annulation sans retour, cache non invalidé à mi-chemin | P3 | confirmé | P3 | Lecture : `revision++` après `parLots` (`jour.ts:1412`), aucune confirmation (`AdminDuJour.tsx:259`). |
| jour-regles-12 · 120 s par question acceptées | P3 | confirmé | P3 | Lecture ; seul l'administrateur colle une durée : c'est un durcissement, pas une faille. |
| jour-regles-13 · les questions à venir se lisent ailleurs | P3 | tension | P3 | Lecture ; recoupe invariants-1 (les quiz livrés dans la réserve) et invariants-3 (le jeton lit les prêtes). |
| jour-regles-14 · `laureats()` refait `Intl` à chaque appel | P3 | confirmé | P3 | Remesuré : 4,1 µs par appel, 2,1 ms pour 500 profils (charge 0,9). |
| jour-regles-15 · empreinte aveugle aux symboles, au grec, au cyrillique | P3 | confirmé | P3 | Rejoué (`empreintes.ts`). |
| jour-regles-16 · l'expérience du jour gardée, pas dérivée | P3 | confirmé | P3 | Lecture ; c'est une dette face à l'invariant 20. |
| jour-regles-17 · deux tirages concurrents marquent dix questions de trop | P3 | confirmé (était « non confirmé ») | P3 | Rejoué par moi : 10 → 20 questions « posées », 10 jouées. Il faut deux processus sur la même base. |
| jour-ecran-1 · réseau revenu après l'échéance, page figée | P2 | confirmé | P2 | Rejoué ; un seul essai, `.catch(() => {})` (`JourApp.tsx:130-141`), aucune écoute de `online`. |
| jour-ecran-2 · double toucher sur « Question suivante » | P2 | confirmé | P2 | Rejoué ; aucune garde, et le bouton tombe sur la grille suivante. |
| jour-ecran-3 · rien n'est annoncé au lecteur d'écran | P2 | confirmé | P2 | Rejoué ; la soirée a son `aria-live` (`PlayerApp.tsx:455`), le jour non. |
| jour-ecran-4 · au texte agrandi, question défilée, chrono caché | P2 | confirmé | P2 | Rejoué (−54 px) ; la soirée remonte en haut (`PlayerApp.tsx:346`), le jour non. |
| jour-ecran-5 · réponse de « Question suivante » perdue : « Temps écoulé » | P2 | **confirmé, gravité revue** | **P3** | La demande doit arriver au serveur et sa réponse se perdre : une fenêtre de quelques dixièmes de seconde. Hors ligne, rien n'est servi. |
| jour-ecran-6 · refus définitif affiché « touche-la à nouveau » | P3 | confirmé | P3 | Rejoué (minuit). Pour un 503, « retouche » finit par marcher. |
| jour-ecran-7 · lendemain de victoire, accueil sans laurier | P3 | confirmé | P3 | Rejoué ; `toDetail` passe avant `carriereDe` → `clorePasses` (`profileRoutes.ts:76-86`). |
| jour-ecran-8 · l'écart d'horloge ne se remesure jamais | P3 | confirmé | P3 | Rejoué, recalage simulé ; aucun `resetClock()` sur la page du jour. |
| jour-ecran-9 · signalements sans les réponses, annulation sans trace | P3 | confirmé | P3 | Lecture (`signalements()` ne rend que `bonne`). Le mauvais clic vient du script. |
| jour-ecran-10 · question annulée : « La bonne réponse » | P3 | confirmé | P3 | Lecture (`JourApp.tsx:421`). |
| jour-ecran-11 · page d'erreur sans « Réessayer » | P3 | confirmé | P3 | Lecture (`JourApp.tsx:171-180`). |
| jour-ecran-12 · petites cibles, lien du mois, 3ᵉ personne, toasts | P3 | confirmé | P3 | Lecture (`styles.css:5197`, `:5247`). |

**Compte** : 25 confirmés, 1 confirmé à gravité revue, 3 tensions, 0 réfuté, 0 incertain. Quatre des confirmés sont aussi des doublons d'autres rapports.

## Méthode

**Relancé**, un fichier à la fois, en `nice -n 10`, avec une charge de 0,6 à 1,1 :
- `jour-regles` : `second-profil`, `cache-perime`, `saison-inachevee`, `minuit`, `nuit-interrompue`, `cloture-croisee`, `saison-soiree-retiree`, `ce-qui-tient`, plus `cout-laureats.ts` et `empreintes.ts`.
- `jour-ecran` : `jour-ecran-navigateur.test.ts` (6 épreuves, un Chromium, sur le `dist` de l'expert construit à 21 h 49, après le dernier changement de `client/` à 18 h 04) et `jour-ecran-serveur.test.ts`.
- Je n'ai pas relancé les scénarios `0N-*.ts`, qui écrivent leurs captures dans le dossier de l'expert. `jour-ecran-5` repose sur la lecture du code et sur `notes-05-PR.json`.

**Écrit**, dans `export/evaluations/verification/jour/` :
- `par-le-texte.test.ts` :
  - épreuve 1, qui échoue : souffler par le texte, en 2,5 s, fait 2 000 ;
  - épreuve 2, qui passe : masqués avant minuit, le tricheur et son second profil ne montent pas ;
  - épreuve 3, qui passe : masqué après la nuit, il perd le laurier et garde le reste. Elle rejoue aussi `jour-regles-10`.
- `deux-tirages.test.ts` : `jour-regles-17`, qui échoue.

**Lu** :
- `server/src/core/jour.ts` : le tirage, la partie, le classement, la clôture, la correction, l'annulation, le masquage, les lauriers.
- `server/src/games/quiz.ts:140-191` (barème, temps de lecture), `server/src/quizDuJour.ts` (routes d'administration), `server/src/auth/profileRoutes.ts` (inscription, `detailDe`), `server/src/auth/profiles.ts` (`byId`, `accorderPaliersDuJour`, `accorderSaison`, `recompensesDuJour`).
- `shared/jour.ts`, `client/src/views/JourApp.tsx`, `client/src/clock.ts`, `client/src/api.ts` (`avecLHeure`), `client/src/components/AdminDuJour.tsx`, `client/src/views/PlayerApp.tsx` (pour comparer).
- README (« La direction », le quiz du jour), RECOMPENSES.md § 5.13 et les saisons, les fiches des deux experts, et les autres rapports pour les doublons.

Aucun fichier suivi par git n'a été modifié. Rien n'est resté allumé.

## Le P1 : un second profil souffle les réponses au premier (`jour-regles-1`)

### Est-ce une triche réellement ouverte ? Oui.

- `second-profil.test.ts` échoue comme annoncé :
  ```
  Mallory : 2000 pts, 10/10, médaille or ; Alice : 1800 pts
  podium : [["Mallory",1,25],["Alice",2,15]] ; paliers de Mallory : hf:champion-du-jour:1, hf:sans-faute:1 ; laurier : true
  ```
- Aucune garde ne manque au raisonnement :
  - Chaque révélation porte l'intitulé, les réponses et `bonne` (`jour.ts:744-754`).
  - La correction entière s'ouvre à qui a fini (`jour.ts:1289`).
  - Un profil se crée sans rien prouver : `Budget(10, 5)` par adresse (`profileRoutes.ts:60`), large pour un seul second profil.
  - Rien ne relie deux profils. L'administrateur ne voit aucun indice : il ne dispose que d'une recherche par nom (`profilsPourLAdministration`).

**Mais la reproduction de l'expert recopie des index**, et la piste qu'elle doit valider (mélanger les réponses par profil) ne ferme rien. Ma reproduction `par-le-texte.test.ts` (épreuve 1) recopie les réponses **par leur texte**. C'est une recherche qui ne dépend d'aucun ordre, celui des réponses comme celui des questions. Elle prend 2,5 s par question pour retrouver la réponse à l'écran :

```
Mallory, par le texte à 2,5 s : 2000 pts, 10/10 ; Alice, honnête à 2 s : 1800 pts ;
lecture offerte au tirage : 4080 à 6720 ms ; dans la réserve amorcée (38) : min 2540, médiane 4685 ms
première marche : Mallory
```

La raison : `pointsDuChoix` paie le maximum pendant tout le temps de lecture offert (1 s + 55 ms par caractère de la question et des réponses, `quiz.ts:172-190`). Retrouver un texte connu parmi quatre prend moins de temps que ça. Un mélange par profil ferait donc passer le test de l'expert, alors que le tricheur garde ses 2 000 points. **Le test qui dit si la porte est fermée est celui qui recopie par le texte.**

### La gravité juste : P2, pas P1

Au pied de la lettre, la grille (« laisse tricher n'importe qui ») donne P1. Mais cette grille classe des bugs, et ce constat n'en est pas un. Plusieurs raisons ramènent la gravité à P2.

- **Rien n'arrive par accident.** Il faut vouloir tricher, et le refaire chaque jour avec deux navigateurs. C'est la limite de tout quiz quotidien identique pour tous qui montre la réponse après coup : une fenêtre privée suffit sur Wordle aussi.
- **Les enjeux sont cosmétiques et bornés.**
  - Les 75 XP de sa propre partie : le tricheur ne vole personne en se les donnant.
  - Au plus 25 XP de podium par jour, le Champion du jour, le laurier, et à terme le Kintsugi (dix victoires) et le Sphinx (dix sans-faute).
  - Aucun avantage de jeu en soirée (invariant 8).
  - La victime est l'honnête du haut du classement : elle perd 10 XP (25 → 15) et le laurier ce jour-là.
- **Le tricheur ne peut que rejoindre le meilleur.** Un honnête qui fait 10 sur 10 pendant le temps de lecture fait aussi 2 000, et partage la première marche (invariant 15).
- **La modération marche déjà, si elle agit avant minuit.**
  - `par-le-texte.test.ts`, épreuve 2 : masqués avant minuit, le tricheur et son second profil sortent du podium **et** de la salle. Le podium payé devient `[["Alice",1,25]]`, pour une salle de 2.
  - Épreuve 3 : masqué après la nuit, il perd le laurier mais garde ses 25 XP et son Champion · Bronze.

### Tension, pas bug

Le quiz du jour est réservé aux profils. Le « jouer sans compte » des soirées n'est donc pas directement en jeu. Ce qui l'est :
- **Le parti pris n° 2**, zéro donnée personnelle. Un profil ne demande ni adresse ni téléphone, donc rien ne prouve qu'un profil est une personne.
- **Le profil créé en dix secondes à l'entrée d'une soirée.** Toute friction ajoutée là frappe le chemin qui fait passer l'invité anonyme au profil (parti pris n° 1, et la mise en garde de « La dimension sociale des profils »).
- **Deux promesses du quiz du jour lui-même** : « les mêmes pour tous » et « la bonne réponse après chaque réponse — c'est là qu'on apprend » (README, `shared/jour.ts:1-4`).

Fermer la porte exige de trahir l'un des trois. Il reste à la rendre visible et réversible.

### Ce qu'on peut faire sans trahir les partis pris, du plus rentable au moins utile

1. **La rendre visible à l'administrateur (S à M).**
   - Poser un cookie d'appareil tiré au hasard (`qz_appareil`, `httpOnly`, un an), de même nature que le cookie de session : pas d'adresse IP, rien de personnel. Le noter sur `jour_parties`.
   - À `/admin`, lister les parties du jour jouées **depuis le même appareil** : qui a joué d'abord, avec quel score, et à quel écart.
   - L'administrateur masque avant minuit, ce qui marche déjà (épreuve 2).
   - **Signaler, jamais exclure d'office.** La tablette familiale où jouent un parent et un enfant, chacun avec son profil, est un usage légitime : le quiz « 8-12 ans » est dans la réserve.
2. **Laisser le masquage atteindre « hier » (M).** C'est le lendemain, le laurier sur le prénom, qu'on remarque le tricheur.
   - Masquer un profil pendant la journée du laurier refait le podium de la veille sans lui : ses lignes `jour_podiums` retirées, les autres marches repayées (`ecrireXp` est idempotent), le Champion rangé sous `#jour:<jour>` retiré s'il venait de cette victoire.
   - C'est ce qu'on fait déjà d'une soirée retirée de l'historique (invariant 10).
   - Aujourd'hui, l'épreuve 3 montre que masquer le lendemain ne reprend rien.
3. **Ne compter dans la salle que les parties qui ont répondu au moins une fois (S).** Cela suit la lettre de l'invariant 19, « rien pour la présence ». Cela tue le second profil qui ne fait que toucher « Jouer » (`jour-regles-4`), pas celui qui répond.
4. **Mélanger les réponses par profil (M), en option.**
   - Cela ne relève que la barre naïve : la recopie d'index, et les amis qui se soufflent « ▲, ■, ● ». Le score du tricheur ne bouge pas (épreuve 1).
   - Si on le fait, garder l'ordre des **questions** commun. On se parle de « la question 7 », et les signalements en dépendent.
5. **Le dire.** Dans le README et RECOMPENSES.md : le classement du jour est un classement entre amis ; un second profil peut lire les réponses ; l'administrateur masque.

À écarter, parce qu'elles trahissent un parti pris sans fermer la porte :
- Faire payer la création d'un profil : adresse, captcha, ancienneté. L'ancienneté n'y fait rien : le vrai profil est ancien, et le second se réutilise chaque jour.
- Taire la bonne réponse jusqu'à minuit. Cela casse « on apprend », et un second profil apprend quand même par élimination, ou deux ou trois le font.
- Donner des questions différentes à chaque profil. Cela casse « les mêmes pour tous » et la comparaison du classement.

**Le test à garder** : `par-le-texte.test.ts`, épreuve 1. Il ne passera qu'avec la modération, et c'est honnête : aucune correction de code ne le fera passer seule. Pour les pistes 1 et 2, le test de la correction sera plutôt :
- « deux profils du même appareil le même jour paraissent à `/admin` » ;
- « masqué le lendemain, le podium d'hier se refait sans lui ».

## Les autres constats de `jour-regles`

- **N° 2, classement périmé** : rejoué. Classement lu après la réponse d'Alice : Bob 1 500 premier ; podium payé à Bob ; base : Alice 1 600. La piste de l'expert, jouée par-dessus, passe.
  - Le chemin est juste : la révision est lue au moment du rangement (`jour.ts:885`), après la requête et les `byId`.
  - En vrai, les profils sont en mémoire après leur premier `byId` (`profiles.ts:539-544`). La fenêtre se réduit alors à un aller-retour, et elle ne s'élargit qu'au réveil de l'hébergeur (un `byId` par profil du jour, huit par huit).
  - Pour payer le mauvais podium, il faut aussi que le processus ne s'endorme pas avant minuit : une soirée en cours à minuit y suffit, puisque `laureats()` lance alors la clôture.
  - C'est un concours de circonstances, mais sa conséquence est définitive : P2 tient. Doublon de `concurrence-3`.
- **N° 3, la saison inachevée** : rejouée. « Halloween 3 sur 3 », puis `légendaires : []`. RECOMPENSES.md dit bien que les paliers « tombent à la fin d'une partie » ; la faute tient au mélange avec « une partie commencée compte ».
  - Décerner à `commencer`, sous le verrou et après l'`INSERT` qui a pris, est juste. La fin de partie annonce encore ces récompenses, puisque `recompensesDuJour` lit par jour (`profiles.ts:1483`).
  - Autre voie : décerner la saison dans `clore` à chaque partie inachevée du jour clos. `periodeDu(J)` y vaut encore la saison.
- **N° 5** : rejoué, par deux experts (`minuit.test.ts` et `jour-ecran-serveur.test.ts` épreuve 1). P2 tient de justesse.
  - Le téléphone écrit « Il revient demain ».
  - Chrome sur Android rouvre souvent l'onglet sans le recharger : on peut le lire encore au matin, et sauter le jour, donc casser sa série.
- **N° 6, 7, 8** : rejoués, P3, doublons de `persistance-5`, `concurrence-7` et `recompenses-comptes-5`.
  - Pour le n° 6, rien n'est perdu pour de bon. `enregistrer` refait `ecrireXp` à chaque réponse (`jour.ts:723`) : l'expérience du podium revient à la première réponse du lendemain, et le Champion à la prochaine partie finie.
- **N° 10** : ma troisième épreuve montre la première moitié, après le masquage du vainqueur :
  - le « Hier » d'Alice : `{"rang":1,…,"xpPodium":15}` ;
  - les vainqueurs d'hier : `[]`.

  Pour la médaille des parties inachevées, la règle est « six bonnes réponses ». Une partie abandonnée à six justes les a : seule la partie **en cours** du jour, comptée à la page du profil, est incohérente.
- **N° 12** : seule une liste collée par l'administrateur porte « Temps : 60 s ». La consigne n'en parle pas, et la routine laisse 20 s (`DEFAULT_DURATION`). C'est un durcissement, pas une faille ouverte aux joueurs.
- **N° 17** : `deux-tirages.test.ts` rejoue l'entrelacement. La seconde instance a lu « pas de tirage » avant le lot de la première, et lit la réserve après : `marquées posées : 10 → 20`, tirage joué inchangé, 18 questions neuves au lieu de 28.
  - Deux processus sur la même base, c'est le chevauchement d'un déploiement sans coupure sur Render, ou le PC de secours.
  - La piste de l'expert est la bonne : lier l'`UPDATE` au tirage réellement écrit.
- **N° 9, 11, 13, 14, 15, 16** : tiennent tels qu'écrits (voir le tableau).

## Les autres constats de `jour-ecran`

- **N° 1** : rejoué. Dix secondes après le retour du réseau, `.result-banner` n'a toujours pas paru.
  - La cause : l'effet ne dépend que de `[question, enRoute, recevoir]`, qui ne bougent plus après l'échec. Rien n'écoute `online` sur cette page : les écouteurs de `socket.ts` ne concernent que la liaison d'une soirée.
  - La piste de l'expert (réessayer toutes les 3 s et sur `online`) est juste, et elle couvre aussi le n° 5.
- **N° 2** : rejoué. `jour_reponses` porte `{question: 1}` sans que personne l'ait choisie.
  - Sur Render, le double toucher éclair tombe souvent sur le bouton déjà grisé. Reste le second toucher « parce que rien ne bouge », qui arrive juste après l'affichage : P2 tient.
  - La garde de 400 ms ne coûte aucun point : le temps de lecture offert (au moins 2,5 s) paie le maximum bien au-delà.
- **N° 3 et 4** : rejoués. Les deux corrections recopient ce que fait déjà la page d'une soirée (`PlayerApp.tsx:346-347` et `:455`).
- **N° 5** : le chemin est exact. `suivante` écrit `servie_le` avant de répondre (`jour.ts:632-635`), et le téléphone n'affiche qu'un toast (`JourApp.tsx:93-102`).
  - Ramené à P3 : il faut que la demande **arrive** au serveur et que **sa réponse** se perde, pendant l'aller-retour de `suivante`.
  - Le cas courant du métro, un toucher hors ligne, échoue avant le serveur : aucune question n'est servie, et le toucher suivant la sert neuve.
  - La tension (resservir sans chrono ouvrirait une triche) est bien vue ; la relance du n° 1 réduit la perte au temps de la coupure.
- **N° 6** : rejoué au navigateur (minuit). Pour un 503, « touche-la à nouveau » finit par être vrai, puisque le serveur revenu accepte la réponse dans l'échéance. Seul le refus de minuit trompe. P3.
- **N° 7** : rejoué (échoue sur `premiere.laurier`). Cela ne touche que le vainqueur quand il est le **premier** visiteur du serveur ce jour-là. C'est fréquent sur un petit serveur, et un rechargement suffit. P3.
- **N° 8** : rejoué, recalage simulé : aucune réponse active. Le déclencheur réel, une horloge qui saute de plusieurs secondes page ouverte, est rare. P3.
- **N° 9 à 12** : les frictions tiennent. Au n° 9, « mon script a annulé la mauvaise question » vient d'un script qui touche le premier bouton ; le défaut réel est l'absence des autres réponses et de toute confirmation.

## Doublons

| Ici | Ailleurs | Ce qui est commun |
|---|---|---|
| jour-regles-2 | concurrence-3 | la révision lue après la lecture ; la nuit paie sur le cache |
| jour-regles-6 | persistance-5 | la clôture écrite avant les crédits |
| jour-regles-7 | concurrence-7 | la réponse de 23 h 59 écrite après la lecture du podium |
| jour-regles-8 | recompenses-comptes-5 | la saison tenue d'une soirée retirée |
| jour-regles-13 | invariants-1, invariants-3 | les quiz livrés dans la réserve ; le jeton lit les questions prêtes |
| jour-ecran (écartés par l'expert) | jour-regles-5, -9, -11 ; recompenses-vitrine-1 | déjà rapportés, confirmés au navigateur, non comptés |
| hors mission jour-regles (`shared/jour.ts:11-12` périmé) | invariants-5 | l'en-tête qui dit que légendaires et paliers restent aux soirées |

## Hors mission (deux lignes chacun)

- `recompter` (une annulation) appelle `ecrireXp(profileId, jour)` avec les paliers : il décerne donc L'Assidu à qui a **commencé** son septième jour, ce que la fin de partie ne fait pas (`jour-regles-3`). Le Sans-Faute, lui, exige `finie_le` (`jour.ts:1003`). La correction du n° 3 rendrait les deux chemins cohérents.
- Le fichier non suivi `server/undefined`, signalé par `jour-ecran`, ne vient d'aucun de mes scripts ; je ne l'ai pas touché.
