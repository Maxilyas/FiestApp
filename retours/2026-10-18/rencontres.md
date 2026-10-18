# Les rencontres — le brief du prototype, le 18 octobre 2026

Les retours, après les premières expéditions : « La carte rare pour poser
deux réponses, on ne voit pas les réponses que l'on choisit. On aimerait
quelque chose de plus dynamique. Faire des paris avant la questions par
exemple et gagner des bonus sinon réussi. Aussi une questions dans les
escales semble trop peu. En terme de gameplay, on aimerait que ça soit moins
plat, et que l'on ait des combos à faire avec les cartes, mar exemple des
carte sui change la nature de la carte où par exemple on puisse donner une
estimation au lieu d'une année etc. On trouve que certaines carte ne sont pas
claire aussi, comme le Sphinx. Pareil on comprend pas bien ce qu'on a en main
et comment les cartes reviennent. Par exemple une carte rare qu'on avait
revenait à tous les rounds. Peux tu me faire une vrai proposition de synergie
à la slay rhe spire mais sur notre thème et de réussir à avoir de la
diversité et que ça soit fun ».

Double chance a été corrigée tout de suite (les deux réponses choisies
cochées, PR #253). Le reste est devenu une proposition, « L'Expédition en
cartes » — les rencontres, les mises, les formes, six familles qui se
répondent, des adversaires qui jouent avec la question, en quatorze
sections et un tour jouable : https://claude.ai/artifact/2W3WzCrp7R5RYVkuYUAqE6
(privée, au compte du propriétaire). Sa réponse : « C'est good lance le
prototype avec tes recos ».

Ce brief fixe l'**étape 0** — le prototype — telle qu'elle est dans le code :
la règle, ce qui s'écarte de la proposition et pourquoi, le calibrage, les
invariants qu'elle touche, comment l'essayer et ce qui vient ensuite. Ses
fichiers et ses pièges sont dans `.claude/rules/expedition.md` ; ses
chiffres, dans `docs/reference/baremes.md` (« Le prototype des
rencontres »). Les quatre étapes d'après (« Ce qui vient ensuite ») ont
chacune leur PR.

## En bref

1. **En préproduction seulement** (`RENCONTRES_EN_PRODUCTION`) : le départ
   d'une expédition les propose d'office, un interrupteur les coupe, et la
   production garde l'expédition d'avant — trois vies et des jokers.
2. **Une escale, une rencontre.** Une escale à question n'est plus une
   question : c'est un adversaire à faire tomber, question après question.
   Une élite aussi, et le gardien de l'acte.
3. **Le courage remplace les trois vies** : cinquante points pour toute
   l'expédition, qu'une erreur entame de la frappe de l'adversaire, moins ta
   Garde.
4. **Chaque question est un tour** : l'annonce, la préparation sans voir la
   question — tes cartes, ta mise —, puis la question, tes réflexes, ta
   réponse, et le verdict. Au-dessus du bouton, l'aperçu : « Juste : brise
   12 · Faux : −5 ».
5. **Le cycle de Slay the Spire, montré** : ton paquet est mélangé à chaque
   rencontre, tu tires cinq cartes à chaque question, ce que tu ne joues pas
   part à la défausse, et les quatre tas sont à l'écran.
6. **Des cartes** : le paquet de départ (dix), la carte de chacun de tes
   légendaires, et deux cartes par famille ; ce que proposent les
   récompenses vient des familles de ton équipée.
7. **La mise, en écus** : 0, 10, 20 ou 40 avant de voir la question ; juste,
   elle rapporte la moitié de ce qu'elle engage, fausse, elle est perdue.
8. **Calibré** : avec le paquet de départ, le joueur moyen va au bout 39
   fois sur cent, le fort 86 ; une expédition complète dure une quarantaine
   de questions.

## Ce qui a été décidé le 18 octobre 2026

Les sept questions de la proposition, tranchées par « C'est good lance le
prototype avec tes recos » — ses recommandations, une à une :

1. **Le courage au lieu des trois vies** : cinquante points. Sans points, la
   Garde et les combos n'avaient pas de prise — une erreur coûtait un tiers
   de la partie, tout ou rien.
2. **Des mises en écus**, plutôt qu'une jauge d'audace sans monnaie : les
   écus servent enfin entre deux échoppes.
3. **Six étages par acte, et mesurer** la durée avant d'en retirer un.
4. **Pas de chrono** sauf par une carte qu'on choisit ou un adversaire
   annoncé : le prototype n'en a aucun.
5. **L'équipée choisit les familles** : chaque légendaire est d'une famille,
   les deux qu'on emmène fixent les deux siennes, et les récompenses en
   tirent leurs cartes.
6. **Commencer par le prototype**, en préproduction, avant d'écrire toutes
   les cartes.
7. **Les expéditions en cours finissent à leurs règles** : la version du
   départ (`DepartDExpedition.v`) les garde — une expédition partie en
   version 4 ne verra jamais une rencontre.

## La règle du prototype

### Partir

Au départ, là où le prototype s'ouvre, une section « Les rencontres ·
prototype » : son interrupteur, allumé d'office et retenu sur le téléphone
(`quizz.expedition.rencontres`), sa catégorie fétiche à choisir parmi les
douze (`quizz.expedition.fetiche` ; c'est elle que l'Érudit fait vivre), et
les familles que l'équipée apporte. Partie ainsi, l'expédition est de la
**version 5** : ses gestes et ses réponses se replient comme avant, mais en
rencontres.

On part avec **50 de courage**, **25 écus** et le **paquet de départ** :
Concentration ×4 (+4 de Charge), Prudence ×4 (Garde 5), Coup d'œil,
Échange — l'attaque et la défense de Slay the Spire —, plus la carte de
chacun de ses légendaires.

### Une rencontre

L'adversaire d'une escale incarne sa catégorie (le Scribe pour l'histoire, la
Sirène pour la musique…), le Bouffon un mélange, le Spécialiste un thème
pointu. Il a ses **sceaux** — sa résistance — et sa **frappe** — ce qu'il
prend de courage à une erreur —, selon sa sorte et l'acte :

| | Acte 1 | Acte 2 | Acte 3 |
|---|---|---|---|
| Sceaux d'une escale à question | 12 | 16 | 20 |
| Sceaux d'une élite | 22 | 26 | 32 |
| Sceaux du gardien | 32 | 36 | 44 |
| Frappe d'une escale · élite · gardien | 5 · 7 · 8 | 6 · 8 · 9 | 7 · 9 · 10 |

Sa frappe grandit de 2 à chaque question de la rencontre : une rencontre qui
traîne coûte cher.

**Une bonne réponse brise** (son savoir + ta Charge) × sa forme. Le savoir
suit la marche de la question : 6 pour une facile, 8 une moyenne, 11 une
difficile, 14 une experte. La forme : ×0,5 en vrai ou faux, ×1,5 en six
choix, ×3 au premier mot d'un dévoilement jusqu'à ×1 au dernier. Avec une
Concentration, deux bonnes réponses font tomber une escale, deux ou trois une
élite, trois ou quatre un gardien ; une de plus, souvent, sans elle.

**Une erreur coûte** sa frappe, moins ta Garde ; ta Charge retombe, ta série
aussi. À zéro de courage, l'expédition s'arrête — sauf Renaissance, qui
relève à 15, une fois.

**Il tombe** : les écus de l'escale (ceux qu'une bonne réponse y rapportait
avant, `ecusDeLaReponse`), puis une carte à prendre parmi trois — ou aucune :
un paquet court tire plus souvent ses meilleures cartes. Une élite propose
des rares plus souvent, et parfois un talisman ; le gardien vaincu donne ses
40 écus et ce qu'il donnait avant — son joker devenu carte, et l'acte
suivant.

