// Pilote « écran commun » en ligne de commande — pratique pour tester sans TV :
//   node scripts/qa-host.mjs <url> launch
//   node scripts/qa-host.mjs <url> command <sessionId> "<json>"
//   node scripts/qa-host.mjs <url> end <sessionId>
//   node scripts/qa-host.mjs <url> state
import { io } from 'socket.io-client'

const [url, verb, a, b] = process.argv.slice(2)
const key = process.env.HOST_KEY ?? 'romane'
const socket = io(url, { transports: ['websocket'] })

socket.on('connect', () => {
  socket.emit('host:hello', { key }, res => {
    if (!res.ok) {
      console.error('Clé host refusée')
      process.exit(1)
    }
    if (verb === 'launch') socket.emit('host:launch')
    if (verb === 'command') socket.emit('host:command', { sessionId: a, command: JSON.parse(b) })
    if (verb === 'end') socket.emit('host:endSession', { sessionId: a })
    if (verb !== 'state') setTimeout(() => process.exit(0), 700)
  })
})

socket.on('toast', t => console.log('toast:', t.message))
socket.on('party:snapshot', s => {
  if (verb === 'state') {
    console.log(JSON.stringify({ session: s.session, players: s.players.length }, null, 1))
    setTimeout(() => process.exit(0), 200)
  }
})
