// Le bilan de la production : ce qui a fait attendre les joueurs sur les
// dernières heures, et ce qui coïncidait — lu dans le relevé que le serveur
// écrit lui-même chaque heure (`qg_sante`, gardé huit jours), en lecture
// seule. Le 4 novembre 2026, après les latences du Cabinet
// (`retours/2026-11-04/latences-du-cabinet.md`), le propriétaire : « que l'on
// regarde les vrais points bloquants / latence » sur deux jours. La page « Le
// serveur » du QG dit tout cela heure par heure ; le bilan le dit d'un coup,
// rangé du pire au moins pire, chaque moment lent avec ce qui tombait dans
// ses cinq minutes — un gel et son nom, Turso, une connexion neuve, le
// processeur.
//
//   cd server && npx tsx scripts/bilan-de-la-production.ts [heures] [--jusqua=2026-11-06T21:00Z] [--env=production] [--messages]
//
// `PROD_LECTURE_URL` et `PROD_LECTURE_TOKEN` : un jeton en lecture seule de la
// base, jamais `QUIZ_DB_URL` ni un jeton qui écrit. Il n'imprime que des
// totaux — des modèles de route, des noms de tâches, des durées, des comptes :
// ni un prénom, ni un identifiant ; le message d'une erreur peut citer un
// joueur, il ne s'imprime qu'à la demande (`--messages`).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  HEURE_MS,
  PROCESSEUR_DE_L_HEBERGEUR_PCT,
  arreteNet,
  debutDeLHeure,
  debutDeLaTranche,
  erreursDeLaSemaine,
  finDe,
  fondreConnexions,
  fondreGels,
  messagesDeLaPeriode,
  partDesConnexionsNeuves,
  routesDeLaPeriode,
  sorteDuDemarrage,
  tempsDeReponse,
  tranchesFondues,
  versionsDuServeur,
  type ConnexionsDeLHeure,
  type DemarrageDuServeur,
  type GelDeLaBoucle,
  type GelsDeLHeure,
  type HeureDeSante,
  type Releve,
  type SorteDeDemarrage,
  type TrancheDeSante,
} from '../../shared/santeDuServeur'
import { CLS_EN_ALERTE, INP_LENT_MS, LCP_LENT_MS, NOM_DE_LA_PAGE_MESUREE, telephonesDeLaPeriode } from '../../shared/telephones'

/** Ce que le relevé garde : au-delà de huit jours, il n'y a plus rien à lire. */
export const HEURES_DU_BILAN_AU_PLUS = 8 * 24

/** Un moment lent : cinq minutes dont la pire réponse d'API passe une seconde et demie, ou dont une sur vingt passe la seconde. */
export const PIRE_D_UN_MOMENT_LENT_MS = 1500
export const CENTILE_D_UN_MOMENT_LENT_MS = 1000
/** Une attente qu'un joueur sent : la pire réponse d'une route dans son heure, au-delà de deux secondes. */
export const ATTENTE_SENTIE_MS = 2000
/** Turso lent dans cinq minutes : un aller-retour au-delà d'une seconde. */
const TURSO_LENT_DANS_UNE_TRANCHE_MS = 1000
/** Le processeur près du plafond de l'hébergeur — un dixième de cœur — : ses calculs attendent leur tour. */
const PROCESSEUR_PRES_DU_PLAFOND = PROCESSEUR_DE_L_HEBERGEUR_PCT * 0.8

export interface OptionsDuBilan {
  heures: number
  /** La fin de la fenêtre : son heure est la dernière lue. */
  jusqua: number
  /** Le message de chaque erreur : il peut citer un joueur — d'office, sa source, sa sorte et d'où elle vient seulement. */
  messages?: boolean
}

const NOM_DE_LA_SORTE: Record<SorteDeDemarrage, string> = {
  reveil: 'réveil',
  'mise-en-ligne': 'mise en ligne',
  relance: 'relance',
  'apres-arret': 'après un arrêt net',
}

/** « mer. 04/11 13:05 », à l'heure de Paris — les secondes pour un gel. */
const paris = (t: number, secondes = false) =>
  new Date(t).toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...(secondes && { second: '2-digit' }),
  })

