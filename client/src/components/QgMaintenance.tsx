import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { confirmDialog } from './Dialog'
import { Icon, type IconName } from './Icon'
import { showToast } from '../state'
import { espacesFines } from '../format'
import { quandEcrit } from '../../../shared/qg'
import {
  BANDEAU_MAX,
  PAGES_EN_MAINTENANCE,
  PAGES_FERMABLES,
  type EtatDUnePage,
  type EtatDeLaMaintenance,
  type PageEnMaintenance,
  type TesteurDUnePage,
} from '../../../shared/maintenance'
import type { ProfilDAdministration } from '../../../shared/profil'

const ICONE: Record<PageEnMaintenance, IconName> = {
  jour: 'sun',
  campagne: 'target',
  defi: 'trophy',
  duels: 'swords',
  // Un cadre : le musée qu'on remplit.
  cabinet: 'image',
  boutique: 'bag',
}

/** Les gestes d'une page : vers chacun des deux autres états, le plus attendu d'abord. */
const GESTES: Record<EtatDUnePage, { vers: EtatDUnePage; libelle: string; icone: IconName; oui?: boolean }[]> = {
  ouverte: [
    { vers: 'bientot', libelle: 'Bientôt disponible', icone: 'clock' },
    { vers: 'maintenance', libelle: 'Mettre en maintenance', icone: 'pause' },
  ],
  maintenance: [
    { vers: 'ouverte', libelle: 'Rouvrir', icone: 'play', oui: true },
    { vers: 'bientot', libelle: 'Bientôt disponible', icone: 'clock' },
  ],
  bientot: [
    { vers: 'ouverte', libelle: 'Ouvrir à tous', icone: 'play', oui: true },
    { vers: 'maintenance', libelle: 'Mettre en maintenance', icone: 'pause' },
  ],
}

/** Le texte tel que le serveur le gardera : ses blancs resserrés. */
const net = (texte: string) => texte.replace(/\s+/g, ' ').trim()

/**
 * La maintenance au QG (`/admin#maintenance`, sous « Piloter ») — le souhait
 * du propriétaire du 19 octobre 2026, le jour où le quiz du jour et les défis
 * ne s'ouvraient plus en production : prévenir les joueurs d'un bandeau
 * rouge, et fermer ce qui ne marche pas le temps de le réparer, « pour pas
 * que les gens tentent d'accéder à quelque chose qui ne marche pas » ; puis,
 * le même jour, annoncer pour bientôt ce qui n'est pas prêt — l'Expédition,
 * qu'il essayait encore —, ouvert à ses seuls testeurs. Tout se lit à la page
 * suivante qu'ils ouvrent (`shared/maintenance.ts`) ; chaque geste va au
 * journal. La panne réglée, le bandeau se retire, et la page des annonces le
 * dit à chacun, une fois (`QgAnnonces`, `versLesAnnonces`).
 */
