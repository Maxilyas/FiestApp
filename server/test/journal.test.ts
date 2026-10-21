// Le journal des gestes de l'administrateur (`/admin#journal`, le choix du
// 13 octobre 2026 : « Oui, dans le QG ») : tout ce qui change quelque chose
// sous `/api/admin` s'y note de lui-même, avec une phrase qui nomme ce qu'il
// a touché — et un refus jamais.
//
// La liste des routes se lit dans le routeur, comme `admin-seulement.test.ts` :
// une route de plus qui change quelque chose y entre d'elle-même, et ce test
// rougit tant qu'elle n'a pas été jouée ici avec sa phrase.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createECDH, createHash, randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import express from 'express'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, creerQuiz, demarrer, ecrire, inscrireProfil, invite, qcm, type Banc } from './banc'
import { EN_PLAN_MS, GESTES_PAR_PAGE, gestesParJour, type DirectDuQg, type GesteDuQg, type JournalDuQg } from '../../shared/qg'
import { CATEGORIES } from '../../shared/categories'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { toPlayable } from '../../shared/library'
import type { PageDesErreurs } from '../../shared/triDesErreurs'
import { JournalDesGestes, journaliser, noterLeGeste } from '../src/core/journalDesGestes'

// L'application Express du serveur, attrapée à sa première requête.
let application: { _router: { stack: Couche[] } } | null = null
const traiter = (express as any).application.handle
;(express as any).application.handle = function (this: any, ...args: unknown[]) {
  application ??= this
  return traiter.apply(this, args)
}
interface Couche {
  route?: { path: string | string[]; methods: Record<string, boolean> }
}

const H = 3_600_000
const lire = <T = any>(banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as T }))
const faire = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}, methode = 'POST') =>
  ecrire(banc.url, chemin, corps, cookie, methode).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Les gestes tels que la base les garde, route comprise : la réponse de l'API ne la dit pas. */
function notes(banc: Banc): { route: string; sorte: string; resume: string; cible: string | null }[] {
  const base = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
  try {
    return base.prepare('SELECT route, sorte, resume, cible FROM qg_gestes ORDER BY quand, rowid').all() as any[]
  } finally {
    base.close()
  }
}

