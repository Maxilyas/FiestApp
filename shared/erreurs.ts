// Ce qu'on dit quand un appel au serveur n'aboutit pas.
//
// Ces phrases sont lues debout, dans le noir, par un invité qui tient un
// verre : courtes, en français, et elles disent quoi faire. Jusqu'ici, le
// navigateur parlait à notre place — « Failed to fetch » sous Chrome, « Load
// failed » sous Safari — et tout refus d'identité devenait « Connexion
// requise », y compris un mot de passe mal tapé, alors que le serveur avait
// répondu « Identifiant ou mot de passe incorrect ».
//
// Pur et sans navigateur : le client s'en sert, `server/test/` le vérifie.

/** Les phrases toutes faites, pour quand le serveur n'a rien dit d'utilisable. */
export const MOTIFS = {
  /** La requête n'est même pas partie : wifi coupé, 4G perdue, mode avion. */
  reseau: 'Pas de réseau — vérifie ton wifi ou ta 4G, puis réessaie',
  /** Partie, mais rien n'est revenu dans le délai. */
  silence: 'Le serveur ne répond pas — vérifie ta connexion, puis réessaie',
  /** 502, 503, 504 : c'est l'hébergeur qui répond, pendant un déploiement ou un réveil. */
  redemarrage: 'Le serveur redémarre — patiente une minute, puis réessaie',
  /** L'application elle-même est en panne. */
  panne: 'Le serveur a un souci — réessaie dans un instant',
  /** Une réponse qui n'est pas la nôtre : portail d'un wifi public, proxy. */
  illisible: 'Réponse inattendue — recharge la page, puis réessaie',
  /** Tout le reste : une exception du navigateur ne se montre jamais telle quelle. */
  imprevu: 'Un souci imprévu — recharge la page, puis réessaie',
} as const

/** Le message qu'un corps de réponse porte, s'il en porte un lisible. */
function messageDu(corps: unknown): string | null {
  if (!corps || typeof corps !== 'object') return null
  const message = (corps as { error?: unknown }).error
  return typeof message === 'string' && message.trim() ? message.trim() : null
}

/**
 * Le motif d'une réponse HTTP en échec.
 *
 * Le serveur d'abord : c'est lui qui sait qu'un mot de passe est faux, qu'un
 * identifiant est pris, qu'il y a eu trop d'essais — un 401 compris. Sauf
 * quand ce n'est pas lui qui répond : pendant un déploiement ou un réveil,
 * l'hébergeur renvoie sa propre page, en anglais. Et sauf quand il est en
 * panne : son message est alors technique (« SQLITE_BUSY… ») et ne dirait
 * rien à un invité.
 */
export function motifHttp(statut: number, corps: unknown): string {
  if (statut === 502 || statut === 503 || statut === 504) return MOTIFS.redemarrage
  if (statut >= 500) return MOTIFS.panne
  const message = messageDu(corps)
  if (message) return message
  if (statut === 401) return 'Connexion requise — reconnecte-toi'
  if (statut === 429) return 'Trop d’essais — patiente un peu, puis réessaie'
  return `Refusé (erreur ${statut}) — recharge la page, puis réessaie`
}

/**
 * Le motif d'un appel resté sans réponse HTTP.
 *
 * `fetch` rejette avec une `TypeError` dont le texte change d'un navigateur à
 * l'autre, et un délai dépassé avec une `AbortError` — un `DOMException`, qui
 * n'hérite pas d'`Error` partout : on lit son nom, pas sa classe. Aucun de ces
 * textes ne se montre tel quel.
 */
export function motifEchec(erreur: unknown): string {
  const nom = erreur && typeof erreur === 'object' ? (erreur as { name?: unknown }).name : undefined
  if (nom === 'AbortError' || nom === 'TimeoutError') return MOTIFS.silence
  if (nom === 'SyntaxError') return MOTIFS.illisible
  return MOTIFS.reseau
}
