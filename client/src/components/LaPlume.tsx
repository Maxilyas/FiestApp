import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Feuille } from './Pieces'
import { Icon } from './Icon'
import { Shape } from './Shape'
import { Avatar, type AvatarAPlat } from './Avatar'
import { espacesFines } from '../format'
import { showToast } from '../state'
import { sonAvatar } from '../../../shared/sonAvatar'
import type { PublicProfile } from '../../../shared/profil'

// La plume : l'invitation à proposer une question, là où l'on joue.
//
// Beaucoup ne jouent qu'au quiz du jour et au défi de la semaine : une
// invitation rangée en fin de série de campagne ne les touchait jamais (la
// remarque du propriétaire du 2 novembre 2026). Elle vient donc à eux, au
// moment où l'on est fier — le résultat du jour, la fin du défi — et là où
// une question de joueur se signe. Sans prendre de place : pas de carte de
// plus, une ligne au pied d'une carte qui existe déjà. Ce qui attire l'œil,
// c'est le geste, une fois : la plume se trace à l'arrivée, puis l'encre
// souligne ce qu'elle propose — le mouvement au bon moment, et rien si le
// système en demande moins (`styles.css`, « La plume »).

/**
 * Les bonnes réponses qui valent l'invitation, au quiz du jour comme au
 * défi : après un beau résultat, « écris la tienne » se lit comme un
 * compliment ; après un mauvais, comme une leçon. Un choix de produit.
 */
export const JUSTES_POUR_LA_PLUME = 7

/**
 * Au trait des icônes de l'application : une plume. Chaque tracé a la
 * longueur 1 (`pathLength`) : la feuille de style les dessine du même pas,
 * quelle que soit leur longueur réelle.
 */
export function IconePlume() {
  return (
    <svg className="icon plume-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path pathLength={1} d="M20.5 3.5c-5.4.1-9.7 2.4-11.9 7.2-.9 2-1.3 4.1-1.3 5.8 1.7 0 3.8-.4 5.8-1.3 4.8-2.2 7.3-6.4 7.4-11.7Z" />
      <path pathLength={1} d="M4 20 15 9" />
      <path pathLength={1} d="M10.5 13.5h4.3M13 11h4" />
    </svg>
  )
}

/**
 * La ligne : la plume, une accroche, et ce qu'elle propose, souligné à
 * l'encre — tout le reste de la page reste à sa place. Un bouton : elle
 * ouvre la carte où l'on écrit sa question.
 */
export function LaPlume({ accroche, appel, profil }: { accroche: string; appel: string; profil?: PublicProfile | null }) {
  const [ouverte, setOuverte] = useState(false)
  return (
    <>
      <button type="button" className="plume" aria-haspopup="dialog" onClick={() => setOuverte(true)}>
        <IconePlume />
        <span className="plume-texte">
          {espacesFines(accroche)} <span className="plume-appel">{espacesFines(appel)}</span>
        </span>
        <Icon name="chevron-right" className="plume-chevron" />
      </button>
      {ouverte && <FeuilleDeLaPlume profil={profil} onFermer={() => setOuverte(false)} />}
    </>
  )
}

/**
 * La signature d'une question de joueur, au pied de son anecdote : qui l'a
 * écrite, et de quoi écrire la sienne — l'invitation la plus parlante est
 * une question d'un autre joueur, qu'on vient de jouer.
 */
export function SignatureDuPublic({ auteur, profil }: { auteur: AvatarAPlat & { nom: string }; profil?: PublicProfile | null }) {
  const [ouverte, setOuverte] = useState(false)
  return (
    <span className="plume-signature">
      {/* Son visage, tel qu'il le porte : la question d'une personne, pas d'un pseudonyme. */}
      <span className="plume-de">
        <Avatar avatar={auteur.avatar} finition={auteur.finition} eclat={auteur.eclat} legendaire={auteur.legendaire} />
        {/* « La question de Camille », à côté de son visage, passait sur deux lignes : la pastille du haut dit déjà d'où elle vient. */}
        {espacesFines(`Signée ${auteur.nom}`)}
      </span>
      <button type="button" className="plume-ecrire" aria-haspopup="dialog" onClick={() => setOuverte(true)}>
        <IconePlume />
        Écris la tienne
      </button>
      {ouverte && <FeuilleDeLaPlume profil={profil} onFermer={() => setOuverte(false)} />}
    </span>
  )
}

/**
 * La feuille part au bout du document : posée là où vit la ligne — dans le
 * bandeau du résultat, qui s'anime d'un `transform` —, son voile fixe se
 * serait tenu dans le bandeau, et son texte, centré comme lui.
 */
function FeuilleDeLaPlume({ profil, onFermer }: { profil?: PublicProfile | null; onFermer: () => void }) {
  return createPortal(<CarteAEcrire profil={profil} onFermer={onFermer} />, document.body)
}

