// Le banc du Cabinet de curiosités : une base de campagne d'essai qui a de quoi
// jouer ses jeux, son magasin seul sur une base jetable — deux magasins sur la
// même base font deux serveurs pendant une mise en ligne, chacun sa mémoire —,
// et de quoi lire en base ce que la page ne voit jamais (le plan figé, ses
// bonnes réponses). Pas un fichier de tests : ceux du Cabinet le partagent.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { CampagneStore } from '../src/core/campagne'
import { REVEIL_DU_CABINET } from '../src/core/cabinet/tables'
import { CabinetStore, type ReglagesDuCabinet } from '../src/core/cabinet/magasin'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import type { DepartDUnePartie, GesteDuCabinet } from '../../shared/cabinet/partie'
import { lireLeDepart } from '../../shared/cabinet/lecture'
import type { PariTire } from '../../shared/cabinet/jeux/pari'
import type { EclairTire } from '../../shared/cabinet/jeux/eclair'
import { adresseDUnCadrage, type DetailTire } from '../../shared/cabinet/jeux/detail'
import type { FriseTiree } from '../../shared/cabinet/jeux/frise'
import type { MotTire } from '../../shared/cabinet/jeux/mot'
import type { FiletTire, TailleDuFilet } from '../../shared/cabinet/jeux/filet'
import type { PageDuCabinet, VueDeLaPartie } from '../../shared/cabinet/vues'
import type { QuizServerOptions } from '../src/server'
import { demarrer, ecrire, type Banc } from './banc'

