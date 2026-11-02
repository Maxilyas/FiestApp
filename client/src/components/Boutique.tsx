import { Fragment, useEffect, useRef, useState } from 'react'
import { gemme } from '../gemmes'
import { Icon } from './Icon'
import { Avatar } from './Avatar'
import { choixDialog } from './Dialog'
import { Feuille } from './Pieces'
import { rendreLeFocus } from '../focus'
import { espacesFines, formatNumber } from '../format'
import {
  NOM_DE_RARETE,
  RARETES_DE_THEME,
  THEMES,
  enBoutique,
  prixDe,
  retourEnBoutique,
  type Theme,
} from '../../../shared/themes'
import { jusquAuBoutDeSaSaison } from '../../../shared/aLaUne'
import type { PublicProfileDetail } from '../../../shared/profil'
import type { VieDesSentiers } from '../../../shared/sentiers'
import { avatarDeLApercu } from '../../../shared/sonAvatar'
import { SABLIERS_MAX } from '../../../shared/jour'
import { OBJETS, type CleDObjet, type Objet } from './Objets'
import { AGagner } from './LigneDeCollection'
import { api, motifDe } from '../api'
import { apercuDe } from '../apercus'
import type { PropsDUnePiece } from './choix'

// Les thèmes : ce qui habille toutes ses pages — la soirée, son profil, ses
// quiz, son compte —, sauf l'écran commun, acheté en confettis
// (`shared/themes.ts`). Une bonne réponse, un confetti. La boutique ne montre
// que ce qui reste à prendre, toutes les raretés à la suite, chacune son
// étagère (`RayonDesThemes`) ; ce qu'on a se porte dans « Mon thème »
// (`MesThemes`). Les deux dans les mêmes cartes : l'écran d'une question sous
// chaque thème. « Ma collection » les montre tous, en vignettes rangées par
// rareté, ceux qui ne se vendent pas compris, et la même fiche dit où les
// gagner.
//
// À la boutique, toucher un thème ouvre sa fiche dans une feuille : il s'y
// essaie — toute la page le porte, rien n'est enregistré (le souhait du
// propriétaire du 1er novembre 2026 : « pouvoir essayer sans acheter ») — et
// s'y achète. Dans la loge, le toucher l'essaie aussi, et « Porter », dans sa
// barre, le garde. Un thème se portait d'un toucher, enregistré : le doigt qui
// voulait le regarder habillait déjà toute la page, pour de bon.

export type EtatDuTheme = 'porte' | 'a-toi' | 'a-vendre' | 'trop-cher' | 'hors-saison' | 'a-gagner'

/** « 🎊 400 », en chiffres à la française. */
const enConfettis = (n: number) => `🎊 ${formatNumber(n)}`

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
 * Une carte de thème : l'aperçu en grand, le nom, et dessous ce qu'il est
 * pour lui. Dans la loge, elle déplie sa fiche sous sa rangée — un bouton qui
 * déplie, pas un interrupteur : `aria-pressed` disait qu'un toucher le
 * portait ; à la boutique, elle ouvre sa feuille.
 */
function CarteDeTheme({
  t,
  etat,
  solde,
  ouvert = false,
  feuille = false,
  essaye = false,
  neuf = false,
  onToucher,
}: {
  t: Theme
  etat: EtatDuTheme
  solde: number
  /** Dans la loge : sa fiche est dépliée sous elle. */
  ouvert?: boolean
  /** À la boutique : elle ouvre sa fiche dans une feuille. */
  feuille?: boolean
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
      aria-expanded={feuille ? undefined : ouvert}
      aria-controls={!feuille && ouvert ? 'detail-theme' : undefined}
      aria-haspopup={feuille ? 'dialog' : undefined}
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
      {/* Une saison ne dure que quelques jours : elle se dit. */}
      {t.saison && etat !== 'porte' && etat !== 'a-toi' && <span className="theme-saison">{t.saison.periode}</span>}
    </button>
  )
}

/**
 * Le rayon des thèmes, à la boutique : ce qu'il n'a pas et que la saison
 * permet, toutes les raretés à la suite, du Commun au Légendaire, chacune son
 * étagère qu'on fait glisser du doigt. Une rareté à la fois, choisie sur une
 * rangée de gemmes, cachait les quatre autres : on ne voyait un Légendaire
 * qu'en sachant toucher la cinquième (la refonte du 1er novembre 2026). Ceux
 * qui ne se vendent pas n'y sont pas : ils se gagnent, et « Ma collection »
 * dit où (la remarque du 6 octobre 2026). Toucher une carte ouvre sa fiche.
 */
