// Un fuzz du moteur : des milliers de gestes tirés au hasard — réponses,
// commandes à jour ou périmées, pauses, reprises, annulations, questions
// reposées, arrivées, exclusions, coupures, le temps qui passe — et, après
// chacun, ce qui doit toujours tenir entre la phase, les chronomètres, les
// points de la partie, le journal des gains et celui des réponses.
//
// Rien ici ne décide d'un bug : l'épreuve rapporte la première violation de
// chaque sorte, avec la suite de gestes qui y mène, pour qu'on la rejoue.
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { estimation, horloge, qcm, salle, sondage } from './harnais'
import { suiteFixe } from '../../../shared/hasard'

let h: ReturnType<typeof horloge> | null = null
afterEach(() => {
  h?.arreter()
  h = null
})

const QUESTIONS_TOUTES = [
  qcm('Un ?'),
  estimation('Combien ?', 1994),
  qcm('Photo ?', { image: '/media/image/x.png', observeSeconds: 5 }),
  sondage('Qui ?'),
  qcm('Plusieurs ?', { variante: 'plusieurs', answers: ['A', 'B', 'C', 'D'], bonnes: [0, 2] }),
  qcm('Ordre ?', { variante: 'ordre', answers: ['A', 'B', 'C', 'D'] }),
  estimation('Le gâteau ?', 0, { enDirect: true, target: null }),
  qcm('Manche 2 ?', { intertitre: 'Manche 2' }),
  estimation('Encore ?', 7.5),
]
let QUESTIONS: unknown[] = QUESTIONS_TOUTES

interface Violation {
  sorte: string
  detail: string
  gestes: string[]
}

