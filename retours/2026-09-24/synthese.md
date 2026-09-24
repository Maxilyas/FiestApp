# La deuxième tablée — trois soirées en même temps, et dix-neuf experts, 24 septembre 2026

La demande : faire tourner plusieurs quiz en même temps, chez des animateurs
différents ; faire évaluer le design et le parcours — trop d'allers-retours ?
du liant qui manque entre les pages ? — et la rapidité de l'application ; un
rapport détaillé des améliorations possibles par évaluateur. Pour y répondre,
une journée d'agents en trois couches :

- **Trois soirées jouées en même temps, sur un même serveur** (`/tablee`,
  section « Plusieurs salons ») : chez **Nadia**, qui rejouait la soirée du
  23 septembre avec ses huit personnages ; chez **Marc**, un afterwork d'agence
  projeté en 1920 × 1080, avec un quiz écrit par une IA ; chez **Léa**, une
  crémaillère animée depuis un téléphone. **Inès** est passée de l'une à
  l'autre. 17 agents, 57 minutes, 1 648 gestes ; les trois soirées ont été
  closes, puis relues le lendemain.
- **Dix-neuf experts**, une mission chacun (`.claude/skills/tablee/experts/`) :
  les parcours de l'animateur, de l'invité et du joueur à profil, la carte du
  site, l'administrateur et ses animateurs, la première visite, l'éditeur ;
  l'écran commun, le téléphone, le système de design, les mots,
  l'accessibilité, les concurrents ; l'étanchéité des espaces ; la performance
  du serveur, du temps réel, du chargement et du rendu, et le pouls du serveur
  pendant les trois soirées. Quatre ont travaillé ici, quinze dans leur propre
  session, chacun sur sa machine.
- **Cinq vérificateurs** : chaque bug annoncé relu dans le code, à la ligne,
  ou rejoué — près de trente rejeux et mesures —, recoupé entre sources, et ce
  qui venait du banc écarté à part.

En tout, 41 agents. **Chaque constat ci-dessous est vérifié** ; le détail, les
preuves et les pistes de code sont dans les cinq fichiers de `verification/`,
dont les identifiants sont repris entre crochets (`[E1]`, `[IN-5]`…). Les
retours bruts des personnages sont à côté (`<nom>.md`), les rapports des
experts dans `experts/`, tels qu'ils ont été écrits. Les chemins `export/…`
qu'ils citent renvoient au dossier local de la tablée, hors de git ; une
sélection de captures est dans `captures/`.

**Un incident de banc.** Vers 15:26, la limite d'usage de l'outil a coupé les
35 agents d'un coup, pendant vingt-cinq minutes. Chez Nadia, l'enchaînement
automatique a joué seul les questions 8 à 10 devant une salle vide. Les agents
ont repris ensuite ; tout ce qui en découle est écarté (voir en fin de
document).

## En bref

### Plusieurs animateurs en même temps : étanche et léger — jusqu'à la grande salle

- **Les trois soirées ne se sont pas gênées.** Aucune erreur au journal du
  serveur en 57 minutes. L'accusé d'une réponse, mesuré au pilote, a eu la
  même médiane dans les trois salons (550, 564 et 574 ms : le coût fixe du
  banc). Aucune fuite d'un espace à l'autre, et Inès a joué dans deux soirées
  sous le même profil sans jamais être marquée « (2) ». Rejoué seul, à la
  même échelle, le serveur prend **1,8 % d'un cœur** ; et `/healthz` a
  répondu en 2 à 14 ms même quand les navigateurs saturaient la machine.
- **Les experts ont cherché la fuite, sans la trouver.** Soixante-dix
  tentatives — une commande sur la partie du voisin, un jeton présenté
  ailleurs, un `party:watch` croisé, les archives, les cartes, les quiz,
  `/api/admin` — et 6 880 téléphones simulés : **aucune ne passe**. Les
  redémarrages (SIGTERM, SIGKILL, disque effacé) reprennent **les deux**
  soirées en cours, chronomètres réarmés.
- **La capacité, au dixième de cœur de Render gratuit** (rejoué en suspendant
  le serveur 90 ms sur 100) : **dix soirées de 30 en même temps tiennent**
  (accusé p95 ≤ 255 ms, révélation ≤ 0,8 s), une soirée de 150 tient, une de
  300 casse (accusé à 1,2 s de médiane, 3,2 s au pire).
