# Les récompenses

> Ce qu'un profil gagne en jouant — l'expérience et les niveaux, les finitions, l'Éclat, les trophées, les avatars légendaires, les saisons, les écussons de savoir, les Divins —, et pourquoi c'est juste. Pour les joueurs qui se demandent ce qui se gagne, et pour qui touche à ces règles.

**Dans cette page** : [les principes](#les-principes) · [l'expérience](#lexpérience) · [les niveaux](#les-niveaux) · [les finitions](#les-finitions) · [l'Éclat](#léclat) · [les trophées](#les-trophées) · [les légendaires](#les-avatars-légendaires) · [les saisons](#les-saisons) · [les écussons](#les-écussons-de-savoir) · [la rareté](#la-rareté) · [les Divins](#les-divins) · [la construction](#comment-cest-construit)

Tout se joue sans compte : un invité anonyme joue la même partie, aux mêmes points, et c'est le chemin que l'application propose d'abord. Un **profil** ajoute une mémoire : ce que tu fais en soirée, au quiz du jour et en campagne s'additionne d'une fois à l'autre. La fin de chaque partie dit ce qu'elle vient de te donner ; tout ce que tu as gagné, et ce qui reste à gagner, se retrouve dans « Ma collection » (`/profil#collection`) ; les autres le voient sur ta carte, en touchant ton nom ([le profil](le-profil.md)).

> [!NOTE]
> Cette page dit les règles et ce qu'on peut gagner, pas la mise en page des trophées, qui bouge encore. Elle emploie les mots de l'application : un **trophée**, tout ce qui se gagne par un exploit ; **bronze, argent, or**, les étapes d'une piste ; un **palier**, l'étape d'un sentier. Chaque valeur a sa ligne, avec sa constante, dans [les barèmes](../reference/baremes.md).

## Les principes

**Un profil ne donne aucun avantage de jeu face aux autres.** Ni points, ni temps, ni question plus facile : un niveau 30 et un invité arrivé ce soir jouent la même partie — en soirée, au quiz du jour, au défi, en duel. Ce que tu gagnes se voit ; rien ne s'y joue. Seule [l'Expédition](l-expedition.md), qu'on joue seul et sans classement, fait servir ce qu'on a gagné : chaque légendaire qui a son joker y part dans l'équipe, et son joker n'en sort jamais.

**L'invité anonyme n'affiche rien** — ni « Niv. 0 », ni pastille grise, ni finition : l'absence, pas l'infériorité. Ses hauts faits de soirée sont annoncés à la clôture comme ceux des autres, sur son téléphone et à la salle, mais rien ne se garde ; le profil qu'il crée ensuite commence à la soirée suivante.

**L'expérience se mérite.** Rien pour la présence, rien seul : en soirée, tout se gagne dès deux joueurs, un podium de quiz dès cinq questions, celui de la soirée dès quinze, et un podium a toujours une marche de moins que la salle — à deux, seul le premier monte. L'animateur qui joue chez lui gagne comme tout le monde.

**Elle ne redescend jamais en cours de soirée.** Ce qu'un quiz rapporte se crédite dès son verdict, et c'est acquis. Ce qui pourrait se renverser d'un quiz à l'autre — le podium de la soirée, l'assiduité, les trophées : hauts faits, prix, étapes des pistes — attend la clôture, et se décide en une fois.

**Un prix ne rapporte jamais d'expérience** — ni ceux du palmarès, vingt à collectionner sur ton étagère ([après la soirée](apres-la-soiree.md)), ni ceux remis à l'écran, qui sont des points d'équipe. Un podium, si.

**Les règles valent aussi pour hier.** Tout se déduit des journaux de ce qui s'est joué : quand une règle de soirée change, l'historique est relu avec elle, et une amélioration profite aux soirées passées.

### Ce qui est gagné reste gagné

En règle générale, rien ne se reprend. Voici exactement les cas où quelque chose part :

