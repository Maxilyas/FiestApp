# Les Deux Bannières — deux factions en un seul thème

Le 19 novembre 2026, le lendemain du podium peint
(`retours/2026-11-19/podium-peint/`).

## La demande

> J'aimerais que tu réalises un nouveau thème stp sur World Of Warcraft,
> c'est mon jeu préféré et je veux une attention toute particulière dessus
> quitte à que ça coûte plus cher et plus de temps.

Un thème ne recopie ni le nom, ni les blasons, ni les races, ni les
personnages d'un jeu existant : ce sont des marques et des œuvres protégées.
Le thème garde l'esprit — deux factions rivales d'un monde de légende —, tout
le reste est inventé. Le propriétaire a choisi :

> Deux factions en un seul thème. En boutique. […] D'accord pour la maquette
> d'abord

La maquette (peinte à part, 1,29 $) : deux décors, une marche du podium, et
son personnage en avatar, posés sur les vrais écrans. Puis :

> Je n'aime pas trop l'avatar. J'aimerais qu'on abandonne l'idée d'un avatar,
> par contre le thème je valide. Je veux bien l'option choisir son camp.
> […] La frontière Ok

Les deux emblèmes qu'il a ensuite proposés étaient ceux des deux factions du
jeu : six emblèmes originaux dans le même esprit ont été peints
(`maquette/1-six-emblemes.jpg`, 0,84 $), il a choisi le sanglier (B2) et le
lion dressé (A1), et les noms « Les Clans de la Braise » et « Le Royaume
d'Azur » — un thème « Braises » existe déjà en boutique.

## Le code

- **Un thème légendaire, en boutique**, 1 000 confettis
  (`shared/themes.ts`, `bannieres`), et **deux camps** (`Theme.camps`) : on
  en porte un, les Clans d'office (`profiles.camp`, `PUT /api/joueur/moi`
  `camp`). Il teinte toutes ses pages — la braise et l'orange des braseros,
  ou la nuit bleue et l'or (`client/src/themes/bannieres.css`,
  `[data-camp='royaume']`) — et **sa plaque le dit aux autres** : une plaque
  par camp, ses couleurs, son emblème, sa marche du podium
  (`le-code/2-les-deux-camps.jpg`).
- **Le camp s'essaie dans la loge**, pièce « Thème » : deux boutons au-dessus
  des thèmes, chacun son emblème — un toucher habille la page, « Porter » le
  garde (`ChoixDuCamp`, `Boutique.tsx`).
- **La frontière** de la maquette, repeinte aux deux emblèmes choisis par la
  chaîne des décors (`server/scripts/anime/decors.ts`, le groupe
  `bannieres` ; `le-code/1-la-frontiere-repeinte.jpg`), sous un voile peint
  sur elle, et des braises qui montent — ou une poussière d'or, chez le
  Royaume. Une marche par camp, peinte sur le croquis du podium ; celle du
  Royaume a été repeinte deux fois (une boîte en perspective, puis les
  pointillés du croquis peints sur sa pierre).
- **Les emblèmes des plaques** sont la hure du sanglier et le lion dressé,
  tracés de leurs emblèmes peints (`server/scripts/emblemes-des-plaques.ts`).
- Ses contrastes mesurés sur ce qui est peint derrière chaque ligne, pour
  chaque camp (`server/scripts/rendu-themes.ts bannieres --contraste`,
  `CAMP=royaume`) : sous le seuil, seule « La campagne solo », comme sous le
  Sommet (`le-code/3-les-ecrans.jpg`).

Tout le thème a coûté 3,0 $ de peintures, maquette comprise. `maquette/`
garde l'esquisse de la frontière et les deux emblèmes choisis : la chaîne en
repart sans rien repayer.
