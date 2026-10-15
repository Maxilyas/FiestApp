// Des milliers de questions pour la base de la campagne, sur l'abonnement
// Claude : le script prépare et range, les agents du dépôt écrivent et
// relisent (`redacteur-campagne`, `relecteur-campagne`, `.claude/agents/`),
// lancés en nombre par une session Claude Code. C'est elle qui consomme, dans
// les limites du forfait : rien ne se paie en plus — l'API d'Anthropic, qui
// rendrait tout d'un coup, se facture à part (le choix du 10 octobre 2026).
//
//   npx tsx scripts/generer-campagne.ts preparer --questions=1000 [--categories=Géographie,Sport] [--par-lot=30] [--nom=g1]
//   npx tsx scripts/generer-campagne.ts preparer --sentiers[=2] [--par-lot=30] [--nom=s1]   ce qui manque aux sentiers pour se monter deux fois
//   npx tsx scripts/generer-campagne.ts preparer --theme=<clé> [--par-lot=30] [--nom=t1]    ce qui manque à un thème (shared/sujets.ts)
//   npx tsx scripts/generer-campagne.ts preparer --inventaire=<clé> --questions=<n> [--nom=d1]   n questions pour un thème, famille par famille de son inventaire
//   npx tsx scripts/generer-campagne.ts preparer --inventaire=<clé> --manques [--nom=d2]          une question par sujet de l'inventaire qu'aucune n'aborde encore
//   npx tsx scripts/generer-campagne.ts suite [<nom>] [--forcer]
//   npx tsx scripts/generer-campagne.ts etat [<nom>]
//
// `preparer` fait le plan — ce qui manque à la base, en lots, en vagues — et
// écrit les consignes de la première vague. `suite` fait chaque fois tout ce
// qui peut se faire — recueillir une vague écrite avec le juge et le
// dédoublonnage du rangement, écrire les consignes de la suivante et les
// fiches de relecture, appliquer les décisions — puis dit les agents à
// lancer, un par lot ou par fiche. Relancée après eux, elle continue ; tout
// relu, elle dit la commande qui range. `--forcer` passe outre un agent qui
// n'a rien rendu : son lot compte pour vide, une fiche sans décisions met ses
// lots de côté, sans relecture.
//
// Tout vit dans le dossier des lots : les lots `<nom>-NN.json`, que
// `base-campagne.ts ranger` prend tels quels, et à côté, dans `<nom>/`, le
// plan, les consignes, les fiches, les décisions, chaque refus.

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lireLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { commandeDeLaCategorie, consigneDEcriture, empreintesDesLivres, type QuotaDEcriture } from '../src/core/consigneCampagne'
import { couverture, inventairesDuTheme, repartirLesFamilles, type QuestionCouverte } from '../src/core/inventaires'
import { CATEGORIES, categorieDe, type Categorie } from '../../shared/categories'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { BRANCHES } from '../../shared/branches'
import { chapitresDe } from '../../shared/chapitres'
import { PALIERS, regleDuPalier } from '../../shared/sentiers'
import { PALIERS_DES_SUJETS } from '../../shared/sentiersDeSujets'
import { SUJETS, sujetParCle, sujetsDe, type Sujet } from '../../shared/sujets'
import type { MetadonneesDeQuestion } from '../../shared/etiquettes'
import { QUESTIONS_PAR_MARCHE, niveauDeQuestion, type Niveau } from '../../shared/campagne'
import { DOSSIER_DES_LOTS, TriDesEntrees, appliquerLesDecisions, ecrireLot, ficheDUneEntree, lireLot, lotsEnAttente, type Decision, type SorteDeRefus } from './lots-campagne'

/**
 * Ce qu'un agent écrit d'un coup : un fichier, qu'il vérifie jusqu'à zéro
 * refus — la taille des lots écrits à la main. Plus, et l'agent relit mal ;
 * moins, et la consigne commune, la même pour tous, pèse plus que le lot.
 */
export const QUESTIONS_PAR_LOT = 30

/** Ce qu'un correcteur relit d'une fiche : une centaine de questions, quatre à cinq fois moins à lire que de les écrire. */
export const QUESTIONS_PAR_FICHE = 100

// ── Le plan ─────────────────────────────────────────────────────────────

/** Un lot à écrire : son identifiant — qui nomme son fichier, `<id>.json` —, sa catégorie et sa commande. */
export interface LotPrevu {
  id: string
  categorie: Categorie
  quotas: QuotaDEcriture[]
}

/** Une fiche de relecture : les lots qu'elle couvre, et où son correcteur écrit ses décisions. */
export interface Fiche {
  nom: string
  lots: string[]
}

/** Ce que le recueil d'une vague a trouvé dans ses lots. */
export interface Recueil {
  le: string
  /** Les entrées lues dans les lots écrits. */
  ecrites: number
  /** Celles que le juge et le dédoublonnage ont gardées. */
  acceptees: number
  refus: Partial<Record<SorteDeRefus, number>>
  /** Les lots qu'aucun agent n'a rendus, passés avec `--forcer` : comptés pour vides. */
  manquants: string[]
}

/** Ce que la relecture d'une vague a changé. */
export interface Relecture {
  le: string
  retirees: number
  corrigees: number
  /** Les lots d'une fiche sans décisions, mis de côté dans `<nom>/a-relire/` : rien ne les range par mégarde. */
  aRelire: string[]
  incidents: string[]
}

/**
 * Des lots écrits en même temps, puis relus en même temps. Chaque pas franchi
 * garde ses comptes : rejoué, il les refait au lieu de les ajouter.
 */
export interface Vague {
  lots: LotPrevu[]
  consignes?: string
  recueil?: Recueil
  fiches?: Fiche[]
  relecture?: Relecture
}

export interface Generation {
  nom: string
  creee: string
  demandees: number
  vagues: Vague[]
}

/** Les comptes de toutes les vagues, ensemble. */
export function totaux(g: Generation) {
  const t = { ecrites: 0, acceptees: 0, refus: {} as Partial<Record<SorteDeRefus, number>>, manquants: [] as string[], retirees: 0, corrigees: 0, aRelire: [] as string[], incidents: [] as string[] }
  for (const v of g.vagues) {
    if (v.recueil) {
      t.ecrites += v.recueil.ecrites
      t.acceptees += v.recueil.acceptees
      for (const [s, n] of Object.entries(v.recueil.refus) as [SorteDeRefus, number][]) t.refus[s] = (t.refus[s] ?? 0) + n
      t.manquants.push(...v.recueil.manquants)
    }
    if (v.relecture) {
      t.retirees += v.relecture.retirees
      t.corrigees += v.relecture.corrigees
      t.aRelire.push(...v.relecture.aRelire)
      t.incidents.push(...v.relecture.incidents)
    }
  }
  t.incidents.unshift(...t.manquants.map(id => `${id} : rendu par aucun agent, compté pour vide`))
  return t
}

