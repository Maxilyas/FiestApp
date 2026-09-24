# FiestApp — des quiz entre amis 🎉

Une application pour jouer facilement à des quiz entre amis, façon Kahoot, gratuite et auto-hébergée. On scanne un QR code et on joue depuis son téléphone, dans le navigateur, sans rien installer : **avec un profil**, qui garde sa progression d'une soirée à l'autre, ou **directement, sans s'inscrire** — un prénom, un avatar, et c'est parti. Un écran commun (TV, vidéoprojecteur) anime la partie, et un classement cumulé traverse tous les quiz de la soirée, en individuel **et** par équipe.

Plusieurs animateurs partagent le même serveur : chacun a **son compte et son espace** — ses quiz, ses soirées, son historique, son adresse à scanner — et ne voit rien de ceux des autres. Un quiz se passe de l'un à l'autre en un fichier.

## Démarrage rapide

Prérequis : Node ≥ 20.

```bash
npm install
```

```bash
npm run dev
```

Chez soi, sur une base neuve, le compte administrateur est `antoine` / `demo` et son espace s'appelle `demo` (variables `ADMIN_*`, voir plus bas). Les adresses, une par usage :

| Page | Adresse | Pour qui |
|---|---|---|
| Accueil | http://localhost:5173/ | tout le monde : on s'y connecte avec son profil, on anime sa soirée ou on en rejoint une — et « Rejoindre une soirée » y reste à un geste, sans compte |
| Jeu | http://localhost:5173/demo | les invités (sur leur téléphone : `http://<IP-du-PC>:5173/demo`). Le QR de l'écran commun, lui, vise le port du serveur, qui ne sert que le client construit : pour jouer avec de vrais téléphones, voir « Tester avec de vrais téléphones » |
| Écran commun | http://localhost:5173/host | la TV / le vidéoprojecteur, une fois l'animateur connecté |
| Mes quiz | http://localhost:5173/edit | l'animateur, pour écrire ses quiz |
| Mon profil | http://localhost:5173/profil | la même page que l'accueil : son niveau, ses finitions, ses avatars légendaires et divins, ses hauts faits et sa fiche |
| Mon compte | http://localhost:5173/compte | ses réglages de soirée, son mot de passe, l'adresse de ses invités |
| Les comptes | http://localhost:5173/admin | l'administrateur seul : créer un compte à un ami |
| Souvenir | http://localhost:5173/demo/souvenir | la soirée en cours — et, entre deux soirées, la dernière close : podium, palmarès, équipes et tous les chiffres ; la page se rafraîchit seule (`/demo/stats` y mène, droit sur le tableau) |
| Bilan | http://localhost:5173/demo/bilan | la soirée en cours — et, entre deux soirées, la dernière close : chacun relit ses réponses ; l'animateur y trouve les fiches à imprimer |
| Soirées | http://localhost:5173/demo/soirees | l'historique : chaque soirée close, avec son souvenir, chiffres compris, et son bilan, chacune à une adresse qui ne change plus |

```bash
npm run verify
```

`verify` enchaîne les quatre : `check` (typecheck serveur + client), `test`
(les tests ciblés), `build` (le client) et `smoke`. C'est la commande à lancer
avant de committer, et c'est exactement ce que fait l'intégration continue sur
chaque proposition de modification (`.github/workflows/ci.yml`).

`smoke` = test de bout en bout (comptes et sessions, suppression d'un compte, garde-fous, isolation des espaces, inscription, quiz complet, scoring, classement, reconnexion, accusé de réception des réponses, heure du serveur et marge de fin de question, bibliothèque, photos, estimation et estimation saboteuse, retardataire, photo « mémoire », équipes, barème des équipes, statistiques et prix, bilan question par question et export, anciennes adresses, reprise après coupure avec deux parties en cours, historique des soirées, mise à jour d'une base d'avant les comptes, profils joueurs, expérience créditée dès la fin du quiz, prix et fin de soirée à la clôture, entrée et homonymes, profil rattaché à un espace).

`test` = les tests ciblés de `server/test/*.test.ts`, lancés par `node:test`
— aucune dépendance de plus. Ils tentent ce qu'une soirée rejouée d'un bout à
l'autre ne tente jamais : une base distante en panne, deux clics qui se
croisent, un message malformé, un réveil sur disque effacé, un processus tué
juste après une révélation. Ceux qui ont besoin d'un serveur en démarrent
chacun un, jetable, avec le banc d'essai (`server/test/banc.ts`), qui sait
aussi le redémarrer sur disque effacé, comme l'hébergeur à chaque réveil. Un
nouveau comportement arrive avec son test dans `server/test/` : le smoke est
stateful d'un bout à l'autre, et chaque scénario de plus y fragilise ceux
d'après.

Il n'y a ni linter ni formateur : le typecheck, les tests et le test de bout
en bout tiennent lieu de filet, et la relecture fait le reste.

**Si tu travailles avec Claude Code**, `CLAUDE.md` à la racine lui dit les
conventions, les invariants et les pièges du dépôt — il le lit tout seul. Un
hook de démarrage (`.claude/hooks/session-start.sh`) installe les dépendances
au réveil d'une session web, pour que `npm run verify` marche d'emblée.

## Les comptes et les espaces

Un compte = un animateur = un **espace**, désigné par un nom court dans l'adresse (`/demo`, `/chez-bob`). Tout ce qui se joue, s'écrit ou se range est rattaché à l'espace :

- **ses quiz et ses photos** (`/edit`) ;
- **sa soirée en cours** — invités, équipes, points, partie en cours — et son écran commun (`/host`) ;
- **son historique** (`/demo/soirees`) et les pages publiques de chaque soirée (`/demo/souvenir` et `/demo/bilan` pour celle en cours — ou, entre deux soirées, la dernière close —, `/demo/soirees/<id>/…` pour chacune) ;
- **ses réglages** (`/compte`) : le titre de la soirée, le surtitre et le grand titre de l'écran d'inscription (« La soirée de / Bob »), la date telle qu'on l'écrit, le nombre maximal d'invités.

Les pages d'animation ne portent pas l'espace dans l'adresse : c'est la session de l'animateur connecté qui le dit. Un identifiant de quiz ou de soirée qui n'est pas du sien vaut « introuvable », et une commande envoyée à la partie d'un voisin est refusée sans que le voisin en sache rien. Les pages des invités, elles, restent **publiques par leur lien**, comme avant : le souvenir — chiffres compris — et le bilan se partagent dans le groupe sans compte. Un fil sous leur titre mène de l'une à l'autre et à l'historique, et rappelle à l'animateur connecté le chemin de son compte.

**Les comptes se créent depuis `/admin`**, par l'administrateur seul : un prénom, un identifiant, un nom d'adresse, et l'application rend un **lien d'activation** à envoyer par le canal qu'on veut. L'ami ouvre le lien, choisit son mot de passe, et son espace est prêt — avec une bibliothèque vide. Le lien vaut sept jours et ne sert qu'une fois ; **un mot de passe oublié se règle par un nouveau lien**, depuis la même page. Un compte se désactive (ses écrans se ferment, ses pages restent lisibles) et se réactive. Un compte désactivé peut ensuite être **supprimé** : ses quiz, ses photos, ses soirées archivées et sa soirée en cours partent avec lui, sans retour, et son identifiant comme son adresse redeviennent libres — **exporte ses soirées avant** si tu veux en garder une trace, une par une (`npm run export -- https://ton-app.onrender.com --slug chez-bob --soiree <id>`, les identifiants sont dans l'adresse de leurs pages, sous `/chez-bob/soirees`), ou fais une sauvegarde de toute la base (`npm run sauvegarde`). L'espace de l'administrateur, celui où mènent les anciennes adresses, ne se supprime pas.

**Pour l'administrateur**, rien ne change : son compte naît au premier démarrage depuis `ADMIN_LOGIN` / `ADMIN_PASSWORD` / `ADMIN_SLUG` / `ADMIN_NAME`, et tout ce qui existait avant les comptes — bibliothèque, photos, archives, soirée en cours — lui est rattaché au premier démarrage, sans rien copier ni effacer. Les anciennes adresses (`/bilan`, `/souvenir`, `/soirees/<id>/…`) redirigent vers son espace : les liens déjà partagés et les QR déjà imprimés restent bons. La racine `/`, elle, est l'accueil : qui arrive sans lien y trouve « Rejoindre une soirée », qui lui demande le nom de la soirée.

## Les profils joueurs

**L'entrée est un écran de connexion — et personne n'est obligé d'y passer.** On scanne, on voit deux champs, « Me connecter », puis « Jouer sans compte » juste en dessous, au même format, visible sans défiler. Qui n'a pas de profil appuie sur ce bouton-là, tape un prénom, choisit un avatar, et joue : c'est toujours un geste de plus que rien, et c'est le chemin de la moitié de la salle. Les champs n'ouvrent pas le clavier tout seuls — ni là, ni à l'écran du prénom —, justement pour que le bouton qui permet de passer reste visible. Le téléphone retient ensuite le prénom et l'avatar choisis : la fois suivante, et après la clôture d'une soirée, il arrive directement à l'écran du prénom, pré-rempli, et n'a qu'à confirmer — l'équipe ensuite, s'il y en a.

**Et qui revient ne rechoisit rien.** Le téléphone se souvient un an : Alice retrouve son avatar, son niveau et un seul bouton, « Entrer dans la soirée ». Son prénom et son emoji, elle les a choisis une fois en créant son profil — on ne les lui redemande jamais. Elle peut jouer sous un autre prénom pour la soirée, ça ne change rien à son profil.

Un profil (`/profil`) garde ce qu'on a fait **d'une soirée à l'autre et d'un animateur à l'autre** : de l'expérience, un niveau, des finitions d'avatar. Il se crée depuis l'entrée en deux écrans — le prénom et l'avatar, puis un identifiant et un mot de passe —, ou d'un seul entre deux quiz, le prénom du soir déjà rempli, et se retrouve ensuite tout seul. Si l'identifiant voulu est pris, l'entrée en propose un libre (« camille2 ») qu'on prend d'un geste : un refus sec laisserait debout, dans le noir, quelqu'un qui ne sait pas quoi tenter d'autre.

**Animateur et joueur sont la même personne.** Un animateur rattache son profil
joueur à son espace depuis « Mon compte » — une fois, en prouvant les deux
identités — et n'a plus qu'un mot de passe à retenir : celui de son profil
ouvre la console depuis l'accueil, et son niveau le suit quand il joue à sa
propre soirée comme chez les autres. Les deux tables restent séparées, et
c'est voulu : `accounts.id` **est** le `space_id` qui cloisonne toute
l'application, il ne peut pas bouger. Un compte est donc un *espace* qu'une
personne tient, pas une seconde identité. Se déconnecter de son profil referme
la console qu'il avait ouverte — et seulement celle-là. Le détacher de l'espace,
ou en rattacher un autre, referme toutes celles qu'il avait ouvertes, sauf celle
d'où l'on fait le geste : c'est ce qu'on fait quand on doute de qui connaît son
mot de passe.

**Un profil ne donne jamais un avantage de jeu.** Pas de point bonus, pas de temps en plus, pas de question plus facile : une soirée où les inscrits marqueraient plus ne serait plus une soirée. Il donne du prestige et de la durée, jamais de la performance. C'est pour la même raison qu'un invité anonyme n'affiche **rien** — ni « Niv. 0 », ni pastille grise. L'absence, pas l'infériorité.

**L'expérience se mérite.** Répondre rapporte 1 point, une bonne réponse 3, et 2 de plus parmi le tiers le plus rapide des bonnes réponses ; une estimation rapporte 5 au plus proche, 3 dans le tiers le plus proche. Un quiz a son podium — 25, 15, 10 — et 15 de plus pour un sans-faute. À la clôture de la soirée s'ajoutent le podium de la soirée (60, 40, 25), 10 pour avoir répondu à presque tout, et les hauts faits. Plus rien pour la simple présence : un invité qui repartait après une question en touchait presque autant que celui qui avait tout gagné. Les ex æquo partagent leur rang et touchent chacun la part entière.

Tout se gagne **dès deux joueurs** : un duel est une vraie partie. Ce qui ferme la porte aux parties fabriquées, ce sont les questions — un quiz n'a de podium qu'à **cinq questions**, la soirée qu'à **quinze** — et le podium, qui a toujours **une marche de moins que la salle** : à deux, seul le premier y monte. Un joueur seul devant son téléphone ne gagne rien. Et l'animateur qui joue chez lui gagne comme tout le monde : on l'avait mis hors concours parce qu'il connaît ses quiz, et il ne progressait jamais aux soirées qu'il organise.

