// Audit securite-portes — ce qu'une session d'animateur peut faire de plus
// que ce qu'on lui a confié.
//
// Deux portes d'entrée sont volontairement « faibles » : la télé branchée par
// un code (une soirée, pas un mois — « souvent celle de quelqu'un d'autre »,
// auth/appairage.ts) et la console ouverte par le cookie d'un profil (un an,
// « un téléphone se prête en soirée », profileRoutes.ts). Le code en tient
// compte : le mot de passe du compte ne se change qu'en donnant l'actuel
// (routes.ts, /api/auth/password), celui du profil aussi, et la télé ne
// dépasse jamais 24 heures (invariant 16).
//
// Ces épreuves échouent sur le code d'aujourd'hui (b57035c) et passeront le
// jour où la correction sera faite.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/securite-portes/sessions.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@libsql/client'
import {
  ADMIN,
  connexionAnimateur,
  cookieDe,
  demarrer,
  ecrire,
  inscrireProfil,
  type Banc,
} from '../../../server/test/banc'
import { TELE_BRANCHEE_MS } from '../../../server/src/auth/appairage'

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

const moi = async (banc: Banc, cookie: string) => fetch(`${banc.url}/api/auth/me`, { headers: { Cookie: cookie } })

/** Une télé branchée par la console `cookie` : le cookie de la télé. */
async function brancherTele(banc: Banc, cookie: string): Promise<string> {
  const demande = await ecrire(banc.url, '/api/auth/appairage', {})
  assert.equal(demande.status, 200)
  const { code, jeton } = (await demande.json()) as { code: string; jeton: string }
  assert.equal((await ecrire(banc.url, '/api/auth/appairage/valider', { code }, cookie)).status, 200, 'la console valide le code')
  const recue = await ecrire(banc.url, '/api/auth/appairage/attente', { jeton })
  return cookieDe(recue)
}

test('une télé branchée par l’administrateur ne se fabrique pas un lien d’activation pour son compte', () =>
  avecBanc(async banc => {
    // Antoine anime chez des amis : il branche LEUR télé depuis son téléphone.
    const telephone = await connexionAnimateur(banc.url)
    const { account } = (await (await moi(banc, telephone)).json()) as { account: { id: string } }
    const tele = await brancherTele(banc, telephone)

    // Le lendemain, quelqu'un allume la télé : elle est encore ouverte (24 h),
    // et c'est une session d'administrateur. « Lien », sur sa propre ligne.
    const lien = await ecrire(banc.url, `/api/admin/accounts/${account.id}/activation`, {}, tele)
    const refuse = lien.status >= 400
    if (!refuse) {
      // Ce qu'il en fait : un mot de passe à lui, et tout le monde dehors.
      const { activation } = (await lien.json()) as { activation: { token: string } }
      const active = await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: 'pris-par-la-tele' })
      assert.equal(active.status, 200, 'le lien sert : le mot de passe est changé sans connaître l’ancien')
      const telephoneApres = (await moi(banc, telephone)).status
      const ancien = (await ecrire(banc.url, '/api/auth/login', { login: ADMIN.login, password: ADMIN.password })).status
      const nouveau = (await ecrire(banc.url, '/api/auth/login', { login: ADMIN.login, password: 'pris-par-la-tele' })).status
      console.log(
        `  lien d'activation pour soi : ${lien.status} · activation : ${active.status} · ` +
          `console d'Antoine ensuite : ${telephoneApres} · ancien mot de passe : ${ancien} · nouveau : ${nouveau}`,
      )
    }
    assert.ok(refuse, `une session d’administrateur ne remet pas à zéro le mot de passe de son propre compte (reçu ${lien.status})`)
    assert.equal((await moi(banc, telephone)).status, 200, 'la console d’Antoine reste ouverte')
  }))

test('une console ouverte par le cookie d’un profil (un an) ne change pas non plus le mot de passe du compte', () =>
  avecBanc(async banc => {
    // L'administrateur a rattaché son profil à son espace (« une seule porte »).
    const compte = await connexionAnimateur(banc.url)
    const profil = await inscrireProfil(banc.url, 'antoine-joue', 'Antoine')
    assert.equal((await ecrire(banc.url, '/api/space/profil', { login: 'antoine-joue', password: 'motdepasse1' }, compte)).status, 200)
    const { account } = (await (await moi(banc, compte)).json()) as { account: { id: string } }

    // Le téléphone est prêté en soirée : son cookie de joueur ouvre la
    // console sans rien redemander (`/api/joueur/console`)…
    const ouverture = await ecrire(banc.url, '/api/joueur/console', {}, profil)
    assert.equal(ouverture.status, 200)
    const console_ = cookieDe(ouverture)
    // … et le mot de passe du compte ne se change pas sans l'actuel :
    const direct = await ecrire(banc.url, '/api/auth/password', { current: 'je-ne-sais-pas', next: 'pris-au-vol-1' }, console_)
    assert.equal(direct.status, 400, 'la porte « Mon compte » demande bien le mot de passe actuel')
    // … mais le lien d'activation, lui, ne demande rien.
    const lien = await ecrire(banc.url, `/api/admin/accounts/${account.id}/activation`, {}, console_)
    console.log(`  /api/auth/password sans l'actuel : ${direct.status} · lien d'activation pour soi : ${lien.status}`)
    assert.ok(lien.status >= 400, `le lien d’activation n’est pas un contournement de « Mon compte » (reçu ${lien.status})`)
  }))

