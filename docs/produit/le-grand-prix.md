# Le Grand Prix

> Le jour d'un joueur — un anniversaire, une fête : ce jour-là, toute la bande court contre **son fantôme**. Dix obstacles, un QCM chacun, dans un ciel d'étoiles ; le fantôme rejoue ses vraies réponses, à son rythme. Qui le bat gagne **son flot**, une rosette à son avatar, et parfois un avatar peint en plus. La personne fêtée reçoit le sien le matin, en or. Programmé au QG, pour n'importe qui.

Né le 19 novembre 2026, pour un anniversaire de début décembre : le propriétaire voulait « un évènement où il faudrait battre » une amie, « son double avec ses vraies réponses rejouées », et que ce soit **générique** — « n'importe qui comme avatar, et jouer contre lui ». La maquette et ses décisions : `retours/2026-11-19/grand-prix/`.

## La course

- **Chaque écran tient sur un écran**, son bouton compris, en 360 × 640 : des blocs qu'on voit avant de les lire — des tuiles, des pictogrammes, des pastilles —, presque sans phrase (le propriétaire, le 19 novembre 2026 : « Je veux que tout soit visible sur un écran […] moins de texte inutile, plus épuré »). Le bouton reste sous le pouce si le texte agrandi fait défiler la page.
- **Le départ** (`/grand-prix`) : le titre et le fantôme dans le ciel, **son terrain** en trois tuiles, le flot à gagner, la règle en quatre pictogrammes (« 10 obstacles », « Faute : 4 pts », « Égalité : chrono », « Essais illimités »), ceux qui l'ont déjà battu, dans l'ordre d'arrivée.
- **Ceux qui l'ont battu**, une ligne chacun : son rang d'arrivée, son visage et son prénom, à quel essai (« du premier coup », « au 3ᵉ essai ») et de combien il a battu le fantôme — des points (« 8 pts d'avance »), ou à points égaux du temps (« 3,4 s plus vite ») ; le fantôme ne fait pas le même score d'une course à l'autre, l'avance se mesure sur la course de la victoire, celle qui a valu le flot. Les trois premiers sur la page — deux sur un petit téléphone, pour qu'elle tienne sur l'écran —, et « Tous les 5 » ouvre la liste entière dans une feuille (le propriétaire, le 19 novembre 2026 : « plus de détails par rapport à la personne battue »).
- **Son terrain** : les thèmes de la campagne où le fantôme a passé le plus de temps — trois au plus, choisis au QG, les trois plus joués d'office. On le bat chez lui : le Grand Prix est fait pour mettre la personne fêtée en valeur. Au départ, chaque thème est une tuile, son emblème et son nom ; ses comptes ne se lisent qu'au QG. Le quiz du jour n'y entre pas : le propriétaire l'a écarté — tout le monde l'a joué le même jour, et ce n'est pas là qu'on est chez soi.
- **Dix obstacles**, un QCM chacun, tirés de ses vraies réponses en campagne sur son terrain — la question telle qu'il l'a lue —, les thèmes à tour de rôle (4, 3 et 3 sur trois thèmes). Vingt secondes chacun ; le nom du thème au-dessus de la question. Le chrono part quand l'obstacle se montre, à l'horloge du serveur.
- **Le fantôme saute** à son rythme : la campagne ne garde pas les temps, il saute donc à un temps tiré de ses temps du quiz du jour au même verdict — la seule chose qu'on en garde —, plus lent quand il se trompe. On le voit sauter, jamais ce qu'il a répondu : ça, c'est à la révélation.
- **Le barème du concours hippique** : une barre — une mauvaise réponse — ou un refus — l'obstacle laissé au temps — coûtent **4 points**. Le moins de points gagne ; à égalité, le temps cumulé départage. Battre le fantôme, c'est moins de points, ou autant et plus vite.
- **La révélation** de chaque obstacle : la bonne réponse, la sienne, celle du fantôme, l'anecdote. **L'arrivée** : les deux colonnes, le flot gagné, et « Où ça s'est joué » — la grille des dix obstacles, les siens et ceux du fantôme.
- **On recourt autant qu'on veut**, un parcours neuf à chaque fois — les questions pas encore courues d'abord, et celles qu'on a déjà jouées soi-même en campagne en dernier : sur un thème qu'on partage avec le fantôme, on ne court pas sur ses propres réponses. Le flot tombe à la première victoire, une fois.
- **Ni expérience ni confettis** : le Grand Prix ne donne aucun avantage de jeu (invariant 8). La personne fêtée court aussi contre son propre fantôme, si elle veut.

## Ce qu'on gagne

- **Le flot** : la rosette du concours hippique, à la couleur de son ruban — bleu nuit, bordeaux, vert sapin, violet, rose —, l'avatar du fantôme en son cœur, tel qu'il le portait ce jour-là. Un par Grand Prix, rangé dans « Ma collection », au carnet des fêtes (« Tes Grands Prix ») ; il compte comme un timbre, au compte de la collection et à sa valeur.
- **Le flot d'honneur**, d'or, pour la personne fêtée, rangé le matin.
- **Un avatar en plus**, au choix du QG : **Pégase**, un cheval d'étoiles peint, pour qui bat le fantôme, et **Pégase couronné** pour la personne fêtée, le matin. Des légendaires **secrets** : ni case ni silhouette dans l'album à qui ne les a pas, rien dans la loge ; seuls ceux qui les ont les voient. Pégase **sort tout entier de son cercle** — ailes, pattes et queue —, quand les autres légendaires n'en débordent qu'éclatés, et par le haut ; dans une liste, il reste dans son disque comme eux.

## Sur l'accueil

Ce jour-là, le Grand Prix prend la place de l'affiche d'une nouveauté, couché en bandeau : son flot, son titre, « Courir » — « Recourir » une fois battu. L'accueil tient toujours sur un écran. La personne fêtée trouve à son réveil une feuille par-dessus l'accueil, une fois par téléphone : le mot de l'administrateur, son flot d'honneur, son avatar, et une ligne — « Toute la bande court contre ton fantôme » —, puis « Le porter », « Mon Grand Prix ». Sa page a son flot d'or dans le ciel, et le bilan de son fantôme : combien l'ont couru, combien l'ont battu, et qui — à quel essai, de combien ; puis son terrain et « Me battre moi-même ».

## Au QG

`/admin#grand-prix`, sous « Animer » : [administrer](../guides/administrer.md#le-grand-prix).

## Comment c'est construit

- `shared/grandPrix.ts` — les règles pures : le score d'une course (`scoreDe`, `bat`, `valeurDeLaCourse`), le tirage d'un parcours (`tirerLeParcours` : les thèmes à tour de rôle, le jamais couru d'abord, le déjà vu en dernier), le rythme du fantôme (`tirerUnRythme`), les flots (`flotDe`, `flotsDe`), les vues.
- `server/src/core/grandPrix.ts` — le magasin (`GrandPrixStore`) : les thèmes d'un fantôme (`themesDuFantome`), programmer et figer le vivier de son terrain, ouvrir le jour (l'avatar du fantôme figé, le flot d'honneur rangé), la course — le chrono à l'horloge du serveur (`servie_le`), un refus relevé à la lecture suivante, une réponse renvoyée qui rend la même révélation —, le bilan du fantôme, le carnet. Les tables : `grand_prix`, `grand_prix_questions`, `grand_prix_courses`, `grand_prix_reponses` ([la base](../reference/base-de-donnees.md#grand_prix)). Les routes : [l'API](../reference/api-http.md#le-grand-prix).
- Ce qu'il fait tomber se range comme une voie (`#grand-prix:<id>`, les préfixes `flot:` et `grandprix:` de `PREFIXES_DES_VOIES_RANGEES`) : ni trophée ni étagère.
- `client/src/views/GrandPrixApp.tsx`, `client/src/components/GrandPrix.tsx` — la page, les chevaux en constellations, l'obstacle, le flot ; `QgGrandPrix.tsx` au QG.
- `server/test/grand-prix.test.ts` ; `server/scripts/rendu-grand-prix.ts` photographie chaque écran.
