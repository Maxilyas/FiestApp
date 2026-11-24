# Le Sphinx de l'accueil : la maquette

Le 24 novembre 2026. Le propriétaire veut que, parfois, quelqu'un vienne parler
aux joueurs les plus actifs sur leur accueil, « boîte de dialogue un peu comme
les jeux rétro type Pokémon, avec l'avatar qui nous parle » ; qu'on puisse, si
on le souhaite, résoudre une énigme ; qu'elle fasse découvrir une partie de la
phrase d'un Divin ; et que toutes les énigmes viennent de sources libres,
écrites par des humains, relues ensemble. Puis : « Je veux que les joueurs se
disent ouaaah ! J'ai jamais eu ça, c'est quoi ? Et qu'ils comprennent de quoi
on parle, parce que pour la plupart les Divins ça ne veut rien dire. »

Une page, sans dépendance, hors de l'application : rien ici n'est servi par
FiestApp. Elle est publiée en artefact privé (le lien est dans la conversation
du 24 novembre 2026).

## Ce qu'elle montre

1. **L'accueil de Léa**, le vrai : photographié par
   `server/scripts/rendu-accueil.ts` (l'habituée, 390 × 844), posé en fond.
2. **L'arrivée** : l'accueil s'assombrit, l'écran frissonne, du sable se lève,
   la boîte monte du bas en six crans, et le Sphinx naît du sable en mosaïque
   (son dessin réduit puis agrandi sans lissage, de plus en plus fin), dans un
   éclair d'or ; ses rayons tournent ensuite derrière lui, comme ceux d'un
   Divin. Le Sphinx est celui de l'album (`sphinx-perso`, sa découpe ; le
   médaillon `sphinx-art`, aux points d'interrogation, pour l'épingle).
3. **La boîte de dialogue** : un cadre de jeu d'autrefois aux couleurs du
   Velours (double filet d'or, quatre rivets, l'étiquette « Le Sphinx »), le
   texte qui s'écrit lettre par lettre avec un petit bip, le ▼ qui attend un
   toucher. Une police pixel (Pixelify Sans) ou douce (Figtree), au choix.
4. **Les Divins expliqués** : cinq voiles tels que les dessine `Divin.tsx`
   (verrouillé), avec leur nom, « et treize autres, tout aussi secrets » ;
   puis Chronos seul, **le Divin du moment**, et sa phrase cachée : un trait
   par lettre, les petits mots (trois lettres et moins) offerts. Sous elle,
   ce que Léa a trouvé et ce que tous les habitués ont trouvé ensemble — un
   nombre et une jauge, jamais les mots.
5. **Le choix**, dans un petit menu au curseur ▶ : « J'écoute ! » ou
   « Pas aujourd'hui » — alors le Sphinx s'épingle au bas de l'accueil, un
   « ? » à son médaillon, jusqu'à minuit.
