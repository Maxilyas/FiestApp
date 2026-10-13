import { coupDOeilMoyen, type Fiche, type ReleveSoiree } from '../../../shared/profil'
import { estimations, formatNumber, pourcent, secondes, surQcm } from '../format'
import { Chiffres, justesses, type Chiffre } from './Chiffres'

/**
 * La carrière d'un profil, telle que sa page la montre : ce qu'il a gagné,
 * et surtout ce qui vient. Rien ici ne change quoi que ce soit au jeu.
 */

/**
 * Ce qui a éclaté pour lui se garde ; il peut porter sa version rare ou sa
 * version d'origine, et changer d'avis. D'un toucher, comme une finition :
 * l'avatar, juste au-dessus dans sa case et dans sa fiche, change sous ses
 * yeux. Sans `onChoisir` — l'album de « Ma collection », qui ne fait que
 * montrer —, la phrase seule.
 */
export function ChoixDeLEclat({ brille, busy, onChoisir }: { brille: boolean; busy: boolean; onChoisir?: (brille: boolean) => void }) {
  return (
    <>
      <p className="small">
        {brille
          ? 'Il a éclaté : tu portes sa version rare, et personne d’autre ne l’a comme ça.'
          : 'Il a éclaté : sa version rare est à toi, et tu portes pour l’instant sa version d’origine.'}
      </p>
      {onChoisir && (
        <div className="choix-eclat" role="group" aria-label="Sa version">
          <button type="button" className="btn btn-small" aria-pressed={brille} aria-disabled={busy || undefined} onClick={() => !brille && onChoisir(true)}>
            Version rare
          </button>
          <button type="button" className="btn btn-small" aria-pressed={!brille} aria-disabled={busy || undefined} onClick={() => brille && onChoisir(false)}>
            Version d’origine
          </button>
        </div>
      )}
    </>
  )
}

/**
 * Les quatre chiffres qui disent l'essentiel d'une carrière : la justesse —
 * aux QCM comme aux estimations —, la vitesse, les victoires. Quatre, pour
 * tenir en deux rangs sur un téléphone et en un sur un écran ; la fidélité
 * se lit juste en dessous, au titre de « Mes soirées ».
 */
const ESSENTIELS = new Set(['Précision', 'Coup d’œil', 'Réflexe moyen', 'Quiz gagnés'])

/**
 * La fiche : les chiffres d'une carrière, lisibles d'un coup d'œil. Le profil
 * en montre l'essentiel, et le reste à qui le déplie : douze chiffres d'un
 * coup, c'était la moitié de la page.
 *
 * L'écart moyen des estimations n'y est plus : il mesurait la question plus
 * que le joueur — trois ans sur 1994 font 0,15 %, trois sur 54 en font 6 % —,
 * et une faute de frappe le triplait. Le coup d'œil le remplace.
 */
export function FicheCarriere({ fiche, partie }: { fiche: Fiche; partie?: 'essentiel' | 'reste' }) {
  const toutes: Chiffre[] = [
    ...justesses(fiche),
    ['Réflexe moyen', secondes(fiche.reflexeMoyenMs)],
    ['Record de vitesse', secondes(fiche.meilleurTempsMs)],
    ['Plus longue série', formatNumber(fiche.meilleureSerie)],
    ['Quiz gagnés', formatNumber(fiche.quizGagnes)],
    ['Podiums de quiz', formatNumber(fiche.podiumsQuiz)],
    ['Estimations exactes', formatNumber(fiche.estimationsExactes)],
    ['Flair', pourcent(fiche.flair)],
    ['Soirées', formatNumber(fiche.soirees)],
    ['Réponses', formatNumber(fiche.reponses)],
    ['Hôtes différents', formatNumber(fiche.hotes)],
  ]
  const cases = partie ? toutes.filter(([titre]) => ESSENTIELS.has(titre) === (partie === 'essentiel')) : toutes
  return (
    <>
      <Chiffres cases={cases} />
      {partie !== 'reste' && fiche.coupDOeil !== null && (
        <p className="muted small">Le coup d’œil : la part de la salle que tes estimations battent ou égalent, en moyenne.</p>
      )}
    </>
  )
}

