# Contre-expertise — `cabinet-triche` (le Cabinet : triche, horloges, requêtes forgées)

Rapport relu : `export/evaluations/rapports/cabinet-triche.md` et `.json` (5 constats : 0 P1, 2 P2, 3 P3). Chaque reproduction relancée seule sous `nice -n 10` (charge 0,3 à 0,6), sur le code de HEAD `3034028`, sans rien laisser allumé ; aucun fichier suivi par git modifié. Mes propres épreuves : `export/evaluations/verification/cabinet-triche/`.

| Constat | Gravité annoncée | Verdict | Gravité retenue | En une ligne |
|---|---|---|---|---|
| 1. La pause de « Quitter ? » donne 30 s par manche sans rien marquer | P2 | **confirmé** | P2 | Rejoué (4 échecs, pour la raison dite). Le cœur n'est pas le voile : la question était à l'écran avant « Quitter », et le dialogue annonce « Le chrono t'attend 30 secondes au plus ». La piste (a) seule ne ferme rien et casse l'envoi à l'échéance sous la pause |
| 2. Les leurres du Détail désignent la bonne réponse | P2 | **confirmé** | P2 | Script rejoué, mêmes chiffres. Mais la correction proposée laisse une seconde fuite, plus forte : le tireur prend le tableau jamais vu, et un joueur qui se souvient des tableaux déjà nommés en réponse monte à 46 % puis 78 % sans l'image, fenêtre ou pas |
| 3. Ce que révèlent l'Éclair, le Détail et la frise d'un sujet reste « jamais vu » pour la campagne | P3 | **confirmé** | P3 | Rejoué. La décision écrite (« sans danger, la série ne reprend pas ce que l'Éclair a récrit ») part d'une prémisse fausse : l'Éclair montre l'intitulé même de la base, et sa révélation dit `bonne` |
| 4. L'œuvre visée d'une case manquée se lit dans l'ordre des refus | P3 | **confirmé** | P3 | Rejoué. Mais la correction proposée (la carte-bonus jugée d'abord) ne ferme pas l'oracle : sans carte, les autres candidates se refusent et l'œuvre visée seule part. Elle coûte alors une chasse, celle qu'il voulait de toute façon dépenser |
| 5. Quitter d'emblée : 30 poussières par jour, le Scarabée en 30 jours | P3 | **tension** | P3 | Coup d'œil : c'est la règle écrite (`le-cabinet.md:92`, `:111`) ; le banc mesure, il ne prouve pas un défaut |

**Compte** : 4 confirmés, dont 2 avec une correction à revoir ; 0 réfuté ; 0 rétrogradé ; 1 tension. Pas de doublon : `cabinet-equilibre-8` (le Détail en loterie, 25 % au hasard) cite le constat 2 comme son complément, il ne le redit pas ; `cabinet-equilibre` laisse à ce rapport le Scarabée et la poussière gagnée en quittant (le constat 5) ; rien dans `retours/2026-09-2*/` ni `retours/2026-10-24/`, d'avant le Cabinet ou de sa conception.

Le Cabinet est fermé en production (`CABINET_EN_PRODUCTION = false`, `shared/cabinet/ouverture.ts:17`) : aujourd'hui, personne ne vit ces constats. La gravité dit ce qu'ils feraient au jour de l'ouverture, en préproduction d'abord.

---

## 1. La pause de « Quitter ? » — confirmé, P2

**La reproduction.** `pause-sous-le-voile.test.ts` : quatre échecs, chacun pour la raison qu'il annonce :
- la vue de la pause porte `enCours` (`{ jeu: 'replique', etape: 1, avant: "C'est à moi que tu", apres: ' ?', mots: [4] }`) ;
- le mot choisi 54 s après l'ouverture d'une Réplique passe, il vaut ★★★ et sa pièce garde `joker` NULL. Le même geste sans pause rend 400 « Le temps de cette manche est écoulé » ;
- au pli, trois manches répondues 29 s après leur durée finissent sous la pause en `aidee false, cadre doré true`, sous le Tigre en `aidee true, cadre doré false` ;
- la chasse à la Cagnotte, sous trois pauses, finit `gagnee-doree`.

Les épreuves 2 à 4 n'ont rien de forgé : elles n'envoient que `pause` puis `reprendre`, ce que la vraie page envoie à « Quitter » puis à « Continuer » (`Partie.tsx:780`, `:797`). Seule la première regarde la charge de la vue, que la page ne dessine pas.

