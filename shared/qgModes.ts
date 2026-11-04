// Les modes au QG 2 (la proposition du 3 novembre 2026, `retours/2026-11-03/le-qg.md`,
// que le propriétaire a faite sienne le 4 : « Les modes aussi restent très
// sommaires et pas forcément très pratiques ») : ce qui se compare d'un mode
// à l'autre — la quantité, la réussite, la durée d'une partie, le retour à
// J+7 —, et l'entonnoir de chacun, là où l'on décroche.
//
// Des dérivations pures, sur les journaux que la vue d'ensemble garde déjà
// (`lesTrenteJours`, `server/src/qg.ts`) : la fin d'une partie et ses bonnes
// réponses sont deux colonnes de plus des mêmes lignes, lues par le même
// index — pas une ligne de plus au quota de Turso. Les tests les jouent
// l'horloge à la main (`qg-modes.test.ts`).
//
// Ce qui ne se compte pas honnêtement ne se compte pas, et la page le dit :
// une précision ne compte que les QCM (le `CLAUDE.md`) — le Cabinet n'en pose
// pas, une estimation n'est jamais juste —, un quiz de soirée ne date pas sa
// fin, et un invité sans profil ne se suit pas d'un soir à l'autre.

import { MODES_DU_QG, jourDeLInstant, participationsParSeau, type ModeDuQg, type SoireeDesParticipations, type SoireeRangeeDuQg } from './qg'
import { PERIODES_DU_QG, cadreDeLaPeriode, type PeriodeDuQg, type TotauxDUnePeriode } from './qgPeriodes'
import { SEUILS } from './profil'
import type { PartieSeule, SoireeDUnProfil, SoireeJouee } from './qgActivite'
import type { PartDesBonnes } from './qgDuJour'
import type { CalculEnTranches } from './tranches'
// Un type seulement : la liste des modes de série vit dans `campagne.ts`, que la page du QG n'a pas à tirer pour elle.
import type { ModeDeSerie } from './campagne'

// ── Ce que les journaux en disent ────────────────────────────────────────

/** Une partie jouée seul, telle que les modes côte à côte la lisent : celle de l'activité, sa fin et ses bonnes réponses en plus. */
export interface PartieDesModes extends PartieSeule {
  /** Sa fin ; null tant qu'elle court, ou laissée en route. */
  fin: number | null
  /** Ses bonnes réponses aux questions à choix qui comptent encore. */
  justes: number
  /**
   * Ses questions à choix qui comptent : au quiz du jour, celles posées —
   * répondues ou laissées au temps — sans les annulées pour tous ; en
   * campagne et en duel, ses questions jouées ; null là où elles ne sont pas
   * des QCM : le Cabinet, l'expédition d'avant lui.
   */
  qcm: number | null
}

/**
 * Une soirée telle que les modes la lisent : sa fiche — quand, ses quiz, ses invités qui ont joué, leurs questions —,
 * ses profils, et son espace et son nom, la clé que portent les lignes d'expérience de ses profils
 * (`SoireeDUnProfil.soiree`) — rien de tout cela ne quitte le serveur.
 */
export type SoireeDesModes = SoireeJouee & Pick<SoireeDesParticipations, 'profils'> & { spaceId?: string; id?: string }

/**
 * Les séries de la campagne qui se jouent en QCM — une question, ses
 * réponses, la bonne : la série, l'épreuve d'un sentier, l'étape d'un
 * parcours, la révision, le défi, les deux duels. Pas le Cabinet, dont les
 * jeux se jugent chacun à sa façon (une épingle à tant de kilomètres, une
 * fiche trouvée en tant d'indices), ni l'expédition d'avant lui, ses rébus et
 * ses frises : leur part de « justes » mêlerait des choses qui ne se comparent
 * pas. Typée sur tous les modes de série (`MODES_DE_SERIE`) : un mode de plus,
 * et le typage demande s'il pose des QCM — une liste des seuls « oui » l'aurait
 * laissé dehors sans un mot.
 */
const SE_JOUE_EN_QCM: Record<ModeDeSerie, boolean> = {
  serie: true,
  sentier: true,
  defi: true,
  duel: true,
  revision: true,
  rencontre: true,
  sujet: true,
  expedition: false,
  cabinet: false,
}

/**
 * Une série de ce mode se joue-t-elle en QCM ? Un mode absent ou hors de la
 * liste se lit en série, comme partout (`modeDeSerieLu`) — la colonne est
 * `NOT NULL DEFAULT 'serie'`. Par `Object.hasOwn` : `constructor` n'est pas un mode.
 */
