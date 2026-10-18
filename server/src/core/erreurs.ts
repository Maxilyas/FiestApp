import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SERVEUR } from '../racine'
import { tronquer } from '../../../shared/avatars'
import type { ErreurEnDetail } from '../../../shared/santeDuServeur'

// Ce que la page « Le serveur » du QG garde d'une erreur serveur (le souhait
// du propriétaire du 17 octobre 2026 : « mieux voir les erreurs, d'où elles
// proviennent, et des détails en cliquant dessus ») : sa sorte, son code, son
// message nettoyé, et sa pile d'appels ramenée aux fichiers du dépôt. Le
// journal du service garde tout, mais rien n'y dit où chercher, et Render
// le montre par morceaux.
//
// Ce qui s'y garde se montre à l'administrateur et dort huit jours dans la
// base permanente : jamais un jeton, ni les paramètres d'une adresse, ni le
// message du lecteur JSON — il cite le corps de la requête, un mot de passe
// y passe (`sansMessage`, `erreurDeRequete`). Une erreur faite pour être lue
// (`erreurMontrable`) n'arrive jamais ici : elle n'est pas une erreur serveur.

/** Ce qu'un message garde au plus : la phrase de l'erreur, pas les données qu'elle citerait. */
const MESSAGE_MAX = 300
/** Les cadres de la pile gardés, du plus proche au plus lointain : au-delà, Express et les promesses. */
const CADRES_MAX = 8
/** Les causes suivies : « fetch failed ← other side closed ». */
const CAUSES_MAX = 3

