# La question au centre — le brief de l'étape 2, le 19 octobre 2026

Les retours d'un testeur de l'Expédition, le 19 octobre 2026 : « Les cartes à
utiliser avant les combats je trouve c'est trop aléatoire. Tu sais jamais
quand trop l'utiliser. Ça fait pas trop sens de jouer une carte avant de voir
une question. Et sur les vrai ou faux ce serait bien que quand la réponse est
fausse ça t'affiche c'était quoi la bonne réponse […]. Aussi je trouve les
cartes qui te donnent des PV/Bouclier/énergie je suis pas archi fan, ça sort
un peu du truc de quizz je trouve, j'ai pas trop envie de réfléchir à mes pv.
Ça manque un peu de cartes pour donner des indices, reroll la question. Ça
pourrait être des bails genre ça te donne des aides pour la réponse mais
genre de différentes manières. Soit un indice, soit ça te donne des lettres
présentes dans la réponse […] comme un pendu. Je pense ça donnerait plus de
variété dans la manière de répondre et ce serait plus intéressant que le
système de combat je trouve qui rajoute de la lourdeur au gameplay qui est
pas nécessaire. À mon sens faut exploiter davantage le système de question
que le système de combat. Autrement je trouve ça trop bien. Le système de
choix du thème c'est trop bien. » Et ses idées de questions : un tableau à
reconnaître d'un détail, un film d'une image, des événements à remettre dans
l'ordre, l'origine d'un plat, « 4 images 1 mot » — « des trucs bonus sur le
chemin qui te filent des récompenses cool ».

Le plan qui en est sorti, « La question au centre », en six étapes, chacune
sa PR, validé par le propriétaire le même jour — « 1. Ta recommandation
2. Ta recommandation 3. Retire à partir de l'étape 2 4. ok. Go » :

1. **Le vrai ou faux dit sa bonne réponse** — fait : la révélation et « Mes
   réponses » disent « « Eschyle » : faux — c'était Sophocle ».
2. **La question d'abord** — ce brief.
3. **Les coups de pouce et les lettres** — des aides de toutes sortes, tirées
   de ce que la base sait déjà, et une forme où l'on compose la réponse avec
   ses lettres.
4. **Les curiosités** — des escales bonus, d'abord « D'où vient ce plat ? »
   et le rébus en emojis.
5. **La frise, puis le détail** — des événements dans l'ordre, un tableau qui
   se dévoile.
6. **Les familles, en façons de répondre** — après une semaine de jeu.

Ce brief fixe l'étape 2 avant la première ligne de code : la règle, ce qui
part, ce qui reste, l'écran, le calibrage, les invariants. **Il attend sa
validation** : rien n'en est dans le code. Ses quatre questions sont à la
fin (« Ce que je te demande de valider »).

## Ce qui a été décidé le 19 octobre 2026

1. **Le combat** : les quatre règles recommandées — la question avant toute
   carte, des cartes qui aident à répondre, une main qu'on garde sans
   énergie, l'adversaire compté en bonnes réponses et l'erreur à prix fixe.
   La barre de courage reste — « J'aime bien le côté barre de courage et
   barre de vie. À garder », la revue du 18 octobre —, mais aucune carte n'y
   touche.
2. **Le pari** reste, et c'est le seul choix avant la question : un pari sur
   soi, pas une carte jouée à l'aveugle. Le 18 octobre, le propriétaire
   aimait « envoyer des cartes avant la question » ; ce qui se jouait là sans
   savoir, c'est ce que le testeur trouve aléatoire — le pari, lui, se décide
   sur ce qu'on sait de soi.
3. **Le Sophiste et le Téméraire** quittent les expéditions neuves dès cette
   étape : leur doute et leur courage payé n'ont plus de prise sans les
   chiffres du combat.
4. **L'étape 1 d'abord**, puis ce brief, validé avant d'y toucher.

## En bref

1. **La version 10 du départ, en préproduction d'abord** — un drapeau, comme
   les rencontres le 18 octobre : la production garde la 9 jusqu'à ce que le
   propriétaire la passe, et toute expédition en route finit à ses règles.
2. **La question d'abord.** Une rencontre s'ouvre sur sa question. Avant
   elle, seulement le pari, dès le niveau 2 — rien d'autre ne se joue à
   l'aveugle.
