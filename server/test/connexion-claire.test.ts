// Les écrans de connexion, refaits clairs (la remarque du propriétaire du
// 4 octobre 2026) : l'accueil sans profil et l'entrée d'une soirée
// s'ouvrent sur trois gros boutons — « Jouer sans compte » d'abord, puis
// « Me connecter » et « Créer un profil » —, les champs ne venant qu'avec le
// choix. Et un profil naît d'un prénom et d'un mot de passe : l'identifiant
// s'en déduit, pris par un autre il prend celui que le serveur propose, et
// il ne s'ouvre en champ qu'à la demande.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { demarrer, inscrireProfil } from './banc'
import { MIN_PASSWORD, passwordProblem } from '../src/auth/password'
import { MOTIFS } from '../../shared/erreurs'

const memoire = new Map<string, string>()
Object.assign(globalThis, {
  React,
  // L'entrée tire la liaison de la soirée (`socket.ts`), qui écoute la page :
  // de quoi l'évaluer, sans rien brancher.
  window: { location: { pathname: '/', search: '', hash: '', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false },
  localStorage: { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => memoire.set(k, v), removeItem: (k: string) => memoire.delete(k) },
})
const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url).href
const rendu = async (fichier: string, nom: string, props: object) => {
  const module = await import(client(fichier))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[nom], props))
}
const boutons = (html: string) => [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim())

test('l’accueil sans profil : trois gros boutons, aucun champ', async () => {
  const echappee = React.createElement('button', { type: 'button', className: 'btn btn-accent btn-big btn-block' }, 'Jouer sans compte')
  const html = await rendu('components/ProfilForm.tsx', 'ProfilForm', { echappee, onDone: () => {} })
  assert.deepEqual(boutons(html), ['Jouer sans compte', 'Me connecter', 'Créer un profil'])
  assert.doesNotMatch(html, /<input/, 'les champs attendent le choix')
  // Même format pour les trois : personne ne cherche comment jouer sans compte.
  assert.equal(html.match(/btn-big btn-block/g)?.length, 3)
})

test('l’entrée d’une soirée : les mêmes trois boutons, dans le même ordre', async () => {
  const html = await rendu('components/Entree.tsx', 'Entree', {
    space: { slug: 'chez-nadia', title: 'La soirée de Nadia', eyebrow: 'La soirée', headline: 'de Nadia', dateLine: '', maxPlayers: 150 },
    players: [],
    teams: [],
    profil: null,
    reconnecter: async () => null,
    rejoindre: async () => null,
    oublierProfil: async () => {},
    reprendre: async () => null,
  })
  assert.deepEqual(boutons(html), ['Jouer sans compte', 'Me connecter', 'Créer un profil'])
  assert.doesNotMatch(html, /<input/)
})

// La tablée du 25 octobre 2026 (Jeanne, 360 × 640, texte à 130 %) : « Créer
// un profil », « Créer mon profil », puis « C'est noté » sous le code de
// secours, qu'elle avait fait défiler pour l'atteindre — et l'accueil de son
// profil neuf s'ouvrait défilé au milieu, sa ligne au-dessus du bord : elle
// est remontée, puis redescendue trois fois. Le formulaire et l'accueil sont
// la même page, qui gardait le défilement du formulaire. Une épreuve de
// source : le rendu statique ne joue pas `onDone`.
test('après « C’est noté », l’accueil d’un profil neuf s’ouvre en haut', () => {
  const source = readFileSync(new URL('../../client/src/views/ProfilApp.tsx', import.meta.url), 'utf8')
  const debut = source.indexOf('onDone={(_, info) => {')
  assert.ok(debut > 0, 'le onDone du formulaire, sur l’accueil sans profil')
  const corps = source.slice(debut, source.indexOf('\n        }}', debut))
  const enHaut = corps.indexOf('window.scrollTo(0, 0)')
  assert.ok(enHaut > 0, 'l’accueil qui paraît commence en haut, comme les autres écrans de la page (`ouvrir`, `revenir`)')
  assert.ok(enHaut < corps.indexOf('void relire()'), 'en haut avant que l’accueil se relise : il paraît là où l’on est')
})

