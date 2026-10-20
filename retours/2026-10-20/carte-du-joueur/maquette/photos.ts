// Maquette — la carte du joueur, et la place de son compagnon (20 octobre 2026).
//
// « Le compagnon apparaît en dessous de l'avatar et ça fait tout descendre »
// (le propriétaire) : la carte d'aujourd'hui et trois propositions, de la plus
// sobre à la plus créative, posées dans le vrai code de la carte derrière un
// drapeau du téléphone (`quizz.maquette`, `prototype.patch`), photographiées
// au téléphone en 360 × 640 sur un serveur jetable — le premier écran, tel
// qu'il s'ouvre, et la carte entière.
//
// Léa est une habituée : niveau 23, le Phénix porté, « L'Oracle » en titre —
// et Nox, son loup des étoiles, dont la niche a passé trois paliers (la
// guirlande, le lierre, l'arche dorée : « Inséparables »). Son compagnon, sa
// niche, son avatar et son titre viennent du serveur ; ce que seuls des mois
// de soirées lui donneraient — ses chiffres, ses écussons, ses légendaires, sa
// vitrine, sa bordure de ligue, sa soirée de ce soir — est posé à la volée sur
// la carte qu'il rend (`page.route`) : c'est le vrai code de la carte qui la
// dessine.
//
//   git apply retours/2026-10-20/carte-du-joueur/maquette/prototype.patch && npm run build -w client
//   cd server && npx tsx ../retours/2026-10-20/carte-du-joueur/maquette/photos.ts ../export/carte-du-joueur [avant|tout|<version>,…]
//
// `avant` ne photographie que la carte d'aujourd'hui : il se passe du patch.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { demarrer, ecrire, inscrireProfil } from '../../../../server/test/banc'
import { ProfileStore, VERSION_BAREME } from '../../../../server/src/auth/profiles'
import { xpDuNiveau } from '../../../../shared/profil'
import { hautFait, palierDe, titreDePalier } from '../../../../shared/hautsfaits'

const REPO = fileURLToPath(new URL('../../../..', import.meta.url))
const Database = createRequire(path.join(REPO, 'server/package.json'))('better-sqlite3')
const ici = path.dirname(fileURLToPath(import.meta.url))
const sortie = path.resolve(process.argv[2] ?? path.join(ici, 'captures'))
const quoi = process.argv[3] ?? 'tout'
mkdirSync(sortie, { recursive: true })
ProfileStore.tirageEclat = () => false
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

/** La carte d'aujourd'hui, puis les trois propositions du prototype, chacune sa valeur de `quizz.maquette`. */
const VERSIONS: readonly (readonly [string, string | null])[] = [
  ['0-aujourdhui', null],
  ['1-vis-a-vis', 'vis-a-vis'],
  ['2-perche', 'perche'],
  ['3-a-collectionner', 'a-collectionner'],
]

/** Ce qui se touche sur la carte en soirée, version par version : une photo de plus chacun. */
const GESTES: Readonly<Record<string, readonly (readonly [string, string])[]>> = {
  '1-vis-a-vis': [['compagnon-en-grand', '.carte-compagnon-en-face']],
  '2-perche': [
    ['medaille', '.carte-medaille >> nth=0'],
    ['compagnon-en-grand', '.carte-perche'],
  ],
  '3-a-collectionner': [
    ['dos', '.c3-retourner'],
    ['compagnon-en-grand', '.c3-perche'],
  ],
}
const versions = VERSIONS.filter(([nom, m]) => (quoi === 'tout' ? true : quoi === 'avant' ? m === null : quoi.split(',').some(q => nom.includes(q))))

/** Un haut fait de la vitrine, tel que l'étagère le range : son emoji et son nom. */
function badge(cle: string, fois = 1) {
  const palier = palierDe(cle)
  const h = palier ? palier.hautFait : hautFait(cle)!
  return { key: cle, emoji: h.emoji, title: palier ? titreDePalier(palier.hautFait, palier.palier) : h.title, fois, dernier: 1, porteurs: 0, rarete: null }
}

/** Sa soirée de ce soir, comme la salle l'ouvre en touchant son nom : troisième sur douze. */
const CE_SOIR = { points: 2450, rang: 3, joueurs: 12, reponses: 14, qcm: 11, justes: 8, estimations: 3, coupDOeil: 0.67 }