**Le chemin du code.** `jouerUnGeste` (`shared/cabinet/partie.ts:524-540`) ouvre la pause. `echeanceDe` (`chrono.ts:70`) recule l'échéance de toute la pause comptée, jusqu'à 30 s, partagées entre les étapes. `marquerLeTemps` (`partie.ts:355-358`) ne marque que sous la carte `temps`, pause comprise, et `resultatDe` (`:690-691`) ne lit pas la pause. Aucune garde en amont. L'expert cite `vue.ts:256` ; la ligne qui joint `enCours` est `vue.ts:259`, sans conséquence.

**La réalité, ce que l'expert sous-estime.** Pas besoin d'outils : la manche est à l'écran jusqu'à « Quitter ». Qui l'a lue la retient (une réplique et quatre mots, une affirmation, un titre) et cherche ailleurs pendant la pause. Le dialogue le lui annonce lui-même : « Le chrono t'attend 30 secondes au plus, la manche cachée » (`messageDuQuitter`, `Partie.tsx:205`). La tablée l'a lu et vécu (`export/tablee/2026-10-25-22h07/retours/theo.md:24`, `ophelie.md:26` : « Le chrono se met en pause pendant que je réfléchis »). Cela contredit l'intention écrite : la pause « ne vend pas le temps que « Prendre son temps » vend » (`decisions.md:1834`), et « rien ne se gagne à hésiter sur « Quitter ? » » (`:1732`). Gravité P2 : à portée de tout joueur. Les enjeux restent le musée du joueur, plus la première question du Pari comptée nue à la mesure partagée.

Une nuance : « la pause fait mieux que la carte » est vrai de la marque, pas du temps. Sur une page honnête, les 30 s de pause sont du temps sans la question sous les yeux, partagé entre les deux étapes ; le Tigre donne 30 s par étape, la question visible.

**La correction.** C'est la piste (b), un choix de produit. La piste (a), seule, ne ferme presque rien, et telle qu'elle est écrite elle casse un comportement voulu :
- **(a) casse l'envoi à l'échéance sous la pause.** La page envoie d'elle-même la réponse qu'elle tient à l'échéance, même sous la pause, à partir de la vue courante : `const { rang, manche, enCours } = vue` puis `if (… || !enCours) return` (`Partie.tsx:740-744`). Si la vue de la pause n'a plus `enCours`, rien ne part. L'épingle posée à l'heure retombe alors à « rien », ce que la relecture du lot B3 a corrigé (`decisions.md:1732`). Si on garde (a), la page doit garder le dernier `enCours` dans une référence ; un rechargement sous la pause envoie alors la réponse vide, que le serveur juge sur ce qu'il savait.
- **(a) ne sert à rien au Détail.** La route d'un cadrage refusée sous la pause ne cache rien : le cadrage atteint est déjà à l'écran, et le téléphone le garde un jour (`private, max-age=86400`).
- **La voie la plus simple : borner la pause** au temps de lire la confirmation, quelques secondes (`PAUSE_MAX_MS`). Le chiffre est figé au départ (`d.chrono.pauseMs`), donc aucune version à monter. La phrase « Le chrono t'attend … au plus » le dira d'elle-même.
- **L'autre voie : la pause qui fait gagner du temps se marque.** Une réponse qui n'est à l'heure que par la pause, au-delà d'une petite franchise, rend la pièce aidée. Il faut une marque à elle, pas `JOKER_DU_TEMPS` : `joker` porte un pouvoir, et la pause n'en est pas un. Le pli juge cette règle : elle monte `VERSIONS_DU_DEPART`. Une fois la pause bornée ou marquée, (a) devient superflu.

## 2. Les leurres du Détail — confirmé, P2 ; la correction proposée ne suffit pas

**La reproduction.** `detail-par-les-voisins.ts`, relancé : mêmes chiffres, à la décimale (1 000 propositions, la bonne passe toujours le test, 23,9 % résolues d'un coup, 52,1 % au hasard parmi celles qui passent, 41,2 % « au centre »). Le script recopie fidèlement la règle de `detailTire` (`shared/cabinet/jeux/detail.ts:118-127` : tri par écart d'années puis par QID, cinq voisins, trois leurres battus). Il la calcule sur les cent tableaux, ce qui vaut pour la première manche. Aux suivantes, `libres` écarte le tableau déjà posé (`tirages/detail.ts:34`), mais le joueur le sait par la révélation et recalcule. Les probabilités de chasse (53 %, 14 %) sont la loi binomiale de 52,1 %, juste.

**Le chemin du code.** Aucune garde. La page reçoit les quatre titres et leurs peintres, sans les années (`DetailMontre`), et la révélation dit l'année de la bonne seulement (`DetailRevele.tableau.annee`). Cartographier le catalogue demande donc une centaine de révélations, une trentaine de parties libres, à trente départs par heure au plus, ou Wikidata.

