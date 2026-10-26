// L'album des trophées, dans « Ma collection » (la maquette 1, choisie par le
// propriétaire le 13 octobre 2026) : tout ce qui se gagne par ce qu'on a
// fait, une page par mode de jeu — soirée, quiz du jour, campagne, duels,
// sentiers, et ce que tous nourrissent.
//
// Dix lignes le rangeaient selon la logique du code : « Hauts faits », « Hauts
// faits du jour », « Paliers des soirées », « Paliers du jour », « Paliers de
// toujours »… Pour trouver un trophée, il fallait savoir s'il se regagnait,
// s'il était « de carrière » ou du palmarès — et les duels, les sentiers, les
// maîtres n'y étaient pas. Le retour qu'a reçu le propriétaire : « c'est très
// confus, les trophées que les gens gagnent ». Une page par mode, parce qu'un
// trophée appartient à un mode — un avatar, lui, se gagne de plusieurs
// façons, d'où les pages par rareté de son album (`shared/album.ts`) ; la
// rareté d'un trophée se lit à la couleur de sa case.
//
// Dans une page, des sections : les pistes — ce qui se cumule, ses trois
// métaux et ce que chaque étape ouvre (`shared/pistes.ts`) —, les exploits,
// les coups du sort, le palmarès, le calendrier, les ligues, les maîtres, les
// écussons. Une dérivation pure de ce que la page du profil reçoit déjà :
// « Ma collection » compte ses trophées par elle (`compteDeLaCollection`), une
// seule règle pour la ligne et pour le total.

import {
  HAUTS_FAITS_DE_CAMPAGNE,
  HAUTS_FAITS_DE_CARRIERE,
  HAUTS_FAITS_DE_SOIREE,
  HAUTS_FAITS_DES_SENTIERS,
  HAUTS_FAITS_DU_JOUR,
  XP_PALIER,
  clePalier,
  hautFait,
  hautFaitDeSoiree,
  origineDe,
  type HautFaitDeCarriere,
  type HautFaitDeSoiree,
  type HautFaitVu,
} from './hautsfaits'
import { ABSORBES, ceQuOuvreLeTrophee, etapesDeLaPiste, rareteMesuree, type Recompense } from './pistes'
import type { Rarete } from './badges'
import { PAGES } from './calendrier'
import { BRANCHES, type CleDeBranche } from './branches'
import { PALIER_DU_MAITRE, titreDeMaitre } from './sentiers'
import { CRANS_D_UNE_BORDURE, LIGUES, NOM_DE_LA_BORDURE, type CleDeLigue } from './duels'
import { SEUILS_ECUSSON, prochainSeuil } from './ecussons'
import { titreDuChampion } from './jour'
import { formatNumber } from './typographie'
import type { PublicProfileDetail } from './profil'

import { PAGES_DES_TROPHEES, type PageDesTrophees } from './pagesDesTrophees'

// Les pages elles-mêmes vivent à part, sans catalogue : la fin d'une partie
// lit la page d'un trophée sans télécharger l'album.
export { NOM_DE_LA_PAGE, PAGES_DES_TROPHEES, pageDesTropheesNommee, pageDuTrophee, type PageDesTrophees } from './pagesDesTrophees'

/** Où se gagne ce qu'elle range, en tête de la page : « Au quiz du jour · 15 sur 36 ». */
export const OU_DE_LA_PAGE: Readonly<Record<PageDesTrophees, string>> = {
  soiree: 'En soirée',
  jour: 'Au quiz du jour',
  campagne: 'En campagne',
  duels: 'Aux duels',
  sentiers: 'Sur les sentiers',
  partout: 'Partout',
}

/** Ce que range chaque page, sous son titre. */
export const CE_QUE_RANGE_LA_PAGE: Readonly<Record<PageDesTrophees, string>> = {
  soiree: 'Ce qu’on réussit — ou rate avec panache — en soirée, et le palmarès de sa fin.',
  jour: 'Dix questions chaque jour, les mêmes pour tous.',
  campagne: 'La série à trois vies, et le défi de la semaine.',
  duels: 'Ta cote, tes ligues et leurs bordures, duel après duel.',
  sentiers: 'Ce que tu valides en épreuve, et le maître de chaque sentier du savoir. Leurs portraits sont dans l’album des avatars.',
  partout: 'Ce que tous les modes nourrissent : tes écussons, ton niveau, tes Éclats.',
}

