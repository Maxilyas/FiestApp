import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createQuizServer } from './server'

const here = path.dirname(fileURLToPath(import.meta.url))

const port = Number(process.env.PORT ?? 3001)
const dbPath = process.env.DB_PATH ?? path.resolve(here, '../data/quizz.db')
// En ligne, c'est cette adresse que le QR code doit montrer. Render la fournit
// toute seule ; ailleurs, on la donne via PUBLIC_URL.
const publicUrl = process.env.PUBLIC_URL ?? process.env.RENDER_EXTERNAL_URL
// Render pose RENDER=true dans l'environnement de chaque service.
const online = !!process.env.RENDER || process.env.NODE_ENV === 'production'

// Le compte administrateur est créé au tout premier démarrage, quand il n'y
// a encore aucun compte, depuis ces variables. Ensuite elles ne servent plus :
// le mot de passe se change depuis « Mon compte », et la variable peut être
// retirée de l'hébergeur. Le mot de passe par défaut n'a de sens que chez soi :
// en ligne, on refuse de démarrer sans un vrai.
const DEFAULT_PASSWORD = 'romane'
const admin = {
  login: process.env.ADMIN_LOGIN || 'antoine',
  password: process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD,
  slug: process.env.ADMIN_SLUG || 'romane',
  name: process.env.ADMIN_NAME || 'Antoine',
}
if (online && admin.password === DEFAULT_PASSWORD) {
  console.error('❌ ADMIN_PASSWORD manquant : définis le mot de passe de l’administrateur dans les variables du service.')
  process.exit(1)
}

// Par défaut la bibliothèque vit dans un fichier local, à côté de la base de
// partie. En ligne, on pointe QUIZ_DB_URL vers Turso : le code ne change pas.
const quizDbUrl =
  process.env.QUIZ_DB_URL ?? `file:${path.resolve(path.dirname(dbPath), 'quizzes.db').replace(/\\/g, '/')}`
const quizDbToken = process.env.QUIZ_DB_TOKEN
// Au-delà, la soirée est déclarée complète : cinquante invités attendus,
// trois fois plus ne peut être qu'un robot. Réglable si la fête grossit.
const maxPlayers = Number(process.env.MAX_PLAYERS) || undefined

createQuizServer({ port, dbPath, admin, quizDbUrl, quizDbToken, publicUrl, online, maxPlayers }).then(
  server => {
    console.log(`🎉 Quizz — serveur prêt sur http://localhost:${server.port}`)
    // Aucun secret dans les journaux : en ligne, ils sont conservés et
    // lisibles par tout le monde sur le tableau de bord de l'hébergeur.
    console.log(`   Écran commun : http://localhost:${server.port}/host  (compte « ${admin.login} »)`)
    console.log(`   Mes quiz     : http://localhost:${server.port}/edit`)

    // L'hébergeur prévient avant de redémarrer : on laisse partir les dernières
    // écritures distantes (points, partie en cours) avant de s'éteindre.
    const shutdown = () => {
      console.log('[serveur] extinction demandée, sauvegarde en cours…')
      server.close().then(() => process.exit(0))
      setTimeout(() => process.exit(0), 5000).unref()
    }
    process.once('SIGTERM', shutdown)
    process.once('SIGINT', shutdown)
  },
)