test('un profil naît d’un prénom et d’un mot de passe : l’identifiant s’en déduit, sur une ligne', async () => {
  const html = await rendu('components/ProfilForm.tsx', 'ProfilForm', { creer: true, prefill: { name: 'Camille', avatar: '🦊' }, onDone: () => {} })
  assert.match(html, /id="pf-name"/)
  assert.match(html, /id="pf-pass"/)
  assert.doesNotMatch(html, /id="pf-login"/, 'pas de troisième champ')
  assert.match(html, /Pour te reconnecter : <b>camille<\/b>/)
  assert.match(html, />modifier<\/button>/)
  // En connexion, l'identifiant reste un champ : c'est lui qu'on tape.
  const connexion = await rendu('components/ProfilForm.tsx', 'ProfilForm', { onDone: () => {} })
  assert.match(connexion, /id="pf-login"/)
})

// Le retour du propriétaire du 13 octobre 2026 : « Me connecter », un essai
// raté, puis « Je n'en ai pas encore » ouvrait une autre page que « Créer un
// profil » — le champ de l'identifiant ouvert, l'identifiant de l'essai
// dedans (son prénom), et le mot de passe refusé.
test('la création s’ouvre toujours comme « Créer un profil » : rien de ce qu’on a tapé pour se connecter n’y passe', async () => {
  const { champsAuChangement } = await import(client('components/ProfilForm.tsx'))
  const essai = { login: 'antoine', loginTouche: true, loginOuvert: false, password: 'mauvais-mot', name: '' }
  assert.deepEqual(champsAuChangement('inscription', essai), { login: '', loginTouche: false, loginOuvert: false, password: '' })
  // Un prénom déjà tapé à la création, puis un détour par la connexion : l'identifiant s'en déduit, sur sa ligne.
  assert.deepEqual(champsAuChangement('inscription', { ...essai, name: 'Antoine' }), { login: 'antoine', loginTouche: false, loginOuvert: false, password: '' })
  // Vers la connexion, l'identifiant deviné du prénom ne suit pas — ses échecs fermeraient le vrai « camille » ; tapé à la main, il suit.
  const creation = { login: 'camille', loginTouche: false, loginOuvert: false, password: 'motdepasse1', name: 'Camille' }
  assert.equal(champsAuChangement('connexion', creation).login, '')
  assert.equal(champsAuChangement('connexion', { ...creation, login: 'camille42', loginTouche: true }).login, 'camille42')
  // Et le retour au choix ne garde pas l'essai pour la création d'après.
  assert.deepEqual(champsAuChangement('inscription', { ...champsAuChangement('choix', essai), name: '' }), { login: '', loginTouche: false, loginOuvert: false, password: '' })
})

test('un identifiant deviné et pris prend celui que le serveur propose ; tapé à la main, jamais en silence', async () => {
  const { api, ApiError } = await import(client('api.ts'))
  const { inscrireAvecRepli } = await import(client('components/IdentifiantDiscret.tsx'))
  const essais: string[] = []
  const avant = api.joueur.inscription
  api.joueur.inscription = async (champs: { login: string }) => {
    essais.push(champs.login)
    if (champs.login === 'camille') throw new ApiError('« camille » est déjà pris', 'camille2')
    return { profile: { name: 'Camille' }, espace: null, recovery: 'ABCD-EFGH' }
  }
  try {
    const champs = { login: 'camille', password: 'motdepasse1', name: 'Camille', avatar: '🦊' }
    const fait = await inscrireAvecRepli(champs, true)
    assert.equal(fait.login, 'camille2', 'l’identifiant retenu, à noter avec le code')
    assert.deepEqual(essais, ['camille', 'camille2'])
    essais.length = 0
    await assert.rejects(inscrireAvecRepli(champs, false), /déjà pris/)
    assert.deepEqual(essais, ['camille'], 'un identifiant choisi ne se remplace pas')
  } finally {
    api.joueur.inscription = avant
  }
})

