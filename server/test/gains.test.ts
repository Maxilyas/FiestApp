// L'écran de gains, le même dans chaque mode (l'écran A, choisi par le
// propriétaire le 13 octobre 2026 : « c'est très confus, les trophées que les
// gens gagnent ») : ce que tu gagnes — l'expérience en un total, ce qui la
// fait, les confettis, le niveau —, les nouveaux trophées — une ligne par
// piste, les plus rares d'abord —, et ce qu'ils ouvrent, à essayer.
//
// Chaque fin le disait à sa façon : « Nouveau palier : L'Assidu · Argent »
// au quiz du jour, « Nouveau haut fait : Le Laurier » la ligne d'après pour la
// même victoire, « +18 XP, dont 10 pour le palier » sur les sentiers — et
// rien ne disait que ce palier ouvrait la Nuit étoilée.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { TROPHEES_MONTRES, aPorterDesTrophees, objetsAPorter, partsDeLXp, totalDeLXp, tropheesTombes, xpDesTrophees } from '../../shared/gains'
import { essaiDemande } from '../../shared/loge'
import { phraseDesEtoiles } from '../../shared/jour'

Object.assign(globalThis, { React })

const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

test('les trophées d’une fin : une ligne par piste, ses métaux réunis — Le Laurier sur celle du Champion du jour', () => {
  const lignes = tropheesTombes([
    { key: 'hf:alpiniste:1', emoji: '🧗', title: 'L’Alpiniste · Bronze' },
    { key: 'hf:alpiniste:2', emoji: '🧗', title: 'L’Alpiniste · Argent' },
    { key: 'hf:alpiniste:3', emoji: '🧗', title: 'L’Alpiniste · Or' },
  ])
  // Trois paliers d'une série faisaient trois lignes : une, ses trois métaux, tout ce qu'ils rapportent.
  assert.deepEqual(
    lignes.map(t => [t.titre, t.detail, t.xp, t.metaux, t.page]),
    [['L’Alpiniste · Bronze → Or', '20 bonnes réponses dans une série de campagne', 350, 3, 'campagne']],
  )
  // La même victoire faisait tomber Le Laurier et le Champion du jour : une ligne, les deux expériences.
  const victoire = tropheesTombes([
    { key: 'hf:champion-du-jour:1', emoji: '🌞', title: 'Le Champion du jour · Bronze' },
    { key: 'hf:laurier', emoji: '🌿', title: 'Le Laurier' },
  ])
  assert.deepEqual(
    victoire.map(t => [t.cle, t.titre, t.xp]),
    [['hf:champion-du-jour:1', 'Le Champion du jour · Bronze', 100]],
  )
  // Le Laurier seul, sans palier : sa ligne, sous son nom.
  assert.deepEqual(
    tropheesTombes([{ key: 'hf:laurier', emoji: '🌿', title: 'Le Laurier' }]).map(t => [t.titre, t.detail, t.xp, t.page]),
    [['Le Laurier', 'Gagner le quiz du jour', 50, 'jour']],
  )
})

test('les plus rares d’abord — un prix vaut un sur la salle —, les coups du sort derrière ; trois en vue', () => {
  const lignes = tropheesTombes(
    [
      { key: 'hf:kamikaze', emoji: '💥', title: 'Le Kamikaze' },
      { key: 'hf:flair', emoji: '🔮', title: 'Le Flair' },
      { key: 'hf:bavard:2', emoji: '💬', title: 'Le Bavard · Argent' },
    ],
    { prix: [{ key: 'eclair', emoji: '⚡', title: 'L’Éclair', detail: '2,7 s de moyenne' }], joueurs: 6 },
  )
  assert.deepEqual(
    lignes.map(t => `${t.titre} ${t.ton}`),
    ['L’Éclair eclat', 'Le Bavard · Argent eclat', 'Le Flair eclat', 'Le Kamikaze ombre'],
  )
  // Un prix ne rapporte jamais d'expérience (invariant 19).
  assert.deepEqual([lignes[0].xp, lignes[0].prix, lignes[0].rarete], [0, true, null])
  assert.equal(TROPHEES_MONTRES, 3)
})

