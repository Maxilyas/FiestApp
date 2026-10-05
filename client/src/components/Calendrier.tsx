import { useState } from 'react'
import { JOURS_POUR_UNE_PAGE, PAGES } from '../../../shared/calendrier'
import { PAGES_PEINTES } from './calendrier-peint'

/**
 * Le Calendrier des Heures : douze enluminures, une par mois, dans l'esprit
 * des Très Riches Heures du duc de Berry. Chaque mois joué au moins vingt
 * jours au quiz du jour ouvre la sienne ; le champion du mois la reçoit
 * dorée. Les douze ouvrent le thème des Très Riches Heures.
 *
 * Une collection que tout le monde peut finir : elle se montre entière, ce
 * qu'on n'a pas en vélin éteint, avec son mois — on sait ce qu'on veut.
 * Les pages peintes viennent de `calendrier-peint.ts` ; tant qu'il n'y en
 * a pas, le mois s'écrit en lettres sur le vélin.
 */
export function PageDuCalendrier({
  mois,
  ouverte,
  doree,
  grande,
}: {
  mois: string
  ouverte: boolean
  doree?: boolean
  grande?: boolean
}) {
  const page = PAGES.find(p => p.mois === mois)
  if (!page) return null
  const peinte = PAGES_PEINTES[mois]
  const image = peinte && (doree ? peinte.doree : peinte.page)[grande ? 0 : 1]
  const classes = ['calendrier-page']
  if (!ouverte) classes.push('calendrier-page-verrou')
  if (ouverte && doree) classes.push('calendrier-page-doree')
  if (grande) classes.push('calendrier-page-grande')
  return (
    <span className={classes.join(' ')} role="img" aria-label={`${page.nom}${ouverte ? (doree ? ', page dorée' : '') : ', pas encore ouverte'} : ${page.scene}`}>
      {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <span className="calendrier-velin" aria-hidden="true" />}
      <span className="calendrier-mois" aria-hidden="true">
        {page.nom}
      </span>
    </span>
  )
}

/**
 * Le calendrier entier, pour la page du profil : les douze pages, et ce qui
 * manque au mois en cours. Toucher une page l'ouvre en grand, sous la grille.
 */
export function Calendrier({ pages, dorees, joursCeMois, moisEnCours }: { pages: string[]; dorees: string[]; joursCeMois: number; moisEnCours: string }) {
  const [choisie, setChoisie] = useState<string | null>(null)
  const page = PAGES.find(p => p.mois === choisie)
  const ouverteCeMois = pages.includes(moisEnCours)
  const nomCeMois = PAGES.find(p => p.mois === moisEnCours)?.nom.toLowerCase()
  return (
    <section className="calendrier" aria-labelledby="calendrier-titre">
      <div className="calendrier-tete">
        <h3 id="calendrier-titre">Le calendrier des Heures</h3>
        <span className="muted small">{`${pages.length} sur ${PAGES.length}`}</span>
      </div>
      <p className="muted small">
        {ouverteCeMois
          ? `La page ${nomCeMois ? `de ${nomCeMois} ` : ''}est à toi. Chaque mois joué ${JOURS_POUR_UNE_PAGE} jours ouvre la sienne ; le champion du mois la reçoit dorée.`
          : `${joursCeMois} jour${joursCeMois > 1 ? 's' : ''} sur ${JOURS_POUR_UNE_PAGE} ce mois-ci pour la page ${nomCeMois ? `de ${nomCeMois}` : 'du mois'}. Le champion du mois la reçoit dorée.`}
      </p>
      <div className="calendrier-grille">
        {PAGES.map(p => (
          <button
            key={p.mois}
            type="button"
            className="calendrier-case"
            aria-pressed={choisie === p.mois}
            onClick={() => setChoisie(choisie === p.mois ? null : p.mois)}
          >
            <PageDuCalendrier mois={p.mois} ouverte={pages.includes(p.mois)} doree={dorees.includes(p.mois)} />
          </button>
        ))}
      </div>
      {page && (
        <div className="calendrier-detail">
          <PageDuCalendrier mois={page.mois} ouverte={pages.includes(page.mois)} doree={dorees.includes(page.mois)} grande />
          <b>{page.nom}</b>
          <p className="serif-note">{page.scene}</p>
          <p className="muted small">
            {pages.includes(page.mois)
              ? dorees.includes(page.mois)
                ? 'Dorée : tu as été champion de ce mois.'
                : 'Ouverte. Champion de ce mois, elle se dore.'
              : `Elle s’ouvre en jouant ${JOURS_POUR_UNE_PAGE} jours au quiz du jour en ${page.nom.toLowerCase()}.`}
          </p>
        </div>
      )}
      {pages.length === PAGES.length && <p className="small calendrier-fini">Les douze pages : le thème des Très Riches Heures est à toi.</p>}
    </section>
  )
}

/** La page qu'une partie vient d'ouvrir, fêtée à sa fin. */
export function PageOuverte({ mois }: { mois: string }) {
  const page = PAGES.find(p => p.mois === mois)
  if (!page) return null
  return (
    <section className="card page-ouverte">
      <span className="label">Le calendrier des Heures</span>
      <PageDuCalendrier mois={mois} ouverte grande />
      <h2>{`La page ${/^[AEIOUÉ]/.test(page.nom) ? 'd’' : 'de '}${page.nom.toLowerCase()} est à toi`}</h2>
      <p className="serif-note">{page.scene}</p>
      <p className="muted small">Elle rejoint ton calendrier, sur ta page. Les douze ouvrent un thème qu’aucune boutique ne vend.</p>
    </section>
  )
}
