// Ce qu'un duel met en jeu, dit avant de le jouer, partout où l'on choisit un
// adversaire (les souhaits du propriétaire du 14 octobre 2026) : « savoir
// aussi combien je perds si je défie quelqu'un et que je perds », « une
// confirmation avec le dé pour jouer contre l'automate : combien je gagne ou
// je perds si je joue », et, « de manière globale, quand je lance un défi et
// que je choisis quelqu'un, voir ce que je gagne / perds ». L'échelle du
// classement, la carte d'un joueur, la préparation d'un défi, le dé : la
// victoire et la défaite, lues de la même règle que la cote (`enjeuContre`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'

Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/duels', search: '', hash: '', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
})
const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)
const source = (f: string) => readFileSync(client(f), 'utf8')

const tom = { profileId: 't', nom: 'Tom', avatar: '🐻', cote: 1240, ligue: 'or', rang: 3 }

test('l’échelle du classement : « Défier », ce qu’il gagnerait à battre chacun — et ce qu’une défaite lui coûterait, ou lui rapporterait encore', async () => {
  const { PanneauClassement } = await import(client('views/Duels.tsx').href)
  const { enjeuContre } = await import('../../shared/duels')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const ligne = (nom: string, rang: number, cote: number) => ({ profileId: nom.toLowerCase(), nom, avatar: '🐻', niveau: 3, cote, ligue: cote >= 1300 ? 'platine' : cote >= 1200 ? 'or' : 'argent', rang, duels: 12 })
  const rendre = (maCote: { cote: number; joues: number; plancher?: number }, aPortee: ReturnType<typeof ligne>[]) => {
    const moi = ligne('Léa', 9, maCote.cote)
    return renderToStaticMarkup(
      React.createElement(PanneauClassement, {
        classement: { joueurs: 20, lignes: [ligne('Inès', 1, 1500)], moi, sienne: 'léa', autour: [moi], aPortee },
        maCote,
        contre: [],
        amis: null,
        onOuvrir() {},
        onToutVoir() {},
        onDefier() {},
        onOuvrirDuel() {},
        onAmis() {},
      }),
    )
  }
  // Sous l'Or : même perdu, le duel le fait avancer (la montée) — « +4 même si tu perds », en retrait, jamais en rouge.
  const sousLOr = rendre({ cote: 1150, joues: 30 }, [ligne('Jade', 8, 1210)])
  const e = enjeuContre({ cote: 1150 }, 1210, true)
  assert.ok(e.perdu > 0)
  assert.match(sousLOr, new RegExp(`aria-label="Défier Jade : \\+${e.gagne} si tu gagnes, \\+${e.perdu} même si tu perds"`))
  assert.match(sousLOr, new RegExp(`<span class="duels-echelon-gain">\\+${e.gagne} si tu gagnes</span><span class="duels-echelon-perte">\\+${e.perdu} même si tu perds</span>`))
  // Dès l'Or : une défaite coûte, et se dit en moins, au rouge d'une perte.
  const enOr = rendre({ cote: 1350, joues: 60, plancher: 1200 }, [ligne('Hugo', 7, 1360)])
  const f = enjeuContre({ cote: 1350, plancher: 1200 }, 1360, true)
  assert.ok(f.perdu < 0)
  assert.match(enOr, new RegExp(`aria-label="Défier Hugo : \\+${f.gagne} si tu gagnes, −${-f.perdu} si tu perds"`))
  assert.match(enOr, new RegExp(`<span class="duels-echelon-perte duels-moins">−${-f.perdu} si tu perds</span>`))
  // Sa ligue gardée l'arrête au seuil : rien à perdre.
  assert.equal(enjeuContre({ cote: 1200, plancher: 1200 }, 1250, true).perdu, 0)
  const auPlancher = rendre({ cote: 1200, joues: 60, plancher: 1200 }, [ligne('Zoé', 8, 1250)])
  assert.match(auPlancher, /aria-label="Défier Zoé : \+\d+ si tu gagnes, rien à perdre"/)
  assert.match(auPlancher, /<span class="duels-echelon-perte">rien à perdre<\/span>/)
})

