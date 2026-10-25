// L'invariant 1 au Cabinet de curiosités, jeu par jeu : le plan figé en base
// (`campagne_series.cabinet`, relu à côté du serveur) garde les réponses, et
// rien de ce qui juge n'arrive au téléphone avant le verdict de sa manche —
// ni l'index de la bonne réponse, ni « Le savais-tu ? », ni la seconde
// question du Pari avant « Parier », ni le vrai ou faux d'une affirmation de
// l'Éclair, ni le tableau du Détail — son identifiant, son année, lequel des
// quatre titres est le bon —, ni l'année d'un nouveau venu de la Frise, ni les
// événements des vagues à venir, ni le mot du Mot mystère — sa longueur seule,
// et les couleurs de ce qu'il a tapé —, ni la valeur du Filet, ni la zone
// d'Éclairer rejouée de ce que la page connaît, ni une rechange de « Changer ». Jamais la graine de la partie,
// jamais celle de la visite, ni le secret dont elle est faite ; jamais
// l'œuvre visée d'une case de la visite. Chaque réponse se lit en entier
// (`JSON.stringify`) : un champ neuf qui s'y glisserait de lui-même s'y
// verrait. Un jeu de plus ajoute ses secrets ici (la conception, § 2.5).
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import path from 'node:path'
import { inscrireProfil } from './banc'
import {
  DIX_HEURES,
  bancDuCabinet,
  commencer,
  departEnBase,
  dossierDEssai,
  eclairDe,
  enBase,
  fermerLesMagasins,
  jouer,
  laPage,
  lire,
  magasinDEssai,
  ok,
  pariDe,
  poster,
  vraiesDe,
  type BancDuCabinet,
} from './cabinet-banc'
import { SECRET_DU_CABINET } from '../src/core/cabinet/tables'
import { vueDeLaPartie } from '../src/core/cabinet/vue'
import type { BilanDUnePartie, DepartDUnePartie } from '../../shared/cabinet/partie'
import type { PariTire } from '../../shared/cabinet/jeux/pari'
import type { EclairTire } from '../../shared/cabinet/jeux/eclair'
import type { DetailTire } from '../../shared/cabinet/jeux/detail'
import type { FriseTiree } from '../../shared/cabinet/jeux/frise'
import type { MotMontre, MotRevele, MotTire } from '../../shared/cabinet/jeux/mot'
import { REGLE_DU_FILET, type EtatDuFilet, type FiletMontre, type FiletRevele, type FiletTire } from '../../shared/cabinet/jeux/filet'
import { hasardDe } from '../../shared/missions'
import type { QuestionTiree } from '../../shared/cabinet/jeux/outils'
import type { PageDuCabinet, VueDeLaPartie } from '../../shared/cabinet/vues'

let b: BancDuCabinet
before(async () => {
  b = await bancDuCabinet()
})
after(() => b?.banc.close())
after(fermerLesMagasins)

const texte = (x: unknown) => JSON.stringify(x)

/** Ce qu'aucune réponse ne porte, quelle que soit la phase : la graine, le moindre champ `bonne`, `vraie`, `cible`. */
function jamais(d: DepartDUnePartie, x: unknown, ou: string) {
  const t = texte(x)
  assert.ok(!t.includes(d.graine), `${ou} : la graine de la partie`)
  assert.doesNotMatch(t, /"cible"|"graine"|"tirages"/, `${ou} : un champ du départ figé`)
}

/** Ce qu'une question de la base garde jusqu'à son verdict : l'index de sa bonne réponse, son anecdote. */
function sansSaReponse(q: QuestionTiree, x: unknown, ou: string) {
  const t = texte(x)
  assert.doesNotMatch(t, /"bonne"/, `${ou} : l’index d’une bonne réponse`)
  if (q.anecdote) assert.ok(!t.includes(q.anecdote), `${ou} : « Le savais-tu ? » avant le verdict`)
}

