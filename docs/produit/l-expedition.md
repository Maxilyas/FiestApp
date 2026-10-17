# L'Expédition

> Un mode pour les profils, où l'on gagne les légendaires du jeu : trois actes, chacun une carte tirée au sort, un gardien au bout de chacun — un légendaire —, et l'un des trois à garder au bout du troisième. Comment on la joue, ses règles chiffrées, ce qui reste à venir, puis comment c'est construit.

**Dans cette page** : [En bref](#en-bref) · [Partir](#partir) · [La carte d'un acte](#la-carte-dun-acte) · [Les escales](#les-escales) · [Le gardien](#le-gardien) · [La fin](#la-fin) · [Ce qu'elle paie](#ce-quelle-paie) · [Ce qui vient ensuite](#ce-qui-vient-ensuite) · [Les règles chiffrées](#les-règles-chiffrées) · [Comment c'est construit](#comment-cest-construit)

> [!NOTE]
> L'Expédition se construit en quatre étapes (le brief : `retours/2026-10-17/expedition.md`, validé par le propriétaire le 17 octobre 2026). Cette page dit la première : la carte, et une expédition de bout en bout. **Elle ne s'ouvre pas encore en production** — ses routes y répondent « L’expédition arrive bientôt » — : sans les jokers de l'étape 2, le joueur moyen n'arriverait au bout que cinq fois sur cent. La préproduction et `npm run dev` la jouent, à `/expedition` ; aucun bouton n'y mène encore.

## En bref

- **Trois actes, trois gardiens.** Chaque acte est une carte tirée au sort pour cette expédition : six étages d'escales, des chemins qui ne se croisent jamais, deux campements, puis le gardien.
- **On choisit sa route.** Chaque escale pose une question d'une catégorie, d'un mélange de deux ou trois, ou d'un thème pointu, et la carte dit, sur chacune, la chance qu'on a de la trouver. La page propose le tracé le plus sûr, et dit la chance d'arriver au gardien, puis de le vaincre.
- **Trois vies**, qui passent d'un acte à l'autre : une question ratée en coûte une, une source retrouvée et un campement en rendent une.
- **Les légendaires se gagnent au bout, et seulement là** : les trois gardiens sont trois légendaires qu'on n'a pas ; après le troisième, on en garde un.
- **Gratuite et sans limite**, une à la fois, qui se reprend où on l'a laissée.

## Partir

La page de l'expédition (`/expedition`) dit ce qui t'attend : **les trois gardiens**, l'acte de chacun et ce qu'il demande, et ce que dure une expédition — vingt à trente questions. Les gardiens se tirent parmi les légendaires que tu n'as pas et qui ont leur joker ; ceux de saison n'en sont jamais, ils ne se gagnent qu'à leur saison. S'il n'en reste pas assez, les places se prennent parmi les tiens : la page le dit avant le départ, « déjà à toi » — le garder au bout ne te rapporterait que l'expérience de tes réponses.

« Partir » tire tes trois cartes. Une seule expédition à la fois : « ← Partir », en haut, la laisse où elle en est, sans rien perdre, et la page la reprend telle quelle ; « Abandonner l’expédition », sous la carte, la finit là.

## La carte d'un acte

La carte se lit de bas en haut : on part d'en bas, chaque escale mène à une ou deux escales de l'étage du dessus, les deux campements attendent en haut, puis le gardien.

- **Chaque escale dit ce qu'elle pose** : sa catégorie (son emblème, son nom en dessous), un mélange de deux ou trois catégories (« Mélange ×2 » : sa question vient de l'une d'elles), ou un **thème pointu** — un thème, une époque ou un fil rouge de la campagne. La goutte est une source, le feu un campement.
- **Ta chance sur chaque escale**, dans son coin, en couleur de piste comme sur les sentiers : verte, bleue, rouge, noire — et sa forme, pour qui ne distingue pas les couleurs. Elle se calcule à ton départ, sur ce que le modèle du savoir sait de toi, à la marche de l'escale ; tant qu'il ne te connaît pas — moins de vingt premières réponses en campagne —, c'est celle d'un joueur moyen, et la carte le dit.
- **Le tracé.** La page propose d'abord le tracé le plus sûr jusqu'au campement : celui qui te donne la meilleure chance de vaincre le gardien, arriver compris. Toucher une escale le redessine par elle, en gardant le début que tu as choisi ; « Le plus sûr » le rend. Sous la carte, ce que tu as touché, et tes chances sur ce tracé : d'arriver au gardien vivant, puis de le vaincre.
- **Seul le pas suivant engage** : « Avancer » mène à la première escale du tracé, et la carte se redessine à chaque escale.

## Les escales

- **Une question** : trouvée, l'escale est passée ; ratée, elle coûte une vie, et l'escale est passée aussi — on ne la rejoue pas.
- **Une source** : une question de ton carnet, celle qui attend le plus — à défaut, une facile. Retrouvée, elle te rend une vie ; ratée, elle ne coûte rien : le carnet la garde.
- **Un campement** : il te rend une vie, jusqu'à trois. De là, le gardien.

Les questions viennent de la base de la campagne, jamais de la réserve du quiz du jour, tirées comme une marche de série : jamais vues d'abord. Chacune se signale après sa réponse, comme en série.

## Le gardien

Le gardien pose ses questions, toutes catégories, jusqu'à ce que tu en aies trouvé autant qu'il en demande — quatre faciles à l'acte 1, trois moyennes à l'acte 2, trois difficiles à l'acte 3 ; chaque erreur te coûte une vie. Ses crans se remplissent à chaque bonne réponse. Vaincu, l'acte suivant s'ouvre sur sa carte, et tes vies te suivent. À la dernière vie perdue, en route ou face à lui, l'expédition s'arrête.

## La fin

- **Le troisième gardien vaincu**, les trois t'attendent : tu en gardes un, et c'est définitif. Le légendaire est à toi comme s'il l'avait été par sa première voie : il paraît dans ta collection, et se porte. Les deux autres retournent sur la carte : tu les recroiseras.
- **Puis l'écran des gains**, le même qu'à la fin de chaque mode : le légendaire gardé, « Ce que tu gagnes », « Nouveaux trophées », « À porter » ; « Mes réponses » redonne chaque question, la bonne réponse et l'anecdote.
- **Perdue ou abandonnée**, le même écran, sans légendaire : l'acte atteint, les gardiens vaincus, et le rappel que tes questions ratées reviendront à ton carnet.

## Ce qu'elle paie

| | Compte | Pourquoi |
|---|---|---|
| Un confetti par bonne réponse | oui | comme dans tous les modes |
| L'expérience d'une bonne réponse | oui, comme en campagne | le barème ne bouge pas : aucune expérience de plus pour un gardien |
| Le Marathonien | oui | il compte l'effort |
| Le carnet | toutes ses erreurs ; une source retrouvée y compte comme une révision | elle repose une question du carnet |
| La mesure des difficultés, les écussons et la précision, L'Érudit | ses réponses, sauf celles d'une source | une source repose ce qu'il a raté, réponse lue : comme une révision, elle ne dit rien de la question ni de son savoir |
| Les records, la Grande Série, L'Alpiniste, l'Éclat | non | l'expédition n'est pas une série |
| Le légendaire | oui | au bout de l'acte 3 |

## Ce qui vient ensuite

L'étape 1 pose la carte et une expédition de bout en bout. Les trois suivantes, chacune sa PR :

- **Les jokers** — ce qu'on a gagné sert enfin : chaque légendaire devient un joker (le catalogue est déjà là, `shared/jokers.ts`), deux partent avec soi, l'invité du jour prête le sien ; le paquet, la main, la défausse ; les élites et les coffres sur la carte. Puis un gros bouton à l'accueil, et l'expédition ouverte en production.
- **Les formes** — vrai ou faux, six choix, le dévoilement mot à mot.
- **Les écus** — l'échoppe, les talismans, l'inconnu.

D'ici là, la carte tire déjà ces escales et ces formes, à leurs proportions — et pose une question à la place d'une élite, d'une échoppe ou de l'inconnu, une source à la place d'un coffre, quatre choix à la place des autres formes.

## Les règles chiffrées

| | Valeur |
|---|---|
| Actes | 3, un gardien chacun |
| Une carte | 6 étages de 4 colonnes, 5 chemins, 2 campements, le gardien |
| Le premier étage | des questions d'une catégorie |
| Les étages 2 à 6 | question 46 %, élite 12 %, source 10 %, coffre 12 %, l'inconnu 8 %, échoppe 5 % — à l'étape 1, élites, échoppes et inconnus en questions, coffres en sources ; une source et un coffre au moins par acte |
| Les thèmes | un mélange de deux ou trois catégories 18 %, un thème pointu 14 %, sinon une catégorie |
| Les marches | acte 1 : facile, puis facile ; acte 2 : facile, puis moyenne ; acte 3 : moyenne — jamais d'experte |
| Le gardien | 4 bonnes réponses faciles, puis 3 moyennes, puis 3 difficiles |
| Les vies | 3 au départ, 3 au plus ; −1 par question ratée, +1 par source retrouvée et par campement |

Chaque constante, sa valeur et ce que la changer implique : [les barèmes](../reference/baremes.md#lexpédition). **Le calibrage** : `server/scripts/calibrage-expedition.ts` rejoue des milliers d'expéditions sur le vrai code, pour un joueur faible, moyen et fort. Sans jokers, le 17 octobre 2026 : le faible n'arrive jamais au bout, le moyen cinq fois sur cent, le fort quarante-deux fois — la simulation du brief disait 0, 3 et 38. La cible, avec les jokers : le moyen une fois sur trois, le fort huit fois sur dix.

## Comment c'est construit

- **Tout ce qui se calcule est pur**, dans `shared/expedition.ts` : le générateur des cartes (`carteDUnActe`, tirée de la graine de l'expédition par `hasardDe` — la même graine redonne la même carte), les marches, la chance ramenée à sa forme, la chance d'arriver et de vaincre (`chancesDuTrace`, vie par vie), le tracé le plus sûr (`traceLePlusSur`, tous les tracés comptés), et le pli (`pliDeLExpedition`) : l'état d'une expédition n'est écrit nulle part, il se replie de son départ, de ses gestes et de ses réponses — le même pour celle qu'on joue et pour une finie (invariant 14). La page calcule le tracé dans le téléphone, sur les chances que le serveur a déjà montrées.
- **Une expédition est une partie de la campagne d'un autre mode** (`campagne_series`, `mode = 'expedition'`) : ses réponses vont au journal de toutes les parties — l'expérience, les confettis, le carnet et « jamais vues d'abord » les comptent sans rien en savoir. Son départ — ses trois cartes et la chance sur chaque escale, ses gardiens — se garde avec elle (la colonne `expedition`) : une retouche du générateur ne déplace pas une escale sous les pieds de qui joue. Ses gestes vont à leur journal (`expedition_gestes`), chacun avec le rang qu'il suit : un double toucher, un second onglet ne jouent pas deux fois (invariant 12). Voir [la base de données](../reference/base-de-donnees.md).
- **Le serveur tire et juge** (`CampagneStore`, « L'Expédition », `server/src/core/campagne.ts` ; les routes, `server/src/expedition.ts`) : la question d'une escale se tire dans le lot même du geste qui y mène, celles du gardien d'un coup ; la bonne réponse et l'anecdote n'arrivent qu'avec le verdict (invariant 1). Chaque requête lit d'un lot et écrit d'un lot, sous le verrou du profil. Voir [l'API HTTP](../reference/api-http.md#lexpédition).
- **Le légendaire gardé** est une ligne `expedition:<légendaire>` de l'étagère, hors de l'étagère qu'on voit et du compte des badges, comme les saisons ; chaque légendaire qui a son joker reçoit la voie qui la lit (`aussi`, `shared/legendaires.ts`) — une voie de plus, qui ne reprend rien à personne (invariant 22). Tant que l'expédition n'est pas ouverte en production, cette voie ne se montre nulle part (`voiesMontrees`). Les Divins n'ont ni joker ni gardien (invariant 21).
- **La page** : `client/src/views/ExpeditionApp.tsx` — le départ, la carte et son tracé, l'escale, le gardien, le gardien vaincu, le choix, la fin par l'écran des gains (`Gains.tsx`). `server/scripts/rendu-expedition.ts` photographie chaque écran en 360 × 640.
- `.claude/rules/expedition.md` — les fichiers et les pièges du domaine, pour qui modifie le code.