test('le dé : tiré, ce que le duel contre Automate met en jeu se dit avant la première question — sa feuille, ses deux jetons, « Jouer le duel » ; fermée, il attend dans ses duels', async () => {
  const { aConfirmerAuDe } = await import(client('views/Rencontre.tsx').href)
  const { FeuilleDuDe } = await import(client('views/Duels.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const serie = (index: number) => ({ id: 's', vies: 3, justes: index > 0 ? 1 : 0, total: 20, finie: false, question: { index, texte: 'Q ?', reponses: ['a', 'b', 'c', 'd'], categorie: 'Histoire', niveau: 'facile' } })
  const automate = { nom: 'Automate', avatar: '🤖', simule: true as const }
  const enjeu = { cote: 1019, gagne: 19, egalite: 5, perdu: 2 }
  const tiree = { serie: serie(0), adversaire: automate, sesJustes: 0, enjeu }
  assert.equal(aConfirmerAuDe(tiree), true, 'tirée, pas encore jouée : sa feuille d’abord')
  assert.equal(aConfirmerAuDe({ ...tiree, serie: serie(4), sesJustes: 3 }), false, 'reprise en route : elle se joue tout de suite — l’enjeu se redit à chaque question')
  const { enjeu: _, ...sansEnjeu } = tiree
  assert.equal(aConfirmerAuDe(sansEnjeu), false, 'un serveur d’avant ne dit pas l’enjeu : rien à confirmer')

  const feuille = (e: object) => renderToStaticMarkup(React.createElement(FeuilleDuDe, { rencontre: { ...tiree, enjeu: e }, onJouer() {}, onFermer() {} }))
  const html = feuille(enjeu)
  assert.match(html, /role="dialog" aria-modal="true" aria-label="Un duel au dé"/)
  assert.match(html, /<b>Automate<\/b><span class="muted small">simulé, de ton niveau<\/span>/)
  // Sous l'Or, une défaite qui rapporte ne prend pas la couleur d'une perte.
  assert.match(
    html,
    /<div class="duels-jetons" role="group" aria-label="Ce qui se joue sur ta cote"><span class="duels-jeton"><b class="num">\+19<\/b><span>victoire<\/span><\/span><span class="duels-jeton"><b class="num">\+2<\/b><span>défaite<\/span><\/span><\/div>/,
  )
  assert.match(html, /<span class="sr-only">trois vies<\/span>.*sans chrono.*toutes catégories/)
  assert.match(html, /<footer class="carte-pied"><button type="button" class="btn btn-primary btn-big btn-block btn-duel"><svg[^>]*>.*?<\/svg>Jouer le duel<\/button><\/footer>/)
  assert.match(html, /Pas maintenant\s\? Il t’attend dans tes duels\./)
  // Une défaite qui coûte : au rouge d'une perte.
  assert.match(feuille({ cote: 1350, gagne: 9, egalite: -3, perdu: -8 }), /<span class="duels-jeton perdu"><b class="num">−8<\/b><span>défaite<\/span><\/span>/)

  // La page : le dé touché tire, puis sa feuille — jamais la première question d'emblée. Tirée, la rencontre est la
  // sienne : sa feuille fermée, « En cours » la montre et le dé la reprend — on ne relance pas le dé pour un meilleur enjeu.
  const page = source('views/Duels.tsx')
  assert.match(page, /if \(aConfirmerAuDe\(r\)\) \{[\s\S]*?setEtat\(e => e && \{ \.\.\.e, enCours: r \}\)\s*setDeTire\(r\)\s*\} else onJouer\(r\)/)
  assert.match(page, /\{deTire && <FeuilleDuDe rencontre=\{deTire\} onJouer=\{\(\) => onJouer\(deTire\)\} onFermer=\{\(\) => setDeTire\(null\)\} \/>\}/)
  // « Un autre duel », sous le verdict d'un duel au dé, est le même dé : la même feuille. La partie n'en tire pas le
  // code des duels pour autant — la règle vit dans `Rencontre.tsx`, la feuille vient avec la page des duels.
  const partie = source('views/CampagneApp.tsx')
  assert.match(partie, /const r = await api\.campagne\.rencontre\.commencer\(\)\s*if \(aConfirmerAuDe\(r\)\) setDeTire\(r\)\s*else jouerLaRencontre\(r\)/)
  assert.match(partie, /<laPageDesDuels\.FeuilleDuDe\s+rencontre=\{deTire\}\s+onJouer=\{\(\) => \{\s*setDeTire\(null\)\s*jouerLaRencontre\(deTire\)\s*\}\}/)
  assert.match(partie, /import \{[^}]*\baConfirmerAuDe\b[^}]*\} from '\.\/Rencontre'/)
  // Pendant la partie, l'enjeu se redit à chaque question, de la même pièce que la carte d'un joueur.
  assert.match(partie, /\{enjeu && !r\?\.finie && <EnJeu enjeu=\{enjeu\} className="muted small duels-enjeu" \/>\}/)
})

