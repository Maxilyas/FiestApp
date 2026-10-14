import { useState, type ReactNode } from 'react'
import { confirmDialog } from './Dialog'
import { Icon } from './Icon'
import { barreArrondie, useLargeur } from './QgVueDEnsemble'
import { formatNumber } from '../../../shared/typographie'
import { jourEnToutesLettres } from '../../../shared/jour'
import { ecartALHabitude, graduations, jourAbrege, type CompteDuJour } from '../../../shared/qg'

/**
 * Les pièces que partagent les pages des modes du QG — le quiz du jour, la
 * campagne, les duels, l'économie : un chiffre en tuile, et un chiffre jour
 * par jour en barres d'une seule série.
 */

/**
 * Un chiffre en tuile : son nom, sa valeur, ce qui l'explique — et, quand on
 * a de quoi comparer, son écart à la même heure des sept jours d'avant, comme
 * les tuiles de la vue d'ensemble.
 */
export function Chiffre({ nom, valeur, detail, compte }: { nom: string; valeur: string; detail?: ReactNode; compte?: CompteDuJour | null }) {
  const ecart = compte ? ecartALHabitude(compte) : null
  return (
    <li className="qg-tuile">
      <span className="qg-tuile-nom">{nom}</span>
      <span className="qg-tuile-valeur num">{valeur}</span>
      {ecart && (
        <span
          className={'qg-ecart' + (ecart.sens ? ` qg-ecart-${ecart.sens}` : '')}
          title={compte?.habituel != null ? `D’habitude à cette heure : ${formatNumber(compte.habituel)}` : undefined}
        >
          {ecart.sens && <Icon name={ecart.sens === 'plus' ? 'arrow-up' : 'arrow-down'} />}
          {ecart.texte}
          {ecart.suite && <span className="sr-only">{ecart.suite}</span>}
        </span>
      )}
      {detail && <span className="qg-ecart qg-tuile-detail">{detail}</span>}
    </li>
  )
}

/** Une part en pour cent, « – » quand rien ne la fonde. */
export const enPourcentsEcrits = (n: number | null) => (n === null ? '–' : `${formatNumber(n)} %`)

/**
 * « Masquer » d'un classement — celui du mois du quiz du jour, celui des
 * duels : un seul masque pour les deux, une seule confirmation. Elle parle
 * du profil, jamais de la personne : un prénom ne dit pas qui l'on est. Et
 * elle dit où il se lève : on le cherchait sans le trouver (le 14 octobre 2026).
 */
export function confirmerLeMasque(nom: string): Promise<boolean> {
  return confirmDialog({
    title: `Masquer ${nom} du classement ?`,
    message:
      'Le profil ne paraîtra plus aux classements du quiz du jour et des duels, ni sur les podiums et les lauriers, et on ne pourra plus le défier. Personne ne l’en avertit : sur son téléphone, sa ligne reste. Il se remet au classement d’un geste, depuis sa fiche ou la liste des profils masqués.',
    confirmLabel: 'Masquer',
  })
}

const MARGE = { gauche: 36, droite: 4, haut: 20, bas: 24 }
const MARGE_PETITE = { gauche: 2, droite: 2, haut: 16, bas: 4 }

/**
 * Un chiffre jour par jour, en barres d'une seule série, dans l'écran
 * nocturne des graphiques du QG (`.qg-ecran`) : la couleur de son mode,
 * vérifiée sur ce fond-là (`MODES_DU_QG`). Le jour survolé — touché au
 * téléphone, où il n'y a pas d'infobulle — se dit dessous, aujourd'hui
 * sinon ; chaque barre a la sienne. `petit` : les petits multiples d'une
 * page, sans graduations ni dates.
 */
