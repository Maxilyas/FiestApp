---
paths:
  - "shared/sphinx.ts"
  - "server/src/sphinx.ts"
  - "server/src/core/sphinx.ts"
  - "server/content/sphinx/enigmes.json"
  - "server/test/{sphinx-pur,sphinx-accueil}.test.ts"
---

# Le Sphinx de l'accueil

Parfois, sur l'accueil d'un habitué, le Sphinx propose une énigme de 1858 ;
résolue, elle lui souffle un mot de la phrase du **Divin du moment** — sa
légende, le même Divin pour tout le serveur. Chacun voit ses mots, et combien
tous en ont trouvé, jamais lesquels. Le plan, la maquette et les énigmes
relues à l'aveugle : `retours/2026-11-24/le-sphinx/` (`plan.md` fait foi, ses
recommandations acceptées) ; la décision : « Le Sphinx de l'accueil »
(`docs/architecture/decisions.md`). **Étape 1 seulement, le 24 novembre 2026 :
le serveur, sans écran** — la visite, l'épingle, l'album et la police viennent
à l'étape 2, le QG et l'ouverture à l'étape 3.

## Les fichiers

- `server/content/sphinx/enigmes.json` — la réserve : les 86 pièces retenues (55 énigmes, 31 charades), sans les traces du test à l'aveugle, chacune ses vers, sa solution (la clé du livre ; `cle`, son découpage pour une charade), ses réponses acceptées et celles qui brûlent (sans accents ni article), sa difficulté mesurée à l'aveugle, sa page et le lien de son fac-similé. **Serveur seulement** : jamais lue par `shared/` ni `client/` — ni importée, ni citée par son chemin (`divins.test.ts`). Une pièce de plus se relit à l'aveugle d'abord (le `README.md` du dossier dit comment)
- `shared/sphinx.ts` — ce que la page reçoit, sans un secret : les types (`LeSphinx`, `VisiteDuSphinx`, `PhraseDuSphinx`, `VerdictDuSphinx`), les gestes, les états, et les barèmes que la page dira (`JOURS_DE_L_HABITUE`, `FENETRE_DE_L_HABITUE`, `ESSAIS_DU_SPHINX`)
- `server/src/core/sphinx.ts` — tout ce qui se décide : les dérivations pures d'abord — la réponse lue (`normaliser`, `jugerLaReponse`), l'habitué (`joursJoues`, sur `ActiviteDuJour.joue`, `shared/missions.ts`), la visite (`tirageDeLaVisite`, la graine `profil|jour`), l'énigme (`choisirLEnigme`), la phrase (`motsDeLaLegende`, `estUnNombre`, `phraseVue`), le mot (`choisirLeMot`), le Divin du moment (`ORDRE_DU_SPHINX`, `divinDuMoment`, `phrasesReconstituees`), le verdict (`appliquerLeGeste`) — puis la classe `Sphinx` : les mots de tous en mémoire (`pret`, `oublier`), la décision que lisent ses missions et sa route (`decider`, `poser`), `lire`, `geste`, une écriture à la fois par profil (`unALaFois`), et les énigmes que le propriétaire connaissait (`compterLesVuesDuProprietaire`, au démarrage)
- `server/src/sphinx.ts` — `GET` et `POST /api/joueur/sphinx`, pour les profils ; `sphinxFermePour`, que la ligne des missions lit aussi
- `ProfileStore` (`auth/profiles.ts`) — sa table, `profile_sphinx` : une ligne par visite (clé `profile_id`, `jour`), et une ligne `vue` par énigme comptée pour vue sans visite (son jour `vue:<numéro>`) ; ses lectures (`lecturesDuSphinx`, `visitesDuSphinx`, `motsDuSphinx`, et dans le lot de `lecturesDesMissions`), ses écritures (`poserUneVisiteDuSphinx`, `ecrireUnGesteDuSphinx`, `compterDesEnigmesPourVues`) ; un profil supprimé emporte ses lignes, et `server.ts` fait oublier les mots de tous (`sphinx.oublier`)
- `core/missions.ts` — `MissionsDuJour.sphinx` (`attend`, `epingle`), décidé dans la même lecture que les missions : ses visites dans le lot du profil, les mots de tous lus de front, la visite tirée posée de front avec le tirage des missions (`missions-charge.test.ts`)
- La maintenance (règle `qg.md`) : `sphinx` dans `PAGES_EN_MAINTENANCE`, sa porte `POST /api/joueur/sphinx` ; posée « bientôt » une fois sur une base qui ne la connaît pas (`Maintenance.init`, drapeau `sphinx_bientot_pose`) ; jamais écrite dans les pages servies (`DITES_PAR_LEUR_ROUTE`) — fermée pour lui, sa route dit `{ fermee }` et ses missions se taisent

## Les pièges

- **Une légende ne part que mot à mot** (invariant 21) : un champ de plus qui
  part vers la page passe par `phraseVue` — les mots qu'il a gagnés, les
  petits mots offerts, la forme du reste, entière à son porteur ou une fois
  reconstituée par tous. `sphinx-accueil.test.ts` cherche dans chaque réponse
  un mot caché qu'il n'a pas gagné. Ni une règle ni une légende ne s'écrit
  ici, dans `docs/`, `shared/`, `client/` ou un message de commit : l'ordre
  des Divins dit son pourquoi dans `core/sphinx.ts` seulement.
- **Un nombre n'est jamais offert**, quelle que soit sa longueur : un de ses
  morceaux suffit (`estUnNombre` — « vingt-cinq », « l'un », un chiffre).
  Quatorze petits mots des légendes en sont : offerts, ils donneraient le
  seuil d'une règle.
- **La réponse ne part qu'une fois la visite close** (`visiteDe`) : ni la
  solution ni la clé avant, ni jamais les réponses acceptées ou qui brûlent.
  Les deux côtés se lisent par `normaliser`, sans espaces (`jugerLaReponse`) :
  « pente-côte » et « pentecôte » sont la même réponse. Une acceptée qui
  brûle aussi est juste.
- **Rien ne s'écrit à côté des visites** : ses mots, ses énigmes vues, les
  mots de tous et le Divin du moment s'en dérivent. Les mots de tous se
  gardent en mémoire, lus une fois par processus et tenus à chaque mot gagné :
  une écriture de plus dans `profile_sphinx` qui pose ou retire un mot les
  fait oublier (`oublier`), sinon le Divin du moment resterait en retard.
- **Une visite se fige à la première lecture qui la tire**, la ligne des
  missions comme sa route (`ON CONFLICT DO NOTHING`) : deux serveurs tirent la
  même (la graine), le Divin du moment s'écrit avec elle. Un geste n'écrit que
  si la visite est encore telle qu'il l'a lue (son état et ses essais).
- **Le mot se tire au verdict, jamais avant** (`choisirLeMot`, sa graine
  `profil|jour|mot`) : d'abord un que personne n'a ; deux joueurs qui
  résolvent ensemble le dernier inconnu reçoivent l'un ce mot, l'autre un mot
  déjà trouvé.
- **Le banc fixe le tirage** (`tirageDuSphinx`, `QuizServerOptions`) et peut
  poser sa réserve (`enigmesDuSphinx`) ; sa page démarre « bientôt » sur
  chaque base neuve : une épreuve l'ouvre (`PUT
  /api/admin/maintenance/pages/sphinx`) ou fait de son profil un testeur.
- **Un Divin de plus prend sa place dans `ORDRE_DU_SPHINX`**
  (`sphinx-pur.test.ts` compare l'ordre au catalogue) ; un Divin pas encore
  au catalogue ne se tire pas.