/** Les questions, réparties également entre les catégories — les premières en prennent une de plus quand le compte ne tombe pas juste. */
export function repartir(total: number, categories: readonly Categorie[]): Map<Categorie, number> {
  return new Map(categories.map((c, i) => [c, Math.floor(total / categories.length) + (i < total % categories.length ? 1 : 0)]))
}

/** La difficulté qu'on écrit pour une marche (`niveauDeQuestion` : 1 et 2 sont faciles) — deux faciles sur trois à 2. */
const DIFFICULTES_DE_LA_MARCHE: Readonly<Record<Niveau, readonly number[]>> = { facile: [2, 1, 2], moyen: [3], difficile: [4], expert: [5] }

/**
 * Ce qui manque aux sentiers du savoir pour se monter `montees` fois sans
 * quitter leurs thèmes : chaque chapitre (`shared/chapitres.ts`), à la marche
 * que les mélanges de ses deux paliers demandent (`PALIERS`), dans ses
 * sous-thèmes ; puis, si la catégorie en manque encore pour ses derniers
 * paliers et son maître, le reste dans ses sous-thèmes les moins fournis à
 * cette marche — une question à la fois, au moins fourni. Deux montées : une
 * épreuve ratée se rejoue sur des questions neuves. Le choix du 11 octobre
 * 2026 : la commande à parts égales visait les difficultés 4 et 5
 * (`CIBLE_DES_DIFFICULTES`) quand les sentiers manquaient de faciles et de
 * moyennes — 620 dans quarante chapitres sur quarante-huit, pas une au
 * cinéma —, et un chapitre à sec se complète du reste de sa catégorie : son
 * thème s'efface.
 */
export function commandeDesSentiers(existantes: readonly { categorie: string; sousTheme: string; difficulte: number }[], montees = 2): Map<Categorie, QuotaDEcriture[]> {
  const commandes = new Map<Categorie, QuotaDEcriture[]>()
  const besoin = (paliers: readonly number[]) => {
    const b = new Map<Niveau, number>()
    for (const p of paliers) for (const [n, k] of Object.entries(regleDuPalier(p)!.melange) as [Niveau, number][]) b.set(n, (b.get(n) ?? 0) + montees * k)
    return b
  }
  for (const branche of BRANCHES) {
    const categorie = branche.categorie
    const cle = (sousTheme: string, n: Niveau) => `${sousTheme}\u0000${n}`
    // L'offre de chaque sous-thème à chaque marche, qui grandit de ce qu'on commande.
    const offre = new Map<string, number>()
    for (const q of existantes) if (q.categorie === categorie) offre.set(cle(q.sousTheme, niveauDeQuestion(q.difficulte)), (offre.get(cle(q.sousTheme, niveauDeQuestion(q.difficulte))) ?? 0) + 1)
    const deLaMarche = (sousThemes: readonly string[], n: Niveau) => sousThemes.reduce((s, x) => s + (offre.get(cle(x, n)) ?? 0), 0)
    const lignes: QuotaDEcriture[] = []
    const ecrites = new Map<Niveau, number>()
    const combler = (sousThemes: readonly string[], n: Niveau, voulues: number) => {
      for (let manque = voulues - deLaMarche(sousThemes, n); manque > 0; manque--) {
        const s = sousThemes.reduce((a, b) => ((offre.get(cle(b, n)) ?? 0) < (offre.get(cle(a, n)) ?? 0) ? b : a))
        const deja = ecrites.get(n) ?? 0
        const difficulte = DIFFICULTES_DE_LA_MARCHE[n][deja % DIFFICULTES_DE_LA_MARCHE[n].length]
        ecrites.set(n, deja + 1)
        offre.set(cle(s, n), (offre.get(cle(s, n)) ?? 0) + 1)
        const meme = lignes.find(l => l.cle === s && l.difficulte === difficulte)
        if (meme) meme.n++
        else lignes.push({ cle: s, n: 1, difficulte })
      }
    }
    for (const chapitre of chapitresDe(branche.key)) for (const [n, k] of besoin(chapitre.paliers)) combler(chapitre.sousThemes, n, k)
    const tous = SOUS_THEMES[categorie].map(s => s.cle)
    for (const [n, k] of besoin(PALIERS.map(p => p.n))) combler(tous, n, k)
    if (lignes.length > 0) {
      // Dans l'ordre du catalogue, puis des marches : le plan se lit comme les sentiers.
      lignes.sort((a, b) => tous.indexOf(a.cle) - tous.indexOf(b.cle) || (a.difficulte ?? 0) - (b.difficulte ?? 0))
      commandes.set(categorie, lignes)
    }
  }
  return commandes
}

/**
 * Ce qui manque à un thème (`shared/sujets.ts`) pour se monter `montees`
 * fois en sentier à thème et faire une série : à chaque marche, ce que les
 * mélanges de ses six paliers posent (`PALIERS_DES_SUJETS`), et les cinq
 * expertes d'une série, que ses paliers ne posent jamais
 * (`QUESTIONS_PAR_MARCHE`) — écrit dans ses sous-thèmes, au moins fourni
 * d'abord. Ce que ses étiquettes lui apportent compte, mais une étiquette ne
 * se commande pas : elle se pose quand le fait la mérite. Un thème neuf (le
 * souhait du propriétaire du 11 octobre 2026 : « prévoir de rajouter des
 * thèmes ») se remplit ainsi sans attendre que la base le croise.
 */
