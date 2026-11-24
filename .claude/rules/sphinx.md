---
paths:
  - "shared/{sphinx,qgSphinx}.ts"
  - "server/src/{sphinx,sphinxDuQg}.ts"
  - "server/src/core/sphinx.ts"
  - "server/content/sphinx/enigmes.json"
  - "server/test/{sphinx-pur,sphinx-accueil,sphinx-ecran,qg-sphinx}.test.ts"
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
l'accueil »).

## Les fichiers

- `server/content/sphinx/enigmes.json` — la réserve : les 86 pièces retenues (55 énigmes, 31 charades), sans les traces du test à l'aveugle, chacune ses vers, sa solution (la clé du livre ; `cle`, son découpage pour une charade), ses réponses acceptées et celles qui brûlent (sans accents ni article), sa difficulté mesurée à l'aveugle, sa page et le lien de son fac-similé. **Serveur seulement** : jamais lue par `shared/` ni `client/` — ni importée, ni citée par son chemin (`divins.test.ts`). Une pièce de plus se relit à l'aveugle d'abord (le `README.md` du dossier dit comment)
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
- **Une visite qui attend ne surgit pas sur « Revenir chez … »**
  (`ceQueMontreLeSphinx`) : elle s'épingle, sans rien écrire au serveur. Une
  visite remise à plus tard, ou déjà présentée ce jour-là sur ce téléphone,
  va droit à son menu (« Te revoilà ») ; Échap la remet à plus tard
  (`plus-tard`, si elle était proposée).
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
  celle que le Sphinx lui pose aujourd'hui, pas encore close, 409 aussi — il
  y répondrait en la sachant. Le journal la nomme par son numéro, jamais par
  sa réponse.
- **Les habitués du QG sont ceux que le Sphinx a vus aujourd'hui**, en
  mémoire (`noterLHabitue`) — la ligne des missions juge leurs jours de toute
  façon, sa page fermée pour eux comprise : ils se comptent avant l'ouverture —
  et ceux qu'il a visités, lus dans leurs lignes : compter tous les profils
  d'après leurs jours joués relirait les journaux de tous les modes. Un
  redémarrage oublie les premiers jusqu'à leur accueil suivant.
