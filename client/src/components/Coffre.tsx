import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api'
import { apercuDe } from '../apercus'
import { espacesFines, formatNumber } from '../format'
import { gemme } from '../gemmes'
import { useModale } from '../modale'
import { Icon } from './Icon'
import { GerbeVue, tirerLesParticules } from './Gerbe'
import { Medaillon } from './Ouverts'
import { COFFRES_PEINTS } from './coffres-peints'
import { NOM_RARETE, type Rarete } from '../../../shared/badges'
import {
  CHANCES_DU_COFFRE,
  NOM_DE_LA_SORTE,
  NOM_DU_COFFRE,
  TAMPONS_PAR_SEMAINE,
  type CoffreEnAttente,
  type CoffreOuvert,
  type ObjetDuTresor,
  type RangDuCoffre,
} from '../../../shared/coffre'
import { compagnon } from '../../../shared/compagnons'
import { ALLURE_PAR_DEFAUT, gerbe as gerbeDuCatalogue } from '../../../shared/gerbes'
import { jourEnToutesLettres } from '../../../shared/jour'
import { nomDeLObjet, phraseDeLObjet, tirerLeCoffre } from '../../../shared/tresor'

// L'ouverture du coffre de la semaine (le souhait du propriétaire du 14
// octobre 2026 : « une animation ultra stylée, d'un coffre qui s'ouvre […] et
// on sait si on a un thème, un avatar, une carte » — puis, le même soir,
// « encore plus belle si tu le peux »). Quatre actes :
//
// - le repos : le coffre peint flotte, une lueur filtre sous son couvercle,
//   de la poussière d'or monte, et ce qu'il peut donner se lit avant qu'on y
//   touche — ses chances, rareté par rareté (`CHANCES_DU_COFFRE`) ;
// - la charge : « Ouvrir » demande le tirage au serveur ; le coffre tremble
//   de plus en plus fort, la lumière fuit par la fente, des braises s'y
//   engouffrent — au moins sa durée, et tant que la réponse n'est pas là ;
// - l'éclat : un éclair à la couleur de la rareté tirée, deux ondes, une
//   colonne de lumière ; le coffre s'ouvre sous l'éclair (ses deux images,
//   peintes sur la même pose, se relaient pendant qu'il aveugle) ;
// - la révélation : l'objet monte du coffre devant des rayons qui tournent,
//   puis sa rareté, son nom, ce qu'il fait — et l'essayer d'un toucher.
//
// La rareté ne se devine pas avant l'éclair : la charge a la lumière de la
// matière du coffre, jamais celle de ce qu'il cache. Tout bouge par
// `transform` et `opacity` ; si le système demande moins de mouvement, le
// coffre s'ouvre en fondu. Échap ou la croix, pendant l'ouverture, passent à
// la révélation dès que le tirage est revenu : il est fait, on ne le perd pas
// en fermant.

type Acte = 'repos' | 'charge' | 'eclat' | 'revele' | 'erreur'

/** La durée de la charge et de l'éclat, en millisecondes. La charge attend aussi la réponse du serveur. */
const DUREES = { charge: 1900, eclat: 1100 }
/** Si le système demande moins de mouvement : pas de charge, un fondu. */
const DUREES_CALMES = { charge: 0, eclat: 300 }

/** La lumière de chaque coffre avant l'éclair, en composantes : celle de sa matière — le bois chaud, l'argent froid, l'or, le soleil du royal. */
const LUMIERE_DU_RANG: Readonly<Record<RangDuCoffre, string>> = {
  bois: '255, 186, 110',
  argent: '214, 230, 255',
  or: '255, 210, 110',
  royal: '255, 226, 150',
}

/** La lumière de chaque rareté, à l'éclair et derrière l'objet : sa gemme (`gemmes.ts`), un peu plus claire — c'est une lumière. */
const LUMIERE_DE_LA_RARETE: Readonly<Record<Rarete, string>> = {
  commune: '200, 212, 226',
  peucommune: '120, 222, 152',
  rare: '104, 172, 255',
  epique: '190, 128, 255',
  legendaire: '255, 196, 84',
}

/** Les étincelles qui tombent à la révélation : rien pour les deux raretés les plus humbles, une pluie d'or pour la légendaire. */
const ETINCELLES: Readonly<Record<Rarete, number>> = { commune: 0, peucommune: 0, rare: 12, epique: 20, legendaire: 32 }

const RARETES: readonly Rarete[] = ['commune', 'peucommune', 'rare', 'epique', 'legendaire']

