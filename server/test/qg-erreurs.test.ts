// La page des erreurs du QG (`/admin#erreurs`, le souhait du propriétaire du
// 19 octobre 2026 : « je trouve que je ne peux pas très bien manager les
// erreurs que je vois ») : une erreur se trie — réglée, elle se tait et
// revient d'elle-même si une autre version la revoit ; ignorée, plus jamais —,
// et seules celles à regarder allument la vue d'ensemble. Et la panne d'un
// mode de jeu fait sonner le téléphone de l'administrateur, le même jour :
// une fois, puis à son retour, redémarrage compris (`core/veille.ts`,
// `core/alertes.ts`). Le téléphone est celui de `push.ts`, sur la machine.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, patienter, type Banc } from './banc'
import { abonnementDe, dechiffrer, serviceDePush } from './push'
import { veille } from '../src/core/veille'
import { lesChosesATraiter, type VueDEnsemble } from '../../shared/qg'
import { lireLeTri, type PageDesErreurs } from '../../shared/triDesErreurs'
import { alertesDuServeur, cleDeLErreur, type HeureDeSante } from '../../shared/santeDuServeur'
import { MESSAGE_D_ESSAI, TELEPHONES_PREVENUS_MAX } from '../../shared/pannes'

const MIN = 60_000
const H = 60 * MIN
const sansInsecables = (s: string) => s.replace(/[  ]/g, ' ')

const lire = <T = any>(banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as T }))
const faire = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}, methode = 'POST') =>
  ecrire(banc.url, chemin, corps, cookie, methode).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Les gestes de la sorte « Erreurs », tels que le journal les garde. */
function gestesDesErreurs(banc: Banc): string[] {
  const base = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
  try {
    return (base.prepare("SELECT resume FROM qg_gestes WHERE sorte = 'erreur' ORDER BY quand, rowid").all() as { resume: string }[]).map(g => g.resume)
  } finally {
    base.close()
  }
}

test('le tri d’une erreur relit ses versions : réglée sous l’une, elle reste réglée tant que la réparation n’est pas en ligne, et revient sous une autre', () => {
  const t = Date.UTC(2026, 9, 19, 19, 4)
  const reglee = { etat: 'reglee' as const, note: 'PR #284', depuis: t, versions: ['aaaaaaa'] }
  // Rien depuis : réglée.
  assert.deepEqual(lireLeTri([{ version: 'aaaaaaa', n: 4, derniere: t - H }], reglee), { etat: 'reglee', revenue: false, encoreSousLAncienne: false, note: 'PR #284', depuis: t })
  // Retombée sous la version qui l'avait vue : la réparation attend sa mise en ligne.
  assert.deepEqual(lireLeTri([{ version: 'aaaaaaa', n: 5, derniere: t + MIN }], reglee), { etat: 'reglee', revenue: false, encoreSousLAncienne: true, note: 'PR #284', depuis: t })
  // Sous la version d'après : la réparation n'a pas pris.
  assert.deepEqual(
    lireLeTri(
      [
        { version: 'bbbbbbb', n: 1, derniere: t + 2 * H },
        { version: 'aaaaaaa', n: 4, derniere: t - H },
      ],
      reglee,
    ),
    { etat: 'a-regarder', revenue: true, encoreSousLAncienne: false, note: 'PR #284', depuis: t },
  )
  // Hors de l'hébergeur, sans version : toute rechute la fait revenir. Une ignorée ne revient jamais.
  assert.equal(lireLeTri([{ version: null, n: 1, derniere: t + MIN }], { ...reglee, versions: [] }).revenue, true)
  assert.equal(lireLeTri([{ version: 'ccccccc', n: 9, derniere: t + H }], { ...reglee, etat: 'ignoree' }).etat, 'ignoree')

  // L'alerte de la vue d'ensemble ne compte que celles à regarder ; sans détail, elles comptent toujours.
  const erreur = { source: 'POST /api/jour/repondre', nom: 'TypeError', code: null, message: 'x is undefined', ou: null, pile: [] }
  const heure = Math.floor(t / H) * H
  const ligne = (n: number, derniere: number, sansDetail = 0): HeureDeSante => ({
    heure,
    demarrage: 'd',
    base: null,
    routes: null,
    lentes: [],
    erreurs: { 'POST /api/jour/repondre': n, ...(sansDetail > 0 && { 'socket host:launch': sansDetail }) },
    erreursEnDetail: [{ ...erreur, n, premiere: heure, derniere }],
    miroir: 0,
    charge: null,
    connexions: null,
    requetes: null,
  })
  const tri = new Map([[cleDeLErreur(erreur), reglee]])
  const alerte = (l: HeureDeSante, version: string | null) => alertesDuServeur({ recentes: [l], demarrages: [], memoireMo: null, maintenant: t + 3 * MIN, courant: 'd', version, tri }).erreurs
  assert.equal(alerte(ligne(4, t - MIN), 'aaaaaaa'), null, 'réglée, elle se tait')
  assert.equal(alerte(ligne(5, t + MIN), 'aaaaaaa'), null, 'retombée sous l’ancienne version, aussi')
  assert.deepEqual(alerte(ligne(5, t + MIN), 'bbbbbbb'), { n: 5, depuis: heure, source: 'POST /api/jour/repondre' }, 'sous une autre, elle sonne')
  assert.deepEqual(alerte(ligne(4, t - MIN, 2), 'aaaaaaa'), { n: 2, depuis: heure, source: 'socket host:launch' }, 'sans détail, rien ne se trie')
})

