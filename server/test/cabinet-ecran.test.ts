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
import {
  bancDuCabinet,
  commencer,
  fermerLesMagasins,
  jouer,
  jouerUnEclair,
  jouerUnPari,
  laPage,
  ok,
  ouvrir,
  pariDe,
  unPariParfait,
  type BancDuCabinet,
} from './cabinet-banc'
import { importsStatiques } from './chemin-des-imports'
import { CHASSES_PAR_JOUR, ETOILES_D_UNE_PARTIE, LIBRES_QUI_PAIENT, PRIX_D_UNE_DORURE, PRIX_D_UNE_OEUVRE, SEUILS_DES_RARETES } from '../../shared/cabinet/bareme'
import { CLES_DES_JEUX, JEUX, MOTS_DU_PARI } from '../../shared/cabinet/jeux/regle'
import { JEU_PAS_LIVRE, PLUS_DE_CHASSE } from '../../shared/cabinet/musee'
import { JEU_DE_L_OEUVRE, OEUVRES, OEUVRES_DE_DEPART, RARETES } from '../../shared/cabinet/oeuvres'
import { JEUX_PRETS } from '../../shared/cabinet/ouverture'
import { PLUS_DE_PAUSE } from '../../shared/cabinet/partie'
import { POUVOIRS, ceQueFaitLaCarte, forceDite } from '../../shared/cabinet/pouvoirs'
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
  // Puis Hugo, dont chaque écran de partie se relit (section 14).
  await lesPartiesDeHugo()
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
  for (const f of ['views/cabinet/Musee.tsx', 'views/cabinet/Salle.tsx', 'views/cabinet/Annonce.tsx', 'views/cabinet/Partie.tsx', 'components/OeuvrePeinte.tsx', 'components/Avatar.tsx']) {
    assert.ok(chemin.has(path.join(client, f)), `${f} est sur le chemin`)
  }
  // Les écrans des jeux et le bilan — l'écran des gains, ses catalogues — viennent à la demande : la page du musée ne les télécharge pas.
  for (const f of ['views/RencontresDExpedition.tsx', 'views/ExpeditionApp.tsx', 'socket.ts', 'views/cabinet/jeux/Pari.tsx', 'views/cabinet/jeux/Eclair.tsx', 'views/cabinet/Bilan.tsx', 'components/Gains.tsx']) {
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

test('la porte d’une salle montre la plus rare de ses œuvres à lui, quel que soit leur rang au mur', async () => {
  // Le Vestibule range ses épiques avant ses maudites : la dernière possédée n'y est pas la plus rare.
  const vestibule = salleDe(neuf, 'vestibule')
  const epique = vestibule.oeuvres.find(o => o.rarete === 'epique' && !o.possedee)!
  const maudite = [...vestibule.oeuvres].reverse().find(o => o.rarete === 'maudit' && !o.possedee)!
  assert.ok(vestibule.oeuvres.indexOf(epique) < vestibule.oeuvres.indexOf(maudite), 'l’épique avant la maudite au mur')
  assert.ok(RARETES.indexOf('epique') > RARETES.indexOf('maudit'))
  const aLui = new Set([epique.cle, maudite.cle])
  const p = { ...neuf, salles: neuf.salles.map(s => (s.cle !== 'vestibule' ? s : { ...s, oeuvres: s.oeuvres.map(o => (aLui.has(o.cle) ? { ...o, possedee: true } : o)) })) }
  const porte = /<a class="cab-porte[^"]*" href="#salle-vestibule">.*?<\/a>/.exec(await musee(p))?.[0] ?? ''
  assert.match(porte, new RegExp(`<img[^>]*src="/cartes/${epique.cle}-240\\.`))
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

test('une salle ne promet pas de réveiller un gardien qui veille déjà', async () => {
  // Endormi, le premier attend la salle complète : elle dit ce qui lui manque.
  const rempart = salleDe(page, 'rempart')
  assert.ok(!rempart.complete)
  const [premier, second] = rempart.gardiens
  assert.match(texte(await laSalle(rempart)), /Encore \d+ œuvres? pour réveiller le premier/)
  // Le Phénix rapporté de l'Expédition veille déjà sur le Rempart : « réveillé », et rien à promettre dessous.
  const veille = texte(await laSalle({ ...rempart, gardiens: [{ ...premier, reveille: true }, second] }))
  assert.match(veille, /Premier gardien · réveillé/)
  assert.doesNotMatch(veille, /pour réveiller le premier/)
  // Complète, pas encore toute dorée : le second se réveille aux cadres dorés — sauf s'il veille déjà.
  const complete = { ...rempart, complete: true, doree: false, oeuvres: rempart.oeuvres.map(o => ({ ...o, possedee: true })), gardiens: [{ ...premier, reveille: true }, second] as SalleVue['gardiens'] }
  assert.match(texte(await laSalle(complete)), /tous dorés, le second se réveille/)
  assert.doesNotMatch(texte(await laSalle({ ...complete, gardiens: [{ ...premier, reveille: true }, { ...second, reveille: true }] })), /le second se réveille/)
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
  // Plus de chasse : la page le dit sous le bouton, en sourdine, dans les mots mêmes du refus du serveur.
  const sansChasse = await lOeuvre('expose', {}, { ...page, chasses: { ...page.chasses, restent: 0 } })
  assert.match(texte(sansChasse), new RegExp(PLUS_DE_CHASSE))
  assert.match(sansChasse, /aria-disabled="true"[^>]*>[^<]*Partir à sa recherche/)
  assert.doesNotMatch(html, /aria-disabled="true"[^>]*>[^<]*Partir à sa recherche/, 'une chasse qui reste, le bouton répond')
  // Un jeu pas encore livré : la chasse attend.
  assert.match(texte(await lOeuvre('plume')), new RegExp(`Elle se trouve ${JEUX.frise.a} .*${JEU_PAS_LIVRE}`))
  // Les phrases des refus viennent de la règle du départ (`cadreDuDepart`) : la page ne les recopie pas.
  for (const f of ['views/cabinet/Oeuvre.tsx', 'views/cabinet/Visite.tsx']) {
    assert.doesNotMatch(source(f), new RegExp(`${JEU_PAS_LIVRE}|${PLUS_DE_CHASSE}`), f)
  }
  // La poussière d'or : une visite ou une chasse en rapporte, même ratée — pas toute partie, les libres s'arrêtent au cinquième.
  assert.match(t, /Chaque visite ou chasse en rapporte, même ratée/)
  assert.doesNotMatch(GLOSSAIRE.poussiere.sens, /chaque partie/i)
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
  // Seul un cartel lu se garde : perdu — une coupure d'un instant —, il se redemande à la réouverture et à la page relue.
  const { sansLesPerdus } = await import(url('views/cabinet/Cartel.tsx'))
  const lu = { etat: 'lu', cartel: { oeuvre: 'coup-d-oeil', origine: 'depart', doree: false, dit: 'Offerte à ton arrivée.' } }
  assert.deepEqual(sansLesPerdus({ 'coup-d-oeil': lu, prudence: { etat: 'perdu', motif: 'Pas de réseau.' }, lecon: { etat: 'chargement' } }), { 'coup-d-oeil': lu, lecon: { etat: 'chargement' } })
  // Rien de perdu : le même objet, pour que la page ne se redessine pas pour rien.
  const tous = { 'coup-d-oeil': lu }
  assert.equal(sansLesPerdus(tous), tous)
  assert.match(source('views/CabinetApp.tsx'), /setCartels\(sansLesPerdus\)\s*\}, \[aSonCartel, page\]\)/)
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
  const deuxCases = [{ jeu: 'pari', enJeu: { pourDorer: 'bastion' }, faite: false }, { jeu: 'eclair', enJeu: { poussiere: true }, faite: false }]
  const aDorer = { ...page, visite: { ...page.visite, cases: deuxCases } }
  const td = texte(await rendu('views/cabinet/Visite', 'Visite', { page: aDorer, busy: false, onJouer: rien, onEchanger: rien }))
  assert.match(td, /Pour dorer Bastion/)
  assert.match(td, /Pour la poussière d’or/)
  // Deux cases à jouer, l'échange encore possible : chacune peut changer de jeu — la règle des échanges ne vise pas la première.
  const deux = await rendu('views/cabinet/Visite', 'Visite', { page: { ...aDorer, visite: { ...aDorer.visite, echange: { possible: true } } }, busy: false, onJouer: rien, onEchanger: rien })
  assert.equal([...deux.matchAll(/>Changer de jeu<\/button>/g)].length, 2)
  // L'échange fait, plus aucun bouton : la raison du serveur, une fois, sous les cases.
  const fait = await rendu('views/cabinet/Visite', 'Visite', { page: { ...aDorer, visite: { ...aDorer.visite, echange: { possible: false, refus: 'Tu as déjà changé un jeu aujourd’hui' } } }, busy: false, onJouer: rien, onEchanger: rien })
  assert.doesNotMatch(fait, /Changer de jeu/)
  assert.equal([...texte(fait).matchAll(/Tu as déjà changé un jeu aujourd’hui/g)].length, 1)
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
  assert.match(texte(await rendu('views/cabinet/Regles', 'Regles', { jeux: page.jeux, parties: 1 })), /La visite du jour : 1 partie,/)
  // Les seuils des raretés se lisent chacun au barème : deux raretés ne se disent ensemble que si leurs seuils sont égaux.
  const { seuilsDits } = await import(url('views/cabinet/Regles.tsx'))
  assert.equal(seuilsDits(SEUILS_DES_RARETES), `${SEUILS_DES_RARETES.commun} étoiles si elle est commune, ${SEUILS_DES_RARETES.rare} rare ou maudite, ${SEUILS_DES_RARETES.epique} épique`)
  assert.equal(seuilsDits({ commun: 5, rare: 6, maudit: 7, epique: 7 }), '5 étoiles si elle est commune, 6 rare, 7 maudite ou épique')
  assert.equal(seuilsDits({ commun: 5, rare: 6, maudit: 8, epique: 7 }), '5 étoiles si elle est commune, 6 rare, 8 maudite, 7 épique')
  assert.match(t, new RegExp(`Une œuvre se gagne à ${seuilsDits(SEUILS_DES_RARETES)}\\.`))
  // Le cadre doré : toutes les manches parfaites — un nombre de manches changé ne laisse pas « trois » derrière lui.
  assert.match(t, /Toutes ses manches parfaites, sans qu’un pouvoir ait servi : son cadre est doré\./)
  // « Les neuf jeux » se dit en lettres : un dixième jeu doit retoucher le titre.
  assert.equal(CLES_DES_JEUX.length, 9, 'le titre « Les neuf jeux »')
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

// ── 10. Une partie demandée, l'historique, ce que le téléphone retient ────

test('une partie demandée s’annonce sans rien consommer : son jeu, son enjeu, et aucun bouton qui la commence', async () => {
  const html = await rendu('views/CabinetApp', 'AnnonceEnAttente', { jeu: 'eclair', enJeu: 'Une chasse', onRetour: rien })
  const t = texte(html)
  assert.match(t, new RegExp(`Une chasse .*${JEUX.eclair.nom}`))
  assert.match(t, new RegExp(JEUX.eclair.geste.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(t, /rien n’est encore joué/)
  assert.doesNotMatch(html, /<button/, 'rien ne part avant « Commencer », qui viendra avec ses écrans')
  assert.match(html, /href="\/cabinet"[^>]*>.*Le Cabinet/)
  // Reprise : la partie en cours, qui l'attend où il l'a laissée.
  assert.match(texte(await rendu('views/CabinetApp', 'AnnonceEnAttente', { jeu: 'pari', enJeu: null, reprise: true, onRetour: rien })), /Ta partie en cours .*elle t’attend où tu l’as laissée/)
  sansJargon(html, 'l’annonce')
})

/** Un historique de navigateur, entrée par entrée : ce que `history` fait d'une page, sans navigateur. */
function historique(depart: string) {
  const entrees: { url: string; etat: unknown }[] = [{ url: depart, etat: null }]
  let i = 0
  const h = {
    get state() {
      return entrees[i].etat
    },
    pushState(etat: unknown, _titre: string, adresse?: string) {
      entrees.splice(i + 1)
      entrees.push({ url: adresse ?? entrees[i].url, etat })
      i++
    },
    replaceState(etat: unknown, _titre: string, adresse?: string) {
      entrees[i] = { url: adresse ?? entrees[i].url, etat }
    },
    back() {
      i = Math.max(0, i - 1)
    },
  }
  return { h, url: () => entrees[i].url, ici: () => i, longueur: () => entrees.length }
}

test('une partie ouverte par-dessus un écran a son entrée d’historique : le retour la ferme et laisse l’écran d’où elle partait', async () => {
  const { poserLEntreeDeLaPartie, partieDansLEntree, quitterVersLeMusee, effacerLaMarqueAuChargement } = await import(url('views/cabinet/ecrans.ts'))
  // De la salle à une œuvre, puis « Partir à sa recherche » : l'annonce s'ouvre à la même adresse, sur une entrée à elle.
  const n = historique('/cabinet#salle-erudit')
  n.h.pushState(null, '', '/cabinet#oeuvre-expose')
  poserLEntreeDeLaPartie(n.h)
  assert.equal(n.url(), '/cabinet#oeuvre-expose')
  assert.ok(partieDansLEntree(n.h.state))
  // Un double toucher n'en empile pas une seconde.
  poserLEntreeDeLaPartie(n.h)
  assert.equal(n.longueur(), 3)
  // Le retour du navigateur consomme son entrée : la page la ferme, et l'œuvre reste à l'écran.
  n.h.back()
  assert.ok(!partieDansLEntree(n.h.state))
  assert.equal(n.url(), '/cabinet#oeuvre-expose')
  // « ← Le Cabinet » depuis l'annonce : le musée prend la place de son entrée, et le retour ramène à l'œuvre.
  poserLEntreeDeLaPartie(n.h)
  quitterVersLeMusee(n.h, '#oeuvre-expose')
  assert.equal(n.url(), '/cabinet')
  assert.ok(!partieDansLEntree(n.h.state))
  n.h.back()
  assert.equal(n.url(), '/cabinet#oeuvre-expose')
  // Ouverte du musée même — la partie qui l'attend —, elle s'en va par le retour : pas de second musée dans l'historique.
  const m = historique('/cabinet')
  poserLEntreeDeLaPartie(m.h)
  quitterVersLeMusee(m.h, '')
  assert.equal(m.ici(), 0)
  // D'un écran sans partie ouverte, « ← Le Cabinet » pose le musée par-dessus ; du musée, rien.
  const v = historique('/cabinet#visite')
  quitterVersLeMusee(v.h, '#visite')
  assert.equal(v.url(), '/cabinet')
  quitterVersLeMusee(v.h, '')
  assert.equal(v.longueur(), 2)
  // Rechargée sur l'entrée d'une partie, la page n'en a plus d'ouverte : la marque s'efface, sans toucher aux autres repères.
  const r = historique('/cabinet#visite')
  r.h.replaceState({ fiestappGarde: true }, '')
  poserLEntreeDeLaPartie(r.h)
  effacerLaMarqueAuChargement(r.h)
  assert.ok(!partieDansLEntree(r.h.state))
  assert.deepEqual(r.h.state, { fiestappGarde: true })
  assert.equal(r.url(), '/cabinet#visite')
  // La page suit l'entrée : un retour qui la quitte ferme la partie.
  assert.match(source('views/CabinetApp.tsx'), /if \(!partieDansLEntree\(window\.history\.state\)\) setEnPartie\(null\)/)
})

test('ce que le téléphone retient du Cabinet, il le retient profil par profil — et sans stockage, rien ne casse', async () => {
  const avant = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const memoire = new Map<string, string>()
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => void memoire.set(k, v), removeItem: (k: string) => void memoire.delete(k) },
    })
    const r = await import(url('views/cabinet/retenu.ts'))
    r.retenirLaCarte('lea', 'lecon')
    r.retenirLesRegles('lea')
    r.retenirLesRapportees('lea', 41)
    assert.equal(r.carteRetenue('lea'), 'lecon')
    assert.equal(r.reglesLues('lea'), true)
    assert.equal(r.rapporteesVues('lea'), 41)
    // Hugo, sur le même téléphone : ni la carte-bonus de Léa, ni ses règles lues — et ses douze œuvres rapportées s'annonceront.
    assert.equal(r.carteRetenue('hugo'), null)
    assert.equal(r.reglesLues('hugo'), false)
    assert.equal(r.rapporteesVues('hugo'), 0)
    for (const k of memoire.keys()) assert.match(k, /^quizz\.cabinet\.[a-z-]+\.lea$/, k)
    r.retenirLaCarte('lea', null)
    assert.equal(r.carteRetenue('lea'), null)
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })
    assert.equal(r.carteRetenue('lea'), null)
    assert.equal(r.reglesLues('lea'), false)
    assert.doesNotThrow(() => r.retenirLaCarte('lea', 'lecon'))
  } finally {
    if (avant) Object.defineProperty(globalThis, 'localStorage', avant)
    else delete (globalThis as Record<string, unknown>).localStorage
  }
})

