// Un relais TCP entre le navigateur et le serveur, qu'on peut changer en
// « trou noir » : les connexions ouvertes restent ouvertes, mais plus rien ne
// passe, dans aucun sens — ni les données ni la fermeture. C'est ce que vit
// un téléphone qui passe du wifi à la 4G, entre dans un tunnel, ou reste
// accroché à un wifi sans internet : sa liaison se croit vivante, et
// socket.io ne l'apprend qu'au battement de cœur manqué (jusqu'à 18 s).
// Les connexions ouvertes APRÈS le trou noir passent normalement : le
// nouveau réseau marche.
import net from 'node:net'

interface Paire {
  a: net.Socket
  b: net.Socket
  gelee: boolean
}

export async function relais(portCible: number) {
  const paires = new Set<Paire>()
  /** Coupé : les connexions ouvertes sont fermées, les nouvelles refusées. */
  let coupe = false
  const serveur = net.createServer(a => {
    if (coupe) return void a.destroy()
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
    // son côté ne le fait pas savoir au téléphone.
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
  const port = (serveur.address() as net.AddressInfo).port
  return {
    port,
    /** Les connexions ouvertes jusqu'ici tombent dans le trou noir. */
    trouNoir() {
      for (const p of paires) p.gelee = true
      return paires.size
    },
    /** Le réseau tombe franchement : le navigateur le sait, et ne peut plus se reconnecter. */
    couper() {
      coupe = true
      for (const p of paires) {
        p.a.destroy()
        p.b.destroy()
      }
    },
    /** Le réseau revient. */
    retablir() {
      coupe = false
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