test('une erreur se trie au QG : réglée, elle se tait — revenue, elle sonne de nouveau ; ignorée, plus jamais ; et son tri survit au redémarrage', async () => {
  const banc = await demarrer()
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    let admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const idLea = (await lire(banc, lea, '/api/joueur/moi')).corps.profile.id as string
    // Une vraie erreur serveur : la base refuse le don.
    const uneErreur = async () => {
      db.exec(`CREATE TRIGGER refus BEFORE INSERT ON profile_dons BEGIN SELECT RAISE(ABORT, 'quota'); END`)
      try {
        assert.equal((await faire(banc, admin, `/api/admin/profils/${idLea}/confettis`, { confettis: 10 })).status, 500)
      } finally {
        db.exec('DROP TRIGGER refus')
      }
    }
    const erreurs = async () => (await lire<PageDesErreurs>(banc, admin, '/api/admin/erreurs')).corps
    const alerte = async () => (await lire<VueDEnsemble>(banc, admin, '/api/admin/qg')).corps.aTraiter.serveur.erreurs
    const trier = (cle: string, etat: string, note?: string) => faire(banc, admin, '/api/admin/erreurs/tri', { cle, etat, note })

    await uneErreur()
    const page = await erreurs()
    assert.equal(page.erreurs.length, 1)
    const [e] = page.erreurs
    assert.deepEqual([e.source, e.tri.etat], ['POST /api/admin/profils/:id/confettis', 'a-regarder'])
    assert.deepEqual(await alerte(), { n: 1, depuis: e.heures[0].heure, source: e.source })

    // Réglée, avec son mot — ses blancs resserrés : l'alerte se tait.
    const reglee = await trier(e.cle, 'reglee', '  PR   #284 ')
    assert.equal(reglee.status, 200, reglee.corps.error)
    assert.deepEqual([reglee.corps.erreurs[0].tri.etat, reglee.corps.erreurs[0].tri.note], ['reglee', 'PR #284'])
    assert.equal(await alerte(), null)
    // Le même geste refait ne change rien : refusé.
    assert.deepEqual([(await trier(e.cle, 'reglee', 'PR #284')).corps.error], ['Cette erreur est déjà réglée'])
    // Un autre mot, si : la note seule change.
    assert.equal((await trier(e.cle, 'reglee', 'PR #285')).status, 200)

    // Elle retombe. Le banc ne dit pas sa version : hors de l'hébergeur, toute rechute la fait revenir.
    await uneErreur()
    const revenue = (await erreurs()).erreurs[0]
    assert.deepEqual([revenue.tri.etat, revenue.tri.revenue, revenue.tri.note], ['a-regarder', true, 'PR #285'])
    // L'heure compte les siennes ensemble : celle d'avant le tri aussi.
    assert.equal((await alerte())?.n, 2)

    // Ignorée : plus rien ne sonne, même quand elle retombe.
    assert.equal((await trier(e.cle, 'ignoree', 'un hoquet de Turso')).status, 200)
    await uneErreur()
    assert.deepEqual([(await erreurs()).erreurs[0].tri.etat, await alerte()], ['ignoree', null])

    // Le tri se garde dans la base permanente : un redémarrage le relit — l'erreur aussi, que l'extinction propre a écrite.
    await banc.redemarrer()
    admin = await connexionAnimateur(banc.url)
    assert.deepEqual(db.prepare('SELECT etat, note FROM qg_erreurs WHERE cle = ?').get(e.cle), { etat: 'ignoree', note: 'un hoquet de Turso' })
    assert.deepEqual(
      (await erreurs()).erreurs.map(x => [x.cle, x.tri.etat]),
      [[e.cle, 'ignoree']],
    )

    // Remise à regarder : son tri s'efface.
    await uneErreur()
    assert.equal((await trier(e.cle, 'a-regarder')).status, 200)
    const remise = (await erreurs()).erreurs.find(x => x.cle === e.cle)!
    assert.deepEqual([remise.tri.etat, remise.tri.revenue, remise.tri.note], ['a-regarder', false, null])
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM qg_erreurs').get() as { n: number }).n, 0)
    // Les refus : déjà à regarder, une erreur hors de la semaine, un état qui n'existe pas.
    assert.deepEqual((await trier(e.cle, 'a-regarder')).corps.error, 'Cette erreur est déjà à regarder')
    assert.deepEqual([(await trier('GET /api/rien|TypeError|x', 'reglee')).status], [404])
    assert.deepEqual((await trier(e.cle, 'oubliee')).corps.error, 'Choisis : réglée, ignorée ou à regarder')

    // Chaque geste au journal, sous « Erreurs » : ce qu'elle devient, son mot.
    const phrases = gestesDesErreurs(banc)
    for (const attendu of [
      /^Erreur réglée : \w+ — .*quota.* \(POST \/api\/admin\/profils\/:id\/confettis\) — « PR #284 »$/,
      /^Note d’une erreur réglée : \w+ — .*quota.* — « PR #285 »$/,
      /^Erreur ignorée : \w+ — .*quota.* — « un hoquet de Turso »$/,
      /^Erreur remise à regarder : \w+ — .*quota.*$/,
    ]) {
      assert.ok(
        phrases.some(p => attendu.test(sansInsecables(p))),
        `${attendu} parmi :\n${phrases.join('\n')}`,
      )
    }
  } finally {
    db.close()
    await banc.close()
  }
})

