import { Fragment, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Avatar } from './Avatar'
import { Icon, type IconName } from './Icon'
import { BlasonDeLigue } from './Blason'
import { Ecusson } from './Ecusson'
import { Calendrier } from './Calendrier'
import { UnProche } from './Trophees'
import { JaugeFine } from './LigneDeCollection'
import { LUEUR, lueur } from './Atlas'
import { gemme, useFiche } from './Boutique'
import { ongletVise } from './Onglets'
import { espacesFines, formatNumber } from '../format'
import { NOM_RARETE, type Rarete } from '../../../shared/badges'
import { NOM_PALIER, XP_PALIER, hautFaitDeSoiree } from '../../../shared/hautsfaits'
import { lesPlusProches } from '../../../shared/proches'
import { ditLaRecompense, etapesDeLaPiste } from '../../../shared/pistes'
import { PALIER_DU_MAITRE } from '../../../shared/sentiers'
import { CRANS_D_UNE_BORDURE } from '../../../shared/duels'
import { PAGES } from '../../../shared/calendrier'
import {
  CE_QUE_RANGE_LA_PAGE,
  NOM_DE_LA_PAGE,
  OU_DE_LA_PAGE,
  OU_JOUER,
  albumDesTrophees,
  ouIlEnEst,
  seuilDeLEtape,
  type CaseDeTrophee,
  type EtapeVue,
  type PageDeTrophees,
  type PageDesTrophees,
  type SectionDeLAlbum,
} from '../../../shared/trophees'
import type { PublicProfileDetail } from '../../../shared/profil'

// L'album des trophées, dans « Ma collection » (la maquette 1, choisie par le
// propriétaire le 13 octobre 2026) : tout ce qui se gagne par ce qu'on a fait,
// une page par mode — la soirée, le quiz du jour, la campagne, les duels, les
// sentiers, et ce que tous nourrissent. Dix lignes le rangeaient selon la
// logique du code — « Hauts faits du jour », « Paliers de toujours »… —, et
// le retour reçu par le propriétaire disait « très confus ». Dans chaque
// page, les pistes — ce qui monte, bronze, argent, or, et ce que chaque
// étape ouvre —, les exploits, les coups du sort, et ce que le mode a en
// propre : le palmarès, le calendrier, les ligues, les maîtres, les
// écussons. La règle est pure (`shared/trophees.ts`) ; ici, ce qu'on voit.
//
// Comme l'album des avatars : ce qu'on a en couleur, ce qui reste en
// silhouette dorée, la rareté dans le cercle, et la fiche sous sa rangée. On
// n'y porte rien : un titre, une vitrine se choisissent dans la loge.

const ICONE_DE_LA_PAGE: Record<PageDesTrophees, IconName> = {
  soiree: 'sparkles',
  jour: 'sun',
  campagne: 'target',
  duels: 'swords',
  sentiers: 'mountain',
  partout: 'star',
}

const RARETES: readonly Rarete[] = ['commune', 'peucommune', 'rare', 'epique', 'legendaire']

/** Le cercle d'une case : sa rareté, ou l'or pour ce qui n'en a pas de mesurée. */
const gemmeDe = (c: CaseDeTrophee): CSSProperties => gemme(c.rarete ?? 'offert')

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Ce que sa case dit à l'oreille : son nom, ce qu'il en a, sa rareté. */
function ceQueDitLaCase(c: CaseDeTrophee): string {
  const rarete = c.rarete ? `, ${NOM_RARETE[c.rarete].toLowerCase()}` : ''
  if (c.sorte === 'piste' || c.sorte === 'ecusson') {
    const metaux = c.metaux ? NOM_PALIER.slice(0, c.metaux).join(', ').toLowerCase() : 'pas encore'
    return `${c.titre}, ${c.compte ?? ''}, ${metaux}${rarete}`
  }
  if (c.fois !== undefined) return `${c.titre}, ${c.fois > 0 ? `${c.fois} fois` : 'pas encore'}${rarete}`
  if (c.sorte === 'bordure' || c.sorte === 'maitre') return `${c.titre}, ${c.aLui ? 'à toi' : `${c.compte ?? 'pas encore'}`}`
  return `${c.titre}, ${c.aLui ? 'à toi' : 'pas encore'}`
}

