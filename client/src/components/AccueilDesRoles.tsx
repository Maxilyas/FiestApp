import { useState, type MouseEvent, type ReactNode } from 'react'
import { api } from '../api'
import { Icon, type IconName } from './Icon'
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

interface Action {
  cle: string
  nom: string
  icone: IconName
  href?: string
  onClick?: () => void
}

/**
 * Où l'on joue ce soir : revenir là où l'on est déjà inscrit, rejoindre une
 * soirée, jouer chez soi.
 *
 * Pour qui ne fait que jouer, c'est « Ce soir », et rejoindre en est l'action
 * principale. Pour qui anime aussi, c'est « Je joue », sous « J'anime » : une
 * action principale seulement s'il joue déjà quelque part — l'écran commun
 * garde le gros bouton de la page.
 */
export function JeJoue({
  enCours,
  chezMoi,
  onRejoindre,
  lendemain,
}: {
  enCours: { nom: string; slug: string }[]
  /** L'adresse de son espace, s'il anime : « Jouer chez moi ». */
  chezMoi: string | null
  onRejoindre: () => void
  lendemain: ReactNode
}) {
  const deuxRoles = chezMoi !== null
  const actions: Action[] = [
    // La soirée où l'on joue déjà d'abord : « Rejoindre une soirée »
    // redemandait son nom à qui y était inscrit, et faisait douter d'avoir
    // quitté la partie (Sofia, le 23 et le 24).
    ...enCours.map(e => ({ cle: `revenir-${e.slug}`, nom: `Revenir chez ${e.nom}`, icone: 'play' as const, href: spacePath(e.slug) })),
    { cle: 'rejoindre', nom: 'Rejoindre une soirée', icone: 'users', onClick: onRejoindre },
    ...(chezMoi && !enCours.some(e => e.slug === chezMoi)
      ? [{ cle: 'chez-moi', nom: 'Jouer chez moi', icone: 'smartphone' as const, href: spacePath(chezMoi) }]
      : []),
  ]
  const principale = enCours.length > 0 || !deuxRoles ? actions[0] : null
  const autres = principale ? actions.slice(1) : actions
  const bouton = (a: Action, classe: string) =>
    a.href ? (
      <a key={a.cle} className={classe} href={a.href}>
        <Icon name={a.icone} />
        {a.nom}
      </a>
    ) : (
      <button key={a.cle} type="button" className={classe} onClick={a.onClick}>
        <Icon name={a.icone} />
        {a.nom}
      </button>
    )
  return (
    <section className="card ce-soir" aria-labelledby="accueil-je-joue">
      <h3 id="accueil-je-joue">
        <Icon name={deuxRoles ? 'smartphone' : 'zap'} />
        {deuxRoles ? 'Je joue' : 'Ce soir'}
      </h3>
      {principale && bouton(principale, 'btn btn-primary btn-block')}
      {autres.length > 0 && <div className="ce-soir-autres">{autres.map(a => bouton(a, 'btn btn-small'))}</div>}
      {lendemain}
      {!deuxRoles && (
        <p className="join-foot">
          <a className="link-inline" href="/connexion?next=/host">
            J’anime une soirée
          </a>
        </p>
      )}
    </section>
  )
}