export type SorteDeCase = 'piste' | 'exploit' | 'coup' | 'prix' | 'ecusson' | 'page' | 'ligue' | 'bordure' | 'maitre'

/** Une étape d'une piste, telle que sa fiche la montre : atteinte ou non, et la prochaine. */
export interface EtapeVue {
  seuil: number
  metal?: 1 | 2 | 3
  recompenses: readonly Recompense[]
  atteinte: boolean
  prochaine: boolean
}

/** Une case de l'album : un trophée, ce qu'il en a, et ce qu'il ouvre. */
export interface CaseDeTrophee {
  /** `hf:assidu`, `hf:phenix`, `prix:eclair`, `ecusson:Histoire`, `heures:08`, `ligue:or`, `bordure:or`, `maitre:foret`. */
  cle: string
  sorte: SorteDeCase
  /** Vide quand la page le dessine elle-même : un écusson, une ligue, un maître. */
  emoji: string
  titre: string
  /** Ce qu'il faut — la règle d'un exploit —, ou ce que compte une piste. */
  regle: string
  aLui: boolean
  /** La rareté mesurée de ce qu'il en a — d'une piste, son plus haut métal, sinon le bronze —, null sans mesure. */
  rarete: Rarete | null
  /** Une piste, un écusson : ses métaux atteints, de 0 à 3. */
  metaux?: number
  /** Ce qui se compte, sous la case : « 7 victoires », « ×3 », « 5/13 ». */
  compte?: string
  /** Un exploit, un coup du sort, un prix : combien de fois. */
  fois?: number
  /** Où il en est, et le prochain seuil — null au sommet. */
  valeur?: number
  prochain?: number | null
  /** Une piste : ses étapes, ce que chacune ouvre. */
  etapes?: EtapeVue[]
  /** Un exploit : ce qu'il ouvre à tant de fois. Une ligue : sa bordure. */
  ouvre?: { fois: number; recompense: Recompense; tenue: boolean }[]
  /** L'expérience : par métal pour une piste, à chaque fois pour un exploit. */
  xp?: number
  /** Ce qu'une piste compte aussi, qui se regagne : Le Laurier, à chaque victoire au quiz du jour. */
  absorbe?: { cle: string; titre: string; emoji: string; xp: number; fois: number }
  categorie?: string
  ligue?: CleDeLigue
  branche?: CleDeBranche
  mois?: string
  doree?: boolean
}

export type CleDeSection = 'pistes' | 'exploits' | 'coups' | 'palmares' | 'calendrier' | 'ligues' | 'bordures' | 'maitres' | 'ecussons' | 'niveau'

export interface SectionDeLAlbum {
  cle: CleDeSection
  titre: string
  aide: string
  cases: CaseDeTrophee[]
  acquis: number
  total: number
  /** Les maîtres : ce que leur nombre ouvre (le Cabinet à trois, Babel à douze). */
  etapes?: EtapeVue[]
  /** Le calendrier : ses titres de champion du mois, du plus récent au plus ancien. */
  titres?: string[]
}

export interface PageDeTrophees {
  page: PageDesTrophees
  acquis: number
  total: number
  sections: SectionDeLAlbum[]
}

/** Ce que l'album lit d'un profil : sa page au complet, ou ce qu'il en faut. */
export type ProfilDeLAlbumDesTrophees = Pick<PublicProfileDetail, 'hautsFaits' | 'prix' | 'ecussons' | 'calendrier' | 'titresDates' | 'sentiers' | 'bordures'>

/**
 * Le mot court de chaque piste, sous sa case : « 7 victoires », « 34 jours »
 * — sa mesure entière (« victoires au quiz du jour ») débordait d'une case de
 * téléphone ; sa fiche la dit.
 */
