# Le compagnon — le principe, consolidé (18 octobre 2026)

Ce qui est décidé ou proposé, en un seul endroit. Dans l'application : les
trois compagnons de la boutique, leurs quatre formes, portées en avatar — et,
depuis le 18 octobre 2026 au soir, **la niche** (le point 1 de la fin de
cette page : sa place sur chaque page, sa fiche, son repli, et le compagnon de
la niche qui grandit) ; depuis le 19 octobre, **ses humeurs et ses réactions
à la révélation** (le point 2 : le § 2 tel qu'il est écrit). Le reste
attend ; les preuves visuelles sont sur la planche (lien dans `README.md`).

## En une phrase

Un animal peint qui t'accompagne partout, grandit avec tes bonnes réponses,
vit dans sa niche — et ne te donne jamais aucun avantage.

## 1. Sa place : la niche

- Une petite fenêtre en arche, 54 × 62, **toujours en haut à droite** du
  téléphone, sur toutes les pages : l'accueil, le profil, la boutique, le quiz
  du jour, la soirée, les duels, l'expédition. La première ligne de chaque page
  s'arrête avant elle. Elle se replie quand la page défile.
- Son fond est **le décor peint de sa forme** — celui de son avatar : la pleine
  lune du loup adulte, la forêt de nuit de la luciole. La première forme, qui
  n'a pas de décor, a un ciel teinté.
- Il y est en buste, grand visage : c'est ce qui rend ses humeurs lisibles à
  cette taille (le médaillon en pied a été essayé et écarté : trop petit, et
  « trop de variation »).
- La toucher ouvre **sa fiche** : son nom, sa forme, sa jauge, « Le caresser ».
- **Sans compagnon, pas de niche** : l'invité anonyme et le profil qui n'en a
  pas voient la ligne aller jusqu'au bord (invariant 8 : l'absence, pas
  l'infériorité).

## 2. Sa vie : calme, rare, de ton côté

| Moment | Ce qu'il fait |
|---|---|
| Pendant la question | Rien : il ne bouge pas. |
| Tu touches une réponse | Il retient son souffle — penché, son ciel s'assombrit. Le téléphone ne sait pas encore si c'est juste (invariant 1). |
| Bonne réponse | Tu le nourris : des étincelles vont des points à sa niche, sa jauge paraît le temps du repas, « +1 », il sautille. |
| Ratée | Dépité avec toi, jamais déçu de toi : il pleut chez lui, rien ne sort vers la page. |
| Bonne réponse rare (peu l'ont trouvée) | En plus, une bulle de cœurs. |
| Podium, forme atteinte | Il sort de sa niche — une fois par quiz au plus, après l'expérience —, se pose en bas de l'écran, près du pouce : on peut le caresser. Puis il rentre. La niche garde son décor pendant qu'il est dehors. |
| Le premier passage du jour | Ses volets sont fermés, il dort ; ils s'ouvrent. Jamais de reproche pour un jour sans jouer. |

Et toujours : « Le laisser dormir » (les volets fermés, plus rien ne bouge), et
immobile si le téléphone demande moins de mouvement. Il ne parle pas.

## 3. Sa croissance : quatre formes

100, 300 puis 500 bonnes réponses données avec lui (`JUSTES_DES_FORMES`, tel
qu'aujourd'hui). En production, ça va vite : un joueur du troisième quartile
atteint 500 en deux semaines environ, le dixième le plus actif en une. Trois
des quatre compagnons achetés sont déjà à leur forme ultime. Il faut donc une
suite.

## 4. Sur la durée : sa niche s'embellit

Après la forme ultime, chaque palier ajoute un ornement à la niche, qui le
garde : la même niche, au même coin, un peu plus belle. **Recalés sur le rythme
mesuré en production** (lecture seule, le 18 octobre 2026 : 26 profils sur 23
jours, des bonnes réponses en solo par semaine — médiane 52, troisième quartile
244, neuvième décile 511, maximum 1 143) :

| Palier | Ornement | 3ᵉ quartile | 9ᵉ décile | Le plus actif |
|---|---|---|---|---|
| 1 500 | Amis pour la vie — une guirlande de petites lampes | ~6 semaines | ~3 semaines | ~9 jours |
| 4 000 | Complices — du lierre et des fleurs au rebord | ~4 mois | ~2 mois | ~3 semaines |
| 10 000 | Inséparables — l'arche dorée et son étoile | ~9 mois | ~5 mois | ~2 mois |
| 25 000 | Légende — un halo, et son ciel qui scintille | ~2 ans | ~1 an | ~5 mois |

Un petit échantillon, et les soirées n'y sont pas (leurs réponses ne sont pas
archivées par profil) : à remesurer quand la base aura grandi. Les paliers
appartiennent **à chaque compagnon** : c'est celui de la niche qui avance — une
raison de lui rester fidèle. Un palier atteint ne se perd jamais.

En route, deux buts de plus : les **métamorphoses**, déjà peintes pour le loup,
le chat et la tortue — la lumière que l'Éclat fait tomber, l'ombre que cent
mauvaises réponses font gagner —, à livrer.

## 5. Comment on l'a

- **En boutique** : le loup, le chat des lanternes, la tortue-île — 1 000
  confettis (tel qu'aujourd'hui).
- **Par un haut fait** : **Lumi, la luciole**, compagne de l'Expédition, ne
  s'achète pas. Le haut fait « Première traversée » : **finir une expédition**
  (le troisième gardien vaincu). Ni trop facile ni trop dur : le calibrage du
  dépôt (`calibrage-expedition.ts`, avec une équipée de deux) fait arriver au
  bout le joueur moyen une fois sur trois ou quatre, le fort deux fois sur
  trois — la cible du brief de l'Expédition. Aucune expédition n'est encore
  jouée en production : à vérifier dès qu'il y en aura. En boutique, elle se
  montre en silhouette, « à gagner en Expédition ».
- D'autres sur le même modèle, plus tard : un compagnon par mode, chacun son
  haut fait.

## 6. Et l'avatar

Chaque forme atteinte reste aussi **un avatar qu'on peut porter**, comme
aujourd'hui — son médaillon peint, son décor, son anneau. Ceux qui portent déjà
le leur ne perdent rien. C'est le compagnon de la niche qui grandit ; porter un
médaillon ne fait grandir personne.

**La niche est sa maison, l'avatar une autre affaire** (le 19 octobre 2026,
le propriétaire : « dans la boutique quand on fait porter, ça le met sur
notre avatar et dans la niche. Ça serait mieux que dans la niche ») :
l'adoption l'installe dans la niche sans le faire porter ; on le porte en le
choisissant, dans la loge (« Le porter en avatar » l'y essaie). Changer
d'avatar ne fait plus déménager personne : les niches jamais choisies se
sont figées une fois sur ce qu'elles montraient.

## 7. À l'écran commun

Seulement son arrivée, le podium et une métamorphose. Jamais pendant une
question, jamais dans une liste.

## 8. Ce qui ne change jamais

- Aucun avantage de jeu, nulle part (invariant 8) — l'expédition comprise.
- L'invité anonyme n'affiche rien.
- Il ne réagit qu'à la révélation.
- Une forme, un palier, un ornement gagnés ne se reprennent jamais.
- Jamais de culpabilité : il ne boude pas qu'on ne vienne pas.

## 9. Comment il bouge

Par `transform` et `opacity`, comme le reste de l'appli : ses humeurs peintes
échangées en place, ses gestes (sautiller, s'abattre, sortir). Plus tard, une
marionnette peinte (queue, oreilles, paupières) par la même chaîne. Pas de
vidéo générée : trop chère pour ce qu'elle apporte.

## 10. Ce qui reste à construire, dans l'ordre

1. ~~La niche dans l'application : sa place sur chaque page, sa fiche, son
   repli.~~ Faite le 18 octobre 2026 : `client/src/components/Niche.tsx`,
   sa place page par page dans `styles.css` (`body.avec-niche`), la colonne
   `profiles.niche` — l'adoption y installe, la boutique en change d'un
   toucher, et c'est le compagnon de la niche qui grandit (qui n'a jamais
   choisi garde celui qu'il porte) —, sa fiche (`GET /api/joueur/niche`).
   `server/scripts/rendu-niche.ts` la photographie sur vingt-quatre écrans :
   rien ne passe dessous, en 360 × 640 comme en 390 × 844.
2. ~~Les humeurs livrées (peintes pour les quatre) et les réactions à la
   révélation.~~ Faites le 19 octobre 2026 : les humeurs du loup, du chat et
   de la tortue — ravi, dépité, triomphe, pour chaque forme — livrées par la
   chaîne (`livrer-compagnons.ts`, depuis l'archive de leur dossier `app` :
   rien de repayé ; celles de Lumi partiront avec elle, au point 3) ; les
   réactions du § 2 dans la soirée, le quiz du jour, la campagne, les
   sentiers, les parcours et l'expédition (`client/src/niche.ts`,
   `shared/niche.ts`, `components/NicheReagit.tsx`). « Peu l'ont trouvée » :
   le quart au plus, à quatre réponses au moins — au quiz du jour, des
   joueurs du jour ; en campagne, une experte (`PART_RARE`). Une estimation
   n'est jamais fausse : parmi les plus proches — le serveur le dit à chacun,
   `parmiLesProches` —, elle le nourrit. `rendu-niche.ts` photographie chaque
   réaction dans une soirée jouée, et la sortie au podium.
   - Le même soir, **« Ma niche »**, sa gestion, au toucher de la niche (« il
     n'y a pas d'interface de gestion de compagnon quand on clique dessus ?
     Pouvoir choisir son compagnon, le customiser », le propriétaire) : son
     nom, que lui seul voit ; la forme qu'il montre, parmi celles qu'il a
     atteintes — une forme atteinte reprend la place — ; celui des siens qui
     y vit, d'un toucher ; « Le porter en avatar ». Ce qui le
     « customiserait » davantage attend sa peinture : les ornements de la
     niche (point 4), les métamorphoses (point 5).
3. Le haut fait « Première traversée » et la livraison de Lumi
   (`livrer-compagnons.ts luciole`).
4. Les paliers de la niche, lus des journaux.
5. Les métamorphoses livrées.
6. Le réveil et « Le laisser dormir ».
