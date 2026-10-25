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
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { inscrireProfil } from './banc'
import {
  aLaMain,
  bancDuCabinet,
  commencer,
  detailDe,
  fermerLesMagasins,
  filetDe,
  friseDe,
  jouer,
  jouerUnDetail,
  jouerUnEclair,
  jouerUneFrise,
  jouerUnFilet,
  jouerUnMot,
  jouerUnPari,
  laPage,
  lire,
  motDe,
  ok,
  ouvrir,
  pariDe,
  poster,
  unPariParfait,
  type BancDuCabinet,
} from './cabinet-banc'
import { importsStatiques } from './chemin-des-imports'
import {
  CHASSES_PAR_JOUR,
  ERREURS_D_UN_OUBLI,
  ESSAIS_DU_MOT,
  ETOILES_AU_CADRAGE,
  ETOILES_D_UNE_PARTIE,
  ETOILES_DU_FILET,
  GRACE_D_UNE_MANCHE_MS,
  JOURS_DU_SCARABEE,
  LIBRES_QUI_PAIENT,
  PRIX_D_UNE_DORURE,
  PRIX_D_UNE_OEUVRE,
  SEUILS_DES_RARETES,
} from '../../shared/cabinet/bareme'
import { QUESTION_DU_TABLEAU, adresseDUnCadrage, type DetailMontre, type DetailRevele } from '../../shared/cabinet/jeux/detail'
import { TAILLES_DU_FILET, demiLargeur, milieuDeLaPiste, type FiletMontre, type FiletRevele, type TailleDuFilet } from '../../shared/cabinet/jeux/filet'
import { etatDesTouches, type MotMontre, type MotRevele } from '../../shared/cabinet/jeux/mot'
import type { FriseMontree, FriseRevelee } from '../../shared/cabinet/jeux/frise'
import { anneeDite } from '../../shared/frise'
import { CLES_DES_JEUX, JEUX, MOTS_DU_PARI } from '../../shared/cabinet/jeux/regle'
import { JEU_PAS_LIVRE, PLUS_DE_CHASSE, laPartieAttend } from '../../shared/cabinet/musee'
import { JEU_DE_L_OEUVRE, OEUVRES, OEUVRES_DE_DEPART, RARETES, oeuvresDeLaSalle } from '../../shared/cabinet/oeuvres'
import { JEUX_PRETS } from '../../shared/cabinet/ouverture'
import { PLUS_DE_PAUSE } from '../../shared/cabinet/partie'
import { POUVOIRS, ceQueFaitLaCarte, forceDite } from '../../shared/cabinet/pouvoirs'
import { GARDIENS, GARDIENS_DES_SALLES, SALLES } from '../../shared/cabinet/salles'
import type { Cartel, PageDuCabinet, ReveilDesGardiens, SalleVue, VueDeLaPartie } from '../../shared/cabinet/vues'
import { COMPAGNON_DE_L_EXPEDITION, compagnon as leCompagnon } from '../../shared/compagnons'
import { DEPART, donneesDeDepart } from '../../shared/depart'
import { parseRoute } from '../../shared/adresses'
import { GLOSSAIRE } from '../../shared/glossaire'
import { legendaire } from '../../shared/legendaires'
import { pageDeLAdresse } from '../../shared/maintenance'
import { espacesFines, formatNumber } from '../../shared/typographie'
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

/**
 * Ce qu'on lit d'un rendu : son texte, sans balises, les espaces insécables en espaces — et le gluon de l'inversion effacé : posé
 * par `espacesFines` dans « cache-t-il » (U+2060, règle `css.md`) et changé en espace, il s'y lisait « cache -t -il », et un
 * intitulé à inversion ne se retrouvait plus à l'écran.
 */
const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/\u2060/g, '')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s+/g, ' ')

/**
 * Les mots de l'écran (règle `cabinet.md`) : « œuvre », « carte-bonus »,
 * « carte de France », jamais « carte » seule — l'Expédition a dû rebaptiser
 * la sienne « le plan » —, et ni « badge » ni « médaille », que le lexique
 * des récompenses a remplacés (règle `recompenses.md`). Le contenu tiré n'est
 * pas un mot de l'écran : « Les Joueurs de cartes » est le titre d'un tableau
 * (`contenu`, ses textes ôtés avant de lire).
 */
