// Le carnet des animateurs au QG (`/admin#animateurs`, sous « Audience », à la
// place de « Salons » — la revue d'analyse du 4 novembre 2026, P1.1 : « Ce qui
// manque le plus : les animateurs comme clients […] c'est pourtant chaque
// animateur qui amène une salle entière »). Une ligne par salon ouvert — son
// titulaire, sa naissance, ses soirées, son rythme et son retard, ses salles,
// ce qu'elles font naître, ses quiz prêts —, l'entonnoir d'un nouvel
// animateur, et cinq états dits en clair, comme les segments des joueurs.
//
// Des soirées des autres, le salon et des chiffres : jamais un titre, une
// question, un prénom d'invité. Les dérivations, pures, vivent ici ; le
// serveur lit (`server/src/animateursDuQg.ts`) — les comptes en mémoire, les
// fiches des soirées une fois par jour, les quiz en mémoire.

import { jourAvant, jourDe } from './jour'
import { minuitDuJour, joursEntre, naissancesEnSoiree, lireLeSegment, AUX_PROFILS_DU_SEGMENT, NOM_DU_SEGMENT, REGLE_DU_SEGMENT, SEGMENTS, type ProfilDeLAudience, type SegmentDuQg } from './qgJoueurs'
import { mediane } from './qgModes'
import { formatNumber } from './typographie'
import type { OrigineDUnQuiz } from './library'
import type { CalculEnTranches } from './tranches'

// ── Les états ──────────────────────────────────────────────────────────────

/**
 * Où en est chaque salon ouvert, un état chacun, le premier dont il suit la
 * règle (`etatDUnSalon`) — dans l'ordre de la vie d'un animateur : il ouvre son
 * salon, fait ses premiers pas, revient à son rythme, tarde, s'en va.
 */
export const ETATS_D_UN_SALON = ['a-lancer', 'nouveau', 'fidele', 'en-retard', 'parti'] as const
export type EtatDUnSalon = (typeof ETATS_D_UN_SALON)[number]

/** Un salon ouvert depuis une semaine sans une soirée est « à lancer » : le moment de lui parler du quiz tout prêt. */
export const JOURS_POUR_SE_LANCER = 7
/** Le premier mois d'un animateur, de sa première soirée : il fait ses premiers pas ; une deuxième, sous trente jours, est la dernière marche de l'entonnoir. */
export const JOURS_DES_PREMIERS_PAS = 30
/** Rien depuis quatre-vingt-dix jours : parti. */
export const JOURS_D_UN_DEPART = 90
/** En retard passé le double de son rythme : un animateur du samedi qui saute une semaine n'est pas en retard, deux, si. */
export const RYTHMES_DE_RETARD = 2
/** Les soirées récentes d'un salon : ces quatre-vingt-dix jours. */
export const JOURS_RECENTS = 90

export const NOM_DE_L_ETAT: Record<EtatDUnSalon, string> = {
  'a-lancer': 'À lancer',
  nouveau: 'Nouveaux',
  fidele: 'Fidèles',
  'en-retard': 'En retard',
  parti: 'Partis',
}

/** L'état d'un salon, en un mot : sa ligne au carnet, la fiche de son titulaire. Il parle du salon, jamais de la personne. */
export const ETAT_D_UN_SALON: Record<EtatDUnSalon, string> = { 'a-lancer': 'à lancer', nouveau: 'nouveau', fidele: 'fidèle', 'en-retard': 'en retard', parti: 'parti' }

/** La règle de chaque état, en clair : la page l'écrit à côté de son compte, comme celle d'un segment des joueurs. */
export const REGLE_DE_L_ETAT: Record<EtatDUnSalon, string> = {
  'a-lancer': 'Ouvert il y a sept jours ou plus, sans une soirée jouée',
  nouveau: 'Ouvert ces sept jours, ou sa première soirée a moins de trente jours',
  fidele: 'Revenu au moins une fois, sa dernière soirée dans le double de son rythme',
  'en-retard': 'Sa dernière soirée passe le double de son rythme — ou, une seule soirée, elle a trente jours ou plus',
  parti: 'Rien depuis quatre-vingt-dix jours — ou ouvert depuis autant sans jamais jouer',
}

