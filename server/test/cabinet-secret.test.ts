// L'invariant 1 au Cabinet de curiosités, jeu par jeu : le plan figé en base
// (`campagne_series.cabinet`, relu à côté du serveur) garde les réponses, et
// rien de ce qui juge n'arrive au téléphone avant le verdict de sa manche —
// ni l'index de la bonne réponse, ni « Le savais-tu ? », ni la seconde
// question du Pari avant « Parier », ni le vrai ou faux d'une affirmation de
// l'Éclair, ni le tableau du Détail — son identifiant, son année, lequel des
// quatre titres est le bon —, ni l'année d'un nouveau venu de la Frise, ni les
// événements des vagues à venir, ni le mot du Mot mystère — sa longueur seule,
// et les couleurs de ce qu'il a tapé —, ni la valeur du Filet, ni la zone
// d'Éclairer rejouée de ce que la page connaît, ni une rechange de « Changer ».
// Ni le lieu de l'Épingle — sa commune, son département, ses coordonnées —, ni
// le décalage de sa zone d'Éclairer, figé au tirage ; ni la personne d'une
// fiche des Indices, ses clés, ses indices encore cachés ; ni le mot d'une
// réplique, ni qui l'a dite, ni si le mot choisi était le bon. Jamais la graine de la partie,
// jamais celle de la visite, ni le secret dont elle est faite ; jamais
// l'œuvre visée d'une case de la visite — ni sous « Retenter », qui vise la
// case, et dont la demande qui nommerait l'œuvre se refuse pareil pour toutes. Chaque réponse se lit en entier
// (`JSON.stringify`) : un champ neuf qui s'y glisserait de lui-même s'y
// verrait. Un jeu de plus ajoute ses secrets ici.
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
import { epingleTiree, zoneDEclairer, type EpingleMontree, type EpingleRevelee, type EpingleTiree } from '../../shared/cabinet/jeux/epingle'
import type { IndicesMontres, IndicesReveles, IndicesTires } from '../../shared/cabinet/jeux/indices'
import type { RepliqueMontreeAuMot, RepliqueRevelee, RepliqueTiree } from '../../shared/cabinet/jeux/replique'
import { distanceKm } from '../../shared/cabinet/france'
import { DECALAGE_DE_LA_ZONE_KM } from '../../shared/cabinet/bareme'
import { contenuDuCabinet, ecritDans } from '../src/core/cabinet/contenu'
import { hasardDe } from '../../shared/missions'
import type { QuestionTiree } from '../../shared/cabinet/jeux/outils'
import type { MursDuCabinet, PageDuCabinet, VueDeLaPartie } from '../../shared/cabinet/vues'
import { jeuDeLEchange, museeDe, visiteDuJour, type LigneDOeuvre } from '../../shared/cabinet/musee'
import { OEUVRES } from '../../shared/cabinet/oeuvres'
import { JEUX_PRETS } from '../../shared/cabinet/ouverture'

let b: BancDuCabinet
before(async () => {
  b = await bancDuCabinet()
})
after(() => b?.banc.close())
after(fermerLesMagasins)

const texte = (x: unknown) => JSON.stringify(x)
/**
 * Les textes d'une réponse : ses seules valeurs, jamais ses clés. Le département de la Manche n'est pas le champ `manche` de
 * toute vue, ni l'œuvre « revelation » le champ `revelation` d'une manche révélée — cherchés dans le JSON entier, l'un et
 * l'autre faisaient rougir une épreuve, au hasard du tirage, sans que rien ne fuie.
 */
const textesDe = (x: unknown): string[] => (typeof x === 'string' ? [x] : typeof x === 'object' && x !== null ? Object.values(x).flatMap(textesDe) : [])
/** Une réponse qui écrit cette clé d'œuvre en valeur, telle quelle : `{ oeuvre: 'lecon' }`, `{ pourDorer: 'lecon' }`. */
const nomme = (x: unknown, cle: string) => textesDe(x).includes(cle)

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