/** Ce que des mois de soirées lui ont donné, posé sur la carte que rend le serveur — son compagnon, son avatar et son titre restent les siens. */
function habituee(lue: any) {
  return {
    ...lue,
    finition: 'or',
    bordure: { ligue: 'or', crans: 7 },
    profil: {
      ...lue.profil,
      legendaires: ['lg:phenix', 'lg:licorne', 'lg:dragon', 'lg:chouette'],
      divins: [],
      vitrine: [badge('hf:grand-chelem'), badge('hf:phenix', 2), badge('hf:oracle')],
      hautsFaits: 17,
      jour: { joues: 46, victoires: 3 },
      duels: { ligue: 'or', cote: 1262 },
      campagne: { record: 31, justes: 840, paliers: 12 },
      ecussons: [
        { categorie: 'Histoire', palier: 3 },
        { categorie: 'Cinéma & séries', palier: 2 },
        { categorie: 'Musique', palier: 2 },
      ],
      prix: { eus: 7, total: lue.profil.prix?.total ?? 14 },
      fiche: { soirees: 23, precision: 0.71, qcm: 412, justes: 293, coupDOeil: 0.64, estimationsComparees: 58, reflexeMoyenMs: 4200, quizGagnes: 9, meilleureSerie: 11 },
    },
  }
}

interface Etat {
  nom: string
  /** La carte montrée, d'après celle que rend le serveur. */
  carte: (lue: any) => any
  theme?: string
  /** Pas de compagnon à attendre. */
  sansCompagnon?: boolean
}

const ETATS: readonly Etat[] = [
  { nom: 'soiree', carte: lue => ({ ...habituee(lue), ceSoir: CE_SOIR }) },
  { nom: 'profil', carte: habituee },
  {
    nom: 'sans-compagnon',
    sansCompagnon: true,
    carte: lue => {
      const c = habituee(lue)
      delete c.profil.compagnon
      return { ...c, ceSoir: CE_SOIR }
    },
  },
  // Une débutante : son emoji, quelques soirées, son jeune chat sans nom ni ornement.
  {
    nom: 'debutante',
    carte: lue => ({
      ...lue,
      legendaire: undefined,
      finition: 'argent',
      bordure: undefined,
      ceSoir: { ...CE_SOIR, rang: 7, points: 980, justes: 5 },
      profil: {
        ...lue.profil,
        niveau: 4,
        titre: undefined,
        legendaires: [],
        divins: [],
        vitrine: [badge('hf:double')],
        hautsFaits: 1,
        jour: { joues: 3, victoires: 0 },
        duels: undefined,
        campagne: undefined,
        ecussons: [],
        prix: { eus: 1, total: lue.profil.prix?.total ?? 14 },
        fiche: { soirees: 2, precision: 0.55, qcm: 22, justes: 12, coupDOeil: 0.4, estimationsComparees: 5, reflexeMoyenMs: 6100, quizGagnes: 0, meilleureSerie: 3 },
        compagnon: { compagnon: 'chat', rang: 1 },
      },
    }),
  },
  { nom: 'ivoire', theme: 'ivoire', carte: lue => ({ ...habituee(lue), ceSoir: CE_SOIR }) },
  {
    nom: 'fond',
    carte: lue => {
      const c = habituee(lue)
      return { ...c, ceSoir: CE_SOIR, profil: { ...c.profil, fond: 'nuit' } }
    },
  },
  // Un invité sans profil : sa soirée, et rien qui dise ce qui lui manque (invariant 8).
  { nom: 'anonyme', sansCompagnon: true, carte: () => ({ nom: 'Tom', avatar: '🐼', ceSoir: { ...CE_SOIR, rang: 5, points: 1720, justes: 6, coupDOeil: 0.5 } }) },
]

/** Les blocs de la carte, sous les mêmes classes dans chaque version : ce que le premier écran montre en entier. */
const BLOCS: readonly (readonly [string, string])[] = [
  ['tête', '.carte-tete'],
  ['compagnon', '.carte-compagnon'],
  ['légendaires', '.carte-legendaires:not(.carte-divins)'],
  ['vitrine', '.carte-beaux'],
  ['écussons', '.ecussons'],
  ['chiffres', '.carte-cadrans'],
  ['pastilles', '.carte-pastilles'],
]

const banc = await demarrer()
const navigateur = await chromium.launch({ headless: true })
const mesures: string[] = []

