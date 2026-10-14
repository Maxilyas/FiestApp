import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { AlbumDesAvatars, pageNommee } from './AlbumDesAvatars'
import { AlbumDesTrophees } from './AlbumDesTrophees'
import { JaugeFine, LigneDeCollection } from './LigneDeCollection'
import { GerbeDeJuste } from './Gerbe'
import { DetailTheme, etatDuTheme, gemme, nomDeLaCase, useFiche, type EtatDuTheme } from './Boutique'
import { LILAS, OR } from './Atlas'
import { espacesFines, formatNumber } from '../format'
import { apercuDe } from '../apercus'
import { compteDeLaCollection, type FamilleDeLaCollection, type LigneDuCompte, type PartieDeLaCollection } from '../../../shared/collection'
import { pageDuDebut, pageDuProchain, type RareteDAvatar } from '../../../shared/album'
import { pageDuDebutDesTrophees } from '../../../shared/trophees'
import { pageDesTropheesNommee, type PageDesTrophees } from '../../../shared/pagesDesTrophees'
import { FONDS } from '../../../shared/fonds'
import { GERBES } from '../../../shared/gerbes'
import { NOM_DE_RARETE, RARETES_DE_THEME, THEMES, type Theme } from '../../../shared/themes'
import { FINITIONS, NIVEAU_FINITION, NOM_FINITION, type PublicProfileDetail } from '../../../shared/profil'

// « Ma collection » : tout ce qui se gagne, d'un coup d'œil — ce qu'on a, ce
// qui reste, et où le gagner. Trois familles, comptées par la même règle que
// la tuile du profil (`shared/collection.ts`) : deux albums — les avatars,
// une page par rareté (`AlbumDesAvatars`) ; les trophées, une page par mode
// (`AlbumDesTrophees`) —, puis le style.
//
// On n'y règle rien : ce qu'on a se porte depuis « M'habiller », au profil —
// la loge, une adresse par pièce —, et chaque ligne le dit, un lien vers
// l'écran qui le porte. Les écrans où l'on choisit ne montrent que ce qu'on a ; c'est ici
// que vit tout le reste.

/** Ce que chaque ligne dit d'elle. */
const LIGNES: Record<PartieDeLaCollection, { emoji: string; nom: string; detail: string; couleur: string }> = {
  avatars: { emoji: '🐉', nom: 'L’album des avatars', detail: 'Légendaires, portraits et emojis, par rareté', couleur: OR },
  trophees: { emoji: '🏆', nom: 'L’album des trophées', detail: 'Ce que tu as réussi, mode par mode', couleur: OR },
  themes: { emoji: '🎨', nom: 'Thèmes', detail: 'Ils habillent toutes tes pages', couleur: LILAS },
  fonds: { emoji: '🖼️', nom: 'Fonds de carte', detail: 'Derrière ta carte, quand on touche ton nom', couleur: '#5fa8ff' },
  gerbes: { emoji: '🎉', nom: 'Gerbes', detail: 'Ce qui éclate à chaque bonne réponse', couleur: '#ff9f5a' },
  finitions: { emoji: '✨', nom: 'Finitions', detail: 'Le cercle de ton avatar, au fil des niveaux', couleur: '#ffd36e' },
}

const NOM_DE_FAMILLE: Record<FamilleDeLaCollection, string> = { avatars: 'Avatars', trophees: 'Trophées', style: 'Style' }

/**
 * L'adresse d'une ligne : `#collection-themes`. « Mon thème » y mène, ouverte
 * sur ses thèmes — ceux qui se gagnent compris. Les albums ont aussi leurs
 * pages (`#collection-avatars-legendaire`, `#collection-trophees-jour`) :
 * « 24 légendaires à gagner : où ? », dans la loge, l'ouvre sur eux ; la
 * fin d'une partie, sur la page de ce qu'elle vient de faire tomber.
 */
const ADRESSE = 'collection'

