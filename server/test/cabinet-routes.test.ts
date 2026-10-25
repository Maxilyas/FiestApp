// Le Cabinet de curiosités par ses routes (`server/src/cabinet.ts`) : la page
// d'un profil, commencer en visite, en chasse ou en libre, un geste à son
// rang, la partie reprise après un redémarrage, celle d'hier close à la page
// du lendemain, et ce qu'efface la suppression d'un profil — avec des lignes,
// dans les trois tables du Cabinet. Le pli, les jeux et la règle des départs
// ont leurs épreuves pures (`cabinet-regles.test.ts`, `cabinet-jeux-base.test.ts`) ;
// deux serveurs sur la même base, `cabinet-charge.test.ts`.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { connexionAnimateur, ecrire, inscrireProfil } from './banc'
import {
  DIX_HEURES,
  bancDuCabinet,
  commencer,
  departEnBase,
  dossierDEssai,
  enBase,
  fermerLesMagasins,
  jouer,
  jouerUnPari,
  laPage,
  lire,
  magasinDEssai,
  ok,
  pariDe,
  unPariParfait,
  type BancDuCabinet,
} from './cabinet-banc'
import type { PariTire } from '../../shared/cabinet/jeux/pari'
import { jourDe } from '../../shared/jour'
import { saison } from '../../shared/saisons'
import { TIREURS } from '../src/core/cabinet/tirages/index'
import { CABINET_SANS_PROFIL } from '../src/cabinet'
import { DEMANDE_ILLISIBLE } from '../src/core/cabinet/magasin'
import { JEUX_PRETS } from '../../shared/cabinet/ouverture'
import { CASES_DE_LA_VISITE, CHASSES_PAR_JOUR, DEPARTS_PAR_HEURE, ECLAIRAGES_PAR_PARTIE, ETOILES_DU_PARI, LIBRES_QUI_PAIENT, POUSSIERE_MIN, POUSSIERE_PAR_ETOILE } from '../../shared/cabinet/bareme'
import { JEUX } from '../../shared/cabinet/jeux/regle'
import { forceDite } from '../../shared/cabinet/pouvoirs'
import { GARDIENS, SALLES } from '../../shared/cabinet/salles'
import { OEUVRES } from '../../shared/cabinet/oeuvres'
import type { VueDeLaPartie } from '../../shared/cabinet/vues'

let b: BancDuCabinet
before(async () => {
  b = await bancDuCabinet()
})
after(() => b?.banc.close())
after(fermerLesMagasins)

const idDe = async (cookie: string) => (await lire(b, cookie, '/api/joueur/moi?leger')).corps.profile.id as string
const compter = (sql: string, ...args: unknown[]) => enBase(b.fichier, db => (db.prepare(sql).get(...args) as { n: number }).n)

test('les jeux livrés ont chacun leur tireur, et rien d’autre n’en a', () => {
  assert.deepEqual([...JEUX_PRETS].sort(), Object.keys(TIREURS).sort())
})

