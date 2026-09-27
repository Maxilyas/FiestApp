# Le quiz du jour au téléphone (`jour-ecran`) — rapport de l'expert jeux mobiles

## En bref

Sur un Android de 360 × 640, le quiz du jour se joue sans accroc tant que le réseau tient. Le chrono est juste : il reprend là où il en était après un rechargement, un second onglet ou un redémarrage du serveur, et il reste juste sur un téléphone décalé de 14 heures. La révélation, la fin de partie, le classement, la correction et le récit du lendemain tiennent dans l'écran. L'invité sans profil ne lit qu'une invitation calme.

Ce qui coince, c'est ce qu'annonce la mission : le métro, le pouce et les yeux.
- **Le métro.** Si le réseau revient après l'échéance, la page reste figée sur « Réponses closes », sans bouton, jusqu'à ce qu'on la recharge. Si la réponse de « Question suivante » se perd dans un tunnel, on retrouve « Temps écoulé » sur une question jamais vue.
- **Le pouce.** « Question suivante » est posé exactement là où paraît la grille de la question suivante : un double toucher y répond sans l'avoir lue, et au quiz du jour, le premier toucher est définitif.
- **Les yeux.** La page n'annonce rien au lecteur d'écran. Au texte agrandi, chaque question arrive défilée, chrono caché.

Les trois améliorations qui rapportent le plus (quelques lignes chacune, dans `JourApp.tsx`) :
1. Réessayer d'aller chercher l'état tant qu'une question échue n'est pas révélée, et au retour du réseau.
2. Ignorer les touchers de réponse pendant 400 ms après l'affichage d'une question.
3. Faire comme la page d'une soirée : `aria-live="polite"` sur le jeu, et `scrollTo(0, 0)` à chaque écran.

## Méthode

**Mise en place.**
- Un serveur jetable (`server/test/banc.ts`) sert le client construit dans `export/evaluations/jour-ecran/dist` (`vite build`, code `b57035c`).
- L'horloge du jour est pilotée (`horlogeDuJour`) : elle avance d'elle-même, et je la pose où il faut (10 h, 23 h 59, le lendemain, Halloween).
- Chromium headless via Playwright, `isMobile`, tactile, `fr-FR`, `Europe/Paris`, captures à la taille CSS (`deviceScaleFactor: 1`).
- Trois gabarits : 360 × 640, 360 × 640 au texte agrandi (zoom CSS 130 %), 412 × 915. Plus 1366 × 768 pour `/admin`.
- Deux à six profils par scénario. Les adversaires jouent par l'API, pour faire un classement.

**Le contenu.** Les dix questions tirées des quiz livrés, puis douze questions « écrites par l'IA » (`questions-ia.txt`). Ces dernières suivent la consigne : une anecdote à chaque question, des intitulés de 30 à 185 caractères, et une question aux quatre réponses de 114 caractères.

**Lu.**
- Le client : `client/src/views/JourApp.tsx`, `components/AdminDuJour.tsx`, `components/Jour.tsx`, `games/quiz/PlayerView.tsx`, `components/TimerBar.tsx`, `decompte.ts`, `clock.ts`, `api.ts` (partie jour), `views/ProfilApp.tsx`, `views/PlayerApp.tsx` (pour comparer), `main.tsx`, les règles `.jour-…` de `styles.css`.
- Le partagé : `shared/jour.ts`, `shared/clock.ts`, `shared/erreurs.ts`.
- Le serveur : `server/src/quizDuJour.ts`, `server/src/core/jour.ts`, `server/src/auth/profileRoutes.ts` (`detailDe`), `server/src/core/consigne.ts`.
- Les tests : `server/test/jour-partie.test.ts` (épreuve de minuit).
- Les rapports déjà rendus : `rapports/jour-regles.md`, `recompenses-vitrine.md`, `client.md`.

**Écrit** (dans `export/evaluations/jour-ecran/`).
- `outils.ts` : le banc, l'horloge, le téléphone, les mesures.
- Sept scénarios :
  - `01-journee.ts` : une journée complète et son lendemain ;
  - `02-travers.ts` : les chemins de travers A à N ;
  - `03-minuit.ts` ;
  - `04-tailles.ts` : trois gabarits, contenu « IA » ;
  - `05-horloge-reseau.ts` : horloge qui se recale, page gelée, réponse perdue ;
  - `06-admin.ts` ;
  - `07-divers.ts` : saison, reprise depuis l'accueil, onglet Carrière.
- Deux fichiers de reproductions `node:test` :
  - `jour-ecran-navigateur.test.ts` : six épreuves au navigateur, **toutes en échec aujourd'hui** ;
  - `jour-ecran-serveur.test.ts` : trois épreuves, en échec aujourd'hui. Deux sont déjà rapportées par jour-regles et gardées comme confirmation.
- Les captures sont dans `captures/`, les journaux réseau dans `journal-*.txt`, les relevés dans `notes-*.json`.

