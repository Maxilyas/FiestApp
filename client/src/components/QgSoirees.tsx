import { useEffect, useState, type ReactNode } from 'react'
import { api, motifDe } from '../api'
import { confirmDialog } from './Dialog'
import { Icon } from './Icon'
import { LigneDeSoiree } from './QgVueDEnsemble'
import { showToast } from '../state'
import { formatNumber } from '../../../shared/typographie'
import { jourDe } from '../../../shared/jour'
import {
  JOURS_DE_LA_SEMAINE,
  TRANCHES_DE_SALLE,
  dureeEcrite,
  jourAbrege,
  jourDeLaSemaine,
  type DirectDuQg,
  type PageDesSoirees,
  type SoireeDuQg,
} from '../../../shared/qg'

const soirees = (n: number) => `${formatNumber(n)} soirée${n > 1 ? 's' : ''}`

/** « sam. 10 oct. » : au téléphone, le tableau du mois tient sans défiler. */
const dateCourte = (instant: number) => `${JOURS_DE_LA_SEMAINE[jourDeLaSemaine(instant)].court} ${jourAbrege(jourDe(instant))}`

/**
 * Les soirées au QG (`/admin#soirees`) : celles qui se jouent, celles laissées
 * en plan — et le seul geste du QG sur la soirée d'un autre, la clore (le
 * choix du 13 octobre 2026) —, puis ce que les trente derniers jours en
 * disent. Des chiffres seulement : ni un quiz, ni un titre, ni un prénom
 * d'invité (`server/src/qg.ts`).
 */
export function QgSoirees({ direct, apresUnGeste }: { direct: DirectDuQg | null; apresUnGeste: () => void }) {
  const [page, setPage] = useState<PageDesSoirees | null>(null)
  const [error, setError] = useState('')
  const [enCours, setEnCours] = useState<string | null>(null)
  // Les soirées closes d'ici : le direct qui était déjà en route les montrerait
  // encore en plan jusqu'au relevé suivant. Une soirée suivante du même salon
  // a un autre début.
  const [closes, setCloses] = useState<ReadonlySet<string>>(new Set())
  const cle = (s: SoireeDuQg) => `${s.spaceId}|${s.depuis}`
  const charger = () => api.admin.soirees().then(setPage, e => setError(motifDe(e)))
  useEffect(() => {
    charger()
  }, [])

  const vivantes = direct?.soirees.filter(s => s.etat === 'en-cours') ?? []
  const enPlan = direct?.soirees.filter(s => s.etat === 'en-plan' && !closes.has(cle(s))) ?? []

  const clore = async (s: SoireeDuQg, maintenant: number) => {
    if (enCours) return
    // Le salon en tête du message, pas dans le titre : « Clore la soirée de « Le salon de Tom » ? » se lisait de travers.
    const ok = await confirmDialog({
      title: 'Clore cette soirée ?',
      message: `${s.salon.nom}, sans un geste depuis ${dureeEcrite(maintenant - s.dernierSigne)}. Elle se range dans l’historique, et ses invités sont crédités comme à une clôture ordinaire : expérience, podium, prix. Son animateur la retrouvera close.`,
      confirmLabel: 'Clore la soirée',
    })
    if (!ok) return
    setEnCours(s.spaceId)
    try {
      const { rangee } = await api.admin.cloreLaSoiree(s.spaceId)
      setCloses(c => new Set(c).add(cle(s)))
      showToast({ kind: 'info', message: rangee ? 'Soirée close — ses invités sont crédités' : 'Soirée close — rien n’y avait été joué' })
      apresUnGeste()
      charger()
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setEnCours(null)
    }
  }

  return (
    <>
      <p className="muted small">Les quiz, les questions et les prénoms des invités restent chez leur animateur : le QG n’en voit que les chiffres.</p>
      <section className="qg-carte" aria-labelledby="soirees-direct">
        <div className="qg-carte-tete">
          <h2 id="soirees-direct">En direct</h2>
          {vivantes.length > 0 && <span className="etiquette num">{vivantes.length}</span>}
        </div>
        {!direct ? (
          <p className="serif-note">Chargement…</p>
        ) : vivantes.length === 0 ? (
          <p className="muted small">Aucune soirée ne se joue en ce moment.</p>
        ) : (
          <ul className="qg-liste">
            {vivantes.map(s => (
              <LigneDeSoiree key={s.spaceId} s={s} maintenant={direct.maintenant} />
            ))}
          </ul>
        )}
      </section>

      {direct && enPlan.length > 0 && (
        <section className="qg-carte" aria-labelledby="soirees-en-plan">
          <div className="qg-carte-tete">
            <h2 id="soirees-en-plan">Laissées en plan</h2>
            <span className="etiquette num">{enPlan.length}</span>
          </div>
          <p className="muted small">
            Six heures sans un geste. La clore d’ici la range dans l’historique et crédite ses invités comme une clôture ordinaire :
            expérience, podium, prix.
          </p>
          <ul className="qg-liste">
            {enPlan.map(s => (
              <LigneDeSoiree key={s.spaceId} s={s} maintenant={direct.maintenant}>
                <button type="button" className="salon-geste" aria-disabled={enCours !== null || undefined} onClick={() => clore(s, direct.maintenant)}>
                  <Icon name="archive" />
                  {enCours === s.spaceId ? 'La soirée se clôt…' : 'Clore la soirée'}
                </button>
              </LigneDeSoiree>
            ))}
          </ul>
        </section>
      )}

      {error ? <p className="error">{error}</p> : !page ? <p className="serif-note">Chargement…</p> : <BilanDesSoireesDuQg page={page} />}
    </>
  )
}

