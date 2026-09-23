// Ce que les scripts d'animation partagent : se connecter comme un animateur
// et ouvrir un socket d'écran commun avec sa session.
//
// L'identifiant et le mot de passe viennent de ADMIN_LOGIN / ADMIN_PASSWORD —
// « antoine » / « demo » par défaut, comme le serveur chez soi.
import { io } from 'socket.io-client'

/** Se connecte par HTTP et rend le cookie de session, tel que le navigateur le renverrait. */
export async function loginCookie(
  url,
  login = process.env.ADMIN_LOGIN ?? 'antoine',
  password = process.env.ADMIN_PASSWORD ?? 'demo',
) {
  const res = await fetch(`${url.replace(/\/+$/, '')}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz' },
    body: JSON.stringify({ login, password }),
  })
  if (!res.ok) {
    throw new Error(`connexion de « ${login} » refusée (${res.status}) — passe ADMIN_LOGIN et ADMIN_PASSWORD`)
  }
  const m = /qz_session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')
  if (!m) throw new Error('pas de cookie de session dans la réponse')
  return `qz_session=${m[1]}`
}

/** Un socket d'écran commun : le cookie voyage dans la poignée de main, comme depuis la page. */
export function hostSocket(url, cookie) {
  return io(url, { transports: ['websocket'], forceNew: true, extraHeaders: { Cookie: cookie } })
}

/** Le nom de l'espace dans l'adresse, pour les invités : `--slug`, sinon QUIZ_SLUG, sinon « demo ». */
export function slugArg(argv = process.argv) {
  const i = argv.indexOf('--slug')
  return (i >= 0 && argv[i + 1]) || process.env.QUIZ_SLUG || 'demo'
}
