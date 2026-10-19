import { useEffect, useState } from 'react'
import { ApiError, api, motifDe } from '../api'
import { ChampNombre } from './ChampNombre'
import { CarteDeLAdministrateur } from './CarteDeLAdministrateur'
import { confirmDialog } from './Dialog'
import { Icon } from './Icon'
import { showToast } from '../state'
import { espacesFines } from '../format'
import { formatNumber } from '../../../shared/typographie'
import { quandEcrit } from '../../../shared/qg'
import { ANNONCE_MS, CONFETTIS_PAR_DON_MAX } from '../../../shared/profil'
import { ANNONCE_MAX, messageNet, type AnnonceAuQg, type PageDesAnnonces } from '../../../shared/annonces'

/**
 * L'identifiant d'un envoi, tiré par la page : le même tant que l'annonce
 * n'est pas partie — un second toucher, la réponse perdue en route, est
 * reconnu par le serveur au lieu d'offrir deux fois à tous. Sans
 * `crypto.randomUUID`, absent d'une page servie en http (`remise.ts`).
 */
const tirerUnEnvoi = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

/** « 128 profils », « 1 profil », « aucun profil ». */
const deProfils = (n: number) => (n === 0 ? 'aucun profil' : `${formatNumber(n)} profil${n > 1 ? 's' : ''}`)
const nConfettis = (n: number) => `${formatNumber(n)} confetti${n > 1 ? 's' : ''}`

/**
 * Les annonces à tous au QG (`/admin#annonces`, sous « Animer ») — le souhait
 * du propriétaire du 19 octobre 2026, le soir où le quiz du jour et les défis
 * s'étaient rouverts : « une annonce pour dire que l'incident est résolu, et
 * envoyer des confettis à tous pour le dédommagement ». Un message que chaque
 * profil lit une fois, en haut de son accueil, montré ici tel qu'il le lira,
 * et des confettis pour chacun si on veut ; puis les annonces faites, et
 * « Retirer » tant qu'elles se montrent. Chaque geste va au journal.
 */
