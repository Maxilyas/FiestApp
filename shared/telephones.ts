import { parseRoute } from './adresses'

/**
 * Ce que vivent les téléphones des joueurs (le QG 2, lot 9 ; la proposition du
 * 3 novembre 2026, « Les téléphones ») : le temps qu'une page met à paraître
 * (LCP), à répondre au doigt (INP), ce qui saute (CLS) et les erreurs du
 * client, mesurés dans la page d'un téléphone sur quatre, envoyés une fois
 * quand elle se cache (`POST /api/mesures`), agrégés à l'heure dans le relevé
 * du serveur — aucune écriture par visite, ni un nom, ni une adresse, ni le
 * navigateur : la page, et la sorte d'appareil. `npm run mesure` dit ce
 * qu'une page coûte au banc ; seuls les vrais téléphones disent ce qu'elle
 * coûte dans le noir d'un salon.
 */

/** Un téléphone sur quatre mesure : assez pour un 75ᵉ centile, sans faire envoyer tout le monde. */
export const PART_DES_TELEPHONES_MESURES = 0.25

/** Les pages qu'on mesure, comme le QG les nomme. Le QG lui-même n'y est pas : l'administrateur n'est pas un joueur. */
export const PAGES_MESUREES = ['accueil', 'profil', 'boutique', 'jour', 'campagne', 'duels', 'cabinet', 'soiree', 'ecran', 'souvenir', 'autre'] as const
export type PageMesuree = (typeof PAGES_MESUREES)[number]

export const NOM_DE_LA_PAGE_MESUREE: Record<PageMesuree, string> = {
  accueil: 'L’accueil',
  profil: 'Le profil',
  boutique: 'La boutique',
  jour: 'Le quiz du jour',
  campagne: 'La campagne',
  duels: 'Les duels',
  cabinet: 'Le Cabinet',
  soiree: 'Une soirée (invité)',
  ecran: 'L’écran commun',
  souvenir: 'Le souvenir, le bilan',
  autre: 'Les autres pages',
}

/**
 * La page d'une adresse, lue par le serveur — jamais ce que la page dit
 * d'elle-même : un salon (`/chez-nadia`) se dit « une soirée », sans son nom.
 * Le QG ne se mesure pas (null).
 */
