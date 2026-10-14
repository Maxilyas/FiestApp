import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { confirmDialog } from './Dialog'
import { Onglets } from './Onglets'
import { showToast } from '../state'
import { formatNumber } from '../../../shared/typographie'
import type { SignalementDeCampagne } from '../../../shared/campagne'
import {
  JOURS_DES_RELUS,
  SIGNALEMENTS_MONTRES_AU_QG,
  trierLesSignalements,
  type PageDesSignalements,
  type SignalementDuJour,
  type TriDesSignalements,
} from '../../../shared/qgSignalements'
import { CarteDeCampagne, CarteDuJour, ChiffresDesSignalements, ListeDesRelus } from './QgSignalements'

type Vue = 'relire' | 'relus'
type Source = 'tout' | 'jour' | 'campagne'

const SOURCES: { id: Source; nom: string }[] = [
  { id: 'tout', nom: 'Tout' },
  { id: 'jour', nom: 'Quiz du jour' },
  { id: 'campagne', nom: 'Campagne' },
]

/** Une question à relire, de l'un ou l'autre mode : elles se trient ensemble. */
type ARelire = { joueurs: number; dernier: number } & ({ source: 'jour'; s: SignalementDuJour } | { source: 'campagne'; s: SignalementDeCampagne })

/**
 * Les signalements au QG (`/admin#signalements`, le choix du 14 octobre
 * 2026 — « Est-ce que j'ai une page de monitoring pour les signalements,
 * me permettant de reclasser la question, la modifier, la supprimer ? ») :
 * ce que les joueurs signalent au quiz du jour et en campagne — sentiers,
 * parcours, défi de la semaine et duels compris —, réuni sur une page qui
 * remplace leurs sections d'avant, avec les mêmes gestes partout. Puis,
 * sous « Relues », ce qui a été fait des questions relues ces trente jours.
 * Chaque geste referme les signalements de sa question et dit ce qui en a
 * été fait ; le joueur dont la remarque a servi en est remercié sur son
 * accueil. Les pièces vivent dans `QgSignalements.tsx`.
 */