- **Ce qui cède en premier, et gèle tous les espaces à la fois** : le
  **souvenir d'une grande soirée, scanné par toute la salle**. Cinquante scans
  du QR d'une soirée de 150 invités × 40 questions demandent 3,7 s de calcul :
  au dixième de cœur, le serveur **ne répond plus à personne pendant 32 s**
  (mesuré ; avec Turso, plutôt une demi-minute où chaque geste de chaque
  soirée attend jusqu'à une seconde). Le souvenir et le bilan se recalculent
  à chaque requête (axe 7). Un voisin bruyant se sent aussi à son arrivée
  (quand 150 invités entrent d'un coup, les inscriptions des voisins attendent
  plusieurs secondes), et un peu pendant le jeu (révélations jusqu'à 0,8 s de
  retard).
- **La réserve d'inscriptions par adresse est commune à tous les espaces**
  (bug confirmé) : deux soirées derrière une même box se la partagent. Et en
  ligne, le serveur lit peut-être l'adresse du proxy de Render plutôt que
  celle du client — à vérifier en production : si c'est le cas, toutes les
  soirées du serveur partagent une seule réserve (axe 8).

### Le design : beau et cohérent, jusqu'au cas limite

- Velours tient (l'encre à 15,5:1), les couleurs sont un vrai système de
  jetons, **rien ne repose sur la couleur seule** — Camille D., daltonienne,
  n'a rien manqué —, « réduire les animations » est respecté, et les
  dialogues sont exemplaires au clavier.
- Ce qui casse : **les réponses longues** sur les deux écrans de référence ;
  **le 1920 × 1080**, où tout est 30 % plus petit qu'en 1366 ; **le verdict
  des équipes**, expliqué de quatre façons dont une fausse, et renversé par
  les prix devant la salle chez deux animateurs sur trois ; **la pause**,
  qu'on ne voit pas du canapé ; **les champs de nombres**, où « 45 » devient
  « 2045 ».

### Les allers-retours et le liant : la soirée est courte ; c'est avant et après qu'il manque des portes

- **Pendant la soirée, pas d'allers-retours en trop.** L'invité entre en
  3 touchers et un prénom ; la console dit toujours la suite (Nadia : « je
  n'ai jamais cherché quoi faire ») ; un onglet fermé ramène dans la question
  en cours.
- **Le liant manque à trois jointures** — entre deux moments, deux rôles, deux
  appareils —, et c'est là que sont les **neuf impasses** recensées :
  - **après la clôture**, la fin de soirée ne vit qu'en mémoire, le bilan
    redemande « Qui es-tu ? », rien ne mène à la soirée d'hier, et le seul
    bouton visible fait entrer dans la soirée *suivante* — qu'il date alors
    du jour de la visite (bug rejoué) ;
  - **l'accueil** ignore l'animateur qui n'a pas relié de profil, et refuse
    ses identifiants ;
  - **la console tenue au téléphone** n'envoie ni les prix ni la victoire à la
    télé.
- **En gestes** : de l'activation au lendemain, l'animateur en fait environ
  136 sur le chemin qu'ont pris Nadia, Marc et Léa (168 s'il envoie un lien à
  chaque invité) ; le parcours proposé en retire environ 25, surtout en levant
  l'impasse de l'accueil, en donnant le bon lien à partager et en évitant cinq
  allers-retours. Les moments « où est-ce que je vais maintenant ? » vécus se
  comptent sur les doigts d'une main : l'accueil, de l'éditeur à l'écran
  commun, le lien à partager.

### La rapidité : rapide au téléphone, fluide partout — les octets et la grande salle d'abord

- Un invité en **4G moyenne sur un téléphone d'entrée de gamme** voit l'écran
  d'entrée en **2,2 s**, et arrive en salle d'attente **2,6 s** après le scan
  (225 Ko) : c'est la bande passante qui compte, pas le processeur. **60 images
  par seconde** sur l'écran commun comme sur un téléphone ralenti six fois, et
  **aucune fuite de mémoire** sur trente questions d'affilée (le serveur tient
  entre 115 et 235 Mo).
- **Le temps réel** : sur quatre cœurs, jusqu'à 500 invités, la question
  arrive 3 à 13 ms après le geste et l'accusé en 2 à 3 ms ; au dixième de
  cœur, l'accusé médian est de 42 ms à 50 invités, 74 ms à 150. Les quelque
  550 ms vécues pendant la tablée étaient celles du pilote des agents, pas du
  serveur.
- Ce qui coûte : la compression faite **à la volée** (la moitié du coût d'une
  arrivée, et des fichiers plus gros qu'en gzip), les dessins des légendaires
  sur le chemin de l'invité anonyme, les médaillons légendaires animés (une
  salle d'habitués fait tomber l'écran commun à 40 images par seconde à la
  clôture), le chrono qui anime `width`, et l'écran commun redessiné en entier
  à chaque réponse.

## Les axes d'amélioration

Priorité : **P1** abîme la soirée de toute une salle, **P2** celle de
quelques-uns, **P3** le confort. Effort : **S**, quelques lignes ; **M**, une
journée ; **L**, un lot. Entre crochets, le constat dans `verification/`.

### 1. Le verdict des équipes se retourne sans prévenir — P1 · S à M

C'est le moment qui conclut une soirée, et il a trébuché dans les trois
salons.

- **Un quiz fini change de vainqueur quand quelqu'un rejoint une équipe après
  coup** — *bug confirmé, rejoué*. Chez Léa, les invités avaient gagné ; Inès
  arrive après le quiz, choisit leur équipe à 0 point, leur moyenne tombe de
  1 280 à 640 et l'écran de victoire couronne « La coloc » (capture `01`).
  Léa a dû la sortir de l'équipe. `teamScores` fait la moyenne de **tous** les
  membres (`shared/teams.ts:18-35`), la même fonction pour la salle, le
  souvenir, le bilan et l'historique, alors que l'archive sait qui a joué.
  *Piste* (S) : un membre ne compte qu'à partir de sa première réponse, et son
  test dans `server/test/`. [salons-marc-lea 1]
- **Un retardataire fait baisser la moyenne pour des questions qu'il n'a pas
  jouées** (Karim : 182 → 121), et deux règles coexistent : le bilan divise
  par les présents au quiz, la victoire par tous les membres. *Piste* (M, à
  arbitrer : c'est un choix de produit) : une seule règle dans
  `shared/teams.ts`, au prorata des questions posées — le journal a une ligne
  par invité et par question posée. [salon-nadia 5]
- **Des prix « pour rire » renversent un vainqueur déjà annoncé**, chez Nadia
  (les Arrabbiata, puis un ex æquo, capture `05`) comme chez Marc (« devant
  toute l'agence »). Le README le veut — « un prix peut renverser l'ordre,
  c'est tout son intérêt » —, mais l'animateur le découvre après l'avoir
  annoncé : aucun aperçu, un « 1 » sans étiquette, et un prix d'honneur à
  0 point refusé (`server/src/core/teams.ts:153`). *Pistes* (S) : montrer
  l'effet avant de cliquer (« +1 aux Guitaristes → égalité avec les
  Arrabbiata »), accepter un prix à 0 point, écrire « avant les prix » au
  podium. [salon-nadia 1, salons-marc-lea 8, E7]
- **Le classement des équipes s'explique de quatre façons, dont une fausse.**
  « Le gros chiffre est le total du quiz » est faux dès le deuxième quiz ;
  « barème » et « chiffre cerclé » n'ont été compris ni de Nadia, ni de Marc,
  ni de Liam. Et le téléphone classe à la seule moyenne quand la télé classe
  prix compris : après une remise de prix, ils n'ont pas le même premier.
  *Piste* (S) : un seul mot, « points d'équipe », une seule phrase rangée dans
  `shared/`, le même classement partout. [M1]

### 2. L'écran commun, à la taille de la salle — P1 · S à M

- **En 1920 × 1080, tout rapetisse** : les tailles plafonnent vers 1 300 px de
  large (`clamp(…, 4.4vw, 3.5rem)`), le QR reste à 148 px, les étiquettes à
  11 px. La même télé montre tout 30 % plus petit qu'en 1366, et les réponses
  passent sous le seuil de lecture à trois mètres. *Piste* (M) : la taille
  racine de `/host` calculée sur la hauteur de l'écran, réservée aux grands
  écrans (Léa anime `/host` au téléphone), puis les tailles de scène en `rem`.
  [E2]
- **Les réponses longues cassent les deux écrans de référence.** En
  360 × 640, la grille des réponses recouvre la question ; en 1366 × 768, le
  texte est rogné dans les cartes, et à la révélation le classement passe sous
  la console, qui n'a pas de fond, jusqu'à recouvrir « Question suivante ».
  Une liste écrite par une IA en produit volontiers (120 caractères permis).
  *Pistes* (S-M) : une marge dans les cartes, un palier de taille au-delà de
  60 caractères, `align-content: safe center`, une console opaque. [E1]
- **En 1366 × 768, ça déborde encore dès sept invités** : la révélation d'une
  estimation à six réponses, la liste de l'écran de victoire (arrêtée au
  cinquième, capture `05`), la remise des prix. Les listes défilent dans leur
  cadre, et personne ne fait défiler une télé. *Pistes* (S) : couper à ce qui
  tient (« et 2 autres »), deux colonnes pour les estimations, et ajouter ces
  écrans à la liste « Regarde le rendu » du CLAUDE.md. [salon-nadia 3]
- **La pause ne se voit pas du canapé** — le constat qui a le plus de sources :
  les trois animateurs, trois invités, déjà demandé le 23. Seul un « ⏸ »
  remplace les secondes ; « Regardez bien… » et « Suivante dans 7 s » sont des
  étiquettes de 11 px. *Piste* (S) : un bandeau d'état unique, « En pause » en
  grand sur la télé comme au téléphone, et des réponses visiblement éteintes.
  [E3]
- Et : les noms du podium à 20 px sous des marches de 400 px [E8], le QR
  qu'il faut se lever pour scanner [E9], le compte des mauvaises réponses à
  2,39:1 en Velours — deux lignes [E5].

### 3. Les nombres qu'on tape, et les listes qu'on colle — P1 · S

- **Cinq champs de nombres refusent d'être vides.** On efface « 20 », il
  revient ; on tape 45, on obtient « 2045 », que le serveur ramène à 120 s
  sans un mot, la question comptée « prête » (capture `04`, rejoué ; arrêté
  sur le « 4 » intermédiaire, il aurait enregistré 5 s). Nadia, Léa (« 2050 »
  sur huit questions, dix minutes perdues), Marc et l'expert éditeur l'ont
  vécu. C'est le temps d'une question, le temps d'observation, « Invités au
  plus » et les points des prix, tous lus par `Number(e.target.value)` — en
  écart avec la convention du CLAUDE.md (« le champ garde le texte tapé ;
  `lireNombre()` »). Le bug date du 22 ; le banc du 23, qui remplissait les
  champs d'un coup, le cachait. *Piste* (S) : un composant `ChampNombre`, et
  `questionProblem` qui refuse un temps hors bornes. [S1, AN-15, salon-nadia 2]
- **Une liste « bavarde » entre avec la mauvaise bonne réponse** — *bug
  confirmé, rejoué*. Une IA qui répond en gras, numérotée, à puces, avec
  l'étoile en fin de ligne (`**1. …**`, `- Canberra *`) : l'intitulé garde ses
  `**`, la **première** réponse devient la bonne, et le quiz se dit « prêt ».
  *Piste* (S) : nettoyer la mise en forme, accepter l'étoile en fin de ligne,
  ne pas dire prête une question sans étoile. [ED-1]
- **Le temps d'une liste collée suit trois règles** : l'aide du panneau dit
  « celui de la question qui précède », le format copié pour l'IA dit
  « 20 s », le lecteur prend celui de la question voisine du point où l'on
  colle (rejoué : `[50, 20, 20]`). C'est ce qui a envoyé Léa dans le champ
  « 2050 ». *Piste* (S) : `Temps :` court comme `# Catégorie`, dit pareil
  partout, dans `FORMAT_DE_LISTE` et son exemple. [AN-16]
- **« Régler tout le quiz »** (temps, catégorie) : les trois animateurs l'ont
  cherché (S-M) [ED-3]. **Deux appareils sur un même quiz** : le dernier
  « Enregistrer » écrase l'autre en silence (M : une version comparée, un 409)
  [ED-2].
- En chiffres : un quiz de dix questions coûte 82 gestes à la main, 9 par une
  liste collée, 2 par un fichier importé. Nadia en a écrit dix en 4 min 38 s ;
  Marc avait un quiz jouable cinq minutes après avoir activé son compte.

### 4. Après la clôture : une impasse, et une date fausse — P1 (la date) · P2 · S à M

C'est le cœur de la question du liant.

- **La soirée suivante prend la date d'un invité qui ne l'a pas jouée** —
  *bug confirmé, rejoué, P1 · S*. L'invitée qui revient « voir les
  résultats » ne trouve qu'un bouton, qui l'inscrit dans la soirée suivante ;
  celle-ci prend alors la date de l'invité le plus ancien, absents compris
  (`server/src/core/archive.ts:69-73`) : jouée le 24, elle est archivée
  « du 17 » — son identifiant, sa date à l'historique, le titre proposé à la
  clôture. Le bouton doré « Rejoindre la soirée suivante » de chaque fin de
  soirée et le QR testé la veille font de même. C'est définitif (« ce qui a
  été joué se garde »). *Piste* : tirer la date sur ceux qui ont répondu — on
  change *qui* compte, pas *quand* : l'invariant 11 tient —, avec son test
  dans `cloture.test.ts` et la phrase du README à réécrire. [IN-5]
