#!/usr/bin/env bash
# Assemble la maquette jouable dans un dossier : la page, ses deux scripts, et une page locale qui porte son squelette
# (la page publiée le reçoit à la publication).
#
#   retours/2026-11-09/maquette-filet/construire.sh /tmp/filet
#   cd /tmp/filet && python3 -m http.server 8765      # puis http://localhost:8765/local.html
set -euo pipefail
ici="$(cd "$(dirname "$0")" && pwd)"
dest="${1:?usage : construire.sh <dossier>}"
mkdir -p "$dest"
cp "$ici"/index.html "$ici"/jeu.js "$ici"/donnees.js "$dest/"
# La page locale demande ses scripts sous une version : sans elle, un navigateur déjà venu rejouait l'ancien jeu.js
# (la tablée du 9 novembre 2026 a joué la première version d'un défaut déjà corrigé).
v="$(date +%s)"
{ printf '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'; sed -e "s#src=\"jeu.js\"#src=\"jeu.js?v=$v\"#" -e "s#src=\"donnees.js\"#src=\"donnees.js?v=$v\"#" "$dest/index.html"; printf '</body></html>'; } > "$dest/local.html"
echo "Maquette prête : $dest/local.html"
