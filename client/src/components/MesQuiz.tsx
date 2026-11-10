import type { CSSProperties } from 'react'
import { Icon, type IconName } from './Icon'
import { Sortie } from './Pieces'
import { espacesFines, jour, quand } from '../format'
import { ecrireDuree, type QuizSummary } from '../../../shared/library'
import { BRANCHES } from '../../../shared/branches'
import { LUEUR } from './Atlas'

// « Mes quiz » au pouce : la liste ne montre que des lignes — l'emoji du
// quiz, son nom, une ligne de faits, et ▶ pour le lancer. Chaque quiz a sa
// fiche, où vivent les gestes rares. Ils attendaient sous un « ⋯ » par
// ligne : un menu flottant qui s'ouvrait sous le pli au téléphone, et
// « Supprimer » à un toucher de « Modifier ».
//
// En lignes depuis le 10 novembre 2026 (le propriétaire : « revoir l'onglet
// quiz […] modifier la disposition et l'aspect si tu trouves cela
// nécessaire ») : des cartes de 68 à 128 px — un nom sur trois lignes, les
// faits sur deux, « à compléter » sur la sienne — n'en montraient que trois
// sur dix en 360 × 640. Chaque quiz tient sur deux lignes de texte, dans une
// seule carte, un filet entre eux, comme les gros boutons de l'accueil.

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

/** Un morceau de la ligne de faits d'un quiz : ce qu'il dit, et s'il alerte. */
export interface FaitDuQuiz {
  texte: string
  /** Ce qui attend l'animateur — un brouillon, des questions à compléter : à la couleur de l'alerte, son icône devant. */
  alerte?: IconName
  /** Ce que la recherche a trouvé : en italique, comme une citation. */
  trouve?: boolean
}

/**
 * Ce que la ligne d'un quiz dit sous son nom, morceau par morceau, du plus
 * pressant au plus accessoire : ce que la recherche y a trouvé — c'est ce
 * qu'on cherche —, ce qui attend dans ce navigateur, ce qui reste à compléter,
 * puis ses faits. La feuille n'en montre que les morceaux qui tiennent
 * entiers sur une ligne (`.quiz-carte-faits`), comme la ligne d'un gros
 * bouton de l'accueil : en 360 de large, « 10 questions · ≈ 5 min · jamais
 * joué » tient, et derrière une alerte, « jamais joué » se tait plutôt que de
 * passer dessous. Chaque morceau porte sa ponctuation : mis bout à bout, la
 * phrase d'avant — la fiche du quiz redit tout.
 */
export function faitsDuQuiz(q: QuizSummary, brouillon: boolean): FaitDuQuiz[] {
  const manque = manqueDe(q)
  const faits: FaitDuQuiz[] = []
  if (q.trouve) faits.push({ texte: `Trouvé dans « ${q.trouve} »`, trouve: true })
  if (brouillon) faits.push({ texte: 'Des modifications attendent', alerte: 'edit' }, { texte: ' dans ce navigateur', alerte: 'edit' })
  if (manque > 0) faits.push({ texte: `${manque} à compléter`, alerte: 'alert' })
  // « 10 à compléter » dit déjà qu'aucune n'est prête : « 0 question » derrière lui ne disait rien de plus.
  if (!(manque > 0 && q.readyCount === 0)) faits.push({ texte: q.questionCount === 0 ? 'Aucune question encore' : `${q.readyCount} question${q.readyCount > 1 ? 's' : ''}` })
  if ((q.dureeS ?? 0) > 0) faits.push({ texte: ecrireDuree(q.dureeS!) })
  // Pour ne pas reposer le même quiz aux mêmes amis sans s'en souvenir.
  if (q.joue) faits.push({ texte: `joué ${q.joue.fois} fois` })
  else if (q.readyCount > 0) faits.push({ texte: 'jamais joué' })
  if (q.archivedAt) faits.push({ texte: 'Archivé' })
  return faits
}

/** Une ligne de la liste : elle ouvre sa fiche ; ▶ lance le quiz. */
export function CarteDeQuiz({ quiz: q, brouillon, onFiche }: { quiz: QuizSummary; brouillon: boolean; onFiche: () => void }) {
  const { nom } = separerTitre(q.title)
  const faits = faitsDuQuiz(q, brouillon)
  return (
    <li className={'quiz-carte' + (q.archivedAt ? ' is-archive' : '')}>
      {/* Le libellé commence par le mot affiché, qu'une commande vocale reconnaît. */}
      <button type="button" className="quiz-carte-ouvrir" aria-label={`${q.title} : ouvrir sa fiche`} onClick={onFiche}>
        <Pastille q={q} />
        <span className="quiz-carte-texte">
          <b>{espacesFines(nom)}</b>
          <span className="quiz-carte-faits">
            {faits.map((f, i) => {
              // La suite d'une alerte (« dans ce navigateur ») s'y colle sans point ; tout autre morceau se sépare du précédent.
              const colle = i > 0 && f.texte.startsWith(' ')
              return (
                <span key={i} className={'quiz-fait' + (f.alerte ? ' warn' : '') + (f.trouve ? ' quiz-carte-trouve' : '')}>
                  {i > 0 && !colle && ' · '}
                  {f.alerte && !colle && <Icon name={f.alerte} />}
                  {espacesFines(f.texte)}
                </span>
              )
            })}
          </span>
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
        {/* Ce qu'il fait, d'une ligne : sur le petit téléphone, son nom seul — la feuille le cache à l'œil, pas à l'oreille. */}
        <span className="muted small fiche-geste-detail">{detail}</span>
      </span>
    </button>
  )
}

/**
 * La fiche d'un quiz : ce qu'il contient, « Lancer » et « Modifier » en
 * grand, puis les gestes plus rares en liste calme — le danger tout en bas,
 * seul.
 *
 * Sur un téléphone, elle tient sur un écran (le 10 novembre 2026 : elle
 * défilait de 448 px en 360 × 640, « Supprimer » à 371 px sous le menu) : son
 * emblème passe à côté de son nom au lieu de le coiffer, ses deux gestes et
 * ses lignes se resserrent, et sur le plus petit écran chaque geste rare ne
 * garde que son nom. Rien n'y change de place ni de nom ; un grand écran
 * garde la fiche d'avant (`styles.css`, « Mes quiz »).
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
        <p className="muted quiz-heros-contenu">{q.questionCount === 0 ? 'Aucune question encore' : contenu.join(' · ')}</p>
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
          {/* Son verbe, puis « les questions » : à côté de « Lancer », sur un petit écran, la feuille ne montre que le verbe. */}
          <span>
            {q.questionCount === 0 ? 'Écrire' : manque > 0 ? 'Compléter' : 'Modifier'}
            <span className="fiche-suite"> les questions</span>
          </span>
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
