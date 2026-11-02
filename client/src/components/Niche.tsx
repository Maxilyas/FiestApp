import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Icon } from './Icon'
import { DESSINS } from './compagnons-peints'
import type { DessinDeCompagnon, HumeurPeinte } from './Compagnon'
import { useModale } from '../modale'
import { api } from '../api'
import { espacesFines, formatNumber } from '../format'
import {
  JUSTES_DES_FORMES,
  MONTREE_DE_LA_METAMORPHOSE,
  avecLui,
  compagnon as leCompagnon,
  formeDansLaNiche,
  metamorphoseOuverte,
  nomDeLaForme,
  prochaineForme,
  type CleDeCompagnon,
  type Compagnon,
  type CompagnonAcquis,
  type CompagnonPossede,
  type FormeDeCompagnon,
} from '../../../shared/compagnons'
import { NOM_RARETE } from '../../../shared/badges'
import { ENVIES, prochainCadeauGrand, toursAppris, type Envie, type SoinsDuCompagnon, type SoinsDuProfil } from '../../../shared/soins'
import {
  NOM_DU_STYLE,
  ORNEMENTS,
  STYLES_D_ORNEMENT,
  ornementsMontres,
  prochainOrnement,
  prochainSeuil,
  styleDeLOrnement,
  titreDeLAmitie,
  type CleDOrnement,
  type OrnementMontre,
  type StyleDOrnement,
} from '../../../shared/ornements'
import { ecouterLaNiche, nicheTouchee, porterNiche, prendreLAppel, retenirLeReveil, type MomentDeLaNiche, type NicheVue } from '../niche'
import { ApercuDOrnement, DerriereLaNiche, DevantLaNiche } from './Ornements'

// La niche du compagnon (le choix du 18 octobre 2026,
// `retours/2026-10-16/compagnon/principe.md`) : une petite fenêtre en arche,
// toujours au même coin — en haut à droite de la colonne du téléphone —, sur
// toutes les pages qui lisent le profil. Son fond est le décor peint de sa
// forme, celui de son avatar (« la déco », le propriétaire : le médaillon qui
// suivait a été écarté pour « trop de variation ») ; il y est en buste, grand
// visage. Calme : il ne bouge pas de lui-même — seulement à la révélation, où
// ses humeurs peintes s'échangent en place (le principe, § 2 : ravi d'une
// bonne réponse, qui le nourrit ; dépité avec toi d'une ratée ; une bulle de
// cœurs quand peu l'ont trouvée ; au podium ou à une forme atteinte, il sort
// de sa niche). Elle se fait petite quand la page défile, et la toucher ouvre
// sa fiche, une bulle sous elle : le caresser, qui ne rapporte rien
// (invariant 8 : aucun avantage), où il en est, ses envies du jour, et « Chez
// lui », sa page, où se règle tout le reste. Chaque page lui laisse son coin
// (`body.avec-niche`, `styles.css`).

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
  // La luciole (le 20 octobre 2026), de la même façon : le cadrage de sa page
  // de la planche (`humeurs-luciole/cadrages.json`), qui regarde déjà la page,
  // rapporté sur ses humeurs livrées — la méthode retrouve celui de la tortue.
  'cp:luciole-ver': { taille: 1.02, gauche: -0.0267, haut: 0.2086, miroir: false },
  'cp:luciole-jeune': { taille: 1.3509, gauche: -0.1503, haut: -0.0023, miroir: false },
  'cp:luciole-adulte': { taille: 1.556, gauche: -0.2745, haut: -0.1975, miroir: false },
  'cp:luciole-constellation': { taille: 1.4534, gauche: -0.323, haut: -0.1648, miroir: false },
  // Leurs métamorphoses de lumière, posées à l'œil sur leurs humeurs (le 19
  // octobre 2026) : le loup et le chat bondissent de face, la tortue garde ses
  // fleurs — toutes regardent déjà la page.
  'cp:loup-tempete': { taille: 1.9, gauche: -0.12, haut: -0.12, miroir: false },
  'cp:chat-soleil': { taille: 1.8, gauche: -0.68, haut: 0, miroir: false },
  'cp:tortue-fleurs': { taille: 1.6, gauche: -0.7, haut: -0.12, miroir: false },
  // La luciole-aurore (le 20 octobre 2026), essayée sur une maquette de la
  // niche contre la ligne de la constellation : le visage au milieu, ses deux
  // voiles d'aurore de part et d'autre — plus grande, on ne lisait plus ses ailes.
  'cp:luciole-aurore': { taille: 1.9, gauche: -0.322, haut: -0.25, miroir: false },
  // Le panda roux (le 20 octobre 2026) : sa tête, mesurée sur ses humeurs livrées, à 60 % de
  // la largeur de la niche et un peu au-dessus du milieu — il regarde déjà la page, de face.
  'cp:panda-bebe': { taille: 1.05, gauche: -0.025, haut: 0.051, miroir: false },
  'cp:panda-jeune': { taille: 1.5, gauche: -0.52, haut: -0.075, miroir: false },
  'cp:panda-adulte': { taille: 1.62, gauche: -0.36, haut: -0.036, miroir: false },
  'cp:panda-erable': { taille: 1.5, gauche: -0.055, haut: 0.045, miroir: false },
  'cp:panda-sakura': { taille: 1.62, gauche: -0.36, haut: 0.045, miroir: false },
}

/** Sans cadrage : le dessin entier, au fond de la niche. */
const ENTIER = { taille: 1, gauche: 0, haut: 0.15, miroir: false }

/**
 * Où est l'animal entier dans son dessin « perso » (gauche, haut, droite, bas,
 * en fractions du carré) : là où il se pose quand il sort de sa niche, ses
 * pattes au bas de l'écran. Mesuré sur ses humeurs neutre, ravie et
 * triomphante réunies — la queue levée élargit son cadre. Sans mesure, le
 * dessin entier.
 */
const SILHOUETTES: Readonly<Record<string, readonly [number, number, number, number]>> = {
  'cp:loup-louveteau': [0, 0.086, 0.92, 0.906],
  'cp:loup-jeune': [0.035, 0.061, 0.818, 0.98],
  'cp:loup-adulte': [0.127, 0.078, 0.812, 0.922],
  'cp:loup-ultime': [0.155, 0.174, 0.743, 0.854],
  'cp:chat-chaton': [0.031, 0.055, 0.871, 0.898],
  'cp:chat-jeune': [0.168, 0.074, 0.756, 0.988],
  'cp:chat-adulte': [0.063, 0.141, 0.859, 0.969],
  'cp:chat-esprit': [0.004, 0.004, 0.996, 0.996],
  'cp:tortue-bebe': [0.082, 0.057, 0.904, 0.912],
  'cp:tortue-jeune': [0.07, 0.178, 0.865, 0.869],
  'cp:tortue-adulte': [0.113, 0.061, 0.868, 0.888],
  'cp:tortue-ile': [0.072, 0.072, 0.915, 0.94],
  'cp:luciole-ver': [0.074, 0.098, 0.938, 0.873],
  'cp:luciole-jeune': [0.15, 0.096, 0.812, 0.812],
  'cp:luciole-adulte': [0.201, 0.139, 0.841, 0.828],
  'cp:luciole-constellation': [0.209, 0.075, 0.917, 0.866],
  'cp:loup-tempete': [0.071, 0.071, 0.965, 0.969],
  'cp:chat-soleil': [0.018, 0.023, 0.954, 0.984],
  'cp:tortue-fleurs': [0.004, 0.06, 0.996, 0.996],
  'cp:luciole-aurore': [0.004, 0.004, 0.996, 0.708],
  'cp:panda-bebe': [0.176, 0.068, 0.826, 0.893],
  'cp:panda-jeune': [0.059, 0.084, 0.93, 0.965],
  'cp:panda-adulte': [0.068, 0.102, 0.828, 0.909],
  'cp:panda-erable': [0.028, 0.1, 0.889, 0.97],
  'cp:panda-sakura': [0.06, 0.068, 0.79, 0.95],
}