export function RayonDesThemes({
  profil,
  essai,
  onOuvrir,
}: {
  profil: PublicProfileDetail
  /** Le thème que la page essaie. */
  essai?: string
  onOuvrir: (cle: string) => void
}) {
  const boutique = profil.boutique
  if (!boutique) return null
  const solde = boutique.confettis.solde
  // Le thème porté se lit dans le profil, que chaque enregistrement rend à
  // jour — jamais dans la boutique, lue une fois avec la page.
  const porte = profil.theme ?? 'velours'
  const possedes = new Set(boutique.possedes)
  const aPrendre = THEMES.filter(t => t.rarete !== 'offert' && !possedes.has(t.key) && enBoutique(t, boutique.jour))
  const raretes = RARETES_DE_THEME.filter(r => aPrendre.some(t => t.rarete === r))
  return (
    <>
      {solde < 0 && <p className="muted small">Une soirée retirée de l’historique a repris ses confettis. Tes thèmes, eux, te restent.</p>}
      {raretes.length === 0 ? (
        <p className="card muted">Tu as tous les thèmes de la boutique. Ceux des saisons reviennent avec elles.</p>
      ) : (
        raretes.map(r => {
          const liste = aPrendre.filter(t => t.rarete === r)
          return (
            <div key={r} className="etagere-rarete" style={gemme(r)}>
              <h3 className="etagere-titre">
                <i aria-hidden="true" />
                {NOM_DE_RARETE[r]}
                <span className="muted">{` · ${enConfettis(prixDe(liste[0]))} le thème`}</span>
              </h3>
              <ul className="etagere" aria-label={`Thèmes : ${NOM_DE_RARETE[r]}`}>
                {liste.map(t => (
                  <li key={t.key}>
                    <CarteDeTheme t={t} etat={etatDuTheme(t, porte, possedes, solde, boutique.jour)} solde={solde} feuille essaye={essai === t.key} onToucher={() => onOuvrir(t.key)} />
                  </li>
                ))}
              </ul>
            </div>
          )
        })
      )}
      <p className="muted small center">
        {possedes.size} thème{possedes.size > 1 ? 's' : ''} déjà à toi : <a className="link-inline" href="/profil#theme">les porter</a>
      </p>
    </>
  )
}

/**
 * « L'acheter » : le porter tout de suite, ou le garder pour plus tard — on
 * achète aussi un thème de saison avant qu'il ne parte, ou pour son album,
 * sans quitter celui qu'on aime (un retour de joueur du 10 octobre 2026).
 * Rend null s'il renonce ; sinon s'il le porte, et le motif d'un refus.
 */
export async function acheterUnTheme(
  t: Theme,
  solde: number,
  acheter: (cle: string, porter: boolean) => Promise<string | null>,
): Promise<{ porter: boolean; refus: string | null } | null> {
  const prix = prixDe(t)
  const choix = await choixDialog({
    title: `${t.nom} · ${NOM_DE_RARETE[t.rarete]}`,
    message: `Il coûte ${formatNumber(prix)} confettis : il t’en restera ${formatNumber(solde - prix)}.`,
    confirmLabel: `Acheter et porter · ${enConfettis(prix)}`,
    alternative: { label: 'L’acheter seulement' },
    cancelLabel: 'Plus tard',
  })
  if (!choix) return null
  const porter = choix.geste === 'confirmer'
  const refus = await acheter(t.key, porter)
  return { porter, refus }
}

/**
 * La fiche d'un thème à la boutique, dans une feuille : son aperçu en grand,
 * son humeur, ce qu'il habille, et ses deux gestes, au pied, sous le pouce —
 * « L'essayer », que toute la page porte, et « L'acheter ». Trop cher, il
 * s'essaie quand même : on voit ce qu'on vise. Acheté, la fiche dit où il est
 * passé : sur ses pages, ou dans sa loge.
 */
