#!/usr/bin/env bash
# Les séries du rapport perf-temps-reel, répétées. Chaque essai démarre son
# serveur jetable (bases dans export/evaluations/perf-temps-reel/serveur-*),
# et écrit son JSON à côté. Puis : node tableau.mjs
#   bash series.sh [solo|cinq|voisin|veille|quota|profils] [répétitions]
set -euo pipefail
ici="$(cd "$(dirname "$0")" && pwd)"
cd "$ici/../../../../.."
charge() { node "$ici/charge.mjs" "$@" | grep -v '^   \(serveur\|générateur\|veille\)'; }
rep="${2:-3}"
case "${1:-tout}" in
  solo|tout)   for r in $(seq "$rep"); do for n in 50 200 500; do charge --espaces "$n" --etiquette "solo-$n"; done; done ;;&
  cinq|tout)   for r in $(seq "$rep"); do charge --espaces 60,60,60,60,60 --etiquette cinq-60; done ;;&
  voisin|tout) for r in $(seq "$rep"); do
                 charge --espaces 20,20,20 --etiquette petits-seuls
                 charge --espaces 400,20,20,20 --etiquette voisin-400
               done ;;&
  veille|tout) charge --espaces 150 --veille 15 --questions 2 --etiquette veille-150
               charge --espaces 500 --veille 50 --questions 2 --etiquette veille-500 ;;&
  quota)       # Le dixième de cœur de Render gratuit, rejoué (voir --quota dans charge.mjs).
               for n in 50 150 300; do charge --espaces "$n" --quota 0.1 --etiquette "q01-solo-$n"; done
               charge --espaces 20,20,20 --quota 0.1 --etiquette q01-petits-seuls
               charge --espaces 150,20,20,20 --quota 0.1 --etiquette q01-voisin-150 ;;
  profils)     charge --espaces 500 --cpu-prof --etiquette prof-500
               charge --espaces 400,20,20,20 --cpu-prof --etiquette prof-voisin ;;
  *) ;;
esac
