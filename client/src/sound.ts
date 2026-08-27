// Sons de jeu générés à la volée (WebAudio) : aucun fichier à héberger, aucune
// musique sous droits, et rien à charger — donc rien qui arrive en retard sur
// l'écran commun. Les sons ne sortent que sur l'écran commun : cinquante
// téléphones qui bipent en même temps, c'est une cacophonie, pas une ambiance.

let ctx: AudioContext | null = null
let muted = localStorage.getItem('quizz.muted') === '1'

/**
 * Les navigateurs interdisent de jouer un son avant une interaction. On crée
 * donc le contexte audio au premier clic de l'animateur (lancer un quiz…).
 */
export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume()
    return
  }
  const Ctor = window.AudioContext ?? (window as any).webkitAudioContext
  if (Ctor) ctx = new Ctor()
}

export function isMuted(): boolean {
  return muted
}

export function toggleMuted(): boolean {
  muted = !muted
  localStorage.setItem('quizz.muted', muted ? '1' : '0')
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
  if (!ctx || muted) return
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