**Relancer.**
```bash
cd client && nice -n 10 npx vite build --outDir ../export/evaluations/jour-ecran/dist
cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../export/evaluations/jour-ecran/jour-ecran-navigateur.test.ts
cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../export/evaluations/jour-ecran/jour-ecran-serveur.test.ts
cd server && nice -n 10 node --import tsx ../export/evaluations/jour-ecran/0N-….ts   # les scénarios
```

**Pas couvert.**
- Un vrai Android : ni clavier virtuel, ni TalkBack, ni vraie 4G. Le réseau est simulé par `setOffline`, `route.abort` et des délais.
- L'onglet vraiment caché : sans affichage, `bringToFront` ne cache rien. J'ai gelé la page par CDP (`Page.setWebLifecycleState`), comme Android le fait.
- iOS.

**Déjà rapporté ailleurs, donc écarté ici.** Je l'ai vu à l'écran et je le confirme, sans le compter :
- **jour-regles n° 5** : « Question suivante » juste après minuit affiche « Pas de quiz aujourd'hui : la réserve de questions est vide. Il revient demain. », sans bouton. Capture `MN2-noe-question-suivante-apres-minuit.png`.
- **jour-regles n° 9** : « · en cours » dans un classement « figé ». Capture `AD-camille-classement-hier-fige.png`.
- **jour-regles n° 11** : l'annulation part sans confirmation ni retour.
- **recompenses-vitrine n° 1** : la montée de niveau n'est pas fêtée à la fin d'une partie du jour. Capture `14b-fin-page-entiere.png` : « Niveau 2 · 0 / 180 XP », sans un mot.

## Constats

### 1. Le réseau revient après l'échéance : la page reste figée sur « Réponses closes »

- **Où** : `client/src/views/JourApp.tsx:130-141`. À l'échéance plus 2,1 s, la page appelle **une fois** `api.jour.etat()`, et une panne s'y tait (`.catch(() => {})`). Rien ne relance ensuite : pas de nouvel essai, pas d'écoute de l'événement `online`.
- **Constat** : dans le tunnel, le joueur touche une réponse. Il lit « Ta réponse n'est pas partie — touche-la à nouveau ». L'échéance passe (le message disparaît avec `closes`, `PlayerView.tsx:646`), la page tente sa révélation hors ligne, et s'arrête. Le réseau revient : quinze secondes plus tard, l'écran montre toujours « Question 1 / 10 · Réponses closes · 0 », quatre réponses éteintes, **aucun bouton actif**, aucun message. Seul un rechargement l'en sort, et le joueur n'a aucune raison de le deviner.
- **Preuve** :
  - `jour-ecran-navigateur.test.ts`, épreuve 1 : « dix secondes après le retour du réseau, la page est toujours figée ».
  - `02-travers.ts D` : `D: révélation 15 s après le retour du réseau ? false`, `boutons actifs: []`.
  - Journal : une seule requête `GET /api/jour` ratée à 23 s, puis plus rien.
  - Captures `D1-hors-ligne-apres-echeance.png`, `D2-reseau-revenu-15s-apres.png`.
- **Qui ça touche, ce que ça coûte** : le joueur du métro, c'est-à-dire le public visé. La page paraît plantée. La plupart fermeront l'onglet, et la partie reste entamée.
- **Statut** : bug confirmé (rejoué).
- **Piste** : tant qu'une question est échue et non révélée, réessayer toutes les trois secondes, et sur `online`.
  ```ts
  useEffect(() => {
    if (!question || enRoute) return
    let t: ReturnType<typeof setTimeout>
    const essayer = () => api.jour.etat().then(recevoir).catch(() => { t = setTimeout(essayer, 3000) })
    t = setTimeout(essayer, Math.max(0, question.echeance - serverNow()) + APRES_ECHEANCE_MS)
    const enLigne = () => { clearTimeout(t); essayer() }
    window.addEventListener('online', enLigne)
    return () => { clearTimeout(t); window.removeEventListener('online', enLigne) }
  }, [question, enRoute, recevoir])
  ```
  Et, sous les réponses closes, une ligne `role="status"` : « Pas de réseau : la suite arrive dès qu'il revient ».
- **Priorité · effort** : P2 · S.

### 2. Un double toucher sur « Question suivante » répond à la question suivante

- **Où** :
  - Le bouton « Question suivante » (`JourApp.tsx:237-243`) occupe y = 514 à 572 à 360 × 640.
  - La grille de la question suivante occupe y = 307 à 594 (quatre réponses) ; les deux réponses d'un vrai-ou-faux, y = 351 à 562. Le centre du bouton tombe donc sur une réponse.
  - `repondre` (`JourApp.tsx:109-124`) n'a aucune garde de fraîcheur.
  - Au quiz du jour, la révélation suit le premier toucher : on ne peut pas se raviser.
- **Constat** : premier toucher, la question paraît en 20 à 60 ms en local. Le second, 150 ms plus tard, tombe sur « ■ Neptune » : le serveur l'enregistre en 161 ms et la page révèle « Raté… tu avais dit Neptune » sur une question que le joueur n'a pas lue. Même résultat avec 300 ms de latence ajoutée et un second toucher à 450 ms. C'est le cas du joueur qui retouche parce que le premier toucher « n'a rien fait » : le bouton ne fait que se griser pendant la requête.
- **Preuve** :
  - `jour-ecran-navigateur.test.ts`, épreuve 2 : `jour_reponses` porte `{question: 1, choix: 3}`.
  - `02-travers.ts F` : variantes a et b.
  - Captures `Fa1-avant-double-toucher.png`, `Fa2-apres-double-toucher.png`.
