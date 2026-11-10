// Une vague jugée, versée dans les indices du vivier (`retours/2026-11-09/indices-du-vivier.json`, une ligne par question,
// rangées par identifiant) : chaque indice que le juge à l'aveugle a lu dans la bonne tranche (« tranche » ou « large »),
// avec son verdict ; chaque question sans indice honnête, avec sa raison ; jamais un indice « valeur », « étroit »,
// « erreur » ou « penche » — ceux-là repartent au rédacteur (`<vague>-a-reecrire.json`, dans le dossier de travail), avec
// leur question, ce que le juge en a lu et pourquoi il est refusé : le rédacteur qui réécrit n'a rien vu de la vague. Une
// question déjà versée garde sa ligne, sauf si la vague la réécrit. Puis le contenu du Filet se refait
// (`../contenu-du-filet.mts`).
//
//   cd server && node --import tsx ../retours/2026-11-09/reproductions/indices/verser-une-vague.mts <vague>-verdicts.json <fichiers d'indices…>
import fs from 'node:fs'
import path from 'node:path'
import { RETOURS, dansLeTravail } from './commun.mts'

// Ce qu'on dit au rédacteur d'un indice refusé — les verdicts de `verdicts.mts`. « Trop serré » est le plus fréquent, et
// le plus traître : l'indice a l'air juste, c'est son milieu qui paie.
const REFUSE_PARCE_QUE: Record<string, string> = {
  valeur: 'donne la valeur : ses deux bouts tiennent à deux étoiles de la réponse. Élargis-le à toute la tranche.',
  etroit:
    'trop serré : plus étroit que la tranche, et le milieu de ce qu’il désigne tombe tout près de la réponse — viser ce milieu rapporte deux ou trois étoiles sans rien savoir. Élargis-le à toute la tranche.',
  erreur: 'mène à une autre tranche que celle de la réponse : le juge a choisi la mauvaise. Vérifie tes repères.',
  penche:
    'penche du mauvais côté : le milieu de ce qu’il désigne tombe dans la tranche voisine. Il peut enjamber la frontière, jamais pencher hors de la tranche de la réponse.',
}

const VIVIER = path.join(RETOURS, 'indices-du-vivier.json')
const [fichierDesVerdicts, ...fichiers] = process.argv.slice(2)
const vague = path.basename(fichierDesVerdicts).replace(/-verdicts\.json$/, '')
const verdicts = JSON.parse(fs.readFileSync(fichierDesVerdicts, 'utf8')) as Record<string, { verdict: string; lu: string }>
const rendus = fichiers.flatMap(f => JSON.parse(fs.readFileSync(f, 'utf8')) as { id: string; indice: string | null; repere?: string | null; pourquoi?: string }[])
const questions = new Map((JSON.parse(fs.readFileSync(dansLeTravail('posables.json'), 'utf8')) as Record<string, any>[]).map(q => [q.id, q]))
const parId = new Map((JSON.parse(fs.readFileSync(VIVIER, 'utf8')) as Record<string, unknown>[]).map(x => [x.id as string, x]))
const aReecrire: unknown[] = []
const compte: Record<string, number> = {}
for (const r of rendus) {
  if (r.indice === null) {
    parId.set(r.id, { id: r.id, indice: null, repere: r.repere ?? null, pourquoi: r.pourquoi ?? '' })
    compte.sansIndice = (compte.sansIndice ?? 0) + 1
    continue
  }
  const v = verdicts[r.id]
  if (!v) throw new Error(`${r.id} : pas de verdict`)
  compte[v.verdict] = (compte[v.verdict] ?? 0) + 1
  if (v.verdict === 'tranche' || v.verdict === 'large') {
    parId.set(r.id, { id: r.id, indice: r.indice, repere: r.repere ?? null, juge: v.verdict })
    continue
  }
  const q = questions.get(r.id)
  if (!q) throw new Error(`${r.id} : pas dans posables.json`)
  aReecrire.push({
    id: r.id,
    categorie: q.categorie,
    question: q.question,
    reponse: q.reponse,
    valeur: q.valeur,
    unite: q.annee ? 'année' : q.unite,
    tranche: q.tranche,
    anecdote: q.anecdote,
    ancien_indice: r.indice,
    ancien_repere: r.repere ?? null,
    ce_que_le_juge_a_lu: v.lu,
    refuse_parce_que: REFUSE_PARCE_QUE[v.verdict] ?? v.verdict,
  })
}
const tous = [...parId.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)))
fs.writeFileSync(VIVIER, `[\n${tous.map(x => JSON.stringify(x, null, 1).replace(/\n\s*/g, ' ')).join(',\n')}\n]\n`)
fs.writeFileSync(dansLeTravail(`${vague}-a-reecrire.json`), JSON.stringify(aReecrire, null, 1))
console.log(`${rendus.length} rendus :`, compte, `→ ${tous.length} lignes au vivier, ${aReecrire.length} à réécrire (${vague}-a-reecrire.json)`)
