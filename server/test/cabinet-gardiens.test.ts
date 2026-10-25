// Les gardiens du Cabinet de curiosités : la réconciliation, puis ses routes.
// Ce que le musée doit — une salle complète son premier gardien, tous ses
// cadres dorés le second, les 84 œuvres le Trou noir, trente jours d'affilée
// le Scarabée (`gardiensDus`) — se compare à ce qui est rangé sur l'étagère,
// et seul ce qui manque se range, sous la clé fixe `#cabinet` : rien de dû et
// pas rangé, aucun aller-retour. À la fin d'une partie, à un achat, à une
// dorure, l'annonce : le gardien neuf en grand, celui qui veillait déjà sans
// cérémonie, la luciole à la première salle complète ; à la page froide, en
// silence. Un rangement raté se rattrape à la page suivante ; une œuvre de
// plus dans une salle complète n'endort pas son gardien ; jamais un Divin
// (invariant 21). Les saisons ont leur fichier (`cabinet-saisons.test.ts`) :
// elles rouvrent un calendrier que celui-ci garde fermé.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { inscrireProfil } from './banc'
import { aLaMain, bancDuCabinet, commencer, enBase, fermerLesMagasins, jouer, laPage, lire, ok, poster, unPariParfait, type BancDuCabinet } from './cabinet-banc'
import { JOURS_DU_SCARABEE, PRIX_D_UNE_DORURE, PRIX_D_UNE_OEUVRE } from '../../shared/cabinet/bareme'
import { OEUVRES, OEUVRES_DE_DEPART, oeuvresDeLaSalle, type CleDOeuvre } from '../../shared/cabinet/oeuvres'
import { GARDIENS, GARDIENS_DES_SALLES, GARDIENS_DU_CABINET, PREFIXE_DE_LA_VOIE_DU_CABINET, voieDuGardien } from '../../shared/cabinet/salles'
import { museeDe, type LigneDOeuvre } from '../../shared/cabinet/musee'
import type { PageDuCabinet, ReveilDesGardiens, VueDeLaPartie } from '../../shared/cabinet/vues'
import { LEGENDAIRES_DU_CABINET, PREFIXES_DES_VOIES_RANGEES, cleDuCabinet, legendaireDuCabinet } from '../../shared/legendaires'
import { DIVINS } from '../../shared/divins'
import { COMPAGNON_DE_L_EXPEDITION } from '../../shared/compagnons'
import { ProfileStore, RANGEMENT_DU_CABINET } from '../src/auth/profiles'
import { reconcilier, voiesQuiManquent, type EtagereDuCabinet } from '../src/core/cabinet/gardiens'

ProfileStore.tirageEclat = () => false

// ── La règle, sans serveur ────────────────────────────────────────────────

test('la voie du Cabinet : vingt gardiens, la même clé des deux côtés, une voie rangée comme les saisons', () => {
  // `shared/legendaires.ts` écrit sa liste sans lire les salles : l'album et l'accueil ne tirent pas le Cabinet.
  assert.deepEqual([...LEGENDAIRES_DU_CABINET].sort(), [...GARDIENS_DU_CABINET].sort())
  assert.equal(LEGENDAIRES_DU_CABINET.length, 20)
  for (const g of GARDIENS_DU_CABINET) {
    assert.equal(voieDuGardien(g), cleDuCabinet(g), g)
    assert.equal(legendaireDuCabinet(cleDuCabinet(g))?.key, g)
  }
  assert.ok((PREFIXES_DES_VOIES_RANGEES as readonly string[]).includes(PREFIXE_DE_LA_VOIE_DU_CABINET))
  // Ceux de saison n'ont pas de voie à eux : leur condition principale se range, `saison:halloween`.
  assert.equal(legendaireDuCabinet('cabinet:citrouille'), undefined)
  assert.equal(legendaireDuCabinet('cabinet:licorne'), undefined, 'un légendaire sans joker ne garde rien')
  assert.equal(legendaireDuCabinet('expedition:phenix'), undefined)
})

