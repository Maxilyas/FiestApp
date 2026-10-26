# Contre-expertise — `cabinet-code` (le Cabinet : la tenue du code)

Rapport relu : `export/evaluations/rapports/cabinet-code.md` et `.json` (15 constats : 0 P1, 0 P2, 15 P3). Code de HEAD `3034028`. Les deux reproductions de l'expert ont été relancées seules sous `nice -n 10` (charge 0,02 à 0,17). J'ai écrit une reproduction à moi (`export/evaluations/verification/cabinet-code/libre-ratee.test.ts`) et rejoué le mutant du constat 11 sur toute la suite qui lit `Partie.tsx`, dans une copie jetable du dépôt, effacée ensuite. Aucun fichier suivi par git n'est modifié (`git status` vide) et rien n'est resté allumé.

Selon les consignes, un seul constat demandait une relecture complète : le 2, seul P3 de nature `bug`. Je l'ai fait. Les quatorze autres (friction, test, tension) ont eu plus qu'un coup d'œil : chaque `fichier:ligne` a été relu, et les affirmations qu'on peut vérifier (sans appelant, jamais posé, mutant qui survit) ont été recomptées.

| Constat | Gravité annoncée | Verdict | Gravité retenue | En une ligne |
|---|---|---|---|---|
| 1. La règle `cabinet.md` se coupe à la ligne 69 en lecture directe | P3 | **confirmé** | P3 | Rejoué : « PARTIAL view — lines 1-69 of 101 (30861 tokens, cap 25000) ». Mais l'outil le dit et donne la suite (`offset=70`), et la règle arrivée par ses `paths:` arrive entière. Le défaut touche aussi `expedition.md`, `qg.md` et `profil.md`. La borne proposée (50 000) ferait rougir quatre règles d'un coup |
| 2. Le bilan d'une libre qui paie, sans étoile, dit « les cinq ont payé » | P3 | **doublon** (confirmé) | P3 | Rejoué, et rejoué aussi par un vrai chemin (trois manches ratées, pas « Quitter ») : la page d'après dit « encore 4 sur 5 ». C'est le même défaut que `cabinet-equilibre-6`, même ligne, même piste |
| 3. 58 renvois à « la conception », absente du dépôt | P3 | **confirmé** | P3 | Le document existe, mais seulement dans le bloc-notes de session de l'orchestrateur (`/tmp/…/scratchpad/conception/FINALE.md`), volatil. Ses D1 à D18 ont chacun leur titre dans `decisions.md` : la correction est mécanique |
| 4. `AnnonceEnAttente` et les registres `Partial` sont du code mort | P3 | **confirmé** | P3 | Elle ne sert même pas de repli à une page périmée face à un serveur neuf : `JEUX[jeu].nom` lèverait avant elle (`CabinetApp.tsx:198`, `Visite.tsx:64`) |
| 5. `statsEnPlus` jamais posé ; la page produit affirme L'Explorateur relu aux salles | P3 | **confirmé** | P3 | `git grep "statsEnPlus ="` : trois affectations, toutes dans `porte-de-la-campagne.test.ts` ; `ChampsDuCabinet = never` |
| 6. La page produit décrit le Cabinet en construction | P3 | **confirmé** | P3 | `le-cabinet.md:158` et `:186` relus ; `JEUX_PRETS` compte les neuf |
| 7. Les trois étoiles écrites en dur | P3 | **confirmé** | P3 | Relu. `baremes.md:659` dit déjà la constante « Structurel » : la seconde piste (une forme, typée `3`) est la bonne |
| 8. La page redérive ce que le serveur sait ; des refus en double | P3 | **confirmé** | P3 | Relu ligne à ligne. Aucun ne ment aujourd'hui |
| 9. `POUVOIR_DES_GARDIENS` récrit des pouvoirs qui se dérivent | P3 | **tension** | P3 | La table est écrite exprès (son commentaire : « Une table écrite, que le test relit contre les familles »), et `cabinet-catalogue.test.ts:298-303` tient les copies ensemble. Seule la double écriture des cinq « autres » dans le même fichier est une vraie redite |
| 10. Des outils recopiés, `leGardien` et `motsDe` déjà divergents | P3 | **confirmé** | P3 | Relu : `contenu.ts:90-95` n'ouvre que œ et æ, `indices.ts:79-103` ouvre aussi ł, ø, ß… Les deux restent latents |
| 11. L'envoi à l'échéance n'est gardé que par son texte | P3 | **confirmé** | P3 | Plus fort qu'annoncé : le mutant passe les quatre fichiers qui lisent `Partie.tsx` (137 épreuves, 0 échec), pas seulement l'épreuve citée |
| 12. `CabinetApp`, `Partie`, la boucle du magasin cinq fois | P3 | **confirmé** | P3 | Dette réelle. Mais l'écriture de `magasin.ts:498` n'a rien d'une course : un comparer-et-poser (`WHERE partie = ?`), dit dans la règle |
| 13. Un drapeau toujours vrai, deux fonctions sans appelant, la migration citée | P3 | **confirmé** | P3 | `git grep` : `qcmDeToutes`, `jeuDeLOeuvre` et `EXPEDITION_ENCORE_LUE` ne vivent que dans leur fichier |
| 14. `fondreLesReveils` éprouvé trois fois | P3 | **confirmé** | P3 | `cabinet-ecran.test.ts:3217-3223`, `:3240`, `:3287-3317` ; la même expression régulière d'import à `:3240` et `:3291` |
| 15. Trois règles tenues en SQL et en mémoire | P3 | **tension** | P3 | Comme annoncé |

