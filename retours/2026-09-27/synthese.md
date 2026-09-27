# L'analyse complète après #58 et #59 — vingt experts du code, et leur contre-expertise, 26 et 27 septembre 2026

La demande : « une analyse totale du dépôt, car avec la dernière PR pas mal
de choses ont changé » — les PR #58 (le quiz du jour, le profil en onglets)
et #59 (collection, paliers du jour, Sphinx, laurier, écussons, fonds de
carte, saisons) ont ajouté dix mille lignes que ni tablée ni expert n'avait
vues. Des experts sur le code, pour les bugs, la performance, la sécurité ;
tous ceux qu'on a ; et le jeu solo, le quiz du jour.

Pour y répondre, trois couches :

- **Quinze experts nouveaux**, qui lisent le code au lieu de jouer la
  soirée : leurs fiches sont entrées dans la tablée
  (`.claude/skills/tablee/experts/`, « Les audits de code » dans
  `SKILL.md`), avec une consigne commune (`consignes-audit.md`) — un serveur
  jetable par le banc des tests, une reproduction qui est déjà l'épreuve de
  la correction, des constats rendus en JSON. Sécurité des routes et des
  sockets ; le jeu solo, règles puis écran ; la progression, comptes puis
  vitrine ; le design des récompenses ; le moteur ; la persistance ; la
  concurrence ; les invariants du `CLAUDE.md` ; le client ; la bibliothèque
  des quiz ; l'exploitation ; les tests.
- **Cinq experts de la tablée repris sur les nouveautés** : l'accessibilité,
  les mots, le parcours du profil (sur une régie d'atelier), la performance
  du serveur, et celle du client (chargement et rendu réunis). Le système de
  design est passé dans le design des récompenses ; les parcours de
  l'animateur et de l'invité, la carte du site, la première visite,
  l'éditeur, le benchmark et l'écran commun n'ont pas été relancés : ils
  datent du 24, et #58 et #59 n'ont pas touché leurs écrans.
- **Neuf contre-expertises**, une par domaine (`consignes-contre-expertise.md`,
  nouvelle elle aussi) : chaque constat P1 et P2 relu pour être **réfuté** —
  sa reproduction relancée, son chemin de code relu depuis la porte
  d'entrée, sa gravité jugée sur la vraie production.

**190 constats.** 153 confirmés (dont 18 à gravité revue), 18 doublons,
16 tensions avec un parti pris, 2 incertains, 1 réfuté. **Aucun P1** après
contre-expertise — les deux annoncés (le second profil qui souffle les
réponses du quiz du jour ; l'éditeur qui garde cent questions) sont
redescendus en P2. **26 P2 confirmés**, 127 P3. 147 constats ont été
**rejoués** par leur expert — une épreuve qui échoue aujourd'hui, le plus
souvent, sinon une mesure ou une capture ; les 120 fichiers de reproduction
sont dans `reproductions/`.

L'état de départ était vert : `npm run verify` sur `main` (b57035c),
typecheck, 652 épreuves, build et smoke en 41 étapes, 5 min 52. Aucun
fichier de l'application n'a été modifié par cette analyse.

Où lire la suite : les rapports des experts dans `experts/`, tels qu'ils
les ont écrits ; les contre-expertises dans `verification/` ; **tous les
constats, avec leur verdict, leur `fichier:ligne` et leur piste, dans
`constats.json`** — les identifiants entre crochets (`[jour-regles-2]`)
renvoient à lui. Quelques captures dans `captures/`. Les chemins
`export/evaluations/…` cités par les rapports renvoient au dossier de
travail de la session, hors de git.

**Deux incidents de banc.** La limite d'usage a coupé tous les agents deux
fois : le 26 à 22 h 20 UTC (quinze en parallèle ; reprise à 6 h 45) et le 27
à 8 h 10 (reprise à 11 h 40). Ils ont été repris où ils en étaient, sans
rien perdre — leur dossier était sur disque. La contre-expertise de
`perf-client`, coupée, a été faite par le coordinateur, à la lecture
seulement (`verification/perf-client.md`).

## En bref

### Ce qui tient — et c'est l'essentiel

Le noyau n'a pas bougé sous les dix mille lignes. Les portes HTTP sont
solides (scrypt à temps constant, protection contre les requêtes forgées
posée avant la lecture du corps, cookies `HttpOnly`/`Secure`/`Lax`, CSP sans
script tiers, photos rangées par UUID, sans SVG). Aucun socket n'a pu
commander un autre espace ni lire une bonne réponse avant la révélation —
ni dans les vues, ni dans les pages publiques en cours de soirée. Le moteur
a encaissé 162 000 gestes tirés au hasard sans perdre un point, et
200 redémarrages à des moments choisis ont retrouvé la même partie à la
même échéance. La migration de `a6fc98b` à `b57035c` est propre : 66 pannes
de Turso provoquées au démarrage ont toutes arrêté le serveur puis l'ont
laissé repartir sans dommage, et la sauvegarde restaure les 34 tables à
l'identique. Le quiz du jour a son chrono au serveur, son idempotence à deux
étages, et tient minuit comme les changements d'heure du 25 octobre et du
28 mars. Le laurier coûte 15 octets à une salle et ne fait rediffuser que
celle du lauréat. Les copies de quiz arrivent entières par tous les
chemins, les trois pièces octet pour octet.

### Trois échéances datées

1. **Le samedi 24 octobre à 22 h UTC, la CI de toutes les PR passe au
   rouge**, et y reste dix-neuf jours par an : deux épreuves comptent ce qui
   tombe à la clôture, et une soirée jouée pendant Halloween, Noël ou le
   Nouvel An y ajoute son légendaire de saison [tests-1]. Correction : S.
2. **Halloween commence le 25 octobre** : un joueur qui commence son
   troisième quiz du jour sans le finir lit « 3 jours sur 3 » et ne reçoit
   jamais la Citrouille, perdue pour un an [jour-regles-3] ; et sans la
   routine qui remplit la réserve, le quiz du jour s'arrête au cinquième
   jour après le déploiement, pour vingt-six jours [exploitation-2].
3. **Avant toute montée de `VERSION_BAREME`** : la ligne `#jour` s'écrit
   `{"v":6.0}` et ferait relire tout l'historique à chaque réveil de Render
   [recompenses-comptes-1] ; sa correction doit partir **dans le même
   commit** que celle du recalcul qui prend une panne passagère pour une
   archive illisible [exploitation-1] — corrigée seule, elle rendrait
   l'autre permanente.

### Ce qui abîme des soirées aujourd'hui (P2)

- **Le jeu solo** : un classement du jour rangé périmé fait payer le podium
  de la nuit — laurier et Champion du jour compris — à la mauvaise personne,
  pour de bon [jour-regles-2] ; « Question suivante » après minuit annonce
  qu'il n'y a pas de quiz [jour-regles-5] ; au téléphone, le réseau qui
  revient après l'échéance laisse la page figée, un double toucher répond à
  une question qu'on n'a pas lue, le lecteur d'écran n'entend rien et le
  texte agrandi cache le chrono [jour-ecran-1 à 4].
- **Les fins de soirée qui se croisent** : deux « Clore », ou « C'était un
  essai » puis « Clore », jouent deux clôtures — une seconde annonce au
  podium vide sur la télé, une fin sans palier, un essai effacé qui reste
  archivé et crédité [concurrence-1] ; et un « Clore » touché pendant une
  reconnexion est jeté par le serveur sans un mot [client-3].
- **Les sessions d'emprunt** : une télé appairée, ou un téléphone prêté avec
  la console ouverte, suffit à rattacher son propre profil à l'espace et à
  le garder pour de bon [securite-portes-1] ; une session d'administrateur
  se refait un mot de passe sans connaître l'ancien [securite-portes-2] ;
  vingt essais de connexion lancés ensemble traversent le verrou « cinq
  échecs » [concurrence-2].
- **La soirée** : la télé qu'on pilote à la télécommande reste muette toute
  la soirée [client-4] ; un double clic remet un prix deux fois [client-5] ;
  une réponse touchée dans une liaison morte n'arrive jamais [client-1] ;
  le téléphone mort qu'on n'attend plus pèse encore sur la moyenne de son
  équipe — déjà vu le 24 septembre, jamais corrigé [moteur-1].
- **L'éditeur** perd du travail : au-delà de cent questions, en silence ;
  une photo tombe sur la question voisine ; une pièce effacée par le ménage
  revient « prête » [bibliotheque-1 à 4].
- **Le petit écran** : à 320 px ou à 130 % de texte, les prénoms
  disparaissent du classement du téléphone [design-recompenses-2].

**La triche du second profil** au quiz du jour est réelle et triviale, mais
c'est une **tension** : la fermer demanderait un profil qui prouve une
personne. Elle se rend visible et se rattrape (axe 4).

## Les axes d'amélioration

Du plus pressant au moins pressant. Pour chacun : ce qui se passe, ce que ça
coûte, la piste, et le verdict de la contre-expertise. Le détail de chaque
constat (preuve, `fichier:ligne`, reproduction) est dans `constats.json` ;
181 des 190 sont cités ci-dessous, les neuf autres (des doublons, des
détails de mots ou de rendu) ne sont que là.

### 1. Avant le 24 octobre : le filet et Halloween — P2 · S

**La CI rougira pendant les saisons** [tests-1, confirmé et rejoué deux
fois]. `laureatsDeSaison` date une soirée à l'horloge de la machine
(`server/src/core/saisons.ts:26-28`) : du 25 octobre au 1er novembre, du 20
au 26 décembre et du 30 décembre au 2 janvier (heure de Paris), une soirée
jouée par une épreuve ouvre la Citrouille, le Sapin ou le Bouquet, et
`cloture.test.ts:207` et `soiree.test.ts:496`, qui comptent exactement ce
qui tombe à la clôture, échouent. La contre-expertise l'a daté à la
minute : vert le 24 octobre à 23 h 30, rouge le 25 à 0 h 30 (heure de
Paris). Le smoke n'est pas touché. **Piste** : un calendrier des soirées qu'on peut fermer,
comme `ProfileStore.tirageEclat` — `calendrierDesSoirees = { periodeDu }`
dans `core/saisons.ts`, fermé par `banc.ts` et `smoke.ts`, rouvert par
`saisons.test.ts` — et un piège de plus au `CLAUDE.md`. Au passage, les
saisons n'ont d'épreuve ni pour leur seuil de jours, ni pour la soirée à
cheval sur minuit, ni pour « une partie commencée compte » [tests-4].

**La Citrouille « 3 sur 3 » ne tombe jamais** [jour-regles-3, confirmé,
rejoué]. La jauge compte les parties *commencées*
(`core/jour.ts:996-1016`, `:1257-1264`), mais la saison et les paliers ne se
décernent qu'à la dernière réponse ou au podium (`:723`, `:1251-1254`) : un
troisième jour commencé puis laissé (le téléphone qui sonne, minuit qui
passe) affiche « 3 jours sur 3 », et après la période `accorderSaison` ne
trouve plus de saison — perdue pour un an. La moitié L'Assidu est P3 (le
palier attend la partie finie suivante). **Piste** : décerner paliers et
saison dans `commencer`, sous le verrou, quand l'insertion a pris ; ou, dans
`clore`, aux parties inachevées du jour clos.

**La réserve du jour à sec** [exploitation-2, confirmé, revu en P3 — mais
daté]. L'amorce donne 38 questions : 10, 10, 10, 8, puis plus rien du 5ᵉ au
31ᵉ jour, le temps que les premières redeviennent tirables ; pendant ce
temps, chaque profil lit « Il revient demain ». Halloween demande trois
jours de quiz du jour. **Piste** : faire de l'étape 8 de `MISE-EN-LIGNE.md`
(la routine `RESERVE_TOKEN`) une condition du déploiement ; trois lignes
dans « Si ça coince » (réserve vide, jeton refusé, dépôt fermé) ; ne
promettre « demain » que si la réserve tient demain ; journaliser « réserve
à sec ».

### 2. Le jeu solo, juste et exact — P2 · S

**Le podium payé à la mauvaise personne** [jour-regles-2 = concurrence-3,
confirmé, rejoué par deux experts]. `joueursDu` range le classement sous la
révision lue *après* ses lectures en base (`core/jour.ts:874-886`) : une
réponse écrite pendant qu'un autre lit le classement passe pour déjà vue.
Si c'est la dernière de la journée, la nuit lit ce cache (`:1212`) et paie
podium, Champion du jour et laurier au mauvais joueur — Bob rang 2 à 1 600
quand la base dit 1 800 —, définitivement. La fenêtre est étroite (large au
réveil, quand les profils ne sont pas en mémoire). **Piste** : lire la
révision *avant* la requête, et faire lire la base à la nuit. La révision
par jour que propose `perf-serveur-2` (axe 14) ferme les deux d'un coup.

**Après minuit, « pas de quiz aujourd'hui »** [jour-regles-5, confirmé,
rejoué par deux experts]. `suivante` lit le tirage sans le tirer et sans
clore la veille (`core/jour.ts:624-628`) : une partie commencée à 23 h 58
reçoit l'état « aucun », que le téléphone écrit « la réserve de questions
est vide », sans bouton ; et son « Hier » est calculé avant la clôture
(0 XP de podium, pas de laurier). On peut y sauter un jour et casser sa
série. **Piste** : `await this.clorePasses(jour)` avant le verrou, puis
`this.tirage(jour, true)`.

