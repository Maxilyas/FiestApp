---
paths:
  - "shared/{sphinx,qgSphinx}.ts"
  - "server/src/{sphinx,sphinxDuQg}.ts"
  - "server/src/core/sphinx.ts"
  - "server/content/sphinx/{enigmes,problemes}.json"
  - "server/test/{sphinx-pur,sphinx-accueil,sphinx-ecran,sphinx-annonce,qg-sphinx}.test.ts"
  - "server/test/passeur.ts"
  - "client/src/sphinx.ts"
  - "client/src/components/{Sphinx,PhraseDuDivin,QgSphinx}.tsx"
  - "client/src/components/sphinx.css"
  - "server/scripts/{rendu-sphinx,rendu-sphinx-qg}.ts"
---

# Le Sphinx de l'accueil

Parfois, sur l'accueil d'un habitué, le Sphinx propose une énigme de 1858 ;
résolue, elle lui souffle un mot de la phrase du **Divin du moment** — sa
légende, le même Divin pour tout le serveur. Chacun voit ses mots, et combien
tous en ont trouvé, jamais lesquels. Le plan, la maquette et les énigmes
relues à l'aveugle : `retours/2026-11-24/le-sphinx/` (`plan.md` fait foi, ses
recommandations acceptées ; la maquette validée, `sphinx.html`, fait foi pour
le rendu et les mots) ; la décision : « Le Sphinx de l'accueil »
(`docs/architecture/decisions.md`) ; ce que le joueur voit :
`docs/produit/le-sphinx.md`. **Les trois étapes, le 24 novembre 2026 : le
serveur, les écrans** — la visite, l'épingle, l'album, la police pixel, le
haut-parleur — **puis le QG** (`/admin#sphinx`). L'ouverture est au
propriétaire : testeurs en préproduction, puis en production, puis tous — les
étapes et ce qu'il vérifie, `docs/guides/administrer.md` (« Le Sphinx de
l'accueil »). Le même jour, une phrase retrouvée par tous ne s'impose plus :
chacun la lit s'il le choisit, et l'accueil l'annonce une fois (plus bas).

## Les fichiers