/**
 * Les trois lignes d'avant l'album — un lien d'une page d'avant, un favori —
 * mènent à la page où se trouve leur prochain avatar.
 */
const AVANT_L_ALBUM: Record<string, (p: PublicProfileDetail) => RareteDAvatar | null> = {
  legendaires: () => 'legendaire',
  savoir: p => pageDuProchain(p, 'portrait'),
  emojis: p => pageDuProchain(p, 'emoji'),
}

/** Les dix lignes des trophées d'avant l'album mènent à la page du mode où elles se gagnaient. */
const AVANT_LES_TROPHEES: Record<string, PageDesTrophees> = {
  eclats: 'soiree',
  ombres: 'soiree',
  prix: 'soiree',
  paliers: 'soiree',
  jour: 'jour',
  paliersDuJour: 'jour',
  campagne: 'campagne',
  paliersDeCampagne: 'campagne',
  ecussons: 'partout',
  paliersDeToujours: 'partout',
}

/** La ligne que l'adresse ouvre, et la page de l'album qu'elle nomme. */
function lireLAdresse(profil: PublicProfileDetail): { partie: PartieDeLaCollection | null; page: RareteDAvatar | null; trophees: PageDesTrophees | null } {
  const h = window.location.hash.slice(1)
  const reste = h.startsWith(`${ADRESSE}-`) ? h.slice(ADRESSE.length + 1) : ''
  const rien = { page: null, trophees: null }
  if (reste in LIGNES) return { ...rien, partie: reste as PartieDeLaCollection }
  if (reste.startsWith('avatars-')) return { ...rien, partie: 'avatars', page: pageNommee(reste.slice('avatars-'.length)) }
  if (reste.startsWith('trophees-')) return { ...rien, partie: 'trophees', trophees: pageDesTropheesNommee(reste.slice('trophees-'.length)) }
  if (reste in AVANT_L_ALBUM) return { ...rien, partie: 'avatars', page: AVANT_L_ALBUM[reste](profil) }
  if (reste in AVANT_LES_TROPHEES) return { ...rien, partie: 'trophees', trophees: AVANT_LES_TROPHEES[reste] }
  return { ...rien, partie: null }
}

/** « Le porter : Mon avatar » — l'écran où ce qu'on a se porte, sous chaque ligne. */
function OuLePorter({ ecran, nom, quoi = 'Ce qui est à toi se porte dans' }: { ecran: string; nom: string; quoi?: string }) {
  return (
    <p className="muted small">
      {quoi}{' '}
      <a className="link-inline" href={`#${ecran}`}>
        {`« ${nom} »`}
      </a>
      .
    </p>
  )
}

/**
 * Une liste à lire : ce qu'on a, coché, et ce qui manque, avec ce qu'il faut.
 * Rien ne s'y porte ; avec `onToucher`, chaque ligne se touche pour se voir
 * — une gerbe éclate, même à gagner : on sait ce qu'on vise.
 */
function ListeAGagner({
  items,
  onToucher,
}: {
  items: { cle: string; apercu: ReactNode; nom: string; aToi: string | null; regle: string }[]
  onToucher?: (cle: string) => void
}) {
  return (
    <ul className="a-gagner">
      {items.map(i => {
        const contenu = (
          <>
            <span className="a-gagner-apercu" aria-hidden="true">
              {i.apercu}
            </span>
            <span className="a-gagner-texte">
              <b>{i.nom}</b>
              <span className="small">{i.aToi ?? espacesFines(majuscule(i.regle))}</span>
            </span>
            <Icon name={i.aToi ? 'check' : 'lock'} className="a-gagner-marque" />
          </>
        )
        return (
          <li key={i.cle} className={(i.aToi ? 'a-gagner-a-toi' : 'a-gagner-reste') + (onToucher ? ' a-gagner-touchable' : '')}>
            {onToucher ? (
              <button type="button" className="a-gagner-bouton" onClick={() => onToucher(i.cle)}>
                {contenu}
                <span className="sr-only">{i.aToi ? ' : touche-la pour la voir' : ', à gagner : touche-la pour la voir'}</span>
              </button>
            ) : (
              contenu
            )}
          </li>
        )
      })}
    </ul>
  )
}

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Une vignette de l'album : l'aperçu seul, en couleur s'il est à lui, en gris
 * sinon, bordé de sa rareté. Son nom et ce qu'il est pour lui se disent à
 * l'oreille, et dans sa fiche. Un bouton qui déplie, comme les cartes de la
 * boutique : rien ne s'y porte.
 */
