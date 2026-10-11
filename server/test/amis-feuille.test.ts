// La feuille des amis et la page des duels allégée, rendues (le souhait du
// propriétaire du 11 octobre 2026 : « une fenêtre avec la liste des amis
// […] la plus facile et claire possible, sans trop de choses qui
// encombrent » ; « le classement dans la page comme ça ne me convient pas,
// un bouton voir le classement » ; « reprendre comme de partout la carte qui
// s'affiche du joueur »). La feuille monte sur la page qu'on regarde : un seul
// champ, des lignes qui ouvrent la carte du joueur — ni épée ni croix —, et
// les gestes au pied de la carte. La page des duels garde ce qu'on y vient
// faire ; le classement et les amis ont chacun leur porte.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'

const memoire = new Map<string, string>()
Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/', search: '', hash: '', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false },
  localStorage: { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => memoire.set(k, v), removeItem: (k: string) => memoire.delete(k) },
})
const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)
const source = (f: string) => readFileSync(client(f), 'utf8')

const tom = { profileId: 't', nom: 'Tom', avatar: '🐻', cote: 1240, ligue: 'or', rang: 3 }
const hugo = { profileId: 'h', nom: 'Hugo', avatar: '🐼' }
const zoe = { profileId: 'z', nom: 'Zoé', avatar: '🐸' }

test('la feuille des amis : un seul champ, des lignes qui ouvrent la carte — ni épée ni croix —, « en ligne » sur un ami réciproque', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { ListeDesAmis } = await import(client('views/Amis.tsx').href)
  const rendre = (props: object) => renderToStaticMarkup(React.createElement(ListeDesAmis, { onOuvrir: () => {}, ...props }))

  // Vide : qui l'a ajouté, puis sa liste ; Tom, ami réciproque passé à l'instant, porte son point.
  const vide = rendre({ cercle: { amis: [{ ...tom, enLigne: true }, hugo], tOntAjoute: [zoe] }, texte: '', trouves: null })
  assert.match(vide, /<h3 id="amis-ajoute-titre" class="label">Ils t’ont ajouté<\/h3>.*La carte de Zoé.*<h3 id="amis-liste-titre" class="label">Tes amis<\/h3>/s)
  assert.match(vide, /<button type="button" class="ligne-joueur ligne-joueur-ouvrable" aria-label="La carte de Tom — Or · cote 1240 · 3e, en ligne">/)
  assert.match(vide, /<button type="button" class="ligne-joueur ligne-joueur-ouvrable" aria-label="La carte d’Hugo — pas encore de duel classé">/)
  assert.equal(vide.match(/duel-ami-avatar en-ligne/g)?.length, 1, 'Hugo, rien : l’absence, pas « hors ligne »')
  assert.match(vide, /en ligne : un ami qui t’a ajouté aussi, passé ces cinq dernières minutes/)
  assert.doesNotMatch(vide, /duels-epee|Retirer|Défier|Ajouter un ami/, 'aucun bouton sur une ligne : ses gestes sont sur sa carte')
  assert.doesNotMatch(rendre({ cercle: { amis: [tom, hugo], tOntAjoute: [] }, texte: '', trouves: null }), /en ligne/, 'personne en ligne : ni point, ni légende')

  // Tapé : ses amis que le texte désigne, puis les autres joueurs — un ami trouvé ne paraît pas deux fois.
  const tape = rendre({
    cercle: { amis: [tom, hugo], tOntAjoute: [] },
    texte: 'to',
    trouves: [{ ...tom, ami: true }, { profileId: 'b', nom: 'Tobias', avatar: '🐯' }],
  })
  assert.match(tape, /Tes amis<\/h3>.*La carte de Tom.*Autres joueurs<\/h3>.*La carte de Tobias/s)
  assert.equal(tape.match(/La carte de Tom/g)?.length, 1)
  assert.doesNotMatch(tape, /La carte d’Hugo/)
  // Une lettre suffit à ses amis ; sans accents, « hu » trouve Hugo, « zo » Zoé.
  assert.match(rendre({ cercle: { amis: [tom, hugo], tOntAjoute: [] }, texte: 'H', trouves: null }), /La carte d’Hugo/)
  assert.match(rendre({ cercle: { amis: [{ ...zoe }], tOntAjoute: [] }, texte: 'zoe', trouves: [] }), /La carte de Zoé/)
  assert.match(rendre({ cercle: { amis: [], tOntAjoute: [] }, texte: 'xy', trouves: [] }), /Personne ne s’appelle « xy » ici\./)
  // Avant qu'elle arrive, sa place ; sans ami encore, comment en ajouter.
  assert.match(rendre({ cercle: null, texte: '', trouves: null }), /aria-busy="true">Tes amis arrivent…/)
  assert.match(rendre({ cercle: { amis: [], tOntAjoute: [] }, texte: '', trouves: null }), /Tape le prénom d’un ami ci-dessus : sa carte s’ouvre, et « Ajouter à mes amis » le met dans ta liste/)

  // Le champ, sans autoFocus : le clavier pousserait la feuille hors de l'écran.
  const feuille = source('views/Amis.tsx')
  assert.match(feuille, /<ChampDUnPrenom libelle="Chercher un ami, ou quelqu’un à ajouter, par son prénom"/)
  assert.doesNotMatch(feuille + source('views/Joueurs.tsx'), /\sautoFocus[\s=/>]/)
  assert.match(feuille, /onOuvrir=\{j => ouvrir\(j\.profileId, repliDe\(j\)\)\}/, 'toucher une ligne ouvre sa carte, et ce que la ligne disait de lui si elle ne s’ouvre pas')
})

