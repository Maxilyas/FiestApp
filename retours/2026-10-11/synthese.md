# L'atelier des nouveautés — deux experts, 11 octobre 2026

Deux experts ont joué, le dimanche 11 octobre en fin d'après-midi, ce que la
journée venait de livrer, sur un serveur d'atelier (le client du commit
`6bc9233`) :

- **l'experte UX du jeu solo** (mobile, cinq minutes par jour) a déroulé les
  sept vœux du propriétaire — sentiers, carnet, profil, défi entre amis,
  classement du défi de la semaine, duels, vitesse — sur deux téléphones de
  360 × 640, deux profils neufs, environ deux cents gestes ;
- **l'animatrice pressée et éditrice exigeante** a composé, lancé et relu des
  quiz tout prêts par toutes les portes (« Mes quiz », le salon, l'écran
  commun, la télé branchée), et lu 115 questions en entier.

Leurs rapports sont dans `experts/` ; leurs captures, leurs outils et leurs
mesures sont restés dans `export/evaluations/` (que git ignore), avec l'état
d'avant les corrections.

## En bref

- **Le jeu solo** : quatre vœux sur sept tenus (sentiers, carnet, profil,
  classement du défi). Trois l'étaient à moitié — les duels, le défi entre
  amis, la vitesse —, et chaque fois pour un **bout de chemin**, pas une
  fonction : un duel déjà gagné qui ne finit pas, « personne à affronter »
  sur un petit serveur, le code d'un défi qui ne se tape nulle part, un
  portrait jamais révélé quand on arrête une épreuve validée.
- **Le quiz tout prêt** tient sa promesse — une bonne soirée en moins d'une
  minute, aucune erreur de fait sur 115 questions — par la bonne porte. Trois
  faiblesses l'abîmaient : les **estimations** (12 sur 19 posaient un
  problème : « 6 × 7 » dans un quiz corsé, un numéro de vol à estimer, « 66 »
  sans ses millions d'années), **« Des enfants jouent »** (74 % de la base
  passaient, Tati et Tarantino compris), et **« Mes quiz » vide**, où le quiz
  tout prêt arrivait en douzième.

Presque tout ce qui se corrigeait en quelques lignes l'a été le soir même :
PR #150 (les duels, à la demande du propriétaire), #151 (les constats du
solo), #152 (ceux du quiz tout prêt). Ce qui reste est plus long, ou attend
un arbitrage.

## Ce qui a été fait

### Le jeu solo (`experts/nouveautes-solo.md`)

| Constat | Verdict | Où |
|---|---|---|
| 1. Un duel classé déjà gagné ne finit pas ; « −36 si tu perds » s'affiche encore | **Fait** : une rencontre, et un duel classé joué en second, finissent à la réponse qui dépasse le score d'en face (`scoreABattre`) | #151 |
| 2. « Personne à affronter » dès le premier duel sur un petit serveur | **Fait** : on défie qui l'on veut — une recherche, l'épée du classement de sa ligue, ses amis —, et le bouton « au hasard » ne paraît que s'il a un adversaire (`adversaireAuHasard`) | #150 |
| 3. Le code d'un défi entre amis ne se tape nulle part | **Caduc** : à la demande du propriétaire, un défi n'a plus de lien ni de code — il part en notification à celui qu'on défie | #150 |
| 4. Arrêter une épreuve validée saute l'écran de fin et le portrait | **Fait** : « Arrêter là · voir mon palier » mène à la fin comme la seizième question ; « Une vie en jeu » s'efface dès la validation | #151 |
| 5. L'accueil ne dit rien du carnet | **Fait pour le carnet** : la tuile de la campagne compte ce qui est à revoir, pastille « À revoir », et y mène (`SentiersDAccueil.aRevoir`). Le défi de la semaine sur la tuile : **reste** | #151 |
| 6. Entre amies, la boucle se tait | **En partie** : la fin d'un duel prévient l'autre (`prevenirDuResultat`), les amis se voient avec leur ligue. Nommer l'amitié nouvelle à la fin d'un défi : **reste** | #150 |
| 7. Quatre sauts à l'ouverture | **Fait pour trois** : les duels réservent la place de leur en-tête (CLS mesuré de 0,044/0,066 à 0,011/0,027) ; ouverte sur le carnet ou le défi, la campagne s'esquisse sur eux, plus sur la série (`surSonOnglet`) ; un sentier ouvert à son adresse se place sur son palier avant la première peinture (`useLayoutEffect`). L'emoji d'inscription avant le portrait : **à arbitrer** (voir les tensions) | #151, après #152 |
| 8. Les sentiers : « Jouer » sur un palier qui attend | **Fait** : la fiche dit « Reprendre le palier N », ses bonnes réponses et ses fautes, « rien n'est perdu » ; « Racheter » devient « Plus de vies ». Le bouton du bloc qui lancerait l'épreuve : **reste** | #151, après #152 |
| 10. Une amie a deux visages sur la même page | **Fait** : ses amis, une recherche et l'auteur d'un défi reçu portent ce que porte le classement — finition, portrait ou légendaire, Éclat (`SonApparence`) | après #152 |
| 11. Les pages vides d'un débutant | **En partie** : la vitrine ne dit plus que les hauts faits « se décernent à la fin de chaque soirée » — ils se gagnent aussi au quiz du jour et en campagne. Le premier titre à gagner sur une page vide : **reste** | après #152 |
| 13. Une requête en double | **Fait pour le carnet** : ouverte sur lui, la campagne ne demande plus son compte deux fois. Le second « Chargement… » des panneaux du profil : **reste** (un compromis documenté) | après #152 |
| 9, 12, 14. La carte d'un joueur solo (des zéros), deux gros boutons sous le pli, quatre fois la même question dans une épreuve | **Restent** (voir plus bas) | — |

