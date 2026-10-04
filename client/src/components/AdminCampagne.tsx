import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { quand } from '../format'
import { showToast } from '../state'
import { formatNumber } from '../../../shared/typographie'
import { SOUS_THEMES } from '../../../shared/etiquettes'
import type { AdminDeLaCampagne, AjoutsDeLaRoutine as Ajouts, SignalementDeCampagne } from '../../../shared/campagne'

/** Le nom d'un sous-thème, lu dans le catalogue de l'étiquetage. */
const nomDuSousTheme = (categorie: string, cle: string) =>
  (SOUS_THEMES as Record<string, readonly { cle: string; nom: string }[]>)[categorie]?.find(s => s.cle === cle)?.nom ?? cle

/**
 * La campagne, côté administrateur (`/admin#campagne`) : sa base — combien
 * de questions, par catégorie —, et les questions que les joueurs signalent.
 * « Retirer » la sort de la campagne pour tous ; « Garder » referme les
 * signalements. Corriger une question se fait dans la base du dépôt
 * (`server/scripts/base-campagne.ts`) : elle revient alors sous un nouvel
 * identifiant.
 */
export function AdminCampagne() {
  const [etat, setEtat] = useState<AdminDeLaCampagne | null>(null)
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)

  const charger = () =>
    api.admin
      .campagne()
      .then(setEtat)
      .catch(e => setErreur(motifDe(e)))
  useEffect(() => {
    void charger()
  }, [])

  const faire = async (appel: () => Promise<unknown>, merci: string) => {
    setOccupe(true)
    try {
      await appel()
      showToast({ kind: 'info', message: merci })
      await charger()
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(false)
    }
  }

  if (erreur) return <p className="error">{erreur}</p>
  if (!etat) return <p className="serif-note">Chargement…</p>
  return (
    <>
      <section className="admin-groupe" aria-labelledby="campagne-base-titre">
        <h2 className="compte-groupe" id="campagne-base-titre">
          La base
        </h2>
        <p className="muted small">
          {formatNumber(etat.questions)} questions écrites et étiquetées d’avance, rien qu’à la campagne : {formatNumber(etat.jouables)} à jouer
          {etat.retirees > 0 && `, ${formatNumber(etat.retirees)} retirée${etat.retirees > 1 ? 's' : ''}`}. Celles que la réserve du quiz du jour
          contient aussi ne sortent pas ici.
        </p>
        <ul className="campagne-admin-categories">
          {etat.parCategorie.map(c => (
            <li key={c.categorie}>
              <span>{c.categorie}</span>
              <b className="num">{formatNumber(c.questions)}</b>
            </li>
          ))}
        </ul>
        {/* Par difficulté estimée, de 1 à 5 : ce que la routine rattrape chaque matin. */}
        <details className="campagne-admin-difficultes">
          <summary className="muted small">Par difficulté, de 1 (presque tout le monde) à 5 (un passionné)</summary>
          <table className="small">
            <thead>
              <tr>
                <th scope="col">Catégorie</th>
                {[1, 2, 3, 4, 5].map(d => (
                  <th key={d} scope="col" className="num">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {etat.parDifficulte.map(c => (
                <tr key={c.categorie}>
                  <th scope="row">{c.categorie}</th>
                  {c.difficultes.map((n, i) => (
                    <td key={i} className="num">
                      {formatNumber(n)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section className="admin-groupe" aria-labelledby="campagne-routine-titre">
        <h2 className="compte-groupe" id="campagne-routine-titre">
          La routine du matin
        </h2>
        <AjoutsDeLaRoutine ajouts={etat.ajouts} occupe={occupe} faire={faire} />
      </section>

      <section className="admin-groupe" aria-labelledby="campagne-signalements-titre">
        <h2 className="compte-groupe" id="campagne-signalements-titre">
          Signalements {etat.signalements.length > 0 && <span className="compte-rond">{etat.signalements.length}</span>}
        </h2>
        {etat.signalements.length === 0 && <p className="muted small">Aucun signalement à relire.</p>}
        {etat.signalements.map(s => (
          <Signalement key={s.questionId} s={s} occupe={occupe} faire={faire} />
        ))}
      </section>
    </>
  )
}

function Signalement({ s, occupe, faire }: { s: SignalementDeCampagne; occupe: boolean; faire: (appel: () => Promise<unknown>, merci: string) => Promise<void> }) {
  return (
    <div className="signalement">
      <p>
        <b>« {s.texte} »</b>{' '}
        <span className="muted">
          · {s.categorie} › {nomDuSousTheme(s.categorie, s.sousTheme)} · {quand(s.dernier)}
        </span>
      </p>
      <p className="muted small">
        {s.reponses.map((r, i) => (
          <span key={i} className={i === s.bonne ? 'catalogue-juste' : undefined}>
            {i > 0 && ' · '}
            {r}
          </span>
        ))}
      </p>
      {s.anecdote && <p className="muted small">{s.anecdote}</p>}
      <p className="muted small">
        {s.joueurs} joueur{s.joueurs > 1 ? 's' : ''} : {s.textes.map(t => `« ${t} »`).join(' · ')}
      </p>
      <div className="row">
        <button className="btn btn-small" disabled={occupe} onClick={() => void faire(() => api.admin.retirerDeLaCampagne(s.questionId), 'Retirée de la campagne')}>
          Retirer de la campagne
        </button>
        <button className="btn btn-small btn-ghost" disabled={occupe} onClick={() => void faire(() => api.admin.garderDeLaCampagne(s.questionId), 'Gardée')}>
          Garder
        </button>
      </div>
    </div>
  )
}

/**
 * Ce que la routine du matin a déposé dans la base (`/api/campagne/base`) :
 * de quoi voir qu'elle tourne, et relire ses dernières questions — c'est la
 * première fois qu'un humain les lit. « Retirer » les sort de la campagne
 * pour tous, comme une question signalée.
 */
function AjoutsDeLaRoutine({ ajouts, occupe, faire }: { ajouts: Ajouts; occupe: boolean; faire: (appel: () => Promise<unknown>, merci: string) => Promise<void> }) {
  if (ajouts.total === 0) {
    return (
      <p className="muted small">
        Rien de déposé pour l’instant. La routine de la réserve du quiz du jour agrandit aussi la base, chaque matin, une fois son étape « base de la
        campagne » ajoutée (MISE-EN-LIGNE.md, étape 8).
      </p>
    )
  }
  return (
    <>
      <p className="muted small">
        {formatNumber(ajouts.aujourdhui)} question{ajouts.aujourdhui > 1 ? 's' : ''} aujourd’hui · {formatNumber(ajouts.septJours)} ces sept derniers jours ·{' '}
        {formatNumber(ajouts.total)} en tout{ajouts.dernierLe !== null && <> · dernier dépôt {quand(ajouts.dernierLe)}</>}
      </p>
      <ul className="campagne-ajouts">
        {ajouts.derniers.map(a => (
          <li key={a.id} className={a.retiree ? 'campagne-ajout-retire' : undefined}>
            <p>
              <b>« {a.texte} »</b>{' '}
              <span className="muted">
                · {a.categorie} › {nomDuSousTheme(a.categorie, a.sousTheme)} · difficulté {a.difficulte} · {quand(a.ajouteeLe)}
              </span>
            </p>
            {a.retiree ? (
              <p className="muted small">Retirée de la campagne.</p>
            ) : (
              <button className="btn btn-small btn-ghost" disabled={occupe} onClick={() => void faire(() => api.admin.retirerDeLaCampagne(a.id), 'Retirée de la campagne')}>
                Retirer
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
