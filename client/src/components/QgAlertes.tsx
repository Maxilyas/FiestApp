import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from './Icon'
import { useLargeur } from './QgGraphes'
import { espacesFines, formatNumber } from '../../../shared/typographie'
import { dureeEcrite, heureEcrite, jourAbrege, quandEcrit } from '../../../shared/qg'
import { jourAvant, jourDe, jourEnToutesLettres } from '../../../shared/jour'
import { lireNombre } from '../../../shared/nombres'
import { HEURE_DU_POINT_MAX, HEURE_DU_POINT_MIN, heureDuPointEcrite, type EtatDuPoint } from '../../../shared/pointDuMatin'
import {
  GRAVITES,
  JOURS_DE_LA_FRISE,
  MOT_D_UN_INCIDENT_MAX,
  NOM_DE_LA_GRAVITE,
  REGLE,
  chiffresDesIncidents,
  seuilEcrit,
  type CleDeRegle,
  type IncidentDuQg,
  type PageDUneRegle,
  type PageDesAlertes,
  type RegleALaPage,
} from '../../../shared/qgAlertes'

/** Les règles se jugent chaque minute au serveur : la page se relit au même pas, tant qu'elle est visible. */
const RELECTURE_MS = 60_000

/**
 * « Nouvelle » se dit la première semaine des règles venues avec la page (le
 * 4 novembre 2026) : posé pour toujours, le mot ne disait plus rien (la revue
 * d'ergonomie du même jour).
 */
const NOUVELLES_JUSQU_AU = Date.UTC(2026, 10, 11)

/**
 * Les alertes et les incidents (`/admin#alertes`, sous « Commande », le QG 2,
 * lot 8 ; la proposition du 3 novembre 2026) : ce qui sonne, à partir de
 * quand, et où — au QG seulement, ou sur le téléphone aussi. Chaque règle et
 * son seuil, qui se règle ici — un réglage d'exploitation : les barèmes du jeu
 * restent dans le code —, puis les incidents des trois dernières semaines sur
 * une frise, et chacun sa cause et un mot.
 */
