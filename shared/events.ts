// Protocole Socket.io typé, partagé entre client et serveur.
import type { PartySnapshot } from './types'
import type { PublicProfile } from './profil'

export type JoinAck =
  /**
   * L'identité retenue revient avec l'accusé : quand c'est le profil qui l'a
   * fournie, le téléphone ne la connaît pas encore, et il doit pouvoir la
   * retenir pour se re-présenter à l'identique après une coupure.
   */
  | { ok: true; playerId: string; token: string; name: string; avatar: string; profile?: PublicProfile }
  | { ok: false; error: string }

/**
 * Pourquoi une réponse d'invité n'a pas été retenue. Tant que `player:action`
 * n'accusait pas réception, une réponse refusée disparaissait sans un mot :
 * le téléphone avait vibré sous le doigt, l'écran ne montrait rien, et le
 * joueur restait persuadé d'avoir répondu. Chaque refus porte maintenant son
 * motif — celui qu'on affiche, et celui qu'on retrouve dans les journaux.
 */
export type ActionRefusal =
  /** La connexion ne suit aucune soirée (et n'a pas dit laquelle). */
  | 'no-party'
  /** Jeton absent, périmé, ou d'une autre soirée : identité introuvable. */
  | 'unknown-player'
  /** La partie visée n'est plus celle en cours. */
  | 'ended'
  /** Il n'a pas été intégré à cette partie. */
  | 'not-participant'
  /** La question est passée — révélation déjà faite. */
  | 'too-late'
  /** Chronomètre figé par l'animateur. */
  | 'paused'
  /** Action malformée : ni un choix valable, ni un nombre. */
  | 'invalid'
  /** Imprévu côté serveur. */
  | 'error'
  /** Le serveur n'a pas répondu à temps — motif posé par le téléphone. */
  | 'timeout'

export type ActionAck =
  | { ok: true }
  | { ok: false; reason: ActionRefusal; error: string }

export interface ClientToServerEvents {
  /**
   * L'heure du serveur, pour que les écrans cadrent leurs chronomètres dessus.
   * Les échéances des questions sont des instants absolus du serveur, et une
   * horloge de téléphone qui dérive faisait afficher du temps qui n'existait
   * plus — son porteur répondait après la clôture, et sa réponse était perdue.
   * Aucune identité n'est demandée : l'heure n'appartient à personne.
   */
  'time:sync': (payload: Record<string, never>, ack: (res: { serverNow: number }) => void) => void
  /**
   * Suivre une soirée sans y jouer : la page d'accueil des invités affiche
   * « X déjà connectés » avant même l'inscription. Le nom dans l'adresse
   * désigne l'espace ; une connexion n'en suit jamais qu'un.
   */
  'party:watch': (
    payload: { slug: string },
    ack: (res: { ok: boolean; error?: string; profile?: PublicProfile }) => void,
  ) => void
  /**
   * Rejoindre une soirée. Le prénom et l'avatar sont **facultatifs** : absents,
   * le serveur prend ceux du profil reconnu au cookie — quelqu'un qui les a
   * choisis en créant son profil n'a pas à les rechoisir sur le pas de la
   * porte. Un invité anonyme, lui, doit toujours les donner.
   */
  'player:join': (
    payload: { slug: string; name?: string; avatar?: string; token?: string; teamId?: string | null },
    ack: (res: JoinAck) => void,
  ) => void
  /**
   * Une réponse d'invité. Elle porte son espace et son jeton en plus de son
   * contenu : un téléphone qui sort d'une coupure a un socket tout neuf, sans
   * espace ni identité, et socket.io vide sa file d'attente avant même que la
   * page ait pu se re-présenter. Sans ces deux champs, la réponse tapée
   * pendant la coupure arrivait sur une connexion anonyme et était jetée.
   */
  'player:action': (
    payload: { sessionId: string; action: unknown; slug?: string; token?: string },
    ack: (res: ActionAck) => void,
  ) => void
  /** Changer d'équipe depuis la salle d'attente — refusé pendant un quiz. */
  'player:setTeam': (
    payload: { teamId: string | null },
    ack: (res: { ok: boolean; error?: string }) => void,
  ) => void

  /**
   * L'écran commun se présente. Pas de clé : la session de l'animateur voyage
   * dans le cookie de la poignée de main. En retour, son espace.
   */
  'host:hello': (
    payload: Record<string, never>,
    ack: (res: { ok: boolean; slug?: string; name?: string }) => void,
  ) => void
  /** Démarre une partie de quiz (l'animateur choisit ensuite le quiz à jouer). */
  'host:launch': () => void
  'host:command': (payload: { sessionId: string; command: unknown }) => void
  'host:endSession': (payload: { sessionId: string }) => void
  /** Range la soirée dans l'historique, puis efface invités, équipes et points. */
  'host:resetParty': () => void
  /** Range la soirée dans l'historique sans rien effacer, sous le titre donné. */
  'host:archiveParty': (payload: { title?: string }) => void
  /** Corrige un pseudo affiché sur l'écran commun. */
  'host:renamePlayer': (payload: { playerId: string; name: string }) => void
  /** Exclut un invité et efface ses points. */
  'host:removePlayer': (payload: { playerId: string }) => void

  /** Crée une équipe. */
  'host:createTeam': (payload: { name: string; emoji: string }) => void
  /** Renomme une équipe ou change son emoji. */
  'host:updateTeam': (payload: { teamId: string; name?: string; emoji?: string }) => void
  /** Supprime une équipe — ses membres se retrouvent sans équipe. */
  'host:removeTeam': (payload: { teamId: string }) => void
  /** Crée d'un coup les six équipes par défaut (écran vierge seulement). */
  'host:seedTeams': () => void
  /** Déplace un invité vers une autre équipe (ou l'en sort avec null). */
  'host:assignPlayer': (payload: { playerId: string; teamId: string | null }) => void

  /** Remet un prix à une équipe : des points, et le motif annoncé à la salle. */
  'host:awardTeam': (payload: { teamId: string; points: number; reason: string }) => void
  /** Retire un prix mal attribué. */
  'host:removeBonus': (payload: { bonusId: string }) => void
}

export interface ServerToClientEvents {
  'party:snapshot': (snapshot: PartySnapshot) => void
  /** Vue filtrée de la partie : chaque joueur reçoit SA vue, l'écran commun la sienne. */
  'session:view': (payload: { sessionId: string; view: unknown }) => void
  'session:ended': (payload: { sessionId: string }) => void
  /** L'animateur a exclu ce joueur : son téléphone repart à l'inscription. */
  'player:removed': () => void
  'toast': (payload: { kind: 'info' | 'error'; message: string }) => void
}