/** Les trois métaux d'une piste, allumés jusqu'au sien. */
function Metaux({ n }: { n: number }) {
  return (
    <span className="trophee-metaux" aria-hidden="true">
      {[1, 2, 3].map(m => (
        <i key={m} className={m <= n ? `metal-${m}` : undefined} />
      ))}
    </span>
  )
}

/**
 * Les six pages, chacune son icône et son compte : les onglets de toute
 * l'application — un seul arrêt de Tab, les flèches passent à la voisine.
 */
function OngletsDesPages({ pages, choisie, onChoisir }: { pages: PageDeTrophees[]; choisie: PageDesTrophees; onChoisir: (p: PageDesTrophees) => void }) {
  const liste = useRef<HTMLDivElement>(null)
  const touche = (e: KeyboardEvent, i: number) => {
    const j = ongletVise(e.key, i, pages.length)
    if (j === null) return
    e.preventDefault()
    onChoisir(pages[j].page)
    liste.current?.querySelectorAll<HTMLElement>('[role="tab"]')[j]?.focus()
  }
  return (
    <div ref={liste} className="trophees-onglets" role="tablist" aria-label="Les modes de jeu">
      {pages.map((p, i) => (
        <button
          key={p.page}
          id={`trophees-onglet-${p.page}`}
          type="button"
          role="tab"
          aria-selected={choisie === p.page}
          aria-controls={choisie === p.page ? 'trophees-page' : undefined}
          aria-label={`${NOM_DE_LA_PAGE[p.page]}, ${p.acquis} sur ${p.total}`}
          tabIndex={choisie === p.page ? 0 : -1}
          className="trophees-onglet"
          onClick={() => onChoisir(p.page)}
          onKeyDown={e => touche(e, i)}
        >
          <Icon name={ICONE_DE_LA_PAGE[p.page]} />
          <span aria-hidden="true">{NOM_DE_LA_PAGE[p.page]}</span>
          <b aria-hidden="true">{`${p.acquis}/${p.total}`}</b>
        </button>
      ))}
    </div>
  )
}

/**
 * Une piste, dans sa fiche : chaque étape, son seuil et son métal, ce qu'elle
 * ouvre — cochée si elle est atteinte —, et la jauge de la prochaine.
 */
