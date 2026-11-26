# Les bordures au choix : des propositions

Le 26 novembre 2026. Le propriétaire : « J'aimerais que la bordure que l'on
gagne avec les duels soit plus customisable que ça. En fait en fonction de
l'avatar, peut être que les plumes ne vont pas trop et j'aimerais pouvoir
laisser différents choix de bordure. Peut être même les acheter ? Peux tu me
faire pleins de propositions stp »

Les « plumes », ce sont les brins de la parure du 17 novembre
(`retours/2026-11-17/bordures/`) : le laurier du bronze, l'olivier de
l'argent, la feuille d'or, le givre, les marquises du diamant, les flammes du
Soleil noir. Un seul dessin par ligue : on ne choisit que la ligue.

Ce dossier est une maquette : rien de `client/` ne bouge. Chaque motif est
dessiné (`dessins.ts`) et posé par `planche.ts` sur les vrais avatars de
l'application, sous sa vraie feuille de style.

## Le choix

Le même jour, devant la planche : « Fait selon tes recommandations. Penses tu
que les motifs couvrent bien différents styles ? Ça ne me dérange pas d'avoir
plus de motifs dans la boutique. Je suis preneur de plusieurs motifs dans le
coffre de la semaine aussi. »

Mis en place au commit suivant (`shared/motifs.ts`, `shared/motifAccorde.ts`,
les motifs de `client/src/components/dessinDesBordures.ts`) : « Accordée »
d'office, le légendaire prêtant son motif (1 a) ; les trois offerts ; les
brins prêtés par chaque bordure sertie ; les Perles, les Rouages et les
Flammes aux duels ; un rayon « Bordures » à 400 — les six de la planche et
six styles de plus (les Serpentins, les Notes, les Pixels, la Grecque, les
Épines, les Nuages) ; les Cœurs et le Houx à 250, à leur fête ; et six motifs
du coffre de la semaine (les Flocons, les Papillons, les Lanternes, les
Joyaux, les Comètes, la Couronne royale). Pas les pierres de l'avatar (7) :
seules, elles se voyaient peu.

Les dessins de ce dossier restent ceux de la maquette ; ceux de
l'application ont grandi depuis (les écailles couchées, les plumes plus
longues, les lanternes, les notes, les serpentins).

## L'idée qui tient tout le reste