// ── 11. Ce que la page demande au serveur ─────────────────────────────────

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

// ── 12. Le bouton de l'accueil ────────────────────────────────────────────

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

// ── 13. La feuille ────────────────────────────────────────────────────────

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
  // Celles qu'une partie pose : la catégorie et les étiquettes (11 px), le bandeau du verdict, « Le savais-tu ? », le corrigé, « Signaler ».
  for (const sel of ['.cab-page .label', '.cab-page .small', '.cab-page .result-banner p', '.cab-page .anecdote', '.cab-page .corrige-legende', '.cab-page .corrige-texte']) {
    assert.ok(section.includes(sel), `${sel} relevé à la taille du Cabinet`)
  }
  // La tête et le pied d'une partie, collés, posent le fond de la page sous eux : les thèmes repeignent `.card` d'un verre.
  assert.match(section, /\.cab-tete-partie \{ position: sticky; top: 0;[^}]*var\(--bg\)/)
  assert.match(section, /\.cab-pied-partie \{ position: sticky; bottom: 0;[^}]*var\(--bg\)/)
  // Les réponses gardent leur texte, la page défile : serrée en un écran sous la tête et la carte-bonus, la grille passait sous le
  // pied. Une carte-bonus qui ne sert plus se pose sous la manche ; « ← Le Cabinet », entre deux manches, ne passe pas sous la tête.
  assert.match(section, /\.cab-partie:has\(\.ans-grid\) \{ height: auto; min-height: 100dvh; \}/)
  assert.match(section, /\.cab-partie:has\(\.ans-grid\) \.ans-grid \{ flex: 1 0 auto; min-height: auto; grid-auto-rows: minmax\(min-content, auto\); \}/)
  assert.match(section, /\.cab-pied-partie\.cab-pied-pose \{ position: static; background: none; \}/)
  assert.match(section, /\.cab-partie > \.jour-sortie \{ margin-bottom: 0; \}/)
  assert.match(section, /\.cab-partie > \.jour-sortie \+ \.cab-tete-partie \{ margin-top: -18px; \}/)
  // Le voile de la pause est plein : la manche ne se lit pas au travers, sous aucun thème.
  assert.match(section, /\.cab-voile \{[^}]*background: var\(--bg-raised\)/)
  // Cormorant écrit ses chiffres à l'ancienne (règle `css.md`) : les pièces d'une partie qui portent un nombre — les points des
  // manches, le total, le titre d'une révélation (« 4 sur 5 »), la réponse proposée, le total du bilan — posent `lining-nums`.
  for (const sel of ['.cab-point', '.cab-total', '.cab-titre-revele', '.cab-proposee', '.cab-total-grand']) {
    const regle = new RegExp(`(?:^|\\n)${echapper(sel)} \\{([^}]*)\\}`).exec(section)
    assert.ok(regle, `${sel} a sa règle`)
    assert.match(regle[1], /font-variant-numeric: lining-nums/, sel)
  }
  assert.doesNotMatch(section, /min-width:\s*1101px/, 'une page de téléphone : rien pour l’écran commun')
  // La tête d'une partie laisse son coin à la niche, et la niche repliée s'efface sous elle.
  assert.match(css, /body\.avec-niche \.cab-tete-ligne \{ padding-right: var\(--niche-place\); \}/)
  assert.match(css, /body:has\([^)]*\.cab-tete-partie\) \.niche\.repliee \{ opacity: 0; visibility: hidden; \}/)
})

