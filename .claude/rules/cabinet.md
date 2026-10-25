---
paths:
  - "shared/cabinet/**"
  - "server/test/cabinet*.ts"
---
# Le Cabinet de curiosités : les salles, les œuvres, les jeux, les cartes-bonus, la poussière, les gardiens

La refonte de l'Expédition, validée le 24 octobre 2026 (`retours/2026-10-24/le-cabinet.md` ; le pourquoi de chaque choix, `docs/architecture/decisions.md`, « Le Cabinet de curiosités ») : un musée à remplir — les 84 cartes peintes en neuf salles —, neuf jeux de trois manches, une carte-bonus à emporter, des gardiens légendaires. Une partie est une série de la campagne (`mode = 'cabinet'`). En construction, en préproduction d'abord ; fermé en production (`CABINET_EN_PRODUCTION`).

## Les fichiers

- `shared/cabinet/oeuvres.ts` — les 84 œuvres (`OEUVRES`, `CleDOeuvre`), recopiées des rencontres pour que la page ne tire pas `shared/rencontres.ts` ; le jeu de chacune (`JEU_DE_L_OEUVRE`) et les œuvres de départ (`OEUVRES_DE_DEPART`), gelés
- `shared/cabinet/salles.ts` — les neuf salles et leurs mots (« de la salle du Devin »), les gardiens (`GARDIENS_DES_SALLES`, `AUTRES_GARDIENS`, `POUVOIR_DES_GARDIENS`), leur voie sur l'étagère (`voieDuGardien` : `cabinet:<clé>`, `saison:<clé>`) et ce qui les réveille, en mots (`conditionDuGardien`)
- `shared/cabinet/pouvoirs.ts` — les cinq pouvoirs et à qui ils vont (`POUVOIR_DE_LA_FAMILLE`, `POUVOIR_DU_NEUTRE`, `pouvoirDe`), leur force (`forceDe`, `forceDite`), pourquoi un pouvoir ne sert pas (`refusDuPouvoir`, la seule règle), les étoiles après Protéger et Miser (`etoilesApresLesPouvoirs`)
- `shared/cabinet/bareme.ts` — tous les chiffres, la grâce et la pause du chrono comprises, chacun sa ligne dans `docs/reference/baremes.md`
- `shared/cabinet/ouverture.ts` — `CABINET_EN_PRODUCTION`, `cabinetOuvert`, les jeux livrés (`JEUX_PRETS`)
- `shared/cabinet/pieces.ts` — ce que le journal garde d'une pièce (`PieceDuCabinet`), les identifiants `cab:` (`PREFIXE_DU_CABINET`, `deplier`), la colonne `joker` (`JOKER_D_ECLAIRER`, `JOKER_DU_TEMPS`)
- `shared/cabinet/france.ts` — le cadre de l'Épingle (`DANS_LA_FRANCE`), la distance à vol d'oiseau (`distanceKm`), la projection de la carte de France
- `shared/cabinet/contenu.ts` — la forme du contenu neuf (lieux, fiches, répliques, frises à thème) et les bornes de son juge
- `shared/cabinet/jeux/regle.ts` — les neuf jeux (`CleDeJeu`, `CLES_DES_JEUX`), ce que chacun dit à l'annonce (`JEUX`, `changeable` compris), le moule de leur règle (`RegleDuJeu`), `justeDeLaPiece`
- `server/test/cabinet-catalogue.test.ts` — le catalogue relu contre les rencontres, les peintures, les légendaires et les saisons ; les tables gelées, écrites en entier

## Les pièges

- **Un chiffre du Cabinet vit dans `bareme.ts`, et sa ligne de `baremes.md` change dans le même commit** (`documentation.test.ts`). Un jeu, le pli ou la page l'importent, jamais ne le recopient — la grâce comprise.
- **Le catalogue recopie les rencontres** : une carte peinte de plus, un nom retouché, une rareté changée font rougir `cabinet-catalogue.test.ts`. L'œuvre s'ajoute à `OEUVRES`, à `JEU_DE_L_OEUVRE` (le typage la réclame) et, au Vestibule, à `POUVOIR_DU_NEUTRE` ; elle rouvre sa salle sans endormir son gardien. Une œuvre ne se retire jamais, et les deux tables gelées ne se réécrivent pas sans le dire (invariant 22).
- **Le pouvoir d'un gardien est celui de la salle qu'il garde** (`POUVOIR_DES_GARDIENS`), jamais la famille de sa carte dans les rencontres : le Sapin y est du Flambeur, il protège ici.
- **Une pièce par verdict, juste dès deux étoiles naturelles** (`justeDeLaPiece`) — jamais les étoiles après les pouvoirs ; au Pari, à sa bonne réponse. Seule sa première question, répondue dans les temps et sans aide, est nue : toute autre pièce porte la forme de son jeu.
- **`joker` porte un pouvoir, jamais la clé d'une carte** (`JOKER_D_ECLAIRER`, `JOKER_DU_TEMPS`) : Bastion et Cuirasse sont des cartes du second essai de l'Expédition, que le carnet lit (`CARTES_DU_SECOND_ESSAI`).
- **Un identifiant hors de la base commence par `cab:`**, jamais par un préfixe à lui : le carnet, la mesure et le signalement lisent une seule liste. Un composé se déplie pour la fraîcheur du Cabinet (`deplier`) ; la série ne déplie pas.
- **Ce qui se tire se tire au départ, et ce qui juge vit au serveur** : la vue choisit ses champs un à un (invariant 1). Une retouche qui change ce qu'une partie en route tire ou juge — une durée, un barème de manche — monte la version de son départ.
- **Jamais `Date.now()`** : une échéance se lit à l'heure du serveur (invariant 6). La saison d'une œuvre se lit au calendrier du Cabinet (`core/saisons.ts`), jamais à `periodeDu` : le banc et le smoke le ferment.
- **La page ne lit pas `CABINET_EN_PRODUCTION`** : la préproduction sert le même code, c'est le serveur qui sait.
- **Rien d'un Divin** : ni carte-bonus, ni gardien, ni un mot de leurs règles (invariant 21, `divins.test.ts`).
- **Les mots de l'écran** : « œuvre », « carte-bonus », « carte de France », jamais « carte » seule — `cabinet-catalogue.test.ts` relit les textes du catalogue ; les classes CSS en `cab-`.