- **Qui ça touche, ce que ça coûte** : tout joueur un peu vif. Il perd une question (jusqu'à 200 points), et avec elle l'or, le Sans-Faute ou sa série de sans-faute (le Sphinx en demande dix). La soirée n'a pas ce piège : la question y arrive au rythme de l'animateur.
- **Statut** : bug confirmé (rejoué).
- **Piste** : dans `repondre`, ignorer un toucher arrivé moins de 400 ms après l'affichage. Retenir l'instant d'affichage à chaque nouvel `index`, ou poser une classe qui coupe `pointer-events` le temps d'une animation d'entrée. Déplacer le bouton ne suffit pas : c'est toute la moitié basse de l'écran qui devient une réponse.
- **Priorité · effort** : P2 · S.

### 3. Le lecteur d'écran n'entend ni la question qui s'ouvre, ni le résultat

- **Où** : `JourApp.tsx:232-269`. Aucune région `aria-live` (seul le toast en a une), et aucun focus posé. La page d'une soirée enveloppe le jeu d'un `<div className="player-shell" aria-live="polite">` (`PlayerApp.tsx:455`), avec ce commentaire : « un lecteur d'écran annonce la question, puis le résultat ».
- **Constat** :
  - Après un toucher, le bouton disparaît et le focus retombe sur `body`. Rien n'est dit : ni « Bien joué ! », ni « Raté… », ni la bonne réponse.
  - Après « Question suivante », pareil : la question paraît en silence, et son chrono de 15 à 20 s court pendant que le joueur aveugle la cherche du doigt.
  - Relevé sur la révélation : `regions: []`, `focus: body`.
- **Preuve** :
  - `jour-ecran-navigateur.test.ts`, épreuve 5 : « ni région annoncée ni focus sur la révélation ».
  - `notes-01.json` : « revelation juste: annonces », « fin: annonces ».
- **Qui ça touche, ce que ça coûte** : les joueurs au lecteur d'écran, sur un jeu chronométré où chaque seconde de recherche coûte des points.
- **Statut** : bug confirmé (rejoué). Écart avec la page d'une soirée.
- **Piste** : `<div className="player-shell" aria-live="polite">` autour de la question et de la révélation, comme `PlayerApp`. Ou, mieux pour un jeu minuté, le focus sur l'intitulé (`tabIndex={-1}`) à chaque nouvel `index`, et sur le bandeau du résultat à la révélation.
- **Priorité · effort** : P2 · S.

### 4. Au texte agrandi, chaque question arrive défilée, chrono caché

- **Où** : `JourApp.tsx` ne remonte jamais la page d'un écran à l'autre. La page d'une soirée le fait (`PlayerApp.tsx:346-347`, `window.scrollTo(0, 0)` à chaque changement d'écran).
- **Constat** : à 130 %, sur 360 × 640, avec des anecdotes comme la routine en écrira :
  - la révélation mesure de 984 à 1 305 px ;
  - « Question suivante » est sous le pli **9 fois sur 10** : on descend pour le toucher ;
  - la question suivante s'affiche là où la page était, défilée de 192 à 226 px. Le chrono est hors de l'écran (haut à −54 ou −88 px), avec « Question n / 10 » et le bandeau des points. On lit l'intitulé sans savoir combien de temps il reste ;
  - la fin de partie s'ouvre à mi-page (défilée de 441 px) : le score et la date sont au-dessus.

  À 100 %, le défaut ne se voit que si la question suivante dépasse l'écran : c'est le cas de la question aux quatre longues réponses (788 px).
- **Preuve** :
  - `jour-ecran-navigateur.test.ts`, épreuve 4 : « son haut est à −54 px ».
  - `04-tailles.ts`, relevé « Paul » : `suivanteSousLePli: true` sur 9 révélations, `suite.scrollY` de 192 à 226.
  - Captures `T-Paul-r1.png`, `T-Paul-q2-arrivee.png`, `T-Paul-fin.png`.
- **Qui ça touche, ce que ça coûte** : les joueurs qui grossissent le texte de leur téléphone, souvent les plus âgés. C'est le cas de la « grand-mère au petit téléphone ». Et c'est à chaque question.
- **Statut** : bug confirmé (rejoué).
- **Piste** : `useEffect(() => window.scrollTo(0, 0), [ecran, partie?.etat, partie?.question?.index, revelation?.index])`.
- **Priorité · effort** : P2 · S.

### 5. « Question suivante » perdue dans un tunnel : « Temps écoulé » sur une question jamais vue

