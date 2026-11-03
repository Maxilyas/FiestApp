// Les matières de l'Éclat (le choix du propriétaire du 3 novembre 2026, sa
// maquette « Les matières de l'Éclat ») : l'Éclat rend un avatar rare, et
// chaque Éclat de plus sur le même avatar le taille dans une matière —
// porcelaine, corail, jade, obsidienne —, qu'il porte s'il la préfère ; les
// quatre réunies ouvrent l'Opale. « Pour des joueurs qui aiment avoir des
// choses rares et belles et qui aiment la customisation, sans que ça devienne
// incompréhensible » : une matière, un Éclat — celui de la réserve.
//
// Ce qui doit tenir : une matière se taille avec un Éclat en réserve, dans un
// avatar déjà éclaté, une fois chacune, jamais l'Opale ; la ligne de la
// réserve devient la sienne et suit le sort de sa soirée ; il la porte quand
// il l'a, la salle la voit, un redémarrage la retrouve ; tout ce qui recopie
// l'Éclat la garde ; l'avatar la dessine — l'emoji, le légendaire, le
// portrait ; la gemme de l'Éclat prend sa couleur et remplace les points ; la
// loge l'essaie comme le reste. Chaque épreuve échouait avant : il n'y avait
// pas de matière.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import React from 'react'
import Database from 'better-sqlite3'
import { ProfileStore, cleDeSoiree } from '../src/auth/profiles'
import {
  MATIERES,
  MATIERES_A_TAILLER,
  OPALE,
  cleDeMatiere,
  lireCleDeMatiere,
  matieresATailler,
  matieresOuvertes,
  peutSeTailler,
  tablesDeLaMatiere,
} from '../../shared/matieres'
import { apparenceDeLAvatar, distinctions, eclatChez, gainVide, releveVide } from '../../shared/profil'

// Le client compile son JSX pour un `React` global : posé avant tout import
// d'un composant — et une page, que la fin d'une partie lit en s'important.
Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/profil', search: '', hash: '', origin: 'http://banc' } },
  location: { pathname: '/profil', search: '', hash: '', origin: 'http://banc' },
})

// Le hasard ne décide de rien ici : les épreuves qui veulent un Éclat le donnent.
ProfileStore.tirageEclat = () => false

const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href

/** Un composant du client, rendu en HTML. */
async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(url(`${fichier}.tsx`))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** La feuille du client, sans ses commentaires. */
const CSS = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** Toutes les règles de la feuille qui nomment ce sélecteur, mises bout à bout. */
const regles = (selecteur: string) =>
  [...CSS.matchAll(/([^{}]*)\{([^{}]*)\}/g)]
    .filter(m => m[1].split(',').map(s => s.trim()).includes(selecteur))
    .map(m => m[2])
    .join('\n')