test('la page du Cabinet : un profil seulement, et ce que son musée montre, jamais gardée', async () => {
  const anonyme = await laPage(b, undefined)
  assert.equal(anonyme.status, 401)
  assert.deepEqual(anonyme.corps, { error: CABINET_SANS_PROFIL })
  assert.equal(anonyme.entetes.get('cache-control'), 'no-store')

  const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
  const page = ok(await laPage(b, lea), 'la page')
  assert.equal(page.maintenant, b.horloge.t, 'l’heure du serveur, que la page mesure')
  assert.equal(page.prechargee, undefined, 'demandée par la page, elle n’est pas préchargée')
  assert.deepEqual(
    page.salles.map(s => s.cle),
    SALLES.map(s => s.cle),
  )
  assert.equal(page.salles.flatMap(s => s.oeuvres).length, OEUVRES.length)
  assert.equal(page.salles.flatMap(s => s.oeuvres).filter(o => o.possedee).length, 4, 'les quatre œuvres de départ')
  assert.equal(page.gardiens.tous.length, GARDIENS.length)
  assert.ok(page.gardiens.tous.every(g => !g.reveille))
  assert.equal(page.visite.cases.length, Math.min(CASES_DE_LA_VISITE, JEUX_PRETS.length), 'trois jeux différents, toujours : moins de jeux livrés, moins de cases')
  assert.ok(page.visite.cases.every(c => JEUX_PRETS.includes(c.jeu) && !c.faite))
  assert.deepEqual(page.chasses, { restent: CHASSES_PAR_JOUR, parJour: CHASSES_PAR_JOUR })
  assert.deepEqual(page.libres, { paientEncore: LIBRES_QUI_PAIENT, parJour: LIBRES_QUI_PAIENT })
  assert.equal(page.poussiere, 0)
  assert.equal(page.enCours, null)
  assert.equal(page.expedition, null)
  assert.deepEqual(page.jeux, [...JEUX_PRETS])

  // Préchargée avec la page servie — sans l'en-tête de la page —, elle le dit : son heure se mesure sur le préchargement.
  const prechargee = ok(await laPage(b, lea, { prechargee: true }), 'la page préchargée')
  assert.equal(prechargee.prechargee, true)
  assert.equal((await laPage(b, lea)).entetes.get('cache-control'), 'no-store')
})

test('commencer en visite, en chasse, en libre : une partie à la fois, la case et la chasse prises au départ', async () => {
  const tom = await inscrireProfil(b.banc.url, 'tom', 'Tom')
  const { visite } = ok(await laPage(b, tom), 'la page')
  const visiteur = ok(await commencer(b, tom, { origine: 'visite', case: 0, carte: null }), 'la visite')
  assert.equal(visiteur.jeu, visite.cases[0].jeu)
  assert.equal(visiteur.origine, 'visite')
  assert.equal(visiteur.phase, 'jouer', 'la première manche s’ouvre avec le départ')
  assert.equal(visiteur.rang, 2)
  assert.ok(visiteur.chrono && visiteur.chrono.echeance > b.horloge.t, 'son chrono part avec la réponse')
  assert.deepEqual(visiteur.enJeu, visite.cases[0].enJeu)

  // Une partie à la fois : la seconde se refuse en mots, sans rien consommer.
  const seconde = await commencer(b, tom, { origine: 'libre', jeu: 'pari', carte: null })
  assert.equal(seconde.status, 400)
  assert.deepEqual(seconde.corps, { error: `Ta partie ${JEUX[visiteur.jeu].a} t’attend : reprends-la ou quitte-la d’abord` })

  // Quitter compte : la case est consommée, même sans une étoile — et rapporte sa poussière d'or.
  const quittee = ok(await jouer(b, tom, visiteur, { quoi: 'quitter' }), 'quitter')
  assert.equal(quittee.phase, 'finie')
  assert.equal(quittee.bilan?.quittee, true)
  assert.equal(quittee.bilan?.poussiere, POUSSIERE_MIN)
  assert.deepEqual(await commencer(b, tom, { origine: 'visite', case: 0, carte: null }).then(r => [r.status, r.corps]), [400, { error: 'Cette partie de la visite est déjà faite' }])

  // Une chasse, au jeu de son œuvre ; une libre.
  const chasse = ok(await commencer(b, tom, { origine: 'chasse', oeuvre: 'lecon', carte: null }), 'la chasse')
  assert.equal(chasse.jeu, 'pari', 'la Leçon se trouve au Pari')
  ok(await jouer(b, tom, chasse, { quoi: 'quitter' }), 'quitter la chasse')
  const libre = ok(await commencer(b, tom, { origine: 'libre', jeu: 'eclair', carte: null }), 'la libre')
  assert.equal(libre.enJeu, null)
  ok(await jouer(b, tom, libre, { quoi: 'quitter' }), 'quitter la libre')

  const page = ok(await laPage(b, tom), 'la page')
  assert.equal(page.visite.cases[0].faite, true)
  assert.equal(page.visite.cases[0].issue, 'manquee')
  assert.equal(page.chasses.restent, CHASSES_PAR_JOUR - 1)
  assert.equal(page.libres.paientEncore, LIBRES_QUI_PAIENT - 1)
  assert.equal(page.poussiere, POUSSIERE_MIN * 2, 'la visite et la chasse, quatre au moins chacune ; la libre à zéro étoile, rien')
  assert.equal(page.enCours, null)
  assert.equal(compter("SELECT COUNT(*) AS n FROM campagne_series WHERE mode = 'cabinet'"), 3)
})

