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

test('le dé : sa feuille dit ce que le duel contre Automate met en jeu — à chances égales — et sur quoi, avant de rien tirer ; « Jouer le duel » tire, et fermée, rien n’est en cours', async () => {
  const { FeuilleDuDe, LeDe } = await import(client('views/Duels.tsx').href)
  const { enjeuDuDe } = await import('../../shared/duels')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const feuille = (props: object) => renderToStaticMarkup(React.createElement(FeuilleDuDe, { categories: [], sujet: null, onChanger() {}, onJouer() {}, onFermer() {}, ...props }))
  const html = feuille({ enjeu: enjeuDuDe(1000) })
  assert.match(html, /role="dialog" aria-modal="true" aria-label="Un duel au dé"/)
  // Automate, avant d'avoir rien tiré : son nom et son avatar sont ceux de la partie (`AUTOMATE`, `shared/duels.ts`).
  assert.match(html, /<b>Automate<\/b><span class="muted small">simulé, de ton niveau<\/span>/)
  // Sous l'Or, une défaite qui rapporte ne prend pas la couleur d'une perte.
  assert.match(
    html,
    /<div class="duels-jetons" role="group" aria-label="Ce qui se joue sur ta cote"><span class="duels-jeton"><b class="num">\+17<\/b><span>victoire<\/span><\/span><span class="duels-jeton"><b class="num">\+2<\/b><span>défaite<\/span><\/span><\/div>/,
  )
  assert.match(html, /<span class="sr-only">trois vies<\/span>.*sans chrono/)
  // Sur quoi : la ligne du choix de la série et de « Défier quelqu'un », « Changer » au bout (« je ne peux pas choisir le thème »).
  assert.match(html, /<button type="button" class="quoi-ligne" aria-haspopup="dialog">.*<span class="muted small">Sur<\/span><b>Toutes les catégories<\/b>.*Changer/)
  assert.match(feuille({ enjeu: enjeuDuDe(1000), categories: ['Histoire'] }), /<b>Histoire<\/b>/)
  assert.match(html, /<footer class="carte-pied"><button type="button" class="btn btn-primary btn-big btn-block btn-duel"><svg[^>]*>.*?<\/svg>Jouer le duel<\/button><\/footer>/)
  // Fermée, rien n'est tiré : elle ne promet plus qu'il attend dans ses duels.
  assert.doesNotMatch(html, /Il t’attend dans tes duels/)
  // En Or, presque platine : « +13 / −11 », la défaite au rouge d'une perte — « +4 / −17 » contre un Automate qui avait raté.
  assert.match(feuille({ enjeu: enjeuDuDe(1274) }), /<b class="num">\+13<\/b><span>victoire<\/span><\/span><span class="duels-jeton perdu"><b class="num">−11<\/b><span>défaite<\/span><\/span>/)
  // Le refus d'un tirage se dit dans la feuille ; le tirage en route, « Jouer le duel » attend.
  assert.match(feuille({ enjeu: enjeuDuDe(1000), erreur: 'Pas assez de questions dans ces catégories : ajoutes-en une autre' }), /<p class="error" role="alert">Pas assez de questions/)
  assert.match(feuille({ enjeu: enjeuDuDe(1000), busy: true }), /<button type="button" class="btn btn-primary btn-big btn-block btn-duel" aria-disabled="true">/)
  // Le dé ouvert, sa feuille d'abord : l'enjeu lu de sa cote, ce qu'il jouait la dernière fois — rien ne part au serveur.
  const ouvert = renderToStaticMarkup(React.createElement(LeDe, { cote: 1274, choix: null, depart: { categories: [], sujet: 'animaux' }, onJouer() {}, onFermer() {} }))
  assert.match(ouvert, /aria-label="Un duel au dé"/)
  assert.match(ouvert, /<b class="num">\+13<\/b>/)
  assert.match(ouvert, /<b>Les animaux<\/b>/)

  // La page : le dé touché ouvre sa feuille, sans rien tirer ; seul celui laissé en route se reprend, tout de suite.
  const page = source('views/Duels.tsx')
  assert.match(page, /onAuHasard=\{!etat \? undefined : enCours \? \(\) => void reprendre\(\) : \(\) => setDeOuvert\(true\)\}/)
  assert.match(page, /const r = await api\.campagne\.rencontre\.commencer\(\)\s*if \(r\.serie\.question\) onJouer\(r\)/)
  assert.match(page, /\{deOuvert && etat && \(\s*<LeDe\s+cote=\{etat\.cote\}\s+choix=\{choix\}\s+depart=\{surQuoiDuDe\}/)
  // Le tirage part de « Jouer le duel », sur ce qu'il a choisi — la feuille, dans `Duel.tsx`.
  assert.match(source('views/Duel.tsx'), /onJouer\(await api\.campagne\.rencontre\.commencer\(\{ categories, sujet \}\)\)/)
  // « Un autre duel », sous le verdict d'un duel au dé, est le même dé : la même feuille, sur ce que jouait celui-ci, à
  // sa cote d'après. La partie n'en tire pas le code des duels pour autant : la feuille vient avec la page des duels.
  const partie = source('views/CampagneApp.tsx')
  assert.match(partie, /\{ texte: 'Un autre duel', icone: 'dice', onClick: \(\) => setDeOuvert\(true\) \}/)
  assert.match(partie, /<laPageDesDuels\.LeDe\s+cote=\{ecran\.cote\?\.apres \?\? null\}\s+choix=\{choixPourLancer\}\s+depart=\{\{ categories: ecran\.categories, sujet: ecran\.sujet \}\}/)
  assert.doesNotMatch(partie, /api\.campagne\.rencontre\.commencer/, 'la partie ne tire jamais de dé elle-même')
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
  // joueur choisi la relit, la sienne fraîche avec — et, connue, la même lecture dit le duel déjà ouvert entre eux.
  assert.match(
    source('views/LancerUnDefi.tsx'),
    /if \(!choisi \|\| \(moi && ouvertLu\)\) return[\s\S]*?api\.duels\s*\.joueur\(choisi\.profileId\)\s*\.then\(f => \{\s*if \(!vivant\) return\s*setOuvert\(\{ profileId: f\.joueur\.profileId, duel: f\.enCours \?\? null \}\)\s*if \(moi\) return\s*setMoi\(f\.moi\)\s*setChoisi\(f\.joueur\)/,
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