/** D'où viennent ses quiz prêts, au carnet : « 2 tout prêts, 1 modèle ». Au pluriel quand il y en a plusieurs. */
export const NOM_DE_L_ORIGINE_DU_QUIZ: Record<OrigineDUnQuiz, [string, string]> = {
  editeur: ['écrit à la main', 'écrits à la main'],
  liste: ['d’une liste collée', 'de listes collées'],
  import: ['d’un fichier', 'de fichiers'],
  modele: ['modèle', 'modèles'],
  'tout-pret': ['tout prêt', 'tout prêts'],
  partage: ['reçu par un code', 'reçus par un code'],
  catalogue: ['du catalogue', 'du catalogue'],
  inconnue: ['d’une page d’avant', 'de pages d’avant'],
}

/** Les quiz d'avant la colonne : ils ne disent pas d'où ils viennent, et la page ne le devine pas. */
export const QUIZ_D_AVANT_L_ORIGINE: [string, string] = ['d’avant le 4 novembre', 'd’avant le 4 novembre']

/** « 2 tout prêts, 1 modèle, 1 d’avant le 4 novembre » : ses quiz prêts par origine, dans l'ordre du carnet. */
export function originesEcrites(parOrigine: readonly { origine: OrigineDUnQuiz | null; prets: number }[]): string {
  return parOrigine.map(o => `${formatNumber(o.prets)} ${(o.origine === null ? QUIZ_D_AVANT_L_ORIGINE : NOM_DE_L_ORIGINE_DU_QUIZ[o.origine])[o.prets > 1 ? 1 : 0]}`).join(', ')
}

// ── Les soirées d'un salon ─────────────────────────────────────────────────

/** Une soirée telle que le carnet la lit : son salon, quand, ses invités qui ont joué, et leurs profils quand sa fiche les dit. */
export interface SoireeDuCarnet {
  spaceId: string
  /** Sa première question jouée. */
  quand: number
  joueurs: number
  /** Absent d'une fiche d'avant le 14 octobre 2026, qui ne les dit pas. */
  profils?: readonly string[]
}

/** Ce que les jours de soirée d'un salon disent de lui. */
export interface RythmeDUnSalon {
  /** Ses jours de soirée, de Paris, distincts, du plus ancien au plus récent : deux soirées le même soir n'en font qu'un. */
  jours: string[]
  /** L'écart médian entre deux de ses jours de soirée, en jours, arrondi ; null sous deux jours de soirée. */
  rythme: number | null
  /** Les jours depuis le dernier ; null sans soirée. */
  absent: number | null
  /** Ses jours de retard sur son rythme — négatifs, il est dans son rythme ; null sans rythme. */
  retard: number | null
}

/**
 * Le rythme d'un salon : ses jours de soirée, comptés au calendrier de Paris
 * (`joursEntre`) — deux samedis à 21 h, de part et d'autre du changement
 * d'heure, sont à sept jours, pas à sept jours et une heure —, l'écart médian
 * entre eux, et son retard sur ce rythme aujourd'hui. Deux soirées le même
 * soir — une clôture puis une autre — ne font qu'un jour : un rythme de zéro
 * mettrait le salon en retard dès le lendemain.
 */
export function rythmeDUnSalon(quands: readonly number[], aujourdhui: string): RythmeDUnSalon {
  const jours = [...new Set(quands.map(q => jourDe(q)))].sort()
  const ecarts = jours.slice(1).map((j, i) => joursEntre(jours[i], j))
  const median = mediane(ecarts)
  const rythme = median === null ? null : Math.round(median)
  const absent = jours.length > 0 ? joursEntre(jours[jours.length - 1], aujourdhui) : null
  return { jours, rythme, absent, retard: rythme !== null && absent !== null ? absent - rythme : null }
}

/** L'état d'un salon aujourd'hui (`REGLE_DE_L_ETAT`), de sa naissance et de ses jours de soirée. */
export function etatDUnSalon(neLe: number, r: RythmeDUnSalon, aujourdhui: string): EtatDUnSalon {
  if (r.jours.length === 0 || r.absent === null) {
    const ouvertDepuis = joursEntre(jourDe(neLe), aujourdhui)
    return ouvertDepuis >= JOURS_D_UN_DEPART ? 'parti' : ouvertDepuis >= JOURS_POUR_SE_LANCER ? 'a-lancer' : 'nouveau'
  }
  if (r.absent >= JOURS_D_UN_DEPART) return 'parti'
  if (joursEntre(r.jours[0], aujourdhui) < JOURS_DES_PREMIERS_PAS) return 'nouveau'
  // Une seule soirée, le premier mois passé : il n'est pas revenu — pas encore de rythme pour l'attendre.
  if (r.rythme === null) return 'en-retard'
  return r.absent > RYTHMES_DE_RETARD * r.rythme ? 'en-retard' : 'fidele'
}

// ── L'entonnoir d'un nouvel animateur ─────────────────────────────────────