- **La fin de soirée ne vit qu'en mémoire** — *bug confirmé, rejoué*. Elle se
  perd au rechargement, au retour, quand on la quitte par ses propres liens ;
  après un redémarrage du serveur, le téléphone lit « On ne te retrouve plus
  dans cette soirée ». *Piste* (S-M) : la garder sur le téléphone (sous
  try/catch), et, sur un jeton inconnu quand l'espace vient de clore une
  soirée, « Cette soirée est close — revois-la ». [IN-1]
- **De la fin à son bilan, trois touchers et son prénom à chercher** ; le
  lendemain, **aucun chemin** vers la soirée d'hier. *Pistes* : « Mon bilan »
  en un toucher sur la fin de soirée (S) ; « La dernière soirée : le souvenir,
  mon bilan » sur l'entrée de l'espace et sur l'accueil (M). [IN-2, IN-4]
- **La clôture n'ouvre pas le lendemain** : elle ne propose que « Le
  souvenir » et « La soirée suivante ». Le souvenir n'a ni « Copier » ni
  « Partager », et des deux liens « Souvenir » de l'historique, l'un changera
  de soirée à la suivante. Léa (pour le groupe de la coloc) et Marc (pour la
  lettre de l'agence) ont cherché quel lien envoyer ; Camille M. et Nadia le
  demandaient déjà le 23. *Pistes* (S-M) : « Le bilan », « Les fiches »,
  « L'historique » et un « Copier le lien » stable à la clôture ; « Tous les
  liens » pour l'animateur ; `navigator.share`. [AN-3, C4]
- Et : la fin de soirée ne dit pas les prix de l'invité (Jeanne cherchait son
  Éclair) [salon-nadia 8] ; son bouton doré mène à une soirée qui n'existe
  pas encore — en tension avec le README, « Entre deux soirées » [IN-3] ;
  « 0 joueurs ce soir » pour qui arrive après la dernière question [IN-11].

### 5. Animer debout : une vraie télécommande — P1 quand on anime au téléphone · M

Les trois animateurs l'ont demandée (Nadia : « animer debout, près du
gâteau »), et Léa l'a improvisée : tout le quiz depuis son téléphone, la télé
qui suit à la seconde.

