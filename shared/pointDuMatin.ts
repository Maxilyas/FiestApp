// Le point du matin, et celui du lundi (la revue d'expert du 4 novembre 2026,
// P1.4, `retours/2026-11-04/experts/analyse-et-management.md`) : chaque matin,
// la veille en nombres sur le téléphone de l'administrateur — « Hier : 31
// joueurs (+12 %), 3 profils nés, 1 soirée, 12 invités · 2 choses à traiter »
// —, et « Hier, en bref » en tête du poste de commande ; le lundi, la semaine
// face aux quatre d'avant. La décision qu'il sert : n'ouvrir le QG que quand il
// le faut, et savoir chaque semaine si l'application grandit.
//
// Une seule dérivation fait la notification et le bandeau (`pointDuMatin`) : ils
// ne se contredisent jamais. Elle lit la mémoire du QG (`qg_jours`, la version 2
// — `shared/qgJoueurs.ts`), jamais les journaux : rien à garder, tout se relit.
// La notification ne dit que des nombres — un écran verrouillé se lit
// par-dessus l'épaule — ; la page, le nom des salons.

import { espacesFines, formatNumber } from './typographie'
import { jourAvant, jourEnToutesLettres } from './jour'
import { HABITUDE_EN_POURCENTS, JOURS_DE_L_HABITUDE, MODES_DU_QG, ecartALHabitude, type EcartALHabitude } from './qg'
import { REGLE, type CleDeRegle, type Gravite } from './qgAlertes'
import { nesEnSoiree, soireesDuJour, type ChiffresDUnJour } from './qgJoueurs'
import type { MessageDuQg } from './pannes'

// ── Le réglage ──────────────────────────────────────────────────────────────

/** L'heure du point d'office, en minutes depuis minuit à Paris : 8 h 40 — la production est debout depuis 7 h (règle `exploitation.md`). */
export const HEURE_DU_POINT = 8 * 60 + 40
/** Ses bornes et son pas : un matin, de cinq en cinq minutes. */
export const HEURE_DU_POINT_MIN = 6 * 60
export const HEURE_DU_POINT_MAX = 11 * 60
export const PAS_DE_L_HEURE_DU_POINT = 5
/**
 * Passé midi, plus de notification : un serveur réveillé l'après-midi (la
 * préproduction qu'on laisse dormir) n'envoie pas « Hier » à l'heure du
 * goûter. Son passage écrit quand même la mémoire de la veille.
 */
export const FIN_DU_POINT = 12 * 60

/** La clé de son réglage dans `qg_reglages`, à côté de ceux des règles. */
export const CLE_DU_POINT = 'point-du-matin'

/** Ce que l'administrateur a réglé : ce qui vaut d'office n'y est pas. */
export interface ReglageDuPoint {
  actif?: boolean
  minutes?: number
}

/** Le point tel qu'il vaut. */
export interface PointRegle {
  actif: boolean
  minutes: number
}

/**
 * D'office : à 8 h 40, et la notification allumée en production seulement —
 * le téléphone de l'administrateur, prévenu sur les deux services, recevrait
 * sinon chaque matin aussi les deux joueurs de la préproduction.
 */
export const pointDOffice = (production: boolean): PointRegle => ({ actif: production, minutes: HEURE_DU_POINT })

