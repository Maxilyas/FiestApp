// Les décisions d'une relecture, lisibles avant d'être appliquées : chaque
// question telle que les joueurs la voient, puis ce qu'on en décide — le
// motif, l'avant et l'après, le verdict d'un doute et ses sources. La même
// application que « appliquer » (`decisionsFinales`, `appliquerALaBase`),
// faite en mémoire : rien n'est écrit dans la base.
//
// Depuis la racine du dépôt :
//   npx tsx credit-api/apercu.ts [<nom>]   → credit-api/etat/relecture-<nom>.apercu.md

import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { entreeDeLaBase, lireLaBase, type QuestionDeLaBase } from '../server/src/core/baseCampagne'
import { DOSSIER } from './api'
import { appliquerALaBase, charger, decisionsFinales, type Decision, type Relecture } from './relire'

const carte = (q: QuestionDeLaBase) => {
  const e = entreeDeLaBase(q) as Record<string, unknown>
  return [
    `**[${q.id}]** ${q.meta.categorie} › ${q.meta.sousTheme} · ${q.meta.etiquettes.join(', ') || 'sans étiquette'} · d${q.meta.difficulte}`,
    `> ${q.texte}`,
    `> ✓ ${q.reponses[q.bonne]} · ✗ ${q.reponses.filter((_, i) => i !== q.bonne).join(' · ')}`,
    ...(e.anecdote ? [`> *Anecdote :* ${String(e.anecdote)}`] : []),
    ...(e.explication ? [`> *Explication :* ${String(e.explication)}`] : []),
  ].join('\n')
}

const champs = (d: Decision) =>
  Object.entries(d.champs ?? {})
    .map(([k, v]) => `\`${k}\` → « ${Array.isArray(v) ? v.join(', ') || '(aucune)' : String(v)} »`)
    .join(' ; ')

/** L'aperçu d'une relecture, en Markdown : les chiffres, puis chaque décision sous sa question, puis le journal qu'« appliquer » écrirait. */
export function apercu(r: Relecture, questions: readonly QuestionDeLaBase[]): string {
  const parId = new Map(questions.map(q => [q.id, q]))
  const fait = appliquerALaBase(questions, decisionsFinales(r))
  const compte = (m: Record<string, Decision>, a: Decision['action']) => Object.values(m).filter(d => d.action === a).length
  const lignes = [
    `# Relecture « ${r.nom} » — les décisions, avant application`,
    '',
    `${r.fiches.reduce((s, f) => s + f.ids.length, 0)} questions en ${r.fiches.length} fiches (${r.relues.length} rendues), réflexion ${r.effort}.`,
    '',
    `- Première passe : ${compte(r.decisions, 'retirer')} à retirer, ${compte(r.decisions, 'corriger')} à corriger, ${compte(r.decisions, 'douter')} en doute.`,
    `- Doutes vérifiés sur le web : ${Object.keys(r.verifiees).length} — ${compte(r.verifiees, 'garder')} gardés, ${compte(r.verifiees, 'corriger')} à corriger, ${compte(r.verifiees, 'retirer')} à retirer.`,
    `- Appliquée, elle ferait : ${fait.retirees} retirée(s), ${fait.corrigees} corrigée(s), ${fait.reclassees} reclassée(s) ; la base passerait de ${questions.length} à ${fait.questions.length} questions.`,
    '',
  ]
  const groupes: [string, Decision['action']][] = [
    ['Les retraits', 'retirer'],
    ['Les corrections et les reclassements', 'corriger'],
    ['Les doutes, et leur verdict', 'douter'],
  ]
  for (const [titre, action] of groupes) {
    const siennes = Object.entries(r.decisions).filter(([, d]) => d.action === action)
    lignes.push(`## ${titre} (${siennes.length})`, '')
    for (const [id, d] of siennes) {
      const q = parId.get(id)
      if (!q) {
        lignes.push(`- [${id}] n'est plus dans la base.`, '')
        continue
      }
      lignes.push(carte(q), '')
      if (action === 'douter') {
        const v = r.verifiees[id]
        lignes.push(`- **Le doute :** ${d.motif}${d.champs ? ` — reclassement joint : ${champs(d)}` : ''}`)
        if (!v) lignes.push('- **Pas encore vérifié.**')
        else lignes.push(`- **Le verdict : ${v.action}** — ${v.motif}${v.champs ? ` — ${champs(v)}` : ''}`, ...(v.sources?.length ? [`- Sources : ${v.sources.join(' ; ')}`] : []))
      } else lignes.push(`- **${action}** — ${d.motif}${d.champs ? ` — ${champs(d)}` : ''}`)
      lignes.push('')
    }
  }
  lignes.push('## Le journal qu’« appliquer » écrirait', '', ...fait.journal, '')
  return lignes.join('\n')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = charger(DOSSIER, process.argv[2])
    const { questions } = lireLaBase()
    const fichier = path.join(DOSSIER, `relecture-${r.nom}.apercu.md`)
    writeFileSync(fichier, apercu(r, questions))
    console.log(`${fichier} : à lire avant « appliquer ${r.nom} ».`)
  } catch (e) {
    console.error((e as Error).message)
    process.exitCode = 1
  }
}