export function commandeDuTheme(
  theme: Sujet,
  existantes: readonly Pick<MetadonneesDeQuestion, 'categorie' | 'sousTheme' | 'difficulte' | 'etiquettes' | 'date' | 'portee'>[],
  montees = 2,
): Map<Categorie, QuotaDEcriture[]> {
  const paires = (Object.entries(theme.sousThemes ?? {}) as [Categorie, readonly string[]][]).flatMap(([categorie, cles]) => cles.map(sousTheme => ({ categorie, sousTheme })))
  if (paires.length === 0) throw new Error(`« ${theme.nom} » ne se lit que sur ses étiquettes : donne-lui des sous-thèmes pour en commander.`)
  const voulues = new Map<Niveau, number>([['expert', QUESTIONS_PAR_MARCHE]])
  for (const p of PALIERS_DES_SUJETS) for (const [n, k] of Object.entries(p.melange) as [Niveau, number][]) voulues.set(n, (voulues.get(n) ?? 0) + montees * k)
  const cle = (categorie: string, sousTheme: string, n: Niveau) => `${categorie}\u0000${sousTheme}\u0000${n}`
  // L'offre de chacun de ses sous-thèmes à chaque marche, qui grandit de ce qu'on commande ; et ce que le thème a déjà, étiquettes comprises.
  const offre = new Map<string, number>()
  const aDeja = new Map<Niveau, number>()
  for (const q of existantes) {
    if (!sujetsDe(q).includes(theme.cle)) continue
    const n = niveauDeQuestion(q.difficulte)
    aDeja.set(n, (aDeja.get(n) ?? 0) + 1)
    offre.set(cle(q.categorie, q.sousTheme, n), (offre.get(cle(q.categorie, q.sousTheme, n)) ?? 0) + 1)
  }
  const commandes = new Map<Categorie, QuotaDEcriture[]>()
  for (const [n, k] of voulues) {
    for (let manque = k - (aDeja.get(n) ?? 0), i = 0; manque > 0; manque--, i++) {
      const p = paires.reduce((a, b) => ((offre.get(cle(b.categorie, b.sousTheme, n)) ?? 0) < (offre.get(cle(a.categorie, a.sousTheme, n)) ?? 0) ? b : a))
      offre.set(cle(p.categorie, p.sousTheme, n), (offre.get(cle(p.categorie, p.sousTheme, n)) ?? 0) + 1)
      const difficulte = DIFFICULTES_DE_LA_MARCHE[n][i % DIFFICULTES_DE_LA_MARCHE[n].length]
      const lignes = commandes.get(p.categorie) ?? []
      const meme = lignes.find(l => l.cle === p.sousTheme && l.difficulte === difficulte)
      if (meme) meme.n++
      else lignes.push({ cle: p.sousTheme, n: 1, difficulte })
      commandes.set(p.categorie, lignes)
    }
  }
  for (const [categorie, lignes] of commandes) {
    const tous = SOUS_THEMES[categorie].map(s => s.cle)
    lignes.sort((a, b) => tous.indexOf(a.cle) - tous.indexOf(b.cle) || (a.difficulte ?? 0) - (b.difficulte ?? 0))
  }
  return commandes
}

/** Les thèmes qui ont un inventaire (`core/inventaires.ts`), pour les dire quand on se trompe de clé. */
const themesAInventaire = () => SUJETS.filter(s => s.famille === 'theme' && inventairesDuTheme(s).length > 0).map(s => s.cle)

/**
 * Une commande en nombre pour un thème qui a un inventaire
 * (`core/inventaires.ts`) : `total` questions, famille par famille, à
 * proportion de leurs poids (`repartirLesFamilles`). Sans difficulté par
 * ligne : la part la répartit famille par famille — la timba n'a pas de
 * question facile, la Macarena pas d'experte. Le souhait du propriétaire du
 * 15 octobre 2026 : six cents questions par thème, sur toutes les danses et
 * tous les métiers de la santé. Ce que le thème a déjà ne compte pas :
 * `commandeDesManques` ferme l'inventaire ensuite.
 */
export function commandeDeLInventaire(theme: Sujet, total: number): Map<Categorie, QuotaDEcriture[]> {
  const inventaires = inventairesDuTheme(theme)
  if (inventaires.length === 0) throw new Error(`« ${theme.nom} » n'a pas d'inventaire (${themesAInventaire().join(', ')} en ont un) : commande-le avec --theme.`)
  const commandes = new Map<Categorie, QuotaDEcriture[]>()
  for (const { inventaire, famille, n } of repartirLesFamilles(inventaires, total)) {
    if (n === 0) continue
    const lignes = commandes.get(inventaire.categorie) ?? []
    lignes.push({ cle: inventaire.sousTheme, n, famille: famille.nom })
    commandes.set(inventaire.categorie, lignes)
  }
  return commandes
}

/**
 * Ce qu'aucune question du thème n'aborde encore (`couverture`) : une
 * question par sujet de l'inventaire, dans sa famille, le sujet nommé dans la
 * consigne. Le lot qui ferme l'inventaire, après une commande en nombre — la
 * base et les lots en attente comptent, les étiquettes comprises.
 */
export function commandeDesManques(
  theme: Sujet,
  questions: readonly (QuestionCouverte & { meta: Pick<MetadonneesDeQuestion, 'categorie' | 'sousTheme' | 'etiquettes' | 'date' | 'portee' | 'entites'> })[],
): Map<Categorie, QuotaDEcriture[]> {
  const inventaires = inventairesDuTheme(theme)
  if (inventaires.length === 0) throw new Error(`« ${theme.nom} » n'a pas d'inventaire (${themesAInventaire().join(', ')} en ont un).`)
  const siennes = questions.filter(q => sujetsDe(q.meta).includes(theme.cle))
  const commandes = new Map<Categorie, QuotaDEcriture[]>()
  for (const inventaire of inventaires) {
    for (const { famille, sujets } of couverture(inventaire, siennes)) {
      const manquants = sujets.filter(s => s.questions === 0).map(s => s.nom)
      if (manquants.length === 0) continue
      const lignes = commandes.get(inventaire.categorie) ?? []
      lignes.push({ cle: inventaire.sousTheme, n: manquants.length, famille, sujets: manquants })
      commandes.set(inventaire.categorie, lignes)
    }
  }
  return commandes
}

/**
 * Le plan d'une génération : la commande de chaque catégorie, celle de la
 * routine du matin (`commandeDeLaCategorie` : les sous-thèmes et les
 * difficultés qui manquent le plus à la base), découpée en lots d'au plus
 * `parLot` questions et rangée en vagues. Deux lots d'une même vague n'ont
 * jamais un sous-thème en commun : écrits en même temps, ils ne se verraient
 * pas, et poseraient les mêmes faits. Un sous-thème qui demande plus d'un lot
 * en prend un par vague, chacun un peu de chaque difficulté ; la vague
 * suivante s'écrit quand la précédente est recueillie, ses intitulés dans la
 * liste du déjà écrit. Une commande par familles d'un inventaire
 * (`commandeDeLInventaire`) découpe chaque famille à part : deux familles
 * d'un sous-thème — la salsa et les orishas — ne posent pas les mêmes faits,
 * et se partagent une vague ; deux morceaux d'une même famille, jamais.
 */