/** Une marche de l'entonnoir : son nom, combien de salons y sont arrivés. */
export interface MarcheDesAnimateurs {
  nom: string
  n: number
}

export interface EntonnoirDesAnimateurs {
  /** Salon ouvert → un premier quiz → une première soirée → une deuxième sous trente jours. */
  marches: MarcheDesAnimateurs[]
  /** Leur première soirée a moins de trente jours, sans deuxième encore : la dernière marche ne les juge pas encore. */
  enAttente: number
}

/**
 * L'entonnoir d'un nouvel animateur, sur tous les salons ouverts : ouvert, un
 * premier quiz, une première soirée, une deuxième sous trente jours — un autre
 * soir, pas une seconde clôture du même. Un quiz effacé depuis ne s'efface pas
 * de la marche si une soirée l'a joué : jouer, c'est avoir eu un quiz.
 */
export function entonnoirDesAnimateurs(salons: readonly { quiz: number; jours: readonly string[] }[], aujourdhui: string): EntonnoirDesAnimateurs {
  const deuxieme = (jours: readonly string[]) => jours.length >= 2 && joursEntre(jours[0], jours[1]) <= JOURS_DES_PREMIERS_PAS
  return {
    marches: [
      { nom: 'Un salon ouvert', n: salons.length },
      { nom: 'Un premier quiz', n: salons.filter(s => s.quiz > 0 || s.jours.length > 0).length },
      { nom: 'Une première soirée', n: salons.filter(s => s.jours.length > 0).length },
      { nom: `Une deuxième sous ${JOURS_DES_PREMIERS_PAS} jours`, n: salons.filter(s => deuxieme(s.jours)).length },
    ],
    enAttente: salons.filter(s => s.jours.length > 0 && !deuxieme(s.jours) && joursEntre(s.jours[0], aujourdhui) < JOURS_DES_PREMIERS_PAS).length,
  }
}

// ── Le carnet ──────────────────────────────────────────────────────────────

/** Un salon ouvert tel que le serveur le connaît, en mémoire : son compte, son titulaire, ses quiz. */
export interface SalonDuCarnet {
  spaceId: string
  /** Le nom qu'on lit de l'espace (`nomDeLEspace`) : celui de son titulaire, pour un salon. */
  nom: string
  /** Le profil qui le tient ; null, un salon détaché ou un compte d'avant sans profil. */
  titulaire: { id: string; nom: string; login: string; suspendu: boolean } | null
  /** L'espace de l'administrateur. */
  toi: boolean
  neLe: number
  quiz: {
    /** Tous ses quiz, archivés compris. */
    total: number
    /** L'origine de chacun de ses quiz prêts — ceux que sa soirée peut lancer : ni archivés, ni sans une question prête. */
    prets: readonly (OrigineDUnQuiz | null)[]
  }
}

/** Une ligne du carnet, telle que la page la montre. */
export interface LigneDuCarnet {
  spaceId: string
  nom: string
  titulaire: { id: string; nom: string; login: string; suspendu: boolean } | null
  toi: boolean
  neLe: number
  etat: EtatDUnSalon
  premiere: number | null
  derniere: number | null
  /** Ses soirées, en tout et ces quatre-vingt-dix jours — chaque soirée rangée, pas chaque jour. */
  soirees: number
  soireesRecentes: number
  rythme: number | null
  absent: number | null
  retard: number | null
  /** La médiane de ses salles : les invités qui ont joué ; null sans soirée. */
  invites: number | null
  /** Ses invités venus avec un profil, sur ceux des soirées dont la fiche dit les profils. */
  avecProfil: { profils: number; invites: number }
  /** Les profils nés à l'entrée d'une de ses soirées ou pendant elle (`naissancesEnSoiree`). */
  nesChezLui: number
  quiz: {
    total: number
    prets: number
    /** Ses quiz prêts par origine, la plus fréquente d'abord ; null : d'avant la colonne. */
    parOrigine: { origine: OrigineDUnQuiz | null; prets: number }[]
  }
}

/** Un état et ce qu'il compte : ses salons, et les titulaires qu'une annonce toucherait — ni détachés, ni suspendus. */
export interface EtatDuCarnet {
  etat: EtatDUnSalon
  salons: number
  titulaires: number
}

export interface CarnetDesAnimateurs {
  maintenant: number
  /** Quand les soirées des jours finis ont été lues : une fois par jour, gardées jusqu'à minuit. */
  lu: number
  salons: LigneDuCarnet[]
  etats: EtatDuCarnet[]
  entonnoir: EntonnoirDesAnimateurs
  /** Les espaces désactivés : ils ne comptent pas, « Les salons » les montre. */
  desactives: number
}