test('le Filet : ni la valeur, ni les réponses de sa question, ni son anecdote avant le verdict — sa piste seule —, ni la rechange de Changer, et la zone d’Éclairer, que la page ne rejoue pas', async () => {
  const sam = await inscrireProfil(b.banc.url, 'sam', 'Sam')
  const id = (await lire(b, sam, '/api/joueur/moi?leger')).corps.profile.id as string
  /** Ce que la manche du Filet garde jusqu'à son verdict : la valeur, les réponses de sa question — la bonne écrite —, son anecdote. */
  const sansLaValeur = (t: FiletTire, x: unknown, ou: string) => {
    const s = texte(x)
    assert.doesNotMatch(s, /"valeur"|"reponses"|"reponse"|"lancer"/, `${ou} : un champ de la réponse`)
    for (const r of t.question.reponses) assert.ok(!s.includes(`"${r}"`), `${ou} : « ${r} », une réponse de la question`)
    sansSaReponse(t.question, x, ou)
  }

  // L'Échange : une rechange au plan, sa question et sa piste, qu'aucune vue ne montre avant que Changer la prenne.
  const e0 = ok(await commencer(b, sam, { origine: 'libre', jeu: 'filet', carte: 'echange' }), 'commencer sous l’Échange')
  const de = departEnBase(b.fichier, e0.id)
  const rechange = de.tirages[3] as FiletTire
  assert.ok(rechange, 'une rechange au plan')
  for (const [ou, x] of [
    ['le départ', e0],
    ['la page', ok(await laPage(b, sam), 'la page').enCours!],
  ] as const) {
    jamais(de, x, ou)
    sansLaValeur(de.tirages[0] as FiletTire, x, ou)
    sansLaValeur(rechange, x, `${ou}, la rechange`)
    assert.ok(!texte(x).includes(rechange.question.texte), `${ou} : la question de la rechange`)
  }
  // Prise, la rechange se montre comme une manche : sa question et sa piste, rien de sa valeur.
  const changee = ok(await jouer(b, sam, e0, { quoi: 'changer', manche: 0 }), 'changer')
  jamais(de, changee, 'changée')
  sansLaValeur(rechange, changee, 'changée')
  assert.deepEqual([(changee.enCours as FiletMontre).texte, (changee.enCours as FiletMontre).piste], [rechange.question.texte, rechange.piste])
  ok(await jouer(b, sam, changee, { quoi: 'quitter' }), 'quitter')

  const v0 = ok(await commencer(b, sam, { origine: 'libre', jeu: 'filet', carte: 'coup-d-oeil' }), 'commencer')
  const d = departEnBase(b.fichier, v0.id)
  const t = d.tirages[0] as FiletTire
  const eclairee = ok(await jouer(b, sam, v0, { quoi: 'eclairer', manche: 0 }), 'éclairer')
  for (const [ou, x] of [
    ['le départ', v0],
    ['la page', ok(await laPage(b, sam), 'la page').enCours!],
    ['éclairée', eclairee],
  ] as const) {
    jamais(d, x, ou)
    sansLaValeur(t, x, ou)
    assert.deepEqual((x.enCours as FiletMontre).piste, t.piste, `${ou} : la piste, elle, se montre`)
  }
  // La zone contient la réponse : rejouée de la graine du départ — un secret du serveur —, elle se retrouve ; de ce que la page
  // connaît, son profil, sa partie, le rang du geste (la graine que la conception proposait), jamais.
  const zone = (eclairee.enCours as FiletMontre).zone!
  assert.ok(zone.de <= t.valeur && t.valeur <= zone.a)
  const rejouee = (tirage: FiletTire, graine: string) => (REGLE_DU_FILET.eclairer(tirage, { zone: null }, hasardDe(`${graine}:eclairer:${v0.rang}`)) as EtatDuFilet).zone
  assert.deepEqual(rejouee(t, d.graine), zone, 'le hasard d’Éclairer vient de la graine du départ')
  // Ramenée sur la piste, une zone collée à une borne est la même quel que soit le hasard — une réponse à moins de 30 % d'un
  // bout, une fois sur six : les graines se comparent sur une piste où la réponse est au milieu, que la zone ne touche jamais.
  const auMilieu: FiletTire = { ...t, piste: { min: t.valeur - 100, max: t.valeur + 100, pas: 1 } }
  for (const devinee of [`${id}:${v0.id}`, v0.id, id, '']) assert.notDeepEqual(rejouee(auMilieu, devinee), rejouee(auMilieu, d.graine), `rejouée de « ${devinee} »`)
  // Le verdict : la révélation dit la valeur.
  const revelee = ok(await jouer(b, sam, eclairee, { quoi: 'repondre', manche: 0, reponse: { filet: { x: t.valeur, taille: 'moyen' } } }), 'lancer')
  jamais(d, revelee, 'révélée')
  assert.equal((revelee.revelation?.corps as FiletRevele).valeur, t.valeur)
})

