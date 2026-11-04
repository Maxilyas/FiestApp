# Le QG 2 sous charge

La question du propriétaire, le 4 novembre 2026, le QG 2 fusionné le matin
(Maxilyas/FiestApp#360) : « est-ce que le QG est optimisé, et est-ce qu'il peut
potentiellement geler le serveur pour les autres joueurs ? » — la consommation
de Turso, les gels, le temps de réponse des routes.

**En bref** : Turso, oui — le QG pèse très peu au quota. Les gels, presque :
une seule chose gèle, et pour tout le monde — **la relecture de la semaine du
serveur, 2,6 s de gel au dixième de cœur**, que les règles des alertes
déclenchent **chaque heure, QG fermé**. La production tournait encore sur
`89cf01b` (le 3 novembre au soir), d'avant le QG 2 : à corriger avant de l'y
déployer.

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

## Ce qui est proposé

1. **La semaine gardée, lue** : une heure finie ne change plus — seule celle
   du démarrage bouge, et le relevé la tient déjà en mémoire. La lire une fois,
   jour par jour en rendant la main, puis seulement les lignes neuves
   (`maj_le`). Attendu : de ~290 ms de processeur d'un seul bloc à quelques
   dizaines, plus de gel ni chaque heure ni à l'ouverture des pages, quelques
   mégaoctets de mémoire de plus (à mesurer), autant de lignes au quota.
2. **Les règles sans la page** : `versionsDuServeur` seul, sur les heures
   gardées.
3. **La réserve relue toutes les dix minutes** par les règles, comme
   `/healthz` le fait déjà (`RESERVE_RELUE_MS`).
4. **Le tour des règles nommé dans la sonde des gels** (`enFond`,
   `core/gels.ts`) : un gel qu'elles causent se range aujourd'hui sous la
   requête qui passait.

Chacun avec son test dans `server/test/`, et ce banc rejoué au dixième de cœur
avant et après.

## Le relancer

```bash
cd server && node --import tsx ../retours/2026-10-16/reproductions/compiler.ts ../retours/2026-11-04/reproductions/qg-sous-charge.ts ../export/banc/qg-sous-charge.mjs
```

```bash
cd server && GEL=1 ROUTES=70 SOIREES=300 ATTENTE_MS=61000 N=1 SEULES=serveur?periode=7j,api/admin/qg node --single-threaded-gc --no-memory-reducer --max-old-space-size=320 ../export/banc/qg-sous-charge.mjs
```

La base du banc du gel d'abord (`../2026-10-16/reproductions/banc-gel.ts`), et
`GEL=1` demande d'être root (`/sys/fs/cgroup/cpu/gel`).