export function planDeLaGeneration(
  existantes: readonly { categorie: string; sousTheme: string; difficulte: number }[],
  {
    nom,
    questions,
    categories = CATEGORIES,
    parLot = QUESTIONS_PAR_LOT,
    commandes,
  }: {
    nom: string
    questions: number
    categories?: readonly Categorie[]
    parLot?: number
    /** Une commande faite d'avance, par catégorie (`commandeDesSentiers`) : `questions` et `categories` n'y sont pour rien. */
    commandes?: ReadonlyMap<Categorie, QuotaDEcriture[]>
  },
): Vague[] {
  const parVague: Omit<LotPrevu, 'id'>[][] = []
  const aEcrire =
    commandes ??
    new Map(
      [...repartir(questions, categories)].filter(([, n]) => n > 0).map(([c, n]) => [c, commandeDeLaCategorie(c, existantes.filter(q => q.categorie === c), n)] as const),
    )
  for (const [categorie, commande] of aEcrire) {
    // Les morceaux de chaque sous-thème — de chaque famille de son inventaire,
    // quand la commande en vise —, par vague : t questions en font
    // ⌈t / parLot⌉, distribuées une question à la fois pour que chacun ait un
    // peu de chaque difficulté, et chacun ses sujets à couvrir.
    const morceaux: QuotaDEcriture[][][] = []
    for (const { cle } of SOUS_THEMES[categorie]) {
      for (const famille of new Set(commande.filter(l => l.cle === cle).map(l => l.famille))) {
        const lignes = commande.filter(l => l.cle === cle && l.famille === famille)
        const t = lignes.reduce((s, l) => s + l.n, 0)
        if (t === 0) continue
        const m = Math.ceil(t / parLot)
        const parts: QuotaDEcriture[][] = Array.from({ length: m }, () => [])
        let k = 0
        for (const l of lignes) {
          for (let i = 0; i < l.n; i++, k++) {
            const part = parts[k % m]
            const sujet = l.sujets?.[i]
            const meme = part.find(q => q.difficulte === l.difficulte)
            if (meme) {
              meme.n++
              if (sujet !== undefined) meme.sujets = [...(meme.sujets ?? []), sujet]
            } else part.push({ cle, n: 1, difficulte: l.difficulte, ...(famille !== undefined && { famille }), ...(sujet !== undefined && { sujets: [sujet] }) })
          }
        }
        parts.forEach((p, j) => (morceaux[j] ??= []).push(p))
      }
    }
    // Dans une vague, les morceaux de la catégorie se rangent dans des lots
    // d'au plus `parLot` questions : les plus gros d'abord, chacun dans le
    // premier lot où il tient. Pris dans l'ordre du catalogue, ils laissaient
    // des lots de sept questions — un agent, et sa consigne de vingt mille
    // caractères, pour presque rien.
    morceaux.forEach((deLaVague, j) => {
      const lots = (parVague[j] ??= [])
      const ouverts: { quotas: QuotaDEcriture[]; taille: number }[] = []
      for (const morceau of [...deLaVague].sort((a, b) => totalDe({ quotas: b }) - totalDe({ quotas: a }))) {
        const n = totalDe({ quotas: morceau })
        const lot = ouverts.find(o => o.taille + n <= parLot)
        if (lot) {
          lot.quotas.push(...morceau)
          lot.taille += n
        } else ouverts.push({ quotas: [...morceau], taille: n })
      }
      for (const o of ouverts) lots.push({ categorie, quotas: o.quotas })
    })
  }
  const total = parVague.reduce((s, v) => s + v.length, 0)
  const chiffres = Math.max(2, String(total).length)
  let numero = 0
  return parVague.map(lots => ({ lots: lots.map(l => ({ id: `${nom}-${String(++numero).padStart(chiffres, '0')}`, ...l })) }))
}

/** Les intitulés que les sous-thèmes d'un lot ont déjà — la base, puis les lots en attente : ce qu'il ne doit pas reprendre. */
export function dejaEcrites(l: Pick<LotPrevu, 'categorie' | 'quotas'>, connues: readonly Pick<QuestionDeLaBase, 'texte' | 'meta'>[]): string[] {
  const vises = new Set(l.quotas.map(q => q.cle))
  return connues.filter(q => q.meta.categorie === l.categorie && vises.has(q.meta.sousTheme)).map(q => q.texte)
}

const totalDe = (l: Pick<LotPrevu, 'quotas'>) => l.quotas.reduce((s, q) => s + q.n, 0)
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

/**
 * Les décisions d'un fichier de relecture qui visent une question de sa fiche
 * et disent quoi faire ; les autres s'écartent. Une référence recopiée sans
 * son `.json`, entre crochets ou avec des espaces, se retrouve.
 */
export function lireLesDecisions(entrees: readonly unknown[], refs: ReadonlySet<string>): { decisions: Decision[]; ecartees: number } {
  const decisions: Decision[] = []
  for (const e of entrees) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) continue
    const d = e as Record<string, unknown>
    if (typeof d.ref !== 'string') continue
    const nue = d.ref.replace(/[\s[\]]/g, '')
    const ref = refs.has(nue) ? nue : nue.replace(/^([A-Za-z0-9]+-\d+)#/, '$1.json#')
    if (!refs.has(ref)) continue
    const motif = typeof d.motif === 'string' ? { motif: d.motif } : {}
    if (d.action === 'retirer') decisions.push({ ref, action: 'retirer', ...motif })
    else if (d.action === 'corriger' && d.champs && typeof d.champs === 'object' && !Array.isArray(d.champs)) {
      decisions.push({ ref, action: 'corriger', champs: d.champs as Record<string, unknown>, ...motif })
    }
  }
  return { decisions, ecartees: entrees.length - decisions.length }
}

// ── La génération, pas à pas ────────────────────────────────────────────

/** Ce dont la génération a besoin du monde : le dossier des lots, la base du dépôt, les quiz livrés, de quoi parler. */
export interface Contexte {
  dossier: string
  base: readonly QuestionDeLaBase[]
  livres: ReadonlySet<string>
  dire: (ligne: string) => void
}

/** Un agent à lancer : lequel, pour quoi, et sa mission, telle quelle. */
export interface Mission {
  agent: 'redacteur-campagne' | 'relecteur-campagne'
  quoi: string
  mission: string
}

const dossierDe = (ctx: Contexte, nom: string) => path.join(ctx.dossier, nom)
const fichierDuPlan = (ctx: Contexte, nom: string) => path.join(dossierDe(ctx, nom), 'plan.json')
const fichierDuLot = (ctx: Contexte, id: string) => path.join(ctx.dossier, `${id}.json`)
const fichierDeConsigne = (ctx: Contexte, nom: string, id: string) => path.join(dossierDe(ctx, nom), `${id}.consigne.md`)
/** Le lot tel que la vague l'a recueilli, jugé : la relecture repart toujours de lui, et se rejoue sans retirer deux fois. */
const fichierRecueilli = (ctx: Contexte, nom: string, id: string) => path.join(dossierDe(ctx, nom), 'recueillis', `${id}.json`)
const fichierDeFiche = (ctx: Contexte, nom: string, fiche: string) => path.join(dossierDe(ctx, nom), `${fiche}.txt`)
const fichierDeDecisions = (ctx: Contexte, nom: string, fiche: string) => path.join(dossierDe(ctx, nom), `${fiche}.decisions.json`)
const maintenant = () => new Date().toISOString()

export function sauver(ctx: Contexte, g: Generation) {
  mkdirSync(dossierDe(ctx, g.nom), { recursive: true })
  writeFileSync(fichierDuPlan(ctx, g.nom), `${JSON.stringify(g, null, 2)}\n`)
}