function VignetteDeTheme({ t, etat, solde, ouvert, onToucher }: { t: Theme; etat: EtatDuTheme; solde: number; ouvert: boolean; onToucher: () => void }) {
  const apercu = apercuDe(t.key)
  const aLui = etat === 'porte' || etat === 'a-toi'
  return (
    <button
      type="button"
      className={'vignette-theme' + (aLui ? '' : ' vignette-manque') + (etat === 'porte' ? ' vignette-portee' : '') + (ouvert ? ' ouverte' : '')}
      style={gemme(t.rarete)}
      aria-expanded={ouvert}
      aria-controls={ouvert ? 'detail-theme' : undefined}
      aria-label={nomDeLaCase(t, etat, solde)}
      onClick={onToucher}
    >
      {apercu && <img src={apercu} alt="" width={180} height={225} loading="lazy" decoding="async" />}
    </button>
  )
}

/**
 * Les thèmes, en album : une page par rareté, sa gemme et son compte en
 * titre, chaque thème à sa place du catalogue — en couleur ceux qu'on a, en
 * gris ceux qui restent. Les cartes de la boutique, trois par rangée,
 * prenaient quatre écrans pour trente-cinq thèmes (la remarque du 6 octobre
 * 2026). Toucher une vignette ouvre sa fiche sous sa rangée : ce qu'il
 * habille, et comment l'avoir — rien ne s'y achète ni ne s'y porte, un lien
 * mène à l'écran qui le fait (la boutique, « Mon thème », le lieu qui le
 * donne).
 */
