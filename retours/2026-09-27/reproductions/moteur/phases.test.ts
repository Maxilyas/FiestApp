// Les reproductions de la mission « moteur » sur le module du quiz et le vrai
// moteur, horloge à la main (`harnais.ts`). Chaque épreuve échoue sur le code
// du 26 septembre 2026 (b57035c) et passera quand son constat sera corrigé.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/moteur/phases.test.ts
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { horloge, qcm, salle, sondage } from './harnais'

let h: ReturnType<typeof horloge> | null = null
afterEach(() => {
  h?.arreter()
  h = null
})

/** Trois invités, un quiz, la première question ouverte. */
function partie(questions: unknown[], config?: unknown, noms = ['Alice', 'Bruno', 'Chloé']) {
  h = horloge()
  const s = salle([{ id: 'q', title: 'Le moteur', questions }])
  for (const nom of noms) s.inscrire(nom)
  s.lancer(config)
  s.choisir('q')
  h.avancer(3000)
  return s
}

test('moteur-7 · « Révéler » pendant une pause : la révélation n’est plus « en pause »', () => {
  const s = partie([qcm('Un ?'), qcm('Deux ?')])
  s.commande({ type: 'pause' })
  assert.equal(s.vueHote()?.paused, true, 'la question est en pause')
  s.commande({ type: 'next', ...s.visee() })
  assert.equal(s.st.phase, 'reveal')
  // La télécommande affiche « En pause » tant que la vue le dit, et le bouton
  // de la console reste « Reprendre » (grisé) pendant toute la révélation.
  assert.equal(s.vueHote()?.paused, undefined, 'la vue de l’animateur ne se dit plus en pause')
  assert.equal(s.vueDe('Alice')?.paused, undefined, 'ni celle du téléphone')
  assert.equal(s.st.pausedMs, null, 'l’état non plus')
  s.fermer()
})

test('moteur-8 · « au clic » pendant un intertitre : il attend le clic, comme la révélation', () => {
  const s = partie([qcm('Un ?'), qcm('Deux ?', { intertitre: 'Manche 2' })], { autoNextSeconds: 10 })
  for (const nom of ['Alice', 'Bruno', 'Chloé']) s.repondre(nom, { type: 'answer', choice: 0 })
  h!.avancer(700)
  assert.equal(s.st.phase, 'reveal')
  h!.avancer(10_000)
  assert.equal(s.st.phase, 'intertitre', 'l’enchaînement a posé l’intertitre, compte à rebours compris')
  s.commande({ type: 'autoNext', seconds: null })
  assert.equal(s.vueHote()?.autoNextSeconds, null, 'la console affiche « au clic »')
  assert.equal(s.vueHote()?.deadline, undefined, 'la pastille du compte à rebours s’en va')
  h!.avancer(15_000)
  assert.equal(s.st.phase, 'intertitre', '« au clic » : l’intertitre attend le clic, il ne part pas seul')
  s.fermer()
})

test('moteur-2 · arrivé au podium, on n’y monte pas : le podium reste à ceux qui ont joué', () => {
  const s = partie([qcm('Un ?'), qcm('Deux ?')], undefined, ['Zoé', 'Yves', 'Xavier'])
  for (let q = 0; q < 2; q++) {
    s.repondre('Zoé', { type: 'answer', choice: 0 })
    s.repondre('Yves', { type: 'answer', choice: 1 })
    s.repondre('Xavier', { type: 'answer', choice: 1 })
    h!.avancer(700)
    s.commande({ type: 'next', ...s.visee() })
  }
  assert.equal(s.st.phase, 'finished')
  // Aaron arrive pendant le podium : il n'a joué aucune question.
  s.rejoindre('Aaron')
  const podiumTele = s.vueDe('Xavier')!.podium!.map(r => r.name)
  const standings = s.vueHote()!.standings!.map(r => r.name)
  assert.ok(!standings.includes('Aaron'), `le classement du quiz à l’écran ne le compte pas (vu : ${standings.join(', ')})`)
  assert.deepEqual(podiumTele, ['Zoé', 'Xavier', 'Yves'], 'le podium des téléphones reste celui des trois joueurs')
  assert.equal(s.vueDe('Aaron')!.yourPodiumIndex, undefined, 'son téléphone ne le surligne pas sur le podium')
  s.fermer()
})

