// Les fonds de carte : ce qu'on voit derrière sa carte quand quelqu'un touche
// son nom. Cinq, gagnés sur la durée ; on ne porte que ceux qu'on a
// gagnés ; ils se relisent à chaque affichage — celui qu'on ne mérite plus
// cesse de se voir, sans que rien ne soit réécrit, et revient avec ce qui
// l'avait ouvert.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import { ADMIN, demarrer, ecrire, inscrireProfil, invite, type Banc } from './banc'
import { fondsOuverts } from '../../shared/fonds'
import { xpDuNiveau } from '../../shared/profil'
import { VERSION_BAREME } from '../src/auth/profiles'

test('cinq fonds, chacun sa règle', () => {
  const rien = { niveau: 1, jour: { joues: 0, victoires: 0 }, recompenses: new Map<string, number>() }
  assert.deepEqual(fondsOuverts(rien), [])
  assert.deepEqual(fondsOuverts({ ...rien, jour: { joues: 30, victoires: 0 } }), ['nuit'], 'trente jours de quiz du jour')
  assert.deepEqual(fondsOuverts({ ...rien, niveau: 20 }), ['aurore'], 'le niveau 20')
  assert.deepEqual(fondsOuverts({ ...rien, jour: { joues: 29, victoires: 10 } }), ['kintsugi'], 'dix victoires au quiz du jour')
  assert.deepEqual(fondsOuverts({ ...rien, recompenses: new Map([['hf:habitue:3', 1]]) }), ['theatre'], 'L’Habitué · Or')
  assert.deepEqual(fondsOuverts({ ...rien, maitres: 3 }), ['cabinet'], 'trois paliers de maître des sentiers')
  assert.deepEqual(fondsOuverts({ ...rien, niveau: 19, jour: { joues: 29, victoires: 9 }, recompenses: new Map([['hf:habitue:2', 1]]), maitres: 2 }), [])
})

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

/**
 * Donne au profil tout juste le niveau voulu, par sa ligne du quiz du jour :
 * la seule que le démarrage ne relit pas. Descendre d'un niveau rejoue ce
 * que fait une soirée retirée de l'historique.
 */
function mettreAuNiveau(banc: Banc, id: string, niveau: number) {
  const xp = xpDuNiveau(niveau)
  base(banc, db => {
    db.prepare(`DELETE FROM profile_xp WHERE profile_id = ?`).run(id)
    db.prepare(
      `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#jour', '', ?, ?, 1)`,
    ).run(id, xp, JSON.stringify({ v: VERSION_BAREME, jours: 1 }))
    db.prepare('UPDATE profiles SET xp = ? WHERE id = ?').run(xp, id)
  })
}

test('un fond se choisit parmi ceux qu’on a gagnés ; la carte le montre, et le perd avec ce qui l’avait ouvert', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const id = base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id)
    const changer = (fond: string | null) =>
      ecrire(banc.url, '/api/joueur/moi', { fond }, cookie, 'PUT').then(async r => ({ status: r.status, corps: (await r.json()) as any }))
    const moi = async () =>
      ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile
    const carte = async (playerId: string) =>
      ((await (await fetch(`${banc.url}/s/${ADMIN.slug}/joueurs/${playerId}.json`)).json()) as any).profil

    // Rien de gagné : refusé, en clair — et un fond forgé n'existe pas.
    const refus = await changer('aurore')
    assert.equal(refus.status, 400)
    assert.match(refus.corps.error, /se gagne d’abord : le niveau 20/)
    assert.match((await changer('velours-noir')).corps.error, /n’existe pas/)
    assert.deepEqual((await moi()).fonds, [])

    // Au niveau 20, l'Aurore boréale se porte, et la carte la montre.
    mettreAuNiveau(banc, id, 20)
    await banc.redemarrer()
    assert.equal((await changer('aurore')).status, 200)
    assert.equal((await moi()).fond, 'aurore')
    const alice = await invite(banc.url, 'Alice', '', { cookie })
    const bob = await invite(banc.url, 'Bob', '🐻')
    assert.equal((await carte(alice.playerId)).fond, 'aurore')
    assert.equal(await carte(bob.playerId), undefined, 'un anonyme n’a pas de profil, donc pas de fond')

    // Une soirée retirée la fait redescendre au 19 : sa carte redevient
    // velours, sans que rien ne soit réécrit — et l'aurore revient au 20.
    mettreAuNiveau(banc, id, 19)
    await banc.redemarrer()
    assert.equal((await carte(alice.playerId)).fond, undefined)
    assert.equal((await moi()).fond, null)
    mettreAuNiveau(banc, id, 20)
    await banc.redemarrer()
    assert.equal((await carte(alice.playerId)).fond, 'aurore')

    // Les trois autres : trente jours et dix victoires au quiz du jour,
    // vingt-cinq soirées (L'Habitué · Or).
    base(banc, db => {
      const partie = db.prepare(
        `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 500, 5, 1, 0)`,
      )
      const victoire = db.prepare(`INSERT INTO jour_podiums (jour, profile_id, rang, points, xp) VALUES (?, ?, 1, 500, 25)`)
      for (let j = 1; j <= 30; j++) {
        const jour = `2026-08-${String(j).padStart(2, '0')}`
        partie.run(id, jour)
        if (j <= 10) victoire.run(jour, id)
      }
      db.prepare(
        `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, 'hf:habitue:3', 'soiree-25', '', '🎟️', 'L’Habitué · Or', 1)`,
      ).run(id)
    })
    await banc.redemarrer()
    assert.deepEqual((await moi()).fonds, ['nuit', 'aurore', 'kintsugi', 'theatre'])
    assert.equal((await changer('theatre')).status, 200)
    assert.equal((await carte(alice.playerId)).fond, 'theatre')

    // Retour au velours.
    assert.equal((await changer(null)).status, 200)
    assert.equal((await moi()).fond, null)
    assert.equal((await carte(alice.playerId)).fond, undefined)
  }))

