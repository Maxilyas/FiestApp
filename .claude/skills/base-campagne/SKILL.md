---
name: base-campagne
description: Agrandir la base de questions de la campagne solo de FiestApp (server/content/campagne/) — voir ce qui manque, faire écrire un lot par l'agent redacteur-campagne, le faire relire par relecteur-campagne, appliquer ses décisions, ranger. À utiliser quand on demande des questions de campagne en plus, un lot à écrire ou à relire.
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
   voit jamais. Dans un clone neuf (une session cloud), crée-le et ajoute la
   ligne `.lots-campagne/` à `.git/info/exclude` avant tout : la consigne lit ce
   dossier, et rien n'y est committé.
3. **La consigne d'un lot** : `npx tsx scripts/base-campagne.ts consigne
   <Catégorie> <sous-thème>:<n> … --lot=<nom> > ../.lots-campagne/<nom>.consigne.md`.
   Le nom du lot ne prend que des lettres et des chiffres (`geo1`) : ses
   fichiers seront `<nom>-01.json`, `<nom>-02.json`… La consigne rappelle les
   intitulés que ses sous-thèmes ont déjà, lots en attente compris — pas toute
   la catégorie : `verifier` refuse un fait que la base pose déjà, d'où qu'il
   vienne (`core/memeFait.ts`).
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
