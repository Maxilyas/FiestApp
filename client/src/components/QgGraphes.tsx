import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { Icon } from './Icon'
import { formatNumber } from '../../../shared/typographie'
import { graduations, type EcartALHabitude, type ModeDuQg } from '../../../shared/qg'

/**
 * Les graphes du QG 2 (la proposition du 3 novembre 2026, sa maquette
 * `retours/2026-11-03/maquette-qg/graphes.js`), en SVG écrit à la main comme
 * ceux d'avant — pas une dépendance de plus : des barres d'une seule série ou
 * empilées par mode, la période d'avant en filet, une infobulle qui dit la
 * valeur d'abord, le seau survolé ou touché lu dessous, et les flèches du
 * clavier. Ils vivent dans l'écran nocturne du QG (`.qg`), où les couleurs des
 * modes ont été vérifiées.
 */

/** La largeur d'une boîte, suivie : le graphique se dessine au pixel près, ses textes à leur taille. */
export function useLargeur(defaut: number) {
  const boite = useRef<HTMLDivElement>(null)
  const [largeur, setLargeur] = useState(defaut)
  useEffect(() => {
    const el = boite.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const suivi = new ResizeObserver(([e]) => {
      const l = Math.round(e.contentRect.width)
      if (l > 0) setLargeur(l)
    })
    suivi.observe(el)
    return () => suivi.disconnect()
  }, [])
  return [boite, largeur] as const
}