**Compte** : 12 confirmés, 0 réfuté, 0 rétrogradé, 2 tensions (dont le 9, requalifié de friction en tension), 1 doublon confirmé (le 2, de `cabinet-equilibre-6`). Les seules gravités discutables sont des P3, et je n'en ai changé aucune. Recoupement partiel sans doublon : le 8 cite `Annonce.tsx:53` comme `cabinet-equilibre-10`, mais pas pour le même défaut (ici le seuil redérivé, là le seuil du double tu). Rien dans `retours/2026-09-2*/`, qui précède le Cabinet.

Le Cabinet est fermé en production (`CABINET_EN_PRODUCTION = false`, `shared/cabinet/ouverture.ts:17`) : aujourd'hui, personne ne voit la phrase fausse du constat 2 hors préproduction.

---

## 1. La règle coupée — confirmé, P3, à nuancer

**Rejoué.** Un `Read` sans offset de `.claude/rules/cabinet.md` rend les lignes 1 à 69 et finit sur : « PARTIAL view — showing lines 1-69 of 101 total (30861 tokens, cap 25000). Call Read with offset=70 limit=69 for the next page… Do NOT answer from this page alone ». Le chiffre est exact. Les tailles, au signe près : 66 240 signes pour 68 254 octets (le rapport donne des octets sous le nom de signes). Les lignes 70 à 101 font 37 622 signes. Les lignes 48 et 87 dépassent 4 000 signes.

**Ce qui le tempère.**
- La coupe n'est pas muette. L'outil donne la page suivante et interdit de conclure sur la première. Un agent ne perd les pièges que s'il ignore cet avertissement : la friction tient, mais « perd 39 000 signes » est trop fort.
- La règle chargée par ses `paths:` arrive entière. Dans cette session, la lecture de `server/src/core/cabinet/vue.ts` l'a apportée jusqu'à sa dernière ligne (« Le catalogue recopie les rencontres »). La limite que l'expert n'avait pas pu vérifier est levée : seule la lecture directe que `CLAUDE.md` demande « pour un domaine sans fichier ouvert » coupe.
- Le défaut n'est pas propre au Cabinet. Quatre règles dépassent le plafond : `expedition.md` (131 207 signes), `qg.md` (77 170), `cabinet.md` (66 240), `profil.md` (63 765). `campagne.md` (49 468) est juste en dessous.

**La correction.** Couper la règle tient. Mais la borne proposée, `texte.length <= 50_000` sur chaque règle, ferait rougir `notes-pour-claude.test.ts` sur quatre règles le jour même. Il faut couper les quatre dans le même commit, ou poser d'abord la borne au plafond réel de lecture (environ 25 000 jetons, soit à peu près 53 000 signes au rapport de 2,15 signes par jeton mesuré ici), avec une liste d'exceptions à vider. Ce qui coûte le moins tout de suite : une ligne dans `CLAUDE.md`, « Comment travailler ici », qui dit qu'une règle lue directement peut se lire en deux pages, `offset` compris.

## 2. La libre qui paie, finie sans étoile — doublon de `cabinet-equilibre-6`, confirmé, P3

