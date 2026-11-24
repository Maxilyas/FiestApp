import { Fragment, createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Avatar } from './Avatar'
import { Icon, type IconName } from './Icon'
import { Legendaire } from './Legendaire'
import { Divin } from './Divin'
import { ChoixDeLEclat } from './Carriere'
import { EtapeDuChemin } from './LigneDeCollection'
import { Gemmes } from './Gemmes'
import { useFiche } from './Boutique'
import { dessinDuCompagnon, dessinDuPortrait, useDessins } from './medaillons'
import { deNom, espacesFines } from '../format'
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
import { estScellable, legendaire } from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import { compagnonDe, formeDeCompagnon, nomDeLaForme } from '../../../shared/compagnons'
import { aLEclat, brilleChez, eclatChez, type PublicProfileDetail } from '../../../shared/profil'
import type { PhraseDuSphinx, SphinxOuvert } from '../../../shared/sphinx'
import { api, motifDe } from '../api'
import { lirePourLAlbum, type PourLAlbum } from '../sphinx'
import {
  CompteDeLaPhrase,
  ConseilDuSphinx,
  InscrireUnMot,
  PhraseDuDivin,
  QuiADesMotsDeLaPhrase,
  placesDevoilees,
  type IssueDUneInscription,
} from './PhraseDuDivin'
import { confirmDialog } from './Dialog'
import { aLaDemande, useALaDemande } from '../aLaDemande'

/** La carte d'un joueur, au toucher de son nom dans « Ils ont des mots » : rien ne la télécharge avant. */
const laCarteDUnJoueur = aLaDemande(() => import('./CarteJoueur'))

/**
 * La carte de qui a des mots, touché dans la liste — ses gestes au pied :
 * l'ajouter à ses amis, le défier. `useCarteDUnProfil` le fait ailleurs, mais
 * il importe l'état de la page (`state.ts`), qui lit sa fenêtre en se
 * chargeant : l'album se rend aussi dans Node (`grille-avatars.test.ts`).
 * Une carte qui ne vient pas se referme, sans plus.
 */
function useCarteDeQuiADesMots(): { ouvrir: (profileId: string) => void; carte: ReactNode } {
  const [qui, setQui] = useState<string | null>(null)
  const module = useALaDemande(laCarteDUnJoueur, !!qui)
  useEffect(() => {
    if (qui && module === 'perdu') setQui(null)
  }, [qui, module])
  return {
    ouvrir: setQui,
    carte:
      qui && module && module !== 'perdu' ? (
        <module.CarteJoueur key={qui} adresse={`/api/joueur/carte/${encodeURIComponent(qui)}`} gestes={{ profileId: qui }} onFermer={() => setQui(null)} />
      ) : null,
  }
}

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
  commune: 'Le visage de chaque sentier du savoir, chaque compagnon à sa première forme, et les emojis des premiers niveaux.',
  peucommune: 'Le deuxième portrait de chaque sentier, et les emojis des niveaux suivants.',
  rare: 'Les troisième et quatrième portraits de chaque sentier, et chaque compagnon à sa deuxième forme.',
  epique: 'Le cinquième portrait de chaque sentier, celui qui sort de son cadre, et chaque compagnon à sa troisième forme.',
  legendaire: 'Les légendaires des hauts faits, la forme ultime de chaque sentier, celle de chaque compagnon et sa métamorphose.',
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
  eclat: 'spark',
  expedition: 'flag',
  // L'arche du gros bouton de l'accueil : le même lieu, la même icône.
  cabinet: 'landmark',
  // La rosette : le flot qu'on remporte avec lui.
  'grand-prix': 'award',
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
  cabinet: 'au Cabinet',
}

/** Le nom d'un avatar de l'album, tel que sa case et sa fiche le disent. */
function nomDe(a: AvatarDeLAlbum): string {
  if (a.sorte === 'emoji') return `Avatar ${a.cle}`
  return legendaire(a.cle)?.nom ?? portrait(a.cle)?.nom ?? formeDeCompagnon(a.cle)?.nom ?? divin(a.cle)?.nom ?? a.cle
}