/** Les générations du dossier, de la plus récente à la plus ancienne. */
function generations(ctx: Contexte): Generation[] {
  if (!existsSync(ctx.dossier)) return []
  return readdirSync(ctx.dossier)
    .filter(n => existsSync(fichierDuPlan(ctx, n)))
    .map(n => JSON.parse(readFileSync(fichierDuPlan(ctx, n), 'utf8')) as Generation)
    .sort((a, b) => b.creee.localeCompare(a.creee))
}

export function charger(ctx: Contexte, nom?: string): Generation {
  const g = nom ? generations(ctx).find(x => x.nom === nom) : generations(ctx)[0]
  if (!g) throw new Error(nom ? `Aucune génération « ${nom} » dans ${ctx.dossier}.` : `Aucune génération dans ${ctx.dossier} : prépares-en une avec « preparer ».`)
  return g
}

/** Finie : chaque vague écrite, recueillie et relue. */
export const finie = (g: Generation) => g.vagues.every(v => !!v.relecture)

/** Le premier nom libre, g1, g2… : ni son dossier, ni un lot à son nom. */
function nomLibre(dossier: string): string {
  const pris = existsSync(dossier) ? readdirSync(dossier) : []
  for (let i = 1; ; i++) {
    const nom = `g${i}`
    if (!pris.some(f => f === nom || f.startsWith(`${nom}-`) || f.startsWith(`${nom}.`))) return nom
  }
}

/** Ce que la base et les lots en attente ont déjà, sauf les lots nommés : ce qu'une écriture ne doit pas reprendre. */
function enAttente(ctx: Contexte, sauf: ReadonlySet<string> = new Set()) {
  return lotsEnAttente(ctx.dossier, new Set(ctx.base.map(q => q.empreinte)), sauf)
}

export interface OptionsDePreparation {
  questions?: number
  categories?: readonly Categorie[]
  parLot?: number
  nom?: string
  /** Écrire ce qui manque aux sentiers pour se monter autant de fois (`commandeDesSentiers`), au lieu de `questions` à parts égales. */
  sentiers?: number
  /** Écrire ce qui manque à ce thème pour se monter deux fois (`commandeDuTheme`). */
  theme?: string
  /**
   * Écrire `questions` questions pour ce thème, famille par famille de son
   * inventaire (`commandeDeLInventaire`) — ou, avec `manques`, une par sujet
   * qu'aucune question n'aborde encore (`commandeDesManques`).
   */
  inventaire?: string
  manques?: boolean
}

/**
 * Le plan, puis les consignes de sa première vague. Une génération à la fois :
 * deux, écrites en même temps, viseraient les mêmes sous-thèmes — ce qui
 * manque à la base — sans se voir.
 */
export function preparer(ctx: Contexte, o: OptionsDePreparation): { generation: Generation; missions: Mission[] } {
  if ([o.questions, o.sentiers, o.theme].filter(x => x !== undefined).length > 1) throw new Error('--questions, --sentiers ou --theme : un seul à la fois.')
  if (o.inventaire !== undefined && (o.sentiers !== undefined || o.theme !== undefined)) throw new Error('--inventaire ne se mêle ni à --sentiers ni à --theme.')
  if (o.manques && o.inventaire === undefined) throw new Error('--manques ne va qu’avec --inventaire=<clé>.')
  if (o.sentiers !== undefined && (!Number.isInteger(o.sentiers) || o.sentiers < 1 || o.sentiers > 5)) throw new Error('--sentiers=<montées> : de 1 à 5 montées de chaque sentier.')
  const theme = o.theme === undefined ? undefined : sujetParCle(o.theme)
  if (o.theme !== undefined && theme?.famille !== 'theme') {
    throw new Error(`--theme=<clé> : l'un des thèmes de shared/sujets.ts (${SUJETS.filter(s => s.famille === 'theme').map(s => s.cle).join(', ')}).`)
  }
  const inventaire = o.inventaire === undefined ? undefined : sujetParCle(o.inventaire)
  if (o.inventaire !== undefined && (inventaire?.famille !== 'theme' || inventairesDuTheme(inventaire).length === 0)) {
    throw new Error(`--inventaire=<clé> : un thème qui a un inventaire (${themesAInventaire().join(', ')}).`)
  }
  if (inventaire && (o.manques ? o.questions !== undefined : !Number.isInteger(o.questions) || o.questions! < 1)) {
    throw new Error('--inventaire=<clé> : avec --questions=<nombre>, ou avec --manques — l’un ou l’autre.')
  }
  if (o.sentiers === undefined && !theme && !inventaire && (!Number.isInteger(o.questions) || o.questions! < 1)) throw new Error('--questions=<nombre> : combien de questions écrire, en tout.')
  const parLot = o.parLot ?? QUESTIONS_PAR_LOT
  if (!Number.isInteger(parLot) || parLot < 5 || parLot > 40) throw new Error('--par-lot : de 5 à 40 questions par lot.')
  const enCours = generations(ctx).find(x => !finie(x))
  if (enCours) throw new Error(`« ${enCours.nom} » n'est pas finie : mène-la au bout (« suite ${enCours.nom} »), ou abandonne-la en supprimant ${dossierDe(ctx, enCours.nom)} et ses lots.`)
  mkdirSync(ctx.dossier, { recursive: true })
  const nom = o.nom ?? nomLibre(ctx.dossier)
  if (!/^[A-Za-z0-9]{1,20}$/.test(nom)) throw new Error(`--nom : des lettres et des chiffres seulement, vingt au plus (${nom}).`)
  if (nom !== nomLibre(ctx.dossier) && readdirSync(ctx.dossier).some(f => f === nom || f.startsWith(`${nom}-`) || f.startsWith(`${nom}.`))) {
    throw new Error(`« ${nom} » existe déjà dans ${ctx.dossier} : choisis un autre --nom.`)
  }
  const lues = [...ctx.base, ...enAttente(ctx).map(a => a.question)]
  const connues = lues.map(q => ({ categorie: q.meta.categorie, sousTheme: q.meta.sousTheme, difficulte: q.meta.difficulte }))
  const commandes = theme
    ? commandeDuTheme(theme, lues.map(q => q.meta))
    : inventaire
      ? o.manques
        ? commandeDesManques(inventaire, lues)
        : commandeDeLInventaire(inventaire, o.questions!)
      : o.sentiers === undefined
        ? undefined
        : commandeDesSentiers(connues, o.sentiers)
  const demandees = commandes ? [...commandes.values()].flat().reduce((s, l) => s + l.n, 0) : o.questions!
  if (demandees === 0) {
    throw new Error(
      theme
        ? `« ${theme.nom} » a de quoi se monter deux fois : rien à écrire.`
        : inventaire
          ? `« ${inventaire.nom} » : chaque sujet de son inventaire a déjà sa question.`
          : `Les sentiers ont de quoi se monter ${o.sentiers} fois : rien à écrire.`,
    )
  }
  const g: Generation = {
    nom,
    creee: maintenant(),
    demandees,
    vagues: planDeLaGeneration(connues, { nom, questions: demandees, categories: o.categories, parLot, commandes }),
  }
  direLePlan(ctx, g)
  ecrireLesConsignes(ctx, g, 0)
  sauver(ctx, g)
  const missions = g.vagues[0].lots.map(l => missionDEcriture(ctx, g, l))
  direLesMissions(ctx, g, missions)
  return { generation: g, missions }
}

