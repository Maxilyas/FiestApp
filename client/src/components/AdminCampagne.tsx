import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { quand } from '../format'
import { showToast } from '../state'
import { formatNumber } from '../../../shared/typographie'
import { SOUS_THEMES } from '../../../shared/etiquettes'
import type { AdminDeLaCampagne, AjoutsDeLaRoutine as Ajouts, SignalementDeCampagne } from '../../../shared/campagne'
import { BRANCHES } from '../../../shared/branches'
import { PALIERS, type AdminDesSentiers } from '../../../shared/sentiers'
import { texteDuMelangeCourt } from './melanges'

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
      <AdminSentiers />

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

/**
 * Les sentiers du savoir, palier par palier (`shared/sentiers.ts`) : la part
 * des joueurs qui valident du premier coup, les essais, les vies perdues
 * avant de valider — sur les trois derniers mois, rejeux exclus. Un palier
 * plus facile que celui d'avant se signale : c'est un mélange à revoir. Les
 * seuils se règlent dans le code, sur ces chiffres-là.
 */
function AdminSentiers() {
  const [branche, setBranche] = useState('')
  const [stats, setStats] = useState<AdminDesSentiers | null>(null)
  const [erreur, setErreur] = useState('')
  useEffect(() => {
    let vivant = true
    setErreur('')
    api.admin
      .sentiers(branche || undefined)
      .then(s => vivant && setStats(s))
      .catch(e => vivant && setErreur(motifDe(e)))
    return () => {
      vivant = false
    }
  }, [branche])
  const pc = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`)
  return (
    <section className="admin-groupe" aria-labelledby="campagne-sentiers-titre">
      <h2 className="compte-groupe" id="campagne-sentiers-titre">
        Les sentiers
      </h2>
      {erreur && <p className="error">{erreur}</p>}
      {stats && (
        <>
          <div className="sentiers-admin-tuiles">
            <span>
              <b>{formatNumber(stats.semaine.joueurs)}</b>
              {stats.semaine.joueurs > 1 ? 'joueurs' : 'joueur'}
            </span>
            <span>
              <b>{formatNumber(stats.semaine.epreuves)}</b>
              {stats.semaine.epreuves > 1 ? 'épreuves' : 'épreuve'}
            </span>
            <span>
              <b>{formatNumber(stats.semaine.viesAchetees)}</b>
              {stats.semaine.viesAchetees > 1 ? 'vies achetées' : 'vie achetée'}
            </span>
          </div>
          <p className="muted small">Ces sept derniers jours. Les paliers, eux, se lisent sur trois mois, sans les rejeux.</p>
        </>
      )}
      <label className="row">
        <span className="muted small">Sentier</span>
        <select className="team-emoji-select" value={branche} onChange={e => setBranche(e.target.value)}>
          <option value="">Tous les sentiers</option>
          {BRANCHES.map(b => (
            <option key={b.key} value={b.key}>
              {`${b.nom} · ${b.categorie}`}
            </option>
          ))}
        </select>
      </label>
      {stats && (
        <ol className="sentiers-admin-paliers">
          {stats.paliers.map((p, i) => {
            const regle = PALIERS[p.palier - 1]
            const avant = i > 0 ? stats.paliers[i - 1].premierEssai : null
            // Plus facile que le palier d'avant, sur assez d'essais pour le croire : à revoir.
            const remonte = !regle.maitre && p.premierEssai !== null && avant !== null && p.essais >= 10 && p.premierEssai > avant
            return (
              <li key={p.palier} className={'sentiers-admin-ligne' + (remonte ? ' sentiers-admin-alerte' : '') + (regle.maitre ? ' sentiers-admin-maitre' : '')}>
                <b>{regle.maitre ? 'Maître' : `P${p.palier}`}</b>
                <span className="muted">{`${texteDuMelangeCourt(regle.melange)} · ${regle.seuil}/16`}</span>
                <b className="num">{pc(p.premierEssai)}</b>
                <span className="sentiers-admin-barre" aria-hidden="true">
                  <i style={{ width: `${Math.round((p.premierEssai ?? 0) * 100)}%` }} />
                </span>
                <span className="muted small sentiers-admin-infos">
                  {`${formatNumber(p.joueurs)} joueur${p.joueurs > 1 ? 's' : ''} · ${formatNumber(p.essais)} essai${p.essais > 1 ? 's' : ''}`}
                  {p.viesAvantDeValider !== null && ` · ${p.viesAvantDeValider.toFixed(1).replace('.', ',')} vie${p.viesAvantDeValider >= 2 ? 's' : ''} perdue${p.viesAvantDeValider >= 2 ? 's' : ''} avant de valider`}
                  {remonte && <span className="sentiers-admin-puce">{`plus facile que P${p.palier - 1}`}</span>}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
