// Changer son mot de passe pour mettre un intrus dehors — pendant que
// l'intrus se connecte.
//
// La connexion vérifie le mot de passe (scrypt, des dizaines de
// millisecondes) contre le haché lu AVANT l'attente, puis ouvre une session.
// Le changement écrit le nouveau haché puis ferme les sessions qu'il
// CONNAÎT (`revokeAll` : celles en mémoire à cet instant). Une connexion
// partie avec l'ancien mot de passe juste avant le changement ouvre sa
// session juste après la fermeture : elle survit, trente jours.
//
// Ce que ce test attend (il échoue aujourd'hui) : après le changement, la
// session ouverte avec l'ancien mot de passe ne vaut plus rien.
//
// Lancer depuis `server/` :
//   nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/concurrence/intrus-pendant-le-changement.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cookieDe, demarrer, ecrire, inscrireProfil } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'

test('une connexion à l’ancien mot de passe, en vol pendant le changement, ne survit pas', async () => {
  const banc = await demarrer()
  const verify = ProfileStore.prototype.verify
  try {
    const proprietaire = await inscrireProfil(banc.url, 'nadia', 'Nadia', '🦊', 'ancien-mot-de-passe')

    // La vérification de l'intrus a lu l'ancien haché et calcule encore
    // (scrypt) pendant que Nadia change son mot de passe : on la retient
    // jusqu'à ce que le changement soit fini.
    let verifie!: () => void
    const intrusVerifie = new Promise<void>(r => (verifie = r))
    let relacher!: () => void
    const porte = new Promise<void>(r => (relacher = r))
    ProfileStore.prototype.verify = async function (this: ProfileStore, login: unknown, password: string, fallback: string) {
      const resultat = await verify.call(this, login, password, fallback)
      if (password === 'ancien-mot-de-passe' && login === 'nadia') {
        verifie()
        await porte
      }
      return resultat
    }
    const connexionDeLIntrus = ecrire(banc.url, '/api/joueur/connexion', { login: 'nadia', password: 'ancien-mot-de-passe' })
    await intrusVerifie

    const change = await ecrire(
      banc.url,
      '/api/joueur/mot-de-passe',
      { current: 'ancien-mot-de-passe', next: 'nouveau-mot-de-passe' },
      proprietaire,
    )
    assert.equal(change.status, 200, 'le changement de mot de passe')
    relacher()
    const intrus = await connexionDeLIntrus
    console.log('connexion de l’intrus :', intrus.status)

    const moi = intrus.ok ? await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookieDe(intrus, 'qz_joueur') } }) : null
    console.log('sa session après le changement :', moi?.status ?? '—')
    assert.notEqual(moi?.status, 200, 'la session ouverte avec l’ancien mot de passe survit au changement')
  } finally {
    ProfileStore.prototype.verify = verify
    await banc.close()
  }
})
