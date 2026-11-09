// Le sceau des légendaires (le 9 novembre 2026, `retours/2026-11-09/`) : le
// Cabinet donne un légendaire au bout de chaque traversée gagnée, et sa voie
// d'origine ne valait plus rien une fois le légendaire en main. Elle donne
// désormais son sceau — l'étoile du zénith, que toute la salle voit. Une
// dérivation des récompenses rangées : rien n'est repris, et qui tenait déjà
// sa voie a son sceau d'emblée.
import { test, after, before } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  LEGENDAIRES,
  LEGENDAIRES_DU_CABINET,
  cleDuCabinet,
  estScellable,
  estScelle,
  legendaire,
  legendairesDebloques,
  legendairesScelles,
  voiesDuSceau,
} from '../../shared/legendaires'
import { clePalier } from '../../shared/hautsfaits'
import { apparenceDeLAvatar, distinctions, sceauVisible } from '../../shared/profil'
import { avecLEssai, essayer, lignesDeLEssai, type Tenue } from '../../shared/loge'
import { demarrer, ecrire, inscrireProfil, invite, instantane, type Banc } from './banc'

test('seuls se scellent les légendaires qu’un raccourci donne aussi, hors des fêtes', () => {
  for (const cle of LEGENDAIRES_DU_CABINET) assert.ok(estScellable(legendaire(cle)!), `${cle} : le Cabinet le donne, son exploit le scelle`)
  // Une seule voie : rien à distinguer.
  for (const cle of ['lg:aigle', 'lg:elephant', 'lg:djinn']) assert.equal(estScellable(legendaire(cle)!), false, cle)
  // De saison : le Cabinet range sa condition même, la voie et le raccourci s'y confondent.
  for (const l of LEGENDAIRES.filter(x => x.saison)) assert.equal(estScellable(l), false, l.key)
  // Son sceau ne demande jamais un raccourci.
  for (const l of LEGENDAIRES.filter(estScellable)) {
    assert.ok(voiesDuSceau(l).length > 0, l.key)
    for (const v of voiesDuSceau(l)) assert.ok('toutes' in v || (!v.hautFait.startsWith('cabinet:') && !v.hautFait.startsWith('expedition:')), l.key)
  }
})

test('gagnée au Cabinet, la Comète est à lui sans son sceau ; ses quatre cents réflexes la scellent', () => {
  const auCabinet = new Map([[cleDuCabinet('lg:comete'), 1]])
  assert.ok(legendairesDebloques(auCabinet).includes('lg:comete'))
  assert.equal(estScelle('lg:comete', auCabinet), false)
  assert.deepEqual(legendairesScelles(auCabinet), [])
  const avecLExploit = new Map([...auCabinet, [clePalier('hf:reflexe', 3), 1]])
  assert.ok(estScelle('lg:comete', avecLExploit))
  assert.deepEqual(legendairesScelles(avecLExploit), ['lg:comete'])
  // Par son exploit seul, d'emblée.
  assert.ok(estScelle('lg:comete', new Map([[clePalier('hf:reflexe', 3), 1]])))
  // Un légendaire tenu sous une règle d'avant garde son sceau si c'était son exploit — pas si c'était le Cabinet.
  assert.ok(estScelle('lg:oracle', new Map([['hf:oracle', 5]]), new Map([['lg:oracle', { hautFait: 'hf:oracle', fois: 5 }]])))
  assert.equal(estScelle('lg:oracle', auCabinet, new Map([['lg:oracle', { hautFait: cleDuCabinet('lg:oracle'), fois: 1 }]])), false)
})

test('le sceau ne voyage qu’avec un légendaire, et se lit du profil comme au serveur', () => {
  assert.deepEqual(distinctions({ sceau: true }), {})
  assert.deepEqual(apparenceDeLAvatar({ legendaire: 'lg:comete', sceau: true }), { legendaire: 'lg:comete', sceau: true })
  assert.equal(sceauVisible({ legendaire: 'lg:comete', scelles: ['lg:comete'] }), true)
  assert.equal(sceauVisible({ legendaire: 'lg:comete', scelles: ['lg:comete'], sceauMasque: true }), false)
  assert.equal(sceauVisible({ legendaire: 'lg:dragon', scelles: ['lg:comete'] }), false)
  assert.equal(sceauVisible({ legendaire: null, scelles: ['lg:comete'] }), false)
})