export const seJoueEnQcm = (mode: string | null) => (mode !== null && Object.hasOwn(SE_JOUE_EN_QCM, mode) ? SE_JOUE_EN_QCM[mode as ModeDeSerie] : SE_JOUE_EN_QCM.serie)

/** Les modes dont la réussite se compte : le Cabinet n'a pas de QCM (plus haut). */
export const QCM_DU_MODE: Record<ModeDuQg, boolean> = { soiree: true, campagne: true, cabinet: false, jour: true, duel: true }

// ── Côte à côte ───────────────────────────────────────────────────────────

/** Une ligne de « Côte à côte » : un mode, sur une période. */
export interface LigneDesModes {
  mode: ModeDuQg
  /**
   * Les personnes, comptées comme la participation de la vue d'ensemble : un
   * profil une fois ; en soirée, un invité sans profil une fois par soirée.
   */
  joueurs: number
  /** Les parties : un quiz de soirée, une partie du jour, de campagne ou du Cabinet, un duel — comme l'activité. */
  parties: number
  questions: number
  /** Les bonnes réponses aux QCM qui comptent, sur combien ; null là où elle ne se compte pas — le Cabinet. */
  reussite: PartDesBonnes | null
  /**
   * Une partie de son début à sa fin, la médiane des finies — une partie
   * laissée puis reprise compte son attente, la médiane ne s'y laisse pas
   * tirer ; null là où le journal ne date pas sa fin : un quiz de soirée.
   */
  duree: { medianeMs: number | null; finies: number } | null
}

/** Le retour à J+7 d'un mode : des joueurs d'un jour, ceux qui y ont rejoué dans les sept jours qui suivent. */
export interface RetourDUnMode {
  revenus: number
  sur: number
}

export interface ModesCoteACote {
  /** Chaque période de la barre — une heure, 24 heures, sept jours, trente —, ses cinq lignes, dans l'ordre des modes. */
  periodes: Record<PeriodeDuQg, LigneDesModes[]>
  /** Le retour à J+7, mode par mode, et sur combien de jours il se lit : ceux des trente qui ont leurs sept jours derrière eux. */
  retour: { jours: number; modes: Record<ModeDuQg, RetourDUnMode> }
}

/** La médiane : une partie laissée trois jours ne tire pas à elle la durée des autres, comme une salle de quatre-vingts celle des soirées. Null sans valeur. */
export function mediane(valeurs: readonly number[]): number | null {
  if (valeurs.length === 0) return null
  const triees = [...valeurs].sort((a, b) => a - b)
  const milieu = Math.floor(triees.length / 2)
  return triees.length % 2 === 1 ? triees[milieu] : (triees[milieu - 1] + triees[milieu]) / 2
}

/**
 * Les cinq modes sur une fenêtre, ses bornes comprises : les joueurs, les
 * parties, les questions jouées, la réussite et la durée d'une partie. Une
 * partie se date à son début, comme à l'activité ; une partie finie après la
 * fenêtre n'y compte pas sa durée. En soirée, la réussite est celle que les
 * profils ont donnée aux QCM auxquels ils ont répondu — leur relevé, rangé
 * dans leur ligne d'expérience : un invité sans profil n'en a pas à lui —,
 * comptée avec leur soirée : une ligne se date à son premier crédit, la
 * soirée à sa première question, et sur une heure l'une passait sans l'autre
 * — « aucune partie, 62 % ». Une ligne qui ne dit pas sa soirée se date à son
 * crédit.
 */
export function lignesDesModes(
  parties: readonly PartieDesModes[],
  soirees: readonly SoireeDesModes[],
  deProfils: readonly SoireeDUnProfil[],
  debut: number,
  fin: number,
): LigneDesModes[] {
  const dans = (quand: number) => quand >= debut && quand <= fin
  const [tout] = participationsParSeau(parties, soirees, [debut], fin)
  const acc = Object.fromEntries(MODES_DU_QG.map(m => [m, { parties: 0, questions: 0, justes: 0, sur: 0, durees: [] as number[] }])) as Record<
    ModeDuQg,
    { parties: number; questions: number; justes: number; sur: number; durees: number[] }
  >
  for (const p of parties) {
    if (!dans(p.quand)) continue
    const a = acc[p.mode]
    a.parties++
    a.questions += p.questions
    if (p.qcm !== null) {
      a.justes += p.justes
      a.sur += p.qcm
    }
    if (p.fin !== null && p.fin >= p.quand && p.fin <= fin) a.durees.push(p.fin - p.quand)
  }
  const lesSoirees = new Set<string>()
  for (const s of soirees) {
    if (!dans(s.quand)) continue
    acc.soiree.parties += s.quiz
    acc.soiree.questions += s.jouees
    if (s.spaceId !== undefined && s.id !== undefined) lesSoirees.add(`${s.spaceId}|${s.id}`)
  }
  for (const s of deProfils) {
    if (!(s.soiree !== undefined ? lesSoirees.has(s.soiree) : dans(s.quand))) continue
    acc.soiree.justes += s.justes ?? 0
    acc.soiree.sur += s.qcm ?? 0
  }
  return MODES_DU_QG.map(mode => {
    const a = acc[mode]
    return {
      mode,
      joueurs: tout?.modes[mode] ?? 0,
      parties: a.parties,
      questions: a.questions,
      reussite: QCM_DU_MODE[mode] ? { justes: a.justes, sur: a.sur } : null,
      duree: mode === 'soiree' ? null : { medianeMs: mediane(a.durees), finies: a.durees.length },
    }
  })
}

