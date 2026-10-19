import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { copierTexte } from '../copier'
import { espacesFines } from '../format'
import { showToast } from '../state'
import { allumerLesAlertes, eteindreLesAlertes, preparerLesAlertes, type EtatDesAlertes } from '../alertesDuQg'
import { Icon, type IconName } from './Icon'
import { Onglets } from './Onglets'
import { Feuille } from './Pieces'
import { FicheDeLErreur, erreurs, fois, quandDuServeur, texteDeLErreur } from './QgServeur'
import { formatNumber } from '../../../shared/typographie'
import { quandEcrit } from '../../../shared/qg'
import { NOM_DU_MODE_SURVEILLE, TELEPHONES_PREVENUS_MAX, capitale, type PanneDUnMode } from '../../../shared/pannes'
import {
  ETATS_DU_TRI,
  NOM_DE_L_ETAT,
  NOTE_D_UNE_ERREUR_MAX,
  compteDuTri,
  type ErreurATrier,
  type EtatDUneErreur,
  type PageDesErreurs,
  type TriLu,
} from '../../../shared/triDesErreurs'

const ICONE_DE_L_ETAT: Record<EtatDUneErreur, IconName> = { 'a-regarder': 'alert', reglee: 'check', ignoree: 'eye-off' }

/** Ce qu'une liste vide dit, onglet par onglet. */
const RIEN: Record<EtatDUneErreur, string> = {
  'a-regarder': 'Rien à regarder : chaque erreur de la semaine est triée.',
  reglee: 'Aucune erreur réglée cette semaine.',
  ignoree: 'Aucune erreur ignorée cette semaine.',
}

/** Ce que devient l'erreur, dit au toast : on sait ce qu'elle fera ensuite. */
const APRES_LE_TRI: Record<EtatDUneErreur, string> = {
  'a-regarder': 'Erreur remise à regarder',
  reglee: 'Erreur réglée : elle reviendra d’elle-même si une version d’après la revoit',
  ignoree: 'Erreur ignorée : elle ne sonnera plus',
}

/** « Réglée hier à 21 h 04 — « PR #284 » », « Ignorée aujourd’hui à 9 h 12 ». */
function triEcrit(tri: TriLu, maintenant: number): string {
  const quand = tri.depuis === null ? '' : ` ${quandEcrit(tri.depuis, maintenant)}`
  const mot = tri.note ? ` — « ${tri.note} »` : ''
  if (tri.revenue) return `Réglée${quand}${mot}, puis revenue sous une version qui ne l’avait jamais vue`
  return `${tri.etat === 'reglee' ? 'Réglée' : 'Ignorée'}${quand}${mot}`
}

/**
 * Les erreurs du QG (`/admin#erreurs`, le souhait du propriétaire du 19
 * octobre 2026 : « je trouve que je ne peux pas très bien manager les erreurs
 * que je vois ») : celles de la semaine, les mêmes fondues, à trier — à
 * regarder, réglées, ignorées. Réglée, une erreur sort de la liste et revient
 * d'elle-même si une version d'après la revoit ; ignorée, elle ne sonne plus.
 * Seules celles à regarder allument la vue d'ensemble. Au-dessus, les modes de
 * jeu en panne, que la veille du serveur voit tomber ; en bas, les téléphones
 * qu'une panne fait sonner. Chaque geste va au journal, sous « Erreurs ».
 */
export function QgErreurs({ apresUnTri }: { apresUnTri?: () => void }) {
  const [page, setPage] = useState<PageDesErreurs | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api.admin.erreurs().then(setPage, e => setError(motifDe(e)))
  }, [])

  if (error) return <p className="error">{error}</p>
  if (!page) return <p className="serif-note">Chargement…</p>
  return (
    <ErreursAuQg
      page={page}
      trier={async (cle, etat, note) => {
        setPage(await api.admin.trierLErreur(cle, etat, note))
        apresUnTri?.()
      }}
      onAlertes={alertes => setPage(p => p && { ...p, alertes })}
    />
  )
}

