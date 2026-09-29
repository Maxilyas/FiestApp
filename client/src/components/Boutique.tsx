import { useState } from 'react'
import { Icon } from './Icon'
import { confirmDialog } from './Dialog'
import { formatNumber } from '../format'
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

type Etat = 'porte' | 'a-toi' | 'a-vendre' | 'trop-cher' | 'hors-saison'

/** « 🎊 400 », en chiffres à la française. */
const enConfettis = (n: number) => `🎊 ${formatNumber(n)}`

interface Props {
  profil: PublicProfileDetail
  busy: boolean
  enregistrer: (patch: ChoixDuProfil) => void
  /** Achète et porte : rend le motif d'un refus, ou null. */
  acheter: (cle: string) => Promise<string | null>
}

export function MesThemes({ profil, busy, enregistrer, acheter }: Props) {
  const [ouverte, setOuverte] = useState(false)
  const [erreur, setErreur] = useState('')
  const boutique = profil.boutique
  if (!boutique) return null
  const { solde } = boutique.confettis
  const porte = boutique.porte ?? 'velours'
  const possedes = new Set(boutique.possedes)

  const etatDe = (t: Theme): Etat =>
    t.key === porte
      ? 'porte'
      : possedes.has(t.key)
        ? 'a-toi'
        : !enBoutique(t, boutique.jour)
          ? 'hors-saison'
          : prixDe(t) > solde
            ? 'trop-cher'
            : 'a-vendre'

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

  const choisir = async (t: Theme) => {
    setErreur('')
    const etat = etatDe(t)
    if (etat === 'porte' || busy) return
    if (etat === 'a-toi') return enregistrer({ theme: t.key === 'velours' ? null : t.key })
    if (etat !== 'a-vendre') return
    const prix = prixDe(t)
    const oui = await confirmDialog({
      title: `${t.nom} · ${NOM_DE_RARETE[t.rarete]}`,
      message: `${t.humeur} Il coûte ${formatNumber(prix)} confettis : il t’en restera ${formatNumber(solde - prix)}.`,
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
      <button
        key={t.key}
        type="button"
        className={'finition-btn theme-btn' + (etat === 'porte' ? ' selected' : '')}
        disabled={etat === 'trop-cher' || etat === 'hors-saison'}
        aria-disabled={busy || undefined}
        aria-pressed={etat === 'porte' || etat === 'a-toi' ? etat === 'porte' : undefined}
        onClick={() => void choisir(t)}
      >
        <span className="theme-apercu" aria-hidden="true">
          {apercu && <img src={apercu} alt="" width={180} height={320} loading="lazy" decoding="async" />}
        </span>
        <span className="finition-nom">{t.nom}</span>
        {/* « porté » redit `aria-pressed` : l'oreille n'entend que « à toi ». */}
        {etat === 'porte' && (
          <span className="muted small" aria-hidden="true">
            porté
          </span>
        )}
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
      <p className="muted small">Il habille ton téléphone : la soirée, ton profil, le quiz du jour. L’écran commun garde le sien.</p>
      {ouverte ? (
        RARETES_DE_THEME.map((r: RareteDeTheme) => (
          <div key={r} className="themes-rarete">
            <h4 className="label">
              {r === 'offert' ? 'Offerts' : `${NOM_DE_RARETE[r]} · ${enConfettis(prixDe(THEMES.find(t => t.rarete === r)!))}`}
            </h4>
            <div className="finitions themes-choix">{THEMES.filter(t => t.rarete === r).map(carte)}</div>
          </div>
        ))
      ) : (
        <div className="finitions themes-choix">{enVitrine.map(carte)}</div>
      )}
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      <button type="button" className="btn btn-block" aria-expanded={ouverte} onClick={() => setOuverte(o => !o)}>
        {ouverte ? 'Replier la boutique' : `Toute la boutique · ${THEMES.length} thèmes`}
      </button>
    </section>
  )
}
