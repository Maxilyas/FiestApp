---
name: base-campagne
description: Agrandir la base de questions de la campagne solo de FiestApp (server/content/campagne/) — voir ce qui manque, faire écrire un lot par l'agent redacteur-campagne, le faire relire par relecteur-campagne, appliquer ses décisions, ranger ; ou des centaines, des milliers de questions d'un coup (scripts/generer-campagne.ts), sur l'abonnement ; ou à partir de faits tirés de Wikidata (scripts/faits-wikidata.ts), deux fois moins cher relecture comprise. À utiliser quand on demande des questions de campagne en plus, un lot à écrire ou à relire, une génération en nombre, ou des questions tirées de Wikidata.
---

# Agrandir la base de la campagne

Le script `server/scripts/base-campagne.ts` fait tout, et deux agents du projet
écrivent et relisent sobrement (`.claude/agents/`). Ce qu'il faut savoir de la
base elle-même — un identifiant ne bouge jamais, une correction de fond en tire
un neuf — est dans la règle `campagne-base.md`. Les commandes se lancent depuis
`server/`.

1. **Voir ce qui manque** : `npx tsx scripts/base-campagne.ts stats`, par
   catégorie, sous-thème et difficulté.
2. **Le dossier des lots** : `../.lots-campagne/`, à côté du code, que git ne
   voit jamais (`.gitignore`). Dans un clone neuf (une session cloud),
   crée-le avant tout : la consigne lit ce dossier, et rien n'y est committé.