/** Les jours qu'un joueur a pour revenir : J+1 à J+7. */
export const JOURS_DU_RETOUR = 7

/**
 * Le retour à J+7, mode par mode : des joueurs d'un jour, la part qui rejoue
 * au même mode dans les sept jours qui suivent, additionnée sur les jours
 * des trente qui ont leurs sept jours derrière eux — finis, hier compris,
 * aujourd'hui pas : il court encore. Un profil qui joue deux fois le même
 * jour ne revient pas. Les jours sont ceux de Paris (`minuits`, aujourd'hui
 * en dernier) : un jour de vingt-cinq heures reste un jour. Des profils
 * seulement : en soirée, ceux dont la ligne d'expérience dit la soirée — un
 * invité sans profil ne se suit pas d'un soir à l'autre.
 */
export function retourAJ7(
  parties: readonly Pick<PartieDesModes, 'qui' | 'quand' | 'mode'>[],
  deProfils: readonly Pick<SoireeDUnProfil, 'qui' | 'quand'>[],
  minuits: readonly number[],
  maintenant: number,
): ModesCoteACote['retour'] {
  // Le dernier jour qui a ses sept jours derrière lui : J+7 doit être fini, la veille d'aujourd'hui au plus tard.
  const dernier = minuits.length - 2 - JOURS_DU_RETOUR
  const joursDe = Object.fromEntries(MODES_DU_QG.map(m => [m, new Map<string, Set<number>>()])) as Record<ModeDuQg, Map<string, Set<number>>>
  const noter = (mode: ModeDuQg, qui: string, quand: number) => {
    if (quand > maintenant) return
    const i = jourDeLInstant(minuits, quand)
    if (i < 0) return
    let jours = joursDe[mode].get(qui)
    if (!jours) joursDe[mode].set(qui, (jours = new Set()))
    jours.add(i)
  }
  for (const p of parties) noter(p.mode, p.qui, p.quand)
  for (const s of deProfils) noter('soiree', s.qui, s.quand)
  const modes = Object.fromEntries(
    MODES_DU_QG.map(m => {
      let revenus = 0
      let sur = 0
      for (const jours of joursDe[m].values()) {
        const tries = [...jours].sort((a, b) => a - b)
        tries.forEach((d, k) => {
          if (d > dernier) return
          sur++
          // Le jour joué suivant, s'il tombe dans les sept : rangés, il suffit de regarder celui d'après.
          if (k + 1 < tries.length && tries[k + 1] <= d + JOURS_DU_RETOUR) revenus++
        })
      }
      return [m, { revenus, sur }]
    }),
  ) as Record<ModeDuQg, RetourDUnMode>
  return { jours: Math.max(0, dernier + 1), modes }
}

/**
 * Les modes côte à côte (`/admin#activite`) : chaque période de la barre,
 * puis le retour à J+7 — une période par tranche, menées un tour de boucle
 * chacune (`enTranches`) : chacune repasse les trente jours, trois mille
 * séries et plus en production (règle `qg.md`).
 */
export function* modesCoteACote(
  parties: readonly PartieDesModes[],
  soirees: readonly SoireeDesModes[],
  deProfils: readonly SoireeDUnProfil[],
  minuits: readonly number[],
  maintenant: number,
): CalculEnTranches<ModesCoteACote> {
  const periodes = {} as Record<PeriodeDuQg, LigneDesModes[]>
  for (const periode of PERIODES_DU_QG) {
    yield
    const { debuts } = cadreDeLaPeriode(periode, minuits, maintenant)
    periodes[periode] = lignesDesModes(parties, soirees, deProfils, debuts[0], maintenant)
  }
  yield
  return { periodes, retour: retourAJ7(parties, deProfils, minuits, maintenant) }
}

// ── Les tuiles d'un mode ──────────────────────────────────────────────────

