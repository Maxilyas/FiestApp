// L'invariant 1 au Cabinet de curiosités, jeu par jeu : le plan figé en base
// (`campagne_series.cabinet`, relu à côté du serveur) garde les réponses, et
// rien de ce qui juge n'arrive au téléphone avant le verdict de sa manche —
// ni l'index de la bonne réponse, ni « Le savais-tu ? », ni la seconde
// question du Pari avant « Parier », ni le vrai ou faux d'une affirmation de
// l'Éclair, ni une rechange de « Changer ». Jamais la graine de la partie,
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
  vraiesDe,
  type BancDuCabinet,
} from './cabinet-banc'
import { SECRET_DU_CABINET } from '../src/core/cabinet/tables'
import { vueDeLaPartie } from '../src/core/cabinet/vue'
import type { BilanDUnePartie, DepartDUnePartie } from '../../shared/cabinet/partie'
import type { PariTire } from '../../shared/cabinet/jeux/pari'
import type { EclairTire } from '../../shared/cabinet/jeux/eclair'
import type { QuestionTiree } from '../../shared/cabinet/jeux/outils'

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
