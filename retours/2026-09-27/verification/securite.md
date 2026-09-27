# Contre-expertise — groupe `securite` (securite-portes, securite-temps-reel)

Code relu : `main`, b57035c (HEAD a9ddd7f ne touche que `.claude/skills/tablee/`).
Toutes les reproductions des deux experts ont été relancées, une à la fois,
sous `nice -n 10` ; trois reproductions à moi dans
`export/evaluations/verification/securite/`.

## Le tableau

| Constat | Annoncé | Verdict | Retenu | En une ligne |
|---|---|---|---|---|
| securite-portes-1 — une session appairée rattache un profil étranger : prise de l'espace pour de bon | P2 | **confirmé** | P2 | Rejoué (4/4 en échec pour la raison dite) ; le trou est plus large que la télé : le téléphone prêté fait la même chose sans aucune session à `fin_max`, et le garde proposé ne le voit pas |
| securite-portes-2 — l'administrateur se forge un lien d'activation pour lui-même, sans l'ancien mot de passe | P2 | **confirmé** | P2 | Rejoué ; même menace que celle que `/api/joueur/mot-de-passe` ferme déjà pour le profil (`profileRoutes.ts:328`) ; seconde porte vers la même persistance que portes-1 |
| securite-portes-3 — verrou par identifiant, d'où que viennent les essais | P3 tension | **tension** | P3 | Voulu et écrit (`auth/http.ts:128-131`, pas `CLAUDE.md` comme dit) ; ne pas l'assouplir avant concurrence-2, qui montre l'inverse (le verrou passe en rafale) |
| securite-portes-4 — clés de limitation sur la dernière entrée de `x-forwarded-for` | P3 | **doublon** | P3 | Déjà la question ouverte de `MISE-EN-LIGNE.md:168-172`, avec sa vérification au journal ; et l'« évasion » annoncée est fausse : derrière un proxy qui ajoute, la dernière entrée ne se choisit pas |
| securite-temps-reel-1 — un griefeur bloque « Rendre sa place » avec le seul slug | P2 | **confirmé, gravité revue** | P3 | Rejoué ; le blocage d'une minute est voulu et testé ; ce qui est neuf, c'est que le code neuf de l'animateur (l'issue prévue) ne sauve pas d'un griefeur actif. La correction proposée (par adresse) ne tient pas dans une fête : griefeur et victime sont derrière la même box |
| securite-temps-reel-2 — un `player:join` forgé porte un emoji de collection | P3 | **confirmé** | P3 | Rejoué (2 échecs, témoin vert) ; cosmétique, client forgé seulement ; meilleure correction : retirer aussi les demi-paires (`\p{Cs}`) dans `cleanAvatar` |
| securite-temps-reel-3 — une télé expirée garde la main tant que sa connexion tient | P3 | **confirmé** | P3 | Rejoué **de bout en bout** (vraie télé appairée, vraie connexion, 25 h plus tard : `/api/auth/me` 401, `host:hello` refusé, mais l'équipe se crée) ; même correction que concurrence-11 / client-3 |
| securite-temps-reel-4 — aucun plafond de fréquence par connexion | P3 idée | **confirmé** (idée) | P3 | Tient à la lecture ; durcissement, rien de mesuré |

**Compte** : 5 confirmés (dont une idée), 1 confirmé à gravité revue, 1 tension,
1 doublon, 0 réfuté, 0 incertain.

## Méthode

- **Relancé** (`cd server && nice -n 10 node --import tsx --test --test-timeout=120000 …`) :
  `securite-portes/sessions.test.ts` (4 échecs, raisons annoncées),
  `securite-portes/defenses.test.ts` (9/9 verts), `securite-temps-reel/reprise-dos.test.ts`
  (échec annoncé), `avatar-de-collection.test.ts` (2 échecs, témoin vert),
  `host-sans-revalidation.test.ts` (échec annoncé), `pages-en-cours.test.ts` (vert).
- **Écrit** (dans `export/evaluations/verification/securite/`) :
  - `tele-expiree.test.ts` — securite-temps-reel-3 sans doublure : échoue aujourd'hui ;
  - `reprise-griefeur.test.ts` — ce que coûte le blocage de securite-temps-reel-1
    (une connexion, une connexion neuve par minute, le code neuf de l'animateur) :
    trois constats qui passent, ils mesurent ;
  - `emprunteur.test.ts` — securite-portes-1 par le téléphone prêté, sans télé :
    échoue aujourd'hui.
- **Lu** : `auth/routes.ts`, `auth/appairage.ts`, `auth/store.ts` (sessions,
  `linkProfile`, `resolveSession`, `retirerSessions`), `auth/http.ts`
  (`LoginBudget`, `requireAccount`), `auth/profileRoutes.ts` (`ouvrirConsole`,
  `/api/joueur/console`, `/api/joueur/mot-de-passe`), `sockets.ts` (`clientIp`,
  `player:join`, `player:reprendre`, `host:hello`, `requireHost`),
  `core/places.ts` et son historique (`git show 9c757da`),
  `shared/avatars.ts`, `auth/profiles.ts` (`peutPorter`, `avatarPorte`, mise à
  jour d'avatar), `core/party.ts` (`join`), `server.ts` (socket.io, `trust proxy`),
  `client/src/views/HostApp.tsx` (boutons de la télé), `AdminApp.tsx`,
  `server/test/telephone-perdu.test.ts`, `appairage.test.ts`,
  `MISE-EN-LIGNE.md` (§4, §5, §168-173), et tous les JSON de
  `export/evaluations/rapports/` pour les doublons.
- Horloge : les deux épreuves qui avancent le temps ne le font que pour le
  serveur. Avancé pour tout le processus, le client socket.io du test croit à
  un minuteur étranglé (`engine.io-client`, `_hasPingExpired`), se reconnecte,
  et la commande part sur une connexion neuve qui ne s'est pas présentée —
  c'est ce qui avait empêché l'expert de rejouer le constat 3 de bout en bout,
  et ce qui a fait passer ma première version à tort.

## Constat par constat

### securite-portes-1 — confirmé, P2 (et plus large qu'annoncé)

**Reproduction.** `sessions.test.ts` échoue aujourd'hui pour la raison dite :
« rattachement depuis la télé : 200 · console de l'intrus à t0+48 h : 200
(chez-bruno) » ; la chaîne : « fin_max … : 47 · seconde télé à t0+25 h : 200 ».
Elle passe par les vraies routes (`/api/auth/appairage`, `…/valider`,
`…/attente`, `/api/space/profil`, `/api/joueur/console`), comme le client.

**Le chemin.** `POST /api/space/profil` (`routes.ts:205`) : `requireAccount`
puis la vérification du **profil** qu'on rattache — rien sur la session
(`fin_max`, `profileId`). `linkProfile(me.id, found.id, sessionOf(res))`
(`routes.ts:231`, `store.ts:257`) remplace `accounts.profile_id` et ferme les
consoles de l'ancien profil, sauf celle qui fait le geste. Aucune garde
manquée : `requireAccount` ne distingue aucune sorte de session.

**Sans script.** La télé branchée montre « Mon compte » (`HostApp.tsx:1451`,
aucune condition sur `me.branchee`), qui porte le formulaire « Rattacher mon
profil » (`AccountApp.tsx:182`) : quelqu'un devant la télé du bar, le
lendemain, n'a qu'à cliquer et taper les identifiants de son propre profil.

**Plus large que la télé.** `emprunteur.test.ts` : le téléphone prêté, profil
de l'administrateur connecté — un clic « Animer » (`/api/joueur/console`), puis
« Rattacher mon profil » avec ceux de l'emprunteur :
`rattachement depuis la console prêtée : 200 · console d'Antoine par son profil
ensuite : 403 · console de l'emprunteur chez lui : 200 · /api/admin/accounts : 200 ·
sessions à fin_max : 0`. C'est exactement la menace que le code nomme et ferme
pour le mot de passe du profil (`profileRoutes.ts:328` : « un téléphone se prête
en soirée : … Le profil était perdu pour de bon — et avec lui la console de
l'espace qu'il anime, celle de l'administrateur si c'est la sienne »). Le garde
proposé (`refuserEcran`, 403 si `finMax != null`) ne le voit pas.

**La réalité.** Il faut un tiers malveillant devant la télé dans les 24 h, ou
un emprunteur malveillant : un concours de circonstances (P2), mais le code
lui-même dit que la télé est « souvent celle de quelqu'un d'autre »
(`appairage.ts:195`) et qu'un téléphone se prête. Le dommage est durable :
l'espace (ou le serveur, si c'est l'administrateur) change de main ; le
propriétaire ne le reprend qu'avec le mot de passe du compte, que la « porte
unique » l'invitait à oublier.

**Meilleure correction.**
1. Changer le profil qui tient l'espace (POST quand un profil est déjà
   rattaché, et DELETE) demande une preuve fraîche, comme
   `/api/joueur/mot-de-passe` : le mot de passe du profil actuellement rattaché
   (ou celui du compte). Une console ouverte au mot de passe du compte garde
   le geste simple ; celle ouverte par un profil prouve ce profil-là.
2. Aucune session à `fin_max` ne rattache, ne détache ni ne valide
   d'appairage (le garde « écran » de l'expert, qu'il faut garder en plus : la
   télé d'un espace sans profil rattaché pourrait sinon poser le premier).
3. La chaîne : `dureeMax: Math.min(TELE_BRANCHEE_MS, (source.finMax ?? Infinity) - Date.now())`
   dans `appairage.ts:198` — ou le refus du point 2, qui suffit.
Test de la correction : `sessions.test.ts` (épreuves 3 et 4) et `emprunteur.test.ts`.

### securite-portes-2 — confirmé, P2

**Reproduction.** Rejouée : « lien d'activation pour soi : 200 · activation :
200 · console d'Antoine ensuite : 401 · ancien mot de passe : 401 · nouveau :
200 » ; par le cookie du profil : « /api/auth/password sans l'actuel : 400 · lien
d'activation pour soi : 200 ». Vraies routes.

**Le chemin.** `POST /api/admin/accounts/:id/activation` (`routes.ts:284`) ne
refuse que le compte en pause ; la désactivation et la suppression refusent
« son propre compte », pas lui. `/api/auth/activate` (`routes.ts:145-164`)
change le mot de passe, ferme toutes les sessions, en ouvre une de 30 jours
sans `fin_max`. `AdminApp.tsx:136` montre « Lien » sur sa propre ligne. Pas de
garde manquée.

**La réalité.** Le seul administrateur, une session à lui dans d'autres mains
(télé appairée, téléphone prêté). Dans cette situation l'intrus a déjà
beaucoup (réinitialiser les autres comptes, en désactiver puis supprimer) ;
ce que ce constat ajoute, c'est la **persistance** et l'**éviction** du
propriétaire — la même chose que portes-1 par une autre porte, et le
cumul des deux ne laisse plus aucun retour sans accès à la base. P2 tient.
Le défaut heurte un choix explicite : `/api/auth/password` exige l'actuel pour
qu'« une session volée » ne change pas le mot de passe (`routes.ts:174-176`).

**Nuance.** Le lien pour soi est aussi, de fait, le seul recours de
l'administrateur qui a oublié son mot de passe et garde une console ouverte
(MISE-EN-LIGNE.md:224 parle des comptes des amis). Le refus pur le lui retire ;
c'est acceptable (il lui reste le profil rattaché et son code de secours),
mais à dire dans MISE-EN-LIGNE.md.

**Correction.** Celle de l'expert (refus si `target.id === accountOf(res).id`,
« Lien » masqué sur sa ligne), plus le garde « écran » de portes-1 : les deux
constats se corrigent ensemble.

### securite-portes-3 — tension, P3

Le verrou « cinq échecs, un quart d'heure, d'où que viennent les essais » est
écrit tel quel dans `auth/http.ts:128-131` (l'expert l'attribue à `CLAUDE.md`,
où il n'est pas). Il se relance sans fin : `failed` remet le compte à zéro en
posant le verrou (`http.ts:156-160`), donc cinq essais par quart d'heure depuis
une adresse suffisent. Mais il faut connaître l'identifiant (ni la carte ni les
pages publiques ne le donnent), les sessions ouvertes tiennent, et pour un
compte rattaché la porte du profil a sa propre clé (`joueur:`). À arbitrer.

**Doublon partiel à croiser** : concurrence-2 (P2) montre le défaut inverse —
en rafale, le verrou laisse passer vingt essais par adresse. Toute
correction de celui-ci (seuil plus haut) doit venir **après** celle de
concurrence-2, sinon elle ouvre la force brute.

### securite-portes-4 — doublon, P3

`MISE-EN-LIGNE.md:168-172` pose déjà la question, avec la même analyse et la
ligne de journal qui y répond (« x-forwarded-for : 1 entrée »). Et la moitié
« un client choisit son adresse » ne tient pas : avec `trust proxy 1`
(`server.ts:196`) et `clientIp` (`sockets.ts:124-130`), on lit l'entrée écrite
par le proxy le plus proche. Plusieurs proxys qui ajoutent chacun la leur
donneraient l'adresse d'un proxy — une réserve **partagée**, pas une adresse
**choisie** ; l'usurpation demanderait de joindre l'instance sans passer par
Render, ce que l'hébergeur ne permet pas. Le risque réel (des refus pour une
grande salle) est celui que la documentation surveille déjà.