const ms = (x: number | null | undefined) => (x == null ? '—' : tempsDeReponse(x))
const pct = (x: number | null | undefined) => (x == null ? '—' : `${String(Math.round(x * 10) / 10).replace('.', ',')} %`)
const fois = (n: number, mot: string, pluriel = `${mot}s`) => `${n} ${n > 1 ? pluriel : mot}`

/** Un tableau Markdown, lisible aussi au terminal ; une barre dans une cellule ne coupe pas sa colonne. */
function tableau(entetes: string[], lignes: (string | number)[][]): string {
  const cellule = (c: string | number) => String(c).replace(/\|/g, '\\|')
  return [`| ${entetes.join(' | ')} |`, `|${entetes.map(() => '---').join('|')}|`, ...lignes.map(l => `| ${l.map(cellule).join(' | ')} |`)].join('\n')
}

/** Plusieurs relevés d'heures en un : les comptes s'ajoutent, les centiles se moyennent par leurs appels, le pire reste le pire. */
function releveDeLaPeriode(releves: readonly (Releve | null | undefined)[]): Releve | null {
  let n = 0
  let s50 = 0
  let s95 = 0
  let max = 0
  for (const r of releves) {
    if (!r || r.n <= 0) continue
    n += r.n
    s50 += r.p50 * r.n
    s95 += r.p95 * r.n
    max = Math.max(max, r.max)
  }
  return n > 0 ? { n, p50: Math.round(s50 / n), p95: Math.round(s95 / n), max } : null
}

const ceQuiTournait = (g: GelDeLaBoucle) => g.enCours.map(e => e.quoi + (e.n > 1 ? ` ×${e.n}` : '')).join(', ') || 'rien de nommé'

/** Ce qui tombait dans les cinq minutes d'un moment lent : chacun de ces faits peut l'expliquer, aucun ne le prouve seul. */
function ceQuiCoincide(t: TrancheDeSante, gels: readonly GelDeLaBoucle[]): string {
  const faits: string[] = []
  for (const g of gels) faits.push(`gel de ${ms(g.dureeMs)} (${ceQuiTournait(g)})`)
  // Les gels de la tranche que l'heure ne garde pas en détail — elle n'en garde que les plus longs.
  const autres = t.gels.n - gels.length
  if (autres > 0) faits.push(`${fois(autres, 'autre gel', 'autres gels')} jusqu'à ${ms(t.gels.maxMs)}`)
  if (t.base && t.base.max >= TURSO_LENT_DANS_UNE_TRANCHE_MS) faits.push(`Turso jusqu'à ${ms(t.base.max)}`)
  if (t.connexions && t.connexions.ouvertes > 0) faits.push(fois(t.connexions.ouvertes, 'connexion neuve', 'connexions neuves'))
  if (t.connexions && t.connexions.lassees > 0) faits.push(fois(t.connexions.lassees, 'attente lassée', 'attentes lassées'))
  if (t.charge && t.charge.processeur >= PROCESSEUR_PRES_DU_PLAFOND) faits.push(`processeur à ${pct(t.charge.processeur)} d'un cœur`)
  if (t.erreurs > 0) faits.push(fois(t.erreurs, 'erreur serveur', 'erreurs serveur'))
  return faits.join(' · ') || 'rien qui coïncide'
}

/**
 * Le bilan, en Markdown : les démarrages, ce qu'un joueur a attendu route par
 * route, les attentes de plus de deux secondes, les moments lents et ce qui
 * coïncidait, ce qui gèle, Turso et ses connexions, la charge, les versions,
 * les erreurs, les téléphones, le temps réel. Pur : les heures et les
 * démarrages lus, rien d'autre — `bilan-de-la-production.test.ts` le lit sur
 * des heures inventées.
 */