/** Une question d'essai relue par le juge de la base, ses métadonnées d'office : celles qu'on donne, la bonne réponse en tête. */
function questionDEssai(q: { id: string; texte: string; reponses: string[]; leurres: string[]; categorie: Categorie; difficulte: number; valeur?: { nombre: number; unite: string }; annee?: number }): QuestionDeLaBase {
  const lu = lireQuestionDeLaBase({
    id: q.id,
    texte: q.texte,
    reponses: q.reponses,
    bonne: 0,
    anecdote: `L'anecdote de la question ${q.id}.`,
    categorie: q.categorie,
    sousTheme: SOUS_THEMES[q.categorie][0].cle,
    etiquettes: [],
    difficulte: q.difficulte,
    ageMin: 10,
    date: q.annee === undefined ? null : { valeur: String(q.annee), precision: 'annee' },
    entites: [],
    portee: 'monde',
    valeur: q.valeur ?? null,
    leurres: q.leurres,
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(`question ${q.id} : ${lu.refus}`)
  return lu.question
}

/** Une question d'essai de la catégorie et de la difficulté qu'on veut : 2 facile, 3 moyenne, 4 difficile. Quatre réponses courtes, que l'intitulé ne dit pas. */
export function questionDuCabinet(i: number, categorie: Categorie, difficulte: number): QuestionDeLaBase {
  const autres = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => `Autre ${l}${i}`)
  return questionDEssai({
    id: `cab${String(i).padStart(5, '0')}`,
    texte: `Question d'essai numéro ${i} du Cabinet : laquelle est la bonne ?`,
    reponses: [`Bonne ${i}`, ...autres.slice(0, 3)],
    leurres: autres,
    categorie,
    difficulte,
  })
}

/** Les mots du Mot mystère d'essai : vingt-quatre, distincts, de cinq à sept lettres, deux par catégorie. */
const MOTS_D_ESSAI = ['Balcon', 'Cerise', 'Domino', 'Falaise', 'Girafe', 'Harpe', 'Igloo', 'Jardin', 'Lagune', 'Marmite', 'Nuage', 'Orage', 'Paprika', 'Quartz', 'Radeau', 'Sabre', 'Tulipe', 'Valse', 'Wagon', 'Yaourt', 'Zeste', 'Abeille', 'Bougie', 'Citron']

/**
 * Une question du Mot mystère d'essai, la `n`-ième (0 à 23) : sa bonne réponse
 * un mot à taper, ses autres réponses d'autres mots, un intitulé sans chiffre
 * qui ne le dit pas (`motDeLaQuestion`). Facile aux rangs pairs, moyenne aux
 * impairs.
 */
export function motDuCabinet(n: number, categorie: Categorie): QuestionDeLaBase {
  const mot = (k: number) => MOTS_D_ESSAI[(n + k) % MOTS_D_ESSAI.length]
  return questionDEssai({
    id: `mot${String(n).padStart(5, '0')}`,
    texte: `Quel mot le Cabinet cache-t-il en ${categorie}, à la marche ${n % 2 === 0 ? 'facile' : 'moyenne'} ?`,
    reponses: [mot(0), mot(1), mot(2), mot(3)],
    leurres: [mot(1), mot(2), mot(3), mot(4), mot(5), mot(6)],
    categorie,
    difficulte: n % 2 === 0 ? 2 : 3,
  })
}

/** Une question « En quelle année… » d'essai, facile, à l'année qu'on veut — ses autres réponses plus tard qu'elle. */
export function anneeDuCabinet(n: number, categorie: Categorie, annee: number): QuestionDeLaBase {
  const ans = (ecarts: number[]) => ecarts.map(e => String(annee + e))
  return questionDEssai({
    id: `fil${String(n).padStart(5, '0')}`,
    texte: `En quelle année le Cabinet date-t-il son essai en ${categorie} ?`,
    reponses: ans([0, 13, 29, 41]),
    leurres: ans([13, 29, 41, 5, 19, 37]),
    categorie,
    difficulte: 2,
    valeur: { nombre: annee, unite: '' },
    annee,
  })
}

/**
 * Une question du Filet d'essai, la `n`-ième (0 à 23) : une année entière aux
 * rangs pairs, faciles — de 1500 à 1742, loin de l'année du départ —, une
 * estimation en kilomètres aux impairs, moyennes ; l'intitulé ne dit pas la
 * valeur (`valeurDuFilet`).
 */
export function valeurDuCabinet(n: number, categorie: Categorie): QuestionDeLaBase {
  if (n % 2 === 0) return anneeDuCabinet(n, categorie, 1500 + 11 * n)
  const km = 1200 + 31 * n
  const kms = (ecarts: number[]) => ecarts.map(e => `${km + e} km`)
  return questionDEssai({
    id: `fil${String(n).padStart(5, '0')}`,
    texte: `Combien de kilomètres le Cabinet compte-t-il en ${categorie} ?`,
    reponses: kms([0, 250, 500, 750]),
    leurres: kms([250, 500, 750, 100, 350, 600]),
    categorie,
    difficulte: 3,
    valeur: { nombre: km, unite: 'km' },
  })
}

/**
 * Huit questions de chaque marche — facile, moyenne, difficile — dans chacune des douze catégories : le Pari et l'Éclair y
 * trouvent toujours à poser ; et, dans chacune, deux mots à taper et deux valeurs à viser, une facile et une moyenne : le Mot
 * mystère et le Filet aussi, une case de la visite de n'importe quel jeu livré.
 */
export function baseDuCabinet(parMarche = 8): BaseDeLaCampagne {
  return new BaseDeLaCampagne([
    ...CATEGORIES.flatMap((c, k) => [2, 3, 4].flatMap((d, m) => Array.from({ length: parMarche }, (_, i) => questionDuCabinet(k * 1000 + m * 100 + i, c, d)))),
    ...CATEGORIES.flatMap((c, k) => [2 * k, 2 * k + 1].flatMap(n => [motDuCabinet(n, c), valeurDuCabinet(n, c)])),
  ])
}

/** Samedi 24 octobre 2026, 10 h à Paris — la veille d'Halloween : aucun calendrier à fermer, l'horloge à la main. */
export const DIX_HEURES = Date.UTC(2026, 9, 24, 8, 0)

/** Un serveur du Cabinet sans serveur : la campagne et le Cabinet sur une base jetable, l'horloge à la main. */
export interface MagasinDEssai {
  campagne: CampagneStore
  cabinet: CabinetStore
  fichier: string
}

/** Les dossiers et les magasins ouverts, refermés d'un coup (`fermerLesMagasins`). */
const ouverts: { dossiers: string[]; campagnes: CampagneStore[] } = { dossiers: [], campagnes: [] }

/** Un dossier jetable, pour une ou plusieurs bases. */
export function dossierDEssai(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'quizz-cabinet-'))
  ouverts.dossiers.push(d)
  return d
}

/**
 * Un magasin du Cabinet sur la base `fichier` — la même pour deux magasins :
 * deux serveurs, deux mémoires, une base. Ni profils ni étagère : aucun
 * légendaire, rien à ranger ; le calendrier des fêtes fermé, sauf à en donner
 * un (`calendrier`).
 */
export async function magasinDEssai(
  fichier: string,
  horloge: { t: number },
  base: BaseDeLaCampagne = baseDuCabinet(),
  { calendrier = { periodeDu: () => null } }: Partial<Pick<ReglagesDuCabinet, 'calendrier'>> = {},
): Promise<MagasinDEssai> {
  const campagne = new CampagneStore(`file:${fichier.replace(/\\/g, '/')}`, undefined, { base, maintenant: () => horloge.t })
  ouverts.campagnes.push(campagne)
  await campagne.init(REVEIL_DU_CABINET)
  const cabinet = new CabinetStore(campagne.porte(), { legendairesOf: () => [] }, { maintenant: () => horloge.t, calendrier })
  return { campagne, cabinet, fichier }
}