**La courbe se mérite** : le niveau *n* demande 60 × (*n* − 1)² points. Le niveau 2 tombe le premier soir ; le niveau 10 demande une vingtaine de soirées de deux quiz de trente questions — une dizaine pour le meilleur de la salle —, et le niveau 20 redevient une légende (les chiffres, mesurés par simulation, sont dans [RECOMPENSES.md](RECOMPENSES.md)). La courbe a été durcie une fois : **personne n'a perdu un niveau**. Chaque profil garde celui qu'il avait atteint, tant que l'ancienne courbe le lui donne, et sa barre compte depuis zéro jusqu'au niveau suivant.

L'expérience d'un quiz se crédite **dès que son podium s'affiche**, et elle est définitive : le podium de la soirée, qui se renverse d'un quiz à l'autre, ne se décide qu'à la clôture — l'expérience ne redescend jamais en cours de soirée. Le téléphone le célèbre par-dessus l'écran (« +72 XP · Niveau 2 ! »), et l'écran commun annonce les montées de niveau à toute la salle. La ligne `(profil, soirée)` est remplacée à chaque fois, jamais ajoutée : recalculer dix fois la même soirée ne crédite jamais deux fois. Et quand le barème change, **les soirées passées se relisent avec le nouveau** : au démarrage, chaque soirée de l'historique est recréditée — l'expérience est une dérivation des journaux, comme le souvenir.

**Les finitions** habillent l'avatar sans jamais changer l'emoji : Alice reste le renard, c'est ce qui l'entoure qui dit son niveau. Mat au départ, **Argent** au niveau 3, **Or** au 6, **Holo** au 10, **Prisme** au 15, **Aurore** au 20, **Constellation** au 25. Par défaut, on porte la plus belle qu'on a ; on peut en épingler une autre. Sur un avatar légendaire, la finition ne fait pas de halo : elle **devient le cercle du médaillon** — bronze au départ, puis argent, or, irisé, prisme, aurore, nuit étoilée.

**L'Éclat**, lui, ne se gagne pas. À chaque soirée qui compte, **une chance sur quarante** qu'un de vos avatars « s'éclate » : l'emoji lui-même change de couleurs et se pare de paillettes, définitivement, et pour celui-là seulement. Sous un avatar légendaire, **c'est le légendaire qui éclate** : il prend sa version rare, dessinée — le Phénix de glace, le Tigre blanc, la Licorne noire… Un Divin, lui, n'éclate pas. On ne peut ni l'acheter ni l'accélérer, seulement venir jouer. La fin de soirée **l'annonce**, au téléphone de celui qui l'a et à toute la salle. Une soirée jouée seul ne compte pas : ni pour l'Éclat, ni pour L'Habitué.

**Les hauts faits** se lisent à la clôture de chaque soirée, sur ses journaux. Vingt de soirée, qui se regagnent : des **exploits** — le Grand Chelem, la Foudre, le Phénix, Seul contre tous, l'Oracle… — et des **coups du sort** assumés — la Lanterne Rouge, le Kamikaze, la Girouette, l'Estimation Cosmique… : on en gagne aussi en jouant mal. Dix de carrière, en trois paliers, Bronze, Argent, Or : dix soirées, cinq cents réponses, cent réflexes… Tout le catalogue se voit sur `/profil`, avec la jauge du palier suivant — savoir ce qui vient donne envie de revenir. Une salle de moins de quatre joueurs n'en décerne aucun : l'expérience se gagne à deux, mais à deux, « la Lanterne Rouge » tomberait à chaque partie.

**Les avatars légendaires** sont douze médaillons dessinés — le Phénix, le Dragon d'Or, la Chouette d'Argent, le Kraken… — qui se méritent sur la durée : un exploit rare (un Grand Chelem, un Triplé) ou le même haut fait, soirée après soirée (dix Foudres pour le Tigre, huit couronnes pour le Lion). Il faut une vingtaine de quiz au premier de la bande qui en décroche un. Celui qu'on porte remplace l'emoji sur tous les écrans ; les autres attendent en silhouette dorée sur la page du profil, avec leur règle et ce qui manque. Ce qui était gagné avant que les règles se durcissent reste gagné.

**Les Divins** sont cinq avatars au-dessus des légendaires — Hélios, le Séraphin, le Lotus Sacré, l'Arbre-Monde, l'Ange Déchu — dessinés pour déborder de leur cadre : rayons, ailes, anneau brisé. **Personne ne sait ce qui les fait descendre.** La page du profil les montre voilés, sans nom ni règle ; le téléphone ne reçoit jamais que la liste de ceux qu'on a, et leur légende, qui raconte après coup ce qu'il a fallu faire ; les règles et les légendes vivent côté serveur, dans `server/src/core/divins.ts`, et ce README s'arrête là. Ils sont faits pour être rares — de grandes salles, des soirées entières. Quand l'un descend, toute la salle le voit à la clôture. Un Divin ne prend ni finition ni Éclat, et, comme tout le profil, ne donne aucun avantage de jeu.

**La carte d'un joueur.** Sur le téléphone, toucher un nom du classement ouvre sa carte : ce qu'il fait ce soir et, s'il a un profil, son niveau, ses légendaires, ses récompenses les plus rares et quelques chiffres. Un invité anonyme a la sienne, sans rien qui dise ce qui lui manque. Le renommage de l'animateur est un **surnom pour la soirée** : il s'affiche partout ce soir-là, le profil garde son prénom, et la carte dit les deux.

**Les prix de soirée** sont ceux du palmarès de la page souvenir — L'Éclair, Le Cancre Magnifique, Le Franc-Tireur… Il n'y a pas de second catalogue à tenir : ce que la page affiche est exactement ce qui se range sur l'étagère des profils, à la clôture, sur la soirée entière — que l'animateur l'ait remis à l'écran ou non. Un prix ne rapporte **jamais d'expérience**, ni celui du palmarès ni celui qu'on remet à l'écran : l'un se juge sur une seule soirée, l'autre se donne à la main, et aucun des deux ne doit peser sur un niveau. Un prix n'a jamais qu'un lauréat, et un invité exclu avant la clôture n'y reçoit rien. Retirer une soirée de l'historique reprend tout ce qu'elle avait rapporté.

**La rareté est calculée, pas décrétée** : c'est la part des profils qui portent le badge, rangée en paliers (commune → légendaire), et elle bouge avec la population — un badge que tout le monde finit par avoir redevient commun. En deçà de dix profils inscrits, elle se tait et annonce simplement le nombre de porteurs : à cinq inscrits, « légendaire » ne voudrait dire que « une seule personne l'a », ce qui est vrai de presque tout.

**Le mot de passe oublié se règle par un code de secours**, affiché une seule fois à l'inscription — et il y a un écran pour s'en servir, depuis l'entrée comme depuis la page profil. Le code se consomme et on en rend un neuf. Pas d'adresse e-mail : aucune donnée personnelle, rien à héberger, et qui perd tout garde le chemin anonyme, qui n'a jamais été fermé.

## Deux Camille dans la salle

À cinquante invités, c'est une certitude. On ne refuse pas la seconde — un profil serait refoulé à cause du prénom de quelqu'un d'autre — et on ne renomme personne d'office. **Le prénom n'a pas besoin d'être unique : c'est la ligne projetée qui doit être lisible**, et une ligne, c'est un avatar autant qu'un prénom. Personne ne confond 🦊 Camille et 🐼 Camille.

Alors trois filets, du plus doux au plus rare :

- **à l'inscription**, les avatars déjà portés par un invité du même prénom s'éteignent — on prend un autre animal, sans message d'erreur, et vingt-quatre emojis suffisent toujours ;
- **un profil entre tel qu'il est**, sans qu'on lui demande quoi que ce soit ;
- **et si la paire (prénom, avatar) reste partagée** — un profil qui arrive après un homonyme, deux téléphones à la même seconde —, l'application affiche « Camille (2) ». C'est calculé à l'affichage, jamais écrit en base : la marque disparaît d'elle-même quand l'homonyme s'en va, elle respecte l'orthographe de chacun, et les soirées déjà archivées la gagnent aussi — leur historique et l'export compris.

L'animateur garde la main : renommer un invité depuis l'écran commun n'a pas bougé, et le renommage tient. Un téléphone qui se réveille ne renvoie plus que son jeton, et c'est la fiche du serveur qui fait foi : « GrosLourd », renommé « Marc », ne revient plus au réveil de son téléphone.

**L'animateur peut jouer aussi.** Le cookie d'un profil est distinct de celui d'un compte d'animateur : les deux coexistent dans le même navigateur, de sorte qu'on pilote la soirée depuis la TV en y jouant depuis son téléphone. Mieux vaut que son téléphone soit connecté **au lancement** du quiz : arrivé en route, il entre en retardataire (voir « Les équipes »).

## Écrire ses quiz

Tout se passe dans **Mes quiz** (`/edit`), réservé à l'animateur connecté : chaque compte a sa bibliothèque. On y crée, duplique et supprime des quiz ; dans un quiz, on ajoute des questions, on les réordonne, on choisit la bonne réponse, le temps de réponse et une photo.

Deux types de questions, au choix pour chacune :

| Type | Comment on répond | Score (200 pts max) |
|---|---|---|
| 🔘 **QCM** | 2 à 4 réponses, une bonne (2 = vrai/faux) | 100 pts si c'est juste + jusqu'à 100 pts de rapidité, le temps de lire offert |
| 🔢 **Estimation** | chacun tape un nombre | 30 pts pour avoir joué + jusqu'à 170 pts selon la distance à la bonne réponse |

Un **vrai/faux** n'est qu'un QCM à deux réponses : on tape « Vrai » et « Faux » dans les deux premières cases et on laisse les autres vides.

**Le temps de lire est offert.** Les premières secondes, toute la salle lit la question et ses réponses : le bonus de rapidité ne commence à fondre qu'après. Ce temps de lecture vaut une seconde pour lever les yeux, plus 55 ms par caractère de la question et des réponses — 180 mots par minute, la vitesse de lecture que retient Kahoot, qui montre la question seule au moins cinq secondes avant d'ouvrir les réponses —, plus une seconde et demie pour une photo à regarder, et jamais plus de la moitié du chrono : cinq à six secondes pour une question ordinaire. Une bonne réponse donnée pendant ce temps vaut 200 points ; ensuite le bonus baisse régulièrement, et à l'échéance la bonne réponse vaut encore 100 points — la moitié du maximum, comme chez Kahoot ou Mentimeter. Avant, le bonus fondait dès l'affichage : lire coûtait des points, et davantage à qui lit moins vite ou joue loin de l'écran.

L'estimation évite les blocages : même sans connaître la réponse, on propose un chiffre et on marque quelque chose. Ensuite, **c'est la distance qui paie, pas le rang** : la réponse exacte rapporte 200 points, et chacun touche la moitié de la proximité à l'**écart typique de la salle** (la médiane des écarts), un quart au double, presque tout quand il tombe tout près — la courbe de GeoGuessr ou de TimeGuessr, qui ne creusent pas un gouffre pour un pas de plus. **La même distance vaut les mêmes points**, de part et d'autre de la réponse : 7,9 et 8,1 pour 8 touchent autant, et la cible s'affiche devant les deux à l'écran commun. Au rang, le plus proche prenait 200 points et, à deux joueurs, l'autre 30, qu'il ait tapé 8,2 ou 800. L'écart typique vient du groupe, parce qu'une erreur de 3 ans sur une date n'a pas le sens d'une erreur de 3 km sur une distance ; c'est une médiane, donc une faute de frappe chez le voisin (« 19940 » pour 1994) ne change rien aux points des autres — une échelle proportionnelle, elle, donnait le maximum à toute la salle. Deux bornes le tiennent quand la salle est trop petite pour en juger : il ne descend jamais sous deux crans du dernier chiffre de la réponse (deux ans sur 1994, 0,2 sur 7,5) — à deux joueurs, 7,9 et 8,2 pour 8 valent 194 et 189 points —, et ne dépasse jamais la réponse elle-même : « 50 » pour 8 ne touche que ses 30 points de participation. Les écarts se comptent sur les nombres tels qu'on les a tapés : la virgule flottante séparait 0,7 et 0,9 pour 0,8.