// La tablée du 26 octobre 2026 (Jeanne, 71 ans, petit téléphone, texte à
// 130 %) : « mimosa » refusé — « Au moins 8 caractères » —, et le champ
// « Ton identifiant, pour te reconnecter » s'ouvrait entre le mot de passe et
// le message, qui se lisait sous l'identifiant. Le champ de plus, le mot de
// passe retapé, « Créer mon profil » ne tenait plus au-dessus du clavier :
// tout refus de l'inscription ouvrait l'identifiant, quand le commentaire ne
// visait que le sien.
test('seul un refus qui vise l’identifiant en ouvre le champ ; celui du mot de passe se dit au mot de passe', async () => {
  const { ApiError } = await import(client('api.ts'))
  const { refusDeLIdentifiant, refusDuMotDePasse } = await import(client('components/inscription.ts'))
  const mimosa = passwordProblem('mimosa')
  assert.ok(mimosa, 'le serveur refuse six lettres')
  assert.equal(refusDeLIdentifiant(new ApiError(mimosa)), false)
  assert.equal(refusDuMotDePasse(new ApiError(mimosa)), true)
  assert.equal(refusDeLIdentifiant(new ApiError('« camille » est déjà pris', 'camille2')), true)
  assert.equal(refusDeLIdentifiant(new ApiError('Identifiant : 2 à 32 caractères, lettres, chiffres, point, tiret')), true)
  assert.equal(refusDuMotDePasse(new ApiError('Identifiant : 2 à 32 caractères, lettres, chiffres, point, tiret')), false, '« caractères » n’en fait pas un refus du mot de passe')
  // Les trois motifs de `passwordProblem`, et eux seuls : un refus du prénom
  // écrit demain au serveur, « caractères » compris, ne se dirait pas sous le
  // mot de passe (la relecture du lot).
  for (const motif of [passwordProblem(undefined), passwordProblem(''), passwordProblem('x'.repeat(201))]) {
    assert.ok(motif)
    assert.equal(refusDuMotDePasse(new ApiError(motif)), true, motif)
  }
  assert.equal(refusDuMotDePasse(new ApiError('Prénom : 24 caractères au plus')), false, 'un refus du prénom n’est pas celui du mot de passe')
  // Ni le réseau, ni la réserve des inscriptions, ni une exception du navigateur : ils restent sous le formulaire.
  for (const autre of [new ApiError(MOTIFS.reseau), new ApiError('Trop d’inscriptions d’un coup — réessaie dans une minute'), new TypeError('Failed to fetch')]) {
    assert.equal(refusDeLIdentifiant(autre), false, String(autre.message))
    assert.equal(refusDuMotDePasse(autre), false, String(autre.message))
  }
})

