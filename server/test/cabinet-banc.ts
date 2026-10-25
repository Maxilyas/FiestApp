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
import { CabinetStore } from '../src/core/cabinet/magasin'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import type { DepartDUnePartie } from '../../shared/cabinet/partie'
import { lireLeDepart } from '../../shared/cabinet/lecture'

/** Une question d'essai de la catégorie et de la difficulté qu'on veut : 2 facile, 3 moyenne, 4 difficile. Quatre réponses courtes, que l'intitulé ne dit pas. */
export function questionDuCabinet(i: number, categorie: Categorie, difficulte: number): QuestionDeLaBase {
  const autres = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => `Autre ${l}${i}`)
  const lu = lireQuestionDeLaBase({
    id: `cab${String(i).padStart(5, '0')}`,
    texte: `Question d'essai numéro ${i} du Cabinet : laquelle est la bonne ?`,
    reponses: [`Bonne ${i}`, ...autres.slice(0, 3)],
    bonne: 0,
    anecdote: `L'anecdote de la question ${i}.`,
    categorie,
    sousTheme: SOUS_THEMES[categorie][0].cle,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date: null,
    entites: [],
    portee: 'monde',
    valeur: null,
    leurres: autres,
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(`question ${i} : ${lu.refus}`)
  return lu.question
}

/** Huit questions de chaque marche — facile, moyenne, difficile — dans chacune des douze catégories : le Pari et l'Éclair y trouvent toujours à poser. */
export function baseDuCabinet(parMarche = 8): BaseDeLaCampagne {
  return new BaseDeLaCampagne(
    CATEGORIES.flatMap((c, k) => [2, 3, 4].flatMap((d, m) => Array.from({ length: parMarche }, (_, i) => questionDuCabinet(k * 1000 + m * 100 + i, c, d)))),
  )
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
 * légendaire, rien à ranger.
 */
export async function magasinDEssai(fichier: string, horloge: { t: number }, base: BaseDeLaCampagne = baseDuCabinet()): Promise<MagasinDEssai> {
  const campagne = new CampagneStore(`file:${fichier.replace(/\\/g, '/')}`, undefined, { base, maintenant: () => horloge.t })
  ouverts.campagnes.push(campagne)
  await campagne.init(REVEIL_DU_CABINET)
  const cabinet = new CabinetStore(campagne.porte(), { legendairesOf: () => [] }, { maintenant: () => horloge.t, calendrier: { periodeDu: () => null } })
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
