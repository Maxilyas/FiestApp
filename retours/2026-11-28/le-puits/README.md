# Le Puits du Sphinx : la maquette d'un moteur d'énigmes

Le 28 novembre 2026, le même jour que la Pyramide (`../la-pyramide/`). Sa
structure n'a pas convaincu ; ce que le propriétaire en a aimé, c'est l'énigme
qu'on joue contre le Sphinx. Ses mots, dans l'ordre :

- « plutôt un puits sans fond » ;
- « Je veux beaucoup d'énigmes comme ça, plus ou moins difficiles, avec pleins
  de jeux différents » ;
- « une idée d'un jeu qui est modulaire et que l'on peut tester et utiliser sur
  plusieurs jeux » ; « orienté énigme, c'est vraiment le but. Avoir des énigmes
  retranscrites » ; « une grande variété de sujets et de types » ;
- « Il faut aller chercher beaucoup plus de sources » (`sources.md`).

Une page, sans dépendance, hors de l'application : rien ici n'est servi par
FiestApp. Elle est publiée en artefact privé (le lien est dans la conversation).

## L'idée

- **Une énigme est une fiche** : son récit, sa source, ses pièces, sa règle.
  Des données, pas de code. La plupart sont des énigmes classiques
  retranscrites — Alcuin, Bachet, Lucas, Dudeney, Sam Loyd, Lewis Carroll —,
  chacune avec sa source.
- **Un moule est une façon de jouer** : embarquer et traverser, verser, glisser
  des pièces, poser des reines, interroger… Un moule sert à autant de fiches
  qu'on veut ; plusieurs en fabriquent sans fin (`tirer`).
- **Un socle est ce que des moules partagent** : le Chemin (une suite de
  coups), la Pose (placer sous contrainte), la Preuve (une seule conclusion),
  la Sonde (le Sphinx cache quelque chose), le Duel (on joue contre lui), la
  Lettre (mots et codes).
- **L'écran ne sait rien d'aucune énigme** (`src/ecran.js`) : il demande tout au
  moule. Un moule de plus n'y change pas une ligne — la plupart ont été écrits
  par des agents, sur la seule lecture du contrat et de trois moules donnés en
  exemple.

## Ce que le programme vérifie

`node verifier.mjs` charge le socle et les moules sans navigateur et résout
chaque fiche avant qu'elle entre : le plus court chemin d'un Chemin, le nombre
de solutions d'une Pose, l'unique conclusion d'une Preuve, le nombre de
questions qui suffit toujours à une Sonde, la stratégie gagnante d'un Duel. Il
rejoue ensuite la solution par le chemin même du joueur. Une énigme
**impossible** se prouve aussi (le 14-15 de Sam Loyd par la parité, l'enveloppe
fermée par ses quatre points impairs).

C'est un relecteur que les énigmes à lire n'ont pas. Il retrouve les nombres
des auteurs : onze traversées pour les cinq maris jaloux de Dudeney, onze
transvasements à son n° 365, dix-sept déménagements à son n° 220, dix sauts
pour ses grenouilles ; quatre-vingt-douze façons de poser huit reines, deux
cent cinquante-six de poser quatorze fous.

## Ce qu'on y joue

- **Le puits** : une profondeur qui reste, et à chaque palier trois cordes —
  trois énigmes de moules différents. Une énigme facile fait descendre d'un
  palier, une dure de trois. Les énigmes écrites passent d'abord ; ensuite les
  moules en tirent, et le puits n'a pas de fond.
- **L'atelier** : toutes les énigmes, rangées par socle, à jouer dans l'ordre
  qu'on veut — pour les essayer une à une. Chaque moule qui en tire offre « En
  tirer une autre ».
- **Une énigme** : le Sphinx la raconte, grand ; puis sa boîte se fait basse et
  le plateau prend la place. Aucun indice ; on recommence autant qu'on veut ;
  la langue au chat montre la solution — rejouée coup par coup sur le plateau
  quand le programme en tient une, dite en mots sinon.
- **Les étoiles** se comptent contre la meilleure façon possible, que le
  programme connaît.

## Les fichiers

| Fichier | Son rôle |
|---|---|
| `src/socle.js` | Le contrat d'un moule (en tête), le parcours qui résout, les outils |
| `src/moules/*.js` | Un moule par fichier : sa règle, sa feuille, son dessin, ses fiches |
| `src/ecran.js` · `style.css` · `page.html` | Le Sphinx, le puits, l'atelier, la salle |
| `construire.mjs <dossier>` | Met tout bout à bout en une page, avec le Sphinx peint |
| `verifier.mjs [moule]` | Résout chaque fiche et chaque tirage ; en erreur au premier refus |
| `apercu.mjs <fiche> <dossier>` | Photographie un plateau seul, pour écrire un moule |
| `jouer.mjs <dossier construit> <sortie>` | Joue toute la maquette en 360 × 640, chaque énigme une à une |
| `recoupe.mjs mot,mot` | Dit « libre » ou « recoupe » : si une énigme est déjà dans la réserve du Sphinx |
| `sources.md` | Ce qui existe comme sources, et à quelles conditions on les prend |

## Ce qui est inventé, ce qui ne l'est pas

Les énigmes ne sont pas inventées : chaque fiche écrite cite son auteur, et une
énigme fabriquée dit de quel modèle elle est tirée. Les récits sont racontés
avec nos mots. **Rien ne vient de la réserve du Sphinx**, que le propriétaire
joue : `recoupe.mjs` l'interroge sans rien en montrer, et les énigmes qui s'y
trouvaient n'ont pas été écrites. Les deux puisent aux mêmes livres : le puits
pose d'autres énigmes des mêmes familles.

Ici les réponses et les secrets vivent dans la page ; dans l'application, la
règle de chaque moule irait dans `shared/` et le secret d'une sonde resterait au
serveur (invariant 1).

## Ce qui reste à décider

- **Les mots des Divins** : le puits n'en souffle aucun. Leur rythme, un mot
  neuf par jour en moyenne, est celui des visites.
- **Ce qui ouvre le puits**, et ce qu'il rend : la maquette ne donne que des
  étoiles et une profondeur.
- **« Plus tard »** : la maquette ne garde pas une énigme entamée ; dans
  l'application, elle attendrait telle quelle.
- **Les jeux de mots** (mots en échelle, anagrammes, mots carrés) demandent un
  dictionnaire français, que le dépôt n'a pas ; **les échecs** — six millions de
  problèmes notés, du domaine public — demandent un échiquier qui connaisse les
  règles. Les deux sont dans `sources.md`.

## La relancer

```bash
cd retours/2026-11-28/le-puits
node verifier.mjs                      # chaque énigme, résolue
node construire.mjs /tmp/puits         # la page, et le Sphinx peint
node jouer.mjs /tmp/puits /tmp/puits/photos   # toute la maquette, en 360 × 640
```