/** Tous les nombres d'une réponse, où qu'ils soient : une coordonnée ne se cherche pas en texte, une autre la contiendrait. */
const nombresDe = (x: unknown): number[] => (typeof x === 'number' ? [x] : typeof x === 'object' && x !== null ? Object.values(x).flatMap(nombresDe) : [])
/** La forme d'une réponse, ses textes et ses nombres effacés : deux réponses de même forme ne disent rien de plus l'une que l'autre. */
const formeDe = (x: unknown) => JSON.stringify(x, (_k, v: unknown) => (typeof v === 'string' || typeof v === 'number' ? 0 : v))

test('l’Épingle : ni le lieu, ni sa commune, ni son département, ni ses coordonnées, ni son « Le savais-tu ? » avant le verdict — ni la rechange de Changer, ni le décalage de la zone d’Éclairer, figé au tirage', async () => {
  const eva = await inscrireProfil(b.banc.url, 'eva', 'Éva')
  const id = (await lire(b, eva, '/api/joueur/moi?leger')).corps.profile.id as string
  /** Ses coordonnées et le décalage de sa zone : jamais un de ces nombres dans une réponse, avant le verdict. */
  const sansSesNombres = (t: EpingleTiree, x: unknown, ou: string) =>
    assert.ok(!nombresDe(x).some(n => n === t.lieu.lat || n === t.lieu.lon || n === t.decalage.cap || n === t.decalage.km), `${ou} : ses coordonnées, son décalage`)
  /** Ce que la manche de l'Épingle garde jusqu'à son verdict : tout ce qui situe son lieu, et le décalage de sa zone. */
  const sansLeLieu = (t: EpingleTiree, x: unknown, ou: string) => {
    const s = texte(x)
    // En mots entiers, comme le juge du contenu les cherche dans le récit et la question : « Ain » n'est pas dans « Ainsi ». Dans
    // les seuls textes de la réponse : la clé `manche` de toute vue s'écrit « Manche », un département sur quatre-vingt-dix lieux.
    const lu = textesDe(x).join('\n')
    for (const dit of [t.lieu.commune, t.lieu.departement]) assert.ok(!ecritDans(lu, dit), `${ou} : « ${dit} »`)
    assert.ok(!s.includes(t.lieu.savais), `${ou} : son « Le savais-tu ? »`)
    assert.doesNotMatch(s, /"(lieu|nom|commune|departement|decalage|cap|km|savais)":/, `${ou} : un champ du lieu`)
    sansSesNombres(t, x, ou)
  }
  // L'Échange : une rechange au plan, d'un autre thème, qu'aucune vue ne montre avant que Changer la prenne. Son récit pourrait
  // nommer, d'un autre thème, la commune de la rechange : celle-ci se cherche par ce qu'elle-même montrerait.
  const e0 = ok(await commencer(b, eva, { origine: 'libre', jeu: 'epingle', carte: 'echange' }), 'commencer sous l’Échange')
  const de = departEnBase(b.fichier, e0.id)
  const rechange = de.tirages[3] as EpingleTiree
  assert.ok(rechange, 'une rechange au plan')
  for (const [ou, x] of [
    ['le départ', e0],
    ['la page', ok(await laPage(b, eva), 'la page').enCours!],
  ] as const) {
    jamais(de, x, ou)
    sansLeLieu(de.tirages[0] as EpingleTiree, x, ou)
    sansSesNombres(rechange, x, `${ou}, la rechange`)
    assert.ok(!texte(x).includes(rechange.lieu.recit) && !texte(x).includes(rechange.lieu.question), `${ou} : la rechange`)
  }
  ok(await jouer(b, eva, e0, { quoi: 'quitter' }), 'quitter')

  // Éclairer : la zone, du décalage que le tirage a figé — la même à chaque relecture, le lieu toujours dedans, jamais au centre.
  const v0 = ok(await commencer(b, eva, { origine: 'libre', jeu: 'epingle', carte: 'coup-d-oeil' }), 'commencer')
  const d = departEnBase(b.fichier, v0.id)
  const t = d.tirages[0] as EpingleTiree
  const eclairee = ok(await jouer(b, eva, v0, { quoi: 'eclairer', manche: 0 }), 'éclairer')
  const zone = (eclairee.enCours as EpingleMontree).zone!
  assert.deepEqual(zone, zoneDEclairer(t.lieu, t.decalage))
  assert.ok(distanceKm(zone, t.lieu) <= zone.rayonKm && distanceKm(zone, t.lieu) > DECALAGE_DE_LA_ZONE_KM[0] - 1)
  const relue = ok(await laPage(b, eva), 'la page relue').enCours!
  assert.deepEqual((relue.enCours as EpingleMontree).zone, zone, 'rechargée, la même zone')
  for (const [ou, x] of [
    ['le départ', v0],
    ['éclairée', eclairee],
    ['la page relue', relue],
  ] as const) {
    jamais(d, x, ou)
    sansLeLieu(t, x, ou)
  }
  // Ce qui vaut pour ce lieu tiré vaut pour chacun : aucun lieu livré n'a pour coordonnée un nombre que la vue porte d'elle-même —
  // son rang, ses compteurs, le rayon de la zone. Noyon s'écrivait « 3 » de longitude, la vue éclairée porte des 3, et
  // `sansSesNombres` criait à la fuite une partie sur quatre-vingt-dix, sans fuite (`npm run verify`, deux fois). L'épreuve ne
  // s'affaiblit pas : le contenu se corrige, et son juge refuse une coordonnée ronde (`cabinet-contenu.test.ts`).
  const portes = new Set(nombresDe(eclairee))
  assert.deepEqual(
    contenuDuCabinet()
      .lieux.filter(l => portes.has(l.lat) || portes.has(l.lon))
      .map(l => `${l.id} (${l.lat}, ${l.lon})`),
    [],
    'un lieu dont une coordonnée est un nombre de la vue',
  )
  // Les murs disent les lieux révélés — celui de la partie quittée —, jamais celui d'une manche qui attend son verdict.
  const murs = ok(await lire<MursDuCabinet>(b, eva, '/api/cabinet/murs'), 'les murs, en pleine manche')
  assert.deepEqual(
    murs.lieux.map(l => l.id),
    [(de.tirages[0] as EpingleTiree).lieu.id],
  )
  sansSesNombres(t, murs, 'les murs')
  // Le décalage ne se rejoue d'aucune graine : ni de ce que la page connaît — son profil, sa partie, le rang du geste —, ni du
  // secret de la partie. Il vient du hasard du tireur, au serveur, et le plan figé le garde.
  for (const graine of [`${id}:${v0.id}`, v0.id, id, '', d.graine, `${d.graine}:eclairer:${v0.rang}`]) {
    assert.notDeepEqual(epingleTiree(t.lieu, hasardDe(graine)).decalage, t.decalage, `rejoué de « ${graine} »`)
  }
  // Le verdict : la révélation dit le lieu.
  const revelee = ok(await jouer(b, eva, eclairee, { quoi: 'repondre', manche: 0, reponse: { epingle: { lat: t.lieu.lat, lon: t.lieu.lon } } }), 'planter')
  jamais(d, revelee, 'révélée')
  assert.deepEqual([(revelee.revelation?.corps as EpingleRevelee).lieu.commune, (revelee.revelation?.corps as EpingleRevelee).savais], [t.lieu.commune, t.lieu.savais])
})

