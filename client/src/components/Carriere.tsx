import { coupDOeilMoyen, type Fiche, type ReleveSoiree } from '../../../shared/profil'
import type { HautFaitVu } from '../../../shared/hautsfaits'
import { NOM_PALIER, hautFait } from '../../../shared/hautsfaits'
import { recompensesDe } from '../../../shared/proches'
import { LEGENDAIRES, progresVers } from '../../../shared/legendaires'
import { DIVINS, type DivinDescendu } from '../../../shared/divins'
import { NOM_RARETE } from '../../../shared/badges'
import { estimations, formatNumber, pourcent, secondes, surQcm } from '../format'
import { Chiffres, justesses, type Chiffre } from './Chiffres'

/**
 * La carrière d'un profil, telle que sa page la montre : ce qu'il a gagné,
 * et surtout ce qui vient. Rien ici ne change quoi que ce soit au jeu.
 */

/**
 * Ce qu'on lit d'un légendaire en le touchant dans la grille : son nom, sa
 * légende, et comment il se gagne — avec, s'il manque encore, où l'on en
 * est. On veut celui-là parce qu'on le voit. Gagné, il se porte d'ici.
 */
export function DetailLegendaire({
  cle,
  debloques,
  eclats,
  porte,
  hautsFaits,
  busy,
  onPorter,
}: {
  cle: string
  debloques: string[]
  /** Ce qui a éclaté pour lui : un légendaire éclaté se montre dans sa version rare. */
  eclats: string[]
  porte: string | null
  hautsFaits: HautFaitVu[]
  busy: boolean
  onPorter: (cle: string | null) => void
}) {
  const choisi = LEGENDAIRES.find(l => l.key === cle)
  if (!choisi) return null
  const gagne = debloques.includes(choisi.key)
  const hf = hautsFaits.find(h => h.key === choisi.condition.hautFait)
  const progres = progresVers(choisi, recompensesDe(hautsFaits))
  return (
    <div className="galerie-detail detail-case">
      <span className="detail-famille anneau-texte-legendaire">Légendaire</span>
      <b className="galerie-detail-nom">{choisi.nom}</b>
      <p className="serif-note">{choisi.legende}</p>
      {eclats.includes(choisi.key) && (
        <p className="small">Il a éclaté : c’est sa version rare, et personne d’autre ne l’a comme ça.</p>
      )}
      <p className="small">
        {/* Gagné avant que sa règle se durcisse : il le garde, mais la
            règle du jour ne dit pas comment il l'a eu. */}
        {gagne
          ? progres.acquis < progres.requis
            ? 'Gagné avant que sa règle se durcisse. Il se gagne aujourd’hui par '
            : 'Gagné par '
          : 'Se gagne par '}
        <b>{regleDe(choisi.condition, hautsFaits)}</b>
        {hf && hf.famille === 'soiree' && ` — ${hf.rule.charAt(0).toLowerCase()}${hf.rule.slice(1)}`}
        {!gagne && avancement(choisi.condition, hf, progres)}.
      </p>
      {!gagne && (
        <span className="jauge" aria-label={`${progres.acquis} sur ${progres.requis}`}>
          <span className="jauge-plein" style={{ width: `${(progres.acquis / progres.requis) * 100}%` }} />
        </span>
      )}
      {gagne && (
        <button
          type="button"
          className={'btn btn-small ' + (porte === choisi.key ? 'btn-ghost' : 'btn-primary')}
          disabled={busy}
          onClick={() => onPorter(porte === choisi.key ? null : choisi.key)}
        >
          {porte === choisi.key ? 'Revenir à mon emoji' : 'Le porter'}
        </button>
      )}
    </div>
  )
}

/**
 * Ce qu'on lit d'un Divin en le touchant : descendu, son nom et son récit,
 * et de quoi le porter ; sinon, rien — ni nom, ni jauge : la page n'en sait
 * pas plus que le joueur, et c'est voulu. Ce qui les fait descendre ne
 * quitte jamais le serveur (invariant 21).
 */
export function DetailDivin({
  cle,
  descendus,
  porte,
  busy,
  onPorter,
}: {
  cle: string
  descendus: DivinDescendu[]
  porte: string | null
  busy: boolean
  onPorter: (cle: string | null) => void
}) {
  const choisi = DIVINS.find(d => d.key === cle)
  if (!choisi) return null
  const recit = descendus.find(d => d.key === choisi.key)
  return (
    <div className="galerie-detail detail-case">
      <span className="detail-famille anneau-texte-divin">Divin</span>
      {recit ? (
        <>
          <b className="galerie-detail-nom">{choisi.nom}</b>
          <p className="serif-note">{recit.legende}</p>
          <button
            type="button"
            className={'btn btn-small ' + (porte === choisi.key ? 'btn-ghost' : 'btn-primary')}
            disabled={busy}
            onClick={() => onPorter(porte === choisi.key ? null : choisi.key)}
          >
            {porte === choisi.key ? 'Revenir à mon emoji' : 'Le porter'}
          </button>
        </>
      ) : (
        <>
          <b className="galerie-detail-nom">?</b>
          <p className="serif-note">Personne ne sait ce qui le fait descendre. Ceux qui l’ont vu ne le cherchaient pas.</p>
        </>
      )}
    </div>
  )
}

