import { useEffect, useState } from 'react'
import { ligneDeRang, nJoueurs, type FinDeSoiree as Fin, type GainAnnonce, type HautFaitAnnonce } from '../../../shared/fin'
import type { PublicProfile } from '../../../shared/profil'
import { NOM_FINITION, PITCH_PROFIL } from '../../../shared/profil'
import { legendaire } from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import { api } from '../api'
import { spacePath } from '../routes'
import { formatNumber, place, pts } from '../format'
import { showToast } from '../state'
import { Avatar, Dessin } from './Avatar'
import { complets, useDessins } from './medaillons'
import { Icon } from './Icon'
import { lienBilan } from './Lendemain'

/**
 * La fin de soirée, sur le téléphone.
 *
 * Le téléphone ne savait jamais que la soirée était finie : il restait sur
 * « En attente du prochain quiz… » jusqu'à ce qu'on le range. Il raconte
 * maintenant la soirée de son porteur — son rang, ses hauts faits, éclats
 * et ombres —, et à qui a un profil ce qu'elle lui a rapporté : les niveaux,
 * les finitions, les paliers, et surtout les avatars légendaires, qu'on peut
 * porter tout de suite — et, une fois dans une vie peut-être, un Divin.
 *
 * Un invité anonyme a sa soirée aussi, entière. Le bloc du profil lui manque,
 * sans rien qui le lui reproche.
 */
