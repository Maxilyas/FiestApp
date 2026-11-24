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
   puis Chronos seul, et sa phrase cachée : un trait par lettre, les petits
   mots (trois lettres et moins) offerts.
5. **Le choix**, dans un petit menu au curseur ▶ : « J'écoute ! » ou
   « Pas aujourd'hui » — alors le Sphinx s'épingle au bas de l'accueil, un
   « ? » à son médaillon, jusqu'à minuit.
6. **L'énigme**, en haut de l'écran (le clavier du téléphone monte par le
   bas) : ses vers paraissent un à un, sa source dessous, trois essais. Une
   réponse proche (« tonnerre » pour l'éclair) ne coûte pas d'essai.
7. **Le mot gagné** naît là où était l'énigme, vole jusqu'à sa place, et ses
   lettres se retournent une à une. « Comparez vos mots : à plusieurs, vous
   lirez la phrase entière. »
8. **L'album**, où la phrase attend sous le voile du Divin.

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

## Ce qui reste à décider

- La longueur des mots cachés se voit (un trait par lettre) : un indice de
  plus, et de quoi deviner à plusieurs. La garder ?
- Les petits mots offerts : la phrase se lit déjà en partie, et chaque énigme
  donne un mot qui compte.
- Le Sphinx parle-t-il toujours, ou chaque Divin parle-t-il de lui-même, sous
  son voile ?
- La police de la boîte : pixel ou douce.

## La regarder

```bash
retours/2026-11-24/le-sphinx/construire.sh /tmp/sphinx       # la page, l'accueil, le Sphinx du dépôt
cd /tmp/sphinx && python3 -m http.server 8765                # puis http://localhost:8765/local.html
node retours/2026-11-24/le-sphinx/photographier.mjs /tmp/sphinx /tmp/photos 360x640   # la visite, photo par photo
```
