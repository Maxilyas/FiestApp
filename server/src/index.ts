import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createQuizServer, DemarrageRefuse, MOT_DE_PASSE_PAR_DEFAUT } from './server'
import { DELAI_DISTANT_MS, pourquoiInjoignable } from './core/distante'

const here = path.dirname(fileURLToPath(import.meta.url))

const port = Number(process.env.PORT ?? 3001)
const dbPath = process.env.DB_PATH ?? path.resolve(here, '../data/quizz.db')
// En ligne, c'est cette adresse que le QR code doit montrer. Render la fournit
// toute seule ; ailleurs, on la donne via PUBLIC_URL.
const publicUrl = process.env.PUBLIC_URL ?? process.env.RENDER_EXTERNAL_URL
// Render pose RENDER=true dans l'environnement de chaque service.
const online = !!process.env.RENDER || process.env.NODE_ENV === 'production'

/** Refuser de démarrer : une ligne qui dit quoi faire, et un code d'erreur que l'hébergeur voit. */
function refuser(message: string): never {
  console.error(`❌ ${message}`)
  process.exit(1)
}

// Le compte administrateur est créé au tout premier démarrage, quand la base
// n'a encore aucun compte, depuis ces variables. Ensuite elles ne servent
// plus : le mot de passe se change depuis « Mon compte », et la variable peut
// être retirée de l'hébergeur — les démarrages suivants s'en passent. Le mot
// de passe par défaut n'a de sens que chez soi : en ligne, `createQuizServer`
// refuse de créer le compte avec, et seulement dans ce cas-là.
const admin = {
  login: process.env.ADMIN_LOGIN || 'antoine',
  password: process.env.ADMIN_PASSWORD || MOT_DE_PASSE_PAR_DEFAUT,
  slug: process.env.ADMIN_SLUG || 'demo',
  name: process.env.ADMIN_NAME || 'Antoine',
}

// Par défaut la bibliothèque vit dans un fichier local, à côté de la base de
// partie. En ligne, on pointe QUIZ_DB_URL vers Turso : le code ne change pas.
//
// Mais en ligne, ce repli est un piège : le disque de l'hébergeur gratuit
// s'efface à chaque réveil. Le serveur démarrait dessus sans un mot, et
// comptes, quiz, archives et profils disparaissaient au premier réveil. On
// refuse donc quand la variable MANQUE ; un `file:` donné exprès reste
// permis — chez qui s'auto-héberge sur un disque durable, c'est un choix.
const quizDbUrlDonnee = process.env.QUIZ_DB_URL?.trim()
if (online && !quizDbUrlDonnee) {
  refuser(
    'QUIZ_DB_URL manquant : en ligne, sans base permanente, comptes, quiz et soirées seraient perdus au premier réveil. ' +
      'Renseigne QUIZ_DB_URL et QUIZ_DB_TOKEN dans les variables du service.',
  )
}
const quizDbUrl = quizDbUrlDonnee || `file:${path.resolve(path.dirname(dbPath), 'quizzes.db').replace(/\\/g, '/')}`
const quizDbToken = process.env.QUIZ_DB_TOKEN
// Le plafond d'invités par soirée, que même le réglage d'un espace ne dépasse
// pas : au-delà, l'instance gratuite de l'hébergeur ne suit plus.
const maxPlayers = Number(process.env.MAX_PLAYERS) || undefined
// Le nom de l'environnement, quand ce n'est pas la production : « preprod ».
// Il devient un bandeau sur toutes les pages — on ne projette pas la mauvaise
// instance un soir de fête, et on n'écrit pas ses quiz dans la mauvaise base.
const appEnv = process.env.APP_ENV?.trim() || undefined
// Le jeton de la routine qui remplit la réserve du quiz du jour. Il ne sait
// qu'ajouter des questions, mais un jeton court se devine : en dessous de
// trente-deux caractères, la porte reste fermée — le bouton « Generate » de
// l'hébergeur en tire un bien plus long.
const RESERVE_TOKEN_MIN = 32
const jetonDonne = process.env.RESERVE_TOKEN?.trim() || undefined
const jetonDeLaReserve = jetonDonne && jetonDonne.length >= RESERVE_TOKEN_MIN ? jetonDonne : undefined
if (jetonDonne && !jetonDeLaReserve) {
  console.warn(
    `[jour] RESERVE_TOKEN fait moins de ${RESERVE_TOKEN_MIN} caractères : le dépôt automatique reste fermé. ` +
      'Tire-en un plus long (le bouton « Generate » de Render).',
  )
}

