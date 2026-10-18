// L'écran de la carte d'un acte, revu le 18 octobre 2026 à la demande du
// propriétaire : « il faudrait uniquement illuminer la node sur laquelle on
// est et pas tout le chemin. Une fois vaincu ça nous proposerait uniquement
// les nodes de devant que l'on peut atteindre » — et la carte était « un peu
// fouillon et pas trop compréhensible ». Le tracé le plus sûr s'allumait d'ici
// au campement, escales et liens dorés, et l'escale où l'on était se perdait
// parmi elles ; chaque escale portait son nom et sa chance. Rendue ici telle
// que la page la sert (`renderToStaticMarkup`) : seule l'escale où il est
// brille, les escales de devant qu'il peut atteindre sont proposées, le reste
// attend en retrait, sans un mot.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { GARDIEN, carteDUnActe, type CarteDUnActe, type VueDeLExpedition } from '../../shared/expedition'

Object.assign(globalThis, { React, window: { location: { pathname: '/expedition', search: '', hash: '' } } })

/** Une carte de l'acte 1, ses chances posées comme la vue les pose. */
function uneCarte(graine: string): CarteDUnActe {
  const carte = carteDUnActe(graine, 0, [])
  for (const e of carte.escales) if (e.sorte === 'question' || e.sorte === 'elite' || e.sorte === 'source') e.chance = e.sorte === 'elite' ? 0.55 : 0.8
  return carte
}

function uneVue(carte: CarteDUnActe, ici: string | null, trace: string[], permises: string[]): VueDeLExpedition {
  const gardiens = ['lg:kraken', 'lg:dragon', 'lg:oracle'].map(cle => ({ cle, vaincu: false }))
  return { id: 'x', numero: 12_345, acte: 0, gardiens, carte, ici, trace, permises, vies: 3, justes: trace.length, issue: 'en-route', moyen: true, rang: trace.length, equipee: [] }
}

