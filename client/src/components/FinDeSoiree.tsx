import { useEffect, useState } from 'react'
import {
  ligneDeRang,
  nJoueurs,
  type Approche,
  type FinDeSoiree as Fin,
  type GainAnnonce,
  type HautFaitAnnonce,
  type RecordBattu,
} from '../../../shared/fin'
import type { Finition, PublicProfile } from '../../../shared/profil'
import { NOM_FINITION, PITCH_PROFIL } from '../../../shared/profil'
import { legendaire } from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import { brancheDe, nomDansLaPhrase, portrait as portraitDe, type Portrait } from '../../../shared/branches'
import { hautFait, palierDe, titreDePalier } from '../../../shared/hautsfaits'
import { collectionGagnee } from '../../../shared/avatars'
import { api } from '../api'
import { spacePath } from '../routes'
import { formatNumber, place, pourcent, pts } from '../format'
import { showToast } from '../state'
import { Avatar, Dessin } from './Avatar'
import { perdus, sortesDe, useDessins } from './medaillons'
import { Flamme, Icon } from './Icon'
import { lienBilan } from './Lendemain'

/**
 * La fin de soirée, sur le téléphone.
 *
 * Le téléphone ne savait jamais que la soirée était finie : il restait sur
 * « En attente du prochain quiz… » jusqu'à ce qu'on le range. Il raconte
 * maintenant la soirée de son porteur — son rang, ses hauts faits, éclats
 * et ombres —, et à qui a un profil ce qu'elle lui a rapporté : les niveaux,
 * les finitions, les paliers, les portraits de ses branches, et surtout les
 * avatars légendaires, qu'on peut porter tout de suite — et, une fois dans
 * une vie peut-être, un Divin.
 *
 * Un invité anonyme a sa soirée aussi, entière. Le bloc du profil lui manque,
 * sans rien qui le lui reproche.
 */
