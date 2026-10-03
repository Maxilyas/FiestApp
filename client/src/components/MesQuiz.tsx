import type { CSSProperties } from 'react'
import { Icon, type IconName } from './Icon'
import { Sortie } from './Pieces'
import { espacesFines, jour, quand } from '../format'
import { ecrireDuree, type QuizSummary } from '../../../shared/library'
import { BRANCHES } from '../../../shared/branches'
import { LUEUR } from './Atlas'

// « Mes quiz » au pouce : la liste ne montre que des cartes — l'emoji du
// quiz, son nom, une ligne de faits, et ▶ pour le lancer. Chaque quiz a sa
// fiche, où vivent les gestes rares. Ils attendaient sous un « ⋯ » par
// ligne : un menu flottant qui s'ouvrait sous le pli au téléphone, et
// « Supprimer » à un toucher de « Modifier ».

const lueurDe = (q: QuizSummary): CSSProperties => {
  const b = BRANCHES.find(x => x.categorie === q.categories?.[0])
  return { '--lueur': b ? LUEUR[b.key] : 'var(--accent)' } as CSSProperties
}

/**
 * « 🎬 Ciné des années 90 » : son emoji, et son nom sans lui. Un titre sans
 * emoji prend son initiale — un « ❓ » partout aurait fait une liste de
 * points d'interrogation.
 */
export function separerTitre(titre: string): { emoji: string | null; nom: string } {
  const m = titre.match(/^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*(.*)$/u)
  return m && m[2] ? { emoji: m[1], nom: m[2] } : { emoji: null, nom: titre }
}

const manqueDe = (q: QuizSummary) => q.questionCount - q.readyCount - (q.deCote ?? 0)

/** Il se lance : des questions prêtes, et pas à l'écart. */
export const seLance = (q: QuizSummary) => q.readyCount > 0 && !q.archivedAt

/** « Lancer » ouvre un salon sur ce quiz : la soirée se prépare là, pas ici. */
export const adresseDuLancement = (q: QuizSummary) => `/salon?quiz=${encodeURIComponent(q.id)}`

function Pastille({ q }: { q: QuizSummary }) {
  const { emoji, nom } = separerTitre(q.title)
  return (
    <span className="quiz-pastille" style={lueurDe(q)} aria-hidden="true">
      {emoji ?? Array.from(nom.trim())[0]?.toUpperCase() ?? '?'}
    </span>
  )
}

/** Une carte de la liste : elle ouvre sa fiche ; ▶ lance le quiz. */
export function CarteDeQuiz({ quiz: q, brouillon, onFiche }: { quiz: QuizSummary; brouillon: boolean; onFiche: () => void }) {
  const { nom } = separerTitre(q.title)
  const manque = manqueDe(q)
  const faits = [
    q.questionCount === 0 ? 'Aucune question encore' : `${q.readyCount} question${q.readyCount > 1 ? 's' : ''}`,
    (q.dureeS ?? 0) > 0 && ecrireDuree(q.dureeS!),
    // Pour ne pas reposer le même quiz aux mêmes amis sans s'en souvenir.
    q.joue ? `joué ${q.joue.fois} fois` : q.readyCount > 0 && 'jamais joué',
  ].filter(Boolean)
  return (
    <li className={'quiz-carte' + (q.archivedAt ? ' is-archive' : '')}>
      {/* Le libellé commence par le mot affiché, qu'une commande vocale reconnaît. */}
      <button type="button" className="quiz-carte-ouvrir" aria-label={`${q.title} : ouvrir sa fiche`} onClick={onFiche}>
        <Pastille q={q} />
        <span className="quiz-carte-texte">
          <b>{espacesFines(nom)}</b>
          <span className="quiz-carte-faits">{faits.join(' · ')}</span>
          {manque > 0 && (
            <span className="warn small">
              <Icon name="alert" /> {manque} à compléter
            </span>
          )}
          {q.trouve && <span className="quiz-carte-faits quiz-carte-trouve">{espacesFines(`Trouvé dans « ${q.trouve} »`)}</span>}
          {brouillon && (
            <span className="warn small">
              <Icon name="edit" /> Des modifications attendent dans ce navigateur
            </span>
          )}
          {q.archivedAt && <span className="quiz-carte-faits">Archivé</span>}
        </span>
      </button>
      {seLance(q) && (
        <a className="quiz-carte-lancer" href={adresseDuLancement(q)} aria-label={`Lancer « ${q.title} »`}>
          <Icon name="play" />
        </a>
      )}
    </li>
  )
}

/** Une ligne des gestes rares de la fiche : une icône, ce qu'elle fait, et pour quoi. */
function Geste({ icone, titre, detail, onClick, disabled }: { icone: IconName; titre: string; detail: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="fiche-geste" disabled={disabled} onClick={onClick}>
      <Icon name={icone} />
      <span>
        <b>{titre}</b>
        <span className="muted small">{detail}</span>
      </span>
    </button>
  )
}