/**
 * Ce qu'un joueur d'un mode y a joué, en moyenne, sur une période : ses
 * parties sur ses joueurs, tels que la vue d'ensemble les compte
 * (`TotauxDUnePeriode`), au dixième — sur quoi l'on s'acharne (« sur quoi une
 * personne s'acharne ou pas », le 17 octobre 2026). En soirée, un invité sans
 * profil compte une fois par soirée, et y joue une fois. Null sans joueur.
 */
export function partiesParJoueur(totaux: Pick<TotauxDUnePeriode, 'parties' | 'modes'>, mode: ModeDuQg): number | null {
  const joueurs = totaux.modes[mode]
  return joueurs > 0 ? Math.round((totaux.parties[mode] / joueurs) * 10) / 10 : null
}

// ── L'entonnoir d'un mode ─────────────────────────────────────────────────

/** Une marche de l'entonnoir : ce qui y arrive. Chacune compte une part de la précédente. */
export interface EtapeDeLEntonnoir {
  nom: string
  n: number
}

/** Une marche, et ce qu'elle dit : sa part du départ, et ce qui s'est perdu depuis la précédente, en pour cent entiers. */
export interface MarcheDeLEntonnoir extends EtapeDeLEntonnoir {
  /** Null au départ vide. */
  duDepart: number | null
  /** Null à la première marche, ou derrière une marche vide. */
  perte: number | null
}

/** Les marches d'un entonnoir : la part du départ de chacune, et ce qui s'est perdu en route. */
export function marchesDeLEntonnoir(etapes: readonly EtapeDeLEntonnoir[]): MarcheDeLEntonnoir[] {
  const depart = etapes[0]?.n ?? 0
  return etapes.map((e, i) => {
    const avant = i > 0 ? etapes[i - 1].n : 0
    return {
      ...e,
      duDepart: depart > 0 ? Math.round((e.n / depart) * 100) : null,
      perte: i > 0 && avant > 0 ? Math.round(((avant - e.n) / avant) * 100) : null,
    }
  })
}

/**
 * D'une partie commencée à sa fin — le quiz du jour, la campagne, le Cabinet
 * —, sur une période de la vue d'ensemble (`TotauxDUnePeriode`) : celles
 * commencées, celles finies avant la fin de la période. Rien d'un serveur
 * d'avant, qui ne comptait pas les finies.
 */
export function entonnoirDuSolo(totaux: Pick<TotauxDUnePeriode, 'parties' | 'finies'>, mode: Exclude<ModeDuQg, 'soiree'>): EtapeDeLEntonnoir[] | null {
  if (!totaux.finies) return null
  return [
    { nom: 'Partie commencée', n: totaux.parties[mode] },
    { nom: 'Partie finie', n: totaux.finies[mode] },
  ]
}

/**
 * Une soirée, de son premier quiz à sa clôture, sur les soirées du mois que
 * la page des soirées a déjà lues (`PageDesSoirees.historique`) : celles qui
 * ont lancé un quiz — une question jouée —, celles qui en ont joué assez
 * pour un podium (`SEUILS.questionsQuiz` : en deçà, un essai), et parmi
 * elles celles closes. Une salle ouverte sans une question jouée ne laisse
 * aucune trace : un essai s'efface, et ce qui n'est jamais joué ne se range pas.
 */
export function entonnoirDesSoirees(historique: readonly Pick<SoireeRangeeDuQg, 'quand' | 'questions' | 'ouverte'>[], debut: number, fin: number): EtapeDeLEntonnoir[] {
  const dans = historique.filter(s => s.quand >= debut && s.quand <= fin)
  const jouees = dans.filter(s => s.questions >= SEUILS.questionsQuiz)
  return [
    { nom: 'Un quiz lancé', n: dans.length },
    { nom: `${SEUILS.questionsQuiz} questions jouées`, n: jouees.length },
    { nom: 'Close', n: jouees.filter(s => !s.ouverte).length },
  ]
}

/**
 * Un duel classé, de son lancement à son verdict — joué des deux côtés —, sur
 * les duels lancés que la page des duels a déjà lus (`SuiviDesDuels.lancesDuMois`).
 * Un duel a sept jours pour être joué : sur une heure, la plupart attendent encore.
 */
export function entonnoirDesDuels(lances: readonly { quand: number; joue: boolean }[], debut: number, fin: number): EtapeDeLEntonnoir[] {
  const dans = lances.filter(d => d.quand >= debut && d.quand <= fin)
  return [
    { nom: 'Duel classé lancé', n: dans.length },
    { nom: 'Joué des deux côtés', n: dans.filter(d => d.joue).length },
  ]
}