**La ligue se gagne, le motif se choisit.** Une bordure dit trois choses de
la ligue — son **métal** (le bronze est de bronze), son **insigne** en bas
(l'écu, la perle, la fleur de lys…), son **compte de crans** (douze victoires)
— et une chose de goût : **ce qui pousse à chaque victoire**. Les trois
premières restent à la ligue, sans exception ; la quatrième devient un choix.

Ce qui ne bouge donc pas, quel que soit le motif :

- les crans se comptent comme avant (`releverLesDuels`) : rien au barème, rien
  à `VERSION_DU_RELEVE` ;
- ils poussent du bas, à droite puis à gauche, symétriques à chaque victoire ;
  le haut — que couvrent les ailes d'un éclaté et l'étoile d'un scellé — se
  referme en dernier ; un cran à gagner reste une place qui attend (un
  bourgeon, un chaton vide), jamais un pointillé ;
- le métal reste celui de la ligue (le choix du 17 novembre) : un motif
  acheté ne rend pas un bronze doré ;
- rien ne donne d'avantage de jeu (invariant 8), et l'invité anonyme n'a
  toujours rien.

Acheter un motif n'achète ni la ligue, ni un cran : c'est la phrase que la
boutique dirait.

## Les propositions

Les photos : `planche-<section>.jpg`, et en Ivoire `planche-ivoire-<section>.jpg`.

### 1. « Accordée » : le motif suit l'avatar qu'on porte (`planche-accordee.jpg`)

La réponse directe au retour : un nouveau réglage d'office, « Accordée », à la
place de « la parure de ma ligue ». Chaque légendaire, portrait et compagnon
dit son motif — le Phénix ses flammes, la Chouette et Pégase leurs plumes, le
Dragon et le Serpent leurs écailles, le Kraken et Poséidon leurs vagues, la
Comète et le Trou noir leurs étoiles, le Lion ses rayons, le Panda des
cerisiers ses fleurs, le Robot ses rouages, le Sapin son houx. Un emoji garde
les feuilles de sa ligue. Changer d'avatar change la bordure sans y penser.

Une table à écrire : 32 légendaires, 72 portraits (une règle par branche
suffit : les océans en vagues, l'espace en étoiles, la forêt en feuilles…),
5 compagnons et leurs formes, 18 Divins (ou leur gloire seule, comme
aujourd'hui).

Deux façons de le régler :

- **a. Le légendaire prête son motif** (ma préférence) : porté avec lui, son
  motif est gratuit — c'est une récompense déjà gagnée. Pour le porter avec
  autre chose (un emoji, un autre avatar), il s'achète ou se gagne.
- **b. Seulement parmi ceux qu'on a** : « Accordée » choisit le plus juste
  parmi ses motifs, sinon les feuilles. Plus de raisons d'acheter, mais le
  retour (« ça ne va pas avec mon avatar ») n'est réglé que pour qui paie.

### 2. Trois motifs offerts à tous (`planche-catalogue-1.jpg`, en haut)

- **Les Feuilles** — la parure d'aujourd'hui, inchangée.
- **Le Jonc serti** — un anneau deux fois plus large, une pierre sertie par
  victoire, rien qui dépasse : le plus sobre, celui qui va à tout (la piste 2
  du 17 novembre, que la planche d'alors donnait comme repli).
- **Le Fil nu** — le fil et l'insigne seuls : la ligue se lit, rien ne
  dispute l'œil à une peinture chargée. Les crans se lisent dans « Ma
  collection ».

À elle seule, cette étape répond au retour, sans boutique ni nouveau dessin
d'importance.

### 3. Chaque bordure sertie prête sa feuille (`planche-feuilles.jpg`)

Rien à dessiner : les six brins existent. Sertir une bordure (ses douze
crans) ouvre son brin à toutes les autres — l'olivier d'argent en ligue d'or,
les marquises du diamant en bronze —, au métal et aux pierres de la ligue où
l'on est. Les bordures serties deviennent un vestiaire, et sertir le bronze
ou l'argent (aujourd'hui sans suite une fois passé plus haut) garde un sens.
Le givre, porté hors du platine, garde sa glace (`dessins.ts`).

### 4. Des motifs qui se gagnent aux duels (`planche-catalogue-1.jpg`, en bas)

Ils restent des trophées : l'album des trophées les montrerait sous les
bordures serties.

- **Les Perles** — un trio de perles par victoire, à la pierre de la ligue :
  *sertir la bordure d'argent*.
- **Les Rouages** — l'atelier d'Automate, un engrenage et son pignon : *battre
  Automate cinquante fois* (au dé, la voie que tout le monde a).
- **Les Flammes** — celles du Soleil noir, à toutes les ligues : *atteindre la
  ligue des maîtres*.

D'autres conditions possibles, à piocher : cinq victoires d'affilée ; battre
un joueur classé plus haut ; finir une semaine dans les dix premiers du
classement ; vingt semaines où la récompense du lundi est tombée ; un duel
gagné contre chacun de dix amis différents.

### 5. Un rayon « Bordures » à la boutique (`planche-catalogue-2.jpg`, `planche-loge.jpg`)

Six motifs dessinés ici : **les Étoiles** (reliées en constellation), **les
Écailles** (une armure), **les Vagues** (qui s'enroulent vers le haut, leur
écume), **les Rayons** (un soleil art déco), **les Fleurs** (une fleur de
bijou et son bouton), **les Plumes** (deux ailes qui se referment). D'autres
viendraient : les Notes, les Lanternes, le Lierre, les Bois de cerf, les
Cristaux, l'Art nouveau…

- **Le prix** : 400 confettis chacun dans la maquette — celui d'un thème rare.
  Un fond se voit sur sa carte (250) ; une bordure, partout où l'on te voit —
  la salle, les classements, le podium, l'écran commun —, et la boutique sait
  depuis les plaques qu'« on achète ce que les autres voient ». Variante : par
  rareté, comme les thèmes (250 les simples, 400 les ornés, 650 un motif
  animé).
- **Le présentoir** montre chaque motif autour de *ton* avatar, à ta ligue et
  à tes crans — ce que tu porterais vraiment, pas un exemple sertie en or.
- **L'essai** : comme un thème, on l'essaie dans la loge avant d'acheter ;
  « Ton envie » marche telle quelle.
- **La phrase** sous le rayon : « Un motif se dessine au métal de ta ligue, et
  ne pousse qu'à chaque victoire. »

### 6. Des motifs de saison (`planche-catalogue-2.jpg`, en bas)

**Les Cœurs** (la Saint-Valentin) et **le Houx** (Noël), dessinés ; puis les
Citrouilles (Halloween), les Flocons, les Feux d'artifice (le Nouvel An). En
boutique pendant leur fête, aux dates des thèmes de saison — ou gagnés avec le
légendaire de la fête, comme les gerbes. Seuls motifs à avoir leurs propres
couleurs (l'émail rose, le vert du houx) : le métal de la ligue les ourle, et
l'insigne la dit.

### 7. Les pierres de l'avatar (`planche-pierres.jpg`)

Une touche plus discrète : les pierres serties prennent la couleur de
l'avatar au lieu de celle de la ligue — l'aigue-marine sous le Kraken,
l'opale de feu sous le Phénix, l'émeraude sous le Dragon, l'améthyste sous la
Licorne. Le métal et l'insigne disent toujours la ligue. D'office avec
« Accordée », ou un choix de plus (six pierres, offertes ou à 150).

### 8. Encore d'autres idées, non dessinées

- **Le motif retenu par avatar** : la loge se souvient du motif choisi pour
  chaque avatar ; reporter le Kraken ramène ses vagues. (« Accordée » le fait
  d'office ; ceci, pour qui choisit à la main.)
- **Le coffre de la semaine** : un ou deux motifs du trésor, rares ou
  légendaires (les Diamants, l'Or massif), que seul le coffre donne — comme
  ses fonds et ses gerbes.
- **Le motif du compagnon** : à sa forme ultime, le monde de son compagnon —
  les étoiles du loup, les lanternes du chat, les érables du panda, les
  lucioles —, porté où l'on veut.
- **Le motif d'un thème** : chaque thème acheté apporte son motif, comme il
  apporte son podium — l'emblème de sa plaque (la flamme des Braises, la
  fêlure d'or du Kintsugi, la guirlande de la Guinguette) en devient la
  feuille. Trente-six motifs d'un coup, et une raison de plus d'acheter un
  thème — mais trente-six dessins, et beaucoup de motifs qui se ressemblent.
- **L'éclat qui fait le tour** (aujourd'hui l'argent, le diamant et les
  maîtres) à toutes les ligues, en option payante. Avec prudence : figé dans
  les listes, comme aujourd'hui (le piège des calques, règle `css.md`).
- **Ce qu'il vaut mieux ne pas faire** : choisir l'insigne ou le métal. Ce
  sont eux qui disent la ligue ; ouverts, on reviendrait au constat du
  17 novembre — « un bronze porté en Or est doré ».

### 9. Dans la loge (`planche-loge.jpg`)

La pièce « Avatar » garde sa rangée « Bordure » — Auto, Sans, une pastille par
ligue — et en gagne une, « Motif » : Accordée, puis ce qu'on a, puis ce qui
reste compté au bout, « 5 motifs à la boutique · 2 à gagner aux duels », vers
la collection. Un toucher essaie sur la carte, « Porter » enregistre, comme le
reste (`essai.motif` à côté d'`essai.bordure`). « Ma collection » gagne une
ligne « Motifs de bordure » dans le style.

## Ce que je recommande

En deux temps.

1. **Tout de suite** — la mécanique, les trois offerts (Feuilles, Jonc serti,
   Fil nu) et les feuilles prêtées par chaque bordure sertie (3). Pas un
   confetti en jeu, presque rien à dessiner, et le retour est réglé : qui
   trouve que les feuilles ne vont pas à son avatar porte le jonc ou le fil.
2. **Ensuite** — « Accordée » d'office (1 a), le rayon « Bordures » à 400
   (5), les trois motifs des duels (4), puis les saisons (6) quand elles
   reviennent — le Houx est pour dans un mois. Les pierres de l'avatar (7)
   viennent avec « Accordée » ou pas du tout : seules, elles se voient peu.

## Ce qu'il te reste à trancher

- « Accordée » : le légendaire prête-t-il son motif gratuitement (1 a), ou
  seulement parmi ceux qu'on a (1 b) ?
- Le prix d'un motif : 400 pour tous, ou par rareté ?
- Les motifs des duels et leurs conditions.
- Les motifs à garder, à retirer, à ajouter dans le catalogue dessiné.

## Ce qu'une mise en place toucherait

- `shared/duels.ts` : `BordureDeLigue` gagne son motif, `bordurePortee` le
  lit ; un catalogue pur des motifs (`shared/motifs.ts` : leurs noms, ce qui
  les ouvre, leur prix, l'accord de chaque avatar).
- La base permanente : le motif porté sur le profil (comme
  `bordureChoisie`), les achats dans une table à eux (`profile_motifs`, le
  prix payé avec chacun, comme `profile_fonds`) ; le solde
  (`boutiqueEtDons`), `unAchatALaFois`, l'envie ; `update` valide le motif
  porté.
- `client/src/components/dessinDesBordures.ts` : un dessin par motif, gardé
  par `ligue:motif:crans`, chaque motif chargé à la demande (une salle où
  personne ne porte les vagues ne les télécharge pas) ; `Bordure.tsx` reçoit
  le motif ; la silhouette de l'éclat suit le motif.
- La loge (`shared/loge.ts`, `Apparence.tsx`), la collection
  (`shared/collection.ts`, `shared/style.ts`), les nouveautés de la loge, la
  boutique (`Pieces.tsx`), l'album des trophées pour les motifs des duels.
- L'instantané de la salle (invariant 4) : le motif ne change pas à chaque
  tick, il y passe comme la bordure ; un champ qui envoie un joueur envoie
  aussi ce qu'il porte (`ApparenceDeLAvatar`, `un-seul-avatar.test.ts`).
- Les prix et les conditions sont des choix de produit :
  `docs/reference/baremes.md`, `docs/produit/la-boutique.md`,
  `docs/produit/les-duels.md` ; les règles `duels.md`, `medaillons.md`,
  `profil.md`.

## Ce que la maquette ne montre pas

- Ce qui bouge : l'éclat de l'argent, du diamant et des maîtres — tout y est
  figé.
- Les Divins en gloire sous un motif.
- La puce de la salle d'attente à l'écran commun (1,7 em), où chaque motif
  devra encore se lire.

## Refaire la planche

```bash
cd server && npx tsx ../retours/2026-11-26/bordures-au-choix/planche.ts
```

`SEULEMENT=accordee,crans` pour quelques sections, `SANS_IVOIRE=1` pour
sauter le thème clair, `DENSITE=2` pour des photos plus fines. Les pages
(`planche.html`, `planche-ivoire.html`, cinq mégaoctets chacune) sont
ignorées par git.
