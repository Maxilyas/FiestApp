import fs from 'node:fs'
import path from 'node:path'
import { SERVEUR } from '../racine'
import type { LigneDuSphinx, ProfileStore } from '../auth/profiles'
import type { CampagneStore } from './campagne'
import type { JourStore } from './jour'
import { legendeDe } from './divins'
import { tronquer } from '../../../shared/avatars'
import { DIVINS, divin as leDivin } from '../../../shared/divins'
import { jourAvant, jourDe } from '../../../shared/jour'
import { activiteDesJours, hasardDe, type ActiviteDuJour } from '../../../shared/missions'
import { minuitDe } from '../../../shared/qg'
import {
  ESSAIS_DU_SPHINX,
  FENETRE_DE_L_HABITUE,
  GESTES_DU_SPHINX,
  JOURS_DE_L_HABITUE,
  VISITE_CLOSE,
  type EnigmeDuSphinx,
  type EtatDeLaVisite,
  type GesteDuSphinx,
  type SphinxOuvert,
  type MotDeLaPhrase,
  type PhraseDuSphinx,
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

/** Une visite par jour au plus, une chance sur trois, tirée de la graine du profil et du jour. */
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
 * le texte des petits mots offerts et de ceux qu'il a gagnés — de tous, une
 * fois la phrase reconstituée, ou pour son porteur, qui en connaît la
 * légende ; combien tous en ont trouvé, jamais lesquels.
 */
export function phraseVue(
  divin: { key: string; nom: string },
  legende: string,
  { siens, deTous, porteur = false }: { siens: ReadonlySet<number>; deTous: ReadonlySet<number>; porteur?: boolean },
): PhraseDuSphinx {
  const mots = motsDeLaLegende(legende)
  const caches = mots.flatMap((m, i) => (m.cache ? [i] : []))
  const parTous = caches.filter(i => siens.has(i) || deTous.has(i)).length
  const reconstituee = caches.length > 0 && parTous === caches.length
  return {
    divin,
    mots: mots.map((m, i): MotDeLaPhrase => {
      if (!m.cache) return { forme: m.forme, texte: m.texte, offert: true }
      if (siens.has(i)) return { forme: m.forme, texte: m.texte, sien: true }
      return reconstituee || porteur ? { forme: m.forme, texte: m.texte } : { forme: m.forme }
    }),
    aTrouver: caches.length,
    siens: caches.filter(i => siens.has(i)).length,
    parTous,
    reconstituee,
    ...(porteur && { porteur: true as const }),
  }
}

/**
 * Le mot qu'une énigme résolue lui souffle : parmi les mots cachés qu'il n'a
 * pas, d'abord un que personne n'a encore, sinon un autre, au hasard de sa
 * graine. Tiré au verdict, pas avant : deux joueurs qui résolvent ensemble le
 * dernier mot inconnu de tous reçoivent l'un ce mot, l'autre un mot déjà
 * trouvé — personne ne repart les mains vides. Il les a tous : null.
 */
export function choisirLeMot(caches: readonly number[], siens: ReadonlySet<number>, deTous: ReadonlySet<number>, hasard: () => number): number | null {
  const possibles = caches.filter(i => !siens.has(i))
  if (possibles.length === 0) return null
  const neufs = possibles.filter(i => !deTous.has(i))
  const parmi = neufs.length > 0 ? neufs : possibles
  return parmi[Math.floor(hasard() * parmi.length)]
}

/** La phrase d'un Divin, reconstituée par tous : chacun de ses mots cachés trouvé au moins une fois. */
function reconstituee(cle: string, mots: ReadonlyMap<string, ReadonlySet<number>>): boolean {
  const legende = legendeDe(cle)
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
export function divinDuMoment(mots: ReadonlyMap<string, ReadonlySet<number>>, catalogue: ReadonlySet<string> = CATALOGUE): string | null {
  return ORDRE_DU_SPHINX.find(cle => catalogue.has(cle) && legendeDe(cle) !== null && !reconstituee(cle, mots)) ?? null
}

/** Les phrases que tous ont reconstituées, dans l'ordre du Sphinx : elles se montrent entières à chacun. */
export function phrasesReconstituees(
  mots: ReadonlyMap<string, ReadonlySet<number>>,
  catalogue: ReadonlySet<string> = CATALOGUE,
): { divin: { key: string; nom: string }; legende: string }[] {
  return ORDRE_DU_SPHINX.filter(cle => catalogue.has(cle) && reconstituee(cle, mots)).map(cle => ({
    divin: { key: cle, nom: leDivin(cle)?.nom ?? '' },
    legende: legendeDe(cle)!,
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
 * Ce qu'un geste fait d'une visite. L'écouter la rouvre — remise à plus
 * tard, elle quitte son épingle ; une réponse juste la résout ; une qui
 * brûle ne coûte pas d'essai, ni une réponse fausse déjà dite (deux touchers
 * du même bouton) ; la troisième fausse la perd ; « Je donne ma langue au
 * chat » l'abandonne. Close, plus rien ne s'y joue.
 */
export function appliquerLeGeste(v: EtatDUneVisite, geste: GesteDuSphinx, reponse: string | undefined, e: Enigme): IssueDUnGeste {
  if (v.etat === 'vue' || (VISITE_CLOSE as readonly string[]).includes(v.etat)) {
    return { refus: 'Cette énigme est close : le Sphinx reviendra un autre jour.', statut: 409 }
  }
  const reponses = [...v.reponses]
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
    'lecturesDuSphinx' | 'visitesDuSphinx' | 'poserUneVisiteDuSphinx' | 'ecrireUnGesteDuSphinx' | 'motsDuSphinx' | 'divinsOf' | 'compterDesEnigmesPourVues'
  >
  jour: Pick<JourStore, 'activiteDepuis'>
  campagne: Pick<CampagneStore, 'activiteDepuis'>
  /** L'horloge du quiz du jour, que les tests font passer minuit. */
  maintenant: () => number
  /** Le tirage de la visite, dans [0, 1[ : les tests le fixent (`tirageDuSphinx`). */
  tirage?: (graine: string) => number
  /** La réserve : les tests en posent une à eux (`enigmesDuSphinx`). */
  enigmes?: readonly Enigme[]
}

/** Ce qu'une lecture décide : ce que la ligne des missions en dit, et la visite à poser si elle vient d'être tirée. */
export interface DecisionDuSphinx {
  champ?: SphinxDesMissions
  aPoser?: { jour: string; enigme: string; divin: string; quand: number }
}

/** Un refus qui se dit avec son statut : pas de visite (404), une visite close ou déjà changée (409), un geste illisible (400). */
export interface RefusDuSphinx {
  refus: 400 | 404 | 409
  error: string
}

/** Le premier instant d'un jour de Paris : midi en temps universel tombe toujours dans le même jour de Paris. */
function minuitDuJour(jour: string): number {
  const [a, m, j] = jour.split('-').map(Number)
  return minuitDe(Date.UTC(a, m - 1, j, 12))
}

/** Ses mots d'un Divin : les places gagnées par ses visites. */
const sesMots = (lignes: readonly LigneDuSphinx[], divin: string) =>
  new Set(lignes.flatMap(l => (l.divin === divin && l.mot !== null ? [l.mot] : [])))

export class Sphinx {
  /**
   * Les mots trouvés par tous, Divin par Divin : lus une fois par processus
   * (`ProfileStore.motsDuSphinx`), tenus à jour à chaque mot gagné, oubliés
   * quand un profil s'en va (`oublier`). Deux serveurs d'une mise en ligne
   * peuvent s'écarter d'un mot le temps qu'elle dure : le Divin du moment n'en
   * dépend que pour un mot.
   */
  private mots: Map<string, Set<number>> | null = null
  private enLecture: Promise<void> | null = null
  /** Le tour de lecture : un oubli pendant une lecture ne laisse pas celle-ci poser des mots d'avant. */
  private tour = 0
  /** Une écriture à la fois par profil : deux touchers de « Répondre » ne coûtent pas deux essais à la même lecture. */
  private enCours = new Map<string, Promise<unknown>>()

  constructor(private deps: DepsDuSphinx) {}

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

  private enigme(numero: string): Enigme | undefined {
    return this.enigmes.find(e => e.numero === numero)
  }

  /** Les mots de tous, lus s'ils ne le sont pas : une lecture à la fois, partagée. */
  pret(): Promise<void> {
    if (this.mots) return Promise.resolve()
    if (!this.enLecture) {
      const tour = this.tour
      this.enLecture = this.deps.profiles.motsDuSphinx().then(
        mots => {
          if (tour === this.tour) this.mots = mots
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

  /** Un profil supprimé emporte ses visites (`ProfileStore.supprimer`) : les mots de tous se relisent. */
  oublier(): void {
    this.tour++
    this.mots = null
    this.enLecture = null
  }

  /**
   * Ce que la lecture des missions — ou celle de sa visite — décide, sur ses
   * visites et ses jours (les mots de tous déjà lus, `pret`). Une visite déjà
   * posée aujourd'hui dit ce qu'elle est ; sinon, il en faut une, tirée ce
   * jour : un habitué, sa chance, un Divin du moment qu'il ne porte pas et
   * dont un mot lui manque, une énigme qu'il n'a pas vue.
   */
  decider(profileId: string, aujourdhui: string, activites: ReadonlyMap<string, ActiviteDuJour>, lignes: readonly LigneDuSphinx[]): DecisionDuSphinx {
    const deJour = lignes.find(l => l.jour === aujourdhui)
    if (deJour) return deJour.etat === 'proposee' ? { champ: 'attend' } : deJour.etat === 'plus-tard' ? { champ: 'epingle' } : {}
    if (!estHabitue(joursJoues(activites, aujourdhui))) return {}
    if ((this.deps.tirage ?? tirageDeLaVisite)(`${profileId}|${aujourdhui}`) >= CHANCE_D_UNE_VISITE) return {}
    const moment = divinDuMoment(this.motsDeTous())
    // Il le porte : il en connaît la légende, le Sphinx n'a rien à lui souffler.
    if (!moment || this.deps.profiles.divinsOf(profileId).includes(moment)) return {}
    const siens = sesMots(lignes, moment)
    if (cachesDe(legendeDe(moment)!).every(i => siens.has(i))) return {}
    const visitesAvant = lignes.filter(l => l.etat !== 'vue').length
    const enigme = choisirLEnigme(this.enigmes, new Set(lignes.map(l => l.enigme)), visitesAvant, hasardDe(`${profileId}|${aujourdhui}|enigme`))
    if (!enigme) return {}
    return { champ: 'attend', aPoser: { jour: aujourdhui, enigme: enigme.numero, divin: moment, quand: this.deps.maintenant() } }
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
      const [{ lignes, soirees }, { coffresDuMois: _, ...duJour }, deCampagne] = await Promise.all([
        profiles.lecturesDuSphinx(profileId, debut),
        jour.activiteDepuis(profileId, depuis),
        campagne.activiteDepuis(profileId, debut),
        this.pret(),
      ])
      const activites = activiteDesJours({ ...duJour, ...deCampagne, soirees })
      const decision = this.decider(profileId, aujourdhui, activites, lignes)
      const siennes = decision.aPoser ? await this.poser(profileId, decision.aPoser) : lignes
      const jours = joursJoues(activites, aujourdhui)
      return { habitue: estHabitue(jours), joursJoues: jours, ...this.vue(profileId, aujourdhui, siennes) }
    })
  }

  /** La visite du jour et les phrases, telles qu'il les voit. */
  private vue(profileId: string, aujourdhui: string, lignes: readonly LigneDuSphinx[]): Pick<SphinxOuvert, 'visite' | 'phrase' | 'reconstituees'> {
    const mots = this.motsDeTous()
    const porte = new Set(this.deps.profiles.divinsOf(profileId))
    const moment = divinDuMoment(mots)
    const ligne = lignes.find(l => l.jour === aujourdhui && l.etat !== 'vue')
    return {
      visite: ligne ? this.visiteDe(ligne, lignes, porte) : null,
      phrase: moment ? this.phraseDe(moment, lignes, porte) : null,
      reconstituees: phrasesReconstituees(mots),
    }
  }

  private phraseDe(cle: string, lignes: readonly LigneDuSphinx[], porte: ReadonlySet<string>): PhraseDuSphinx | null {
    const legende = legendeDe(cle)
    if (!legende) return null
    return phraseVue({ key: cle, nom: leDivin(cle)?.nom ?? '' }, legende, {
      siens: sesMots(lignes, cle),
      deTous: this.motsDeTous().get(cle) ?? new Set(),
      porteur: porte.has(cle),
    })
  }

  /** Une visite telle que la page la reçoit : la solution seulement une fois close. */
  private visiteDe(ligne: LigneDuSphinx, lignes: readonly LigneDuSphinx[], porte: ReadonlySet<string>): VisiteDuSphinx | null {
    const e = this.enigme(ligne.enigme)
    const phrase = this.phraseDe(ligne.divin, lignes, porte)
    if (!e || !phrase || ligne.etat === 'vue') return null
    const close = (VISITE_CLOSE as readonly string[]).includes(ligne.etat)
    const enigme: EnigmeDuSphinx = {
      numero: e.numero,
      sorte: e.sorte,
      vers: e.vers,
      source: { recueil: laReserve().recueil, page: e.page, facSimile: e.facSimile },
      ...(close && { solution: e.solution, ...(e.cle && { cle: e.cle }) }),
    }
    const texteDuMot = ligne.mot === null ? undefined : motsDeLaLegende(legendeDe(ligne.divin)!)[ligne.mot]?.texte
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
   * `POST /api/joueur/sphinx` : un geste sur la visite du jour, et son
   * verdict. Une écriture à la fois par profil ; la visite n'est écrite que
   * si elle est encore telle qu'il l'a lue. Le mot se tire au verdict.
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
      const ligne = lignes.find(l => l.jour === aujourdhui)
      const e = ligne ? this.enigme(ligne.enigme) : undefined
      if (!ligne || !e) return { refus: 404, error: 'Le Sphinx n’est pas passé aujourd’hui : reviens demain.' }
      const issue = appliquerLeGeste(ligne, geste, reponse, e)
      if ('refus' in issue) return { refus: issue.statut, error: issue.refus }
      let mot: number | null = null
      let motNeuf: boolean | undefined
      if (issue.apres.etat === 'resolue') {
        const deTous = this.motsDeTous().get(ligne.divin) ?? new Set<number>()
        const legende = legendeDe(ligne.divin)
        mot = legende ? choisirLeMot(cachesDe(legende), sesMots(lignes, ligne.divin), deTous, hasardDe(`${profileId}|${ligne.jour}|mot`)) : null
        motNeuf = mot !== null && !deTous.has(mot)
      }
      const close = (VISITE_CLOSE as readonly string[]).includes(issue.apres.etat)
      const ecrit = await this.deps.profiles.ecrireUnGesteDuSphinx(profileId, ligne.jour, ligne, {
        ...issue.apres,
        mot,
        ecouteeLe: geste === 'ecouter' || geste === 'repondre' ? maintenant : null,
        closeLe: close ? maintenant : null,
      })
      if (!ecrit) return { refus: 409, error: 'Le Sphinx a déjà entendu ce geste : recharge la page.' }
      if (mot !== null && this.mots) {
        if (!this.mots.has(ligne.divin)) this.mots.set(ligne.divin, new Set())
        this.mots.get(ligne.divin)!.add(mot)
      }
      const apres = lignes.map(l => (l === ligne ? { ...l, ...issue.apres, mot: mot ?? l.mot } : l))
      const { visite, phrase } = this.vue(profileId, aujourdhui, apres)
      return {
        accuse: true,
        geste,
        ...(issue.verdict && { verdict: issue.verdict }),
        ...(issue.dejaDite && { dejaDite: true as const }),
        ...(motNeuf !== undefined && { motNeuf }),
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
}
