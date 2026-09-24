# La carte de l'application — impasses, orphelines, sens uniques (`carte-du-site`)

**Ton angle** : architecte de l'information. **Ta question** : quelle est la
carte réelle de FiestApp, et où sont les impasses, les pages orphelines, les
sens uniques et les détours ?

**Ton compte** : Élodie (`elodie`, espace `chez-elodie`). Des appareils de
chaque rôle : anonyme, invité d'une soirée, joueur à profil, animateur,
administrateur (fiche de l'atelier, `admin`).

**Ta méthode** :
1. Recense **toutes les pages et leurs états** à partir du code
   (`client/src/routes.ts`, `client/src/main.tsx`, les vues et les
   composants — dialogues compris) et du serveur (redirections, 404, pages
   d'erreur).
2. Visite chacune **dans chaque rôle et chaque moment de la soirée** (pas de
   soirée, salle d'attente, en jeu, entre deux quiz, close, archivée) : ses
   liens et boutons sortants (vers où), ses liens entrants (depuis où), le
   titre de l'onglet, le fil d'Ariane ou la navigation, ce que fait le
   bouton retour du navigateur.
3. Repère les **impasses** (aucune sortie utile), les **orphelines**
   (aucune page n'y mène), les **sens uniques** (on y va, on n'en revient
   pas), les navigations incohérentes d'une page à l'autre, les adresses qui
   mènent à une page vide.

**Ce que tu rends, en plus du modèle** : la carte en **Mermaid** (une par
rôle si besoin), la matrice pages × liens, la liste des impasses,
orphelines et sens uniques, et un modèle de navigation proposé (ce que
chaque page devrait offrir comme suite).
