import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { Icon } from '../../../components/Icon'
import { espacesFines } from '../../../format'
import { toucher } from '../../../toucher'
import { etatDesTouches, type CouleurDUneLettre, type EssaiColore, type MotMontre, type MotRevele } from '../../../../../shared/cabinet/jeux/mot'
import { capitalesSansAccents } from '../../../../../shared/lettres'
import type { JeuALEcran, PropsDUneManche } from '../Partie'

// Le Mot mystère à l'écran (§ 3.3) : la réponse d'une question de la base, un
// mot de cinq à sept lettres, à trouver en cinq essais avec l'intitulé pour
// indice. La page ne connaît jamais le mot (invariant 1) : chaque essai part au
// serveur, qui rend ses couleurs — bien placée, ailleurs dans le mot, absente,
// les lettres doubles comptées comme au Wordle —, et le clavier se marque de ce
// que les essais ont appris (`etatDesTouches`, qui ne lit que les couleurs
// reçues). Une couleur ne dit jamais rien seule : un trait sous la lettre bien
// placée, un point sous celle qui est ailleurs, et chaque case le dit à
// l'oreille (« O, bien placée ») — la daltonienne ne distinguait pas le vert
// du jaune.
//
// Le clavier est à l'écran, en AZERTY, collé au bas de la page sous le pouce
// (`JeuALEcran.Pied`) : jamais le clavier du téléphone, qui aurait poussé
// « Valider » hors de l'écran ; celui de l'ordinateur sert aussi. Dès le
// deuxième essai, la ligne en cours revient au milieu de l'écran : sous la
// question et les essais d'avant, elle passait sous le clavier. Une lettre
// qu'Éclairer a soufflée prend sa case d'office, et le mot se tape comme on le
// lit : retapée à sa place, elle passe ; une autre lettre va à la case libre
// d'après — tapé en entier, « ABEILLE » au I soufflé faisait « ABEIILL ».
//
// La page ne tient que la ligne en cours : elle repart de zéro à chaque essai
// écrit, et se perd à un rechargement — rien de cela ne disait le mot (§ 2.8).
// À l'échéance, rien ne part : le serveur a déjà ses essais, et une ligne pas
// validée n'en est pas un.

/** Ce que la page tient d'une manche du Mot : les lettres tapées de la ligne en cours, case par case ; où en est la frappe ; et « Valider » touché trop tôt. */
export interface LocalDuMot {
  readonly cases: readonly (string | null)[]
  /**
   * La case où va la lettre suivante : tout ce qui est avant est tapé ou
   * soufflé. Les cases seules ne le disent pas — une soufflée retapée n'y
   * laisse rien, et sans lui, elle se serait retapée à chaque lettre.
   */
  readonly curseur: number
  /** « Valider » touché, la ligne incomplète : la page dit la longueur, jusqu'à la lettre suivante. */
  readonly dit: boolean
}

/** Le clavier de l'écran, en AZERTY : celui des téléphones d'ici, que les doigts trouvent sans chercher. */
export const AZERTY: readonly string[] = ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN']

/** Ce que dit chaque couleur, à l'oreille : la couleur ne le dit jamais seule. */
export const COULEURS_DITES: Readonly<Record<CouleurDUneLettre, string>> = { bien: 'bien placée', ailleurs: 'ailleurs dans le mot', absente: 'absente' }

/** La lettre qu'Éclairer a soufflée à cette place, s'il y en a une. */
const souffleeA = (m: MotMontre, i: number): string | undefined => m.soufflees.find(s => s.position === i)?.lettre

/** Les places de la ligne, de gauche à droite. */
const places = (m: MotMontre) => Array.from({ length: m.longueur }, (_, i) => i)

/**
 * La ligne en cours, case par case : la lettre soufflée à sa place, sinon ce
 * qu'il a tapé. Soufflée sur une case qu'il avait déjà tapée, elle l'emporte —
 * c'est la vraie lettre ; ce qu'il y avait mis ne compte plus.
 */
export function ligneEnCours(m: MotMontre, l: LocalDuMot): { lettre: string | null; soufflee: boolean }[] {
  return places(m).map(i => {
    const s = souffleeA(m, i)
    return s !== undefined ? { lettre: s, soufflee: true } : { lettre: l.cases[i] ?? null, soufflee: false }
  })
}