export function FinDeSoiree({
  fin,
  profil,
  suivante = false,
  onSuivante,
}: {
  fin: Fin
  profil: PublicProfile | null
  /** La soirée suivante a commencé dans l'espace (`suivanteCommencee`) : de quoi la rejoindre. */
  suivante?: boolean
  onSuivante: () => void
}) {
  const [porte, setPorte] = useState<string | null>(profil?.legendaire ?? null)
  const eclats = fin.hautsFaits.filter(h => h.ton === 'eclat')
  const ombres = fin.hautsFaits.filter(h => h.ton === 'ombre')
  const gain = fin.profil
  // Les niveaux gagnés ce soir disent seuls ce qu'ils ouvrent : le serveur
  // n'a rien à annoncer de plus.

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

      {/* La soirée suivante ne se propose qu'une fois commencée — un invité
          inscrit, un quiz lancé —, et en haut, sans défiler. « Rejoindre la
          soirée suivante », toujours au pied de la fin, menait à une soirée
          qui n'existait pas encore, et c'était le seul geste pour quitter la
          fin (le propriétaire du dépôt, le 28 septembre 2026). */}
      {suivante && (
        <div className="card notice fin-suivante" role="status">
          <span id="fin-suivante">La soirée suivante commence</span>
          {/* Son nom reste celui qu'on lit — la commande vocale le trouve —,
              et sa phrase le décrit, hors d'elle aussi. */}
          <button type="button" className="btn btn-primary btn-small" aria-describedby="fin-suivante" onClick={onSuivante}>
            La rejoindre
          </button>
        </div>
      )}

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
            {legendaire(gain.eclat) || portraitDe(gain.eclat) ? (
              <Avatar avatar={fin.avatar} legendaire={gain.eclat} finition={fin.finition} eclat />
            ) : (
              <Avatar avatar={gain.eclat} finition={fin.finition} eclat />
            )}
          </span>
          <h2>
            {legendaire(gain.eclat)
              ? `${legendaire(gain.eclat)?.nom} a éclaté !`
              : portraitDe(gain.eclat)
                ? `${portraitDe(gain.eclat)?.nom} a éclaté !`
                : `Ton ${gain.eclat} a éclaté !`}
          </h2>
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

      {/* Un emoji de collection à chaque niveau qui n'ouvre pas de finition :
          il se porte d'ici, comme un légendaire. Porter un emoji ôte le
          légendaire : c'est l'un ou l'autre. */}
      {gain && (
        <CollectionOuverte
          avant={gain.niveauAvant}
          apres={gain.niveauApres}
          finition={fin.finition}
          onPorte={p => setPorte(p.legendaire)}
        />
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

      {/* Les portraits de ses branches : presque chaque soirée en ouvre un.
          Une fin d'avant n'a pas le champ. */}
      <PortraitsOuverts cles={gain?.portraits ?? []} porte={porte} onPorte={p => setPorte(p.legendaire)} />

      {/* Ce qui se voit même les soirs où rien ne tombe : un record battu,
          une jauge qui avance. Une fin d'avant n'a pas ces champs. */}
      {(gain?.records ?? []).length > 0 && (
        <section className="card nouveau-bloc">
          <span className="nouveau-pastille">Nouveau</span>
          <h3>
            <Icon name="trophy" />
            {gain!.records!.length > 1 ? 'Records battus' : 'Record battu'}
          </h3>
          {gain!.records!.map(r => (
            <Record key={r.key} r={r} />
          ))}
        </section>
      )}
      {(gain?.approches ?? []).length > 0 && (
        <section className="card fin-approches">
          <h3>
            <Icon name="target" />
            Tu t’en approches
          </h3>
          {gain!.approches!.map(a => (
            <UneApproche key={a.key} a={a} />
          ))}
        </section>
      )}

      {/* Le quiz du jour, que la soirée ne mentionnait jamais — sur le
          téléphone d'un profil seulement : à l'écran commun, l'anonyme y
          verrait un jeu qui lui est fermé. La série, la soirée vient de
          l'allonger. */}
      {gain?.jour && (
        <section className="card fin-demain">
          <h3>
            <Flamme />
            {gain.jour.aJoue ? 'Demain, le quiz du jour' : 'Le quiz du jour'}
          </h3>
          <p className="muted small">
            Dix questions chaque jour, les mêmes pour tous les profils
            {gain.jour.serie > 0 && ` · ta série : ${gain.jour.serie} jour${gain.jour.serie > 1 ? 's' : ''}`}.
          </p>
          {!gain.jour.aJoue && (
            <a className="link-inline" href="/jour">
              Jouer celui d’aujourd’hui
            </a>
          )}
        </section>
      )}

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
          {/* Un prix se regagne à chaque soirée ; c'est la première fois qui
              compte, celle où il entre dans la collection. */}
          {(gain?.collection?.nouveaux.length ?? 0) > 0 && (
            <p className="collection-neuf">
              <span className="nouveau-pastille">Nouveau</span>
              {gain!.collection!.nouveaux.length > 1 ? 'Ils rejoignent' : 'Il rejoint'} ta collection :{' '}
              {gain!.collection!.eus} prix sur {gain!.collection!.total}
            </p>
          )}
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

      {/* Relire sa soirée d'abord : « Mon bilan » s'ouvre sur lui, sans « Qui
          es-tu ? ». La soirée suivante n'a plus de bouton ici : il menait à
          une soirée qui n'existait pas encore, et celui qui revenait « voir
          les résultats » y entrait — elle se propose en haut, une fois
          commencée. Les liens s'ouvrent dans cet onglet : la fin est gardée
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

/** Un record battu : ce soir en gras, l'ancien en retrait. */
function Record({ r }: { r: RecordBattu }) {
  const [ceSoir, avant] =
    r.key === 'precision'
      ? [`${pourcent(r.valeur)} de bonnes réponses`, pourcent(r.avant)]
      : [`${formatNumber(r.valeur)} bonnes réponses ${r.key === 'serie' ? 'd’affilée' : 'dans la soirée'}`, formatNumber(r.avant)]
  return (
    <p>
      <b>{ceSoir}</b>
      {r.key === 'precision' && r.sur !== undefined && `, sur ${formatNumber(r.sur)} QCM`}.{' '}
      <span className="muted">Ton record était de {avant}.</span>
    </p>
  )
}

/**
 * Un objectif qui a avancé ce soir : un légendaire, en silhouette dorée, ou
 * le prochain palier d'un haut fait de carrière — ce qu'on compte, où l'on
 * en est, ce que la soirée y a ajouté, et la jauge.
 */
function UneApproche({ a }: { a: Approche }) {
  const l = legendaire(a.key)
  const p = palierDe(a.key)
  const h = l ? hautFait(l.condition.hautFait) : p?.hautFait
  if (!h || (!l && !p)) return null
  const titre = l ? l.nom : titreDePalier(p!.hautFait, p!.palier)
  const compte =
    h.famille === 'carriere'
      ? `${formatNumber(a.acquis)} sur ${formatNumber(a.requis)} ${a.requis < 2 ? h.mesureUne : h.mesure}`
      : `${h.title} : ${a.acquis} fois sur ${a.requis}`
  return (
    <div className="approche">
      {l ? <MedaillonAVenir cle={a.key} emoji={h.emoji} /> : <span className="approche-emoji" aria-hidden="true">{h.emoji}</span>}
      <div className="approche-corps">
        <b>{titre}</b>
        <span className="muted small">
          {compte} · <span className="approche-ce-soir">+{formatNumber(a.ceSoir)} ce soir</span>
        </span>
        <span className="jauge" aria-label={`${a.acquis} sur ${a.requis}`}>
          <span className="jauge-plein" style={{ width: `${Math.min(100, (a.acquis / a.requis) * 100)}%` }} />
        </span>
      </div>
    </div>
  )
}

/**
 * Le légendaire qu'on approche, en silhouette dorée. Si ses dessins ne
 * viendront plus, l'emoji du haut fait qui le fait tomber : une place vide
 * ne dirait rien.
 */
function MedaillonAVenir({ cle, emoji }: { cle: string; emoji: string }) {
  const sortes = sortesDe([cle])
  if (perdus(useDessins(...sortes), sortes)) {
    return (
      <span className="approche-emoji" aria-hidden="true">
        {emoji}
      </span>
    )
  }
  return (
    <span className="approche-medaillon">
      <Dessin cle={cle} verrouille />
    </span>
  )
}

/**
 * Les portraits des branches que la soirée — ou la partie du quiz du jour —
 * vient d'ouvrir, qu'on porte d'ici. Presque chaque soirée en ouvre un, et
 * la première en ouvre souvent plusieurs : ils tiennent dans une rangée, pas
 * dans une carte chacun comme un légendaire, qui reste l'événement.
 */
export function PortraitsOuverts({
  cles,
  porte,
  onPorte,
}: {
  cles: readonly string[]
  /** L'avatar dessiné qu'il porte déjà. */
  porte: string | null
  onPorte?: (profil: PublicProfile) => void
}) {
  const [porteIci, setPorteIci] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const portraits = cles.map(c => portraitDe(c)).filter((p): p is Portrait => !!p)
  if (portraits.length === 0) return null
  const actuel = porteIci ?? porte
  const porter = async (p: Portrait) => {
    if (busy) return
    setBusy(true)
    try {
      const { profile } = await api.joueur.enregistrer({ legendaire: p.key })
      setPorteIci(profile.legendaire)
      onPorte?.(profile)
      showToast({ kind: 'info', message: `Tu portes ${nomDansLaPhrase(p.nom)}` })
    } catch (e) {
      showToast({ kind: 'error', message: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card fin-portraits">
      <span className="label">{portraits.length > 1 ? 'Nouveaux avatars du savoir' : 'Nouvel avatar du savoir'}</span>
      <div className="fin-portraits-liste">
        {portraits.map(p => (
          <div key={p.key} className="fin-portrait">
            <Medaillon cle={p.key} className="fin-portrait-dessin" />
            <b>{p.nom}</b>
            <span className="muted small">{`${p.seuil} bonnes réponses en ${brancheDe(p).categorie}`}</span>
            {actuel === p.key ? (
              <span className="muted small">C’est lui que la salle verra.</span>
            ) : (
              <button
                type="button"
                className="btn btn-small"
                aria-label={`Porter ${nomDansLaPhrase(p.nom)}`}
                aria-disabled={busy || undefined}
                onClick={() => void porter(p)}
              >
                Le porter
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="muted small">Chaque bonne réponse fait avancer la branche de sa catégorie, en soirée comme au quiz du jour.</p>
    </section>
  )
}

/**
 * Les emojis de collection qu'une montée de niveau vient d'ouvrir, qu'on
 * porte d'ici : en fin de soirée comme à la fin du quiz du jour, qui les
 * ouvrait sans un mot.
 */
export function CollectionOuverte({
  avant,
  apres,
  finition,
  onPorte,
}: {
  avant: number
  apres: number
  finition?: Finition
  onPorte?: (profil: PublicProfile) => void
}) {
  const [emojiPorte, setEmojiPorte] = useState<string | null>(null)
  const nouveaux = collectionGagnee(avant, apres)
  if (nouveaux.length === 0) return null
  const porterEmoji = async (emoji: string) => {
    try {
      const { profile } = await api.joueur.enregistrer({ avatar: emoji })
      setEmojiPorte(profile.avatar)
      onPorte?.(profile)
      showToast({ kind: 'info', message: `Tu portes ${emoji}` })
    } catch (e) {
      showToast({ kind: 'error', message: (e as Error).message })
    }
  }
  return (
    <section className="card fin-collection">
      <span className="label">{nouveaux.length > 1 ? 'Nouveaux avatars de collection' : 'Nouvel avatar de collection'}</span>
      <div className="fin-collection-emojis">
        {nouveaux.map(e => (
          <div key={e} className="fin-collection-emoji">
            <Avatar avatar={e} finition={finition} />
            {emojiPorte !== e && (
              <button className="btn btn-small" aria-label={`Porter ${e}`} onClick={() => void porterEmoji(e)}>
                Le porter
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="muted small">
        {emojiPorte && nouveaux.includes(emojiPorte)
          ? `C’est ${emojiPorte} que la salle verra, dès la prochaine soirée.`
          : 'Réservés aux profils : un emoji à chaque niveau qui n’ouvre pas de finition, jusqu’au 17.'}
      </p>
    </section>
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
  const nouveaux = collectionGagnee(gain.niveauAvant, gain.niveauApres)
  return (
    <button type="button" className={'celebration' + (monte ? ' celebration-niveau' : '')} onClick={onFin} role="status">
      <span className="celebration-xp">+{formatNumber(gain.xp)} XP</span>
      {monte && <span className="celebration-niveau-texte">Niveau {gain.niveauApres} !</span>}
      {gain.finitions.length > 0 && (
        <span className="celebration-finition">
          Finition {gain.finitions.map(f => NOM_FINITION[f]).join(', ')} débloquée
        </span>
      )}
      {nouveaux.length > 0 && (
        <span className="celebration-finition">
          {nouveaux.length > 1 ? 'Nouveaux avatars' : 'Nouvel avatar'} : {nouveaux.join(' ')}
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
export function Medaillon({ cle, className }: { cle: string; className: string }) {
  const sortes = sortesDe([cle])
  if (perdus(useDessins(...sortes), sortes)) {
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
