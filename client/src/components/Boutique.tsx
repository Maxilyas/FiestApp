import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Icon } from './Icon'
import { confirmDialog } from './Dialog'
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
import { PRIX_D_UNE_VIE, VIES_PAR_ACHAT_MAX, type VieDesSentiers } from '../../../shared/sentiers'
import { api, motifDe } from '../api'
import type { ChoixDuProfil } from './choix'

// Les thèmes : ce qui habille son téléphone — la soirée, sa page, le quiz du
// jour —, acheté en confettis (`shared/themes.ts`). Une bonne réponse, un
// confetti. La boutique ne montre que ce qui reste à prendre, une rareté à
// la fois (`RayonDesThemes`) ; ce qu'on a se porte dans « Mon style › Thème »
// (`MesThemes`). Les deux dans les mêmes cartes : l'écran d'une question
// sous chaque thème, en grand.
//
// Le geste est celui de « Mes avatars » : toucher un thème ouvre sa fiche
// sous sa rangée, et l'on porte — ou l'on achète — de là. Un thème se
// portait d'un toucher : le doigt qui voulait le regarder habillait déjà
// toute la page.

/**
 * Les aperçus : l'écran d'une question, photographié dans l'application sous
 * chaque thème (`server/scripts/apercus-themes.ts`). Des adresses seulement :
 * une image ne part que si sa case se montre. Hors de Vite (les tests
 * rendent la page dans Node), des cases sans image.
 */
const APERCUS: Record<string, string> = import.meta.env
  ? import.meta.glob<string>('../themes/apercus/*.webp', { eager: true, query: '?url', import: 'default' })
  : {}
const apercuDe = (cle: string): string | undefined => APERCUS[`../themes/apercus/${cle}.webp`]

export type EtatDuTheme = 'porte' | 'a-toi' | 'a-vendre' | 'trop-cher' | 'hors-saison'

/** « 🎊 400 », en chiffres à la française. */
const enConfettis = (n: number) => `🎊 ${formatNumber(n)}`

/** Ce qu'est un thème pour lui, ce jour-là : porté, à lui, à vendre, trop cher pour l'instant, ou hors de sa saison. */
export function etatDuTheme(t: Theme, porte: string, possedes: ReadonlySet<string>, solde: number, jour: string): EtatDuTheme {
  if (t.key === porte) return 'porte'
  if (possedes.has(t.key)) return 'a-toi'
  if (!enBoutique(t, jour)) return 'hors-saison'
  return prixDe(t) > solde ? 'trop-cher' : 'a-vendre'
}

