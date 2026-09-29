import { Fragment, useEffect, useRef, useState } from 'react'
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
import type { ChoixDuProfil } from './choix'

// « Mes thèmes », dans l'onglet « Apparence » du profil, juste après le fond
// de sa carte : ce qui habille son téléphone — la soirée, sa page, le quiz du
// jour —, acheté en confettis (`shared/themes.ts`). Une bonne réponse, un
// confetti : la boutique dit ce qu'on a, ce qu'on peut s'offrir, et ce qu'il
// manque pour le reste.
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

/** Repliée, la boutique en montre autant : trois rangées d'un téléphone. */
const MONTRES = 9

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

interface Props {
  profil: PublicProfileDetail
  busy: boolean
  enregistrer: (patch: ChoixDuProfil) => void
  /** Achète et porte : rend le motif d'un refus, ou null. */
  acheter: (cle: string) => Promise<string | null>
}

export function MesThemes({ profil, busy, enregistrer, acheter }: Props) {
  const [ouverte, setOuverte] = useState(false)
  /** La fiche ouverte, sous la case touchée. */
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')
  // Le thème qu'il porte se lit dans son profil, que chaque enregistrement
  // rend à jour — jamais dans la boutique, lue une fois avec la page : après
  // Ivoire, elle croyait encore Velours porté, et toucher Velours ne faisait
  // plus rien jusqu'au rechargement.
  const porte = profil.theme ?? 'velours'
  const detail = useRef<HTMLDivElement>(null)
  // La fiche s'ouvre juste sous la case, et reçoit le focus sur son nom : le
  // lecteur d'écran la lit. La page ne défile que ce qu'il faut pour la
  // montrer entière, son bouton compris.
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
  // Porté, un thème n'a plus de bouton : le focus qui y était tombait sur la
  // page. Il revient au nom de la fiche.
  useEffect(() => {
    rendreLeFocus(detail.current, ['.galerie-detail-nom'])
  }, [porte])
  const boutique = profil.boutique
  if (!boutique) return null
  const { solde } = boutique.confettis
  const possedes = new Set(boutique.possedes)
  const etatDe = (t: Theme) => etatDuTheme(t, porte, possedes, solde, boutique.jour)

  /**
   * Repliée : ce qu'il porte et ce qu'il a, puis ce qu'une saison ne laisse
   * en boutique que quelques jours, puis un thème de chaque rareté, du
   * Commun au Légendaire — cinq Communes d'affilée ne donnaient envie de
   * rien —, et le reste dans l'ordre du catalogue. Hors saison, un thème
   * attend la boutique entière.
   */
  const siens = THEMES.filter(t => possedes.has(t.key)).sort((a, b) => Number(b.key === porte) - Number(a.key === porte))
  const aPrendre = THEMES.filter(t => !possedes.has(t.key) && enBoutique(t, boutique.jour))
  const deSaison = aPrendre.filter(t => t.saison)
  const unParRarete = RARETES_DE_THEME.map(r => aPrendre.find(t => t.rarete === r && !t.saison)).filter((t): t is Theme => !!t)
  const enVitrine = [...new Set([...siens, ...deSaison, ...unParRarete, ...aPrendre])].slice(0, MONTRES)

  const toucher = (cle: string) => {
    setErreur('')
    setOuvert(o => (o === cle ? null : cle))
  }
  // Déplier ou replier la boutique referme la fiche : sa case a changé de place.
  const deplier = () => {
    setOuverte(o => !o)
    setOuvert(null)
  }
  const porter = (cle: string | null) => {
    if (!busy) enregistrer({ theme: cle })
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

  const carte = (t: Theme) => {
    const etat = etatDe(t)
    const apercu = apercuDe(t.key)
    const aVendre = etat === 'a-vendre' || etat === 'trop-cher' || etat === 'hors-saison'
    return (
      <Fragment key={t.key}>
        <button
          type="button"
          className={
            'finition-btn theme-btn' +
            (etat === 'porte' ? ' selected' : '') +
            (etat === 'trop-cher' || etat === 'hors-saison' ? ' theme-ferme' : '') +
            (ouvert === t.key ? ' ouverte' : '')
          }
          // Il ouvre sa fiche, dessous : un bouton qui déplie, pas un
          // interrupteur — `aria-pressed` disait qu'un toucher le portait.
          aria-expanded={ouvert === t.key}
          aria-controls={ouvert === t.key ? 'detail-theme' : undefined}
          aria-label={nomDeLaCase(t, etat, solde)}
          onClick={() => toucher(t.key)}
        >
          <span className="theme-apercu" aria-hidden="true">
            {apercu && <img src={apercu} alt="" width={180} height={320} loading="lazy" decoding="async" />}
          </span>
          <span className="finition-nom">{t.nom}</span>
          {etat === 'porte' && <span className="muted small">porté</span>}
          {etat === 'a-toi' && <span className="muted small">à toi</span>}
          {/* Dépliée, la boutique range par rareté : chaque rangée la dit déjà. */}
          {aVendre && !ouverte && (
            <span className="theme-rarete">
              <i className={`rarete-point r-${t.rarete}`} aria-hidden="true" />
              {NOM_DE_RARETE[t.rarete]}
            </span>
          )}
          {aVendre && <span className={'small theme-prix' + (etat === 'a-vendre' ? '' : ' muted')}>{enConfettis(prixDe(t))}</span>}
          {etat === 'trop-cher' && <span className="muted small">encore {formatNumber(prixDe(t) - solde)}</span>}
          {etat === 'hors-saison' && <span className="muted small">{retourEnBoutique(t)}</span>}
          {/* Une saison ne dure que quelques jours : elle se dit. */}
          {t.saison && etat === 'a-vendre' && <span className="muted small">{t.saison.periode}</span>}
        </button>
        {ouvert === t.key && (
          <div id="detail-theme" className="fiche-case" ref={detail}>
            <DetailTheme
              theme={t}
              etat={etat}
              solde={solde}
              busy={busy}
              erreur={erreur}
              onPorter={porter}
              onAcheter={t => void acheterLe(t)}
            />
          </div>
        )}
      </Fragment>
    )
  }

  return (
    <section className="card mes-themes" id="mes-themes">
      <h3>
        <Icon name="palette" />
        Mes thèmes <span className="muted small titre-compte">{`${possedes.size} / ${THEMES.length}`}</span>
      </h3>
      <p className="solde-ligne">
        <span className="solde">
          <span className="solde-emoji" aria-hidden="true">
            🎊
          </span>{' '}
          {formatNumber(solde)}
        </span>
        <span className="muted small">confettis · une bonne réponse, un confetti</span>
      </p>
      {solde < 0 && (
        <p className="muted small">Une soirée retirée de l’historique a repris ses confettis. Tes thèmes, eux, te restent.</p>
      )}
      <p className="muted small">
        {espacesFines('Il habille ton téléphone : la soirée, ton profil, le quiz du jour. Touche un thème, puis « Le porter ».')}
      </p>
      {ouverte ? (
        RARETES_DE_THEME.map((r: RareteDeTheme) => (
          <div key={r} className="themes-rarete">
            <h4 className="label">
              {r === 'offert' ? 'Offerts' : `${NOM_DE_RARETE[r]} · ${enConfettis(prixDe(THEMES.find(t => t.rarete === r)!))}`}
            </h4>
            <div className="finitions themes-choix" role="group" aria-label={r === 'offert' ? 'Offerts' : NOM_DE_RARETE[r]}>
              {THEMES.filter(t => t.rarete === r).map(carte)}
            </div>
          </div>
        ))
      ) : (
        <div className="finitions themes-choix" role="group" aria-label="Mes thèmes">
          {enVitrine.map(carte)}
        </div>
      )}
      <button type="button" className="btn btn-block" aria-expanded={ouverte} onClick={deplier}>
        {ouverte ? 'Replier la boutique' : `Toute la boutique · ${THEMES.length} thèmes`}
      </button>
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
