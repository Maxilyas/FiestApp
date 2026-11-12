# L'acte I du Filet : agrandir le réservoir des douze catégories

Le propriétaire, le 12 novembre 2026 : l'acte I du Filet ne pose plus que ce que chaque Français sait placer, et sa carte ne le
promet que dans les catégories qui ont douze valeurs distinctes à l'acte (`VALEURS_D_UN_THEME_DU_FILET`). Seules la Culture générale
et l'Histoire passaient le seuil. Il refuse de baisser le seuil — ni de tricher sur le classement — : on augmente le volume.
L'objectif : au moins 25 valeurs distinctes posables à l'acte I dans chacune des douze catégories. Le relevé qui suit dit ce qui a
été écrit, classé, gardé ou écarté, ce que ça a donné, et pourquoi 25 n'est atteint que dans trois catégories.

## Le résultat

Valeurs distinctes posables à l'acte I en 2026, par catégorie (`categoriesDuFiletALAnnee`, une valeur posée deux fois ne compte
qu'une fois) :

| Catégorie | Avant | Après | Questions neuves rangées | dont « chaque Français » |
|---|---|---|---|---|
| Musique | 11 | **29** | 22 | 18 |
| Culture générale | 28 | 28 | — | — |
| Histoire | 28 | 28 | — | — |
| Cinéma & séries | 6 | **21** | 19 | 16 |
| Sport | 7 | **18** | 13 | 11 |
| Sciences | 7 | **14** | 9 | 8 |
| Autour de la fête | 10 | **12** | 4 | 2 |
| Géographie | 7 | **12** | 8 | 5 |
| Jeux & pop culture | 3 | 10 | 11 | 7 |
| Cuisine | 7 | 9 | 3 | 2 |
| Arts & lettres | 1 | 7 | 5 | 5 |
| Nature | 2 | 3 | 1 | 1 |
| **Total** | 117 | **191** | 95 | 75 |

- **25 est atteint dans trois catégories** (la Musique, et les deux d'avant). **Le seuil de 12 l'est dans huit** : la carte promet
  désormais l'acte I au Cinéma & séries, au Sport, aux Sciences, à la Musique, à Autour de la fête et à la Géographie, en plus de
  l'Histoire et de la Culture générale. Autour de la fête et la Géographie y sont tout juste (12) : une valeur de moins, et elles
  repassent dessous. Le Jeux & pop culture (10), la Cuisine (9), les Arts & lettres (7) et la Nature (3) restent en dessous, et
  ne s'en approcheront pas par écrire d'autres faits (plus bas).
- **Le contenu du Filet** (`server/content/cabinet/filet.json`) passe de 1 751 à 1 865 questions, 1 671 avec un indice. Au contenu,
  233 questions à l'acte I (152 avant), 435 à l'acte II (347), 512 à l'acte III (491) ; 918 ne se posent à aucun acte (le panel sous
  25). Posables en 2026 : 201, 357 et 477 questions, 128, 179 et 261 valeurs distinctes. L'acte I promet 8 catégories, l'acte II
  10, l'acte III les douze.
- **La base** passe de 28 626 à 28 721 questions (95 rangées).
- Aucun barème n'est touché. Le classement n'a pas été desserré : voir « Le classement » plus bas.

## Les trois tours

**Tour 1 — des lots à pistes** (le 12 novembre au matin). Dix rédacteurs (`redacteur-campagne`), une catégorie chacun, 24 à 36
questions demandées, les pistes de l'auteur de la consigne (des faits qu'il croyait connus de tous), la liste des valeurs déjà
prises à l'acte I, et le contrôle du Filet (`reproductions/acte-i/filet-check.mts` : la question se pose-t-elle, sa valeur est-elle
neuve ?). 35 questions rendues sur 10 lots — Musique 11, Cinéma 7, Jeux 5, Géographie 4, Sciences 3, Sport 3, Autour de la fête 1,
Cuisine 1, Nature 0, Arts & lettres 0 —, 32 rangées : le Minitel posé par deux lots est parti au recoupement, les régions
d'avant 2016 à la relecture, et celles d'après 2016 étaient déjà dans la base sous une autre formule (`iibxvvac`, voir « Les doublons
que le juge ne voit pas »).

