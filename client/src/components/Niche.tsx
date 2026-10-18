import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Icon } from './Icon'
import { DESSINS } from './compagnons-peints'
import type { DessinDeCompagnon } from './Compagnon'
import { useModale } from '../modale'
import { api } from '../api'
import { espacesFines, formatNumber } from '../format'
import {
  JUSTES_DES_FORMES,
  NOM_DE_LA_FORME,
  avecLui,
  compagnon as leCompagnon,
  prochaineForme,
  type CompagnonAcquis,
  type FormeDeCompagnon,
} from '../../../shared/compagnons'
import { NOM_RARETE } from '../../../shared/badges'
import { porterNiche, type NicheVue } from '../niche'

// La niche du compagnon (le choix du 18 octobre 2026,
// `retours/2026-10-16/compagnon/principe.md`) : une petite fenêtre en arche,
// toujours au même coin — en haut à droite de la colonne du téléphone —, sur
// toutes les pages qui lisent le profil. Son fond est le décor peint de sa
// forme, celui de son avatar (« la déco », le propriétaire : le médaillon qui
// suivait a été écarté pour « trop de variation ») ; il y est en buste, grand
// visage. Calme : il ne bouge pas de lui-même. Elle se fait petite quand la
// page défile, et la toucher ouvre sa fiche — sa forme, sa jauge, « Le
// caresser », qui ne rapporte rien (invariant 8 : aucun avantage). Chaque
// page lui laisse son coin (`body.avec-niche`, `styles.css`).

/**
 * Le cadrage en buste de chaque forme, en largeurs de niche : le côté du
 * dessin « perso » livré (`DessinDeCompagnon.perso`, un carré), où poser son
 * coin haut-gauche, et s'il se retourne pour regarder la page — la tortue la
 * regarde déjà. Rapporté du cadrage de la maquette, posé à l'œil sur ses
 * humeurs rognées, au carré du dessin de l'application, au pixel près
 * (`retours/2026-10-16/compagnon/`) : un compagnon livré de plus prend sa
 * ligne, sinon sa niche le montre entier, sans buste.
 */
const CADRAGES: Readonly<Record<string, { taille: number; gauche: number; haut: number; miroir: boolean }>> = {
  'cp:loup-louveteau': { taille: 1.5328, gauche: -0.2159, haut: -0.0027, miroir: true },
  'cp:loup-jeune': { taille: 1.806, gauche: -0.3386, haut: -0.0141, miroir: true },
  'cp:loup-adulte': { taille: 2.0493, gauche: -0.3743, haut: -0.0631, miroir: true },
  'cp:loup-ultime': { taille: 2.5241, gauche: -0.692, haut: -0.3528, miroir: true },
  'cp:chat-chaton': { taille: 1.4407, gauche: -0.2799, haut: 0.0492, miroir: true },
  'cp:chat-jeune': { taille: 1.8963, gauche: -0.4222, haut: -0.063, miroir: true },
  'cp:chat-adulte': { taille: 1.996, gauche: -0.4413, haut: -0.2191, miroir: true },
  'cp:chat-esprit': { taille: 1.6296, gauche: -0.2593, haut: 0.1111, miroir: true },
  'cp:tortue-bebe': { taille: 1.0956, gauche: -0.04, haut: 0.0434, miroir: false },
  'cp:tortue-jeune': { taille: 1.2953, gauche: -0.0944, haut: -0.0854, miroir: false },
  'cp:tortue-adulte': { taille: 1.4343, gauche: -0.1811, haut: -0.1256, miroir: false },
  'cp:tortue-ile': { taille: 1.369, gauche: -0.1558, haut: -0.1558, miroir: false },
}

/** Sans cadrage : le dessin entier, au fond de la niche. */
const ENTIER = { taille: 1, gauche: 0, haut: 0.15, miroir: false }