/** Une barre arrondie en haut — le bout de la donnée —, carrée sur sa base. */
export function barreArrondie(x: number, y: number, l: number, h: number): string {
  const r = Math.min(4, l / 2, h)
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + l - r}Q${x + l} ${y} ${x + l} ${y + r}V${y + h}Z`
}

/** Une série du graphique : ses valeurs seau par seau, et la classe qui la peint (`qg-joueurs`, `qg-mode-jour`). */
export interface SerieDuGraphe {
  cle: string
  nom: string
  valeurs: readonly number[]
  classe: string
}

const MARGE = { gauche: 40, droite: 6, haut: 14, bas: 24 }
/** Le filet du fond entre deux segments d'une pile : collées, deux couleurs voisines se fondaient. */
const ECART = 2

/** Ce qu'un seau compte, morceau par morceau, dans son infobulle : « quiz du jour 110 ». */
export interface MorceauDuSeau {
  nom: string
  valeur: number
}

/**
 * Des seaux de temps en barres : une série seule — les joueurs, qui ne
 * s'additionnent pas d'un mode à l'autre —, ou une pile — les participations,
 * mode par mode. `etiquettes` nomme chaque seau (l'infobulle, la lecture),
 * `axe` dit lesquels portent une date sous l'axe. `avant`, la période d'avant
 * seau par seau, se pose en filet discret par-dessus. Une série seule peut
 * dire de quoi elle est faite (`repartition`) : les joueurs de chaque mode,
 * dans l'infobulle, qui ne s'empilent pas. `lignes` : d'autres chiffres du
 * même seau, en traits pleins par-dessus les barres et sur la même échelle —
 * les joueurs de la semaine et du mois au-dessus de ceux du jour, que leur
 * écart dit fidèles ou non (le lot 6 du QG 2).
 */
export function GrapheDuTemps({
  etiquettes,
  axe,
  series,
  empile,
  avant,
  lignes,
  repartition,
  resume,
  nomDuTotal,
  dire,
  lire,
}: {
  etiquettes: readonly string[]
  /** L'étiquette sous l'axe d'un seau, ou null : quelques-unes, jamais toutes. */
  axe: (i: number, largeur: number) => string | null
  series: readonly SerieDuGraphe[]
  empile: boolean
  avant?: readonly number[] | null
  /** D'autres chiffres de chaque seau, en traits — leur classe peint le trait (`stroke`) et la clé de l'infobulle (`background`). */
  lignes?: readonly SerieDuGraphe[]
  /** Seau par seau, ce qu'une série seule compte de chaque sorte ; une pile le dit d'elle-même. */
  repartition?: readonly (readonly MorceauDuSeau[])[]
  /** Ce que dit le graphique à qui ne le voit pas. */
  resume: string
  /** Le nom du total, au singulier et au pluriel, pour la lecture : « joueur ». */
  nomDuTotal: string
  /** Un nombre de la lecture, à sa façon (« 1 280 ») ; d'office, `formatNumber`. */
  dire?: (n: number) => string
  /** Le total d'un seau en entier, unité comprise (« 188 ms », « 12,5 % ») : une mesure n'a pas de pluriel à accorder. */
  lire?: (n: number) => string
}) {
  const [boite, largeur] = useLargeur(640)
  const [choisi, setChoisi] = useState<number | null>(null)
  const n = etiquettes.length
  const ecrire = dire ?? formatNumber
  const hauteur = Math.round(Math.min(260, Math.max(170, largeur * 0.3)))
  const totaux = etiquettes.map((_, i) => (empile ? series.reduce((s, se) => s + (se.valeurs[i] ?? 0), 0) : (series[0]?.valeurs[i] ?? 0)))
  const crans = graduations(Math.max(1, ...totaux, ...(avant ?? []), ...(lignes ?? []).flatMap(l => l.valeurs)))
  const sommet = crans[crans.length - 1] || 1
  const utile = { l: Math.max(1, largeur - MARGE.gauche - MARGE.droite), h: hauteur - MARGE.haut - MARGE.bas }
  const pas = utile.l / Math.max(1, n)
  const barre = Math.min(24, Math.max(2, pas * 0.68))
  const y = (v: number) => MARGE.haut + utile.h - (v / sommet) * utile.h
  const xDe = (i: number) => MARGE.gauche + i * pas
  const lu = choisi !== null && choisi < n ? choisi : n - 1
  const pluriel = (k: number) => (lire ? lire(k) : `${ecrire(k)} ${nomDuTotal}${k > 1 ? 's' : ''}`)
  // Les morceaux d'un seau, de bas en haut : ceux de la pile, ou la répartition d'une série seule.
  const morceaux = (i: number): MorceauDuSeau[] =>
    (empile ? series.map(se => ({ nom: se.nom, valeur: se.valeurs[i] ?? 0 })) : [...(repartition?.[i] ?? [])]).filter(m => m.valeur > 0)
  const detailDe = (i: number) =>
    morceaux(i)
      .map(m => `${m.nom.toLowerCase()} ${ecrire(m.valeur)}`)
      .join(', ')
  const clavier = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      setChoisi(Math.max(0, Math.min(n - 1, (choisi ?? n - 1) + (e.key === 'ArrowRight' ? 1 : -1))))
    } else if (e.key === 'Escape') setChoisi(null)
  }
  // La période d'avant, seau pour seau depuis son début : une semaine qui enjambe le changement d'heure a un seau de
  // trois heures de plus ou de moins (le 25 octobre 2026 a vingt-cinq heures), et le filet s'arrête au plus court.
  const cheminAvant =
    avant && avant.length > 1
      ? avant
          .slice(0, n)
          .map((v, i) => `${i ? 'L' : 'M'}${(xDe(i) + pas / 2).toFixed(1)} ${y(v).toFixed(1)}`)
          .join('')
      : null
  // Les traits, du milieu d'un seau au milieu du suivant.
  const cheminDe = (valeurs: readonly number[]) =>
    valeurs
      .slice(0, n)
      .map((v, i) => `${i ? 'L' : 'M'}${(xDe(i) + pas / 2).toFixed(1)} ${y(v).toFixed(1)}`)
      .join('')
  const enTraits = (lignes ?? []).filter(l => l.valeurs.length > 0)
  const dansLesTraits = (i: number) => enTraits.map(l => `${ecrire(l.valeurs[i] ?? 0)} ${l.nom}`).join(' · ')
  // L'infobulle, à côté du seau, de l'autre côté passé le milieu : elle ne sort jamais de la boîte.
  const bulle =
    choisi === null
      ? null
      : {
          gauche: xDe(choisi) + pas / 2 > largeur / 2 ? undefined : xDe(choisi) + pas + 8,
          droite: xDe(choisi) + pas / 2 > largeur / 2 ? largeur - xDe(choisi) + 8 : undefined,
        }
  return (
    <div ref={boite} className="qg-graphe" tabIndex={0} onKeyDown={clavier} onBlur={() => setChoisi(null)} aria-label={resume} role="group">
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} role="img" aria-label={resume} onPointerLeave={() => setChoisi(null)}>
        {choisi !== null && <rect className="qg-graphe-choisi" x={xDe(choisi)} y={MARGE.haut} width={pas} height={utile.h} rx={3} />}
        <g className="qg-graphe-grille">
          {crans.map(c => (
            <line key={c} x1={MARGE.gauche} x2={largeur - MARGE.droite} y1={y(c)} y2={y(c)} />
          ))}
        </g>
        <g className="qg-graphe-axe" textAnchor="end">
          {crans.map(c => (
            <text key={c} x={MARGE.gauche - 8} y={y(c) + 4}>
              {formatNumber(c)}
            </text>
          ))}
        </g>
        <g className="qg-graphe-axe" textAnchor="middle">
          {etiquettes.map((_, i) => {
            const t = axe(i, largeur)
            return t === null ? null : (
              <text key={i} x={Math.min(largeur - 24, Math.max(MARGE.gauche + 18, xDe(i) + pas / 2))} y={hauteur - 6}>
                {t}
              </text>
            )
          })}
        </g>
        {etiquettes.map((etiquette, i) => {
          const x = xDe(i) + (pas - barre) / 2
          const visibles = empile ? series.filter(se => (se.valeurs[i] ?? 0) > 0) : totaux[i] > 0 ? [series[0]] : []
          let base = y(0)
          const detail = detailDe(i)
          return (
            <g key={i}>
              <title>{`${etiquette} : ${pluriel(totaux[i])}${detail ? ` — ${detail}` : ''}${enTraits.length > 0 ? ` · ${dansLesTraits(i)}` : ''}`}</title>
              {visibles.map((se, k) => {
                const v = empile ? se.valeurs[i] : totaux[i]
                const h = (v / sommet) * utile.h
                const haut = base - h
                base = haut
                if (k === visibles.length - 1) return <path key={se.cle} className={se.classe} d={barreArrondie(x, haut, barre, h)} />
                const visible = Math.max(0, h - ECART)
                return <rect key={se.cle} className={se.classe} x={x} y={haut + h - visible} width={barre} height={visible} />
              })}
              {/* La cible du survol et du toucher : toute la hauteur, toute la largeur du seau. */}
              <rect className="qg-graphe-cible" x={xDe(i)} y={MARGE.haut} width={pas} height={utile.h} onPointerEnter={() => setChoisi(i)} onPointerDown={() => setChoisi(i)} />
            </g>
          )
        })}
        {cheminAvant && <path className="qg-avant" d={cheminAvant} />}
        {enTraits.map(l => (
          <path key={l.cle} className={`qg-graphe-trait ${l.classe}`} d={cheminDe(l.valeurs)} />
        ))}
      </svg>
      {bulle && choisi !== null && (
        <div className="qg-bulle" style={{ left: bulle.gauche, right: bulle.droite }} aria-hidden="true">
          <span className="qg-bulle-titre">{etiquettes[choisi]}</span>
          <span className="qg-bulle-ligne">
            {lire ? (
              <b className="num">{lire(totaux[choisi])}</b>
            ) : (
              <>
                <b className="num">{ecrire(totaux[choisi])}</b> {nomDuTotal}
                {totaux[choisi] > 1 ? 's' : ''}
              </>
            )}
          </span>
          {/* La pile se lit de haut en bas, chaque morceau à sa couleur ; une série seule, sans couleur : ses morceaux ne s'empilent pas. */}
          {empile
            ? series
                .filter(se => (se.valeurs[choisi] ?? 0) > 0)
                .reverse()
                .map(se => (
                  <span key={se.cle} className="qg-bulle-ligne">
                    <i className={`qg-bulle-cle ${se.classe}`} />
                    <b className="num">{ecrire(se.valeurs[choisi])}</b> {se.nom}
                  </span>
                ))
            : morceaux(choisi).map(m => (
                <span key={m.nom} className="qg-bulle-ligne qg-bulle-morceau">
                  <b className="num">{ecrire(m.valeur)}</b> {m.nom}
                </span>
              ))}
          {enTraits.map(l => (
            <span key={l.cle} className="qg-bulle-ligne">
              <i className={`qg-bulle-cle ${l.classe}`} />
              <b className="num">{ecrire(l.valeurs[choisi] ?? 0)}</b> {l.nom}
            </span>
          ))}
          {avant && avant[choisi] !== undefined && (
            <span className="qg-bulle-ligne qg-bulle-avant">
              <i className="qg-bulle-cle qg-bulle-cle-avant" />
              <b className="num">{ecrire(avant[choisi])}</b> la période d’avant
            </span>
          )}
        </div>
      )}
      <p className="qg-lecture" aria-live="polite">
        <span>{choisi === null ? `${etiquettes[lu] ?? ''} · ` : `${etiquettes[lu]} · `}</span>
        <b className="num">{pluriel(totaux[lu] ?? 0)}</b>
        {enTraits.length > 0 && <span className="muted"> · {dansLesTraits(lu)}</span>}
        {avant && avant[lu] !== undefined && <span className="muted"> · {ecrire(avant[lu])} la période d’avant</span>}
      </p>
    </div>
  )
}

/**
 * Une petite courbe : les seaux d'un chiffre, depuis zéro — une journée à
 * trois ne paraît pas une chute —, le dernier en point, qui reste rond quelle
 * que soit la largeur : un trait de longueur nulle, aux bouts ronds.
 */
export function Etincelle({ valeurs, classe }: { valeurs: readonly number[]; classe?: string }) {
  const max = Math.max(0, ...valeurs)
  const n = valeurs.length
  const points = valeurs.map((v, i) => [n > 1 ? (i / (n - 1)) * 100 : 100, max > 0 ? 28 - (v / max) * 24 : 28] as const)
  const [dx, dy] = points[n - 1] ?? [100, 28]
  const ligne = points.map(([x, py], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${py.toFixed(1)}`).join('')
  return (
    <svg className={'qg-etincelle' + (classe ? ` ${classe}` : '')} viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {n > 1 && <path className="qg-etincelle-aire" d={`${ligne}L100 32L0 32Z`} />}
      <path className="qg-etincelle-ligne" d={ligne} />
      <path className="qg-etincelle-point" d={`M${dx.toFixed(1)} ${dy.toFixed(1)}h0`} />
    </svg>
  )
}