test('le Pari : ni la bonne réponse, ni son anecdote, ni la seconde question avant « Parier » — ni une rechange de Changer', async () => {
  const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
  // L'Échange, une œuvre de départ : il change, et le plan garde sa rechange.
  const v0 = ok(await commencer(b, lea, { origine: 'libre', jeu: 'pari', carte: 'echange' }), 'commencer')
  const d = departEnBase(b.fichier, v0.id)
  assert.ok(d.tirages.length > 3, 'une rechange au plan')
  const t = d.tirages[0] as PariTire
  const rechange = d.tirages[3] as PariTire
  const page = ok(await laPage(b, lea), 'la page')
  for (const [ou, x] of [
    ['le départ', v0],
    ['la page', page],
  ] as const) {
    jamais(d, x, ou)
    sansSaReponse(t.q1, x, ou)
    assert.ok(!texte(x).includes(t.q2.texte), `${ou} : la seconde question avant « Parier »`)
    assert.ok(!texte(x).includes(rechange.q1.texte) && !texte(x).includes(rechange.q2.texte), `${ou} : la rechange`)
  }
  assert.ok(texte(v0).includes(t.q1.texte), 'la première question, elle, se montre')

  // Juste au premier coup : au choix, sa réponse dite juste — rien de la seconde.
  const auChoix = ok(await jouer(b, lea, v0, { quoi: 'repondre', manche: 0, reponse: { pari: { choix: t.q1.bonne } } }), 'la première')
  jamais(d, auChoix, 'au choix')
  assert.ok(!texte(auChoix).includes(t.q2.texte), 'au choix : la seconde question')
  // Parier : la seconde se montre, sans sa réponse.
  const pariee = ok(await jouer(b, lea, auChoix, { quoi: 'parier', manche: 0 }), 'parier')
  jamais(d, pariee, 'pariée')
  assert.ok(texte(pariee).includes(t.q2.texte))
  sansSaReponse(t.q2, pariee, 'pariée')
  // Le verdict : la révélation dit tout.
  const revelee = ok(await jouer(b, lea, pariee, { quoi: 'repondre', manche: 0, reponse: { pari: { choix: t.q2.bonne } } }), 'la seconde')
  jamais(d, revelee, 'révélée')
  assert.match(texte(revelee.revelation), /"bonne"/, 'la révélation dit la bonne réponse')
  assert.ok(!texte(revelee).includes(rechange.q1.texte), 'la rechange jamais, même après')
})

test('l’Éclair : ni le vrai ou faux d’une affirmation, ni la bonne réponse qu’une fausse cachait, avant l’envoi', async () => {
  const tom = await inscrireProfil(b.banc.url, 'tom', 'Tom')
  const v0 = ok(await commencer(b, tom, { origine: 'libre', jeu: 'eclair', carte: null }), 'commencer')
  const d = departEnBase(b.fichier, v0.id)
  const t = d.tirages[0] as EclairTire
  const fausses = t.affirmations.filter(a => a.proposee !== a.question.bonne).map(a => a.question.reponses[a.question.bonne])
  for (const [ou, x] of [
    ['le départ', v0],
    ['la page', ok(await laPage(b, tom), 'la page')],
  ] as const) {
    jamais(d, x, ou)
    assert.doesNotMatch(texte(x), /"vraie"|"bonne"/, `${ou} : le vrai ou faux`)
    for (const bonne of fausses) assert.ok(!texte(x).includes(`"${bonne}"`), `${ou} : la bonne réponse d’une fausse`)
  }
  const revelee = ok(await jouer(b, tom, v0, { quoi: 'repondre', manche: 0, reponse: { eclair: { reponses: vraiesDe(eclairDe(b, v0.id, 0)) } } }), 'répondre')
  jamais(d, revelee, 'révélée')
  assert.match(texte(revelee.revelation), /"vraie"/, 'la révélation le dit')
})