| Ce qui arrive | Ce qui part | Ce qui reste |
|---|---|---|
| Une soirée est effacée (« C'était un essai »), retirée de l'historique, ou reprise par l'administrateur avec le compte qui l'avait organisée | tout ce qu'elle t'avait donné : son expérience (et le niveau qu'elle faisait), ses prix, ses hauts faits, les étapes de piste rangées sous elle, un Divin, une saison, son Éclat — et ce qui en dépendait : titre, vitrine, légendaire | tout le reste |
| Tu es exclu de la soirée en cours | l'expérience et l'Éclat qu'elle t'avait déjà donnés | tout le reste |
| Un légendaire ou la courbe des niveaux se durcit | rien | le légendaire, le niveau et ses finitions, tant que la règle d'alors te les donne |
| Une règle de soirée change — barème, haut fait, prix, Divin — et l'historique est relu (`VERSION_BAREME`) | ce que la règle neuve ne donne plus à tes soirées passées, et ce qui en dépendait : titre, vitrine, légendaire que rien ne garde | les étapes de tes pistes |
| Le niveau d'une finition ou le seuil d'un écusson monte | la finition ou l'écusson, aussitôt : rien ne les garde | — |
| Une règle du quiz du jour ou de la campagne change | rien : la relecture de leurs parties ne fait qu'ajouter | tout |

Ne se reprend jamais, hors suppression du profil : ce qui est rangé hors des soirées — les trophées du quiz du jour et de la campagne, une saison gagnée au quiz du jour, Chronos, l'Éclat d'une partie du jour ou du défi —, ni l'étape d'une piste, sauf avec sa soirée. Hors de ces cas, ton expérience ne baisse que si un barème est revu à la baisse et l'historique recompté — un choix de produit, qui se dit —, ou si l'administrateur annule une question du quiz du jour avant minuit : ta partie se recompte sans elle.

> [!IMPORTANT]
> Deux limites, à connaître avant de toucher aux règles. **Durcir un haut fait de soirée, un prix ou un Divin, puis monter `VERSION_BAREME`, reprend le passé** : `DURCISSEMENTS` ne protège que les règles des légendaires. Et **la piste de La Légende ne se juge pas en campagne** : qui ne joue qu'en campagne passe le niveau 10 sans son étape de bronze, qui tombe à sa prochaine partie du quiz du jour ou à la clôture de sa prochaine soirée.

## L'expérience

### En soirée

Elle se compte question par question, quiz par quiz, puis à la clôture (`XP` et `SEUILS`, `shared/profil.ts`). Une question ne rapporte rien si elle n'a pas été posée à deux joueurs au moins.

| Ce que tu fais | XP | À quelle condition |
|---|---|---|
| Répondre | 1 | — |
| Bien répondre à un QCM | 3 | vrai ou faux, plusieurs bonnes réponses et ordre compris |
| Le réflexe | + 2 | juste, et dans le tiers le plus rapide des bonnes réponses — deux au moins |
| L'estimation la plus proche | 5 | tous les ex æquo |
| Une estimation dans le tiers le plus proche | 3 | hors la plus proche |
| Le podium d'un quiz | 25 · 15 · 10 | un quiz de cinq questions au moins, où deux joueurs au moins ont répondu |
| Le sans-faute d'un quiz | 15 | dans un tel quiz, toutes ses QCM justes, cinq au moins |
| Le podium de la soirée | 60 · 40 · 25 | à la clôture ; quinze questions au moins, deux joueurs ; contre toute la salle, anonymes compris |
| L'assiduité | 10 | à la clôture ; avoir répondu à 90 % des questions qu'on t'a posées, quinze au moins |
| Tes hauts faits de soirée | 5 à 60 chacun | à la clôture ([plus bas](#les-hauts-faits-de-soirée)) |

Un rang se partage : des ex æquo touchent chacun la part entière (`shared/classement.ts`).

**Une soirée qui compte** est une soirée où tu as répondu à une question posée à deux joueurs au moins (`soireeQuiCompte`). Jouée seul, elle reste dans l'historique, à zéro, et ne compte ni pour ta carrière — fiche, écussons, pistes —, ni pour l'Éclat, les confettis ou une saison : dix « soirées » d'une question chacune faisaient sinon un légendaire.

### Hors des soirées

Chaque mode a son barème, détaillé sur sa page ; l'expérience va au même total et au même niveau.

| Où | Ce qui rapporte | XP |
|---|---|---|
| [Le quiz du jour](le-quiz-du-jour.md) | une partie, à proportion de ses points | jusqu'à 200 (`XP_MAX_DU_JOUR`) |
| | le podium du jour, figé à minuit | 75 · 45 · 30 (`XP_PODIUM_DU_JOUR`) |
| | la série, dès la partie commencée | 10 par jour d'affilée, 100 au plus |
| [La campagne](la-campagne.md) | une bonne réponse, dans tous ses modes, duels compris | 5 ; 10 pour les vingt premières du jour |
| [Les sentiers du savoir](les-sentiers-du-savoir.md) | un palier validé en jouant, une fois | 50 ; 100 s'il ouvre un portrait ; 250 le maître |
| Quiz du jour, campagne | un haut fait du jour ou de campagne, chaque fois | de 5 à 250 ([plus bas](#les-trophées)) |
| Partout | l'étape d'une piste — bronze, argent, or —, une fois | 50 · 100 · 200 (`XP_PALIER`) |

Un Divin, un écusson, une saison, un prix ne rapportent aucune expérience.

## Les niveaux

Le niveau *n* demande 60 × (*n* − 1)² points d'expérience (`XP_PAR_PALIER`, `shared/profil.ts`). On commence au niveau 1, jamais 0, et la courbe n'a pas de plafond.

| Niveau | 2 | 3 | 5 | 6 | 10 | 15 | 20 | 25 | 30 |
|---|---|---|---|---|---|---|---|---|---|
| XP | 60 | 240 | 960 | 1 500 | 4 860 | 11 760 | 21 660 | 34 560 | 50 460 |

Mesuré sur des bandes d'amis simulées qui jouent sur le vrai code (`server/scripts/calibrage.ts`), le joueur médian d'une bande de douze qui joue deux quiz de cinquante questions est niveau 3 après sa première soirée, 9 après la dixième, 13 après la vingtième, et passe le niveau 10 à sa onzième ; à huit, sur trois quiz de douze questions, à sa vingt-quatrième. Le quiz du jour, la campagne et les sentiers s'y ajoutent : le solo est fait pour avancer vite.

**Un niveau atteint se garde.** La courbe a déjà été durcie : chacun a gardé le niveau que l'ancienne courbe lui donnait, et ses finitions avec, tant que cette courbe le lui donne encore (`COURBES_D_AVANT`) ; sur un tel niveau, la barre compte depuis zéro jusqu'au suivant. Ceux dont le niveau gardé dépassait la courbe du jour ont reçu, une fois, l'expérience qui manquait pour qu'elle le leur donne.

## Les finitions

Ta finition habille ton avatar, et la salle la voit. Chacune s'ouvre à un niveau (`NIVEAU_FINITION`) :

| Mat | Argent | Or | Holo | Prisme | Aurore | Constellation |
|---|---|---|---|---|---|---|
| niveau 1 | niveau 3 | niveau 6 | niveau 10 | niveau 15 | niveau 20 | niveau 25 |

« Auto » porte la plus belle que tu as ; en choisir une l'épingle. Un Divin n'en prend aucune. Les niveaux ouvrent aussi douze emojis de collection, réservés aux profils. Leur allure — la lumière des trois dernières, le cercle d'un avatar peint — et où les choisir : [le profil](le-profil.md).

## L'Éclat

Un tirage, et rien d'autre : ton avatar change de couleurs, pour toujours, et personne d'autre ne l'a comme ça. C'est la seule récompense où le premier et le dernier de la salle sont à égalité.

| Où | Sa chance | Quand |
|---|---|---|
| En soirée | 1 sur 40 (`CHANCE_ECLAT`) | une fois par soirée, au premier crédit d'une soirée qui compte ; annoncé à la clôture |
| Au quiz du jour | 1 sur 40 (`CHANCE_ECLAT_DU_JOUR`) | à chaque partie finie |
| Au défi de la semaine | 1 sur 20 (`CHANCE_ECLAT_DU_DEFI`) | à la tentative finie |

Rien d'autre ne le tire — ni les séries de la campagne, ni ses révisions, ni les sentiers, ni les parcours, ni les duels : ils se rejouent à volonté, quand une soirée, une partie par jour ou une tentative par semaine tiennent lieu de garde-fou.

- **Ce qui éclate** : ce que tu portes — un légendaire, un portrait des sentiers, une forme de compagnon —, sinon ton emoji ; sous un Divin, ton emoji. Un compagnon n'éclate qu'une fois, toutes formes comprises : des paillettes brillent sur chacune, et à sa forme ultime, l'Éclat lui ouvre sa métamorphose de lumière — une forme de plus, qu'on porte ou qu'on montre dans sa niche en la choisissant ([le profil](le-profil.md)).
- **Un Éclat en réserve** (depuis le 20 octobre 2026) : quand le tirage tombe sur un avatar qui a déjà éclaté, il ne se perd pas — il attend. Dans la loge, pièce « Avatar », une bannière « Un Éclat en réserve » te laisse choisir n'importe quel avatar que tu as et qui n'a pas encore éclaté (un légendaire, un portrait, une forme de compagnon, un emoji) ; le choix se confirme, et il est définitif. Jamais un Divin. Une réserve ne compte pas pour La Pluie d'Éclats : seul l'avatar qui éclate compte, une fois choisi. Elle reste rangée sous la soirée, le jour ou la semaine où l'Éclat est tombé, et suit leur sort : une soirée effacée reprend aussi l'Éclat qu'elle avait donné, dépensé ou non. Les tirages perdus avant cette date ne se rattrapent pas.
- **C'est définitif.** Tu le portes en « Version rare » ou en « Version d'origine » — sauf un compagnon : sa métamorphose a sa propre case ; l'Éclat reste à toi et compte pour La Pluie d'Éclats. Il ne se reprend qu'avec la soirée qui l'a tiré ; celui d'une partie du jour ou du défi, jamais.

## Les trophées

Un **trophée**, c'est tout ce qui se gagne par un exploit : les hauts faits, les pistes, les prix du palmarès ([après la soirée](apres-la-soiree.md)), les maîtres des sentiers ([les sentiers du savoir](les-sentiers-du-savoir.md)), les ligues des duels ([les duels](les-duels.md)). Ici, les hauts faits et les pistes.

- **Les hauts faits** se regagnent : vingt en soirée, dix au quiz du jour, cinq en campagne ; chacun compte autant de fois que de soirées, de jours ou de parties où il tombe — « × 3 », ce sont trois soirées. Ce sont des **exploits**, ou des **coups du sort** qu'on assume en riant — le bas du classement a aussi quelque chose à chasser ; un coup du sort rapporte peu, 15 points d'expérience au plus, et ta carte ne le montre que si tu le choisis.
- **Les pistes** se cumulent sur toute ta carrière : dix-huit, qui montent chacune en trois étapes — bronze, argent, or —, gagnées une fois. Le code les appelle des hauts faits de carrière et leurs étapes des paliers (`HAUTS_FAITS_DE_CARRIERE`, `clePalier`).

### Les hauts faits de soirée

Ils se décident à la clôture, une fois tout joué, et seulement si **quatre joueurs au moins** ont répondu dans la soirée (`salleHautsFaits`) ; un « quiz valide » en compte quatre aussi. Leur expérience entre dans la ligne de la soirée. Catalogue : `HAUTS_FAITS_DE_SOIREE` (`shared/hautsfaits.ts`) ; règles : `server/src/core/hautsfaits.ts`.

| Haut fait | Sorte | XP | Ce qu'il faut |
|---|---|---|---|
| 🎯 Grand Chelem | exploit | 40 | dans un quiz valide, huit QCM au moins, toutes répondues et justes |
| ⚡ La Foudre | exploit | 25 | le plus rapide à trouver — ex æquo compris, et parmi deux bonnes réponses au moins — sur trois questions d'un même quiz |
| 🔥 Le Phénix | exploit | 40 | premier d'un quiz valide, après avoir fini le précédent — valide lui aussi — dans la moitié basse ou sans un point |
| 🦄 Seul contre tous | exploit | 25 | seul à trouver un QCM qui a reçu six réponses au moins |
| 🔮 L'Oracle | exploit | 50 | deux estimations exactes dans la soirée |
| 🥇 Le Doublé | exploit | 25 | gagner exactement deux quiz (de cinq questions, à deux joueurs au moins) |
| 🐉 Le Triplé | exploit | 60 | en gagner trois ou plus — il remplace le Doublé |
| 👑 Le Roi de la soirée | exploit | 40 | premier de la soirée, à huit joueurs au moins et quinze questions au moins |
| 🛡️ L'Increvable | exploit | 30 | dix QCM justes d'affilée — un QCM laissé ou faux casse la série |
| ⏰ Le Buzzer d'Or | exploit | 20 | trois bonnes réponses dans la dernière seconde du chrono |
| 🧭 Le Flair | exploit | 25 | trois fois juste quand la majorité se trompait (quatre réponses au moins) |
| 🏮 La Lanterne Rouge | coup du sort | 5 | dernier d'un quiz valide de cinq questions au moins, en ayant répondu à tout, sans égalité générale |
| 🎢 L'Ascenseur Émotionnel | coup du sort | 5 | premier au cumul après un quiz qui n'était pas le dernier, puis dans la moitié basse à la fin |
| 💥 Le Kamikaze | coup du sort | 5 | cinq QCM faux, répondus en moins de deux secondes |
| 🌀 La Girouette | coup du sort | 5 | un QCM faux après avoir changé trois fois d'avis |
| 🌌 L'Estimation Cosmique | coup du sort | 5 | une estimation dix fois trop haute ou trop basse, ou pire ; cible ou réponse nulle, ou de signe contraire : un écart d'au moins neuf fois la cible, et de neuf au moins |
| 🥈 Le Presque | coup du sort | 10 | deuxième d'un quiz valide, à 20 points ou moins du premier |
| 😴 Le Somnambule | coup du sort | 5 | cinq questions d'affilée laissées passer |
| 🥚 Le Zéro Pointé | coup du sort | 5 | zéro point ou moins sur un quiz valide de cinq questions au moins, en ayant répondu à tout |
| 🐟 Le Contre-Courant | coup du sort | 5 | trois fois seul sur sa réponse — fausse — à un QCM qui a reçu six réponses au moins |

### Les hauts faits du quiz du jour

Chacun se gagne une fois par jour au plus, et paie à chaque fois. Ceux qui se mesurent aux autres demandent une salle de **huit joueurs du jour** (`SALLE_DU_JOUR`). Le moment où chacun tombe — au début de la partie, à sa fin ou à la nuit — est dans [le quiz du jour](le-quiz-du-jour.md).

| Haut fait | Sorte | XP | Ce qu'il faut |
|---|---|---|---|
| 🌿 Le Laurier | exploit | 50 | être premier du jour (tous les ex æquo) |
| 🏛️ Le Triomphe | exploit | 150 | l'être trois jours d'affilée |
| 🌅 Le Phénix du jour | exploit | 100 | l'être au lendemain d'un jour fini dans la moitié basse (salle de huit les deux jours) |
| 🏝️ Seul au monde | exploit | 75 | seul juste sur une question qui a reçu huit réponses au moins (salle de huit) |
| 🌩️ L'Éclair du jour | exploit | 50 | la bonne réponse la plus rapide sur trois questions de sa partie (salle de huit) |
| 🐓 Le Lève-tôt | exploit | 25 | finir sa partie avant 8 h (Paris) |
| 🗓️ Le Mois complet | exploit | 250 | jouer chaque jour de quiz d'un mois qui en a eu vingt-huit au moins |
| 🕯️ La Lanterne du jour | coup du sort | 15 | dernier, partie finie, en ayant répondu à tout (salle de huit) |
| 🚇 Le Dernier Métro | coup du sort | 10 | commencer sa partie à 23 h 30 passées (Paris) |
| 💨 Le Courant d'air | coup du sort | 5 | laisser sa partie avant sa dernière question |

### Les hauts faits de campagne

Ils se jugent à la fin d'une partie de campagne — une série, le défi de la semaine, un duel —, pas d'une révision, d'une épreuve des sentiers ni d'un parcours ([la campagne](la-campagne.md)).

| Haut fait | XP | Ce qu'il faut |
|---|---|---|
| 🎪 Le Funambule | 100 | neuf bonnes réponses d'affilée sur sa dernière vie |
| 💠 Sans une égratignure | 100 | atteindre les expertes sans une faute, après les trois marches complètes (quinze questions) |
| 🏔️ La Grande Série | 150 | trente bonnes réponses dans une série de toutes les catégories — pas une catégorie choisie, pas un sujet |
| 🌍 Le Tour du monde | 250, une fois | pour chacune des douze catégories, un record de dix bonnes réponses dans une série de cette seule catégorie |
| ⚔️ Le Vainqueur du défi | 150 | premier du défi de la semaine (ex æquo compris, une bonne réponse au moins), à deux joueurs au moins ; jugé à la clôture de la semaine |

### Les hauts faits des sentiers

Ils se jugent à la fin d'une épreuve en jeu — jamais d'un rejeu, qui se rejoue sans rien risquer —, une épreuve au plus chacun ([les sentiers du savoir](les-sentiers-du-savoir.md#les-trophées-des-sentiers)).

| Haut fait | XP | Ce qu'il faut |
|---|---|---|
| 💎 L'Impeccable | 150 | seize bonnes réponses sur seize, dès le cinquième palier — où le vrai ou faux s'arrête |
| ⛷️ Contre toute attente | 100 | valider du premier coup un palier que ta chance annonçait en piste noire, à son départ |

### Les pistes

Chaque étape tombe une fois dans ta carrière et rapporte 50, 100 puis 200 points d'expérience (`XP_PALIER`) ; elle dit aussi ce qu'elle ouvre en chemin — un laurier, une gerbe, un fond, un thème, un légendaire (`shared/pistes.ts`). À l'écran, Le Laurier du quiz du jour se compte dans la piste du Champion du jour : une victoire, une ligne — chacun garde son expérience.

| Piste | Ce qu'elle compte | Bronze · Argent · Or | Où elle se juge |
|---|---|---|---|
| 🎟️ L'Habitué | soirées jouées (qui comptent) | 3 · 10 · 25 | à la clôture d'une soirée |
| 💬 Le Bavard | réponses envoyées en soirée | 100 · 500 · 2 000 | à la clôture |
| 📚 L'Encyclopédie | bonnes réponses en soirée | 50 · 300 · 1 000 | à la clôture |
| 🏎️ Le Réflexe | réponses réflexe en soirée | 20 · 100 · 400 | à la clôture |
| 🔮 Le Devin | estimations exactes | 3 · 10 · 25 | à la clôture |
| 🧳 Le Globe-trotteur | hôtes différents chez qui tu as joué | 2 · 4 · 8 | à la clôture |
| 🥉 L'Habitué du Podium | podiums de quiz | 3 · 15 · 50 | à la clôture |
| 🎨 Le Collectionneur | emojis différents portés en soirée | 5 · 12 · 24 | à la clôture |
| ✨ La Pluie d'Éclats | avatars éclatés, partout | 1 · 3 · 6 | à la clôture, et après un Éclat du jour ou du défi |
| 🎖️ La Légende | ton niveau | 10 · 20 · 30 | à la clôture, et au quiz du jour — pas en campagne |
| 📆 L'Assidu | jours de quiz du jour joués | 7 · 30 · 100 | au quiz du jour |
| 🌞 Le Champion du jour | victoires au quiz du jour | 1 · 5 · 20 | au quiz du jour |
| 💯 Le Sans-Faute | parties du jour sans une faute | 1 · 3 · 10 | au quiz du jour |
| 🏹 L'Élite | jours dans le premier quart d'une salle de huit | 10 · 50 · 150 | au quiz du jour |
| 🏃 L'Infatigable | ta plus longue série de jours, soirées et sabliers compris | 7 · 30 · 100 | au quiz du jour |
| 🧗 L'Alpiniste | ton record d'une série de campagne | 10 · 15 · 20 | en campagne |
| 🎓 L'Érudit | expertes trouvées en campagne, hors révisions | 25 · 100 · 300 | en campagne |
| 👟 Le Marathonien | bonnes réponses en campagne, tous modes | 250 · 1 000 · 2 000 | en campagne |
| 🧳 Le Globe-trotter | tampons au passeport de l'expédition : chaque thème pointu trouvé, une fois | 10 · 40 · 92 | au bout d'une expédition |
| 🎒 L'Explorateur | ton niveau d'explorateur : la renommée de toutes tes expéditions | 4 · 7 · 10 | au bout d'une expédition — en préproduction seulement, tant que les rencontres de l'expédition y restent |
| 🥾 Le Randonneur | paliers des sentiers validés en épreuve | 12 · 48 · 120 | en campagne |
| 🌟 La Constellation | étoiles des sentiers, la meilleure note de chaque palier | 25 · 100 · 250 | en campagne |
| 🗺️ Le Cartographe | sentiers validés en épreuve jusqu'au palier 8 ou plus haut | 3 · 6 · 12 | en campagne |

Les pistes de la clôture ne comptent que des soirées closes qui comptent — pas une soirée qui se joue encore ailleurs — et leurs étapes se rangent sous la soirée qui les fait tomber : elles ne partent qu'avec elle. Celles du quiz du jour et de la campagne se rangent sous leur jour ou leur partie, et ne se reprennent jamais. Celles des sentiers se jugent avec la campagne, à la fin d'une partie, et se rangent sur la page « Sentiers » de l'album ; un palier repris d'un ancien portrait n'y compte qu'une fois rejoué et validé.

### Le titre et la vitrine

**Ton titre**, sous ton prénom, est le nom d'un haut fait ou d'une piste que tu as gagnés (n'importe quelle étape), d'un titre de champion du mois ou de maître d'un sentier. **Ta vitrine** montre sur ta carte un à trois hauts faits gagnés, que tu choisis (`VITRINE_MAX`) ; sans choix, tes **trois plus beaux** : parmi tes exploits et l'étape la plus haute de chacune de tes pistes — ni coups du sort, ni prix —, les plus rares ([la rareté](#la-rareté)). Les deux se relisent à chaque affichage : un haut fait parti avec sa soirée les emporte.

## Les avatars légendaires

![Le Phénix, l'un des vingt-six avatars légendaires peints](../vitrine/peintures/phenix.webp)

Vingt-six avatars peints, qui prennent la place de ton emoji partout où l'on te voit. Un légendaire s'ouvre dès que **l'une de ses voies** est tenue ; « × 8 », c'est le haut fait gagné à huit soirées, jours ou parties différents. Ils ne s'achètent pas, rien ne les accélère, et ceux des soirées se méritent sur la durée : une vingtaine de quiz, au premier de la bande, pour la plupart (mesuré par `server/scripts/calibrage.ts`).

| Légendaire | Une voie | Une autre voie |
|---|---|---|
| Le Phénix | Le Phénix × 1 | Le Phénix du jour × 1 |
| Le Dragon d'Or | Le Triplé × 1 | Le Triomphe × 1 |
| L'Oracle | L'Oracle × 8 | — |
| La Chouette d'Argent | Grand Chelem × 1 | Le Sans-Faute · Argent |
| Le Tigre Foudre | La Foudre × 10 | L'Éclair du jour × 10 |
| La Licorne Astrale | Seul contre tous × 3 | Seul au monde × 3 |
| Le Lion Couronné | Le Roi de la soirée × 8 | Le Champion du jour · Or |
| Le Renard Lunaire | L'Habitué · Argent | L'Assidu · Argent |
| La Comète | Le Réflexe · Or | — |
| Le Kraken | La Lanterne Rouge × 3 | La Lanterne du jour × 3 |
| Le Fantôme | Le Somnambule × 6 | Le Courant d'air × 6 |
| Le Trou Noir | L'Estimation Cosmique × 7 | — |
| Le Sphinx | L'Assidu · Or | Le Sans-Faute · Or |
| La Citrouille | la saison d'Halloween — ou gardée au bout d'une expédition partie ces jours-là | — |
| Le Sapin | la saison de Noël — ou gardé au bout d'une expédition partie ces jours-là | — |
| Le Bouquet final | la saison du Nouvel An — ou gardé au bout d'une expédition partie ces jours-là | — |
| L'Aigle aux lauriers | Le Laurier × 30 | — |
| L'Ouroboros | L'Infatigable · Or | — |
| Le Scarabée solaire | Le Mois complet × 1 | — |
| Le Coq de l'aube | Le Lève-tôt × 20 | — |
| La Chauve-souris | Le Dernier Métro × 10 | — |
| La Salamandre | Le Funambule × 1 | — |
| L'Éléphant | Le Marathonien · Or | — |
| Le Serpent à plumes | La Grande Série × 1 | — |
| La Chimère | tout à la fois : L'Habitué du Podium · Bronze, Le Champion du jour · Bronze et L'Alpiniste · Or | — |
| Janus | tout à la fois : Le Roi de la soirée × 3 et Le Laurier × 3 | — |

Quatre sont de l'ombre — le Kraken, le Fantôme, le Trou Noir, la Chauve-souris : ils s'ouvrent par des coups du sort.

**Une voie de plus, au bout de l'Expédition** : chacun des vingt-trois légendaires qui ont leur joker — tous sauf l'Aigle, la Licorne et l'Éléphant — se gagne aussi en le gardant au bout d'une [expédition](l-expedition.md), parmi ses trois gardiens vaincus — l'album le dit, « en expédition », depuis qu'elle est ouverte. Les trois de saison depuis le 18 octobre 2026, et à leur saison seulement : ils ne gardent l'acte 3 que d'une expédition partie ces jours-là. Cette voie ne reprend rien à personne.

- **Ta progression** se lit sur la voie la plus avancée ; une voie « tout à la fois » se compte en conditions tenues (« 2 sur 3 »). Un légendaire ne s'annonce qu'une fois, même quand sa seconde voie se remplit.
- **Il se relit à chaque affichage** : une soirée retirée peut emporter le légendaire que ses hauts faits ouvraient.
- **Durcir ne reprend rien.** L'Oracle, le Tigre, le Lion, la Comète, le Fantôme et le Trou Noir demandaient moins, autrefois : chacun a gardé celui qu'il avait sous l'ancienne règle (`DURCISSEMENTS`), tant que cette règle-là tient sur son étagère.
- **Le porter** : il remplace ton emoji, qui reste dessous, et l'Éclat peut tomber sur lui. Un seul avatar dessiné à la fois — légendaire, Divin, portrait ou compagnon ; choisir un emoji l'ôte.

## Les saisons

Trois périodes de l'année, à l'heure de Paris, ouvrent chacune un légendaire (`SAISONS`, `shared/saisons.ts`) :

| Saison | Période, bornes comprises | Jours de quiz du jour | Légendaire |
|---|---|---|---|
| Halloween | du 25 octobre au 1er novembre | 3 | 🎃 La Citrouille |
| Noël | du 20 au 26 décembre | 3 | 🎄 Le Sapin |
| Le Nouvel An | du 30 décembre au 2 janvier | 2 | 🎆 Le Bouquet final |

Trois chemins, l'un ou l'autre : **le quiz du jour** — assez de jours joués dans la période, une partie commencée compte ; rangée sous ce jour, la saison ne se reprend jamais — ; **une soirée qui compte** jouée dans la période, datée à sa première question jouée : chaque profil pour qui elle compte ouvre la saison à la clôture, et la perd si la soirée est retirée ; ou, depuis le 18 octobre 2026, **une expédition partie dans la période** : le légendaire de la saison y garde l'acte 3, et se garde au bout comme les autres gardiens — même si la saison est passée entre-temps. Une saison ne se montre que par son légendaire : ni ligne sur l'étagère, ni compte de trophées.

## Les écussons de savoir

Un écusson par catégorie, douze en tout (`shared/categories.ts`) : bronze à 20 bonnes réponses, argent à 75, or à 200 (`SEUILS_ECUSSON`, `shared/ecussons.ts`). Comptent les QCM justes de la catégorie, partout : les soirées qui comptent ; le quiz du jour, sans les questions annulées ; la campagne, tous ses modes — séries, épreuves, parcours, défis, duels — sauf les révisions du carnet, qui ne reposent que ce que tu as raté. Ils se recalculent à chaque lecture, ne rapportent aucune expérience, et ne partent qu'avec les réponses qui les faisaient. Ta carte montre tes trois plus hauts ; ta page, les douze.

## La rareté

Chaque trophée de ton étagère a une rareté, **mesurée et non décrétée** : la part des profils du serveur, suspendus mis à part, qui l'ont (`rareteDe`, `shared/badges.ts`).

| Commune | Peu commune | Rare | Épique | Légendaire |
|---|---|---|---|---|
| la moitié au moins | un quart au moins | un sur dix au moins | trois sur cent au moins | moins |

Elle bouge avec la population : un trophée que tout le monde finit par décrocher redevient commun. Sous dix profils (`PROFILS_POUR_RARETE`), elle se tait — à cinq inscrits, « légendaire » ne voudrait dire que « une seule personne l'a ». Les plus beaux d'une carte se rangent, eux, sur une rareté mesurée d'avance (`PART_DES_JOUEURS`, `shared/hautsfaits.ts`) : la part des joueurs qui ont chaque haut fait, en moyenne sur quarante soirées simulées, estimée pour ceux du quiz du jour et de la campagne. L'expérience disait mal la rareté : L'Oracle paie 50, et trois joueurs sur quatre l'ont.

## Les Divins

Six avatars à part : **Hélios**, **Le Séraphin**, **Le Lotus Sacré**, **L'Arbre-Monde**, **L'Ange Déchu** et **Chronos**.

- **Leurs règles sont secrètes.** Elles vivent au serveur seul, dans `server/src/core/divins.ts`, avec leurs récits ; ni les pages de l'application ni cette documentation ne les disent. Le code des pages ne connaît que leurs noms (`shared/divins.ts`), et le récit d'un Divin ne va qu'à celui qui l'a reçu. Pas de jauge, pas de progression, pas de ligne sur l'étagère, aucun compte qui bougerait avant qu'un Divin descende. Tant qu'il n'est pas à toi, « Ma collection » le dit « Un Divin, inconnu ».
- **Ils s'annoncent.** Cinq descendent à la clôture d'une soirée : sur le téléphone de qui le reçoit, juste sous « Ce que tu gagnes », avec son récit — « Un Divin est descendu sur toi » —, et à toute la salle, qui voit son nom et celui qui le porte, jamais le récit. Chronos descend sur une partie du quiz du jour : la fin de la partie le révèle, sur ton téléphone.
- **Ce qu'ils sont.** Un avatar qui se porte comme un légendaire, une fois descendu sur toi ; ta carte montre ceux que tu as. Il a sa propre lumière : ni finition, ni Éclat, ni bordure de ligue. Aucune expérience, aucun avantage de jeu.
- **Ce qui les reprend.** Un Divin de soirée part avec sa soirée, si elle est retirée ; Chronos, rangé sous son jour, ne se reprend jamais.

## Comment c'est construit

**Des dérivations des journaux.** L'expérience, les hauts faits, les prix et les saisons d'une soirée se déduisent de ses journaux par des fonctions pures — `server/src/core/journal.ts`, `server/src/core/progress.ts`, `server/src/core/hautsfaits.ts`, `server/src/core/stats.ts`, `server/src/core/saisons.ts` —, sur les catalogues partagés de `shared/profil.ts`, `shared/hautsfaits.ts` et `shared/legendaires.ts`. Les Divins se décident au serveur seul, dans `server/src/core/divins.ts`. La soirée en cours et une archive passent par le même chemin.

**Les crédits** (`server/src/core/space.ts`, `server/src/auth/profiles.ts`). Après chaque quiz, `crediterExperience` remplace la ligne `(profil, soirée)` de `profile_xp` — jamais ajoutée : on recrédite sans payer deux fois. À la clôture, `creditDeCloture` décide tout d'un coup et `crediterCloture` l'écrit : l'expérience, les récompenses de la soirée en un lot (`remplacerRecompensesDeSoiree`), les étapes des pistes en dernier (`accorderPaliers`). Le total est la somme des lignes — celles des soirées, et les lignes à part `#paliers` (les étapes des pistes et les hauts faits hors des soirées), `#jour`, `#campagne` et `#rattrapage` ; le niveau, les finitions, les légendaires, les écussons, la rareté, le titre et la vitrine se relisent à chaque lecture. Ce que chaque étape ouvre se déduit des règles qui ouvrent chaque chose (`shared/pistes.ts`), et l'écran de la fin de chaque partie se compose de la même façon partout (`shared/gains.ts`).

**`VERSION_BAREME`.** À monter quand `XP`, `SEUILS`, un haut fait de soirée, un prix, un Divin ou une saison change : au démarrage, avant d'ouvrir le port, `recalculerHistorique` (`server/src/core/recalcul.ts`) relit chaque archive, remplace son expérience et ses récompenses, puis juge les pistes des profils touchés. La version s'écrit en entier (`CAST(? AS INTEGER)`), et une base injoignable pendant la relecture fait échouer le démarrage plutôt que de passer des archives pour illisibles. Le quiz du jour et la campagne ont leurs versions (`VERSION_DES_JOURS`, `VERSION_DES_SERIES`), le barème du solo un drapeau (`server/src/core/baremeDuSolo.ts`).

**Durcir sans rien reprendre.** Une entrée de plus à `DURCISSEMENTS` (un légendaire) ou à `COURBES_D_AVANT` (la courbe), sous un drapeau neuf — jamais une entrée modifiée : au démarrage, chacun retient ce qu'il avait (`profile_legendaires`, `profile_niveaux`). Et tout niveau d'un profil passe par `niveauDuProfil` (`shared/profil.ts`) : un calcul oublié sur la seule courbe du jour, et une page afficherait un autre niveau que sa voisine.

**Le calibrage.** `cd server && npx tsx scripts/calibrage.ts` fait jouer des bandes d'amis inventées, soirée après soirée, sur le vrai code : les quiz qu'il faut pour chaque légendaire, les soirées pour chaque niveau, la rareté que `PART_DES_JOUEURS` recopie. Il ne simule que des soirées ; son format se règle (`--quiz`, `--questions`, `--joueurs`, `--soirees`…).

Les gardiens : `server/test/experience.test.ts`, `server/test/hautsfaits.test.ts`, `server/test/legendaires.test.ts`, `server/test/recalcul.test.ts` et `server/test/divins.test.ts`, qui garde aussi leur secret. Le détail des tables et du recalcul : [les données](../architecture/donnees.md) ; ajouter un haut fait, durcir un légendaire : [les recettes](../contribuer/recettes.md).

## Pour aller plus loin

- [Les barèmes](../reference/baremes.md) — chaque valeur de cette page, sa constante et ce que la changer implique
- [Après la soirée](apres-la-soiree.md) — la clôture, la fin de soirée et ce qu'elle annonce, les prix du palmarès
- [Le quiz du jour](le-quiz-du-jour.md), [la campagne](la-campagne.md), [les sentiers du savoir](les-sentiers-du-savoir.md), [les duels](les-duels.md) — l'expérience et les récompenses de chaque mode
- [Le profil](le-profil.md) — la collection, la loge, la carte, l'allure des avatars et des finitions
- [Les décisions](../architecture/decisions.md) — pourquoi l'expérience se mérite, pourquoi les Divins se taisent