test('un geste à son rang : un double toucher ne joue pas deux fois, la partie d’un autre est introuvable', async () => {
  const ines = await inscrireProfil(b.banc.url, 'ines', 'Inès')
  const autre = await inscrireProfil(b.banc.url, 'noe', 'Noé')
  const partie = ok(await commencer(b, ines, { origine: 'libre', jeu: 'pari', carte: null }), 'commencer')
  const q1 = pariDe(b, partie.id, 0).q1
  const geste = { quoi: 'repondre', manche: 0, reponse: { pari: { choix: q1.bonne } } }
  const juste = ok(await jouer(b, ines, partie, geste), 'la réponse')
  assert.equal(juste.rang, 3)
  assert.equal(juste.phase, 'jouer', 'juste au premier coup : il garde ou il parie')
  assert.equal(juste.chrono, undefined, 'et aucun chrono ne court entre les deux')

  // Le même geste, au même rang : la réponse perdue puis rejouée, l'autre onglet.
  const double = await jouer(b, ines, partie, geste)
  assert.equal(double.status, 409)
  assert.equal((double.corps as unknown as { error: string }).error, 'Ce geste est passé : ta partie a continué sans lui')
  assert.equal((double.corps as unknown as { partie: VueDeLaPartie }).partie.rang, 3, 'avec la vue d’à présent, que la page reprend')
  assert.equal(compter('SELECT COUNT(*) AS n FROM cabinet_gestes WHERE serie_id = ?', partie.id), 2)

  // Celle d'un autre profil : introuvable, comme une partie qui n'existe pas (invariant 3).
  for (const [qui, id] of [
    [autre, partie.id],
    [ines, 'nulle-part'],
  ] as const) {
    const r = await jouer(b, qui, { id, rang: 3 }, { quoi: 'garder', manche: 0 })
    assert.deepEqual([r.status, r.corps], [404, { error: 'Cette partie est introuvable' }])
  }
  // Un geste illisible, un geste que le pli refuse : 400, en mots, et rien d'écrit.
  assert.deepEqual(await jouer(b, ines, juste, { quoi: 'clore', pourquoi: 'lendemain' }).then(r => [r.status, r.corps]), [400, { error: 'Ce geste ne se lit pas : recharge la page' }])
  assert.deepEqual(await jouer(b, ines, juste, { quoi: 'eclairer', manche: 0 }).then(r => [r.status, r.corps]), [400, { error: 'Tu n’as emporté aucune carte-bonus' }])
  assert.equal(compter('SELECT COUNT(*) AS n FROM cabinet_gestes WHERE serie_id = ?', partie.id), 2)

  // Finie, elle le dit, avec la vue de sa fin.
  const fin = ok(await jouer(b, ines, juste, { quoi: 'quitter' }), 'quitter')
  const apres = await jouer(b, ines, fin, { quoi: 'quitter' })
  assert.equal(apres.status, 409)
  assert.equal((apres.corps as unknown as { error: string }).error, 'Cette partie est finie')
})