test('défier quelqu’un : l’adversaire choisi, ce qu’il met en jeu se voit sous lui — deux jetons, sa part de lanceur et sa ligue gardée comprises', async () => {
  const { LancerUnDefi } = await import(client('views/LancerUnDefi.tsx').href)
  const { enjeuContre } = await import('../../shared/duels')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const composer = (depart: object) =>
    renderToStaticMarkup(React.createElement(LancerUnDefi, { amis: [tom], categoriesJouables: ['Histoire'], sujets: [], depart, busy: false, erreur: '', onLancer() {}, onRetour() {} }))
  const jetons = (gagne: string, perdu: string, perte = '') =>
    `<div class="duels-jetons petits" role="group" aria-label="Ce qui se joue sur ta cote"><span class="duels-jeton"><b class="num">${gagne}</b><span>victoire</span></span><span class="duels-jeton${perte}"><b class="num">${perdu}</b><span>défaite</span></span></div>`
  // Sous l'Or : la victoire, et la défaite qui rapporte encore — sa part de lanceur comprise.
  const html = composer({ categories: [], sujet: null, adversaire: tom, moi: { cote: 1000, joues: 0 } })
  const e = enjeuContre({ cote: 1000 }, 1240, true)
  assert.ok(e.perdu > 0)
  assert.ok(html.includes(jetons(`+${e.gagne}`, `+${e.perdu}`)), 'les deux jetons, sous l’Or')
  // Dans « Contre qui ? », sous lui : on le voit en le choisissant — dit sous « Jouer le duel », il sortait de l'écran du téléphone.
  const ici = html.indexOf('duels-jetons')
  assert.ok(html.indexOf('id="defier-qui"') < ici && ici < html.indexOf('id="defier-quoi"'), 'sous l’adversaire choisi, avant « Sur quoi ? »')
  assert.doesNotMatch(html, /pour toi, [+−]/, 'la phrase sous le bouton ne le redit plus')
  assert.match(html, /vos deux cotes bougent\.<\/p>/)
  // Dès l'Or, contre plus faible : la défaite coûte, au rouge d'une perte ; sa ligue gardée l'arrête au seuil.
  const enOr = composer({ categories: [], sujet: null, adversaire: { ...tom, cote: 1000 }, moi: { cote: 1350, joues: 40, plancher: 1200 } })
  const f = enjeuContre({ cote: 1350, plancher: 1200 }, 1000, true)
  assert.ok(f.perdu < 0)
  assert.ok(enOr.includes(jetons(`+${f.gagne}`, `−${-f.perdu}`, ' perdu')), 'la défaite qui coûte, en rouge')
  // Personne de choisi — ou sa cote pas encore là : rien à dire.
  assert.doesNotMatch(composer({ categories: [], sujet: null, moi: { cote: 1000, joues: 0 } }), /duels-jetons/)
  assert.doesNotMatch(composer({ categories: [], sujet: null, adversaire: tom }), /duels-jetons/)
  // Sa cote inconnue — la préparation ouverte à son adresse, « Défier » touché avant que la page la dise — : la carte du
  // joueur choisi la relit, la sienne fraîche avec.
  assert.match(
    source('views/LancerUnDefi.tsx'),
    /if \(!choisi \|\| moi\) return[\s\S]*?api\.duels\s*\.joueur\(choisi\.profileId\)\s*\.then\(f => \{\s*if \(!vivant\) return\s*setMoi\(f\.moi\)\s*setChoisi\(f\.joueur\)/,
  )
  // La revanche ne porte que le prénom d'en face : la page relit les deux cotes avant d'ouvrir la préparation.
  assert.match(source('views/CampagneApp.tsx'), /const adversaireAttendu = mode === 'defier' && !!contreQui && \(depart\.adversaire\?\.profileId !== contreQui \|\| !depart\.moi\)/)
})

test('la carte d’un joueur : sous « Défier », ce que le duel mettrait en jeu — comme la préparation le dira', async () => {
  const { GestesVue } = await import(client('components/GestesDuJoueur.tsx').href)
  const { enjeuContre } = await import('../../shared/duels')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const gestes = (props: object) =>
    renderToStaticMarkup(
      React.createElement(GestesVue, { joueur: tom, aConfirmer: false, busy: false, erreur: '', onDefier() {}, onAjouter() {}, onRetirer() {}, onConfirmer() {}, onGarder() {}, ...props }),
    )
  const e = enjeuContre({ cote: 1000 }, 1240, true)
  assert.match(
    gestes({ enjeu: e }),
    new RegExp(
      `<span class="carte-gestes-nom">Défier Tom</span></button><p class="small carte-gestes-enjeu">En jeu : <b class="duels-plus">\\+${e.gagne}</b> si tu gagnes, <b class="duels-plus">\\+${e.perdu}</b> même si tu perds</p>`,
    ),
  )
  const f = enjeuContre({ cote: 1350, plancher: 1200 }, 1000, true)
  assert.match(gestes({ enjeu: f }), new RegExp(`<b class="duels-moins">−${-f.perdu}</b> si tu perds</p>`))
  assert.match(gestes({ enjeu: { cote: 1200, gagne: 12, egalite: 0, perdu: 0 } }), /si tu gagnes, rien à perdre<\/p>/)
  // Sans enjeu, rien ; et pendant qu'il confirme le retrait d'un ami, ni « Défier » ni l'enjeu.
  assert.doesNotMatch(gestes({}), /En jeu/)
  assert.doesNotMatch(gestes({ enjeu: e, joueur: { ...tom, ami: true }, aConfirmer: true }), /En jeu/)
  // La carte le lit de ce que le serveur dit des deux (`FaceAFace`) : sa cote, celle d'en face, sa part de lanceur.
  assert.match(source('components/GestesDuJoueur.tsx'), /enjeu=\{enjeuContre\(moi, joueur\.cote \?\? COTE_DE_DEPART, true\)\}/)
})
