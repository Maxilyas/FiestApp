import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, motifDe } from '../api'
import { Icon } from './Icon'
import { Feuille } from './Pieces'
import { GrapheDesJours, enPourcentsEcrits } from './QgModes'
import { FicheDuJoueurAuQg } from './QgFicheJoueur'
import { supprimerLeProfil } from './AdminProfils'
import { espacesFines } from '../format'
import { formatNumber } from '../../../shared/typographie'
import { MODES_DU_QG, NOM_DU_MODE, dureeEcrite, type ModeDuQg } from '../../../shared/qg'
import { PERIODE_EN_TOUTES_LETTRES, type PeriodeDuQg } from '../../../shared/qgPeriodes'
import { enPourcents } from '../../../shared/qgDuJour'
import { JOURS_DU_RETOUR, type LigneDesModes, type ModesCoteACote } from '../../../shared/qgModes'
import {
  JOUEURS_DE_L_ACTIVITE,
  modePrefere,
  totalDesModes,
  type ActiviteDUnJoueur,
  type JoueurDeLActivite,
  type PageDeLActivite,
  type ParMode,
} from '../../../shared/qgActivite'

/** « 1 question », « 0 question », « 12 questions » : zéro s'écrit au singulier. */
const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${formatNumber(n)} ${n > 1 ? motPluriel : mot}`
const questions = (n: number) => pluriel(n, 'question')

/**
 * Ce qu'une partie s'appelle dans chaque mode : un quiz de soirée, une partie du jour ou de campagne, un duel — et au
 * Cabinet une épreuve de sa traversée, que sa page compte à part des traversées : « 12 parties » s'y lisait douze traversées.
 */
export function parties(m: ModeDuQg, n: number): string {
  return m === 'soiree' ? `${formatNumber(n)} quiz` : m === 'duel' ? pluriel(n, 'duel') : m === 'cabinet' ? pluriel(n, 'épreuve') : pluriel(n, 'partie')
}

/** Le mode, dans une phrase : « surtout la campagne ». */
const LE_MODE: Record<ModeDuQg, string> = { soiree: 'les soirées', campagne: 'la campagne', cabinet: 'le Cabinet', jour: 'le quiz du jour', duel: 'les duels' }

/** Où l'on joue, dans une phrase : « personne n'a joué au Cabinet » — « à le quiz du jour » se lisait jusque-là. */
const OU_L_ON_JOUE: Record<ModeDuQg, string> = { soiree: 'en soirée', campagne: 'à la campagne', cabinet: 'au Cabinet', jour: 'au quiz du jour', duel: 'aux duels' }

/** Les joueurs qu'une vue montre d'abord ; « Et N de plus » montre le reste, jusqu'à cinquante. */
const JOUEURS_D_ABORD = 10

/**
 * Les modes côte à côte au QG (`/admin#activite`, l'adresse que des favoris
 * gardent — l'activité du 17 octobre 2026, refaite au QG 2, lot 5 : « Les
 * modes aussi restent très sommaires », le propriétaire, le 3 novembre 2026).
 * Sur la période de la barre, les cinq modes en une ligne chacun — les
 * joueurs, les parties, les questions jouées, la réussite, la durée d'une
 * partie, le retour à J+7 —, triables à l'ordinateur, en cartes au
 * téléphone ; puis ce que l'activité avait déjà, sur trente jours : jour par
 * jour, et qui joue à quoi. La page se lit à son ouverture ; la période se
 * change sans la relire, le serveur les envoie toutes les quatre.
 */
export function QgActivite({ periode = '24h' }: { periode?: PeriodeDuQg }) {
  const [page, setPage] = useState<PageDeLActivite | null>(null)
  const [error, setError] = useState('')
  const [relire, setRelire] = useState(0)
  useEffect(() => {
    api.admin.activite().then(setPage, e => setError(motifDe(e)))
  }, [relire])

  if (error) return <p className="error">{error}</p>
  if (!page) return <p className="serif-note">Chargement…</p>
  return <ActiviteAuQg page={page} periode={periode} apresUnGeste={() => setRelire(n => n + 1)} />
}

