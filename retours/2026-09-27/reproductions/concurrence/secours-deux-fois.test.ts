// Le code de secours « se consomme » — mais deux demandes parties ensemble le
// consomment chacune.
//
// `useRecovery` lit le haché du code (en mémoire), le vérifie (scrypt, des
// dizaines de millisecondes), tire un code neuf, puis écrit. Deux demandes
// simultanées — deux onglets, un envoi rejoué — passent toutes deux la
// vérification et rendent chacune un code neuf ; seul celui écrit le
// dernier vaut. L'autre écran montre un code mort : « la seule porte de
// retour, faute d'adresse e-mail » est fermée sans qu'on le sache.
//
// Ce que ce test attend (il échoue aujourd'hui) : un code de secours ne sert
// qu'une fois — la seconde demande est refusée —, et le code neuf rendu marche.
//
// Lancer depuis `server/` :
//   nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/concurrence/secours-deux-fois.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { demarrer, ecrire } from '../../../server/test/banc'

test('un code de secours servi deux fois en même temps : une seule réussite, et un code neuf qui marche', async () => {
  const banc = await demarrer()
  try {
    const inscription = await ecrire(banc.url, '/api/joueur/inscription', {
      login: 'oublieuse',
      password: 'premier-mot-de-passe',
      name: 'Nina',
      avatar: '🦊',
    })
    const { recovery } = (await inscription.json()) as { recovery: string }
    assert.ok(recovery, 'l’inscription rend le code de secours')

    const [a, b] = await Promise.all(
      ['nouveau-mot-de-passe-a', 'nouveau-mot-de-passe-b'].map(async password => {
        const res = await ecrire(banc.url, '/api/joueur/secours', { login: 'oublieuse', code: recovery, password })
        return { status: res.status, corps: (await res.json()) as any }
      }),
    )
    console.log('deux demandes :', a.status, b.status)

    // Chaque code neuf rendu, essayé à son tour : un essai réussi le
    // consomme, alors on s'arrête au premier qui marche.
    const codesRendus = [a, b].filter(r => r.status === 200).map(r => r.corps.recovery as string)
    const valables: boolean[] = []
    for (const code of codesRendus) {
      const res = await ecrire(banc.url, '/api/joueur/secours', { login: 'oublieuse', code, password: 'encore-un-autre-mdp' })
      valables.push(res.status === 200)
      if (res.status === 200) break
    }
    console.log(`codes neufs rendus : ${codesRendus.length} ; valables, dans l’ordre : ${JSON.stringify(valables)}`)
    assert.deepEqual(
      { reussites: [a, b].filter(r => r.status === 200).length, codesMorts: valables.filter(v => !v).length },
      { reussites: 1, codesMorts: 0 },
      'le même code de secours a servi deux fois, et chaque écran montre un code neuf différent',
    )
  } finally {
    await banc.close()
  }
})