export function QgMaintenance({ onEtat, versLesAnnonces }: { onEtat: (etat: EtatDeLaMaintenance) => void; versLesAnnonces: () => void }) {
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

  /** Un geste à la fois : un double toucher ne fermerait pas deux fois. Rend vrai s'il est passé. */
  const geste = async (cle: string, faire: () => Promise<EtatDeLaMaintenance>, dit: string): Promise<boolean> => {
    if (occupe) return false
    setOccupe(cle)
    try {
      recevoir(await faire())
      showToast({ kind: 'info', message: dit })
      return true
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
      return false
    } finally {
      setOccupe(null)
    }
  }

  if (error) return <p className="error">{error}</p>
  if (!etat) return <p className="serif-note">Chargement…</p>

  const affiche = etat.bandeau
  const ecrit = net(texte)
  const longueur = Array.from(ecrit).length
  const etatDe = (p: PageEnMaintenance): EtatDUnePage => (etat.pages[p] !== null ? 'maintenance' : etat.bientot[p] !== null ? 'bientot' : 'ouverte')
  const enMaintenance = PAGES_EN_MAINTENANCE.filter(p => etat.pages[p] !== null).length
  const bientot = PAGES_EN_MAINTENANCE.filter(p => etat.bientot[p] !== null).length

  const changer = async (page: PageEnMaintenance, vers: EtatDUnePage) => {
    const { nom, ferme } = PAGES_FERMABLES[page]
    const avant = etatDe(page)
    // Ce qui ferme une page, ou l'ouvre à tous, se confirme ; rouvrir après une réparation, non : c'est ce qu'on attendait.
    const question =
      vers === 'maintenance'
        ? {
            title: `${nom} en maintenance ?`,
            message: `${ferme}. Les joueurs liront qu’une réparation est en cours, et rien n’y commencera plus ; une partie déjà à l’écran se finit. Toi, tu y entres encore.`,
            confirmLabel: 'Mettre en maintenance',
          }
        : vers === 'bientot'
          ? {
              title: `${nom} : bientôt disponible ?`,
              message: `${ferme}. Les joueurs liront « ${PAGES_FERMABLES[page].bientot} », et rien n’y commencera plus ; une partie déjà à l’écran se finit. Toi et ses testeurs, vous y entrez.`,
              confirmLabel: 'Bientôt disponible',
            }
          : avant === 'bientot'
            ? {
                title: `${nom} pour tout le monde ?`,
                message: 'Chaque joueur y entre dès la page suivante qu’il ouvre. Ses testeurs restent notés, pour une prochaine fois.',
                confirmLabel: 'Ouvrir à tous',
              }
            : null
    if (question && !(await confirmDialog({ ...question, message: espacesFines(question.message) }))) return
    // « Page » dans ce qui se dit après : « Les duels : rouvert » ne s'accordait à rien.
    const dit =
      vers === 'maintenance'
        ? `Page en maintenance : ${nom}`
        : vers === 'bientot'
          ? `Page bientôt disponible : ${nom}`
          : avant === 'maintenance'
            ? `Page rouverte aux joueurs : ${nom}`
            : `Page ouverte à tous : ${nom}`
    await geste(`${page}:${vers}`, () => api.admin.changerLaPage(page, vers), dit)
  }

  return (
    <>
      <p className="muted small">
        {espacesFines(
          'Prévenir les joueurs d’un problème, fermer ce qui ne marche pas le temps de le réparer, ou garder pour quelques testeurs ce qui n’est pas encore prêt. Tout vaut dès la page suivante qu’ils ouvrent ; chaque geste va au journal.',
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
        {/* Le bandeau se lit en passant, et part avec la panne : dire qu'elle est réglée, c'est une annonce. */}
        <p className="muted small">
          {espacesFines('Réparé ? Retire le bandeau, rouvre la page, puis dis-le à chacun, une fois, en haut de son accueil — avec des confettis, si tu veux.')}
        </p>
        <button type="button" className="lien-discret qg-suite" onClick={versLesAnnonces}>
          <Icon name="megaphone" />
          Faire une annonce
        </button>
      </section>

      <section className="qg-carte" aria-labelledby="maintenance-pages">
        <div className="qg-carte-tete">
          <h2 id="maintenance-pages">Les pages</h2>
          {/* Ensemble au bout de la tête : posées l'une après l'autre, la tête les écartait d'un bord à l'autre. */}
          {(enMaintenance > 0 || bientot > 0) && (
            <span className="maintenance-etiquettes">
              {enMaintenance > 0 && <span className="etiquette etiquette-alerte">{`${enMaintenance} en maintenance`}</span>}
              {bientot > 0 && <span className="etiquette">{`${bientot} bientôt`}</span>}
            </span>
          )}
        </div>
        <p className="muted small">
          {espacesFines(
            'En maintenance, une page dit aux joueurs qu’on la répare ; bientôt disponible, qu’elle arrive, et ne s’ouvre qu’à ses testeurs. Fermée, son bouton de l’accueil s’éteint, et rien n’y commence — ni partie, ni départ, ni achat ; une partie déjà à l’écran se finit. Toi, tu y entres toujours. Les soirées ne se ferment pas : une salle entière joue derrière l’écran commun.',
          )}
        </p>
        <ul className="qg-liste maintenance-gestes">
          {PAGES_EN_MAINTENANCE.map(p => {
            const ici = etatDe(p)
            const avecLaCampagne = p === 'defi' && ici === 'ouverte' && etatDe('campagne') !== 'ouverte'
            const testeurs = etat.testeurs[p]
            return (
              <li key={p} className={'maintenance-page' + (ici === 'maintenance' ? ' maintenance-fermee' : ici === 'bientot' ? ' maintenance-bientot' : '')}>
                <span className="maintenance-page-icone" aria-hidden="true">
                  <Icon name={ICONE[p]} />
                </span>
                <div className="maintenance-page-corps">
                  <span className="maintenance-page-texte">
                    <b>{PAGES_FERMABLES[p].nom}</b>
                    <span className="muted small">{espacesFines(PAGES_FERMABLES[p].ferme)}</span>
                    {ici === 'maintenance' && <span className="maintenance-depuis">{`En maintenance, ${quandEcrit(etat.pages[p]!, etat.maintenant)}`}</span>}
                    {ici === 'bientot' && (
                      <span className="maintenance-bientot-depuis">
                        {`Bientôt disponible, ${quandEcrit(etat.bientot[p]!, etat.maintenant)} · ${testeurs.length === 0 ? 'aucun testeur' : `${testeurs.length} testeur${testeurs.length > 1 ? 's' : ''}`}`}
                      </span>
                    )}
                    {avecLaCampagne && <span className="muted small">Fermé avec la campagne</span>}
                  </span>
                  <div className="maintenance-page-gestes">
                    {GESTES[ici].map(g => (
                      <button
                        key={g.vers}
                        type="button"
                        className={'salon-geste' + (g.oui ? ' admin-geste-oui' : '')}
                        aria-disabled={occupe !== null || undefined}
                        onClick={() => void changer(p, g.vers)}
                      >
                        <Icon name={g.icone} />
                        {occupe === `${p}:${g.vers}` ? '…' : g.libelle}
                      </button>
                    ))}
                  </div>
                  {ici === 'bientot' && <TesteursDeLaPage page={p} testeurs={testeurs} occupe={occupe} geste={geste} />}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}

/**
 * Les testeurs d'une page bientôt disponible : ceux qui y entrent avant tout
 * le monde (le souhait du propriétaire du 19 octobre 2026 : « pouvoir
 * autoriser l'accès à des personnes si je veux qu'ils testent »). On les
 * cherche comme dans « Les profils », par leur prénom ou leur identifiant ;
 * un profil suspendu ne s'ajoute pas — il ne se connecte plus.
 */
function TesteursDeLaPage({
  page,
  testeurs,
  occupe,
  geste,
}: {
  page: PageEnMaintenance
  testeurs: TesteurDUnePage[]
  occupe: string | null
  geste: (cle: string, faire: () => Promise<EtatDeLaMaintenance>, dit: string) => Promise<boolean>
}) {
  const [cherche, setCherche] = useState('')
  const [trouves, setTrouves] = useState<ProfilDAdministration[] | null>(null)

  useEffect(() => {
    const q = cherche.trim()
    if (!q) {
      setTrouves(null)
      return
    }
    // Le temps de finir le mot, et une recherche partie avant la suivante ne remplace jamais sa liste.
    let perimee = false
    const minuteur = setTimeout(() => {
      api.admin.profils(q).then(
        l => !perimee && setTrouves(l.profils),
        e => !perimee && showToast({ kind: 'error', message: motifDe(e) }),
      )
    }, 250)
    return () => {
      perimee = true
      clearTimeout(minuteur)
    }
  }, [cherche])

  const deja = new Set(testeurs.map(t => t.id))
  const proposes = (trouves ?? []).filter(p => !deja.has(p.id) && !p.suspendu).slice(0, 5)
  const nom = PAGES_FERMABLES[page].nom

  return (
    <div className="maintenance-testeurs">
      <span className="label">Ses testeurs</span>
      {testeurs.length === 0 ? (
        <p className="muted small">{espacesFines('Personne encore : toi seul y entres. Ajoute ceux qui l’essaieront, par leur prénom ou leur identifiant.')}</p>
      ) : (
        <ul className="maintenance-testeurs-liste">
          {testeurs.map(t => (
            <li key={t.id}>
              <span className="maintenance-testeur">
                <b>{espacesFines(t.nom)}</b> <span className="muted small">@{t.login}</span>
              </span>
              <button
                type="button"
                className="salon-geste"
                aria-disabled={occupe !== null || undefined}
                aria-label={`Retirer ${t.nom} des testeurs`}
                onClick={() => void geste(`${page}:${t.id}`, () => api.admin.retirerUnTesteur(page, t.id), `Testeur retiré : ${t.nom}`)}
              >
                <Icon name="x" />
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="champ-recherche">
        <Icon name="search" />
        <input
          className="input"
          type="search"
          value={cherche}
          placeholder="Ajouter un testeur : prénom, identifiant…"
          aria-label={`Chercher un testeur pour ${nom}`}
          onChange={e => setCherche(e.target.value)}
        />
      </label>
      {trouves && proposes.length === 0 && <p className="muted small">Aucun autre profil ne correspond.</p>}
      {proposes.length > 0 && (
        <ul className="maintenance-testeurs-liste">
          {proposes.map(p => (
            <li key={p.id}>
              <span className="maintenance-testeur">
                <b>{espacesFines(p.nom)}</b> <span className="muted small">{`@${p.login}${p.toi ? ' · toi' : ''}`}</span>
              </span>
              <button
                type="button"
                className="salon-geste admin-geste-oui"
                aria-disabled={occupe !== null || undefined}
                aria-label={`Ajouter ${p.nom} aux testeurs`}
                onClick={async () => {
                  if (await geste(`${page}:${p.id}`, () => api.admin.ajouterUnTesteur(page, p.id), `Testeur ajouté : ${p.nom}`)) setCherche('')
                }}
              >
                <Icon name="plus" />
                Ajouter
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