/**
 * La base, telle qu'on peut l'écrire dans un journal : son hôte, jamais ce
 * qui suit — un jeton peut voyager dans l'adresse (`?authToken=`).
 */
function baseLisible(url: string): string {
  try {
    const u = new URL(url)
    return u.protocol === 'file:' ? `${u.protocol}${u.pathname}` : `${u.protocol}//${u.host}`
  } catch {
    return 'adresse illisible'
  }
}

/** Pourquoi le démarrage a échoué, dit pour qui lit le tableau de bord de l'hébergeur. */
function echecDuDemarrage(e: unknown): string {
  if (e instanceof DemarrageRefuse) return e.message
  const raison = pourquoiInjoignable(e)
  if (raison) {
    return (
      `Base permanente injoignable (${baseLisible(quizDbUrl)}) : ${raison}. ` +
      'Vérifie QUIZ_DB_URL et QUIZ_DB_TOKEN dans les variables du service.'
    )
  }
  // Ni la configuration ni la base : un bogue. La pile, cette fois, sert.
  return `Démarrage impossible : ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`
}

/**
 * Le filet, posé une fois le serveur prêt : une promesse que personne
 * n'attend ou une exception échappée à son gestionnaire ne doivent pas
 * éteindre le serveur.
 *
 * Node, par défaut, arrête le processus — et avec lui toutes les soirées de
 * tous les espaces, pour un incident qui n'en touchait peut-être qu'une, au
 * milieu d'une question. L'état qui compte vit dans la base locale et dans le
 * miroir, pas dans la pile de l'appel qui a échoué : continuer est moins
 * risqué que tomber. Les gestionnaires socket, eux, sont blindés un par un ;
 * ce filet ne rattrape que ce qui leur aurait échappé, et le consigne avec de
 * quoi retrouver l'appel fautif.
 *
 * Avant d'être prêt, pas de filet : un démarrage raté doit s'arrêter net,
 * avec un code d'erreur, pour que l'hébergeur le voie et le redise.
 */
function poserLeFilet() {
  process.on('unhandledRejection', raison => {
    console.error('[filet] promesse rejetée sans personne pour l’attendre — le serveur continue :', raison)
  })
  process.on('uncaughtException', (e, origine) => {
    console.error(`[filet] exception échappée (${origine}) — le serveur continue :`, e)
  })
}

createQuizServer({ port, dbPath, admin, quizDbUrl, quizDbToken, publicUrl, online, maxPlayers, appEnv, jetonDeLaReserve }).then(
  server => {
    poserLeFilet()
    console.log(`🎉 FiestApp — serveur prêt sur http://localhost:${server.port}${appEnv ? `  [${appEnv}]` : ''}`)
    // Aucun secret dans les journaux : en ligne, ils sont conservés et
    // lisibles par tout le monde sur le tableau de bord de l'hébergeur.
    // Le QR, lui, montre l'adresse que les téléphones peuvent ouvrir : la
    // publique en ligne, celle du PC sur le réseau chez soi.
    console.log(`   Invités      : http://localhost:${server.port}/${admin.slug}  (le QR de l'écran commun donne l'adresse réseau)`)
    console.log(`   Écran commun : http://localhost:${server.port}/host  (compte « ${admin.login} »)`)
    console.log(`   Mes quiz     : http://localhost:${server.port}/edit`)
    console.log(`   Les comptes  : http://localhost:${server.port}/admin`)

    // L'hébergeur prévient avant de redémarrer : on laisse partir les dernières
    // écritures distantes (points, partie en cours) avant de s'éteindre. Ce
    // signal n'arrive que si le serveur est lancé par `node` lui-même : via
    // `npm start`, il se perdait en route (voir render.yaml).
    let extinction = false
    const shutdown = () => {
      if (extinction) return
      extinction = true
      console.log('[serveur] extinction demandée, sauvegarde en cours…')
      server.close().then(
        () => process.exit(0),
        (e: unknown) => {
          console.error('[serveur] extinction incomplète :', e)
          process.exit(1)
        },
      )
      // Une écriture distante en vol aboutit ou échoue d'elle-même dans le
      // délai des requêtes ; on ne l'attend pas au-delà. L'hébergeur, lui,
      // coupe net trente secondes après avoir prévenu.
      setTimeout(() => process.exit(0), DELAI_DISTANT_MS + 2000).unref()
    }
    process.once('SIGTERM', shutdown)
    process.once('SIGINT', shutdown)
  },
  (e: unknown) => refuser(echecDuDemarrage(e)),
)
