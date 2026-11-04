import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, motifDe } from '../api'
import { Icon } from './Icon'
import { Onglets } from './Onglets'
import { Feuille } from './Pieces'
import { CopierLeTableau } from './CopierLeTableau'
import { AdminSalons } from './AdminSalons'
import { FicheDuJoueurAuQg } from './QgFicheJoueur'
import { supprimerLeProfil } from './AdminProfils'
import { espacesFines } from '../format'
import { formatNumber } from '../../../shared/typographie'
import { jourDe, jourEnToutesLettres } from '../../../shared/jour'
import { heureEcrite, quandEcrit } from '../../../shared/qg'
import { partEcrite } from '../../../shared/qgJoueurs'
import type { EspaceDAdministration } from '../../../shared/space'
import {
  ETATS_D_UN_SALON,
  ETAT_D_UN_SALON,
  JOURS_DES_PREMIERS_PAS,
  NOM_DE_L_ETAT,
  REGLE_DE_L_ETAT,
  originesEcrites,
  type CarnetDesAnimateurs,
  type EtatDUnSalon,
  type LigneDuCarnet,
  type SegmentDesAnimateurs,
} from '../../../shared/qgAnimateurs'

/** « 1 soirée », « 0 soirée », « 12 soirées » : zéro s'écrit au singulier. */
const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${formatNumber(n)} ${n > 1 ? motPluriel : mot}`

/**
 * Les onglets de la page : le carnet d'abord ; « Les salons », la liste et ses gestes d'avant. Le QG tient l'onglet dans
 * l'adresse (`/admin#animateurs/salons`), et l'adresse d'avant, `#salons`, que des favoris gardent, ouvre encore la liste
 * (`ONGLETS_D_AVANT`, `AdminApp.tsx`).
 */
type OngletDesAnimateurs = 'carnet' | 'salons'
const estUnOngletDesAnimateurs = (o: string | null | undefined): o is OngletDesAnimateurs => o === 'carnet' || o === 'salons'

/**
 * Les animateurs au QG (`/admin#animateurs`, sous « Audience », à la place de
 * « Salons » — la revue d'analyse du 4 novembre 2026, P1.1 : « les animateurs
 * comme clients ») : le carnet — l'entonnoir d'un nouvel animateur, cinq états
 * dits en clair, une ligne par salon ouvert — et « Les salons », la liste et
 * les gestes d'avant, sans rien perdre. Chaque onglet a son adresse : un favori
 * sur `#salons` ouvre encore la liste.
 */
export function QgAnimateurs({
  espaces,
  apresUnGesteSurLesSalons,
  versLesAnnonces,
  onglet: ongletDeLAdresse,
  changerDOnglet,
}: {
  /** Tous les espaces, désactivés compris, que le QG relit en revenant d'une page : l'onglet « Les salons ». */
  espaces?: EspaceDAdministration[]
  apresUnGesteSurLesSalons: () => void
  versLesAnnonces: (segment: SegmentDesAnimateurs) => void
  /** L'onglet de l'adresse (`/admin#animateurs/salons`), quand le QG la tient. */
  onglet?: string | null
  changerDOnglet?: (o: OngletDesAnimateurs) => void
}) {
  const [ongletLocal, setOngletLocal] = useState<OngletDesAnimateurs>('carnet')
  const onglet: OngletDesAnimateurs = changerDOnglet ? (estUnOngletDesAnimateurs(ongletDeLAdresse) ? ongletDeLAdresse : 'carnet') : ongletLocal
  const choisir = changerDOnglet ?? setOngletLocal
  const [carnet, setCarnet] = useState<CarnetDesAnimateurs | null>(null)
  const [error, setError] = useState('')
  const [relire, setRelire] = useState(0)
  useEffect(() => {
    api.admin.animateurs().then(
      c => {
        setCarnet(c)
        setError('')
      },
      e => setError(motifDe(e)),
    )
  }, [relire])
  const dernieres = useMemo(() => new Map(carnet?.salons.map(l => [l.spaceId, l.derniere]) ?? []), [carnet])
  return (
    <div className="qg-panneau">
      <Onglets
        onglets={[
          { id: 'carnet', nom: 'Le carnet', icone: 'users' },
          { id: 'salons', nom: 'Les salons', icone: 'home' },
        ]}
        actif={onglet}
        onChoisir={choisir}
        label="Ce que la page des animateurs montre"
        idOnglet={o => `animateurs-onglet-${o}`}
        idPanneau={o => `animateurs-panneau-${o}`}
        className="onglets-puces qg-onglets"
      />
      <div className="qg-panneau" role="tabpanel" id={`animateurs-panneau-${onglet}`} aria-labelledby={`animateurs-onglet-${onglet}`}>
        {onglet === 'carnet' &&
          (error ? (
            <p className="error">{error}</p>
          ) : !carnet ? (
            <p className="serif-note">Chargement…</p>
          ) : (
            <LeCarnet carnet={carnet} versLesAnnonces={versLesAnnonces} apresUnGeste={() => setRelire(n => n + 1)} />
          ))}
        {onglet === 'salons' && (
          <AdminSalons
            espaces={espaces}
            dernieres={carnet ? dernieres : undefined}
            onChange={() => {
              apresUnGesteSurLesSalons()
              setRelire(n => n + 1)
            }}
          />
        )}
      </div>
    </div>
  )
}

