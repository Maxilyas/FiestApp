import { useState, type ReactNode } from 'react'
import { Avatar } from './Avatar'
import { Niveau } from './Niveau'
import { NomLaure } from './Laurier'
import { Icon } from './Icon'
import { CeQuIlRemplace, ChoixDeLEclat } from './Carriere'
import { CarteJoueur } from './CarteJoueur'
import { Onglets } from './Onglets'
import { PremierHautFait } from './Trophees'
import { espacesFines } from '../format'
import { AVATARS, COLLECTION } from '../../../shared/avatars'
import { hautsFaitsGagnes } from '../../../shared/hautsfaits'
import { recompensesDe } from '../../../shared/proches'
import { LEGENDAIRES, cibleEclat, legendaire } from '../../../shared/legendaires'
import { DIVINS, divin } from '../../../shared/divins'
import { PORTRAITS, brancheDe, deLaBranche, portrait as portraitDe, portraitsOuverts, type Paliers } from '../../../shared/branches'
import { FONDS } from '../../../shared/fonds'
import { AUCUNE_GERBE, GERBES } from '../../../shared/gerbes'
import { avatarMontre, avecLEssai, type Essai } from '../../../shared/loge'
import { GerbeDeJuste } from './Gerbe'
import { cleDeMaitre, maitresDe, nomDuTitre } from '../../../shared/sentiers'
import { FINITIONS, NIVEAU_FINITION, NOM_FINITION, brilleChez, meilleureFinition, type Finition, type FinitionChoisie, type PublicProfileDetail } from '../../../shared/profil'
import type { PropsDUnePiece } from './choix'

// Les pièces de la loge (« Me changer », au profil), chacune dans son
// panneau : son avatar — portraits des branches, emojis, légendaires,
// Divins, rangés par famille — et sa finition, son titre, son fond, sa
// gerbe ; sa vitrine vit dans `Trophees`, ses thèmes dans `Boutique`.
//
// Un seul geste partout : toucher une pièce l'essaie — la carte de la loge
// la montre, rien n'est enregistré —, et « Porter », dans la barre de la
// loge, enregistre l'essai. Chaque grille dit ce qu'il porte (« porté ») et
// ce qu'il essaie (« à l'essai »). D'où vient un avatar, et comment gagner
// les autres, se lit dans « Ma collection » (`AtlasDesAvatars`).

/**
 * L'anneau des emojis de collection passe du vert au bleu à partir du
 * niveau 10 : les premiers viennent en quelques soirées, les autres en une
 * année, et la grille le dit d'un coup d'œil.
 */
export const COLLECTION_HAUTE = 10

/** Ses classes : `selected`, ce que la carte montre ; `essaye`, à l'essai ; `porte`, porté sous un essai ; `neuve`. */
function classesDeLaCase({ montre, porte, neuve }: { montre: boolean; porte: boolean; neuve?: boolean }): string {
  return (montre ? ' selected' : '') + (montre && !porte ? ' essaye' : '') + (!montre && porte ? ' porte' : '') + (neuve ? ' neuve' : '')
}

/**
 * Sa ligne telle que la salle la voit, dans les classements et la salle
 * d'attente : son visage, sa finition, son niveau. On change d'avatar
 * plus bas, et l'on se voit changer ici.
 */
export function ApercuSalle({ profil }: { profil: PublicProfileDetail }) {
  // Sa carte, telle que la salle l'ouvre en touchant son nom : il composait
  // titre, vitrine et fond sans jamais la voir.
  const [carte, setCarte] = useState(false)
  return (
    <section className="card apercu" aria-label="Ce que la salle voit">
      <span className="label">Ce que la salle voit</span>
      <div className="lb-row me apercu-ligne">
        <Avatar
          className="lb-avatar"
          avatar={profil.avatar}
          finition={profil.finition}
          eclat={brilleChez(profil, cibleEclat(profil.legendaire, profil.avatar))}
          legendaire={profil.legendaire ?? undefined}
        />
        {/* Sa ligne telle que la salle la voit : son laurier compris. */}
        <span className="lb-name">
          <NomLaure nom={profil.name} laurier={profil.laurier} />
        </span>
        <Niveau niveau={profil.niveau} />
      </div>
      <button type="button" className="btn btn-small apercu-carte" onClick={() => setCarte(true)}>
        <Icon name="eye" />
        Voir ma carte
      </button>
      {carte && <CarteJoueur adresse="/api/joueur/carte" onFermer={() => setCarte(false)} />}
    </section>
  )
}