/** La page lue : les pannes en cours, les erreurs onglet par onglet, celles sans détail, les téléphones prévenus. */
export function ErreursAuQg({
  page,
  trier,
  onAlertes,
}: {
  page: PageDesErreurs
  /** Rend la main une fois la page d'après posée ; lève le refus du serveur. */
  trier?: (cle: string, etat: EtatDUneErreur, note: string | null) => Promise<void>
  onAlertes?: (alertes: PageDesErreurs['alertes']) => void
}) {
  const [onglet, setOnglet] = useState<EtatDUneErreur>('a-regarder')
  const [ouverte, setOuverte] = useState<string | null>(null)
  const compte = compteDuTri(page.erreurs)
  const liste = page.erreurs.filter(e => e.tri.etat === onglet)
  const laFiche = ouverte ? page.erreurs.find(e => e.cle === ouverte) : undefined
  const { maintenant } = page

  return (
    <>
      <p className="muted small">
        {espacesFines(
          'Les erreurs serveur de la semaine, les mêmes fondues. Réglée, une erreur sort de la liste : elle revient d’elle-même si une version d’après la revoit. Ignorée, elle ne sonne plus. Seules celles à regarder allument la vue d’ensemble.',
        )}
      </p>

      {page.pannes.length > 0 && <EnPanne pannes={page.pannes} maintenant={maintenant} />}

      <section className="qg-carte" aria-labelledby="erreurs-semaine">
        <div className="qg-carte-tete">
          <h2 id="erreurs-semaine">Ce qui a échoué</h2>
        </div>
        <Onglets
          className="onglets-puces"
          label="Les erreurs à montrer"
          onglets={ETATS_DU_TRI.map(id => ({ id, nom: NOM_DE_L_ETAT[id], ...(compte[id] > 0 && { pastille: { n: compte[id], label: NOM_DE_L_ETAT[id].toLowerCase(), entier: true as const } }) }))}
          actif={onglet}
          onChoisir={setOnglet}
          idOnglet={id => `erreurs-onglet-${id}`}
          idPanneau={id => `erreurs-panneau-${id}`}
        />
        <div role="tabpanel" id={`erreurs-panneau-${onglet}`} aria-labelledby={`erreurs-onglet-${onglet}`}>
          {liste.length === 0 ? (
            <p className="muted small">{page.erreurs.length === 0 && page.sansDetail.length === 0 ? 'Aucune erreur serveur cette semaine.' : RIEN[onglet]}</p>
          ) : (
            <ul className="qg-liste">
              {liste.map(e => (
                <li key={e.cle}>
                  <button type="button" className="qg-ligne" onClick={() => setOuverte(e.cle)}>
                    <span className={'qg-rond' + (e.tri.etat === 'a-regarder' ? ' qg-rond-alerte' : '')} aria-hidden="true">
                      <Icon name={e.tri.revenue ? 'rotate' : ICONE_DE_L_ETAT[e.tri.etat]} />
                    </span>
                    <span className="qg-ligne-texte">
                      <span className="qg-source">{e.source}</span>
                      <b className="qg-echec-message">{e.message ? `${e.nom} : ${e.message}` : e.nom}</b>
                      <span className="muted small">{[fois(e.n), `la dernière ${quandDuServeur(e.derniere, maintenant)}`, e.ou].filter(Boolean).join(' · ')}</span>
                      {e.tri.revenue && <span className="qg-ecart qg-ecart-moins">Revenue après avoir été réglée</span>}
                      {e.tri.etat !== 'a-regarder' && <span className="muted small">{espacesFines(triEcrit(e.tri, maintenant))}</span>}
                      {e.tri.encoreSousLAncienne && <span className="muted small">Retombée depuis sous une version qui l’avait déjà vue : la réparation n’est pas encore en ligne.</span>}
                    </span>
                    <Icon name="chevron-right" className="qg-chevron" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {/* Sous « À regarder » seulement : elles comptent à l'alerte, mais ne se règlent ni ne s'ignorent. */}
        {onglet === 'a-regarder' && page.sansDetail.length > 0 && (
          <div className="qg-fiche-groupe">
            {/* Comptées, jamais perdues : d'avant le détail, ou au-delà de douze dans l'heure (`ERREURS_EN_DETAIL`). Rien ne s'y trie. */}
            <p className="muted small">Comptées sans leur détail — d’avant le 17 octobre 2026, ou au-delà de douze dans l’heure —, elles ne se trient pas :</p>
            <ul className="qg-liste qg-sources">
              {page.sansDetail.map(s => (
                <li key={s.source}>
                  <span className="qg-source">{s.source}</span>
                  <span className="num">{erreurs(s.n)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <SurTonTelephone alertes={page.alertes} onAlertes={onAlertes} maintenant={maintenant} />

      {laFiche && (
        <FeuilleDUneErreur
          // Une autre erreur ouverte repart de son propre mot.
          key={laFiche.cle}
          erreur={laFiche}
          page={page}
          onFermer={() => setOuverte(null)}
          trier={
            trier &&
            (async (etat, note) => {
              await trier(laFiche.cle, etat, note)
              setOuverte(null)
              showToast({ kind: 'info', message: espacesFines(APRES_LE_TRI[etat]) })
            })
          }
        />
      )}
    </>
  )
}

/**
 * Les modes en panne à l'instant : depuis quand, combien d'échecs, la route
 * qui les a fait tomber. Ce que la notification a dit, et ce qui la fera
 * dire « Rétabli ».
 */
function EnPanne({ pannes, maintenant }: { pannes: PanneDUnMode[]; maintenant: number }) {
  return (
    <section className="qg-carte qg-erreurs-panne" aria-labelledby="erreurs-pannes">
      <div className="qg-carte-tete">
        <h2 id="erreurs-pannes">En panne maintenant</h2>
      </div>
      <ul className="qg-liste">
        {pannes.map(p => (
          <li key={p.mode} className="qg-ligne">
            <span className="qg-rond qg-rond-alerte" aria-hidden="true">
              <Icon name="alert" />
            </span>
            <span className="qg-ligne-texte">
              <b>{capitale(NOM_DU_MODE_SURVEILLE[p.mode])}</b>
              <span className="muted small">
                {`Depuis ${quandEcrit(p.depuis, maintenant)} · ${formatNumber(p.echecs)} échec${p.echecs > 1 ? 's' : ''}, le dernier ${quandEcrit(p.dernierEchec, maintenant)}`}
              </span>
              <span className="qg-source">{p.source}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="muted small">
        {espacesFines(
          'Rétabli quand chaque route tombée aura réussi de nouveau, sans un échec pendant un quart d’heure : les téléphones prévenus le diront.',
        )}
      </p>
    </section>
  )
}

/**
 * La fiche d'une erreur et ce qu'on en fait : son tri — un mot, si l'on veut
 * (« PR #284 », « un hoquet de Turso ») —, puis ce que la page « Le serveur »
 * en disait, et de quoi copier son détail.
 */
function FeuilleDUneErreur({
  erreur: e,
  page,
  onFermer,
  trier,
}: {
  erreur: ErreurATrier
  page: PageDesErreurs
  onFermer: () => void
  trier?: (etat: EtatDUneErreur, note: string | null) => Promise<void>
}) {
  const [note, setNote] = useState(e.tri.note ?? '')
  const [occupe, setOccupe] = useState(false)
  const etat = e.tri.etat
  const motChange = etat !== 'a-regarder' && note.trim() !== (e.tri.note ?? '')
  const faire = async (vers: EtatDUneErreur) => {
    if (!trier || occupe) return
    setOccupe(true)
    try {
      await trier(vers, vers === 'a-regarder' ? null : note)
    } catch (err) {
      showToast({ kind: 'error', message: motifDe(err) })
      setOccupe(false)
    }
  }
  // Le geste qui l'avance : la régler, la remettre à regarder — ou garder son mot changé.
  const principal: { vers: EtatDUneErreur; nom: string; icone: IconName } = motChange
    ? { vers: etat, nom: 'Garder le mot', icone: 'check' }
    : etat === 'a-regarder'
      ? { vers: 'reglee', nom: 'Réglée', icone: 'check' }
      : { vers: 'a-regarder', nom: 'Remettre à regarder', icone: 'rotate' }
  const autre: { vers: EtatDUneErreur; nom: string; icone: IconName } =
    etat === 'ignoree' ? { vers: 'reglee', nom: 'Réglée', icone: 'check' } : { vers: 'ignoree', nom: 'Ignorer : sans gravité', icone: 'eye-off' }
  return (
    <Feuille
      // Sa sorte seule : avec son code, « LibsqlError · SQLITE_BUSY » passait sur deux lignes au téléphone.
      titre={e.nom}
      onFermer={onFermer}
      pied={
        trier && (
          <button type="button" className={'btn btn-block' + (principal.vers === 'a-regarder' ? '' : ' btn-primary')} aria-disabled={occupe || undefined} onClick={() => void faire(principal.vers)}>
            <Icon name={principal.icone} />
            {occupe ? '…' : principal.nom}
          </button>
        )
      }
    >
      <p className={'qg-erreurs-etat' + (etat === 'a-regarder' ? ' qg-erreurs-etat-alerte' : '')}>
        <Icon name={e.tri.revenue ? 'rotate' : ICONE_DE_L_ETAT[etat]} />
        <span>{espacesFines(etat === 'a-regarder' && !e.tri.revenue ? 'À regarder' : triEcrit(e.tri, page.maintenant))}</span>
      </p>
      {trier && (
        <>
          <label className="label" htmlFor="erreur-note">
            {etat === 'a-regarder' ? 'Un mot, si tu veux' : 'Son mot'}
          </label>
          {/* Pas d'autoFocus : au téléphone, le clavier cacherait la fiche. */}
          <input
            id="erreur-note"
            className="input"
            maxLength={NOTE_D_UNE_ERREUR_MAX}
            value={note}
            placeholder="PR #284, un hoquet de Turso…"
            onChange={ev => setNote(ev.target.value)}
          />
          <button type="button" className="btn btn-block btn-ghost" aria-disabled={occupe || undefined} onClick={() => void faire(autre.vers)}>
            <Icon name={autre.icone} />
            {autre.nom}
          </button>
        </>
      )}
      <FicheDeLErreur erreur={e} page={page} />
      <button
        type="button"
        className="lien-discret qg-suite"
        onClick={async () => {
          const copie = await copierTexte(texteDeLErreur(e, page))
          showToast({ kind: copie ? 'info' : 'error', message: copie ? 'Détail copié' : 'Copie impossible : sélectionne-le à la main' })
        }}
      >
        <Icon name="copy" />
        Copier le détail
      </button>
    </Feuille>
  )
}

/** « 2 téléphones prévenus », « un téléphone prévenu ». */
const prevenus = (n: number) => (n === 1 ? 'Un téléphone prévenu' : `${formatNumber(n)} téléphones prévenus`)

/**
 * Les alertes sur le téléphone de l'administrateur : celui-ci, s'il sait les
 * recevoir, et ceux qui sonnent déjà — cinq au plus. Une notification à la
 * panne d'un mode, une autre à son retour ; rien d'autre ne sonne.
 */
function SurTonTelephone({ alertes, onAlertes, maintenant }: { alertes: PageDesErreurs['alertes']; onAlertes?: (a: PageDesErreurs['alertes']) => void; maintenant: number }) {
  // Lu dans le navigateur, après l'affichage : rien à dire de ce téléphone avant.
  const [ici, setIci] = useState<{ etat: EtatDesAlertes | null; empreinte: string | null }>({ etat: null, empreinte: null })
  const [occupe, setOccupe] = useState<string | null>(null)
  useEffect(() => {
    let vivant = true
    preparerLesAlertes(alertes.cle, alertes.telephones).then(
      lu => vivant && setIci(lu),
      () => vivant && setIci({ etat: 'impossible', empreinte: null }),
    )
    return () => {
      vivant = false
    }
  }, [alertes])

  const geste = async (quoi: string, faire: () => Promise<void>) => {
    if (occupe) return
    setOccupe(quoi)
    try {
      await faire()
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(null)
    }
  }
  const allumer = () =>
    geste('allumer', async () => {
      // Sans clé, le bouton se dit grisé, et la ligne dessous dit pourquoi.
      if (!alertes.cle) return
      const r = await allumerLesAlertes(alertes.cle)
      if ('etat' in r) return setIci({ etat: r.etat, empreinte: null })
      setIci({ etat: 'actif', empreinte: r.empreinte })
      onAlertes?.(r.alertes)
      showToast({ kind: 'info', message: 'Ce téléphone sonnera à la panne d’un mode' })
    })
  const retirer = (empreinte: string) =>
    geste(empreinte, async () => {
      // Celui-ci se désabonne aussi chez son service de push ; un autre, le serveur seul l'oublie.
      const lui = empreinte === ici.empreinte
      const a = lui ? await eteindreLesAlertes(empreinte) : await api.admin.plusDAlertes(empreinte)
      if (lui) setIci({ etat: 'inactif', empreinte: null })
      onAlertes?.(a)
      showToast({ kind: 'info', message: lui ? 'Ce téléphone ne sonnera plus' : 'Ce téléphone-là ne sonnera plus' })
    })
  const essayer = () =>
    geste('essai', async () => {
      const r = await api.admin.essaiDAlerte()
      onAlertes?.({ cle: r.cle, telephones: r.telephones })
      showToast(
        r.envoyes > 0
          ? { kind: 'info', message: `Essai parti : ${r.envoyes > 1 ? `${formatNumber(r.envoyes)} téléphones vont sonner` : 'un téléphone va sonner'}` }
          : { kind: 'error', message: 'L’essai n’est pas parti : réessaie dans un instant' },
      )
    })

  const { telephones } = alertes
  return (
    <section className="qg-carte" aria-labelledby="erreurs-telephone">
      <div className="qg-carte-tete">
        <h2 id="erreurs-telephone">Sur ton téléphone</h2>
      </div>
      <p className="muted small">
        {espacesFines(
          'Quand un mode de jeu tombe en panne — une route qui échoue trois fois en dix minutes, et plus souvent qu’elle ne réussit —, tes téléphones prévenus sonnent, puis encore à son retour. Rien d’autre ne sonne : ni une erreur seule, ni un mot de passe faux.',
        )}
      </p>
      {ici.etat === 'impossible' && (
        <p className="muted small">
          {espacesFines(
            'Ce navigateur ne sait pas recevoir de notification. Sur iPhone : ajoute FiestApp à l’écran d’accueil — Partager, puis « Sur l’écran d’accueil » —, et ouvre le QG depuis l’application.',
          )}
        </p>
      )}
      {ici.etat === 'bloque' && <p className="muted small">{espacesFines('Les notifications sont refusées à ce navigateur : rouvre-les dans ses réglages, puis reviens ici.')}</p>}
      {ici.etat === 'inactif' && (
        <div className="admin-gestes">
          <button type="button" className="salon-geste admin-geste-oui" aria-disabled={!alertes.cle || occupe !== null || undefined} onClick={() => void allumer()}>
            <Icon name="bell" />
            {occupe === 'allumer' ? '…' : 'Prévenir ce téléphone'}
          </button>
        </div>
      )}
      {ici.etat === 'inactif' && !alertes.cle && <p className="muted small">Le serveur n’a pas encore ses clés : recharge la page dans un instant.</p>}
      {ici.etat === 'actif' && (
        <p className="qg-erreurs-etat">
          <Icon name="bell" />
          <span>Ce téléphone sonnera.</span>
        </p>
      )}
      {telephones.length > 0 && (
        <div className="qg-fiche-groupe">
          <p className="label">{prevenus(telephones.length)}</p>
          <ul className="qg-liste">
            {telephones.map(t => (
              <li key={t.empreinte} className="qg-erreurs-telephone">
                <span className="qg-ligne-texte">
                  <b>
                    {t.service}
                    {t.empreinte === ici.empreinte && ' — celui-ci'}
                  </b>
                  <span className="muted small">{`Depuis ${quandEcrit(t.depuis, maintenant)}`}</span>
                </span>
                <button type="button" className="salon-geste" aria-disabled={occupe !== null || undefined} onClick={() => void retirer(t.empreinte)}>
                  <Icon name="bell-off" />
                  {occupe === t.empreinte ? '…' : 'Retirer'}
                </button>
              </li>
            ))}
          </ul>
          <div className="admin-gestes">
            <button type="button" className="salon-geste" aria-disabled={occupe !== null || undefined} onClick={() => void essayer()}>
              <Icon name="sparkles" />
              {occupe === 'essai' ? '…' : telephones.length > 1 ? 'Faire sonner mes téléphones' : 'Faire sonner mon téléphone'}
            </button>
          </div>
          {telephones.length >= TELEPHONES_PREVENUS_MAX && (
            <p className="muted small">{`${TELEPHONES_PREVENUS_MAX} au plus : un de plus remplace le plus ancien.`}</p>
          )}
        </div>
      )}
    </section>
  )
}