function direLePlan(ctx: Contexte, g: Generation) {
  const lots = g.vagues.flatMap(v => v.lots)
  ctx.dire(`${g.nom} : ${g.demandees} questions, en ${pluriel(lots.length, 'lot')} et ${pluriel(g.vagues.length, 'vague')}.`)
  for (const c of CATEGORIES) {
    const siens = lots.filter(l => l.categorie === c)
    if (siens.length === 0) continue
    const quotas = siens.flatMap(l => l.quotas)
    const parSousTheme = SOUS_THEMES[c].map(s => [s.cle, quotas.filter(q => q.cle === s.cle).reduce((t, q) => t + q.n, 0)] as const).filter(([, n]) => n > 0)
    ctx.dire(`  ${c} : ${siens.reduce((s, l) => s + totalDe(l), 0)} questions, ${pluriel(siens.length, 'lot')} — ${parSousTheme.map(([k, n]) => `${k} ${n}`).join(' · ')}`)
    // Une commande par familles d'un inventaire les dit sous leur sous-thème.
    for (const [cle] of parSousTheme) {
      const familles = [...new Set(quotas.filter(q => q.cle === cle && q.famille).map(q => q.famille!))]
      const deLaFamille = (f: string) => quotas.filter(q => q.cle === cle && q.famille === f).reduce((t, q) => t + q.n, 0)
      if (familles.length > 0) ctx.dire(`    ${cle} : ${familles.map(f => `${f} ${deLaFamille(f)}`).join(' · ')}`)
    }
  }
}

/** Les consignes d'une vague, une par lot, avec ce que ses sous-thèmes ont déjà — la base et les lots en attente, les vagues d'avant comprises. */
function ecrireLesConsignes(ctx: Contexte, g: Generation, w: number) {
  const v = g.vagues[w]
  const sauf = new Set(v.lots.map(l => `${l.id}.json`))
  const connues = [...ctx.base, ...enAttente(ctx, sauf).map(a => a.question)]
  mkdirSync(dossierDe(ctx, g.nom), { recursive: true })
  for (const l of v.lots) {
    const consigne = consigneDEcriture(l.categorie, l.quotas, { sorte: 'fichier', fichier: fichierDuLot(ctx, l.id) }, dejaEcrites(l, connues))
    writeFileSync(fichierDeConsigne(ctx, g.nom, l.id), consigne)
  }
  v.consignes = maintenant()
}

function missionDEcriture(ctx: Contexte, g: Generation, l: LotPrevu): Mission {
  return {
    agent: 'redacteur-campagne',
    quoi: `${l.id} · ${l.categorie} · ${totalDe(l)} questions`,
    mission: `Ta consigne est dans ${fichierDeConsigne(ctx, g.nom, l.id)} : lis-la en entier avec Read, écris tes ${totalDe(l)} questions dans ${fichierDuLot(ctx, l.id)}, puis vérifie-les comme elle le dit, jusqu'à zéro refus.`,
  }
}

function missionDeRelecture(ctx: Contexte, g: Generation, f: Fiche, questions: number): Mission {
  return {
    agent: 'relecteur-campagne',
    quoi: `${g.nom}/${f.nom} · ${questions} questions`,
    mission: `Ta fiche est dans ${fichierDeFiche(ctx, g.nom, f.nom)} : relis-la, et écris tes décisions dans ${fichierDeDecisions(ctx, g.nom, f.nom)}.`,
  }
}

/** Un lot qu'un agent a rendu : son fichier existe, et se lit. */
function lotRendu(ctx: Contexte, id: string): unknown[] | null {
  try {
    return lireLot(fichierDuLot(ctx, id))
  } catch {
    return null
  }
}

/**
 * Recueille une vague écrite : chaque entrée passe par le juge et le
 * dédoublonnage du rangement — contre la base, les quiz livrés, les lots en
 * attente et ce que la vague a déjà gardé —, lot après lot dans l'ordre du
 * plan, pour qu'un doublon se tranche toujours pareil. Chaque lot ne garde
 * que ses acceptées ; les refusées se disent, avec leur motif, dans
 * `refus-<vague>.txt`. Ce que chaque agent a vérifié seul, la vague le
 * revérifie ensemble : deux agents ont pu poser le même fait.
 */
function recueillir(ctx: Contexte, g: Generation, w: number) {
  const v = g.vagues[w]
  const sauf = new Set(v.lots.map(l => `${l.id}.json`))
  const tri = new TriDesEntrees(ctx.base, ctx.livres)
  for (const a of enAttente(ctx, sauf)) tri.retenir(a.question, a.ou)
  const recueil: Recueil = { le: maintenant(), ecrites: 0, acceptees: 0, refus: {}, manquants: [] }
  const refus: string[] = []
  mkdirSync(path.join(dossierDe(ctx, g.nom), 'recueillis'), { recursive: true })
  for (const l of v.lots) {
    const entrees = lotRendu(ctx, l.id)
    if (!entrees) recueil.manquants.push(l.id)
    const gardees: unknown[] = []
    recueil.ecrites += entrees?.length ?? 0
    for (const [i, e] of (entrees ?? []).entries()) {
      const jugee = tri.juger(e, `${l.id}.json#${i}`)
      if ('refus' in jugee) {
        recueil.refus[jugee.sorte] = (recueil.refus[jugee.sorte] ?? 0) + 1
        refus.push(`${l.id}.json#${i} « ${String((e as { texte?: unknown })?.texte ?? '').slice(0, 100)} » — ${jugee.refus}`)
      } else gardees.push(e)
    }
    recueil.acceptees += gardees.length
    for (const f of [fichierDuLot(ctx, l.id), fichierRecueilli(ctx, g.nom, l.id)]) {
      if (gardees.length > 0) ecrireLot(f, gardees)
      else rmSync(f, { force: true })
    }
  }
  writeFileSync(path.join(dossierDe(ctx, g.nom), `refus-${w + 1}.txt`), refus.map(r => `${r}\n`).join(''))
  v.recueil = recueil
  ctx.dire(`Vague ${w + 1}/${g.vagues.length} recueillie : ${recueil.acceptees} question(s) gardée(s), ${refus.length} refusée(s) (le détail : ${g.nom}/refus-${w + 1}.txt).`)
}

