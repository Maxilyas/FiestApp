---
paths:
  - "shared/qg.ts"
  - "server/src/qg.ts"
  - "client/src/views/AdminApp.tsx"
  - "client/src/components/{QgVueDEnsemble,QgJournal}.tsx"
  - "server/src/core/journalDesGestes.ts"
  - "server/test/{qg,journal}.test.ts"
  - "server/scripts/rendu-qg.ts"
---

# Le QG de l'administrateur (`/admin`)

## Les fichiers

- `shared/qg.ts` — ce que le QG montre, dérivé à l'écart des magasins : les minuits de Paris (`minuitsDeParis`, lus dans le jour — le 25 octobre 2026 a vingt-cinq heures), un chiffre du jour comparé à la même heure des sept jours d'avant (`compteDuJour`, `ecartALHabitude` — en chiffre sous vingt d'habitude : trois contre deux ne font pas « 50 % de plus »), les participations des trente jours (`participationsParJour` : seul, un joueur compte une fois par mode et par jour ; en soirée, chaque invité qui a joué), où en est une soirée (`ouEnEstLaSoiree`, sans rien de son contenu), et ce qui attend un geste, le plus pressé d'abord (`lesChosesATraiter`)
- `server/src/qg.ts` — ses deux routes, sous `/api/admin` (gardées d'un bloc : `admin-seulement.test.ts` les trouve seul) : `/qg/direct` — les soirées pas encore closes, lues dans la base locale et en mémoire, le miroir, le serveur — et `/qg` — trente jours lus dans la base permanente, et ce qui attend un geste
- `client/src/views/AdminApp.tsx` · `client/src/components/QgVueDEnsemble.tsx` — la page : la vue d'ensemble, puis une page par sujet à son adresse (`/admin#jour`) ; à l'ordinateur (dès 1101 px), une barre de côté qui compte ce qui attend sur chaque page ; au téléphone, la liste des pages sous la vue d'ensemble et la barre du menu
- `server/src/core/journalDesGestes.ts` · `client/src/components/QgJournal.tsx` — le journal des gestes de l'administrateur (`/admin#journal`, `qg_gestes` dans la base permanente) : une ligne par geste qui a changé quelque chose — une phrase qui nomme ce qu'il a touché, sa sorte (profil, salon, catalogue, quiz du jour, campagne), ce qu'il visait (`cible`, l'identifiant d'un profil, d'un espace, d'une question : la fiche d'un joueur relira les siens) —, jamais modifiée ; la page le lit cinquante gestes à la fois (`GESTES_PAR_PAGE`, un curseur instant + identifiant), par sorte, rangés par jour de Paris (`gestesParJour`)
- `server/scripts/rendu-qg.ts` — le QG photographié sur un serveur jetable — trente jours d'activité inventée, une soirée en cours, une laissée en plan, des gestes au journal — au téléphone, en 1366 × 768 et en 1920 × 1080, sous le Velours et sous l'Ivoire

## Les décisions (le 13 octobre 2026, avec le propriétaire, sur maquettes)

- **Des soirées des autres, rien que des chiffres** : le salon, où elle en est, combien d'invités, depuis quand, sa sauvegarde — ni le quiz, ni la question, ni un prénom d'invité. `qg.test.ts` relit la réponse entière du direct : un champ de plus au direct ne porte jamais de contenu.
- **Une soirée sans un geste depuis six heures est laissée en plan** (`EN_PLAN_MS`) : elle passe dans « À traiter ».
- **Les alertes vivent sur le QG seulement** : ni notification, ni courriel.
- **Les barèmes restent dans le code** : le QG agit sur le contenu, sur les joueurs et sur l'animation du serveur, jamais sur les règles du jeu.
- **Le journal des gestes vit dans le QG** (« Oui, dans le QG ») : il raconte ce que l'administrateur a changé, sans rien défaire — annuler un geste reste le geste contraire, qui se note à son tour. Il garde le nom d'un profil supprimé : c'est la trace de ce qui a eu lieu, et seul l'administrateur le lit.
- **Le plan, lot par lot** : le squelette et la vue d'ensemble, puis le journal des gestes (faits), les soirées et « Clore une soirée en plan », la fiche d'un joueur et ses gestes (réparer, offrir des confettis, modérer, aider à se reconnecter), la santé du serveur sur sept jours dans Turso, les pages des modes et de l'économie, enfin « Animer » (annonces, événements, défi de la semaine, mise en avant). Une page rejoint la barre de côté (`PAGES_DU_QG`) quand elle existe, jamais avant.

## Les pièges

- **La vue d'ensemble ne relit pas trente jours à chaque fois** : un QG reste ouvert sur un écran toute la journée, et chaque relecture compte au quota de Turso. Les jours finis se lisent une fois par jour et se gardent jusqu'à minuit (`lesTrenteJours`) ; seul aujourd'hui se relit, par des index de dates (`idx_campagne_series_commencee`, `idx_profile_xp_quand`, `idx_profiles_cree`, le jour de `jour_parties`), et la réserve du quiz du jour par ses seules questions prêtes (`avanceDeLaReserve` — `etatDeLaReserve` parcourt toute la réserve, pour la page qui la détaille). La page la redemande toutes les cinq minutes et en revenant d'une page, le direct toutes les dix secondes — lu en mémoire et dans la base locale, sans Turso —, et rien tant que l'onglet est caché. Les soirées se relisent toujours : une soirée d'hier close ce matin passe de la base locale aux archives, et ne doit pas disparaître du graphique. Un chiffre de plus tiré d'un journal qui grossit suit la même voie — le cache, et son index.
- **« Aujourd'hui » se compare à la même heure** des sept jours d'avant (`compteDuJour`), jamais à des journées entières : un soir à 21 h se lisait toujours en baisse.
- **Un chiffre du QG compte ce que sa page montre** : les signalements du quiz du jour ne comptent qu'une question de son tirage, comme la page qui les liste (`JourStore.signalementsATraiter`) — le QG en annonçait qu'on n'y trouvait pas.
- **Le graphique vit dans un écran nocturne sous tous les thèmes** (`.qg-ecran`) : ses quatre couleurs — or, vert, orange, bleu, dans l'ordre de la pile (`MODES_DU_QG`) — ont été vérifiées sur ce fond, aux trois daltonismes ; les thèmes clairs les faisaient tomber. Une couleur ou un ordre changé se revérifie (le validateur de la skill `dataviz`), et `administration.test.ts` les garde. Chaque jour a son infobulle, la légende dit les chiffres du jour survolé — au toucher, il n'y a pas d'infobulle —, et le tableau des trente jours se déplie dessous, rendu à l'ouverture seulement.
- **Une durée ou une heure s'écrit insécable** (`dureeEcrite`, `heureEcrite`) : au téléphone, « 8 » finissait une ligne et « h 00 » ouvrait la suivante. Une phrase du journal passe par `espacesFines` à l'affichage : un « ouvrant restait seul en bout de ligne.
- **Le journal se tient de lui-même** : `journaliser`, posé sur `/api/admin` derrière sa porte (`api.ts`), note toute requête qui change quelque chose — tout sauf une lecture — et que le serveur accepte, une fois la réponse partie ; un refus ne s'y note jamais. **Une route de plus qui change quelque chose dit sa phrase** juste avant de répondre (`noterLeGeste(res, { sorte, resume, cible })`) : sans elle, elle se note par sa méthode et son chemin, et `journal.test.ts` — qui lit la liste des routes dans le routeur et les joue toutes — rougit tant qu'elle n'a ni phrase ni scénario. La phrase nomme ce qu'elle touche, lu avant le geste s'il va disparaître (un profil supprimé, un espace renommé), et ne s'accorde jamais à un prénom : elle parle du profil, de l'espace, de la question (« Profil masqué du classement du quiz du jour : Léa (@lea) »).
- **Le journal se relit derrière ses écritures** : elles partent après la réponse, l'une après l'autre (`file`), et une lecture les attend — la page qui revient d'un geste relit le journal aussitôt. Une écriture qui échoue se dit au journal du serveur, sans rien défaire : le geste, lui, a eu lieu.
