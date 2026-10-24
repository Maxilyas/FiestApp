#!/usr/bin/env bash
# Assemble la maquette jouable dans un dossier : la page, ses scripts, et les
# images prises dans le dépôt (cartes peintes, médaillons, cadrages des tableaux).
set -euo pipefail
ici="$(cd "$(dirname "$0")" && pwd)"
racine="$(cd "$ici/../../.." && pwd)"
dest="${1:?usage : construire.sh <dossier>}"
mkdir -p "$dest/cartes" "$dest/medaillons" "$dest/tableaux"
cp "$ici"/cabinet.html "$ici"/jeu.js "$ici"/contenu.js "$ici"/donnees.js "$dest/"
cp "$racine"/client/public/cartes/*-240.*.webp "$dest/cartes/"
for n in aigle bouquet chauve-souris chimere chouette citrouille comete coq dragon elephant fantome janus kraken licorne lion oracle ouroboros phenix renard salamandre sapin scarabee serpent sphinx tigre trou-noir; do
  cp "$racine"/client/public/medaillons/"$n"-rare-256.*.webp "$dest/medaillons/$n.webp"
done
for q in $(grep -o '"q":"Q[0-9]*"' "$ici/donnees.js" | cut -d'"' -f4); do
  cp "$racine"/server/content/details/"$q"-[1-4].webp "$dest/tableaux/"
done
# La page publiée reçoit son squelette à la publication ; en local, on le lui donne.
{ printf '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'; cat "$dest/cabinet.html"; printf '</body></html>'; } > "$dest/local.html"
echo "Maquette prête : $dest/local.html"