const COURT: Readonly<Record<string, readonly [string, string]>> = {
  'hf:habitue': ['soirée', 'soirées'],
  'hf:bavard': ['réponse', 'réponses'],
  'hf:encyclopedie': ['juste', 'justes'],
  'hf:reflexe': ['rapide', 'rapides'],
  'hf:devin': ['pile-poil', 'pile-poil'],
  'hf:globe-trotteur': ['hôte', 'hôtes'],
  'hf:podium': ['podium', 'podiums'],
  'hf:collection': ['avatar', 'avatars'],
  'hf:eclats': ['Éclat', 'Éclats'],
  'hf:assidu': ['jour', 'jours'],
  'hf:champion-du-jour': ['victoire', 'victoires'],
  'hf:sans-faute': ['sans-faute', 'sans-faute'],
  'hf:elite': ['jour', 'jours'],
  'hf:infatigable': ['d’affilée', 'd’affilée'],
  'hf:erudit': ['experte', 'expertes'],
  'hf:marathonien': ['juste', 'justes'],
  'hf:explorateur': ['salle', 'salles'],
  'hf:randonneur': ['palier', 'paliers'],
  'hf:constellation': ['étoile', 'étoiles'],
  'hf:cartographe': ['sentier', 'sentiers'],
}

/** Ce qu'une piste compte, en court : « 7 victoires », « niveau 14 », « record 18 ». */
function compteDeLaPiste(h: HautFaitDeCarriere, valeur: number): string {
  if (h.key === 'hf:legende') return `niveau ${valeur}`
  if (h.key === 'hf:alpiniste') return `record ${valeur}`
  const mots = COURT[h.key]
  return mots ? `${formatNumber(valeur)} ${valeur < 2 ? mots[0] : mots[1]}` : formatNumber(valeur)
}

const pluriel = (n: number, un: string, des: string) => `${formatNumber(n)} ${n < 2 ? un : des}`

/**
 * Le seuil d'une étape, tel que la piste l'écrit dans sa fiche : « 5
 * victoires », « Niveau 20 », « 3 maîtres », « 75 bonnes réponses » — le mot
 * court d'une case quand il en a un, sa mesure entière sinon.
 */
export function seuilDeLEtape(piste: string, seuil: number): string {
  if (piste === 'maitres') return pluriel(seuil, 'maître', 'maîtres')
  if (piste === 'pages') return pluriel(seuil, 'page', 'pages')
  if (piste.startsWith('ecusson:')) return pluriel(seuil, 'bonne réponse', 'bonnes réponses')
  const h = hautFait(piste)
  if (h?.famille !== 'carriere') return formatNumber(seuil)
  if (h.key === 'hf:legende') return `Niveau ${seuil}`
  const mots = COURT[h.key]
  return mots ? pluriel(seuil, mots[0], mots[1]) : pluriel(seuil, h.mesureUne, h.mesure)
}

/**
 * Où il en est sur une piste, dans sa fiche : « Tu en es à 7 victoires au quiz
 * du jour. » Le niveau et les records se disent autrement : ils ne
 * s'additionnent pas.
 */
export function ouIlEnEst(piste: string, valeur: number): string {
  const h = hautFait(piste)
  if (h?.famille !== 'carriere') return ''
  if (h.key === 'hf:legende') return `Tu es au niveau ${valeur}.`
  if (h.key === 'hf:alpiniste') return `Ta meilleure série de campagne : ${pluriel(valeur, 'bonne réponse', 'bonnes réponses')}.`
  if (h.key === 'hf:infatigable') return `Ta plus longue série : ${pluriel(valeur, 'jour d’affilée', 'jours d’affilée')}.`
  return `Tu en es à ${pluriel(valeur, h.mesureUne, h.mesure)}.`
}

/**
 * Où aller gagner ce que range une page : l'écran qui le donne. Une soirée
 * n'en a pas — on la rejoint par son code —, ni ce que tous les modes
 * nourrissent.
 */
export const OU_JOUER: Readonly<Partial<Record<PageDesTrophees, { nom: string; href: string }>>> = {
  jour: { nom: 'Jouer le quiz du jour', href: '/jour' },
  campagne: { nom: 'Jouer une série', href: '/campagne' },
  duels: { nom: 'Aller aux duels', href: '/duels' },
  sentiers: { nom: 'Aller aux sentiers', href: '/campagne#sentiers' },
}