function ThemesDeLaCollection({ profil }: { profil: PublicProfileDetail }) {
  const [ouvert, setOuvert] = useState<string | null>(null)
  const porte = profil.theme ?? 'velours'
  const detail = useFiche(ouvert, porte)
  const boutique = profil.boutique
  if (!boutique) return null
  const { solde } = boutique.confettis
  const possedes = new Set(boutique.possedes)
  const etat = (t: Theme) => etatDuTheme(t, porte, possedes, solde, boutique.jour)
  return (
    <>
      <p className="muted small">En couleur, ceux qui sont à toi. Touche un thème : ce qu’il habille, et comment l’avoir.</p>
      {RARETES_DE_THEME.map(r => {
        const themes = THEMES.filter(t => t.rarete === r)
        if (themes.length === 0) return null
        const aLui = themes.filter(t => ['porte', 'a-toi'].includes(etat(t))).length
        return (
          <Fragment key={r}>
            <h4 className="album-rarete" style={gemme(r)}>
              <i aria-hidden="true" />
              {NOM_DE_RARETE[r]} <span className="famille-compte">{`${aLui}/${themes.length}`}</span>
            </h4>
            <div className="album-themes" role="group" aria-label={`${NOM_DE_RARETE[r]} : ${aLui} sur ${themes.length}`}>
              {themes.map(t => (
                <Fragment key={t.key}>
                  <VignetteDeTheme t={t} etat={etat(t)} solde={solde} ouvert={ouvert === t.key} onToucher={() => setOuvert(o => (o === t.key ? null : t.key))} />
                  {ouvert === t.key && (
                    <div id="detail-theme" className="fiche-case theme-fiche" ref={detail}>
                      <DetailTheme theme={t} etat={etat(t)} solde={solde} />
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          </Fragment>
        )
      })}
    </>
  )
}

export function MaCollection({ profil }: { profil: PublicProfileDetail }) {
  const { familles, total } = compteDeLaCollection(profil)
  const [ouverte, setOuverte] = useState<PartieDeLaCollection | null>(() => lireLAdresse(profil).partie)
  // La page de l'album : celle que l'adresse nomme, sinon celle de ce qu'il porte.
  const [page, setPage] = useState<RareteDAvatar>(() => lireLAdresse(profil).page ?? pageDuDebut(profil))
  // Celle des trophées : celle que l'adresse nomme, sinon le mode où il en a le plus.
  const [pageDesTrophees, setPageDesTrophees] = useState<PageDesTrophees>(() => lireLAdresse(profil).trophees ?? pageDuDebutDesTrophees(profil))
  // Ouverte d'un lien (`#collection-themes`), la ligne vient sous les yeux.
  useEffect(() => {
    if (ouverte) document.getElementById(`${ADRESSE}-${ouverte}`)?.scrollIntoView({ block: 'start' })
    // Une fois, à l'ouverture : ensuite, c'est le doigt qui parcourt.
  }, [])
  // Une autre ligne tapée dans l'adresse, la page déjà là : elle s'ouvre — sur sa page de l'album, si elle en nomme une.
  useEffect(() => {
    const relire = () => {
      const lue = lireLAdresse(profil)
      setOuverte(lue.partie)
      if (lue.page) setPage(lue.page)
      if (lue.trophees) setPageDesTrophees(lue.trophees)
    }
    window.addEventListener('hashchange', relire)
    return () => window.removeEventListener('hashchange', relire)
  }, [profil])
  const ecrire = (suite: string) => history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}#${ADRESSE}${suite}`)
  // La ligne ouverte s'écrit dans l'adresse, sans entrée de plus : revenu
  // d'un écran qu'elle a ouvert (« Les porter »), on la retrouve ouverte.
  const toucher = (p: PartieDeLaCollection) => {
    const suivante = ouverte === p ? null : p
    ecrire(suivante ? `-${suivante}` : '')
    setOuverte(suivante)
  }
  // La page de l'album aussi : revenu du sentier qu'une fiche a ouvert, on retrouve la sienne.
  const choisirLaPage = (r: RareteDAvatar) => {
    ecrire(`-avatars-${r}`)
    setPage(r)
  }
  const choisirLaPageDesTrophees = (p: PageDesTrophees) => {
    ecrire(`-trophees-${p}`)
    setPageDesTrophees(p)
  }
  const fonds = profil.fonds ?? []
  const gerbes = profil.gerbes ?? []
  // La gerbe qu'on vient de toucher éclate, une fois par toucher — celles à gagner aussi.
  const [gerbeVue, setGerbeVue] = useState<{ cle: string; n: number } | null>(null)

  const contenus: Partial<Record<PartieDeLaCollection, ReactNode>> = {
    avatars: (
      <>
        <AlbumDesAvatars profil={profil} page={page} onPage={choisirLaPage} />
        <OuLePorter ecran="avatar" nom="Mon avatar" />
      </>
    ),
    trophees: (
      <>
        <AlbumDesTrophees profil={profil} page={pageDesTrophees} onPage={choisirLaPageDesTrophees} />
        {/* Un trophée se porte en titre, ou dans la vitrine de sa carte : la loge les choisit. */}
        <p className="muted small">
          Un trophée gagné se porte en titre sous ton prénom, ou dans la vitrine de ta carte :{' '}
          <a className="link-inline" href="#titre">
            {espacesFines('« Mon titre »')}
          </a>
          ,{' '}
          <a className="link-inline" href="#vitrine">
            {espacesFines('« Ma vitrine »')}
          </a>
          .
        </p>
      </>
    ),
    themes: <ThemesDeLaCollection profil={profil} />,
    fonds: (
      <>
        <ListeAGagner
          items={FONDS.map(f => ({
            cle: f.key,
            apercu: <span className={`fond-apercu carte-fond fond-${f.key}`} />,
            nom: f.nom,
            aToi: fonds.includes(f.key) ? (profil.fond === f.key ? 'Porté' : 'À toi') : null,
            regle: f.regle,
          }))}
        />
        <OuLePorter ecran="fond" nom="Mon fond de carte" quoi="Il se porte dans" />
      </>
    ),
    gerbes: (
      <>
        <p className="muted small">Touche une gerbe pour la voir éclater, même celles à gagner.</p>
        <ListeAGagner
          items={GERBES.map(g => ({
            cle: g.key,
            apercu: <span className="gerbe-apercu">{g.particules.slice(0, 3).join('')}</span>,
            nom: g.nom,
            aToi: gerbes.includes(g.key) ? (profil.gerbe === g.key ? 'Portée' : 'À toi') : null,
            regle: g.regle,
          }))}
          onToucher={cle => setGerbeVue(a => ({ cle, n: (a?.n ?? 0) + 1 }))}
        />
        {gerbeVue && <GerbeDeJuste key={gerbeVue.n} cle={gerbeVue.cle} />}
        <OuLePorter ecran="gerbe" nom="Ma gerbe" quoi="Elle se porte dans" />
      </>
    ),
    finitions: (
      <>
        <ListeAGagner
          items={FINITIONS.map(f => ({
            cle: f,
            apercu: <Avatar avatar={profil.avatar} finition={f} />,
            nom: NOM_FINITION[f],
            aToi: profil.ouvertes.includes(f) ? (profil.finition === f ? 'Portée' : 'À toi') : null,
            regle: `au niveau ${NIVEAU_FINITION[f]}`,
          }))}
        />
        <p className="muted small">
          L’Éclat, lui, ne se gagne pas : une chance sur quarante par soirée jouée à deux ou plus et par quiz du jour, une sur vingt
          par défi de la semaine, et c’est l’avatar lui-même qui change de couleurs.
        </p>
        <OuLePorter ecran="avatar" nom="Mon avatar" quoi="Elle se choisit dans" />
      </>
    ),
  }

  const ligne = (c: LigneDuCompte) => {
    const l = LIGNES[c.partie]
    return (
      <LigneDeCollection
        key={c.partie}
        id={`${ADRESSE}-${c.partie}`}
        emoji={l.emoji}
        nom={l.nom}
        detail={l.detail}
        compte={`${c.acquis}/${c.total}`}
        part={c.acquis / Math.max(1, c.total)}
        couleur={l.couleur}
        ouverte={ouverte === c.partie}
        onToucher={() => toucher(c.partie)}
      >
        {contenus[c.partie]}
      </LigneDeCollection>
    )
  }

  return (
    <div className="collection">
      <div className="collection-tete">
        <p className="collection-total">
          <b>{formatNumber(total.acquis)}</b> sur {formatNumber(total.total)}
        </p>
        <JaugeFine part={total.acquis / Math.max(1, total.total)} />
        <p className="muted small">
          {/* « Ma carte » n'existe plus : chaque pièce a sa place dans la loge, derrière « M'habiller ». */}
          {espacesFines('Touche une ligne : ce que tu as, ce qui reste, et où le gagner. On n’y change rien — ce qui est à toi se porte depuis « M’habiller », sur ton profil.')}
        </p>
      </div>
      {familles.map(f => (
        <section key={f.famille} className="collection-famille" aria-labelledby={`famille-${f.famille}`}>
          <h2 id={`famille-${f.famille}`}>
            {NOM_DE_FAMILLE[f.famille]} <span className="collection-compte">{`${formatNumber(f.acquis)} sur ${formatNumber(f.total)}`}</span>
          </h2>
          <ul className="trophees-liste">{f.parties.map(ligne)}</ul>
        </section>
      ))}
    </div>
  )
}