/** La page lue : les modes côte à côte sur la période, puis les trente jours, jour par jour, et les joueurs. */
export function ActiviteAuQg({ page, periode = '30j', apresUnGeste }: { page: PageDeLActivite; periode?: PeriodeDuQg; apresUnGeste?: () => void }) {
  return (
    <>
      <p className="muted small">
        Une question jouée est une question posée à un joueur, qu’il y ait répondu ou l’ait laissée au temps ; une partie, un quiz de soirée, une partie du
        jour ou de campagne, une épreuve d’une traversée du Cabinet, un duel. Le poste de commande compte les joueurs ; cette page, ce qu’ils jouent et
        comment.
      </p>
      {page.modes ? (
        <LesModesCoteACote modes={page.modes} periode={periode} />
      ) : (
        <p className="serif-note">Le serveur ne dit pas encore la réussite ni la durée des modes : il le dira à sa prochaine mise en ligne.</p>
      )}
      <JourParJour page={page} />
      <QuiJoueAQuoi page={page} apresUnGeste={apresUnGeste} />
    </>
  )
}

// ── Côte à côte ────────────────────────────────────────────────────────────

type CleDuTri = 'mode' | 'joueurs' | 'parties' | 'questions' | 'reussite' | 'duree' | 'retour'

const COLONNES_DES_MODES: { cle: CleDuTri; nom: string; titre: string }[] = [
  { cle: 'mode', nom: 'Mode', titre: 'Dans l’ordre de leurs couleurs' },
  { cle: 'joueurs', nom: 'Joueurs', titre: 'Les personnes : un profil une fois ; en soirée, un invité sans profil une fois par soirée' },
  { cle: 'parties', nom: 'Parties', titre: 'Un quiz de soirée, une partie du jour ou de campagne, une épreuve du Cabinet, un duel' },
  { cle: 'questions', nom: 'Questions', titre: 'Les questions posées à un joueur, répondues ou laissées au temps' },
  { cle: 'reussite', nom: 'Réussite', titre: 'Les bonnes réponses aux QCM, sur ceux qui comptent' },
  { cle: 'duree', nom: 'Une partie', titre: 'La médiane d’une partie finie, de son début à sa fin' },
  { cle: 'retour', nom: 'Revenus à J+7', titre: 'Des joueurs d’un jour, la part qui rejoue au même mode dans les sept jours' },
]

/** Ce qu'une ligne vaut pour le tri : ce qui ne se compte pas passe après le plus petit. */
function valeurDuTri(l: LigneDesModes, cle: CleDuTri, retour: ModesCoteACote['retour']): number {
  switch (cle) {
    case 'mode':
      return MODES_DU_QG.indexOf(l.mode)
    case 'reussite':
      return (l.reussite && enPourcents(l.reussite)) ?? -1
    case 'duree':
      return l.duree?.medianeMs ?? -1
    case 'retour': {
      const r = retour.modes[l.mode]
      return enPourcents({ justes: r.revenus, sur: r.sur }) ?? -1
    }
    default:
      return l[cle]
  }
}

/** Une part en pour cent et sa piste, à l'or de la salle : une part n'est pas un mode. Au téléphone, la piste passe sous le chiffre (`.qg-cote-chiffres`). */
function Part({ pct, titre }: { pct: number; titre: string }) {
  return (
    <span className="qg-part" title={titre}>
      <span className="qg-part-piste" aria-hidden="true">
        <i style={{ width: `${Math.min(100, pct)}%` }} />
      </span>
      {enPourcentsEcrits(pct)}
    </span>
  )
}

/** Ce que les parties d'un mode s'appellent sur sa carte, au téléphone : la table, elle, n'a qu'une colonne « Parties ». */
const PARTIES_DE_LA_CARTE: Record<ModeDuQg, string> = { soiree: 'Quiz', campagne: 'Parties', cabinet: 'Épreuves', jour: 'Parties', duel: 'Duels' }