export function bilanDeLaProduction(lignes: readonly HeureDeSante[], demarrages: readonly DemarrageDuServeur[], { heures, jusqua, messages = false }: OptionsDuBilan): string {
  const fin = debutDeLHeure(jusqua)
  const debut = fin - (heures - 1) * HEURE_MS
  const dans = lignes.filter(l => l.heure >= debut && l.heure <= fin)
  const sortie: string[] = []
  // Chaque bloc suivi d'une ligne vide : un tableau collé à son paragraphe ne se lit plus en tableau.
  const dire = (...blocs: string[]) => {
    for (const b of blocs) sortie.push(b, '')
  }

  dire(
    `# Ce qui a fait attendre les joueurs — ${heures} heures`,
    `Du ${paris(debut)} au ${paris(fin + HEURE_MS - 1)}, heure de Paris : ${fois(new Set(dans.map(l => l.heure)).size, 'heure relevée', 'heures relevées')} sur ${heures} — le serveur dort la nuit et après un quart d'heure sans visite.`,
  )
  if (dans.length === 0) {
    dire('Rien de relevé dans la fenêtre.')
    return sortie.join('\n')
  }

  // ── Les démarrages ────────────────────────────────────────────────────
  const tries = [...demarrages].sort((a, b) => a.demarreLe - b.demarreLe)
  const courant = tries.at(-1)?.id ?? ''
  const versionDe = new Map(tries.map(d => [d.id, d.version]))
  const dansLaFenetre = tries.filter(d => d.demarreLe <= fin + HEURE_MS && finDe(d, jusqua, courant) >= debut)
  dire(
    '## Les démarrages',
    tableau(
      ['Démarré', 'Version', 'Prêt en', 'Pourquoi', 'Fin'],
      dansLaFenetre.map(d => {
        const avant = tries[tries.indexOf(d) - 1]
        const finie = d.arreteLe !== null ? `éteint ${paris(d.arreteLe)}` : arreteNet(d, jusqua, courant) ? `**arrêt net** vers ${paris(d.vuLe)}` : 'en ligne'
        return [paris(d.demarreLe), d.version ?? '—', ms(d.pretEnMs), NOM_DE_LA_SORTE[sorteDuDemarrage(d, avant, jusqua, courant)], finie]
      }),
    ),
  )

  // ── Ce qu'un joueur a attendu, route par route ────────────────────────
  const toutes = releveDeLaPeriode(dans.map(l => l.routes))
  const routes = routesDeLaPeriode(dans, { debut, fin, avantDebut: debut - heures * HEURE_MS, avantFin: debut - HEURE_MS })
  dire(
    '## Ce qu’un joueur a attendu',
    toutes
      ? `Toutes routes d'API ensemble : ${toutes.n} appels, la moitié sous ${ms(toutes.p50)}, 19 sur 20 sous ${ms(toutes.p95)}, la pire ${ms(toutes.max)} — le temps du serveur, sans le réseau du téléphone.`
      : 'Aucune route d’API relevée.',
  )
  const appelees = routes.filter(r => r.n >= 10)
  // Une ligne d'avant le relevé route par route (le QG 2, le 4 novembre 2026) compte dans le total, pas dans les tables.
  const depuis = dans.find(l => l.parRoute)?.heure
  if (depuis !== undefined && dans.some(l => l.heure < depuis)) dire(`Route par route : depuis ${paris(depuis)} seulement, la version qui les relève.`)
  if (appelees.length > 0) {
    dire(
      '### Les plus lentes (dix appels au moins)',
      tableau(
        ['Route', 'Appels', 'Médiane', '19 sur 20', 'Pire', 'Part du temps du serveur'],
        [...appelees].sort((a, b) => b.p95 - a.p95).slice(0, 15).map(r => [r.route, r.n, ms(r.p50), ms(r.p95), ms(r.max), pct(r.part)]),
      ),
      '### Celles qui prennent le plus au serveur',
      tableau(
        ['Route', 'Appels', 'Temps en tout', 'Part', '19 sur 20'],
        routes.slice(0, 8).map(r => [r.route, r.n, ms(r.totalMs), pct(r.part), ms(r.p95)]),
      ),
    )
  }
  const senties = dans
    .flatMap(l => (l.parRoute ?? []).filter(r => r.max >= ATTENTE_SENTIE_MS).map(r => ({ heure: l.heure, ...r })))
    .sort((a, b) => b.max - a.max)
  dire(
    `### Les attentes de plus de ${ms(ATTENTE_SENTIE_MS)}`,
    senties.length === 0
      ? 'Aucune.'
      : tableau(
          ['Heure', 'Route', 'Pire', 'Appels dans l’heure', '19 sur 20 de l’heure'],
          senties.slice(0, 15).map(r => [paris(r.heure), r.route, ms(r.max), r.n, ms(r.p95)]),
        ) + (senties.length > 15 ? `\n\n… et ${senties.length - 15} de plus.` : ''),
  )

  // ── Les moments lents, et ce qui coïncidait ───────────────────────────
  const tranches = [...tranchesFondues(dans).values()].filter(t => t.debut >= debut && t.debut < fin + HEURE_MS)
  const gelsEnDetail = dans.flatMap(l => l.gels?.plusLongs ?? [])
  const lents = tranches
    .filter(t => t.routes && (t.routes.max >= PIRE_D_UN_MOMENT_LENT_MS || t.routes.p95 >= CENTILE_D_UN_MOMENT_LENT_MS))
    .sort((a, b) => (b.routes?.max ?? 0) - (a.routes?.max ?? 0))
  dire(
    '## Les moments lents, et ce qui coïncidait',
    `Cinq minutes dont la pire réponse passe ${ms(PIRE_D_UN_MOMENT_LENT_MS)}, ou dont une sur vingt passe ${ms(CENTILE_D_UN_MOMENT_LENT_MS)} : ${fois(lents.length, 'moment', 'moments')} sur ${tranches.length} relevés.` +
      (tranches.some(t => t.connexions) ? '' : ' Les connexions par cinq minutes ne sont relevées que depuis la version qui les écrit.'),
  )
  if (lents.length > 0) {
    dire(
      tableau(
        ['Cinq minutes', 'Réponses', '19 sur 20', 'Pire', 'Turso 19 sur 20', 'Ce qui coïncidait'],
        lents.slice(0, 20).map(t => [
          paris(t.debut),
          t.routes?.n ?? 0,
          ms(t.routes?.p95),
          ms(t.routes?.max),
          ms(t.base?.p95),
          ceQuiCoincide(
            t,
            gelsEnDetail.filter(g => debutDeLaTranche(g.a) === t.debut),
          ),
        ]),
      ),
    )
  }

  // ── Ce qui gèle ───────────────────────────────────────────────────────
  let gels: GelsDeLHeure | null = null
  for (const l of dans) if (l.gels) gels = fondreGels(gels, l.gels, 15, 25)
  dire('## Ce qui gèle')
  if (!gels) dire('Aucun gel relevé : une version d’avant leur sonde.')
  else if (gels.n === 0) dire('Aucun gel de plus d’une demi-seconde.')
  else {
    dire(
      `${fois(gels.n, 'gel', 'gels')} de plus d'une demi-seconde, ${ms(gels.totalMs)} en tout, ${fois(gels.sansRien, 'sans rien de nommé', 'sans rien de nommé')}. Au dixième de cœur, un gel dont le processeur fait le dixième de la durée est un calcul que l'hébergeur a fait attendre ; bien moins, le processus attendait autre chose.`,
      tableau(['Ce qui tournait', 'Gels', 'Durée cumulée'], gels.parCe.map(c => [c.quoi, c.n, ms(c.ms)])),
      '### Les plus longs',
      tableau(
        ['Fini à', 'Durée', 'Processeur', 'Ramasse-miettes', 'Ce qui tournait'],
        gels.plusLongs.map(g => [paris(g.a, true), ms(g.dureeMs), ms(g.processeurMs), ms(g.ramasseMiettesMs), ceQuiTournait(g)]),
      ),
    )
  }

  // ── Turso et ses connexions ───────────────────────────────────────────
  const base = releveDeLaPeriode(dans.map(l => l.base))
  let connexions: ConnexionsDeLHeure | null = null
  for (const l of dans) connexions = fondreConnexions(connexions, l.connexions)
  dire('## Turso et ses connexions')
  if (base) {
    const neuves = partDesConnexionsNeuves(base, connexions)
    dire(
      `${base.n} allers-retours, la moitié sous ${ms(base.p50)}, 19 sur 20 sous ${ms(base.p95)}, le pire ${ms(base.max)}.` +
        (connexions ? ` ${fois(connexions.ouvertes, 'connexion neuve', 'connexions neuves')} pour les joueurs${neuves === null ? '' : ` (${neuves} % des allers-retours ont payé leur poignée de main)`}, ${connexions.echecs} tombés en route, ${connexions.refermeesParLaBase} refermées par Turso.` : ''),
    )
    if (connexions?.chaudes) dire(`L'entretien : ${connexions.battements ?? 0} battements, ${connexions.battementsTombes ?? 0} tombés, ${connexions.ouvertesParUnBattement ?? 0} connexions rouvertes par eux.`)
    if (connexions?.patienceMs) {
      const attentes = connexions.attentes ?? 0
      dire(
        `La patience (${ms(connexions.patienceMs)}) : ${fois(attentes, 'attente', 'attentes')}${attentes > 0 ? `, ${ms((connexions.attenteMs ?? 0) / attentes)} en moyenne` : ''}, dont ${fois(connexions.lassees ?? 0, 'lassée', 'lassées')} — chacune de celles qui ont eu leur place a évité une poignée de main.`,
      )
    } else if (connexions && connexions.patienceMs === 0) dire('La patience des connexions : aucune (`QUIZ_DB_PATIENCE_MS` absente, ou le `fetch` de Node).')
    const lentes = dans.filter(l => l.base && l.base.n >= 20 && l.base.p95 >= TURSO_LENT_DANS_UNE_TRANCHE_MS)
    if (lentes.length > 0) dire(`Les heures où Turso passait la seconde pour un aller-retour sur vingt : ${lentes.map(l => `${paris(l.heure)} (${ms(l.base!.p95)})`).join(', ')}.`)
  } else dire('Aucun aller-retour relevé.')

  // ── La charge ─────────────────────────────────────────────────────────
  const charges = dans.flatMap(l => (l.charge && l.charge.n > 0 ? [{ heure: l.heure, ...l.charge }] : []))
  if (charges.length > 0) {
    const releves = charges.reduce((s, c) => s + c.n, 0)
    const avecGel = charges.filter(c => typeof c.gelePct === 'number')
    const gele = avecGel.reduce((s, c) => s + c.gelePct! * c.n, 0) / Math.max(1, avecGel.reduce((s, c) => s + c.n, 0))
    const pire = [...avecGel].sort((a, b) => (b.geleMaxPct ?? 0) - (a.geleMaxPct ?? 0))[0]
    dire(
      '## La charge',
      `Le processeur : ${pct(charges.reduce((s, c) => s + c.processeur * c.n, 0) / releves)} d'un cœur en moyenne, ${pct(Math.max(...charges.map(c => c.processeurMax)))} au pire relevé — l'hébergeur en donne ${PROCESSEUR_DE_L_HEBERGEUR_PCT} %. ` +
        (avecGel.length > 0 ? `Bridé ${pct(gele)} du temps en moyenne, ${pct(pire?.geleMaxPct)} au pire relevé (${paris(pire!.heure)}). ` : '') +
        `La boucle figée ${ms(Math.max(...charges.map(c => c.boucleMaxMs)))} au pire ; la mémoire à ${Math.max(...charges.map(c => c.memoireMaxMo))} Mo au plus.`,
    )
  }

  // ── Les versions ──────────────────────────────────────────────────────
  const versions = versionsDuServeur(dans, dansLaFenetre, jusqua, courant)
  if (versions.length > 0) {
    const gelsDe = (version: string) => {
      const siennes = dans.filter(l => versionDe.get(l.demarrage) === version)
      const n = siennes.reduce((s, l) => s + (l.gels?.n ?? 0), 0)
      const heuresAvecSonde = new Set(siennes.filter(l => l.gels).map(l => l.heure)).size
      return heuresAvecSonde > 0 ? `${n} (${String(Math.round((n / heuresAvecSonde) * 10) / 10).replace('.', ',')} par heure)` : '—'
    }
    dire(
      '## Les versions',
      tableau(
        ['Version', 'Depuis', 'Heures', '19 sur 20', 'Erreurs pour mille', 'Processeur', 'Gels', 'Routes ralenties'],
        versions.map(v => [
          v.version,
          paris(v.depuis),
          v.heures,
          ms(v.routes?.p95),
          v.erreursPourMille ?? '—',
          pct(v.processeur),
          gelsDe(v.version),
          v.ralenties.map(r => `${r.route} ${ms(r.avant)} → ${ms(r.apres)}`).join(' ; ') || '—',
        ]),
      ),
    )
  }

  // ── Les erreurs ───────────────────────────────────────────────────────
  const { erreurs, sansDetail } = erreursDeLaSemaine(dans, d => versionDe.get(d) ?? null)
  dire('## Les erreurs serveur')
  if (erreurs.length === 0 && sansDetail.length === 0) dire('Aucune.')
  else {
    const entetes = ['Source', 'Sorte', 'D’où', 'Fois', 'Versions', ...(messages ? ['Message'] : [])]
    dire(
      tableau(
        entetes,
        [...erreurs]
          .sort((a, b) => b.n - a.n)
          .slice(0, 12)
          .map(e => [e.source, e.code ? `${e.nom} (${e.code})` : e.nom, e.ou ?? '—', e.n, e.versions.join(', ') || '—', ...(messages ? [e.message] : [])]),
      ),
      ...(sansDetail.length > 0 ? [`Sans détail : ${sansDetail.map(s => `${s.source} ×${s.n}`).join(', ')}.`] : []),
    )
  }

  // ── Les téléphones ────────────────────────────────────────────────────
  const telephones = telephonesDeLaPeriode(dans.map(l => l.telephones))
  if (telephones.pages.length > 0) {
    const lent = (x: number | undefined, seuil: number, texte: string) => (x === undefined ? '—' : x > seuil ? `**${texte}**` : texte)
    dire(
      '## Les téléphones (un sur quatre)',
      `Ce que le serveur ne voit pas : le temps qu'une page met à paraître (au-delà de ${ms(LCP_LENT_MS)}, à regarder) et à répondre au doigt (au-delà de ${ms(INP_LENT_MS)}), pour trois pages sur quatre.`,
      tableau(
        ['Page', 'Vues', 'Paraître', 'Répondre au doigt', 'Sauts', 'Erreurs'],
        [...telephones.pages]
          .sort((a, b) => b.vues - a.vues)
          .map(p => [
            NOM_DE_LA_PAGE_MESUREE[p.page],
            p.vues,
            lent(p.lcp?.p75, LCP_LENT_MS, ms(p.lcp?.p75)),
            lent(p.inp?.p75, INP_LENT_MS, ms(p.inp?.p75)),
            lent(p.cls?.p75, CLS_EN_ALERTE, p.cls ? String(p.cls.p75).replace('.', ',') : '—'),
            p.erreurs,
          ]),
      ),
    )
  }

  // ── Le temps réel ─────────────────────────────────────────────────────
  const avecTempsReel = dans.filter(l => l.tempsReel)
  const messagesDuTempsReel = messagesDeLaPeriode(avecTempsReel, { debut, fin, avantDebut: debut - heures * HEURE_MS, avantFin: debut - HEURE_MS })
  if (messagesDuTempsReel.length > 0) {
    const tropTard = avecTempsReel.reduce((s, l) => s + (l.tempsReel?.tropTard ?? 0), 0)
    const chronos = avecTempsReel.reduce((s, l) => ({ n: s.n + (l.tempsReel?.chronos.n ?? 0), enRetard: s.enRetard + (l.tempsReel?.chronos.enRetard ?? 0) }), { n: 0, enRetard: 0 })
    dire(
      '## Les soirées (le temps réel)',
      `${fois(tropTard, 'réponse arrivée trop tard', 'réponses arrivées trop tard')} ; ${chronos.n} chronomètres sonnés, ${chronos.enRetard} avec plus d'une seconde de retard.`,
      tableau(
        ['Message', 'Arrivées', '19 sur 20', 'Pire'],
        [...messagesDuTempsReel].sort((a, b) => b.p95 - a.p95).slice(0, 8).map(m => [m.route, m.n, ms(m.p95), ms(m.max)]),
      ),
    )
  }
  return sortie.join('\n')
}