- `server/content/sphinx/enigmes.json` — la réserve : les 86 pièces retenues (55 énigmes, 31 charades), sans les traces du test à l'aveugle, chacune ses vers, sa solution (la clé du livre ; `cle`, son découpage pour une charade), ses réponses acceptées et celles qui brûlent (sans accents ni article), sa difficulté mesurée à l'aveugle, sa page et le lien de son fac-similé. **Serveur seulement** : jamais lue par `shared/` ni `client/` — ni importée, ni citée par son chemin (`divins.test.ts`). Une pièce de plus se relit à l'aveugle d'abord (le `README.md` du dossier dit comment)
- `server/content/sphinx/problemes.json` — les problèmes, une visite sur cinq (le souhait du propriétaire du 25 novembre 2026, sur les « Can you solve this riddle? » de TED-Ed ; la maquette, `retours/2026-11-25/le-probleme-du-sphinx/`) : chacun son numéro (`p…`), son titre — avec son article, « Le passeur » : la page dit « Le problème du passeur » (`nomDuProbleme`) —, son récit, sa question, ce qui la précise (`aide`), sa figure, sa réponse — un nombre (`valeur`) ou un choix (`propositions`, `bonne`) —, sa solution en mots, sa solution pas à pas (`explication`, `dit` et `etat`), sa source (un livre du domaine public, raconté avec nos mots), sa difficulté mesurée à l'aveugle. **Serveur seulement**, comme les énigmes ; lu champ par champ (`lireUnProbleme`) : un problème mal formé ne se pose pas, un fichier absent n'en pose aucun. Le banc pose le passeur de la maquette (`server/test/passeur.ts`, ses deux formes), que tout le monde connaît : les épreuves et les photos le montrent sans rien gâcher — jamais dans la réserve livrée
- `shared/sphinx.ts` — ce que la page reçoit, sans un secret : les types (`LeSphinx`, `VisiteDuSphinx`, `PhraseDuSphinx`, `VerdictDuSphinx`), les gestes, les états, et les barèmes que la page dira (`JOURS_DE_L_HABITUE`, `FENETRE_DE_L_HABITUE`, `ESSAIS_DU_SPHINX`)
- `server/src/core/sphinx.ts` — tout ce qui se décide : les dérivations pures d'abord — la réponse lue (`normaliser`, `jugerLaReponse`), l'habitué (`joursJoues`, sur `ActiviteDuJour.joue`, `shared/missions.ts`), la visite (`tirageDeLaVisite`, la graine `profil|jour`), l'énigme (`choisirLEnigme`), la phrase (`motsDeLaLegende`, `estUnNombre`, `phraseVue`), le mot (`choisirLeMot`), le Divin du moment (`ORDRE_DU_SPHINX`, `divinDuMoment`, `phrasesReconstituees`), le verdict (`appliquerLeGeste`) — puis la classe `Sphinx` : les mots de tous en mémoire (`pret`, `oublier`), la décision que lisent ses missions et sa route (`decider`, `poser`), `lire`, `geste`, une écriture à la fois par profil (`unALaFois`), et les énigmes que le propriétaire connaissait (`compterLesVuesDuProprietaire`, au démarrage)
- `server/src/sphinx.ts` — `GET` et `POST /api/joueur/sphinx`, pour les profils ; `sphinxFermePour`, que la ligne des missions lit aussi
- `ProfileStore` (`auth/profiles.ts`) — sa table, `profile_sphinx` : une ligne par visite (clé `profile_id`, `jour`), et une ligne `vue` par énigme comptée pour vue sans visite (son jour `vue:<numéro>`) ; ses lectures (`lecturesDuSphinx`, `visitesDuSphinx`, `motsDuSphinx`, et dans le lot de `lecturesDesMissions`), ses écritures (`poserUneVisiteDuSphinx`, `ecrireUnGesteDuSphinx`, `compterDesEnigmesPourVues`) ; un profil supprimé emporte ses lignes, et `server.ts` fait oublier les mots de tous (`sphinx.oublier`)
- `core/missions.ts` — `MissionsDuJour.sphinx` (`attend`, `epingle`), décidé dans la même lecture que les missions : ses visites dans le lot du profil, les mots de tous lus de front, la visite tirée posée de front avec le tirage des missions (`missions-charge.test.ts`)
- La maintenance (règle `qg.md`) : `sphinx` dans `PAGES_EN_MAINTENANCE`, sa porte `POST /api/joueur/sphinx` ; posée « bientôt » une fois sur une base qui ne la connaît pas (`Maintenance.init`, drapeau `sphinx_bientot_pose`) ; jamais écrite dans les pages servies (`DITES_PAR_LEUR_ROUTE`) — fermée pour lui, sa route dit `{ fermee }` et ses missions se taisent
- `client/src/sphinx.ts` — ce que l'accueil en sait sans le faire venir, léger (l'accueil anonyme l'importe) : s'il surgit ou s'épingle (`ceQueMontreLeSphinx`, sur `MissionsDuJour.sphinx` et les soirées où revenir), son chargement (`leSphinx`, `aLaDemande` : son code **et** sa feuille, `import('./components/sphinx.css')`), et ce qu'il retient sous try/catch — le son (`quizz.sphinx.son`, muet sans lui), sa présentation jouée ce jour-là (`quizz.sphinx.presente`), ce qu'il laisse à l'album en y menant (`quizz.sphinx.album`, la session : la fiche à ouvrir, le mot à retourner)
- `client/src/components/Sphinx.tsx` · `sphinx.css` — la visite (`VisiteDuSphinx` : elle lit `GET /api/joueur/sphinx`, attend une seconde et demie que l'accueil soit à lui — rien d'ouvert par-dessus —, puis la scène, `SceneDuSphinx`, un scénario qui attend chaque toucher, choix et issue, et dit chaque geste au serveur), la boîte (`BoiteDuSphinx`, `Frappe`), l'énigme (`ParcheminDeLEnigme`), l'épingle (`EpingleDuSphinx`), le sable et la mosaïque sur deux toiles, les sons en WebAudio. Ses répliques sont celles de la maquette (`DIT`), le prénom à la place de Léa ; ses classes commencent par `sx-`, et sa feuille porte la police pixel — Pixelify Sans, OFL, hébergée dans `client/public/fonts/` (le latin, le latin étendu, sa licence)
- `client/src/components/PhraseDuDivin.tsx` — la phrase d'un Divin mot à mot (un trait par lettre, les petits mots offerts, ses mots en or), ce que tous en ont trouvé et sa jauge, le mot du Sphinx dans l'album (`ConseilDuSphinx` : à qui n'est pas habitué, `JOURS_DE_L_HABITUE` sur `FENETRE_DE_L_HABITUE`) ; ses règles dans `styles.css`, aux jetons du thème — la visite les repose à ses couleurs de nuit. La visite et l'album la partagent : l'album l'importe sans faire venir la visite
- L'accueil (`ProfilApp.tsx`) : ses missions lues par `useMissionsDuJour`, ce que la visite devient gardé à côté (`sphinxIci` : un geste ne relit pas les missions), l'épingle passée à `AccueilJouer` (`epingle`, posée à côté du nom d'« Entre amis »), la visite rendue après la barre du menu. L'album (`AlbumDesAvatars.tsx`) : sa page des Divins lit le Sphinx en s'ouvrant, allume la case du Divin du moment (`album-moment`) et passe la phrase à ses fiches par un contexte (`LeSphinxDeLAlbum`, `SaPhrase`)
- `server/scripts/rendu-sphinx.ts` — la visite pas à pas et ses cas, mesurée à chaque photo (règle de la skill `regarder-le-rendu`) ; `server/test/sphinx-ecran.test.ts`, ce qui ne se voit qu'en lisant le code
- Le QG (`/admin#sphinx`, « Sphinx » sous « Modes », après le Cabinet ; règle `qg.md`) : `shared/qgSphinx.ts` — ce que la page reçoit, des comptes (`PageDuSphinxAuQg`, `EnigmeAuQg`, `ReponseDuSphinxAuQg`, `ISSUES_DES_VISITES`, `visitesParJour`, `reussiteDe`) — ; `server/src/sphinxDuQg.ts` — `GET /api/admin/sphinx` et « Voir la réponse », `POST /api/admin/sphinx/enigmes/:numero/reponse`, noté au journal des gestes (sorte `profil`, sa cible le profil de l'administrateur) — ; dans `Sphinx` (`core/sphinx.ts`), `auQg` (la page, d'un lot, `ProfileStore.lecturesDuSphinxAuQg`), `reponseAuQg` (`compterUneEnigmePourVue`, une ligne `vue:<numéro>`) et les habitués du jour en mémoire (`noterLHabitue`, que `decider` et la ligne des missions appellent, sa page ouverte ou non) ; `client/src/components/QgSphinx.tsx` — le Divin du moment, les phrases reconstituées, l'audience, jour par jour (`GrapheDuTemps`, aux couleurs d'état des traversées du Cabinet, `.qg-sphinx-*`), énigme par énigme (la table des questions, `qg-jouees-table`), la feuille d'une énigme et « Voir la réponse », la porte de la maintenance ; `server/test/qg-sphinx.test.ts` ; `server/scripts/rendu-sphinx-qg.ts` la photographie, l'énigme n° 32 seule ouverte

## Les pièges

- **Une légende ne part que mot à mot** (invariant 21) : un champ de plus qui
  part vers la page passe par `phraseVue` — les mots qu'il a gagnés, les
  petits mots offerts, la forme du reste, entière à son porteur, à qui en a
  trouvé chaque mot, ou reconstituée par tous et choisie (plus bas).
  `sphinx-accueil.test.ts` cherche dans chaque réponse
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
  déjà trouvé. **Un seul mot neuf par jour, à tout le serveur**
  (`MOTS_NEUFS_PAR_JOUR`, le choix du propriétaire du 25 novembre 2026) :
  compté sur le premier instant de chaque mot, en mémoire (`premiers`,
  `motsNeufsDuJour`) — parti, `neufPermis: false`, un mot déjà trouvé qu'il
  n'a pas, et s'il les a tous, un neuf quand même ; le verdict le dit
  (`neufDuJourParti`), la visite aussi (`DIT.neufParti`). Rien ne s'écrit à
  côté : deux serveurs d'une mise en ligne, ou deux joueurs au même instant,
  peuvent en souffler un de plus ce jour-là.
- **Le banc fixe le tirage** (`tirageDuSphinx`, `QuizServerOptions`) et peut
  poser sa réserve (`enigmesDuSphinx`) ; sa page démarre « bientôt » sur
  chaque base neuve : une épreuve l'ouvre (`PUT
  /api/admin/maintenance/pages/sphinx`) ou fait de son profil un testeur.
- **Un Divin de plus prend sa place dans `ORDRE_DU_SPHINX`**
  (`sphinx-pur.test.ts` compare l'ordre au catalogue) ; un Divin pas encore
  au catalogue ne se tire pas.
- **Les photos ne montrent ni une vraie légende ni une énigme que le
  propriétaire n'a pas vue** : il joue aussi. Le banc lit une phrase inventée
  à la place de **chaque** légende (`phraseInventeeDuSphinx`, `phraseInventee`
  dans `DepsDuSphinx`, la phrase de la maquette) — celle du seul Divin du
  moment ne suffisait pas : reconstituée, la phrase fait passer au suivant,
  dont la vraie forme et les petits mots se seraient montrés —, et ne pose que
  les trois énigmes de la maquette (`enigmesDuSphinx`). Jamais en ligne :
  `index.ts` ne passe aucune des trois options (`sphinx-ecran.test.ts`). Un
  compte rendu, un commit, la doc ne citent ni une réponse ni une légende.
- **Le Sphinx part à la demande, sa feuille avec lui** (`leSphinx`,
  `client/src/sphinx.ts`) : ni l'accueil, ni la soirée, ni l'entrée ne
  l'importent statiquement (`sphinx-ecran.test.ts`, par `importsStatiques`).
  Aucun composant n'importe `sphinx.css` : les épreuves rendent les composants
  dans Node, où l'import d'une feuille lève — c'est le chargeur qui la fait
  venir, et Vite la pose avant que le module ne se résolve. Sa police n'est
  nommée qu'ici : ni `styles.css`, ni la page servie, ni un thème.
- **Ce que le Sphinx montre au-dessus de lui ne prend de place que montré**
  (`.sx-vitrine`, `.sx-focus`, `.sx-parchemin`, `.sx-mot-vole` : `display:
  none` hors de `.sx-montre`, un fondu à l'entrée). Seulement cachés, ils
  partageaient la case de la grille du haut : l'énigme, plus haute, faisait
  défiler le Divin du moment et le décentrait — et un `display: grid` posé
  sur `.sx-focus` lui-même l'avait remis à l'écran par-dessus l'énigme, dont
  le champ ne se touchait plus (le rendu du 24 novembre 2026). Le haut se
  centre par les marges de ses enfants, pas par la grille : plus haut que son
  cadre, il part du haut et défile, rien n'est coupé ; le voile du Divin
  rétrécit d'abord (`--sx-divin`, `ajusterLeVoile`, à chaque taille de boîte
  ou de ce qu'il montre — une police arrivée après coup — et quand le menu
  s'ouvre, qui garde un peu d'air au-dessus de lui, `sx-avec-menu`), et le
  haut revient à son début à chaque vue. Les vraies légendes comptent de dix à
  vingt et un mots : `rendu-sphinx.ts` en essaie une inventée de vingt et un
  (`LONGUE=1`) — elle tient en 360 × 640 ; au texte agrandi à 130 %, le cadre
  défile.
- **Moins de mouvement coupe les transitions, il ne les abrège pas**
  (`transition: none`, `sphinx.css`) : une durée d'un centième sans propriété
  nommée vaut pour toutes, et le cadre du haut glissait vers sa hauteur avec
  le menu ouvert — la mesure du voile lisait l'ancienne, et le Divin du moment
  défilait de deux pixels (le rendu `calme`, le 24 novembre 2026).
- **Les boutons de la scène ont leur règle à eux** : la règle commune n'a
  aucune force (`:where(.sx-scene) button`) — à `.sx-scene button`, elle
  passait devant « Je donne ma langue au chat » et l'écrivait en blanc, en
  grand.
- **L'épingle ne passe sur aucun bouton** : à droite du nom d'« Entre amis »,
  de la carte du dessus à celle du dessous, sa cible (44 px) posée sur leur
  filet. Le nom grandit de ce qu'il faut (`min-height`, d'après
  `--accueil-ecart` et `--accueil-serre`), et l'accueil rend ces pixels
  ailleurs quand elle est là — sa marge du bas, deux pixels entre « À la une »
  et les missions —, sans quoi il défilait de 7 px en 360 × 640. Une ligne de
  plus à l'accueil se relance avec `rendu-sphinx.ts` (`tom`, `sofia`), qui
  mesure l'épingle sur les boutons, sous la niche et l'accueil qui défile.
- **Il ne surgit qu'une fois par visite** (le retour du propriétaire du
  24 novembre 2026 : « il devrait interpeller qu'une seule fois, puis c'est à
  l'utilisateur d'ouvrir l'énigme quand il le souhaite ») : la page dit son
  arrivée au serveur une fois le Sphinx à l'écran (`surgir`, après `arriver`
  — dite avant, une page fermée pendant son attente l'aurait épinglé sans
  qu'il ait parlé), qui pose `ecoutee_le` ; écoutée ou répondue, de même. Dès
  lors, `decider` dit `epingle` pour une visite pas encore close, plus
  jamais `attend`. Avant, il surgissait à chaque accueil tant qu'on ne
  l'avait pas remise à plus tard. `ecoutee_le` existait sans lecteur : le
  reprendre a évité une colonne, et la lecture de son schéma à chaque réveil
  (`ajouterColonne`). Une ligne de visite lue passe par `lignesDuSphinxLues`,
  qui le porte (`ecouteeLe`).
- **Une visite qui attend ne surgit pas sur « Revenir chez … »**
  (`ceQueMontreLeSphinx`) : elle s'épingle, sans rien écrire au serveur. Une
  visite remise à plus tard, ou déjà présentée ce jour-là sur ce téléphone,
  va droit à son menu (« Te revoilà ») ; Échap la remet à plus tard
  (`plus-tard`, si elle était proposée). Un téléphone n'a pas d'Échap :
  l'énigme ouverte a son « Plus tard », à côté de la langue au chat (le
  retour du propriétaire du 24 novembre 2026, `ParcheminDeLEnigme`
  `onPlusTard`) — écrit au serveur avant que le Sphinx s'épingle, ses essais
  et ses réponses gardés (`appliquerLeGeste`) ; une issue touchée pendant
  les vers les arrête (`issue.current` rendu à null). Le menu dit « Plus
  tard », plus « Pas aujourd'hui » (la maquette) : le Sphinx reste épinglé
  jusqu'à sa fin, ce n'est pas un refus. Et la fin d'une énigme perdue ou
  abandonnée ne promet pas le lendemain (`autreJour`) : une visite ne vient
  qu'un jour sur trois.
- **Une énigme attend sa fin, une seule à la fois** (le choix du propriétaire
  du 25 novembre 2026 : « garder l'énigme pas uniquement la journée mais
  jusqu'à la résolution » ; la décision « Une énigme attend sa fin, et ne
  surgit que chez qui a joué la précédente ») : la visite en cours est sa
  dernière, tant qu'elle n'est pas close, ou finie aujourd'hui
  (`visiteEnCours`, que `decider`, `vue`, `geste`, `auQg` et `reponseAuQg`
  lisent — jamais « la ligne du jour » : la clé `jour` est celui de sa pose).
  Finie, aucune autre ne vient avant demain (`close_le`, lu dans
  `LigneDuSphinx.closeLe`). Une neuve ne se tire que la dernière close : une
  visite d'avant, restée ouverte sous la règle de minuit et qu'une autre a
  suivie, ne revient donc jamais. **La suivante ne surgit que s'il a joué
  celle d'avant** (`laSuivanteSurgit`, ses `essais` : une réponse qui brûle ne
  s'écrit pas, elle ne compte pas) — sinon `epingle`, relu à chaque lecture,
  rien d'écrit : sans elle, la langue au chat servait à se débarrasser de
  l'énigme, et la suivante resurgissait trois jours plus tard. **Le mot d'une
  énigme qui a attendu vient du Divin du moment de sa fin** (`divinVise`, que
  la visite montre déjà), rangé sous lui (`ecrireUnGesteDuSphinx` réécrit
  `divin`, sans quoi ses mots, ceux de tous et les crédits le liraient sous
  la phrase de sa pose, retrouvée entre-temps). Le Sphinx ne promet plus
  d'heure : `sphinx-ecran.test.ts` cherche « minuit » dans `Sphinx.tsx`.
  La présentation retenue sur le téléphone se nomme par le jour de la visite
  (`dejaPresente(v.jour)`) : rouverte un autre jour, elle va droit au but.
- **Une visite sur cinq, un problème** (`PART_DES_PROBLEMES`, la décision « Une visite sur cinq, un problème façon TED-Ed ») : `choisirLEnigme` tire la sorte d'abord — et seulement s'il y a un choix à faire, un problème et une énigme à voir : une réserve sans problème garde ses tirages d'avant, au hasard près (`sphinx-pur.test.ts`) —, puis la difficulté comme avant. **Rien de sa réponse ne part avant la fin** : `problemeVu` ôte le nombre et la bonne carte, et `visiteDe` n'ajoute `solution`, `explication` et `bonne` qu'une fois la visite close (`sphinx-accueil.test.ts` cherche ces champs dans la visite ouverte). **Une réponse se lit selon sa pièce** (`lireLaReponse`) : une énigme par `normaliser` ; un nombre par `nombreTape` — `lireNombre`, la convention du dépôt, puis les petits nombres en lettres —, gardé en chiffres dans `reponses` (« cinq » redit « 5 ») ; un choix par sa place. Illisible, un refus en 400, sans essai perdu ; rien n'y brûle. **Les essais d'une pièce** passent par `essaisDe` (`shared/sphinx.ts`), au serveur comme à la page : trois, un seul pour un problème à choisir — `ESSAIS_DU_SPHINX` seul ne dit plus le compte. **L'écran** (`ParcheminDuProbleme`, `SolutionDuProbleme`) : le récit paragraphe par paragraphe, puis la page descend jusqu'à la question ; un nombre au clavier des chiffres (`inputMode="numeric"`, jamais de focus d'office), des cartes d'un seul toucher ; pas d'indice — le choix du propriétaire, et `sphinx-ecran.test.ts` le garde. Sa solution se joue toujours après une défaite, se propose après le mot d'une victoire (`laSolutionSIlVeut`, après ce que le Sphinx dit du mot : la récompense d'abord), étape par étape (`expliquer`, la vue `solution`). Ses répliques disent « mon problème » (`laPiece`). Au QG, son titre, son énoncé au toucher (`enonceDe`) et, derrière « Voir la réponse », le nombre ou la bonne carte (`accepteesAuQg`). Plus long qu'une énigme, il défile dans le haut sur un petit téléphone : `rendu-sphinx.ts` juge ce qui sort de l'écran sur la part visible du cadre qui défile (les cas `probleme` et `probleme-choix`).
- **La solution se dit entre guillemets** (`laSolution`) : la clé du livre
  s'écrit sans article, avec une majuscule, et nue dans la phrase du Sphinx
  elle se lisait de travers. Une charade y ajoute son découpage.
- **L'appel de la fiche de l'album reste celui de toujours** —
  `grille-avatars.test.ts` le relit tel quel — : la phrase lui arrive par un
  contexte (`LeSphinxDeLAlbum`), et elle ne se montre qu'à un Divin pas encore
  descendu (descendu, il raconte déjà sa légende). Ouverte par la visite, sa
  fiche reprend le focus sans l'anneau du clavier (`focusVisible: false`).
- **Ses ailes partent en fondu par un masque sur sa toile, jamais repeintes**
  (`.sx-sphinx canvas`, le 24 novembre 2026) : son dessin touche son propre
  cadre en haut, à gauche et à droite, et découpé à `[0, 0, 256, 172]`, le
  haut des ailes et leurs côtés finissaient coupés net. Quatre couches, dans
  cet ordre — le bas entier, la tête entière (une ellipse autour de sa
  coiffe), le haut fondu croisé aux côtés fondus — et leur composition, avec
  et sans `-webkit-` (Safari) : mesuré sur la découpe, rien d'opaque au bord
  au-delà de 2 %, le corps, la tête et les pattes à 100 %. Sur la toile, il
  vaut pour la mosaïque comme pour le dessin, et sous « moins de mouvement »
  (`sphinx-ecran.test.ts`). Un dessin repeint se remesure : sa tête ailleurs,
  l'ellipse la couperait.
- **La page du QG ne dévoile rien au propriétaire, qui joue aussi** : du
  Divin du moment, son nom et un compte — ni ses mots, ni leur forme, ni
  lesquels sont trouvés ; d'une phrase reconstituée, son Divin et sa date ;
  d'une énigme, ses vers (montrés au toucher de sa ligne) et ses comptes.
  `qg-sphinx.test.ts` cherche dans la page chaque réponse de la réserve et
  chaque mot caché des vraies légendes — dans ses valeurs, ni ses vers ni ses
  codes : un mot ordinaire d'un refus peut être la réponse d'une énigme, et
  un refus se compare mot pour mot. **La réponse n'arrive que par son geste,
  qui la range d'abord** pour vue sur le profil que tient le compte
  d'administration (`accounts.profile_id`) : sans lui, rien où la ranger, 409 ;
  celle que le Sphinx lui pose en ce moment (`visiteEnCours`, de quelque jour
  qu'elle date ; « la tienne, en cours », `aToi` `en-cours`), 409 aussi — il
  y répondrait en la sachant. Le journal la nomme par son numéro, jamais par
  sa réponse.
- **Une phrase retrouvée par tous ne s'impose plus** (la décision du
  propriétaire du 24 novembre 2026, « Une phrase retrouvée par tous ne
  s'impose plus, et s'annonce », `docs/architecture/decisions.md`) : le texte
  d'un mot caché qu'il n'a pas trouvé ne part que s'il porte le Divin, s'il a
  trouvé chaque mot, ou s'il l'a choisie (`lue`, `phraseVue` : `legende` et
  `aDevoiler`). `reconstituees` passe par la même vue par profil : la légende
  n'arrive plus dans le navigateur de qui ne l'a pas choisie. Le choix
  (`POST /api/joueur/sphinx/phrase`, sa porte avec la page) et l'annonce vue
  (`POST /api/joueur/sphinx/annonce`) vivent dans `profile_sphinx`, en lignes
  à part (`lue:<Divin>`, `annonce:<Divin>`, `LIGNES_A_PART_DU_SPHINX` avec
  `vue`) : une ligne de plus qui n'est pas une visite rejoint cette liste, que
  `estUneVisite`, `visiteDuJour` et les comptes du QG lisent — sans elle, elle
  compterait parmi ses premières visites faciles, ou au QG.
- **Les mots des autres s'inscrivent, juste et déjà trouvés** (le premier
  retour de la production, le 24 novembre 2026 : « Je vois nulle part où
  rentrer le mot des autres » ; la décision « Les mots des autres
  s'inscrivent, et l'on sait à qui les demander ») : `Sphinx.inscrire`,
  `POST /api/joueur/sphinx/inscrire`, sa porte avec la page. Un mot juste
  **que personne n'a trouvé est un faux** — la même réponse, la même erreur :
  sinon les petits mots et les nombres se devineraient seuls, leur longueur
  dite par la forme. Cinq erreurs par jour (`ERREURS_D_INSCRIPTION_PAR_JOUR`,
  la ligne à part `inscrits:<jour>`, bornée dans son `UPSERT`) ; à zéro, plus
  rien ne s'inscrit, même juste (429). Appris (`appris:<Divin>:<place>`),
  **jamais un `mot`** : les mots de tous, le Divin du moment, les crédits de
  l'annonce et ceux à qui demander ne lisent que `mot IS NOT NULL` — un mot
  appris y compterait pour trouvé. Il se montre à lui (`phraseVue` `appris`,
  `sesAppris`), compte pour la lire entière, et le Sphinx ne le lui souffle
  plus (`cequIlSait`, dans `decider` et `geste`). La comparaison
  (`motsEgaux`) : lettres et chiffres seuls, sans casse ni accents, l'élision
  permise. Ses tests ne tapent que les mots de la phrase inventée
  (`sphinx-accueil.test.ts`, `phraseInventeeDuSphinx`) : une vraie légende
  dans un test, c'est un mot de plus dans le dépôt.
- **À qui demander, de mémoire** (`quiADesMotsPour`) : les trouveurs de la
  mémoire du Sphinx (`trouveurs`, leur compte `mots` — `COUNT(DISTINCT mot)`
  dans `motsDuSphinx`, tenu à chaque mot gagné), sans lui, sans un masqué
  (`masque`, branché par `server.ts` sur `JourStore.estMasque`), les
  suspendus jamais lus ; ses amis d'abord (`CampagneStore.amisDe`, lu de front
  dans `lire` — une lecture qui tombe ne coûte que leur ordre). Seule la page
  du Sphinx le dit (`vue` avec `amis`) ; un verdict, non. Dans l'album, un nom
  ouvre sa carte par un crochet à lui (`useCarteDeQuiADesMots`) :
  `useCarteDUnProfil` importe `state.ts`, qui lit sa fenêtre au chargement,
  et l'album se rend dans Node (`grille-avatars.test.ts`).
- **L'annonce d'une phrase retrouvée est une carte de l'administrateur**
  (sorte `phrase` d'`AnnonceDeLAdministrateur`), couchée en bandeau à la place
  d'« À la une » (`AnnonceDeLaPhrase`, `.annonce-phrase`) : en carte, l'accueil
  défilait de 190 px en 360 × 640. Ses crédits viennent de la mémoire du
  Sphinx, lue d'un lot avec les mots de tous (`motsDuSphinx` : les premiers
  instants, les trouveurs, leur prénom et leur visage — `nomsAffiches`,
  invariant 17), ses annonces déjà vues du lot de l'accueil (`achatsDe`,
  `phrasesAnnoncees`) : pas un aller-retour de plus. Les mots de tous pas
  encore lus sur ce serveur, rien ne s'annonce — la ligne des missions,
  partie avec l'accueil, les lit ; l'accueil suivant la dit. Un mot gagné
  tient ces crédits à jour (`trouveurs`, `premiers`, dans `geste`).
- **Les habitués du QG sont ceux que le Sphinx a vus aujourd'hui**, en
  mémoire (`noterLHabitue`) — la ligne des missions juge leurs jours de toute
  façon, sa page fermée pour eux comprise : ils se comptent avant l'ouverture —
  et ceux qu'il a visités, lus dans leurs lignes : compter tous les profils
  d'après leurs jours joués relirait les journaux de tous les modes. Un
  redémarrage oublie les premiers jusqu'à leur accueil suivant.