3. **L'adversaire se compte en bonnes réponses** : deux pour une escale,
   trois pour une élite, quatre, trois et trois pour les gardiens des trois
   actes — ceux de l'expédition d'avant les rencontres. Une question dure à
   répondre en vaut deux : six choix, un dévoilement trouvé dans la première
   moitié de ses mots.
4. **Une erreur coûte l'attaque de l'adversaire, toujours la même.** La barre
   de courage reste, à 50 ; aucune carte ne la soigne ni ne la protège : elle
   se regagne sur le plan — la source, le campement, l'échoppe, la fiole.
5. **Des cartes qui aident à répondre**, jouées la question sous les yeux :
   effacer, souffler, changer de question ou de forme, un second essai, et
   l'assurance de qui sait (« si tu as juste, un cran de plus »). Plus
   d'énergie, de bouclier, de soin, de pioche ni de doute.
6. **La main se garde** : une carte y vient après chaque question, quatre au
   plus ; une carte se joue par question ; jouée, elle part à la défausse, qui
   ne revient au paquet qu'à l'acte suivant. Chaque carte sert une fois par
   acte, et le gardien attend au bout : « quand l'utiliser ? » a sa réponse.
7. **Cinq styles** : le Devin, le Métamorphe et l'Érudit au niveau 1, le
   Flambeur au 2, l'Élan au 3. Le Rempart, dont toutes les cartes sont des
   boucliers ou des soins, attend l'étape 6 ; le Sophiste et le Téméraire
   sont retirés.

## La règle de la version 10

### Un tour

- **Au niveau 1, sans le pari** : la rencontre s'ouvre sur sa question.
  L'adversaire en haut, en une ligne — son nom, ses crans (●●○), son attaque
  (⚔ 6) —, la question, ses réponses, et la main dessous.
- **Dès le niveau 2, avec le pari** (la règle `pari` du codex) : d'abord
  l'annonce — l'adversaire, la question qu'il pose (sa catégorie, sa marche,
  sa forme, « une année »), ta chance — et le pari, 0, 10, 20 ou 40 écus,
  avec les cartes du pari (Doubler la mise, Assurance, Banco, Pactole, Le
  trésor), qui ne se jouent que là. « Voir la question » l'envoie. Ni main ni
  tuiles : l'annonce ne demande que le pari.
- **La question sous les yeux** : une carte de la main se joue, au plus. Elle
  se lève, dit ce qu'elle fera, « Jouer » ou pourquoi pas maintenant ; ce
  qu'elle fait se voit sur la question (réponses barrées, l'indice, deux
  réponses à choisir). Puis la réponse.
- **Le verdict** : juste, l'adversaire perd un cran — deux sur une question
  dure, plus ce que la carte y ajoute ; faux, l'attaque. Puis une carte vient
  dans la main, s'il y a de la place, et la question suivante — ou
  l'adversaire tombe, et sa récompense.

### L'adversaire

| | Acte 1 | Acte 2 | Acte 3 |
|---|---|---|---|
| Ses crans : une escale à question | 2 | 2 | 2 |
| une élite (une marche au-dessus) | 3 | 3 | 3 |
| le gardien | 4 | 3 | 3 |
| Son attaque : une escale · une élite · le gardien | 5 · 7 · 8 | 6 · 8 · 9 | 7 · 9 · 10 |

- **Un cran par bonne réponse**, deux sur une question dure : **six choix**,
  et un **dévoilement** trouvé avant la moitié de ses mots — la moitié se lit
  à l'heure du serveur, comme le mot où la réponse arrive (invariant 6). Un
  **vrai ou faux** vaut un cran, comme quatre choix : il paie deux fois moins
  d'écus, comme aujourd'hui. Les formes des étapes 3 et 5 — les lettres, la
  frise, le détail — vaudront deux crans.
- **L'attaque ne grandit plus** : celle d'aujourd'hui sans ses +2 par
  question — et sans bouclier pour la parer. Ce qui coûte, dans une rencontre
  qui traîne, ce sont ses erreurs, et la main qui s'y vide.
- Les crans d'aujourd'hui en sont la traduction : à la marche de chaque acte,
  une Concentration jouée, deux bonnes réponses faisaient tomber une escale,
  deux ou trois une élite, trois ou quatre un gardien.

### Le courage