export function fermerLesMagasins() {
  for (const c of ouverts.campagnes.splice(0)) c.close()
  for (const d of ouverts.dossiers.splice(0)) rmSync(d, { recursive: true, force: true })
}

/** Une lecture en base, à côté du serveur : ce que la page ne voit jamais. */
export function enBase<T>(fichier: string, lire: (db: Database.Database) => T): T {
  const db = new Database(fichier, { readonly: true })
  try {
    return lire(db)
  } finally {
    db.close()
  }
}

/** Une écriture à la main dans la base, derrière le dos du serveur : une panne, un déclencheur. */
export function aLaMain(fichier: string, sql: string) {
  const db = new Database(fichier)
  try {
    db.exec(sql)
  } finally {
    db.close()
  }
}

/** Le départ figé d'une partie, relu en base : son plan, ses bonnes réponses, sa graine. */
export function departEnBase(fichier: string, serie: string): DepartDUnePartie {
  const ligne = enBase(fichier, db => db.prepare('SELECT cabinet FROM campagne_series WHERE id = ?').get(serie) as { cabinet: string } | undefined)
  const d = ligne && lireLeDepart(ligne.cabinet)
  if (!d) throw new Error(`le départ de ${serie} ne se relit pas`)
  return d
}

// ── Par les routes ────────────────────────────────────────────────────────

/** Un vrai serveur, la base d'essai du Cabinet, l'horloge du jour à la main ; `fichier` : la base permanente, à lire à côté. */
export interface BancDuCabinet {
  banc: Banc
  horloge: { t: number }
  fichier: string
}

export async function bancDuCabinet(opts: Partial<QuizServerOptions> = {}): Promise<BancDuCabinet> {
  const horloge = { t: DIX_HEURES }
  const banc = await demarrer({ baseDeLaCampagne: baseDuCabinet(), horlogeDuJour: () => horloge.t, ...opts })
  return { banc, horloge, fichier: banc.quizDbUrl.replace(/^file:/, '') }
}

export interface Reponse<T> {
  status: number
  corps: T
  entetes: Headers
}

/** Une lecture telle que la page la fait (`X-Requested-With`), ou telle que le navigateur la précharge (`prechargee`). */
export async function lire<T = any>(b: BancDuCabinet, cookie: string | undefined, chemin: string, { prechargee = false } = {}): Promise<Reponse<T>> {
  const r = await fetch(`${b.banc.url}${chemin}`, { headers: { ...(cookie && { Cookie: cookie }), ...(!prechargee && { 'X-Requested-With': 'quizz' }) } })
  return { status: r.status, corps: (await r.json()) as T, entetes: r.headers }
}

export async function poster<T = any>(b: BancDuCabinet, cookie: string | undefined, chemin: string, corps: unknown): Promise<Reponse<T>> {
  const r = await ecrire(b.banc.url, chemin, corps, cookie)
  return { status: r.status, corps: (await r.json()) as T, entetes: r.headers }
}

export const laPage = (b: BancDuCabinet, cookie: string | undefined, opts?: { prechargee?: boolean }) => lire<PageDuCabinet>(b, cookie, '/api/cabinet', opts)
export const commencer = (b: BancDuCabinet, cookie: string, demande: unknown) => poster<VueDeLaPartie>(b, cookie, '/api/cabinet/partie', demande)
/** Un geste, au rang que la vue dit suivre. */
export const jouer = (b: BancDuCabinet, cookie: string, vue: Pick<VueDeLaPartie, 'id' | 'rang'>, geste: GesteDuCabinet | Record<string, unknown>) =>
  poster<VueDeLaPartie>(b, cookie, `/api/cabinet/partie/${vue.id}/geste`, { rang: vue.rang, geste })