3. **La consigne d'un lot** : `npx tsx scripts/base-campagne.ts consigne
   <Catégorie> <sous-thème>:<n> … --lot=<nom> > ../.lots-campagne/<nom>.consigne.md`.
   Le nom du lot ne prend que des lettres et des chiffres (`geo1`) : ses
   fichiers seront `<nom>-01.json`, `<nom>-02.json`… La consigne rappelle les
   intitulés que ses sous-thèmes ont déjà, lots en attente compris — pas toute
   la catégorie : `verifier` refuse un fait que la base pose déjà, d'où qu'il
   vienne (`core/memeFait.ts`). `--nombres` commande des questions à nombre,
   qui se joueront aussi en estimation au quiz tout prêt — la base en
   manquait de faciles : vérifie-les avec `verifier --nombres`, qui avertit de
   celles qui ne se joueraient pas au plus près (`lireLEstimation`). Les
   rédacteurs serrent leurs leurres et notent 3 ou 4 : la première vague à
   nombre, le 11 octobre 2026, n'avait presque aucune 2, et des années à la
   chaîne — demande-leur la moitié en 2, leurres écartés, et des grandeurs
   variées.
4. **L'écriture** : un agent `redacteur-campagne` par lot, dont la mission
   donne le chemin de la consigne. Il écrit ses fichiers et les vérifie
   jusqu'à zéro refus.
5. **Les doublons** : `verifier` et `ranger` refusent le même fait sous un
   autre intitulé, ou retourné ; `npx tsx scripts/base-campagne.ts voisines
   ../.lots-campagne/<nom>-*.json` montre en plus les intitulés presque
   pareils d'un sous-thème, que rien ne refuse. Sans lot, `voisines` relit
   toute la base, et `retirer <id> …` en sort un doublon.
6. **La relecture des faits** : `npx tsx scripts/base-campagne.ts fiche
   ../.lots-campagne/<nom>-*.json > ../.lots-campagne/<nom>.fiche.txt`, puis un
   agent `relecteur-campagne`, dont la mission donne la fiche et le fichier de
   décisions à écrire, `../.lots-campagne/<nom>.decisions.json` — dans le
   dossier des lots : `appliquer` y lit ses références.
7. **Appliquer** : `npx tsx scripts/base-campagne.ts appliquer
   ../.lots-campagne/<nom>.decisions.json` retire, ou corrige une phrase ou une
   difficulté — jamais une réponse.
8. **Ranger** : `verifier` une dernière fois, puis `npx tsx
   scripts/base-campagne.ts ranger ../.lots-campagne/<nom>-*.json`. Chaque
   question y reçoit son identifiant, et le rangement écarte ce que la base ou
   les quiz livrés ont déjà — le même intitulé, ou le même fait. Commite
   `server/content/campagne/`, jamais le dossier des lots.

Sans déploiement, la routine du matin agrandit aussi la base, par l'API
(`/api/campagne/base`) : voir la règle `campagne-base.md`.

## En nombre : des centaines, des milliers de questions

`server/scripts/generer-campagne.ts` fait le plan et la paperasse ; la session
lance les mêmes agents, en nombre. Tout passe par l'abonnement Claude : rien
ne se paie en plus, mais chaque vague consomme les limites d'usage du forfait,
que la routine du matin partage — mille questions, c'est une quarantaine de
rédacteurs et une dizaine de correcteurs (le 11 octobre 2026 : mille écrites,
dix-neuf refusées entre lots comme le même fait, huit retirées et cinquante-quatre
corrigées à la relecture — une anecdote ou une explication sur deux, des
difficultés trop hautes pour un fait que tout le monde sait —, 973 rangées ;
puis mille autres, 968 rangées, vingt-quatre retirées : dont treize d'un même
lot, où l'indice de la bonne réponse pointait la case d'à côté et les leurres
suivaient l'erreur — le juge n'y voit rien, les explications nommaient la
vraie réponse, seul le correcteur l'a vu ; on n'en sauve une qu'en refaisant
`bonne` et ses leurres, dans un lot à part, relu à son tour ; puis mille
encore, 986 rangées, sept retirées et quarante et une corrigées : les faits qui
ont changé ces dernières années revenaient d'une vague à l'autre dans leur état
d'avant — l'Éthiopie et ses langues de travail deux fois —, la consigne
commune les nomme désormais, routine du matin comprise ; puis cinq cents,
489 rangées, pour les sous-thèmes restés maigres d'une catégorie grosse de
ses faits de Wikidata — `commandeDeLaCategorie` les vise d'elle-même).
Pas d'API d'Anthropic : elle se facture à part, et le propriétaire n'en veut pas.

**Laisse passer la routine du matin** (« Réserve du quiz du jour », 6 h 55 à
Paris) : une génération qui épuise le forfait l'empêche de remplir la réserve
du quiz du jour — le 10 octobre 2026, elle a échoué ainsi (« usage limit
reached »), et le 11, vingt agents en même temps ont touché la limite à
quelques minutes d'elle, tous arrêtés en route. Ne lance pas de vague dans
l'heure qui la précède, attends qu'elle ait fini (`list_triggers`, son
`last_run`), et tiens-toi à une dizaine d'agents à la fois. Un rédacteur
arrêté laisse souvent son lot écrit mais pas vérifié : `verifier` dit ses
refus, et un agent à qui l'on demande de corriger ces seuls refus coûte bien
moins qu'une réécriture.

1. **Le plan** : `npx tsx scripts/generer-campagne.ts preparer
   --questions=<n>` (`--categories=Géographie,Sport`, `--par-lot=30`). Il dit ce
   qui manque à la base, en lots de trente au plus et en vagues, écrit les
   consignes de la première vague, et donne une mission par lot.
2. **L'écriture** : un agent `redacteur-campagne` par mission, sa mission telle
   quelle, en arrière-plan, une dizaine à la fois.
3. **La suite** : `npx tsx scripts/generer-campagne.ts suite`, après chaque
   fournée d'agents. Elle recueille la vague écrite — le juge et le
   dédoublonnage du rangement, entre ses lots aussi —, écrit les consignes de
   la vague suivante et les fiches de relecture, applique les décisions
   rendues, puis donne les missions suivantes : des `redacteur-campagne` et des
   `relecteur-campagne` mêlés, à lancer de même. Recommence jusqu'au bilan.
4. **Un agent qui ne rend rien** : relance sa mission. S'il échoue encore,
   `suite --forcer` compte son lot pour vide, ou met de côté les lots d'une
   fiche que personne n'a relue (`../.lots-campagne/<nom>/a-relire/`, à relire
   à la main avant de les remettre dans le dossier des lots).
5. **Ranger** : le bilan donne les commandes — `voisines`, puis `ranger
   ../.lots-campagne/<nom>-*.json` — ; commite `server/content/campagne/`.

`etat` dit où en est une génération. Une seule à la fois : pour en abandonner
une, supprime `../.lots-campagne/<nom>/` et ses lots `<nom>-*.json`.

## Depuis Wikidata : des faits sûrs, des phrases à écrire

Deux fois moins de jetons qu'un lot écrit de mémoire, relecture comprise
(1 140 par question au pilote de trois cents), et des difficultés 4 et 5 :
`server/scripts/faits-wikidata.ts` tire de Wikidata la bonne réponse,
les leurres, la date, les entités et la source ; le rédacteur n'écrit que
l'intitulé, l'anecdote et l'explication. Pour les relations qu'il connaît
(un tableau et son peintre, un film et son réalisateur…), pas pour les
notions ni la culture française du quotidien, qui restent au chemin
ci-dessus. Les familles et leurs règles sont dans la règle `campagne-base.md`.

1. **Extraire** : d'abord les vues, `NODE_USE_ENV_PROXY=1 npx tsx
   scripts/faits-wikidata.ts vues-des-dumps` — les fichiers quotidiens de
   Wikimedia, dix jours lus au fil de l'eau, un quart d'heure ; l'API des vues
   renvoyait chaque requête du cloud à une minute. Puis `NODE_USE_ENV_PROXY=1
   npx tsx scripts/faits-wikidata.ts extraire [<famille> …]` (la variable :
   dans le cloud, `fetch` ne suit pas le proxy sans elle). Les fiches vont
   dans `../.faits-wikidata/`, que git ignore, et les requêtes s'y gardent :
   relancer une famille ne demande que ce qui a changé ; `familles` dit ce
   qui est extrait.
2. **Les lots** : `npx tsx scripts/faits-wikidata.ts lots --questions=<n>
   [--familles=films:150,goncourt:50] --nom=<nom>` (crée `../.lots-campagne/`
   s'il manque) : la part de chaque famille, prise parmi les plus lues — de
   quoi doubler à peu près une catégorie, pas davantage, ou un seul gabarit
   la noierait. Il donne une mission par lot.
3. **L'écriture** : un agent `redacteur-campagne` par mission, telle quelle,
   en arrière-plan, vingt à la fois au plus — au-delà, Claude Code refuse le
   lancement : relance à mesure que les places se libèrent. Son
   vérificateur, `faits-wikidata.ts fusionner <nom>-NN`, écrit le lot
   ordinaire `../.lots-campagne/<nom>-NN.json`.
4. **La relecture, de chaque lot** : les phrases s'écrivent de mémoire, et
   Wikidata se trompe parfois de date ou de créateur — le correcteur a
   corrigé 48 questions sur 788 à la troisième vague, et en a retiré 8. Pour
   chaque lot, `base-campagne.ts fiche ../.lots-campagne/<nom>-NN.json >
   ../.lots-campagne/<nom>.NN.fiche.txt`, un `relecteur-campagne` dont la
   mission donne la fiche et `../.lots-campagne/<nom>.NN.decisions.json`, puis
   `appliquer`. Un point, pas un tiret, après le nom : `ranger <nom>-*.json`
   prendrait les décisions pour un lot. Le relecteur ne corrige pas le
   sous-thème : celui qu'il signale se corrige à la main dans le lot, et dans
   l'extraction s'il vient d'elle (Joyce en littérature française : la
   langue des livres n'était pas lue).
5. **Ranger** : `verifier`, puis `voisines`, puis `ranger
   ../.lots-campagne/<nom>-*.json`, comme tout lot. Une question que
   `verifier` refuse se retire par un fichier de décisions de plus
   (`<nom>.refus.decisions.json`). Commite `server/content/campagne/` et
   relève `AU_MOINS` (`campagne-base.test.ts`).