**La reproduction de l'expert** (`libre-sans-etoile.test.ts`) échoue pour la raison annoncée : `bilan.dit` = « Les cinq parties libres du jour ont payé : celle-ci se joue pour le plaisir ». Elle passe par les vraies routes (`commencer`, puis `jouer` avec `{ quoi: 'quitter' }`), ce que la page envoie.

**Ma reproduction** (`export/evaluations/verification/cabinet-code/libre-ratee.test.ts`) écarte le soupçon d'un cas propre à « Quitter ». Une libre du Pari, la première du jour, jouée jusqu'au bout avec trois manches ratées : `departEnBase(...).payee === true`, `bilan.quittee` absent, `total 0`, `poussiere 0`. Le bilan dit pourtant que les cinq ont payé, et la page d'après répond `libres.paientEncore === 4`. L'épreuve échoue sur : « le bilan dit : « Les cinq parties libres du jour ont payé… », la page : encore 4 ».

**Le chemin du code.** `ecriture.ts:104` fige `payee` dans le départ, par la base. `poussiereDeLaPartie` (`shared/cabinet/partie.ts:745-747`) rend `2 × total` en libre, donc 0 sans étoile, sans plancher. `bilanDit` (`server/src/core/cabinet/vue.ts:178-179`) choisit sa phrase sur `b.poussiere > 0` au lieu de `d.payee`. `Bilan.tsx:139` l'affiche telle quelle. Aucune garde ailleurs. Hugo l'a vécu à la tablée (`export/tablee/2026-10-25-22h07/retours/hugo.md:82`), et la base de la tablée compte 52 libres sur 80 finies à zéro étoile (chiffre de `cabinet-equilibre`) : ce n'est pas un cas rare.

**Gravité.** P3 : une phrase fausse, sans rien perdre. La poussière et le compte des cinq sont justes, seule la phrase ment. Il peut toutefois ne pas rejouer en croyant ses libres épuisées.

**Doublon.** `cabinet-equilibre-6` (rapport rendu à 00:17, celui-ci à 00:27) : même ligne, même cause, même piste. L'expert du code ne l'a pas vu : il dit n'avoir lu que `cabinet-triche` et `cabinet-sobriete`. Sa part propre se limite au « cinq » écrit en dur à côté de `LIBRES_QUI_PAIENT`.

**La correction.** Celle de l'expert tient. J'y ajouterais deux choses. D'abord, dire ce qui reste quand la partie a payé sans rien rapporter (« Aucune étoile cette fois : pas de poussière d'or. Encore 4 parties libres qui paient aujourd'hui »), ce qui suppose de passer `libresQuiPaientEncore` du musée à `bilanVu`. Ensuite, garder la phrase « … ont payé » en lettres, comme la page se présente (`Regles.tsx:127` le fait pour « neuf jeux »), ou en chiffres comme `Regles.tsx:107` (« les 5 premières parties libres ») : l'une ou l'autre, pourvu que les deux écrans disent pareil. Les deux reproductions deviennent l'épreuve de `cabinet-poussiere.test.ts`.

## 3. Les renvois à « la conception » — confirmé, P3

`git grep` sur le code du Cabinet compte 59 lignes : 34 « § », 22 « Dn » et le reste. La règle cite deux fois « (D9) », et les tests aussi (`cabinet-poussiere.test.ts:10`, « D15 »). Les nombres de l'expert tiennent.

Il a manqué une chose, qui rend le constat plus net : le document existe, mais hors du dépôt, dans le bloc-notes de session de l'orchestrateur, `/tmp/claude-0/…/scratchpad/conception/FINALE.md` (193 Ko, « Le Cabinet de curiosités — la conception finale »). On y trouve tous les renvois : « § 0.2 » à « § 10.1 », « D1 » à « D18 » (`FINALE.md:29-51`), « l'étape 5 » (`:1722`). Les renvois ne sont donc pas inventés, mais leur cible vit dans `/tmp` et disparaîtra avec la session. Le « D12 » de `porteDeLaCampagne.ts:2` est réel (« Le Cabinet vit hors de `core/campagne.ts`… »). C'est l'adresse donnée, `decisions.md`, qui le trompe : `decisions.md` ne numérote rien.

**Une meilleure correction.** Les décisions D1 à D18 ont chacune leur titre dans `docs/architecture/decisions.md:1597-1825`. Il suffit donc d'une table de passage, appliquée mécaniquement :

