// Ce que dit le journal d'une tablée, en une page : qui a fait quoi, ce qui a
// coincé, en combien de temps chacun a répondu, ce qui s'est dit.
//
//   node server/scripts/tablee/chronologie.mjs [dossier de la tablée]
//
// Sans dossier, c'est la dernière tablée démarrée (export/tablee/courante.json,
// sinon le dossier le plus récent d'export/tablee/). C'est la première chose à
// lire avant les retours des agents : un agent qui dit « l'application ne
// réagissait pas » alors que son geste a échoué sur une référence périmée ne
// parle pas de l'application.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const TABLEES = path.resolve(ICI, '../../../export/tablee')

function dossierParDefaut() {
  const courante = path.join(TABLEES, 'courante.json')
  if (existsSync(courante)) return JSON.parse(readFileSync(courante, 'utf8')).dossier
  const dossiers = existsSync(TABLEES)
    ? readdirSync(TABLEES)
        .map(nom => path.join(TABLEES, nom))
        .filter(d => statSync(d).isDirectory())
    : []
  dossiers.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  return dossiers[0]
}

const dossier = process.argv[2] ? path.resolve(process.argv[2]) : dossierParDefaut()
const journal = dossier && path.join(dossier, 'journal.jsonl')
if (!journal || !existsSync(journal)) {
  console.error(`✗ Pas de journal de tablée${dossier ? ` dans ${dossier}` : ''}.`)
  process.exit(1)
}

const lignes = readFileSync(journal, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map(l => JSON.parse(l))
  // Les gestes de la régie (etat, salle…) sont ceux de qui orchestre, pas des joueurs.
  .filter(l => l.qui && l.qui !== 'regie')

const heure = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const s = ms => `${(ms / 1000).toFixed(1).replace('.', ',')} s`
const qui = l => String(l.qui).split(':')[0]

const debut = lignes[0]?.t
const fin = lignes.at(-1)?.t
console.log(`# La tablée ${path.basename(dossier)}`)
if (debut) console.log(`${heure(debut)} → ${heure(fin)} · ${Math.round((Date.parse(fin) - Date.parse(debut)) / 60000)} min · ${lignes.length} gestes\n`)

// ── Par personnage ──
const personnages = [...new Set(lignes.map(qui))]
console.log('## Qui a fait quoi\n')
console.log('| Qui | Gestes | Ratés | Captures | Réponses | Délai médian | Paroles |')
console.log('|---|---|---|---|---|---|---|')
const mediane = v => {
  if (!v.length) return null
  const t = [...v].sort((a, b) => a - b)
  return t[Math.floor((t.length - 1) / 2)]
}
for (const nom of personnages) {
  const siens = lignes.filter(l => qui(l) === nom)
  const gestes = siens.filter(l => l.geste !== 'reponse')
  const reponses = siens.filter(l => l.geste === 'reponse' && !l.illisible)
  const delais = reponses.map(r => r.ms).filter(ms => typeof ms === 'number')
  const m = mediane(delais)
  console.log(
    `| ${nom} | ${gestes.length} | ${gestes.filter(l => l.ok === false).length} | ${gestes.filter(l => l.geste === 'capture' && l.ok).length} | ${reponses.length} | ${m === null ? '—' : s(m)} | ${gestes.filter(l => l.geste === 'dire' && l.ok).length} |`,
  )
}

// ── Les ratés : ce qui a résisté aux agents ──
const rates = lignes.filter(l => l.ok === false)
if (rates.length) {
  console.log('\n## Les gestes ratés\n')
  const parMotif = new Map()
  for (const r of rates) {
    const motif = `${r.geste} — ${String(r.erreur ?? '?').replace(/e\d+/g, 'eN').slice(0, 140)}`
    const deja = parMotif.get(motif) ?? { n: 0, qui: new Set() }
    deja.n++
    deja.qui.add(qui(r))
    parMotif.set(motif, deja)
  }
  for (const [motif, { n, qui: noms }] of [...parMotif].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`- ${n} × ${motif} (${[...noms].join(', ')})`)
  }
}

// ── Les réponses, question par question ──
const reponses = lignes.filter(l => l.geste === 'reponse')
if (reponses.length) {
  console.log('\n## Les réponses\n')
  const parQuestion = new Map()
  for (const r of reponses) {
    const liste = parQuestion.get(r.question) ?? []
    liste.push(r)
    parQuestion.set(r.question, liste)
  }
  for (const [question, liste] of parQuestion) {
    const detail = liste
      .map(r => `${qui(r)} ${r.texte !== undefined ? `« ${r.texte} »` : r.estimation}${r.illisible ? ' (illisible)' : ''}${typeof r.ms === 'number' ? ` en ${s(r.ms)}` : ''}`)
      .join(' · ')
    console.log(`- ${heure(liste[0].t)} ${question} : ${detail}`)
  }
}

// ── Ce qui s'est dit ──
const paroles = lignes.filter(l => l.geste === 'dire' && l.ok)
if (paroles.length) {
  console.log('\n## Ce qui s’est dit\n')
  for (const p of paroles) console.log(`- ${heure(p.t)} **${qui(p)}** : ${p.args.join(' ')}`)
}

// ── Les retours ──
const retours = path.join(dossier, 'retours')
const ecrits = existsSync(retours) ? readdirSync(retours).filter(f => f.endsWith('.md')) : []
console.log(`\n## Les retours\n`)
const manquants = personnages.filter(nom => !ecrits.includes(`${nom}.md`))
console.log(ecrits.length ? ecrits.map(f => `- ${path.join(retours, f)}`).join('\n') : '(aucun pour l’instant)')
if (manquants.length) console.log(`\nPas encore de retour : ${manquants.join(', ')}.`)