6. **L'énigme**, en haut de l'écran (le clavier du téléphone monte par le
   bas) : ses vers paraissent un à un, sa source dessous, trois essais. Une
   réponse proche (« tonnerre » pour l'éclair) ne coûte pas d'essai.
7. **Le mot gagné** naît là où était l'énigme, vole jusqu'à sa place, et ses
   lettres se retournent une à une. « Et celui-là, personne ne l'avait
   encore. » « Comparez vos mots : à plusieurs, vous lirez la phrase
   entière. »
8. **L'album**, où la phrase attend sous le voile du Divin : « Les autres
   habitués ont trouvé 4 mots que tu n'as pas. »

Les outils de la maquette (le bouton « Maquette ») : aller à une étape, changer
d'énigme, la police de la boîte, le son, moins de mouvement.

## Les énigmes

Recopiées mot pour mot d'*Un million d'énigmes, charades et logogriphes*,
publié par Hilaire Le Gai (Pierre-Alexandre Gratet-Duplessis), Paris, Passard,
1858 — domaine public, transcrit sur Wikisource (qualité 100 %), avec sa
« Clé des énigmes ». Le livre en compte 719 pièces, dont 322 énigmes ; 113
tiennent en huit vers ou moins. Trois pour la maquette : n° 32 (l'éclair),
n° 211 (l'oiseau), n° 146 (la nuit).

## Ce qui est inventé

**La phrase de Chronos.** Elle ne dit pas sa règle, qui ne quitte jamais le
serveur (invariant 21), et la maquette ne la montre jamais entière. Les
réactions du Sphinx (« Tu brûles… ») sont des textes de l'application, pas
des énigmes.

## Ce qui a été décidé

Le même jour, sur les recommandations (« Go ») :

- **La police de la boîte : pixel.** C'est elle qui fait l'événement ; l'énigme
  reste dans la police des titres, et le Sphinx parle en phrases courtes.
- **Le Sphinx parle toujours.** Un seul personnage qui revient fait
  l'événement (« le Sphinx est passé ! ») ; un Divin qui parlerait perdrait
  son mystère. Il nomme le Divin dont il souffle un mot.
- **La longueur des mots se voit** : à plusieurs, on devine les mots qui
  manquent — la discussion qu'on cherche. Le premier réglage à retirer si une
  phrase se devine trop vite.
- **Les petits mots sont offerts** : chaque énigme rapporte un mot qui compte.
- **Un seul Divin à la fois pour tout le serveur, le Divin du moment.** Tirés
  chacun pour soi, deux amis auraient des morceaux de phrases différentes, et
  rien à comparer. Chacun reçoit des mots différents, dans un ordre tiré pour
  lui, d'abord un mot que personne n'a encore ; la page dit combien tous en
  ont trouvé ensemble, jamais lesquels. Quand ils les ont tous trouvés, le
  Sphinx passe au Divin suivant.

## Les énigmes candidates

`enigmes-candidates.json` : quarante énigmes retenues parmi les 118 de huit
vers ou moins (14 faciles, 16 moyennes, 10 difficiles), avec leur texte tel
que Wikisource le transcrit, la solution de la clé du livre, la page du
fac-similé, les réponses acceptées et celles qui « brûlent » (des
propositions, sans accents ni article), et une note quand le texte demande un
regard. `relecture.html` les montre une par une, la réponse sous un toucher,
avec trois verdicts et « Copier ma sélection » (publiée en artefact privé).

Écartées en les lisant toutes : celles qui ont mal vieilli (l'épingle, la
baleine, la médaille, l'esprit), les objets disparus (la crémaillère, la
bassinoire, le soufflet, le ramoneur), les références savantes (les
Danaïdes, Bellone, Clio), celles dont la clé manque (n° 44, 133, 534) ou se
trompe (n° 401 : « Boulon » pour « Bouton »).

**Le propriétaire ne les relit pas** (le même jour : « je vais te faire
confiance sur les énigmes car si je les lis je ne vais pas pouvoir jouer moi
même ») : il joue aussi. La relecture s'est donc faite à l'aveugle — deux
joueurs simulés, sans outils ni réponses, un ordinaire (modèle rapide) et un
fort, chargé aussi de dire si d'autres réponses remplissent le texte. Le
joueur ordinaire en trouve 25 sur 40, le fort 38 ; ce qu'ils ont rendu est
dans chaque énigme (`aveugle`), et a changé trois choses :

- **Deux énigmes écartées** (`retenue: false`, `raison`) : le n° 140 et le
  n° 97, où le joueur fort trouve une réponse aussi juste que celle du livre.
  Le Sphinx refuserait une bonne réponse.
- **Des réponses acceptées de plus**, celles qu'un juge honnête accepterait
  (« clou de soulier », « deux points », « ténèbres », « Galatée »…), et des
  « tu brûles » de plus : les erreurs que les joueurs ont faites.
- **La difficulté mesurée** : facile quand les deux trouvent, moyenne quand
  seul le fort trouve, difficile quand le joueur ordinaire se trompe avec
  assurance — 16, 16 et 6.

La coquille du n° 28 (« Vous sommes ») est corrigée et notée
(`corrections`) : rendue à l'auteur, comme Wikisource le fait ailleurs.

Ce que le propriétaire a déjà vu ne doit pas lui être posé : les trois
énigmes de la maquette, et cinq réponses dites dans la conversation (n° 370,
637, 349, 641, 659). À la mise en œuvre, son profil les compte pour vues. Et
le QG ne montrera jamais une réponse sans un geste : l'administrateur joue.

Wikisource marque les coquilles qu'elle corrige (`<span class="coquille">`) :
le texte recopié porte la correction, l'imprimé de 1858 est dans la note
(n° 4, 218, 397 ; et le n° 637, que le livre numérote 673). Les points au
milieu des phrases sont la typographie du livre. Une coquille que Wikisource
n'a pas relevée se corrige ensemble ou pas du tout (n° 28 : « Vous sommes »).

## La regarder

```bash
retours/2026-11-24/le-sphinx/construire.sh /tmp/sphinx       # la page, l'accueil, le Sphinx du dépôt
cd /tmp/sphinx && python3 -m http.server 8765                # puis http://localhost:8765/local.html
node retours/2026-11-24/le-sphinx/photographier.mjs /tmp/sphinx /tmp/photos 360x640   # la visite, photo par photo
```