/**
 * La fiche d'un quiz : ce qu'il contient, « Lancer » et « Modifier » en
 * grand, puis les gestes plus rares en liste calme — le danger tout en bas,
 * seul.
 */
export function FicheDeQuiz({
  quiz: q,
  brouillon,
  occupe,
  exportEnCours,
  onFermer,
  onModifier,
  onDupliquer,
  onPartager,
  onExporter,
  onProposer,
  onArchiver,
  onSupprimer,
}: {
  quiz: QuizSummary
  brouillon: boolean
  occupe: boolean
  exportEnCours: boolean
  onFermer: () => void
  onModifier: () => void
  onDupliquer: () => void
  onPartager: () => void
  onExporter: () => void
  onProposer: () => void
  onArchiver: () => void
  onSupprimer: () => void
}) {
  const { nom } = separerTitre(q.title)
  const manque = manqueDe(q)
  const contenu = [
    `${q.readyCount} question${q.readyCount > 1 ? 's' : ''} prête${q.readyCount > 1 ? 's' : ''}`,
    (q.dureeS ?? 0) > 0 && ecrireDuree(q.dureeS!),
    (q.photos ?? 0) > 0 && `${q.photos} photo${q.photos! > 1 ? 's' : ''}`,
    (q.estimations ?? 0) > 0 && `${q.estimations} estimation${q.estimations! > 1 ? 's' : ''}`,
  ].filter(Boolean)
  return (
    <section className="quiz-fiche" style={lueurDe(q)} aria-labelledby="fiche-titre">
      {/* « ← Mes quiz », comme la sortie de toute page qui n'est pas une pièce du menu. */}
      <Sortie vers="Mes quiz" href="/edit" onClick={onFermer} />
      <div className="quiz-heros">
        <Pastille q={q} />
        <h1 id="fiche-titre">{espacesFines(nom)}</h1>
        <p className="muted">{q.questionCount === 0 ? 'Aucune question encore' : contenu.join(' · ')}</p>
        {(q.categories?.length ?? 0) > 0 && (
          <ul className="quiz-categories" aria-label="Catégories">
            {q.categories!.map(c => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
        <p className="muted small">
          {q.joue ? (q.joue.fois > 1 ? `Joué ${q.joue.fois} fois, la dernière ${jour(q.joue.dernier)}` : `Joué ${jour(q.joue.dernier)}`) : 'Jamais joué'} · modifié{' '}
          {quand(q.updatedAt)}
        </p>
        {manque > 0 && (
          <p className="warn small">
            <Icon name="alert" /> {manque} question{manque > 1 ? 's' : ''} à compléter
          </p>
        )}
        {brouillon && (
          <p className="warn small">
            <Icon name="edit" /> Des modifications non enregistrées t’attendent dans ce navigateur
          </p>
        )}
      </div>

      <div className="quiz-fiche-gestes">
        {seLance(q) && (
          <a className="btn btn-primary btn-big btn-block" href={adresseDuLancement(q)}>
            <Icon name="play" />
            Lancer
          </a>
        )}
        <button type="button" className="btn btn-big btn-block" onClick={onModifier}>
          <Icon name="edit" />
          {q.questionCount === 0 ? 'Écrire les questions' : manque > 0 ? 'Compléter les questions' : 'Modifier les questions'}
        </button>
      </div>

      <div className="card fiche-plus">
        <span className="label">Plus</span>
        <Geste icone="copy" titre="Dupliquer" detail="Une copie, pour une variante" onClick={onDupliquer} />
        <Geste icone="share" titre="Partager par un code" detail="Un ami de ce serveur en reçoit une copie" disabled={q.questionCount === 0} onClick={onPartager} />
        <Geste
          icone="download"
          titre={exportEnCours ? 'Export…' : 'Exporter en fichier'}
          detail="Pour un ami d’un autre serveur : les questions et leurs photos"
          disabled={occupe}
          onClick={onExporter}
        />
        <Geste icone="globe" titre="Proposer au catalogue" detail="Pour que tous les animateurs puissent le jouer" disabled={q.readyCount === 0} onClick={onProposer} />
        <Geste
          icone="archive"
          titre={q.archivedAt ? 'Ressortir de l’archive' : 'Archiver'}
          detail={q.archivedAt ? 'Il revient dans ta liste' : 'Il quitte ta liste, sans rien perdre'}
          onClick={onArchiver}
        />
      </div>
      <button type="button" className="btn btn-ghost btn-block fiche-supprimer" aria-label={`Supprimer ce quiz : « ${q.title} »`} onClick={onSupprimer}>
        <Icon name="trash" />
        Supprimer ce quiz
      </button>
    </section>
  )
}