export function pageMesuree(chemin: unknown): PageMesuree | null {
  if (typeof chemin !== 'string' || !chemin.startsWith('/') || chemin.length > 300) return 'autre'
  const r = parseRoute(chemin.split(/[?#]/)[0])
  if (r.kind === 'landing') return 'accueil'
  if (r.kind === 'join') return 'soiree'
  if (r.kind === 'public') return 'souvenir'
  if (r.kind !== 'account') return 'autre'
  switch (r.page) {
    case 'admin':
      return null
    case 'profil':
    case 'boutique':
    case 'jour':
    case 'campagne':
    case 'duels':
    case 'cabinet':
      return r.page
    case 'host':
    case 'tele':
      return 'ecran'
    default:
      return 'autre'
  }
}

export const APPAREILS = ['android', 'iphone', 'ordinateur', 'autre'] as const
export type Appareil = (typeof APPAREILS)[number]
export const NOM_DE_L_APPAREIL: Record<Appareil, string> = { android: 'Android', iphone: 'iPhone', ordinateur: 'Ordinateur', autre: 'Autre' }

/** Ce qu'un téléphone envoie, relu au serveur : chaque mesure bornée, ce qui ne se lit pas ignoré. */
export interface MesureDUnePage {
  page: PageMesuree
  /** En millisecondes, ou null quand le navigateur ne la donne pas (Safari ne dit ni LCP ni INP). */
  lcp: number | null
  inp: number | null
  cls: number | null
  erreurs: number
  appareil: Appareil
  /** Ouverte depuis l'application installée sur l'écran d'accueil. */
  installee: boolean
}

/** Une valeur absente vaut « ne sait pas » (null) ; une valeur hors de ses bornes, « illisible » (undefined). */
const borne = (v: unknown, max: number): number | null | undefined => {
  if (v === null || v === undefined) return null
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : undefined
}

/**
 * Une mesure reçue, relue ; null si elle ne vaut rien — la route répond pareil,
 * sans rien dire. Un chiffre absent est un navigateur qui ne sait pas le
 * mesurer (Safari, longtemps, ni le dessin, ni le doigt, ni les sauts) : sa
 * page compte dans les vues, les appareils et les erreurs — sinon les iPhone
 * disparaissaient de la part des appareils. Un chiffre illisible, lui, rend
 * toute la mesure suspecte : elle s'ignore.
 */
export function lireUneMesure(brut: unknown): MesureDUnePage | null {
  if (!brut || typeof brut !== 'object') return null
  const m = brut as Record<string, unknown>
  const page = pageMesuree(m.chemin)
  if (!page) return null
  const lcp = borne(m.lcp, 60_000)
  const inp = borne(m.inp, 20_000)
  const cls = borne(m.cls, 10)
  const erreurs = borne(m.erreurs, 50)
  if (lcp === undefined || inp === undefined || cls === undefined || erreurs === undefined) return null
  const appareil = (APPAREILS as readonly string[]).includes(m.appareil as string) ? (m.appareil as Appareil) : 'autre'
  return {
    page,
    lcp: lcp === null ? null : Math.round(lcp),
    inp: inp === null ? null : Math.round(inp),
    cls: cls === null ? null : Math.round(cls * 1000) / 1000,
    erreurs: Math.round(erreurs ?? 0),
    appareil,
    installee: m.installee === true,
  }
}

/** Le 75ᵉ centile d'une mesure, et sur combien de pages. */
export interface CentileDuTelephone {
  n: number
  p75: number
}

/** Une page, sur une heure ou sur la période. */
export interface PageDesTelephones {
  page: PageMesuree
  vues: number
  lcp: CentileDuTelephone | null
  inp: CentileDuTelephone | null
  cls: CentileDuTelephone | null
  erreurs: number
}

/** Ce que l'heure garde des téléphones (`HeureDeSante.telephones`). */
export interface TelephonesDeLHeure {
  pages: PageDesTelephones[]
  appareils: Partial<Record<Appareil, number>>
  installees: number
}

/** Les seuils des bonnes pratiques du web, que la page lit en couleur : au-delà, à regarder. */
export const LCP_LENT_MS = 2500
export const INP_LENT_MS = 200
export const CLS_EN_ALERTE = 0.1

/** Le 75ᵉ centile d'un échantillon. */
export function p75(valeurs: readonly number[]): number | null {
  if (valeurs.length === 0) return null
  const v = [...valeurs].sort((a, b) => a - b)
  return v[Math.min(v.length - 1, Math.floor(v.length * 0.75))]
}

/**
 * Des heures fondues en une période : les vues et les erreurs s'additionnent ;
 * un centile ne s'additionne pas, il se moyenne, pondéré par ses mesures —
 * comme ceux des routes (`cumulsDesRoutes`).
 */
export function telephonesDeLaPeriode(heures: readonly (TelephonesDeLHeure | undefined)[]): TelephonesDeLHeure {
  const pages = new Map<PageMesuree, { vues: number; erreurs: number; lcp: [number, number]; inp: [number, number]; cls: [number, number] }>()
  const appareils: Partial<Record<Appareil, number>> = {}
  let installees = 0
  const fondre = (cumul: [number, number], c: CentileDuTelephone | null) => {
    if (!c || c.n <= 0) return
    cumul[0] += c.n
    cumul[1] += c.p75 * c.n
  }
  for (const h of heures) {
    if (!h) continue
    installees += h.installees
    for (const [a, n] of Object.entries(h.appareils) as [Appareil, number][]) appareils[a] = (appareils[a] ?? 0) + n
    for (const p of h.pages) {
      const c = pages.get(p.page) ?? { vues: 0, erreurs: 0, lcp: [0, 0], inp: [0, 0], cls: [0, 0] }
      c.vues += p.vues
      c.erreurs += p.erreurs
      fondre(c.lcp, p.lcp)
      fondre(c.inp, p.inp)
      fondre(c.cls, p.cls)
      pages.set(p.page, c)
    }
  }
  const centile = ([n, s]: [number, number], decimales = 0): CentileDuTelephone | null => {
    if (n === 0) return null
    const f = 10 ** decimales
    return { n, p75: Math.round((s / n) * f) / f }
  }
  return {
    pages: [...pages]
      .map(([page, c]) => ({ page, vues: c.vues, erreurs: c.erreurs, lcp: centile(c.lcp), inp: centile(c.inp), cls: centile(c.cls, 3) }))
      .sort((a, b) => b.vues - a.vues || PAGES_MESUREES.indexOf(a.page) - PAGES_MESUREES.indexOf(b.page)),
    appareils,
    installees,
  }
}
