# Le QG 2 : une salle de contrôle (proposition)

Le 3 novembre 2026, le propriétaire :

> « J'aimerais que l'on fasse une refonte un peu du QG pour que ça soit encore
> plus high-tech et clair et que je puisse avoir des métriques sur tout et
> pouvoir monitorer tout ce que je souhaite. J'aimerais aussi avoir des
> dashboards ultra stylés, le design est important. »
>
> « J'ai pas aussi de page dédiée au Cabinet. »
>
> « Aujourd'hui je trouve par exemple la page serveur pas pratique, je ne peux
> pas trier, voir sur une durée précise, en temps réel, etc. Les modes aussi
> restent très sommaires et pas forcément très pratiques. »
>
> « Fais-moi une proposition d'un QG ultra high-tech capable de monitorer
> l'entièreté de l'app, n'hésite pas à rajouter des choses que je n'ai pas
> dedans et qui te semblent importantes à avoir. »

Ce document est la proposition : ce qui ne va pas dans le QG d'aujourd'hui,
les principes du QG 2, sa carte page par page, ce que le serveur doit mesurer
de plus et ce que ça coûte, le plan lot par lot, et les décisions qui
attendent le propriétaire. **Aucune ligne de code de l'application n'a
changé** : tout vit dans la maquette navigable (`maquette-qg/`, publiée en
artefact), sur des chiffres inventés à l'échelle de la production.

## Ce qui ne va pas aujourd'hui

Le QG du 3 novembre, photographié par `server/scripts/rendu-qg.ts` en
1366 × 768 et en 1920 × 1080 :

1. **Le temps est figé, page par page.** La vue d'ensemble montre trente
   jours et « aujourd'hui à la même heure », le serveur sept jours heure par
   heure (huit gardés, `JOURS_DE_SANTE`), les modes trente jours, les soirées
   quatre-vingt-dix. Aucune page ne laisse choisir : « hier soir entre 21 h et
   23 h », « la dernière heure », « depuis la mise en ligne » ne se regardent
   nulle part.
2. **Pas de direct.** Le serveur mesure à la seconde — la charge toutes les
   dix secondes (`Charge`), chaque route et chaque aller-retour vers Turso sur
   la dernière minute (`Pouls.lireRoutes`, `Fenetre`) — mais la page n'en
   montre que des heures. Le direct de la vue d'ensemble (`/qg/direct`, relu
   toutes les dix secondes) ne dit que les soirées, les profils en ligne et le
   miroir.
3. **Rien ne se trie.** Le relevé de chaque heure mesure chaque route
   (`Heure.parRoute`, `core/pouls.ts`), mais `qg_sante` n'en garde que les
   trois plus lentes (`lentes`), et la page la plus lente de la semaine en
   tuile : pas une table des routes, de leurs appels, de leurs erreurs, de
   leur part du temps du serveur.
4. **Des pages en rouleau.** « Le serveur » fait 6 000 pixels de haut, quinze
   graphiques à la suite ; « La campagne », 4 300. La colonne de la page
   s'arrête vers 1 000 pixels : en 1920, près de la moitié de l'écran reste
   vide pendant qu'on fait défiler.
5. **Une couleur, un pas, aucun contexte.** Chaque graphique est une barre or
   par heure : ni la médiane à côté du 95ᵉ centile, ni la semaine d'avant en
   regard, ni la mise en ligne qui a fait monter la courbe.
6. **Les modes, chacun à sa façon.** Quatre pages, quatre mises en page.
   Aucune ne dit qui revient, à quelle marche on abandonne, ni ce que donne
   chaque question ou chaque jeu — sauf la campagne, pour ses paliers et ses
   questions contredites.
7. **Le Cabinet n'a pas de page.** Ouvert à tous le 31 octobre, il n'existe au
   QG que comme un sous-mode de la campagne et la couleur violette de
   l'activité (le 2 novembre 2026).