/** Les fiches de relecture d'une vague recueillie : ses lots, regroupés par centaine de questions. */
function ecrireLesFiches(ctx: Contexte, g: Generation, w: number) {
  const v = g.vagues[w]
  const fiches: Fiche[] = []
  let courante: string[] = []
  let taille = 0
  const fermer = () => {
    if (courante.length > 0) fiches.push({ nom: `fiche-${w + 1}-${fiches.length + 1}`, lots: courante })
    courante = []
    taille = 0
  }
  for (const l of v.lots) {
    const f = fichierRecueilli(ctx, g.nom, l.id)
    if (!existsSync(f)) continue
    const n = lireLot(f).length
    if (taille > 0 && taille + n > QUESTIONS_PAR_FICHE) fermer()
    courante.push(l.id)
    taille += n
  }
  fermer()
  for (const f of fiches) {
    const lignes = f.lots.flatMap(id => lireLot(fichierRecueilli(ctx, g.nom, id)).map((e, i) => ficheDUneEntree(`${id}.json#${i}`, e)))
    writeFileSync(fichierDeFiche(ctx, g.nom, f.nom), `${lignes.join('\n')}\n`)
  }
  v.fiches = fiches
}

const questionsDeLaFiche = (ctx: Contexte, g: Generation, f: Fiche) => f.lots.reduce((s, id) => s + lireLot(fichierRecueilli(ctx, g.nom, id)).length, 0)

/** Les décisions qu'un correcteur a rendues pour une fiche ; null tant qu'il n'a rien écrit qui se lise. */
function decisionsRendues(ctx: Contexte, g: Generation, f: Fiche): { decisions: Decision[]; ecartees: number } | null {
  let brut: unknown
  try {
    brut = JSON.parse(readFileSync(fichierDeDecisions(ctx, g.nom, f.nom), 'utf8'))
  } catch {
    return null
  }
  if (!Array.isArray(brut)) return null
  const refs = new Set(f.lots.flatMap(id => lireLot(fichierRecueilli(ctx, g.nom, id)).map((_, i) => `${id}.json#${i}`)))
  return lireLesDecisions(brut, refs)
}

/**
 * Les décisions d'une vague, appliquées aux lots tels qu'elle les a
 * recueillis — rejouée, elle ne retire pas deux fois. Les lots d'une fiche
 * sans décisions (passée avec `--forcer`) partent dans `<nom>/a-relire/`,
 * hors de portée de `ranger <nom>-*.json` : une question non relue n'entre
 * pas par mégarde.
 */
function appliquerLaRelecture(ctx: Contexte, g: Generation, w: number) {
  const v = g.vagues[w]
  const lots = new Map<string, unknown[]>()
  const decisions: Decision[] = []
  const nonRelus: string[] = []
  const incidents: string[] = []
  for (const f of v.fiches ?? []) {
    const rendues = decisionsRendues(ctx, g, f)
    if (!rendues) {
      incidents.push(`${g.nom}/${f.nom} : aucune décision rendue, ses lots sont mis de côté`)
      nonRelus.push(...f.lots.map(id => `${id}.json`))
      continue
    }
    if (rendues.ecartees > 0) incidents.push(`${g.nom}/${f.nom} : ${rendues.ecartees} décision(s) illisible(s), écartée(s)`)
    for (const id of f.lots) lots.set(`${id}.json`, lireLot(fichierRecueilli(ctx, g.nom, id)))
    decisions.push(...rendues.decisions)
  }
  const fait = appliquerLesDecisions(decisions, lots)
  for (const d of fait.ignorees) incidents.push(`${d.ref} : correction sans champ corrigeable (${Object.keys(d.champs ?? {}).join(', ') || 'aucun'}), ignorée`)
  for (const [nom, entrees] of lots) {
    const apres = fait.lots.get(nom) ?? entrees
    if (apres.length > 0) ecrireLot(path.join(ctx.dossier, nom), apres)
    else rmSync(path.join(ctx.dossier, nom), { force: true })
  }
  const aRelire = path.join(dossierDe(ctx, g.nom), 'a-relire')
  for (const nom of nonRelus) {
    mkdirSync(aRelire, { recursive: true })
    if (existsSync(path.join(ctx.dossier, nom))) renameSync(path.join(ctx.dossier, nom), path.join(aRelire, nom))
  }
  const texteDe = (ref: string) => {
    const [nom, i] = ref.split('#')
    return String((lots.get(nom)?.[Number(i)] as { texte?: unknown } | undefined)?.texte ?? '')
  }
  const ignorees = new Set(fait.ignorees)
  const quoi = (d: Decision) => (d.action === 'retirer' ? 'retirée' : `${ignorees.has(d) ? 'ignorée, sans champ corrigeable' : 'corrigée'} (${Object.keys(d.champs ?? {}).join(', ')})`)
  const journal = decisions.map(d => `${quoi(d)} ${d.ref} « ${texteDe(d.ref)} » — ${d.motif ?? 'sans motif'}`)
  writeFileSync(path.join(dossierDe(ctx, g.nom), `relecture-${w + 1}.txt`), journal.map(l => `${l}\n`).join(''))
  v.relecture = { le: maintenant(), retirees: fait.retirees, corrigees: fait.corrigees, aRelire: nonRelus, incidents }
  ctx.dire(
    `Vague ${w + 1}/${g.vagues.length} relue : ${fait.retirees} question(s) retirée(s), ${fait.corrigees} corrigée(s) (le détail : ${g.nom}/relecture-${w + 1}.txt)${nonRelus.length > 0 ? ` ; ${nonRelus.length} lot(s) sans relecture, mis de côté` : ''}.`,
  )
}

/**
 * Tout ce qui peut se faire, dans l'ordre : recueillir chaque vague écrite,
 * écrire les consignes de la suivante, les fiches de la vague recueillie,
 * appliquer les décisions rendues — puis les agents à lancer : les lots et
 * les fiches qui attendent leur agent. Une vague se relit pendant que la
 * suivante s'écrit. `forcer` passe outre ce qu'aucun agent n'a rendu, mais
 * seulement pour ce qui était déjà demandé avant cet appel.
 */
export function suite(ctx: Contexte, g: Generation, { forcer = false } = {}): Mission[] {
  const missions: Mission[] = []
  const demandes = new Set(g.vagues.filter(v => v.consignes))
  const fichesDemandees = new Set(g.vagues.filter(v => v.fiches))
  for (let w = 0; w < g.vagues.length; w++) {
    const v = g.vagues[w]
    if (!v.consignes) {
      if (w > 0 && !g.vagues[w - 1].recueil) break
      ecrireLesConsignes(ctx, g, w)
      ctx.dire(`Vague ${w + 1}/${g.vagues.length} : ${v.lots.length} consignes écrites.`)
    }
    if (!v.recueil) {
      const manquants = v.lots.filter(l => !lotRendu(ctx, l.id))
      if (manquants.length > 0 && !(forcer && demandes.has(v))) {
        missions.push(...manquants.map(l => missionDEcriture(ctx, g, l)))
        continue
      }
      recueillir(ctx, g, w)
    }
    if (!v.fiches) ecrireLesFiches(ctx, g, w)
    if (!v.relecture) {
      const attendues = v.fiches!.filter(f => !decisionsRendues(ctx, g, f))
      if (attendues.length > 0 && !(forcer && fichesDemandees.has(v))) {
        missions.push(...attendues.map(f => missionDeRelecture(ctx, g, f, questionsDeLaFiche(ctx, g, f))))
        continue
      }
      appliquerLaRelecture(ctx, g, w)
    }
  }
  sauver(ctx, g)
  if (finie(g)) ctx.dire(`\n${bilanDe(g)}`)
  else direLesMissions(ctx, g, missions)
  return missions
}