export function QgAlertes({ ouvrir }: { ouvrir: (e: PageDUneRegle | 'erreurs', onglet?: string) => void }) {
  const [page, setPage] = useState<PageDesAlertes | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let perimee = false
    const relire = () => {
      if (document.visibilityState !== 'visible') return
      api.admin.regles().then(
        p => !perimee && setPage(p),
        e => !perimee && setError(motifDe(e)),
      )
    }
    relire()
    const tour = setInterval(relire, RELECTURE_MS)
    return () => {
      perimee = true
      clearInterval(tour)
    }
  }, [])

  if (error && !page) return <p className="error">{error}</p>
  if (!page) return <p className="serif-note">Chargement…</p>
  const chiffres = chiffresDesIncidents(page.incidents, page.maintenant)
  const ouvertes = page.regles.filter(r => r.ouverte)
  return (
    <>
      <p className="muted small">
        Ce qui sonne, à partir de quand, et où : au QG seulement, ou sur ton téléphone aussi. Chaque règle se juge toutes les minutes sur ce que le serveur sait
        déjà ; un seuil se règle ici — un réglage d’exploitation, les barèmes du jeu restent dans le code.
      </p>
      {error && <p className="error">{error}</p>}
      <section className="qg-chiffres" aria-labelledby="alertes-chiffres">
        <div className="qg-section-tete">
          <h2 className="compte-groupe" id="alertes-chiffres">
            Trente jours
          </h2>
        </div>
        <ul className="qg-tuiles qg-tuiles-quatre">
          <li className={'qg-tuile' + (ouvertes.length > 0 ? ' qg-tuile-alerte' : '')}>
            <span className="qg-tuile-nom">Alertes ouvertes</span>
            <span className="qg-tuile-valeur num">{formatNumber(ouvertes.length)}</span>
            <span className="qg-ecart qg-tuile-detail">{ouvertes.length ? ouvertes.map(r => REGLE[r.cle].nom.toLowerCase()).join(', ') : 'tout est au calme'}</span>
          </li>
          <li className="qg-tuile">
            <span className="qg-tuile-nom">Incidents</span>
            <span className="qg-tuile-valeur num">{formatNumber(chiffres.n)}</span>
            <span className="qg-ecart qg-tuile-detail">{chiffres.critiques ? `dont ${formatNumber(chiffres.critiques)} critique${chiffres.critiques > 1 ? 's' : ''}` : 'aucun critique'}</span>
          </li>
          <li className="qg-tuile">
            <span className="qg-tuile-nom">Retour au calme</span>
            <span className="qg-tuile-valeur num">{chiffres.retourMedianMs === null ? '–' : dureeEcrite(chiffres.retourMedianMs)}</span>
            <span className="qg-ecart qg-tuile-detail">la médiane des incidents clos</span>
          </li>
          <li className="qg-tuile">
            <span className="qg-tuile-nom">Modes disponibles</span>
            <span className="qg-tuile-valeur num">{`${formatNumber(chiffres.disponibilite)} %`}</span>
            <span className="qg-ecart qg-tuile-detail">{chiffres.pannesMs > 0 ? `${dureeEcrite(chiffres.pannesMs)} de panne d’un mode` : 'aucune panne d’un mode'}</span>
          </li>
        </ul>
      </section>
      <LesRegles page={page} onPage={setPage} ouvrir={ouvrir} />
      <LaFrise incidents={page.incidents} maintenant={page.maintenant} />
      <LesIncidents incidents={page.incidents} maintenant={page.maintenant} onIncident={i => setPage(p => p && { ...p, incidents: p.incidents.map(x => (x.id === i.id ? i : x)) })} />
      <section className="qg-console" aria-labelledby="alertes-telephones">
        <div className="qg-console-tete">
          <div>
            <span className="qg-etiquette">Sur ton téléphone</span>
            <h2 id="alertes-telephones">
              {page.telephones === 0
                ? 'Aucun téléphone ne sonne'
                : `${formatNumber(page.telephones)} téléphone${page.telephones > 1 ? 's' : ''} prévenu${page.telephones > 1 ? 's' : ''}`}
            </h2>
            <span className="muted small">les règles marquées « Téléphone » les font sonner, à l’ouverture et au retour au calme</span>
          </div>
          <button type="button" className="qg-bouton" onClick={() => ouvrir('erreurs')}>
            {page.telephones === 0 ? 'Prévenir ce téléphone' : 'Gérer les téléphones'}
            <Icon name="arrow-right" />
          </button>
        </div>
      </section>
      {page.point && <PointDuMatinAuxAlertes point={page.point} telephones={page.telephones} maintenant={page.maintenant} onPage={setPage} />}
    </>
  )
}

/**
 * Le point du matin (la revue d'expert du 4 novembre 2026, P1.4), à côté des
 * téléphones qu'il fait sonner : son heure — un bouton qui l'ouvre à la saisie,
 * comme un seuil —, sa notification d'un interrupteur, et le dernier passé.
 * Un réglage de `qg_reglages`, au journal comme un seuil.
 */