test('chaque route de l’administration qui change quelque chose se note avec sa phrase — lue dans le routeur', async () => {
  const horloge = { decalage: 0 }
  const banc = await demarrer({
    baseDeLaCampagne: baseDEssai(40),
    horlogeDuJour: () => Date.now() + horloge.decalage,
    // Le téléphone des alertes du QG pousse vers la machine, où rien ne l'attend.
    rappels: { servicesDePush: url => url.hostname === '127.0.0.1' },
  })
  try {
    const admin = await connexionAnimateur(banc.url)
    const ok = (r: { status: number; corps: any }, quoi: string) => assert.ok(r.status < 300, `${quoi} : ${r.status} ${r.corps?.error ?? ''}`)

    // Les espaces : en créer un, lui donner son lien, le renommer, le fermer, le rouvrir.
    const nadia = await faire(banc, admin, '/api/admin/accounts', { login: 'nadia', name: 'Nadia', slug: 'chez-nadia' })
    ok(nadia, 'créer')
    const idNadia = nadia.corps.account.id as string
    ok(await faire(banc, admin, `/api/admin/accounts/${idNadia}/activation`), 'activation')
    ok(await faire(banc, admin, `/api/admin/accounts/${idNadia}`, { name: 'Nadia B.', slug: 'chez-nadia-b' }, 'PUT'), 'renommer')
    ok(await faire(banc, admin, `/api/admin/accounts/${idNadia}/disable`), 'désactiver')
    ok(await faire(banc, admin, `/api/admin/accounts/${idNadia}/enable`), 'réactiver')
    // …le rattacher à un profil, en supprimer un autre une fois fermé.
    await inscrireProfil(banc.url, 'nadiab', 'Nadia', '🦋')
    ok(await faire(banc, admin, `/api/admin/espaces/${idNadia}/titulaire`, { login: 'nadiab' }), 'rattacher')
    const bob = await faire(banc, admin, '/api/admin/accounts', { login: 'bob', name: 'Bob', slug: 'chez-bob' })
    ok(bob, 'créer bob')
    ok(await faire(banc, admin, `/api/admin/accounts/${bob.corps.account.id}/disable`), 'désactiver bob')
    ok(await faire(banc, admin, `/api/admin/accounts/${bob.corps.account.id}?credits=reprendre`, undefined, 'DELETE'), 'supprimer bob')

    // Un profil supprimé.
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🦉')
    const idTom = (await lire(banc, tom, '/api/joueur/moi')).corps.profile.id as string
    ok(await faire(banc, admin, `/api/admin/profils/${idTom}`, undefined, 'DELETE'), 'supprimer tom')

    // Le catalogue : une copie proposée, publiée.
    const quiz = await creerQuiz(banc.url, admin, [qcm('Quelle est la capitale du Canada ?', ['Ottawa', 'Toronto'])], 'Les capitales')
    const propose = await faire(banc, admin, `/api/quizzes/${quiz}/catalogue`, { description: 'Pour réviser' })
    ok(propose, 'proposer')
    ok(await faire(banc, admin, `/api/admin/catalogue/${propose.corps.id}`, { statut: 'publie' }), 'publier')

    // Le quiz du jour : Léa le commence, son tirage existe.
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const idLea = (await lire(banc, lea, '/api/joueur/moi')).corps.profile.id as string
    ok(await faire(banc, lea, '/api/jour/commencer'), 'commencer')
    const jour = (await lire(banc, admin, '/api/admin/jour')).corps.aujourdhui as string
    ok(await faire(banc, admin, '/api/admin/jour/liste', { texte: 'Quel fleuve traverse Lyon et Avignon ?\n*Le Rhône\nLa Loire\nLa Garonne' }), 'liste')
    ok(await faire(banc, admin, '/api/admin/jour/garder', { jour, index: 0 }), 'garder')
    ok(await faire(banc, admin, '/api/admin/jour/annuler', { jour, index: 1 }), 'annuler')
    // La page des signalements : corriger une question du jour — son anecdote —, en reclasser une autre.
    const { duJour, categorie } = (() => {
      const base = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
      try {
        const tirees = JSON.parse((base.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(jour) as { questions: string }).questions) as { reserveId: string }[]
        const reserve = (id: string) => base.prepare('SELECT question, categorie FROM jour_reserve WHERE id = ?').get(id) as { question: string; categorie: string | null }
        return { duJour: toPlayable({ ...JSON.parse(reserve(tirees[2].reserveId).question), id: tirees[2].reserveId }), categorie: reserve(tirees[3].reserveId).categorie }
      } finally {
        base.close()
      }
    })()
    assert.ok(duJour && duJour.kind === 'choice')
    const correctionDuJour = { texte: duJour.text, reponses: duJour.answers, bonne: duJour.correct, anecdote: 'Une anecdote reprise au QG.' }
    ok(await faire(banc, admin, '/api/admin/jour/corriger', { jour, index: 2, correction: correctionDuJour }), 'corriger au quiz du jour')
    ok(await faire(banc, admin, '/api/admin/jour/reclasser', { jour, index: 3, classement: { categorie: CATEGORIES.find(c => c !== categorie) } }), 'reclasser au quiz du jour')
    const prochaines = (await lire<{ id: string }[]>(banc, admin, '/api/admin/jour/prochaines')).corps
    ok(await faire(banc, admin, '/api/admin/jour/retirer', { reserveId: prochaines[0].id }), 'retirer du jour')
    ok(await faire(banc, admin, '/api/admin/jour/masquer', { profileId: idLea, masque: true }), 'masquer')

    // Les duels : Ana défie Max et finit son duel — il part à Max, qui ne le commence pas ; le QG l'annule.
    const ana = await inscrireProfil(banc.url, 'ana', 'Ana', '🐸')
    const max = await inscrireProfil(banc.url, 'max', 'Max', '🐻')
    const idMax = (await lire(banc, max, '/api/joueur/moi')).corps.profile.id as string
    const lance = await faire(banc, ana, '/api/campagne/duel', { categories: ['Histoire'], adversaire: idMax })
    ok(lance, 'lancer un duel')
    const posees = (() => {
      const base = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
      try {
        return JSON.parse((base.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(lance.corps.serie.id) as { questions: string }).questions) as { bonne: number; reponses: string[] }[]
      } finally {
        base.close()
      }
    })()
    for (let i = 0, finie = false; !finie; i++) {
      const r = await faire(banc, ana, `/api/campagne/serie/${lance.corps.serie.id}/reponse`, { index: i, choix: (posees[i].bonne + 1) % posees[i].reponses.length })
      ok(r, 'répondre au duel')
      finie = Boolean(r.corps.finie)
    }
    ok(await faire(banc, admin, `/api/admin/duels/${lance.corps.code}/annuler`), 'annuler un duel')

    // La fiche de Léa : des confettis, un code de secours neuf, sa connexion
    // rouverte, son épreuve de sentier libérée, suspendue puis réactivée, et
    // son prénom changé en dernier — les phrases d'avant la nomment encore Léa.
    ok(await faire(banc, admin, `/api/admin/profils/${idLea}/confettis`, { confettis: 100, mot: 'Merci pour samedi !' }), 'confettis')
    ok(await faire(banc, admin, `/api/admin/profils/${idLea}/eclat`), 'éclat offert')
    ok(await faire(banc, admin, `/api/admin/profils/${idLea}/secours`), 'code de secours')
    for (let i = 0; i < 5; i++) await ecrire(banc.url, '/api/joueur/connexion', { login: 'lea', password: 'pas-le-bon-1' })
    ok(await faire(banc, admin, `/api/admin/profils/${idLea}/connexion`), 'verrou')
    ok(await faire(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'mythes', palier: 1 }), 'épreuve')
    ok(await faire(banc, admin, `/api/admin/profils/${idLea}/epreuve`), 'libérer l’épreuve')
    ok(await faire(banc, admin, `/api/admin/profils/${idLea}/suspendre`), 'suspendre')
    ok(await faire(banc, admin, `/api/admin/profils/${idLea}/reactiver`), 'réactiver')
    ok(await faire(banc, admin, `/api/admin/profils/${idLea}/prenom`, { nom: 'Léa B.' }), 'renommer')

    // Une soirée laissée en plan : un invité arrive, puis plus un geste pendant six heures.
    const zoe = await invite(banc.url, 'Zoé', '🐼')
    const enPlan = (await lire<DirectDuQg>(banc, admin, '/api/admin/qg/direct')).corps.soirees[0].spaceId
    horloge.decalage = EN_PLAN_MS + 60_000
    ok(await faire(banc, admin, `/api/admin/soirees/${enPlan}/clore`), 'clore la soirée en plan')
    zoe.socket.disconnect()

    // La maintenance : un bandeau affiché, changé, retiré ; une page fermée, puis rouverte.
    ok(await faire(banc, admin, '/api/admin/maintenance/bandeau', { texte: 'Le quiz du jour est en panne : on répare' }, 'PUT'), 'afficher le bandeau')
    ok(await faire(banc, admin, '/api/admin/maintenance/bandeau', { texte: 'Le quiz du jour revient ce soir' }, 'PUT'), 'changer le bandeau')
    ok(await faire(banc, admin, '/api/admin/maintenance/bandeau', { texte: null }, 'PUT'), 'retirer le bandeau')
    ok(await faire(banc, admin, '/api/admin/maintenance/pages/jour', { fermee: true }, 'PUT'), 'mettre en maintenance')
    ok(await faire(banc, admin, '/api/admin/maintenance/pages/jour', { fermee: false }, 'PUT'), 'rouvrir')
    // L'Expédition annoncée pour bientôt, Max pour la tester — puis retiré, et elle ouverte à tous.
    ok(await faire(banc, admin, '/api/admin/maintenance/pages/expedition', { etat: 'bientot' }, 'PUT'), 'annoncer pour bientôt')
    ok(await faire(banc, admin, `/api/admin/maintenance/pages/expedition/testeurs/${idMax}`, {}, 'PUT'), 'ajouter un testeur')
    ok(await faire(banc, admin, `/api/admin/maintenance/pages/expedition/testeurs/${idMax}`, {}, 'DELETE'), 'retirer un testeur')
    ok(await faire(banc, admin, '/api/admin/maintenance/pages/expedition', { etat: 'ouverte' }, 'PUT'), 'ouvrir à tous')
    // La panne réglée, une annonce à tous et ses confettis — puis retirée.
    ok(await faire(banc, admin, '/api/admin/annonces', { id: 'annonce-du-journal', message: 'Le quiz du jour remarche : merci de votre patience !', confettis: 20 }), 'annoncer à tous')
    ok(await faire(banc, admin, '/api/admin/annonces/annonce-du-journal', undefined, 'DELETE'), 'retirer l’annonce')
    // Les erreurs : une vraie, que la base refuse — un 500 ne se note pas —, réglée avec son mot ;
    // puis un téléphone prévenu des pannes, essayé — son service ne répond pas —, et retiré.
    const base = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    base.exec(`CREATE TRIGGER refus BEFORE INSERT ON profile_dons BEGIN SELECT RAISE(ABORT, 'quota'); END`)
    assert.equal((await faire(banc, admin, `/api/admin/profils/${idLea}/confettis`, { confettis: 5 })).status, 500)
    base.exec('DROP TRIGGER refus')
    base.close()
    const [erreur] = (await lire<PageDesErreurs>(banc, admin, '/api/admin/erreurs')).corps.erreurs
    ok(await faire(banc, admin, '/api/admin/erreurs/tri', { cle: erreur.cle, etat: 'reglee', note: 'PR #284' }), 'régler une erreur')
    const cles = createECDH('prime256v1')
    cles.generateKeys()
    const telephone = { endpoint: 'http://127.0.0.1:9/push/qg', keys: { p256dh: cles.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } }
    ok(await faire(banc, admin, '/api/admin/alertes/telephones', { abonnement: telephone }), 'prévenir un téléphone')
    ok(await faire(banc, admin, '/api/admin/alertes/essai'), 'essayer')
    ok(await faire(banc, admin, `/api/admin/alertes/telephones/${createHash('sha256').update(telephone.endpoint).digest('hex').slice(0, 16)}`, undefined, 'DELETE'), 'ne plus prévenir')

    // La campagne : régler le mélange d'un palier, puis garder, retirer, corriger.
    ok(await faire(banc, admin, '/api/admin/campagne/paliers/2/melange', { melange: { facile: 12, moyen: 4 } }), 'régler un mélange')
    ok(await faire(banc, admin, '/api/admin/campagne/garder', { questionId: 'essai001' }), 'garder en campagne')
    ok(await faire(banc, admin, '/api/admin/campagne/retirer', { questionId: 'essai002' }), 'retirer en campagne')
    ok(
      await faire(banc, admin, '/api/admin/campagne/reclasser', { questionId: 'essai004', classement: { categorie: 'Géographie', sousTheme: SOUS_THEMES['Géographie'][0].cle, difficulte: 2 } }),
      'reclasser en campagne',
    )
    const correction = { texte: 'Question d’essai numéro 3 : laquelle est la bonne ?', reponses: ['Bonne 3', 'Autre A3', 'Autre B3', 'Autre C3'], bonne: 0, anecdote: 'Une anecdote reprise.' }
    ok(await faire(banc, admin, '/api/admin/campagne/corriger', { questionId: 'essai003', correction }), 'corriger')

    // Chaque route de l'administration qui change quelque chose a été jouée, et s'est notée avec sa phrase.
    assert.ok(application, 'l’application a servi les requêtes')
    const routes = new Set(
      application._router.stack.flatMap(c => {
        const r = c.route
        if (!r || typeof r.path !== 'string' || !r.path.startsWith('/api/admin')) return []
        return Object.keys(r.methods)
          .filter(m => m !== 'get')
          .map(m => `${m.toUpperCase()} ${r.path}`)
      }),
    )
    // Pas une liste vide : les espaces, les profils et leur fiche, le catalogue, le quiz du jour, la campagne et les soirées y sont.
    assert.ok(routes.size >= 25, `${routes.size} routes trouvées`)
    const gestes = notes(banc)
    assert.deepEqual([...new Set(gestes.map(g => g.route))].sort(), [...routes].sort(), 'chaque route jouée, et rien d’autre')
    assert.deepEqual(
      gestes.filter(g => g.sorte === 'autre' || g.resume === g.route),
      [],
      'chaque geste a sa phrase',
    )

    // Les phrases nomment ce qu'elles touchent — sans jamais accorder au prénom :
    // elles parlent du profil, de l'espace, de la question.
    const resumes = gestes.map(g => g.resume)
    for (const attendu of [
      'Compte créé : Nadia (@nadia), à /chez-nadia',
      'Lien d’activation donné à Nadia (@nadia)',
      'Espace « Nadia » renommé « Nadia B. », adresse /chez-nadia → /chez-nadia-b',
      'Espace désactivé : Nadia B.',
      'Espace réactivé : Nadia B.',
      'Espace « Nadia B. » rattaché au profil de Nadia (@nadiab)',
      'Espace supprimé : Bob — ce que ses soirées avaient crédité est repris',
      'Profil supprimé : Tom (@tom)',
      'Copie publiée au catalogue : « Les capitales », d’Antoine',
      'Profil masqué du classement du quiz du jour : Léa (@lea)',
      'Liste collée au quiz du jour : 1 question ajoutée',
      'Soirée laissée en plan close : Antoine — rien n’avait été joué',
      '100 confettis offerts : Léa (@lea) — « Merci pour samedi ! »',
      'Éclat offert, en réserve : Léa (@lea)',
      'Code de secours neuf tiré : Léa (@lea)',
      'Verrou de connexion levé : Léa (@lea)',
      'Profil suspendu : Léa (@lea)',
      'Profil réactivé : Léa (@lea)',
      'Profil renommé : « Léa » devient « Léa B. » (@lea)',
      'Mélange du palier 2 des sentiers réglé : 14 faciles et 2 moyennes → 12 faciles et 4 moyennes',
      'Duel classé annulé avant d’être joué : Ana (@ana) → Max (@max)',
      'Bandeau affiché : « Le quiz du jour est en panne : on répare »',
      'Bandeau changé : « Le quiz du jour est en panne : on répare » devient « Le quiz du jour revient ce soir »',
      'Bandeau retiré : « Le quiz du jour revient ce soir »',
      'Page mise en maintenance : Le quiz du jour',
      'Page rouverte aux joueurs : Le quiz du jour',
      'Page bientôt disponible, pour ses testeurs : L’Expédition',
      'Testeur ajouté à « L’Expédition » : Max (@max)',
      'Testeur retiré de « L’Expédition » : Max (@max)',
      'Page ouverte à tous : L’Expédition',
      'Annonce retirée : « Le quiz du jour remarche : merci de votre patience ! » — ses confettis restent offerts',
      'Alertes de panne allumées sur un téléphone (un navigateur) — 1 téléphone prévenu',
      'Essai d’alerte : aucun téléphone n’a sonné (1 en échec)',
      'Alertes de panne coupées sur un téléphone — plus aucun téléphone prévenu',
    ]) {
      assert.ok(resumes.includes(attendu), `« ${attendu} » parmi :\n${resumes.join('\n')}`)
    }
    for (const attendu of [
      /^Question du jour gardée, ses signalements refermés : « .+ »$/,
      /^Question du jour annulée pour tous : « .+ »$/,
      /^Question retirée de la réserve du quiz du jour : « .+ »$/,
      /^Question de la campagne gardée, ses signalements refermés : « Question d.essai numéro 1 : laquelle est la bonne \? »$/,
      /^Question retirée de la campagne, pour tous : « Question d.essai numéro 2 : laquelle est la bonne \? »$/,
      /^Question de la campagne corrigée : « Question d.essai numéro 3 : laquelle est la bonne \? »$/,
      // L'anecdote seule : le jour qui l'a posée la prend aussi.
      /^Question du jour corrigée, le jour qui l’a posée compris : « .+ »$/,
      /^Question du jour reclassée, .+ → .+ : « .+ »$/,
      /^Question de la campagne reclassée, Histoire › .+ · difficulté 5 → Géographie › .+ · difficulté 2 : « Question d.essai numéro 4 : laquelle est la bonne \? »$/,
      /^Épreuve de sentier libérée, sans coûter de vie : Léa \(@lea\) — .+, palier 1$/,
      // À combien de profils : ceux du banc à cet instant, sans s'accorder à aucun prénom.
      /^Annonce à \d+ profils : « Le quiz du jour remarche : merci de votre patience ! » — 20 confettis chacun$/,
      // L'erreur se nomme par sa sorte, son message et sa route : la même, d'un geste à l'autre.
      /^Erreur réglée : \w+ — .*quota.* \(POST \/api\/admin\/profils\/:id\/confettis\) — « PR #284 »$/,
    ]) {
      assert.ok(resumes.some(r => attendu.test(r)), `${attendu} parmi :\n${resumes.join('\n')}`)
    }
    // Ce que visait un geste sur un joueur : son profil, pour la fiche qui relira les siens.
    assert.equal(gestes.find(g => g.resume.startsWith('Profil masqué'))?.cible, idLea)
    assert.equal(gestes.find(g => g.resume === 'Profil supprimé : Tom (@tom)')?.cible, idTom)
    assert.equal(gestes.find(g => g.resume.startsWith('Soirée laissée en plan'))?.cible, enPlan)
    assert.deepEqual(
      gestes.filter(g => g.sorte === 'maintenance').map(g => g.cible),
      [null, null, null, 'jour', 'jour', 'expedition', idMax, idMax, 'expedition'],
      'une page fermée vise sa page ; un testeur, son profil, pour sa fiche ; le bandeau, rien',
    )
    assert.deepEqual(
      gestes.filter(g => g.sorte === 'annonce').map(g => g.cible),
      ['annonce-du-journal', 'annonce-du-journal'],
      'une annonce, faite puis retirée, se vise elle-même',
    )
    assert.deepEqual(
      gestes.filter(g => g.sorte === 'erreur').map(g => g.cible),
      ['POST /api/admin/profils/:id/confettis', null, null, null],
      'une erreur vise sa source ; un téléphone, rien — son adresse ne s’écrit nulle part',
    )

    // La page le lit, du plus récent au plus ancien ; filtré par sorte.
    const journal = (await lire<JournalDuQg>(banc, admin, '/api/admin/gestes')).corps
    assert.equal(journal.gestes.length, gestes.length)
    assert.match(journal.gestes[0].resume, /^Question de la campagne corrigée/)
    assert.equal(journal.suite, null)
    const profils = (await lire<JournalDuQg>(banc, admin, '/api/admin/gestes?sorte=profil')).corps.gestes
    assert.deepEqual(
      profils.map(g => g.resume.replace(/ — [^—]+, palier 1$/, ' — …')),
      [
        'Profil renommé : « Léa » devient « Léa B. » (@lea)',
        'Profil réactivé : Léa (@lea)',
        'Profil suspendu : Léa (@lea)',
        'Épreuve de sentier libérée, sans coûter de vie : Léa (@lea) — …',
        'Verrou de connexion levé : Léa (@lea)',
        'Code de secours neuf tiré : Léa (@lea)',
        'Éclat offert, en réserve : Léa (@lea)',
        '100 confettis offerts : Léa (@lea) — « Merci pour samedi ! »',
        'Profil supprimé : Tom (@tom)',
      ],
    )
    // Ni la route, ni qui l'a fait : la page n'en a pas besoin.
    assert.deepEqual(Object.keys(journal.gestes[0]).sort(), ['cible', 'id', 'quand', 'resume', 'sorte'])
  } finally {
    await banc.close()
  }
})