export function QgAnnonces() {
  const [page, setPage] = useState<PageDesAnnonces | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confettis, setConfettis] = useState(0)
  const [envoi, setEnvoi] = useState(tirerUnEnvoi)
  const [occupe, setOccupe] = useState<string | null>(null)

  const relire = () =>
    api.admin.annonces().then(
      p => {
        setPage(p)
        setError('')
      },
      e => setError(motifDe(e)),
    )
  useEffect(() => {
    void relire()
  }, [])

  if (error) return <p className="error">{error}</p>
  if (!page) return <p className="serif-note">Chargement…</p>

  const ecrit = messageNet(message)
  const longueur = Array.from(ecrit).length
  const pour = deProfils(page.profils)
  /** Le formulaire repart à zéro, l'annonce partie : le prochain envoi est un autre. */
  const repartir = () => {
    setMessage('')
    setConfettis(0)
    setEnvoi(tirerUnEnvoi())
  }

  const annoncer = async () => {
    if (!ecrit || occupe) return
    const ok = await confirmDialog({
      title: `Annoncer à ${pour} ?`,
      message: espacesFines(
        confettis > 0
          ? `Chacun la lira une fois, en haut de son accueil, avec ${nConfettis(confettis)} — ${nConfettis(confettis * page.profils)} en tout. Un don ne se reprend pas : retirer l’annonce les laissera à chacun.`
          : 'Chacun la lira une fois, en haut de son accueil.',
      ),
      confirmLabel: confettis > 0 ? `Annoncer et offrir ${nConfettis(confettis)}` : 'Annoncer',
    })
    if (!ok) return
    setOccupe('annoncer')
    try {
      setPage(await api.admin.annoncer(envoi, ecrit, confettis))
      repartir()
      showToast({ kind: 'info', message: `Annonce envoyée à ${pour}` })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
      // Déjà partie : la réponse d'avant s'était perdue en route. La liste la montre.
      if (e instanceof ApiError && e.statut === 409) {
        repartir()
        void relire()
      }
    } finally {
      setOccupe(null)
    }
  }

  const retirer = async (a: AnnonceAuQg) => {
    if (occupe) return
    const ok = await confirmDialog({
      title: 'Retirer cette annonce ?',
      message: espacesFines(
        `Ceux qui ne l’ont pas encore lue ne la verront pas.${a.confettis > 0 ? ' Ses confettis restent à chacun : un don ne se reprend pas.' : ''}`,
      ),
      confirmLabel: 'Retirer',
    })
    if (!ok) return
    setOccupe(a.id)
    try {
      setPage(await api.admin.retirerLAnnonce(a.id))
      showToast({ kind: 'info', message: 'Annonce retirée' })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(null)
    }
  }

  return (
    <>
      <p className="muted small">
        {espacesFines(
          'Un message pour tous les profils — une panne réglée, une nouveauté, un cadeau —, que chacun lit une fois, en haut de son accueil. Le bandeau rouge, lui, prévient pendant la panne et se retire avec elle.',
        )}
      </p>

      <section className="qg-carte" aria-labelledby="annonces-nouvelle">
        <div className="qg-carte-tete">
          <h2 id="annonces-nouvelle">Une annonce</h2>
        </div>
        {/* Telle que les joueurs la liront, à mesure qu'on l'écrit. */}
        <ul className={'annonces-admin annonce-apercu' + (ecrit ? '' : ' annonce-apercu-vide')} aria-hidden="true">
          <CarteDeLAdministrateur annonce={{ id: 'apercu', sorte: 'annonce', message: ecrit || 'Ce que tu écris ici', confettis, le: 0 }} prenom="" />
        </ul>
        <label className="label" htmlFor="annonce-message">
          Ce qu’elle dit
        </label>
        <textarea
          id="annonce-message"
          className="input"
          rows={3}
          maxLength={ANNONCE_MAX}
          value={message}
          placeholder="Le quiz du jour et le défi remarchent. Merci de votre patience !"
          onChange={e => setMessage(e.target.value)}
        />
        <p className="muted small maintenance-compte">
          {longueur} / {ANNONCE_MAX}
        </p>
        <label className="label" htmlFor="annonce-confettis">
          Des confettis pour chacun ? De 0 à {CONFETTIS_PAR_DON_MAX}
        </label>
        <ChampNombre id="annonce-confettis" valeur={confettis} min={0} max={CONFETTIS_PAR_DON_MAX} onValeur={setConfettis} inputMode="numeric" />
        <p className="muted small">
          {espacesFines(
            `Pour les ${pour} d’aujourd’hui${confettis > 0 ? `, soit ${nConfettis(confettis * page.profils)} en tout` : ''}. Ni les invités sans profil, ni ceux qui en créeront un ensuite ne la liront.`,
          )}
        </p>
        <div className="admin-gestes maintenance-gestes">
          <button type="button" className="salon-geste admin-geste-oui" aria-disabled={!ecrit || occupe !== null || undefined} onClick={() => void annoncer()}>
            <Icon name="megaphone" />
            {occupe === 'annoncer' ? '…' : confettis > 0 ? `Annoncer et offrir ${nConfettis(confettis)}` : 'Annoncer à tous'}
          </button>
        </div>
      </section>

      {page.annonces.length > 0 && (
        <section className="qg-carte" aria-labelledby="annonces-faites">
          <div className="qg-carte-tete">
            <h2 id="annonces-faites">Les annonces faites</h2>
            <span className="etiquette num">{page.annonces.length}</span>
          </div>
          <ul className="qg-liste maintenance-gestes">
            {page.annonces.map(a => {
              // Un mois passé, l'accueil ne la dit plus (`ANNONCE_MS`) : rien à retirer.
              const visible = a.retireeLe === null && page.maintenant - a.le < ANNONCE_MS
              return (
                <li key={a.id} className={'annonce-faite' + (visible ? '' : ' annonce-faite-tue')}>
                  <span className="annonce-faite-texte">
                    <b>{espacesFines(a.message)}</b>
                    <span className="muted small">
                      {[a.confettis > 0 ? `${nConfettis(a.confettis)} à ${deProfils(a.destinataires)}` : `Pour ${deProfils(a.destinataires)}`, quandEcrit(a.le, page.maintenant)].join(' · ')}
                    </span>
                    {a.retireeLe !== null && <span className="annonce-faite-etat">{`Retirée ${quandEcrit(a.retireeLe, page.maintenant)}`}</span>}
                    {a.retireeLe === null && !visible && <span className="muted small">Ne se montre plus : un mois a passé</span>}
                  </span>
                  {visible && (
                    <button type="button" className="salon-geste" aria-disabled={occupe !== null || undefined} onClick={() => void retirer(a)}>
                      <Icon name="x" />
                      {occupe === a.id ? '…' : 'Retirer'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}