function PointDuMatinAuxAlertes({ point, telephones, maintenant, onPage }: { point: EtatDuPoint; telephones: number; maintenant: number; onPage: (p: PageDesAlertes) => void }) {
  const [saisie, setSaisie] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')
  const regler = async (reglage: { actif?: boolean; minutes?: number }) => {
    setOccupe(true)
    setErreur('')
    try {
      onPage(await api.admin.reglerLePoint(reglage))
      return true
    } catch (e) {
      setErreur(motifDe(e))
      return false
    } finally {
      setOccupe(false)
    }
  }
  // « 08:40 », la valeur d'un champ d'heure, et retour : le champ garde ce qu'on tape, seul l'envoi le lit.
  const enChamp = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const lu = saisie && /^\d{2}:\d{2}$/.test(saisie) ? Number(saisie.slice(0, 2)) * 60 + Number(saisie.slice(3)) : null
  const d = point.dernier
  return (
    <section className="qg-console" aria-labelledby="alertes-point">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Chaque matin</span>
          <h2 id="alertes-point">Le point du matin</h2>
          <span className="muted small">
            la veille en nombres sur les téléphones prévenus — jamais un prénom ni un salon —, le lundi la semaine face aux quatre d’avant ; son passage écrit aussi la
            mémoire de la veille, que « Hier, en bref » montre en tête du poste de commande
          </span>
        </div>
        <button
          type="button"
          className="qg-bascule qg-regle-tel"
          aria-pressed={point.actif}
          disabled={occupe}
          onClick={() => void regler({ actif: !point.actif })}
          title="Faire sonner les téléphones prévenus chaque matin"
        >
          <span className="qg-interrupteur" aria-hidden="true" />
          Notification
        </button>
      </div>
      <div className="qg-regle-reglages">
        {saisie === null ? (
          <button type="button" className="qg-seuil" onClick={() => setSaisie(enChamp(point.minutes))} title="Régler l’heure du point">
            <Icon name="edit" />
            {heureDuPointEcrite(point.minutes)}
          </button>
        ) : (
          <form
            className="qg-seuil-saisie"
            onSubmit={async e => {
              e.preventDefault()
              if (lu === null) return
              if (await regler({ minutes: lu })) setSaisie(null)
            }}
          >
            <label>
              <span className="sr-only">L’heure du point du matin, à Paris</span>
              <input type="time" min="06:00" max="11:00" step={300} value={saisie} onChange={e => setSaisie(e.target.value)} aria-describedby="point-heure" />
            </label>
            <span id="point-heure" className="muted small">
              de {heureDuPointEcrite(HEURE_DU_POINT_MIN)} à {heureDuPointEcrite(HEURE_DU_POINT_MAX)}, de cinq en cinq minutes, d’office {heureDuPointEcrite(point.dOffice.minutes)}
            </span>
            <button type="submit" className="qg-bouton" disabled={occupe || lu === null}>
              Régler
            </button>
            <button type="button" className="qg-bouton" onClick={() => setSaisie(null)}>
              Annuler
            </button>
          </form>
        )}
        <span className="qg-regle-derniere small">
          {d === null
            ? 'pas encore passé'
            : `le dernier : ${jourDuDernier(d.jour, maintenant)}${
                d.envoyeLe === null ? ', sans notification' : `, à ${heureEcrite(d.envoyeLe)} — ${d.telephones === 1 ? 'un téléphone' : `${formatNumber(d.telephones ?? 0)} téléphones`}`
              }`}
        </span>
        {telephones === 0 && point.actif && <span className="qg-regle-derniere small">{espacesFines('aucun téléphone prévenu : il ne sonne chez personne')}</span>}
      </div>
      {erreur && (
        <p className="error small" role="alert">
          {erreur}
        </p>
      )}
    </section>
  )
}

/** Le jour du dernier point : « ce matin », « hier », « le 2 novembre ». */
function jourDuDernier(jour: string, maintenant: number): string {
  const aujourdhui = jourDe(maintenant)
  if (jour === aujourdhui) return 'ce matin'
  return jour === jourAvant(aujourdhui) ? 'hier' : `le ${jourEnToutesLettres(jour, true)}`
}

/** Les règles ouvertes d'abord, la plus grave en tête ; les autres dans l'ordre du catalogue. */
function rang(r: RegleALaPage, i: number): number {
  return (r.ouverte ? 0 : 1000) + GRAVITES.indexOf(REGLE[r.cle].gravite) * (r.ouverte ? 100 : 0) + i
}

/**
 * Chaque règle sur une ligne : son état, ce qu'elle guette, son seuil — un
 * bouton qui l'ouvre à la saisie —, sur quoi elle se juge, sa gravité, son
 * téléphone, et la dernière fois qu'elle s'est ouverte. Une colonne au
 * téléphone, une rangée à l'ordinateur.
 */
