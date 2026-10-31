# La carte du joueur : son savoir en radar, ses sentiers — la maquette (31 octobre 2026)

« J'aimerais ajouter une carte radar pour les joueurs où on peut voir les
forces et faiblesses en fonction des catégories. Ça se rajouterait à la carte
joueur que l'on pourrait swipe pour avoir plus d'info. Aussi de voir les
paliers de la campagnes / maître obtenu. Tu pourrais me faire une maquette,
j'aimerais avoir quelque chose de très jolie » (le propriétaire).

## La maquette

Trois écrans de téléphone (390 × 844), dessinés dans le style de la carte à
collectionner — son cadre d'or, son quadrillage, Cormorant et Figtree, les
cadrans aux coins dorés —, sur une planche Design privée :
<https://claude.ai/artifact/W2rddzH1ZyyZQhb5BTiYxe>

- **3ᵉ face — Son savoir (Léa)** : le radar de ses douze catégories, la pierre
  de son écusson au bout de chaque rayon ; une catégorie touchée dit sa part,
  sur combien de QCM, son écusson, une barre contre les autres joueurs et son
  sentier ; « Comparer » posait en pointillés bleus la moyenne des joueurs ;
  dessous, ses forces et ce qui lui reste à conquérir.
- **4ᵉ face — Ses sentiers (Léa)** : trois cadrans (paliers, portraits,
  maîtres), les douze sentiers en anneaux de douze crans autour du dernier
  portrait gagné, les maîtres en or et émail noir ; un sentier touché dit son
  prochain portrait.
- **Son savoir d'une débutante (Inès)** : une catégorie paraît dès dix
  questions ; le radar se dessine en pétales pour celles qu'elle connaît.

Sous la carte, la maquette remplaçait « Retourner la carte » par quatre points
(Recto · Dos · Savoir · Sentiers).

## Les décisions

- « **Tout le monde voit les faiblesses** » (le propriétaire, sur la maquette) :
  « À conquérir » est sur toute carte d'un profil, pas seulement la sienne.
- « Pour le reste fais ce qui te semble le mieux » :
  - **la carte se retourne de face en face**, au bouton comme au doigt : le
    retournement était le geste aimé de la carte (« J'aime beaucoup retourner
    la carte », le 20 octobre 2026) — « Retourner la carte » garde son nom et
    montre la face suivante, le doigt qui glisse de côté la suivante ou la
    précédente, dans son sens ; les quatre points de la maquette sont devenus
    des **gemmes serties au pied du cadre**, sans une ligne de plus — dans les
    sept pixels du cadre : épaissi pour elles, il faisait défiler le dos d'une
    habituée en 360 × 640 ;
  - **sans la moyenne des joueurs** : elle demande un calcul sur tous les
    profils que le serveur n'a pas, pour une nuance ; le radar se lit seul,
    d'une catégorie à l'autre ;
  - **pas de face vide** : son savoir dès une catégorie à dix QCM
    (`QCM_POUR_LE_RADAR`), ses sentiers dès un palier validé, et seulement
    ceux qu'il a commencés — l'absence, pas « 0 sur 12 » ;
  - « Portraits » se dit **avatars**, comme sur la page des sentiers
    (« 43 avatars sur 72 ») ; le cadre du détail reste celui de la carte — teint
    de la lueur de chaque branche, il passait au rose du grand écran, qui se
    lisait comme une erreur —, seule sa jauge prend la lueur de la branche.

## Dans le code

La règle du domaine dit tout (`.claude/rules/profil.md`, la carte d'un
joueur) ; la décision, `docs/architecture/decisions.md` (« La carte en quatre
faces »). Les photos se refont avec `server/scripts/rendu-carte.ts` (client
construit d'abord) — chaque face, Léa et une débutante, sous Ivoire, et le
doigt qui glisse, en vrais événements tactiles ; elles vivent dans `export/`,
qui ne se committe pas.