test('le Détail : ni le tableau, ni le bon titre, ni son année, ni son anecdote avant le verdict — ni la rechange de Changer, ni la mauvaise réponse qu’Éclairer efface', async () => {
  const ana = await inscrireProfil(b.banc.url, 'ana', 'Ana')
  /** Ce que la manche du Détail garde jusqu'à son verdict : le tableau, l'index du bon titre, l'année, « Le savais-tu ? ». */
  const sansLeTableau = (t: DetailTire, x: unknown, ou: string) => {
    const s = texte(x)
    assert.ok(!s.includes(t.tableau.qid), `${ou} : l’identifiant du tableau, qui nomme ses images`)
    assert.doesNotMatch(s, /"bonne"|"tableau"|"qid"|"annee"|"anecdote"|"savais"/, `${ou} : un champ de la réponse`)
    if (t.anecdote) assert.ok(!s.includes(t.anecdote), `${ou} : l’anecdote`)
  }
  // L'Échange : une rechange au plan, qu'aucune vue ne montre avant que Changer la prenne.
  const v0 = ok(await commencer(b, ana, { origine: 'libre', jeu: 'detail', carte: 'echange' }), 'commencer')
  const d = departEnBase(b.fichier, v0.id)
  const t = d.tirages[0] as DetailTire
  const rechange = d.tirages[3] as DetailTire
  for (const [ou, x] of [
    ['le départ', v0],
    ['la page', ok(await laPage(b, ana), 'la page')],
    ['un pas en arrière', ok(await jouer(b, ana, v0, { quoi: 'reculer', manche: 0 }), 'reculer')],
  ] as const) {
    jamais(d, x, ou)
    sansLeTableau(t, x, ou)
    assert.ok(!texte(x).includes(`"${rechange.tableau.titre}"`) && !texte(x).includes(rechange.tableau.qid), `${ou} : la rechange`)
  }
  assert.ok(t.titres.every(x => texte(v0).includes(x.titre)), 'les quatre titres, eux, se montrent — sans dire lequel')
  ok(await jouer(b, ana, { id: v0.id, rang: 3 }, { quoi: 'quitter' }), 'quitter')

  // Éclairer efface un mauvais titre : la vue dit lequel est effacé, jamais lequel est le bon.
  const e0 = ok(await commencer(b, ana, { origine: 'libre', jeu: 'detail', carte: 'coup-d-oeil' }), 'commencer')
  const de = departEnBase(b.fichier, e0.id)
  const te = de.tirages[0] as DetailTire
  const eclairee = ok(await jouer(b, ana, e0, { quoi: 'eclairer', manche: 0 }), 'éclairer')
  jamais(de, eclairee, 'éclairée')
  sansLeTableau(te, eclairee, 'éclairée')
  const effaces = eclairee.enCours?.jeu === 'detail' ? eclairee.enCours.titres.filter(x => x.efface) : []
  assert.equal(effaces.length, 1)
  assert.notEqual(effaces[0].titre, te.tableau.titre)
  // Le verdict : la révélation nomme le tableau, son peintre et son année.
  const revelee = ok(await jouer(b, ana, eclairee, { quoi: 'repondre', manche: 0, reponse: { detail: { titre: te.bonne } } }), 'répondre')
  jamais(de, revelee, 'révélée')
  assert.match(texte(revelee.revelation), new RegExp(`"annee":${te.tableau.annee}`), 'la révélation dit son année')
})

