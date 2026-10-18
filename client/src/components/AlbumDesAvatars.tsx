import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { Avatar } from './Avatar'
import { Icon, type IconName } from './Icon'
import { Legendaire } from './Legendaire'
import { Divin } from './Divin'
import { ChoixDeLEclat } from './Carriere'
import { EtapeDuChemin } from './LigneDeCollection'
import { Gemmes } from './Gemmes'
import { useFiche } from './Boutique'
import { dessinDuCompagnon, dessinDuPortrait, useDessins } from './medaillons'
import { espacesFines } from '../format'
import { gemmeDAvatar } from '../gemmes'
import {
  NOM_COURT_DE_RARETE_D_AVATAR,
  NOM_DE_RARETE_D_AVATAR,
  RARETES_D_AVATAR,
  ouIlSeGagne,
  pagesDeLAlbum,
  voiesDeLAvatar,
  type AvatarDeLAlbum,
  type EtapeDUneVoie,
  type LieuDAvatar,
  type PageDeLAlbum,
  type RareteDAvatar,
} from '../../../shared/album'
import { BRANCHES, brancheDe, portrait } from '../../../shared/branches'
import { COLLECTION } from '../../../shared/avatars'
import { legendaire } from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import { NOM_DE_LA_FORME, compagnonDe, formeDeCompagnon } from '../../../shared/compagnons'
import { brilleChez, type PublicProfileDetail } from '../../../shared/profil'

// L'album « Mes avatars », dans « Ma collection » (la maquette 1, choisie le
// 13 octobre 2026) : tous les avatars qui se gagnent, une page par rareté —
// des gemmes, comme les thèmes de la boutique —, ce qu'on a en couleur, ce
// qui reste en silhouette dorée, une pastille qui dit où il se gagne. Le
// toucher ouvre sa fiche sous sa rangée : comment l'obtenir, voie par voie,
// où l'on en est, et le chemin de l'écran où le gagner. Trois lignes —
// le savoir en atlas, les légendaires et les Divins, les emojis — rendaient
// les gens « confus » : on ne savait ni ce que valait un portrait, ni où
// chercher le suivant (la règle : `shared/album.ts`).
//
// On n'y porte rien : ce qui est à lui se porte dans la loge (« Mon avatar »).

const SORTES = BRANCHES.map(b => `branche:${b.key}` as const)

/** Ce que range chaque page, sous ses gemmes. */
const CE_QU_ELLE_RANGE: Record<RareteDAvatar, string> = {
  commune: 'Le visage de chaque sentier du savoir, chaque compagnon tel qu’on l’achète, et les emojis des premiers niveaux.',
  peucommune: 'Le deuxième portrait de chaque sentier, et les emojis des niveaux suivants.',
  rare: 'Les troisième et quatrième portraits de chaque sentier, et chaque compagnon à sa deuxième forme.',
  epique: 'Le cinquième portrait de chaque sentier, celui qui sort de son cadre, et chaque compagnon à sa troisième forme.',
  legendaire: 'Les légendaires des hauts faits, la forme ultime de chaque sentier et celle de chaque compagnon.',
  divin: 'Ils ne disent pas comment.',
}

const ICONE_DU_LIEU: Record<LieuDAvatar, IconName> = {
  soiree: 'sparkles',
  jour: 'sun',
  campagne: 'target',
  sentiers: 'mountain',
  niveau: 'star',
  saison: 'calendar',
  boutique: 'bag',
  niche: 'paw',
  expedition: 'flag',
}

/** La légende des pastilles, sous la grille : un emoji dit son niveau en toutes lettres, il n'y est pas. */
const LEGENDE_DU_LIEU: Partial<Record<LieuDAvatar, string>> = {
  soiree: 'en soirée',
  jour: 'au quiz du jour',
  campagne: 'en campagne',
  sentiers: 'sur les sentiers',
  saison: 'à sa saison',
  boutique: 'en boutique',
  expedition: 'en expédition',
}

/** Le nom d'un avatar de l'album, tel que sa case et sa fiche le disent. */
function nomDe(a: AvatarDeLAlbum): string {
  if (a.sorte === 'emoji') return `Avatar ${a.cle}`
  return legendaire(a.cle)?.nom ?? portrait(a.cle)?.nom ?? formeDeCompagnon(a.cle)?.nom ?? divin(a.cle)?.nom ?? a.cle
}

/**
 * Ce que sa case dit à l'oreille : son nom et sa rareté, à lui ou à gagner,
 * et où. Un Divin pas encore descendu ne dit rien de lui, pas même son nom
 * (invariant 21).
 */
