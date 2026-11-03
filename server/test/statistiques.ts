// Le plan qu'une requête aurait sous des statistiques (`sqlite_stat1`) qui
// égareraient SQLite. La base de production n'en a pas, et le fichier `file:`
// du banc non plus — mais sans elles, SQLite départage ses index à l'aveugle,
// et le choix tient à l'ordre où chaque base les a créés : le 2 novembre 2026,
// pour chercher les tentatives d'un duel par le code d'un envoi, la production
// prenait l'index du profil et du mode (posé le 26 octobre, après les autres),
// une base neuve celui des duels — le plan du banc passait, celui de la
// production lisait 2 760 lignes par accueil. Une requête qui écarte le mauvais
// index par un `+` le garde écarté sous toutes les statistiques ; une qui n'en
// a pas s'y égare (`campagne-index.test.ts`, `duels-index.test.ts`).
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai } from './banc'
import { CampagneStore, type RecompensesDeCampagne } from '../src/core/campagne'
import { REVEIL_DU_CABINET } from '../src/core/cabinet/tables'
import { ProfileStore } from '../src/auth/profiles'

/** Rien à ranger : un magasin de la campagne n'a besoin que d'un magasin de récompenses pour partir. */
export const RIEN: RecompensesDeCampagne = {
  ranger: async () => [],
  recompensesOf: () => new Map(),
  accorderPaliersDeCampagne: async () => [],
  legendairesOuverts: () => [],
  tirerUnEclat: async () => null,
}

/** Une base neuve, au schéma du serveur — la campagne, le Cabinet, les profils —, sous ces statistiques : ce que le planificateur ferait d'une production qui en aurait. */
export async function sousCesStatistiques(stats: Record<string, string>): Promise<{ db: Database.Database; fermer: () => void }> {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-statistiques-'))
  const fichier = path.join(dir, 'permanente.db')
  const url = `file:${fichier.replace(/\\/g, '/')}`
  const profils = new ProfileStore(url)
  await profils.init()
  profils.close()
  const campagne = new CampagneStore(url, undefined, { base: baseDEssai(1), recompenses: RIEN })
  await campagne.init(REVEIL_DU_CABINET)
  campagne.close()
  const ecrite = new Database(fichier)
  try {
    ecrite.exec('ANALYZE')
    ecrite.exec('DELETE FROM sqlite_stat1')
    const stat = ecrite.prepare('INSERT INTO sqlite_stat1 (tbl, idx, stat) VALUES (?, ?, ?)')
    stat.run('campagne_series', null, '100000')
    for (const [idx, s] of Object.entries(stats)) stat.run('campagne_series', idx, s)
  } finally {
    ecrite.close()
  }
  // Les statistiques se lisent à l'ouverture.
  const db = new Database(fichier, { readonly: true })
  return { db, fermer: () => (db.close(), rmSync(dir, { recursive: true, force: true })) }
}

/**
 * Mille profils de cent parties, dix modes ; une partie d'un mode d'un profil
 * en compte dix, une semaine du défi trois, un duel deux : la production d'un
 * an de Cabinet, à peu près.
 */
export const DE_LA_PRODUCTION: Record<string, string> = {
  idx_campagne_series_profil: '100000 100 1',
  idx_campagne_series_commencee: '100000 1',
  idx_campagne_series_sentiers: '100000 100 10 5 3',
  idx_campagne_series_profil_mode: '100000 100 10 1',
  idx_campagne_series_defi: '100000 10000 3',
  idx_campagne_series_duel: '100000 10000 2',
  // Ses épreuves validées seules : la moitié de ses dix épreuves de sentier, sur trois sentiers, une par palier.
  idx_campagne_series_validees: '5000 5 2 1 1 1',
}

/** Un duel qui paraît moins sélectif que les tentatives de duel d'un joueur : sans son `+`, la recherche des tentatives d'un duel part du profil. */
export const UN_DUEL_DE_CINQUANTE: Record<string, string> = { ...DE_LA_PRODUCTION, idx_campagne_series_duel: '100000 10000 50' }
