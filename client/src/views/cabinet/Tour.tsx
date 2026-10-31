import { useEffect, useMemo, useRef, useState } from 'react'
import { aLaDemande, useALaDemande } from '../../aLaDemande'
import { Dessin } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { Sortie } from '../../components/Pieces'
import { CARTES_PEINTES } from '../../components/cartes-peintes'
import { IMAGES } from '../../components/legendaires-peints'
import { RARETE_DITE, TEINTE_DE_LA_FAMILLE } from '../../components/OeuvrePeinte'
import { espacesFines } from '../../format'
import { ETAGES_DE_LA_TOUR, ORDRE_DE_LA_TOUR, salleDeLEtage } from '../../../../shared/cabinet/montee'
import { oeuvre } from '../../../../shared/cabinet/oeuvres'
import { GARDIENS_DES_SALLES, salle, type CleDeSalle } from '../../../../shared/cabinet/salles'
import { JEUX } from '../../../../shared/cabinet/jeux/regle'
import type { PageDuCabinet, PorteVue, TourVue } from '../../../../shared/cabinet/vues'
import { legendaire } from '../../../../shared/legendaires'
import { adresseDe, type PartieDemandee } from './ecrans'
import { compte, possedeesDe } from './Musee'
import { TaPartieTAttend } from './PartieQuiAttend'
import type { EtatDeLaTour, IleDeLaTour, SceneDeLaTour } from './TourEn3D'

// La tour : l'entrée du Cabinet depuis le 31 octobre 2026. Les neuf salles en
// étages, qu'on monte en ouvrant une porte à chacun — une partie de trois
// manches derrière (`shared/cabinet/montee.ts`). Elle répond aux retours que
// le propriétaire a rapportés : trop d'informations sur l'accueil, pas de
// progression d'étage en étage, et pas assez dit de ce qu'on gagne. L'écran
// tient donc en un téléphone, sa barre comprise : la tour d'un bord à l'autre,
// le but en trois images, l'étage à jouer et ses portes — chacune montre ce
// qu'elle donne, l'œuvre peinte comprise. Le reste vit sur les autres pièces
// de la barre (`Barre.tsx`) : ton musée, les gardiens, jouer.
//
// La tour se dessine en 3D (`TourEn3D.ts`), chargée à la demande : three.js ne
// descend qu'ici. Le dessin ne dit rien que la page ne dise en mots — la liste
// des étages le double pour un lecteur d'écran, et le remplace sans WebGL.

const LA_TOUR_EN_3D = aLaDemande(() => import('./TourEn3D'))

