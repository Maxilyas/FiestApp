# Le QG permet-il d'analyser et de piloter toute l'application ? — revue d'un expert du pilotage de jeux grand public

Le 4 novembre 2026, sur pièces : la proposition acceptée (`retours/2026-11-03/le-qg.md`), le guide
(`docs/guides/administrer.md`), la règle `.claude/rules/qg.md`, les routes et les tables de la référence, le code là
où une affirmation le demandait, et les photos du chantier. Le lot 4 (la page du Cabinet) et l'onglet « Temps réel »
du serveur sont comptés comme faits ; les lots 5 (les modes côte à côte) et 7 (le contenu) comme en cours.

## 1. Le verdict en cinq lignes

1. **La machine est très bien vue** : le direct, quatorze alertes réglables et leurs incidents, les routes, les gels, les versions, le temps réel, le quota de Turso, le miroir, les téléphones — sobre au quota, fidèle à la vie privée.
2. **Les joueurs à profil, le contenu des modes seuls et l'animation aussi** : actifs, fidélité, segments, cohortes, écran de naissance ; signalements et leurs gestes, réserve, mélanges ; bandeau, maintenance et testeurs, annonces à un segment, affiches.
3. **Ce qui manque le plus : les animateurs comme clients.** Aucune vue par animateur — ni rythme, ni retour, ni premiers pas. « Salons » n'est qu'une liste de gestes, et c'est pourtant chaque animateur qui amène une salle entière.
4. **Puis l'activation et l'effet de tes gestes** : le premier jour d'un profil, l'invité qui devient profil, la soirée qui nourrit le jeu seul ; ce que font une annonce, une affiche, un rappel ou une mise en ligne (aucun repère sur les courbes) ; la progression et l'économie au-delà de trente jours.
5. **Le QG ne vient pas à toi** : aucun point envoyé, aucun export, et quelques chiffres trompent. À cette échelle (une quarantaine de profils le 2 novembre, une poignée d'animateurs), des listes qui nomment valent mieux que des moyennes, et un test A/B ne dirait rien : compare avant et après, suis les gens.

## 2. Les manques, par priorité

Chaque manque dit **quoi**, la **décision** qu'il permet, d'où viennent les **données**, son **coût**, ce qu'il
**respecte** et **où** il vivrait. « Lignes » veut dire des lignes lues au quota de Turso (500 millions par mois,
partagés avec la préproduction et les sauvegardes ; 7,2 millions en trois jours fin octobre).

### P1 — sans eux, on ne pilote pas

#### P1.1 — Le carnet des animateurs
- **Quoi** : une ligne par salon (son titulaire, né le, première soirée, soirées sur 90 jours et en tout, dernière soirée, **rythme habituel** — la médiane des écarts entre ses soirées — et **retard** sur ce rythme, invités médians, part des invités venus avec un profil, profils nés chez lui, quiz prêts par origine, quiz jamais lancés). Au-dessus : l'entonnoir d'un nouvel animateur (salon créé → premier quiz → première soirée jouée → deuxième sous 30 jours), et cinq états dits en clair comme les segments des joueurs : *à lancer* (salon créé, rien joué depuis 7 jours), *nouveau*, *fidèle*, *en retard* (plus du double de son rythme), *parti* (90 jours).
- **Décision** : qui relancer cette semaine et de quoi lui parler (un animateur sans quiz : le quiz tout prêt) ; où la mise en route casse ; si les soirées font grandir le réseau.
- **Données** : `accounts` (en mémoire : `created_at`, `profile_id`) ; `soirees` (`space_id`, `held_at`, la fiche : `invites[].profileId`, `invites[].joue`, `quiz`, `questions`, `jeux`) ; `quizzes` (`space_id`, `created_at`, `QuizStore.countBySpace`) ; `profiles.created_at`/`origine` et la première ligne de soirée de `profile_xp` (`space_id`, `soiree_id`) pour les profils nés chez lui. **N'existent pas** : l'origine d'un quiz — une colonne `quizzes.origine` posée à sa création (éditeur, liste collée, import, modèle, tout prêt, partage reçu) — et le salon ouvert sans rien jouer — la table `salons` s'efface au réveil et un essai ne laisse rien : un compte à l'ouverture dans le relevé de l'heure, additionné par la mémoire du jour (P1.3).
- **Coût** : M. Une lecture par jour gardée jusqu'à minuit — les fiches de toutes les soirées, quelques centaines de lignes, et les quiz groupés par espace ; aujourd'hui se relit par `idx_soirees_held_at`. Processeur négligeable.
- **Respecte** : le salon (nommé par son titulaire, comme « Soirées en cours ») et des chiffres — ni titre, ni question, ni prénom d'invité ; « profils nés chez lui » est un compte.
- **Où** : une page à elle, **Audience › Animateurs**, à la place de « Salons » (sa liste et ses gestes en deviennent l'onglet « Les salons ») ; une ligne sur la fiche d'un joueur qui tient un salon ; un segment « animateurs » et ses états dans « À qui ? » des annonces.

#### P1.2 — Les premiers pas d'un profil, et la soirée qui convertit
- **Quoi** : les profils nés chaque semaine, par écran de naissance — ont joué le jour même, sont revenus le lendemain, ont joué deux jours ou plus dans leur première semaine, ont essayé un second mode, n'ont jamais joué. Puis, soirée close par soirée close : les invités venus avec un profil, les profils nés pendant elle sur les invités sans profil ; et le pont : les nés en soirée qui jouent seuls dans les 7 jours.
- **Décision** : quel écran d'entrée soigner d'abord (la fin de soirée, l'accueil, le quiz du jour) ; si le pari du produit — la soirée nourrit le jeu seul — tient ; à qui écrire (« nés en soirée, jamais revenus »).
- **Données** : `qg_presences` (jour, profil, modes en bits) et `profiles.created_at`/`origine`, que la page des joueurs lit déjà une fois par jour ; la fiche des soirées (`invites[].profileId`), que le poste lit déjà pour trente jours ; un profil né en soirée se reconnaît à son origine (`entree`, `soiree`, `fin-de-soiree`). Rien de neuf à mesurer.
- **Coût** : S. Aucune lecture de plus : une dérivation pure à côté de `cohortesDesProfils` (`shared/qgJoueurs.ts`).
- **Respecte** : des profils comptés ; l'invité sans profil se compte soirée par soirée, jamais suivi de l'une à l'autre ; sous vingt, « 4 sur 9 », pas un pourcentage.
- **Où** : **Audience › Joueurs**, une section « Premiers pas » entre les segments et les cohortes ; au poste, « Nouveaux profils » dit « dont N ont rejoué » et la tuile des soirées « N profils nés ».

#### P1.3 — La mémoire longue ne garde que l'audience
- **Quoi** : `qg_jours` garde joueurs, modes, participations, nouveaux profils, achats, invités et heures de jeu. Y ajouter, pour chaque jour fini : soirées, animateurs distincts et nouveaux, salons ouverts sans rien jouer, invités avec et sans profil, profils nés en soirée ; confettis gagnés par source et dépensés par puits, la circulation (somme, médiane des actifs) ; missions faites ; questions jouées par mode ; heures éveillées du serveur ; versions mises en ligne (`qg_demarrages` ne les garde que huit jours).
- **Décision** : toute tendance au-delà de trente jours — la saison des soirées, l'inflation, l'effet d'un lancement — et la période « 90 j » du poste, qui attend (règle `qg.md`).
- **Données** : ce que `lesTrenteJours` (`server/src/qg.ts`) et `server/src/economie.ts` calculent déjà pour les jours finis, écrit par `MemoireDuQg` dans le lot du jour ; `VERSION_DE_LA_MEMOIRE` montée, l'année se refait une fois des journaux, en tranches.
- **Coût** : S. Une ligne par jour, un peu plus grosse ; 90 jours se lisent en 90 lignes, une fois par jour.
- **Respecte** : des chiffres, jamais un nom.
- **Où** : rien à montrer en soi : elle nourrit le poste (90 j), les animateurs, l'économie, le point du matin et l'export.

#### P1.4 — Le point du matin, et celui du lundi
- **Quoi** : à 8 h 40 (la production est debout depuis 7 h), une notification aux téléphones déjà prévenus des pannes — « Hier : 31 joueurs (+12 %), 3 profils nés, 1 soirée, 12 invités · 2 choses à traiter » — qui ouvre « Hier, en bref » en tête du poste : la journée face à son habitude, les nouveaux et leur lendemain, les soirées et leurs animateurs (le nouveau, celui qui revient, celui qui est en retard), les incidents, ce qui attend (signalements, questions du public, copies, réserve, sauvegarde), et une phrase pour ce qui s'écarte le plus de l'habitude. Le lundi, la semaine face aux quatre d'avant.
- **Décision** : n'ouvrir le QG que quand il le faut ; savoir chaque semaine si l'application grandit.
- **Données** : la mémoire du jour (P1.3), `qg_incidents`, `lesChosesATraiter` (`shared/qg.ts`) ; l'envoi par `AlertesDuQg.prevenir` (`server/src/core/alertes.ts`, `qg_alertes_telephones`), l'heure tenue comme la tournée du rappel (`RappelStore`). Rien à garder : il se relit de la mémoire.
- **Coût** : S/M. Aucune lecture par ouverture ; c'est l'envoi qui déclenche le rattrapage du jour — la mémoire ne dépend plus d'une visite de la page des joueurs, et le poste peut la lire.
- **Respecte** : la notification ne dit que des nombres — ni prénom, ni salon : un écran verrouillé se lit par-dessus l'épaule ; la page, le salon et ses chiffres.
- **Où** : **Commande › Poste de commande**, un bandeau en tête ; l'heure et l'interrupteur sous « Alertes », à côté des téléphones.

#### P1.5 — Deux arrêts que rien ne guette : la sauvegarde, et les heures de l'hébergeur
- **Quoi** : deux règles de plus. **Sauvegarde ancienne** : la dernière a plus de 7 jours (réglable) — aujourd'hui la page « Base et miroir » la dit en rouge, mais rien ne sonne ni n'entre dans « À traiter ». **Heures de l'hébergeur** : au rythme de la semaine, les heures éveillées de ce service ce mois-ci — l'offre gratuite en donne 750 aux deux services ensemble, et le quota épuisé les suspend tous deux jusqu'au 1er (règle `exploitation.md`) ; rien ne les compte.
- **Décision** : lancer `npm run sauvegarde` avant qu'un geste sans retour (un espace supprimé « en reprenant ») ou un incident de Turso ne coûte l'historique ; laisser dormir la préproduction avant la fin du mois.
- **Données** : `qg_sauvegardes` (déjà lue par la page Base, `SAUVEGARDE_ANCIENNE_MS`) ; `qg_demarrages` pour la semaine, les heures de chaque jour dans la mémoire (P1.3) pour le mois. Chaque service ne voit que ses heures : le seuil de chacun se règle sur sa part.
- **Coût** : S. Dix lignes au plus une fois l'heure, comme le quota ; jugées par `lecteurDesAlertes`, sans lecture par minute.
- **Respecte** : rien de personnel.
- **Où** : **Alertes et incidents** (le téléphone d'office pour les heures), « À traiter », la page Base.

### P2 — forte valeur

#### P2.1 — L'effet de ce que tu envoies
- **Quoi** : sous chaque annonce, « ont rejoué dans les 7 jours : 9 sur 34 — d'habitude, 3 endormis sur 34 reviennent en une semaine », et le taux de réponse à sa question ; sous chaque affiche, les visites de la page dans les 14 jours face aux 14 d'avant, et ceux qui y sont revenus une seconde fois ; au rappel du soir, « ouvert » et « joué dans la soirée après l'envoi ». Aujourd'hui : combien l'ont reçue, combien sont allés sur la page, combien d'envois — jamais ce que ça a changé.
- **Décision** : continuer d'écrire aux endormis ou non ; quelle affiche rapporte, et si 50 confettis à la première visite valent mieux que 0 ; garder le rappel à 18 h.
- **Données** : `qg_annonce_destinataires` (ou les profils d'alors) × `qg_presences`, l'habitude du segment relue dans la même feuille ; `profile_affiches.ouverte_le` × les parties du mode ; `jour_rappels.dernier_jour` × `jour_parties.commencee_le`, gardé dans une colonne de plus de `jour_rappels_tournees` à la clôture du jour. **N'existe pas** : l'ouverture d'un rappel — la notification mène à `/jour` (`server/src/core/rappels.ts`) ; menée à `/jour?depuis=rappel`, `servirPage` la compte dans le relevé de l'heure, sans une écriture par visite. La lecture d'une annonce ne se sait pas (le téléphone la retient seul) : le retour au jeu en tient lieu.
- **Coût** : S. Quelques dizaines de lignes par annonce, une fois par jour ; la feuille de présence est déjà lue.
- **Respecte** : des comptes ; les mots libres restent nominatifs pour toi seul, comme aujourd'hui. Pas de groupe témoin à cette échelle : il ne dirait rien.
- **Où** : **Animer › Annonces** et **Nouveautés**, sous chaque ligne ; **Quiz du jour**, le rappel du soir.

#### P2.2 — Les repères sur les courbes, et l'avant / après
- **Quoi** : le principe 6 de la proposition, accepté et pas fait : chaque graphique du temps porte ses événements — mise en ligne (son commit et sa phrase), arrêt net, page mise en maintenance ou ouverte à tous, affiche, annonce, mélange réglé, seuil réglé. Et une carte « Avant / après » : un repère choisi, les 14 jours d'avant et d'après sur les chiffres de la mémoire (joueurs, nouveaux, leur lendemain, le mode touché, confettis).
- **Décision** : savoir ce qu'une mise en ligne ou une ouverture a fait — le Cabinet du 31 octobre a-t-il pris des joueurs à la campagne, ou en a-t-il amené ?
- **Données** : `qg_gestes` (chaque geste, daté, sa sorte), les versions (gardées par P1.3), `qg_jours`. **N'existe pas** : la phrase d'un commit — le build l'écrit dans le paquet, à côté de `RENDER_GIT_COMMIT` que lit `server/src/index.ts`.
- **Coût** : M (le kit `GrapheDuTemps`, `client/src/components/QgGraphes.tsx`) ; quelques dizaines de gestes par période, gardés.
- **Respecte** : sur la courbe, la sorte seule (« annonce », « affiche : le Cabinet »), jamais le profil qu'un geste nomme.
- **Où** : tous les graphiques du temps ; la carte au **Journal**, qui devient « Journal et repères » — les gestes, les mises en ligne et les incidents au même fil, comme la proposition le prévoyait.

#### P2.3 — L'économie : inflation, puits, et ce qui dort
- **Quoi** : la circulation par profil actif sur 90 jours, le rapport des puits aux sources, la part des actifs qui ont acheté ces 30 jours et le délai jusqu'au premier achat, la part des soldes tenue par les plus riches ; les articles **jamais vendus** en 90 jours (la page ne montre que les meilleures ventes) ; les missions du jour (profils actifs à 0, 1, 2 ou 3 missions faites, et chaque sorte de mission avec sa réussite) ; les coffres (rangs ouverts, ce qui en est tombé).
- **Décision** : ce qu'il faut dire d'un prix ou d'une mission — les barèmes restent dans le code, le QG mesure et le code décide ; quelle mission personne ne finit ; quel article retirer ou mettre à l'affiche.
- **Données** : `server/src/economie.ts` et `shared/qgEconomie.ts` (`fluxDeConfettis`, `circulationDes`, `meilleuresVentes`) ; `profile_missions` (`mission` en JSON, sa sorte ; `faite_le` indexé) ; `profile_coffres` (`rang`, `objet`) ; les catalogues de `shared/` pour les invendus ; l'historique par P1.3.
- **Coût** : S/M. Les missions et coffres du jour par leurs index, une fois par jour ; les invendus, une soustraction en mémoire.
- **Respecte** : des comptes ; aucun nom.
- **Où** : **Audience › Économie** (le coffre « pour voir » en sort : section 3).

#### P2.4 — La progression : trop facile, trop dur ?
- **Quoi** : les profils actifs par niveau, et le temps médian pour atteindre 10, 20, 30 ; l'expérience gagnée par source (soirées, quiz du jour, campagne, missions, paliers) ; chaque trophée — combien d'actifs le tiennent, sa rareté mesurée face à celle que suppose `PART_DES_JOUEURS`, le dernier tombé ; les légendaires possédés, pas seulement portés.
- **Décision** : un trophée que personne n'atteint ou que tous ont, une courbe qui ralentit trop tôt, un mode qui paie trop d'expérience — à dire au propriétaire, et à mesurer par `calibrage.ts` avant d'y toucher.
- **Données** : `profiles.xp` et `niveauDuProfil` (`profile_niveaux`) ; `profile_xp` (lignes `#jour`, `#campagne`, `#missions`, `#paliers` et soirées) ; la population des trophées que `ProfileStore.populationBadges` compte déjà et garde dix minutes pour les cartes ; `profile_legendaires`, `profile_badges`.
- **Coût** : M. La population existe ; le reste, une lecture par jour en tranches.
- **Respecte** : **aucun Divin**, ni ligne, ni compte, ni « autres » qui le trahirait (invariant 21) : filtrer comme `badgesOf`, les voies rangées par `sqlHorsDesVoiesRangees`, et un test qui y veille comme `divins.test.ts`.
- **Où** : **Audience › Progression**, une page à elle.

#### P2.5 — Triche et abus : ce qui ne se voit pas tout seul
- **Quoi** : « À regarder », semaine par semaine : les soirées qui créditent beaucoup à peu (trois profils au plus, toujours les mêmes, plusieurs soirées par semaine dans le même salon, des quiz courts) ; les parties du jour aux temps de réponse que personne ne tient ; les paires de duels qui se répètent ; une règle « Inscriptions en rafale » (le fil du direct sait déjà dire « Un profil est né × 34 », mais rien ne sonne) ; les verrous de connexion en rafale. Et un geste neuf : **« Reprendre ce que cette soirée a crédité »**, plutôt que de supprimer tout l'espace « en reprenant » — le seul recours d'aujourd'hui contre « un compte qui fabriquait des soirées ».
- **Décision** : masquer, suspendre, reprendre une soirée — sur des faits, en sachant qu'une soirée de famille à trois leur ressemble.
- **Données** : la fiche des soirées × `profile_xp` de ces soirées ; `jour_reponses.ms`/`juste` du jour, déjà lues par le suivi ; `campagne_duels` (déjà gardés dix minutes) ; le direct et `loginBudgetOf` en mémoire ; le geste par le chemin de « Retirer une soirée de l'historique » (`retirerSoireeEntiere`). **N'existe pas** : le compte des verrous dans le relevé de l'heure.
- **Coût** : M. Quelques centaines de lignes par jour ; les règles en mémoire.
- **Respecte** : les profils se nomment, comme ailleurs au QG ; d'une soirée, le salon et des chiffres ; aucune adresse gardée (la réserve d'inscriptions les sale et les oublie).
- **Où** : un onglet « À regarder » dans **Audience › Profils** ; la règle dans Alertes ; le geste sur la page des **Soirées**, et au journal.

#### P2.6 — Les noms, et signaler un joueur
- **Quoi** : « Signaler ce joueur » sur la carte d'un profil (classement du jour, duels, amis) — son prénom, le nom de son compagnon —, une file avec « Changer son prénom », « Renommer son compagnon », « Garder » ; « Les noms de la semaine », les prénoms et noms de compagnons nouveaux ou changés, à parcourir en dix secondes ; et « Lui écrire », un mot sans confettis, sur la fiche.
- **Décision** : retirer un nom blessant avant qu'il passe au classement ou sur un vidéoprojecteur.
- **Données** : `profiles.name`, `renomme_le`, `created_at` ; `profile_compagnons.nom`. **N'existe pas** : une table des signalements d'un joueur (le profil visé, qui, quand, un mot), comme `jour_signalements`.
- **Coût** : M (S pour la liste des noms et le mot) ; une lecture à l'ouverture.
- **Respecte** : on signale un profil, jamais un invité sans profil (il n'a pas de carte hors de sa soirée) ; qui signale reste connu de toi seul.
- **Où** : **Contenu › Signalements**, un onglet « Joueurs » ; la fiche d'un joueur.

#### P2.7 — Le contenu du Cabinet ne se corrige d'aucun geste
- **Quoi** : six jeux sur neuf posent un contenu écrit pour eux — lieux de l'Épingle, fiches des Indices, répliques, tableaux du Détail, frises, affirmations de l'Éclair — que personne ne peut signaler (« Ce jeu du Cabinet ne se signale pas ») et qu'aucun geste ne retire. La page du Cabinet montre désormais ce qui s'y rate le plus : il faut le geste derrière. Ouvrir le signalement à ces pièces, une file au QG, et « Retirer du Cabinet » ; la correction reste dans le dépôt.
- **Décision** : retirer une fiche fausse le soir même, sans attendre une mise en ligne.
- **Données** : `campagne_reponses.reserve_id` (les clés `cab:…`, `PREFIXES_HORS_DE_LA_BASE`) ; une table de retraits lue au réveil, comme `campagne_retraits`.
- **Coût** : M ; rien de plus à l'ouverture.
- **Respecte** : comme les signalements d'aujourd'hui.
- **Où** : **Contenu › Signalements** (le Cabinet en plus, que la proposition prévoyait) et la page du Cabinet.

#### P2.8 — La santé d'une soirée, vue de son animateur
- **Quoi** : pour chaque soirée close, sa qualité en chiffres — les invités inscrits qui n'ont jamais répondu, les réponses « trop tard », les reconnexions, le pire gel pendant elle, la sauvegarde en retard. L'onglet « Temps réel » dit tout cela heure par heure pour tout le serveur ; rien ne le rattache à une soirée, donc à un animateur.
- **Décision** : écrire à l'animateur dont la soirée a souffert, voire le dédommager ; voir si une version fait monter les « trop tard ».
- **Données** : `invites[].joue` existe dans la fiche (`FicheSoiree`, `server/src/core/archive.ts`). **N'existent pas** par soirée : des compteurs tenus par l'espace en jeu et écrits dans la fiche au rangement d'après chaque quiz (`apresQuiz`), sans une écriture de plus.
- **Coût** : M ; aucune lecture de plus (la fiche est déjà lue).
- **Respecte** : des chiffres d'une soirée, jamais ses invités.
- **Où** : le carnet des animateurs (sa dernière soirée), l'historique du mois des **Soirées** (une colonne).

#### P2.9 — D'où viennent les gens, au-delà de l'écran de naissance
- **Quoi** : les pages publiques (souvenir, bilan, historique) vues jour par jour, et ce qu'elles amènent — les profils et les salons nés après un souvenir partagé, les arrivées de la vitrine — ; et l'invité devenu animateur : « 2 des 3 nouveaux animateurs avaient d'abord joué chez quelqu'un ».
- **Décision** : soigner le souvenir partagé, la boucle virale d'un jeu de soirée, ou la vitrine ; savoir si les soirées font naître des animateurs.
- **Données** : `pouls.pagesServies`, compté à la minute pour `/healthz` puis perdu → dans le relevé de l'heure ; deux valeurs de plus dans `ORIGINES_D_UN_PROFIL` (`souvenir`, `vitrine`), par un `?depuis=` que la page garde jusqu'à l'inscription (sous try/catch) ; l'invité devenu animateur : sa première soirée (`profile_xp`) avant la naissance de son salon (`accounts.created_at`).
- **Coût** : S/M ; rien à Turso par visite.
- **Respecte** : ni adresse ni référent brut, une catégorie.
- **Où** : **Joueurs**, « D'où viennent les profils » ; le carnet des animateurs.

#### P2.10 — Copier, télécharger
- **Quoi** : « Copier en CSV » sur chaque tableau — le principe 3 de la proposition, dans la maquette mais nulle part dans l'application — et « Télécharger la mémoire », une ligne par jour sur un an.
- **Décision** : aucune en soi : elle rend les autres possibles hors du QG — un bilan annuel, une question à laquelle le QG ne répond pas encore.
- **Données** : les tableaux que la page tient déjà ; `qg_jours`.
- **Coût** : S ; rien (la copie), ou 366 lignes à la demande.
- **Respecte** : ce que la page montre, rien de plus ; une cellule qui commence comme une formule prend son apostrophe, comme `toCsv` (`server/src/core/export.ts`).
- **Où** : chaque tableau ; le téléchargement sur **Joueurs**.

### P3 — plus tard

- **P3.1 — Des alertes d'usage.** Personne de neuf depuis trois jours, aucune soirée un samedi, un animateur fidèle en retard sur son rythme, aucune mission faite hier. *Décision* : voir la panne que les erreurs ne disent pas. *Données* : la mémoire du jour (P1.3), jugée une fois par jour. *Coût* : S chacune. *Respecte* : des chiffres. *Où* : Alertes et incidents.
- **P3.2 — Des gestes de live ops sur le contenu.** Programmer une annonce ou une affiche ; choisir le thème du défi de la semaine suivante, ou un quiz du jour de fête ; mettre un modèle du catalogue en avant. *Décision* : rythmer l'année sans mise en ligne, sans toucher un barème. *Données* : `qg_annonces`, `qg_affiches` (une date de départ), un réglage lu au tirage — le QG ne tire toujours rien. *Coût* : M. *Où* : Animer.
- **P3.3 — Ce que la bibliothèque devient.** Ce que chaque modèle du catalogue est devenu (copié, joué), les sortes de questions jouées en soirée (tous espaces confondus, en comptes), les quiz écrits jamais lancés. *Données* : `quizzes.origine` (P1.1) × `jeux` des fiches. *Coût* : S une fois l'origine posée. *Respecte* : ni titre ni question. *Où* : Catalogue, Animateurs.
- **P3.4 — La porte du QG.** Tes sessions (appareil, ouverte le, vue le — jamais le jeton) et « Fermer les autres » ; l'appareil d'où part chaque geste. *Décision* : voir à temps un mot de passe qui a fui, quand ce compte supprime des espaces et des profils. *Données* : `auth_sessions`, `profile_sessions`. *Coût* : S. *Où* : Journal.
- **P3.5 — Les testeurs, puis l'ouverture.** Ce que les testeurs d'une page bientôt disponible y ont joué, les erreurs tombées sous leurs pas, leurs réponses à une question d'annonce ; puis l'ouverture lue par l'avant/après (P2.2). *Données* : `qg_testeurs` × leurs parties. *Coût* : S. *Où* : Maintenance.
- **P3.6 — Ouvrir à une part des profils, et des témoins.** Un déploiement progressif (une part tirée de l'identifiant) et des groupes témoins pour les annonces : utiles au-delà de quelques centaines de joueurs actifs ; aujourd'hui, ils ne diraient rien. *Coût* : L. *Respecte* : un mode qu'on joue seul seulement (invariant 8). *Où* : Maintenance.
- **P3.7 — Une fiche de joueur complète.** Son écran de naissance, ses premiers jours, son segment, son rythme d'animateur, les signalements reçus ; « Exporter ses données », le droit d'accès sans courriel. *Coût* : S. *Où* : la fiche.
- **P3.8 — La compétition dans le temps.** Les ligues semaine après semaine (montées, descentes, qui s'arrête après une descente), les duels que leurs destinataires laissent toujours expirer. *Données* : `campagne_duels`, la cote relue des duels joués. *Coût* : S/M. *Où* : Duels.

### Dans le Cabinet fusionné et les lots en cours : ce qu'il faudrait y voir de plus

- **Le Cabinet (lot 4)** : d'où viennent ses joueurs — déjà en campagne, endormis réveillés, nouveaux (la feuille de présence avant leur première traversée : il prend des joueurs à la campagne ou en amène ?) ; la poussière d'or, une économie à part que la page de l'économie ne verra jamais (gagnée, dépensée en œuvres et dorures, en poche) ; les traversées rendues par semaine — un signe de bug, pas de joueur ; la promesse « une vingtaine de minutes » face à la durée médiane.
- **Les modes côte à côte (lot 5)** : une unité qui se compare entre modes — les minutes jouées (parties × durée médiane) plutôt que les participations (section 3) ; l'entonnoir « soirée ouverte → quiz joué » a besoin des ouvertures gardées (P1.1, P1.3), sinon sa première marche s'efface à chaque réveil ; le retour à J+7 séparé entre nouveaux et habitués ; quand un mode monte, lequel baisse chez les mêmes profils.
- **Le contenu (lot 7)** : la fraîcheur — la part de la base déjà vue par les plus assidus, catégorie par catégorie ; le rythme de la réserve (déposé, consommé, ses jours d'avance en courbe) ; le circuit des questions du public (acceptées, délai de relecture, auteurs revenus) ; les catégories choisies au quiz tout prêt, tous animateurs confondus (ce que la base doit grossir) — toujours sans une question de soirée.

## 3. Ce qui est en trop ou mal placé

1. **Deux « Joueurs » qui ne comptent pas les mêmes personnes.** Au poste, un invité sans profil compte une fois par soirée ; sur la page des joueurs, « Joueurs du jour » ne compte que des profils. Le même mot, deux populations : « Personnes (invités compris) » au poste, « Profils actifs » sur la page.
2. **« Participations » empile des unités qui ne se comparent pas.** Un invité d'une soirée de deux heures vaut une participation, une partie du Cabinet de quelques minutes aussi : le graphique empilé fait peser les modes courts. Comparer les modes en questions jouées ou en minutes (lot 5), garder les participations mode par mode.
3. **« Invités sans profil : 138 » compte des passages, pas des gens** (une fois par soirée). Le dire : « passages d'invités ».
4. **Trois compteurs pour « ce qui m'attend ».** La barre dit « 2 à regarder » (les voyants), le rail « 4 » (À traiter), et l'arrêt net paraît deux fois — voyant et ligne. Un seul compte, une seule liste : les voyants disent l'état, « À traiter » l'action.
5. **La carte « Le serveur » du poste redit les voyants et le direct** (mémoire, processeur, Turso, connexions). Seule la routine du matin y est unique : elle va dans « À traiter » ou dans « Réserves et base » (lot 7), la carte s'en va.
6. **« Dernier passage » et « les derniers vus » ne disent que la dernière connexion par mot de passe** (`touchSeen`, appelé par `/api/joueur/connexion` seulement, `server/src/auth/profileRoutes.ts`) : un joueur de chaque jour, au cookie d'un an, paraît parti depuis des mois, et « Les profils » sans recherche trie sur ce chiffre (`pourLAdministration`, `ORDER BY COALESCE(last_seen_at, created_at)`). Le remplacer par la dernière partie, que la feuille de présence sait déjà.
7. **« Vu » d'un salon est l'ouverture d'une console** (`last_login_at`, `touchLogin`), pas une soirée animée : « dernière soirée ».
8. **« Qui joue à quoi » nomme deux tableaux différents** — les combinaisons de modes (Joueurs) et chaque profil avec sa barre (Activité, que le lot 5 garde) : renommer l'un (« Les plus assidus »).
9. **Le coffre « pour voir » sur la page de l'économie** : un aperçu-jouet dans une page d'analyse. À sa place, ce que les coffres ont vraiment donné (P2.3).

## 4. Les huit recommandations à faire tout de suite

1. **Quoi** : rendre justes les chiffres qui trompent — la dernière partie au lieu du dernier mot de passe, la dernière soirée au lieu de la dernière console, les deux « Joueurs » renommés, les passages d'invités, un seul compteur d'attention (S).
   **Où** : Profils et la fiche d'un joueur, Salons, Poste de commande, Joueurs.
2. **Quoi** : deux règles de plus — « Sauvegarde ancienne » (`qg_sauvegardes`, au-delà de 7 jours, réglable) et « Heures de l'hébergeur » (les heures éveillées du mois sur les 750 partagées) — (S).
   **Où** : Alertes et incidents, « À traiter », le téléphone.
3. **Quoi** : compléter la mémoire longue (`ChiffresDUnJour`, `qg_jours`, `VERSION_DE_LA_MEMOIRE` montée) — soirées, animateurs, salons ouverts sans jeu, invités avec et sans profil, nés en soirée, confettis par source et puits, circulation, missions, heures éveillées, versions (S).
   **Où** : `server/src/core/memoireDuQg.ts`, `shared/qgJoueurs.ts` ; le poste lit enfin « 90 j ».
4. **Quoi** : le carnet des animateurs — une ligne par salon (soirées, dernière, rythme et retard, invités, profils nés chez lui, quiz par origine avec `quizzes.origine`), l'entonnoir salon → quiz → première → deuxième soirée, cinq états, « Leur écrire » (M).
   **Où** : Audience › Animateurs, à la place de « Salons » ; un segment de plus dans les annonces.
5. **Quoi** : les premiers pas — le jour même, le lendemain, deux jours dans la première semaine, par écran de naissance ; invités → profils soirée par soirée ; nés en soirée qui jouent seuls sous 7 jours (S).
   **Où** : Audience › Joueurs, une section « Premiers pas » ; deux chiffres au poste.
6. **Quoi** : le point du matin et du lundi — une notification à 8 h 40 aux téléphones prévenus des pannes, des nombres seulement (`AlertesDuQg.prevenir`), qui écrit aussi la mémoire du jour (S/M).
   **Où** : « Hier, en bref » en tête du Poste de commande ; l'heure et l'interrupteur sous Alertes.
7. **Quoi** : l'effet de ce que tu envoies — le retour au jeu sous 7 jours de chaque annonce face à l'habitude de son segment, les visites avant/après de chaque affiche, `/jour?depuis=rappel` compté et les parties jouées après l'envoi (S).
   **Où** : Animer › Annonces et Nouveautés, sous chaque ligne ; Quiz du jour, le rappel du soir.
8. **Quoi** : les repères sur chaque courbe — mises en ligne et leur phrase de commit, maintenance, ouvertures, annonces, affiches, mélanges, lus dans `qg_gestes` et la mémoire — et la carte « Avant / après » (M).
   **Où** : tous les graphiques du temps (`GrapheDuTemps`) ; la carte au Journal, devenu « Journal et repères ».

## Sur quoi je m'appuie

- **Lu** : `README.md`, `CLAUDE.md`, `docs/README.md`, `retours/2026-11-03/le-qg.md`, `docs/guides/administrer.md` (le Cabinet du lot 4 compris), `.claude/rules/qg.md`, `docs/reference/api-http.md` (l'administration, le quiz du jour, la campagne, le Cabinet, les duels), `docs/reference/base-de-donnees.md`, `PAGES_DU_QG` (`client/src/views/AdminApp.tsx`).
- **Vérifié dans le code** : la fiche d'une soirée (`FicheSoiree`, `server/src/core/archive.ts`) ; `ChiffresDUnJour` (`shared/qgJoueurs.ts`) ; les quatorze règles (`shared/qgAlertes.ts`, aucune sauvegarde ni heure d'hébergeur) ; `touchSeen` et `pourLAdministration` (`server/src/auth/`) ; le rappel qui mène à `/jour` (`server/src/core/rappels.ts`) et le service worker qui ne dit rien de son ouverture (`client/public/sw.js`) ; aucune origine sur un quiz (`server/src/core/quizStore.ts`) ni aucun compte d'usage au catalogue (`server/src/core/partages.ts`) ; `pagesServies` gardé à la minute seulement (`server/src/core/pouls.ts`) ; aucun « Copier en CSV » ni repère dans `client/src/`.
- **Regardé** : le poste de commande à l'ordinateur et au téléphone (`export/rendu-qg2/`), le direct (`export/qg-lot3/`), les alertes (`export/qg-lot8/`), la page des joueurs au téléphone, l'économie et les soirées (photos de travail du même chantier).
- **L'échelle** : 41 profils et 3 220 séries le 2 novembre 2026 (`retours/2026-11-02/reproductions/lecture-de-la-production.md`), 7,2 millions de lignes lues en trois jours fin octobre (`retours/2026-11-03/synthese.md`).
