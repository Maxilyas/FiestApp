// Le haut des sentiers, en un seul bloc (la remarque du propriétaire du
// 5 octobre 2026 : une bulle pour les vies et une carte pour continuer, il
// voulait un bloc qui explique les sentiers — la piste A de la maquette, avec
// les règles de la piste D) : le sentier qu'on avance en panorama — ses douze
// paliers en lacet, un portrait tous les deux, la couronne du maître au
// bout —, les vies en cœurs, et les règles, en entier tant qu'on débute,
// repliées sous « Comment ça marche ? » ensuite.
//
// Pas de serveur : la carte des sentiers, rendue en HTML.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { BRANCHES, type CleDeBranche } from '../../shared/branches'
import { SEUIL_DES_PALIERS, type EpreuveDeSentier, type EtatDesSentiers, type VieDesSentiers } from '../../shared/sentiers'

/** La règle du seuil, telle que les règles l'écrivent : celle du code, jamais un nombre recopié. */
const REGLE_DU_SEUIL = new RegExp(`${SEUIL_DES_PALIERS} bonnes sur 16 valident un palier`)

Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/campagne', search: '', hash: '#sentiers', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false },
})

type Sentier = { paliers: number; acquis?: number; etoiles?: number[] }
const SANS_ETOILE = Array.from({ length: 13 }, () => 0)

/** L'état des sentiers : sans étoiles dites, chaque palier validé l'a été en jouant, de deux étoiles. */
function etat(par: Partial<Record<CleDeBranche, Sentier>>, vies: Partial<VieDesSentiers> = {}, epreuve: EpreuveDeSentier | null = null): EtatDesSentiers {
  return {
    vies: { jour: 11, reserve: 2, parJour: 12, prix: 25, renouveleesLe: Date.now() + 3_600_000, ...vies },
    sentiers: BRANCHES.map(b => {
      const s = par[b.key]
      const paliers = s?.paliers ?? 0
      return { branche: b.key, paliers, acquis: s?.acquis ?? 0, etoiles: s?.etoiles ?? SANS_ETOILE.map((_, i) => (i < paliers ? 2 : 0)) }
    }),
    epreuve,
  }
}

const page = () => import(new URL('../../client/src/views/Sentiers.tsx', import.meta.url).href)

/** La carte des sentiers entière, le sentier `choisi` d'une tuile montré dans son bloc. */
async function carte(e: EtatDesSentiers, choisi: CleDeBranche | null = null): Promise<string> {
  const module = await page()
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html: string = renderToStaticMarkup(
    React.createElement(module.CarteDesSentiers, { etat: e, onglets: null, erreur: '', choisi, onChoisir: () => {}, onOuvrir: () => {}, onReprendre: () => {}, onVies: () => {} }),
  )
  assert.doesNotMatch(html, /sentiers-vies|sentiers-reprise/, 'plus de bulle des vies ni de carte « Continuer » à côté du bloc')
  assert.equal(compte(html, /class="sentiers-haut[ "]/), 1, 'un seul bloc')
  return html
}

/** Le haut de la carte des sentiers : de son bloc jusqu'aux tuiles. */
async function haut(e: EtatDesSentiers, choisi: CleDeBranche | null = null): Promise<string> {
  const html = await carte(e, choisi)
  return html.slice(html.indexOf('class="sentiers-haut'), html.indexOf('class="sentiers-compte"'))
}

/** Les tuiles d'une carte rendue par sa fonction, sans navigateur : leurs gestes s'appellent à la main. */
function tuiles(el: any): any[] {
  if (!el || typeof el !== 'object') return []
  if (Array.isArray(el)) return el.flatMap(tuiles)
  const ici = typeof el.props?.className === 'string' && el.props.className.startsWith('sentiers-tuile') ? [el] : []
  return [...ici, ...tuiles(el.props?.children)]
}

const compte = (html: string, motif: RegExp) => (html.match(new RegExp(motif.source, 'g')) ?? []).length
const pleins = (html: string) => compte(html, /class="icon coeur" viewBox="0 0 24 24" fill="currentColor"/)
const vides = (html: string) => compte(html, /class="icon coeur" viewBox="0 0 24 24" fill="none"/)