- **Où** : `server/src/core/jour.ts:632-635`. `suivante` écrit `servie_le` au passage de la demande, et le chrono court au serveur même si la réponse ne revient jamais. Côté téléphone (`JourApp.tsx:93-102`), l'échec n'affiche qu'un toast, et rien ne relance.
- **Constat** : le joueur touche « Question suivante » à l'entrée du tunnel. La demande arrive, le serveur sert la question 2, et la réponse se perd (toast « Pas de réseau — vérifie ton Wi-Fi ou ta 4G, puis réessaie »). Trente secondes plus tard, il retouche : « Question 2 / 10 — Temps écoulé. La bonne réponse : Le martinet ». Il n'a jamais vu cette question. Le mot « Temps écoulé » lui dit qu'il a traîné.
- **Preuve** :
  - `05-horloge-reseau.ts R` : `question servie à 1790460683681` alors que le téléphone est resté sur la révélation 1.
  - Captures `R1-suivante-perdue.png`, `R2-retouche-30s-plus-tard.png`.
- **Qui ça touche, ce que ça coûte** : le joueur du métro. Une question perdue, et la confiance avec.
- **Statut** : confirmé (rejoué). **Tension** avec une règle que jour-regles juge saine : « aucune question ne se lit sans lancer son chrono ». Resservir la question ouvrirait une triche (lire, couper le réseau, redemander).
- **Piste**, sans toucher à la règle :
  1. Réduire la perte. Quand `suivante` ou `commencer` échoue, relancer seul `api.jour.etat()` toutes les quelques secondes et sur `online`, comme au constat 1. La question arrive avec le temps qui lui reste, au lieu d'attendre un toucher.
  2. Dire ce qui s'est passé. La page sait si elle a affiché l'index révélé. Si elle ne l'a jamais montré, écrire « Cette question est partie pendant la coupure », pas « Temps écoulé ».
  3. Toute indulgence de score relève de jour-regles.
- **Priorité · effort** : P2 · M.

### 6. Un refus définitif s'affiche « touche-la à nouveau »

- **Où** : `JourApp.tsx:120-123`. Tout échec de `repondre` devient `etat: 'perdue'`, et `ReponsePerdue` (`PlayerView.tsx:378-384`) dit « Ta réponse n'est pas partie — touche-la à nouveau ». C'est vrai pour une coupure. C'est faux pour un refus du serveur (400) ou un hébergeur qui redémarre (503).
- **Constat** :
  - Une question servie à 23 h 59 min 58, touchée à 0 h 00 min 00 : le toast dit « Minuit est passé : le quiz d'hier est clos », la ligne sous les réponses dit « touche-la à nouveau ». Chaque nouveau toucher reçoit le même refus, jusqu'à l'échéance.
  - La partie d'hier disparaît ensuite derrière la carte du dimanche, sans écran de fin ni médaille (captures `MN5b…`).
  - Pendant un redémarrage (503), le toast dit « Le serveur redémarre — patiente une minute, puis réessaie » et la ligne dit « touche-la à nouveau ». Deux consignes contraires, sur un chrono de 20 s.
- **Preuve** :
  - `jour-ecran-navigateur.test.ts`, épreuve 3 : « "touche-la à nouveau" après un refus définitif ».
  - `03-minuit.ts` : « Mina: sa réponse après minuit », puis « elle retouche ».
  - Captures `MN3-mina-reponse-apres-minuit.png`, `MN4-mina-retouche.png`, `H1-reponse-pendant-redemarrage.png`.
- **Qui ça touche, ce que ça coûte** : ceux qui jouent à minuit, à la dernière minute pour garder leur série, et tout le monde pendant un déploiement. Pas de perte au-delà de ce que minuit prend déjà, mais un écran qui ment.
- **Statut** : bug confirmé (rejoué).
- **Piste** : ne marquer « perdue » que les échecs sans réponse du serveur. Un `ApiError` qui n'est pas `passager` et porte un message du serveur est un refus : afficher ce message et relire l'état (`api.jour.etat().then(recevoir)`), qui mène au nouveau jour ou à la révélation. Un 503 peut attendre le réveil (`auReveil`), puisque `repondre` se rejoue sans dommage.
- **Priorité · effort** : P3 · S.

### 7. Le lendemain d'une victoire, l'accueil n'a ni laurier ni podium

