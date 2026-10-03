import { useState, type MouseEvent, type ReactNode } from 'react'
import { api } from '../api'
import { Icon } from './Icon'
import { GrosBouton } from './Pieces'
import { consoleOuvreuse, revenirALaConsole } from '../onglets'
import { spacePath } from '../routes'
import { showToast } from '../state'
import type { PublicSpace } from '../../../shared/space'

// L'accueil de qui anime et joue : deux cartes, l'une sous l'autre, dans le
// même ordre quel que soit le soir — « J'anime », puis « Je joue ».
//
// Il n'y avait qu'une carte, « Ce soir », dont le gros bouton passait
// d'« Animer ma soirée » à « Revenir chez Bob » selon l'heure ; « Mes quiz »
// ne s'atteignait que par la salle d'attente de l'écran commun, dans un
// second onglet, et ses réglages que par « Mon compte », depuis la même
// salle. Qui animait et jouait se perdait entre ses deux rôles (lot 12, la
// remarque du propriétaire du 27 septembre 2026).

/**
 * « J'anime » : ce que l'animateur fait de son espace — l'écran commun, ses
 * quiz, son compte, l'historique.
 *
 * Venu de son profil (`rouvrir`), sa session d'animateur a pu expirer :
 * trente jours, contre un an pour celle du joueur. On la rouvre avant de
 * partir vers une page qui la demande, sinon elle renverrait à une connexion
 * qu'on vient justement de passer. Une console ouverte ici sans profil, elle,
 * est déjà là.
 */
export function JAnime({ espace, rouvrir }: { espace: PublicSpace; rouvrir: boolean }) {
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  // Ouvert par la console (« Accueil », dans sa bande) : on y revient, au
  // lieu d'en ouvrir une seconde dans cet onglet. Lu une fois, comme
  // `LienConsole`.
  const [ouvreuse] = useState(() => consoleOuvreuse() !== null)

  const aller = async (dest: string) => {
    setBusy(true)
    setErreur('')
    try {
      if (rouvrir) await api.joueur.console()
      window.location.assign(dest)
    } catch (e) {
      setBusy(false)
      setErreur((e as Error).message)
    }
  }
  const ecranCommun = () => {
    const revenu =
      ouvreuse &&
      revenirALaConsole(() => showToast({ kind: 'info', message: 'Ta console est ouverte dans l’onglet d’avant' }))
    if (!revenu) void aller('/host')
  }
  // Un lien reste un lien — l'ouvrir dans un onglet, le copier — : seul le
  // clic simple passe par la session rouverte.
  const parLaSession = (dest: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!rouvrir || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    if (!busy) void aller(dest)
  }

  return (
    <section className="card ce-soir accueil-role" aria-labelledby="accueil-j-anime">
      <h3 id="accueil-j-anime">
        <Icon name="monitor" />
        J’anime
        <span className="accueil-espace">{espace.title}</span>
      </h3>
      <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={ecranCommun}>
        <Icon name="play" />
        {ouvreuse ? 'Revenir à la console' : 'Ouvrir l’écran commun'}
      </button>
      <div className="ce-soir-autres accueil-raccourcis">
        {/* Un salon s'ouvre avec son profil (`/api/joueur/salon`) : la console
            ouverte ici sans profil garde l'écran commun pour seule porte. */}
        {rouvrir && (
          <a className="btn btn-small" href="/salon">
            <Icon name="plus" />
            Nouveau salon
          </a>
        )}
        <a className="btn btn-small" href="/edit" onClick={parLaSession('/edit')}>
          <Icon name="edit" />
          Mes quiz
        </a>
        <a className="btn btn-small" href="/compte" onClick={parLaSession('/compte')}>
          <Icon name="users" />
          Mon compte
        </a>
        <a className="btn btn-small" href={spacePath(espace.slug, 'soirees')}>
          <Icon name="book" />
          Historique
        </a>
      </div>
      {erreur && (
        <p className="error small" role="alert">
          {erreur}
        </p>
      )}
    </section>
  )
}

/**
 * L'accueil d'un profil : ce qu'on vient faire, en gros boutons — une soirée
 * où l'on joue déjà passe devant tout (« Revenir chez Hugo »), puis le quiz
 * du jour, créer un salon, rejoindre une soirée. Chacun ouvre sa page, qui en
 * dit plus : un toucher de plus qu'une carte qui montrait tout, mais un
 * écran qu'on lit d'un coup d'œil.
 *
 * Il remplace « Je joue » et « Ce soir », dont les boutons changeaient de
 * place et de taille selon l'heure et les rôles. Tout le monde a son salon :
 * il n'y a plus de porte d'animateur à chercher.
 */
export function AccueilJouer({
  enCours,
  onRejoindre,
  lendemain,
}: {
  enCours: { nom: string; slug: string }[]
  onRejoindre: () => void
  lendemain: ReactNode
}) {
  return (
    <section className="accueil-gestes" aria-label="Jouer">
      {enCours.map(e => (
        <GrosBouton key={e.slug} principal icone={<Icon name="play" />} titre={`Revenir chez ${e.nom}`} detail="La soirée continue sans toi" href={spacePath(e.slug)} />
      ))}
      <GrosBouton icone={<Icon name="sun" />} titre="Le quiz du jour" detail="Dix questions, les mêmes pour tous" href="/jour" />
      <GrosBouton icone={<Icon name="plus" />} titre="Créer un salon" detail="Tes quiz, tes amis, un code à dicter" href="/salon" />
      <GrosBouton icone={<Icon name="users" />} titre="Rejoindre une soirée" detail="Le code à six chiffres de ton hôte" onClick={onRejoindre} />
      {lendemain}
    </section>
  )
}