test('ce qu’ils ouvrent à porter : seuls les paliers le disent — un exploit qui se regagne ne sait pas à combien de fois il en est', () => {
  assert.deepEqual(
    aPorterDesTrophees(['hf:assidu:2', 'hf:infatigable:1', 'hf:infatigable:2', 'hf:leve-tot', 'hf:laurier']).map(o => `${o.piece}:${o.cle} par ${o.par}`),
    ['fond:nuit par L’Assidu · Argent', 'gerbe:petales par L’Infatigable · Bronze', 'gerbe:flammes par L’Infatigable · Argent', 'theme:ciel par L’Infatigable · Argent'],
  )
  // Un laurier se porte tout seul, un légendaire a sa grande carte : « À porter » n'a que ce qui s'essaie dans la loge.
  assert.deepEqual(aPorterDesTrophees(['hf:champion-du-jour:1']).map(o => o.cle), ['ballons'])
  // Chacun une fois.
  const fond = { sorte: 'fond' as const, cle: 'cabinet', nom: 'Cabinet de curiosités' }
  assert.equal(objetsAPorter([{ recompense: fond, par: 'a' }, { recompense: fond, par: 'b' }]).length, 1)
})

test('ce que tu gagnes : les parts qui comptent, leur total — un « +0 » ressemblait à une panne', () => {
  const parts = partsDeLXp([{ nom: 'ta partie', xp: 124 }, { nom: 'ta série de 7 jours', xp: 0 }, false, { nom: 'tes trophées', xp: xpDesTrophees(['hf:assidu:2', 'hf:leve-tot', 'eclair']) }])
  assert.deepEqual(parts, [
    { nom: 'ta partie', xp: 124 },
    { nom: 'tes trophées', xp: 125 },
  ])
  assert.equal(totalDeLXp(parts), 249)
})

test('« Essayer » ouvre la loge l’essai sur la carte — seulement ce qui est à lui, sur sa pièce', () => {
  const profil = {
    avatar: '🦊',
    legendaire: null,
    finitionChoisie: 'auto',
    titre: null,
    vitrineChoisie: null,
    fond: null,
    theme: null,
    gerbe: null,
    bordureChoisie: 'auto',
    niveau: 8,
    hautsFaits: [],
    vitrine: [],
    legendaires: [],
    divins: [],
    ouvertes: ['mat'],
    eclats: [],
    fonds: ['nuit'],
    gerbes: ['confettis', 'petales'],
    boutique: { possedes: ['velours', 'ivoire', 'ciel'] },
    sentiers: {},
  } as any
  assert.deepEqual(essaiDemande('fond', 'nuit', profil), { fond: 'nuit' })
  assert.deepEqual(essaiDemande('gerbe', 'petales', profil), { gerbe: 'petales' })
  assert.deepEqual(essaiDemande('theme', 'ciel', profil), { theme: 'ciel' })
  // L'emoji de collection de son niveau, oui ; celui d'un niveau qu'il n'a pas, non.
  assert.deepEqual(essaiDemande('avatar', '🐝', profil), { avatar: '🐝' })
  assert.deepEqual(essaiDemande('avatar', '🐳', profil), {})
  // Une adresse tapée n'essaie rien qu'il n'ait, ni sur une autre pièce.
  assert.deepEqual(essaiDemande('fond', 'cabinet', profil), {})
  assert.deepEqual(essaiDemande('gerbe', 'nuit', profil), {})
  assert.deepEqual(essaiDemande('fond', null, profil), {})
  // La loge le lit une fois, à l'ouverture, et l'adresse l'oublie.
  const loge = source('components/Loge.tsx')
  assert.match(loge, /useState<Essai>\(\(\) => essaiDemande\(piece, lireLEssaiDemande\(\), profil\)\)/)
  assert.match(source('components/Gains.tsx'), /export const adresseDeLEssai = \(o: ObjetAPorterOuEmoji\) => `\/profil\?essayer=\$\{encodeURIComponent\(o\.cle\)\}#\$\{o\.piece\}`/)
})

test('la note du quiz du jour se dit en étoiles, comme aux sentiers : celles qu’il a, et la suivante', () => {
  assert.equal(phraseDesEtoiles('argent', 10), 'Deux étoiles · la troisième au sans-faute')
  assert.equal(phraseDesEtoiles('bronze', 10), 'Une étoile · la deuxième à 8 bonnes réponses')
  assert.equal(phraseDesEtoiles(null, 9), 'Une étoile à 6 bonnes réponses, deux à 8, trois au sans-faute')
  assert.equal(phraseDesEtoiles('or', 10), 'Trois étoiles : un sans-faute')
})