function ceQueDitLaCase(a: AvatarDeLAlbum, aLui: boolean, porte: boolean): string {
  if (a.sorte === 'divin' && !aLui) return 'Un Divin, inconnu'
  const rarete = NOM_DE_RARETE_D_AVATAR[a.rarete].toLowerCase()
  if (aLui) return `${nomDe(a)}, ${rarete}${porte ? ', porté' : ', à toi'}`
  return `${nomDe(a)}, ${rarete}, à gagner ${ouIlSeGagne(a)}`
}

/**
 * Où aller le gagner : l'écran de la première étape qui reste, s'il en a un.
 * Une soirée n'a pas d'écran — on la rejoint par son code —, un niveau non
 * plus : il vient de tout ce qu'on joue ; ni une saison, qui ne compte que
 * ses jours : « Jouer le quiz du jour » en juin ne la rapprocherait de rien.
 * Un compagnon à acheter mène à la boutique ; acheté, il grandit en le
 * portant — partout : rien à ouvrir de plus que « Mon avatar », que sa fiche
 * cite déjà.
 */
function ouAller(cle: string, voies: EtapeDUneVoie[][]): { nom: string; href: string } | null {
  for (const e of voies.flat()) {
    if (e.tenue) continue
    if (e.lieu === 'jour') return { nom: 'Jouer le quiz du jour', href: '/jour' }
    if (e.lieu === 'campagne') return { nom: 'Aller à la campagne', href: '/campagne' }
    if (e.lieu === 'sentiers') return { nom: 'Aller au sentier', href: `/campagne#sentier-${portrait(cle)?.branche ?? ''}` }
    if (e.lieu === 'expedition') return { nom: 'Partir en expédition', href: '/expedition' }
    if (e.lieu === 'boutique') {
      // La vitrine s'ouvre sur lui : les deux autres se font glisser.
      const f = formeDeCompagnon(cle)
      return { nom: 'Aller à la boutique', href: f ? `/boutique#compagnon-${f.compagnon}` : '/boutique#compagnons' }
    }
  }
  return null
}

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Les six gemmes, une par page, chacune son compte. */
function GemmesDeLAlbum({ pages, choisie, onChoisir }: { pages: PageDeLAlbum[]; choisie: RareteDAvatar; onChoisir: (r: RareteDAvatar) => void }) {
  return (
    <Gemmes
      gemmes={pages.map(p => ({
        id: p.rarete,
        court: NOM_COURT_DE_RARETE_D_AVATAR[p.rarete],
        label: `${NOM_DE_RARETE_D_AVATAR[p.rarete]}, ${p.acquis} sur ${p.total}`,
        compte: `${p.acquis}/${p.total}`,
        style: gemmeDAvatar(p.rarete),
        divin: p.rarete === 'divin',
      }))}
      choisie={choisie}
      onChoisir={onChoisir}
      label="Les raretés"
      idDe={r => `gemme-${r}`}
      panneau="album-page"
      className="gemmes-album"
    />
  )
}

/** Une étape d'une voie : son lieu en icône, ce qu'il faut, sa règle, et — à gagner — où il en est. */
const Etape = ({ etape: e, jauge }: { etape: EtapeDUneVoie; jauge: boolean }) => (
  <EtapeDuChemin icone={ICONE_DU_LIEU[e.lieu]} titre={e.titre} regle={e.regle} tenue={e.tenue} progres={jauge ? e.progres : null} />
)

/**
 * La fiche d'un avatar, sous sa rangée (la maquette de la fiche) : en grand,
 * son nom, sa gemme, ce qu'il raconte ; puis comment l'obtenir — ses voies,
 * dont une suffit, chacune ses étapes, toutes demandées —, où il en est, et
 * le chemin de l'écran où le gagner. À lui, elle dit qu'il l'a et où le
 * porter. Rien ne s'y porte. Un Divin n'y dit que son récit, à qui l'a vu
 * descendre — et rien à qui l'attend (invariant 21).
 */