test('la Frise : ni l’année d’un nouveau venu, ni l’ordre du temps, ni les événements des vagues à venir avant leur manche — sauf l’année qu’Éclairer dévoile', async () => {
  const leo = await inscrireProfil(b.banc.url, 'leo', 'Léo')
  const v0 = ok(await commencer(b, leo, { origine: 'libre', jeu: 'frise', carte: 'coup-d-oeil' }), 'commencer')
  const d = departEnBase(b.fichier, v0.id)
  const t = d.tirages[0] as FriseTiree
  /** Ce qu'une manche montre de la frise : ses ancres datées, ses nouveaux venus sans leur année, dans l'ordre montré — rien de la suite. */
  const aSaManche = (x: VueDeLaPartie, k: number, devoiles: number, ou: string) => {
    jamais(d, x, ou)
    const s = texte(x)
    assert.doesNotMatch(s, /"vagues"|"evenements"|"rangs"|"savais"|"sorte"/, `${ou} : le plan de la frise`)
    const montre = x.enCours?.jeu === 'frise' ? x.enCours : null
    assert.ok(montre, ou)
    // L'ordre montré, jamais celui du temps à dessein : les nouveaux venus tels que le départ les a battus.
    assert.deepEqual(montre.nouveaux.map(n => n.libelle), t.vagues[k].map(r => t.evenements[r].libelle), `${ou} : l’ordre montré`)
    assert.equal(montre.nouveaux.filter(n => 'annee' in n).length, devoiles, `${ou} : l’année d’un nouveau venu`)
    for (const r of t.vagues.slice(k + 1).flat()) assert.ok(!s.includes(t.evenements[r].libelle), `${ou} : « ${t.evenements[r].libelle} », d’une vague à venir`)
    if (t.savais) assert.ok(!s.includes(t.savais), `${ou} : le savais-tu de la frise`)
  }
  aSaManche(v0, 0, 0, 'le départ')
  aSaManche(ok(await laPage(b, leo), 'la page').enCours!, 0, 0, 'la page')
  // Éclairer dévoile l'année d'un nouveau venu, une seule — la vue la porte, et rien d'autre.
  const eclairee = ok(await jouer(b, leo, v0, { quoi: 'eclairer', manche: 0 }), 'éclairer')
  aSaManche(eclairee, 0, 1, 'éclairée')
  // Rangée : la révélation range la manche ; la suivante montre ses ancres datées, ses nouveaux venus sans année.
  const ordre = [...t.vagues[0]].sort((a, z) => a - z).map(r => t.vagues[0].indexOf(r))
  const revelee = ok(await jouer(b, leo, eclairee, { quoi: 'repondre', manche: 0, reponse: { frise: { ordre } } }), 'répondre')
  jamais(d, revelee, 'révélée')
  assert.match(texte(revelee.revelation), /"annee"/, 'la révélation dit les années')
  const suivante = ok(await jouer(b, leo, revelee, { quoi: 'ouvrir', manche: 1 }), 'la manche suivante')
  aSaManche(suivante, 1, 0, 'la manche 2')
})

