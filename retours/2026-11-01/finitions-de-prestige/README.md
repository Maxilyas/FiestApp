# Les finitions de prestige — la planche (1er novembre 2026)

« J'aimerais récompenser les joueurs qui sont maintenant en prod déjà bientôt
niveau 30 pour les plus actifs. Aujourd'hui la finition s'arrête au niveau 25.
As-tu des idées supplémentaires pour des niveaux supérieurs ? Je rajoute des
finitions ? Autre chose ? » (le propriétaire). Puis : « Montre-moi des
finitions différentes et on valide avant de coder. »

Après la Constellation (25), plus aucune finition ne s'ouvrait, et le dernier
emoji de collection tombait au 17. Le niveau 30 demande 50 460 XP : passer
du 25 au 30 demande à peu près autant d'expérience que du 1 au 17.

## La planche

`planche.html` : douze candidates, dessinées comme les lumières de
`client/src/components/Lumiere.tsx` (des calques qui ne bougent que par
`rotate`, `scale`, `translate` et `opacity`), chacune autour de l'emoji,
autour d'un légendaire porté (le Renard, son cercle à la matière de la
finition), puis figée et resserrée dans une ligne de classement. Les trois
d'avant (Prisme, Aurore, Constellation) en tête, pour juger la marche.
Un bouton passe la salle du Velours à l'Ivoire.

- Une première série : Brasier, Séraphin, Singularité, Orage, Vitrail, Arcane.
- « Je veux bien 6 autres propositions […] N'hésite pas à être créatif et à
  changer complètement de thème » : Disco, Néon, Ensō, Abysses, Origami,
  Arcade.

Elle se rouvre telle quelle dans un navigateur : c'est le fragment publié,
sans en-tête, la médaille du Renard comprise.

## La décision

« Mes finitions préférées, de la meilleure à la moins bonne : les Abysses,
Orage, Séraphin / Disco (j'ai un doute sur comment tout va s'agencer avec
celui-là mais j'aime beaucoup l'idée), Trou noir. » Puis, pour l'ordre des
niveaux, au même pas de cinq que les finitions d'avant : sa préférée au 30,
« les plus actifs l'ont dans quelques soirées ».

| Niveau | 30 | 35 | 40 | 45 | 50 |
|---|---|---|---|---|---|
| Finition | Abysses | Orage | Envol | Disco | Singularité |
| Sa lumière | les Méduses | la Foudre | les Ailes | la Boule à facettes | le Disque |

Deux noms de la planche ont changé, pas leur dessin : « Le Séraphin » est un
Divin, et « Le Trou noir » le légendaire du Cabinet entier — Envol et
Singularité ne se prennent pour aucun des deux.

Le doute sur Disco s'est regardé dans l'application : sa boule se pose
derrière l'emoji ; autour d'un médaillon, son cercle de miroirs et le bord de
la boule ; sous une bordure de ligue, la boule s'efface et la bordure en prend
le miroir, ses reflets restent ; dans une liste, figée et resserrée
(`server/scripts/planche-bordures.ts`).

Entre les finitions, seize emojis de collection, chaque dizaine sur le thème
de celle qui l'ouvre : 🐬 🦞 🐡 🦀 après les Abysses, 🐆 🦏 🦍 🌈 après
l'Orage, 🪁 🪂 🧝 🧙 après l'Envol, 🎷 🎻 🪕 🛸 après Disco. Et dès le 30, la
pastille de niveau prend la pierre de sa dizaine (`shared/pierres.ts`).
