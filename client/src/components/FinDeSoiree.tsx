import { useEffect, useState } from 'react'
import { ligneDeRang, nJoueurs, type Approche, type FinDeSoiree as Fin, type GainAnnonce, type RecordBattu } from '../../../shared/fin'
import type { PublicProfile } from '../../../shared/profil'
import { CHANCE_ECLAT, NOM_FINITION, PITCH_PROFIL } from '../../../shared/profil'
import { hautFaitPrincipal, legendaire } from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import { hautFait, palierDe, titreDePalier } from '../../../shared/hautsfaits'
import { collectionGagnee } from '../../../shared/avatars'
import { phraseDesConfettis } from '../../../shared/themes'
import { aPorterDesTrophees, partsDeLXp, tropheesTombes } from '../../../shared/gains'
import { api } from '../api'
import { spacePath } from '../routes'
import { formatNumber, place, pourcent, pts, rang as rangEcrit } from '../format'
import { showToast } from '../state'
import { confirmDialog } from './Dialog'
import { Avatar, Dessin } from './Avatar'
import { perdus, sortesDe, useDessins } from './medaillons'
import { Flamme, Icon } from './Icon'
import { EclatTombe, Medaillon } from './Ouverts'
import { APorter, CeQueTuGagnes, MissionsAccomplies, NouveauxTrophees, emojisAPorter, useNiveauRelu, type NiveauDeLaFin } from './Gains'
import { lienBilan } from './Lendemain'
import { Feuille } from './Pieces'

/**
 * La fin de soirée, sur le téléphone, au format de toutes les fins (l'écran
 * A, choisi par le propriétaire le 13 octobre 2026) : sa soirée dans le cadre
 * du tableau de bord — sa place, ses points, ses records —, puis « Ce que tu
 * gagnes », les Divins, l'Éclat et les légendaires en grand, les nouveaux
 * trophées, ce qu'ils ouvrent à porter, les deux gestes, et « Plus » replié.
 *
 * Le téléphone ne savait jamais que la soirée était finie : il restait sur
 * « En attente du prochain quiz… » jusqu'à ce qu'on le range. Il raconte
 * maintenant la soirée de son porteur — son rang, ses trophées, exploits et
 * coups du sort, ses prix — et à qui a un profil ce qu'elle lui a rapporté :
 * l'expérience et le niveau, les finitions, et surtout les avatars
 * légendaires, qu'on peut porter tout de suite — et, une fois dans une vie
 * peut-être, un Divin.
 *
 * Un invité anonyme a sa soirée aussi, entière. Ce que rapporte un profil lui
 * manque, sans rien qui le lui reproche.
 */
