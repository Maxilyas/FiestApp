---
paths:
  - "shared/qg.ts"
  - "server/src/qg.ts"
  - "client/src/views/AdminApp.tsx"
  - "client/src/components/QgVueDEnsemble.tsx"
  - "server/test/qg.test.ts"
  - "server/scripts/rendu-qg.ts"
---

# Le QG de l'administrateur (`/admin`)

## Les fichiers

- `shared/qg.ts` — ce que le QG montre, dérivé à l'écart des magasins : les minuits de Paris (`minuitsDeParis`, lus dans le jour — le 25 octobre 2026 a vingt-cinq heures), un chiffre du jour comparé à la même heure des sept jours d'avant (`compteDuJour`, `ecartALHabitude` — en chiffre sous vingt d'habitude : trois contre deux ne font pas « 50 % de plus »), les participations des trente jours (`participationsParJour` : seul, un joueur compte une fois par mode et par jour ; en soirée, chaque invité qui a joué), où en est une soirée (`ouEnEstLaSoiree`, sans rien de son contenu), et ce qui attend un geste, le plus pressé d'abord (`lesChosesATraiter`)
- `server/src/qg.ts` — ses deux routes, sous `/api/admin` (gardées d'un bloc : `admin-seulement.test.ts` les trouve seul) : `/qg/direct` — les soirées pas encore closes, lues dans la base locale et en mémoire, le miroir, le serveur — et `/qg` — trente jours lus dans la base permanente, et ce qui attend un geste
- `client/src/views/AdminApp.tsx` · `client/src/components/QgVueDEnsemble.tsx` — la page : la vue d'ensemble, puis une page par sujet à son adresse (`/admin#jour`) ; à l'ordinateur (dès 1101 px), une barre de côté qui compte ce qui attend sur chaque page ; au téléphone, la liste des pages sous la vue d'ensemble et la barre du menu
- `server/scripts/rendu-qg.ts` — le QG photographié sur un serveur jetable — trente jours d'activité inventée, une soirée en cours, une laissée en plan — au téléphone, en 1366 × 768 et en 1920 × 1080, sous le Velours et sous l'Ivoire

## Les décisions (le 13 octobre 2026, avec le propriétaire, sur maquettes)

- **Des soirées des autres, rien que des chiffres** : le salon, où elle en est, combien d'invités, depuis quand, sa sauvegarde — ni le quiz, ni la question, ni un prénom d'invité. `qg.test.ts` relit la réponse entière du direct : un champ de plus au direct ne porte jamais de contenu.
- **Une soirée sans un geste depuis six heures est laissée en plan** (`EN_PLAN_MS`) : elle passe dans « À traiter ».
- **Les alertes vivent sur le QG seulement** : ni notification, ni courriel.
- **Les barèmes restent dans le code** : le QG agit sur le contenu, sur les joueurs et sur l'animation du serveur, jamais sur les règles du jeu.
- **Le plan, un lot par demande de fusion** : le squelette et la vue d'ensemble (fait), puis le journal des gestes de l'administrateur, les soirées et « Clore une soirée en plan », la fiche d'un joueur et ses gestes (réparer, offrir des confettis, modérer, aider à se reconnecter), la santé du serveur sur sept jours dans Turso, les pages des modes et de l'économie, enfin « Animer » (annonces, événements, défi de la semaine, mise en avant). Une page rejoint la barre de côté (`PAGES_DU_QG`) quand elle existe, jamais avant.

## Les pièges

- **La vue d'ensemble ne relit pas trente jours à chaque fois** : un QG reste ouvert sur un écran toute la journée, et chaque relecture compte au quota de Turso. Les jours finis se lisent une fois par jour et se gardent jusqu'à minuit (`lesTrenteJours`) ; seul aujourd'hui se relit, par des index de dates (`idx_campagne_series_commencee`, `idx_profile_xp_quand`, `idx_profiles_cree`, le jour de `jour_parties`), et la réserve du quiz du jour par ses seules questions prêtes (`avanceDeLaReserve` — `etatDeLaReserve` parcourt toute la réserve, pour la page qui la détaille). La page la redemande toutes les cinq minutes et en revenant d'une page, le direct toutes les dix secondes — lu en mémoire et dans la base locale, sans Turso —, et rien tant que l'onglet est caché. Les soirées se relisent toujours : une soirée d'hier close ce matin passe de la base locale aux archives, et ne doit pas disparaître du graphique. Un chiffre de plus tiré d'un journal qui grossit suit la même voie — le cache, et son index.
- **« Aujourd'hui » se compare à la même heure** des sept jours d'avant (`compteDuJour`), jamais à des journées entières : un soir à 21 h se lisait toujours en baisse.
- **Un chiffre du QG compte ce que sa page montre** : les signalements du quiz du jour ne comptent qu'une question de son tirage, comme la page qui les liste (`JourStore.signalementsATraiter`) — le QG en annonçait qu'on n'y trouvait pas.
- **Le graphique vit dans un écran nocturne sous tous les thèmes** (`.qg-ecran`) : ses quatre couleurs — or, vert, orange, bleu, dans l'ordre de la pile (`MODES_DU_QG`) — ont été vérifiées sur ce fond, aux trois daltonismes ; les thèmes clairs les faisaient tomber. Une couleur ou un ordre changé se revérifie (le validateur de la skill `dataviz`), et `administration.test.ts` les garde. Chaque jour a son infobulle, la légende dit les chiffres du jour survolé — au toucher, il n'y a pas d'infobulle —, et le tableau des trente jours se déplie dessous, rendu à l'ouverture seulement.
- **Une durée ou une heure s'écrit insécable** (`dureeEcrite`, `heureEcrite`) : au téléphone, « 8 » finissait une ligne et « h 00 » ouvrait la suivante.