- **Les cases de réponse vides** sont simplement ignorées en jeu (et la bonne réponse suit son texte, pas son numéro de case).
- **Les brouillons ne sont jamais perdus** : une question incomplète est enregistrée telle quelle, signalée par un ⚠️, et sautée au moment de jouer. La liste affiche « 8 questions prêtes · 2 à compléter ».
- **Ce qui n'est pas encore enregistré non plus.** L'éditeur n'envoie rien pendant qu'on écrit : sur l'offre gratuite, le serveur s'endort au bout d'un quart d'heure, et le premier « Enregistrer » qui suivait échouait au bout de vingt secondes sur « vérifie ta connexion » — qui poussait à recharger la page, et tout partait. Il attend désormais le réveil, jusqu'à deux minutes (« Réveil du serveur… »), et l'on peut continuer d'écrire pendant ce temps : la frappe part avec l'essai suivant, et la réponse du serveur n'écrase rien de ce qu'on a tapé depuis. Surtout, le navigateur garde une copie de tout ce qui n'est pas enregistré. Onglet fermé, page rechargée, téléphone qui décharge l'onglet : la liste le signale, et le quiz propose à sa réouverture de reprendre ces modifications ou de les effacer — en prévenant s'il a été enregistré ailleurs depuis, et en retirant, avec un mot, une photo que le serveur n'a plus. « Retour » garde cette copie ; « Effacer mes modifications » la jette.
- **Photos** : le navigateur les réduit et les recompresse avant l'envoi (une photo de téléphone de 4 Mo devient ~150 Ko), puis elles vivent dans la base.
- **On peut changer d'avis** jusqu'à la révélation, sur un QCM comme sur une estimation : un doigt qui glisse sur un téléphone tenu dans le noir ne doit pas coûter la question. C'est le dernier envoi qui fait foi, heure comprise — passé le temps de lecture, se raviser coûte donc du bonus de rapidité, sans quoi on pourrait taper au hasard dès la première seconde pour s'assurer le maximum, puis corriger tranquillement.
- **Un nombre se tape comme on l'écrit.** « 35 000 », « 12,5 », « −40 » : le téléphone lit une estimation comme l'éditeur lit une liste collée, et le champ « Bonne réponse » garde ce qu'on y tape — il mangeait la virgule de « 0,8 », qui devenait 8 sans un mot. Ce qui ne se lit pas sans deviner (« 10 93 », « 1,000,000 ») le dit à l'invité, au lieu d'être ignoré en silence.
- **Une réponse envoyée est une réponse accusée.** Le serveur répond à chaque envoi, et le téléphone le dit quand ça n'est pas passé — « trop tard », « en pause », « vérifie ta connexion ». Sans cet accusé, une réponse refusée disparaissait en silence : le téléphone avait vibré sous le doigt, l'écran ne montrait rien, et l'invité restait persuadé d'avoir répondu. La réponse porte aussi son espace et son jeton, pour le cas qui en perdait le plus : un téléphone qui sort d'une veille ou d'un trou de réseau a, côté serveur, une connexion toute neuve qui ne sait plus ni quelle soirée elle suit ni qui elle est — et le navigateur lui fait vider sa file d'attente avant que la page ait pu se re-présenter.
- **Une réponse dit quelle question elle vise.** Retenue par une coupure, une réponse tapée sur la question 1 s'inscrivait sur la 2, que l'invité n'avait jamais vue — son temps compté depuis le début de celle-là, et parfois « le plus rapide ». Elle porte maintenant la question et le tour qu'elle vise (reposer une question ouvre un nouveau tour) : en retard, elle reçoit « trop tard ». C'est ce qui permet au téléphone de renvoyer **une fois** une réponse dont l'accusé n'est pas revenu, tant que sa question est ouverte : déjà reçue, elle est confirmée sans rien réécrire.
- **Le chronomètre se lit à l'heure du serveur.** Les échéances sont des instants absolus du serveur, et chaque écran les comparait à la sienne — or une horloge de téléphone dérive, et certaines sont réglées à la main. Un appareil qui retardait de cinq secondes affichait 25 secondes sur une question qui en durait 20 : son porteur répondait « à quatre secondes de la fin » alors que la question était close, et sa réponse disparaissait. Toujours les mêmes personnes, à toutes les questions. L'écart se mesure maintenant à chaque connexion (trois mesures, on garde la plus rapide) et tous les chronomètres s'y cadrent. Passé l'échéance, lue à cette heure-là, les réponses se grisent sous « Réponses closes » : le téléphone ne promet plus une réponse que le serveur ne retiendrait pas.
- **La fin d'une question laisse passer les retardataires.** Le serveur coupe une seconde et demie après l'échéance affichée — auparavant 400 ms, soit moins qu'un aller simple depuis un téléphone en 4G dans une salle où cinquante autres partagent la cellule. Une réponse tapée juste avant la fin arrive donc encore : elle vaut la bonne réponse, mais le bonus de rapidité est épuisé. Et la révélation déclenchée par la dernière réponse de la salle attend un souffle avant de partir, au lieu de couper la parole à celles encore en vol.
- **Une coupure se voit.** Dès que la liaison tombe — ou que le navigateur se sait hors ligne, sans attendre qu'elle tombe —, un bandeau « Connexion perdue — reconnexion… » se pose en haut de l'écran, pendant le quiz comme à l'entrée, sans rien pousser sous le doigt. Au retour du réseau ou au rallumage de l'écran, le téléphone demande l'heure au serveur, et un silence de deux secondes suffit à rouvrir la liaison : une coupure se voit en 2,3 s, au lieu de 43,6. Côté serveur, un battement toutes les dix secondes et huit de grâce voient une liaison morte en dix-huit secondes au plus — pour environ 300 octets par téléphone toutes les dix secondes, soit 4,5 Ko/s à 150 téléphones. Et quand un appel échoue, le téléphone dit en français quoi faire — « Pas de réseau — vérifie ton wifi ou ta 4G, puis réessaie », ou, pendant un déploiement ou un réveil, « Le serveur redémarre — patiente une minute, puis réessaie » —, jamais « Failed to fetch », ni le message technique d'une panne.
- **Les catégories.** Chaque question peut porter une catégorie, prise dans une liste fixe — Culture générale, Histoire, Géographie, Sciences, Nature, Cinéma & séries, Musique, Arts & lettres, Sport, Cuisine, Jeux & pop culture, Autour de la fête. La même chez tous les animateurs : c'est ce qui permet à la fiche d'un joueur de dire sa réussite par catégorie d'une soirée et d'un hôte à l'autre. L'écran commun l'affiche au-dessus de la question.
- **Coller une liste** évite de saisir cinquante questions une par une. Une ligne vide sépare deux questions, l'étoile marque la bonne réponse, le signe égal crée une estimation, et une ligne « # Musique » range les questions qui suivent dans une catégorie. Sous l'intitulé, « Temps : 30 s », « Photo : tour-eiffel.jpg » et « Observation : 5 s » règlent la question, dans n'importe quel ordre — jamais pris pour une réponse ; la première ligne, elle, reste toujours l'intitulé. Les questions sans étoile sont importées mais signalées. Le nombre d'une estimation se lit comme on l'écrit en France : « = 10 935 mètres » vise 10 935 — milliers séparés par une espace, même insécable ou fine, ou par une apostrophe —, « = 3,14 » a sa virgule, « = −40 °C » son signe moins typographique. Un nombre qui reste ambigu (« = 10 93 mètres », « = 1,000,000 ») compte parmi les blocs ignorés plutôt que d'être mal lu en silence, et l'aperçu montre, pour chaque estimation, la valeur lue en gras et l'unité à côté. La liste arrive à la fin, sauf si on lui donne un numéro : « à partir du n° 41 », et les suivantes se décalent.
- **Faire écrire un quiz.** « Copier le format complet », dans le panneau de la liste, copie les règles, les bornes, les douze catégories et un exemple de chaque possibilité — QCM, vrai/faux, estimation, temps, photo, photo qui disparaît : de quoi faire écrire un quiz à un ami, ou à une IA, qui n'a jamais vu l'application, puis coller sa réponse telle quelle, même rangée dans un bloc de code. « Voir le format » le montre avant de l'envoyer. Le format s'écrit à partir des bornes et des catégories du jour, et son exemple se relit dans les tests : il ne promet rien que la liste ne sache lire (`shared/liste.ts`).
- **Une photo annoncée attend sa photo.** Une liste écrite ailleurs arrive sans ses photos : chacune s'y annonce par son nom de fichier, ou par ce qu'elle doit montrer (« Photo : la tour Eiffel illuminée, de nuit »). « Joindre les photos », en collant la liste, les prend toutes d'un coup, et chacune rejoint sa question par son nom — sans casse, ni accent, ni extension : « Tour_Eiffel.JPG » répond à « tour-eiffel.jpg » ; un fichier qui ne répond à aucune ligne se signale. Celle qui manque reste écrite sur sa carte, « Photo attendue : … », avec « Ajouter la photo » et « Sans photo » à côté : la question est « à compléter », et sautée au moment de jouer — « Quel est ce monument ? » sans son monument n'a rien à faire devant la salle.
- **Déplacer une question au n°** : la pastille « Question 3 » se clique, on tape le numéro voulu, et la question le prend exactement — les autres se décalent, un numéro trop grand l'envoie à la fin. La page défile jusqu'à sa nouvelle place, et « Annuler », sous le titre, défait le dernier déplacement. Les flèches restent pour le ± 1.
- **Insérer, dupliquer** : sur chaque carte, un « + » insère une question vide juste après, et un bouton la duplique juste après, pour en faire une variante.
- **👁 Aperçu** montre une question telle qu'elle sera projetée, sans lancer de partie.
- **Exporter, importer.** « Exporter », sur chaque quiz de la liste, télécharge un fichier `.quiz.json` : les questions, et leurs photos dedans — une adresse `/media/image/…` ne voudrait rien dire ailleurs. « Importer un quiz » le range dans sa bibliothèque, chez un autre animateur du même serveur ou sur un autre serveur. Rien n'entre sans repasser par les portes habituelles : chaque photo par l'envoi d'image (JPEG, PNG ou WebP, poids borné), le quiz par sa création (textes bornés, cent questions au plus). Un fichier qui n'est pas un quiz exporté de l'application est refusé en une phrase, et une photo dans un autre format laissée de côté, pas le quiz (`shared/echange.ts`).
- **🙈 La photo disparaît** transforme n'importe quelle question — QCM comme estimation — en jeu de mémoire. Voir plus bas.

Au tout premier démarrage, les quiz livrés dans `server/content/quiz/*.json` sont importés une fois dans la bibliothèque de l'administrateur pour ne pas partir d'une page blanche. Ensuite ces fichiers ne servent plus à rien : tout vit dans la base. Les autres comptes commencent avec une bibliothèque vide.

## Déroulé d'une partie

L'animateur clique **Lancer un quiz** sur l'écran commun, choisit le quiz, et le 3-2-1 démarre. Pour chaque question : la question s'affiche, chacun répond sur son téléphone, la révélation montre la bonne réponse, la répartition des réponses, le plus rapide et le top 5. À la fin, podium — et les points s'ajoutent au **classement de la soirée**, qui survit d'un quiz à l'autre (et à un redémarrage du serveur).

