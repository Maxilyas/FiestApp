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
import { phraseDesConfettis } from '../../../shared/themes'
import { api } from '../api'
import { spacePath } from '../routes'
import { formatNumber, place, pourcent, pts, rang as rangEcrit } from '../format'
import { showToast } from '../state'
import { confirmDialog } from './Dialog'
import { Avatar, Dessin } from './Avatar'
import { perdus, sortesDe, useDessins } from './medaillons'
import { Flamme, Icon } from './Icon'
import { lienBilan } from './Lendemain'
import { Feuille } from './Pieces'

/**
 * La fin de soirée, sur le téléphone — allégée : l’essentiel sans défiler,
 * « Nouveau » en trois lignes, les gestes, puis « Pour la suite » replié.
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
  const ombres = fin.hautsFaits.filter(h => h.ton === 'ombre')
  const gain = fin.profil
  const approches = gain?.approches ?? []
  const nouveautes = nouveautesDe(fin)
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

  const rang = ligneDeRang(fin)
  const plus = nouveautes.slice(MONTREES)
  const xpDeLaSoiree = gain ? gain.xp - (gain.xpPaliers ?? 0) : 0
  const resumeDuPlus = [
    plus.length > 0 && `${plus.length} nouveauté${plus.length > 1 ? 's' : ''}`,
    approches.length > 0 && `${approches.length} objectif${approches.length > 1 ? 's' : ''} en vue`,
    gain?.jour && (gain.jour.aJoue ? 'le quiz de demain' : 'le quiz du jour t’attend'),
    ombres.length > 0 && `${ombres.length} coup${ombres.length > 1 ? 's' : ''} du sort`,
  ]
    .filter(Boolean)
    .join(' · ')
  const liens = !!fin.joueurId || !!profil || !!gain?.confettis
  const aPlus = liens || !!resumeDuPlus || (gain?.xpPaliers ?? 0) > 0

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
          sa place, ses points, ce qu'elle rapporte. Elle s'empilait en cinq
          cartes et deux boutons dorés — trop gros, trop de blocs (la
          remarque du propriétaire du 3 octobre 2026). */}
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
        {(rang.cas === 'rang' || xpDeLaSoiree > 0 || (gain?.confettis?.gagnes ?? 0) > 0) && (
          <div className="admin-cadrans fin-cadrans">
            {rang.cas === 'rang' && <Chiffre chiffre={rangEcrit(rang.rang)} nom={`sur ${rang.joueurs}`} />}
            {rang.cas === 'rang' && <Chiffre chiffre={formatNumber(rang.points)} nom="points" />}
            {/* L'expérience de la soirée — les paliers ont leur ligne, dans « Plus » :
                « Mes soirées » ne compte que la soirée. */}
            {/* Rien à compter, rien d'affiché : un « +0 » seul dans son cadran
                ressemblait à une panne. */}
            {xpDeLaSoiree > 0 && <Chiffre chiffre={`+${formatNumber(xpDeLaSoiree)}`} nom="XP" />}
            {(gain?.confettis?.gagnes ?? 0) > 0 && <Chiffre chiffre={`+${formatNumber(gain!.confettis!.gagnes)}`} nom="confettis" />}
          </div>
        )}
        {gain && <BarreDeNiveau avant={gain.niveauAvant} apres={gain.niveauApres} profil={profil} />}
        {gain && gain.finitions.length > 0 && (
          <p className="fin-finition">
            Nouvelle finition : <b>{gain.finitions.map(f => NOM_FINITION[f]).join(', ')}</b>
            <Avatar className="fin-apercu" avatar={fin.avatar} finition={gain.finitions[gain.finitions.length - 1]} />
          </p>
        )}
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

      {/* Ce que la soirée a rangé dans ses trophées : les trois plus beaux ;
          le reste attend dans « Plus ». */}
      <Nouveautes liste={nouveautes.slice(0, MONTREES)} collection={gain?.collection} />

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

      {/* Tout le reste, replié : le souvenir, son profil, les nouveautés
          d'après la troisième, ce qu'on approche, le quiz du jour, les coups
          du sort, les confettis. Le résumé dit ce qu'il y a dedans ; rien ne
          se perd, rien ne pousse les boutons hors de l'écran. */}
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
          {(gain?.xpPaliers ?? 0) > 0 && <p className="muted small">+{formatNumber(gain?.xpPaliers ?? 0)} XP de paliers de carrière</p>}
          {plus.length > 0 && <ul className="nouveautes">{plus.map(ligneDeNouveaute)}</ul>}
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
          {ombres.length > 0 && (
            <div className="fin-ombres">
              <Faits titre="Tes coups du sort" faits={ombres} />
              <p className="muted small">Ils comptent aussi : certains avatars légendaires ne se gagnent qu’ainsi.</p>
            </div>
          )}
        </details>
      )}
    </div>
  )
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