test('la carte-bonus emportée : son pouvoir, sa force, ce qu’elle fait à ce jeu et ce qu’il en reste', async () => {
  const zoe = await inscrireProfil(b.banc.url, 'zoe', 'Zoé')
  const partie = ok(await commencer(b, zoe, { origine: 'libre', jeu: 'pari', carte: 'coup-d-oeil' }), 'commencer avec le Coup d’œil')
  assert.deepEqual(partie.carte, {
    cle: 'coup-d-oeil',
    pouvoir: 'eclairer',
    force: 1,
    reste: ECLAIRAGES_PAR_PARTIE[1],
    dit: `Éclairer : ${JEUX.pari.eclairer} — ${forceDite('eclairer', 1)}`,
  })
  assert.deepEqual(partie.pouvoir, { jouable: true })
  const eclairee = ok(await jouer(b, zoe, partie, { quoi: 'eclairer', manche: 0 }), 'éclairer')
  assert.equal(eclairee.carte?.reste, 0)
  assert.equal(eclairee.pouvoir?.jouable, false)
  // Une carte-bonus qu'il n'a pas : refusée en mots, au départ.
  ok(await jouer(b, zoe, eclairee, { quoi: 'quitter' }), 'quitter')
  assert.deepEqual(await commencer(b, zoe, { origine: 'libre', jeu: 'pari', carte: 'lecon' }).then(r => [r.status, r.corps]), [400, { error: 'Tu n’as pas cette carte-bonus' }])
})

test('recharger reprend la même manche, même après un redémarrage : son chrono a couru, son échéance n’a pas bougé', async () => {
  const max = await inscrireProfil(b.banc.url, 'max', 'Max')
  const partie = ok(await commencer(b, max, { origine: 'libre', jeu: 'eclair', carte: null }), 'commencer')
  b.horloge.t += 4_000
  const avant = ok(await laPage(b, max), 'la page').enCours
  assert.equal(avant?.id, partie.id)
  assert.equal(avant?.chrono?.echeance, partie.chrono?.echeance)
  await b.banc.redemarrer()
  const apres = ok(await laPage(b, max), 'la page après le redémarrage').enCours
  assert.ok(apres)
  assert.deepEqual(
    { id: apres.id, rang: apres.rang, manche: apres.manche, phase: apres.phase, echeance: apres.chrono?.echeance, enCours: apres.enCours },
    { id: avant!.id, rang: avant!.rang, manche: avant!.manche, phase: avant!.phase, echeance: avant!.chrono?.echeance, enCours: avant!.enCours },
  )
  ok(await jouer(b, max, apres, { quoi: 'quitter' }), 'quitter')
})

test('la visite d’un profil qui n’a pas encore joué reste la même d’un redémarrage à l’autre : sa graine est faite d’un secret gardé en base', async () => {
  const profils = await Promise.all(['ana', 'bea', 'cle'].map(l => inscrireProfil(b.banc.url, l, l.toUpperCase())))
  const visites = async () => Promise.all(profils.map(async c => ok(await laPage(b, c), 'la page').visite))
  const avant = await visites()
  await b.banc.redemarrer()
  assert.deepEqual(await visites(), avant)
  await b.banc.redemarrer({ disqueEfface: true })
  assert.deepEqual(await visites(), avant, 'la base locale effacée n’y change rien')
})

test('la suppression d’un profil efface ses gestes, son Cabinet et ses œuvres, avant ses séries', async () => {
  const leo = await inscrireProfil(b.banc.url, 'leo', 'Léo')
  const id = await idDe(leo)
  // Une chasse gagnée : la Leçon entre au musée, dorée — une ligne dans chacune des trois tables.
  const chasse = ok(await commencer(b, leo, { origine: 'chasse', oeuvre: 'lecon', carte: null }), 'la chasse')
  const fin = await unPariParfait(b, leo, chasse)
  assert.equal(fin.bilan?.issue, 'gagnee-doree')
  assert.equal(fin.bilan?.oeuvre, 'lecon')
  const series = enBase(b.fichier, db => (db.prepare('SELECT id FROM campagne_series WHERE profile_id = ?').all(id) as { id: string }[]).map(r => r.id))
  const lignes = () => ({
    gestes: series.reduce((n, s) => n + compter('SELECT COUNT(*) AS n FROM cabinet_gestes WHERE serie_id = ?', s), 0),
    profils: compter('SELECT COUNT(*) AS n FROM cabinet_profils WHERE profile_id = ?', id),
    oeuvres: compter('SELECT COUNT(*) AS n FROM cabinet_oeuvres WHERE profile_id = ?', id),
    series: compter('SELECT COUNT(*) AS n FROM campagne_series WHERE profile_id = ?', id),
  })
  const avant = lignes()
  assert.ok(avant.gestes > 0 && avant.profils === 1 && avant.oeuvres === 1 && avant.series === 1, JSON.stringify(avant))

  const admin = await connexionAnimateur(b.banc.url)
  const r = await ecrire(b.banc.url, `/api/admin/profils/${id}`, undefined, admin, 'DELETE')
  assert.equal(r.status, 200, await r.text())
  assert.deepEqual(lignes(), { gestes: 0, profils: 0, oeuvres: 0, series: 0 })
})

