import { useState } from 'react'
import { coupDOeilMoyen, type Fiche, type SoireeJouee } from '../../../shared/profil'
import type { HautFaitVu } from '../../../shared/hautsfaits'
import { NOM_PALIER, clePalier, hautFait } from '../../../shared/hautsfaits'
import { LEGENDAIRES, progresVers } from '../../../shared/legendaires'
import { DIVINS, type DivinDescendu } from '../../../shared/divins'
import { NOM_RARETE } from '../../../shared/badges'
import { estimations, formatNumber, pourcent, secondes, surQcm } from '../format'
import { Legendaire } from './Legendaire'
import { Divin } from './Divin'
import { Chiffres, justesses, type Chiffre } from './Chiffres'

/**
 * La carrière d'un profil, telle que sa page la montre : ce qu'il a gagné,
 * et surtout ce qui vient. Rien ici ne change quoi que ce soit au jeu.
 */

/** Les récompenses rangées, reconstituées depuis le catalogue vu par le profil. */
function recompensesDe(hautsFaits: HautFaitVu[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const h of hautsFaits) {
    if (h.famille === 'soiree') {
      if (h.fois > 0) m.set(h.key, h.fois)
    } else {
      for (let p = 1; p <= h.fois; p++) m.set(clePalier(h.key, p), 1)
    }
  }
  return m
}

/**
 * La galerie des douze légendaires. Ceux qu'on a brillent et se portent d'un
 * geste ; les autres attendent en silhouette dorée, avec la jauge de ce qui
 * manque. Toucher un médaillon dit son histoire et comment le gagner : on
 * veut celui-là parce qu'on le voit.
 */