test('le Cabinet de curiosités s’ouvre au troisième palier de maître, et se voit sur la carte', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const id = base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id)
    const changer = (fond: string | null) =>
      ecrire(banc.url, '/api/joueur/moi', { fond }, cookie, 'PUT').then(async r => ({ status: r.status, corps: (await r.json()) as any }))
    const moi = async () =>
      ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile
    /** Des sentiers gravis jusqu'au maître, posés comme la reprise les écrit. */
    const maitre = (...branches: string[]) =>
      base(banc, db => {
        for (const b of branches) db.prepare(`INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, 13, 1)`).run(id, b)
      })

    maitre('foret', 'stade')
    const refus = await changer('cabinet')
    assert.equal(refus.status, 400)
    assert.match(refus.corps.error, /se gagne d’abord : 3 paliers de maître des sentiers/)
    maitre('oceans')
    assert.deepEqual((await moi()).fonds, ['cabinet'])
    assert.equal((await changer('cabinet')).status, 200)
    assert.equal((await moi()).fond, 'cabinet')
    const alice = await invite(banc.url, 'Alice', '', { cookie })
    const carte = ((await (await fetch(`${banc.url}/s/${ADMIN.slug}/joueurs/${alice.playerId}.json`)).json()) as any).profil
    assert.equal(carte.fond, 'cabinet')
  }))

// ── Le thème de celui qui regarde n'y peint rien ────────────────────────────

const CLIENT = new URL('../../client/src/', import.meta.url)
const ECART = ':where(:not(.carte-fond, .carte-fond *))'

/**
 * Les règles d'une feuille, à plat : commentaires retirés, blocs `@media`
 * déroulés, `@keyframes` et `@font-face` laissés de côté — ils ne peignent
 * aucun élément.
 */
