// Les gerbes (le 5 octobre 2026) : ce qui éclate sur son téléphone à une
// bonne réponse. Chacune se gagne par un haut fait ou un palier, se choisit
// parmi celles qu'on a, et se relit à chaque affichage : celle qu'on ne
// mérite plus cesse de se porter, sans que rien ne soit réécrit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ALLURE_PAR_DEFAUT, AUCUNE_GERBE, GERBES, GERBE_PAR_DEFAUT, gerbe, gerbesOuvertes } from '../../shared/gerbes'
import { hautFait } from '../../shared/hautsfaits'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

test('chaque gerbe se gagne par un haut fait qui existe ; un palier plus haut vaut le sien', () => {
  for (const g of GERBES) {
    const par = g.par
    if ('hautFait' in par) assert.ok(hautFait(par.hautFait), `${g.key} : ${par.hautFait}`)
    if ('palier' in par) assert.ok(hautFait(par.palier), `${g.key} : ${par.palier}`)
  }
  assert.deepEqual(gerbesOuvertes(new Map()), ['confettis'], 'un profil a les confettis, rien de plus')
  assert.deepEqual(gerbesOuvertes(new Map([['hf:infatigable:2', 1]])), ['confettis', 'petales', 'flammes'])
  assert.deepEqual(gerbesOuvertes(new Map([['hf:laurier', 1]])), ['confettis', 'ballons'])
  assert.equal(gerbe(GERBE_PAR_DEFAUT)?.par && 'profil' in gerbe(GERBE_PAR_DEFAUT)!.par, true, 'celle de tous est ouverte à tout profil')
  assert.equal(gerbe(AUCUNE_GERBE), undefined, '« aucune » n’est pas une gerbe')
})

// Les dix gerbes avaient la même allure, et ne différaient que par leurs
// emojis : un ballon filait aussi vite qu'une étincelle.
test('chaque gerbe a son allure, et aucune ne charge un petit téléphone ni ne traîne', () => {
  const allures = GERBES.map(g => g.allure ?? ALLURE_PAR_DEFAUT)
  assert.equal(new Set(allures.map(a => JSON.stringify(a))).size, GERBES.length, 'dix allures différentes')
  for (const [i, a] of allures.entries()) {
    const g = GERBES[i].key
    assert.ok(a.nombre >= 6 && a.nombre <= 30, `${g} : ${a.nombre} particules`)
    assert.ok(a.taille[0] > 0 && a.taille[0] <= a.taille[1] && a.taille[1] <= 2.5, `${g} : taille`)
    // Le délai le plus long (0,3 s) compris : jamais plus de quatre secondes à l'écran.
    assert.ok(a.duree[0] > 0 && a.duree[0] <= a.duree[1] && a.duree[1] + 0.3 <= 4, `${g} : durée`)
  }
  const de = (cle: string) => GERBES.find(g => g.key === cle)!.allure!
  assert.ok(de('ballons').duree[0] > de('etincelles').duree[1], 'un ballon flotte, une étincelle file')
  assert.ok(de('ballons').nombre < de('pixels').nombre)
})

