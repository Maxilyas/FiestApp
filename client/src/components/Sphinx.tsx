import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent, type Ref, type RefObject } from 'react'
import { api } from '../api'
import { deNom, espacesFines } from '../format'
import { useModale } from '../modale'
import { dejaPresente, retenirLaPresentation, retenirLeSon, retenirPourLAlbum, sonVoulu } from '../sphinx'
import { Divin } from './Divin'
import { Icon } from './Icon'
import { IMAGES } from './legendaires-peints'
import { CompteDeLaPhrase, PhraseDuDivin, placesDevoilees } from './PhraseDuDivin'
import { DIVINS } from '../../../shared/divins'
import type { EnigmeDuSphinx, GesteDuSphinx, PhraseDuSphinx, SphinxOuvert, VerdictDuSphinx, VisiteDuSphinx as LaVisite } from '../../../shared/sphinx'

// Le Sphinx de l'accueil, côté écran (l'étape 2 du plan du 24 novembre 2026,
// `retours/2026-11-24/le-sphinx/plan.md` ; la maquette validée par le
// propriétaire, `sphinx.html` du même dossier, fait foi pour le rendu et les
// mots). Parfois, sur l'accueil d'un habitué, il surgit : l'accueil
// s'assombrit, l'écran frissonne, du sable se lève, sa boîte monte du bas en
// crans, et il naît du sable en mosaïque dans un éclair d'or. Il présente les
// Divins, nomme le Divin du moment, propose son énigme ; résolue, elle lui
// souffle un mot de sa phrase, qui vole jusqu'à sa place.
//
// Chargé à la demande (`leSphinx`, `client/src/sphinx.ts`), avec sa feuille et
// sa police pixel : seul un accueil que les missions disent visité le
// télécharge. Posé par-dessus l'accueil, jamais dedans : l'accueil est réglé
// au pixel en 360 × 640. Le serveur décide tout (`server/src/core/sphinx.ts`) ;
// ici, on montre ce qu'il envoie et on lui dit chaque geste.
//
// Muet par défaut — l'application ne fait jamais sonner un téléphone —, un
// haut-parleur dans la boîte l'allume. Moins de mouvement : le texte d'un
// coup, ni mosaïque, ni sable, ni secousse. Le lecteur d'écran entend chaque
// réplique entière, jamais lettre par lettre.

// ── Les mots ────────────────────────────────────────────────────────────────

const NOMBRES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf', 'vingt']

/** Un nombre que le Sphinx dit : en lettres jusqu'à vingt, comme on parle. */
const enLettres = (n: number) => NOMBRES[n] ?? String(n)

/**
 * « du *Séraphin* », « de l’*Ange Déchu* », « d’*Osiris* », « de *Chronos* » :
 * la préposition devant le nom d'un Divin, l'article fondu, le nom seul en or.
 */