/**
 * Une tuile : un chiffre, son écart à la période d'avant — dit aussi au
 * lecteur d'écran, la flèche ne se lisant pas —, sa courbe. `mode` pose sa
 * pastille et teinte sa courbe de la couleur du mode (`--teinte`), vérifiée
 * sur la nuit du QG ; `onOuvrir` en fait un bouton vers sa page.
 */
export function TuileDuQg({
  nom,
  valeur,
  ecart,
  etincelle,
  mode,
  detail,
  unite,
  onOuvrir,
}: {
  nom: string
  valeur: number | null | undefined
  ecart?: EcartALHabitude | null
  etincelle?: readonly number[]
  mode?: ModeDuQg
  detail?: ReactNode
  /** Ce qui suit le chiffre, collé à lui : « 23 % » — la fidélité des joueurs. */
  unite?: string
  onOuvrir?: () => void
}) {
  const teinte = mode ? ({ '--teinte': `var(--mode-${mode})` } as CSSProperties) : undefined
  const contenu = (
    <>
      <span className="qg-tuile-nom">
        {mode && <i className={`qg-tuile-cle qg-mode-${mode}`} aria-hidden="true" />}
        {nom}
      </span>
      <span className="qg-tuile-valeur num">{valeur == null ? '–' : `${formatNumber(valeur)}${unite ?? ''}`}</span>
      {(ecart || detail) && (
        <span className={'qg-ecart' + (ecart?.sens ? ` qg-ecart-${ecart.sens}` : '')}>
          {ecart?.sens && <Icon name={ecart.sens === 'plus' ? 'arrow-up' : 'arrow-down'} />}
          {ecart?.texte}
          {ecart?.suite && <span className="sr-only">{ecart.suite}</span>}
          {ecart && detail && <span aria-hidden="true"> · </span>}
          {detail}
        </span>
      )}
      {etincelle && etincelle.length > 1 && <Etincelle valeurs={etincelle} />}
    </>
  )
  return onOuvrir ? (
    <li className="qg-tuile qg-tuile-ouvre" style={teinte}>
      <button type="button" onClick={onOuvrir}>
        {contenu}
      </button>
    </li>
  ) : (
    <li className="qg-tuile" style={teinte}>
      {contenu}
    </li>
  )
}