| D | Titre dans `decisions.md` |
|---|---|
| D2 | L'état d'une partie est le pli de son départ et de ses gestes, et chaque geste s'écrit avant sa réponse |
| D3 | Une pièce par verdict, juste dès deux étoiles naturelles |
| D4 | Seule la première réponse du Pari, nue, mesure le savoir |
| D6 | La colonne `joker` porte un pouvoir, jamais la clé d'une carte |
| D7 | Trois tables neuves, et aucune lecture qui grandisse avec l'histoire |
| D8 | La poussière gagnée se fige dans le bilan ; un achat vérifie le solde dans son instruction même |
| D9 | Chaque lot d'écriture est gardé par son geste |
| D10 | Recharger reprend la partie ; Quitter la compte, après une pause bornée et voilée |
| D12 | Le Cabinet vit hors de la campagne, derrière une porte étroite ; un module pur par jeu |
| D15 | La poussière d'or, monnaie propre au Cabinet, n'en sort jamais (et les trois autres choix du propriétaire) |
| D17 | La visite du jour se dérive, puis se fige au premier départ |

Ce sont les seuls D cités. Les « § n.n » et les « lot X » n'ont pas d'équivalent dans le dépôt : ils s'effacent. Le commentaire voisin dit déjà le pourquoi, comme l'expert l'a noté. Une autre voie : verser `FINALE.md` dans `retours/2026-10-24/`, à côté de la proposition. Mais 193 Ko de conception, dont la migration abandonnée (§ 6, D14), y vieilliraient mal.

## 4. `AnnonceEnAttente` et les `Partial` — confirmé, P3

Relu : `Partie.tsx:150-160` et `tirages/index.ts:67-77` ont chacun neuf entrées, et `JEUX_PRETS` (`ouverture.ts:36`) les neuf jeux. Le commentaire de `Partie.tsx:144-148` justifie le `Partial` par un cas : « le serveur peut en livrer un avant que la page n'ait le sien ». J'ai cherché si ce repli servait encore à une page restée ouverte pendant une mise en ligne. Ce n'est pas le cas. Un dixième jeu serait une clé que la vieille page ne connaît pas, et `JEUX[jeu]` y vaut `undefined` : la visite lèverait d'abord à `Visite.tsx:64`, et `AnnonceEnAttente` elle-même à `CabinetApp.tsx:198` (`j.nom`). Le repli ne protège donc rien, et le `Partial` ôte bien au compilateur la garde d'un dixième jeu. La piste de l'expert tient : `Record<CleDeJeu, …>`, et `JEUX_PRETS` pour drapeau. `REGLES` est déjà exhaustif.

## 5. `statsEnPlus` — confirmé, P3

`git grep -n "statsEnPlus\s*="` ne trouve que trois affectations, toutes dans `server/test/porte-de-la-campagne.test.ts` (`:373`, `:559`, `:578`). `ChampsDuCabinet = never` (`porteDeLaCampagne.ts:164`), et son commentaire dit lui-même « aucun encore… y entreront quand ». `docs/produit/le-cabinet.md:152` écrit au présent « ses paliers relus aux salles complètes ». Le constat est exact. La conception le range « après l'ouverture » (`FINALE.md`, § 6.4, lot C9). Mieux vaut donc corriger la page au futur et garder le crochet, éprouvé, que de l'arracher puis le refaire au lot C9 : c'est un choix, et les deux pistes de l'expert se valent.

## 6. La page produit d'avant-hier — confirmé, P3

`le-cabinet.md:186` (« Le Pari et l'Éclair s'y jouent ; un jeu qui n'a pas encore son écran s'annonce en attente ») et `:158` (« La construction : … le Pari et l'Éclair d'abord ») relus. Les deux sont faux au commit relu.

## 7. Les trois étoiles en dur — confirmé, P3

Les lignes citées sont relues (`pouvoirs.ts:210`, `:226-227` ; `partie.ts:667` ; `outils.ts:49` ; `regle.ts:229`, `naturel: 0 | 1 | 2 | 3`). Ce n'est pas un piège retombé au sens strict : `docs/reference/baremes.md:659` qualifie déjà `ETOILES_PAR_MANCHE` de « Structurel : chaque barème de jeu dit ce qui vaut ★★★, ★★ et ★ ». La documentation sait que ce chiffre est une forme, et c'est le code qui ne le dit pas. La seconde piste de l'expert s'impose : `ETOILES_PAR_MANCHE: 3`, typé, lu aux endroits qui écrivent 3. Elle ne promet aucune liberté que le typage refuse.

