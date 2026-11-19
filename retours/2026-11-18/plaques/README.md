# Les plaques de nom, deuxième version : le paraphe, la vitrine du podium (18 novembre 2026)

> « J'aimerais que les plaques des thèmes soient super jolies et n'encombrent
> pas trop la vue dans le classement. Donne-moi des pistes pour faire ça ? »
> — le propriétaire, le 18 novembre 2026. Puis, après trois tours de pistes :
> « Une combinaison qui me plaît : le paraphe pour tous, la vitrine pour le
> podium, et la grande plaque dans les duels. »

## Ce que montrait la production

Lu le 18 novembre 2026 sur une copie de la base, par le jeton en lecture
seule (`PROD_LECTURE_TOKEN`) : la copie, ses abonnements aux notifications
retirés, a servi un serveur local, et ses pages ont été photographiées au
téléphone. Des totaux, sans un nom :

- **12 profils sur 42 montrent une plaque**, mais ce sont les plus assidus :
  les dix premiers du classement du mois en avaient tous une. Dix lignes
  entières de dix couleurs — Braises, Halloween, Ciel, Olympe, Licorne,
  Disco, Kintsugi… — faisaient une mosaïque : le regard sautait d'une ligne
  à l'autre, chaque score avait sa couleur, et les huit familles de motifs
  (points, grilles, hachures) de la maquette du 10 novembre se lisaient
  comme des esquisses — la fêlure du Kintsugi, deux traits en « A ».
- **13 profils portent un avatar dessiné** (9 légendaires, 3 portraits, un
  compagnon), presque tous dans leur bordure de ligue : un médaillon de
  40 px, son halo et ses étincelles. Les scores du mois ont cinq chiffres.

## Les pistes, dans l'ordre où elles ont été montrées

1. **Trois traitements** (`maquette/trois-pistes.html`) : A, le cartouche —
   la plaque porte l'avatar et le prénom, le rang et le score restent à
   tous — ; B, le liseré et l'emblème ; C, la plaque gravée. Le propriétaire
   a aimé A, et demandé « plus joli ».
2. **Le cartouche, plus loin** (`maquette/le-cartouche-plus-loin.html`) : la
   matière de chaque thème (laque, kraft, néon, glaçage…), le décor sur les
   bords, le prénom dans la police du thème. Puis, sur la copie de la
   production : l'avatar dans le cartouche coupait les prénoms (« Ro… »)
   et cachait le halo des médaillons ; dehors, chaque ligne grandissait ; le
   médaillon épinglé au bout de la plaque tenait.
3. **Six directions vraiment différentes** (« sois créatif »), posées sur le
   vrai classement du mois avec la vraie plaque de chacun : le fanion, le
   billet, **le paraphe**, le sceau de cire, le projecteur, **la vitrine du
   podium** ; et, hors de la liste, **la grande plaque des duels**, le
   vainqueur d'hier à l'accueil, la plaque sur la carte du joueur.

## Ce qui a été décidé

- **Le paraphe, pour tous** : la ligne reste celle de tous ; un trait de
  plume aux couleurs de la plaque souligne le prénom, et son emblème le suit.
- **La vitrine, au podium** : la plaque entière, plus haute, son relief, son
  emblème en grand — au rang 3 au plus, ex æquo compris
  (`PLACES_EN_VITRINE`). Achetée, elle ne se montre en grand qu'en montant :
  elle se gagne aussi en jouant.
- **La grande plaque dans les duels** : maquettée sur les vrais duels, puis
  codée telle quelle (« Code la grande plaque des duels comme dans la
  maquette »).

## Ce qui en est fait

- **Un emblème par thème**, trente-quatre dessins en deux tons
  (`server/scripts/emblemes-des-plaques.ts`) : le clair de la plaque cerné de
  son sombre, chacun poussé jusqu'à 3:1 sur le fond de chaque thème — le
  paraphe et l'emblème se posent sur le fond de celui qui regarde, n'importe
  lequel des trente-cinq — et sur sa propre plaque. Cinq dessins refaits
  après leur planche : la guirlande se lisait comme une moustache, les
  fanions comme une couronne, puis comme des crocs (le serpentin les a
  remplacés).
- **Le prénom ne s'étire plus jusqu'au score** sur une ligne à plaque : le
  trait n'a que sa longueur. L'emblème cède avant le prénom et rapetisse
  entier : sur la copie de la production, un légendaire bordé, un laurier et
  un score à cinq chiffres le réduisaient à 8 px en 360 de large.
