import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Feuille } from './Pieces'
import { Icon } from './Icon'
import { Shape } from './Shape'
import { Avatar, type AvatarAPlat } from './Avatar'
import { espacesFines } from '../format'
import { showToast } from '../state'
import { api, motifDe } from '../api'
import { sonAvatar } from '../../../shared/sonAvatar'
import { QUESTION_DU_PUBLIC_MAX, REPONSE_DU_PUBLIC_MAX, conseilDeLaProposition, type PropositionDuJoueur, type StatutDUneProposition } from '../../../shared/propositions'
import type { PublicProfile } from '../../../shared/profil'

// La plume : l'invitation à proposer une question, là où l'on joue.
//
// Beaucoup ne jouent qu'au quiz du jour et au défi de la semaine : une
// invitation rangée en fin de série de campagne ne les touchait jamais (la
// remarque du propriétaire du 2 novembre 2026). Elle vient donc à eux, au
// moment où l'on est fier — le résultat du jour, la fin du défi —, là où
// une question de joueur se signe, et sur le jour joué, qu'on retrouve en
// revenant : la fin ne se voit qu'une fois. Sans prendre de place : pas de carte de
// plus, une ligne au pied d'une carte qui existe déjà. Ce qui attire l'œil,
// c'est le geste, une fois : la plume se trace à l'arrivée, puis l'encre
// souligne ce qu'elle propose — le mouvement au bon moment, et rien si le
// système en demande moins (`styles.css`, « La plume »).

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

/** Où en est chacune de ses questions, en un mot sur sa pastille. */
const STATUT: Record<StatutDUneProposition, string> = {
  'en-relecture': 'En relecture',
  acceptee: 'Acceptée',
  refusee: 'Pas retenue',
  posee: 'Jouée',
}

/**
 * Ses questions déjà proposées, sous la carte : une ligne chacune, sa
 * pastille d'abord — on sait d'un coup d'œil où elles en sont, sans une page
 * de plus. Le refus dit son motif dessous ; rien sans question proposée.
 */
function TesQuestions({ propositions }: { propositions: PropositionDuJoueur[] }) {
  if (propositions.length === 0) return null
  return (
    <section className="plume-tes-questions" aria-labelledby="plume-tes-questions-titre">
      <h3 className="label" id="plume-tes-questions-titre">
        Tes questions
      </h3>
      <ul>
        {propositions.map(p => (
          <li key={p.id} className="plume-tienne">
            <span className={`pill plume-statut plume-statut-${p.statut}`}>{STATUT[p.statut]}</span>
            <span className="plume-tienne-texte">
              {espacesFines(p.texte)}
              {p.statut === 'refusee' && p.motif && <small>{espacesFines(p.motif)}</small>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
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
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [propositions, setPropositions] = useState<PropositionDuJoueur[]>([])
  // Les siennes, lues à l'ouverture : la feuille s'ouvre sans les attendre, et une lecture ratée ne dit rien.
  useEffect(() => {
    let vivante = true
    api.jour
      .propositions()
      .then(lues => vivante && setPropositions(lues))
      .catch(() => {})
    return () => {
      vivante = false
    }
  }, [])
  const conseil = conseilDeLaProposition(question, reponses, bonne)
  const prete = conseil === null
  const envoyer = async () => {
    if (!prete || bonne === null || envoi) return
    setEnvoi(true)
    setErreur(null)
    try {
      await api.jour.proposer({ texte: question, reponses, bonne })
      showToast({ kind: 'info', message: 'Envoyée : ton accueil te dira la suite' })
      onFermer()
    } catch (e) {
      // Le serveur relit avec les mêmes règles ; son refus se dit dans la feuille, qui reste ouverte.
      setErreur(motifDe(e))
      setEnvoi(false)
    }
  }
  return (
    <Feuille
      titre="Ta question"
      onFermer={onFermer}
      className="plume-feuille"
      pied={
        <button type="button" className="btn btn-primary btn-block" disabled={!prete || envoi} onClick={() => void envoyer()}>
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
          maxLength={QUESTION_DU_PUBLIC_MAX}
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
                maxLength={REPONSE_DU_PUBLIC_MAX}
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
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      <TesQuestions propositions={propositions} />
    </Feuille>
  )
}