function Piste({ piste, etapes, valeur }: { piste: string; etapes: readonly EtapeVue[]; valeur: number }) {
  return (
    <ol className="piste">
      {etapes.map(e => (
        <li key={e.seuil} className={'piste-etape' + (e.atteinte ? ' atteinte' : '') + (e.prochaine ? ' prochaine' : '')}>
          <span className="piste-jalon" aria-hidden="true">
            {e.atteinte ? <Icon name="check" /> : formatNumber(e.seuil)}
          </span>
          <span className="piste-texte">
            <b>
              {seuilDeLEtape(piste, e.seuil)}
              {e.metal && (
                <>
                  {' · '}
                  <span className={`metal-texte-${e.metal}`}>{NOM_PALIER[e.metal - 1]}</span>
                </>
              )}
              {e.atteinte && <span className="sr-only"> : atteinte</span>}
            </b>
            {e.recompenses.length > 0 && <span className="muted small">{espacesFines(e.recompenses.map(ditLaRecompense).join(' · '))}</span>}
            {e.prochaine && (
              <span className="album-progres">
                <JaugeFine part={valeur / e.seuil} />
                <span>{`${formatNumber(valeur)} sur ${formatNumber(e.seuil)}`}</span>
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** L'expérience d'une case, en une phrase : par métal pour une piste, chaque fois pour un exploit — un prix, jamais. */
function phraseDeLXp(c: CaseDeTrophee): string | null {
  if (c.sorte === 'piste') {
    const absorbe = c.absorbe
      ? ` ${c.absorbe.titre}, +${c.absorbe.xp} XP à chaque victoire, se compte ici${c.absorbe.fois > 0 ? ` : tu l’as eu ${c.absorbe.fois} fois` : ''}.`
      : ''
    return `+${XP_PALIER[0]}, +${XP_PALIER[1]} et +${XP_PALIER[2]} XP au bronze, à l’argent et à l’or.${absorbe}`
  }
  if (c.sorte === 'prix') return 'Un prix ne rapporte pas d’XP : il se raconte.'
  if (c.xp === undefined || c.xp <= 0) return null
  return hautFaitDeSoiree(c.cle)?.paieUneFois ? `+${c.xp} XP, la première fois.` : `+${c.xp} XP chaque fois.`
}

/** Ce que la fiche dit d'où il en est. */
function ouEnEst(c: CaseDeTrophee): string | null {
  switch (c.sorte) {
    case 'piste':
      return ouIlEnEst(c.cle, c.valeur ?? 0)
    case 'exploit':
    case 'coup':
    case 'prix':
      return c.fois ? `${c.sorte === 'coup' ? 'Subi' : c.sorte === 'prix' ? 'Remporté' : 'Réussi'} ${c.fois} fois.` : 'Pas encore.'
    case 'bordure':
      return `${c.valeur ?? 0} cran${(c.valeur ?? 0) > 1 ? 's' : ''} sur ${CRANS_D_UNE_BORDURE}.`
    case 'maitre':
      return c.aLui ? 'Maître : son titre se porte sous ton prénom.' : `Palier ${c.valeur ?? 0} sur ${PALIER_DU_MAITRE}.`
    case 'ecusson':
      return `${c.compte ?? ''}, où que tu joues.`
    default:
      return c.aLui ? 'À toi.' : 'Pas encore.'
  }
}

/**
 * La fiche d'un trophée, sous sa rangée : en grand, son nom, sa rareté, ce
 * qu'il faut, où il en est, ce qu'il rapporte — et pour une piste, toutes
 * ses étapes et ce que chacune ouvre ; pour un exploit, ce qu'il ouvre à
 * tant de fois. Le chemin de l'écran où le gagner, tant qu'il reste quelque
 * chose à y gagner. Rien ne s'y porte.
 */
export function FicheDuTrophee({ c, page, visuel }: { c: CaseDeTrophee; page: PageDesTrophees; visuel: ReactNode }) {
  const xp = phraseDeLXp(c)
  const fini = c.sorte === 'piste' || c.sorte === 'ecusson' ? (c.metaux ?? 0) >= 3 : c.aLui && c.sorte !== 'exploit' && c.sorte !== 'coup'
  const aller = fini ? null : c.sorte === 'maitre' && c.branche ? { nom: 'Aller au sentier', href: `/campagne#sentier-${c.branche}` } : OU_JOUER[page]
  return (
    <div className="galerie-detail detail-case album-detail trophee-fiche" style={gemmeDe(c)}>
      <div className="album-detail-tete">
        <span className="trophee-fiche-visuel" aria-hidden="true">
          {visuel}
        </span>
        <span className="album-detail-titre">
          <b className="galerie-detail-nom">{c.titre}</b>
          {c.rarete && (
            <span className="album-detail-rarete">
              <i aria-hidden="true" />
              {NOM_RARETE[c.rarete]}
            </span>
          )}
        </span>
      </div>
      {c.regle && c.sorte !== 'piste' && <p className="trophee-regle">{espacesFines(`${majuscule(c.regle)}.`)}</p>}
      {ouEnEst(c) && <p className="muted">{ouEnEst(c)}</p>}
      {xp && <p className="muted small">{xp}</p>}
      {c.etapes && c.etapes.length > 0 && (
        <>
          <span className="label album-etiquette">{c.sorte === 'piste' ? 'Ta piste' : 'Ses métaux'}</span>
          <Piste piste={c.cle} etapes={c.etapes} valeur={c.valeur ?? 0} />
        </>
      )}
      {c.ouvre && c.ouvre.length > 0 && (
        <>
          <span className="label album-etiquette">Ce qu’il ouvre</span>
          <ul className="trophee-ouvre">
            {c.ouvre.map(o => (
              <li key={`${o.fois}-${o.recompense.cle}`} className={o.tenue ? 'tenue' : undefined}>
                <Icon name={o.tenue ? 'check' : 'lock'} />
                <span>{espacesFines(`${c.sorte === 'ligue' ? '' : `${o.fois} fois : `}${ditLaRecompense(o.recompense)}`)}</span>
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
 * Une section d'une page : son titre et son compte, ce qu'elle range, sa
 * grille — chaque case et, sous sa rangée, la fiche ouverte —, et pour les
 * maîtres ce que leur nombre ouvre.
 */
function Section({
  s,
  page,
  profil,
  ouvert,
  onToucher,
  detail,
}: {
  s: SectionDeLAlbum
  page: PageDesTrophees
  profil: PublicProfileDetail
  ouvert: string | null
  onToucher: (cle: string) => void
  detail: RefObject<HTMLDivElement | null>
}) {
  const id = `trophees-${page}-${s.cle}`
  /** Son dessin : l'emoji, le blason, la bordure, l'écusson — en couleur s'il est à lui, en silhouette sinon. */
  const visuel = (c: CaseDeTrophee, grand = false): ReactNode => {
    switch (c.sorte) {
      case 'ligue':
        return <BlasonDeLigue ligue={c.ligue!} taille={grand ? 56 : 30} decoratif />
      case 'bordure':
        return <Avatar avatar={profil.avatar} finition={profil.finition} bordure={{ ligue: c.ligue!, crans: c.valeur ?? 0 }} />
      case 'maitre':
        return (
          <span className="trophee-couronne" style={lueur(LUEUR[c.branche!])}>
            <Icon name="crown" />
          </span>
        )
      case 'ecusson':
        return <Ecusson categorie={c.titre} palier={Math.max(0, Math.min(3, c.metaux ?? 0)) as 0 | 1 | 2 | 3} />
      default:
        return c.aLui ? c.emoji : <span className="silhouette">{c.emoji}</span>
    }
  }
  if (s.cle === 'calendrier' && profil.calendrier) {
    const { pages, dorees, mois, joursCeMois } = profil.calendrier
    return (
      <section className="trophees-section" aria-labelledby="calendrier-titre">
        <Calendrier pages={pages} dorees={dorees} moisEnCours={mois} joursCeMois={joursCeMois} />
        {pages.length < PAGES.length && (
          <p className="muted small">{espacesFines(`Les douze ouvrent ${etapesDeLaPiste('pages').flatMap(e => e.recompenses).map(ditLaRecompense).join(' et ') || 'un thème'}.`)}</p>
        )}
        {(s.titres ?? []).length > 0 && (
          <p className="trophees-titres">
            <span className="label">Champion du mois</span>
            {s.titres!.map(t => (
              <span key={t} className="trophees-titre">
                {t}
              </span>
            ))}
          </p>
        )}
      </section>
    )
  }
  return (
    <section className="trophees-section" aria-labelledby={id}>
      <div className="trophees-section-tete">
        <h3 id={id} className="label">
          {s.titre}
        </h3>
        <span className="famille-compte">{`${s.acquis}/${s.total}`}</span>
      </div>
      <p className="muted small">{espacesFines(s.aide)}</p>
      <div className={'trophees-grille' + (s.cle === 'ecussons' ? ' trophees-grille-ecussons' : '')}>
        {s.cases.map(c => (
          <Fragment key={c.cle}>
            <button
              type="button"
              className={`trophee-case trophee-${c.sorte}` + (c.aLui ? '' : ' trophee-manque')}
              style={gemmeDe(c)}
              aria-expanded={ouvert === c.cle}
              aria-controls={ouvert === c.cle ? 'fiche-trophee' : undefined}
              aria-label={ceQueDitLaCase(c)}
              onClick={() => onToucher(c.cle)}
            >
              <span className="trophee-medaillon" aria-hidden="true">
                {visuel(c)}
                {c.fois !== undefined && c.fois > 0 && <span className={'trophee-fois' + (c.sorte === 'coup' ? ' trophee-fois-ombre' : '')}>{`×${c.fois}`}</span>}
              </span>
              {c.metaux !== undefined && c.sorte === 'piste' && <Metaux n={c.metaux} />}
              {/* Un écusson écrit déjà sa catégorie sous son blason. */}
              {c.sorte !== 'ecusson' && (
                <span className="trophee-nom" aria-hidden="true">
                  {c.titre}
                </span>
              )}
              {c.compte && c.fois === undefined && (
                <span className="trophee-sous" aria-hidden="true">
                  {c.compte}
                </span>
              )}
            </button>
            {ouvert === c.cle && (
              <div id="fiche-trophee" className="fiche-case album-fiche" ref={detail}>
                <FicheDuTrophee c={c} page={page} visuel={visuel(c, true)} />
              </div>
            )}
          </Fragment>
        ))}
      </div>
      {/* Les maîtres : ce que leur nombre ouvre, sous la grille. */}
      {s.etapes && s.etapes.length > 0 && (
        <div className="trophees-etapes">
          <span className="label album-etiquette">Ce que tes maîtres ouvrent</span>
          <Piste piste="maitres" etapes={s.etapes} valeur={s.cases.filter(c => c.aLui).length} />
        </div>
      )}
    </section>
  )
}

/**
 * L'album : les plus proches, les six pages en onglets, ce que range la page
 * choisie, ses sections, et la légende des raretés. `page`, celle qu'une
 * adresse demande (`#collection-trophees-jour`) ; `onPage` écrit celle qu'on
 * choisit dans l'adresse : revenu d'un écran qu'elle a ouvert, on la retrouve.
 */
export function AlbumDesTrophees({ profil, page, onPage }: { profil: PublicProfileDetail; page: PageDesTrophees; onPage: (p: PageDesTrophees) => void }) {
  const pages = albumDesTrophees(profil)
  const [ouvert, setOuvert] = useState<string | null>(null)
  // Une autre page demandée par l'adresse, l'album déjà là : sa fiche se referme.
  useEffect(() => setOuvert(null), [page])
  const detail = useFiche(ouvert, page)
  const choisie = pages.find(p => p.page === page) ?? pages[0]
  const proches = lesPlusProches(profil.hautsFaits, profil.legendaires)
  const choisir = (p: PageDesTrophees) => {
    setOuvert(null)
    onPage(p)
  }
  const toucher = (k: string) => setOuvert(o => (o === k ? null : k))
  return (
    <div className="album album-trophees">
      {/* Ce qu'il peut chasser bientôt, d'où qu'il vienne : avant les pages. */}
      {proches.length > 0 && (
        <div className="proches trophees-proches">
          <span className="label">Les plus proches</span>
          {proches.map(p => (
            <UnProche key={p.key} p={p} />
          ))}
        </div>
      )}
      <OngletsDesPages pages={pages} choisie={choisie.page} onChoisir={choisir} />
      <p className="gemme-legende">
        <b>{`${OU_DE_LA_PAGE[choisie.page]} · ${choisie.acquis} sur ${choisie.total}.`}</b> {espacesFines(CE_QUE_RANGE_LA_PAGE[choisie.page])}
      </p>
      <div className="trophees-page" role="tabpanel" id="trophees-page" aria-labelledby={`trophees-onglet-${choisie.page}`}>
        {choisie.sections.length === 0 ? (
          <p className="muted small">Cette page se remplit dès que le serveur la connaît : recharge dans un instant.</p>
        ) : (
          choisie.sections.map(s => <Section key={s.cle} s={s} page={choisie.page} profil={profil} ouvert={ouvert} onToucher={toucher} detail={detail} />)
        )}
      </div>
      <div className="trophees-legende">
        <p className="album-legende muted small">
          {RARETES.map(r => (
            <span key={r} style={gemme(r)}>
              <i aria-hidden="true" />
              {NOM_RARETE[r]}
            </span>
          ))}
        </p>
        <p className="muted small">
          {espacesFines('En couleur, ceux qui sont à toi ; en silhouette dorée, ceux qui restent. Le cercle dit leur rareté : la part des joueurs qui les ont. Touche-les : comment les obtenir.')}
        </p>
      </div>
    </div>
  )
}