const JETON = /\beyJ[\w-]{6,}\.[\w-]{6,}\.[\w-]{6,}/g
const PORTEUR = /\b(Bearer|Basic)\s+[\w.~+/=-]+/gi
const PARAMETRES_D_ADRESSE = /\b((?:https?|libsql|wss?):\/\/[^\s?#'"]+)[?#][^\s'"]*/gi
/** Ce qu'un `JSON.parse` cite du texte qu'il n'a pas su lire : « "{"password":"s"... is not valid JSON ». */
const CITATION_JSON = /".*"(?:\.\.\.)? is not valid JSON/gs

/** Un message qu'on peut garder et montrer : sans jeton, ni paramètre d'adresse, ni texte cité, sur une ligne, court. */
export function messageNettoye(message: string): string {
  return tronquer(
    message
      .replace(CITATION_JSON, '"…" is not valid JSON')
      .replace(JETON, '[jeton]')
      .replace(PORTEUR, '$1 [jeton]')
      .replace(PARAMETRES_D_ADRESSE, '$1?…')
      .replace(/\s+/g, ' ')
      .trim(),
    MESSAGE_MAX,
  )
}

/** Le dépôt : le parent de `server/`, d'où se comptent les chemins qu'on montre. */
const DEPOT = path.dirname(SERVEUR)
/**
 * Le serveur empaqueté (`scripts/empaqueter.ts`), s'il tourne : en production,
 * toute la pile y pointe. Ce module y est, et son `import.meta.url` vaut
 * celui du paquet (`racine.ts`) — sous `tsx`, celui de ce fichier, qui n'est
 * pas un paquet.
 */
const ICI = fileURLToPath(import.meta.url)
const PAQUET = ICI.endsWith('.mjs') ? ICI : null

/** Où commence chaque module dans le paquet : sa ligne, et son fichier dans le dépôt. */
let modules: { debuts: number[]; fichiers: string[] } | null | undefined

/**
 * Le fichier du dépôt d'une ligne du paquet. Esbuild, qui ne minifie pas,
 * ouvre chaque module par son chemin en commentaire (`// src/core/jour.ts`) :
 * le module d'une ligne est le dernier ouvert avant elle. Lu une fois, à la
 * première erreur du processus — jamais au démarrage, que le réveil attend.
 * Sans paquet lisible, le cadre garde sa ligne du paquet.
 */
function moduleDuPaquet(paquet: string, ligne: number): string | null {
  if (modules === undefined) {
    modules = null
    try {
      const debuts: number[] = []
      const fichiers: string[] = []
      readFileSync(paquet, 'utf8')
        .split('\n')
        .forEach((texte, i) => {
          const m = /^\/\/ ((?:src|\.\.\/shared)\/[\w./-]+\.tsx?)$/.exec(texte)
          if (!m) return
          debuts.push(i + 1)
          fichiers.push(m[1].startsWith('../') ? m[1].slice(3) : `server/${m[1]}`)
        })
      modules = { debuts, fichiers }
    } catch {
      // Pas de paquet ici : le serveur tourne depuis ses sources, ses piles le disent déjà.
    }
  }
  if (!modules) return null
  let bas = -1
  let haut = modules.debuts.length - 1
  while (bas < haut) {
    const milieu = Math.ceil((bas + haut) / 2)
    if (modules.debuts[milieu] <= ligne) bas = milieu
    else haut = milieu - 1
  }
  return bas < 0 ? null : modules.fichiers[bas]
}

/** Le fichier d'une ligne du paquet : celui du serveur qui tourne, ou celui qu'un test donne. */
export type LecteurDuPaquet = (fichier: string, ligne: number) => string | null

const lecteurDuPaquet: LecteurDuPaquet = (fichier, ligne) => (PAQUET !== null && fichier === PAQUET ? moduleDuPaquet(PAQUET, ligne) : null)

const CADRE = /^\s*at (?:(.+?) \()?(.+?)(?::(\d+):\d+)?\)?$/

/**
 * Un cadre de la pile, lisible : la fonction, puis d'où elle vient — un
 * fichier du dépôt et sa ligne (`server/src/core/jour.ts:1206`), le fichier
 * d'une ligne du paquet (`server/src/core/jour.ts`), un paquet de
 * `node_modules` (`@libsql/client`) — et ce paquet, à part. Null pour les
 * entrailles de Node, et pour ce qui n'est pas un fichier — « <anonymous> »,
 * « index 0 » d'un `Promise.all` — : ils ne disent pas où chercher.
 */
function cadreLisible(fonction: string | undefined, lieu: string, ligne: number | null, paquet: LecteurDuPaquet): { texte: string; dependance: string | null } | null {
  if (lieu.startsWith('node:') || lieu.includes('node:internal')) return null
  const nom = fonction?.trim() || '(anonyme)'
  let fichier = lieu
  if (lieu.startsWith('file://')) {
    try {
      fichier = fileURLToPath(lieu)
    } catch {
      fichier = lieu.slice('file://'.length)
    }
  }
  if (!path.isAbsolute(fichier)) return null
  const dependances = fichier.lastIndexOf(`${path.sep}node_modules${path.sep}`)
  if (dependances >= 0) {
    const [premier, second] = fichier.slice(dependances + 'node_modules'.length + 2).split(path.sep)
    const dependance = premier.startsWith('@') ? `${premier}/${second}` : premier
    return { texte: `${nom} · ${dependance}`, dependance }
  }
  if (ligne !== null) {
    const module = paquet(fichier, ligne)
    if (module) return { texte: `${nom} · ${module}`, dependance: null }
  }
  const relatif = path.relative(DEPOT, fichier)
  const montre = relatif.startsWith('..') ? path.basename(fichier) : relatif.split(path.sep).join('/')
  return { texte: `${nom} · ${montre}${ligne !== null ? `:${ligne}` : ''}`, dependance: null }
}

/**
 * La pile d'une erreur, en cadres lisibles (`cadreLisible`), huit au plus.
 * Les cadres qui se suivent dans un même paquet n'en font qu'un, celui par
 * où le code y est entré : une erreur de la base en passait trois dans
 * `@libsql/client` — `mapSqliteError`, `executeStmt`, puis l'`execute` que
 * le dépôt avait appelé —, et l'appel du dépôt tombait hors des huit.
 */
export function cadresDeLaPile(pile: string, paquet: LecteurDuPaquet = lecteurDuPaquet): string[] {
  const cadres: { texte: string; dependance: string | null }[] = []
  for (const ligne of pile.split('\n')) {
    if (!/^\s*at /.test(ligne)) continue
    const m = CADRE.exec(ligne)
    if (!m) continue
    let [, fonction, lieu] = m
    // « at async file:///…:12:5 » : une fonction fléchée attendue, sans nom — la route de chaque `wrap(async (req, res) => …)`.
    if (fonction === undefined && lieu.startsWith('async ')) [fonction, lieu] = ['async (anonyme)', lieu.slice('async '.length)]
    const cadre = cadreLisible(fonction, lieu, m[3] ? Number(m[3]) : null, paquet)
    if (!cadre) continue
    const avant = cadres.at(-1)
    if (cadre.dependance && avant?.dependance === cadre.dependance) cadres[cadres.length - 1] = cadre
    else if (cadres.length < CADRES_MAX) cadres.push(cadre)
    else break
  }
  return cadres.map(c => c.texte)
}

/** Ce que l'heure garde d'une erreur, hors sa source et son compte. */
export type DetailDUneErreur = Omit<ErreurEnDetail, 'source' | 'n' | 'premiere' | 'derniere'>

/**
 * Le détail d'une erreur : sa sorte, son code — le sien, le plus précis
 * qu'elle donne (`extendedCode` de libsql : `SQLITE_CONSTRAINT_TRIGGER`
 * plutôt que `SQLITE_CONSTRAINT`), sinon celui d'une de ses causes —, son
 * message et ceux de ses causes qui en disent plus, nettoyés, et sa pile.
 * `sansMessage` : celle du lecteur d'une requête, qui cite son corps — seule
 * sa sorte (`entity.verify.failed`…) se garde. Une promesse rejetée par autre
 * chose qu'une erreur — un texte, un objet — se dit par ce qu'elle est.
 */
export function detailDeLErreur(e: unknown, { sansMessage = false, paquet }: { sansMessage?: boolean; paquet?: LecteurDuPaquet } = {}): DetailDUneErreur {
  if (!(e instanceof Error)) {
    let texte = ''
    try {
      texte = e === null || e === undefined ? '' : typeof e === 'string' ? e : (JSON.stringify(e) ?? String(e))
    } catch {
      texte = String(e)
    }
    return { nom: e === null ? 'null' : typeof e, code: null, message: sansMessage ? '' : messageNettoye(texte), ou: null, pile: [] }
  }
  const messages: string[] = []
  let code: string | null = null
  let cause: unknown = e
  for (let i = 0; i < CAUSES_MAX && cause instanceof Error; i++) {
    const ici: Error = cause
    // « SQLITE_CONSTRAINT: quota » a pour cause « quota » : elle ne dit rien de plus.
    if (ici.message && !messages.some(m => m.includes(ici.message))) messages.push(ici.message)
    const { code: sien, extendedCode: precis } = ici as { code?: unknown; extendedCode?: unknown }
    const lisible = [precis, sien].find(c => typeof c === 'string' || typeof c === 'number')
    if (code === null && lisible !== undefined) code = String(lisible)
    cause = (ici as { cause?: unknown }).cause
  }
  const type = (e as { type?: unknown }).type
  const pile = cadresDeLaPile(e.stack ?? '', paquet)
  return {
    nom: e.name || 'Error',
    code,
    message: sansMessage ? (typeof type === 'string' ? type : '') : messageNettoye(messages.join(' ← ')),
    ou: pile.find(c => / · (?:server|shared)\//.test(c)) ?? null,
    pile,
  }
}