async function dansUneBase(scenario: (profils: ProfileStore, id: string, ouvrir: () => ProfileStore, lire: <T>(fn: (db: Database.Database) => T) => T) => Promise<void>) {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-matieres-'))
  const fichier = path.join(dir, 'permanente.db')
  const adresse = `file:${fichier.replace(/\\/g, '/')}`
  const ouverts: ProfileStore[] = []
  const ouvrir = () => {
    const p = new ProfileStore(adresse)
    ouverts.push(p)
    return p
  }
  try {
    const profils = ouvrir()
    await profils.init()
    const { profile } = await profils.register({ login: 'lea', password: 'motdepasse1', name: 'Léa', avatar: '🦊' })
    const lire = <T>(fn: (db: Database.Database) => T): T => {
      const db = new Database(fichier)
      try {
        return fn(db)
      } finally {
        db.close()
      }
    }
    await scenario(profils, profile.id, ouvrir, lire)
  } finally {
    for (const p of ouverts) (p as any).close?.()
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Ses lignes d'Éclats, rangées par leur soirée. */
const lignes = (lire: <T>(fn: (db: Database.Database) => T) => T, id: string) =>
  lire(db => db.prepare('SELECT avatar, soiree_id FROM profile_eclats WHERE profile_id = ? ORDER BY soiree_id, avatar').all(id)) as { avatar: string; soiree_id: string }[]

// ── 1. Les règles ─────────────────────────────────────────────────────────

test('quatre matières, dans l’ordre de la loge, puis l’Opale quand elles sont réunies', () => {
  assert.deepEqual(matieresOuvertes([]), [])
  assert.deepEqual(matieresOuvertes(['jade', 'porcelaine']), ['porcelaine', 'jade'])
  assert.deepEqual(matieresOuvertes(MATIERES_A_TAILLER), [...MATIERES_A_TAILLER, OPALE])
  assert.deepEqual(matieresATailler(['jade']), ['porcelaine', 'corail', 'obsidienne'])
  // La clé de sa ligne : la matière, puis l'avatar, ses deux-points compris.
  assert.equal(cleDeMatiere('jade', 'lg:phenix'), 'matiere:jade:lg:phenix')
  assert.deepEqual(lireCleDeMatiere('matiere:jade:lg:phenix'), { matiere: 'jade', avatar: 'lg:phenix' })
  assert.deepEqual(lireCleDeMatiere('matiere:corail:🦊'), { matiere: 'corail', avatar: '🦊' })
  assert.equal(lireCleDeMatiere('matiere:opale:🦊'), null, 'l’Opale ne se taille pas')
  assert.equal(lireCleDeMatiere('matiere:marbre:🦊'), null)
  assert.equal(lireCleDeMatiere('reserve:abc'), null)
  assert.equal(lireCleDeMatiere('lg:phenix'), null)
  // Ce qui prend une matière : ce qui a une version rare à choisir.
  for (const cle of ['🦊', 'lg:phenix', 'br:cerf']) assert.ok(peutSeTailler(cle), cle)
  for (const cle of ['dv:helios', 'cp:loup-ultime', '']) assert.ok(!peutSeTailler(cle), cle)
  // Chaque matière a ses trois tables, cinq crans chacune, du sombre au clair.
  for (const m of MATIERES) {
    for (const table of tablesDeLaMatiere(m)) {
      const crans = table.split(' ').map(Number)
      assert.equal(crans.length, 5, m)
      assert.ok(crans.every(x => x >= 0 && x <= 1), `${m} : ${table}`)
    }
  }
})

test('ce qui brille : la matière qu’il porte tant qu’il l’a, sa version rare sinon — et elle voyage telle quelle', () => {
  const p = { eclats: ['🦊'], eclatsEteints: [] as string[], matieres: { '🦊': ['jade' as const] }, matieresPortees: { '🦊': 'jade' as const } }
  assert.equal(eclatChez(p, '🦊'), 'jade')
  assert.equal(eclatChez({ ...p, matieresPortees: {} }, '🦊'), true, 'sans matière portée, sa version rare')
  assert.equal(eclatChez({ ...p, matieres: {} }, '🦊'), true, 'une matière reprise : sa version rare')
  assert.equal(eclatChez({ ...p, eclatsEteints: ['🦊'] }, '🦊'), false, 'éteint, rien ne brille')
  assert.equal(eclatChez({ ...p, matieresPortees: { '🦊': 'opale' } }, '🦊'), true, 'l’Opale demande les quatre')
  assert.equal(eclatChez({ ...p, matieres: { '🦊': [...MATIERES_A_TAILLER] }, matieresPortees: { '🦊': 'opale' } }, '🦊'), 'opale')
  assert.equal(eclatChez({ eclats: ['🦊'] }, '🦊'), true, 'un serveur d’avant : sa version rare')
  assert.equal(eclatChez(p, '🐸'), false)
  // Recopiée, elle garde sa matière : `true` la lui ôterait.
  assert.equal(distinctions({ eclat: 'jade' }).eclat, 'jade')
  assert.equal(apparenceDeLAvatar({ eclat: 'jade' }).eclat, 'jade')
  assert.equal(distinctions({ eclat: false }).eclat, undefined)
})

test('rien ne recopie l’Éclat d’un joueur en `true` : sa matière se perdrait en route', () => {
  // Les classements, la salle, les duels, la campagne : chaque ligne qui
  // nommait un joueur écrivait `eclat: true`. Seul le compagnon garde le sien,
  // qui dit à la niche si l'Éclat brille sur lui (`CompagnonPossede.eclat`).
  const permis = [/client[\\/]src[\\/]niche\.ts$/, /server[\\/]src[\\/]auth[\\/]profiles\.ts$/]
  const fautifs: string[] = []
  const parcourir = (dossier: URL) => {
    for (const nom of readdirSync(dossier)) {
      const chemin = new URL(nom, dossier)
      if (statSync(chemin).isDirectory()) {
        parcourir(new URL(`${nom}/`, dossier))
        continue
      }
      if (!/\.tsx?$/.test(nom)) continue
      const texte = readFileSync(chemin, 'utf8')
      for (const [i, ligne] of texte.split('\n').entries()) {
        if (/eclat: true( as const)?\s*\}/.test(ligne) && !permis.some(r => r.test(chemin.pathname))) fautifs.push(`${chemin.pathname}:${i + 1}`)
        if (/eclat: true( as const)?\s*\}/.test(ligne) && /profiles\.ts$/.test(chemin.pathname) && !/formes\[0\]/.test(ligne)) fautifs.push(`${chemin.pathname}:${i + 1}`)
      }
    }
  }
  for (const d of ['../../server/src/', '../../shared/', '../../client/src/']) parcourir(new URL(d, import.meta.url))
  assert.deepEqual(fautifs, [])
})