test('le Mot mystère : ni le mot, ni sa réponse écrite, ni les autres réponses, ni son anecdote avant le verdict — sa longueur, ses couleurs, la lettre soufflée — ni la rechange de Changer', async () => {
  const mia = await inscrireProfil(b.banc.url, 'mia', 'Mia')
  /** Ce que la manche du Mot garde jusqu'à son verdict : le mot, ce qu'il écrit, les réponses de sa question, son anecdote. */
  const sansLeMot = (t: MotTire, x: unknown, ou: string) => {
    const s = texte(x)
    assert.ok(!s.includes(t.lettres), `${ou} : le mot`)
    for (const r of [t.affiche, ...t.question.reponses]) assert.ok(!s.includes(`"${r}"`), `${ou} : « ${r} », une réponse de la question`)
    assert.doesNotMatch(s, /"affiche"|"reponses"|"reponse"/, `${ou} : un champ de la réponse`)
    sansSaReponse(t.question, x, ou)
  }
  /** La manche montrée, rien de plus que ce que la règle montre : sa longueur, ses essais et leurs couleurs, les lettres soufflées. */
  const aSaManche = (x: VueDeLaPartie, t: MotTire, ou: string) => {
    const m = x.enCours as MotMontre
    assert.deepEqual(Object.keys(m).sort(), ['categorie', 'essais', 'essaisMax', 'jeu', 'longueur', 'soufflees', 'texte'], ou)
    assert.equal(m.longueur, t.lettres.length, ou)
    for (const e of m.essais) assert.deepEqual(Object.keys(e).sort(), ['couleurs', 'lettres'], ou)
  }
  // L'Échange, une œuvre de départ : il change, et le plan garde sa rechange.
  const v0 = ok(await commencer(b, mia, { origine: 'libre', jeu: 'mot', carte: 'echange' }), 'commencer')
  const d = departEnBase(b.fichier, v0.id)
  const t = d.tirages[0] as MotTire
  const rechange = d.tirages[3] as MotTire
  assert.ok(rechange, 'une rechange au plan')
  const essaye = ok(await jouer(b, mia, v0, { quoi: 'essai', manche: 0, lettres: 'X'.repeat(t.lettres.length) }), 'un essai')
  for (const [ou, x] of [
    ['le départ', v0],
    ['la page', ok(await laPage(b, mia), 'la page').enCours!],
    ['un essai', essaye],
  ] as const) {
    jamais(d, x, ou)
    sansLeMot(t, x, ou)
    aSaManche(x, t, ou)
    assert.ok(!texte(x).includes(rechange.question.texte) && !texte(x).includes(rechange.lettres), `${ou} : la rechange`)
  }
  // Le verdict dit le mot ; la rechange, jamais prise, ne se dit toujours pas.
  const trouve = ok(await jouer(b, mia, essaye, { quoi: 'essai', manche: 0, lettres: t.lettres }), 'le mot')
  jamais(d, trouve, 'révélée')
  assert.equal((trouve.revelation?.corps as MotRevele).lettres, t.lettres)
  assert.ok(!texte(trouve).includes(rechange.question.texte), 'la rechange, même après')
  ok(await jouer(b, mia, trouve, { quoi: 'quitter' }), 'quitter')

  // Éclairer souffle une lettre, à sa place : elle seule, rien du reste du mot.
  const e0 = ok(await commencer(b, mia, { origine: 'libre', jeu: 'mot', carte: 'coup-d-oeil' }), 'commencer')
  const de = departEnBase(b.fichier, e0.id)
  const te = de.tirages[0] as MotTire
  const eclairee = ok(await jouer(b, mia, e0, { quoi: 'eclairer', manche: 0 }), 'éclairer')
  jamais(de, eclairee, 'éclairée')
  sansLeMot(te, eclairee, 'éclairée')
  aSaManche(eclairee, te, 'éclairée')
  const [soufflee] = (eclairee.enCours as MotMontre).soufflees
  assert.equal((eclairee.enCours as MotMontre).soufflees.length, 1)
  assert.equal(soufflee.lettre, te.lettres[soufflee.position])
})

test('le Filet : ni la valeur, ni les réponses de sa question, ni son anecdote avant le verdict — sa piste seule —, et la zone d’Éclairer, que la page ne rejoue pas', async () => {
  const sam = await inscrireProfil(b.banc.url, 'sam', 'Sam')
  const id = (await lire(b, sam, '/api/joueur/moi?leger')).corps.profile.id as string
  const v0 = ok(await commencer(b, sam, { origine: 'libre', jeu: 'filet', carte: 'coup-d-oeil' }), 'commencer')
  const d = departEnBase(b.fichier, v0.id)
  const t = d.tirages[0] as FiletTire
  /** Ce que la manche du Filet garde jusqu'à son verdict : la valeur, les réponses de sa question — la bonne écrite —, son anecdote. */
  const sansLaValeur = (x: unknown, ou: string) => {
    const s = texte(x)
    assert.doesNotMatch(s, /"valeur"|"reponses"|"reponse"|"lancer"/, `${ou} : un champ de la réponse`)
    for (const r of t.question.reponses) assert.ok(!s.includes(`"${r}"`), `${ou} : « ${r} », une réponse de la question`)
    sansSaReponse(t.question, x, ou)
  }
  const eclairee = ok(await jouer(b, sam, v0, { quoi: 'eclairer', manche: 0 }), 'éclairer')
  for (const [ou, x] of [
    ['le départ', v0],
    ['la page', ok(await laPage(b, sam), 'la page').enCours!],
    ['éclairée', eclairee],
  ] as const) {
    jamais(d, x, ou)
    sansLaValeur(x, ou)
    assert.deepEqual((x.enCours as FiletMontre).piste, t.piste, `${ou} : la piste, elle, se montre`)
  }
  // La zone contient la réponse : rejouée de la graine du départ — un secret du serveur —, elle se retrouve ; de ce que la page
  // connaît, son profil, sa partie, le rang du geste (la graine que la conception proposait), jamais.
  const zone = (eclairee.enCours as FiletMontre).zone!
  assert.ok(zone.de <= t.valeur && t.valeur <= zone.a)
  const rejouee = (graine: string) => (REGLE_DU_FILET.eclairer(t, { zone: null }, hasardDe(`${graine}:eclairer:${v0.rang}`)) as EtatDuFilet).zone
  assert.deepEqual(rejouee(d.graine), zone, 'le hasard d’Éclairer vient de la graine du départ')
  for (const devinee of [`${id}:${v0.id}`, v0.id, id, '']) assert.notDeepEqual(rejouee(devinee), zone, `rejouée de « ${devinee} »`)
  // Le verdict : la révélation dit la valeur.
  const revelee = ok(await jouer(b, sam, eclairee, { quoi: 'repondre', manche: 0, reponse: { filet: { x: t.valeur, taille: 'moyen' } } }), 'lancer')
  jamais(d, revelee, 'révélée')
  assert.equal((revelee.revelation?.corps as FiletRevele).valeur, t.valeur)
})