8. **Des angles morts.** L'audience (combien reviennent, les cohortes, qui
   décroche, d'où viennent les profils), le contenu (la vraie difficulté de
   chaque question, tous modes confondus), le temps réel (les messages des
   sockets, leurs accusés), les versions (ce qu'une mise en ligne a changé),
   ce que vivent les téléphones, les sauvegardes, des alertes qu'on règle et
   l'histoire des incidents.

## Les principes

1. **Une barre de commande règle le temps de toute la page** : Direct · 1 h ·
   24 h · 7 j · 30 j · 90 j, et « Perso » — on glisse sur n'importe quel
   graphique du temps pour zoomer, et toute la page suit (tuiles, graphiques,
   tableaux). Le pas suit la période : dix secondes en direct, la minute sur
   une heure, cinq minutes sur un jour, l'heure sur une semaine, six heures
   ou le jour au-delà. « Comparer » pose la période d'avant en filet sur
   chaque courbe et dit l'écart sur chaque tuile.
2. **Le résumé d'abord, le détail au toucher.** Des tuiles — un chiffre, son
   écart, sa courbe —, puis les graphiques, puis les tableaux ; une ligne
   ouvre un tiroir (une route, une question, une erreur, un joueur) sans
   quitter la page.
3. **Tout tableau se trie** sur chacune de ses colonnes, se filtre, et se
   copie en CSV.
4. **Deux gabarits pour toutes les pages** : celui d'un mode (Tableau de bord
   · ce qui lui est propre · Joueurs · Gestes) et celui d'une page technique
   (les signaux, puis les tables). On apprend une page, on sait lire les
   autres.
5. **L'état se lit à sa forme** : un voyant, une pastille avec un mot, une
   bande de gravité — jamais la couleur seule. Ce qui ne va pas passe en tête.
6. **Les événements se posent sur les courbes** : une mise en ligne (▲), un
   arrêt net (✕), un redémarrage (○), un incident (une bande rouge sur sa
   durée), une ouverture, une affiche, une annonce (◆). On voit ce qui a fait
   bouger la courbe sans aller le chercher.
7. **Le QG ne coûte presque rien** : le direct ne lit que la mémoire ; ce qui
   est fini se lit une fois et se garde ; seul le présent se relit ; chaque
   table neuve est bornée (plus bas, « Ce que le serveur doit mesurer de
   plus »).
8. **Les règles du QG tiennent** : des soirées des autres, rien que des
   chiffres — ni quiz, ni question, ni prénom d'invité, ni titre — ; rien des
   Divins ; les barèmes restent dans le code ; chaque geste au journal.

## La carte du QG 2

Six groupes, vingt-cinq pages — dix-sept aujourd'hui. Chacune répond à une
question ; le rail les range par sujet, et la palette (⌘K, ou « / ») va à
n'importe laquelle, à un profil, une route ou une question.

| Groupe | Page | Ce qu'elle dit | |
|---|---|---|---|
| Commande | **Poste de commande** | L'état du service en voyants, six tuiles, la participation, ce qui attend un geste, qui joue à la minute, le fil des événements | refaite |
| | **En direct** | La seconde : en ligne, requêtes, ressenti, erreurs, charge ; qui est en partie, mode par mode ; le fil de ce qui arrive ; les soirées en cours | nouvelle |
| | **Alertes et incidents** | Les règles, leurs seuils, où elles sonnent ; l'histoire des incidents ; les téléphones prévenus | nouvelle |
| | Journal | Les gestes, et désormais les événements du serveur au même fil | reprise |
| Audience | **Joueurs** | Du jour, de la semaine, du mois ; les cohortes ; les segments ; quand on joue ; qui joue à quoi ; d'où viennent les profils | nouvelle |
| | Profils | La recherche et la fiche, triables et filtrées (actifs, endormis, hors classement, suspendus, testeurs) | reprise |
| | Salons | Chaque salon et ses chiffres | reprise |
| | Économie | Gagnés et dépensés sur la période, les sources, les dépenses | refaite |
| Modes | Côte à côte | L'ancienne activité : la quantité, la réussite, la durée d'une partie, le retour à J+7, mode par mode | refaite |
| | Soirées · Quiz du jour · Campagne · Duels | Le gabarit commun, plus ce qui est à chacun | refaites |
| | **Cabinet** | Les traversées, les dix jeux, les dix cartes, les gardiens, le contenu, les joueurs | nouvelle |
| Contenu | **Questions** | Toutes les questions jouées, tous modes, triables : bonnes, temps, marche annoncée et observée, signalements | nouvelle |
| | Signalements | Tels quels, le Cabinet en plus | reprise |
| | **Réserves et base** | La réserve du quiz du jour, la base de la campagne par catégorie et par marche, le contenu du Cabinet | nouvelle |
| | Catalogue | Tel quel, et ce que chaque modèle est devenu | reprise |
| Technique | **Serveur** | Signaux · Routes · Temps réel · Ce qui gèle · Versions | refaite |
| | **Base et miroir** | Turso, le quota du mois, ce qui lit le plus, le miroir de chaque salon, les sauvegardes | nouvelle |
| | Erreurs | Le tri, sur la période choisie | reprise |
| | **Téléphones** | Ce que vivent les joueurs : temps d'affichage, réponse au doigt, ce qui saute, le client qui plante | option |
| Animer | Annonces · Nouveautés · Maintenance | Tels quels, et ce qu'ils ont fait | reprises |