// ── 2. Au serveur ─────────────────────────────────────────────────────────

test('un Éclat en réserve taille une matière dans un avatar éclaté : la ligne de la réserve devient la sienne, sous sa soirée', () =>
  dansUneBase(async (profils, id, _ouvrir, lire) => {
    await profils.donnerUnEclat(id, '🦊', 'soiree-1')
    await profils.donnerUnEclat(id, '🦊', 'soiree-2')
    const rec = await profils.update(id, { matiereDeReserve: { cle: '🦊', matiere: 'jade' } })
    const pub = profils.toPublic(rec)
    assert.deepEqual(pub.matieres, { '🦊': ['jade'] })
    assert.equal(pub.eclatsEnReserve, 0)
    assert.deepEqual(pub.eclats, ['🦊'], 'aucun avatar de plus n’a éclaté')
    assert.deepEqual(lignes(lire, id), [
      { avatar: '🦊', soiree_id: 'soiree-1' },
      { avatar: 'matiere:jade:🦊', soiree_id: 'soiree-2' },
    ])
    // Taillée, elle ne se porte pas d'office : sa version rare brille toujours.
    assert.equal(profils.apparenceDe(rec).eclat, true)
    assert.deepEqual(pub.matieresPortees, {})
  }))

test('une matière ne se taille qu’avec un Éclat en réserve, dans un avatar éclaté, une fois chacune — jamais l’Opale', () =>
  dansUneBase(async profils => {
    const { profile } = await profils.register({ login: 'tom', password: 'motdepasse1', name: 'Tom', avatar: '🦊' })
    const id = profile.id
    await profils.donnerUnEclat(id, '🦊', 'soiree-1')
    const tailler = (cle: unknown, matiere?: unknown) => profils.update(id, { matiereDeReserve: matiere === undefined ? cle : { cle, matiere } })
    await assert.rejects(tailler('🦊', 'jade'), /aucun Éclat en réserve/, 'sans réserve, rien')
    await profils.donnerUnEclat(id, '🦊', 'soiree-2')
    await assert.rejects(tailler('🐸', 'jade'), /une fois éclaté/)
    await assert.rejects(tailler('🦊', 'opale'), /Opale ne se taille pas/)
    await assert.rejects(tailler('🦊', 'marbre'), /n’existe pas/)
    await assert.rejects(tailler('🦊'), /n’existe pas/)
    await assert.rejects(profils.update(id, { eclatDeReserve: '🐸', matiereDeReserve: { cle: '🦊', matiere: 'jade' } }), /Un seul Éclat à la fois/)
    // Un compagnon éclaté n'en prend pas : l'Éclat lui ouvre sa métamorphose. Un Divin n'éclate jamais.
    await profils.grantEclat(id, 'cp:loup-jeune', 'soiree-loup')
    await assert.rejects(tailler('cp:loup-jeune', 'jade'), /compagnon ne prend pas de matière/)
    await profils.grantEclat(id, 'dv:helios', 'soiree-divin')
    await assert.rejects(tailler('dv:helios', 'jade'), /Divin/)
    assert.equal(profils.reserveOf(id), 1, 'un refus ne dépense rien')

    await tailler('🦊', 'jade')
    await profils.donnerUnEclat(id, '🦊', 'soiree-3')
    await assert.rejects(tailler('🦊', 'jade'), /déjà taillé en jade/)
    assert.equal(profils.reserveOf(id), 1)
  }))

