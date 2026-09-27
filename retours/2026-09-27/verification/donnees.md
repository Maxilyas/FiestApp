# Contre-expertise du groupe `donnees` : `persistance` et `exploitation`

Code relu : `main`, b57035c (HEAD a9ddd7f n'ajoute que la tablée). Machine : quatre
cœurs partagés, charge de 0,4 à 1,8 pendant les rejeux (`uptime`). Un fichier de
test à la fois, sous `nice -n 10`. Rien de suivi par git n'a été modifié
(`git status` vide) et rien n'est resté allumé. L'épreuve SIGTERM tue elle-même
ses processus enfants, et j'ai vérifié qu'il n'en restait aucun.

## En bref

Les deux rapports sont solides. **Aucun constat n'est réfuté** : les onze
reproductions que j'ai relancées échouent aujourd'hui, et pour la raison
annoncée. Mes réserves portent sur la gravité, sur deux doublons, et sur deux
nuances qui changent la façon de corriger.

- **`persistance-1`, deux instances sur le même miroir.**
  - **Le défaut du code est réel.** Rejoué : 398 points deviennent 597 au
    réveil, et chaque invité a deux réponses à la même question.
  - **Le déclencheur reste incertain.** Il faut que Render fasse vraiment
    tourner l'ancienne et la nouvelle instance ensemble sur l'offre gratuite.
    Ce que j'ai pu lire de la documentation de Render va dans ce sens, et même
    plus loin que l'expert :
    - la nouvelle instance démarre à côté de l'ancienne ;
    - l'ancienne ne reçoit son SIGTERM que **60 s après** la bascule du trafic ;
    - ses websockets restent ouvertes jusque-là ;
    - la maintenance de la plateforme passe par le même chemin.
  - **Aucune page de Render n'exclut l'offre gratuite.** Seul un blog tiers
    l'affirme. Il faut dix minutes sur la préproduction pour trancher
    (procédure plus bas).
- **`exploitation-1`, une lecture d'archive ratée pendant le recalcul.**
  - **Le bug est confirmé, mais masqué aujourd'hui** par `recompenses-comptes-1`.
  - Une seule ligne `#jour` écrite `{"v":6.0}` fait relire toutes les archives
    à chaque démarrage, ce qui répare par accident la soirée ratée. Ma
    variante `recalcul-masque.test.ts` **passe**.
  - La contre-expertise `recompenses` demande de corriger
    `recompenses-comptes-1` en premier. Corrigé seul, il démasque
    `exploitation-1` : **les deux se corrigent dans le même commit**.
- **Gravités revues à la baisse.**
  - `persistance-3` passe de P2 à P3 : un seul profil exclu, l'expérience d'une
    seule soirée, sur un hoquet de Turso d'un aller-retour.
  - `exploitation-2` passe de P2 à P3 : la procédure est entre les mains de
    l'administrateur, `/admin` alerte dès le premier jour, rien n'est perdu. Sa
    partie documentation recoupe `invariants-5`.
- **Doublons.**
  - `persistance-5` est `jour-regles-6`, déjà confirmé P3 par la
    contre-expertise `jour`.
  - `exploitation-7` est `perf-serveur-6`.
  - `persistance-4` recoupe en partie `recompenses-comptes-2` et
    `concurrence-4` : l'annonce qui manque. L'expérience du palier jamais
    créditée, elle, est neuve.

## Le tableau

| Constat | Gravité annoncée | Verdict | Gravité retenue | Pourquoi, en une ligne |
|---|---|---|---|---|
| persistance-1 · deux instances, même miroir | P2 | **incertain** (probable) | P2 si confirmé | Rejoué (398 → 597, réponses doublées, Dora revenue). Le défaut est dans le code ; le chevauchement sur l'offre gratuite reste à observer sur la préproduction |
| persistance-2 · retrait d'une soirée pendant un hoquet | P2 | confirmé | P2 | Rejoué : 500, puis 404, 2 lignes et 7 récompenses gardées. `api.ts:440-442` efface l'archive d'abord ; `recalcul.ts:150-157` garde les lignes orphelines pour toujours |
| persistance-3 · exclu pendant un hoquet | P2 | confirmé, gravité revue | P3 | Rejoué (Malik garde 60 XP). Un seul profil, une seule soirée, sur un aller-retour qui échoue : rare et borné |
| persistance-4 · palier tombé pendant un hoquet | P3 | confirmé | P3 | Rejoué (`#paliers` vide, rien annoncé). L'annonce manquante recoupe `recompenses-comptes-2` ; l'expérience jamais créditée est neuve, et revient au palier suivant |
| persistance-5 · la nuit close avant d'avoir payé | P3 | doublon | P3 | `jour-regles-6`, confirmé par la contre-expertise `jour`. Rejoué ici aussi (Bruno 60 au lieu de 75) ; l'expérience revient à la prochaine réponse du profil |
| persistance-6 · effacement du miroir abouti, réponse perdue | P3 | confirmé | P3 | Rejoué (miroir 0/0/0, réveil amputé). Il faut aussi continuer au lieu de reclore, puis un redémarrage |
| persistance-7 · « C'était un essai » interrompu | P3 | confirmé | P3 | Rejoué (total 60, lignes 0, « Rien n'a été effacé »). Le total se répare au crédit suivant du profil (`profiles.ts:1792`, `:1176`) |
| persistance-8 · disque gardé, miroir troué | P3 | confirmé | P3 | Rejoué. Jamais sur Render (disque effacé) ; sur le PC de secours, la procédure clôt la soirée avant de rendre la main à Render |
| persistance-9 · retour à a6fc98b | P3 | tension | P3 | Lu : a6fc98b n'écarte que `#paliers`. Retour arrière seulement ; la piste de la version de schéma tient |
| exploitation-1 · recalcul, archive illisible par panne | P2 | confirmé | P2 | Rejoué (1080 au lieu de 160). **Masqué** tant que `recompenses-comptes-1` vit (ma variante passe) : à corriger ensemble |
| exploitation-2 · réserve à sec au 5ᵉ jour | P2 | confirmé, gravité revue | P3 | Rejoué (10, 10, 10, 8, puis 0 jusqu'au 31 octobre). Procédure d'administrateur avec alerte à `/admin` dès le premier jour ; recoupe `invariants-5` et `tests-5` |
| exploitation-3 · minutes de construction | P2 | tension | P2 | La règle de Render est confirmée par sa documentation (constructions désactivées sans moyen de paiement) ; la consommation se lit en 30 s au tableau de bord |
| exploitation-4 · SIGTERM au milieu d'une clôture | P3 | confirmé | P3 | Rejoué (sortie en 23 ms, aucun toast, soirée « en cours » au réveil ; la reprise converge) |
| exploitation-5 · quiz du jour à froid | P3 | tension | P3 | Coup d'œil : le modèle tient ; parti pris « zéro euro » |
| exploitation-6 · `tsx` à chaque réveil | P3 | confirmé (lecture) | P3 | Idée de performance plausible, non remesurée |
| exploitation-7 · 60 allers-retours en série | P3 | doublon | P3 | `perf-serveur-6`, même mesure, même piste |
| exploitation-8 · verrous de connexion éternels | P3 | confirmé | P3 | Rejoué (2 échecs). Sur l'offre gratuite, chaque réveil vide la carte : durcissement |
| exploitation-9 · amorce interrompue | P3 | confirmé (lecture) | P3 | `jour.ts:343-344`. Le drapeau `amorcee` n'est jamais relu pour sa valeur : un apport « 0 ajoutée » de trop au journal, rien d'autre |
| exploitation-10 · version et réserve dans `/healthz` | P3 | confirmé (lecture) | P3 | Idée. `NODE_ENV` absent de la documentation : vrai (`index.ts:14`), sans effet sur Render (`RENDER=true` suffit) |

## Constat par constat

### persistance-1 · Deux instances écrivent au même miroir : incertain, P2 s'il est confirmé

**La reproduction.** `miroir/deux-instances.test.ts` échoue sur les trois
invités, avec deux réponses chacun à la question 2. Elle dit ce qu'elle
prétend :

- trois vrais `createQuizServer` sur le même fichier `file:`, chacun avec sa
  base locale ;
- la nouvelle instance recharge le miroir **pendant** que l'ancienne joue la
  question 2 et reçoit Dora ;
- l'ancienne se vide par `close()`, exactement ce que fait le SIGTERM
  (`index.ts:143-156`) ;
- aucun chemin interne, aucune charge forgée.

**Le chemin du code.** Rien ne sépare deux écrivains :

- `server.ts:265-267` appelle `restoreInto` au démarrage ;
- `backup.ts:1070` ne recharge que si la base locale est vide, ce qui est
  toujours le cas sur Render ;
- `uid` et upserts rendent un **rejeu** idempotent, pas deux histoires
  parallèles.

`index.ts:138-141` suppose un arrêt **avant** le démarrage suivant (« l'hébergeur
prévient avant de redémarrer »). Le dépôt connaît déjà ce risque : la procédure
du PC de secours dit « Jamais deux serveurs qui écrivent dans la même base »
(MISE-EN-LIGNE, « Le serveur tombe… », point 1). Mais il ne l'envisage pas pour
Render lui-même.

**Ce que dit l'hébergement.** Dans le dépôt :

- `render.yaml` : `plan: free`, aucun disque, `healthCheckPath: /healthz` ;
- la production en `autoDeploy: false`, la préproduction en `autoDeploy: true`.

Sur Render : `render.com` est bloqué par le proxy, mais la recherche web rend des
extraits de sa documentation :

- « Render spins up a new instance… your original instance continues to receive
  all incoming traffic while the new instance is spinning up » ;
- « after the new instance… begins receiving all incoming traffic, **after 60
  seconds** Render sends a SIGTERM… to the original instance », puis SIGKILL
  après le délai d'arrêt (30 s par défaut) ;
- « Adding a persistent disk to your service disables zero-downtime deploys » ;
- pour les websockets, le routage sans coupure ne vaut que pour la poignée de
  main : les connexions ouvertes restent sur l'ancienne jusqu'à sa fin ;
- les services sans disque « remain available during maintenance windows,
  because they support zero-downtime deploys ».

Pour l'offre gratuite : la page « Deploy for Free » (15 min de veille, réveil
d'une minute, 750 h) ne cite, dans les extraits obtenus, aucune exception pour
les déploiements. Seul un blog tiers (kuberns.com) affirme qu'« on the free tier,
there is a brief interruption during each deploy ». Ce n'est pas une source de
Render. Je ne peux pas trancher d'ici.

**Si le chevauchement existe, c'est pire que le rapport ne le dit.** La fenêtre
va du `restoreInto` de la nouvelle instance au SIGTERM de l'ancienne : environ
**70 s ou plus**, pas quelques secondes.

- Le client ouvre d'abord une websocket (`client/src/socket.ts:22`). La salle
  reste donc sur l'ancienne pendant une minute.
- Tout téléphone qui se reconnecte (écran rallumé) arrive sur la nouvelle,
  avec son état d'il y a une minute. La salle est coupée en deux.
- Les chronomètres de la nouvelle, réarmés au démarrage, révèlent « sans
  réponse » et peuvent enchaîner seuls.
- Le dommage est **immédiat** : ce qui s'est joué pendant cette minute est
  perdu quand les téléphones passent à la nouvelle. Il n'attend pas le réveil
  suivant, qui ajoute ensuite le doublement.

**Qui le vivrait.** La production ne se déploie qu'à la main, et la
documentation dit déjà de ne pas le faire pendant une soirée :

- MISE-EN-LIGNE:385, « ne pas déployer pendant une soirée » ;
- MISE-EN-LIGNE:415, « ne pas déployer tant que `quizEnCours` n'est pas à 0 ».

Une nuance au rapport : `/healthz` agrège tous les espaces (`espacesActifs`,
`server.ts:463-481`). Celui qui déploie **voit** donc la soirée d'un ami. Le
risque reste réel pour trois déclencheurs :

- une soirée commencée pendant les deux à trois minutes de construction ;
- l'enregistrement d'une variable (`RESERVE_TOKEN` redéploie, étape 8) ;
- une maintenance de Render, qui n'attend personne.

En préproduction (déploiement à chaque fusion), seules des soirées d'essai
paient. C'est bien un **concours de circonstances**, donc P2 s'il est confirmé.

**Pour trancher (dix minutes, sur la préproduction).**

1. Ouvrir `/host` et un téléphone (websocket ouverte), lancer un quiz à
   questions de 90 s.
2. *Manual Deploy*. Pendant ce temps, lire `/healthz` toutes les deux
   secondes : `uptime` retombe à 0 quand la nouvelle instance prend le trafic.
3. Vérifier que l'écran commun, lui, compte encore les réponses : il est sur
   l'ancienne.
4. Au journal, comparer l'heure de « … rechargés après redémarrage » (la
   nouvelle) à celle de « [serveur] extinction demandée » (l'ancienne). Un
   écart d'une minute environ confirme le chevauchement.
5. Au besoin, compter `party_answers` en double dans le Turso de la
   préproduction.

**Une meilleure correction que le bail pris au démarrage.** Une instance qui
démarre n'est pas encore routée : si elle prenait le bail avant `restoreInto`,
l'ancienne perdrait le droit d'écrire pendant qu'elle sert encore toute la
salle, et ce qu'elle joue ensuite serait perdu. Je propose plutôt :

- **Recharger le miroir à la première vraie requête**, hors `/healthz`, et pas
  au démarrage. Sur Render, cette requête n'arrive qu'après la bascule du
  trafic.
- **Prendre le bail à ce moment-là.** Chaque lot de la file porte la garde
  proposée par l'expert (`party_bail` / `party_garde`).
- **Côté ancienne**, un lot refusé par la garde veut dire « supplantée » :
  elle cesse d'écrire et coupe ses sockets (`io.disconnectSockets()`). Les
  téléphones se reconnectent alors à la nouvelle, qui a relu tout ce que
  l'ancienne avait écrit jusque-là.
- **La perte** est au plus un lot en vol, le même compromis que le SIGKILL
  d'aujourd'hui (deux secondes). L'invariant 5 tient : les chronomètres se
  réarment au rechargement.

Même prémisse de chevauchement pour `jour-regles-17`, confirmé P3 par la
contre-expertise `jour`, qui décrit deux tirages concurrents.

### persistance-2 · Retrait d'une soirée pendant un hoquet : confirmé, P2

**Le rejeu.** Premier essai : 500. Second essai : 404 « Soirée introuvable ».
« archive encore là : false — reste aux profils : { xp: 2, badges: 7, totaux: [ 97, 30 ] } ».

**Le chemin.** `api.ts:440` efface `soirees`, puis `:442` appelle
`retirerSoireeEntiere`. Celle-ci déduit les profils touchés des lignes qu'elle
efface (`profiles.ts:1284-1306`). Si son lot échoue, tout est annulé : les lignes
restent, l'archive est partie.

**Aucune garde ne rattrape.** `recalcul.ts:150-157` garde toute ligne dont la
soirée n'est plus dans l'historique (« jamais effacée »), et aucun geste de
l'interface ne désigne plus cette soirée.

**La gravité.** Le déclencheur est rare : un aller-retour qui échoue pendant un
geste d'administration peu fréquent. Mais la perte de cohérence est
**irréparable sans SQL à la main**, et touche tous les profils de la soirée :

- l'expérience ;
- les prix et les hauts faits ;
- les paliers, et avec eux les légendaires que leur niveau ouvre.

Elle contredit aussi la promesse affichée (« C'est définitif »). Je la garde P2.

**Une correction plus robuste.** Même effet que la piste de l'expert, sans
dépendre des `profileId` de l'archive, que les archives d'avant les profils ne
portent pas. Elle corrige aussi `persistance-7`.

1. **Lire** les profils touchés, en lecture seule (les trois `SELECT`).
2. **Un seul lot d'écriture** : les trois `DELETE`, et l'`UPDATE profiles SET xp
   = (SELECT SUM…)` de chacun de ces profils. S'il échoue, rien n'a bougé.
3. Puis `#paliers` et les récompenses en mémoire.
4. **L'archive en dernier**, dans la route comme dans `discardParty`
   (`space.ts:1693-1696`).

### persistance-3 · L'exclu garde l'expérience de la soirée : confirmé, gravité revue P3

**Le rejeu.** « après la clôture, Malik garde : [ { xp: 60 } ] — total 60 ».

**Le chemin.** `space.ts:945-947` lance `rendreCredit(...).catch(console.error)`.
Aucun crédit suivant ne touche un profil absent des gains
(`crediterSoireeEntiere`, `profiles.ts:1186-1207`, n'efface rien). Le recalcul
garde la ligne (voir plus haut). L'invariant 10 est bien cassé.

**Pourquoi P3 et pas P2.**

- Il faut que Turso refuse **ce** lot-là, à **cette** exclusion, déjà rare.
- Le dommage : un seul profil, souvent un plaisantin, garde l'expérience d'une
  soirée. Parfois aussi un Éclat, à une chance sur quarante.
- Le cas du SIGTERM demande un arrêt dans la même milliseconde. Sur Render,
  SIGTERM n'arrive que 60 s après une bascule de déploiement.

La piste de l'expert est la bonne, avec la même clé que les autres écritures de
soirée : `space_id` en plus de `soiree_id`. À la clôture, effacer les lignes et
Éclats de la soirée des profils absents des gains, puis recalculer leurs totaux.

### persistance-4 · Palier tombé pendant un hoquet : confirmé, P3, en partie doublon

**Le rejeu.** « palier sur l'étagère : hf:habitue:1 — ligne #paliers : [] —
annoncé : [] ».

**Le chemin.** `profiles.ts:1432-1446` : le badge, puis `ecrireXpDesPaliers` et
`recalculerTotal` dans d'autres requêtes. Au second passage, `neufs` est vide.

**Ce qui est déjà rapporté.** L'annonce qui manque après une clôture reprise,
c'est `recompenses-comptes-2` et `concurrence-4` (doublons l'un de l'autre,
retenus P3 par la contre-expertise `soiree`).

**Ce qui est neuf.** Les 10, 25 ou 50 XP du palier ne sont pas crédités.
`ecrireXpDesPaliers` ne repasse qu'au palier suivant, à un retrait, ou à un
recalcul de barème.

**L'Éclat perdu** (`space.ts:734-745`) se confirme à la lecture :
`creditPrecedent` voit la ligne et ne retire plus. C'est un tirage à une chance
sur quarante : négligeable.

### persistance-5 · La nuit close avant d'avoir payé : doublon de jour-regles-6

Rejoué : « première demande du lendemain : 500 ». Bruno : podium 15, ligne 60,
partie 60.

C'est `jour-regles-6`, confirmé P3 par la contre-expertise `jour`, avec la même
nuance : `ecrireXp` recalcule la somme à chaque réponse (`jour.ts:1241-1250`).
L'expérience revient donc à la prochaine partie du profil. Elle n'est perdue
pour de bon que pour qui ne rejoue jamais. Même piste : le drapeau
`jour_clotures` en dernier.

### persistance-6 · L'effacement du miroir abouti, sa réponse perdue : confirmé, P3

**Le rejeu.** « au miroir : 0/0/0 », puis « au réveil : { invites: 1, gains: 0,
reponses: 0 } ».

**Le chemin.** `backup.ts:1023-1034` : le `catch` relance sans
`demanderResync`. `reussite()` (`:727-740`) ne demande une resynchronisation
qu'après un échec de la file, ce que cet effacement n'est pas.

**La gravité.** Trois circonstances à la suite :

1. une réponse au-delà de dix secondes, **mais validée** par Turso ;
2. l'animateur qui continue au lieu de reclore, alors que le message lui dit
   de réessayer ;
3. un redémarrage avant la clôture suivante.

À noter : `party_soiree` est effacée aussi. Au réveil, la soirée perd son nom
figé (invariant 11).

La piste (`demanderResync` dans le `catch`) est la bonne. La
resynchronisation n'efface jamais.

### persistance-7 · « C'était un essai » interrompu : confirmé, P3

**Le rejeu.** « premier clic : Rien n'a été effacé », puis « lignes d'Alice
après le premier clic : [] », puis « total d'Alice : 60 avant, 60 après ; somme
de ses lignes : 0 ».

**Le chemin.** `retirerSoireeEntiere` valide ses `DELETE`, puis échoue sur le
total. Le second clic ne retrouve plus aucun profil.

**Ce qui le borne.** Le total faux se répare au prochain crédit du profil :

- la soirée suivante recalcule la somme (`profiles.ts:1176`) ;
- une réponse au quiz du jour aussi (`:1792`).

Il redescend alors d'un coup, petite entorse à l'invariant 19. Le message
trompeur est le vrai défaut.

Même correction que `persistance-2`.

### persistance-8 · Disque gardé, miroir troué : confirmé, P3

**Le rejeu.** « extinction : 5 écriture(s) abandonnée(s) », puis au miroir
« 0/0 », puis au réveil « 0/0 ».

**Le chemin.** `restoreInto` ne fait rien sur une base peuplée (`backup.ts:1076`),
et le démarrage ne resynchronise pas. Le seul minuteur de `server.ts:427`
renvoie un instantané, pas le miroir.

**Pourquoi rare.** Le cas n'existe pas sur Render (disque effacé). Sur le PC de
secours, il faut en plus reprendre la soirée ailleurs **avant** de la clore,
alors que la procédure dit de clore sur le PC. La piste, une resynchronisation
au démarrage de chaque espace qui a des lignes locales, ne coûte rien quand
tout est là.

### persistance-9 · Retour à a6fc98b : tension, P3

Lu seulement : `git show a6fc98b:server/src/auth/profiles.ts` ne connaît que
`LIGNE_PALIERS`. La ligne `#jour`, écrite `{"v":6,"jours":…}`, n'y relance pas
de recalcul, mais paraît dans l'historique.

C'est un scénario de retour arrière. La consigne « préférer un correctif vers
l'avant » et une version de schéma dans `meta` suffisent.

### exploitation-1 · Recalcul : archive déclarée illisible sur une panne : confirmé, P2, à corriger avec recompenses-comptes-1

**Le rejeu.** « démarré ; [recalcul] soirée « soiree-0 » illisible : TypeError:
fetch failed », puis « attendue {"p-alice":160,"p-bruno":178} ; obtenue
{"p-alice":1080,"p-bruno":1089} ».

**Le chemin.** `recalcul.ts:119-123` avale toute erreur de `archives.get`.
Ensuite, `:148-157` remet au barème (`remettreAuBareme`, `profiles.ts:1763-1773`,
`JSON.stringify`, donc `{"v":6,…}` reconnu) les lignes que rien n'a relues. Le
démarrage suivant n'y revient plus.

**La nuance que le rapport ne dit pas.** Le même `remettreAuBareme` réécrit la
ligne `#jour` par `json_set(detail, '$.v', ?)` (`:1757-1760`), qui donne
`{"v":6.0}` : c'est `recompenses-comptes-1`. Tant qu'une seule ligne `#jour`
reste ainsi, `aRecalculer` n'est jamais vide. Chaque démarrage relit alors toutes
les archives, et répare la soirée ratée au démarrage suivant.

`verification/donnees/recalcul-masque.test.ts` reprend l'épreuve de l'expert en
ajoutant à Alice une ligne `#jour` d'une version d'avant. Elle **passe** :
« obtenue {"p-alice":160,"p-bruno":178} ».

**Conséquence.** Aujourd'hui, en production, le bug est masqué par un autre, qui
coûte un recalcul à chaque réveil. La contre-expertise `recompenses` demande de
corriger `recompenses-comptes-1` d'abord. Corrigé seul, il rend `exploitation-1`
permanent au premier hoquet. **Les deux vont dans le même commit, avant le
prochain `VERSION_BAREME`.** P2 tient : l'événement est prévu, et le dommage
(dix profils à l'ancien barème, sans un mot) est silencieux et définitif.

La piste de l'expert est juste :

- relancer si `pourquoiInjoignable(e)` (`distante.ts:104-127`, qui reconnaît
  `fetch failed`, `BaseMuette` et les `TimeoutError`) ;
- garder « à relire » les lignes d'une archive vraiment illisible.

### exploitation-2 · Réserve à sec au cinquième jour : confirmé, gravité revue P3

**Le rejeu** (`reserve-a-sec.ts`) : 10, 10, 10 et 8 questions du 1er au
4 octobre, 0 du 5 au 31, puis 10, 10, 10 et 8 du 1er au 4 novembre.

**Le chemin.** `jour.ts:106` (`JOURS_AVANT_DE_REPOSER = 30`) et `:334-345`
(amorce). `JourApp.tsx:292` promet « Il revient demain » sans rien vérifier :
c'est le vrai petit bug.

**Pourquoi P3.**

- C'est une étape de la procédure de mise en ligne (étape 8), faite par
  l'administrateur lui-même.
- `/admin` montre l'alerte « sous sept jours d'avance » dès le premier jour.
- « Copier la consigne pour une IA » remplit la réserve en cinq minutes.
- Rien n'est perdu.

**Les recoupements.** L'écart de documentation (« jamais un jour vide ») est
`invariants-5`, et l'absence d'épreuve de la réserve à sec est `tests-5`. Ce qui
est propre à ce constat : la durée (26 jours) et la phrase fausse au téléphone.
La piste tient ; la liste de contrôle du rapport la couvre.

### exploitation-3 · Minutes de construction de Render : tension, P2

**Les faits confirmés** (extraits de `render.com/docs/build-pipeline` obtenus par
recherche) : 500 minutes par mois sur Hobby, et sans moyen de paiement « Render
disables all new builds for your workspace for the remainder of the month », les
services restant en ligne.

**Le rythme.** 9 à 18 fusions par jour sur les cinq jours visibles. Le dépôt
local est un clone partiel (`--is-shallow-repository` : true) ; l'expert a
recoupé avec l'API GitHub (51 exécutions sur `main`). À 2 min 30 par
construction, 200 constructions épuisent le mois : une semaine de tablée y
suffit.

**Ce qui n'est pas mesuré.** Les minutes réellement consommées : *Workspace →
Billing* le dit en trente secondes, c'est ce qu'il faut regarder.

**Le dommage s'il arrive.** Aucun correctif en production jusqu'au 1er du mois.
C'est la conséquence du parti pris « zéro euro ».

Pistes :

- préproduction en déploiement manuel pendant les semaines de fusions
  rapprochées ;
- ou un filtre de construction (*Build Filters*) sur `retours/**`, `*.md` et
  `.claude/**`, qui ne change rien au code en ligne.

### exploitation-4 · SIGTERM au milieu d'une clôture : confirmé, P3

**Le rejeu** (vrai processus, 150 ms d'aller-retour, clôture de référence en
1 846 ms) :

- à 700 et 1 500 ms : « sortie 0 en 23 ms ; toast reçu : aucun », puis au réveil
  « soirée en cours « La soirée », 5 invités ; 0 archive(s) close(s) » ; la
  seconde clôture converge ;
- à 3 000 ms, tout passe.

**Le chemin.** `server.ts:837-858` : `registry.stopAll()`, `io.close`, la file du
miroir. Les travaux `enFile` des espaces ne sont pas attendus.

**Pourquoi P3.** Rien n'est perdu et la reprise converge. Avec les vrais
allers-retours de Turso (20 à 80 ms), la fenêtre est plus courte, et SIGTERM
pendant une clôture demande un déploiement ou une maintenance à cet instant.

La piste (attendre les files au plus environ 20 s, et le dire dans `/healthz`)
tient. Elle doit relever la coupure de `index.ts:156` (12 s), puisque Render
laisse 30 s.

### exploitation-5, -6, -10 · Coup d'œil

- **exploitation-5.** Le modèle tient. C'est une tension avec le parti pris
  « zéro euro », pas un défaut.
- **exploitation-6.** `render.yaml` démarre bien par `--import tsx`. Le gain
  d'un paquet est plausible ; je ne l'ai pas remesuré.
- **exploitation-10.** Vrai : `NODE_ENV` n'est écrit nulle part
  (`index.ts:14`). Sur Render, `RENDER=true` suffit à passer « en ligne » :
  cela ne compte que pour le PC ou un autre hébergeur.

### exploitation-7 · 60 allers-retours en série : doublon de perf-serveur-6

Même mesure (60, 54 avant #58) et même piste (grouper les lectures de schéma,
paralléliser les magasins).

### exploitation-8 · Verrous de connexion éternels : confirmé, P3

**Le rejeu.** Les deux épreuves échouent, dont « 5001 entrées gardées, dont
5000 d'il y a quatre jours ».

**Le chemin.** `auth/http.ts:154-166` : `failures` ne vieillit pas, et l'élagage
ne retire que les verrous échus à zéro échec.

**La réalité.** Sur l'offre gratuite, la carte se vide à chaque veille (quinze
minutes sans trafic). Quelques milliers d'entrées pèsent moins d'un mégaoctet.
C'est un durcissement, distinct de `concurrence-2` et `securite-portes-3`.

### exploitation-9 · Amorce interrompue : confirmé à la lecture, P3 cosmétique

`jour.ts:343-344` : deux requêtes. Le drapeau `amorcee` n'est lu que pour son
existence (`:335`), jamais pour sa valeur : « vaut 0 » est sans effet. Seul un
apport « Livrées : 0 ajoutée, 38 écartées » paraît de trop à `/admin`.

Je n'ai pas relancé `panne-au-demarrage.ts`, qui demande la base fabriquée par
a6fc98b : le chemin est sans ambiguïté.

## Méthode

**Relu** :

- les deux rapports et leurs JSON, les deux fiches, les deux consignes ;
- `render.yaml` ;
- dans `MISE-EN-LIGNE.md` : les étapes 3, 7 et 8, « Si ça coince », `/healthz`
  et le PC de secours ;
- dans `server/src/` :
  - `index.ts` et `server.ts` : démarrage, `/healthz`, `close()` ;
  - `core/backup.ts` : `remettreAZero`, `reussite`, `restoreInto` ;
  - `core/distante.ts` : `pourquoiInjoignable` ;
  - `core/recalcul.ts` ;
  - `core/space.ts` : exclusion, `rendreCredit`, crédits, Éclat,
    `discardParty` ;
  - `core/jour.ts` : amorce, `enregistrer`, `clorePasses`, `clore`,
    `ecrireXp` ;
  - `core/archive.ts` : `remove` ;
  - `auth/profiles.ts` : `retirerSoiree`, `retirerSoireeEntiere`,
    `crediterSoireeEntiere`, `recalculerTotal`, `accorderPaliers`,
    `aRecalculer`, `remettreAuBareme`, `ecrireXpDuJour` ;
  - `auth/http.ts` ;
  - `api.ts` : la route `DELETE /api/soirees/:id` ;
- `client/src/views/JourApp.tsx` et `client/src/socket.ts` ;
- le code a6fc98b de `profiles.ts`, par `git show` ;
- pour les doublons : les JSON de `rapports/` et de `verification/`.

**Rejoué** : `persistance/miroir/deux-instances`,
`effacement-perdu`, `redemarrage-disque-garde` ;
`persistance/ecritures/retrait-soiree` (2 épreuves), `exclusion`, `paliers`,
`jour-nuit` ; `exploitation/deploiement/recalcul-panne-passagere` ;
`exploitation/arret/sigterm-cloture` (4 épreuves) ;
`exploitation/duree/verrous-sans-fin` (2 épreuves) et `reserve-a-sec.ts`.

**Écrit** : `export/evaluations/verification/donnees/recalcul-masque.test.ts`,
une variante d'`exploitation-1` avec une ligne `#jour`. Elle passe aujourd'hui,
ce qui prouve le masquage. Elle devra toujours passer après les deux
corrections.

**Render** : `render.com` est bloqué par le proxy (WebFetch refusé). J'ai
travaillé sur les extraits de sa documentation rendus par la recherche web :

- [Deploying on Render](https://render.com/docs/deploys) ;
- [Deploy for Free](https://render.com/docs/free) ;
- [Platform Maintenance](https://render.com/docs/platform-maintenance) ;
- [Build Pipeline](https://render.com/docs/build-pipeline) ;
- [WebSockets et déploiements sans coupure (forum)](https://community.render.com/t/how-do-zero-downtime-deploys-work-with-websockets-exactly/4155) ;
- et la seule source contraire,
  [Kuberns](https://kuberns.com/blogs/render-backend-deployment/) (tiers).

**Non rejoué** : `panne-au-recalcul.ts`, `panne-au-demarrage.ts`,
`fabriquer-avant.ts` et `retour.ts`, qui demandent la copie de travail
a6fc98b ; `cpu.mjs` ; `heures-eveillees.mjs`.
