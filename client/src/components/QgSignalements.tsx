import { useState, type ReactNode } from 'react'
import { api } from '../api'
import { Icon, type IconName } from './Icon'
import { Chiffre } from './QgModes'
import { espacesFines } from '../format'
import { formatNumber } from '../../../shared/typographie'
import { jourAvant, jourDe, jourEnToutesLettres } from '../../../shared/jour'
import { dureeEcrite, quandEcrit } from '../../../shared/qg'
import { CATEGORIES } from '../../../shared/categories'
import { SOUS_THEMES } from '../../../shared/etiquettes'
import { MAX_ANECDOTE, MAX_ANSWER_TEXT, MAX_TEXT } from '../../../shared/library'
import { MAX_REPONSE, bonneReponseChange, type CorrectionDeQuestion, type Niveau, type RapportDeSignalement, type SignalementDeCampagne } from '../../../shared/campagne'
import { branche as brancheParCle, deLaBranche } from '../../../shared/branches'
import { PALIER_DU_MAITRE } from '../../../shared/sentiers'
import {
  JOURS_DES_RELUS,
  compteDesRelus,
  corrigeAussiLeJour,
  issueDuRelu,
  issueEcrite,
  memeLecture,
  nomDuSousTheme,
  placesDuJour,
  type Classement,
  type IssueDUnSignalement,
  type PageDesSignalements,
  type RapportDuJour,
  type SignalementDuJour,
  type SignalementRelu,
  type VersionLue,
} from '../../../shared/qgSignalements'

/**
 * Les pièces de la page des signalements du QG (`AdminSignalements.tsx`, le
 * choix du 14 octobre 2026, sur maquettes) : une question signalée — du quiz
 * du jour ou de la campagne —, ce que les joueurs en disent et ce qu'ils y
 * ont répondu, et ses gestes ; corriger, reclasser ; l'historique des
 * questions relues. Les deux modes ont les mêmes mots : on y relit une
 * question, d'où qu'elle vienne.
 */

