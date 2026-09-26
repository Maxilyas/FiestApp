# Les quiz : éditer, ranger, emporter, partager (`bibliotheque`)

**Ton angle** : ingénieur des outils de création et des formats d'échange.
**Ta question** : un quiz écrit, collé, importé, dupliqué, partagé ou copié
depuis le catalogue arrive-t-il **entier** — ses questions, ses réglages,
ses trois pièces par question — et l'enregistrement ne perd-il jamais le
travail de l'animateur ? Consignes : `consignes-audit.md`.

**Où regarder** : `shared/library.ts` (`normalizeQuestions`,
`parseImportedQuestions`, `PIECES_DE_QUESTION`, les bornes), `shared/liste.ts`
(`FORMAT_DE_LISTE`, `ecrireListe`, `photoAttendue`), `shared/echange.ts`,
`shared/brouillon.ts` et `client/src/brouillon.ts`, `shared/partage.ts`,
`shared/modeles.ts`, `shared/hasard.ts` (`preparerPartie`), `shared/nombres.ts`,
`server/src/core/quizStore.ts`, `core/memoire.ts`, `core/partages.ts`,
`server/src/partages.ts`, les routes des quiz et des images de `api.ts`,
`core/export.ts`, et `client/src/views/EditorApp.tsx` (l'enregistrement :
`base`, `jeton`, `essai`, `modifications`, 409). Le rapport d'avant :
`retours/2026-09-25/gestion-des-quiz.md`. Pièges « L'éditeur n'envoie rien
pendant qu'on écrit », « Un réglage de plus à la liste collée », « Une
question a trois pièces à part ».

**Ce que tu cherches** :
- **Les allers-retours** : liste collée → quiz → « Copier en liste » →
  recollée ; export → import ; partage → copie reçue ; catalogue → copie ;
  duplication — rien ne se perd (réglages de hasard, catégories, temps,
  cible et unité d'une estimation, « plusieurs », « ordre », photo de
  révélation, extrait, note de l'animateur) ? Un test de propriété sur des
  quiz fabriqués au hasard est bienvenu.
- **Les pièces** : une image supprimée par le ménage alors qu'une copie, un
  programme, une archive ou le quiz du jour la montrent encore ; une copie
  qui garde l'adresse de l'autre espace ; une photo attachée à la mauvaise
  question après un déplacement.
- **L'enregistrement** : deux appareils, le réveil de l'hébergeur, un essai
  rejoué, un essai ancien qui arrive après un récent, un 409 mal compris ;
  le brouillon relu après un rechargement ; un brouillon d'une version
  d'avant du format.
- **Les bornes** : un quiz sans question, trois cents questions, une réponse
  vide, un texte de dix mille caractères, des emojis récents, une cible
  « 35 000 », « 0,8 », « −40 » (`lireNombre`), une durée tapée « 2045 »
  (`ChampNombre`).
- **Le partage** : le code (sept jours, annulable, dix essais manqués par
  quart d'heure), un code reçu deux fois, un quiz supprimé après partage.

**Hors de ton angle** : la sécurité des routes en général
(`securite-portes`) — sauf ce qui laisse lire ou écrire le quiz d'un autre
espace, qui est aussi à toi.

**Ce que tu rends, en plus du modèle** : le tableau des allers-retours
(chemin · ce qui passe · ce qui se perd), et un test par perte.
