# Animer une soirée

> Le pas à pas de l'animateur : préparer la soirée, vérifier le jour J, tenir la console pendant le quiz, parer aux imprévus, puis clore. Tu animes depuis ton téléphone — un salon — ou depuis l'écran commun ; tes invités, eux, jouent sans compte.

**Dans cette page** : [Deux façons d'animer](#deux-façons-danimer) · [Avant](#avant-la-soirée) · [Le jour J](#le-jour-j) · [Pendant](#pendant-le-quiz) · [Les imprévus](#les-imprévus) · [Après](#après-la-soirée)

## Deux façons d'animer

| | Depuis ton téléphone : un salon | Depuis l'écran commun |
|---|---|---|
| Tu ouvres | « Créer un salon », à l'accueil (`/salon`) | `/host`, sur l'ordinateur branché à la télé ou au vidéoprojecteur |
| Il te faut | un profil | ton profil, ou un compte d'animateur |
| Les questions s'affichent | sur les téléphones, ou sur une télé branchée par son code | sur l'écran commun |
| Tes gestes | la barre du chef, en bas de ton téléphone | la console, en bas de l'écran — ou ton téléphone en télécommande |
| Pour finir | « Terminer la soirée » | « Clore la soirée » |

Connecté à l'écran commun, ton profil y retrouve le même espace, ses quiz et son code.

## Avant la soirée

### Ouvrir ton salon

À l'accueil, « Créer un salon » ouvre « Nouveau salon ». Il s'ouvre avec ton profil (sinon : « Me connecter » ou « Créer mon profil ») ; ton espace naît à ta première visite, sans rien d'autre à retenir.

1. **« Les quiz »** : ceux de ce soir, dans l'ordre — « Ajouter un quiz » propose tes quiz prêts, le quiz tout prêt et les modèles.
2. **« Où voit-on les questions ? »** : « Sur nos téléphones », ou « Sur une télé » ([plus bas](#la-télé)).
3. **« Et toi ? »** : « Je joue aussi », ou « J'anime seulement ».
4. **« Les équipes »** : « Chacun pour soi », ou « En équipes ».
5. Replié dans **« Réglages »** : le rythme (« Question suivante » : « Au clic », « 5 s », « 10 s », « 20 s » — 5 s d'office) et les « Points » de chaque quiz, ×1, ×2 ou ×3.
6. **« Ouvrir le salon »** enregistre le programme de ce soir, ouvre le salon et son code, et t'emmène dans ta soirée, ta barre en bas de l'écran.

### Ou ouvrir l'écran commun

Sur `/host`, le formulaire « Écran commun » prend l'identifiant et le mot de passe de ton profil, ou d'un compte d'animateur. Dessous, « Ou depuis ton téléphone » affiche un code, que « Brancher la télé » accepte depuis ton téléphone déjà connecté : rien à taper au clavier de l'écran.

Les réglages de ton espace sont dans « Mon compte », « L'affiche » : les titres, la date, et « Invités au plus » (de 2 à 500, 150 d'office ; le serveur peut plafonner plus bas, `MAX_PLAYERS`).

### Préparer les quiz

Tes quiz s'écrivent dans « Mes quiz » : [Les quiz](../produit/les-quiz.md). Le **programme** — les quiz de ce soir, dans l'ordre, chacun à ses points — se compose en créant le salon ; la console le propose ensuite quiz après quiz, et ta barre de chef le choisit seule. Sans programme, tu choisis chaque quiz au lancement ([La soirée](../produit/la-soiree.md)).

### Les équipes

- **Au salon**, « En équipes » en propose deux : un toucher en renomme une, « Ajouter une équipe » en ajoute une (dix au plus). Elles sont posées avant le premier invité, qui choisit la sienne en entrant.
- **À l'écran commun**, en salle d'attente : « Nouvelle équipe » puis « Ajouter » ; ou, tant qu'il n'y en a aucune, un nombre (« 4 équipes ») puis « Les créer d'un coup » — de deux à six, une pour quatre invités proposée d'office. Supprimer une équipe n'exclut personne : ses membres repassent « sans équipe » et gardent leurs points.
- **Pendant un quiz**, un invité ne change pas d'équipe lui-même ; toi, tu peux le déplacer à tout moment, par le menu d'équipe de sa puce. Il l'apprend sur son téléphone. Comment se comptent les points d'une équipe : [La soirée](../produit/la-soiree.md).

### La télé

- **Au salon**, « Sur une télé » : sur la télé, ouvre `<adresse du serveur>/tele`. Elle affiche un code de six caractères, qui change toutes les cinq minutes ; tape-le dans « Le code affiché sur la télé », puis « Brancher ». Rechargée entre-temps, la télé a changé de code : « Une autre télé ? » rouvre le champ.
- **À la télécommande** (ton téléphone sur `/host`), « Brancher la télé », en salle d'attente, fait de même.
- **Une télé branchée est un écran de salle** : rien à y toucher. Elle montre la salle vue de loin — le code, le QR, qui est là —, puis le quiz, pendant 24 heures au plus. « Débrancher » la ferme si un autre animateur l'a validée par erreur ; quand personne ne l'anime d'un téléphone, « Piloter d'ici » lui rend la console, à la souris.

### La salle d'attente

- L'écran montre comment entrer : « Pour rejoindre le quiz », le code du salon en grand, l'adresse et le QR — avec, si le serveur le connaît, le QR du wifi à côté. Tes invités scannent, ou tapent le code dans « Rejoindre une soirée » ([Jouer](jouer.md)).
- « Invités (N) », rangés par équipe : toucher un prénom ouvre « Un surnom pour « X » ce soir » ; la croix exclut — « Exclure « X » de la soirée ? », « Ses points seront effacés et son téléphone reviendra à l'inscription. » ; une lune marque un téléphone hors ligne. Exclure n'est pas bannir : l'exclu peut se réinscrire.

## Le jour J

- **Le serveur répond** : ouvre ta page un peu avant l'heure — une offre d'hébergement gratuite s'endort sans visite ([La mise en ligne](../exploitation/mise-en-ligne.md)).
- **Le programme** est prêt : les quiz, leur ordre, leurs points.
- **L'écran** : la télé est branchée, ou l'écran commun passe en « Plein écran » ; « Fond clair » (Ivoire) si le vidéoprojecteur délave les noirs.
- **Le son** : sur l'écran projeté, touche « Activer le son » — le navigateur le bloque jusqu'au premier geste. Seul l'écran projeté sonne ; « Sons » le coupe.
- **Le wifi** : réglé sur le serveur (`WIFI_SSID`, `WIFI_PASS`, [La configuration](../reference/configuration.md)), son QR paraît en salle d'attente, avant celui du quiz.
- **HTTPS** : seul un serveur en HTTPS garde les téléphones allumés pendant un quiz ; sinon, ils lisent « Garde ton écran allumé pendant le quiz ».
- **La jauge** : « Invités au plus » couvre ta salle.
- **Un essai** : un téléphone, un quiz court, puis « C'était un essai » efface tout ([Après](#après-la-soirée)).

## Pendant le quiz

### Lancer

- **À l'écran commun** : « Lancer un quiz » — « En attente des invités… » tant qu'aucun téléphone n'est connecté. Les connectés de cet instant forment la partie, les autres y entrent en arrivant. Avec un programme, l'écran propose le prochain quiz (« C'est parti ! » ou « Un autre quiz… ») ; sinon, « Choisis un quiz ».
- **Au salon** : « Lancer le quiz ». Ta barre choisit seule le prochain quiz du programme (« Le quiz arrive… ») et pose ton rythme.

Le cycle d'une question — intertitre, photo, question, révélation — et ce que voit chacun : [La soirée](../produit/la-soiree.md).

### La console, geste par geste

Les boutons gardent leur place, ceux qui ne servent pas sont grisés : à gauche l'action principale, au milieu la pause et l'enchaînement, à l'écart à droite ce qui défait quelque chose.

| Geste | Quand | Ce qu'il fait | Ce qu'il demande |
|---|---|---|---|
| « Passer à la question » | l'intertitre, la photo à mémoriser | passe à la suite | — |
| « Révéler » | la question | révèle sans attendre le chrono ni les retardataires ; lève une pause | — |
| « Révéler », champ « Bonne réponse » | la mesure d'une estimation en direct | pose la bonne valeur, et révèle | — |
| « Question suivante », « Voir le podium » | la révélation | la suite | — |
| « Pause », « Reprendre » | la question | fige le chrono — personne ne répond —, puis le relance où il s'était arrêté | — |
| « Suivante » : « au clic », « 5 s », « 10 s », « 20 s » | de l'intertitre à la révélation | règle l'enchaînement | — |
| « Reposer » | la révélation, la mesure | retire les points de la question à tous, et la repose de zéro | « Reposer cette question ? » — « Les points gagnés sur cette question sont retirés à tout le monde, puis elle repart de zéro, chronomètre compris. » — « Reposer la question » |
| « Annuler les points » | la révélation, la mesure | retire les points de la question à tous : « Points annulés » | « Annuler les points de cette question ? » — « Les points gagnés sur cette question sont retirés à tout le monde. » (pendant la mesure : « Elle se révèle sans bonne réponse, et ne rapporte rien à personne. ») — « Retirer les points » ou « Garder les points » |
| « Terminer » | de l'intertitre à la révélation | referme le quiz ; ce qui a été gagné reste | « Terminer le quiz maintenant ? » — à la révélation : « Les questions suivantes ne seront pas posées, et le podium du quiz ne s'affichera pas. Les points déjà gagnés restent acquis. » ; avant : « La question en cours ne comptera pas, et les suivantes ne seront pas posées. Les points déjà gagnés restent acquis. » — « Terminer le quiz » |

Un double clic ne saute rien : la console ignore les gestes de la partie une demi-seconde après chaque changement de phase, et chaque geste dit au serveur ce qu'il visait — un « Révéler » qui croise la révélation automatique ne passe pas à la question suivante.

**L'enchaînement.** Un délai choisi, la question suivante part seule après la révélation (« Question suivante dans 5 s »). Il s'arrête quand une question se ferme sans une seule réponse — « Personne n'a répondu — la suite attend l'animateur » : retouche le délai allumé pour relancer ; et après « Annuler les points », la suite attend ton clic. Le réglage passe au quiz suivant ; au salon, ta barre remet ton rythme à chaque quiz.

**Au podium du quiz** : « Quiz suivant », « Remise des prix » (s'il y a des équipes : le quiz se referme, et la remise des prix s'ouvre sur tous tes écrans), et « Terminer le quiz », qui ramène à la salle d'attente sans rien demander. Le podium reste tant que tu ne le refermes pas.

**En salle d'attente**, les écrans de fin — « Podium » dès qu'un point est marqué, « Prix » et « Victoire » avec des équipes — passent sur tous tes écrans d'animateur ensemble ; « Les chiffres » s'ouvrent dans un onglet. La remise des prix : [Après la soirée](../produit/apres-la-soiree.md).

### La télécommande

- Ouvre `/host` sur ton téléphone : un écran de 600 px de large au plus tient la console en **télécommande**, sauf si tu touches l'icône « Télécommande » — le choix reste sur l'appareil.
- Elle montre « À l'écran » et l'étape au lieu de la scène, les gestes en grand, et la régie : le temps, « Réponses 12/50 », « On attend » et les visages, puis la répartition — jamais la bonne réponse avant la salle. Ta note sur la question ne se lit que là. Elle ne sonne pas.
- Tant qu'elle est là, l'écran projeté te laisse les coulisses : la liste des quiz (« Le prochain quiz arrive… », « La liste est à la télécommande » — « Choisir d'ici » la reprend) et la grille des prix (« La grille est à la télécommande », le dernier prix remis en grand — « Remettre les prix d'ici »).

### La barre du chef

En bas de ton téléphone, une fois entré dans ta soirée :

- **L'invitation** en grand tant que personne n'a marqué — « Le code du salon », le QR, « Copier le lien » —, puis « Code », à un toucher.
- **Le geste du moment** : « Lancer le quiz », « Quiz suivant » (inerte deux secondes et demie après l'arrivée du podium, le temps qu'on le regarde), la pause, « Révéler » avec le compte des réponses (« 12/30 »), le champ « La bonne réponse » d'une estimation en direct, « Question suivante » ou « Le podium », « Ajouter un quiz » quand le programme est joué, et « Terminer la soirée » quand son dernier quiz a rendu son verdict.
- **« ⋯ » (« La partie »)** : le rythme (« Au clic », « 5 s », « 10 s », « 20 s »), les équipes, et selon le moment : à la révélation, « Reposer la question » (sans confirmation) et « Annuler les points » (« Annuler les points de cette question ? » — « Personne ne gagne rien sur elle, et elle sort des statistiques. ») ; pendant un quiz, « Terminer le quiz » (« Terminer ce quiz ? » — « Les questions restantes ne seront pas posées. Ce qui a été joué compte. » ; sur le dernier quiz du programme, « Terminer ce quiz et la soirée ? ») ; hors d'un quiz, « Ajouter un quiz » et « Terminer la soirée ».

Ta barre ne montre rien de la question : tu la lis sur la même page que tes invités. Ses gestes partent sans attendre de réponse et ne se renvoient pas : si le réseau hoquette au moment où tu touches et que la barre ne bouge pas, retouche — elle montre toujours où en est la partie.

### Jouer en animant, ou animer seulement

- **Au salon**, « Je joue aussi » : tu joues comme tes invités. « J'anime seulement » : tu suis la partie sur ton téléphone et peux répondre pour le plaisir, mais rien de toi ne compte — ni points, ni classement, et la question ne t'attend pas. Ton téléphone lit « Tu animes · hors classement ».
- **À l'écran commun**, « Jouer depuis cet appareil » (à la télécommande, ou sur un écran tactile) ouvre la page des invités dans un autre onglet : tu y joues comme eux.

## Les imprévus

### Un téléphone mort

1. Ouvre **« Qui manque ? »** : l'icône des invités, à droite de la console, avec un nombre — « Qui n'a pas répondu ? » pendant une question, « Invités hors ligne » sinon. Elle ne paraît que si quelqu'un manque.
2. Pendant une question, **« Ne plus l'attendre »** : la question ne l'attend plus. S'il revient, il est de nouveau attendu à la question suivante.
3. **« Rendre sa place »**, puis « Montrer le code » : six chiffres, « À montrer à Rachid, pas à la salle. » — ta console est peut-être projetée. Le code vaut trois minutes, une seule fois.
4. Sur son nouveau téléphone, sous son prénom, il touche « J'ai un code » — à l'entrée, en salle d'attente ou entre deux questions —, tape le code, puis « Reprendre ma place » : « Te revoilà, Rachid 🦁 ». Ta console lit « Rachid a repris sa place ».

> [!NOTE]
> Le code donne à sa place un **jeton neuf** : son ancien téléphone, s'il se rallume, ne la retrouve plus (« On ne te retrouve plus dans cette soirée — rejoins-la ») — deux téléphones ne jouent jamais la même place. **Une place à profil ne se rend pas par un code** (« Il a un profil : qu'il s'y connecte sur son nouveau téléphone ») : il se connecte à son profil sur le nouveau téléphone, et sa place lui revient, jeton compris.

- S'il s'était déjà inscrit sur le téléphone emprunté, ce « second Rachid » s'efface s'il n'a rien joué ; sinon il reste avec ses points — ils ne rejoignent pas la place reprise — et la partie ne l'attend plus. S'il a une réponse en suspens, le code attend : « Attends la révélation, puis retape le code ».
- Un code faux : « Ce code ne marche pas — demande-en un nouveau à l'animateur » ; cinq, et « Trop d'essais — demande un nouveau code à l'animateur ». Si des codes faux arrivent en rafale, ta console le dit, et un code neuf rouvre la porte.

Le même moment, côté invité : [Jouer](jouer.md).

### Un retardataire

Il entre, même en plein quiz : il joue la question en cours si elle est encore ouverte, sinon à partir de la suivante (« Bienvenue ! Tu joues à partir de la prochaine question. »), sans rien des questions passées. En équipes, il choisit la sienne en entrant — ou, pendant un quiz, « Entrer sans équipe ». Un téléphone qui dormait au lancement entre dans la partie à son réveil. Et si son téléphone lit « La soirée est complète — préviens l'animateur, qui peut libérer des places », exclus un téléphone fantôme, ou monte « Invités au plus ».

### Deux Camille

Personne n'est refusé ni renommé. À l'entrée, les avatars d'un homonyme sont éteints ; si deux invités ont malgré tout le même prénom et le même avatar, l'écran marque le second « Camille (2) » — à l'affichage seulement, et la marque s'en va avec l'homonyme. Pour les départager à voix haute, donne un surnom : toucher le prénom, « Un surnom pour « Camille (2) » ce soir », « Donner ce surnom ». Il s'affiche partout ce soir ; un profil garde son prénom, que la soirée suivante lui rend.

### Une coupure de réseau

- **Chez un invité** : « Connexion perdue — reconnexion… », puis son téléphone revient seul et retrouve sa place, son équipe et ses points. Une réponse touchée pendant la coupure part au retour du réseau ; si la question s'est close entre-temps, il lit « Trop tard — la question était finie ». Il reste attendu à chaque question : « Ne plus l'attendre » évite à la salle de patienter jusqu'au bout du chrono.
- **Chez toi** : « reconnexion… » dans la bande de l'écran ; le quiz, lui, continue au serveur. Un geste de la console sans réponse en trois secondes est renvoyé une fois, sans risque de jouer deux fois ; ceux de la barre du chef ne se renvoient pas : retouche si rien ne bouge.

### Un serveur qui redémarre

Un déploiement, un réveil de l'hébergeur, une panne : la soirée ne se perd pas.

- Invités, équipes, points, réponses et quiz en cours sont recopiés dans la base permanente ; les chronomètres repartent à leur échéance, et la question reprend où elle en était. Le code du salon survit, et chaque téléphone se reconnecte seul à sa place.
- Ce qui ne vivait qu'en mémoire est oublié : l'écran de fin affiché (retour à la salle d'attente — rouvre-le), les codes « Rendre sa place » (fais-en paraître un autre). Ton « J'anime seulement », lui, est redit par ton téléphone en se reconnectant.
- Si la bande de l'écran dit « Sauvegarde en retard — la soirée continue », la base permanente refuse les écritures depuis un moment : la soirée continue, mais un redémarrage sur disque effacé perdrait ce qui attend ([Exploiter](../exploitation/exploiter.md)).

## Après la soirée

- **À l'écran commun**, « Clore la soirée » — en salle d'attente ou sur l'écran de victoire — propose un nom : « Elle rejoint l'historique sous ce nom. Chaque invité reçoit sa fin de soirée sur son téléphone — son rang, ses hauts faits, ses niveaux —, puis la suivante part de zéro. » Ta console confirme : « « … » est close — la soirée suivante peut commencer ».
- **« C'était un essai »**, dans la même boîte, efface tout sans rien garder : « Effacer cet essai ? », puis « Tout effacer ».
- **Au salon**, ta barre propose « Terminer la soirée » quand le dernier quiz du programme a rendu son verdict — ou dans « ⋯ », hors d'un quiz : « Elle s'enregistre telle qu'elle a été jouée, et chacun reçoit sa fin de soirée. » Sous ta fin de soirée, « Ton salon » propose « Encore un quiz, avec eux » et « C'était un essai ».
- Si la base permanente refuse, rien n'est effacé — « Rien n'a été effacé : … » — : réessaie. Sinon l'écran annonce la soirée close, et « La soirée suivante » rend tous tes écrans à la salle d'attente. Le code du salon vaut encore une demi-heure pour un retardataire ; un écran rallumé pendant ce temps le garde, sinon la soirée suivante en tire un neuf.

La fin de soirée de chacun, le souvenir, le bilan, l'historique et les prix : [Après la soirée](../produit/apres-la-soiree.md).

## Pour aller plus loin

- [La soirée](../produit/la-soiree.md) — les règles : le cycle d'une question, les retardataires, l'enchaînement, les équipes
- [Après la soirée](../produit/apres-la-soiree.md) — la clôture, les prix, le souvenir, l'historique
- [Jouer](jouer.md) — ce que vivent tes invités
- [Les quiz](../produit/les-quiz.md) — écrire et préparer tes quiz
- [Administrer](administrer.md) — le QG, et la soirée laissée en plan
- [Le temps réel](../architecture/temps-reel.md) — ce qui se passe sous la console