/** Le carnet lu : l'entonnoir, les états — un choisi filtre la table et propose « Leur écrire » —, puis un salon par ligne. */
export function LeCarnet({ carnet, versLesAnnonces, apresUnGeste }: { carnet: CarnetDesAnimateurs; versLesAnnonces: (segment: SegmentDesAnimateurs) => void; apresUnGeste?: () => void }) {
  const [etat, setEtat] = useState<EtatDUnSalon | null>(null)
  const [ouvert, setOuvert] = useState<{ id: string; nom: string } | null>(null)
  const lignes = etat === null ? carnet.salons : carnet.salons.filter(l => l.etat === etat)
  return (
    <div className="qg-animateurs-page">
      <p className="muted small qg-animateurs-chapo">
        {espacesFines(
          `Chaque animateur amène une salle entière : qui anime, à quel rythme, qui tarde, qui est parti, et ce que ses soirées font naître. ${pluriel(carnet.salons.length, 'salon ouvert', 'salons ouverts')}${
            carnet.desactives > 0 ? ` — ${pluriel(carnet.desactives, 'désactivé', 'désactivés')} n’y comptent pas, « Les salons » les montre` : ''
          }. Des soirées des autres, le salon et des chiffres : jamais un titre, une question ou un prénom d’invité.`,
        )}
      </p>
      <Entonnoir carnet={carnet} />
      <LesEtats carnet={carnet} choisi={etat} choisir={setEtat} versLesAnnonces={versLesAnnonces} />
      <LaTable carnet={carnet} lignes={lignes} etat={etat} ouvrir={setOuvert} />
      <section className="qg-console qg-animateurs-notes" aria-labelledby="animateurs-notes">
        <h2 className="sr-only" id="animateurs-notes">
          Comment lire le carnet
        </h2>
        <p className="muted small">
          {espacesFines(
            `Le rythme : l’écart médian entre ses jours de soirée — deux soirées le même soir n’en font qu’un, compté au calendrier de Paris. Le retard : les jours de plus que ce rythme depuis sa dernière soirée ; en retard passé le double, ou, une seule soirée, ${JOURS_DES_PREMIERS_PAS} jours après elle.`,
          )}
        </p>
        <p className="muted small">
          {espacesFines(
            'La dernière soirée est la dernière jouée, pas la dernière console ouverte — « Les salons » la dit. Les invités : la médiane de ses salles, ceux qui ont joué. Avec profil : sous vingt invités, « 4 sur 9 ».',
          )}
        </p>
        <p className="muted small">
          {espacesFines(
            'Les profils nés : à l’entrée d’une de ses soirées ou pendant elle, depuis le 4 novembre 2026 — un profil d’avant ne dit pas où il est né ; un profil né à la fin passe par l’accueil, et la page ne devine pas sa soirée. Les quiz prêts : ceux que sa soirée peut lancer, ni archivés ni sans une question prête, et d’où ils viennent — ceux d’avant le 4 novembre ne le disent pas.',
          )}
        </p>
        <p className="muted small">
          {espacesFines(
            `Les soirées des jours finis se lisent une fois par jour — ${jourDe(carnet.lu) === jourDe(carnet.maintenant) ? `à ${heureEcrite(carnet.lu)}` : quandEcrit(carnet.lu, carnet.maintenant)} —, celles d’aujourd’hui à chaque ouverture.`,
          )}
        </p>
      </section>
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
    </div>
  )
}

// ── L'entonnoir ─────────────────────────────────────────────────────────────

