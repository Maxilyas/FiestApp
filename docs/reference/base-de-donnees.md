# La base de données

> Chaque table des deux bases de FiestApp : ce qu'elle garde, ses colonnes
> clés, si elle porte l'espace, qui l'écrit, qui la lit, et ce qui l'efface.
> Pour un développeur qui touche au stockage, ou qui cherche où vit une
> donnée.

**Dans cette page** : [Les deux bases](#les-deux-bases) ·
[Ce qui vide les bases](#ce-qui-vide-les-bases) ·
[La base locale](#la-base-locale) ·
[La base permanente](#la-base-permanente)

## Les deux bases

| | La base locale | La base permanente |
|---|---|---|
| Moteur | SQLite (better-sqlite3), en mode WAL | libSQL : Turso en ligne, un fichier `quizzes.db` chez soi |
| Adresse | `DB_PATH` (`server/data/quizz.db` par défaut) | `QUIZ_DB_URL` (et `QUIZ_DB_TOKEN`) |
| Ce qu'elle garde | la soirée en cours de chaque espace, et rien d'autre | tout ce qui doit survivre — comptes, profils, quiz, historique, quiz du jour, campagne, QG — et le **miroir** de la soirée |
| Sa durée de vie | **jetable** : le disque de l'hébergeur gratuit s'efface à chaque réveil | permanente |
| Qui l'ouvre | `initDb` (`server/src/core/db.ts`), une seule connexion synchrone | chaque magasin ouvre son client (`clientDistant`, `server/src/core/distante.ts`), avec un délai de dix secondes par aller-retour |
| Ses tables | 7 | 64, plus `soirees_v2`, qui ne vit que le temps d'une migration |

Chaque table se crée au démarrage, dans le magasin qui la possède
(`CREATE TABLE IF NOT EXISTS`) ; une colonne venue après coup s'ajoute par
`addColumn` dans la base locale (`server/src/core/db.ts`) et par
`ajouterColonne` dans la permanente (`server/src/core/distante.ts`), qui lit
le schéma au lieu de deviner, et dont l'échec arrête le démarrage. `meta` est
créée par trois magasins, d'où soixante-quatorze `CREATE TABLE` pour
soixante-douze tables.

**L'espace.** Un compte d'animateur **est** un espace : `accounts.id` sert de
`space_id` à tout ce qui appartient à une soirée ou à une bibliothèque. Ce
qui appartient à une personne — son profil, son quiz du jour, sa campagne —
se range par `profile_id`, sans espace. Le pourquoi :
[Les données](../architecture/donnees.md).

## Ce qui vide les bases

« Nouvelle soirée » n'existe plus comme geste : l'ancien message
`host:resetParty` mène à la clôture. Voici, geste par geste, ce qui s'efface.

| Le geste | La base locale (cet espace) | Le miroir (`party_*`, cet espace) | Le reste de la base permanente |
|---|---|---|---|
| « Clore la soirée » — à l'écran commun, à la barre du chef, depuis le QG pour une soirée laissée en plan, ou « Terminer le quiz » sur le dernier quiz du programme | les sept tables, **après** le miroir | effacé **d'abord** ; s'il refuse, rien ne bouge | la soirée reste dans `soirees`, ses crédits restent ; le code du salon se ferme (`salons.ferme_le`) |
| « C'était un essai » (et une clôture sans rien de joué) | les sept tables, après le miroir | effacé d'abord | l'archive (`soirees`) et tout ce qu'elle avait crédité aux profils (`profile_xp`, `profile_badges`, `profile_eclats`) |
| Retirer une soirée de l'historique (« Mon compte ») | — | — | la ligne de `soirees` et ses crédits, comme un essai |
| Exclure un invité | sa fiche (`players`), ses gains (`score_entries`), ses réponses (`answer_log`) | les mêmes lignes | sa ligne d'expérience de la soirée et l'Éclat tiré ce soir-là |
| « Reposer » une question, « Annuler les points » | les réponses de la question (`answer_log`) ; les gains, en ajout seul, ne s'effacent pas | les mêmes réponses | — |
| Retirer un prix remis, une équipe | sa ligne (`team_bonus`, `teams`) | la même ligne | — |
| Supprimer un espace (« Les salons », au QG) | tout ce que l'espace avait (`wipeSpace`) | tout ce que l'espace avait | ses quiz, ses photos, ses programmes, ses partages, son entrée au catalogue, son code de salon, son historique, ses sessions et liens d'activation, son compte — et, si l'administrateur le choisit, ce que ses soirées avaient crédité |
| Supprimer un profil (« Les profils », au QG) | — | — | sa fiche et ses sessions, son expérience, son étagère, ses Éclats, ses achats, les dons reçus, ses missions du jour et ses coffres, ses parties du quiz du jour et ses podiums, ses signalements, son masque, ses rappels du soir, ses séries de campagne et leurs réponses, ses paliers repris, ses envois et ses listes d'amis |

Et ce qui s'efface tout seul : au démarrage, les sessions et les liens
d'activation expirés, les sessions de profil expirées, les codes de salon
fermés depuis plus d'une demi-heure ; au relevé de la santé du serveur, ce qui
a plus de huit jours (`qg_sante`, `qg_demarrages`) ; au ménage des photos, une
photo que plus rien ne cite depuis une heure.

## La base locale

Sept tables, toutes rangées par `space_id` (un index chacune,
`idx_<table>_space`) — sauf `soiree`, dont c'est la clé. Ce sont les
**journaux** et les registres de la soirée en cours : le moteur y écrit de
façon synchrone, et chaque écriture rejoint aussitôt la file du miroir de son
espace (`server/src/core/backup.ts`). Au réveil sur un disque effacé, elles se
rechargent du miroir — seulement si aucune n'a d'invité ni d'équipe, tous
espaces confondus.

### `players`

Les invités de la soirée en cours, une ligne par fiche.

- **Colonnes clés** : `id`, `name`, `avatar`, `token` (unique : le jeton que garde le téléphone), `team_id`, `profile_id` (vide pour un invité sans compte), `created_at`.
- **Espace** : oui.
- **Écrite par** : `Party` (`server/src/core/party.ts`) — l'inscription, un jeton renouvelé, le rattachement à un profil, un renommage, une équipe, l'avatar relu — et la restauration du miroir.
- **Lue par** : `Party` ; `server/src/server.ts` (les soirées pas encore closes d'un profil) ; le QG (`server/src/qg.ts`) ; la resynchronisation du miroir, et la restauration, qui la compte.
- **Effacée par** : la clôture, l'essai effacé, l'exclusion d'un invité, la suppression de l'espace.

### `teams`

Les équipes de la soirée.

- **Colonnes clés** : `id`, `name`, `emoji`, `position`, `created_at`.
- **Espace** : oui.
- **Écrite par** : `Teams` (`server/src/core/teams.ts`), et la restauration.
- **Lue par** : `Teams` ; la resynchronisation ; la restauration, qui la compte.
- **Effacée par** : une équipe retirée, la clôture, l'essai effacé, la suppression de l'espace.

### `team_bonus`

Les prix remis aux équipes à l'écran, prix libres compris.

- **Colonnes clés** : `id`, `team_id`, `points`, `reason`, `created_at`.
- **Espace** : oui.
- **Écrite par** : `Teams` ; la restauration.
- **Lue par** : `Teams` ; la resynchronisation.
- **Effacée par** : un prix retiré, la clôture, l'essai effacé, la suppression de l'espace.

### `answer_log`

Le journal des réponses : une ligne par invité et par question posée, **y
compris sans réponse**. Le souvenir, le bilan, les statistiques, les hauts
faits et l'expérience s'en dérivent.

- **Colonnes clés** : `id` (auto-incrément), `uid` (unique, tiré à l'écriture locale : l'identifiant de la ligne au miroir), `session_id`, `quiz_title`, `q_index`, `kind`, `player_id`, `answered`, `correct`, `choice`, `value`, `target`, `ms`, `changes`, `points`, `duration_ms`, `observed`, `created_at`, `category`, `team_id` (l'équipe au moment de la réponse ; `''` sans équipe, vide pour une ligne d'avant la colonne), `compagnon` (celui de sa niche — jusqu'au 18 octobre 2026, celui qu'il portait).
- **Espace** : oui.
- **Écrite par** : `AnswerLog` (`server/src/core/answers.ts`), à la révélation de chaque question ; la restauration.
- **Lue par** : `AnswerLog` (et toutes les dérivations de la soirée) ; le QG ; la resynchronisation.
- **Effacée par** : « Reposer » et « Annuler les points » (les lignes de la question, `dropQuestion`) ; l'exclusion d'un invité ; la clôture, l'essai effacé, la suppression de l'espace.

### `score_entries`

Le journal des gains, **en ajout seul** : on n'écrase jamais un total, chaque
gain est une ligne ; une annulation s'écrit en lignes de plus.

- **Colonnes clés** : `id` (auto-incrément), `uid` (unique, tiré à l'écriture locale), `player_id`, `session_id`, `points`, `reason`, `created_at`.
- **Espace** : oui.
- **Écrite par** : `ScoreLedger` (`server/src/core/scores.ts`, `award`) ; la restauration.
- **Lue par** : `ScoreLedger`, qui en tient les totaux en mémoire ; la resynchronisation.
- **Effacée par** : l'exclusion d'un invité ; la clôture, l'essai effacé, la suppression de l'espace.

### `sessions`

Les parties de la soirée : celle en cours et celles qui sont finies.

- **Colonnes clés** : `id`, `status` (`running` ou `ended`), `participant_ids` (JSON), `state` (JSON : tout l'état de la partie, dont la **copie exacte** du quiz joué), `timers` (JSON : l'échéance de chaque chronomètre), `created_at`, `updated_at`.
- **Espace** : oui.
- **Écrite par** : `GameEngine` (`server/src/core/engine.ts`), à chaque changement de la partie — l'état d'une simple réponse à la fin du tour de boucle ; sa copie au miroir part tout de suite à un changement de phase ou de chronomètre, sinon au plus toutes les deux secondes ; la restauration.
- **Lue par** : le moteur, qui reprend la partie et réarme ses chronomètres au redémarrage ; `SpaceRegistry.wakeRunning` (`server/src/core/space.ts`), qui réveille les espaces dont une partie tournait ; `server/src/server.ts` (les photos encore en jeu) ; le QG ; la resynchronisation.
- **Effacée par** : la clôture, l'essai effacé, la suppression de l'espace.

### `soiree`

Le nom de la soirée en cours, tiré une seule fois : une ligne par espace.

- **Colonnes clés** : `space_id` (la clé), `id` (le nom, qui porte une empreinte de l'espace), `held_at` (l'heure de la première question jouée).
- **Espace** : c'est sa clé.
- **Écrite par** : `SpaceRuntime` (`server/src/core/space.ts`, au premier besoin d'écrire sous ce nom) ; la restauration.
- **Lue par** : `SpaceRuntime` ; `server/src/server.ts` (le recalcul au démarrage laisse de côté les soirées en cours) ; le QG ; la resynchronisation.
- **Effacée par** : la clôture et l'essai effacé — les seuls gestes qui oublient un nom ; la suppression de l'espace.

## La base permanente

Soixante et une tables, rangées ici par famille, plus une table de migration. La
plupart des magasins gardent ce qu'ils lisent en mémoire et écrivent d'abord
en base ; chaque écriture qui doit tenir ensemble part en une transaction
(`batch(…, 'write')`).

**Les comptes** (`server/src/auth/store.ts`) — un compte est un espace.

### `accounts`

Les comptes d'animateur, c'est-à-dire les espaces : salons ouverts par un
profil, et comptes à mot de passe d'avant.

- **Colonnes clés** : `id` (le `space_id` de tout le reste, qui ne change jamais), `login` (unique), `name`, `slug` (unique : l'adresse de l'espace), `role` (`admin` ou `host`), `password_hash` (vide : pas de mot de passe), `disabled_at`, `created_at`, `last_login_at`, `settings` (JSON : les réglages de l'espace, dont « Invités au plus »), `profile_id` (le profil qui tient l'espace).
- **Espace** : c'est lui.
- **Écrite par** : `AuthStore` — le premier démarrage (l'administrateur), l'ouverture d'un salon, les réglages, le rattachement d'un profil, la désactivation.
- **Lue par** : `AuthStore`, qui tient tout en mémoire ; `server/src/core/export.ts` (l'export lu dans la base).
- **Effacée par** : la suppression de l'espace, en tout dernier.

### `auth_sessions`

Les sessions d'animateur : écrans communs, consoles, télés branchées.

- **Colonnes clés** : `id` (l'empreinte SHA-256 du jeton, jamais le jeton), `account_id`, `created_at`, `expires_at` (glissante), `last_seen_at`, `user_agent`, `profile_id` (le profil qui l'a ouverte), `fin_max` (le plafond d'une télé branchée).
- **Espace** : par `account_id`.
- **Écrite par** : `AuthStore` (connexion, appairage d'une télé, glissement de l'échéance).
- **Lue par** : `AuthStore`.
- **Effacée par** : la déconnexion, un changement de mot de passe ou de titulaire, la désactivation ou la suppression de l'espace ; les sessions expirées, au démarrage.

### `activations`

Les liens d'activation d'un compte à mot de passe : sept jours, un seul usage.

- **Colonnes clés** : `id` (l'empreinte du jeton), `account_id`, `created_at`, `expires_at`, `used_at`.
- **Espace** : par `account_id`.
- **Écrite par** : `AuthStore`.
- **Lue par** : `AuthStore`.
- **Effacée par** : un lien neuf pour le même compte ; au démarrage, ceux qui ont servi ou expiré ; la suppression de l'espace.

### `meta`

Les drapeaux de la base : une migration faite une fois pour toutes, et
quelques réglages du serveur. Une table que partagent trois magasins.

- **Colonnes clés** : `key`, `value`. Clés : `default_space` (l'espace de l'administrateur, `AuthStore`), `sessions_profil` (`AuthStore`), `seeded` (les quiz d'amorce copiés, `QuizStore`), et les drapeaux des reprises et des durcissements, que pose `ProfileStore` : `profil-unique-2026-10-03`, `sentiers-du-savoir-2026-10-05`, `bareme-du-solo-2026-10-06`, `legendaires_durcis`, `courbe_durcie`, `niches_installees` (les niches jamais choisies, figées sur ce qu'elles montraient : `ProfileStore.installerLesNiches`).
- **Espace** : non.
- **Écrite par** : `AuthStore`, `QuizStore` (`server/src/core/quizStore.ts`), `ProfileStore` (`server/src/auth/profiles.ts`) ; `npm run migrate` pose `seeded` à destination.
- **Lue par** : les mêmes ; `server/src/core/export.ts`.
- **Effacée par** : rien. Un drapeau effacé referait sa reprise au démarrage suivant.

**Les profils** (`server/src/auth/profiles.ts`) — une personne, avec son
cookie à elle. Tout s'y range par `profile_id` ; `ProfileStore` tient en
mémoire ce qu'il a lu.

### `profiles`

Les profils de joueur.

- **Colonnes clés** : `id`, `login` (unique), `name`, `avatar`, `finition`, `password_hash`, `recovery_hash` (le code de secours, haché), `xp` (le total), `created_at`, `last_seen_at`, `disabled_at` (suspendu), et ce qu'il porte : `legendaire`, `titre`, `vitrine` (JSON), `fond`, `theme`, `gerbe`, `bordure` ; `niche`, le compagnon qu'il a installé dans sa niche (NULL : celui que la règle désigne, `compagnonDeLaNiche` — le plus grand des siens ; les niches jamais choisies se sont figées une fois, le 19 octobre 2026, sur ce qu'elles montraient, drapeau `niches_installees`, et une adoption ou un coffre écrit la sienne) ; ainsi que `renomme_le`.
- **Espace** : non.
- **Écrite par** : `ProfileStore` — l'inscription, l'adoption d'un compte d'avant, la loge, les mots de passe, les crédits, l'administration.
- **Lue par** : `ProfileStore` ; `JourStore` (`server/src/core/jour.ts` : les classements, qui écartent les profils suspendus).
- **Effacée par** : la suppression du profil, en dernier.

### `profile_sessions`

Les sessions de profil (le cookie de joueur, un an).

- **Colonnes clés** : `id` (l'empreinte du jeton), `profile_id`, `created_at`, `expires_at`, `last_seen_at`, `user_agent`.
- **Espace** : non.
- **Écrite par** : `ProfileStore` (connexion, inscription, glissement).
- **Lue par** : `ProfileStore`.
- **Effacée par** : la déconnexion, un changement de mot de passe, le code de secours, la suspension, la suppression du profil ; les sessions expirées, au démarrage.

### `profile_xp`

L'expérience, une ligne par profil et par soirée — **remplacée** à chaque
crédit, jamais ajoutée —, plus cinq lignes à part : `#paliers` (paliers et
hauts faits hors des soirées), `#jour`, `#campagne`, `#rattrapage`,
`#missions` (les missions du jour faites et leurs bonus, recomptés de
`profile_missions`).

- **Colonnes clés** : `profile_id` et `soiree_id` (la clé), `space_id`, `xp`, `detail` (JSON versionné : `{ v, gain, releve }`), `created_at`, `joueur_id` (sa fiche dans la soirée).
- **Espace** : oui pour une soirée ; vide pour les lignes à part.
- **Écrite par** : `ProfileStore` — les crédits d'après chaque quiz et de la clôture, le quiz du jour, la campagne, le recalcul au démarrage.
- **Lue par** : `ProfileStore` (total, niveau, historique) ; `JourStore` (une soirée jouée compte un jour de la série du jour) ; le QG (les participations, l'économie).
- **Effacée par** : l'essai effacé, une soirée retirée de l'historique, l'exclusion (sa ligne de la soirée), l'espace supprimé « en reprenant », la suppression du profil.

### `profile_badges`

L'étagère : prix du palmarès, hauts faits, paliers de carrière, Divins,
saisons, titres et pages du mois — et les légendaires gardés au bout d'une
expédition (`expedition:<légendaire>`), comme les saisons hors de l'étagère
et du compte des badges.

- **Colonnes clés** : `profile_id`, `badge`, `soiree_id` (la clé à trois ; `soiree_id` vaut le nom de la soirée, ou `#jour:…`, `#mois:…`, `#campagne:…`, `#defi:…` hors des soirées — une expédition range son légendaire sous `#campagne:<son id>`), `space_id`, `emoji`, `title`, `created_at`.
- **Espace** : oui pour une soirée.
- **Écrite par** : `ProfileStore` — la clôture (`remplacerRecompensesDeSoiree`, remplacée en un lot), les paliers, le quiz du jour, la campagne, le recalcul.
- **Lue par** : `ProfileStore` ; `JourStore`.
- **Effacée par** : le remplacement des récompenses d'une soirée, l'essai effacé, une soirée retirée, la suppression du profil.

### `profile_eclats`

Les Éclats : la version rare d'un avatar, une ligne par profil et par avatar.

- **Colonnes clés** : `profile_id` et `avatar` (la clé), `soiree_id` (la soirée, ou le jour, ou la semaine du défi, qui l'a fait tomber), `created_at` (indexée : le QG compte les Éclats tombés ces trente jours), `eteint` (porté dans sa version d'origine).
- **Espace** : non.
- **Écrite par** : `ProfileStore` (le tirage, la loge).
- **Lue par** : `ProfileStore` ; la page de l'économie du QG (`economieDepuis`).
- **Effacée par** : l'essai effacé, une soirée retirée, l'exclusion, la suppression du profil.

### `profile_niveaux`

Les niveaux qu'un profil a atteints sous une courbe d'avant, gardés quand la
courbe s'est durcie (`COURBES_D_AVANT`) : un niveau ne redescend jamais.

- **Colonnes clés** : `profile_id` et `pas` (la clé), `niveau`, `created_at`.
- **Espace** : non.
- **Écrite par** : `ProfileStore`, au démarrage qui apporte le durcissement.
- **Lue par** : `ProfileStore` (`niveauDuProfil`).
- **Effacée par** : la suppression du profil.

### `profile_legendaires`

Les légendaires acquis sous une règle d'avant, gardés quand elle s'est durcie
(`DURCISSEMENTS`), avec la règle d'alors.

- **Colonnes clés** : `profile_id` et `legendaire` (la clé), `regle` (JSON), `created_at`.
- **Espace** : non.
- **Écrite par** : `ProfileStore`, au démarrage qui apporte le durcissement.
- **Lue par** : `ProfileStore`.
- **Effacée par** : la suppression du profil.

### `profile_achats`

Les thèmes achetés en confettis, au prix payé.

- **Colonnes clés** : `profile_id` et `theme` (la clé), `prix`, `created_at` (indexée : la page de l'économie du QG lit les achats par date).
- **Espace** : non.
- **Écrite par** : `ProfileStore` (la boutique).
- **Lue par** : `ProfileStore` (le solde se relit : ce qu'on a gagné, moins ce qu'on a payé) ; la page de l'économie du QG (`economieDepuis`, `ventesDepuis`).
- **Effacée par** : la suppression du profil.

### `profile_vies`

Les vies des sentiers du savoir achetées en confettis.

- **Colonnes clés** : `id`, `profile_id`, `nombre`, `prix`, `created_at` (indexée : le QG lit les achats jour par jour).
- **Espace** : non.
- **Écrite par** : `ProfileStore` (`acheterVies`), jamais modifiée.
- **Lue par** : `ProfileStore`, la campagne ; le QG (la page de la campagne, l'économie).
- **Effacée par** : la suppression du profil.

### `profile_sabliers`

Les sabliers qui protègent la série du quiz du jour, une ligne par sablier.

- **Colonnes clés** : `id`, `profile_id`, `prix`, `created_at` (indexée : le QG compte ceux du mois).
- **Espace** : non.
- **Écrite par** : `ProfileStore` (`acheterSablier`), jamais modifiée.
- **Lue par** : `ProfileStore` ; `JourStore` (la série, le QG) ; l'économie du QG.
- **Effacée par** : la suppression du profil.

### `profile_compagnons`

Les compagnons achetés, la plus haute forme que chacun a atteinte, et ce qu'il en a réglé depuis sa niche.

- **Colonnes clés** : `profile_id` et `compagnon` (la clé), `prix`, `rang` (ne fait que monter), `created_at` (indexée : la page de l'économie du QG lit les achats par date) ; `nom`, le nom qu'il lui a donné (NULL : aucun ; à lui seul, rien ne le montre à la salle), et `montree`, le rang de la forme qu'il montre dans sa niche quand ce n'est pas la plus haute (NULL : la plus haute, qui suit sa croissance — une forme atteinte la remet à NULL).
- **Espace** : non.
- **Écrite par** : `ProfileStore` (l'achat — qui l'installe aussi dans sa niche, `profiles.niche`, sauf `installer: false` —, la croissance, `reglerCompagnon` pour `nom` et `montree`).
- **Lue par** : `ProfileStore` ; la page de l'économie du QG (`economieDepuis`, `ventesDepuis`).
- **Effacée par** : la suppression du profil.

### `profile_fonds`

Les fonds des savoirs achetés en boutique (`shared/fonds.ts`), un par profil et par fond. Les fonds qui se gagnent n'y sont pas — ils se relisent à chaque affichage —, ni ceux du trésor, dans `profile_coffres`.

- **Colonnes clés** : `profile_id` et `fond` (la clé), `prix` (celui qu'il a payé), `created_at` (indexée : la page de l'économie du QG lit les achats par date).
- **Espace** : non.
- **Écrite par** : `ProfileStore.acheterFond` (`POST /api/joueur/fonds`), jamais modifiée.
- **Lue par** : `ProfileStore` — avec le profil (`byIds` : les fonds qu'il peut porter, `fondsOuverts`), le solde (`achatsDe`) ; la page de l'économie du QG (`economieDepuis`, `partsDesSoldes`, `ventesDepuis`).
- **Effacée par** : la suppression du profil.

### `profile_dons`

Les confettis offerts par l'administrateur, avec leur mot.

- **Colonnes clés** : `id`, `profile_id`, `confettis`, `mot`, `created_at` (indexée : la page de l'économie du QG lit les dons par date).
- **Espace** : non.
- **Écrite par** : `ProfileStore` (`offrirDesConfettis`, depuis la fiche d'un joueur au QG), jamais modifiée.
- **Lue par** : `ProfileStore` (le solde, l'annonce sur l'accueil) ; la page de l'économie du QG (`economieDepuis`, « Tes dons »).
- **Effacée par** : la suppression du profil.

### `profile_loge_vus`

Ce que chaque profil a déjà vu dans sa loge, pièce par pièce : la pastille rouge de « Profil », de « M'habiller » et des pièces compte ce qu'il a et qui n'y est pas.

- **Colonnes clés** : `profile_id` (la clé), `vus` (`VusDeLaLoge` en JSON, réduit par `lireLesVus`), `retenu_le`.
- **Espace** : non.
- **Écrite par** : `ProfileStore.retenirLesVusDeLaLoge` — la loge à chaque pièce regardée (`PUT /api/joueur/vus`), et `GET /api/joueur/nouveautes` la première fois, tout ce qu'il a vu d'un coup ; la ligne d'avant se remplace.
- **Lue par** : `ProfileStore.vusDeLaLoge` (le détail du profil, le compte des nouveautés).
- **Effacée par** : la suppression du profil.

### `profile_missions`

Les missions du jour de chaque profil (`shared/missions.ts`) : les trois
tirées à sa première visite du jour, figées, et la ligne des trois — celle
qui fait le tampon de la semaine.

- **Colonnes clés** : `profile_id`, `jour` et `rang` (la clé à trois ; `rang` 0 à 2 pour les missions, 3 pour la ligne des trois), `mission` (JSON : `{ sorte, cible, categorie? }`, `{}` pour la ligne des trois), `tiree_le`, `faite_le` (indexée : la page de l'économie du QG lit les missions faites par date).
- **Espace** : non.
- **Écrite par** : `ProfileStore` — `tirerLesMissions` à la première lecture du jour (`GET /api/joueur/missions`), `accomplirDesMissions` quand ses journaux disent une mission faite, jamais reprise.
- **Lue par** : `ProfileStore` (le solde : quinze confettis par mission faite et par ligne des trois, `gainsDesMissions` ; la ligne d'expérience `#missions` ; les tampons et les coffres qui attendent) ; la page de l'économie du QG (`economieDepuis`, `partsDesSoldes`).
- **Effacée par** : la suppression du profil.

### `profile_coffres`

Les coffres de la semaine ouverts (`shared/coffre.ts`), un par profil et par
semaine : le tirage, fait une fois, et ce qu'il a donné.

- **Colonnes clés** : `profile_id` et `semaine` (la clé ; le lundi de la semaine dont les tampons l'ont rempli), `tampons`, `rang` (`bois`, `argent`, `or`, `royal`), `rarete`, `objet` (`fond:dragon`, `gerbe:papillons`, `theme:jungle`, `compagnon:loup`, `confettis`), `confettis`, `ouvert_le` (indexée : la page de l'économie du QG).
- **Espace** : non.
- **Écrite par** : `ProfileStore.ouvrirUnCoffre` (`POST /api/joueur/coffre`), jamais modifiée — un thème ou un compagnon tiré s'écrit aussi dans `profile_achats` ou `profile_compagnons`, à prix nul.
- **Lue par** : `ProfileStore` — avec le profil (`byIds` : les fonds et les gerbes du trésor qu'il porte, `tresorsOf`), le solde (ses confettis), un coffre rouvert (`coffreDe`) ; la page de l'économie du QG.
- **Effacée par** : la suppression du profil.

**Le miroir de la soirée** (`server/src/core/backup.ts`) — la copie, dans la
base permanente, des sept tables locales. Il n'existe que pour survivre à un
disque effacé : rien ne le lit en marche normale. Toutes ses écritures passent
par la file de leur espace, sauf le nom de la soirée.

### `party_players`

La copie de `players`.

- **Colonnes clés** : celles de `players`, sauf la contrainte d'unicité du jeton.
- **Espace** : oui.
- **Écrite par** : `PartyBackup`, à chaque écriture locale et à la resynchronisation.
- **Lue par** : la restauration au démarrage (`restoreInto`) ; la resynchronisation, qui compare ; `npm run export -- --db` (`server/src/core/export.ts`).
- **Effacée par** : l'exclusion d'un invité ; la remise à zéro de l'espace — clôture, essai effacé, espace supprimé —, avant la base locale.

### `party_teams`

La copie de `teams`.

- **Colonnes clés** : celles de `teams`.
- **Espace** : oui.
- **Écrite par** : `PartyBackup`.
- **Lue par** : la restauration, la resynchronisation, l'export lu dans la base.
- **Effacée par** : une équipe retirée ; la remise à zéro de l'espace.

### `party_bonus`

La copie de `team_bonus`.

- **Colonnes clés** : celles de `team_bonus`.
- **Espace** : oui.
- **Écrite par** : `PartyBackup`.
- **Lue par** : la restauration, la resynchronisation, l'export lu dans la base.
- **Effacée par** : un prix retiré ; la remise à zéro de l'espace.

### `party_answers`

La copie de `answer_log`.

- **Colonnes clés** : `id` (l'`uid` de la ligne locale : une recopie rejouée tombe sur la même ligne), puis les colonnes de `answer_log`.
- **Espace** : oui.
- **Écrite par** : `PartyBackup`, dans le lot du passage du moteur qui l'a écrite.
- **Lue par** : la restauration, la resynchronisation, l'export lu dans la base.
- **Effacée par** : « Reposer », « Annuler les points », l'exclusion ; la remise à zéro de l'espace.

### `party_scores`

La copie de `score_entries`.

- **Colonnes clés** : `id` (l'`uid` de la ligne locale), `player_id`, `session_id`, `points`, `reason`, `created_at`.
- **Espace** : oui.
- **Écrite par** : `PartyBackup`, dans le même lot que l'état de la partie qui l'a payée.
- **Lue par** : la restauration, la resynchronisation, l'export lu dans la base.
- **Effacée par** : l'exclusion ; la remise à zéro de l'espace.

### `party_sessions`

La copie de `sessions`, état et chronomètres compris.

- **Colonnes clés** : celles de `sessions`.
- **Espace** : oui.
- **Écrite par** : `PartyBackup` — un état seul remplace les états seuls qui attendaient dans la file.
- **Lue par** : la restauration (la partie en cours repart d'elle) ; la resynchronisation ; l'export lu dans la base.
- **Effacée par** : la remise à zéro de l'espace.

### `party_soiree`

La copie de `soiree` : le nom de la soirée en cours.

- **Colonnes clés** : `space_id` (la clé), `id`, `held_at`.
- **Espace** : c'est sa clé.
- **Écrite par** : `PartyBackup.saveSoiree`, **hors de la file**, tout de suite : son appelant l'attend avant d'écrire sous ce nom ; refusée, elle repasse par la file.
- **Lue par** : la restauration ; la resynchronisation.
- **Effacée par** : la remise à zéro de l'espace.

**La bibliothèque** — les quiz de chaque espace, leurs photos, leurs
programmes et leurs partages.

### `quizzes`

Les quiz de chaque espace, brouillons compris.

- **Colonnes clés** : `id`, `title`, `questions` (JSON), `created_at`, `updated_at`, `space_id`, `reglages` (JSON : réponses mélangées, ordre, tirage), `archived_at`.
- **Espace** : oui.
- **Écrite par** : `QuizStore` (`server/src/core/quizStore.ts`) — l'éditeur, les imports, les modèles, la copie des quiz d'amorce au premier démarrage (`seedLibrary`, `server/src/core/seed.ts`) ; `npm run migrate`.
- **Lue par** : `QuizStore`, qui recharge la bibliothèque jouable d'un espace après chaque écriture ; les routes de l'éditeur.
- **Effacée par** : la suppression d'un quiz ; la suppression de l'espace.

### `quiz_images`

Les photos des quiz, servies par `/media/image/<id>` : l'identifiant, tiré au
hasard, est la permission.

- **Colonnes clés** : `id` (UUID), `mime`, `bytes` (le fichier), `data` (l'ancienne forme en base64, vide aujourd'hui), `created_at`, `space_id`, `orpheline_depuis` (depuis quand plus aucun quiz ne la cite).
- **Espace** : oui.
- **Écrite par** : `QuizStore` (l'envoi d'une photo) ; `npm run migrate`, qui ne l'écrase jamais.
- **Lue par** : `QuizStore`, qui en garde une partie en mémoire.
- **Effacée par** : le ménage des photos (`pruneImages`) — une photo qu'aucun quiz, aucune archive, aucune partie encore sur le disque ni aucun partage vivant ne cite, après une heure de grâce (`IMAGE_GRACE_MS`) ; la suppression de l'espace.

### `programmes`

Le programme de la soirée : les quiz de ce soir, dans l'ordre.

- **Colonnes clés** : `id`, `space_id`, `titre`, `entrees` (JSON), `actif`, `created_at`, `updated_at`.
- **Espace** : oui.
- **Écrite par** : `ProgrammeStore` (`server/src/core/programmes.ts`).
- **Lue par** : `ProgrammeStore`, qui recharge le programme actif de l'espace en mémoire.
- **Effacée par** : la suppression d'un programme ; la suppression de l'espace.

### `partages`

Les codes de partage d'un quiz entre animateurs.

- **Colonnes clés** : `code`, `space_id`, `quiz_id`, `snapshot` (le quiz figé au partage), `created_at`, `expires_at`, `revoked_at`, `recus`.
- **Espace** : oui, celui qui partage.
- **Écrite par** : `PartageStore` (`server/src/core/partages.ts`).
- **Lue par** : `PartageStore`.
- **Effacée par** : la suppression de l'espace ; un code révoqué ou expiré reste, et ne mène plus à rien.

### `catalogue`

Les quiz proposés au catalogue du serveur, et leur statut.

- **Colonnes clés** : `id`, `space_id`, `quiz_id`, `auteur`, `titre`, `description`, `questions` (leur nombre), `snapshot`, `statut` (`propose`, `publie`, `refuse`, `retire`), `created_at`, `updated_at`.
- **Espace** : oui, celui qui propose.
- **Écrite par** : `PartageStore` (la proposition, la décision de l'administrateur).
- **Lue par** : `PartageStore`.
- **Effacée par** : la suppression de l'espace.

**Les salons** (`server/src/core/salons.ts`)

### `salons`

Le code à six chiffres de chaque salon ouvert, que les invités tapent ou
scannent.

- **Colonnes clés** : `code` (la clé), `space_id` (unique), `ouvert_le`, `ferme_le` (vide tant que le salon est ouvert), `auto` (un salon ouvert depuis un téléphone, par « Créer un salon » : sa fin suit son programme — le dernier quiz joué, la barre du chef propose « Terminer la soirée »).
- **Espace** : oui.
- **Écrite par** : `SalonStore` — l'ouverture (par un écran d'animateur ou « Ouvrir le salon »), la fermeture à la clôture.
- **Lue par** : `SalonStore`, qui tient les codes en mémoire et mène `/<code>` à l'adresse de l'espace.
- **Effacée par** : un nouveau code pour le même espace ; au démarrage, les codes fermés depuis plus d'une demi-heure (`SURSIS_APRES_CLOTURE_MS`) ; la suppression de l'espace.

**L'historique** (`server/src/core/archive.ts`)

### `soirees`

Les soirées rangées : une ligne par soirée et par espace, réécrite après
chaque quiz et à la clôture.

- **Colonnes clés** : `space_id` et `id` (la clé ; `id` est le nom de la soirée), `title`, `held_at` (indexée : le QG lit les soirées par date), `archived_at`, `summary` (JSON : la fiche, relue par les listes), `data` (JSON : l'archive entière — invités, équipes, prix, journaux, et la copie de chaque quiz joué).
- **Espace** : oui.
- **Écrite par** : `ArchiveStore` — le rangement d'après chaque quiz (`apresQuiz`) et de la clôture, un renommage.
- **Lue par** : `ArchiveStore` — l'historique, le souvenir et le bilan d'une archive, la mémoire des questions déjà posées ; le recalcul au démarrage ; le QG ; le ménage des photos.
- **Effacée par** : « C'était un essai », une soirée retirée de l'historique, la suppression de l'espace.

### `soirees_v2`

La table de passage d'une migration : quand `soirees` date d'avant les
espaces (sans `space_id`), le démarrage la reconstruit sous ce nom, y recopie
chaque soirée rattachée à l'espace par défaut, efface l'ancienne et renomme
celle-ci `soirees` — le tout en une transaction. Elle n'existe jamais en
dehors.

- **Colonnes clés** : celles de `soirees`.
- **Espace** : oui.
- **Écrite par** : `ArchiveStore.init`, une seule fois.
- **Lue par** : personne.
- **Effacée par** : son renommage, dans la même transaction.

**Le quiz du jour** (`server/src/core/jour.ts`, `JourStore`) — tout s'y
range par profil ou par jour (de Paris), sans espace.

### `jour_reserve`

La réserve de questions du quiz du jour.

- **Colonnes clés** : `id`, `question` (JSON), `empreinte` (unique : l'intitulé normalisé, contre les doublons), `categorie`, `source` (`livre`, `liste` ou `ia`), `ajoutee_le`, `posee_le` (le jour qui l'a tirée), `retiree_le`, `metadonnees` (JSON, l'étiquetage), `etiquetee_le`.
- **Espace** : non.
- **Écrite par** : `JourStore` — l'amorce des quiz livrés au premier démarrage, « Coller une liste » au QG, le dépôt de la routine, le tirage, un retrait, l'étiquetage ; « Corriger » et « Reclasser » à la page des signalements (la question, son empreinte, sa catégorie, ses métadonnées).
- **Lue par** : `JourStore` (le tirage, la consigne de la routine, le QG — la page des signalements lit la version d'une question signalée, et ses métadonnées) ; la campagne, qui écarte ses intitulés.
- **Effacée par** : rien : une question retirée garde sa ligne (`retiree_le`).

### `jour_apports`

Le journal des apports à la réserve : qui a ajouté quoi, et ce qui a été
écarté.

- **Colonnes clés** : `id`, `quand`, `source`, `ajoutees`, `ecartees` (JSON).
- **Espace** : non.
- **Écrite par** : `JourStore`, à chaque apport.
- **Lue par** : `JourStore` (le QG ; `/healthz`, la date du dernier apport).
- **Effacée par** : rien.

### `jour_tirages`

Les dix questions de chaque jour, tirées à la première demande et figées.

- **Colonnes clés** : `jour` (la clé), `questions` (JSON : la copie jouée), `annulees` (JSON), `tire_le`.
- **Espace** : non.
- **Écrite par** : `JourStore` (le tirage, l'annulation d'une question).
- **Lue par** : `JourStore`, qui garde le tirage en mémoire.
- **Effacée par** : rien.

### `jour_parties`

La partie de chaque profil, chaque jour.

- **Colonnes clés** : `profile_id` et `jour` (la clé), `commencee_le`, `question`, `servie_le`, `points`, `justes`, `finie_le`, `xp`, `xp_serie` (le bonus de série, payé dès le début).
- **Espace** : non.
- **Écrite par** : `JourStore`.
- **Lue par** : `JourStore` (classements, séries, carrière, QG).
- **Effacée par** : la suppression du profil.

### `jour_reponses`

Ses réponses, question par question.

- **Colonnes clés** : `profile_id`, `jour`, `question` (la clé à trois), `choix`, `ms`, `juste`, `points`, `repondue_le`, `compagnon`.
- **Espace** : non.
- **Écrite par** : `JourStore`.
- **Lue par** : `JourStore` (la correction, la difficulté mesurée, le savoir) ; la croissance des compagnons.
- **Effacée par** : la suppression du profil.

### `jour_clotures`

La nuit de chaque jour clos : combien de joueurs, et quand.

- **Colonnes clés** : `jour` (la clé), `joueurs`, `close_le`.
- **Espace** : non.
- **Écrite par** : `JourStore`, à la première demande du lendemain.
- **Lue par** : `JourStore`.
- **Effacée par** : rien.

### `jour_podiums`

Le podium de chaque jour clos, et l'expérience qu'il a payée.

- **Colonnes clés** : `jour` et `profile_id` (la clé), `rang`, `points`, `xp`.
- **Espace** : non.
- **Écrite par** : `JourStore`, à la clôture du jour.
- **Lue par** : `JourStore`.
- **Effacée par** : la suppression du profil.

### `jour_signalements`

Les questions du jour signalées par les joueurs.

- **Colonnes clés** : `jour`, `question`, `profile_id` (la clé à trois), `texte`, `cree_le`, `traite_le`, `issue` (ce qu'un geste du QG en a fait : `gardee`, `corrigee`, `reclassee`, `retiree`, `annulee` ; vide pour un signalement relu avant le 14 octobre 2026), `detail` (comment, pour l'historique : « nouvelle bonne réponse : 1997 »). Signalée de nouveau, la ligne repart sans `traite_le`, `issue` ni `detail`. Index `(profile_id, traite_le)`, pour le merci de l'accueil.
- **Espace** : non.
- **Écrite par** : `JourStore` (le signalement ; au QG, chaque geste — garder, corriger, reclasser, retirer, annuler — dans son propre lot).
- **Lue par** : `JourStore` (la page des signalements du QG, son historique de trente jours, le merci sur l'accueil du joueur).
- **Effacée par** : la suppression du profil.

### `jour_masques`

Les profils masqués du classement du quiz du jour.

- **Colonnes clés** : `profile_id` (la clé), `masque_le`.
- **Espace** : non.
- **Écrite par** : `JourStore` (le QG).
- **Lue par** : `JourStore`, et tout ce qui liste des joueurs.
- **Effacée par** : le démasquage ; la suppression du profil.

### `jour_meta`

Les drapeaux du quiz du jour.

- **Colonnes clés** : `cle`, `valeur` — `amorcee` (la réserve a pris les quiz livrés), `relecture_des_jours` (la `VERSION_DES_JOURS` déjà relue), `mois_clos:AAAA-MM`.
- **Espace** : non.
- **Écrite par** : `JourStore`.
- **Lue par** : `JourStore`.
- **Effacée par** : rien.

**Le rappel du soir** (`server/src/core/rappels.ts`, `RappelStore`)

### `jour_rappels`

Les téléphones abonnés au rappel du soir.

- **Colonnes clés** : `endpoint` (la clé : l'adresse du service de push), `profile_id`, `session_id` (la session qui l'a demandé), `p256dh`, `auth`, `vu_le`, `dernier_jour` (réservé en base avant l'envoi : un redémarrage ne renvoie pas le rappel du jour), `soir`.
- **Espace** : non.
- **Écrite par** : `RappelStore` (la cloche, la page du jour qui le rattache, la tournée).
- **Lue par** : `RappelStore` (la tournée de 18 h, le QG).
- **Effacée par** : la cloche coupée ; un abonnement que le service de push dit mort, ou dont la session s'est fermée ; au-delà de cinq téléphones par profil ; la suppression du profil.

### `jour_rappels_cles`

Les clés VAPID du serveur, tirées au premier démarrage : une seule ligne. Un
secret, que la sauvegarde emporte.

- **Colonnes clés** : `id` (toujours 1), `publique`, `privee`, `cree_le`.
- **Espace** : non.
- **Écrite par** : `RappelStore.init`, une fois.
- **Lue par** : `RappelStore`.
- **Effacée par** : rien.

### `jour_rappels_tournees`

Le bilan de chaque soir de rappel : des nombres, jamais un nom.

- **Colonnes clés** : `jour` (la clé), `envoyes`, `finis` (ceux qui avaient déjà joué), `retires` (abonnements défaits), `echecs`, `faite_le`. Une seconde tournée le même soir — un redémarrage, un second serveur — s'y ajoute ; `finis` garde le plus grand des deux comptes.
- **Espace** : non.
- **Écrite par** : `RappelStore`, à la fin de chaque tournée qui avait quelqu'un à prévenir.
- **Lue par** : `RappelStore.suivi`, pour la page du quiz du jour au QG (les sept derniers soirs).
- **Effacée par** : rien.

**La campagne, les sentiers et les duels** (`server/src/core/campagne.ts`,
`CampagneStore`) — par profil, sans espace.

### `campagne_series`

Toutes les parties de la campagne, quel que soit leur mode : série, épreuve
de sentier, parcours de thème, révision, défi de la semaine, duel, rencontre,
expédition.

- **Colonnes clés** : `id`, `profile_id`, `questions` (JSON : les questions telles que la partie les a lues — d'une expédition, chacune avec son escale et son acte, et `carnet` quand une source l'a reprise du carnet : ni la mesure, ni les écussons, ni L'Érudit ne comptent alors sa réponse), `position`, `vies`, `justes`, `commencee_le`, `finie_le`, `mode`, et selon le mode `branche`, `palier`, `seuil`, `rejeu`, `issue`, `chance` (une épreuve en jeu : la chance de la valider que la page des sentiers annonçait à son départ, que Contre toute attente relit ; NULL sans annonce), `categories`, `sujet`, `semaine`, `duel`, `adversaire`, `expedition` (JSON versionné, `DepartDExpedition` : sa graine, son numéro, ses trois gardiens, ses trois cartes et la chance sur chaque escale, gardées telles qu'au départ ; depuis la version 2, les jokers, son équipe et l'invité du jour de son départ, sa chance sur chaque marche de chaque catégorie et sur une source — le Commandement et Il connaît la maison changent une escale en route ; la version 5, les rencontres — un prototype de la préproduction d'abord, le jeu partout depuis le 19 octobre 2026 —, et sa catégorie fétiche (`fetiche`) : ses questions gardent alors leur forme de tirage (`tiree`), leurs deux leurres (`six`) et leurs réponses en années ou en nombres (`reponseEn`) ; la version 7, le codex de son départ (`codex` : son niveau d'explorateur, les cartes qu'il a ouvertes, les règles ouvertes — les fioles comprises depuis le 19 octobre 2026 : un départ d'avant n'en a pas —, ses exploits faits — absents d'un départ d'avant les exploits —, la renommée qu'il avait, le plus haut cran de l'Ascension qu'il avait ouvert — `ascensionOuverte`, absent d'un départ d'avant l'Ascension), figé avec elle, le dos de son paquet (`dos` : `ordinaire`, `etoile` ou `dore`, absent d'un départ d'avant les dos) et son cran de l'Ascension (`ascension`, de 1 à 5 ; absent, aucun) ; la version 8, le jeu complet — ses cartes de plus dans les offres, l'épique, l'énergie de chaque acte —, sans un champ de plus : un départ de la version 7 se rejoue à ses trois d'énergie et à ses offres d'alors ; `issue` y vaut `legendaire`, `perdue` ou `abandonnee`), `bilan` (d'une expédition finie, le 18 octobre 2026 : ce qu'elle a fait — ses escales, ses adversaires et ses élites tombés, ses gardiens, le bout, ses exploits —, en JSON à sa version, `{ v, escales, adversaires, elites, gardiens, auBout, exploits, ascension? }` — la version 2 ; la 1 n'avait pas les exploits ; `ascension`, le cran où elle est partie, absent sans cran, ne change pas la version —, écrit à sa fin, abandonnée aussi : la renommée du codex en est la somme, ses exploits l'union, les crans de l'Ascension ouverts ses victoires, relues au départ et à la page ; un reflet du pli, comme `position` et `vies` — une expédition finie sans bilan, ou d'une autre version, se replie une fois à la lecture suivante, qui l'écrit ; NULL ailleurs).
- **Espace** : non.
- **Écrite par** : `CampagneStore` (commencer, répondre, abandonner, clore un défi ou un duel ; l'administrateur qui libère une épreuve).
- **Lue par** : `CampagneStore` — records, carnet, sentiers, duels, écussons, expérience, QG.
- **Effacée par** : la suppression du profil.

### `campagne_reponses`

Les réponses de chaque partie.

- **Colonnes clés** : `serie_id` et `position` (la clé), `reserve_id` (l'identifiant de la question dans la base de la campagne), `choix`, `juste`, `repondue_le`, `compagnon`, `joker` (la clé du joker de l'expédition qui a aidé à répondre — Coup d'œil, Double chance, Passe-muraille… (`JOKERS_QUI_AIDENT`) —, ou `loupe`, le talisman qui a dit le siècle d'une question d'Histoire ; NULL : une réponse sans aide), `forme` (la forme où l'expédition l'a posée, quand ce n'est pas celle de la base — `six`, `vrai-faux`, `devoilement` ; NULL : telle que la base l'a écrite, un vrai ou faux né tel compris), `sujet` (le thème pointu de l'escale où l'expédition l'a tirée — de son tas à lui, ni par un Commandement ni dans toute la base faute de quoi tirer ; NULL ailleurs, et pour la question que La boucle repose : trouvée, elle tamponne le passeport, depuis le 18 octobre 2026).
- **Espace** : non.
- **Écrite par** : `CampagneStore`.
- **Lue par** : `CampagneStore` (le carnet, la difficulté mesurée, le modèle du savoir, les confettis ; le passeport de l'expédition et le Globe-trotter, ses thèmes pointus trouvés — `lectureDuPasseport`, dans le lot qui lit déjà l'expédition, la page, le départ ou les paliers). La mesure, le modèle du savoir, les écussons, la précision et L'Érudit n'en lisent que les réponses nues — ni joker ni autre forme (`REPONSE_NUE`) —, et une bonne réponse aidée, ou trouvée en vrai ou faux tiré d'une question à quatre choix, ne retrouve rien au carnet ; une erreur aidée y entre.
- **Effacée par** : la suppression du profil, avec ses parties.

### `expedition_gestes`

Le journal des gestes d'une expédition, dans l'ordre : avancer vers une
escale, jouer un joker — une carte, en rencontres —, voir la question et sa
mise (`voir`, en rencontres), prendre ce qu'offre un coffre ou une élite,
choisir au campement, acheter à l'échoppe, garder un gardien au bout,
abandonner. Son état — ses vies, sa main, son paquet, sa défausse, ses écus,
ses talismans ; en rencontres, son courage, les sceaux de l'adversaire et sa
pioche — ne s'écrit nulle part : il se replie de son départ
(`campagne_series.expedition`), de ces gestes et de ses réponses
(`pliDeLExpedition`, `shared/expedition.ts`) — les écus d'un dévoilement, de
l'heure de sa réponse (`campagne_reponses.repondue_le`) ; la pioche, les
offres, l'étal et ce que cache l'inconnu se tirent au hasard de sa graine.

- **Colonnes clés** : `serie_id` et `rang` (la clé : un geste dit le rang qu'il suit, un second au même rang est refusé), `geste` (JSON : `{ quoi: 'avancer', vers }`, `{ quoi: 'jouer', joker, position?, categorie?, montre? }` — joué sur une question, il porte sa position : le pli ne la juge qu'après lui —, `{ quoi: 'prendre', jokers, talisman?, fiole? }`, `{ quoi: 'camper', retirer?, ameliorer? }` — l'un ou l'autre, jamais les deux —, `{ quoi: 'acheter', article, joker?, prix }` — le prix payé, que le journal garde : un barème qui change ne refait pas un achat ; `article` vaut `fiole` pour la fiole d'une échoppe, `ameliorer` pour une carte améliorée (`joker`, sa clé) —, `{ quoi: 'voir', mise, position }`, `{ quoi: 'boire', fiole, position? }` — une fiole bue, au codex : pendant une question, sa position, comme un joker —, `{ quoi: 'garder', legendaire }`, `{ quoi: 'abandonner' }`), `fait_le`.
- **Espace** : non.
- **Écrite par** : `CampagneStore` (`gesteDExpedition`, `garderUnGardien`, `abandonnerLExpedition`), dans le lot de la question tirée pour l'escale.
- **Lue par** : `CampagneStore` — la page de l'expédition et chaque geste, qui la replient.
- **Effacée par** : la suppression du profil, avec ses parties.

### `campagne_signalements`

Les questions de la campagne signalées par les joueurs.

- **Colonnes clés** : `question_id` et `profile_id` (la clé), `serie_id`, `texte`, `cree_le`, `traite_le`, `issue` et `detail` (comme `jour_signalements`, sans `annulee`). Index `(profile_id, traite_le)`, pour le merci de l'accueil.
- **Espace** : non.
- **Écrite par** : `CampagneStore` (le signalement ; garder, corriger, reclasser ou retirer, au QG).
- **Lue par** : `CampagneStore` (la page des signalements du QG, son historique de trente jours, le merci sur l'accueil du joueur).
- **Effacée par** : la suppression du profil.

### `campagne_retraits`

Les questions de la base de la campagne retirées pour tous.

- **Colonnes clés** : `question_id` (la clé), `retiree_le`.
- **Espace** : non.
- **Écrite par** : `CampagneStore` (« Retirer » au QG ; une correction qui change la bonne réponse).
- **Lue par** : `CampagneStore`, au démarrage, puis tenue en mémoire : chaque tirage écarte ses questions.
- **Effacée par** : rien.

### `campagne_ajouts`

Les questions que la routine du matin a déposées : elles s'ajoutent à la base
livrée et se jouent tout de suite, sans déploiement.

- **Colonnes clés** : `id`, `categorie`, `entree` (JSON), `ajoutee_le`.
- **Espace** : non.
- **Écrite par** : `CampagneStore.deposer` (`POST /api/campagne/base`).
- **Lue par** : `CampagneStore` (la base jouable ; le QG ; `/healthz`, le dernier apport).
- **Effacée par** : rien ; un retrait l'écarte.

### `campagne_corrections`

Les questions corrigées ou reclassées par l'administrateur.

- **Colonnes clés** : `question_id` (la question d'origine), `entree` (JSON : la version corrigée, ou reclassée — sa catégorie, son sous-thème, sa difficulté estimée —, sous le même identifiant), `corrigee_le`.
- **Espace** : non.
- **Écrite par** : `CampagneStore.corriger`, `CampagneStore.reclasser`.
- **Lue par** : `CampagneStore`, au démarrage.
- **Effacée par** : rien.

### `campagne_meta`

Les drapeaux de la campagne.

- **Colonnes clés** : `cle`, `valeur` — `relecture_des_series` (la `VERSION_DES_SERIES` déjà relue), `relecture_des_epreuves` (la `VERSION_DES_EPREUVES`).
- **Espace** : non.
- **Écrite par** : `CampagneStore`.
- **Lue par** : `CampagneStore`.
- **Effacée par** : rien.

### `campagne_defis`

Le défi de chaque semaine : la même série pour tous, tirée au premier qui la
relève.

- **Colonnes clés** : `semaine` (le lundi, la clé), `questions` (JSON, figé), `tire_le`, `clos_le`, `vainqueurs` (JSON).
- **Espace** : non.
- **Écrite par** : `CampagneStore` (le tirage, la clôture de la semaine).
- **Lue par** : `CampagneStore`.
- **Effacée par** : rien.

### `sentier_acquis`

Les paliers des sentiers que chacun tenait de ses portraits d'avant les
sentiers, repris une fois.

- **Colonnes clés** : `profile_id` et `branche` (la clé), `paliers`, `retenu_le`.
- **Espace** : non.
- **Écrite par** : la reprise des portraits (`server/src/core/repriseDesPortraits.ts`), une fois, sous son drapeau.
- **Lue par** : `CampagneStore` (les sentiers).
- **Effacée par** : la suppression du profil.

### `sentier_melanges`

Les mélanges réglés au QG : un par palier réglé, pour les douze sentiers
ensemble. Un palier sans ligne tire celui du code (`PALIERS`).

- **Colonnes clés** : `palier` (la clé), `melange` (JSON : combien de questions de chaque marche), `regle_le`.
- **Espace** : non.
- **Écrite par** : `CampagneStore.reglerLeMelange` (`POST /api/admin/campagne/paliers/:n/melange`).
- **Lue par** : `CampagneStore`, au démarrage, puis gardée en mémoire. Un mélange que les règles du jour refusent se tait.
- **Effacée par** : le retour d'un palier à son mélange d'origine, qui efface sa ligne.

### `campagne_duels`

Les duels lancés : contre quelqu'un (classés), ou entre amis (d'avant).

- **Colonnes clés** : `code` (la clé), `auteur`, `questions`, `categories`, `sujet`, `cree_le` (indexé : le QG lit les duels par leur date de lancement), `ferme_le`, `clos_le`, `adversaire` (vide pour un défi entre amis), `cote_auteur` et `cote_adversaire` (les cotes qu'on voit, figées au lancement), `cote_cachee_auteur` et `cote_cachee_adversaire` (les cotes cachées, figées avec elles depuis la montée du 14 octobre 2026 — vides avant : la cachée bouge alors contre la seule cote figée), `vu_le` (le résultat vu par qui l'a lancé).
- **Espace** : non.
- **Écrite par** : `CampagneStore` (lancer, fermer, retenir le résultat vu ; l'administrateur qui annule un duel classé pas encore commencé, `annulerUnDuel`, qui pose `ferme_le` à l'instant).
- **Lue par** : `CampagneStore` (la page des duels, la cote relue du journal ; le QG, `suiviDesDuelsAuQg` : les duels classés lancés, ceux qui attendent leur adversaire).
- **Effacée par** : rien ; les parties d'un profil supprimé partent, et son duel ne compte plus.

### `campagne_envois`

À qui un duel a été envoyé.

- **Colonnes clés** : `code` et `profile_id` (la clé), `envoye_le`.
- **Espace** : non.
- **Écrite par** : `CampagneStore`.
- **Lue par** : `CampagneStore` (les défis reçus, les duels en attente du QG).
- **Effacée par** : la suppression du profil, d'un côté ou de l'autre.

### `campagne_envois_prevus`

Les envois prévus d'un duel, partis à la fin de la partie de qui l'a lancé.

- **Colonnes clés** : `code` et `profile_id` (la clé).
- **Espace** : non.
- **Écrite par** : `CampagneStore` (le lancement).
- **Lue par** : `CampagneStore`.
- **Effacée par** : l'envoi ; la suppression du profil.

### `campagne_amis_ajoutes`

Les amis qu'un profil a ajoutés.

- **Colonnes clés** : `profile_id` et `ami` (la clé), `ajoute_le`.
- **Espace** : non.
- **Écrite par** : `CampagneStore`.
- **Lue par** : `CampagneStore` (le cercle d'amis).
- **Effacée par** : la suppression du profil, d'un côté ou de l'autre.

### `campagne_amis_retires`

Les joueurs qu'un profil a retirés de ses amis : ils ne lui font plus rien
parvenir.

- **Colonnes clés** : `profile_id` et `ami` (la clé), `retire_le`.
- **Espace** : non.
- **Écrite par** : `CampagneStore`.
- **Lue par** : `CampagneStore`.
- **Effacée par** : un nouvel ajout du même ami ; la suppression du profil, d'un côté ou de l'autre.

**Le QG** — ce que l'administrateur a fait, et la santé du serveur.

### `qg_gestes`

Le journal des gestes de l'administrateur : une ligne par geste qui a changé
quelque chose, jamais modifiée.

- **Colonnes clés** : `id`, `quand` (indexée), `qui` (l'espace de l'administrateur), `sorte`, `route`, `resume` (la phrase), `cible` (indexée avec `quand` : le profil, l'espace ou la question visés).
- **Espace** : non (`qui` le nomme).
- **Écrite par** : `JournalDesGestes` (`server/src/core/journalDesGestes.ts`), après la réponse de chaque route d'administration qui écrit.
- **Lue par** : `JournalDesGestes` (la page « Le journal », la fiche d'un joueur).
- **Effacée par** : rien — il garde même le nom d'un profil supprimé.

### `qg_sante`

Le relevé de la santé du serveur, heure par heure et par démarrage.

- **Colonnes clés** : `heure` et `demarrage` (la clé), `releve` (JSON : appels et temps des routes, allers-retours vers la base, charge, erreurs par source et, depuis le 17 octobre 2026, en détail — douze au plus par heure : sorte, code, message nettoyé, pile ramenée aux fichiers du dépôt —, invités), `maj_le`.
- **Espace** : non.
- **Écrite par** : `SanteDuServeur` (`server/src/core/santeDuServeur.ts`), toutes les dix minutes (`RELEVE_MS`).
- **Lue par** : `SanteDuServeur` (la page « Le serveur » du QG, sept jours).
- **Effacée par** : le relevé, au plus une fois l'heure : ce qui a plus de huit jours (`SANTE_GARDEE_MS`).

### `qg_demarrages`

Chaque démarrage du serveur, et son extinction propre.

- **Colonnes clés** : `id`, `demarre_le` (indexée), `pret_en_ms`, `version`, `env`, `vu_le` (le dernier signe de vie, indexé), `arrete_le` (l'extinction propre ; vide : arrêt net, ou toujours debout).
- **Espace** : non.
- **Écrite par** : `SanteDuServeur` — une fois le port ouvert, puis à chaque relevé, et à l'arrêt.
- **Lue par** : `SanteDuServeur` (la raison de chaque démarrage : réveil, mise en ligne, relance, redémarrage après un arrêt net ; l'alerte d'arrêt net).
- **Effacée par** : le relevé : ce qui n'a plus donné signe de vie depuis huit jours.

### `qg_maintenance`

Ce que l'administrateur pose au QG (`/admin#maintenance`) : le bandeau rouge, les pages en maintenance et celles bientôt disponibles — une ligne par chose posée, la table vide sinon.

- **Colonnes clés** : `cle` (la clé : `bandeau`, ou la page fermée — `jour`, `campagne`, `defi`, `duels`, `expedition`, `boutique`), `texte` (celui du bandeau ; pour une page, `bientot` si elle est bientôt disponible, vide en maintenance — ce qu'une version d'après y écrirait se lit fermé), `depuis`.
- **Espace** : non — elles valent pour tout le serveur.
- **Écrite par** : `Maintenance` (`server/src/core/maintenance.ts`), à chaque geste de la page du QG, l'un après l'autre.
- **Lue par** : `Maintenance`, une fois au démarrage, puis tenue en mémoire : chaque page servie et chaque route qui commence une partie la lisent sans un aller-retour.
- **Effacée par** : le geste contraire — retirer le bandeau, rouvrir la page à tous — efface sa ligne.

### `qg_testeurs`

Les testeurs d'une page bientôt disponible : un profil par ligne, qui y entre avant tout le monde — rien ne les montre aux autres joueurs.

- **Colonnes clés** : `page`, `profile_id` (la clé, ensemble), `depuis`.
- **Espace** : non — un profil va d'un espace à l'autre, et la page vaut pour tout le serveur.
- **Écrite par** : `Maintenance` (`ajouterUnTesteur`), depuis la page du QG.
- **Lue par** : `Maintenance`, une fois au démarrage, puis tenue en mémoire avec l'état des pages.
- **Effacée par** : le testeur retiré au QG ; un profil supprimé emporte les siennes (`oublierProfil`, dans `supprimerProfil`). La page rouverte à tous les garde, pour une prochaine fois.

## Pour aller plus loin

- [Les données](../architecture/donnees.md) — pourquoi deux bases, comment le miroir tient, le démarrage et l'arrêt
- [Exploiter](../exploitation/exploiter.md) — sauvegarder, restaurer et exporter ces tables
- [La configuration](configuration.md) — `DB_PATH`, `QUIZ_DB_URL`, `QUIZ_DB_TOKEN`
- [Administrer](../guides/administrer.md) — les gestes du QG qui effacent un profil ou un espace