/** Une ligne d'œuvre écrite comme le lot froid la lit. */
const ligne = (oeuvre: string, o: Partial<LigneDOeuvre> = {}): LigneDOeuvre => ({
  oeuvre,
  origine: 'partie',
  gagneeLe: 0,
  saison: null,
  serieId: null,
  prix: null,
  doreeLe: null,
  dorure: null,
  prixDorure: null,
  serieDoree: null,
  ...o,
})

const pasDeDepart = (s: Parameters<typeof oeuvresDeLaSalle>[0]) => oeuvresDeLaSalle(s).filter(o => !OEUVRES_DE_DEPART.includes(o.cle))

/** Une étagère d'essai : ce qu'elle a rangé, et chaque appel compté. */
function etagereDEssai(dejaRangees: string[] = [], { panne = false, luciole = false } = {}) {
  const rangees = new Map(dejaRangees.map(k => [k, 1]))
  const appels: string[] = []
  const etagere: EtagereDuCabinet = {
    recompensesOf: () => rangees,
    async ranger(_p, sous, cles, quand) {
      appels.push(`ranger ${sous} ${cles.join(',')} ${quand}`)
      if (panne) throw new Error('la base ne répond pas')
      const neuves = cles.filter(k => !rangees.has(k))
      for (const k of neuves) rangees.set(k, 1)
      return neuves
    },
    legendairesOuverts: (_p, tombes) => tombes.map(k => legendaireDuCabinet(k)?.key ?? '').filter(Boolean),
    async offrirUnCompagnon(_p, cle) {
      appels.push(`offrir ${cle}`)
      return luciole
    },
  }
  return { etagere, appels, rangees }
}

test('la réconciliation : rien de dû et pas rangé, pas un aller-retour ; ce qui manque seulement, sous #cabinet', async () => {
  const rien = etagereDEssai()
  assert.deepEqual(await reconcilier(rien.etagere, 'p', museeDe({ jour: '2026-10-24', oeuvres: [ligne('plume')] }), 7), { reveil: null, echec: false })
  assert.deepEqual(rien.appels, [], 'un musée sans rien de dû ne touche ni l’étagère ni la niche')

  const rempart = pasDeDepart('rempart').map(o => ligne(o.cle))
  const musee = museeDe({ jour: '2026-10-24', oeuvres: rempart })
  const e = etagereDEssai([], { luciole: true })
  const r = await reconcilier(e.etagere, 'p', musee, 7)
  assert.deepEqual(r, { reveil: { gardiens: [{ legendaire: 'lg:phenix', neuf: true }], compagnon: COMPAGNON_DE_L_EXPEDITION }, echec: false })
  assert.deepEqual(e.appels, [`ranger ${RANGEMENT_DU_CABINET} cabinet:phenix 7`, `offrir ${COMPAGNON_DE_L_EXPEDITION}`])
  assert.equal(RANGEMENT_DU_CABINET, '#cabinet')

  // Rejouée — la page suivante, une autre fin —, elle ne range plus rien : la luciole se redemande, en mémoire.
  e.appels.length = 0
  assert.deepEqual(await reconcilier({ ...e.etagere, offrirUnCompagnon: async () => false }, 'p', musee, 8), { reveil: null, echec: false })
  assert.deepEqual(e.appels, [])
  assert.deepEqual(voiesQuiManquent([{ legendaire: 'lg:phenix', voie: 'cabinet:phenix' }], e.rangees), [])
})