Et deux outils : la **palette** de commandes, et le **mur de contrôle** — un
écran qu'on laisse allumé, sans rail ni barre, où le poste, le direct, le
serveur, le Cabinet et les joueurs tournent toutes les vingt secondes.

Si vingt-cinq pages font trop, trois fusions ne perdent rien : les téléphones
dans le serveur, les réserves dans les questions, la base dans le serveur.

## Page par page

Chaque console de la maquette dit d'où viennent ses chiffres (« Montrer d'où
viennent les chiffres », dans le bandeau) : **déjà mesuré** — le serveur le
garde aujourd'hui —, **à calculer** — les journaux l'ont, la page doit le
dériver —, **nouveau relevé** — il faut le mesurer.

### Le poste de commande

- L'**état du service** en huit voyants — ce qu'un joueur attend, le temps
  réel, Turso, le miroir, le quota, la mémoire, les erreurs, la version en
  ligne —, ce qui ne va pas en tête, et une ligne pour les cinq modes de jeu
  (la veille de `core/veille.ts`).
- **Six tuiles** sur la période : joueurs (des personnes : une fois chacun),
  parties, questions jouées, nouveaux profils, confettis gagnés, ressenti au
  95ᵉ centile — chacune son écart à la période d'avant et sa courbe.
- La **participation** — « Joueurs » d'office, « Participations » d'un
  toucher (le choix du 2 novembre 2026) — sur la période, ses événements
  posés dessus.
- **À traiter**, une bande de gravité par ligne ; **en ce moment**, qui joue
  mode par mode ; la **santé** des dernières 24 heures ; le **fil** des
  événements.

### En direct

- Huit compteurs relus toutes les deux secondes, en mémoire seulement : en
  ligne, requêtes de la dernière minute, ressenti, erreurs des cinq
  dernières minutes, processeur (sur les 10 % de l'hébergeur), mémoire (sur
  512 Mo), pire gel, Turso.
- Qui est en partie, mode par mode, et ses quinze dernières minutes.
- Quatre graphiques au pas de dix secondes qui défilent.
- Le **fil** de ce qui arrive, filtré (parties, soirées, erreurs), qu'on
  met en pause. Des soirées, rien que des chiffres : « Salon de Karim ·
  question 12 révélée · 11 invités ».
- Les soirées en cours et laissées en plan, chacune où elle en est.

### Le serveur

- **Les signaux** : quatre tuiles — la latence (le 95ᵉ centile et la
  médiane), le trafic, les erreurs, la saturation —, puis le grand graphique
  du ressenti en **bande** médiane–95ᵉ centile, et six petits graphiques qui
  partagent leur viseur (requêtes, erreurs, processeur et son plafond,
  mémoire et la sienne, gel de la boucle, Turso). On glisse sur n'importe
  lequel pour zoomer : toute la page suit. Puis les événements de la période.