### Un tour

1. **L'annonce** : la catégorie, la marche, la forme, « réponses chiffrées »
   si ce sont des années ou des nombres, ta chance — et l'intention de
   l'adversaire, « ⚔ 6 si tu te trompes ». Jamais le texte de la question.
2. **La préparation** : 3 d'inspiration, 5 cartes en main. Tu joues tes
   cartes de préparation et tes pouvoirs, tu choisis ta mise ; l'aperçu
   change à chaque carte et à chaque mise.
3. **« Voir la question »** : la mise part, la question arrive. Tes réflexes
   se jouent maintenant — Coup d'œil, Parade, Double chance…
4. **La réponse, puis le verdict** : ce que tu as brisé, ce qu'il t'a pris,
   ce que la mise a rapporté ou coûté. Ta main part à la défausse ; question
   suivante, ou l'adversaire tombe.

### Les cartes

Une carte a son **coût** en inspiration (0, 1 ou 2), son **moment** — la
préparation, avant de voir la question ; le réflexe, la question sous les
yeux ; le pouvoir, posé pour toute la rencontre ; la route, sur la carte —,
sa **famille** et sa **rareté**, au cadre de l'album. Une carte **épuisée**
quitte la rencontre et revient à la suivante (Échange, Double chance,
Sursis…) ; une carte de **route** se joue entre deux escales, une fois par
acte, et ne se tire jamais en rencontre.

