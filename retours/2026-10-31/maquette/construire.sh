#!/usr/bin/env bash
# Assemble la maquette jouable dans un dossier : la page, ses scripts, et les images prises
# dans le dépôt (les dix cartes-bonus, les légendaires, les tableaux du Détail, le coffre, le
# marchand). Rien n'est recopié dans retours/ : les images vivent déjà dans le dépôt.
#
#   retours/2026-10-31/maquette/construire.sh /tmp/cabinet
#   cd /tmp/cabinet && python3 -m http.server 8765      # puis http://localhost:8765/local.html
set -euo pipefail
ici="$(cd "$(dirname "$0")" && pwd)"
racine="$(cd "$ici/../../.." && pwd)"
dest="${1:?usage : construire.sh <dossier>}"
mkdir -p "$dest/cartes" "$dest/gardiens" "$dest/tableaux" "$dest/decors"
cp "$ici"/index.html "$ici"/jeu.js "$ici"/jeux.js "$ici"/scene.js "$ici"/contenu.js "$ici"/donnees.js "$dest/"
for c in coup-d-oeil echange quitte-ou-double concentration parade cagnotte panacee pourboire coup-de-grace second-souffle; do
  cp "$racine"/client/public/cartes/"$c"-480.*.webp "$dest/cartes/$c.webp"
done
for g in renard coq chouette tigre chauve-souris scarabee citrouille sphinx janus phenix fantome salamandre lion oracle serpent dragon kraken chimere ouroboros trou-noir comete; do
  cp "$racine"/client/public/medaillons/"$g"-rare-256.*.webp "$dest/gardiens/$g.webp"
  cp "$racine"/client/public/medaillons/"$g"-rare-512.*.webp "$dest/gardiens/$g-512.webp"
done
for q in $(grep -o '"q":"Q[0-9]*"' "$ici/donnees.js" | cut -d'"' -f4 | sort -u); do
  cp "$racine"/server/content/details/"$q"-[1-4].webp "$dest/tableaux/"
done
cp "$racine"/client/public/decors/coffre-or-ferme-480.*.webp "$dest/decors/coffre-ferme.webp"
cp "$racine"/client/public/decors/coffre-or-ouvert-480.*.webp "$dest/decors/coffre-ouvert.webp"
cp "$racine"/client/public/decors/fond-epices-720.*.webp "$dest/decors/marchand.webp"
# La page publiée reçoit son squelette à la publication ; en local, on le lui donne.
{ printf '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'; cat "$dest/index.html"; printf '</body></html>'; } > "$dest/local.html"
echo "Maquette prête : $dest/local.html ($(find "$dest" -type f | wc -l) fichiers, $(du -sh "$dest" | cut -f1))"
