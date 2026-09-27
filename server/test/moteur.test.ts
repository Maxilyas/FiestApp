// Le moteur du quiz, horloge à la main : ce que les phases font aux
// arrivées, aux absents, aux pauses et à l'enchaînement.
//
// L'audit du 27 septembre 2026 (mission « moteur », `retours/2026-09-27/`)
// les a rejoués sur le vrai moteur : le téléphone mort qu'on n'attend plus
// qui pesait sur la moyenne de son équipe, l'arrivé au podium qui y montait,
// l'arrivé dans le souffle qui lisait « Pas de réponse », le candidat exclu
// devenu « ??? », deux Camille indiscernables, une révélation restée « en
// pause », un intertitre « au clic » qui partait seul, un enchaînement
// illisible qui sautait les révélations.
//
// Pas de serveur : le vrai moteur sur une base en mémoire (`salle.ts`), pour
// viser des instants qu'un vrai serveur ne laisse pas choisir.
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { horloge, qcm, salle, sondage } from './salle'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

/** Ce que le téléphone montre d'une vue, rendu en HTML. */
async function telephone(view: object): Promise<string> {
  const module = await import(new URL('../../client/src/games/quiz/PlayerView.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module.QuizPlayer, { view, send: () => {}, teams: [], myTeamId: null }))
}

let h: ReturnType<typeof horloge> | null = null
afterEach(() => {
  h?.arreter()
  h = null
})

/** Une salle de trois invités, le premier quiz lancé, sa première question ouverte. */
function partie(questions: unknown[], { config, noms = ['Alice', 'Bruno', 'Chloé'] }: { config?: unknown; noms?: string[] } = {}) {
  h = horloge()
  const s = salle([{ id: 'q', title: 'Le moteur', questions }])
  for (const nom of noms) s.inscrire(nom)
  s.lancer(h.avancer, config)
  return s
}

// ── Les absents ───────────────────────────────────────────────────────────

test('le téléphone mort qu’on n’attend plus n’entre pas au journal des questions qu’il ne voit pas', () => {
  const s = partie([qcm('Un ?'), qcm('Deux ?')])
  // Chloé répond, puis son téléphone meurt : sa réponse compte.
  s.repondre('Chloé', { type: 'answer', choice: 0 })
  s.deconnecter('Chloé')
  s.repondre('Alice', { type: 'answer', choice: 0 })
  s.repondre('Bruno', { type: 'answer', choice: 1 })
  h!.avancer(700)
  s.commande({ type: 'next', ...s.visee() })
  // Question 2 : l'animateur ne l'attend plus. Elle ne voit pas la question :
  // une ligne « présente, sans réponse, 0 point » la comptait parmi les
  // présents de son équipe, et en faisait baisser la moyenne.
  s.commande({ type: 'nePlusAttendre', playerId: s.idDe('Chloé') })
  s.repondre('Alice', { type: 'answer', choice: 0 })
  s.repondre('Bruno', { type: 'answer', choice: 0 })
  h!.avancer(700)
  assert.equal(s.st.phase, 'reveal')
  const journal = (q: number) =>
    s.answers
      .all()
      .filter(r => r.qIndex === q)
      .map(r => r.playerId)
      .sort()
  assert.deepEqual(journal(0), [s.idDe('Alice'), s.idDe('Bruno'), s.idDe('Chloé')].sort(), 'sa réponse d’avant la panne reste')
  assert.deepEqual(journal(1), [s.idDe('Alice'), s.idDe('Bruno')].sort(), 'la question qu’il ne voit pas ne le compte pas')
  s.fermer()
})

test('un téléphone en veille, lui, reste présent : attendu, puis compté sans réponse', () => {
  const s = partie([qcm('Un ?')])
  s.deconnecter('Chloé')
  s.repondre('Alice', { type: 'answer', choice: 0 })
  s.repondre('Bruno', { type: 'answer', choice: 0 })
  h!.avancer(700)
  assert.equal(s.st.phase, 'question', 'on l’attend : c’est peut-être un hoquet du réseau')
  h!.avancer(20_000 + 1500)
  assert.equal(s.st.phase, 'reveal')
  const chloe = s.answers.all().find(r => r.playerId === s.idDe('Chloé'))
  assert.deepEqual(chloe && { answered: chloe.answered, points: chloe.points }, { answered: false, points: 0 })
  s.fermer()
})

// ── Les arrivées ──────────────────────────────────────────────────────────

test('arrivé au podium, on n’y monte pas : il reste à ceux qui ont joué', () => {
  const s = partie([qcm('Un ?'), qcm('Deux ?')], { noms: ['Zoé', 'Yves', 'Xavier'] })
  for (let q = 0; q < 2; q++) {
    s.repondre('Zoé', { type: 'answer', choice: 0 })
    s.repondre('Yves', { type: 'answer', choice: 1 })
    s.repondre('Xavier', { type: 'answer', choice: 1 })
    h!.avancer(700)
    s.commande({ type: 'next', ...s.visee() })
  }
  assert.equal(s.st.phase, 'finished')
  // Aaron arrive pendant le podium : il n'a joué aucune question. À zéro, il
  // se rangeait parmi les ex æquo par ordre alphabétique — devant Xavier et Yves.
  s.rejoindre('Aaron')
  const standings = s.vueHote()!.standings!.map(r => r.name)
  assert.ok(!standings.includes('Aaron'), `le classement du quiz à l’écran ne le compte pas (vu : ${standings.join(', ')})`)
  assert.deepEqual(
    s.vueDe('Xavier')!.podium!.map(r => r.name),
    ['Zoé', 'Xavier', 'Yves'],
    'le podium des téléphones reste celui des trois joueurs',
  )
  assert.equal(s.vueDe('Aaron')!.yourPodiumIndex, undefined, 'son téléphone ne le surligne pas sur le podium')
  s.fermer()
})

test('arrivé dans le souffle, quand toute la salle a répondu : la question n’est pas la sienne', () => {
  const s = partie([qcm('Un ?'), qcm('Deux ?')], { noms: ['Alice', 'Bruno'] })
  s.repondre('Alice', { type: 'answer', choice: 0 })
  s.repondre('Bruno', { type: 'answer', choice: 0 })
  h!.avancer(100)
  // Zoé scanne le QR : la salle a fini, le souffle de 700 ms court. Elle
  // avait 600 ms pour lire, puis « Pas de réponse », et un zéro au journal
  // comme dans la moyenne de son équipe.
  s.rejoindre('Zoé')
  h!.avancer(600)
  assert.equal(s.st.phase, 'reveal', 'le souffle révèle comme prévu : la salle a fini')
  assert.equal(s.vueDe('Zoé')!.justArrived, true, '« Bienvenue » : elle entre à la question suivante')
  assert.equal(
    s.answers.all().some(r => r.playerId === s.idDe('Zoé')),
    false,
    'rien au journal pour une question qu’elle n’a pas jouée',
  )
  s.commande({ type: 'next', ...s.visee() })
  assert.equal(s.repondre('Zoé', { type: 'answer', choice: 0 }), null, 'la suivante est la sienne')
  s.fermer()
})

test('arrivé en pleine question, quand la salle n’a pas fini : il joue la question', () => {
  const s = partie([qcm('Un ?')], { noms: ['Alice', 'Bruno'] })
  s.repondre('Alice', { type: 'answer', choice: 0 })
  s.rejoindre('Zoé')
  assert.equal(s.repondre('Zoé', { type: 'answer', choice: 0 }), null)
  s.fermer()
})

// ── « Qui dans la salle ? » ───────────────────────────────────────────────

test('« Qui dans la salle ? » : un candidat exclu disparaît de la liste, et ne se désigne plus', async () => {
  const s = partie([sondage('Qui a le plus beau sourire ?'), qcm('Deux ?')])
  const chloe = s.st.candidats.indexOf(s.idDe('Chloé'))
  s.exclure('Chloé')
  const liste = s.vueDe('Alice')!.answers!
  assert.ok(!liste.includes('???'), `la liste des invités à désigner (vue : ${JSON.stringify(liste)})`)
  assert.equal(liste[chloe], '', 'sa place reste — les votes se comptent par position —, sans nom')
  assert.notEqual(s.repondre('Alice', { type: 'answer', choice: chloe }), null, 'voter pour elle est refusé')
  assert.equal(s.repondre('Alice', { type: 'answer', choice: s.st.candidats.indexOf(s.idDe('Bruno')) }), null, 'pour Bruno, si')
  const html = await telephone(s.vueDe('Bruno')!)
  assert.equal([...html.matchAll(/class="ans-btn sondage-btn/g)].length, 2, 'le téléphone ne montre que les deux invités restants')
  assert.doesNotMatch(html, /\?\?\?/)
  s.fermer()
})

test('« Qui dans la salle ? » : deux Camille aux avatars différents se distinguent dans la liste', async () => {
  h = horloge()
  const s = salle([{ id: 'q', title: 'Sondage', questions: [sondage('Qui ?')] }])
  s.inscrire('Camille', '🦊')
  s.inscrire('Camille', '🐼')
  s.inscrire('Hugo', '🐻')
  s.lancer(h.avancer)
  // L'avatar, qui distingue deux Camille partout ailleurs (invariant 17),
  // n'était pas dans la liste : deux boutons « Camille ».
  for (const v of [s.vueDe('Hugo')!, s.vueHote()!]) {
    const lignes = v.answers!.map((nom, i) => `${v.avatars?.[i] ?? ''} ${nom}`)
    assert.deepEqual(lignes, ['🦊 Camille', '🐼 Camille', '🐻 Hugo'])
  }
  // Et le téléphone les montre : deux boutons qu'on distingue.
  const boutons = [...(await telephone(s.vueDe('Hugo')!)).matchAll(/<button[^>]*sondage-btn[^>]*>(.*?)<\/button>/g)].map(m =>
    m[1].replace(/<[^>]+>/g, ''),
  )
  assert.deepEqual(boutons, ['🦊Camille', '🐼Camille', '🐻Hugo'])
  s.fermer()
})

// ── La pause, l'intertitre, l'enchaînement ─────────────────────────────────

test('« Révéler » pendant une pause : la révélation n’est plus « en pause »', () => {
  const s = partie([qcm('Un ?'), qcm('Deux ?')])
  s.commande({ type: 'pause' })
  assert.equal(s.vueHote()?.paused, true, 'la question est en pause')
  s.commande({ type: 'next', ...s.visee() })
  assert.equal(s.st.phase, 'reveal')
  // La télécommande affichait « En pause » à côté de la bonne réponse, et le
  // bouton de la console restait « Reprendre » toute la révélation.
  assert.equal(s.vueHote()?.paused, undefined, 'la vue de l’animateur ne se dit plus en pause')
  assert.equal(s.vueDe('Alice')?.paused, undefined, 'ni celle du téléphone')
  assert.equal(s.st.pausedMs, null)
  s.fermer()
})

test('« au clic » pendant un intertitre : il attend le clic, comme la révélation', () => {
  const s = partie([qcm('Un ?'), qcm('Deux ?', { intertitre: 'Manche 2' })], { config: { autoNextSeconds: 10 } })
  for (const nom of ['Alice', 'Bruno', 'Chloé']) s.repondre(nom, { type: 'answer', choice: 0 })
  h!.avancer(700)
  assert.equal(s.st.phase, 'reveal')
  h!.avancer(10_000)
  assert.equal(s.st.phase, 'intertitre', 'l’enchaînement a posé l’intertitre, compte à rebours compris')
  s.commande({ type: 'autoNext', seconds: null })
  assert.equal(s.vueHote()?.autoNextSeconds, null, 'la console affiche « au clic »')
  assert.equal(s.vueHote()?.deadline, undefined, 'la pastille du compte à rebours s’en va')
  h!.avancer(15_000)
  assert.equal(s.st.phase, 'intertitre', 'l’intertitre attend le clic, il ne part pas seul')
  s.commande({ type: 'next', ...s.visee() })
  assert.equal(s.st.phase, 'question')
  s.fermer()
})

test('un palier d’enchaînement illisible ne fait pas sauter les révélations', () => {
  const s = partie([qcm('Un ?'), qcm('Deux ?'), qcm('Trois ?')])
  // Un écran d'avant, ou un appel forgé depuis une console authentifiée :
  // `seconds` absent valait NaN, et l'enchaînement s'armait à 1 ms.
  for (const seconds of [undefined, 'dix', Number.NaN, Number.POSITIVE_INFINITY]) {
    s.commande({ type: 'autoNext', seconds })
    assert.ok(s.st.autoNextSeconds === null, `réglage lu pour ${String(seconds)} : ${s.st.autoNextSeconds}`)
  }
  for (const nom of ['Alice', 'Bruno', 'Chloé']) s.repondre(nom, { type: 'answer', choice: 0 })
  h!.avancer(700)
  h!.avancer(50)
  assert.equal(s.st.phase, 'reveal', 'la salle voit la bonne réponse')
  assert.equal(s.st.qIndex, 0)
  s.fermer()
})