Ce que les rédacteurs ont dit en rendant leur lot : les faits que chaque Français sait placer sont presque tous déjà dans la
base, **sous une autre face**. Le vérificateur les refuse, citant la question qui les pose : neuf pistes sur neuf en Arts & lettres
(la statue de la Liberté, le Petit Prince, Guernica, Tintin…), 21 sur 24 en Sport (Albertville, Hinault, l'OM…), 24 sur 31 en
Géographie. Les rédacteurs de Nature, d'Arts & lettres et de Cuisine ont rendu 0, 0 et 1 question.

**Tour 2 — un gisement de faits, criblé par script, classé à l'aveugle.** Écrire des questions complètes pour se les voir refuser
coûte cher. Dix agents ont donc dressé une *liste de faits candidats* par catégorie (un intitulé court, la réponse, la valeur, des
mots-clés), que `reproductions/acte-i/crible-candidats.mts` passe contre la base : une valeur mal formée, déjà prise à l'acte I ou
déjà dans la liste, ou un fait que la base pose déjà — une question dont l'intitulé écrit la valeur et nomme un des mots-clés —
est écarté en disant pourquoi. 1 994 lignes écrites ; 593 gardées par le crible, 1 110 écartées comme « déjà dans la base », 291 pour une valeur mal
formée, hors des années posables, déjà prise ou déjà dans la liste.

| Catégorie | Lignes écrites | Gardées | Bloquées par la base |
|---|---|---|---|
| Musique | 176 | 68 | 75 |
| Autour de la fête | 93 | 14 | 75 |
| Cuisine | 123 | 65 | 49 |
| Géographie | 202 | 63 | 136 |
| Sciences | 212 | 64 | 127 |
| Sport | 260 | 62 | 140 |
| Cinéma & séries | 301 | 62 | 148 |
| Jeux & pop culture | 247 | 66 | 140 |
| Nature | 180 | 61 | 103 |
| Arts & lettres | 200 | 68 | 117 |

Les 593 gardées passent un **classement à l'aveugle** (cinq agents Opus, `reproductions/acte-i/consignes/classer.consigne.md`
et `lots-de-classement-des-faits.mts`) : 135 « chaque Français la sait placer ». Puis, après le tri des doublons entre catégories (Verne,
Dolly, la Terre et la Lune revenaient dans trois catégories) et des approximations que la consigne interdit — 93 faits —, dix
rédacteurs en ont écrit 70 questions (la fiche donnait l'intitulé provisoire, la réponse, la valeur ; ils vérifiaient chaque valeur
et écartaient ce dont ils n'étaient pas sûrs), 65 après le recoupement avec la base, **57 rangées** après la relecture (8 retirées : trois
distances par la route qui dépendent de l'itinéraire, une réponse qui avait changé — le Millionnaire français est passé de 15 à
12 questions —, Ocean's Eleven qui souffle sa réponse, la série des Cités d'or dont la date était fausse : 1983 en France et non
1986 —, 4 corrigées).

**Tour 3 — le rattrapage.** Le crible est plus dur que le vérificateur : « Zidane, 1972 » était bloqué par un ballet de Marseille de
1972 sans rapport. Les 1 110 faits bloqués ont donc été classés à leur tour (dix agents, 310 « chacun », 28 %), puis, ôtés ceux que
bloque une question *déjà au Filet* (91 : même valeur, classée autrement par la passe de référence), les approximations, les
valeurs prises, les doublons entre catégories et les faits qu'une même question bloque : **129 faits** à écrire, confiés à neuf
rédacteurs. **Le vérificateur en a refusé 115 comme redites**, les rédacteurs en ont écarté 5 (un doute sur la valeur, un fait d'une autre
catégorie), et 9 questions sont nées, 6 rangées (le match de football à 90 minutes
posait en fait la question `ssdiw09n` en d'autres mots — retiré ; une prise d'otages aux Jeux de Munich portait l'étiquette
« sensible », le Filet ne la pose pas — retirée ; les « 101 dalmatiens » étaient 99 chiots — retirée à la relecture).

## Le classement et le panel : calés sur la passe de référence

Le classement à l'aveugle d'une question (« chaque Français la sait placer ») se mesure à des **étalons** : des questions de la passe
qui fait foi (`../2026-11-09/maquette-filet/ancrage.json`), glissées dans chaque lot sans leur note.

