#!/bin/bash
# Prépare une session Claude Code sur le web : sans ça, `node_modules` est
# vide au démarrage et la première chose que fait l'agent est d'installer les
# dépendances à la main — du temps et des jetons dépensés à chaque session.
#
# En local, on ne touche à rien : l'environnement de qui développe ici lui
# appartient.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# `install` et non `ci` : l'état du conteneur est mis en cache après le hook,
# et `install` sait repartir d'un `node_modules` déjà chaud.
npm install --no-audit --no-fund

# La base de la soirée est locale et jetable ; le test de bout en bout se
# fabrique la sienne dans un dossier temporaire. Rien d'autre à préparer.
echo "[hook] dépendances prêtes — npm run verify enchaîne typecheck, build et smoke"