### securite-temps-reel-1 — confirmé, gravité revue P2 → P3

**Reproduction.** `reprise-dos.test.ts` échoue pour la raison dite (« Trop
d'essais ici — réessaie dans une minute »). Le chemin est celui du client :
`player:reprendre` ne demande que le slug (`sockets.ts:496-527`), le compteur
d'espace est lu avant le code (`places.ts:86`).

**Ce qui est voulu.** Le blocage n'est pas un oubli : `9c757da` l'a choisi pour
borner la force brute à quinze essais par code, et
`server/test/telephone-perdu.test.ts` le garde — « L'espace aussi a trop manqué
cette minute : un autre téléphone patiente » (l. 400-403), et même « un
plaisantin qui tape sans relâche … trois minutes durant » laisse l'espace à
`trop` jusqu'à la fin du code (l. 654-660). L'issue prévue : l'animateur fait
paraître un code neuf, qui rend ses essais à l'espace (`places.ts:74-75`).

**Ce qui est neuf** (`reprise-griefeur.test.ts`) :
- une connexion seule ne bloque qu'une minute — son propre plafond de cinq
  l'arrête ensuite (« une connexion, après une minute : … bon code : ok=true ») ;
- une connexion neuve par minute prolonge le blocage (deux minutes de suite
  refusées) ;
- le code neuf rend aussi ses cinq essais **à chaque connexion du griefeur**
  (`sockets.ts:507-510`), qui remplit l'espace aussitôt : « après le code neuf,
  le même griefeur (même connexion) : bon code → Trop d'essais ici ». L'issue
  prévue ne sauve donc pas d'un griefeur actif.

**La réalité.** Il faut quelqu'un qui scripte des connexions socket.io en
continu, contre le seul chemin de secours d'un invité au téléphone mort, qui
peut toujours rejouer sous une fiche neuve (il perd la continuité de ses
points, pas la soirée). Rien d'autre n'est abîmé. C'est du griefing
délibéré sur un chemin rare : P3.

**La correction proposée ne tient pas.** Compter « par adresse » : dans une
fête, le griefeur et l'invité sont derrière la même box, donc la même adresse —
il épuise la réserve de la victime comme aujourd'hui ; et hors de la salle,
chaque adresse de plus (IPv6) rouvre la force brute que le seau d'espace
bornait. Avec un secret de six chiffres et une adresse partagée, on ne peut pas
séparer la victime du griefeur. **Mieux** : un second chemin sans secret à
deviner — la console montre un QR (jeton de 256 bits) que le téléphone emprunté
scanne, ou le téléphone affiche un code que la console valide (le modèle de
l'appairage). Les six chiffres restent le repli, avec leur seau. **Au
minimum**, dire à la console que « quelqu'un tape des codes au hasard » quand
le seau se remplit, pour que l'animateur comprenne.

### securite-temps-reel-2 — confirmé, P3

**Reproduction.** Rejouée : témoin vert (🐲 tel quel refusé), puis « l'accusé
lui rend un emoji de collection : 🐲 » et « un niveau 1 porte 🪐 ».

**Le chemin.** `sockets.ts:407-408` juge l'avatar brut ; `niveauRequis` itère
par points de code (`avatars.ts:50`) et ne voit que deux demi-paires ;
`Party.join` → `cleanAvatar` retire `\p{Cc}\p{Cf}` (`avatars.ts:60`) et
recolle la paire. Seul ce chemin juge avant de nettoyer : la mise à jour du
profil nettoie d'abord (`profiles.ts:1016-1017`, et `:913-918` à
l'inscription) — le soupçon de l'expert sur ces lignes est levé.

**La réalité.** Client forgé seulement (l'entrée ne propose que `AVATARS`),
aucun avantage de jeu ; mais la garde de `CLAUDE.md` (« l'invité anonyme n'y
porte aucun emoji de collection ») tombe. P3.

**Meilleure correction.** Une demi-paire n'a jamais sa place dans un avatar :
`const INVISIBLE = /[\p{Cc}\p{Cf}\p{Cs}]/gu` — vérifié :
`'\uD83D​\uDC32'` donne `''` (puis l'avatar par défaut), `'🐲'` reste
`'🐲'`. Et juger le nettoyé dans `player:join` (la piste de l'expert). Les
deux corrections voisines ferment la même famille : recompenses-vitrine-4
(re-juger `peutPorter` à l'affichage, dans `Party.toPublic` — à étendre aux
anonymes, `peutPorter(null, avatar)`) et recompenses-vitrine-8 (écarter les
emojis d'Unicode 13+ dans `cleanAvatar`). Apparentés, pas doublons.

### securite-temps-reel-3 — confirmé, P3

**Reproduction de l'expert.** Elle échoue, mais à la couture `wireSockets`,
avec des doublures (`resolveSession` rendu `null` à la main).

**Ma reproduction, sans doublure** (`tele-expiree.test.ts`) : télé appairée
par les vraies routes, `host:hello` accepté (`branchee: true`), témoin (une
équipe créée avant l'échéance), puis 25 h plus tard côté serveur :
`/api/auth/me de la télé : 401 · nouvelle présentation : ok=false · connexion
d'origine encore ouverte : true · équipe créée après 25 h : true`. Échoue
aujourd'hui.

**Le chemin.** `requireHost` ne lit que `socket.data.isHost` (`sockets.ts:700`,
posé l. 678) ; l'expiration n'est constatée que par `resolveSession`
(`store.ts:527-531`), qui efface sans prévenir `onRevoke` ; rien ne balaie.

**La réalité.** Il faut une télé allumée plus de 24 h sans une coupure de
18 s (battement 10 s + 8 s, `server.ts:225-226`) ni un redémarrage : une télé
qu'on éteint se reconnecte, se re-présente, et tombe. Étroit, et la personne
est sur place. P3 tient. (Ironie : cette télé-là tient aussi le serveur
éveillé, MISE-EN-LIGNE.md:114, et mange les heures de l'offre gratuite.)

**Correction.** Celle de l'expert (`sessionById(socket.data.authSessionId)` dans
`requireHost`, et couper si elle n'est plus) ; elle converge avec la piste de
concurrence-11 / client-3 (« requireHost présente d'abord la connexion par le
cookie de sa poignée de main ») : un `requireHost` qui relit la session à
chaque geste corrige les trois — le geste perdu à la reconnexion et la télé
expirée.

### securite-temps-reel-4 — confirmé (idée), P3

Aucune borne de fréquence dans `ecouter()` ni dans les gestionnaires ; ni
plafond de connexions par adresse (`allowRequest`, `server.ts:228`, ne regarde
que l'origine). Le coût par message reste modeste (`profiles.bySession` lit la
mémoire, `profiles.ts:1132` et `:539`), mais `party:watch` refait et envoie un
instantané à chaque appel. Durcissement, non mesuré : tient comme idée.

## Doublons et voisinages

- portes-3 ↔ **concurrence-2** : les deux faces du même `LoginBudget` (trop dur
  à qui vise un identifiant, trop mou en rafale) ; corriger concurrence-2 d'abord.
- portes-1 / portes-2 ↔ **recompenses-vitrine-5** : même racine (la télé
  appairée a tous les droits d'une console, jusqu'à lire les récits des Divins
  par `/api/auth/me`) ; le garde « écran » les couvre ensemble.
- temps-reel-3 ↔ **concurrence-11**, **client-3** : même fonction
  (`requireHost`), même correction.
- temps-reel-2 ↔ **recompenses-vitrine-4**, **-8** : même famille (avatar
  nettoyé, jugé, ré-jugé à l'affichage).
- portes-4 : doublon de `MISE-EN-LIGNE.md:168-172`.
- Rien de tout cela dans `retours/2026-09-2*/` : l'appairage et « Rendre sa
  place » y sont nés comme des pistes (AN-8, synthèse du 24 l. 415-421), sans
  faille rapportée.

## Ce que je n'ai pas pu trancher

Rien d'incertain. Deux limites : le vrai proxy de Render (portes-4) ne se
vérifie qu'en ligne, et le constat 3 reste démontré avec une horloge avancée
côté serveur, pas sur une vraie télé laissée allumée un jour entier.