/** Les cinq traits de lumière qui fuient par la fente pendant la charge : où, de quel angle, quand. */
const FUITES = [
  { x: '24%', angle: '-34deg', delai: '0.5s' },
  { x: '37%', angle: '-16deg', delai: '0.15s' },
  { x: '50%', angle: '0deg', delai: '0.8s' },
  { x: '63%', angle: '17deg', delai: '0.3s' },
  { x: '76%', angle: '33deg', delai: '1s' },
]

/** Une braise : où elle flotte au repos, au-dessus du coffre, et d'où elle plonge dans la fente pendant la charge. */
interface Braise {
  i: number
  dx: number
  dy: number
  repos: number
  charge: number
  echelle: number
}

function tirerLesBraises(n: number): Braise[] {
  return Array.from({ length: n }, (_, i) => {
    // Sur l'arc du haut, de gauche à droite : la poussière monte du coffre, et la charge l'y ramène.
    const angle = Math.PI * (1.08 + (0.84 * (i + Math.random() * 0.8)) / n)
    const d = 70 + Math.random() * 80
    return {
      i,
      dx: Math.round(Math.cos(angle) * d),
      dy: Math.round(Math.sin(angle) * d * 0.8),
      repos: Math.round(Math.random() * 4000) / 1000,
      charge: Math.round(Math.random() * 900) / 1000,
      echelle: Math.round((0.5 + Math.random() * 0.6) * 100) / 100,
    }
  })
}

/** Une étincelle de la pluie : d'où elle tombe, quand, combien de temps, de combien elle dérive et tourne. */
interface Etincelle {
  i: number
  x: number
  delai: number
  duree: number
  derive: number
  tour: number
  echelle: number
}

function tirerLesEtincelles(n: number): Etincelle[] {
  return Array.from({ length: n }, (_, i) => ({
    i,
    x: Math.round(3 + Math.random() * 94),
    delai: Math.round(Math.random() * 2400) / 1000,
    duree: Math.round((2.6 + Math.random() * 1.8) * 100) / 100,
    derive: Math.round((Math.random() * 2 - 1) * 50),
    tour: Math.round((Math.random() * 2 - 1) * 360),
    echelle: Math.round((0.45 + Math.random() * 0.55) * 100) / 100,
  }))
}

function sansMouvement(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return true
  }
}

/** Des confettis qui se comptent en montant, à la révélation ; d'un coup sans mouvement. */
function useCompte(cible: number, actif: boolean, calme: boolean): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!actif) return
    if (calme) {
      setN(cible)
      return
    }
    let image = 0
    const debut = performance.now()
    const pas = (t: number) => {
      const p = Math.min(1, (t - debut) / 1200)
      setN(Math.round(cible * (1 - (1 - p) ** 3)))
      if (p < 1) image = requestAnimationFrame(pas)
    }
    image = requestAnimationFrame(pas)
    return () => cancelAnimationFrame(image)
  }, [actif, cible, calme])
  return n
}

/** La première forme d'un compagnon : celle qu'on achète en boutique, et que le coffre offre. */
const premiereForme = (cle: string) => compagnon(cle)?.formes[0]

/**
 * L'objet tiré, tel qu'il se montre en grand : un fond en carte peinte, un
 * thème en photo de son écran, un compagnon peint, une gerbe en ses
 * particules, des confettis comptés. Posé dès que le tirage revient, caché
 * jusqu'à la révélation : ses images arrivent pendant la charge, et rien ne
 * paraît vide quand il sort du coffre.
 */
function ObjetMontre({ objet, compte }: { objet: ObjetDuTresor; compte: number }) {
  switch (objet.sorte) {
    case 'fond':
      return (
        <span className={`coffre-fond carte-fond fond-${objet.cle}`}>
          <span className="coffre-reflet" />
        </span>
      )
    case 'theme': {
      const image = apercuDe(objet.cle)
      return (
        <span className="coffre-theme">
          {image ? <img src={image} alt="" decoding="async" /> : <Icon name="palette" />}
          <span className="coffre-reflet" />
        </span>
      )
    }
    case 'compagnon': {
      const forme = premiereForme(objet.cle)
      return forme ? <Medaillon cle={forme.key} className="coffre-medaillon" /> : <Icon name="sparkles" />
    }
    case 'gerbe':
      // Une seule taille de police pour ses trois particules : chaque taille d'un emoji se met en forme à part (règle `css.md`).
      return <span className="coffre-gerbe">{gerbeDuCatalogue(objet.cle)?.particules.slice(0, 3).join('') ?? '🎉'}</span>
    case 'confettis':
      return (
        <span className="coffre-confettis">
          <span aria-hidden="true">🎊</span>
          <b>{`+${formatNumber(compte)}`}</b>
        </span>
      )
  }
}