### Le quiz tout prêt (`experts/quiz-tout-pret.md`)

| Recommandation | Verdict | Où |
|---|---|---|
| 1. Resserrer les estimations | **Fait** : les marches de ses QCM, leur propre plan rangé de la plus facile à la plus dure, ni numéro (`NUMERO`), ni petit entier qu'une facile fait savoir à tous (`PETIT_ENTIER_CONNU`), une unité longue effacée seulement si l'intitulé la dit | #152 |
| 2. « Des enfants jouent » par l'âge 6 d'abord | **Fait** : ce qu'un enfant connaît passe devant, même déjà posé (`pourUnEnfant`) ; le reste de dix ans complète ; « · en famille » au titre. Mesuré : 100 % de questions d'enfant dans un quiz d'enfants | #152 |
| 3. Le quiz tout prêt en tête de « Ton premier quiz » | **Fait**, et « Par où commencer » le nomme | #152 |
| 4. ▶ « Lancer » sans impasse pour un compte sans profil | **Fait** : le salon mène à l'écran commun | #152 |
| 5. Corriger « Alerte à Malibu » et l'allumeur de réverbères, relire trois âges | **Fait** (et les « gueules noires ») | #152 |
| 6. La salle d'attente compose et lance ; le quiz tout prêt en principal quand tout est joué | **Fait** | #152 |
| 7. Écarter le QCM dont l'époque donne l'année | **Fait** (`souffleeParLEpoque`, onze questions dans la base) | #152 |
| 8. La feuille dit la durée, les catégories et les estimations réelles | **En partie** : la durée (« ≈ 8 min »). Les catégories nommées et le nombre réel d'estimations : **restent** | #152 |
| 10 (constat). Un vrai ou faux expert pour finir un quiz corsé | **Fait** : écarté | #152 |
| 11. Commander des questions à nombre | **Fait** : `consigne --nombres`, `verifier --nombres` ; 290 questions à nombre rangées dans les douze catégories — les estimations passent de 357 à 647, les faciles de 27 à 146 | après #152 |
| 9, 10, 12. Les réponses soufflées par leur racine, « Une autre » dans l'éditeur, la tension avec le jeu solo | **Restent** (voir plus bas) | — |

## Ce qui reste, par ordre de rendement

1. **Les estimations des sujets** — P3 · M. Resserrées, il n'en restait que
   27 faciles, et un quiz *facile* d'une seule catégorie n'en avait plus
   aucune. La vague de questions à nombre (`consigne --nombres`, 290
   rangées, relues en quatre fiches : 9 retirées, 9 corrigées) les porte à
   647, dont 146 faciles : chaque catégorie a maintenant les siennes. Un
   sujet sur trois n'a pas encore son compte, et la feuille devrait dire
   combien elle en aura (`GET /api/quiz-tout-pret` peut compter les
   estimables par catégorie et par sujet).
