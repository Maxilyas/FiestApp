import { espacesFines } from './typographie'

/**
 * Les pannes d'un mode de jeu, que le serveur guette lui-même (`core/veille.ts`)
 * et dit au téléphone de l'administrateur — le souhait du propriétaire du
 * 19 octobre 2026, le jour où le quiz du jour et les défis ne s'ouvraient plus
 * en production sans que rien ne le dise : « une notification sur mon
 * téléphone quand une erreur tombe — importante, c'est-à-dire
 * l'indisponibilité d'un mode de jeu ».
 *
 * Une erreur seule n'est pas une panne : un téléphone qui perd le réseau, un
 * hoquet de Turso en font tomber chaque jour. Une panne, c'est une route — ou
 * un message du temps réel — qui échoue plus souvent qu'elle ne réussit, sur
 * les dix dernières minutes, trois fois au moins : ce qu'un mode qui ne
 * s'ouvre plus fait à chacun de ceux qui essaient.
 */

export const MODES_SURVEILLES = ['jour', 'campagne', 'defi', 'duels', 'expedition', 'cabinet', 'soirees', 'boutique', 'accueil'] as const
export type ModeSurveille = (typeof MODES_SURVEILLES)[number]

/** Le nom d'un mode dans une phrase — « Panne : le quiz du jour ». */
export const NOM_DU_MODE_SURVEILLE: Record<ModeSurveille, string> = {
  jour: 'le quiz du jour',
  campagne: 'la campagne',
  defi: 'le défi de la semaine',
  duels: 'les duels',
  expedition: 'l’Expédition',
  cabinet: 'le Cabinet de curiosités',
  soirees: 'les soirées',
  boutique: 'la boutique',
  accueil: 'l’accueil et la connexion des profils',
}

/** Les minutes que la veille regarde : assez pour que trois joueurs aient essayé, assez peu pour prévenir vite. */
export const FENETRE_D_UNE_PANNE_MS = 10 * 60_000
/** Les échecs qu'il faut à une route, sur la fenêtre, pour être en panne — et pas moins que ses réussites. */
export const ECHECS_D_UNE_PANNE = 3
/** Un mode en panne est rétabli quand plus rien n'y a échoué depuis tout ce temps. */
export const RETABLI_APRES_MS = 15 * 60_000

/**
 * Le mode d'une source — une route d'API sous son modèle, un message du temps
 * réel —, ou null : ce qui n'est pas un mode de jeu (le QG, un compte
 * d'animateur, la routine du matin qui remplit la réserve, le rappel du
 * soir, la base de la campagne qu'on dépose). Les réponses d'une série
 * passent par la même porte, qu'elle soit de la campagne, du défi ou d'un
 * duel (`/api/campagne/serie/:id/reponse`) : leur panne se dit sous la
 * campagne, et sa route, que la notification cite, dit laquelle des portes.
 * « Ouvrir le salon » mène aux soirées, les missions et le coffre à l'accueil.
 */
export function modeDeLaSource(source: string): ModeSurveille | null {
  if (source.startsWith('socket ')) return 'soirees'
  const chemin = source.slice(source.indexOf(' ') + 1)
  if (chemin.startsWith('/api/jour')) return /^\/api\/jour\/(rappel|reserve)/.test(chemin) ? null : 'jour'
  if (chemin.startsWith('/api/campagne/defi')) return 'defi'
  if (/^\/api\/campagne\/(duel|rencontre|amis)/.test(chemin)) return 'duels'
  if (chemin.startsWith('/api/campagne')) return chemin.startsWith('/api/campagne/base') ? null : 'campagne'
  if (chemin.startsWith('/api/expedition')) return 'expedition'
  if (chemin.startsWith('/api/cabinet')) return 'cabinet'
  if (/^\/api\/joueur\/(themes|compagnons|fonds)(\/|$)/.test(chemin)) return 'boutique'
  if (/^\/api\/joueur\/(moi|connexion|inscription|missions|coffre)$/.test(chemin)) return 'accueil'
  if (/^\/api\/joueur\/(salon|espace)$/.test(chemin)) return 'soirees'
  return null
}

/** Une route — ou un message du temps réel — sur la fenêtre : ce qui a réussi, ce qui a échoué. */
export interface BilanDUneSource {
  source: string
  reussies: number
  echecs: number
}

/** Une route en panne : elle échoue au moins trois fois, et plus souvent qu'elle ne réussit. */
export const enPanne = (b: BilanDUneSource) => b.echecs >= ECHECS_D_UNE_PANNE && b.echecs >= b.reussies