/** Où l'essayer : la loge, l'objet déjà sur la carte (`essaiDemande`) ; les confettis, la boutique. */
function gesteDeLObjet(o: ObjetDuTresor): { href: string; libelle: string } {
  switch (o.sorte) {
    case 'fond':
      return { href: `/profil?essayer=${encodeURIComponent(o.cle)}#fond`, libelle: 'L’essayer sur ma carte' }
    case 'gerbe':
      return { href: `/profil?essayer=${encodeURIComponent(o.cle)}#gerbe`, libelle: 'L’essayer' }
    case 'theme':
      return { href: `/profil?essayer=${encodeURIComponent(o.cle)}#theme`, libelle: 'L’essayer' }
    case 'compagnon': {
      const forme = premiereForme(o.cle)
      return forme ? { href: `/profil?essayer=${encodeURIComponent(forme.key)}#avatar`, libelle: 'L’essayer' } : { href: '/profil#avatar', libelle: 'Le voir' }
    }
    case 'confettis':
      return { href: '/boutique', libelle: 'Voir la boutique' }
  }
}

/** Ce que l'objet est, sous son nom : le trésor ne se vend nulle part, la boutique l'offre. */
function sorteDeLObjet(o: ObjetDuTresor): string | null {
  if (o.sorte === 'confettis') return null
  if (o.sorte === 'fond' || o.sorte === 'gerbe') return `${NOM_DE_LA_SORTE[o.sorte]} du trésor`
  return `${NOM_DE_LA_SORTE[o.sorte]} · offert`
}

/**
 * Le tirage d'un aperçu, au QG : le vrai tirage, à ses vraies chances, comme
 * pour un profil qui n'aurait rien — mais ici, et rien ne s'écrit.
 */
function tirageDApercu(attente: CoffreEnAttente): CoffreOuvert {
  const { objet, rarete } = tirerLeCoffre(attente.rang, { possede: () => false, hasard: Math.random, jour: new Date().toISOString().slice(0, 10) })
  return { ...attente, rarete, objet, nom: nomDeLObjet(objet), detail: phraseDeLObjet(objet), ouvertLe: Date.now() }
}

/** La révélation, sous l'objet : sa rareté, son nom, ce qu'il fait, et l'essayer — en aperçu, en rouvrir un autre. */
function Verdict({ ouvert, onFermer, onEncore }: { ouvert: CoffreOuvert; onFermer: () => void; onEncore?: () => void }) {
  const { href, libelle } = gesteDeLObjet(ouvert.objet)
  const sorte = sorteDeLObjet(ouvert.objet)
  return (
    <div className="coffre-verdict">
      <span className="coffre-rarete">
        <i aria-hidden="true" />
        {NOM_RARETE[ouvert.rarete]}
        <i aria-hidden="true" />
      </span>
      <h3 className="coffre-nom">{ouvert.nom}</h3>
      {sorte && <span className="coffre-sorte">{sorte}</span>}
      <p className="coffre-detail">{espacesFines(ouvert.detail)}</p>
      <div className="coffre-gestes">
        {onEncore ? (
          <button type="button" className="btn btn-primary" onClick={onEncore}>
            Encore un
          </button>
        ) : (
          <a className="btn btn-primary" href={href}>
            {libelle}
          </a>
        )}
        <button type="button" className="btn btn-ghost" onClick={onFermer}>
          Fermer
        </button>
      </div>
    </div>
  )
}

/**
 * La scène de l'ouverture : par-dessus tout, dans une nuit à elle, quel que
 * soit le thème — la lumière du coffre n'y lutte contre aucun décor. Posée
 * sur la page, hors de la feuille qui l'ouvre : sous une feuille, sa
 * hauteur et ses voiles l'auraient rognée.
 */
