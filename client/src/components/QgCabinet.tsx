import { useEffect, useState, type ReactNode } from 'react'
import { api, motifDe } from '../api'
import { Icon } from './Icon'
import { Feuille } from './Pieces'
import { Chiffre, GabaritDUnMode } from './QgModes'
import { GrapheDuTemps, type SerieDuGraphe } from './QgGraphes'
import { reperesDeLaCourbe, useReperesDuQg } from '../qgReperes'
import { minuitDuJour } from '../../../shared/qgJoueurs'
import { FicheDuJoueurAuQg, confirmerLeRendu } from './QgFicheJoueur'
import { supprimerLeProfil } from './AdminProfils'
import { showToast } from '../state'
import { espacesFines } from '../format'
import { formatNumber } from '../../../shared/typographie'
import { jourAvant, jourEnToutesLettres } from '../../../shared/jour'
import { dureeCourteEcrite, dureeEcrite, jourAbrege, quandEcrit, type VueDEnsemble } from '../../../shared/qg'
import type { PeriodeDuQg } from '../../../shared/qgPeriodes'
import { CLES_DES_JEUX, JEUX } from '../../../shared/cabinet/jeux/regle'
import { NOMS_DES_CARTES } from '../../../shared/cabinet/sceaux'
import { ACTES, type Acte } from '../../../shared/cabinet/traversee'
import { legendaire } from '../../../shared/legendaires'
import {
  JOUES_POUR_JUGER,
  etatDeLaTraverseeEnRoute,
  peutSeRendre,
  type IssuesDUnJour,
  type JoueurDuCabinet,
  type LigneDeContenu,
  type MarcheDeLEntonnoir,
  type PageDuCabinetAuQg,
  type TraverseeEnRouteAuQg,
} from '../../../shared/qgCabinet'

/**
 * Le Cabinet de curiosités au QG (`/admin#cabinet`, le 4 novembre 2026 — « J'ai pas aussi de page dédié au
 * cabinet », le propriétaire, la veille) : ses traversées sur trente jours et ce qu'elles sont devenues, celles en
 * route — et « Rendre » sur chacune —, du départ au légendaire, où l'on tombe, les jeux, les cartes et les
 * gardiens, le contenu, les joueurs. La campagne le garde parmi ses sous-modes ; ici, tout ce qu'il est.
 *
 * Des joueurs, rien que leur prénom et leur identifiant, et leur fiche au toucher ; aucun Divin — les gardiens de la
 * traversée n'en sont pas (invariant 21). Les issues se peignent en couleurs d'état, jamais en couleurs de modes :
 * une issue n'est pas un mode.
 */