// Les mêmes, tels que la page les reçoit du vrai serveur : un motif retouché
// côté serveur ne doit pas rouvrir l'identifiant à un mot de passe trop court.
test('par le vrai serveur : chaque refus de l’inscription va au champ qu’il vise', async () => {
  const banc = await demarrer()
  const { api } = await import(client('api.ts'))
  const { refusDeLIdentifiant, refusDuMotDePasse } = await import(client('components/inscription.ts'))
  // « camille » pris d'avance, par le banc lui-même : sa requête part avant que la page n'emprunte `fetch`.
  await inscrireProfil(banc.url, 'camille', 'Camille')
  const avant = globalThis.fetch
  // La page parle au serveur par des adresses relatives : le banc les lui prête.
  globalThis.fetch = ((u: string, init: RequestInit = {}) => avant(`${banc.url}${u}`, init)) as typeof fetch
  const refus = async (champs: { login: string; password: string | undefined; name: string }) => {
    try {
      await api.joueur.inscription({ ...champs, avatar: '🦊' })
    } catch (e) {
      return { message: (e as Error).message, identifiant: refusDeLIdentifiant(e), motDePasse: refusDuMotDePasse(e) }
    }
    throw new Error(`l’inscription de ${champs.login} est passée`)
  }
  try {
    assert.deepEqual(await refus({ login: 'jeanne', password: 'mimosa', name: 'Jeanne' }), { message: 'Au moins 8 caractères', identifiant: false, motDePasse: true })
    assert.deepEqual(await refus({ login: 'jeanne', password: 'x'.repeat(201), name: 'Jeanne' }), { message: 'Au plus 200 caractères', identifiant: false, motDePasse: true })
    // Sans mot de passe du tout (le JSON le perd) : le troisième motif, ancré comme les deux autres.
    assert.deepEqual(await refus({ login: 'jeanne', password: undefined, name: 'Jeanne' }), { message: 'Il faut un mot de passe', identifiant: false, motDePasse: true })
    assert.deepEqual(await refus({ login: 'camille', password: 'motdepasse1', name: 'Camille' }), { message: '« camille » est déjà pris', identifiant: true, motDePasse: false })
    const court = await refus({ login: 'j', password: 'motdepasse1', name: 'Jeanne' })
    assert.match(court.message, /^Identifiant : 2 à 32 caractères/)
    assert.deepEqual([court.identifiant, court.motDePasse], [true, false])
    // Le prénom manque : ni l'un ni l'autre, le refus reste sous le formulaire.
    assert.deepEqual(await refus({ login: 'jeanne', password: 'motdepasse1', name: ' ' }), { message: 'Il faut un prénom', identifiant: false, motDePasse: false })
  } finally {
    globalThis.fetch = avant
    await banc.close()
  }
})

test('les deux formulaires n’ouvrent l’identifiant que sur son refus, ou quand on le demande', () => {
  for (const fichier of ['components/ProfilForm.tsx', 'components/Entree.tsx']) {
    const source = readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')
    // « modifier » ouvre le champ à la demande ; le reste ne l'ouvre que derrière le refus qui le vise.
    const ouvertures = source.replaceAll('onOuvrir={() => setLoginOuvert(true)}', '').split('setLoginOuvert(true)').slice(0, -1)
    assert.ok(ouvertures.length > 0, `${fichier} : le refus de l’identifiant ouvre encore son champ`)
    for (const avant of ouvertures) assert.match(avant.slice(-80), /refusDeLIdentifiant\(e\)\)\s*\{?\s*$/, `${fichier} : une ouverture sans refus de l’identifiant`)
  }
})

// La même tablée : la règle des huit caractères n'était dite qu'après le
// refus, quand les cinq autres écrans qui font choisir un mot de passe la
// disent d'avance.
test('créer un profil : la règle du mot de passe se dit d’avance, liée à son champ', async () => {
  const html = await rendu('components/ProfilForm.tsx', 'ProfilForm', { creer: true, prefill: { name: 'Camille', avatar: '🦊' }, onDone: () => {} })
  // Le nombre est celui que le serveur exige : la page le dit, elle ne le décide pas.
  const regle = new RegExp(`<span[^>]*id="([^"]+)"[^>]*>${MIN_PASSWORD} caractères au moins</span>`).exec(html)
  assert.ok(regle, '« 8 caractères au moins », dans la tête du champ')
  const champ = /<input[^>]*id="pf-pass"[^>]*>/.exec(html)?.[0] ?? ''
  assert.match(champ, new RegExp(`aria-describedby="${regle[1]}"`), 'le lecteur d’écran la dit avec le champ')
  // La place : le prénom ne dit plus sa limite d'avance — `Limite` la dit quand elle approche.
  assert.doesNotMatch(html, /24 caractères au plus/)
  // Se connecter ne choisit rien : pas de règle à dire.
  const connexion = await rendu('components/ProfilForm.tsx', 'ProfilForm', { onDone: () => {} })
  assert.doesNotMatch(connexion, /8 caractères au moins/)
})