**La nuit et les jours d'avant, en P3** : une nuit interrompue écrit le
podium sans le payer [jour-regles-6 = persistance-5] ; une réponse de
23 h 59 écrite après la clôture contredit le podium figé
[jour-regles-7 = concurrence-7] ; la partie d'hier jamais finie reste « en
cours » dans le classement figé [jour-regles-9] ; le lendemain se relit
avec les règles d'aujourd'hui [jour-regles-10] ; deux tirages concurrents
marquent dix questions posées sans les tirer [jour-regles-17, deux
instances seulement] ; l'annulation n'a pas de retour et laisse un cache à
mi-chemin [jour-regles-11] ; la réserve accepte jusqu'à 120 s par question,
de quoi chercher la réponse [jour-regles-12] ; l'empreinte d'un intitulé
confond symboles, grec et cyrillique [jour-regles-15]. Et le filet : aucun
deuxième seul sur le podium du jour n'est jamais joué, si bien que victoire,
Champion, laurier et carte laissent passer « rang ≤ 3 » [tests-3] ; la
réserve à sec, la vue sans tirage, le classement du mois et la modération
ne sont parcourus par aucune épreuve [tests-5].

### 3. Le jeu solo au téléphone : le métro, le pouce, l'oreille — P2 · S

Le quiz du jour se joue bien sur un réseau stable. Il casse là où on le
joue vraiment : dans le métro, d'un pouce, et pour qui l'écoute.

- **Figée sur « Réponses closes »** [jour-ecran-1, confirmé, rejoué] : à
  l'échéance, la page tente une seule fois `GET /api/jour` et tait l'échec
  (`client/src/views/JourApp.tsx:130-141`) ; hors ligne à ce moment-là,
  elle reste figée même quand le réseau revient (capture
  `03-jour-reponses-closes-figee.png`). **Piste** : réessayer toutes les
  3 s tant qu'une question échue n'est pas révélée, et sur `online`.
- **Le double toucher** [jour-ecran-2, confirmé, rejoué] : « Question
  suivante » est à la place de la grille de la question suivante ; le
  second toucher répond — définitivement — à une question qu'on n'a pas lue
  (capture `04-jour-double-toucher.png`). **Piste** : ignorer les réponses
  400 ms après l'affichage d'une question ; le temps de lecture offert
  (≥ 2,5 s) payant le maximum, cela ne coûte aucun point.
- **L'oreille** [jour-ecran-3 et accessibilite-1, confirmés] : aucune
  région vivante, aucun focus posé ; à l'échéance, la réponse focalisée se
  désactive sans rien dire. La page d'une soirée enveloppe son jeu d'un
  `aria-live` (`PlayerApp.tsx:455`). **Piste** : le focus sur l'intitulé à
  chaque question, sur le bandeau du résultat à la révélation et à
  l'échéance, sur le titre de la fin. Et la correction qui écrit « juste »,
  « faux » ou « sans réponse » [accessibilite-2, P3].
- **Le texte agrandi** [jour-ecran-4, confirmé] : à 130 %, chaque question
  arrive défilée, chrono et « Question n / 10 » hors de l'écran ; la page
  d'une soirée remonte en haut à chaque écran (`PlayerApp.tsx:346-347`),
  pas celle du jour. **Piste** : `window.scrollTo(0, 0)` à chaque écran.