/** La réussite par catégorie : « je suis nul en sport » devient un chiffre. */
export function Categories({ categories }: { categories: Record<string, { questions: number; justes: number }> }) {
  const lignes = Object.entries(categories)
    .filter(([, c]) => c.questions > 0)
    .sort((a, b) => b[1].justes / b[1].questions - a[1].justes / a[1].questions)
  if (lignes.length === 0) return null
  return (
    <ul className="categories">
      {lignes.map(([nom, c]) => (
        <li key={nom}>
          <span className="categorie-nom">{nom}</span>
          <span className="jauge">
            <span className="jauge-plein" style={{ width: `${(c.justes / c.questions) * 100}%` }} />
          </span>
          <span className="muted small num">
            {c.justes}/{c.questions}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * En dessous, un point de courbe dirait le hasard : 50 % sur deux QCM ne
 * raconte rien, et la courbe plongeait pour une soirée d'estimations.
 */
const MIN_PAR_POINT = 5

/** Ce qu'un point de courbe lit : une soirée jouée, ou un jour du quiz du jour. */
export interface PointJoue {
  releve: Pick<ReleveSoiree, 'qcm' | 'justes' | 'estimationsComparees' | 'coupDOeil' | 'tempsJustesMs'>
  at: number
}

/**
 * Les courbes : la précision, le coup d'œil et le réflexe, soirée après
 * soirée — ou jour après jour, au quiz du jour. Trois lignes sur les douze
 * dernières, la plus ancienne à gauche : assez pour voir qu'on progresse,
 * pas assez pour se perdre dans les chiffres. Un point ne vient qu'à ce qui
 * a assez joué : cinq QCM pour la précision et le réflexe, cinq estimations
 * pour le coup d'œil. Les deux justesses partagent l'échelle, de 0 à 100 % ;
 * chacune a sa marque — rond, carré —, le réflexe ses tirets : aucune ne se
 * reconnaît à la seule couleur. Sans estimation — le quiz du jour n'en pose
 * pas —, le coup d'œil ne se légende pas.
 */
export function Courbes({ soirees, unite = 'soiree' }: { soirees: readonly PointJoue[]; unite?: 'soiree' | 'jour' }) {
  const points = soirees
    .map(({ releve: r, at }) => {
      const assezDeQcm = r.qcm >= MIN_PAR_POINT
      return {
        quand: new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        qcm: r.qcm,
        justes: r.justes,
        comparees: r.estimationsComparees,
        precision: assezDeQcm ? r.justes / r.qcm : null,
        coupDOeil: r.estimationsComparees >= MIN_PAR_POINT ? coupDOeilMoyen(r) : null,
        reflexe: assezDeQcm && r.justes > 0 ? r.tempsJustesMs / r.justes : null,
      }
    })
    .filter(p => p.precision !== null || p.coupDOeil !== null)
    .slice(0, 12)
    .reverse()
  if (points.length < 2) {
    return (
      <p className="muted small">
        {unite === 'jour'
          ? 'Les courbes apparaissent dès deux jours joués.'
          : 'Les courbes apparaissent dès deux soirées d’au moins cinq QCM ou cinq estimations.'}
      </p>
    )
  }
  const avecOeil = points.some(p => p.coupDOeil !== null)
  const l = 300
  const h = 90
  const x = (i: number) => 10 + (i * (l - 20)) / (points.length - 1)
  const reflexes = points.flatMap(p => (p.reflexe === null ? [] : [p.reflexe]))
  const lent = Math.max(...reflexes, 1)
  const vif = Math.min(...reflexes, lent)
  const yPart = (p: number) => h - 10 - p * (h - 20)
  // Le réflexe se lit à l'envers : plus il est court, plus la courbe monte.
  const yReflexe = (ms: number) => (lent === vif ? h / 2 : 10 + ((ms - vif) / (lent - vif)) * (h - 20))
  const trace = (ys: (number | null)[]) =>
    ys
      .map((y, i) => (y === null ? null : `${x(i).toFixed(1)},${y.toFixed(1)}`))
      .filter(Boolean)
      .join(' ')
  return (
    <figure className="courbes">
      <svg
        viewBox={`0 0 ${l} ${h}`}
        role="img"
        aria-label={`${avecOeil ? 'Précision, coup d’œil et réflexe' : 'Précision et réflexe'}, ${unite === 'jour' ? 'jour après jour' : 'soirée après soirée'}`}
      >
        <line x1="10" x2={l - 10} y1={h - 10} y2={h - 10} className="courbe-axe" />
        <polyline className="courbe courbe-reflexe" points={trace(points.map(p => (p.reflexe === null ? null : yReflexe(p.reflexe))))} />
        <polyline className="courbe courbe-oeil" points={trace(points.map(p => (p.coupDOeil === null ? null : yPart(p.coupDOeil))))} />
        <polyline className="courbe courbe-precision" points={trace(points.map(p => (p.precision === null ? null : yPart(p.precision))))} />
        {points.map((p, i) =>
          p.coupDOeil === null ? null : (
            <rect key={`o${i}`} className="courbe-point courbe-point-oeil" x={x(i) - 3.4} y={yPart(p.coupDOeil) - 3.4} width="6.8" height="6.8">
              <title>{`${p.quand} · coup d’œil ${pourcent(p.coupDOeil)}, sur ${estimations(p.comparees)}`}</title>
            </rect>
          ),
        )}
        {points.map((p, i) =>
          p.precision === null ? null : (
            <circle key={`p${i}`} className="courbe-point courbe-point-precision" cx={x(i)} cy={yPart(p.precision)} r="3.8">
              <title>{`${p.quand} · précision ${pourcent(p.precision)}, ${surQcm(p.justes, p.qcm)}`}</title>
            </circle>
          ),
        )}
      </svg>
      <figcaption className="row courbes-legende">
        <span className="legende-precision">Précision</span>
        {avecOeil && <span className="legende-oeil">Coup d’œil</span>}
        <span className="legende-reflexe">Réflexe</span>
      </figcaption>
    </figure>
  )
}