/**
 * Les pistes qui se gagnent ailleurs que sur l'écran de leur page :
 * L'Explorateur se range en campagne — ses paliers tombent à la fin d'une
 * partie de la campagne —, mais ses salles se complètent au Cabinet, et
 * « Jouer une série » n'en complétait aucune. Il ne se montre que là où le
 * Cabinet s'ouvre (`montreParLeServeur`) : ce chemin ne mène jamais à une page
 * fermée.
 */
const OU_JOUER_LA_PISTE: ReadonlyMap<string, { nom: string; href: string }> = new Map([['hf:explorateur', { nom: 'Aller au Cabinet', href: '/cabinet' }]])

/** L'écran où aller gagner un trophée de cette page : le sien s'il en a un à part, sinon celui de la page. */
export const ouJouer = (cle: string, page: PageDesTrophees): { nom: string; href: string } | undefined => OU_JOUER_LA_PISTE.get(cle) ?? OU_JOUER[page]

/** Ce qu'on a d'abord, dans l'ordre du catalogue ; le reste ensuite — l'album des avatars range de même. */
const aLuiDAbord = (cases: CaseDeTrophee[]) => [...cases.filter(c => c.aLui), ...cases.filter(c => !c.aLui)]

/**
 * Les étapes d'une piste à une valeur : atteintes, et la prochaine. Un métal
 * rangé reste atteint quand ce qu'il compte a redescendu ou changé de mesure
 * — L'Explorateur gagné au niveau d'explorateur, qui compte depuis des salles
 * du Cabinet : la jauge ne fait pas descendre ce qui est rangé, et sa prochaine
 * étape est celle qui lui reste à prendre.
 */
function etapesVues(cle: string, valeur: number, metaux = 0): EtapeVue[] {
  const etapes = etapesDeLaPiste(cle)
  const atteinte = (e: (typeof etapes)[number]) => valeur >= e.seuil || (e.metal !== undefined && e.metal <= metaux)
  const prochaine = etapes.findIndex(e => !atteinte(e))
  return etapes.map((e, i) => ({ seuil: e.seuil, ...(e.metal && { metal: e.metal }), recompenses: e.recompenses, atteinte: atteinte(e), prochaine: i === prochaine }))
}

/** La case d'une piste : un haut fait de carrière, ses métaux, ses étapes. */
function caseDePiste(h: HautFaitDeCarriere, vus: ReadonlyMap<string, HautFaitVu>): CaseDeTrophee {
  const vu = vus.get(h.key)
  const metaux = Math.max(0, Math.min(3, vu?.fois ?? 0))
  const valeur = vu?.valeur ?? 0
  // Ce que la piste compte aussi, qui se regagne : Le Laurier, une ligne de moins.
  const absorbe = Object.entries(ABSORBES).find(([, piste]) => piste === h.key)?.[0]
  const sonVu = absorbe ? vus.get(absorbe) : undefined
  const sonFait = absorbe ? hautFaitDeSoiree(absorbe) : undefined
  return {
    cle: h.key,
    sorte: 'piste',
    emoji: h.emoji,
    titre: h.title,
    regle: h.mesure,
    aLui: metaux > 0,
    rarete: rareteMesuree(clePalier(h.key, Math.max(1, metaux))),
    metaux,
    compte: compteDeLaPiste(h, valeur),
    valeur,
    prochain: vu?.prochain ?? h.paliers.find(s => valeur < s) ?? null,
    etapes: etapesVues(h.key, valeur, metaux),
    xp: XP_PALIER[0],
    ...(sonFait && { absorbe: { cle: sonFait.key, titre: sonFait.title, emoji: sonFait.emoji, xp: sonFait.xp, fois: sonVu?.fois ?? 0 } }),
  }
}

/** La case d'un trophée qui se regagne : un exploit ou un coup du sort, ses fois, ce qu'il ouvre. */
function caseDExploit(h: HautFaitDeSoiree, vus: ReadonlyMap<string, HautFaitVu>): CaseDeTrophee {
  const fois = vus.get(h.key)?.fois ?? 0
  return {
    cle: h.key,
    sorte: h.ton === 'ombre' ? 'coup' : 'exploit',
    emoji: h.emoji,
    titre: h.title,
    regle: h.rule,
    aLui: fois > 0,
    rarete: rareteMesuree(h.key),
    fois,
    ...(fois > 0 && { compte: `×${fois}` }),
    xp: h.xp,
    ouvre: ceQuOuvreLeTrophee(h.key).map(x => ({ ...x, tenue: fois >= x.fois })),
  }
}