/** Les options de la ligne de commande : des heures, `--jusqua=…`, `--env=…`, `--messages`. */
export function lireLesOptions(args: readonly string[], maintenant = Date.now()): OptionsDuBilan & { env: string } {
  const option = (nom: string) => args.find(a => a.startsWith(`--${nom}=`))?.slice(nom.length + 3)
  const heures = Number(args.find(a => !a.startsWith('--')) ?? 48)
  if (!Number.isInteger(heures) || heures < 1 || heures > HEURES_DU_BILAN_AU_PLUS)
    throw new Error(`Des heures, de 1 à ${HEURES_DU_BILAN_AU_PLUS} : le relevé n'en garde que huit jours.`)
  const jusqua = option('jusqua') === undefined ? maintenant : Date.parse(option('jusqua')!)
  if (!Number.isFinite(jusqua)) throw new Error('--jusqua : une date lisible, 2026-11-06T21:00Z par exemple.')
  return { heures, jusqua, env: option('env') ?? 'production', messages: args.includes('--messages') }
}

async function principal() {
  const options = lireLesOptions(process.argv.slice(2))
  const url = process.env.PROD_LECTURE_URL
  const authToken = process.env.PROD_LECTURE_TOKEN
  if (!url || !authToken) {
    console.error('PROD_LECTURE_URL et PROD_LECTURE_TOKEN : un jeton en lecture seule de la base — jamais QUIZ_DB_URL.')
    process.exitCode = 1
    return
  }
  const { createClient } = await import('@libsql/client')
  // En HTTP : derrière un proxy (`NODE_USE_ENV_PROXY=1`), le WebSocket de `libsql:` ne passe pas.
  const db = createClient({ url: url.replace(/^libsql:/, 'https:'), authToken })
  try {
    const debut = debutDeLHeure(options.jusqua) - (options.heures - 1) * HEURE_MS
    // Le démarrage d'avant la fenêtre aussi : la sorte du premier se lit dans lui.
    const demarrages = await db.execute({
      sql: `SELECT id, demarre_le, pret_en_ms, version, env, vu_le, arrete_le FROM qg_demarrages WHERE env = ? AND vu_le >= ? ORDER BY demarre_le`,
      args: [options.env, debut - 24 * HEURE_MS],
    })
    const sante = await db.execute({
      sql: `SELECT s.heure, s.demarrage, s.releve FROM qg_sante s JOIN qg_demarrages d ON d.id = s.demarrage WHERE d.env = ? AND s.heure >= ? AND s.heure <= ? ORDER BY s.heure`,
      args: [options.env, debut, debutDeLHeure(options.jusqua)],
    })
    const lignes: HeureDeSante[] = []
    for (const r of sante.rows) {
      try {
        lignes.push({ ...(JSON.parse(String(r.releve)) as HeureDeSante), heure: Number(r.heure), demarrage: String(r.demarrage) })
      } catch {
        // Une ligne illisible ôte son heure, pas le bilan.
      }
    }
    const lus: DemarrageDuServeur[] = demarrages.rows.map(d => ({
      id: String(d.id),
      demarreLe: Number(d.demarre_le),
      pretEnMs: d.pret_en_ms === null ? null : Number(d.pret_en_ms),
      version: d.version === null ? null : String(d.version),
      env: d.env === null ? null : String(d.env),
      vuLe: Number(d.vu_le),
      arreteLe: d.arrete_le === null ? null : Number(d.arrete_le),
    }))
    console.log(bilanDeLaProduction(lignes, lus, options))
  } finally {
    db.close()
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch(e => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
}
