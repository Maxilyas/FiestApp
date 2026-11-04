# Le QG 2 sous charge

La question du propriétaire, le 4 novembre 2026, le QG 2 fusionné le matin
(Maxilyas/FiestApp#360) : « est-ce que le QG est optimisé, et est-ce qu'il peut
potentiellement geler le serveur pour les autres joueurs ? » — la consommation
de Turso, les gels, le temps de réponse des routes.

**En bref** : Turso, oui — le QG pèse très peu au quota. Les gels, presque :
une seule chose gelait, et pour tout le monde — **la relecture de la semaine du
serveur, 2,6 s de gel au dixième de cœur**, que les règles des alertes
déclenchaient **chaque heure, QG fermé**. La production tournait encore sur
`89cf01b` (le 3 novembre au soir), d'avant le QG 2. Corrigé le même jour
(plus bas, « Ce qui a été fait ») : la même page répond en 0,4 à 0,5 s, sans
un gel.

## Le banc

`reproductions/qg-sous-charge.ts`, compilé comme le paquet
(`../2026-10-16/reproductions/compiler.ts`) : la base du banc du gel grossie au
volume de la production (35 000 réponses de campagne, la recette de
`../2026-11-02/reproductions/gels-rejoues.ts`), 300 soirées archivées, le faux
Turso dehors à 30 ms l'aller-retour (`../2026-10-14/reproductions/outils.ts`,
lancé avant la bride : il ne la partage pas), et la semaine du serveur écrite
d'un relevé horaire réel — celui que le processus relève en servant joueurs et
QG, complété de ce que le banc ne fait pas vivre : soixante requêtes suivies au
quota, soixante-dix routes, les téléphones de onze pages, onze messages du
temps réel, trois gels. 16,7 Ko l'heure, seize heures éveillées par jour,
huit jours : 136 heures, 2,3 Mo. Chaque page à froid puis à chaud ; `GEL=1`,
un groupe de contrôle v1 à dix millisecondes sur cent et les drapeaux du
ramasse-miettes de la production — les gels sont ceux que la sonde du serveur
relève (`core/gels.ts`, au-delà d'une demi-seconde). Les lignes au quota sont
estimées (une table parcourue en entier les compte toutes, sinon les lignes
rendues).

Une page lente n'est pas un gel : tant qu'elle rend la main entre ses
morceaux, les joueurs passent entre eux. Seul un bloc d'un seul tenant les
fait attendre.

## Ce qui a été mesuré, au dixième de cœur

| Page | Réponse, à froid → à chaud | Processeur | Gel relevé | Lignes au quota |
|---|---|---|---|---|
| Le poste de commande (`/api/admin/qg`, relu toutes les cinq minutes) | 1,2 → 0,7 s | 107 → 69 ms | aucun | ~170 → ~135 |
| Le direct (`/api/admin/qg/direct`), « Hier, en bref » | 3 à 6 ms | 3 à 6 ms | aucun | 0 |
| Avant / après — la première page du jour rattrape la mémoire | 1,7 → 0,5 s | 150 → 53 ms | aucun | ~2 500 une fois par jour → 0 |
| Les joueurs | 0,43 → 0,13 s | 43 → 14 ms | aucun | ~300 → 6 |
| Les segments, la mémoire en tableur | moins de 0,1 s | 10 à 16 ms | aucun | 6 au plus |
| La campagne, ses sentiers | 0,4 → 0,1 s | 43 → 17 ms | aucun | jusqu'à ~700 |
| Le Cabinet | 1,3 → 0,07 s | 121 → 8 ms | aucun | ~3 |
| **Le serveur, la semaine relue** (`/api/admin/serveur?periode=7j`) | **2,8 à 3,0 s** | **285 à 299 ms** | **2 567 ms** | ~130 |

Sur un vrai cœur, les vingt-cinq autres pages du QG prennent 3 à 45 ms de
processeur chacune, leur plus long bloc 24 ms (la campagne à froid) ; tout le
QG ouvert page par page, à froid, lit une dizaine de milliers de lignes. Le
fond, rien d'ouvert, sur un vrai cœur : 130 à 190 ms de processeur la minute,
un aller-retour.

## Ce qui gèle : la semaine du serveur

`SanteDuServeur.page()` (`server/src/core/santeDuServeur.ts`) relit d'un bloc
les sept jours de `qg_sante`, les décode (`lireHeure`), puis calcule toute la
page (`pageDuServeur`), sans rendre la main. Le QG 2 a mis dans chaque heure
ses routes une à une, ses tranches de cinq minutes, les téléphones et le temps
réel (lots 2, 2 bis et 9) : les trois quarts du relevé au banc (`parRoute`
9,6 Ko sur 16,7).

Qui la déclenche, dès que la lecture d'avant a plus d'une minute
(`PAGE_GARDEE_MS`) :

1. **les règles des alertes, chaque heure** (`lecteurDesAlertes`,
   `core/regles.ts`) : pour savoir si la version en ligne ralentit une route,
   elles calculent la page entière et n'en gardent que `versions`
   (`server.ts`). La production, éveillée de 7 h à minuit, en ferait dix-sept
   gels par jour, plus un à chaque réveil ;
2. l'administrateur, à chaque ouverture de « Le serveur », « Base et miroir »,
   « Téléphones », « Erreurs », un changement de période ou le tri d'une
   erreur.

Le profil du processeur, sur un vrai cœur (`PROFIL=…`) : plus de la moitié
part à recevoir, décoder et relire les 2,3 Mo, le ramasse-miettes compris ;
le calcul de la page, à peine un septième. Hors du serveur, sur un relevé
semblable (136 heures, 1,8 Mo) : le `JSON.parse` des heures 21 ms,
`pageDuServeur` sur sept jours 4 ms (33 ms la première fois). Ce n'est donc pas le calcul qu'il faut accélérer :
c'est la relecture de toute la semaine qu'il faut éviter.

Pendant ce gel, plus rien ne répond — téléphones, écran commun, pages des
joueurs —, et une réponse de soirée lue après lui perd d'autant son bonus de
rapidité (la marge du « Trop tard » la protège : `RETARD_D_UN_GEL_MS`). Pour
l'ordre de grandeur : la production a relevé 98 gels de plus d'une
demi-seconde du 3 novembre 10 h au 4 novembre 9 h (`89cf01b` et d'avant,
`../2026-11-02/reproductions/gels-de-la-production.ts`), 99 s en tout, le fond
de la campagne et la page des sentiers d'abord, l'ancien QG en marge ; le QG 2
tel quel y ajouterait de l'ordre de 45 s par jour.

## Ce que Turso paie

- **Le QG ouvert** : ~135 lignes par relecture du poste, une dizaine de
  milliers pour toutes les pages à froid — même ouvert des heures par jour,
  moins d'un million de lignes par mois, sous 0,2 % des 500 millions.
- **Le seul poste permanent : la réserve du quiz du jour, relue chaque
  minute par les règles** (`avanceDeLaReserve`, `core/jour.ts`) — un `COUNT`
  des questions prêtes par l'index, un `MAX` sur toute `jour_apports`, sans
  index —, 1 440 fois par jour pour un chiffre qui bouge une fois par jour.
  Chaque lecture compte à peu près les questions prêtes et tous les apports :
  pour 200 à 300 lignes, 9 à 13 millions par mois, 2 % du quota environ (la
  taille de la réserve de la production n'a pas été lue).
- Un QG visible garde le service éveillé (il se relit toutes les cinq
  minutes) : ce sont les heures de l'hébergeur. Caché, il se tait.

## Ce qui a été fait, le même jour

Le choix du propriétaire : « Applique toutes tes corrections ».

1. **La semaine gardée** (`SanteDuServeur.semaine`) : une heure finie ne
   change plus — seule la dernière d'un démarrage se récrit. La semaine se lit
   une fois, six heures par six, la main rendue entre deux (`lireEnTranches`,
   `rendreLaMain`, nommée « fond · semaine du serveur ») ; ensuite, une remise
   à jour ne demande que les lignes dont `maj_le` dépasse la précédente moins
   deux relevés de marge (`MARGE_DE_RELECTURE_MS` : une ligne porte l'heure où
   elle s'est préparée, et la file qui l'envoie peut la poser après une
   lecture), plus les démarrages. Une remise à jour en route s'attend : une
   seconde ne part pas dessous. Le quota des alertes y lit aussi — il se
   relisait à part, 170 Ko chaque heure. La mémoire ne grandit pas : la
   semaine lue se gardait déjà, d'une lecture à l'autre.
2. **Les versions sans la page** (`SanteDuServeur.versions`,
   `versionsDeLaSemaine`, que la page appelle aussi : la règle juge les
   ralenties que la page montre).
3. **La réserve relue au plus toutes les dix minutes** par les règles
   (`RESERVE_GARDEE_MS`) : 144 lectures par jour au lieu de 1 440, une lecture
   tombée gardant la précédente.
4. **Le tour des règles nommé** pour la sonde des gels (« fond · règles des
   alertes »).

`server/test/qg-serveur-semaine.test.ts` (la page comparée à celle que ses
heures font, à la première lecture comme après une remise à jour ; ce que la
base rend, compté : chaque heure une fois, puis les deux lignes récrites ; une
lecture en route attendue ; les versions de la page) et deux épreuves de plus
dans `qg-alertes.test.ts` (la réserve dix minutes, le tour nommé) : sur le code
d'avant, toutes échouent, sauf la garde du rendu (`santeGardeeMs: 0`, qui
relit tout à chaque fois), qui passait déjà.

**Rejoué au dixième de cœur**, le même banc (`REGLES_MS=3600000` : la semaine
s'écrit sous le serveur, datée de la fin de chaque heure, et les règles ne
doivent pas l'avoir lue avant elle) :

| Page | Avant | Après |
|---|---|---|
| Le serveur, la semaine remise à jour (`/api/admin/serveur?periode=7j`, une minute après la lecture d'avant) | 2,8 à 3,0 s, 285 à 299 ms de processeur, **gel de 2 567 ms** | **0,4 à 0,5 s, 40 à 52 ms, aucun gel** |
| Le poste à sa première ouverture, qui fait ici la première lecture de la semaine (42 allers-retours) | — | 2,2 s, 214 ms, **aucun gel** |
| Le poste ensuite | 0,7 s, 69 ms | 0,5 à 0,6 s, 48 à 65 ms (deux passes) |

La première lecture d'un démarrage passe en production par les règles des
alertes, à leur première minute ; aucune tranche ne gèle. Turso compte autant
de lignes qu'avant à chaque remise à jour — la semaine parcourue par sa clé,
une centaine —, mais n'en rend plus que les récrites : 2,2 Mo ne passent plus
le fil chaque heure.

## Le relancer

```bash
cd server && node --import tsx ../retours/2026-10-16/reproductions/compiler.ts ../retours/2026-11-04/reproductions/qg-sous-charge.ts ../export/banc/qg-sous-charge.mjs
```

```bash
cd server && GEL=1 ROUTES=70 SOIREES=300 ATTENTE_MS=61000 N=1 REGLES_MS=3600000 SEULES=serveur?periode=7j,api/admin/qg node --single-threaded-gc --no-memory-reducer --max-old-space-size=320 ../export/banc/qg-sous-charge.mjs
```

La base du banc du gel d'abord (`../2026-10-16/reproductions/banc-gel.ts`), et
`GEL=1` demande d'être root (`/sys/fs/cgroup/cpu/gel`).