/** Ce qui s'envole quand on le caresse : des cœurs et des étincelles, comme à la boutique — des emojis d'avant Unicode 13. */
const ENVOLS = ['💛', '✨', '💖', '✨', '💛']

/** La page a défilé de plus que cela : la niche se fait petite. */
const REPLI_PX = 40

const sansMouvement = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** L'arche : son cadre, le décor peint de sa forme — un ciel teinté à la première, qui n'en a pas —, lui en buste, son rebord. */
function Arche({ forme, dessin, caresses = 0 }: { forme: FormeDeCompagnon; dessin: DessinDeCompagnon; caresses?: number }) {
  const c = CADRAGES[forme.key] ?? ENTIER
  const decor = dessin.disque?.[1]
  const bete: CSSProperties = {
    left: `calc(var(--l) * ${c.gauche})`,
    top: `calc(var(--l) * ${c.haut})`,
    width: `calc(var(--l) * ${c.taille})`,
    height: `calc(var(--l) * ${c.taille})`,
  }
  return (
    <span className="niche-cadre" aria-hidden="true">
      <span className={'niche-decor' + (decor ? '' : ` niche-ciel niche-ciel-${forme.compagnon}`)} style={decor ? { backgroundImage: `url(${decor})` } : undefined} />
      {/* Chaque caresse le fait sauter de nouveau : la clé rejoue l'animation. */}
      <span key={caresses} className={'niche-bete' + (c.miroir ? ' miroir' : '') + (caresses > 0 ? ' saute' : '')} style={bete}>
        <img src={dessin.perso[0]} alt="" decoding="async" draggable={false} />
      </span>
      <span className="niche-rebord" />
    </span>
  )
}

/** La niche, au coin de la page, et sa fiche au toucher. Rien tant que son dessin n'est pas livré. */
export function Niche({ compagnon, rang }: NicheVue) {
  const forme = leCompagnon(compagnon)?.formes[rang]
  const dessin = forme && DESSINS[forme.key]
  const [repliee, setRepliee] = useState(false)
  const [fiche, setFiche] = useState(false)
  // Elle se fait petite dès que la page défile, et revient en haut de page :
  // posée sur la colonne, elle couvrirait le coin de ce qui passe dessous.
  useEffect(() => {
    const suivre = () => setRepliee(window.scrollY > REPLI_PX)
    suivre()
    window.addEventListener('scroll', suivre, { passive: true })
    return () => window.removeEventListener('scroll', suivre)
  }, [])
  if (!forme || !dessin) return null
  return (
    <>
      <button
        type="button"
        className={`niche niche-${forme.compagnon}` + (repliee ? ' repliee' : '')}
        aria-label={`${forme.nom}, dans ta niche : sa fiche`}
        aria-haspopup="dialog"
        onClick={() => setFiche(true)}
      >
        <Arche forme={forme} dessin={dessin} />
      </button>
      {fiche && <FicheDeLaNiche forme={forme} dessin={dessin} onFermer={() => setFiche(false)} />}
    </>
  )
}

/**
 * Sa fiche : lui en grand, dans sa niche ; sa forme et sa légende ; où il en
 * est — ses bonnes réponses vers la forme suivante, lues à l'ouverture
 * (`GET /api/joueur/niche`) — ; « Le caresser », pour le plaisir ; et ses
 * formes, à la boutique, où l'on installe un autre compagnon dans la niche.
 */