test('le bilan se choisit champ par champ : un champ de plus au bilan figé ne part pas de lui-même, ni l’œuvre visée d’une visite manquée', async () => {
  // Le piège `montree` de l'Expédition : étalé, le bilan figé aurait envoyé au téléphone tout champ qu'on lui ajoute.
  const m = await magasinDEssai(path.join(dossierDEssai(), 'bilan.db'), { t: DIX_HEURES })
  const p = await m.cabinet.commencer('qui', { origine: 'visite', case: 0, carte: null })
  const fin = await m.cabinet.geste('qui', p.id, 2, { quoi: 'quitter' })
  assert.ok('partie' in fin && fin.partie.bilan)
  assert.equal(fin.partie.bilan.issue, 'manquee')
  const vue = vueDeLaPartie({ ...fin.partie, bilan: { ...fin.partie.bilan, laVisee: 'un-champ-neuf' } as BilanDUnePartie })
  assert.equal(vue.bilan?.issue, 'manquee')
  assert.ok(!texte(vue).includes('un-champ-neuf'), 'un champ du bilan figé que la vue n’a pas choisi')
  if (p.depart.cible !== null) assert.ok(!texte(vue).includes(`"${p.depart.cible}"`), 'la visite manquée nomme l’œuvre visée')
})

test('la visite : ni l’œuvre visée d’une case, ni sa graine, ni le secret dont elle est faite', async () => {
  const ines = await inscrireProfil(b.banc.url, 'ines', 'Inès')
  const id = (await lire(b, ines, '/api/joueur/moi?leger')).corps.profile.id as string
  // Un départ fige la visite du jour en base : les œuvres visées de chaque case s'y lisent.
  const v = ok(await commencer(b, ines, { origine: 'visite', case: 0, carte: null }), 'la visite')
  const figee = enBase(b.fichier, db => JSON.parse((db.prepare('SELECT visites FROM cabinet_profils WHERE profile_id = ?').get(id) as { visites: string }).visites)) as {
    cases: { cible: string | null }[]
  }[]
  const cibles = figee[0].cases.map(c => c.cible).filter((c): c is string => c !== null)
  assert.ok(cibles.length > 0)
  const secret = enBase(b.fichier, db => (db.prepare('SELECT valeur FROM campagne_meta WHERE cle = ?').get(SECRET_DU_CABINET) as { valeur: string }).valeur)
  const graine = createHmac('sha256', secret).update(id).digest('hex')
  const page = ok(await laPage(b, ines), 'la page')
  for (const [ou, x] of [
    ['la page', page],
    ['le départ', v],
  ] as const) {
    assert.ok(!texte(x).includes(secret), `${ou} : le secret du Cabinet`)
    assert.ok(!texte(x).includes(graine), `${ou} : la graine de la visite`)
  }
  // Le musée nomme ses 84 œuvres : c'est la visite, et la partie qu'elle ouvre, qui ne nomment pas la sienne.
  for (const cible of cibles) {
    assert.ok(!texte(page.visite).includes(`"${cible}"`), `la visite nomme ${cible}`)
    assert.ok(!texte(v).includes(`"${cible}"`), `la partie de la visite nomme ${cible}`)
    assert.ok(!texte(page.enCours).includes(`"${cible}"`), `la partie en cours nomme ${cible}`)
  }
})