- **La loge et la boutique montrent la vitrine** (`LigneDePlaque`) : la forme
  la plus entière, celle qu'on achète.

## La grande plaque des duels : la maquette

`duels/avant-apres.jpg`, posée sur les vrais écrans d'un duel (`rendu-duels.ts`,
la feuille `duels/maquette.css` injectée par-dessus) : **le duel à relever**,
chaque carte habillée de la plaque de son joueur — son fond, son double filet,
son emblème en semis, le « ? » à son or —, et **le verdict**, chaque joueur sur
son socle à ses couleurs, son nom sur sa plaque et son emblème.

## La grande plaque des duels : le code

`duels/le-code.jpg` : les mêmes écrans, photographiés sur le code (`PLAQUES=1
npx tsx scripts/rendu-duels.ts`, Léa en Kintsugi, Tom en Guinguette) — chez
Léa qui attend, chez Tom qui le reçoit, la victoire de Tom, la défaite de Léa.

- **Le serveur dit la plaque des deux joueurs** d'un duel classé
  (`DuelEntreAmis.auteur`, `.contre`) et celle d'en face à la fin d'une partie
  (`Adversaire.plaque`) : `saPlaque`, `core/campagne.ts`, de mémoire comme aux
  classements ; jamais d'un masqué — qui ne se nomme pas ne montre pas sa
  plaque —, ni d'Automate.
- **Les deux écrans la posent** (`DuelFaceCachee`, `VerdictDuDuel`) par la
  classe des classements (`classeDeLaPlaque`) et la même pièce d'emblème ;
  sans plaque, la carte d'avant au caractère près.
- **Relevé en le faisant** : le semis de la maquette (`::after`, à 8 %) se
  peignait par-dessus tout ce que la carte porte — positionné et dernier, il
  passait devant ses pièces, positionnées elles aussi : il est devenu le
  premier (`::before`). Et chaque texte se mesure sur ce qu'il y a vraiment
  dessous, semis, reflet et dégradés compris : à 10 %, l'encre atténuée de
  quatre plaques tombait sous 4,5:1 ; à 8 %, seule la case « à jouer », qui
  l'écrit en petit, en avait besoin — elle a pris un sol plein
  (`plaques.test.ts` mesure les trente-quatre).

Relevé en la faisant : `.carte-plaque` est pris (la plaque du compagnon sur la
carte d'un joueur, en absolu) — la classe de la maquette l'avait emprunté, et
la carte d'en face sautait au coin de l'écran (le piège des modificateurs
courts, règle `profil.md`).

## L'avis demandé, et une contre-proposition

> « Donne-moi un avis honnête sur le design de la plaque et comment ça
> s'intègre dans le quiz du jour, défi de la semaine etc. Est-ce qu'il n'y a
> pas mieux à faire ? » — le propriétaire, le soir du 18 novembre 2026.

Relu sur les captures de la copie de la production (le mois, le défi, le
classement des duels) :

- **La vitrine du podium est le maillon faible.** Trois lignes pleines de
  trois thèmes, c'est encore une mosaïque, là où l'œil arrive. La plus claire
  attire le regard quel que soit son rang (une plaque d'Ivoire troisième
  éclipse le premier), le score change de couleur à chaque ligne, et un
  premier sans plaque paraît moins bien servi que son dauphin. Au classement
  des duels, rangé par ligues, elle distingue trois lignes sans rapport avec
  ce rangement — chacune seule en tête de sa ligue.
- **Le paraphe est discret, mais il dit peu.** Sept plaques sur dix tracent un
  trait jaune ou orangé ; sous un thème clair, presque toutes le même trait
  brun. Souligné, un prénom se lit comme un lien. Et l'emblème est une petite
  icône de plus derrière le prénom, après le laurier et avant le niveau, qui
  rapetisse jusqu'à la tache sur une ligne serrée.
- **Trois dessins pour un seul objet** : ligne pleine, trait, carte habillée.
  La boutique promet la ligne pleine (« les autres te verront ainsi »), que
  trois joueurs seulement voient.
- **La grande plaque des duels tient** : à un contre un, elle a la place.

La contre-proposition, `contre-proposition/` (`mois.jpg`, `duels.jpg`,
`ivoire.jpg` ; `maquette.css`, posée sur les vraies lignes d'un serveur
jetable — quinze profils fictifs, portraits, ligues, scores du mois) :
**la plaque du nom, une seule forme partout** — celle des duels. Le prénom
s'écrit sur sa petite plaque, à ses vraies couleurs (son fond, son filet, son
encre) ; la ligne, le rang, le niveau et le score restent ceux de tous. Au
podium, la même, gravée : son double filet, et son emblème quand la ligne a
la place. Plus d'emblème dans le corps de la liste.