export function FinDeSoiree({
  fin,
  profil,
  suivante = false,
  onSuivante,
  chef = false,
}: {
  fin: Fin
  profil: PublicProfile | null
  /** La soirée suivante a commencé dans l'espace (`suivanteCommencee`) : de quoi la rejoindre. */
  suivante?: boolean
  onSuivante: () => void
  /** Ce téléphone a ouvert le salon (`chef.ts`) : « Encore un quiz, avec eux », et « C'était un essai ». */
  chef?: boolean
}) {
  const [porte, setPorte] = useState<string | null>(profil?.legendaire ?? null)
  const gain = fin.profil
  const approches = gain?.approches ?? []
  // Le niveau relu : où il en est dans le suivant. La fin gardée se rouvre
  // des jours après — un autre niveau, peut-être : la montée de ce soir
  // seulement, sans barre.
  const relu = useNiveauRelu(!!gain)
  const niveau = niveauDeLaSoiree(gain, relu, profil)
  const paliers = gain?.paliers ?? []
  const trophees = tropheesTombes([...paliers, ...fin.hautsFaits], { prix: fin.prix ?? [], joueurs: fin.joueurs })

  const porter = async (cle: string) => {
    try {
      const { profile } = await api.joueur.enregistrer({ legendaire: cle })
      setPorte(profile.legendaire)
      showToast({ kind: 'info', message: `Tu portes ${legendaire(cle)?.nom ?? divin(cle)?.nom ?? 'ton avatar'}` })
    } catch (e) {
      showToast({ kind: 'error', message: (e as Error).message })
    }
  }

  const rang = ligneDeRang(fin)
  const resumeDuPlus = [
    approches.length > 0 && `${approches.length} objectif${approches.length > 1 ? 's' : ''} en vue`,
    gain?.jour && (gain.jour.aJoue ? 'le quiz de demain' : 'le quiz du jour t’attend'),
  ]
    .filter(Boolean)
    .join(' · ')
  const liens = !!fin.joueurId || !!profil || !!gain?.confettis
  const aPlus = liens || !!resumeDuPlus

  return (
    <div className="player-shell fin-soiree">
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

      {/* La soirée en un coup d'œil, dans le cadre du tableau de bord : qui,
          sa place, ses points, ses records. Elle s'empilait en cinq cartes et
          deux boutons dorés — trop gros, trop de blocs (la remarque du
          propriétaire du 3 octobre 2026). */}
      <section className="admin-hud fin-hud" aria-labelledby="fin-titre">
        <header className="fin-tete">
          <span className="salon-hud-label">
            <span className="admin-pouls" aria-hidden="true" />
            Fin de la soirée
          </span>
          <h1 id="fin-titre">{fin.soiree.titre}</h1>
        </header>
        <div className="fin-moi">
          <Avatar
            className="player-avatar fin-avatar"
            avatar={fin.avatar}
            finition={fin.finition}
            eclat={fin.eclat}
            legendaire={porte ?? fin.legendaire}
          />
          <div>
            <h2>{fin.nom}</h2>
            {rang.cas === 'rang' ? <p className="muted small">{nJoueurs(rang.joueurs)} ce soir</p> : <LigneRang fin={fin} />}
          </div>
        </div>
        {rang.cas === 'rang' && (
          <div className="admin-cadrans fin-cadrans">
            <Chiffre chiffre={rangEcrit(rang.rang)} nom={`sur ${rang.joueurs}`} />
            <Chiffre chiffre={formatNumber(rang.points)} nom="points" />
          </div>
        )}
        {/* Ses records battus ce soir : le score de la soirée, à côté de sa place. */}
        {(gain?.records ?? []).map(r => (
          <p key={r.key} className="fin-record">
            <Icon name="bar-chart" />
            <span>
              <b>Record battu</b> · {texteDuRecord(r)}
            </span>
          </p>
        ))}
      </section>

      {/* Ce que la soirée rapporte, en un total : la soirée — ce que « Mes
          soirées » lui compte, ses exploits compris — et ses pistes, payées à
          part ; les confettis, le niveau. */}
      {gain && (
        <CeQueTuGagnes
          parts={partsDeLXp([
            { nom: 'ta soirée', xp: gain.xp - (gain.xpPaliers ?? 0) },
            { nom: 'tes pistes', xp: gain.xpPaliers ?? 0 },
          ])}
          confettis={gain.confettis?.gagnes ?? 0}
          niveau={niveau}
        />
      )}

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
      {gain?.eclat && <EclatTombe cle={gain.eclat} avatar={fin.avatar} finition={fin.finition} chance={CHANCE_ECLAT} />}

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

      {/* Ses trophées de la soirée — pistes, exploits, prix, puis coups du
          sort —, les plus rares d'abord : trois en vue, le reste d'un toucher.
          Avec un profil, chacun mène à sa page de l'album. */}
      <NouveauxTrophees
        trophees={trophees}
        lien={!!profil}
        apres={
          (gain?.collection?.nouveaux.length ?? 0) > 0 && (
            <p className="collection-neuf">
              <span className="nouveau-pastille">Nouveau</span>
              {gain!.collection!.nouveaux.length > 1 ? 'Ils rejoignent' : 'Il rejoint'} ta collection : {gain!.collection!.eus} prix sur {gain!.collection!.total}
            </p>
          )
        }
      />
      {gain && <APorter objets={[...aPorterDesTrophees(paliers.map(p => p.key)), ...emojisAPorter(niveau)]} />}
      {/* Ses missions du jour, si la soirée en a fait — ses bonnes réponses comptent partout. */}
      <MissionsAccomplies profil={!!gain} />

      {/* Deux gestes, côte à côte : relire sa soirée — « Mon bilan » s'ouvre
          sur lui, sans « Qui es-tu ? » —, ou rentrer. Un seul « Accueil » sur
          la page, chef compris. Les liens s'ouvrent dans cet onglet : la fin
          est gardée sur le téléphone, le retour du navigateur la retrouve. */}
      <div className="fin-actions fin-duo">
        {fin.joueurId ? (
          <a className="btn btn-primary" href={lienBilan({ soiree: fin.soiree, joueurId: fin.joueurId })}>
            <Icon name="check-circle" />
            Mon bilan
          </a>
        ) : (
          <a className="btn btn-primary" href={spacePath(fin.soiree.slug, 'souvenir', fin.soiree.id)}>
            <Icon name="book" />
            Revoir la soirée
          </a>
        )}
        <a className="btn" href="/">
          <Icon name="home" />
          Accueil
        </a>
      </div>
      {/* Vrai sur ce soir : la soirée close ne suit pas le profil créé après
          coup — le dire évite de le promettre. Le lien ouvre la création,
          prénom et avatar de la soirée déjà remplis. */}
      {!profil && (
        <p className="muted small fin-invitation">
          {PITCH_PROFIL} Il commence à la prochaine : celle-ci ne s’y ajoute pas.{' '}
          <a className="link-inline" href={lienCreation(fin.nom, fin.avatar)}>
            Créer mon profil
          </a>
        </p>
      )}
      {chef && <GestesDuChef fin={fin} />}

      {/* Le reste, replié : le souvenir, son profil, les confettis, ce qu'on
          approche, le quiz du jour. Le résumé dit ce qu'il y a dedans ; rien
          ne se perd, rien ne pousse les boutons hors de l'écran. */}
      {aPlus && (
        <details className="fin-plus">
          <summary>
            <span>
              <b>Plus</b>
              {resumeDuPlus && <span className="muted small">{resumeDuPlus}</span>}
            </span>
            <Icon name="chevron-down" className="repli-chevron" />
          </summary>
          {liens && (
            <p className="fin-liens">
              {fin.joueurId && (
                <a className="link-inline" href={spacePath(fin.soiree.slug, 'souvenir', fin.soiree.id)}>
                  Revoir la soirée
                </a>
              )}
              {profil && (
                <a className="link-inline" href="/profil">
                  Mon profil
                </a>
              )}
              {gain?.confettis && (
                <a className="link-inline" href="/boutique">
                  La boutique des thèmes
                </a>
              )}
            </p>
          )}
          {gain?.confettis && <p className="muted small">{phraseDesConfettis(gain.confettis)}</p>}
          {approches.length > 0 && (
            <div className="fin-approches">
              <h3>
                <Icon name="target" />
                Tu t’en approches
              </h3>
              {approches.map(a => (
                <UneApproche key={a.key} a={a} />
              ))}
            </div>
          )}
          {/* Le quiz du jour, que la soirée ne mentionnait jamais — sur le
              téléphone d'un profil seulement : à l'écran commun, l'anonyme y
              verrait un jeu qui lui est fermé. La série, la soirée vient de
              l'allonger. */}
          {gain?.jour && (
            <div className="fin-demain">
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
            </div>
          )}
        </details>
      )}
    </div>
  )
}