- **Après le quiz, la télé décroche** — *bug confirmé*. « Prix », « Victoire »
  et le podium de la soirée ne s'ouvrent que sur l'écran qu'on touche : un état
  local de la page (`client/src/views/HostApp.tsx:242`), qu'aucune commande ne
  diffuse ; la télé est restée en salle d'attente pendant les prix (capture
  `02`), et Léa s'est levée pour ouvrir la victoire à la télécommande. *Piste*
  (M) : une scène tenue par le serveur (`host:scene` dans l'instantané — elle
  change rarement, l'invariant 4 tient), et son entrée à
  `garde-fous.test.ts`. [AN-7, E4, salons-marc-lea 2]
- **« Qui n'a pas répondu ? »** — la console n'en donne que le compte.
  Demandé le 23, redemandé par les trois animateurs ; c'est aussi ce qui aurait
  montré le fantôme de Rachid (axe 8). *Piste* (M) : les prénoms attendus,
  dans la seule vue de l'animateur.
- **La télé montre les coulisses** : la liste des quiz, la grille des prix et
  la consigne écrite pour l'animateur, projetées à la salle [E10, en tension
  avec le README, qui veut la console sur l'écran commun]. La vraie réponse est
  une mise en page « télécommande » au téléphone (M) [C3].
- **Brancher la télé** a coûté à Léa deux adresses et deux connexions tapées à
  la télécommande. *Pistes* : la porte d'animateur sur l'accueil (S, axe 6),
  puis un code d'appairage validé depuis le téléphone (M) [AN-8].

### 6. Les portes d'entrée : l'accueil, les adresses, les liens qu'on partage — P2 · S

- **L'accueil n'a pas de porte pour l'animateur** qui n'a pas relié de profil,
  et y refuse ses identifiants (« incorrects ») ; `/connexion` n'est liée de
  nulle part. Trois experts l'ont rejoué, Léa l'a vécu. *Piste* (S) :
  « Animer ‹ma soirée› » quand une session d'animateur est ouverte, sinon un
  lien discret « J'anime une soirée » — sans jamais écrire « c'est un
  identifiant d'animateur », qui énumérerait les comptes. [AN-1]
- **L'accueil ne dit pas ce qu'est FiestApp**, et son onglet s'appelle « Mon
  profil ». *Piste* (S) : un surtitre de marque d'une ligne — mesuré :
  « Rejoindre une soirée » reste visible sans défiler en 360 × 640. [PV-2]
- **Un lien partagé ne montre rien** dans WhatsApp ou Slack : toutes les
  adresses servent le même HTML, sans balise `og:`, et tout répond 200 — les
  espaces inconnus, `robots.txt`, `favicon.ico`. *Pistes* (S-M) : des balises
  posées par le serveur à partir du nom de l'espace (sans aucun prénom), 404
  pour un espace inconnu, `noindex` sur les pages de soirée. [PV-1, PV-3,
  PV-4]
- **Les adresses tapées à la main** : « nadia » refusé, « chez-nadia » accepté
  (Camille M., Maëlle : deux essais chacune) ; `/Chez-Bruno` refusé pour une
  majuscule (*bug*). *Piste* (S) : normaliser, puis essayer `chez-‹saisie›`
  avant de refuser — sans jamais proposer de noms voisins (invariant 3). [IN-9,
  C2]
- **Un nouvel animateur part d'une bibliothèque vide** : les deux quiz livrés
  ne vont qu'à l'administrateur, et « Lancer un quiz » répond par un toast qui
  dicte « (/edit) ». *Piste* (S-M) : « Partir d'un modèle », « Importer le quiz
  d'un ami ». [AN-13, C1]
- **Le formulaire de création d'un compte** (`/admin`), que traverse chaque
  ami : l'identifiant se remplit d'une seule lettre, et le tiret ne se tape pas
  dans l'adresse — *deux bugs confirmés* (S). [AD-1, AD-2]

### 7. Tenir une grande salle, et plusieurs, sur l'offre gratuite — P1 · S à M

Sur quatre cœurs, rien ne se sent. Au dixième de cœur de Render gratuit,
rejoué, dix soirées de 30 tiennent en même temps, une de 150 aussi, une de
300 casse. L'ordre de correction, vérifié et dédoublonné
(`verification/perf.md`) :

1. **Le souvenir et le bilan se recalculent à chaque requête** — *bug de
   performance confirmé, mesuré*, P1 dès qu'une salle approche la centaine. Le
   QR du podium et celui de la clôture y mènent toute la salle d'un coup :
   cinquante scans d'une soirée de 150 invités × 40 questions gèlent le serveur
   **32 s pour tous les espaces** au dixième de cœur ; pour une soirée de 30,
   3 s. Le souvenir d'une soirée en cours se rafraîchit aussi toutes les
   20 s, **même dans un onglet caché**. *Piste* (S-M) : un cache par espace qui
   garde la promesse en vol — cinquante requêtes, un seul calcul —, invalidé par
   les journaux (les dérivations restent pures, invariant 14) ; pas de
   rafraîchissement d'un onglet caché ; le test dans `resultats.test.ts`. [T1]
2. **La réserve d'inscriptions**, commune à tous les espaces, et l'adresse lue
   derrière Render — voir l'axe 8. [E1]
3. **La compression se fait à la volée** : du brotli rapide, *plus gros* que
   gzip, et la moitié des 30 ms de processeur que coûte chaque téléphone qui
   arrive. Les fichiers sont pourtant immuables. *Piste* (S) : précompresser au
   build, en brotli 11 et en gzip (`node:zlib`, aucune dépendance) — −15 ms
   par arrivée, −15 % d'octets. [C1]
4. **Rien ne dit, en production, si le serveur tient.** `/healthz` ne donne que
   la mémoire ; `spaces` compte les espaces chargés depuis le démarrage, et
   `quizzes` une partie arrêtée sur son podium. *Piste* (S puis M) : la charge
   du processus, l'occupation et le retard de la boucle (à 20 ms de résolution
   au moins : à 1 ms, la sonde d'un expert a presque doublé le processeur
   mesuré), le retard des chronomètres, les espaces vivants, la latence du
   miroir, le coût des pages publiques — tout agrégé, sans aucun nom, et
   toujours un 200 ; puis une ruée mesurée sur la préproduction, qui tourne sur
   la même offre.
5. **L'instantané porte toute la salle à chaque téléphone**, à chaque arrivée,
   veille ou gain — c'est le volume, pas la fréquence (il est bien regroupé et
   dédoublonné, invariant 4) : sur une vague d'arrivées une par une, 1 Go émis
   pour 300 invités. *Piste* (S) : un instantané de téléphone sans l'état
   `connected` des autres, un regroupement proportionnel à la salle ; plus tard
   (M), un instantané léger — le haut du classement et sa propre ligne. [T3]
6. **`MAX_PLAYERS=150`**, le seul garde-fou contre la salle de 300 qui casse :
   le vérifier sur les deux services Render (c'est leur tableau de bord qui
   fait foi) ; il borne chaque espace, pas leur somme. [T2]
7. **Chaque réponse recalcule et sérialise la vue des N téléphones**, puis
   réécrit tout l'état de la partie ; pendant une question, seules la vue de
   l'auteur et celle de l'écran commun changent. *Piste* (S-M) : une
   rediffusion ciblée, déclarée par le module de jeu, et l'écriture regroupée
   au tour de boucle — c'est ce qui ouvrirait les salles de 300 (estimé : une
   question à 500 de ~1 s à ~0,35 s de processeur). [T4]
8. **La clôture** attend environ cinq allers-retours Turso par profil, en
   série : ~15 s pour cent profils avant que la salle lise « c'est fini ». Et
   **le recalcul au barème du jour**, au premier démarrage d'un nouveau barème,
   passe avant l'ouverture du port (68 s pour 101 soirées, à latence
   simulée). *Pistes* (M) : un parallélisme borné, des lots. [T5, T6]

### 8. Les failles entre espaces, et le téléphone qui meurt — P2 · S à M

- **Là où les espaces partagent quelque chose sans le savoir** :
  - **la réserve d'inscriptions par adresse est commune à tout le serveur**
    (*bug confirmé*, P2 · S) : soixante invités chez A derrière une même box,
    et le premier invité de B derrière la même box est refusé une minute — deux
    soirées dans une école, une entreprise, un tournoi. *Piste* : la clé
    `(adresse, espace)`, plus une réserve large par adresse contre
    l'inondation, et son test. **Un risque de production s'y ajoute**, à lever
    d'abord : le serveur lit la *dernière* entrée de `x-forwarded-for`, en
    supposant un seul proxy ; si celle-ci est l'adresse d'un proxy de Render,
    **toutes les soirées du serveur partagent une seule réserve** de soixante
    inscriptions par minute, et la faille passe en P1. Un journal du nombre de
    clés distinctes par clôture le dira. [E1]
  - un palier de carrière compte l'essai en cours d'un autre espace, et le
    garde quand cet essai est effacé (*bug confirmé*, rare, P3 · S) [E2] ;
  - l'identifiant d'une soirée ne porte pas l'espace, alors que l'expérience
    des profils se range par `(profil, soirée)` : deux soirées nées à la même
    milliseconde se partagent une ligne. Provoqué en figeant l'horloge,
    improbable en vrai (P3 · S : un suffixe tiré de l'espace au moment où l'on
    tire le nom, sans migration) [E3].
