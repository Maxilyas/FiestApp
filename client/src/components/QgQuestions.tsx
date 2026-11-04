import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { api, motifDe } from '../api'
import { confirmDialog } from './Dialog'
import { Icon } from './Icon'
import { Feuille } from './Pieces'
import { CopierLeTableau } from './CopierLeTableau'
import { TuileDuQg } from './QgGraphes'
import { Chiffre } from './QgModes'
import { GestesDUneQuestionDeCampagne, GestesDUneQuestionDuJour, QUESTION_DE_NIVEAU, VersLesSignalements, depuisQuand, quelJour, type Faire } from './QgSignalements'
import { espacesFines } from '../format'
import { showToast } from '../state'
import { formatNumber } from '../../../shared/typographie'
import { jourAvant, jourDe } from '../../../shared/jour'
import { heureEcrite, jourAbrege } from '../../../shared/qg'
import { REPONSES_POUR_MESURER } from '../../../shared/campagne'
import { nomDuSousTheme } from '../../../shared/qgSignalements'
import {
  ETATS_DES_QUESTIONS,
  MODES_DES_QUESTIONS,
  QUESTIONS_PAR_PAGE,
  estUnPiege,
  partDeBonnes,
  type EtatDesQuestions,
  type ModeDUneQuestion,
  type PageDesQuestions,
  type QuestionAuQg,
  type TriDesQuestions,
} from '../../../shared/qgContenu'

/**
 * Les questions au QG (`/admin#questions`, le QG 2, lot 7 — la proposition du
 * 3 novembre 2026, « Les questions ») : toutes les questions jouées de la
 * campagne — séries, épreuves, défis, duels, et le Cabinet quand il pose une
 * question de la base — et du quiz du jour, au même endroit, chacune avec ce
 * que ses réponses disent d'elle ; jamais celles des soirées, qui sont aux
 * animateurs. Le serveur trie, filtre et découpe en pages
 * (`GET /api/admin/questions`, `shared/qgContenu.ts`) : des milliers de lignes
 * n'entrent pas dans la page d'un téléphone. Une ligne ouvre sa feuille — ce
 * que chaque réponse a recueilli, sa marche, et les gestes de la page des
 * signalements, les mêmes (`QgSignalements.tsx`).
 */

type Sens = 'monte' | 'descend'

const NOM_DU_MODE: Record<ModeDUneQuestion, string> = { jour: 'Quiz du jour', campagne: 'Campagne', cabinet: 'Cabinet', duel: 'Duels' }

/** Chaque état : sa puce, le titre de la liste, et l'ordre qu'il donne sans colonne choisie (`questionsRetenues`). */
const ETATS: Record<EtatDesQuestions, { puce: string; titre: string; ordre: string }> = {
  toutes: { puce: 'Toutes', titre: 'Toutes les questions jouées', ordre: 'les plus jouées d’abord' },
  contredites: { puce: 'Contredites', titre: 'Celles que leurs réponses contredisent', ordre: 'les plus nettement contredites d’abord' },
  pieges: { puce: 'Pièges', titre: 'Les pièges', ordre: 'les moins trouvées d’abord' },
  signalees: { puce: 'Signalées', titre: 'Celles que les joueurs signalent', ordre: 'les plus signalées d’abord' },
}