function LesRegles({ page, onPage, ouvrir }: { page: PageDesAlertes; onPage: (p: PageDesAlertes) => void; ouvrir: (e: PageDUneRegle, onglet?: string) => void }) {
  const [enCours, setEnCours] = useState<CleDeRegle | null>(null)
  const [erreur, setErreur] = useState<{ cle: CleDeRegle; motif: string } | null>(null)
  const regler = async (cle: CleDeRegle, reglage: { seuil?: number; telephone?: boolean }) => {
    setEnCours(cle)
    setErreur(null)
    try {
      onPage(await api.admin.reglerUneRegle(cle, reglage))
      return true
    } catch (e) {
      setErreur({ cle, motif: motifDe(e) })
      return false
    } finally {
      setEnCours(null)
    }
  }
  const regles = page.regles.map((r, i) => ({ r, i })).sort((a, b) => rang(a.r, a.i) - rang(b.r, b.i))
  return (
    <section className="qg-console" aria-labelledby="alertes-regles">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Les règles</span>
          <h2 id="alertes-regles">Ce qui sonne</h2>
          <span className="muted small">seize règles : six sonnaient déjà au QG, dix sont venues avec cette page et après elle</span>
        </div>
      </div>
      <ul className="qg-regles">
        {regles.map(({ r }) => {
          const regle = REGLE[r.cle]
          return (
            <li key={r.cle} className={'qg-regle' + (r.ouverte ? ` qg-regle-ouverte qg-regle-${regle.gravite}` : '')}>
              <span className="qg-regle-etat">
                <i className={`qg-voyant qg-voyant-${r.ouverte ? regle.gravite : 'ok'}`} aria-hidden="true" />
                <span>{r.ouverte ? `ouverte · ${heureEcrite(r.ouverte.depuis)}` : 'au calme'}</span>
              </span>
              <span className="qg-regle-texte">
                <button type="button" className="qg-regle-nom" onClick={() => ouvrir(regle.page, regle.onglet)}>
                  {regle.nom}
                  {regle.neuve && page.maintenant < NOUVELLES_JUSQU_AU && <span className="qg-regle-neuve">nouvelle</span>}
                </button>
                <span className="muted small">{r.ouverte ? r.ouverte.cause : regle.quoi}</span>
              </span>
              <span className="qg-regle-reglages">
                {r.seuil === null ? (
                  <span className="qg-regle-sans-seuil small">sans seuil</span>
                ) : (
                  <Seuil cle={r.cle} valeur={r.seuil} defaut={r.defaut ?? null} occupe={enCours === r.cle} regler={seuil => regler(r.cle, { seuil })} />
                )}
                <span className="qg-regle-sur small">sur {regle.sur}</span>
                <span className={`qg-gravite qg-gravite-${regle.gravite} small`}>{NOM_DE_LA_GRAVITE[regle.gravite]}</span>
                <button
                  type="button"
                  className="qg-bascule qg-regle-tel"
                  aria-pressed={r.telephone}
                  disabled={enCours === r.cle}
                  onClick={() => void regler(r.cle, { telephone: !r.telephone })}
                  title="Faire sonner les téléphones prévenus"
                >
                  <span className="qg-interrupteur" aria-hidden="true" />
                  Téléphone
                </button>
                <span className="qg-regle-derniere small">{r.derniere === null ? 'jamais ouverte' : `la dernière : ${quand(r.derniere, page.maintenant)}`}</span>
              </span>
              {erreur?.cle === r.cle && (
                <p className="error small qg-regle-erreur" role="alert">
                  {erreur.motif}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** « aujourd'hui à 21 h 40 », « hier à 8 h 00 », « le jeu. 29 oct. » : comme partout au QG. */
const quand = quandEcrit

/**
 * Un seuil : son chiffre, un bouton qui l'ouvre à la saisie. Le texte tapé
 * reste tel quel le temps de la frappe et se lit en le validant (`lireNombre` :
 * « 0,5 » vaut un demi) ; ses bornes, le serveur les dit en clair s'il le faut.
 * Son « d'office » est celui de ce serveur (`defaut`) : en préproduction, sa
 * part des heures de l'hébergeur.
 */
function Seuil({
  cle,
  valeur,
  defaut,
  occupe,
  regler,
}: {
  cle: CleDeRegle
  valeur: number
  defaut: number | null
  occupe: boolean
  regler: (v: number) => Promise<boolean>
}) {
  const [texte, setTexte] = useState<string | null>(null)
  const borne = REGLE[cle].seuil!
  if (texte === null) {
    return (
      <button type="button" className="qg-seuil" onClick={() => setTexte(String(valeur).replace('.', ','))} title="Régler le seuil">
        <Icon name="edit" />
        {seuilEcrit(cle, valeur)}
      </button>
    )
  }
  const lu = lireNombre(texte)
  return (
    <form
      className="qg-seuil-saisie"
      onSubmit={async e => {
        e.preventDefault()
        if (lu === null) return
        if (await regler(lu)) setTexte(null)
      }}
    >
      <label>
        <span className="sr-only">Le seuil de « {REGLE[cle].nom} », en {borne.unite}</span>
        <input type="text" inputMode="decimal" value={texte} onChange={e => setTexte(e.target.value)} aria-describedby={`seuil-${cle}`} />
      </label>
      <span id={`seuil-${cle}`} className="muted small">
        {borne.unite} · de {seuilEcrit(cle, borne.min)} à {seuilEcrit(cle, borne.max)}, d’office {seuilEcrit(cle, defaut ?? borne.defaut)}
      </span>
      <button type="submit" className="qg-bouton" disabled={occupe || lu === null}>
        Régler
      </button>
      <button type="button" className="qg-bouton" onClick={() => setTexte(null)}>
        Annuler
      </button>
    </form>
  )
}

const JOUR_MS = 86_400_000

/**
 * Les incidents des trois dernières semaines sur une frise, une ligne par
 * règle qui en a eu : plein, clos ; en contour, encore ouvert. Une barre
 * touchée dit sa règle, son début, sa durée et sa cause.
 */
function LaFrise({ incidents, maintenant }: { incidents: IncidentDuQg[]; maintenant: number }) {
  const [boite, largeur] = useLargeur(640)
  const debut = maintenant - JOURS_DE_LA_FRISE * JOUR_MS
  const recents = incidents.filter(i => (i.fin ?? maintenant) >= debut)
  const lignes = [...new Set(recents.map(i => i.regle))]
  const etiquette = Math.min(170, Math.round(largeur * 0.34))
  const utile = Math.max(1, largeur - etiquette - 8)
  const x = (t: number) => etiquette + ((Math.max(t, debut) - debut) / (maintenant - debut)) * utile
  const hauteur = lignes.length * 30 + 26
  const jours = Array.from({ length: JOURS_DE_LA_FRISE }, (_, k) => maintenant - (JOURS_DE_LA_FRISE - k) * JOUR_MS)
  const tous = largeur < 520 ? 7 : 3
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="alertes-frise">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="alertes-frise">Les trois dernières semaines</h2>
        <span className="muted small">plein : clos · en contour : encore ouvert</span>
      </div>
      {lignes.length === 0 ? (
        <p className="muted small">Aucun incident ces trois semaines.</p>
      ) : (
        <div ref={boite} className="qg-graphe">
          <svg viewBox={`0 0 ${largeur} ${hauteur}`} role="img" aria-label={`${formatNumber(recents.length)} incidents ces trois semaines, sur ${formatNumber(lignes.length)} règles.`}>
            <g className="qg-graphe-grille">
              {jours.map((t, k) =>
                k % tous === 0 ? <line key={t} x1={x(t)} x2={x(t)} y1={0} y2={hauteur - 20} /> : null,
              )}
            </g>
            <g className="qg-graphe-axe" textAnchor="middle">
              {jours.map((t, k) =>
                k % tous === 0 ? (
                  <text key={t} x={Math.min(largeur - 20, x(t))} y={hauteur - 6}>
                    {jourAbrege(jourDe(t))}
                  </text>
                ) : null,
              )}
            </g>
            {lignes.map((cle, k) => (
              <g key={cle}>
                <text className="qg-frise-regle" x={etiquette - 8} y={k * 30 + 19} textAnchor="end">
                  {REGLE[cle].nom}
                </text>
                <line className="qg-frise-ligne" x1={etiquette} x2={etiquette + utile} y1={k * 30 + 15} y2={k * 30 + 15} />
              </g>
            ))}
            {recents.map(i => {
              const k = lignes.indexOf(i.regle)
              const x1 = x(i.debut)
              const x2 = x(i.fin ?? maintenant)
              return (
                <rect
                  key={i.id}
                  className={`qg-frise-incident qg-gravite-${i.gravite}${i.fin === null ? ' qg-frise-ouvert' : ''}`}
                  x={x1 - 3}
                  y={k * 30 + 8}
                  width={Math.max(7, x2 - x1 + 6)}
                  height={14}
                  rx={4}
                >
                  <title>{`${REGLE[i.regle].nom} · ${quand(i.debut, maintenant)} · ${i.fin === null ? 'en cours' : dureeEcrite(i.fin - i.debut)} — ${i.cause}`}</title>
                </rect>
              )
            })}
          </svg>
        </div>
      )}
    </section>
  )
}

/**
 * Les incidents des trente jours, le plus récent d'abord : sa règle, quand,
 * combien de temps, sa cause — et un mot, comme une erreur triée (« un hoquet
 * de Turso », « réparé par 3b8f1c2 »), qui se note au journal.
 */
function LesIncidents({ incidents, maintenant, onIncident }: { incidents: IncidentDuQg[]; maintenant: number; onIncident: (i: IncidentDuQg) => void }) {
  const [plus, setPlus] = useState(false)
  const montres = plus ? incidents : incidents.slice(0, 12)
  return (
    <section className="qg-console" aria-labelledby="alertes-incidents">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Les incidents</span>
          <h2 id="alertes-incidents">Chacun sa cause, et un mot</h2>
          <span className="muted small">une règle ouverte, de sa première minute à cinq minutes de calme</span>
        </div>
        <span className="etiquette num">{formatNumber(incidents.length)}</span>
      </div>
      {incidents.length === 0 ? (
        <p className="muted small">Aucun incident ces trente jours.</p>
      ) : (
        <ul className="qg-liste">
          {montres.map(i => (
            <Incident key={i.id} incident={i} maintenant={maintenant} onIncident={onIncident} />
          ))}
        </ul>
      )}
      {incidents.length > 12 && (
        <button type="button" className="qg-bouton qg-plus" aria-expanded={plus} onClick={() => setPlus(!plus)}>
          <Icon name="chevron-down" />
          {plus ? 'Les plus récents seulement' : `Les ${formatNumber(incidents.length - 12)} d’avant`}
        </button>
      )}
    </section>
  )
}

function Incident({ incident: i, maintenant, onIncident }: { incident: IncidentDuQg; maintenant: number; onIncident: (i: IncidentDuQg) => void }) {
  const [mot, setMot] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  const enregistrer = async () => {
    if (mot === null) return
    setOccupe(true)
    setErreur('')
    try {
      onIncident(await api.admin.motDUnIncident(i.id, mot))
      setMot(null)
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setOccupe(false)
    }
  }
  return (
    <li className={'qg-ligne qg-incident' + (i.fin === null ? ' qg-incident-ouvert' : '')}>
      <span className={'qg-rond' + (i.gravite === 'veille' ? '' : ' qg-rond-alerte')}>
        <Icon name={i.fin === null ? 'alert' : 'check-circle'} />
      </span>
      <span className="qg-ligne-texte">
        <b>
          {REGLE[i.regle].nom} <span className={`qg-gravite qg-gravite-${i.gravite} small`}>{NOM_DE_LA_GRAVITE[i.gravite]}</span>
        </b>
        <span className="small">{i.cause}</span>
        <span className="muted small">
          {quand(i.debut, maintenant)} · {i.fin === null ? `en cours depuis ${dureeEcrite(maintenant - i.debut)}` : `${dureeEcrite(i.fin - i.debut)}, au calme à ${heureEcrite(i.fin)}`}
        </span>
        {mot === null ? (
          <span className="qg-incident-mot small">
            {i.mot && <span className="qg-incident-cite">{espacesFines(`« ${i.mot} »`)}</span>}
            <button type="button" className="qg-incident-changer" onClick={() => setMot(i.mot ?? '')}>
              <Icon name="edit" />
              {i.mot ? 'Changer le mot' : 'Ajouter un mot'}
            </button>
          </span>
        ) : (
          <form
            className="qg-incident-saisie"
            onSubmit={e => {
              e.preventDefault()
              void enregistrer()
            }}
          >
            <label>
              <span className="sr-only">Un mot sur cet incident</span>
              <input type="text" value={mot} maxLength={MOT_D_UN_INCIDENT_MAX} placeholder="Un hoquet de Turso, réparé par 3b8f1c2…" onChange={e => setMot(e.target.value)} />
            </label>
            <button type="submit" className="qg-bouton" disabled={occupe}>
              Enregistrer
            </button>
            <button type="button" className="qg-bouton" onClick={() => setMot(null)}>
              Annuler
            </button>
            {erreur && <span className="error small">{erreur}</span>}
          </form>
        )}
      </span>
    </li>
  )
}