// La relecture du lot : à l'accueil, « mimosa » refusé encadrait le champ de
// « 8 caractères au moins » et de « Au moins 8 caractères », que le lecteur
// d'écran disait l'un après l'autre — l'entrée d'une soirée, elle, remplaçait
// déjà sa règle par le refus. Le champ est maintenant le même aux deux
// endroits (`MotDePasseChoisi`), la règle à sa place de chacun : sous le
// champ, le refus la remplace ; dans sa tête, elle se tait en gardant sa
// place — ôtée, la tête perdait une ligne à 130 %, et le champ sautait sous
// le doigt au refus, puis à la première lettre retapée.
test('le refus du mot de passe fait taire sa règle : un seul texte, une seule description, rien ne saute', async () => {
  const decrit = (html: string) => /<input[^>]*aria-describedby="([^"]*)"/.exec(html)?.[1]
  // Ce que l'œil et l'oreille en reçoivent : un élément `visibility: hidden` ne se voit ni ne se dit.
  const percu = (html: string) => html.replace(/<(\w+)[^>]*style="visibility:hidden"[^>]*>.*?<\/\1>/g, '')
  const refus = passwordProblem('mimosa')
  assert.ok(refus)
  // À côté du libellé à l'accueil, sous le champ à l'entrée d'une soirée : chacune au nombre du serveur.
  for (const [regle, texte] of [['en-tete', `${MIN_PASSWORD} caractères au moins`], ['dessous', `Au moins ${MIN_PASSWORD} caractères.`]]) {
    const props = { id: 'mdp', valeur: '', onChange: () => {}, regle }
    const avant = await rendu('components/MotDePasse.tsx', 'MotDePasseChoisi', { ...props, refus: '' })
    assert.match(avant, new RegExp(`<span[^>]*id="mdp-regle"[^>]*>${texte}</span>`), `${regle} : la règle, dite d'avance`)
    assert.doesNotMatch(avant, /visibility/)
    assert.equal(decrit(avant), 'mdp-regle', `${regle} : le lecteur d'écran la dit avec le champ`)
    assert.doesNotMatch(avant, /aria-invalid|role="alert"/)
    const apres = await rendu('components/MotDePasse.tsx', 'MotDePasseChoisi', { ...props, refus })
    assert.equal(decrit(apres), 'mdp-refus', `${regle} : une seule description, le refus`)
    assert.match(apres, new RegExp(`<input[^>]*>.*<p[^>]*id="mdp-refus"[^>]*>${refus}</p>`), `${regle} : le refus sous le champ`)
    assert.match(apres, /<p[^>]*id="mdp-refus"[^>]*role="alert"/, `${regle} : annoncé dès qu'il paraît`)
    assert.match(/<input[^>]*>/.exec(apres)?.[0] ?? '', /aria-invalid="true"/)
    assert.doesNotMatch(percu(apres), /mdp-regle/, `${regle} : la règle se tait`)
    assert.equal(percu(apres).split('caractères').length - 1, 1, `${regle} : « 8 caractères » ne se lit qu'une fois`)
  }
  // Dans la tête, elle garde sa place, cachée : la même boîte avant et après le refus.
  const tete = (refus: string) => rendu('components/MotDePasse.tsx', 'MotDePasseChoisi', { id: 'mdp', valeur: '', onChange: () => {}, regle: 'en-tete', refus }).then(h => /<div class="field-head">.*?<\/div>/.exec(h)?.[0])
  assert.equal((await tete(refus))?.replace(' style="visibility:hidden"', ''), await tete(''))
})

