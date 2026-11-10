import { Fragment, useEffect, useRef, useState } from 'react'
import { gemme } from '../gemmes'
import { Icon } from './Icon'
import { rendreLeFocus } from '../focus'
import { espacesFines, formatNumber } from '../format'
import { NOM_DE_RARETE, THEMES, enBoutique, prixDe, retourEnBoutique, type Theme } from '../../../shared/themes'
import { enConfettis, themesEnRayon } from '../../../shared/rayons'
import type { PublicProfileDetail } from '../../../shared/profil'
import { AGagner } from './LigneDeCollection'
import { apercuDe } from '../apercus'
import type { PropsDUnePiece } from './choix'

// Les thèmes : ce qui habille toutes ses pages — la soirée, son profil, ses
// quiz, son compte —, sauf l'écran commun, acheté en confettis
// (`shared/themes.ts`). Une bonne réponse, un confetti. La boutique ne montre
// que ce qui reste à prendre, en tuiles serrées, trois par rangée sur un
// téléphone, du moins cher au plus cher (`RayonDesThemes`, la refonte du
// 10 novembre 2026) ; ce qu'on a se porte dans « Mon thème » (`MesThemes`),
// en grandes cartes : l'écran d'une question sous chaque thème. « Ma
// collection » les montre tous, en vignettes rangées par rareté, ceux qui ne
// se vendent pas compris, et la même fiche dit où les gagner.
//
// À la boutique, toucher un thème ouvre son présentoir (`Presentoir.tsx`) :
// il s'y essaie — toute la page le porte, rien n'est enregistré (le souhait
// du propriétaire du 1er novembre 2026 : « pouvoir essayer sans acheter ») —
// et s'y achète. Dans la loge, le toucher l'essaie aussi, et « Porter », dans
// sa barre, le garde. Un thème se portait d'un toucher, enregistré : le doigt
// qui voulait le regarder habillait déjà toute la page, pour de bon.

export type EtatDuTheme = 'porte' | 'a-toi' | 'a-vendre' | 'trop-cher' | 'hors-saison' | 'a-gagner'

/**
 * Ce qu'est un thème pour lui, ce jour-là : porté, à lui, à vendre, trop
 * cher pour l'instant, hors de sa saison — ou à gagner : celui-là ne se vend
 * jamais, et son prix ne voudrait rien dire.
 */
export function etatDuTheme(t: Theme, porte: string, possedes: ReadonlySet<string>, solde: number, jour: string): EtatDuTheme {
  if (t.key === porte) return 'porte'
  if (possedes.has(t.key)) return 'a-toi'
  if (t.gagne) return 'a-gagner'
  if (!enBoutique(t, jour)) return 'hors-saison'
  return prixDe(t) > solde ? 'trop-cher' : 'a-vendre'
}

/** Sa case, dite à l'oreille d'une traite : son nom, puis ce qu'il est pour lui. */
export function nomDeLaCase(t: Theme, etat: EtatDuTheme, solde: number): string {
  if (etat === 'porte') return `${t.nom}, porté`
  if (etat === 'a-toi') return `${t.nom}, à toi`
  if (etat === 'a-gagner') return `${t.nom}, ${NOM_DE_RARETE[t.rarete]}, se gagne`
  const prix = `${NOM_DE_RARETE[t.rarete]}, ${formatNumber(prixDe(t))} confettis`
  if (etat === 'trop-cher') return `${t.nom}, ${prix}, encore ${formatNumber(prixDe(t) - solde)}`
  if (etat === 'hors-saison') return `${t.nom}, ${prix}, ${retourEnBoutique(t)}`
  return `${t.nom}, ${prix}`
}

// La couleur de chaque rareté vit à part (`gemmes.ts`) : la fin d'une partie la lit sans la boutique.
export { gemme }

/**
 * La fiche ouverte s'ouvre juste sous sa case, et reçoit le focus sur son
 * nom : le lecteur d'écran la lit. La page ne défile que ce qu'il faut pour
 * la montrer entière, son bouton compris. Porté, un thème n'a plus de
 * bouton : le focus qui y était tombait sur la page, il revient au nom.
 */
