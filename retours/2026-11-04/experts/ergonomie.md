# Le QG est-il ergonomique et pratique, à l'ordinateur et au téléphone ? — revue d'un expert des consoles de supervision

Le 4 novembre 2026, sur pièces : les 115 photos de `export/qg-revue/` (faites entre 1 h 47 et 1 h 50, sur des données
inventées), la proposition `retours/2026-11-03/le-qg.md` et sa maquette, le guide `docs/guides/administrer.md`, et le
code de la coque là où une photo ne suffisait pas. Ne sont pas jugés : le lot 5 (« Côte à côte » et le gabarit des
modes), fusionné pendant cette revue (`5122ae1`) sans photo, le contenu (« Questions », « Réserves et base »), et les
pages sans photo (Maintenance, Nouveautés, Salons, Catalogue). Le code bougeait pendant la revue (le lot 5 fusionné, le
contenu en chantier) : il est cité par ses noms, jamais par ses lignes, et ce qui est jugé, c'est ce que montrent les
photos. Les positions sont en pixels de page : une photo de téléphone est à la densité 2 (1 px de page = 2 px d'image).

## 1. Le verdict en cinq lignes

1. **Le socle est bon** : une nuit lisible, des états dits par une forme et un mot, des gestes confirmés qui disent leur portée et leur issue, des graphiques qu'on lit au clavier — au niveau des bonnes consoles du genre.
2. **Mais il n'oriente pas** : la barre dit « 1 à regarder » (le processeur, en rouge) quand quatre choses attendent un geste, et « À traiter » est sous la ligne de flottaison en 1366 × 768 comme en 360 × 640.
3. **Il se contredit et égare** : la même alerte rouge ici, ambre là ; un gel de 25,8 s neutre au direct ; Turso, le quota et le miroir mènent à une page qui ne les montre plus, ou nulle part.
4. **On y cherche ses pages** : en 1366 × 768 le rail cache Erreurs, Serveur et Maintenance ; au téléphone, la liste des pages ne ressemble pas au rail, et deux menus étrangers prennent la place de la console.
5. **« Pratique sur mobile » : pas encore** — des pages de cinq à treize mille pixels sans sommaire, des cibles de 32 px, des barres de 4 px au doigt, des tableaux coupés ; les dix changements du bas, presque tous petits, en règlent l'essentiel.

## 2. Les problèmes, par gravité

### Bloquant — on se trompe, on ne trouve pas, on ne peut pas faire

**B1 — « Un point à regarder » cache « quatre à traiter ».** Poste de commande et barre, 360 × 640 et 1366 × 768.
La pastille de la barre compte les voyants qui ne sont pas au vert — ici le processeur, « à surveiller » — et passe au rouge clignotant quelle que soit la gravité ; l'état du service le redit en grand. Ce qui attend un geste (la réserve à 2 jours, en rouge ; 3 signalements ; une soirée en plan ; un gel long) est dans « À traiter », sous la ligne de flottaison : vers 790 px en 1366 × 768 ; au téléphone, son titre affleure à 560 px, au ras de la barre du menu. Le rail dit « 4 », la barre « 1 ». Le matin, on lit « le processeur, rien de grave », et on referme.
*Preuve* : `4-ordinateur-sous-ivoire.png` (en haut : « 1 à regarder », « Poste de commande 4 », « Un point à regarder ») ; `2c-ordinateur-sept-jours-compare.png` (« À traiter 4 », à 790 px) ; `5-telephone-sous-ivoire.png` (le premier écran) ; `AdminApp.tsx` (le bouton `.qg-etat-pastille`, rouge dès que `aRegarder > 0`).
*Correctif* : la pastille compte « À traiter », prend la couleur de sa pire ligne et ouvre la liste en feuille, de n'importe quelle page ; les voyants restent l'état. Au poste, « À traiter » passe avant l'état au téléphone dès qu'il n'est pas vide, et en colonne de droite dès la première rangée à l'ordinateur (`grid-template-areas: 'etat etat traiter' 'chiffres chiffres traiter' 'graphe graphe graphe' 'direct soirees serveur'`), les voyants verts repliés comme au téléphone.

**B2 — Turso, le quota et le miroir mènent à la mauvaise page, ou nulle part.** Voyants et « À traiter », toutes tailles.
Depuis que « Base et miroir » existe, les voyants « Turso » et « Quota de Turso » et les lignes « Turso répond lentement » et « Le quota de Turso » ouvrent « Le serveur », qui ne montre plus ni le quota ni Turso ; le voyant « Miroir » et la ligne « Le miroir Turso est en panne » — la pire : des soirées qui ne se sauvegardent plus — n'ouvrent rien. « Gel long » ouvre les Alertes, puis le Serveur sur ses Signaux : « Ce qui gèle » reste à trouver. « Panne : le quiz du jour » ouvre les Erreurs, dont la carte ne propose aucun geste : fermer la page est au dernier lien du rail.
*Preuve* : `80-base.png` (tout y est) contre `22-serveur.png` (des Signaux sans quota) ; `etatDuService` (`shared/qgEtat.ts` : Turso et le quota vers `serveur`, le miroir vers `null`) et `lesChosesATraiter` (`shared/qg.ts` : l'union `ecran` de `ChoseATraiter` ignore `base`) ; `66-erreurs-telephone.png` (« En panne maintenant », sans bouton).
*Correctif* : `base` dans les écrans de `ChoseATraiter` et de `VoyantDuService`, et Turso, le quota et le miroir y vont ; un écran peut viser un onglet (`#serveur/gels`) ; sur la carte d'une panne, « Fermer le quiz du jour aux joueurs… » (le geste de la maintenance, confirmé) et « Afficher un bandeau ».

**B3 — En 1366 × 768, le rail cache sept pages et paraît fini.** Rail, ordinateur portable.
Le rail (toute la hauteur, un défilement interne à barre fine) montre Commande, Audience, Modes et Contenu, puis s'arrête sur le titre « TECHNIQUE » : Erreurs, Serveur, Base et miroir, Téléphones, Annonces, Nouveautés, Maintenance et « Mon compte » sont dessous, sans rien qui dise que la liste continue. La pastille rouge de la maintenance, posée pour qu'« on ne laisse pas une page fermée sans le voir », ne se voit jamais à cette taille. Dans une vraie fenêtre (≈ 650 px utiles sous les onglets et l'adresse), Contenu part aussi ; en 1920 × 1080, tout tient à 20 px près.
*Preuve* : `7-journal.png` (exactement 1366 × 768 : le rail s'arrête à 752 px, sur « TECHNIQUE ») ; `3-ordinateur-1920.png` (« Mon compte » à 1 050 px).
*Correctif* : des groupes repliables — Commande et celui de la page ouverts, les autres réduits à leur titre et à la somme de leurs pastilles, retenus d'une visite à l'autre ; la marque sur une ligne (l'environnement en pastille à côté du nom) ; un dégradé et « 7 pages de plus » au pied quand il déborde ; et ce qui sert en urgence remonté (G1).

**B4 — Les gravités se contredisent, et un seuil réglé ne vaut pas partout.** Toutes les pages, surtout le direct un soir de soirée.
La même réserve à 2 jours est rouge dans « À traiter » et sur le rail, « à surveiller » (ambre) sur la page des alertes. Un gel de 25,8 s — plus de huit fois le seuil de la règle « Gel long », pourtant ouverte — est neutre dans le compteur « Pire gel » du direct, comme le processeur à 178 % de sa part et Turso. Le direct rougit « Ce qu'un joueur attend » à 800 ms écrits dans le client, quand la règle a été réglée à 900 ms (le journal le dit). Sur la page faite pour le soir, on juge de travers.
*Preuve* : `2c-ordinateur-sept-jours-compare.png` (la réserve en rouge) ; `87-alertes-telephone.png` (la règle « Réserve du quiz du jour », « à surveiller ») ; `84-direct-telephone.png` (« Pire gel 25,8 s », neutre) ; `7-journal.png` (« seuil 900 ms ») ; `QgEnDirect.tsx` (`RESSENTI_EN_ALERTE_MS = 800`, et « Pire gel », « Processeur », « Turso » sans `alerte`) ; `lesChosesATraiter` (la réserve en `alerte: true`) contre `REGLES_DU_QG` (`reserve`, `gravite: 'veille'`).
*Correctif* : une seule source — la règle (`REGLES_DU_QG`, ses seuils réglés) donne la gravité d'une ligne, d'un voyant, d'une pastille et d'un compteur, prêtée au client avec le direct ; un compteur passé son seuil prend l'état de la règle (bordure, icône, mot) ; plus un seuil écrit dans le client.

### Gênant — on y arrive, mais mal ou lentement

**G1 — Le rail range par nature de données, pas par moment d'usage.** Rail et liste des pages, toutes tailles.
Une panne se traite sur trois groupes : la voir (Alertes, Commande), la comprendre (Erreurs, Technique), fermer la page et poser le bandeau (Maintenance, dernier lien d'Animer), le dire (Annonces). Être prévenu se règle sur deux pages : le téléphone s'inscrit sur « Erreurs » (« Sur ton téléphone »), les règles qui sonnent se choisissent sur « Alertes ». « Joueurs » et « Profils » se ressemblent — pour chercher Léa, lequel ? —, et « Économie » vit sous « Audience ».
*Preuve* : `PAGES_DU_QG` (`AdminApp.tsx`) ; `66-erreurs-telephone.png` (en bas) et `87-alertes-telephone.png` (« Téléphone » sur chaque règle).
*Correctif* : Commande = Poste · En direct · Alertes · Erreurs · Maintenance · Journal ; Technique = Serveur · Base et miroir · Téléphones ; Animer = Annonces · Nouveautés ; Économie sous Modes ; « Profils » devient « Chercher un joueur » ; les téléphones prévenus passent sur Alertes, un lien reste sur Erreurs.

**G2 — Au téléphone, la liste des pages ne ressemble pas au rail.** Feuille « Pages », 360 × 640.
Vingt-deux lignes sans groupes, dans un autre ordre (Journal 15ᵉ, Erreurs 16ᵉ, Maintenance 20ᵉ) et sous d'autres noms (« Alertes et incidents », « L'activité ») ; les noms passent sur deux lignes (« Le quiz du / jour », « La / campagne ») parce que la description prend 45 % et se coupe (« qui j… », « Cabi… ») ; sept pages par écran ; aucune gravité (« 2 jours d'avance » en gris, quand la même chose est rouge au poste) ; et rien sur le bouton « Pages » quand quelque chose attend.
*Preuve* : `1b-telephone-pages.png` ; `listeDesPages` (`AdminApp.tsx`), écrite à la main à côté de `PAGES_DU_QG`.
*Correctif* : la tirer de `PAGES_DU_QG` — mêmes groupes en titres, mêmes noms, même ordre, la pastille du rail au bout de chaque ligne, la description dessous en petit ou rien ; des lignes de 48 px (onze pages par écran) ; la somme des pastilles sur « Pages ».

**G3 — La tête de page et deux menus étrangers mangent le premier écran.** Toutes les pages, 360 × 640 surtout.
Au téléphone : la barre collée sur deux rangées (≈ 100 px), la barre du menu du joueur en bas (64 px : Accueil, Mes quiz, Profil, Boutique, Compte), « ← Le QG », le surtitre, un titre de 34 px, la NavAnimateur sur deux lignes (Accueil · Écran commun · Mes quiz · Mon compte · Historique · Le QG — un second menu de sortie, quand le compte n'a pas de profil, le cas des photos) et une intro de quatre ou cinq lignes : la page commence vers 365 px, et il en reste deux cents à lire. En 1366 × 768, la même tête pousse le contenu à 210 px.
*Preuve* : `66-erreurs-telephone.png` (« En panne maintenant » à 365 px) ; `7-journal.png` et `6-page-du-jour.png` (le contenu à 210 px).
*Correctif* : pas de `.menu-barre` sur `.qg` au téléphone (ou une barre du QG : Poste · À traiter · Direct · Pages) ; la NavAnimateur au pied du rail, où est déjà « Mon compte », et au bas de « Pages » ; la rangée des périodes hors de la barre collée (un bouton « 24 h ▾ ») ; au téléphone, un titre de 1,6 rem sans surtitre (« ← Technique » le dit) ; l'intro repliée sous « À quoi sert cette page ».

**G4 — Des pages en rouleau, sans sommaire.** Modes et Serveur, toutes tailles.
Le Cabinet fait 7 024 px en 1366 et 12 776 au téléphone, la campagne 4 410 et 7 508, le quiz du jour 5 148 au téléphone, le direct 5 368, les alertes 5 172 ; aucune ancre, aucun sommaire — « Régler » un palier est au milieu, « Les joueurs » du Cabinet tout en bas. Les Signaux du serveur empilent dix graphiques en une colonne, même en 1920 (3 588 px), là où la proposition voulait de petits graphiques côte à côte sous un même viseur.
*Preuve* : les hauteurs de `60-cabinet.png`, `62-cabinet-telephone.png`, `32-campagne-telephone.png` ; `23-serveur-1920.png` (une seule colonne).
*Correctif* : ce que j'attends du gabarit commun (lot 5, sans photo) : des onglets à adresse — Tableau de bord · Ce qui lui est propre · Joueurs · Gestes (`#cabinet/jeux`) —, ou un sommaire collé sous la tête ; les Signaux en grille, `grid-template-columns: repeat(2, minmax(0, 1fr))` dès 1101 px et trois colonnes dès 1600, comme `.qg-direct-graphes`.

**G5 — La période n'a ni la même place ni la même portée.** Barre de commande, toutes pages.
Sur les photos, la barre règle 4 pages sur 22 (Poste, Serveur, Base, Téléphones) ; ailleurs elle disparaît, et chaque page pose ses fenêtres à sa place et dans ses mots : « Aujourd'hui, comparé à la même heure des sept jours d'avant » (Économie, Duels), « Ces trente jours » (Cabinet), quatre-vingt-dix jours (Soirées, Joueurs), quatre semaines (les classements). Venu du poste sur « 7 j », on lit l'économie du jour sans en être averti. L'onglet du serveur et la période ne sont pas dans l'adresse : le retour du navigateur et un lien partagé les perdent. Le lot 5 étend la barre aux six pages des modes ; restent l'économie, les joueurs, les alertes, les signalements.
*Preuve* : les en-têtes de `42-economie.png`, `36-duels.png`, `60-cabinet.png` ; `QgServeur.tsx` (l'onglet dans un `useState`, hors de l'adresse).
*Correctif* : la barre garde sa place partout ; une page qui ne la suit pas y montre, grisée, sa fenêtre (« Aujourd'hui · 30 j ») et dit au survol « Cette page ne suit pas la période » ; l'onglet et la période dans l'adresse (`/admin#serveur/routes?p=24h`).

**G6 — Un prénom ne mène pas à sa fiche, et dans la fiche le geste est loin du fait.** Signalements, classements, sentiers, duels, journal ; la fiche, toutes tailles.
La fiche s'ouvre des Profils, des Joueurs, de l'activité, du Cabinet et de la palette — pas de qui signale, des classements du jour et des duels, des « plus bloqués » (Paul, P5, 31 échecs : pour le libérer, Profils, chercher « Paul », la fiche, « Libérer l'épreuve »), des duels en attente, ni du journal. Dans la fiche, « Connexion : fermée jusqu'à 3 h 01 » est à vingt lignes de « Lever le verrou », perdu parmi dix boutons en vrac, et « Supprimer le profil » touche « Suspendre ».
*Preuve* : `30-campagne.png` (en bas, « Les plus bloqués », du texte) ; `16-fiche-telephone-entiere.png` ; `FicheDuJoueurAuQg`, ouverte de cinq endroits seulement.
*Correctif* : tout prénom de joueur est un bouton qui ouvre la fiche en feuille (le composant existe) ; dans la fiche, le geste à côté de son fait (« fermée jusqu'à 3 h 01 · Rouvrir », « Une épreuve l'attend · Libérer », « Traversée en route · Rendre ») ; les dons sous un seul « Offrir… » ; « Supprimer » seul en bas, sous un filet.

**G7 — Au doigt : des cibles de 32 px, des barres de 4 px.** 360 × 640.
Les périodes font 32 px de haut, « Pages » et la loupe 38, « Voir les 9 autres voyants » 32, les en-têtes de tri 36, les seuils et « Téléphone » des alertes 32, « Les chiffres, seau par seau » 32. Un graphique de sept jours fait 56 barres de 4 px, celui des joueurs 90 barres de 3 ; glisser le doigt ne fait pas suivre la lecture — chaque barre n'écoute que son propre toucher —, et l'infobulle n'existe pas au toucher.
*Preuve* : `1d-telephone-sept-jours.png` (le graphique) ; `styles.css` (`.qg-periodes button`, `.qg-bouton`, `.qg-seuil`, `.qg-tri`) ; `GrapheDuTemps` (`QgGraphes.tsx` : `onPointerEnter` et `onPointerDown` sur chaque barre, rien au glisser).
*Correctif* : `@media (max-width: 1100px) { .qg-periodes button, .qg-bouton, .qg-bascule, .qg-etat-deplier, .qg-seuil, .qg-regle-tel, .qg-tri, .qg-tableau > summary { min-height: 44px } }` ; un `onPointerMove` sur le `svg` qui prend le seau sous le doigt, et ‹ › de 44 px de part et d'autre de la ligne de lecture.

**G8 — Des tableaux coupés en silence, un fil qui retient le pouce.** 360 × 640.
« Page par page » (Téléphones) montre la page, ses vues, « Affichée », puis « AU… » coupé : la réponse au doigt, les sauts et les erreurs sont hors de l'écran, sans dégradé ni colonne figée. Le fil du direct défile dans un cadre de 560 px sur un écran de 640, en `overscroll-behavior: contain` : le doigt posé dessus, la page ne bouge plus.
*Preuve* : `89-telephones-telephone.png` (en bas) ; `84-direct-telephone.png` (le fil) ; `.qg-fil-liste` (`styles.css`).
*Correctif* : partout la règle des routes (`.qg-colonne-detail` : au téléphone, la page, ses vues et le pire de ses chiffres, avec son mot), sinon une carte par ligne ; un dégradé au bord droit d'un cadre qui défile ; au téléphone, `.qg-fil-liste { max-height: none }`, dix lignes puis « Voir les suivantes ».

**G9 — Le jargon d'un ingénieur, en machine à écrire.** Partout, surtout Serveur, Base, Direct et les voyants.
« au 95ᵉ centile » à chaque détail, les colonnes « 4XX » et « 5XX », « Seau par seau », « Boucle occupée », « Pire gel · la boucle », « Connexions neuves… poignée de main », « Miroir », « fond · modèle du savoir », « socket player:action », « Comparer » (à quoi ?), et « 0,1 ‰ — contre 0,1 ‰ avant », où le ‰, en petite chasse fixe, se lit « % ». La page des téléphones montre la voie (« Page affichée », « trois pages sur quatre font mieux »). Et les phrases des détails sont en chasse fixe de 12 px : elles cassent sur trois lignes au téléphone (« sous la / moitié du / mois ») — et ce n'est pas JetBrains Mono, prévue, mais celle du système, différente sur chaque appareil.
*Preuve* : `1c-telephone-voyants.png` ; `74-serveur-versions.png` (le ‰) ; `72-serveur-routes.png` (les en-têtes) ; `2c-ordinateur-sept-jours-compare.png` (« Seau par seau »).
*Correctif* : « pour 19 appels sur 20 » (glosé une fois par page) ; « Refus » et « Erreurs » pour 4xx et 5xx ; « Heure par heure » (le pas est connu) ; « Sauvegarde des soirées » pour le miroir, « Serveur occupé » pour la boucle ; « 1 erreur pour 10 000 requêtes » ; « Comparer à hier », « à la semaine d'avant » ; `.qg-voyant-detail`, `.qg-ecart` et `.qg-lecture` en `var(--sans)` et `tabular-nums`, la chasse fixe gardée aux routes, aux codes et aux versions.

### Mineur — finitions

**M1 — « Annuler » a trois sens, et le geste sans retour vient en premier.** Signalements et duels, toutes tailles.
Dans « Corriger », la case « Annuler aussi ses points pour tous » est juste au-dessus du bouton « Annuler » ; sur chaque carte, « Annuler ses points pour tous », rouge et sans retour, ouvre la rangée des gestes ; aux duels, il a fallu inventer « Le garder ». *Preuve* : `54-signalements-corriger.png`, `50-signalements.png`, `40-duels-annuler.png`. *Correctif* : un formulaire se ferme par « Fermer » (comme « Régler » : « Appliquer · Fermer ») ; « Effacer ses points pour tous », au bout de la rangée, après « Garder », séparé d'un filet.

**M2 — Un voyant rouge qui clignote sans fin.** Barre, toutes pages.
`.qg-voyant-critique` clignote pour un simple « à surveiller » (B1) et manque aux blocs `prefers-reduced-motion` du QG (seuls le pouls et le HUD y sont). *Preuve* : `styles.css` (`.qg-voyant-critique` et `@keyframes qg-clignote`, absents des blocs « moins de mouvement » du QG). *Correctif* : l'y ajouter ; ne clignoter que pour « critique », et quelques fois seulement.

**M3 — La couleur seule.** Téléphones, routes, tuiles.
« 2,6 s », « 3,8 s », « 240 ms » en rouge sans mot ni icône ; « 5XX » en rouge ; « ↓ 2 % » en rouge sur la tuile des joueurs, une alerte pour du bruit. *Preuve* : `88-telephones.png`, `4-ordinateur-sous-ivoire.png`. *Correctif* : une icône ⚠ devant toute valeur hors seuil ; une flèche neutre sous ±10 %.

**M4 — Des repères en double.** Rail et onglets du navigateur.
L'œil pour « En direct » et pour « Joueurs », le triangle d'alerte pour « Maintenance » et pour les alertes ; des comptes d'inventaire gris (Profils 124, Salons 2) là où d'autres lignes disent « à faire » ; l'onglet du navigateur dit toujours la même chose, et deux onglets du QG se confondent. *Correctif* : une icône par page ; plus de compte d'inventaire au rail ; `document.title` = « (4) Les erreurs · QG ».

**M5 — La palette ne connaît que les noms courts.** Palette, toutes tailles.
« réserve », « turso », « quota », « bandeau », « masquer », « incidents » ne trouvent rien ; pas un geste ; au téléphone, son pied parle de « ↑ ↓ » et de « / » ; « ⌘K » s'affiche sous Windows. *Preuve* : `2d-palette.png` ; `QgPalette.tsx` (la recherche ne lit que le nom court et le groupe). *Correctif* : chercher aussi dans les descriptions de la liste des pages et des mots-clés ; un groupe « Gestes » (Mettre en maintenance…, Écrire une annonce…, Offrir des confettis à…) ; « Ctrl K » hors Mac, le pied caché au toucher.

**M6 — Finitions de page.** Alertes, poste, base, duels, guide.
« Nouvelle » sur huit règles, pour toujours (`87-alertes-telephone.png`) ; deux sortes de tuiles au poste — à courbe, et les cadrans à coins de visée et capitales d'« En ce moment » (`5c-participations-telephone.png`) ; un cadre de graphique vide, sans phrase (le quota, `80-base.png`) ; le toast posé sur le bouton « Annuler » de la ligne suivante (`41-duels-annule.png`) ; le guide range encore la maintenance sous un groupe « Piloter » qui n'existe plus. *Correctif* : « Nouvelle » sept jours ; une seule tuile ; « Rien de lu sur la période » à la place du cadre ; le toast au-dessus de la barre du bas ; le guide.

**M7 — Le lecteur d'écran.** Toutes les pages.
Changer de page ne déplace pas le focus et ne dit pas le titre (`aller` remonte la page, sans plus) ; la ligne de lecture des graphiques du direct est `aria-live` et change toutes les dix secondes ; chaque graphique porte deux fois son résumé (`role="group"` et `role="img"`). *Correctif* : le focus sur un `<h1 tabIndex={-1}>` à chaque page ; `aria-live` seulement quand on choisit un seau ; un seul `aria-label`.

## 3. Ce qui marche bien — à garder tel quel

- **La nuit et ses états** : un seul monde sous tous les thèmes (l'Ivoire n'y change rien), des gris qui tiennent (≈ 6,7:1 sur la console), chaque état d'une forme et d'un mot, les voyants verts repliés au téléphone.
- **Des gestes sûrs qui disent leur issue** : « Annuler le duel de Gabriel contre Lina ? » / « Le garder », « Rendre la traversée de Manon ? » et ce qui reste acquis, « Offrir 50 confettis », la correction qui dit ce qu'elle fera, un toast puis une phrase au journal.
- **Des états vides et de panne qui parlent** : « Rien n'attend de geste : la réserve tient… », « Dernier relevé à 21 h 40 », la dernière lecture gardée, la page qui se relit en retrait plutôt que de clignoter.
- **Des pages modèles** : la table des routes (triée par la part du temps, filtrée, sa feuille), la fiche d'une erreur (« Copier le détail »), les joueurs (un segment, ses profils, « Leur écrire »), la réserve en alerte avec ses trois gestes au même endroit.
- **Le clavier et les liens** : le rail en vrais liens (un onglet de plus d'un clic), la palette (⌘K, « / »), les graphiques aux flèches et leur tableau dépliable, les fenêtres modales qui rendent le reste inerte.

## 4. Les dix changements à faire tout de suite

1. **Chaque alerte mène où l'on agit** : Turso, le quota et le miroir vers « Base et miroir », « Gel long » vers l'onglet « Ce qui gèle », et sur la carte d'une panne « Fermer … aux joueurs » et « Afficher un bandeau ».
   Où : `shared/qgEtat.ts`, `shared/qg.ts` (`ecran` + `'base'`, un onglet visé), `QgErreurs.tsx`.
2. **La pastille de la barre compte « À traiter »**, à la couleur de sa pire ligne — ni rouge ni clignotement pour « à surveiller » — et ouvre la liste en feuille, de toute page.
   Où : `AdminApp.tsx` (`.qg-etat-pastille`), `lesChosesATraiter` (`shared/qg.ts`), `.qg-voyant-critique` (`styles.css`).
3. **« À traiter » au premier écran** : avant l'état au téléphone dès qu'il n'est pas vide ; à l'ordinateur, en colonne de droite dès la première rangée, les voyants verts repliés.
   Où : `QgVueDEnsemble.tsx` (l'ordre), `styles.css` (`.qg-poste` et ses `grid-template-areas`, `.qg-etat-replie`).
4. **La feuille « Pages » tirée du rail** : mêmes groupes, noms, ordre et pastilles, une ligne par page, et la somme des pastilles sur le bouton « Pages ».
   Où : `AdminApp.tsx` (`listeDesPages`, remplacée par une lecture de `PAGES_DU_QG`).
5. **Le rail par moment d'usage, et qui tient en 1366 × 768** : Erreurs et Maintenance sous Commande, Économie sous Modes, « Chercher un joueur » ; des groupes repliables, Commande et celui de la page ouverts.
   Où : `PAGES_DU_QG` (`AdminApp.tsx`), `.qg-cote`, `.qg-marque`, `.qg-groupe` (`styles.css`).
6. **Le téléphone rendu à la console** : sans la barre du menu du joueur ni la NavAnimateur (au pied du rail et de « Pages »), la période hors de la barre collée, une tête d'une ligne, l'intro repliée.
   Où : `AdminApp.tsx` (`MenuBarre`, `NavAnimateur`), `styles.css` (`.qg > .menu-barre`, `.qg-commande`, `.qg-tete`).
7. **Les mots** : « pour 19 appels sur 20 », « Refus » et « Erreurs » pour 4xx et 5xx, « Heure par heure », « 1 pour 10 000 » ; « Fermer » pour un formulaire, « Effacer ses points pour tous » en dernier ; les phrases en sans-serif.
   Où : `QgServeur.tsx`, `QgVueDEnsemble.tsx`, `shared/qgEtat.ts`, `QgSignalements.tsx`, `styles.css` (`.qg-voyant-detail`, `.qg-ecart`, `.qg-lecture`).
8. **Une seule source de gravité** : les seuils réglés des règles colorent les voyants, « À traiter », les pastilles et les compteurs du direct (Pire gel, Processeur, Turso) ; plus un seuil écrit dans le client.
   Où : `QgEnDirect.tsx` (`RESSENTI_EN_ALERTE_MS`, les compteurs sans `alerte`), `shared/qg.ts` (la réserve), `shared/qgEtat.ts`, `shared/qgAlertes.ts`.
9. **Au doigt** : 44 px pour les périodes, les boutons de la barre, les seuils et le tri ; des graphiques qui suivent le doigt, avec ‹ › ; des tableaux qui ne coupent pas en silence ; le fil sans cadre au téléphone.
   Où : `styles.css` (un bloc `@media (max-width: 1100px)` du QG, `.qg-fil-liste`), `QgGraphes.tsx` (`onPointerMove` sur le `svg`), `QgTelephones.tsx`.
10. **Un prénom ouvre la fiche, et la fiche met le geste à côté du fait** (Rouvrir, Libérer, Rendre), les dons sous « Offrir… », « Supprimer » à part.
    Où : `AdminCampagne.tsx` (« Les plus bloqués »), `QgSignalements.tsx`, `QgDuJour.tsx`, `QgDuels.tsx`, `QgJournal.tsx`, `QgFicheJoueur.tsx`.

## Sur quoi je m'appuie

- **Regardé** : le poste de commande (1366, 1920, téléphone, sous l'Ivoire, sept jours comparés, voyants dépliés, participations), la palette, la liste des pages, le serveur (ses cinq onglets, une route, au téléphone), la base, le direct, les alertes, les téléphones, les erreurs (une fiche, une panne, les réglées), les soirées (clore), le quiz du jour, la campagne (« Régler »), le Cabinet (« Rendre », une fiche), les duels (annuler), l'économie, les joueurs, la fiche d'un joueur (don, code de secours), les signalements (corriger, reclasser), le journal, les annonces — recadrés à la taille d'un écran pour chaque jugement de « premier écran ».
- **Lu** : `retours/2026-11-03/le-qg.md` (les principes, « Le design ») et `maquette-qg/` (sa feuille), `docs/guides/administrer.md`, `retours/2026-11-04/experts/analyse-et-management.md` (pour ne pas le redire) ; dans le code, `AdminApp.tsx` (le rail, la barre, la liste des pages), `QgPalette.tsx`, `QgVueDEnsemble.tsx`, `QgGraphes.tsx`, `QgEnDirect.tsx`, `QgServeur.tsx`, `AdminCampagne.tsx`, `shared/qg.ts`, `shared/qgEtat.ts`, `shared/qgAlertes.ts` et le bloc « Le QG » de `styles.css`.
- **Calculé** : le contraste du gris des détails (`#8f9bb0`) sur la console (`#0d121b`), ≈ 6,7:1 ; la largeur des barres au téléphone (la largeur utile du graphique divisée par ses seaux).