/** Une section : ses cases — ce qu'on a d'abord —, et son compte, une case par métal pour ce qui en a. */
function section(cle: CleDeSection, titre: string, aide: string, cases: CaseDeTrophee[], plus: Partial<SectionDeLAlbum> = {}): SectionDeLAlbum {
  const parMetal = cases.some(c => c.metaux !== undefined)
  return {
    cle,
    titre,
    aide,
    cases: cle === 'ligues' || cle === 'bordures' ? cases : aLuiDAbord(cases),
    acquis: parMetal ? cases.reduce((s, c) => s + (c.metaux ?? 0), 0) : cases.filter(c => c.aLui).length,
    total: parMetal ? cases.length * 3 : cases.length,
    ...plus,
  }
}

const exploits = (liste: readonly HautFaitDeSoiree[]) => liste.filter(h => h.ton === 'eclat' && !ABSORBES[h.key])
const coups = (liste: readonly HautFaitDeSoiree[]) => liste.filter(h => h.ton === 'ombre')

const PISTES_DE: Readonly<Record<'soiree' | 'jour' | 'campagne' | 'sentiers' | 'partout', readonly HautFaitDeCarriere[]>> = {
  soiree: HAUTS_FAITS_DE_CARRIERE.filter(h => !origineDe(h) && h.key !== 'hf:legende' && h.key !== 'hf:eclats'),
  jour: HAUTS_FAITS_DE_CARRIERE.filter(h => origineDe(h) === 'jour'),
  campagne: HAUTS_FAITS_DE_CARRIERE.filter(h => origineDe(h) === 'campagne'),
  sentiers: HAUTS_FAITS_DE_CARRIERE.filter(h => origineDe(h) === 'sentiers'),
  partout: HAUTS_FAITS_DE_CARRIERE.filter(h => h.key === 'hf:legende' || h.key === 'hf:eclats'),
}

const AIDE_DES_PISTES = 'Elles montent : bronze, argent, or. Touche-les : chaque étape dit ce qu’elle ouvre.'
const AIDE_DES_EXPLOITS = 'Ils se regagnent : le nombre dit combien de fois.'
const AIDE_DES_COUPS = 'Pour en rire : ta carte ne les montre que si tu les choisis.'

/**
 * Tout l'album : six pages, leurs sections et leurs comptes. Ce qu'un serveur
 * d'avant ne dit pas (les prix, les écussons, le calendrier, les sentiers)
 * ne s'y montre pas et ne s'y compte pas : le total n'annonce jamais ce que
 * la page ne saurait montrer. Les bordures, si : le serveur les tait jusqu'au
 * premier duel classé — la page des duels d'un débutant restait vide, quand
 * ses six ligues l'attendent.
 */