export function FicheDeLAvatar({ a, aLui, porte, profil, dessin }: { a: AvatarDeLAlbum; aLui: boolean; porte: boolean; profil: PublicProfileDetail; dessin: ReactNode }) {
  const voies = voiesDeLAvatar(a.cle, profil)
  const l = legendaire(a.cle)
  const p = portrait(a.cle)
  const f = formeDeCompagnon(a.cle)
  const recit = a.sorte === 'divin' ? (profil.divins ?? []).find(d => d.key === a.cle) : undefined
  const inconnu = a.sorte === 'divin' && !recit
  const aller = aLui ? null : ouAller(a.cle, voies)
  // Un Divin descendu n'éclate jamais ; un compagnon n'a pas encore de
  // version rare à choisir — ses paillettes la disent ; les autres, s'il est
  // tombé sur eux.
  const eclate = aLui && a.sorte !== 'divin' && a.sorte !== 'compagnon' && profil.eclats.includes(a.cle)
  return (
    <div className="galerie-detail detail-case album-detail" style={gemmeDAvatar(a.rarete)}>
      <div className="album-detail-tete">
        {/* Muet : son nom et son état, la fiche les dit juste dessous. */}
        {dessin && (
          <span className="album-detail-dessin" aria-hidden="true">
            {dessin}
          </span>
        )}
        <span className="album-detail-titre">
          <b className="galerie-detail-nom">{inconnu ? '?' : a.sorte === 'emoji' ? 'Emoji de collection' : nomDe(a)}</b>
          <span className={'album-detail-rarete' + (a.rarete === 'divin' ? ' gemme-divin' : '')}>
            <i aria-hidden="true" />
            {NOM_DE_RARETE_D_AVATAR[a.rarete]}
          </span>
        </span>
      </div>
      {l && <p className="serif-note">{espacesFines(`« ${l.legende} »`)}</p>}
      {p && <p className="muted small">{`${brancheDe(p).nom} · ${brancheDe(p).categorie}`}</p>}
      {f && (
        <>
          <p className="serif-note">{f.legende}</p>
          <p className="muted small">{`${compagnonDe(f).nom} · ${NOM_DE_LA_FORME[f.rang]}`}</p>
        </>
      )}
      {a.sorte === 'emoji' && <p className="muted small">Réservé aux profils : l’inscription ne le propose pas.</p>}
      {recit && <p className="serif-note">{recit.legende}</p>}
      {inconnu && <p className="serif-note">Personne ne sait ce qui le fait descendre. Ceux qui l’ont vu ne le cherchaient pas.</p>}
      {aLui && (
        <p className="small album-a-toi">
          <Icon name="check" />
          <span>
            {porte ? 'À toi, et tu le portes. On en change dans ' : 'À toi. Il se porte dans '}
            {/* Les espaces fines tiennent les guillemets au nom : « restait seul en bout de ligne. */}
            <a className="link-inline" href="#avatar">
              {espacesFines('« Mon avatar »')}
            </a>
            .
          </span>
        </p>
      )}
      {/* « Essayer », comme sous « À porter » à la fin d'une partie et dans le style : la loge s'ouvre, lui sur la carte. */}
      {aLui && !porte && (
        <a className="btn btn-small album-essayer" href={`?essayer=${encodeURIComponent(a.cle)}#avatar`}>
          Essayer
        </a>
      )}
      {eclate && <ChoixDeLEclat brille={brilleChez(profil, a.cle)} busy={false} />}
      {voies.length > 0 && (
        <>
          <span className="label album-etiquette">{aLui ? 'Comment il se gagne' : 'Comment l’obtenir'}</span>
          <ul className="album-voies">
            {voies.map((v, i) => (
              <li key={i}>
                {/* L'une ou l'autre voie suffit ; dans une voie, toutes les étapes. Les mots se lisent aussi à l'oreille. */}
                {i > 0 && <span className="album-ou">ou</span>}
                <div className="album-voie">
                  {v.map((e, j) => (
                    <Fragment key={j}>
                      {j > 0 && <span className="album-et">et</span>}
                      <Etape etape={e} jauge={!aLui} />
                    </Fragment>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {aller && (
        <a className="btn btn-small album-aller" href={aller.href}>
          {aller.nom}
        </a>
      )}
    </div>
  )
}

/**
 * L'album : les gemmes, ce que range la page, sa grille, et sous la grille
 * la légende de ses pastilles. `page`, celle qu'une adresse demande
 * (`#collection-avatars-legendaire`) ; sinon celle de ce qu'il porte.
 * `onPage` écrit la page choisie dans l'adresse : revenu d'un écran qu'elle a
 * ouvert, on la retrouve.
 */
export function AlbumDesAvatars({ profil, page, onPage }: { profil: PublicProfileDetail; page: RareteDAvatar; onPage: (r: RareteDAvatar) => void }) {
  const pages = pagesDeLAlbum(profil)
  const [ouvert, setOuvert] = useState<string | null>(null)
  // Une autre page demandée par l'adresse, l'album déjà là : sa fiche se referme.
  useEffect(() => setOuvert(null), [page])
  const porte = profil.legendaire ?? profil.avatar
  const detail = useFiche(ouvert, porte)
  const dessins = useDessins(...SORTES, 'legendaire', 'divin', 'compagnon')
  const { Portrait, Compagnon } = dessins
  const brille = (k: string) => brilleChez(profil, k)
  const choisie = pages.find(p => p.rarete === page) ?? pages[0]
  const choisir = (r: RareteDAvatar) => {
    setOuvert(null)
    onPage(r)
  }
  const toucher = (k: string) => setOuvert(o => (o === k ? null : k))

  /** Son dessin : en couleur s'il est à lui — éclaté s'il a éclaté —, en silhouette sinon ; en grand dans sa fiche. */
  const dessin = (a: AvatarDeLAlbum, aLui: boolean, grand = false): ReactNode => {
    if (a.sorte === 'legendaire') return <Legendaire cle={a.cle} verrouille={!aLui} eclat={aLui && brille(a.cle)} grand={grand} />
    if (a.sorte === 'divin') return <Divin cle={a.cle} verrouille={!aLui} grand={grand} />
    if (a.sorte === 'portrait') {
      return Portrait && dessinDuPortrait(dessins, a.cle) ? <Portrait cle={a.cle} verrouille={!aLui} eclat={aLui && brille(a.cle)} grand={grand} /> : <span className="pt" aria-hidden="true" />
    }
    if (a.sorte === 'compagnon') {
      return Compagnon && dessinDuCompagnon(dessins, a.cle) ? <Compagnon cle={a.cle} verrouille={!aLui} grand={grand} /> : <span className="pt" aria-hidden="true" />
    }
    return aLui ? <Avatar avatar={a.cle} eclat={brille(a.cle)} /> : <span className="silhouette">{a.cle}</span>
  }
  // La légende : les lieux des pastilles de la page, s'il en reste.
  const lieux = [...new Set(choisie.avatars.filter(x => !x.aLui).flatMap(x => x.avatar.lieux.slice(0, 1)))].filter(x => LEGENDE_DU_LIEU[x])

  return (
    <div className="album">
      <GemmesDeLAlbum pages={pages} choisie={choisie.rarete} onChoisir={choisir} />
      <p className="gemme-legende" style={gemmeDAvatar(choisie.rarete)}>
        <b>{`${NOM_DE_RARETE_D_AVATAR[choisie.rarete]} · ${choisie.acquis} sur ${choisie.total}.`}</b> {CE_QU_ELLE_RANGE[choisie.rarete]}
      </p>
      <div className="album-avatars" role="tabpanel" id="album-page" aria-labelledby={`gemme-${choisie.rarete}`} style={gemmeDAvatar(choisie.rarete)}>
        {choisie.avatars.map(({ avatar: a, aLui }) => {
          const lePorte = aLui && porte === a.cle
          // Un emoji qui reste dit son niveau sur son anneau, en toutes lettres : une icône de plus ne le dirait pas.
          const niveau = a.sorte === 'emoji' && !aLui ? COLLECTION.find(c => c.emoji === a.cle)?.niveau : undefined
          return (
            <Fragment key={a.cle}>
              <button
                type="button"
                className={'album-case' + (aLui ? '' : ' album-manque') + (a.sorte === 'emoji' ? ' album-emoji' : '')}
                aria-expanded={ouvert === a.cle}
                aria-controls={ouvert === a.cle ? 'fiche-avatar' : undefined}
                aria-label={ceQueDitLaCase(a, aLui, lePorte)}
                onClick={() => toucher(a.cle)}
              >
                <span className="album-medaillon" aria-hidden="true">
                  {dessin(a, aLui)}
                </span>
                {lePorte && (
                  <span className="album-coche" aria-hidden="true">
                    <Icon name="check" />
                  </span>
                )}
                {niveau !== undefined ? (
                  <span className="case-niveau" aria-hidden="true">{`niv. ${niveau}`}</span>
                ) : (
                  !aLui &&
                  a.lieux.length > 0 && (
                    <span className="album-lieu" aria-hidden="true">
                      <Icon name={ICONE_DU_LIEU[a.lieux[0]]} />
                    </span>
                  )
                )}
              </button>
              {ouvert === a.cle && (
                <div id="fiche-avatar" className="fiche-case album-fiche" ref={detail}>
                  <FicheDeLAvatar a={a} aLui={aLui} porte={lePorte} profil={profil} dessin={dessin(a, aLui, true)} />
                </div>
              )}
            </Fragment>
          )
        })}
      </div>
      {lieux.length > 0 && (
        <p className="album-legende muted small">
          {lieux.map(x => (
            <span key={x}>
              <Icon name={ICONE_DU_LIEU[x]} />
              {LEGENDE_DU_LIEU[x]}
            </span>
          ))}
        </p>
      )}
      <p className="muted small">
        {choisie.rarete === 'divin'
          ? 'Ceux qui ne sont pas descendus restent voilés.'
          : espacesFines('En couleur, ceux qui sont à toi ; en silhouette dorée, ceux qui restent. Touche-les : comment les obtenir.')}
      </p>
    </div>
  )
}

/** La page qu'une adresse nomme (`#collection-avatars-legendaire`), ou null. */
export function pageNommee(mot: string): RareteDAvatar | null {
  return RARETES_D_AVATAR.find(r => r === mot) ?? null
}