test('trente départs, puis un toutes les deux minutes : le plafond se dit en mots', async () => {
  const vif = await inscrireProfil(b.banc.url, 'vif', 'Vif')
  // Chaque demande compte, lisible ou non : le plafond se prend avant de rien lire. Chacune dit pourquoi elle se
  // refuse — un plafond tombé plus tôt les refuserait toutes en 400 aussi, avec ses mots à lui.
  for (let i = 0; i < DEPARTS_PAR_HEURE - 1; i++) {
    const r = await commencer(b, vif, { origine: 'nulle-part' })
    assert.deepEqual([r.status, r.corps], [400, { error: DEMANDE_ILLISIBLE }], `la demande ${i + 1}`)
  }
  // La trentième, un vrai départ, passe.
  const trentieme = ok(await commencer(b, vif, { origine: 'libre', jeu: 'pari', carte: null }), 'la trentième')
  ok(await jouer(b, vif, trentieme, { quoi: 'quitter' }), 'quitter')
  const refus = await commencer(b, vif, { origine: 'libre', jeu: 'pari', carte: null })
  assert.deepEqual([refus.status, refus.corps], [400, { error: 'Tu joues vite : souffle une minute, puis reprends' }])
})

test('la partie d’hier se clôt à la première page du jour : comme un « Quitter », rangée au jour de son départ', async () => {
  const hier = await bancDuCabinet()
  try {
    const sam = await inscrireProfil(hier.banc.url, 'sam', 'Sam')
    const partie = ok(await commencer(hier, sam, { origine: 'visite', case: 0, carte: null }), 'la visite')
    const jour = departEnBase(hier.fichier, partie.id).jour
    hier.horloge.t += 24 * 3_600_000
    const page = ok(await laPage(hier, sam), 'la page du lendemain')
    assert.equal(page.enCours, null)
    const ligne = enBase(hier.fichier, db => db.prepare('SELECT finie_le, bilan FROM campagne_series WHERE id = ?').get(partie.id) as { finie_le: number; bilan: string })
    assert.equal(ligne.finie_le, hier.horloge.t)
    assert.equal(JSON.parse(ligne.bilan).lendemain, true)
    const dernier = enBase(hier.fichier, db => db.prepare('SELECT geste FROM cabinet_gestes WHERE serie_id = ? ORDER BY rang DESC LIMIT 1').get(partie.id) as { geste: string })
    assert.deepEqual(JSON.parse(dernier.geste), { quoi: 'clore', pourquoi: 'lendemain' })
    assert.equal(page.poussiere, POUSSIERE_MIN, 'sa poussière d’or, comptée')
    assert.ok(page.visite.jour > jour, 'la visite d’un jour neuf')
    assert.ok(page.visite.cases.every(c => !c.faite), 'hier ne prend rien à aujourd’hui')
    // Relue, rien ne se clôt deux fois.
    ok(await laPage(hier, sam), 'la page relue')
    assert.equal(enBase(hier.fichier, db => (db.prepare('SELECT COUNT(*) AS n FROM cabinet_gestes WHERE serie_id = ?').get(partie.id) as { n: number }).n), 2)
  } finally {
    await hier.banc.close()
  }
})