test('les Indices : ni la personne, ni ses clés, ni les indices encore cachés, ni son « Le savais-tu ? » avant le verdict — ni la rechange de Changer', async () => {
  const ugo = await inscrireProfil(b.banc.url, 'ugo', 'Ugo')
  /** Ce qu'une fiche garde jusqu'à son verdict : ses indices encore cachés, son savais-tu. */
  const sansSesCaches = (t: IndicesTires, vus: number, x: unknown, ou: string) => {
    const s = texte(x)
    for (const cache of t.fiche.indices.slice(vus)) assert.ok(!s.includes(cache), `${ou} : un indice encore caché`)
    assert.ok(!s.includes(t.fiche.savais), `${ou} : son « Le savais-tu ? »`)
  }
  /** Ce que la manche des Indices garde jusqu'à son verdict : la fiche, sauf les indices déjà vus. */
  const sansLaFiche = (t: IndicesTires, vus: number, x: unknown, ou: string) => {
    const s = texte(x)
    // En mots entiers, comme le juge du contenu les cherche dans les indices — dans les seuls textes, comme à l'Épingle.
    const lu = textesDe(x).join('\n')
    for (const dit of [t.fiche.reponse, ...t.fiche.cles]) assert.ok(!ecritDans(lu, dit), `${ou} : « ${dit} »`)
    sansSesCaches(t, vus, x, ou)
    assert.doesNotMatch(s, /"(fiche|reponse|cles|savais)":/, `${ou} : un champ de la fiche`)
  }
  const v0 = ok(await commencer(b, ugo, { origine: 'libre', jeu: 'indices', carte: 'echange' }), 'commencer sous l’Échange')
  const d = departEnBase(b.fichier, v0.id)
  const t = d.tirages[0] as IndicesTires
  const rechange = d.tirages[3] as IndicesTires
  assert.ok(rechange, 'une rechange au plan')
  const plus = ok(await jouer(b, ugo, v0, { quoi: 'indice', manche: 0 }), 'un indice de plus')
  const faux = ok(await jouer(b, ugo, plus, { quoi: 'nom', manche: 0, texte: 'Personne Inconnue' }), 'un nom faux')
  for (const [ou, x, vus] of [
    ['le départ', v0, 1],
    ['la page', ok(await laPage(b, ugo), 'la page').enCours!, 3],
    ['un indice de plus', plus, 2],
    ['un nom faux', faux, 3],
  ] as const) {
    jamais(d, x, ou)
    sansLaFiche(t, vus, x, ou)
    // Une fiche peut nommer la personne d'une autre : la rechange se cherche par ce qu'elle-même montrerait.
    sansSesCaches(rechange, 0, x, `${ou}, la rechange`)
    assert.equal((x.enCours as IndicesMontres).indices.length, vus, ou)
  }
  // Le verdict dit la personne et ses cinq indices.
  const trouve = ok(await jouer(b, ugo, faux, { quoi: 'nom', manche: 0, texte: t.fiche.reponse }), 'la réponse')
  jamais(d, trouve, 'révélée')
  assert.deepEqual([(trouve.revelation?.corps as IndicesReveles).reponse, (trouve.revelation?.corps as IndicesReveles).indices], [t.fiche.reponse, [...t.fiche.indices]])
  sansSesCaches(rechange, 0, trouve, 'révélée, la rechange')
})