/**
 * Les familles de la grille des avatars, dans l'ordre de leurs pastilles :
 * les légendaires — les Divins dessous —, les portraits des branches, les
 * emojis — ceux de collection dessous. Chacune mène à sa ligne de « Ma
 * collection » (`partie`), où se lit ce qui reste, et où le gagner.
 */
export type Famille = 'legendaires' | 'portraits' | 'emojis'
export const FAMILLES: readonly { id: Famille; nom: string; partie: string }[] = [
  { id: 'legendaires', nom: 'Légendaires', partie: 'legendaires' },
  { id: 'portraits', nom: 'Portraits', partie: 'savoir' },
  { id: 'emojis', nom: 'Emojis', partie: 'emojis' },
]

/**
 * La famille où la grille s'ouvre : celle de l'avatar qu'il porte — on vient
 * souvent pour en changer, et ce qu'on quitte est juste à côté.
 */
export function familleDe(profil: Pick<PublicProfileDetail, 'legendaire' | 'avatar'>): Famille {
  if (portraitDe(profil.legendaire)) return 'portraits'
  if (legendaire(profil.legendaire) || divin(profil.legendaire)) return 'legendaires'
  return 'emojis'
}

/** Ce qu'une case de la grille dit d'elle : montrée par la carte, portée, nouvelle. */
interface EtatDUneCase {
  montre: boolean
  porte: boolean
  neuve?: boolean
}

/**
 * Ses classes, celles de la maquette : `selected`, ce que la carte montre —
 * lui seul bouge (`styles.css`) ; `essaye`, à l'essai, son halo d'or ;
 * `porte`, ce qu'il porte, sa coche — montré ou non.
 */
function classesDUnAvatar({ montre, porte, neuve }: EtatDUneCase): string {
  return (montre ? ' selected' : '') + (montre && !porte ? ' essaye' : '') + (porte ? ' porte' : '') + (neuve ? ' neuve' : '')
}

/**
 * Ce qu'une case dit à l'oreille après son nom : portée, quand la carte en
 * montre une autre — montrée, `aria-pressed` le dit déjà, et « portée,
 * activé » le disait deux fois —, et nouvelle.
 */
function ceQueDitLaCase({ montre, porte, neuve }: EtatDUneCase, portee = 'porté', nouvelle = 'nouveau'): string {
  return (porte && !montre ? `, ${portee}` : '') + (neuve ? `, ${nouvelle}` : '')
}

/**
 * Combien de cadenas finissent la grille, s'il reste à gagner : sa dernière
 * rangée, ou une rangée entière quand elle tombe juste — jamais plus que ce
 * qui reste. Ils disent qu'il y en a d'autres ; où, le lien dessous le dit.
 */
export function cadenas(n: number, colonnes: number, reste: number): number {
  return reste > 0 ? Math.min(reste, colonnes - (n % colonnes)) : 0
}

/**
 * Ses avatars, dans la loge (la maquette 1 validée le 12 octobre 2026) :
 * trois pastilles — ses légendaires, ses portraits, ses emojis, chacune son
 * compte —, puis la grille de ce qu'il a. Un toucher essaie, rien d'autre :
 * la carte collée en tête le montre, la case a son halo d'or, celle qu'il
 * porte garde sa coche, et « Porter », dans la barre de la loge, le garde.
 * Trois familles en onglets à titres, l'accordéon des branches et une fiche
 * dépliée sous chaque case touchée l'avaient précédée : on lisait des titres
 * et des lignes avant de voir un avatar (« pas reprendre ce qu'on a déjà »,
 * le propriétaire, le 12 octobre 2026). Ce qui reste à gagner se lit dans
 * « Ma collection », d'où il vient et comment.
 */