export function useFiche(ouvert: string | null, porte: string) {
  const detail = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fiche = detail.current
    if (!ouvert || !fiche) return
    const nom = fiche.querySelector<HTMLElement>('.galerie-detail-nom')
    if (nom) {
      nom.tabIndex = -1
      nom.focus({ preventScroll: true })
    }
    const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    fiche.scrollIntoView({ block: 'nearest', behavior: calme ? 'auto' : 'smooth' })
  }, [ouvert])
  useEffect(() => {
    rendreLeFocus(detail.current, ['.galerie-detail-nom'])
  }, [porte])
  return detail
}

/**
 * Le prix d'un article, sur sa tuile : à l'or quand son solde le paie, en
 * gris sinon — d'un coup d'œil, ce qu'il peut s'offrir aujourd'hui. Aucun
 * aperçu ne s'éteint pour autant : ce qu'on vise se regarde aussi. Un thème
 * y pose la gemme de sa rareté, à la couleur que sa tuile lui donne.
 */
export function PrixDeLaTuile({ prix, solde, avecGemme = false }: { prix: number; solde: number; avecGemme?: boolean }) {
  return (
    <span className={'article-prix' + (prix > solde ? ' article-prix-loin' : '')}>
      {avecGemme && <i className="article-gemme" aria-hidden="true" />}
      {enConfettis(prix)}
    </span>
  )
}

/**
 * La tuile d'un thème, à la boutique : le haut de son aperçu — la question,
 * ses premières réponses : assez pour le reconnaître —, son nom entier, sur
 * deux lignes s'il le faut, et son prix. Trois par rangée sur un téléphone :
 * neuf thèmes à l'arrivée en 360 × 640, là où les cartes de l'étagère en
 * montraient un et demi. Elle ouvre son présentoir, et dit ce qu'elle est
 * pour lui : à l'essai, son envie, ou de saison — une saison ne dure que
 * quelques jours.
 */
function TuileDeTheme({
  t,
  etat,
  solde,
  essaye,
  envie,
  onToucher,
}: {
  t: Theme
  etat: EtatDuTheme
  solde: number
  /** La page l'essaie. */
  essaye: boolean
  /** C'est pour lui qu'il économise. */
  envie: boolean
  onToucher: () => void
}) {
  const apercu = apercuDe(t.key)
  return (
    <button
      type="button"
      className={'article-boutique article-theme' + (essaye ? ' article-essayee' : '')}
      style={gemme(t.rarete)}
      aria-haspopup="dialog"
      aria-label={nomDeLaCase(t, etat, solde) + (essaye ? ', à l’essai' : '') + (envie ? ', ton envie' : '')}
      onClick={onToucher}
    >
      <span className="article-image" aria-hidden="true">
        {apercu && <img src={apercu} alt="" width={180} height={225} loading="lazy" decoding="async" />}
      </span>
      {essaye ? (
        <span className="article-marque">à l’essai</span>
      ) : envie ? (
        <span className="article-marque">
          <Icon name="star" />
          envie
        </span>
      ) : (
        t.saison && <span className="article-marque">de saison</span>
      )}
      <span className="article-pied">
        <b className="article-nom">{t.nom}</b>
        <PrixDeLaTuile prix={prixDe(t)} solde={solde} avecGemme />
      </span>
    </button>
  )
}

/**
 * Une carte de thème, dans la loge : l'aperçu en grand, le nom, et dessous
 * ce qu'il est pour lui. Elle déplie sa fiche sous sa rangée — un bouton qui
 * déplie, pas un interrupteur : `aria-pressed` disait qu'un toucher le
 * portait.
 */