test('un refus ne se note jamais, une lecture non plus', async () => {
  const banc = await demarrer()
  try {
    const admin = await connexionAnimateur(banc.url)
    assert.equal((await faire(banc, admin, '/api/admin/profils/inconnu', undefined, 'DELETE')).status, 404)
    const moi = (await lire<any[]>(banc, admin, '/api/admin/accounts')).corps.find(a => a.login === 'antoine')
    assert.equal((await faire(banc, admin, `/api/admin/accounts/${moi.id}/disable`)).status, 400)
    assert.equal((await faire(banc, admin, '/api/admin/catalogue/inconnu', { statut: 'publie' })).status, 404)
    assert.equal((await lire(banc, admin, '/api/admin/espaces')).status, 200)
    assert.deepEqual(notes(banc), [])
    assert.deepEqual((await lire<JournalDuQg>(banc, admin, '/api/admin/gestes')).corps, { gestes: [], suite: null })
  } finally {
    await banc.close()
  }
})

/** Un journal sur une base jetable, sans serveur : le magasin et sa capture seuls. */
async function journalJetable(maintenant: () => number) {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-journal-'))
  const url = `file:${path.join(dir, 'permanente.db').replace(/\\/g, '/')}`
  const journal = new JournalDesGestes(url, undefined, { maintenant })
  await journal.init()
  return { journal, url, fermer: () => rmSync(dir, { recursive: true, force: true }) }
}

