// La campagne s'ouvre tout de suite : sa page d'abord, ce qu'elle attend du
// serveur ensuite.
//
// Touchée depuis l'accueil, elle restait 3 à 4 s sur « Chargement… » au
// premier passage après un déploiement : le serveur lisait sa base à la
// première série (`campagne-charge.test.ts` vérifie qu'il la lit maintenant
// en fond). La page montre son défi et ses règles sans attendre, et
// l'accueil télécharge son code avant le toucher.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'

const memoire = new Map<string, string>()
Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/campagne', search: '', hash: '', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false },
  localStorage: { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => memoire.set(k, v), removeItem: (k: string) => memoire.delete(k) },
})
const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)

test('la campagne s’ouvre sur sa page, pas sur « Chargement… » : le défi et les règles d’abord', async () => {
  const module = await import(client('views/CampagneApp.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html = renderToStaticMarkup(React.createElement(module.CampagneEnChemin))
  assert.match(html, /Jusqu’où iras-tu/)
  assert.match(html, /trois vies/)
  assert.match(html, /ton record/, 'la place du record, sans rien décaler quand il arrive')
  assert.match(html, /aria-disabled="true"[^>]*>.*Commencer une série/, 'le bouton attend la série à reprendre')
  assert.doesNotMatch(html, /Chargement…/)
  // Et c'est elle que la page rend tant que le serveur n'a pas répondu —
  // ouverte sur les sentiers (`#sentiers`), la place de leurs tuiles.
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  assert.match(page, /if \(ecran\.e === 'chargement'\) return <CampagneEnChemin \/>/)
  assert.match(page, /if \(ecran\.e === 'chargement' && mode === 'sentiers'\) return <SentiersEnChemin onglets=\{onglets\} \/>/)
})

// Dans le carnet, « Recommencer » mais rien pour partir — un bouton fantôme
// de 36 px sous la question, hors de l'écran au téléphone (la remarque du
// propriétaire du 11 octobre 2026). Chaque partie de la campagne se quitte
// maintenant d'un « ← Partir » en haut, comme toute page s'en va d'un
// « ← Accueil », et son geste du bas est la même pilule partout.
test('chaque partie de la campagne se quitte d’un « ← Partir » en haut ; recommencer ou abandonner, d’une même pilule en bas', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const pieces = await import(client('components/Pieces.tsx').href)
  const partir = renderToStaticMarkup(React.createElement(pieces.Sortie, { vers: 'Partir', href: '/campagne#carnet', onClick: () => {} }))
  assert.match(partir, /^<a class="lien-discret jour-sortie" href="\/campagne#carnet">.*Partir<\/a>$/, 'un lien, comme « ← Accueil » : il s’ouvre aussi dans un onglet')
  const geste = (danger: boolean) =>
    renderToStaticMarkup(React.createElement(pieces.GesteDuBas, { icone: 'rotate', onClick: () => {}, danger }, 'Recommencer'))
  assert.match(geste(false), /^<button type="button" class="btn btn-block geste-du-bas">.*Recommencer<\/button>$/)
  assert.match(geste(true), /class="btn btn-block geste-du-bas geste-qui-coute"/, 'ce qui coûte une vie le dit')

  // La série, la révision, le défi : partir ramène à l'onglet d'où la partie
  // se reprend — un duel classé ou entre amis, à la page des duels —, et ne
  // se propose plus une fois la dernière réponse donnée — sa fin d'abord.
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  assert.match(page, /const ouAttend: Mode = DUELS \? 'duels' : ecran\.revision \? 'carnet' : ecran\.defi \? 'defi' : 'serie'/)
  assert.match(page, /\{!r\?\.finie && \(\s*<Sortie vers="Partir" href=\{DUELS \? PAGE_DES_DUELS : [^\n]+ onClick=\{partir\} \/>\s*\)\}/)
  assert.match(page, /\{ecran\.revision && !r\?\.finie && \(\s*<GesteDuBas icone="rotate" busy=\{busy\} onClick=\{\(\) => void recommencerLaRevision\(\)\}>/)
  // Les épreuves des sentiers : partir garde l'épreuve en jeu, abandonner
  // coûte une vie — chacun son geste ; celles d'un thème, sans vies, partent.
  const sentiers = readFileSync(client('views/Sentiers.tsx'), 'utf8')
  assert.equal([...sentiers.matchAll(/<Sortie vers="Partir"/g)].length, 2, 'les deux épreuves')
  assert.match(sentiers, /<GesteDuBas icone="flag" danger=\{!e\.rejeu && !valide\} onClick=\{onQuitter\}>\s*Abandonner l’épreuve/)
  assert.match(sentiers, /onPartir=\{\(\) => \{\s*retourAuSentier\(ecran\.epreuve\.branche\)/)
  // Revenu sur son sentier, le palier de l'épreuve laissée dit qu'elle l'attend.
  assert.match(sentiers, /\{laissee\?\.palier === r\.n \? 'Reprendre' : 'Jouer'\}/)
  // Plus un seul bouton fantôme sous une question.
  for (const source of [page, sentiers]) assert.ok(!/serie-recommencer|epreuve-quitter/.test(source), 'les boutons fantômes d’avant')
})

// Une série finie menait à l'accueil de l'application, et il fallait y
// revenir pour changer de catégorie : cinq ou six touchers (un retour de
// joueur du 10 octobre 2026). Sa fin la rejoue sur les mêmes catégories, ou
// rouvre la campagne sur leur choix ; la question offre de recommencer.
test('la fin d’une série la rejoue sur ses catégories, ou en change sans quitter la campagne', async () => {
  const module = await import(client('views/CampagneApp.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const suite = (categories: string[], correctionOuverte = false) =>
    renderToStaticMarkup(
      React.createElement(module.SuiteDeLaSerie, { categories, correctionOuverte, busy: false, onRejouer: () => {}, onChanger: () => {}, onCorrection: () => {} }),
    )
  const une = suite(['Culture générale'])
  assert.match(une, /btn-primary[^>]*>.*Rejouer · Culture générale<\/button>/, 'rejouer d’abord, sur sa catégorie')
  assert.match(une, /Changer de catégorie/)
  assert.ok(une.indexOf('Rejouer') < une.indexOf('Changer de catégorie'))
  assert.match(une, /Mes réponses/)
  assert.match(une, /href="\/"[^>]*>.*Accueil<\/a>/, 'l’accueil reste à un toucher, plus en tête')
  assert.match(suite([]), />Rejouer<\/button>/, 'toutes les catégories : rien à préciser')
  assert.match(suite(['Histoire', 'Sport']), /Rejouer · Histoire et Sport/)
  assert.match(suite(['Histoire', 'Sport', 'Nature']), /Rejouer · 3 catégories/)
  assert.doesNotMatch(suite([], true), /Mes réponses/, 'la correction ouverte ne se redemande pas')
  // La page : le choix retenu sur le téléphone, déplié en arrivant de la fin,
  // et « Recommencer » sous chaque question — jamais au défi, qui n'a qu'une
  // tentative, ni en révision du carnet, qui n'a rien à perdre, ni en
  // rencontre, qui se joue jusqu'au bout.
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  assert.match(page, /useState<string\[\]>\(categoriesRetenues\)/)
  assert.match(page, /<details className="reglages-salon" ref=\{choix\} open=\{choixOuvert\}/)
  assert.match(page, /\{!ecran\.defi && !ecran\.revision && !ecran\.rencontre && !r\?\.finie && \(\s*<GesteDuBas icone="rotate" busy=\{busy\} onClick=\{\(\) => void abandonner\(\)\}>/)
  // Ce que le téléphone a retenu se relit avec méfiance : un stockage abîmé ne casse rien.
  memoire.set('quizz.campagne.categories', JSON.stringify(['Histoire', 42]))
  assert.deepEqual(module.categoriesRetenues(), ['Histoire'])
  memoire.set('quizz.campagne.categories', '{pas du json')
  assert.deepEqual(module.categoriesRetenues(), [])
  memoire.delete('quizz.campagne.categories')
  assert.equal(module.nomDesCategories(['Histoire']), 'Histoire')
  assert.equal(module.nomDesCategories([]), null)
})

// Une série sur un sujet qui traverse les catégories (`shared/sujets.ts`,
// `campagne-sujets.test.ts`) : sa fin le rejoue, et le choix le retient.
test('la fin d’une série à sujet le rejoue, et le téléphone retient le sujet comme les catégories', async () => {
  const module = await import(client('views/CampagneApp.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html = renderToStaticMarkup(
    React.createElement(module.SuiteDeLaSerie, { categories: [], sujet: 'annees-80', correctionOuverte: false, busy: false, onRejouer: () => {}, onChanger: () => {}, onCorrection: () => {} }),
  )
  assert.match(html, /btn-primary[^>]*>.*Rejouer · Les années 80<\/button>/)
  assert.match(html, /Changer de sujet/)
  assert.equal(module.nomDuChoix(['Histoire'], 'pionnieres'), 'Pionnières', 'le sujet l’emporte sur des catégories retenues')
  assert.equal(module.nomDuChoix(['Histoire'], null), 'Histoire')
  assert.equal(module.nomDuChoix([], 'astrologie'), null, 'un sujet inconnu ne se nomme pas')
  // Retenu sur le téléphone ; un sujet qu'il ne connaît plus n'y revient pas.
  memoire.set('quizz.campagne.sujet', 'france')
  assert.equal(module.sujetRetenu(), 'france')
  memoire.set('quizz.campagne.sujet', 'astrologie')
  assert.equal(module.sujetRetenu(), null)
  memoire.delete('quizz.campagne.sujet')
  assert.equal(module.sujetRetenu(), null)
  // La page : un sujet de chaque famille, en grille, sous les catégories ; « Commencer » part sur celui qui se joue.
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  assert.match(page, /useState<string \| null>\(sujetRetenu\)/)
  // La grille vit à part, la même pour la série et pour un défi entre amis (`ChoixDuTheme`) :
  // chaque famille — un thème, une époque, un fil rouge — sa rangée nommée (`FAMILLES_DE_SUJETS`).
  assert.match(page, /<ChoixDuTheme\s+categoriesJouables=\{etat\.categories\.map\(c => c\.categorie\)\}\s+sujets=\{sujets\}\s+categories=\{categories\}\s+sujet=\{sujetJouable\}/)
  const grille = readFileSync(client('components/ChoixDuTheme.tsx'), 'utf8')
  assert.match(grille, /FAMILLES_DE_SUJETS\.map\(\(\{ famille, nom \}\) =>/)
  assert.match(grille, /role="group" aria-label=\{nom\}/)
  assert.match(page, /onClick=\{\(\) => void commencer\(categories, sujetJouable\)\}/)
})

// Le défi entre amis (`campagne-duel.test.ts`) : sa fin l'envoie d'abord —
// celui qui vient de le lancer n'a encore défié personne —, et son lien
// survit à une connexion.
test('la fin d’un défi entre amis l’envoie : son lien écrit, son code, son classement', async () => {
  const module = await import(client('views/Duel.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html = renderToStaticMarkup(React.createElement(module.FinDuDuel, { code: 'K7M2QX', justes: 5, onClassement: () => {} }))
  assert.match(html, /Envoie ce défi/)
  // Sans feuille de partage ni presse-papier — Node n'en a pas —, le lien reste écrit.
  assert.match(html, /<span class="duel-lien">http:\/\/banc\/duels#duel-K7M2QX<\/span>/, 'son lien mène à la page des duels')
  assert.match(html, /son code : <b>K7M2QX<\/b>/)
  assert.match(html, /Le classement du défi/)
  assert.equal(module.texteDuDefi(5), '5 bonnes réponses à ce défi sur FiestApp : feras-tu mieux ?')
  assert.equal(module.texteDuDefi(null), 'Un défi entre amis sur FiestApp : feras-tu mieux que moi ?')
  assert.equal(module.fermeture(0), 'Fermé : son classement est figé')
  // Le nombre tient à son mot (une espace insécable) : « Ferme dans 7 » ne finit plus une ligne.
  assert.equal(module.fermeture(30), 'Ferme dans 30\u00a0minutes')
  assert.equal(module.fermeture(3 * 24 * 60 + 5), 'Ferme dans 3\u00a0jours')
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  // L'ami sans profil se connecte, puis revient sur le défi : `next` garde son fragment.
  assert.match(page, /const retour = encodeURIComponent\(DUELS \? `\$\{PAGE_DES_DUELS\}\$\{codeDuDuel \? adresseDuDuel\(codeDuDuel\) : ''\}` : '\/campagne'\)/)
  assert.match(page, /href=\{`\/\?next=\$\{retour\}`\}/)
  // Une seule tentative : pas de « Recommencer » — le drapeau du défi le dit.
  assert.match(page, /defi: true,\s*duel: code,/)
})

// Le souhait du propriétaire du 11 octobre 2026 : « choisir avec qui je le
// lance, sur quel thème. Quitte à faire le quiz moi et que ça envoie une
// notif à la personne ». « Défier des amis » lançait la partie tout de suite,
// sur les catégories de la série, sans dire à qui elle partirait ; la fin
// cochait d'office toute sa liste d'amis.
test('lancer un défi : avec qui, sur quoi, puis on joue — la page des duels l’ouvre, chaque ami se défie, et sa fin dit à qui il est parti', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const lancer = await import(client('views/LancerUnDefi.tsx').href)
  const duel = await import(client('views/Duel.tsx').href)
  const { SUJETS } = await import('../../shared/sujets')
  const tom = { profileId: 't', nom: 'Tom', avatar: '🐻' }
  const hugo = { profileId: 'h', nom: 'Hugo', avatar: '🐼' }
  const composer = (amis: object[] | null, depart: object) =>
    renderToStaticMarkup(
      React.createElement(lancer.LancerUnDefi, {
        amis,
        categoriesJouables: ['Histoire', 'Sport'],
        sujets: SUJETS.slice(0, 2),
        depart,
        busy: false,
        erreur: '',
        onLancer: () => {},
        onRetour: () => {},
      }),
    )
  // L'ami touché dans la page des duels arrive coché ; les catégories de sa dernière série, choisies.
  const html = composer([tom, hugo], { categories: ['Histoire'], sujet: null, ami: 't' })
  assert.match(html, /<h1>Lance ton défi<\/h1>/)
  assert.match(html, /<span class="defier-numero" aria-hidden="true">1<\/span>Avec qui \?/)
  assert.match(html, /<button type="button" class="duel-ami choisi" aria-pressed="true"><span class="duel-ami-avatar" aria-hidden="true">🐻<\/span><span class="duel-ami-nom">Tom<\/span>/)
  assert.match(html, /<button type="button" class="duel-ami" aria-pressed="false"><span class="duel-ami-avatar" aria-hidden="true">🐼<\/span><span class="duel-ami-nom">Hugo<\/span>/)
  assert.match(html, /<span class="defier-numero" aria-hidden="true">2<\/span>Sur quoi \?<span class="defier-choix">Histoire<\/span>/)
  assert.match(html, /class="categorie-case active" aria-pressed="true"><svg[^>]*>.*?<\/svg>Histoire<\/button>/)
  assert.match(html, /<\/svg>Jouer le défi<\/button>/)
  assert.match(html, /À ta dernière réponse, il part à Tom\u00a0: dans ses duels, et son téléphone sonne s’il a activé les notifications\./)
  assert.match(html, /<a class="lien-discret jour-sortie" href="\/duels">/, '« ← Les duels » : la page d’où l’on vient')
  // Sans ami encore : son lien, à la fin ; avant qu'ils arrivent, leur place.
  const seul = composer([], { categories: [], sujet: null })
  assert.match(seul, /Pas encore d’amis ici/)
  assert.match(seul, /<\/svg>Jouer le défi<\/button>/)
  assert.match(seul, /<span class="defier-choix">toutes les catégories<\/span>/)
  assert.match(composer(null, { categories: [], sujet: null }), /Tes amis arrivent…/)

  // La page des duels : défier un ami, sous « Trouver un adversaire » — ses visages, « Lancer un défi ».
  const carte = renderToStaticMarkup(React.createElement(duel.DefierUnAmi, { amis: [tom, hugo], onLancer: () => {} }))
  assert.match(carte, /<h2 id="defier-un-ami-titre">Défier un ami<\/h2>/)
  assert.match(carte, /<button type="button" class="defier-visage" aria-label="Défier Tom">/)
  assert.match(carte, /<\/svg>Lancer un défi<\/button>/)
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(duel.DefierUnAmi, { amis: null, onLancer: () => {} })), /defier-visage/)
  // Chaque ami se défie d'un toucher, sous « Tes amis ».
  const liste = renderToStaticMarkup(React.createElement(duel.TesAmis, { amis: [tom], onDefier: () => {}, onRetirer: () => {} }))
  assert.match(liste, /aria-label="Défier Tom"><svg[^>]*>.*?<\/svg>Défier<\/button>/)
  // Sa fin dit à qui il est parti — sans promettre une notification qu'ils n'ont peut-être pas voulue.
  const fin = (partiA: string[]) => renderToStaticMarkup(React.createElement(duel.FinDuDuel, { code: 'K7M2QX', justes: 5, partiA, onClassement: () => {} }))
  assert.match(fin(['Tom', 'Hugo']), /Parti à Tom et Hugo\u00a0: il les attend dans leurs duels, et leur téléphone sonne s’ils ont activé les notifications\./)
  assert.match(fin(['Tom']), /Parti à Tom\u00a0: il l’attend dans ses duels, et son téléphone sonne s’il a activé les notifications\./)
  assert.doesNotMatch(fin([]), /Parti à/)

  // La page : `/duels#defier` est son adresse ; « Défier un ami » et chaque ami y mènent ; les amis choisis partent avec le tirage.
  // La campagne ne le propose plus : défier un joueur a sa page (le souhait du propriétaire du 11 octobre 2026).
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  const duels = readFileSync(client('views/Duels.tsx'), 'utf8')
  assert.match(page, /hash === ADRESSE_DU_LANCEMENT\s*\? 'defier'/)
  assert.match(page, /actif=\{mode\}/, 'les onglets de la campagne n’ont plus rien des défis entre amis')
  assert.match(page, /onLancer=\{ouvrirLeLancement\}/)
  assert.match(duels, /<DefierUnAmi amis=\{amis\?\.amis \?\? null\} onLancer=\{onLancer\} \/>/)
  assert.match(duels, /<TesAmis amis=\{amis\.amis\} onDefier=\{onLancer\}/)
  assert.doesNotMatch(page, /Défier des amis/, 'plus de défi entre amis sous la série')
  assert.match(page, /await api\.campagne\.duel\.lancer\(choisi \? \[\] : choisies, choisi, amis\)/)
  assert.doesNotMatch(page, /lancerUnDuel\(categories, sujetJouable\)/, 'plus de défi lancé sans dire à qui')
  // Lancé, il ne se prépare plus : le retour du téléphone, après son classement, ne rouvre pas la préparation.
  assert.match(page, /if \(window\.location\.hash === ADRESSE_DU_LANCEMENT\) \{\s*history\.replaceState\(\{ \.\.\.history\.state, \[LANCEMENT\]: undefined \}, '', `\$\{PAGE_DES_DUELS\}\$\{window\.location\.search\}`\)/)
  // La préparation se charge à la demande — la série ne l'ouvre jamais —, en fond une fois la page montrée.
  assert.match(page, /const lancement = aLaDemande\(\(\) => import\('\.\/LancerUnDefi'\)\)/)
  assert.match(page, /setEcran\(\{ e: 'duels' \}\)\s*\/\/[^\n]*\n\s*void lancement\.charger\(\)\.catch\(\(\) => \{\}\)/)
  assert.doesNotMatch(page, /from '\.\/LancerUnDefi'/, 'aucun import qui l’attacherait à la page')
  // La fin n'y coche plus personne d'office : ceux qu'on défie se choisissent en le lançant.
  assert.doesNotMatch(readFileSync(client('views/Duel.tsx'), 'utf8'), /setChoisis\(new Set\(m\.amis\.filter/)
})

// Qui lance un défi le joue d'abord, et sa fin disait « Défi relevé », comme
// à l'ami qui le relève ; sous « Tes défis entre amis », sa ligne disait
// « 0 joueur · à relever ». On ne relève pas son propre défi : on le lance,
// puis on le joue.
test('son propre défi se lance et se joue, il ne se relève pas : sa fin et sa ligne le disent', async () => {
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  assert.match(page, /<h1>\{ecran\.lance \? 'Défi lancé' : ecran\.defi \? 'Défi relevé' :/)
  // Lancé de la préparation, ou repris de sa page : le drapeau va jusqu'à la fin.
  assert.match(page, /jouerLeDuel\(serie, code, true\)/)
  assert.match(page, /duel: code,\s*\.\.\.\(lance && \{ lance: true as const \}\),/)
  assert.match(page, /\.\.\.\(ecran\.duel && \{ duel: ecran\.duel \}\),\s*\.\.\.\(ecran\.lance && \{ lance: true as const \}\),/)
  assert.match(readFileSync(client('views/Duel.tsx'), 'utf8'), /onJouer\(tentative, code, !!duel\?\.auteur\.toi\)/)

  const { ligneDuDuel } = await import(client('views/Duel.tsx').href)
  const resume = { code: 'K7M2QX', categories: ['Histoire'], minutesRestantes: 7 * 24 * 60, justes: null, rang: null }
  // Le sien, pas encore joué : personne à compter, et il est à jouer.
  assert.deepEqual(ligneDuDuel({ ...resume, auteur: 'toi', joueurs: 0 }), { titre: 'Ton défi', detail: 'Histoire · Ferme dans 7\u00a0jours', score: 'à jouer' })
  // Celui d'un ami, que deux autres ont joué : à relever.
  assert.deepEqual(ligneDuDuel({ ...resume, auteur: 'Léa', joueurs: 2 }), { titre: 'Le défi de Léa', detail: 'Histoire · 2 joueurs · Ferme dans 7\u00a0jours', score: 'à relever' })
  // Joué : sa place.
  assert.equal(ligneDuDuel({ ...resume, auteur: 'toi', joueurs: 1, justes: 5, rang: 1 }).score, '1er · 5 bonnes')
})

// Il menait au sentier lui-même (`#sentier-scene`) : touché pour « la
// campagne », il ouvrait la scène seule, sans les onglets de la campagne, que
// la reprise avait mise en tête (la remarque du propriétaire du 5 octobre
// 2026). Il ouvre la campagne, sur ses sentiers : le sentier qu'il avance y
// est en tête, à un toucher.
test('sur l’accueil, le bouton de la campagne dit le sentier qu’on avance et ses vies, et ouvre la campagne sur ses sentiers', async () => {
  const module = await import(client('components/AccueilDesRoles.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const bouton = (campagne?: object) => {
    const html = renderToStaticMarkup(React.createElement(module.AccueilJouer, { enCours: [], onRejoindre: () => {}, lendemain: null, campagne }))
    const a = html.split('<a ').find(x => x.includes('<b>La campagne</b>'))!
    return { href: a.match(/href="([^"]*)"/)![1], detail: a.match(/<span class="gros-detail">([^<]*)<\/span>/)![1] }
  }
  // Rien de commencé, ou une base qui s'est tue : les deux modes, la série d'abord.
  const deuxModes = { href: '/campagne', detail: 'Une série sans fin, ou les sentiers de tes avatars' }
  assert.deepEqual(bouton(), deuxModes)
  assert.deepEqual(bouton({ vies: 12, avance: null }), deuxModes)
  assert.deepEqual(bouton({ vies: 11, avance: { branche: 'foret', palier: 8, laissee: false } }), {
    href: '/campagne#sentiers',
    detail: 'Vers le palier\u00a08 de la forêt · 11\u00a0vies',
  })
  assert.deepEqual(bouton({ vies: 1, avance: { branche: 'mythes', palier: 3, laissee: true } }), {
    href: '/campagne#sentiers',
    detail: 'Ton épreuve t’attend\u00a0: palier\u00a03 des mythologies · 1\u00a0vie',
  })
  assert.deepEqual(bouton({ vies: 0, avance: { branche: 'espace', palier: 13, laissee: true } }), {
    href: '/campagne#sentiers',
    detail: 'Ton épreuve t’attend\u00a0: palier de maître de l’espace · plus de vie avant minuit',
  })
  // L'accueil le lit dans son profil léger, que le serveur remplit (`sentiers.test.ts`).
  assert.match(readFileSync(client('views/ProfilApp.tsx'), 'utf8'), /campagne=\{'campagne' in profil \? profil\.campagne : undefined\}/)

  // Les défis de ses amis ont quitté ce bouton pour celui des duels, sous le quiz du jour.
  assert.doesNotMatch(readFileSync(client('components/AccueilDesRoles.tsx'), 'utf8'), /campagne#defi/)
})

// Le souhait du propriétaire du 11 octobre 2026 : « Défier un joueur » hors de
// la campagne, une tuile de l'accueil sous le quiz du jour — qui dise à quoi
// on joue, et où l'on en est (`duels.test.ts`).
test('sur l’accueil, le bouton des duels, sous le quiz du jour : qui le défie d’abord, son duel laissé, puis sa ligue, sa cote et sa semaine', async () => {
  const module = await import(client('components/AccueilDesRoles.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html = (duels?: object) => renderToStaticMarkup(React.createElement(module.AccueilJouer, { enCours: [], onRejoindre: () => {}, lendemain: null, duels }))
  const bouton = (duels?: object) => html(duels).split('<a ').find(x => x.includes('<b>Les duels</b>'))!
  // Sous le quiz du jour, avant ce qui se joue à plusieurs.
  const tout = html()
  assert.ok(tout.indexOf('<b>Le quiz du jour</b>') < tout.indexOf('<b>Les duels</b>'))
  assert.ok(tout.indexOf('<b>Les duels</b>') < tout.indexOf('<b>Créer un salon</b>'))
  assert.match(bouton(), /href="\/duels"/)
  assert.match(bouton(), /<span class="gros-detail">Un joueur de ton niveau, son score à battre : monte de ligue<\/span>/)
  const habitue = { cote: 1184, ligue: 'argent', joues: 12, semaine: { duels: 1, ligue: 'argent' } }
  // Un défi qu'un ami lui a envoyé passe devant : qui le défie, une pastille (`campagne-amis.test.ts`).
  const unDefi = bouton({ ...habitue, defisRecus: { n: 1, de: 'Léa' } })
  assert.match(unDefi, /<span class="gros-detail">Léa te défie : à toi de jouer<\/span>/)
  assert.match(unDefi, /<span class="pastille-attente">Un défi<\/span>/)
  assert.match(bouton({ ...habitue, defisRecus: { n: 3, de: 'Tom' } }), /Tom te défie, et 2 autres amis : à toi de jouer.*3 défis/)
  // Puis son duel laissé en route.
  assert.match(bouton({ ...habitue, enCours: { nom: 'Tom' } }), /<span class="gros-detail">Ton duel contre Tom t’attend<\/span>/)
  // Sinon sa ligue, sa cote, et ce qui manque à sa récompense de lundi — ou ce qu'elle rapportera ; son blason à la place de l'icône.
  assert.match(bouton(habitue), /<span class="gros-detail">Ligue d’argent · cote\u00a01184 · encore 2\u00a0duels pour ta récompense<\/span>/)
  assert.match(bouton(habitue), /class="blason blason-argent"/)
  assert.match(bouton({ ...habitue, semaine: { duels: 3, ligue: 'or' } }), /\+30\u00a0confettis lundi/, 'la meilleure ligue de sa semaine')
  // Le lundi, ce que la semaine pass\u00e9e vient de verser, tant que la nouvelle n'a pas son premier duel.
  const lundi = { ...habitue, semaine: { duels: 0, ligue: 'argent' }, semainePassee: { ligue: 'or', confettis: 30 } }
  assert.match(bouton(lundi), /<span class="gros-detail">\+30\u00a0confettis pour ta semaine en ligue d\u2019or \u00b7 encore 3\u00a0duels pour la prochaine<\/span>/)
  assert.match(bouton({ ...lundi, semaine: { duels: 1, ligue: 'argent' } }), /encore 2\u00a0duels pour ta r\u00e9compense/, 'son premier duel jou\u00e9, la semaine qui vient')
  assert.match(readFileSync(client('views/ProfilApp.tsx'), 'utf8'), /duels=\{'duels' in profil \? profil\.duels : undefined\}/)
})

test('l’accueil d’un profil télécharge en fond le code de la campagne, des duels et du quiz du jour', () => {
  const accueil = readFileSync(client('views/ProfilApp.tsx'), 'utf8')
  assert.match(accueil, /import\('\.\/CampagneApp'\)/)
  assert.match(accueil, /import\('\.\/Duels'\)/)
  assert.match(accueil, /import\('\.\/JourApp'\)/)
  assert.match(accueil, /if \(VUE !== 'accueil' \|\| !aUnProfil\) return/, 'à l’accueil, et pour un profil seulement')
})

// Les écrans du profil (`PanneauxDuProfil` : 21 ko et onze morceaux) se
// demandaient dès le profil lu — et, sur un téléphone qui en avait déjà
// montré un, dès le chargement de la page. Sur l'accueil, qui n'en montre
// rien, ils passaient devant son premier écran (mesuré le 11 octobre 2026).
test('l’accueil d’un profil ne fait venir les écrans du profil qu’en fond, une fois montré', () => {
  const page = readFileSync(client('views/ProfilApp.tsx'), 'utf8')
  // Chaque porte qui les demande laisse l'accueil de côté…
  assert.match(page, /useALaDemande\(panneaux, !!profil && VUE !== 'accueil'\)/)
  assert.match(page, /if \(r\.profile && VUE !== 'accueil'\) void panneaux\.charger\(\)/)
  assert.match(page, /onEnvoi=\{VUE === 'accueil' \? undefined : \(\) => void panneaux\.charger\(\)/)
  assert.match(page, /^if \(VUE === 'boutique' \|\| \(VUE === 'profil' && \(profilConnuIci\(\) \|\| lireEcran\(\)\)\)\) void panneaux\.charger\(\)/m)
  // … qui les fait venir avec la campagne et le quiz du jour, quand le navigateur n'a plus rien à faire.
  assert.match(page, /const precharger = \(\) => \{[\s\S]*?void panneaux\.charger\(\)\.catch\(\(\) => \{\}\)\s*\}/)
  // Et aucune autre porte.
  assert.equal([...page.matchAll(/panneaux\.charger\(\)/g)].length, 4)
})
