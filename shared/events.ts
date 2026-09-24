// Protocole Socket.io typé, partagé entre client et serveur.
import type { EcranDeScene, OngletDePodium, PartySnapshot } from './types'
import type { PublicProfile } from './profil'
import type { ClotureDeSoiree, FinDeSoiree, GainAnnonce, ProgresDeQuiz, SoireeClose } from './fin'

/**
 * Pourquoi un `player:join` est refusé, quand le téléphone doit faire autre
 * chose qu'afficher le message.
 *
 * `unknown-token` : le jeton ne désigne plus personne ici — l'invité a été
 * exclu, l'animateur a lancé « Nouvelle soirée », ou le miroir n'avait pas
 * encore sa fiche au redémarrage. Le serveur recréait jusqu'ici un invité en
 * silence avec le prénom retenu par le téléphone : l'exclu revenait, et
 * l'habitué atterrissait « sans équipe » sans jamais revoir l'écran d'équipe.
 * Le téléphone oublie maintenant cette identité et repasse par l'entrée,
 * pré-remplie.
 */
export type JoinRefusal = 'unknown-token' | 'soiree-close'

export type JoinAck =
  /**
   * L'identité retenue revient avec l'accusé : quand c'est le profil qui l'a
   * fournie, le téléphone ne la connaît pas encore. C'est aussi elle qui fait
   * foi quand il se re-présente : le prénom de sa fiche peut avoir été
   * corrigé par l'animateur entre-temps.
   */
  | { ok: true; playerId: string; token: string; name: string; avatar: string; profile?: PublicProfile }
  /**
   * `soiree-close` : ce jeton désignait un invité d'une soirée qu'on vient de
   * clore. Le téléphone dormait pendant la clôture ; il reçoit ici la fin de
   * sa soirée (`fin`), comme s'il avait été là, au lieu d'un simple « on ne
   * te retrouve plus ».
   *
   * `derniere`, avec `unknown-token` : le serveur a redémarré depuis la
   * clôture et a oublié les fins de soirée, mais l'espace n'a encore rien
   * joué depuis — le téléphone propose de revoir la soirée close.
   */
  | { ok: false; error: string; reason?: JoinRefusal; fin?: FinDeSoiree; derniere?: SoireeClose }

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
   *
   * Avec un `token`, c'est un téléphone qui se re-présente tout seul : s'il
   * retrouve son invité (ou celui de son profil), le prénom et l'avatar
   * envoyés sont ignorés — la fiche du serveur fait foi. Un jeton qui ne
   * désigne plus personne est refusé (`unknown-token`) au lieu de recréer
   * quelqu'un en silence.
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
    /**
     * `branchee` : cet écran a été ouvert par un code d'appairage — la télé
     * dit alors par qui, puisque tout animateur du serveur peut valider le
     * code qu'elle affiche.
     */
    ack: (res: { ok: boolean; slug?: string; name?: string; branchee?: true }) => void,
  ) => void
  /** Démarre une partie de quiz (l'animateur choisit ensuite le quiz à jouer). */
  'host:launch': () => void
  'host:command': (payload: { sessionId: string; command: unknown }) => void
  'host:endSession': (payload: { sessionId: string }) => void
  /**
   * Clôt la soirée : elle se range une dernière fois dans l'historique, sous
   * le titre donné, ce qui ne se décide qu'à la fin est crédité (podium de la
   * soirée, prix, hauts faits, paliers, avatars légendaires), chaque téléphone
   * reçoit sa fin de soirée — et la suivante part de zéro. C'est le seul
   * geste de fin : il remplace « Sauvegarder » et « Nouvelle soirée ».
   */
  'host:closeParty': (payload: { title?: string }) => void
  /**
   * C'était un essai : tout s'efface sans rien garder — l'archive que la
   * soirée s'était faite après chaque quiz, et tout ce qu'elle avait crédité
   * aux profils.
   */
  'host:discardParty': () => void
  /** Ancien « Nouvelle soirée », pour un écran resté sur une page d'avant : clôt la soirée. */
  'host:resetParty': () => void
  /**
   * Ancien « Sauvegarder », pour un écran resté sur une page d'avant : range
   * la soirée sous ce titre sans la clore. Elle s'y range désormais toute
   * seule après chaque quiz.
   */
  'host:archiveParty': (payload: { title?: string }) => void
  /**
   * Donne à un invité un surnom pour la soirée — ou corrige un pseudo. Le
   * profil de l'invité garde son prénom : la soirée suivante le lui rend, et
   * sa carte dit les deux.
   */
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

  /**
   * Ouvre un écran de fin de soirée — ou revient à la salle d'attente avec
   * `null` — sur TOUS les écrans d'animateur de l'espace : c'était un état de
   * la page, et la télé restait en salle d'attente pendant la remise des prix
   * ouverte au téléphone. `depuis` dit l'écran que l'animateur avait sous les
   * yeux (invariant 12) : si la scène a changé entre-temps, depuis l'autre
   * console, le geste est ignoré. Absent (une page d'avant), il passe. La
   * clôture ne s'ouvre pas ainsi : seule `host:closeParty` y mène.
   */
  'host:scene': (payload: { ecran: EcranDeScene | null; onglet?: OngletDePodium; depuis?: EcranDeScene | null }) => void
  /**
   * Cet écran d'animateur se tient en télécommande (ou ne l'est plus) : tant
   * qu'il y en a une, les autres écrans de l'espace laissent les coulisses à
   * sa main.
   */
  'host:telecommande': (payload: { active: boolean }) => void
}

