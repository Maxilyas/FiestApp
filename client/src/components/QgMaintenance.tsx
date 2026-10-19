import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { confirmDialog } from './Dialog'
import { Icon, type IconName } from './Icon'
import { showToast } from '../state'
import { espacesFines } from '../format'
import { quandEcrit } from '../../../shared/qg'
import { BANDEAU_MAX, PAGES_EN_MAINTENANCE, PAGES_FERMABLES, type EtatDeLaMaintenance, type PageEnMaintenance } from '../../../shared/maintenance'

const ICONE: Record<PageEnMaintenance, IconName> = {
  jour: 'sun',
  campagne: 'target',
  defi: 'trophy',
  duels: 'swords',
  expedition: 'flag',
  boutique: 'bag',
}

/** Le texte tel que le serveur le gardera : ses blancs resserrés. */
const net = (texte: string) => texte.replace(/\s+/g, ' ').trim()

/**
 * La maintenance au QG (`/admin#maintenance`, sous « Piloter ») — le souhait
 * du propriétaire du 19 octobre 2026, le jour où le quiz du jour et les défis
 * ne s'ouvraient plus en production : prévenir les joueurs d'un bandeau
 * rouge, et fermer ce qui ne marche pas le temps de le réparer, « pour pas
 * que les gens tentent d'accéder à quelque chose qui ne marche pas ». Tout se
 * lit à la page suivante qu'ils ouvrent (`shared/maintenance.ts`) ; chaque
 * geste va au journal.
 */