## 8. La page redérive, et les refus en double — confirmé, P3

Relus : `Annonce.tsx:53` (le seuil relu par `SEUILS_DES_RARETES[rarete]`, même règle que `seuilDe`, `musee.ts:417`) ; `Partie.tsx:370` (`refusDuPouvoir` sur `servi: 0, aJoue: true, rechanges: 1`) ; `Musee.tsx:180` ; `magasin.ts:204` et `musee.ts:490`, la même phrase ; `magasin.ts:809` et `partie.ts:311`, la même phrase ; « déjà faite » (`musee.ts:461`) contre « déjà jouée » (`:384`). Tout est exact, et rien ne ment aujourd'hui. Le seul qui pourrait mentir un jour est `Partie.tsx:370`, si `refusDuPouvoir` change l'ordre de ses refus.

## 9. `POUVOIR_DES_GARDIENS` — tension, P3

La table est voulue. Son commentaire (`salles.ts:108-113`) dit « Une table écrite, que le test relit contre les familles », et `cabinet-catalogue.test.ts:298-303` vérifie chaque ligne contre `GARDIENS_DES_SALLES × POUVOIR_DE_LA_FAMILLE`, le Coq, la Chimère et `AUTRES_GARDIENS`. Rien ne peut diverger sans rougir. Dériver ou écrire, c'est un parti pris : écrite, la table se lit d'un coup d'œil et rend visible au relecteur tout changement de pouvoir d'un gardien, puisque la carte-bonus d'un joueur change avec. La seule redite qu'aucun choix ne justifie, ce sont les cinq « autres », écrits à la fois dans `AUTRES_GARDIENS[].pouvoir` (`salles.ts:94-98`) et dans la table, dans le même fichier. Corriger : construire la `Map` de `pouvoirDuGardien` à partir de la table et d'`AUTRES_GARDIENS`, sans toucher au reste. Remarque sur la piste de l'expert : `salles.ts` n'importe de `pouvoirs.ts` qu'un type (`import type`, `salles.ts:17`). Il n'y a pas de cycle aujourd'hui, mais il y en aurait un dès qu'il faudrait importer `POUVOIR_DE_LA_FAMILLE` à l'exécution.

## 10. Les outils recopiés — confirmé, P3

Relus : `shared/expedition.ts:4069-4072` (n'abaisse qu'un article) contre `vue.ts:85-88` (abaisse toujours). Aujourd'hui, `leGardien` du Cabinet ne sert qu'à `feteVue` (`vue.ts:494`), donc aux trois gardiens de saison, qui ont tous un article : le défaut reste latent. `contenu.ts:90-95` (œ, æ) contre `indices.ts:79-103` (œ, æ, ø, ł, đ, ð, þ, ß, ı) : le juge du contenu coupe « Wałęsa » en « wa » et « esa ». Un indice qui écrirait « Walesa » pour une fiche « Wałęsa » passerait le juge (`ecritDans`) alors que la saisie l'accepterait comme la réponse. Latent aussi : je n'ai pas cherché si une fiche livrée tombe dans ce cas.

## 11. L'échéance gardée par son texte — confirmé, P3, plus fort qu'annoncé

La reproduction de l'expert recopie les assertions de l'épreuve. Je les ai comparées à `cabinet-ecran.test.ts:1773-1784` : elles sont identiques. Mais elle ne joue que cette épreuve-là. J'ai donc rejoué le même mutant (`if (pret || !pret) return`, à la place de la garde de `Partie.tsx:737`) dans une copie du dépôt, sur les quatre fichiers qui lisent `Partie.tsx` : `cabinet-ecran.test.ts` (94 épreuves), `cabinet-ecran-neufs.test.ts` (22), `niche-reactions.test.ts` (12) et `toucher.test.ts` (9). Les 137 passent. Aucune épreuve du dépôt ne voit qu'une partie à l'écran n'envoie plus rien à l'échéance.

Ce que coûterait la régression : le serveur juge quand même la manche expirée au geste suivant (le pli joue la réponse vide). Mais ce que la page tenait se perd, les affirmations déjà dites de l'Éclair, le curseur du Filet, l'épingle posée, et la manche reste ouverte à l'écran. P3, comme une garde de test manquante. La piste de l'expert, une fonction pure pour l'ordonnancement, est la bonne et reste dans le parti pris « pas de bibliothèque de DOM ».