/** Une case d'une carte de chaleur : sa part du plus haut, ce qu'on y lit, et ce qu'elle dit en entier. */
export interface CaseDeChaleur {
  /** De 0 à 1, sa part du plus haut : sa teinte. Null, rien à lire encore — une semaine pas finie. */
  part: number | null
  /** Ce qu'on lit dans la case, quand elle a la place : « 42 ». */
  texte?: string
  /** Ce qu'elle dit en entier, à la lecture dessous et au lecteur d'écran : « Semaine du 14 sept., 2 semaines après : 42 % ». */
  dit: string
}

/** Les six paliers de la teinte, du plus pâle au plus vif ; zéro, le cadre seul. */
export function palierDeChaleur(part: number): number {
  if (!(part > 0)) return 0
  return part <= 0.15 ? 1 : part <= 0.3 ? 2 : part <= 0.45 ? 3 : part <= 0.65 ? 4 : part <= 0.85 ? 5 : 6
}

// Chaque classe écrite en entier, jamais assemblée de son numéro : un nom assemblé couvrirait tout son préfixe, et la garde
// des classes mortes (S7, `design.test.ts`) ne verrait plus partir un palier.
const CLASSES_DES_PALIERS = ['qg-chaleur-p0', 'qg-chaleur-p1', 'qg-chaleur-p2', 'qg-chaleur-p3', 'qg-chaleur-p4', 'qg-chaleur-p5', 'qg-chaleur-p6'] as const