test('la réconciliation : un gardien qui veillait déjà se range sans s’annoncer ; une panne se dit, et ne fait rien tomber', async () => {
  const musee = museeDe({ jour: '2026-10-24', oeuvres: pasDeDepart('rempart').map(o => ligne(o.cle)) })
  const deja = etagereDEssai()
  // Le Phénix est déjà à lui, par une autre voie : la ligne neuve ne l'ouvre pas.
  const r = await reconcilier({ ...deja.etagere, legendairesOuverts: () => [] }, 'p', musee, 7)
  assert.deepEqual(r.reveil?.gardiens, [{ legendaire: 'lg:phenix', neuf: false }])

  const enPanne = etagereDEssai([], { panne: true, luciole: true })
  const p = await reconcilier(enPanne.etagere, 'p', musee, 7)
  assert.equal(p.echec, true, 'la page suivante le refera')
  assert.deepEqual(p.reveil, { gardiens: [], compagnon: COMPAGNON_DE_L_EXPEDITION }, 'la luciole a sa propre écriture : elle passe quand même')
  // Sans étagère — un magasin d'essai, sans profils —, rien ne se range, rien ne casse.
  assert.deepEqual(await reconcilier({}, 'p', musee, 7), { reveil: null, echec: false })
})

test('les autres gardiens : tous les cadres dorés, les 84 œuvres, trente jours d’affilée — dans l’ordre des salles, jamais un Divin', async () => {
  const devin = oeuvresDeLaSalle('devin').map(o => ligne(o.cle, { doreeLe: 1, dorure: 'partie' }))
  const toutes = OEUVRES.filter(o => !OEUVRES_DE_DEPART.includes(o.cle)).map(o => ligne(o.cle))
  const e = etagereDEssai()
  const r = await reconcilier(
    e.etagere,
    'p',
    museeDe({
      jour: '2026-10-24',
      oeuvres: [...toutes.filter(l => !devin.some(d => d.oeuvre === l.oeuvre)), ...devin],
      profil: { poussiere: 0, serie: 1, serieJour: '2026-10-24', serieRecord: JOURS_DU_SCARABEE, visites: [], partie: null },
    }),
    7,
  )
  const attendus = [...Object.values(GARDIENS_DES_SALLES).map(([premier]) => premier), 'lg:oracle', 'lg:scarabee', 'lg:trou-noir']
  assert.deepEqual(new Set(r.reveil!.gardiens.map(g => g.legendaire)), new Set(attendus))
  assert.deepEqual(
    r.reveil!.gardiens.map(g => g.legendaire),
    GARDIENS.filter(g => attendus.includes(g)),
    'dans l’ordre des gardiens',
  )
  for (const g of r.reveil!.gardiens) assert.ok(!DIVINS.some(d => d.key === g.legendaire) && !g.legendaire.startsWith('dv:'), g.legendaire)
})

// ── Par les routes ────────────────────────────────────────────────────────

let b: BancDuCabinet
/** Les profils dont l'étagère a été écrite à la main avant le redémarrage : leur légendaire d'ailleurs, leur salle rouverte. */
let kim: { cookie: string; id: string }
let noe: { cookie: string; id: string }

const idDe = async (cookie: string) => (await lire(b, cookie, '/api/joueur/moi?leger')).corps.profile.id as string
const legendairesDe = async (cookie: string) => (await lire(b, cookie, '/api/joueur/moi?leger')).corps.profile.legendaires as string[]

/** Des œuvres posées en base, derrière le dos du serveur, avant la première page du Cabinet : le musée se lit à froid. */
const poserDesOeuvres = (profil: string, oeuvres: readonly string[], { doreesAussi = [] as readonly string[] } = {}) => {
  if (oeuvres.length === 0) return
  aLaMain(
    b.fichier,
    `INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le, doree_le, dorure) VALUES ${oeuvres
      .map(o => `('${profil}', '${o}', 'partie', 0, ${doreesAussi.includes(o) ? "0, 'partie'" : 'NULL, NULL'})`)
      .join(', ')}`,
  )
}
const donnerDeLaPoussiere = (profil: string, poussiere: number) =>
  aLaMain(b.fichier, `INSERT INTO cabinet_profils (profile_id, poussiere, cree_le, maj_le) VALUES ('${profil}', ${poussiere}, 0, 0) ON CONFLICT (profile_id) DO UPDATE SET poussiere = ${poussiere}`)

