// L'état du service, en voyants, en tête du poste de commande du QG 2 (la
// proposition du 3 novembre 2026, `retours/2026-11-03/le-qg.md`) : chaque
// organe du serveur dit s'il va bien, d'un mot et d'un chiffre, ce qui ne va
// pas passant devant — le regard tombe sur le rouge, pas sur la sixième case.
// Lu dans le direct (la mémoire du processus, relue toutes les dix secondes)
// et dans les alertes de la vue d'ensemble (`alertesDuServeur`) : rien de plus
// à lire, ni dans Turso ni ailleurs. Un voyant qui a sa règle d'alerte en
// prend la gravité et le seuil réglé (`graviteDe`, `shared/qgAlertes.ts`) : la
// revue d'ergonomie du 4 novembre 2026 lisait la mémoire critique ici, sérieuse
// sur la page des alertes.

import { capitale, lesModes } from './pannes'
import { MEMOIRE_DE_L_HEBERGEUR_MO, PROCESSEUR_DE_L_HEBERGEUR_PCT, tempsDeReponse, type AlertesDuServeur } from './santeDuServeur'
import { dureeEcrite, heureEcrite, quandEcrit, type DirectDuQg } from './qg'
import { APPELS_POUR_LE_RESSENTI, REGLE, graviteDe, graviteOuverte } from './qgAlertes'
import { formatNumber } from './typographie'

/** Un voyant : au vert, à surveiller, sérieux, critique — ou rien encore à lire. */
export type EtatDUnVoyant = 'ok' | 'veille' | 'serieux' | 'critique' | 'inconnu'

export interface VoyantDuService {
  cle: 'modes' | 'ressenti' | 'erreurs' | 'arret' | 'base' | 'memoire' | 'processeur' | 'miroir' | 'quota' | 'version'
  nom: string
  etat: EtatDUnVoyant
  /** Son chiffre, en une ligne courte : « 238 ms pour 19 appels sur 20 ». */
  detail: string
  /** La page où l'on agit : Turso, son quota et la sauvegarde des soirées mènent à « Base et miroir ». */
  ecran: 'serveur' | 'erreurs' | 'base' | 'direct' | null
}

const GRAVITE: Record<EtatDUnVoyant, number> = { critique: 0, serieux: 1, veille: 2, ok: 3, inconnu: 4 }

/**
 * Les voyants du service, ce qui ne va pas d'abord, puis dans leur ordre :
 * les modes de jeu, ce qu'un joueur attend, les erreurs, l'arrêt net, Turso,
 * la mémoire, le processeur, la sauvegarde des soirées, le quota, la version
 * qui tourne. Sans direct ni alertes encore, chaque voyant attend (`inconnu`).
 */