- **Le téléphone qui meurt en pleine soirée** (Rachid, capture `03`) : deux
  « Rachid », 186 points qui ne rejoignent jamais les 491 ; rien dans la
  console pour rendre sa place (pendant un quiz, le panneau des invités
  disparaît) ; et le fantôme **attendu à chaque question** (« 0 / 5 ont
  répondu » quand quatre sont connectés) : la révélation ne vient plus d'elle-
  même, Marc a révélé à la main de la Q8 à la Q10. Attendre un invité hors
  ligne est un choix écrit — ne pas révéler dans le dos d'un réseau qui
  hoquette (`games/quiz.ts:318-331`) —, qui pénalise la panne définitive.
  *Pistes* : « Rendre sa place » par un code à usage unique montré sur la
  console (M, une re-présentation ordinaire, que seul l'animateur autorise :
  invariant 9) ; à l'entrée, « un Rachid 🦁 est hors ligne : si c'est toi,
  demande à l'animateur » (S) ; « Ne plus l'attendre » sur la console (S).
  [salons-marc-lea 3]

Détail et scripts de reproduction : `verification/perf.md`,
`verification/salons-marc-lea.md` et `experts/robustesse-espaces.md`.

### 9. La fluidité et le poids des pages — P2 / P3 · S

- **Les octets de l'invité** : précompresser au build (axe 7) ; sortir du
  chemin de l'invité anonyme les dessins des légendaires et des Divins (21 Ko
  qu'il n'affiche jamais, par `lazy()`) ; retirer le préchargement des deux
  polices (mesuré : −157 ms sur l'entrée, sans saut de police visible — et pas
  de `modulepreload` à la place, mesuré pire). Environ 1,8 s jusqu'à l'écran
  d'entrée est à portée.
- **Les médaillons légendaires animés** animent des formes internes de SVG, que
  Chromium ne compose pas : chaque image refait style et mise en page. Une
  salle d'habitués — un tiers de légendaires, forcé pour la mesure, lointain
  aujourd'hui : le premier tombe vers la vingtième soirée — fait tomber
  l'écran commun à 40 images par seconde à la clôture. Les figer dans les
  listes, les animer au podium, à la clôture et sur la carte : 85 % du coût
  rendu (P2 le jour où la bande vieillira).
- **Le chrono anime `width`** tous les dixièmes de seconde, avec une
  transition qui ne s'arrête jamais : soixante mises en page par seconde.
  Posé en `transform: scaleX` par une seule animation, il coûte 80 % de moins
  (122 → 24 ms/s à l'écran commun, 196 → 49 au téléphone).
- **L'écran commun se redessine en entier à chaque réponse d'invité** — 23 fois
  par seconde à 140 invités, 60 images par seconde tenues quand même.
  Regrouper côté serveur le compteur « 12 / 50 ont répondu » (quatre envois
  par seconde au plus) suffit (P3, P2 au-delà de 300).

### 10. Le profil, fil d'une soirée à l'autre — P2 · S à M

Le profil tient sa promesse d'un animateur à l'autre (Inès reconnue d'un scan,
« Le Globe-trotteur » qui récompense ce passage), et le chemin anonyme reste
intact. Mais :

- **Le code de secours servi depuis `/profil` est perdu** — *bug confirmé* :
  le mot de passe change, le code neuf ne s'affiche jamais, et un second essai
  répond « code incorrect » (`components/ProfilForm.tsx:53-88`). (S) [PR-1]
- **Un profil créé depuis l'accueil n'a pas d'avatar** : tous reçoivent 🎉, qui
  n'est pas dans la grille — *bug confirmé* (S). **« Créer mon profil », sur la
  fin de soirée d'un anonyme, ouvre la connexion**, vide, et la soirée ne suit
  pas : une création préremplie, et une phrase qui dit vrai (S). [PR-2, IN-6]
- **« Mes soirées »** n'a ni titre ni lien vers *son* bilan (« Qui es-tu ? »),
  et y compte 4 points quand la fin de soirée en annonçait 24 (les paliers à
  part — *bug*). *Pistes* : `titre` et `joueurId` retenus au crédit (M), les
  deux chiffres dits à la fin (S). Sur `/profil`, « Rejoindre une soirée »
  ignore celle où l'on joue (Sofia, le 23 et le 24) (S). [PR-3, PR-4, PR-5]
- Et : aucun écran pour changer son mot de passe [PR-6] ; l'erreur de
  connexion qui reste affichée sous le code de secours réussi (Malik) [IN-12] ;
  une soirée venue sans jouer n'apparaît nulle part — c'est l'invariant 19,
  mais Inès a vu son profil bouger sans savoir pourquoi (idée : une ligne
  « n'a pas joué », sans rien rapporter) [PR-11].

### 11. Les mots — P2 · S

Les écrans de jeu sont bien écrits : le tu au téléphone, le vous au mur, des
erreurs d'invité qui disent quoi faire. Les mots se gâtent dès qu'on sort de la
question. Vérifiés, avant et après texte par texte dans `experts/mots.md` :

- **Le profil promet « tes points »** (`ProfilForm.tsx:132`,
  `FinDeSoiree.tsx:187`) — une phrase introduite par #28, la correction du 23,
  qui contredit l'invariant 8 : « garde ton niveau, tes prix et tes avatars ».
  [M2]
- **« Annuler les points de cette question ? » → [Annuler] [Retirer les
  points]** : sous pression, on touche « Annuler »… et rien n'est annulé. [M3]
- **Des noms donnés deux fois** (« Le Devin » est un prix et un haut fait),
  **« Le Sans-Faute » à 67 %**, **« ZOÉ — 8.90 S »** au mur, **l'année
  « 1 889 »**, **« Le bilan de Inès »** (`deNom` existe), **« Quizz »** encore
  dans le manifeste, des erreurs qui ne disent pas quoi faire (« La soirée est
  complète ! », « Oups », « (/edit) »). [M4 à M14]
- **Le jargon** : souvenir, bilan, fiche, carte, palmarès, prix, hauts faits,
  badges, légendaires, Divins, finitions, Éclat, barème, XP… ; Jeanne bute sur
  « Biais » et « Écart estim. », Liam sur « Coup d'œil » et « Le Cancre
  Magnifique ». Un glossaire est proposé, avec une définition courte à
  afficher au toucher. Pour Liam, qui lit mal le français, la photo à
  mémoriser et le vrai/faux sont passés sans un mot : les images et les
  chiffres portent. [M12]

### 12. L'accessibilité et le système de design — P2 · S à M

FiestApp est **jouable au clavier et au lecteur d'écran, des deux côtés** —
Hugo, aveugle, a joué toute la soirée à l'oreille —, et les corrections de #30
tiennent. Restent des défauts d'état et de focus, faciles à corriger :

- **Les boutons bascule disent l'inverse** : son allumé, un lecteur d'écran lit
  « Couper les sons, activé » ; le multiplicateur de points et QCM/Estimation
  n'annoncent aucun état (WCAG 4.1.2, S). [A1]
- **Le focus d'un champ** n'est qu'un filet d'un pixel qui passe de 60 à 100 %
  d'or (2,27:1) ; l'anneau des boutons est recopié en neuf sélecteurs (S : un
  anneau unique). [A2]
- **Au texte agrandi**, les avatars de l'entrée se chevauchent (toucher le
  koala peut choisir le lion), et le bloc des équipes du souvenir tombe en
  cascade de lettres (captures `07`, `08`, rejoué sans le zoom du banc) — deux
  effets de bord de #29 avec **« Camil… »**, la marque « (2) » coupée sur la
  console, là où l'on fait les équipes (capture `06`). (S chacun) [T1, T2, E6]
- **Le temps** : l'application n'offre qu'une pause collective. WCAG admet
  l'exception du temps réel, mais un réglage de soirée « Temps : normal ·
  +50 % · ×2 », appliqué par le serveur à tous — comme les *Extended Timers* de
  Jackbox —, garderait l'équité (M, à arbitrer : le chrono partagé est le jeu,
  et `LECTURE_MS` un barème). [A3]