/** Ce que le Cabinet a rangé sur l'étagère de ce profil, et sous quoi. */
const rangeesDe = (profil: string) =>
  enBase(b.fichier, db => db.prepare(`SELECT badge, emoji, title FROM profile_badges WHERE profile_id = ? AND soiree_id = ? ORDER BY badge`).all(profil, RANGEMENT_DU_CABINET)) as {
    badge: string
    emoji: string
    title: string
  }[]
const aLaLuciole = (profil: string) => enBase(b.fichier, db => !!db.prepare(`SELECT 1 FROM profile_compagnons WHERE profile_id = ? AND compagnon = ?`).get(profil, COMPAGNON_DE_L_EXPEDITION))

/** Une joueuse neuve, ses œuvres posées à la main. */
async function joueuse(login: string, oeuvres: readonly string[] = [], o: { doreesAussi?: readonly string[]; poussiere?: number } = {}) {
  const cookie = await inscrireProfil(b.banc.url, login, login.toUpperCase())
  const id = await idDe(cookie)
  poserDesOeuvres(id, oeuvres, o)
  if (o.poussiere) donnerDeLaPoussiere(id, o.poussiere)
  return { cookie, id }
}

/** La salle du Rempart moins Pansement, une commune qui se trouve au Pari : la partie qui la gagne complète la salle. */
const REMPART_SANS_PANSEMENT = pasDeDepart('rempart')
  .map(o => o.cle)
  .filter(c => c !== 'pansement')

/** Une chasse à Pansement, gagnée sans faute au Pari : la vue de sa fin, son bilan. */
async function gagnerPansement(cookie: string): Promise<VueDeLaPartie> {
  const chasse = ok(await commencer(b, cookie, { origine: 'chasse', oeuvre: 'pansement', carte: null }), 'la chasse')
  const fin = await unPariParfait(b, cookie, chasse)
  assert.equal(fin.phase, 'finie')
  assert.ok(fin.bilan?.issue === 'gagnee' || fin.bilan?.issue === 'gagnee-doree', 'Pansement entre au musée')
  return fin
}

/** Rien d'un Divin, nulle part dans ce qu'une annonce dit (invariant 21). */
function sansDivin(quoi: unknown) {
  const texte = JSON.stringify(quoi)
  assert.ok(!texte.includes('dv:'), texte)
  for (const d of DIVINS) assert.ok(!texte.includes(d.nom), d.nom)
}

const gardienDeLaPage = (p: PageDuCabinet, cle: string) => p.gardiens.tous.find(g => g.legendaire === cle)!

before(async () => {
  b = await bancDuCabinet()
  // Kim a le Phénix d'ailleurs — un haut fait de soirée —, et la salle du Rempart moins une œuvre.
  kim = await joueuse('kim', REMPART_SANS_PANSEMENT)
  aLaMain(b.fichier, `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES ('${kim.id}', 'hf:phenix', 'une-soiree', '', '🔥', 'Le Phénix', 1)`)
  // Noé avait la salle du Rempart complète, et son gardien rangé ; une œuvre peinte de plus l'a rouverte — ce que
  // simule une ligne de moins : une œuvre ne se retire jamais d'un musée.
  noe = await joueuse('noe', REMPART_SANS_PANSEMENT)
  aLaMain(
    b.fichier,
    `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES ('${noe.id}', 'cabinet:phenix', '${RANGEMENT_DU_CABINET}', '', '🏛️', 'Le Cabinet : Le Phénix', 1)`,
  )
  // L'étagère se relit au réveil : ce qui a été écrit derrière son dos ne se voit qu'ensuite.
  await b.banc.redemarrer()
})
after(() => b?.banc.close())
after(fermerLesMagasins)