Pendant une question, **l'écran commun bascule en mode scène** : les panneaux latéraux s'effacent, la question et les réponses grossissent, le QR code se réduit dans un coin — il reste visible pour les retardataires sans voler la vedette. Une barre de temps se vide en couleur (elle se lit du fond de la salle bien mieux qu'un chiffre) et passe au rouge dans les cinq dernières secondes.

**Le son** sort uniquement de l'écran commun : cinquante téléphones qui bipent ensemble, c'est une cacophonie. Les sons sont générés à la volée par le navigateur — aucun fichier à héberger, aucune musique sous droits, rien qui arrive en retard. Le bouton du son, dans la console en bas de l'écran commun, les coupe (le choix est mémorisé). Les navigateurs interdisant tout son avant une interaction, l'audio s'initialise au premier clic sur « Lancer un quiz ».

**Le vidéoprojecteur délave les noirs** : dans une salle éclairée, l'écran commun en fond sombre devient un rectangle gris où plus rien ne se lit. Un bouton de la console le passe en **mode Ivoire** — fond crème, encre sombre, les teintes des fiches imprimées du bilan — et l'y ramène : il montre le thème en cours, une lune en Velours, un soleil en Ivoire. Le choix est mémorisé sur le PC de l'animateur et ne concerne que l'écran commun : les téléphones des invités restent sombres, c'est ce qui ménage les yeux dans le noir.

**L'animateur garde la main** : ⏸ pause (le chronomètre se fige, plus personne ne peut répondre), ↺ reposer la même question, ✖ annuler les points d'une question dont la réponse était fausse — l'écran commun comme les téléphones disent alors « Points annulés » —, renommer ou exclure un invité d'un clic sur sa pastille, entre deux quiz — pendant un quiz, le panneau des invités s'efface pour laisser la place à la question —, et ⛶ plein écran. Un invité exclu part avec ses points et ses réponses, et la salle ne l'attend plus. Les clics qui touchent à la question — Révéler, Question suivante, Reposer, Annuler les points — disent laquelle ils visaient : un « Révéler » arrivé juste après la révélation automatique, un double clic, deux écrans animateurs ou une annulation confirmée après que la partie a avancé sont ignorés, au lieu de faire sauter la révélation à la salle ou de retirer les points de la question suivante. Aucun secret ne passe par la barre d'adresse : la session est dans un cookie que le navigateur garde pour lui.

**Suivante : au clic · 10 s · 20 s · 30 s** : en automatique, la question suivante part toute seule après la révélation, avec un décompte affiché. Un quiz de dix questions demandait vingt clics — autant d'occasions de décrocher de la soirée. Les paliers laissent le temps de commenter une révélation, et « au clic » reprend la main d'un seul geste, comme corriger ou reposer une question.

**Une console qui ne bouge pas sous le curseur.** De la photo à la révélation, les boutons gardent leur place : l'action principale à gauche (Passer à la question, Révéler, Question suivante, Voir le podium), la pause et l'enchaînement au milieu, et à droite, à l'écart, les gestes qui défont quelque chose — Reposer, Annuler les points, Terminer —, chacun confirmé ; ceux qui ne servent pas encore sont grisés plutôt qu'escamotés. Après chaque changement de phase, la console ignore les clics pendant une demi-seconde — un double-clic sur « Révéler » ne tombe plus sur « Question suivante » — et rend le focus à l'action principale : une télécommande de présentation, qui n'envoie qu'Entrée, fait toujours avancer la soirée.

## La photo qui disparaît

Cochez **🙈 La photo disparaît avant la question** sous une photo et la question devient un jeu de mémoire. La photo est d'abord projetée **seule**, en grand, pendant le nombre de secondes choisi : ni l'intitulé ni les réponses ne partent sur les téléphones, qui affichent « Mémorise ». Puis elle disparaît et la question démarre avec son chronomètre normal.

C'est cette phase séparée qui fait le jeu. Afficher la photo et les réponses en même temps reviendrait à laisser répondre en la regardant — la mémoire n'y servirait plus à rien.

Le mécanisme marche pour les deux types de question : un QCM (« combien de bougies sur le gâteau ? ») comme une estimation (« en quelle année cette photo a-t-elle été prise ? »). **La photo revient à la révélation**, pour vérifier ensemble ce qu'on croyait avoir vu. L'animateur peut abréger l'observation d'un clic sur **Passer à la question** si tout le monde a déjà vu.

Une photo sans cette case cochée se comporte comme avant : elle reste affichée à côté de la question.

## Les prix de fin de soirée

Chaque réponse est journalisée : qui, à quelle question, en combien de temps, juste ou faux, et même les questions laissées passer. Le classement seul ne suffirait pas — il ne retient que les gains positifs, donc ni les erreurs, ni les temps de réponse n'y laissent de trace.

De ce journal sortent **une vingtaine de prix**, calculés tout seuls : ⚡ L'Éclair (le plus rapide en moyenne), 🐢 Le Contemplatif (le plus lent, mais juste), 🔫 La Gâchette Facile (vite et faux), ⏰ Le Buzzer de Fin, 💯 Le Sans-Faute, 🙃 Le Cancre Magnifique, 😴 L'Abstentionniste, 🔥 L'Invincible, 🌚 La Série Noire, 🔮 Le Devin, 🎈 L'Optimiste, 🌧️ Le Pessimiste, 🎯 Le Pile-Poil, 🦄 Le Franc-Tireur, 🐑 Le Mouton, ✋ Le Doigt qui Tremble, 🦸 Le Sauveur, 📈 La Remontada, 📉 La Chute Libre, 👁️ L'Œil de Lynx, plus deux prix d'équipe : 🤝 Le Coup de Pouce et ⚖️ La Plus Solidaire.

**Aucun point n'est attribué automatiquement.** Le palmarès, lui, est public : il se relit au souvenir et se range sur l'étagère des profils, remis ou non (voir « Les profils joueurs »). L'écran **🏅 Remise des prix** les propose avec le nom du lauréat, la règle et le chiffre qui la justifie ; l'animateur choisit lesquels il remet et combien de points ils valent. Un panneau libre permet d'en inventer d'autres (« ont chanté le plus fort », +3), et un prix mal donné se retire d'un clic. Un prix ne se propose que s'il a de la matière : deux réponses ne font pas une moyenne, il en faut trois.

Ces points s'ajoutent aux **points de classement des équipes** (voir « Les équipes »), pas à la moyenne du quiz : ce sont deux choses différentes, et les mélanger rendrait les deux illisibles. L'écran **👑 Victoire** annonce l'équipe qui remporte le quiz, prix compris — et, quand plusieurs partagent la tête, il les nomme toutes, « ex æquo » : elles gagnent ensemble.

**Les chiffres vivent sur la page souvenir**, sous le podium et le palmarès — `/demo/stats` y mène, droit sur le tableau : dix-huit colonnes, triables en cliquant sur un en-tête, une ligne par joueur — points, réponses données, justes, fausses, taux de réussite, temps moyen, meilleur temps, plus longues séries, questions passées, revirements, réponses de dernière seconde, fois où l'on était seul de la salle, fois où l'on a suivi la majorité, estimations, leur coup d’œil — la part de la salle qu’elles battent ou égalent — et leur écart moyen, biais optimiste ou pessimiste. La page se rafraîchit toute seule tant que la soirée est en cours et n'a pas besoin de compte : elle se garde ouverte sur le téléphone de l'animateur pendant la soirée. Une fois la soirée close, la page de l'espace continue de la montrer, sous un bandeau « La dernière soirée », jusqu'à la première question de la suivante — puis y revient d'elle-même, sans qu'on la recharge : le QR scanné au podium mène encore à la soirée le lendemain. Son adresse d'archive (`/demo/soirees/<id>/stats`), elle, la garde pour toujours. Le tableau défile dans son propre cadre, dans les deux sens — dix-huit colonnes ne tiennent sur aucun téléphone, ni cent invités sur un écran — et garde en vue la ligne des titres et la colonne des prénoms pendant qu'on cherche le sien. Un QR y mène depuis l'écran de remise des prix.

**L'écran de victoire** montre les deux classements côte à côte : les équipes avec leur total du quiz, leurs points cumulés et leur moyenne d'un côté ; le classement individuel de l'autre. Les équipes décident du vainqueur, mais c'est pour son score personnel que chacun a joué — les deux méritent d'être à l'écran au même moment.

## Le bilan, question par question

Le lendemain, chacun veut savoir ce qu'il a répondu — et ce que les autres ont répondu. **Le bilan** le raconte, sans compte — `/demo/bilan` pour la soirée en cours, et encore pour la dernière close tant que la suivante n'a rien joué ; `/demo/soirees/<id>/bilan` pour toujours : on choisit son prénom dans la liste, et on relit sa soirée question par question — l'intitulé, ce qu'on a répondu, la bonne réponse, son temps, ses points, et en regard ce que son équipe et la salle ont choisi (deux barres par réponse : la salle en champagne, l'équipe en encre). Pour une estimation : sa proposition, la vraie valeur, son rang de proximité et la proposition la plus proche de la salle. En tête, quatre chiffres (points et rang, rang dans l'équipe, réussite, temps moyen) et les moments forts : les prix dont on est le lauréat proposé, son plus beau coup, la question où l'on a été le seul de la salle à trouver, celle qu'on a ratée alors que tout le monde l'avait…

Un seul lien à poster dans le groupe : celui de la soirée close, que donnent le QR de l'écran de clôture et la fin de soirée de chaque téléphone — ou `/demo/soirees`. Chacun y choisit son prénom ; pendant la soirée, le téléphone qui joue ouvre directement le sien. Chaque bilan a son adresse (`…/bilan#p=…`, bouton « Copier le lien de ce bilan », qui donne toujours celle de l'archive une fois la soirée close) pour l'envoyer à quelqu'un en particulier. Tout le monde peut lire le bilan de tout le monde : c'est une page souvenir, pas un carnet de notes.

**L'onglet « La soirée »** relit tout pour tout le monde : les questions qui ont marqué (la plus ratée, la plus facile, la plus clivante, la plus hésitante, la plus vite jouée, la plus longue), les équipes quiz par quiz, le vainqueur de chaque quiz — tous, quand ils finissent ex æquo : « Alice et Zoé remportent ce quiz ex æquo » —, puis chaque question avec la répartition des réponses, la réussite de chaque équipe, le plus rapide, et le moment où quelqu'un prend la tête du classement.

**Les fiches** (`…/bilan/fiches`) enchaînent une fiche par invité, en Ivoire, chacune sur sa page : « Imprimer » puis « Enregistrer en PDF », et on envoie à chacun la sienne — ou on imprime le tout.

**L'export** met les mêmes chiffres en fichiers, pour les garder à l'abri ou rédiger ses messages soi-même :

```bash
npm run export -- https://ton-app.onrender.com --slug demo
```

Il écrit dans `export/demo/` un `bilan.json` complet et trois CSV faits pour Excel (point-virgule, accents corrects) : `invites.csv` (une ligne par invité, une colonne par question — « Canberra ✔ · 1,8 s · 200 pts »), `questions.csv` (une ligne par question, avec la répartition des réponses et la réussite de chaque équipe) et `equipes.csv` (une ligne par équipe, un quiz par colonne). Sans `--slug`, c'est l'espace de l'administrateur. Sans `--soiree`, c'est la soirée en cours ; une soirée close s'exporte par son identifiant (voir « L'historique des soirées »). Si le serveur ne répond plus, `npm run export -- --db libsql://… --token …` lit directement la base Turso.

**Comment ça marche.** Le journal des réponses ne garde que des numéros : celui de la question dans son quiz, celui de la réponse choisie. Les intitulés viennent de la copie exacte du quiz que chaque partie garde avec son état — sur le disque et au miroir jusqu'à la clôture, puis dans l'archive : retoucher la bibliothèque pendant ou après la soirée ne change pas son bilan. Seul `npm run export -- --db`, qui lit la base sans passer par le serveur, retrouve les intitulés dans la bibliothèque, par titre de quiz, en vérifiant que ce qu'elle dit colle au journal ; là, un quiz retouché se signale « quiz modifié depuis la soirée ».

## L'historique des soirées

L'application sert plus d'une soirée. **`/demo/soirees`** liste les soirées passées de l'espace, et chacune se relit avec les mêmes pages que la soirée en cours : `/demo/soirees/<id>/souvenir`, `/demo/soirees/<id>/bilan` — et les fiches à imprimer avec. Les pages disent en tête quelle soirée elles relisent.

**La soirée s'enregistre toute seule** dans l'historique après chaque quiz : plus rien ne dépend d'un « Sauvegarder » auquel l'animateur pense, ou pas. En cours, elle s'affiche à part, « en cours », sous le titre qu'elle porte déjà. **Clore la soirée** (écran commun, sur l'accueil et après l'écran de victoire) est le seul geste de fin : la soirée se range une dernière fois, sous le titre qu'on lui donne ; ce qui ne se décide qu'à la fin est crédité — podium de la soirée, prix, hauts faits, paliers, avatars légendaires ; chaque téléphone reçoit sa **fin de soirée** — son rang, ses hauts faits, ce que son profil y a gagné, avec un lien pour la relire — et l'écran commun annonce la soirée à la salle, avant que la suivante ne parte de zéro. Entre les deux, le souvenir et le bilan de l'espace montrent la soirée close : `recap.json` et `bilan.json` la désignent (`derniere`) tant que la suivante n'a rien joué. Un téléphone qui dormait pendant la clôture retrouve sa fin de soirée à son réveil. Rien ne s'efface tant que rien ne s'est écrit au loin : si la base distante ne répond pas, la soirée reste là, entière, et l'animateur le lit. **C'était un essai**, à côté, efface tout sans rien garder — l'archive que la soirée s'était faite, et tout ce qu'elle avait crédité aux profils.