export function GalerieLegendaires({
  debloques,
  eclats,
  porte,
  hautsFaits,
  busy,
  onPorter,
}: {
  debloques: string[]
  /** Ce qui a éclaté pour lui : un légendaire éclaté se montre dans sa version rare. */
  eclats: string[]
  porte: string | null
  hautsFaits: HautFaitVu[]
  busy: boolean
  onPorter: (cle: string | null) => void
}) {
  const recompenses = recompensesDe(hautsFaits)
  const [detail, setDetail] = useState<string | null>(null)
  const choisi = LEGENDAIRES.find(l => l.key === detail) ?? null
  const hf = choisi ? hautsFaits.find(h => h.key === choisi.condition.hautFait) : undefined
  const progres = choisi ? progresVers(choisi, recompenses) : null
  return (
    <>
      <div className="galerie">
        {LEGENDAIRES.map(l => {
          const gagne = debloques.includes(l.key)
          const { acquis, requis } = progresVers(l, recompenses)
          return (
            <button
              key={l.key}
              type="button"
              className={
                'galerie-case' +
                (gagne ? '' : ' verrouille') +
                (porte === l.key ? ' porte' : '') +
                (detail === l.key ? ' ouverte' : '') +
                ` galerie-${l.ton}`
              }
              disabled={busy}
              aria-pressed={detail === l.key}
              onClick={() => setDetail(detail === l.key ? null : l.key)}
            >
              <span className="galerie-medaillon">
                <Legendaire cle={l.key} verrouille={!gagne} eclat={eclats.includes(l.key)} />
              </span>
              <span className="galerie-nom">{l.nom}</span>
              {gagne ? (
                <span className="muted small">{porte === l.key ? 'porté' : 'gagné'}</span>
              ) : (
                <span className="jauge" aria-label={`${acquis} sur ${requis}`}>
                  <span className="jauge-plein" style={{ width: `${(acquis / requis) * 100}%` }} />
                </span>
              )}
            </button>
          )
        })}
      </div>
      {choisi && progres && (
        <div className="galerie-detail">
          <b className="galerie-detail-nom">{choisi.nom}</b>
          <p className="serif-note">{choisi.legende}</p>
          {eclats.includes(choisi.key) && (
            <p className="small">Il a éclaté : c’est sa version rare, et personne d’autre ne l’a comme ça.</p>
          )}
          <p className="small">
            {/* Gagné avant que sa règle se durcisse : il le garde, mais la
                règle du jour ne dit pas comment il l'a eu. */}
            {debloques.includes(choisi.key)
              ? progres.acquis < progres.requis
                ? 'Gagné avant que sa règle se durcisse. Il se gagne aujourd’hui par '
                : 'Gagné par '
              : 'Se gagne par '}
            <b>{regleDe(choisi.condition, hautsFaits)}</b>
            {hf && hf.famille === 'soiree' && ` — ${hf.rule.charAt(0).toLowerCase()}${hf.rule.slice(1)}`}
            {!debloques.includes(choisi.key) && avancement(choisi.condition, hf, progres)}
            .
          </p>
          {debloques.includes(choisi.key) && (
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
      )}
    </>
  )
}

/**
 * La galerie des cinq Divins. Ceux qui sont descendus se portent comme un
 * légendaire, et racontent ce qu'il a fallu faire ; les autres restent
 * voilés — ni nom, ni silhouette, ni jauge : la page n'en sait pas plus que
 * le joueur, et c'est voulu. Ce qui les fait descendre ne quitte jamais le
 * serveur.
 */
export function GalerieDivins({
  descendus,
  porte,
  busy,
  onPorter,
}: {
  descendus: DivinDescendu[]
  porte: string | null
  busy: boolean
  onPorter: (cle: string | null) => void
}) {
  const [detail, setDetail] = useState<string | null>(null)
  const choisi = DIVINS.find(d => d.key === detail) ?? null
  const recit = (cle: string) => descendus.find(d => d.key === cle)
  const la = (cle: string) => !!recit(cle)
  return (
    <>
      <div className="galerie galerie-divine">
        {DIVINS.map(d => (
          <button
            key={d.key}
            type="button"
            className={
              'galerie-case' +
              (la(d.key) ? '' : ' verrouille') +
              (porte === d.key ? ' porte' : '') +
              (detail === d.key ? ' ouverte' : '')
            }
            disabled={busy}
            aria-pressed={detail === d.key}
            onClick={() => setDetail(detail === d.key ? null : d.key)}
          >
            <span className="galerie-medaillon">
              <Divin cle={d.key} verrouille={!la(d.key)} />
            </span>
            <span className="galerie-nom">{la(d.key) ? d.nom : '?'}</span>
            <span className="muted small">{la(d.key) ? (porte === d.key ? 'porté' : 'descendu') : 'inconnu'}</span>
          </button>
        ))}
      </div>
      {choisi && (
        <div className="galerie-detail">
          {la(choisi.key) ? (
            <>
              <b className="galerie-detail-nom">{choisi.nom}</b>
              <p className="serif-note">{recit(choisi.key)?.legende}</p>
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
            <p className="serif-note">Personne ne sait ce qui le fait descendre. Ceux qui l’ont vu ne le cherchaient pas.</p>
          )}
        </div>
      )}
    </>
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
        Ils se lisent à la clôture de chaque soirée, et certains débloquent un avatar légendaire.
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

/**
 * Les courbes : la précision, le coup d'œil et le réflexe, soirée après
 * soirée. Trois lignes sur les douze dernières soirées, la plus ancienne à
 * gauche — assez pour voir qu'on progresse, pas assez pour se perdre dans
 * les chiffres. Une soirée ne donne un point qu'à ce qu'elle a assez joué :
 * cinq QCM pour la précision et le réflexe, cinq estimations pour le coup
 * d'œil. Les deux justesses partagent l'échelle, de 0 à 100 % ; chacune a
 * sa marque — rond, carré —, le réflexe ses tirets : aucune ne se reconnaît
 * à la seule couleur.
 */
export function Courbes({ soirees }: { soirees: SoireeJouee[] }) {
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
    return <p className="muted small">Les courbes apparaissent dès deux soirées d’au moins cinq QCM ou cinq estimations.</p>
  }
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
      <svg viewBox={`0 0 ${l} ${h}`} role="img" aria-label="Précision, coup d’œil et réflexe, soirée après soirée">
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
        <span className="legende-oeil">Coup d’œil</span>
        <span className="legende-reflexe">Réflexe</span>
      </figcaption>
    </figure>
  )
}