test('la Réplique : ni qui l’a dite avant « Qui l’a dit ? », ni sa source, ni son « Le savais-tu ? », ni si le mot choisi était le bon, ni ce qu’Éclairer effacera', async () => {
  const [zoe, max] = [await inscrireProfil(b.banc.url, 'zoe', 'Zoé'), await inscrireProfil(b.banc.url, 'max', 'Max')]
  /** Ce que la manche de la Réplique garde jusqu'à sa révélation : les rangs des bonnes, l'ordre des effacés, la source, le savais-tu. */
  const sansLaReponse = (t: RepliqueTiree, x: unknown, ou: string) => {
    const s = texte(x)
    assert.doesNotMatch(s, /"(replique|bonMot|bonneQui|ordreDesEffaces|leurres|qui|autres|source|savais)":/, `${ou} : un champ de la réponse`)
    assert.ok(!s.includes(t.replique.source) && !s.includes(t.replique.savais), `${ou} : sa source, son savais-tu`)
  }
  // Au mot : ni qui l'a dite, ni les deux autres — les noms attendent « Qui l'a dit ? ».
  const v0 = ok(await commencer(b, zoe, { origine: 'libre', jeu: 'replique', carte: 'coup-d-oeil' }), 'commencer')
  const d = departEnBase(b.fichier, v0.id)
  const t = d.tirages[0] as RepliqueTiree
  const eclairee = ok(await jouer(b, zoe, v0, { quoi: 'eclairer', manche: 0 }), 'éclairer')
  for (const [ou, x] of [
    ['le départ', v0],
    ['éclairée', eclairee],
    ['la page', ok(await laPage(b, zoe), 'la page').enCours!],
  ] as const) {
    jamais(d, x, ou)
    sansLaReponse(t, x, ou)
    for (const nom of t.personnes) assert.ok(!texte(x).includes(`"${nom}"`), `${ou} : « ${nom} » avant « Qui l’a dit ? »`)
  }
  // Éclairer efface un mauvais mot, celui que le tirage a figé — jamais le bon.
  const effaces = (eclairee.enCours as RepliqueMontreeAuMot).mots.flatMap((m, k) => (m.efface ? [k] : []))
  assert.deepEqual(effaces, [t.ordreDesEffaces[0].find(k => k !== t.bonMot)])
  // Le bon mot ou un autre : deux réponses de la même forme — rien ne dit lequel était le bon avant la révélation.
  const autre = ok(await commencer(b, max, { origine: 'libre', jeu: 'replique', carte: null }), 'une autre partie')
  const ta = departEnBase(b.fichier, autre.id).tirages[0] as RepliqueTiree
  const bon = ok(await jouer(b, zoe, eclairee, { quoi: 'mot', manche: 0, choix: t.bonMot }), 'le bon mot')
  const leurre = ok(await jouer(b, max, autre, { quoi: 'mot', manche: 0, choix: (ta.bonMot + 1) % ta.mots.length }), 'un leurre')
  // La carte-bonus de l'une n'est pas celle de l'autre : la forme se compare sans elle.
  const sansCarte = (x: VueDeLaPartie) => ({ ...x, carte: null, pouvoir: undefined })
  assert.equal(formeDe(sansCarte(bon)), formeDe(sansCarte(leurre)))
  for (const [ou, x, tt] of [
    ['le bon mot', bon, t],
    ['un leurre', leurre, ta],
  ] as const) {
    sansLaReponse(tt, x, ou)
    assert.deepEqual([x.manches[0].etoiles, x.total], [null, 0], `${ou} : aucune étoile avant la révélation`)
  }
  // La révélation dit tout : le mot, qui l'a dite, d'où.
  const revelee = ok(await jouer(b, zoe, bon, { quoi: 'repondre', manche: 0, reponse: { replique: { qui: t.bonneQui } } }), 'qui l’a dite')
  jamais(d, revelee, 'révélée')
  const r = revelee.revelation?.corps as RepliqueRevelee
  assert.deepEqual([r.qui, r.source, r.savais], [t.replique.qui, t.replique.source, t.replique.savais])
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
  if (p.depart.cible !== null) assert.ok(!nomme(vue, p.depart.cible), 'la visite manquée nomme l’œuvre visée')
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
    assert.ok(!nomme(page.visite, cible), `la visite nomme ${cible}`)
    assert.ok(!nomme(v, cible), `la partie de la visite nomme ${cible}`)
    assert.ok(!nomme(page.enCours, cible), `la partie en cours nomme ${cible}`)
  }
  // L'échange dit le jeu qu'il donnerait (la tablée du 26 octobre 2026) : un jeu, jamais une œuvre — l'œuvre de la case reste.
  assert.ok(page.visite.echange.possible && JEUX_PRETS.includes(page.visite.echange.jeu), JSON.stringify(page.visite.echange))
  assert.deepEqual(Object.keys(page.visite.echange).sort(), ['jeu', 'possible'])
})

