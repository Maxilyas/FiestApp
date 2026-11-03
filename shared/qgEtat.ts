// L'état du service, en voyants, en tête du poste de commande du QG 2 (la
// proposition du 3 novembre 2026, `retours/2026-11-03/le-qg.md`) : chaque
// organe du serveur dit s'il va bien, d'un mot et d'un chiffre, ce qui ne va
// pas passant devant — le regard tombe sur le rouge, pas sur la sixième case.
// Lu dans le direct (la mémoire du processus, relue toutes les dix secondes)
// et dans les alertes de la vue d'ensemble (`alertesDuServeur`) : rien de plus
// à lire, ni dans Turso ni ailleurs.

import { capitale, lesModes } from './pannes'
import {
  MEMOIRE_DE_L_HEBERGEUR_MO,
  MEMOIRE_PLAFOND_MO,
  PART_DU_QUOTA_EN_ROUGE,
  PROCESSEUR_DE_L_HEBERGEUR_PCT,
  tempsDeReponse,
  type AlertesDuServeur,
} from './santeDuServeur'
import { dureeEcrite, heureEcrite, quandEcrit, type DirectDuQg } from './qg'
import { formatNumber } from './typographie'

/** Un voyant : au vert, à surveiller, sérieux, critique — ou rien encore à lire. */
export type EtatDUnVoyant = 'ok' | 'veille' | 'serieux' | 'critique' | 'inconnu'

export interface VoyantDuService {
  cle: 'modes' | 'ressenti' | 'erreurs' | 'arret' | 'base' | 'memoire' | 'processeur' | 'miroir' | 'quota' | 'version'
  nom: string
  etat: EtatDUnVoyant
  /** Son chiffre, en une ligne courte : « 238 ms au 95ᵉ centile ». */
  detail: string
  /** La page qui en dit plus. */
  ecran: 'serveur' | 'erreurs' | null
}

/**
 * Au-delà, ce qu'un joueur attend se voit : huit dixièmes de seconde au
 * 95ᵉ centile de toutes les routes d'API sur la minute — le seuil de la règle
 * « ressenti dégradé » que la proposition ajoute aux alertes.
 */
export const RESSENTI_LENT_MS = 800

const GRAVITE: Record<EtatDUnVoyant, number> = { critique: 0, serieux: 1, veille: 2, ok: 3, inconnu: 4 }

/**
 * Les voyants du service, ce qui ne va pas d'abord, puis dans leur ordre :
 * les modes de jeu, ce qu'un joueur attend, les erreurs, l'arrêt net, Turso,
 * la mémoire, le processeur, le miroir, le quota, la version qui tourne.
 * Sans direct ni alertes encore, chaque voyant attend (`inconnu`).
 */