- **Les routes** : la table de toutes les routes sous leur modèle — appels,
  par heure éveillée, médiane, 95ᵉ centile, pire, 5xx, 4xx, la part du temps
  du serveur, l'écart à la période d'avant, sa courbe —, triée par le temps
  qu'elle prend au serveur (ses appels fois son temps : ce qui mérite d'être
  optimisé d'abord), filtrée par famille, par lenteur, par un mot. Une ligne
  ouvre son tiroir : son temps sur la période, ses appels, ses statuts, ses
  versions, ses erreurs.
- **Le temps réel** : les clients des sockets, les messages reçus, le temps
  de traitement jusqu'à l'accusé, les « trop tard », le retard des
  chronomètres, les reconnexions — et chaque message (`player:action`,
  `host:next`…) en table.
- **Ce qui gèle** : la page d'aujourd'hui (`CeQuiGele`), en table triable et
  sur la période choisie.
- **Les versions** : chaque mise en ligne comparée à la précédente — le
  ressenti, les erreurs pour mille requêtes, le processeur, la mémoire —, et
  la route qui ralentit de plus d'un tiers, signalée d'elle-même. Dans la
  maquette : `a41c9e2` et `POST /api/cabinet/traversee/:id/geste`, 312 → 524
  ms.

### La base et le miroir

Sortie du serveur, où elle se perdait : Turso (un aller-retour, les
connexions neuves), **le quota du mois** en deux jauges — lu, écrit — et la
part de chacun (ce serveur, la préproduction, les sauvegardes), les lignes
lues sur la période, **ce qui lit le plus** en table (la page d'aujourd'hui,
`LeQuotaDeTurso`), le **miroir** de chaque salon (sa file, ses échecs, son
dernier envoi), et **les sauvegardes** — aujourd'hui `npm run sauvegarde` se
lance à la main, et rien ne dit à quand remonte la dernière.

### Les alertes et les incidents