export function MesAvatars(props: PropsDUnePiece) {
  const { profil } = props
  const [famille, setFamille] = useState<Famille>(() => familleDe(profil))
  const comptes = comptesDesFamilles(profil)
  return (
    <section className="loge-avatars">
      {/* Les onglets de toute l'application, en pastilles : un seul arrêt de Tab, les flèches passent à la voisine. */}
      <Onglets
        onglets={FAMILLES.map(f => ({ id: f.id, nom: f.nom, pastille: { n: comptes[f.id], label: `${comptes[f.id]} à toi` } }))}
        actif={famille}
        onChoisir={setFamille}
        label="Familles d’avatars"
        idOnglet={f => `famille-${f}`}
        idPanneau={() => 'famille-avatars'}
        className="onglets-puces"
      />
      <div className="famille-avatars" role="tabpanel" id="famille-avatars" aria-labelledby={`famille-${famille}`}>
        <FamilleDAvatars {...props} famille={famille} />
      </div>
    </section>
  )
}

/** Ce que chaque pastille compte : ce qu'il peut porter, Divins et emojis de collection compris. */
export function comptesDesFamilles(profil: PublicProfileDetail): Record<Famille, number> {
  return {
    legendaires: profil.legendaires.length + (profil.divins ?? []).length,
    portraits: portraitsOuverts(profil.sentiers ?? {}).length,
    emojis: AVATARS.length + COLLECTION.filter(c => profil.niveau >= c.niveau).length,
  }
}

/**
 * La grille d'une famille, sans état : ses cases — chacune essaie son
 * avatar —, les cadenas de ce qui reste, et le chemin de « Ma collection ».
 * Chaque case est dessinée par `Avatar`, qui fait venir son dessin : un
 * portrait, un légendaire ou un Divin, sans l'emoji dessous en attendant.
 */