test('« Mes réponses », le cartel, la page d’après un échange : rien du départ figé, ni l’œuvre visée d’une case', async () => {
  const noe = await inscrireProfil(b.banc.url, 'noe', 'Noé')
  const id = (await lire(b, noe, '/api/joueur/moi?leger')).corps.profile.id as string
  // Une case manquée, relue : l'œuvre qu'elle visait reste à découvrir.
  const v = ok(await commencer(b, noe, { origine: 'visite', case: 0, carte: null }), 'la visite')
  const d = departEnBase(b.fichier, v.id)
  ok(await jouer(b, noe, v, { quoi: 'quitter' }), 'quitter')
  const relue = ok(await lire<VueDeLaPartie>(b, noe, `/api/cabinet/partie/${v.id}`), '« Mes réponses »')
  jamais(d, relue, '« Mes réponses »')
  if (d.cible !== null) assert.ok(!texte(relue).includes(`"${d.cible}"`), '« Mes réponses » nomme l’œuvre visée')
  // Une chasse gagnée : son cartel dit sa manche, rien de plus.
  let chasse = ok(await commencer(b, noe, { origine: 'chasse', oeuvre: 'lecon', carte: null }), 'la chasse')
  const plan = departEnBase(b.fichier, chasse.id)
  for (let k = 0; k < 3; k++) {
    const t = plan.tirages[k] as PariTire
    if (k > 0) chasse = ok(await jouer(b, noe, chasse, { quoi: 'ouvrir', manche: k as 0 | 1 | 2 }), 'ouvrir')
    chasse = ok(await jouer(b, noe, chasse, { quoi: 'repondre', manche: k as 0 | 1 | 2, reponse: { pari: { choix: t.q1.bonne } } }), 'q1')
    chasse = ok(await jouer(b, noe, chasse, { quoi: 'parier', manche: k as 0 | 1 | 2 }), 'parier')
    chasse = ok(await jouer(b, noe, chasse, { quoi: 'repondre', manche: k as 0 | 1 | 2, reponse: { pari: { choix: t.q2.bonne } } }), 'q2')
  }
  jamais(plan, ok(await lire(b, noe, '/api/cabinet/oeuvre/lecon'), 'le cartel'), 'le cartel')
  // Un échange : la page d'après ne nomme pas plus les œuvres visées que la page d'avant.
  const apres = ok(await poster<PageDuCabinet>(b, noe, '/api/cabinet/visite/echange', { case: 1 }), 'l’échange')
  const figee = enBase(b.fichier, db => JSON.parse((db.prepare('SELECT visites FROM cabinet_profils WHERE profile_id = ?').get(id) as { visites: string }).visites)) as {
    cases: { cible: string | null }[]
  }[]
  const graine = createHmac('sha256', enBase(b.fichier, db => (db.prepare('SELECT valeur FROM campagne_meta WHERE cle = ?').get(SECRET_DU_CABINET) as { valeur: string }).valeur)).update(id).digest('hex')
  assert.ok(!texte(apres).includes(graine), 'la page d’après : la graine de la visite')
  // Seule la Leçon, gagnée depuis, peut s'y nommer — « pour dorer » — si une case la visait.
  for (const cible of figee[0].cases.map(c => c.cible).filter((c): c is string => c !== null && c !== 'lecon')) {
    assert.ok(!texte(apres.visite).includes(`"${cible}"`), `la visite échangée nomme ${cible}`)
  }
})