/** Les colonnes, chacune triable ; au téléphone, la question et ses bonnes réponses — le reste se lit sous l'intitulé. */
const COLONNES: { cle: TriDesQuestions; nom: string; titre: string; nombre?: boolean; detail?: boolean; monte?: boolean }[] = [
  { cle: 'texte', nom: 'Question', titre: 'Par ordre alphabétique', monte: true },
  { cle: 'mode', nom: 'Où', titre: 'Le mode où elle s’est jouée', detail: true, monte: true },
  { cle: 'categorie', nom: 'Catégorie', titre: 'Par catégorie', detail: true, monte: true },
  { cle: 'marche', nom: 'Marche', titre: 'La marche annoncée — et celle que disent ses réponses, quand elles la contredisent', detail: true, monte: true },
  { cle: 'reponses', nom: 'Réponses', titre: 'Les réponses qu’elle a reçues', nombre: true, detail: true },
  { cle: 'bonnes', nom: 'Bonnes', titre: `La part de bonnes réponses, dès ${REPONSES_POUR_MESURER} réponses`, nombre: true },
  { cle: 'temps', nom: 'Temps', titre: 'Le temps moyen d’une réponse — le quiz du jour seul a un chrono', nombre: true, detail: true },
  { cle: 'signalements', nom: 'Signal.', titre: 'Ses signalements pas encore relus', nombre: true, detail: true },
  { cle: 'derniere', nom: 'Posée', titre: 'La dernière fois qu’elle a été posée', detail: true },
]

/** Les ordres qu'on choisit au téléphone, où la table ne montre que deux colonnes, et leurs mots. */
const ORDRES: { cle: TriDesQuestions; sens: Sens; nom: string }[] = [
  { cle: 'reponses', sens: 'descend', nom: 'les plus jouées d’abord' },
  { cle: 'bonnes', sens: 'monte', nom: 'les moins trouvées d’abord' },
  { cle: 'bonnes', sens: 'descend', nom: 'les mieux trouvées d’abord' },
  { cle: 'temps', sens: 'descend', nom: 'les plus lentes d’abord' },
  { cle: 'signalements', sens: 'descend', nom: 'les plus signalées d’abord' },
  { cle: 'derniere', sens: 'descend', nom: 'les dernières posées d’abord' },
  { cle: 'marche', sens: 'monte', nom: 'de la plus facile à l’experte' },
  { cle: 'categorie', sens: 'monte', nom: 'par catégorie' },
  { cle: 'texte', sens: 'monte', nom: 'par ordre alphabétique' },
]

const ordreDu = (tri: { cle: TriDesQuestions; sens: Sens }) =>
  ORDRES.find(o => o.cle === tri.cle && o.sens === tri.sens)?.nom ??
  `par ${COLONNES.find(c => c.cle === tri.cle)?.nom.toLowerCase()}, ${tri.sens === 'monte' ? 'en montant' : 'en descendant'}`