export function etatDuService(
  direct: Pick<DirectDuQg, 'serveur' | 'miroir' | 'maintenant'> | null,
  alertes: AlertesDuServeur | null,
): VoyantDuService[] {
  const s = direct?.serveur ?? null
  const attend = (cle: VoyantDuService['cle'], nom: string, ecran: VoyantDuService['ecran']): VoyantDuService => ({ cle, nom, etat: 'inconnu', detail: '…', ecran })
  const voyants: VoyantDuService[] = []

  const pannes = alertes?.pannes ?? []
  voyants.push(
    !alertes
      ? attend('modes', 'Modes de jeu', 'erreurs')
      : pannes.length > 0
        ? { cle: 'modes', nom: 'Modes de jeu', etat: 'critique', detail: capitale(`${lesModes(pannes.map(p => p.mode))} en panne`), ecran: 'erreurs' }
        : { cle: 'modes', nom: 'Modes de jeu', etat: 'ok', detail: 'tous répondent', ecran: 'erreurs' },
  )

  const p95 = s?.routesP95Ms
  voyants.push(
    !s
      ? attend('ressenti', 'Ce qu’un joueur attend', 'serveur')
      : p95 == null
        ? { cle: 'ressenti', nom: 'Ce qu’un joueur attend', etat: 'ok', detail: 'aucun appel cette minute', ecran: 'serveur' }
        : {
            cle: 'ressenti',
            nom: 'Ce qu’un joueur attend',
            etat: p95 >= RESSENTI_LENT_MS ? 'veille' : 'ok',
            detail: `${tempsDeReponse(p95)} au 95ᵉ centile${s.routesParMin ? ` · ${formatNumber(s.routesParMin)} appels` : ''}`,
            ecran: 'serveur',
          },
  )

  voyants.push(
    !alertes
      ? attend('erreurs', 'Erreurs serveur', 'erreurs')
      : alertes.erreurs
        ? { cle: 'erreurs', nom: 'Erreurs serveur', etat: 'critique', detail: `${formatNumber(alertes.erreurs.n)} à regarder depuis ${heureEcrite(alertes.erreurs.depuis)}`, ecran: 'erreurs' }
        : { cle: 'erreurs', nom: 'Erreurs serveur', etat: 'ok', detail: 'aucune à regarder', ecran: 'erreurs' },
  )

  voyants.push(
    !alertes
      ? attend('arret', 'Arrêts nets', 'serveur')
      : alertes.arretNet
        ? { cle: 'arret', nom: 'Arrêt net', etat: 'serieux', detail: quandEcrit(alertes.arretNet.vers, direct?.maintenant ?? alertes.arretNet.vers), ecran: 'serveur' }
        : { cle: 'arret', nom: 'Arrêts nets', etat: 'ok', detail: 'aucun en 24 heures', ecran: 'serveur' },
  )

  const base = s?.baseP95Ms
  voyants.push(
    !s
      ? attend('base', 'Turso', 'serveur')
      : alertes?.tursoLent
        ? { cle: 'base', nom: 'Turso', etat: 'veille', detail: `${tempsDeReponse(alertes.tursoLent.p95)} au 95ᵉ centile`, ecran: 'serveur' }
        : { cle: 'base', nom: 'Turso', etat: 'ok', detail: base == null ? 'aucun aller-retour cette minute' : `${tempsDeReponse(base)} au 95ᵉ centile`, ecran: 'serveur' },
  )

  const memoire = s?.memoireMo ?? null
  voyants.push(
    !s || memoire === null
      ? attend('memoire', 'Mémoire', 'serveur')
      : {
          cle: 'memoire',
          nom: 'Mémoire',
          etat: memoire >= MEMOIRE_PLAFOND_MO ? 'critique' : 'ok',
          detail: `${formatNumber(memoire)} sur ${formatNumber(MEMOIRE_DE_L_HEBERGEUR_MO)} Mo`,
          ecran: 'serveur',
        },
  )

  const cpu = s?.cpuPct ?? null
  voyants.push(
    !s || cpu === null
      ? attend('processeur', 'Processeur', 'serveur')
      : {
          cle: 'processeur',
          nom: 'Processeur',
          etat: cpu >= PROCESSEUR_DE_L_HEBERGEUR_PCT ? 'veille' : 'ok',
          detail: `${formatNumber(cpu)} % sur ${formatNumber(PROCESSEUR_DE_L_HEBERGEUR_PCT)} % d’un cœur`,
          ecran: 'serveur',
        },
  )

  const miroir = direct?.miroir ?? null
  voyants.push(
    !direct
      ? attend('miroir', 'Miroir', null)
      : !miroir
        ? { cle: 'miroir', nom: 'Miroir', etat: 'ok', detail: 'pas de base distante', ecran: null }
        : miroir.enEchecDepuis !== null
          ? { cle: 'miroir', nom: 'Miroir', etat: 'critique', detail: `Turso en échec depuis ${heureEcrite(Date.parse(miroir.enEchecDepuis))}`, ecran: null }
          : miroir.espacesEnRetard > 0
            ? { cle: 'miroir', nom: 'Miroir', etat: 'serieux', detail: `${formatNumber(miroir.espacesEnRetard)} salon${miroir.espacesEnRetard > 1 ? 's' : ''} en retard`, ecran: null }
            : { cle: 'miroir', nom: 'Miroir', etat: 'ok', detail: miroir.enAttente > 0 ? `${formatNumber(miroir.enAttente)} écriture${miroir.enAttente > 1 ? 's' : ''} en attente` : 'à jour', ecran: null },
  )

  const quota = alertes?.quota ?? null
  voyants.push(
    !alertes
      ? attend('quota', 'Quota de Turso', 'serveur')
      : quota
        ? { cle: 'quota', nom: 'Quota de Turso', etat: quota.part >= PART_DU_QUOTA_EN_ROUGE ? 'critique' : 'veille', detail: `${formatNumber(quota.part)} % du mois au rythme de la semaine`, ecran: 'serveur' }
        : { cle: 'quota', nom: 'Quota de Turso', etat: 'ok', detail: 'sous la moitié du mois', ecran: 'serveur' },
  )

  voyants.push(
    !s
      ? attend('version', 'Version', 'serveur')
      : { cle: 'version', nom: s.version ? `Version ${s.version.slice(0, 7)}` : 'Version', etat: 'ok', detail: `en marche depuis ${dureeEcrite(s.enMarcheDepuisS * 1000)}`, ecran: 'serveur' },
  )

  return voyants.map((v, i) => [v, i] as const).sort(([a, i], [b, j]) => GRAVITE[a.etat] - GRAVITE[b.etat] || i - j).map(([v]) => v)
}

/** La phrase en tête des voyants : « Tout est au vert », « Deux points à regarder ». */
export function phraseDeLEtat(voyants: readonly VoyantDuService[]): { aRegarder: number; phrase: string } {
  const aRegarder = voyants.filter(v => v.etat === 'critique' || v.etat === 'serieux' || v.etat === 'veille').length
  if (voyants.every(v => v.etat === 'inconnu')) return { aRegarder: 0, phrase: 'Le serveur répond…' }
  if (aRegarder === 0) return { aRegarder, phrase: 'Tout est au vert' }
  const nombres = ['', 'Un point', 'Deux points', 'Trois points', 'Quatre points', 'Cinq points']
  return { aRegarder, phrase: `${nombres[aRegarder] ?? `${formatNumber(aRegarder)} points`} à regarder` }
}