- **Une première consigne trop dure.** « Dans le doute, false ; une question sur douze la passe » : cinq agents ne retrouvaient
  que 2 des 6 vrais « chacun » (Beatles 1966, VIH 1983, l'hypothermie à 35 °C leur échappaient), et classaient 48 faits sur 593. La
  fenêtre « à 6 ans près » se gagne en connaissant l'**époque**, pas l'année exacte — les Beatles sont des années 1960. La
  consigne a été reprise (`consignes/classer.consigne.md`, « La fenêtre est généreuse ») et se cale sur quatorze exemples visibles de la
  référence, quatorze « chacun » et quatorze non, avec la raison que la référence en donnait.
- **Recalée, la mesure est stable** : 11 étalons sur 12 aux cinq lots des faits, 10 ou 11 aux dix lots des faits bloqués, 12 sur 12 aux
  deux lots de questions, toujours les 6 vrais « chacun » retrouvés, un faux positif. Le classement des faits donne alors 135 « chacun ».
  Un classement plus dur que celui du reste du vivier aurait compté les questions neuves avec une autre règle que les 1 900 autres.
- **Le panel** (`panel-du-vivier.mts`, passes 5 à 7) : des notes recalées sur les vingt étalons de la première passe, comme aux
  passes 3 et 4 — corrélation 0,91 et 0,87 aux passes 5 et 6, 0,71 à la septième (six questions). Le classement seul décide de
  l'acte I ; le panel ne joue qu'aux actes II et III.
- 109 questions sont classées et notées : les 89 des tours 1 et 2, et vingt autres, rangées ces derniers jours **sans** avoir eu leur
  ligne du vivier. Une question neuve de la base n'entre au Filet qu'avec son classement, sa note et son indice ; ce n'était pas fait
  pour elles. Des 109, **75 sont « chacun »** (étalons 12/12).

## Les indices

108 questions n'avaient pas d'indice. La chaîne des vagues (`../2026-11-09/reproductions/indices/README.md`) : trois rédacteurs (84 + 24
questions), le juge à la lettre du serveur, deux juges à l'aveugle (107 lectures). **100 indices à la bonne tranche, 3 larges
(gardés), 4 refusés** — un étroit, un qui penche, deux qui menaient à une autre tranche — réécrits par un rédacteur, relus par un juge :
trois gardés, un refusé encore. Le génome humain, 2000 : sa tranche (2000–2024) commence à l'année même de la réponse, tout indice
qui y mène la désigne — « sans indice honnête », comme deux questions de la vague de l'acte II. La recherche des mots qui trahissent
un calcul, une élimination ou le sujet redit (« addition », « fois », « le seul »…) n'a rien trouvé.

## Les doublons que le juge ne voit pas

Deux questions ont passé `verifier`, et `voisines`, sans qu'aucun des deux voie qu'elles posaient un fait déjà dans la base :
- « Combien la France métropolitaine compte-t-elle de régions depuis la réforme de 2016 ? » (13) — la base avait `iibxvvac`, « Depuis la
  réforme de 2016, combien la France métropolitaine compte-t-elle de régions ? » ;
- « Combien de minutes dure un match de football… ? » (90) — la base avait `ssdiw09n`, presque mot pour mot.
Un recoupement par mots (au moins trois mots de cinq lettres en commun, ou la même réponse et deux mots) les a trouvées ; il montre
aussi ce qui n'est pas un doublon, le même sujet sous un autre fait. **Après chaque lot, comparer ses intitulés à la base à la main**,
comme la règle de `campagne-base.md` le dit pour un sous-thème neuf.

## Pourquoi 25 n'est pas atteint : ce que le juge ferme

**Les faits que chaque Français sait placer sont presque tous dans la base, et le juge des redites chiffrées les ferme.** La base date un
fait dans l'intitulé de chaque question qui l'entoure (« le dessin animé de Disney sorti en 1991, comment s'appelle… ») — la consigne
le veut. Une question « En quelle année est sorti *La Belle et la Bête* ? » écrit donc son année dans l'intitulé d'une question
déjà là, et `chiffreeEcrite` (le 10 novembre 2026, pour les questions neuves seulement) la refuse comme la même chose.

- 1 703 faits candidats classés : 444 sont « chaque Français » (135 parmi les 593 gardés, 309 parmi les 1 110 bloqués).
- **Sur les 129 faits bloqués essayés, 115 ont été refusés par le vrai vérificateur** — Musique 7 sur 7, Nature 5 sur 5, Sciences 8 sur 11,
  Fête 18 sur 19, Cinéma 19 sur 20, Géographie 17 sur 19, Jeux 25 sur 27, Sport 12 sur 16, Arts & lettres 4 sur 5 —, 5 ont été écartés par
  leur rédacteur, 9 questions sont nées. Les dix-neuf films les plus connus des Français (Les Visiteurs, La Grande Vadrouille, Amélie
  Poulain, Matrix…) sont tous refusés sauf un. Ce qui passe encore, ce sont les faits que la base n'a sous aucune face. Dans les quatre
  catégories restées sous 12, les rédacteurs du rattrapage ont rendu 1 question de plus en Arts & lettres, 2 en Jeux, 0 en Nature et en
  Cuisine.
- **Les faits connus de tous qui ne sont pas des dates ni des faces d'une œuvre** — des quantités de la vie de tous les jours (un
  paquet de pâtes à 500 g) — sont rares, et un relecteur en retire beaucoup : un format qui varie selon les marques (la brique de
  crème, le thermostat d'un four), une valeur arrondie (la distance Terre-Lune, l'âge de la Terre), un décompte contestable (les pays
  d'Afrique), une version qui change (le Millionnaire).

**Le levier — une décision du propriétaire, que ce travail n'a pas prise.** Trois façons d'aller plus loin, de la moins à la plus coûteuse :
1. *Écrire d'autres faits* : des gisements de plus rendent de moins en moins — 23 % des faits que le crible laisse passer sont « chaque
   Français », et de ces 135 faits-là, 57 questions sont rangées. Ça ne changerait pas le décompte des quatre catégories du bas.
2. *Retirer le nombre des intitulés qui l'écrivent*, sous leur identifiant (« Quel acteur joue Godefroy dans *Les Visiteurs* (1993) ? » devient « … dans
   *Les Visiteurs* ? »), pour que la question de l'année ne pose plus le même fait. Chaque question touchée perd sa datation, que la consigne
   voulait ; un fait qui peut changer (« dernier vainqueur français ») doit garder sa date.
3. *Desserrer `chiffreeEcrite` pour une année demandée sur un fait que l'autre question ne pose que comme contexte.* C'est le choix du
   10 novembre 2026 qui se renverse ; il aurait laissé passer jusqu'à une centaine des 115 questions refusées du rattrapage — certains de ces refus
sont de vraies redites, la même question en d'autres mots —, la plupart à l'acte I.

## Ce que ça a coûté

Soixante-quinze agents : dix rédacteurs de pistes et dix agents de gisement ; vingt-trois classeurs (5 + 5 de faits, 10 de faits bloqués,
2 + 1 de questions) ; trois passes de panel ; dix-neuf rédacteurs de faits ; trois relecteurs ; sept pour les indices (trois rédacteurs,
un de réécriture, trois juges) — de 8 000 à 55 000 jetons chacun.

## Pour refaire

Tous les scripts sont dans `reproductions/acte-i/` (README en tête de chacun). Les consignes dans `consignes/`, les 1 703 faits
candidats avec leur classement et leur verdict dans `faits-candidats.json`. Dans l'ordre :

1. `crible-candidats.mts` sur un fichier de faits candidats (`--ecrire=` ce qui est gardé, `--bloquees=` ce que la base pose déjà) ;
2. `lots-de-classement-des-faits.mts [--bloquees]` — des lots mêlés à douze étalons aveugles, et les exemples visibles que la
   consigne recopie —, `lire-le-classement.mts faits` pour l'accord et les faits retenus (`PREFIXE=bloq` pour les bloqués) ;
3. des questions, par la skill `base-campagne` (une section « CE LOT EN PARTICULIER », `consignes/particulier-faits.md`), le contrôle
   `filet-check.mts` à chaque fichier, `verifier`, `voisines` **et le recoupement à la main**, un relecteur, `ranger` ;
4. `lots-de-notation.mts` pour les questions rangées sans classement, `lire-le-classement.mts questions --verser`, `lire-le-panel.mts <passe>
   --verser` (la passe suivante des passes 5 à 12 de `panel-du-vivier.mts`) ;
5. la chaîne des indices, puis `../2026-11-09/reproductions/contenu-du-filet.mts` ;
6. relever `AU_MOINS` (`cabinet-contenu.test.ts`, `campagne-base.test.ts`) et l'attente des catégories de l'acte I
   (`cabinet-filet-en-deux-temps.test.ts`).