/**
 * Le niveau de la fin de soirée : sa montée de ce soir, et — si le profil
 * relu, ou celui de la page, est encore à ce niveau — où il en est dans le
 * suivant. Une fin gardée, rouverte après d'autres parties, ne montre que sa
 * montée : la barre d'aujourd'hui aurait menti sur ce soir-là.
 */
function niveauDeLaSoiree(gain: Fin['profil'], relu: NiveauDeLaFin | null, profil: PublicProfile | null): NiveauDeLaFin | null {
  if (!gain) return null
  const lu = [relu, profil && { niveau: profil.niveau, acquis: profil.acquis, requis: profil.requis }].find(n => !!n && n.niveau === gain.niveauApres)
  return { niveau: gain.niveauApres, avant: gain.niveauAvant, ...(lu && { acquis: lu.acquis, requis: lu.requis }) }
}

/** Un chiffre du tableau de bord de la fin : ce qu'il compte, sans rien à toucher. */
function Chiffre({ chiffre, nom }: { chiffre: string; nom: string }) {
  return (
    <span className="admin-cadran fin-chiffre">
      <span className="admin-cadran-chiffre num">{chiffre}</span>
      <span className="admin-cadran-nom">{nom}</span>
    </span>
  )
}

/**
 * Pour le chef du salon, une ligne discrète sous les deux boutons : « Ton
 * salon », qui ouvre sa feuille — « Encore un quiz, avec eux », le même
 * salon, le même code tant qu'il vaut, une nouvelle soirée qui s'enregistre
 * de même ; et « C'était un essai » : la soirée sort de l'historique avec
 * tout ce qu'elle avait crédité. Ils tenaient un bloc entier, avec un second
 * « Retour à l'accueil » (la remarque du propriétaire du 3 octobre 2026).
 */
