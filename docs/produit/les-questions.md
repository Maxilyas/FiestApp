# Les questions

> Chaque sorte de question d'un quiz en soirée : ce que voient l'invité et la salle, et comment elle se note — formules, valeurs exactes, exemples calculés par le code. Pour les joueurs curieux, les animateurs et les développeurs.

**Dans cette page** : [le QCM](#le-qcm) · [l'estimation](#lestimation) · [les ex æquo](#les-ex-æquo-et-le-départage) · [les équipes](#le-barème-des-équipes) · [la construction](#comment-cest-construit)

## Les sortes en un coup d'œil

| Sorte | Au téléphone | À l'écran commun | Ce qu'elle rapporte |
|---|---|---|---|
| QCM | 2 à 4 réponses (▲ ◆ ● ■), un toucher | les réponses ; à la révélation, la bonne, la répartition, le plus rapide | 100 à 200 points si c'est juste, 0 sinon |
| Vrai ou faux | un QCM de deux réponses, « Vrai » et « Faux » | idem | comme un QCM |
| Plusieurs bonnes réponses | on coche, puis « Valider » | toutes les bonnes allumées | comme un QCM, tout ou rien |
| À remettre dans l'ordre | on touche les réponses dans l'ordre, puis « Valider cet ordre » | chaque carte reçoit son rang | comme un QCM, tout ou rien |
| Estimation | on tape un nombre | la bonne valeur, les huit plus proches | 30 à 200 points selon la distance |
| Estimation en direct | idem, puis « On mesure la bonne réponse… » | « Réponses closes — on mesure ! » | comme une estimation |
| Qui dans la salle ? | les invités, un toucher | le nombre de votes, les plus désignés | rien : c'est un vote, pour rire |

Toute question peut aussi porter une photo, un extrait sonore et [ce qui l'entoure](#ce-qui-entoure-une-question). Dans l'éditeur, une question est « QCM », « Estimation » ou « Qui dans la salle ? » ; un QCM devient « Plusieurs bonnes réponses » ou « À remettre dans l'ordre », une estimation « En direct » ([Les quiz](les-quiz.md)).

Les valeurs viennent de `server/src/games/quiz.ts` ; leur ligne de référence est dans [les barèmes](../reference/baremes.md).

## Ce qui vaut pour toutes les questions

- **Le temps de réponse** va de 5 à 120 secondes, 20 d'office (`MIN_DURATION`, `MAX_DURATION`, `DEFAULT_DURATION`). Le chronomètre se lit à l'heure du serveur ; passé l'échéance, le téléphone ne répond plus, et le serveur garde la question ouverte 1,5 seconde de plus (`GRACE_MS`) pour la réponse partie juste avant.
- **On change d'avis jusqu'à la révélation**, mais le dernier envoi compte, son heure comprise : se raviser coûte du bonus — sinon on taperait au hasard à la première seconde pour s'assurer le maximum. La même réponse renvoyée (double appui, accusé perdu) est confirmée sans rien changer.
- **La révélation** part à la fin de cette marge, au clic « Révéler », ou 0,7 seconde après la dernière réponse attendue. Les points tombent à ce moment-là, jamais avant.
- **Le multiplicateur** du quiz — ×1, ×2 ou ×3, choisi au lancement — multiplie tout ce qu'une question rapporte.
- **L'animateur corrige** : « Annuler les points » retire à tous les points de la question révélée et la sort des statistiques ; « Reposer » les retire aussi, puis rejoue la question de zéro, chronomètre compris.

## Le QCM

**L'invité** voit l'intitulé, la photo s'il y en a une, et deux à quatre grandes cases marquées ▲ ◆ ● ■ (la forme suffit à qui distingue mal les couleurs). Un toucher répond : « Réponse enregistrée · tu peux encore changer, au prix du bonus de rapidité ». À la révélation, « +173 pts » et « Bien joué ! », ou « Raté… tu avais dit ◆ Melbourne », puis « La bonne réponse : ● Canberra » ([la suite](la-soiree.md#la-révélation)).

**La salle** voit l'intitulé et les réponses, en grand. À la révélation, la bonne est cochée et les autres s'éteignent ; chaque carte dit combien l'ont choisie, avec une barre, et une pastille nomme le plus rapide à avoir trouvé (« Hugo — 1,2 s »).
### Comment il se note

Une bonne réponse vaut **100 points** (`CHOICE_POINTS`), plus **jusqu'à 100 de rapidité** (`SPEED_BONUS`) ; une mauvaise réponse, ou pas de réponse, vaut 0.

**Le temps de lire est offert** : les premières secondes, toute la salle lit la question et ses réponses ; le bonus ne fond qu'après :

- temps de lecture = 1 000 ms (`LECTURE_MS`) + 55 ms par caractère de l'intitulé et des réponses (`LECTURE_MS_PAR_CARACTERE` — 180 mots par minute ; un emoji compte pour un caractère) + 1 500 ms pour une photo montrée avec la question (`LECTURE_PHOTO_MS` ; pas pour une photo à mémoriser, déjà regardée), **jamais plus de la moitié du chrono** ;
- points d'une bonne réponse arrivée après `t` = 100 + arrondi(100 × r), où r = (durée − t) ÷ (durée − temps de lecture), ramené entre 0 et 1 (`pointsDuChoix`).

Une bonne réponse vaut donc 200 pendant toute la lecture, puis descend régulièrement jusqu'à 100 à l'échéance — jamais moins de la moitié du maximum, comme chez Kahoot.

**Un exemple, calculé par le code.** « Quelle est la capitale de l'Australie ? », avec Sydney, Canberra, Melbourne et Perth, en 20 secondes : 67 caractères, soit 1 000 + 55 × 67 = 4 685 ms de lecture.

| Bonne réponse donnée à | 0 à 4,7 s | 8 s | 10 s | 12 s | 15 s | 18 s | 20 s | pendant la marge |
|---|---|---|---|---|---|---|---|---|
| Points | 200 | 178 | 165 | 152 | 133 | 113 | 100 | 100 |

### Le vrai ou faux

Un QCM dont les deux seules réponses sont « Vrai » et « Faux », dans un ordre ou l'autre. Il se joue et se note comme un QCM, et garde son ordre même dans un quiz qui mélange ses réponses.

## Plusieurs bonnes réponses

**L'invité** coche, puis touche « Valider » (« Corriger ma réponse » ensuite) : cocher sans valider ne répond pas. **La salle** lit « Plusieurs bonnes réponses : trouvez-les toutes » ; à la révélation, toutes les bonnes s'allument, et chaque carte dit combien l'ont cochée. Le téléphone dit « Toutes trouvées, bien joué ! » ou « Raté… tu avais coché … », puis « Les bonnes réponses : … ».

**La note** : juste si les cases cochées sont **exactement** les bonnes — toutes, et elles seules ; payée alors comme un QCM, à l'heure du dernier envoi. À moitié juste, elle ne vaut rien.

## À remettre dans l'ordre

Trois ou quatre éléments, écrits dans le bon ordre par l'animateur, que la partie montre **toujours mélangés** — jamais dans le bon ordre par hasard, quel que soit le réglage du quiz.

**L'invité** touche les réponses dans l'ordre ; chacune prend son numéro sans bouger de sa place, et retoucher un numéro le retire. « Valider cet ordre » s'allume quand tout est numéroté. **La salle** lit « Remettez-les dans l'ordre sur votre téléphone » ; à la révélation, chaque carte reste en place et porte son rang, avec le nombre de joueurs qui l'ont mise à sa place. Le téléphone dit « Le bon ordre, bien joué ! » ou « Raté… tu avais mis A → B → C », puis le bon ordre.

**La note** : juste si l'ordre **entier** est le bon ; payée comme un QCM. À moitié juste, elle ne vaut rien.

## Qui dans la salle ?

Rien à écrire : les réponses sont **les invités**, figés quand la question paraît — ceux qui peuvent la jouer, dans l'ordre d'arrivée, soixante au plus. On peut voter pour n'importe qui, soi compris.

**L'invité** voit les noms en deux colonnes, chacun avec son avatar, et en touche un : « Touche un nom : personne ne saura qui a voté pour qui. ». **La salle** lit « Votez sur votre téléphone : qui, dans la salle ? » et le compte des votants ; les noms ne sont pas à la télé. À la révélation, l'écran montre le nombre de votes et les huit plus désignés, le téléphone « La salle a désigné Hugo — 4 votes » et « Tu avais désigné Léa ». Un invité exclu entre-temps disparaît de la liste et ne se désigne plus.

**La note** : aucune. Rien n'y est juste, il n'y a ni plus rapide ni « Cette question », et la question **n'entre pas au journal des réponses** : comptée, elle ferait baisser la précision de ceux qui votent.

## L'estimation

**L'invité** tape un nombre dans « Ton estimation », écrit comme en France (« 35 000 », « 12,5 »), l'unité à côté, et touche « Valider » (« Corriger » ensuite). **La salle** lit « Tapez votre estimation sur votre téléphone (en ans) — le plus proche gagne ! ». À la révélation, l'écran montre la bonne valeur en très grand et les **huit propositions les plus proches**, une cible devant tous les plus proches ex æquo ; le téléphone dit « +194 pts », « Tu as dit 7,9 — à 0,1 près » (« pile-poil ! » à la valeur exacte), puis la bonne réponse.

Une estimation n'est jamais « juste » ni « fausse » : chacun propose un chiffre et marque quelque chose.

### Comment elle se note

C'est la **distance** qui paie, pas le rang :

1. **L'écart** d'une proposition = |proposition − bonne réponse|, compté sur les nombres tels qu'on les a tapés (`ecartEstimation`, `shared/classement.ts`) : en virgule flottante, 0,7 et 0,9 pour 0,8 n'étaient pas à égale distance.
2. **L'écart typique** de la salle = la **médiane** des écarts, jamais au-dessus de la bonne réponse elle-même, jamais sous **deux crans du dernier chiffre** de la bonne réponse (`CRANS_TOLERES` : 2 pour 1 994, 0,2 pour 7,5).
3. **Les points** = 30 + arrondi(170 × 2^(−écart ÷ écart typique)) : 30 pour avoir joué (`GUESS_POINTS`), jusqu'à 170 de proximité (`PROXIMITY_POINTS`) — tout à la réponse exacte, la moitié à l'écart typique (115), un quart au double (73).

L'écart typique vient de la salle : trois ans d'erreur sur une date ne pèsent pas comme trois kilomètres sur une distance.

**Des exemples, calculés par le code** (`pointsDesEstimations`) :

| Bonne réponse | Propositions | Points |
|---|---|---|
| 8 | 7,9 et 8,1 | 194 et 194 — la même distance vaut les mêmes points |
| 8 | 7,9 et 8,2 | 194 et 189 |
| 0,8 | 0,7 et 0,9 | 150 et 150 |
| 1 994 | 1 994 et 1 995 | 200 et 150 |
| 1 994 | 1 994, 1 993, 1 996, 1 990, 2 000, 1 980, 2 024 | 200, 173, 150, 115, 90, 45, 31 |
| 8 | 8,2 et 50 | 197 et 34 |
| 1 994 | 1 995 et 19 940 | 200 et 30 |

Dans la salle de sept, les écarts sont 0, 1, 2, 4, 6, 14 et 30 ; leur médiane, 4, est l'écart typique : 1 990, à 4 ans, touche exactement 115. Une faute de frappe — 19 940 au lieu de 2 024 — n'y changerait les points de personne d'autre : la médiane ignore la valeur des extrêmes.

> [!NOTE]
> Seul à répondre, la médiane est son propre écart : toute proposition plus loin que deux crans, mais pas plus loin que la bonne réponse elle-même, vaut 115 points — 1 000 comme 1 990 pour 1 994. Plus près, davantage (1 995 : 150) ; au-delà de la réponse, moins (5 000 : 90).

### L'estimation en direct

La bonne réponse n'existe pas encore : le poids du gâteau, les bonbons du bocal, la durée du discours. L'animateur coche « En direct » et n'écrit pas de bonne réponse.

La question se joue comme une estimation (« … — on mesure après, et le plus proche gagne ! »). À sa fin — chrono, dernier répondant ou « Révéler » —, elle **attend la mesure** : l'écran affiche « Réponses closes — on mesure ! », le téléphone « On mesure la bonne réponse… ». L'animateur tape la valeur mesurée (« Bonne réponse », puis « Révéler ») : **la taper, c'est révéler**, et la note se calcule comme ci-dessus. « Annuler les points » la révèle sans bonne réponse ni points (« Pas de mesure : la question ne compte pas ») ; « Reposer » la rejoue.

## La photo à mémoriser

Une photo, avec « La photo disparaît avant la question » coché (5 secondes d'office, de 2 à 30 : `DEFAULT_OBSERVE`, `MIN_OBSERVE`, `MAX_OBSERVE`), sur un QCM comme sur une estimation.

1. **La photo passe seule.** L'écran commun la montre en grand (« Regardez bien : la photo va disparaître »), les téléphones aussi (« Mémorise »). **Ni l'intitulé ni les réponses** ne partent aux téléphones : sinon il suffirait de répondre en la regardant. L'animateur peut l'abréger (« Passer à la question »).
2. **La question** arrive sans elle — son adresse même n'est plus envoyée —, et les deux écrans disent « La photo a disparu — de mémoire ! ».
3. **À la révélation**, la photo revient sur l'écran commun, pour vérifier ensemble (ou la photo de la révélation, si la question en a une) ; le téléphone ne la remontre pas.

## Le blind test

Un extrait sonore (MP3, M4A, AAC, OGG, WAV ou WebM, 1,5 Mo au plus : `MAX_SON_OCTETS`), sur un QCM comme sur une estimation. **L'écran commun seul** le joue, dès que la question paraît : « Réécouter l’extrait » le relance, la pause du quiz le fige. Les sons coupés, ou sur une télé qui n'a encore vu aucun geste, il attend qu'on touche « Lancer l’extrait ». Les téléphones ne le reçoivent jamais (invariant 1) : comme tous les sons de la soirée, il sort de l'écran commun seul — cinquante téléphones en même temps, c'est une cacophonie. Il ne change rien à la note.

## Ce qui entoure une question

| Élément | Ce qu'il fait | Où, et quand |
|---|---|---|
| Anecdote (« Le saviez-vous ? », 280 caractères) | l'histoire qu'on a envie de raconter une fois la réponse connue | à la révélation seulement : écran commun, téléphone, télécommande, bilan |
| Photo de la révélation | une seconde photo, distincte de celle de la question (le bébé, puis l'adulte) | à la révélation, sur l'écran commun |
| Intertitre (80 caractères) | une diapo sans réponse ni points avant la question (« Manche 2 : le cinéma ») | écran commun et téléphones (« La question arrive… ») ; jusqu'au clic, ou le temps de l'enchaînement ; pas rejoué quand on repose la question |
| Note de l'animateur (280 caractères) | ce qu'il voulait raconter (« raconte le voyage à Rome ») | à sa télécommande seulement : ni la télé, ni les téléphones |
| Catégorie | l'une des douze catégories fixes | au-dessus de l'intitulé, sur tous les écrans |

Rien de ce qui pourrait trahir la réponse — l'anecdote, la photo de la révélation, les bonnes réponses de « plusieurs », le bon ordre — n'arrive avant la révélation.

## Les ex æquo et le départage

Une seule règle sert tous les classements — le quiz, la soirée, les équipes, le souvenir, le bilan, les prix, l'expérience (`shared/classement.ts`) :

- **Le rang est partagé** : 1 + le nombre de concurrents strictement devant. Deux premiers ex æquo, puis un troisième — pas de deuxième.
- **Tous les ex æquo en tête gagnent**, à condition d'avoir marqué : un quiz où tout le monde finit à zéro n'a pas de vainqueur.
- **L'ordre dans lequel s'écrivent des ex æquo** — le nom affiché, puis l'identifiant — n'est qu'un ordre d'affichage : il ne décide de rien, mais ne bouge pas d'un rafraîchissement à l'autre.
- **Une estimation** : même écart, mêmes points, même rang ; la rapidité ne départage pas (à l'écran commun, elle range seulement l'affichage des ex æquo).
- **Un QCM** : la rapidité est déjà dans les points ; elle ne départage pas autrement.

## Le barème des équipes

Les points d'équipe = **Σ sur chaque question de la soirée** (points des lignes du journal écrites pour cette équipe ÷ nombre de ces lignes), arrondi à la fin, **+ les prix**. Chaque ligne fige l'équipe de son joueur au moment où elle s'écrit ; un membre ne compte que pour les questions qu'il a eues sous les yeux. Un prix vaut 0 point d'office (`POINTS_D_UN_PRIX`), de −500 à +500 si l'animateur lui en donne (`PRIX_MAX`). Le plus de points d'équipe l'emporte ; à égalité, les équipes gagnent ensemble. Expliquée, avec un exemple : [La soirée](la-soiree.md#les-équipes-et-leurs-points).

## Ce qui ne rapporte rien

Une mauvaise réponse, ou pas de réponse ; « Qui dans la salle ? » et l'intertitre ; une réponse arrivée trop tard (« Trop tard — la question était finie ») ou pendant une pause ; une question aux points annulés, une estimation en direct jamais mesurée ; les réponses du chef qui anime seulement (« Hors classement : tu animes ») ; une question posée avant l'arrivée d'un retardataire ; un prix à 0 point — et aucun prix ne rapporte jamais d'expérience.

## Ces règles servent aussi au quiz du jour

Le quiz du jour paie ses QCM avec les mêmes fonctions : `server/src/core/jour.ts` importe `pointsDuChoix`, `tempsDeLecture`, `GRACE_MS`, `bonusDeRapidite` et `POINTS_MAX_PAR_QUESTION` (200, la base de son expérience). Retoucher `CHOICE_POINTS`, `SPEED_BONUS` ou le temps de lecture change donc aussi ses parties à venir — un choix de produit, des deux côtés ([Le quiz du jour](le-quiz-du-jour.md)).

Les points d'une question jouée en soirée sont écrits au journal et ne se recalculent jamais : une soirée garde le barème de son soir. `VERSION_BAREME` relit seulement ce qui s'en dérive — l'expérience, les prix, les hauts faits ([Les récompenses](les-recompenses.md)).

## Comment c'est construit

Toute la logique de jeu vit au serveur ; les téléphones et les écrans ne reçoivent que des **vues filtrées**.

| Pièce | Rôle |
|---|---|
| `server/src/core/engine.ts` | Le moteur (`GameEngine`) : une partie à la fois par espace ; il route réponses, commandes et chronomètres vers le module, écrit l'état (chronomètres réarmés au redémarrage), rediffuse les vues |
| `server/src/games/quiz.ts` | Le module du quiz (`quizModule`) : les phases, les chronomètres, le barème (`tempsDeLecture`, `pointsDuChoix`, `pointsDesEstimations`, `reponseJuste`), les vues (`playerView`, `hostView`) |
| `shared/library.ts` | Les sortes et leurs bornes ; `toPlayable` ne garde que les questions prêtes |
| `shared/hasard.ts` | La copie jouée (`preparerPartie`), tirée une fois pour toute la salle : réponses mélangées, questions tirées, ordre à retrouver |
| `shared/games/quiz.ts` | Le contrat des vues, des réponses et des commandes |
| `shared/classement.ts` · `shared/teams.ts` | Les ex æquo ; les points d'équipe |
| `client/src/games/quiz/PlayerView.tsx` · `client/src/games/quiz/HostView.tsx` | Le téléphone ; l'écran commun et la télécommande |

Une réponse (`player:action`) reçoit son accusé aussitôt, et ne recalcule que deux vues : la sienne, et celle de l'écran commun, qui reçoit le compteur quatre fois par seconde au plus. À la révélation, le module écrit les gains et le journal, et chaque écran reçoit sa vue (`session:view`).

Deux invariants tiennent l'ensemble :

- **La logique est cent pour cent serveur** (invariant 1) : un téléphone reçoit sa vue, jamais l'état de la partie — sinon la bonne réponse arriverait avant la révélation. Pendant une question, sa vue porte sa seule réponse ; la note de l'animateur, l'extrait d'un blind test et le programme ne partent qu'aux écrans d'animateur.
- **Un geste dit ce qu'il visait** (invariant 12) : « Révéler », « Question suivante », « Reposer », « Annuler les points » et la mesure d'une estimation en direct portent la phase, la question et le tour visés ; une réponse, la question et le tour. Périmé, un geste est ignoré en silence, une réponse reçoit « trop tard » : un « Révéler » parti juste avant la révélation automatique ne la fait plus sauter.

Les formules se testent directement dans `server/test/bareme.test.ts`, chaque sorte dans `server/test/variantes.test.ts`.

## Pour aller plus loin

- [La soirée](la-soiree.md) — une soirée de bout en bout, les équipes, les podiums
- [Les quiz](les-quiz.md) — écrire ses questions, les régler, les mélanger
- [Les barèmes](../reference/baremes.md) — chaque constante et ce que la changer implique
- [Le temps réel](../architecture/temps-reel.md) — vues, accusés, gestes visés, horloge
- [Le serveur](../architecture/serveur.md) — le moteur, le module de jeu, les registres
