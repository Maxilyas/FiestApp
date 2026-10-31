// La tour à l'écran (`client/src/views/cabinet/Tour.tsx`), rendue en HTML
// d'une vraie page du serveur : l'étage à jouer et ses portes — chacune dit ce
// qu'elle donne, l'œuvre nommée, son jeu et son seuil —, les cœurs d'une montée
// en route et ce que l'étage d'avant a fait, la liste des étages qui double le
// dessin, le but en trois images à l'arrivée. La 3D ne descend qu'à la demande :
// le fichier de la tour ne l'importe qu'en type. Et l'annonce d'une porte, la
// carte-bonus figée après le premier étage, les adresses des écrans.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { inscrireProfil } from './banc'
import { bancDuCabinet, commencer, fermerLesMagasins, jouer, laPage, ok } from './cabinet-banc'
import { COEURS_D_UNE_MONTEE } from '../../shared/cabinet/bareme'
import { ETAGES_DE_LA_TOUR, ORDRE_DE_LA_TOUR } from '../../shared/cabinet/montee'
import { oeuvre } from '../../shared/cabinet/oeuvres'
import { salle } from '../../shared/cabinet/salles'
import { JEUX } from '../../shared/cabinet/jeux/regle'
import type { PageDuCabinet } from '../../shared/cabinet/vues'

// Le client compile son JSX pour un `React` global, et `state.ts` lit son adresse à l'import : posés avant tout composant.
Object.assign(globalThis, { React, window: { location: { pathname: '/cabinet', search: '', hash: '', origin: 'http://banc' }, addEventListener: () => {} } })

after(fermerLesMagasins)

const client = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/src')
const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href

async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(url(`${fichier}.tsx`))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}
const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/⁠/g, '')
    .replace(/[  ]/g, ' ')
    .replace(/\s+/g, ' ')
const rien = () => {}