**Ce que la correction proposée laisse passer, mesuré.** Le tireur prend le tableau **jamais vu d'abord** (`laMoinsVue`, `tirages/detail.ts:38`, `tirageALaPiece.ts:281-293`), et seule la bonne s'écrit vue (`cab:tableau:<QID>`). Les leurres, eux, se prennent parmi les voisins, vus ou non. Tant que le catalogue n'est pas épuisé, un titre qu'une révélation a déjà nommé comme bonne réponse ne peut donc pas l'être. Un joueur qui s'en souvient l'écarte, sans catalogue ni années, et c'est une inférence que l'on fait sans y penser. `verification/cabinet-triche/detail-jamais-vu.ts` (sortie dans `.txt`) joue 400 joueurs × 33 parties libres du Détail avec le vrai `detailTire` et les tableaux livrés :

| Règle du tirage | Stratégie | Parties 1-11 | 12-22 | 23-33 |
|---|---|---|---|---|
| d'aujourd'hui | au hasard | 25,2 % | 24,9 % | 25,3 % |
| d'aujourd'hui | se souvenir des tableaux nommés | 29,7 % | 46,5 % | **78,0 %** |
| d'aujourd'hui | se souvenir + voisins (le constat) | 55,5 % | 71,3 % | 88,6 % |
| fenêtre consécutive (la piste de l'expert) | se souvenir | 29,5 % | 46,3 % | **77,6 %** |
| fenêtre consécutive **parmi les tableaux du même statut** que la bonne | se souvenir | 24,9 % | 25,4 % | 24,9 % |

La fenêtre ferme la fuite par les années, pas celle par la fraîcheur. La mémoire est ici parfaite ; une mémoire partielle donne entre les deux. Le constat est réel et la gravité tient : à portée d'un joueur régulier du Détail, sur ses neuf œuvres et leurs dorures. Une précision sur le texte du rapport : ce n'est pas l'invariant 1. Rien de ce qui juge ne part avant le verdict ; c'est un défaut du tirage des leurres.

**La correction.** Garder la fenêtre consécutive dans l'ordre des années, mais la prendre parmi les tableaux du même statut de fraîcheur que la bonne : des jamais vus avec un jamais vu, des tableaux vus avec un vu, tant qu'il y en a quatre. Le script retombe alors à 25 %. Il reste une petite fuite en fin de cycle, quand il reste moins de quatre jamais vus. Le plan figé garde ses titres : aucune version. Rejouer les deux scripts sur la règle neuve.

## 3. L'Éclair, le Détail, la frise d'un sujet hors des vues de la campagne — confirmé, P3

**La reproduction.** `eclair-hors-des-vues.test.ts` échoue pour la raison dite : `journal.vuesDe('qui').vues` ne contient que le composé `cab:eclair:mot00004+fil00005+cab02007+fil00004+cab02002`. L'épreuve passe par `m.cabinet.commencer` et `geste`, ce que la route appelle. Elle lit `journal.vuesDe`, ce que lit le duel classé.

**Le chemin du code.** `creerUnDuel` lit `journal.vuesDe(profileId).vues`, fusionne celles de l'adversaire (`core/campagne.ts:4057-4058`), puis tire jamais vu d'abord (`tirage(…).tirer(vues, …)`, `:4064-4065`). `vuesDe` (`journalDesReponses.ts:561-570`) ne déplie rien. Seul le Cabinet déplie (`vuesDuCabinet`, `magasin.ts:693`). Aucune garde ailleurs.

**La réalité.** La décision écrite (`decisions.md:1685-1687`) part d'une prémisse fausse : « sans danger, la série ne reprend pas ce que l'Éclair a récrit ». L'Éclair montre l'intitulé même de la question de la base (`montrer` : `texte: a.question.texte`, `eclair.ts:155`), et sa révélation dit la bonne réponse (`bonne`, `:166`). Le tireur de l'Éclair prend d'abord ce qui est jamais vu, campagne comprise : il consomme précisément le réservoir où le duel puise en premier. L'avantage est diffus : la part de la base qu'il a vue à l'Éclair, de l'ordre de quelques pour cent pour un joueur assidu, revient comme neuve dans un duel classé. Il n'est pas ciblé, et le Cabinet est fermé en production. P3 tient.

**La correction.** La piste tient. Je la précise : déplier dans `vuesDe` pour `vues` seulement, c'est-à-dire la fraîcheur, le duel, la série et le dé, et jamais pour `premieres`. Une manche de l'Éclair n'est la première réponse d'aucune de ses cinq questions. Le Détail se déplie au serveur par `tableau.questions` (`tableauxDuDetail`, `core/details.ts`), pas par `deplier`, qui est pur et ne connaît pas les tableaux. Le volet « mesure », c'est-à-dire la première réponse de campagne d'après comptée nue, est secondaire et plus délicat : il touche `premieresJustesDe` et sa comparaison au SQL dans `journal-des-reponses.test.ts`. La décision `decisions.md:1685-1687` se récrit dans le même commit.

## 4. « Retenter », l'oracle de la case manquée — confirmé, P3 ; la correction proposée ne suffit pas

**La reproduction.** `retente-oracle.test.ts` échoue pour la raison dite : une seule candidate rend « Tu n'as pas cette carte-bonus », c'est l'œuvre visée (`parade` à ce tirage), et rien n'est dépensé. `cadreDuDepart` (`shared/cabinet/musee.ts:473-475`) juge « Retenter » avant la carte (`:492`) : c'est confirmé.

**Ce que la correction proposée laisse passer.** `verification/cabinet-triche/retente-sans-carte.test.ts` passe aujourd'hui, et passerait encore avec la carte jugée d'abord. Sans carte-bonus, les candidates qui ne sont pas visées se refusent sans rien coûter, et l'œuvre visée seule part : `[["lucidite",400,"Retenter ne sert qu'après…"],["augure",400,…],["presage",200,"partie"]]`, chasses 2 → 1. L'oracle coûte alors une chasse, celle que le joueur voulait justement dépenser à retenter. L'autre variante proposée, un même refus pour « pas cette œuvre » et « pas manquée aujourd'hui », ne change rien : la bonne n'est pas refusée, elle part. L'enjeu reste mince, la surprise de l'œuvre et le jeu de la visite pour la chasse : P3.

**La correction.** « Retenter » vise la case, pas l'œuvre : `{ origine: 'chasse', case: k, retente: true }`. Le serveur trouve la cible dans la visite figée, et la vue de la chasse ne dit que la rareté et la salle, comme `enJeuDuDepart` le fait déjà pour la visite (`vue.ts:99-104`). Une demande « Retenter » qui nomme une œuvre se refuse pour toutes dans les mêmes mots. C'est aussi ce qui permettrait enfin à la page de proposer « Retenter », comme le voulait la proposition (« Après un échec en visite, « Retenter cette œuvre au même jeu » coûte une chasse », `retours/2026-10-24/le-cabinet.md:103`) et comme la règle l'attend (« tant que la demande ne vise pas une case », `cabinet.md`). L'épreuve : `retente-sans-carte.test.ts`, retourné, en plus de celle de l'expert.

## 5. Quitter d'emblée, la poussière et le Scarabée — tension, P3 (coup d'œil)

`quitter-d-emblee.test.ts` passe, et il est écrit pour mesurer : 30 poussières, série de 30 jours, Scarabée réveillé. La documentation le dit en toutes lettres : « La série : les jours d'affilée avec une partie de visite ou de chasse », et « Le Scarabée : trente jours de visite ou de chasse d'affilée » (`docs/produit/le-cabinet.md:92`, `:111`). C'est donc la règle. Elle récompense le fait de revenir trente jours de suite, comme toute série d'assiduité, et « personne ne gagne un gardien sans le mériter » est un principe de la mission, pas un parti pris de `vue-d-ensemble.md`. Tension à arbitrer, bien qualifiée par l'expert. Si on la tranche, la piste tient : compter le jour d'une partie qui a tranché au moins une manche par une réponse (au bilan, une pièce dont `choix` n'est pas NULL). La part de la poussière relève de `cabinet-equilibre`.

---

## Ce que j'ai lancé

- `cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../export/evaluations/cabinet-triche/pause-sous-le-voile.test.ts` : 4 échecs, raisons dites.
- `… ../export/evaluations/cabinet-triche/eclair-hors-des-vues.test.ts` : 1 échec, raison dite.
- `… ../export/evaluations/cabinet-triche/retente-oracle.test.ts` : 1 échec, raison dite.
- `… ../export/evaluations/cabinet-triche/quitter-d-emblee.test.ts` : passe (mesure).
- `node --import tsx ../export/evaluations/cabinet-triche/detail-par-les-voisins.ts` : mêmes chiffres que `.txt`.
- Mes épreuves : `verification/cabinet-triche/detail-jamais-vu.ts` (sortie dans `detail-jamais-vu.txt`) ; `verification/cabinet-triche/retente-sans-carte.test.ts`, qui passe : l'oracle tient sans carte.

Non relancés : `pli-au-hasard.test.ts` et `gestes-forges.test.ts`, qui passent et disent ce qui tient, pas des constats. Rien n'est resté allumé, et `git status` est vide.
