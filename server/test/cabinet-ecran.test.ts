// Les écrans du Cabinet de curiosités, rendus en HTML (`renderToStaticMarkup`)
// sur la page qu'un vrai serveur rend à une joueuse — le musée, une salle, une
// œuvre et son cartel, les gardiens, la visite du jour, les jeux libres, les
// règles —, l'adresse de chacun, la page sans profil, et ce que la page
// demande au serveur (`api.cabinet`), jusqu'au geste passé que le serveur
// refuse en rendant la partie d'à présent. Sans navigateur : aucun effet ne
// tourne, seul le premier rendu se lit ; les écrans se regardent au
// téléphone par la skill `regarder-le-rendu`.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { inscrireProfil } from './banc'
import { bancDuCabinet, commencer, fermerLesMagasins, jouer, laPage, ok, unPariParfait, type BancDuCabinet } from './cabinet-banc'
import { importsStatiques } from './chemin-des-imports'
import { CHASSES_PAR_JOUR, LIBRES_QUI_PAIENT, PRIX_D_UNE_DORURE, PRIX_D_UNE_OEUVRE, SEUILS_DES_RARETES } from '../../shared/cabinet/bareme'
import { CLES_DES_JEUX, JEUX } from '../../shared/cabinet/jeux/regle'
import { JEU_DE_L_OEUVRE, OEUVRES } from '../../shared/cabinet/oeuvres'
import { JEUX_PRETS } from '../../shared/cabinet/ouverture'
import { POUVOIRS, forceDite } from '../../shared/cabinet/pouvoirs'
import { GARDIENS, GARDIENS_DES_SALLES, SALLES } from '../../shared/cabinet/salles'
import type { Cartel, PageDuCabinet, SalleVue, VueDeLaPartie } from '../../shared/cabinet/vues'
import { DEPART, donneesDeDepart } from '../../shared/depart'
import { parseRoute } from '../../shared/adresses'
import { GLOSSAIRE } from '../../shared/glossaire'
import { legendaire } from '../../shared/legendaires'
import { pageDeLAdresse } from '../../shared/maintenance'
import { CABINET_SANS_PROFIL } from '../src/cabinet'

// Le client compile son JSX pour un `React` global, et `state.ts` lit son adresse à l'import : posés avant tout composant.
Object.assign(globalThis, { React, window: { location: { pathname: '/cabinet', search: '', hash: '', origin: 'http://banc' }, addEventListener: () => {} } })

const client = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/src')
const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href
const source = (fichier: string) => readFileSync(path.join(client, fichier), 'utf8')

/** Un composant du client, rendu en HTML. */
async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(url(`${fichier}.tsx`))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** Ce qu'on lit d'un rendu : son texte, sans balises, les espaces insécables en espaces. */
const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/[  ⁠]/g, ' ')
    .replace(/\s+/g, ' ')

/**
 * Les mots de l'écran (règle `cabinet.md`) : « œuvre », « carte-bonus »,
 * « carte de France », jamais « carte » seule — l'Expédition a dû rebaptiser
 * la sienne « le plan » —, et ni « badge » ni « médaille », que le lexique
 * des récompenses a remplacés (règle `recompenses.md`).
 */
function sansJargon(html: string, ou: string) {
  const t = texte(html)
  assert.doesNotMatch(t, /\bcartes?\b(?!-bonus| de France)/i, `${ou} : « carte » seule`)
  assert.doesNotMatch(t, /\bbadges?\b|médaille/i, `${ou} : le lexique des récompenses`)
  assert.doesNotMatch(html, /autoFocus|autofocus/, `${ou} : aucun champ ne prend le focus d'office`)
}

const rien = () => {}
const nom = (cle: string) => legendaire(cle)!.nom

// ── Une joueuse et son musée, par les vraies routes ───────────────────────

let b: BancDuCabinet
let cookie: string
/** Son musée neuf : les quatre œuvres de départ, rien d'autre. */
let neuf: PageDuCabinet
/** Puis une chasse au Pari, parfaite — Leçon gagnée dans un cadre doré —, et la première case de la visite quittée. */
let page: PageDuCabinet

before(async () => {
  b = await bancDuCabinet()
  cookie = await inscrireProfil(b.banc.url, 'lea', 'Léa')
  neuf = ok(await laPage(b, cookie), 'la page neuve')
  const chasse = ok(await commencer(b, cookie, { origine: 'chasse', oeuvre: 'lecon', carte: null }), 'la chasse')
  await unPariParfait(b, cookie, chasse)
  const visite = ok(await commencer(b, cookie, { origine: 'visite', case: 0, carte: null }), 'la visite')
  ok(await jouer(b, cookie, visite, { quoi: 'quitter' }), 'quitter')
  page = ok(await laPage(b, cookie), 'la page jouée')
})
after(() => b?.banc.close())
after(fermerLesMagasins)

const salleDe = (p: PageDuCabinet, cle: string) => p.salles.find(s => s.cle === cle)!

// ── 1. Une page de plus ───────────────────────────────────────────────────