test('moteur-4 · « Qui dans la salle ? » : un candidat exclu ne devient pas « ??? » sur les téléphones', () => {
  const s = partie([sondage('Qui a le plus beau sourire ?'), qcm('Deux ?')])
  s.exclure('Chloé')
  const liste = s.vueDe('Alice')!.answers!
  assert.ok(!liste.includes('???'), `la liste des invités à désigner (vue : ${JSON.stringify(liste)})`)
  s.fermer()
})

test('moteur-5 · « Qui dans la salle ? » : deux Camille aux avatars différents se distinguent dans la liste', () => {
  h = horloge()
  const s = salle([{ id: 'q', title: 'Sondage', questions: [sondage('Qui ?')] }])
  s.inscrire('Camille', '🦊')
  s.inscrire('Camille', '🐼')
  s.inscrire('Hugo', '🐻')
  s.lancer()
  s.choisir('q')
  h.avancer(3000)
  const v = s.vueDe('Hugo')! as any
  // La liste ne porte que des prénoms : l'avatar, qui distingue deux Camille
  // partout ailleurs (invariant 17), n'y est pas.
  const lignes = v.answers.map((nom: string, i: number) => `${nom}${v.avatars?.[i] ?? ''}`)
  assert.equal(new Set(lignes).size, lignes.length, `chaque bouton se distingue (vu : ${JSON.stringify(lignes)})`)
  s.fermer()
})

test('moteur-9 · un palier d’enchaînement illisible ne fait pas sauter les révélations', () => {
  const s = partie([qcm('Un ?'), qcm('Deux ?'), qcm('Trois ?')])
  // Un écran d'avant, ou un appel forgé depuis une console authentifiée.
  s.commande({ type: 'autoNext' })
  assert.ok(s.st.autoNextSeconds === null || Number.isFinite(s.st.autoNextSeconds), `réglage lu : ${s.st.autoNextSeconds}`)
  for (const nom of ['Alice', 'Bruno', 'Chloé']) s.repondre(nom, { type: 'answer', choice: 0 })
  h!.avancer(700)
  assert.equal(s.st.phase, 'reveal', 'la salle voit la bonne réponse')
  assert.equal(s.st.qIndex, 0)
  s.fermer()
})

test('moteur-3 · arrivé dans le souffle (toute la salle a répondu) : la question l’attend, ou n’est pas la sienne', () => {
  const s = partie([qcm('Un ?'), qcm('Deux ?')], undefined, ['Alice', 'Bruno'])
  s.repondre('Alice', { type: 'answer', choice: 0 })
  s.repondre('Bruno', { type: 'answer', choice: 0 })
  h!.avancer(100)
  // Zoé scanne le QR : la salle a fini, le souffle de 700 ms court.
  s.rejoindre('Zoé')
  h!.avancer(600)
  const v = s.vueDe('Zoé')!
  const ligne = s.answers.all().find(r => r.playerId === s.idDe('Zoé') && r.qIndex === 0)
  // Soit la question l'attend (le souffle ne vaut que pour une salle qui a
  // fini), soit elle commence à la suivante : « Bienvenue », et rien au
  // journal. Aujourd'hui : 600 ms pour lire, puis « Pas de réponse », une
  // ligne à 0 au journal — et dans la moyenne de son équipe.
  const attendue = s.st.phase === 'question'
  const pasLaSienne = v.justArrived === true && !ligne
  assert.ok(attendue || pasLaSienne, `phase ${s.st.phase}, justArrived ${v.justArrived}, au journal : ${JSON.stringify(ligne && { answered: ligne.answered, points: ligne.points })}`)
  s.fermer()
})