const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${formatNumber(n)} ${n > 1 ? motPluriel : mot}`
const secondes = (ms: number) => `${formatNumber(Math.round(ms / 100) / 10)} s`

export function QgQuestions({
  etat,
  changerDEtat,
  apresUnGeste,
  versLesSignalements,
}: {
  /** L'état retenu par le QG : la page de la campagne ouvre celle-ci sur les contredites. */
  etat: EtatDesQuestions
  changerDEtat: (e: EtatDesQuestions) => void
  /** Un geste a peut-être refermé des signalements : la pastille du rail, et ce qui attend, se relisent. */
  apresUnGeste: () => void
  versLesSignalements: () => void
}) {
  const [mode, setMode] = useState<ModeDUneQuestion | null>(null)
  /** Ce qu'on tape, et le mot cherché : il part quand on s'arrête de taper — chaque lettre aurait relu une page. */
  const [saisie, setSaisie] = useState('')
  const [mot, setMot] = useState('')
  /** Null : l'ordre de l'état. */
  const [tri, setTri] = useState<{ cle: TriDesQuestions; sens: Sens } | null>(null)
  const [page, setPage] = useState(0)
  const [lue, setLue] = useState<PageDesQuestions | null>(null)
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [ouverte, setOuverte] = useState<QuestionAuQg | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [relecture, setRelecture] = useState(0)
  const liste = useRef<HTMLElement>(null)

  useEffect(() => {
    const m = saisie.trim()
    if (m === mot) return
    const t = setTimeout(() => {
      setMot(m)
      setPage(0)
    }, 250)
    return () => clearTimeout(t)
  }, [saisie, mot])

  useEffect(() => {
    // Une page revenue en retard ne remplace pas celle qu'on a demandée ensuite.
    let perimee = false
    setEnCours(true)
    api.admin
      .questions({ mode, etat, mot, tri: tri?.cle ?? null, sens: tri?.sens ?? 'descend', page })
      .then(
        p => {
          if (perimee) return
          setLue(p)
          setErreur('')
        },
        e => !perimee && setErreur(motifDe(e)),
      )
      .finally(() => !perimee && setEnCours(false))
    return () => {
      perimee = true
    }
  }, [mode, etat, mot, tri, page, relecture])

  const faire: Faire = async (appel, merci) => {
    setOccupe(true)
    try {
      await appel()
      showToast({ kind: 'info', message: merci })
      // La feuille se referme : la question a peut-être changé de version, d'identifiant, ou quitté la liste.
      setOuverte(null)
      setRelecture(n => n + 1)
      apresUnGeste()
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(false)
    }
  }

  /** Effacer les points d'une question du jour pour tous, tant que son jour court : la confirmation de la page des signalements. */
  const annuler = async (q: QuestionAuQg) => {
    if (q.gestes.source !== 'jour') return
    const { jour, index } = q.gestes
    const ok = await confirmDialog({
      title: `Effacer les points de la question ${index + 1} pour tous ?`,
      message:
        'Ses points s’effacent pour tous ceux qui l’ont jouée aujourd’hui, du classement du jour comme de celui du mois, et l’expérience de chacun suit. Elle reste dans le tirage, annulée : on ne peut pas revenir en arrière.',
      confirmLabel: 'Effacer ses points',
      danger: true,
    })
    if (ok) await faire(() => api.admin.annulerDuJour(jour, index), 'Points effacés pour tous')
  }

  const choisirLEtat = (e: EtatDesQuestions) => {
    changerDEtat(e)
    // Chaque état a son ordre : la colonne choisie pour un autre ne lui va pas.
    setTri(null)
    setPage(0)
  }
  const choisirLeMode = (m: ModeDUneQuestion | null) => {
    setMode(m)
    setPage(0)
  }
  const trier = (cle: TriDesQuestions) => {
    setTri(t => (t?.cle === cle ? { cle, sens: t.sens === 'monte' ? 'descend' : 'monte' } : { cle, sens: COLONNES.find(c => c.cle === cle)?.monte ? 'monte' : 'descend' }))
    setPage(0)
  }
  const feuilleter = (p: number) => {
    setPage(p)
    // Touchée en bas de la liste, la page suivante se lit d'en haut.
    if ((liste.current?.getBoundingClientRect().top ?? 0) < 0) liste.current?.scrollIntoView({ block: 'start' })
  }

  const totaux = lue?.totaux
  const pageLue = lue?.filtre.page ?? 0
  const ordre = tri ? ordreDu(tri) : ETATS[etat].ordre
  const valeurDuTri = tri ? `${tri.cle}:${tri.sens}` : ''
  return (
    <>
      <p className="muted small">
        Toutes les questions jouées de la campagne et du quiz du jour, au même endroit : ce qu’elles donnent vraiment, triées sur n’importe quelle colonne.
        Une ligne ouvre ce que chaque réponse a recueilli, et ses gestes — les mêmes qu’aux signalements.
      </p>
      <ul className="qg-tuiles qg-tuiles-quatre">
        <TuileDuQg
          nom="Jouées"
          valeur={totaux?.jouees}
          // Insécables devant les deux-points : au téléphone, « : depuis toujours » ouvrait une ligne.
          detail={lue ? espacesFines(`quiz du jour : ${lue.joursDuJour} jours · campagne : depuis toujours`) : undefined}
          onOuvrir={() => choisirLEtat('toutes')}
        />
        <TuileDuQg nom="Contredites" valeur={totaux?.contredites} detail="leurs réponses disent une autre marche" onOuvrir={() => choisirLEtat('contredites')} />
        <TuileDuQg nom="Pièges" valeur={totaux?.pieges} detail="moins d’un quart de bonnes réponses" onOuvrir={() => choisirLEtat('pieges')} />
        <TuileDuQg nom="Signalées" valeur={totaux?.signalees} detail="des signalements à relire" onOuvrir={() => choisirLEtat('signalees')} />
      </ul>

      <section ref={liste} className="qg-console qg-jouees" aria-labelledby="questions-titre" aria-busy={enCours}>
        <div className="qg-console-tete">
          <div>
            <span className="qg-etiquette">Les questions jouées</span>
            <h2 id="questions-titre">{ETATS[etat].titre}</h2>
            <span className="muted small">{ordre}</span>
          </div>
          {lue && <span className="etiquette num">{formatNumber(lue.total)}</span>}
        </div>
        <div className="qg-outils">
          <label className="qg-filtre">
            <Icon name="search" />
            <span className="sr-only">Chercher une question</span>
            {/* Court : au téléphone, « Un mot de l'intitulé, une catégorie… » se coupait dans le champ. */}
            <input type="search" value={saisie} placeholder="Un mot, une catégorie…" onChange={e => setSaisie(e.target.value)} />
          </label>
          <div className="onglets onglets-puces" role="group" aria-label="Où elle s’est jouée">
            <button type="button" className={'onglet' + (mode === null ? ' actif' : '')} aria-pressed={mode === null} onClick={() => choisirLeMode(null)}>
              Tous les modes
            </button>
            {MODES_DES_QUESTIONS.map(m => (
              <button key={m} type="button" className={'onglet' + (mode === m ? ' actif' : '')} aria-pressed={mode === m} onClick={() => choisirLeMode(m)}>
                <i className={`qg-tuile-cle qg-mode-${m}`} aria-hidden="true" />
                {NOM_DU_MODE[m]}
                {totaux && <span className="onglet-pastille">{formatNumber(totaux.parMode[m])}</span>}
              </button>
            ))}
          </div>
          <div className="onglets onglets-puces" role="group" aria-label="Lesquelles">
            {ETATS_DES_QUESTIONS.map(e => (
              <button key={e} type="button" className={'onglet' + (etat === e ? ' actif' : '')} aria-pressed={etat === e} onClick={() => choisirLEtat(e)}>
                {ETATS[e].puce}
              </button>
            ))}
          </div>
          {/* Au téléphone, la table ne montre que deux colonnes : l'ordre se choisit ici. */}
          <label className="qg-jouees-trier">
            <span className="muted small">Trier</span>
            <select
              className="input"
              value={valeurDuTri}
              onChange={e => {
                const [cle, sens] = e.target.value.split(':') as [TriDesQuestions, Sens]
                setTri(e.target.value ? { cle, sens } : null)
                setPage(0)
              }}
            >
              <option value="">{ETATS[etat].ordre}</option>
              {ORDRES.map(o => (
                <option key={`${o.cle}:${o.sens}`} value={`${o.cle}:${o.sens}`}>
                  {o.nom}
                </option>
              ))}
              {tri && !ORDRES.some(o => o.cle === tri.cle && o.sens === tri.sens) && <option value={valeurDuTri}>{ordre}</option>}
            </select>
          </label>
          {/* La page de cinquante qu'on voit, triée et filtrée : ce que la page montre, rien de plus. */}
          {lue && lue.lignes.length > 0 && <CopierLeTableau nom="cette page de questions" />}
        </div>
        {erreur && <p className="error">{erreur}</p>}
        {!lue ? (
          !erreur && <p className="serif-note">Chargement…</p>
        ) : lue.lignes.length === 0 ? (
          <p className="muted small">
            {lue.totaux.jouees === 0 ? 'Aucune question jouée pour l’instant : la liste se remplit avec les premières réponses.' : 'Aucune question ne correspond.'}
          </p>
        ) : (
          <div className="qg-table-cadre">
            <table className="qg-table qg-jouees-table">
              <caption className="sr-only">{`${ETATS[etat].titre}, ${ordre} — page ${pageLue + 1} sur ${lue.pages}`}</caption>
              <thead>
                <tr>
                  {COLONNES.map(c => (
                    <th
                      key={c.cle}
                      scope="col"
                      className={(c.nombre ? 'qg-nombre' : '') + (c.detail ? ' qg-colonne-detail' : '')}
                      aria-sort={tri?.cle === c.cle ? (tri.sens === 'monte' ? 'ascending' : 'descending') : undefined}
                    >
                      <button type="button" className="qg-tri" title={c.titre} onClick={() => trier(c.cle)}>
                        {c.nom}
                        {tri?.cle === c.cle && <Icon name={tri.sens === 'monte' ? 'arrow-up' : 'arrow-down'} />}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lue.lignes.map(q => (
                  <LigneDUneQuestion key={q.cle} q={q} maintenant={lue.maintenant} ouvrir={() => setOuverte(q)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lue && lue.pages > 1 && (
          <nav className="qg-jouees-pages" aria-label="Les pages de la liste">
            <button type="button" className="salon-geste" disabled={pageLue === 0 || enCours} onClick={() => feuilleter(pageLue - 1)}>
              <Icon name="arrow-left" />
              Précédentes
            </button>
            <span className="muted small" aria-live="polite">{`Page ${formatNumber(pageLue + 1)} sur ${formatNumber(lue.pages)} · ${QUESTIONS_PAR_PAGE} par page`}</span>
            <button type="button" className="salon-geste" disabled={pageLue >= lue.pages - 1 || enCours} onClick={() => feuilleter(pageLue + 1)}>
              Suivantes
              <Icon name="arrow-right" />
            </button>
          </nav>
        )}
        <p className="muted small">
          {espacesFines(
            `Le quiz du jour se lit sur ses ${lue?.joursDuJour ?? '…'} derniers jours, la campagne depuis toujours — séries, épreuves, défis, duels, et le Cabinet quand il pose une question de la base ; jamais les soirées, dont les quiz sont aux animateurs. La marche d’une question de campagne est celle où ses tirages la posent, et ses réponses la contredisent quand leur part de bonnes réponses en dit une autre (la mesure se refait toutes les six heures) ; au quiz du jour, c’est l’estimation de la routine qui l’a décrite.`,
          )}
        </p>
      </section>

      {ouverte && lue && (
        <FeuilleDUneQuestion
          q={ouverte}
          maintenant={lue.maintenant}
          occupe={occupe}
          faire={faire}
          annuler={() => void annuler(ouverte)}
          versLesSignalements={versLesSignalements}
          onFermer={() => setOuverte(null)}
        />
      )}
    </>
  )
}

/** Où elle s'est jouée : le premier de ses modes, sa couleur, et combien d'autres. */
function ModesDeLaQuestion({ modes }: { modes: readonly ModeDUneQuestion[] }) {
  const [premier, ...autres] = modes
  if (!premier) return <span className="muted">–</span>
  return (
    <span className="qg-jouee-mode">
      <i className={`qg-tuile-cle qg-mode-${premier}`} aria-hidden="true" />
      {NOM_DU_MODE[premier]}
      {autres.length > 0 && (
        <>
          <span aria-hidden="true">{` +${autres.length}`}</span>
          <span className="sr-only">{`, ${autres.map(m => NOM_DU_MODE[m]).join(', ')}`}</span>
        </>
      )}
    </span>
  )
}

/**
 * La marche annoncée, et celle que disent ses réponses quand elles la contredisent : « moyenne → difficile ». Sans
 * marche annoncée — une question du jour que la routine n'a pas encore décrite —, celle de ses réponses, en sourdine :
 * un tiret laissait toute la colonne vide sur les questions de l'amorce (le rendu du 4 novembre 2026).
 */
function MarcheDeLaQuestion({ q }: { q: QuestionAuQg }) {
  if (q.marche === null) {
    return q.marcheMesuree === null ? (
      <span className="muted">–</span>
    ) : (
      <span className="muted" title="Sans marche annoncée : celle que disent ses réponses">
        {QUESTION_DE_NIVEAU[q.marcheMesuree]}
        <span className="sr-only"> selon ses réponses, sans marche annoncée</span>
      </span>
    )
  }
  return (
    <span>
      {QUESTION_DE_NIVEAU[q.marche]}
      {q.contredite && q.marcheMesuree && (
        <span className="qg-jouee-contredite">
          {` → ${QUESTION_DE_NIVEAU[q.marcheMesuree]}`}
          <span className="sr-only"> selon ses réponses</span>
        </span>
      )}
    </span>
  )
}

/** Une ligne : au téléphone, ce que les colonnes cachées disent se lit sous l'intitulé. */
function LigneDUneQuestion({ q, maintenant, ouvrir }: { q: QuestionAuQg; maintenant: number; ouvrir: () => void }) {
  const part = partDeBonnes(q)
  const pct = part === null ? null : Math.round(part * 100)
  const piege = estUnPiege(q)
  const [premier, ...autres] = q.modes
  const sous = [
    premier && NOM_DU_MODE[premier] + (autres.length > 0 ? ` +${autres.length}` : ''),
    q.categorie,
    pluriel(q.reponses, 'réponse'),
    q.contredite && q.marche && q.marcheMesuree && `${QUESTION_DE_NIVEAU[q.marche]} → ${QUESTION_DE_NIVEAU[q.marcheMesuree]}`,
    q.signalements > 0 && pluriel(q.signalements, 'signalement'),
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <tr>
      <th scope="row">
        <button type="button" className="qg-jouee" onClick={ouvrir}>
          <span className="qg-jouee-texte">{q.texte}</span>
          <span className="qg-jouee-sous">{sous}</span>
        </button>
      </th>
      <td className="qg-colonne-detail">
        <ModesDeLaQuestion modes={q.modes} />
      </td>
      <td className="qg-colonne-detail qg-jouees-plie">{q.categorie ?? <span className="muted">–</span>}</td>
      <td className="qg-colonne-detail qg-jouees-plie">
        <MarcheDeLaQuestion q={q} />
      </td>
      <td className="qg-nombre qg-colonne-detail">{formatNumber(q.reponses)}</td>
      <td className={'qg-nombre' + (piege ? ' qg-table-alerte qg-jouee-piege' : '')}>
        {pct === null ? (
          <span className="muted" title={`Moins de ${REPONSES_POUR_MESURER} réponses : rien à en dire encore`}>
            –
          </span>
        ) : (
          <span className="qg-part">
            <span className="qg-part-piste" aria-hidden="true">
              <i style={{ width: `${pct}%` }} />
            </span>
            {formatNumber(pct)} %{piege && <span className="sr-only"> : un piège</span>}
          </span>
        )}
      </td>
      <td className="qg-nombre qg-colonne-detail">{q.msMoyen === null ? <span className="muted">–</span> : secondes(q.msMoyen)}</td>
      <td className={'qg-nombre qg-colonne-detail' + (q.signalements > 0 ? ' qg-table-alerte' : '')}>{formatNumber(q.signalements)}</td>
      <td className="qg-colonne-detail" title={depuisQuand(q.derniere, maintenant)}>
        {poseeLe(q.derniere, maintenant)}
      </td>
    </tr>
  )
}

/** Quand elle a été posée en dernier, court, pour sa colonne : « 21 h 40 » aujourd'hui, « hier », « 14 sept. ». */
function poseeLe(instant: number, maintenant: number): string {
  const jour = jourDe(instant)
  const aujourdhui = jourDe(maintenant)
  if (jour === aujourdhui) return heureEcrite(instant)
  return jour === jourAvant(aujourdhui) ? 'hier' : jourAbrege(jour)
}

/** Sa marche en une phrase : celle qu'elle annonce, d'où elle vient, et ce que ses réponses en disent. */
function marcheEnMots(q: QuestionAuQg): string {
  const annoncee = q.marche && QUESTION_DE_NIVEAU[q.marche]
  const mesuree = q.marcheMesuree && QUESTION_DE_NIVEAU[q.marcheMesuree]
  const avant =
    q.source === 'campagne'
      ? `Tirée ${annoncee} : estimée ${q.difficulte} sur 5 à l’écriture, puis lissée par les réponses de campagne et celles de sa famille`
      : q.difficulte !== null
        ? `Annoncée ${annoncee} : estimée ${q.difficulte} sur 5 par la routine qui l’a décrite`
        : 'Sans marche annoncée : la routine ne l’a pas encore décrite'
  const apres =
    mesuree === null
      ? `trop peu de réponses pour la mesurer — il en faut ${REPONSES_POUR_MESURER}`
      : q.contredite
        ? `ses réponses la disent ${mesuree} : « Reclasser » propose déjà la difficulté ${q.contredite.difficulteProposee}`
        : annoncee
          ? 'ses réponses le confirment'
          : `ses réponses la disent ${mesuree}`
  return `${avant} ; ${apres}.`
}

/**
 * Une question en grand : où elle s'est jouée, ses chiffres, ce que chaque
 * réponse a recueilli — la bonne marquée —, sa marche, et ses gestes. Au quiz
 * du jour, telle que son dernier jour l'a posée : ses gestes visent ce jour-là
 * (`GestesDUneQuestion`), comme une carte des signalements.
 */
function FeuilleDUneQuestion({
  q,
  maintenant,
  occupe,
  faire,
  annuler,
  versLesSignalements,
  onFermer,
}: {
  q: QuestionAuQg
  maintenant: number
  occupe: boolean
  faire: Faire
  annuler: () => void
  versLesSignalements: () => void
  onFermer: () => void
}) {
  const part = partDeBonnes(q)
  const g = q.gestes
  const anecdote = g.source === 'jour' ? g.anecdote : g.version.anecdote
  const ou =
    g.source === 'jour'
      ? [q.categorie, `posée en dernier ${quelJour(g.jour, maintenant)}, question ${g.index + 1}`]
      : [q.categorie && `${q.categorie} › ${nomDuSousTheme(q.categorie, g.sousTheme)}`, g.questionId]
  // La teinte du mode, sur la coche de la bonne réponse comme sur sa barre.
  const teinte = { '--teinte': `var(--mode-${q.source})` } as CSSProperties
  return (
    <Feuille titre={q.source === 'jour' ? 'Une question du quiz du jour' : 'Une question de la campagne'} onFermer={onFermer}>
      <div className="qg-fiche">
        <div className="qg-fiche-tete small">
          {q.modes.map(m => (
            <span key={m} className="qg-jouee-mode">
              <i className={`qg-tuile-cle qg-mode-${m}`} aria-hidden="true" />
              {NOM_DU_MODE[m]}
            </span>
          ))}
          <span className="muted">{espacesFines(ou.filter(Boolean).join(' · '))}</span>
        </div>
        {/* En grand et sans guillemets, comme aux signalements : un intitulé qui en porte s'y serait emmêlé. */}
        <p className="signalement-question">{espacesFines(q.texte)}</p>
        <ul className="qg-tuiles qg-tuiles-quatre">
          <Chiffre nom="Réponses" valeur={formatNumber(q.reponses)} detail={q.source === 'jour' ? 'au quiz du jour' : 'en campagne, hors révision'} />
          <Chiffre
            nom="Bonnes"
            valeur={part === null ? '–' : `${formatNumber(Math.round(part * 100))} %`}
            detail={part === null ? `dès ${REPONSES_POUR_MESURER} réponses` : `${formatNumber(q.justes)} sur ${formatNumber(q.reponses)}`}
          />
          <Chiffre nom="Temps moyen" valeur={q.msMoyen === null ? '–' : secondes(q.msMoyen)} detail={q.msMoyen === null ? 'sans chrono en campagne' : 'pour répondre'} />
          <Chiffre nom="Signalements" valeur={formatNumber(q.signalements)} detail="à relire" />
        </ul>

        <section className="qg-fiche-groupe" aria-labelledby="question-recueil">
          <h3 className="label" id="question-recueil">
            Ce que chaque réponse a recueilli
          </h3>
          {q.reponses === 0 ? (
            <p className="muted small">Personne n’y a encore répondu.</p>
          ) : (
            <ul className="qg-pistes qg-recueil" style={teinte}>
              {q.recueil.map((r, i) => {
                const p = Math.round((r.n / q.reponses) * 100)
                return (
                  <li key={i} className="qg-piste-ligne">
                    <span className="qg-piste-nom">
                      {r.bonne && <Icon name="check" />}
                      {r.texte}
                      {r.bonne && <span className="sr-only"> (la bonne réponse)</span>}
                    </span>
                    <span className="qg-piste" aria-hidden="true">
                      {p > 0 && <i className={r.bonne ? `qg-mode-${q.source}` : 'qg-piste-autre'} style={{ width: `${p}%` }} />}
                    </span>
                    <b className="num">
                      {formatNumber(p)} %<span className="sr-only">, {pluriel(r.n, 'réponse')}</span>
                    </b>
                  </li>
                )
              })}
            </ul>
          )}
          {q.autres > 0 && (
            <p className="muted small">
              {q.source === 'jour'
                ? `Et ${formatNumber(q.autres)} fois posée sans réponse — le temps écoulé, une réponse arrivée trop tard — ou répondue dans une version d’avant une correction.`
                : `Et ${pluriel(q.autres, 'réponse')} qu’on ne sait plus rapporter à l’une d’elles.`}
            </p>
          )}
        </section>

        <section className="qg-fiche-groupe" aria-labelledby="question-marche">
          <h3 className="label" id="question-marche">
            Sa marche
          </h3>
          <p className="small">{espacesFines(marcheEnMots(q))}</p>
        </section>

        {anecdote && (
          <section className="qg-fiche-groupe" aria-labelledby="question-anecdote">
            <h3 className="label" id="question-anecdote">
              L’anecdote
            </h3>
            <p className="muted small">{espacesFines(anecdote)}</p>
          </section>
        )}

        {(q.annulee || q.retiree) && (
          <p className="signalement-marques small">
            {q.annulee && <span className="etiquette">Points annulés pour tous</span>}
            {q.retiree && (
              <span className="muted">
                {g.source === 'jour' && g.reserve === null ? 'Elle n’est plus dans la réserve.' : 'Retirée de la réserve : ses prochains jours ne la poseront plus.'}
              </span>
            )}
          </p>
        )}

        {/* Ses signalements se relisent sur leur page, avec ce que chaque joueur en dit. */}
        {q.signalements > 0 && <VersLesSignalements questions={1} ouvrir={versLesSignalements} />}

        {g.source === 'jour' ? (
          <GestesDUneQuestionDuJour
            q={{
              jour: g.jour,
              index: g.index,
              reserveId: g.reserveId,
              texte: q.texte,
              reponses: g.copie.reponses,
              bonne: g.copie.bonne,
              reserve: g.reserve,
              annulee: q.annulee,
              annulable: g.annulable,
            }}
            maintenant={maintenant}
            occupe={occupe}
            faire={faire}
            annuler={annuler}
          />
        ) : (
          <GestesDUneQuestionDeCampagne
            q={{
              questionId: g.questionId,
              texte: g.version.texte,
              reponses: g.version.reponses,
              bonne: g.version.bonne,
              anecdote: g.version.anecdote,
              categorie: q.categorie ?? '',
              sousTheme: g.sousTheme,
              difficulte: q.difficulte ?? 3,
              niveau: q.marche ?? 'moyen',
              mesure: { justes: q.justes, total: q.reponses },
            }}
            occupe={occupe}
            faire={faire}
            difficulteProposee={q.contredite?.difficulteProposee}
          />
        )}
      </div>
    </Feuille>
  )
}