test('la salle complète en jouant réveille son gardien, sous #cabinet, annoncé en grand une fois — et la luciole avec', async () => {
  const lea = await joueuse('lea', REMPART_SANS_PANSEMENT)
  const avant = ok(await laPage(b, lea.cookie), 'la page')
  assert.equal(avant.salles.find(s => s.cle === 'rempart')!.complete, false)
  assert.equal(gardienDeLaPage(avant, 'lg:phenix').reveille, false)
  assert.equal(avant.reveil, undefined)

  const fin = await gagnerPansement(lea.cookie)
  assert.deepEqual(fin.bilan!.gardiens, [{ legendaire: 'lg:phenix', neuf: true }])
  assert.deepEqual(fin.bilan!.gains?.legendaires, ['lg:phenix'], 'en grand, avant les gains')
  assert.equal(fin.bilan!.gains?.compagnon, COMPAGNON_DE_L_EXPEDITION, 'la première salle complète amène la luciole')
  sansDivin(fin.bilan)

  assert.deepEqual(rangeesDe(lea.id), [{ badge: 'cabinet:phenix', emoji: '🏛️', title: 'Le Cabinet : Le Phénix' }])
  assert.ok((await legendairesDe(lea.cookie)).includes('lg:phenix'), 'le légendaire est à elle')
  assert.ok(aLaLuciole(lea.id))
  const apres = ok(await laPage(b, lea.cookie), 'la page d’après')
  assert.deepEqual(gardienDeLaPage(apres, 'lg:phenix'), { ...gardienDeLaPage(avant, 'lg:phenix'), reveille: true, voie: 'cabinet' })
  assert.equal(apres.salles.find(s => s.cle === 'rempart')!.complete, true)
  assert.equal(apres.reveil, undefined, 'une page lue n’annonce rien')

  // Annoncé une fois : la partie suivante ne le redit pas, et ne range rien de plus.
  const libre = ok(await commencer(b, lea.cookie, { origine: 'libre', jeu: 'pari', carte: null }), 'une partie libre')
  const quittee = ok(await jouer(b, lea.cookie, libre, { quoi: 'quitter' }), 'quitter')
  assert.equal(quittee.bilan!.gardiens, undefined)
  assert.equal(quittee.bilan!.gains?.legendaires, undefined)
  assert.equal(quittee.bilan!.gains?.compagnon, undefined)
  assert.equal(rangeesDe(lea.id).length, 1)
})

test('déjà à lui par une autre voie : la salle complète le range sans le réannoncer — « il veillait déjà »', async () => {
  assert.ok((await legendairesDe(kim.cookie)).includes('lg:phenix'), 'le Phénix d’une soirée')
  const avant = ok(await laPage(b, kim.cookie), 'la page')
  assert.equal(gardienDeLaPage(avant, 'lg:phenix').voie, 'ailleurs')
  const fin = await gagnerPansement(kim.cookie)
  assert.deepEqual(fin.bilan!.gardiens, [{ legendaire: 'lg:phenix', neuf: false }])
  assert.equal(fin.bilan!.gains?.legendaires, undefined, 'rien d’annoncé en grand')
  assert.deepEqual(
    rangeesDe(kim.id).map(r => r.badge),
    ['cabinet:phenix'],
    'sa voie se range quand même : le jour où la soirée qui le lui a donné s’efface, il veille encore',
  )
  assert.equal(gardienDeLaPage(ok(await laPage(b, kim.cookie), 'la page d’après'), 'lg:phenix').voie, 'cabinet')
})