test('le sentier qu’on avance, en panorama : douze paliers, un portrait tous les deux, la couronne au bout', async () => {
  const bloc = await haut(etat({ foret: { paliers: 9 }, mythes: { paliers: 4 } }))
  assert.match(bloc, /La forêt · palier 10 sur 12/)
  assert.match(bloc, /L’ours t’attend/)
  assert.match(bloc, /Valide le palier 10 pour l’ouvrir/)
  assert.match(bloc, /role="img" aria-label="La forêt : 9 paliers validés sur 12, 4 avatars sur 6"/)
  // Chaque palier à son état, et la couronne du maître au bout.
  assert.equal(compte(bloc, /class="pano-etape/), 13)
  assert.equal(compte(bloc, /pano-fait/), 9)
  assert.equal(compte(bloc, /pano-courant/), 1)
  assert.equal(compte(bloc, /pano-avenir/), 3, 'les paliers 11 et 12, et le maître')
  assert.equal(compte(bloc, /pano-maitre/), 1)
  assert.equal(compte(bloc, /class="sentier-portrait"/), 6, 'un portrait tous les deux paliers')
  // Les vies en cœurs : onze pleins sur douze, la réserve à côté.
  assert.deepEqual([pleins(bloc), vides(bloc)], [11, 1])
  assert.match(bloc, /aria-label="11 vies et 2 en réserve aujourd’hui"/)
  assert.match(bloc, />\+2</)
  assert.match(bloc, /Racheter/)
  assert.match(bloc, /Continuer · palier 10/)
  // Neuf paliers gagnés en jouant : il connaît les règles, elles se replient.
  assert.match(bloc, /<details class="pano-regles"><summary>Comment ça marche/)
  assert.doesNotMatch(bloc, /<details[^>]*open/)
})

test('qui débute lit les règles en entier — même avec des paliers repris de ses portraits d’avant', async () => {
  // Deux paliers gagnés en jouant : il débute. Le palier 3 mène au blaireau.
  const debut = await haut(etat({ foret: { paliers: 2 } }))
  assert.match(debut, /Vers le blaireau/)
  assert.match(debut, /Palier 3, puis le blaireau au palier 4/)
  assert.doesNotMatch(debut, /<details/)
  assert.doesNotMatch(debut, /Comment ça marche/)
  for (const regle of [REGLE_DU_SEUIL, /Un avatar tous les deux paliers/, /Un palier raté coûte une vie/, /le maître/]) assert.match(debut, regle)

  // Six paliers repris des portraits d'avant, sans étoile : il n'a encore rien joué ici.
  const repris = await haut(etat({ foret: { paliers: 6, acquis: 6, etoiles: SANS_ETOILE } }))
  assert.match(repris, /Vers le loup/)
  assert.doesNotMatch(repris, /<details/)
  assert.match(repris, REGLE_DU_SEUIL)
})

test('rien de commencé : les règles, les vies, et le geste qui mène aux sentiers', async () => {
  const neuf = await haut(etat({}, { jour: 12, reserve: 0 }))
  assert.match(neuf, /Les sentiers du savoir/)
  assert.equal(compte(neuf, /class="pano-etape/), 0, 'pas de panorama sans sentier')
  for (const regle of [REGLE_DU_SEUIL, /Un avatar tous les deux paliers/, /Un palier raté coûte une vie/, /le maître/]) assert.match(neuf, regle)
  assert.deepEqual([pleins(neuf), vides(neuf)], [12, 0])
  assert.match(neuf, /Choisir mon premier sentier/)
})

test('une épreuve laissée : son sentier en panorama, et la reprendre', async () => {
  const laissee: EpreuveDeSentier = { id: 'e1', branche: 'mythes', palier: 5, rejeu: false, seuil: 12, justes: 4, fausses: 1, total: 16, issue: null, finie: false }
  const bloc = await haut(etat({ mythes: { paliers: 4 }, foret: { paliers: 9 } }, {}, laissee))
  assert.match(bloc, /Les mythologies · palier 5 sur 12/)
  assert.match(bloc, /Ton épreuve t’attend/)
  assert.match(bloc, /4 bonnes sur 5/)
  assert.match(bloc, /Reprendre l’épreuve/)
  assert.equal(compte(bloc, /pano-fait/), 4)
})

test('plus de vies : les cœurs vides, et de quoi en racheter', async () => {
  const bloc = await haut(etat({ foret: { paliers: 9 } }, { jour: 0, reserve: 0 }))
  assert.deepEqual([pleins(bloc), vides(bloc)], [0, 12])
  assert.match(bloc, /Plus de vies : elles reviennent à minuit/)
  assert.match(bloc, /Racheter/)
})

// Une tuile touchée entrait tout droit dans son sentier : le propriétaire
// voulait le voir d'abord dans le bloc (le 5 octobre 2026). Le premier
// toucher le montre, le second — ou le bouton du bloc — y entre.
test('toucher une tuile montre son sentier dans le bloc, sans y entrer — un second toucher y entre', async () => {
  const module = await page()
  const gestes: string[] = []
  const tuile = (choisi: CleDeBranche | null, nom: string) =>
    tuiles(
      module.CarteDesSentiers({
        etat: etat({ foret: { paliers: 9 } }),
        onglets: null,
        erreur: '',
        choisi,
        onChoisir: (b: string) => gestes.push(`montrer ${b}`),
        onOuvrir: (b: string) => gestes.push(`entrer ${b}`),
        onReprendre: () => {},
        onVies: () => {},
      }),
    ).find(t => String(t.props['aria-label']).startsWith(nom))
  tuile(null, 'Les océans').props.onClick()
  tuile('oceans', 'Les océans').props.onClick()
  // La forêt, que le bloc montre d'office — le sentier qu'on avance : elle y est déjà.
  tuile(null, 'La forêt').props.onClick()
  assert.deepEqual(gestes, ['montrer oceans', 'entrer oceans', 'entrer foret'])
})

test('le bloc montre le sentier choisi : son panorama, sa tuile marquée, et le geste qui y entre', async () => {
  const html = await carte(etat({ foret: { paliers: 9 } }), 'oceans')
  const bloc = html.slice(html.indexOf('class="sentiers-haut'), html.indexOf('class="sentiers-compte"'))
  assert.match(bloc, /Les océans · palier 1 sur 12/)
  assert.match(bloc, /Vers l’hippocampe/)
  assert.match(bloc, /Palier 1, puis l’hippocampe au palier 2/)
  assert.equal(compte(bloc, /pano-courant/), 1)
  assert.equal(compte(bloc, /pano-fait/), 0)
  assert.match(bloc, /Commencer le sentier/)
  assert.match(html, /aria-label="Les océans[^"]*" aria-pressed="true"/)
  assert.match(html, /aria-label="La forêt[^"]*" aria-pressed="false"/)
  // Sans choix, la tuile marquée est celle du sentier que le bloc montre d'office.
  const dOffice = await carte(etat({ foret: { paliers: 9 } }))
  assert.match(dOffice, /aria-label="La forêt[^"]*" aria-pressed="true"/)
  assert.equal(compte(dOffice, /aria-pressed="true"/), 1)
})

test('un sentier au sommet propose son maître ; un sentier de maître se revoit', async () => {
  const sommet = await haut(etat({ stade: { paliers: 12 }, foret: { paliers: 3 } }), 'stade')
  assert.match(sommet, /Le stade · le palier de maître/)
  assert.match(sommet, /Le maître t’attend/)
  assert.match(sommet, /Tenter le maître/)
  const maitre = await haut(etat({ stade: { paliers: 13 } }), 'stade')
  assert.match(maitre, /Le stade · sentier achevé/)
  assert.match(maitre, /Maître du stade/)
  assert.match(maitre, /Voir le sentier/)
  assert.equal(compte(maitre, /pano-courant/), 0)
  assert.equal(compte(maitre, /pano-fait/), 13)
})

// Dans un sentier, « Le palier 8 ouvre le loup » vivait dans l'en-tête collé
// en haut : il se posait sur le chemin — son tracé, la jauge, l'accolade
// passaient dessous (la remarque du propriétaire du 5 octobre 2026). L'info
// est maintenant sur le palier à jouer.
test('dans un sentier, ce que le palier à jouer ouvre se lit sur lui, plus dans l’en-tête', async () => {
  const module = await page()
  const { renderToStaticMarkup } = await import('react-dom/server')
  const sentier = (paliers: number): string => {
    const e = etat({ foret: { paliers } })
    return renderToStaticMarkup(
      React.createElement(module.SentierVu, {
        sentier: e.sentiers.find(s => s.branche === 'foret'),
        etat: e,
        busy: false,
        erreur: '',
        onRetour: () => {},
        onJouer: () => {},
        onReprendre: () => {},
        onVies: () => {},
      }),
    )
  }
  const loup = sentier(7)
  assert.doesNotMatch(loup, /sentier-prochain/, 'plus de bulle dans l’en-tête')
  assert.match(loup, /<b>Le loup<\/b><span>palier 8 · à jouer<\/span>/)
  // Un palier sans portrait dit lequel l'attend après lui.
  assert.match(sentier(8), /<b>Palier 9<\/b><span>puis l’ours au palier 10<\/span>/)
  assert.match(sentier(12), /<b>Palier de maître<\/b><span>16 expertes · un titre<\/span>/)
})

test('le palier à jouer bat doucement — et se tient tranquille si le système demande moins de mouvement', () => {
  const css = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8')
  assert.match(css, /\.pano-courant[^{]*\{[^}]*animation:/)
  const calmes = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([^@]*)\}/g)].map(m => m[1]).join('\n')
  assert.match(calmes, /\.pano-courant[^{]*\{[^}]*animation: none/)
})