export interface ServerToClientEvents {
  'party:snapshot': (snapshot: PartySnapshot) => void
  /** Vue filtrée de la partie : chaque joueur reçoit SA vue, l'écran commun la sienne. */
  'session:view': (payload: { sessionId: string; view: unknown }) => void
  'session:ended': (payload: { sessionId: string }) => void
  /**
   * L'animateur a exclu ce joueur : son téléphone repart à l'inscription.
   *
   * Avec `reason`, ce n'est pas une exclusion en direct mais la réponse à un
   * téléphone qui s'est re-présenté avec un jeton que la soirée ne connaît
   * plus. Une page à jour l'ignore : l'accusé de son `player:join` lui a déjà
   * tout dit. Il n'est envoyé que pour les pages restées sur une ancienne
   * version, qui ne lisent pas ce motif et resteraient sinon devant un
   * en-tête vide.
   */
  'player:removed': (info?: { reason: JoinRefusal }) => void
  /**
   * L'animateur a lancé « Nouvelle soirée » : l'invité de ce téléphone
   * n'existe plus. Pas `player:removed` — « L'animateur t'a retiré » serait
   * faux. Le téléphone oublie son identité et repasse par l'entrée,
   * pré-remplie, pour rejoindre la soirée suivante.
   */
  'party:reset': () => void
  /**
   * Le profil de ce joueur vient de changer — son expérience du soir a été
   * créditée. Sans ce message, le téléphone garderait le profil reçu à la
   * poignée de main et n'afficherait le niveau gagné qu'au prochain
   * rafraîchissement, c'est-à-dire jamais pendant la fête.
   */
  'player:profil': (profile: PublicProfile) => void
  /**
   * Ce que le téléphone vient de gagner au podium d'un quiz — de quoi fêter
   * un niveau et une finition, au lieu d'un simple toast.
   */
  'player:gain': (gain: GainAnnonce) => void
  /**
   * La soirée est close : le téléphone montre sa fin de soirée — rang,
   * points, hauts faits, et ce que son profil y a gagné. Il n'incarne plus
   * personne ; la soirée suivante le fera repasser par l'entrée.
   */
  'soiree:fin': (fin: FinDeSoiree) => void
  /** La soirée est close : ce que l'écran commun annonce à la salle. */
  'soiree:cloture': (cloture: ClotureDeSoiree) => void
  /** Au podium d'un quiz : les montées de niveau, pour l'écran commun. */
  'soiree:progres': (progres: ProgresDeQuiz) => void
  'toast': (payload: { kind: 'info' | 'error'; message: string }) => void
}