Les six alertes d'aujourd'hui (la panne d'un mode, l'arrêt net, les erreurs
à regarder, Turso lent, la mémoire, le quota) et huit proposées : le
ressenti dégradé (p95 > 800 ms dix minutes), le taux d'erreur (> 1 % sur un
quart d'heure), un gel de plus de trois secondes, le **miroir en retard** (une
soirée qui ne se sauvegarde plus), la réserve du quiz du jour sous trois
jours, le **silence anormal** (aucune partie de 19 h à 22 h : la panne
qu'aucune erreur ne dit), le rappel du soir en échec, et la **version qui
ralentit**. Chaque règle : son seuil, réglable — un réglage d'exploitation,
pas un barème du jeu —, sa gravité, où elle sonne (le QG, et le téléphone
pour celles qu'on choisit). Puis **les incidents** : chacun sa règle, son
début, sa fin, sa cause et un mot, sur une frise de trois semaines — le
retour à la normale, la disponibilité des modes.

### Les joueurs

- Du jour, des sept jours, des trente jours, et leur rapport (la fidélité) ;
  les nouveaux profils ; les invités sans profil.
- **Les cohortes** : chaque semaine d'inscription, la part revenue une, deux…
  huit semaines plus tard.
- **Les segments** : nouveaux, réguliers, occasionnels, à risque, endormis —
  et « Écrire aux endormis » (voir les décisions).
- Quand on joue (le jour de la semaine × l'heure), qui joue à quoi (les
  combinaisons de modes), **d'où viennent les profils** (l'écran où ils sont
  nés : la maquette en prête six sur dix à la soirée), et la table des
  profils, triable, qui ouvre la fiche.

Les profils seulement : un invité sans profil ne se suit pas d'un soir à
l'autre, et ne se nomme nulle part.

### Le gabarit d'un mode

Chaque mode : ses tuiles (joueurs, parties, puis les siennes), sa courbe sur
la période, **en ce moment** (ce qui s'y joue à la minute), **son entonnoir**
(où l'on décroche), et ce qui lui est propre :

- **Soirées** : de la salle d'attente à la clôture, quand on joue, la taille
  des salles, leur durée, en équipes ou non, l'origine des quiz lancés (les
  siens, un quiz tout prêt, un modèle du catalogue — jamais lesquels),
  l'historique, « Clore » une soirée en plan.
- **Quiz du jour** : de l'accueil au lendemain, les scores, le tirage
  question par question (la question piège en tête), le classement et son
  « Masquer », les séries, **le rappel du soir** — envoyés, échoués, et ce
  qui manque : ouverts, joués dans l'heure.
- **Campagne** : ce qu'on joue sous-mode par sous-mode, **les sentiers
  palier par palier** en carte de chaleur (douze sentiers × douze paliers, la
  chance d'un essai, « Régler le mélange »), l'épreuve en entonnoir, les
  vies, le défi de la semaine.
- **Duels** : contre Automate et contre un joueur, de l'envoi au verdict,
  les ligues, la cote, ceux qui attendent et « Annuler », le classement.

### Le Cabinet de curiosités

La page qui manquait :

- **Tableau de bord** : joueurs, traversées commencées, gagnées, abandonnées,
  la durée d'une traversée, les épreuves jouées ; les traversées jour par
  jour par issue (l'ouverture du 31 octobre et l'affiche du 1er novembre
  posées dessus) ; les traversées en route ; **du départ au légendaire** en
  entonnoir (trois cartes choisies, acte I, acte II, acte III, le légendaire)
  ; **où l'on tombe**, acte par acte.
- **Les dix jeux** : leur réussite, leurs étoiles, la durée d'une manche,
  « Quitter ? », Éclairer, les signalements — de quoi voir qu'un jeu est
  trop dur (le Filet, dans la maquette).
- **Cartes et gardiens** : les dix cartes en nuage — choisie, et la part
  gagnée quand on l'a —, le légendaire choisi au bout, et chaque gardien acte
  par acte : vaincu, maîtrisé.
- **Le contenu** : les lieux de l'Épingle qu'on place le plus mal, les
  fiches des Indices les moins trouvées, les répliques qu'on ne retrouve pas,
  les thèmes du Quiz.
- **Les joueurs** (traversées, gagnées, défis tenus, les rangs des défis des
  cartes) et **les gestes** : la maintenance, les testeurs, l'affiche, et un
  geste proposé — « Rendre une traversée bloquée », le pendant de « Libérer
  une épreuve » des sentiers.

La campagne garde le Cabinet parmi ses sous-modes, comme aujourd'hui : ses
parties y comptent toujours.

### Les questions

Toutes les questions jouées, de tous les modes, au même endroit : où, la
catégorie, la marche annoncée et celle que disent les réponses, les réponses,
la part de bonnes, le temps, les signalements, la dernière fois posée — triées
sur n'importe quelle colonne, filtrées (contredites, pièges, signalées).
Une ligne ouvre ce que chaque réponse a recueilli et les gestes des
signalements (corriger, reclasser, retirer, annuler ses points).

### Les réserves et la base

La réserve du quiz du jour (ses jours d'avance, ce que la routine du matin a
ajouté chaque jour), la base de la campagne en carte de chaleur — douze
catégories × quatre marches : là où une case pâlit, les sentiers et le Quiz du
Cabinet tirent toujours les mêmes —, et le contenu neuf du Cabinet.

### Les téléphones (option)

Ce que vivent les joueurs, mesuré dans la page et agrégé au serveur : le temps
qu'une page met à paraître (LCP), à répondre au doigt (INP), ce qui saute
(CLS), les erreurs du client, page par page — sans un nom ni une adresse. Le
19 octobre 2026, « le client qui plante » n'avait pas été retenu pour faire
sonner le téléphone ; ici, il se lit seulement. `npm run mesure` dit ce
qu'une page coûte au banc ; seuls les vrais téléphones disent ce qu'elle
coûte dans le noir d'un salon.

## Ce que le serveur doit mesurer de plus

| Quoi | Où ça vit | Ce que ça coûte | Pour |
|---|---|---|---|
| **Le flux du direct** : la charge au pas de dix secondes sur quinze minutes, les routes, Turso, les erreurs et les parties en cours à la minute depuis le démarrage (24 h au plus) | En mémoire, des anneaux bornés dans le relevé (`core/pouls.ts`) ; `GET /api/admin/flux` (`text/event-stream`), un envoi toutes les deux secondes tant qu'un onglet du QG est visible | Rien à Turso ; quelques centaines de kilo-octets de mémoire ; un message de quelques kilo-octets toutes les deux secondes | En direct, la période « Direct » partout |
| **Les tranches de cinq minutes** | `qg_sante_tranches` : ce que garde `qg_sante`, au pas de cinq minutes, huit jours | 288 lignes écrites par jour (≈ 0,1 % du quota d'écriture du mois) ; une vue de 24 h en lit 288 au plus, les tranches finies gardées en mémoire | 1 h, 24 h, le zoom |
| **Chaque route, chaque heure** : appels, médiane, 95ᵉ centile, pire, 4xx, 5xx, temps cumulé | Une colonne JSON de `qg_sante`, nourrie par `Heure.parRoute` qui les mesure déjà | Pas une ligne de plus : quelques kilo-octets par ligne (120 routes au plus, `ROUTES_SUIVIES`) | Les routes, les versions |
| **La mémoire longue** : les chiffres de chaque jour, figés à minuit | `qg_jours`, une ligne par jour, gardée un an | Une écriture par jour ; 90 jours se lisent en 90 lignes | 30 j, 90 j, les tendances |
| **La feuille de présence** : qui a joué quel jour, à quels modes | `qg_presences`, une ligne par profil et par jour, écrite une fois pour la veille ; une dérivation des journaux, recalculable | Une centaine de lignes par jour ; les cohortes en lisent quelques milliers une fois par jour | Les joueurs, les segments, le retour à J+7 des modes |
| **Le résumé d'une traversée** : l'acte atteint, les gardiens vaincus, les cartes, l'or, les cœurs, la durée, l'issue | Une colonne de `cabinet_traversees`, écrite dans le lot qui la finit — un reflet, comme `cabinet_profils` ; le pli reste la vérité | Rien de plus à l'écriture ; la page lit une ligne par traversée, jamais ses gestes | Le Cabinet |
| **L'origine d'un profil** | Une colonne de `profiles`, posée à sa création | Rien | Les joueurs |
| **Le rappel ouvert** | Le service worker note le toucher (`notificationclick`) | Une écriture par ouverture | Le quiz du jour |
| **Chaque message du temps réel** : combien, son temps jusqu'à l'accusé, ses refus | Le relevé, par nom d'événement, comme les routes — tout passe déjà par `ecouter()` | Rien à Turso | Le temps réel |
| **Les règles et les incidents** | `qg_reglages` (seuils, canaux) et `qg_incidents` (ouverture, fermeture, cause, un mot) | Quelques lignes | Les alertes |
| **Les sauvegardes** | `npm run sauvegarde` écrit une ligne dans `qg_sauvegardes` | Une ligne par sauvegarde | La base, une alerte au-delà de sept jours |
| **Les téléphones** (option) | `POST /api/mesures` (`sendBeacon`), un téléphone sur quatre, agrégé à l'heure dans le relevé | Aucune écriture par visite ; une ligne d'heure | Les téléphones |

Trois règles, celles du QG d'aujourd'hui : **ce qui est fini se lit une fois
et se garde** (comme `lesTrenteJours`) ; **seul le présent se relit**, par ses
index ; **rien de public ne change** — `/healthz` reste ce qu'il est, le flux
vit derrière la porte de l'administrateur, et tout reste agrégé, sans un nom.

## Le design

- **Une salle de contrôle nocturne** : le monde de l'écran du QG d'aujourd'hui
  (`.qg-ecran`), étendu à tout le QG — un fond presque noir, des consoles qui
  s'en détachent d'un filet, une grille qui s'efface vers le bas, des coins
  de visée sur ce qui vit en direct.
- **L'or du Velours, seul accent** : la sélection, le focus, une série seule.
  **Les cinq couleurs des modes ne changent pas** : revérifiées sur le
  nouveau fond des consoles (`#0d121b`) par le validateur de la skill
  `dataviz` — aux
  trois daltonismes, l'écart le plus serré reste soirées–campagne (ΔE 8,4),
  à vue normale 19,8, chacune au-dessus de 3:1. Les états (bon, à surveiller,
  sérieux, critique) portent toujours une icône et un mot.
- **Trois voix** : Figtree, celle de l'application ; JetBrains Mono pour les
  chiffres des tableaux, les routes, les heures ; et le Cormorant en italique
  pour le seul titre de chaque page.
- **Toute la largeur** jusqu'à 1 720 pixels, une grille de douze colonnes qui
  se replie selon la place (des requêtes de conteneur) ; au téléphone, le rail
  devient un tiroir et la barre des périodes défile.
- **Des graphes en SVG écrit à la main**, sans dépendance, comme aujourd'hui :
  le kit de la maquette (`graphes.js` — la bande des centiles, le viseur
  partagé, le zoom au doigt, les événements, la carte de chaleur, le nuage)
  en est la preuve. Chaque graphique se lit aussi au clavier (← →).
- Le mouvement se tient au direct : le pouls, les compteurs, la ligne neuve du
  fil ; rien sous « moins de mouvement ».

## Le plan, lot par lot

Chaque lot arrive avec ses tests (`server/test/`) et `rendu-qg.ts` qui le
photographie ; une PR par lot.

1. **La coque** — la barre de commande (périodes, comparer, zoom), le rail en
   six groupes, le tiroir, les tableaux triables, la palette, le kit de
   graphes ; le poste de commande redessiné.
2. **Le serveur** — chaque route chaque heure, les tranches de cinq minutes ;
   les onglets Signaux, Routes, Ce qui gèle, Versions ; la base et le miroir.
3. **Le direct** — le flux, la page En direct, « Direct » dans la barre.
4. **Le Cabinet** — le résumé des traversées, sa page.
5. **Les modes** — le gabarit, les quatre pages d'aujourd'hui reversées
   dedans, côte à côte.
6. **L'audience** — la mémoire longue, la feuille de présence, la page des
   joueurs, l'origine des profils.
7. **Le contenu** — les questions, les réserves et la base.
8. **Les alertes** — les seuils réglables, les incidents, les règles
   retenues ; le temps réel du serveur.
9. **Les téléphones**, si retenus.

## Les décisions à prendre

1. **Le QG tout entier nocturne** (recommandé) — ou le cadre au thème du
   profil, les graphiques seuls dans l'écran nocturne, comme aujourd'hui ?
2. **La période à l'ouverture** : 24 heures au poste de commande, puis la
   dernière choisie (recommandé) — ou toujours sept jours ?
3. **Le direct par un flux** (`text/event-stream`, recommandé : une
   connexion, rien quand l'onglet est caché) — ou une relecture toutes les
   deux secondes ?
4. **Les alertes** : les seuils réglables depuis le QG ? Lesquelles des huit
   règles proposées, et lesquelles sonnent sur le téléphone — aujourd'hui la
   panne d'un mode seule (le 19 octobre 2026) ; la maquette y ajoute le taux
   d'erreur et le miroir en retard.
5. **Les téléphones des joueurs** : les mesurer, ou non ?
6. **« Rendre une traversée bloquée »** au Cabinet : un geste de plus ?
7. **Écrire à un segment** (les endormis, les nouveaux) depuis les annonces :
   aujourd'hui une annonce va à tous les profils.
8. **Combien garder** : les tranches de cinq minutes huit jours, les heures
   trente-cinq jours (huit aujourd'hui), les jours un an ?
9. **Le mur de contrôle** : utile, sur un écran à part ?
10. **Vingt-cinq pages**, ou les trois fusions (téléphones et base dans le
    serveur, réserves dans les questions) ?