Ce qu'elle coûte, mesuré sur la maquette : le corps de la liste est plus
présent qu'avec le paraphe — une colonne de petites plaques, les sombres
ressortant sous un thème clair et les claires sous un thème sombre — ; le
prénom perd une douzaine de pixels (une lettre sur la ligne la plus serrée :
« Béréni… » devient « Bérén… ») ; les lignes, elles, raccourcissent (49 px au
podium au lieu de 64, 45 ailleurs au lieu de 48). Rien n'en est codé : à
décider. La voie prudente, si le paraphe plaît : ne remplacer que la vitrine
par la plaque du nom, et garder le paraphe plus bas.

## Trois propositions, repartie de zéro

> « Ça ne me plaît pas. Sans prendre en compte tout ce qu'on a fait avant,
> qu'est-ce que toi tu aurais fait ? Montre-moi 3 propositions » — le
> propriétaire, le soir du 18 novembre 2026, sur la contre-proposition.

`trois-propositions/` (`1-signature.jpg`, `2-ecrin.jpg`, `3-podium.jpg` ;
`maquette.css`), posées sur les vraies lignes du classement du mois d'un
serveur jetable — quinze profils fictifs, portraits, scores —, sous le Velours
et l'Ivoire. Aucune ne garde rien de ce qui précède : ni ligne pleine, ni
trait, ni plaque autour du prénom, ni emblème dans la ligne.

