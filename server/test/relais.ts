// Un relais TCP entre un client et le serveur, qu'on peut changer en « trou
// noir » : les connexions ouvertes restent ouvertes, mais plus rien ne passe,
// dans aucun sens — ni les données ni la fermeture. C'est ce que vit un
// téléphone accroché à un wifi sans internet, au fond du jardin ou dans un
// tunnel : sa liaison se croit vivante, et socket.io ne l'apprend qu'au
// battement de cœur manqué (dix-huit secondes). Les connexions ouvertes
// APRÈS le trou noir passent normalement : le réseau d'après marche.
import net from 'node:net'

interface Paire {
  a: net.Socket
  b: net.Socket
  gelee: boolean
}

export interface Relais {
  port: number
  /** Les connexions ouvertes jusqu'ici tombent dans le trou noir. */
  trouNoir(): number
  fermer(): Promise<void>
}

export async function relais(portCible: number, opts: { cookie?: string } = {}): Promise<Relais> {
  const paires = new Set<Paire>()
  const serveur = net.createServer(a => {
    const b = net.connect(portCible, '127.0.0.1')
    const p: Paire = { a, b, gelee: false }
    paires.add(p)
    // Le navigateur joint son cookie à chaque poignée de main ; un module du
    // client chargé dans Node, non, et la liaison du chef (`socketDuChef.ts`)
    // s'ouvre d'elle-même, sans rien qu'on puisse lui glisser. Le relais le
    // pose donc en tête de la requête qui ouvre chaque connexion, juste
    // derrière sa première ligne.
    let aJoindre = opts.cookie ?? null
    a.on('data', d => {
      if (p.gelee) return
      const ligne = aJoindre ? d.indexOf('\r\n') : -1
      if (ligne > 0) {
        b.write(Buffer.concat([d.subarray(0, ligne + 2), Buffer.from(`Cookie: ${aJoindre}\r\n`), d.subarray(ligne + 2)]))
        aJoindre = null
        return
      }
      b.write(d)
    })
    b.on('data', d => {
      if (!p.gelee) a.write(d)
    })
    // Une fermeture ne traverse pas un trou noir : le serveur qui ferme de
    // son côté ne le fait pas savoir au téléphone, et inversement.
    a.on('close', () => {
      paires.delete(p)
      if (!p.gelee) b.destroy()
    })
    b.on('close', () => {
      if (!p.gelee) a.destroy()
    })
    a.on('error', () => {})
    b.on('error', () => {})
  })
  await new Promise<void>(r => serveur.listen(0, '127.0.0.1', () => r()))
  return {
    port: (serveur.address() as net.AddressInfo).port,
    trouNoir() {
      for (const p of paires) p.gelee = true
      return paires.size
    },
    async fermer() {
      for (const p of paires) {
        p.a.destroy()
        p.b.destroy()
      }
      await new Promise<void>(r => serveur.close(() => r()))
    },
  }
}