function GestesDuChef({ fin }: { fin: Fin }) {
  const [ouverte, setOuverte] = useState(false)
  const [effacee, setEffacee] = useState(false)
  const [busy, setBusy] = useState(false)
  const effacer = async () => {
    const ok = await confirmDialog({
      title: 'C’était un essai ?',
      message: 'La soirée sort de l’historique, et ce qu’elle a rapporté à chacun lui est repris.',
      confirmLabel: 'Ne pas la garder',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await api.archives.remove(fin.soiree.id)
      setEffacee(true)
    } catch (e) {
      showToast({ kind: 'error', message: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button type="button" className="fin-chef-ligne" onClick={() => setOuverte(true)}>
        <Icon name="home" />
        <span>
          <b>Ton salon</b>
          <span className="muted small">encore un quiz, ou c’était un essai</span>
        </span>
        <Icon name="chevron-down" className="style-chevron" />
      </button>
      {ouverte && (
        <Feuille titre="Ton salon" onFermer={() => setOuverte(false)}>
          <div className="admin-gestes">
            <a className="salon-geste admin-geste-oui" href="/salon">
              <Icon name="play" />
              Encore un quiz, avec eux
            </a>
            {!effacee && (
              <button type="button" className="salon-geste admin-geste-danger" disabled={busy} onClick={() => void effacer()}>
                <Icon name="trash" />
                C’était un essai
              </button>
            )}
          </div>
          {effacee && (
            <p className="muted small" role="status">
              La soirée n’est plus dans l’historique.
            </p>
          )}
        </Feuille>
      )}
    </>
  )
}

/**
 * La création d'un profil, préremplie avec le prénom et l'avatar du soir. La
 * marque d'homonymie (« Camille (2) ») n'est que d'affichage : elle ne se
 * recopie pas dans un prénom (invariant 17).
 */
function lienCreation(nom: string, avatar: string): string {
  const params = new URLSearchParams({ creer: '1', prenom: nom.replace(/ \(\d+\)$/, ''), avatar })
  return `/?${params}`
}

/** Un record battu, en une phrase : ce soir, et l'ancien. */
function texteDuRecord(r: RecordBattu): string {
  if (r.key === 'precision') {
    return `${pourcent(r.valeur)} de bonnes réponses${r.sur !== undefined ? `, sur ${formatNumber(r.sur)} QCM` : ''} · ton record était de ${pourcent(r.avant)}`
  }
  return `${formatNumber(r.valeur)} bonnes réponses ${r.key === 'serie' ? 'd’affilée' : 'dans la soirée'} · ton record était de ${formatNumber(r.avant)}`
}

/**
 * Un objectif qui a avancé ce soir : un légendaire, en silhouette dorée, ou
 * le prochain palier d'un haut fait de carrière — ce qu'on compte, où l'on
 * en est, ce que la soirée y a ajouté, et la jauge.
 */
function UneApproche({ a }: { a: Approche }) {
  const l = legendaire(a.key)
  const p = palierDe(a.key)
  const principal = l && hautFaitPrincipal(l)
  const h = l ? principal && hautFait(principal) : p?.hautFait
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
 * Ce que le dernier podium vient de rapporter : un instant de fête, par-dessus
 * l'écran, qui s'efface de lui-même. Un niveau gagné se fête plus fort. Les
 * trophées attendent la clôture : ils ne se décident qu'une fois tout joué
 * (invariant 10).
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
    case 'anime':
      return (
        <p className="muted">
          Tu animais la soirée
          {l.joueurs > 0 && ` · ${nJoueurs(l.joueurs)}`}
        </p>
      )
  }
}