/** Ce qui s'envole quand on le caresse : des cœurs et des étincelles, comme à la boutique — des emojis d'avant Unicode 13. */
export const ENVOLS = ['💛', '✨', '💖', '✨', '💛']

/** Des noms à lui donner, en exemple dans le champ vide. */
export const PROPOSITIONS: Readonly<Record<CleDeCompagnon, string>> = {
  loup: 'Nox, Luna, Grisou…',
  chat: 'Mochi, Grelot, Lumen…',
  tortue: 'Jade, Caillou, Mousse…',
  // Lumi, son nom de la maquette (le 18 octobre 2026), comme Nox celui du loup de Léa.
  luciole: 'Lumi, Lueur, Pollen…',
  panda: 'Roux, Noisette, Caramel…',
}

/** La forme que la niche montre : celle qu'il a choisie, sinon sa plus haute (`formeDansLaNiche`). */
const formeDe = (v: NicheVue) => formeDansLaNiche(v as CompagnonPossede)

/** « Louveteau », « Tortue-île » : son nom sous une petite niche, sans article. */
export function sansArticle(nom: string): string {
  const s = nom.replace(/^(L[ae] |L’)/, '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** La page a défilé de plus que cela : la niche se fait petite. */
const REPLI_PX = 40

/** Ce que montre la niche : l'expression neutre, ou l'une de ses humeurs peintes. */
type Humeur = 'neutre' | HumeurPeinte

/** Les humeurs de la révélation, chargées d'avance au coin de la page ; le triomphe ne vient qu'à son heure. */
const HUMEURS_DE_LA_REVELATION: readonly HumeurPeinte[] = ['ravi', 'depite']

/** Le temps du repas : sa jauge paraît, puis se cache. */
const REPAS_MS = 1600
/** Le vol des étincelles, de ce que la réponse rapporte jusqu'à sa niche. */
const VOL_MS = 820
/** Il sort après l'expérience : la page la montre d'abord (`Celebration`, en soirée), il attend qu'elle s'en aille. */
const AVANT_LA_SORTIE_MS = 1200
const CELEBRATION_MAX_MS = 8000
/** Dehors, combien de temps il reste — chaque caresse le retient un peu, jamais plus que `DEHORS_MAX_MS`. */
const DEHORS_MS = 4200
const RETENU_MS = 2200
const DEHORS_MAX_MS = 9000
/** Sans le mouvement qu'il fait pour sortir, il triomphe dans sa niche, ce temps-là. */
const TRIOMPHE_SUR_PLACE_MS = 2800
/** Un souffle retenu sans verdict — un quiz arrêté, une page quittée — se relâche de lui-même. */
const SOUFFLE_MAX_MS = 120_000
/** « Touche-moi ! » : la page se pose d'abord, puis la bulle reste le temps de la lire. */
const APPEL_APRES_MS = 1200
const APPEL_MS = 6500

export const sansMouvement = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Son dessin le montre tourné vers la droite : la niche le retourne pour regarder la page, la cueillette le tourne vers où il court. */
export function regardeADroite(forme: string): boolean {
  return CADRAGES[forme]?.miroir ?? false
}

/** Où est l'animal entier dans son dessin (gauche, haut, droite, bas) : ses pattes au sol, à la cueillette comme dehors. */
export function silhouetteDe(forme: string): readonly [number, number, number, number] {
  return SILHOUETTES[forme] ?? [0, 0, 1, 1]
}

const attendre = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/** Une image chargée et décodée avant qu'on la montre : il ne sort pas sans visage. */
function precharger(src: string): Promise<void> {
  const img = new Image()
  img.src = src
  return img.decode().catch(() => {})
}

/** Un cœur, dessiné : la bulle et ce qui monte quand on le caresse dehors. */
function Coeur() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21.5C5 16 1.5 12.4 1.5 8.2 1.5 5.1 3.9 2.8 6.9 2.8c2.1 0 3.9 1.1 5.1 2.9 1.2-1.8 3-2.9 5.1-2.9 3 0 5.4 2.3 5.4 5.4 0 4.2-3.5 7.8-10.5 13.3Z" fill="#e8739a" />
    </svg>
  )
}

/** Une étincelle : ce qu'une bonne réponse lui apporte. */
function Etincelle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0C12.8 7.6 16.4 11.2 24 12C16.4 12.8 12.8 16.4 12 24C11.2 16.4 7.6 12.8 0 12C7.6 11.2 11.2 7.6 12 0Z" fill="#ffe7a3" />
    </svg>
  )
}

/** Il pleut chez lui, dépité avec toi : rien ne sort vers la page. */
function Pluie() {
  return (
    <span className="niche-pluie">
      <svg viewBox="0 0 40 30" aria-hidden="true">
        <path d="M10 20h20a8 8 0 0 0 1-15.9A10 10 0 0 0 12.2 3 7.5 7.5 0 0 0 10 20Z" fill="#8a93a3" />
        <g stroke="#9cc8f5" strokeWidth="2" strokeLinecap="round">
          <path className="niche-goutte" d="M14 22l-1 4" />
          <path className="niche-goutte" d="M21 22l-1 4" />
          <path className="niche-goutte" d="M28 22l-1 4" />
        </g>
      </svg>
    </span>
  )
}

/** Un geste qui se rejoue à chaque fois : sautiller de joie, s'abattre — et, chez lui, ses tours (`shared/soins.ts`). */
export interface Geste {
  sorte: 'saute' | 'abat' | 'pirouette' | 'salut' | 'danse' | 'grandSaut'
  n: number
}

/**
 * Ses gestes, joués sur lui sans le remonter : remonté, son dessin se
 * redécodait, et l'animal pouvait manquer le temps d'une image. Abattu, il le
 * reste jusqu'au calme.
 */
const GESTES: Record<Geste['sorte'], { images: Keyframe[]; options: KeyframeAnimationOptions }> = {
  saute: {
    images: [
      { transform: 'translateY(0) scale(1, 1)' },
      { offset: 0.18, transform: 'translateY(2%) scale(1.05, 0.94)' },
      { offset: 0.45, transform: 'translateY(-9%) scale(0.97, 1.05)' },
      { offset: 0.7, transform: 'translateY(0) scale(1.04, 0.96)' },
      { transform: 'translateY(0) scale(1, 1)' },
    ],
    options: { duration: 800, easing: 'cubic-bezier(0.3, 0.6, 0.35, 1)' },
  },
  abat: {
    images: [{ transform: 'translateY(0)' }, { offset: 0.4, transform: 'translateY(3%) scale(1.02, 0.96)' }, { transform: 'translateY(2%) scale(1.01, 0.97)' }],
    options: { duration: 900, easing: 'ease-out', fill: 'forwards' },
  },
  // Ses tours, que la complicité lui apprend : la pirouette à trois jours, le salut à dix, la danse à vingt, le grand saut à quarante.
  pirouette: {
    images: [{ transform: 'rotateY(0deg)' }, { offset: 0.5, transform: 'translateY(-6%) rotateY(180deg)' }, { transform: 'rotateY(360deg)' }],
    options: { duration: 900, easing: 'ease-in-out' },
  },
  salut: {
    images: [{ transform: 'rotate(0deg)' }, { offset: 0.35, transform: 'translateY(4%) rotate(-10deg)' }, { offset: 0.7, transform: 'translateY(4%) rotate(-10deg)' }, { transform: 'rotate(0deg)' }],
    options: { duration: 1100, easing: 'ease-in-out' },
  },
  danse: {
    images: [
      { transform: 'translateX(0) rotate(0deg)' },
      { offset: 0.2, transform: 'translateX(-6%) rotate(-7deg)' },
      { offset: 0.4, transform: 'translateX(6%) rotate(7deg)' },
      { offset: 0.6, transform: 'translateX(-6%) rotate(-7deg)' },
      { offset: 0.8, transform: 'translateX(6%) rotate(7deg)' },
      { transform: 'translateX(0) rotate(0deg)' },
    ],
    options: { duration: 1200, easing: 'ease-in-out' },
  },
  grandSaut: {
    images: [
      { transform: 'translateY(0) scale(1, 1)' },
      { offset: 0.15, transform: 'translateY(3%) scale(1.06, 0.92)' },
      { offset: 0.5, transform: 'translateY(-26%) scale(0.96, 1.06) rotate(-6deg)' },
      { offset: 0.85, transform: 'translateY(0) scale(1.06, 0.94)' },
      { transform: 'translateY(0) scale(1, 1)' },
    ],
    options: { duration: 1000, easing: 'cubic-bezier(0.3, 0.6, 0.35, 1)' },
  },
}