// Le même relecteur, par un mutant : ôter des deux formulaires la ligne qui
// range le refus du mot de passe sous son champ laissait le fichier vert. Une
// épreuve de source, comme celle des ouvertures de l'identifiant : le rendu
// statique ne joue pas l'envoi.
test('les deux formulaires disent le refus du mot de passe à son champ, et l’effacent à la frappe', () => {
  for (const fichier of ['components/ProfilForm.tsx', 'components/Entree.tsx']) {
    const source = readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')
    assert.match(source, /refusDuMotDePasse\(e\)\)\s*return setMotDePasseRefuse\(motifDe\(e\)\)/, `${fichier} : le refus du mot de passe va à son champ, rien d'autre ne s'ouvre`)
    const champ = /<MotDePasseChoisi[\s\S]*?\/>/.exec(source)?.[0]
    assert.ok(champ, `${fichier} : le mot de passe qu'on choisit passe par MotDePasseChoisi`)
    assert.match(champ, /refus=\{motDePasseRefuse\}/, `${fichier} : le champ reçoit le refus`)
    assert.match(champ, /onChange=[\s\S]*setMotDePasseRefuse\(''\)/, `${fichier} : retaper le mot de passe efface le refus`)
  }
})

// Hugo (lecteur d'écran) : l'accueil n'avait pas de titre — « FiestApp · le
// quiz de soirée » était un paragraphe, « Créer un profil » un titre de
// niveau 2 sans niveau 1, l'accueil connecté aucun —, et l'onglet gardait le
// même nom d'un écran à l'autre. Le Cabinet, lui, les avait.
test('l’accueil a un titre de premier niveau, un seul, sans profil comme connecté', async () => {
  const MARQUE = 'FiestApp · le quiz de soirée'
  const premiers = (html: string) => [...html.matchAll(/<h1([^>]*)>(.*?)<\/h1>/g)]
  const echappee = React.createElement('button', { type: 'button', className: 'btn btn-accent btn-big btn-block' }, 'Jouer sans compte')
  const marque = React.createElement('p', { className: 'accueil-marque', 'aria-hidden': true }, MARQUE)
  // Les trois écrans qu'on ouvre d'emblée : le choix, la création (`?creer=1`), la connexion.
  for (const props of [{ echappee, marque }, { echappee, marque, creer: true }, { marque }]) {
    const html = await rendu('components/ProfilForm.tsx', 'ProfilForm', { ...props, titreDeLaPage: MARQUE, onDone: () => {} })
    const h1 = premiers(html)
    assert.equal(h1.length, 1, html)
    // Caché : le dire à l'écran aurait changé l'accueil, que l'œil lit déjà.
    assert.match(h1[0][1], /class="sr-only"/)
    assert.equal(h1[0][2], MARQUE)
  }
  // La page passe son nom au formulaire, et la marque visible ne le redit pas à l'oreille ; l'onglet suit l'écran.
  const source = readFileSync(new URL('../../client/src/views/ProfilApp.tsx', import.meta.url), 'utf8')
  const formulaire = source.slice(source.indexOf('<ProfilForm'), source.indexOf('/>', source.indexOf('echappee={')))
  assert.match(formulaire, /titreDeLaPage=\{MARQUE\}/)
  assert.match(formulaire, /\bongletParEcran\b/)
  assert.match(formulaire, /<p className="accueil-marque" aria-hidden="true">/)
  assert.doesNotMatch(formulaire, /<h1/)
  // Connecté : « Accueil », comme le profil dit « Mon profil » — et rien d'autre de la page n'en pose un.
  const accueil = source.slice(source.indexOf("if (VUE === 'accueil') {"), source.indexOf("{menu('accueil')}"))
  assert.deepEqual(accueil.match(/<h1[^>]*>[^<]*<\/h1>/g), ['<h1 className="sr-only">Accueil</h1>'])
  const { AccueilJouer } = await import(client('components/AccueilDesRoles.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(AccueilJouer, { enCours: [], onRejoindre: () => {}, lendemain: null })), /<h1/)
})

// La relecture du lot : l'épreuve d'avant gardait la salle d'attente sans
// titre, « sa page a le sien » — elle n'en a pas. Pendant qu'on y crée son
// profil, PlayerApp ne rend que le formulaire : « Créer un profil » y était un
// titre de niveau 2 seul, le défaut même qu'Hugo a relevé à l'accueil. Le nom
// de la soirée lui tient lieu de titre ; l'onglet, lui, garde ce nom-là : on
// revient à la soirée d'un autre onglet, pas à un formulaire.
test('créer un profil dans la salle d’attente : le nom de la soirée en titre, l’onglet de la soirée', async () => {
  const html = await rendu('components/ProfilForm.tsx', 'ProfilForm', { creer: true, titreDeLaPage: 'La soirée de Nadia', onDone: () => {} })
  const h1 = [...html.matchAll(/<h1([^>]*)>(.*?)<\/h1>/g)]
  assert.equal(h1.length, 1, html)
  assert.match(h1[0][1], /class="sr-only"/)
  assert.equal(h1[0][2], 'La soirée de Nadia')
  const source = readFileSync(new URL('../../client/src/views/PlayerApp.tsx', import.meta.url), 'utf8')
  const debut = source.indexOf('if (montrerProfil) {')
  assert.ok(debut > 0, 'le formulaire de la salle d’attente')
  const formulaire = source.slice(source.indexOf('<ProfilForm', debut), source.indexOf('{toast}', debut))
  assert.match(formulaire, /titreDeLaPage=\{snap\.space\.title\}/)
  assert.doesNotMatch(formulaire, /ongletParEcran/, 'l’onglet reste le nom de la soirée (PlayerApp le pose)')
})

// Hugo demandait aussi « un h1 aux écrans de connexion » : à l'entrée d'une
// soirée, « Me connecter », « Garder ma progression · 2/2 », « Note ce code
// de secours », « Retrouver mon profil » et « Reprendre ma place » n'avaient
// qu'un titre de niveau 2. Chaque écran de l'entrée porte le nom de la
// soirée — à l'œil (`JoinHead`), sinon caché. Une épreuve de source : le
// rendu statique n'atteint que le premier écran.
test('chaque écran de l’entrée d’une soirée a son titre de premier niveau', () => {
  const source = readFileSync(new URL('../../client/src/components/Entree.tsx', import.meta.url), 'utf8')
  const etapes = /type Etape = ([^\n]+)/.exec(source)?.[1].match(/'[^']+'/g) ?? []
  assert.equal(etapes.length, 9, 'les étapes de l’entrée')
  const corps = source.slice(source.indexOf('export function Entree('))
  assert.match(corps, /const titreCache = <h1 className="sr-only">\{space\.title\}<\/h1>/)
  // Un écran par étape, chacun sous sa ligne « // ── Écran … ».
  const ecrans = corps.split('// ── Écran').slice(1)
  assert.equal(ecrans.length, etapes.length, 'un écran par étape')
  for (const ecran of ecrans) {
    const nom = ecran.slice(0, ecran.indexOf('\n')).trim()
    assert.match(ecran, /\{salut\}|<JoinHead|<h1|\{titreCache\}/, `l’écran « ${nom} » n’a pas de titre de premier niveau`)
  }
})

test('l’onglet suit l’écran du formulaire de l’accueil', async () => {
  const { ongletDuFormulaire } = await import(client('components/ProfilForm.tsx'))
  assert.equal(ongletDuFormulaire('choix'), null, 'le choix garde le nom de la page')
  assert.equal(ongletDuFormulaire('inscription'), 'Créer un profil · FiestApp')
  assert.equal(ongletDuFormulaire('connexion'), 'Me connecter · FiestApp')
  assert.equal(ongletDuFormulaire('secours'), 'Retrouver mon profil · FiestApp')
  assert.equal(ongletDuFormulaire('code'), 'Ton profil est prêt · FiestApp')
  assert.equal(ongletDuFormulaire('nouveau-code'), 'Note ton nouveau code · FiestApp')
})
