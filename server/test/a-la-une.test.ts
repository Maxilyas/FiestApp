// « À la une », le bandeau de l'accueil d'un profil (`shared/aLaUne.ts`,
// `client/src/components/ALaUne.tsx`). Le 15 octobre 2026, deux questions du
// propriétaire : « c'est fait exprès qu'il ne puisse pas être slidé ? » et
// « est-ce qu'il y a une rotation 1 compagnon / 1 thème / 1 carte de fond ? ».
// Le bandeau tirait deux compagnons pour un thème, sans aucun fond, et ne
// se touchait que pour aller à la boutique : il se glisse désormais du doigt,
// ses points mènent chacun à son objet, et il tire un objet de chaque sorte.
//
// Pas de serveur : le tirage est pur, et le bandeau se rend en HTML.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { aLaUne, A_LA_UNE_MAX } from '../../shared/aLaUne'
import { COMPAGNONS } from '../../shared/compagnons'
import { FONDS_EN_BOUTIQUE, PRIX_D_UN_FOND } from '../../shared/fonds'
import { THEMES } from '../../shared/themes'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

/** Le 15 octobre : aucun thème de saison en boutique — Halloween arrive le 25. */
const JOUR = '2026-10-15'
const OFFERTS = THEMES.filter(t => t.rarete === 'offert').map(t => t.key)
const TOUS_LES_THEMES = THEMES.map(t => t.key)
const ADOPTES = COMPAGNONS.map(c => ({ compagnon: c.key, rang: 0, justes: 0 }))
const TOUS_LES_FONDS = FONDS_EN_BOUTIQUE.map(f => f.key)

/** Un profil neuf : rien à lui que les thèmes offerts, et de quoi s'offrir un fond. */
const NEUF = { confettis: { gagnes: 300, depenses: 0, solde: 300 }, possedes: OFFERTS, porte: null, jour: JOUR }

const rangDe = (liste: readonly { key: string }[], cle: string) => liste.findIndex(x => x.key === cle)

test('un compagnon, un thème, un fond : un de chaque sorte, le même toute la journée, un cran plus loin le lendemain', () => {
  const une = aLaUne(NEUF)
  assert.deepEqual(
    une.map(u => u.sorte),
    ['compagnon', 'theme', 'fond'],
  )
  assert.deepEqual(aLaUne(NEUF), une, 'le même toute la journée, sur tous ses appareils')
  const demain = aLaUne({ ...NEUF, jour: '2026-10-16' })
  assert.deepEqual(
    demain.map(u => u.sorte),
    ['compagnon', 'theme', 'fond'],
  )
  assert.equal(rangDe(COMPAGNONS, demain[0].cle), (rangDe(COMPAGNONS, une[0].cle) + 1) % COMPAGNONS.length)
  assert.equal(rangDe(FONDS_EN_BOUTIQUE, demain[2].cle), (rangDe(FONDS_EN_BOUTIQUE, une[2].cle) + 1) % FONDS_EN_BOUTIQUE.length)
  // Douze jours, douze fonds : chacun passe à la une à son tour.
  const fonds = new Set(Array.from({ length: FONDS_EN_BOUTIQUE.length }, (_, j) => aLaUne({ ...NEUF, jour: `2026-11-${String(j + 1).padStart(2, '0')}` })[2].cle))
  assert.equal(fonds.size, FONDS_EN_BOUTIQUE.length)
})