test('deux tailles parties ensemble ne prennent ni le même Éclat, ni la même matière', () =>
  dansUneBase(async (profils, id) => {
    await profils.donnerUnEclat(id, '🦊', 'soiree-1')
    await profils.donnerUnEclat(id, '🦊', 'soiree-2')
    await profils.donnerUnEclat(id, '🦊', 'soiree-3')
    const memes = await Promise.allSettled([
      profils.update(id, { matiereDeReserve: { cle: '🦊', matiere: 'corail' } }),
      profils.update(id, { matiereDeReserve: { cle: '🦊', matiere: 'corail' } }),
    ])
    assert.deepEqual(memes.map(r => r.status).sort(), ['fulfilled', 'rejected'])
    assert.equal(profils.reserveOf(id), 1)
    assert.deepEqual(profils.toPublic((await profils.byId(id))!).matieres, { '🦊': ['corail'] })
  }))

test('il porte la matière qu’il a taillée : la salle la voit, et un redémarrage la retrouve', () =>
  dansUneBase(async (profils, id, ouvrir) => {
    await profils.donnerUnEclat(id, '🦊', 'soiree-1')
    await profils.donnerUnEclat(id, '🦊', 'soiree-2')
    await profils.update(id, { matiereDeReserve: { cle: '🦊', matiere: 'jade' } })
    const porter = (p: ProfileStore, matiere: unknown, brille = true) => p.update(id, { eclat: { cle: '🦊', brille, matiere } })
    await assert.rejects(porter(profils, 'corail'), /pas encore taillé en corail/)
    await assert.rejects(porter(profils, 'opale'), /Opale s’ouvre avec les quatre/)
    await assert.rejects(porter(profils, 'marbre'), /n’existe pas/)

    const rec = await porter(profils, 'jade')
    assert.equal(profils.apparenceDe(rec).eclat, 'jade')
    assert.equal(profils.badgeDe(id, '🦊')?.eclat, 'jade', 'la salle la voit')
    assert.deepEqual(profils.toPublic(rec).matieresPortees, { '🦊': 'jade' })

    // Un autre processus relit la base : il la porte toujours.
    const relu = ouvrir()
    await relu.init()
    const lu = (await relu.byId(id))!
    assert.equal(relu.apparenceDe(lu).eclat, 'jade')
    assert.deepEqual(relu.toPublic(lu).matieres, { '🦊': ['jade'] })
    // Sa version rare, puis celle d'origine : la version d'origine n'en porte aucune.
    assert.equal(relu.apparenceDe(await porter(relu, null)).eclat, true)
    assert.equal(relu.apparenceDe(await porter(relu, 'jade', false)).eclat, false)
    assert.deepEqual(relu.toPublic((await relu.byId(id))!).matieresPortees, {})
  }))

test('les quatre réunies ouvrent l’Opale ; une soirée retirée reprend sa matière, et l’Opale avec', () =>
  dansUneBase(async (profils, id) => {
    await profils.donnerUnEclat(id, '🦊', 'soiree-0')
    for (const [i, m] of MATIERES_A_TAILLER.entries()) {
      await profils.donnerUnEclat(id, '🦊', `soiree-${i + 1}`)
      await profils.update(id, { matiereDeReserve: { cle: '🦊', matiere: m } })
    }
    const rec = await profils.update(id, { eclat: { cle: '🦊', brille: true, matiere: OPALE } })
    assert.equal(profils.apparenceDe(rec).eclat, OPALE)
    assert.deepEqual(profils.toPublic(rec).matieres, { '🦊': [...MATIERES_A_TAILLER] }, 'l’Opale ne se range pas : les quatre la font')

    // Le jade venait de la soirée 3 : retirée, elle le reprend, et l'Opale ne tient plus — sa version rare brille à sa place.
    await profils.retirerSoiree(id, 'soiree-3')
    const apres = (await profils.byId(id))!
    assert.deepEqual(profils.toPublic(apres).matieres, { '🦊': ['porcelaine', 'corail', 'obsidienne'] })
    assert.equal(profils.apparenceDe(apres).eclat, true)
  }))