// Chaque particule avait sa taille de police, tirée au hasard : à chaque bonne
// réponse, le téléphone mettait en forme vingt-deux emojis à vingt-deux
// tailles, chacune sa police à préparer. Au processeur d'un téléphone moyen
// (×4), l'image de la révélation attendait 100 à 230 ms derrière cette mise en
// forme — dans tous les modes, depuis les confettis d'office (« le retour est
// plus lent qu'avant », le 12 octobre 2026). À une seule taille, chacune
// réduite par `transform`, l'image ne coûte plus que 20 ms.
test('une gerbe ne met en forme qu’une taille d’emoji : chaque particule prend la sienne par transform', async () => {
  const { GerbeVue, tirerLesParticules } = await import(new URL('../../client/src/components/Gerbe.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const css = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  // Les règles de la gerbe et de ses particules — pas celles de son aperçu (`.gerbe-apercu`).
  const regles = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selecteurs]) =>
    selecteurs.split(',').some(s => /^\.gerbe(-jaillit|-tombe|-monte)?( i)?$/.test(s.trim())),
  )
  assert.ok(regles.length >= 4, `${regles.length} règles de la gerbe lues`)
  // Ce dont dépend la taille de police d'une particule.
  const tailles = regles.flatMap(([, , corps]) => [...corps.matchAll(/font-size:([^;]+)/g)].map(m => m[1]))
  const variablesDeLaTaille = new Set(tailles.flatMap(t => [...t.matchAll(/var\((--[\w-]+)/g)].map(m => m[1])))
  // Chaque image de ses trois mouvements.
  const transforms = [...css.matchAll(/@keyframes gerbe-(?:jaillit|tombe|monte)\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)].flatMap(([, corps]) =>
    [...corps.matchAll(/transform:([^;}]+)/g)].map(m => m[1].trim()),
  )
  assert.ok(transforms.length >= 8, `${transforms.length} images de mouvement lues`)
  for (const g of GERBES) {
    const allure = g.allure ?? ALLURE_PAR_DEFAUT
    const html = renderToStaticMarkup(React.createElement(GerbeVue, { g, particules: tirerLesParticules(allure) }))
    const particules = [...html.matchAll(/<i style="([^"]*)"/g)].map(
      m =>
        new Map(
          m[1]
            .split(';')
            .filter(Boolean)
            .map(d => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()] as const),
        ),
    )
    assert.equal(particules.length, allure.nombre, `${g.key} : ses particules`)
    for (const p of particules) {
      assert.ok(!p.has('font-size'), `${g.key} : une particule ne pose pas sa taille de police`)
      for (const v of variablesDeLaTaille) assert.ok(!p.has(v), `${g.key} : une particule pose ${v}, d’où sa police tire sa taille`)
    }
    // Sa taille à elle, à chaque image du mouvement — jamais au-delà de la police, que l'agrandir rendrait floue.
    const echelle = [...particules[0].keys()].filter(k => transforms.every(t => new RegExp(`scale\\([^)]*var\\(${k}\\b`).test(t)))
    assert.equal(echelle.length, 1, `${g.key} : chaque image du mouvement porte l’échelle de la particule (${transforms.join(' | ')})`)
    const echelles = particules.map(p => Number(p.get(echelle[0])))
    assert.ok(echelles.every(e => e > 0 && e <= 1), `${g.key} : des échelles dans ]0, 1] (${echelles.join(', ')})`)
    assert.ok(new Set(echelles).size > 1, `${g.key} : des particules de tailles différentes`)
  }
})

test('une gerbe se porte parmi celles qu’on a gagnées, et tombe avec ce qui l’ouvrait', async () => {
  const banc = await demarrer()
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const porter = (gerbe: string | null) => ecrire(banc.url, '/api/joueur/moi', { gerbe }, lea, 'PUT')
    // Un profil neuf porte les confettis : rien n'éclatait tant qu'on
    // n'était pas allé en choisir une (le choix du 10 octobre 2026).
    assert.equal((await lire(banc, lea, '/api/joueur/moi?leger')).corps.profile.gerbe, 'confettis')
    // Qui n'en veut aucune le dit ; null revient à celle de tous.
    assert.equal((await porter(AUCUNE_GERBE)).status, 200)
    assert.equal((await lire(banc, lea, '/api/joueur/moi?leger')).corps.profile.gerbe, null)
    assert.equal((await porter(null)).status, 200)
    assert.equal((await lire(banc, lea, '/api/joueur/moi?leger')).corps.profile.gerbe, 'confettis')
    assert.equal((await porter('confettis')).status, 200)
    assert.equal((await lire(banc, lea, '/api/joueur/moi?leger')).corps.profile.gerbe, 'confettis')
    const refus = await porter('trophees')
    assert.equal(refus.status, 400)
    assert.match(((await refus.json()) as any).error, /défi/)
    assert.equal((await porter('n-existe-pas')).status, 400)
    // Le défi gagné : les trophées s'ouvrent.
    const id = base(banc, db => (db.prepare(`SELECT id FROM profiles WHERE login = 'lea'`).get() as { id: string }).id)
    base(banc, db =>
      db
        .prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, 'hf:defi', '#defi:2026-09-28', '', '⚔️', 'Le Vainqueur du défi', 1)`)
        .run(id),
    )
    await banc.redemarrer()
    const detail = (await lire(banc, lea, '/api/joueur/moi')).corps.profile
    assert.deepEqual(detail.gerbes, ['confettis', 'trophees'])
    assert.equal((await porter('trophees')).status, 200)
    assert.equal((await lire(banc, lea, '/api/joueur/moi?leger')).corps.profile.gerbe, 'trophees')
    // Ce qui l'ouvrait retiré, elle ne se porte plus — sans rien réécrire :
    // c'est celle de tous qui éclate.
    base(banc, db => db.prepare(`DELETE FROM profile_badges WHERE profile_id = ? AND badge = 'hf:defi'`).run(id))
    await banc.redemarrer()
    assert.equal((await lire(banc, lea, '/api/joueur/moi?leger')).corps.profile.gerbe, 'confettis')
    assert.equal((await porter(null)).status, 200)
  } finally {
    await banc.close()
  }
})
