import fs from 'node:fs'
import path from 'node:path'
import { SERVEUR } from '../racine'
import { LIGNES_A_PART_DU_SPHINX, type LigneDuSphinx, type ProfileStore, type TrouveurDuSphinx } from '../auth/profiles'
import type { CampagneStore } from './campagne'
import type { JourStore } from './jour'
import { legendeDe } from './divins'
import { tronquer } from '../../../shared/avatars'
import { DIVINS, divin as leDivin } from '../../../shared/divins'
import { jourAvant, jourDe } from '../../../shared/jour'
import { activiteDesJours, hasardDe, type ActiviteDuJour } from '../../../shared/missions'
import { minuitDe } from '../../../shared/qg'
import { JOURS_DU_SPHINX_AU_QG, visitesParJour, type PageDuSphinxAuQg, type ReponseDuSphinxAuQg } from '../../../shared/qgSphinx'
import { nomsAffiches } from '../../../shared/homonymes'
import type { AnnonceDeLAdministrateur } from '../../../shared/profil'
import {
  ERREURS_D_INSCRIPTION_PAR_JOUR,
  ESSAIS_DU_SPHINX,
  FENETRE_DE_L_HABITUE,
  GESTES_DU_SPHINX,
  JOURS_DE_L_HABITUE,
  QUI_A_DES_MOTS_MONTRES,
  VISITE_CLOSE,
  type EnigmeDuSphinx,
  type EtatDeLaVisite,
  type GesteDuSphinx,
  type InscriptionDuSphinx,
  type QuiADesMots,
  type SphinxOuvert,
  type MotDeLaPhrase,
  type PhraseDuSphinx,
  type PhraseLueDuSphinx,
  type SphinxDesMissions,
  type VerdictDuSphinx,
  type VisiteDuSphinx,
} from '../../../shared/sphinx'

// Le Sphinx de l'accueil, côté serveur (le plan du 24 novembre 2026,
// `retours/2026-11-24/le-sphinx/plan.md`, ses recommandations acceptées) :
// parfois, sur l'accueil d'un habitué, il propose une énigme de 1858 ;
// résolue, elle lui souffle un mot de la phrase du Divin du moment — sa
// légende (`core/divins.ts`). Chacun voit ses mots, et combien tous en ont
// trouvé, jamais lesquels : pour lire la phrase entière, il faut se parler.
//
// Tout se décide ici : les réponses des énigmes ne quittent pas le serveur
// avant la fin de la visite, et une légende n'en sort que mot à mot
// (invariant 21) — la page ne reçoit que des formes et des comptes
// (`shared/sphinx.ts`). Les dérivations sont pures, d'abord ; la classe
// `Sphinx` lit et écrit par le magasin des profils (`profile_sphinx`).

// ── Les barèmes ─────────────────────────────────────────────────────────────

/**
 * Une chance sur trois, chaque jour où aucune énigme ne l'attend — une seule à la fois, qui attend sa fin (le choix du
 * propriétaire du 25 novembre 2026) —, tirée de la graine du profil et du jour.
 */
export const CHANCE_D_UNE_VISITE = 1 / 3
/**
 * Les mots de trois lettres ou moins sont offerts : chaque énigme rapporte un
 * mot qui compte (la décision de la maquette, `README.md`). Sauf un nombre.
 */
export const LETTRES_D_UN_PETIT_MOT = 3
/** Ses premières visites ne posent que des énigmes faciles : on y entre sans se décourager. */
export const VISITES_FACILES = 3
/**
 * Ensuite, une difficulté tirée à ces poids, parmi celles qui lui restent :
 * une difficile une fois sur cinq — le joueur ordinaire s'y trompait avec
 * assurance, au test à l'aveugle.
 */
export const POIDS_DES_DIFFICULTES = { facile: 2, moyenne: 2, difficile: 1 } as const
/** Une réponse tient en une ligne : au-delà, elle se coupe (`tronquer`). */
export const REPONSE_MAX = 80
/** Un mot inscrit sur sa phrase : le plus long d'une légende tient bien en dessous. */
export const MOT_INSCRIT_MAX = 40
/** L'annonce d'une phrase retrouvée nomme les trois premiers à y avoir trouvé un mot, puis dit combien d'autres. */
export const GRACE_A = 3

/**
 * Les énigmes que le propriétaire connaît déjà — les trois de la maquette,
 * cinq réponses dites dans la conversation du 24 novembre 2026 — : son profil
 * les compte pour vues, une fois au démarrage (`compterLesVuesDuProprietaire`).
 */
export const ENIGMES_DEJA_VUES_DU_PROPRIETAIRE = ['32', '211', '146', '370', '637', '349', '641', '659'] as const
/** Le drapeau, dans `meta`, qui dit qu'elles sont comptées. */
export const DRAPEAU_DES_VUES_DU_PROPRIETAIRE = 'sphinx_vues_du_proprietaire'

/**
 * L'ordre des Divins du moment (la décision 3 du plan, le 24 novembre 2026) :
 * d'abord ceux dont la règle se tente le plus facilement, pour qu'une phrase
 * dévoilée fasse vite descendre un premier Divin — c'est elle qui prouvera
 * aux habitués que le Sphinx dit vrai. Le premier se tente en une partie, à
 * volonté ; le deuxième, en deux jours ; puis ceux d'une seule partie, mais
 * difficile ; ceux de quelques jours d'affilée ; ceux d'une journée entière ;
 * et au bout ceux qui demandent des mois. Pourquoi chacun est à sa place, ce
 * commentaire ne le dit pas : ce serait dire sa règle, que seul
 * `core/divins.ts` porte (invariant 21). Un Divin de plus y prend sa place,
 * sans quoi le Sphinx ne le nommerait jamais (`sphinx-pur.test.ts`).
 */
export const ORDRE_DU_SPHINX: readonly string[] = [
  'dv:osiris',
  'dv:dechu',
  'dv:seraphin',
  'dv:ariane',
  'dv:nike',
  'dv:hecate',
  'dv:helios',
  'dv:athena',
  'dv:lotus',
  'dv:mnemosyne',
  'dv:chronos',
  'dv:demiurge',
  'dv:sisyphe',
  'dv:thot',
  'dv:pantheon',
  'dv:heracles',
  'dv:arbre',
  'dv:artemis',
]

/** Les Divins que le catalogue nomme (`shared/divins.ts`) : un Divin dont le bijou n'est pas peint ne se tire pas. */
const CATALOGUE: ReadonlySet<string> = new Set(DIVINS.map(d => d.key))

// ── Les énigmes ─────────────────────────────────────────────────────────────

export type Difficulte = keyof typeof POIDS_DES_DIFFICULTES

/** Une énigme de la réserve, réponses comprises : elle ne quitte jamais le serveur telle quelle. */
export interface Enigme {
  numero: string
  sorte: 'enigme' | 'charade'
  difficulte: Difficulte
  vers: string[]
  /** La solution de la clé du livre. */
  solution: string
  /** Une charade : la clé du livre qui la découpe (« Cher-cher »). */
  cle?: string
  /** Les réponses justes, sans accents ni article. */
  acceptees: string[]
  /** Les réponses qui brûlent : elles ne coûtent pas d'essai. */
  presque: string[]
  /** La page du livre, et celle du fac-similé sur Wikisource. */
  page: string
  facSimile: string
}

const FICHIER_DES_ENIGMES = path.join(SERVEUR, 'content/sphinx/enigmes.json')

let reserveLue: { recueil: string; enigmes: Enigme[] } | null = null

const texte = (x: unknown) => (typeof x === 'string' ? x : '')
const textes = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : [])

/**
 * La réserve, lue du disque la première fois. Elle vit sous
 * `server/content/sphinx/`, jamais dans `shared/` : le paquet du navigateur
 * emporterait les réponses (`divins.test.ts` y veille). Illisible, aucune
 * énigme — le Sphinx ne passe plus, et le journal le dit.
 */
function laReserve(): { recueil: string; enigmes: Enigme[] } {
  if (reserveLue) return reserveLue
  try {
    const brut = JSON.parse(fs.readFileSync(FICHIER_DES_ENIGMES, 'utf8')) as { recueil?: unknown; enigmes?: unknown[] }
    const enigmes = (brut.enigmes ?? []).flatMap((e): Enigme[] => {
      const x = e as Record<string, unknown>
      const difficulte = x.difficulte === 'facile' || x.difficulte === 'moyenne' || x.difficulte === 'difficile' ? x.difficulte : null
      if (!texte(x.numero) || !difficulte || !texte(x.solution)) return []
      return [
        {
          numero: texte(x.numero),
          sorte: x.sorte === 'charade' ? 'charade' : 'enigme',
          difficulte,
          vers: textes(x.vers),
          solution: texte(x.solution),
          ...(texte(x.cle) && { cle: texte(x.cle) }),
          acceptees: textes(x.acceptees),
          presque: textes(x.presque),
          page: texte(x.page),
          facSimile: texte(x.fac_simile),
        },
      ]
    })
    reserveLue = { recueil: texte(brut.recueil), enigmes }
  } catch (e) {
    console.error('[sphinx] la réserve des énigmes ne se lit pas :', e)
    reserveLue = { recueil: '', enigmes: [] }
  }
  return reserveLue
}