/** Ce qu'il faut savoir pour répondre juste, lu dans le plan en base : la page ne le voit jamais avant le verdict. */
export const pariDe = (b: BancDuCabinet, serie: string, tirage: number) => departEnBase(b.fichier, serie).tirages[tirage] as PariTire
export const eclairDe = (b: BancDuCabinet, serie: string, tirage: number) => departEnBase(b.fichier, serie).tirages[tirage] as EclairTire
/** Les réponses justes d'une manche de l'Éclair : vraie quand la réponse proposée est la bonne. */
export const vraiesDe = (t: EclairTire) => t.affirmations.map(a => a.proposee === a.question.bonne)
export const detailDe = (b: BancDuCabinet, serie: string, tirage: number) => departEnBase(b.fichier, serie).tirages[tirage] as DetailTire
export const friseDe = (b: BancDuCabinet, serie: string, tirage: number) => departEnBase(b.fichier, serie).tirages[tirage] as FriseTiree
export const motDe = (b: BancDuCabinet, serie: string, tirage: number) => departEnBase(b.fichier, serie).tirages[tirage] as MotTire
export const filetDe = (b: BancDuCabinet, serie: string, tirage: number) => departEnBase(b.fichier, serie).tirages[tirage] as FiletTire

/** Un essai du Mot mystère de la bonne longueur qui n'est pas le mot : des X — aucun mot d'essai n'en a. */
export const unEssaiFaux = (t: MotTire) => 'X'.repeat(t.lettres.length)

/**
 * Les jetons d'une manche de la Frise dans l'ordre du temps, tels que la page
 * les renverrait rangés sans faute : les ancres d'abord numérotées dans le
 * temps, puis les nouveaux venus dans l'ordre montré (`REGLE_DE_LA_FRISE.montrer`).
 */
export function jetonsDansLeTemps(t: FriseTiree): number[] {
  const ancres = t.vagues.slice(0, t.vague).flat().sort((a, b) => a - b)
  const nouveaux = t.vagues[t.vague]
  return [...ancres, ...nouveaux].sort((a, b) => a - b).map(r => (ancres.includes(r) ? ancres.indexOf(r) : ancres.length + nouveaux.indexOf(r)))
}

/** Une réponse qui passe — sinon l'épreuve s'arrête là, en disant ce que le serveur a répondu. */
export function ok<T>(r: Reponse<T>, quoi: string): T {
  if (r.status !== 200) throw new Error(`${quoi} : ${r.status} ${JSON.stringify(r.corps)}`)
  return r.corps
}

/**
 * Une manche du Pari, la `k`-ième du plan, ouverte : juste à la première
 * question, puis gardée, ou pariée — juste ou non à la seconde. Rend la vue
 * de la manche tranchée.
 */
export async function jouerUnPari(b: BancDuCabinet, cookie: string, vue: VueDeLaPartie, k: number, facon: 'garder' | 'parier-juste' | 'parier-faux' | 'rater' = 'parier-juste'): Promise<VueDeLaPartie> {
  const t = pariDe(b, vue.id, k)
  const manche = k as 0 | 1 | 2
  if (facon === 'rater') return ok(await jouer(b, cookie, vue, { quoi: 'repondre', manche, reponse: { pari: { choix: (t.q1.bonne + 1) % 4 } } }), 'rater')
  let v = ok(await jouer(b, cookie, vue, { quoi: 'repondre', manche, reponse: { pari: { choix: t.q1.bonne } } }), 'la première question')
  if (facon === 'garder') return ok(await jouer(b, cookie, v, { quoi: 'garder', manche }), 'garder')
  v = ok(await jouer(b, cookie, v, { quoi: 'parier', manche }), 'parier')
  const choix = facon === 'parier-juste' ? t.q2.bonne : (t.q2.bonne + 1) % 4
  return ok(await jouer(b, cookie, v, { quoi: 'repondre', manche, reponse: { pari: { choix } } }), 'la question du pari')
}

/** Une manche de l'Éclair, ouverte : ses cinq affirmations, toutes justes ou toutes fausses. */
export async function jouerUnEclair(b: BancDuCabinet, cookie: string, vue: VueDeLaPartie, k: number, juste = true): Promise<VueDeLaPartie> {
  const reponses = vraiesDe(eclairDe(b, vue.id, k)).map(v => (juste ? v : !v))
  return ok(await jouer(b, cookie, vue, { quoi: 'repondre', manche: k as 0 | 1 | 2, reponse: { eclair: { reponses } } }), 'l’Éclair')
}

/** Une manche de la Frise, ouverte : rangée sans faute, ou rien de posé — les ancres seules, qui ne bougent pas. */
export async function jouerUneFrise(b: BancDuCabinet, cookie: string, vue: VueDeLaPartie, k: number, juste = true): Promise<VueDeLaPartie> {
  const t = friseDe(b, vue.id, k)
  const ordre = juste ? jetonsDansLeTemps(t) : t.vagues.slice(0, k).flat().map((_, j) => j)
  return ok(await jouer(b, cookie, vue, { quoi: 'repondre', manche: k as 0 | 1 | 2, reponse: { frise: { ordre } } }), 'la Frise')
}

