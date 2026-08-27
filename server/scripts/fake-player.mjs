// Joueur fantôme pour tester sans deuxième téléphone :
//   node scripts/fake-player.mjs http://localhost:3001 [Nom] [durée-en-s]
// Il rejoint la soirée et répond au hasard à chaque question du quiz, avec un
// petit délai aléatoire pour imiter un vrai doigt. Utile aussi pour simuler
// 50 invités d'un coup (voir README).
import { io } from 'socket.io-client'

const url = process.argv[2] ?? 'http://localhost:3001'
const name = process.argv[3] ?? 'TestPhone'
const lifetimeSec = Number(process.argv[4] ?? 90)

const socket = io(url, { transports: ['websocket'] })
const answered = new Set()

socket.on('connect', () => {
  socket.emit('player:join', { name, avatar: '📱' }, res => {
    console.log(`[${name}] join:`, JSON.stringify(res))
  })
})

socket.on('session:view', ({ sessionId, view }) => {
  if (view.phase !== 'question') return
  const key = `${sessionId}:${view.qIndex}`
  if (answered.has(key)) return
  answered.add(key)
  const delay = 500 + Math.random() * 4000
  if (view.kind === 'number') {
    // Estimation : un nombre plausible au hasard, pour voir la dispersion.
    const value = Math.round(Math.random() * 100)
    setTimeout(() => {
      socket.emit('player:action', { sessionId, action: { type: 'guess', value } })
      console.log(`[${name}] Q${view.qIndex + 1} → estimation ${value}`)
    }, delay)
    return
  }
  const choice = Math.floor(Math.random() * (view.answers?.length ?? 4))
  setTimeout(() => {
    socket.emit('player:action', { sessionId, action: { type: 'answer', choice } })
    console.log(`[${name}] Q${view.qIndex + 1} → réponse ${choice + 1}`)
  }, delay)
})

socket.on('toast', t => console.log(`[${name}] toast:`, t.message))

setTimeout(() => process.exit(0), lifetimeSec * 1000)
