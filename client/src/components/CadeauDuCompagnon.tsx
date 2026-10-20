import { useRef, useState, type CSSProperties } from 'react'
import { Icon } from './Icon'
import { Trouvaille } from './Trouvaille'
import { useModale } from '../modale'
import { espacesFines } from '../format'
import { NOM_RARETE } from '../../../shared/badges'
import { prochainTour, type CadeauOuvert } from '../../../shared/soins'
import { TERRAINS, TROUVAILLES, trouvailleDe } from '../../../shared/trouvailles'
import type { Compagnon } from '../../../shared/compagnons'

// Son cadeau (la maquette validée le 20 octobre 2026) : ses trois envies
// comblées, il te rapporte un paquet ; touché, il s'ouvre sur une trouvaille
// pour son jardin, sa rareté dans la lumière qui tourne derrière elle. Tous
// les sept jours de complicité, le grand cadeau, doré : une rare ou une
// épique. Ce que ce jour ouvre se dit dessous — un terrain, un tour appris,
// la fontaine des cent jours. Le tirage se fait au serveur, une fois.

/** La lumière de chaque rareté, celle des gemmes (`client/src/gemmes.ts`) : derrière la trouvaille, et sur sa pastille. */
const LUMIERES: Readonly<Record<string, string>> = {
  commune: '#a8b3bf',
  peucommune: '#6fcf8a',
  rare: '#5fa8ff',
  epique: '#b77bff',
  legendaire: '#f2b84b',
}

function Paquet({ grand }: { grand: boolean }) {
  if (grand)
    return (
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <ellipse cx="60" cy="114" rx="48" ry="5" fill="rgba(0,0,0,.35)" />
        <rect x="16" y="50" width="88" height="60" rx="7" fill="#c99c4c" />
        <rect x="16" y="50" width="44" height="60" rx="7" fill="#e0b862" />
        <path d="M24 62l6 6-6 6M96 62l-6 6 6 6M24 88l6 6-6 6M96 88l-6 6 6 6" stroke="#fff1c2" strokeWidth="1.4" fill="none" opacity=".7" />
        <rect x="53" y="50" width="14" height="60" fill="#7a3b52" />
        <rect x="10" y="35" width="100" height="21" rx="6" fill="#f3d27a" />
        <rect x="53" y="35" width="14" height="21" fill="#8c4862" />
        <path d="M60 35C46 12 22 16 34 32c5 6 17 4 26 3z" fill="#9c4f70" />
        <path d="M60 35c14-23 38-19 26-3-5 6-17 4-26 3z" fill="#8c4862" />
        <circle cx="60" cy="35" r="7" fill="#b55d82" />
        <path d="M28 20l1.4 3.6 3.6 1.4-3.6 1.4-1.4 3.6-1.4-3.6-3.6-1.4 3.6-1.4zM94 14l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z" fill="#fff4c7" />
      </svg>
    )
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <ellipse cx="60" cy="114" rx="44" ry="5" fill="rgba(0,0,0,.35)" />
      <rect x="20" y="54" width="80" height="56" rx="6" fill="#6b2f4a" />
      <rect x="20" y="54" width="40" height="56" rx="6" fill="#7a3854" />
      <rect x="54" y="54" width="12" height="56" fill="#e9c97f" />
      <rect x="14" y="40" width="92" height="20" rx="5" fill="#8a4262" />
      <rect x="54" y="40" width="12" height="20" fill="#f3d27a" />
      <path d="M60 40C49 22 30 24 39 37c4 5 13 4 21 3z" fill="#f3d27a" />
      <path d="M60 40c11-18 30-16 21-3-4 5-13 4-21 3z" fill="#e9c97f" />
      <circle cx="60" cy="40" r="6" fill="#d9b56a" />
    </svg>
  )
}