/** Un record battu, en une phrase : ce soir, et l'ancien. */
function texteDuRecord(r: RecordBattu): string {
  if (r.key === 'precision') {
    return `${pourcent(r.valeur)} de bonnes réponses${r.sur !== undefined ? `, sur ${formatNumber(r.sur)} QCM` : ''} · ton record était de ${pourcent(r.avant)}`
  }
  return `${formatNumber(r.valeur)} bonnes réponses ${r.key === 'serie' ? 'd’affilée' : 'dans la soirée'} · ton record était de ${formatNumber(r.avant)}`
}

/** Une nouveauté de la soirée, comme la liste la montre : un emoji, un titre, ce qu'elle est. */
interface Nouveaute {
  cle: string
  emoji: string
  titre: string
  detail: string
}

/**
 * Ce que la soirée a rangé dans ses trophées, du plus durable au plus
 * fugace : les paliers de carrière, les records, les prix, les exploits.
 * Les coups du sort n'en sont pas : ils attendent « Pour la suite ».
 */
export function nouveautesDe(fin: Fin): Nouveaute[] {
  const gain = fin.profil
  return [
    ...(gain?.paliers ?? []).map(p => ({ cle: p.key, emoji: p.emoji, titre: p.title, detail: 'Palier de carrière' })),
    ...(gain?.records ?? []).map(r => ({ cle: `record:${r.key}`, emoji: '📈', titre: 'Record battu', detail: texteDuRecord(r) })),
    ...(fin.prix ?? []).map(p => ({ cle: p.key, emoji: p.emoji, titre: p.title, detail: p.detail })),
    ...fin.hautsFaits.filter(h => h.ton === 'eclat').map(h => ({ cle: h.key, emoji: h.emoji, titre: h.title, detail: 'Haut fait de la soirée' })),
  ]
}

/** Combien « Nouveau » en montre : trois tiennent au-dessus des boutons, le reste attend dans « Plus ». */
export const MONTREES = 3

/** Une nouveauté en une ligne : son emoji, son titre, ce qu'elle est. */
function ligneDeNouveaute(x: Nouveaute) {
  return (
    <li key={x.cle}>
      <span className="nouveaute-emoji" aria-hidden="true">
        {x.emoji}
      </span>
      <span className="nouveaute-texte">
        <b>{x.titre}</b>
        <span className="muted small">{x.detail}</span>
      </span>
    </li>
  )
}

/**
 * « Nouveau » : les trois plus durables, en lignes fines sous le tableau de
 * bord. Un prix qui entre dans la collection le dit dessous : c'est la
 * première fois qui compte.
 */
function Nouveautes({ liste, collection }: { liste: Nouveaute[]; collection?: NonNullable<Fin['profil']>['collection'] }) {
  if (liste.length === 0) return null
  return (
    <section className="fin-nouveautes" aria-labelledby="fin-nouveau">
      <span className="salon-hud-label" id="fin-nouveau">
        Nouveau
      </span>
      <ul className="nouveautes">{liste.map(ligneDeNouveaute)}</ul>
      {(collection?.nouveaux.length ?? 0) > 0 && (
        <p className="collection-neuf">
          <span className="nouveau-pastille">Nouveau</span>
          {collection!.nouveaux.length > 1 ? 'Ils rejoignent' : 'Il rejoint'} ta collection : {collection!.eus} prix sur {collection!.total}
        </p>
      )}
    </section>
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
    case 'anime':
      return (
        <p className="muted">
          Tu animais la soirée
          {l.joueurs > 0 && ` · ${nJoueurs(l.joueurs)}`}
        </p>
      )
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
      <Dessin cle={cle} grand />
    </span>
  )
}