/** Ce que le calcul rend, avant ce que le serveur sait de sa lecture. */
export type CalculDuCarnet = Pick<CarnetDesAnimateurs, 'salons' | 'etats' | 'entonnoir'>

/**
 * Le carnet, une étape par tranche : chaque salon ouvert, ses soirées, son
 * état ; les profils nés chez lui ; l'entonnoir ; ce que compte chaque état.
 * Une soirée d'un espace qui n'est plus ouvert ne compte pour personne.
 */
export function* carnetEnTranches(
  salons: readonly SalonDuCarnet[],
  soirees: readonly SoireeDuCarnet[],
  profils: readonly Pick<ProfilDeLAudience, 'id' | 'cree' | 'origine'>[],
  maintenant: number,
): CalculEnTranches<CalculDuCarnet> {
  const aujourdhui = jourDe(maintenant)
  const recentes = minuitDuJour(jourAvant(aujourdhui, JOURS_RECENTS - 1))
  const parSalon = new Map<string, SoireeDuCarnet[]>(salons.map(s => [s.spaceId, []]))
  for (const s of soirees) if (s.quand <= maintenant) parSalon.get(s.spaceId)?.push(s)
  yield
  // Où chaque profil né en soirée est né : la même règle que les premiers pas de la page des joueurs.
  const nesChez = new Map<string, number>()
  for (const [soiree, nes] of naissancesEnSoiree(soirees, profils)) nesChez.set(soiree.spaceId, (nesChez.get(soiree.spaceId) ?? 0) + nes.length)
  yield
  const rythmes = new Map(salons.map(s => [s.spaceId, rythmeDUnSalon((parSalon.get(s.spaceId) ?? []).map(x => x.quand), aujourdhui)]))
  const lignes: LigneDuCarnet[] = salons.map(s => {
    const siennes = parSalon.get(s.spaceId) ?? []
    const r = rythmes.get(s.spaceId)!
    const quands = siennes.map(x => x.quand)
    const avecLeursProfils = siennes.filter(x => x.profils !== undefined)
    const parOrigine = new Map<OrigineDUnQuiz | null, number>()
    for (const o of s.quiz.prets) parOrigine.set(o, (parOrigine.get(o) ?? 0) + 1)
    return {
      spaceId: s.spaceId,
      nom: s.nom,
      titulaire: s.titulaire,
      toi: s.toi,
      neLe: s.neLe,
      etat: etatDUnSalon(s.neLe, r, aujourdhui),
      premiere: quands.length > 0 ? Math.min(...quands) : null,
      derniere: quands.length > 0 ? Math.max(...quands) : null,
      soirees: siennes.length,
      soireesRecentes: siennes.filter(x => x.quand >= recentes).length,
      rythme: r.rythme,
      absent: r.absent,
      retard: r.retard,
      invites: mediane(siennes.map(x => x.joueurs)),
      avecProfil: {
        profils: avecLeursProfils.reduce((t, x) => t + new Set(x.profils).size, 0),
        invites: avecLeursProfils.reduce((t, x) => t + x.joueurs, 0),
      },
      nesChezLui: nesChez.get(s.spaceId) ?? 0,
      quiz: {
        total: s.quiz.total,
        prets: s.quiz.prets.length,
        parOrigine: [...parOrigine]
          .map(([origine, prets]) => ({ origine, prets }))
          .sort((a, b) => Number(a.origine === null) - Number(b.origine === null) || b.prets - a.prets || String(a.origine).localeCompare(String(b.origine))),
      },
    }
  })
  yield
  const entonnoir = entonnoirDesAnimateurs(
    salons.map(s => ({ quiz: s.quiz.total, jours: rythmes.get(s.spaceId)!.jours })),
    aujourdhui,
  )
  const etats = ETATS_D_UN_SALON.map(etat => {
    const siens = lignes.filter(l => l.etat === etat)
    return { etat, salons: siens.length, titulaires: siens.filter(l => l.titulaire && !l.titulaire.suspendu).length }
  })
  return { salons: lignes, etats, entonnoir }
}

/** Les titulaires d'un état — tous les états sans lui —, ni détachés ni suspendus : ceux qu'une annonce toucherait. */
export function titulairesDuCarnet(lignes: readonly Pick<LigneDuCarnet, 'etat' | 'titulaire'>[], etat: EtatDUnSalon | null): string[] {
  return [...new Set(lignes.filter(l => (etat === null || l.etat === etat) && l.titulaire && !l.titulaire.suspendu).map(l => l.titulaire!.id))]
}