export function FinDeSoiree({
  fin,
  profil,
  onSuivante,
}: {
  fin: Fin
  profil: PublicProfile | null
  onSuivante: () => void
}) {
  const [porte, setPorte] = useState<string | null>(profil?.legendaire ?? null)
  const eclats = fin.hautsFaits.filter(h => h.ton === 'eclat')
  const ombres = fin.hautsFaits.filter(h => h.ton === 'ombre')
  const gain = fin.profil

  const porter = async (cle: string) => {
    try {
      const { profile } = await api.joueur.enregistrer({ legendaire: cle })
      setPorte(profile.legendaire)
      showToast({ kind: 'info', message: `Tu portes ${legendaire(cle)?.nom ?? divin(cle)?.nom ?? 'ton avatar'}` })
    } catch (e) {
      showToast({ kind: 'error', message: (e as Error).message })
    }
  }

  return (
    <div className="player-shell fin-soiree">
      <header className="fin-tete">
        <span className="label">Fin de la soirée</span>
        <h1>{fin.soiree.titre}</h1>
      </header>

      <section className="card fin-moi">
        <Avatar
          className="player-avatar fin-avatar"
          avatar={fin.avatar}
          finition={fin.finition}
          eclat={fin.eclat}
          legendaire={porte ?? fin.legendaire}
        />
        <div>
          <h2>{fin.nom}</h2>
          <LigneRang fin={fin} />
        </div>
      </section>

      {/* Un Divin passe avant tout le reste : c'est la nouvelle de la soirée.
          Une page d'avant ne connaît pas le champ — il peut manquer. */}
      {(gain?.divins ?? []).map(({ key, legende, ton }) => {
        const d = divin(key)
        if (!d) return null
        return (
          <section key={key} className={`card fin-divin fin-divin-${ton}`}>
            <span className="label">Un Divin est descendu sur toi</span>
            <Medaillon cle={key} className="fin-apparition" />
            <h2>{d.nom}</h2>
            {/* Le récit ne se garde pas sur le téléphone : une fin rouverte ne l'a plus. */}
            {legende && <p className="serif-note">{legende}</p>}
            {porte === key ? (
              <p className="muted small">C’est lui que la salle verra, dès la prochaine soirée.</p>
            ) : (
              <button className="btn btn-primary" onClick={() => void porter(key)}>
                Le porter
              </button>
            )}
          </section>
        )
      })}

      {/* L'Éclat : une chance sur quarante, qui tombait en silence — sous un
          légendaire, personne ne le voyait jamais. */}
      {gain?.eclat && (
        <section className="card fin-eclat">
          <span className="label">Une chance sur quarante</span>
          <span className="fin-apparition">
            {legendaire(gain.eclat) ? (
              <Avatar avatar={fin.avatar} legendaire={gain.eclat} finition={fin.finition} eclat />
            ) : (
              <Avatar avatar={gain.eclat} finition={fin.finition} eclat />
            )}
          </span>
          <h2>{legendaire(gain.eclat) ? `${legendaire(gain.eclat)?.nom} a éclaté !` : `Ton ${gain.eclat} a éclaté !`}</h2>
          <p className="serif-note">Il a changé de couleurs, pour toujours — et personne d’autre ne l’a comme ça.</p>
        </section>
      )}

      {gain && (
        <section className="card fin-gain">
          {/* Les paliers à part : « Mes soirées » ne compte que la soirée (ils
              ont leur ligne), et annoncer +24 ici quand la liste en montrait
              4 faisait croire à une erreur. */}
          <p className="fin-xp">+{formatNumber(gain.xp - (gain.xpPaliers ?? 0))} points d’expérience</p>
          {(gain.xpPaliers ?? 0) > 0 && (
            <p className="muted small">+{formatNumber(gain.xpPaliers ?? 0)} de paliers de carrière</p>
          )}
          <BarreDeNiveau avant={gain.niveauAvant} apres={gain.niveauApres} profil={profil} />
          {gain.finitions.length > 0 && (
            <p className="fin-finition">
              Nouvelle finition : <b>{gain.finitions.map(f => NOM_FINITION[f]).join(', ')}</b>
              <Avatar
                className="fin-apercu"
                avatar={fin.avatar}
                finition={gain.finitions[gain.finitions.length - 1]}
              />
            </p>
          )}
          {gain.paliers.length > 0 && <Faits titre="Paliers de carrière" faits={gain.paliers} />}
        </section>
      )}

      {gain?.legendaires.map(cle => {
        const l = legendaire(cle)
        if (!l) return null
        return (
          <section key={cle} className="card fin-legendaire">
            <span className="label">Avatar légendaire débloqué</span>
            <Medaillon cle={cle} className="fin-medaillon" />
            <h2>{l.nom}</h2>
            <p className="serif-note">{l.legende}</p>
            {porte === cle ? (
              <p className="muted small">C’est lui que la salle verra, dès la prochaine soirée.</p>
            ) : (
              <button className="btn btn-primary" onClick={() => void porter(cle)}>
                Le porter
              </button>
            )}
          </section>
        )
      })}

      {/* Ses prix du palmarès : Jeanne cherchait son Éclair, remis à l'écran,
          et sa fin de soirée n'en disait rien. Une page d'avant n'a pas le champ. */}
      {(fin.prix ?? []).length > 0 && (
        <section className="card">
          <h3>{fin.prix!.length > 1 ? 'Tes prix de la soirée' : 'Ton prix de la soirée'}</h3>
          <ul className="fin-prix">
            {fin.prix!.map(p => (
              <li key={p.key}>
                <span className="fin-prix-emoji" aria-hidden="true">
                  {p.emoji}
                </span>
                <span>
                  <b>{p.title}</b>
                  <span className="muted small"> · {p.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {eclats.length > 0 && (
        <section className="card">
          <Faits titre="Tes exploits" faits={eclats} />
        </section>
      )}
      {ombres.length > 0 && (
        <section className="card fin-ombres">
          <Faits titre="Tes coups du sort" faits={ombres} />
          <p className="muted small">Ils comptent aussi : certains avatars légendaires ne se gagnent qu’ainsi.</p>
        </section>
      )}

      {/* Relire sa soirée d'abord : le bouton doré menait à la soirée
          suivante, qui n'existe pas encore — et celui qui revenait « voir les
          résultats » y entrait. « Mon bilan » s'ouvre sur lui, sans « Qui
          es-tu ? ». La suivante reste là, en retrait (README, « Entre deux
          soirées »). Les liens s'ouvrent dans cet onglet : la fin est gardée
          sur le téléphone, le retour du navigateur la retrouve. */}
      <div className="fin-actions">
        {fin.joueurId && (
          <a className="btn btn-primary" href={lienBilan({ soiree: fin.soiree, joueurId: fin.joueurId })}>
            <Icon name="check-circle" />
            Mon bilan
          </a>
        )}
        <a
          className={'btn' + (fin.joueurId ? '' : ' btn-primary')}
          href={spacePath(fin.soiree.slug, 'souvenir', fin.soiree.id)}
        >
          <Icon name="book" />
          Revoir la soirée
        </a>
        <button className="btn btn-ghost" onClick={onSuivante}>
          Rejoindre la soirée suivante
        </button>
        {profil ? (
          <a className="btn btn-ghost" href="/profil">
            Mon profil
          </a>
        ) : (
          // Vrai sur ce soir : la soirée close ne suit pas le profil créé
          // après coup — le dire évite de le promettre. Le lien ouvre la
          // création, prénom et avatar de la soirée déjà remplis : il ouvrait
          // la connexion, vide.
          <p className="muted small fin-invitation">
            {PITCH_PROFIL} Il commence à la prochaine : celle-ci ne s’y ajoute pas.{' '}
            <a className="link-inline" href={lienCreation(fin.nom, fin.avatar)}>
              Créer mon profil
            </a>
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * La création d'un profil, préremplie avec le prénom et l'avatar du soir. La
 * marque d'homonymie (« Camille (2) ») n'est que d'affichage : elle ne se
 * recopie pas dans un prénom (invariant 17).
 */
function lienCreation(nom: string, avatar: string): string {
  const params = new URLSearchParams({ creer: '1', prenom: nom.replace(/ \(\d+\)$/, ''), avatar })
  return `/profil?${params}`
}

/** Une rangée de hauts faits : l'emoji en grand, le titre dessous. */
function Faits({ titre, faits }: { titre: string; faits: HautFaitAnnonce[] }) {
  return (
    <>
      <h3>{titre}</h3>
      <ul className="faits">
        {faits.map(h => (
          <li key={h.key} className={`fait fait-${h.ton}`}>
            <span className="fait-emoji" aria-hidden="true">
              {h.emoji}
            </span>
            <span className="fait-titre">{h.title}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * La barre du niveau : elle part de là où elle était, et se remplit. Une
 * montée de niveau se voit — c'est tout l'intérêt de l'avoir gagnée ce soir.
 */
function BarreDeNiveau({ avant, apres, profil }: { avant: number; apres: number; profil: PublicProfile | null }) {
  const [plein, setPlein] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setPlein(true), 250)
    return () => clearTimeout(t)
  }, [])
  const part = profil ? Math.min(100, Math.round((profil.acquis / Math.max(1, profil.requis)) * 100)) : 100
  return (
    <div className="fin-niveau">
      <div className="row fin-niveaux">
        <span className="niveau big">{avant}</span>
        {apres > avant ? (
          <>
            <span className="fin-fleche" aria-hidden="true">→</span>
            <span className="niveau big fin-niveau-neuf">{apres}</span>
            <b className="fin-monte">Niveau {apres} !</b>
          </>
        ) : (
          <span className="muted small">Niveau {apres}</span>
        )}
      </div>
      <div className="xp-bar">
        <div className="xp-fill" style={{ width: plein ? `${part}%` : '0%' }} />
      </div>
    </div>
  )
}

/**
 * Ce que le dernier podium vient de rapporter : un instant de fête, par-dessus
 * l'écran, qui s'efface de lui-même. Un niveau gagné se fête plus fort.
 */
export function Celebration({ gain, onFin }: { gain: GainAnnonce; onFin: () => void }) {
  useEffect(() => {
    const t = setTimeout(onFin, gain.niveauApres > gain.niveauAvant ? 5000 : 3000)
    return () => clearTimeout(t)
  }, [gain, onFin])
  const monte = gain.niveauApres > gain.niveauAvant
  return (
    <button type="button" className={'celebration' + (monte ? ' celebration-niveau' : '')} onClick={onFin} role="status">
      <span className="celebration-xp">+{formatNumber(gain.xp)} XP</span>
      {monte && <span className="celebration-niveau-texte">Niveau {gain.niveauApres} !</span>}
      {gain.finitions.length > 0 && (
        <span className="celebration-finition">
          Finition {gain.finitions.map(f => NOM_FINITION[f]).join(', ')} débloquée
        </span>
      )}
    </button>
  )
}

/**
 * Sous le prénom : son rang, ou ce qu'on sait de lui. Le rang vaut 0 à 0
 * point — Bob, deux réponses fausses, lisait « Tu n'as pas joué ce soir » —,
 * c'est donc `aJoue` qui le dit ; une fin d'un serveur d'avant ne l'a pas, et
 * garde la phrase neutre d'alors.
 */
function LigneRang({ fin }: { fin: Fin }) {
  const l = ligneDeRang(fin)
  switch (l.cas) {
    case 'rang':
      return (
        <p className="fin-rang">
          <b>{place(l.rang)}</b> sur {l.joueurs} · {pts(l.points)}
        </p>
      )
    case 'zero':
      return <p className="fin-rang">0 point · {nJoueurs(l.joueurs)}</p>
    case 'absent':
      // Arrivé après la dernière question : la phrase parle de lui, et de la
      // salle qui, elle, a joué — il lisait « 0 joueurs ce soir ».
      return (
        <p className="muted">
          Tu n’as pas joué ce soir
          {l.joueurs > 0 && ` · ${nJoueurs(l.joueurs)}`}
        </p>
      )
    case 'neutre':
      return <p className="muted">{nJoueurs(l.joueurs)} ce soir</p>
  }
}

/**
 * Un médaillon gagné ce soir, dans son cadre. Si son dessin n'a pas pu venir
 * (`medaillons.ts`), la page ne le chargera plus, et la recharger ne
 * suffirait pas — la fin de soirée a oublié le jeton de l'invité. Son profil,
 * lui, le montre : un lien prend la place du cadre, dont la taille est celle
 * d'un dessin, pas d'un texte.
 */
function Medaillon({ cle, className }: { cle: string; className: string }) {
  const dessins = useDessins(true)
  if (dessins.echec && !complets(dessins)) {
    return (
      <p className="small">
        <a className="link-inline" href="/profil">
          Le voir sur ton profil
        </a>
      </p>
    )
  }
  return (
    <span className={className}>
      <Dessin cle={cle} />
    </span>
  )
}