export function GrapheDesJours({
  jours,
  valeurs,
  classe,
  dire,
  titre,
  petit = false,
}: {
  /** Les jours de Paris, le plus ancien d'abord, aujourd'hui en dernier. */
  jours: readonly string[]
  valeurs: readonly number[]
  /** La couleur de la série : `qg-mode-jour`, `qg-mode-campagne`… */
  classe: string
  /** Un nombre en mots : « 118 joueurs ». */
  dire: (n: number) => string
  /** Ce que le graphique montre, pour le lecteur d'écran. */
  titre: string
  petit?: boolean
}) {
  const [choisi, choisir] = useState<number | null>(null)
  const [boite, largeur] = useLargeur(petit ? 240 : 640)
  const marge = petit ? MARGE_PETITE : MARGE
  const hauteur = petit ? 64 : Math.round(Math.min(220, Math.max(140, largeur * 0.26)))
  const n = jours.length
  const crans = graduations(Math.max(0, ...valeurs))
  const sommet = (petit ? Math.max(1, ...valeurs) : crans[crans.length - 1]) || 1
  const utile = { l: Math.max(1, largeur - marge.gauche - marge.droite), h: hauteur - marge.haut - marge.bas }
  const pas = utile.l / Math.max(1, n)
  const barre = Math.min(24, Math.max(2, pas * 0.66))
  const y = (v: number) => marge.haut + utile.h - (v / sommet) * utile.h
  const xDe = (i: number) => marge.gauche + i * pas
  const lu = choisi ?? n - 1
  // Au téléphone, trois dates sous l'axe ; à l'ordinateur, une par semaine, comptée depuis aujourd'hui.
  const etiquettes = petit ? [] : largeur < 480 ? [0, Math.floor((n - 1) / 2), n - 1] : jours.map((_, i) => i).filter(i => (n - 1 - i) % 7 === 0)
  const ancre = (i: number) => (i >= n - 2 ? 'end' : i <= 1 ? 'start' : 'middle')
  const xTexte = (i: number) => (ancre(i) === 'end' ? xDe(i) + pas : ancre(i) === 'start' ? xDe(i) : xDe(i) + pas / 2)
  if (n === 0) return null
  const resume = `${titre}, du ${jourEnToutesLettres(jours[0], true)} à aujourd’hui : de ${dire(Math.min(...valeurs))} à ${dire(Math.max(...valeurs))} par jour, ${dire(valeurs[n - 1])} aujourd’hui.`
  return (
    <div className="qg-jours">
      <div ref={boite} className="qg-graphe">
        <svg viewBox={`0 0 ${largeur} ${hauteur}`} role="img" aria-label={resume} onPointerLeave={() => choisir(null)}>
          {choisi !== null && <rect className="qg-graphe-choisi" x={xDe(choisi)} y={marge.haut} width={pas} height={utile.h} rx={4} />}
          {!petit && (
            <>
              <g className="qg-graphe-grille">
                {crans.map(c => (
                  <line key={c} x1={marge.gauche} x2={largeur - marge.droite} y1={y(c)} y2={y(c)} />
                ))}
              </g>
              <g className="qg-graphe-axe" textAnchor="end">
                {crans.map(c => (
                  <text key={c} x={marge.gauche - 8} y={y(c) + 4}>
                    {formatNumber(c)}
                  </text>
                ))}
              </g>
              <g className="qg-graphe-axe">
                {etiquettes.map(i => (
                  <text key={i} x={xTexte(i)} y={hauteur - 6} textAnchor={ancre(i)}>
                    {i === n - 1 ? 'aujourd’hui' : jourAbrege(jours[i])}
                  </text>
                ))}
              </g>
            </>
          )}
          {petit && (
            <g className="qg-graphe-grille">
              <line x1={marge.gauche} x2={largeur - marge.droite} y1={y(0)} y2={y(0)} />
            </g>
          )}
          {jours.map((j, i) => {
            const v = valeurs[i] ?? 0
            const h = (v / sommet) * utile.h
            const x = xDe(i) + (pas - barre) / 2
            return (
              <g key={j}>
                <title>{`${jourEnToutesLettres(j)} : ${dire(v)}`}</title>
                {v > 0 && <path className={classe} d={barreArrondie(x, y(0) - h, barre, h)} />}
                {/* La cible du survol et du toucher : toute la hauteur, toute la largeur du jour. */}
                <rect className="qg-graphe-cible" x={xDe(i)} y={marge.haut} width={pas} height={utile.h} onPointerEnter={() => choisir(i)} onClick={() => choisir(i)} />
              </g>
            )
          })}
          <text className="qg-graphe-total" x={xTexte(lu)} y={Math.max(12, y(valeurs[lu] ?? 0) - 6)} textAnchor={ancre(lu)}>
            {formatNumber(valeurs[lu] ?? 0)}
          </text>
        </svg>
      </div>
      <p className="qg-legende-jour">
        {lu === n - 1 ? 'Aujourd’hui' : jourEnToutesLettres(jours[lu])} · {dire(valeurs[lu] ?? 0)}
      </p>
    </div>
  )
}