/**
 * Une lettre tapée. Sur une case soufflée, la même lettre passe — il tape le
 * mot comme il le lit ; une autre va à la case libre d'après, comme pour qui
 * ne tape que les cases libres. La ligne pleine, rien ne change. Les deux
 * frappes ne se démêlent pas quand la lettre libre d'après est celle de la
 * soufflée (le L d'ABEILLE) : elle passe, rien ne paraît, et le second L tapé
 * va à sa case.
 */
export function taper(m: MotMontre, l: LocalDuMot, lettre: string): LocalDuMot {
  if (souffleeA(m, l.curseur) === lettre) return { ...l, curseur: l.curseur + 1, dit: false }
  const i = places(m).find(k => k >= l.curseur && souffleeA(m, k) === undefined)
  if (i === undefined) return l
  return { cases: places(m).map(k => (k === i ? lettre : (l.cases[k] ?? null))), curseur: i + 1, dit: false }
}

/** « Effacer » : la dernière lettre tapée s'en va, et la frappe y revient ; une soufflée reste, elle n'est pas à lui. */
export function effacer(m: MotMontre, l: LocalDuMot): LocalDuMot {
  const i = [...places(m)].reverse().find(k => k < l.curseur && souffleeA(m, k) === undefined && !!l.cases[k])
  if (i === undefined) return l.curseur === 0 && !l.dit ? l : { ...l, curseur: 0, dit: false }
  return { cases: places(m).map(k => (k === i ? null : (l.cases[k] ?? null))), curseur: i, dit: false }
}

/** L'essai que la ligne fait, ou null tant qu'une case attend. */
export function essaiDe(m: MotMontre, l: LocalDuMot): string | null {
  const lettres = ligneEnCours(m, l).map(c => c.lettre)
  return lettres.every(x => x !== null) ? lettres.join('') : null
}

/** Une touche du clavier de l'ordinateur, lue comme le clavier de l'écran la tape : une capitale sans accent (« é » fait E), ou rien. */
export function lettreDuClavier(touche: string): string | null {
  const c = capitalesSansAccents(touche)
  return /^[A-Z]$/.test(c) ? c : null
}

/** Une case de la grille : sa lettre, sa couleur, et ce qu'elle dit à l'oreille. */
function Lettre({ lettre, couleur }: { lettre: string; couleur: CouleurDUneLettre }) {
  return (
    <span className={`cab-lettre cab-${couleur}`}>
      {lettre}
      <span className="sr-only">{`, ${COULEURS_DITES[couleur]}`}</span>
    </span>
  )
}

/** Un essai joué : ses lettres et leurs couleurs. */
function LigneJouee({ essai, rang }: { essai: EssaiColore; rang: number }) {
  return (
    <li className="cab-mot-ligne cab-mot-joue">
      <span className="sr-only">{`Essai ${rang + 1} : `}</span>
      {[...essai.lettres].map((x, i) => (
        <Lettre key={i} lettre={x} couleur={essai.couleurs[i] ?? 'absente'} />
      ))}
    </li>
  )
}

/**
 * La grille : un essai par ligne, autant de lignes que d'essais permis ; la
 * ligne en cours, s'il en a une, sous les essais joués ; les autres vides. La
 * largeur d'une case suit la longueur du mot (`--lettres`) : sept cases
 * tiennent dans un 360 × 640, cinq n'y sont pas minuscules.
 */
function GrilleDuMot({
  essais,
  lignes,
  longueur,
  enCours,
  refEnCours,
}: {
  essais: readonly EssaiColore[]
  lignes: number
  longueur: number
  enCours?: { lettre: string | null; soufflee: boolean }[]
  refEnCours?: RefObject<HTMLLIElement | null>
}) {
  return (
    <ol className="cab-mot-grille" style={{ '--lettres': longueur } as CSSProperties}>
      {Array.from({ length: lignes }, (_, i) => {
        const e = essais[i]
        if (e) return <LigneJouee key={i} essai={e} rang={i} />
        if (enCours && i === essais.length) {
          return (
            <li key={i} ref={refEnCours} className="cab-mot-ligne cab-mot-en-cours">
              <span className="sr-only">{`Essai ${i + 1}, à taper : `}</span>
              {enCours.map((c, k) =>
                c.soufflee ? (
                  <span key={k} className="cab-lettre cab-soufflee">
                    {c.lettre}
                    <span className="sr-only">, soufflée</span>
                  </span>
                ) : (
                  <span key={k} className={c.lettre ? 'cab-lettre cab-tapee' : 'cab-lettre'}>
                    {c.lettre}
                  </span>
                ),
              )}
            </li>
          )
        }
        return (
          <li key={i} className="cab-mot-ligne" aria-hidden="true">
            {Array.from({ length: longueur }, (_, k) => (
              <span key={k} className="cab-lettre" />
            ))}
          </li>
        )
      })}
    </ol>
  )
}