1. **La signature** : le prénom écrit dans la police de titre de son thème
   (Yeseva One pour la Guinguette, Italiana pour le Kintsugi, Creepster pour
   Halloween, Press Start 2P pour la Game Boy…), à l'encre de son thème
   poussée jusqu'à 4,5:1 sur le fond de celui qui regarde. Rien d'autre ne
   bouge, la ligne garde sa hauteur. C'est ce qui distingue le plus les
   thèmes entre eux et qu'on n'avait jamais montré. Ce qu'elle coûte : une
   police de plus par thème à l'écran (20 à 40 Ko chacune, chargées pour les
   seuls thèmes montrés), des tailles réglées police par police (une échelle
   chacune, mesurée à l'œil), et des polices de fantaisie moins lisibles en
   petit — Creepster, Press Start 2P, l'Italiana très fine.
2. **L'écrin** : l'avatar posé sur une petite tuile carrée aux couleurs de son
   thème — son fond, un double filet, son emblème en filigrane. Le prénom, le
   niveau et le score restent ceux de tous. Chaque thème se reconnaît à sa
   tuile, comme une carte de collection ; rien ne passe sous un texte. Ce
   qu'elle coûte : 10 px par ligne (54 au lieu de 44), et les thèmes vifs —
   la Game Boy — ressortent fort.
3. **Le podium** : les trois premiers sortent de la liste et montent sur une
   scène, chacun sur sa marche à ses couleurs (son fond, son emblème en
   filigrane, son rang à son or) ; la liste dessous reste sobre. Ce qu'elle
   coûte : seuls les trois premiers montrent leur thème, 200 px de plus en tête
   du classement, et rien pour le classement des duels, rangé par ligues.

Rien n'en est codé : à décider. L'écrin et le podium se combinent.

## L'écrin et le podium, partout où un joueur se montre

> « L'écrin combiné au podium est une bonne idée. Comment on fait pour les
> duels / classement des duels ? J'ai peut-être oublié autre part. » — le
> propriétaire, le même soir.

**Les duels** (`trois-propositions/4-duels.jpg`, vus par une joueuse classée
7ᵉ) : à l'onglet « Classement », chaque avatar « à ta portée » dans son écrin,
et le « Top 3 » en trois petits écrins ; la feuille du classement entier
s'ouvre sur le podium, puis les ligues dessous, chaque ligne dans son écrin
— une ligue dont tous les joueurs sont montés sur le podium perd son titre.
Les écrans d'un duel (le duel à relever, le verdict) gardent la grande plaque
codée le même jour : la carte habillée est un écrin en grand, le socle du
verdict une marche du podium.

**L'inventaire** — où la plaque se montre aujourd'hui, et où des joueurs
paraissent sans elle :

| Où | Aujourd'hui | Avec l'écrin et le podium |
|---|---|---|
| Quiz du jour : le jour, le mois | paraphe, vitrine | podium, écrin sur chaque ligne |
| Défi de la semaine (et le défi entre amis d'avant, même ligne) | paraphe, vitrine | podium, écrin |
| Duels : le classement entier | paraphe, vitrine | podium, puis les ligues, écrin |
| Duels : « à ta portée », « Top 3 », « Entre amis » | rien | écrin |
| Duels : « En cours », « Historique », les face-à-face | rien | écrin |
| Le classement des collectionneurs | rien | podium, écrin |
| Les amis, la recherche, les joueurs croisés | rien | écrin |
| La page d'un duel : la carte, le verdict | la grande plaque | inchangée |
| La loge (« Ma plaque »), la fiche d'un thème à la boutique | une ligne en vitrine | sa ligne dans son écrin, et sa marche du podium |
| La carte d'un joueur | rien | rien : elle a son fond de carte |
| En soirée, l'écran commun, la télé, un invité anonyme | rien | rien (invariant 8) |

Ce qui part : le paraphe, la vitrine et l'emblème dans la ligne. Ce qui
reste : les couleurs de chaque plaque et ses emblèmes, qui servent au
filigrane de l'écrin, aux marches du podium et aux cartes d'un duel. À
trancher en codant : le podium ne se dresse pas quand plus de trois joueurs se
partagent les trois premières places (la liste les garde tous).

## L'écrin et le podium : le code

> « Tu as mon feu vert » — le propriétaire, le même soir.

`trois-propositions/5-le-code.jpg` et `6-le-code-ivoire.jpg` : le code, vu
par une joueuse classée 7ᵉ, sous le Velours et sous l'Ivoire. Codés sur tout
l'inventaire, sauf ce qui dit « inchangé » : l'écrin
(`Ecrin`, `client/src/components/Plaque.tsx`) partout où un joueur se montre
hors d'une soirée, le podium (`PodiumDuClassement`, `surLePodium`) en tête du
jour, du mois, du défi — de la semaine et entre amis — et du classement
entier des duels. Le serveur envoie la plaque avec ce qu'un joueur porte
(`SonApparence.plaque`, `sonApparence`), ce qui l'amène d'un coup aux amis, à
la recherche, aux joueurs croisés, aux duels en cours et joués ; aux
collections, elle se pose à la lecture (`avecSaPlaque`), le relevé gardé ne
la portant pas. Le paraphe, la vitrine et l'emblème dans la ligne sont partis.

Relevé en le faisant :

- **Les collections avaient déjà leur podium**, en cartes à collectionner
  encadrées par la ligue : il reste ; l'illustration de chaque carte y devient
  l'écrin.
- **Le rang d'une marche se lisait mal sous l'Ivoire** : l'ombre du bas à
  18 % et le filigrane à 12 % de la maquette le faisaient tomber à 2,85:1 ; à
  10 % l'un et l'autre, 3,51 au pire des trente-quatre plaques
  (`plaques.test.ts` le mesure).
- **40 px de vide sous le podium du jour** : la colonne du classement a son
  écart (18 px), qui s'ajoutait aux marges.

## Les deux autres demandes du même message

- **« Quand deux personnes ont le même score il n'apparaît pas dans le
  classement »** (les duels) : le classement entier les montrait bien tous
  deux ; « À ta portée » non. Elle ne prenait que les cotes strictement
  au-dessus de la sienne, puis son voisin suivant : classé avant lui par son
  prénom, un ex æquo n'était ni l'un ni l'autre — de deux ex æquo, l'un
  voyait l'autre, l'autre non ; deux ex æquo en tête ne se voyaient ni l'un
  ni l'autre. Corrigé (`aSaPortee`, `autourDe`, `duels-place.test.ts`).
- **Départager les ex æquo au temps de réaction**, au quiz du jour et au défi
  de la semaine : une proposition, dans la réponse au propriétaire ; rien de
  codé.

## Ce qui reste

- Le départage au temps de réaction : à décider.
- La police du thème sur le prénom, et une richesse de la plaque selon la
  rareté du thème : proposées, pas encore décidées.
- Ce que les emblèmes font au téléphone Android de la friture (un Redmi,
  règle `css.md`) ne se lit que sur lui : des images, pas des tracés, ils ne
  devraient pas y passer en multi-échantillonnage.