test('une matière compte pour La Pluie d’Éclats comme un avatar qui éclate, rangée sous l’Éclat qui l’a taillée', () =>
  // Le choix du propriétaire du 3 novembre 2026 : tailler une matière est un Éclat de plus sur ses avatars.
  dansUneBase(async (profils, id, _ouvrir, lire) => {
    ProfileStore.tirageEclat = () => true
    const pluie = () => lire(db => db.prepare(`SELECT badge, soiree_id FROM profile_badges WHERE profile_id = ? AND badge LIKE 'hf:eclats:%' ORDER BY badge`).all(id))
    try {
      // 🦊 éclate, puis deux Éclats tombent sur lui : ils attendent en réserve, et ne comptent pas encore.
      assert.equal((await profils.tirerUnEclat(id, 'jour:2026-11-01', 40))?.avatar, '🦊')
      await profils.tirerUnEclat(id, 'jour:2026-11-02', 40)
      await profils.tirerUnEclat(id, 'jour:2026-11-03', 40)
      assert.deepEqual(pluie(), [{ badge: 'hf:eclats:1', soiree_id: 'jour:2026-11-01' }])
      // Taillés en jade et en corail : trois Éclats sur ses avatars — l'argent tombe à la taille qui les fait trois, sous
      // le jour de l'Éclat qui l'a taillée, comme un avatar qu'une réserve fait éclater.
      await profils.update(id, { matiereDeReserve: { cle: '🦊', matiere: 'jade' } })
      assert.deepEqual(pluie(), [{ badge: 'hf:eclats:1', soiree_id: 'jour:2026-11-01' }], 'deux Éclats : pas encore l’argent')
      await profils.update(id, { matiereDeReserve: { cle: '🦊', matiere: 'corail' } })
      assert.deepEqual(pluie(), [
        { badge: 'hf:eclats:1', soiree_id: 'jour:2026-11-01' },
        { badge: 'hf:eclats:2', soiree_id: 'jour:2026-11-03' },
      ])
      assert.equal(profils.eclatsOf(id).length, 1, 'un seul avatar éclaté')
      assert.equal(profils.eclatsPosesOf(id), 3)
      // La carrière la compte aussi — sa jauge dans l'album, la clôture d'une soirée.
      assert.equal((await profils.careerOf(id)).eclats, 3)

      // Une matière taillée par l'Éclat d'une soirée qui se joue encore ne compte pas, comme son avatar ne compterait
      // pas : la soirée, écartée, se compte en base (`eclatsHors`) — et l'Éclat de la réserve, lui, jamais.
      await profils.creditSoiree({ profileId: id, soireeId: 'essai', spaceId: 'salon', gain: gainVide(), releve: releveVide(), xp: 0 })
      await profils.donnerUnEclat(id, '🦊', 'essai')
      assert.equal((await profils.careerOf(id, new Set([cleDeSoiree('salon', 'essai')]))).eclats, 3, 'en réserve, il ne compte nulle part')
      await profils.update(id, { matiereDeReserve: { cle: '🦊', matiere: 'obsidienne' } })
      assert.equal((await profils.careerOf(id)).eclats, 4)
      assert.equal((await profils.careerOf(id, new Set([cleDeSoiree('salon', 'essai')]))).eclats, 3, 'l’essai écarté emporte sa matière')
    } finally {
      ProfileStore.tirageEclat = () => false
    }
  }))

// ── 3. Le dessin ──────────────────────────────────────────────────────────