/** « 8 h 40 » : une heure du point, ses espaces insécables (la règle de `heureEcrite`). */
export const heureDuPointEcrite = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`

/**
 * Un réglage venu de la page, relu comme un seuil (`lireLeReglage`) : refusé
 * en clair hors de ses bornes ou de son pas, jamais ramené à la borne ; ce
 * qui vaut d'office ne s'écrit pas.
 */
export function lireLeReglageDuPoint(brut: unknown, avant: ReglageDuPoint, dOffice: PointRegle): ReglageDuPoint {
  if (!brut || typeof brut !== 'object') throw new Error('Un réglage attendu : l’heure du point, ou sa notification.')
  const { actif, minutes } = brut as { actif?: unknown; minutes?: unknown }
  if (actif === undefined && minutes === undefined) throw new Error('Un réglage attendu : l’heure du point, ou sa notification.')
  const apres: ReglageDuPoint = { ...avant }
  if (actif !== undefined) {
    if (typeof actif !== 'boolean') throw new Error('La notification du point s’allume ou se coupe.')
    apres.actif = actif
  }
  if (minutes !== undefined) {
    if (
      typeof minutes !== 'number' ||
      !Number.isInteger(minutes) ||
      minutes < HEURE_DU_POINT_MIN ||
      minutes > HEURE_DU_POINT_MAX ||
      minutes % PAS_DE_L_HEURE_DU_POINT !== 0
    ) {
      throw new Error(`L’heure du point se règle de ${heureDuPointEcrite(HEURE_DU_POINT_MIN)} à ${heureDuPointEcrite(HEURE_DU_POINT_MAX)}, de cinq en cinq minutes.`)
    }
    apres.minutes = minutes
  }
  if (apres.actif === dOffice.actif) delete apres.actif
  if (apres.minutes === dOffice.minutes) delete apres.minutes
  return apres
}

/** Le point tel qu'il vaut, son réglage posé sur ce qui vaut d'office. */
export const pointRegle = (r: ReglageDuPoint, dOffice: PointRegle): PointRegle => ({ actif: r.actif ?? dOffice.actif, minutes: r.minutes ?? dOffice.minutes })

/** « Point du matin réglé : à 9 h 15 (avant 8 h 40) », pour le journal des gestes. */
export function phraseDuReglageDuPoint(avant: PointRegle, apres: PointRegle): string {
  const morceaux: string[] = []
  if (avant.minutes !== apres.minutes) morceaux.push(`à ${heureDuPointEcrite(apres.minutes)} (avant ${heureDuPointEcrite(avant.minutes)})`)
  if (avant.actif !== apres.actif) morceaux.push(apres.actif ? 'la notification allumée' : 'la notification coupée')
  return `Point du matin réglé : ${morceaux.join(', ')}`
}

/** Ce que la page des alertes dit du point : son réglage, ce qui vaut d'office, et le dernier passé. */
export interface EtatDuPoint extends PointRegle {
  dOffice: PointRegle
  /** Le dernier point : son jour, quand il est parti — null, pas de notification ce jour-là — et les téléphones qui l'ont reçu. */
  dernier: { jour: string; envoyeLe: number | null; telephones: number | null } | null
}

// ── Ce qu'il lit ────────────────────────────────────────────────────────────

/** Les jours que le point lit, la veille comprise : son habitude (sept jours), et le lundi les quatre semaines d'avant. */
export const JOURS_DU_POINT = 7 * 5

/**
 * Ce qu'un jour fini de la mémoire dit au point (`jourDuPoint`) : des nombres,
 * et l'identifiant des salons qui y ont joué — la page les nomme, la
 * notification jamais.
 */
export interface JourDuPoint {
  jour: string
  /** Les personnes du jour, comme le poste de commande les compte : un invité sans profil une fois par soirée. */
  joueurs: number
  /** Les participations, tous modes. */
  parties: number
  /** Les profils qui ont joué ce jour-là, et ces sept jours finissant ce jour-là. */
  profils: number
  semaine: number
  nes: number
  /** Nés en soirée — à son entrée, entre deux quiz, à sa fin ; null, une ligne d'avant. */
  nesEnSoiree: number | null
  /** Des profils nés la veille, ceux qui ont joué ce jour-là ; null, une ligne d'avant. */
  lendemain: number | null
  /** Ses soirées, leurs invités et ceux venus avec un profil, leurs salons ; null, une ligne d'avant. */
  soirees: { nombre: number; invites: number; avecProfil: number; salons: { espace: string; nouveau: boolean }[] } | null
}

/** Un jour de la mémoire, réduit à ce que le point lit — la page reçoit ces quelques nombres, pas la ligne entière. */
export function jourDuPoint(jour: string, c: ChiffresDUnJour): JourDuPoint {
  const s = soireesDuJour(c)
  const salons: { espace: string; nouveau: boolean }[] = []
  for (const soiree of c.soirees ?? []) {
    if (!salons.some(x => x.espace === soiree.espace)) salons.push({ espace: soiree.espace, nouveau: c.nouveauxSalons?.includes(soiree.espace) ?? false })
  }
  return {
    jour,
    joueurs: c.joueurs,
    parties: MODES_DU_QG.reduce((t, m) => t + (c.parties?.[m] ?? 0), 0),
    profils: c.profils,
    semaine: c.semaine,
    nes: c.nouveauxProfils,
    nesEnSoiree: nesEnSoiree(c),
    lendemain: c.lendemain ?? null,
    soirees: s && { nombre: s.soirees, invites: s.invites, avecProfil: s.avecProfil, salons },
  }
}

/** Un incident qui a couru pendant la veille (`qg_incidents`). */
export interface IncidentDuPoint {
  regle: CleDeRegle
  debut: number
  fin: number | null
}

/** Ce que le serveur réunit pour le point : la mémoire de la veille et de ses semaines, ses incidents, le nom de ses salons. */
export interface EntreeDuPoint {
  /** Le jour que le point raconte : hier. */
  hier: string
  /** Les jours finis que la mémoire sait, jusqu'à hier (`JOURS_DU_POINT` au plus). */
  jours: JourDuPoint[]
  incidents: IncidentDuPoint[]
  /** Le nom de chaque salon qui a joué hier, pour la page seulement. */
  salons: Record<string, string>
}

/** Ce que le poste de commande demande (`GET /api/admin/qg/hier`) : le réglage, et la veille si la mémoire la sait déjà. */
export interface HierDuQg {
  maintenant: number
  point: PointRegle
  /** Null tant que la mémoire n'a pas écrit la veille : le point le fait à son heure, la page des joueurs à sa visite. */
  entree: EntreeDuPoint | null
}

// ── Ce qu'il dit ────────────────────────────────────────────────────────────

export type CleDUnChiffre = 'joueurs' | 'actifs' | 'nes' | 'soirees' | 'invites'

/** Un chiffre du point : sa valeur, son habitude et l'écart, et ce qu'il dit de plus. */
export interface ChiffreDuPoint {
  cle: CleDUnChiffre
  nom: string
  valeur: number
  /** La moyenne des jours — ou des semaines — d'avant, arrondie ; null sans rien à comparer. */
  habituel: number | null
  ecart: EcartALHabitude | null
  detail: string | null
}

export interface PointDuMatin {
  jour: string
  /** « mardi 3 novembre ». */
  date: string
  /** Ce qui s'écarte le plus de l'habitude, en une phrase ; null sans habitude à comparer. */
  phrase: string | null
  chiffres: ChiffreDuPoint[]
  /** Les salons d'hier, chacun nommé, le nouveau et celui qui revient. */
  animateurs: { nom: string; nouveau: boolean }[]
  incidents: { nom: string; gravite: Gravite; debut: number; dureeMs: number | null }[]
  /** Ce qui attend un geste ; null, on ne le sait pas. */
  aTraiter: number | null
  /** Le lundi : la semaine finie, face aux quatre d'avant. */
  semaine: { du: string; chiffres: ChiffreDuPoint[] } | null
  notification: { titre: string; corps: string }
}

/** « 1 soirée », « 3 soirées », « aucune soirée ». */
function combien(n: number, un: string, des: string, aucun: string): string {
  if (n === 0) return aucun
  return n === 1 ? `1 ${un}` : `${formatNumber(n)} ${des}`
}

const MOTS: Record<CleDUnChiffre, { nom: string; un: string; des: string; aucun: string }> = {
  joueurs: { nom: 'Joueurs', un: 'joueur', des: 'joueurs', aucun: 'aucun joueur' },
  actifs: { nom: 'Profils actifs', un: 'profil actif', des: 'profils actifs', aucun: 'aucun profil actif' },
  nes: { nom: 'Profils nés', un: 'profil né', des: 'profils nés', aucun: 'aucun profil né' },
  soirees: { nom: 'Soirées', un: 'soirée', des: 'soirées', aucun: 'aucune soirée' },
  invites: { nom: 'Invités', un: 'invité', des: 'invités', aucun: 'aucun invité' },
}

const moyenne = (valeurs: readonly number[]): number | null => (valeurs.length === 0 ? null : valeurs.reduce((t, v) => t + v, 0) / valeurs.length)

function chiffre(cle: CleDUnChiffre, valeur: number, d: readonly number[], detail: string | null = null): ChiffreDuPoint {
  const m = moyenne(d)
  const habituel = m === null ? null : Math.round(m)
  return { cle, nom: MOTS[cle].nom, valeur, habituel, ecart: habituel === null ? null : ecartALHabitude({ aujourdhui: valeur, habituel, parJour: [] }), detail }
}

/** « (+12 %) », « (−5 %) », « (4 d'habitude) » : l'écart en quelques signes, pour la notification ; rien quand c'est comme d'habitude. */
function ecartCourt(e: EcartALHabitude | null): string {
  if (!e || e.texte === 'comme d’habitude') return ''
  if (e.sens === 'plus') return ` (+${e.texte})`
  if (e.sens === 'moins') return ` (−${e.texte})`
  return ` (${e.texte})`
}

/**
 * Un écart se dit s'il sort du bruit : un compte suit à peu près une loi de
 * Poisson, sa variance vaut sa moyenne — trois soirées contre une d'habitude
 * s'écartent plus que trente et un joueurs contre vingt-huit. L'écart se
 * mesure en écarts types de l'habitude, et la phrase ne parle qu'au-delà de
 * deux.
 */
export const ECART_QUI_SE_DIT = 2

const ecartReduit = (valeur: number, habitude: number) => (valeur - habitude) / Math.sqrt(Math.max(habitude, 1))

/** Une majuscule en tête de phrase. */
const enTete = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function phraseDeLEcart(cle: CleDUnChiffre | 'parties', valeur: number, habitude: number): string {
  const mots = cle === 'parties' ? { un: 'participation', des: 'participations', aucun: 'aucune participation' } : MOTS[cle]
  const dit = enTete(combien(valeur, mots.un, mots.des, mots.aucun))
  const arrondie = Math.round(habitude)
  if (arrondie >= HABITUDE_EN_POURCENTS) {
    const pourcents = Math.round(((valeur - habitude) / habitude) * 100)
    return `${dit} : ${formatNumber(Math.abs(pourcents))} % de ${pourcents > 0 ? 'plus' : 'moins'} que d’habitude.`
  }
  return `${dit}, quand ${arrondie === 0 ? 'il n’y en a guère' : `il y en a ${formatNumber(arrondie)}`} d’habitude.`
}

const estUnDimanche = (jour: string) => {
  const [a, m, j] = jour.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, j)).getUTCDay() === 0
}

/** Les semaines finies qui finissent ce dimanche et les quatre d'avant, chacune ses sept jours — une semaine incomplète ne compte pas. */
function semainesDuLundi(dimanche: string, parJour: ReadonlyMap<string, JourDuPoint>): (JourDuPoint[] | null)[] {
  return [0, 1, 2, 3, 4].map(k => {
    const jours = Array.from({ length: 7 }, (_, i) => parJour.get(jourAvant(dimanche, 7 * k + 6 - i)))
    return jours.every((j): j is JourDuPoint => j !== undefined) ? jours : null
  })
}

/** La somme d'un nombre sur une semaine ; null si un de ses jours ne le dit pas (une ligne d'avant). */
function sommeDeLaSemaine(jours: readonly JourDuPoint[], lire: (j: JourDuPoint) => number | null): number | null {
  let t = 0
  for (const j of jours) {
    const v = lire(j)
    if (v === null) return null
    t += v
  }
  return t
}

/**
 * Le point du matin d'un jour : ses chiffres face à son habitude — la moyenne
 * des sept jours d'avant que la mémoire sait (`JOURS_DE_L_HABITUDE`), comme
 * « aujourd'hui » au poste de commande —, ses nouveaux et leur lendemain, ses
 * soirées et leurs salons, ses incidents, ce qui attend ; le lundi, la semaine
 * face aux quatre d'avant ; et la notification. Null si la mémoire ne sait pas
 * la veille.
 */
export function pointDuMatin({ hier, jours, incidents, salons, aTraiter }: EntreeDuPoint & { aTraiter: number | null }): PointDuMatin | null {
  const parJour = new Map(jours.map(j => [j.jour, j]))
  const j = parJour.get(hier)
  if (!j) return null
  const avant = Array.from({ length: JOURS_DE_L_HABITUDE }, (_, k) => parJour.get(jourAvant(hier, k + 1))).filter((x): x is JourDuPoint => x !== undefined)
  const veille = parJour.get(jourAvant(hier))

  const lendemain =
    j.lendemain !== null && veille && veille.nes > 0
      ? `${formatNumber(j.lendemain)} sur ${formatNumber(veille.nes)} né${veille.nes > 1 ? 's' : ''} la veille ${j.lendemain > 1 ? 'ont' : 'a'} rejoué`
      : null
  const detailDesNes = [j.nesEnSoiree ? `dont ${formatNumber(j.nesEnSoiree)} en soirée` : null, lendemain].filter(Boolean).join(' · ') || null
  const s = j.soirees
  const chiffres: ChiffreDuPoint[] = [
    // Les joueurs du poste de commande : les profils, et chaque invité sans profil une fois par soirée.
    chiffre(
      'joueurs',
      j.joueurs,
      avant.map(x => x.joueurs),
      j.joueurs > j.profils ? `dont ${combien(j.profils, 'profil', 'profils', 'aucun profil')}` : null,
    ),
    chiffre(
      'nes',
      j.nes,
      avant.map(x => x.nes),
      detailDesNes,
    ),
  ]
  if (s) {
    const nouveaux = s.salons.filter(x => x.nouveau).length
    chiffres.push(
      chiffre(
        'soirees',
        s.nombre,
        avant.flatMap(x => (x.soirees ? [x.soirees.nombre] : [])),
        s.nombre === 0 ? null : `${combien(s.salons.length, 'animateur', 'animateurs', 'aucun animateur')}${nouveaux ? `, dont ${nouveaux > 1 ? `${formatNumber(nouveaux)} nouveaux` : 'un nouveau'}` : ''}`,
      ),
      chiffre(
        'invites',
        s.invites,
        avant.flatMap(x => (x.soirees ? [x.soirees.invites] : [])),
        s.invites === 0 ? null : `${formatNumber(s.avecProfil)} avec un profil, ${formatNumber(s.invites - s.avecProfil)} sans`,
      ),
    )
  }

  // Ce qui s'écarte le plus : les quatre chiffres et les participations, en écarts types de leur habitude.
  let phrase: string | null = null
  if (avant.length > 0) {
    const candidats: { cle: CleDUnChiffre | 'parties'; valeur: number; habitude: number | null }[] = [
      ...chiffres.map(c => ({ cle: c.cle, valeur: c.valeur, habitude: moyenne(avantDe(c.cle, avant)) })),
      { cle: 'parties', valeur: j.parties, habitude: moyenne(avant.map(x => x.parties)) },
    ]
    let le: { cle: CleDUnChiffre | 'parties'; valeur: number; habitude: number; z: number } | null = null
    for (const c of candidats) {
      if (c.habitude === null) continue
      const z = Math.abs(ecartReduit(c.valeur, c.habitude))
      if (!le || z > le.z) le = { cle: c.cle, valeur: c.valeur, habitude: c.habitude, z }
    }
    phrase = le && le.z >= ECART_QUI_SE_DIT ? phraseDeLEcart(le.cle, le.valeur, le.habitude) : 'Une journée comme les autres.'
  }

  const animateurs = (s?.salons ?? []).map(x => ({ nom: salons[x.espace] ?? 'Un salon', nouveau: x.nouveau }))
  const lesIncidents = [...incidents]
    .sort((a, b) => a.debut - b.debut)
    .map(i => ({ nom: REGLE[i.regle].nom, gravite: REGLE[i.regle].gravite, debut: i.debut, dureeMs: i.fin === null ? null : i.fin - i.debut }))

  // Le lundi : la semaine finie hier, face aux quatre d'avant — complètes seulement.
  let semaine: PointDuMatin['semaine'] = null
  if (estUnDimanche(hier)) {
    const [cette, ...dAvant] = semainesDuLundi(hier, parJour)
    if (cette) {
      const finies = dAvant.filter((x): x is JourDuPoint[] => x !== null)
      const sommes = (lire: (x: JourDuPoint) => number | null) => finies.flatMap(w => {
        const t = sommeDeLaSemaine(w, lire)
        return t === null ? [] : [t]
      })
      const lesChiffres = [
        // Les profils de la semaine, chacun une fois : la ligne du dimanche les compte sur ses sept jours.
        chiffre('actifs', cette[6].semaine, finies.map(w => w[6].semaine)),
        chiffre('nes', sommeDeLaSemaine(cette, x => x.nes) ?? 0, sommes(x => x.nes)),
      ]
      const soireesDeLaSemaine = sommeDeLaSemaine(cette, x => x.soirees?.nombre ?? null)
      const invitesDeLaSemaine = sommeDeLaSemaine(cette, x => x.soirees?.invites ?? null)
      if (soireesDeLaSemaine !== null) lesChiffres.push(chiffre('soirees', soireesDeLaSemaine, sommes(x => x.soirees?.nombre ?? null)))
      if (invitesDeLaSemaine !== null) lesChiffres.push(chiffre('invites', invitesDeLaSemaine, sommes(x => x.soirees?.invites ?? null)))
      semaine = { du: jourAvant(hier, 6), chiffres: lesChiffres }
    }
  }

  const point: Omit<PointDuMatin, 'notification'> = {
    jour: hier,
    date: jourEnToutesLettres(hier),
    phrase,
    chiffres,
    animateurs,
    incidents: lesIncidents,
    aTraiter,
    semaine,
  }
  return { ...point, notification: notificationDuPoint(point) }
}

/** Les valeurs d'un chiffre sur les jours d'avant : les soirées et leurs invités, sur ceux qui les disent seulement. */
function avantDe(cle: CleDUnChiffre, avant: readonly JourDuPoint[]): number[] {
  switch (cle) {
    case 'joueurs':
      return avant.map(x => x.joueurs)
    case 'actifs':
      return avant.map(x => x.profils)
    case 'nes':
      return avant.map(x => x.nes)
    case 'soirees':
      return avant.flatMap(x => (x.soirees ? [x.soirees.nombre] : []))
    case 'invites':
      return avant.flatMap(x => (x.soirees ? [x.soirees.invites] : []))
  }
}

/**
 * Le texte de la notification, des nombres seulement : « Hier : 31 joueurs
 * (+12 %), 3 profils nés, 1 soirée, 12 invités · 2 choses à traiter » ; le
 * lundi, « La semaine : 85 profils actifs (+8 %), … ». Ni un prénom, ni un
 * salon.
 */
function notificationDuPoint(p: Omit<PointDuMatin, 'notification'>): { titre: string; corps: string } {
  const dire = (cs: readonly ChiffreDuPoint[], premier: CleDUnChiffre) => {
    const lire = (cle: CleDUnChiffre) => cs.find(c => c.cle === cle)
    const nombre = (c: ChiffreDuPoint | undefined) => c && combien(c.valeur, MOTS[c.cle].un, MOTS[c.cle].des, MOTS[c.cle].aucun)
    const tete = lire(premier)
    const soirees = lire('soirees')
    // Les invités d'une journée sans soirée n'ont rien à dire de plus qu'« aucune soirée ».
    return [tete && `${nombre(tete)}${ecartCourt(tete.ecart)}`, nombre(lire('nes')), nombre(soirees), soirees && soirees.valeur > 0 ? nombre(lire('invites')) : null]
      .filter(Boolean)
      .join(', ')
  }
  const aTraiter = p.aTraiter === null ? null : p.aTraiter === 0 ? 'rien à traiter' : combien(p.aTraiter, 'chose à traiter', 'choses à traiter', '')
  // Le lundi parle de la semaine ; les incidents de la veille restent au bandeau.
  if (p.semaine) return { titre: 'Le point du lundi', corps: espacesFines([`La semaine : ${dire(p.semaine.chiffres, 'actifs')}`, aTraiter].filter(Boolean).join(' · ')) }
  const incidents = p.incidents.length > 0 ? combien(p.incidents.length, 'incident', 'incidents', '') : null
  return { titre: 'Le point du matin', corps: espacesFines([`Hier : ${dire(p.chiffres, 'joueurs')}`, incidents, aTraiter].filter(Boolean).join(' · ')) }
}

/** La notification du point, à son téléphone : elle ouvre « Hier, en bref », en tête du poste de commande. */
export const messageDuPoint = (p: PointDuMatin): MessageDuQg => ({ titre: p.notification.titre, corps: p.notification.corps, url: '/admin#hier', tag: 'qg-point' })