/**
 * Où l'on en est, dit comme on le compte : « (2 sur 3) » pour un haut fait à
 * regagner, « (4 sur 10 soirées jouées) » pour un palier de carrière.
 */
function avancement(
  condition: { hautFait: string; fois: number } | { hautFait: string; palier: number },
  hf: HautFaitVu | undefined,
  progres: { acquis: number; requis: number },
): string {
  if ('palier' in condition) {
    const h = hautFait(condition.hautFait)
    if (!h || h.famille !== 'carriere' || !hf) return ''
    const seuil = h.paliers[condition.palier - 1]
    const valeur = hf.valeur ?? 0
    return ` (${formatNumber(Math.min(valeur, seuil))} sur ${formatNumber(seuil)} ${seuil < 2 ? h.mesureUne : h.mesure})`
  }
  return progres.requis > 1 ? ` (${progres.acquis} sur ${progres.requis})` : ''
}

/** « Le Grand Chelem », « L'Habitué · Argent », « Trois fois Seul contre tous ». */
function regleDe(
  condition: { hautFait: string; fois: number } | { hautFait: string; palier: number },
  hautsFaits: HautFaitVu[],
): string {
  const h = hautsFaits.find(x => x.key === condition.hautFait)
  const titre = h ? `${h.emoji} ${h.title}` : condition.hautFait
  if ('palier' in condition) return `${titre} · ${NOM_PALIER[condition.palier - 1]}`
  return condition.fois > 1 ? `${titre}, ${condition.fois} fois` : titre
}

/**
 * Le catalogue des hauts faits, tel que ce profil le voit : ceux de soirée
 * avec le nombre de fois, ceux de carrière avec leur palier et la jauge vers
 * le suivant. Ce qu'on n'a pas encore se montre aussi, estompé.
 */
export function HautsFaits({ hautsFaits }: { hautsFaits: HautFaitVu[] }) {
  const eclats = hautsFaits.filter(h => h.famille === 'soiree' && h.ton === 'eclat')
  const ombres = hautsFaits.filter(h => h.famille === 'soiree' && h.ton === 'ombre')
  const carriere = hautsFaits.filter(h => h.famille === 'carriere')
  // Combien on en a : le titre de la section le dit déjà.
  return (
    <>
      <p className="muted small">
        Ils se décernent à la fin de chaque soirée, et certains débloquent un avatar légendaire.
      </p>
      <h4 className="hf-groupe">Exploits</h4>
      <ul className="hf-liste">{eclats.map(h => <LigneSoiree key={h.key} h={h} />)}</ul>
      <h4 className="hf-groupe">Coups du sort</h4>
      <ul className="hf-liste">{ombres.map(h => <LigneSoiree key={h.key} h={h} />)}</ul>
      <h4 className="hf-groupe">Carrière</h4>
      <ul className="hf-liste">
        {carriere.map(h => {
          const valeur = h.valeur ?? 0
          const prochain = h.prochain ?? null
          return (
            <li key={h.key} className={'hf' + (h.fois > 0 ? ' gagne' : '')}>
              <span className="hf-emoji" aria-hidden="true">
                {h.emoji}
              </span>
              <span className="hf-corps">
                <span className="hf-titre">
                  {h.title}
                  {h.fois > 0 && <span className={`palier palier-${h.fois}`}>{NOM_PALIER[h.fois - 1]}</span>}
                </span>
                <span className="muted small">
                  {/* Le niveau s'écrit devant son chiffre ; le reste, derrière — au
                      singulier sous deux, comme on le dit. */}
                  {h.key === 'hf:legende'
                    ? `Niveau ${valeur}${prochain !== null ? ` · prochain palier au niveau ${prochain}` : ' · au sommet'}`
                    : `${formatNumber(valeur)} ${valeur < 2 ? (h.ruleUne ?? h.rule) : h.rule}${
                        prochain !== null ? ` · prochain palier à ${formatNumber(prochain)}` : ' · au sommet'
                      }`}
                </span>
                {prochain !== null && (
                  <span className="jauge">
                    <span className="jauge-plein" style={{ width: `${Math.min(100, (valeur / prochain) * 100)}%` }} />
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function LigneSoiree({ h }: { h: HautFaitVu }) {
  return (
    <li className={'hf' + (h.fois > 0 ? ' gagne' : '') + ` hf-${h.ton}`}>
      <span className="hf-emoji" aria-hidden="true">
        {h.emoji}
      </span>
      <span className="hf-corps">
        <span className="hf-titre">
          {h.title}
          {h.fois > 1 && <span className="hf-fois">×{h.fois}</span>}
        </span>
        <span className="muted small">
          {h.rule}
          {h.rarete && ` · ${NOM_RARETE[h.rarete]}`}
        </span>
      </span>
    </li>
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