function direLesMissions(ctx: Contexte, g: Generation, missions: readonly Mission[]) {
  if (missions.length === 0) return ctx.dire(`Rien à lancer : « suite ${g.nom} » avance d'elle-même.`)
  ctx.dire(`\nÀ lancer — un agent par mission, en parallèle (une dizaine à la fois), puis « suite ${g.nom} » :`)
  for (const m of missions) ctx.dire(`  [${m.agent}] ${m.quoi}\n    ${m.mission}`)
}

/** Le bilan d'une génération : ce qui est gardé, ce qui est tombé et pourquoi, et quoi faire ensuite. */
export function bilanDe(g: Generation): string {
  const b = totaux(g)
  const NOMS: Record<SorteDeRefus, string> = { juge: 'par le juge', fait: 'même fait', doublon: 'même intitulé', base: 'déjà dans la base', livre: 'déjà dans un quiz livré' }
  const refus = (Object.entries(b.refus) as [SorteDeRefus, number][]).filter(([, n]) => n > 0)
  const gardees = b.acceptees - b.retirees
  const lignes = [
    `${g.nom} — finie.`,
    `Demandées : ${g.demandees} · écrites : ${b.ecrites} · gardées par le juge : ${b.acceptees}${refus.length > 0 ? ` (refusées : ${refus.map(([s, n]) => `${NOMS[s]} ${n}`).join(', ')})` : ''}.`,
    `Relecture : ${b.retirees} retirée(s), ${b.corrigees} corrigée(s). Gardées en tout : ${gardees}, dans ${g.nom}-*.json.`,
  ]
  if (b.incidents.length > 0) lignes.push(`Incidents (${b.incidents.length}) :`, ...b.incidents.map(i => `  ${i}`))
  if (b.aRelire.length > 0) lignes.push(`Sans relecture, mis de côté dans ${g.nom}/a-relire/ : ${b.aRelire.join(', ')} — relis-les (skill base-campagne), puis remets-les dans le dossier des lots.`)
  if (gardees > 0) {
    lignes.push(
      'Ensuite, depuis server/ :',
      `  npx tsx scripts/base-campagne.ts voisines ../.lots-campagne/${g.nom}-*.json`,
      `  npx tsx scripts/base-campagne.ts ranger ../.lots-campagne/${g.nom}-*.json`,
      '  puis commite server/content/campagne/.',
    )
  }
  return lignes.join('\n')
}

/** Où en est une génération : chaque vague, pas à pas, et ce qui reste à faire. */
export function etat(ctx: Contexte, g: Generation) {
  const lots = g.vagues.flatMap(v => v.lots)
  ctx.dire(`${g.nom}, préparée le ${g.creee.slice(0, 16).replace('T', ' à ')} : ${g.demandees} questions, ${lots.length} lots, ${g.vagues.length} vague(s).`)
  for (const [w, v] of g.vagues.entries()) {
    const ecrits = v.lots.filter(l => existsSync(fichierDuLot(ctx, l.id)) || existsSync(fichierRecueilli(ctx, g.nom, l.id))).length
    const pas = !v.consignes
      ? 'à venir'
      : !v.recueil
        ? `${ecrits}/${v.lots.length} lots écrits`
        : !v.relecture
          ? `recueillie, ${(v.fiches ?? []).filter(f => decisionsRendues(ctx, g, f)).length}/${v.fiches?.length ?? 0} fiches relues`
          : 'relue'
    ctx.dire(`  vague ${w + 1} : ${v.lots.length} lots — ${pas}`)
  }
  ctx.dire(finie(g) ? `\n${bilanDe(g)}` : `Ensuite : « suite ${g.nom} ».`)
}

// ── La ligne de commande ────────────────────────────────────────────────

function lireLesOptions(args: readonly string[], permises: readonly string[]): { mots: string[]; options: Map<string, string> } {
  const options = new Map<string, string>()
  const mots: string[] = []
  for (const a of args) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a)
    if (!m) mots.push(a)
    else if (!permises.includes(m[1])) throw new Error(`Option inconnue : --${m[1]} (${permises.map(k => `--${k}`).join(', ') || 'aucune'}).`)
    else options.set(m[1], m[2] ?? 'oui')
  }
  return { mots, options }
}

function principal(args: readonly string[]) {
  const [commande, ...reste] = args
  const { questions: base, refusees } = lireLaBase()
  if (refusees.length > 0) console.warn(`La base a ${refusees.length} entrée(s) défectueuse(s) : elles ne comptent pas.`)
  const ctx: Contexte = { dossier: DOSSIER_DES_LOTS, base, livres: empreintesDesLivres(), dire: ligne => console.log(ligne) }
  if (commande === 'preparer') {
    const { options } = lireLesOptions(reste, ['questions', 'categories', 'par-lot', 'nom', 'sentiers', 'theme', 'inventaire', 'manques'])
    const categories = options.get('categories')?.split(',').map(nom => {
      const c = categorieDe(nom)
      if (!c) throw new Error(`Catégorie inconnue : ${nom} (${CATEGORIES.join(', ')}).`)
      return c
    })
    const sentiers = options.get('sentiers')
    preparer(ctx, {
      questions: options.has('questions') ? Number(options.get('questions')) : undefined,
      categories,
      parLot: options.has('par-lot') ? Number(options.get('par-lot')) : undefined,
      nom: options.get('nom'),
      // `--sentiers` seul : deux montées.
      sentiers: sentiers === undefined ? undefined : sentiers === 'oui' ? 2 : Number(sentiers),
      theme: options.get('theme'),
      inventaire: options.get('inventaire'),
      manques: options.has('manques'),
    })
  } else if (commande === 'suite') {
    const { mots, options } = lireLesOptions(reste, ['forcer'])
    suite(ctx, charger(ctx, mots[0]), { forcer: options.has('forcer') })
  } else if (commande === 'etat') {
    const { mots } = lireLesOptions(reste, [])
    etat(ctx, charger(ctx, mots[0]))
  } else {
    console.log('generer-campagne.ts preparer --questions=<n> | suite [<nom>] [--forcer] | etat [<nom>] — le détail en tête du script.')
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    principal(process.argv.slice(2))
  } catch (e) {
    console.error((e as Error).message)
    process.exitCode = 1
  }
}
