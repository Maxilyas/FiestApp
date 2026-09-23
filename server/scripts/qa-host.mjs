// Pilote « écran commun » en ligne de commande — pratique pour tester sans TV :
//   node scripts/qa-host.mjs <url> launch
//   node scripts/qa-host.mjs <url> command <sessionId> "<json>"
//   node scripts/qa-host.mjs <url> end <sessionId>
//   node scripts/qa-host.mjs <url> state
// Le script se connecte comme l'animateur (ADMIN_LOGIN / ADMIN_PASSWORD,
// « antoine » / « demo » par défaut) : c'est sa session qui dit l'espace.
import { hostSocket, loginCookie } from './login.mjs'

const [url, verb, a, b] = process.argv.slice(2)
const cookie = await loginCookie(url).catch(e => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
const socket = hostSocket(url, cookie)

socket.on('connect', () => {
  socket.emit('host:hello', {}, res => {
    if (!res.ok) {
      console.error('Session refusée par l’écran commun')
      process.exit(1)
    }
    console.log(`espace « ${res.slug} » (${res.name})`)
    if (verb === 'launch') socket.emit('host:launch')
    if (verb === 'command') socket.emit('host:command', { sessionId: a, command: JSON.parse(b) })
    if (verb === 'end') socket.emit('host:endSession', { sessionId: a })
    if (verb !== 'state') setTimeout(() => process.exit(0), 700)
  })
})

socket.on('toast', t => console.log('toast:', t.message))
socket.on('party:snapshot', s => {
  if (verb === 'state') {
    console.log(JSON.stringify({ space: s.space.slug, session: s.session, players: s.players.length }, null, 1))
    setTimeout(() => process.exit(0), 200)
  }
})