function reglesDe(css: string): { selecteurs: string[]; corps: string }[] {
  const out: { selecteurs: string[]; corps: string }[] = []
  const lire = (texte: string) => {
    let j = 0
    while (j < texte.length) {
      const ouvre = texte.indexOf('{', j)
      if (ouvre < 0) break
      let profondeur = 1
      let k = ouvre + 1
      for (; k < texte.length && profondeur > 0; k++) profondeur += texte[k] === '{' ? 1 : texte[k] === '}' ? -1 : 0
      const tete = texte.slice(j, ouvre).trim()
      const corps = texte.slice(ouvre + 1, k - 1)
      if (/^@(media|supports)/.test(tete)) lire(corps)
      else if (!tete.startsWith('@')) {
        // Une virgule dans une parenthèse — `:not(a, b)` — ne sépare rien.
        const selecteurs: string[] = []
        let niveau = 0
        let debut = 0
        for (let i = 0; i < tete.length; i++) {
          if (tete[i] === '(') niveau++
          else if (tete[i] === ')') niveau--
          else if (tete[i] === ',' && niveau === 0) {
            selecteurs.push(tete.slice(debut, i).trim())
            debut = i + 1
          }
        }
        selecteurs.push(tete.slice(debut).trim())
        out.push({ selecteurs, corps })
      }
      j = k
    }
  }
  lire(css.replace(/\/\*[\s\S]*?\*\//g, ''))
  return out
}

/**
 * Ce qu'une carte à fond montre : les classes que posent la carte d'un
 * joueur, l'identité en tête du profil et ce qu'elles affichent — lues dans
 * leur code, pour qu'une case de plus y entre d'elle-même —, les familles
 * des avatars (finitions, lumière, médaillons, portraits), et les balises.
 */
const DANS_LA_CARTE = (() => {
  const classes = new Set<string>()
  for (const c of ['CarteJoueur', 'Identite', 'Niveau', 'Laurier', 'Ecusson', 'Glossaire', 'Icon', 'Avatar', 'Lumiere', 'Cercle', 'Chiffres']) {
    const src = readFileSync(new URL(`components/${c}.tsx`, CLIENT), 'utf8')
    for (const m of src.matchAll(/className=(\{[^}]*\}|"[^"]*")/g)) {
      for (const litteral of m[1].matchAll(/['"`]([^'"`$]*)/g)) {
        for (const cle of litteral[1].split(/\s+/)) if (/^[a-z][a-z0-9-]*[a-z0-9]$/.test(cle)) classes.add(cle)
      }
    }
  }
  return classes
})()
const FAMILLES_D_AVATARS = /^(av|lu|lg|dv|pt)(-|$)/
const BALISES_DE_LA_CARTE = new Set(['h3', 'p', 'b', 'span', 'ul', 'li', 'dl', 'dt', 'dd', 'header', 'button', 'div', 'svg', 'details', 'summary', 'i', 'strong', 'em'])
/** Des modificateurs : seuls, ils ne désignent rien de la carte — `.result-banner .big` n'y est pas. */
const MODIFICATEURS = new Set(['big', 'num', 'sr-only'])
/** Ce qui peint : une couleur, un fond, un filet, une ombre, un halo. La forme et la police suivent le thème. */
const PEINT = /^(color|background(-[\w-]+)?|border(-(?!radius)[\w-]+)?|box-shadow|text-shadow|filter|backdrop-filter|fill|stroke|opacity|outline(-[\w-]+)?|-webkit-text-stroke(-[\w-]+)?|text-decoration(-[\w-]+)?)$/

/** Un sélecteur dont le sujet peut être la carte, ou ce qu'elle montre. */
function toucheLaCarte(selecteur: string): boolean {
  const sujet = selecteur.replace(/^:root\[data-theme='[a-z]+'\](\[[^\]]*\])*/, '').trim()
  if (!sujet) return false
  const dernier = sujet.split(/\s*[\s>+~]\s*(?![^(]*\))/).pop()!.replace(/::[\w-]+$/, '')
  const classes = [...dernier.replace(/:(not|where|is)\([^)]*\)+/g, '').matchAll(/\.([\w-]+)/g)].map(m => m[1])
  // Un composé ne touche la carte que si chacune de ses classes s'y trouve.
  if (classes.length > 0) return classes.every(c => DANS_LA_CARTE.has(c) || FAMILLES_D_AVATARS.test(c)) && classes.some(c => !MODIFICATEURS.has(c))
  const balise = /^[a-z][\w-]*/.exec(dernier)?.[0]
  return !!balise && BALISES_DE_LA_CARTE.has(balise)
}

test('aucun thème ne peint une carte à fond : son décor reste nocturne sous tous les habillages', () => {
  // Le `.card` d'un thème, plus précis que le fond (0,3,0 contre 0,2,0), le
  // repeignait : la carte de joueur s'ouvrait blanche sous Héros, l'encre
  // claire dessus (la remarque du propriétaire du 5 octobre 2026). Et ce
  // qu'un thème clair peint en dur — une rubrique noire, la pastille du
  // niveau, un halo de vélin — se perdait sur la nuit du décor.
  assert.ok(DANS_LA_CARTE.has('carte-joueur') && DANS_LA_CARTE.has('identite-nom') && DANS_LA_CARTE.has('niveau'), 'les classes de la carte sont lues')
  const feuilles: [string, string][] = readdirSync(new URL('themes/', CLIENT))
    .filter(f => f.endsWith('.css'))
    .map(f => [f, readFileSync(new URL(`themes/${f}`, CLIENT), 'utf8')])
  // Ivoire vit dans la feuille commune : ses règles à lui seulement.
  const commune = readFileSync(new URL('styles.css', CLIENT), 'utf8')
  feuilles.push(['styles.css (Ivoire)', commune])
  let ecartees = 0
  for (const [nom, css] of feuilles) {
    for (const r of reglesDe(css)) {
      const peint = [...r.corps.matchAll(/(?:^|;)\s*([\w-]+)\s*:/g)].some(m => PEINT.test(m[1]))
      if (!peint) continue
      for (const s of r.selecteurs) {
        if (!/^:root\[data-theme='[a-z]+'\]/.test(s) || !toucheLaCarte(s)) continue
        assert.ok(s.includes(ECART), `${nom} : « ${s} » peindrait une carte à fond — ajoute ${ECART} à son sujet`)
        ecartees++
      }
    }
  }
  assert.ok(ecartees >= feuilles.length, `chaque thème écarte au moins son .card (${ecartees} règles)`)

  // Dedans, les couleurs sont celles du Velours, déclarées sur la carte
  // même : celles du thème, posées sur la racine, n'y descendent pas.
  const velours = commune.slice(commune.indexOf(':root, .carte-fond {'), commune.indexOf('\n}', commune.indexOf(':root, .carte-fond {')))
  for (const jeton of ['--bg', '--bg-raised', '--surface', '--accent', '--accent-soft', '--track', '--bronze-text', 'color-scheme']) {
    assert.match(velours, new RegExp(`^\\s*${jeton}:`, 'm'), `la carte à fond reprend ${jeton} du Velours`)
  }
  // L'identité en tête du profil écrit à l'encre, pas à celle de la page :
  // héritée, elle restait sombre sous un thème clair, sur le décor de nuit.
  assert.match(/\n\.identite \{([^}]*)\}/.exec(commune)?.[1] ?? '', /\bcolor:\s*var\(--ink\);/)
})