test('une route qui oublie sa phrase se note quand même, par sa méthode et son chemin', async () => {
  // Chaque geste à son instant : deux du même instant se rangeraient au hasard de leur identifiant.
  let instant = Date.UTC(2026, 9, 13, 19)
  const { journal, fermer } = await journalJetable(() => instant++)
  const app = express()
  app.use((_req, res, next) => {
    res.locals.account = { id: 'espace-admin' }
    next()
  })
  app.use('/api/admin', journaliser(journal))
  app.post('/api/admin/sans-phrase/:id', (_req, res) => {
    res.json({ ok: true })
  })
  app.post('/api/admin/avec-phrase', (_req, res) => {
    noterLeGeste(res, { sorte: 'salon', resume: 'Un salon renommé', cible: 'x' })
    res.json({ ok: true })
  })
  app.post('/api/admin/refus', (_req, res) => {
    noterLeGeste(res, { sorte: 'salon', resume: 'Jamais noté' })
    res.status(400).json({ error: 'Non' })
  })
  const serveur = app.listen(0)
  try {
    const port = (serveur.address() as { port: number }).port
    for (const chemin of ['/api/admin/sans-phrase/42', '/api/admin/avec-phrase', '/api/admin/refus']) await fetch(`http://127.0.0.1:${port}${chemin}`, { method: 'POST' })
    // Le plus récent d'abord ; le refus n'y est pas.
    const { gestes } = await journal.lire()
    assert.deepEqual(
      gestes.map(g => [g.sorte, g.resume, g.cible]),
      [
        ['salon', 'Un salon renommé', 'x'],
        ['autre', 'POST /api/admin/sans-phrase/:id', null],
      ],
    )
  } finally {
    serveur.close()
    fermer()
  }
})