/** Un mode en panne, tel que le QG le montre et que la notification le dit. */
export interface PanneDUnMode {
  mode: ModeSurveille
  /** Depuis quand la veille le voit en panne. */
  depuis: number
  /** Ses échecs, toutes routes du mode ensemble : ceux de la fenêtre qui l'a vu tomber, puis chacun depuis. */
  echecs: number
  /** Le plus récent. */
  dernierEchec: number
  /** La route qui échouait le plus quand il est tombé. */
  source: string
}

/** « le quiz du jour », « le quiz du jour et les duels », « le quiz du jour, la campagne et les duels ». */
export function lesModes(modes: readonly ModeSurveille[]): string {
  const noms = modes.map(m => NOM_DU_MODE_SURVEILLE[m])
  return noms.length <= 1 ? (noms[0] ?? '') : `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)}`
}

/** La majuscule d'une phrase qui commence par un nom de mode. */
export const capitale = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1)

/** Ce qu'une notification dit, en un titre et une phrase, et la page que son toucher ouvre. */
export interface MessageDuQg {
  titre: string
  corps: string
  url: string
  /** Une seule à la fois : la suivante remplace celle qu'on n'a pas lue. */
  tag: string
}

/**
 * La notification d'une panne : les modes, ce qui échoue le plus, et la page
 * des erreurs au toucher. Jamais un prénom, ni un message d'erreur : elle se
 * lit sur l'écran verrouillé, par qui tient le téléphone. Sa typographie est
 * posée ici : aucune page ne l'affiche.
 */
export function messageDePanne(pannes: readonly PanneDUnMode[]): MessageDuQg {
  const echecs = pannes.reduce((n, p) => n + p.echecs, 0)
  const pire = [...pannes].sort((a, b) => b.echecs - a.echecs)[0]
  return {
    titre: espacesFines(`Panne : ${lesModes(pannes.map(p => p.mode))}`),
    corps: espacesFines(`${echecs} échec${echecs > 1 ? 's' : ''} en dix minutes${pire ? ` (${pire.source})` : ''}. Touche pour voir les erreurs.`),
    url: '/admin#erreurs',
    tag: 'qg-panne',
  }
}

/**
 * La notification d'un retour : ça répond de nouveau, et plus un échec depuis
 * un quart d'heure. Elle remplace celle de la panne, sous la même étiquette.
 */
export function messageDeRetour(modes: readonly ModeSurveille[]): MessageDuQg {
  return {
    titre: espacesFines(`Rétabli : ${lesModes(modes)}`),
    corps: 'Ça répond de nouveau, sans un échec depuis un quart d’heure.',
    url: '/admin#erreurs',
    tag: 'qg-panne',
  }
}

// ── Les téléphones prévenus ───────────────────────────────────────────────

/** Les téléphones que l'administrateur fait prévenir, au plus : les plus récemment allumés restent. */
export const TELEPHONES_PREVENUS_MAX = 5

/**
 * L'empreinte d'un téléphone, les seize premiers chiffres du SHA-256 de son
 * adresse d'abonnement : la page s'y reconnaît, et en retire un, sans que
 * l'adresse — qui suffit à le faire sonner — quitte jamais le serveur.
 */
export const EMPREINTE_D_UN_TELEPHONE = 16

/** Un téléphone qui sonnera à la panne d'un mode, tel que le QG le montre. */
export interface TelephoneDuQg {
  empreinte: string
  /** Le service de push de son navigateur, en clair (`serviceDuTelephone`). */
  service: string
  /** Quand ses alertes ont été allumées. */
  depuis: number
}

/** Ce qu'un envoi a fait : les téléphones qui ont sonné, ceux en échec, ceux que leur service a dits désabonnés — oubliés. */
export interface BilanDUneAlerte {
  envoyes: number
  echecs: number
  retires: number
}

/** Ce que l'adresse d'un abonnement dit du téléphone : le service de push de son navigateur. */
export function serviceDuTelephone(hote: string): string {
  const chez = (domaine: string) => hote === domaine || hote.endsWith(`.${domaine}`)
  if (chez('fcm.googleapis.com') || chez('android.googleapis.com')) return 'Chrome ou Android'
  if (chez('push.apple.com')) return 'iPhone ou Mac'
  if (chez('push.services.mozilla.com')) return 'Firefox'
  if (chez('notify.windows.com')) return 'Edge'
  return 'un navigateur'
}

/** La notification d'essai, au toucher de « M'envoyer un essai » : ce téléphone sonnera. */
export const MESSAGE_D_ESSAI: MessageDuQg = {
  titre: 'Le QG te préviendra ici',
  corps: 'Quand un mode de jeu tombera en panne — le quiz du jour, la campagne, les duels… —, ce téléphone sonnera.',
  url: '/admin#erreurs',
  tag: 'qg-essai',
}