function jouer(graine: number, nGestes: number): Violation[] {
  const hasard = suiteFixe(graine)
  const tirer = <T>(xs: readonly T[]): T => xs[Math.floor(hasard() * xs.length)]
  const s = salle([{ id: 'q', title: 'Le fuzz', questions: QUESTIONS }])
  const noms: string[] = []
  const exclus = new Set<string>()
  let n = 0
  const nouveau = () => {
    const nom = `J${n++}`
    noms.push(nom)
    return nom
  }
  for (let i = 0; i < 4; i++) s.inscrire(nouveau())
  const gestes: string[] = []
  const violations: Violation[] = []
  const vues = new Set<string>()
  const signaler = (sorte: string, detail: string) => {
    if (vues.has(sorte)) return
    vues.add(sorte)
    violations.push({ sorte, detail, gestes: [...gestes] })
  }
  s.lancer({ autoNextSeconds: hasard() < 0.5 ? 5 : null })
  s.choisir('q', tirer([1, 2, 3]))
  const presents = () => noms.filter(x => !exclus.has(x))

  const verifier = () => {
    const sess = s.session
    if (!sess) return
    const st = sess.state
    const chronos = [...sess.timers.keys()]
    const a = (k: string) => chronos.includes(k)
    // Les chronomètres suivent la phase.
    if (a('question') && st.phase !== 'question') signaler('chrono question hors question', `${st.phase} ${chronos}`)
    if (a('settle') && st.phase !== 'question') signaler('souffle hors question', `${st.phase} ${chronos}`)
    if (a('autoNext') && st.phase !== 'reveal') signaler('enchaînement hors révélation', `${st.phase} ${chronos}`)
    if (a('observe') && st.phase !== 'observe') signaler('chrono photo hors photo', `${st.phase}`)
    if (a('intertitre') && st.phase !== 'intertitre') signaler('chrono intertitre hors intertitre', `${st.phase}`)
    if (a('ready') && st.phase !== 'getReady') signaler('chrono prêt hors prêt', `${st.phase}`)
    if (st.phase === 'question' && st.pausedMs === null && !a('question')) signaler('question sans chrono', JSON.stringify(chronos))
    if (st.phase === 'question' && st.pausedMs !== null && (a('question') || a('settle'))) signaler('pause qui court', JSON.stringify(chronos))
    if (st.phase === 'observe' && !a('observe')) signaler('photo sans chrono', '')
    if (st.phase === 'getReady' && !a('ready')) signaler('prêt sans chrono', '')
    if (st.phase === 'reveal' && (st.autoNextAt !== null) !== a('autoNext')) signaler('affiché ≠ armé (enchaînement)', `autoNextAt=${st.autoNextAt} ${chronos}`)
    if (st.phase === 'intertitre' && (st.deadline > 0) !== a('intertitre')) signaler('affiché ≠ armé (intertitre)', `deadline=${st.deadline} auto=${st.autoNextSeconds} ${chronos}`)
    if (st.phase !== 'question' && st.pausedMs !== null) signaler('pause hors question', `${st.phase} pausedMs=${st.pausedMs}`)
    // Les points : la partie, le journal des réponses et celui des gains disent la même chose.
    const journal = s.answers.all().filter(r => r.sessionId === sess.id)
    const gains = s.ledger.all().filter(e => e.sessionId === sess.id)
    for (const nom of presents()) {
      const id = s.idDe(nom)
      const total = st.totals[id] ?? 0
      const auJournal = journal.filter(r => r.playerId === id).reduce((x, r) => x + r.points, 0)
      const auxGains = gains.filter(e => e.playerId === id).reduce((x, e) => x + e.points, 0)
      if (total < 0) signaler('total négatif', `${nom} ${total}`)
      if (st.phase !== 'reveal' || !st.lastAwards) {
        if (total !== auxGains) signaler('partie ≠ gains', `${nom} partie=${total} gains=${auxGains}`)
      }
      // À la révélation, le journal a déjà la question : il suit la partie.
      if (st.phase === 'reveal' || st.phase === 'finished' || st.phase === 'pickPack' || st.phase === 'getReady' || st.phase === 'intertitre' || st.phase === 'observe' || st.phase === 'question' || st.phase === 'cible') {
        if (total !== auJournal) signaler('partie ≠ journal', `${nom} partie=${total} journal=${auJournal} phase=${st.phase} q=${st.qIndex}`)
      }
    }
    // Une ligne par invité et par question posée — jamais deux.
    const cles = new Set<string>()
    for (const r of journal) {
      const k = `${r.playerId}#${r.qIndex}`
      if (cles.has(k)) signaler('ligne en double au journal', k)
      cles.add(k)
      if (!sess.participantIds.includes(r.playerId) && !exclus.has(s.nomDe(r.playerId) ?? '')) {
        // Un exclu a été effacé : il ne doit plus y être.
      }
    }
    for (const r of journal) {
      if (exclus.has(s.nomDe(r.playerId) ?? '')) signaler('exclu au journal', r.playerId)
    }
    // Rien de la bonne réponse ne part aux téléphones pendant la question.
    if (st.phase === 'question' || st.phase === 'observe' || st.phase === 'intertitre') {
      for (const nom of presents()) {
        if (!sess.participantIds.includes(s.idDe(nom))) continue
        const v = s.vueJoueurMaintenant(nom) as any
        for (const k of ['correct', 'bonnes', 'ordre', 'anecdote', 'imageRevelation', 'target', 'votes', 'place']) {
          if (v[k] !== undefined) signaler(`fuite : ${k} pendant ${st.phase}`, JSON.stringify(v))
        }
      }
    }
    // Participants sans doublon, et tous inscrits.
    if (new Set(sess.participantIds).size !== sess.participantIds.length) signaler('participant en double', '')
    for (const id of sess.participantIds) if (!s.party.get(id)) signaler('participant fantôme', id)
  }

  for (let g = 0; g < nGestes && s.session; g++) {
    const st = s.st
    const r = hasard()
    let geste = ''
    try {
      if (r < 0.3) {
        const nom = tirer(presents())
        if (!nom) continue
        const q = st.pack?.questions[st.qIndex]
        let action: Record<string, unknown>
        if (q?.kind === 'number') action = { type: 'guess', value: Math.round(hasard() * 4000) }
        else if (q?.variante === 'plusieurs') action = { type: 'answers', choices: hasard() < 0.5 ? [0, 2] : [1] }
        else if (q?.variante === 'ordre') action = { type: 'order', order: hasard() < 0.3 ? q.ordre : [3, 2, 1, 0] }
        else action = { type: 'answer', choice: Math.floor(hasard() * 3) }
        // Parfois une réponse d'une autre question, ou d'un autre tour.
        if (hasard() < 0.1) action = { ...action, round: (st.round ?? 0) - 1 }
        geste = `${nom} répond ${JSON.stringify(action)}`
        s.repondre(nom, action)
      } else if (r < 0.5) {
        const perimee = hasard() < 0.2
        const visee = perimee ? { phase: tirer(['question', 'reveal', 'observe', 'intertitre']), qIndex: st.qIndex, round: st.round } : s.visee()
        geste = `next ${JSON.stringify(visee)}`
        s.commande({ type: 'next', ...visee })
      } else if (r < 0.55) {
        geste = 'pause'
        s.commande({ type: 'pause' })
      } else if (r < 0.6) {
        geste = 'resume'
        s.commande({ type: 'resume' })
      } else if (r < 0.63) {
        geste = 'cancel'
        s.commande({ type: 'cancel', ...s.visee() })
      } else if (r < 0.66) {
        geste = 'replay'
        s.commande({ type: 'replay', ...s.visee() })
      } else if (r < 0.69) {
        const seconds = tirer([null, 5, 10, 20])
        geste = `autoNext ${seconds}`
        s.commande({ type: 'autoNext', seconds })
      } else if (r < 0.71) {
        geste = 'cible'
        try {
          s.commande({ type: 'cible', value: 1200, ...s.visee() })
        } catch {}
      } else if (r < 0.74) {
        const nom = nouveau()
        geste = `arrive ${nom}`
        s.rejoindre(nom)
      } else if (r < 0.76) {
        const nom = tirer(presents())
        if (!nom || presents().length <= 2) continue
        geste = `exclu ${nom}`
        exclus.add(nom)
        s.exclure(nom)
      } else if (r < 0.8) {
        const nom = tirer(presents())
        if (!nom) continue
        if (s.party.isConnected(s.idDe(nom))) {
          geste = `coupé ${nom}`
          s.deconnecter(nom)
        } else {
          geste = `revenu ${nom}`
          s.reconnecter(nom)
        }
      } else if (r < 0.82) {
        const nom = tirer(presents())
        if (!nom) continue
        geste = `nePlusAttendre ${nom}`
        s.commande({ type: 'nePlusAttendre', playerId: s.idDe(nom) })
      } else {
        const ms = tirer([100, 700, 1500, 5000, 21_500, 30_000])
        geste = `+${ms} ms`
        h!.avancer(ms)
      }
    } catch (e) {
      signaler(`exception : ${(e as Error).message}`, geste)
    }
    gestes.push(`${geste}  → ${s.st?.phase} q${s.st?.qIndex} r${s.st?.round}`)
    if (gestes.length > 40) gestes.shift()
    verifier()
    // Un quiz fini : on en relance un, pour jouer longtemps.
    if (s.st?.phase === 'finished' && hasard() < 0.3) {
      s.lancer({ autoNextSeconds: null, joues: ['q'] })
      s.choisir('q', 1)
      gestes.push('— quiz suivant —')
    }
  }
  s.fermer()
  return violations
}