export function FicheDeLaNiche({ forme, dessin, onFermer }: { forme: FormeDeCompagnon; dessin: DessinDeCompagnon; onFermer: () => void }) {
  const boite = useRef<HTMLDivElement>(null)
  useModale(boite, onFermer)
  const [caresses, setCaresses] = useState(0)
  const [calme] = useState(sansMouvement)
  // `undefined` : en chemin ; `null` : rien à dire (une panne, un serveur d'avant).
  const [acquis, setAcquis] = useState<CompagnonAcquis | null | undefined>(undefined)
  useEffect(() => {
    let vivant = true
    api.joueur.niche().then(
      r => {
        if (!vivant) return
        setAcquis(r.niche)
        // Une forme atteinte depuis que la page a lu le profil : la niche la prend tout de suite.
        if (r.niche && r.niche.rang > forme.rang) porterNiche({ niche: r.niche.compagnon, compagnons: [r.niche] })
      },
      () => vivant && setAcquis(null),
    )
    return () => {
      vivant = false
    }
    // Une lecture par ouverture : la forme qu'elle fait prendre ne la relance pas.
  }, [])
  const c = leCompagnon(forme.compagnon)!
  const sien = acquis && acquis.compagnon === forme.compagnon ? acquis : null
  const suite = sien ? prochaineForme(sien) : null
  const il = c.le === 'la' ? 'elle' : 'il'
  return (
    <div className="carte-voile" onClick={onFermer}>
      <div ref={boite} className="carte-feuille niche-fiche" role="dialog" aria-modal="true" aria-label={c.nom} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <header className="carte-barre">
          <b className="feuille-titre">{c.nom}</b>
          <button type="button" className="carte-fermer" onClick={onFermer}>
            <Icon name="x" />
            Fermer
          </button>
        </header>
        <div className="carte-corps">
          <div className="niche-fiche-tete">
            <span className={`niche-grande niche-${forme.compagnon}`}>
              <Arche forme={forme} dessin={dessin} caresses={calme ? 0 : caresses} />
              {caresses > 0 && !calme && (
                <span key={`envol-${caresses}`} className="compagnon-envols niche-envols" aria-hidden="true">
                  {ENVOLS.map((e, i) => (
                    <i key={i}>{e}</i>
                  ))}
                </span>
              )}
            </span>
            <div className="niche-fiche-texte">
              <span className="label">Dans ta niche</span>
              <b className="niche-fiche-nom">{forme.nom}</b>
              <span className="muted small">{`${NOM_DE_LA_FORME[forme.rang]} · ${NOM_RARETE[forme.rarete].toLowerCase()}`}</span>
            </div>
          </div>
          <p className="niche-fiche-legende">{espacesFines(forme.legende)}</p>
          {/* Sa place gardée pendant la lecture : la feuille ne saute pas quand elle arrive. */}
          <div className="niche-fiche-jauge" aria-live="polite">
            {acquis === undefined ? (
              <span className="muted small">…</span>
            ) : suite ? (
              <>
                <span className="jauge-fine" aria-hidden="true">
                  <span style={{ width: `${Math.round(Math.min(1, sien!.justes / JUSTES_DES_FORMES[suite.forme.rang]) * 100)}%` }} />
                </span>
                <span className="muted small">
                  {espacesFines(
                    `${formatNumber(sien!.justes)} sur ${formatNumber(JUSTES_DES_FORMES[suite.forme.rang])} bonnes réponses ${avecLui(c)} : ${suite.forme.nom.charAt(0).toLowerCase()}${suite.forme.nom.slice(1)}`,
                  )}
                </span>
              </>
            ) : forme.rang === 3 ? (
              <span className="muted small">{espacesFines('Sa forme ultime : son monde prend vie.')}</span>
            ) : null}
          </div>
          <p className="muted small niche-fiche-regle">
            {espacesFines(`${il === 'elle' ? 'Elle' : 'Il'} grandit avec tes bonnes réponses, en soirée, au quiz du jour et en campagne — sans jamais te donner d’avantage.`)}
          </p>
          <div className="niche-fiche-gestes">
            <button type="button" className="btn btn-primary" onClick={() => setCaresses(n => n + 1)}>
              <Icon name="sparkles" />
              {`${c.le === 'la' ? 'La' : 'Le'} caresser`}
            </button>
            <a className="btn" href={`/boutique#compagnon-${forme.compagnon}`}>
              Ses formes
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