test('tous les cadres d’une salle dorés à la poussière : son second gardien se réveille, et la dorure le dit', async () => {
  const devin = pasDeDepart('devin').map(o => o.cle)
  const aDorer = 'lucidite' as CleDOeuvre
  const dora = await joueuse('dora', devin, { doreesAussi: devin.filter(c => c !== aDorer), poussiere: PRIX_D_UNE_DORURE.commun })
  // La salle était déjà complète : la page froide range son premier gardien, en silence, et la luciole avec.
  const page = ok(await laPage(b, dora.cookie), 'la page')
  assert.equal(page.reveil, undefined)
  assert.equal(gardienDeLaPage(page, 'lg:sphinx').reveille, true)
  assert.ok(aLaLuciole(dora.id))
  assert.deepEqual(
    rangeesDe(dora.id).map(r => r.badge),
    ['cabinet:sphinx'],
  )

  const dore = await poster<PageDuCabinet>(b, dora.cookie, `/api/cabinet/oeuvre/${aDorer}/dorure`, { prix: PRIX_D_UNE_DORURE.commun })
  assert.equal(dore.status, 200, JSON.stringify(dore.corps))
  assert.deepEqual(dore.corps.reveil, { gardiens: [{ legendaire: 'lg:oracle', neuf: true }] } satisfies ReveilDesGardiens)
  assert.equal(gardienDeLaPage(dore.corps, 'lg:oracle').reveille, true)
  assert.deepEqual(
    rangeesDe(dora.id).map(r => r.badge),
    ['cabinet:oracle', 'cabinet:sphinx'],
  )
  // Rejouée — la réponse perdue en route —, la dorure ne paie pas deux fois, et n'annonce rien de plus.
  const rejouee = await poster<PageDuCabinet>(b, dora.cookie, `/api/cabinet/oeuvre/${aDorer}/dorure`, { prix: PRIX_D_UNE_DORURE.commun })
  assert.equal(rejouee.status, 200)
  assert.equal(rejouee.corps.reveil, undefined)
})

test('les 84 œuvres : l’achat de la dernière réveille la salle qu’elle complète et le Trou noir', async () => {
  const derniere = 'hantise' as CleDOeuvre
  const autres = OEUVRES.filter(o => !OEUVRES_DE_DEPART.includes(o.cle) && o.cle !== derniere).map(o => o.cle)
  const tom = await joueuse('tom', autres, { poussiere: PRIX_D_UNE_OEUVRE.epique })
  const page = ok(await laPage(b, tom.cookie), 'la page')
  // Huit salles complètes, réconciliées à froid : leurs gardiens veillent, sans cérémonie.
  assert.equal(page.reveil, undefined)
  const completes = page.salles.filter(s => s.complete).map(s => s.cle)
  assert.equal(completes.length, 8)
  for (const s of completes) assert.equal(gardienDeLaPage(page, GARDIENS_DES_SALLES[s][0]).reveille, true, s)
  assert.equal(gardienDeLaPage(page, 'lg:fantome').reveille, false, 'la salle du Sophiste attend Hantise')

  const achat = await poster<PageDuCabinet>(b, tom.cookie, `/api/cabinet/oeuvre/${derniere}/achat`, { prix: PRIX_D_UNE_OEUVRE.epique })
  assert.equal(achat.status, 200, JSON.stringify(achat.corps))
  assert.deepEqual(achat.corps.reveil, {
    gardiens: [
      { legendaire: 'lg:fantome', neuf: true },
      { legendaire: 'lg:trou-noir', neuf: true },
    ],
  })
  sansDivin(achat.corps.reveil)
  assert.equal(gardienDeLaPage(achat.corps, 'lg:trou-noir').reveille, true)
  assert.equal(achat.corps.salles.every(s => s.complete), true)
  assert.deepEqual(
    rangeesDe(tom.id).map(r => r.badge),
    [...Object.values(GARDIENS_DES_SALLES).map(([premier]) => cleDuCabinet(premier)), 'cabinet:trou-noir'].sort(),
  )
  assert.equal(ok(await laPage(b, tom.cookie), 'la page d’après').reveil, undefined, 'annoncé une fois')
})

test('trente jours de visite ou de chasse d’affilée : le Scarabée se réveille à la fin de la partie de ce jour-là', async () => {
  const sam = await joueuse('sam')
  aLaMain(
    b.fichier,
    `INSERT INTO cabinet_profils (profile_id, serie, serie_jour, serie_record, cree_le, maj_le) VALUES ('${sam.id}', ${JOURS_DU_SCARABEE - 1}, '2026-10-23', ${JOURS_DU_SCARABEE - 1}, 0, 0)`,
  )
  // La série compte au départ : la partie quittée aussitôt la tient.
  const chasse = ok(await commencer(b, sam.cookie, { origine: 'chasse', oeuvre: 'lecon', carte: null }), 'la chasse du trentième jour')
  const fin = ok(await jouer(b, sam.cookie, chasse, { quoi: 'quitter' }), 'quitter')
  assert.deepEqual(fin.bilan!.gardiens, [{ legendaire: 'lg:scarabee', neuf: true }])
  assert.deepEqual(fin.bilan!.gains?.legendaires, ['lg:scarabee'])
  assert.equal(fin.bilan!.gains?.compagnon, undefined, 'aucune salle complète : pas de luciole')
  assert.deepEqual(
    rangeesDe(sam.id).map(r => r.badge),
    ['cabinet:scarabee'],
  )
  assert.ok(!aLaLuciole(sam.id))
})