function sansJargon(html: string, ou: string, contenu: readonly string[] = []) {
  const t = contenu.reduce((s, c) => s.split(c.replace(/'/g, '’')).join(' '), texte(html))
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
  // Puis Hugo, dont chaque écran de partie se relit (section 14), et Noé, au Détail et à la Frise (section 15) ; Inès, au Mot mystère
  // et au Filet, et Ilse, dont la dorure réveille un gardien (section 17).
  await lesPartiesDeHugo()
  await lesTableauxEtLesFrisesDeNoe()
  await lesMotsEtLesFiletsDInes()
  await leReveilDIlse()
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
  const jeux = readdirSync(path.join(client, 'views/cabinet/jeux')).map(f => `views/cabinet/jeux/${f}`)
  assert.ok(jeux.length >= 4, jeux.join(', '))
  // Ni l'annonce d'un gardien qui s'éveille, rare, et ce qu'elle fait venir (`Ouverts.tsx`) : elle aussi vient à la demande.
  for (const f of ['views/RencontresDExpedition.tsx', 'views/ExpeditionApp.tsx', 'socket.ts', ...jeux, 'views/cabinet/Bilan.tsx', 'views/cabinet/Reveil.tsx', 'components/Gains.tsx', 'components/Ouverts.tsx', 'components/TableauEntier.tsx']) {
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
  // Un jeu pas encore livré le dit — l'œuvre de la salle qui s'y trouve, lue de la règle : les jeux s'ouvrent un à un.
  const bientot = erudit.oeuvres.find(o => !o.possedee && !JEUX_PRETS.includes(JEU_DE_L_OEUVRE[o.cle]))
  assert.ok(bientot, 'une œuvre de l’Érudit à un jeu pas encore livré')
  assert.ok(!JEUX_PRETS.includes(JEU_DE_L_OEUVRE[bientot.cle]))
  const cadre = new RegExp(`<a class="cab-oeuvre[^"]*" href="#oeuvre-${bientot.cle}"[^>]*>.*?</a>`).exec(html)?.[0] ?? ''
  assert.match(texte(cadre), new RegExp(`${JEUX[JEU_DE_L_OEUVRE[bientot.cle]].a} .*bientôt`))
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
  // Un jeu pas encore livré : la chasse attend — une œuvre qui manque, à un jeu que la règle ne livre pas encore.
  const aVenir = page.salles.flatMap(s => s.oeuvres).find(o => !o.possedee && !JEUX_PRETS.includes(JEU_DE_L_OEUVRE[o.cle]))
  assert.ok(aVenir, 'une œuvre qui manque, à un jeu pas encore livré')
  assert.match(texte(await lOeuvre(aVenir.cle)), new RegExp(`Elle se trouve ${JEUX[JEU_DE_L_OEUVRE[aVenir.cle]].a} .*${JEU_PAS_LIVRE}`))
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
  // Seules les cases à jouer se jouent : la faite n'a plus de bouton.
  const aJouerToutes = page.visite.cases.filter(c => !c.faite && !c.bientot)
  assert.ok(aJouerToutes.length < page.visite.cases.length)
  assert.equal([...html.matchAll(/>Jouer<\/button>/g)].length, aJouerToutes.length)
  // Changer de jeu, quand la règle le permet — un jeu livré que la visite n'a pas — ; sinon rien à toucher.
  const unAutreJeu = JEUX_PRETS.length > page.visite.cases.length
  assert.equal(page.visite.echange.possible, unAutreJeu, `${JEUX_PRETS.length} jeux livrés, ${page.visite.cases.length} cases`)
  assert.equal([...html.matchAll(/>Changer de jeu<\/button>/g)].length, unAutreJeu ? aJouerToutes.length : 0)
  const echange = await rendu('views/cabinet/Visite', 'Visite', { page: { ...page, visite: { ...page.visite, echange: { possible: true } } }, busy: false, onJouer: rien, onEchanger: rien })
  assert.equal([...echange.matchAll(/Changer de jeu/g)].length, aJouerToutes.length, 'sur chaque case pas jouée')
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
/**
 * Un nombre dit tel que `texte()` le lit — par `texte()` même : ses espaces insécables y deviennent des espaces. Cherché tel que
 * `formatNumber` l'écrit, « 16 000 km » ne se trouvait jamais — et la piste tirée au hasard ne passe les dix mille qu'une fois
 * sur deux. Une seconde copie de la lecture, ses caractères invisibles écrits en clair, ne se relisait pas à l'œil.
 */
const enTexte = (s: string) => echapper(texte(s))

/** Les écrans des jeux, tels que la page les charge à la demande. */
async function ecrans() {
  const pari = (await import(url('views/cabinet/jeux/Pari.tsx'))).PARI
  const eclair = (await import(url('views/cabinet/jeux/Eclair.tsx'))).ECLAIR
  const detail = (await import(url('views/cabinet/jeux/Detail.tsx'))).DETAIL
  const frise = (await import(url('views/cabinet/jeux/Frise.tsx'))).FRISE
  const mot = (await import(url('views/cabinet/jeux/MotMystere.tsx'))).MOT
  const filet = (await import(url('views/cabinet/jeux/Filet.tsx'))).FILET
  return { pari, eclair, detail, frise, mot, filet } as Record<
    string,
    {
      localDe: (m: unknown) => unknown
      cleDe: (m: unknown) => string
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
    gardeDeLEcran: () => true,
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
  assert.match(partie, /const sousLeDoigt = sousLeDoigtDe\(vue, pret, valeur\)/)
  assert.match(partie, /changement\.current = performance\.now\(\)\s*\}, \[cleDEcran, sousLeDoigt\]\)/)
})

test('chaque vue que le serveur accepte relance la demi-seconde de garde : Éclairer, « Changer », « Reculer » — un double toucher sur la carte-bonus n’en joue pas deux usages', async () => {
  const e = await ecrans()
  const { sousLeDoigtDe } = await import(url('views/cabinet/Partie.tsx'))
  const { gesteAccepte } = await import('../../shared/console')
  const cle = (v: VueDeLaPartie) => sousLeDoigtDe(v, e[v.jeu], v.enCours ? e[v.jeu].localDe(v.enCours) : null)
  // Le même écran — la même phase, la même manche, la même étape —, mais pas ce qui est sous le doigt : un titre effacé, un autre
  // tableau au même cadrage, le tableau élargi, une année dévoilée, une réponse effacée, une affirmation soufflée.
  for (const [avant, apres, quoi] of [
    [vues.detail, vues.detailEclaire, 'Éclairer au Détail'],
    [vues.detailEclaire, vues.detailRecule, '« Reculer »'],
    [vues.detailEchange, vues.detailChange, '« Changer » au Détail'],
    [vues.frise, vues.friseEclairee, 'Éclairer à la Frise'],
    [vues.pari, vues.eclaire, 'Éclairer au Pari'],
    [vues.eclair, vues.souffle, 'Éclairer à l’Éclair'],
  ] as const) {
    assert.deepEqual([apres.phase, apres.manche], [avant.phase, avant.manche], quoi)
    assert.notEqual(cle(apres), cle(avant), quoi)
  }
  // Ce que fait le cadre : Éclairer touché, sa réponse revenue 150 ms plus tard — un titre effacé, Éclairer encore là d'une carte de
  // force 2 —, puis le second toucher du double, 250 ms après le premier : il tombe dans la garde.
  let changement: number | null = 0
  const t0 = 60_000
  assert.ok(gesteAccepte(changement, t0))
  if (cle(vues.detailEclaire) !== cle(vues.detail)) changement = t0 + 150
  assert.equal(gesteAccepte(changement, t0 + 250), false)
  // Une vue qui n'a rien changé — le même rang, une relecture — ne la relance pas.
  assert.equal(cle({ ...vues.detail, maintenant: vues.detail.maintenant + 1000 }), cle(vues.detail))
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

// ── 15. Le Détail et la Frise à l'écran ───────────────────────────────────
//
// Noé joue par les vraies routes, Coup d'œil emporté : un Détail — éclairé, un pas en arrière, un mauvais titre ; puis jusqu'au
// tableau entier ; puis reconnu d'emblée —, une Frise — un nouveau venu daté, deux posés à rebours et un laissé de côté ; puis sans
// faute deux fois —, et chacun avec Échange ; enfin un Détail laissé au temps. Chaque écran se rend sur la vue même que le serveur
// lui a rendue.

/** Le témoin de Noé : les images du Détail se demandent avec lui. */
let noe: string

/** Joué à la fin du `before` du fichier, après Hugo : le même banc, un autre profil. */
async function lesTableauxEtLesFrisesDeNoe() {
  noe = await inscrireProfil(b.banc.url, 'noe', 'Noé')
  let d = (vues.detail = ok(await commencer(b, noe, { origine: 'libre', jeu: 'detail', carte: 'coup-d-oeil' }), 'le Détail'))
  d = vues.detailEclaire = ok(await jouer(b, noe, d, { quoi: 'eclairer', manche: 0 }), 'éclairer le Détail')
  d = vues.detailRecule = ok(await jouer(b, noe, d, { quoi: 'reculer', manche: 0 }), 'reculer')
  // Un mauvais titre qu'Éclairer n'a pas effacé : la page ne laisse pas toucher les autres.
  const t = detailDe(b, d.id, d.tirage!)
  const faux = (d.enCours as DetailMontre).titres.findIndex((x, i) => i !== t.bonne && !x.efface)
  d = vues.detailRate = ok(await jouer(b, noe, d, { quoi: 'repondre', manche: 0, reponse: { detail: { titre: faux } } }), 'un mauvais titre')
  d = await ouvrir(b, noe, d, 1)
  for (let i = 1; i < ETOILES_AU_CADRAGE.length; i++) d = ok(await jouer(b, noe, d, { quoi: 'reculer', manche: 1 }), `reculer ${i}`)
  vues.detailEntier = d
  d = vues.detailReconnu = await jouerUnDetail(b, noe, d, 1)
  d = await ouvrir(b, noe, d, 2)
  vues.detailFini = await jouerUnDetail(b, noe, d, 2)
  // Échange emporté : « Changer » joue la rechange du plan, et l'adresse de son image le dit.
  const c = (vues.detailEchange = ok(await commencer(b, noe, { origine: 'libre', jeu: 'detail', carte: 'echange' }), 'le Détail et l’Échange'))
  vues.detailChange = ok(await jouer(b, noe, c, { quoi: 'changer', manche: 0 }), 'changer')
  vues.detailQuitte = ok(await jouer(b, noe, vues.detailChange, { quoi: 'quitter' }), 'quitter le Détail')

  let f = (vues.frise = ok(await commencer(b, noe, { origine: 'libre', jeu: 'frise', carte: 'coup-d-oeil' }), 'la Frise'))
  f = vues.friseEclairee = ok(await jouer(b, noe, f, { quoi: 'eclairer', manche: 0 }), 'éclairer la Frise')
  // Deux nouveaux venus posés à rebours — le plus récent en haut —, le troisième laissé de côté.
  const vague = friseDe(b, f.id, 0).vagues[0]
  const [ancien, recent] = [0, 1].sort((x, y) => vague[x] - vague[y])
  f = vues.friseRatee = ok(await jouer(b, noe, f, { quoi: 'repondre', manche: 0, reponse: { frise: { ordre: [recent, ancien] } } }), 'la Frise à rebours')
  f = vues.frise2 = await ouvrir(b, noe, f, 1)
  f = vues.friseJuste = await jouerUneFrise(b, noe, f, 1)
  f = await ouvrir(b, noe, f, 2)
  vues.friseFinie = await jouerUneFrise(b, noe, f, 2)
  vues.friseEchange = ok(await commencer(b, noe, { origine: 'libre', jeu: 'frise', carte: 'echange' }), 'la Frise et l’Échange')
  ok(await jouer(b, noe, vues.friseEchange, { quoi: 'quitter' }), 'quitter la Frise')

  // Un Détail laissé au temps, au premier cadrage : la page envoie sa réponse vide à l'échéance, passée la grâce. En dernier — l'heure
  // du banc avance d'une manche.
  const x = ok(await commencer(b, noe, { origine: 'libre', jeu: 'detail', carte: null }), 'le Détail laissé au temps')
  b.horloge.t = x.chrono!.echeance + GRACE_D_UNE_MANCHE_MS + 1
  vues.detailExpire = ok(await jouer(b, noe, x, { quoi: 'repondre', manche: 0, auto: true }), 'l’échéance')
  ok(await jouer(b, noe, vues.detailExpire, { quoi: 'quitter' }), 'quitter le Détail laissé au temps')
}

/** Ce que la page tient d'une manche de la Frise : les jetons posés, du plus ancien au plus récent selon lui, et le nouveau venu touché. */
type LocalDeLaFrise = { ordre: number[]; choisi: number | null }

/**
 * Les textes tirés qu'une vue porte, champ par champ — les titres et les peintres des tableaux, le thème et les libellés d'une
 * frise, une anecdote venue de la base — : du contenu, pas des mots de l'écran. Rien d'autre : le titre d'une révélation
 * (« C’était… », « 2 erreurs, 1 pas posé »), la clé du jeu, l'anecdote qu'un tableau sans question compose (« …, peint par … en
 * … ») restent sous la garde du jargon — cueillis en bloc, ils y échappaient.
 */
function contenuDe(v: VueDeLaPartie): string[] {
  const textes: string[] = []
  const corps = [
    { c: v.enCours, tirage: v.tirage },
    { c: v.revelation?.corps, tirage: v.revelation?.tirage },
    ...v.manches.map(m => ({ c: m.revelation?.corps, tirage: m.revelation?.tirage })),
  ] as { c?: DetailMontre | DetailRevele | FriseMontree | FriseRevelee; tirage?: number }[]
  for (const { c, tirage } of corps) {
    if (c?.jeu === 'detail') {
      for (const x of c.titres) textes.push(x.titre, x.peintre)
      if ('tableau' in c) {
        textes.push(c.tableau.titre, c.tableau.peintre, ...(c.repondu ? [c.repondu] : []))
        // L'anecdote de sa question de la base, quand le tirage en porte une : sinon, la phrase est du serveur.
        const anecdote = tirage === undefined ? null : detailDe(b, v.id, tirage).anecdote
        if (anecdote) textes.push(anecdote)
      }
    } else if (c?.jeu === 'frise') {
      textes.push(c.theme)
      if ('rangee' in c) textes.push(...c.rangee.map(e => e.libelle), ...(c.savais ? [c.savais] : []))
      else textes.push(...c.ancres.map(e => e.libelle), ...c.nouveaux.map(e => e.libelle))
    }
  }
  // Les plus longs d'abord : un titre ôté avant la phrase qui le contient la laisserait en morceaux.
  return textes.sort((a, c) => c.length - a.length)
}

/** Les sources d'images d'un rendu, telles que le navigateur les demandera. */
const images = (html: string) => [...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'))

test('une manche du Détail : le cadrage atteint à l’adresse de son tirage, ce que vaut la réponse, « Reculer d’un pas », les quatre titres — jamais le tableau', async () => {
  const v = vues.detail
  const m = v.enCours as DetailMontre
  assert.equal(m.jeu, 'detail')
  const html = await laPartie(v)
  const t = texte(html)
  // L'image du cadrage atteint, à l'adresse du tirage — jamais la manche, ni l'identifiant du tableau.
  assert.deepEqual(images(html), [adresseDUnCadrage(v.id, v.tirage!, 1)])
  const plan = detailDe(b, v.id, v.tirage!)
  assert.doesNotMatch(html, new RegExp(plan.tableau.qid), 'l’identifiant du tableau ne part pas')
  assert.doesNotMatch(html, new RegExp(`/detail/${v.tirage}/${ETOILES_AU_CADRAGE.length}`), 'le tableau entier ne se demande pas d’avance')
  // Son texte à l'oreille ne le nomme pas : un détail, et où il en est.
  const img = /<img[^>]*>/.exec(html)![0]
  assert.match(img, new RegExp(`alt="Un détail du tableau, cadrage 1 sur ${ETOILES_AU_CADRAGE.length}"`))
  // Où il en est, en pas : la jauge du tableau qui s'élargit.
  assert.match(html, new RegExp(`role="progressbar" aria-label="Le tableau, pas à pas" aria-valuemin="1" aria-valuemax="${ETOILES_AU_CADRAGE.length}" aria-valuenow="1"`))
  assert.match(t, new RegExp(echapper(QUESTION_DU_TABLEAU)))
  assert.match(t, /Ta réponse vaut/)
  assert.match(html, new RegExp(`aria-label="${ETOILES_AU_CADRAGE[0]} étoiles sur 3"`))
  assert.match(html, /<button type="button" class="btn cab-reculer">.*Reculer d’un pas<\/button>/)
  // Les quatre titres, chacun son peintre, dans l'ordre figé au départ ; rien ne dit lequel est le bon.
  assert.equal([...html.matchAll(/<button type="button" class="ans-btn cab-titre">/g)].length, m.titres.length)
  for (const x of m.titres) {
    assert.match(t, new RegExp(lu(x.titre)))
    assert.match(t, new RegExp(lu(x.peintre)))
    assert.doesNotMatch(img, new RegExp(lu(x.titre)))
  }
  assert.doesNotMatch(html, /(bonne|correct|juste)[\w-]*="|cab-juste|class="corrige/i)
  // La carte-bonus, Éclairer, sous le pouce.
  assert.match(html, /<div class="cab-pied-partie"><button type="button" class="btn btn-block cab-pouvoir">/)
  sansJargon(html, 'une manche du Détail', contenuDe(v))
})

test('le Détail qui s’élargit : un pas en arrière, son cadrage et ce que vaut la réponse ; au tableau entier, « Reculer » s’éteint ; un titre effacé ; la rechange de « Changer » à son adresse', async () => {
  const { detail } = await ecrans()
  // Un pas en arrière : le cadrage suivant, à la même adresse de tirage, et ce que la réponse vaut maintenant.
  const recule = await laPartie(vues.detailRecule)
  const m = vues.detailRecule.enCours as DetailMontre
  assert.equal(m.cadrage, 2)
  assert.deepEqual(images(recule), [adresseDUnCadrage(vues.detailRecule.id, vues.detailRecule.tirage!, 2)])
  assert.match(recule, /aria-valuenow="2"/)
  assert.match(recule, new RegExp(`aria-label="${m.vaut} étoiles? sur 3"`))
  // Le cadrage change sous le doigt sans que l'écran change : la demi-seconde de garde repart — un double toucher sur « Reculer »
  // coûtait deux étoiles. C'est une vue neuve : le cadre la relance (`sousLeDoigtDe`), le Détail n'a rien à y ajouter. Le contenu
  // reste le même tableau.
  const { sousLeDoigtDe } = await import(url('views/cabinet/Partie.tsx'))
  assert.notEqual(sousLeDoigtDe(vues.detailEclaire, detail, null), sousLeDoigtDe(vues.detailRecule, detail, null))
  assert.equal(detail.sousEcranDe, undefined)
  assert.equal(detail.cleDe(vues.detail.enCours), detail.cleDe(m))
  // Éclairé : un mauvais titre effacé — en sourdine, barré, dit à l'oreille.
  const eclaire = await laPartie(vues.detailEclaire)
  assert.equal([...eclaire.matchAll(/class="ans-btn cab-titre cab-effacee" aria-disabled="true"/g)].length, 1)
  assert.match(eclaire, /<span class="sr-only">, effacé<\/span>/)
  // Au tableau entier : plus rien à reculer, et la réponse ne vaut plus d'étoile — dit en mots, pas en trois étoiles vides.
  const entier = await laPartie(vues.detailEntier)
  assert.equal((vues.detailEntier.enCours as DetailMontre).peutReculer, false)
  assert.deepEqual(images(entier), [adresseDUnCadrage(vues.detailEntier.id, vues.detailEntier.tirage!, ETOILES_AU_CADRAGE.length)])
  assert.match(entier, /<img[^>]*alt="Le tableau entier"/)
  assert.match(entier, /<button type="button" class="btn cab-reculer" aria-disabled="true">/)
  assert.match(texte(entier), /Ta réponse ne vaut plus d’étoile/)
  // « Changer » : la rechange, à l'indice de son tirage — l'image d'avant ne revient pas du cache —, un autre contenu.
  const change = vues.detailChange
  assert.equal(change.tirage, 3)
  assert.deepEqual(images(await laPartie(change)), [adresseDUnCadrage(change.id, 3, 1)])
  assert.notEqual(detail.cleDe(change.enCours), detail.cleDe(vues.detail.enCours))
  // La page ne tient rien d'une manche du Détail : à l'échéance, la réponse part vide, et la manche se juge sur ce que le serveur sait.
  assert.equal(detail.localDe(m), null)
  assert.equal(detail.aLEcheance(m, null), undefined)
  sansJargon(entier, 'le tableau entier', contenuDe(vues.detailEntier))
})

test('la révélation du Détail : le tableau entier à l’adresse de son tirage, son titre, son peintre, son année, et ce qu’il avait répondu', async () => {
  // Raté : « C’était… », le tableau entier, et sa réponse barrée.
  const v = vues.detailRate
  const r = v.revelation!
  const corps = r.corps as DetailRevele
  assert.equal(corps.reconnu, false)
  const html = await laPartie(v)
  const t = texte(html)
  assert.match(html, /class="card result-banner result-ko"/)
  assert.match(t, /C’était…/)
  assert.deepEqual(images(html), [adresseDUnCadrage(v.id, r.tirage!, ETOILES_AU_CADRAGE.length)])
  assert.match(t, new RegExp(`« ${lu(corps.tableau.titre)} »`))
  assert.match(t, new RegExp(`${lu(corps.tableau.peintre)}, ${corps.tableau.annee}`))
  assert.match(html, /class="corrige-reponse corrige-sienne"/)
  assert.match(t, new RegExp(`Ta réponse ${lu(corps.repondu!)}`))
  // Il en était à un pas en arrière : la révélation le dit.
  assert.match(t, /Après 1 pas en arrière/)
  // Un tableau n'est pas une question de la base : rien à signaler ; son anecdote, si.
  assert.doesNotMatch(t, /Signaler/)
  assert.match(t, /Le savais-tu \?/)
  // Le nom d'abord, puis le tableau : sous lui, il tombait sous le pli, derrière « Manche suivante ».
  assert.match(html, /<figure class="tableau-entier">/)
  assert.ok(t.indexOf(corps.tableau.titre.replace(/'/g, '’')) < t.indexOf('Ta réponse'))
  // Reconnu au tableau entier : le bon titre, mais plus une étoile — la pièce est fausse au journal (`justeDeLaPiece`), le bandeau
  // sans fête — ; rien de barré.
  const reconnu = await laPartie(vues.detailReconnu)
  assert.equal(vues.detailReconnu.manches[1].naturel, ETOILES_AU_CADRAGE.at(-1))
  assert.match(texte(reconnu), /Reconnu/)
  // Le bandeau le dit : « Reconnu » seul, sans étoile, se lisait comme une victoire.
  assert.match(texte(reconnu), /Reconnu, au tableau entier/)
  assert.doesNotMatch(texte(await laPartie(vues.detailFini)), /tableau entier/)
  assert.match(reconnu, /class="card result-banner result-ko"/)
  assert.doesNotMatch(reconnu, /corrige-sienne/)
  assert.match(texte(reconnu), new RegExp(`Après ${ETOILES_AU_CADRAGE.length - 1} pas en arrière`))
  // Reconnu d'emblée : au premier coup d'œil.
  assert.match(texte(await laPartie(vues.detailFini)), /Au premier coup d’œil/)
  // Une révélation écrite à la main, sans tirage : rien à demander, son titre quand même.
  const { DETAIL } = await import(url('views/cabinet/jeux/Detail.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  const sansTirage = renderToStaticMarkup(React.createElement(DETAIL.Revelation, { corps, partie: v.id }))
  assert.deepEqual(images(sansTirage), [])
  assert.match(texte(sansTirage), new RegExp(lu(corps.tableau.titre)))
  sansJargon(html, 'la révélation du Détail', contenuDe(v))
})

test('« Mes réponses » d’un Détail : chaque manche son tableau entier, à l’indice de son tirage', async () => {
  const v = vues.detailFini
  assert.equal(v.phase, 'finie')
  const ecran = (await ecrans()).detail
  const html = await rendu('views/cabinet/Bilan', 'MesReponses', { vue: v, ecran, onFermer: rien })
  const tirages = v.manches.map(m => m.revelation!.tirage!)
  assert.deepEqual(images(html), tirages.map(k => adresseDUnCadrage(v.id, k, ETOILES_AU_CADRAGE.length)))
  assert.equal([...html.matchAll(/class="cab-reponses-manche"/g)].length, 3)
})

test('la révélation d’un Détail sans réponse — le temps écoulé, la manche quittée — ne dit pas où il en était : il n’avait rien répondu', async () => {
  // Le temps écoulé au premier cadrage : « Au premier coup d’œil » s'y lisait comme une réponse donnée d'emblée.
  const v = vues.detailExpire
  const corps = v.revelation!.corps as DetailRevele
  assert.deepEqual([v.manches[0].fin, corps.cadrage, corps.titres.some(x => x.choisi)], ['expiree', 1, false])
  const t = texte(await laPartie(v))
  assert.match(t, /Temps écoulé/)
  assert.doesNotMatch(t, /coup d’œil|pas en arrière/)
  // Le tableau quand même, et son nom.
  assert.match(t, new RegExp(`« ${lu(corps.tableau.titre)} »`))
  // Quittée : « Mes réponses » la montre, sans dire non plus où il en était.
  const q = vues.detailQuitte
  assert.equal(q.manches[0].fin, 'quittee')
  assert.ok(q.manches[0].revelation, 'la manche quittée se révèle')
  const reponses = texte(await rendu('views/cabinet/Bilan', 'MesReponses', { vue: q, ecran: (await ecrans()).detail, onFermer: rien }))
  assert.match(reponses, new RegExp(lu((q.manches[0].revelation!.corps as DetailRevele).tableau.titre)))
  assert.doesNotMatch(reponses, /coup d’œil|pas en arrière/)
})

test('un cadrage perdu en route se redemande à une adresse neuve, un peu plus tard chaque fois, puis la page attend — et la route ignore l’essai', async () => {
  type Essai = { n: number; dansMs: number }
  const { adresseDeLEssai, essaiApresLEchec, ESSAIS_D_UNE_IMAGE, ATTENTE_D_UN_ESSAI_MS } = (await import(url('views/cabinet/jeux/Detail.tsx'))) as {
    adresseDeLEssai: (adresse: string, n: number) => string
    essaiApresLEchec: (rate: { adresse: string | null; n: number } | null, adresse: string | null) => Essai | null
    ESSAIS_D_UNE_IMAGE: number
    ATTENTE_D_UN_ESSAI_MS: number
  }
  const v = vues.detailFini
  const premier = adresseDUnCadrage(v.id, v.tirage!, 1)
  const second = adresseDUnCadrage(v.id, v.tirage!, 2)
  // La première demande telle quelle ; chaque essai, une adresse neuve : la même `src` ne relance pas une balise d'image.
  assert.equal(adresseDeLEssai(premier, 0), premier)
  assert.equal(adresseDeLEssai(premier, 2), `${premier}?essai=2`)
  // Chaque échec, l'essai suivant, n fois l'attente ; le dernier raté, plus rien.
  const essais: Essai[] = []
  for (let rate: { adresse: string; n: number } | null = { adresse: premier, n: 0 }; rate; ) {
    const suivant = essaiApresLEchec(rate, premier)
    if (suivant) essais.push(suivant)
    rate = suivant && { adresse: premier, n: suivant.n }
  }
  assert.deepEqual(
    essais,
    Array.from({ length: ESSAIS_D_UNE_IMAGE }, (_, i) => ({ n: i + 1, dansMs: (i + 1) * ATTENTE_D_UN_ESSAI_MS })),
  )
  // Seul l'échec de l'adresse d'à présent se redemande : un pas de plus entre-temps en a posé une autre, qui n'a rien raté.
  assert.equal(essaiApresLEchec({ adresse: premier, n: 0 }, second), null)
  assert.equal(essaiApresLEchec(null, premier), null)
  assert.equal(essaiApresLEchec({ adresse: premier, n: 0 }, null), null)
  // Par le vrai serveur : l'essai sert la même image, et le téléphone la garde à son adresse à elle.
  const lireLImage = async (adresse: string) => {
    const r = await fetch(`${b.banc.url}${adresse}`, { headers: { Cookie: noe, 'X-Requested-With': 'quizz' } })
    return { status: r.status, type: r.headers.get('content-type') ?? '', octets: Buffer.from(await r.arrayBuffer()) }
  }
  const tel = await lireLImage(premier)
  const essai = await lireLImage(adresseDeLEssai(premier, 3))
  assert.deepEqual([tel.status, essai.status], [200, 200])
  assert.match(essai.type, /^image\//)
  assert.ok(essai.octets.equals(tel.octets), 'la même image')
  // Une seule balise d'image par tableau, gardée d'un cadrage à l'autre ; un autre tableau, une autre (`key`).
  const s = source('views/cabinet/jeux/Detail.tsx')
  assert.equal([...s.matchAll(/<img /g)].length, 1)
  assert.match(s, /<img key=\{tirage\} src=\{src\}[^>]*onError=\{rate\} \/>/)
  assert.match(s, /const suivant = essaiApresLEchec\(rate, adresse\)/)
})

test('une manche de la Frise : « ↑ Plus ancien » et « ↓ Plus récent », les nouveaux venus à poser sans leur année, « Valider la frise » qui attend — et ce que coûte un événement laissé de côté', async () => {
  const { frise } = await ecrans()
  const v = vues.frise
  const m = v.enCours as FriseMontree
  assert.deepEqual([m.ancres.length, m.nouveaux.length], [0, 3])
  const html = await laPartie(v)
  const t = texte(html)
  assert.match(t, new RegExp(lu(m.theme)))
  assert.match(t, /↑ Plus ancien .*↓ Plus récent/)
  assert.match(html, /<ol class="cab-frise" aria-label="La frise, du plus ancien au plus récent">/)
  assert.match(t, /Touche un événement à poser, puis l’endroit où il va/)
  // Dans l'ordre où l'on joue : ce qui reste à poser, et ce qu'un oubli coûtera ; la frise ; « Valider la frise ».
  const ordre = ['À poser', '↑ Plus ancien', '↓ Plus récent', 'Valider la frise'].map(x => t.indexOf(x))
  assert.ok(ordre.every(i => i >= 0), ordre.join(','))
  assert.deepEqual(ordre, [...ordre].sort((x, y) => x - y))
  // Les nouveaux venus : chacun un bouton à état, aucun touché ; jamais leur année.
  assert.equal([...html.matchAll(/<button type="button" class="cab-a-poser" aria-pressed="false">/g)].length, 3)
  for (const n of m.nouveaux) assert.match(t, new RegExp(lu(n.libelle)))
  for (const e of friseDe(b, v.id, 0).evenements) assert.doesNotMatch(t, new RegExp(`(^|\\s)${echapper(anneeDite(e.annee))}(\\s|$)`), `l’année ${e.annee} ne part pas`)
  assert.match(t, new RegExp(`Laissé de côté à la fin : ${ERREURS_D_UN_OUBLI} erreurs\\.`))
  // « Valider la frise » attend que tout soit posé, et dit ce qu'il attend.
  assert.match(html, /<button type="button" class="btn btn-primary btn-big btn-block cab-valider" aria-disabled="true">Valider la frise<\/button><p class="cab-raison">Encore 3 à poser<\/p>/)
  // La carte-bonus qui sert encore reste sous le pouce.
  assert.match(html, /<div class="cab-pied-partie"><button type="button" class="btn btn-block cab-pouvoir">/)
  // Rien de touché : pas d'endroit où poser.
  assert.doesNotMatch(html, /Poser ici/)
  // Un nouveau venu touché : la frise vide offre sa seule place.
  const choisi = await laPartie(v, { local: { ordre: [], choisi: m.nouveaux[1].jeton } satisfies LocalDeLaFrise })
  assert.equal([...choisi.matchAll(/class="cab-a-poser" aria-pressed="true"/g)].length, 1)
  assert.equal([...choisi.matchAll(/>Poser ici</g)].length, 1)
  assert.match(texte(choisi), /Touche « Poser ici » à l’endroit où il va/)
  // Tous posés : « Valider » s'allume, la réserve est vide, et chacun se touche encore pour se déplacer.
  const jetons = m.nouveaux.map(n => n.jeton)
  const pose = await laPartie(v, { local: { ordre: [jetons[2], jetons[0], jetons[1]], choisi: null } satisfies LocalDeLaFrise })
  assert.match(pose, /<button type="button" class="btn btn-primary btn-big btn-block cab-valider">Valider la frise<\/button>/)
  assert.doesNotMatch(pose, /class="cab-a-poser"/)
  assert.match(texte(pose), /Tout est posé : valide, ou touche un événement pour le déplacer/)
  assert.equal([...pose.matchAll(/<button type="button" class="cab-pose" aria-pressed="false">/g)].length, 3)
  // À l'échéance, la frise telle qu'elle est — rien de posé, rien —, et ce qui n'est pas posé compte au serveur.
  assert.deepEqual(frise.localDe(m), { ordre: [], choisi: null })
  assert.deepEqual(frise.aLEcheance(m, { ordre: [jetons[2], jetons[0]], choisi: jetons[1] }), { frise: { ordre: [jetons[2], jetons[0]] } })
  assert.deepEqual(frise.aLEcheance(m, frise.localDe(m)), { frise: { ordre: [] } })
  sansJargon(html, 'une manche de la Frise', contenuDe(v))
})

test('ranger au doigt, sans glisser : toucher un événement, puis « Poser ici » ; un posé se déplace ; la demi-seconde de garde repart de ce qui bouge sous le doigt', async () => {
  const { frise } = await ecrans()
  const { gesteAccepte } = await import('../../shared/console')
  const { choisirSurLaFrise, poserIci, placesOuvertes } = (await import(url('views/cabinet/jeux/Frise.tsx'))) as {
    choisirSurLaFrise: (m: FriseMontree, l: LocalDeLaFrise, jeton: number) => LocalDeLaFrise
    poserIci: (l: LocalDeLaFrise, place: number) => LocalDeLaFrise
    placesOuvertes: (l: LocalDeLaFrise) => number[]
  }
  const m = vues.frise2.enCours as FriseMontree
  assert.deepEqual([m.ancres.length, m.nouveaux.length], [3, 2])
  const [a, z] = m.nouveaux.map(n => n.jeton)
  const depart = frise.localDe(m) as LocalDeLaFrise
  // Les ancres d'abord, dans leur ordre : elles ne bougent pas.
  assert.deepEqual(depart, { ordre: m.ancres.map(x => x.jeton), choisi: null })
  // Toucher un nouveau venu de la réserve le prend ; le toucher encore le garde : un double toucher le prenait puis le lâchait. Un
  // autre toucher en prend un autre.
  let l = choisirSurLaFrise(m, depart, a)
  assert.equal(l.choisi, a)
  assert.deepEqual(choisirSurLaFrise(m, l, a), l)
  assert.deepEqual(choisirSurLaFrise(m, l, z), { ordre: depart.ordre, choisi: z })
  // Pris dans la réserve, il peut aller partout : entre chaque événement, et aux deux bouts.
  assert.deepEqual(placesOuvertes(l), [0, 1, 2, 3])
  assert.deepEqual(placesOuvertes(depart), [])
  // « Poser ici », entre la première et la deuxième ancre : il y est, plus rien n'est touché.
  l = poserIci(l, 1)
  assert.deepEqual(l, { ordre: [0, a, 1, 2], choisi: null })
  // Sans rien de touché, « Poser ici » ne pose rien ; une ancre ne se prend pas.
  assert.deepEqual(poserIci(l, 0), l)
  assert.deepEqual(choisirSurLaFrise(m, l, 0), l)
  // Un posé touché se prend ; touché encore, il se lâche et reste où il était — on renonce à le déplacer.
  const repris = choisirSurLaFrise(m, l, a)
  assert.deepEqual(repris, { ordre: [0, a, 1, 2], choisi: a })
  assert.deepEqual(choisirSurLaFrise(m, repris, a), l)
  // Pas de place juste au-dessus ni juste au-dessous de lui : elles le laissaient où il était. Les autres le déplacent.
  assert.deepEqual(placesOuvertes(repris), [0, 3, 4])
  assert.deepEqual(poserIci(repris, 3).ordre, [0, 1, a, 2])
  // Le second, tout en bas ; puis le premier, déplacé tout en haut.
  l = poserIci(choisirSurLaFrise(m, l, z), 4)
  assert.deepEqual(l.ordre, [0, a, 1, 2, z])
  l = poserIci(choisirSurLaFrise(m, l, a), 0)
  assert.deepEqual(l, { ordre: [a, 0, 1, 2, z], choisi: null })
  // Reposé à sa place même — l'écran n'en offre pas la place, la règle le permet : rien ne bouge.
  assert.deepEqual(poserIci(choisirSurLaFrise(m, l, z), 5).ordre, l.ordre)
  // La garde repart de ce qui bouge sous le doigt sans changer l'écran : une pose — l'événement remonte là où était « Poser ici » —,
  // un posé repris — les places s'ouvrent au-dessus de lui. Un double toucher ne reprend pas l'événement remonté, ne valide pas une
  // frise qu'on rangeait. Pris dans la réserve, rien ne bouge sous lui : « Poser ici » touché aussitôt après se prend.
  const sous = frise.sousEcranDe!
  const pris = choisirSurLaFrise(m, depart, a)
  const pose = poserIci(pris, 1)
  assert.equal(sous(m, pris), sous(m, depart), 'pris dans la réserve')
  assert.notEqual(sous(m, pose), sous(m, pris), 'posé')
  assert.notEqual(sous(m, choisirSurLaFrise(m, pose, a)), sous(m, pose), 'repris sur la frise')
  // Ce que fait le cadre : la manche ouverte depuis longtemps, un événement pris, puis « Poser ici » 350 ms après — il pose ; puis un
  // second toucher 100 ms après la pose — il tombe dans la garde.
  let changement: number | null = 0
  const t0 = 60_000
  const toucherA = (avant: LocalDeLaFrise, apres: LocalDeLaFrise, t: number) => {
    if (!gesteAccepte(changement, t)) return false
    if (sous(m, avant) !== sous(m, apres)) changement = t
    return true
  }
  assert.ok(toucherA(depart, pris, t0), 'la prise')
  assert.ok(toucherA(pris, pose, t0 + 350), '« Poser ici » juste après la prise')
  assert.equal(toucherA(pose, choisirSurLaFrise(m, pose, a), t0 + 450), false, 'le second toucher d’un double sur « Poser ici »')
  // À l'écran : les ancres à leur place, leur année dite ; un posé se touche pour se déplacer ; « Poser ici » entre chaque, et
  // l'oreille sait où.
  const html = await laPartie(vues.frise2, { local: { ordre: [0, a, 1, 2], choisi: z } satisfies LocalDeLaFrise })
  const t = texte(html)
  const ordre = m.ancres.map(x => t.indexOf(x.libelle.replace(/'/g, '’')))
  assert.ok(ordre.every(i => i > 0), ordre.join(','))
  assert.deepEqual(ordre, [...ordre].sort((x, y) => x - y), 'les ancres dans l’ordre du temps')
  for (const x of m.ancres) assert.match(t, new RegExp(`${echapper(anneeDite(x.annee))} ${lu(x.libelle)}`))
  assert.equal([...html.matchAll(/<li class="cab-evenement cab-ancre">/g)].length, 3)
  assert.equal([...html.matchAll(/<button type="button" class="cab-pose" aria-pressed="false">/g)].length, 1)
  assert.equal([...html.matchAll(/>Poser ici</g)].length, 5)
  assert.match(t, new RegExp(`Poser ici , tout en haut, avant « ${lu(m.ancres[0].libelle)} »`))
  assert.match(t, new RegExp(`Poser ici , tout en bas, après « ${lu(m.ancres[2].libelle)} »`))
  // Un posé repris : ses trois places, et aucune ne le dit « entre » lui-même et son voisin.
  const deplace = await laPartie(vues.frise2, { local: { ordre: [0, a, 1, 2], choisi: a } satisfies LocalDeLaFrise })
  assert.equal([...deplace.matchAll(/<button type="button" class="cab-pose" aria-pressed="true">/g)].length, 1)
  const dites = [...deplace.matchAll(/Poser ici<span class="sr-only">([^<]*)<\/span>/g)].map(x => texte(x[1]))
  assert.equal(dites.length, 3)
  const libelleDeA = m.nouveaux.find(n => n.jeton === a)!.libelle.replace(/'/g, '’')
  for (const d of dites) assert.ok(!d.includes(libelleDeA), d)
  assert.match(dites[1], new RegExp(`entre « ${lu(m.ancres[1].libelle)} » et « ${lu(m.ancres[2].libelle)} »`))
  // Sans place à côté de lui, la consigne dit comment le laisser où il est.
  assert.match(texte(deplace), /Touche « Poser ici » où il va, ou touche-le pour le laisser\./)
  sansJargon(html, 'la frise qui grandit', contenuDe(vues.frise2))
})

test('Éclairer à la Frise : l’année d’un nouveau venu, dite à sa place — et ce que la page tenait reste', async () => {
  const { frise } = await ecrans()
  const avant = vues.frise.enCours as FriseMontree
  const apres = vues.friseEclairee.enCours as FriseMontree
  const date = apres.nouveaux.find(n => n.annee !== undefined)
  assert.ok(date, 'un nouveau venu daté')
  assert.match(texte(await laPartie(vues.friseEclairee)), new RegExp(`${echapper(anneeDite(date.annee!))} ${lu(date.libelle)}`))
  // Le contenu n'a pas changé : la frise rangée à moitié ne repart pas de zéro.
  assert.equal(frise.cleDe(apres), frise.cleDe(avant))
})

test('la révélation de la Frise : chaque événement à son année, les nouveaux venus marqués en mots — à sa place, pas à sa place, pas posé', async () => {
  const v = vues.friseRatee
  const r = v.revelation!.corps as FriseRevelee
  assert.deepEqual([r.faux, r.pasPoses], [2, 1])
  const html = await laPartie(v)
  const t = texte(html)
  assert.match(t, /2 erreurs, 1 pas posé/)
  assert.match(t, /↑ Plus ancien .*↓ Plus récent/)
  for (const e of r.rangee) assert.match(t, new RegExp(`${echapper(anneeDite(e.annee))} ${lu(e.libelle)}`))
  // Jamais la couleur seule : une marque, et ses mots.
  assert.equal([...html.matchAll(/class="cab-evenement cab-mal-place"/g)].length, 2)
  assert.equal([...html.matchAll(/class="cab-evenement cab-pas-pose"/g)].length, 1)
  assert.equal([...t.matchAll(/Pas à sa place/g)].length, 2)
  assert.equal([...t.matchAll(/Pas posé/g)].length, 1)
  // Un mal placé se lit à sa vraie année : la phrase le dit une fois, au-dessus — sous chacun, la marque prenait deux lignes.
  assert.equal([...t.matchAll(/Ceux qui n’étaient pas à leur place : les voici à leur vraie année\./g)].length, 1)
  assert.match(t, new RegExp(`Laissé de côté, un événement compte ${ERREURS_D_UN_OUBLI} erreurs\\.`))
  // Sans faute, la manche suivante : ses deux nouveaux venus à leur place, les ancres sans marque.
  const juste = await laPartie(vues.friseJuste)
  assert.match(texte(juste), /Sans faute/)
  assert.equal([...juste.matchAll(/class="cab-evenement cab-a-sa-place"/g)].length, 2)
  assert.equal([...juste.matchAll(/class="cab-evenement cab-ancre"/g)].length, 3)
  assert.doesNotMatch(texte(juste), /Laissé de côté|vraie année/)
  // La dernière : sept événements, puis « Voir le bilan ».
  assert.equal((vues.friseFinie.revelation!.corps as FriseRevelee).rangee.length, 7)
  assert.match(await laPartie(vues.friseFinie), />Voir le bilan<\/button>/)
  // Une frise n'est pas une question de la base : rien à signaler.
  assert.doesNotMatch(t, /Signaler/)
  sansJargon(html, 'la révélation de la Frise', contenuDe(v))
})

test('une carte-bonus qui ne sert pas à la Frise se pose sous « Valider la frise », sa raison dite', async () => {
  const html = await laPartie(vues.friseEchange)
  const valider = html.indexOf('Valider la frise')
  const pose = html.indexOf('<div class="cab-pied-partie cab-pied-pose">')
  assert.ok(valider > 0 && pose > valider, `${valider}, ${pose}`)
  assert.doesNotMatch(html, /<div class="cab-pied-partie">/, 'rien de collé au bas de l’écran')
  assert.match(texte(html.slice(pose)), new RegExp(`Changer ne sert pas ${echapper(JEUX.frise.a)}`))
})

test('chaque manche a sa question en titre (`.cab-question`) : le focus s’y pose quand elle s’ouvre, et le lecteur d’écran la dit', async () => {
  // « Manche suivante » touché disparaît avec la révélation : sans titre où se poser (`rendreLeFocus`), le focus tombait sur la page,
  // le lecteur d'écran ne disait rien de la manche qui s'ouvrait pendant que le chrono courait, et le Tab suivant repartait du haut.
  assert.match(source('views/cabinet/Partie.tsx'), /rendreLeFocus\(document\.querySelector\('\.cab-page'\), \['\.cab-question', 'h2', 'h1'\]\)/)
  // La première manche, ouverte par « Commencer » : c'est la page qui change d'écran, et elle cherchait un `h1`, qu'une partie n'a pas.
  assert.match(source('views/CabinetApp.tsx'), /rendreLeFocus\(document\.querySelector\('\.cab-page'\), \['\.cab-question', 'h1', 'h2'\]\)/)
  const question = (html: string) => texte(/<h2 class="[^"]*\bcab-question\b[^"]*">(.*?)<\/h2>/.exec(html)?.[1] ?? '').trim()
  for (const v of [vues.pari, vues.etape2, vues.eclair, vues.detail, vues.detailEntier, vues.frise, vues.frise2, vues.mot, vues.motMele, vues.filet, vues.filetEclaire]) {
    assert.ok(question(await laPartie(v)), `${v.jeu}, manche ${v.manche + 1}`)
  }
  // Le Détail, sa question ; la Frise, son thème — à la taille d'un surtitre : le tableau et la frise gardent la place.
  assert.equal(question(await laPartie(vues.detail)), QUESTION_DU_TABLEAU)
  assert.equal(question(await laPartie(vues.frise)), texte((vues.frise.enCours as FriseMontree).theme.replace(/'/g, '’')).trim())
  assert.match(await laPartie(vues.frise), /<h2 class="cab-question cab-surtitre">/)
})

test('les écrans du Détail et de la Frise : à la demande, sans le pli ni la lecture des gestes, sans l’heure du téléphone, sans champ qui prend le focus', () => {
  const partie = source('views/cabinet/Partie.tsx')
  assert.match(partie, /detail: aLaDemande\(\(\) => import\('\.\/jeux\/Detail'\)/)
  assert.match(partie, /frise: aLaDemande\(\(\) => import\('\.\/jeux\/Frise'\)/)
  // Le Détail lit l'adresse de ses images dans sa règle (`adresseDUnCadrage`) — elle ne se recopie pas — ; la Frise, rien de la
  // sienne : l'année dite vient de la frise de l'Expédition, ce que coûte un oubli du barème.
  for (const [jeu, regle] of [
    ['Detail', null],
    ['Frise', 'shared/cabinet/jeux/frise.ts'],
  ] as const) {
    const chemin = importsStatiques(path.join(client, `views/cabinet/jeux/${jeu}.tsx`))
    for (const f of ['shared/cabinet/partie.ts', 'shared/cabinet/jeux/index.ts', 'shared/cabinet/lecture.ts', ...(regle ? [regle] : [])]) {
      assert.ok(!chemin.has(path.resolve(client, '../..', f)), `${f} ne part pas avec l’écran ${jeu}`)
    }
    const s = source(`views/cabinet/jeux/${jeu}.tsx`)
    const code = s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    assert.doesNotMatch(code, /Date\.now\(\)/, jeu)
    assert.doesNotMatch(s, /autoFocus/, jeu)
    // Un chiffre du barème s'importe, il ne se recopie pas.
    assert.doesNotMatch(code, /\b\d erreurs?\b|★/, jeu)
  }
  assert.ok(importsStatiques(path.join(client, 'views/cabinet/jeux/Detail.tsx')).has(path.resolve(client, '../..', 'shared/cabinet/jeux/detail.ts')))
  // De la règle du Détail, qui juge, l'écran ne prend que des types, la question et l'adresse d'un cadrage : le paquet ne garde
  // qu'elles, jamais le jugement ni Éclairer.
  const deLaRegle = /import \{([^}]*)\} from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/shared\/cabinet\/jeux\/detail'/.exec(source('views/cabinet/jeux/Detail.tsx'))
  assert.ok(deLaRegle, 'Detail.tsx importe sa règle')
  const valeurs = deLaRegle[1]
    .split(',')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('type '))
  assert.deepEqual(valeurs.sort(), ['QUESTION_DU_TABLEAU', 'adresseDUnCadrage'])
  // Le cadre passe à chaque jeu où sont ses images, et « Mes réponses » aussi.
  assert.match(partie, /<ecran\.Revelation corps=\{r\.corps\} partie=\{vue\.id\} tirage=\{r\.tirage\} \/>/)
  assert.match(source('views/cabinet/Bilan.tsx'), /<ecran\.Revelation corps=\{m\.revelation\.corps\} partie=\{vue\.id\} tirage=\{m\.revelation\.tirage\} \/>/)
})

test('la feuille du Détail et de la Frise : le cadre du tableau à hauteur fixe, les années en chiffres droits, le nom du tableau avant lui', () => {
  const css = readFileSync(path.join(client, 'styles.css'), 'utf8')
  const debut = css.indexOf('/* ── Le Cabinet de curiosités')
  const section = css.slice(debut, css.indexOf('/* ── ', debut + 10)).replace(/\/\*[\s\S]*?\*\//g, '')
  // Le cadre garde sa hauteur d'un cadrage à l'autre, d'un tableau en largeur à un tableau en hauteur : rien ne saute sous le doigt.
  assert.match(section, /\.cab-detail-cadre \{[^}]*height: [^;]+;[^}]*\}/)
  assert.match(section, /\.cab-detail-cadre img \{[^}]*object-fit: contain;/)
  // Une année se lit seule, en Cormorant : ses chiffres droits.
  const annee = /(?:^|\n)\.cab-annee \{([^}]*)\}/.exec(section)
  assert.ok(annee, '.cab-annee a sa règle')
  assert.match(annee[1], /font-variant-numeric: lining-nums tabular-nums/)
  // À la révélation, le nom du tableau passe avant lui : dessous, il tombait sous le pli du 360 × 640.
  assert.match(section, /\.cab-tableau-revele \.tableau-entier \{ flex-direction: column-reverse;/)
  // La consigne de la Frise garde deux lignes d'un état à l'autre : passée à une à la prise, elle remontait la réserve de 25 px sous
  // le doigt (mesuré en 360 × 640). Et une question en surtitre reste à sa taille.
  assert.match(section, /\.cab-consigne \{ min-height: calc\(2 \* 1\.45em\);/)
  assert.match(section, /\.cab-ligne \{ line-height: 1\.45; \}/)
  assert.match(section, /\.cab-page h2\.cab-surtitre \{ font-family: inherit; font-size: inherit;/)
})

// ── 16. Ce que la poussière demande à la page ─────────────────────────────
//
// Le cartel dit ce que sa partie a fait à l'œuvre, la page oublie ses cartels quand un achat, une dorure ou une partie ont pu
// les changer, et pendant une partie, l'œuvre ne propose ni de l'acheter ni de la dorer — le serveur le refuse (`laPartieAttend`).
// Et chaque révélation a son titre, où le focus se pose.

/** Le cartel d'une partie, écrit à la main : la Leçon achetée, puis la partie qui lui a donné le sien. */
const cartelDeLaPartie = (issue?: string): Cartel =>
  ({
    oeuvre: 'lecon',
    origine: 'achat',
    doree: true,
    partie: { id: 'p', jeu: 'pari', jour: 'le 24 octobre 2026', total: 9, ...(issue && { issue }), sujet: 'Quelle est la capitale de la Lituanie ?', reponse: 'Vilnius', anecdote: null },
  }) as Cartel

test('le cartel dit ce que sa partie a fait à l’œuvre — gagnée, dorée en jouant, rejouée — ; le bilan ne promet que le cartel qu’elle prend', async () => {
  const cartel = async (issue?: string) => texte(await rendu('views/cabinet/Cartel', 'CartelDeLOeuvre', { lu: { etat: 'lu', cartel: cartelDeLaPartie(issue) } }))
  for (const [issue, titre, ligne] of [
    [undefined, 'en la gagnant', 'Gagnée'],
    ['gagnee', 'en la gagnant', 'Gagnée'],
    ['gagnee-doree', 'en la gagnant', 'Gagnée'],
    ['doree', 'en la dorant', 'Dorée'],
    ['double', 'en la rejouant', 'Rejouée'],
  ] as const) {
    const t = await cartel(issue)
    assert.match(t, new RegExp(`Ce que tu as appris ${titre} `), String(issue))
    assert.match(t, new RegExp(`${ligne} ${echapper(JEUX.pari.a)} · 9 sur 9`), String(issue))
  }
  // Achetée, puis dorée en jouant ou rejouée en visite : elle ne l'a pas gagnée, et son cartel ne le dit plus.
  for (const issue of ['doree', 'double']) assert.doesNotMatch(await cartel(issue), /gagn/i, issue)
  // Au bilan, les mêmes mots — la partie qui la dore ne dit pas « en la gagnant » —, et « Son cartel » seulement quand l'œuvre le
  // prend : gagnée, toujours ; dorée en jouant ou doublée, seulement si elle n'en avait pas — le serveur garde le premier, et la
  // vue du bilan ne dit pas lequel. Gagnée avec le sien puis dorée à 9 sur 9, le bilan disait « Son cartel » d'une manche que
  // l'œuvre rouverte ne montrait pas (`cabinet-poussiere.test.ts`, par le vrai serveur).
  const ecran = (await ecrans()).pari
  const g = vues.gagnee
  for (const [issue, titre] of [
    ['gagnee', 'Son cartel : ce que tu as appris en la gagnant'],
    ['gagnee-doree', 'Son cartel : ce que tu as appris en la gagnant'],
    ['doree', 'Ce que tu as appris en la dorant'],
    ['double', 'Ce que tu as appris en la rejouant'],
  ] as const) {
    const vue = { ...g, bilan: { ...g.bilan!, issue } } as VueDeLaPartie
    const t = texte(await rendu('views/cabinet/Bilan', 'BilanDeLaPartie', { vue, ecran, onMusee: rien }))
    assert.match(t, new RegExp(`${titre} ${lu(g.bilan!.cartel!.sujet)}`), issue)
    if (issue === 'doree' || issue === 'double') assert.doesNotMatch(t, /Son cartel/, issue)
  }
  // Les mots d'une seule source : le bilan ne les recopie pas.
  assert.doesNotMatch(source('views/cabinet/Bilan.tsx'), /en la gagnant/)
  // Le glossaire de « Comment ça marche ? » non plus ne dit pas qu'un cartel vient toujours de la partie qui l'a gagnée.
  assert.match(GLOSSAIRE.cartel.sens, /en la gagnant ou en la rejouant/)
})

/** Les boutons d'un rendu : leur texte, en sourdine ou non, et la raison qu'ils désignent à l'oreille (`aria-describedby`). */
function boutonsDe(html: string) {
  return [...html.matchAll(/<button ([^>]*)>(.*?)<\/button>/g)].map(([, attributs, dedans]) => ({
    texte: texte(dedans).trim(),
    eteint: /aria-disabled="true"/.test(attributs),
    raison: /aria-describedby="([^"]+)"/.exec(attributs)?.[1] ?? null,
  }))
}
/** Les raisons d'un rendu, par leur identifiant : ce qu'un bouton en sourdine dit dessous. */
const raisonsDe = (html: string) => new Map([...html.matchAll(/<p id="([^"]+)" class="cab-raison(?: [^"]*)?">(.*?)<\/p>/g)].map(([, id, dedans]) => [id, texte(dedans).trim()]))

test('pendant une partie, l’œuvre ne s’achète, ne se dore ni ne se chasse : chaque geste en sourdine, la raison du serveur dite une fois, que chacun désigne', async () => {
  const riche = { ...page, poussiere: 100_000 }
  const attend = { ...riche, enCours: vues.pari }
  const raison = texte(laPartieAttend(vues.pari.jeu)).trim()
  const bouton = (html: string, debut: string) => boutonsDe(html).find(x => x.texte.startsWith(debut))!
  // Une œuvre qui manque : la chasse et l'achat s'éteignent, la raison se dit une fois, sous le second.
  const manque = await lOeuvre('expose', {}, attend)
  const [chasse, achat] = [bouton(manque, 'Partir à sa recherche'), bouton(manque, 'L’acheter')]
  assert.ok(chasse.eteint && achat.eteint, 'la chasse et l’achat en sourdine')
  assert.ok(chasse.raison && chasse.raison === achat.raison, 'les deux désignent la même raison')
  assert.equal(raisonsDe(manque).get(chasse.raison!), raison)
  assert.equal([...texte(manque).matchAll(new RegExp(echapper(raison), 'g'))].length, 1, 'dite une fois')
  // Sans partie, tout répond : rien en sourdine, aucune raison.
  const libre = await lOeuvre('expose', {}, riche)
  assert.ok(!bouton(libre, 'Partir à sa recherche').eteint && !bouton(libre, 'L’acheter').eteint)
  assert.equal(raisonsDe(libre).size, 0)
  // Une œuvre à lui, pas dorée : la dorure et « La rejouer » s'éteignent — la partie qui attend se dit d'abord, comme au serveur
  // (`cadreDuDepart`, `refusDeLAchat`), avant le jeu qui n'est pas livré.
  assert.ok(!JEUX_PRETS.includes(JEU_DE_L_OEUVRE['coup-d-oeil']))
  const aLui = await lOeuvre('coup-d-oeil', {}, attend)
  const [dorure, rejouer] = [bouton(aLui, 'Dorer son cadre'), bouton(aLui, 'La rejouer')]
  assert.ok(dorure.eteint && rejouer.eteint)
  assert.ok(dorure.raison && dorure.raison === rejouer.raison)
  assert.equal(raisonsDe(aLui).get(dorure.raison!), raison)
  assert.doesNotMatch(texte(aLui), new RegExp(JEU_PAS_LIVRE))
  // Sa carte-bonus, elle, se choisit toujours : ce n'est qu'une préférence du téléphone.
  assert.ok(!bouton(aLui, 'En faire ma carte-bonus').eteint)
  // Sans partie : la dorure répond, et « La rejouer » dit sous lui le jeu qui arrive bientôt.
  const sans = await lOeuvre('coup-d-oeil', {}, riche)
  assert.ok(!bouton(sans, 'Dorer son cadre').eteint)
  assert.equal(raisonsDe(sans).get(bouton(sans, 'La rejouer').raison!), JEU_PAS_LIVRE)
  // Les mots du serveur, importés : la page ne les recopie pas.
  assert.doesNotMatch(source('views/cabinet/Oeuvre.tsx'), /t’attend|reprends-la/)
  sansJargon(manque, 'une œuvre pendant une partie')
})

test('la chasse d’une œuvre se refuse dans l’ordre du serveur : la partie qui attend, puis plus de chasse, puis le jeu qui n’est pas livré', async () => {
  // `cadreDuDepart` compte les chasses avant de chercher le jeu : la page qui disait d'abord « Ce jeu arrive bientôt » contredisait
  // le toast que le même départ aurait rendu (`cabinet-poussiere.test.ts`, par le vrai serveur).
  const sansChasse = { ...page, chasses: { ...page.chasses, restent: 0 } }
  const raisonDe = (html: string, debut: string) => raisonsDe(html).get(boutonsDe(html).find(x => x.texte.startsWith(debut))!.raison!)
  // À lui, à un jeu pas livré (l'Épingle) : la raison est qu'il n'a plus de chasse, et le jeu à venir ne se dit pas.
  assert.ok(!JEUX_PRETS.includes(JEU_DE_L_OEUVRE['coup-d-oeil']))
  const aLui = await lOeuvre('coup-d-oeil', {}, sansChasse)
  assert.equal(raisonDe(aLui, 'La rejouer'), PLUS_DE_CHASSE)
  assert.doesNotMatch(texte(aLui), new RegExp(JEU_PAS_LIVRE))
  // Une œuvre qui manque, à un jeu pas livré : de même.
  const aVenir = page.salles.flatMap(s => s.oeuvres).find(o => !o.possedee && o.bientot)!
  assert.equal(raisonDe(await lOeuvre(aVenir.cle, {}, sansChasse), 'Partir à sa recherche'), PLUS_DE_CHASSE)
  // Une partie qui attend se dit avant tout.
  assert.equal(raisonDe(await lOeuvre('coup-d-oeil', {}, { ...sansChasse, enCours: vues.pari }), 'La rejouer'), texte(laPartieAttend(vues.pari.jeu)).trim())
  // Des chasses qui restent : le jeu qui n'est pas livré.
  assert.equal(raisonDe(await lOeuvre('coup-d-oeil'), 'La rejouer'), JEU_PAS_LIVRE)
})

test('pendant une partie, rien d’autre ne part : la visite, les jeux libres et l’annonce mettent leur départ en sourdine, la raison du serveur dite une fois', async () => {
  // Le même refus que la chasse d'une œuvre (`cadreDuDepart`) : « Jouer » ouvrait l'annonce, et « Commencer » ne disait qu'en
  // toast ce que l'écran d'une œuvre disait d'avance.
  const attend = { ...page, enCours: vues.pari }
  const raison = texte(laPartieAttend(vues.pari.jeu)).trim()
  const uneFois = (html: string) => assert.equal([...texte(html).matchAll(new RegExp(echapper(raison), 'g'))].length, 1, 'dite une fois')
  const eteints = (boutons: ReturnType<typeof boutonsDe>, html: string) => {
    assert.ok(boutons.length > 0)
    assert.ok(boutons.every(x => x.eteint && x.raison !== null && x.raison === boutons[0].raison), 'chacun en sourdine, et la même raison')
    assert.equal(raisonsDe(html).get(boutons[0].raison!), raison)
    uneFois(html)
  }
  // La visite : chaque « Jouer » ; « Changer de jeu », que le serveur accepte pendant une partie, répond.
  const avecEchange = (p: PageDuCabinet) => ({ ...p, visite: { ...p.visite, echange: { possible: true } } })
  const visite = await rendu('views/cabinet/Visite', 'Visite', { page: avecEchange(attend), busy: false, onJouer: rien, onEchanger: rien })
  eteints(boutonsDe(visite).filter(x => x.texte === 'Jouer'), visite)
  assert.ok(boutonsDe(visite).filter(x => x.texte === 'Changer de jeu').every(x => !x.eteint))
  const visiteLibre = await rendu('views/cabinet/Visite', 'Visite', { page: avecEchange(page), busy: false, onJouer: rien, onEchanger: rien })
  assert.ok(boutonsDe(visiteLibre).filter(x => x.texte === 'Jouer').every(x => !x.eteint && x.raison === null))
  // Les jeux libres : chacun, les livrés comme ceux qui arrivent bientôt.
  const libres = await rendu('views/cabinet/Visite', 'JouerLibrement', { page: attend, onJouer: rien })
  eteints(boutonsDe(libres), libres)
  // Au-dessus de ce qu'elle éteint, une ligne de l'écran : sous la troisième case ou le neuvième jeu, elle tombait sous le pli.
  for (const [html, liste] of [
    [visite, '<ol class="cab-cases"'],
    [libres, '<ul class="cab-jeux"'],
  ] as const) {
    assert.ok(html.indexOf('class="cab-raison cab-raison-en-tete"') >= 0 && html.indexOf('class="cab-raison cab-raison-en-tete"') < html.indexOf(liste), liste)
  }
  const sansPartie = await rendu('views/cabinet/Visite', 'JouerLibrement', { page, onJouer: rien })
  assert.equal(boutonsDe(sansPartie).filter(x => x.eteint).length, CLES_DES_JEUX.length - JEUX_PRETS.length)
  assert.equal(raisonsDe(sansPartie).size, 0)
  // L'annonce relue sous une partie partie d'ailleurs : « Commencer » en sourdine, et rien de ce qu'il coûterait.
  const annonce = await rendu('views/cabinet/Annonce', 'Annonce', { page: attend, demande: { origine: 'chasse', oeuvre: 'expose' }, carte: null, busy: false, onCarte: rien, onCommencer: rien, onRetour: rien })
  eteints(boutonsDe(annonce).filter(x => x.texte === 'Commencer'), annonce)
  assert.doesNotMatch(texte(annonce), /Rien ne compte avant/)
  // Les mots du serveur, importés : la page ne les recopie pas.
  for (const f of ['views/cabinet/Visite.tsx', 'views/cabinet/Annonce.tsx']) assert.doesNotMatch(source(f), /t’attend|reprends-la/, f)
  sansJargon(libres, 'les jeux libres pendant une partie')
})

test('la page oublie ses cartels quand un achat, une dorure ou une partie ont pu les changer — ici ou ailleurs —, et un cartel parti avant ne s’y range plus', async () => {
  const { cartelDemande, cartelArrive, cartelsQuiTiennent } = await import(url('views/cabinet/Cartel.tsx'))
  const lu = (doree: boolean) => ({ etat: 'lu', cartel: { oeuvre: 'coup-d-oeil', origine: 'depart', doree, dit: 'Offerte à ton arrivée.' } })
  // Une demande, et sa réponse rangée à sa place.
  const demande = cartelDemande({}, 'coup-d-oeil', 1)
  assert.deepEqual(demande, { 'coup-d-oeil': { etat: 'chargement', demande: 1 } })
  assert.deepEqual(cartelArrive(demande, 'coup-d-oeil', 1, lu(false)), { 'coup-d-oeil': lu(false) })
  // Oubliés pendant qu'elle était en route — un achat, une dorure, une partie —, l'œuvre ouverte en a fait partir une neuve : la
  // réponse d'avant, qui dirait l'œuvre d'avant, ne se range pas ; celle de la neuve, si. L'œuvre fermée, aucune.
  const neuve = cartelDemande({}, 'coup-d-oeil', 2)
  assert.equal(cartelArrive(neuve, 'coup-d-oeil', 1, lu(false)), neuve)
  assert.deepEqual(cartelArrive(neuve, 'coup-d-oeil', 2, lu(true)), { 'coup-d-oeil': lu(true) })
  const aucun = {}
  assert.equal(cartelArrive(aucun, 'coup-d-oeil', 1, lu(false)), aucun)
  // La page neuve dit ce qui a changé ailleurs — un autre onglet, un autre téléphone, la clôture du lendemain.
  const dore = (p: PageDuCabinet, cle: string): PageDuCabinet => ({ ...p, salles: p.salles.map(s => ({ ...s, oeuvres: s.oeuvres.map(o => (o.cle === cle ? { ...o, doree: true } : o)) })) })
  const gardes = { 'coup-d-oeil': lu(false) }
  assert.ok(!page.salles.flatMap(s => s.oeuvres).find(o => o.cle === 'coup-d-oeil')!.doree)
  // Rien de changé : les mêmes, le même objet — la page ne se redessine pas pour rien. La première page n'a rien à démentir.
  assert.equal(cartelsQuiTiennent(gardes, page, { ...page }), gardes)
  assert.equal(cartelsQuiTiennent(gardes, null, page), gardes)
  // Dorée ailleurs : le cartel lu promettait encore « Rejoue-la pour dorer son cadre », il s'oublie.
  assert.deepEqual(cartelsQuiTiennent(gardes, page, dore(page, 'coup-d-oeil')), {})
  // Lu après la dorure, sous une page d'avant : la page neuve le confirme, il tient — et ne se redemande pas en boucle.
  const dejaDore = { 'coup-d-oeil': lu(true) }
  assert.equal(cartelsQuiTiennent(dejaDore, page, dore(page, 'coup-d-oeil')), dejaDore)
  // En route pendant que l'œuvre changeait entre les deux pages : parti avant, il dirait l'œuvre d'avant ; sans changement, il tient.
  const enRoute = { 'coup-d-oeil': { etat: 'chargement', demande: 3 } }
  assert.deepEqual(cartelsQuiTiennent(enRoute, page, dore(page, 'coup-d-oeil')), {})
  assert.equal(cartelsQuiTiennent(enRoute, page, { ...page }), enRoute)
  // Une partie qui attendait et n'attend plus — finie ici ou ailleurs — a pu doubler une œuvre sans rien changer de ce que la page
  // en montre : tous s'oublient. Toujours la même qui attend : ils tiennent.
  assert.deepEqual(cartelsQuiTiennent(gardes, { ...page, enCours: vues.pari }, page), {})
  assert.equal(cartelsQuiTiennent(gardes, { ...page, enCours: vues.pari }, { ...page, enCours: vues.pari }), gardes)
  // Le branchement : chaque page neuve passe par `cartelsQuiTiennent`, une partie finie ici par `Partie.onFinie` — la partie encore
  // à l'écran : le retour du navigateur fait reparaître l'œuvre de la chasse —, chaque demande par son numéro ; un perdu se
  // redemande à chaque page relue.
  const app = source('views/CabinetApp.tsx')
  assert.match(app, /const oublierLesCartels = useCallback\(\(\) => setCartels\(\{\}\), \[\]\)/)
  assert.match(app, /setCartels\(c => cartelsQuiTiennent\(c, avant, page\)\)\s*\}, \[page\]\)/)
  assert.match(app, /onFinie=\{oublierLesCartels\}/)
  assert.match(source('views/cabinet/Partie.tsx'), /const finie = vue\.phase === 'finie'\s*useEffect\(\(\) => \{\s*if \(finie\) onFinie\?\.\(\)\s*\}, \[finie, onFinie\]\)/)
  assert.match(app, /const demande = \+\+demandesDeCartel\.current\s*setCartels\(c => cartelDemande\(c, aSonCartel, demande\)\)/)
  for (const etat of ["\\{ etat: 'lu', cartel \\}", "\\{ etat: 'perdu', motif: motifDe\\(e\\) \\}"]) assert.match(app, new RegExp(`setCartels\\(c => cartelArrive\\(c, aSonCartel, demande, ${etat}\\)\\)`), etat)
  assert.match(app, /setCartels\(sansLesPerdus\)\s*\}, \[aSonCartel, page\]\)/)
  // L'échange ne touche aucune œuvre : il n'oublie rien.
  assert.match(app, /ecrire\(\(\) => api\.cabinet\.echanger\(k\), '[^']*'\)/)
})

test('les règles : un jeu de la visite se change une fois par jour — le type du barème le tient, sans branche qui ne sert jamais', async () => {
  assert.match(texte(await rendu('views/cabinet/Regles', 'Regles', { jeux: page.jeux })), /Un jeu de la visite se change, une fois par jour\./)
  assert.doesNotMatch(source('views/cabinet/Regles.tsx'), /ECHANGES_PAR_JOUR === 1|\$\{ECHANGES_PAR_JOUR\} fois/)
})

/** Là où `rendreLeFocus` poserait le focus sur ce rendu : la première `.cab-question`, sinon le premier `h2`, sinon le `h1` — l'ordre de `Partie.tsx`. */
function cibleDuFocus(html: string): { balise: string; classe: string; texte: string } | null {
  const trouve =
    /<(\w+) class="([^"]*\bcab-question\b[^"]*)"[^>]*>(.*?)<\/\1>/.exec(html) ?? /<(h2)(?: class="([^"]*)")?[^>]*>(.*?)<\/h2>/.exec(html) ?? /<(h1)(?: class="([^"]*)")?[^>]*>(.*?)<\/h1>/.exec(html)
  return trouve ? { balise: trouve[1], classe: trouve[2] ?? '', texte: texte(trouve[3]).trim() } : null
}

test('chaque révélation a son titre où poser le focus : ce qui s’est passé, que le lecteur d’écran dit', async () => {
  // La réponse touchée disparaît avec la manche : sans titre où se poser, le focus tombait sur la page, et le lecteur d'écran ne
  // disait rien du verdict. Le titre de la révélation est un `h2`, au cadre de chaque jeu — le Pari, l'Éclair, le Détail, la Frise,
  // le Mot mystère, le Filet.
  for (const v of [vues.gagne, vues.garde, vues.fini, vues.eclairRevele, vues.detailRate, vues.detailReconnu, vues.friseRatee, vues.friseJuste, vues.motTrouve, vues.motRate, vues.filetDedans, vues.filetACote]) {
    const ou = `${v.jeu}, manche ${v.revelation!.manche + 1}`
    const cible = cibleDuFocus(await laPartie(v))
    assert.ok(cible, ou)
    assert.deepEqual([cible.balise, cible.classe], ['h2', 'cab-titre-revele'], ou)
    assert.equal(cible.texte, texte(v.revelation!.corps.titre.replace(/'/g, '’')).trim(), ou)
  }
  // Le titre garde sa taille de verdict : un `h2` de la page en prendrait une autre (`.cab-page h2`).
  const css = readFileSync(path.join(client, 'styles.css'), 'utf8')
  assert.match(css, /\n\.cab-page h2\.cab-titre-revele \{ font-size: 1\.6rem; \}/)
  // Un titre qui reçoit le focus par programme — celui d'un écran, la question d'une manche, le verdict — ne prend pas l'anneau
  // noir du navigateur : au clavier, `:focus-visible` le lui donnait, que la règle de l'application n'écarte que pour le sien.
  assert.match(css, /\n\.cab-page \[tabindex='-1'\]:focus \{ outline: none; \}/)
  assert.doesNotMatch(css, /\.cab-page h1:focus/)
})

// ── 17. Le Mot mystère et le Filet à l'écran ──────────────────────────────
//
// Inès joue par les vraies routes, Coup d'œil emporté : un Mot — un essai mêlé (une lettre bien placée, une ailleurs, les autres
// absentes), une lettre soufflée, puis le mot au deuxième essai ; cinq essais faux ; puis laissé au temps —, un Filet — la zone
// dorée d'Éclairer, le petit filet sur la réponse ; le grand, à côté ; puis laissé au temps sans y toucher —, et chacun avec Échange.
// Ilse dore le dernier cadre de la salle du Devin : son second gardien s'éveille, et la page de la dorure le dit. Chaque écran se
// rend sur la vue même que le serveur a rendue.

/** Le témoin d'Inès, et celui d'Ilse ; la page que la dorure d'Ilse rend. */
let ines: string
let ilse: string
let pageDuReveil: PageDuCabinet

/** Un essai du Mot de la bonne longueur : sa première lettre à sa place, sa deuxième une case plus loin, des X ailleurs — aucun mot d'essai n'en a, ni n'a deux fois la même lettre en tête. */
const essaiMele = (lettres: string) => `${lettres[0]}X${lettres[1]}${'X'.repeat(lettres.length - 3)}`

/** La page passe le temps de la manche, et sa grâce : la réponse qui part d'elle-même arrive en retard. */
const apresLEcheance = (v: VueDeLaPartie) => {
  b.horloge.t = v.chrono!.echeance + GRACE_D_UNE_MANCHE_MS + 1
}

/** Joué à la fin du `before` du fichier, après Noé : l'heure du banc avance de deux manches. */
async function lesMotsEtLesFiletsDInes() {
  ines = await inscrireProfil(b.banc.url, 'ines', 'Inès')
  let m = (vues.mot = ok(await commencer(b, ines, { origine: 'libre', jeu: 'mot', carte: 'coup-d-oeil' }), 'le Mot'))
  const t = motDe(b, m.id, m.tirage!)
  m = vues.motMele = ok(await jouer(b, ines, m, { quoi: 'essai', manche: 0, lettres: essaiMele(t.lettres) }), 'un essai mêlé')
  m = vues.motSouffle = ok(await jouer(b, ines, m, { quoi: 'eclairer', manche: 0 }), 'souffler une lettre')
  m = vues.motTrouve = ok(await jouer(b, ines, m, { quoi: 'essai', manche: 0, lettres: t.lettres }), 'le mot trouvé')
  m = await ouvrir(b, ines, m, 1)
  m = vues.motRate = await jouerUnMot(b, ines, m, 1, null)
  m = await ouvrir(b, ines, m, 2)
  apresLEcheance(m)
  vues.motExpire = ok(await jouer(b, ines, m, { quoi: 'repondre', manche: 2, auto: true }), 'le Mot laissé au temps')
  vues.motEchange = ok(await commencer(b, ines, { origine: 'libre', jeu: 'mot', carte: 'echange' }), 'le Mot et l’Échange')
  vues.motChange = ok(await jouer(b, ines, vues.motEchange, { quoi: 'changer', manche: 0 }), 'changer de mot')
  ok(await jouer(b, ines, vues.motChange, { quoi: 'quitter' }), 'quitter le Mot')

  let f = (vues.filet = ok(await commencer(b, ines, { origine: 'libre', jeu: 'filet', carte: 'coup-d-oeil' }), 'le Filet'))
  f = vues.filetEclaire = ok(await jouer(b, ines, f, { quoi: 'eclairer', manche: 0 }), 'éclairer le Filet')
  f = vues.filetDedans = await jouerUnFilet(b, ines, f, 0, 'petit')
  f = await ouvrir(b, ines, f, 1)
  f = vues.filetACote = await jouerUnFilet(b, ines, f, 1, 'grand', false)
  f = await ouvrir(b, ines, f, 2)
  apresLEcheance(f)
  vues.filetSansLancer = ok(await jouer(b, ines, f, { quoi: 'repondre', manche: 2, auto: true }), 'le Filet laissé au temps')
  vues.filetEchange = ok(await commencer(b, ines, { origine: 'libre', jeu: 'filet', carte: 'echange' }), 'le Filet et l’Échange')
  vues.filetChange = ok(await jouer(b, ines, vues.filetEchange, { quoi: 'changer', manche: 0 }), 'changer de question')
  ok(await jouer(b, ines, vues.filetChange, { quoi: 'quitter' }), 'quitter le Filet')
}

/**
 * Ilse a la salle du Devin entière, posée en base, tous ses cadres dorés sauf un, et de quoi le dorer : sa première page range le
 * premier gardien de la salle, en silence (la salle était complète avant elle) ; la dorure du dernier cadre réveille le second.
 */
async function leReveilDIlse() {
  ilse = await inscrireProfil(b.banc.url, 'ilse', 'Ilse')
  const id = (await lire(b, ilse, '/api/joueur/moi?leger')).corps.profile.id as string
  const devin = oeuvresDeLaSalle('devin').filter(o => !OEUVRES_DE_DEPART.includes(o.cle))
  const aDorer = devin.find(o => o.rarete === 'commun')!
  const lignes = devin.map(o => `('${id}', '${o.cle}', 'partie', 0, ${o.cle === aDorer.cle ? 'NULL, NULL' : "0, 'partie'"})`)
  aLaMain(b.fichier, `INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le, doree_le, dorure) VALUES ${lignes.join(', ')}`)
  const prix = PRIX_D_UNE_DORURE[aDorer.rarete]
  aLaMain(b.fichier, `INSERT INTO cabinet_profils (profile_id, poussiere, cree_le, maj_le) VALUES ('${id}', ${prix}, 0, 0)`)
  assert.equal(ok(await laPage(b, ilse), 'la page d’Ilse').reveil, undefined, 'la salle complète d’avant se range sans rien dire')
  pageDuReveil = ok(await poster<PageDuCabinet>(b, ilse, `/api/cabinet/oeuvre/${aDorer.cle}/dorure`, { prix }), 'la dorure')
}

test('une manche du Mot mystère : sa catégorie et sa longueur, la question, la grille de ses essais, le clavier collé sous elle — jamais le mot', async () => {
  const v = vues.mot
  const m = v.enCours as MotMontre
  assert.equal(m.jeu, 'mot')
  const html = await laPartie(v)
  const t = texte(html)
  assert.match(t, new RegExp(`${lu(m.categorie!)} · un mot de ${m.longueur} lettres`))
  assert.match(t, new RegExp(lu(m.texte)))
  // La question est son titre, où le focus se pose quand la manche s'ouvre.
  assert.match(html, /<h2 class="quiz-question cab-question cab-question-du-mot">/)
  // La grille : une ligne par essai permis, une case par lettre.
  const grille = /<ol class="cab-mot-grille"[^>]*>(.*?)<\/ol>/.exec(html)?.[1] ?? ''
  assert.equal([...grille.matchAll(/<li class="cab-mot-ligne[^"]*"/g)].length, ESSAIS_DU_MOT)
  assert.equal([...grille.matchAll(/class="cab-lettre[^"]*"/g)].length, ESSAIS_DU_MOT * m.longueur)
  // Le clavier, collé au bas de l'écran avec la carte-bonus, sous le pouce : trois rangées, l'AZERTY, « Effacer » et « Valider ».
  const pied = html.slice(html.indexOf('<div class="cab-pied-partie">'))
  assert.ok(pied.startsWith('<div class="cab-pied-partie"><button type="button" class="btn btn-block cab-pouvoir">'), 'la carte-bonus d’abord')
  assert.match(pied, /<div class="cab-clavier" role="group" aria-label="Le clavier">/)
  const rangees = [...pied.matchAll(/<div class="cab-clavier-rang">(.*?)<\/div>/g)].map(r => [...r[1].matchAll(/<button type="button" class="cab-touche"[^>]*>([A-Z])/g)].map(x => x[1]).join(''))
  assert.deepEqual(rangees, ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'])
  assert.match(pied, /<button type="button" class="cab-touche cab-touche-large" aria-label="Effacer la dernière lettre">/)
  // Rien de tapé : « Valider » attend ses lettres.
  assert.match(pied, /<button type="button" class="cab-touche cab-touche-large cab-valider-le-mot" aria-disabled="true">Valider<\/button>/)
  // Ni le mot, ni sa réponse telle que la base l'écrit : ce que la page voit, c'est la question et sa longueur.
  const plan = motDe(b, v.id, v.tirage!)
  assert.doesNotMatch(t, new RegExp(`\\b${echapper(plan.affiche)}\\b`, 'i'))
  assert.doesNotMatch(html, new RegExp(plan.lettres))
  sansJargon(html, 'une manche du Mot')
})

test('le Mot après un essai : chaque lettre sa couleur et sa marque — jamais la couleur seule —, les touches marquées de ce qu’il a appris', async () => {
  const v = vues.motMele
  const m = v.enCours as MotMontre
  const plan = motDe(b, v.id, v.tirage!)
  assert.deepEqual(m.essais[0].couleurs.slice(0, 3), ['bien', 'absente', 'ailleurs'], 'l’essai d’essai : une bien placée, une absente, une ailleurs')
  const html = await laPartie(v)
  // La première ligne, colorée : la couleur, et ce qu'elle dit à l'oreille (« O, bien placée »).
  const premiere = /<li class="cab-mot-ligne cab-mot-joue"[^>]*>(.*?)<\/li>/.exec(html)?.[1] ?? ''
  const cases = [...premiere.matchAll(/<span class="cab-lettre cab-(bien|ailleurs|absente)">([A-Z])<span class="sr-only">, ([^<]+)<\/span><\/span>/g)]
  assert.deepEqual(
    cases.map(c => [c[2], c[1]]),
    [...m.essais[0].lettres].map((l, i) => [l, m.essais[0].couleurs[i]]),
  )
  assert.deepEqual([...new Set(cases.map(c => `${c[1]}:${c[3]}`))].sort(), ['absente:absente', 'ailleurs:ailleurs dans le mot', 'bien:bien placée'])
  // La ligne en cours vient sous elle, les suivantes vides.
  assert.equal([...html.matchAll(/<li class="cab-mot-ligne cab-mot-en-cours"/g)].length, 1)
  // Les touches : ce que l'essai a appris de chaque lettre, à la même couleur et la même marque (`etatDesTouches`).
  const touches = etatDesTouches(m.essais)
  for (const [lettre, couleur] of Object.entries(touches)) {
    assert.match(html, new RegExp(`<button type="button" class="cab-touche cab-${couleur}"[^>]*>${lettre}<span class="sr-only">, ${couleur === 'bien' ? 'bien placée' : couleur === 'ailleurs' ? 'ailleurs dans le mot' : 'absente'}</span>`), lettre)
  }
  assert.equal(touches[plan.lettres[0]], 'bien')
  assert.equal(touches.X, 'absente')
  // Ce que disent les marques, en mots, une fois, sous la question — chaque case le redit à l'oreille.
  assert.match(html, /<ul class="cab-legende" aria-hidden="true"><li><span class="cab-marque-bien"><\/span>bien placée<\/li><li><span class="cab-marque-ailleurs"><\/span>ailleurs<\/li><li><span class="cab-marque-absente"><\/span>absente<\/li><\/ul>/)
  // La feuille : chaque couleur a sa marque — un trait sous la lettre bien placée, un point sous celle qui est ailleurs —, et ses
  // couleurs écrites en dur, une convention qu'aucun thème ne repeint.
  const section = sectionDuCabinet()
  for (const couleur of ['bien', 'ailleurs']) {
    assert.match(section, new RegExp(`\\.cab-lettre\\.cab-${couleur}::after,\\s*\\.cab-touche\\.cab-${couleur}::after,\\s*\\.cab-marque-${couleur}::after \\{[^}]*content: ''`), couleur)
  }
  assert.match(section, /\.cab-lettre\.cab-ailleurs::after,[^{]*\{[^}]*border-radius: 50%/, 'ailleurs : un point')
  assert.match(section, /\.cab-lettre\.cab-bien::after,[^{]*\{[^}]*height: 4px/, 'bien placée : un trait')
  assert.match(section, /\.cab-lettre\.cab-bien,\s*\.cab-touche\.cab-bien,\s*\.cab-marque-bien \{[^}]*background: #[0-9a-f]{6}/)
  assert.match(section, /\.cab-lettre\.cab-ailleurs,\s*\.cab-touche\.cab-ailleurs,\s*\.cab-marque-ailleurs \{[^}]*background: #[0-9a-f]{6}/)
  sansJargon(html, 'le Mot après un essai')
})

test('taper au clavier du Mot : les lettres dans les cases libres, la lettre soufflée à sa place, « Effacer », et la longueur refusée en mots', async () => {
  type Local = { cases: (string | null)[]; curseur: number; dit: boolean }
  const { MOT, ligneEnCours, taper, effacer, essaiDe, lettreDuClavier } = (await import(url('views/cabinet/jeux/MotMystere.tsx'))) as {
    MOT: { localDe: (m: MotMontre) => Local; cleDe: (m: MotMontre) => string; aLEcheance: (m: MotMontre, l: Local) => unknown }
    ligneEnCours: (m: MotMontre, l: Local) => { lettre: string | null; soufflee: boolean }[]
    taper: (m: MotMontre, l: Local, lettre: string) => Local
    effacer: (m: MotMontre, l: Local) => Local
    essaiDe: (m: MotMontre, l: Local) => string | null
    lettreDuClavier: (touche: string) => string | null
  }
  const v = vues.motSouffle
  const m = v.enCours as MotMontre
  assert.equal(m.soufflees.length, 1, 'Éclairer a soufflé une lettre')
  const [s] = m.soufflees
  const vide = MOT.localDe(m)
  // La lettre soufflée est à sa place dès la ligne vide ; les autres attendent.
  assert.deepEqual(
    ligneEnCours(m, vide),
    Array.from({ length: m.longueur }, (_, i) => (i === s.position ? { lettre: s.lettre, soufflee: true } : { lettre: null, soufflee: false })),
  )
  // Taper remplit les cases libres dans l'ordre, en sautant la soufflée — une autre lettre que la sienne y arrive ; une lettre de
  // trop ne va nulle part.
  const autres = [...'ZQWXJKVYH'].filter(x => x !== s.lettre)
  let l = vide
  for (let i = 0; i < m.longueur - 1; i++) {
    assert.equal(essaiDe(m, l), null, 'incomplète')
    l = taper(m, l, autres[i])
  }
  let k = 0
  assert.equal(essaiDe(m, l), Array.from({ length: m.longueur }, (_, i) => (i === s.position ? s.lettre : autres[k++])).join(''))
  assert.deepEqual(taper(m, l, autres[m.longueur]), l)
  // « Effacer » ôte la dernière lettre tapée, jamais la soufflée.
  let e = l
  for (let i = 0; i < m.longueur + 2; i++) e = effacer(m, e)
  assert.deepEqual(ligneEnCours(m, e), ligneEnCours(m, vide))
  assert.equal(essaiDe(m, e), null)
  // Incomplète, « Valider » attend ; touché quand même, il dit la longueur, en mots — rien ne part au serveur.
  const court = { ...taper(m, vide, 'A'), dit: true }
  const refuse = await laPartie(v, { local: court })
  assert.match(texte(refuse), new RegExp(`Il faut ${m.longueur} lettres`))
  assert.match(refuse, /cab-valider-le-mot" aria-disabled="true"/)
  const plein = await laPartie(v, { local: l })
  assert.match(plein, /<button type="button" class="cab-touche cab-touche-large cab-valider-le-mot">Valider<\/button>/)
  assert.doesNotMatch(texte(plein), /Il faut/)
  // La case soufflée se distingue en mots aussi.
  assert.match(await laPartie(v), new RegExp(`<span class="cab-lettre cab-soufflee">${s.lettre}<span class="sr-only">, soufflée</span></span>`))
  // Éclairer servi, la carte-bonus se pose sous la manche ; le clavier, lui, reste collé au bas de l'écran.
  assert.equal(v.pouvoir?.jouable, false)
  const pose = await laPartie(v)
  const iPose = pose.indexOf('<div class="cab-pied-partie cab-pied-pose">')
  const iClavier = pose.indexOf('<div class="cab-pied-partie"><div class="cab-clavier"')
  assert.ok(iPose > 0 && iClavier > iPose, `${iPose}, ${iClavier}`)
  // Ce que la page tient repart de zéro à chaque essai, pas à une lettre soufflée : la ligne tapée reste sous les yeux.
  assert.equal(MOT.cleDe(vues.motSouffle.enCours as MotMontre), MOT.cleDe(vues.motMele.enCours as MotMontre))
  assert.notEqual(MOT.cleDe(vues.motMele.enCours as MotMontre), MOT.cleDe(vues.mot.enCours as MotMontre))
  assert.notEqual(MOT.cleDe(vues.motChange.enCours as MotMontre), MOT.cleDe(vues.motEchange.enCours as MotMontre), '« Changer » pose un autre mot')
  // Le clavier de l'ordinateur : une lettre, accent ôté ; rien d'autre.
  assert.deepEqual(['a', 'É', 'ç', 'Q', '1', 'Enter', 'œ', ' '].map(lettreDuClavier), ['A', 'E', 'C', 'Q', null, null, null, null])
  // À l'échéance, rien ne part : le serveur a déjà ses essais, une ligne pas validée n'en est pas un.
  assert.equal(MOT.aLEcheance(m, l), undefined)
})

test('taper le mot entier par-dessus une lettre soufflée : retapée, elle passe — sinon « ABEILLE » faisait « ABEIILL »', async () => {
  type Local = { cases: (string | null)[]; curseur: number; dit: boolean }
  const { MOT, taper, effacer, essaiDe } = (await import(url('views/cabinet/jeux/MotMystere.tsx'))) as {
    MOT: { localDe: (m: MotMontre) => Local }
    taper: (m: MotMontre, l: Local, lettre: string) => Local
    effacer: (m: MotMontre, l: Local) => Local
    essaiDe: (m: MotMontre, l: Local) => string | null
  }
  // Le rendu du 25 octobre 2026 : le I d'ABEILLE soufflé, le mot tapé en entier au clavier de l'ordinateur, la lettre soufflée
  // prenait la case libre d'après et la dernière lettre tombait.
  const montre = (position: number): MotMontre => ({ ...(vues.mot.enCours as MotMontre), longueur: 7, essais: [], soufflees: [{ position, lettre: 'ABEILLE'[position] }] })
  const tape = (m: MotMontre, mot: string, depuis = MOT.localDe(m)) => [...mot].reduce((l, x) => taper(m, l, x), depuis)
  for (const position of [0, 3, 4, 6]) {
    const m = montre(position)
    // Le mot tapé comme on le lit, sa lettre soufflée comprise.
    assert.equal(essaiDe(m, tape(m, 'ABEILLE')), 'ABEILLE', `soufflée en ${position + 1}e`)
    // Ou ses seules cases libres, quand la lettre qui suit la soufflée n'est pas la sienne.
    if (position !== 4) assert.equal(essaiDe(m, tape(m, 'ABEILLE'.slice(0, position) + 'ABEILLE'.slice(position + 1))), 'ABEILLE', `cases libres, soufflée en ${position + 1}e`)
  }
  // « Effacer » derrière une soufflée retapée ôte la lettre tapée d'avant, et la soufflée se retape.
  const m = montre(4)
  const avant = tape(m, 'ABEIL')
  assert.equal(avant.curseur, 5)
  const efface = effacer(m, avant)
  assert.deepEqual([efface.cases.slice(0, 4), efface.curseur], [['A', 'B', 'E', null], 3])
  assert.equal(essaiDe(m, tape(m, 'ILLE', efface)), 'ABEILLE')
  // Une autre lettre que la soufflée, à sa place, va à la case libre d'après : la soufflée est la vraie lettre.
  assert.equal(essaiDe(m, tape(m, 'ABEIXLE')), 'ABEILXL')
})

test('chaque essai du Mot retient le souffle de la niche — la page ne sait pas s’il trouve le mot —, et l’essai revenu sans verdict le relâche', async () => {
  const { leGesteRetientLeSouffle, leSouffleSeRelache } = (await import(url('views/cabinet/Partie.tsx'))) as {
    leGesteRetientLeSouffle: (g: { quoi: string }) => boolean
    leSouffleSeRelache: (g: { quoi: string }, apres: VueDeLaPartie) => boolean
  }
  // Au Mot, c'est un essai qui tranche la manche — le mot trouvé, ou le dernier permis — : sans souffle, la niche passait du calme
  // au verdict, et la partie, pour elle, ne se jouait pas (une forme atteinte au bilan ne la faisait pas sortir).
  const essai = { quoi: 'essai', manche: 0, lettres: 'NUAGE' }
  for (const geste of [essai, { quoi: 'repondre', manche: 0 }, { quoi: 'garder', manche: 0 }]) assert.ok(leGesteRetientLeSouffle(geste), geste.quoi)
  for (const quoi of ['ouvrir', 'eclairer', 'changer', 'pause', 'reprendre', 'parier', 'reculer', 'quitter']) assert.ok(!leGesteRetientLeSouffle({ quoi }), quoi)
  // Sur les vues d'Inès : l'essai mêlé revient la manche encore à jouer, le souffle se relâche — sinon la niche restait assombrie
  // d'un essai à l'autre, deux minutes ; le mot trouvé et le cinquième essai faux rendent la révélation, qui le dit.
  assert.equal(vues.motMele.phase, 'jouer')
  assert.ok(leSouffleSeRelache(essai, vues.motMele))
  assert.ok(!leSouffleSeRelache(essai, vues.motTrouve))
  assert.ok(!leSouffleSeRelache(essai, vues.motRate))
  // Une réponse attend toujours son verdict : au Pari juste, la mise se décide le souffle retenu, comme avant.
  assert.ok(!leSouffleSeRelache({ quoi: 'repondre' }, vues.auChoix))
  // Le cadre les lit au geste même, une seule fois chacun (`niche-reactions.test.ts` compte ses souffles).
  const partie = source('views/cabinet/Partie.tsx')
  assert.match(partie, /if \(leGesteRetientLeSouffle\(geste\)\) nicheRetientSonSouffle\(\)/)
  assert.match(partie, /ranger\(r\.partie\)[^]{0,300}?if \(leSouffleSeRelache\(geste, r\.partie\)\) nicheRelacheSonSouffle\(\)/)
})

test('les lettres du Mot se tapent dès que les couleurs d’un essai paraissent : la demi-seconde de garde ne les retient qu’à un écran neuf, « Valider » à chaque vue neuve', async () => {
  const { laGardeDeLaTouche } = (await import(url('views/cabinet/jeux/MotMystere.tsx'))) as { laGardeDeLaTouche: (quoi: string) => 'ecran' | 'vue' }
  // Chaque essai rend une vue neuve, que le cadre garde une demi-seconde (`sousLeDoigtDe`) : qui commençait le mot suivant dès
  // les couleurs perdait ses premières lettres, sans un mot. Une lettre, « Effacer » : la garde d'un écran neuf seulement —
  // « Manche suivante » à leur place, le second toucher d'un double ne tape rien. « Valider », la garde entière : touché deux
  // fois, il redisait « Il faut 6 lettres » sur la ligne que l'essai venait de vider.
  for (const lettre of 'AZERTYUIOPQSDFGHJKLMWXCVBN') assert.equal(laGardeDeLaTouche(lettre), 'ecran', lettre)
  assert.equal(laGardeDeLaTouche('effacer'), 'ecran')
  assert.equal(laGardeDeLaTouche('valider'), 'vue')
  // Le cadre tient les deux gardes : celle d'un écran neuf ne repart qu'avec lui, celle de la vue aussi avec ce qui change sous le doigt.
  const partie = source('views/cabinet/Partie.tsx')
  assert.match(partie, /useEffect\(\(\) => \{\s*changementDEcran\.current = performance\.now\(\)\s*\}, \[cleDEcran\]\)/)
  assert.match(partie, /useEffect\(\(\) => \{\s*changement\.current = performance\.now\(\)\s*\}, \[cleDEcran, sousLeDoigt\]\)/)
  assert.match(partie, /gardeDeLEcran: p\.gardeDeLEcran,/)
  assert.match(source('views/cabinet/jeux/MotMystere.tsx'), /auDoigt && !\(laGardeDeLaTouche\(quoi\) === 'vue' \? garde : gardeDeLEcran\)\(\)/)
})

test('le clavier de l’ordinateur ne tape au Mot ni dans un champ, ni sous un dialogue, ni avec Ctrl ; « Entrée » sur un autre bouton reste à ce bouton', async () => {
  type Touche = { ctrlKey: boolean; metaKey: boolean; altKey: boolean; defaultPrevented: boolean }
  type Cible = { closest: (sel: string) => unknown }
  const { pourLeClavier } = (await import(url('views/cabinet/jeux/MotMystere.tsx'))) as { pourLeClavier: (e: Touche, cible: Cible | null, dialogue: boolean) => 'tout' | 'sans-entree' | null }
  const touche = (o: Partial<Touche> = {}): Touche => ({ ctrlKey: false, metaKey: false, altKey: false, defaultPrevented: false, ...o })
  /** Un élément de la page, par ce qu'il est et ce qui le contient : `closest` le trouve s'il est l'un des sélecteurs demandés. */
  const element = (...dans: string[]): Cible => ({ closest: sel => (sel.split(',').some(s => dans.includes(s.trim())) ? {} : null) })
  // La page, ou une touche du clavier de l'écran : tout se tape, « Entrée » valide.
  assert.equal(pourLeClavier(touche(), null, false), 'tout')
  assert.equal(pourLeClavier(touche(), element(), false), 'tout')
  assert.equal(pourLeClavier(touche(), element('button', '.cab-clavier'), false), 'tout')
  // Un autre bouton, un lien : les lettres passent, « Entrée » est à lui — « Signaler », « Quitter », la carte-bonus.
  assert.equal(pourLeClavier(touche(), element('button'), false), 'sans-entree')
  assert.equal(pourLeClavier(touche(), element('a'), false), 'sans-entree')
  // Un champ, un dialogue ouvert (« Quitter ? », « Signaler une erreur »), un raccourci : rien.
  for (const champ of ['input', 'textarea', 'select', '[contenteditable="true"]']) assert.equal(pourLeClavier(touche(), element(champ), false), null, champ)
  assert.equal(pourLeClavier(touche(), element(), true), null, 'sous un dialogue')
  for (const k of ['ctrlKey', 'metaKey', 'altKey', 'defaultPrevented'] as const) assert.equal(pourLeClavier(touche({ [k]: true }), element(), false), null, k)
  // Le clavier les lit sur l'événement même : sa cible, et le dialogue ouvert dans la page.
  assert.match(source('views/cabinet/jeux/MotMystere.tsx'), /pourLeClavier\(e, e\.target instanceof Element \? e\.target : null, !!document\.querySelector\('\[aria-modal="true"\]'\)\)/)
})

test('« Valider » trop tôt dit la longueur dans les mots mêmes du serveur, qui refuse l’essai trop court', async () => {
  // La phrase vit dans la règle du Mot (`shared/cabinet/jeux/mot.ts`), qui ne l'exporte pas encore : la page la recopie, et cette
  // épreuve les tient ensemble — un mot retouché d'un seul côté, la page contredisait le serveur.
  const v = ok(await commencer(b, ines, { origine: 'libre', jeu: 'mot', carte: null }), 'un Mot de plus')
  const m = v.enCours as MotMontre
  const refus = await jouer(b, ines, v, { quoi: 'essai', manche: 0, lettres: 'AB' })
  assert.equal(refus.status, 400)
  const { MOT } = (await import(url('views/cabinet/jeux/MotMystere.tsx'))) as { MOT: { localDe: (m: MotMontre) => object } }
  const html = await laPartie(v, { local: { ...MOT.localDe(m), dit: true } })
  const dit = /<p class="cab-raison cab-longueur" role="status">(.*?)<\/p>/.exec(html)?.[1]
  assert.ok(dit, 'la longueur dite')
  assert.equal(texte(dit).trim(), (refus.corps as unknown as { error: string }).error)
  ok(await jouer(b, ines, v, { quoi: 'quitter' }), 'quitter ce Mot')
})

test('la révélation du Mot : trouvé, ou ce qu’il fallait trouver — la grille de ses essais, la question, « Signaler »', async () => {
  const trouve = vues.motTrouve
  const r = trouve.revelation!.corps as MotRevele
  assert.equal(r.trouve, true)
  const html = await laPartie(trouve)
  const t = texte(html)
  assert.match(html, /class="card result-banner result-ok"/)
  assert.match(t, /Trouvé en 2 essais/)
  assert.match(t, new RegExp(lu(r.texte)))
  // Ses deux essais, colorés comme pendant la manche, la dernière ligne toute bien placée.
  const lignes = [...html.matchAll(/<li class="cab-mot-ligne cab-mot-joue"[^>]*>(.*?)<\/li>/g)].map(x => x[1])
  assert.equal(lignes.length, 2)
  assert.equal([...lignes[1].matchAll(/class="cab-lettre cab-bien"/g)].length, r.lettres.length)
  // Une question de la base : elle se signale.
  assert.match(t, /Signaler une erreur dans cette question/)
  assert.match(t, /Le savais-tu \?/)
  // Jamais trouvé : « C'était… », ses cinq essais, et le mot écrit dessous, marqué comme tel.
  const rate = await laPartie(vues.motRate)
  const tr = texte(rate)
  const corps = vues.motRate.revelation!.corps as MotRevele
  assert.match(rate, /class="card result-banner result-ko"/)
  assert.match(tr, new RegExp(lu(corps.titre)))
  assert.equal([...rate.matchAll(/<li class="cab-mot-ligne cab-mot-joue"/g)].length, ESSAIS_DU_MOT)
  assert.match(rate, new RegExp(`<p class="cab-mot-reponse"><span class="sr-only">Le mot : ${echapper(corps.reponse)}</span>`))
  assert.equal([...rate.matchAll(/<span class="cab-lettre cab-revelee" aria-hidden="true">[A-Z]<\/span>/g)].length, corps.lettres.length)
  // Laissé au temps sans un essai : le bandeau le dit, la grille aussi.
  const expire = texte(await laPartie(vues.motExpire))
  assert.match(expire, /Temps écoulé/)
  assert.match(expire, /Aucun essai/)
  sansJargon(html, 'la révélation du Mot')
})

test('une manche du Filet : la question, la piste et ses bornes, le curseur au milieu, − et +, les trois filets, « Lancer le filet » — jamais la valeur', async () => {
  const v = vues.filet
  const m = v.enCours as FiletMontre
  assert.equal(m.jeu, 'filet')
  const html = await laPartie(v)
  const t = texte(html)
  assert.match(t, new RegExp(lu(m.texte)))
  assert.match(html, /<h2 class="quiz-question cab-question[^"]*">/)
  // La piste : ses deux bornes, telles qu'on les lit.
  const dire = (x: number) => `${formatNumber(x)}${m.unite ? ` ${m.unite}` : ''}`
  assert.match(t, new RegExp(`${enTexte(dire(m.piste.min))} .*${enTexte(dire(m.piste.max))}`))
  // Le curseur, au milieu de la piste, à son pas, dit à l'oreille comme à l'œil.
  const milieu = milieuDeLaPiste(m.piste)
  const curseur = /<input [^>]*type="range"[^>]*>/.exec(html)?.[0] ?? ''
  for (const attribut of [`class="cab-curseur"`, `min="${m.piste.min}"`, `max="${m.piste.max}"`, `step="${m.piste.pas}"`, `value="${milieu}"`, `aria-label="Ton estimation"`, `aria-valuetext="${dire(milieu)}"`]) {
    assert.ok(curseur.includes(attribut), `${attribut} dans ${curseur}`)
  }
  assert.match(html, new RegExp(`<output class="cab-filet-valeur"[^>]*>${echapper(dire(milieu))}</output>`))
  // − et +, un cran chacun, de part et d'autre du curseur.
  assert.match(html, /<button type="button" class="cab-cran" aria-label="Un cran de moins">.*<input [^>]*type="range".*<button type="button" class="cab-cran" aria-label="Un cran de plus">/)
  // Le curseur se pose sur le rail même, entre lui et ses bornes : dessinés l'un sous l'autre, le rail du filet et celui du
  // curseur faisaient deux pistes, et le filet ne suivait pas le doigt (la photo du 25 octobre 2026).
  assert.match(html, /<div class="cab-filet-piste"><div class="cab-filet-rail" aria-hidden="true">(?:(?!<\/div>).)*<\/div><input [^>]*type="range"[^>]*><p class="cab-filet-bornes">/)
  // Les trois filets, chacun ce qu'il rapporte ; l'état par `aria-pressed`, le moyen d'office.
  const tailles = [...html.matchAll(/<button type="button" class="cab-taille" aria-pressed="(true|false)">(.*?)<\/button>/g)]
  assert.deepEqual(
    tailles.map(x => [texte(x[2]).trim(), /aria-label="(\d) étoiles? sur 3"/.exec(x[2])?.[1], x[1]]),
    TAILLES_DU_FILET.map(k => [{ petit: 'Petit', moyen: 'Moyen', grand: 'Grand' }[k], String(ETOILES_DU_FILET[k]), String(k === 'moyen')]),
  )
  // Le filet sous le curseur, à sa largeur, et ce qu'il couvre en mots : les crans de la piste qu'il prend, pas un de plus.
  const { bornesDuFilet } = (await import(url('views/cabinet/jeux/Filet.tsx'))) as { bornesDuFilet: (x: number, taille: TailleDuFilet, piste: FiletMontre['piste']) => { de: number; a: number } }
  const w = demiLargeur('moyen', m.piste)
  const filet = bornesDuFilet(milieu, 'moyen', m.piste)
  assert.ok(filet.de >= milieu - w - 1e-9 && filet.de - m.piste.pas < milieu - w, `de ${filet.de}`)
  assert.ok(filet.a <= milieu + w + 1e-9 && filet.a + m.piste.pas > milieu + w, `à ${filet.a}`)
  assert.match(html, /<span class="cab-filet-maille" style="left:[\d.]+%;width:[\d.]+%"><\/span>/)
  assert.match(t, new RegExp(`Ton filet : de ${enTexte(dire(filet.de))} à ${enTexte(dire(filet.a))}`))
  assert.match(html, /<button type="button" class="btn btn-primary btn-big btn-block cab-lancer">Lancer le filet<\/button>/)
  // Ni la valeur, ni la réponse telle que la base l'écrit. Les nœuds qui disent la piste — ses bornes, le curseur, ce que son
  // filet prend — se relisent mot pour mot ; hors d'eux, aucun nombre de la page n'est la valeur. Cherchée partout, elle se
  // trouvait une fois sur trente dans « Ton filet : de 1666 à 1676 », quand la piste tirée la posait sur un bord du filet (et
  // l'épreuve, qui n'écartait que les bornes et le milieu, échouait sans raison).
  const plan = filetDe(b, v.id, v.tirage!)
  const noeuds = [
    [/<output class="cab-filet-valeur"[^>]*>.*?<\/output>/, dire(milieu)],
    [/<span class="cab-filet-couvre">.*?<\/span>/, `Ton filet : de ${dire(filet.de)} à ${dire(filet.a)}`],
    [/<p class="cab-filet-bornes">.*?<\/p>/, `${dire(m.piste.min)} ${dire(m.piste.max)}`],
  ] as const
  let horsDeLaPiste = html.replace(/<input [^>]*type="range"[^>]*>/, '')
  for (const [noeud, dit] of noeuds) {
    const trouve = noeud.exec(html)?.[0]
    assert.ok(trouve, `${noeud}`)
    assert.equal(texte(trouve).trim(), texte(dit).trim())
    horsDeLaPiste = horsDeLaPiste.replace(trouve, '')
  }
  assert.doesNotMatch(texte(horsDeLaPiste), new RegExp(`(^|\\s)${enTexte(formatNumber(plan.valeur))}(\\s|$)`))
  assert.doesNotMatch(horsDeLaPiste, new RegExp(`"${echapper(String(plan.valeur))}"`), 'ni dans un attribut')
  assert.doesNotMatch(html, /valeur="|data-valeur/)
  sansJargon(html, 'une manche du Filet')
})

test('le Filet en jeu : le curseur et ses crans, le filet choisi, la zone dorée d’Éclairer dite en mots — ce que la page tient part à l’échéance', async () => {
  type Local = { x: number; taille: TailleDuFilet }
  const { FILET, bouger, cran, ouEstLeFilet } = (await import(url('views/cabinet/jeux/Filet.tsx'))) as {
    FILET: { localDe: (m: FiletMontre) => Local; cleDe: (m: FiletMontre) => string; aLEcheance: (m: FiletMontre, l: Local) => unknown }
    bouger: (m: FiletMontre, l: Local, x: number) => Local
    cran: (m: FiletMontre, l: Local, sens: 1 | -1) => Local
    ouEstLeFilet: (x: number, taille: TailleDuFilet, piste: FiletMontre['piste']) => { de: number; a: number }
  }
  const m = vues.filet.enCours as FiletMontre
  const p = m.piste
  const depart = FILET.localDe(m)
  assert.deepEqual(depart, { x: milieuDeLaPiste(p), taille: 'moyen' })
  // Un cran : un pas, jamais hors de la piste ; le curseur se pose sur un pas.
  assert.equal(cran(m, depart, 1).x, Number((depart.x + p.pas).toFixed(6)))
  assert.equal(cran(m, bouger(m, depart, p.max), 1).x, p.max)
  assert.equal(cran(m, bouger(m, depart, p.min), -1).x, p.min)
  assert.equal(bouger(m, depart, p.max + 1000).x, p.max)
  assert.equal(bouger(m, depart, p.min + p.pas * 2.4).x, Number((p.min + p.pas * 2).toFixed(6)))
  // La page ne tient que le curseur et son filet : rien n'y dit s'il y a touché, l'échéance envoie ce qu'il a sous les yeux.
  assert.deepEqual(Object.keys(cran(m, depart, -1)).sort(), ['taille', 'x'])
  // Le filet sur la piste, en pour cent, coupé à ses bords.
  const auBord = ouEstLeFilet(p.min, 'grand', p)
  assert.equal(auBord.de, 0)
  assert.ok(auBord.a > 0 && auBord.a <= 100)
  // À l'échéance : le curseur et le filet qu'il a sous les yeux, au milieu et moyen s'il n'y a pas touché — la maquette lançait
  // au temps écoulé. « Lancer le filet » touché d'emblée joue le même lancer : le refuser ne fermait rien, et « Pas de lancer »
  // punissait qui laissait le curseur là où il croyait la réponse.
  assert.deepEqual(FILET.aLEcheance(m, depart), { filet: { x: milieuDeLaPiste(p), taille: 'moyen' } })
  const vise = { ...cran(m, depart, 1), taille: 'petit' as const }
  assert.deepEqual(FILET.aLEcheance(m, vise), { filet: { x: vise.x, taille: 'petit' } })
  // Le petit choisi : il est pressé, les deux autres non.
  const html = await laPartie(vues.filet, { local: vise })
  assert.deepEqual([...html.matchAll(/class="cab-taille" aria-pressed="(true|false)"/g)].map(x => x[1]), ['true', 'false', 'false'])
  assert.match(html, new RegExp(`value="${vise.x}"`))
  // Éclairé : la zone dorée sur la piste, et, en mots, entre quoi et quoi la réponse se trouve — dite aux crans de la piste, vers
  // l'extérieur : arrondie au plus près, elle aurait pu laisser la réponse dehors.
  const { bornesDeLaZone } = (await import(url('views/cabinet/jeux/Filet.tsx'))) as { bornesDeLaZone: (z: { de: number; a: number }, piste: FiletMontre['piste']) => { de: number; a: number } }
  const eclaire = vues.filetEclaire.enCours as FiletMontre
  assert.ok(eclaire.zone, 'Éclairer a doré une zone')
  const zone = bornesDeLaZone(eclaire.zone, eclaire.piste)
  const valeur = filetDe(b, vues.filetEclaire.id, vues.filetEclaire.tirage!).valeur
  assert.ok(zone.de <= valeur && valeur <= zone.a, `${valeur} dans ${zone.de}-${zone.a}`)
  assert.ok(zone.de <= eclaire.zone.de && zone.a >= eclaire.zone.a)
  const z = await laPartie(vues.filetEclaire)
  assert.match(z, /<span class="cab-filet-zone" style="left:[\d.]+%;width:[\d.]+%"><\/span>/)
  const direZ = (x: number) => `${formatNumber(x)}${eclaire.unite ? ` ${eclaire.unite}` : ''}`
  assert.match(texte(z), new RegExp(`Indice : la réponse est entre ${enTexte(direZ(zone.de))} et ${enTexte(direZ(zone.a))}\\.`))
  assert.equal(FILET.cleDe(eclaire), FILET.cleDe(m))
  assert.notEqual(FILET.cleDe(vues.filetChange.enCours as FiletMontre), FILET.cleDe(vues.filetEchange.enCours as FiletMontre), '« Changer » pose une autre question')
  sansJargon(z, 'le Filet éclairé')
})

test('la révélation du Filet : dans le filet, à côté, pas de lancer — la piste, le filet lancé, la vraie valeur', async () => {
  const dedans = vues.filetDedans
  const r = dedans.revelation!.corps as FiletRevele
  const dire = (x: number) => `${formatNumber(x)}${r.unite ? ` ${r.unite}` : ''}`
  const html = await laPartie(dedans)
  const t = texte(html)
  assert.match(html, /class="card result-banner result-ok"/)
  assert.match(t, /Dans le filet/)
  assert.match(t, new RegExp(`La réponse : ${enTexte(dire(r.valeur))} · tu visais ${enTexte(dire(r.lancer!.x))}`))
  assert.match(html, /<span class="cab-filet-vrai" style="left:[\d.]+%"><\/span>/)
  assert.match(html, /<span class="cab-filet-maille" style="left:[\d.]+%;width:[\d.]+%"><\/span>/)
  assert.match(t, /Le petit filet/)
  assert.match(t, /Signaler une erreur dans cette question/)
  // À côté : le bandeau rouge, le filet qu'il avait lancé, la réponse.
  const cote = await laPartie(vues.filetACote)
  assert.match(cote, /class="card result-banner result-ko"/)
  assert.match(texte(cote), /À côté/)
  assert.match(texte(cote), /Le grand filet/)
  // Laissé au temps sans y toucher : pas de lancer, la réponse quand même.
  const sans = texte(await laPartie(vues.filetSansLancer))
  const rs = vues.filetSansLancer.revelation!.corps as FiletRevele
  assert.match(sans, /Pas de lancer/)
  assert.match(sans, /Temps écoulé/)
  assert.match(sans, new RegExp(`La réponse : ${echapper(`${formatNumber(rs.valeur)}${rs.unite ? ` ${rs.unite}` : ''}`)}`))
  assert.doesNotMatch(sans, /tu visais/)
  sansJargon(html, 'la révélation du Filet')
})

test('les écrans du Mot et du Filet : à la demande, de leurs règles des types et ce qui ne juge pas, sans l’heure du téléphone, le clavier de l’ordinateur, la ligne en cours ramenée au-dessus du clavier', () => {
  const partie = source('views/cabinet/Partie.tsx')
  assert.match(partie, /mot: aLaDemande\(\(\) => import\('\.\/jeux\/MotMystere'\)/)
  assert.match(partie, /filet: aLaDemande\(\(\) => import\('\.\/jeux\/Filet'\)/)
  // Le pied du jeu — le clavier du Mot — se colle au bas de l'écran avec la carte-bonus, par le cadre.
  assert.match(partie, /Pied\?\(p: PropsDUneManche<M, L>\): ReactNode/)
  for (const [jeu, regle, valeurs] of [
    ['MotMystere', 'mot', ['etatDesTouches']],
    ['Filet', 'filet', ['TAILLES_DU_FILET', 'demiLargeur', 'milieuDeLaPiste']],
  ] as const) {
    const s = source(`views/cabinet/jeux/${jeu}.tsx`)
    const deLaRegle = new RegExp(`import \\{([^}]*)\\} from '\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./shared/cabinet/jeux/${regle}'`).exec(s)
    assert.ok(deLaRegle, `${jeu}.tsx importe sa règle`)
    const importees = deLaRegle[1]
      .split(',')
      .map(x => x.trim())
      .filter(x => x && !x.startsWith('type '))
    assert.deepEqual(importees.sort(), [...valeurs].sort(), `${jeu} : rien de ce qui juge`)
    const chemin = importsStatiques(path.join(client, `views/cabinet/jeux/${jeu}.tsx`))
    for (const f of ['shared/cabinet/partie.ts', 'shared/cabinet/jeux/index.ts', 'shared/cabinet/lecture.ts']) {
      assert.ok(!chemin.has(path.resolve(client, '../..', f)), `${f} ne part pas avec l’écran ${jeu}`)
    }
    const code = s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    assert.doesNotMatch(code, /Date\.now\(\)/, jeu)
    assert.doesNotMatch(s, /autoFocus/, jeu)
    // Un chiffre du barème s'importe, il ne se recopie pas.
    assert.doesNotMatch(code, /★|\b[1-5] essais?\b/, jeu)
    assert.match(s, /export const \w+: JeuALEcran</, jeu)
  }
  const mot = source('views/cabinet/jeux/MotMystere.tsx')
  // Dès le deuxième essai, la ligne en cours revient au milieu de l'écran, au-dessus du clavier collé.
  assert.match(mot, /if \(m\.essais\.length === 0\) return/)
  assert.match(mot, /scrollIntoView\(\{ block: 'center'/)
  // Le clavier de l'ordinateur, posé le temps de la manche, et retiré.
  assert.match(mot, /window\.addEventListener\('keydown', clavier\)/)
  assert.match(mot, /return \(\) => window\.removeEventListener\('keydown', clavier\)/)
})

test('la feuille du Mot et du Filet : le clavier de trois rangées de 44 px, − et + de 44 px, une piste qu’on prend au doigt, les nombres en chiffres droits', () => {
  const section = sectionDuCabinet()
  assert.match(section, /\.cab-touche \{[^}]*height: 44px;/)
  assert.match(section, /\.cab-clavier \{[^}]*gap: 6px;/)
  assert.match(section, /\.cab-cran \{[^}]*width: 44px; height: 44px;/)
  // La piste se prend du doigt sur toute sa hauteur : 44 px au moins, le pouce n'attrape pas un trait de 4.
  assert.match(section, /\.cab-curseur \{[^}]*height: 44px;/)
  // Son bouton est un mât, mince, au milieu du filet : rond de 28 px, il cachait le petit filet d'une piste de 3000 km (14 px).
  // Le rail laisse à chaque bout la moitié du mât, sans quoi le filet dessiné ne restait pas centré sous lui.
  const mat = /\.cab-curseur::-webkit-slider-thumb \{[^}]*width: (\d+)px; height: (\d+)px;/.exec(section)
  assert.ok(mat, 'le bouton du curseur a sa taille')
  assert.ok(Number(mat[1]) <= 12 && Number(mat[2]) >= 36 && Number(mat[2]) <= 44, `un mât : ${mat[1]} × ${mat[2]}`)
  assert.match(section, new RegExp(`\\.cab-filet-rail \\{[^}]*margin: 0 ${Number(mat[1]) / 2}px;`))
  // Cormorant écrit ses chiffres à l'ancienne (règle `css.md`) : la valeur visée et les bornes de la piste posent leurs chiffres droits.
  for (const sel of ['.cab-filet-valeur', '.cab-filet-bornes']) {
    const regle = new RegExp(`(?:^|\\n)${echapper(sel)} \\{([^}]*)\\}`).exec(section)
    assert.ok(regle, `${sel} a sa règle`)
    assert.match(regle[1], /font-variant-numeric: lining-nums tabular-nums/, sel)
  }
  // Une touche se tape vite : ni double-toucher qui zoome, ni texte qui se surligne.
  assert.match(section, /\.cab-touche \{[^}]*touch-action: manipulation;[^}]*user-select: none;/)
  // Le chrono de la tête, sous la ligne des manches, arrive au bas de la niche : ses secondes s'arrêtent avant elle (la photo du
  // 25 octobre 2026 : « 120 » sous la luciole, à chaque manche, dans tous les jeux).
  const css = readFileSync(path.join(client, 'styles.css'), 'utf8')
  assert.match(css, /body\.avec-niche \.cab-tete-partie \.timer \{ padding-right: var\(--niche-place\); \}/)
})

/** La section du Cabinet dans la feuille, sans ses commentaires. */
function sectionDuCabinet() {
  const css = readFileSync(path.join(client, 'styles.css'), 'utf8')
  const debut = css.indexOf('/* ── Le Cabinet de curiosités')
  return css.slice(debut, css.indexOf('/* ── ', debut + 10)).replace(/\/\*[\s\S]*?\*\//g, '')
}

test('l’inversion d’un intitulé se lit telle quelle : le gluon que `espacesFines` y pose s’efface à la lecture du rendu', () => {
  assert.match(espacesFines('Que cache-t-il ?'), /\u2060/)
  assert.match(texte(espacesFines('Que cache-t-il ?')), /Que cache-t-il \?/)
})

// ── 18. Un gardien qui s'éveille ──────────────────────────────────────────

test('ce qui réveille un gardien, en mots : la salle complète, la salle dorée, le Cabinet entier, la série, la fête — et qui veillait déjà', async () => {
  const { ceQuiLeReveille, veillaitDeja, seReveille } = (await import(url('views/cabinet/reveils.ts'))) as {
    ceQuiLeReveille: (l: string) => string | null
    veillaitDeja: (l: string) => string
    seReveille: (l: string) => string
  }
  const [chouette, lion] = GARDIENS_DES_SALLES.erudit
  assert.equal(ceQuiLeReveille(chouette), 'Salle complète !')
  assert.equal(ceQuiLeReveille(lion), 'Salle toute dorée !')
  assert.equal(ceQuiLeReveille('lg:trou-noir'), 'Le Cabinet entier !')
  assert.equal(ceQuiLeReveille('lg:scarabee'), `${JOURS_DU_SCARABEE} jours d’affilée !`)
  assert.equal(ceQuiLeReveille('lg:citrouille'), 'Une œuvre gagnée pendant Halloween !')
  assert.equal(ceQuiLeReveille('lg:bouquet'), 'Une œuvre gagnée pendant le Nouvel An !')
  // Un légendaire que des paliers ouvrent, un Divin : ce n'est pas un gardien, rien à dire.
  assert.equal(ceQuiLeReveille('lg:licorne'), null)
  assert.equal(ceQuiLeReveille('dv:chronos'), null)
  // Déjà à lui par une autre voie : la phrase du bilan, sur ce qu'il garde.
  assert.equal(veillaitDeja('lg:phenix'), `Salle complète ! ${nom('lg:phenix')} veillait déjà sur elle.`)
  assert.equal(veillaitDeja(lion), `Salle toute dorée ! ${nom(lion)} veillait déjà sur elle.`)
  assert.equal(veillaitDeja('lg:trou-noir'), `Le Cabinet entier ! ${nom('lg:trou-noir')} veillait déjà sur lui.`)
  assert.equal(veillaitDeja('lg:scarabee'), `${JOURS_DU_SCARABEE} jours d’affilée ! ${nom('lg:scarabee')} veillait déjà sur toi.`)
  assert.equal(seReveille(chouette), `Salle complète ! ${nom(chouette)} se réveille.`)
})

test('un gardien qui s’éveille : en grand s’il est neuf, une ligne s’il veillait déjà, la luciole qui rejoint — et rien d’un Divin', async () => {
  const { GardiensQuiSEveillent } = (await import(url('views/cabinet/Reveil.tsx'))) as {
    GardiensQuiSEveillent: (p: { neufs: string[]; parLeCabinet: string[]; veillaient: string[]; compagnon?: string }) => React.ReactNode
  }
  const { fondreDesReveils } = (await import(url('views/cabinet/reveils.ts'))) as {
    fondreDesReveils: (a: ReveilDesGardiens | null | undefined, b: ReveilDesGardiens | null | undefined) => ReveilDesGardiens | null
  }
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html = renderToStaticMarkup(React.createElement(GardiensQuiSEveillent, { neufs: ['lg:oracle'], parLeCabinet: ['lg:oracle'], veillaient: ['lg:phenix', 'lg:scarabee'], compagnon: COMPAGNON_DE_L_EXPEDITION }))
  const t = texte(html)
  // Ceux qui veillaient, une ligne chacun ; le neuf, sa raison puis en grand — on le porte d'ici ; la luciole, qui s'installe.
  assert.match(t, new RegExp(`Salle complète ! ${lu(nom('lg:phenix'))} veillait déjà sur elle\\. .*${JOURS_DU_SCARABEE} jours d’affilée ! ${lu(nom('lg:scarabee'))} veillait déjà sur toi\\.`))
  assert.match(t, new RegExp(`Salle toute dorée ! ${lu(nom('lg:oracle'))} se réveille\\. Avatar légendaire débloqué`))
  assert.equal([...html.matchAll(/class="card fin-legendaire"/g)].length, 1)
  assert.match(html, /class="card fin-legendaire fin-compagnon"/)
  assert.match(t, new RegExp(`Ta première salle complète .*${lu(leCompagnon(COMPAGNON_DE_L_EXPEDITION)!.nom)} te rejoint`))
  assert.doesNotMatch(html, /dv:|Divin/)
  sansJargon(html, 'un gardien qui s’éveille')
  // Deux réveils qui se suivent avant qu'on ait lu le premier : les deux, chacun une fois, neuf s'il l'était dans l'un.
  assert.deepEqual(
    fondreDesReveils({ gardiens: [{ legendaire: 'lg:phenix', neuf: false }] }, { gardiens: [{ legendaire: 'lg:phenix', neuf: true }, { legendaire: 'lg:oracle', neuf: true }], compagnon: COMPAGNON_DE_L_EXPEDITION }),
    { gardiens: [{ legendaire: 'lg:phenix', neuf: true }, { legendaire: 'lg:oracle', neuf: true }], compagnon: COMPAGNON_DE_L_EXPEDITION },
  )
  const seul = { gardiens: [{ legendaire: 'lg:phenix', neuf: true }] }
  assert.equal(fondreDesReveils(null, seul), seul)
  assert.equal(fondreDesReveils(seul, undefined), seul)
  assert.equal(fondreDesReveils(null, undefined), null)
})

test('la dorure qui réveille un gardien le dit, par le vrai serveur : la page qui revient porte son réveil, la page l’annonce en grand, une fois', async () => {
  assert.deepEqual(pageDuReveil.reveil, { gardiens: [{ legendaire: GARDIENS_DES_SALLES.devin[1], neuf: true }] })
  const html = await rendu('views/cabinet/Reveil', 'AnnonceDuReveil', { reveil: pageDuReveil.reveil, onFermer: rien })
  const t = texte(html)
  assert.match(html, /role="dialog" aria-modal="true" aria-label="Un gardien se réveille"/)
  assert.match(t, new RegExp(`Salle toute dorée ! ${lu(nom(GARDIENS_DES_SALLES.devin[1]))} se réveille\\.`))
  assert.match(html, /class="card fin-legendaire"/)
  assert.match(html, /<button type="button" class="btn btn-primary btn-big btn-block">Continuer<\/button>/)
  // La page suivante ne le redit pas : le serveur ne le porte qu'une fois.
  assert.equal(ok(await laPage(b, ilse), 'la page d’après').reveil, undefined)
  // La page le garde de chaque page qui le porte — la réponse d'une dépense, ou la page d'après une partie d'hier close —, jusqu'à
  // ce qu'on le ferme ; et ne l'ouvre jamais par-dessus une partie : le chrono y courrait sous la feuille.
  const app = source('views/CabinetApp.tsx')
  assert.match(app, /const recevoir = useCallback\(\(p: PageDuCabinet\) => \{\s*setEtat\(\{ e: 'pret', page: p \}\)\s*if \(p\.reveil\) setReveil\(r => fondreDesReveils\(r, p\.reveil\)\)/)
  assert.match(app, /import \{ fondreDesReveils \} from '\.\/cabinet\/reveils'/)
  assert.match(app, /p => recevoir\(p\)/)
  assert.match(app, /recevoir\(await geste\(\)\)/)
  assert.match(app, /\{reveil && !enPartie && <ReveilALaDemande reveil=\{reveil\} onFermer=\{\(\) => setReveil\(null\)\} \/>\}/)
  assert.match(app, /const LE_REVEIL = aLaDemande\(\(\) => import\('\.\/cabinet\/Reveil'\)\)/)
  sansJargon(html, 'l’annonce d’un réveil')
})

test('au bilan, le gardien qui veillait déjà se dit par ce qui l’a réveillé, et la luciole rejoint', async () => {
  const ecran = (await ecrans()).pari
  const g = vues.gagnee
  const vue = { ...g, bilan: { ...g.bilan!, gardiens: [{ legendaire: 'lg:scarabee', neuf: false }], gains: { ...g.bilan!.gains!, compagnon: COMPAGNON_DE_L_EXPEDITION } } } as VueDeLaPartie
  const html = await rendu('views/cabinet/Bilan', 'BilanDeLaPartie', { vue, ecran, onMusee: rien })
  const t = texte(html)
  // Trente jours d'affilée ne font pas une salle complète : « Salle complète ! » s'y écrivait pour tout gardien qui veillait.
  assert.match(t, new RegExp(`${JOURS_DU_SCARABEE} jours d’affilée ! ${lu(nom('lg:scarabee'))} veillait déjà sur toi\\.`))
  assert.doesNotMatch(t, /Salle complète/)
  assert.match(html, /class="card fin-legendaire fin-compagnon"/)
  // Avant les gains, comme le gardien neuf.
  assert.ok(html.indexOf('fin-compagnon') < html.indexOf('class="card gains"'))
  assert.match(source('views/cabinet/Bilan.tsx'), /<GardiensQuiSEveillent /)
})

test('au bilan, seul ce que le Cabinet a réveillé dit sa raison : un légendaire qu’un palier ouvre — la Chimère, par L’Alpiniste — montre sa carte seule', async () => {
  const ecran = (await ecrans()).pari
  const g = vues.gagnee
  // Les légendaires du bilan mêlent les gardiens neufs et ceux que les paliers ouvrent (`GainsDuCabinet.legendaires`) : les
  // vingt-trois ont d'autres voies, et la raison se déduisait de la seule clé — la Chimère d'un palier s'y disait réveillée par
  // une salle toute dorée.
  const avec = (gardiens: { legendaire: string; neuf: boolean }[]) =>
    ({ ...g, bilan: { ...g.bilan!, gardiens, gains: { ...g.bilan!.gains!, legendaires: ['lg:chimere'] } } }) as VueDeLaPartie
  const duPalier = texte(await rendu('views/cabinet/Bilan', 'BilanDeLaPartie', { vue: avec([]), ecran, onMusee: rien }))
  assert.match(duPalier, new RegExp(`Avatar légendaire débloqué .*${lu(nom('lg:chimere'))}`))
  assert.doesNotMatch(duPalier, /se réveille|Salle toute dorée|Salle complète/)
  // Réveillée par le Cabinet — le serveur le dit (`BilanVu.gardiens`, `neuf`) —, sa raison au-dessus d'elle.
  const duCabinet = texte(await rendu('views/cabinet/Bilan', 'BilanDeLaPartie', { vue: avec([{ legendaire: 'lg:chimere', neuf: true }]), ecran, onMusee: rien }))
  assert.match(duCabinet, new RegExp(`Salle toute dorée ! ${lu(nom('lg:chimere'))} se réveille\\. Avatar légendaire débloqué`))
  // Le profil se relit après la partie dès qu'elle a rapporté quelque chose — la luciole seule comprise : la niche de la page la prend.
  const { aRelireApresLaPartie } = (await import(url('views/cabinet/Bilan.tsx'))) as { aRelireApresLaPartie: (g: object | undefined) => boolean }
  assert.ok(aRelireApresLaPartie({ xp: 0, confettis: 0, compagnon: COMPAGNON_DE_L_EXPEDITION }))
  assert.ok(aRelireApresLaPartie({ xp: 0, confettis: 0, recompenses: [{ key: 'hf:alpiniste' }] }))
  assert.ok(aRelireApresLaPartie({ xp: 12, confettis: 0 }))
  assert.ok(!aRelireApresLaPartie({ xp: 0, confettis: 0 }))
  assert.ok(!aRelireApresLaPartie(undefined))
})

test('deux réveils se fondent à la page comme au serveur : chaque gardien une fois, neuf s’il l’était dans l’un, la première luciole', async () => {
  // Deux copies d'une même dérivation, tant que `shared/cabinet/` n'en a pas une seule : l'une évoluée seule, la page et le serveur
  // ne fondaient plus deux réveils de la même façon.
  const { fondreLesReveils } = await import('../src/core/cabinet/gardiens')
  const { fondreDesReveils } = (await import(url('views/cabinet/reveils.ts'))) as {
    fondreDesReveils: (a: ReveilDesGardiens | null | undefined, b: ReveilDesGardiens | null | undefined) => ReveilDesGardiens | null
  }
  const phenix = { gardiens: [{ legendaire: 'lg:phenix', neuf: false }] }
  const deux = { gardiens: [{ legendaire: 'lg:phenix', neuf: true }, { legendaire: 'lg:oracle', neuf: true }], compagnon: COMPAGNON_DE_L_EXPEDITION }
  const scarabee = { gardiens: [{ legendaire: 'lg:scarabee', neuf: true }] }
  const cas: [ReveilDesGardiens | null, ReveilDesGardiens | null][] = [
    [phenix, deux],
    [deux, phenix],
    [scarabee, deux],
    [deux, deux],
    [phenix, null],
    [null, scarabee],
    [null, null],
  ]
  for (const [x, y] of cas) assert.deepEqual(fondreDesReveils(x, y) ?? undefined, fondreLesReveils(x, y), JSON.stringify([x, y]))
})

test('la luciole qu’annonce la page d’un achat s’installe dans la niche de la page, par le vrai serveur : la feuille la promet « en haut de chaque page »', async () => {
  // Lou n'a pas de compagnon, et toute la salle de l'Érudit sauf une œuvre : l'acheter complète sa première salle.
  const lou = await inscrireProfil(b.banc.url, 'lou', 'Lou')
  const id = (await lire(b, lou, '/api/joueur/moi?leger')).corps.profile.id as string
  const erudit = oeuvresDeLaSalle('erudit').filter(o => !OEUVRES_DE_DEPART.includes(o.cle))
  const aAcheter = erudit.find(o => o.rarete === 'commun')!
  const lignes = erudit.filter(o => o.cle !== aAcheter.cle).map(o => `('${id}', '${o.cle}', 'partie', 0, NULL, NULL)`)
  aLaMain(b.fichier, `INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le, doree_le, dorure) VALUES ${lignes.join(', ')}`)
  const prix = PRIX_D_UNE_OEUVRE[aAcheter.rarete]
  aLaMain(b.fichier, `INSERT INTO cabinet_profils (profile_id, poussiere, cree_le, maj_le) VALUES ('${id}', ${prix}, 0, 0)`)
  assert.equal(ok(await laPage(b, lou), 'la page de Lou').reveil, undefined, 'la salle n’est pas encore complète')
  const { api } = await import(url('api.ts'))
  const { nicheApresLeReveil } = (await import(url('views/CabinetApp.tsx'))) as { nicheApresLeReveil: (p: Pick<PageDuCabinet, 'reveil'>) => Promise<void> }
  const niche = (await import(url('niche.ts'))) as { nicheActuelle: () => { compagnon: string; rang: number } | null }
  const avant = globalThis.fetch
  // La page parle au serveur par des adresses relatives, avec son cookie : le banc les lui prête.
  globalThis.fetch = ((u: string, init: RequestInit = {}) => avant(`${b.banc.url}${u}`, { ...init, headers: { ...(init.headers as object), Cookie: lou } })) as typeof fetch
  try {
    const achetee = (await api.cabinet.acheter(aAcheter.cle, prix)) as PageDuCabinet
    assert.deepEqual(achetee.reveil, { gardiens: [{ legendaire: GARDIENS_DES_SALLES.erudit[0], neuf: true }], compagnon: COMPAGNON_DE_L_EXPEDITION })
    assert.notEqual(niche.nicheActuelle()?.compagnon, COMPAGNON_DE_L_EXPEDITION, 'la niche de la page ne la connaît pas encore')
    // La page relit le profil léger, comme une fin de partie : le serveur l'a installée dans la niche vide (`offrirUnCompagnon`).
    await nicheApresLeReveil(achetee)
    assert.equal(niche.nicheActuelle()?.compagnon, COMPAGNON_DE_L_EXPEDITION)
    assert.equal(niche.nicheActuelle()?.rang, 0)
    // Une page sans luciole ne relit rien.
    let lus = 0
    const compter = globalThis.fetch
    globalThis.fetch = ((u: string, init?: RequestInit) => (lus++, compter(u, init))) as typeof fetch
    await nicheApresLeReveil({ reveil: { gardiens: [{ legendaire: 'lg:phenix', neuf: true }] } })
    await nicheApresLeReveil({})
    assert.equal(lus, 0)
  } finally {
    globalThis.fetch = avant
  }
  // Chaque page neuve qui la porte la fait relire : celle d'un achat, d'une dorure, de la partie d'hier close.
  assert.match(source('views/CabinetApp.tsx'), /if \(p\.reveil\) setReveil\(r => fondreDesReveils\(r, p\.reveil\)\)\s+void nicheApresLeReveil\(p\)/)
})