test('le jeu de l’échange ne dit rien des œuvres visées : d’un musée à l’autre, leurs visites visent d’autres œuvres, et promettent le même jeu', () => {
  // Il est l'élément suivant de l'ordre des jeux du jour, dont la page voit déjà les trois premiers, tiré d'un autre fil que les
  // œuvres visées (`:visite:` contre `:cibles:`, `musee.ts`) : ce que le musée possède change les œuvres, jamais ce jeu.
  const jour = '2026-10-24'
  const minuit = Date.UTC(2026, 9, 23, 22, 0, 0)
  const ligne = (oeuvre: string): LigneDOeuvre => ({ oeuvre, origine: 'partie', gagneeLe: minuit - 3_600_000, saison: null, serieId: null, prix: null, doreeLe: null, dorure: null, prixDorure: null, serieDoree: null })
  const neuf = museeDe({ jour })
  // Il a déjà tout le Vestibule et la moitié du reste : les œuvres que sa visite peut viser ne sont plus les mêmes.
  const avance = museeDe({ jour, oeuvres: OEUVRES.filter((o, k) => o.salle === 'vestibule' || k % 2 === 0).map(o => ligne(o.cle)) })
  let differentes = 0
  for (let n = 0; n < 40; n++) {
    const o = { graine: `secret-${n}`, jour, minuit, jeux: JEUX_PRETS }
    const [a, b2] = [visiteDuJour(neuf, o), visiteDuJour(avance, o)]
    assert.deepEqual(a.cases.map(c => c.jeu), b2.cases.map(c => c.jeu), 'les mêmes jeux')
    if (JSON.stringify(a.cases.map(c => c.cible)) !== JSON.stringify(b2.cases.map(c => c.cible))) differentes++
    assert.equal(jeuDeLEchange(neuf, a, o), jeuDeLEchange(avance, b2, o), `secret-${n}`)
  }
  assert.ok(differentes > 30, `des visites aux œuvres différentes : ${differentes} sur 40`)
})

