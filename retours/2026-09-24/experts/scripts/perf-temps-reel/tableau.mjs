// Rassemble les essais de charge.mjs en tableaux Markdown, par étiquette.
//   node tableau.mjs            (lit export/evaluations/perf-temps-reel/*.json)
//
// Pour chaque étiquette et chaque espace : la médiane des p50, le pire p95 et
// le pire max d'une répétition à l'autre — le pire soir compte plus que la moyenne.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')
const dossier = path.join(racine, 'export/evaluations/perf-temps-reel')
const essais = readdirSync(dossier)
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(path.join(dossier, f), 'utf8')))
const parEtiquette = new Map()
for (const e of essais) parEtiquette.set(e.etiquette, [...(parEtiquette.get(e.etiquette) ?? []), e])

const med = v => [...v].sort((a, b) => a - b)[Math.floor((v.length - 1) / 2)]
const agg = (liste, cle) => {
  const r = liste.map(x => x[cle]).filter(Boolean)
  if (!r.length) return '—'
  return `${med(r.map(x => x.p50))} / ${Math.max(...r.map(x => x.p95))} / ${Math.max(...r.map(x => x.max))}`
}

for (const [etiquette, liste] of parEtiquette) {
  const n = liste.length
  console.log(`\n### ${etiquette} (${n} essai${n > 1 ? 's' : ''} ; charge machine avant : ${liste.map(e => e.chargeMachine.avant[0].toFixed(2)).join(', ')})\n`)
  console.log('| Espace | Invités | Inscription | Question (geste → téléphone) | Lecture → question | Accusé | Révélation (− souffle 700 ms) | Ko/tél/question | Instantanés reçus (inscription + quiz) | Fuites | Refus |')
  console.log('|---|---|---|---|---|---|---|---|---|---|---|')
  const nbEspaces = liste[0].espaces.length
  for (let k = 0; k < nbEspaces; k++) {
    const es = liste.map(e => e.espaces[k])
    console.log(
      `| ${es[0].slug} | ${es[0].invites} | ${agg(es, 'join')} | ${agg(es, 'question')} | ${agg(es, 'diffusion')} | ${agg(es, 'accuse')} | ${agg(es, 'revelation')} | ${med(es.map(e => e.jeuParTelephone.koParQuestion))} | ${med(es.map(e => e.parEvenement['party:snapshot']?.parTelephone ?? 0))} (${med(es.map(e => e.parEvenement['party:snapshot']?.plusGrosKo ?? 0))} Ko le plus gros) | ${es.reduce((a, e) => a + e.fuites, 0)} | ${es.reduce((a, e) => a + e.refus, 0)} |`,
    )
  }
  const s = k => liste.map(e => e[k].serveur)
  const g = k => liste.map(e => e[k].generateur)
  for (const k of ['inscription', 'jeu']) {
    console.log(
      `\n- **${k}** — serveur : ${med(s(k).map(x => x.cpu.userMs + x.cpu.systemMs))} ms CPU (${med(s(k).map(x => x.cpu.coeurs))} cœur en moyenne sur ${med(s(k).map(x => x.dureeMs))} ms), ` +
        `retard de boucle p99 ${med(s(k).map(x => x.boucle.p99))} ms / max ${Math.max(...s(k).map(x => x.boucle.max))} ms, ` +
        `RSS max ${Math.max(...s(k).map(x => x.memoire.rssMaxMo))} Mo · générateur : ${med(g(k).map(x => x.coeurs))} cœur, boucle max ${Math.max(...g(k).map(x => x.boucle.max))} ms`,
    )
  }
  const v = liste.map(e => e.veille).filter(Boolean)
  if (v.length) {
    console.log(`- **veille** — ${JSON.stringify(v[0].parEspace)} ; serveur ${v[0].serveur.cpu.userMs + v[0].serveur.cpu.systemMs} ms CPU, boucle max ${v[0].serveur.boucle.max} ms ; retour d'un téléphone : ${agg(liste.map(e => e.espaces[0]), 'retour')}`)
  }
}
