// Ce que la fin de soirée raconte à un profil, en plus de ce qu'elle lui
// rapporte : un record battu, et ce dont il s'approche.
//
// Entre la quatrième et la dixième soirée, le joueur médian ne décrochait
// presque rien : les paliers de bronze étaient tombés, l'argent était loin,
// et un légendaire demande une vingtaine de quiz. La soirée lui rapportait de
// l'expérience, et rien qui se voie. Un record battu, une jauge qui avance —
// « La Foudre : 7 fois sur 10, +1 ce soir » — disent qu'on avance, même les
// soirs où rien ne tombe.
//
// Dérivations pures : les soirées d'avant, celle de ce soir, ce qu'il a
// rangé. Rien ici ne se crédite, et rien ne s'écrit en base.

import type { Approche, RecordBattu } from '../../../shared/fin'
import { HAUTS_FAITS_DE_CARRIERE, clePalier, hautFait } from '../../../shared/hautsfaits'
import { LEGENDAIRES } from '../../../shared/legendaires'
import { soireeQuiCompte, type Carriere, type GainSoiree, type ReleveSoiree } from '../../../shared/profil'

type Soiree = { releve: ReleveSoiree; gain: GainSoiree }

/** En deçà, pas de record : « 2 bonnes réponses d'affilée — ton record était de 1 » ne fête rien. */
const SERIE_MIN = 5
const JUSTES_MIN = 10
/**
 * Une précision ne se compare que sur vingt QCM au moins, ce soir comme
 * avant : dix sur dix un soir de dix questions aurait fermé le record pour
 * toujours.
 */
export const QCM_POUR_PRECISION = 20

/**
 * Ses records battus ce soir, contre toutes ses soirées d'avant. La première
 * n'en bat aucun — tout y serait un record —, et une soirée jouée seul ne
 * bat rien et ne se bat pas (`soireeQuiCompte`).
 */
export function recordsBattus(avant: readonly Soiree[], ceSoir: Soiree): RecordBattu[] {
  if (!soireeQuiCompte(ceSoir.gain)) return []
  const passees = avant.filter(s => soireeQuiCompte(s.gain)).map(s => s.releve)
  if (passees.length === 0) return []
  const r = ceSoir.releve
  const records: RecordBattu[] = []
  const serie = Math.max(0, ...passees.map(p => p.meilleureSerie))
  if (r.meilleureSerie >= SERIE_MIN && serie > 0 && r.meilleureSerie > serie) {
    records.push({ key: 'serie', valeur: r.meilleureSerie, avant: serie })
  }
  const justes = Math.max(0, ...passees.map(p => p.justes))
  if (r.justes >= JUSTES_MIN && justes > 0 && r.justes > justes) records.push({ key: 'justes', valeur: r.justes, avant: justes })
  const precisions = passees.filter(p => p.qcm >= QCM_POUR_PRECISION).map(p => p.justes / p.qcm)
  if (r.qcm >= QCM_POUR_PRECISION && precisions.length > 0) {
    const precision = r.justes / r.qcm
    const record = Math.max(...precisions)
    // Au pour cent près, comme il s'affiche : « 82 % — ton record était de
    // 82 % » ne se lirait pas comme un record.
    if (Math.round(precision * 100) > Math.round(record * 100)) {
      records.push({ key: 'precision', valeur: precision, avant: record, sur: r.qcm })
    }
  }
  return records
}

/** « Tu t'en approches » : à mi-chemin au moins. En deçà, ce n'est pas encore s'approcher. */
const MI_CHEMIN = 0.5

/**
 * Les paliers que la fin de soirée annonce déjà autrement : La Légende suit
 * le niveau, que la barre montre juste au-dessus ; les Éclats se tirent, et
 * celui du soir a sa carte à lui.
 */
const DEJA_DITS = new Set(['hf:legende', 'hf:eclats'])

/**
 * Deux objectifs au plus, qui ont avancé ce soir et qu'il a passé la moitié :
 * le légendaire le plus proche d'abord, s'il en est un — c'est lui qu'on
 * chasse —, puis le plus proche du reste, légendaire ou palier de carrière.
 * Un légendaire qui se gagne par un palier (le Renard, L'Habitué · Argent)
 * le représente : le palier ne se montre pas une seconde fois.
 */
export function approchesDeLaSoiree(o: {
  /** Ce qu'il a rangé, cette soirée comprise : chaque clé, et le nombre de soirées où elle est tombée. */
  recompenses: ReadonlyMap<string, number>
  /** Les hauts faits de soirée décrochés ce soir. */
  ceSoir: ReadonlySet<string>
  /** Sa carrière sans cette soirée, et avec elle. */
  avant: Carriere
  apres: Carriere
  /** Les légendaires qu'il a déjà. */
  legendaires: readonly string[]
}): Approche[] {
  const candidats: (Approche & { legendaire: boolean })[] = []
  const representes = new Set<string>()
  for (const l of LEGENDAIRES) {
    if (o.legendaires.includes(l.key)) continue
    const c = l.condition
    if ('fois' in c) {
      if (!o.ceSoir.has(c.hautFait)) continue
      const acquis = Math.min(c.fois, o.recompenses.get(c.hautFait) ?? 0)
      if (acquis < c.fois) candidats.push({ key: l.key, acquis, requis: c.fois, ceSoir: 1, legendaire: true })
      continue
    }
    const h = hautFait(c.hautFait)
    if (h?.famille !== 'carriere') continue
    representes.add(clePalier(h.key, c.palier))
    const [avant, apres, requis] = [h.valeur(o.avant), h.valeur(o.apres), h.paliers[c.palier - 1]]
    if (apres > avant && apres < requis) candidats.push({ key: l.key, acquis: apres, requis, ceSoir: apres - avant, legendaire: true })
  }
  for (const h of HAUTS_FAITS_DE_CARRIERE) {
    if (DEJA_DITS.has(h.key)) continue
    const palier = [1, 2, 3].find(p => !o.recompenses.has(clePalier(h.key, p)))
    if (!palier || representes.has(clePalier(h.key, palier))) continue
    const [avant, apres, requis] = [h.valeur(o.avant), h.valeur(o.apres), h.paliers[palier - 1]]
    if (apres > avant && apres < requis) {
      candidats.push({ key: clePalier(h.key, palier), acquis: apres, requis, ceSoir: apres - avant, legendaire: false })
    }
  }
  const proches = candidats
    .filter(c => c.acquis / c.requis >= MI_CHEMIN)
    .sort((a, b) => b.acquis / b.requis - a.acquis / a.requis || Number(b.legendaire) - Number(a.legendaire) || a.key.localeCompare(b.key))
  const premier = proches.find(c => c.legendaire) ?? proches[0]
  const retenus = premier ? [premier, ...proches.filter(c => c !== premier).slice(0, 1)] : []
  return retenus
    .sort((a, b) => b.acquis / b.requis - a.acquis / a.requis)
    .map(({ key, acquis, requis, ceSoir }) => ({ key, acquis, requis, ceSoir }))
}