function CarteDeTheme({
  t,
  etat,
  solde,
  ouvert = false,
  essaye = false,
  neuf = false,
  onToucher,
}: {
  t: Theme
  etat: EtatDuTheme
  solde: number
  /** Sa fiche est dépliée sous elle. */
  ouvert?: boolean
  /** La page l'essaie. */
  essaye?: boolean
  /** Arrivé depuis son dernier passage. */
  neuf?: boolean
  onToucher: () => void
}) {
  const apercu = apercuDe(t.key)
  const pied = essaye
    ? 'À l’essai'
    : etat === 'porte'
      ? 'Porté'
      : etat === 'a-toi'
        ? neuf
          ? 'Nouveau'
          : NOM_DE_RARETE[t.rarete]
        : etat === 'a-gagner'
          ? 'Se gagne'
          : etat === 'trop-cher'
            ? `encore ${formatNumber(prixDe(t) - solde)}`
            : enConfettis(prixDe(t))
  return (
    <button
      type="button"
      className={
        'theme-vitrine' +
        (etat === 'trop-cher' ? ' theme-cher' : '') +
        (etat === 'porte' ? ' theme-porte' : '') +
        (essaye ? ' theme-essaye' : '') +
        (neuf ? ' neuve' : '') +
        (ouvert ? ' ouverte' : '')
      }
      style={gemme(t.rarete)}
      aria-expanded={ouvert}
      aria-controls={ouvert ? 'detail-theme' : undefined}
      aria-label={nomDeLaCase(t, etat, solde) + (essaye ? ', à l’essai' : '') + (neuf ? ', nouveau' : '')}
      onClick={onToucher}
    >
      <span className="theme-vitrine-image" aria-hidden="true">
        {apercu && <img src={apercu} alt="" width={180} height={225} loading="lazy" decoding="async" />}
      </span>
      <span className="theme-vitrine-pied">
        <b>{t.nom}</b>
        <span className="theme-vitrine-prix">{pied}</span>
      </span>
    </button>
  )
}

/**
 * Le rayon des thèmes, à la boutique : ce qu'il n'a pas et que la saison
 * permet, dans une seule grille, du moins cher au plus cher — l'ordre du
 * catalogue, la gemme de chaque rareté devant son prix. Une étagère par
 * rareté, qu'on faisait glisser de côté, montrait deux cartes sur cinq et
 * demandait cinq gestes pour tout voir (385 à 1867 px de page en 360 × 640,
 * mesuré le 10 novembre 2026) ; avant elle, une rareté à la fois cachait les
 * quatre autres. Ceux qui ne se vendent pas n'y sont pas : ils se gagnent, et
 * « Ma collection » dit où (la remarque du 6 octobre 2026). Toucher une tuile
 * ouvre son présentoir.
 */
export function RayonDesThemes({
  profil,
  essai,
  envie,
  onOuvrir,
}: {
  profil: PublicProfileDetail
  /** Le thème que la page essaie. */
  essai?: string
  /** Le thème pour lequel il économise. */
  envie?: string
  onOuvrir: (cle: string) => void
}) {
  const boutique = profil.boutique
  if (!boutique) return null
  const solde = boutique.confettis.solde
  // Le thème porté se lit dans le profil, que chaque enregistrement rend à
  // jour — jamais dans la boutique, lue une fois avec la page.
  const porte = profil.theme ?? 'velours'
  const possedes = new Set(boutique.possedes)
  const enRayon = themesEnRayon(boutique.possedes, boutique.jour)
  return (
    <>
      {enRayon.length === 0 ? (
        <p className="card muted">Tu as tous les thèmes de la boutique. Ceux des saisons reviennent avec elles.</p>
      ) : (
        <ul className="rayon-grille grille-themes" aria-label="Les thèmes">
          {enRayon.map(t => (
            <li key={t.key}>
              <TuileDeTheme t={t} etat={etatDuTheme(t, porte, possedes, solde, boutique.jour)} solde={solde} essaye={essai === t.key} envie={envie === t.key} onToucher={() => onOuvrir(t.key)} />
            </li>
          ))}
        </ul>
      )}
      <p className="rayon-suite">
        {possedes.size} thème{possedes.size > 1 ? 's' : ''} déjà à toi ·{' '}
        <a className="link-inline" href="/profil#theme">
          les porter
        </a>
      </p>
    </>
  )
}