test('un rangement raté ne fait pas tomber la partie, et la page suivante le rattrape', async () => {
  const rat = await joueuse('rat', REMPART_SANS_PANSEMENT)
  ok(await laPage(b, rat.cookie), 'la page')
  aLaMain(
    b.fichier,
    `CREATE TRIGGER etagere_en_panne BEFORE INSERT ON profile_badges WHEN NEW.soiree_id = '${RANGEMENT_DU_CABINET}' BEGIN SELECT RAISE(ABORT, 'panne'); END`,
  )
  let fin: VueDeLaPartie
  try {
    fin = await gagnerPansement(rat.cookie)
  } finally {
    aLaMain(b.fichier, 'DROP TRIGGER etagere_en_panne')
  }
  assert.equal(fin.bilan!.gardiens, undefined, 'rien de rangé, rien d’annoncé')
  assert.equal(fin.bilan!.gains?.legendaires, undefined)
  assert.equal(enBase(b.fichier, db => !!db.prepare(`SELECT 1 FROM cabinet_oeuvres WHERE profile_id = ? AND oeuvre = 'pansement'`).get(rat.id)), true, 'l’œuvre est entrée')
  assert.deepEqual(rangeesDe(rat.id), [])

  // La page suivante — chaude : le musée est en mémoire — réconcilie : la panne passée, le gardien se range, en silence.
  const page = ok(await laPage(b, rat.cookie), 'la page d’après')
  assert.equal(page.reveil, undefined)
  assert.deepEqual(
    rangeesDe(rat.id).map(r => r.badge),
    ['cabinet:phenix'],
  )
  assert.equal(gardienDeLaPage(page, 'lg:phenix').reveille, true)
  assert.ok((await legendairesDe(rat.cookie)).includes('lg:phenix'))
})

test('une œuvre de plus dans une salle complète la rouvre, et son gardien veille encore', async () => {
  const page = ok(await laPage(b, noe.cookie), 'la page')
  const rempart = page.salles.find(s => s.cle === 'rempart')!
  assert.equal(rempart.complete, false)
  assert.equal(rempart.nouvelle, true, '« Une œuvre nouvelle est arrivée »')
  assert.deepEqual(rempart.gardiens[0], { ...rempart.gardiens[0], reveille: true, voie: 'cabinet' })
  assert.notEqual(page.gardiens.prochain?.legendaire, 'lg:phenix', 'le prochain gardien ne promet pas celui qui veille')
  // Une salle jamais complète ne se dit pas rouverte.
  assert.equal(page.salles.find(s => s.cle === 'devin')!.nouvelle, undefined)
  assert.deepEqual(
    rangeesDe(noe.id).map(r => r.badge),
    ['cabinet:phenix'],
    'rien ne se reprend',
  )
  assert.ok((await legendairesDe(noe.cookie)).includes('lg:phenix'))
})

test('l’étagère et le compte des badges taisent les voies rangées du Cabinet', async () => {
  const moi = (await lire(b, kim.cookie, '/api/joueur/moi?leger')).corps.profile as { badges: number }
  // Le haut fait de soirée seul : sa voie du Cabinet, rangée, ne compte pas.
  assert.equal(moi.badges, 1)
  for (const p of PREFIXES_DES_VOIES_RANGEES) assert.ok(p.endsWith(':'), p)
})