test('fuzz du moteur', () => {
  const toutes = new Map<string, Violation & { graine: number }>()
  for (let graine = 1; graine <= 150; graine++) {
    h = horloge()
    for (const v of jouer(graine, 600)) if (!toutes.has(v.sorte)) toutes.set(v.sorte, { ...v, graine })
    h.arreter()
    h = null
  }
  for (const v of toutes.values()) {
    console.log(`\n### ${v.sorte} (graine ${v.graine})\n${v.detail}\n  ${v.gestes.slice(-12).join('\n  ')}`)
  }
  assert.ok(true)
})

test('fuzz du moteur : des quiz d’une seule question, de chaque sorte', () => {
  const toutes = new Map<string, Violation & { graine: number }>()
  for (const [i, q] of QUESTIONS_TOUTES.entries()) {
    QUESTIONS = [q]
    for (let graine = 1; graine <= 40; graine++) {
      h = horloge()
      for (const v of jouer(1000 * (i + 1) + graine, 200)) if (!toutes.has(v.sorte)) toutes.set(v.sorte, { ...v, graine })
      h.arreter()
      h = null
    }
  }
  QUESTIONS = QUESTIONS_TOUTES
  for (const v of toutes.values()) {
    console.log(`\n### ${v.sorte} (graine ${v.graine})\n${v.detail}\n  ${v.gestes.slice(-12).join('\n  ')}`)
  }
  assert.ok(true)
})