/** La réussite d'un mode : « 62 % » sur ses QCM ; le Cabinet n'en pose pas, une période vide n'en a pas. */
function reussiteEcrite(l: LigneDesModes): ReactNode {
  if (!l.reussite) return <span className="muted">pas des QCM</span>
  const pct = enPourcents(l.reussite)
  return pct === null ? '–' : <Part pct={pct} titre={`${formatNumber(l.reussite.justes)} bonnes sur ${pluriel(l.reussite.sur, 'QCM', 'QCM')}`} />
}

/** La médiane d'une partie : un quiz de soirée ne date pas sa fin ; une période sans partie finie n'en a pas. */
function dureeDeLaLigne(l: LigneDesModes): ReactNode {
  if (!l.duree) return <span className="muted">pas datée</span>
  return l.duree.medianeMs === null ? '–' : <span title={`la médiane de ${pluriel(l.duree.finies, 'partie finie', 'parties finies')}`}>{dureeEcrite(l.duree.medianeMs)}</span>
}

/** Le retour à J+7 d'un mode, sur les jours qui ont leurs sept jours derrière eux. */
function retourEcrit(r: { revenus: number; sur: number }): ReactNode {
  const pct = enPourcents({ justes: r.revenus, sur: r.sur })
  return pct === null ? '–' : <Part pct={pct} titre={`${formatNumber(r.revenus)} retours sur ${pluriel(r.sur, 'journée de jeu', 'journées de jeu')}`} />
}

/**
 * Les cinq modes côte à côte sur la période de la barre : la part de chacun
 * dans les questions jouées, puis une ligne par mode. À l'ordinateur, une
 * table triable sur chaque colonne (les pièces de celle des routes du
 * serveur) ; au téléphone, une carte par mode. Dessous, ce qui ne se compte
 * pas, et pourquoi.
 */