test('une télé branchée par une télé : la chaîne ne dépasse pas la soirée de la première (invariant 16)', async () => {
  const vrai = Date.now
  const t0 = vrai()
  let decalage = 0
  Date.now = () => vrai() + decalage
  try {
    await avecBanc(async banc => {
      const telephone = await connexionAnimateur(banc.url)
      const tele1 = await brancherTele(banc, telephone)

      // Vingt-trois heures plus tard, depuis la télé encore ouverte, on
      // « branche » un autre appareil — celui de qui se sert de la télé.
      decalage = 23 * 3600_000
      assert.equal((await moi(banc, tele1)).status, 200, 'la télé tient encore')
      const tele2 = await brancherTele(banc, tele1)

      // Vingt-cinq heures après le branchement d'Antoine : la première télé
      // est tombée, comme promis…
      decalage = 25 * 3600_000
      assert.equal((await moi(banc, tele1)).status, 401, 'la télé d’Antoine ne tient qu’une soirée')
      const encore = (await moi(banc, tele2)).status

      const base = createClient({ url: banc.quizDbUrl })
      const lignes = await base.execute('SELECT fin_max FROM auth_sessions WHERE fin_max IS NOT NULL ORDER BY fin_max')
      base.close()
      const fins = lignes.rows.map(r => Math.round((Number(r.fin_max) - t0) / 3600_000))
      console.log(`  fin_max des sessions branchées, en heures après le branchement d'Antoine : ${fins.join(', ')} · seconde télé à t0+25 h : ${encore}`)
      // … mais la seconde, branchée par la première, court jusqu'à t0 + 47 h,
      // et peut en brancher une troisième avant de tomber.
      assert.equal(encore, 401, 'ce qu’une télé branche ne survit pas à la soirée de la télé qui l’a branché')
      assert.ok(fins.every(h => h <= TELE_BRANCHEE_MS / 3600_000 + 1), `aucune session branchée au-delà de t0 + 24 h (${fins.join(', ')} h)`)
    })
  } finally {
    Date.now = vrai
  }
})

test('une télé branchée ne rattache pas à l’espace le profil de qui s’en sert — sinon la console lui reste, après la soirée', async () => {
  const vrai = Date.now
  let decalage = 0
  Date.now = () => vrai() + decalage
  try {
    await avecBanc(async banc => {
      // Un animateur ordinaire (pas l'administrateur) : Bruno.
      const admin = await connexionAnimateur(banc.url)
      const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'bruno', name: 'Bruno', slug: 'chez-bruno' }, admin)
      const { activation } = (await cree.json()) as { activation: { token: string } }
      const bruno = cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: 'bruno-secret-1' }))
      const tele = await brancherTele(banc, bruno)

      // Qui s'assoit devant la télé a son propre profil de joueur…
      const intrus = await inscrireProfil(banc.url, 'intrus', 'Intrus')
      // … et la télé « prouve » l'espace : le rattachement passe.
      const lien = await ecrire(banc.url, '/api/space/profil', { login: 'intrus', password: 'motdepasse1' }, tele)

      // Deux jours plus tard, la télé est tombée depuis longtemps.
      decalage = 48 * 3600_000
      assert.equal((await moi(banc, tele)).status, 401, 'la télé ne tient qu’une soirée')
      const console_ = await ecrire(banc.url, '/api/joueur/console', {}, intrus)
      const espace = console_.status === 200 ? ((await console_.json()) as { espace: { slug: string } }).espace.slug : null
      console.log(`  rattachement depuis la télé : ${lien.status} · console de l'intrus à t0+48 h : ${console_.status} (${espace ?? '—'})`)
      assert.ok(lien.status >= 400, `une télé branchée ne pose pas de rattachement (reçu ${lien.status})`)
      assert.notEqual(console_.status, 200, 'l’intrus n’ouvre pas la console de Bruno avec son propre profil')
    })
  } finally {
    Date.now = vrai
  }
})
