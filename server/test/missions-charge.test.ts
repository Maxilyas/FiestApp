// La ligne des missions de l'accueil, et ce qu'elle attend de la base — la
// remarque du propriétaire du 15 octobre 2026 : « c'est le texte qui
// s'affiche après ». Sa boîte paraissait avec le haut de l'accueil, son
// texte un aller-retour plus tard : la page ne demandait ses missions
// qu'une fois l'accueil lu (elles partent maintenant avec la page,
// `depart.test.ts`), et le serveur lisait ses journaux, puis ses tampons et
// ses coffres — le matin, ses journaux, son carnet, le tirage, puis le
// reste : quatre allers-retours l'un derrière l'autre. En production,
// chaque `execute` et chaque `batch` est un aller-retour HTTP vers Turso :
// on compte ceux qui se suivent sur le fichier `file:` qui en tient lieu,
// comme `jour-charge.test.ts`.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { demarrer, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

// ── Le compteur ───────────────────────────────────────────────────────────

/** Ce que la base permanente a servi pendant une mesure, et ce qu'elle a en vol. */
const compte = { actif: false, mesure: 0, appels: 0, finis: 0, sqls: [] as string[], enVol: 0 }

const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = async function (this: unknown, ...args: unknown[]) {
    // Un aller-retour dure au moins un tour de boucle, comme sur le réseau :
    // ce qui part ensemble est en vol ensemble, et le rang d'un appel dit
    // combien d'allers-retours il a attendus. Seuls comptent ceux qui partent
    // pendant la mesure.
    const mesure = compte.actif ? compte.mesure : 0
    const rang = compte.finis + 1
    compte.enVol++
    try {
      if (mesure) await new Promise<void>(r => setImmediate(r))
      const res = await origine.apply(this, args)
      if (mesure && compte.actif && mesure === compte.mesure) {
        compte.appels++
        compte.finis = Math.max(compte.finis, rang)
        const premiere = (methode === 'batch' ? (args[0] as unknown[])[0] : args[0]) as string | { sql: string }
        compte.sqls.push(`${rang}. ${(typeof premiere === 'string' ? premiere : premiere.sql).replace(/\s+/g, ' ').trim().slice(0, 70)}`)
      }
      return res
    } finally {
      compte.enVol--
    }
  }
}

/** Attend que la base n'ait plus rien en vol : ce qu'une requête d'avant a lancé en fond ne se compte pas avec la suivante. */
async function auCalme() {
  for (let calmes = 0; calmes < 3; ) {
    await new Promise<void>(r => setImmediate(r))
    calmes = compte.enVol === 0 ? calmes + 1 : 0
  }
}

async function mesurer<T>(travail: () => Promise<T>): Promise<{ appels: number; enSerie: number; sqls: string[]; resultat: T }> {
  Object.assign(compte, { actif: true, mesure: compte.mesure + 1, appels: 0, finis: 0, sqls: [] })
  try {
    const resultat = await travail()
    return { appels: compte.appels, enSerie: compte.finis, sqls: compte.sqls, resultat }
  } finally {
    compte.actif = false
  }
}

// ── Un serveur, un matin ──────────────────────────────────────────────────

let banc: Banc
const lire = (cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => {
    const corps = (await r.json()) as any
    assert.equal(r.status, 200, `${chemin} : ${corps.error}`)
    return corps
  })

before(async () => {
  // Le jeudi 15 octobre 2026, à 10 h à Paris.
  banc = await demarrer({ horlogeDuJour: () => Date.UTC(2026, 9, 15, 8) })
})

after(() => banc.close())

test('la ligne des missions se lit d’un aller-retour à la base — deux à la première lecture du jour, qui les tire', async () => {
  // La première requête du jour clôt la nuit d'hier et le défi passé, en
  // fond : on la laisse à un autre, et on la laisse finir.
  const autre = await inscrireProfil(banc.url, 'missions-autre', 'Sam')
  await lire(autre, '/api/joueur/missions')
  const cookie = await inscrireProfil(banc.url, 'missions-charge', 'Léa')
  await auCalme()
  // Le matin : ses journaux et son carnet ensemble, puis le tirage s'écrit.
  const matin = await mesurer(() => lire(cookie, '/api/joueur/missions'))
  assert.equal(matin.resultat.missions.length, 3, 'ses trois missions sont tirées')
  assert.ok(matin.enSerie <= 2, `${matin.enSerie} allers-retours en série à la première lecture du jour :\n${matin.sqls.join('\n')}`)
  // Ensuite : un seul — ses tampons et ses coffres partent avec ses journaux,
  // et son carnet, que seul le tirage lit, ne se relit plus.
  const ensuite = await mesurer(() => lire(cookie, '/api/joueur/missions'))
  assert.equal(ensuite.enSerie, 1, `${ensuite.enSerie} allers-retours en série :\n${ensuite.sqls.join('\n')}`)
  assert.ok(!ensuite.sqls.some(s => s.includes('WITH miennes')), `son carnet relu :\n${ensuite.sqls.join('\n')}`)
  assert.deepEqual(ensuite.resultat.missions, matin.resultat.missions, 'les mêmes missions, tirées une fois')
  assert.deepEqual([ensuite.resultat.coffres, ensuite.resultat.semaine.tampons], [[], [false, false, false, false, false, false, false]])
})