/** Les énigmes de la réserve livrée. */
export const enigmesDuSphinx = (): readonly Enigme[] => laReserve().enigmes

// ── La réponse ──────────────────────────────────────────────────────────────

/**
 * Une réponse telle que le Sphinx la lit : en minuscules, sans accents ni
 * ponctuation — l'apostrophe et le trait d'union deviennent des blancs —,
 * sans « c'est » ni article devant (« le, la, les, l', un, une, des, du, de
 * la, de l' »). « L'éclair », « c'est l'éclair » et « un éclair » disent la
 * même chose. Les chiffres restent : « 0 » répond « zéro ».
 */
export function normaliser(brut: string): string {
  let t = brut
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  t = t.replace(/^c (?:est|etait) /, '')
  t = t.replace(/^(?:de la|de l|les|le|la|l|une|un|des|du) /, '')
  return t
}

/** La même, sans ses blancs : « pente-côte », « pentecôte » et « pente côte » sont une seule réponse. */
const comparable = (s: string) => normaliser(s).replace(/ /g, '')

/**
 * Le verdict d'une réponse : juste — la solution du livre, ou une réponse
 * acceptée, lue de la même façon que celle du joueur —, brûlante (elle ne
 * coûte pas d'essai), ou fausse.
 */
export function jugerLaReponse(e: Enigme, reponse: string): 'juste' | 'brulant' | 'faux' {
  const r = comparable(reponse)
  if (!r) return 'faux'
  if (r === comparable(e.solution) || e.acceptees.some(a => comparable(a) === r)) return 'juste'
  if (e.presque.some(p => comparable(p) === r)) return 'brulant'
  return 'faux'
}

// ── L'habitué et la visite ──────────────────────────────────────────────────

/** Ses jours joués sur les derniers (`FENETRE_DE_L_HABITUE`), aujourd'hui compris, à l'heure de Paris, tous modes confondus. */
export function joursJoues(activites: ReadonlyMap<string, ActiviteDuJour>, aujourdhui: string): number {
  let n = 0
  for (let i = 0; i < FENETRE_DE_L_HABITUE; i++) if (activites.get(jourAvant(aujourdhui, i))?.joue) n++
  return n
}

export const estHabitue = (jours: number) => jours >= JOURS_DE_L_HABITUE

/** Le tirage de la visite d'un jour, dans [0, 1[ : la graine `profil|jour`, comme les missions — deux serveurs tirent le même. */
export const tirageDeLaVisite = (graine: string): number => hasardDe(graine)()

/**
 * L'énigme d'une visite : jamais une qu'il a vue ; ses premières visites, une
 * facile (sinon la plus douce qui reste) ; ensuite, une difficulté tirée à
 * ses poids parmi celles qui lui restent, puis une énigme de cette
 * difficulté. Plus rien à lui poser : null, et pas de visite.
 */
export function choisirLEnigme(enigmes: readonly Enigme[], vues: ReadonlySet<string>, visitesAvant: number, hasard: () => number): Enigme | null {
  const restantes = enigmes.filter(e => !vues.has(e.numero))
  if (restantes.length === 0) return null
  const par = (d: Difficulte) => restantes.filter(e => e.difficulte === d)
  const difficultes = Object.keys(POIDS_DES_DIFFICULTES) as Difficulte[]
  let parmi: Enigme[]
  if (visitesAvant < VISITES_FACILES) {
    parmi = difficultes.map(par).find(es => es.length > 0)!
  } else {
    const classes = difficultes.filter(d => par(d).length > 0)
    let x = hasard() * classes.reduce((n, d) => n + POIDS_DES_DIFFICULTES[d], 0)
    const choisie = classes.find(d => (x -= POIDS_DES_DIFFICULTES[d]) < 0) ?? classes[classes.length - 1]
    parmi = par(choisie)
  }
  return parmi[Math.floor(hasard() * parmi.length)]
}

// ── La phrase d'un Divin ────────────────────────────────────────────────────