export function FicheDuTheme({
  theme: t,
  etat,
  solde,
  busy,
  erreur,
  essaye,
  onEssayer,
  onAcheter,
  onFermer,
}: {
  theme: Theme
  etat: EtatDuTheme
  solde: number
  busy: boolean
  /** Le refus d'un achat, dit là où l'on a touché. */
  erreur?: string
  /** La page l'essaie. */
  essaye: boolean
  onEssayer: () => void
  onAcheter: () => void
  onFermer: () => void
}) {
  const prix = prixDe(t)
  const apercu = apercuDe(t.key)
  const fin = jusquAuBoutDeSaSaison(t)
  const enVente = etat === 'a-vendre' || etat === 'trop-cher'
  return (
    <Feuille
      titre={t.nom}
      onFermer={onFermer}
      className="feuille-boutique"
      pied={
        enVente && (
          <div className="fiche-gestes">
            {/* Un interrupteur : son nom ne change pas, `aria-pressed` dit s'il est à l'essai. */}
            <button type="button" className="btn btn-ghost" aria-pressed={essaye} onClick={onEssayer}>
              L’essayer
            </button>
            <button type="button" className="btn btn-primary" aria-disabled={busy || etat === 'trop-cher' || undefined} onClick={() => etat === 'a-vendre' && onAcheter()}>
              {etat === 'trop-cher' ? `Encore ${formatNumber(prix - solde)} confettis` : `L’acheter · ${enConfettis(prix)}`}
            </button>
          </div>
        )
      }
    >
      <div className="fiche-boutique" style={gemme(t.rarete)}>
        {apercu && (
          <span className="fiche-apercu" aria-hidden="true">
            <img src={apercu} alt="" width={180} height={225} decoding="async" />
          </span>
        )}
        <span className="detail-famille muted">{`${NOM_DE_RARETE[t.rarete]} · ${enConfettis(prix)}${fin ? ` · ${fin}` : ''}`}</span>
        <p>{t.humeur}</p>
        <p className="muted small">{espacesFines('Il habille tes pages : la soirée sur ton téléphone, ton profil, tes quiz. L’écran commun garde le sien.')}</p>
        {etat === 'a-vendre' && (
          <p className="muted small">
            {`Il coûte ${formatNumber(prix)} confettis : il t’en restera ${formatNumber(solde - prix)}.`}
            {t.saison && ` En boutique ${t.saison.periode}, et gardé toute l’année.`}
          </p>
        )}
        {etat === 'trop-cher' && (
          <p className="muted small">
            Il coûte {formatNumber(prix)} confettis : <b>encore {formatNumber(prix - solde)}</b>. {espacesFines('Essaie-le quand même : toute la page le porte, rien ne s’achète.')}
          </p>
        )}
        {/* Ouvert par son adresse hors de sa saison, ou un thème qui se gagne : la fiche dit pourquoi rien ne s'y achète. */}
        {etat === 'hors-saison' && t.saison && <p className="muted small">{`En boutique ${t.saison.periode} seulement — acheté, il se garde toute l’année.`}</p>}
        {etat === 'a-gagner' && t.gagne && (
          <p className="muted small">
            {espacesFines(`Il ne se vend pas : il se gagne avec ${t.gagne.regle}. `)}
            <a className="link-inline" href={t.gagne.ou.lien}>
              {t.gagne.ou.nom}
            </a>
          </p>
        )}
        {etat === 'porte' && <p className="small fiche-achete">{`${t.nom} habille tes pages.`}</p>}
        {etat === 'a-toi' && (
          <p className="small fiche-achete">
            {`${t.nom} est à toi : `}
            <a className="link-inline" href="/profil#theme">
              le porter
            </a>
            {' quand tu veux.'}
          </p>
        )}
        {erreur && (
          <p className="error" role="alert">
            {erreur}
          </p>
        )}
      </div>
    </Feuille>
  )
}

/**
 * « Mes thèmes », la pièce « Thème » de la loge : seulement ceux qu'il a,
 * dans les cartes de la boutique, celui qu'il porte en tête. Toucher un thème
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

/**
 * Le comptoir des objets : ce qui sert en jeu et s'achète en confettis — une
 * vie des sentiers, un sablier pour la série du quiz du jour, l'Éclat. Une
 * grande case chacun, à sa couleur : son dessin, ce qu'il change pour lui, ce
 * qu'il en a et son prix — en icônes de la taille d'un bouton, le sablier qui
 * sauve une série de trente jours ne se voyait pas (la refonte du 1er novembre
 * 2026). L'Éclat montre son avatar tel qu'il est, puis éclaté. Toucher une
 * case ouvre sa fiche dans une feuille — ce que c'est, combien on en prend,
 * ce que ça coûte —, d'où l'on achète, jamais d'un toucher (le geste des
 * thèmes). C'est le serveur qui compte : les vies avec les sentiers, les
 * sabliers avec la série.
 */