/** Un tour qu'il sait (`TOURS`, `shared/soins.ts`) : le geste de son nom. */
const GESTE_DU_TOUR: Readonly<Record<string, Geste['sorte']>> = {
  'la pirouette': 'pirouette',
  'le salut': 'salut',
  'la danse': 'danse',
  'le grand saut': 'grandSaut',
}

/**
 * Le geste de la `n`-ième caresse : un tour sur deux, s'il en sait — la
 * caresse reste une caresse —, chez lui comme dans sa fiche : ses tours
 * appris ne se voyaient que sur sa page.
 */
export function gesteDeLaCaresse(complicite: number, n: number): Geste['sorte'] {
  const tours = toursAppris(complicite)
  return tours.length > 0 && n % 2 === 0 ? GESTE_DU_TOUR[tours[Math.floor(Math.random() * tours.length)]] : 'saute'
}

/** Ses envies, dessinées : un bol, une main, une balle — sur sa page et dans sa fiche. */
export function IconeDeLEnvie({ envie }: { envie: Envie }) {
  if (envie === 'gouter')
    return (
      <svg className="chez-icone" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z" />
        <path d="M2.5 11.5h19" />
        <path d="M9 8c0-1.2 1-1.6 1-2.8" />
        <path d="M13 8c0-1.2 1-1.6 1-2.8" />
      </svg>
    )
  if (envie === 'calin')
    return (
      <svg className="chez-icone" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" />
        <path d="M11 11.5V4a1.5 1.5 0 0 1 3 0v8" />
        <path d="M14 11.5V5.5a1.5 1.5 0 0 1 3 0V14" />
        <path d="M17 13.5v-1a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1.5a6.5 6.5 0 0 1-5.4-3L3.7 15a1.5 1.5 0 0 1 2.4-1.8L8 15.5" />
      </svg>
    )
  return (
    <svg className="chez-icone" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M4.6 8c4.4 1.6 10.4 1.6 14.8 0" />
      <path d="M4.6 16c4.4-1.6 10.4-1.6 14.8 0" />
    </svg>
  )
}

/** Le paquet de son cadeau, en petit : la ligne qui l'annonce, sous ses envies et dans sa fiche. */
export function PetitPaquet() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
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

/**
 * L'arche : son cadre, le décor peint de sa forme — un ciel teinté à la
 * première, qui n'en a pas —, lui en buste, son rebord et la jauge qu'il y
 * montre le temps d'un repas. Ses humeurs se posent sur l'expression neutre,
 * le même dessin repeint : une seule se voit, échangée en fondu, et jamais
 * avant d'être chargée — l'animal ne disparaît pas le temps de l'image.
 * `humeurs` : celles à charger dès maintenant. Après sa forme ultime, les
 * ornements que sa niche montre (`ornements`), chacun dans son style : ce qui
 * se pose derrière elle avant son cadre, l'or sur lui, le reste par-dessus —
 * hors du cadre, qui coupe tout. `grand` : leurs grands fichiers peints, là où
 * la niche se regarde — au coin de la page, comme le dessin de son compagnon,
 * et dans sa fiche. `dansLeCadre` : ce qui se pose dans son cadre, coupé par
 * lui et sous les ornements de devant — ses volets, quand il dort chez lui.
 */
export function Arche({
  forme,
  dessin,
  humeur = 'neutre',
  humeurs = [],
  geste = null,
  jauge = null,
  ornements = [],
  grand = false,
  dansLeCadre = null,
}: {
  forme: FormeDeCompagnon
  dessin: DessinDeCompagnon
  humeur?: Humeur
  humeurs?: readonly HumeurPeinte[]
  geste?: Geste | null
  jauge?: number | null
  ornements?: readonly OrnementMontre[]
  grand?: boolean
  dansLeCadre?: ReactNode
}) {
  const c = CADRAGES[forme.key] ?? ENTIER
  const decor = dessin.disque?.[1]
  const [chargees, setChargees] = useState<ReadonlySet<string>>(() => new Set())
  const montree = humeur !== 'neutre' && dessin.humeurs && chargees.has(dessin.humeurs[humeur][0]) ? humeur : 'neutre'
  const aCharger = humeur !== 'neutre' && !humeurs.includes(humeur) ? [...humeurs, humeur] : humeurs
  const bete: CSSProperties = {
    left: `calc(var(--l) * ${c.gauche})`,
    top: `calc(var(--l) * ${c.haut})`,
    width: `calc(var(--l) * ${c.taille})`,
    height: `calc(var(--l) * ${c.taille})`,
  }
  const corps = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = corps.current
    if (!geste || !el?.animate || sansMouvement()) return
    const a = el.animate(GESTES[geste.sorte].images, GESTES[geste.sorte].options)
    return () => a.cancel()
  }, [geste?.sorte, geste?.n]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <DerriereLaNiche montres={ornements} grand={grand} />
      <span className={'niche-cadre' + (ornements.some(o => o.cle === 'arche') ? ' orne-or' : '')} aria-hidden="true">
        <span className={'niche-decor' + (decor ? '' : ` niche-ciel niche-ciel-${forme.compagnon}`)} style={decor ? { backgroundImage: `url(${decor})` } : undefined} />
        <span ref={corps} className={'niche-bete' + (c.miroir ? ' miroir' : '')} style={bete}>
          <img className={montree === 'neutre' ? 'on' : undefined} src={dessin.perso[0]} alt="" decoding="async" draggable={false} />
          {dessin.humeurs &&
            aCharger.map(h => {
              const src = dessin.humeurs![h][0]
              return (
                <img
                  key={h}
                  className={montree === h ? 'on' : undefined}
                  src={src}
                  alt=""
                  decoding="async"
                  draggable={false}
                  onLoad={() => setChargees(s => (s.has(src) ? s : new Set(s).add(src)))}
                />
              )
            })}
        </span>
        {humeur === 'depite' && <Pluie />}
        <span className="niche-rebord">
          {jauge !== null && (
            <span className="niche-jauge">
              <span style={{ width: `${Math.round(jauge * 100)}%` }} />
            </span>
          )}
        </span>
        {dansLeCadre}
      </span>
      <DevantLaNiche montres={ornements} grand={grand} />
    </>
  )
}

/**
 * La part de son prochain but qu'il a déjà : sa forme suivante, puis, après
 * sa forme ultime, le palier suivant de sa niche — la jauge ne s'arrête plus
 * (le propriétaire, le 19 octobre 2026). Rien quand sa niche a tout.
 */
function partDeLaJauge(justes: number, rang: number, paliers: number): number | null {
  const seuil = prochainSeuil({ rang, paliers })
  return seuil === null ? null : Math.min(1, justes / seuil)
}