Une soirée rangée plusieurs fois est mise à jour, pas dupliquée : c'est la date et l'heure d'arrivée du premier invité qui l'identifient — dans l'espace, deux animateurs peuvent avoir joué le même soir sans se gêner. Ce nom se tire une fois pour toutes — au plus tard quand quelque chose s'écrit sous lui dans la base permanente —, puis il est gardé, miroir compris : exclure le premier arrivé, presque toujours le téléphone d'essai de l'animateur, ou redémarrer le serveur ne le change plus. Seules la clôture et « C'était un essai » l'oublient ; la soirée suivante en tire un nouveau. Il se recalculait à chaque besoin, et une exclusion entre deux quiz rebaptisait la soirée : l'expérience s'écrivait sous deux noms et s'additionnait, et la soirée apparaissait deux fois dans l'historique.

Une archive est une copie complète — invités, équipes, points, prix remis, journal des réponses, et les quiz tels qu'ils ont été posés — rangée dans la base permanente, à côté de la bibliothèque. Rien n'y est précalculé : le souvenir et le bilan se relisent depuis ces données avec le code du jour, et une amélioration des prix ou du bilan profite aux soirées passées. La liste de l'historique aussi : chaque soirée y garde une fiche de faits bruts — les invités dans l'ordre d'arrivée avec leur prénom, leur avatar, leur équipe et leurs points, les équipes, les prix, le nombre de quiz et de questions —, dont le résumé se redérive à chaque lecture avec les règles du souvenir : marques d'homonymie, ex æquo couronnés ensemble, équipe gagnante prix compris. Une fiche pèse quelques Ko quand une archive pèse jusqu'à plusieurs Mo : la liste s'affiche sans relire les archives. Une soirée rangée avant les fiches voit la sienne écrite à sa première lecture. Les quiz voyagent avec l'archive : on peut ensuite retoucher la bibliothèque, ou la réécrire pour la soirée suivante, sans rien perdre.

Sur `/demo/soirees`, l'animateur de l'espace — connecté à son compte — renomme une soirée ou la retire de l'historique. L'export sait viser une archive : `npm run export -- https://ton-app.onrender.com --slug demo --soiree 2027-03-14-k7x2q` (l'identifiant est dans l'adresse de ses pages) écrit ses fichiers dans `export/demo/2027-03-14-k7x2q/`.

## Faire durer le suspense

Avec cinquante invités et un classement cumulé, les mêmes trois personnes mènent dès le premier quiz et 47 autres regardent une course perdue d'avance. Deux mécaniques corrigent ça.

**Le multiplicateur.** Avant de lancer un quiz, l'animateur choisit **points normaux, ×2 ou ×3**. Annoncé à la salle, un dernier quiz en points doubles rend tout rattrapable jusqu'à la dernière question — un écart de 400 points redevient jouable. Le multiplicateur s'affiche en or sur l'écran commun et sur chaque téléphone : un bonus qu'on ne voit pas ne motive personne.

**Les prix de caractère.** En plus des trois premiers, l'écran du podium et la page souvenir désignent **le plus beau coup** (le plus gros score sur une seule question), **le plus régulier** (celui qui a marqué sur le plus de questions) et **le vainqueur de chaque quiz** — autant de cadeaux à remettre, et une raison pour chacun de rester dans la partie. Les deux premiers se lisent dans le journal des réponses, comme le bilan : une question annulée n'y compte plus, une question reposée n'y compte qu'une fois. Et des ex æquo en tête d'un quiz le gagnent ensemble, sur une même carte.

**En fin de soirée**, le bouton « Podium » célèbre le classement cumulé en plein écran, avec un QR vers la **page souvenir** : podium, nombre de quiz, points distribués — et, sur l'onglet des joueurs, le plus beau coup, le plus régulier et le vainqueur de chaque quiz —, puis toutes les statistiques. Elle est publique ; une fois la soirée close, elle la montre encore jusqu'à la première question de la suivante, et se relit pour toujours depuis l'historique — c'est ce lien-là qu'on partage le lendemain. Sur tous les podiums, le rang est partagé : deux ex æquo en tête montent sur deux marches de premier, et le suivant est troisième.

**Entre deux soirées**, « Clore la soirée » range la soirée et efface invités et points, sauvegarde distante d'abord, disque local ensuite. Les téléphones encore ouverts montrent leur fin de soirée, puis repassent par l'entrée, pré-remplie de leur prénom, écran d'équipe compris : ils n'ont qu'à confirmer pour rejoindre la suivante. Les essais d'avant la soirée, eux, s'effacent sans laisser de trace par « C'était un essai » ; une soirée close par erreur se retire d'un clic sur `/demo/soirees`, et ce qu'elle avait rapporté aux profils repart avec elle.

## Les équipes

Chacun joue pour soi, et ses points font aussi ceux de son équipe : les équipes se déduisent des points de leurs membres — pas de score collectif saisi à la main, pas de double comptabilité.

**Rejoindre son équipe.** L'inscription se fait en deux écrans : prénom + avatar, puis l'équipe. Le deuxième n'apparaît que si l'animateur a créé des équipes ; sinon on rejoint directement, comme avant. Depuis la salle d'attente, chacun peut encore se corriger tant qu'aucun quiz ne tourne — pendant une partie, c'est refusé : changer d'équipe emporte ses points, ce serait un déménagement de score entre deux questions.

**Le classement d'équipe se fait à la moyenne par membre, pas au total.** Six équipes ne se remplissent jamais à égalité parfaite, et une équipe de neuf battrait mécaniquement une équipe de six. Le total reste affiché en petit — c'est lui qu'on commente à voix haute — mais c'est la moyenne qui classe.

**Les points de classement.** À la fin, le quiz rapporte à chaque équipe autant de points que son rang le permet : avec six équipes, **6 points à la première, 5 à la deuxième, … 1 à la dernière**. C'est le chiffre cerclé sur l'écran commun et sur la page souvenir. Les prix que l'animateur remet s'y ajoutent, et ce total désigne l'équipe gagnante du quiz : un prix peut renverser l'ordre, c'est tout son intérêt. Deux équipes à égalité partagent le même rang et les mêmes points.

**Côté animateur**, le panneau *Invités* regroupe les pastilles par équipe : on repère d'un coup d'œil qui s'est trompé, et un menu déroulant sur la pastille le déplace. On crée une équipe (nom + emoji), on la renomme, on la supprime — **supprimer une équipe n'exclut personne** : ses membres repassent « sans équipe » et gardent leurs points. Le bouton ✨ crée les six équipes par défaut d'un coup, à renommer ensuite.

**Entre deux questions**, l'écran commun annonce qui mène : les équipes d'abord, le top du quiz ensuite — c'est le classement d'équipe qui décide de la soirée. Chaque téléphone montre au même moment son total, son rang, et où en est son équipe. Le rang est partagé : à égalité de points, deux invités lisent le même chiffre, plutôt qu'un ordre que personne n'a choisi.

**Le podium** bascule entre 👥 *Les équipes* (podium collectif et points de classement) et 🏆 *Les joueurs* (podium individuel et prix de caractère). Les deux comptent : le classement individuel fait jouer chacun, le classement d'équipe désigne le vainqueur de la soirée.

**Les retardataires entrent en cours de route** : quelqu'un qui arrive pendant un quiz rejoint la partie immédiatement — dès la question en cours s'il arrive pendant qu'elle est posée, à la suivante s'il arrive pendant une révélation. Il ne récupère rien sur les questions déjà posées, mais il joue toutes les suivantes. Arrivé pendant une révélation, il est accueilli par « Bienvenue ! Tu joues à partir de la prochaine question. » plutôt que par un « Trop tard » pour une question qu'il n'a jamais vue. Et si l'animateur repose cette question-là, il la joue aussi, au journal comme aux points.

## Où vivent les données

Deux stockages séparés, et c'est volontaire :

- **La base permanente** est le seul contenu précieux : elle doit survivre à un redéploiement. En local c'est un fichier (`server/data/quizzes.db`) ; en ligne, on pointe `QUIZ_DB_URL` vers une base **Turso** gratuite. Le code est le même — le client libSQL parle aux deux. Elle contient les comptes (mots de passe hachés, jamais en clair), les sessions ouvertes (seule l'empreinte du jeton), les liens d'activation, les profils des joueurs, la bibliothèque de quiz et ses photos, les soirées archivées — et le miroir de la soirée en cours.
- **L'état d'une partie** (question en cours, réponses) vit dans une base SQLite locale, jetable, et il est recopié dans la base distante. Une question qui s'ouvre ou se révèle part aussitôt, avec ses gains et ses réponses, dans une seule transaction : un serveur tué juste après une révélation ne la rejoue pas au réveil — elle se payait deux fois. Seul le va-et-vient des réponses en cours de question attend, au plus deux secondes. Après un redémarrage, même sur un disque effacé, la question en cours reprend là où elle en était — au pire, deux secondes de réponses en moins, que leurs auteurs peuvent retaper. Les parties terminées restent aussi au miroir, jusqu'à la clôture : elles gardent la copie exacte des quiz joués, celle que l'archive retiendra.
- **Les invités et leurs points** sont recopiés dans la base distante au fil de l'eau et rechargés au démarrage si le disque local est reparti vide. Sur un hébergeur gratuit le disque est effacé à chaque redémarrage : sans ce miroir, la soirée repartirait à zéro sans que personne comprenne pourquoi. Chaque espace a sa file d'écritures, dans l'ordre, qui insiste jusqu'au succès quand la base distante refuse : une panne de Turso en pleine soirée ne perd rien tant que le serveur tourne, et une écriture rejouée ne compte jamais deux fois. Après une dizaine de secondes d'échecs, l'écran commun affiche « Sauvegarde en retard — la soirée continue », et `/healthz` le détaille (bloc `miroir`) — voir [MISE-EN-LIGNE.md](MISE-EN-LIGNE.md), « Si ça coince ».
- **Les soirées archivées** vivent dans la base permanente, avec la bibliothèque : une ligne par soirée, tout dedans (table `soirees`, clé = espace + identifiant). C'est ce qui reste quand la suivante commence. Le nom de la soirée en cours, tiré une fois pour toutes (voir « L'historique des soirées »), se garde à part — table `soiree` en local, `party_soiree` au miroir — pour survivre à un réveil sur disque effacé.

Chaque ligne, dans les deux bases, porte l'espace à qui elle appartient. Au premier démarrage après la mise à jour, les lignes d'avant les comptes prennent l'espace de l'administrateur ; cette mise à jour est idempotente et ne copie ni n'efface rien.

## Tester avec de vrais téléphones (à la maison)

1. PC et téléphones sur le **même wifi**.
2. `npm run build && npm start` → tout est servi sur `http://<IP-du-PC>:3001`. L'écran commun peut rester en `localhost` : son QR code montre de lui-même l'adresse réseau du PC, suivie du nom de l'espace. Pas `npm run dev` pour ce test : le QR mène au port du serveur, qui ne sert que le client construit.
3. **Une fois pour toutes, dans un PowerShell administrateur** (sinon Windows bloque les connexions entrantes) :

```powershell
Set-NetConnectionProfile -NetworkCategory Private
```

```powershell
New-NetFirewallRule -DisplayName "Quizz" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001,5173
```

Pour simuler des invités sans téléphone (ils répondent au hasard) :

```bash
node server/scripts/fake-player.mjs http://localhost:3001 Test1 300 --slug demo
```

## Mettre en ligne (gratuitement)

📄 **Mode d'emploi pas à pas, sites et commandes compris : [MISE-EN-LIGNE.md](MISE-EN-LIGNE.md).** Ce qui suit en est le résumé.

Objectif : les invités scannent le QR et jouent en 4G, sans réseau à installer sur place. Il faut un hébergeur qui tienne les WebSocket — GitHub Pages, Vercel et Netlify ne conviennent pas.

Deux comptes gratuits à créer (je ne peux pas le faire à ta place) :

**1. Turso — la base permanente.** Crée un compte, puis une base. Récupère son URL (`libsql://…`) et un jeton d'accès. L'offre gratuite (100 bases, 5 Go, 500 millions de lignes lues par mois) est sans commune mesure avec quelques soirées de quiz par mois.