const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${formatNumber(n)} ${n > 1 ? motPluriel : mot}`
const pc = (x: number) => `${formatNumber(Math.round(x * 100))} %`

/** Il y a combien de temps : « il y a 20 min » dans l'heure, puis « aujourd’hui à 9 h 12 », « hier à 21 h 40 », « le 9 octobre ». */
export function depuisQuand(instant: number, maintenant: number): string {
  const ecart = maintenant - instant
  return ecart >= 0 && ecart < 3_600_000 ? `il y a ${dureeEcrite(ecart)}` : quandEcrit(instant, maintenant)
}

/** Le jour d'une question du jour : « aujourd’hui », « hier », « le 12 octobre ». */
export function quelJour(jour: string, maintenant: number): string {
  const aujourdhui = jourDe(maintenant)
  if (jour === aujourdhui) return 'aujourd’hui'
  if (jour === jourAvant(aujourdhui)) return 'hier'
  return `le ${jourEnToutesLettres(jour, true)}`
}

/** Un geste de l'écran : l'appel, puis le merci — la page se relit. */
export type Faire = (appel: () => Promise<unknown>, merci: string) => Promise<void>

// ── Les chiffres ────────────────────────────────────────────────────────────

/** Ce que les relus ont eu, en une ligne : « 8 corrigées · 5 retirées · 3 reclassées ». */
function bilanDesRelus(relus: readonly SignalementRelu[]): string {
  const c = compteDesRelus(relus)
  const parties = (
    [
      ['corrigee', 'corrigée'],
      ['reclassee', 'reclassée'],
      ['retiree', 'retirée'],
      ['annulee', 'annulée'],
      ['gardee', 'gardée'],
    ] as const
  )
    .filter(([cle]) => c[cle] > 0)
    .map(([cle, mot]) => pluriel(c[cle], mot))
  return parties.length > 0 ? parties.join(' · ') : 'aucune pour l’instant'
}

/**
 * Les quatre chiffres en tête : ce qui reste à relire — les questions, et
 * les joueurs qui les signalent, chacun une fois —, d'où elles viennent, et
 * ce qui a été fait des relues ces trente jours.
 */
export function ChiffresDesSignalements({ page }: { page: PageDesSignalements | null }) {
  const joueurs = page ? new Set([...page.jour, ...page.campagne].flatMap(s => s.rapports.filter(r => r.traiteLe === null).map(r => r.profileId))).size : 0
  const aujourdhui = page ? page.jour.filter(s => s.jour === jourDe(page.maintenant)).length : 0
  return (
    <ul className="qg-tuiles qg-tuiles-quatre">
      <Chiffre nom="À relire" valeur={page ? formatNumber(page.jour.length + page.campagne.length) : '–'} detail={page ? pluriel(joueurs, 'joueur') : undefined} />
      <Chiffre
        nom="Quiz du jour"
        valeur={page ? formatNumber(page.jour.length) : '–'}
        detail={page ? (aujourdhui > 0 ? `dont ${formatNumber(aujourdhui)} d’aujourd’hui` : 'aucune d’aujourd’hui') : undefined}
      />
      <Chiffre nom="Campagne" valeur={page ? formatNumber(page.campagne.length) : '–'} detail={page ? 'séries, sentiers, défi, duels' : undefined} />
      <Chiffre nom={`Relues ces ${JOURS_DES_RELUS} jours`} valeur={page ? formatNumber(page.relus.length) : '–'} detail={page ? bilanDesRelus(page.relus) : undefined} />
    </ul>
  )
}

// ── Une question signalée ───────────────────────────────────────────────────

/** Un geste sur une question : la pilule du QG, son icône, et la question au lecteur d'écran — la page en aligne des dizaines. */
function Geste({
  icone,
  nom,
  question,
  genre,
  occupe,
  onClick,
}: {
  icone?: IconName
  nom: string
  question: string
  genre?: 'oui' | 'alerte'
  occupe: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={'salon-geste' + (genre === 'oui' ? ' admin-geste-oui' : genre === 'alerte' ? ' admin-geste-danger' : '')}
      disabled={occupe}
      aria-label={`${nom} « ${question} »`}
      onClick={onClick}
    >
      {icone && <Icon name={icone} />}
      {nom}
    </button>
  )
}

/** La tête d'une carte : d'où vient la question, où on l'a jouée, combien la signalent et depuis quand. */
function TeteDeLaCarte({ mode, ou, joueurs, dernier, maintenant }: { mode: 'jour' | 'campagne'; ou: string; joueurs: number; dernier: number; maintenant: number }) {
  return (
    <div className="signalement-tete">
      <span className="etiquette signalement-mode">
        <Icon name={mode === 'jour' ? 'sun' : 'target'} />
        {mode === 'jour' ? 'Quiz du jour' : 'Campagne'}
      </span>
      <span className="muted small">{espacesFines(ou)}</span>
      <span className="signalement-qui small">
        <b className="num">{formatNumber(joueurs)}</b>
        {` ${joueurs > 1 ? 'joueurs' : 'joueur'} · ${joueurs > 1 ? 'dernier signalement ' : ''}${depuisQuand(dernier, maintenant)}`}
      </span>
    </div>
  )
}

/** Les réponses, la bonne cochée — et, au quiz du jour, ce que chacune a recueilli. */
function Reponses({ reponses, bonne, parts }: { reponses: readonly string[]; bonne: number; parts?: readonly number[] }) {
  return (
    <ul className="signalement-reponses" aria-label="Les réponses">
      {reponses.map((r, i) => (
        <li key={i} className={i === bonne ? 'signalement-juste' : undefined}>
          {i === bonne && <Icon name="check" />}
          <span>{r}</span>
          {i === bonne && <span className="sr-only"> (la bonne réponse)</span>}
          {parts && (
            <b className="num">
              {formatNumber(parts[i] ?? 0)} %<span className="sr-only"> des réponses</span>
            </b>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Un joueur qui la signale : qui, où, ce qu'il a répondu, quand — puis ce qu'il en dit. */
function LigneDuRapport({ prenom, login, details, texte }: { prenom: string | null; login: string | null; details: (string | false | null | undefined)[]; texte: string }) {
  return (
    <>
      <span>
        <b>{prenom ?? 'Profil supprimé'}</b>
        {login && <span className="muted small"> @{login}</span>}
      </span>
      <span className="muted small">{espacesFines(details.filter(Boolean).join(' · '))}</span>
      <span>{espacesFines(`« ${texte} »`)}</span>
    </>
  )
}

/** Qui la signale encore, puis ceux déjà relus — repliés : un signalement de plus après un « Garder » se lit avec eux. */
function Rapports<R extends { profileId: string; traiteLe: number | null }>({ rapports, ligne }: { rapports: readonly R[]; ligne: (r: R) => ReactNode }) {
  const ouverts = rapports.filter(r => r.traiteLe === null)
  const relus = rapports.filter(r => r.traiteLe !== null)
  return (
    <>
      <ul className="signalement-rapports" aria-label={`${pluriel(ouverts.length, 'joueur')} la signale${ouverts.length > 1 ? 'nt' : ''}`}>
        {ouverts.map(r => (
          <li key={r.profileId}>{ligne(r)}</li>
        ))}
      </ul>
      {relus.length > 0 && (
        <details className="signalement-relus">
          <summary className="muted small">{`${pluriel(relus.length, 'signalement')} déjà relu${relus.length > 1 ? 's' : ''}`}</summary>
          <ul className="signalement-rapports">
            {relus.map(r => (
              <li key={r.profileId}>{ligne(r)}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  )
}

/** Quand il l'a signalée, et, relu, ce qui en a été fait : « hier à 21 h 40, relu aujourd’hui à 9 h 12, gardée ». */
function quandDuRapport(r: { le: number; traiteLe: number | null; issue: IssueDUnSignalement | null }, maintenant: number): string {
  const signale = depuisQuand(r.le, maintenant)
  if (r.traiteLe === null) return signale
  return `${signale}, relu ${depuisQuand(r.traiteLe, maintenant)}${r.issue ? `, ${issueEcrite(r.issue).toLowerCase()}` : ''}`
}

// ── Le quiz du jour ─────────────────────────────────────────────────────────

/** Sa réponse ce jour-là. */
function saReponseDuJour(r: RapportDuJour): string {
  if (r.juste) return 'a trouvé'
  return r.reponse !== null ? `a répondu « ${r.reponse} »` : 'l’a laissée au temps'
}

/**
 * Une question du jour signalée : telle que son jour l'a posée — ses
 * réponses dans l'ordre de ce jour-là, et ce que chacune a recueilli —, qui
 * la signale, et ses gestes : annuler ses points pour tous tant que son jour
 * court, la corriger, la reclasser, la retirer de la réserve, la garder.
 * Retirée de la réserve, il ne reste qu'à refermer ce qu'on en dit.
 */
export function CarteDuJour({
  s,
  maintenant,
  occupe,
  faire,
  annuler,
}: {
  s: SignalementDuJour
  maintenant: number
  occupe: boolean
  faire: Faire
  annuler: (s: SignalementDuJour) => void
}) {
  const [ouvert, setOuvert] = useState<'corriger' | 'reclasser' | null>(null)
  const total = s.parReponse.reduce((n, x) => n + x, 0) + s.sansReponse
  const parts = total > 0 ? s.parReponse.map(n => Math.round((n / total) * 100)) : undefined
  const reserve = s.reserve
  const vivante = reserve !== null && !reserve.retiree
  // La réserve garde une autre version que celle de ce jour : corrigée depuis, pour la suite seulement.
  const autreVersion = reserve !== null && (placesDuJour(s, reserve) === null || reserve.texte !== s.texte || reserve.anecdote !== s.anecdote)
  const auJour = s.jour === jourDe(maintenant)
  const lecture = [
    total > 0 ? `${pluriel(total, 'réponse')} ${auJour ? 'aujourd’hui' : 'ce jour-là'}, ${pc((s.parReponse[s.bonne] ?? 0) / total)} justes` : 'aucune réponse',
    s.sansReponse > 0 && `${formatNumber(s.sansReponse)} laissée${s.sansReponse > 1 ? 's' : ''} au temps`,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <article className="qg-carte signalement-carte" aria-label={`Quiz du jour : « ${s.texte} »`}>
      <TeteDeLaCarte
        mode="jour"
        ou={[s.categorie, `${quelJour(s.jour, maintenant)}, question ${s.index + 1}`].filter(Boolean).join(' · ')}
        joueurs={s.joueurs}
        dernier={s.dernier}
        maintenant={maintenant}
      />
      {/* En grand et sans guillemets : un intitulé qui en porte — « La Reine des neiges » — s'y serait emmêlé. */}
      <p className="signalement-question">{espacesFines(s.texte)}</p>
      <Reponses reponses={s.reponses} bonne={s.bonne} parts={parts} />
      <p className="muted small">{lecture}</p>
      {s.anecdote && <p className="muted small">{espacesFines(s.anecdote)}</p>}
      {(s.annulee || !vivante || autreVersion) && (
        <p className="signalement-marques small">
          {s.annulee && <span className="etiquette">Points annulés pour tous</span>}
          {!reserve ? (
            <span className="muted">Elle n’est plus dans la réserve : il ne reste qu’à refermer.</span>
          ) : reserve.retiree ? (
            <span className="muted">Déjà retirée de la réserve, elle ne sera plus posée : il ne reste qu’à refermer.</span>
          ) : (
            autreVersion && <span className="muted">{espacesFines(`Corrigée dans la réserve depuis ce jour-là : « ${reserve.texte} »`)}</span>
          )}
        </p>
      )}
      <Rapports
        rapports={s.rapports}
        ligne={r => <LigneDuRapport prenom={r.prenom} login={r.login} texte={r.texte} details={[saReponseDuJour(r), quandDuRapport(r, maintenant)]} />}
      />
      {ouvert === 'corriger' && reserve ? (
        <CorrigerLaQuestion
          version={reserve}
          cle={`${s.jour}-${s.index}`}
          maxReponse={MAX_ANSWER_TEXT}
          occupe={occupe}
          annulable={s.annulable && !s.annulee}
          avertissement={(correction, nouvelle) =>
            nouvelle
              ? 'La bonne réponse change : la correction vaut pour ses prochains tirages, le jour qui l’a posée garde la sienne.'
              : corrigeAussiLeJour(s, reserve, correction)
                ? `Même bonne réponse : le jour qui l’a posée la prend aussi — l’écran de correction de chacun${auJour ? ', et ceux qui la jouent encore aujourd’hui' : ''}.`
                : 'Pour ses prochains tirages seulement : le jour qui l’a posée garde la sienne — ses joueurs ont répondu par la place de chaque réponse.'
          }
          onEnregistrer={(correction, nouvelle, annulerAussi) =>
            void faire(
              () => api.admin.corrigerDuJour(s.jour, s.index, correction, annulerAussi),
              annulerAussi ? 'Corrigée, ses points annulés pour tous' : nouvelle ? 'Corrigée pour ses prochains tirages' : 'Corrigée',
            )
          }
          onAnnuler={() => setOuvert(null)}
        />
      ) : ouvert === 'reclasser' && reserve ? (
        <ReclasserLaQuestion
          avant={{ categorie: reserve.categorie ?? '', sousTheme: reserve.sousTheme, difficulte: reserve.difficulte }}
          // Sans métadonnées — la routine ne l'a pas encore décrite —, seule sa catégorie se reclasse.
          avecMeta={reserve.difficulte !== null}
          occupe={occupe}
          difficulteAvant={reserve.difficulte !== null ? `Estimée ${reserve.difficulte} par la routine qui l’a décrite, en pointillé.` : null}
          note={
            reserve.difficulte !== null
              ? 'Pour ses prochains tirages : le jour qui l’a posée garde sa catégorie, et les écussons de chacun ne bougent pas.'
              : 'La routine ne l’a pas encore décrite : seule sa catégorie se reclasse, pour ses prochains tirages. Le jour qui l’a posée garde la sienne.'
          }
          onEnregistrer={classement => void faire(() => api.admin.reclasserDuJour(s.jour, s.index, classement), 'Reclassée')}
          onAnnuler={() => setOuvert(null)}
        />
      ) : (
        <div className="admin-gestes">
          {s.annulable && !s.annulee && <Geste nom="Annuler ses points pour tous" question={s.texte} genre="alerte" occupe={occupe} onClick={() => annuler(s)} />}
          {vivante && (
            <>
              <Geste icone="edit" nom="Corriger" question={s.texte} genre="oui" occupe={occupe} onClick={() => setOuvert('corriger')} />
              <Geste icone="tag" nom="Reclasser" question={s.texte} occupe={occupe} onClick={() => setOuvert('reclasser')} />
              <Geste
                icone="trash"
                nom="Retirer de la réserve"
                question={s.texte}
                occupe={occupe}
                onClick={() => void faire(() => api.admin.retirerDuJour(s.reserveId, s.jour, s.index), 'Retirée de la réserve')}
              />
            </>
          )}
          <Geste
            icone="check"
            nom={vivante ? 'Garder' : 'Refermer'}
            question={s.texte}
            occupe={occupe}
            onClick={() => void faire(() => api.admin.garderDuJour(s.jour, s.index), vivante ? 'Gardée' : 'Refermé')}
          />
        </div>
      )}
    </article>
  )
}

// ── La campagne ─────────────────────────────────────────────────────────────

/** Une question au singulier, comme les marches des sentiers : « une question moyenne à l'usage ». */
const QUESTION_DE_NIVEAU: Record<Niveau, string> = { facile: 'facile', moyen: 'moyenne', difficile: 'difficile', expert: 'experte' }
const ORIGINES: Record<SignalementDeCampagne['origine'], string> = { depot: 'base du dépôt', routine: 'routine du matin', correction: 'née d’une correction' }

/**
 * Ce que toutes les réponses de campagne disent de la question, à côté de
 * ce que l'écriture en estimait : un « elle est trop dure » se juge là. Puis
 * d'où elle vient, et son identifiant — c'est lui qu'on cherche dans les
 * fichiers du dépôt.
 */
function lectureDeLaQuestion(s: SignalementDeCampagne, maintenant: number): string {
  const { justes, total } = s.mesure
  return [
    total > 0 ? `${pluriel(total, 'réponse')} en campagne, ${pc(justes / total)} justes` : 'aucune réponse en campagne pour l’instant',
    `estimée ${s.difficulte} sur 5 à l’écriture, ${QUESTION_DE_NIVEAU[s.niveau]} à l’usage`,
    // « retouchée » : corrigée ou reclassée, les deux se rangent comme une correction.
    ORIGINES[s.origine] + (s.corrigeeLe !== null ? `, retouchée ${depuisQuand(s.corrigeeLe, maintenant)}` : ''),
    s.questionId,
  ].join(' · ')
}

/** Où il l'a jouée, en un mot pour la tête de la carte : « série, sentier, duel ». */
const LIEUX: Record<RapportDeSignalement['ou'], string> = {
  serie: 'série',
  sentier: 'sentier',
  defi: 'défi de la semaine',
  duel: 'duel',
  revision: 'révision',
  rencontre: 'contre Automate',
  sujet: 'parcours de thème',
}

/** Où il l'a jouée : « en série », « sentier des mythologies, palier 3 », « défi de la semaine », « en duel », « en révision », « contre Automate ». */
function ouDuRapport(r: RapportDeSignalement): string {
  if (r.ou === 'defi') return 'défi de la semaine'
  if (r.ou === 'duel') return 'en duel'
  if (r.ou === 'serie') return 'en série'
  if (r.ou === 'revision') return 'en révision'
  if (r.ou === 'rencontre') return 'contre Automate'
  // Les mots de la page du joueur : un parcours de thème (« sentier à thème » jusqu'au 12 octobre 2026).
  if (r.ou === 'sujet') return 'parcours de thème'
  const b = brancheParCle(r.branche)
  const palier = r.palier === PALIER_DU_MAITRE ? 'palier de maître' : r.palier !== undefined ? `palier ${r.palier}` : null
  return [b ? `sentier ${deLaBranche(b)}` : 'sentier', palier].filter(Boolean).join(', ')
}

/** Ce qu'il a répondu, tel qu'il l'a lu. */
function saReponse(r: RapportDeSignalement): string | null {
  if (r.juste === true) return 'a trouvé'
  if (r.juste === false) return r.reponse !== null ? `a répondu « ${r.reponse} »` : 'a répondu faux'
  return null
}

/**
 * Une question de la campagne signalée — en série, sur un sentier, au défi,
 * en duel… — : qui la signale, où, ce qu'il y a répondu, dans la version
 * que sa série a gardée ; ce que disent toutes les réponses ; ses gestes :
 * la corriger, la reclasser, la retirer de la campagne, la garder.
 */
export function CarteDeCampagne({ s, maintenant, occupe, faire }: { s: SignalementDeCampagne; maintenant: number; occupe: boolean; faire: Faire }) {
  const [ouvert, setOuvert] = useState<'corriger' | 'reclasser' | null>(null)
  const lieux = [...new Set(s.rapports.filter(r => r.traiteLe === null).map(r => LIEUX[r.ou]))]
  return (
    <article className="qg-carte signalement-carte" aria-label={`Campagne : « ${s.texte} »`}>
      <TeteDeLaCarte
        mode="campagne"
        ou={[`${s.categorie} › ${nomDuSousTheme(s.categorie, s.sousTheme)}`, lieux.join(', ')].filter(Boolean).join(' · ')}
        joueurs={s.joueurs}
        dernier={s.dernier}
        maintenant={maintenant}
      />
      <p className="signalement-question">{espacesFines(s.texte)}</p>
      <Reponses reponses={s.reponses} bonne={s.bonne} />
      <p className="muted small">{lectureDeLaQuestion(s, maintenant)}</p>
      {s.anecdote && <p className="muted small">{espacesFines(s.anecdote)}</p>}
      {s.retiree && (
        <p className="signalement-marques small">
          <span className="muted">Déjà retirée de la campagne : on la signale depuis une série tirée avant. Il ne reste qu’à refermer.</span>
        </p>
      )}
      <Rapports
        rapports={s.rapports}
        ligne={r => (
          <LigneDuRapport
            prenom={r.prenom}
            login={r.login}
            texte={r.texte}
            details={[ouDuRapport(r), saReponse(r), quandDuRapport(r, maintenant), r.versionDAvant && 'a lu la version d’avant une correction']}
          />
        )}
      />
      {ouvert === 'corriger' ? (
        <CorrigerLaQuestion
          version={s}
          cle={s.questionId}
          maxReponse={MAX_REPONSE}
          // Un vrai ou faux garde ses deux réponses : seule la bonne se coche.
          reponsesFixes={s.reponses.length === 2}
          occupe={occupe}
          annulable={false}
          avertissement={(_correction, nouvelle) =>
            `${
              nouvelle
                ? 'La bonne réponse change : la question repartira sous un nouvel identifiant, sans les mesures de l’ancienne, qui sera retirée.'
                : 'Même bonne réponse : la question garde son identifiant, ses réponses passées et sa difficulté mesurée.'
            } Les séries déjà tirées gardent la version qu’elles ont lue.`
          }
          onEnregistrer={(correction, nouvelle) =>
            void faire(() => api.admin.corrigerDansLaCampagne(s.questionId, correction), nouvelle ? 'Corrigée, sous un nouvel identifiant' : 'Corrigée')
          }
          onAnnuler={() => setOuvert(null)}
        />
      ) : ouvert === 'reclasser' ? (
        <ReclasserLaQuestion
          avant={{ categorie: s.categorie, sousTheme: s.sousTheme, difficulte: s.difficulte }}
          avecMeta
          occupe={occupe}
          difficulteAvant={`Estimée ${s.difficulte} à l’écriture, en pointillé${s.mesure.total > 0 ? ` ; ses ${pluriel(s.mesure.total, 'réponse')} la placent déjà « ${QUESTION_DE_NIVEAU[s.niveau]} »` : ''}. L’estimation compte d’abord pour une question jeune.`}
          note="Elle rejoint les séries, les sentiers et le défi de sa nouvelle catégorie dès le prochain tirage. Les réponses déjà données gardent la leur : les écussons de chacun ne bougent pas."
          onEnregistrer={classement => void faire(() => api.admin.reclasserDansLaCampagne(s.questionId, classement), 'Reclassée')}
          onAnnuler={() => setOuvert(null)}
        />
      ) : s.retiree ? (
        <div className="admin-gestes">
          <Geste icone="check" nom="Refermer" question={s.texte} occupe={occupe} onClick={() => void faire(() => api.admin.garderDeLaCampagne(s.questionId), 'Refermé')} />
        </div>
      ) : (
        <div className="admin-gestes">
          <Geste icone="edit" nom="Corriger" question={s.texte} genre="oui" occupe={occupe} onClick={() => setOuvert('corriger')} />
          <Geste icone="tag" nom="Reclasser" question={s.texte} occupe={occupe} onClick={() => setOuvert('reclasser')} />
          <Geste
            icone="trash"
            nom="Retirer de la campagne"
            question={s.texte}
            occupe={occupe}
            onClick={() => void faire(() => api.admin.retirerDeLaCampagne(s.questionId), 'Retirée de la campagne')}
          />
          <Geste icone="check" nom="Garder" question={s.texte} occupe={occupe} onClick={() => void faire(() => api.admin.garderDeLaCampagne(s.questionId), 'Gardée')} />
        </div>
      )}
    </article>
  )
}

// ── Corriger, reclasser ─────────────────────────────────────────────────────

/**
 * Corriger une question signalée : ce que le joueur lit — l'intitulé, les
 * réponses et la bonne, l'anecdote —, relu au serveur. L'écran dit avant
 * d'enregistrer ce que la correction fera (`avertissement`) : la même règle
 * qu'au serveur (`bonneReponseChange`, `corrigeAussiLeJour`). Au quiz du
 * jour, tant que son jour court, ses points s'annulent pour tous avec elle,
 * d'office quand la bonne réponse change : ses signalements refermés, la
 * page ne la montrerait plus pour le faire après.
 */
export function CorrigerLaQuestion({
  version,
  cle,
  maxReponse,
  reponsesFixes = false,
  occupe,
  annulable,
  avertissement,
  onEnregistrer,
  onAnnuler,
}: {
  version: VersionLue
  cle: string
  maxReponse: number
  reponsesFixes?: boolean
  occupe: boolean
  /** Ses points peuvent encore s'annuler pour tous : la case paraît. */
  annulable: boolean
  avertissement: (correction: CorrectionDeQuestion, nouvelle: boolean) => string
  onEnregistrer: (correction: CorrectionDeQuestion, nouvelle: boolean, annulerAussi: boolean) => void
  onAnnuler: () => void
}) {
  const [texte, setTexte] = useState(version.texte)
  const [reponses, setReponses] = useState([...version.reponses])
  const [bonne, setBonne] = useState(version.bonne)
  const [anecdote, setAnecdote] = useState(version.anecdote ?? '')
  /** Annuler ses points pour tous : null tant qu'on n'a pas touché la case — elle suit alors la bonne réponse. */
  const [annuler, setAnnuler] = useState<boolean | null>(null)
  const correction: CorrectionDeQuestion = { texte, reponses, bonne, anecdote: anecdote.trim() || null }
  const nouvelle = bonneReponseChange(version, correction)
  const annulerAussi = annulable && (annuler ?? nouvelle)
  return (
    <form
      className="correction-question"
      onSubmit={e => {
        e.preventDefault()
        onEnregistrer(correction, nouvelle, annulerAussi)
      }}
    >
      <label>
        <span className="label">L’intitulé</span>
        <textarea className="input" rows={3} maxLength={MAX_TEXT} value={texte} onChange={e => setTexte(e.target.value)} />
      </label>
      <fieldset className="correction-reponses">
        <legend className="label">Les réponses — la bonne cochée</legend>
        {reponses.map((r, i) => (
          <label key={i} className={'correction-reponse' + (i === bonne ? ' is-correct' : '')}>
            <input type="radio" name={`bonne-${cle}`} checked={i === bonne} onChange={() => setBonne(i)} aria-label={`La réponse ${i + 1} est la bonne`} />
            {reponsesFixes ? (
              <span>{r}</span>
            ) : (
              <input
                className="input"
                maxLength={maxReponse}
                aria-label={`Réponse ${i + 1}`}
                value={r}
                onChange={e => setReponses(rs => rs.map((x, j) => (j === i ? e.target.value : x)))}
              />
            )}
          </label>
        ))}
      </fieldset>
      <label>
        <span className="label">L’anecdote, montrée après la réponse</span>
        <textarea className="input" rows={3} maxLength={MAX_ANECDOTE} value={anecdote} onChange={e => setAnecdote(e.target.value)} />
      </label>
      <p className="muted small" aria-live="polite">
        {espacesFines(avertissement(correction, nouvelle))}
      </p>
      {annulable && (
        <label className="correction-annuler small">
          <input type="checkbox" checked={annulerAussi} onChange={e => setAnnuler(e.target.checked)} />
          <span>Annuler aussi ses points pour tous : ceux qui l’ont jouée aujourd’hui la perdent du classement, l’expérience de chacun suit.</span>
        </label>
      )}
      <div className="admin-gestes">
        <button type="submit" className="salon-geste admin-geste-oui" disabled={occupe || memeLecture(version, correction)}>
          <Icon name="check" />
          Enregistrer la correction
        </button>
        <button type="button" className="salon-geste" disabled={occupe} onClick={onAnnuler}>
          Annuler
        </button>
      </div>
    </form>
  )
}

/**
 * Reclasser une question signalée (le choix du 14 octobre 2026) : sa
 * catégorie, son sous-thème, sa difficulté estimée de 1 à 5 — celle
 * d'avant en pointillé. Une question sans métadonnées ne reclasse que sa
 * catégorie. Pour la suite : les réponses déjà données gardent la leur.
 */
export function ReclasserLaQuestion({
  avant,
  avecMeta,
  occupe,
  difficulteAvant,
  difficulteProposee,
  note,
  onEnregistrer,
  onAnnuler,
}: {
  avant: Classement
  avecMeta: boolean
  occupe: boolean
  /** Ce que la difficulté d'avant voulait dire. */
  difficulteAvant: string | null
  /** Celle que ses réponses disent, déjà choisie : la question que la mesure contredit (`/admin#campagne`). */
  difficulteProposee?: number
  note: string
  onEnregistrer: (classement: Classement) => void
  onAnnuler: () => void
}) {
  const [categorie, setCategorie] = useState(avant.categorie)
  const [sousTheme, setSousTheme] = useState(avant.sousTheme ?? '')
  const [difficulte, setDifficulte] = useState<number | null>(difficulteProposee ?? avant.difficulte)
  const sousThemes = (SOUS_THEMES as Record<string, readonly { cle: string; nom: string }[]>)[categorie] ?? []
  const apres: Classement = { categorie, sousTheme: avecMeta ? sousTheme || null : null, difficulte: avecMeta ? difficulte : null }
  const complet = !!categorie && (!avecMeta || (apres.sousTheme !== null && apres.difficulte !== null))
  const change = apres.categorie !== avant.categorie || apres.sousTheme !== avant.sousTheme || apres.difficulte !== avant.difficulte
  return (
    <form
      className="correction-question"
      onSubmit={e => {
        e.preventDefault()
        if (complet && change) onEnregistrer(apres)
      }}
    >
      <div className="reclassement-champs">
        <label>
          <span className="label">La catégorie</span>
          <select
            className="input"
            value={categorie}
            onChange={e => {
              const c = e.target.value
              setCategorie(c)
              // Un sous-thème est d'une catégorie : il se rechoisit avec elle.
              if (!(SOUS_THEMES as Record<string, readonly { cle: string }[]>)[c]?.some(x => x.cle === sousTheme)) setSousTheme('')
            }}
          >
            {!avant.categorie && <option value="">Choisis une catégorie</option>}
            {CATEGORIES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {avecMeta && (
          <label>
            <span className="label">Le sous-thème</span>
            <select className="input" value={sousTheme} onChange={e => setSousTheme(e.target.value)}>
              <option value="" disabled>
                Choisis un sous-thème
              </option>
              {sousThemes.map(x => (
                <option key={x.cle} value={x.cle}>
                  {x.nom}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {avecMeta && (
        <fieldset className="reclassement-crans">
          <legend className="label">La difficulté estimée</legend>
          <div className="reclassement-rangee">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                className={'reclassement-cran num' + (n === avant.difficulte ? ' reclassement-cran-avant' : '')}
                aria-pressed={difficulte === n}
                aria-label={`Difficulté ${n}${n === avant.difficulte ? ', celle d’avant' : ''}`}
                onClick={() => setDifficulte(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <span className="muted small">
            {espacesFines(`De 1, presque tout le monde la trouve, à 5, un passionné.${difficulteAvant ? ` ${difficulteAvant}` : ''}`)}
          </span>
        </fieldset>
      )}
      <p className="muted small">{espacesFines(note)}</p>
      <div className="admin-gestes">
        <button type="submit" className="salon-geste admin-geste-oui" disabled={occupe || !complet || !change}>
          <Icon name="tag" />
          Reclasser
        </button>
        <button type="button" className="salon-geste" disabled={occupe} onClick={onAnnuler}>
          Annuler
        </button>
      </div>
    </form>
  )
}

// ── L'historique ────────────────────────────────────────────────────────────

const ICONE_DE_L_ISSUE: Record<IssueDUnSignalement | 'relue', IconName> = {
  corrigee: 'edit',
  reclassee: 'tag',
  retiree: 'trash',
  annulee: 'x',
  gardee: 'check',
  relue: 'check',
}

/** Où se trouvait une question relue : « Quiz du jour · le 14 octobre, question 4 · 3 joueurs », « Campagne · Histoire · 2 joueurs ». */
function ouDuRelu(r: SignalementRelu, maintenant: number): string {
  const ou = r.source === 'jour' && r.jour ? `${quelJour(r.jour, maintenant)}, question ${Number(r.cle.split('#')[1]) + 1}` : null
  return [r.source === 'jour' ? 'Quiz du jour' : 'Campagne', r.categorie, ou, pluriel(r.joueurs, 'joueur')].filter(Boolean).join(' · ')
}

/**
 * Les questions relues ces trente jours, la plus récente d'abord : ce qui en
 * a été fait et quand (le choix du 14 octobre 2026, « Oui, trente jours,
 * avec l'issue »). Le détail du geste reste au journal.
 */
export function ListeDesRelus({ relus, maintenant }: { relus: readonly SignalementRelu[]; maintenant: number }) {
  if (relus.length === 0) return <p className="serif-note">Aucune question relue ces {JOURS_DES_RELUS} derniers jours.</p>
  return (
    <ul className="qg-liste">
      {relus.map(r => (
        <li key={`${r.source}:${r.cle}:${r.quand}`} className="signalement-relu">
          <span className="qg-ligne-texte">
            <b>{espacesFines(`« ${r.texte} »`)}</b>
            <span className="muted small">{espacesFines(ouDuRelu(r, maintenant))}</span>
          </span>
          <span className={`signalement-issue signalement-issue-${r.issue ?? 'relue'}`}>
            <Icon name={ICONE_DE_L_ISSUE[r.issue ?? 'relue']} />
            {espacesFines(issueDuRelu(r))}
          </span>
          <span className="muted small signalement-quand">{depuisQuand(r.quand, maintenant)}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * La ligne qui mène à la page des signalements, à la place de leur section
 * d'avant sur les pages du quiz du jour et de la campagne (le choix du 14
 * octobre 2026, « Une page qui remplace les sections »).
 */
export function VersLesSignalements({ questions, ouvrir }: { questions: number; ouvrir: () => void }) {
  return (
    <section className="admin-groupe" aria-label="Les signalements">
      <a
        className="qg-ligne signalements-lien"
        href="/admin#signalements"
        onClick={e => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
          e.preventDefault()
          ouvrir()
        }}
      >
        <span className="qg-rond">
          <Icon name="flag" />
        </span>
        <span className="qg-ligne-texte">
          <b>{questions > 0 ? `${pluriel(questions, 'question signalée', 'questions signalées')} à relire` : 'Aucune question signalée à relire'}</b>
          <span className="muted small">Les signalements : les relire, les corriger, les reclasser — et ce qui a été fait des questions relues</span>
        </span>
        <Icon name="chevron-right" className="qg-chevron" />
      </a>
    </section>
  )
}
