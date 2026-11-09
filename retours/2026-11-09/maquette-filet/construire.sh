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
{ printf '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'; cat "$dest/index.html"; printf '</body></html>'; } > "$dest/local.html"
echo "Maquette prête : $dest/local.html"