En P3 : « Question suivante » perdue dans un tunnel devient « Temps
écoulé » sur une question jamais vue [jour-ecran-5] ; un refus définitif
s'affiche « touche-la à nouveau » [jour-ecran-6] ; le lendemain d'une
victoire, l'accueil n'a ni laurier ni podium à la première visite
[jour-ecran-7] ; l'écart d'horloge ne se remesure jamais [jour-ecran-8] ;
l'administrateur ne voit ni les réponses signalées ni ce qu'il vient
d'annuler [jour-ecran-9] ; une question annulée se joue en entier puis dit
« La bonne réponse » [jour-ecran-10] ; sans réseau au chargement, pas de
« Réessayer » [jour-ecran-11] ; petites cibles et toasts sur le chrono
[jour-ecran-12].

### 4. La triche au quiz du jour — tension P2 · à arbitrer

**Un second profil souffle les réponses au premier** [jour-regles-1,
annoncé P1, retenu **tension P2**]. Un profil se crée en dix secondes ; il
lit la bonne réponse à chaque révélation et la correction entière dès qu'il
a fini ; les questions et les réponses sont dans le même ordre pour tous :
le vrai profil les recopie sans lire, fait 2 000 points et prend la
première marche, le Sans-Faute, le Champion du jour et le laurier. Des amis
peuvent aussi se souffler « B, D, A, C… ». La contre-expertise l'a rejouée,
et en a mesuré la portée : délibérée, aux enjeux cosmétiques et bornés
(25 XP de podium par jour pris à un honnête, le laurier, à terme Kintsugi
et le Sphinx ; aucun avantage en soirée), et rattrapable avant minuit par
un masquage. Surtout, **mélanger les réponses par profil ne la ferme pas** :
recopiées par leur texte en 2,5 s, elles rapportent toujours 2 000 points
(`reproductions/verification/jour/par-le-texte.test.ts`). La fermer
exigerait un profil qui prouve une personne — contre le profil en dix
secondes à l'entrée d'une soirée — ou de taire la réponse après chaque
question — contre « on apprend ». **Ce qu'on peut faire sans trahir les
partis pris** :
1. la rendre **visible** : un cookie d'appareil aléatoire (sans adresse IP)
   noté sur la partie, et à `/admin` les parties d'un même appareil, avec
   leur ordre et leur écart de score — signaler, jamais exclure d'office
   (la tablette familiale) ;
2. laisser **masquer atteindre hier** : un profil masqué pendant la journée
   de son laurier fait refaire le podium de la veille sans lui, comme une
   soirée retirée ;
3. ne compter dans la « salle » du jour que les parties qui ont répondu
   [jour-regles-4, tension : un joueur seul et un second profil inactif font
   aujourd'hui une salle, podium et laurier sans adversaire] ;
4. le dire dans `README.md` et `RECOMPENSES.md`.

**Le quiz du jour pose les questions des quiz livrés** [invariants-1,
tension] : l'amorce prend les modèles qu'on joue en soirée — le 28
septembre, ce sont les dix questions de « Culture générale », et leur
correction s'ouvre aux profils, qui connaissent ensuite les réponses en
soirée (invariant 8). C'est un choix écrit trois fois (`core/jour.ts:325-332`,
`RECOMPENSES.md` § 5.13, README), qui heurte sa propre raison (« leurs
invités y liraient la prochaine soirée »), mais l'avantage est mince :
38 questions publiques, trois ou quatre jours. Même famille : les questions
à venir se lisent dans la consigne et « les prochains jours » de `/admin`
[jour-regles-13, tension], et le jeton de la réserve lit les questions des
trois semaines à venir alors que la documentation dit qu'il « ne sait
qu'ajouter » [invariants-3, P3].

### 5. Une fin de soirée à la fois, et des gestes qui arrivent — P2 · S à M

**Deux clôtures croisées** [concurrence-1, confirmé, rejoué]. `closeParty`
et `discardParty` posent `fermeture` sans la lire (`server/src/core/space.ts:1407`,
`:1684`) : un second geste pendant les secondes que dure une clôture sur
Turso relit la soirée, passe derrière le premier dans la file, puis
recrédite, réannonce et revide. La télé montre une seconde annonce au
podium vide, la fin gardée n'a plus ni palier ni niveau, l'invité entré
entre les deux est effacé [concurrence-5] ; « C'était un essai » suivi de
« Clore » laisse la soirée archivée et créditée quand la console a affiché
« rien n'a été gardé ». Une clôture reprise après un refus du miroir perd,
elle, l'annonce des légendaires, des Divins et des paliers déjà rangés
[recompenses-comptes-2 et concurrence-4, doublons]. **Piste** : une seule
fin à la fois par espace (le second `closeParty` rend la promesse du
premier, le geste contraire est refusé) ; « Clôture en cours… » à la
console ; l'état « avant » des annonces lu en base.

**Les gestes perdus pendant une reconnexion** [client-3 = concurrence-11,
confirmé, rejoué]. socket.io renvoie ce qu'on a émis hors connexion
*avant* l'évènement `connect`, donc avant `host:hello` : le serveur reçoit
« Clore », « Révéler » ou « Suivant » d'une connexion qui n'est pas encore
l'écran commun, et l'ignore (`requireHost`, `server/src/sockets.ts:700`).
La boîte s'est fermée, la soirée reste ouverte, aucun invité ne reçoit sa
fin. **Piste** : `requireHost` présente la connexion par le cookie de sa
poignée de main, comme `host:hello`, et relit la session à chaque geste —
ce qui ferme aussi la télé qui garde la main après ses 24 heures
[securite-temps-reel-3] ; en attendant, « Clore » et « C'était un essai »
grisés tant que la liaison n'est pas là. Côté invités, `player:action`
règle déjà ce cas en portant son espace et son jeton.

**La réponse dans une liaison morte** [client-1, confirmé, rejoué deux
fois]. `sendPlayerAction` renvoie une fois la réponse sans accusé, mais
aussitôt et par la liaison que socket.io croit vivante
(`client/src/socket.ts:407-411`), sans la sonder comme le fait `demander()` :
jamais reçue en 20 s. Le déclencheur réel : un wifi saturé ou sans
internet, le fond du jardin, un tunnel. **Piste** : sonder la liaison
(`verifierLiaison`) avant le renvoi — livrée à 6,3 s par la copie corrigée.
À la télécommande, « Révéler » se perd de même pendant 14 s [client-2, P3].

**Le prix remis deux fois** [client-5, confirmé, rejoué]. Rien ne rend
« Attribuer » inerte avant l'instantané, et le serveur n'écarte pas le
doublon (`AwardsBoard.tsx:121-127`, `sockets.ts:822-829`) : deux points
d'équipe au lieu d'un, de quoi retourner la victoire. **Piste** : un
identifiant de remise tiré au clic, idempotent au serveur (« Redonner » en
tire un neuf).

En P3 : SIGTERM au milieu d'une clôture n'attend pas, et la soirée revient
« en cours » au réveil [exploitation-4] ; l'effacement du miroir abouti
mais sans réponse laisse la soirée continuer sur un miroir vide
[persistance-6] ; « C'était un essai » interrompu dit « Rien n'a été
effacé » et le second clic ne recalcule plus le total [persistance-7].

### 6. Les sessions d'emprunt, et les portes — P2 · S

**Une télé appairée, ou un téléphone prêté, prend l'espace**
[securite-portes-1, confirmé, **plus large qu'annoncé**]. La télé branchée
par un code reçoit une vraie session d'animateur, que rien ne distingue
d'une console au niveau des routes : par `/api/space/profil`, qui s'en sert
rattache **son** profil à l'espace, à la place de celui de l'animateur, et
ouvre ensuite la console quand il veut, bien après que la télé est tombée.
Sans script : la télé montre « Mon compte » et son formulaire. La chaîne
d'appairage n'est pas plafonnée (une télé encore ouverte en branche une
autre, repartie pour 24 heures : t0 + 47 h rejoué). La contre-expertise a
trouvé plus simple : le téléphone prêté, console ouverte par le cookie du
profil, fait la même chose sans aucune session de télé
(`reproductions/verification/securite/emprunteur.test.ts`) — la menace que
`/api/joueur/mot-de-passe` ferme déjà. **Piste** : changer le profil qui
tient l'espace demande une preuve fraîche (le mot de passe du profil
rattaché, ou celui du compte) ; refuser les sessions à `fin_max` sur
`/api/space/profil`, `/api/admin/*` et la validation d'un appairage ;
plafonner la chaîne à l'échéance de la source.