/** Ce que les trente derniers jours disent des soirées, quand on joue et pour combien, puis l'historique du mois. */
export function BilanDesSoireesDuQg({ page }: { page: PageDesSoirees }) {
  const t = page.trenteJours
  const parSoiree = (n: number) => (t.soirees > 0 ? Math.round((n / t.soirees) * 10) / 10 : null)
  return (
    <>
      <section className="qg-jour" aria-labelledby="soirees-trente">
        <div className="qg-section-tete">
          <h2 className="compte-groupe" id="soirees-trente">
            Ces trente jours
          </h2>
          <span className="muted small">chaque soirée comptée au jour de sa première question</span>
        </div>
        <ul className="qg-tuiles qg-tuiles-quatre">
          <Chiffre nom="Soirées" valeur={t.soirees} detail={`${formatNumber(t.avant)} les trente jours d’avant`} />
          <Chiffre nom="Invités par soirée" valeur={t.invitesMediane} detail={`la médiane · ${formatNumber(t.invites)} participations`} />
          <Chiffre nom="Quiz par soirée" valeur={parSoiree(t.quiz)} detail={`${formatNumber(t.quiz)} quiz joués`} />
          <Chiffre nom="Questions jouées" valeur={t.questions} detail={t.soirees > 0 ? `${formatNumber(Math.round(t.questions / t.soirees))} par soirée` : undefined} />
        </ul>
      </section>

      <div className="qg-deux">
        <Barres
          id="soirees-semaine"
          titre="Quand on joue"
          sousTitre="les soirées par jour de la semaine, sur 90 jours"
          barres={JOURS_DE_LA_SEMAINE.map((j, i) => ({ nom: j.nom, court: j.court, n: page.parJourDeLaSemaine[i] ?? 0 }))}
        />
        <Barres
          id="soirees-taille"
          titre="La taille des salles"
          sousTitre="les soirées par nombre d’invités qui ont joué, sur 90 jours"
          barres={TRANCHES_DE_SALLE.map((tr, i) => ({ nom: tr.nom, court: tr.court, n: page.parTaille[i] ?? 0 }))}
        />
      </div>

      <section className="qg-carte" aria-labelledby="soirees-historique">
        <div className="qg-carte-tete">
          <h2 id="soirees-historique">L’historique du mois</h2>
          {page.historique.length > 0 && <span className="etiquette num">{page.historique.length}</span>}
        </div>
        {page.historique.length === 0 ? (
          <p className="muted small">Aucune soirée ces trente derniers jours.</p>
        ) : (
          <div className="qg-tableau">
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col" className="qg-tableau-texte">
                    Salon
                  </th>
                  <th scope="col">Invités</th>
                  <th scope="col">Quiz</th>
                  <th scope="col" className="qg-colonne-large">
                    Questions
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.historique.map(s => (
                  <tr key={`${s.spaceId}|${s.id}`}>
                    <th scope="row">{dateCourte(s.quand)}</th>
                    <td className="qg-tableau-texte">
                      {s.salon.nom}
                      {s.ouverte && <span className="muted"> · pas encore close</span>}
                    </td>
                    <td className="num">{formatNumber(s.invites)}</td>
                    <td className="num">{formatNumber(s.quiz)}</td>
                    <td className="num qg-colonne-large">{formatNumber(s.questions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function Chiffre({ nom, valeur, detail }: { nom: string; valeur: number | null; detail?: ReactNode }) {
  return (
    <li className="qg-tuile">
      <span className="qg-tuile-nom">{nom}</span>
      <span className="qg-tuile-valeur num">{valeur === null ? '–' : formatNumber(valeur)}</span>
      {detail && <span className="qg-ecart">{detail}</span>}
    </li>
  )
}

/**
 * Une rangée de barres d'une seule série, dans l'écran nocturne des
 * graphiques du QG (`.qg-ecran`) : l'or des soirées, vérifié sur ce fond-là.
 * Sa couleur ne dit rien de plus que sa hauteur — le chiffre au-dessus, le nom
 * dessous : au toucher, il n'y a pas d'infobulle —, et le lecteur d'écran lit
 * chaque barre en une phrase.
 */
function Barres({ id, titre, sousTitre, barres }: { id: string; titre: string; sousTitre: string; barres: { nom: string; court: string; n: number }[] }) {
  const max = Math.max(1, ...barres.map(b => b.n))
  return (
    <section className="qg-carte qg-ecran" aria-labelledby={id}>
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id={id}>{titre}</h2>
        <span className="muted small">{sousTitre}</span>
      </div>
      <ul className="qg-barres">
        {barres.map(b => (
          <li key={b.nom} className="qg-barre" title={`${b.nom} : ${soirees(b.n)}`}>
            <span className="qg-barre-zone" aria-hidden="true">
              <span className="qg-barre-n num">{formatNumber(b.n)}</span>
              {b.n > 0 && <span className="qg-barre-trait" style={{ height: `${(b.n / max) * 100}%` }} />}
            </span>
            <span className="qg-barre-nom" aria-hidden="true">
              {b.court}
            </span>
            <span className="sr-only">
              {b.nom} : {soirees(b.n)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