test('rien de ce qu’il a ; une sorte dont il a tout laisse sa place aux deux autres ; rien du tout s’il a tout', () => {
  // Ses fonds achetés ne reviennent pas : l'accueil les sait (`BoutiqueDuProfil.fondsAchetes`).
  const sauf = (cle: string) => TOUS_LES_FONDS.filter(f => f !== cle)
  assert.deepEqual(
    aLaUne({ ...NEUF, fondsAchetes: sauf('vitrail') }).filter(u => u.sorte === 'fond'),
    [{ sorte: 'fond', cle: 'vitrail' }],
  )
  // Tous les compagnons adoptés : un thème, un fond, puis un autre thème.
  assert.deepEqual(
    aLaUne({ ...NEUF, compagnons: ADOPTES }).map(u => u.sorte),
    ['theme', 'fond', 'theme'],
  )
  // Tous les fonds achetés : comme avant eux, deux compagnons pour un thème.
  assert.deepEqual(
    aLaUne({ ...NEUF, fondsAchetes: TOUS_LES_FONDS }).map(u => u.sorte),
    ['compagnon', 'theme', 'compagnon'],
  )
  // Plus que des fonds à prendre : trois fonds, tous différents.
  const fonds = aLaUne({ ...NEUF, possedes: TOUS_LES_THEMES, compagnons: ADOPTES })
  assert.equal(fonds.length, A_LA_UNE_MAX)
  assert.ok(fonds.every(u => u.sorte === 'fond'))
  assert.equal(new Set(fonds.map(u => u.cle)).size, A_LA_UNE_MAX)
  assert.deepEqual(aLaUne({ ...NEUF, possedes: TOUS_LES_THEMES, compagnons: ADOPTES, fondsAchetes: TOUS_LES_FONDS }), [])
  // Le trésor ne paraît jamais : il ne se vend pas.
  for (let j = 1; j <= 28; j++) {
    for (const u of aLaUne({ ...NEUF, jour: `2026-02-${String(j).padStart(2, '0')}` })) {
      if (u.sorte === 'fond') assert.ok(TOUS_LES_FONDS.includes(u.cle), u.cle)
    }
  }
})