**2. Render — le serveur.** Crée un service web relié à ce dépôt (**New → Web Service**) et recopie les deux commandes de `render.yaml`, plus bas. Un *Blueprint* le ferait tout seul, mais `render.yaml` décrit **deux** services — production et préproduction, chacun avec sa base Turso — et Render n'adopte jamais un service créé autrement : il en ferait des copies ([MISE-EN-LIGNE.md](MISE-EN-LIGNE.md), étape 7). Renseigne ensuite les variables dans son interface :

| Variable | Valeur |
|---|---|
| `ADMIN_LOGIN` | ton identifiant de connexion |
| `ADMIN_PASSWORD` | ton mot de passe d'amorçage. Il ne sert qu'à créer le compte, sur une base encore vide — et en ligne, celui par défaut y est refusé. Change-le ensuite depuis « Mon compte », puis retire la variable : le serveur redémarre très bien sans |
| `ADMIN_SLUG` | le nom de ton espace dans les adresses (`chez-antoine` : les invités ouvriront `https://…/chez-antoine`) |
| `QUIZ_DB_URL` | l'URL `libsql://…` de Turso — sans elle, le serveur refuse de démarrer : le disque de Render s'efface à chaque réveil |
| `QUIZ_DB_TOKEN` | le jeton Turso |

Les deux commandes de `render.yaml` : `npm ci && npm run build` pour construire, `cd server && exec node --import tsx src/index.ts` pour démarrer. Pas `npm start` : npm garde pour lui le signal d'arrêt, et l'arrêt propre, qui recopie les dernières réponses dans Turso, ne s'exécute jamais.

L'adresse publique du QR code se règle toute seule : Render fournit `RENDER_EXTERNAL_URL`, le serveur s'en sert et y ajoute le nom de l'espace.

**3. Transférer les quiz écrits en local**, pour ne pas les ressaisir — une fois le serveur démarré en ligne, puisque c'est lui qui crée ton compte (un quiz seul voyage aussi à la main : « Exporter » chez soi, « Importer un quiz » en ligne) :

```bash
npm run migrate -- --to libsql://ta-base.turso.io --token ton-jeton
```

**4. La mise en veille.** C'est la vraie limite de l'offre gratuite de Render : sans trafic entrant pendant 15 minutes, le service s'endort, et le réveil prend environ une minute — le premier invité qui scanne attendrait devant une page blanche.

La parade tient en un geste : **ouvrir l'écran commun cinq minutes avant** l'arrivée des invités. Tant qu'un écran ou un téléphone est connecté, le trafic des websockets empêche la veille — la seule fenêtre de risque est le tout premier scan, et c'est celle-là qu'on couvre.

Un service de ping extérieur (cron-job.org, UptimeRobot…) ferait le même travail sans y penser, mais ce dépôt s'en passe : avec **deux services gratuits** — production et préproduction —, les 750 heures mensuelles ne suffisent pas à en garder deux allumés en permanence. Laisser dormir les deux est le choix cohérent.

Si tu préfères un hébergeur qui ne dort jamais, Northflank propose deux services toujours actifs sur son offre gratuite — mais il demande une carte pour vérifier le compte, ce que Render ne fait pas.

L'éditeur de quiz, lui, n'envoie rien pendant qu'on écrit : le serveur peut s'endormir sous les doigts de l'animateur. Son « Enregistrer » attend alors le réveil, et le navigateur garde ce qui n'est pas encore enregistré (voir « Écrire ses quiz »).

**5. Sauvegarder.** Tout le précieux tient dans une seule base Turso : une copie chez soi de temps en temps — avant une grande soirée, et le lendemain.

```bash
npm run sauvegarde -- libsql://ta-base.turso.io --token ton-jeton
```

Un fichier SQL daté dans `export/sauvegardes/` — toutes les tables, photos comprises —, qui se restaure dans une base neuve (`turso db shell nouvelle-base < fichier.sql`, ou `sqlite3`). Il contient les comptes : il se garde comme un secret. Restauration, historique de Turso et mode d'emploi du serveur qui tombe en pleine partie : [MISE-EN-LIGNE.md](MISE-EN-LIGNE.md).

## Le repli : tout en local

Si la salle capte mal ou si l'hébergeur fait des siennes, le même code tourne sur ton PC avec un routeur wifi. Renseigne alors `WIFI_SSID`/`WIFI_PASS` : l'écran commun affiche **deux QR codes** (1️⃣ rejoindre le wifi, 2️⃣ ouvrir le quiz).

Sur `http://192.168…`, deux conforts demandent HTTPS et manquent donc : garder l'écran allumé — un bandeau le demande aux invités, en salle d'attente comme pendant les questions (voir [MISE-EN-LIGNE.md](MISE-EN-LIGNE.md), « Repli ») — et copier le code de secours, dont le bouton disparaît : le code reste à l'écran, à noter.

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3001` | Port du serveur |
| `ADMIN_LOGIN` | `antoine` | L'identifiant de l'administrateur — utilisé au premier démarrage seulement, pour créer son compte |
| `ADMIN_PASSWORD` | `demo` | Son mot de passe d'amorçage — en ligne, exigé et différent du défaut tant que la base n'a aucun compte ; à changer puis retirer |
| `ADMIN_SLUG` | `demo` | Le nom de son espace dans les adresses |
| `ADMIN_NAME` | `Antoine` | Son prénom, tel qu'affiché |
| `MAX_PLAYERS` | `500` | Plafond d'invités par soirée, au-dessus du réglage de chaque espace (150 par défaut). Sur l'offre gratuite de Render, pas au-delà de 150 environ : le coût des diffusions grandit plus vite que la salle (voir « Test de charge ») |
| `DB_PATH` | `server/data/quizz.db` | Base de la partie en cours (jetable) |
| `QUIZ_DB_URL` | fichier voisin de `DB_PATH` | Base permanente : `file:...` ou `libsql://...` (Turso). En ligne, obligatoire : sans elle, le serveur refuse de démarrer |
| `QUIZ_DB_TOKEN` | — | Jeton Turso, si base distante |
| `PUBLIC_URL` | `RENDER_EXTERNAL_URL`, sinon l'adresse réseau du PC | URL publique à mettre dans le QR code |
| `APP_ENV` | — | Le nom de l'environnement quand ce n'est pas la production (`preprod`) : un bandeau le rappelle sur toutes les pages |
| `WIFI_SSID` / `WIFI_PASS` | — | Si définis : QR « rejoindre le wifi » sur l'écran commun |

## Garde-fous

Le serveur ne fait confiance à rien de ce qui vient d'un téléphone ou d'une page, et personne ne peut le saturer depuis une seule connexion :

- **les comptes** : mots de passe hachés avec scrypt (natif Node), sessions de trente jours glissants dans un cookie `httpOnly` (`Secure` en ligne, `SameSite=Lax`) dont seule l'empreinte est en base ; vingt essais par adresse puis vingt par minute, dans une seule réserve que partagent toutes les portes qui ouvrent une console (connexion au compte ou au profil, rattachement, changement de mot de passe, code de secours, activation) — qui alternait les portes avait deux fois le débit ; cinq échecs sur un même identifiant le ferment un quart d'heure, et les portes qui vérifient le même mot de passe — connexion, rattachement, changement — se ferment ensemble ; l'activation, dont le jeton de 256 bits ne se devine pas, n'a que la réserve de l'adresse — cinq liens périmés fermaient toutes les activations du serveur ; un identifiant inconnu coûte le même temps qu'un mot de passe faux ; changer le mot de passe d'un compte ou d'un profil exige l'actuel — ou, pour un profil, son code de secours : une session restée ouverte sur un téléphone prêté ne suffit pas ; après la connexion, `/connexion?next=…` ne ramène qu'à une page de l'application, l'adresse étant résolue comme le navigateur le fera ; se déconnecter ferme sa session, changer de mot de passe ou désactiver un compte les ferme toutes, détacher un profil ferme celles qu'il avait ouvertes, et les écrans communs qu'elles avaient ouverts se coupent ; supprimer un compte (désactivé d'abord, jamais l'espace de l'administrateur) coupe aussi les téléphones de sa soirée et efface tout ce qu'il a laissé, dans les deux bases, le compte en dernier ;
- **les écritures** de l'API exigent un en-tête que seule la page envoie (contre les requêtes forgées depuis un autre site) et, en ligne, l'origine de l'application ; le corps d'une requête n'est lu qu'une fois la session vérifiée ;
- **l'isolation** : l'espace vient de la session ou de l'adresse, jamais d'une charge utile ; une connexion ne suit qu'une soirée ; un identifiant de quiz, de soirée ou de partie qui n'est pas du sien vaut « introuvable » ou « terminée », au niveau du stockage lui-même ;
- cinq présentations refusées coupent la connexion socket ; une connexion ne crée pas plus de trois identités, une adresse pas plus de 60 d'un coup (puis 60 par minute : le wifi d'une salle sort par une seule adresse — c'est l'écran commun qui en projette le QR —, et en 4G des dizaines d'invités partagent celle de leur opérateur ; à 25, la vague de scans qui suit l'apparition du QR prenait des refus), et la soirée est complète au plafond réglé par l'animateur ;
- aucun message ne fait tomber le serveur, et avec lui les soirées de tous les espaces : une charge absente ou malformée, un accusé manquant sont tolérés, chaque champ se vérifie avant usage, toute exception d'un écouteur finit au journal avec le nom de l'événement, et un téléphone qui attendait une réponse la reçoit quand même ;
- prénoms, avatars et textes sont nettoyés et bornés — coupés entre deux caractères, jamais au milieu d'un emoji —, les photos vérifiées ; dans l'export CSV, une cellule qui commencerait comme une formule (`=`, `+`, `-`, `@`) prend une apostrophe devant, et Excel la lit comme du texte ;
- une panne ne se raconte qu'au journal : un message voulu (« Cet identifiant est déjà pris ») passe tel quel, tout le reste — une erreur de base, une archive illisible — devient une phrase neutre, « Erreur serveur — réessaie dans un instant », et l'écran commun, projeté devant la salle, suit la même règle ; une requête illisible reçoit une phrase en JSON, jamais la pile du serveur ;
- en ligne, le temps réel n'accepte que les pages servies par l'application, et le JS part compressé avec un an de cache ; chaque réponse porte les en-têtes de durcissement (CSP, `nosniff`…) : la politique de contenu ne laisse le temps réel parler qu'à l'hôte de la page — `connect-src` se construit à chaque requête depuis l'en-tête `Host`, s'il a bien la forme d'un hôte —, et `frame-ancestors 'none'` interdit à toute page tierce d'encadrer l'application.

L'analyseur d'URL d'Express 4 s'appuie sur `qs`, dont `npm audit` signale deux failles de déni de service : aucune adresse ne lit de paramètre d'URL, et l'application utilise l'analyseur simple de Node — cette bibliothèque n'est jamais appelée.

## Test de charge

```bash
npm run load -- http://localhost:3001 50 --slug demo
```

Le script simule une salle entière : il se connecte comme l'animateur (`ADMIN_LOGIN` / `ADMIN_PASSWORD`), inscrit N invités d'un coup dans son espace, joue lui-même le rôle de l'écran commun et mesure ce qui compte devant une vraie salle — l'inscription, la diffusion d'une question vers les téléphones, la révélation, et la mémoire du serveur avant et après le quiz. Avec `--sonde`, il ne fait que connecter les téléphones, sans inscrire personne. Hors de l'adresse locale — contre le serveur en ligne, ou par l'adresse du wifi —, une même adresse n'inscrit que soixante invités d'un coup, puis soixante par minute (voir « Garde-fous ») : au-delà, les inscriptions sont refusées.

**Ce qui décide si une grande salle tient, c'est le coût d'une diffusion.** Chaque réponse recalcule la vue de chaque téléphone, et le podium de fin de quiz repart vers toute la salle. Chaque vue triait tout le classement pour y lire son rang, et chaque ligne recalculait les homonymes de la salle entière : sur l'instance gratuite de Render, qui n'a qu'un dixième de processeur, une question à 500 invités — le plafond réglable — coûtait cinq minutes de calcul. Le classement se trie maintenant une fois par diffusion, pour toute la salle, et seules les lignes montrées se décorent. Mesuré sur le module de jeu, avec le vrai registre des invités, avant et après :