test('la loge l’essaie comme le reste : masqué sur la carte, une ligne dans la barre, rien s’il revient à ce qu’il porte', () => {
  const porte = { avatar: '🦊', legendaire: 'lg:comete', finitionChoisie: 'auto', titre: null, vitrineChoisie: null, fond: null, theme: null, gerbe: null, bordureChoisie: 'auto', scelles: ['lg:comete'] } as unknown as Tenue
  const essai = essayer({}, { sceau: false }, porte)
  assert.deepEqual(essai, { sceau: false })
  const vu = avecLEssai({ ...porte, finition: 'or', niveau: 12 } as any, essai)
  assert.equal(sceauVisible(vu), false)
  assert.deepEqual(essayer(essai, { sceau: true }, porte), {})
  assert.ok(lignesDeLEssai(essai, { niveau: 12 } as any).some(l => l.detail === 'Sceau' && l.nom === 'Masqué'))
})

// ── Par le serveur ─────────────────────────────────────────────────────────

let banc: Banc
before(async () => {
  banc = await demarrer()
})
after(() => banc?.close())

const ranger = (profil: string, badge: string, sous: string) => {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    db.prepare('INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, ?, ?, ?, ?, 1)').run(profil, badge, sous, '', '✨', badge)
  } finally {
    db.close()
  }
}
const lire = async (cookie: string, chemin: string) => {
  const res = await fetch(banc.url + chemin, { headers: { cookie } })
  assert.equal(res.status, 200, chemin)
  return res.json() as Promise<any>
}

test('du Cabinet à son exploit : la carte, le profil et la salle voient le sceau ; masqué, il reste à lui', async () => {
  const cookie = await inscrireProfil(banc.url, 'scelle', 'Camille')
  const id = (await lire(cookie, '/api/joueur/moi?leger')).profile.id as string
  // Le gardien vaincu au Cabinet : la Comète est à lui, sans son sceau. L'étagère se relit au réveil.
  ranger(id, cleDuCabinet('lg:comete'), '#cabinet')
  await banc.redemarrer()
  assert.equal((await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:comete' }, cookie, 'PUT')).status, 200)
  let carte = await lire(cookie, '/api/joueur/carte')
  assert.equal(carte.legendaire, 'lg:comete')
  assert.equal(carte.sceau, undefined)
  let profil = (await lire(cookie, '/api/joueur/moi?leger')).profile
  assert.deepEqual(profil.scelles, [])
  assert.equal(profil.sceauMasque, false)

  // Son exploit : quatre cents réflexes. La Comète est scellée — d'emblée, sans rien choisir.
  ranger(id, clePalier('hf:reflexe', 3), 'une-soiree')
  await banc.redemarrer()
  carte = await lire(cookie, '/api/joueur/carte')
  assert.equal(carte.sceau, true)
  profil = (await lire(cookie, '/api/joueur/moi?leger')).profile
  assert.deepEqual(profil.scelles, ['lg:comete'])

  // Dans la salle, toute la salle le voit.
  const camille = await invite(banc.url, 'Camille', '🦊', { cookie })
  const salle = await instantane<any>(camille.socket)
  assert.equal(salle.players.find((p: any) => p.id === camille.playerId)?.sceau, true)
  camille.socket.close()

  // Masqué dans la loge : il reste à lui, la salle ne le voit plus.
  assert.equal((await ecrire(banc.url, '/api/joueur/moi', { sceau: false }, cookie, 'PUT')).status, 200)
  carte = await lire(cookie, '/api/joueur/carte')
  assert.equal(carte.sceau, undefined)
  profil = (await lire(cookie, '/api/joueur/moi?leger')).profile
  assert.equal(profil.sceauMasque, true)
  assert.deepEqual(profil.scelles, ['lg:comete'])
  // Un réglage qui n'est ni oui ni non se refuse en mots.
  const refus = await ecrire(banc.url, '/api/joueur/moi', { sceau: 'peut-etre' }, cookie, 'PUT')
  assert.equal(refus.status, 400)
  // Montré de nouveau.
  assert.equal((await ecrire(banc.url, '/api/joueur/moi', { sceau: true }, cookie, 'PUT')).status, 200)
  assert.equal((await lire(cookie, '/api/joueur/carte')).sceau, true)
})