// ── Leur écrire : les segments des annonces ─────────────────────────────────

/**
 * Un segment de plus pour les annonces (`qg_annonce_segments`) : les
 * animateurs — les titulaires des salons ouverts —, tous ou ceux d'un état. Ses
 * destinataires se comptent à l'envoi, comme ceux d'un segment des joueurs.
 */
export type SegmentDesAnimateurs = 'animateurs' | `animateurs:${EtatDUnSalon}`
export const SEGMENTS_DES_ANIMATEURS: readonly SegmentDesAnimateurs[] = ['animateurs', ...ETATS_D_UN_SALON.map(e => `animateurs:${e}` as const)]

/** L'état que vise un segment des animateurs ; null, tous. */
export const etatDuSegment = (s: SegmentDesAnimateurs): EtatDUnSalon | null => (s === 'animateurs' ? null : (s.slice('animateurs:'.length) as EtatDUnSalon))

/** Son nom, dans la liste des annonces faites ; « À qui ? » les range sous « Les animateurs », du nom de leur état. */
const NOM_DU_SEGMENT_DES_ANIMATEURS: Record<SegmentDesAnimateurs, string> = {
  animateurs: 'Tous les animateurs',
  'animateurs:a-lancer': 'Animateurs à lancer',
  'animateurs:nouveau': 'Nouveaux animateurs',
  'animateurs:fidele': 'Animateurs fidèles',
  'animateurs:en-retard': 'Animateurs en retard',
  'animateurs:parti': 'Animateurs partis',
}

const AUX_ANIMATEURS: Record<SegmentDesAnimateurs, string> = {
  animateurs: 'aux animateurs',
  'animateurs:a-lancer': 'aux animateurs à lancer',
  'animateurs:nouveau': 'aux nouveaux animateurs',
  'animateurs:fidele': 'aux animateurs fidèles',
  'animateurs:en-retard': 'aux animateurs en retard',
  'animateurs:parti': 'aux animateurs partis',
}

/** Ce que compte chaque segment des animateurs : les titulaires qu'il toucherait. */
export interface ComptesDesAnimateurs {
  maintenant: number
  comptes: Record<SegmentDesAnimateurs, number>
}

/** À qui une annonce s'écrit : un segment des joueurs, ou des animateurs. */
export type SegmentDesAnnonces = SegmentDuQg | SegmentDesAnimateurs

export const estUnSegmentDesAnimateurs = (s: SegmentDesAnnonces): s is SegmentDesAnimateurs => (SEGMENTS_DES_ANIMATEURS as readonly string[]).includes(s)

/** Un segment tel que la route des annonces le reçoit : un des joueurs, un des animateurs, ou null — tous les profils. Refusé plutôt que deviné. */
export function lireLeSegmentDesAnnonces(brut: unknown): SegmentDesAnnonces | null {
  if ((SEGMENTS_DES_ANIMATEURS as readonly unknown[]).includes(brut)) return brut as SegmentDesAnimateurs
  return lireLeSegment(brut)
}

/** Son nom, dans la liste des annonces faites : « Endormis », « Animateurs en retard ». */
export const nomDuSegmentDesAnnonces = (s: SegmentDesAnnonces): string => (estUnSegmentDesAnimateurs(s) ? NOM_DU_SEGMENT_DES_ANIMATEURS[s] : NOM_DU_SEGMENT[s])

/** Le segment dans une phrase : « aux endormis », « aux animateurs en retard ». */
export const auxProfilsDe = (s: SegmentDesAnnonces): string => (estUnSegmentDesAnimateurs(s) ? AUX_ANIMATEURS[s] : AUX_PROFILS_DU_SEGMENT[s])

/** Sa règle, en clair : celle du segment des joueurs, ou celle de l'état du salon que ses titulaires tiennent. */
export function regleDuSegmentDesAnnonces(s: SegmentDesAnnonces): string {
  if (!estUnSegmentDesAnimateurs(s)) return REGLE_DU_SEGMENT[s]
  const etat = etatDuSegment(s)
  return etat === null ? 'Le titulaire de chaque salon ouvert' : REGLE_DE_L_ETAT[etat]
}

/** Les segments des joueurs, puis ceux des animateurs : « À qui ? » les propose dans cet ordre. */
export const SEGMENTS_DES_ANNONCES: readonly SegmentDesAnnonces[] = [...SEGMENTS, ...SEGMENTS_DES_ANIMATEURS]