test('la tour à l’arrivée : le but en trois images, l’étage à jouer, ses portes et ce qu’elles donnent, les étages en liste', async () => {
  const b = await bancDuCabinet()
  try {
    const cookie = await inscrireProfil(b.banc.url, 'ema', 'Ema')
    const page = ok(await laPage(b, cookie), 'la page')
    const html = await rendu('views/cabinet/Tour', 'Tour', { page, onPorte: rien, onReprendre: rien, onRegles: rien })
    const t = texte(html)
    assert.match(t, /La tour/)
    assert.match(t, new RegExp(`Étage 1 · ${salle(ORDRE_DE_LA_TOUR[0])!.nom} · choisis ta porte`))
    for (const p of page.tour.aJouer!.portes) {
      // Une porte dit ce qu'elle donne — l'œuvre nommée, sa rareté en mots —, son jeu et les étoiles qui l'ouvrent.
      if (p.oeuvre) assert.match(t, new RegExp(oeuvre(p.oeuvre)!.nom))
      else assert.match(t, p.butin === 'coeur' ? /Un cœur de plus/ : /Les étoiles doublées/)
      assert.match(t, new RegExp(`${JEUX[p.jeu].nom} · ${p.seuil} ★ sur 9`))
    }
    assert.ok(page.tour.aJouer!.portes.some(p => p.oeuvre && html.includes('/cartes/')), 'la porte d’une œuvre en montre la peinture')
    // Sans WebGL — ici, le rendu sans navigateur —, la liste des étages tient lieu de dessin, du sommet au Vestibule.
    const liste = /<ol class="cab-tour-etages"[^>]*>([\s\S]*?)<\/ol>/.exec(html)
    assert.ok(liste, 'la liste des étages se voit sans la 3D')
    assert.equal(liste[1].match(/<li/g)?.length, ETAGES_DE_LA_TOUR)
    assert.ok(!html.includes('<canvas'), 'la 3D ne se dessine qu’au navigateur, à la demande')
    // « On ne sait pas à quoi sert le jeu » (le propriétaire, le 31 octobre 2026) : le but en trois images et trois mots — la
    // porte, l'œuvre qu'une porte de l'étage garde, peinte, le gardien de sa salle —, et ce qu'il devient, en une ligne.
    const but = /<div class="cab-tour-but">.*?<\/div>/.exec(html)?.[0] ?? ''
    assert.match(texte(but), /Ouvre Gagne Réveille Chaque gardien réveillé devient ton avatar légendaire\./)
    const garde = page.tour.aJouer!.portes.find(p => p.oeuvre)?.oeuvre
    if (garde) assert.match(but, new RegExp(`<img[^>]*src="/cartes/${garde}-240\\.`))
    // Le titre sur la nuit, son rond des règles ; ce qu'il possède vit au musée — en surimpression sur la scène, le compte des œuvres
    // passait sur le nom d'un étage. Le reste du Cabinet est dans la barre (`Barre.tsx`), plus en trois liens au bas de la tour.
    assert.match(html, /<button type="button" class="cab-tour-aide" aria-label="Comment ça marche \?">/)
    assert.doesNotMatch(t, /œuvres? sur \d/)
    assert.doesNotMatch(html, /cab-tour-annexes|cab-tour-compte/)
    assert.doesNotMatch(t, /♥/, 'pas de cœurs avant de monter')

    // Une porte fermée : les cœurs, ce que l'étage d'avant a fait, l'étage suivant.
    const a = page.tour.aJouer!
    const p = a.portes[0]
    const v = ok(await commencer(b, cookie, { origine: 'montee', n: a.n, etage: a.etage, porte: p.porte, jeu: p.jeu, oeuvre: p.oeuvre, carte: null }), 'la porte')
    // Une porte qui se joue : la tour dit de la reprendre, sans proposer d'autre porte.
    const pendant = ok(await laPage(b, cookie), 'la page pendant la partie')
    assert.equal(pendant.tour.aJouer, null)
    const enCours = texte(await rendu('views/cabinet/Tour', 'Tour', { page: pendant, onPorte: rien, onReprendre: rien, onRegles: rien }))
    assert.match(enCours, /t’attend/)
    assert.doesNotMatch(enCours, /choisis ta porte/)
    ok(await jouer(b, cookie, v, { quoi: 'quitter' }), 'quitter')
    const apres: PageDuCabinet = ok(await laPage(b, cookie), 'la page après la porte')
    const html2 = await rendu('views/cabinet/Tour', 'Tour', { page: apres, onPorte: rien, onReprendre: rien, onRegles: rien })
    const t2 = texte(html2)
    assert.match(html2, new RegExp(`aria-label="${COEURS_D_UNE_MONTEE - 1}\\s+cœurs\\s+sur\\s+${COEURS_D_UNE_MONTEE}"`), 'les cœurs se disent en mots')
    assert.match(t2, /Étage 1 : la porte est restée fermée, un cœur de moins\./)
    assert.match(t2, new RegExp(`Étage 2 sur ${ETAGES_DE_LA_TOUR}`))
    assert.match(t2, /record : étage 1/)
    // En pleine montée, le but s'est dit : la place va aux cœurs et à l'étage.
    assert.doesNotMatch(html2, /cab-tour-but/)

    // L'annonce d'une porte : l'étage, ce qu'elle promet, son seuil ; après le premier étage, la carte de la montée, sans choix.
    const { annonceDe } = await import(url('views/cabinet/Annonce.tsx'))
    const q = apres.tour.aJouer!.portes.find(x => x.oeuvre) ?? apres.tour.aJouer!.portes[0]
    const demande = { origine: 'montee', n: apres.tour.aJouer!.n, etage: 2, porte: q.porte, jeu: q.jeu, oeuvre: q.oeuvre }
    const annonce = annonceDe(apres, demande)
    assert.equal(annonce.piece, `Étage 2 · ${salle(ORDRE_DE_LA_TOUR[1])!.nom}`)
    assert.equal(annonce.seuil, q.seuil)
    assert.equal(annonce.carteDeLaMontee, null, 'la montée est partie sans carte-bonus : elle la garde')
    if (q.oeuvre) assert.match(annonce.enJeu, new RegExp(`La porte garde ${oeuvre(q.oeuvre)!.nom}`))
    const ecran = texte(await rendu('views/cabinet/Annonce', 'Annonce', { page: apres, demande, carte: 'prudence', busy: false, onCarte: rien, onCommencer: rien, onRetour: rien }))
    assert.match(ecran, /Ta montée garde la carte-bonus choisie au premier étage/)
    assert.doesNotMatch(ecran, /Choisir une (autre )?carte-bonus/, 'pas de choix après le premier étage')
    assert.equal(annonceDe(apres, { ...demande, etage: 1 }), null, 'une porte que la tour ne montre plus')
  } finally {
    await b.banc.close()
  }
})

test('les adresses : la tour sans fragment, le musée sur la sienne ; la 3D ne s’importe qu’à la demande', async () => {
  const { adresseDe, ecranDeLAdresse, titreDeLEcran } = await import(url('views/cabinet/ecrans.ts'))
  assert.deepEqual(ecranDeLAdresse(''), { e: 'tour' })
  assert.deepEqual(ecranDeLAdresse('#musee'), { e: 'musee' })
  assert.deepEqual(ecranDeLAdresse('#inconnu'), { e: 'tour' })
  assert.equal(adresseDe({ e: 'tour' }), '')
  assert.equal(adresseDe({ e: 'musee' }), '#musee')
  assert.match(titreDeLEcran({ e: 'musee' }, null), /^Ton musée · Le Cabinet/)
  // Le fichier de la tour ne tire three.js qu'à la demande : en type ailleurs, sans quoi la 3D descendrait avec toute la page.
  const tour = readFileSync(path.join(client, 'views/cabinet/Tour.tsx'), 'utf8')
  assert.match(tour, /aLaDemande\(\(\) => import\('\.\/TourEn3D'\)\)/)
  assert.match(tour, /import type \{[^}]*\} from '\.\/TourEn3D'/)
  assert.doesNotMatch(tour, /from 'three'/)
})