## 12. Les gros composants, la boucle du magasin — confirmé, P3

Relus : `magasin.ts:676`, `:798`, `:975`, `:1021`, `:1090` (cinq `for (let essai = 0; ; essai++)`), 1 260 lignes. Une réserve sur une sous-affirmation : `rendreLaPartieIllisible` (`magasin.ts:496-499`) n'est pas une écriture « hors des lots gardés » au sens d'une course. C'est un comparer-et-poser (`WHERE profile_id = ? AND partie = ?`), sur un chemin de bogue (un départ illisible), et la règle le cite (« un serveur qui ne relit pas une partie (`rendreLaPartieIllisible`…) a pu la rendre »). Le ranger dans `ecriture.ts` est de l'ordre, pas une correction. Sur la boucle, les cinq variantes diffèrent : la relecture d'un rang en avance au geste, `seDementirait` à la dépense, le refus relu au départ. Un `rejouerUneFois` générique devra garder ces trois crochets, sans quoi il les cachera.

## 13. Les restes — confirmé, P3

`git grep` : `qcmDeToutes` ne vit que dans `tirages/tas.ts`, `jeuDeLOeuvre` dans `oeuvres.ts`, `EXPEDITION_ENCORE_LUE` dans `tables.ts`. `refusDuDepart`, `refusDuGeste` et `estDuCabinet` ne servent qu'à leur fichier et à un test. `ouverture.ts:3-4` (« la migration des joueurs de l'Expédition mesurée à blanc ») et `gardiens.ts:18` (« la migration ») citent la migration abandonnée (`decisions.md`, « Pas de migration »). Tout est exact.

## 14. Les épreuves en double — confirmé, P3

Relu : `cabinet-ecran.test.ts:3217-3223`, `:3240` et `:3287-3317` éprouvent la même fusion, et l'expression régulière d'import de `:3240` revient mot pour mot à `:3291`. L'épreuve de `:605-613` rend `AnnonceEnAttente` : elle part avec le composant (constat 4).

## 15. Le SQL et la mémoire — tension, P3

Comme l'expert l'annonce : c'est un choix de sobriété, documenté. L'épreuve qu'il propose (le musée gardé comparé au musée relu à froid après chaque lot) est bonne et peu chère.

---

## Méthode

- **Relancés** : `export/evaluations/cabinet-code/libre-sans-etoile.test.ts` (échoue, raison annoncée) ; `export/evaluations/verification/cabinet-code/libre-ratee.test.ts`, la mienne (échoue, raison annoncée) ; le mutant du constat 11 sur `cabinet-ecran`, `cabinet-ecran-neufs`, `niche-reactions` et `toucher`, dans une copie jetable du dépôt (bloc-notes de session, effacée), 137 épreuves vertes.
- **Relus** : `server/src/core/cabinet/{vue, ecriture (l. 104), magasin (l. 200-210, 485-505, 670-1125), tables (l. 148-157, 312-316), contenu (l. 85-114)}.ts`, `server/src/core/cabinet/tirages/index.ts`, `server/src/core/porteDeLaCampagne.ts`, `server/src/core/campagne.ts:2296-2345`, `shared/cabinet/{partie, musee, salles, pouvoirs, ouverture, bareme}.ts`, `shared/cabinet/jeux/{indices, outils}.ts`, `shared/expedition.ts:4066-4074`, `client/src/views/CabinetApp.tsx:190-211, 485-520`, `client/src/views/cabinet/{Partie (l. 140-163, 364-374, 730-752), Annonce (l. 50-56), Bilan (l. 139), Musee (l. 178-181), Regles (l. 107, 120-135)}.tsx`, `server/test/cabinet-ecran.test.ts` (l. 600-615, 1768-1800, les lignes de `fondreLesReveils`), `server/test/cabinet-catalogue.test.ts:290-306`, `server/test/cabinet-poussiere.test.ts:636-708`, `server/test/notes-pour-claude.test.ts`, `docs/architecture/decisions.md` (les titres), `docs/produit/le-cabinet.md:140-188`, `docs/reference/baremes.md:659, 666`, `.claude/rules/cabinet.md` (par ses `paths:` et en lecture directe), les quatre autres rapports et leurs JSON, `export/tablee/2026-10-25-22h07/retours/{hugo, lucas, theo}.md`, `/tmp/…/scratchpad/conception/FINALE.md` (§ 0.1, les titres, `:1722`).
