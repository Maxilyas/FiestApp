# La mémoire de Claude, refaite pour ce dépôt

Le 7 octobre 2026, le propriétaire a demandé d'optimiser la mémoire du projet
selon les meilleures pratiques, sans perdre la qualité des réponses et en
économisant des tokens. Ce rapport dit ce qui a été mesuré, ce que disent les
sources, ce qui a changé et comment on l'a vérifié. La table de la fin dit où
chaque bloc de l'ancien `CLAUDE.md` est allé : rien n'a été jeté.

## Ce qui a été mesuré avant

- **`CLAUDE.md` : 907 lignes, 122 104 caractères** — de l'ordre de 35 000 à
  40 000 tokens, chargés au début de chaque session, relus (au tarif du cache)
  à chaque requête, réinjectés après chaque `/compact`, et donnés à **chaque
  sous-agent** sauf Explore et Plan. La carte du code en faisait 56 % (des
  cases de tableau jusqu'à 4 500 caractères), les pièges 22 %, les
  invariants 13 %. Il avait pris 60 % en trois jours (79 Ko le 3 octobre,
  126 Ko le 6).
- **La tablée** lançait ses convives en `general-purpose` : chacun recevait
  les 122 000 caractères, alors que sa consigne lui interdit de lire la
  documentation. 35 agents en parallèle avaient vidé la réserve d'usage de
  cinq heures en 25 minutes (`retours/2026-09-24/synthese.md`).
- **`npm run verify`** renvoyait 517 Ko (10 337 lignes), dont 97 % de
  rapport TAP sur 1 177 épreuves. Une commande qui échoue ne rend à Claude
  que 10 000 caractères, pris dans ses **30 000 premiers** et sans chemin vers
  la suite (doc des outils, et vérifié ici par une commande simulée) :
  l'épreuve en échec n'y était jamais.

## Ce que disent les sources

- **Anthropic, la mémoire** (code.claude.com/docs/en/memory) : « target under
  200 lines per CLAUDE.md file. Longer files consume more context and reduce
  adherence » ; ce qui ne vaut que pour une partie du code va dans une règle
  à chemin (`.claude/rules/`, `paths:`), chargée quand Claude lit, écrit ou
  modifie un fichier qui correspond ; les `@imports` se chargent tous au
  démarrage et n'économisent rien ; les commentaires HTML sont retirés avant
  l'injection.
- **Anthropic, les bonnes pratiques** (…/best-practices) : pour chaque ligne,
  « Would removing this cause Claude to make mistakes? » ; ne pas écrire les
  « file-by-file descriptions of the codebase » ni ce que le code dit déjà ;
  « Bloated CLAUDE.md files cause Claude to ignore your actual instructions ».
- **Anthropic, les coûts** (…/costs) : garder `CLAUDE.md` sous 200 lignes,
  mettre les procédures dans des skills, filtrer les sorties bavardes des
  tests, déléguer ce qui est verbeux à des sous-agents.
- **Anthropic, les sous-agents** (…/sub-agents) : chaque sous-agent reçoit
  `CLAUDE.md`, sauf Explore et Plan ; `omitClaudeMd: true` l'en dispense
  (Claude Code 2.1.271 ou plus).
- **Anthropic, l'ingénierie du contexte** (anthropic.com/engineering) :
  « the smallest possible set of high-signal tokens », et le contexte chargé
  « just in time ».
- **IFScale** (arXiv 2507.11538) : plus d'instructions, moins bien suivies —
  de façon linéaire pour Claude Sonnet 4 —, et les premières l'emportent.
  **Chroma, « Context Rot »** : 18 modèles se dégradent quand le contexte
  s'allonge, même sur une tâche simple. **HumanLayer** : une centaine
  d'instructions par projet au plus, et des renvois plutôt que des copies.

## Ce qui a changé

- **`CLAUDE.md` : 138 lignes, environ 20 700 caractères.** Il garde ce qui
  vaut partout : les commandes, la façon de travailler, une carte d'une ligne
  par domaine, les 22 invariants (dix résumés, en entier dans leur règle), les
  conventions, les deux environnements, ce qu'il ne faut pas faire, et ce qu'il
  faut garder quand la conversation se compacte.
- **`.claude/rules/` : 23 règles à chemin**, de 400 à 10 000 caractères, qui
  reprennent mot pour mot les lignes de la carte et les pièges de leur
  domaine. Une règle n'arrive que quand Claude ouvre un de ses fichiers avec
  Read (ou l'écrit avec Edit, Write), une seule fois par session ; d'où la
  première consigne de la racine : lire le code avec Read, pas par le shell.
- **Trois skills** pour les procédures en plusieurs étapes : `peindre`,
  `regarder-le-rendu`, `base-campagne`. Seule leur description reste chargée.
- **Les agents qui n'ont pas besoin de la mémoire ne la reçoivent plus** :
  `omitClaudeMd: true` pour `redacteur-campagne` et `relecteur-campagne`, et
  un agent `convive` pour les personnages de la tablée — un invité qui
  ignore le code joue aussi plus juste.
- **Les tests parlent court à Claude** : `npm test` passe par
  `server/scripts/tests.mjs`, qui choisit le compte rendu `dot` quand
  `CLAUDECODE=1` (posé par Claude Code dans chacune de ses commandes) — un
  point par épreuve, les échecs en entier à la fin. Un terminal et la CI
  gardent l'affichage d'avant.
- **Les garde-fous** : `notes-pour-claude.test.ts` garde la racine sous
  200 lignes, refuse une règle dont l'en-tête ne se lirait pas (elle se
  chargerait partout), un motif qui ne désigne plus aucun fichier, une règle
  absente de la carte, un fichier cité qui a disparu ; `divins.test.ts` relit
  aussi les règles.

## Ce qui a été vérifié

- **Le chargement à la demande**, sur Claude Code 2.1.292 : une règle à
  chemin et un `CLAUDE.md` de sous-dossier, posés pour l'essai, sont arrivés
  à la lecture d'un fichier par Read, une seule fois ; rien par `cat`. Pendant
  la refonte, modifier l'agent `redacteur-campagne` a fait arriver
  `campagne-base.md`, et lire un test, `tests.md`.
- **Rien ne se perd** : un script a découpé l'ancien `CLAUDE.md` en 193 blocs
  et vérifié que chacun se retrouve, une fois, à sa place (table plus bas).
- **Un agent garde la mémoire de sa session** : un sous-agent lancé après la
  réécriture, depuis la session qui l'avait faite, a encore cité l'ancien
  `CLAUDE.md`. Une mémoire changée ne vaut qu'à la session suivante — l'examen
  d'après s'est donc joué dans une session neuve.

## L'examen, avant et après

Six tâches tirées de l'historique du dépôt, données mot pour mot à six agents
Sonnet neufs (`general-purpose`), qui préparent leur plan sans rien modifier.
Avant : sur l'ancien `CLAUDE.md`. Après : dans une session neuve qui a cloné
la branche, puisqu'une session et ses agents gardent la mémoire de son
ouverture.

| Tâche | Avant : tokens · outils · durée | Après : tokens · outils · durée |
|---|---|---|
| T1 — une colonne au journal des réponses | 171 694 · 31 · 176 s | 64 012 · 8 · 16 s |
| T2 — un test d'expérience au point près | 193 481 · 29 · 228 s | 78 132 · 9 · 16 s |
| T3 — un thème de plus | 225 834 · 35 · 244 s | 68 093 · 7 · 17 s |
| T4 — le rappel du soir à 17 h | 159 726 · 25 · 176 s | 69 927 · 9 · 22 s |
| T5 — remélanger les équipes | 165 064 · 37 · 192 s | 77 552 · 14 · 23 s |
| T6 — corriger une question de la campagne | 164 895 · 26 · 183 s | 61 500 · 6 · 13 s |
| **Moyenne** | **180 116 · 31 · 200 s** | **69 869 · 9 · 18 s** |

Les tokens sont le compte que Claude Code donne de chaque agent à sa fin :
**61 % de moins**, et 71 % d'outils en moins. La racine plus légère n'en
explique qu'une part ; le reste vient de ce que la règle du domaine arrive
avec le premier fichier ouvert, et l'agent cherche moins.

**La qualité tient.** Les deux passes trouvent l'essentiel de chaque tâche :
les trois fichiers d'une colonne et sa perte au réveil sur disque effacé ;
`tirageEclat`, le figurant, le réflexe et le calendrier fermé ; le catalogue
trié, les contrastes, `fonds.test.ts`, l'aperçu ; la constante seule, le
délai de 355 à 415 minutes, la veille de cron-job.org ; `ecouter`,
`requireHost`, `assign()`, `team_id` figé, `garde-fous.test.ts` ;
l'identifiant neuf d'une correction de fond et les séries qui gardent leur
version.

- **L'après a manqué quelques détails** que l'avant avait trouvés dans le
  code : la liste `MIGRATIONS` de `relecture.test.ts` (T1), L'Habitué du
  Podium au troisième quiz (T2), les prix d'équipe qui lisent l'équipe
  finale et le double clic (T5).
- **Il en a trouvé d'autres** : le thème peint — `decors.ts --livrer`,
  `--surface` opaque, `rendu-themes.ts --contraste` (T3) —, `abonner()`
  après l'heure et les règles à tenir à jour (T4), la disjonction avec le
  quiz du jour (T6).
- **Une erreur, corrigée** : T2 a écrit « un podium ne rapporte jamais
  d'expérience (invariant 19) ». C'est un prix qui n'en rapporte pas ; le
  résumé de l'invariant à la racine ne citait plus les podiums. Il dit
  maintenant « un podium, si ».

Les limites : une passe par tâche, et deux versions de Claude Code (2.1.292
avant, 2.1.296 après). L'écart des tokens est large et va dans le même sens
pour les six tâches ; celui des durées dépend aussi de la machine et de
l'API.

## La table de correspondance

Chaque bloc de l'ancien `CLAUDE.md` (commit `a2ff43e`) : son repère — R, une ligne de
la carte du code ; I, un invariant ; C, une convention ; E, les environnements ;
P, un piège ; N, ce qu'il ne faut pas faire —, ses premiers mots, et où il vit
maintenant. « En entier … ; résumé dans `CLAUDE.md` » : le texte d'origine est
dans la règle, la racine en garde l'essentiel.

| Bloc | Début | Où il vit |
|---|---|---|
| INTRO | # Notes pour Claude Quiz de soirée façon Kahoot, auto-hébergé. Les inv… | `CLAUDE.md` — premier paragraphe tel quel, le second réécrit (l'organisation de la mémoire) |
| CMD | ```bash npm run verify # typecheck + tests + build + test de bout en b… | `CLAUDE.md` |
| CARTE0 | ``` shared/ types et fonctions PURES, partagés client ↔ serveur ↔ test… | `CLAUDE.md` |
| R001 | `core/engine.ts` | `.claude/rules/soiree-moteur.md` |
| R002 | `games/quiz.ts` | `.claude/rules/soiree-moteur.md` |
| R003 | `core/space.ts` | `.claude/rules/soiree-salle.md` |
| R004 | `core/party.ts` | `.claude/rules/soiree-salle.md` |
| R005 | `core/salons.ts` | `.claude/rules/soiree-salle.md` |
| R006 | `core/places.ts` | `.claude/rules/soiree-salle.md` |
| R007 | `core/scores.ts` | `.claude/rules/journaux-et-miroir.md` |
| R008 | `core/answers.ts` | `.claude/rules/journaux-et-miroir.md` |
| R009 | `core/backup.ts` | `.claude/rules/journaux-et-miroir.md` |
| R010 | `core/distante.ts` | `.claude/rules/journaux-et-miroir.md` |
| R011 | `core/archive.ts` | `.claude/rules/cloture-et-archives.md` |
| R012 | `core/recap.ts` `review.ts` `stats.ts` `progress.ts` | `.claude/rules/cloture-et-archives.md` |
| R013 | `core/journal.ts` | `.claude/rules/cloture-et-archives.md` |
| R014 | `core/hautsfaits.ts` | `.claude/rules/recompenses.md` |
| R015 | `core/recalcul.ts` | `.claude/rules/recompenses.md` |
| R016 | `shared/hautsfaits.ts` `shared/legendaires.ts` | `.claude/rules/recompenses.md` |
| R017 | `shared/fin.ts` | `.claude/rules/cloture-et-archives.md` |
| R018 | `shared/liens.ts` · `client/src/components/Lendemain.tsx` | `.claude/rules/cloture-et-archives.md` |
| R019 | `shared/carte.ts` · `core/carte.ts` | `.claude/rules/profil.md` |
| R020 | `shared/saisons.ts` · `core/saisons.ts` | `.claude/rules/recompenses.md` |
| R021 | `shared/fonds.ts` | `.claude/rules/themes.md` |
| R022 | `shared/themes.ts` · `client/src/themeJoueur.ts` · `client/src/themes/… | `.claude/rules/themes.md` |
| R023 | `shared/calendrier.ts` · `client/src/components/Calendrier.tsx` · `cal… | `.claude/rules/jour.md` |
| R024 | `shared/gerbes.ts` · `client/src/gerbe.ts` · `components/Gerbe.tsx` | `.claude/rules/themes.md` |
| R025 | `client/src/components/Ouverts.tsx` · `EntreeEnScene.tsx` | `.claude/rules/medaillons.md` |
| R026 | `server/scripts/rendu-recompenses.ts` | `.claude/skills/regarder-le-rendu/SKILL.md` |
| R027 | `server/scripts/rendu-jour.ts` | `.claude/skills/regarder-le-rendu/SKILL.md` |
| R028 | `server/scripts/rendu-profil.ts` | `.claude/skills/regarder-le-rendu/SKILL.md` |
| R029 | `server/scripts/apercus-themes.ts` | `.claude/rules/themes.md` |
| R030 | `shared/ecussons.ts` · `client/src/components/Ecusson.tsx` | `.claude/rules/recompenses.md` |
| R031 | `core/objectifs.ts` | `.claude/rules/cloture-et-archives.md` |
| R032 | `shared/jour.ts` · `core/jour.ts` · `server/src/quizDuJour.ts` · `clie… | `.claude/rules/jour.md` |
| R033 | `shared/jour.ts` (`HEURE_DU_RAPPEL`) · `core/rappels.ts` · `core/pouss… | `.claude/rules/rappel-et-installation.md` |
| R034 | `client/src/installation.ts` · `components/Installer.tsx` | `.claude/rules/rappel-et-installation.md` |
| R035 | `shared/campagne.ts` · `core/campagne.ts` · `server/src/campagne.ts` ·… | `.claude/rules/campagne.md` |
| R036 | `shared/sentiers.ts` · `CampagneStore` (les sentiers) · `client/src/vi… | `.claude/rules/sentiers.md` |
| R037 | `core/baremeDuSolo.ts` | `.claude/rules/campagne.md` |
| R038 | `core/baseCampagne.ts` · `server/scripts/base-campagne.ts` · `server/c… | `.claude/rules/campagne-base.md` |
| R039 | `shared/etiquettes.ts` · `core/etiquetage.ts` | `.claude/rules/jour-reserve.md` |
| R040 | `core/consigne.ts` | `.claude/rules/jour-reserve.md` |
| R041 | `shared/glossaire.ts` · `client/src/components/Glossaire.tsx` | `.claude/rules/client.md` |
| R042 | `shared/categories.ts` | `.claude/rules/bibliotheque.md` |
| R043 | `shared/echange.ts` | `.claude/rules/bibliotheque.md` |
| R044 | `shared/hasard.ts` | `.claude/rules/soiree-moteur.md` |
| R045 | `shared/programme.ts` · `core/programmes.ts` | `.claude/rules/soiree-moteur.md` |
| R046 | `core/memoire.ts` | `.claude/rules/bibliotheque.md` |
| R047 | `shared/partage.ts` · `core/partages.ts` · `server/src/partages.ts` | `.claude/rules/bibliotheque.md` |
| R048 | `shared/modeles.ts` · `shared/emojis.ts` | `.claude/rules/bibliotheque.md` |
| R049 | `shared/liste.ts` | `.claude/rules/bibliotheque.md` |
| R050 | `client/src/components/Legendaire.tsx` · `legendaires-peints.ts` | `.claude/rules/medaillons.md` |
| R051 | `client/src/components/medaillons.ts` | `.claude/rules/medaillons.md` |
| R052 | `client/src/components/Lumiere.tsx` | `.claude/rules/medaillons.md` |
| R053 | `shared/branches.ts` · `client/src/components/Portrait.tsx` · `portrai… | `.claude/rules/medaillons.md` |
| R054 | `shared/divins.ts` · `core/divins.ts` | `.claude/rules/recompenses.md` |
| R055 | `client/src/components/Divin.tsx` · `divins-peints.ts` | `.claude/rules/medaillons.md` |
| R056 | `core/inscriptions.ts` | `.claude/rules/auth-et-admin.md` |
| R057 | `core/pages.ts` | `.claude/rules/cloture-et-archives.md` |
| R058 | `core/pouls.ts` | `.claude/rules/exploitation.md` |
| R059 | `core/precompresse.ts` | `.claude/rules/exploitation.md` |
| R060 | `core/http.ts` | `.claude/rules/exploitation.md` |
| R061 | `auth/store.ts` | `.claude/rules/auth-et-admin.md` |
| R062 | `auth/profiles.ts` | `.claude/rules/auth-et-admin.md` |
| R063 | `auth/profilUnique.ts` | `.claude/rules/auth-et-admin.md` |
| R064 | `auth/profileRoutes.ts` | `.claude/rules/auth-et-admin.md` |
| R065 | `client/src/views/AdminApp.tsx` · `server/src/profilsAdmin.ts` · `clie… | `.claude/rules/auth-et-admin.md` |
| R066 | `auth/http.ts` | `.claude/rules/auth-et-admin.md` |
| R067 | `auth/appairage.ts` | `.claude/rules/auth-et-admin.md` |
| R068 | `client/src/views/ProfilApp.tsx` · `components/AccueilDesRoles.tsx` · … | `.claude/rules/profil.md` |
| R069 | `client/src/views/SalonApp.tsx` · `components/BarreDuChef.tsx` · `sock… | `.claude/rules/soiree-salle.md` |
| R070 | `client/src/components/SpaceNav.tsx` | `.claude/rules/cloture-et-archives.md` |
| R071 | `client/src/components/HistoriqueDuCompte.tsx` | `.claude/rules/cloture-et-archives.md` |
| R072 | `client/src/components/NavAnimateur.tsx` | `.claude/rules/client.md` |
| R073 | `client/src/components/Apparence.tsx` · `Trophees.tsx` · `shared/proch… | `.claude/rules/profil.md` |
| R074 | `shared/collection.ts` · `client/src/components/Collection.tsx` · `Tro… | `.claude/rules/profil.md` |
| R075 | `shared/avatars.ts` | `.claude/rules/profil.md` |
| R076 | `shared/adresses.ts` · `core/apercus.ts` | `.claude/rules/client.md` |
| R077 | `shared/depart.ts` · `core/page.ts` | `.claude/rules/client.md` |
| R078 | `client/src/onglets.ts` | `.claude/rules/client.md` |
| R079 | `sockets.ts` | `.claude/rules/soiree-salle.md` |
| R080 | `shared/events.ts` | `.claude/rules/soiree-salle.md` |
| R081 | `shared/homonymes.ts` | `.claude/rules/soiree-salle.md` |
| R082 | `shared/classement.ts` | `.claude/rules/soiree-moteur.md` |
| R083 | `shared/course.ts` · `client/src/games/quiz/Course.tsx` | `.claude/rules/soiree-moteur.md` |
| R084 | `shared/teams.ts` | `.claude/rules/soiree-moteur.md` |
| R085 | `shared/nombres.ts` | `.claude/rules/bibliotheque.md` |
| R086 | `shared/securite.ts` | `.claude/rules/auth-et-admin.md` |
| R087 | `shared/erreurs.ts` | `.claude/rules/client.md` |
| R088 | `shared/reveil.ts` | `.claude/rules/client.md` |
| R089 | `shared/brouillon.ts` · `client/src/brouillon.ts` | `.claude/rules/bibliotheque.md` |
| R090 | `client/src/components/Entree.tsx` · `IdentifiantDiscret.tsx` | `.claude/rules/client.md` |
| R091 | `client/src/components/Liaison.tsx` | `.claude/rules/soiree-salle.md` |
| R092 | `client/src/components/Absents.tsx` · `Reprendre.tsx` | `.claude/rules/soiree-salle.md` |
| R093 | `client/src/components/Coupe.tsx` | `.claude/rules/ecran-commun.md` |
| R094 | `server/scripts/rendu-ecran.ts` | `.claude/skills/regarder-le-rendu/SKILL.md` |
| R095 | `server/scripts/mesure-pages.ts` | `.claude/rules/client.md` |
| R096 | `server/scripts/sauvegarde.ts` | `.claude/rules/exploitation.md` |
| R097 | `server/scripts/empaqueter.ts` · `server/src/racine.ts` | `.claude/rules/exploitation.md` |
| R098 | `server/scripts/calibrage.ts` | `.claude/rules/recompenses.md` |
| R099 | `server/scripts/anime/styles.ts` · `gemini.ts` · `consignes.ts` · `ath… | `.claude/skills/peindre/SKILL.md` |
| R100 | `server/scripts/anime/portraits.ts` · `pixels.ts` · `livrer.ts` | `.claude/skills/peindre/SKILL.md` |
| R101 | `server/scripts/anime/legendaires.ts` · `server/scripts/planche-medail… | `.claude/skills/peindre/SKILL.md` |
| R102 | `server/scripts/anime/decors.ts` · `client/src/components/calendrier-p… | `.claude/skills/peindre/SKILL.md` |
| R103 | `server/scripts/tablee/regie.ts` · `pilote.mjs` | `.claude/rules/tablee.md` |
| R104 | `retours/<date>/synthese.md` | `CLAUDE.md` |
| I01 | La logique de jeu est 100 % serveur. Les clients reçoivent `playerView… | `CLAUDE.md` |
| I02 | Deux bases, deux rôles. La locale (SQLite) est jetable et « Nouvelle s… | `CLAUDE.md` |
| I03 | Tout est cloisonné par `space_id`. Un identifiant qui n'est pas du sie… | `CLAUDE.md` |
| I04 | L'instantané est dédoublonné et regroupé (`space.ts`). N'y mets jamais… | en entier : `.claude/rules/soiree-salle.md` ; résumé dans `CLAUDE.md` |
| I05 | Les chronomètres sont persistés et réarmés au redémarrage. | `CLAUDE.md` |
| I06 | Une échéance se lit à `serverNow()`, jamais à `Date.now()` : l'horloge… | `CLAUDE.md` |
| I07 | Toute réponse d'invité reçoit un accusé, et tout message d'un client p… | `CLAUDE.md` |
| I08 | Un profil ne donne aucun avantage de jeu, et un invité anonyme n'affic… | `CLAUDE.md` |
| I09 | La fiche du serveur fait foi. Un `player:join` qui porte un jeton est … | en entier : `.claude/rules/soiree-salle.md` ; résumé dans `CLAUDE.md` |
| I10 | L'expérience d'un quiz se crédite dès qu'il rend son verdict (son podi… | en entier : `.claude/rules/cloture-et-archives.md` ; résumé dans `CLAUDE.md` |
| I11 | Le nom d'une soirée se tire une fois (`soireeEnCours`) et ne se recalc… | en entier : `.claude/rules/cloture-et-archives.md` ; résumé dans `CLAUDE.md` |
| I12 | Un geste dit ce qu'il visait. Les commandes `next`, `cancel`, `replay`… | `CLAUDE.md` |
| I13 | Rien ne se perd en route vers le miroir. Chaque écriture de la soirée … | `CLAUDE.md` |
| I14 | Les dérivations restent pures. La soirée en cours et une archive passe… | `CLAUDE.md` |
| I15 | Un classement passe par `shared/classement.ts`. Rang = 1 + le nombre d… | `CLAUDE.md` |
| I16 | Une personne, deux tables — et `accounts.id` ne bouge jamais. Un compt… | en entier : `.claude/rules/auth-et-admin.md` ; résumé dans `CLAUDE.md` |
| I17 | Les homonymes se règlent à l'affichage, jamais à la saisie. On ne refu… | `CLAUDE.md` |
| I18 | L'historique s'écrit tout seul, et la soirée n'a qu'un geste de fin. E… | en entier : `.claude/rules/cloture-et-archives.md` ; résumé dans `CLAUDE.md` |
| I19 | L'expérience se mérite, et ne redescend jamais en cours de soirée. En … | en entier : `.claude/rules/recompenses.md` ; résumé dans `CLAUDE.md` |
| I20 | Les récompenses sont des dérivations des journaux, comme le souvenir :… | en entier : `.claude/rules/recompenses.md` ; résumé dans `CLAUDE.md` |
| I21 | Les règles des Divins ne quittent jamais le serveur. Elles vivent dans… | `CLAUDE.md` |
| I22 | Durcir un légendaire, la courbe des niveaux ou les seuils des branches… | en entier : `.claude/rules/recompenses.md` ; résumé dans `CLAUDE.md` |
| C01 | Commentaires en français, et ils disent pourquoi, pas *quoi*. Un comme… | `CLAUDE.md` |
| C02 | Noms : anglais pour l'infrastructure historique (`Party`, `ScoreLedger… | `CLAUDE.md` |
| C03 | Très peu de dépendances, et c'est voulu. N'en ajoute pas sans raison f… | `CLAUDE.md` |
| C04 | Emojis antérieurs à Unicode 13 uniquement : l'écran commun tourne sous… | `CLAUDE.md` |
| C05 | Les messages d'erreur sont lus par des invités dans le noir : courts, … | `CLAUDE.md` |
| C06 | Une erreur faite pour être lue se lève avec un `new Error('…')` nu, sa… | `CLAUDE.md` |
| C07 | Un texte se coupe avec `tronquer()` (`shared/avatars.ts`), jamais avec… | `CLAUDE.md` |
| C08 | Un nombre tapé se lit avec `lireNombre()` (`shared/nombres.ts`), jamai… | `CLAUDE.md` |
| C09 | Une précision ne compte que les QCM, et dit sur combien (« 50 % · 1 su… | `CLAUDE.md` |
| C10 | Ce qui ne dépend pas du destinataire d'une vue — un classement, un pod… | `.claude/rules/soiree-moteur.md` |
| C11 | Côté client : `--accent-text` pour ce qui s'écrit, `--accent-text-hove… | partagé : les jetons dans `.claude/rules/css.md`, le stockage sous try/catch dans `CLAUDE.md` |
| E01 | Deux services Render : la production (déployée à la main) et la prépro… | en entier : `.claude/rules/exploitation.md` ; résumé dans `CLAUDE.md` |
| E02 | Les noms : `fiestapp-quizz` (production) et `fiestapp-quizz-preprod`, … | `.claude/rules/exploitation.md` |
| E03 | La veille : l'offre gratuite endort un service après 15 minutes sans t… | `.claude/rules/exploitation.md` |
| E04 | Jamais la même base Turso pour les deux : un « C'était un essai » en p… | `CLAUDE.md` |
| P01 | `smoke.ts` est stateful de bout en bout. Une soirée jouée insérée au m… | `.claude/rules/tests.md` |
| P02 | Un fichier de tests a deux minutes, pas seulement une épreuve : sous N… | `.claude/rules/tests.md` |
| P03 | Le serveur envoie l'instantané juste derrière l'accusé de `host:hello`… | `.claude/rules/tests.md` |
| P04 | Le démarrage ouvre ses magasins de front (`deFront`, `server.ts`) : ap… | `.claude/rules/journaux-et-miroir.md` |
| P05 | Un chemin du serveur se compte depuis `SERVEUR` (`src/racine.ts`), jam… | `.claude/rules/exploitation.md` |
| P06 | Un serveur qu'on ferme doit éteindre ses chronomètres et vider son mir… | `.claude/rules/journaux-et-miroir.md` |
| P07 | Pas de `socket.on` direct pour un message client : `ecouter()` le fait… | `.claude/rules/soiree-salle.md` |
| P08 | `loginBudgetOf(app)`, jamais `new LoginBudget()` : toutes les portes q… | `.claude/rules/auth-et-admin.md` |
| P09 | Le nom d'une soirée porte une empreinte de son espace (`archiveIdOf`),… | `.claude/rules/cloture-et-archives.md` |
| P10 | Reprendre une soirée aux profils — un essai effacé, une soirée retirée… | `.claude/rules/cloture-et-archives.md` |
| P11 | Les crédits lisent les journaux avant le premier `await` et passent pa… | `.claude/rules/cloture-et-archives.md` |
| P12 | Le va-et-vient d'une question attend : l'écran commun reçoit le compte… | `.claude/rules/soiree-moteur.md` |
| P13 | L'Éclat est un tirage (une chance sur quarante, une sur vingt au défi)… | `.claude/rules/tests.md` |
| P14 | Un joueur seul ne rapporte rien. Un test qui veut de l'expérience invi… | `.claude/rules/tests.md` |
| P15 | Une colonne de plus au journal des réponses se pose dans trois fichier… | `.claude/rules/journaux-et-miroir.md` |
| P16 | Toute mutation de `Party` qui touche un prénom, un avatar ou la compos… | `.claude/rules/soiree-salle.md` |
| P17 | L'avatar d'un profil se lit par `avatarPorte`, jamais par `profil.avat… | `.claude/rules/profil.md` |
| P18 | L'éditeur n'envoie rien pendant qu'on écrit : le serveur s'endort sous… | `.claude/rules/bibliotheque.md` |
| P19 | Un réglage de plus à la liste collée se lit dans `parseImportedQuestio… | `.claude/rules/bibliotheque.md` |
| P20 | La bibliothèque en mémoire se relit après chaque écriture d'un espace … | `.claude/rules/bibliotheque.md` |
| P21 | Une question a trois pièces à part — sa photo, celle de la révélation,… | `.claude/rules/bibliotheque.md` |
| P22 | Une variante se juge par `reponseJuste`, jamais par `r.choice === q.co… | `.claude/rules/soiree-moteur.md` |
| P23 | Un fichier absent est un 404, pas la page d'accueil : le serveur répon… | `.claude/rules/exploitation.md` |
| P24 | `/healthz` doit rester un 200 : sur un échec, Render redémarre l'insta… | `.claude/rules/exploitation.md` |
| P25 | La place d'un invité se lit, elle ne se trie pas (`placeAuQuiz`) : à l… | `.claude/rules/soiree-moteur.md` |
| P26 | Les pages publiques se gardent (`core/pages.ts`) tant que leur emprein… | `.claude/rules/cloture-et-archives.md` |
| P27 | Simuler une panne : un déclencheur `RAISE(ABORT)` sur le fichier `file… | `.claude/rules/tests.md` |
| P28 | Le quiz du jour a son horloge (`horlogeDuJour`, `JourStore.maintenant`… | `.claude/rules/jour.md` |
| P29 | La consigne du quiz du jour ne promet rien que la réserve refuse. Elle… | `.claude/rules/jour-reserve.md` |
| P30 | Une question de la base de la campagne garde son identifiant : ses rép… | `.claude/rules/campagne-base.md` |
| P31 | Un thème de plus entre au catalogue (`shared/themes.ts`) avec sa feuil… | `.claude/rules/themes.md` |
| P32 | Un haut fait ou un prix de plus a sa place ailleurs. Un haut fait pren… | `.claude/rules/recompenses.md` |
| P33 | Une nouvelle commande `host:*` s'ajoute à la liste de `garde-fous.test… | `.claude/rules/soiree-salle.md` |
| P34 | `package-lock.json` bouge tout seul selon la version de npm. Ne le com… | `CLAUDE.md` |
| P35 | En CSS, `transform` se compose APRÈS `rotate`, et une animation qui po… | `.claude/rules/css.md` |
| P36 | Le service worker (`client/public/sw.js`) ne fait que le rappel du soi… | `.claude/rules/rappel-et-installation.md` |
| P37 | Ce qui ne sert qu'après l'entrée vient à la demande, par `aLaDemande` … | `.claude/rules/client.md` |
| P38 | Une donnée préchargée se demande à l'ouverture, par tout visiteur. La … | `.claude/rules/client.md` |
| P39 | Regarde le rendu. Plusieurs bugs de cette base n'étaient visibles qu'à… | `.claude/skills/regarder-le-rendu/SKILL.md` |
| P40 | Sur grand écran, `/host` compte en `rem`. Sa taille racine suit la hau… | `.claude/rules/ecran-commun.md` |
| P41 | Un portrait peint se refait par la chaîne, jamais à la main : `portrai… | `.claude/skills/peindre/SKILL.md` |
| P42 | La tablée lit l'écran par ses classes (`.quiz-player`, `.ans-btn`, `.g… | `.claude/rules/tablee.md` |
| N01 | Toucher aux barèmes (`CHOICE_POINTS`, `SPEED_BONUS`, `LECTURE_MS…`, `P… | `CLAUDE.md` |
| N02 | Changer les prix des thèmes (`PRIX_DES_THEMES`) ou la règle des confet… | `CLAUDE.md` |
| N03 | Changer les mélanges ou les seuils des paliers des sentiers (`PALIERS`… | `CLAUDE.md` |
| N04 | Changer les seuils des récompenses du quiz du jour et de la campagne (… | `CLAUDE.md` |
| N05 | Bouger le seuil d'un légendaire ou la courbe des niveaux (`XP_PAR_PALI… | `CLAUDE.md` |
| N06 | Rendre la connexion obligatoire. L'entrée d'une soirée est un écran de… | en entier : `.claude/rules/client.md` ; résumé dans `CLAUDE.md` |
| N07 | Supprimer ou désactiver une assertion — du smoke ou d'un test — pour l… | `CLAUDE.md` |