test('le journal se lit par pages, sans sauter ni doubler deux gestes du même instant', async () => {
  const horloge = { t: Date.UTC(2026, 9, 13, 19) }
  const { journal, fermer } = await journalJetable(() => horloge.t)
  try {
    // 120 gestes, trois par instant : une page coupe forcément au milieu d'un instant.
    for (let i = 0; i < 120; i++) {
      horloge.t = Date.UTC(2026, 9, 13, 19) + Math.floor(i / 3) * 1000
      journal.noter({ qui: 'admin', route: 'POST /api/admin/x', sorte: i % 2 ? 'profil' : 'salon', resume: `Geste ${i}` })
    }
    const lus: GesteDuQg[] = []
    let suite: string | null = null
    let pages = 0
    do {
      const page = await journal.lire({ suite })
      lus.push(...page.gestes)
      suite = page.suite
      pages++
    } while (suite && pages < 10)
    assert.deepEqual([pages, lus.length, new Set(lus.map(g => g.id)).size], [Math.ceil(120 / GESTES_PAR_PAGE), 120, 120])
    assert.ok(lus.every((g, i) => i === 0 || g.quand <= lus[i - 1].quand), 'du plus récent au plus ancien')
    assert.equal((await journal.lire({ sorte: 'profil' })).gestes.length, GESTES_PAR_PAGE)
    assert.ok((await journal.lire({ sorte: 'profil' })).gestes.every(g => g.sorte === 'profil'))
  } finally {
    fermer()
  }
})

test('les gestes se rangent par jour de Paris : aujourd’hui, hier, puis la date — l’année quand ce n’est pas celle-ci', () => {
  // Mardi 13 octobre 2026, 21 h à Paris.
  const maintenant = Date.UTC(2026, 9, 13, 19)
  const g = (id: string, quand: number): GesteDuQg => ({ id, quand, sorte: 'salon', resume: id, cible: null })
  const groupes = gestesParJour(
    [
      g('a', maintenant - H),
      // 0 h 30 à Paris : déjà aujourd'hui, encore hier au temps universel.
      g('b', Date.UTC(2026, 9, 12, 22, 30)),
      g('c', Date.UTC(2026, 9, 12, 21, 30)),
      g('d', Date.UTC(2026, 9, 1, 10)),
      g('e', Date.UTC(2025, 11, 31, 10)),
    ],
    maintenant,
  )
  assert.deepEqual(
    groupes.map(x => [x.titre, x.gestes.map(y => y.id).join('')]),
    [
      ['Aujourd’hui', 'ab'],
      ['Hier', 'c'],
      ['jeudi 1er octobre', 'd'],
      ['mercredi 31 décembre 2025', 'e'],
    ],
  )
})
