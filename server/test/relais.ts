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

export async function relais(portCible: number): Promise<Relais> {
  const paires = new Set<Paire>()
  const serveur = net.createServer(a => {
    const b = net.connect(portCible, '127.0.0.1')
    const p: Paire = { a, b, gelee: false }
    paires.add(p)
    a.on('data', d => {
      if (!p.gelee) b.write(d)
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