try {
  const cookie = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const id = ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile.id
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#rattrapage', '', ?, ?, 1)`).run(id, xpDuNiveau(23), JSON.stringify({ v: VERSION_BAREME }))
  db.prepare('UPDATE profiles SET xp = ?, niche = ? WHERE id = ?').run(xpDuNiveau(23), 'loup', id)
  // Le Phénix (son légendaire) et L'Oracle (son titre), sur son étagère comme une clôture les range.
  const etagere = db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, 'une-soiree-d-avant', '', ?, ?, 1)`)
  for (const cle of ['hf:phenix', 'hf:oracle', 'hf:grand-chelem']) {
    const b = badge(cle)
    etagere.run(id, cle, b.emoji, b.title)
  }
  // Nox, son loup des étoiles, trois paliers passés ; et sa jeune tortue, qui attend.
  const compagnon = db.prepare('INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at, nom, paliers) VALUES (?, ?, 1000, ?, 1, ?, ?)')
  compagnon.run(id, 'loup', 3, 'Nox', 3)
  compagnon.run(id, 'tortue', 1, null, null)
  db.close()
  await banc.redemarrer()
  const porter = (corps: object) => ecrire(banc.url, '/api/joueur/moi', corps, cookie, 'PUT')
  if (!(await porter({ legendaire: 'lg:phenix', titre: 'hf:oracle' })).ok) throw new Error('le Phénix et L’Oracle refusés')

  for (const [version, maquette] of versions) {
    const ctx = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
    const [nom, valeur] = cookie.split('=')
    await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
    // Le drapeau de la proposition, posé avant que la page ne lise rien. En texte : `tsx` glisserait des `__name` dans une fonction.
    await ctx.addInitScript({
      content: `try { ${maquette ? `localStorage.setItem('quizz.maquette', ${JSON.stringify(maquette)})` : `localStorage.removeItem('quizz.maquette')`} } catch (e) {}`,
    })
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error(`[${version}]`, e.message))
    let etat: Etat = ETATS[0]
    await page.route('**/api/joueur/carte', async (route: any) => {
      const reponse = await route.fetch()
      await route.fulfill({ response: reponse, json: etat.carte(await reponse.json()) })
    })
    const ouvrir = async () => {
      await page.goto('about:blank')
      await page.goto(`${banc.url}/profil`)
      await page.waitForSelector('.profil-boutons .gros-compte')
      await page.click('button.identite-ligne')
      await page.waitForSelector('.carte-joueur .carte-tete')
      if (!etat.sansCompagnon) await page.waitForSelector('.dialog-backdrop .niche-bete img', { timeout: 8000 }).catch(() => console.error(`[${version} ${etat.nom}] pas de compagnon`))
      await page.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
      await page.waitForTimeout(900)
    }
    for (const e of ETATS) {
      etat = e
      if (e.theme) await porter({ theme: e.theme })
      await ouvrir()
      const fichier = path.join(sortie, `${version}-${e.nom}`)
      await page.screenshot({ path: `${fichier}.png` })
      // Ce que le premier écran montre : la hauteur de ce qui défile, celle qu'on voit, et les blocs entiers sous les yeux.
      const vu: string = await page.evaluate(`(() => {
        const d = document.querySelector('.carte-joueur .carte-defile')
        if (!d) return '(pas de cadre qui défile)'
        const bas = d.getBoundingClientRect().bottom
        const blocs = ${JSON.stringify(BLOCS)}.flatMap(([nom, sel]) => {
          const b = d.querySelector(sel)
          if (!b) return []
          const r = b.getBoundingClientRect()
          return [nom + (r.bottom <= bas + 1 ? '' : r.top < bas ? ' (coupé)' : ' (sous le pli)')]
        })
        return 'contenu ' + d.scrollHeight + ' px, visible ' + d.clientHeight + ' px · ' + blocs.join(' · ')
      })()`)
      mesures.push(`${version} ${e.nom} : ${vu}`)
      console.log(`${version} ${e.nom} : ${vu}`)
      // La carte entière, sans plafond : tout ce qu'elle raconte, d'un seul
      // tenant — avec ce qui en déborde (la niche perchée, la croix et
      // « Retourner » de la carte à collectionner).
      const entiere = async (nom: string) => {
        await page.addStyleTag({ content: '.carte-joueur, .c3-face { max-height: none !important; }' })
        await page.setViewportSize({ width: 360, height: 2200 })
        await page.waitForTimeout(500)
        const r = await page.locator('.dialog-backdrop > *').first().boundingBox()
        await page.screenshot({ path: `${nom}.png`, clip: { x: 0, y: Math.max(0, r.y - 64), width: 360, height: r.height + 128 } })
        await page.setViewportSize({ width: 360, height: 640 })
      }
      await entiere(`${fichier}-entiere`)
      // Ce qui se touche, en soirée : une médaille, le dos, le compagnon en
      // grand ; et le dos de la débutante, dont les chiffres finissent leur
      // rangée autrement.
      if (e.nom === 'soiree' || e.nom === 'debutante') {
        for (const [geste, cible] of (GESTES[version] ?? []).filter(([g]) => e.nom === 'soiree' || g === 'dos')) {
          await ouvrir()
          await page.click(cible)
          await page.waitForTimeout(900)
          await page.screenshot({ path: `${fichier}-${geste}.png` })
          if (geste === 'dos') await entiere(`${fichier}-${geste}-entier`)
        }
      }
      if (e.theme) await porter({ theme: null })
    }
    await ctx.close()
  }
  writeFileSync(path.join(sortie, 'mesures.txt'), mesures.join('\n') + '\n')
} finally {
  await navigateur.close()
  await banc.close()
}
process.exit(0)