/** Sa case, dite à l'oreille d'une traite : son nom, puis ce qu'il est pour lui. */
function nomDeLaCase(t: Theme, etat: EtatDuTheme, solde: number): string {
  if (etat === 'porte') return `${t.nom}, porté`
  if (etat === 'a-toi') return `${t.nom}, à toi`
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
const gemme = (r: RareteDeTheme) => ({ '--gemme': GEMMES[r] }) as CSSProperties

/**
 * La fiche ouverte s'ouvre juste sous sa case, et reçoit le focus sur son
 * nom : le lecteur d'écran la lit. La page ne défile que ce qu'il faut pour
 * la montrer entière, son bouton compris. Porté, un thème n'a plus de
 * bouton : le focus qui y était tombait sur la page, il revient au nom.
 */
function useFiche(ouvert: string | null, porte: string) {
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
    etat === 'porte' ? 'Porté' : etat === 'a-toi' ? NOM_DE_RARETE[t.rarete] : etat === 'trop-cher' ? `encore ${formatNumber(prixDe(t) - solde)}` : enConfettis(prixDe(t))
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
 * La boutique : ce qu'on achète, à part de ce qu'on a — ce qu'on possède se
 * porte dans « Mon style › Thème » (`MesThemes`). Une rareté à la fois,
 * choisie sur une rangée de gemmes ; elle s'ouvre sur la plus belle qu'on
 * peut déjà s'offrir. Hors de sa saison, un thème attend la sienne.
 */
export function RayonDesThemes({
  profil,
  busy,
  acheter,
}: {
  profil: PublicProfileDetail
  busy: boolean
  /** Achète et porte : rend le motif d'un refus, ou null. */
  acheter: (cle: string) => Promise<string | null>
}) {
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')
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
  const rarete = choisie ?? [...raretes].reverse().find(r => prixDe(aPrendre.find(t => t.rarete === r)!) <= solde) ?? raretes[0]
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
  const acheterLe = async (t: Theme) => {
    if (busy) return
    setErreur('')
    const prix = prixDe(t)
    const oui = await confirmDialog({
      title: `${t.nom} · ${NOM_DE_RARETE[t.rarete]}`,
      message: `Il coûte ${formatNumber(prix)} confettis : il t’en restera ${formatNumber(solde - prix)}.`,
      confirmLabel: `Acheter et porter · ${enConfettis(prix)}`,
      cancelLabel: 'Plus tard',
    })
    if (!oui) return
    const refus = await acheter(t.key)
    if (refus) setErreur(refus)
  }

  return (
    <>
      {solde < 0 && <p className="muted small">Une soirée retirée de l’historique a repris ses confettis. Tes thèmes, eux, te restent.</p>}
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
        {possedes.size} thème{possedes.size > 1 ? 's' : ''} déjà à toi : <a className="link-inline" href="/profil#style-theme">les porter</a>
      </p>
      {/* Celui qui ne se vend pas se dit ici, sans se montrer : il se gagne. */}
      {THEMES.filter(t => t.gagne && !possedes.has(t.key)).map(t => (
        <p key={t.key} className="muted small center">
          {`Le thème ${t.nom} ne se vend pas : il se gagne avec ${t.gagne!.regle}. `}
          <a className="link-inline" href="/campagne#sentiers">
            Les sentiers
          </a>
        </p>
      ))}
    </>
  )
}

/**
 * « Mes thèmes », dans « Mon style » : seulement ceux qu'il a, dans les
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
        · {espacesFines('il habille ton téléphone : la soirée, ton profil, le quiz du jour. Touche un thème, puis « Le porter ».')}
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
      <a className="link-inline lien-boutique" href="/boutique">
        <Icon name="palette" /> D’autres thèmes à la boutique
      </a>
    </section>
  )
}

/**
 * La fiche d'un thème, sous sa case : son nom, son aperçu en grand, ce qu'il
 * habille, et le seul geste qui compte ce jour-là — le porter, l'acheter —,
 * ou ce qui manque encore. L'écran commun garde le sien : c'est ici qu'on le
 * dit, au moment de choisir.
 */
export function DetailTheme({
  theme: t,
  etat,
  solde,
  busy,
  erreur,
  onPorter,
  onAcheter,
}: {
  theme: Theme
  etat: EtatDuTheme
  solde: number
  busy: boolean
  /** Le refus d'un achat, dit là où l'on a touché. */
  erreur?: string
  /** Le porter ; null : Velours, celui de toutes les soirées. */
  onPorter: (cle: string | null) => void
  onAcheter: (theme: Theme) => void
}) {
  const prix = prixDe(t)
  const apercu = apercuDe(t.key)
  return (
    <div className="galerie-detail detail-case detail-theme">
      <span className="detail-famille muted">
        {t.rarete === 'offert' ? 'Offert' : `${NOM_DE_RARETE[t.rarete]} · ${enConfettis(prix)}`}
      </span>
      <b className="galerie-detail-nom">{t.nom}</b>
      {apercu && (
        <span className="detail-apercu" aria-hidden="true">
          <img src={apercu} alt="" width={180} height={260} loading="lazy" decoding="async" />
        </span>
      )}
      <p className="muted small">{t.humeur}</p>
      {etat === 'porte' && <p className="muted small">C’est lui qui habille ton téléphone. L’écran commun garde le sien.</p>}
      {etat === 'a-toi' && (
        <button
          type="button"
          className="btn btn-small btn-primary"
          aria-disabled={busy || undefined}
          onClick={() => onPorter(t.key === 'velours' ? null : t.key)}
        >
          Le porter
        </button>
      )}
      {etat === 'a-vendre' && (
        <>
          <p className="muted small">
            {`Il coûte ${formatNumber(prix)} confettis : il t’en restera ${formatNumber(solde - prix)}.`}
            {t.saison && ` En boutique ${t.saison.periode}, et gardé toute l’année.`}
          </p>
          <button type="button" className="btn btn-small btn-primary" aria-disabled={busy || undefined} onClick={() => onAcheter(t)}>
            {`L’acheter · ${enConfettis(prix)}`}
          </button>
        </>
      )}
      {etat === 'trop-cher' && (
        <p className="muted small">
          Il coûte {formatNumber(prix)} confettis : <b>encore {formatNumber(prix - solde)}</b>. Une bonne réponse, un confetti.
        </p>
      )}
      {etat === 'hors-saison' && t.saison && (
        <p className="muted small">{`En boutique ${t.saison.periode} seulement — acheté, il se garde toute l’année.`}</p>
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
 * Le rayon des vies : des vies pour les sentiers du savoir (`shared/sentiers.ts`),
 * au prix d'une vie (`PRIX_D_UNE_VIE`). Elles vont dans la réserve, servent
 * après celles du jour et ne périment pas. Le même achat que l'écran « Plus
 * de vies » des sentiers : c'est le serveur qui compte.
 */
export function RayonDesVies({ profil, onSolde }: { profil: PublicProfileDetail; onSolde: (solde: number) => void }) {
  const [vies, setVies] = useState<VieDesSentiers | null>(null)
  const [nombre, setNombre] = useState(1)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  const [achete, setAchete] = useState(0)
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
  const prix = nombre * (vies?.prix ?? PRIX_D_UNE_VIE)
  const manque = Math.max(0, prix - solde)
  const acheter = async () => {
    if (busy || manque > 0) return
    setBusy(true)
    setErreur('')
    try {
      const e = await api.campagne.sentiers.acheterVies(nombre)
      setVies(e.vies)
      setAchete(nombre)
      setNombre(1)
      if (e.confettis !== undefined) onSolde(e.confettis)
    } catch (err) {
      setErreur(motifDe(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="vies-achat rayon-vies" aria-labelledby="rayon-vies">
      <div className="vies-ligne">
        <b id="rayon-vies">Des vies pour les sentiers</b>
        {vies && <span className="muted small">{`${vies.jour} aujourd’hui · ${vies.reserve} en réserve`}</span>}
      </div>
      <p className="muted small">Un palier raté coûte une vie. Celles-ci vont dans ta réserve : elles servent après celles du jour, et ne périment pas.</p>
      <div className="vies-ligne">
        <span className="vies-pas" role="group" aria-label="Combien de vies">
          <button type="button" className="vies-pas-btn" aria-label="Une vie de moins" onClick={() => setNombre(n => Math.max(1, n - 1))}>
            −
          </button>
          <output aria-live="polite">{nombre}</output>
          <button type="button" className="vies-pas-btn" aria-label="Une vie de plus" onClick={() => setNombre(n => Math.min(VIES_PAR_ACHAT_MAX, n + 1))}>
            +
          </button>
        </span>
        <span className="muted small">{`${nombre} vie${nombre > 1 ? 's' : ''} · ${enConfettis(prix)}`}</span>
      </div>
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      <button type="button" className="btn btn-primary btn-block" aria-disabled={busy || manque > 0 || undefined} onClick={() => void acheter()}>
        {manque > 0 ? `Il te manque ${formatNumber(manque)} confetti${manque > 1 ? 's' : ''}` : 'Acheter'}
      </button>
      {achete > 0 && (
        <p className="muted small" role="status">
          {`${achete > 1 ? `${achete} vies ajoutées` : 'Une vie ajoutée'} à ta réserve. `}
          <a className="link-inline" href="/campagne#sentiers">
            Les sentiers
          </a>
        </p>
      )}
    </section>
  )
}