/** Une question tient sur l'écran d'un téléphone ; une réponse, sur un bouton. */
const QUESTION_MAX = 200
const REPONSE_MAX = 60

/** Sans article ni casse : « La Loire » et « loire » sont la même réponse. */
const sansArticle = (x: string) => x.trim().toLowerCase().replace(/^(les |le |la |l’|l')/, '')

/**
 * Ce qui manque encore, en une phrase — la première qui compte —, ou rien :
 * la carte se lit d'abord, le conseil ne dit que le prochain geste.
 */
function conseilDeLaCarte(question: string, reponses: string[], bonne: number | null): string | null {
  const t = question.trim()
  const reps = reponses.map(r => r.trim())
  const manquent = reps.filter(r => !r).length
  if (!t) return 'Écris ta question, puis ses quatre réponses.'
  if (t.length < 15) return 'Un peu courte : précise-la.'
  if (!t.endsWith('?')) return 'Finis-la par un point d’interrogation.'
  if (/\p{Extended_Pictographic}/u.test(t + reps.join(''))) return 'Sans emoji : certains écrans ne l’affichent pas.'
  if (manquent === 4) return 'À toi : ses quatre réponses.'
  if (manquent > 0) return manquent === 1 ? 'Encore une réponse.' : `Encore ${manquent} réponses.`
  if (new Set(reps.map(sansArticle)).size < reps.length) return 'Deux réponses sont pareilles.'
  if (bonne === null) return 'Touche une forme : c’est la bonne réponse.'
  const juste = sansArticle(reps[bonne])
  if (juste.length >= 3 && t.toLowerCase().includes(juste)) return 'Ta réponse se lit dans la question.'
  return null
}

/**
 * On écrit sa question dans la carte même du jeu : sa place de question en
 * serif, ses quatre réponses aux formes et aux couleurs du quiz, et la
 * forme qu'on touche porte la coche de la bonne. Dessous, sa signature,
 * telle que la salle la lira. Ce qu'on voit est ce que les autres joueront ;
 * le conseil ne dit qu'une chose, le prochain geste (le retour du
 * propriétaire du 2 novembre 2026 : « trop de texte, pas assez vivant »).
 */
function CarteAEcrire({ profil, onFermer }: { profil?: PublicProfile | null; onFermer: () => void }) {
  const [question, setQuestion] = useState('')
  const [reponses, setReponses] = useState(['', '', '', ''])
  const [bonne, setBonne] = useState<number | null>(null)
  const conseil = conseilDeLaCarte(question, reponses, bonne)
  const prete = conseil === null
  return (
    <Feuille
      titre="Ta question"
      onFermer={onFermer}
      className="plume-feuille"
      pied={
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={!prete}
          onClick={() => {
            // La relecture n'est pas encore branchée : la maquette s'arrête là.
            showToast({ kind: 'info', message: 'Bientôt : l’envoi en relecture' })
            onFermer()
          }}
        >
          <IconePlume />
          Envoyer en relecture
        </button>
      }
    >
      <div className={'plume-carte' + (prete ? ' plume-carte-prete' : '')}>
        <span className="pill plume-du-public">Question du public</span>
        <textarea
          className="plume-carte-question"
          rows={3}
          maxLength={QUESTION_MAX}
          value={question}
          placeholder="Écris ta question…"
          aria-label="Ta question"
          onChange={e => setQuestion(e.target.value)}
        />
        <div className="ans-grid plume-carte-reponses">
          {reponses.map((r, i) => (
            <div key={i} className={'ans-btn plume-carte-reponse' + (bonne === i ? ' chosen' : '')}>
              <button type="button" className="plume-carte-forme" aria-pressed={bonne === i} aria-label={`La réponse ${i + 1} est la bonne`} onClick={() => setBonne(i)}>
                <Shape index={i} />
                {bonne === i && (
                  <span className="plume-carte-coche" aria-hidden="true">
                    <Icon name="check" />
                  </span>
                )}
              </button>
              <input
                className="plume-carte-champ"
                value={r}
                maxLength={REPONSE_MAX}
                placeholder={bonne === i ? 'La bonne' : 'Réponse'}
                aria-label={`Réponse ${i + 1}`}
                onChange={e => setReponses(rs => rs.map((x, j) => (j === i ? e.target.value : x)))}
              />
            </div>
          ))}
        </div>
        {profil && (
          <p className="plume-carte-signature">
            <Avatar {...sonAvatar(profil)} finition={profil.finition} />
            {espacesFines(`Signée ${profil.name}`)}
          </p>
        )}
      </div>
      <p className={'plume-conseil' + (prete ? ' plume-conseil-prete' : '')} aria-live="polite">
        <Icon name={prete ? 'check-circle' : 'edit'} />
        {/* Une ligne : sur deux, son dernier mot restait seul au milieu. */}
        {espacesFines(conseil ?? 'Prête : elle part en relecture.')}
      </p>
    </Feuille>
  )
}