**Un mot de passe sans l'ancien** [securite-portes-2, confirmé, rejoué].
`/api/auth/password` exige le mot de passe actuel, mais une session
d'administrateur se forge un lien d'activation pour son propre compte
(`server/src/auth/routes.ts:283`, sans le garde « soi-même » qu'ont
désactiver et supprimer) et l'échange contre un nouveau mot de passe ; la
session qui en sort dure 30 jours, sans `fin_max`. Avec le précédent,
l'administrateur n'a plus de retour sans accès à la base. **Piste** :
refuser son propre compte, masquer « Lien » sur sa ligne, et écrire dans
`MISE-EN-LIGNE.md` que l'administrateur qui oublie son mot de passe passe
par son profil rattaché.

**Le verrou de connexion traversé en rafale** [concurrence-2, confirmé,
rejoué]. Le verrou « cinq échecs par identifiant » se lit avant l'attente
de scrypt et ne se compte qu'après (`server/src/auth/http.ts:147-166`) :
dix-neuf faux essais lancés ensemble, puis le bon mot de passe accepté ; et
autant de fois vingt que l'attaquant a d'adresses. Toutes les portes :
compte, profil (qui ouvre aussi sa console), code de secours, changement
de mot de passe. **Piste** : compter les essais en vol comme des échecs
jusqu'au jugement, libérés dans un `finally`. C'est l'autre face d'une
tension : le verrou par identifiant permet à qui connaît un identifiant de
le bloquer [securite-portes-3, voulu et écrit dans `auth/http.ts:128-131`].

En P3 : un fauteur de troubles qui connaît l'adresse de la soirée épuise
les essais de « Rendre sa place » de toute la salle, le compteur étant
commun à l'espace (`core/places.ts:83`) [securite-temps-reel-1, revu de P2
en P3] ; le récit d'un Divin part vers toute session du compte, la télé
branchée chez un tiers comprise [recompenses-vitrine-5] ; une connexion en
vol pendant un changement de mot de passe garde sa session
[concurrence-8] ; le code de secours sert deux fois en même temps
[concurrence-9] ; « Recevoir par un code » ne tient pas ses dix essais en
rafale [concurrence-10] ; la réserve d'essais ne vieillit jamais
[exploitation-8] ; aucun plafond de fréquence par connexion sur
`player:action`, `party:watch`, `time:sync` [securite-temps-reel-4, idée].
Et le filet : 17 des 19 routes réservées à l'administrateur n'ont aucune
épreuve qui refuse un animateur ordinaire — retirer `requireAdmin` de
`/api/admin/jour/masquer` ne fait rougir aucune épreuve [tests-2] ;
`admin-seulement.test.ts` lit la liste dans le code, comme
`garde-fous.test.ts` pour les commandes `host:*`.

### 7. Le barème et les pannes : ce que l'historique garde de travers — P2 · S

**Le prochain `VERSION_BAREME` ferait tout relire à chaque réveil**
[recompenses-comptes-1, confirmé, rejoué]. `remettreAuBareme` remet la
ligne `#jour` au barème par `json_set(detail, '$.v', ?)` : le nombre part
lié en flottant, SQLite écrit `{"v":6.0,…}`, que `aRecalculer` (qui cherche
`'{"v":6,%'`, `server/src/auth/profiles.ts:1703-1708`) retrouve à chaque
démarrage. Mesuré : 3,0 s et 345 requêtes à chaque démarrage au lieu de
1,2 s et 60, pour trente soirées à 20 ms l'aller-retour ; et pour toujours,
tant que ces profils ne rejouent pas au quiz du jour. Latent tant que le barème reste à 6. **Piste** :
`CAST(? AS INTEGER)` ; et une épreuve qui vérifie que `aRecalculer()` ne
rend rien après un démarrage.

**Une panne passagère pendant le recalcul fige l'ancien barème**
[exploitation-1, confirmé]. Au démarrage qui relit l'historique, un échec
de Turso sur la lecture d'une archive est pris pour une archive illisible :
la soirée est remise à la version du jour sans avoir été relue, et ne le
sera jamais (`core/recalcul.ts:119-157`). **Piste** : relancer l'erreur
quand `pourquoiInjoignable(e)` la reconnaît (le démarrage échoue, Render le
relance) ; garder « à relire » une archive vraiment illisible.
**À livrer dans le même commit que la précédente** : aujourd'hui,
`recompenses-comptes-1` fait tout relire à chaque démarrage et masque
celle-ci ; corrigée seule, elle la rendrait permanente
(`reproductions/verification/donnees/recalcul-masque.test.ts`).

**Les saisons ne se relisent pas** [invariants-2 = recompenses-comptes-7,
confirmé] : #59 a fait dériver les saisons des journaux des soirées sans
monter `VERSION_BAREME` (invariant 20) — les soirées déjà rangées ne sont
pas relues, et le prochain barème les fera tomber par surprise. À monter
**après** les deux corrections précédentes.

**Retirer une soirée pendant un hoquet** [persistance-2, confirmé, rejoué].
La route efface l'archive, *puis* reprend aux profils ce qu'elle leur avait
crédité (`server/src/api.ts:440-442`) ; si la seconde étape échoue, un
second essai répond « Soirée introuvable » et les profils gardent
expérience, prix, hauts faits et paliers pour toujours. **Piste** : lire
l'archive, retirer aux profils, effacer l'archive en dernier.

En P3 : un invité exclu pendant un hoquet garde l'expérience et l'Éclat de
la soirée — l'invariant 10 cède sur une panne [persistance-3, revu de P2] ;
un palier tombé pendant un hoquet ne rapporte jamais son expérience
[persistance-4] ; `ProfileStore` n'a pas de verrou par profil, et deux
clôtures rangent et fêtent le même palier deux fois [recompenses-comptes-3] ;
retirer la soirée où un palier est tombé le reprend même quand les autres
le méritent [recompenses-comptes-4] ; une saison ouverte d'abord par une
soirée se perd avec elle, malgré les jours de quiz du jour qui la méritent
[recompenses-comptes-5 = jour-regles-8] ; l'expérience du jour est gardée,
pas dérivée [jour-regles-16] ; après un redémarrage sur disque gardé, rien
ne recomplète le miroir [persistance-8, jamais sur Render].

