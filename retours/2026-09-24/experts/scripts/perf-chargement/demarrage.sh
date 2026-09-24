#!/bin/sh
# Le réveil : combien de temps entre le lancement de la commande de démarrage
# de Render (`node --import tsx src/index.ts`) et la première page servie,
# sur des bases vides (le disque de Render est effacé à chaque réveil).
# Cinq démarrages ; la ligne donne les millisecondes jusqu'au premier 200 de /healthz, puis de /.
# Usage (depuis la racine) : sh demarrage.sh [port]
PORT=${1:-4790}
D=export/evaluations/perf-chargement/demarrage
for i in 1 2 3 4 5; do
  rm -rf $D && mkdir -p $D
  t0=$(date +%s%3N)
  (cd server && PORT=$PORT DB_PATH=../$D/locale.db QUIZ_DB_URL=file:../$D/permanente.db exec node --import tsx src/index.ts > ../$D/log 2>&1) &
  until curl -sf -o /dev/null http://localhost:$PORT/healthz; do sleep 0.02; done
  t1=$(date +%s%3N)
  curl -sf -o /dev/null http://localhost:$PORT/banc; t2=$(date +%s%3N)
  echo "healthz $((t1-t0)) ms · page $((t2-t0)) ms"
  pkill -f "PORT=$PORT" 2>/dev/null; kill $(lsof -t -i:$PORT 2>/dev/null) 2>/dev/null || fuser -k $PORT/tcp 2>/dev/null
  sleep 1
done