test('« Retenter » vise la case : ni la page, ni le bilan, ni la retente ne nomment l’œuvre, et une retente qui la nomme se refuse pareil, quelle qu’elle soit', async () => {
  const lia = await inscrireProfil(b.banc.url, 'lia', 'Lia')
  const id = (await lire(b, lia, '/api/joueur/moi?leger')).corps.profile.id as string
  const v = ok(await commencer(b, lia, { origine: 'visite', case: 0, carte: null }), 'la visite')
  const d = departEnBase(b.fichier, v.id)
  assert.ok(d.cible, 'une œuvre à gagner')
  const manquee = ok(await jouer(b, lia, v, { quoi: 'quitter' }), 'quitter : manquée')
  assert.deepEqual(manquee.bilan?.retenter, { possible: true }, 'le bilan propose de la retenter')
  const page = ok(await laPage(b, lia), 'la page')
  assert.deepEqual(page.visite.cases[0].retenter, { possible: true }, 'la case aussi')
  // Une retente forgée qui nomme une œuvre — la visée, une autre, avec ou sans carte-bonus, une carte qu'il n'a pas — : les mêmes
  // mots pour toutes, et rien de pris. L'ordre des refus désignait la visée parmi les trois candidates de la visite.
  const figee = enBase(b.fichier, db => JSON.parse((db.prepare('SELECT visites FROM cabinet_profils WHERE profile_id = ?').get(id) as { visites: string }).visites)) as {
    cases: { cible: string | null }[]
  }[]
  const candidates = [...new Set([d.cible, ...figee[0].cases.map(c => c.cible), 'lecon', 'bastion'].filter((c): c is string => c !== null))]
  const refus = new Set<string>()
  for (const oeuvre of candidates)
    for (const carte of [null, 'coup-d-oeil', 'lg:phenix', 42]) {
      const r = await poster(b, lia, '/api/cabinet/partie', { origine: 'chasse', oeuvre, carte, retente: true })
      assert.equal(r.status, 400, `${oeuvre}, ${carte}`)
      refus.add((r.corps as { error: string }).error)
    }
  assert.deepEqual([...refus], ['Choisis une porte de la tour, une partie de la visite, une chasse ou un jeu libre'])
  assert.equal(ok(await laPage(b, lia), 'la page').chasses.restent, 2, 'aucune chasse prise')
  // La retente par la case : partie, son plan garde l'œuvre ; la vue, jamais.
  const retente = ok(await commencer(b, lia, { origine: 'chasse', case: 0, retente: true, carte: null }), 'retenter')
  assert.equal(departEnBase(b.fichier, retente.id).cible, d.cible)
  const finie = ok(await jouer(b, lia, retente, { quoi: 'quitter' }), 'quitter la retente')
  const dr = departEnBase(b.fichier, retente.id)
  // Le musée nomme ses 84 œuvres : c'est la visite, ses parties et leurs bilans qui ne nomment pas la sienne.
  for (const [ou, x, depart] of [
    ['le bilan de la visite', manquee, d],
    ['la visite de la page', page.visite, d],
    ['la retente', retente, dr],
    ['sa fin', finie, dr],
    ['la visite de la page d’après', ok(await laPage(b, lia), 'la page d’après').visite, dr],
  ] as const) {
    jamais(depart, x, ou)
    assert.ok(!nomme(x, d.cible), `${ou} nomme l’œuvre visée`)
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
  if (d.cible !== null) assert.ok(!nomme(relue, d.cible), '« Mes réponses » nomme l’œuvre visée')
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
    assert.ok(!nomme(apres.visite, cible), `la visite échangée nomme ${cible}`)
  }
})