test('les gestes au pied de la carte : « Défier » en grand, l’ajouter ou le retirer — confirmé sur place', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { GestesVue } = await import(client('components/GestesDuJoueur.tsx').href)
  const gestes = (joueur: object, aConfirmer = false) =>
    renderToStaticMarkup(
      React.createElement(GestesVue, { joueur, aConfirmer, busy: false, erreur: '', onDefier() {}, onAjouter() {}, onRetirer() {}, onConfirmer() {}, onGarder() {} }),
    )
  const inconnu = gestes(tom)
  assert.match(inconnu, /<button type="button" class="btn btn-primary btn-block"><svg[^>]*>.*?<\/svg><span class="carte-gestes-nom">Défier Tom<\/span><\/button>/)
  assert.match(inconnu, /<\/svg>Ajouter à mes amis<\/button>/)
  assert.doesNotMatch(inconnu, /Retirer/)
  const ami = gestes({ ...tom, ami: true })
  assert.match(ami, /<\/svg> Dans tes amis<\/span>/)
  assert.match(ami, /aria-label="Retirer Tom de mes amis"/)
  assert.doesNotMatch(ami, /Ajouter à mes amis/)
  const aConfirmer = gestes({ ...tom, ami: true }, true)
  assert.match(aConfirmer, /Retirer Tom de tes amis \? Ses duels ne te parviendront plus ; tu pourras le rajouter par son prénom\./)
  assert.match(aConfirmer, />Retirer<\/button><button type="button" class="btn btn-ghost btn-small">Garder<\/button>/)
  assert.doesNotMatch(aConfirmer, /Défier Tom/, 'on confirme d’abord')

  // Chargés avec la carte d'un profil seulement : celle d'une soirée n'en a pas, et la salle ne les télécharge jamais.
  const carte = source('components/CarteJoueur.tsx')
  assert.match(carte, /const lesGestes = aLaDemande\(\(\) => import\('\.\/GestesDuJoueur'\)\)/)
  assert.doesNotMatch(carte, /^import \{[^}]*\} from '\.\/GestesDuJoueur'/m, 'aucun import qui les attacherait à la carte de la salle')
  assert.match(carte, /\{gestes && desGestes && desGestes !== 'perdu' && <desGestes\.GestesDuJoueur gestes=\{gestes\} visibles=\{!loupe\} onFermer=\{onFermer\} \/>\}/)
  assert.match(source('views/PlayerApp.tsx'), /<laCarte\.CarteJoueur slug=\{slug\} playerId=\{carte\} onFermer=\{\(\) => setCarte\(null\)\} \/>/, 'en soirée, la carte n’a pas de gestes')
  // Partout où s'ouvre la carte d'un profil hors d'une soirée, ses gestes viennent avec : le classement du jour, les défis, les duels, les amis.
  assert.equal(source('views/JourApp.tsx').match(/gestes=\{\{ profileId: carte \}\}/g)?.length, 2)
  assert.match(source('components/CarteDUnProfil.tsx'), /adresse=\{`\/api\/joueur\/carte\/\$\{encodeURIComponent\(carte\)\}`\}\s*gestes=\{\{ \.\.\.gestes, profileId: carte \}\}/)
  for (const page of ['views/Defi.tsx', 'views/Duel.tsx', 'views/Duels.tsx', 'views/Amis.tsx']) assert.match(source(page), /useCarteDUnProfil\(/, page)
})