/** Ce que disent les marques, une fois, sous la question : un trait, un point, rien. */
function Legende() {
  return (
    <ul className="cab-legende" aria-hidden="true">
      {(['bien', 'ailleurs', 'absente'] as const).map(c => (
        <li key={c}>
          <span className={`cab-marque-${c}`} />
          {c === 'ailleurs' ? 'ailleurs' : COULEURS_DITES[c]}
        </li>
      ))}
    </ul>
  )
}

/** Le défilement doux, sauf à qui demande moins de mouvement. */
const doucement = (): ScrollBehavior => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  } catch {
    return 'auto'
  }
}

function MancheDuMot({ montree: m, local }: PropsDUneManche<MotMontre, LocalDuMot>) {
  const enCours = useRef<HTMLLIElement>(null)
  // Dès le deuxième essai, la ligne à taper revient au milieu de l'écran, au-dessus du clavier collé : sous la question et les
  // essais d'avant, elle passait dessous. Une image plus tard — le cadre remet un écran neuf en haut après les effets de ses
  // enfants, et la reprise d'une pause l'y aurait laissée.
  useEffect(() => {
    if (m.essais.length === 0) return
    const id = requestAnimationFrame(() => enCours.current?.scrollIntoView({ block: 'center', behavior: doucement() }))
    return () => cancelAnimationFrame(id)
  }, [m.essais.length])
  return (
    <>
      <div className="cab-tete-question">
        <span className="label quiz-categorie">{espacesFines(m.categorie ? `${m.categorie} · un mot de ${m.longueur} lettres` : `Un mot de ${m.longueur} lettres`)}</span>
      </div>
      <h2 className="quiz-question cab-question cab-question-du-mot">{espacesFines(m.texte)}</h2>
      <Legende />
      <GrilleDuMot essais={m.essais} lignes={m.essaisMax} longueur={m.longueur} enCours={ligneEnCours(m, local)} refEnCours={enCours} />
    </>
  )
}

/** Le clavier de l'ordinateur ne tape pas dans un champ, ni sous un dialogue ; « Entrée » sur un autre bouton est à ce bouton. */
function pourLeClavier(e: KeyboardEvent): 'tout' | 'sans-entree' | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return null
  if (document.querySelector('[aria-modal="true"]')) return null
  const cible = e.target instanceof Element ? e.target : null
  if (cible?.closest('input, textarea, select, [contenteditable="true"]')) return null
  if (cible?.closest('button, a') && !cible.closest('.cab-clavier')) return 'sans-entree'
  return 'tout'
}

/**
 * Le clavier collé au bas de l'écran : trois rangées de 44 px, « Effacer » et
 * « Valider » aux deux bouts de la dernière. Chaque touche au lever du doigt
 * (`toucher`) et sous la demi-seconde de garde (`garde`) — « Manche
 * suivante » était à la même place : le second toucher d'un double tapait une
 * lettre. Deux lettres de suite, elles, passent : « LL » se tape. « Valider »
 * attend la ligne pleine ; touché trop tôt, il dit la longueur, et rien ne part
 * au serveur.
 */