export function deLui(nom: string): string {
  if (nom.startsWith('Le ')) return `du *${nom.slice(3)}*`
  if (nom.startsWith('La ')) return `de la *${nom.slice(3)}*`
  if (/^L[’']/.test(nom)) return `de l’*${nom.slice(2)}*`
  if (nom.startsWith('Les ')) return `des *${nom.slice(4)}*`
  const lie = deNom(nom)
  return `${lie.slice(0, lie.length - nom.trim().length)}*${nom.trim()}*`
}

/** Le recueil d'où vient l'énigme, en trois morceaux : son titre, son auteur, son année — sinon tel quel. */
function laSource(recueil: string): { titre: string; auteur: string | null; annee: string | null } {
  const m = /^(.*?), publié par ([^(,]+?)\s*(?:\(|,)/.exec(recueil)
  const annee = /(1[5-9]\d\d)(?!.*\d{4})/.exec(recueil)?.[1] ?? null
  return m ? { titre: m[1], auteur: m[2].trim(), annee } : { titre: recueil, auteur: null, annee }
}

/** Les répliques du Sphinx, telles que la maquette validée les dit — le prénom du joueur à la place de Léa. */
const DIT = {
  psst: (prenom: string) => `… Psst. *${prenom}*.`,
  jeSuis: 'Je suis le Sphinx. Je ne me montre qu’aux habitués… et toi, je te vois presque tous les jours.',
  divins: 'Dis-moi : as-tu déjà entendu parler des *Divins* ?',
  rares: 'Ce sont les avatars les plus rares de FiestApp. Ils ne s’achètent pas, et aucun coffre ne les donne.',
  exploit: 'Un Divin descend sur celui qui accomplit un exploit bien précis… mais personne ne sait lequel.',
  moment: (nom: string) => `En ce moment, tous les habitués cherchent le secret ${deLui(nom)}. Il est caché dans une phrase.`,
  proposer: 'Chacun en reçoit des mots différents. Résous mon énigme, et je t’en souffle un.',
  revoila: 'Te revoilà. Mon énigme t’attendait.',
  plusTard: 'Comme tu voudras. Je reste là jusqu’à minuit.',
  plusTardEnigme: 'Prends ton temps. Mon énigme t’attend jusqu’à minuit, et tes essais aussi.',
  ecoute: 'Celle-ci a été écrite en *1858*. Écoute bien…',
  quiSuisJe: (sorte: EnigmeDuSphinx['sorte'], essais: number) =>
    `${sorte === 'charade' ? 'Quel est mon tout ?' : 'Qui suis-je ?'} Écris ta réponse en haut. ${essais >= 3 ? 'Tu as trois essais.' : essais === 2 ? 'Il te reste deux essais.' : 'Il te reste un seul essai.'}`,
  brule: 'Tu brûles… mais ce n’est pas ça. Cet essai ne compte pas.',
  dejaDite: 'Celle-là, tu me l’as déjà dite. Cet essai ne compte pas.',
  faux: (restants: number) => (restants >= 2 ? 'Non… Le sable a bougé, pas ta réponse. Encore *deux essais*.' : 'Non. Plus qu’*un essai*. Réfléchis bien.'),
  exact: (solution: string) => `… Exact. C’était ${solution}.`,
  voici: (nom: string) => `Voici un mot de la phrase ${deLui(nom)}.`,
  neuf: 'Et celui-là, *personne ne l’avait encore*.',
  dejaTrouve: 'Celui-là, d’autres habitués l’avaient déjà. Il est à toi maintenant.',
  autres: (n: number) =>
    n > 0
      ? `Les autres habitués en ont trouvé ${enLettres(n)}. Comparez vos mots : à plusieurs, vous lirez la phrase entière.`
      : 'Les autres habitués n’en ont encore aucun. Parle-leur : à plusieurs, vous lirez la phrase entière.',
  album: 'Ta phrase t’attend dans ton album. Quand vous l’aurez reconstituée, je vous parlerai d’un autre Divin.',
  entiere: (nom: string) => `Avec ce mot, la phrase ${deLui(nom)} est entière : tous ensemble, vous l’avez *reconstituée* !`,
  entiereAlbum: 'Elle t’attend dans ton album. Je vous parlerai bientôt d’un autre Divin.',
  laLire: 'Tu veux la lire en entier ? Chacun la lit quand il veut… ou jamais.',
  laVoici: 'La voici. Je vous parlerai bientôt d’un autre Divin.',
  plusTardDansLAlbum: 'Comme tu voudras. Elle t’attend dans ton album, le jour où tu voudras la lire.',
  perdu: (solution: string) => `Le sable se referme. C’était ${solution}.`,
  chat: (solution: string) => `Dommage. C’était ${solution}.`,
  // La maquette promettait le lendemain : une visite ne vient qu'un jour sur trois.
  autreJour: 'Je reviendrai un autre jour, avec une autre énigme et un autre mot à souffler.',
  sansReseau: (motif: string) => `Le sable m’a retenu. ${motif}.`,
}

/**
 * La solution telle que le Sphinx la dit, en or entre guillemets : celle de la
 * clé du livre, telle qu'elle s'y écrit — sans article, une majuscule qu'une
 * phrase n'aurait pas : nue dans la phrase, elle se lisait de travers —, et
 * pour une charade, son découpage.
 */
const laSolution = (e: EnigmeDuSphinx) => `« *${e.solution ?? ''}* »${e.cle ? ` (${e.cle})` : ''}`

// ── Le son : de petits bips d'autrefois, faits sur place ───────────────────

interface Sons {
  /** Ouvre le son — au toucher du haut-parleur, le geste que le navigateur attend. */
  ouvrir(): void
  bip(): void
  grondement(): void
  apparition(): void
  menu(): void
  faux(): void
  presque(): void
  juste(): void
  lettre(): void
}

/**
 * Les sons de la maquette, en WebAudio : rien à télécharger. Ils ne sortent
 * que si `allume()` le dit — le haut-parleur de la boîte — : jamais par le son
 * de l'écran commun (`client/src/sound.ts`), qui sonne d'office là-bas.
 */
function fabriquerLesSons(allume: () => boolean): Sons {
  let audio: AudioContext | null = null
  const ouvrir = () => {
    if (audio) {
      if (audio.state === 'suspended') void audio.resume()
      return
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      audio = Ctor ? new Ctor() : null
    } catch {
      audio = null
    }
  }
  const note = (freq: number, duree: number, { type = 'square', volume = 0.03, a = 0, glisse }: { type?: OscillatorType; volume?: number; a?: number; glisse?: number } = {}) => {
    if (!allume()) return
    if (!audio) ouvrir()
    if (!audio) return
    try {
      const t = audio.currentTime + a
      const o = audio.createOscillator()
      const g = audio.createGain()
      o.type = type
      o.frequency.setValueAtTime(freq, t)
      if (glisse) o.frequency.exponentialRampToValueAtTime(glisse, t + duree)
      g.gain.setValueAtTime(volume, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + duree)
      o.connect(g).connect(audio.destination)
      o.start(t)
      o.stop(t + duree + 0.02)
    } catch {
      // Un navigateur qui refuse : le Sphinx se tait, rien d'autre ne change.
    }
  }
  return {
    ouvrir,
    bip: () => note(560 + Math.random() * 90, 0.035, { volume: 0.022 }),
    grondement: () => {
      note(90, 0.9, { type: 'sine', volume: 0.18, glisse: 38 })
      note(1320, 0.5, { type: 'sine', volume: 0.02, a: 0.35, glisse: 1760 })
    },
    apparition: () => [1047, 1319, 1568, 2093].forEach((f, i) => note(f, 0.28, { type: 'sine', volume: 0.03, a: i * 0.07 })),
    menu: () => note(880, 0.05, { volume: 0.025 }),
    faux: () => note(180, 0.28, { volume: 0.05, glisse: 90 }),
    presque: () => {
      note(440, 0.08, { type: 'triangle', volume: 0.05 })
      note(415, 0.12, { type: 'triangle', volume: 0.05, a: 0.09 })
    },
    juste: () => [523, 659, 784, 1047, 1319].forEach((f, i) => note(f, 0.16, { type: 'triangle', volume: 0.06, a: i * 0.085 })),
    lettre: () => note(988, 0.05, { type: 'triangle', volume: 0.04 }),
  }
}

/** La vibration de l'arrivée, d'une réponse fausse, du mot gagné : sous try/catch, un navigateur intégré peut la refuser. */
function vibrer(motif: number | number[]) {
  try {
    navigator.vibrate?.(motif)
  } catch {
    // Refusée : rien.
  }
}

/** Le système demande-t-il moins de mouvement ? Lu une fois par visite. */
function moinsDeMouvement(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// ── La boîte de dialogue ────────────────────────────────────────────────────

/** Une réplique : son texte (les mots en or entre astérisques), et son numéro — la même phrase redite se réécrit. */
interface Replique {
  n: number
  texte: string
  /** Une erreur : elle se dit dans la boîte, en rouge, et dit quoi faire. */
  erreur?: boolean
}

/** Ce que la boîte laisse à la visite : finir d'un toucher la réplique qui s'écrit. */
interface FinDeLaFrappe {
  finir: () => void
}

/** Le temps d'une lettre, comme on parle : un souffle aux points de suspension, une pause à la ponctuation. */
const delaiApres = (c: string) => (c === '…' ? 260 : /[.!?]/.test(c) ? 160 : /[,;:]/.test(c) ? 90 : 26)

/** Les lettres d'une réplique, chacune sa place dès le départ : un mot ne saute pas de ligne en s'écrivant. */
function lesLettres(texte: string): { c: string; or: boolean }[] {
  const lettres: { c: string; or: boolean }[] = []
  let or = false
  for (const c of espacesFines(texte)) {
    if (c === '*') or = !or
    else lettres.push({ c, or })
  }
  return lettres
}

/** Une réplique qui s'écrit lettre par lettre — d'un coup sous moins de mouvement —, puis le dit (`onFini`). */
function Frappe({ texte, calme, onFini, fin, bip }: { texte: string; calme: boolean; onFini?: () => void; fin?: RefObject<FinDeLaFrappe | null>; bip?: () => void }) {
  const lettres = useMemo(() => lesLettres(texte), [texte])
  const [vues, setVues] = useState(calme ? lettres.length : 0)
  const rappel = useRef(onFini)
  rappel.current = onFini
  useEffect(() => {
    let vivant = true
    let fini = false
    let minuterie = 0
    const terminer = () => {
      if (fini) return
      fini = true
      window.clearTimeout(minuterie)
      setVues(lettres.length)
      rappel.current?.()
    }
    if (fin) fin.current = { finir: terminer }
    if (calme || lettres.length === 0) {
      terminer()
      return () => void (vivant = false)
    }
    let i = 0
    const suivante = () => {
      if (!vivant || fini) return
      i++
      setVues(i)
      const c = lettres[i - 1].c
      if (i % 2 === 1 && c.trim()) bip?.()
      if (i >= lettres.length) terminer()
      else minuterie = window.setTimeout(suivante, delaiApres(c))
    }
    minuterie = window.setTimeout(suivante, 40)
    return () => {
      vivant = false
      window.clearTimeout(minuterie)
      if (fin?.current?.finir === terminer) fin.current = null
    }
  }, [lettres, calme]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {lettres.map(({ c, or }, i) => {
        const lettre = (
          <span key={i} className={i < vues ? 'sx-l sx-v' : 'sx-l'}>
            {c}
          </span>
        )
        return or ? <em key={i}>{lettre}</em> : lettre
      })}
    </>
  )
}

/**
 * La boîte de dialogue : un cadre de jeu d'autrefois, double filet d'or,
 * quatre rivets, l'étiquette « Le Sphinx », la réplique qui s'écrit et le ▼
 * qui attend un toucher. Le lecteur d'écran entend la réplique entière, dans
 * une région qui se dit ; les lettres qui s'écrivent lui sont tues. Le
 * haut-parleur à côté de l'étiquette : muet d'office.
 */
export function BoiteDuSphinx({
  replique,
  calme,
  attend,
  son,
  onSon,
  onFini,
  fin,
  bip,
  etat = 'la',
  refBoite,
}: {
  replique: string | Replique | null
  calme: boolean
  attend: boolean
  son: boolean
  onSon: () => void
  onFini?: () => void
  fin?: RefObject<FinDeLaFrappe | null>
  bip?: () => void
  /** Elle monte du bas en crans, se tient là, puis repart. */
  etat?: 'cachee' | 'la' | 'part'
  refBoite?: Ref<HTMLDivElement>
}) {
  const r: Replique | null = typeof replique === 'string' ? { n: 0, texte: replique } : replique
  const lue = r ? espacesFines(r.texte.replace(/\*/g, '')) : ''
  return (
    <div className={`sx-boite sx-boite-${etat}${attend ? ' sx-attend' : ''}`} ref={refBoite}>
      <span className="sx-rivet" aria-hidden="true" />
      <span className="sx-rivet" aria-hidden="true" />
      <span className="sx-rivet" aria-hidden="true" />
      <span className="sx-rivet" aria-hidden="true" />
      {/* Le haut-parleur, un rivet de plus à gauche de l'étiquette : à droite, loin du Sphinx couché sur la boîte. */}
      <span className="sx-tete">
        <button type="button" className="sx-son" aria-pressed={son} aria-label="Le son du Sphinx" onClick={onSon}>
          <Icon name={son ? 'volume' : 'volume-off'} />
        </button>
        <span className="sx-etiquette" aria-hidden="true">
          Le Sphinx
        </span>
      </span>
      <p className={r?.erreur ? 'sx-texte sx-erreur' : 'sx-texte'} aria-hidden="true">
        {r && <Frappe key={r.n} texte={r.texte} calme={calme} onFini={onFini} fin={fin} bip={bip} />}
      </p>
      {/* Toujours là, vide d'abord : une région qui apparaît avec son texte n'est pas toujours lue. */}
      <p className="sr-only" aria-live="polite">
        {lue}
      </p>
      <span className="sx-suite" aria-hidden="true" />
    </div>
  )
}

// ── L'énigme ───────────────────────────────────────────────────────────────

/**
 * L'énigme, écrite en haut de l'écran — le clavier du téléphone monte par le
 * bas : son numéro, ses essais en losanges, ses vers qui paraissent un à un,
 * sa source, le champ de la réponse, puis ses deux sorties : « Plus tard » et
 * « Je donne ma langue au chat ». Le champ n'a jamais le focus d'office : le
 * clavier pousserait la boîte hors de l'écran — on le touche quand on a sa
 * réponse. « Plus tard » est le retour du propriétaire du 24 novembre 2026 :
 * Échap seul remettait une énigme ouverte à plus tard, et un téléphone n'en a
 * pas — qui voulait y réfléchir n'avait que la langue au chat.
 */
export function ParcheminDeLEnigme({
  enigme,
  essaisRestants,
  versMontres,
  valeur,
  faux,
  montre = true,
  onValeur,
  onRepondre,
  onChat,
  onPlusTard,
  refChamp,
}: {
  enigme: EnigmeDuSphinx
  essaisRestants: number
  versMontres: number
  valeur: string
  faux: boolean
  montre?: boolean
  onValeur: (v: string) => void
  onRepondre: () => void
  onChat: () => void
  onPlusTard: () => void
  refChamp?: Ref<HTMLInputElement>
}) {
  const source = laSource(enigme.source.recueil)
  const perdus = Math.max(0, 3 - essaisRestants)
  const soumettre = (e: FormEvent) => {
    e.preventDefault()
    onRepondre()
  }
  return (
    <section className={'sx-parchemin' + (montre ? ' sx-montre' : '')} aria-label="L’énigme du Sphinx">
      <div className="sx-parchemin-tete">
        <p className="sx-sourcil">{`${enigme.sorte === 'charade' ? 'La charade' : 'L’énigme'} n° ${enigme.numero}`}</p>
        <span className="sx-essais" role="img" aria-label={`${essaisRestants} essai${essaisRestants > 1 ? 's' : ''} restant${essaisRestants > 1 ? 's' : ''}`}>
          {[0, 1, 2].map(i => (
            <i key={i} className={i < perdus ? 'sx-perdu' : undefined} />
          ))}
        </span>
      </div>
      <p className="sx-vers">
        {enigme.vers.map((v, i) => (
          <span key={i} className={i < versMontres ? 'sx-la' : undefined}>
            {espacesFines(v)}
          </span>
        ))}
      </p>
      <p className="sx-source">
        <i>{source.titre}</i>
        {source.auteur && `, ${source.auteur}`}
        {source.annee && `, ${source.annee}`} · domaine public, via{' '}
        <a href={enigme.source.facSimile} target="_blank" rel="noopener noreferrer">
          Wikisource
        </a>
      </p>
      <form className={'sx-reponse' + (faux ? ' sx-faux' : '')} onSubmit={soumettre} autoComplete="off">
        <label className="sr-only" htmlFor="sx-reponse">
          Ta réponse
        </label>
        <input
          id="sx-reponse"
          ref={refChamp}
          value={valeur}
          onChange={e => onValeur(e.target.value)}
          placeholder="Ta réponse"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          maxLength={80}
        />
        <button type="submit">Répondre</button>
      </form>
      <div className="sx-issues">
        <button type="button" className="sx-plus-tard" onClick={onPlusTard}>
          Plus tard
        </button>
        <button type="button" className="sx-chat" onClick={onChat}>
          Je donne ma langue au chat
        </button>
      </div>
    </section>
  )
}

// ── L'épingle ──────────────────────────────────────────────────────────────

/** Le médaillon du Sphinx, aux points d'interrogation : le grand, net sur un écran dense. */
const MEDAILLON = IMAGES['lg:sphinx']?.art[0]
/** Sa découpe, couchée sur la boîte : celle de l'album. */
const DECOUPE = IMAGES['lg:sphinx']?.perso

/**
 * Le Sphinx épinglé, remis à plus tard : son médaillon et un « ? », près
 * d'« Entre amis » jusqu'à minuit. Le toucher rouvre la visite.
 */
export function EpingleDuSphinx({ onOuvrir }: { onOuvrir: () => void }) {
  return (
    <button type="button" className="sx-epingle" aria-label="Le Sphinx t’attend : écouter son énigme" onClick={onOuvrir}>
      {MEDAILLON && <img src={MEDAILLON} alt="" decoding="async" draggable={false} />}
      <b aria-hidden="true">?</b>
    </button>
  )
}

// ── La vitrine des Divins ──────────────────────────────────────────────────

/** Ceux que la vitrine montre autour du Divin du moment : des noms courts, qui tiennent sous leur voile. */
const DE_LA_VITRINE = ['dv:helios', 'dv:athena', 'dv:ariane', 'dv:thot', 'dv:hecate', 'dv:nike', 'dv:osiris', 'dv:chronos']
/** Combien de voiles dans la vitrine. */
const VOILES = 5

/** Les cinq voiles : quatre Divins et celui du moment, au milieu. */
function voilesDeLaVitrine(moment: string): string[] {
  const autres = DE_LA_VITRINE.filter(k => k !== moment && DIVINS.some(d => d.key === k)).slice(0, VOILES - 1)
  return [...autres.slice(0, 2), moment, ...autres.slice(2)]
}

const nomDe = (cle: string) => DIVINS.find(d => d.key === cle)?.nom ?? ''

// ── Le sable et la mosaïque ────────────────────────────────────────────────

interface Grain {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  vie: number
  usure: number
}

/** Le sable qui se lève, sur une toile de toute la scène : il ne bouge que le temps de la visite. */
function leSable(toile: HTMLCanvasElement) {
  const grains: Grain[] = []
  let actif = false
  let enCours = false
  const dpr = () => Math.min(window.devicePixelRatio || 1, 2)
  const dimensionner = () => {
    const r = toile.getBoundingClientRect()
    toile.width = Math.round(r.width * dpr())
    toile.height = Math.round(r.height * dpr())
  }
  const vent = (n: number) => {
    for (let i = 0; i < n; i++) {
      grains.push({ x: Math.random() * toile.width, y: toile.height * (0.55 + Math.random() * 0.5), vx: 0.15 + Math.random() * 0.4, vy: -(0.2 + Math.random() * 0.6), r: 0.6 + Math.random() * 1.6, vie: 1, usure: 0.002 + Math.random() * 0.004 })
    }
  }
  const boucle = () => {
    const ctx = toile.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, toile.width, toile.height)
    ctx.fillStyle = 'rgb(241, 206, 120)'
    for (let i = grains.length - 1; i >= 0; i--) {
      const g = grains[i]
      g.x += g.vx + Math.sin((g.y + g.x) * 0.01) * 0.25
      g.y += g.vy
      g.vy -= 0.004
      g.vie -= g.usure
      if (g.vie <= 0 || g.y < -10) {
        grains.splice(i, 1)
        continue
      }
      ctx.globalAlpha = Math.max(0, g.vie) * 0.85
      ctx.beginPath()
      ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2)
      ctx.fill()
    }
    if (actif && grains.length < 60) vent(2)
    if (actif || grains.length) requestAnimationFrame(boucle)
    else enCours = false
  }
  const relancer = () => {
    if (enCours) return
    enCours = true
    requestAnimationFrame(boucle)
  }
  return {
    lever() {
      dimensionner()
      actif = true
      relancer()
    },
    poser() {
      actif = false
    },
    /** Une rafale de grains, d'un point de l'écran (en pixels de la page). */
    rafale(x: number, y: number, n: number) {
      if (!toile.width) dimensionner()
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const v = 0.8 + Math.random() * 3.2
        grains.push({ x: x * dpr(), y: y * dpr(), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.2, r: 0.7 + Math.random() * 2, vie: 1, usure: 0.008 + Math.random() * 0.012 })
      }
      relancer()
    },
    arreter() {
      actif = false
      grains.length = 0
    },
  }
}

/** La part de sa découpe que la boîte montre : la maquette la prenait telle, ses pattes posées sur le filet d'or. */
const SOURCE: [number, number, number, number] = [0, 0, 256, 172]

/** Le Sphinx, peint sur sa toile : `pas` de 0 à 1, une mosaïque de plus en plus fine ; 1, son dessin ; null, rien. */
function peindre(toile: HTMLCanvasElement, image: HTMLImageElement | null, pas: number | null) {
  const r = toile.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  toile.width = Math.max(1, Math.round(r.width * dpr))
  toile.height = Math.max(1, Math.round(r.height * dpr))
  const ctx = toile.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, toile.width, toile.height)
  if (pas === null || !image || !image.naturalWidth) return
  if (pas >= 1) {
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(image, ...SOURCE, 0, 0, toile.width, toile.height)
    return
  }
  // Une mosaïque de plus en plus fine : le dessin réduit, puis agrandi sans lissage.
  const w = Math.max(3, Math.round(4 + pas * pas * 90))
  const h = Math.max(2, Math.round((w * SOURCE[3]) / SOURCE[2]))
  const petit = document.createElement('canvas')
  petit.width = w
  petit.height = h
  petit.getContext('2d')?.drawImage(image, ...SOURCE, 0, 0, w, h)
  ctx.imageSmoothingEnabled = false
  ctx.globalAlpha = Math.min(1, 0.35 + pas)
  ctx.drawImage(petit, 0, 0, w, h, 0, 0, toile.width, toile.height)
  ctx.globalAlpha = 1
}

// ── La visite ──────────────────────────────────────────────────────────────

/** Une visite abandonnée en route — la page démontée, Échap : le scénario s'arrête là, sans rien dire. */
class Abandon extends Error {}

/** Ce que la visite rend à l'accueil en partant : épinglé jusqu'à minuit, close pour aujourd'hui, ou rien à montrer. */
export type IssueDeLaVisite = 'epingle' | 'close' | 'rien'

type Vue = 'rien' | 'vitrine' | 'focus' | 'enigme'

/** Ce que la scène porte : assombrie, en énigme (le Sphinx rétréci), secouée, glorieuse. */
interface EtatDeLaScene {
  visite: boolean
  enigme: boolean
  non: boolean
  frisson: boolean
  glorieux: boolean
}

/** L'issue d'une énigme, attendue par le scénario : juste, perdue, la langue au chat, ou remise à plus tard. */
type Issue = { quoi: 'juste' | 'perdu' | 'abandon' | 'plus-tard'; verdict: VerdictDuSphinx }

/** La phrase d'avant le mot gagné : sa place encore cachée, ses comptes d'avant. */
function avantLeMot(apres: PhraseDuSphinx, index: number, neuf: boolean): PhraseDuSphinx {
  return {
    ...apres,
    mots: apres.mots.map((m, i) => (i === index ? { forme: m.forme } : m)),
    siens: Math.max(0, apres.siens - 1),
    parTous: Math.max(0, apres.parTous - (neuf ? 1 : 0)),
    reconstituee: false,
  }
}

/**
 * La scène de la visite, données en main : le scénario de la maquette, joué
 * d'une traite — chaque réplique attend son toucher, le menu son choix,
 * l'énigme son issue. Chaque geste part au serveur, son verdict revient ; une
 * erreur se dit dans la boîte. Échap le remet à plus tard.
 */
function SceneDuSphinx({
  prenom,
  donnees,
  erreur,
  onReessayer,
  onPartir,
}: {
  prenom: string
  donnees: SphinxOuvert | null
  erreur: string | null
  onReessayer: () => void
  onPartir: (issue: IssueDeLaVisite) => void
}) {
  const calme = useMemo(moinsDeMouvement, [])
  const [son, setSon] = useState(() => sonVoulu())
  const sonAllume = useRef(son)
  sonAllume.current = son
  const sons = useMemo(() => fabriquerLesSons(() => sonAllume.current), [])
  const [scene, setScene] = useState<EtatDeLaScene>({ visite: false, enigme: false, non: false, frisson: false, glorieux: false })
  const [boite, setBoite] = useState<'cachee' | 'la' | 'part'>('cachee')
  const [vue, setVue] = useState<Vue>('rien')
  const [replique, setReplique] = useState<Replique | null>(null)
  const [attend, setAttend] = useState(false)
  const [menu, setMenu] = useState<[string, string][] | null>(null)
  const [vise, setVise] = useState(0)
  const [visite, setVisite] = useState<LaVisite | null>(donnees?.visite ?? null)
  const [phrase, setPhrase] = useState<PhraseDuSphinx | null>(donnees?.visite?.phrase ?? null)
  const [retourne, setRetourne] = useState<number | readonly number[] | undefined>(undefined)
  const [vitrineLa, setVitrineLa] = useState(0)
  const [versMontres, setVersMontres] = useState(0)
  const [valeur, setValeur] = useState('')
  const [faux, setFaux] = useState(false)
  const [motVole, setMotVole] = useState<string | null>(null)

  const racine = useRef<HTMLDivElement>(null)
  const refBoite = useRef<HTMLDivElement>(null)
  const toileDuSable = useRef<HTMLCanvasElement>(null)
  const toileDuSphinx = useRef<HTMLCanvasElement>(null)
  const leSphinx = useRef<HTMLDivElement>(null)
  const eclair = useRef<HTMLDivElement>(null)
  const vole = useRef<HTMLDivElement>(null)
  const haut = useRef<HTMLDivElement>(null)
  const champ = useRef<HTMLInputElement>(null)
  const premierChoix = useRef<HTMLButtonElement>(null)

  // Les attentes du scénario : la frappe d'une réplique, un toucher, un choix, l'issue de l'énigme.
  const fin = useRef<FinDeLaFrappe | null>(null)
  const finDeFrappe = useRef<(() => void) | null>(null)
  const toucher = useRef<(() => void) | null>(null)
  const choix = useRef<((v: string) => void) | null>(null)
  const issue = useRef<((i: Issue) => void) | null>(null)
  const repondu = useRef(false)
  const occupe = useRef(false)
  /** Le tour du scénario : démontée ou fuie, la visite en change, et l'ancien s'arrête à sa prochaine attente. */
  const tour = useRef(0)
  const compteur = useRef(0)
  const visiteVue = useRef(visite)
  visiteVue.current = visite
  const sable = useRef<ReturnType<typeof leSable> | null>(null)
  const image = useRef<HTMLImageElement | null>(null)

  /**
   * Le Divin du moment tient au-dessus du Sphinx : quand sa phrase est longue
   * — vingt mots, le texte agrandi — ou la boîte haute, son voile rétrécit
   * (`--sx-divin`) plutôt que la phrase ne parte sous la boîte. Au-delà de son
   * plus petit, le cadre défile.
   */
  const ajusterLeVoile = () => {
    const r = racine.current
    const h = haut.current
    const f = r?.querySelector<HTMLElement>('.sx-focus')
    if (!r || !h || !f) return
    r.style.removeProperty('--sx-divin')
    // Sa hauteur de mise en page, pas sa boîte à l'écran : il paraît en fondu depuis 96 %, et mesuré pendant, le voile
    // ne rétrécissait pas assez. Mesures entières, tailles qui ne le sont pas : quatre pixels de marge.
    const trop = f.offsetHeight + 1 + 4 - h.clientHeight
    if (trop <= 0) return
    const g = f.querySelector<HTMLElement>('.sx-grand')
    const taille = g ? parseFloat(getComputedStyle(g).fontSize) : 128
    r.style.setProperty('--sx-divin', `${Math.max(40, Math.floor(taille - trop))}px`)
  }

  // La boîte mesurée : ce qui se pose au-dessus d'elle — le Sphinx, le menu, ce qu'il montre — suit sa hauteur.
  useLayoutEffect(() => {
    const b = refBoite.current
    const r = racine.current
    if (!b || !r || typeof ResizeObserver !== 'function') return
    const o = new ResizeObserver(() => {
      r.style.setProperty('--sx-boite-h', `${b.offsetHeight}px`)
      ajusterLeVoile()
    })
    o.observe(b)
    // Et ce qu'il montre : une police arrivée après coup — sous moins de mouvement, rien ne l'attend — change sa hauteur.
    const f = r.querySelector('.sx-focus')
    if (f) o.observe(f)
    return () => o.disconnect()
  }, [])
  // Le menu ouvert laisse un peu plus d'air au-dessus de lui (sa feuille) : le voile se remesure aussi.
  useLayoutEffect(ajusterLeVoile, [phrase, vue, menu])
  // Ce que le haut montre de neuf se lit depuis son début : l'énigme défilée laissait le Divin du moment défilé d'autant.
  useLayoutEffect(() => {
    if (haut.current) haut.current.scrollTop = 0
  }, [vue])

  // Modale : le reste de la page inerte, le focus dans la scène, Échap la remet à plus tard.
  const fuir = () => {
    tour.current++
    const v = visiteVue.current
    if (v && (v.etat === 'proposee' || v.etat === 'plus-tard')) {
      // Écrit en chemin : un échec le laisse proposé, et l'épingle le rouvre de même.
      if (v.etat === 'proposee') void api.joueur.gesteDuSphinx('plus-tard').catch(() => {})
      onPartir('epingle')
    } else onPartir(v ? 'close' : erreur ? 'epingle' : 'rien')
  }
  useModale(racine, fuir)

  const verifier = (moi: number) => {
    if (moi !== tour.current) throw new Abandon()
  }
  const attendre = (moi: number, ms: number) =>
    new Promise<void>(r => window.setTimeout(r, ms)).then(() => {
      verifier(moi)
    })

  /** Une réplique qui s'écrit ; la promesse tient jusqu'à sa dernière lettre. Une nouvelle coupe celle qui s'écrivait. */
  const ecrire = (moi: number, texte: string, erreurDite = false) => {
    verifier(moi)
    finDeFrappe.current?.()
    return new Promise<void>(r => {
      finDeFrappe.current = () => {
        finDeFrappe.current = null
        r()
      }
      setAttend(false)
      setReplique({ n: ++compteur.current, texte, ...(erreurDite && { erreur: true }) })
    }).then(() => verifier(moi))
  }
  /** Une réplique, puis le ▼ : elle attend un toucher. */
  const dire = async (moi: number, texte: string) => {
    await ecrire(moi, texte)
    setAttend(true)
    await new Promise<void>(r => {
      toucher.current = () => {
        toucher.current = null
        r()
      }
    })
    setAttend(false)
    sons.menu()
    verifier(moi)
  }
  /** Une réplique, puis le petit menu au curseur ▶ : la promesse rend le choix. */
  const demander = async (moi: number, texte: string, options: [string, string][]) => {
    await ecrire(moi, texte)
    setVise(0)
    setMenu(options)
    const valeur = await new Promise<string>(r => {
      choix.current = v => {
        choix.current = null
        r(v)
      }
    })
    setMenu(null)
    verifier(moi)
    return valeur
  }

  // Le premier choix du menu prend le focus : au clavier, Entrée répond ; au doigt, rien ne bouge.
  useEffect(() => {
    if (menu) premierChoix.current?.focus({ preventScroll: true })
  }, [menu])

  const position = (): [number, number] => {
    const s = leSphinx.current?.getBoundingClientRect()
    return s ? [s.left + s.width * 0.45, s.top + s.height * 0.45] : [80, window.innerHeight - 220]
  }

  /** Le Sphinx naît du sable en mosaïque, ou y retourne : d'un coup sous moins de mouvement. */
  const materialiser = async (moi: number, inverse = false) => {
    const toile = toileDuSphinx.current
    if (!toile) return
    if (calme) {
      peindre(toile, image.current, inverse ? null : 1)
      return
    }
    const etapes = [0.05, 0.12, 0.2, 0.3, 0.42, 0.56, 0.72, 0.88, 1]
    for (const p of inverse ? [...etapes].reverse() : etapes) {
      peindre(toile, image.current, p)
      await attendre(moi, 85)
    }
    peindre(toile, image.current, inverse ? null : 1)
  }

  /** L'arrivée : l'accueil s'assombrit, l'écran frissonne, le sable se lève, la boîte monte, le Sphinx paraît dans un éclair. */
  const arriver = async (moi: number) => {
    setScene(s => ({ ...s, visite: true, frisson: !calme }))
    if (!calme) window.setTimeout(() => setScene(s => ({ ...s, frisson: false })), 450)
    sons.grondement()
    if (!calme) sable.current?.lever()
    await attendre(moi, calme ? 0 : 500)
    setBoite('la')
    await attendre(moi, calme ? 0 : 380)
    sons.apparition()
    await materialiser(moi)
    if (!calme && eclair.current) {
      eclair.current.classList.remove('sx-part')
      void eclair.current.offsetWidth
      eclair.current.classList.add('sx-part')
    }
    setScene(s => ({ ...s, glorieux: true }))
    vibrer([18, 50, 40])
    if (!calme) sable.current?.rafale(...position(), 90)
    await attendre(moi, calme ? 0 : 450)
  }

  /** Il s'en va : il retourne au sable, la boîte redescend, l'accueil se rallume. */
  const partir = async (moi: number) => {
    setVue('rien')
    if (!calme) sable.current?.rafale(...position(), 60)
    setScene(s => ({ ...s, glorieux: false }))
    await materialiser(moi, true)
    setBoite('part')
    setScene(s => ({ ...s, visite: false, enigme: false }))
    sable.current?.poser()
    await attendre(moi, calme ? 50 : 500)
  }

  /** Un geste au serveur ; un refus ou un réseau perdu se dit dans la boîte, et la promesse rend null. */
  const envoyer = async (moi: number, geste: GesteDuSphinx, reponse?: string): Promise<VerdictDuSphinx | null> => {
    try {
      const v = await api.joueur.gesteDuSphinx(geste, reponse)
      verifier(moi)
      setVisite(v.visite)
      return v
    } catch (e) {
      if (e instanceof Abandon) throw e
      await ecrire(moi, DIT.sansReseau((e as Error).message.replace(/[.\s]+$/, '')), true).catch(() => {})
      return null
    }
  }

  /**
   * Le menu du Sphinx : écouter son énigme, ou la remettre à plus tard. Un geste qui n'aboutit pas redemande.
   * « Plus tard », et plus « Pas aujourd'hui » (la maquette) : il ne part pas, il reste épinglé jusqu'à minuit.
   */
  const proposer = async (moi: number, texte: string): Promise<void> => {
    const r = await demander(moi, texte, [
      ['oui', 'J’écoute !'],
      ['non', 'Plus tard'],
    ])
    if (r === 'non') {
      // Remise à plus tard : écrit pendant qu'il le dit ; déjà épinglée, rien à écrire.
      const deja = visiteVue.current?.etat === 'plus-tard'
      const [ecrit] = await Promise.all([deja ? Promise.resolve(true) : envoyer(moi, 'plus-tard').then(v => !!v), dire(moi, DIT.plusTard)])
      if (!ecrit) return proposer(moi, DIT.proposer)
      await partir(moi)
      onPartir('epingle')
      return
    }
    const v = await envoyer(moi, 'ecouter')
    if (!v) return proposer(moi, DIT.proposer)
    return enigme(moi, v.visite)
  }

  /** L'énigme : en haut de l'écran, ses vers un à un, puis l'issue — juste, perdue, la langue au chat, ou plus tard. */
  const enigme = async (moi: number, v: LaVisite) => {
    repondu.current = false
    setFaux(false)
    setValeur('')
    setVersMontres(0)
    setScene(s => ({ ...s, enigme: true }))
    setVue('enigme')
    const attendue = new Promise<Issue>(r => {
      issue.current = i => {
        issue.current = null
        r(i)
      }
    })
    const ecrite = ecrire(moi, DIT.ecoute).catch(() => {})
    for (let i = 1; i <= v.enigme.vers.length; i++) {
      await attendre(moi, calme ? 0 : 650)
      // L'énigme a déjà son issue (`issue.current` rendu à null) : plus tard ou la langue au chat touchés pendant les
      // vers ne laissent pas les suivants paraître, puis la réplique s'écrire, avant que le Sphinx réponde.
      if (!issue.current) break
      setVersMontres(i)
    }
    if (issue.current) {
      await ecrite
      if (!repondu.current) await ecrire(moi, DIT.quiSuisJe(v.enigme.sorte, v.essaisRestants)).catch(() => {})
    }
    const fin = await attendue
    verifier(moi)
    if (fin.quoi === 'juste') return victoire(moi, fin.verdict)
    if (fin.quoi === 'plus-tard') return remettre(moi)
    return defaite(moi, fin)
  }

  /** Remise à plus tard depuis l'énigme : elle garde ses essais et ses réponses, et le Sphinx s'épingle jusqu'à minuit. */
  const remettre = async (moi: number) => {
    setScene(s => ({ ...s, enigme: false }))
    setVue('focus')
    await dire(moi, DIT.plusTardEnigme)
    await partir(moi)
    onPartir('epingle')
  }

  const victoire = async (moi: number, v: VerdictDuSphinx) => {
    const lui = v.visite
    await ecrire(moi, DIT.exact(laSolution(lui.enigme)))
    await attendre(moi, calme ? 300 : 700)
    const mot = lui.mot
    const apres = lui.phrase
    const nom = lui.divin.nom
    const neuf = v.motNeuf === true
    if (mot) {
      // Le mot naît là où était l'énigme, puis part se ranger dans la phrase.
      setMotVole(mot.texte)
      setVue('rien')
      const h = haut.current?.getBoundingClientRect()
      if (!calme && h) sable.current?.rafale(h.left + h.width / 2, h.top + h.height / 2, 60)
      vibrer([30, 40, 30])
      setScene(s => ({ ...s, enigme: false }))
      await ecrire(moi, DIT.voici(nom))
      await attendre(moi, calme ? 200 : 700)
      setPhrase(avantLeMot(apres, mot.index, neuf))
      setVue('focus')
      await attendre(moi, calme ? 50 : 500)
      const cible = racine.current?.querySelector(`.sx-focus .phrase-mot[data-i="${mot.index}"]`)?.getBoundingClientRect()
      const el = vole.current
      const depart = el?.getBoundingClientRect()
      if (!calme && el && cible && depart && typeof el.animate === 'function') {
        const vol = el.animate(
          [
            { translate: '0 0', scale: '1', opacity: 1 },
            {
              translate: `${cible.left + cible.width / 2 - (depart.left + depart.width / 2)}px ${cible.top + cible.height / 2 - (depart.top + depart.height / 2)}px`,
              scale: '0.5',
              opacity: 0.3,
            },
          ],
          { duration: 700, easing: 'cubic-bezier(.55,0,.25,1)', fill: 'forwards' },
        )
        await vol.finished.catch(() => {})
        verifier(moi)
        setMotVole(null)
        vol.cancel()
      } else setMotVole(null)
      setPhrase(apres)
      setRetourne(mot.index)
      for (let i = 0; i < [...mot.texte].length; i++) {
        sons.lettre()
        await attendre(moi, calme ? 0 : 120)
      }
      await attendre(moi, calme ? 0 : 250)
    } else {
      setScene(s => ({ ...s, enigme: false }))
      setPhrase(apres)
      setVue('focus')
    }
    const entiere = apres.reconstituee || (v.phrase !== null && v.phrase.divin.key !== apres.divin.key)
    if (entiere && apres.aDevoiler) {
      // Son mot était le dernier qui manquait à tous : la phrase ne s'impose pas (la décision du 24 novembre 2026). Le
      // Sphinx le dit, et lui laisse le choix — maintenant, ou plus tard dans l'album.
      await dire(moi, DIT.entiere(nom))
      const choix = await demander(moi, DIT.laLire, [
        ['lire', 'La lire'],
        ['plus-tard', 'Pas maintenant'],
      ])
      if (choix === 'lire') {
        try {
          const { phrase: toute } = await api.joueur.lirePhraseDuSphinx(lui.divin.key)
          verifier(moi)
          setPhrase(toute)
          // Ce qu'il ne savait pas se retourne, lettre à lettre, comme un mot gagné.
          setRetourne(placesDevoilees(apres, toute))
          await attendre(moi, calme ? 300 : 1600)
          await dire(moi, DIT.laVoici)
        } catch (e) {
          if (e instanceof Abandon) throw e
          await dire(moi, DIT.sansReseau((e as Error).message.replace(/[.\s]+$/, '')))
          await dire(moi, DIT.plusTardDansLAlbum)
        }
      } else await dire(moi, DIT.plusTardDansLAlbum)
    } else if (entiere) {
      await dire(moi, DIT.entiere(nom))
      await dire(moi, DIT.entiereAlbum)
    } else {
      if (mot) await dire(moi, neuf ? DIT.neuf : DIT.dejaTrouve)
      await dire(moi, DIT.autres(Math.max(0, apres.parTous - apres.siens)))
      await dire(moi, DIT.album)
    }
    await partir(moi)
    // Puis l'album, où sa phrase l'attend : la fiche du Divin s'y ouvre, son mot s'y retourne.
    retenirPourLAlbum({ divin: lui.divin.key, ...(mot && { mot: mot.index }) })
    onPartir('close')
    window.location.assign('/profil#collection-avatars-divin')
  }

  const defaite = async (moi: number, fin: Issue) => {
    setScene(s => ({ ...s, enigme: false }))
    setPhrase(fin.verdict.visite.phrase)
    setVue('focus')
    const solution = laSolution(fin.verdict.visite.enigme)
    await dire(moi, fin.quoi === 'abandon' ? DIT.chat(solution) : DIT.perdu(solution))
    await dire(moi, DIT.autreJour)
    await partir(moi)
    onPartir('close')
  }

  /** Une réponse envoyée : son verdict se dit tout de suite, même si le Sphinx parlait encore. */
  const repondre = async () => {
    const moi = tour.current
    const texte = valeur.trim()
    if (!texte || occupe.current || !issue.current) return
    occupe.current = true
    repondu.current = true
    // Le clavier se replie : la réaction du Sphinx, dans la boîte du bas, se lit.
    champ.current?.blur()
    try {
      const v = await envoyer(moi, 'repondre', texte)
      if (!v) return
      setFaux(false)
      if (v.verdict === 'juste') {
        sons.juste()
        issue.current?.({ quoi: 'juste', verdict: v })
      } else if (v.verdict === 'perdu') {
        sons.faux()
        vibrer(80)
        issue.current?.({ quoi: 'perdu', verdict: v })
      } else if (v.verdict === 'brulant') {
        sons.presque()
        await ecrire(moi, DIT.brule)
      } else if (v.dejaDite) {
        await ecrire(moi, DIT.dejaDite)
      } else {
        sons.faux()
        vibrer(80)
        requestAnimationFrame(() => setFaux(true))
        if (!calme) {
          setScene(s => ({ ...s, non: true }))
          window.setTimeout(() => setScene(s => ({ ...s, non: false })), 520)
        }
        setValeur('')
        await ecrire(moi, DIT.faux(v.visite.essaisRestants))
      }
    } catch (e) {
      if (!(e instanceof Abandon)) throw e
    } finally {
      occupe.current = false
    }
  }

  const langueAuChat = async () => {
    const moi = tour.current
    if (occupe.current || !issue.current) return
    occupe.current = true
    repondu.current = true
    sons.menu()
    try {
      const v = await envoyer(moi, 'chat')
      if (v) issue.current?.({ quoi: 'abandon', verdict: v })
    } catch (e) {
      if (!(e instanceof Abandon)) throw e
    } finally {
      occupe.current = false
    }
  }

  /** « Plus tard », l'énigme ouverte : écrit au serveur d'abord — un refus ou le réseau perdu se disent, et l'énigme reste. */
  const plusTard = async () => {
    const moi = tour.current
    if (occupe.current || !issue.current) return
    occupe.current = true
    repondu.current = true
    sons.menu()
    try {
      const v = await envoyer(moi, 'plus-tard')
      if (v) issue.current?.({ quoi: 'plus-tard', verdict: v })
    } catch (e) {
      if (!(e instanceof Abandon)) throw e
    } finally {
      occupe.current = false
    }
  }

  // Le scénario : joué une fois, à l'arrivée des données. La page démontée ou la visite fuie l'arrêtent.
  useEffect(() => {
    const moi = ++tour.current
    if (toileDuSable.current) sable.current = leSable(toileDuSable.current)
    const img = new Image()
    img.decoding = 'async'
    const chargee = new Promise<void>(r => {
      img.onload = () => r()
      img.onerror = () => r()
    })
    if (DECOUPE) img.src = DECOUPE
    image.current = img
    const jouer = async () => {
      if (erreur || !donnees?.visite) {
        // Les données ne sont pas venues : la boîte le dit, et propose de réessayer.
        setScene(s => ({ ...s, visite: true }))
        setBoite('la')
        const r = await demander(moi, DIT.sansReseau((erreur ?? 'Rien à te dire aujourd’hui').replace(/[.\s]+$/, '')), [
          ['oui', 'Réessayer'],
          ['non', 'Plus tard'],
        ])
        setBoite('part')
        setScene(s => ({ ...s, visite: false }))
        await attendre(moi, calme ? 0 : 400)
        if (r === 'oui') onReessayer()
        else onPartir(erreur ? 'epingle' : 'rien')
        return
      }
      const v = donnees.visite
      await chargee
      verifier(moi)
      // Remise à plus tard, ou déjà présentée aujourd'hui sur ce téléphone : il va droit à son énigme.
      const presente = v.etat === 'plus-tard' || dejaPresente(v.jour)
      await arriver(moi)
      if (presente) {
        setVue('focus')
        return proposer(moi, DIT.revoila)
      }
      await dire(moi, DIT.psst(prenom))
      await dire(moi, DIT.jeSuis)
      setVue('vitrine')
      for (let i = 1; i <= VOILES; i++) {
        await attendre(moi, calme ? 0 : 140)
        setVitrineLa(i)
        sons.lettre()
      }
      await dire(moi, DIT.divins)
      await dire(moi, DIT.rares)
      await dire(moi, DIT.exploit)
      setVue('focus')
      await dire(moi, DIT.moment(v.divin.nom))
      retenirLaPresentation(v.jour)
      return proposer(moi, DIT.proposer)
    }
    jouer().catch(e => {
      if (!(e instanceof Abandon)) throw e
    })
    return () => {
      tour.current++
      sable.current?.arreter()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Un toucher sur la scène, hors d'un bouton ou d'un champ : il finit la réplique qui s'écrit, sinon il passe à la suivante. */
  const surLaScene = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, form, a')) return
    if (finDeFrappe.current) fin.current?.finir()
    else toucher.current?.()
  }
  const auClavier = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, button, a')) return
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    if (finDeFrappe.current) fin.current?.finir()
    else toucher.current?.()
  }
  const basculerLeSon = () => {
    const allume = !son
    setSon(allume)
    sonAllume.current = allume
    retenirLeSon(allume)
    if (allume) {
      sons.ouvrir()
      sons.menu()
    }
  }

  const v = visite
  const moment = v?.divin.key ?? phrase?.divin.key ?? ''
  const classes = ['sx-scene']
  if (scene.visite) classes.push('sx-visite')
  if (scene.enigme) classes.push('sx-en-enigme')
  if (scene.non) classes.push('sx-non')
  if (scene.frisson) classes.push('sx-frisson')
  if (calme) classes.push('sx-calme')
  // Le menu ouvert : le cadre du haut lui laisse de l'air (sa feuille), et la mesure du voile le relit (`ajusterLeVoile`).
  if (menu) classes.push('sx-avec-menu')
  const autres = DIVINS.length - VOILES
  return (
    <div ref={racine} className={classes.join(' ')} role="dialog" aria-modal="true" aria-label="Le Sphinx te parle" tabIndex={-1} onClick={surLaScene} onKeyDown={auClavier}>
      <div className="sx-cadre">
        <div className="sx-voile" aria-hidden="true" />
        <canvas ref={toileDuSable} className="sx-sable" aria-hidden="true" />
        <div ref={haut} className="sx-haut">
          {moment && (
            <section className={'sx-vitrine' + (vue === 'vitrine' ? ' sx-montre' : '')} aria-label="Les Divins">
              <p className="sx-sourcil">Les Divins</p>
              <div className="sx-rangee">
                {voilesDeLaVitrine(moment).map((cle, i) => (
                  <figure key={cle} className={i < vitrineLa ? 'sx-la' : undefined}>
                    <Divin cle={cle} verrouille />
                    <figcaption>{nomDe(cle)}</figcaption>
                  </figure>
                ))}
              </div>
              <p className={'sx-bas' + (vitrineLa >= VOILES ? ' sx-la' : '')}>{`et ${enLettres(autres)} autres, tout aussi secrets`}</p>
            </section>
          )}
          {phrase && (
            <section className={'sx-focus' + (vue === 'focus' ? ' sx-montre' : '')} aria-label={`La phrase ${phrase.divin.nom ? deLui(phrase.divin.nom).replace(/\*/g, '') : ''}`}>
              <div className="sx-grand">
                <Divin cle={phrase.divin.key} verrouille />
              </div>
              <p className="sx-sourcil sx-moment">Le Divin du moment</p>
              <h2>{phrase.divin.nom}</h2>
              <PhraseDuDivin phrase={phrase} retourne={retourne} />
              <CompteDeLaPhrase phrase={phrase} />
            </section>
          )}
          {v && (
            <ParcheminDeLEnigme
              enigme={v.enigme}
              essaisRestants={v.essaisRestants}
              versMontres={versMontres}
              valeur={valeur}
              faux={faux}
              montre={vue === 'enigme'}
              onValeur={setValeur}
              onRepondre={() => void repondre()}
              onChat={() => void langueAuChat()}
              onPlusTard={() => void plusTard()}
              refChamp={champ}
            />
          )}
          <div ref={vole} className={'sx-mot-vole' + (motVole ? ' sx-montre' : '')} aria-hidden="true">
            {motVole}
          </div>
        </div>
        <div ref={leSphinx} className={'sx-sphinx' + (scene.glorieux ? ' sx-glorieux' : '')} aria-hidden="true">
          <span className="sx-rayons" />
          <canvas ref={toileDuSphinx} />
        </div>
        <div ref={eclair} className="sx-eclair" aria-hidden="true" />
        {/* Dans le cadre, avec le reste : tout frissonne ensemble, comme dans la maquette. */}
        <BoiteDuSphinx
          replique={replique}
          calme={calme}
          attend={attend}
          son={son}
          onSon={basculerLeSon}
          onFini={() => finDeFrappe.current?.()}
          fin={fin}
          bip={sons.bip}
          etat={boite}
          refBoite={refBoite}
        />
        {menu && (
          <div className="sx-choix" role="group" aria-label="Ta réponse au Sphinx">
            {menu.map(([valeur, libelle], i) => (
              <button
                key={valeur}
                ref={i === 0 ? premierChoix : undefined}
                type="button"
                className={i === vise ? 'sx-vise' : undefined}
                onPointerEnter={() => setVise(i)}
                onFocus={() => setVise(i)}
                onClick={() => {
                  sons.menu()
                  choix.current?.(valeur)
                }}
              >
                {espacesFines(libelle)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * La police pixel, demandée dès que la visite se prépare : sa feuille la
 * déclare, mais un navigateur ne la télécharge qu'à la première lettre qui
 * s'en sert — la boîte s'écrirait d'abord dans une autre police, puis
 * sauterait.
 */
function prechargerLaPolice(): void {
  try {
    void document.fonts?.load('500 1em "Pixelify Sans"').catch(() => {})
  } catch {
    // Pas d'API des polices : elle viendra avec la première lettre.
  }
}

/** Une autre fenêtre ouverte sur l'accueil — une feuille, la carte d'un joueur, un dialogue : le Sphinx attend qu'elle parte. */
const autreFenetre = () => !!document.querySelector('.carte-voile, .dialog-backdrop, [aria-modal="true"]:not(.sx-scene)')

/** Avant de surgir de lui-même, le temps qu'on voie l'accueil : la maquette le faisait paraître une seconde et demie après. */
const AVANT_DE_SURGIR_MS = 1400

/**
 * La visite du Sphinx : elle lit la visite du jour, attend que l'accueil soit
 * à lui — rien d'ouvert par-dessus, la page visible —, puis joue la scène.
 * `touchee` : ouverte d'un toucher sur l'épingle, elle surgit tout de suite.
 * Sans réseau, touchée, sa boîte le dit ; surgie d'elle-même, elle s'épingle
 * sans rien dire.
 */
export function VisiteDuSphinx({ prenom, touchee = false, onPartir }: { prenom: string; touchee?: boolean; onPartir: (issue: IssueDeLaVisite) => void }) {
  const [pret, setPret] = useState<{ n: number; donnees: SphinxOuvert | null; erreur: string | null } | null>(null)
  const [essai, setEssai] = useState(0)
  const partir = useRef(onPartir)
  partir.current = onPartir
  useEffect(() => {
    let vivant = true
    const debut = Date.now()
    prechargerLaPolice()
    const lire = api.joueur.sphinx().then(
      r => ({ donnees: 'fermee' in r && r.fermee ? null : (r as SphinxOuvert), erreur: null as string | null }),
      (e: unknown) => ({ donnees: null as SphinxOuvert | null, erreur: (e as Error).message ?? 'Pas de réseau' }),
    )
    const surgir = async () => {
      const lu = await lire
      if (!vivant) return
      // Rien à dire aujourd'hui — sa page fermée, la visite close d'ailleurs — : il ne vient pas.
      if (!lu.erreur && (!lu.donnees?.visite || !['proposee', 'plus-tard'].includes(lu.donnees.visite.etat))) return partir.current('rien')
      if (lu.erreur && !touchee && essai === 0) return partir.current('epingle')
      if (!touchee && essai === 0) {
        while (vivant && (Date.now() - debut < AVANT_DE_SURGIR_MS || autreFenetre() || document.visibilityState === 'hidden')) {
          await new Promise(r => window.setTimeout(r, 250))
        }
      }
      if (vivant) setPret({ n: essai, ...lu })
    }
    void surgir()
    return () => {
      vivant = false
    }
  }, [essai]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!pret || pret.n !== essai) return null
  return (
    <SceneDuSphinx
      key={pret.n}
      prenom={prenom}
      donnees={pret.donnees}
      erreur={pret.erreur}
      onReessayer={() => setEssai(n => n + 1)}
      onPartir={issue => partir.current(issue)}
    />
  )
}