test('la panne d’un mode sonne sur le téléphone de l’administrateur — une fois —, se garde au redémarrage, et son retour se dit', async () => {
  const push = await serviceDePush()
  const horloge = { decalage: 0 }
  const banc = await demarrer({
    rappels: { servicesDePush: url => url.hostname === '127.0.0.1' },
    // La veille parle tout de suite, et son heure avance à la main.
    veille: { groupementMs: 0, maintenant: () => Date.now() + horloge.decalage },
  })
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  /** Les messages reçus par le téléphone de l'administrateur, déchiffrés. */
  const tel = push.telephone('admin')
  const recus = () => push.recus.filter(r => r.nom === 'admin').map(r => dechiffrer(r.corps, tel))
  const attendre = async (n: number) => {
    for (let i = 0; i < 400 && recus().length < n; i++) await patienter(10)
    return recus()
  }
  try {
    let admin = await connexionAnimateur(banc.url)
    // Allumées sur ce téléphone : son empreinte, jamais son adresse.
    const allume = await faire(banc, admin, '/api/admin/alertes/telephones', { abonnement: abonnementDe(tel) })
    assert.equal(allume.status, 200, allume.corps.error)
    const empreinte = createHash('sha256').update(tel.endpoint).digest('hex').slice(0, 16)
    assert.deepEqual(
      allume.corps.telephones.map((t: { empreinte: string; service: string }) => [t.empreinte, t.service]),
      [[empreinte, 'un navigateur']],
    )
    assert.ok(!JSON.stringify(allume.corps).includes(tel.endpoint), 'l’adresse ne repart jamais')
    assert.equal(typeof allume.corps.cle, 'string')

    // Un essai : il sonne, et sa notification dit d'où elle vient.
    const essai = await faire(banc, admin, '/api/admin/alertes/essai')
    assert.deepEqual([essai.corps.envoyes, essai.corps.echecs], [1, 0])
    assert.deepEqual(await attendre(1), [MESSAGE_D_ESSAI])
    const entetes = push.recus.at(-1)!.entetes
    assert.deepEqual([entetes.topic, entetes.ttl], ['qg-essai', '3600'])

    // Le quiz du jour ne s'ouvre plus : la base refuse chaque partie qui commence.
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    db.exec(`CREATE TRIGGER panne BEFORE INSERT ON jour_parties BEGIN SELECT RAISE(ABORT, 'quota'); END`)
    // Un refus n'est pas une panne : sans profil, la porte répond 401, trois fois.
    for (let i = 0; i < 3; i++) assert.equal((await ecrire(banc.url, '/api/jour/commencer', {})).status, 401)
    assert.deepEqual(veille.pannes(), [])
    for (let i = 0; i < 3; i++) assert.equal((await faire(banc, lea, '/api/jour/commencer')).status, 500)
    const [, panne] = await attendre(2)
    assert.deepEqual(
      { ...panne, titre: sansInsecables(panne.titre), corps: sansInsecables(panne.corps) },
      {
        titre: 'Panne : le quiz du jour',
        corps: '3 échecs en dix minutes (POST /api/jour/commencer). Touche pour voir les erreurs.',
        url: '/admin#erreurs',
        tag: 'qg-panne',
      },
    )
    // Une seule : les échecs suivants ne la redisent pas.
    assert.equal((await faire(banc, lea, '/api/jour/commencer')).status, 500)
    await patienter(50)
    assert.equal(recus().length, 2)

    // Le QG la montre : en tête de « À traiter », et sur la page des erreurs.
    const vue = (await lire<VueDEnsemble>(banc, admin, '/api/admin/qg')).corps
    const [premiere] = lesChosesATraiter(vue.aTraiter, null, vue.maintenant)
    assert.deepEqual([premiere.cle, premiere.alerte, sansInsecables(premiere.titre), premiere.ecran], ['panne', true, 'Panne : le quiz du jour', 'erreurs'])
    assert.match(sansInsecables(premiere.detail), /^depuis \d+ h \d\d · 4 échecs, le dernier à \d+ h \d\d$/)
    assert.deepEqual(
      (await lire<PageDesErreurs>(banc, admin, '/api/admin/erreurs')).corps.pannes.map(p => [p.mode, p.echecs, p.source]),
      [['jour', 4, 'POST /api/jour/commencer']],
    )
    // Gardée dans la base : la mise en ligne de la réparation est un redémarrage.
    assert.deepEqual(
      db.prepare('SELECT mode, source FROM qg_pannes').all(),
      [{ mode: 'jour', source: 'POST /api/jour/commencer' }],
    )

    // Réparée, remise en ligne : le serveur neuf hérite de la panne, sans la resonner.
    db.exec('DROP TRIGGER panne')
    await banc.redemarrer()
    admin = await connexionAnimateur(banc.url)
    assert.deepEqual(
      (await lire<PageDesErreurs>(banc, admin, '/api/admin/erreurs')).corps.pannes.map(p => p.mode),
      ['jour'],
    )
    assert.equal(recus().length, 2)
    // Une partie commence ; un quart d'heure sans un échec, et la veille le dit.
    assert.equal((await faire(banc, lea, '/api/jour/commencer')).status, 200)
    horloge.decalage = 16 * MIN
    veille.examiner()
    const [, , retour] = await attendre(3)
    assert.deepEqual([sansInsecables(retour.titre), retour.tag, retour.url], ['Rétabli : le quiz du jour', 'qg-panne', '/admin#erreurs'])
    for (let i = 0; i < 100 && (db.prepare('SELECT COUNT(*) AS n FROM qg_pannes').get() as { n: number }).n > 0; i++) await patienter(10)
    assert.deepEqual(db.prepare('SELECT mode FROM qg_pannes').all(), [])
    assert.deepEqual((await lire<PageDesErreurs>(banc, admin, '/api/admin/erreurs')).corps.pannes, [])
  } finally {
    db.close()
    await banc.close()
    await push.fermer()
  }
})