export function RayonDesObjets({
  profil,
  ouvert,
  onOuvrir,
  onFermer,
  onSolde,
}: {
  profil: PublicProfileDetail
  /** L'objet dont la fiche est ouverte. */
  ouvert: CleDObjet | null
  onOuvrir: (cle: CleDObjet) => void
  onFermer: () => void
  onSolde: (solde: number) => void
}) {
  const [vies, setVies] = useState<VieDesSentiers | null>(null)
  const [sabliers, setSabliers] = useState(profil.jour?.sabliers ?? 0)
  const [eclats, setEclats] = useState(profil.eclatsEnReserve ?? 0)
  useEffect(() => {
    let vivant = true
    api.campagne.sentiers
      .etat()
      .then(e => vivant && setVies(e.vies))
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [])
  const solde = profil.boutique?.confettis.solde
  if (solde === undefined) return null
  /**
   * Ce qu'on en a, en court sur la case — en entier dans la fiche. Les vies du
   * jour reviennent chaque matin : la case ne compte que la réserve, et rien
   * quand elle est vide — un « 0 » seul ne disait pas de quoi.
   */
  const possede = (o: Objet): { court: string | null; long: string } | null => {
    if (o.cle === 'vie')
      return vies ? { court: vies.reserve > 0 ? `${vies.reserve} en réserve` : null, long: `${vies.jour} aujourd’hui · ${vies.reserve} en réserve` } : null
    if (o.cle === 'eclat') return { court: eclats > 0 ? `${eclats} en réserve` : null, long: `${eclats} en réserve, dans ta loge` }
    const serie = profil.jour?.serie ?? 0
    return { court: `${sabliers}/${SABLIERS_MAX} · série de ${serie} jour${serie > 1 ? 's' : ''}`, long: `${sabliers} sur ${SABLIERS_MAX} · ta série : ${serie} jour${serie > 1 ? 's' : ''}` }
  }
  // L'Éclat se montre sur ce qu'il porte, sauf un Divin, qui n'en prend pas : l'aperçu se tait (`avatarDeLApercu`).
  const lui = avatarDeLApercu(profil)
  const objet = OBJETS.find(o => o.cle === ouvert)
  return (
    <>
      <ul className="comptoir" aria-label="Les objets">
        {OBJETS.map(o => {
          const a = possede(o)
          return (
            <li key={o.cle}>
              <button type="button" className={`comptoir-objet objet-${o.cle}`} aria-haspopup="dialog" onClick={() => onOuvrir(o.cle)}>
                <span className="objet-dessin">{o.dessin()}</span>
                <span className="comptoir-texte">
                  <span className="comptoir-pour">{o.pour}</span>
                  <b className="objet-nom">{o.nom}</b>
                  <span className="comptoir-accroche">{o.accroche}</span>
                  {a?.court && (
                    <span className="comptoir-a-toi" aria-hidden="true">
                      {a.court}
                    </span>
                  )}
                  {a && <span className="sr-only">{`Tu en as : ${a.long}`}</span>}
                </span>
                <span className="objet-prix">{enConfettis(o.prix)}</span>
                {o.cle === 'eclat' && lui.avatar && (
                  <span className="comptoir-eclat" aria-hidden="true">
                    <Avatar {...lui} eclat={false} finition={profil.finition} className="comptoir-eclat-avant" />
                    <Icon name="arrow-right" />
                    <Avatar {...lui} eclat finition={profil.finition} className="comptoir-eclat-apres" />
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {objet && (
        <Feuille titre={objet.nom} onFermer={onFermer} className="feuille-boutique">
          <FicheDObjet
            key={objet.cle}
            objet={objet}
            possede={possede(objet)?.long ?? null}
            // Le sablier : deux au plus, et ce qu'on a déjà en prend la place.
            maximum={objet.cle === 'sablier' ? SABLIERS_MAX - sabliers : objet.maximum}
            solde={solde}
            acheter={async nombre => {
              if (objet.cle === 'vie') {
                const e = await api.campagne.sentiers.acheterVies(nombre)
                setVies(e.vies)
                if (e.confettis !== undefined) onSolde(e.confettis)
              } else if (objet.cle === 'eclat') {
                const r = await api.joueur.acheterUnEclat()
                setEclats(r.enReserve)
                onSolde(r.confettis.solde)
              } else {
                const r = await api.jour.sablier(nombre)
                setSabliers(r.sabliers)
                onSolde(r.confettis.solde)
              }
            }}
          />
        </Feuille>
      )}
    </>
  )
}

/**
 * La fiche d'un objet touché : son dessin en grand, ce qu'il fait, ce qu'on
 * en a, la quantité — ce qui reste de place pour le sablier —, le prix total
 * et « Acheter ». Sans assez de confettis, elle dit combien il en manque.
 */
function FicheDObjet({
  objet,
  possede,
  maximum,
  solde,
  acheter,
}: {
  objet: Objet
  possede: string | null
  maximum: number
  solde: number
  acheter: (nombre: number) => Promise<void>
}) {
  const [nombre, setNombre] = useState(1)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  const [achete, setAchete] = useState(0)
  const n = Math.max(1, Math.min(nombre, maximum))
  const prix = n * objet.prix
  const manque = Math.max(0, prix - solde)
  const plein = maximum < 1
  const valider = async () => {
    if (busy || manque > 0 || plein) return
    setBusy(true)
    setErreur('')
    try {
      await acheter(n)
      setAchete(n)
      setNombre(1)
    } catch (err) {
      setErreur(motifDe(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="galerie-detail fiche-objet" id="fiche-objet" role="region" aria-label={objet.nom}>
      <div className="fiche-objet-tete">
        <span className={`objet-dessin objet-dessin-grand objet-${objet.cle}`}>{objet.dessin()}</span>
        <span className="fiche-objet-titre">
          <b className="galerie-detail-nom">{objet.nom}</b>
          <span className="detail-famille muted">{objet.pour}</span>
        </span>
      </div>
      <p className="muted small">{objet.dit}</p>
      {possede && <p className="small fiche-objet-possede">{`Tu en as : ${possede}`}</p>}
      {plein ? (
        <p className="small" role="status">
          {objet.plein ?? 'Tu en as autant qu’il se peut.'}
        </p>
      ) : (
        <>
          <div className="fiche-objet-quantite" hidden={maximum === 1 || undefined}>
            <span className="vies-pas" role="group" aria-label={`Combien : ${objet.compte(n)}`}>
              <button type="button" className="vies-pas-btn" aria-label="Un de moins" disabled={n <= 1} onClick={() => setNombre(Math.max(1, n - 1))}>
                −
              </button>
              <output aria-live="polite">{n}</output>
              <button type="button" className="vies-pas-btn" aria-label="Un de plus" disabled={n >= maximum} onClick={() => setNombre(Math.min(maximum, n + 1))}>
                +
              </button>
            </span>
            <span className="small">{`${objet.compte(n)} · ${enConfettis(prix)}`}</span>
          </div>
          {erreur && (
            <p className="error" role="alert">
              {erreur}
            </p>
          )}
          <button type="button" className="btn btn-primary btn-block" aria-disabled={busy || manque > 0 || undefined} onClick={() => void valider()}>
            {manque > 0 ? `Il te manque ${formatNumber(manque)} confetti${manque > 1 ? 's' : ''}` : `Acheter · ${enConfettis(prix)}`}
          </button>
        </>
      )}
      {achete > 0 && (
        <p className="muted small" role="status">
          {objet.cle === 'vie' ? (
            <>
              {`${achete > 1 ? `${achete} vies ajoutées` : 'Une vie ajoutée'} à ta réserve. `}
              <a className="link-inline" href="/campagne#sentiers">
                Les sentiers
              </a>
            </>
          ) : objet.cle === 'eclat' ? (
            <>
              {'Ton Éclat t’attend en réserve. '}
              <a className="link-inline" href="/profil#avatar">
                Le dépenser dans ma loge
              </a>
            </>
          ) : (
            <>
              {`${achete > 1 ? `${achete} sabliers gardent` : 'Un sablier garde'} ta série. `}
              <a className="link-inline" href="/jour">
                Le quiz du jour
              </a>
            </>
          )}
        </p>
      )}
    </div>
  )
}