/** La fin du quiz du jour, rendue sous l'adresse de sa page. */
async function finDuJour(partie: object, profil: object): Promise<string> {
  Object.assign(globalThis, { window: { location: { pathname: '/jour', search: '', hash: '' } } })
  const page = await import(new URL('../../client/src/views/JourApp.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(page.Fin, { partie, profil, onClassement: () => {}, onCorrection: () => {} }))
}

test('la fin du quiz du jour : ses étoiles, ce qu’elle rapporte en un total, ses trophées en lignes, ce qu’ils ouvrent à essayer', async () => {
  const html = await finDuJour(
    {
      jour: '2026-10-13',
      maintenant: 0,
      total: 10,
      categories: [],
      etat: 'finie',
      points: 1240,
      justes: 8,
      xp: 124,
      xpSerie: 70,
      medaille: 'argent',
      rang: 3,
      joueurs: 23,
      pointsPossibles: 2000,
      comptees: 10,
      serie: 7,
      vainqueursDHier: [],
      paliers: [
        { key: 'hf:assidu:2', emoji: '📆', title: 'L’Assidu · Argent' },
        { key: 'hf:infatigable:1', emoji: '🏃', title: 'L’Infatigable · Bronze' },
      ],
      hautsFaits: [{ key: 'hf:leve-tot', emoji: '🐓', title: 'Le Lève-tôt' }],
      niveauAvant: 14,
      niveauApres: 14,
    },
    { niveau: 14, acquis: 980, requis: 1620, legendaire: null, avatar: '🦊', finition: 'or' },
  )
  // Ses étoiles, sous les points : la note de la partie.
  assert.match(html, /role="img" aria-label="2 étoiles sur 3"/)
  assert.match(html, /Deux étoiles · la troisième au sans-faute/)
  // Ce qu'elle rapporte : la partie, la série, les trophées — tout ce que la barre vient de prendre.
  assert.match(html, /<b class="num">\+369 XP<\/b>/)
  assert.match(html, /ta partie \+124 · ta série de 7 jours \+70 · tes trophées \+175/)
  assert.match(html, /🎊<\/span> \+8 confettis/)
  assert.match(html, /Niveau 14 · 980 \/ 1\s?620 XP vers le niveau 15/)
  // Ses trophées, chacun vers sa page de l'album ; plus de « Nouveau palier : », plus de médaille.
  const titres = [...html.matchAll(/<a class="trophee-tombe" href="\/profil#collection-trophees-jour"[^>]*>.*?<b>([^<]+)<\/b>/g)].map(m => m[1])
  assert.deepEqual(titres.sort(), ['L’Assidu · Argent', 'L’Infatigable · Bronze', 'Le Lève-tôt'].sort())
  assert.doesNotMatch(html, /Nouveau palier|Nouveau haut fait|Médaille|médaille/)
  // Ce qu'ils ouvrent, à essayer dans la loge.
  assert.match(html, /<a class="btn btn-small a-porter-essayer" href="\/profil\?essayer=nuit#fond" aria-label="Essayer Nuit étoilée">Essayer<\/a>/)
  assert.match(html, /href="\/profil\?essayer=petales#gerbe"/)
  // L'ordre de l'écran A : le résultat, ce que tu gagnes, les trophées, à porter, puis les gestes.
  const ou = (m: string) => html.indexOf(m)
  const ordre = ['jour-fin-resultat', 'class="card gains"', 'class="card gains-trophees"', 'class="card gains-a-porter"', 'class="fin-actions"'].map(ou)
  assert.ok(ordre.every(i => i >= 0), ordre.join(','))
  assert.deepEqual(ordre, [...ordre].sort((a, b) => a - b))
})

test('chaque fin passe par les mêmes pièces : le jour, la campagne, le défi, les duels, les sentiers, les parcours, la soirée', () => {
  for (const fichier of ['views/JourApp.tsx', 'views/CampagneApp.tsx', 'views/Sentiers.tsx', 'views/Parcours.tsx', 'components/FinDeSoiree.tsx']) {
    const page = source(fichier)
    assert.match(page, /<CeQueTuGagnes\b/, fichier)
    assert.match(page, /<NouveauxTrophees\b/, fichier)
    assert.match(page, /<APorter\b/, fichier)
    // Une seule façon de dire un trophée tombé.
    assert.doesNotMatch(page, /RecompenseTombee|Nouveau palier :|Nouveau haut fait :/, fichier)
  }
  // Le défi de la semaine d'avant et le lendemain du quiz du jour : les mêmes lignes.
  assert.match(source('views/Defi.tsx'), /<LigneDeTrophee key=\{t\.cle\} t=\{t\} lien \/>/)
  assert.match(source('views/JourApp.tsx'), /tropheesTombes\(tombes\)\.map\(t => \(\s*<LigneDeTrophee key=\{t\.cle\} t=\{t\} lien \/>/)
  // Les duels : le total seulement à une montée de niveau — la carte du verdict dit déjà ce que le duel a fait.
  assert.match(source('views/CampagneApp.tsx'), /\{\(!duel \|\| monte\) && \(/)
})
