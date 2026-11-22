# Les Divins habillés : la maquette

Le 22 novembre 2026, les dix-huit bijoux peints le matin même. Le
propriétaire : « Question par rapport aux Divins qu'on avait acté. C'est pas
un peu dommage de ne pas pouvoir mettre les finitions / bordures etc.
dessus ? » — puis, devant les quatre premières planches : « Quelles sont tes
préconisations pour que ça soit le plus joli possible, admettons qu'on peut
faire des changements ou même faire des choses nouvelles et spécifiques pour
les Divins ? ».

**Le choix**, le même jour, devant les planches 5 et 6 : « Met en place tes
recommandations ». Elles sont dans `client/src/components/Divin.tsx`,
`Avatar.tsx` et `styles.css` depuis le commit suivant, la règle dans
`shared/profil.ts` (`finitionSur`).

Ce dossier reste la maquette telle qu'elle a été montrée. `planche.ts`
recomposait à la main ce qu'`Avatar` refusait alors : il ne se rejoue plus
qu'au commit d'avant la mise en œuvre (`8cac370`). La planche d'aujourd'hui,
rendue par le vrai `Avatar` : `server/scripts/planche-bordures.ts`
(`planche-divins-habilles.png`).

## Ce que la maquette a montré

Rendue avec les vrais composants et la vraie feuille de style.

1. **La bordure de ligue lui va** (`planche-1-bordures.jpg`) : le bijou tient
   dans le fil pour les dix-huit, ce qui dépasse passe par-dessus comme le
   débord d'un légendaire. Mais avec la bordure simple, il ressemble à
   n'importe quel médaillon bordé.
2. **La lumière d'une finition, du 15 au 50, à la place de ses rayons**
   (`planche-2-lumieres.jpg`) : ajoutée à eux, elle se brouille (la rangée
   « En grand »). **Les métaux, non** — l'Argent ne se voit pas, l'Or trace un
   cercle fin autour d'un bijou qui n'est pas rond, le Holo fait une tache
   (la dernière rangée).
3. **Dans un classement** (`planche-3-ensemble.jpg`), il était le plus petit
   avatar de la liste, sans rien autour : la bordure seule lui donne sa place.
4. **En Ivoire** (`planche-4-ivoire.jpg`), ses rayons pâles se voient à peine.

## Ce qui a été retenu

Les quatre gestes propres aux Divins (`planche-5-pistes.jpg`,
`planche-6-pistes-ivoire.jpg`) :

1. **La gloire** : sous une bordure, ses rayons passent derrière elle et en
   sortent entre les feuilles, à sa couleur. À côté d'un Phénix qui porte la
   même bordure, c'est ce qui dit encore « Divin ». Sans bordure, il reste
   comme avant.
2. **Le bijou déborde**, à 1,12 fois sa taille : à sa taille il est posé dans
   le fil comme dans une cage ; à 1,25, le Panthéon cache sa bordure.
3. **Les métaux teintent sa lumière** au lieu de tracer un cercle : ses
   rayons argentés, dorés, ou en arc-en-ciel.
4. **Les lumières du 15 au 50 prennent la place de sa gloire**, si son joueur
   en a épinglé une ; en « Auto », il garde la sienne.

Dans une liste, rien ne bouge : la bordure et le bijou. Laissés de côté :
l'Éclat et les matières (un filtre de couleur sur un bijou peint lui ferait
perdre ses émaux), et une bordure réservée aux Divins (son métal dit la
ligue).

## Ce que la mise en œuvre a ajouté

- **Sur l'Ivoire**, sa lumière prend une version sombre, tirée vers le métal
  de son anneau : la gloire du Séraphin, de Thot ou du Panthéon s'y lit.
- **Là où la bordure est le sujet** — ses pastilles dans la loge, ses cases
  dans les albums —, elle se montre sans rayons : six soleils côte à côte, on
  ne distinguait plus le bronze de l'argent.
- **Dans la loge**, la pastille « Auto » dit sous un Divin que c'est sa
  propre lumière, à sa teinte dorée, sans phrase de plus.