/** Un mot : il commence et finit par une lettre ou un chiffre — l'apostrophe et le trait d'union restent dedans. */
const MOT = /[\p{L}\p{N}](?:[\p{L}\p{N}’'-]*[\p{L}\p{N}])?/gu
const LETTRE = /[\p{L}\p{N}]/gu

/** Les nombres écrits en lettres — et leurs ordinaux —, sans accents. */
const NOMBRES = new Set(
  (
    'zero un une deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize vingt vingts ' +
    'trente quarante cinquante soixante septante octante huitante nonante cent cents mille milles million millions ' +
    'milliard milliards premier premiere second seconde deuxieme troisieme quatrieme cinquieme sixieme septieme ' +
    'huitieme neuvieme dixieme onzieme douzieme vingtieme centieme millieme moitie double triple quart tiers ' +
    'dizaine douzaine vingtaine centaine millier milliers'
  ).split(' '),
)

/**
 * Un nombre, en chiffres ou en lettres — un de ses morceaux suffit
 * (« vingt-cinq », « l'un ») : quatorze des petits mots des légendes en sont,
 * et offerts, ils donneraient le seuil d'une règle pour rien. Toujours caché.
 */
export function estUnNombre(mot: string): boolean {
  if (/\p{N}/u.test(mot)) return true
  return mot
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[-’' ]+/)
    .some(morceau => NOMBRES.has(morceau))
}

/** Un mot d'une légende : son texte, caché ou offert, et sa forme — un trait par lettre, l'apostrophe et le trait d'union montrés. */
export interface MotDeLegende {
  texte: string
  cache: boolean
  forme: string
}

/** Les mots d'une légende, dans l'ordre : un mot de trois lettres ou moins est offert, sauf un nombre, toujours caché. */
export function motsDeLaLegende(legende: string): MotDeLegende[] {
  return (legende.match(MOT) ?? []).map(texte => ({
    texte,
    cache: estUnNombre(texte) || (texte.match(LETTRE)?.length ?? 0) > LETTRES_D_UN_PETIT_MOT,
    forme: texte.replace(LETTRE, '_'),
  }))
}

/** Les places des mots cachés d'une légende. */
const cachesDe = (legende: string) => motsDeLaLegende(legende).flatMap((m, i) => (m.cache ? [i] : []))

/**
 * La phrase d'un Divin, telle qu'un profil la voit : la forme de chaque mot,
 * le texte des petits mots offerts et de ceux qu'il a gagnés ; combien tous en
 * ont trouvé, jamais lesquels. Entière — chaque mot, et la légende même — à
 * son porteur, qui la connaît, à qui en a trouvé chaque mot caché, et, une
 * fois reconstituée par tous, à qui a choisi de la lire (`lue`). Retrouvée et
 * pas encore lue, elle ne s'impose pas (la décision du 24 novembre 2026 :
 * chacun avance à son rythme) : elle dit seulement qu'elle se dévoile à sa
 * demande (`aDevoiler`), et rien de plus ne part vers lui. Un mot qu'il a
 * inscrit lui-même, juste (`appris`, `Sphinx.inscrire`), il le connaît : il se
 * montre à lui, à part des siens, et compte pour la lire entière — trouvés ou
 * appris, tous ses mots cachés, il l'a gagnée en coopérant.
 */
export function phraseVue(
  divin: { key: string; nom: string },
  legende: string,
  {
    siens,
    appris = new Set(),
    deTous,
    porteur = false,
    lue = false,
  }: { siens: ReadonlySet<number>; appris?: ReadonlySet<number>; deTous: ReadonlySet<number>; porteur?: boolean; lue?: boolean },
): PhraseDuSphinx {
  const mots = motsDeLaLegende(legende)
  const caches = mots.flatMap((m, i) => (m.cache ? [i] : []))
  const parTous = caches.filter(i => siens.has(i) || deTous.has(i)).length
  const reconstituee = caches.length > 0 && parTous === caches.length
  const entiere = porteur || caches.every(i => siens.has(i) || appris.has(i)) || (reconstituee && lue)
  return {
    divin,
    mots: mots.map((m, i): MotDeLaPhrase => {
      if (!m.cache) return { forme: m.forme, texte: m.texte, offert: true }
      if (siens.has(i)) return { forme: m.forme, texte: m.texte, sien: true }
      if (appris.has(i)) return { forme: m.forme, texte: m.texte, appris: true }
      return entiere ? { forme: m.forme, texte: m.texte } : { forme: m.forme }
    }),
    aTrouver: caches.length,
    siens: caches.filter(i => siens.has(i)).length,
    appris: caches.filter(i => appris.has(i) && !siens.has(i)).length,
    parTous,
    reconstituee,
    ...(reconstituee && !entiere && { aDevoiler: true as const }),
    ...(entiere && { legende }),
    ...(porteur && { porteur: true as const }),
  }
}

/** Un mot tel qu'on le compare : sans casse, sans accents, ses seules lettres et ses chiffres. */
const lettresDuMot = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

/** Une élision en tête d'un mot (« l’heure », « jusqu’au ») : on peut la taper, ou non. */
const ELISION = /^(?:[cdjlmnst]|qu|jusqu|lorsqu|puisqu|quoiqu)['’]/i

/**
 * Un mot tapé sur un trait de sa phrase est-il ce mot-là ? Comme on le tape :
 * sans casse ni accents, l'apostrophe et le trait d'union comme on veut — et
 * une élision qu'on peut taper ou non (« heure » pour « l’heure »), la forme
 * de la phrase la montrant déjà. Rien de vide, et jamais une partie du mot.
 */
export function motsEgaux(tape: string, texte: string): boolean {
  const lu = lettresDuMot(tape)
  if (!lu) return false
  return lu === lettresDuMot(texte) || lu === lettresDuMot(texte.replace(ELISION, ''))
}

/**
 * À qui demander : ceux qui ont trouvé des mots d'une phrase, et combien —
 * jamais lesquels (invariant 21). Ses amis d'abord, puis les plus riches en
 * mots, puis les premiers venus ; jamais lui-même, ni un masqué du
 * classement (`masque`), et les suspendus ne sont jamais lus
 * (`motsDuSphinx`). Les `QUI_A_DES_MOTS_MONTRES` premiers, nommés comme on
 * les lit (`nomsAffiches`, invariant 17), et combien d'autres.
 */
export function quiADesMotsPour(
  trouveurs: readonly TrouveurDuSphinx[],
  moi: string,
  amis: ReadonlySet<string>,
  masque: (id: string) => boolean,
): { liste: QuiADesMots[]; autres: number } {
  const qui = trouveurs
    .filter(t => t.id !== moi && !masque(t.id) && t.mots > 0)
    .sort((a, b) => Number(amis.has(b.id)) - Number(amis.has(a.id)) || b.mots - a.mots || a.le - b.le || a.id.localeCompare(b.id))
  const montres = qui.slice(0, QUI_A_DES_MOTS_MONTRES)
  const marques = nomsAffiches(montres.map(t => ({ id: t.id, name: t.name, avatar: t.avatar, legendaire: t.legendaire })))
  return {
    liste: montres.map(t => ({ id: t.id, nom: marques.get(t.id) ?? t.name, mots: t.mots, ...(amis.has(t.id) && { ami: true as const }) })),
    autres: qui.length - montres.length,
  }
}

/**
 * Combien de mots neufs — que personne n'avait — le Sphinx souffle chaque jour,
 * à tout le serveur (le choix du propriétaire du 25 novembre 2026 : « un mot
 * neuf par jour ») : à quinze habitués, la première phrase tombait en trois
 * jours ; ainsi, une phrase de neuf mots en prend neuf, quel que soit le
 * nombre de joueurs. Les autres énigmes résolues du jour soufflent un mot que
 * d'autres ont déjà trouvé : personne ne repart les mains vides, et les mots
 * neufs, rares, s'échangent (les mots inscrits).
 */
export const MOTS_NEUFS_PAR_JOUR = 1

/**
 * Le mot qu'une énigme résolue lui souffle : parmi les mots cachés qu'il n'a
 * pas, d'abord un que personne n'a encore — si le mot neuf du jour n'est pas
 * déjà parti (`neufPermis`) —, sinon un autre, au hasard de sa graine. Le mot
 * neuf du jour parti, un que d'autres ont trouvé ; et s'il les a déjà tous, un
 * neuf quand même : le plus assidu ne repart pas les mains vides. Tiré au
 * verdict, pas avant : deux joueurs qui résolvent ensemble le dernier mot
 * inconnu de tous reçoivent l'un ce mot, l'autre un mot déjà trouvé. Il les a
 * tous : null.
 */
export function choisirLeMot(
  caches: readonly number[],
  siens: ReadonlySet<number>,
  deTous: ReadonlySet<number>,
  hasard: () => number,
  { neufPermis = true }: { neufPermis?: boolean } = {},
): number | null {
  const possibles = caches.filter(i => !siens.has(i))
  if (possibles.length === 0) return null
  const neufs = possibles.filter(i => !deTous.has(i))
  const dejaTrouves = possibles.filter(i => deTous.has(i))
  const parmi = neufPermis ? (neufs.length > 0 ? neufs : possibles) : dejaTrouves.length > 0 ? dejaTrouves : neufs
  return parmi[Math.floor(hasard() * parmi.length)]
}

/** Où le Sphinx lit la légende d'un Divin : `legendeDe` en ligne, une phrase inventée au banc (`phraseInventee`). */
export type LireLaLegende = (cle: string) => string | null

/** La phrase d'un Divin, reconstituée par tous : chacun de ses mots cachés trouvé au moins une fois. */
function reconstituee(cle: string, mots: ReadonlyMap<string, ReadonlySet<number>>, legendeDuDivin: LireLaLegende): boolean {
  const legende = legendeDuDivin(cle)
  if (!legende) return false
  const caches = cachesDe(legende)
  return caches.length > 0 && caches.every(i => mots.get(cle)?.has(i))
}

/**
 * Le Divin du moment, le même pour tout le serveur : le premier de l'ordre
 * (`ORDRE_DU_SPHINX`), au catalogue, dont tous les profils ensemble n'ont pas
 * encore trouvé chaque mot caché — une dérivation de leurs visites, rien
 * d'écrit à côté. Tous reconstitués : null.
 */
export function divinDuMoment(
  mots: ReadonlyMap<string, ReadonlySet<number>>,
  catalogue: ReadonlySet<string> = CATALOGUE,
  legendeDuDivin: LireLaLegende = legendeDe,
): string | null {
  return ORDRE_DU_SPHINX.find(cle => catalogue.has(cle) && legendeDuDivin(cle) !== null && !reconstituee(cle, mots, legendeDuDivin)) ?? null
}

/** Les phrases que tous ont reconstituées, dans l'ordre du Sphinx : elles se montrent entières à chacun. */
export function phrasesReconstituees(
  mots: ReadonlyMap<string, ReadonlySet<number>>,
  catalogue: ReadonlySet<string> = CATALOGUE,
  legendeDuDivin: LireLaLegende = legendeDe,
): { divin: { key: string; nom: string }; legende: string }[] {
  return ORDRE_DU_SPHINX.filter(cle => catalogue.has(cle) && reconstituee(cle, mots, legendeDuDivin)).map(cle => ({
    divin: { key: cle, nom: leDivin(cle)?.nom ?? '' },
    legende: legendeDuDivin(cle)!,
  }))
}

// ── Le verdict ──────────────────────────────────────────────────────────────

/** Ce qu'une visite garde d'un geste à l'autre. */
export interface EtatDUneVisite {
  etat: EtatDeLaVisite | 'vue'
  essais: number
  reponses: readonly string[]
}

export type IssueDUnGeste =
  | { refus: string; statut: 400 | 409 }
  | { apres: { etat: EtatDeLaVisite; essais: number; reponses: string[] }; verdict?: VerdictDuSphinx['verdict']; dejaDite?: true }

/**
 * Ce qu'un geste fait d'une visite. Surgir ne la change pas. L'écouter la
 * rouvre — remise à plus tard, elle passe proposée, et reste épinglée tant
 * qu'il ne la finit pas (`Sphinx.decider`) ; une réponse juste la résout ; une qui
 * brûle ne coûte pas d'essai, ni une réponse fausse déjà dite (deux touchers
 * du même bouton) ; la troisième fausse la perd ; « Je donne ma langue au
 * chat » l'abandonne. Close, plus rien ne s'y joue.
 */
export function appliquerLeGeste(v: EtatDUneVisite, geste: GesteDuSphinx, reponse: string | undefined, e: Enigme): IssueDUnGeste {
  if (v.etat === 'vue' || (VISITE_CLOSE as readonly string[]).includes(v.etat)) {
    return { refus: 'Cette énigme est close : le Sphinx reviendra un autre jour.', statut: 409 }
  }
  const reponses = [...v.reponses]
  // Son arrivée sur l'accueil : rien ne change à la visite, seul l'instant s'écrit (`ecoutee_le`, `geste`).
  if (geste === 'surgir') return { apres: { etat: v.etat as EtatDeLaVisite, essais: v.essais, reponses } }
  if (geste === 'ecouter') return { apres: { etat: 'proposee', essais: v.essais, reponses } }
  if (geste === 'plus-tard') return { apres: { etat: 'plus-tard', essais: v.essais, reponses } }
  if (geste === 'chat') return { apres: { etat: 'abandonnee', essais: v.essais, reponses }, verdict: 'abandon' }
  const lue = normaliser(reponse ?? '')
  if (!lue) return { refus: 'Écris ta réponse avant de l’envoyer.', statut: 400 }
  const verdict = jugerLaReponse(e, lue)
  if (verdict === 'juste') return { apres: { etat: 'resolue', essais: v.essais + 1, reponses }, verdict }
  if (verdict === 'brulant') return { apres: { etat: 'proposee', essais: v.essais, reponses }, verdict }
  if (reponses.includes(lue)) return { apres: { etat: 'proposee', essais: v.essais, reponses }, verdict: 'faux', dejaDite: true }
  const essais = v.essais + 1
  return essais >= ESSAIS_DU_SPHINX
    ? { apres: { etat: 'perdue', essais, reponses: [...reponses, lue] }, verdict: 'perdu' }
    : { apres: { etat: 'proposee', essais, reponses: [...reponses, lue] }, verdict: 'faux' }
}

// ── Le Sphinx, sur le serveur ───────────────────────────────────────────────

export interface DepsDuSphinx {
  profiles: Pick<
    ProfileStore,
    | 'lecturesDuSphinx'
    | 'visitesDuSphinx'
    | 'poserUneVisiteDuSphinx'
    | 'ecrireUnGesteDuSphinx'
    | 'motsDuSphinx'
    | 'divinsOf'
    | 'compterDesEnigmesPourVues'
    | 'lecturesDuSphinxAuQg'
    | 'compterUneEnigmePourVue'
    | 'retenirUnePhraseDuSphinx'
    | 'inscrireUnMotDuSphinx'
    | 'byId'
  >
  jour: Pick<JourStore, 'activiteDepuis'>
  campagne: Pick<CampagneStore, 'activiteDepuis' | 'amisDe'>
  /** Un profil masqué du classement (`JourStore.estMasque`) : il ne paraît pas parmi ceux à qui demander. */
  masque?: (profileId: string) => boolean
  /** L'horloge du quiz du jour, que les tests font passer minuit. */
  maintenant: () => number
  /** Le tirage de la visite, dans [0, 1[ : les tests le fixent (`tirageDuSphinx`). */
  tirage?: (graine: string) => number
  /** La réserve : les tests en posent une à eux (`enigmesDuSphinx`). */
  enigmes?: readonly Enigme[]
  /**
   * Une phrase inventée, que le Sphinx lit à la place de la légende de chaque
   * Divin (`phraseInventeeDuSphinx`) : pour les épreuves et les photos des
   * écrans, qui ne doivent jamais montrer une vraie légende — le propriétaire
   * joue aussi, et une forme de phrase, ses petits mots offerts, en disent
   * déjà trop. Jamais posée en ligne : `index.ts` ne la passe pas
   * (`sphinx-ecran.test.ts`). Toutes les légendes à la fois, pas celle du seul
   * Divin du moment : une phrase reconstituée fait passer au suivant, dont la
   * vraie forme se serait montrée.
   */
  phraseInventee?: string
}

/** Ce qu'une lecture décide : ce que la ligne des missions en dit, et la visite à poser si elle vient d'être tirée. */
export interface DecisionDuSphinx {
  champ?: SphinxDesMissions
  aPoser?: { jour: string; enigme: string; divin: string; quand: number }
}

/**
 * Un refus qui se dit avec son statut : pas de visite (404), une visite close ou déjà changée (409), un geste illisible
 * (400), plus d'erreur permise aujourd'hui pour inscrire un mot (429).
 */
export interface RefusDuSphinx {
  refus: 400 | 404 | 409 | 429
  error: string
}

/** Le premier instant d'un jour de Paris : midi en temps universel tombe toujours dans le même jour de Paris. */
function minuitDuJour(jour: string): number {
  const [a, m, j] = jour.split('-').map(Number)
  return minuitDe(Date.UTC(a, m - 1, j, 12))
}

/**
 * Une visite, et pas une ligne à part — une énigme comptée pour vue, une
 * phrase lue ou annoncée (`LIGNES_A_PART_DU_SPHINX`) : ni ses premières
 * visites faciles, ni la visite du jour, ni les comptes du QG ne les lisent.
 */
type Visite = LigneDuSphinx & { etat: EtatDeLaVisite }
const estUneVisite = (l: LigneDuSphinx): l is Visite => !(LIGNES_A_PART_DU_SPHINX as readonly string[]).includes(l.etat)
const estClose = (v: Visite) => (VISITE_CLOSE as readonly string[]).includes(v.etat)

/** Ses visites, de la plus ancienne à la dernière — par leur jour, que la base range déjà, sans les lignes à part. */
const sesVisites = (lignes: readonly LigneDuSphinx[]): Visite[] => lignes.filter(estUneVisite).sort((a, b) => (a.jour < b.jour ? -1 : a.jour > b.jour ? 1 : 0))

/**
 * La visite qu'il a devant lui : sa dernière tant qu'elle n'est pas close, de
 * quelque jour qu'elle date, ou finie aujourd'hui. Une énigme attend sa fin
 * (le choix du propriétaire du 25 novembre 2026 : « garder l'énigme pas
 * uniquement la journée mais jusqu'à la résolution ») : elle mourait à minuit,
 * comptée pour vue sans avoir été jouée, et le Sphinx en reposait une autre
 * trois jours plus tard à qui n'en voulait pas. Finie aujourd'hui, c'est encore
 * la sienne du jour : aucune autre ne vient avant demain. Une visite d'avant,
 * restée ouverte sous la règle de minuit et qu'une autre a suivie, ne revient
 * pas : seule la dernière peut attendre — il n'en vient une neuve qu'une fois
 * la dernière close.
 */
export function visiteEnCours(lignes: readonly LigneDuSphinx[], aujourdhui: string): Visite | undefined {
  const derniere = sesVisites(lignes).at(-1)
  if (!derniere || !estClose(derniere)) return derniere
  return derniere.jour === aujourdhui || (derniere.closeLe !== null && jourDe(derniere.closeLe) === aujourdhui) ? derniere : undefined
}

/**
 * La visite qui suit celle-ci surgit-elle ? Seulement s'il a joué celle d'avant
 * — une réponse au moins, juste ou fausse — ; sa toute première, toujours. Qui
 * donne sa langue au chat sans rien essayer, ou laisse l'énigme sans y toucher,
 * n'en veut pas : la suivante s'épingle sans l'interpeller, et c'est à lui de
 * l'ouvrir (le choix du propriétaire du 25 novembre 2026 : « il s'en fout de
 * ça »). Une réponse qui brûle ne s'écrit pas : elle ne compte pas.
 */
export const laSuivanteSurgit = (precedente: Pick<LigneDuSphinx, 'essais'> | undefined): boolean => !precedente || precedente.essais > 0

/** Les Divins dont il a choisi de lire la phrase retrouvée : pour de bon, sur tous ses appareils. */
const sesPhrasesLues = (lignes: readonly LigneDuSphinx[]) => new Set(lignes.flatMap(l => (l.etat === 'lue' ? [l.divin] : [])))

/** Ses mots d'un Divin : les places gagnées par ses visites. */
const sesMots = (lignes: readonly LigneDuSphinx[], divin: string) =>
  new Set(lignes.flatMap(l => (l.divin === divin && l.mot !== null ? [l.mot] : [])))

/**
 * Ses mots appris d'un Divin : les places qu'il a inscrites, justes — une ligne
 * à part chacune (`appris`, son jour `appris:<Divin>:<place>`), sans `mot` :
 * un mot appris n'est pas trouvé, ni les mots de tous ni les crédits ne le
 * comptent.
 */
const sesAppris = (lignes: readonly LigneDuSphinx[], divin: string) =>
  new Set(lignes.flatMap(l => (l.etat === 'appris' && l.divin === divin ? [Number(l.jour.slice(l.jour.lastIndexOf(':') + 1))] : [])))

/** Ce qu'il connaît d'un Divin : ses mots trouvés et ceux qu'il a appris — le Sphinx ne lui souffle ni les uns ni les autres. */
const cequIlSait = (lignes: readonly LigneDuSphinx[], divin: string) => new Set([...sesMots(lignes, divin), ...sesAppris(lignes, divin)])

/** Le jour des erreurs d'inscription d'un jour de Paris : une ligne à part, ses erreurs dans `essais`. */
const jourDesErreurs = (aujourdhui: string) => `inscrits:${aujourdhui}`

export class Sphinx {
  /**
   * Les mots trouvés par tous, Divin par Divin : lus une fois par processus
   * (`ProfileStore.motsDuSphinx`), tenus à jour à chaque mot gagné, oubliés
   * quand un profil s'en va (`oublier`). Deux serveurs d'une mise en ligne
   * peuvent s'écarter d'un mot le temps qu'elle dure : le Divin du moment n'en
   * dépend que pour un mot.
   */
  private mots: Map<string, Set<number>> | null = null
  /**
   * Lus avec eux, tenus de même : le premier instant où chaque mot de chaque
   * Divin a été trouvé (`divin|mot`) — le jour d'une phrase reconstituée —, et
   * ceux qui y ont trouvé un mot, du premier au dernier — les crédits de
   * l'annonce de l'accueil.
   */
  private premiers = new Map<string, number>()
  private trouveurs = new Map<string, TrouveurDuSphinx[]>()
  private enLecture: Promise<void> | null = null
  /** Le tour de lecture : un oubli pendant une lecture ne laisse pas celle-ci poser des mots d'avant. */
  private tour = 0
  /** Une écriture à la fois par profil : deux touchers de « Répondre » ne coûtent pas deux essais à la même lecture. */
  private enCours = new Map<string, Promise<unknown>>()

  /**
   * Les habitués que le Sphinx a vus aujourd'hui, sur leur accueil — la ligne
   * des missions, qui juge leurs jours joués de toute façon, sa page ouverte
   * ou non — : l'audience du QG, sans rien relire ni rien écrire (la page
   * ajoute ceux qu'il a visités, lus dans leurs lignes). En mémoire, oubliée à
   * minuit et au redémarrage.
   */
  private habitues: { jour: string; ids: Set<string> } = { jour: '', ids: new Set() }

  constructor(private deps: DepsDuSphinx) {}

  /** Est-il un habitué aujourd'hui ? Retenu pour le QG s'il l'est. */
  noterLHabitue(profileId: string, aujourdhui: string, activites: ReadonlyMap<string, ActiviteDuJour>): boolean {
    const habitue = estHabitue(joursJoues(activites, aujourdhui))
    if (habitue) {
      if (this.habitues.jour !== aujourdhui) this.habitues = { jour: aujourdhui, ids: new Set() }
      this.habitues.ids.add(profileId)
    }
    return habitue
  }

  private unALaFois<T>(profileId: string, travail: () => Promise<T>): Promise<T> {
    const avant = this.enCours.get(profileId) ?? Promise.resolve()
    const suite = avant.then(travail)
    const fin = suite.catch(() => {})
    this.enCours.set(profileId, fin)
    void fin.then(() => {
      if (this.enCours.get(profileId) === fin) this.enCours.delete(profileId)
    })
    return suite
  }

  private get enigmes(): readonly Enigme[] {
    return this.deps.enigmes ?? enigmesDuSphinx()
  }

  /**
   * La légende d'un Divin telle que le Sphinx la lit : la sienne, ou la phrase
   * inventée du banc — pour les seuls Divins qui ont une légende, que la
   * liste de ceux qu'il peut nommer ne change pas.
   */
  private legende: LireLaLegende = cle => {
    const vraie = legendeDe(cle)
    return vraie !== null && this.deps.phraseInventee ? this.deps.phraseInventee : vraie
  }

  private enigme(numero: string): Enigme | undefined {
    return this.enigmes.find(e => e.numero === numero)
  }

  /** Les mots de tous, lus s'ils ne le sont pas : une lecture à la fois, partagée. */
  pret(): Promise<void> {
    if (this.mots) return Promise.resolve()
    if (!this.enLecture) {
      const tour = this.tour
      this.enLecture = this.deps.profiles.motsDuSphinx().then(
        ({ mots, premiers, trouveurs }) => {
          if (tour === this.tour) {
            this.mots = mots
            this.premiers = premiers
            this.trouveurs = trouveurs
          }
          this.enLecture = null
        },
        e => {
          this.enLecture = null
          throw e
        },
      )
    }
    return this.enLecture
  }

  private motsDeTous(): Map<string, Set<number>> {
    return this.mots ?? new Map()
  }

  /**
   * Combien de mots neufs le Sphinx a soufflés aujourd'hui, à tout le serveur :
   * le premier instant de chaque mot trouvé, en mémoire (`premiers`, relu au
   * démarrage, tenu à chaque mot gagné). Deux serveurs d'une mise en ligne
   * peuvent en souffler un de plus le temps qu'elle dure, comme deux joueurs
   * qui résolvent au même instant : un jour à deux mots neufs, rien de pire.
   */
  private motsNeufsDuJour(aujourdhui: string): number {
    let n = 0
    for (const le of this.premiers.values()) if (jourDe(le) === aujourdhui) n++
    return n
  }

  /** Un profil supprimé emporte ses visites (`ProfileStore.supprimer`) : les mots de tous se relisent. */
  oublier(): void {
    this.tour++
    this.mots = null
    this.premiers = new Map()
    this.trouveurs = new Map()
    this.enLecture = null
  }

  /**
   * Ce que la lecture des missions — ou celle de sa visite — décide, sur ses
   * visites et ses jours (les mots de tous déjà lus, `pret`). Une visite en
   * cours dit ce qu'elle est, de quelque jour qu'elle date (`visiteEnCours`) ;
   * sinon, il en faut une, tirée ce jour : un habitué, sa chance, un Divin du
   * moment qu'il ne porte pas et dont un mot lui manque, une énigme qu'il n'a
   * pas vue. Elle surgit s'il a joué celle d'avant, sinon elle s'épingle
   * (`laSuivanteSurgit`) — rien ne l'écrit : chaque lecture le relit.
   */
  decider(profileId: string, aujourdhui: string, activites: ReadonlyMap<string, ActiviteDuJour>, lignes: readonly LigneDuSphinx[]): DecisionDuSphinx {
    const habitue = this.noterLHabitue(profileId, aujourdhui, activites)
    const visites = sesVisites(lignes)
    const enCours = visiteEnCours(visites, aujourdhui)
    // Il ne surgit qu'une fois (le retour du propriétaire du 24 novembre 2026 : « il devrait interpeller qu'une seule
    // fois, puis c'est à l'utilisateur d'ouvrir l'énigme quand il le souhaite ») : arrivé sur l'accueil ou son énigme
    // écoutée — `ecoutee_le` posé —, une visite pas encore close s'épingle. Il surgissait à chaque accueil tant qu'on
    // ne l'avait pas remise à plus tard : l'appli fermée pendant sa présentation, ou l'énigme quittée, il revenait.
    if (enCours) {
      if (estClose(enCours)) return {}
      const surgit = enCours.etat === 'proposee' && enCours.ecouteeLe === null && laSuivanteSurgit(visites[visites.indexOf(enCours) - 1])
      return { champ: surgit ? 'attend' : 'epingle' }
    }
    if (!habitue) return {}
    if ((this.deps.tirage ?? tirageDeLaVisite)(`${profileId}|${aujourdhui}`) >= CHANCE_D_UNE_VISITE) return {}
    const moment = divinDuMoment(this.motsDeTous(), undefined, this.legende)
    // Il le porte : il en connaît la légende, le Sphinx n'a rien à lui souffler.
    if (!moment || this.deps.profiles.divinsOf(profileId).includes(moment)) return {}
    // Ce qu'il en sait, trouvé ou appris : plus rien à lui souffler, pas de visite.
    const siens = cequIlSait(lignes, moment)
    if (cachesDe(this.legende(moment)!).every(i => siens.has(i))) return {}
    const enigme = choisirLEnigme(this.enigmes, new Set(lignes.map(l => l.enigme)), visites.length, hasardDe(`${profileId}|${aujourdhui}|enigme`))
    if (!enigme) return {}
    return {
      champ: laSuivanteSurgit(visites.at(-1)) ? 'attend' : 'epingle',
      aPoser: { jour: aujourdhui, enigme: enigme.numero, divin: moment, quand: this.deps.maintenant() },
    }
  }

  /**
   * Le Divin dont une visite soufflera le mot : close, celui qu'elle a soufflé ;
   * ouverte, le Divin du moment, s'il lui en reste un mot à apprendre — une
   * énigme qui a attendu ne souffle pas un mot d'une phrase que tous ont
   * retrouvée entre-temps (le choix du propriétaire du 25 novembre 2026) ;
   * sinon celui de sa pose. La page le montre comme elle le soufflera.
   */
  private divinVise(ligne: Visite, lignes: readonly LigneDuSphinx[], porte: ReadonlySet<string>): string {
    if (estClose(ligne)) return ligne.divin
    const moment = divinDuMoment(this.motsDeTous(), undefined, this.legende)
    if (!moment || moment === ligne.divin || porte.has(moment)) return ligne.divin
    const siens = cequIlSait(lignes, moment)
    return cachesDe(this.legende(moment)!).some(i => !siens.has(i)) ? moment : ligne.divin
  }

  /** Pose la visite tirée, une fois ; rend ses visites telles que la base les garde. */
  poser(profileId: string, v: NonNullable<DecisionDuSphinx['aPoser']>): Promise<LigneDuSphinx[]> {
    return this.deps.profiles.poserUneVisiteDuSphinx(profileId, v)
  }

  /**
   * `GET /api/joueur/sphinx` : la visite du jour s'il y en a une — tirée et
   * figée à cette lecture si personne ne l'a encore fait —, la phrase du Divin
   * du moment telle qu'il la voit, et les phrases reconstituées. Pour tout
   * profil, habitué ou non : l'album la montre à chacun.
   */
  lire(profileId: string): Promise<SphinxOuvert> {
    return this.unALaFois(profileId, async () => {
      const { profiles, jour, campagne } = this.deps
      const aujourdhui = jourDe(this.deps.maintenant())
      const depuis = jourAvant(aujourdhui, FENETRE_DE_L_HABITUE - 1)
      const debut = minuitDuJour(depuis)
      // Ses amis, de front avec le reste — ils passent en tête de ceux à qui demander. Une lecture qui tombe ne coûte que
      // leur ordre : la liste reste.
      const [{ lignes, soirees }, { coffresDuMois: _, ...duJour }, deCampagne, amis] = await Promise.all([
        profiles.lecturesDuSphinx(profileId, debut),
        jour.activiteDepuis(profileId, depuis),
        campagne.activiteDepuis(profileId, debut),
        campagne.amisDe(profileId).catch((): string[] => []),
        this.pret(),
      ])
      const activites = activiteDesJours({ ...duJour, ...deCampagne, soirees })
      const decision = this.decider(profileId, aujourdhui, activites, lignes)
      const siennes = decision.aPoser ? await this.poser(profileId, decision.aPoser) : lignes
      const jours = joursJoues(activites, aujourdhui)
      return { habitue: estHabitue(jours), joursJoues: jours, ...this.vue(profileId, aujourdhui, siennes, new Set(amis)) }
    })
  }

  /**
   * La visite du jour et les phrases, telles qu'il les voit. `amis` donné — la
   * page du Sphinx, que l'album lit —, chaque phrase dit aussi à qui demander
   * ses mots (`quiADesMotsPour`) ; un verdict ne le redit pas.
   */
  private vue(
    profileId: string,
    aujourdhui: string,
    lignes: readonly LigneDuSphinx[],
    amis?: ReadonlySet<string>,
  ): Pick<SphinxOuvert, 'visite' | 'phrase' | 'reconstituees'> {
    const mots = this.motsDeTous()
    const porte = new Set(this.deps.profiles.divinsOf(profileId))
    const moment = divinDuMoment(mots, undefined, this.legende)
    const ligne = visiteEnCours(lignes, aujourdhui)
    const avecQui = (phrase: PhraseDuSphinx | null): PhraseDuSphinx | null => {
      if (!phrase || !amis) return phrase
      const { liste, autres } = quiADesMotsPour(this.trouveurs.get(phrase.divin.key) ?? [], profileId, amis, this.deps.masque ?? (() => false))
      return { ...phrase, quiADesMots: liste, ...(autres > 0 && { autresQuiEnOnt: autres }) }
    }
    return {
      visite: ligne ? this.visiteDe(ligne, lignes, porte) : null,
      phrase: moment ? avecQui(this.phraseDe(moment, lignes, porte)) : null,
      // Chacune telle qu'il la voit (`phraseVue`) : entière seulement s'il l'a choisie — la légende ne part plus à tous.
      reconstituees: phrasesReconstituees(mots, undefined, this.legende).flatMap(r => avecQui(this.phraseDe(r.divin.key, lignes, porte)) ?? []),
    }
  }

  private phraseDe(cle: string, lignes: readonly LigneDuSphinx[], porte: ReadonlySet<string>): PhraseDuSphinx | null {
    const legende = this.legende(cle)
    if (!legende) return null
    return phraseVue({ key: cle, nom: leDivin(cle)?.nom ?? '' }, legende, {
      siens: sesMots(lignes, cle),
      appris: sesAppris(lignes, cle),
      deTous: this.motsDeTous().get(cle) ?? new Set(),
      porteur: porte.has(cle),
      lue: sesPhrasesLues(lignes).has(cle),
    })
  }

  /** Une visite telle que la page la reçoit : la solution seulement une fois close, la phrase du Divin qu'elle vise. */
  private visiteDe(ligne: Visite, lignes: readonly LigneDuSphinx[], porte: ReadonlySet<string>): VisiteDuSphinx | null {
    const e = this.enigme(ligne.enigme)
    const phrase = this.phraseDe(this.divinVise(ligne, lignes, porte), lignes, porte)
    if (!e || !phrase) return null
    const close = estClose(ligne)
    const enigme: EnigmeDuSphinx = {
      numero: e.numero,
      sorte: e.sorte,
      vers: e.vers,
      source: { recueil: laReserve().recueil, page: e.page, facSimile: e.facSimile },
      ...(close && { solution: e.solution, ...(e.cle && { cle: e.cle }) }),
    }
    const texteDuMot = ligne.mot === null ? undefined : motsDeLaLegende(this.legende(ligne.divin)!)[ligne.mot]?.texte
    return {
      jour: ligne.jour,
      etat: ligne.etat,
      divin: phrase.divin,
      enigme,
      essaisRestants: Math.max(0, ESSAIS_DU_SPHINX - ligne.essais),
      ...(ligne.mot !== null && texteDuMot !== undefined && { mot: { index: ligne.mot, texte: texteDuMot } }),
      phrase,
    }
  }

  /**
   * `POST /api/joueur/sphinx` : un geste sur la visite en cours, de quelque
   * jour qu'elle date, et son verdict. Une écriture à la fois par profil ; la
   * visite n'est écrite que si elle est encore telle qu'il l'a lue. Le mot se
   * tire au verdict, du Divin qu'elle vise à cet instant (`divinVise`), et se
   * range sous lui.
   */
  geste(profileId: string, brut: unknown): Promise<VerdictDuSphinx | RefusDuSphinx> {
    const corps = (brut ?? {}) as { geste?: unknown; reponse?: unknown }
    if (!(GESTES_DU_SPHINX as readonly unknown[]).includes(corps.geste)) {
      return Promise.resolve({ refus: 400, error: 'Le Sphinx ne comprend pas ce geste : recharge la page.' })
    }
    const geste = corps.geste as GesteDuSphinx
    const reponse = typeof corps.reponse === 'string' ? tronquer(corps.reponse, REPONSE_MAX) : undefined
    return this.unALaFois(profileId, async (): Promise<VerdictDuSphinx | RefusDuSphinx> => {
      const maintenant = this.deps.maintenant()
      const aujourdhui = jourDe(maintenant)
      const [lignes] = await Promise.all([this.deps.profiles.visitesDuSphinx(profileId), this.pret()])
      const ligne = visiteEnCours(lignes, aujourdhui)
      const e = ligne ? this.enigme(ligne.enigme) : undefined
      if (!ligne || !e) return { refus: 404, error: 'Le Sphinx n’a pas d’énigme pour toi en ce moment : il passera un autre jour.' }
      const issue = appliquerLeGeste(ligne, geste, reponse, e)
      if ('refus' in issue) return { refus: issue.statut, error: issue.refus }
      let mot: number | null = null
      let motNeuf: boolean | undefined
      let neufDuJourParti = false
      // Le Divin du mot : celui du moment, pour une énigme qui a attendu — sa phrase a pu être retrouvée entre-temps.
      const divin = issue.apres.etat === 'resolue' ? this.divinVise(ligne, lignes, new Set(this.deps.profiles.divinsOf(profileId))) : ligne.divin
      if (issue.apres.etat === 'resolue') {
        const deTous = this.motsDeTous().get(divin) ?? new Set<number>()
        const legende = this.legende(divin)
        // Un mot neuf par jour, à tout le serveur (`MOTS_NEUFS_PAR_JOUR`) : parti, il reçoit un mot que d'autres ont trouvé.
        const neufPermis = this.motsNeufsDuJour(aujourdhui) < MOTS_NEUFS_PAR_JOUR
        // Jamais un mot qu'il a déjà appris d'un autre : le Sphinx lui en souffle un qu'il ne connaît pas.
        mot = legende ? choisirLeMot(cachesDe(legende), cequIlSait(lignes, divin), deTous, hasardDe(`${profileId}|${ligne.jour}|mot`), { neufPermis }) : null
        motNeuf = mot !== null && !deTous.has(mot)
        neufDuJourParti = !neufPermis && mot !== null && !motNeuf
      }
      const close = estClose({ ...ligne, etat: issue.apres.etat })
      const closeLe = close ? maintenant : null
      const ecrit = await this.deps.profiles.ecrireUnGesteDuSphinx(profileId, ligne.jour, ligne, {
        ...issue.apres,
        mot,
        // Rangé sous le Divin dont il vient : ses mots, ceux de tous et les crédits le lisent là.
        divin: mot !== null ? divin : null,
        ecouteeLe: geste === 'surgir' || geste === 'ecouter' || geste === 'repondre' ? maintenant : null,
        closeLe,
      })
      if (!ecrit) return { refus: 409, error: 'Le Sphinx a déjà entendu ce geste : recharge la page.' }
      if (mot !== null && this.mots) {
        if (!this.mots.has(divin)) this.mots.set(divin, new Set())
        this.mots.get(divin)!.add(mot)
        const cle = `${divin}|${mot}`
        if (!this.premiers.has(cle)) this.premiers.set(cle, maintenant)
        // Son premier mot de ce Divin : il rejoint ceux que l'annonce de la phrase retrouvée remerciera, et ceux à qui
        // demander. Un mot de plus : un de plus à son compte (un mot qu'il n'avait pas, `choisirLeMot`).
        const deCeDivin = this.trouveurs.get(divin) ?? []
        const lui = deCeDivin.find(t => t.id === profileId)
        if (lui) lui.mots++
        else {
          const p = await this.deps.profiles.byId(profileId).catch(() => null)
          if (p) this.trouveurs.set(divin, [...deCeDivin, { id: p.id, name: p.name, avatar: p.avatar, legendaire: p.legendaire ?? null, le: maintenant, mots: 1 }])
        }
      }
      const apres = lignes.map(l =>
        l === ligne ? { ...l, ...issue.apres, mot: mot ?? l.mot, divin: mot !== null ? divin : l.divin, closeLe: l.closeLe ?? closeLe } : l,
      )
      const { visite, phrase } = this.vue(profileId, aujourdhui, apres)
      return {
        accuse: true,
        geste,
        ...(issue.verdict && { verdict: issue.verdict }),
        ...(issue.dejaDite && { dejaDite: true as const }),
        ...(motNeuf !== undefined && { motNeuf }),
        ...(neufDuJourParti && { neufDuJourParti: true as const }),
        visite: visite!,
        phrase,
      }
    })
  }

  /**
   * Les énigmes que le propriétaire a déjà vues comptent pour vues sur le
   * profil de l'administrateur — celui que tient le compte d'administration —,
   * une fois, sous un drapeau. Sans ce profil, rien ne se pose, et le drapeau
   * attend le démarrage où il existera.
   */
  async compterLesVuesDuProprietaire(profileIds: readonly string[]): Promise<boolean> {
    if (profileIds.length === 0) return false
    const numeros = ENIGMES_DEJA_VUES_DU_PROPRIETAIRE.filter(n => this.enigmes.some(e => e.numero === n))
    const pose = await this.deps.profiles.compterDesEnigmesPourVues(profileIds, numeros, DRAPEAU_DES_VUES_DU_PROPRIETAIRE, this.deps.maintenant())
    if (pose) console.log(`[sphinx] ${numeros.length} énigme(s) comptée(s) pour vues sur le profil de l’administrateur`)
    return pose
  }

  // ── Une phrase retrouvée par tous : à lire, à annoncer ──────────────────

  /** Un Divin dont la phrase est retrouvée par tous, ou null : un Divin inconnu, ou une phrase qui attend encore des mots. */
  private retrouvee(brut: unknown): string | null {
    const cle = typeof brut === 'string' ? brut : ''
    if (!ORDRE_DU_SPHINX.includes(cle) || !CATALOGUE.has(cle)) return null
    return reconstituee(cle, this.motsDeTous(), this.legende) ? cle : null
  }

  /**
   * « La phrase est retrouvée : la lire » (`POST /api/joueur/sphinx/phrase`) :
   * il choisit de voir entière la phrase d'un Divin que tous ont retrouvée —
   * retenu par le serveur, pour tous ses appareils et pour de bon ; on ne
   * « dé-voit » pas. Rend la phrase entière. Une phrase qui attend encore des
   * mots se refuse : il la verrait avant les autres.
   */
  lirePhrase(profileId: string, brut: unknown): Promise<PhraseLueDuSphinx | RefusDuSphinx> {
    const divin = (brut ?? {}) as { divin?: unknown }
    return this.unALaFois(profileId, async (): Promise<PhraseLueDuSphinx | RefusDuSphinx> => {
      await this.pret()
      if (typeof divin.divin !== 'string' || !ORDRE_DU_SPHINX.includes(divin.divin)) return { refus: 400, error: 'Le Sphinx ne connaît pas ce Divin : recharge la page.' }
      const cle = this.retrouvee(divin.divin)
      if (!cle) return { refus: 409, error: 'Cette phrase n’est pas encore retrouvée par tous : le Sphinx en souffle encore les mots.' }
      const lignes = await this.deps.profiles.retenirUnePhraseDuSphinx(profileId, cle, 'lue', this.deps.maintenant())
      const phrase = this.phraseDe(cle, lignes, new Set(this.deps.profiles.divinsOf(profileId)))
      return phrase ? { accuse: true, phrase } : { refus: 409, error: 'Cette phrase ne se lit pas : recharge la page.' }
    })
  }

  /** L'accueil a annoncé la phrase retrouvée d'un Divin : elle ne s'y redira plus, sur aucun de ses appareils. */
  async annoncerLaPhrase(profileId: string, brut: unknown): Promise<{ accuse: true } | RefusDuSphinx> {
    await this.pret()
    const cle = this.retrouvee(((brut ?? {}) as { divin?: unknown }).divin)
    if (!cle) return { refus: 400, error: 'Cette phrase n’est pas retrouvée : recharge la page.' }
    await this.deps.profiles.retenirUnePhraseDuSphinx(profileId, cle, 'annoncee', this.deps.maintenant())
    return { accuse: true }
  }

  // ── Un mot qu'on lui a dit ─────────────────────────────────────────────────

  /**
   * Un mot inscrit sur un trait de sa phrase (`POST /api/joueur/sphinx/inscrire`,
   * `{ divin, place, mot }` ; le premier retour de la production, le
   * 24 novembre 2026 : « Je vois nulle part où rentrer le mot des autres »).
   * Juste **et déjà trouvé par quelqu'un**, il est appris, à lui pour de bon —
   * une ligne à part (`appris`). Juste mais que personne n'a trouvé, c'est la
   * réponse d'un faux : sans quoi les petits mots et les nombres se
   * devineraient seuls, la forme de la phrase disant leur longueur, et le
   * seuil d'une règle avec eux (invariant 21). Chaque faux coûte une des
   * `ERREURS_D_INSCRIPTION_PAR_JOUR` erreurs du jour ; plus aucune, il ne
   * s'inscrit plus rien — on demande, on ne devine pas. Le Divin du moment et
   * les phrases retrouvées seulement : celles qu'il voit. Pour tout profil,
   * habitué ou non : un ami peut lui dire ses mots.
   */
  inscrire(profileId: string, brut: unknown): Promise<InscriptionDuSphinx | RefusDuSphinx> {
    const corps = (brut ?? {}) as { divin?: unknown; place?: unknown; mot?: unknown }
    return this.unALaFois(profileId, async (): Promise<InscriptionDuSphinx | RefusDuSphinx> => {
      await this.pret()
      const cle = typeof corps.divin === 'string' ? corps.divin : ''
      if (!ORDRE_DU_SPHINX.includes(cle) || !CATALOGUE.has(cle)) return { refus: 400, error: 'Le Sphinx ne connaît pas ce Divin : recharge la page.' }
      const deTous = this.motsDeTous()
      if (cle !== divinDuMoment(deTous, undefined, this.legende) && !reconstituee(cle, deTous, this.legende)) {
        return { refus: 409, error: 'Le Sphinx ne parle pas encore de ce Divin : recharge la page.' }
      }
      const legende = this.legende(cle)
      const place = corps.place
      const leMot = legende && typeof place === 'number' && Number.isInteger(place) ? motsDeLaLegende(legende)[place] : undefined
      if (!leMot || !leMot.cache) return { refus: 400, error: 'Ce mot-là se lit déjà : choisis un trait vide.' }
      const tape = typeof corps.mot === 'string' ? tronquer(corps.mot.trim(), MOT_INSCRIT_MAX) : ''
      if (!lettresDuMot(tape)) return { refus: 400, error: 'Écris le mot avant de l’inscrire.' }
      const maintenant = this.deps.maintenant()
      const aujourdhui = jourDe(maintenant)
      const lignes = await this.deps.profiles.visitesDuSphinx(profileId)
      const porte = new Set(this.deps.profiles.divinsOf(profileId))
      // Trouvé, appris, ou toute la phrase à lui (son porteur, retrouvée et choisie) : rien à inscrire.
      if (this.phraseDe(cle, lignes, porte)?.mots[place as number]?.texte !== undefined) return { refus: 409, error: 'Ce mot-là, tu le connais déjà.' }
      const erreurs = (l: readonly LigneDuSphinx[]) => l.find(x => x.jour === jourDesErreurs(aujourdhui))?.essais ?? 0
      if (erreurs(lignes) >= ERREURS_D_INSCRIPTION_PAR_JOUR) {
        return { refus: 429, error: `Tu as fait tes ${ERREURS_D_INSCRIPTION_PAR_JOUR} erreurs du jour : demande le mot à qui l’a trouvé, et reviens demain.` }
      }
      const juste = motsEgaux(tape, leMot.texte) && (deTous.get(cle)?.has(place as number) ?? false)
      const apres = await this.deps.profiles.inscrireUnMotDuSphinx(profileId, {
        divin: cle,
        place: place as number,
        juste,
        jourDesErreurs: jourDesErreurs(aujourdhui),
        erreursMax: ERREURS_D_INSCRIPTION_PAR_JOUR,
        quand: maintenant,
      })
      const phrase = this.phraseDe(cle, apres, porte)
      if (!phrase) return { refus: 409, error: 'Cette phrase ne se lit pas : recharge la page.' }
      return { accuse: true, juste, erreursRestantes: Math.max(0, ERREURS_D_INSCRIPTION_PAR_JOUR - erreurs(apres)), phrase }
    })
  }

  /**
   * Ce que l'accueil annonce des phrases retrouvées par tous ce dernier mois
   * (`fenetre`) : une carte chacune, une fois — celles déjà annoncées à ce
   * profil écartées (`deja`, ses lignes `annoncee`, lues dans le lot de
   * l'accueil) —, son Divin et ceux qui y ont trouvé un mot, les trois
   * premiers nommés comme on les lit (`nomsAffiches`, invariant 17), puis
   * combien d'autres. Jamais un mot de la phrase. De mémoire seulement : les
   * mots de tous pas encore lus sur ce processus — la ligne des missions les
   * lit, partie avec l'accueil —, rien ; l'accueil suivant la dira.
   */
  annoncesDeLAccueil(deja: ReadonlySet<string>, maintenant: number, fenetre: number): Extract<AnnonceDeLAdministrateur, { sorte: 'phrase' }>[] {
    if (!this.mots) return []
    return phrasesReconstituees(this.mots, undefined, this.legende).flatMap(({ divin }) => {
      if (deja.has(divin.key)) return []
      const dates = cachesDe(this.legende(divin.key)!).map(i => this.premiers.get(`${divin.key}|${i}`) ?? 0)
      const le = Math.max(0, ...dates)
      if (maintenant - le >= fenetre) return []
      const qui = this.trouveurs.get(divin.key) ?? []
      const marques = nomsAffiches(qui.map(t => ({ id: t.id, name: t.name, avatar: t.avatar, legendaire: t.legendaire })))
      const grace = qui.slice(0, GRACE_A).map(t => marques.get(t.id) ?? t.name)
      return [{ id: `phrase:${divin.key}`, sorte: 'phrase' as const, divin, grace, autres: Math.max(0, qui.length - GRACE_A), le }]
    })
  }

  // ── Au QG ─────────────────────────────────────────────────────────────────

  /**
   * La page du Sphinx au QG (`GET /api/admin/sphinx`) : tout se dérive des
   * visites (un lot, `lecturesDuSphinxAuQg`) et de la mémoire des mots de tous.
   * Du Divin du moment, son nom et combien de ses mots cachés tous ont trouvés
   * — ni lesquels, ni la forme de sa phrase : le propriétaire la cherche aussi ;
   * d'une phrase reconstituée, son Divin et sa date, jamais son texte ; d'une
   * énigme, ses vers et ses comptes, jamais sa réponse.
   */
  async auQg(profileId: string | null): Promise<PageDuSphinxAuQg> {
    const maintenant = this.deps.maintenant()
    const aujourdhui = jourDe(maintenant)
    const [lu] = await Promise.all([
      this.deps.profiles.lecturesDuSphinxAuQg({ depuis: jourAvant(aujourdhui, JOURS_DU_SPHINX_AU_QG - 1), aujourdhui, profileId }),
      this.pret(),
    ])
    const mots = this.motsDeTous()
    const moment = divinDuMoment(mots, undefined, this.legende)
    const nomme = (cle: string) => ({ key: cle, nom: leDivin(cle)?.nom ?? '' })
    // Le premier instant de chaque mot trouvé : une phrase est reconstituée le jour où son dernier mot l'a été.
    const premier = new Map(lu.premiersMots.map(p => [`${p.divin}|${p.mot}`, p.le]))
    const reconstituees = ORDRE_DU_SPHINX.filter(cle => CATALOGUE.has(cle) && reconstituee(cle, mots, this.legende)).map(cle => {
      const dates = cachesDe(this.legende(cle)!).map(i => premier.get(`${cle}|${i}`))
      return { divin: nomme(cle), le: dates.every((d): d is number => d !== undefined) ? Math.max(...dates) : null }
    })
    const parEnigme = new Map<string, Map<string, number>>()
    for (const l of lu.parEnigme) {
      if (!parEnigme.has(l.enigme)) parEnigme.set(l.enigme, new Map())
      parEnigme.get(l.enigme)!.set(l.etat, l.n)
    }
    const siennes = new Map<string, 'vue' | 'en-cours'>()
    // Celle qui l'attend, de quelque jour qu'elle date : une énigme attend sa fin.
    const enCours = visiteEnCours(lu.siennes, aujourdhui)
    for (const l of lu.siennes) {
      // Une phrase lue ou annoncée n'est pas une énigme ; une énigme comptée pour vue, si.
      if (l.etat === 'lue' || l.etat === 'annoncee') continue
      if (!siennes.has(l.enigme)) siennes.set(l.enigme, 'vue')
    }
    if (enCours && !estClose(enCours)) siennes.set(enCours.enigme, 'en-cours')
    const habitues = new Set([...(this.habitues.jour === aujourdhui ? this.habitues.ids : []), ...lu.visitesDuJour])
    return {
      maintenant,
      aujourdhui,
      moment: moment
        ? (() => {
            const caches = cachesDe(this.legende(moment)!)
            return { divin: nomme(moment), parTous: caches.filter(i => mots.get(moment)?.has(i)).length, aTrouver: caches.length }
          })()
        : null,
      reconstituees,
      habitues: habitues.size,
      jours: visitesParJour(lu.parJour, aujourdhui),
      enigmes: this.enigmes.map(e => {
        const issues = parEnigme.get(e.numero) ?? new Map<string, number>()
        return {
          numero: e.numero,
          sorte: e.sorte,
          difficulte: e.difficulte,
          vers: e.vers,
          vues: [...issues.values()].reduce((n, v) => n + v, 0),
          resolues: issues.get('resolue') ?? 0,
          perdues: issues.get('perdue') ?? 0,
          chat: issues.get('abandonnee') ?? 0,
          aToi: siennes.get(e.numero) ?? null,
        }
      }),
      profil: profileId !== null,
    }
  }

  /**
   * « Voir la réponse », au QG : la réponse d'une énigme, rangée d'abord parmi
   * celles que le profil de l'administrateur a vues — le Sphinx ne la lui
   * proposera jamais (`choisirLEnigme`). Sans profil, rien où la ranger : elle
   * ne part pas. Celle que le Sphinx lui pose en ce moment, de quelque jour
   * qu'elle date, ne se lit pas ici — il y répondrait en la sachant. Une
   * écriture à la fois par profil, comme ses gestes.
   */
  reponseAuQg(numero: string, profileId: string | null): Promise<ReponseDuSphinxAuQg | RefusDuSphinx> {
    const e = this.enigme(numero)
    if (!e) return Promise.resolve({ refus: 404, error: 'Cette énigme n’est pas dans la réserve : recharge la page.' })
    if (!profileId) {
      return Promise.resolve({ refus: 409, error: 'Ton compte n’a pas de profil où ranger cette énigme : connecte-toi à ton profil, puis reviens.' })
    }
    const laPose = (lignes: readonly LigneDuSphinx[]) => {
      const enCours = visiteEnCours(lignes, jourDe(this.deps.maintenant()))
      return enCours !== undefined && !estClose(enCours) && enCours.enigme === numero
    }
    const refus: RefusDuSphinx = { refus: 409, error: 'Le Sphinx te la pose en ce moment : réponds-lui, ou donne ta langue au chat, avant de lire sa réponse ici.' }
    return this.unALaFois(profileId, async () => {
      const avant = await this.deps.profiles.visitesDuSphinx(profileId)
      if (laPose(avant)) return refus
      const { lignes } = await this.deps.profiles.compterUneEnigmePourVue(profileId, numero, this.deps.maintenant())
      // Posée entre-temps par sa ligne des missions, d'un autre onglet : elle reste à lui, sans sa réponse.
      if (laPose(lignes)) return refus
      return { numero, solution: e.solution, ...(e.cle && { cle: e.cle }), acceptees: e.acceptees, presque: e.presque, deja: avant.some(l => l.enigme === numero) }
    })
  }
}
