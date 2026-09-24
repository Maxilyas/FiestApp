#!/bin/sh
# Trois variantes de client/dist/index.html, mesurées sur l'entrée d'un invité
# (mesure.mjs invite, 4G moyenne, CPU ×4, cinq passages) — sans toucher au code :
#   base       la page telle que Vite la construit
#   preload    + <link rel="modulepreload"> de PlayerApp et de ses 16 morceaux
#              (ce qu'un serveur qui connaît la route pourrait injecter)
#   sanspolice sans les deux <link rel="preload"> de polices
#   les-deux   preload + sanspolice
# Usage (depuis la racine, client construit dans client/dist) : sh variantes.sh

R=export/evaluations/perf-chargement
cp client/dist/index.html $R/index.orig.html
PRE=$(cd client/dist/assets && node -e '
  const fs=require("fs");const vu=new Set();const pile=[fs.readdirSync(".").find(f=>/^PlayerApp-.*\.js$/.test(f))]
  while(pile.length){const f=pile.pop();if(vu.has(f))continue;vu.add(f);const s=fs.readFileSync(f,"utf8");for(const m of s.matchAll(/(?:import|from)\s*["\x27]\.\/([\w.-]+\.js)["\x27]/g))pile.push(m[1])}
  console.log([...vu].filter(f=>!f.startsWith("index-")).map(f=>`<link rel="modulepreload" crossorigin href="/assets/${f}">`).join(""))')
for v in base preload sanspolice les-deux; do
  cp $R/index.orig.html client/dist/index.html
  case $v in preload|les-deux) sed -i "s#</title>#</title>$PRE#" client/dist/index.html;; esac
  case $v in sanspolice|les-deux) sed -i '/rel="preload" href="\/fonts/d' client/dist/index.html;; esac
  (cd server && exec npx tsx ../retours/2026-09-24/experts/scripts/perf-chargement/serveur.ts 4720 > ../$R/serveur-variante.log 2>&1 &)
  until grep -q PRET $R/serveur-variante.log 2>/dev/null; do sleep 1; done
  node retours/2026-09-24/experts/scripts/perf-chargement/mesure.mjs http://localhost:4720 x 4 5 invite > $R/variante-$v.json 2>/dev/null
  node -e "const p=require('./$R/variante-$v.json').pages.invite;console.log('$v', 'fcp',p.fcp,'entree',Math.round(p.jalon_entree),'lobby',Math.round(p.jalon_lobby),'octets',p.octets)"
  fuser -k -KILL 4720/tcp >/dev/null 2>&1; while fuser 4720/tcp >/dev/null 2>&1; do sleep 1; done; sleep 1; rm -f $R/serveur-variante.log
done
cp $R/index.orig.html client/dist/index.html