export function FamilleDAvatars({ profil, essai, essayer, neufs, famille }: PropsDUnePiece & { famille: Famille }) {
  // Ce que la carte montre — l'avatar essayé, sinon celui qu'il porte — et
  // la version de chaque Éclat qu'elle montrerait.
  const montre = avatarMontre(profil, essai)
  const tenue = avecLEssai(profil, essai)
  const brille = (cle: string) => brilleChez(tenue, cle)
  const dessine = (cle: string): EtatDUneCase => ({ montre: montre.legendaire === cle, porte: profil.legendaire === cle, neuve: neufs?.has(cle) })
  const emoji = (e: string): EtatDUneCase => ({
    montre: !montre.legendaire && montre.avatar === e,
    porte: !profil.legendaire && profil.avatar === e,
    neuve: neufs?.has(e),
  })
  const laCase = (cle: string, etat: EtatDUneCase, label: string, piece: Essai, dedans: ReactNode, anneau = '') => (
    <button
      key={cle}
      type="button"
      className={'loge-case case-avatar' + anneau + classesDUnAvatar(etat)}
      aria-pressed={etat.montre}
      aria-label={label + ceQueDitLaCase(etat)}
      onClick={() => essayer(piece)}
    >
      {dedans}
    </button>
  )
  // Un médaillon dans sa case, sans finition ni emoji dessous : la finition se voit sur la carte.
  const medaillon = (cle: string, eclat = false) => <Avatar avatar="" legendaire={cle} eclat={eclat} />
  const fermes = (n: number, colonnes: number, reste: number, niveaux: readonly number[] = []) =>
    Array.from({ length: cadenas(n, colonnes, reste) }, (_, i) => (
      <span key={`ferme-${i}`} className="loge-case loge-ferme" aria-hidden="true">
        <Icon name="lock" />
        {niveaux[i] !== undefined && <span className="loge-ferme-niveau">{`niv. ${niveaux[i]}`}</span>}
      </span>
    ))
  const partie = FAMILLES.find(f => f.id === famille)!.partie
  const aGagner = (reste: number, un: string, plusieurs: string) =>
    reste > 0 && (
      <a className="loge-a-gagner" href={`#collection-${partie}`}>
        {espacesFines(`${reste} ${reste > 1 ? plusieurs : un} à gagner : où ?`)}
        <Icon name="chevron-right" />
      </a>
    )

  if (famille === 'legendaires') {
    const siens = LEGENDAIRES.filter(l => profil.legendaires.includes(l.key))
    const divins = DIVINS.filter(d => (profil.divins ?? []).some(x => x.key === d.key))
    const reste = LEGENDAIRES.length - siens.length
    return (
      <>
        {siens.length === 0 && <p className="muted small">Chacun se réveille par un exploit, en soirée, au quiz du jour ou en campagne.</p>}
        <div className="loge-grille grille-unique" role="group" aria-label="Les légendaires">
          {siens.map(l =>
            laCase(l.key, dessine(l.key), `${l.nom}, légendaire${brille(l.key) ? ', éclaté' : ''}`, { legendaire: l.key }, medaillon(l.key, brille(l.key)), ' anneau-legendaire'),
          )}
          {fermes(siens.length, 4, reste)}
        </div>
        {divins.length > 0 && (
          <>
            <p className="loge-grille-titre">
              Les Divins <span>{`${divins.length} / ${DIVINS.length}`}</span>
            </p>
            <div className="loge-grille grille-unique" role="group" aria-label="Les Divins">
              {divins.map(d => laCase(d.key, dessine(d.key), `${d.nom}, Divin`, { legendaire: d.key }, medaillon(d.key), ' anneau-divin'))}
            </div>
          </>
        )}
        {aGagner(reste, 'légendaire', 'légendaires')}
      </>
    )
  }

  if (famille === 'portraits') {
    const ouverts = portraitsOuverts(profil.sentiers ?? {})
    const siens = PORTRAITS.filter(p => ouverts.includes(p.key))
    const reste = PORTRAITS.length - siens.length
    return (
      <>
        {siens.length === 0 && (
          <p className="muted small">
            {espacesFines('Ils se gagnent sur les sentiers du savoir de la campagne : un portrait tous les deux paliers.')}{' '}
            <a className="link-inline" href="/campagne#sentiers">
              Les sentiers
            </a>
          </p>
        )}
        <div className="loge-grille grille-unique" role="group" aria-label="Les portraits des branches">
          {siens.map(p =>
            laCase(p.key, dessine(p.key), `${p.nom}, portrait ${deLaBranche(brancheDe(p))}${brille(p.key) ? ', éclaté' : ''}`, { legendaire: p.key }, medaillon(p.key, brille(p.key))),
          )}
          {fermes(siens.length, 4, reste)}
        </div>
        {aGagner(reste, 'portrait', 'portraits')}
      </>
    )
  }

  const collection = COLLECTION.filter(c => profil.niveau >= c.niveau)
  const aVenir = COLLECTION.filter(c => profil.niveau < c.niveau)
  return (
    <>
      <div className="loge-grille loge-grille-emojis grille-unique" role="group" aria-label="Les emojis">
        {AVATARS.map(a => laCase(a, emoji(a), `Avatar ${a}${brille(a) ? ', éclaté' : ''}`, { avatar: a }, <Avatar avatar={a} eclat={brille(a)} />))}
      </div>
      {/* Un à chaque niveau qui n'ouvre pas de finition, réservés aux profils : les suivants disent leur niveau. */}
      <p className="loge-grille-titre">
        De collection <span>{`${collection.length} / ${COLLECTION.length}`}</span>
      </p>
      <div className="loge-grille loge-grille-emojis grille-unique" role="group" aria-label="De collection">
        {collection.map(c =>
          laCase(
            c.emoji,
            emoji(c.emoji),
            `Avatar ${c.emoji}, de collection · niveau ${c.niveau}${brille(c.emoji) ? ', éclaté' : ''}`,
            { avatar: c.emoji },
            <Avatar avatar={c.emoji} eclat={brille(c.emoji)} />,
            c.niveau < COLLECTION_HAUTE ? ' anneau-collection' : ' anneau-collection-haut',
          ),
        )}
        {fermes(
          collection.length,
          5,
          aVenir.length,
          aVenir.map(c => c.niveau),
        )}
      </div>
      {aGagner(aVenir.length, 'emoji de collection', 'emojis de collection')}
    </>
  )
}

