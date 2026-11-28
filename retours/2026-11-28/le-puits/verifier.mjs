// Résout chaque énigme de la maquette avant qu'on la joue : `node verifier.mjs`.
// Une fiche sans solution, un duel perdu d'avance, un tirage qui ne se résout
// pas : la sortie est en erreur, et la fiche n'entre pas. C'est le relecteur
// des énigmes — il ne dit pas si elles sont belles, il dit qu'elles sont justes.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const ici = dirname(fileURLToPath(import.meta.url))
const charger = chemin => vm.runInThisContext(readFileSync(chemin, 'utf8'), { filename: chemin })
charger(join(ici, 'src/socle.js'))
const P = globalThis.P
const seul = process.argv[2]
let echecs = 0
// Un moule qui lève en se chargeant (en cours d'écriture, ou cassé) est un refus : il ne fait pas taire les autres.
for (const f of readdirSync(join(ici, 'src/moules')).filter(x => x.endsWith('.js')).sort()) {
  try { charger(join(ici, 'src/moules', f)) } catch (e) {
    if (!seul || f === seul + '.js') { echecs++; console.log(`REFUS  le moule ${f} ne se charge pas : ${e.message}`) }
  }
}
const ligne = (f, tiree) => {
  const t0 = Date.now()
  let v
  try { v = P.verifier(f) } catch (e) { v = { ok: false, note: 'le moule a levé : ' + e.message } }
  if (!v.ok) echecs++
  const m = P.moules[f.moule]
  const combien = v.coups != null ? P.pluriel(v.coups, ...m.unite) : ''
  console.log(`${v.ok ? '  ok  ' : 'REFUS '} ${(tiree ? '~ ' : '') + f.id}`.padEnd(38) + `${m.socle}`.padEnd(8) + `niv. ${f.niveau}  ` + [combien, v.note].filter(Boolean).join(' — ') + `  (${Date.now() - t0} ms)`)
  // Une solution annoncée doit vraiment mener au but, coup par coup, par le chemin même du joueur.
  if (v.ok && v.solution) {
    let e = m.depart(f)
    for (const coup of v.solution) {
      const r = m.jouer(f, e, coup)
      if (!r.etat) { echecs++; console.log(`REFUS  ${f.id} : sa solution se fait refuser un coup (${r.refus})`); return }
      e = r.etat
    }
    if (!m.fini(f, e)?.gagne) { echecs++; console.log(`REFUS  ${f.id} : sa solution ne mène pas au but`) }
  }
}

const fiches = P.fiches.filter(f => !seul || f.moule === seul)
console.log(`${fiches.length} énigmes écrites, ${Object.keys(P.moules).length} moules\n`)
for (const f of fiches) ligne(f)

// Les moules qui tirent des énigmes : cinq graines à chaque niveau, toutes résolues.
let tirees = 0
for (const m of Object.values(P.moules)) {
  if (!m.tirer || (seul && m.cle !== seul)) continue
  console.log(`\nLe tirage de « ${m.nom} »`)
  for (let niveau = 1; niveau <= 5; niveau++) {
    for (let graine = 1; graine <= 5; graine++) {
      let f
      try { f = m.tirer(niveau * 1000 + graine, niveau) } catch (e) { echecs++; console.log(`REFUS  tirage niveau ${niveau}, graine ${graine} : ${e.message}`); continue }
      tirees++
      if (graine === 1) ligne(f, true)
      else { const v = P.verifier(f); if (!v.ok) { echecs++; console.log(`REFUS  ~ ${f.id} : ${v.note}`) } }
    }
  }
}
console.log(`\n${fiches.length} énigmes écrites et ${tirees} tirées : ${echecs ? echecs + ' refus' : 'toutes justes'}.`)
process.exit(echecs ? 1 : 0)
