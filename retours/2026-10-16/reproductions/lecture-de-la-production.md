# Ce qui a été lu de la production, le 16 octobre 2026

En lecture seule, par la session qui voit `PROD_LECTURE_URL` et
`PROD_LECTURE_TOKEN` (un jeton en lecture seule), derrière le proxy de la
session (`NODE_USE_ENV_PROXY=1`) : des `SELECT`, et rien que des totaux —
ni prénom, ni identifiant, ni contenu. Copier la base pour la rejouer en
local a été refusé, à raison : elle porte des données personnelles. Le banc
(`README.md`) en reproduit les volumes.

Les temps mesurés depuis la session passent par son proxy : ils ne disent
pas ce qu'attend le serveur de Render, mais ils se comparent entre eux — une
requête moins un `SELECT 1`.

## Les requêtes

```sql
-- La santé du serveur, heure par heure, et ses démarrages (la page « Le serveur » du QG).
SELECT s.heure, s.releve, d.version FROM qg_sante s JOIN qg_demarrages d ON d.id = s.demarrage ORDER BY s.heure;
SELECT date(demarre_le/1000 + 7200, 'unixepoch') AS jour, COUNT(*), AVG(pret_en_ms), MAX(pret_en_ms), SUM(arrete_le IS NULL)
  FROM qg_demarrages WHERE env = 'production' GROUP BY 1;

-- Les volumes.
SELECT COUNT(*) FROM campagne_reponses;   -- 13 406
SELECT COUNT(*) FROM campagne_series;     -- 1 292
SELECT COUNT(*) FROM campagne_duels WHERE adversaire IS NOT NULL;   -- 149
SELECT COUNT(*) FROM profiles;            -- 32
SELECT mode, COUNT(*), AVG(json_array_length(questions)), AVG(length(questions) / json_array_length(questions)),
       AVG((SELECT COUNT(*) FROM campagne_reponses r WHERE r.serie_id = s.id))
  FROM campagne_series s WHERE json_array_length(s.questions) > 0 GROUP BY mode;
SELECT date(repondue_le/1000, 'unixepoch'), COUNT(*) FROM campagne_reponses GROUP BY 1;

-- Le poids des questions gardées par chaque série, champ par champ.
SELECT k.key, AVG(length(k.value)) FROM campagne_series s, json_each(s.questions) q, json_each(q.value) k WHERE s.mode = 'serie' GROUP BY 1;
```

Puis, chronométrés six fois (le premier écarté) contre un `SELECT 1` :
`lectureDesDuels(null)` et `lectureDesDuels(<le joueur qui a le plus de
duels>)` (`server/src/core/campagne.ts`), les séries sans et avec leurs
questions, `savoirDe`, le compte des expertes justes (`statsDe`) et le même
sans JSON — pour le joueur qui a le plus de réponses, sans afficher son
identifiant.

## Ce qu'elles ont dit

| Lecture | Médiane | Écart au `SELECT 1` |
|---|---|---|
| `SELECT 1` | 121 ms | — |
| Les duels de tous (`lectureDesDuels(null)`, 284 lignes) | 130 ms | +9 ms |
| Les duels d'un joueur (83 lignes) | 126 ms | +5 ms |
| `savoirDe` du plus actif (5 020 réponses, `json_extract` par réponse) | 153 ms | +32 ms |
| Les expertes justes du même (`json_extract` par réponse) | 144 ms | +23 ms |
| La même, sans JSON | 130 ms | +9 ms |
| Toutes les séries, sans leurs questions (189 Ko) | 172 ms | +51 ms |
| Toutes les séries, avec leurs questions (23 Mo) | 977 ms | +856 ms |
