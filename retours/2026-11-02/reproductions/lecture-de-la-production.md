# Ce qui a été lu de la production, le 2 novembre 2026

En lecture seule, par la session qui voit `PROD_LECTURE_URL` et
`PROD_LECTURE_TOKEN` (un jeton en lecture seule), derrière le proxy de la
session (`NODE_USE_ENV_PROXY=1`) : des `SELECT` et des `EXPLAIN QUERY PLAN`,
rien que des totaux — ni prénom, ni identifiant, ni contenu. Et `/healthz`
de la production (`FIESTAPP_URL`), une route publique et agrégée.

## Les requêtes

```sql
-- Les démarrages de la production, et leur temps jusqu'au port ouvert.
SELECT id, demarre_le, pret_en_ms, version, env, vu_le, arrete_le FROM qg_demarrages
 WHERE env = 'production' ORDER BY demarre_le DESC LIMIT 40;

-- Le relevé de chaque heure (la page « Le serveur » du QG) : Turso, les routes, les plus lentes,
-- la charge (processeur, gel, boucle, mémoire), les connexions, le quota et ses requêtes lourdes, les erreurs.
SELECT s.heure, s.demarrage, d.version, s.releve FROM qg_sante s JOIN qg_demarrages d ON d.id = s.demarrage
 WHERE d.env = 'production' ORDER BY s.heure;

-- Les volumes.
SELECT (SELECT COUNT(*) FROM profiles), (SELECT COUNT(*) FROM campagne_reponses), (SELECT COUNT(*) FROM campagne_series),
       (SELECT COUNT(*) FROM jour_reponses), (SELECT COUNT(*) FROM campagne_tranches);
SELECT date(repondue_le / 1000, 'unixepoch'), COUNT(*) FROM campagne_reponses
 WHERE repondue_le > (strftime('%s', 'now') - 14 * 86400) * 1000 GROUP BY 1;
SELECT mode, COUNT(*) FROM campagne_series WHERE commencee_le > (strftime('%s', 'now') - 7 * 86400) * 1000 GROUP BY 1;

-- Les plans, avant et après le `+` (`lectureDesDefisRecus`, `mesAmis`, `envoyerLesPrevus`, `lectureDesDuels`),
-- et les index de `campagne_series` ; `sqlite_stat1` absente.
EXPLAIN QUERY PLAN SELECT d.auteur FROM campagne_envois e JOIN campagne_duels d ON d.code = e.code
 WHERE e.profile_id = 'x' AND d.ferme_le > 0
   AND NOT EXISTS (SELECT 1 FROM campagne_series s WHERE s.profile_id = e.profile_id AND s.mode = 'duel' AND s.duel = e.code) …;
SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'campagne_series';
```

## Ce qu'elles ont dit

- 31 démarrages en huit jours, prêts en 3,2 à 3,8 s — 5,7 s pour `d4c4a51`,
  68,2 s pour `3ba0831` (les relectures de `VERSION_BAREME` 8 et de
  `VERSION_DES_JOURS` 2, avant le port).
- 41 profils, 34 064 réponses de campagne, 3 220 séries, 4 407 réponses du
  quiz du jour ; 586 à 2 268 réponses de campagne par jour ; sur la semaine,
  285 épreuves de sentier, 142 révisions, 141 tentatives de duel, 132 séries.
- Le quota : 13,7 millions de lignes lues en huit jours, de 0,65 à 2,6
  millions par jour à mesure que l'activité montait (de 1 545 à 6 055 appels
  d'API par jour). En tête des requêtes lourdes, les défis reçus de l'accueil
  (7,3 %), la relecture du journal des duels (4,4 %), les épreuves validées
  des sentiers (3,7 %).
- Le plan des défis reçus en production :
  `SEARCH s USING INDEX idx_campagne_series_profil_mode (profile_id=? AND mode=?)`
  — avec le `+`, `SEARCH s USING INDEX idx_campagne_series_duel (mode=? AND duel=?)`.
  Le banc, sur une base neuve, prenait déjà l'index des duels.