function LesModesCoteACote({ modes, periode }: { modes: ModesCoteACote; periode: PeriodeDuQg }) {
  const [tri, setTri] = useState<{ cle: CleDuTri; sens: 'monte' | 'descend' }>({ cle: 'mode', sens: 'monte' })
  const lignes = modes.periodes[periode]
  const triees = useMemo(
    () =>
      [...lignes].sort((a, b) => {
        const c = valeurDuTri(a, tri.cle, modes.retour) - valeurDuTri(b, tri.cle, modes.retour)
        return tri.sens === 'monte' ? c : -c
      }),
    [lignes, tri, modes.retour],
  )
  const trier = (cle: CleDuTri) => setTri(t => (t.cle === cle ? { cle, sens: t.sens === 'monte' ? 'descend' : 'monte' } : { cle, sens: cle === 'mode' ? 'monte' : 'descend' }))
  const total = lignes.reduce((n, l) => n + l.questions, 0)
  const partDe = (l: LigneDesModes) => (total > 0 ? Math.round((l.questions / total) * 100) : 0)
  return (
    <section className="qg-console" aria-labelledby="modes-cote">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Mode par mode</span>
          <h2 id="modes-cote">Sur {PERIODE_EN_TOUTES_LETTRES[periode]}</h2>
          <span className="muted small">{questions(total)} jouées, tous modes confondus</span>
        </div>
      </div>
      {total > 0 && (
        <>
          <span className="qg-assidu-barre" role="img" aria-label={`La part de chaque mode dans les questions jouées : ${lignes.map(l => `${NOM_DU_MODE[l.mode]} ${partDe(l)} %`).join(', ')}`}>
            {lignes.map(l => (l.questions > 0 ? <span key={l.mode} className={`qg-mode-${l.mode}`} style={{ width: `calc(${(l.questions / total) * 100}% - 2px)` }} /> : null))}
          </span>
          <ul className="qg-legende-modes" aria-hidden="true">
            {lignes.map(l => (
              <li key={l.mode}>
                <i className={`qg-pastille-mode qg-mode-${l.mode}`} />
                {NOM_DU_MODE[l.mode]} · {formatNumber(partDe(l))} %
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="qg-table-cadre qg-cote-table">
        <table className="qg-table">
          <caption className="sr-only">{`Les modes sur ${PERIODE_EN_TOUTES_LETTRES[periode]}, triés par ${COLONNES_DES_MODES.find(c => c.cle === tri.cle)?.nom.toLowerCase()}`}</caption>
          <thead>
            <tr>
              {COLONNES_DES_MODES.map(c => (
                <th
                  key={c.cle}
                  scope="col"
                  className={c.cle === 'mode' ? undefined : 'qg-nombre'}
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
            {triees.map(l => (
              <tr key={l.mode}>
                <th scope="row">
                  <span className="qg-cote-mode">
                    <i className={`qg-pastille-mode qg-mode-${l.mode}`} aria-hidden="true" />
                    <b>{NOM_DU_MODE[l.mode]}</b>
                  </span>
                </th>
                <td className="qg-nombre">{formatNumber(l.joueurs)}</td>
                <td className="qg-nombre">{formatNumber(l.parties)}</td>
                <td className="qg-nombre">{formatNumber(l.questions)}</td>
                <td className="qg-nombre">{reussiteEcrite(l)}</td>
                <td className="qg-nombre">{dureeDeLaLigne(l)}</td>
                <td className="qg-nombre">{retourEcrit(modes.retour.modes[l.mode])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Au téléphone, une carte par mode : la table et ses sept colonnes ne tenaient pas sans défiler de côté. */}
      <ul className="qg-liste qg-cote-cartes">
        {lignes.map(l => (
          <li key={l.mode} className="qg-cote-carte">
            <span className="qg-cote-mode">
              <i className={`qg-pastille-mode qg-mode-${l.mode}`} aria-hidden="true" />
              <b>{NOM_DU_MODE[l.mode]}</b>
            </span>
            <dl className="qg-cote-chiffres">
              <div>
                <dt>Joueurs</dt>
                <dd className="num">{formatNumber(l.joueurs)}</dd>
              </div>
              <div>
                <dt>{PARTIES_DE_LA_CARTE[l.mode]}</dt>
                <dd className="num">{formatNumber(l.parties)}</dd>
              </div>
              <div>
                <dt>Questions</dt>
                <dd className="num">{formatNumber(l.questions)}</dd>
              </div>
              <div>
                <dt>Réussite</dt>
                <dd className="num">{reussiteEcrite(l)}</dd>
              </div>
              <div>
                <dt>Une partie</dt>
                <dd className="num">{dureeDeLaLigne(l)}</dd>
              </div>
              <div>
                <dt>Revenus à J+7</dt>
                <dd className="num">{retourEcrit(modes.retour.modes[l.mode])}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <p className="muted small">
        <b>La réussite</b> ne compte que les QCM : au quiz du jour, ses questions posées — laissées au temps comprises, les annulées pour tous non ; en
        campagne et en duel, ses questions jouées ; en soirée, les QCM auxquels les profils de ses soirées ont répondu, une estimation n’y est jamais juste.
        Au Cabinet, ses jeux ne sont pas des QCM : rien ne s’y compte.
      </p>
      <p className="muted small">
        <b>Une partie</b> : la médiane de celles finies, de leur début à leur fin — une partie laissée puis reprise compte son attente ; au Cabinet, une
        épreuve, pas la traversée (sa page dit la durée d’une traversée). Un quiz de soirée ne date pas sa fin.
      </p>
      <p className="muted small">
        <b>Revenus à J+{JOURS_DU_RETOUR}</b> : des joueurs d’un jour, la part qui y rejoue dans les {JOURS_DU_RETOUR} jours suivants, sur les{' '}
        {pluriel(modes.retour.jours, 'jour')} de ces trente qui ont leurs sept jours derrière eux, quelle que soit la période — des profils seulement : un invité
        sans profil ne se suit pas d’un soir à l’autre.
      </p>
    </section>
  )
}

/**
 * Jour par jour, un petit graphique par mode, chacun à son échelle : les
 * soirées montent d'un coup le samedi, la campagne tous les jours — à une
 * seule échelle, on ne voyait que les soirées. Les questions jouées, ou les
 * parties.
 */
function JourParJour({ page }: { page: PageDeLActivite }) {
  const [quoi, setQuoi] = useState<'questions' | 'parties'>('questions')
  const jours = page.parJour.map(j => j.jour)
  return (
    <section className="qg-jour" aria-labelledby="activite-jours">
      <div className="qg-section-tete">
        <h2 className="compte-groupe" id="activite-jours">
          Jour par jour
        </h2>
        <span className="muted small">les trente derniers jours, quelle que soit la période</span>
      </div>
      <div className="onglets onglets-puces" role="group" aria-label="Ce que les graphiques comptent">
        {(['questions', 'parties'] as const).map(q => (
          <button key={q} type="button" className={'onglet' + (quoi === q ? ' actif' : '')} aria-pressed={quoi === q} onClick={() => setQuoi(q)}>
            {q === 'questions' ? 'Questions jouées' : 'Parties'}
          </button>
        ))}
      </div>
      <div className="qg-carte qg-ecran">
        <ul className="qg-multiples">
          {MODES_DU_QG.map(m => {
            const valeurs = page.parJour.map(j => j[quoi][m])
            const total = valeurs.reduce((n, x) => n + x, 0)
            const dire = (n: number) => (quoi === 'questions' ? questions(n) : parties(m, n))
            return (
              <li key={m} className="qg-multiple">
                <div className="qg-multiple-tete">
                  <b>{NOM_DU_MODE[m]}</b>
                  <span className="num">{formatNumber(total)}</span>
                </div>
                <GrapheDesJours
                  jours={jours}
                  valeurs={valeurs}
                  classe={`qg-mode-${m}`}
                  dire={dire}
                  titre={`${NOM_DU_MODE[m]}, ${quoi === 'questions' ? 'les questions jouées' : 'les parties'}`}
                  petit
                />
                <span className="muted small">{`${formatNumber(Math.round(total / Math.max(1, jours.length)))} par jour en moyenne`}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

type Vue = 'tous' | ModeDuQg

/** Les joueurs d'une vue, dans son ordre : tous les modes, ou un seul — ceux qui y ont joué, le plus assidu d'abord. */
export function joueursDeLaVue(joueurs: readonly JoueurDeLActivite[], vue: Vue): JoueurDeLActivite[] {
  if (vue === 'tous') return joueurs.slice(0, JOUEURS_DE_L_ACTIVITE)
  return joueurs
    .filter(j => j.questions[vue] > 0 || j.parties[vue] > 0)
    .sort((a, b) => b.questions[vue] - a.questions[vue] || b.parties[vue] - a.parties[vue])
    .slice(0, JOUEURS_DE_L_ACTIVITE)
}

/** « 1 240 questions · 64 parties · 18 jours sur 30 » : tous les modes ; dans un mode, les siens. */
function ceQuIlAJoue(j: ActiviteDUnJoueur, vue: Vue, jours: number): string {
  if (vue !== 'tous') return `${questions(j.questions[vue])} · ${parties(vue, j.parties[vue])}`
  const prefere = modePrefere(j)
  return [
    questions(totalDesModes(j.questions)),
    pluriel(j.jours, 'jour') + ` sur ${formatNumber(jours)}`,
    prefere && (prefere.part === 100 ? `rien que ${LE_MODE[prefere.mode]}` : `surtout ${LE_MODE[prefere.mode]}, ${formatNumber(prefere.part)} %`),
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Qui joue à quoi : chaque profil et ses questions jouées, en une barre —
 * sa longueur dit combien, ses couleurs à quoi. Tous les modes, ou un seul ;
 * une ligne ouvre sa fiche, comme dans « Les profils ». Les invités sans
 * profil n'y sont pas : ils ne comptent qu'au volume des soirées.
 */
function QuiJoueAQuoi({ page, apresUnGeste }: { page: PageDeLActivite; apresUnGeste?: () => void }) {
  const [vue, setVue] = useState<Vue>('tous')
  const [tous, setTous] = useState(false)
  const [ouvert, setOuvert] = useState<{ id: string; nom: string } | null>(null)
  const lignes = joueursDeLaVue(page.joueurs, vue)
  const montres = tous ? lignes : lignes.slice(0, JOUEURS_D_ABORD)
  const valeur = (q: ParMode) => (vue === 'tous' ? totalDesModes(q) : q[vue])
  const plusHaut = Math.max(1, ...lignes.map(j => valeur(j.questions)))
  const choisir = (v: Vue) => {
    setVue(v)
    setTous(false)
  }
  // Tous les modes : les cinquante plus assidus au plus ; ceux d'après se comptent.
  const autres = vue === 'tous' ? page.profilsActifs - lignes.length : 0
  return (
    <section className="qg-jour" aria-labelledby="activite-joueurs">
      <div className="qg-section-tete">
        <h2 className="compte-groupe" id="activite-joueurs">
          Qui joue à quoi
        </h2>
        <span className="muted small">{pluriel(page.profilsActifs, 'profil actif', 'profils actifs')} ces trente jours</span>
      </div>
      <div className="onglets onglets-puces" role="group" aria-label="Le mode">
        {(['tous', ...MODES_DU_QG] as const).map(v => (
          <button key={v} type="button" className={'onglet' + (vue === v ? ' actif' : '')} aria-pressed={vue === v} onClick={() => choisir(v)}>
            {v === 'tous' ? 'Tous les modes' : NOM_DU_MODE[v]}
          </button>
        ))}
      </div>
      <div className="qg-carte qg-ecran">
        {lignes.length === 0 ? (
          <p className="muted small">{vue === 'tous' ? 'Aucun profil n’a joué ces trente jours.' : `Aucun profil n’a joué ${OU_L_ON_JOUE[vue]} ces trente jours.`}</p>
        ) : (
          <>
            {vue === 'tous' && (
              <ul className="qg-legende-modes" aria-label="Les couleurs des modes">
                {MODES_DU_QG.map(m => (
                  <li key={m}>
                    <i className={`qg-pastille-mode qg-mode-${m}`} aria-hidden="true" />
                    {NOM_DU_MODE[m]}
                  </li>
                ))}
              </ul>
            )}
            <ol className="qg-liste">
              {montres.map(j => (
                <li key={j.id}>
                  <button type="button" className="qg-ligne" onClick={() => setOuvert({ id: j.id, nom: j.nom })}>
                    <span className="qg-ligne-texte">
                      <span className="qg-assidu-nom">
                        <b>{espacesFines(j.nom)}</b>
                        {j.suspendu && <span className="etiquette admin-etat-ferme">suspendu</span>}
                      </span>
                      <span className="qg-assidu-barre" role="img" aria-label={repartition(j) || 'aucune question jouée'}>
                        {/* Chaque morceau rend au suivant le filet qui les sépare : la barre du plus assidu tient juste. */}
                        {(vue === 'tous' ? MODES_DU_QG : [vue]).map(m =>
                          j.questions[m] > 0 ? <span key={m} className={`qg-mode-${m}`} style={{ width: `calc(${(j.questions[m] / plusHaut) * 100}% - 2px)` }} /> : null,
                        )}
                      </span>
                      <span className="muted small">{ceQuIlAJoue(j, vue, page.parJour.length)}</span>
                    </span>
                    <Icon name="chevron-right" className="qg-chevron" />
                  </button>
                </li>
              ))}
            </ol>
            {!tous && lignes.length > JOUEURS_D_ABORD && (
              <button type="button" className="lien-discret qg-suite" onClick={() => setTous(true)}>
                Et {formatNumber(lignes.length - JOUEURS_D_ABORD)} de plus
                <Icon name="chevron-down" />
              </button>
            )}
            {(tous || lignes.length <= JOUEURS_D_ABORD) && autres > 0 && (
              <p className="muted small">{autres > 1 ? `Les ${formatNumber(autres)} autres profils actifs ont moins joué.` : 'Un autre profil actif a moins joué.'}</p>
            )}
          </>
        )}
      </div>
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
    </section>
  )
}

/** Ce que la barre montre, pour le lecteur d'écran : chaque mode où il a joué. */
function repartition(j: ActiviteDUnJoueur): string {
  return MODES_DU_QG.filter(m => j.questions[m] > 0)
    .map(m => `${NOM_DU_MODE[m]} : ${questions(j.questions[m])}`)
    .join(', ')
}