test('les téléphones prévenus : cinq au plus, un désabonné s’oublie, un retiré ne sonne plus — et chaque geste au journal', async () => {
  const push = await serviceDePush()
  const banc = await demarrer({ rappels: { servicesDePush: url => url.hostname === '127.0.0.1' } })
  try {
    const admin = await connexionAnimateur(banc.url)
    // Sans téléphone, rien à essayer.
    assert.deepEqual((await faire(banc, admin, '/api/admin/alertes/essai')).corps.error, 'Aucun téléphone n’est prévenu : allume les alertes sur celui-ci d’abord')
    // Un service de push que le serveur ne connaît pas : refusé, le motif lisible.
    const inconnu = { ...abonnementDe(push.telephone('x')), endpoint: 'https://push.exemple.net/x' }
    assert.match((await faire(banc, admin, '/api/admin/alertes/telephones', { abonnement: inconnu })).corps.error, /service de notifications que FiestApp ne connaît pas/)

    const telephones = Array.from({ length: TELEPHONES_PREVENUS_MAX + 1 }, (_, i) => push.telephone(`t${i}`))
    for (const t of telephones) {
      assert.equal((await faire(banc, admin, '/api/admin/alertes/telephones', { abonnement: abonnementDe(t) })).status, 200)
      // Le plus récemment allumé passe devant : une milliseconde les sépare.
      await patienter(3)
    }
    const empreinte = (t: { endpoint: string }) => createHash('sha256').update(t.endpoint).digest('hex').slice(0, 16)
    let liste = (await lire(banc, admin, '/api/admin/alertes')).corps.telephones as { empreinte: string }[]
    assert.deepEqual(
      liste.map(t => t.empreinte),
      telephones.slice(1).reverse().map(empreinte),
      'le sixième a remplacé le plus ancien',
    )
    // Le même, renouvelé par son service : il remplace l'ancien, sans se compter deux fois.
    const renouvele = push.telephone('t1-neuf')
    assert.equal((await faire(banc, admin, '/api/admin/alertes/telephones', { abonnement: abonnementDe(renouvele), ancien: telephones[1].endpoint })).status, 200)
    liste = (await lire(banc, admin, '/api/admin/alertes')).corps.telephones
    assert.equal(liste.length, TELEPHONES_PREVENUS_MAX)
    assert.ok(!liste.some(t => t.empreinte === empreinte(telephones[1])) && liste[0].empreinte === empreinte(renouvele))

    // Un téléphone que son service dit désabonné s'oublie au premier envoi.
    push.morts.add('t2')
    const essai = await faire(banc, admin, '/api/admin/alertes/essai')
    assert.deepEqual([essai.corps.envoyes, essai.corps.retires, essai.corps.telephones.length], [TELEPHONES_PREVENUS_MAX - 1, 1, TELEPHONES_PREVENUS_MAX - 1])
    // Retiré d'ici : il ne sonne plus ; deux fois, il n'est déjà plus prévenu.
    const retire = await faire(banc, admin, `/api/admin/alertes/telephones/${empreinte(telephones[3])}`, undefined, 'DELETE')
    assert.equal(retire.corps.telephones.length, TELEPHONES_PREVENUS_MAX - 2)
    assert.equal((await faire(banc, admin, `/api/admin/alertes/telephones/${empreinte(telephones[3])}`, undefined, 'DELETE')).status, 404)
    assert.equal((await faire(banc, admin, '/api/admin/alertes/telephones/pas-une-empreinte', undefined, 'DELETE')).status, 404)

    const phrases = gestesDesErreurs(banc).map(sansInsecables)
    for (const attendu of [
      'Alertes de panne allumées sur un téléphone (un navigateur) — 1 téléphone prévenu',
      'Alertes de panne allumées sur un téléphone (un navigateur) — 5 téléphones prévenus',
      'Un téléphone a renouvelé ses alertes de panne (un navigateur)',
      'Essai d’alerte : 4 téléphones sonnés (1 oublié, désabonné)',
      'Alertes de panne coupées sur un téléphone — 3 téléphones prévenus',
    ]) {
      assert.ok(phrases.includes(attendu), `« ${attendu} » parmi :\n${phrases.join('\n')}`)
    }
  } finally {
    await banc.close()
    await push.fermer()
  }
})