2. **Les mots du solo** — P3 · S : le reste du tableau « Les mots qu'un
   joueur ne comprend pas » du rapport (« 1 sur 4 » au carnet contre « 5 sur
   6 » au sentier, « Ma carte » qui n'existe plus). **Fait le 12 octobre**
   (#163).
3. **Les pages d'un débutant** — P3 · S : un titre « Aucun », une vitrine
   vide, sans dire comment gagner le premier (`lesPlusProches` le sait).
4. **Le geste principal sous le pli** — P3 · S : « Commencer une série »
   et « Jouer le défi » collés en bas, comme `GesteDuBas` ; le bouton du
   bloc des sentiers qui lance l'épreuve.
5. **La carte d'un joueur qui ne joue qu'en solo** — P3 · M : « Soirées 0 ·
   Quiz gagnés 0 · Coup d'œil — » ; des cadrans du solo à la place. **Fait
   le 12 octobre** (#164) : son record, ses paliers, ses bonnes réponses.
6. **La feuille du quiz tout prêt** — P3 · S : nommer les catégories, dire
   les estimations réelles, la description du sujet sous sa tuile.
7. **« Une autre » sur une question tirée de la base**, et sa marche visible
   dans l'éditeur — P3 · M.
8. **Les réponses soufflées par leur racine** (« allumer les réverbères →
   Allumeur de réverbères ») — P3 · S puis M : une liste dans `verifier` et
   à `/admin#campagne`, à relire ; pas un refus, les étymologies sont
   voulues.
9. **Une question par gabarit dans une épreuve** (quatre fois « Qui a écrit…
   ? » de suite) — P3 · M. **Fait le 12 octobre**, pour les épreuves, les
   séries, les défis, les duels et les quiz tout prêts (#161, #162 :
   `2026-10-12/synthese.md`, « Les tirages sans redites »).

## Ce qui plaît — à ne pas casser

- **La fiche d'un palier** : thème, difficulté, questions, seuil, étoiles et
  ce qu'on risque. Et la jauge d'une épreuve (« 6 bonnes · encore 4 pour
  valider · 1 faute · 5 permises »).
- **« ← Partir » partout et la reprise exacte** : épreuve, révision, sujet,
  duel — même question, même compte.
- **Le carnet** : ses rendez-vous en une rangée, chaque réponse qui dit où en
  est sa question, la révision qui se recommence sans rien perdre.
- **Le vestiaire** : une carte qu'on touche, une page par pièce, la carte en
  tête qui change sous les yeux.
- **La rencontre** : « Bérénice l'avait trouvée », « Toi 5 – Bérénice 4 », et
  sa fin — le score, la cote, son écart, la ligue, la semaine.
- **Le quiz tout prêt à l'écran commun** : trois touchers jusqu'à la première
  question, une composition en moins d'une seconde, des questions justes,
  chacune avec son anecdote, et aucune qui revienne d'une composition à
  l'autre.
- **L'attente écrite par le serveur** : jamais de page blanche.

## Les tensions à arbitrer

- **La base des soirées est celle du jeu solo.** Un joueur assidu de la
  campagne a pu voir — et revoir au carnet — une bonne part des questions
  d'un quiz tout prêt. Ce n'est pas un avantage de profil au sens de
  l'invariant 8 (c'est du savoir, pas une règle), mais c'en est l'esprit.
  Piste de l'expert : à la console, la salle est connue ; passer en dernier
  ce que ses profils ont vu en campagne. À décider avant de le faire.
- **Un duel fini dès qu'il est gagné** rapporte moins de confettis et
  d'expérience qu'un duel joué jusqu'à la troisième faute : c'est le prix
  d'une fin juste (#151).
- **Un quiz facile sans estimation moyenne** : la promesse « que des
  faciles » passe avant « une question sur cinq au plus près » (#152), le
  temps que la base ait ses estimations faciles.
- **La feuille s'ouvre devant la salle** quand on compose à l'écran commun :
  la télé montre les coulisses (axe déjà connu de la première tablée).
- **L'emoji en attendant le portrait.** Le temps que le dessin d'un
  portrait ou d'un légendaire arrive (35 à 65 ms en cache, 220 à froid),
  l'emoji de l'inscription tient la place, puis le médaillon le remplace et
  le prénom glisse. L'experte voudrait un cercle neutre, « ne rien montrer
  plutôt que montrer faux ». Mais c'est un parti pris écrit (`Avatar.tsx` :
  « l'emoji tient la place »), garanti par plusieurs épreuves, et valable
  sur tous les écrans — soirée comprise, où un dessin perdu laisserait
  sinon un cercle vide pour toute la page. À décider avant d'y toucher.

## Les rapports

- `experts/nouveautes-solo.md` — l'experte UX du jeu solo : les sept vœux,
  quatorze constats, le parcours pas à pas, ce que chaque page fait attendre,
  les mots.
- `experts/quiz-tout-pret.md` — l'animatrice pressée et éditrice exigeante :
  douze constats, les portes pas à pas, les questions à problème, ce que la
  base offre et ce que le tirage en fait.
