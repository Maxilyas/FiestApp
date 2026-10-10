import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { quand } from '../format'
import { showToast } from '../state'
import { formatNumber } from '../../../shared/typographie'
import { SOUS_THEMES } from '../../../shared/etiquettes'
import { MAX_ANECDOTE, MAX_TEXT } from '../../../shared/library'
import {
  MAX_REPONSE,
  NIVEAUX,
  bonneReponseChange,
  type AdminDeLaCampagne,
  type AjoutsDeLaRoutine as Ajouts,
  type CorrectionDeQuestion,
  type Niveau,
  type RapportDeSignalement,
  type SignalementDeCampagne,
} from '../../../shared/campagne'
import { BRANCHES, branche as brancheParCle, deLaBranche } from '../../../shared/branches'
import { PALIERS, PALIER_DU_MAITRE, QUESTIONS_PAR_EPREUVE, TAUX_DU_CALIBRAGE, lectureDuPalier, type AdminDesSentiers, type StatsDuPalier } from '../../../shared/sentiers'
import { texteDuMelangeCourt } from './melanges'

/** Le nom d'un sous-thème, lu dans le catalogue de l'étiquetage. */
const nomDuSousTheme = (categorie: string, cle: string) =>
  (SOUS_THEMES as Record<string, readonly { cle: string; nom: string }[]>)[categorie]?.find(s => s.cle === cle)?.nom ?? cle

/**
 * La campagne, côté administrateur (`/admin#campagne`) : sa base — combien
 * de questions, par catégorie —, et les questions que les joueurs signalent,
 * avec qui les signale et ce qu'il y a répondu. « Corriger » la reprend ici
 * même — sous son identifiant, ou sous un neuf quand la bonne réponse change
 * (`bonneReponseChange`) ; « Retirer » la sort de la campagne pour tous ;
 * « Garder » referme les signalements.
 */
