// L'en-tête d'une question de la campagne (`TeteDeLaQuestion`) : sous
// « question 10 », les bonnes réponses. Seul, le numéro se lisait comme un
// score, et chaque vie perdue en route le faisait mentir d'une (un retour de
// joueur du 13 octobre 2026 : « tu es peut-être à 8 en score »). La série, le
// défi de la semaine et un défi entre amis — trois vies chacun — le disent ;
// une révision n'a pas de score, un duel dit déjà le sien sous l'en-tête.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'

Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/campagne', search: '', hash: '', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
})
const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)

/** La dixième question d'une série, deux vies perdues en route : sept bonnes réponses, pas dix. */
const aLaDixieme = (autres: Record<string, unknown> = {}) => ({
  e: 'jeu',
  serie: 'serie-1',
  question: { index: 9, texte: 'Quelle est la capitale du Pérou ?', reponses: ['Lima', 'Quito', 'Bogota', 'Santiago'], categorie: 'Géographie', niveau: 'moyen' },
  vies: 1,
  justes: 7,
  total: 0,
  reponse: null,
  choix: null,
  xp: 0,
  categories: [],
  sujet: null,
  ...autres,
})

/** L'en-tête rendu, ses séparateurs de texte ôtés : « Moyen · question 10 » se lit d'un bloc. */
async function rendu(ecran: Record<string, unknown>): Promise<string> {
  const { TeteDeLaQuestion } = await import(client('views/CampagneApp.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(TeteDeLaQuestion, { ecran })).replace(/<!-- -->/g, '')
}

/** Ce qu'on y lit : une espace insécable se lit comme une autre. Où le libellé peut se couper, c'est `morceaux`. */
const enTete = async (ecran: Record<string, unknown>) => (await rendu(ecran)).replace(/\u00a0/g, ' ')

const libelle = (html: string) => html.match(/<span class="label">([^<]*)<\/span>/)![1]

/** Le libellé découpé là où le navigateur peut passer à la ligne : à ses espaces ordinaires — une insécable tient ses deux voisins. */
const morceaux = (html: string) => libelle(html).split(' ')

const compte = (html: string) => html.match(/<span class="campagne-bonnes"><b[^>]*>(\d+)<\/b>([^<]*)<\/span>/)

test('à la dixième question, deux vies perdues : « question 10 », et dessous « 7 bonnes réponses »', async () => {
  const html = await enTete(aLaDixieme())
  assert.match(html, /<span class="label">Moyen · question 10<\/span>/)
  const lu = compte(html)
  assert.ok(lu, 'la série dit ses bonnes réponses')
  assert.equal(`${lu[1]}${lu[2]}`, '7 bonnes réponses')
  assert.match(html, /aria-label="1 vie sur 3"/, 'ses vies restent au bout')
})

test('le compte s’accorde : « 0 bonne réponse », « 1 bonne réponse », « 2 bonnes réponses »', async () => {
  const dit = async (justes: number) => {
    const lu = compte(await enTete(aLaDixieme({ justes })))
    return lu && `${lu[1]}${lu[2]}`
  }
  // À la première question aussi : la ligne est là d'emblée, elle ne fait pas sauter la question en paraissant.
  assert.equal(await dit(0), '0 bonne réponse')
  assert.equal(await dit(1), '1 bonne réponse')
  assert.equal(await dit(2), '2 bonnes réponses')
})

test('le défi de la semaine et le défi entre amis sont des séries : ils disent leurs bonnes réponses', async () => {
  const defi = await enTete(aLaDixieme({ defi: true }))
  assert.match(defi, /<span class="label">Le défi · Moyen · question 10<\/span>/)
  assert.equal(compte(defi)?.[1], '7')
  const entreAmis = await enTete(aLaDixieme({ defi: true, duel: 'K7M2QX' }))
  assert.match(entreAmis, /<span class="label">Défi entre amis · Moyen · question 10<\/span>/)
  assert.equal(compte(entreAmis)?.[1], '7')
})

test('le compte bat à la révélation d’une bonne réponse, pas d’une faute ni avant de répondre', async () => {
  const bat = (html: string) => /<b class="campagne-bonne-de-plus">/.test(html)
  assert.equal(bat(await enTete(aLaDixieme())), false, 'avant la réponse')
  const reponse = { juste: true, bonne: 0, anecdote: null, vies: 1, justes: 8, finie: false, xp: 5 }
  // La page recopie le compte de la réponse dans l'écran (`repondre`) : c'est lui que l'en-tête lit.
  const juste = await enTete(aLaDixieme({ reponse, choix: 0, justes: 8 }))
  assert.equal(bat(juste), true, 'une bonne réponse le fait battre')
  assert.equal(compte(juste)?.[1], '8')
  assert.equal(bat(await enTete(aLaDixieme({ reponse: { ...reponse, juste: false, bonne: 1, vies: 0, justes: 7, finie: true }, choix: 0, vies: 0 }))), false, 'une faute non')
})

test('une révision n’a pas de score, un duel dit le sien sous l’en-tête : ni l’un ni l’autre n’y compte ses bonnes réponses', async () => {
  const revision = await enTete(aLaDixieme({ revision: true, total: 10, vies: 3, question: { ...aLaDixieme().question, index: 2 } }))
  assert.match(revision, /<span class="label">Révision · question 3 sur 10<\/span>/)
  assert.doesNotMatch(revision, /campagne-bonnes|bonnes? réponse/)
  const adversaire = { nom: 'Bérénice', avatar: '🦉' }
  const rencontre = await enTete(aLaDixieme({ rencontre: { adversaire, sesJustes: 6 } }))
  assert.match(rencontre, /<span class="label">Contre Bérénice · question 10<\/span>/)
  assert.doesNotMatch(rencontre, /campagne-bonnes/)
  const contre = await enTete(aLaDixieme({ defi: true, duel: 'K7M2QX', contre: { ...adversaire, aDejaJoue: true } }))
  assert.match(contre, /<span class="label">Contre Bérénice · question 10<\/span>/)
  assert.doesNotMatch(contre, /campagne-bonnes/)
})

test('au téléphone, le numéro de la question ne reste jamais seul sur sa ligne, et le « · » n’en commence jamais une', async () => {
  // En 360 × 640, « Contre Automate · question 1 » passait à la ligne à gauche des cœurs, et y laissait le « 1 » seul ;
  // contre Tom, il tenait sur une. Coupé, il se lit « Contre Automate · », puis « question 1 ».
  const premiere = { ...aLaDixieme().question, index: 0 }
  const enTetes: [string, Record<string, unknown>, string][] = [
    ['le dé', aLaDixieme({ question: premiere, rencontre: { adversaire: { nom: 'Automate', avatar: '🤖', simule: true }, sesJustes: 0 } }), 'Contre Automate · question 1'],
    ['un duel contre Tom', aLaDixieme({ defi: true, duel: 'K7M2QX', contre: { nom: 'Tom', avatar: '🐻' } }), 'Contre Tom · question 10'],
    ['la série', aLaDixieme(), 'Moyen · question 10'],
    ['le défi', aLaDixieme({ defi: true }), 'Le défi · Moyen · question 10'],
    ['un défi entre amis', aLaDixieme({ defi: true, duel: 'K7M2QX' }), 'Défi entre amis · Moyen · question 10'],
    ['une révision', aLaDixieme({ revision: true, total: 10, vies: 3, question: { ...premiere, index: 2 } }), 'Révision · question 3 sur 10'],
  ]
  for (const [quoi, ecran, lu] of enTetes) {
    const html = await rendu(ecran)
    const coupe = morceaux(html)
    const seul = coupe.find(m => /^\d+$/.test(m))
    assert.equal(seul, undefined, `${quoi} : « ${coupe.join(' | ')} » peut laisser le ${seul} seul sur sa ligne`)
    assert.ok(!coupe.some(m => m.startsWith('·')), `${quoi} : « ${coupe.join(' | ')} » peut commencer une ligne par « · »`)
    // Le texte ne change pas : ce qu'on lit reste le même, seules ses coupures se choisissent.
    assert.equal(libelle(await enTete(ecran)), lu, `${quoi} : le libellé se lit comme avant`)
  }
})
