#!/bin/bash
# Le relevé des écrans : chaque script de rendu lancé tel quel, la sonde préchargée (sonde.cjs) — à chaque photo d'une
# page, elle note ce dont l'écran défile. Depuis la racine du dépôt, le client construit d'abord :
#
#   npm run build -w client
#   retours/2026-11-10/ecrans/reproductions/releve.sh export/releve rendu-campagne.ts rendu-duels.ts …
#   node retours/2026-11-10/ecrans/reproductions/ecrans.cjs export/releve/sonde     # le tableau, écran par écran
#   node retours/2026-11-10/ecrans/reproductions/pouces.cjs export/releve/sonde     # le geste principal : vu, collé, caché
#
# Deux voies à la fois vont plus vite (deux appels, des scripts différents) ; au-delà, les rendus se gênent.
ici=$(cd "$(dirname "$0")" && pwd)
sortie=$(mkdir -p "$1" && cd "$1" && pwd) || exit 1
shift
mkdir -p "$sortie/sonde" "$sortie/photos" "$sortie/journaux"
cd "$ici/../../../../server" || exit 1
for script in "$@"; do
  nom=${script%.ts}
  debut=$SECONDS
  SONDE_PW="$(npm root -g)/playwright" SONDE_OUT="$sortie/sonde/$nom.jsonl" NODE_OPTIONS="--require $ici/sonde.cjs" \
    timeout 900 npx tsx "scripts/$script" "$sortie/photos/$nom" > "$sortie/journaux/$nom.log" 2>&1
  echo "$script · code $? · $((SECONDS - debut)) s · $(wc -l < "$sortie/sonde/$nom.jsonl" 2>/dev/null || echo 0) photos"
done
