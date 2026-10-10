import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Icon } from './Icon'
import { choixDialog } from './Dialog'
import { rendreLeFocus } from '../focus'
import { espacesFines, formatNumber } from '../format'
import {
  NOM_DE_RARETE,
  RARETES_DE_THEME,
  THEMES,
  enBoutique,
  prixDe,
  retourEnBoutique,
  type RareteDeTheme,
  type Theme,
} from '../../../shared/themes'
import type { PublicProfileDetail } from '../../../shared/profil'
import type { VieDesSentiers } from '../../../shared/sentiers'
import { SABLIERS_MAX } from '../../../shared/jour'
import { OBJETS, type CleDObjet, type Objet } from './Objets'
import { api, motifDe } from '../api'
import { apercuDe } from '../apercus'
import type { ChoixDuProfil } from './choix'

// Les thèmes : ce qui habille toutes ses pages — la soirée, son profil, ses
// quiz, son compte —, sauf l'écran commun, acheté en confettis
// (`shared/themes.ts`). Une bonne réponse, un
// confetti. La boutique ne montre que ce qui reste à prendre, une rareté à
// la fois (`RayonDesThemes`) ; ce qu'on a se porte dans « Mon thème »
// (`MesThemes`). Les deux dans les mêmes cartes : l'écran d'une question
// sous chaque thème, en grand. « Ma collection » les montre tous, en
// vignettes rangées par rareté, ceux qui ne se vendent pas compris, et la
// même fiche dit où les gagner.
//
// Le geste est celui de « Mes avatars » : toucher un thème ouvre sa fiche
// sous sa rangée, et l'on porte — ou l'on achète — de là. Un thème se
// portait d'un toucher : le doigt qui voulait le regarder habillait déjà
// toute la page.

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

/** La couleur de chaque rareté : sa gemme, le bord de ses cartes, son prix. Jamais un texte long. */
const GEMMES: Record<RareteDeTheme, string> = {
  offert: '#d9b56a',
  commune: '#a8b3bf',
  peucommune: '#6fcf8a',
  rare: '#5fa8ff',
  epique: '#b77bff',
  legendaire: '#f2b84b',
}
export const gemme = (r: RareteDeTheme) => ({ '--gemme': GEMMES[r] }) as CSSProperties

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
 * Une carte de la vitrine : l'aperçu en grand, le nom, et dessous ce qu'il
 * est pour lui. Elle ouvre sa fiche — un bouton qui déplie, pas un
 * interrupteur : `aria-pressed` disait qu'un toucher le portait.
 */