- **Où** : `server/src/auth/profileRoutes.ts:76-86`. `detailDe` construit le profil (`toDetail` : laurier et expérience, `profiles.ts:779`) **avant** `jour.carriereDe`, et c'est `carriereDe` qui appelle `clorePasses` (`jour.ts:1059-1061`). À la première demande du jour, `laureats()` rend encore la liste vide et lance la nuit en arrière-plan (`jour.ts:1474-1487`).
- **Constat** : Camille a gagné samedi. Dimanche matin, elle ouvre l'application : c'est l'accueil, donc `GET /api/joueur/moi`. Elle y lit « 0 / 180 XP vers le niveau 3 », sans « Vainqueur du quiz du jour d'hier » sous son prénom. La carte du jour, chargée juste après, dit pourtant « Camille a gagné hier ». Rechargée, la même page montre le laurier et « 35 / 180 XP » (le podium et le palier compris).
- **Preuve** :
  - `jour-ecran-serveur.test.ts` : « dès la première visite du jour, le vainqueur d'hier porte son laurier », en échec **3 fois sur 3**. La seconde lecture a bien `laurier: true`.
  - Captures `20-lendemain-accueil.png` (sans) et `26-profil-carriere.png` (après passage par `/jour` : « Vainqueur du quiz du jour d'hier »).
- **Qui ça touche, ce que ça coûte** : chaque vainqueur, chaque matin, au moment où il vient voir sa victoire. Rien de perdu, mais le moment est raté.
- **Statut** : bug confirmé (rejoué).
- **Piste** : clore la nuit avant de lire le profil. Dans `detailDe`, `await deps.jour.clorePasses(jourDe(deps.maintenant()))` d'abord, ou lire `carriereDe` avant `toDetail`. Relire aussi le `ProfileRec` après, puisque la nuit vient de créditer le podium.
- **Priorité · effort** : P3 · S.

### 8. L'écart d'horloge ne se remesure jamais sur la page du jour

- **Où** : `client/src/clock.ts` et `api.ts:442-447` (`avecLHeure`). `bestSample` garde la mesure la plus rapide pour toute la vie de la page, et la page du jour n'appelle jamais `resetClock()`. La soirée l'appelle à chaque connexion.
- **Constat** :
  - Un décalage fixe est bien tenu. Sur le banc, le téléphone vit à l'heure réelle, à 50 290 s de l'horloge du jour, et le chrono affiche pourtant 20 s justes. Une question laissée filer se révèle à 22,4 s pour 20 s.
  - Un téléphone qui **se recale** après la première mesure (resynchronisation réseau à la sortie du tunnel, réglage manuel) garde l'ancien écart :
    - recalé de +30 s, chaque question s'affiche close : « 0 », « Réponses closes », aucune réponse active, et la page interroge le serveur toutes les 2,5 s jusqu'à la vraie échéance ;
    - recalé de −30 s, le chrono affiche 50 s pour une question de 20 s. Le joueur répond « à 26 s » et lit « Trop tard ! ».

    C'est exactement le défaut que l'invariant 6 a chassé des soirées.
- **Preuve** :
  - `jour-ecran-navigateur.test.ts`, épreuve 6 : « la question s'affiche close ».
  - `05-horloge-reseau.ts P` : `[0, 20, true, 0]` puis `[50, 20, false, 4]` et « Trop tard ! ».
  - Captures `P-avance-30s-apres-la-mesure.png`, `P-retard-30s-reponse.png`.
- **Qui ça touche, ce que ça coûte** : rare. Il faut que l'horloge du téléphone bouge pendant que la page est ouverte. Mais alors toute la partie est perdue, jusqu'au rechargement.
- **Statut** : confirmé (rejoué, recalage simulé). Déclencheur réel non observé.
- **Piste** : `resetClock()` avant le premier `etat` de la page et à chaque `visibilitychange` → `visible`, comme une reconnexion de soirée. Ou accepter une mesure plus lente quand l'écart qu'elle donne sort de la marge de la mesure gardée (± la moitié de son aller-retour).
- **Priorité · effort** : P3 · S.

### 9. L'administrateur ne voit pas ce qu'on lui signale, ni ce qu'il vient d'annuler

- **Où** : `server/src/core/jour.ts:1340-1368` (`signalements` : l'intitulé et `bonne` seulement), `jour.ts:1396` (l'annulation ferme les signalements), `client/src/components/AdminDuJour.tsx:246-279`, et le champ du joueur (`JourApp.tsx:150-155`).
- **Constat** :
  - **Les réponses manquent.** Le signalement montre la question et « réponse : Jupiter », jamais les trois autres réponses. Le joueur a écrit « La réponse B est juste aussi », comme le lui suggère l'exemple du champ. Mais le téléphone n'a pas de lettres (des formes ▲ ◆ ● ■), et les réponses sont mélangées : « B » ne désigne rien, et l'administrateur ne peut pas juger.
  - **L'ordre piège le clic.** La liste est rangée par signalement le plus récent. Le premier bouton rouge « Annuler ses points pour tous » est donc celui de la dernière remarque, pas de la question la plus signalée. Mon script, qui touchait le premier, a annulé la question de l'iPhone, signalée pour une « Faute d'orthographe », au lieu de celle des planètes : points, médailles et « 9 sur 10 » de chacun recomptés.
  - **La trace disparaît.** Aussitôt annulée, la question sort de la liste. L'administrateur ne voit plus ce qu'il a annulé, et rien ne le défait (jour-regles n° 11 pour l'absence de retour).
- **Preuve** :
  - `06-admin.ts` : « admin: texte des signalements », puis « une boîte de confirmation … ? false ».
  - Camille passe de 1 800 pts « 9 bonnes réponses sur 10 » à 1 600 pts « 8 sur 9 ».
  - Captures `AD-portable-signalements.png`, `AD-portable-apres-annuler.png`, `AD-telephone-signalements.png`, `10-signaler-dialogue.png`.
- **Qui ça touche, ce que ça coûte** : l'administrateur, et par lui tous les joueurs du jour.
- **Statut** : friction confirmée (rejouée).
- **Piste** :
  - Joindre `reponses` au signalement et les montrer avec leurs formes (`Shape`). Que l'exemple du champ du joueur cite une forme, pas une lettre : « La réponse ● Saturne est juste aussi… ».
  - Garder les questions annulées du jour sous le signalement, marquées « annulée ».
  - Confirmer par le nombre de joueurs touchés (le « 23 joueurs perdent leurs points » de jour-regles).
- **Priorité · effort** : P3 · S.

### 10. La question annulée se joue en entier, puis dit « La bonne réponse »

- **Où** : `JourApp.tsx:421-424`. La révélation écrit toujours « La bonne réponse : ». La soirée écrit « La réponse prévue » quand une question est annulée (`PlayerView.tsx:776`), parce qu'on l'annule d'ordinaire quand la réponse attendue est fausse.
- **Constat** : Léo arrive à la question annulée. Rien ne l'annonce : il la joue avec son chrono, puis lit « Question annulée : elle ne compte pour personne. La bonne réponse : ◆ 2007 », et le lien « Signaler une erreur dans cette question » est toujours là.
- **Preuve** : `06-admin.ts` (« Léo »), captures `AD-leo-question-annulee.png`, `AD-leo-revelation-annulee.png`.
- **Statut** : friction confirmée (rejouée). Écart avec la soirée.
- **Piste** :
  - `r.annulee ? 'La réponse prévue' : 'La bonne réponse'`.
  - Taire le lien « Signaler » sur une question annulée.
  - Au mieux, porter `annulee` dans `QuestionDuJour` et l'afficher avant qu'on joue, sur le bandeau « Réponses closes ».
- **Priorité · effort** : P3 · S.

### 11. Sans réseau au chargement, la page d'erreur n'a pas de « Réessayer »

- **Où** : `JourApp.tsx:171-180`, dans `.center-page` (`styles.css:340`).
- **Constat** : « Pas de réseau — vérifie ton Wi-Fi ou ta 4G, puis réessaie » s'affiche en demi-colonne, collé à un unique bouton « Retour à l'accueil » placé à sa droite. Il n'y a rien pour réessayer, et le retour à l'accueil échoue aussi hors ligne.
- **Preuve** : `02-travers.ts K`, capture `K1-sans-reseau-au-chargement.png`.
- **Statut** : friction confirmée (rejouée).
- **Piste** : un bouton primaire « Réessayer » (`location.reload()`) sous le message, et la mise en colonne.
- **Priorité · effort** : P3 · S.

### 12. Petites cibles, mots, toasts

- **Constat** :
  - **Cibles sous 44 px** :
    - « Signaler une erreur dans cette question » mesure 281 × 22 px, au ras du bas de l'écran (`styles.css:5197`) ;
    - les onglets du classement (Aujourd'hui, Hier, le mois) font 34 px de haut (`.onglets-petits .onglet`, `styles.css:5247`) ;
    - « Déjà 2 joueurs aujourd'hui » fait 150 × 18 px.
  - **« Le classement du mois »** (`components/Jour.tsx`, `MesJours`) ouvre `/jour#classement`, qui s'affiche sur « Aujourd'hui » (`JourApp.tsx:637`). Capture `S5-lien-classement-du-mois.png`.
  - **Soi-même à la troisième personne** : sur sa propre carte, le vainqueur lit « Camille a gagné hier » (`20-lendemain-accueil.png`).
  - **Les toasts** couvrent le chrono et « Question n / 10 » pendant une question (`C1…`, `H1…`, `MN4…`), et survivent à la question suivante (`12-question-6.png`).
- **Statut** : frictions confirmées (mesurées).
- **Piste** :
  - Une ligne `min-height: 44px` pour `.lien-signaler` et `.onglets-petits .onglet`.
  - `#classement-mois` lu par `Classement` comme onglet de départ.
  - « Tu as gagné hier » quand le lecteur est le vainqueur.
  - Pendant une question, le toast sous la grille, ou effacé au changement de question.
- **Priorité · effort** : P3 · S.

## Mesures et cartes

### Le parcours d'une journée, en captures (360 × 640, `captures/`)

| Écran | Capture |
|---|---|
| Accueil, carte du jour « Jouer » (sous le pli : y = 275 à 489) | `01-accueil-carte-du-jour.png` |
| `/jour` à jouer | `02-jour-a-jouer.png` |
| Question (chrono 20 s affiché = durée) | `03-question-1.png` |
| Révélation juste, fausse, temps écoulé | `04-…`, `06-…`, `09-revelation-temps-ecoule.png` |
| Réponses closes, en attendant la révélation (2,4 s) | `08-question-3-reponses-closes.png` |
| Signaler (clavier ouvert d'office), merci | `10-signaler-dialogue.png`, `11-signale-merci.png` |
| Dernière révélation, « Voir mon résultat » | `13-derniere-revelation.png` |
| Fin de partie (tient en 887 px) | `14b-fin-page-entiere.png` |
| Classement du jour, hier vide, mois | `15-…`, `16-…`, `17-classement-mois.png` |
| Correction | `18b-correction-page-entiere.png` |
| Accueil après la partie | `19-accueil-joue.png` |
| Lendemain : accueil (sans laurier), « Hier, au quiz du jour » + palier, correction d'hier, classement figé avec laurier, vu du second | `20-…` à `24-lendemain-hugo.png` |
| Profil, onglet Trophées après passage par `/jour` | `26-profil-carriere.png` |
| Halloween (la Citrouille, 0 sur 3), reprise depuis l'accueil (chrono repris à 14 s) | `S1-…`, `S2-…`, `S3-reprise.png` |
| Invité sans profil ; après connexion, retour à l'accueil (pas à `/jour`) | `L1-anonyme-jour.png`, `L2-…`, `L3-apres-connexion.png` |
| Administration, 1366 × 768 et 360 × 640 | `AD-portable-*.png`, `AD-telephone-*.png` |
| Contenu « IA » : 360 × 640, 130 %, 412 × 915 | `T-Pauline-*`, `T-Paul-*`, `T-Grace-*` |

### Les chemins de travers

| Chemin | Ce qui arrive | Ce qu'il faudrait |
|---|---|---|
| Recharger en pleine question | Le chrono **reprend** : 20 → 14 → 14 s (`A1`, `A2`) | — (tient) |
| Deux onglets | Même question, même échéance. L'onglet 2 qui touche une autre réponse reçoit la révélation du premier toucher (« Bien joué ») | — (tient) |
| Réseau coupé en répondant, revenu avant l'échéance | « Ta réponse n'est pas partie — touche-la à nouveau » + toast ; retouchée, révélée (`C1`, `C2`) | — (tient) |
| Réseau revenu **après** l'échéance | Figée sur « Réponses closes », sans bouton (`D2`) | Réessayer seule, et sur `online` (constat 1) |
| Double toucher sur deux réponses | Le premier compte, pas de toast (`E1`) | — (tient) |
| Double toucher sur « Question suivante » | Répond à la question suivante sans l'avoir lue (`Fa2`) | 400 ms de garde (constat 2) |
| Page gelée une minute (CDP) | Révélée 300 ms après le dégel (`Q1`) | — (tient) |
| Serveur qui redémarre (disque effacé) | 503 : « Le serveur redémarre… » + « touche-la à nouveau » ; après, la partie reprend, points gardés (`H1`, `H2`) | Une seule consigne ; attendre le réveil (constat 6) |
| Réponse arrivée après l'échéance | « Envoi… » puis « Trop tard ! Ta réponse est arrivée après la fin. » (`I1`, `I2`) | — (tient) |
| Réponse de « Question suivante » perdue | « Temps écoulé » sur une question jamais vue (`R2`) | Relancer seule ; dire la coupure (constat 5) |
| Réponse touchée après minuit | Refus + « touche-la à nouveau », en boucle (`MN4`) | Afficher le refus, relire l'état (constat 6) |
| « Question suivante » après minuit | « Pas de quiz aujourd'hui : la réserve est vide » (`MN2`) | jour-regles n° 5 |
| Recharger une révélation | La même révélation (`N1`) | — (tient) |
| Recharger la dernière révélation | Saute à la fin : l'anecdote de la dernière question n'est plus que dans la correction (`N2`) | Montrer la dernière révélation d'abord (P3, non compté) |
| `/jour` sans réseau au chargement | Message en demi-colonne, seul bouton « Retour à l'accueil » (`K1`) | « Réessayer » (constat 11) |
| Invité sans profil | Invitation calme, « Me connecter à mon profil » → l'accueil (`L1`) | — (invariant 8 tenu) ; revenir à `/jour` après connexion serait un plus |
| Horloge du téléphone décalée (fixe) | Chrono juste, même à 50 290 s d'écart | — (tient) |
| Horloge du téléphone qui se recale de ±30 s | +30 : questions closes à l'affichage ; −30 : 50 s affichées, « Trop tard ! » (`P-*`) | Remesurer (constat 8) |

### Tailles (contenu « IA », dix questions avec anecdote)

| Gabarit | Questions qui dépassent l'écran | Révélations dont « Question suivante » est sous le pli | Défilement à l'arrivée de la question suivante | Chrono visible à l'arrivée |
|---|---|---|---|---|
| 360 × 640 | 1 sur 10 (la question aux quatre réponses de 114 caractères, 788 px) | 1 sur 10 | 0 px | oui |
| 360 × 640, texte à 130 % | 10 sur 10 | 9 sur 10 | 192 à 226 px | **non** (haut à −54 ou −88 px) |
| 412 × 915 | 0 | 0 | 0 px | oui |

La consigne demande « quatre réponses courtes », mais la réserve en accepte jusqu'à 120 caractères. Borner les réponses du jour à une soixantaine de caractères garderait la grille dans l'écran : c'est à trancher avec jour-regles et bibliothèque.

### Temps mesurés (localhost, charge 0,2 à 1,4)

| Mesure | Valeur |
|---|---|
| Question de 15 s laissée filer : révélation affichée | à 17,4 s (échéance + 2,1 s de rendez-vous + requête) |
| Question de 20 s, téléphone à 50 290 s de l'horloge du jour | révélée à 22,4 s |
| Page gelée 60 s | révélation 300 ms après le dégel |
| Réponse (`repondre`) en local | ≈ 60 à 160 ms |

## Ce qui marche — à ne pas casser

- **Le chrono est au serveur, et l'écran le suit.** `echeance` est une heure du serveur, recalée par chaque `etat`, `commencer` et `suivante` (`avecLHeure`). Le rechargement, le second onglet, le redémarrage et la page gelée retrouvent tous la même échéance. Un téléphone réglé de travers affiche quand même les bonnes secondes.
- **« Réponses closes » à l'échéance, lue à l'heure du serveur** (`useEchue`). On ne promet jamais une réponse que le serveur refuserait.
- **Une réponse perdue se retouche, et un doublon ne paie rien.** La coupure avant l'échéance se rattrape d'un toucher.
- **La révélation apprend** : la question rappelée au-dessus du résultat (« La bonne réponse : Faux » ne dirait rien seule), la jauge « Trouvée par », l'anecdote. À 360 × 640, tout tient dans l'écran pour un contenu ordinaire.
- **La fin de partie dit tout sans défiler longtemps** : points, place « pour l'instant », expérience et part des points possibles, médaille avec ses seuils, série. Le lendemain le raconte en une carte, palier compris.
- **La correction** : juste et faux, la part de la salle, « Tu avais dit ». Elle est ouverte à qui a fini, puis à tous après minuit.
- **L'invité anonyme** ne voit ni « Niv. 0 » ni manque, seulement une invitation (invariant 8).
- **Les mots d'erreur sont ceux de `MOTIFS`** : courts, en français, et ils disent quoi faire.
- **L'administration à 360 × 640** n'a aucune cible sous 44 px, et « Masquer du classement » demande confirmation.

## Recommandations, dans l'ordre

1. Relancer seule la lecture de l'état : tant qu'une question échue n'est pas révélée, au retour du réseau (`online`), et après un `suivante` ou `commencer` raté (constats 1 et 5, première moitié). **P2 · S**
2. 400 ms de garde sur les réponses après l'affichage d'une question (constat 2). **P2 · S**
3. `aria-live="polite"` sur le jeu, ou le focus sur l'intitulé puis sur le résultat (constat 3). **P2 · S**
4. `window.scrollTo(0, 0)` à chaque écran du jour (constat 4). **P2 · S**
5. Distinguer refus et coupure dans `repondre` : afficher le refus, relire l'état, attendre le réveil sur un 503 (constat 6). **P3 · S**
6. Clore la nuit avant de lire le profil dans `detailDe` (constat 7). **P3 · S**
7. `resetClock()` au chargement et au retour au premier plan (constat 8). **P3 · S**
8. Les réponses et leurs formes dans les signalements, les annulées du jour gardées en vue, une confirmation chiffrée (constat 9). **P3 · S**
9. « La réponse prévue » et pas de « Signaler » sur une question annulée (constat 10) ; « Réessayer » sur la page d'erreur (constat 11) ; 44 px, lien du mois, « Tu as gagné hier », toasts hors du chrono (constat 12). **P3 · S**
10. Dire « partie pendant la coupure » quand la page n'a jamais montré la question révélée (constat 5, seconde moitié). À régler avec jour-regles. **P2 · M**

## Limites

- **Pas de vrai téléphone.** Le clavier virtuel, TalkBack, le gel réel d'un onglet Android et la 4G restent à vérifier sur un appareil. Le texte agrandi est un zoom CSS, qui réagit un peu autrement que la taille de police d'Android.
- **Le double toucher est rejoué en local** (20 à 60 ms de réponse), et avec 300 ms de latence ajoutée. Sur Render et Turso, `suivante` prend plus longtemps : un double toucher rapide tombera plus souvent sur le bouton grisé. Le second toucher « parce que rien ne bouge » reste pleinement exposé.
- **Le recalage d'horloge est simulé.** Je n'ai pas mesuré combien de téléphones se recalent de plusieurs secondes en cours de partie.
- **La partie serveur n'est pas dans mon angle** : justesse des règles, triche, clôture de la nuit. Les points communs sont renvoyés à jour-regles.

## Hors mission

- **Le recompte d'une annulation écrit `profiles.xp` en pleine soirée** : déjà signalé par jour-regles (hors mission) pour `invariants`.
- **La fin de partie ne fête ni niveau, ni finition, ni emoji de collection** : c'est recompenses-vitrine n° 1. La capture `14b-fin-page-entiere.png` le montre pour le niveau 2.
- **Un fichier non suivi `server/undefined`** est apparu pendant l'audit, le 27 septembre à 6 h 51 : une base SQLite qui contient une seule table `t (d TEXT)`. Il ne vient d'aucun de mes scripts. Il ressemble à un `new Database(undefined)` resté dans les reproductions d'un autre expert (recompenses-comptes tournait à ce moment-là). À effacer.