export function albumDesTrophees(p: ProfilDeLAlbumDesTrophees): PageDeTrophees[] {
  const vus = new Map(p.hautsFaits.map(h => [h.key, h]))
  const bordures = p.bordures ?? []
  // Un trophée réservé (`montreParLeServeur`) n'a de case que si le serveur le cite : en production, L'Explorateur se
  // serait compté « 0 sur 3 » dans la collection de chacun, pour des salles du Cabinet qui ne s'y voient nulle part.
  const pistes = (page: keyof typeof PISTES_DE) => PISTES_DE[page].filter(h => !h.montreParLeServeur || vus.has(h.key)).map(h => caseDePiste(h, vus))
  const sections: Record<PageDesTrophees, SectionDeLAlbum[]> = {
    soiree: [
      section('pistes', 'Les pistes', AIDE_DES_PISTES, pistes('soiree')),
      section('exploits', 'Les exploits', AIDE_DES_EXPLOITS, exploits(HAUTS_FAITS_DE_SOIREE).map(h => caseDExploit(h, vus))),
      section('coups', 'Les coups du sort', AIDE_DES_COUPS, coups(HAUTS_FAITS_DE_SOIREE).map(h => caseDExploit(h, vus))),
      ...(p.prix
        ? [
            section(
              'palmares',
              'Le palmarès',
              'Les prix de la fin de soirée : chacun va au plus quelque chose de la salle, ce soir-là. Un prix ne rapporte pas d’XP.',
              p.prix.map(x => ({ cle: x.key, sorte: 'prix' as const, emoji: x.emoji, titre: x.title, regle: x.rule, aLui: x.fois > 0, rarete: null, fois: x.fois, ...(x.fois > 0 && { compte: `×${x.fois}` }) })),
            ),
          ]
        : []),
    ],
    jour: [
      section('pistes', 'Les pistes', AIDE_DES_PISTES, pistes('jour')),
      section('exploits', 'Les exploits', AIDE_DES_EXPLOITS, exploits(HAUTS_FAITS_DU_JOUR).map(h => caseDExploit(h, vus))),
      section('coups', 'Les coups du sort', AIDE_DES_COUPS, coups(HAUTS_FAITS_DU_JOUR).map(h => caseDExploit(h, vus))),
      ...(p.calendrier
        ? [
            section(
              'calendrier',
              'Le calendrier des Heures',
              'Vingt jours joués dans un mois ouvrent sa page ; le champion du mois la reçoit dorée. Les douze ouvrent un thème.',
              PAGES.map(pg => ({
                cle: `heures:${pg.mois}`,
                sorte: 'page' as const,
                emoji: '',
                titre: pg.nom,
                regle: pg.scene,
                aLui: p.calendrier!.pages.includes(pg.mois),
                rarete: null,
                mois: pg.mois,
                doree: p.calendrier!.dorees.includes(pg.mois),
              })),
              { etapes: etapesVues('pages', p.calendrier.pages.length), titres: (p.titresDates ?? []).map(t => titreDuChampion(t) ?? t) },
            ),
          ]
        : []),
    ],
    campagne: [
      section('pistes', 'Les pistes', AIDE_DES_PISTES, pistes('campagne')),
      section('exploits', 'Les exploits', 'Une série, un défi : ils se regagnent, le nombre dit combien de fois.', HAUTS_FAITS_DE_CAMPAGNE.map(h => caseDExploit(h, vus))),
    ],
    duels: [
      section(
        'ligues',
        'Les ligues',
        'Ta plus haute cote les ouvre, une tous les cent points : chacune a sa bordure, que tu portes autour de ton avatar.',
        LIGUES.map(l => ({
          cle: `ligue:${l.cle}`,
          sorte: 'ligue' as const,
          emoji: '',
          titre: l.nom,
          regle: Number.isFinite(l.depuis) ? `Une cote de ${formatNumber(l.depuis)}, une fois au moins` : 'Ton premier duel classé',
          aLui: bordures.some(b => b.ligue === l.cle),
          rarete: null,
          ligue: l.cle,
          ouvre: [{ fois: 1, recompense: { sorte: 'bordure' as const, cle: l.cle, nom: NOM_DE_LA_BORDURE[l.cle] }, tenue: bordures.some(b => b.ligue === l.cle) }],
        })),
      ),
      section(
        'bordures',
        'Les bordures serties',
        `Chaque duel gagné dans une ligue sertit un cran de sa bordure : ${CRANS_D_UNE_BORDURE} crans, et elle est sertie.`,
        LIGUES.map(l => {
          const crans = Math.min(CRANS_D_UNE_BORDURE, bordures.find(b => b.ligue === l.cle)?.crans ?? 0)
          const atteinte = bordures.some(b => b.ligue === l.cle)
          return {
            cle: `bordure:${l.cle}`,
            sorte: 'bordure' as const,
            emoji: '',
            titre: NOM_DE_LA_BORDURE[l.cle],
            regle: `${CRANS_D_UNE_BORDURE} duels gagnés en ${l.nom.toLowerCase()}`,
            aLui: crans >= CRANS_D_UNE_BORDURE,
            rarete: null,
            ligue: l.cle,
            valeur: crans,
            prochain: crans >= CRANS_D_UNE_BORDURE ? null : CRANS_D_UNE_BORDURE,
            ...(atteinte && { compte: `${crans}/${CRANS_D_UNE_BORDURE}` }),
          }
        }),
      ),
    ],
    sentiers: [
      section('pistes', 'Les pistes', AIDE_DES_PISTES, pistes('sentiers')),
      section('exploits', 'Les exploits', 'Une épreuve en jeu : ils se regagnent, le nombre dit combien de fois.', HAUTS_FAITS_DES_SENTIERS.map(h => caseDExploit(h, vus))),
      ...(p.sentiers
        ? [
            section(
              'maitres',
              'Les maîtres',
              'Le palier de maître d’un sentier : seize expertes, et un titre. Trois maîtres ouvrent un fond, les douze un thème.',
              BRANCHES.map(b => {
                const paliers = Math.max(0, Math.min(PALIER_DU_MAITRE, p.sentiers![b.key] ?? 0))
                return {
                  cle: `maitre:${b.key}`,
                  sorte: 'maitre' as const,
                  emoji: '',
                  titre: titreDeMaitre(b),
                  regle: `${b.nom} · ${b.categorie}`,
                  aLui: paliers >= PALIER_DU_MAITRE,
                  rarete: null,
                  branche: b.key,
                  valeur: paliers,
                  prochain: paliers >= PALIER_DU_MAITRE ? null : PALIER_DU_MAITRE,
                  compte: `${paliers}/${PALIER_DU_MAITRE}`,
                }
              }),
              { etapes: etapesVues('maitres', BRANCHES.filter(b => (p.sentiers![b.key] ?? 0) >= PALIER_DU_MAITRE).length) },
            ),
          ]
        : []),
    ],
    partout: [
      ...(p.ecussons
        ? [
            section(
              'ecussons',
              'Les écussons',
              `Tes bonnes réponses dans une catégorie, où que tu joues : le bronze à ${SEUILS_ECUSSON[0]}, l’argent à ${SEUILS_ECUSSON[1]}, l’or à ${SEUILS_ECUSSON[2]}.`,
              p.ecussons.map(e => ({
                cle: `ecusson:${e.categorie}`,
                sorte: 'ecusson' as const,
                emoji: '',
                titre: e.categorie,
                regle: `Les bonnes réponses en ${e.categorie.toLowerCase()}, où que tu joues`,
                aLui: e.palier > 0,
                rarete: null,
                metaux: e.palier,
                valeur: e.justes,
                prochain: prochainSeuil(e.palier),
                compte: `${formatNumber(e.justes)} ${e.justes < 2 ? 'juste' : 'justes'}`,
                etapes: SEUILS_ECUSSON.map((seuil, i) => ({ seuil, metal: (i + 1) as 1 | 2 | 3, recompenses: [], atteinte: e.palier > i, prochaine: e.palier === i })),
              })),
            ),
          ]
        : []),
      section('niveau', 'Ton niveau et tes Éclats', 'Ton niveau monte avec l’XP de tous les modes ; un Éclat tombe une fois sur quarante, une sur vingt au défi.', pistes('partout')),
    ],
  }
  return PAGES_DES_TROPHEES.map(page => {
    const s = sections[page]
    return { page, acquis: s.reduce((n, x) => n + x.acquis, 0), total: s.reduce((n, x) => n + x.total, 0), sections: s }
  })
}

/** Tout ce que l'album compte : la ligne des trophées de « Ma collection », et son total. */
export function compteDesTrophees(p: ProfilDeLAlbumDesTrophees): { acquis: number; total: number } {
  const pages = albumDesTrophees(p)
  return { acquis: pages.reduce((n, x) => n + x.acquis, 0), total: pages.reduce((n, x) => n + x.total, 0) }
}

/**
 * La page où l'album s'ouvre : celle où il a le plus — le mode qu'il joue —,
 * la première à égalité ; sans rien encore, le quiz du jour, ce qu'on joue le
 * plus.
 */
export function pageDuDebutDesTrophees(p: ProfilDeLAlbumDesTrophees): PageDesTrophees {
  const pages = albumDesTrophees(p)
  const meilleure = pages.reduce((m, x) => (x.acquis > m.acquis ? x : m), pages[0])
  return meilleure.acquis > 0 ? meilleure.page : 'jour'
}