/**
 * Ce que sa case dit à l'oreille : son nom et sa rareté, à lui ou à gagner,
 * et où. Un Divin pas encore descendu dit son nom, et rien d'autre — ni où,
 * ni comment (invariant 21). Jusqu'au 22 novembre 2026, pas même son nom :
 * dix-huit voiles anonymes, et rien à désirer tant que personne n'en tenait
 * un. Le propriétaire : « J'aime bien que le nom donne un indice justement. »
 */
function ceQueDitLaCase(a: AvatarDeLAlbum, aLui: boolean, porte: boolean, cabinet: boolean | undefined): string {
  if (a.sorte === 'divin' && !aLui) return `${nomDe(a)}, divin, pas encore descendu`
  const rarete = NOM_DE_RARETE_D_AVATAR[a.rarete].toLowerCase()
  if (aLui) return `${nomDe(a)}, ${rarete}${porte ? ', porté' : ', à toi'}`
  return `${nomDe(a)}, ${rarete}, à gagner ${ouIlSeGagne(a, cabinet)}`
}

/**
 * Où aller le gagner : l'écran de la première étape qui reste, s'il en a un.
 * Une soirée n'a pas d'écran — on la rejoint par son code —, un niveau non
 * plus : il vient de tout ce qu'on joue ; ni une saison, qui ne compte que
 * ses jours : « Jouer le quiz du jour » en juin ne la rapprocherait de rien.
 * Un compagnon à acheter mène à la boutique ; acheté, il grandit en le
 * portant — partout : rien à ouvrir de plus que « Mon avatar », que sa fiche
 * cite déjà. Un gardien du Cabinet mène au Cabinet, sa traversée : il menait à
 * la salle qu'il gardait (`#salle-rempart`), que la page n'a plus depuis le
 * soir du 31 octobre 2026. Une étape en expédition n'a plus d'écran : la page
 * de l'Expédition est partie avec son code, et l'étape se passe comme une
 * soirée — la voie qui suit, s'il en reste une, garde son chemin.
 */