/**
 * Une carte de chaleur (le kit de la maquette, `graphes.js`, « la carte de
 * chaleur ») : un vrai tableau — ses en-têtes de ligne et de colonne, chaque
 * case son texte entier pour le lecteur d'écran —, une seule teinte, l'or des
 * joueurs, en six paliers d'opacité, et le texte de chaque case clair sur les
 * trois pâles, sombre sur les trois vifs : tous deux au-dessus de 4,5:1 sur la
 * console, vérifiés palier par palier (`.qg-chaleur-p1` à `p6`). Les flèches
 * parcourent les cases, la case choisie se lit dessous, comme un seau de
 * `GrapheDuTemps`. `compacte` : des cases sans texte — vingt-quatre heures par
 * rangée —, leur valeur dite à l'oreille et à la lecture seulement.
 */
export function CarteDeChaleur({
  resume,
  lignes,
  colonnes,
  cases,
  legende,
  compacte,
}: {
  resume: string
  /** `court`, ce que l'en-tête montre (« lun. », « +2 »), `nom` ce qu'il dit à l'oreille (« lundi », « 2 semaines après ») ; sans `court`, le nom se montre. */
  lignes: readonly { nom: string; court?: string; detail?: string }[]
  colonnes: readonly { nom: string; court?: string }[]
  cases: readonly (readonly CaseDeChaleur[])[]
  /** Ce que la teinte dit, du plus pâle au plus vif : « peu reviennent », « tous reviennent ». */
  legende: readonly [string, string]
  compacte?: boolean
}) {
  const [choisie, setChoisie] = useState<readonly [number, number] | null>(null)
  const nL = lignes.length
  const nC = colonnes.length
  const clavier = (e: KeyboardEvent<HTMLDivElement>) => {
    // La première flèche choisit la première case ; les suivantes s'y déplacent.
    const [i, j] = choisie ?? [0, 0]
    const pas = choisie ? 1 : 0
    const vers = (a: number, b: number) => {
      e.preventDefault()
      setChoisie([Math.max(0, Math.min(nL - 1, a)), Math.max(0, Math.min(nC - 1, b))])
    }
    if (e.key === 'ArrowRight') vers(i, j + pas)
    else if (e.key === 'ArrowLeft') vers(i, j - pas)
    else if (e.key === 'ArrowDown') vers(i + pas, j)
    else if (e.key === 'ArrowUp') vers(i - pas, j)
    else if (e.key === 'Home') vers(i, 0)
    else if (e.key === 'End') vers(i, nC - 1)
    else if (e.key === 'Escape') setChoisie(null)
  }
  const lue = choisie ? cases[choisie[0]]?.[choisie[1]] : undefined
  const enTete = (e: { nom: string; court?: string }) =>
    e.court === undefined ? (
      e.nom
    ) : (
      <>
        <span aria-hidden="true">{e.court}</span>
        <span className="sr-only">{e.nom}</span>
      </>
    )
  return (
    <div className={'qg-chaleur' + (compacte ? ' qg-chaleur-compacte' : '')}>
      <div
        className="qg-chaleur-cadre"
        tabIndex={0}
        role="group"
        aria-label={`${resume} — les flèches parcourent les cases`}
        onKeyDown={clavier}
        onBlur={() => setChoisie(null)}
        // Au doigt, la case touchée reste lue : le doigt levé « quitte » la carte aussitôt.
        onPointerLeave={e => e.pointerType === 'mouse' && setChoisie(null)}
      >
        <table>
          <caption className="sr-only">{resume}</caption>
          <thead>
            <tr>
              <td />
              {colonnes.map((c, j) => (
                <th key={j} scope="col">
                  {enTete(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={i}>
                <th scope="row">
                  {enTete(l)}
                  {l.detail && <small>{l.detail}</small>}
                </th>
                {(cases[i] ?? []).map((c, j) => {
                  const palier = c.part === null ? null : palierDeChaleur(c.part)
                  const ici = choisie !== null && choisie[0] === i && choisie[1] === j
                  return (
                    <td key={j} onPointerEnter={() => setChoisie([i, j])} onPointerDown={() => setChoisie([i, j])}>
                      <span className={`qg-chaleur-case ${palier === null ? 'qg-chaleur-vide' : CLASSES_DES_PALIERS[palier]}${ici ? ' qg-chaleur-choisie' : ''}`}>
                        {!compacte && c.texte && <span aria-hidden="true">{c.texte}</span>}
                        <span className="sr-only">{c.dit}</span>
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="qg-lecture" aria-live="polite">
        {lue ? lue.dit : <span className="muted">Touche ou survole une case ; au clavier, les flèches.</span>}
      </p>
      <div className="qg-chaleur-legende" aria-hidden="true">
        <span>{legende[0]}</span>
        <span className="qg-chaleur-rampe">
          {CLASSES_DES_PALIERS.slice(1).map(c => (
            <i key={c} className={c} />
          ))}
        </span>
        <span>{legende[1]}</span>
      </div>
    </div>
  )
}