// ── 14. Une partie à l'écran ──────────────────────────────────────────────
//
// Hugo joue par les vraies routes, et chaque écran de sa partie se rend sur la vue même que le serveur lui a rendue : l'annonce,
// une manche du Pari — éclairée, en pause, juste et au choix, pariée —, l'Éclair, la révélation, la mise, le bilan.

const vues: Record<string, VueDeLaPartie> = {}

/** Joué à la fin du `before` du fichier, une fois le banc démarré : un second `before` partait sans l'attendre. */
async function lesPartiesDeHugo() {
  const hugo = await inscrireProfil(b.banc.url, 'hugo', 'Hugo')
  // Un Pari libre, Coup d'œil emporté : il éclaire, met en pause, reprend, répond juste, parie et gagne ; garde la deuxième ; rate la troisième.
  let v = ok(await commencer(b, hugo, { origine: 'libre', jeu: 'pari', carte: 'coup-d-oeil' }), 'le Pari')
  vues.pari = v
  const t = pariDe(b, v.id, 0)
  v = vues.eclaire = ok(await jouer(b, hugo, v, { quoi: 'eclairer', manche: 0 }), 'éclairer')
  v = vues.pause = ok(await jouer(b, hugo, v, { quoi: 'pause', manche: 0 }), 'la pause')
  v = ok(await jouer(b, hugo, v, { quoi: 'reprendre', manche: 0 }), 'reprendre')
  v = vues.auChoix = ok(await jouer(b, hugo, v, { quoi: 'repondre', manche: 0, reponse: { pari: { choix: t.q1.bonne } } }), 'juste')
  v = vues.etape2 = ok(await jouer(b, hugo, v, { quoi: 'parier', manche: 0 }), 'parier')
  v = vues.gagne = ok(await jouer(b, hugo, v, { quoi: 'repondre', manche: 0, reponse: { pari: { choix: t.q2.bonne } } }), 'le pari gagné')
  v = await ouvrir(b, hugo, v, 1)
  v = vues.garde = await jouerUnPari(b, hugo, v, 1, 'garder')
  v = await ouvrir(b, hugo, v, 2)
  vues.fini = await jouerUnPari(b, hugo, v, 2, 'rater')
  // Un Éclair libre, Coup d'œil emporté : la première affirmation soufflée, puis les cinq justes ; quitté à la deuxième manche.
  let e = (vues.eclair = ok(await commencer(b, hugo, { origine: 'libre', jeu: 'eclair', carte: 'coup-d-oeil' }), 'l’Éclair'))
  e = vues.souffle = ok(await jouer(b, hugo, e, { quoi: 'eclairer', manche: 0, affirmation: 0 }), 'souffler')
  e = vues.eclairRevele = await jouerUnEclair(b, hugo, e, 0, true)
  e = await ouvrir(b, hugo, e, 1)
  vues.quitte = ok(await jouer(b, hugo, e, { quoi: 'quitter' }), 'quitter')
  // Un Éclair libre, Échange emporté : « Changer » avant de répondre ; puis quitté, pour laisser partir la chasse.
  vues.change = ok(await commencer(b, hugo, { origine: 'libre', jeu: 'eclair', carte: 'echange' }), 'Échange')
  ok(await jouer(b, hugo, vues.change, { quoi: 'quitter' }), 'quitter Échange')
  // Une chasse au Pari, parfaite et sans pouvoir : Leçon gagnée, son cadre doré.
  vues.gagnee = await unPariParfait(b, hugo, ok(await commencer(b, hugo, { origine: 'chasse', oeuvre: 'lecon', carte: null }), 'la chasse'))
}

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Un texte du contenu tel que `texte()` le lit : son apostrophe droite y devient la typographique. */
const lu = (s: string) => echapper(s.replace(/'/g, '’'))

/** Les écrans des jeux, tels que la page les charge à la demande. */
async function ecrans() {
  const pari = (await import(url('views/cabinet/jeux/Pari.tsx'))).PARI
  const eclair = (await import(url('views/cabinet/jeux/Eclair.tsx'))).ECLAIR
  return { pari, eclair } as Record<
    string,
    {
      localDe: (m: unknown) => unknown
      aLEcheance: (m: unknown, l: unknown) => unknown
      cibleDEclairer?: (m: unknown, l: unknown) => unknown
      aJoueSurPlace?: (m: unknown, l: unknown) => boolean
      sousEcranDe?: (m: unknown, l: unknown) => string
    }
  >
}

/** Une partie à l'écran, sur la vue du serveur : le chrono lu à son heure, ce que la page tient au départ de la manche. */
async function laPartie(vue: VueDeLaPartie, plus: Record<string, unknown> = {}) {
  const ecran = (await ecrans())[vue.jeu]
  const { chronoMontre } = await import(url('views/cabinet/Partie.tsx'))
  return rendu('views/cabinet/Partie', 'EcranDeLaPartie', {
    vue,
    ecran,
    local: vue.enCours ? ecran.localDe(vue.enCours) : null,
    setLocal: rien,
    chrono: chronoMontre(vue, vue.maintenant),
    busy: false,
    miser: null,
    garde: () => true,
    onGeste: rien,
    onQuitter: rien,
    onSuivante: rien,
    onMiser: rien,
    onSignaler: rien,
    onMusee: rien,
    ...plus,
  })
}

test('l’annonce : le jeu, son geste et son barème, ce qui est en jeu et le seuil, la carte-bonus et ce qu’elle fait à ce jeu — et « Commencer »', async () => {
  const annonce = (demande: object, plus: object = {}) =>
    rendu('views/cabinet/Annonce', 'Annonce', { page, demande, carte: null, busy: false, onCarte: rien, onCommencer: rien, onRetour: rien, ...plus })
  const libre = await annonce({ origine: 'libre', jeu: 'pari' })
  const t = texte(libre)
  assert.match(t, new RegExp(`Partie libre ${JEUX.pari.nom}`))
  assert.match(t, new RegExp(echapper(JEUX.pari.geste)))
  assert.match(t, new RegExp(echapper(JEUX.pari.bareme.replace(/^./, c => c.toUpperCase()))))
  assert.match(libre, /<button type="button" class="btn btn-primary btn-big btn-block">Commencer<\/button>/)
  // Sans carte-bonus retenue : il joue sans pouvoir, et peut en choisir une.
  assert.match(t, /Sans carte-bonus : tu joues sans pouvoir\. Choisir une carte-bonus/)
  // La carte retenue : ce qu'elle fait à ce jeu-là, au mot près de la règle (`ceQueFaitLaCarte`).
  assert.match(texte(await annonce({ origine: 'libre', jeu: 'pari' }, { carte: 'coup-d-oeil' })), new RegExp(echapper(ceQueFaitLaCarte('eclairer', 1, 'pari'))))
  assert.match(texte(await annonce({ origine: 'libre', jeu: 'eclair' }, { carte: 'coup-d-oeil' })), new RegExp(echapper(ceQueFaitLaCarte('eclairer', 1, 'eclair'))))
  // Changer, Protéger : ce qu'ils font, dit sous eux — la mise surtout, avant une manche, sans l'avoir vue.
  assert.match(texte(await annonce({ origine: 'libre', jeu: 'pari' }, { carte: 'echange' })), new RegExp(echapper(POUVOIRS.changer.dit)))
  // Une carte retenue qu'il n'a pas — un téléphone partagé — ne part pas avec lui.
  assert.match(texte(await annonce({ origine: 'libre', jeu: 'pari' }, { carte: 'bastion' })), /Sans carte-bonus/)
  // Une chasse : le cadre qu'elle vise, sa rareté et sa salle — pas son œuvre —, et le seuil.
  const chasse = texte(await annonce({ origine: 'chasse', oeuvre: 'expose' }))
  assert.match(chasse, new RegExp(`Une chasse ${JEUX[JEU_DE_L_OEUVRE.expose].nom}`))
  assert.match(chasse, /Peut te faire gagner une œuvre rare de la salle de l’Érudit/)
  assert.doesNotMatch(chasse, /Exposé/)
  assert.match(chasse, new RegExp(`Il faut ${SEUILS_DES_RARETES.rare} étoiles sur ${ETOILES_D_UNE_PARTIE} pour la gagner`))
  assert.match(chasse, /revenir au musée ne coûte pas ta chasse/)
  // Leçon, à elle : la rejouer pour la dorer.
  const dorer = texte(await annonce({ origine: 'chasse', oeuvre: 'lecon' }))
  assert.match(dorer, /Pour dorer Leçon/)
  assert.match(dorer, /Pour la dorer : toutes ses manches parfaites, sans qu’un pouvoir ait servi\./)
  // Une case de la visite : son enjeu, jamais son œuvre.
  const k = page.visite.cases.findIndex(c => !c.faite)
  const visite = texte(await annonce({ origine: 'visite', case: k }))
  assert.match(visite, new RegExp(`La visite du jour ${JEUX[page.visite.cases[k].jeu].nom}`))
  assert.match(visite, /revenir au musée ne coûte pas ta partie de la visite/)
  // Une partie que la page ne montre plus : rien à commencer.
  assert.doesNotMatch(await annonce({ origine: 'visite', case: 7 }), /Commencer/)
  sansJargon(libre, 'l’annonce')
  sansJargon(await annonce({ origine: 'chasse', oeuvre: 'expose' }), 'l’annonce d’une chasse')
})

test('les cartes-bonus de l’annonce : ses œuvres et ses gardiens réveillés, chacune ce qu’elle fait à ce jeu, l’état par aria-pressed', async () => {
  const { cartesBonusDe } = await import(url('views/cabinet/Annonce.tsx'))
  const cartes = cartesBonusDe(page) as { cle: string; pouvoir: string; force: number }[]
  assert.deepEqual(cartes.map(c => c.cle).sort(), [...OEUVRES_DE_DEPART, 'lecon'].sort())
  // Rangées par pouvoir — Éclairer d'abord —, la plus forte d'abord : Leçon, rare, avant Coup d'œil.
  assert.deepEqual(cartes.slice(0, 2).map(c => c.cle), ['lecon', 'coup-d-oeil'])
  // Un gardien réveillé, par quelque voie que ce soit, s'emporte à sa force la plus haute ; endormi, non.
  const avecLePhenix = { ...page, gardiens: { ...page.gardiens, tous: page.gardiens.tous.map(g => (g.legendaire === 'lg:phenix' ? { ...g, reveille: true, voie: 'ailleurs' as const } : g)) } }
  assert.deepEqual(
    cartesBonusDe(avecLePhenix).filter((c: { cle: string }) => c.cle.startsWith('lg:')),
    [{ cle: 'lg:phenix', nom: nom('lg:phenix'), pouvoir: 'proteger', force: 3 }],
  )
  const choix = (jeu: string, carte: string | null, p = page) => rendu('views/cabinet/Annonce', 'ChoixDeLaCarte', { cartes: cartesBonusDe(p), jeu, carte, onChoisir: rien })
  const html = await choix('pari', 'coup-d-oeil')
  assert.equal([...html.matchAll(/<button type="button" class="cab-choix-carte" aria-pressed="(true|false)">/g)].length, cartes.length + 1)
  assert.match(html, /aria-pressed="false"><span class="cab-carte">.*?Sans carte-bonus/)
  assert.equal([...html.matchAll(/aria-pressed="true"/g)].length, 1)
  for (const c of cartes) assert.match(texte(html), new RegExp(echapper(ceQueFaitLaCarte(c.pouvoir as 'eclairer', c.force as 1, 'pari'))), c.cle)
  // Ce qu'elle fait à ce jeu : Changer ne sert pas à la Frise, et l'annonce le dit avant qu'il ne l'emporte.
  assert.match(texte(await choix('frise', null)), /Changer ne sert pas à la Frise/)
  assert.match(texte(await choix('pari', null, avecLePhenix)), new RegExp(`${nom('lg:phenix')} ${echapper(ceQueFaitLaCarte('proteger', 3, 'pari'))}`))
  sansJargon(html, 'le choix de la carte-bonus')
})

test('une manche du Pari : la tête collée, la question et ses quatre réponses, la carte-bonus et son geste — jamais la bonne réponse', async () => {
  const v = vues.pari
  const html = await laPartie(v)
  const t = texte(html)
  // La tête : les trois manches, la première cerclée ; les étoiles sur neuf ; « Quitter » ; le chrono, à l'heure du serveur.
  assert.match(html, /<header class="cab-tete-partie">/)
  assert.match(html, /role="img" aria-label="Manche 1 sur 3"/)
  assert.equal([...html.matchAll(/class="cab-point( cab-point-ici)?"/g)].length, 3)
  assert.match(html, /class="cab-point cab-point-ici"/)
  assert.match(html, new RegExp(`aria-label="0 étoile sur ${ETOILES_D_UNE_PARTIE}"`))
  assert.match(html, />Quitter<\/button>/)
  assert.match(html, /role="timer"/)
  // Pas de sortie pendant que le chrono court : seul « Quitter », qui le met en pause.
  assert.doesNotMatch(html, /jour-sortie/)
  const q = (v.enCours as { question: { texte: string; reponses: string[]; categorie: string } }).question
  assert.match(t, new RegExp(lu(q.texte)))
  assert.match(t, new RegExp(lu(q.categorie)))
  assert.equal([...html.matchAll(/<button type="button" class="ans-btn"/g)].length, 4)
  for (const r of q.reponses) assert.match(t, new RegExp(lu(r)))
  assert.equal([...html.matchAll(/class="ans-shape shape-\d"/g)].length, 4)
  // La carte-bonus, dans le pied collé : Éclairer, ce qui en reste.
  assert.match(html, /<div class="cab-pied-partie"><button type="button" class="btn btn-block cab-pouvoir">/)
  assert.match(t, new RegExp(`${POUVOIRS.eclairer.nom} · encore 1`))
  // Rien de la bonne réponse : ni un attribut qui la marque, ni la classe qui la dit — la question d'essai du banc dit « la bonne », ses réponses aussi.
  assert.doesNotMatch(html, /(bonne|correct|juste)[\w-]*="|cab-juste|class="corrige/i)
  sansJargon(html, 'une manche du Pari')
})

test('le Pari éclairé, juste au choix, parié : la réponse effacée barrée, les mots du barème, la question difficile', async () => {
  // Éclairé : une mauvaise réponse effacée — en sourdine, barrée, dite à l'oreille —, et Éclairer grisé, sa raison dessous.
  const eclaire = await laPartie(vues.eclaire)
  assert.equal([...eclaire.matchAll(/class="ans-btn cab-effacee" aria-disabled="true"/g)].length, 1)
  assert.match(eclaire, /<span class="sr-only">, effacée<\/span>/)
  assert.match(eclaire, /class="btn btn-block cab-pouvoir" aria-disabled="true"/)
  assert.match(texte(eclaire), new RegExp(echapper(vues.eclaire.pouvoir!.refus!)))
  // Éteinte, la carte-bonus ne reste pas collée au bas de l'écran : en 360 × 640, elle couvrait la quatrième réponse.
  assert.match(eclaire, /<div class="cab-pied-partie cab-pied-pose"><button/)
  assert.match(await laPartie(vues.pari), /<div class="cab-pied-partie"><button/)
  // Sans carte-bonus, pas de pied du tout : un bandeau vide se collait au bas de l'écran.
  assert.doesNotMatch(await laPartie({ ...vues.pari, carte: null, pouvoir: undefined } as unknown as VueDeLaPartie), /cab-pied-partie/)
  // Juste : sa réponse, et le choix dans les mots du barème (`MOTS_DU_PARI`) — jamais « Garder ★ » écrit à la main.
  const auChoix = await laPartie(vues.auChoix)
  const t = texte(auChoix)
  assert.match(t, new RegExp(echapper(MOTS_DU_PARI.auChoix)))
  assert.match(auChoix, new RegExp(`<button type="button" class="btn btn-big">${echapper(MOTS_DU_PARI.garder)}</button>`))
  assert.match(auChoix, new RegExp(`<button type="button" class="btn btn-primary btn-big">${echapper(MOTS_DU_PARI.parier)}</button>`))
  // Entre « Juste ! » et le choix, aucun chrono ne court, et aucune réponse ne se touche.
  assert.doesNotMatch(auChoix, /role="timer"/)
  assert.doesNotMatch(auChoix, /class="ans-btn/)
  for (const f of ['views/cabinet/jeux/Pari.tsx', 'views/cabinet/Partie.tsx']) assert.doesNotMatch(source(f), /Garder ★|Étoiles? gardées?/, f)
  // Parié : la question difficile, sous son nom, avec son chrono.
  const etape2 = await laPartie(vues.etape2)
  assert.match(texte(etape2), /Le pari · question difficile/)
  assert.match(etape2, /role="timer"/)
  assert.equal([...etape2.matchAll(/<button type="button" class="ans-btn"/g)].length, 4)
})

test('une manche de l’Éclair : une affirmation à la fois, sa réponse proposée, « Faux » et « Vrai » — ce que la page tient part à l’échéance', async () => {
  const { eclair } = await ecrans()
  const v = vues.eclair
  const m = v.enCours as { affirmations: { texte: string; proposee: string }[] }
  const t = texte(await laPartie(v))
  assert.match(t, new RegExp(`Affirmation 1 sur ${m.affirmations.length}`))
  assert.match(t, new RegExp(lu(m.affirmations[0].texte)))
  assert.match(t, new RegExp(`« ${lu(m.affirmations[0].proposee)} »`))
  assert.doesNotMatch(t, new RegExp(lu(m.affirmations[1].texte)), 'une à la fois')
  assert.match(await laPartie(v), /class="ans-btn cab-faux".*Faux.*class="ans-btn cab-vrai".*Vrai/)
  // Deux réponses dites : la troisième sous les yeux ; les points disent celles qui sont dites, sans compter les justes.
  const local = { reponses: [true, false, null, null, null], ici: 2 }
  const html = await laPartie(v, { local })
  assert.match(texte(html), /Affirmation 3 sur 5/)
  assert.equal([...html.matchAll(/class="cab-dite"/g)].length, 2)
  assert.doesNotMatch(texte(html), /juste|sur 5 justes|\d sur 5$/)
  // À l'échéance, celles qu'il a eu le temps de dire ; Éclairer vise celle qu'il a sous les yeux ; Changer vient avant de répondre.
  assert.deepEqual(eclair.aLEcheance(v.enCours, local), { eclair: { reponses: [true, false, null, null, null] } })
  assert.equal(eclair.cibleDEclairer?.(v.enCours, local), 2)
  assert.equal(eclair.aJoueSurPlace?.(v.enCours, eclair.localDe(v.enCours)), false)
  assert.equal(eclair.aJoueSurPlace?.(v.enCours, local), true)
  // Soufflée par Éclairer : l'indice, sur l'affirmation qu'il vise.
  const souffle = vues.souffle.enCours as { soufflees: { affirmation: number; vraie: boolean }[] }
  assert.match(texte(await laPartie(vues.souffle)), new RegExp(`Indice : c’est ${souffle.soufflees[0].vraie ? 'vrai' : 'faux'}\\.`))
  // Échange emporté : « Changer » se joue tant que rien n'est dit, puis se grise sur ce que la page tient, dans les mots de la règle.
  const change = await laPartie(vues.change)
  assert.match(change, /class="btn btn-block cab-pouvoir">.*Changer/)
  const apres = await laPartie(vues.change, { local })
  assert.match(apres, /class="btn btn-block cab-pouvoir" aria-disabled="true">.*Changer/)
  assert.match(texte(apres), /Change avant de répondre/)
  sansJargon(await laPartie(v), 'une manche de l’Éclair')
})

test('la pause de « Quitter ? » : la manche voilée, le chrono figé trente secondes au plus, puis repris sous le voile', async () => {
  const { chronoMontre, messageDuQuitter } = await import(url('views/cabinet/Partie.tsx'))
  const v = vues.pause
  assert.equal(v.phase, 'pause')
  const c = v.chrono!
  assert.ok(c.pauseResteMs! > 0)
  // Figé sur ce qui restait, l'échéance reculée de ce qui reste de pause : la réponse partira là, la confirmation encore ouverte.
  assert.deepEqual(chronoMontre(v, v.maintenant), { echeance: c.echeance + c.pauseResteMs!, dureeMs: c.dureeMs, figeMs: c.echeance - v.maintenant })
  assert.deepEqual(chronoMontre(v, v.maintenant + c.pauseResteMs!), { echeance: c.echeance + c.pauseResteMs!, dureeMs: c.dureeMs })
  assert.equal(chronoMontre(vues.auChoix, vues.auChoix.maintenant), null)
  const html = await laPartie(v)
  assert.match(html, /class="cab-voile" role="note"/)
  assert.match(html, /aria-label="Chronomètre en pause"/)
  // Rien de la manche sous le voile : ni la question, ni ses réponses.
  const q = (vues.pari.enCours as { question: { texte: string; reponses: string[] } }).question
  assert.doesNotMatch(texte(html), new RegExp(lu(q.texte)))
  for (const r of q.reponses) assert.doesNotMatch(texte(html), new RegExp(lu(r)))
  // Ce que demande « Quitter ? » : la partie comptée, ce que le départ a consommé, et le chrono — figé, ou qui continue.
  assert.deepEqual(messageDuQuitter({ origine: 'libre' }, { pauseMs: 30_000 }), { titre: 'Quitter cette partie ?', message: 'Elle compte avec ses étoiles. Le chrono t’attend 30 secondes au plus, la manche cachée.' })
  // Ce qui reste de pause se dit en secondes entières, vers le haut, et accordées : arrondies, 300 ms faisaient « 0 secondes ».
  for (const [ms, dit] of [[300, '1 seconde'], [1_000, '1 seconde'], [1_001, '2 secondes'], [29_400, '30 secondes']] as const) {
    assert.match(messageDuQuitter({ origine: 'libre' }, { pauseMs: ms }).message, new RegExp(`t’attend ${dit} au plus`), `${ms} ms`)
  }
  const chasse = messageDuQuitter({ origine: 'chasse' }, { refus: PLUS_DE_PAUSE })
  assert.equal(chasse.titre, 'Quitter ?')
  assert.match(chasse.message, /La partie compte avec les étoiles déjà gagnées, et ta chasse est utilisée\./)
  assert.match(chasse.message, new RegExp(`${PLUS_DE_PAUSE}\\.$`))
  assert.match(messageDuQuitter({ origine: 'visite' }).message, /cette partie de la visite est faite\.$/)
  // Refusée, la pause ouvre quand même la confirmation (les relais de C1) : la page ne la conditionne pas à la pause.
  const partie = source('views/cabinet/Partie.tsx')
  assert.match(partie, /refus = motifDe\(e\)/)
  assert.match(partie, /const oui = await confirmDialog\(\{ title: titre, message, confirmLabel: 'Quitter', cancelLabel: 'Continuer', danger: true \}\)/)
  // Sous la confirmation, le voile n'a pas de bouton : « Quitter ? » répondra.
  assert.doesNotMatch(html, />Continuer<\/button>/)
})

test('une pause sans question — rechargée sous « Quitter ? », sa reprise perdue — a son « Continuer » sous le voile, qui la reprend', async () => {
  // Zoé touche « Quitter » (la pause s'écrit), puis son téléphone jette l'onglet : le musée relu propose sa partie, en pause.
  const zoe = await inscrireProfil(b.banc.url, 'zoe', 'Zoé')
  const v = ok(await commencer(b, zoe, { origine: 'libre', jeu: 'pari', carte: null }), 'le Pari de Zoé')
  ok(await jouer(b, zoe, v, { quoi: 'pause', manche: 0 }), 'la pause')
  const relue = ok(await laPage(b, zoe), 'la page relue').enCours!
  assert.equal(relue.phase, 'pause')
  // Reprise du musée sans question ouverte : la manche reste cachée, et « Continuer » la rouvre — sans lui, le voile n'avait
  // aucun bouton, le chrono repartait dessous passé trente secondes, et la manche partait vide à son échéance.
  const orpheline = await laPartie(relue, { onReprendre: rien })
  assert.match(orpheline, /class="cab-voile" role="note">.*<button type="button" class="btn btn-primary btn-big">Continuer<\/button>/)
  assert.match(texte(orpheline), /En pause Ta manche t’attend, cachée\./)
  const q = (v.enCours as { question: { texte: string } }).question
  assert.doesNotMatch(texte(orpheline), new RegExp(lu(q.texte)))
  // Le geste qu'il envoie, au rang de la vue relue : la manche se rejoue.
  const reprise = ok(await jouer(b, zoe, relue, { quoi: 'reprendre', manche: relue.manche }), 'reprendre')
  assert.equal(reprise.phase, 'jouer')
  ok(await jouer(b, zoe, reprise, { quoi: 'quitter' }), 'quitter')
  // La page ne le pose que sans question : sous « Quitter ? », c'est la confirmation qui reprend.
  const partie = source('views/cabinet/Partie.tsx')
  assert.match(partie, /onReprendre=\{vue\.phase === 'pause' && !question \? reprendre : undefined\}/)
  assert.match(partie, /const reprendre = \(\) => \{\s*if \(garde\(\)\) void jouer\(\{ quoi: 'reprendre', manche: vueRef\.current\.manche \}\)/)
  assert.match(partie, /setQuestion\(true\)[\s\S]*finally \{\s*enQuestion\.current = false\s*setQuestion\(false\)/)
})

test('la révélation : les étoiles de la manche, ce qui s’est passé, le corps du jeu, « Le savais-tu ? », la niche, et « Signaler » pour la base seule', async () => {
  // Le pari gagné : trois étoiles, la gerbe, les deux questions corrigées, chacune signalable.
  const gagne = await laPartie(vues.gagne)
  const t = texte(gagne)
  assert.match(gagne, /<div class="card result-banner result-ok" role="status"><span hidden="">/)
  assert.match(gagne, /aria-label="3 étoiles sur 3"/)
  assert.match(t, /Pari gagné !/)
  assert.equal([...gagne.matchAll(/class="corrige ok"/g)].length, 2)
  assert.match(t, /La question .*Le pari · question difficile/)
  assert.match(t, /Le savais-tu \?/)
  assert.match(gagne, /class="btn btn-primary btn-big btn-block">Manche suivante<\/button>/)
  assert.match(t, /Signaler une erreur dans la première question .*Signaler une erreur dans la question du pari/)
  // Entre deux manches, rien ne court : on peut repartir au musée, la partie l'y attend.
  assert.match(gagne, /href="\/cabinet"[^>]*>.*Le Cabinet/)
  // Gardée : ses étoiles dans les mots du barème.
  assert.match(texte(await laPartie(vues.garde)), new RegExp(`${echapper(MOTS_DU_PARI.gardees)}`))
  // Ratée à la dernière : la révélation d'abord, puis « Voir le bilan ».
  const fini = await laPartie(vues.fini)
  assert.match(fini, /class="card result-banner result-ko"/)
  assert.match(fini, />Voir le bilan<\/button>/)
  assert.match(texte(fini), /Raté/)
  // L'Éclair : cinq sur cinq, chacune corrigée, et le carnet n'en garde rien — dit à l'écran ; rien à signaler.
  const eclair = await laPartie(vues.eclairRevele)
  const e = texte(eclair)
  assert.match(e, /5 sur 5/)
  assert.equal([...eclair.matchAll(/class="corrige ok"/g)].length, 5)
  assert.match(e, /Les affirmations ne vont pas au carnet\./)
  assert.doesNotMatch(e, /Signaler/)
  sansJargon(gagne, 'la révélation')
})

test('ce que la révélation fête : la niche dit la pièce juste, la gerbe ce que fête le bandeau — ni une mise perdue, ni une manche protégée', async () => {
  const { ceQueFeteLaRevelation } = await import(url('views/cabinet/Partie.tsx'))
  const fete = (naturel: number, etoiles: number) => ceQueFeteLaRevelation(naturel, etoiles) as { gerbe: boolean; niche: { verdict: string; nourri: boolean } }
  // Sans pouvoir : à deux étoiles et plus, la gerbe et la niche ravie ; à une, calme ; à zéro, dépitée.
  assert.deepEqual([3, 2, 1, 0].map(n => fete(n, n).gerbe), [true, true, false, false])
  assert.deepEqual([3, 2, 1, 0].map(n => fete(n, n).niche.verdict), ['juste', 'juste', 'calme', 'ratee'])
  // Une mise gagnée : trois naturelles, et le bonus par-dessus.
  assert.ok(fete(3, 7).gerbe)
  // Une mise perdue à deux naturelles : zéro étoile, le bandeau rouge — la gerbe n'y éclate plus. La pièce reste juste (D3) : le
  // journal la retient, le compagnon en est nourri, et la niche le dit.
  assert.equal(fete(2, 0).gerbe, false)
  assert.deepEqual([fete(2, 0).niche.verdict, fete(2, 0).niche.nourri], ['juste', true])
  // Protégée d'une étoile à deux : le bandeau vert, mais pas une juste — ni gerbe, ni compagnon nourri (§ 4.2).
  assert.equal(fete(1, 2).gerbe, false)
  assert.deepEqual([fete(1, 2).niche.verdict, fete(1, 2).niche.nourri], ['calme', false])
  // À l'écran : la mise perdue en rouge, zéro étoile, sa note ; la manche protégée en vert, ses deux étoiles.
  const g = vues.gagne
  const avec = (m: object) => ({ ...g, manches: g.manches.map((x, k) => (k === g.revelation!.manche ? { ...x, ...m } : x)) }) as VueDeLaPartie
  const perdue = await laPartie(avec({ etoiles: 0, naturel: 2, note: 'Mise perdue' }))
  assert.match(perdue, /class="card result-banner result-ko"/)
  assert.match(perdue, /aria-label="0 étoile sur 3"/)
  assert.match(texte(perdue), /Mise perdue/)
  const protegee = await laPartie(avec({ etoiles: 2, naturel: 1, note: 'Rempart protège la manche : +1 étoile' }))
  assert.match(protegee, /class="card result-banner result-ok"/)
  assert.match(protegee, /aria-label="2 étoiles sur 3"/)
  // La révélation ne lit que lui.
  const partie = source('views/cabinet/Partie.tsx')
  assert.match(partie, /const fete = ceQueFeteLaRevelation\(m\?\.naturel \?\? 0, etoiles\)/)
  assert.match(partie, /reaction=\{fete\.niche\}/)
  assert.match(partie, /\{fete\.gerbe && <GerbeDeJuste \/>\}/)
})

test('la mise : avant la manche, sans l’avoir vue — « Miser » ou « Pas cette fois »', async () => {
  const carte = { cle: 'tout-ou-rien', pouvoir: 'miser', force: 1, reste: 1, dit: ceQueFaitLaCarte('miser', 1, 'pari') }
  const avant = { ...vues.pari, phase: 'avant', carte, pouvoir: { jouable: true }, enCours: undefined, chrono: undefined } as unknown as VueDeLaPartie
  const html = await laPartie(avant)
  const t = texte(html)
  assert.match(t, /Manche 1 sur 3 Miser sur cette manche \?/)
  assert.match(t, new RegExp(echapper(POUVOIRS.miser.dit)))
  assert.match(t, new RegExp(echapper(carte.dit)))
  assert.match(html, />Miser<\/button>.*>Pas cette fois<\/button>/)
  // Rien de la manche : elle n'est pas ouverte.
  assert.doesNotMatch(html, /ans-btn|role="timer"/)
  // Après une révélation, la manche suivante se mise de même.
  assert.match(texte(await laPartie({ ...vues.gagne, carte } as VueDeLaPartie, { miser: 1 })), /Manche 2 sur 3 Miser sur cette manche \?/)
})

test('le bilan : l’issue en clair, les étoiles manche par manche, la poussière, l’œuvre et son cartel, puis l’écran des gains', async () => {
  const ecran = (await ecrans()).pari
  const bilan =(vue: VueDeLaPartie, plus: object = {}) => rendu('views/cabinet/Bilan', 'BilanDeLaPartie', { vue, ecran, onMusee: rien, ...plus })
  // Une partie libre : ses étoiles, ce qu'elle a rapporté — la phrase du serveur —, l'expérience et les confettis.
  const v = vues.fini
  const html = await bilan(v, { onRejouer: rien })
  const t = texte(html)
  assert.match(t, new RegExp(`Partie libre · ${JEUX.pari.nom} Partie finie`))
  assert.match(t, new RegExp(`${v.bilan!.total} étoiles sur ${ETOILES_D_UNE_PARTIE}`))
  assert.equal([...html.matchAll(/<span class="cab-surtitre">Manche \d<\/span>/g)].length, 3)
  assert.match(t, new RegExp(lu(v.bilan!.dit)))
  assert.ok(v.bilan!.poussiere > 0)
  assert.match(t, new RegExp(`\\+${v.bilan!.poussiere} poussières d’or`))
  assert.match(html, /<b class="num">\+\d+ XP<\/b>/)
  assert.match(t, new RegExp(`\\+${v.bilan!.gains!.confettis} confettis`))
  assert.match(html, />Revenir au musée<\/button>.*>Mes réponses<\/button>.*>Rejouer · Le Pari<\/button>/)
  // Une chasse sans faute : l'œuvre en grand, son cadre doré — dit à l'oreille —, et son cartel.
  const g = vues.gagnee
  assert.equal(g.bilan!.issue, 'gagnee-doree')
  const gagnee = await bilan(g)
  const tg = texte(gagnee)
  assert.match(tg, /Une chasse · Le Pari Gagnée sans faute !/)
  assert.match(tg, /Leçon entre dans ton musée, dans un cadre doré/)
  assert.match(gagnee, /class="exp-vc exp-vc-levee exp-vc-doree"/)
  assert.match(tg, /cadre doré/)
  assert.match(tg, new RegExp(`Son cartel : ce que tu as appris en la gagnant ${lu(g.bilan!.cartel!.sujet)} ${lu(g.bilan!.cartel!.reponse)}`))
  assert.doesNotMatch(gagnee, /Rejouer/)
  // Quittée : elle le dit, et compte avec ses étoiles.
  assert.match(texte(await bilan(vues.quitte)), /Tu as quitté la partie : elle compte avec ses étoiles\./)
  // Un gardien réveillé : en grand, avant les gains ; un gardien qui veillait déjà : une phrase, rien à fêter.
  const reveille = { ...g, bilan: { ...g.bilan!, gains: { ...g.bilan!.gains!, legendaires: ['lg:chouette'] }, gardiens: [{ legendaire: 'lg:phenix', neuf: false }] } }
  const r = await bilan(reveille as VueDeLaPartie)
  assert.match(texte(r), new RegExp(`Salle complète ! ${nom('lg:phenix')} veillait déjà sur elle\\.`))
  const ou = (m: string) => r.indexOf(m)
  const ordre = ['cab-bilan-tete', 'cab-oeuvre-gagnee', 'fin-legendaire', 'class="card gains"', 'class="fin-actions"'].map(ou)
  assert.ok(ordre.every(i => i >= 0), ordre.join(','))
  assert.deepEqual(ordre, [...ordre].sort((a, c) => a - c))
  sansJargon(html, 'le bilan')
})

test('le retour du navigateur pendant une manche : sa garde se pose par-dessus l’entrée de la partie, et la consommer laisse la partie ouverte', async () => {
  const { poserLEntreeDeLaPartie, partieDansLEntree, effacerLaMarqueAuChargement } = await import(url('views/cabinet/ecrans.ts'))
  // D'une œuvre, « Partir à sa recherche », « Commencer » : l'entrée de la partie, puis la garde de la manche, qui la recopie.
  const n = historique('/cabinet#oeuvre-expose')
  poserLEntreeDeLaPartie(n.h)
  n.h.pushState({ ...(n.h.state as object), fiestappGarde: 'garde-manche' }, '')
  assert.ok(partieDansLEntree(n.h.state), 'la garde porte la marque de la partie')
  // Le retour consomme la garde : on est sur l'entrée de la partie, qui reste ouverte — et la question « Quitter ? » se pose.
  n.h.back()
  assert.ok(partieDansLEntree(n.h.state))
  assert.equal((n.h.state as Record<string, unknown>).fiestappGarde, undefined)
  assert.equal(n.url(), '/cabinet#oeuvre-expose')
  // Rechargée sur la garde, la page n'a plus de partie ouverte : la marque de la partie s'efface, la garde reste — périmée, d'un
  // autre montage : la manche suivante pose la sienne, elle ne la prend pas pour elle.
  n.h.pushState({ ...(n.h.state as object), fiestappGarde: 'garde-manche' }, '')
  effacerLaMarqueAuChargement(n.h)
  assert.deepEqual(n.h.state, { fiestappGarde: 'garde-manche' })
  // Le hook lit sa marque une fois par montage, et pose la garde par `garder` (épreuve suivante, sur un faux historique).
  const retour = source('retour.ts')
  assert.match(retour, /const \[marque\] = useState\(\(\) => marqueDeLaGarde\(auRetour !== undefined\)\)/)
  assert.match(retour, /return garder\(window\.history, window, marque, \(\) => \(question\.current \?\? quitterLaSoiree\)\(\)\)/)
  // La partie la pose pendant une manche seulement — rien ne court entre deux manches —, avec son « Quitter ? » pour question.
  assert.match(source('views/cabinet/Partie.tsx'), /useGardeRetour\(vue\.phase === 'jouer' \|\| vue\.phase === 'pause', demanderAQuitter\)/)
  // La soirée garde la sienne, telle quelle.
  assert.match(source('views/PlayerApp.tsx'), /useGardeRetour\([^,)]*\)/)
})

test('la garde du retour : un jeton par montage, la question posée une fois, « reste » la repose, « parti » non — et levée, plus rien', async () => {
  const { garder, marqueDeLaGarde, porteLaGarde } = await import(url('retour.ts'))
  const tour = () => new Promise(r => setTimeout(r, 0))
  /** Une question qu'on tranche à la main, comme le joueur sous « Quitter ? ». */
  const enAttente: ((issue: 'parti' | 'reste') => void)[] = []
  const question = () => new Promise<'parti' | 'reste'>(r => enAttente.push(r))
  const retourDuNavigateur = (n: ReturnType<typeof historique>, ecoute: EventTarget) => {
    n.h.back()
    ecoute.dispatchEvent(new Event('popstate'))
  }
  // La marque : la soirée garde `true`, une page qui dit sa question un jeton neuf à chaque montage.
  assert.equal(marqueDeLaGarde(false), true)
  const marque = marqueDeLaGarde(true) as string
  assert.match(marque, /^garde-[a-z0-9]+$/)
  assert.notEqual(marqueDeLaGarde(true), marque)

  // Rechargée sur une garde d'un autre montage, la page ne la prend pas pour la sienne : elle pose la sienne par-dessus.
  const n = historique('/cabinet')
  n.h.replaceState({ fiestappGarde: 'garde-ancien' }, '')
  const ecoute = new EventTarget()
  const lever = garder(n.h, ecoute, marque, question)
  assert.equal(n.longueur(), 2)
  assert.ok(porteLaGarde(n.h.state, marque))
  assert.ok(!porteLaGarde({ fiestappGarde: 'garde-ancien' }, marque))
  assert.equal((n.h as { scrollRestoration?: string }).scrollRestoration, 'manual')
  // Le retour consomme la garde : la question se pose, une fois — un second retour pendant qu'elle attend n'en pose pas d'autre.
  retourDuNavigateur(n, ecoute)
  assert.equal(enAttente.length, 1)
  ecoute.dispatchEvent(new Event('popstate'))
  assert.equal(enAttente.length, 1)
  // « Reste » : la garde se repose, une seule entrée au-dessus de la partie.
  enAttente[0]('reste')
  await tour()
  assert.ok(porteLaGarde(n.h.state, marque))
  assert.equal(n.longueur(), 2)
  // « Parti » : la page s'en charge, la garde ne revient pas.
  retourDuNavigateur(n, ecoute)
  enAttente[1]('parti')
  await tour()
  assert.ok(!porteLaGarde(n.h.state, marque))
  assert.equal(n.ici(), 0)
  // La question qui finit après la garde — la partie fermée sous elle — ne la repose plus : elle empilait une entrée orpheline.
  n.h.pushState({ fiestappGarde: marque }, '')
  retourDuNavigateur(n, ecoute)
  assert.equal(enAttente.length, 3)
  lever()
  enAttente[2]('reste')
  await tour()
  assert.ok(!porteLaGarde(n.h.state, marque))
  assert.equal(n.ici(), 0)
  // Levée, elle n'écoute plus rien.
  ecoute.dispatchEvent(new Event('popstate'))
  assert.equal(enAttente.length, 3)

  // Levée sur son entrée, la garde recule d'elle-même, au tour suivant : laissée là, le retour suivant tombait dans le vide.
  const m = historique('/cabinet')
  const leverM = garder(m.h, new EventTarget(), marqueDeLaGarde(true), question)
  assert.equal(m.ici(), 1)
  leverM()
  await tour()
  assert.equal(m.ici(), 0)
  // La soirée reprend la garde d'un rechargement, sans en empiler une seconde.
  const s = historique('/chez-bruno')
  s.h.replaceState({ fiestappGarde: true }, '')
  const leverS = garder(s.h, new EventTarget(), true, question)
  assert.equal(s.longueur(), 1)
  leverS()
  await tour()
})

test('« Quitter ? » se ferme quand la réponse partie d’elle-même tourne la page, et une partie démontée emporte sa question', async () => {
  const { confirmDialog, promptDialog, fermerLeDialogue } = await import(url('components/Dialog.tsx'))
  // Fermer le dialogue ouvert vaut renoncer : la confirmation rend non, la saisie rien.
  const quitter = confirmDialog({ title: 'Quitter ?' })
  fermerLeDialogue()
  assert.equal(await quitter, false)
  const saisie = promptDialog({ title: 'Signaler', input: { value: 'x' } })
  fermerLeDialogue()
  assert.equal(await saisie, null)
  // Sans dialogue ouvert, rien : le suivant s'ouvre et se ferme comme les autres.
  fermerLeDialogue()
  const encore = confirmDialog({ title: 'Quitter ?' })
  fermerLeDialogue()
  assert.equal(await encore, false)

  const { laReponseTourneLaPage } = await import(url('views/cabinet/Partie.tsx'))
  // La manche tranchée sous la confirmation : le Pari parié, l'Éclair et ses cinq affirmations, la dernière manche, la partie finie.
  assert.equal(laReponseTourneLaPage(vues.etape2, vues.gagne), true)
  assert.equal(laReponseTourneLaPage(vues.souffle, vues.eclairRevele), true)
  assert.equal(laReponseTourneLaPage(vues.pari, vues.fini), true)
  // L'étape suivante ouverte — à la Réplique, « Qui l'a dit ? » —, la pause close avec elle : la confirmation ne promet plus rien de vrai.
  assert.equal(laReponseTourneLaPage(vues.pari, vues.etape2), true)
  // Revenue sur la même étape (passée : l'autre onglet l'a rejouée), elle reste ouverte.
  assert.equal(laReponseTourneLaPage(vues.pause, vues.eclaire), false)
  assert.equal(laReponseTourneLaPage(vues.pari, vues.pause), false)

  const partie = source('views/cabinet/Partie.tsx')
  // Seule la réponse « auto » la ferme, et seulement si elle a tourné la page.
  assert.match(partie, /if \(auto && enQuestion\.current && laReponseTourneLaPage\(v, r\.partie\)\) fermerLeDialogue\(\)/)
  // Démontée sous la question (un second retour), la partie la ferme, et n'envoie plus rien de l'écran disparu.
  assert.match(partie, /return \(\) => \{\s*monte\.current = false\s*if \(enQuestion\.current\) fermerLeDialogue\(\)\s*\}/)
  assert.match(partie, /if \(!monte\.current\) return 'parti'/)
})

test('la vue la plus récente gagne : un rang plus vieux, ou au même rang une heure plus vieille, ne remplace rien', async () => {
  const { plusRecente } = await import(url('views/cabinet/Partie.tsx'))
  // Le rang d'abord : la page relue au retour au premier plan, partie avant le geste, n'efface pas sa réponse.
  assert.ok(vues.eclaire.rang > vues.pari.rang)
  assert.equal(plusRecente(vues.eclaire, vues.pari), false)
  assert.equal(plusRecente(vues.pari, vues.eclaire), true)
  // À rang égal, l'heure où le serveur l'a dite : la pause qui s'écoule ne change pas le rang.
  const plusTard = { ...vues.pause, maintenant: vues.pause.maintenant + 1_000 }
  assert.equal(plusRecente(vues.pause, plusTard), true)
  assert.equal(plusRecente(plusTard, vues.pause), false)
  // La même vue relue la remplace : rien n'y change.
  assert.equal(plusRecente(vues.pause, { ...vues.pause }), true)
  assert.match(source('views/cabinet/Partie.tsx'), /if \(!plusRecente\(vueRef\.current, v\)\) return/)
})

test('d’une affirmation de l’Éclair à la suivante, la demi-seconde de garde repart : un double toucher ne répond pas à celle qu’on n’a pas lue', async () => {
  const { eclair, pari } = await ecrans()
  const { gesteAccepte } = await import('../../shared/console')
  const m = vues.eclair.enCours
  const sous = eclair.sousEcranDe!
  const avant = { reponses: [null, null, null, null, null], ici: 0 }
  const apres = { reponses: [true, null, null, null, null], ici: 1 }
  assert.notEqual(sous(m, avant), sous(m, apres))
  // Ce que fait le cadre : la manche ouverte depuis longtemps, le premier toucher passe ; il change l'affirmation, la garde repart,
  // et le second, cent millisecondes plus tard, tombe dedans.
  let changement: number | null = 0
  const t = 60_000
  assert.ok(gesteAccepte(changement, t))
  if (sous(m, avant) !== sous(m, apres)) changement = t
  assert.equal(gesteAccepte(changement, t + 100), false)
  // Le Pari n'a rien sous le doigt qui change sans la vue : chaque étape en est une.
  assert.equal(pari.sousEcranDe, undefined)
  const partie = source('views/cabinet/Partie.tsx')
  assert.match(partie, /const sousLeDoigt = pret && vue\.enCours \? \(pret\.sousEcranDe\?\.\(vue\.enCours, valeur\) \?\? ''\) : ''/)
  assert.match(partie, /changement\.current = performance\.now\(\)\s*\}, \[cleDEcran, sousLeDoigt\]\)/)
})

test('« Commencer » ouvre la partie sur son entrée, et la retrouve quand sa réponse s’est perdue en route', async () => {
  const { estLaPartieDemandee } = await import(url('views/cabinet/Annonce.tsx'))
  // Par le vrai serveur : la partie commencée — sa réponse perdue —, un second « Commencer » se refuse, et la page relue la montre.
  const yann = await inscrireProfil(b.banc.url, 'yann', 'Yann')
  const demande = { origine: 'libre', jeu: 'eclair' } as const
  const v = ok(await commencer(b, yann, { ...demande, carte: null }), 'l’Éclair de Yann')
  const encore = await commencer(b, yann, { ...demande, carte: null })
  assert.notEqual(encore.status, 200)
  const attend = ok(await laPage(b, yann), 'la page relue').enCours!
  assert.equal(attend.id, v.id)
  assert.equal(estLaPartieDemandee(attend, demande, 'eclair'), true)
  // Une autre demande ne la prend pas pour la sienne.
  assert.equal(estLaPartieDemandee(attend, { origine: 'libre', jeu: 'pari' }, 'pari'), false)
  assert.equal(estLaPartieDemandee(attend, { origine: 'chasse', oeuvre: 'expose' }, 'eclair'), false)
  assert.equal(estLaPartieDemandee(vues.gagnee, { origine: 'chasse', oeuvre: 'lecon' }, 'pari'), true)
  ok(await jouer(b, yann, attend, { quoi: 'quitter' }), 'quitter')
  const app = source('views/CabinetApp.tsx')
  const debut = app.indexOf('const commencer = async')
  const commencerSrc = app.slice(debut, app.indexOf('\n  }\n', debut))
  // Réussi, sur une entrée marquée — le retour a pu fermer l'annonce pendant la requête — ; perdu, la page relue la trouve.
  assert.match(commencerSrc, /ouvrir\(\{ e: 'jeu', vue \}\)/)
  assert.doesNotMatch(commencerSrc, /setEnPartie\(/)
  assert.match(commencerSrc, /if \(attend && jeu && estLaPartieDemandee\(attend, demande, jeu\)\) ouvrir\(\{ e: 'jeu', vue: attend \}\)/)
  // Fermée par le retour en pleine partie, la page se relit : « Reprendre » la rouvre telle qu'elle est devenue.
  assert.match(app, /if \(enPartieRef\.current\?\.e === 'jeu' && !partieDansLEntree\(window\.history\.state\)\) relire\(\)/)
})

test('une partie dit son heure au serveur : l’échéance lue à serverNow, la réponse « auto » à l’échéance, chaque geste à son rang, la demi-seconde de garde', () => {
  const partie = source('views/cabinet/Partie.tsx')
  assert.doesNotMatch(partie.replace(/\/\/.*$/gm, ''), /Date\.now\(\)/, 'jamais l’heure du téléphone')
  assert.match(partie, /const c = chronoMontre\(vue, serverNow\(\)\)/)
  assert.match(partie, /await jouer\(\{ quoi: 'repondre', manche, auto: true, \.\.\.\(reponse && \{ reponse \}\) \}, true\)/)
  assert.match(partie, /\{ premier: Math\.max\(0, c\.echeance - serverNow\(\)\) \}/)
  assert.match(partie, /api\.cabinet\.geste\(v\.id, v\.rang, geste\)/)
  assert.match(partie, /gesteAccepte\(changement\.current, performance\.now\(\)\)/)
  // Le bilan et les écrans des jeux, à la demande ; jamais `React.lazy`.
  assert.match(partie, /pari: aLaDemande\(\(\) => import\('\.\/jeux\/Pari'\)/)
  assert.match(partie, /eclair: aLaDemande\(\(\) => import\('\.\/jeux\/Eclair'\)/)
  assert.match(partie, /const LE_BILAN = aLaDemande\(\(\) => import\('\.\/Bilan'\)\)/)
  assert.doesNotMatch(partie, /\blazy\(/)
  // Les écrans des jeux ne téléchargent pas les règles qui jugent : des types seulement.
  for (const jeu of ['Pari', 'Eclair']) {
    const chemin = importsStatiques(path.join(client, `views/cabinet/jeux/${jeu}.tsx`))
    for (const f of ['shared/cabinet/jeux/pari.ts', 'shared/cabinet/jeux/eclair.ts', 'shared/cabinet/partie.ts', 'shared/cabinet/jeux/index.ts']) {
      assert.ok(!chemin.has(path.resolve(client, '../..', f)), `${f} ne part pas avec l’écran ${jeu}`)
    }
  }
  // Aucun champ ne prend le focus d'office : le clavier pousserait le bouton hors de l'écran.
  for (const f of ['views/cabinet/Partie.tsx', 'views/cabinet/Annonce.tsx', 'views/cabinet/Bilan.tsx', 'views/cabinet/jeux/Pari.tsx', 'views/cabinet/jeux/Eclair.tsx']) {
    assert.doesNotMatch(source(f), /autoFocus/, f)
  }
})