export function SceneDuCoffre({
  attente,
  onFermer,
  apercu = false,
}: {
  attente: CoffreEnAttente
  onFermer: () => void
  /** Le QG, pour voir l'ouverture telle que les joueurs la voient : le tirage se fait ici, rien ne s'écrit, rien ne se gagne. */
  apercu?: boolean
}) {
  const boite = useRef<HTMLDivElement>(null)
  const titre = useId()
  const [acte, setActe] = useState<Acte>('repos')
  const [ouvert, setOuvert] = useState<CoffreOuvert | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [calme] = useState(sansMouvement)
  const [braises] = useState(() => tirerLesBraises(16))
  const debut = useRef(0)
  const durees = calme ? DUREES_CALMES : DUREES
  const peint = COFFRES_PEINTS[attente.rang]
  const rarete = ouvert?.rarete
  const objet = ouvert?.objet
  const compte = useCompte(objet?.sorte === 'confettis' ? objet.confettis : 0, acte === 'revele', calme)

  // Pendant l'ouverture, Échap et la croix passent au bout — le tirage est fait ; ensuite, ils ferment.
  const fermer = () => {
    if ((acte === 'charge' || acte === 'eclat') && ouvert) setActe('revele')
    else onFermer()
  }
  useModale(boite, fermer)

  const ouvrir = () => {
    if (acte !== 'repos' && acte !== 'erreur') return
    setErreur(null)
    setOuvert(null)
    setActe('charge')
    debut.current = performance.now()
    ;(apercu ? Promise.resolve(tirageDApercu(attente)) : api.joueur.ouvrirLeCoffre(attente.semaine).then(r => r.coffre)).then(
      coffre => setOuvert(coffre),
      (e: unknown) => {
        setErreur(e instanceof Error ? e.message : 'Le coffre n’a pas pu s’ouvrir : réessaie dans un instant.')
        setActe('erreur')
      },
    )
  }

  // La charge dure au moins sa durée, et tant que le tirage n'est pas revenu : elle frémit en l'attendant.
  useEffect(() => {
    if (acte !== 'charge' || !ouvert) return
    const t = window.setTimeout(() => setActe('eclat'), Math.max(0, debut.current + durees.charge - performance.now()))
    return () => window.clearTimeout(t)
  }, [acte, ouvert, durees.charge])
  useEffect(() => {
    if (acte !== 'eclat') return
    const t = window.setTimeout(() => setActe('revele'), durees.eclat)
    return () => window.clearTimeout(t)
  }, [acte, durees.eclat])

  // Le bouton touché disparaît avec son acte : le focus suit, sans quoi le clavier tomberait sur la page, inerte derrière.
  useEffect(() => {
    if (acte === 'revele') boite.current?.querySelector<HTMLElement>('.coffre-gestes .btn-primary')?.focus({ preventScroll: true })
    else if (acte === 'charge' || acte === 'erreur') boite.current?.focus({ preventScroll: true })
  }, [acte])

  // La gerbe d'une gerbe gagnée — son aperçu, en vrai —, ou celle des confettis ; tirée une fois.
  const gerbe = objet?.sorte === 'gerbe' ? gerbeDuCatalogue(objet.cle) : objet?.sorte === 'confettis' ? gerbeDuCatalogue('confettis') : undefined
  const particules = useMemo(() => (gerbe ? tirerLesParticules(gerbe.allure ?? ALLURE_PAR_DEFAUT) : []), [gerbe?.key])
  const etincelles = useMemo(() => tirerLesEtincelles(rarete ? ETINCELLES[rarete] : 0), [rarete])

  const style = {
    '--lumiere': LUMIERE_DU_RANG[attente.rang],
    '--eclat': rarete ? LUMIERE_DE_LA_RARETE[rarete] : LUMIERE_DU_RANG[attente.rang],
    ...(rarete ? gemme(rarete) : {}),
  } as CSSProperties
  const chances = CHANCES_DU_COFFRE[attente.rang]
  const annonce = acte === 'charge' || acte === 'eclat' ? 'Le coffre s’ouvre…' : acte === 'revele' && ouvert ? `${NOM_RARETE[ouvert.rarete]} : ${ouvert.nom}.` : ''

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className={`coffre-scene coffre-${acte}` + (rarete ? ` coffre-tire-${rarete}` : '')} style={style}>
      <div ref={boite} className="coffre-boite" role="dialog" aria-modal="true" aria-labelledby={titre} tabIndex={-1}>
        <header className="coffre-tete">
          <span className="label">{`Ta semaine du ${jourEnToutesLettres(attente.semaine, true)}`}</span>
          <h2 id={titre}>{NOM_DU_COFFRE[attente.rang]}</h2>
          {/* Les tampons qui l'ont rempli, en étoiles : ce que la semaine a valu, d'un coup d'œil. */}
          <span className="coffre-tampons" role="img" aria-label={`${attente.tampons} tampon${attente.tampons > 1 ? 's' : ''} sur ${TAMPONS_PAR_SEMAINE}`}>
            {Array.from({ length: TAMPONS_PAR_SEMAINE }, (_, i) => (
              <i key={i} className={i < attente.tampons ? 'coffre-tampon-plein' : undefined} />
            ))}
          </span>
          <button type="button" className="coffre-fermer" onClick={fermer} aria-label={(acte === 'charge' || acte === 'eclat') && ouvert ? 'Passer l’animation' : 'Fermer'}>
            <Icon name="x" />
          </button>
        </header>
        <div className="coffre-theatre">
          <span className="coffre-rayons" aria-hidden="true" />
          {rarete === 'legendaire' && <span className="coffre-rayons coffre-rayons-contraires" aria-hidden="true" />}
          <span className="coffre-halo" aria-hidden="true" />
          <span className="coffre-aura" aria-hidden="true" />
          <span className="coffre-socle" aria-hidden="true" />
          {/* Le coffre se touche aussi : c'est lui qu'on a envie d'ouvrir. Le clavier et le lecteur d'écran ont « Ouvrir le coffre », dessous. */}
          <div className="coffre-caisse" aria-hidden="true" onClick={ouvrir} style={{ '--fente': peint?.fente ?? 0.5, '--rapport': peint?.rapport ?? 1 } as CSSProperties}>
            <span className="coffre-colonne" />
            {peint ? (
              <>
                <img className="coffre-ferme" src={peint.ferme} alt="" width={480} height={Math.round(480 * peint.rapport)} draggable={false} />
                <img className="coffre-ouvert" src={peint.ouvert} alt="" width={480} height={Math.round(480 * peint.rapport)} draggable={false} />
              </>
            ) : (
              <span className="coffre-dessin">
                <Icon name="coffre" />
              </span>
            )}
            <span className="coffre-lueur" />
            {FUITES.map((f, i) => (
              <span key={i} className="coffre-fuite" style={{ '--x': f.x, '--angle': f.angle, '--delai': f.delai } as CSSProperties} />
            ))}
            {braises.map(b => (
              <span
                key={b.i}
                className="coffre-braise"
                style={{ '--dx': `${b.dx}px`, '--dy': `${b.dy}px`, '--repos': `${b.repos}s`, '--charge': `${b.charge}s`, '--s': b.echelle } as CSSProperties}
              />
            ))}
            <span className="coffre-onde" />
            <span className="coffre-onde coffre-onde-seconde" />
          </div>
          {objet && (
            <div className="coffre-objet" aria-hidden={acte !== 'revele'}>
              <span className="coffre-objet-monte">
                <ObjetMontre objet={objet} compte={compte} />
              </span>
            </div>
          )}
        </div>
        <div className="coffre-bas">
          {acte === 'repos' || acte === 'erreur' ? (
            <>
              <ul className="coffre-chances" aria-label="Ses chances, rareté par rareté">
                {RARETES.filter(r => chances[r] > 0).map(r => (
                  <li key={r} style={gemme(r)}>
                    <i aria-hidden="true" />
                    {NOM_RARETE[r]}
                    <b>{`${chances[r]} %`}</b>
                  </li>
                ))}
              </ul>
              <p className="coffre-promesse">{espacesFines('Jamais ce que tu as déjà. Ses fonds de carte et ses gerbes du trésor ne se trouvent nulle part ailleurs.')}</p>
              {erreur && (
                <p className="error" role="alert">
                  {erreur}
                </p>
              )}
              <button type="button" className="btn btn-primary btn-block coffre-ouvrir" onClick={ouvrir}>
                <Icon name="coffre" />
                {erreur ? 'Réessayer' : 'Ouvrir le coffre'}
              </button>
            </>
          ) : acte === 'revele' && ouvert ? (
            <Verdict
              ouvert={ouvert}
              onFermer={onFermer}
              onEncore={
                apercu
                  ? () => {
                      setOuvert(null)
                      setActe('repos')
                    }
                  : undefined
              }
            />
          ) : (
            <p className="coffre-attente">Le coffre s’ouvre…</p>
          )}
        </div>
        <p className="sr-only" aria-live="polite">
          {annonce}
        </p>
      </div>
      {acte === 'revele' && etincelles.length > 0 && (
        <span className="coffre-pluie" aria-hidden="true">
          {etincelles.map(e => (
            <i
              key={e.i}
              style={{ '--x': `${e.x}%`, '--delai': `${e.delai}s`, '--duree': `${e.duree}s`, '--derive': `${e.derive}px`, '--tour': `${e.tour}deg`, '--s': e.echelle } as CSSProperties}
            />
          ))}
        </span>
      )}
      {acte === 'revele' && gerbe && <GerbeVue g={gerbe} particules={particules} />}
      <span className="coffre-flash" aria-hidden="true" />
    </div>,
    document.body,
  )
}