/**
 * « Mes thèmes », la pièce « Thème » de la loge : seulement ceux qu'il a,
 * en grandes cartes, celui qu'il porte en tête. Toucher un thème
 * l'essaie — la page entière le porte, rien n'est enregistré — et ouvre sa
 * fiche ; « Porter », dans la barre de la loge, le garde. Un thème se portait
 * d'un toucher, enregistré : le doigt qui voulait le regarder habillait déjà
 * toute la page, pour de bon.
 */
export function MesThemes({ profil, essai, essayer, neufs }: PropsDUnePiece) {
  const [ouvert, setOuvert] = useState<string | null>(null)
  const porte = profil.theme ?? 'velours'
  // Le thème que la page porte : l'essai, sinon le sien.
  const montre = essai.theme !== undefined ? (essai.theme ?? 'velours') : porte
  const detail = useFiche(ouvert, porte)
  const boutique = profil.boutique
  if (!boutique) return null
  const { solde } = boutique.confettis
  const possedes = new Set(boutique.possedes)
  const siens = THEMES.filter(t => possedes.has(t.key)).sort((a, b) => Number(b.key === porte) - Number(a.key === porte))
  const aVendre = THEMES.filter(t => !possedes.has(t.key) && enBoutique(t, boutique.jour)).length
  const aGagner = THEMES.filter(t => t.gagne && !possedes.has(t.key)).length
  const toucher = (cle: string) => {
    setOuvert(o => (o === cle ? null : cle))
    essayer({ theme: cle === 'velours' ? null : cle })
  }
  return (
    <section className="mes-themes">
      <p className="gemme-legende">
        <b>
          {siens.length} thème{siens.length > 1 ? 's' : ''}
        </b>{' '}
        {/* Ce qu'il habille, la ligne de la pièce le dit : ici, comment l'essayer. */}
        · {espacesFines('de la soirée à tes quiz. Touches-en un : toute la page l’essaie.')}
      </p>
      <div className="vitrine-themes" role="group" aria-label="Mes thèmes">
        {siens.map(t => {
          const etat = etatDuTheme(t, porte, possedes, solde, boutique.jour)
          const essaye = montre === t.key && t.key !== porte
          return (
            <Fragment key={t.key}>
              <CarteDeTheme t={t} etat={etat} solde={solde} ouvert={ouvert === t.key} essaye={essaye} neuf={neufs?.has(t.key)} onToucher={() => toucher(t.key)} />
              {ouvert === t.key && (
                <div id="detail-theme" className="fiche-case theme-fiche" ref={detail}>
                  <DetailTheme theme={t} etat={etat} solde={solde} dansLaLoge essaye={essaye} />
                </div>
              )}
            </Fragment>
          )
        })}
      </div>
      {/* Ce qu'il n'a pas encore, en deux liens : la boutique pour ce qui
          s'achète, la collection pour ce qui se gagne — et où. L'écran ne
          montre que ce qu'on porte. */}
      <a className="link-inline lien-boutique" href="/boutique">
        <Icon name="palette" />
        {aVendre > 0 ? `${aVendre} autre${aVendre > 1 ? 's' : ''} à la boutique` : 'La boutique'}
      </a>
      {/* Ceux qui ne se vendent pas : le lien de toutes les pièces de la loge, vers la collection. */}
      <AGagner n={aGagner} un="thème" plusieurs="thèmes" href="#collection-themes" />
    </section>
  )
}

/**
 * La fiche d'un thème, sous sa case : son nom, son aperçu en grand, ce qu'il
 * habille, et le seul geste qui compte ce jour-là — le porter, l'acheter —,
 * ou ce qui manque encore. L'écran commun garde le sien : c'est ici qu'on le
 * dit, au moment de choisir. Sans `onPorter` ni `onAcheter` — « Ma
 * collection », qui ne fait que montrer —, un lien mène à l'écran qui le
 * fait ; un thème qui se gagne dit comment, et où.
 */