- **50 au départ et au plus**, comme aujourd'hui. Il se perd sur une erreur
  (l'attaque) et sur un piège (8) ; il se regagne sur le plan : une source
  retrouvée (12), un campement (15, à la place de retirer ou d'améliorer une
  carte), l'échoppe (15, pour 40 écus), la fiole de courage (10). À zéro,
  l'expédition s'arrête.
- **Aucune carte n'y touche** : ni soin, ni bouclier, ni courage payé. Ce qui
  sauve d'une erreur — Sursis, Double chance, La mue, Passe-muraille — se dit
  de l'erreur (« ton erreur ne te coûte rien »), jamais en points.

### La main

- **Le paquet, la main, la défausse — sans énergie.** À l'ouverture de chaque
  acte, la main se remplit de trois cartes ; puis une carte y vient après
  chaque question, tant qu'elle en tient moins de quatre (cinq sous Trois
  têtes). Ce qu'on ne joue pas se garde, d'une question et d'une rencontre à
  l'autre.
- **Une carte par question**, la question sous les yeux — plus, à l'annonce,
  celles du pari, et sur le plan celles de route.
- **Jouée, elle part à la défausse**, qui revient au paquet à l'acte suivant :
  chaque carte sert une fois par acte. Plus de main défaussée à chaque
  question, plus de cartes épuisées : c'était le cycle de Slay the Spire, qui
  poussait à tout jouer à chaque tour.
- **Un pouvoir** (« pour toute la rencontre ») se joue de même, la question
  vue, et agit jusqu'à la fin de la rencontre ; puis il rejoint la défausse.
- **Le paquet de départ** : Coup d'œil ×3, Concentration ×3, Échange ×2,
  Double chance, Sursis — quatre façons de s'aider : effacer quand on ne sait
  pas, frapper plus fort quand on sait, changer de question, se donner un
  second essai. Double chance et Sursis, que le codex n'ouvrait qu'aux
  niveaux 2 et 6, y entrent : ce sont les seconds essais du paquet. Le style
  en remplace deux, chacune par une carte de même usage (plus bas).
- **Une carte par question, et pourtant des combos** : ce qui agit plus tard —
  un pouvoir, Augure, qui efface d'avance à la question suivante —
  s'additionne à la carte de la question d'après. Lucidité, qui frappe plus
  fort sur une question où une réponse est effacée, vit de ceux-là.

### Le pari

Inchangé : 0, 10, 20 ou 40 écus, ouvert au niveau 2 ; juste, il rapporte la
moitié de ce qu'il engage, faux, il est perdu ; on part avec 25 écus. Il se
choisit à l'annonce, avant de voir la question, avec ses cartes : une carte qui
change le pari jouée la question vue ferait parier à coup sûr. Une mise n'aide
pas : la réponse reste nue.

### Les styles

Une famille au départ, ses deux cartes dans le paquet à la place de deux
cartes de base de même usage, une des siennes dans chaque offre — comme
aujourd'hui :

| Le style | Ce qu'il fait | Ses deux cartes de départ | À la place de | Niveau |
|---|---|---|---|---|
| Le Devin | Il lit les signes : il efface, il souffle | Augure, Présage | deux Coups d'œil | 1 |
| L'Érudit | Il joue sa catégorie fétiche | Plume, Savoir-faire | deux Concentrations | 1 |
| Le Métamorphe | Il change la question | Corser, Simplifier | une Concentration, un Coup d'œil | 1 (le 4 aujourd'hui) |
| Le Flambeur | Il parie sur lui | Pourboire, Cagnotte | deux Concentrations | 2 |
| L'Élan | Il ne s'arrête plus | Échauffement, Lancée | deux Concentrations | 3 |

Le Métamorphe descend au niveau 1 à la place du Rempart : trois styles dès le
premier départ, comme aujourd'hui. Aux niveaux 4 à 10, l'échelle n'ouvre plus
que des cartes, jusqu'aux styles de l'étape 6.

### Ce qui ne change pas

Le plan et le choix du thème — les catégories, les mélanges, les thèmes
pointus, le passeport —, les sortes d'escales, les écus et l'échoppe, les
coffres, l'inconnu, les talismans, la catégorie fétiche, les légendaires
gardés au bout, l'invité du jour qui prête sa carte, la renommée et les
niveaux d'explorateur, les exploits, les dos de cartes, les cartes
améliorées — au campement, à l'échoppe, trouvées telles —, et tout ce que
l'expédition paie hors d'elle.

### Ce qui change autour