const nPaliers = (n: number) => `${n} palier${n > 1 ? 's' : ''}`

/**
 * Ce qu'on lit d'un portrait en le touchant : sa branche, son nom, le palier
 * de son sentier qui l'ouvre — et, s'il manque encore, combien de paliers,
 * avec le chemin du sentier. Gagné, il se porte d'ici ; porté, on revient à
 * son emoji. Sans `onPorter` — « Ma collection », qui ne fait que montrer —,
 * rien à toucher que le sentier.
 */
export function DetailPortrait({
  cle,
  paliers,
  porte,
  eclat,
  brille = eclat,
  busy,
  onPorter,
  onEclat,
}: {
  cle: string
  paliers: Paliers
  /** L'avatar dessiné qu'il porte, s'il en porte un. */
  porte: string | null
  /** Il a éclaté pour lui. */
  eclat: boolean
  /** Il en porte la version rare — sinon, il l'a éteint. */
  brille?: boolean
  busy: boolean
  onPorter?: (cle: string | null) => void
  /** Porter sa version rare, ou sa version d'origine. */
  onEclat?: (brille: boolean) => void
}) {
  const p = portraitDe(cle)
  if (!p) return null
  const b = brancheDe(p)
  const valides = paliers[b.key] ?? 0
  const gagne = valides >= p.palier
  return (
    <div className="galerie-detail detail-case">
      <span className="detail-famille muted">{`${b.nom} · ${b.categorie}`}</span>
      <b className="galerie-detail-nom">{p.nom}</b>
      {gagne ? (
        <p className="small">{`Gagné au palier ${p.palier} du sentier ${deLaBranche(b)}.`}</p>
      ) : (
        <>
          <p className="small">
            {`Se gagne au palier ${p.palier} du sentier ${deLaBranche(b)} : `}
            <b>{`encore ${nPaliers(p.palier - valides)}`}</b>, dans la campagne.
          </p>
          <a className="btn btn-small" href={`/campagne#sentier-${b.key}`}>
            Aller au sentier
          </a>
        </>
      )}
      {/* Gagné seulement : un portrait verrouillé n'a rien qui éclate. */}
      {gagne && eclat && <ChoixDeLEclat brille={brille} busy={busy} onChoisir={onEclat} />}
      {gagne && onPorter && (
        <>
          <CeQuIlRemplace porte={porte} cle={p.key} />
          <button
            type="button"
            className={'btn btn-small ' + (porte === p.key ? 'btn-ghost' : 'btn-primary')}
            aria-disabled={busy || undefined}
            onClick={() => onPorter(porte === p.key ? null : p.key)}
          >
            {porte === p.key ? 'Revenir à mon emoji' : 'Le porter'}
          </button>
        </>
      )}
    </div>
  )
}

/**
 * « N autres à gagner », sous ce qu'un écran du profil laisse choisir : ce
 * qu'on n'a pas encore vit dans sa ligne de « Ma collection », avec ce qu'il
 * faut pour l'ouvrir. Les fonds, les gerbes et les finitions à gagner se
 * montraient fermés au milieu de ceux qu'on choisit (le souhait du
 * propriétaire du 11 octobre 2026 : que le profil « ne soit pas mélangé avec
 * la collection »).
 */
export function AGagnerDansLaCollection({ reste, partie, nom }: { reste: number; partie: string; nom: string }) {
  if (reste <= 0) return null
  return (
    <a className="link-inline lien-boutique" href={`#collection-${partie}`}>
      <Icon name="award" />
      {`${reste} ${reste > 1 ? 'autres' : 'autre'} ${nom} à gagner : où et comment, dans « Ma collection »`}
    </a>
  )
}

