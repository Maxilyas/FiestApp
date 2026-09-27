// Sons de jeu générés à la volée (WebAudio) : aucun fichier à héberger, aucune
// musique sous droits, et rien à charger — donc rien qui arrive en retard sur
// l'écran commun. Les sons ne sortent que sur l'écran commun : cinquante
// téléphones qui bipent en même temps, c'est une cacophonie, pas une ambiance.

let ctx: AudioContext | null = null

const KEY = 'quizz.muted'

/**
 * Protégé, comme tout accès au stockage. Ce module est chargé par le
 * chronomètre, donc par la page de jeu des téléphones : un navigateur qui
 * refuse le stockage (cookies bloqués, navigateur intégré d'une messagerie)
 * levait ici une exception au chargement, et `/<espace>` restait entièrement
 * noire — pour un réglage qui ne sert que sur l'écran commun.
 */
function lireMuet(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

let muted = lireMuet()

/** La page a-t-elle déjà reçu un geste ? Inconnu d'un navigateur ancien : on ne présume rien. */
function hasBeenActive(): boolean {
  return (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive === true
}

/** Ceux qui veulent savoir quand le son devient possible : la pastille « Activer le son ». */
const abonnes = new Set<() => void>()
const prevenir = () => abonnes.forEach(f => f())

/**
 * Les navigateurs interdisent de jouer un son avant une interaction. On crée
 * donc le contexte audio au premier geste sur la page (`ouvrirAuPremierGeste`).
 */
export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume()
    return
  }
  const Ctor = window.AudioContext ?? (window as any).webkitAudioContext
  if (!Ctor) return
  ctx = new Ctor()
  ctx.onstatechange = prevenir
  prevenir()
}

/**
 * Le premier geste sur la page ouvre le son, où qu'il tombe.
 *
 * Le contexte ne naissait que de trois clics précis — « Lancer un quiz », un
 * écran de fin, le bouton des sons. Quand on anime à la télécommande, la télé
 * — celle qui doit sonner — ne voit jamais ces clics : ni 3-2-1, ni tic-tac,
 * ni fanfare, toute la soirée, sous l'icône « son allumé ». Écouté en
 * capture : un bouton qui arrête la propagation ne l'empêche pas.
 */
export function ouvrirAuPremierGeste(cible: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> = window): () => void {
  const ouvrir = () => initAudio()
  cible.addEventListener('pointerdown', ouvrir, true)
  cible.addEventListener('keydown', ouvrir, true)
  return () => {
    cible.removeEventListener('pointerdown', ouvrir, true)
    cible.removeEventListener('keydown', ouvrir, true)
  }
}

/** Le son peut-il sortir ? Faux tant que personne n'a touché la page : le navigateur ne joue rien avant. */
export function sonPret(): boolean {
  return ctx?.state === 'running'
}

/** Prévient quand le son devient possible (ou cesse de l'être). Rend de quoi se désabonner. */
export function surLeSon(abonne: () => void): () => void {
  abonnes.add(abonne)
  return () => abonnes.delete(abonne)
}

export function isMuted(): boolean {
  return muted
}

export function toggleMuted(): boolean {
  muted = !muted
  try {
    localStorage.setItem(KEY, muted ? '1' : '0')
  } catch {
    // Stockage indisponible : le choix vaut pour cette page, sans plus.
  }
  if (!muted) initAudio()
  return muted
}

interface ToneOptions {
  freq: number
  /** Secondes. */
  duration?: number
  type?: OscillatorType
  gain?: number
  /** Décalage en secondes avant de jouer. */
  delay?: number
  /** Glissando vers cette fréquence. */
  slideTo?: number
}

function tone({ freq, duration = 0.16, type = 'sine', gain = 0.2, delay = 0, slideTo }: ToneOptions) {
  if (muted) return
  // La page a déjà reçu un geste — le clic qui a connecté la télé, par
  // exemple — sans qu'aucun ne crée le contexte : le navigateur le laisse
  // maintenant sonner.
  if (!ctx && hasBeenActive()) initAudio()
  if (!ctx) return
  const start = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration)
  // Enveloppe : petite attaque puis extinction douce, sinon ça claque.
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.015)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(amp).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

const arpeggio = (freqs: number[], step = 0.09, options: Partial<ToneOptions> = {}) =>
  freqs.forEach((freq, i) => tone({ freq, delay: i * step, ...options }))

export const sound = {
  /** 3… 2… 1… : trois brèves montantes. */
  countdownTick: (remaining: number) =>
    tone({ freq: remaining <= 1 ? 660 : 440, duration: 0.12, type: 'triangle', gain: 0.18 }),
  /** Départ de la question. */
  go: () => arpeggio([523, 784], 0.08, { duration: 0.2, type: 'triangle', gain: 0.22 }),
  /** Dernières secondes : tic-tac discret qui monte en tension. */
  tick: () => tone({ freq: 1200, duration: 0.05, type: 'square', gain: 0.08 }),
  /** Révélation d'un QCM : accord majeur. */
  reveal: () => arpeggio([523, 659, 784], 0.07, { duration: 0.3, type: 'triangle', gain: 0.2 }),
  /** Révélation d'une estimation : montée vers la valeur cherchée. */
  target: () => tone({ freq: 330, slideTo: 880, duration: 0.5, type: 'triangle', gain: 0.2 }),
  /** Podium : petite fanfare. */
  fanfare: () => arpeggio([523, 659, 784, 1047], 0.13, { duration: 0.45, type: 'triangle', gain: 0.22 }),
}