/** Des étincelles, de ce que la réponse rapporte jusqu'à sa niche : il mange. */
function Etincelles({ de, vers }: { de: DOMRect; vers: DOMRect }) {
  const traits = useRef<(HTMLSpanElement | null)[]>([])
  // Avant la première image : posées au coin de l'écran, elles y paraîtraient le temps d'une image.
  useLayoutEffect(() => {
    const x0 = de.left + de.width / 2
    const y0 = de.top + de.height / 2
    const x1 = vers.left + vers.width / 2
    const y1 = vers.bottom - 6
    const vols = traits.current.map((s, k) => {
      if (!s?.animate) return null
      const taille = k === 0 ? 18 : 11
      // Une courbe qui monte avant de redescendre sur lui, chacune la sienne.
      const images: Keyframe[] = []
      for (let i = 0; i <= 24; i++) {
        const t = i / 24
        const x = x0 + (x1 - x0) * t - Math.sin(t * Math.PI) * (60 - k * 22)
        const y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * (40 + k * 18)
        images.push({ transform: `translate(${x - taille / 2}px, ${y - taille / 2}px) rotate(${t * 220}deg) scale(${1 - t * 0.35})`, opacity: i === 24 ? 0.3 : 1 })
      }
      // `both` : celles qui partent après la première attendent à son point de départ.
      return s.animate(images, { duration: VOL_MS, delay: k * 120, easing: 'cubic-bezier(0.45, 0.05, 0.4, 1)', fill: 'both' })
    })
    return () => vols.forEach(v => v?.cancel())
  }, [de, vers])
  return (
    <span className="niche-etincelles" aria-hidden="true">
      {[0, 1, 2].map(k => (
        <span key={k} ref={e => void (traits.current[k] = e)} className={'niche-etincelle' + (k ? ' petite' : '')}>
          <Etincelle />
        </span>
      ))}
    </span>
  )
}

/** Dehors, le saut d'une caresse : plus haut que dans la niche, il a la place. */
const SAUT_DEHORS: Keyframe[] = [
  { transform: 'translateY(0) scale(1, 1)' },
  { offset: 0.18, transform: 'translateY(2%) scale(1.05, 0.94)' },
  { offset: 0.45, transform: 'translateY(-14%) scale(0.97, 1.05)' },
  { offset: 0.7, transform: 'translateY(0) scale(1.04, 0.96)' },
  { transform: 'translateY(0) scale(1, 1)' },
]

/**
 * Il sort de sa niche (le principe, § 2 : « Podium, forme atteinte ») : du
 * buste qu'on voyait, il grandit en volant jusqu'en bas de l'écran, près du
 * pouce, entier, triomphant ; on peut le caresser — il sautille, des cœurs
 * montent —, puis il rentre. La scène couvre l'écran sans rien en prendre :
 * seul lui se touche, et rien de lui ne déborde de côté (css.md).
 */