| Invités | Une question complète (chaque réponse rediffuse) | Une rediffusion du podium |
|---|---|---|
| 150 | 0,68 s → 30 ms | 2,0 s → 14 ms |
| 300 | 6 s → 0,13 s | 15 s → 60 ms |
| 500 | 32 s → 310 ms | 73 s → 167 ms |

Ce qui restait au podium, c'étaient les marques d'homonymie (« Camille (2) »), recalculées pour chaque ligne : gardées en mémoire jusqu'à la prochaine arrivée, le prochain renommage ou la prochaine exclusion, elles ont ramené à elles seules une rediffusion du podium de 2,9 s à 17 ms à 150 invités, et de 110 s à 101 ms à 500. Les deux corrections ensemble, elle tient en quelques millisecondes. `server/test/` garde ces coûts à distance : une question complète à 300 invités en moins de 3 s, un podium en moins de 300 ms, et N + 3 lignes décorées par diffusion — c'était N².

## La tablée : une soirée jouée par des agents

Les tests disent si le code fait ce qu'on a voulu. Ils ne disent pas si la grand-mère trouve « Jouer sans compte », si une animatrice comprend l'éditeur du premier coup, ni ce que devient l'écran d'un téléphone quand le clavier s'ouvre. **La tablée** fait jouer une soirée entière à des agents Claude qui incarnent des invités et une animatrice — chacun sur son appareil, dans un vrai navigateur —, puis leur demande ce qui les a gênés.

```bash
npm run tablee -- --profil "Camille/camille.d/🦊"
```

La régie (`server/scripts/tablee/regie.ts`) démarre un vrai serveur sur des bases jetables, un Chromium et une porte locale ; elle reconstruit le client s'il est plus vieux que ses sources. Elle crée le compte d'une animatrice à activer par son lien — comme un ami à qui l'administrateur ouvre un espace, bibliothèque vide — et les profils de joueurs demandés. Chaque agent joue ensuite par gestes, un par commande :

```bash
node server/scripts/tablee/pilote.mjs jeanne appareil petit-telephone
node server/scripts/tablee/pilote.mjs jeanne scanner                  # le QR de l'écran commun
node server/scripts/tablee/pilote.mjs jeanne toucher "Jouer sans compte"
node server/scripts/tablee/pilote.mjs jeanne question                 # attend la prochaine question
node server/scripts/tablee/pilote.mjs jeanne repondre 2
node server/scripts/tablee/pilote.mjs jeanne capture                  # une photo de l'écran
```

`pilote.mjs aide` les liste tous : lire l'écran (l'arbre d'accessibilité, chaque élément avec sa référence), toucher, écrire — touche par touche, comme un doigt, ou d'un coup, comme un texte collé —, lever les yeux vers l'écran commun, couper le réseau, mettre le téléphone en veille, agrandir le texte, voir en daltonien, parler à la salle… Le clavier du téléphone est simulé : il s'ouvre au toucher d'un champ et prend le bas de l'écran, la page rétrécissant au-dessus, comme sur Chrome Android — l'application le voit, et remonte ce qu'elle peut.

Avec Claude Code, **`/tablee`** fait tout : la régie, huit agents — une animatrice qui découvre l'application et sept invités aux profils variés (la grand-mère au petit téléphone et au texte agrandi, l'ado qui cherche la faille, la joueuse qui veut son profil, le retardataire au réseau capricieux, celle qui n'a pas le QR, l'homonyme daltonienne, le lecteur d'écran) —, puis la synthèse de leurs retours, vérifiés un à un. Les fiches des personnages, leurs consignes et le modèle de retour sont dans `.claude/skills/tablee/` : une fiche de plus, c'est un invité de plus.

Tout ce que la soirée laisse va dans `export/tablee/<date-heure>/`, hors de git : le journal de chaque geste, les captures, ce que les navigateurs ont signalé, le journal du serveur, les deux bases et les retours bruts. `node server/scripts/tablee/chronologie.mjs` résume ce journal en une page — gestes ratés, délais de réponse, paroles. Les synthèses, elles, se versionnent dans `retours/` : la première, [« Les 40 ans de Sam »](retours/2026-09-23/synthese.md), a tiré sept axes d'amélioration de huit retours, chacun vérifié dans le code, les captures ou le journal.

Playwright n'est pas une dépendance du dépôt : la régie le prend dans le dépôt s'il y est, sinon parmi les modules globaux (`npm install -g playwright`, puis `npx playwright install chromium`) — sur Claude Code en ligne, il est déjà installé.

## Identité visuelle

Direction **« Velours »** (choisie le 8 septembre 2026, elle remplace « Salsa nocturne ») : un noir chaud éclairé d'un seul halo, du champagne pour ce qui compte, une serif pour ce qui se lit de loin. Tout est dans `client/src/styles.css`, piloté par une vingtaine de variables en tête de fichier — les couleurs, les deux polices, les rayons.

Trois règles ont guidé les choix, et elles valent pour toute évolution :

