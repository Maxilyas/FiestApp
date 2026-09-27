// Le redémarrage (invariant 5) : à n'importe quel moment d'une partie, un
// moteur neuf relit la base et doit reprendre la même partie, ses
// chronomètres à la même échéance.
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { estimation, horloge, qcm, redemarrer, salle, sondage } from './harnais'
import { suiteFixe } from '../../../shared/hasard'

let h: ReturnType<typeof horloge> | null = null
afterEach(() => {
  h?.arreter()
  h = null
})

const QUESTIONS = [
  qcm('Un ?'),
  estimation('Combien ?', 1994),
  qcm('Photo ?', { image: '/media/image/x.png', observeSeconds: 5 }),
  sondage('Qui ?'),
  qcm('Manche 2 ?', { intertitre: 'Manche 2' }),
  estimation('Le gâteau ?', 0, { enDirect: true, target: null }),
]

test('à tout moment, un redémarrage reprend la même partie et les mêmes échéances', () => {
  const ecarts: string[] = []
  for (let graine = 1; graine <= 200; graine++) {
    h = horloge()
    const hasard = suiteFixe(graine)
    const s = salle([{ id: 'q', title: 'Reprise', questions: QUESTIONS }])
    for (const nom of ['A', 'B', 'C']) s.inscrire(nom)
    s.lancer({ autoNextSeconds: hasard() < 0.5 ? 5 : null })
    s.choisir('q')
    const nGestes = Math.floor(hasard() * 40)
    for (let g = 0; g < nGestes && s.session; g++) {
      const r = hasard()
      const st = s.st
      if (r < 0.4) {
        const q = st.pack?.questions[st.qIndex]
        const nom = ['A', 'B', 'C'][Math.floor(hasard() * 3)]
        s.repondre(nom, q?.kind === 'number' ? { type: 'guess', value: Math.round(hasard() * 3000) } : { type: 'answer', choice: Math.floor(hasard() * 3) })
      } else if (r < 0.55) s.commande({ type: 'next', ...s.visee() })
      else if (r < 0.6) s.commande({ type: 'pause' })
      else if (r < 0.65) s.commande({ type: 'resume' })
      else if (r < 0.68) s.commande({ type: 'cible', value: 5, ...s.visee() })
      else h.avancer([300, 700, 1500, 4000, 9000][Math.floor(hasard() * 5)])
    }
    const sess = s.session
    if (!sess) continue
    const avant = { state: JSON.stringify(sess.state), echeances: Object.fromEntries([...sess.timers].map(([k, t]) => [k, t.deadline])) }
    const repris = redemarrer(s)
    const apres = (repris.engine as any).session
    if (JSON.stringify(apres?.state) !== avant.state) ecarts.push(`graine ${graine} : l’état repris diffère`)
    const echeances = Object.fromEntries([...(apres?.timers ?? new Map())].map(([k, t]: any) => [k, t.deadline]))
    for (const [k, d] of Object.entries(avant.echeances)) {
      const e = echeances[k]
      if (e === undefined) ecarts.push(`graine ${graine} : le chrono « ${k} » n’est pas réarmé (phase ${sess.state.phase})`)
      else if (Math.abs(e - Math.max(d, Date.now() + 50)) > 1) ecarts.push(`graine ${graine} : « ${k} » réarmé à ${e - d} ms de son échéance`)
    }
    for (const k of Object.keys(echeances)) if (!(k in avant.echeances)) ecarts.push(`graine ${graine} : chrono « ${k} » en trop`)
    repris.engine.stop()
    s.db.close()
    h.arreter()
    h = null
  }
  console.log(ecarts.slice(0, 20).join('\n') || 'aucun écart')
  assert.deepEqual(ecarts, [])
})