async function rendre(vue: VueDeLExpedition): Promise<string> {
  const page = await import(new URL('../../client/src/views/ExpeditionApp.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const rien = () => {}
  return renderToStaticMarkup(React.createElement(page.CarteDeLActe, { vue, carte: vue.carte, busy: false, erreur: '', onAvancer: rien, onAbandonner: rien, onPartir: rien, onJouer: rien }))
}

/** Les escales de la carte rendue : leurs classes, si elles disent leur nom et leur chance, et leur `aria-pressed`. */
function escales(html: string) {
  return [...html.matchAll(/<button id="escale-([^"]+)" type="button" class="([^"]+)"([^>]*)>([\s\S]*?)<\/button>/g)].map(m => ({
    id: m[1],
    classes: m[2].split(' '),
    presse: /aria-pressed="(true|false)"/.exec(m[3])?.[1],
    nom: m[4].includes('class="exp-etiquette"'),
    chance: m[4].includes('class="exp-sa-chance"'),
  }))
}

const avec = (classe: string, toutes: ReturnType<typeof escales>) => toutes.filter(e => e.classes.includes(classe)).map(e => e.id).sort()

test('au départ, seul le départ brille ; les escales du bas sont proposées, leur nom et leur chance en clair', async () => {
  const carte = uneCarte('carte-ecran:1')
  const html = await rendre(uneVue(carte, null, [], carte.depart))
  const toutes = escales(html)
  assert.match(html, /class="exp-depart exp-ici"/)
  assert.deepEqual(avec('exp-ici', toutes), [])
  assert.deepEqual(avec('exp-a-portee', toutes), [...carte.depart].sort())
  // Plus de tracé qui s'allume : ni escale dorée, ni lien d'or avant qu'il choisisse.
  assert.doesNotMatch(html, /exp-tracee|lien-prevu|lien-choisi|exp-choisie/)
  // Pas la classe de la réponse proposée d'un vrai ou faux : sa règle en faisait des cartes carrées.
  assert.doesNotMatch(html, /exp-proposee/)
  for (const e of toutes) {
    const proposee = carte.depart.includes(e.id)
    assert.equal(e.nom, proposee || e.id === GARDIEN, `${e.id} : son nom, sur les proposées et le gardien seulement`)
    // Le premier étage ne pose que des questions : chacune dit sa chance.
    assert.equal(e.chance, proposee, `${e.id} : sa chance, sur les proposées seulement`)
    assert.equal(e.presse, proposee ? 'false' : undefined, `${e.id} : seule une proposée se choisit`)
  }
  // Le reste attend plus loin, en retrait ; le gardien, le but, non.
  assert.ok(avec('exp-plus-loin', toutes).length > 10)
  assert.ok(!avec('exp-plus-loin', toutes).includes(GARDIEN))
  // D'ici, un trait vers chaque proposée.
  assert.equal(html.match(/class="lien-propose"/g)?.length, carte.depart.length)
  // Rien de choisi : le bouton attend, et le panneau dit comment choisir — et la plus sûre, en mots.
  assert.match(html, /aria-disabled="true">Choisis ton escale/)
  assert.match(html, /Touche l’une des escales entourées/)
  // La plus sûre, un nom qu'un toucher choisit : deux proposées portent souvent le même.
  assert.match(html, /La plus sûre : <button type="button" class="link-inline exp-la-plus-sure">[^<]+<\/button>/)
  // La légende ne s'étale plus sous la carte : elle s'ouvre à la demande.
  assert.doesNotMatch(html, /class="exp-legende"/)
  assert.match(html, /aria-haspopup="dialog"[^>]*><svg[^>]*>[\s\S]*?<\/svg>La carte<\/button>/)
})

test('arrivé à une escale, elle seule brille ; ne sont proposées que celles de devant qu’elle relie', async () => {
  // Une escale du bas qui mène à deux : il a un choix à faire.
  let carte = uneCarte('carte-ecran:2')
  for (let k = 3; !carte.escales.some(e => e.etage === 0 && e.suite.length === 2); k++) carte = uneCarte(`carte-ecran:${k}`)
  const x = carte.escales.find(e => e.etage === 0 && e.suite.length === 2)!
  const html = await rendre(uneVue(carte, x.id, [x.id], x.suite))
  const toutes = escales(html)
  assert.deepEqual(avec('exp-ici', toutes), [x.id])
  assert.doesNotMatch(html, /class="exp-depart exp-ici"/)
  assert.deepEqual(avec('exp-a-portee', toutes), [...x.suite].sort())
  // Les autres escales du bas : hors de sa route, à peine là.
  for (const id of carte.depart.filter(id => id !== x.id)) assert.ok(avec('exp-loin', toutes).includes(id), id)
  // Plus loin sur sa route : en retrait, sans nom ni chance.
  const plusLoin = toutes.filter(e => e.classes.includes('exp-plus-loin'))
  assert.ok(plusLoin.length > 0)
  assert.ok(plusLoin.every(e => !e.nom && !e.chance))
  // Son nom à lui, sous l'escale où il est.
  assert.ok(toutes.find(e => e.id === x.id)!.nom)
  assert.equal(html.match(/class="lien-propose"/g)?.length, 2)
  assert.match(html, /class="lien-fait"/, 'le pas fait, éteint')
  assert.match(html, /aria-disabled="true">Choisis ton escale/)
})

test('au campement, le gardien seul est proposé : choisi d’office, « Affronter »', async () => {
  const carte = uneCarte('carte-ecran:1')
  const camp = carte.escales.find(e => e.sorte === 'campement')!
  const html = await rendre(uneVue(carte, camp.id, [camp.id], [GARDIEN]))
  const gardien = escales(html).find(e => e.id === GARDIEN)!
  assert.ok(gardien.classes.includes('exp-a-portee') && gardien.classes.includes('exp-choisie'), gardien.classes.join(' '))
  assert.equal(gardien.presse, 'true')
  assert.ok(gardien.chance, 'sa chance de le vaincre, au-dessus')
  assert.match(html, /class="lien-propose lien-choisi"/)
  assert.match(html, />Affronter le Kraken<svg/)
  assert.doesNotMatch(html, /aria-disabled/)
})

test('sous L’écholocation, ni chance au-dessus des escales, ni la plus sûre', async () => {
  const carte = uneCarte('carte-ecran:1')
  // La vue retire les chances de la carte : la page n'en a plus aucune.
  for (const e of carte.escales) delete e.chance
  const html = await rendre({ ...uneVue(carte, null, [], carte.depart), sansChances: true })
  assert.doesNotMatch(html, /exp-sa-chance|La plus sûre/)
  assert.match(html, /L’écholocation est posée/)
})