Le catalogue du prototype (`CARTES_DES_RENCONTRES`) :

- **Onze neutres** : Concentration, Prudence, Coup d'œil, Échange, La
  pioche, Arrêt sur image, Le détour, Double chance, Sursis, Tout ou rien,
  Quitte ou double. Les offres proposent toutes les autres, jamais
  Concentration ni Prudence — comme Slay the Spire ne propose pas ses frappes
  de base.
- **Deux cartes par famille** : Plume et Bibliothèque (l'Érudit), Doubler la
  mise et Banco (le Flambeur), Corser et Simplifier (le Métamorphe),
  Échauffement et Lancée (l'Élan), Parade et Contre-attaque (le Rempart),
  Lucidité et Troisième œil (le Devin).
- **Les vingt-trois jokers des légendaires, réécrits** pour la rencontre :
  ils gardent leur clé, leur légendaire et leur rareté, et prennent la
  famille que la proposition leur donne. Le Sphinx est réécrit : « Le Sphinx
  te souffle quand et de quoi parle la question. Elle ne se date pas ? Il
  efface une mauvaise réponse. »

Une **offre** tire trois cartes distinctes : chacune d'une famille de
l'équipée, 40 % chacune, sinon des neutres ; à la rareté de ses poids (60 %
commune, 30 % rare, 10 % maudite après une rencontre ; 30, 60, 10 après une
élite, dans un coffre et à l'échoppe).

### La mise

0, 10, 20 ou 40 écus, choisis pendant la préparation : tu sais la catégorie,
la marche, la forme et ta chance — jamais la question. **Juste, elle
rapporte la moitié de ce qu'elle engage ; fausse, elle est perdue** : elle ne
vaut le coup qu'à deux chances sur trois. Doubler la mise l'engage double,
perte comprise ; Le trésor du Dragon et Quitte ou double la font rapporter
triple, cinq fois sous les deux ; Banco brise en plus un sceau par tranche
de cinq écus misés. Une mise n'aide pas : la réponse reste nue.

### Entre deux rencontres

La carte ne change pas : six étages, sa route, un pas à la fois. Une source
retrouvée rend 12 de courage, un campement 15 (ou retirer une carte), un
piège de l'inconnu en prend 8. L'échoppe vend trois cartes de ses familles,
un talisman, 15 de courage pour 40 écus, et retire une carte pour 15 ; une
carte s'y paie à sa rareté — 20 une commune, 35 une rare, 15 une maudite.

### Ce que l'expédition paie, et ce qu'elle ne mesure pas

Rien ne change hors de l'expédition : chaque bonne réponse paie comme en
campagne — un confetti, l'expérience d'une bonne réponse —, une erreur va au
carnet, et le légendaire se garde au bout du troisième acte. Une réponse
aidée d'un indice (la colonne `joker`) ou posée sous une autre forme — Corser,
Simplifier — ne compte ni pour la mesure des difficultés, ni pour le modèle
du savoir. Ni carte, ni écu, ni talisman ne sort de l'expédition.

## Ce qui s'écarte de la proposition

- **Un geste par carte, pas un par question.** La proposition promettait
  « les cartes de la préparation partent avec la mise, en un seul geste ».
  Dans le prototype, chaque carte jouée est un geste — un aller-retour —,
  puis « Voir la question » en est un, puis la réponse : quatre à cinq par
  question au lieu d'un ou deux, une centaine de cartes jouées par
  expédition. C'est le serveur qui tranche une carte jouée (ses refus lisent
  ce que la page ne sait pas : la question qui attend, sa pioche), et La
  pioche ou Le feu d'artifice tirent des cartes que la page ne peut pas
  deviner. Pour une semaine de préproduction, ça tient ; avant la
  production, les cartes qui ne tirent rien partiront avec la mise, en un
  seul geste (étape 1).
- **Une mise gagnée rapporte la moitié**, pas le double : à un contre un,
  miser rapportait dès une chance sur deux — toujours, en facile —, et le
  calibrage finissait l'expédition sur six cents à mille écus.
- **Les mises sont 0, 10, 20 ou 40** (la proposition disait 25 et 50) : de
  quoi miser dès la première rencontre avec 25 écus, sans tout jouer.
- **Les sceaux sont plus bas** que ceux de la proposition (« 14 à 30, le
  triple pour un gardien ») : 12, 16, 20 pour une escale, 22 à 32 pour une
  élite, 32 à 44 pour un gardien. Le premier calibrage, à 16, 20, 24 — et 40
  à 52 pour un gardien —, menait le joueur moyen au bout une fois sur quatre
  (26 %), en quarante-cinq questions. La frappe des escales grandit moins
  d'un acte à l'autre (5, 6, 7 au lieu de 5, 7, 9), l'élite et le gardien
  frappant plus fort qu'elles : un ordre de grandeur, que la semaine de jeu
  dira.
- **La catégorie fétiche se choisit parmi les douze** (la proposition : parmi
  ses trois meilleures, que le modèle du savoir connaît) ; sans légendaire
  dans l'équipée, les récompenses ne proposent que des neutres (la
  proposition : on choisit sa famille soi-même). Les deux viendront avec les
  familles.