export function etatDuService(
  direct: Pick<DirectDuQg, 'serveur' | 'miroir' | 'maintenant' | 'seuils'> | null,
  alertes: AlertesDuServeur | null,
): VoyantDuService[] {
  const s = direct?.serveur ?? null
  const seuils = direct?.seuils ?? {}
  const attend = (cle: VoyantDuService['cle'], nom: string, ecran: VoyantDuService['ecran']): VoyantDuService => ({ cle, nom, etat: 'inconnu', detail: '…', ecran })
  const voyants: VoyantDuService[] = []

  const pannes = alertes?.pannes ?? []
  voyants.push(
    !alertes
      ? attend('modes', 'Modes de jeu', 'erreurs')
      : pannes.length > 0
        ? { cle: 'modes', nom: 'Modes de jeu', etat: REGLE.panne.gravite, detail: capitale(`${lesModes(pannes.map(p => p.mode))} en panne`), ecran: 'erreurs' }
        : { cle: 'modes', nom: 'Modes de jeu', etat: 'ok', detail: 'tous répondent', ecran: 'erreurs' },
  )

  // Jugé comme sa règle : sur vingt appels au moins — trois appels lents d'une minute creuse ne disent rien.
  const p95 = s?.routesP95Ms
  voyants.push(
    !s
      ? attend('ressenti', 'Ce qu’un joueur attend', 'direct')
      : p95 == null
        ? { cle: 'ressenti', nom: 'Ce qu’un joueur attend', etat: 'ok', detail: 'aucun appel cette minute', ecran: 'direct' }
        : {
            cle: 'ressenti',
            nom: 'Ce qu’un joueur attend',
            etat: ((s.routesParMin ?? 0) >= APPELS_POUR_LE_RESSENTI && graviteDe('ressenti', p95, seuils)) || 'ok',
            detail: `${tempsDeReponse(p95)} pour 19 appels sur 20${s.routesParMin ? ` · ${formatNumber(s.routesParMin)} cette minute` : ''}`,
            ecran: 'direct',
          },
  )

  voyants.push(
    !alertes
      ? attend('erreurs', 'Erreurs serveur', 'erreurs')
      : alertes.erreurs
        ? { cle: 'erreurs', nom: 'Erreurs serveur', etat: REGLE.erreurs.gravite, detail: `${formatNumber(alertes.erreurs.n)} à regarder depuis ${heureEcrite(alertes.erreurs.depuis)}`, ecran: 'erreurs' }
        : { cle: 'erreurs', nom: 'Erreurs serveur', etat: 'ok', detail: 'aucune à regarder', ecran: 'erreurs' },
  )

  voyants.push(
    !alertes
      ? attend('arret', 'Arrêts nets', 'serveur')
      : alertes.arretNet
        ? { cle: 'arret', nom: 'Arrêt net', etat: REGLE['arret-net'].gravite, detail: quandEcrit(alertes.arretNet.vers, direct?.maintenant ?? alertes.arretNet.vers), ecran: 'serveur' }
        : { cle: 'arret', nom: 'Arrêts nets', etat: 'ok', detail: 'aucun en 24 heures', ecran: 'serveur' },
  )

  const base = s?.baseP95Ms
  voyants.push(
    !s
      ? attend('base', 'Turso', 'base')
      : alertes?.tursoLent
        ? { cle: 'base', nom: 'Turso', etat: REGLE['turso-lent'].gravite, detail: `${tempsDeReponse(alertes.tursoLent.p95)} pour 19 allers-retours sur 20`, ecran: 'base' }
        : { cle: 'base', nom: 'Turso', etat: 'ok', detail: base == null ? 'aucun aller-retour cette minute' : `${tempsDeReponse(base)} pour 19 allers-retours sur 20`, ecran: 'base' },
  )

  const memoire = s?.memoireMo ?? null
  voyants.push(
    !s || memoire === null
      ? attend('memoire', 'Mémoire', 'serveur')
      : {
          cle: 'memoire',
          nom: 'Mémoire',
          etat: graviteDe('memoire', memoire, seuils) ?? 'ok',
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

  // Le miroir de chaque soirée dans Turso, dit pour ce qu'il garde : « Miroir » ne parlait qu'à qui l'avait écrit. Sa
  // règle le dit critique, Turso en échec comme un salon en retard — une soirée qui ne se sauvegarde plus.
  const miroir = direct?.miroir ?? null
  const SAUVEGARDE = 'Sauvegarde des soirées'
  voyants.push(
    !direct
      ? attend('miroir', SAUVEGARDE, 'base')
      : !miroir
        ? { cle: 'miroir', nom: SAUVEGARDE, etat: 'ok', detail: 'pas de base distante', ecran: 'base' }
        : miroir.enEchecDepuis !== null
          ? { cle: 'miroir', nom: SAUVEGARDE, etat: REGLE.miroir.gravite, detail: `Turso en échec depuis ${heureEcrite(Date.parse(miroir.enEchecDepuis))}`, ecran: 'base' }
          : miroir.espacesEnRetard > 0
            ? { cle: 'miroir', nom: SAUVEGARDE, etat: REGLE.miroir.gravite, detail: `${formatNumber(miroir.espacesEnRetard)} salon${miroir.espacesEnRetard > 1 ? 's' : ''} en retard`, ecran: 'base' }
            : { cle: 'miroir', nom: SAUVEGARDE, etat: 'ok', detail: miroir.enAttente > 0 ? `${formatNumber(miroir.enAttente)} écriture${miroir.enAttente > 1 ? 's' : ''} en attente` : 'à jour', ecran: 'base' },
  )

  const quota = alertes?.quota ?? null
  voyants.push(
    !alertes
      ? attend('quota', 'Quota de Turso', 'base')
      : quota
        ? { cle: 'quota', nom: 'Quota de Turso', etat: graviteOuverte('quota', quota.part), detail: `${formatNumber(quota.part)} % du mois au rythme de la semaine`, ecran: 'base' }
        : { cle: 'quota', nom: 'Quota de Turso', etat: 'ok', detail: `sous ${formatNumber(seuils.quota ?? REGLE.quota.seuil?.defaut ?? 0)} % du mois`, ecran: 'base' },
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
