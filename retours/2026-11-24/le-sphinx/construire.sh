#!/usr/bin/env bash
# Assemble la maquette dans un dossier : la page, l'accueil photographié, et le
# Sphinx pris dans le dépôt (sa découpe et son médaillon peints).
set -euo pipefail
ici="$(cd "$(dirname "$0")" && pwd)"
racine="$(cd "$ici/../../.." && pwd)"
dest="${1:?usage : construire.sh <dossier>}"
mkdir -p "$dest/images"
cp "$ici/sphinx.html" "$dest/"
cp "$ici/images/accueil.jpg" "$dest/images/"
cp "$racine"/client/public/medaillons/sphinx-perso-256.*.webp "$dest/images/sphinx-perso.webp"
cp "$racine"/client/public/medaillons/sphinx-art-512.*.webp "$dest/images/sphinx-art.webp"
# La page publiée reçoit son squelette à la publication ; en local, on le lui donne.
{ printf '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'; cat "$dest/sphinx.html"; printf '</body></html>'; } > "$dest/local.html"
echo "Maquette prête : $dest/local.html"