test('un emoji taillé se dessine dans sa matière : sa lumière devient la matière', async () => {
  const jade = await rendu('components/Avatar', 'Avatar', { avatar: '🦊', finition: 'argent', eclat: 'jade' })
  assert.match(jade, /^<span class="av av-argent av-eclat av-matiere av-matiere-jade">/)
  assert.match(jade, /<svg class="av-emoji-matiere" viewBox="0 0 100 100" role="img" aria-label="🦊 en jade">/)
  assert.match(jade, /<feColorMatrix type="matrix" values="\.2126 \.7152/)
  assert.match(jade, /<feFuncR type="table" tableValues="0\.012 0\.051 0\.165 0\.592 0\.941"/, 'la table du jade')
  assert.match(jade, /<text[^>]*filter="url\(#[^"]+\)"[^>]*>🦊<\/text>/)
  // Sa version rare reste ce qu'elle était : l'emoji, ses couleurs tournées.
  const rare = await rendu('components/Avatar', 'Avatar', { avatar: '🦊', finition: 'argent', eclat: true })
  assert.doesNotMatch(rare, /av-matiere|<svg/)
  // Deux emojis taillés sur une page ne partagent jamais un filtre.
  const ids = [...(jade + (await rendu('components/Avatar', 'Avatar', { avatar: '🦊', eclat: 'corail' }))).matchAll(/<filter id="([^"]+)"/g)].map(m => m[1])
  assert.equal(new Set(ids).size, ids.length)
})

test('un légendaire taillé : sa version rare dans sa matière, sous son seul reflet — une matière est un objet, pas une carte', async () => {
  const html = await rendu('components/Legendaire', 'Legendaire', { cle: 'lg:phenix', eclat: 'obsidienne' })
  assert.match(html, /class="lg lg-eclat lg-phenix lg-eclate lg-matiere"/)
  assert.match(html, /aria-label="Le Phénix, en obsidienne"/)
  assert.match(html, /<svg class="lg-art" viewBox="0 0 100 100" aria-hidden="true">.*?<image href="\/medaillons\/phenix-rare-256\.[0-9a-f]{10}\.webp"[^>]*filter="url\(#[^"]+\)"/)
  // Ni l'arc-en-ciel, ni sa trame, ni les paillettes : son reflet seul.
  assert.doesNotMatch(html, /lg-feuille|lg-diffraction|lg-paillettes/)
  assert.match(html, /class="lg-reflet"/)
  // Éclaté, il garde sa gerbe et ce qui sort du cadre, taillé aussi.
  assert.match(html, /class="lg-gerbe"/)
  assert.match(html, /<span class="lg-debord"[^>]*><svg[^>]*><defs>.*?<\/defs><image href="\/medaillons\/phenix-rare-perso-256\.[0-9a-f]{10}\.webp"[^>]*filter=/)
  // La matière entre dans ses identifiants : deux états ne se prennent jamais un dégradé.
  const autre = await rendu('components/Legendaire', 'Legendaire', { cle: 'lg:phenix', eclat: 'jade' })
  const idsDe = (h: string) => new Set([...h.matchAll(/ id="([^"]+)"/g)].map(m => m[1]))
  for (const i of idsDe(html)) assert.ok(!idsDe(autre).has(i), i)
  // Sa version rare, elle, reste une carte holo.
  assert.match(await rendu('components/Legendaire', 'Legendaire', { cle: 'lg:phenix', eclat: true }), /class="lg-feuille"/)
})

test('un portrait taillé : tout son tableau dans sa matière', async () => {
  await import(url('components/portraits/foret.ts'))
  const html = await rendu('components/Portrait', 'Portrait', { cle: 'br:cerf', eclat: 'jade' })
  assert.match(html, /aria-label="[^"]+, en jade"/)
  assert.match(html, /<filter id="(pt-cerf-[^"]+_matiere)"/)
  const id = /<filter id="(pt-cerf-[^"]+_matiere)"/.exec(html)![1]
  assert.ok(html.includes(`filter="url(#${id})"`), 'posé sur le tableau')
  assert.doesNotMatch(await rendu('components/Portrait', 'Portrait', { cle: 'br:cerf', eclat: true }), /_matiere/)
})