export function QgMaintenance({ onEtat }: { onEtat: (etat: EtatDeLaMaintenance) => void }) {
  const [etat, setEtat] = useState<EtatDeLaMaintenance | null>(null)
  const [error, setError] = useState('')
  const [texte, setTexte] = useState('')
  const [occupe, setOccupe] = useState<string | null>(null)

  const recevoir = (e: EtatDeLaMaintenance) => {
    setEtat(e)
    onEtat(e)
  }
  useEffect(() => {
    api.admin.maintenance().then(e => {
      recevoir(e)
      setTexte(e.bandeau?.texte ?? '')
    }, e => setError(motifDe(e)))
    // Lu à l'ouverture de la page ; chaque geste rend l'état d'après.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Un geste à la fois : un double toucher ne fermerait pas deux fois. */
  const geste = async (cle: string, faire: () => Promise<EtatDeLaMaintenance>, dit: string) => {
    if (occupe) return
    setOccupe(cle)
    try {
      recevoir(await faire())
      showToast({ kind: 'info', message: dit })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(null)
    }
  }

  if (error) return <p className="error">{error}</p>
  if (!etat) return <p className="serif-note">Chargement…</p>

  const affiche = etat.bandeau
  const ecrit = net(texte)
  const longueur = Array.from(ecrit).length

  const fermer = async (page: PageEnMaintenance) => {
    const { nom, ferme } = PAGES_FERMABLES[page]
    // « Page » dans ce qui se dit après : « Les duels : rouvert » ne s'accordait à rien.
    const ok = await confirmDialog({
      title: `${nom} en maintenance ?`,
      message: espacesFines(
        `${ferme}. Les joueurs liront qu’une réparation est en cours, et rien n’y commencera plus ; une partie déjà à l’écran se finit. Toi, tu y entres encore.`,
      ),
      confirmLabel: 'Mettre en maintenance',
    })
    if (ok) await geste(page, () => api.admin.mettreEnMaintenance(page, true), `Page en maintenance : ${nom}`)
  }

  return (
    <>
      <p className="muted small">
        {espacesFines(
          'Prévenir les joueurs d’un problème, et fermer ce qui ne marche pas le temps de le réparer. Tout vaut dès la page suivante qu’ils ouvrent ; chaque geste va au journal.',
        )}
      </p>

      <section className="qg-carte" aria-labelledby="maintenance-bandeau">
        <div className="qg-carte-tete">
          <h2 id="maintenance-bandeau">Le bandeau</h2>
          {affiche && <span className="etiquette etiquette-alerte">Affiché</span>}
        </div>
        <p className="muted small">
          {espacesFines(
            'En rouge, en haut de chaque page — l’accueil, les modes, le QG —, pour tous, avec ou sans profil. Jamais pendant une soirée : ni sur le téléphone des invités, ni sur l’écran commun.',
          )}
        </p>
        {/* Tel que les joueurs le liront, à mesure qu'on l'écrit. */}
        <div className={'bandeau-du-service bandeau-apercu' + (ecrit ? '' : ' bandeau-apercu-vide')} aria-hidden="true">
          {ecrit ? espacesFines(ecrit) : 'Ce que tu écris ici'}
        </div>
        <label className="label" htmlFor="maintenance-texte">
          Ce qu’il dit
        </label>
        <textarea
          id="maintenance-texte"
          className="input"
          rows={3}
          maxLength={BANDEAU_MAX}
          value={texte}
          placeholder="Le quiz du jour est en panne : on répare, merci de votre patience !"
          onChange={e => setTexte(e.target.value)}
        />
        <p className="muted small maintenance-compte">
          {longueur} / {BANDEAU_MAX}
          {affiche && ` · affiché ${quandEcrit(affiche.depuis, etat.maintenant)}`}
        </p>
        <div className="admin-gestes maintenance-gestes">
          {(!affiche || ecrit !== affiche.texte) && (
            <button
              type="button"
              className="salon-geste admin-geste-oui"
              aria-disabled={!ecrit || occupe !== null || undefined}
              onClick={() => ecrit && void geste('bandeau', () => api.admin.poserLeBandeau(ecrit), affiche ? 'Bandeau changé' : 'Bandeau affiché')}
            >
              <Icon name="alert" />
              {affiche ? 'Changer le bandeau' : 'Afficher le bandeau'}
            </button>
          )}
          {affiche && (
            <button
              type="button"
              className="salon-geste"
              aria-disabled={occupe !== null || undefined}
              onClick={() =>
                void geste(
                  'bandeau',
                  async () => {
                    const e = await api.admin.poserLeBandeau(null)
                    setTexte('')
                    return e
                  },
                  'Bandeau retiré',
                )
              }
            >
              <Icon name="x" />
              Retirer le bandeau
            </button>
          )}
        </div>
      </section>

      <section className="qg-carte" aria-labelledby="maintenance-pages">
        <div className="qg-carte-tete">
          <h2 id="maintenance-pages">Les pages en maintenance</h2>
          {PAGES_EN_MAINTENANCE.some(p => etat.pages[p] !== null) && (
            <span className="etiquette etiquette-alerte">{PAGES_EN_MAINTENANCE.filter(p => etat.pages[p] !== null).length}</span>
          )}
        </div>
        <p className="muted small">
          {espacesFines(
            'Fermée, une page dit aux joueurs qu’on la répare : son bouton de l’accueil s’éteint, et rien n’y commence — ni partie, ni départ, ni achat. Une partie déjà à l’écran se finit. Toi, tu y entres encore : de quoi vérifier la réparation avant de rouvrir. Les soirées ne se ferment pas : une salle entière joue derrière l’écran commun.',
          )}
        </p>
        <ul className="qg-liste maintenance-gestes">
          {PAGES_EN_MAINTENANCE.map(p => {
            const depuis = etat.pages[p]
            const avecLaCampagne = p === 'defi' && depuis === null && etat.pages.campagne !== null
            return (
              <li key={p} className={'maintenance-page' + (depuis !== null ? ' maintenance-fermee' : '')}>
                <span className="maintenance-page-icone" aria-hidden="true">
                  <Icon name={ICONE[p]} />
                </span>
                <span className="maintenance-page-texte">
                  <b>{PAGES_FERMABLES[p].nom}</b>
                  <span className="muted small">{espacesFines(PAGES_FERMABLES[p].ferme)}</span>
                  {depuis !== null ? (
                    <span className="maintenance-depuis">{`En maintenance, ${quandEcrit(depuis, etat.maintenant)}`}</span>
                  ) : (
                    avecLaCampagne && <span className="muted small">Fermé avec la campagne</span>
                  )}
                </span>
                {depuis === null ? (
                  <button type="button" className="salon-geste" aria-disabled={occupe !== null || undefined} onClick={() => void fermer(p)}>
                    <Icon name="pause" />
                    {occupe === p ? 'Fermeture…' : 'Mettre en maintenance'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="salon-geste admin-geste-oui"
                    aria-disabled={occupe !== null || undefined}
                    onClick={() => void geste(p, () => api.admin.mettreEnMaintenance(p, false), `Page rouverte aux joueurs : ${PAGES_FERMABLES[p].nom}`)}
                  >
                    <Icon name="play" />
                    {occupe === p ? 'Ouverture…' : 'Rouvrir'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