/**
 * Sa finition, sur une rangée de pastilles (la maquette 3, que le
 * propriétaire a voulue le 12 octobre 2026) : « Auto » — la plus belle qu'il
 * a, que chaque niveau qui en ouvre une nouvelle fait porter d'office —, puis
 * celles qu'il a, chacune sa couleur ; celles qui restent à gagner, éteintes,
 * disent leur niveau et mènent à « Ma collection » — toutes : la seule
 * prochaine cachait Aurore et Constellation, ce qu'on vise au bout (« il
 * manque les finitions 15, 20, 25 », le propriétaire). Touchée, elle
 * s'essaie sur la carte de la loge. Elle se cachait derrière une ligne qui
 * se dépliait en huit grandes cases, un avatar animé dans chacune.
 */
export function MesFinitions({ profil, essai, essayer, neufs }: PropsDUnePiece) {
  const vu = avecLEssai(profil, essai)
  // Un Divin ne prend ni finition ni Éclat : la sienne se voit sous ses autres avatars.
  const divinPorte = divin(vu.legendaire)
  const montree = vu.finitionChoisie
  const plusBelle = meilleureFinition(profil.niveau)
  const aGagner = FINITIONS.filter(f => !profil.ouvertes.includes(f))
  const pastille = (cle: FinitionChoisie, nom: string, teinte: Finition, label: string) => {
    const montre = montree === cle
    const porte = profil.finitionChoisie === cle
    const neuve = cle !== 'auto' && !!neufs?.has(`finition:${cle}`)
    return (
      <button
        key={cle}
        type="button"
        className={'finition-choix' + classesDUnAvatar({ montre, porte, neuve })}
        aria-pressed={montre}
        aria-label={label + ceQueDitLaCase({ montre, porte, neuve }, 'portée', 'nouvelle')}
        onClick={() => essayer({ finition: cle })}
      >
        <i className={`finition-teinte teinte-${teinte}`} aria-hidden="true">
          {cle === 'auto' && <Icon name="sparkles" />}
        </i>
        <span aria-hidden="true">{nom}</span>
      </button>
    )
  }
  return (
    <div className="loge-finitions">
      <span className="loge-sous-titre" id="loge-finitions-titre">
        Finition
      </span>
      {divinPorte && <p className="muted small">{`${divinPorte.nom} a sa propre lumière : ta finition se voit sous tes autres avatars.`}</p>}
      <div className="loge-finitions-rangee" role="group" aria-labelledby="loge-finitions-titre">
        {pastille('auto', 'Auto', plusBelle, `Auto, toujours la plus belle : ${NOM_FINITION[plusBelle]}`)}
        {FINITIONS.filter(f => profil.ouvertes.includes(f)).map(f => pastille(f, NOM_FINITION[f], f, NOM_FINITION[f]))}
        {aGagner.map(f => (
          <a
            key={f}
            className="finition-choix finition-fermee"
            href="#collection-finitions"
            aria-label={`${NOM_FINITION[f]}, au niveau ${NIVEAU_FINITION[f]} : où et comment, dans « Ma collection »`}
          >
            <i className={`finition-teinte teinte-${f}`} aria-hidden="true" />
            <span aria-hidden="true">{`Niv. ${NIVEAU_FINITION[f]}`}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

/**
 * Son titre, sous son prénom : chaque haut fait gagné ouvre le sien — son
 * nom, « L'Oracle », « La Lanterne Rouge » —, et chaque palier de maître des
 * sentiers du savoir le sien (« Maître de la forêt »). Il s'écrit sur sa
 * carte : la salle le lit en touchant son nom. Ceux qui restent à gagner se
 * comptent, sans se nommer : trente boutons fermés noyaient les siens — sauf
 * pour qui n'en a aucun, à qui la page dit comment gagner le premier. Touché,
 * un titre s'essaie sous son prénom, sur la carte de la loge.
 */
export function MonTitre({ profil, essai, essayer, neufs }: PropsDUnePiece) {
  // Les maîtres d'abord : un sentier gravi jusqu'au bout se dit en premier ;
  // puis les titres datés des champions du mois, du plus récent au plus ancien.
  const dates = profil.titresDates ?? []
  const gagnes = [...maitresDe(profil.sentiers ?? {}).map(cleDeMaitre), ...dates, ...hautsFaitsGagnes(recompensesDe(profil.hautsFaits))]
  const aGagner = profil.hautsFaits.length - (gagnes.length - maitresDe(profil.sentiers ?? {}).length - dates.length)
  const porte = profil.titre ?? null
  const montre = essai.titre !== undefined ? essai.titre : porte
  // Ce que chaque titre dit de lui, à l'oreille comme à l'œil : porté, à l'essai, nouveau.
  const etat = (cle: string | null) => ({ montre: montre === cle, porte: porte === cle, neuve: cle !== null && neufs?.has(cle) })
  const marque = (cle: string | null) => {
    const e = etat(cle)
    const mot = e.porte ? 'porté' : e.montre ? 'à l’essai' : e.neuve ? 'nouveau' : null
    return mot && <span className="titre-etat">{mot}</span>
  }
  // Sa pièce s'appelle « Titre » : la carte dit ce qu'elle range, ceux qu'il a.
  return (
    <section className="card">
      <h3>
        <Icon name="star" />
        Mes titres {gagnes.length > 0 && <span className="muted small titre-compte">{`${gagnes.length} à toi`}</span>}
      </h3>
      {/* Où il s'écrit, la ligne de la pièce le dit ; ici, d'où viennent les autres. */}
      <p className="muted small">Chaque haut fait gagné ouvre le sien, chaque palier de maître des sentiers aussi.</p>
      <div className="titres" role="group" aria-label="Mon titre">
        <button type="button" className={'titre-choix' + classesDeLaCase(etat(null))} aria-pressed={montre === null} onClick={() => essayer({ titre: null })}>
          Aucun
          {marque(null)}
        </button>
        {gagnes.map(cle => (
          <button key={cle} type="button" className={'titre-choix' + classesDeLaCase(etat(cle))} aria-pressed={montre === cle} onClick={() => essayer({ titre: cle })}>
            {nomDuTitre(cle)}
            {marque(cle)}
          </button>
        ))}
        {aGagner > 0 && (
          <span className="titre-choix ferme">
            <Icon name="lock" />
            {gagnes.length === 0 ? `${aGagner} titres à gagner` : `et ${aGagner} autre${aGagner > 1 ? 's' : ''} à gagner`}
          </span>
        )}
      </div>
      {gagnes.length === 0 && <PremierHautFait profil={profil} />}
    </section>
  )
}

/**
 * Le fond de sa carte : ce qu'on voit derrière elle quand quelqu'un touche
 * son nom. Rien d'autre ne change — ni l'écran commun, ni les classements.
 * Ceux qu'il a seulement ; ceux qui restent à gagner se voient dans sa
 * collection, avec ce qu'il faut pour les ouvrir. Touché, un fond s'essaie
 * derrière la carte de la loge.
 */
export function MonFond({ profil, essai, essayer, neufs }: PropsDUnePiece) {
  if (!profil.fonds) return null
  const porte = profil.fond ?? null
  const montre = essai.fond !== undefined ? essai.fond : porte
  const reste = FONDS.filter(f => !profil.fonds!.includes(f.key)).length
  const etat = (cle: string | null, sinon: string) => (porte === cle ? 'porté' : montre === cle ? 'à l’essai' : cle && neufs?.has(cle) ? 'nouveau' : sinon)
  return (
    <section className="card">
      <h3>
        <Icon name="image" />
        {/* Compté comme sa ligne de la collection : le Velours, à tout le monde, n'en est pas. */}
        Mes fonds {profil.fonds.length > 0 && <span className="muted small titre-compte">{`${profil.fonds.length} à toi`}</span>}
      </h3>
      <p className="muted small">Touches-en un : ta carte, en haut, l’essaie aussitôt.</p>
      <div className="finitions fonds-choix">
        <button type="button" className={'finition-btn' + classesDeLaCase({ montre: !montre, porte: !porte })} aria-pressed={!montre} onClick={() => essayer({ fond: null })}>
          <span className="fond-apercu" aria-hidden="true" />
          <span className="finition-nom">Velours</span>
          <span className="muted small">{etat(null, 'd’office')}</span>
        </button>
        {FONDS.filter(f => profil.fonds!.includes(f.key)).map(f => (
          <button
            key={f.key}
            type="button"
            className={'finition-btn' + classesDeLaCase({ montre: montre === f.key, porte: porte === f.key, neuve: neufs?.has(f.key) })}
            aria-pressed={montre === f.key}
            onClick={() => essayer({ fond: f.key })}
          >
            <span className={`fond-apercu carte-fond fond-${f.key}`} aria-hidden="true" />
            <span className="finition-nom">{f.nom}</span>
            <span className="muted small">{etat(f.key, 'ouvert')}</span>
          </button>
        ))}
      </div>
      <AGagnerDansLaCollection reste={reste} partie="fonds" nom={reste > 1 ? 'fonds' : 'fond'} />
    </section>
  )
}

/**
 * Sa gerbe : ce qui éclate sur son téléphone à une bonne réponse, en soirée,
 * au quiz du jour et en campagne. Pour lui seul — ni la salle ni l'écran
 * commun n'en voient rien. Les confettis d'office, et « Aucune » pour qui
 * n'en veut pas ; celles qu'il a éclatent au toucher, et s'essaient.
 * Celles qui restent à gagner éclatent dans sa collection, pour qu'on sache
 * ce qu'on vise (`GerbesDeLaCollection`).
 */
export function MaGerbe({ profil, essai, essayer, neufs }: PropsDUnePiece) {
  // L'aperçu : la gerbe qu'on vient de toucher éclate, une fois par toucher.
  const [apercu, setApercu] = useState<{ cle: string; n: number } | null>(null)
  if (!profil.gerbes) return null
  // La gerbe portée se lit résolue : null, il n'en veut aucune.
  const porte = profil.gerbe ?? null
  const montre = essai.gerbe !== undefined ? (essai.gerbe === AUCUNE_GERBE ? null : essai.gerbe) : porte
  const montrer = (cle: string) => setApercu(a => ({ cle, n: (a?.n ?? 0) + 1 }))
  const reste = GERBES.filter(g => !profil.gerbes!.includes(g.key)).length
  const etat = (cle: string | null, sinon: string) => (porte === cle ? 'portée' : montre === cle ? 'à l’essai' : cle && neufs?.has(cle) ? 'nouvelle' : sinon)
  return (
    <section className="card">
      <h3>
        <Icon name="zap" />
        Mes gerbes <span className="muted small titre-compte">{`${profil.gerbes.length} à toi`}</span>
      </h3>
      <p className="muted small">En soirée, au quiz du jour et en campagne. Touches-en une : elle éclate, et tu l’essaies.</p>
      <div className="finitions gerbes-choix">
        <button type="button" className={'finition-btn' + classesDeLaCase({ montre: !montre, porte: !porte })} aria-pressed={!montre} onClick={() => essayer({ gerbe: AUCUNE_GERBE })}>
          <span className="gerbe-apercu" aria-hidden="true" />
          <span className="finition-nom">Aucune</span>
          <span className="muted small">{etat(null, 'sobre')}</span>
        </button>
        {GERBES.filter(g => profil.gerbes!.includes(g.key)).map(g => (
          <button
            key={g.key}
            type="button"
            className={'finition-btn' + classesDeLaCase({ montre: montre === g.key, porte: porte === g.key, neuve: neufs?.has(g.key) })}
            aria-pressed={montre === g.key}
            onClick={() => {
              montrer(g.key)
              essayer({ gerbe: g.key })
            }}
          >
            <span className="gerbe-apercu" aria-hidden="true">
              {g.particules.slice(0, 3).join('')}
            </span>
            <span className="finition-nom">{g.nom}</span>
            <span className="muted small">{etat(g.key, 'ouverte')}</span>
          </button>
        ))}
      </div>
      <AGagnerDansLaCollection reste={reste} partie="gerbes" nom={reste > 1 ? 'gerbes' : 'gerbe'} />
      {apercu && <GerbeDeJuste key={apercu.n} cle={apercu.cle} />}
    </section>
  )
}