/** Une manche du Détail, ouverte : tant de pas en arrière, puis le bon titre — ou un autre. */
export async function jouerUnDetail(b: BancDuCabinet, cookie: string, vue: VueDeLaPartie, k: number, { pas = 0, juste = true } = {}): Promise<VueDeLaPartie> {
  const t = detailDe(b, vue.id, vue.tirage ?? k)
  let v = vue
  for (let i = 0; i < pas; i++) v = ok(await jouer(b, cookie, v, { quoi: 'reculer', manche: k as 0 | 1 | 2 }), 'reculer')
  const titre = juste ? t.bonne : (t.bonne + 1) % t.titres.length
  return ok(await jouer(b, cookie, v, { quoi: 'repondre', manche: k as 0 | 1 | 2, reponse: { detail: { titre } } }), 'le Détail')
}

/**
 * Un cadrage du Détail, tel que la page le demande (`adresseDUnCadrage`) : ses
 * octets, ou le refus du serveur. Un indice qui n'est pas un nombre, la page ne
 * l'enverrait pas : son adresse s'écrit alors à la main.
 */
export async function unCadrage(b: BancDuCabinet, cookie: string | undefined, partie: string, tirage: number | string, cadrage: number | string) {
  const adresse = typeof tirage === 'number' && typeof cadrage === 'number' ? adresseDUnCadrage(partie, tirage, cadrage) : `/api/cabinet/partie/${partie}/detail/${tirage}/${cadrage}`
  const r = await fetch(`${b.banc.url}${adresse}`, { headers: { ...(cookie && { Cookie: cookie }), 'X-Requested-With': 'quizz' } })
  const octets = Buffer.from(await r.arrayBuffer())
  const json = (r.headers.get('content-type') ?? '').includes('json') ? (JSON.parse(octets.toString('utf8')) as { error?: string }) : null
  return { status: r.status, entetes: r.headers, octets, erreur: json?.error }
}

/**
 * Une manche du Mot mystère, ouverte : le mot trouvé à son `trouveAu`-ième essai, des essais faux avant — ou jamais
 * (`null`) : cinq essais faux, le cinquième tranche. Le mot est celui que la manche joue, sa rechange après « Changer ».
 */
export async function jouerUnMot(b: BancDuCabinet, cookie: string, vue: VueDeLaPartie, k: number, trouveAu: number | null = 1): Promise<VueDeLaPartie> {
  const t = motDe(b, vue.id, vue.tirage ?? k)
  const manche = k as 0 | 1 | 2
  const essais = trouveAu === null ? Array(5).fill(unEssaiFaux(t)) : [...Array(trouveAu - 1).fill(unEssaiFaux(t)), t.lettres]
  let v = vue
  for (const lettres of essais) v = ok(await jouer(b, cookie, v, { quoi: 'essai', manche, lettres }), `l’essai ${lettres}`)
  return v
}

/**
 * Une manche du Filet, ouverte : le filet lancé sur la valeur — ou au bout de la piste le plus loin d'elle, à côté de tout
 * filet (la réponse tombe entre 8 et 92 % de sa piste : son bout le plus loin est à plus de 46 %).
 */
export async function jouerUnFilet(b: BancDuCabinet, cookie: string, vue: VueDeLaPartie, k: number, taille: TailleDuFilet = 'petit', juste = true): Promise<VueDeLaPartie> {
  const t = filetDe(b, vue.id, vue.tirage ?? k)
  const loin = t.valeur - t.piste.min > t.piste.max - t.valeur ? t.piste.min : t.piste.max
  const x = juste ? t.valeur : loin
  return ok(await jouer(b, cookie, vue, { quoi: 'repondre', manche: k as 0 | 1 | 2, reponse: { filet: { x, taille } } }), 'le Filet')
}

/** La manche suivante ouverte, la précédente tranchée. */
export const ouvrir = async (b: BancDuCabinet, cookie: string, vue: VueDeLaPartie, k: number) => ok(await jouer(b, cookie, vue, { quoi: 'ouvrir', manche: k as 0 | 1 | 2 }), `ouvrir la manche ${k}`)

/** Une partie entière au Pari, chaque manche pariée et juste : neuf étoiles, le cadre doré. */
export async function unPariParfait(b: BancDuCabinet, cookie: string, vue: VueDeLaPartie): Promise<VueDeLaPartie> {
  let v = vue
  for (let k = 0; k < 3; k++) {
    if (k > 0) v = await ouvrir(b, cookie, v, k)
    v = await jouerUnPari(b, cookie, v, k)
  }
  return v
}
