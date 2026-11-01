import { useEffect, useState } from 'react'
import { ApiError, api, motifDe } from '../api'
import { AfficheDeLaNouveaute } from './AfficheDeLaNouveaute'
import { ChampNombre } from './ChampNombre'
import { confirmDialog } from './Dialog'
import { Icon } from './Icon'
import { showToast } from '../state'
import { espacesFines } from '../format'
import { cabinetIci } from '../maintenance'
import { formatNumber } from '../../../shared/typographie'
import { quandEcrit } from '../../../shared/qg'
import { jourDe, jourEnToutesLettres } from '../../../shared/jour'
import { CONFETTIS_PAR_DON_MAX } from '../../../shared/profil'
import type { EtatDeLaMaintenance } from '../../../shared/maintenance'
import {
  afficheEnCours,
  DESTINATIONS,
  estUnePageALAffiche,
  JOURS_A_L_AFFICHE,
  JOURS_D_OFFICE,
  PAGES_A_L_AFFICHE,
  PHRASE_D_AFFICHE_MAX,
  TITRE_D_AFFICHE_MAX,
  type AfficheAuQg,
  type PageALAffiche,
  type PageDesAffiches,
} from '../../../shared/affiches'
import { messageNet } from '../../../shared/annonces'

/**
 * L'identifiant d'un envoi, tiré par la page : le même tant que l'affiche
 * n'est pas posée — un second toucher, la réponse perdue en route, est
 * reconnu par le serveur au lieu d'en poser une seconde. Sans
 * `crypto.randomUUID`, absent d'une page servie en http.
 */
const tirerUnEnvoi = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

const nConfettis = (n: number) => `${formatNumber(n)} confetti${n > 1 ? 's' : ''}`
const deProfils = (n: number) => (n === 0 ? 'aucun profil' : `${formatNumber(n)} profil${n > 1 ? 's' : ''}`)
/** Le nom de sa page, même inconnue d'ici. */
const nomDe = (page: string) => (estUnePageALAffiche(page) ? DESTINATIONS[page].nom : page)

/** Sa page est fermée aux joueurs (`/admin#maintenance`) : l'affiche ne se montrera qu'à qui y entre. */
function fermeture(page: PageALAffiche, maintenance: EtatDeLaMaintenance | null): string | null {
  if (page === 'cabinet' && !cabinetIci()) return 'Le Cabinet de curiosités ne s’ouvre pas sur ce serveur : son affiche se refusera.'
  if (maintenance?.pages[page] != null) return `${DESTINATIONS[page].nom} est en maintenance : l’affiche ne se montrera à personne tant qu’elle ne rouvre pas.`
  if (maintenance?.bientot[page] != null) return `${DESTINATIONS[page].nom} est bientôt disponible : seuls ses testeurs verront l’affiche tant que tu ne l’ouvres pas à tous.`
  return null
}

/**
 * L'affiche des nouveautés au QG (`/admin#affiches`, sous « Animer ») — le
 * souhait du propriétaire du 1er novembre 2026, à la veille d'ouvrir le
 * Cabinet de curiosités : « beaucoup de gens n'utilisent pas des
 * fonctionnalités car ils ne sont pas au courant ». La page qu'elle montre, son
 * titre et sa phrase — proposés d'office, à réécrire —, combien de jours elle
 * reste et ce que la première visite rapporte ; l'aperçu tel que l'accueil la
 * montrera ; puis les affiches posées, ce qu'elles ont fait, et « Retirer »
 * tant qu'elles se montrent. Chaque geste va au journal, sous les annonces.
 */