export function DetailTheme({
  theme: t,
  etat,
  solde,
  busy = false,
  erreur,
  dansLaLoge = false,
  essaye = false,
  onPorter,
  onAcheter,
}: {
  theme: Theme
  etat: EtatDuTheme
  solde: number
  /** Un enregistrement en route ; « Ma collection » n'en fait aucun. */
  busy?: boolean
  /** Le refus d'un achat, dit là où l'on a touché. */
  erreur?: string
  /** Ouverte dans la loge, où un toucher essaie : « Porter » est dans sa barre. */
  dansLaLoge?: boolean
  /** La page l'essaie. */
  essaye?: boolean
  /** Le porter ; null : Velours, celui de toutes les soirées. */
  onPorter?: (cle: string | null) => void
  onAcheter?: (theme: Theme) => void
}) {
  const prix = prixDe(t)
  const apercu = apercuDe(t.key)
  return (
    <div className="galerie-detail detail-case detail-theme">
      <span className="detail-famille muted">
        {t.rarete === 'offert' ? 'Offert' : t.gagne ? `${NOM_DE_RARETE[t.rarete]} · il se gagne` : `${NOM_DE_RARETE[t.rarete]} · ${enConfettis(prix)}`}
      </span>
      <b className="galerie-detail-nom">{t.nom}</b>
      {apercu && (
        <span className="detail-apercu" aria-hidden="true">
          <img src={apercu} alt="" width={180} height={260} loading="lazy" decoding="async" />
        </span>
      )}
      <p className="muted small">{t.humeur}</p>
      {etat === 'porte' && <p className="muted small">C’est lui qui habille tes pages. L’écran commun garde le sien.</p>}
      {etat === 'a-toi' && dansLaLoge && (
        <p className="muted small">
          {essaye ? espacesFines('À l’essai sur toute la page : « Porter », en bas, le garde. L’écran commun garde le sien.') : 'À toi : touche sa carte pour l’essayer.'}
        </p>
      )}
      {etat === 'a-toi' &&
        !dansLaLoge &&
        (onPorter ? (
          <button
            type="button"
            className="btn btn-small btn-primary"
            aria-disabled={busy || undefined}
            onClick={() => onPorter(t.key === 'velours' ? null : t.key)}
          >
            Le porter
          </button>
        ) : (
          <p className="muted small">
            À toi : il se porte dans{' '}
            <a className="link-inline" href="#theme">
              « Mon thème »
            </a>
            .
          </p>
        ))}
      {etat === 'a-vendre' && (
        <>
          <p className="muted small">
            {`Il coûte ${formatNumber(prix)} confettis : il t’en restera ${formatNumber(solde - prix)}.`}
            {t.saison && ` En boutique ${t.saison.periode}, et gardé toute l’année.`}
          </p>
          {onAcheter ? (
            <button type="button" className="btn btn-small btn-primary" aria-disabled={busy || undefined} onClick={() => onAcheter(t)}>
              {`L’acheter · ${enConfettis(prix)}`}
            </button>
          ) : (
            <a className="link-inline" href="/boutique">
              La boutique
            </a>
          )}
        </>
      )}
      {etat === 'trop-cher' && (
        <p className="muted small">
          Il coûte {formatNumber(prix)} confettis : <b>encore {formatNumber(prix - solde)}</b>.{t.saison && ` En boutique ${t.saison.periode}.`} Une bonne réponse, un confetti.
        </p>
      )}
      {etat === 'hors-saison' && t.saison && (
        <p className="muted small">{`En boutique ${t.saison.periode} seulement — acheté, il se garde toute l’année.`}</p>
      )}
      {etat === 'a-gagner' && t.gagne && (
        <>
          <p className="muted small">{espacesFines(`Il ne se vend pas : il se gagne avec ${t.gagne.regle}.`)}</p>
          <a className="link-inline" href={t.gagne.ou.lien}>
            {t.gagne.ou.nom}
          </a>
        </>
      )}
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
    </div>
  )
}