test('la gemme de l’Éclat remplace les quatre points, et prend la couleur de sa matière', () => {
  // Les points faisaient des poussières (le 3 novembre 2026) : une gemme,
  // celle de la boutique, au coin — sur un emoji et un compagnon partout, sur
  // un médaillon peint dans une liste seulement (`medaillons-peints.test.ts`).
  const gemme = regles('.av-eclat::after')
  assert.match(gemme, /mask:\s*url\("data:image\/svg\+xml,/)
  assert.match(gemme, /var\(--gemme-1/)
  assert.doesNotMatch(gemme, /radial-gradient/, 'plus de points')
  for (const m of MATIERES) assert.match(regles(`.av-matiere-${m}`), /--gemme-1:/, m)
  // Un emoji taillé ne tourne plus ses couleurs : sa matière les tient.
  assert.match(regles('.av-matiere .av-emoji'), /filter:\s*none/)
})

test('la fin d’une partie dit l’Éclat qui a taillé une matière', async () => {
  const html = await rendu('components/Ouverts', 'EclatTombe', { cle: 'matiere:jade:🦊', avatar: '🦊', chance: 40 })
  assert.match(html, /taillé en jade/)
  assert.match(html, /av-matiere-jade/)
})

// ── 4. La loge ────────────────────────────────────────────────────────────

/** Ce qu'il porte : le Phénix éclaté, taillé en corail et en jade, porté dans sa version rare (l'habitué de `grille-avatars.test.ts`). */
const PORTE = {
  id: 'p1',
  login: 'jeanne',
  name: 'Jeanne',
  avatar: '🐸',
  finition: 'holo',
  finitionChoisie: 'holo',
  niveau: 14,
  ouvertes: ['mat', 'argent', 'or', 'holo'],
  legendaire: 'lg:phenix',
  legendaires: ['lg:phenix', 'lg:dragon'],
  divins: [],
  hautsFaits: [],
  sentiers: { foret: 5, mythes: 2 },
  titre: null,
  vitrine: [],
  vitrineChoisie: null,
  titresDates: [],
  fond: null,
  fonds: [],
  theme: null,
  gerbe: null,
  gerbes: [],
  eclats: ['lg:phenix'],
  eclatsEteints: [],
  matieres: { 'lg:phenix': ['corail', 'jade'] },
  matieresPortees: {},
} as any

test('la loge essaie une matière comme le reste : la carte la montre, la barre la dit, « Porter » la garde', async () => {
  const { essayer, avecLEssai, lignesDeLEssai, carteAvecLEssai } = await import('../../shared/loge')
  const jade = essayer({}, { eclat: { cle: 'lg:phenix', brille: true, matiere: 'jade' } }, PORTE)
  assert.deepEqual(jade, { eclat: { cle: 'lg:phenix', brille: true, matiere: 'jade' } })
  assert.deepEqual(avecLEssai(PORTE, jade).matieresPortees, { 'lg:phenix': 'jade' })
  assert.deepEqual(lignesDeLEssai(jade, PORTE), [{ piece: 'avatar', nom: 'Jade', detail: 'Matière' }])
  const carte = carteAvecLEssai({ avatar: '🐸', finition: 'holo', legendaire: 'lg:phenix', eclat: true } as any, { ...PORTE, bordures: [] }, jade)
  assert.equal(carte.eclat, 'jade')
  // Revenir à la version rare qu'il porte : rien à porter.
  assert.deepEqual(essayer(jade, { eclat: { cle: 'lg:phenix', brille: true, matiere: null } }, PORTE), {})
  // Porté, le jade se dit tel quel ; sa version d'origine n'en garde aucune.
  const portee = { ...PORTE, matieresPortees: { 'lg:phenix': 'jade' } }
  assert.deepEqual(essayer({}, { eclat: { cle: 'lg:phenix', brille: true, matiere: 'jade' } }, portee), {})
  const origine = essayer({}, { eclat: { cle: 'lg:phenix', brille: false } }, portee)
  assert.deepEqual(avecLEssai(portee, origine).matieresPortees, {})
  assert.deepEqual(lignesDeLEssai(origine, portee), [{ piece: 'avatar', nom: 'Version d’origine', detail: 'Éclat' }])
  // Le lecteur d'écran entend la matière.
  const { annonceDuChoix } = await import(url('components/choix.ts'))
  assert.equal(annonceDuChoix({ eclat: { cle: 'lg:phenix', brille: true, matiere: 'jade' } }), 'Tu portes sa version en jade.')
})

test('sur la carte de la loge, un avatar taillé ouvre ses versions ; dans la réserve, un avatar éclaté se taille', async () => {
  const laLoge = (profil: object) =>
    rendu('components/Loge', 'Loge', { profil: { ...PORTE, ...profil }, piece: 'avatar', onPiece: () => {}, busy: false, enregistrer: async () => true })
  // Taillé : un bouton qui dit sa version, et ouvre le choix.
  assert.match(await laLoge({}), /<button type="button" class="loge-version loge-version-choix" aria-haspopup="dialog"><svg[^>]*>.*?<\/svg>Version rare<\/button>/)
  assert.match(await laLoge({ matieresPortees: { 'lg:phenix': 'jade' } }), /class="loge-version loge-version-choix"[^>]*>.*?Jade<\/button>/)
  // Sans matière, la bascule d'avant : rare ou d'origine.
  assert.match(await laLoge({ matieres: {} }), /<button type="button" class="loge-version" aria-pressed="true">/)
  // Un Éclat en réserve : dans le choix de la réserve, un avatar éclaté qui peut prendre une matière se taille ;
  // celui qui a ses quatre matières, non.
  const page = (profil: object) =>
    rendu('components/Apparence', 'PageDAvatars', {
      profil: { ...PORTE, eclatsEnReserve: 1, ...profil },
      essai: {},
      essayer: () => {},
      busy: false,
      neufs: new Set(),
      page: { page: 'legendaire', cles: ['lg:phenix', 'lg:dragon'], reste: 0 },
      aEclater: true,
    })
  const html = await page({})
  assert.match(html, /class="loge-case case-avatar anneau-legendaire taillable"[^>]*aria-label="Le Phénix, légendaire, éclaté, à tailler dans une matière"/)
  assert.match(html, /aria-label="Le Dragon d’Or, légendaire, montré éclaté"/)
  assert.match(await page({ matieres: { 'lg:phenix': [...MATIERES_A_TAILLER] } }), /aria-label="Le Phénix, légendaire, éclaté, ne peut plus rien prendre"/)
})

test('la fiche de l’album dit la matière qu’il porte et celles qu’il a, et le dessine dans la sienne', async () => {
  // « Tu portes sa version rare » mentait à qui le portait en jade.
  const phrase = (props: object) => rendu('components/Carriere', 'ChoixDeLEclat', { brille: true, busy: false, ...props })
  assert.match(await phrase({ matiere: 'jade', taillees: ['corail', 'jade'] }), /Il a éclaté : tu le portes en jade, et personne d’autre ne l’a comme ça\. Taillé en corail et en jade\./)
  assert.match(await phrase({ taillees: ['corail'] }), /tu portes sa version rare, et personne d’autre ne l’a comme ça\. Taillé en corail\./)
  assert.match(await phrase({ matiere: 'opale', taillees: [...MATIERES_A_TAILLER] }), /tu le portes en opale.*Taillé dans les quatre matières : l’Opale est à toi\./)
  // Sa version d'origine portée : la matière qu'il a choisie n'y paraît pas.
  assert.doesNotMatch(await phrase({ brille: false, matiere: 'jade', taillees: ['jade'] }), /tu le portes en jade/)
  // Sans matière, la phrase d'avant, telle quelle.
  assert.match(await phrase({}), /<p class="small">Il a éclaté : tu portes sa version rare, et personne d’autre ne l’a comme ça\.<\/p>/)
  // L'album dessine ce qu'il porte : sa matière, pas sa version rare.
  const album = readFileSync(new URL('../../client/src/components/AlbumDesAvatars.tsx', import.meta.url), 'utf8')
  assert.match(album, /const brille = \(k: string\) => eclatChez\(profil, k\)/)
  assert.match(album, /<ChoixDeLEclat [^>]*matiere=\{profil\.matieresPortees\?\.\[a\.cle\] \?\? null\} taillees=\{profil\.matieres\?\.\[a\.cle\]\}/)
})