test('/cabinet est une page : son code à part, son nom d’onglet, sa donnée préchargée avec elle, sa maintenance', async () => {
  assert.deepEqual(parseRoute('/cabinet'), { kind: 'account', page: 'cabinet' })
  // Demandée par tout visiteur dès son code arrivé — un invité reçoit 401, la page le lit —, avec le profil léger du thème.
  assert.deepEqual(donneesDeDepart(parseRoute('/cabinet')), [DEPART.cabinet, DEPART.moiLeger])
  const { titreDePage } = (await import(url('titres.ts'))) as { titreDePage: (p: string) => string }
  assert.equal(titreDePage('cabinet'), 'Le Cabinet de curiosités · FiestApp')
  // La page fermée au QG se remplace par l'écran qui le dit, son code ne part pas.
  assert.equal(pageDeLAdresse(parseRoute('/cabinet')), 'cabinet')
  const racine = source('main.tsx')
  assert.match(racine, /const CabinetApp = \(\) => import\('\.\/views\/CabinetApp'\)\.then\(m => m\.CabinetApp\)/)
  assert.match(racine, /cabinet: CabinetApp,/)
  // Elle lit le profil : son thème, sa niche, comme la campagne (`themes.test.ts` le vérifie de l'autre côté).
  assert.match(racine, /LISENT_LE_PROFIL = new Set<unknown>\(\[[^\]]*\bCabinetApp\b/)
  // Demandée d'emblée, à l'adresse même que la page servie précharge, et l'heure remesurée sur le préchargement.
  const page_ = source('views/CabinetApp.tsx')
  assert.match(source('api.ts'), /page: \(\) => avecLHeure\(\(\) => req<PageDuCabinet>\(DEPART\.cabinet\), DEPART\.cabinet\)/)
  assert.match(page_, /const premiere = api\.cabinet\.page\(\)/)
  // Le toast rendu par la page (l'Expédition ne le rendait pas), l'horloge remise à zéro au retour au premier plan.
  assert.match(page_, /toast && \(\s*<div className=\{`toast toast-\$\{toast\.kind\} cab-toast`\}/)
  assert.match(page_, /if \(document\.visibilityState === 'visible'\) \{\s*resetClock\(\)/)
})

test('la page ne télécharge ni les règles de l’Expédition, ni celles qui jugent une partie, ni la liaison temps réel', () => {
  // Les dessins de ses gardiens viennent à la demande : `medaillons.test.ts` le garde, avec ceux des autres pages.
  const chemin = importsStatiques(path.join(client, 'views/CabinetApp.tsx'))
  // Le parcours voit bien le chemin : sinon ce test ne garderait rien.
  for (const f of ['views/cabinet/Musee.tsx', 'views/cabinet/Salle.tsx', 'components/OeuvrePeinte.tsx', 'components/Avatar.tsx']) {
    assert.ok(chemin.has(path.join(client, f)), `${f} est sur le chemin`)
  }
  for (const f of ['views/RencontresDExpedition.tsx', 'views/ExpeditionApp.tsx', 'socket.ts']) {
    assert.ok(!chemin.has(path.join(client, f)), `${f} ne part pas avec le Cabinet`)
  }
  // Ni les rencontres (4 782 lignes), ni les règles qui jugent une partie : la page lit la vue du serveur.
  for (const f of ['shared/rencontres.ts', 'shared/expedition.ts', 'shared/cabinet/partie.ts', 'shared/cabinet/lecture.ts', 'server/src/core/divins.ts']) {
    assert.ok(!chemin.has(path.resolve(client, '../..', f)), `${f} ne part pas avec le Cabinet`)
  }
})

// ── 2. Les adresses des écrans ────────────────────────────────────────────

test('chaque écran du musée a son adresse, et une adresse inconnue ouvre le musée', async () => {
  const { ecranDeLAdresse, adresseDe } = await import(url('views/cabinet/ecrans.ts'))
  const ecrans = [
    { e: 'musee' },
    { e: 'gardiens' },
    { e: 'visite' },
    { e: 'libre' },
    ...SALLES.map(s => ({ e: 'salle', salle: s.cle })),
    ...OEUVRES.map(o => ({ e: 'oeuvre', oeuvre: o.cle })),
  ]
  for (const ecran of ecrans) assert.deepEqual(ecranDeLAdresse(adresseDe(ecran)), ecran, adresseDe(ecran))
  assert.equal(adresseDe({ e: 'salle', salle: 'rempart' }), '#salle-rempart')
  assert.equal(adresseDe({ e: 'oeuvre', oeuvre: 'bastion' }), '#oeuvre-bastion')
  // Une clé venue de l'adresse se lit par sa fonction : le prototype d'un objet n'est ni une salle ni une œuvre.
  for (const h of ['', '#', '#salle-constructor', '#oeuvre-constructor', '#oeuvre-lg:phenix', '#salle-', '#partie', '#murs-x']) {
    assert.deepEqual(ecranDeLAdresse(h), { e: 'musee' }, h)
  }
})

// ── 3. Le musée ───────────────────────────────────────────────────────────

const musee = (p: PageDuCabinet, plus: object = {}) =>
  rendu('views/cabinet/Musee', 'Musee', { page: p, accueil: { bienvenue: false, rapportees: 0 }, onRegles: rien, onReprendre: rien, onLu: rien, ...plus })

test('le musée : ce qu’il possède, la visite du jour, les neuf salles, les gardiens, les jeux libres, les règles', async () => {
  const html = await musee(page)
  const t = texte(html)
  assert.match(t, /Ton musée/)
  // Les quatre de départ et Leçon ; les gardiens qu'il a — aucun ici.
  assert.match(t, new RegExp(`5 œuvres sur ${OEUVRES.length} · 0 gardien sur ${GARDIENS.length}`))
  assert.match(html, /class="cab-jauge"/)
  // Le solde de sa poussière d'or, que la chasse et la visite quittée ont rapporté.
  assert.ok(page.poussiere > 0)
  assert.match(t, new RegExp(`${page.poussiere} poussières d’or`))
  // La visite du jour : une case faite sur celles de la page.
  assert.match(t, new RegExp(`La visite du jour .*1 sur ${page.visite.cases.length} faite`))
  assert.match(html, /href="#visite"/)
  // Les neuf salles, dans l'ordre du Cabinet, chacune son compte et son adresse.
  const ordre = SALLES.map(s => html.indexOf(`href="#salle-${s.cle}"`))
  assert.ok(ordre.every(i => i > 0), ordre.join(','))
  assert.deepEqual(ordre, [...ordre].sort((a, c) => a - c))
  assert.match(t, /L’Érudit 1 sur 8/)
  assert.match(t, /Le Vestibule 4 sur 20/)
  // Une salle sans œuvre à lui ne montre la peinture d'aucune : on la découvre en la gagnant.
  const rempart = /<a class="cab-porte[^"]*" href="#salle-rempart">.*?<\/a>/.exec(html)?.[0] ?? ''
  assert.doesNotMatch(rempart, /<img/)
  assert.match(/<a class="cab-porte[^"]*" href="#salle-erudit">.*?<\/a>/.exec(html)?.[0] ?? '', /<img[^>]*src="\/cartes\/lecon-240\./)
  // Ce qui reste aujourd'hui, sans un mot de règle : la page n'en dit pas en paragraphes.
  assert.match(t, new RegExp(`${CHASSES_PAR_JOUR - 1} chasse aujourd’hui`))
  assert.match(html, /href="#gardiens"/)
  assert.match(html, /href="#libre"/)
  assert.match(t, /Comment ça marche/)
  // Le prochain gardien : la salle la plus près d'être complète, et ce qui lui manque.
  assert.ok(page.gardiens.prochain)
  assert.match(t, new RegExp(page.gardiens.prochain.dit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  sansJargon(html, 'le musée')
})

test('le musée dit une fois la bienvenue, les œuvres rapportées, la partie qui l’attend, l’expédition en route, sa fête et sa série', async () => {
  // Une joueuse qui arrive : la bienvenue, et les règles à un toucher.
  const bienvenue = texte(await musee(neuf, { accueil: { bienvenue: true, rapportees: 0 } }))
  assert.match(bienvenue, /Bienvenue au Cabinet/)
  assert.match(bienvenue, /Comment ça marche/)
  assert.doesNotMatch(texte(await musee(neuf)), /Bienvenue au Cabinet/)
  // Les œuvres rapportées de l'Expédition, dites d'un coup, une fois.
  const rapportees = { ...neuf, rapportees: 41 }
  assert.match(texte(await musee(rapportees, { accueil: { bienvenue: false, rapportees: 0 } })), /Tu as rapporté 41 œuvres de l’Expédition/)
  assert.doesNotMatch(texte(await musee(rapportees, { accueil: { bienvenue: false, rapportees: 41 } })), /rapporté/)
  // Une partie en cours passe devant tout : on la reprend.
  const enCours = { ...neuf, enCours: { id: 'p', jeu: 'pari', origine: 'chasse' } as VueDeLaPartie }
  const t = texte(await musee(enCours))
  assert.match(t, new RegExp(`Ta partie ${JEUX.pari.a} t’attend`))
  assert.ok(t.indexOf('t’attend') < t.indexOf('La visite du jour'))
  // L'expédition en route, la fête du moment et son gardien, la série à garder.
  const tout = texte(
    await musee({
      ...neuf,
      expedition: 'en-route',
      fete: { cle: 'halloween', nom: 'Halloween', gardien: { legendaire: 'lg:citrouille', dit: 'Gagne une œuvre, et la Citrouille se réveillera.' } },
      serie: { jours: 12, aJouer: true, record: 12 },
    }),
  )
  assert.match(tout, /Ton expédition t’attend : la finir/)
  assert.match(tout, /Halloween .*Gagne une œuvre, et la Citrouille se réveillera\./)
  assert.match(tout, /12 jours de visite d’affilée\. Joue aujourd’hui pour garder ta série\./)
})

// ── 4. Une salle ──────────────────────────────────────────────────────────

const laSalle = (s: SalleVue, p: PageDuCabinet = page) => rendu('views/cabinet/Salle', 'Salle', { salle: s, page: p })

test('une salle : ses œuvres peintes, ses cadres vides qui disent où chercher, son pouvoir, ses deux gardiens', async () => {
  const erudit = salleDe(page, 'erudit')
  const html = await laSalle(erudit)
  const t = texte(html)
  assert.match(t, /L’Érudit/)
  assert.match(t, /Je connais mon rayon/)
  assert.match(t, new RegExp(`${POUVOIRS.eclairer.nom}`))
  assert.match(t, /1 sur 8/)
  // Leçon, gagnée sans faute : sa peinture, son cadre doré — dit à l'oreille aussi, jamais par la couleur seule.
  const lecon = /<a class="cab-oeuvre[^"]*" href="#oeuvre-lecon">.*?<\/a>/.exec(html)?.[0] ?? ''
  assert.match(lecon, /class="exp-vc exp-vc-main exp-vc-doree"/)
  assert.match(lecon, /Leçon/)
  assert.match(texte(lecon), /cadre doré/)
  // Un cadre vide : sa rareté et le jeu où chercher, pas son nom ni sa peinture.
  const expose = /<a class="cab-oeuvre[^"]*" href="#oeuvre-expose"[^>]*>.*?<\/a>/.exec(html)?.[0] ?? ''
  assert.doesNotMatch(expose, /<img|Exposé/)
  assert.match(texte(expose), new RegExp(`Rare .*${JEUX.eclair.a}`))
  // Un jeu pas encore livré le dit.
  const plume = /<a class="cab-oeuvre[^"]*" href="#oeuvre-plume"[^>]*>.*?<\/a>/.exec(html)?.[0] ?? ''
  assert.ok(!JEUX_PRETS.includes(JEU_DE_L_OEUVRE.plume))
  assert.match(texte(plume), new RegExp(`${JEUX[JEU_DE_L_OEUVRE.plume].a} .*bientôt`))
  // Ses deux gardiens, endormis : leur nom, ce qui les réveille.
  const [premier, second] = GARDIENS_DES_SALLES.erudit
  assert.match(t, new RegExp(`${nom(premier)} .*La salle de l’Érudit complète`))
  assert.match(t, new RegExp(`${nom(second)} .*Tous les cadres de la salle de l’Érudit dorés`))
  sansJargon(html, 'la salle')
  // Le Vestibule : chacune son pouvoir, ses quatre œuvres de départ peintes.
  const vestibule = await laSalle(salleDe(page, 'vestibule'))
  assert.equal([...vestibule.matchAll(/class="exp-vc exp-vc-main/g)].length, 4)
  assert.match(texte(vestibule), /Chacune a son pouvoir/)
  // Une œuvre peinte arrivée dans une salle complète : elle le dit, son gardien reste réveillé.
  assert.match(texte(await laSalle({ ...erudit, nouvelle: true })), /Une œuvre nouvelle est arrivée/)
})

// ── 5. Une œuvre et son cartel ────────────────────────────────────────────

const lOeuvre = (cle: string, plus: object = {}, p: PageDuCabinet = page) =>
  rendu('views/cabinet/Oeuvre', 'Oeuvre', { page: p, cle, cartel: { etat: 'chargement' }, carte: null, busy: false, onCarte: rien, onAcheter: rien, onDorer: rien, onJouer: rien, ...plus })

test('une œuvre à lui : en grand, son cartel, sa carte-bonus, et de quoi la dorer', async () => {
  // Leçon, dorée : rien à dorer de plus.
  const lecon = await lOeuvre('lecon')
  assert.match(lecon, /class="exp-vc exp-vc-levee exp-vc-doree"/)
  assert.match(texte(lecon), /Son cadre est doré/)
  assert.doesNotMatch(texte(lecon), /Dorer son cadre/)
  assert.match(texte(lecon), new RegExp(`Sa carte-bonus .*${POUVOIRS.eclairer.nom} .*${forceDite('eclairer', 2)}`))
  // « En faire ma carte-bonus » garde son nom : l'état passe par `aria-pressed`.
  assert.match(lecon, /<button type="button" class="btn btn-block" aria-pressed="false">En faire ma carte-bonus<\/button>/)
  assert.match(await lOeuvre('lecon', { carte: 'lecon' }), /aria-pressed="true">En faire ma carte-bonus<\/button>/)
  // Coup d'œil, de départ, pas dorée : sa dorure, au prix du jour, et ce qui manque au solde pour la payer.
  const prix = PRIX_D_UNE_DORURE.commun
  const pauvre = { ...page, poussiere: prix - 1 }
  const coup = texte(await lOeuvre('coup-d-oeil', {}, pauvre))
  assert.match(coup, new RegExp(`Dorer son cadre · ${prix} poussières d’or`))
  assert.match(coup, /Il te manque 1 poussière d’or/)
  assert.match(await lOeuvre('coup-d-oeil', {}, pauvre), /aria-disabled="true"[^>]*>[^<]*Dorer son cadre/)
  assert.doesNotMatch(await lOeuvre('coup-d-oeil', {}, { ...page, poussiere: prix }), /aria-disabled="true"[^>]*>[^<]*Dorer son cadre/)
  // La rejouer pour la dorer : son jeu, une chasse — l'Épingle n'est pas livrée, la page le dit.
  assert.ok(!JEUX_PRETS.includes('epingle'))
  assert.match(coup, new RegExp(`La rejouer ${JEUX.epingle.a} pour la dorer`))
  assert.match(coup, /Ce jeu arrive bientôt/)
  sansJargon(await lOeuvre('coup-d-oeil'), 'une œuvre à lui')
})

test('une œuvre qui manque : où elle se trouve, ce qu’il faut pour la gagner, la chasse et l’achat', async () => {
  const html = await lOeuvre('expose')
  const t = texte(html)
  assert.doesNotMatch(t, /Exposé/, 'son nom attend qu’elle soit à lui')
  assert.match(t, /Un cadre vide de la salle de l’Érudit Une œuvre rare/)
  assert.match(t, new RegExp(`Elle se trouve ${JEUX.eclair.a}`))
  assert.match(t, new RegExp(JEUX.eclair.geste.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(t, new RegExp(`Il faut ${SEUILS_DES_RARETES.rare} étoiles sur 9`))
  assert.match(t, new RegExp(`Partir à sa recherche · ${CHASSES_PAR_JOUR - 1} chasse aujourd’hui`))
  assert.match(t, new RegExp(`L’acheter · ${PRIX_D_UNE_OEUVRE.rare} poussières d’or`))
  // Plus de chasse : la page le dit sous le bouton, que le serveur refuserait aussi.
  const sansChasse = texte(await lOeuvre('expose', {}, { ...page, chasses: { ...page.chasses, restent: 0 } }))
  assert.match(sansChasse, /Plus de chasse pour aujourd’hui : elles reviennent à minuit/)
  // Un jeu pas encore livré : la chasse attend.
  assert.match(texte(await lOeuvre('plume')), new RegExp(`Elle se trouve ${JEUX.frise.a} .*Ce jeu arrive bientôt`))
  sansJargon(html, 'une œuvre qui manque')
})

test('le cartel : ce que la partie lui a appris, ou ce qui l’a fait entrer', async () => {
  const cartel = (c: Cartel) => rendu('views/cabinet/Cartel', 'CartelDeLOeuvre', { lu: { etat: 'lu', cartel: c } })
  const appris = texte(
    await cartel({
      oeuvre: 'lecon',
      origine: 'partie',
      doree: true,
      partie: { id: 'p', jeu: 'pari', jour: 'le 24 octobre 2026', total: 9, sujet: 'Quelle est la capitale de la Lituanie ?', reponse: 'Vilnius', anecdote: 'Elle fut la « Jérusalem du Nord ».' },
    }),
  )
  assert.match(appris, /Ce que tu as appris en la gagnant/)
  assert.match(appris, /Quelle est la capitale de la Lituanie \?/)
  assert.match(appris, /Vilnius/)
  assert.match(appris, /Jérusalem du Nord/)
  assert.match(appris, new RegExp(`Gagnée ${JEUX.pari.a} · 9 sur 9 , Le 24 octobre 2026`))
  // Un cartel d'office : la phrase du serveur.
  assert.match(texte(await cartel({ oeuvre: 'coup-d-oeil', origine: 'depart', doree: false, dit: 'Offerte à ton arrivée.' })), /Offerte à ton arrivée\./)
  // En chemin, puis perdu : la place gardée, puis le motif.
  assert.match(await rendu('views/cabinet/Cartel', 'CartelDeLOeuvre', { lu: { etat: 'chargement' } }), /aria-busy="true"/)
  assert.match(texte(await rendu('views/cabinet/Cartel', 'CartelDeLOeuvre', { lu: { etat: 'perdu', motif: 'Pas de réseau.' } })), /Pas de réseau\./)
})

// ── 6. Les gardiens ───────────────────────────────────────────────────────

test('les gardiens : les vingt-trois, endormis ou réveillés, ce qui réveille chacun, et jamais un Divin', async () => {
  const html = await rendu('views/cabinet/Gardiens', 'Gardiens', { page, carte: null, onCarte: rien })
  const t = texte(html)
  assert.match(t, new RegExp(`0 sur ${GARDIENS.length} réveillés`))
  for (const g of GARDIENS) assert.match(t, new RegExp(nom(g).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), g)
  assert.equal([...html.matchAll(/class="cab-gardien"/g)].length, GARDIENS.length)
  assert.doesNotMatch(html, /dv:|Divin/, 'aucun Divin, pas même nommé')
  assert.match(t, /La salle du Rempart complète/)
  sansJargon(html, 'les gardiens')
  // La fiche d'un gardien réveillé : son pouvoir à la force 3, et en faire sa carte-bonus.
  const phenix = page.gardiens.tous.find(g => g.legendaire === 'lg:phenix')!
  const fiche = await rendu('views/cabinet/Gardiens', 'FicheDuGardien', { gardien: { ...phenix, reveille: true, voie: 'cabinet' }, carte: null, onCarte: rien, onFermer: rien })
  assert.match(texte(fiche), new RegExp(`${POUVOIRS.proteger.nom} .*${forceDite('proteger', 3).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
  assert.match(texte(fiche), /Réveillé dans ton Cabinet/)
  assert.match(fiche, /aria-pressed="false">En faire ma carte-bonus<\/button>/)
  // Déjà à lui d'ailleurs : il veillait déjà ; endormi, pas de carte-bonus à prendre.
  assert.match(texte(await rendu('views/cabinet/Gardiens', 'FicheDuGardien', { gardien: { ...phenix, reveille: true, voie: 'ailleurs' }, carte: null, onCarte: rien, onFermer: rien })), /veillait déjà/)
  const dort = await rendu('views/cabinet/Gardiens', 'FicheDuGardien', { gardien: phenix, carte: null, onCarte: rien, onFermer: rien })
  assert.match(texte(dort), /Pour le réveiller : la salle du Rempart complète/)
  assert.doesNotMatch(dort, /En faire ma carte-bonus/)
})

// ── 7. La visite du jour, les jeux libres ─────────────────────────────────

test('la visite du jour : chaque case, son jeu, ce qu’elle met en jeu sans nommer l’œuvre, ce qu’elle a donné', async () => {
  const html = await rendu('views/cabinet/Visite', 'Visite', { page, busy: false, onJouer: rien, onEchanger: rien })
  const t = texte(html)
  assert.match(t, /La visite du jour/)
  const [faite, aJouer] = page.visite.cases
  assert.ok(faite.faite && !aJouer.faite)
  assert.match(t, new RegExp(`Faite .*${JEUX[faite.jeu].nom}`))
  assert.match(t, new RegExp(`À jouer .*${JEUX[aJouer.jeu].nom} .*Peut te faire gagner une œuvre (commune|rare|maudite|épique) (de la salle|du Vestibule)`))
  // Une seule case se joue : la faite n'a plus de bouton.
  assert.equal([...html.matchAll(/>Jouer<\/button>/g)].length, 1)
  // Changer de jeu, quand la règle le permet ; sinon rien à toucher.
  assert.equal(page.visite.echange.possible, false, 'deux jeux livrés, deux cases : rien à proposer d’autre')
  assert.doesNotMatch(html, /Changer de jeu/)
  const echange = await rendu('views/cabinet/Visite', 'Visite', { page: { ...page, visite: { ...page.visite, echange: { possible: true } } }, busy: false, onJouer: rien, onEchanger: rien })
  assert.equal([...echange.matchAll(/Changer de jeu/g)].length, 1, 'sur la seule case pas jouée')
  // Une œuvre à dorer se nomme — elle est à lui ; la poussière d'or, rien à gagner.
  const aDorer = { ...page, visite: { ...page.visite, cases: [{ jeu: 'pari', enJeu: { pourDorer: 'bastion' }, faite: false }, { jeu: 'eclair', enJeu: { poussiere: true }, faite: false }] } }
  const td = texte(await rendu('views/cabinet/Visite', 'Visite', { page: aDorer, busy: false, onJouer: rien, onEchanger: rien }))
  assert.match(td, /Pour dorer Bastion/)
  assert.match(td, /Pour la poussière d’or/)
  sansJargon(html, 'la visite')
})

test('jouer librement : les jeux livrés se jouent, les autres arrivent bientôt', async () => {
  const html = await rendu('views/cabinet/Visite', 'JouerLibrement', { page, onJouer: rien })
  const t = texte(html)
  assert.match(t, new RegExp(`Tes ${LIBRES_QUI_PAIENT} prochaines parties rapportent de la poussière d’or`))
  for (const j of CLES_DES_JEUX) assert.match(t, new RegExp(JEUX[j].nom), j)
  assert.equal([...html.matchAll(/<button type="button" class="cab-jeu"/g)].length, CLES_DES_JEUX.length)
  assert.equal([...html.matchAll(/class="cab-jeu" aria-disabled="true"/g)].length, CLES_DES_JEUX.length - JEUX_PRETS.length)
  assert.match(texte(await rendu('views/cabinet/Visite', 'JouerLibrement', { page: { ...page, libres: { ...page.libres, paientEncore: 0 } }, onJouer: rien })), /pour le plaisir/)
  sansJargon(html, 'les jeux libres')
})

// ── 8. Les règles ─────────────────────────────────────────────────────────

test('les règles : des lignes, pas des paragraphes — le musée, la journée, la poussière, les pouvoirs, les neuf jeux, les mots du Cabinet', async () => {
  const html = await rendu('views/cabinet/Regles', 'Regles', { jeux: page.jeux })
  const t = texte(html)
  for (const titre of ['Ton musée', 'Chaque jour', 'La poussière d’or', 'Les cartes-bonus', 'Les neuf jeux', 'Ce que tu apprends']) assert.match(t, new RegExp(titre), titre)
  // Chaque jeu, son geste, puis son barème sur sa ligne, une capitale en tête.
  for (const j of CLES_DES_JEUX) {
    const bareme = JEUX[j].bareme.replace(/^./, c => c.toUpperCase()).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.match(t, new RegExp(`${JEUX[j].nom} .*${bareme}`), j)
  }
  // Pas de majuscule après les deux-points : « Éclairer : un indice ».
  assert.match(t, new RegExp(`${POUVOIRS.eclairer.nom} : ${POUVOIRS.eclairer.dit.replace(/^./, c => c.toLowerCase())}`))
  // La visite dit les parties que la page montre : moins que le barème tant que des jeux ne sont pas livrés.
  assert.match(texte(await rendu('views/cabinet/Regles', 'Regles', { jeux: page.jeux, parties: page.visite.cases.length })), new RegExp(`La visite du jour : ${page.visite.cases.length} parties`))
  for (const p of Object.values(POUVOIRS)) assert.match(t, new RegExp(p.nom), p.nom)
  assert.match(t, new RegExp(`${OEUVRES.length} œuvres`))
  // Les mots du Cabinet, au glossaire de l'application : une seule définition par mot.
  for (const m of ['oeuvre', 'salle', 'gardien', 'cartel', 'poussiere', 'cadreDore', 'carteBonus', 'visite', 'chasse', 'manche'] as const) {
    assert.ok(GLOSSAIRE[m], m)
    assert.match(t, new RegExp(GLOSSAIRE[m].terme), m)
  }
  assert.doesNotMatch(html, /<p>[^<]{200,}<\/p>/, 'pas de paragraphe')
  sansJargon(html, 'les règles')
})

// ── 9. Sans profil, fermé ─────────────────────────────────────────────────

test('sans profil, la page dit comment entrer — sans rien rendre obligatoire ailleurs', async () => {
  const anonyme = await rendu('views/CabinetApp', 'EcranSansMusee', { sorte: 'anonyme', motif: CABINET_SANS_PROFIL })
  assert.match(texte(anonyme), new RegExp(CABINET_SANS_PROFIL))
  assert.match(anonyme, /href="\/\?next=%2Fcabinet"[^>]*>Me connecter</)
  assert.match(anonyme, /href="\/\?creer=1&amp;next=%2Fcabinet"[^>]*>Créer mon profil</)
  assert.match(anonyme, /href="\/"/, '« ← Accueil » : le chemin anonyme continue ailleurs')
  // Fermé sur ce serveur : la phrase du serveur, sans bouton.
  const bientot = await rendu('views/CabinetApp', 'EcranSansMusee', { sorte: 'bientot', motif: 'Le Cabinet de curiosités ouvre bientôt : reviens dans quelques jours' })
  assert.match(texte(bientot), /ouvre bientôt/)
  assert.doesNotMatch(bientot, /Me connecter/)
})

// ── 10. Ce que la page demande au serveur ─────────────────────────────────

test('api.cabinet : chaque demande à son adresse, l’heure remesurée, et un geste passé rend la partie d’à présent', async () => {
  const { api } = await import(url('api.ts'))
  const avant = globalThis.fetch
  const appels: { url: string; init: RequestInit }[] = []
  const reponses: [number, unknown][] = []
  globalThis.fetch = (async (u: string, init: RequestInit) => {
    appels.push({ url: u, init })
    const [status, corps] = reponses.shift() ?? [200, {}]
    return { ok: status < 400, status, text: async () => JSON.stringify(corps) } as Response
  }) as typeof fetch
  try {
    const partie = { id: 'p1', maintenant: Date.now(), rang: 3 }
    reponses.push([200, { maintenant: Date.now() }])
    await api.cabinet.page()
    assert.equal(appels[0].url, DEPART.cabinet)
    assert.equal((appels[0].init.headers as Record<string, string>)['X-Requested-With'], 'quizz')
    reponses.push([200, partie])
    await api.cabinet.commencer({ origine: 'chasse', oeuvre: 'bastion', carte: 'prudence' })
    assert.equal(appels[1].url, '/api/cabinet/partie')
    assert.deepEqual(JSON.parse(String(appels[1].init.body)), { origine: 'chasse', oeuvre: 'bastion', carte: 'prudence' })
    // Le geste porte son rang ; passé, le serveur répond 409 et la vue d'à présent, où la page se range.
    reponses.push([409, { error: 'Ce geste est passé : ta partie a continué sans lui', partie }])
    const passe = await api.cabinet.geste('p1', 2, { quoi: 'ouvrir', manche: 1 })
    assert.equal(appels[2].url, '/api/cabinet/partie/p1/geste')
    assert.deepEqual(JSON.parse(String(appels[2].init.body)), { rang: 2, geste: { quoi: 'ouvrir', manche: 1 } })
    assert.deepEqual(passe, { partie, passe: 'Ce geste est passé : ta partie a continué sans lui' })
    // Un autre refus reste un refus.
    reponses.push([400, { error: 'Le temps de cette manche est écoulé' }])
    await assert.rejects(api.cabinet.geste('p1', 3, { quoi: 'eclairer', manche: 1 }), /Le temps de cette manche est écoulé/)
    // L'achat, la dorure, l'échange : le prix montré, la case.
    reponses.push([200, { maintenant: Date.now() }], [200, { maintenant: Date.now() }], [200, { maintenant: Date.now() }])
    await api.cabinet.acheter('bastion', 700)
    await api.cabinet.dorer('prudence', 50)
    await api.cabinet.echanger(1)
    assert.deepEqual(
      appels.slice(4).map(a => [a.url, a.init.method, JSON.parse(String(a.init.body))]),
      [
        ['/api/cabinet/oeuvre/bastion/achat', 'POST', { prix: 700 }],
        ['/api/cabinet/oeuvre/prudence/dorure', 'POST', { prix: 50 }],
        ['/api/cabinet/visite/echange', 'POST', { case: 1 }],
      ],
    )
    reponses.push([200, {}], [200, { maintenant: Date.now() }])
    await api.cabinet.oeuvre('bastion')
    await api.cabinet.partie('p1')
    assert.deepEqual(
      appels.slice(7).map(a => a.url),
      ['/api/cabinet/oeuvre/bastion', '/api/cabinet/partie/p1'],
    )
  } finally {
    globalThis.fetch = avant
  }
})

test('par le vrai serveur : la page de la joueuse, et le même geste joué deux fois au même rang', async () => {
  const { api } = await import(url('api.ts'))
  const avant = globalThis.fetch
  // La page parle au serveur par des adresses relatives, avec son cookie : le banc les lui prête.
  globalThis.fetch = ((u: string, init: RequestInit = {}) => avant(`${b.banc.url}${u}`, { ...init, headers: { ...(init.headers as object), Cookie: cookie } })) as typeof fetch
  try {
    const lue = (await api.cabinet.page()) as PageDuCabinet
    assert.deepEqual(
      lue.salles.map(s => s.oeuvres.filter(o => o.possedee).length),
      page.salles.map(s => s.oeuvres.filter(o => o.possedee).length),
    )
    const libre = (await api.cabinet.commencer({ origine: 'libre', jeu: 'pari', carte: null })) as VueDeLaPartie
    const quittee = await api.cabinet.geste(libre.id, libre.rang, { quoi: 'quitter' })
    assert.equal(quittee.passe, undefined)
    assert.equal(quittee.partie.phase, 'finie')
    // Le même toucher arrivé deux fois : le second ne joue rien, et rend la partie telle qu'elle est.
    const encore = await api.cabinet.geste(libre.id, libre.rang, { quoi: 'quitter' })
    assert.match(encore.passe ?? '', /passé|finie/)
    assert.equal(encore.partie.id, libre.id)
    assert.equal(encore.partie.phase, 'finie')
  } finally {
    globalThis.fetch = avant
  }
})

// ── 11. Le bouton de l'accueil ────────────────────────────────────────────

test('l’accueil a son bouton du Cabinet là où le serveur l’ouvre, et seulement là', async () => {
  const accueil = (props: object) => rendu('components/AccueilDesRoles', 'AccueilJouer', { enCours: [], onRejoindre: rien, lendemain: null, ...props })
  assert.match(await accueil({}), /<a class="gros-bouton" href="\/cabinet">.*?Le Cabinet de curiosités/)
  assert.doesNotMatch(await accueil({ cabinet: false }), /Le Cabinet de curiosités/)
  // Fermé au QG pour bientôt : éteint, et sa ligne le dit.
  assert.match(await accueil({ etats: { cabinet: 'bientot' } }), /<a class="gros-bouton gros-ferme gros-bientot" href="\/cabinet">.*?Bientôt disponible/)
  // La page ne le déduit jamais d'une constante : le serveur le dit par une balise, lue sous try/catch.
  const lireLaBalise = async (contenu: string | null, instance: string) => {
    const avant = (globalThis as { document?: unknown }).document
    Object.assign(globalThis, { document: { querySelector: (sel: string) => (sel === 'meta[name="cabinet"]' && contenu ? { getAttribute: () => contenu } : null) } })
    try {
      const { cabinetIci } = await import(`${url('maintenance.ts')}?${instance}`)
      return cabinetIci() as boolean
    } finally {
      Object.assign(globalThis, { document: avant })
    }
  }
  assert.equal(await lireLaBalise('ferme', 'ferme'), false)
  assert.equal(await lireLaBalise(null, 'ouvert'), true)
  assert.match(source('views/ProfilApp.tsx'), /cabinet=\{cabinetIci\(\)\}/)
  assert.match(source('views/ProfilApp.tsx'), /if \(cabinetIci\(\)\) void import\('\.\/CabinetApp'\)\.catch\(\(\) => \{\}\)/)
})

// ── 12. La feuille ────────────────────────────────────────────────────────

test('la section du Cabinet dans la feuille : préfixe cab-, un texte qui se lit au petit téléphone, rien pour l’écran commun', () => {
  const css = readFileSync(path.join(client, 'styles.css'), 'utf8')
  const debut = css.indexOf('/* ── Le Cabinet de curiosités')
  assert.ok(debut > 0, 'la section existe')
  const fin = css.indexOf('/* ── ', debut + 10)
  const section = css.slice(debut, fin < 0 ? undefined : fin).replace(/\/\*[\s\S]*?\*\//g, '')
  // Chaque règle ne vise que ses classes (ou la carte peinte posée chez elle) : jamais `.cabinet`, `.musee`, `.fond-…`.
  for (const [, sel] of section.matchAll(/([^{}]+)\{/g)) {
    if (sel.trim().startsWith('@')) continue
    assert.match(sel, /\.cab-/, `${sel.trim()} : une règle du Cabinet vise une classe cab-`)
    assert.doesNotMatch(sel, /\.(cabinet|musee|fond-)\b/, sel.trim())
  }
  // La grand-mère au petit téléphone : aucun texte sous dix-sept pixels, ni au plancher d'un jeton.
  assert.doesNotMatch(section, /font-size:\s*var\(--t-label\)/)
  for (const [, valeur, unite] of section.matchAll(/font-size:\s*([\d.]+)(rem|px)/g)) {
    assert.ok(Number(valeur) * (unite === 'rem' ? 16 : 1) >= 17, `un texte du Cabinet à ${valeur}${unite}`)
  }
  // Les pièces partagées qu'il pose y sont relevées : la petite ligne de la tête (11 px), le détail des gros boutons (14 px), les boutons.
  for (const sel of ['.cab-page .piece-tete .label', '.cab-page .gros-detail', '.cab-page > .jour-sortie', '.cab-feuille .btn']) {
    assert.ok(section.includes(sel), `${sel} relevé à la taille du Cabinet`)
  }
  assert.doesNotMatch(section, /min-width:\s*1101px/, 'une page de téléphone : rien pour l’écran commun')
})
