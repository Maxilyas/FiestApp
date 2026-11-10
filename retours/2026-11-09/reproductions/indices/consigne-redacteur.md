# Écrire les indices du Filet — la consigne du rédacteur

Le Filet est un jeu de FiestApp, un quiz français : une question dont la réponse est une **année** ou une
**grandeur** (une hauteur, une durée, un nombre…). Le joueur voit quatre tranches côte à côte — quatre époques de
25 ans (50 avant 1800, un siècle avant 1500), ou quatre ordres de grandeur bornés par 1, 3, 10, 30, 100, 300… — et
choisit celle de la réponse (★), puis vise la valeur dans cette tranche (★★ et ★★★ s'il tombe tout près).

S'il sèche, il peut payer une étoile pour **un indice** : une phrase qui le mène à **la bonne tranche, toute la
tranche**, et jamais à la valeur. Tu écris ces indices. Les joueurs sont des Français de tous âges, une culture
d'école et de télévision, pas des spécialistes.

## Ce que tu reçois

Un fichier JSON : une liste de questions, chacune avec `id`, `categorie`, `question`, `reponse` (telle que la base
l'écrit), `valeur`, `unite` (« année » pour une année), `tranche` (la tranche de la réponse dans le jeu, par exemple
« 1950–1974 » ou « 1000–3000 » ; « 3000–10000 ou 10000–30000 » quand la réponse tombe pile sur la borne : les deux
sont bonnes) et `anecdote` (du contexte, à ne pas recopier).

## Ce que tu écris

Pour chaque question, un objet :

```json
{ "id": "…", "indice": "…", "repere": "…" }
```

- **`indice`** — une phrase de **100 signes au plus**, en français, sans point final obligatoire, qui mène à la
  tranche :
  - **une année** : son époque ou son contexte, par des repères que le public français connaît — « Au temps du disco,
    quand les premières consoles entrent dans les salons », « Sous le Second Empire, quand Haussmann perce Paris »,
    « Entre la crise de 1929 et la fin des années quarante » ;
  - **une grandeur** : un encadrement large par des choses connues — « Nettement plus haute que l'Arc de triomphe,
    mais bien moins que la tour Eiffel », « Plus qu'un match de football, moins qu'une journée de travail ».
  - **La cible est toute la tranche, pas plus étroite** : un indice qui recopie la tranche (« plus haut que la tour
    Eiffel, mais loin d'un kilomètre » pour 300–1000) est bon. Un indice plus étroit que la tranche donne la valeur :
    c'est une faute.
  - **Contre une frontière** — la réponse à quelques années ou quelques pour cent d'une borne de sa tranche (1946 dans
    1925–1949, 330 dans 300–1000) — un indice tenu dans la tranche y serait presque la valeur (« juste après la guerre »
    pour 1946) : il peut alors enjamber un peu la frontière, **mais jamais pencher du mauvais côté**. Le milieu de ce
    qu'il désigne doit rester dans la tranche de la réponse. « Dans les vingt ans qui suivent la Libération » pour 1946
    mène à 1944–1964, à cheval sur 1925–1949 et 1950–1974, et penche du mauvais côté : un joueur y a perdu son cœur.
    Mieux : « Entre la crise de 1929 et la fin des années quarante ».
- **`repere`** — **40 signes au plus**, le fait de la question nommé sans son nombre, comme une étiquette de frise :
  « Les Fleurs du mal paraissent », « La tour Eiffel », « Brasília devient capitale ». Il servira quand le joueur aura
  su placer la réponse : elle reviendra comme son repère.

## Le piège le plus fréquent : l'indice trop serré

Le joueur qui a pris l'indice vise **le milieu** de ce qu'il désigne. Si ton encadrement est plus étroit que la tranche, son
milieu tombe souvent tout près de la réponse, et l'indice paie deux ou trois étoiles sans rien savoir. Les juges l'ont trouvé
dans un indice sur cinq de la maquette :
- « Plus large qu'un lit d'une place (90 cm), moins qu'un très grand lit (180 cm) » pour 140 cm, tranche 100–300 : se lit
  90–180, viser 135, c'est trois étoiles. Mieux : « Plus large qu'une porte, bien moins qu'une voiture n'est longue ».
- « Dans le dernier quart du siècle de Voltaire » pour 1791, tranche 1750–1799 : une époque de cinquante ans se couvre
  entière (« Dans la seconde moitié du XVIIIe siècle »), pas son dernier quart.
- « Au-delà de trois mille mètres, mais loin derrière l'Everest » pour 4 478 m, tranche 3000–10000 : se lit 3 000–6 000,
  milieu 4 500. Mieux : « Plus de trois mille mètres, et pourtant moins haut que l'Everest ».

Le plus sûr : un encadrement qui recopie la tranche entière, par des repères ou même par ses bornes (« plus de cent, moins de
trois cents »). Plus serré que la tranche, il faut que son milieu reste loin de la réponse — dans le doute, élargis.

## Ce qu'un indice ne fait jamais

- **Aucun nombre à moins de 15 ans de l'année de la réponse**, ni à moins de 20 % d'une grandeur — en chiffres
  **ni en toutes lettres** (« vingt ans », « quarante », « quatre-vingts »). Les autres nombres sont permis s'ils aident
  (« la crise de 1929 » pour 1946), mais jamais un calcul.
- **Pas de calcul** : « fais l'addition », « compte les semaines », « fois cent, puis le quart » donnent la valeur.
- **Pas d'élimination** qui laisse une seule réponse (« une puissance de deux entre seize et cent », « le seul billet
  entre 300 et 1 000 € »).
- **Pas un fait daté de la même année** (« l'année du premier Star Wars » pour l'Atari 2600, 1977) : c'est la valeur.
- **Rien de faux.** Un repère douteux, laisse-le : un autre, plus connu, fera l'affaire. Vérifie tes dates.
- **Pas le sujet de la question redit** : l'indice parle d'autre chose, qui situe.

## Quand il n'y a pas d'indice honnête

Si l'énoncé donne déjà l'époque — « En quelle année un sous-marin allemand coule-t-il le Lusitania ? » (la Grande
Guerre est dans la question), la trêve de Noël dans les tranchées —, tout indice d'époque serait la réponse. Écris
alors `"indice": null` et ajoute `"pourquoi": "…"` (une phrase). Le jeu ne proposera que l'autre aide. Ne le fais que
quand c'est vrai : la plupart des questions ont un indice honnête.

## Avant de rendre

Relis chaque indice comme un joueur qui ne sait rien : te mène-t-il à la bonne tranche, et seulement à elle ? Si tu
peux deviner la valeur à quelques années près, il en dit trop : élargis-le. Compte les signes (100 au plus). Vérifie
qu'aucun nombre n'est trop près de la réponse, ni écrit en lettres.

Écris le résultat — un tableau JSON, un objet par question, **dans l'ordre du fichier d'entrée, aucune oubliée** —
dans le fichier de sortie qu'on t'indique. Ne modifie aucun autre fichier.