async function bandeau(boutique: object): Promise<string> {
  const module = await import(new URL('../../client/src/components/ALaUne.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module.BandeauALaUne, { boutique }))
}

test('le bandeau : un lien qui se glisse, ses points en boutons hors du lien, la carte d’un fond penchée', async () => {
  const html = await bandeau(NEUF)
  const premier = aLaUne(NEUF)[0]
  // Sa teinte sur le cadre, que partagent l'affiche et ses points.
  assert.match(html, new RegExp(`^<div class="une-cadre une-compagnon une-${premier.cle}">`))
  // Glissé à la souris, un lien partait en glisser-déposer de son adresse.
  assert.match(html, new RegExp(`<a class="une" href="/boutique#compagnon-${premier.cle}" draggable="false">`))
  // Les points : un bouton par objet, nommé, le premier courant — hors du lien, qu'un bouton dedans aurait suivi.
  const lien = html.slice(html.indexOf('<a '), html.indexOf('</a>'))
  assert.doesNotMatch(lien, /<button/)
  const points = [...html.matchAll(/<button type="button" class="(une-point[^"]*)" aria-label="([^"]+)"( aria-current="true")?>/g)].map(m => ({
    classe: m[1],
    nom: m[2],
    courant: !!m[3],
  }))
  const noms = aLaUne(NEUF).map(u => (u.sorte === 'compagnon' ? COMPAGNONS.find(c => c.key === u.cle)!.nom : u.sorte === 'fond' ? FONDS_EN_BOUTIQUE.find(f => f.key === u.cle)!.nom : THEMES.find(t => t.key === u.cle)!.nom))
  assert.deepEqual(points, [
    { classe: 'une-point une-point-ici', nom: noms[0], courant: true },
    { classe: 'une-point', nom: noms[1], courant: false },
    { classe: 'une-point', nom: noms[2], courant: false },
  ])

  // Un fond des savoirs : sa carte penchée, ce qu'il est et son prix, et sa fiche dépliée au toucher.
  const fond = await bandeau({ ...NEUF, possedes: TOUS_LES_THEMES, compagnons: ADOPTES, fondsAchetes: TOUS_LES_FONDS.filter(f => f !== 'jazz') })
  assert.match(fond, /^<div class="une-cadre une-fond">/)
  assert.match(fond, /<a class="une" href="\/boutique#fond-jazz" draggable="false">/)
  assert.match(fond, /<span class="une-visuel" aria-hidden="true"><span class="une-carte carte-fond fond-jazz"><\/span><\/span>/)
  assert.match(fond, /<b class="une-nom">Le Club de jazz<\/b>/)
  assert.match(fond, new RegExp(`<span class="une-detail">Un fond de carte · 🎊 ${PRIX_D_UN_FOND}</span>`))
  assert.match(fond, /<span class="une-sur">À ta portée<\/span>/, '300 confettis : il peut se l’offrir')
  assert.doesNotMatch(fond, /une-point/, 'un seul objet : pas de points')

  // Tout à lui : pas de bandeau du tout.
  assert.equal(await bandeau({ ...NEUF, possedes: TOUS_LES_THEMES, compagnons: ADOPTES, fondsAchetes: TOUS_LES_FONDS }), '')
})

test('il tourne encore après un geste : une souris posée dessus le retient, le clavier aussi — un doigt levé, jamais', async () => {
  // « Au cas où la personne ne slide pas » (le propriétaire, le 15 octobre 2026) : le
  // défilement s'arrêtait pour de bon au premier geste. Levé, le doigt ne disait pas
  // toujours qu'il partait, et le point touché gardait un focus pris pour celui du clavier.
  const { retenue } = await import(new URL('../../client/src/components/ALaUne.tsx', import.meta.url).href)
  const libre = { souris: false, clavier: false }
  assert.deepEqual(retenue(libre, { quoi: 'entre', pointeur: 'touch' }), libre, 'un doigt ne le retient pas')
  const survole = retenue(libre, { quoi: 'entre', pointeur: 'mouse' })
  assert.deepEqual(survole, { souris: true, clavier: false }, 'une souris posée dessus, si')
  assert.deepEqual(retenue(survole, { quoi: 'sort', pointeur: 'mouse' }), libre)
  assert.deepEqual(retenue(survole, { quoi: 'sort', pointeur: 'touch' }), survole, 'un doigt qui sort ne lâche pas la souris')
  // Un point touché garde le focus, sans `:focus-visible` : il ne le retient pas.
  assert.deepEqual(retenue(libre, { quoi: 'focus', auClavier: false }), libre)
  // Au clavier, si, tant que le focus reste dedans — du lien à ses points.
  const lu = retenue(libre, { quoi: 'focus', auClavier: true })
  assert.deepEqual(lu, { souris: false, clavier: true })
  assert.deepEqual(retenue(lu, { quoi: 'blur', resteDedans: true }), lu)
  assert.deepEqual(retenue(lu, { quoi: 'blur', resteDedans: false }), libre)
})

test('un geste de côté change d’objet ; trop court, ou plus vertical qu’horizontal, il ne fait rien — la page défile', async () => {
  const { pasDuGeste } = await import(new URL('../../client/src/components/ALaUne.tsx', import.meta.url).href)
  assert.equal(pasDuGeste(-60, 5), 1, 'vers la gauche : le suivant')
  assert.equal(pasDuGeste(60, -5), -1, 'vers la droite : le précédent')
  assert.equal(pasDuGeste(-30, 0), 0, 'trop court : il revient à sa place')
  assert.equal(pasDuGeste(-60, 80), 0, 'le doigt descendait : la page défile')
  assert.equal(pasDuGeste(0, 0), 0)
  // Sans `touch-action: pan-y`, le navigateur prenait le geste pour lui ; le bandeau suit le doigt par `translate`.
  const css = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8')
  const regle = css.slice(css.indexOf('.une {'), css.indexOf('}', css.indexOf('.une {')))
  assert.match(regle, /touch-action: pan-y/)
  assert.match(regle, /translate: var\(--glisse, 0\) 0/)
  // Les points prennent la teinte de l'objet, posée sur le cadre qu'ils partagent avec lui.
  assert.match(css, /\.une-cadre \{ --une-teinte: #d9b56a; position: relative; \}/)
})