function ClavierDuMot({ montree: m, local, setLocal, envoyer, garde, busy }: PropsDUneManche<MotMontre, LocalDuMot>) {
  const touches = etatDesTouches(m.essais)
  // Ce que tient la ligne au moment du geste : deux touches entre deux rendus partaient de la même ligne, et la première se perdait.
  const ligne = useRef(local)
  ligne.current = local
  const poser = (l: LocalDuMot) => {
    ligne.current = l
    setLocal(l)
  }
  const agir = (quoi: string, auDoigt: boolean) => {
    if (busy || (auDoigt && !garde())) return
    if (quoi === 'effacer') return poser(effacer(m, ligne.current))
    if (quoi !== 'valider') return poser(taper(m, ligne.current, quoi))
    const essai = essaiDe(m, ligne.current)
    if (essai) envoyer({ quoi: 'essai', lettres: essai })
    else poser({ ...ligne.current, dit: true })
  }
  const agirMaintenant = useRef(agir)
  agirMaintenant.current = agir
  // Le clavier de l'ordinateur, le temps de la manche : une lettre, « Retour arrière », « Entrée ».
  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      const ici = pourLeClavier(e)
      if (!ici) return
      const quoi = lettreDuClavier(e.key) ?? (e.key === 'Backspace' ? 'effacer' : e.key === 'Enter' && ici === 'tout' ? 'valider' : null)
      if (!quoi) return
      e.preventDefault()
      agirMaintenant.current(quoi, false)
    }
    window.addEventListener('keydown', clavier)
    return () => window.removeEventListener('keydown', clavier)
  }, [])
  const complet = essaiDe(m, local) !== null
  return (
    <>
      {local.dit && !complet && (
        <p className="cab-raison cab-longueur" role="status">
          {`Il faut ${m.longueur} lettres`}
        </p>
      )}
      <div className="cab-clavier" role="group" aria-label="Le clavier">
        {AZERTY.map((rang, i) => (
          <div key={rang} className="cab-clavier-rang">
            {i === AZERTY.length - 1 && (
              <button type="button" className="cab-touche cab-touche-large" aria-label="Effacer la dernière lettre" aria-disabled={busy || undefined} {...toucher(() => agir('effacer', true))}>
                <Icon name="effacer" />
              </button>
            )}
            {[...rang].map(x => {
              const c = touches[x]
              return (
                <button key={x} type="button" className={c ? `cab-touche cab-${c}` : 'cab-touche'} aria-disabled={busy || undefined} {...toucher(() => agir(x, true))}>
                  {x}
                  {c && <span className="sr-only">{`, ${COULEURS_DITES[c]}`}</span>}
                </button>
              )
            })}
            {i === AZERTY.length - 1 && (
              <button type="button" className="cab-touche cab-touche-large cab-valider-le-mot" aria-disabled={!complet || busy || undefined} {...toucher(() => agir('valider', true))}>
                Valider
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

/**
 * La révélation : la question, ses essais colorés comme pendant la manche, et,
 * s'il ne l'a pas trouvé, le mot dans ses cases — le titre le dit déjà en
 * toutes lettres (« C'était « nuage » »), la grille le montre à côté des
 * siens. Laissée au temps sans un essai : rien à colorer, elle le dit.
 */
function RevelationDuMot({ corps: r }: { corps: MotRevele }) {
  return (
    <section className="cab-mot-revele" aria-label="Tes essais" style={{ '--lettres': r.lettres.length } as CSSProperties}>
      <p className="cab-ligne cab-rappel">{espacesFines(r.texte)}</p>
      {r.essais.length > 0 ? <GrilleDuMot essais={r.essais} lignes={r.essais.length} longueur={r.lettres.length} /> : <p className="cab-ligne cab-hors-carnet">Aucun essai</p>}
      {!r.trouve && (
        <p className="cab-mot-reponse">
          <span className="sr-only">{`Le mot : ${r.reponse}`}</span>
          {[...r.lettres].map((x, i) => (
            <span key={i} className="cab-lettre cab-revelee" aria-hidden="true">
              {x}
            </span>
          ))}
        </p>
      )}
    </section>
  )
}

export const MOT: JeuALEcran<MotMontre, MotRevele, LocalDuMot> = {
  localDe: m => ({ cases: Array.from({ length: m.longueur }, () => null), curseur: 0, dit: false }),
  // La ligne en cours repart de zéro à chaque essai écrit — elle est devenue une ligne de la grille — et à « Changer », qui pose
  // une autre question. Une lettre soufflée ne la change pas : ce qu'il avait tapé reste sous ses yeux.
  cleDe: m => `${m.texte}|${m.longueur}|${m.essais.length}`,
  aLEcheance: () => undefined,
  // Pas de `sousEcranDe` : une lettre tapée ne bouge rien sous le doigt, et chaque essai rend une vue neuve, que le cadre garde.
  Manche: MancheDuMot,
  Pied: ClavierDuMot,
  Revelation: RevelationDuMot,
}