export function CadeauDuCompagnon({
  c,
  nom,
  panneau,
  grand,
  complicite,
  trouvees,
  onOuvrir,
  onPoser,
  onFermer,
}: {
  c: Compagnon
  /** Son nom en tête de phrase : le sien, sinon « Ton loup ». */
  nom: string
  /** Le nom qu'il a reçu, que « Le panneau à son nom » écrit — sans nom, le panneau garde son trait. */
  panneau: string | null
  /** Le grand cadeau, tous les sept jours de complicité. */
  grand: boolean
  /** Sa complicité avant ce cadeau. */
  complicite: number
  /** Combien de trouvailles différentes il a, avant ce cadeau. */
  trouvees: number
  onOuvrir: () => Promise<CadeauOuvert>
  /** Poser la trouvaille dans son jardin, à la première place qui lui va. */
  onPoser: (o: CadeauOuvert) => void
  /** Plus tard : elle attend dans ses trouvailles. */
  onFermer: (o: CadeauOuvert | null) => void
}) {
  const boite = useRef<HTMLDivElement>(null)
  const [ouvert, setOuvert] = useState<CadeauOuvert | null>(null)
  const [enRoute, setEnRoute] = useState(false)
  const [erreur, setErreur] = useState('')
  useModale(boite, () => onFermer(ouvert))
  const deballer = async () => {
    if (enRoute || ouvert) return
    setEnRoute(true)
    setErreur('')
    try {
      setOuvert(await onOuvrir())
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      setEnRoute(false)
    }
  }
  const t = ouvert ? trouvailleDe(ouvert.objet) : null
  const lumiere = t ? LUMIERES[t.rarete] : '#f4d58d'
  // Une trouvaille qu'il n'avait pas encore : la collection avance — les doubles, eux, se posent deux fois.
  const neuve = !!ouvert && !!t && (ouvert.soins.trouvailles[t.cle] ?? 0) === 1
  const differentes = ouvert ? Object.keys(ouvert.soins.trouvailles).length : trouvees
  const terrain = ouvert?.terrain != null ? TERRAINS[ouvert.terrain] : null
  const exploit = ouvert?.exploit ? trouvailleDe(ouvert.exploit) : null
  const suite = ouvert?.tour ? prochainTour(ouvert.complicite) : null
  const la = c.le === 'la' ? 'la' : 'le'
  return (
    <div className="cadeau-voile">
      <div
        ref={boite}
        className="cadeau-scene"
        role="dialog"
        aria-modal="true"
        aria-label={grand ? 'Le grand cadeau' : 'Son cadeau'}
        tabIndex={-1}
        style={{ '--lumiere': lumiere } as CSSProperties}
      >
        <span className={'cadeau-rayons' + (ouvert ? ' vifs' : '')} aria-hidden="true" />
        {!ouvert ? (
          <>
            <p className="cadeau-titre">{grand ? 'Le grand cadeau !' : `${nom} t’a rapporté quelque chose`}</p>
            {grand && <p className="cadeau-sous">{`${complicite + 1} jours de complicité`}</p>}
            <button type="button" className={'cadeau-paquet' + (grand ? ' grand' : '')} aria-label="Ouvrir son cadeau" disabled={enRoute} onClick={deballer}>
              <Paquet grand={grand} />
            </button>
            <p className="cadeau-aide" aria-live="polite">
              {enRoute ? '…' : 'Touche le paquet'}
            </p>
            {erreur && (
              <p className="error" role="alert">
                {erreur}
              </p>
            )}
            <button type="button" className="link-inline cadeau-plus-tard" onClick={() => onFermer(null)}>
              Plus tard
            </button>
          </>
        ) : (
          t && (
            <>
              <span className="cadeau-objet" aria-hidden="true">
                <span className="cadeau-eclat" />
                <Trouvaille cle={t.cle} icone nom={t.cle === 'panneau' ? panneau : undefined} />
              </span>
              <span className="cadeau-rarete" style={{ '--gemme': lumiere } as CSSProperties}>
                <i aria-hidden="true" />
                {`${NOM_RARETE[t.rarete]} · ${neuve ? 'nouvelle trouvaille' : 'encore une !'}`}
              </span>
              <h2 className="cadeau-nom">{t.nom}</h2>
              <p className="cadeau-compte">{`${differentes} trouvailles sur ${TROUVAILLES.length} · ${ouvert.complicite} jours de complicité`}</p>
              {terrain && (
                <div className="cadeau-annonce terrain">
                  <Icon name="home" />
                  <span>
                    <b>{`Son jardin s’agrandit : ${terrain.nom.charAt(0).toLowerCase()}${terrain.nom.slice(1)} !`}</b>
                    {` ${terrain.places} places pour ses trouvailles.`}
                  </span>
                </div>
              )}
              {ouvert.tour && (
                <div className="cadeau-annonce">
                  <Icon name="sparkles" />
                  <span>
                    <b>{`${nom} a appris ${ouvert.tour} !`}</b>
                    {espacesFines(` Caresse-${la} pour ${ouvert.tour.startsWith('la') ? 'la' : 'le'} voir.${suite ? ` Prochain tour à ${suite.jours} jours.` : ''}`)}
                  </span>
                </div>
              )}
              {exploit && (
                <div className="cadeau-annonce legende">
                  <Icon name="star" />
                  <span>
                    <b>{espacesFines('Cent jours de complicité !')}</b>
                    {` ${exploit.nom} rejoint ses trouvailles.`}
                  </span>
                </div>
              )}
              <div className="cadeau-boutons">
                <button type="button" className="btn btn-primary" onClick={() => onPoser(ouvert)}>
                  {t.sorte === 'ciel' ? 'Accrocher dans son ciel' : 'Poser dans son jardin'}
                </button>
                <button type="button" className="link-inline" onClick={() => onFermer(ouvert)}>
                  Plus tard
                </button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}