function Entonnoir({ carnet }: { carnet: CarnetDesAnimateurs }) {
  const { marches, enAttente } = carnet.entonnoir
  const depart = marches[0]?.n ?? 0
  return (
    <section className="qg-console qg-animateurs-entonnoir" aria-labelledby="animateurs-entonnoir">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Entonnoir</span>
          <h2 id="animateurs-entonnoir">D’un salon ouvert à la deuxième soirée</h2>
          <span className="muted small">Tous les salons ouverts, depuis toujours : où un nouvel animateur s’arrête.</span>
        </div>
      </div>
      {depart === 0 ? (
        <p className="muted small">Aucun salon ouvert.</p>
      ) : (
        <ol className="qg-pistes qg-entonnoir">
          {marches.map((m, i) => {
            const avant = i > 0 ? marches[i - 1].n : 0
            const derniere = i === marches.length - 1
            return (
              <li key={m.nom} className="qg-piste-ligne">
                <span className="qg-piste-nom">{m.nom}</span>
                <span className="qg-piste" aria-hidden="true">
                  {m.n > 0 && <i className="qg-joueurs" style={{ width: `${Math.max(1, (m.n / depart) * 100)}%` }} />}
                </span>
                <b className="num">{formatNumber(m.n)}</b>
                {i > 0 && (
                  <span className="qg-entonnoir-perte">
                    {espacesFines(
                      [
                        // Sous vingt, des salons : « 3 sur 5 », jamais « 60 % ».
                        `${partEcrite(m.n, avant)} de la marche d’avant`,
                        derniere && enAttente > 0 ? `${pluriel(enAttente, 'attend', 'attendent')} encore : leur première soirée a moins de ${JOURS_DES_PREMIERS_PAS} jours` : null,
                      ]
                        .filter(Boolean)
                        .join(' · '),
                    )}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

// ── Les états ───────────────────────────────────────────────────────────────

function LesEtats({
  carnet,
  choisi,
  choisir,
  versLesAnnonces,
}: {
  carnet: CarnetDesAnimateurs
  choisi: EtatDUnSalon | null
  choisir: (e: EtatDUnSalon | null) => void
  versLesAnnonces: (segment: SegmentDesAnimateurs) => void
}) {
  const plus = Math.max(1, ...carnet.etats.map(e => e.salons))
  const leChoisi = carnet.etats.find(e => e.etat === choisi)
  const touches = leChoisi ? leChoisi.titulaires : carnet.etats.reduce((t, e) => t + e.titulaires, 0)
  return (
    <section className="qg-console qg-animateurs-etats" aria-labelledby="animateurs-etats">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">États</span>
          <h2 id="animateurs-etats">Où en est chacun</h2>
          <span className="muted small">Chaque salon dans un seul état, le premier dont il suit la règle. Un état choisi filtre le carnet.</span>
        </div>
        <button
          type="button"
          className="salon-geste"
          aria-disabled={touches === 0 || undefined}
          title={touches === 0 ? 'Aucun titulaire à qui écrire : un salon détaché, un profil suspendu ne lisent rien' : undefined}
          onClick={() => touches > 0 && versLesAnnonces(choisi ? `animateurs:${choisi}` : 'animateurs')}
        >
          <Icon name="megaphone" />
          Leur écrire
        </button>
      </div>
      <ul className="qg-joueurs-liste-segments">
        <li>
          <button type="button" className="qg-joueurs-segment" aria-pressed={choisi === null} onClick={() => choisir(null)}>
            <span className="qg-joueurs-segment-tete">
              <b>Tous</b>
              <span className="num">{formatNumber(carnet.salons.length)}</span>
            </span>
            <span className="muted small">Les salons ouverts, chacun dans son état</span>
          </button>
        </li>
        {ETATS_D_UN_SALON.map(etat => {
          const e = carnet.etats.find(x => x.etat === etat)
          const n = e?.salons ?? 0
          return (
            <li key={etat}>
              <button type="button" className="qg-joueurs-segment" aria-pressed={choisi === etat} onClick={() => choisir(choisi === etat ? null : etat)}>
                <span className="qg-joueurs-segment-tete">
                  <b>{NOM_DE_L_ETAT[etat]}</b>
                  <span className="num">{formatNumber(n)}</span>
                </span>
                <span className="muted small">{espacesFines(REGLE_DE_L_ETAT[etat])}</span>
                <span className="qg-piste" aria-hidden="true">
                  <i className="qg-joueurs" style={{ width: `${(n / plus) * 100}%` }} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ── La table ────────────────────────────────────────────────────────────────

type CleDuTri = 'nom' | 'etat' | 'derniere' | 'soireesRecentes' | 'soirees' | 'rythme' | 'retard' | 'invites' | 'avecProfil' | 'nesChezLui' | 'prets'

const COLONNES: { cle: CleDuTri; nom: string; titre: string }[] = [
  { cle: 'nom', nom: 'Salon', titre: 'Le salon, au nom de son titulaire — touché, sa fiche' },
  { cle: 'etat', nom: 'État', titre: 'Les retards d’abord, puis à lancer, nouveaux, fidèles, partis' },
  { cle: 'derniere', nom: 'Dernière soirée', titre: 'Sa dernière soirée jouée — pas sa dernière console ouverte' },
  { cle: 'soireesRecentes', nom: '90 j', titre: 'Ses soirées ces quatre-vingt-dix jours' },
  { cle: 'soirees', nom: 'En tout', titre: 'Ses soirées depuis toujours' },
  { cle: 'rythme', nom: 'Rythme', titre: 'L’écart médian entre ses jours de soirée' },
  { cle: 'retard', nom: 'Retard', titre: 'Ses jours de plus que son rythme depuis sa dernière soirée' },
  { cle: 'invites', nom: 'Invités', titre: 'La médiane de ses salles : les invités qui ont joué' },
  { cle: 'avecProfil', nom: 'Avec profil', titre: 'Ses invités venus avec un profil' },
  { cle: 'nesChezLui', nom: 'Profils nés', titre: 'Les profils nés à l’entrée d’une de ses soirées ou pendant elle' },
  { cle: 'prets', nom: 'Quiz prêts', titre: 'Ses quiz que la soirée peut lancer, et d’où ils viennent' },
]

/** L'ordre des états au tri : ce qui demande un geste d'abord — qui relancer cette semaine. */
const ORDRE_DES_ETATS: Record<EtatDUnSalon, number> = { 'en-retard': 0, 'a-lancer': 1, nouveau: 2, fidele: 3, parti: 4 }

/** Ce qu'une ligne vaut pour le tri : ce qui ne se compte pas passe après le plus petit. */
function valeurDuTri(l: LigneDuCarnet, cle: Exclude<CleDuTri, 'nom'>): number {
  switch (cle) {
    case 'etat':
      return ORDRE_DES_ETATS[l.etat]
    case 'avecProfil':
      return l.avecProfil.invites > 0 ? l.avecProfil.profils / l.avecProfil.invites : -1e12
    case 'prets':
      return l.quiz.prets
    default:
      // Un retard peut être négatif : ce qui ne se compte pas passe sous tout ce qui se compte.
      return l[cle] ?? -1e12
  }
}

/** Les lignes que la table montre d'abord : au-delà, « Voir les N autres ». */
const LIGNES_D_ABORD = 50

function LaTable({ carnet, lignes, etat, ouvrir }: { carnet: CarnetDesAnimateurs; lignes: readonly LigneDuCarnet[]; etat: EtatDUnSalon | null; ouvrir: (p: { id: string; nom: string }) => void }) {
  const [tri, setTri] = useState<{ cle: CleDuTri; sens: 'monte' | 'descend' }>({ cle: 'etat', sens: 'monte' })
  const [toutes, setToutes] = useState(false)
  const triees = useMemo(
    () =>
      [...lignes].sort((a, b) => {
        const c = tri.cle === 'nom' ? a.nom.localeCompare(b.nom) : valeurDuTri(a, tri.cle) - valeurDuTri(b, tri.cle)
        // À égalité, celui parti depuis le plus longtemps d'abord : le plus pressé à relancer.
        return (tri.sens === 'monte' ? c : -c) || (b.absent ?? -1) - (a.absent ?? -1) || a.nom.localeCompare(b.nom)
      }),
    [lignes, tri],
  )
  const trier = (cle: CleDuTri) => setTri(t => (t.cle === cle ? { cle, sens: t.sens === 'monte' ? 'descend' : 'monte' } : { cle, sens: cle === 'nom' || cle === 'etat' ? 'monte' : 'descend' }))
  const montrees = toutes ? triees : triees.slice(0, LIGNES_D_ABORD)
  const maintenant = carnet.maintenant
  return (
    <section className="qg-console qg-animateurs-carnet" aria-labelledby="animateurs-carnet">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Carnet</span>
          <h2 id="animateurs-carnet">{etat === null ? 'Chaque salon ouvert' : `${NOM_DE_L_ETAT[etat]} · ${pluriel(lignes.length, 'salon')}`}</h2>
          <span className="muted small">{etat === null ? 'Ceux qui demandent un geste d’abord : les retards, puis les salons à lancer.' : espacesFines(REGLE_DE_L_ETAT[etat])}</span>
        </div>
      </div>
      {lignes.length === 0 ? (
        <p className="muted small">Aucun salon dans cet état aujourd’hui.</p>
      ) : (
        <>
          <div className="qg-outils">
            <CopierLeTableau nom="le carnet des animateurs" />
          </div>
          <div className="qg-table-cadre qg-cote-table">
            <table className="qg-table qg-animateurs-table">
              <caption className="sr-only">{`Le carnet des animateurs, trié par ${COLONNES.find(c => c.cle === tri.cle)?.nom.toLowerCase()}`}</caption>
              <thead>
                <tr>
                  {COLONNES.map(c => (
                    <th
                      key={c.cle}
                      scope="col"
                      className={c.cle === 'nom' || c.cle === 'etat' || c.cle === 'derniere' ? undefined : 'qg-nombre'}
                      aria-sort={tri.cle === c.cle ? (tri.sens === 'monte' ? 'ascending' : 'descending') : undefined}
                    >
                      <button type="button" className="qg-tri" title={c.titre} onClick={() => trier(c.cle)}>
                        {c.nom}
                        {tri.cle === c.cle && <Icon name={tri.sens === 'monte' ? 'arrow-up' : 'arrow-down'} />}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {montrees.map(l => (
                  <tr key={l.spaceId}>
                    <th scope="row">
                      <NomDuSalon ligne={l} ouvrir={ouvrir} />
                      {/* Sur deux lignes : d'une traite, la colonne du salon poussait la onzième hors du cadre en 1366 × 768. */}
                      <span className="qg-animateurs-sous">{ouvertLe(l, maintenant)}</span>
                      <span className="qg-animateurs-sous">{premiereSoiree(l, maintenant)}</span>
                    </th>
                    <td>
                      <span className="etiquette">{ETAT_D_UN_SALON[l.etat]}</span>
                    </td>
                    <td>{l.derniere === null ? <span className="muted">jamais</span> : quandEcrit(l.derniere, maintenant)}</td>
                    <td className="qg-nombre">{formatNumber(l.soireesRecentes)}</td>
                    <td className="qg-nombre">{formatNumber(l.soirees)}</td>
                    <td className="qg-nombre">{rythmeEcrit(l)}</td>
                    <td className="qg-nombre">{retardEcrit(l)}</td>
                    <td className="qg-nombre">{l.invites === null ? '–' : formatNumber(Math.round(l.invites))}</td>
                    <td className="qg-nombre">{partEcrite(l.avecProfil.profils, l.avecProfil.invites)}</td>
                    <td className="qg-nombre">{formatNumber(l.nesChezLui)}</td>
                    <td className="qg-nombre" title={l.quiz.prets > 0 ? originesEcrites(l.quiz.parOrigine) : undefined}>
                      {formatNumber(l.quiz.prets)}
                      {l.quiz.total > l.quiz.prets && <span className="muted">{` / ${formatNumber(l.quiz.total)}`}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Au téléphone, une carte par salon : onze colonnes ne tiennent pas sans défiler de côté. */}
          <ul className="qg-liste qg-cote-cartes">
            {montrees.map(l => (
              <li key={l.spaceId} className="qg-cote-carte">
                <span className="qg-animateurs-tete">
                  <NomDuSalon ligne={l} ouvrir={ouvrir} />
                  <span className="etiquette">{ETAT_D_UN_SALON[l.etat]}</span>
                </span>
                <span className="muted small">{`${ouvertLe(l, maintenant)} · ${premiereSoiree(l, maintenant)}`}</span>
                <dl className="qg-cote-chiffres">
                  <Chiffre nom="Dernière soirée">{l.derniere === null ? 'jamais' : quandEcrit(l.derniere, maintenant)}</Chiffre>
                  <Chiffre nom="Soirées 90 j">{formatNumber(l.soireesRecentes)}</Chiffre>
                  <Chiffre nom="En tout">{formatNumber(l.soirees)}</Chiffre>
                  <Chiffre nom="Rythme">{rythmeEcrit(l)}</Chiffre>
                  <Chiffre nom="Retard">{retardEcrit(l)}</Chiffre>
                  <Chiffre nom="Invités">{l.invites === null ? '–' : formatNumber(Math.round(l.invites))}</Chiffre>
                  <Chiffre nom="Avec profil">{partEcrite(l.avecProfil.profils, l.avecProfil.invites)}</Chiffre>
                  <Chiffre nom="Profils nés">{formatNumber(l.nesChezLui)}</Chiffre>
                  <Chiffre nom="Quiz prêts">{formatNumber(l.quiz.prets)}</Chiffre>
                </dl>
                {l.quiz.prets > 0 && <span className="muted small">{espacesFines(`Ses quiz prêts : ${originesEcrites(l.quiz.parOrigine)}.`)}</span>}
              </li>
            ))}
          </ul>
          {!toutes && triees.length > LIGNES_D_ABORD && (
            <button type="button" className="lien-discret qg-suite" onClick={() => setToutes(true)}>
              Voir les {formatNumber(triees.length - LIGNES_D_ABORD)} autres
              <Icon name="chevron-down" />
            </button>
          )}
        </>
      )}
    </section>
  )
}

/** Le nom d'un salon : celui de son titulaire, qui ouvre sa fiche — un salon détaché, un compte d'avant, se lisent seulement. */
function NomDuSalon({ ligne: l, ouvrir }: { ligne: LigneDuCarnet; ouvrir: (p: { id: string; nom: string }) => void }) {
  const marques = (
    <>
      {l.toi && <span className="etiquette">toi</span>}
      {l.titulaire?.suspendu && <span className="etiquette admin-etat-ferme">suspendu</span>}
    </>
  )
  if (!l.titulaire) {
    return (
      <span className="qg-animateurs-nom">
        <b>{espacesFines(l.nom)}</b>
        {marques}
      </span>
    )
  }
  const titulaire = l.titulaire
  return (
    <span className="qg-animateurs-nom">
      <button type="button" className="qg-animateurs-fiche" onClick={() => ouvrir({ id: titulaire.id, nom: titulaire.nom })} title={`La fiche de son titulaire, @${titulaire.login}`}>
        {espacesFines(l.nom)}
      </button>
      {marques}
    </span>
  )
}

/** « 3 octobre », et l'année quand ce n'est pas celle d'aujourd'hui : un salon ouvert l'an dernier ne se lit pas cette année. */
function dateEcrite(instant: number, maintenant: number): string {
  const jour = jourDe(instant)
  const annee = jour.slice(0, 4)
  return annee === jourDe(maintenant).slice(0, 4) ? jourEnToutesLettres(jour, true) : `${jourEnToutesLettres(jour, true)} ${annee}`
}

/** « Ouvert le 3 octobre » : sa naissance. */
function ouvertLe(l: LigneDuCarnet, maintenant: number): string {
  return jourDe(l.neLe) === jourDe(maintenant) ? 'Ouvert aujourd’hui' : `Ouvert le ${dateEcrite(l.neLe, maintenant)}`
}

/** « 1ʳᵉ soirée le 10 octobre », s'il en a joué une. */
function premiereSoiree(l: LigneDuCarnet, maintenant: number): string {
  return l.premiere === null ? 'pas encore de soirée' : `1ʳᵉ soirée le ${dateEcrite(l.premiere, maintenant)}`
}

/** « 7 j » : l'écart médian entre ses soirées ; sans deux soirées, pas encore de rythme. */
function rythmeEcrit(l: LigneDuCarnet): ReactNode {
  return l.rythme === null ? <span className="muted">–</span> : <span title={`Une soirée tous les ${pluriel(l.rythme, 'jour')}, d’ordinaire`}>{`${formatNumber(l.rythme)} j`}</span>
}

/** « +5 j » au-delà de son rythme ; « à l’heure » dedans. */
function retardEcrit(l: LigneDuCarnet): ReactNode {
  if (l.retard === null) return <span className="muted">–</span>
  return l.retard > 0 ? `+${formatNumber(l.retard)} j` : <span className="muted">à l’heure</span>
}

function Chiffre({ nom, children }: { nom: string; children: ReactNode }) {
  return (
    <div>
      <dt>{nom}</dt>
      <dd className="num">{children}</dd>
    </div>
  )
}
