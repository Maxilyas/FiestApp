// Contrôle (doit passer) : un profil neuf, niveau 1, sans rien de gagné,
// tente par l'API tout ce que la page ne lui propose pas — et un invité
// anonyme, par `player:join`. Rien ne passe. C'est la moitié « écrire » de la
// matrice de l'audit : elle tient.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, connecter, demarrer, ecrire, emitAck, inscrireProfil, instantane } from '../../../server/test/banc'
import { DEFAULT_AVATAR } from '../../../shared/avatars'

test('rien de ce qui n’est pas gagné ne s’écrit — ni par la page du profil, ni par l’entrée', async () => {
  const banc = await demarrer()
  try {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const porter = async (corps: object) => {
      const r = await ecrire(banc.url, '/api/joueur/moi', corps, alice, 'PUT')
      return { status: r.status, corps: (await r.json()) as any }
    }
    const refus: [object, RegExp][] = [
      [{ avatar: '🦚' }, /niveau 2/],
      [{ avatar: '🦊🪐' }, /niveau 17/],
      [{ avatar: '🦔️' }, /niveau 7/],
      [{ legendaire: 'lg:phenix' }, /pas encore à toi/],
      [{ legendaire: 'lg:citrouille' }, /pas encore à toi/],
      [{ legendaire: 'lg:sphinx' }, /pas encore à toi/],
      [{ legendaire: 'dv:helios' }, /pas encore descendu/],
      [{ titre: 'hf:oracle' }, /se gagne d’abord/],
      [{ titre: 'hf:bavard' }, /se gagne d’abord/],
      [{ titre: 'dv:arbre' }, /se gagne d’abord/],
      [{ titre: 'saison:noel' }, /se gagne d’abord/],
      [{ vitrine: ['hf:oracle'] }, /parmi ceux que tu as gagnés/],
      [{ vitrine: 'hf:oracle' }, /parmi ceux que tu as gagnés/],
      [{ vitrine: [] }, /parmi ceux que tu as gagnés/],
      [{ fond: 'aurore' }, /se gagne d’abord/],
      [{ fond: 'nuit' }, /se gagne d’abord/],
      [{ fond: '__proto__' }, /n’existe pas/],
    ]
    for (const [corps, motif] of refus) {
      const r = await porter(corps)
      assert.equal(r.status, 400, `${JSON.stringify(corps)} passe : ${JSON.stringify(r.corps)}`)
      assert.match(r.corps.error, motif, JSON.stringify(corps))
    }
    // Une finition trop haute ne se refuse pas : elle se lit « la plus belle qu'il a ».
    const finition = await porter({ finition: 'constellation' })
    assert.equal(finition.status, 200)
    assert.equal(finition.corps.profile.finitionChoisie, 'auto')
    assert.equal(finition.corps.profile.finition, 'mat')
    const moi = ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: alice } })).json()) as any).profile
    assert.equal(moi.avatar, '🦊')
    assert.equal(moi.legendaire, null)
    assert.equal(moi.titre, null)
    assert.equal(moi.fond, null)

    // L'entrée d'une soirée : l'anonyme qui forge un emoji de collection ou
    // une clé de légendaire repart avec l'avatar par défaut, ou quatre
    // lettres — jamais un médaillon ni une distinction.
    const entrer = async (name: string, avatar: string, cookie?: string) => {
      const s = connecter(banc.url, cookie)
      await emitAck(s, 'party:watch', { slug: ADMIN.slug })
      const res = await emitAck<any>(s, 'player:join', { slug: ADMIN.slug, name, avatar, legendaire: 'lg:phenix', niveau: 30, laurier: true })
      assert.ok(res.ok, res.error)
      return { s, res }
    }
    const bob = await entrer('Bob', '🐝')
    assert.equal(bob.res.avatar, DEFAULT_AVATAR)
    const eve = await entrer('Ève', 'lg:phenix')
    const aliceEnSoiree = await entrer('Alice', '🪐', alice)
    assert.equal(aliceEnSoiree.res.avatar, '🦊', 'le profil garde son avatar : le 17 n’est pas à lui')
    const salle = await instantane(bob.s, s => s.players.length === 3, 'les trois')
    for (const p of salle.players) {
      assert.ok(!('legendaire' in p) && !('laurier' in p), `${p.name} ne porte rien de forgé`)
      if (p.name !== 'Alice') assert.ok(!('niveau' in p) && !('finition' in p), `${p.name}, anonyme, n’affiche rien`)
    }
    console.log(`[contrôle] ${JSON.stringify(salle.players.map((p: any) => [p.name, p.avatar, p.niveau ?? null, p.finition ?? null]))} · Ève a tapé « lg:phenix » : ${eve.res.avatar}`)
    for (const x of [bob, eve, aliceEnSoiree]) x.s.close()
  } finally {
    await banc.close()
  }
})