/** La tour se dessine-t-elle ici ? Sans WebGL — un vieux téléphone, un rendu de test —, la liste des étages la remplace. */
function webglPossible(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

/** La teinte d'une salle, celle de sa famille au fond des peintures ; le Vestibule, qui expose les neutres, prend l'or. */
function teinteDe(cle: CleDeSalle): number {
  if (cle === 'vestibule') return 42
  const hex = TEINTE_DE_LA_FAMILLE[cle as keyof typeof TEINTE_DE_LA_FAMILLE] ?? '#9aa9bd'
  const [r, g, b] = [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  if (d === 0) return 42
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return Math.round(h * 60 + 360) % 360
}

/** L'étage où se tient la montée : celui à jouer, ou celui dont la partie attend ; null hors d'une montée. */
function etageDeLaMontee(t: TourVue): number | null {
  const m = t.montee
  if (!m || m.finie) return null
  return t.aJouer?.etage ?? m.etages.find(e => e.total === null)?.etage ?? null
}

/** Jusqu'où la tour est connue : le record, la montée du jour, le premier étage toujours. Au-dessus, la brume. */
const atteint = (t: TourVue): number => Math.max(1, t.record?.etage ?? 0, t.montee?.hauteur ?? 0, etageDeLaMontee(t) ?? 0)

/** Ce que la scène dessine, de la page : les îles, la brume au-dessus de ce qui est connu, la comète de la montée. */
export function etatDeLaTour(page: PageDuCabinet, focus: number): EtatDeLaTour {
  const t = page.tour
  const connu = atteint(t)
  const iles = ORDRE_DE_LA_TOUR.map((cle, i): IleDeLaTour => {
    const s = page.salles.find(x => x.cle === cle)
    const premier = GARDIENS_DES_SALLES[cle][0]
    return {
      nom: `Étage ${i + 1} · ${salle(cle)?.nom ?? cle}`,
      teinte: teinteDe(cle),
      gardien: IMAGES[premier]?.art[1] ?? null,
      eveille: page.gardiens.tous.some(g => g.legendaire === premier && g.reveille),
      oeuvres: (s?.oeuvres ?? []).map(o => ({ image: o.possedee ? (CARTES_PEINTES[o.cle]?.[1] ?? null) : null, rarete: o.rarete })),
      brume: i + 1 > connu,
    }
  })
  const ici = etageDeLaMontee(t)
  return { iles, focus, allume: Math.max(t.montee?.hauteur ?? 0, ici ?? 0), joueur: ici === null ? null : ici - 1 }
}

/** Ce qu'une porte demande à « Commencer » : l'étage que la page a vu, et la porte telle qu'elle l'a vue. */
const demandeDe = (aJouer: NonNullable<TourVue['aJouer']>, p: PorteVue): PartieDemandee => ({ origine: 'montee', n: aJouer.n, etage: aJouer.etage, porte: p.porte, jeu: p.jeu, oeuvre: p.oeuvre })

/** Les cœurs, dessinés et dits : « ♥♥♡ », « 2 cœurs sur 3 ». */
function Coeurs({ n, sur }: { n: number; sur: number }) {
  return (
    <span className="cab-coeurs" role="img" aria-label={`${compte(n, 'cœur')} sur ${sur}`}>
      {'♥'.repeat(n)}
      <span className="cab-coeur-perdu">{'♡'.repeat(Math.max(0, sur - n))}</span>
    </span>
  )
}

/** Une porte : ce qu'elle donne — l'œuvre peinte, nommée, ou un cœur, ou les étoiles doublées —, son jeu, son seuil. */
function Porte({ p, onOuvrir }: { p: PorteVue; onOuvrir: () => void }) {
  const o = oeuvre(p.oeuvre)
  const peinture = o ? CARTES_PEINTES[o.cle] : undefined
  const titre = o ? o.nom : p.butin === 'coeur' ? 'Un cœur de plus' : 'Les étoiles doublées'
  // Deux lignes, pour que les portes tiennent dans l'écran sous la tour : ce qu'elle donne, puis comment l'ouvrir. La rareté se
  // dit en mots, jamais par la seule couleur.
  const rarete = o ? `, ${RARETE_DITE[o.rarete]}${p.coffre ? ', au coffre' : ''}` : ''
  const dit = `${JEUX[p.jeu].nom} · ${p.seuil} ★ sur 9`
  return (
    <button type="button" className="cab-porte-tour" onClick={onOuvrir}>
      <span className="cab-porte-image" aria-hidden="true">
        {peinture ? <img src={peinture[1]} alt="" decoding="async" /> : <span className="cab-porte-symbole">{p.butin === 'coeur' ? '♥' : '★×2'}</span>}
      </span>
      <span className="cab-porte-texte">
        <span>
          <b>{titre}</b>
          {rarete && <span className="cab-porte-jeu">{rarete}</span>}
        </span>
        <span className="cab-porte-jeu">{espacesFines(dit)}</span>
      </span>
    </button>
  )
}

/**
 * Le but du Cabinet, en trois images et trois mots — « on ne sait pas à quoi sert le jeu » (le propriétaire, le 31 octobre
 * 2026) : ouvre une porte, gagne l'œuvre qu'elle garde, réveille le gardien de sa salle — un avatar légendaire, à porter partout.
 * L'œuvre est celle qu'une porte de l'étage garde, le gardien celui de sa salle : le but se dit sur ce qu'il va jouer.
 */
function LeBut({ porte, gardien }: { porte: PorteVue | undefined; gardien: string }) {
  const o = oeuvre(porte?.oeuvre)
  const peinture = o ? CARTES_PEINTES[o.cle] : undefined
  return (
    <div className="cab-tour-but">
      <ol aria-label="Le but">
        <li>
          <span className="cab-tour-but-image" aria-hidden="true">
            <Icon name="chateau" />
          </span>
          Ouvre
        </li>
        <li>
          <span className="cab-tour-but-image" aria-hidden="true">
            {peinture ? <img src={peinture[1]} alt="" decoding="async" /> : <Icon name="image" />}
          </span>
          Gagne
        </li>
        <li>
          <span className="cab-tour-but-image cab-medaillon" aria-hidden="true">
            <Dessin cle={gardien} verrouille />
          </span>
          Réveille
        </li>
      </ol>
      <p className="cab-ligne">{espacesFines('Chaque gardien réveillé devient ton avatar légendaire.')}</p>
    </div>
  )
}

/** Ce que l'étage d'avant a fait : la porte ouverte et ce qu'elle a donné, ou le cœur perdu. */
function dernierEtage(t: TourVue): string | null {
  const e = t.montee?.etages.filter(x => x.ouverte !== null).at(-1)
  if (!e) return null
  if (!e.ouverte) return `Étage ${e.etage} : la porte est restée fermée, un cœur de moins.`
  const o = oeuvre(e.oeuvre)
  return `Étage ${e.etage} : la porte s’est ouverte${o ? `, ${o.nom} est à toi` : e.butin === 'coeur' ? ', un cœur de plus' : ', les étoiles doublées'}.`
}

export function Tour({ page, onPorte, onReprendre, onRegles }: { page: PageDuCabinet; onPorte: (d: PartieDemandee) => void; onReprendre: () => void; onRegles: () => void }) {
  const t = page.tour
  const m = t.montee
  const ici = etageDeLaMontee(t) ?? t.aJouer?.etage ?? 1
  const [focus, setFocus] = useState(ici - 1)
  const [regardee, setRegardee] = useState<number | null>(null)
  // L'étage de la montée change — une porte franchie, une montée neuve — : la caméra y monte.
  useEffect(() => setFocus(ici - 1), [ici])
  const [troisD] = useState(webglPossible)
  const module = useALaDemande(LA_TOUR_EN_3D, troisD)
  const boite = useRef<HTMLDivElement>(null)
  const titre = useRef<HTMLHeadingElement>(null)
  const scene = useRef<SceneDeLaTour | null>(null)
  const etat = useMemo(() => etatDeLaTour(page, focus), [page, focus])
  const etatRef = useRef(etat)
  etatRef.current = etat
  const enScene = troisD && module !== null && module !== 'perdu'
  useEffect(() => {
    if (!module || module === 'perdu' || !boite.current) return
    try {
      // Le titre est posé sur la nuit : la caméra regarde l'étage sous lui, jamais derrière.
      const couvert = () => {
        const t = titre.current?.getBoundingClientRect()
        const s = boite.current?.getBoundingClientRect()
        return t && s ? t.bottom - s.top : 0
      }
      scene.current = module.creerLaTour(boite.current, etatRef.current, { surIle: setRegardee, surFocus: setFocus, couvert })
    } catch {
      // Un contexte WebGL refusé au dernier moment : la liste des étages reste.
      scene.current = null
    }
    return () => {
      scene.current?.detruire()
      scene.current = null
    }
  }, [module])
  useEffect(() => {
    scene.current?.maj(etat)
  }, [etat])

  const aJouer = t.aJouer
  const salleDeLAJouer = aJouer ? salle(salleDeLEtage(aJouer.etage)) : undefined
  const enCours = page.enCours
  const vue = regardee === null ? null : ORDRE_DE_LA_TOUR[regardee]
  const salleVue = vue ? page.salles.find(s => s.cle === vue) : undefined
  const gardienVu = vue ? GARDIENS_DES_SALLES[vue][0] : null
  const recit = m && !m.finie ? dernierEtage(t) : null

  const record = t.record ? (t.record.etage >= ETAGES_DE_LA_TOUR ? 'le sommet' : `étage ${t.record.etage}`) : null
  return (
    <div className="player-shell cab-page cab-tour">
      <div className={'cab-tour-scene' + (enScene ? ' cab-tour-en-3d' : '')} ref={boite}>
        {/* Le titre sur la nuit, la tour d'un bord à l'autre : ce qu'il possède vit au musée — en surimpression sur la scène, il
            passait sur le nom d'un étage. */}
        <div className="cab-tour-haut">
          {/* Les règles, d'un rond au bout de la ligne de sortie : « Comment ça marche ? » vit aussi sous « Jouer », en toutes
              lettres. À côté du titre, il passait sur le nom de l'étage. */}
          <div className="cab-tour-ligne">
            <Sortie />
            <button type="button" className="cab-tour-aide" aria-label="Comment ça marche ?" onClick={onRegles}>
              <Icon name="help" />
            </button>
          </div>
          <h1 ref={titre}>La tour</h1>
        </div>
        {/* Le dessin est décoratif : la liste dit la même tour, et la remplace sans WebGL. */}
        <ol className={'cab-tour-etages' + (enScene ? ' sr-only' : '')} aria-label="Les étages de la tour">
          {[...ORDRE_DE_LA_TOUR].reverse().map((cle, k) => {
            const n = ETAGES_DE_LA_TOUR - k
            const joue = m?.etages.find(e => e.etage === n)
            const etatDit = joue ? (joue.ouverte === null ? 'en cours' : joue.ouverte ? 'porte ouverte' : 'porte fermée') : n === ici && m && !m.finie ? 'à jouer' : null
            return (
              <li key={cle} className={n === ici ? 'cab-tour-ici' : undefined}>
                <span>{espacesFines(`${n} · ${salle(cle)?.nom ?? cle}`)}</span>
                {etatDit && <span className="cab-tour-etat-etage">{etatDit}</span>}
              </li>
            )
          })}
        </ol>
        {salleVue && gardienVu && regardee !== null && (
          <div className="cab-tour-legende">
            <b>{espacesFines(`Étage ${regardee + 1} · ${salleVue.nom}`)}</b>
            <span>
              {espacesFines(
                `${possedeesDe(salleVue)} sur ${salleVue.oeuvres.length} œuvres · ${legendaire(gardienVu)?.nom ?? 'son gardien'} ${page.gardiens.tous.some(g => g.legendaire === gardienVu && g.reveille) ? 'veille' : 'dort'}`,
              )}
            </span>
            <a className="cab-lien" href={adresseDe({ e: 'salle', salle: salleVue.cle })}>
              Voir la salle
            </a>
          </div>
        )}
      </div>

      {/* Nommée pour l'oreille, quoi qu'elle montre : l'étage à jouer, ou la partie qui attend. */}
      <section className="cab-tour-panneau" aria-label="La montée">
        {enCours ? (
          <TaPartieTAttend jeu={enCours.jeu} onReprendre={onReprendre} />
        ) : aJouer ? (
          <>
            {m && !m.finie ? (
              <p className="cab-tour-montee">
                <Coeurs n={aJouer.coeurs} sur={t.coeurs} />
                <span>{espacesFines(`Étage ${aJouer.etage} sur ${ETAGES_DE_LA_TOUR} · ${m.etoiles} ★${record ? ` · record : ${record}` : ''}`)}</span>
              </p>
            ) : (
              <>
                <LeBut porte={aJouer.portes.find(p => p.oeuvre) ?? aJouer.portes[0]} gardien={GARDIENS_DES_SALLES[salleDeLEtage(aJouer.etage) ?? 'vestibule'][0]} />
                {m?.finie ? (
                  <p className="cab-ligne cab-tour-fin">
                    {espacesFines(
                      `Ta dernière montée : ${m.sommet ? 'le sommet' : `étage ${m.hauteur}`}, ${m.etoiles} ★${t.record && t.record.etage === m.hauteur && t.record.etoiles === m.etoiles ? ' — ton record !' : '.'}`,
                    )}
                  </p>
                ) : (
                  record && <p className="cab-ligne cab-tour-fin">{espacesFines(`Ton record : ${record}.`)}</p>
                )}
              </>
            )}
            {recit && <p className="cab-raison">{espacesFines(recit)}</p>}
            <h2>
              {espacesFines(`Étage ${aJouer.etage} · ${salleDeLAJouer?.nom ?? ''}`.trim())}
              <span className="cab-tour-sous-titre">{aJouer.portes.length > 1 ? ' · choisis ta porte' : ' · le coffre'}</span>
            </h2>
            <div className="cab-tour-portes">
              {aJouer.portes.map(p => (
                <Porte key={p.porte} p={p} onOuvrir={() => onPorte(demandeDe(aJouer, p))} />
              ))}
            </div>
          </>
        ) : (
          <p className="cab-ligne">
            {espacesFines('Ta porte se joue : reprends-la pour monter.')}
          </p>
        )}
      </section>
    </div>
  )
}