**Un déploiement pendant une soirée** [persistance-1, **incertain**]. Le
défaut du code est rejoué : rien ne sépare deux écrivains du même miroir,
et une nouvelle instance qui démarre pendant que l'ancienne sert encore la
salle fait payer une question deux fois au réveil suivant (398 → 597
points, deux réponses par invité, une invitée fantôme). Reste à savoir si
Render fait vraiment se chevaucher les deux instances sur l'offre
gratuite : sa documentation le décrit pour tout service web sans disque.
**Pour trancher, dix minutes sur la préproduction** : une websocket ouverte,
un quiz à 90 s, « Manual Deploy », `/healthz` toutes les 2 s, et comparer
dans les journaux « rechargés après redémarrage » (la nouvelle) à
« extinction demandée » (l'ancienne) — la procédure est dans
`verification/donnees.md`. D'ici là, `MISE-EN-LIGNE.md` interdit déjà de
déployer en soirée. **Piste** si c'est confirmé : recharger le miroir à la
première vraie requête, prendre alors un bail sur le miroir, et faire taire
l'ancienne instance dès qu'un lot est refusé.

### 8. La télé muette quand on anime à la télécommande — P2 · S

[client-4, confirmé, rejoué.] Le contexte audio ne naît que de trois clics
sur la page même (`client/src/sound.ts:31-68`, `HostApp.tsx:664, 694,
1554`). Quand on anime au téléphone, la télé — celle qui doit sonner — ne
voit jamais ces clics : ni 3-2-1, ni tic-tac, ni révélation, ni fanfare,
toute la soirée, avec l'icône « son allumé ». **Piste** : `pointerdown` et
`keydown` en capture qui appellent `initAudio`, et, dans `tone()`, un
`initAudio()` si `navigator.userActivation.hasBeenActive` ; pour la télé
branchée par un code, « touche l'écran pour le son ».

### 9. Les équipes : le fantôme compte encore — P2 · S

[moteur-1, confirmé, rejoué par les vraies commandes.] À chaque révélation,
`logQuestion` écrit « présent, sans réponse, 0 point » pour tout
participant qui pouvait jouer (`server/src/games/quiz.ts:866-869`), sans
regarder s'il est dispensé ni hors ligne : la fiche du téléphone mort
qu'on n'attend plus, et le second Rachid laissé après « Rendre sa place »,
pèsent sur la moyenne de leur équipe — Rouges 600, Bleus 800, à jeu égal.
**Déjà vu le 24 septembre** (salons de Marc et Léa, constat 3), la PR #49
ne l'a pas corrigé, et la parade de l'animateur (sortir le fantôme de
l'équipe) ne marche plus depuis que chaque ligne fige son équipe. Cela
contredit la règle publiée (« les membres qui l'ont eue sous les yeux »).
**Piste** : écarter du journal le dispensé hors ligne qui n'a pas répondu.
Même famille, en P3 : arrivé au podium, on monte sur le podium d'une
petite salle [moteur-2] ; arrivé pendant le souffle d'une question, on a
600 ms pour lire, puis un zéro au journal et dans la moyenne de son équipe
[moteur-3].

### 10. L'éditeur qui perd du travail — P2 · S à M

- **Au-delà de cent questions** [bibliotheque-1, annoncé P1, retenu P2] :
  l'éditeur laisse écrire, coller et dupliquer au-delà de `MAX_QUESTIONS` ;
  le serveur coupe à cent et répond 200, et l'éditeur oublie son brouillon.
  Même coupe muette à l'import d'un fichier. Rien du chemin normal ne mène
  à 101 (modèles de 8 à 15 questions, consigne d'IA plafonnée à 100) : il
  faut coller deux listes dans un même quiz. **Piste** : refuser avant de
  couper, borner « Ajouter », « Insérer » et « Dupliquer », annoncer le
  trop-plein.
- **Une photo sur la voisine** [bibliotheque-2] : `pickImage` attend
  l'envoi puis patche la question *par sa position* du moment du clic
  (`EditorApp.tsx:2641`) : une question montée pendant l'envoi, et la photo
  tombe sur celle qui a pris sa place. **Piste** : patcher par identifiant.
- **« Garder la mienne » garde une photo effacée** [bibliotheque-3] : le
  délai de grâce du ménage compte depuis l'envoi de la photo
  (`quizStore.ts:27, 360-366`) ; après un conflit, la version gardée cite
  une photo que le ménage vient d'effacer. **Piste** : compter la grâce
  depuis le moment où la pièce devient orpheline.
- **Le brouillon ne vérifie qu'une pièce sur trois** [bibliotheque-4] :
  `photosAVerifier` ne lit que la photo de la question
  (`shared/brouillon.ts:98-120`) — le piège « Une question a trois pièces à
  part » retombé : repris le lendemain, la révélation est cassée et le
  blind test muet, sur une question « prête ». **Piste** : parcourir
  `PIECES_DE_QUESTION`.

En P3 : « Copier en liste » abîme une anecdote sur plusieurs lignes
[bibliotheque-5, revu de P2], oublie « de côté », l'extrait et la photo de
révélation en promettant le contraire [bibliotheque-6], et fait perdre
leur signe à « - de 5 » et « + de 10 » [bibliotheque-7] ; publier une
nouvelle version au catalogue laisse l'ancienne en ligne [bibliotheque-8] ;
une pièce illisible au départ arrive « prête » sans elle [bibliotheque-9] ;
un enregistrement abouti sans réponse fait un faux « autre appareil »
[bibliotheque-10] ; l'export CSV coupe avec `slice()` [bibliotheque-11] ;
une copie au titre long ne se dit pas copie [bibliotheque-12] ; le cache de
la bibliothèque se pose dans l'ordre des réponses de Turso [concurrence-6] ;
deux recherches croisées dans « Mes quiz » [client-6].

### 11. Le téléphone à 320 px et à 130 % — P2 · S

**Les prénoms s'effacent du classement** [design-recompenses-2, confirmé,
**plus large qu'annoncé**]. Une ligne tient rang, avatar, prénom, niveau et
points sur un seul rang, et seul le prénom cède (`styles.css:819`,
`Leaderboard.tsx:71`). L'expert l'avait vu pour les lauréats (le laurier
prend 23 px) ; la contre-expertise l'a trouvé partout : à 277 px (130 % de
texte), un profil ordinaire à 12 450 points n'a plus une lettre de son
prénom, laurier ou pas, et « Camille (2) » perd sa marque dans l'ellipse dès
320 px — l'invariant 17 rendu muet (capture
`01-classement-277-prenoms-effaces.png`). **Piste** : une requête de
conteneur à 250 px qui passe la ligne sur deux rangs ; et une épreuve qui
mesure aussi une ligne ordinaire à cinq chiffres et « Camille (2) ».

En P3 : l'onglet « Carrière » sort de l'écran à 130 % — il reste
atteignable au doigt, mais le changement de mot de passe y vit
[design-recompenses-1, revu de P2 ; capture
`02-profil-277-carriere-hors-ecran.png`] ; à la télé, le laurier se pose
avant le prénom des pastilles et le coupe à deux lettres
[design-recompenses-5] ; les onglets n'ont ni flèches ni panneau
[accessibilite-6] ; la carte d'un joueur laisse filer le focus derrière
elle [accessibilite-3, revu de P2] ; choisir un avatar ou sa vitrine fait
tomber le focus [accessibilite-5] ; bronze, argent et or ne se distinguent
qu'à la couleur [accessibilite-7] ; le laurier se dit deux fois
[accessibilite-9] ; les emojis de collection fermés font des trous noirs à
1,1:1 [design-recompenses-3] ; le titre pâlit sur l'aurore et le contenu
défile sur le rideau du théâtre [design-recompenses-6, accessibilite-8] ;
ce qui reste à gagner s'écrit à 2,3:1 [design-recompenses-8] ; l'accueil
d'un profil saute de 233 px quand la carte du quiz du jour arrive
[perf-client-3].

### 12. Ce que les récompenses montrent — P3 · S

La vitrine est étanche là où elle écrit (chaque champ relu contre ce qui
est gagné) ; elle fuit là où elle relit. Le bronze retiré avec sa soirée,
l'argent resté, titre et vitrine tombent et le serveur refuse ce que la page
propose [recompenses-vitrine-2] ; l'emoji de collection entré dans une
soirée n'est plus relu — le paon à côté de « Niv. 1 » [recompenses-vitrine-4] ;
un `player:join` forgé fait porter un emoji de collection réservé, parce
que `peutPorter` juge l'avatar avant `cleanAvatar` (`sockets.ts:407`)
[securite-temps-reel-2] ; le sondage à la télé, la remise des prix et « ont
gagné hier » montrent l'emoji caché sous un légendaire
[recompenses-vitrine-6], et la page du compte calcule l'Éclat sur lui
[recompenses-vitrine-7] ; un avatar forgé d'Unicode 13 fait un carré vide
sur la télé [recompenses-vitrine-8] ; le laurier de minuit ne rejoint pas
le podium resté à l'écran [moteur-12] ; « Ma finition » montre l'emoji
caché [design-recompenses-7] ; au podium, le légendaire du vainqueur paraît
plus petit que l'emoji du troisième [design-recompenses-11] ; quelques
incohérences de détail [recompenses-vitrine-11]. Les seuils des écussons ne
sont épinglés par aucune épreuve [tests-7].

### 13. Que la soirée et le quiz du jour se parlent — P2 / P3 · S

Le profil relie bien les soirées (neuf des douze constats du 24 sont
corrigés), et le chemin anonyme reste intact. Mais la soirée et le quiz du
jour s'ignorent.

- **Le lien `/jour` reçu par un anonyme** [parcours-profil-3, P2] n'offre
  que « Me connecter à mon profil » ; une fois le profil créé, on atterrit
  sur l'accueil : huit touchers et deux saisies du lien avant la première
  question. **Piste** : « Créer mon profil et jouer »
  (`/?creer=1&next=/jour`), `next` lu par `shared/securite.ts`.
- En P3 : la fin de soirée d'un profil ne dit rien du quiz du jour ni de la
  série qu'elle vient d'allonger [parcours-profil-1] ; la fin de partie ne
  donne pas rendez-vous, et le laurier n'est annoncé ni avant (« reste en
  tête jusqu'à minuit… ») ni après (« tu portes le laurier aujourd'hui »)
  [parcours-profil-2] ; le lendemain s'ouvre sur « 3ᵉ place sur 3 · 0 pt »,
  contre la règle de la course [parcours-profil-4] ; la carte, seule vitrine
  des cosmétiques, ne s'ouvre qu'en soirée [parcours-profil-5] ; la série
  ne prévient jamais qu'elle tombe à minuit [parcours-profil-6] ; rattacher
  son profil demande de retaper ce qu'on vient de choisir
  [parcours-profil-7] ; le quiz du jour ouvre niveaux, finitions et emojis
  sans les annoncer [recompenses-vitrine-1].
- Les mots : la carte d'un joueur, l'écran le plus touché en pleine partie,
  n'explique aucun de ses mots — le `<Glossaire>` existe déjà [mots-1] ; « la
  réserve », mot d'administration, s'affiche au joueur [mots-5] ; « fond de
  carte » manque au glossaire [mots-6]. L'infobulle proposée pour le laurier
  (`<title>`, [mots-2]) casserait le `textContent` que lit la tablée : la
  contre-expertise l'a prouvé — passer par `aria-label` et un `title` sur le
  conteneur.

### 14. Le quiz du jour sur Turso, et les animations — P3 · S à M

Côté serveur, les comptes sont exacts, mais la contre-expertise les a
ramenés à l'échelle d'un serveur d'amis :
- au réveil, les joueurs d'hier se chargent un par un (trois allers-retours
  chacun, huit à la fois), sous le verrou de la nuit que l'accueil attend
  aussi : 12 s à 500 joueurs et 50 ms par aller-retour, **1,5 s** à
  l'échelle d'amis [perf-serveur-1, revu de P2]. **Piste** : `byIds` par
  paquets (1 543 → 50 allers-retours, prototypé) ;