- **Le contraste avant la finesse.** L'écran commun est vu de loin sur un vidéoprojecteur, dans le noir. La question est en Cormorant Garamond à 56 px, la bonne réponse se révèle en aplat champagne, le chrono est une ligne fine doublée d'un grand chiffre. Deux couleurs distinctes sur un écran de PC peuvent devenir identiques à cinq mètres.
- **Les polices voyagent avec l'application.** Cormorant Garamond (600, et l'italique 500 pour les sous-titres) et Figtree (fonte variable, 400 à 600) sont livrées en woff2 dans `client/public/fonts` — sous-ensemble latin, 67 Ko en tout, licence OFL jointe — et servies par le serveur. Rien ne part chercher Google à l'exécution : le repli wifi local marche hors ligne, et la politique de sécurité reste à `'self'`.
- **La couleur n'est jamais seule.** Les quatre teintes (rose, champagne, lavande, sauge) ne servent qu'aux formes ▲ ◆ ● ■ des réponses, en SVG ; le texte reste encre. Les icônes d'interface sont des SVG au trait de 1,8 px — plus d'emojis dans l'interface, seuls les avatars et les emojis d'équipe en restent, parce que ce sont les invités qui les choisissent (tous antérieurs à Unicode 13 : Windows 10 n'affiche pas les plus récents). Les animations se coupent si le système demande moins de mouvement.

L'écran commun a deux repères fixes : une bande d'état en haut (le titre de la soirée, quiz en cours, « Question 3 / 8 », combien ont répondu, QR et adresse pour rejoindre — et, quand la base en ligne refuse les écritures depuis une dizaine de secondes, une pastille discrète, « Sauvegarde en retard — la soirée continue », puisque la salle la voit aussi) et une **console animateur** en bas, toujours au même endroit — Révéler, Pause, Auto, Terminer, puis le son, le fond clair ou sombre, et le plein écran. « Terminer » est collé à « Auto », et la fin d'un quiz ne se rattrape pas : en pleine question, photo à mémoriser comprise, il demande confirmation ; pendant une révélation, il termine sans demander. L'espace animateur (`/edit`, `/compte`, `/admin`) partage la palette mais reste calme : pas d'animation, c'est un outil de travail, pas un spectacle.

**« Ivoire »** est Velours passé sur papier, pour l'écran commun quand le vidéoprojecteur ne rend pas les noirs : le fond devient crème (`#f9f5ec`), le noir chaud devient l'encre, le champagne s'assombrit (`#ac8536`) pour rester lisible, et les quatre teintes des formes foncent — le losange champagne disparaissait sur la crème. Ce sont aussi les couleurs des fiches imprimées du bilan (`/<espace>/bilan/fiches`), qui les prennent d'office. Techniquement, c'est un second jeu de variables sous `:root[data-theme='ivoire']` dans la même feuille de style : rien d'autre ne change, ni les tailles, ni les polices, ni la mise en page. Le bouton de la console pose l'attribut sur la page et mémorise le choix (`client/src/theme.ts`) ; il n'est lu que sur `/host`, les téléphones n'en savent rien.

## Architecture

```
client/   React + Vite — les adresses (client/src/routes.ts) : "/" et "/profil" (l'accueil : son
          profil, et de quoi animer ou rejoindre une soirée), "/<espace>" (téléphone),
          "/host" (écran commun), "/edit" (mes quiz), "/compte", "/admin", "/connexion",
          "/activer" (le compte), "/<espace>/souvenir", "/bilan", "/soirees" (les pages
          publiques — "/stats" ouvre le souvenir sur ses chiffres ; chaque archive se relit
          par "/<espace>/soirees/<id>/…")
server/   Node + Socket.io + Express — logique de jeu 100% côté serveur
shared/   Types et fonctions pures partagés (protocole socket, vues du quiz, bibliothèque, barème
          des équipes, classement et ex æquo, homonymes, espaces, écart d'horloge, messages
          d'erreur, garde-fous)
```

- **AuthStore** (`server/src/auth/store.ts`) + **routes d'auth** (`auth/routes.ts`, `auth/http.ts`) — les comptes, leurs sessions et leurs liens d'activation, dans la base permanente et en mémoire ; la porte de l'API (`requireAccount`), le garde anti-CSRF, la limite d'essais — une seule réserve par serveur (`loginBudgetOf`), que les portes du profil partagent avec celles du compte. `shared/securite.ts` décide, lui, où revenir après la connexion (`pageDeRetour`). La suppression d'un compte est une cascade composée dans `server.ts`, là où toutes les réserves sont à portée : connexions, soirée en mémoire, disque local, miroir, historique, bibliothèque, et le compte en dernier.
- **SpaceRuntime / SpaceRegistry** (`core/space.ts`) — la soirée d'un espace : ses registres, son moteur, ses salons socket et ses diffusions (dédoublonnées, regroupées). Créée à la première connexion ; les espaces dont une partie était en cours au démarrage sont réveillés tout de suite.
- **Party** (`server/src/core/party.ts`) — registre des joueurs d'un espace. L'identité survit aux coupures : un token stocké sur le téléphone permet de retrouver son joueur après un refresh, une perte de réseau ou un redémarrage du serveur. C'est ce même token que porte chaque réponse (`player:action`), pour qu'une connexion encore anonyme puisse être rebranchée sur son joueur sans attendre la fin du re-join. Un téléphone qui se re-présente avec son jeton (`player:join`) ne réécrit rien : le prénom et l'avatar qu'il renvoie sont ignorés, la fiche du serveur fait foi. Un jeton qui ne désigne plus personne — exclu, essai effacé — est refusé (`unknown-token`), jamais recréé ; celui d'une soirée qu'on vient de clore reçoit sa fin de soirée (`soiree-close`). Une connexion n'incarne qu'un invité à la fois. Les marques d'homonymie (`shared/homonymes.ts`) se calculent ici, gardées en mémoire jusqu'à ce qu'un prénom, un avatar ou la composition de la salle change.
- **ProfileStore** (`server/src/auth/profiles.ts`) + **routes** (`auth/profileRoutes.ts`) — les profils des joueurs récurrents, dans la base permanente. Ils réutilisent le hachage scrypt et le modèle de session des comptes, mais pas leur table : un animateur possède un espace, pas un joueur. Et là où `AuthStore` garde tous ses comptes en mémoire (il y en a une poignée), les profils peuvent se compter par milliers : seules les sessions y montent, un profil s'y range à la première lecture.
- **Récompenses** (`shared/badges.ts`, `shared/hautsfaits.ts`, `shared/legendaires.ts`, `shared/divins.ts`) — l'étagère et le calcul de la rareté ; le catalogue des hauts faits, de soirée et de carrière ; les douze légendaires et leur règle ; les cinq Divins, leur nom seulement — leurs règles et leurs légendes, secrètes, sont dans `server/src/core/divins.ts`, que rien du client n'importe. Les prix de soirée, eux, n'ont pas de catalogue à part : ce sont ceux de `stats.ts`. Chaque récompense rangée garde une copie de son emoji et de son titre — une étagère se relit des années plus tard. Le dessin des légendaires et des Divins vit côté client (`components/Legendaire.tsx`, `components/Divin.tsx`).
- **Journal, expérience, hauts faits** (`core/journal.ts`, `core/progress.ts`, `core/hautsfaits.ts`) — le journal rangé question par question et quiz par quiz, puis ce qu'une soirée rapporte à chacun : fonctions pures sur les journaux, comme le souvenir et le bilan, et une seule lecture du journal pour les deux. La consolidation se fait dans `space.ts` : l'expérience de chaque quiz dès son podium (le « verdict » que lève le module de jeu), le reste à la clôture, la clé `(profil, soirée)` rendant tout idempotent. `core/recalcul.ts` relit l'historique au démarrage quand le barème a changé.
- **Teams** (`teams.ts`) — registre des équipes, séparé des joueurs : une équipe vit toute la soirée, ses membres vont et viennent. Le rattachement est une colonne sur le joueur, donc déplacer quelqu'un déplace ses points sans toucher au journal des scores.
- **AnswerLog** (`answers.ts`) — une ligne par joueur et par question posée, réponses manquantes comprises. C'est la seule source des statistiques : le classement, lui, ne garde que les gains positifs. Une question annulée ou reposée en sort, pour ne pas compter deux fois.
- **Stats** (`stats.ts`) — les moyennes, les séries et les prix, dérivés du journal. Les prix sont proposés : leurs points ne s'appliquent que si l'animateur les remet.
- **Classement** (`shared/classement.ts`) — une seule règle pour tous les écrans et toutes les pages : le rang est partagé (1 + le nombre de concurrents strictement devant), des ex æquo en tête sont tous vainqueurs, et l'ordre dans lequel on les écrit — le prénom affiché, puis l'identifiant — n'est qu'un ordre d'affichage, qui ne clignote pas d'un rafraîchissement à l'autre. Le souvenir, le bilan, les prix, l'expérience et les podiums de l'écran commun passent tous par là : il y avait cinq règles, et deux invités à 300 points ne savaient pas lequel avait gagné.
- **Review** (`review.ts`) — le bilan question par question, dérivé du journal recroisé avec les questions telles qu'elles ont été posées : la copie du quiz gardée dans chaque partie terminée, sinon la bibliothèque. Servi par `/s/<espace>/bilan.json`, public ; `export.ts` en tire les fichiers de `npm run export`.
- **Recap** (`recap.ts`) — la page souvenir, calculée des journaux par une fonction pure : la soirée en cours et une archive passent par le même chemin.
- **Archive** (`archive.ts`) — l'historique des soirées : une copie complète de la soirée (journaux, quiz joués) rangée dans la base permanente, relue par `/s/<espace>/soirees/:id/recap.json` et `…/bilan.json`. Archiver ne recalcule rien ; relire se fait avec le code du jour. La liste de l'historique relit, elle, la fiche de faits bruts rangée à côté de chaque archive (colonne `summary`), jamais l'archive entière. `soireeDesInvites` y dit aussi le nom d'une soirée — l'arrivée du plus ancien invité présent —, que `space.ts` ne tire qu'une fois, puis fige.
- **ScoreLedger** (`scores.ts`) — scores en append-only : chaque gain est une ligne (joueur, points, raison). Classement = somme par joueur, historique gratuit.
- **PartyBackup** (`core/backup.ts`) — le miroir de la soirée dans la base permanente. Une file par espace, dans l'ordre, une seule requête en vol, qui réessaie avec un délai croissant jusqu'au succès ; les gains et les réponses y gardent l'identifiant tiré à l'écriture locale (colonne `uid`) — rejoués, ils ne s'ajoutent pas deux fois ; les états successifs d'une même partie s'y remplacent ; au-delà de 4 Mo en attente, et à chaque rétablissement, une resynchronisation de l'espace entier, relu dans la base locale par lots de 200, qui n'envoie que ce qui manque et n'efface jamais rien. `/healthz` en dit la santé, tous espaces confondus sans en nommer aucun (bloc `miroir`). Le serveur et ses scripts parlent à la base permanente par `core/distante.ts`, qui donne dix secondes à chaque requête : une base muette se dit en dix secondes, pas en cinq minutes.
- **GameEngine** (`engine.ts`) — pilote la partie en cours d'un espace (une seule à la fois par espace) : route actions/commandes/timers vers le module de jeu, persiste l'état après chaque changement et rediffuse les **vues filtrées**. Ce qu'un passage du module écrit — gains, réponses, état de la partie — part au miroir d'un seul tenant, dans une transaction (`run()`).
- **Horloge** (`shared/clock.ts` + `client/src/clock.ts`) — l'écart entre l'horloge d'un écran et celle du serveur, mesuré à chaque connexion par `time:sync` et appliqué par `serverNow()`. Les chronomètres (barre de temps, 3-2-1, enchaînement automatique) ne lisent plus l'heure locale : une horloge de téléphone qui dérive affichait du temps qui n'existait plus, et les réponses envoyées dans ce temps-là étaient perdues.
- **Vues filtrées** — les clients ne reçoivent jamais l'état brut : chaque joueur reçoit `playerView(state, playerId)`, l'écran `hostView(state)`. C'est ce qui empêche la bonne réponse d'arriver dans le téléphone avant la révélation. Ce qui ne dépend pas du destinataire — le classement, le podium — se calcule une fois par diffusion, pour toute la salle, dans un mémo qui naît et meurt avec elle (`ViewContext.memo`) : voir « Test de charge ».
- **QuizStore** (`quizStore.ts`) + **API** (`api.ts`) — la bibliothèque de quiz et son API REST, derrière la session, chaque appel dans l'espace du compte connecté. Les photos sont servies par `/media/image/:id`, sans compte : les téléphones doivent pouvoir les charger, et l'identifiant est un UUID impossible à deviner — c'est lui, la permission ; les formats se bornent à JPEG, PNG et WebP, jamais de SVG. Le ménage des photos n'efface que celles qu'aucun quiz, aucune soirée archivée ni aucune partie encore sur le disque ne cite : le bilan d'une soirée passée garde les siennes.
- **Module quiz** (`server/src/games/quiz.ts`) — les règles : phases, timers, scoring, vues. L'état porte un tour (`round`) qui avance chaque fois qu'une question est posée, « Reposer » compris : les vues le portent ; les commandes `next`, `cancel` et `replay` renvoient la phase, la question et le tour que l'animateur avait sous les yeux, les réponses la question et le tour qu'elles visent. Une commande périmée est ignorée sans un mot — c'est un doublon, pas une erreur ; une réponse périmée reçoit « trop tard », avec son accusé ; un écran resté sur une page d'avant n'envoie rien de tout ça, et ses gestes se lisent comme avant. Le moteur étant synchrone et la bibliothèque asynchrone, le module garde une **copie en mémoire** des quiz de chaque espace, rafraîchie au démarrage et après chaque édition — jamais pendant une partie.

## Feuille de route

| Lot | Contenu | Statut |
|---|---|---|
| 1 | Nettoyage : application 100 % quiz | ✅ |
| 2 | Bibliothèque en base + éditeur de quiz dans le navigateur | ✅ |
| 3 | Questions « estimation », entrée en cours de quiz, révélations enrichies | ✅ |
| 4 | Habillage show (mode scène, barre de temps, podium animé, sons) | ✅ |
| 5 | Déploiement gratuit (Render + Turso), QR public, test de charge à 50 joueurs | ✅ |
| 6 | Scores à l'abri d'un redémarrage, écran commun qui tient dans la hauteur | ✅ |
| 7 | Commandes d'animation : pause, question reposée, invités gérés | ✅ |
| 8 | Podium de la soirée et page souvenir | ✅ |
| 9 | Import en masse, aperçu, veille des téléphones, prénoms en double | ✅ |
| 10 | Équipes : points individuels, classement collectif, barème des équipes | ✅ |
| 11 | Photo « mémoire » et classements annoncés entre deux questions | ✅ |
| 12 | Journal des réponses, statistiques, prix de fin de soirée et écran de victoire | ✅ |
| 13 | Le bilan : ce que chacun a répondu question par question, la relecture collective, les fiches imprimables, l'export CSV | ✅ |
| 14 | L'historique des soirées : archives complètes, relecture des pages d'une soirée passée, sauvegarde avant remise à zéro | ✅ |
| 15 | Les comptes et les espaces : un animateur par compte, ses quiz et ses soirées à lui, un lien d'activation pour chaque ami | ✅ |
| 16 | Les pages publiques reliées par un fil, le tableau des chiffres aux repères figés, la suppression d'un compte | ✅ |
| 17 | Les réponses qui se perdaient : accusé de réception, heure du serveur, marges de fin de question | ✅ |
| 18 | Les profils joueurs : expérience, niveaux, finitions d'avatar et Éclat | ✅ |
| 19 | Les badges : prix de soirée persistés, badges de carrière, rareté calculée | ✅ |
| 20 | Les récompenses (RECOMPENSES.md) : « Clore la soirée » et l'historique qui s'écrit seul, l'expérience au mérite, les hauts faits et leurs paliers, douze avatars légendaires, la carte d'un joueur, la fin de soirée sur le téléphone, les catégories de questions | ✅ |
| 21 | Les Divins : cinq avatars au-dessus des légendaires, aux règles secrètes, annoncés à toute la salle | ✅ |
| 22 | Les légendaires se méritent : une vingtaine de quiz au premier qui en décroche un, mesurée par simulation ; ce qui était gagné reste gagné | ✅ |
| 23 | Des quiz entre amis, avec ou sans inscription : des niveaux qui se méritent sans que personne n'en redescende, des quiz qui s'exportent et s'importent d'une bibliothèque à l'autre | ✅ |
| 24 | La tablée : une soirée jouée par des agents — sept invités et une animatrice, chacun sur son appareil —, et leurs retours vérifiés un à un (`retours/`) | ✅ |

## La direction

### Ce qui n'a pas bougé, et ne devrait pas

Quatre partis pris tiennent l'application depuis le début. Ils ont survécu à
plus de vingt lots, et chaque fonctionnalité nouvelle doit se ranger derrière eux
plutôt que les contourner.

1. **Un geste pour jouer.** On scanne, on tape un prénom, on joue. Rien à
   installer, aucun compte obligatoire — et la moitié d'une salle en restera
   toujours là. Les profils se sont greffés à côté de ce chemin ; ils ne l'ont
   pas remplacé, et ne doivent jamais le faire.
2. **Zéro euro, zéro donnée personnelle.** L'hébergement tient sur des offres
   gratuites, et même les profils ne demandent pas d'adresse e-mail — un code
   de secours suffit. Toute idée qui exige un fournisseur payant ou une
   collecte de données part avec un handicap qu'il faut justifier.
3. **Le serveur décide, les écrans regardent.** Aucun client ne reçoit l'état
   brut. C'est ce qui empêche la bonne réponse d'arriver dans un téléphone
   avant la révélation, et ce qui rend une reprise après coupure possible.
4. **Ce qui a été joué se garde.** Les journaux, les archives, les copies des
   quiz tels qu'ils ont été posés. Les pages se recalculent à partir d'eux par
   des fonctions pures, si bien qu'une amélioration d'aujourd'hui profite aux
   soirées d'il y a trois ans.

### Où ça en est

L'application couvre une soirée de bout en bout : écrire les quiz, les jouer,
les commenter, les ranger, les relire, se les passer d'un animateur à l'autre
— et s'en souvenir d'une soirée à l'autre. Le moteur, lui, ne connaît aucune
règle : `GameModule` route des actions, des commandes et des chronomètres vers
un module de jeu, et le quiz n'en est qu'une implémentation.

### Les chemins ouverts

Rien de tout cela n'est promis. Ce sont les directions que le code rend
naturelles, avec ce qu'elles coûtent.

**Un second module de jeu.** Le moteur est prêt ; rien n'a jamais été branché
d'autre que le quiz. Un jeu de rapidité, un blind test, un « qui a dit ça » se
poseraient dessus sans toucher au reste. Coût réel : les vues, les sons et
l'écran commun sont écrits pour le quiz — la généralisation se paierait là.

**La dimension sociale des profils.** La carte d'un joueur a ouvert la porte :
réclamer ses anciennes soirées, les rivalités, se retrouver d'un cercle à
l'autre viendraient ensuite (RECOMPENSES.md en garde la liste). Attention : la
tension avec le parti pris n° 1 est réelle. Plus un profil devient utile, plus
l'invité anonyme risque de se sentir de seconde zone — et ce jour-là,
l'application aura perdu ce qui la rend jouable en trente secondes.

**Les archives figées.** Une soirée archivée garde les prénoms et les emojis,
pas les finitions ni les niveaux du jour. Les relire aujourd'hui donne donc un
souvenir légèrement faux. Le corriger demande de figer l'état d'un profil dans
l'archive au moment où on la range.

**Ce qui n'est volontairement pas fait** : classement public entre espaces
(chaque animateur est chez lui), application native (le navigateur suffit et
n'a rien à installer), et tout ce qui demanderait une base de données payante.