/** Une espace insécable : au téléphone, « 0 » finissait une ligne et « signalement » ouvrait la suivante. */
const INSECABLE = ' '
/** « 1 traversée », « 0 traversée », « 12 traversées » : zéro s'écrit au singulier, le nombre collé à son mot. */
const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${formatNumber(n)}${INSECABLE}${n > 1 ? motPluriel : mot}`
/** Une part en pour cent, arrondie ; null quand rien ne la fonde. */
const part = (n: number, sur: number): number | null => (sur > 0 ? Math.round((n / sur) * 100) : null)
/** « 42 % », le signe collé au nombre ; « – » quand rien ne la fonde. */
const pourcents = (n: number | null) => (n === null ? '–' : `${formatNumber(n)}${INSECABLE}%`)
/** Ce qu'une liste montre d'abord ; « Et N de plus » montre le reste. */
const LIGNES_D_ABORD = 10
/** Une moyenne à une décimale : « 2,1 ». */
const uneDecimale = (x: number) => formatNumber(Math.round(x * 10) / 10)
const nomDuGardien = (cle: string) => legendaire(cle)?.nom ?? 'Un gardien'

/**
 * La page, et en tête le gabarit des modes (le QG 2, lot 5) : la courbe du Cabinet sur la période de la barre et
 * « En ce moment », sans ses tuiles — la page a les siennes, sur trente jours. Il ne lit que la vue d'ensemble et le
 * flux, déjà là : il n'attend pas la page.
 */
export function QgCabinet({
  versLaMaintenance,
  vue = null,
  periode = '24h',
  comparer = false,
}: {
  versLaMaintenance: () => void
  vue?: VueDEnsemble | null
  periode?: PeriodeDuQg
  comparer?: boolean
}) {
  const [page, setPage] = useState<PageDuCabinetAuQg | null>(null)
  const [error, setError] = useState('')
  const [relire, setRelire] = useState(0)
  useEffect(() => {
    api.admin.cabinet().then(
      p => {
        setPage(p)
        setError('')
      },
      e => setError(motifDe(e)),
    )
  }, [relire])

  const gabarit = (
    <GabaritDUnMode
      mode="cabinet"
      vue={vue}
      periode={periode}
      comparer={comparer}
      sansTuiles
      // Celles qui attendent leur joueur, de tout âge : la courbe ne compte que les épreuves qui commencent.
      enCeMoment={page && <span className="small">{page.enRouteEnTout > 0 ? `${pluriel(page.enRouteEnTout, 'traversée')} en route` : 'Aucune traversée en route'}</span>}
    />
  )
  if (error && !page)
    return (
      <>
        {gabarit}
        <p className="error">{error}</p>
      </>
    )
  if (!page)
    return (
      <>
        {gabarit}
        <p className="serif-note">Chargement…</p>
      </>
    )
  return (
    <>
      {gabarit}
      <CabinetAuQg page={page} apresUnGeste={() => setRelire(n => n + 1)} versLaMaintenance={versLaMaintenance} />
    </>
  )
}

/** La page lue : le tableau de bord, les traversées en route, les jeux, les cartes et les gardiens, le contenu, les joueurs. */
export function CabinetAuQg({ page, apresUnGeste, versLaMaintenance }: { page: PageDuCabinetAuQg; apresUnGeste?: () => void; versLaMaintenance?: () => void }) {
  const [ouvert, setOuvert] = useState<{ id: string; nom: string } | null>(null)
  const [occupe, setOccupe] = useState(false)

  /** « Rendre » depuis la liste : la confirmation de la fiche, puis la page se relit — refusé aussi : la traversée a bougé. */
  const rendre = async (t: TraverseeEnRouteAuQg) => {
    if (occupe || !(await confirmerLeRendu(t.profil.nom, t))) return
    setOccupe(true)
    try {
      await api.admin.rendreLaTraversee(t.profil.id, t.id)
      showToast({ kind: 'info', message: `Traversée rendue : ${t.profil.nom} peut en commencer une neuve` })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(false)
      apresUnGeste?.()
    }
  }
  const ouvrir = (p: { id: string; nom: string }) => setOuvert({ id: p.id, nom: p.nom })

  return (
    <>
      <p className="muted small">
        {espacesFines(
          'Trente jours de traversées : celles commencées depuis, ce qu’elles sont devenues, et celles encore en route, de tout âge. Une épreuve est une étape jouée de la carte, les assauts des gardiens compris.',
        )}
      </p>
      <TableauDeBord page={page} />
      <EnRoute page={page} occupe={occupe} ouvrir={ouvrir} rendre={t => void rendre(t)} />
      <div className="qg-deux qg-deux-haut">
        <DuDepartAuLegendaire page={page} />
        <OuLOnTombe page={page} />
      </div>
      <LesJeux page={page} />
      <div className="qg-deux qg-deux-haut">
        <LesCartes page={page} />
        <LesLegendaires page={page} />
      </div>
      <LesGardiens page={page} />
      <LeContenu page={page} />
      <LesJoueurs page={page} ouvrir={ouvrir} />
      <CeQuOnYFait versLaMaintenance={versLaMaintenance} />
      {ouvert && (
        <Feuille titre={ouvert.nom} onFermer={() => setOuvert(null)}>
          <FicheDuJoueurAuQg
            key={ouvert.id}
            profil={ouvert}
            onChange={f => {
              setOuvert({ id: f.id, nom: f.nom })
              apresUnGeste?.()
            }}
            onSupprimer={p => {
              void supprimerLeProfil(p).then(fait => {
                if (!fait) return
                setOuvert(null)
                apresUnGeste?.()
              })
            }}
          />
        </Feuille>
      )}
    </>
  )
}

// ── Le tableau de bord ─────────────────────────────────────────────────────

/**
 * Les issues d'une traversée, de bas en haut de la pile : l'ordre vérifié sur la nuit de la console — l'ambre, le
 * rouge, l'ardoise, le vert (`styles.css`, `.qg-cabinet-gagnee`). Celles que le QG a rendues rejoignent celles en
 * route : ni l'une ni l'autre n'a fini par le joueur.
 */
const ISSUES_DE_LA_PILE = [
  { cle: 'abandonnee', nom: 'Abandonnées', classe: 'qg-cabinet-abandonnee', valeur: (j: IssuesDUnJour) => j.abandonnee },
  { cle: 'perdue', nom: 'Perdues', classe: 'qg-cabinet-perdue', valeur: (j: IssuesDUnJour) => j.perdue },
  { cle: 'en-route', nom: 'En route', classe: 'qg-cabinet-en-route', valeur: (j: IssuesDUnJour) => j['en-route'] + j.rendue },
  { cle: 'gagnee', nom: 'Gagnées', classe: 'qg-cabinet-gagnee', valeur: (j: IssuesDUnJour) => j.gagnee },
] as const

/** Sous l'axe, un jour sur quelques-uns, comptés depuis aujourd'hui : autant qu'il en tient, jamais l'un sur l'autre. */
function axeDesJours(jours: readonly string[]) {
  return (i: number, largeur: number): string | null => {
    const n = jours.length
    const saut = Math.ceil(n / Math.max(2, Math.floor((largeur - 40) / 72)))
    if ((n - 1 - i) % saut !== 0) return null
    return i === n - 1 ? 'aujourd’hui' : jourAbrege(jours[i])
  }
}

function TableauDeBord({ page }: { page: PageDuCabinetAuQg }) {
  const t = page.totaux
  const finies = t.gagnees + t.perdues + t.abandonnees
  const rendues = t.rendues > 0
  const series: SerieDuGraphe[] = ISSUES_DE_LA_PILE.map(s => ({
    cle: s.cle,
    nom: s.cle === 'en-route' && rendues ? 'En route ou rendues' : s.nom,
    valeurs: page.parJour.map(s.valeur),
    classe: s.classe,
  }))
  const totaux = page.parJour.map(j => ISSUES_DE_LA_PILE.reduce((n, s) => n + s.valeur(j), 0))
  // L'ouverture, l'affiche, une mise en ligne posées sur les traversées (la proposition du 3 novembre 2026 le voulait ainsi).
  const reperes = reperesDeLaCourbe(useReperesDuQg(), page.jours.map(j => [minuitDuJour(j), minuitDuJour(jourAvant(j, -1))] as const), 'cabinet')
  return (
    <>
      <section className="qg-jour" aria-labelledby="cabinet-trente-jours">
        <div className="qg-section-tete">
          <h2 className="compte-groupe" id="cabinet-trente-jours">
            Ces trente jours
          </h2>
          <span className="muted small">les traversées commencées depuis</span>
        </div>
        <ul className="qg-tuiles">
          <Chiffre nom="Joueurs" valeur={formatNumber(t.joueurs)} detail="ont commencé une traversée" />
          <Chiffre nom="Traversées" valeur={formatNumber(t.commencees)} detail={pluriel(t.epreuves, 'épreuve jouée', 'épreuves jouées')} />
          <Chiffre nom="Gagnées" valeur={formatNumber(t.gagnees)} detail={finies > 0 ? `${pourcents(part(t.gagnees, finies))} des finies` : 'aucune finie'} />
          <Chiffre nom="Perdues" valeur={formatNumber(t.perdues)} detail="le dernier cœur tombé" />
          <Chiffre nom="Abandonnées" valeur={formatNumber(t.abandonnees)} detail={rendues ? `et ${pluriel(t.rendues, 'rendue')} au QG` : 'par le joueur'} />
          <Chiffre nom="Durée d’une traversée" valeur={t.dureeMediane === null ? '–' : dureeEcrite(t.dureeMediane)} detail="la médiane, du départ à la fin" />
        </ul>
      </section>
      <section className="qg-carte qg-ecran" aria-labelledby="cabinet-par-jour">
        <div className="qg-carte-tete qg-carte-tete-pile">
          <h2 id="cabinet-par-jour">Jour par jour</h2>
          <span className="muted small">les traversées, au jour de leur départ, par ce qu’elles sont devenues</span>
        </div>
        {totaux.every(n => n === 0) ? (
          <p className="muted small">Aucune traversée commencée ces trente jours.</p>
        ) : (
          <>
            <GrapheDuTemps
              etiquettes={page.jours.map(j => jourEnToutesLettres(j))}
              axe={axeDesJours(page.jours)}
              series={series}
              empile
              reperes={reperes}
              nomDuTotal="traversée"
              resume={`Les traversées commencées jour par jour, sur trente jours, par ce qu’elles sont devenues : ${formatNumber(t.commencees)} en tout, ${formatNumber(totaux.at(-1) ?? 0)} aujourd’hui.`}
            />
            <div className="qg-legende">
              <ul>
                {[...series].reverse().map(s => (
                  <li key={s.cle}>
                    <i className={`qg-pastille-mode ${s.classe}`} aria-hidden="true" />
                    {s.nom} <b className="num">{formatNumber(s.valeurs.reduce((n, v) => n + v, 0))}</b>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>
    </>
  )
}

// ── Les traversées en route ────────────────────────────────────────────────

function EnRoute({ page, occupe, ouvrir, rendre }: { page: PageDuCabinetAuQg; occupe: boolean; ouvrir: (p: { id: string; nom: string }) => void; rendre: (t: TraverseeEnRouteAuQg) => void }) {
  const [toutes, setToutes] = useState(false)
  const montrees = page.enRoute.length
  const lignes = toutes ? page.enRoute : page.enRoute.slice(0, LIGNES_D_ABORD)
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="cabinet-en-route">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="cabinet-en-route">Les traversées en route</h2>
        <span className="muted small">
          {page.enRouteEnTout === 0
            ? 'aucune'
            : espacesFines(
                `${pluriel(page.enRouteEnTout, 'en route', 'en route')}${montrees < page.enRouteEnTout ? `, dont les ${formatNumber(montrees)} qui ont bougé en dernier` : ''} : d’abord celles que ce serveur ne relit pas — elles bloquent sûrement —, puis les plus récentes`,
              )}
        </span>
      </div>
      {montrees > 0 && (
        <ul className="qg-liste">
          {lignes.map(t => (
            <li key={t.id} className="qg-cabinet-route">
              <button type="button" className="qg-ligne" onClick={() => ouvrir(t.profil)}>
                <span className="qg-ligne-texte">
                  <span className="qg-assidu-nom">
                    <b>{espacesFines(t.profil.nom)}</b>
                    {t.profil.suspendu && <span className="etiquette admin-etat-ferme">suspendu</span>}
                  </span>
                  <span className="muted small">{espacesFines(`@${t.profil.login} · ${etatDeLaTraverseeEnRoute(t)}`)}</span>
                  <span className="muted small">
                    {`commencée ${quandEcrit(t.commenceeLe, page.maintenant)}${t.dernier !== null ? `, dernier geste ${quandEcrit(t.dernier, page.maintenant)}` : ''}`}
                  </span>
                </span>
                <Icon name="chevron-right" className="qg-chevron" />
              </button>
              {peutSeRendre(t) && (
                <button type="button" className="salon-geste" aria-disabled={occupe || undefined} aria-label={`Rendre la traversée de ${t.profil.nom}`} onClick={() => rendre(t)}>
                  <Icon name="landmark" />
                  Rendre
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!toutes && montrees > LIGNES_D_ABORD && <EtDePlus n={montrees - LIGNES_D_ABORD} onClick={() => setToutes(true)} />}
      <p className="muted small">
        {espacesFines(
          'Rendre une traversée la referme là où elle en est, ni gagnée ni perdue : rien ne se paie ni ne se rend, et le joueur en commence une neuve aussitôt. Ses trois gardiens vaincus, son légendaire l’attend : rien n’y bloque.',
        )}
      </p>
    </section>
  )
}

// ── Du départ au légendaire, et où l'on tombe ──────────────────────────────

const NOM_DE_LA_MARCHE: Record<MarcheDeLEntonnoir, string> = {
  commencee: 'Commencées',
  cartes: 'Cartes choisies',
  acte1: 'Gardien de l’acte I vaincu',
  acte2: 'Gardien de l’acte II vaincu',
  acte3: 'Gardien de l’acte III vaincu',
  legendaire: 'Légendaire choisi',
}

/** Une ligne d'une page : son nom, sa piste, sa part au bout, et ce qu'elle dit de plus, dessous. */
function Ligne({ nom, largeur, valeur, classe = 'qg-mode-cabinet', detail, pile }: { nom: ReactNode; largeur: number; valeur: string; classe?: string; detail?: ReactNode; pile?: ReactNode }) {
  return (
    <li className="qg-piste-ligne">
      <span className="qg-piste-nom">{nom}</span>
      {pile ?? (
        <span className="qg-piste" aria-hidden="true">
          {largeur > 0 && <i className={classe} style={{ width: `${Math.min(100, largeur)}%` }} />}
        </span>
      )}
      <b className="num">{valeur}</b>
      {detail && <span className="muted small qg-cabinet-detail">{detail}</span>}
    </li>
  )
}

function DuDepartAuLegendaire({ page }: { page: PageDuCabinetAuQg }) {
  const depart = page.entonnoir[0]?.n ?? 0
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="cabinet-entonnoir">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="cabinet-entonnoir">Du départ au légendaire</h2>
        <span className="muted small">les traversées de ces trente jours, marche par marche</span>
      </div>
      {depart === 0 ? (
        <p className="muted small">Aucune traversée commencée ces trente jours.</p>
      ) : (
        <ul className="qg-pistes qg-cabinet-pistes">
          {page.entonnoir.map(m => (
            <Ligne key={m.marche} nom={`${NOM_DE_LA_MARCHE[m.marche]} · ${formatNumber(m.n)}`} largeur={(m.n / depart) * 100} valeur={pourcents(part(m.n, depart))} />
          ))}
        </ul>
      )}
    </section>
  )
}

function OuLOnTombe({ page }: { page: PageDuCabinetAuQg }) {
  const max = Math.max(1, ...page.chutes.map(c => c.perdues + c.abandonnees))
  const aucune = page.chutes.every(c => c.perdues + c.abandonnees === 0)
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="cabinet-chutes">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="cabinet-chutes">Où l’on tombe</h2>
        <span className="muted small">les traversées perdues ou abandonnées, acte par acte</span>
      </div>
      {aucune ? (
        <p className="muted small">Aucune traversée perdue ni abandonnée ces trente jours.</p>
      ) : (
        <>
          <ul className="qg-pistes qg-cabinet-pistes">
            {page.chutes.map(c => (
              <Ligne
                key={c.acte}
                nom={`${ACTES[c.acte].court} · ${ACTES[c.acte].nom}`}
                largeur={0}
                valeur={formatNumber(c.perdues + c.abandonnees)}
                detail={`${pluriel(c.perdues, 'perdue')}, ${pluriel(c.abandonnees, 'abandonnée')}`}
                pile={
                  <span className="qg-piste qg-cabinet-pile" aria-hidden="true">
                    {c.perdues > 0 && <i className="qg-cabinet-perdue" style={{ width: `${(c.perdues / max) * 100}%` }} />}
                    {c.abandonnees > 0 && <i className="qg-cabinet-abandonnee" style={{ width: `${(c.abandonnees / max) * 100}%` }} />}
                  </span>
                }
              />
            ))}
          </ul>
          <div className="qg-legende">
            <ul>
              <li>
                <i className="qg-pastille-mode qg-cabinet-perdue" aria-hidden="true" />
                Perdues : le dernier cœur
              </li>
              <li>
                <i className="qg-pastille-mode qg-cabinet-abandonnee" aria-hidden="true" />
                Abandonnées
              </li>
            </ul>
          </div>
        </>
      )}
    </section>
  )
}

// ── Les jeux ───────────────────────────────────────────────────────────────

function LesJeux({ page }: { page: PageDuCabinetAuQg }) {
  const joues = [...page.jeux].filter(j => j.epreuves > 0).sort((a, b) => b.epreuves - a.epreuves || CLES_DES_JEUX.indexOf(a.jeu) - CLES_DES_JEUX.indexOf(b.jeu))
  const pasJoues = page.jeux.filter(j => j.epreuves === 0).map(j => JEUX[j.jeu].nom)
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="cabinet-jeux">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="cabinet-jeux">Les jeux</h2>
        <span className="muted small">
          {espacesFines(
            'la réussite : les manches gagnées d’une étoile au moins, sur celles jouées — une ratée coûte un cœur ; la durée : le temps médian d’une manche ; quittées : « Quitter ? » quand rien ne l’arrêtait',
          )}
        </span>
      </div>
      {joues.length === 0 ? (
        <p className="muted small">Aucune épreuve jouée ces trente jours.</p>
      ) : (
        <ul className="qg-pistes qg-cabinet-pistes qg-cabinet-colonnes">
          {joues.map(j => {
            const reussite = part(j.reussies, j.manches)
            const detail = [
              j.manches > 0 && `${uneDecimale(j.etoiles / j.manches)} étoile${j.etoiles / j.manches >= 2 ? 's' : ''} la manche`,
              j.duree !== null && `${dureeCourteEcrite(j.duree)} la manche`,
              j.quittees > 0 ? pluriel(j.quittees, 'épreuve quittée', 'épreuves quittées') : 'jamais quitté',
              j.avecAides > 0 && `Éclairer dans ${pourcents(part(j.eclairees, j.avecAides))} des épreuves`,
              j.signalements !== null && pluriel(j.signalements, 'signalement'),
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <Ligne
                key={j.jeu}
                nom={
                  <span>
                    <b>{JEUX[j.jeu].nom}</b>
                    <span className="muted small">{` · ${pluriel(j.epreuves, 'épreuve')}${j.assauts > 0 ? `, dont ${pluriel(j.assauts, 'assaut')}` : ''}`}</span>
                  </span>
                }
                largeur={reussite ?? 0}
                valeur={pourcents(reussite)}
                detail={detail}
              />
            )
          })}
        </ul>
      )}
      {pasJoues.length > 0 && joues.length > 0 && <p className="muted small">{espacesFines(`Pas joués ces trente jours : ${pasJoues.join(', ')}.`)}</p>}
    </section>
  )
}

// ── Les cartes, les légendaires, les gardiens ──────────────────────────────

function LesCartes({ page }: { page: PageDuCabinetAuQg }) {
  const avecCartes = page.entonnoir.find(m => m.marche === 'cartes')?.n ?? 0
  const t = page.totaux
  const finies = t.gagnees + t.perdues + t.abandonnees
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="cabinet-cartes">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="cabinet-cartes">Les cartes</h2>
        <span className="muted small">
          {finies > 0
            ? `choisie dans quelle part des traversées ; dessous, la part des finies qu’elle a gagnées — ${pourcents(part(t.gagnees, finies))} toutes cartes confondues`
            : 'choisie dans quelle part des traversées'}
        </span>
      </div>
      {page.cartes.length === 0 ? (
        <p className="muted small">Aucune carte choisie ces trente jours.</p>
      ) : (
        <ul className="qg-pistes qg-cabinet-pistes">
          {page.cartes.map(c => (
            <Ligne
              key={c.cle}
              nom={`${NOMS_DES_CARTES[c.cle]} · ${pluriel(c.choisie, 'fois', 'fois')}`}
              largeur={avecCartes > 0 ? (c.choisie / avecCartes) * 100 : 0}
              valeur={pourcents(part(c.choisie, avecCartes))}
              detail={c.finies > 0 ? `${pluriel(c.gagnees, 'gagnée')} sur ${pluriel(c.finies, 'finie')}, ${pourcents(part(c.gagnees, c.finies))}` : 'aucune finie'}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function LesLegendaires({ page }: { page: PageDuCabinetAuQg }) {
  const max = Math.max(1, ...page.legendaires.map(l => l.n))
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="cabinet-legendaires">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="cabinet-legendaires">Le légendaire choisi</h2>
        <span className="muted small">au bout des traversées gagnées : l’un des trois gardiens vaincus</span>
      </div>
      {page.legendaires.length === 0 ? (
        <p className="muted small">Aucune traversée gagnée ces trente jours.</p>
      ) : (
        <ul className="qg-pistes qg-cabinet-pistes">
          {page.legendaires.map(l => (
            <Ligne key={l.cle} nom={nomDuGardien(l.cle)} largeur={(l.n / max) * 100} valeur={formatNumber(l.n)} />
          ))}
        </ul>
      )}
    </section>
  )
}

function LesGardiens({ page }: { page: PageDuCabinetAuQg }) {
  const parActe = ([0, 1, 2] as const satisfies readonly Acte[]).map(acte => ({ acte, gardiens: page.gardiens.filter(g => g.acte === acte) }))
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="cabinet-gardiens">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="cabinet-gardiens">Les gardiens</h2>
        <span className="muted small">acte par acte : vaincus sur affrontés ; dessous, tirés au départ et vaincus</span>
      </div>
      {page.gardiens.length === 0 ? (
        <p className="muted small">Aucune traversée commencée ces trente jours.</p>
      ) : (
        <ul className="qg-multiples">
          {parActe.map(({ acte, gardiens }) => (
            <li key={acte} className="qg-multiple">
              <div className="qg-multiple-tete">
                <b>{`${ACTES[acte].court} · ${ACTES[acte].nom}`}</b>
              </div>
              {gardiens.length === 0 ? (
                <p className="muted small">Personne n’y est arrivé.</p>
              ) : (
                <ul className="qg-pistes qg-cabinet-pistes">
                  {gardiens.map(g => {
                    const vaincus = part(g.vaincu, g.affronte)
                    return (
                      <Ligne
                        key={g.cle}
                        nom={`${nomDuGardien(g.cle)} · ${pluriel(g.affronte, 'affronté', 'affrontés')}`}
                        largeur={vaincus ?? 0}
                        valeur={pourcents(vaincus)}
                        detail={`tiré ${pluriel(g.tire, 'fois', 'fois')} · ${pluriel(g.vaincu, 'vaincu', 'vaincus')}`}
                      />
                    )
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ── Le contenu ─────────────────────────────────────────────────────────────

/** Ce qui se rate le plus d'un jeu : chaque contenu joué assez pour juger, le plus raté d'abord (`JOUES_POUR_JUGER`). */
function Contenu({ id, titre, sous, lignes, detail }: { id: string; titre: string; sous: string; lignes: readonly LigneDeContenu[]; detail: (l: LigneDeContenu) => string }) {
  return (
    <section className="qg-carte qg-ecran" aria-labelledby={id}>
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id={id}>{titre}</h2>
        <span className="muted small">{`${sous} — joués ${JOUES_POUR_JUGER} fois au moins`}</span>
      </div>
      {lignes.length === 0 ? (
        <p className="muted small">{`Rien de joué ${JOUES_POUR_JUGER} fois ces trente jours.`}</p>
      ) : (
        <ul className="qg-pistes qg-cabinet-pistes">
          {lignes.map(l => {
            const trouves = part(l.trouves, l.joues)
            return <Ligne key={l.id} nom={espacesFines(l.nom)} largeur={trouves ?? 0} valeur={pourcents(trouves)} detail={detail(l)} />
          })}
        </ul>
      )}
    </section>
  )
}

function LeContenu({ page }: { page: PageDuCabinetAuQg }) {
  const c = page.contenu
  const sur = (l: LigneDeContenu, mot: string) => `${pluriel(l.trouves, mot)} sur ${formatNumber(l.joues)}`
  return (
    <div className="qg-deux qg-deux-haut">
      <Contenu
        id="cabinet-epingle"
        titre="L’Épingle : les lieux les moins bien placés"
        sous="placés juste, sur leurs manches"
        lignes={c.epingle}
        detail={l => `${sur(l, 'placé')}${l.km !== undefined ? ` · ${formatNumber(l.km)} km en médiane` : ''}`}
      />
      <Contenu
        id="cabinet-indices"
        titre="Les Indices : les fiches les moins trouvées"
        sous="trouvées, sur leurs manches"
        lignes={c.indices}
        detail={l => `${sur(l, 'trouvée')}${l.indices !== undefined ? ` · ${uneDecimale(l.indices)} indices lus en moyenne` : ''}`}
      />
      <Contenu id="cabinet-repliques" titre="La Réplique : les moins trouvées" sous="le bon mot trouvé, sur leurs manches" lignes={c.repliques} detail={l => sur(l, 'trouvée')} />
      <section className="qg-carte qg-ecran" aria-labelledby="cabinet-quiz">
        <div className="qg-carte-tete qg-carte-tete-pile">
          <h2 id="cabinet-quiz">Le Quiz : ses thèmes</h2>
          <span className="muted small">les plus joués, et leurs manches réussies</span>
        </div>
        {c.quiz.length === 0 ? (
          <p className="muted small">Aucune épreuve du Quiz ces trente jours.</p>
        ) : (
          <ul className="qg-pistes qg-cabinet-pistes">
            {c.quiz.map(q => {
              const reussite = part(q.reussies, q.manches)
              return (
                <Ligne
                  key={q.theme}
                  nom={espacesFines(q.theme)}
                  largeur={reussite ?? 0}
                  valeur={pourcents(reussite)}
                  detail={`${pluriel(q.epreuves, 'épreuve')} · ${pluriel(q.reussies, 'manche réussie', 'manches réussies')} sur ${formatNumber(q.manches)}`}
                />
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

// ── Les joueurs, et ce qu'on y fait ────────────────────────────────────────

/** Ce qu'il tient, tous jours confondus : les rangs des défis de ses cartes, ses exploits tombés — chaque fois compte. */
function sesDefis(j: Pick<JoueurDuCabinet, 'rangs' | 'exploits'>): string {
  if (j.rangs === 0 && j.exploits === 0) return 'aucun défi tenu, aucun exploit'
  return `défis tenus : ${pluriel(j.rangs, 'rang')} · ${j.exploits > 0 ? pluriel(j.exploits, 'exploit') : 'aucun exploit'}`
}

function LesJoueurs({ page, ouvrir }: { page: PageDuCabinetAuQg; ouvrir: (p: { id: string; nom: string }) => void }) {
  const [tous, setTous] = useState(false)
  const lignes = tous ? page.joueurs : page.joueurs.slice(0, LIGNES_D_ABORD)
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="cabinet-joueurs">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="cabinet-joueurs">Les joueurs</h2>
        <span className="muted small">
          {page.joueursEnTout === 0
            ? 'personne n’a traversé ces trente jours'
            : `${pluriel(page.joueursEnTout, 'profil a', 'profils ont')} traversé ces trente jours${page.joueurs.length < page.joueursEnTout ? ` — les ${formatNumber(page.joueurs.length)} qui traversent le plus` : ''}`}
        </span>
      </div>
      {page.joueurs.length > 0 && (
        <ul className="qg-liste">
          {lignes.map(j => (
            <li key={j.profil.id}>
              <button type="button" className="qg-ligne" onClick={() => ouvrir(j.profil)}>
                <span className="qg-ligne-texte">
                  <span className="qg-assidu-nom">
                    <b>{espacesFines(j.profil.nom)}</b>
                    {j.profil.suspendu && <span className="etiquette admin-etat-ferme">suspendu</span>}
                  </span>
                  <span className="muted small">
                    {`@${j.profil.login} · ${pluriel(j.traversees, 'traversée')} · ${pluriel(j.gagnees, 'gagnée')} · ${pluriel(j.epreuves, 'épreuve')}`}
                  </span>
                  <span className="muted small">{espacesFines(`${sesDefis(j)} · dernier passage ${quandEcrit(j.dernier, page.maintenant)}`)}</span>
                </span>
                <Icon name="chevron-right" className="qg-chevron" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!tous && page.joueurs.length > LIGNES_D_ABORD && <EtDePlus n={page.joueurs.length - LIGNES_D_ABORD} onClick={() => setTous(true)} />}
    </section>
  )
}

/** « Et 14 de plus » : le reste d'une liste, d'un toucher — comme la page de l'activité. */
function EtDePlus({ n, onClick }: { n: number; onClick: () => void }) {
  return (
    <button type="button" className="lien-discret qg-suite" onClick={onClick}>
      Et {formatNumber(n)} de plus
      <Icon name="chevron-down" />
    </button>
  )
}

function CeQuOnYFait({ versLaMaintenance }: { versLaMaintenance?: () => void }) {
  return (
    <section className="qg-carte" aria-labelledby="cabinet-gestes">
      <div className="qg-carte-tete">
        <h2 id="cabinet-gestes">Ce qu’on y fait</h2>
      </div>
      <a
        className="qg-ligne qg-cabinet-lien"
        href="/admin#maintenance"
        onClick={e => {
          if (!versLaMaintenance || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
          e.preventDefault()
          versLaMaintenance()
        }}
      >
        <span className="qg-rond">
          <Icon name="alert" />
        </span>
        <span className="qg-ligne-texte">
          <b>Fermer le Cabinet, ou l’ouvrir à quelques testeurs</b>
          <span className="muted small">{espacesFines('La maintenance : sa page et ce qui y commence se ferment — une traversée déjà à l’écran se finit.')}</span>
        </span>
        <Icon name="chevron-right" className="qg-chevron" />
      </a>
      <p className="muted small">{espacesFines('Une traversée bloquée se rend depuis la liste des traversées en route, ou depuis la fiche du joueur.')}</p>
    </section>
  )
}