- **Le système de design** est solide pour les couleurs (44 variables, toutes
  employées, aucun texte en `--accent`), absent pour le reste : 84 tailles de
  police, 38 pas d'espacement, 16 opacités du champagne, aucun jeton nommé.
  Gains rapides : `color-scheme` sur les deux thèmes (les contrôles natifs
  restent blancs sur le Velours), `--accent-text-hover` (le survol tombe à
  2,49:1 en Ivoire), six classes de CSS mort, et un test qui garde la règle
  des emojis (81 emojis, aucun au-delà d'Unicode 12 aujourd'hui). [S2 à S8]

### Et des finitions

| Quoi | Où | P · effort |
|---|---|---|
| Le circonflexe de « û » décalé dans les deux Cormorant livrés (les aigus, eux, penchent par dessin) — à comparer à la police d'origine avant de régénérer | capture `09` [salons-marc-lea 6, N4] | P3 · S |
| Au-delà de 8 invités, on ne se voit plus au classement du téléphone | [T4] | P2 · S |
| « Trop tard ! » pour qui n'a rien touché, et aucun état « envoi… » | [T5] | P2 · S |
| La réponse tapée hors ligne : bien renvoyée à la reconnexion, mais le téléphone ne dit jamais qu'elle est arrivée trop tard | [salon-nadia 9] | P3 · S |
| Le retardataire doit choisir une équipe pendant que la question court (Karim l'a rejointe à 6 s de la fin) | [salon-nadia 7] | P2 · S |
| En mode automatique, trois questions et un podium joués devant une salle vide (l'incident l'a montré) : se mettre en pause quand personne n'a répondu | idée de Nadia | P3 · S |
| La tablette est un téléphone étiré (une colonne de 560 px sur 1 280) ; le tableau des chiffres à 18 colonnes défile au téléphone | [T11, salons-marc-lea 14] | P3 · M |
| Les ex æquo d'un prix départagés au prénom, sans le dire | [salons-marc-lea 10] | P3 · S |
| La césure « a- / t-il » au mur ; « Passer à la question » qui devient « Revoir la photo » sous le curseur de l'aperçu | [salon-nadia 14] | P3 · S |

## Avant / après : la tablée du 23 rejouée

Chez Nadia, les mêmes huit personnages, la même soirée, après les sept PR de
la première tablée (#25 à #31) :

| Axe du 23 (PR) | Verdict du 24 |
|---|---|
| 1. Le lendemain contredit la soirée (#27) | **Corrigé** : la victoire, l'historique et le souvenir donnent le même verdict, prix compris, et « Remis ce soir-là » liste les prix remis. Mais la contradiction a glissé **dans** la soirée (axe 1). |
| 2. La console (#26) | **En partie** : des gestes sûrs, l'action principale à gauche, « Reposer » confirmé, l'enchaînement « au clic · 5 · 10 · 20 s » (Nadia : « le mode automatique m'a enfin permis de lâcher l'ordinateur »). Toujours : les coulisses à la télé, « qui n'a pas répondu », la remise des prix en scène (axe 5). |
| 3. L'écran commun en 1366 × 768 (#31) | **En partie** : la révélation d'un QCM, le podium, le QR de clôture, la console sur une ligne tiennent. Débordent encore : l'estimation à six réponses, la victoire, la remise des prix (axe 2). |
| 4. Les finitions du téléphone (#29) | **Corrigé**, avec deux effets de bord : « Camil… » sur la console, les équipes du souvenir au texte agrandi (axe 12). |
| 5. L'accessibilité (#30) | **Corrigé** (Hugo : « toi », « la bonne réponse », des titres partout). |
| 6. L'éditeur (#25) | **Corrigé** (Nadia : « rien eu à régler pour la dixième »), mais un bug ancien est apparu, révélé par un banc plus fidèle : « 2045 » (axe 3). |
| 7. Les mots (#28) | **Pour l'essentiel** ; reviennent le jargon des équipes, l'élision ailleurs, « Quizz » au manifeste — et la promesse « tu retrouves tes points », introduite par #28 lui-même (axe 11). |

Les notes des huit personnages (entrer · jouer · lire · revenir) : **4,5 · 3,9 ·
4,0 · 4,5**, contre 4,1 · 4,1 · 4,4 · 4,6 le 23. L'entrée gagne ; le jeu perd
un peu avec la coupure du banc et les incidents voulus de Karim ; la lecture
perd avec le souvenir au texte agrandi (Jeanne). Sur les dix-sept
personnages : 4,2 · 4,1 · 4,1 · 4,3.

## Ce qui plaît — à ne pas casser

- **Entrer sans compte** : trois touchers et un prénom. Bertrand, méfiant :
  « un soulagement » ; Liam, qui lit mal le français, est entré « aux icônes ».
- **Les homonymes** : « Camille (2) » partout, jamais écrit en base ; Inès, dans
  deux espaces le même soir, jamais marquée.
- **Rien ne repose sur la couleur seule** (Camille D.), et **rien ne bouge**
  avec « réduire les animations » (Zoé, migraineuse : « aucune gêne »).
- **La robustesse** : pas de double vote, le retour du navigateur gardé
  (« Quitter la soirée ? »), un deuxième onglet synchronisé (Lucas, qui a
  cherché la faille toute la soirée) ; les incidents dits aussitôt (Karim) ;
  les soirées reprises après un redémarrage.
- **« Coller une liste » et « Copier le format complet »** — « exactement
  l'outil dont j'avais besoin » (Marc), « LA fonction pour quelqu'un qui écrit
  ses questions dans ses notes » (Léa).
- **La console pendant un quiz**, au téléphone comme à l'ordinateur ; **la
  pause qui fige vraiment le chrono** (Bertrand : « pas de triche possible »).
- **La photo à mémoriser**, le meilleur moment des trois salons, et la seule
  question sans barrière de langue.
- **Les prix calculés** : drôles et bienveillants — « ça ne se moque pas de
  moi, ça sourit avec moi » (Maëlle) ; « L'Éclair : Jeanne » a été le meilleur
  moment de la soirée de Nadia.
- **Le profil** reconnu d'un animateur à l'autre sans rien retaper ; le code de
  secours qui a fait rentrer Malik en moins d'une minute ; la fin de soirée
  d'un profil (+404, niveau 1 → 3), le meilleur moment du parcours.
- **Le bilan**, lisible à l'oreille (Hugo), et **l'export d'un quiz** sans perte,
  en trois gestes.
- **Face aux concurrents** : aucun plafond de joueurs, des équipes et des
  estimations gratuites, la question lue sur le téléphone, un bilan public et
  imprimable pour chaque invité, une reprise après coupure que Kahoot n'offre
  pas, et un format de liste pour l'IA de son choix.
- **L'hygiène du code** : toutes les variables de couleur employées, 1 % de CSS
  mort, aucun emoji au-delà d'Unicode 12, et 70 tentatives de fuite sans une
  seule qui passe.

## Les tensions à arbitrer

Des constats qui heurtent un parti pris écrit : à trancher, pas à corriger
d'office.

1. **Des prix qui renversent la victoire** — voulu par le README (« Les
   équipes ») ; ce qui manque, c'est de le voir venir (axe 1).
2. **Le bilan de chacun, lisible par tous** — public par lien, selon le README ;
   Bertrand, méfiant, repart à 3/5 en envie de revenir. Un réglage d'espace
   « bilans personnels » ? [salons-marc-lea 12]
3. **Suggérer « chez-nadia » à qui tape « nadia »** — ce serait énumérer les
   espaces (invariant 3) : essayer `chez-‹saisie›`, jamais lister.
4. **Un temps prolongé** pour qui en a besoin — face au chrono partagé et à
   `LECTURE_MS`, un barème.
5. **Le prénom d'abord à l'entrée** (trois gestes au lieu de quatre, comme
   Kahoot) — face à « l'entrée est un écran de connexion, un choix assumé »
   (CLAUDE.md).
6. **La lecture à voix haute au téléphone** — face au son qui sort de l'écran
   commun (README).
7. **La console sur l'écran commun** (README, « Identité visuelle ») — la
   télécommande y répond sans rien retirer.
8. **Attendre un invité hors ligne** (`games/quiz.ts:318-331`) — protège d'un
   hoquet, pénalise une panne ; et rendre sa place sans jeton ne peut passer que
   par l'animateur (invariant 9).
9. **Une soirée venue sans jouer dans « Mes soirées »** — l'invariant 19
   l'accepte tant qu'elle ne rapporte rien.
10. **Réclamer sa soirée après la clôture** — rangé par le README dans « Les
    chemins ouverts », en tension avec le parti pris n° 1.
11. **Les ex æquo d'un prix départagés au prénom** (`server/src/core/stats.ts`,
    « pour que le prix ne change pas de mains ») — face à l'invariant 15, et
    le palmarès se range sur l'étagère des profils.
12. **« Écart estim. » et « Biais » en pour cent** au tableau des chiffres —
    face à la convention « une estimation se juge au coup d'œil ».
13. **« Retrouver ses points »**, les mots qui parlent à Jeanne — face à
    l'invariant 8.
14. **Supprimer un espace garde l'expérience de ses soirées** — face à
    l'invariant 10 : à arbitrer, puis à écrire.
15. **Une catégorie maison** (« Vie de l'agence », Marc) — face à la liste fixe
    des catégories, la même chez tous.

## Écarté : ce qui venait du banc

- **La coupure de l'outil** (15:26 → 15:52) : chez Nadia, les questions 8 à 10
  et le podium joués sans personne ; Hugo n'a pas joué la question visuelle,
  Karim n'a pas testé le rechargement.
- **« Le chrono du téléphone continue pendant la pause »** (Liam) : ses deux
  captures ont été prises après la reprise ; le téléphone fige bien son chrono
  et affiche « En pause ».
- **Les « icônes sans nom » et les « en-têtes en simples cases »** (Hugo) : le
  geste `voir` lit l'instantané de Playwright, qui liste des SVG `aria-hidden`
  et calcule `cell` pour un `<th>` ; Chrome n'expose aucune image et 19 vrais
  en-têtes de colonne. Corrigé dans la régie (plus bas).
- **« Trop tard » à la question 2 de Camille M.** : après la pause, le
  raccourci `question` attendait une question nouvelle. Corrigé dans la régie.
- **« Enregistrer ne confirme rien »** (Marc) : le message « Réglages
  enregistrés » existe, et dure quatre secondes ; Léa l'a lu.
- **La photo manquée de Bertrand, les questions perdues de Maëlle et de
  Karim** : le scénario et la lenteur de l'outil. « Revenir après être partie »
  (Maëlle) n'a pas été éprouvé : son téléphone est resté ouvert.
- **Le processeur de la régie et la durée des gestes** mesurent surtout
  Playwright : la régie porte à la fois le serveur de jeu et le pilote des
  navigateurs. La charge de la machine (jusqu'à 9,9 sur quatre cœurs) venait
  des navigateurs et des agents, pas du serveur ; et « les pages du lendemain
  sont lentes » vient du navigateur et du banc (un souvenir de 30 invités se
  sert en 11 à 13 ms).
- **Le processeur par question** d'un des experts était gonflé d'un facteur
  1,8 par sa propre sonde (un histogramme de retard à 1 ms) — vérifié avec et
  sans ; ses latences, elles, tiennent. La leçon vaut pour les mesures de
  production (axe 7).
- **Écartés par la vérification de performance** : un serveur « mort pendant
  une vague d'arrivées » (non reproduit : une collision de port) ; précharger
  la photo pendant l'observation (le téléphone l'affiche déjà, et l'envoyer
  plus tôt livrerait l'énoncé avant la question, invariant 1) ; la queue des
  inscriptions derrière le miroir, propre au miroir en fichier d'une
  installation chez soi.

## Ce que la tablée a appris sur elle-même

- **Plusieurs salons sur un serveur** : la régie tient maintenant plusieurs
  soirées à la fois (`--animateur` répétable, `chez ‹animateur›`), et n'a
  confondu aucun salon — un seul geste raté, « chez nadia » tapé d'un bloc.
- **Des experts à côté des personnages**, quinze dans leur propre session :
  chacun sur sa machine, donc des mesures de performance propres, et des
  rapports poussés sur la branche.
- **Deux plafonds de l'outil** :
  - vingt agents au plus en même temps par session — d'où les sessions cloud ;
  - **la réserve d'usage** : 35 agents en parallèle l'ont épuisée en vingt-cinq
    minutes, et tous se sont arrêtés d'un coup. La reprise : `SendMessage` pour
    les agents locaux, qui gardent leur mémoire de la soirée, et une routine
    ponctuelle attachée à chaque session cloud. Pour la prochaine grande
    tablée : échelonner les vagues, garder un modèle rapide pour les invités,
    et prévoir la réserve.
- **Corrigé dans la régie** : `question` rend une question rouverte après une
  pause ; le nouveau geste `lecteur` lit l'arbre d'accessibilité tel que Chrome
  l'expose — l'invité au lecteur d'écran juge par lui, et n'agit que par
  `voir`.
- **À corriger ensuite** : démarrer le serveur de jeu dans un processus enfant
  de la régie, pour que son processeur se mesure à part, et relever la durée
  des gestes par type.

## Qui était là

### Les trois salons

| Personnage | L'angle | Appareil | Sa soirée | Entrer · Jouer · Lire · Revenir |
|---|---|---|---|---|
| **Nadia**, 38 ans | anime pour la première fois (rejoue le 23) | portable 1366 × 768 | 10 questions (8 collées) en 4 min 38 s, 3 équipes, enchaînement à 10 s, 4 prix | 5 · 4 · 4 · 5 |
| **Jeanne**, 71 ans | grand-mère, texte à 130 % | petit Android 360 × 640 | 4ᵉ, 922 pts, L'Éclair | 5 · 4 · 3 · 4 |
| **Lucas**, 16 ans | cherche la faille | iPhone | 3ᵉ, 965 pts, Le Doigt qui Tremble | 5 · 4 · 5 · 4 |
| **Sofia**, 34 ans | veut son profil et sa progression | Android | 1ʳᵉ, 1 146 pts, +58 XP | 5 · 5 · 4 · 5 |
| **Karim**, 29 ans | en retard, veille, réseau capricieux | Android | 7ᵉ, 195 pts, Le Somnambule | 3 · 2 · 5 · 4 |
| **Camille M.**, 27 ans | sans le QR, par l'accueil | Android | 6ᵉ, 859 pts, 5 réponses, toutes justes | 3 · 4 · 4 · 5 |
| **Camille D.**, 45 ans | profil, homonyme, daltonienne | Android, vision deutéranope | 2ᵉ, 1 098 pts, « Camille (2) » | 5 · 4 · 4 · 5 |
| **Hugo**, 30 ans | aveugle, lecteur d'écran | Android, à l'oreille | 5ᵉ, 905 pts | 5 · 4 · 3 · 4 |
| **Marc**, 45 ans | fait écrire son quiz par une IA | écran 1920 × 1080 | quiz jouable 5 min après l'activation, 3 équipes, 4 prix dont un libre, export et réimport | 5 · 4 · 4 · 4 |
| **Bertrand**, 58 ans | méfiant, sans compte | tablette 800 × 1280, puis en paysage | 2ᵉ, 995 pts | 5 · 4 · 5 · 3 |
| **Rachid**, 35 ans | son téléphone meurt après la Q3 | téléphone, puis un emprunté | 3ᵉ, 491 pts — et 186 restés sur l'autre « Rachid » | 3 · 4 · 4 · 4 |
| **Maëlle**, 24 ans | au fond, sans le QR, sous pseudo | iPhone | « Fantomette », 4ᵉ, 292 pts | 2 · 3 · 4 · 4 |
| **Inès**, 26 ans | passe d'une fête à l'autre, avec son profil | téléphone | 1ʳᵉ chez Marc (1 355 pts, niveau 2), arrivée chez Léa après le quiz | 5 · 4 · 5 · 4 |
| **Léa**, 22 ans | anime sans ordinateur | téléphone + la télé de la coloc | 9 questions collées au téléphone, 2 équipes, 2 prix | 3 · 4 · 4 · 4 |
| **Liam**, 23 ans | Erasmus, français débutant | iPhone | 1ᵉʳ, 1 280 pts | 5 · 5 · 3 · 4 |
| **Zoé**, 23 ans | « réduire les animations », téléphone couché | téléphone, puis en paysage | 2ᵉ, 1 273 pts | 4 · 5 · 4 · 5 |
| **Malik**, 23 ans | mot de passe oublié | téléphone | 3ᵉ, 938 pts, Le Cancre Magnifique | 4 · 5 · 4 · 5 |

### Les experts

| Mission | Où | Son verdict en une ligne |
|---|---|---|
| [parcours-animateur](experts/parcours-animateur.md) | ici | la soirée tient ; le liant manque avant et surtout après |
| [parcours-invite](experts/parcours-invite.md) | ici | court et solide pendant la soirée, tout se défait après la clôture |
| [parcours-profil](experts/parcours-profil.md) | ici | le profil relie vraiment deux animateurs ; le fil casse après la soirée |
| [carte-du-site](experts/carte-du-site.md) | cloud | un îlot de pages publiques bien relié, des trous aux jointures entre rôles et moments |
| [admin-animateurs](experts/admin-animateurs.md) | cloud | 16 tentatives de fuite, aucune ; le formulaire de création d'un compte coince |
| [premiere-visite](experts/premiere-visite.md) | cloud | clair par le QR ; l'accueil et les liens partagés partent de zéro |
| [editeur](experts/editeur.md) | cloud | la liste collée est la bonne voie ; le champ Temps et la liste bavarde piègent |
| [design-tele](experts/design-tele.md) | cloud | beau en 1366 dans le cas courant ; l'écran ne grandit pas avec l'écran |
| [design-telephone](experts/design-telephone.md) | cloud | beau et cohérent ; les réponses longues, le texte agrandi, le podium inversé |
| [design-systeme](experts/design-systeme.md) | cloud | un vrai système de couleurs, aucun jeton pour le reste |
| [mots](experts/mots.md) | cloud | bien écrit en jeu ; le jargon des récompenses et quatre explications des équipes |
| [accessibilite](experts/accessibilite.md) | cloud | jouable au clavier et à l'oreille, des deux côtés ; état, focus et temps à reprendre |
| [benchmark](experts/benchmark.md) | cloud | mieux que tous sur la soirée entre amis ; plus de pas à l'entrée et au premier quiz |
| [robustesse-espaces](experts/robustesse-espaces.md) | cloud | 26 tentatives de fuite, aucune ; trois failles là où les espaces partagent |
| [perf-serveur](experts/perf-serveur.md) | cloud | sain jusqu'à 150 invités ; trois coûts qui grandissent plus vite que la salle |
| [perf-temps-reel](experts/perf-temps-reel.md) | cloud | 500 invités et cinq soirées sans broncher sur quatre cœurs ; casse entre 150 et 300 au dixième de cœur |
| [perf-chargement](experts/perf-chargement.md) | cloud | 2,2 s jusqu'à l'entrée en 4G moyenne ; tout se joue sur les octets |
| [perf-rendu](experts/perf-rendu.md) | cloud | fluide et sans fuite ; les légendaires animés et le chrono coûtent trop |
| [perf-observateur](experts/perf-observateur.md) | ici | le serveur n'a jamais été le goulot des trois soirées ; `/healthz` ne le dirait pas en production |

## Les rapports

- **Les vérifications**, par groupe : [le salon de Nadia et l'avant/après](verification/salon-nadia.md),
  [les salons de Marc et de Léa](verification/salons-marc-lea.md),
  [les parcours et le liant](verification/parcours.md),
  [le design, les mots et l'accessibilité](verification/design.md),
  [la performance et la robustesse](verification/perf.md).
- **Les retours des personnages** : [Nadia](nadia.md), [Jeanne](jeanne.md),
  [Lucas](lucas.md), [Sofia](sofia.md), [Karim](karim.md),
  [Camille M.](camille-m.md), [Camille D.](camille-d.md), [Hugo](hugo.md) ·
  [Marc](marc.md), [Bertrand](bertrand.md), [Rachid](rachid.md),
  [Maëlle](maelle.md), [Inès](ines.md) · [Léa](lea.md), [Liam](liam.md),
  [Zoé](zoe.md), [Malik](malik.md).
- **Les rapports des experts** : `experts/` (le tableau ci-dessus), avec leurs
  captures et leurs scripts de reproduction.
- **Les captures choisies** : `captures/01` à `09`.