export function AdminCampagne() {
  const [etat, setEtat] = useState<AdminDeLaCampagne | null>(null)
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)

  const charger = () =>
    api.admin
      .campagne()
      .then(setEtat)
      .catch(e => setErreur(motifDe(e)))
  useEffect(() => {
    void charger()
  }, [])

  const faire = async (appel: () => Promise<unknown>, merci: string) => {
    setOccupe(true)
    try {
      await appel()
      showToast({ kind: 'info', message: merci })
      await charger()
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(false)
    }
  }

  if (erreur) return <p className="error">{erreur}</p>
  if (!etat) return <p className="serif-note">Chargement…</p>
  return (
    <>
      <AdminSentiers />

      <section className="admin-groupe" aria-labelledby="campagne-base-titre">
        <h2 className="compte-groupe" id="campagne-base-titre">
          La base
        </h2>
        <p className="muted small">
          {formatNumber(etat.questions)} questions écrites et étiquetées d’avance, rien qu’à la campagne : {formatNumber(etat.jouables)} à jouer
          {etat.retirees > 0 && `, ${formatNumber(etat.retirees)} retirée${etat.retirees > 1 ? 's' : ''}`}. Celles que la réserve du quiz du jour
          contient aussi ne sortent pas ici.
        </p>
        <ul className="campagne-admin-categories">
          {etat.parCategorie.map(c => (
            <li key={c.categorie}>
              <span>{c.categorie}</span>
              <b className="num">{formatNumber(c.questions)}</b>
            </li>
          ))}
        </ul>
        {/* Par difficulté estimée, de 1 à 5 : ce que la routine rattrape chaque matin. */}
        <details className="campagne-admin-difficultes">
          <summary className="muted small">Par difficulté, de 1 (presque tout le monde) à 5 (un passionné)</summary>
          <table className="small">
            <thead>
              <tr>
                <th scope="col">Catégorie</th>
                {[1, 2, 3, 4, 5].map(d => (
                  <th key={d} scope="col" className="num">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {etat.parDifficulte.map(c => (
                <tr key={c.categorie}>
                  <th scope="row">{c.categorie}</th>
                  {c.difficultes.map((n, i) => (
                    <td key={i} className="num">
                      {formatNumber(n)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section className="admin-groupe" aria-labelledby="campagne-routine-titre">
        <h2 className="compte-groupe" id="campagne-routine-titre">
          La routine du matin
        </h2>
        <AjoutsDeLaRoutine ajouts={etat.ajouts} occupe={occupe} faire={faire} />
      </section>

      <section className="admin-groupe" aria-labelledby="campagne-signalements-titre">
        <h2 className="compte-groupe" id="campagne-signalements-titre">
          Signalements {etat.signalements.length > 0 && <span className="compte-rond">{etat.signalements.length}</span>}
        </h2>
        {etat.signalements.length === 0 && <p className="muted small">Aucun signalement à relire.</p>}
        {etat.signalements.map(s => (
          <Signalement key={s.questionId} s={s} occupe={occupe} faire={faire} />
        ))}
      </section>
    </>
  )
}

/** Un geste de l'écran : l'appel, puis le merci — la liste se relit. */
type Faire = (appel: () => Promise<unknown>, merci: string) => Promise<void>

/** Une question au singulier, comme les marches des sentiers : « une question moyenne à l'usage ». */
const QUESTION_DE_NIVEAU: Record<Niveau, string> = { facile: 'facile', moyen: 'moyenne', difficile: 'difficile', expert: 'experte' }
const ORIGINES: Record<SignalementDeCampagne['origine'], string> = { depot: 'base du dépôt', routine: 'routine du matin', correction: 'née d’une correction' }

/**
 * Ce que toutes les réponses de campagne disent de la question, à côté de
 * ce que l'écriture en estimait : un « elle est trop dure » se juge là. Puis
 * d'où elle vient, et son identifiant — c'est lui qu'on cherche dans les
 * fichiers du dépôt.
 */
function lectureDeLaQuestion(s: SignalementDeCampagne): string {
  const { justes, total } = s.mesure
  return [
    total > 0 ? `${pluriel(total, 'réponse')} en campagne, ${pc(justes / total)} justes` : 'aucune réponse en campagne pour l’instant',
    `estimée ${s.difficulte} sur 5 à l’écriture, ${QUESTION_DE_NIVEAU[s.niveau]} à l’usage`,
    ORIGINES[s.origine] + (s.corrigeeLe !== null ? `, corrigée ${quand(s.corrigeeLe)}` : ''),
    s.questionId,
  ].join(' · ')
}

/** Où il l'a jouée : « en série », « sentier des mythologies, palier 3 », « défi de la semaine », « défi entre amis ». */
function ouDuRapport(r: RapportDeSignalement): string {
  if (r.ou === 'defi') return 'défi de la semaine'
  if (r.ou === 'duel') return 'défi entre amis'
  if (r.ou === 'serie') return 'en série'
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

/** Un joueur qui signale : qui, où, ce qu'il a répondu, quand — puis ce qu'il en dit. */
function Rapport({ r }: { r: RapportDeSignalement }) {
  const details = [
    ouDuRapport(r),
    saReponse(r),
    r.traiteLe === null ? quand(r.le) : `${quand(r.le)}, relu ${quand(r.traiteLe)}`,
    r.versionDAvant && 'a lu la version d’avant une correction',
  ].filter(Boolean)
  return (
    <li>
      <span>
        <b>{r.prenom ?? 'Profil supprimé'}</b>
        {r.login && <span className="muted small"> @{r.login}</span>}
      </span>
      <span className="muted small">{details.join(' · ')}</span>
      <span>« {r.texte} »</span>
    </li>
  )
}

function Signalement({ s, occupe, faire }: { s: SignalementDeCampagne; occupe: boolean; faire: Faire }) {
  const [corrige, setCorrige] = useState(false)
  const ouverts = s.rapports.filter(r => r.traiteLe === null)
  const relus = s.rapports.filter(r => r.traiteLe !== null)
  return (
    <div className="signalement">
      <p>
        <b>« {s.texte} »</b>{' '}
        <span className="muted">
          · {s.categorie} › {nomDuSousTheme(s.categorie, s.sousTheme)} · {quand(s.dernier)}
        </span>
      </p>
      <p className="muted small">
        {s.reponses.map((r, i) => (
          <span key={i} className={i === s.bonne ? 'catalogue-juste' : undefined}>
            {i > 0 && ' · '}
            {r}
          </span>
        ))}
      </p>
      {s.anecdote && <p className="muted small">{s.anecdote}</p>}
      <p className="muted small">{lectureDeLaQuestion(s)}</p>
      <ul className="signalement-rapports" aria-label={`${pluriel(s.joueurs, 'joueur')} la signale${s.joueurs > 1 ? 'nt' : ''}`}>
        {ouverts.map(r => (
          <Rapport key={r.profileId} r={r} />
        ))}
      </ul>
      {relus.length > 0 && (
        <details className="signalement-relus">
          <summary className="muted small">{`${pluriel(relus.length, 'signalement')} déjà relu${relus.length > 1 ? 's' : ''}`}</summary>
          <ul className="signalement-rapports">
            {relus.map(r => (
              <Rapport key={r.profileId} r={r} />
            ))}
          </ul>
        </details>
      )}
      {s.retiree ? (
        <>
          <p className="muted small">Déjà retirée de la campagne : on la signale depuis une série tirée avant. Il ne reste qu’à refermer.</p>
          <div className="row">
            <button
              className="btn btn-small btn-ghost"
              disabled={occupe}
              aria-label={`Refermer « ${s.texte} »`}
              onClick={() => void faire(() => api.admin.garderDeLaCampagne(s.questionId), 'Refermé')}
            >
              Refermer
            </button>
          </div>
        </>
      ) : corrige ? (
        <CorrigerLaQuestion s={s} occupe={occupe} faire={faire} onAnnuler={() => setCorrige(false)} />
      ) : (
        <div className="row">
          <button className="btn btn-small btn-primary" disabled={occupe} aria-label={`Corriger « ${s.texte} »`} onClick={() => setCorrige(true)}>
            Corriger
          </button>
          <button
            className="btn btn-small"
            disabled={occupe}
            aria-label={`Retirer de la campagne « ${s.texte} »`}
            onClick={() => void faire(() => api.admin.retirerDeLaCampagne(s.questionId), 'Retirée de la campagne')}
          >
            Retirer de la campagne
          </button>
          <button
            className="btn btn-small btn-ghost"
            disabled={occupe}
            aria-label={`Garder « ${s.texte} »`}
            onClick={() => void faire(() => api.admin.garderDeLaCampagne(s.questionId), 'Gardée')}
          >
            Garder
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Corriger une question signalée : ce que le joueur lit — l'intitulé, les
 * réponses et la bonne, l'anecdote —, relu au serveur par le juge de la
 * base. L'écran dit avant d'enregistrer ce que la correction fera de son
 * identifiant : la même bonne réponse le garde, une autre en tire un neuf et
 * retire l'ancienne (`bonneReponseChange`, la même règle qu'au serveur).
 */
function CorrigerLaQuestion({ s, occupe, faire, onAnnuler }: { s: SignalementDeCampagne; occupe: boolean; faire: Faire; onAnnuler: () => void }) {
  const [texte, setTexte] = useState(s.texte)
  const [reponses, setReponses] = useState(s.reponses)
  const [bonne, setBonne] = useState(s.bonne)
  const [anecdote, setAnecdote] = useState(s.anecdote ?? '')
  const vraiFaux = s.reponses.length === 2
  const correction: CorrectionDeQuestion = { texte, reponses, bonne, anecdote: anecdote.trim() || null }
  const nouvelle = bonneReponseChange(s, correction)
  const inchangee = texte === s.texte && reponses.every((r, i) => r === s.reponses[i]) && bonne === s.bonne && correction.anecdote === s.anecdote
  const enregistrer = () =>
    void faire(() => api.admin.corrigerDansLaCampagne(s.questionId, correction), nouvelle ? 'Corrigée, sous un nouvel identifiant' : 'Corrigée')
  return (
    <form
      className="correction-question"
      onSubmit={e => {
        e.preventDefault()
        enregistrer()
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
            <input type="radio" name={`bonne-${s.questionId}`} checked={i === bonne} onChange={() => setBonne(i)} aria-label={`La réponse ${i + 1} est la bonne`} />
            {vraiFaux ? (
              <span>{r}</span>
            ) : (
              <input
                className="input"
                maxLength={MAX_REPONSE}
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
        {nouvelle
          ? 'La bonne réponse change : la question repartira sous un nouvel identifiant, sans les mesures de l’ancienne, qui sera retirée.'
          : 'Même bonne réponse : la question garde son identifiant, ses réponses passées et sa difficulté mesurée.'}{' '}
        Les séries déjà tirées gardent la version qu’elles ont lue.
      </p>
      <div className="row">
        <button type="submit" className="btn btn-small btn-primary" disabled={occupe || inchangee}>
          Enregistrer la correction
        </button>
        <button type="button" className="btn btn-small btn-ghost" disabled={occupe} onClick={onAnnuler}>
          Annuler
        </button>
      </div>
    </form>
  )
}

/**
 * Ce que la routine du matin a déposé dans la base (`/api/campagne/base`) :
 * de quoi voir qu'elle tourne, et relire ses dernières questions — c'est la
 * première fois qu'un humain les lit. « Retirer » les sort de la campagne
 * pour tous, comme une question signalée.
 */
function AjoutsDeLaRoutine({ ajouts, occupe, faire }: { ajouts: Ajouts; occupe: boolean; faire: Faire }) {
  if (ajouts.total === 0) {
    return (
      <p className="muted small">
        Rien de déposé pour l’instant. La routine de la réserve du quiz du jour agrandit aussi la base, chaque matin, une fois son étape « base de la
        campagne » ajoutée (MISE-EN-LIGNE.md, étape 8).
      </p>
    )
  }
  return (
    <>
      <p className="muted small">
        {formatNumber(ajouts.aujourdhui)} question{ajouts.aujourdhui > 1 ? 's' : ''} aujourd’hui · {formatNumber(ajouts.septJours)} ces sept derniers jours ·{' '}
        {formatNumber(ajouts.total)} en tout{ajouts.dernierLe !== null && <> · dernier dépôt {quand(ajouts.dernierLe)}</>}
      </p>
      <ul className="campagne-ajouts">
        {ajouts.derniers.map(a => (
          <li key={a.id} className={a.retiree ? 'campagne-ajout-retire' : undefined}>
            <p>
              <b>« {a.texte} »</b>{' '}
              <span className="muted">
                · {a.categorie} › {nomDuSousTheme(a.categorie, a.sousTheme)} · difficulté {a.difficulte} · {quand(a.ajouteeLe)}
              </span>
            </p>
            {a.retiree ? (
              <p className="muted small">{a.remplacee ? 'Corrigée : une nouvelle version se joue à sa place.' : 'Retirée de la campagne.'}</p>
            ) : (
              <button className="btn btn-small btn-ghost" disabled={occupe} onClick={() => void faire(() => api.admin.retirerDeLaCampagne(a.id), 'Retirée de la campagne')}>
                Retirer
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

/** « 1,4 » : un chiffre après la virgule, à la française — et « 3 » quand il n'y en a pas. */
const dec = (x: number) => (Number.isInteger(x) ? formatNumber(x) : x.toFixed(1).replace('.', ','))
const pc = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`)
const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${formatNumber(n)} ${n > 1 ? motPluriel : mot}`

/** La chance d'un essai au seuil d'une règle : null tant que personne ne l'a tenté à ce seuil-là. */
export function parEssaiAuSeuil(p: StatsDuPalier, seuil: number): number | null {
  const x = p.seuils.find(c => c.seuil === seuil)
  return x && x.essais > 0 ? x.validees / x.essais : null
}

/**
 * Ce que la première ligne d'un palier dit de ceux qui l'ont tenté : combien
 * l'ont validé, et du premier coup, combien y restent bloqués et ce qu'ils y
 * ont laissé, puis ceux qui l'attendent sans l'avoir tenté. Celui qui échoue
 * garde sa place : « 0,0 vie perdue avant de valider » ne voyait que ceux
 * qui avaient validé (la remarque du propriétaire du 5 octobre 2026).
 */
export function progressionDuPalier(p: StatsDuPalier): string {
  const l = lectureDuPalier(p)
  const parties: string[] = []
  if (p.joueurs > 0) {
    parties.push(pluriel(p.joueurs, 'joueur'))
    if (p.valides === 0) parties.push('aucun ne l’a validé')
    else parties.push(`${formatNumber(p.valides)} l’${p.valides > 1 ? 'ont' : 'a'} validé${p.premierCoup > 0 ? `, ${formatNumber(p.premierCoup)} du premier coup` : ''}`)
    if (l.bloques > 0 && l.echecsParBloque !== null) {
      const echecs = l.echecsParBloque
      parties.push(`${pluriel(l.bloques, 'bloqué')} (${dec(echecs)} échec${echecs >= 2 ? 's' : ''}${l.bloques > 1 ? ' chacun' : ''})`)
    }
  }
  if (p.enAttente > 0) parties.push(`${formatNumber(p.enAttente)} l’attend${p.enAttente > 1 ? 'ent' : ''} sans l’avoir tenté`)
  return parties.length > 0 ? parties.join(' · ') : 'Aucune épreuve'
}

/**
 * Ce que la seconde ligne dit de l'effort : les essais et ce qu'il en faut
 * pour valider, la part de bonnes réponses — la difficulté sans le seuil —,
 * les abandons, la chance d'un essai aux seuils d'avant, et les rejeux à
 * part. Un palier repris des portraits d'avant, qu'un joueur joue pour la
 * première fois, est un rejeu : il ne paraissait nulle part.
 */
export function effortDuPalier(p: StatsDuPalier, seuilDuJour: number): string {
  const l = lectureDuPalier(p)
  const parties: string[] = []
  if (p.essais > 0) {
    parties.push(`${pluriel(p.essais, 'essai')}${l.essaisPourValider !== null ? `, ${dec(l.essaisPourValider)} pour valider` : ''}`)
    if (l.bonnesReponses !== null) parties.push(`${pc(l.bonnesReponses)} de bonnes réponses`)
    if (p.abandons > 0) parties.push(pluriel(p.abandons, 'abandon'))
    // Un seuil changé ne vaut que pour les épreuves d'après : les deux se lisent côte à côte.
    for (const x of p.seuils) {
      if (x.seuil !== seuilDuJour) parties.push(`à ${x.seuil}/${QUESTIONS_PAR_EPREUVE} : ${pc(x.validees / x.essais)} par essai (${pluriel(x.essais, 'essai')})`)
    }
  }
  if (p.rejeux === 1) parties.push(`1 rejeu, ${p.rejeuxValides === 1 ? 'validé' : 'raté'}`)
  else if (p.rejeux > 1) {
    const valides = p.rejeuxValides === 0 ? 'aucun validé' : `${formatNumber(p.rejeuxValides)} validé${p.rejeuxValides > 1 ? 's' : ''}`
    parties.push(`${formatNumber(p.rejeux)} rejeux, ${valides}`)
  }
  return parties.join(' · ')
}

/** Les marches, au pluriel : ce sont des questions. */
const MARCHES: Record<Niveau, string> = { facile: 'Faciles', moyen: 'Moyennes', difficile: 'Difficiles', expert: 'Expertes' }

/**
 * Les sentiers du savoir, palier par palier (`shared/sentiers.ts`), sur les
 * trois derniers mois, les rejeux à part : la chance d'un essai au seuil du
 * jour, qui l'a validé — du premier coup ou non —, qui y reste bloqué, ce
 * que les essais coûtent. Au-dessus, les bonnes réponses par marche, à côté
 * de ce que le calibrage suppose : une marche plus dure qu'annoncé fait un
 * mur que le calcul ne voyait pas. Dessous, les plus bloqués. Un palier
 * plus facile que celui d'avant se signale : c'est un mélange à revoir. Les
 * seuils et les mélanges se règlent dans le code, sur ces chiffres-là.
 */
function AdminSentiers() {
  const [branche, setBranche] = useState('')
  const [stats, setStats] = useState<AdminDesSentiers | null>(null)
  const [erreur, setErreur] = useState('')
  useEffect(() => {
    let vivant = true
    setErreur('')
    api.admin
      .sentiers(branche || undefined)
      .then(s => vivant && setStats(s))
      .catch(e => vivant && setErreur(motifDe(e)))
    return () => {
      vivant = false
    }
  }, [branche])
  return (
    <section className="admin-groupe" aria-labelledby="campagne-sentiers-titre">
      <h2 className="compte-groupe" id="campagne-sentiers-titre">
        Les sentiers
      </h2>
      {erreur && <p className="error">{erreur}</p>}
      {stats && (
        <>
          <div className="sentiers-admin-tuiles">
            <span>
              <b>{formatNumber(stats.semaine.joueurs)}</b>
              {stats.semaine.joueurs > 1 ? 'joueurs' : 'joueur'}
            </span>
            <span>
              <b>{formatNumber(stats.semaine.epreuves)}</b>
              {stats.semaine.epreuves > 1 ? 'épreuves' : 'épreuve'}
            </span>
            <span>
              <b>{formatNumber(stats.semaine.paliersValides)}</b>
              {stats.semaine.paliersValides > 1 ? 'paliers validés' : 'palier validé'}
            </span>
            <span>
              <b>{formatNumber(stats.semaine.viesPerdues)}</b>
              {stats.semaine.viesPerdues > 1 ? 'vies perdues' : 'vie perdue'}
            </span>
            <span>
              <b>{formatNumber(stats.semaine.viesAchetees)}</b>
              {stats.semaine.viesAchetees > 1 ? 'vies achetées' : 'vie achetée'}
            </span>
          </div>
          <p className="muted small">
            Ces sept derniers jours, rejeux compris pour les joueurs et les épreuves. Les paliers, eux, se lisent sur trois mois ; un joueur y compte une fois par sentier. Un rejeu
            — un palier déjà validé, ou repris des portraits d’avant — se compte à part : il ne coûte pas de vie.
          </p>
        </>
      )}
      <label className="row">
        <span className="muted small">Sentier</span>
        <select className="team-emoji-select" value={branche} onChange={e => setBranche(e.target.value)}>
          <option value="">Tous les sentiers</option>
          {BRANCHES.map(b => (
            <option key={b.key} value={b.key}>
              {`${b.nom} · ${b.categorie}`}
            </option>
          ))}
        </select>
      </label>
      {stats && (
        <>
          {/* Les bonnes réponses par marche de question, à côté de ce que le calibrage suppose. */}
          <div className="sentiers-admin-marches" aria-label="Bonnes réponses par marche de question">
            {NIVEAUX.map(niveau => {
              const x = stats.niveaux.find(c => c.niveau === niveau)
              return (
                <span key={niveau}>
                  <b className="num">{pc(x && x.questions > 0 ? x.justes / x.questions : null)}</b>
                  {MARCHES[niveau]}
                  <small>{`${pc(TAUX_DU_CALIBRAGE[niveau])} au calcul · ${pluriel(x?.questions ?? 0, 'réponse')}`}</small>
                </span>
              )
            })}
          </div>
          <p className="muted small">
            Les bonnes réponses en épreuve, hors rejeux, par marche de question — le calibrage des paliers suppose les chiffres « au calcul », ceux d’un joueur moyen. Elles
            se mesurent sur ceux qui y répondent : les difficiles ne tombent qu’à partir du huitième palier, devant des joueurs déjà forts. En face de chaque palier, la
            chance d’un essai au seuil du jour ; la barre :<span className="sentiers-admin-legende sentiers-admin-premier">validé du premier coup</span>{' '}
            <span className="sentiers-admin-legende sentiers-admin-ensuite">validé ensuite</span> <span className="sentiers-admin-legende sentiers-admin-bloque">bloqué</span>.
          </p>
          <ol className="sentiers-admin-paliers">
            {stats.paliers.map((p, i) => {
              const regle = PALIERS[p.palier - 1]
              const parEssai = parEssaiAuSeuil(p, regle.seuil)
              const essaisAuSeuil = p.seuils.find(c => c.seuil === regle.seuil)?.essais ?? 0
              const avant = i > 0 ? stats.paliers[i - 1] : null
              const parEssaiAvant = avant ? parEssaiAuSeuil(avant, PALIERS[avant.palier - 1].seuil) : null
              const essaisAvant = avant?.seuils.find(c => c.seuil === PALIERS[avant.palier - 1].seuil)?.essais ?? 0
              // Plus facile que le palier d'avant, sur assez d'essais pour le croire : à revoir.
              const remonte = !regle.maitre && parEssai !== null && parEssaiAvant !== null && essaisAuSeuil >= 10 && essaisAvant >= 10 && parEssai > parEssaiAvant
              const l = lectureDuPalier(p)
              const largeur = (n: number) => `${p.joueurs > 0 ? (n / p.joueurs) * 100 : 0}%`
              const effort = effortDuPalier(p, regle.seuil)
              return (
                <li key={p.palier} className={'sentiers-admin-ligne' + (remonte ? ' sentiers-admin-alerte' : '') + (regle.maitre ? ' sentiers-admin-maitre' : '')}>
                  <b>{regle.maitre ? 'Maître' : `P${p.palier}`}</b>
                  <span className="muted">{`${texteDuMelangeCourt(regle.melange)} · ${regle.seuil}/${QUESTIONS_PAR_EPREUVE}`}</span>
                  <span className="sentiers-admin-chance">
                    <b className="num">{pc(parEssai)}</b>
                    <small>par essai</small>
                  </span>
                  <span className="sentiers-admin-barre" aria-hidden="true">
                    <i className="sentiers-admin-premier" style={{ width: largeur(p.premierCoup) }} />
                    <i className="sentiers-admin-ensuite" style={{ width: largeur(p.valides - p.premierCoup) }} />
                    <i className="sentiers-admin-bloque" style={{ width: largeur(l.bloques) }} />
                  </span>
                  <span className="small sentiers-admin-infos">
                    {progressionDuPalier(p)}
                    {remonte && <span className="sentiers-admin-puce">{`plus facile que P${p.palier - 1}`}</span>}
                  </span>
                  {effort && <span className="muted small sentiers-admin-effort">{effort}</span>}
                </li>
              )
            })}
          </ol>
          <h3 className="sentiers-admin-sous-titre">Les plus bloqués</h3>
          {stats.bloques.length === 0 ? (
            <p className="muted small">Personne n’a encore raté deux fois le palier qui l’attend.</p>
          ) : (
            <>
              <p className="muted small">Ceux qui ont le plus d’échecs sur le palier qui les attend, abandons compris — le maître à part, il est facultatif.</p>
              <ul className="sentiers-admin-bloques">
                {stats.bloques.map(x => {
                  const b = BRANCHES.find(c => c.key === x.branche)
                  return (
                    <li key={`${x.profileId}|${x.branche}`}>
                      <b>{x.prenom ?? 'Profil supprimé'}</b>
                      <span className="muted">{`${b?.nom ?? x.branche} · P${x.palier} · ${pluriel(x.echecs, 'échec')} · dernier échec ${quand(x.dernier)}`}</span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  )
}