- chaque réponse du jour périme le classement figé d'hier, que « Question
  suivante » relit deux fois : 60 % des lignes lues à l'heure de pointe
  [perf-serveur-2, revu de P2]. **Piste** : une révision par jour, lue
  avant la lecture — elle ferme aussi l'axe 2 ;
- l'accueil d'un profil rapatrie 6 700 lignes [perf-serveur-3] ; une partie
  attend la base 154 fois en série, 0,7 s par question à 50 ms
  [perf-serveur-4] ; « Annuler pour tous » un soir de 500 joueurs fait
  3 019 allers-retours, au-delà des 20 s de la page d'administration — et
  la piste proposée ouvrirait une course entre deux annulations
  [perf-serveur-5] ; le démarrage enchaîne 60 allers-retours en série
  (54 avant #58) [perf-serveur-6 = exploitation-7] ; chaque réveil paie la
  transpilation de `tsx` [exploitation-6] ; `laureats()` recalcule le jour
  de Paris à chaque appel [jour-regles-14].

Côté téléphone : les Divins verrouillés s'animent sans fin dans l'onglet
« Apparence », ouvert par défaut, alors que les légendaires verrouillés sont
figés — `.lg-verrou *` a sa règle, `.dv-voile` n'en a pas
[perf-client-1, revu de P2 : la page se consulte, elle ne reste pas
ouverte en soirée ; la correction tient en une ligne] ; la grille fait
tourner 219 animations SVG [design-recompenses-4] ; une galerie anime tous
ses médaillons à la fois [perf-client-4] ; le chemin du QR a repris 69 à
259 ms avec #58 et #59 — CSS commun de 137 Ko, carte et fin de soirée
chargées avant l'entrée [perf-client-2] ; l'accueil `/` télécharge les
dessins des médaillons à un anonyme [recompenses-vitrine-9, mesuré par
perf-client-5 : 21 Ko et 179 ms] ; un légendaire fait venir les cinq Divins
[perf-client-6].

### 15. Le moteur : les petites portes — P3 · S

« Qui dans la salle ? » : un candidat exclu devient un bouton « ??? »
[moteur-4], et deux Camille aux avatars différents deux boutons identiques
[moteur-5] ; « Rendre sa place » : la vue arrive avant l'instantané qui
compte la fiche [moteur-6] ; « Révéler » pendant une pause laisse la
révélation « en pause » [moteur-7] ; « au clic » pendant un intertitre
laisse la pastille décompter [moteur-8] ; un palier d'enchaînement
illisible (`NaN`) fait sauter toutes les révélations [moteur-9] ;
`host:launch` ne dit pas ce qu'il remplace, et un « Lancer » parti d'un
second écran arrête le quiz en cours (invariant 12) [moteur-11]. Côté
client : une carte fermée par le quiz se rouvre toute seule après
[client-8] ; un jeton d'une soirée passée fait voir une salle d'attente
vide [client-7] ; « Me déconnecter » dit « déconnecté » quand ça a échoué
[client-9] ; « Copier le lien » ne fait rien hors https [client-12] ;
« Qui manque ? » garde son minuteur toute la soirée [client-11] ; la boîte
« Clore la soirée » attend `soirees.json` sans délai [client-13].

### 16. Les règles écrites, et l'exploitation — P3 · S

**La documentation** : dix phrases du `CLAUDE.md`, du README ou de
`RECOMPENSES.md` que le code ne tient plus [invariants-5] ; la règle de
l'Arbre-Monde écrite dans `RECOMPENSES.md` et le `CLAUDE.md`, alors que
l'invariant 21 garde les règles des Divins au serveur [invariants-4] ; cinq
écarts à la lettre des conventions [invariants-6] ; l'en-tête de
`shared/jour.ts` périmé ; 321 lignes de CSS de #59 en couleurs, tailles et
rayons en dur face aux jetons [design-recompenses-10] ; `rendu-ecran.ts`, le
pire cas de référence, donne à deux anonymes des emojis que la règle leur
refuse [design-recompenses-13] ; une assertion sous condition laisse passer
un fichier d'avant refusé [tests-6].

**L'exploitation** : l'amorce de la réserve interrompue entre son lot et
son drapeau se refait de travers [exploitation-9] ; `/healthz` et le
journal ne disent ni la version qui tourne ni l'état du quiz du jour
[exploitation-10]. Et une tension : la préproduction construite à chaque
fusion (54 en cinq jours) épuiserait les 500 minutes mensuelles de Render —
après quoi, sans moyen de paiement, **plus aucune construction**, production
comprise [exploitation-3] : surveiller « Workspace → Billing », et déployer
la préproduction à la main en période de fusions rapprochées.
`experts/exploitation.md` donne la liste de contrôle d'une mise en
production de #58 et #59.

## Les tensions à arbitrer

Ce que la contre-expertise a reconnu vrai, mais qui heurte un parti pris :
à décider, pas à corriger d'office.

| Constat | La tension | Ce qui est proposé |
|---|---|---|
| Le second profil souffle les réponses [jour-regles-1] | Un profil en dix secondes (« jouer sans compte ») contre un classement juste | Rendre visible, masquer jusqu'à hier, le dire (axe 4) |
| Un joueur seul et son second profil font une salle [jour-regles-4] | L'invariant 19 compte des téléphones, en soirée comme au jour | Ne compter que les parties qui ont répondu |
| Le quiz du jour pose les quiz livrés [invariants-1, jour-regles-13] | Une réserve jamais vide contre l'invariant 8 | Amorcer ailleurs, ou n'amorcer qu'en dernier recours |
| 20 s par question, rien pour en avoir plus [accessibilite-4] | WCAG 2.2.1 contre un quiz classé et payé à la vitesse | « Prendre mon temps » : sans échéance, sans bonus, hors classement |
| Le classement du jour range tous les espaces [parcours-profil-9] | RECOMPENSES (« tout le serveur ») contre le README, qui écarte le classement public entre espaces | Le dire, ou le restreindre |
| Le laurier dans la soirée [parcours-profil-10] | Une distinction gagnée ailleurs, que l'anonyme ne comprend pas | Ne rien ajouter aux lignes ; observer à la prochaine tablée |
| La Légende ne tombe qu'à une clôture [recompenses-comptes-6] | Un palier se juge à la clôture, mais le niveau compte le jour | Choisir |
| Supprimer un compte laisse les crédits [recompenses-comptes-8] | Un choix de produit jamais écrit | L'écrire |
| Un écusson fait seul, montré à la salle [recompenses-vitrine-3] | Une soirée jouée seul ne compte pas, mais nourrit les écussons — et, par le même chemin, les paliers | Écarter de `carriereDe` les soirées qui ne comptent pas (`soireeQuiCompte`), avec la montée de `VERSION_BAREME` |
| Les dessins d'un autre au rechargement [recompenses-vitrine-10] | Le chargement à la demande contre 2,5 s de question perdues au rechargement | Ne pas attendre les dessins pendant une question |
| Le verrou par identifiant [securite-portes-3] | Borner l'attaque contre bloquer le titulaire | Corriger d'abord la rafale (axe 6) |
| Le renommage contre le second appareil d'un profil [moteur-10] | Invariant 8 contre invariant 9 | Garder le renommage de l'animateur |
| Le retour à la version d'avant #58 [persistance-9] | Revenir en arrière range la ligne `#jour` parmi les soirées | Sauvegarder avant de promouvoir, corriger vers l'avant, et une version de schéma qu'une version plus ancienne refuse |
| Les 500 minutes de Render [exploitation-3] | « Zéro euro » contre le rythme des fusions | Préproduction à la main |
| Le quiz du jour à froid [exploitation-5] | « Zéro euro » contre un jeu quotidien | Rien, ou le dire |

### Ce que le propriétaire a tranché, le 27 septembre 2026

Les tensions ci-dessus, et ce qui avait été reporté en route, présentées une
à une avec leurs options (lot 11). « Plus tard » : rien n'est fait.

| | Constat | Choix | Où |
|---|---|---|---|
| D1 | Le second profil souffle les réponses [jour-regles-1] | Plus tard | — |
| D2 | Un joueur seul et son second profil font une salle [jour-regles-4] | Garder | — |
| D3 | Le quiz du jour pose les quiz livrés [invariants-1] | Les questions livrées en dernier recours | `JourStore.tirer`, `jour-reserve.test.ts` |
| D4 | Le jeton lit les questions à venir [invariants-3, jour-regles-13] | Garder, et le dire | CLAUDE.md, MISE-EN-LIGNE.md (étape 8), RECOMPENSES.md |
| D5 | 20 s par question [accessibilite-4] | Rien de plus — mais « Plus que 5 secondes » au lecteur d'écran | `AnnonceDeLaFin`, `jour-telephone.test.ts` |
| D6 | Le classement du jour range tous les espaces [parcours-profil-9] | Tout le serveur, et toucher un nom ouvre sa carte | `/api/joueur/carte/:id`, `soiree-et-jour.test.ts` |
| D7 | La Légende ne tombe qu'à une clôture [recompenses-comptes-6] | La juger aussi au quiz du jour | `paliersDuNiveau`, `jour-paliers.test.ts` |
| D8 | Le renommage contre le second appareil [moteur-10] | Le renommage tient — le prénom ; l'avatar suit toujours le profil | `sockets.ts` (`player:join`), `temps-reel.test.ts` |
| D9 | Arriver dans les dernières secondes [moteur-3] | La suivante, sous le temps de lecture | `tropTardPourLire` (`games/quiz.ts`), `moteur.test.ts` |
| D10 | Le laurier dans la soirée [parcours-profil-10, mots-2] | Une infobulle au survol | `Laurier.tsx` (`.laurier-bulle`), `petit-ecran.test.ts` |
| D11 | Les dessins d'un autre au rechargement [recompenses-vitrine-10] | Ne jamais attendre pendant une question | `PlayerApp.tsx` (`enPleineQuestion`), `medaillons.test.ts` |
| D12 | Un écusson fait seul [recompenses-vitrine-3] | Écarter ces soirées de la carrière | `carriereDe`, `recompenses-montrees.test.ts` — sans monter `VERSION_BAREME` : la carrière se lit à chaque lecture, rien de rangé n'en dépend |
| D13 | Supprimer un compte laisse les crédits [recompenses-comptes-8] | Le demander à chaque suppression | `retirerEspace`, `/admin`, `retrait.test.ts` |
| D14 | Le verrou par identifiant [securite-portes-3] | Garder | — |
| D15 | Rattacher son profil [parcours-profil-7] | Le profil ouvert ici, et son seul mot de passe | `/api/space/profil`, « Mon compte », `emprunts.test.ts` |
| D16 | Le serveur transpilé à chaque réveil [exploitation-6] | L'empaqueter à la construction | `scripts/empaqueter.ts`, `SERVEUR` (`src/racine.ts`), `exploitation.test.ts` — Start Command des deux services à changer par le propriétaire (MISE-EN-LIGNE, étape 7) |
| D17 | Les 500 minutes de Render [exploitation-3] | Des filtres de construction, et la préproduction à la main les semaines chargées | MISE-EN-LIGNE, étape 7 (« Les minutes de construction ») — réglages Render par le propriétaire |
| D18 | Le quiz du jour à froid [exploitation-5] | Rien | — |
| D19 | Le retour à la version d'avant #58 [persistance-9] | Plus tard | — |
| D20 | Un déploiement pendant une soirée [persistance-1] | Observer d'abord, en préproduction | MISE-EN-LIGNE, étape 7 (« Observer un déploiement ») — l'essai par le propriétaire |
| D21 | Les 321 lignes de CSS de #59 [design-recompenses-10] | Les passer aux jetons, dans une PR à part | après la fusion de celle-ci |
| D22 | Les halos dans les listes [perf-client-7] | Les figer | `styles.css` (le gel des listes), `medaillons.test.ts` |

Et une remarque, pour la suite : le lien entre les pages, de joueur à
animateur — on s'y perd quand on a les deux rôles (lot 12).

**Lot 12, fait** — après une carte de toutes les adresses et de leurs
sorties, rejouée dans Chromium : l'accueil de qui anime met « J'anime »
(l'écran commun, ses quiz, son compte, l'historique — la session rouverte si
elle a expiré) au-dessus de « Je joue » (revenir, rejoindre, jouer chez soi),
toujours dans cet ordre, et l'animateur sans profil y retrouve sa carte ;
« Mes quiz », « Mon compte » et les comptes ont la même barre, qui ramène à
l'accueil (`NavAnimateur`) ; l'écran commun y mène aussi, dans son onglet,
et l'accueil qu'il ouvre y ramène ; l'historique le donne à l'animateur ; les
trois pages sans sortie (« Mon compte » en erreur, les comptes pour qui n'est
pas administrateur, un lien d'activation périmé ou incomplet) proposent
l'accueil. Épreuve : `navigation.test.ts`. Reste ouvert, s'il le faut : les
mots (« soirée » pour l'espace et pour l'événement, six noms pour la
console), une adresse courte pour la télé, et la page de jeu qui ne ramène
pas à la console.

## Écarté et incertain

- **Réfuté** : « une panne du serveur à l'entrée se lit “cette adresse ne
  mène à aucune soirée” » [client-10] — la seule lecture faillible est
  rattrapée (`sockets.ts:282`), et un serveur muet fait rejeter
  `watchParty`, que la page tait. Reste un durcissement contre une
  exception de programmation.
- **Incertains** : le déploiement qui fait payer deux fois [persistance-1,
  axe 7 — dix minutes sur la préproduction pour trancher] ; les paillettes
  et les halos qui tournent encore dans les listes [perf-client-7 — l'expert
  lui-même demande une mesure sur un vrai Android].
- **Gravités revues** : dix-huit constats confirmés, dont un P1 → P2
  (bibliotheque-1) et dix-sept P2 → P3 (le réveil à 1,5 s et non 12 à
  l'échelle d'amis, « Carrière » atteignable au doigt, les mots, la reprise
  bloquée par un fauteur de troubles…). Le second P1 annoncé
  (jour-regles-1) est devenu une tension P2 ; quatre tensions et un doublon
  sont descendus de P2 en P3 ; un doublon est remonté de P3 en P2 (le geste
  perdu à la reconnexion, aligné sur `client-3`).

## Ce qui tient — à ne pas casser

- **`ecouter()` et les accusés** : 27 messages sur 27, aucun raccourci dans
  les dix mille lignes neuves ; aucune charge malformée n'a fait tomber le
  processus, et un rejet ne peut plus l'arrêter une fois le serveur prêt.
- **L'étanchéité** : `bindSpace()` une fois pour toutes — une connexion qui a
  suivi A ne lit jamais B ; l'invariant 1 tient dans les vues **et** dans les
  pages publiques en cours de soirée.
- **La visée des gestes** (invariant 12) : dans le fuzz, une commande sur cinq
  était périmée, aucune n'a sauté une révélation ; et les trois journaux se
  tiennent sur 162 000 gestes.
- **Le chrono du jour au serveur** : l'échéance est une heure du serveur,
  rendue la même au rechargement, sur un second onglet ou après un
  redémarrage ; une question expirée paie zéro partout ; minuit et les deux
  changements d'heure tiennent. **L'idempotence à deux étages** (le verrou
  par profil, plus une base qui refuse d'avancer deux fois).
- **Le total d'expérience ne perd jamais une écriture** (`UPDATE … SUM` dans
  le même lot), et un barème monté ne reprend rien au quiz du jour.
- **La vitrine écrit étanche** : chaque champ du profil relu contre ce qui est
  gagné ; une seule décoration pour la salle (`apparenceDe`) ; l'invariant 22
  appliqué au neuf (aucun `niveauPour(` hors de `shared/profil.ts`) ; les
  Divins secrets jusque dans le paquet construit et dans l'arbre
  d'accessibilité (« Un Divin, inconnu »).
- **Le laurier** : dessiné, en `em`, en `--accent-text` (8,6:1 en Velours,
  5,3:1 en Ivoire), jamais coupé par `Coupe`, dit à l'oreille sans entrer
  dans le prénom ; 15 octets par salle, une rediffusion par salle concernée.
- **Les migrations pas à pas** (`ajouterColonne`, 66 pannes sur 66), l'arrêt
  borné à 12 s sous les 30 s de Render, `/healthz` toujours 200 et sans nom ;
  la sauvegarde qui restaure tout.
- **Les copies de quiz entières**, et le protocole d'enregistrement (`base`,
  `jeton`, `essai`) : aucun essai rejoué n'entre en conflit avec son clic.
- **Les garde-fous typés** — `garde-fous.test.ts`, `PART_DES_JOUEURS`,
  `PRIX_INDIVIDUELS` — ont suivi #59 sans qu'on y pense : c'est ce qui fait
  tenir la structure, et le modèle de ce qui manque (les routes
  d'administrateur, le calendrier des saisons).
- **Le banc des tests** : un serveur jetable par fichier, des horloges qu'on
  règle ; dix mutants sur dix-sept tués dans le code récent.
- **Les écrans neufs**, beaux et bien nommés à 360 px au texte normal comme
  sur la télé ; `PITCH_PROFIL` repris partout, l'unité « XP » écrite, le
  jargon expliqué en ligne dans chaque panneau du profil.

## L'ordre de correction proposé

Des lots de la taille d'une PR, chacun avec les épreuves de
`reproductions/` à verser dans `server/test/`.

1. **Avant le 24 octobre** (S) : le calendrier des saisons fermable
   [tests-1, tests-4] ; la saison et les paliers à la partie commencée
   [jour-regles-3] ; la révision par jour, lue avant la lecture, et la nuit
   qui lit la base [jour-regles-2, perf-serveur-2] ; `suivante` après minuit
   [jour-regles-5] ; la routine de la réserve et le message « demain »
   [exploitation-2].
2. **Une fin à la fois, des gestes qui arrivent** (S à M) : une clôture par
   espace [concurrence-1, recompenses-comptes-2, concurrence-4 et 5] ;
   `requireHost` par la poignée de main [client-3, concurrence-11,
   securite-temps-reel-3] ; la sonde avant le renvoi [client-1, client-2] ;
   la remise idempotente [client-5] ; le son de la télé [client-4].
3. **Les portes** (S) : les sessions d'emprunt [securite-portes-1 et 2], la
   rafale [concurrence-2, 8, 9, 10], la reprise par adresse
   [securite-temps-reel-1], le récit du Divin [recompenses-vitrine-5], et
   l'épreuve des routes d'administrateur [tests-2].
4. **Le barème et les pannes** (S, **un seul commit** pour les deux
   premiers) : `CAST(? AS INTEGER)` [recompenses-comptes-1] et le recalcul
   qui relance [exploitation-1] ; puis le retrait dans le bon ordre
   [persistance-2], l'exclusion rejouée à la clôture [persistance-3] ; puis
   seulement, monter `VERSION_BAREME` pour les saisons [invariants-2]. Et
   les dix minutes sur la préproduction [persistance-1].
5. **Le quiz du jour au téléphone** (S) : jour-ecran-1 à 4, accessibilite-1
   et 2, puis jour-ecran-6, 7, 8, 11.
6. **Les équipes et le moteur** (S) : moteur-1, puis moteur-2 à 9, 11, 12.
7. **L'éditeur** (S à M) : bibliotheque-1 à 4, puis 5 à 12, concurrence-6,
   client-6.
8. **Le petit écran et les récompenses** (S) : design-recompenses-2, puis
   les axes 11 et 12.
9. **Le liant entre la soirée et le jour** (S, avec des choix de produit) :
   axe 13.
10. **La performance du jour et des animations** (S à M) : axe 14 — la ligne
    `.dv-voile *` d'abord.
11. **Les arbitrages** : le tableau des tensions, à trancher par le
    propriétaire du dépôt.

## Ce que l'analyse a appris sur elle-même

- **Des experts du code trouvent ce que la tablée ne voit pas.** Aucune
  soirée jouée par des agents n'aurait croisé deux « Clore », une rafale de
  vingt mots de passe, un flottant dans un `json_set` ou une révision lue
  après un `await`. Les deux approches se complètent : la tablée pour le
  ressenti, les audits pour les courses et les pannes.
- **La contre-expertise vaut son coût.** Un seul constat réfuté sur 190,
  mais dix-huit gravités revues — dont les deux P1 —, dix-huit doublons
  rapprochés d'un rapport à l'autre, seize tensions séparées des bugs, et
  des constats **élargis** : la session d'emprunt qui n'a pas besoin d'une
  télé, les prénoms effacés même sans laurier, la triche que le mélange des
  réponses ne ferme pas, deux corrections qui doivent partir ensemble.
- **La limite d'usage** a coupé l'analyse deux fois, à quinze agents puis à
  sept. Les agents coupés se reprennent sans rien perdre, leur dossier est
  sur disque : c'est la bonne façon de faire. Mais au-delà de sept agents à
  la fois, la réserve de cinq heures tient moins d'une heure ; la section
  « Les audits de code » de `SKILL.md` le dit.
- **Une reproduction qui échoue aujourd'hui** est la meilleure forme de
  constat : 147 ont été rejouées, et leurs épreuves sont prêtes pour les
  corrections.

## Qui était là

| Expert | L'angle | Constats | P2 confirmés | P3 confirmés | Contre-expertise |
|---|---|---|---|---|---|
| `securite-portes` | les routes HTTP | 4 | 2 | 0 | `securite` |
| `securite-temps-reel` | les sockets, l'étanchéité | 4 | 0 | 4 | `securite` |
| `jour-regles` | le jeu solo : règles, triche, minuit | 17 | 3 | 11 | `jour` |
| `jour-ecran` | le jeu solo au téléphone | 12 | 4 | 8 | `jour` |
| `recompenses-comptes` | ce qui se crédite et se reprend | 8 | 1 | 2 | `recompenses` |
| `recompenses-vitrine` | ce qui s'affiche, et à qui | 11 | 0 | 9 | `recompenses` |
| `design-recompenses` | les récompenses à l'écran (et le système de design) | 13 | 1 | 11 | `ecrans` |
| `moteur` | phases, chronos, points | 12 | 1 | 10 | `soiree` |
| `concurrence` | les courses, les promesses orphelines | 11 | 2 | 5 | `soiree` |
| `persistance` | deux bases, un miroir, les migrations | 9 | 1 | 5 | `donnees` |
| `exploitation` | la mise en ligne, l'heure, la durée | 10 | 1 | 6 | `donnees` |
| `invariants` | les règles du `CLAUDE.md` | 6 | 0 | 5 | `client` |
| `client` | le navigateur | 13 | 4 | 8 | `client` |
| `bibliotheque` | les quiz qu'on écrit et partage | 12 | 4 | 8 | `client` |
| `tests` | le filet | 7 | 1 | 6 | `mesures` |
| `perf-serveur` | le serveur, Turso, le quiz du jour | 6 | 0 | 5 | `mesures` |
| `perf-client` | le chargement et le rendu | 7 | 0 | 5 | coordinateur |
| `accessibilite` | les écrans neufs | 10 | 0 | 7 | `ecrans` |
| `mots` | les textes neufs | 7 | 0 | 5 | `ecrans` |
| `parcours-profil` | le profil, fil quotidien | 11 | 1 | 7 | `mesures` |
| **Total** | | **190** | **26** | **127** | 9 |

Vingt experts et huit contre-experts, en agents ; une contre-expertise par
le coordinateur. L'accessibilité, les mots et le parcours du profil ont
travaillé sur une régie d'atelier (`npm run tablee -- --sans-build --fiche
…`), les autres sur leur propre serveur jetable.
