import { useState } from 'react'
import { Icon, type IconName } from './Icon'
import { espacesFines } from '../format'
import { formatNumber } from '../../../shared/typographie'
import { phraseDuMerci, type AnnonceDeLAdministrateur } from '../../../shared/profil'
import { MOT_MAX, NOTE_MAX, type QuestionDAnnonce } from '../../../shared/annonces'
import { motifDe } from '../api'

const ICONE: Record<AnnonceDeLAdministrateur['sorte'], IconName> = {
  confettis: 'sparkles',
  merci: 'heart',
  prenom: 'edit',
  annonce: 'megaphone',
}

const nConfettis = (n: number) => `+${formatNumber(n)} confetti${n > 1 ? 's' : ''}`

/**
 * La question d'une annonce (`shared/annonces.ts`), sous son message : des boutons
 * pour un vote, cinq notes, ou un champ pour quelques mots. Une réponse, une
 * seule : la carte la remplace par un merci, avec les confettis qu'elle rapporte.
 * Sans `onRepondre`, l'aperçu du QG : rien ne se touche.
 */
function QuestionDeLaCarte({
  question,
  merci,
  onMerci,
  onRepondre,
}: {
  question: QuestionDAnnonce
  /** Les confettis de la réponse donnée, null tant qu'il n'a pas répondu : la carte en change son bouton. */
  merci: number | null
  onMerci: (confettis: number) => void
  onRepondre?: (reponse: number | string) => Promise<number>
}) {
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')
  const [mot, setMot] = useState('')
  const apercu = !onRepondre

  const repondre = async (reponse: number | string) => {
    if (!onRepondre || occupe) return
    setOccupe(true)
    setErreur('')
    try {
      onMerci(await onRepondre(reponse))
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setOccupe(false)
    }
  }

  if (merci !== null) {
    return (
      <span className="annonce-question-merci" role="status">
        {espacesFines(merci > 0 ? `Merci pour ta réponse ! ${nConfettis(merci)}` : 'Merci pour ta réponse !')}
      </span>
    )
  }
  const prix = question.recompense > 0 ? <span className="muted small">{espacesFines(`${nConfettis(question.recompense)} pour ta réponse`)}</span> : null
  return (
    <>
      {question.sorte === 'vote' && (
        <span className="annonce-choix" role="group" aria-label="Ton choix">
          {question.choix.map((c, i) => (
            <button key={i} type="button" className="annonce-choix-bouton" disabled={apercu ? undefined : occupe} tabIndex={apercu ? -1 : undefined} onClick={() => void repondre(i)}>
              {espacesFines(c)}
            </button>
          ))}
        </span>
      )}
      {question.sorte === 'note' && (
        <span className="annonce-notes" role="group" aria-label={`Ta note, de 1 à ${NOTE_MAX}`}>
          {Array.from({ length: NOTE_MAX }, (_, i) => (
            <button key={i} type="button" className="annonce-choix-bouton annonce-note" aria-label={`${i + 1} sur ${NOTE_MAX}`} disabled={apercu ? undefined : occupe} tabIndex={apercu ? -1 : undefined} onClick={() => void repondre(i + 1)}>
              {i + 1}
            </button>
          ))}
        </span>
      )}
      {question.sorte === 'mot' && (
        <span className="annonce-mot">
          <textarea
            className="input"
            rows={2}
            maxLength={MOT_MAX}
            value={mot}
            aria-label="Ta réponse"
            placeholder="Ta réponse"
            readOnly={apercu}
            tabIndex={apercu ? -1 : undefined}
            onChange={e => setMot(e.target.value)}
          />
          <button type="button" className="annonce-choix-bouton" disabled={apercu ? undefined : occupe || !mot.trim()} tabIndex={apercu ? -1 : undefined} onClick={() => void repondre(mot)}>
            Envoyer
          </button>
        </span>
      )}
      {prix}
      {erreur && (
        <span className="error small" role="alert">
          {erreur}
        </span>
      )}
    </>
  )
}

/**
 * Une carte de ce que l'administrateur dit au joueur, en tête de son accueil
 * (`AnnoncesDeLAdministrateur`) — et la même à l'aperçu du QG, qui montre une
 * annonce telle que les joueurs la liront (`QgAnnonces`). Le bouton la range :
 * « Merci » sous un cadeau, « Avec plaisir » sous un merci, « Compris » sous
 * une annonce qui n'offre rien — un « Merci » y remerciait d'une maintenance.
 * Sans `onRanger`, l'aperçu : le bouton n'est qu'une image, rien ne s'y arrête
 * au clavier. Un merci et une annonce, plus longs, posent leur bouton sous
 * leur texte : à côté, au téléphone, il laissait au message trois mots par
 * ligne, sur sept lignes.
 */
export function CarteDeLAdministrateur({
  annonce: a,
  prenom,
  onRanger,
  onRepondre,
}: {
  annonce: AnnonceDeLAdministrateur
  prenom: string
  onRanger?: () => void
  /** Sa réponse à la question de l'annonce, s'il y en a une : rend les confettis qu'elle rapporte. Sans elle, l'aperçu. */
  onRepondre?: (reponse: number | string) => Promise<number>
}) {
  const [merci, setMerci] = useState<number | null>(null)
  // Une question qui attend sa réponse se range en « Plus tard » : elle reviendra à la prochaine visite.
  const libelle = a.sorte === 'merci' ? 'Avec plaisir' : a.sorte === 'annonce' && a.question && merci === null ? 'Plus tard' : a.sorte === 'annonce' && a.confettis === 0 ? 'Compris' : 'Merci'
  return (
    <li className={'annonce-admin' + (a.sorte === 'merci' || a.sorte === 'annonce' ? ' annonce-admin-pile' : '')}>
      <span className="annonce-admin-icone" aria-hidden="true">
        <Icon name={ICONE[a.sorte]} />
      </span>
      <span className="annonce-admin-texte">
        {a.sorte === 'confettis' ? (
          <>
            <b>{nConfettis(a.confettis)}</b>
            {a.mot && <span>{espacesFines(`« ${a.mot} »`)}</span>}
            <span className="muted small">— de l’administrateur</span>
          </>
        ) : a.sorte === 'merci' ? (
          <>
            <b>{espacesFines(`Merci, ${prenom} !`)}</b>
            <span>{espacesFines(phraseDuMerci(a))}</span>
            <span className="muted small">— de l’administrateur</span>
          </>
        ) : a.sorte === 'annonce' ? (
          <>
            {/* Ce qu'elle lui a offert à lui : rien s'il n'était pas là pour le recevoir. */}
            <b>{a.confettis > 0 ? `${nConfettis(a.confettis)}, à tous les joueurs` : 'À tous les joueurs'}</b>
            <span>{espacesFines(a.message)}</span>
            {a.question && <QuestionDeLaCarte question={a.question} merci={merci} onMerci={setMerci} onRepondre={onRepondre} />}
            <span className="muted small">— de l’administrateur</span>
          </>
        ) : (
          <>
            <b>Ton prénom a changé</b>
            <span>{espacesFines(`L’administrateur l’a changé en « ${a.nom} ».`)}</span>
          </>
        )}
      </span>
      {onRanger ? (
        <button type="button" className="annonce-admin-merci" onClick={onRanger}>
          {libelle}
        </button>
      ) : (
        <span className="annonce-admin-merci" aria-hidden="true">
          {libelle}
        </span>
      )}
    </li>
  )
}