function ouAller(cle: string, voies: EtapeDUneVoie[][]): { nom: string; href: string } | null {
  for (const e of voies.flat()) {
    if (e.tenue) continue
    if (e.lieu === 'jour') return { nom: 'Jouer le quiz du jour', href: '/jour' }
    if (e.lieu === 'campagne') return { nom: 'Aller à la campagne', href: '/campagne' }
    if (e.lieu === 'sentiers') return { nom: 'Aller au sentier', href: `/campagne#sentier-${portrait(cle)?.branche ?? ''}` }
    if (e.lieu === 'cabinet') return { nom: 'Aller au Cabinet', href: '/cabinet' }
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

/**
 * Ce que le Sphinx dit des Divins, lu quand la page des Divins s'ouvre — la
 * phrase du Divin du moment, celles reconstituées —, et ce que la visite a
 * laissé en y menant (`venu` : la fiche à ouvrir, le mot à y retourner).
 * Passé aux fiches par un contexte : leur appel reste celui de toujours.
 */
const LeSphinxDeLAlbum = createContext<{
  sphinx: SphinxOuvert
  venu: PourLAlbum | null
  /** « La phrase est retrouvée : la lire », confirmé : la phrase entière arrive, ses mots se retournent. */
  devoiler: (cle: string) => void
  /** La phrase qu'il vient de choisir de lire, et les places qui s'y retournent. */
  devoilee: { cle: string; places: number[] } | null
  /** Le geste refusé — la page fermée entre-temps, le réseau —, dit sous lui. */
  refus: { cle: string; motif: string } | null
  /** Un mot qu'on lui a dit, inscrit sur un trait de la phrase d'un Divin : juste, la phrase d'après remplace celle d'avant. */
  inscrire: (cle: string, place: number, mot: string) => Promise<IssueDUneInscription>
  /** Le dernier mot qu'il a inscrit juste, qui se retourne dans sa phrase. */
  inscrit: { cle: string; place: number } | null
  /** La carte d'un de ceux qui ont des mots, touché dans la liste. */
  ouvrirLaCarte: (profileId: string) => void
} | null>(null)

/**
 * Ce que le Sphinx dit d'un Divin, dans sa fiche (le plan du 24 novembre 2026) :
 * du Divin du moment, sa phrase — ses mots, ses traits, le compte de tous et
 * sa jauge — à tout profil, habitué ou non, et à qui ne l'est pas comment le
 * devenir ; d'une phrase que tous ont reconstituée, la phrase entière, sous
 * son voile — s'il l'a choisie (la décision du 24 novembre 2026 : elle ne
 * s'impose plus) ; sinon ses mots en or, la forme du reste, le compte, et
 * « La phrase est retrouvée : la lire ». Rien d'autre : ni règle, ni mot qu'il
 * n'a pas (invariant 21).
 */
function SaPhrase({
  cle,
  sphinx,
  retourne,
  devoiler,
  devoilee,
  refus,
  inscrire,
  inscrit,
  ouvrirLaCarte,
}: {
  cle: string
  sphinx: SphinxOuvert
  retourne?: number
  devoiler?: (cle: string) => void
  devoilee?: { cle: string; places: number[] } | null
  refus?: { cle: string; motif: string } | null
  inscrire?: (cle: string, place: number, mot: string) => Promise<IssueDUneInscription>
  inscrit?: { cle: string; place: number } | null
  ouvrirLaCarte?: (profileId: string) => void
}) {
  // Le trait qu'il a touché pour y inscrire un mot qu'on lui a dit ; juste, le champ s'en va et le mot se retourne.
  const [choisie, setChoisie] = useState<number | null>(null)
  // Le mot qu'il vient d'inscrire se retourne, comme un mot gagné ; sinon celui que la visite vient de lui souffler.
  const tourne = inscrit?.cle === cle ? inscrit.place : retourne
  /** Sa phrase, ses traits à toucher s'il en reste, le champ du trait touché, et à qui demander. */
  const phraseAInscrire = (phrase: PhraseDuSphinx) => {
    const ouverte = choisie !== null && phrase.mots[choisie]?.texte === undefined ? choisie : null
    return (
      <>
        <PhraseDuDivin phrase={phrase} retourne={tourne} onInscrire={inscrire && (p => setChoisie(c => (c === p ? null : p)))} choisie={ouverte} />
        {inscrire && ouverte !== null && (
          <InscrireUnMot
            phrase={phrase}
            place={ouverte}
            onFermer={() => setChoisie(null)}
            onInscrire={async mot => {
              const issue = await inscrire(cle, ouverte, mot)
              if (!('refus' in issue) && issue.juste) setChoisie(null)
              return issue
            }}
          />
        )}
        <CompteDeLaPhrase phrase={phrase} />
        <QuiADesMotsDeLaPhrase phrase={phrase} onOuvrir={ouvrirLaCarte} />
      </>
    )
  }
  if (sphinx.phrase?.divin.key === cle) {
    return (
      <div className="album-phrase">
        <span className="label album-etiquette">Le Divin du moment · sa phrase</span>
        {phraseAInscrire(sphinx.phrase)}
        <ConseilDuSphinx phrase={sphinx.phrase} habitue={sphinx.habitue} />
      </div>
    )
  }
  const retrouvee = sphinx.reconstituees.find(r => r.divin.key === cle)
  if (!retrouvee) return null
  // Qu'il vient de choisir de lire : ses mots se retournent, comme un mot gagné.
  if (devoilee?.cle === cle) {
    return (
      <div className="album-phrase">
        <span className="label album-etiquette">Sa phrase, retrouvée par tous</span>
        <PhraseDuDivin phrase={retrouvee} retourne={devoilee.places} />
      </div>
    )
  }
  if (retrouvee.legende) {
    return (
      <div className="album-phrase">
        <span className="label album-etiquette">Sa phrase, reconstituée</span>
        <p className="serif-note album-phrase-entiere">{espacesFines(`« ${retrouvee.legende} »`)}</p>
      </div>
    )
  }
  return (
    <div className="album-phrase">
      <span className="label album-etiquette">Sa phrase, retrouvée par tous</span>
      {/* Pas encore lue : il peut aussi y inscrire, un à un, les mots qu'on lui a dits — à son rythme. */}
      {phraseAInscrire(retrouvee)}
      {devoiler && (
        <button type="button" className="btn btn-primary album-phrase-lire" onClick={() => devoiler(cle)}>
          La phrase est retrouvée : la lire
        </button>
      )}
      {refus?.cle === cle && (
        <p className="error small" role="alert">
          {refus.motif}
        </p>
      )}
    </div>
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
 * descendre — et son nom seul à qui l'attend (invariant 21). Le Cabinet s'y dit
 * selon le drapeau du code (`voiesDeLAvatar`) ; `cabinet` le force, pour la
 * lire telle qu'elle sera à l'ouverture.
 */
export function FicheDeLAvatar({
  a,
  aLui,
  porte,
  profil,
  dessin,
  cabinet,
}: {
  a: AvatarDeLAlbum
  aLui: boolean
  porte: boolean
  profil: PublicProfileDetail
  dessin: ReactNode
  cabinet?: boolean
}) {
  // Ce que le Sphinx en dit, s'il l'a dit : l'album le pose autour de sa grille (`LeSphinxDeLAlbum`).
  const duSphinx = useContext(LeSphinxDeLAlbum)
  const sphinx = duSphinx?.sphinx
  const retourne = duSphinx?.venu?.divin === a.cle ? duSphinx.venu.mot : undefined
  const voies = voiesDeLAvatar(a.cle, profil, cabinet)
  const l = legendaire(a.cle)
  const p = portrait(a.cle)
  const f = formeDeCompagnon(a.cle)
  const recit = a.sorte === 'divin' ? (profil.divins ?? []).find(d => d.key === a.cle) : undefined
  const inconnu = a.sorte === 'divin' && !recit
  // Son sceau : un légendaire qu'un raccourci donne aussi — le Cabinet — se scelle par son exploit (`estScellable`).
  // Gagné par le raccourci seul, sa voie d'origine reste un but, sa jauge en vue : elle ne valait plus rien.
  const scellable = aLui && !!l && estScellable(l)
  const scelle = scellable && (profil.scelles ?? []).includes(a.cle)
  const sceauAttendu = scellable && !scelle && !!profil.scelles
  const raccourci = (e: EtapeDUneVoie) => e.lieu === 'cabinet' || e.lieu === 'expedition'
  const voiesDuSceau = sceauAttendu ? voies.filter(v => !v.some(raccourci)) : []
  const aller = aLui ? (sceauAttendu ? ouAller(a.cle, voiesDuSceau) : null) : ouAller(a.cle, voies)
  // Un Divin descendu n'éclate jamais, ni la métamorphose d'un compagnon, qui
  // n'a qu'une version ; ses autres formes, depuis leur ciel rare (le
  // 3 novembre 2026), dès que l'Éclat est tombé sur l'une d'elles
  // (`aLEclat`) ; les autres avatars, s'il est tombé sur eux.
  const eclate = aLui && a.sorte !== 'divin' && !f?.metamorphose && aLEclat(profil, a.cle)
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
          <b className="galerie-detail-nom">{a.sorte === 'emoji' ? 'Emoji de collection' : nomDe(a)}</b>
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
          <p className="muted small">{`${compagnonDe(f).nom} · ${nomDeLaForme(f)}`}</p>
        </>
      )}
      {a.sorte === 'emoji' && <p className="muted small">Réservé aux profils : l’inscription ne le propose pas.</p>}
      {recit && <p className="serif-note">{recit.legende}</p>}
      {inconnu && <p className="serif-note">Personne ne sait ce qui le fait descendre. Ceux qui l’ont vu ne le cherchaient pas.</p>}
      {/* Descendu, il raconte déjà sa légende : la phrase du Sphinx n'y ajouterait rien. */}
      {inconnu && sphinx && (
        <SaPhrase
          cle={a.cle}
          sphinx={sphinx}
          retourne={retourne}
          devoiler={duSphinx?.devoiler}
          devoilee={duSphinx?.devoilee}
          refus={duSphinx?.refus}
          inscrire={duSphinx?.inscrire}
          inscrit={duSphinx?.inscrit}
          ouvrirLaCarte={duSphinx?.ouvrirLaCarte}
        />
      )}
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
      {scelle && (
        <p className="small album-a-toi">
          <Icon name="star" />
          <span>Scellé : tu en tiens l’exploit. L’étoile du zénith couronne son cercle, et toute la salle la voit.</span>
        </p>
      )}
      {/* « Essayer », comme sous « À porter » à la fin d'une partie et dans le style : la loge s'ouvre, lui sur la carte. */}
      {aLui && !porte && (
        <a className="btn btn-small album-essayer" href={`?essayer=${encodeURIComponent(a.cle)}#avatar`}>
          Essayer
        </a>
      )}
      {eclate && <ChoixDeLEclat brille={brilleChez(profil, a.cle)} busy={false} matiere={profil.matieresPortees?.[a.cle] ?? null} taillees={profil.matieres?.[a.cle]} />}
      {voies.length > 0 && (
        <>
          <span className="label album-etiquette">{sceauAttendu ? 'Son sceau' : aLui ? 'Comment il se gagne' : 'Comment l’obtenir'}</span>
          {sceauAttendu && <p className="muted small">Gagné au Cabinet : son exploit lui donne encore son sceau, l’étoile du zénith que toute la salle voit.</p>}
          <ul className="album-voies">
            {voies.map((v, i) => (
              <li key={i}>
                {/* L'une ou l'autre voie suffit ; dans une voie, toutes les étapes. Les mots se lisent aussi à l'oreille. */}
                {i > 0 && <span className="album-ou">ou</span>}
                <div className="album-voie">
                  {v.map((e, j) => (
                    <Fragment key={j}>
                      {j > 0 && <span className="album-et">et</span>}
                      <Etape etape={e} jauge={!aLui || (sceauAttendu && !v.some(raccourci))} />
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
 * ouvert, on la retrouve. `cabinet` force le drapeau du Cabinet, comme sa
 * fiche : ses pastilles, ce que ses cases disent à l'oreille, sa légende.
 */
export function AlbumDesAvatars({
  profil,
  page,
  onPage,
  cabinet,
}: {
  profil: PublicProfileDetail
  page: RareteDAvatar
  onPage: (r: RareteDAvatar) => void
  cabinet?: boolean
}) {
  const pages = pagesDeLAlbum(profil, cabinet)
  const [ouvert, setOuvert] = useState<string | null>(null)
  // Une autre page demandée par l'adresse, l'album déjà là : sa fiche se referme.
  useEffect(() => setOuvert(null), [page])
  // Ce que le Sphinx dit des Divins — la phrase du Divin du moment, celles reconstituées —, lu à la demande, quand la page
  // des Divins s'ouvre : les autres pages n'en ont que faire. Sa page fermée pour lui, rien.
  const [sphinx, setSphinx] = useState<SphinxOuvert | null>(null)
  const surLesDivins = page === 'divin'
  useEffect(() => {
    if (!surLesDivins || sphinx) return
    let vivant = true
    api.joueur.sphinx().then(
      r => {
        if (vivant && !r.fermee) setSphinx(r)
      },
      () => {},
    )
    return () => {
      vivant = false
    }
  }, [surLesDivins]) // eslint-disable-line react-hooks/exhaustive-deps
  // « La phrase est retrouvée : la lire » : confirmé, le serveur la rend entière — à lui pour de bon, sur tous ses
  // appareils —, et ce qu'il ne savait pas s'y retourne.
  const [devoilee, setDevoilee] = useState<{ cle: string; places: number[] } | null>(null)
  // Un refus se dit sous le geste, pas en toast : l'album se rend aussi dans Node (`grille-avatars.test.ts`), où l'état
  // de la page, qui lit son adresse en se chargeant, n'a pas sa fenêtre.
  const [refusDuSphinx, setRefusDuSphinx] = useState<{ cle: string; motif: string } | null>(null)
  const devoiler = (cle: string) => {
    void (async () => {
      const avant = sphinx?.reconstituees.find(r => r.divin.key === cle)
      if (!avant) return
      const oui = await confirmDialog({
        title: 'Lire la phrase entière ?',
        message: `Tous ensemble, vous avez retrouvé la phrase ${deNom(avant.divin.nom)}. Tu la verras entière, les mots que tu n’as pas trouvés compris — pour de bon, sur tous tes appareils.`,
        confirmLabel: 'La lire',
        cancelLabel: 'Pas maintenant',
      })
      if (!oui) return
      try {
        const { phrase } = await api.joueur.lirePhraseDuSphinx(cle)
        setSphinx(s => (s ? { ...s, reconstituees: s.reconstituees.map(r => (r.divin.key === cle ? phrase : r)) } : s))
        setDevoilee({ cle, places: placesDevoilees(avant, phrase) })
      } catch (e) {
        setRefusDuSphinx({ cle, motif: motifDe(e) })
      }
    })()
  }
  // Un mot qu'on lui a dit, inscrit sur un trait : juste, la phrase d'après prend la place de celle d'avant — le Divin du
  // moment ou une phrase retrouvée — et le mot s'y retourne ; faux, le champ le dit. Un refus (plus d'erreur permise, la page
  // fermée entre-temps, le réseau) se dit sous le champ, tel quel.
  const [inscrit, setInscrit] = useState<{ cle: string; place: number } | null>(null)
  const inscrire = async (cle: string, place: number, mot: string): Promise<IssueDUneInscription> => {
    try {
      const { juste, erreursRestantes, phrase } = await api.joueur.inscrireUnMotDuSphinx(cle, place, mot)
      const remplace = (p: PhraseDuSphinx): PhraseDuSphinx => (p.divin.key === cle ? { ...phrase, quiADesMots: p.quiADesMots, autresQuiEnOnt: p.autresQuiEnOnt } : p)
      setSphinx(s => (s ? { ...s, phrase: s.phrase && remplace(s.phrase), reconstituees: s.reconstituees.map(remplace) } : s))
      if (juste) setInscrit({ cle, place })
      return { juste, erreursRestantes }
    } catch (e) {
      return { refus: motifDe(e) }
    }
  }
  // La carte de qui a des mots, touché dans la liste : d'où l'ajouter à ses amis, ou le défier.
  const { ouvrir: ouvrirLaCarte, carte } = useCarteDeQuiADesMots()
  // Venu de la visite : la fiche du Divin s'ouvre, le mot qu'il vient de gagner s'y retourne.
  const [venuDuSphinx] = useState(() => (page === 'divin' ? lirePourLAlbum() : null))
  useEffect(() => {
    if (venuDuSphinx) setOuvert(venuDuSphinx.divin)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const porte = profil.legendaire ?? profil.avatar
  const detail = useFiche(ouvert, porte)
  // Ouverte par la visite, pas par un geste : sa fiche reprend le focus sans l'anneau du clavier, que rien n'a demandé.
  useEffect(() => {
    const nom = venuDuSphinx && ouvert === venuDuSphinx.divin ? detail.current?.querySelector<HTMLElement>('.galerie-detail-nom') : null
    if (nom) {
      // Déjà focalisé par la fiche : un second `focus` ne changerait rien, il faut le lui reprendre d'abord.
      nom.blur()
      nom.focus({ preventScroll: true, focusVisible: false } as FocusOptions)
    }
  }, [ouvert]) // eslint-disable-line react-hooks/exhaustive-deps
  const dessins = useDessins(...SORTES, 'legendaire', 'divin', 'compagnon')
  const { Portrait, Compagnon } = dessins
  // Ce qu'il porte de son Éclat : sa version rare, ou la matière qu'il a choisie.
  const brille = (k: string) => eclatChez(profil, k)
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
      // Sous son ciel rare s'il le porte, comme le légendaire et le portrait de l'album.
      return Compagnon && dessinDuCompagnon(dessins, a.cle) ? <Compagnon cle={a.cle} verrouille={!aLui} grand={grand} eclat={aLui && !!brille(a.cle)} /> : <span className="pt" aria-hidden="true" />
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
      {/* Ce que le Sphinx dit des Divins, jusqu'à leurs fiches. */}
      {carte}
      <LeSphinxDeLAlbum.Provider value={sphinx ? { sphinx, venu: venuDuSphinx, devoiler, devoilee, refus: refusDuSphinx, inscrire, inscrit, ouvrirLaCarte } : null}>
        <div
          className={'album-avatars' + (choisie.rarete === 'divin' ? ' album-divins' : '')}
          role="tabpanel"
          id="album-page"
          aria-labelledby={`gemme-${choisie.rarete}`}
          style={gemmeDAvatar(choisie.rarete)}
        >
          {choisie.avatars.map(({ avatar: a, aLui }) => {
            const lePorte = aLui && porte === a.cle
            // Un emoji qui reste dit son niveau sur son anneau, en toutes lettres : une icône de plus ne le dirait pas.
            const niveau = a.sorte === 'emoji' && !aLui ? COLLECTION.find(c => c.emoji === a.cle)?.niveau : undefined
            // Le Divin du moment, celui dont le Sphinx souffle les mots : sa case s'allume, sa fiche montre sa phrase.
            const duMoment = !aLui && sphinx?.phrase?.divin.key === a.cle
            return (
              <Fragment key={a.cle}>
                <button
                  type="button"
                  className={'album-case' + (aLui ? '' : ' album-manque') + (a.sorte === 'emoji' ? ' album-emoji' : '') + (duMoment ? ' album-moment' : '')}
                  aria-expanded={ouvert === a.cle}
                  aria-controls={ouvert === a.cle ? 'fiche-avatar' : undefined}
                  aria-label={ceQueDitLaCase(a, aLui, lePorte, cabinet) + (duMoment ? ', le Divin du moment' : '')}
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
                  {/* Un Divin dit son nom sous sa case, descendu ou non : c'est tout ce qu'on sait de lui, et de quoi le chercher. */}
                  {a.sorte === 'divin' && (
                    <span className={'album-nom' + (aLui ? '' : ' album-nom-voile')} aria-hidden="true">
                      {nomDe(a)}
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
                    <FicheDeLAvatar a={a} aLui={aLui} porte={lePorte} profil={profil} dessin={dessin(a, aLui, true)} cabinet={cabinet} />
                  </div>
                )}
              </Fragment>
            )
          })}
        </div>
      </LeSphinxDeLAlbum.Provider>
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
          ? 'Ceux qui ne sont pas descendus restent voilés : ils ne disent que leur nom.'
          : espacesFines('En couleur, ceux qui sont à toi ; en silhouette dorée, ceux qui restent. Touche-les : comment les obtenir.')}
      </p>
    </div>
  )
}

/** La page qu'une adresse nomme (`#collection-avatars-legendaire`), ou null. */
export function pageNommee(mot: string): RareteDAvatar | null {
  return RARETES_D_AVATAR.find(r => r === mot) ?? null
}
