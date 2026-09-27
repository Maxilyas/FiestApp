// Contre-expertise de securite-portes-1 et -2 : la correction proposée
// (refuser les routes d'identité aux seules sessions à `fin_max`, les télés)
// suffit-elle ?
//
// Le code connaît un second porteur de session « faible » : le téléphone
// prêté, dont le cookie de profil ouvre la console sans rien redemander
// (`/api/joueur/console`). C'est lui que `/api/joueur/mot-de-passe` garde déjà
// (profileRoutes.ts:328 : « un téléphone se prête en soirée : … Le profil
// était perdu pour de bon — et avec lui la console de l'espace qu'il anime,
// celle de l'administrateur si c'est la sienne »). On rejoue ici, par les
// vraies routes et sans script, ce que l'emprunteur peut faire de plus : se
// rattacher l'espace. Aucune session de ce scénario n'a de `fin_max`.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/verification/securite/emprunteur.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@libsql/client'
import { connexionAnimateur, cookieDe, demarrer, ecrire, inscrireProfil } from '../../../../server/test/banc'

test('un téléphone prêté, profil de l’administrateur connecté : l’emprunteur se rattache l’espace, et le garde', async () => {
  const banc = await demarrer()
  try {
    // Antoine, administrateur, a rattaché son profil : « une seule porte ».
    const compte = await connexionAnimateur(banc.url)
    const antoine = await inscrireProfil(banc.url, 'antoine-joue', 'Antoine')
    assert.equal((await ecrire(banc.url, '/api/space/profil', { login: 'antoine-joue', password: 'motdepasse1' }, compte)).status, 200)
    // L'emprunteur a son profil à lui, fait sur son propre téléphone.
    const sienAilleurs = await inscrireProfil(banc.url, 'emprunteur', 'Emprunteur', '🐸', 'secret-emprunteur')

    // Sur le téléphone prêté : un clic sur « Animer » ouvre la console d'Antoine…
    const ouverture = await ecrire(banc.url, '/api/joueur/console', {}, antoine)
    assert.equal(ouverture.status, 200)
    const consolePretee = cookieDe(ouverture)
    // … et « Mon compte » → « Rattacher mon profil », avec SES identifiants.
    const lien = await ecrire(banc.url, '/api/space/profil', { login: 'emprunteur', password: 'secret-emprunteur' }, consolePretee)

    // Rendu le téléphone : Antoine ne rouvre plus sa console par son profil…
    const antoineApres = (await ecrire(banc.url, '/api/joueur/console', {}, antoine)).status
    // … l'emprunteur, chez lui, l'ouvre quand il veut — et c'est celle de l'administrateur.
    const chezLui = await ecrire(banc.url, '/api/joueur/console', {}, sienAilleurs)
    const adminChezLui = chezLui.status === 200 ? (await fetch(`${banc.url}/api/admin/accounts`, { headers: { Cookie: cookieDe(chezLui) } })).status : 0
    const base = createClient({ url: banc.quizDbUrl })
    const finMax = await base.execute('SELECT COUNT(*) AS n FROM auth_sessions WHERE fin_max IS NOT NULL')
    base.close()
    console.log(
      `  rattachement depuis la console prêtée : ${lien.status} · console d'Antoine par son profil ensuite : ${antoineApres} · ` +
        `console de l'emprunteur chez lui : ${chezLui.status} · /api/admin/accounts : ${adminChezLui} · sessions à fin_max : ${finMax.rows[0].n}`,
    )
    assert.equal(Number(finMax.rows[0].n), 0, 'aucune télé dans ce scénario : un garde sur fin_max ne le verrait pas')
    // Ce qu'on attend d'une correction complète : changer le profil qui tient
    // l'espace demande plus qu'une session — le mot de passe du compte, ou
    // celui du profil déjà rattaché (« prouver les deux identités »).
    assert.ok(lien.status >= 400, `une console ouverte par un profil ne rattache pas un autre profil sans preuve (reçu ${lien.status})`)
  } finally {
    await banc.close()
  }
})