test('la page des duels : le classement derrière « Voir le classement », les amis derrière « Mes amis » — et sa place en tête du classement', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { FeuilleDuClassement } = await import(client('views/Duels.tsx').href)
  const ligne = (profileId: string, nom: string, cote: number, ligue: string, rang: number) => ({ profileId, nom, avatar: '🐻', niveau: 3, cote, ligue, rang, duels: 12 })
  const classement = { joueurs: 5, lignes: [ligne('a', 'Ana', 1320, 'platine', 1), ligne('t', 'Tom', 1240, 'or', 2), ligne('m', 'Moi', 1100, 'argent', 3)], sienne: 'm' }
  const html = renderToStaticMarkup(React.createElement(FeuilleDuClassement, { classement, onOuvrir() {}, onFermer() {} }))
  assert.match(html, /<b class="feuille-titre">Le classement des duels<\/b>/)
  assert.match(html, /<b>Tu es 3ᵉ<\/b><span class="muted small">sur 5 · Argent · cote 1100<\/span>/, 'sa place d’abord : c’est ce qu’il vient chercher')
  assert.match(html, /<button type="button" class="lb-row lb-ouvrable duels-ligne" aria-label="La carte de Tom — rang 2, ligue d’or, cote 1240">/)
  assert.doesNotMatch(html, /duels-epee|Défier/, 'plus d’épée sur les lignes : « Défier » est sur la carte')
  // Hors du classement, il le sait aussi.
  const sansLui = renderToStaticMarkup(React.createElement(FeuilleDuClassement, { classement: { ...classement, sienne: undefined }, onOuvrir() {}, onFermer() {} }))
  assert.doesNotMatch(sansLui, /Tu es/)
  assert.match(sansLui, /Un duel joué te place ici, quatre semaines durant\./)

  // La page : deux portes sous « Défier quelqu'un », chacune sa feuille ; plus de classement ni de liste d'amis en entier.
  const page = source('views/Duels.tsx')
  assert.match(page, /<PortesDesDuels amis=\{amis\?\.amis\.length\} onClassement=\{etat \? \(\) => setClassementOuvert\(true\) : undefined\} onAmis=\{feuilleDesAmis\.ouvrir\} \/>/)
  assert.match(page, /Voir le classement\s*<\/button>/)
  assert.match(page, /\{classementOuvert && etat && <FeuilleDuClassement classement=\{etat\.classement\} onOuvrir=\{ouvrir\} onFermer=\{\(\) => setClassementOuvert\(false\)\} \/>\}/)
  assert.doesNotMatch(page, /ClassementDesDuelsVue|TesAmis|duels-epee/)
  assert.doesNotMatch(source('views/Duel.tsx'), /export function TesAmis/)
  // Le squelette garde la place des portes : rien ne saute quand la page arrive.
  assert.match(page, /<BoutonsDesDuels busy auHasard reprendre=\{null\}[^/]*\/>\s*<PortesDesDuels \/>/)
  // Ses duels joués, repliés : ils ne se rendent — ni ses défis d'avant ne se demandent — qu'au dépli.
  assert.match(page, /\{ouvert && \(\s*<div className="duels-joues-corps">/)
  assert.match(page, /\{etat\?\.contre && <TesDuelsContre duels=\{etat\.contre\} recus=\{amis\?\.recus \?\? \[\]\} onOuvrir=\{onOuvrirDuel\} \/>\}/, 'ses duels en route restent en vue')
  const { duelEnRoute } = await import(client('views/Duel.tsx').href)
  const duel = { code: 'K7M2QX', contre: { profileId: 't', nom: 'Tom', avatar: '🐻' }, lance: true, justes: 5, sesJustes: null, minutesRestantes: 60 }
  assert.equal(duelEnRoute(duel), true, 'à l’autre de jouer : en route')
  assert.equal(duelEnRoute({ ...duel, sesJustes: 4 }), false, 'joué des deux côtés')
  assert.equal(duelEnRoute({ ...duel, minutesRestantes: 0 }), false, 'fermé')
})

test('« Amis » sur l’accueil d’un profil : la feuille monte sur la page, chargée à la demande', () => {
  const accueil = source('views/ProfilApp.tsx')
  assert.match(accueil, /<div className="accueil-tete">\s*<IdentiteLigne profil=\{profil\} \/>\s*<BoutonDesAmis \/>\s*<\/div>/)
  assert.match(accueil, /import \{ BoutonDesAmis, lesAmis \} from '\.\.\/components\/FeuilleDesAmisADemande'/)
  assert.doesNotMatch(accueil, /from '\.\/Amis'|from '\.\.\/views\/Amis'/, 'la feuille ne pèse rien sur l’accueil')
  assert.match(accueil, /void lesAmis\.charger\(\)\.catch\(\(\) => \{\}\)/, 'en fond, une fois l’accueil montré')
  assert.match(source('components/FeuilleDesAmisADemande.tsx'), /export const lesAmis = aLaDemande\(\(\) => import\('\.\.\/views\/Amis'\)\)/)
})

test('la préparation d’un duel s’ouvre à son adresse, contre celui que la carte a défié', async () => {
  const { adresseDuLancementContre, estLeLancement, profilDuLancement } = await import(client('views/adressesDesDuels.ts').href)
  assert.equal(adresseDuLancementContre('a1b2'), '#defier-a1b2')
  assert.equal(profilDuLancement('#defier-a1b2'), 'a1b2')
  assert.equal(profilDuLancement(adresseDuLancementContre('é/?')), 'é/?')
  assert.equal(profilDuLancement('#defier'), null)
  assert.equal(profilDuLancement('#defier-'), null)
  assert.equal(profilDuLancement('#defier-%E0%A4%A'), null, 'un fragment mal formé ne défie personne')
  assert.equal(profilDuLancement('#duel-K7M2QX'), null)
  assert.equal(estLeLancement('#defier'), true)
  assert.equal(estLeLancement('#defier-a1b2'), true)
  assert.equal(estLeLancement('#defierx'), false)
  assert.equal(estLeLancement('#duel-K7M2QX'), false)
  // Sans `onDefier` (l'accueil, le quiz du jour, un défi), « Défier » mène là ; la page des duels relit qui, sa cote avec.
  assert.match(source('components/GestesDuJoueur.tsx'), /window\.location\.assign\(`\$\{PAGE_DES_DUELS\}\$\{adresseDuLancementContre\(joueur\.profileId\)\}`\)/)
  const campagne = source('views/CampagneApp.tsx')
  assert.match(campagne, /\.joueur\(contreQui\)\s*\.then\(f => vivant && setDepart\(\{ categories, sujet, adversaire: f\.joueur, moi: f\.moi \}\)\)/)
  assert.match(campagne, /if \(!laPreparation \|\| laPreparation === 'perdu' \|\| !etatPourLancer \|\| adversaireAttendu\) \{/, 'la préparation attend celui qu’elle défie : elle ne s’ouvre pas libre pour sauter sur lui')
})