export function AdminSignalements({ apresUnGeste }: { apresUnGeste: () => void }) {
  const [page, setPage] = useState<PageDesSignalements | null>(null)
  const [erreur, setErreur] = useState('')
  const [vue, setVue] = useState<Vue>('relire')
  const [source, setSource] = useState<Source>('tout')
  const [tri, setTri] = useState<TriDesSignalements>('signalees')
  const [occupe, setOccupe] = useState(false)

  const charger = () =>
    api.admin.signalements().then(
      p => {
        setPage(p)
        setErreur('')
      },
      e => setErreur(motifDe(e)),
    )
  useEffect(() => {
    void charger()
  }, [])

  const faire = async (appel: () => Promise<unknown>, merci: string) => {
    setOccupe(true)
    try {
      await appel()
      showToast({ kind: 'info', message: merci })
      await charger()
      // Ce qui attend un geste, et la pastille de la barre de côté, suivent.
      apresUnGeste()
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(false)
    }
  }

  /** Annuler une question d'aujourd'hui pour tous : ses points repartent, rien ne la rend. */
  const annuler = async (s: SignalementDuJour) => {
    const ok = await confirmDialog({
      title: `Annuler la question ${s.index + 1} pour tous ?`,
      message:
        'Ses points s’effacent pour tous ceux qui l’ont jouée aujourd’hui, du classement du jour comme de celui du mois, et l’expérience de chacun suit. Elle reste dans le tirage, annulée : on ne peut pas revenir en arrière.',
      confirmLabel: 'Annuler ses points',
      danger: true,
    })
    if (ok) await faire(() => api.admin.annulerDuJour(s.jour, s.index), 'Points annulés pour tous')
  }

  if (erreur && !page) return <p className="error">{erreur}</p>
  const aRelire: ARelire[] = page
    ? [
        ...page.jour.map(s => ({ source: 'jour' as const, s, joueurs: s.joueurs, dernier: s.dernier })),
        ...page.campagne.map(s => ({ source: 'campagne' as const, s, joueurs: s.joueurs, dernier: s.dernier })),
      ]
    : []
  const deLaSource = <T extends { source: 'jour' | 'campagne' }>(x: T) => source === 'tout' || x.source === source
  const visibles = trierLesSignalements(aRelire.filter(deLaSource), tri)
  const relus = page ? page.relus.filter(deLaSource) : []
  // Ce que chaque pastille compte : les questions à relire, ou les relues, selon l'onglet.
  const compte = (x: Source) => (vue === 'relire' ? aRelire : (page?.relus ?? [])).filter(y => x === 'tout' || y.source === x).length
  const tronquee = page !== null && (page.jour.length >= SIGNALEMENTS_MONTRES_AU_QG || page.campagne.length >= SIGNALEMENTS_MONTRES_AU_QG)
  return (
    <>
      <p className="muted small">
        Ce que les joueurs signalent au quiz du jour et en campagne — sentiers, parcours, défi de la semaine et duels compris. Chaque geste referme ses
        signalements et dit ce qui en a été fait ; le joueur dont la remarque a servi en est remercié sur son accueil.
      </p>
      <ChiffresDesSignalements page={page} />
      <div className="signalements-filtres">
        <Onglets
          onglets={[
            { id: 'relire', nom: 'À relire', pastille: { n: aRelire.length, label: `${formatNumber(aRelire.length)} à relire` } },
            { id: 'relus', nom: 'Relues', pastille: { n: page?.relus.length ?? 0, label: `${formatNumber(page?.relus.length ?? 0)} ces ${JOURS_DES_RELUS} jours` } },
          ]}
          actif={vue}
          onChoisir={setVue}
          label="Les signalements"
          idOnglet={id => `signalements-onglet-${id}`}
          idPanneau={() => 'signalements-panneau'}
          className="onglets-petits"
        />
        <div className="onglets onglets-puces" role="group" aria-label="D’où viennent les questions">
          {SOURCES.map(x => (
            <button key={x.id} type="button" className={'onglet' + (source === x.id ? ' actif' : '')} aria-pressed={source === x.id} onClick={() => setSource(x.id)}>
              {x.nom}
              {x.id !== 'tout' && page && <span className="onglet-pastille">{formatNumber(compte(x.id))}</span>}
            </button>
          ))}
        </div>
        {vue === 'relire' && (
          <label className="signalements-tri">
            <span className="muted small">Trier</span>
            <select className="input" value={tri} onChange={e => setTri(e.target.value as TriDesSignalements)}>
              <option value="signalees">les plus signalées d’abord</option>
              <option value="recentes">les plus récentes d’abord</option>
            </select>
          </label>
        )}
      </div>
      <div id="signalements-panneau" role="tabpanel" aria-labelledby={`signalements-onglet-${vue}`} className="signalements-panneau">
        {!page ? (
          <p className="serif-note">Chargement…</p>
        ) : vue === 'relire' ? (
          <>
            {visibles.length === 0 && (
              <p className="serif-note">
                {source === 'tout' ? 'Rien à relire : aucune question signalée n’attend.' : `Rien à relire ${source === 'jour' ? 'au quiz du jour' : 'en campagne'}.`}
              </p>
            )}
            {visibles.map(x =>
              x.source === 'jour' ? (
                <CarteDuJour key={`jour:${x.s.jour}#${x.s.index}`} s={x.s} maintenant={page.maintenant} occupe={occupe} faire={faire} annuler={s => void annuler(s)} />
              ) : (
                <CarteDeCampagne key={`campagne:${x.s.questionId}`} s={x.s} maintenant={page.maintenant} occupe={occupe} faire={faire} />
              ),
            )}
            {tronquee && (
              <p className="muted small">{`Les ${SIGNALEMENTS_MONTRES_AU_QG} questions les plus récemment signalées de chaque mode : les autres paraîtront à mesure.`}</p>
            )}
          </>
        ) : (
          <section className="qg-carte" aria-labelledby="signalements-relues">
            <div className="qg-carte-tete qg-carte-tete-pile">
              <h2 id="signalements-relues">{`Relues ces ${JOURS_DES_RELUS} jours`}</h2>
              <span className="muted small">
                Chaque question relue, ce qui en a été fait et quand. Signalée de nouveau, elle revient dans « À relire », ses signalements d’avant repliés
                dessous. Le détail du geste reste au journal.
              </span>
            </div>
            <ListeDesRelus relus={relus} maintenant={page.maintenant} />
          </section>
        )}
      </div>
    </>
  )
}