function Dehors({ forme, dessin, depart, onRentre }: { forme: FormeDeCompagnon; dessin: DessinDeCompagnon; depart: DOMRect; onRentre: () => void }) {
  const lui = useRef<HTMLButtonElement>(null)
  const [pose, setPose] = useState(false)
  const [rentre, setRentre] = useState(false)
  const [caresses, setCaresses] = useState(0)
  const rentrerA = useRef(0)
  const poseLe = useRef(0)
  const monte = useRef(true)
  useEffect(() => {
    monte.current = true
    return () => {
      monte.current = false
    }
  }, [])
  const miroir = (CADRAGES[forme.key] ?? ENTIER).miroir
  const [g0, h0, d0, b0] = SILHOUETTES[forme.key] ?? [0, 0, 1, 1]
  // Retourné pour regarder la page, son cadre se retourne avec lui.
  const [gauche, droite] = miroir ? [1 - d0, 1 - g0] : [g0, d0]
  // Sa taille et sa place, une fois pour toute la sortie : ses pattes au bas
  // de l'écran — au-dessus de la barre du menu, ou de celle du chef.
  const [place] = useState(() => {
    const hauteur = Math.min(150, Math.max(110, window.innerHeight * 0.2))
    const cote = hauteur / (b0 - h0)
    const colonne = document.querySelector('.player-shell')?.getBoundingClientRect()
    const centre = colonne && colonne.width > 0 ? colonne.left + colonne.width / 2 : window.innerWidth / 2
    const barre = document.querySelector('.menu-barre, .barre-chef')?.getBoundingClientRect()
    const sol = Math.min(window.innerHeight - 24, barre && barre.height > 0 ? barre.top - 12 : Infinity)
    return { cote, gauche: centre - (cote * (gauche + droite)) / 2, haut: sol - cote * b0 }
  })
  const vol = useRef<Keyframe[]>([])
  // Avant la première image : posé à sa place sans son vol, il y paraîtrait un instant.
  useLayoutEffect(() => {
    const el = lui.current
    if (!el?.animate) return onRentre()
    // De la niche à sa place : au départ, il couvre exactement le buste
    // qu'on y voyait, puis grandit en suivant une courbe.
    const s0 = depart.width / place.cote
    vol.current = Array.from({ length: 29 }, (_, i) => {
      const t = i / 28
      const s = s0 + (1 - s0) * t
      const x = (depart.left - place.gauche) * (1 - t)
      const y = (depart.top - place.haut) * (1 - t) - Math.sin(t * Math.PI) * 70
      return { transform: `translate(${x}px, ${y}px) scale(${s})`, opacity: Math.min(1, 0.4 + t * 4) }
    })
    let vivant = true
    const sortie = el.animate(vol.current, { duration: 620, easing: 'cubic-bezier(0.4, 0.1, 0.3, 1)', fill: 'forwards' })
    void sortie.finished.then(
      () => {
        if (!vivant) return
        poseLe.current = Date.now()
        rentrerA.current = poseLe.current + DEHORS_MS
        setPose(true)
      },
      () => {},
    )
    return () => {
      vivant = false
      sortie.cancel()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Posé : il rentre à son heure, que chaque caresse repousse un peu. Son
  // retour ne dépend que de lui : l'état qui éteint ses rayons ne l'arrête pas.
  useEffect(() => {
    if (!pose) return
    const veiller = setInterval(() => {
      if (Date.now() < rentrerA.current) return
      clearInterval(veiller)
      setRentre(true)
      const retour = lui.current?.animate([...vol.current].reverse(), { duration: 560, easing: 'cubic-bezier(0.6, 0, 0.6, 1)', fill: 'forwards' })
      if (!retour) return onRentre()
      void retour.finished.then(() => monte.current && onRentre(), () => {})
    }, 200)
    return () => clearInterval(veiller)
  }, [pose]) // eslint-disable-line react-hooks/exhaustive-deps
  // Chaque caresse, il sautille — joué sur lui, sans le remonter : son image ne se redécode pas.
  const corps = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (caresses === 0 || !corps.current?.animate) return
    const a = corps.current.animate(SAUT_DEHORS, { duration: 800, easing: 'cubic-bezier(0.3, 0.6, 0.35, 1)' })
    return () => a.cancel()
  }, [caresses])
  const caresser = () => {
    if (!pose || rentre) return
    setCaresses(n => n + 1)
    rentrerA.current = Math.min(poseLe.current + DEHORS_MAX_MS, Math.max(rentrerA.current, Date.now() + RETENU_MS))
  }
  const humeurs = dessin.humeurs!
  const nom = leCompagnon(forme.compagnon)
  return (
    <div className="niche-dehors-scene">
      <button
        ref={lui}
        type="button"
        className={'niche-dehors' + (miroir ? ' miroir' : '') + (pose && !rentre ? ' pose' : '')}
        // Invisible tant que son vol ne le montre pas : c'est lui qui le pose.
        style={{ left: place.gauche, top: place.haut, width: place.cote, height: place.cote, opacity: 0 }}
        aria-label={`${nom?.le === 'la' ? 'La' : 'Le'} caresser`}
        onClick={caresser}
      >
        <span className="niche-dehors-rayons" style={{ left: `${((gauche + droite) / 2) * 100}%`, top: `${((h0 + b0) / 2) * 100}%`, width: `${(b0 - h0) * 170}%` }} />
        <span className="niche-dehors-ombre" style={{ left: `${gauche * 100 + 8}%`, width: `${(droite - gauche) * 100 - 16}%`, top: `${b0 * 100 - 3}%` }} />
        <span ref={corps} className="niche-dehors-corps" style={{ transformOrigin: `${((gauche + droite) / 2) * 100}% ${b0 * 100}%` }}>
          <img src={caresses > 0 ? humeurs.ravi[0] : humeurs.triomphe[0]} alt="" draggable={false} />
        </span>
        {caresses > 0 && (
          <span key={`c${caresses}`} className="niche-dehors-coeurs" style={{ left: `${((gauche + droite) / 2) * 100}%`, top: `${(h0 + 0.12) * 100}%` }} aria-hidden="true">
            {[
              [-70, -60, -16, 22],
              [40, -90, 14, 26],
              [-40, -110, -8, 18],
              [80, -50, 18, 20],
              [-10, -130, 6, 16],
            ].map(([x, y, r, t], k) => (
              <i key={k} style={{ '--x': `${x}px`, '--y': `${y}px`, '--r': `${r}deg`, '--t': `${t}px`, '--d': `${k * 0.12}s` } as CSSProperties}>
                <Coeur />
              </i>
            ))}
          </span>
        )}
      </button>
    </div>
  )
}

/**
 * La niche, au coin de la page, et sa fiche au toucher : la forme qu'il y
 * montre, appelé par son nom. Rien tant que son dessin n'est pas livré.
 */
export function Niche(vue: NicheVue) {
  const { rang, nom } = vue
  const paliers = vue.paliers ?? 0
  const forme = formeDe(vue)
  const dessin = forme && DESSINS[forme.key]
  const [repliee, setRepliee] = useState(false)
  const [fiche, setFiche] = useState(false)
  // « Touche-moi ! » : sa gestion s'ouvre en la touchant, et rien ne le disait (`prendreLAppel`).
  const [appel, setAppel] = useState(false)
  // Ce qu'il vit à la révélation (`client/src/niche.ts`).
  const [humeur, setHumeur] = useState<Humeur>('neutre')
  const [souffle, setSouffle] = useState(false)
  const [geste, setGeste] = useState<Geste | null>(null)
  const [avecHumeurs, setAvecHumeurs] = useState(false)
  const [repas, setRepas] = useState<{ n: number; part: number | null; vue: boolean } | null>(null)
  const [bulle, setBulle] = useState(0)
  const [vol, setVol] = useState<{ n: number; de: DOMRect; vers: DOMRect } | null>(null)
  const [dehors, setDehors] = useState<{ n: number; depart: DOMRect; forme: FormeDeCompagnon; dessin: DessinDeCompagnon } | null>(null)
  const ici = useRef<HTMLButtonElement>(null)
  // Ce que lisent ses moments, qui l'écoutent une fois pour toutes : sa forme
  // d'à présent, et ses bonnes réponses — lues à la première réponse de la
  // page, puis comptées à chaque repas.
  const courant = useRef({ forme, dessin, rang, paliers })
  courant.current = { forme, dessin, rang, paliers }
  const jauge = useRef<{ compagnon: string; justes: number; rang: number; paliers: number } | null>(null)
  const jaugeDemandee = useRef(false)
  const minuteurs = useRef(new Set<ReturnType<typeof setTimeout>>())
  const plusTard = (f: () => void, ms: number) => {
    const t = setTimeout(() => {
      minuteurs.current.delete(t)
      f()
    }, ms)
    minuteurs.current.add(t)
    return t
  }
  // Elle se fait petite dès que la page défile, et revient en haut de page :
  // posée sur la colonne, elle couvrirait le coin de ce qui passe dessous.
  useEffect(() => {
    const suivre = () => setRepliee(window.scrollY > REPLI_PX)
    suivre()
    window.addEventListener('scroll', suivre, { passive: true })
    return () => window.removeEventListener('scroll', suivre)
  }, [])
  // Sur l'accueil, le profil et la boutique, les premières fois : une bulle
  // lui propose de la toucher, le temps que la page se pose — pas sur un
  // compagnon qu'on essaie, qui n'a pas de fiche.
  useEffect(() => {
    if (vue.essai || !prendreLAppel()) return
    const montre = setTimeout(() => setAppel(true), APPEL_APRES_MS)
    const cache = setTimeout(() => setAppel(false), APPEL_APRES_MS + APPEL_MS)
    return () => {
      clearTimeout(montre)
      clearTimeout(cache)
    }
  }, [])
  useEffect(() => {
    let vivant = true
    let souffleMax: ReturnType<typeof setTimeout> | null = null
    const calmer = () => {
      if (souffleMax) clearTimeout(souffleMax)
      souffleMax = null
      setSouffle(false)
    }
    /** Ses bonnes réponses, lues une fois, à la première réponse de la page : sa jauge en part. */
    const lireSaJauge = () => {
      if (jaugeDemandee.current) return
      jaugeDemandee.current = true
      api.joueur.niche().then(
        r => {
          if (vivant && r.niche) jauge.current = { compagnon: r.niche.compagnon, justes: r.niche.justes, rang: r.niche.rang, paliers: r.niche.paliers ?? 0 }
        },
        () => {},
      )
    }
    /** Une bonne réponse : ravi, il sautille ; nourri, « +1 » et sa jauge ; rare, une bulle de cœurs. */
    const servir = (rare: boolean, nourri: boolean) => {
      setHumeur('ravi')
      setGeste(g => ({ sorte: 'saute', n: (g?.n ?? 0) + 1 }))
      if (nourri) {
        const j = jauge.current
        const { forme: f, rang: r, paliers: p } = courant.current
        let part: number | null = null
        if (j && f && j.compagnon === f.compagnon) {
          j.justes++
          part = partDeLaJauge(j.justes, Math.max(j.rang, r), Math.max(j.paliers, p))
        }
        const n = Date.now()
        setRepas({ n, part, vue: part !== null })
        plusTard(() => setRepas(p => (p && p.n === n ? { ...p, vue: false } : p)), REPAS_MS)
        plusTard(() => setRepas(p => (p && p.n === n ? null : p)), REPAS_MS + 600)
      }
      // La bulle attend que « +1 » s'efface : elle se poserait dessus.
      if (rare) {
        const apres = nourri ? 1250 : 200
        plusTard(() => setBulle(b => b + 1), apres)
        plusTard(() => setBulle(0), apres + 2300)
      }
    }
    /** Il sort, après l'expérience — que la soirée montre d'abord (`Celebration`). */
    const sortir = async () => {
      await attendre(AVANT_LA_SORTIE_MS)
      for (let t = 0; t < CELEBRATION_MAX_MS && document.querySelector('.celebration'); t += 250) await attendre(250)
      const { dessin: d } = courant.current
      if (!vivant || !d?.humeurs) return
      if (sansMouvement()) {
        setHumeur('triomphe')
        plusTard(() => setHumeur(h => (h === 'triomphe' ? 'neutre' : h)), TRIOMPHE_SUR_PLACE_MS)
        return
      }
      setAvecHumeurs(true)
      await Promise.all([precharger(d.humeurs.triomphe[0]), precharger(d.humeurs.ravi[0])])
      const bete = ici.current?.querySelector('.niche-bete')?.getBoundingClientRect()
      const { forme: f } = courant.current
      if (!vivant || !bete || bete.width === 0 || !f) return
      calmer()
      setHumeur('neutre')
      // La forme qu'il montre dehors reste celle qui est sortie : une forme atteinte pendant ce temps l'attend au retour.
      setDehors({ n: Date.now(), depart: bete, forme: f, dessin: d })
    }
    const vivre = (m: MomentDeLaNiche) => {
      switch (m.sorte) {
        case 'souffle':
          // Ses humeurs viennent à la première réponse de la page : l'accueil,
          // le profil, la boutique n'en téléchargent rien. Chargées pendant la
          // question, elles sont là au verdict ; une révélation qui les devance
          // garde l'expression neutre jusqu'à leur arrivée.
          setAvecHumeurs(true)
          lireSaJauge()
          setSouffle(true)
          if (souffleMax) clearTimeout(souffleMax)
          souffleMax = setTimeout(calmer, SOUFFLE_MAX_MS)
          return
        case 'calme':
          calmer()
          setHumeur(h => (h === 'triomphe' ? h : 'neutre'))
          setGeste(null)
          return
        case 'ratee':
          calmer()
          setHumeur('depite')
          setGeste(g => ({ sorte: 'abat', n: (g?.n ?? 0) + 1 }))
          return
        case 'juste': {
          calmer()
          const vers = ici.current?.getBoundingClientRect()
          const de = m.depuis?.getBoundingClientRect()
          // Nourri, il mange d'abord : les étincelles volent jusqu'à lui, puis il est ravi.
          if (m.nourri && de && vers && de.width > 0 && vers.width > 0 && !sansMouvement()) {
            setVol({ n: Date.now(), de, vers })
            plusTard(() => setVol(null), VOL_MS + 2 * 120 + 60)
            plusTard(() => servir(m.rare, m.nourri), VOL_MS + 40)
          } else servir(m.rare, m.nourri)
          return
        }
        case 'sortie':
          void sortir()
          return
      }
    }
    const fin = ecouterLaNiche(vivre)
    const lesMinuteurs = minuteurs.current
    return () => {
      vivant = false
      fin()
      if (souffleMax) clearTimeout(souffleMax)
      for (const t of lesMinuteurs) clearTimeout(t)
      lesMinuteurs.clear()
    }
  }, [])
  if (!forme || !dessin) return null
  return (
    <>
      <button
        ref={ici}
        type="button"
        className={
          `niche niche-${forme.compagnon}` +
          // Sa fiche ouverte, elle se déplie et passe au-dessus du voile : la bulle sort d'elle.
          (repliee && !fiche ? ' repliee' : '') +
          (fiche ? ' ouverte' : '') +
          (souffle ? ' retient' : '') +
          (humeur !== 'neutre' ? ` ${humeur}` : '') +
          (repas ? ' nourrie' : '') +
          (repas?.vue ? ' jauge-vue' : '') +
          (dehors ? ' vide' : '') +
          (vue.essai ? ' niche-essai' : '')
        }
        aria-label={vue.essai ? `${forme.nom}, à l’essai dans ta niche` : `${nom ?? forme.nom}, dans ta niche : sa fiche`}
        aria-haspopup={vue.essai ? undefined : 'dialog'}
        onClick={() => {
          setAppel(false)
          // À l'essai, il n'est pas encore à lui : rien à gérer, il sautille.
          if (vue.essai) setGeste(g => ({ sorte: 'saute', n: (g?.n ?? 0) + 1 }))
          else setFiche(true)
        }}
      >
        <Arche
          forme={forme}
          dessin={dessin}
          humeur={humeur}
          humeurs={avecHumeurs ? HUMEURS_DE_LA_REVELATION : []}
          geste={geste}
          jauge={repas ? repas.part : null}
          ornements={ornementsMontres(vue)}
          grand
        />
        {/* Le doigt la traverse : c'est la niche qu'elle montre. */}
        {appel && !repliee && (
          <span className="niche-appel" aria-hidden="true">
            {espacesFines('Touche-moi !')}
          </span>
        )}
        {repas && (
          <span key={repas.n} className="niche-plus" aria-hidden="true">
            +1
          </span>
        )}
        {bulle > 0 && (
          <span key={bulle} className="niche-bulle" aria-hidden="true">
            <Coeur />
            <Coeur />
          </span>
        )}
      </button>
      {vol && <Etincelles key={vol.n} de={vol.de} vers={vol.vers} />}
      {dehors && (
        <Dehors
          key={dehors.n}
          forme={dehors.forme}
          dessin={dehors.dessin}
          depart={dehors.depart}
          onRentre={() => {
            setDehors(null)
            // Rentré, il est encore content un instant.
            setHumeur('ravi')
            plusTard(() => setHumeur(h => (h === 'ravi' ? 'neutre' : h)), 1400)
          }}
        />
      )}
      {fiche && <FicheDeLaNiche niche={vue} onFermer={() => setFiche(false)} />}
    </>
  )
}

/**
 * Ses formes atteintes, en petites niches, dans « Décorer » : celle qu'on
 * touche vit dans sa niche. Seulement ce qu'il a — ce qui vient se voit sur
 * son chemin, comme dans la loge (le choix du 13 octobre 2026) —, et sa
 * métamorphose quand l'Éclat la lui a ouverte : une forme de plus, qui ne
 * prend la niche qu'en la choisissant (le 19 octobre 2026, « je veux que ce
 * soit un choix »). Une seule : rien à choisir, ce qui vient se dit.
 * `neuves`, celles qu'il n'a pas encore vues : leur point rouge, comme dans la
 * loge, pour qu'il les trouve.
 */
export function SesFormes({
  niche,
  busy,
  neuves = [],
  onMontrer,
}: {
  niche: NicheVue
  busy: boolean
  neuves?: readonly string[]
  /** Le rang de la forme touchée — `MONTREE_DE_LA_METAMORPHOSE` pour sa métamorphose. */
  onMontrer: (montree: number) => void
}) {
  const c = leCompagnon(niche.compagnon)
  const montree = formeDe(niche)
  if (!c || !montree) return null
  const formes = [...c.formes.filter(f => f.rang <= niche.rang), ...(c.lumiere && metamorphoseOuverte(niche as CompagnonPossede) ? [c.lumiere] : [])]
  if (formes.length < 2) return <p className="muted small">{espacesFines(`${c.le === 'la' ? 'Elle' : 'Il'} en prendra trois autres en grandissant : chacune pourra vivre ici.`)}</p>
  return (
    <div className="niche-choix-rangee">
      {formes.map(f => {
        const dessin = DESSINS[f.key]
        const ici = f.key === montree.key
        const neuve = neuves.includes(f.key)
        // Neuve, elle le dit après son nom, comme une case de la loge ; montrée, `aria-pressed` le dit seul (`design.test.ts`).
        const nom = neuve ? `${f.nom}, nouveau` : f.nom
        return (
          <button
            key={f.key}
            type="button"
            className={'niche-choix' + (neuve ? ' neuve' : '')}
            aria-pressed={ici}
            aria-label={nom}
            disabled={busy}
            onClick={() => !ici && onMontrer(f.metamorphose ? MONTREE_DE_LA_METAMORPHOSE : f.rang)}
          >
            <span className={`niche-mini niche-${c.key}`}>{dessin && <Arche forme={f} dessin={dessin} />}</span>
            <span className="niche-choix-nom">{sansArticle(f.nom)}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Où il en est, en une ligne : la part de son prochain but — sa forme
 * suivante, puis, après sa forme ultime, le palier suivant de sa niche (le
 * propriétaire, le 19 octobre 2026 : la jauge ne s'arrête plus) — et ce qu'il
 * vise. Sans but, sa niche a tout : son amitié le dit, sans jauge.
 * `paliers` : les siens, du serveur ou de la niche, le plus haut.
 */
export function ouIlEnEst(sien: CompagnonAcquis, paliers: number): { part: number | null; phrase: string } {
  const c = leCompagnon(sien.compagnon)
  const suite = prochaineForme(sien)
  if (c && suite) {
    const seuil = JUSTES_DES_FORMES[suite.forme.rang]
    const vers = `${suite.forme.nom.charAt(0).toLowerCase()}${suite.forme.nom.slice(1)}`
    return { part: Math.min(1, sien.justes / seuil), phrase: `${formatNumber(sien.justes)} sur ${formatNumber(seuil)} bonnes réponses ${avecLui(c)} : ${vers}` }
  }
  const prochain = prochainOrnement({ paliers, justes: sien.justes })
  if (c && prochain) {
    const seuil = prochain.ornement.justes
    return { part: Math.min(1, sien.justes / seuil), phrase: `${formatNumber(sien.justes)} sur ${formatNumber(seuil)} bonnes réponses ${avecLui(c)} : ${prochain.ornement.nom}` }
  }
  return { part: null, phrase: `${titreDeLAmitie(ORNEMENTS.length)} : sa niche a tous ses ornements.` }
}

/**
 * Ses envies du jour, en une ligne, dans sa fiche : ce qui l'attend chez lui.
 * Jamais un reproche — il ne boude jamais (`retours/2026-10-16/compagnon/
 * principe.md`) — : ce qu'il a eu, et son cadeau quand il attend d'être
 * ouvert, le grand tous les sept jours de complicité. `s` : ses soins
 * d'aujourd'hui, rien s'il n'en a jamais eu.
 */
export function sonJour(c: Compagnon, s: SoinsDuCompagnon | undefined): { faites: readonly Envie[]; cadeau: 'petit' | 'grand' | null; phrase: string } {
  const faites = ENVIES.filter(e => s?.envies[e])
  const n = faites.length
  if (n === ENVIES.length && !s?.cadeau) {
    const grand = prochainCadeauGrand(s?.complicite ?? 0)
    return { faites, cadeau: grand ? 'grand' : 'petit', phrase: `${grand ? 'Un grand cadeau' : 'Un cadeau'} t’attend chez ${c.le === 'la' ? 'elle' : 'lui'} !` }
  }
  if (n === ENVIES.length) return { faites, cadeau: null, phrase: 'Trois envies comblées · à demain !' }
  if (n === 0) return { faites, cadeau: null, phrase: 'Ses trois envies du jour t’attendent' }
  return { faites, cadeau: null, phrase: `${n} envie${n > 1 ? 's' : ''} comblée${n > 1 ? 's' : ''} sur ${ENVIES.length}` }
}

/**
 * Sa fiche, ouverte en touchant sa niche, d'où que ce soit : une bulle douce
 * qui sort d'elle, la page sous un voile léger (le 20 octobre 2026, le
 * propriétaire : « un truc plus soft avec les actions pour le caresser et
 * rediriger vers l'onglet compagnon […] uniquement pouvoir interagir avec
 * lui ? Et de savoir où il en est »). Lui en grand, qu'on caresse en le
 * touchant ou par « Le caresser » — ravi, des cœurs, et un tour sur deux
 * s'il en sait (`gesteDeLaCaresse`) ; son nom, sa forme, leur amitié ; où il
 * en est (`ouIlEnEst`, `GET /api/joueur/niche`, lu à l'ouverture : une forme
 * atteinte ailleurs passe aussitôt dans la niche) ; ses envies du jour
 * (`sonJour`, `GET /api/joueur/soins`) ; « Chez lui », sa page, d'or quand
 * son cadeau l'y attend. La feuille « Ma niche » qu'elle ouvrait du 19 au 20
 * octobre 2026 — son nom, ses formes, ses ornements, ses compagnons — faisait
 * un second endroit pour ce que sa page règle déjà : tout cela vit chez lui.
 */
export function FicheDeLaNiche({ niche, onFermer }: { niche: NicheVue; onFermer: () => void }) {
  const boite = useRef<HTMLDivElement>(null)
  useModale(boite, onFermer)
  const titre = useId()
  const [caresses, setCaresses] = useState(0)
  const [geste, setGeste] = useState<Geste | null>(null)
  const [ravi, setRavi] = useState(false)
  const [calme] = useState(sansMouvement)
  // Ses compagnons et où chacun en est, ses soins du jour. `undefined` : en chemin ; `null` : rien à dire (une panne).
  const [siens, setSiens] = useState<CompagnonAcquis[] | null | undefined>(undefined)
  const [soins, setSoins] = useState<SoinsDuProfil | null | undefined>(undefined)
  useEffect(() => {
    // Trouvée : « Touche-moi ! » ne se propose plus.
    nicheTouchee()
    let vivant = true
    api.joueur.niche().then(
      r => {
        if (!vivant) return
        // Un serveur d'avant ne dit que celui de la niche.
        setSiens(r.compagnons ?? (r.niche ? [r.niche] : []))
        // Une forme atteinte depuis que la page a lu le profil, un réglage
        // fait sur un autre appareil : la niche les prend tout de suite.
        if (r.niche) porterNiche({ niche: r.niche.compagnon, compagnons: [r.niche] })
      },
      () => vivant && setSiens(null),
    )
    api.joueur.soins().then(
      s => vivant && setSoins(s),
      () => vivant && setSoins(null),
    )
    return () => {
      vivant = false
    }
    // Une lecture par ouverture : la forme qu'elle fait prendre ne la relance pas.
  }, [])
  // Caressé, il en est ravi un instant.
  useEffect(() => {
    if (caresses === 0) return
    setRavi(true)
    const t = setTimeout(() => setRavi(false), 1600)
    return () => clearTimeout(t)
  }, [caresses])
  const c = leCompagnon(niche.compagnon)
  const forme = formeDe(niche)
  const dessin = forme && DESSINS[forme.key]
  if (!c || !forme || !dessin) return null
  const sien = siens?.find(a => a.compagnon === niche.compagnon)
  const ou = sien ? ouIlEnEst(sien, Math.max(sien.paliers ?? 0, niche.paliers ?? 0)) : null
  const jour = soins ? sonJour(c, soins.compagnons.find(s => s.compagnon === niche.compagnon)) : null
  const complicite = soins?.compagnons.find(s => s.compagnon === niche.compagnon)?.complicite ?? 0
  const amitie = titreDeLAmitie(niche.paliers)
  const caresser = () => {
    const n = caresses + 1
    setCaresses(n)
    setGeste(calme ? null : { sorte: gesteDeLaCaresse(complicite, n), n })
    // Caressé ici, il est réveillé : chez lui, il ne dort plus volets fermés l'instant d'après.
    if (soins) retenirLeReveil(soins.jour, niche.compagnon)
  }
  return (
    <div className="niche-fiche-voile" onClick={onFermer}>
      <div ref={boite} className="niche-fiche" role="dialog" aria-modal="true" aria-labelledby={titre} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <button type="button" className="niche-fiche-fermer" aria-label="Fermer" onClick={onFermer}>
          <Icon name="x" />
        </button>
        {/* Le toucher le caresse, comme chez lui ; à l'oreille et au clavier, « Le caresser » le fait. */}
        <span className={`niche-grande niche-${forme.compagnon}` + (ravi ? ' ravi' : '')} aria-hidden="true" onClick={caresser}>
          <Arche forme={forme} dessin={dessin} humeur={ravi ? 'ravi' : 'neutre'} humeurs={['ravi']} geste={geste} ornements={ornementsMontres(niche)} grand />
          {caresses > 0 && !calme && (
            <span key={`envol-${caresses}`} className="compagnon-envols niche-envols">
              {ENVOLS.map((e, i) => (
                <i key={i}>{e}</i>
              ))}
            </span>
          )}
        </span>
        <b id={titre} className="niche-fiche-nom">
          {niche.nom ?? forme.nom}
        </b>
        <span className="niche-fiche-forme">{`${niche.nom ? `${forme.nom} · ` : ''}${nomDeLaForme(forme)} · ${NOM_RARETE[forme.rarete].toLowerCase()}`}</span>
        {/* Le titre de leur amitié, au palier de sa niche : « Amis pour la vie ». */}
        {amitie && <span className="niche-fiche-amitie">{amitie}</span>}
        {/* Leur place gardée pendant la lecture : la bulle ne saute pas quand elles arrivent. */}
        <div className="niche-fiche-jauge" aria-live="polite">
          {siens === undefined ? (
            <span className="niche-fiche-petit">…</span>
          ) : ou ? (
            <>
              {ou.part !== null && (
                <span className="niche-fiche-barre" aria-hidden="true">
                  <span style={{ width: `${Math.round(ou.part * 100)}%` }} />
                </span>
              )}
              <span className="niche-fiche-petit">{espacesFines(ou.phrase)}</span>
            </>
          ) : null}
        </div>
        <p className="niche-fiche-jour">
          {soins === undefined ? (
            <span className="niche-fiche-petit">…</span>
          ) : jour ? (
            <>
              <span className="niche-fiche-envies" aria-hidden="true">
                {jour.cadeau ? (
                  <i className="cadeau">
                    <PetitPaquet />
                  </i>
                ) : (
                  ENVIES.map(e => (
                    <i key={e} className={jour.faites.includes(e) ? 'faite' : undefined}>
                      <IconeDeLEnvie envie={e} />
                    </i>
                  ))
                )}
              </span>
              <span className={jour.cadeau ? 'niche-fiche-cadeau' : 'niche-fiche-petit'}>{espacesFines(jour.phrase)}</span>
            </>
          ) : null}
        </p>
        <div className="niche-fiche-gestes">
          <button type="button" className="chez-pastille" onClick={caresser}>
            <Icon name="heart" />
            {`${c.le === 'la' ? 'La' : 'Le'} caresser`}
          </button>
          <a className={'chez-pastille' + (jour?.cadeau ? ' or' : '')} href="/profil#compagnon" onClick={onFermer}>
            <Icon name="home" />
            {c.le === 'la' ? 'Chez elle' : 'Chez lui'}
          </a>
        </div>
      </div>
    </div>
  )
}

/**
 * Sa niche, sur la durée (le choix du 19 octobre 2026, `shared/ornements.ts`) :
 * avant sa forme ultime, ce qui l'attend ; après, chaque ornement gagné et ses
 * trois choix — peint, dessiné, caché —, chacun son aperçu, l'ornement seul
 * sur une petite niche vide : on voit ce qu'on choisit avant de le toucher.
 * Un nom fixe par choix ; celui qui se montre, `aria-pressed` le dit
 * (`design.test.ts`). Puis ceux qui viennent, et à combien.
 */
export function SaNicheSEmbellit({
  niche,
  c,
  busy,
  onOrner,
}: {
  niche: NicheVue
  c: Compagnon
  busy: boolean
  onOrner: (cle: CleDOrnement, style: StyleDOrnement) => void
}) {
  const paliers = niche.rang === 3 ? (niche.paliers ?? 0) : 0
  const gagnes = ORNEMENTS.filter(o => o.palier <= paliers)
  const aVenir = ORNEMENTS.filter(o => o.palier > paliers)
  // Sa fiche peut s'ouvrir sur l'écran « Mon compagnon », qui montre la même gestion : des noms de groupe à elle.
  const id = useId()
  return (
    <section className="niche-fiche-section" aria-labelledby="niche-ornements">
      <h3 id="niche-ornements" className="label">
        Sa niche s’embellit
      </h3>
      {niche.rang < 3 ? (
        <p className="muted small">
          {espacesFines(
            `Après sa forme ultime, sa niche s’embellit : ${ORNEMENTS[0].nom} à ${formatNumber(ORNEMENTS[0].justes)} bonnes réponses ${avecLui(c)}, puis trois autres ornements, jusqu’à ${formatNumber(ORNEMENTS[ORNEMENTS.length - 1].justes)}.`,
          )}
        </p>
      ) : (
        <>
          {gagnes.length > 0 && (
            <div className="niche-ornes">
              {gagnes.map(o => {
                const style = styleDeLOrnement(niche.ornements, o.key)
                return (
                  <div key={o.key} className="niche-orne" role="group" aria-labelledby={`${id}-${o.key}`}>
                    <span className="niche-orne-texte" id={`${id}-${o.key}`}>
                      <b>{o.titre}</b>
                      <span className="muted small">{`${o.nom.charAt(0).toUpperCase()}${o.nom.slice(1)}`}</span>
                    </span>
                    <div className="niche-orne-styles">
                      {STYLES_D_ORNEMENT.map(s => (
                        <button key={s} type="button" className="niche-orne-style" aria-pressed={s === style} disabled={busy} onClick={() => s !== style && onOrner(o.key, s)}>
                          <ApercuDOrnement cle={o.key} style={s} />
                          <span className="niche-orne-style-nom">{NOM_DU_STYLE[s]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {gagnes.length > 0 && <p className="muted small niche-choix-aide">Pour chacun : peint, dessiné, ou caché.</p>}
          {aVenir.length > 0 && (
            <ul className="niche-ornes-a-venir">
              {aVenir.map(o => (
                <li key={o.key}>
                  <span className="niche-orne-a-venir-titre">{`${o.titre} · à ${formatNumber(o.justes)}`}</span>
                  <span className="muted small">{` — ${o.nom}`}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

/**
 * Ce que dit le bouton « Mon compagnon » du profil : son nom et la forme
 * qu'il montre, et la jauge de son prochain but — sa forme suivante, puis le
 * palier suivant de sa niche (`prochainSeuil`). `justes` : ses bonnes
 * réponses données avec lui, que la page tient de sa boutique ; sans elles,
 * la jauge garde sa place.
 */
export function ceQueDitSonBouton(niche: NicheVue, justes: number | undefined): { detail: string; jauge: number; compte?: string } {
  const forme = formeDe(niche)
  const detail = forme ? (niche.nom ? `${niche.nom}, ${forme.nom.charAt(0).toLowerCase()}${forme.nom.slice(1)}` : forme.nom) : (niche.nom ?? '')
  if (justes === undefined) return { detail, jauge: 0 }
  const seuil = prochainSeuil(niche)
  if (seuil === null) return { detail, jauge: 1, compte: titreDeLAmitie(ORNEMENTS.length) }
  return { detail, jauge: Math.min(1, justes / seuil), compte: `${formatNumber(justes)} sur ${formatNumber(seuil)}` }
}

/**
 * Sa niche en petit, sans un geste — la carte d'un joueur, le bouton « Mon
 * compagnon » du profil : la forme qu'elle montre et ses ornements. `taille` :
 * sa largeur, en pixels ; `grand` : les grands fichiers de ses ornements, là
 * où on la regarde de près — le compagnon en grand, sur la carte.
 */
export function NicheEnMiniature({ niche, taille, grand = false }: { niche: NicheVue; taille: number; grand?: boolean }) {
  const forme = formeDe(niche)
  const dessin = forme && DESSINS[forme.key]
  if (!forme || !dessin) return null
  return (
    <span className={`niche-mini niche-${forme.compagnon}`} style={{ '--l': `${taille}px` } as CSSProperties}>
      <Arche forme={forme} dessin={dessin} ornements={ornementsMontres(niche)} grand={grand} />
    </span>
  )
}
