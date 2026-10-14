// « Mon titre » et « Ma vitrine » d'un débutant (l'experte du jeu solo, le
// 11 octobre 2026, constat 11 : `retours/2026-10-11/experts/nouveautes-solo.md`) :
// « Aucun · 53 titres à gagner », et rien ne disait comment gagner le premier
// — le crayon du vestiaire menait à une page sans choix. Les deux pages disent
// maintenant le haut fait qu'il a le plus avancé, avec sa jauge ; sans rien de
// commencé, le plus simple à gagner seul ; et plus rien dès le premier gagné.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { HAUTS_FAITS_DE_CARRIERE, HAUTS_FAITS_REGAGNABLES, type HautFaitVu } from '../../shared/hautsfaits'
import { lePremierHautFait } from '../../shared/proches'
import type { BadgePorte } from '../../shared/badges'

Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/profil', search: '', hash: '', origin: 'http://banc' } },
  location: { pathname: '/profil', search: '', hash: '', origin: 'http://banc' },
})

async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** Ce que la page du profil reçoit (`hautsFaitsVus`) : chaque haut fait, ses fois — son palier, en carrière — et ce qu'il compte. */
function hautsFaits({ valeurs = {}, fois = {} }: { valeurs?: Record<string, number>; fois?: Record<string, number> } = {}): HautFaitVu[] {
  return [
    ...HAUTS_FAITS_REGAGNABLES.map(h => ({ key: h.key, famille: 'soiree' as const, emoji: h.emoji, title: h.title, rule: h.rule, ton: h.ton, fois: fois[h.key] ?? 0 })),
    ...HAUTS_FAITS_DE_CARRIERE.map(h => ({
      key: h.key,
      famille: 'carriere' as const,
      emoji: h.emoji,
      title: h.title,
      rule: h.mesure,
      ruleUne: h.mesureUne,
      ton: 'eclat' as const,
      fois: fois[h.key] ?? 0,
      valeur: valeurs[h.key] ?? 0,
      prochain: h.paliers[fois[h.key] ?? 0] ?? null,
    })),
  ]
}

const profil = (h: HautFaitVu[], vitrine: BadgePorte[] = []) => ({
  id: 'p',
  name: 'Léa',
  legendaires: [],
  hautsFaits: h,
  sentiers: {},
  titresDates: [],
  titre: null,
  vitrine,
  vitrineChoisie: null,
})
/** Une pièce de la loge, rien d'essayé : ce qu'il porte se montre tel quel. */
const rien = { essai: {}, essayer: () => {}, busy: false, enregistrer: () => {} }

// Une série de campagne à six bonnes réponses, trente en tout, deux soirées.
const debutant = hautsFaits({ valeurs: { 'hf:alpiniste': 6, 'hf:marathonien': 30, 'hf:habitue': 2 } })

test('le premier haut fait : le premier palier qu’il a le plus avancé ; rien de commencé, rien', () => {
  assert.equal(lePremierHautFait(hautsFaits(), []), null)
  // L'Habitué à deux soirées sur trois passe devant L'Alpiniste à six sur dix,
  // qui passe devant Le Marathonien à trente sur deux cent cinquante — et
  // devant le légendaire de dix soirées, à deux sur dix.
  assert.deepEqual(lePremierHautFait(debutant, []), { key: 'hf:habitue:1', acquis: 2, requis: 3 })
  assert.deepEqual(lePremierHautFait(hautsFaits({ valeurs: { 'hf:alpiniste': 7, 'hf:marathonien': 30 } }), []), { key: 'hf:alpiniste:1', acquis: 7, requis: 10 })
  // La Légende suit le niveau, que la barre montre ; les Éclats se tirent : ni l'une ni les autres ne se chassent.
  assert.equal(lePremierHautFait(hautsFaits({ valeurs: { 'hf:legende': 9, 'hf:eclats': 0 } }), []), null)
})

test('« Mon titre » d’un débutant : le plus proche, avec sa jauge ; rien de commencé, le plus simple pour commencer ; dès un titre, plus rien', async () => {
  const html = await rendu('components/Apparence', 'MonTitre', { profil: profil(hautsFaits({ valeurs: { 'hf:alpiniste': 7, 'hf:marathonien': 30 } })), ...rien })
  assert.match(html, /<div class="proches"><span class="label">Le plus proche<\/span><div class="approche">/)
  assert.match(html, /<b>L’Alpiniste · Bronze<\/b><span class="muted small">7 sur 10 bonnes réponses dans une série de campagne<\/span><span class="jauge" aria-label="7 sur 10">/)
  // Puis ce qui reste, compté, et le chemin de l'album des trophées : le lien de toutes les pièces de la loge.
  assert.ok(html.indexOf('Le plus proche') < html.indexOf('titres à gagner'), 'le plus proche, puis tout ce qui reste')
  assert.match(html, /<a class="loge-a-gagner" href="#collection-trophees">\d+ titres à gagner\s:\soù\s\?<svg/)

  // Rien de commencé : le plus simple, sans jauge — « 0 sur 10 » ne s'approche de rien.
  const neuf = await rendu('components/Apparence', 'MonTitre', { profil: profil(hautsFaits()), ...rien })
  assert.match(
    neuf,
    /<span class="label">Le plus simple pour commencer<\/span><div class="approche"><span class="approche-emoji" aria-hidden="true">🧗<\/span><div class="approche-corps"><b>L’Alpiniste · Bronze<\/b><span class="muted small">10 bonnes réponses dans une série de campagne<\/span><\/div><\/div>/,
  )
  assert.doesNotMatch(neuf, /Le plus proche|class="jauge"/)

  // Un premier haut fait tombé — Le Lève-tôt — : son titre à porter, plus rien d'autre.
  const titre = await rendu('components/Apparence', 'MonTitre', { profil: profil(hautsFaits({ valeurs: { 'hf:alpiniste': 7 }, fois: { 'hf:leve-tot': 1 } })), ...rien })
  assert.match(titre, />Le Lève-tôt<\/button>/)
  assert.doesNotMatch(titre, /Le plus proche|Le plus simple/)
})

test('« Ma vitrine » d’un débutant aussi : le plus proche sous ce qu’elle montrera ; plus rien dès le premier haut fait', async () => {
  const html = await rendu('components/Trophees', 'MaVitrine', { profil: profil(debutant), ...rien })
  // Des trophées : le mot de l'album et des fins de partie (le 13 octobre 2026).
  assert.match(html, /Ta carte montrera tes trois plus beaux trophées/)
  assert.match(html, /<span class="label">Le plus proche<\/span>.*<b>L’Habitué · Bronze<\/b><span class="muted small">2 sur 3 soirées jouées<\/span>/)

  const leveTot = HAUTS_FAITS_REGAGNABLES.find(h => h.key === 'hf:leve-tot')!
  const badge: BadgePorte = { key: leveTot.key, emoji: leveTot.emoji, title: leveTot.title, fois: 1, dernier: 0, porteurs: 0, rarete: null }
  const gagne = await rendu('components/Trophees', 'MaVitrine', { profil: profil(hautsFaits({ fois: { 'hf:leve-tot': 1 } }), [badge]), ...rien })
  assert.match(gagne, /Le Lève-tôt/)
  assert.doesNotMatch(gagne, /Le plus proche|Le plus simple/)
})