test('l’œuvre gagnée d’une partie close le lendemain prend la fête du jour de son départ, jamais celle de sa clôture', async () => {
  // Une chasse à la Leçon, rare : deux manches parfaites au Pari font ses six étoiles, puis plus rien. La page du
  // lendemain la clôt, gagnée : sa saison se lit au jour de son départ, comme sa case et sa poussière — une partie de la
  // veille d'Halloween n'en est pas, une partie de son dernier jour l'est encore.
  const veille = jourDe(DIX_HEURES)
  const lendemain = jourDe(DIX_HEURES + 24 * 3_600_000)
  const halloween = saison('halloween')!
  for (const [fete, attendue] of [
    [veille, 'halloween'],
    [lendemain, null],
  ] as const) {
    const horloge = { t: DIX_HEURES }
    const calendrier = { periodeDu: (jour: string) => (jour === fete ? { saison: halloween, debut: jour, fin: jour } : null) }
    const m = await magasinDEssai(path.join(dossierDEssai(), 'fete.db'), horloge, undefined, { calendrier })
    let p = await m.cabinet.commencer('qui', { origine: 'chasse', oeuvre: 'lecon', carte: null })
    for (let k = 0; k < 2; k++) {
      const t = departEnBase(m.fichier, p.id).tirages[k] as PariTire
      const gestes = [
        ...(k > 0 ? [{ quoi: 'ouvrir', manche: k }] : []),
        { quoi: 'repondre', manche: k, reponse: { pari: { choix: t.q1.bonne } } },
        { quoi: 'parier', manche: k },
        { quoi: 'repondre', manche: k, reponse: { pari: { choix: t.q2.bonne } } },
      ]
      for (const geste of gestes) {
        const r = await m.cabinet.geste('qui', p.id, p.etat.rang, geste)
        assert.ok('partie' in r, JSON.stringify(r))
        p = r.partie
      }
    }
    horloge.t += 24 * 3_600_000
    await m.cabinet.page('qui')
    const oeuvre = enBase(m.fichier, db => db.prepare("SELECT origine, saison FROM cabinet_oeuvres WHERE profile_id = 'qui' AND oeuvre = 'lecon'").get())
    assert.deepEqual(oeuvre, { origine: 'partie', saison: attendue }, `la fête le ${fete}`)
  }
})

test('une partie libre au Pari, juste au premier coup et gardée : ses étoiles, une pièce, sa poussière', async () => {
  // Deux étoiles gardées depuis le calibrage du 25 octobre 2026 (`ETOILES_DU_PARI`) ; une libre payée en rapporte
  // deux poussières chacune (`POUSSIERE_PAR_ETOILE`).
  assert.equal(ETOILES_DU_PARI.garder, 2)
  const eva = await inscrireProfil(b.banc.url, 'eva', 'Éva')
  let v = ok(await commencer(b, eva, { origine: 'libre', jeu: 'pari', carte: null }), 'commencer')
  v = await jouerUnPari(b, eva, v, 0, 'garder')
  assert.equal(v.phase, 'revele')
  assert.equal(v.manches[0].etoiles, ETOILES_DU_PARI.garder)
  assert.equal(v.revelation?.manche, 0)
  assert.equal(v.revelation?.fin, 'jugee')
  assert.equal(v.revelation?.signalables.length, 1, 'la question de la base se signale')
  v = ok(await jouer(b, eva, v, { quoi: 'quitter' }), 'quitter')
  assert.equal(v.bilan?.total, ETOILES_DU_PARI.garder)
  assert.equal(v.bilan?.issue, 'libre')
  assert.equal(v.bilan?.poussiere, ETOILES_DU_PARI.garder * POUSSIERE_PAR_ETOILE)
  assert.equal(v.bilan?.poussiere, 4)
  assert.ok(v.manches[0].revelation, '« Mes réponses » : chaque manche tranchée révélée, la partie finie')
})