- **L'Ascension**, ses cinq crans retraduits : 1, les élites et les gardiens
  demandent une bonne réponse de plus ; 2, les adversaires attaquent de 3 de
  plus (inchangé) ; 3, le campement et la source rendent moitié moins
  (inchangé) ; 4, ta main tient une carte de moins (l'énergie de moins
  d'aujourd'hui) ; 5, les gardiens en demandent encore une de plus.
- **Les fioles** : celle de courage et celle de clairvoyance restent ; celle
  d'énergie part avec l'énergie.
- **Les exploits** : inchangés. Génie — une élite tombée d'une seule réponse —
  reste possible : une élite à six choix et une Concentration, ou Polymorphe.
- **Le codex** : il montre les cartes de la version 10, 62 sur 104 ; une
  expédition d'avant montre les siennes, à leurs chiffres d'alors.

## Les cartes dans la version 10

Soixante-deux cartes, dont les vingt-trois des légendaires ; quarante-deux
quittent les expéditions neuves. Elles restent dans le code : une expédition
partie avant les tire et les joue jusqu'au bout, et leurs peintures restent
servies.

**Gardées telles quelles** — elles aidaient déjà à répondre : Coup d'œil,
Échange, Arrêt sur image, Le détour, Double chance, Sursis, Tout ou rien ;
Présage, Voyance, Vision ; et parmi les légendaires, La boucle
(dite en erreur : « retrouvée, elle ne t'a rien coûté »), Sagesse, Énigme,
Prédiction, Deux visages, La mue, Commandement, Le raccourci, Il connaît la
maison, Le feu d'artifice, La lanterne, Une boule pour chacun,
Passe-muraille, L'écholocation.

**Traduites en crans** — elles frappaient en points, elles comptent en
crans, la question vue :

| La carte | Aujourd'hui | En version 10 |
|---|---|---|
| Concentration | +4 si juste, avant la question | Si tu as juste, l'adversaire perd un cran de plus |
| Quitte ou double (maudite) | Le double, le pari triple ; faux, l'attaque double | Si tu as juste, le double de crans ; faux, l'attaque double — le pari n'y est plus |
| Plume | +2, +6 sur la fétiche | Un cran de plus si juste, sur ta catégorie fétiche |
| Savoir-faire | +4, +7 hors d'une facile | Un cran de plus si juste, hors d'une facile |
| Mémoire | +3 et une carte | Un cran de plus si juste, et une carte dans ta main |
| Bibliothèque (pouvoir) | +1, +3 sur la fétiche | Toute la rencontre : sur ta fétiche, chaque bonne réponse vaut un cran de plus |
| Exposé | La question vaut double | Le double de crans si juste |
| Encyclopédie (pouvoir) | +3 par bonne réponse déjà donnée | Toute la rencontre : à partir de ta deuxième bonne réponse, chacune vaut un cran de plus |
| Génie | +8, +14 sur la fétiche | Si tu as juste, un cran de plus — deux sur ta fétiche |
| Pourboire, Cagnotte | Des écus si juste — et +4 pour Cagnotte | Des écus si juste |
| Rafle | +14 et 10 écus | Un cran et 10 écus de plus si juste |
| Doubler la mise, Assurance | Le pari double ; rendu si faux | Inchangées, jouées à l'annonce |
| Banco | Le pari frappe | À l'annonce : si ton pari gagne, un cran de plus |
| Pactole (pouvoir) | Le gain du pari frappe | À l'annonce, toute la rencontre : chaque pari gagné, un cran de plus |
| Le trésor (pouvoir) | Les paris gagnés triplent | Inchangé, joué à l'annonce |
| Corser | Six choix, ×1,5 | Six choix : deux crans |
| Simplifier | Vrai ou faux, moitié moins, et bouclier 3 | La question passe en vrai ou faux |
| Polymorphe | Six choix, ×2 | Six choix : trois crans |
| Volte-face | Une autre question, +3 | Une autre question — un cran de plus si juste |
| Prisme (pouvoir) | +2 par bonne réponse, +6 à six choix | Toute la rencontre : à six choix, un cran de plus |
| Échauffement | +2, la série +1 | Ta série compte une bonne réponse de plus ; si juste, un cran de plus |
| Lancée | +2 par bonne réponse de la série | Un cran de plus si juste, deux à trois d'affilée ou plus |
| Rythme (pouvoir) | +1 par bonne réponse de la série | Toute la rencontre : dès la troisième d'affilée, chaque bonne réponse vaut un cran de plus |
| Inarrêtable (pouvoir) | La série tient après une erreur | Inchangée |
| Augure | Efface une mauvaise réponse avant que tu voies la question | À la question suivante, une mauvaise réponse est effacée d'avance |
| Lucidité | +2, +5 si une réponse est effacée | Un cran de plus si juste, quand une réponse est effacée |
| Troisième œil (pouvoir) | Chaque indice +3 si juste | Toute la rencontre : chaque indice joué, un cran de plus si juste |
| Révélation | Reste deux réponses, +4 | Reste deux réponses — un cran de plus si juste |
| Renaissance (le Phénix) | À zéro de courage, il renaît à 15 | Une fois par expédition : l'erreur qui la finirait ne te coûte rien |
| Peau de feu (la Salamandre) | Bouclier 8 | Ton erreur ne te coûte rien ; ta bonne réponse suivante vaut un cran de plus |
| L'aube (le Scarabée) | Du courage quand l'adversaire tombe | Toute la rencontre : chaque bonne réponse vaut un cran de plus, jusqu'à ta première erreur |
| Le réveil (le Coq) | +2 d'énergie | Une carte de ta défausse revient dans ta main |
| L'élan (le Tigre) | Trois d'affilée : deux cartes et de l'énergie | Toute la rencontre : à chaque série de trois, une carte dans ta main |
| Trois têtes (la Chimère) | Deux cartes de plus par question | Toute la rencontre : ta main tient cinq cartes, et deux viennent à chaque question |
| Remonter des abysses (le Kraken, maudite) | Paie du courage, en rend sous 20 | Toute la rencontre : chaque bonne réponse vaut un cran de plus — mais chaque erreur coûte le double |
| L'horizon (le Trou noir, maudite) | Rend le courage de l'erreur ; la récompense suivante vide | Juste après une erreur : elle est effacée ; la récompense suivante est vide |

**Retirées des expéditions neuves** — l'énergie, le bouclier, le soin, la
pioche, le doute, le courage payé, ou le double d'une autre :

- **Les neutres** : Prudence, La pioche, Évidence (Concentration fait la même
  chose, la question vue), Méditation, Sang-froid, Panacée, Maîtrise,
  Surmenage.
- **L'Érudit** : Leçon. **Le Flambeur** : Fortune. **Le Métamorphe** :
  Miroir (Simplifier fait la même chose), Caméléon, Métamorphose. **L'Élan** :
  Foulée, Accélération, Sprint, Vent arrière. **Le Devin** : Astrolabe.
- **Le Rempart**, ses huit cartes : Parade, Muraille, Pansement,
  Contre-attaque, Cuirasse, Second souffle, Bastion, Représailles — le style
  revient à l'étape 6, en « seconde chance ».
- **Le Sophiste et le Téméraire**, leurs seize cartes.

Les cartes améliorées suivent : améliorée, une carte de la version 10 fait la
même chose en mieux — un cran de plus, une carte de plus, ou elle revient dans
la main au lieu de la défausse —, et chacune le dit levée.

## L'écran

- **Plus de préparation** au niveau 1 : de « Y aller » à la question. Dès le
  niveau 2, l'annonce et son pari, en un écran court, puis la question.
- **L'adversaire en une ligne**, au-dessus de la question : son nom, ses crans
  — pleins, vides —, son attaque. Plus de jauge de points, plus d'aperçu en
  deux tuiles : ses crans disent ce qu'il reste à faire.
- **La main sous la question**, ses cartes au cadre de leur rareté, levées en
  grand au toucher ; une seule se joue.
- **La révélation** : « Juste ! Le Scribe perd un cran » — « Le Scribe
  tombe ! » —, « Raté… −6 de courage ». Plus de ligne de calcul.
- **Partis de l'écran** : l'orbe d'énergie et le coût au coin des cartes, le
  bouclier, la pastille du doute, les cartes « avant » et « pendant » rangées
  à part.
- **Les règles au « ? »**, réécrites pour la version 10 : une ligne chacune.

Regardé au téléphone en 360 × 640 (`rendu-rencontres.ts`, revu pour la
version 10), d'un départ au niveau 1 à la fin, et au niveau 6.

## Le calibrage

`server/scripts/calibrage-rencontres.ts --version 10`, sur le vrai générateur
et le vrai pli. Son joueur change de politique : il voit la question, la sait
ou non selon sa force ; s'il ne la sait pas, il joue sa meilleure aide —
effacer, changer de question, un second essai — ; s'il la sait, une carte qui
frappe plus fort ; il garde ses rares et ses épiques pour le gardien, et parie
comme aujourd'hui. La cible ne change pas : avec le paquet de départ, au
niveau 1, le moyen au bout une fois sur trois, le fort huit fois sur dix (le
brief du 17 octobre 2026) ; puis chaque niveau d'explorateur, chaque style et
chaque cran de l'Ascension, comme les mesures d'aujourd'hui. On règle, dans
cet ordre, les crans, l'attaque et le courage qu'on regagne ; une expédition
complète doit garder sa quarantaine de questions.

## Les invariants que l'étape touche

- **Invariant 1** — la question part avec le pas qui y mène, sauf l'annonce
  du pari, qui la garde au serveur jusqu'à « Voir la question » ; ce qu'une
  carte montre — les réponses effacées, l'indice, l'Oracle — se calcule au
  serveur, qui seul lit la bonne réponse.
- **Invariant 6** — la moitié d'un dévoilement, qui le fait valoir deux crans,
  se lit à l'heure du serveur où la réponse arrive.
- **Invariant 12** — une carte jouée porte la position de la question qu'elle
  vise ; une carte du pari, celle de l'annonce.
- **Invariant 14** — rien ne s'écrit de neuf : crans, courage, main et
  défausse se replient du départ, des gestes et des réponses ; les versions 5
  à 9 se replient à leurs règles, la 10 aux siennes.
- **La mesure** ne bouge pas : une réponse aidée par une carte, ou posée à une
  autre forme, ne mesure rien ; une mise n'aide pas.
- **Les allers-retours** : une carte qui ne lit pas la bonne réponse — celles
  qui frappent plus fort — part avec la réponse, d'un seul lot ; une aide qui
  la lit — effacer, souffler — fait le sien. Pas plus de 2,6 allers-retours
  par question, la mesure d'aujourd'hui (`expedition-charge.test.ts`).

## Les tests

- `expedition-question-au-centre.test.ts` — le pli de la version 10 : le tour
  sans préparation, l'annonce et son pari dès le niveau 2, les crans de chaque
  forme et du dévoilement, l'attaque fixe, la main gardée et la défausse
  rendue à l'acte, une carte par question, les refus de chaque carte, chaque
  carte traduite levée puis jouée — sa promesse tenue par le pli —,
  l'Ascension retraduite, les exploits ; et aucune carte retirée tirée dans
  une expédition neuve.
- Par les routes : la question qui s'ouvre tout de suite au niveau 1, cachée
  par l'annonce au niveau 2, l'aide calculée au serveur, une expédition de la
  version 9 qui se joue à ses règles.
- L'écran, rendu : ni énergie, ni bouclier, ni tuiles ; l'adversaire en
  crans ; la main sous la question ; les règles.

## Ce qui vient ensuite

- **L'étape 3** : les coups de pouce — la première lettre, le nombre de
  lettres, le siècle ou la décennie, plus ou moins, le domaine — et la forme
  des lettres, où l'on compose la réponse avec ses tuiles et où une carte pose
  une lettre à sa place. Elle aura son brief.
- **L'étape 4** : les curiosités, escales bonus qui ne coûtent rien ratées et
  rapportent une carte rare, une fiole, un talisman ; d'abord le plat et le
  rébus.
- **L'étape 5** : la frise et le détail.
- **L'étape 6**, après une semaine de jeu : les familles en façons de
  répondre, le Rempart en « seconde chance », et peut-être un style des
  lettres.

## Ce que je te demande de valider

1. **Une carte par question** (ma recommandation) — ou autant que la main en
   tient ? Une seule garde le choix simple et le gardien redoutable ; sans
   limite, on viderait sa main sur la question qu'on ne sait pas.
2. **La défausse rendue à l'acte suivant** (ma recommandation) — chaque carte
   une fois par acte, et l'on garde ses meilleures pour le gardien —, ou à
   chaque rencontre, plus généreux et moins tendu ?
3. **Le Rempart en pause jusqu'à l'étape 6** (ma recommandation), le
   Métamorphe au niveau 1 à sa place — ou le réécrire tout de suite en
   « seconde chance » ?
4. **Les chiffres de départ, avant le calibrage** : deux, trois, quatre-trois-
   trois crans ; deux pour une question dure ; les attaques d'aujourd'hui
   sans leur croissance ; 50 de courage ; une main de quatre.