function CarteDeTheme({ t, etat, solde, ouvert, onToucher }: { t: Theme; etat: EtatDuTheme; solde: number; ouvert: boolean; onToucher: () => void }) {
  const apercu = apercuDe(t.key)
  const pied =
    etat === 'porte'
      ? 'Porté'
      : etat === 'a-toi'
        ? NOM_DE_RARETE[t.rarete]
        : etat === 'a-gagner'
          ? 'Se gagne'
          : etat === 'trop-cher'
            ? `encore ${formatNumber(prixDe(t) - solde)}`
            : enConfettis(prixDe(t))
  return (
    <button
      type="button"
      className={'theme-vitrine' + (etat === 'trop-cher' ? ' theme-cher' : '') + (etat === 'porte' ? ' theme-porte' : '') + (ouvert ? ' ouverte' : '')}
      style={gemme(t.rarete)}
      aria-expanded={ouvert}
      aria-controls={ouvert ? 'detail-theme' : undefined}
      aria-label={nomDeLaCase(t, etat, solde)}
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
 * La rareté que le rayon montre : celle choisie à la main tant qu'elle a
 * encore un thème à vendre — son dernier acheté, la page lisait le prix d'un
 * thème qui n'était plus là, et tombait —, sinon la plus haute à sa portée,
 * sinon la première.
 */
export function rareteDuRayon(choisie: RareteDeTheme | null, aPrendre: readonly Theme[], solde: number): RareteDeTheme {
  const raretes = RARETES_DE_THEME.filter(r => aPrendre.some(t => t.rarete === r))
  if (choisie && raretes.includes(choisie)) return choisie
  return [...raretes].reverse().find(r => prixDe(aPrendre.find(t => t.rarete === r)!) <= solde) ?? raretes[0]
}

/**
 * La boutique : ce qu'on achète, à part de ce qu'on a — ce qu'on possède se
 * porte dans « Mon thème » (`MesThemes`). Une rareté à la fois, choisie sur
 * une rangée de gemmes ; elle s'ouvre sur la plus belle qu'on peut déjà
 * s'offrir. Hors de sa saison, un thème attend la sienne. Ceux qui ne se
 * vendent pas n'y sont pas : ils se gagnent, et « Ma collection » dit où (la
 * remarque du 6 octobre 2026).
 */
export function RayonDesThemes({
  profil,
  busy,
  acheter,
}: {
  profil: PublicProfileDetail
  busy: boolean
  /** Achète — et porte, ou garde pour plus tard : rend le motif d'un refus, ou null. */
  acheter: (cle: string, porter: boolean) => Promise<string | null>
}) {
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')
  // Le dernier acheté : sa carte quitte le rayon, la boutique dit où il est passé.
  const [achete, setAchete] = useState<{ nom: string; porte: boolean } | null>(null)
  // Le thème porté se lit dans le profil, que chaque enregistrement rend à
  // jour — jamais dans la boutique, lue une fois avec la page.
  const porte = profil.theme ?? 'velours'
  const detail = useFiche(ouvert, porte)
  const boutique = profil.boutique
  const solde = boutique?.confettis.solde ?? 0
  const possedes = new Set(boutique?.possedes ?? [])
  const aPrendre = boutique ? THEMES.filter(t => t.rarete !== 'offert' && !possedes.has(t.key) && enBoutique(t, boutique.jour)) : []
  const raretes = RARETES_DE_THEME.filter(r => aPrendre.some(t => t.rarete === r))
  const [choisie, setChoisie] = useState<RareteDeTheme | null>(null)
  if (!boutique) return null
  const rarete = rareteDuRayon(choisie, aPrendre, solde)
  const liste = aPrendre.filter(t => t.rarete === rarete)

  const toucher = (cle: string) => {
    setErreur('')
    setOuvert(o => (o === cle ? null : cle))
  }
  // Changer de rareté referme la fiche : sa carte n'est plus là.
  const choisir = (r: RareteDeTheme) => {
    setChoisie(r)
    setOuvert(null)
  }
  // Le porter tout de suite, ou le garder pour plus tard : on achète aussi un
  // thème de saison avant qu'il ne parte, ou pour son album, sans quitter
  // celui qu'on aime (un retour de joueur du 10 octobre 2026).
  const acheterLe = async (t: Theme) => {
    if (busy) return
    setErreur('')
    setAchete(null)
    const prix = prixDe(t)
    const choix = await choixDialog({
      title: `${t.nom} · ${NOM_DE_RARETE[t.rarete]}`,
      message: `Il coûte ${formatNumber(prix)} confettis : il t’en restera ${formatNumber(solde - prix)}.`,
      confirmLabel: `Acheter et porter · ${enConfettis(prix)}`,
      alternative: { label: 'L’acheter seulement' },
      cancelLabel: 'Plus tard',
    })
    if (!choix) return
    const porter = choix.geste === 'confirmer'
    const refus = await acheter(t.key, porter)
    if (refus) return setErreur(refus)
    setOuvert(null)
    setAchete({ nom: t.nom, porte: porter })
  }

  return (
    <>
      {solde < 0 && <p className="muted small">Une soirée retirée de l’historique a repris ses confettis. Tes thèmes, eux, te restent.</p>}
      {achete && (
        <p className="card theme-achete" role="status">
          {achete.porte ? (
            `${achete.nom} habille tes pages.`
          ) : (
            <>
              {`${achete.nom} est à toi : `}
              <a className="link-inline" href="/profil#theme">
                le porter
              </a>
              {' quand tu veux.'}
            </>
          )}
        </p>
      )}
      {raretes.length === 0 ? (
        <p className="card muted">Tu as tous les thèmes de la boutique. Ceux des saisons reviennent avec elles.</p>
      ) : (
        <>
          <div className="gemmes" role="tablist" aria-label="Rareté">
            {raretes.map(r => (
              <button key={r} type="button" role="tab" aria-selected={rarete === r} className="gemme" style={gemme(r)} onClick={() => choisir(r)}>
                <i aria-hidden="true" />
                <span>{NOM_DE_RARETE[r]}</span>
              </button>
            ))}
          </div>
          <p className="gemme-legende" style={gemme(rarete)}>
            <b>{NOM_DE_RARETE[rarete]}</b> · {enConfettis(prixDe(liste[0]))} le thème · {liste.length} en boutique
          </p>
          <div className="vitrine-themes" role="tabpanel" aria-label={NOM_DE_RARETE[rarete]}>
            {liste.map(t => {
              const etat = etatDuTheme(t, porte, possedes, solde, boutique.jour)
              return (
                <Fragment key={t.key}>
                  <CarteDeTheme t={t} etat={etat} solde={solde} ouvert={ouvert === t.key} onToucher={() => toucher(t.key)} />
                  {ouvert === t.key && (
                    <div id="detail-theme" className="fiche-case theme-fiche" ref={detail}>
                      <DetailTheme theme={t} etat={etat} solde={solde} busy={busy} erreur={erreur} onPorter={() => {}} onAcheter={t => void acheterLe(t)} />
                    </div>
                  )}
                </Fragment>
              )
            })}
          </div>
        </>
      )}
      <p className="muted small center">
        {possedes.size} thème{possedes.size > 1 ? 's' : ''} déjà à toi : <a className="link-inline" href="/profil#theme">les porter</a>
      </p>
    </>
  )
}

/**
 * « Mes thèmes », dans « Mon thème » : seulement ceux qu'il a, dans les
 * cartes de la boutique, celui qu'il porte en tête. Toucher un thème ouvre
 * sa fiche, d'où on le porte : un thème se portait d'un toucher, et le doigt
 * qui voulait le regarder habillait déjà toute la page.
 */
export function MesThemes({ profil, busy, enregistrer }: { profil: PublicProfileDetail; busy: boolean; enregistrer: (patch: ChoixDuProfil) => void }) {
  const [ouvert, setOuvert] = useState<string | null>(null)
  const porte = profil.theme ?? 'velours'
  const detail = useFiche(ouvert, porte)
  const boutique = profil.boutique
  if (!boutique) return null
  const { solde } = boutique.confettis
  const possedes = new Set(boutique.possedes)
  const siens = THEMES.filter(t => possedes.has(t.key)).sort((a, b) => Number(b.key === porte) - Number(a.key === porte))
  const aVendre = THEMES.filter(t => !possedes.has(t.key) && enBoutique(t, boutique.jour)).length
  const aGagner = THEMES.filter(t => t.gagne && !possedes.has(t.key)).length
  const toucher = (cle: string) => setOuvert(o => (o === cle ? null : cle))
  const porter = (cle: string | null) => {
    if (!busy) enregistrer({ theme: cle })
  }
  return (
    <section className="mes-themes">
      <p className="gemme-legende">
        <b>
          {siens.length} thème{siens.length > 1 ? 's' : ''}
        </b>{' '}
        · {espacesFines('il habille toutes tes pages, de la soirée à tes quiz. Touche un thème, puis « Le porter ».')}
      </p>
      <div className="vitrine-themes" role="group" aria-label="Mes thèmes">
        {siens.map(t => {
          const etat = etatDuTheme(t, porte, possedes, solde, boutique.jour)
          return (
            <Fragment key={t.key}>
              <CarteDeTheme t={t} etat={etat} solde={solde} ouvert={ouvert === t.key} onToucher={() => toucher(t.key)} />
              {ouvert === t.key && (
                <div id="detail-theme" className="fiche-case theme-fiche" ref={detail}>
                  <DetailTheme theme={t} etat={etat} solde={solde} busy={busy} onPorter={porter} onAcheter={() => {}} />
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
      {aGagner > 0 && (
        <a className="link-inline lien-boutique" href="#collection-themes">
          <Icon name="award" />
          {`${aGagner} qui ne se vend${aGagner > 1 ? 'ent' : ''} pas : où ${aGagner > 1 ? 'les' : 'le'} gagner`}
        </a>
      )}
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
      {etat === 'a-toi' &&
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
 * Le rayon des objets : ce qui sert en jeu et s'achète en confettis — une
 * vie des sentiers, un sablier pour la série du quiz du jour, et ce qui
 * viendra (`components/Objets.tsx`). Une case par objet, son dessin, son
 * prix, ce qu'on en a ; la toucher ouvre sa fiche dessous — ce que c'est,
 * combien on en prend, ce que ça coûte —, d'où l'on achète, jamais d'un
 * toucher (le geste des thèmes). C'est le serveur qui compte : les vies avec
 * les sentiers, les sabliers avec la série.
 */
export function RayonDesObjets({ profil, ouvert, onSolde }: { profil: PublicProfileDetail; ouvert?: CleDObjet; onSolde: (solde: number) => void }) {
  const [choisi, setChoisi] = useState<CleDObjet | null>(ouvert ?? null)
  const [vies, setVies] = useState<VieDesSentiers | null>(null)
  const [sabliers, setSabliers] = useState(profil.jour?.sabliers ?? 0)
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
      return vies ? { court: vies.reserve > 0 ? String(vies.reserve) : null, long: `${vies.jour} aujourd’hui · ${vies.reserve} en réserve` } : null
    return { court: `${sabliers}/${SABLIERS_MAX}`, long: `${sabliers} sur ${SABLIERS_MAX} · ta série : ${profil.jour?.serie ?? 0} jour${(profil.jour?.serie ?? 0) > 1 ? 's' : ''}` }
  }
  const objet = OBJETS.find(o => o.cle === choisi)
  return (
    <section className="rayon-objets" aria-label="Les objets">
      <div className="objets-grille">
        {OBJETS.map(o => {
          const a = possede(o)
          return (
            <button
              key={o.cle}
              type="button"
              className={`objet-case objet-${o.cle}` + (choisi === o.cle ? ' actif' : '')}
              aria-expanded={choisi === o.cle}
              aria-controls="fiche-objet"
              onClick={() => setChoisi(c => (c === o.cle ? null : o.cle))}
            >
              <span className="objet-dessin">{o.dessin()}</span>
              <span className="objet-nom">{o.nom}</span>
              <span className="objet-prix">🎊 {formatNumber(o.prix)}</span>
              {a && (
                <>
                  {a.court && (
                    <span className="objet-compte" aria-hidden="true">
                      {a.court}
                    </span>
                  )}
                  <span className="sr-only">{`Tu en as : ${a.long}`}</span>
                </>
              )}
            </button>
          )
        })}
      </div>
      {objet && (
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
            } else {
              const r = await api.jour.sablier(nombre)
              setSabliers(r.sabliers)
              onSolde(r.confettis.solde)
            }
          }}
        />
      )}
    </section>
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
          <div className="fiche-objet-quantite">
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