- **Les adversaires n'ont pas encore de ruse** : ils ont un nom par
  catégorie, leur sceaux et leur frappe. Jeux & pop culture a le Maître du
  jeu, le Bouffon garde les mélanges.
- **Pas encore** : le pari sans aide, les défis de rencontre, les fioles,
  aiguiser, l'estimation et ses cartes, les ruses, les règles des élites et
  des gardiens, les événements de l'inconnu, les talismans neufs, le journal
  de la rencontre, la première rencontre guidée, les mots-clés qu'on touche.

## Le calibrage

`server/scripts/calibrage-rencontres.ts`, sur le vrai générateur et le vrai
pli, mille expéditions par case, les joueurs de `calibrage-expedition.ts` —
le moyen trouve ce que trouve le calibrage des sentiers, le faible et le fort
sont décalés d'un logit. Sa politique, simple — pas la meilleure : il lit sa
chance dans l'annonce ; bonne, il attaque et mise, mauvaise, il se garde ; la
question vue, il joue ce qui l'aide s'il ne sait pas ; il prend dans les
offres d'après une préférence fixe et suit le tracé le plus sûr.

| | Faible | Moyen | Fort |
|---|---|---|---|
| Le paquet de départ seul | 7 % | 39 % | 86 % |
| Avec la Chouette et le Phénix (l'Érudit, le Rempart) | 7 % | 38 % | 87 % |
| Avec le Dragon d'Or et Janus (le Flambeur, le Métamorphe) | 3 % | 25 % | 77 % |
| Questions d'une expédition jouée jusqu'à sa fin, avec le paquet seul | 36 | 41 | 39 |
| Rencontres | 9 | 12 | 13 |
| Écus gagnés, avec le paquet seul | 207 | 361 | 553 |
| Écus gagnés, avec le Dragon et Janus | 270 | 516 | 789 |

Pour mémoire, l'expédition d'avant (la version 4) : 3, 20 et 62 % avec le
paquet de départ, 6, 25 et 67 avec la Chouette et le Phénix, en une vingtaine
de questions.

1. **La cible est atteinte, même dépassée** — le moyen une fois sur trois, le
   fort huit fois sur dix : le courage pardonne plus que trois vies, et la
   Garde amortit les erreurs qu'on voit venir.
2. **L'équipée n'aide pas encore** : la Chouette et le Phénix ne font pas
   mieux que le paquet seul, et le Flambeur et le Métamorphe font moins bien.
   Le trésor et Deux visages coûtent de l'inspiration sans rien briser,
   Doubler la mise, Corser et Simplifier diluent le paquet : ce qu'on a gagné
   doit faire jouer autrement, pas moins bien. C'est la question de la
   semaine — le simulateur joue-t-il mal le Flambeur, ou ses cartes sont-elles
   trop faibles ? —, et la première chose à regarder aux familles.
3. **La durée** : une quarantaine de questions pour une expédition complète,
   treize rencontres — le bas de la fourchette annoncée (40 à 55). Les six
   étages restent ; s'ils pèsent en préproduction, cinq étages ou des sceaux
   plus bas sont prêts à être essayés.
4. **Les écus abondent** : 360 à 800 pour une échoppe qui vend de 15 à 50.
   Les fioles et aiguiser, à l'étape 1, leur donneront de quoi servir.

## Les invariants que le prototype touche

- **Invariant 1** — la question se tire au pas qui ouvre son tour, mais ne
  part pas tant qu'il prépare : la vue ne porte que l'annonce et son rang, et
  la réponse comme la route du dévoilement sont refusées avant « Voir la
  question ». L'annonce ne dit que ce que la question dira : ses réponses,
  ses mots, « réponses chiffrées ».
- **Invariant 12** — une carte jouée et « Voir » portent le rang de la
  question qu'ils visent : un geste périmé est ignoré.
- **Invariant 6** — le dévoilement ne court qu'une fois vu : son heure se
  repose au geste « voir », lue à l'heure du serveur.
- **Invariant 8** — ni carte, ni écu, ni talisman ne sort de l'expédition, et
  les Divins n'ont pas de carte.
- **La mesure** ne bouge pas : une réponse aidée ou d'une autre forme ne
  mesure rien, une mise n'aide pas.
- **Une expédition partie finit à ses règles** : la version 4 et la version 5
  vivent ensemble, chacune repliée par ses règles.

## Essayer en préproduction

1. Sur la préproduction, avec un profil : `/expedition`. Au départ, la
   section « Les rencontres · prototype » est allumée ; choisir sa catégorie
   fétiche si l'on veut, son équipée, puis partir.
2. Sur une escale à question : l'adversaire, ses sceaux, son intention ;
   l'annonce ; la main de cinq. Toucher une carte la lève — ce qu'elle fait,
   « Jouer » ou son refus —, choisir sa mise, lire l'aperçu, puis « Voir la
   question ».
3. Les quatre tas (pioche, main, défausse, épuisées) se touchent et
   s'ouvrent ; le paquet entier aussi, depuis la carte.
4. L'interrupteur coupé, l'expédition repart aux règles d'avant ; une
   expédition en cours finit aux siennes.

Ce qu'il faudra dire au bout de la semaine : est-ce trop long ? mise-t-on, et
combien ? l'aperçu se lit-il ? comprend-on d'où reviennent les cartes ? le
courage est-il trop généreux ? quelles cartes ne joue-t-on jamais ?

Les écrans, d'un départ à la fin, se photographient par
`server/scripts/rendu-rencontres.ts` (client construit d'abord).

## Ce qui vient ensuite

Les étapes de la proposition, chacune sa PR, ses tests, son rendu au
téléphone, sa doc et son calibrage — après une semaine de jeu en
préproduction et les chiffres ajustés :

1. **Les familles** : les 68 cartes, la récompense tirée de ses familles, la
   famille choisie à une place vide, la fétiche parmi ses trois meilleures,
   aiguiser et retirer, les fioles ; les cartes de la préparation qui
   partent avec la mise, en un seul geste.
2. **Les formes** : l'estimation, Approximation, Dévoiler, Contre-pied, la
   Chimère ; l'annonce « une année » ou « un nombre ».
3. **Les adversaires** : leurs ruses, les élites, les gardiens et leur règle,
   les événements de l'inconnu.
4. **Les talismans, et l'ouverture** : les vingt talismans, ceux des
   gardiens, les défis de rencontre ; le calibrage final, puis la production
   (`RENCONTRES_EN_PRODUCTION`).