export function QgAffiches({ maintenance }: { maintenance: EtatDeLaMaintenance | null }) {
  const [page, setPage] = useState<PageDesAffiches | null>(null)
  const [error, setError] = useState('')
  const [cible, setCible] = useState<PageALAffiche>(() => (cabinetIci() ? 'cabinet' : 'campagne'))
  // Ce que la page choisie propose, écrit dans les champs — on retouche un mot sans tout retaper ; changer de page
  // reprend ce qu'elle propose, sans laisser le titre d'une autre.
  const [titre, setTitre] = useState(() => DESTINATIONS[cible].titre)
  const [phrase, setPhrase] = useState(() => DESTINATIONS[cible].phrase)
  const [jours, setJours] = useState<number>(JOURS_D_OFFICE)
  const [confettis, setConfettis] = useState(0)
  const [envoi, setEnvoi] = useState(tirerUnEnvoi)
  const [occupe, setOccupe] = useState<string | null>(null)

  const relire = () =>
    api.admin.affiches().then(
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

  const destination = DESTINATIONS[cible]
  const titreEcrit = messageNet(titre)
  const phraseEcrite = messageNet(phrase)
  const enCours = page.affiches.find(a => a.page === cible && afficheEnCours(a, page.maintenant))
  const fermee = fermeture(cible, maintenance)
  const prete = !!titreEcrit && !!phraseEcrite && !enCours

  const choisir = (p: PageALAffiche) => {
    setCible(p)
    setTitre(DESTINATIONS[p].titre)
    setPhrase(DESTINATIONS[p].phrase)
  }
  const repartir = () => {
    choisir(cible)
    setJours(JOURS_D_OFFICE)
    setConfettis(0)
    setEnvoi(tirerUnEnvoi())
  }

  const poser = async () => {
    if (occupe || !prete) return
    const ok = await confirmDialog({
      title: `Mettre ${destination.nom.charAt(0).toLowerCase()}${destination.nom.slice(1)} à l’affiche ?`,
      message: espacesFines(
        `Chaque profil la verra en haut de son accueil pendant ${jours} jours, et « Nouveau » sur son bouton, jusqu’à ce qu’il y aille.${
          confettis > 0 ? ` Sa première visite lui rapportera ${nConfettis(confettis)} — un don ne se reprend pas.` : ''
        }`,
      ),
      confirmLabel: 'Mettre à l’affiche',
    })
    if (!ok) return
    setOccupe('poser')
    try {
      setPage(await api.admin.mettreALAffiche(envoi, { page: cible, titre: titreEcrit, phrase: phraseEcrite, jours: jours as (typeof JOURS_A_L_AFFICHE)[number], confettis }))
      repartir()
      showToast({ kind: 'info', message: 'Affiche posée : chaque accueil la montre' })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
      // Déjà posée, ou une autre en cours sur la page : la liste le montre.
      if (e instanceof ApiError && e.statut === 409) {
        repartir()
        void relire()
      }
    } finally {
      setOccupe(null)
    }
  }

  const retirer = async (a: AfficheAuQg) => {
    if (occupe) return
    const ok = await confirmDialog({
      title: 'Retirer cette affiche ?',
      message: espacesFines(`Plus personne ne la verra, ni « Nouveau » sur son bouton.${a.confettis > 0 ? ' Les confettis déjà offerts restent : un don ne se reprend pas.' : ''}`),
      confirmLabel: 'Retirer',
    })
    if (!ok) return
    setOccupe(a.id)
    try {
      setPage(await api.admin.retirerLAffiche(a.id))
      showToast({ kind: 'info', message: 'Affiche retirée' })
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
          'Une nouveauté à faire connaître : une affiche en haut de l’accueil de chaque profil, et « Nouveau » sur le bouton de sa page, jusqu’à ce qu’il y aille. « Plus tard » range l’affiche, pas la pastille.',
        )}
      </p>

      <section className="qg-carte" aria-labelledby="affiches-nouvelle">
        <div className="qg-carte-tete">
          <h2 id="affiches-nouvelle">Une affiche</h2>
        </div>
        {/* Telle que les joueurs la verront, à mesure qu'on l'écrit. */}
        <div className="affiche-apercu" aria-hidden="true">
          <AfficheDeLaNouveaute affiche={{ id: 'apercu', page: cible, titre: titreEcrit || 'Son titre', phrase: phraseEcrite || 'Sa phrase', confettis }} />
        </div>
        <span className="label" id="affiche-page">
          La page qu’elle montre
        </span>
        <div className="annonce-sortes" role="radiogroup" aria-labelledby="affiche-page">
          {PAGES_A_L_AFFICHE.map(p => (
            <button key={p} type="button" role="radio" aria-checked={cible === p} className={'annonce-sorte' + (cible === p ? ' actif' : '')} onClick={() => choisir(p)}>
              {DESTINATIONS[p].nom}
            </button>
          ))}
        </div>
        {fermee && <p className="muted small">{espacesFines(fermee)}</p>}
        <label className="label" htmlFor="affiche-titre">
          Son titre
        </label>
        <input id="affiche-titre" className="input" maxLength={TITRE_D_AFFICHE_MAX} value={titre} placeholder={destination.titre} onChange={e => setTitre(e.target.value)} />
        <p className="muted small maintenance-compte">
          {Array.from(titreEcrit).length} / {TITRE_D_AFFICHE_MAX}
        </p>
        <label className="label" htmlFor="affiche-phrase">
          Sa phrase
        </label>
        <textarea id="affiche-phrase" className="input" rows={3} maxLength={PHRASE_D_AFFICHE_MAX} value={phrase} placeholder={destination.phrase} onChange={e => setPhrase(e.target.value)} />
        <p className="muted small maintenance-compte">
          {Array.from(phraseEcrite).length} / {PHRASE_D_AFFICHE_MAX}
        </p>
        <span className="label" id="affiche-jours">
          Combien de temps
        </span>
        <div className="annonce-sortes" role="radiogroup" aria-labelledby="affiche-jours">
          {JOURS_A_L_AFFICHE.map(j => (
            <button key={j} type="button" role="radio" aria-checked={jours === j} className={'annonce-sorte' + (jours === j ? ' actif' : '')} onClick={() => setJours(j)}>
              {j === 7 ? 'Une semaine' : `${j / 7} semaines`}
            </button>
          ))}
        </div>
        <label className="label" htmlFor="affiche-confettis">
          Confettis à la première visite
        </label>
        <ChampNombre id="affiche-confettis" valeur={confettis} min={0} max={CONFETTIS_PAR_DON_MAX} onValeur={setConfettis} inputMode="numeric" />
        <p className="muted small">
          {espacesFines(
            confettis > 0
              ? `Offerts à chaque profil la première fois qu’il ouvre ${destination.nom.charAt(0).toLowerCase()}${destination.nom.slice(1)} pendant que l’affiche se montre — un don par profil, qui ne se reprend pas.`
              : `De 0 à ${CONFETTIS_PAR_DON_MAX}. Sans confettis, y aller ne rapporte rien de plus.`,
          )}
        </p>
        {enCours && <p className="muted small">{espacesFines(`${destination.nom} a déjà son affiche, « ${enCours.titre} » : retire-la pour en poser une autre.`)}</p>}
        <div className="admin-gestes maintenance-gestes">
          <button type="button" className="salon-geste admin-geste-oui" aria-disabled={!prete || occupe !== null || undefined} onClick={() => void poser()}>
            <Icon name="sparkles" />
            {occupe === 'poser' ? '…' : 'Mettre à l’affiche'}
          </button>
        </div>
      </section>

      {page.affiches.length > 0 && (
        <section className="qg-carte" aria-labelledby="affiches-posees">
          <div className="qg-carte-tete">
            <h2 id="affiches-posees">Les affiches posées</h2>
            <span className="etiquette num">{page.affiches.length}</span>
          </div>
          <ul className="qg-liste maintenance-gestes">
            {page.affiches.map(a => {
              const visible = afficheEnCours(a, page.maintenant)
              return (
                <li key={a.id} className={'annonce-faite' + (visible ? '' : ' annonce-faite-tue')}>
                  <span className="annonce-faite-texte">
                    <b>{espacesFines(`${nomDe(a.page)} · « ${a.titre} »`)}</b>
                    <span className="muted small">
                      {espacesFines(
                        [
                          `posée ${quandEcrit(a.le, page.maintenant)}`,
                          visible ? `jusqu’au ${jourEnToutesLettres(jourDe(a.fin), true)}` : null,
                          a.confettis > 0 ? `${nConfettis(a.confettis)} à la première visite` : null,
                        ]
                          .filter(Boolean)
                          .join(' · '),
                      )}
                    </span>
                    <span className="small">
                      {espacesFines(
                        `${a.ouvertes > 0 ? `${deProfils(a.ouvertes)} y ${a.ouvertes > 1 ? 'sont allés' : 'est allé'}` : 'Personne n’y est encore allé'}${
                          a.rangees > 0 ? ` · ${deProfils(a.rangees)} l’${a.rangees > 1 ? 'ont' : 'a'} rangée sans y aller` : ''
                        }${a.confettis > 0 && a.ouvertes > 0 ? ` · ${nConfettis(a.confettis * a.ouvertes)} offerts` : ''}`,
                      )}
                    </span>
                    {a.retireeLe !== null && <span className="annonce-faite-etat">{`Retirée ${quandEcrit(a.retireeLe, page.maintenant)}`}</span>}
                    {a.retireeLe === null && !visible && <span className="annonce-faite-etat">{`Finie le ${jourEnToutesLettres(jourDe(a.fin), true)}`}</span>}
                  </span>
                  {visible && (
                    <span className="annonce-faite-gestes">
                      <button type="button" className="salon-geste" aria-disabled={occupe !== null || undefined} onClick={() => void retirer(a)}>
                        <Icon name="x" />
                        {occupe === a.id ? '…' : 'Retirer'}
                      </button>
                    </span>
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
