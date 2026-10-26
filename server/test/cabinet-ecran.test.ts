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
  departEnBase,
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
import { contraste, surFond, teinte, themesDuClient } from './teintes'
import {
  CHASSES_PAR_JOUR,
  ERREURS_D_UN_OUBLI,
  ESSAIS_DU_MOT,
  ETOILES_AU_CADRAGE,
  ETOILES_D_UNE_PARTIE,
  ETOILES_DU_FILET,
  ETOILES_DU_PARI,
  GRACE_D_UNE_MANCHE_MS,
  JOURS_DU_SCARABEE,
  LIBRES_QUI_PAIENT,
  PRIX_D_UNE_DORURE,
  PRIX_D_UNE_OEUVRE,
  SEUILS_DES_RARETES,
} from '../../shared/cabinet/bareme'
import { QUESTION_DU_TABLEAU, adresseDUnCadrage, type DetailMontre, type DetailRevele } from '../../shared/cabinet/jeux/detail'
import { TAILLES_DU_FILET, demiLargeur, milieuDeLaPiste, pisteDuFilet, type FiletMontre, type FiletRevele, type TailleDuFilet } from '../../shared/cabinet/jeux/filet'
import { etatDesTouches, type MotMontre, type MotRevele } from '../../shared/cabinet/jeux/mot'
import type { FriseMontree, FriseRevelee } from '../../shared/cabinet/jeux/frise'
import { anneeDite } from '../../shared/frise'
import { CLES_DES_JEUX, JEUX, MOTS_DU_PARI, type CleDeJeu } from '../../shared/cabinet/jeux/regle'
import { JEU_PAS_LIVRE, PLUS_DE_CHASSE, SON_OEUVRE_EST_A_TOI, laPartieAttend, museeDe, type CaseFigee, type PartieDuJour, type VisiteDuJour } from '../../shared/cabinet/musee'
import { JEU_DE_L_OEUVRE, OEUVRES, OEUVRES_DE_DEPART, RARETES, estUneOeuvre, oeuvre as oeuvreDe, oeuvresDeLaSalle } from '../../shared/cabinet/oeuvres'
import { JEUX_PRETS } from '../../shared/cabinet/ouverture'
import { PLUS_DE_PAUSE, type Manche } from '../../shared/cabinet/partie'
import { POUVOIRS, ceQueFaitLaCarte, forceDite } from '../../shared/cabinet/pouvoirs'
import { GARDIENS, GARDIENS_DES_SALLES, SALLES } from '../../shared/cabinet/salles'
import { fondreLesReveils, type CaseVue, type Cartel, type PageDuCabinet, type ReveilDesGardiens, type SalleVue, type VueDeLaPartie } from '../../shared/cabinet/vues'
import { COMPAGNON_DE_L_EXPEDITION, compagnon as leCompagnon } from '../../shared/compagnons'
import { DEPART, donneesDeDepart } from '../../shared/depart'
import { parseRoute } from '../../shared/adresses'
import { GLOSSAIRE } from '../../shared/glossaire'
import { legendaire } from '../../shared/legendaires'
import { pageDeLAdresse } from '../../shared/maintenance'
import { espacesFines, formatNumber } from '../../shared/typographie'
import { CABINET_SANS_PROFIL } from '../src/cabinet'
import type { LectureDeLAccueil } from '../src/core/cabinet/magasin'
import { accueilDuCabinet } from '../src/core/cabinet/vue'

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
 * Ce que l'œil lit d'un rendu, sans ce qui ne se dit qu'à l'oreille (`.sr-only`) : un barème en étoiles se montre en glyphes et
 * se dit en mots (`EnEtoiles.tsx`), et `texte()` lisait les deux à la suite — « ★★ 2 étoiles ». Les glyphes sortent de leur
 * balise sans blanc de plus : « ★★, ou tu paries », comme l'œil le lit, pas « ★★ , ».
 */
const aLOeil = (html: string) => texte(html.replace(/<span class="sr-only">[^<]*<\/span>/g, '').replace(/<span aria-hidden="true">(★+)<\/span>/g, '$1'))

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

/**
 * La page du vrai serveur, un jeu pas encore livré : les neuf le sont, et l'écran d'une œuvre « bientôt » — son cadre vide, la
 * chasse qui attend, la raison dans l'ordre du serveur — se rend sur la page qu'un serveur sans ce jeu aurait rendue (`vue.ts` :
 * `bientot` sur ses œuvres et sur ses cases, `jeux` sans lui). Un dixième jeu y passerait de même.
 */
const sansLeJeu = (p: PageDuCabinet, jeu: CleDeJeu): PageDuCabinet => ({
  ...p,
  salles: p.salles.map(s => ({ ...s, oeuvres: s.oeuvres.map(o => (o.jeu === jeu ? { ...o, bientot: true as const } : o)) })),
  visite: { ...p.visite, cases: p.visite.cases.map(c => (c.jeu === jeu ? { ...c, bientot: true as const } : c)) },
  jeux: p.jeux.filter(j => j !== jeu),
})
/** L'Épingle pas encore livrée : Coup d'œil, à elle dès son arrivée, s'y trouve. */
const sansLEpingle = (p: PageDuCabinet = page) => sansLeJeu(p, 'epingle')

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
    { e: 'murs' },
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
  rendu('views/cabinet/Musee', 'Musee', { page: p, bienvenue: false, onRegles: rien, onReprendre: rien, onBienvenueLue: rien, ...plus })

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
  // Tes murs ont leur porte au musée : seules les règles y menaient, d'un lien au milieu d'un paragraphe.
  assert.match(html, /<a class="gros-bouton" href="#murs">.*?Tes murs.*?<\/a>/)
  assert.match(t, /Comment ça marche/)
  // Le prochain gardien : la salle la plus près d'être complète, et ce qui lui manque.
  assert.ok(page.gardiens.prochain)
  assert.match(t, new RegExp(page.gardiens.prochain.dit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  sansJargon(html, 'le musée')
})

test('le musée dit une fois la bienvenue, la partie qui l’attend, l’expédition en route, sa fête et sa série — et aucune œuvre rapportée', async () => {
  // Une joueuse qui arrive : la bienvenue, et les règles à un toucher.
  const bienvenue = texte(await musee(neuf, { bienvenue: true }))
  assert.match(bienvenue, /Bienvenue au Cabinet/)
  assert.match(bienvenue, /Comment ça marche/)
  assert.doesNotMatch(texte(await musee(neuf)), /Bienvenue au Cabinet/)
  // Tout le monde commence le Cabinet vide, ses quatre œuvres offertes à l'arrivée : l'Expédition n'y rapporte rien (le choix du
  // propriétaire du 25 octobre 2026). Le musée n'a plus d'œuvres rapportées à annoncer, et ne lit plus leur compte — même d'une page
  // d'un serveur d'avant qui le porterait encore.
  const davant = { ...neuf, rapportees: 41 }
  for (const p of [neuf, davant]) assert.doesNotMatch(texte(await musee(p, { bienvenue: true })), /rapporté|de l’Expédition/)
  assert.doesNotMatch(source('views/cabinet/Musee.tsx'), /rapportees/)
  // Le serveur ne le porte plus non plus : un zéro gardé pour une annonce que plus personne ne lit (`PageDuCabinet`, `pageDuCabinet`).
  assert.equal('rapportees' in neuf, false)
  assert.equal('rapportees' in page, false)
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
  // Un jeu pas encore livré le dit — l'œuvre de la salle qui s'y trouve, lue de la règle : les jeux se sont ouverts un à un, et
  // les neuf le sont ; la page d'un serveur sans les Indices (`sansLeJeu`) a l'Encyclopédie de l'Érudit « bientôt ».
  const sansLesIndices = sansLeJeu(page, 'indices')
  const bientot = salleDe(sansLesIndices, 'erudit').oeuvres.find(o => !o.possedee && !sansLesIndices.jeux.includes(JEU_DE_L_OEUVRE[o.cle]))
  assert.ok(bientot, 'une œuvre de l’Érudit à un jeu pas encore livré')
  assert.ok(!sansLesIndices.jeux.includes(JEU_DE_L_OEUVRE[bientot.cle]))
  const cadre = new RegExp(`<a class="cab-oeuvre[^"]*" href="#oeuvre-${bientot.cle}"[^>]*>.*?</a>`).exec(await laSalle(salleDe(sansLesIndices, 'erudit')))?.[0] ?? ''
  assert.match(texte(cadre), new RegExp(`${JEUX[JEU_DE_L_OEUVRE[bientot.cle]].a} .*bientôt`))
  // Livré, le même cadre ne le dit plus.
  assert.doesNotMatch(texte(new RegExp(`<a class="cab-oeuvre[^"]*" href="#oeuvre-${bientot.cle}"[^>]*>.*?</a>`).exec(html)?.[0] ?? ''), /bientôt/)
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
  // Le Phénix gardé au bout d'une expédition veille déjà sur le Rempart : « réveillé », et rien à promettre dessous.
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
  // La rejouer pour la dorer : son jeu, une chasse — l'Épingle pas encore livrée, la page le dit ; livrée, elle se tait.
  const sansElle = sansLEpingle(pauvre)
  assert.ok(!sansElle.jeux.includes('epingle'))
  const coupSansElle = texte(await lOeuvre('coup-d-oeil', {}, sansElle))
  assert.match(coupSansElle, new RegExp(`La rejouer ${JEUX.epingle.a} pour la dorer`))
  assert.match(coupSansElle, /Ce jeu arrive bientôt/)
  assert.match(coup, new RegExp(`La rejouer ${JEUX.epingle.a} pour la dorer`))
  assert.doesNotMatch(coup, /Ce jeu arrive bientôt/)
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
  // Un jeu pas encore livré : la chasse attend — une œuvre qui manque, à un jeu que la page d'un serveur sans l'Épingle ne livre pas.
  const sansElle = sansLEpingle()
  const aVenir = sansElle.salles.flatMap(s => s.oeuvres).find(o => !o.possedee && !sansElle.jeux.includes(JEU_DE_L_OEUVRE[o.cle]))
  assert.ok(aVenir, 'une œuvre qui manque, à un jeu pas encore livré')
  assert.match(texte(await lOeuvre(aVenir.cle, {}, sansElle)), new RegExp(`Elle se trouve ${JEUX[JEU_DE_L_OEUVRE[aVenir.cle]].a} .*${JEU_PAS_LIVRE}`))
  assert.doesNotMatch(texte(await lOeuvre(aVenir.cle)), new RegExp(JEU_PAS_LIVRE), 'livré, il ne le dit pas')
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
  // Les boutons, pas les mots : chacun redit « Changer de jeu » dans son nom à l'oreille, qui dit aussi lequel (§ 19).
  assert.equal([...echange.matchAll(/>Changer de jeu<\/button>/g)].length, aJouerToutes.length, 'sur chaque case pas jouée')
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
    assert.match(aLOeil(html), new RegExp(`${JEUX[j].nom} .*${bareme}`), j)
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
    assert.equal(r.carteRetenue('lea'), 'lecon')
    assert.equal(r.reglesLues('lea'), true)
    // Hugo, sur le même téléphone : ni la carte-bonus de Léa, ni ses règles lues.
    assert.equal(r.carteRetenue('hugo'), null)
    assert.equal(r.reglesLues('hugo'), false)
    for (const k of memoire.keys()) assert.match(k, /^quizz\.cabinet\.[a-z-]+\.lea$/, k)
    // Deux commodités, rien de plus : l'annonce des œuvres rapportées de l'Expédition est partie avec elles, et sa clé avec elle.
    assert.deepEqual([...memoire.keys()].sort(), ['quizz.cabinet.carte.lea', 'quizz.cabinet.regles-lues.lea'])
    assert.deepEqual(Object.keys(r).sort(), ['carteRetenue', 'reglesLues', 'retenirLaCarte', 'retenirLesRegles'])
    assert.doesNotMatch(source('views/cabinet/retenu.ts'), /accueil-vu/)
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

test('le bouton de l’accueil dit son musée — « Ton musée : 27 œuvres sur 84 » — et « À jouer » tant que la visite du jour attend', async () => {
  const accueil = async (props: object) => {
    const html = await rendu('components/AccueilDesRoles', 'AccueilJouer', { enCours: [], onRejoindre: rien, lendemain: null, ...props })
    return /<a class="gros-bouton[^"]*" href="\/cabinet">.*?<\/a>/.exec(html)?.[0] ?? ''
  }
  // Ce que le serveur dit de son musée (`ProfilDAccueil.cabinet`) : ses œuvres, et une case de la visite à jouer.
  const aJouer = await accueil({ musee: { oeuvres: 27, sur: OEUVRES.length, aJouer: true } })
  assert.match(texte(aJouer), new RegExp(`Le Cabinet de curiosités Ton musée : 27 œuvres sur ${OEUVRES.length}`))
  // D'un bloc : coupée ailleurs qu'après « Ton musée : », la ligne laissait « sur 84 » seul à côté de la pastille, en 360.
  assert.match(aJouer, new RegExp(`27 œuvres sur ${OEUVRES.length}`))
  assert.match(aJouer, /<span class="pastille-attente">À jouer<\/span>/)
  // La visite faite, plus de pastille : le chevron revient.
  const faite = await accueil({ musee: { oeuvres: 27, sur: OEUVRES.length, aJouer: false } })
  assert.match(texte(faite), /Ton musée : 27 œuvres sur/)
  assert.doesNotMatch(faite, /À jouer/)
  assert.match(faite, /class="icon chevron"/)
  // Le serveur n'en dit rien — un musée qu'il n'a pas lu depuis son réveil : l'accueil ne paie pas un aller-retour pour lui —, la
  // ligne de toujours.
  assert.match(texte(await accueil({})), /Un musée à remplir, des œuvres à gagner en jouant/)
  // Fermé pour bientôt, la raison passe devant le musée, sans pastille.
  const bientot = await accueil({ musee: { oeuvres: 27, sur: OEUVRES.length, aJouer: true }, etats: { cabinet: 'bientot' } })
  assert.match(texte(bientot), /Bientôt disponible/)
  assert.doesNotMatch(bientot, /À jouer|Ton musée/)
  // La page lit ce que l'accueil du serveur porte, sans rien demander de plus.
  assert.match(source('views/ProfilApp.tsx'), /musee=\{'cabinet' in profil \? profil\.cabinet : undefined\}/)
})

test('« À jouer » : une seule règle, au musée et sur l’accueil — une case d’un jeu pas livré n’attend que si l’échange peut la changer', async () => {
  // L'accueil du serveur (`accueilDuCabinet`), sur une journée faite à la main : deux cases jouées, la troisième à l'Épingle.
  const jour = '2026-10-25'
  const cases: CaseFigee[] = [
    { jeu: 'pari', cible: null, but: null },
    { jeu: 'frise', cible: null, but: null },
    { jeu: 'epingle', cible: null, but: null },
  ]
  const jouee = (k: Manche): PartieDuJour => ({ id: `p${k}`, commenceeLe: 0, finieLe: 1, issue: 'manquee', origine: 'visite', visite: k, jeu: cases[k].jeu, cible: null, payee: false, total: 0 })
  const leMusee = museeDe({ jour, parties: [jouee(0), jouee(1)] })
  const visite: VisiteDuJour = { jour, cases, echange: null, figee: true }
  const sansLEpingle = JEUX_PRETS.filter(j => j !== 'epingle')
  const aJouer = (plus: Partial<LectureDeLAccueil>) => accueilDuCabinet({ musee: leMusee, visite, jeux: JEUX_PRETS, jeuDeLEchange: 'mot', ...plus }).aJouer
  assert.equal(aJouer({}), true, 'la troisième case se joue')
  assert.equal(aJouer({ jeux: sansLEpingle }), true, 'pas livrée, elle se change encore : « Changer de jeu » la rend jouable')
  assert.equal(aJouer({ jeux: sansLEpingle, visite: { ...visite, echange: 0 } }), false, 'l’échange du jour déjà fait : elle ne se joue plus')
  assert.equal(aJouer({ jeux: sansLEpingle, jeuDeLEchange: null }), false, 'aucun autre jeu à lui donner')
  assert.equal(aJouer({ musee: museeDe({ jour, parties: [jouee(0), jouee(1), jouee(2)] }) }), false, 'la visite faite')
  // Le musée, de même : sa pastille et son bouton en avant ne promettaient qu'une case pas faite, même d'un jeu qui ne se joue pas.
  const derniere = (echange: PageDuCabinet['visite']['echange']): PageDuCabinet => ({
    ...page,
    enCours: null,
    visite: { ...page.visite, echange, cases: page.visite.cases.map((c, k, toutes) => (k < toutes.length - 1 ? { ...c, faite: true } : { ...c, faite: false, bientot: true as const })) },
  })
  const laVisite = async (p: PageDuCabinet) => /<a class="gros-bouton[^"]*" href="#visite">.*?<\/a>/.exec(await musee(p))?.[0] ?? ''
  const changeable = await laVisite(derniere({ possible: true }))
  assert.match(changeable, /^<a class="gros-bouton gros-principal"/)
  assert.match(changeable, /<span class="pastille-attente">À jouer<\/span>/)
  const perdue = await laVisite(derniere({ possible: false, refus: 'Tu as déjà changé un jeu aujourd’hui' }))
  assert.match(perdue, /^<a class="gros-bouton"/)
  assert.doesNotMatch(perdue, /À jouer/)
  // Elle dit encore où elle en est : deux sur trois, la troisième ne se fera pas aujourd'hui.
  assert.match(texte(perdue), new RegExp(`${page.visite.cases.length - 1} sur ${page.visite.cases.length} faites`))
  // Une seule copie de la règle : `shared/cabinet/vues.ts`, que la page et le serveur importent.
  assert.match(source('views/cabinet/Musee.tsx'), /const aJouer = visiteAJouer\(page\.visite\)/)
  assert.match(readFileSync(path.resolve(client, '../../server/src/core/cabinet/vue.ts'), 'utf8'), /aJouer: visiteAJouer\(visiteVue\(l\)\)/)
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

test('la tête d’une partie tient en 360 de large la niche posée : ses écarts se serrent, jamais un texte, et le total ne passe pas sous « Quitter »', () => {
  // Le rendu du 25 octobre 2026 (`rendu-cabinet.ts`, `[chevauche]`) : la niche prend 60 px au coin, il restait 49 px au total
  // pour ses 72, et « 0 / 9 ★ », rétréci, passait sous « Quitter ». Serrés, les trois cercles, le total et le bouton tiennent les
  // 260 px de la rangée, et leurs textes gardent leur taille. Ce que la niche change se range dans le bloc de sa place (« Sa place,
  // page par page »), le reste dans la section du Cabinet : la feuille entière, et pour un sélecteur, chaque règle qui le porte.
  const feuille = readFileSync(path.join(client, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const regle = (sel: string) => [...feuille.matchAll(new RegExp(`(?:^|\\n)${echapper(sel)} \\{([^}]*)\\}`, 'g'))].map(m => m[1]).join(';')
  const place = feuille.slice(feuille.indexOf('\nbody.avec-niche { --niche-place:'))
  for (const sel of ['body.avec-niche .cab-tete-ligne', 'body.avec-niche .cab-points', 'body.avec-niche .cab-point', 'body.avec-niche .cab-page .cab-quitter']) {
    assert.match(place, new RegExp(`\\n${echapper(sel)} \\{`), `${sel} se range dans le bloc de la place de la niche`)
    assert.doesNotMatch(sectionDuCabinet(), new RegExp(`(?:^|\\n)${echapper(sel)} \\{`), `${sel} n’est pas dans la section du Cabinet`)
  }
  const px = (decl: string, prop: string) => Number(new RegExp(`(?:^|;)\\s*${prop}:\\s*([\\d.]+)px`).exec(decl)?.[1] ?? NaN)
  const sansNiche = {
    ligne: px(regle('.cab-tete-ligne'), 'gap'),
    points: px(regle('.cab-points'), 'gap'),
    point: px(regle('.cab-point'), 'width'),
    quitter: Number(/padding:\s*[\d.]+px\s+([\d.]+)px/.exec(regle('.cab-page .cab-quitter'))?.[1]),
  }
  const avecNiche = {
    ligne: px(regle('body.avec-niche .cab-tete-ligne'), 'gap'),
    points: px(regle('body.avec-niche .cab-points'), 'gap'),
    point: px(regle('body.avec-niche .cab-point'), 'width'),
    quitter: px(regle('body.avec-niche .cab-page .cab-quitter'), 'padding-left'),
  }
  for (const [quand, valeurs] of Object.entries({ sansNiche, avecNiche })) {
    for (const [cle, v] of Object.entries(valeurs)) assert.ok(Number.isFinite(v), `${cle}, ${quand} : se lit dans la feuille`)
  }
  assert.equal(px(regle('body.avec-niche .cab-point'), 'height'), avecNiche.point, 'un cercle reste un cercle')
  assert.equal(px(regle('body.avec-niche .cab-page .cab-quitter'), 'padding-right'), avecNiche.quitter)
  // La rangée : trois cercles et leurs deux écarts, puis deux écarts entre les cercles, le total et « Quitter », et les deux bords
  // du bouton. Ce qu'elle gagne doit couvrir ce qui manquait au total, avec un peu de marge pour une police qui chasse plus.
  const gagne = 2 * (sansNiche.ligne - avecNiche.ligne) + 2 * (sansNiche.points - avecNiche.points) + 3 * (sansNiche.point - avecNiche.point) + 2 * (sansNiche.quitter - avecNiche.quitter)
  assert.ok(gagne >= 23 + 3, `${gagne} px gagnés, pour 23 qui manquaient`)
  // Le bouton garde la cible d'un doigt.
  assert.match(regle('.cab-page .cab-quitter'), /min-height: 44px/)
  for (const sel of ['body.avec-niche .cab-tete-ligne', 'body.avec-niche .cab-points', 'body.avec-niche .cab-point', 'body.avec-niche .cab-page .cab-quitter']) {
    assert.doesNotMatch(regle(sel), /font/, `${sel} ne touche pas aux textes`)
  }
})

test('la tête d’une partie au texte agrandi : « Quitter » perd son mot avant de couvrir le total, et la rangée passe à la ligne plutôt que de se chevaucher', async () => {
  // La tablée du 25 octobre 2026 (Jeanne, le texte du téléphone à 130 %) : `.cab-total { flex: 1; min-width: 0; white-space:
  // nowrap }` laissait sa boîte se réduire à 26 px, et son texte de 72 px passait sous « Quitter » — 44 px de chevauchement en
  // 360 × 640 au zoom de la tablée, 34 en 277 × 492, le vrai zoom de Chrome Android. Une requête de conteneur — elle suit aussi le
  // zoom posé sur la page, ce qu'une requête d'écran ne ferait pas — cache le mot de « Quitter » et serre les cercles quand la tête
  // n'a plus la place ; la niche posée, plus tôt. Et si même cela ne tient pas, la rangée passe à la ligne.
  const feuille = readFileSync(path.join(client, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const section = sectionDuCabinet()
  const regle = (dans: string, sel: string) => new RegExp(`(?:^|\\n)${echapper(sel)} \\{([^}]*)\\}`).exec(dans)?.[1] ?? ''
  assert.match(regle(section, '.cab-tete-partie'), /container: tete \/ inline-size;/)
  // Le filet : jamais le couple qui laissait le total se réduire sous son texte ; la rangée passe à la ligne, « Quitter » à droite.
  const total = regle(section, '.cab-total')
  assert.ok(total, '.cab-total a sa règle')
  assert.ok(!(/min-width: 0;/.test(total) && /white-space: nowrap;/.test(total)), `le total ne se réduit plus sous son texte : ${total}`)
  assert.match(total, /flex: 1 0 auto;[^}]*min-width: max-content;/)
  assert.match(regle(section, '.cab-tete-ligne'), /flex-wrap: wrap;/)
  assert.match(regle(section, '.cab-page .cab-quitter'), /margin-left: auto;/)
  // Sans niche, sous 290 px de tête ; la niche posée — qui en prend 60 —, sous 350 : le mot se cache, le bouton garde la cible d'un
  // doigt, les cercles se serrent. Jamais un texte plus petit.
  const conteneur = (dans: string, largeur: number) => new RegExp(`@container tete \\(max-width: ${largeur}px\\) \\{([\\s\\S]*?)\\n\\}`).exec(dans)?.[1] ?? ''
  const sansNiche = conteneur(section, 290)
  assert.match(sansNiche, /\.cab-quitter-mot \{ display: none; \}/)
  assert.match(sansNiche, /\.cab-page \.cab-quitter \{ width: 44px; padding: 0; \}/)
  assert.match(sansNiche, /\.cab-point \{ width: 24px; height: 24px; \}/)
  const place = feuille.slice(feuille.indexOf('\nbody.avec-niche { --niche-place:'))
  const avecNiche = conteneur(place, 350)
  assert.match(avecNiche, /body\.avec-niche \.cab-quitter-mot \{ display: none; \}/)
  assert.match(avecNiche, /body\.avec-niche \.cab-page \.cab-quitter \{ width: 44px; padding: 0; \}/)
  // Plus étroite encore, la niche posée — 277 de large — : même sans son mot, « Quitter » ne tient plus à côté du total. Passé à la
  // ligne, il ajoutait une rangée de 48 pixels à la tête, et la question de l'Épingle et sa carte n'avaient plus où tenir : pendant
  // une manche, il s'assied au bout de la ligne du chrono, avant la niche et le bord de la tête, et le chrono lui garde sa place —
  // le bouton de 44 et l'écart de 8 de la rangée. Rien ne le lisait (la relecture du lot page-1).
  const assis = conteneur(place, 300)
  assert.match(assis, /body\.avec-niche \.cab-tete-partie:has\(\.timer\) \.cab-quitter \{ position: absolute; right: calc\(20px \+ var\(--niche-place\)\); bottom: 8px; \}/)
  const garde = /body\.avec-niche \.cab-tete-partie:has\(\.cab-quitter\) \.timer \{ min-height: 44px; padding-right: calc\(var\(--niche-place\) \+ (\d+)px\); \}/.exec(assis)
  assert.ok(garde, `le chrono garde la place de « Quitter » : ${assis}`)
  assert.equal(Number(garde[1]), 44 + 8)
  // Le bouton se pose dans la tête, qui le contient : collée, elle est positionnée.
  assert.match(regle(section, '.cab-tete-partie'), /position: sticky;/)
  for (const bloc of [sansNiche, avecNiche, assis]) assert.doesNotMatch(bloc, /font/, 'une requête de conteneur ne touche à aucun texte')
  // Le bouton garde son nom quand son mot se cache : la tablée le touche par lui, et le lecteur d'écran le dit.
  const tete = /<header class="cab-tete-partie">[\s\S]*?<\/header>/.exec(await laPartie(vues.pari))?.[0] ?? ''
  assert.match(tete, /<button type="button" class="btn cab-quitter" aria-label="Quitter"><svg class="icon"[^>]*>.*?<\/svg><span class="cab-quitter-mot">Quitter<\/span><\/button>/)
})

test('ce qui s’écrit sur l’or pâle se lit sous chaque thème : les gestes choisis, « Poser ici », le détail du gros bouton, la bonne réponse, le légendaire', () => {
  // Le rendu du 25 octobre 2026 (`rendu-cabinet.ts`, `[contraste]`), sous l'Ivoire : « Reprends-la où tu l’as laissée », en gris sur
  // le gros bouton principal, tenait 4,19:1 ; « Poser ici », 4,48:1 ; « Avatar légendaire débloqué », sur le halo de son médaillon,
  // 4,41:1. L'or du texte (`--accent-text`) tient sur le fond de la page sous chaque thème (`design.test.ts`), pas sur l'or pâle
  // (`--accent-soft`) : 4,09:1 sous le Film noir. Le seuil est celui de WCAG — 4,5:1, 3:1 pour un grand texte.
  const section = sectionDuCabinet()
  const themes = themesDuClient()
  const lit = (quoi: string, couleur: string, fondDe: (j: Map<string, string>) => string, seuil = 4.5) => {
    for (const { cle, jetons } of themes) {
      const c = contraste(teinte(jetons, couleur), surFond(fondDe(jetons), teinte(jetons, '--bg')))
      assert.ok(c >= seuil, `${cle} : ${quoi} (${couleur}) tient ${c.toFixed(2)}:1`)
    }
  }
  const accentSoft = (j: Map<string, string>) => j.get('--accent-soft')!
  // Chaque règle de la section qui pose un texte sur l'or pâle : sa couleur, à sa taille.
  let vues = 0
  for (const [, selecteur, corps] of section.matchAll(/(?:^|\n)([^{}\n]+?) \{([^}]*)\}/g)) {
    if (!/background: var\(--accent-soft\)/.test(corps)) continue
    const couleur = /(?:^|;)\s*color: var\((--[\w-]+)\)/.exec(corps)?.[1]
    if (!couleur) continue
    vues++
    const rem = Number(/font-size: ([\d.]+)rem/.exec(corps)?.[1] ?? 1.0625)
    const grand = rem * 16 >= 24 || (/font-weight: 700/.test(corps) && rem * 16 >= 18.66)
    lit(selecteur.trim(), couleur, accentSoft, grand ? 3 : 4.5)
  }
  assert.ok(vues >= 4, `les textes sur l’or pâle sont bien trouvés (${vues})`)
  // Le détail d'un gros bouton prend son fond d'une règle de toute l'application (`.gros-principal`), et le gris de la sienne.
  lit('le détail du gros bouton qui mène', /(?:^|\n)\.cab-page \.gros-principal \.gros-detail \{[^}]*color: var\((--[\w-]+)\)/.exec(section)?.[1] ?? '--muted', accentSoft)
  // « La bonne réponse · la tienne », à la révélation et dans « Mes réponses » : sa case pose l'or pâle d'une règle de toute
  // l'application (`.corrige-bonne`), et sa légende l'or du texte d'une autre — 3,81:1 sous le Film noir (le rendu du 25 octobre
  // 2026, `THEME=filmnoir`), que la lecture règle par règle ne voyait pas.
  lit('la légende de la bonne réponse', /(?:^|\n)\.cab-page \.corrige-bonne \.corrige-legende \{[^}]*color: var\((--[\w-]+)\)/.exec(section)?.[1] ?? '--accent-text', accentSoft)
  // L'étiquette d'un légendaire qui s'éveille, sur le halo de son médaillon : l'accent à 18 % au plus fort (`.fin-legendaire`).
  const halo = (j: Map<string, string>) => `rgba(${j.get('--accent-rgb')}, 0.18)`
  lit('l’étiquette d’un légendaire', /(?:^|\n)[^{}\n]*\.cab-page \.fin-legendaire \.label[^{}\n]* \{[^}]*color: var\((--[\w-]+)\)/.exec(section)?.[1] ?? '--muted', halo)
  // Et à dix-sept pixels, dans la feuille d'un réveil aussi : en capitales de onze, elle y avait gardé la taille d'une soirée.
  assert.match(section, /(?:^|\n)[^{}\n]*\.cab-feuille \.label[^{}\n]* \{[^}]*font-size: 1\.0625rem;[^}]*text-transform: none;/)
})

test('la carte d’une mission accomplie, au bilan, se relève à dix-sept pixels comme les autres pièces partagées', () => {
  // Le rendu du 25 octobre 2026 : au bilan d'une partie qui fait une mission du jour (`MissionsAccomplies`, `Missions.tsx`), son
  // gain, sa mission, son lien et les jours de sa carte des tampons s'écrivaient de 11 à 14 px — la taille de l'accueil.
  const css = readFileSync(path.join(client, 'styles.css'), 'utf8')
  const section = sectionDuCabinet()
  const enPixels = (taille: string) => (taille === 'var(--t-label)' ? 11 : taille.endsWith('rem') ? parseFloat(taille) * 16 : parseFloat(taille))
  const petits = [...css.matchAll(/(?:^|\n)(\.(?:mission-accomplie|tampon)[\w-]*(?: [a-z]+)?) \{[^}]*font-size: ([^;]+);/g)]
    .filter(([, , taille]) => enPixels(taille) < 17)
    .map(([, selecteur]) => selecteur)
  assert.ok(petits.length >= 5, `les petits textes de la carte sont bien trouvés (${petits.join(', ')})`)
  for (const selecteur of petits) {
    const releve = new RegExp(`\\.cab-page ${echapper(selecteur)}[,\\s][^{}]*\\{[^}]*font-size: 1\\.0625rem;`)
    assert.match(section, releve, `${selecteur} se relève sous .cab-page`)
  }
})

test('sur une tablette ou un portable, la niche et sa fiche suivent la colonne élargie d’une question : son coin, pas celui des 560 pixels', () => {
  // Le rendu du 25 octobre 2026 en 1366 × 768 (`[sous la niche]`) : la colonne d'une question s'élargit à 760 pixels
  // (`.player-shell:has(.quiz-player)`), la niche restait au coin de celle de 560 — au milieu de la tête d'une partie du Cabinet,
  // sur « Quitter », et cent pixels dans la page au quiz du jour. Déplacée seule, elle laissait sa fiche au coin d'avant : la bulle
  // sortait 100 pixels plus loin, sa pointe sous rien (la relecture du lot). Un seul coin, que les deux lisent.
  const css = readFileSync(path.join(client, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const coin = (colonne: string) => `max(16px, calc((100vw - ${colonne}px) / 2 + 16px))`
  const ordinaire = /\n\.player-shell \{[^}]*max-width: (\d+)px;/.exec(css)?.[1]
  assert.ok(ordinaire, 'la colonne d’ordinaire se lit')
  assert.match(css, new RegExp(`\\nbody \\{ --coin-de-la-niche: ${echapper(coin(ordinaire))}; \\}`), 'le coin d’ordinaire est celui de la colonne')
  for (const sel of ['.niche', '.niche-fiche']) {
    const regle = new RegExp(`\\n${echapper(sel)} \\{([^}]*)\\}`).exec(css)?.[1] ?? ''
    assert.match(regle, /\n\s*right: var\(--coin-de-la-niche\);/, `${sel} se pose au coin de la niche`)
  }
  assert.doesNotMatch(css.replace(/--coin-de-la-niche: [^;]*;/g, ''), /100vw - \d+px\) \/ 2 \+ 16px/, 'aucun autre coin écrit à la main')
  const [, condition, large] = /@media (\([^)]*\) and \([^)]*\)) \{\n {2}\.player-shell:has\(\.quiz-player\) \{ max-width: (\d+)px;/.exec(css) ?? []
  assert.ok(condition && large, 'la colonne élargie d’une question se lit')
  // Sous la même condition, et pour la même colonne : chaque page qui pose une question — le Cabinet, le quiz du jour, la
  // campagne, les sentiers, l'expédition, une soirée.
  const elargie = new RegExp(`@media ${echapper(condition)} \\{\\s*body\\.avec-niche:has\\(\\.player-shell \\.quiz-player\\) \\{ --coin-de-la-niche: ${echapper(coin(large))}; \\}`)
  assert.match(css, elargie, 'la niche se pose au coin de la colonne élargie, sous la même condition')
})

test('la tête collée d’une partie ne laisse rien passer derrière son chrono : son fondu tient dans sa marge du bas', () => {
  // Le rendu du 25 octobre 2026 : la tête s'effaçait sur ses 16 derniers pour cent, et ses secondes, sur la dernière ligne, se
  // lisaient sur le récit de l'Épingle ou la carte de la Frise qui défilaient dessous (« 57 » à 2,99:1, `[contraste]`).
  const regle = /(?:^|\n)\.cab-tete-partie \{([^}]*)\}/.exec(sectionDuCabinet())?.[1] ?? ''
  const bas = Number(/padding: [^;]*? (\d+)px;/.exec(regle)?.[1])
  assert.ok(Number.isFinite(bas) && bas > 0, `la marge du bas de la tête se lit (${regle})`)
  const plein = /background: linear-gradient\(180deg, var\(--bg\) calc\(100% - (\d+)px\), transparent\);/.exec(regle)?.[1]
  assert.ok(plein !== undefined && Number(plein) <= bas, `le fond plein descend jusqu’à la marge du bas (${bas} px) : ${regle}`)
})

test('la peinture levée d’une œuvre laisse son ombre au-dessus de la ligne qui la nomme', () => {
  // Le rendu du 25 octobre 2026 : « Œuvre commune · Le Rempart », juste sous la peinture, se lisait dans son ombre portée — 4,03:1
  // sous l'Ivoire, l'or du texte à 5:1 sur la page nue. L'ombre (`.exp-vc-levee`, sa dernière couche) est un flou gaussien d'écart
  // type la moitié de son flou, décalé vers le bas : à 1,25 écart type sous son bord, il ne lui reste qu'un dixième de sa force.
  const css = readFileSync(path.join(client, 'styles.css'), 'utf8')
  const levee = /(?:^|\n)\.exp-vc-levee \{[^}]*box-shadow: ([^;]*);/.exec(css)?.[1] ?? ''
  const [, decale, flou] = /, 0 (\d+)px (\d+)px color-mix\([^;]*\)$/.exec(levee) ?? []
  assert.ok(decale && flou, `l’ombre de la peinture levée se lit (${levee})`)
  const ecart = /(?:^|\n)\.player-shell \{[^}]*gap: (\d+)px;/.exec(css)?.[1]
  const marge = /(?:^|\n)\.cab-page > \.cab-oeuvre-levee \{[^}]*margin-bottom: (\d+)px;/.exec(sectionDuCabinet())?.[1] ?? '0'
  const dessous = Number(ecart) + Number(marge)
  assert.ok(dessous >= Number(decale) + 1.25 * (Number(flou) / 2), `${dessous} px sous la peinture, pour une ombre de ${decale} px et ${flou} px de flou`)
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
  assert.match(aLOeil(libre), new RegExp(echapper(JEUX.pari.bareme.replace(/^./, c => c.toUpperCase()))))
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
  // Leçon se trouve au Pari, où une manche parfaite est un pari gagné (section 18) : ailleurs, « toutes ses manches parfaites ».
  assert.match(dorer, /Pour la dorer : trois paris gagnés, sans qu’un pouvoir ait servi\./)
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

test('l’annonce du Détail dit qu’il se joue à l’œil : la description du tableau soufflerait la réponse — et les autres jeux n’ont rien de tel', async () => {
  // Hugo, au lecteur d'écran, a joué le Détail au hasard, zéro sur neuf (la tablée du 25 octobre 2026) : rien ne nomme le tableau
  // avant le verdict — c'est voulu, invariant 1 —, mais rien ne le disait non plus. L'avertissement vit avec le jeu (`JEUX`), et
  // l'image de la manche n'en dit pas plus.
  const avertissement = JEUX.detail.avertissement
  assert.ok(avertissement, 'le Détail a son avertissement')
  assert.match(avertissement, /se joue à l’œil/)
  assert.match(avertissement, /lecteur d’écran/)
  assert.deepEqual(CLES_DES_JEUX.filter(j => JEUX[j].avertissement), ['detail'])
  const annonce = (jeu: CleDeJeu) => rendu('views/cabinet/Annonce', 'Annonce', { page, demande: { origine: 'libre', jeu }, carte: null, busy: false, onCarte: rien, onCommencer: rien, onRetour: rien })
  const detail = await annonce('detail')
  assert.match(texte(detail), new RegExp(enTexte(espacesFines(avertissement))))
  // Avant « Commencer », dans le bloc du jeu, sous son barème.
  assert.ok(detail.indexOf('cab-bareme-annonce') < detail.indexOf('se joue à l'), 'sous le barème')
  assert.ok(detail.indexOf('se joue à l') < detail.indexOf('>Commencer<'), 'avant « Commencer »')
  assert.doesNotMatch(texte(await annonce('pari')), /se joue à l’œil/)
  sansJargon(detail, 'l’annonce du Détail')
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
  assert.match(html, /aria-label="Quitter">.*?<span class="cab-quitter-mot">Quitter<\/span><\/button>/)
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
  assert.match(aLOeil(auChoix), new RegExp(echapper(MOTS_DU_PARI.auChoix)))
  // Les deux gestes montrent les mots du barème — à l'oreille, ils se nomment en mots (« Garder 2 étoiles », section 18).
  const gesteDuChoix = (classe: string) => aLOeil(new RegExp(`<button type="button" class="${classe}" aria-label="[^"]+"[^>]*>(.*?)</button>`).exec(auChoix)?.[1] ?? '').trim()
  assert.equal(gesteDuChoix('btn btn-big'), MOTS_DU_PARI.garder)
  assert.equal(gesteDuChoix('btn btn-primary btn-big'), MOTS_DU_PARI.parier)
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
  // Son bouton se nomme autrement que celui de la tête : deux « Quitter » à l'écran, Camille ne savait lequel toucher (la tablée du
  // 25 octobre 2026), et la tablée le touche par ce nom.
  assert.match(partie, /const oui = await confirmDialog\(\{ title: titre, message, confirmLabel: 'Quitter la partie', cancelLabel: 'Continuer', danger: true \}\)/)
  // Sous la confirmation, le voile n'a pas de bouton : « Quitter ? » répondra.
  assert.doesNotMatch(html, />Continuer<\/button>/)
  // La pause passée, le chrono reprend sous le voile : il ne dit plus « En pause » (Lucas, à la tablée : 96, 83, 69 s défilaient
  // sous « En pause »), mais que le chrono court, en une région qui se dit — et la manche reste cachée.
  assert.match(html, /<p class="cab-voile-dit" aria-live="polite"><b>En pause<\/b>/)
  const repris = await laPartie(v, { chrono: chronoMontre(v, v.maintenant + c.pauseResteMs!) })
  assert.equal(chronoMontre(v, v.maintenant + c.pauseResteMs!).figeMs, undefined, 'le chrono court de nouveau')
  assert.doesNotMatch(texte(repris), /En pause/)
  assert.match(texte(repris), /Le chrono a repris Ta manche reste cachée : réponds à « Quitter \? »/)
  assert.match(repris, /<p class="cab-voile-dit" aria-live="polite"><b>Le chrono a repris<\/b>/)
  for (const r of q.reponses) assert.doesNotMatch(texte(repris), new RegExp(lu(r)))
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
  // Sa pause passée, le chrono court dessous : le voile le dit, et « Continuer » reste — aucune question n'est ouverte.
  const { chronoMontre } = await import(url('views/cabinet/Partie.tsx'))
  const repartie = await laPartie(relue, { onReprendre: rien, chrono: chronoMontre(relue, relue.maintenant + relue.chrono!.pauseResteMs!) })
  assert.match(texte(repartie), /Le chrono a repris Ta manche t’attend, cachée\./)
  assert.match(repartie, />Continuer<\/button>/)
  assert.doesNotMatch(texte(repartie), /Quitter \?/)
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

test('l’Éclair corrigé dit son verdict en mots : « Raté » d’une affirmation vraie qu’il a dite fausse — jamais « Faux », le mot du jeu', async () => {
  // Hugo, au lecteur d'écran (la tablée du 25 octobre 2026) : la marque d'une affirmation ratée se disait « Faux », puis « Vrai · tu
  // as dit faux » — trois fois le mot du jeu, et l'on ne savait plus qui s'était trompé. Le verdict a ses mots à lui, écrits en
  // tête de la ligne et donnés à la marque (`Corrige`, son `dit`) ; les autres corrigés gardent les leurs.
  const { eclair } = await ecrans()
  const { renderToStaticMarkup } = await import('react-dom/server')
  const corrige = (affirmations: object[]) =>
    renderToStaticMarkup(React.createElement((eclair as unknown as { Revelation: React.FC<Record<string, unknown>> }).Revelation, { corps: { jeu: 'eclair', titre: '1 sur 3', justes: 1, savais: null, affirmations }, partie: 'p' }))
  const html = corrige([
    { texte: 'Combien de livres compte un stone ?', proposee: '14 livres', vraie: true, bonne: '14 livres', reponse: false, juste: false },
    { texte: 'La capitale de la Lituanie ?', proposee: 'Riga', vraie: false, bonne: 'Vilnius', reponse: false, juste: true },
    { texte: 'Le plus long fleuve de France ?', proposee: 'La Loire', vraie: true, bonne: 'La Loire', reponse: null, juste: false },
  ])
  const marques = [...html.matchAll(/<span class="corrige-marque" role="img" aria-label="([^"]+)">/g)].map(m => m[1])
  assert.deepEqual(marques, ['Raté', 'Juste', 'Sans réponse'])
  assert.doesNotMatch(html, /aria-label="Faux"/)
  const lignes = [...html.matchAll(/<p class="corrige-vraie">(.*?)<\/p>/g)].map(m => texte(m[1]).trim())
  assert.deepEqual(lignes, ['Raté · c’était vrai · tu as dit faux', 'Juste · c’était faux : Vilnius · tu as dit faux', 'Sans réponse · c’était vrai'])
  // Ses couleurs ne changent pas : le raté reste un corrigé « ko », ce qu'il est.
  assert.equal([...html.matchAll(/<li class="corrige ko">/g)].length, 1)
  // Ailleurs, le corrigé dit toujours « Faux » d'une réponse fausse : le quiz du jour, la série, le défi.
  const { Corrige } = await import(url('components/Corrige.tsx'))
  const serie = renderToStaticMarkup(React.createElement(Corrige, { verdict: 'Faux', tete: 'Question 1', texte: 'Q ?', reponses: ['a', 'b'], bonne: 0, choix: 1 }))
  assert.match(serie, /aria-label="Faux"/)
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

test('la page retient le niveau à son ouverture : le premier bilan dit la montée de niveau — sans télécharger l’écran des gains', async () => {
  // La fin compare le niveau relu après la partie à celui que la page a vu (`useNiveauRelu`, au premier rendu du bilan) : rien
  // retenu au montage, le premier bilan de la visite ne savait pas d'où il partait, et taisait « Niveau 8 ! », la finition et
  // l'avatar de collection que la montée ouvrait. Une seule mémoire, dans un module léger que l'écran des gains lit aussi.
  const leger = (await import(url('niveauVu.ts'))) as { retenirLeNiveau: (n: number | undefined) => void; niveauVu: () => number | null }
  const gains = (await import(url('components/Gains.tsx'))) as {
    retenirLeNiveau: unknown
    niveauDe: (p: { niveau: number; acquis?: number; requis?: number }, avant: number | null) => unknown
  }
  assert.equal(gains.retenirLeNiveau, leger.retenirLeNiveau, 'la campagne et l’Expédition le retiennent par l’écran des gains : la même mémoire')
  const montee = async (avant: number | null) =>
    texte(await rendu('components/Gains', 'CeQueTuGagnes', { parts: [{ nom: 'ta partie', xp: 10 }], niveau: gains.niveauDe({ niveau: 8, acquis: 5, requis: 900 }, avant) }))
  // Une page neuve n'a rien retenu : la montée ne se dit pas.
  const neuve = (await import(`${url('niveauVu.ts')}?neuve`)) as typeof leger
  assert.equal(neuve.niveauVu(), null)
  assert.doesNotMatch(await montee(neuve.niveauVu()), /Niveau 8 !/)
  leger.retenirLeNiveau(7)
  assert.equal(leger.niveauVu(), 7)
  assert.match(await montee(leger.niveauVu()), /Niveau 8 !/)
  // Un profil léger sans niveau n'efface pas ce qui est retenu.
  leger.retenirLeNiveau(undefined)
  assert.equal(leger.niveauVu(), 7)
  // La page le retient dès le profil léger lu, avant que le musée paraisse ; l'écran des gains part de lui au premier rendu.
  const page_ = source('views/CabinetApp.tsx')
  assert.match(page_, /import \{ retenirLeNiveau \} from '\.\.\/niveauVu'/)
  assert.match(page_, /const moi = await api\.joueur\.moiLeger\(\)[^]*?retenirLeNiveau\(moi\.profile\?\.niveau\)[^]*?if \(vivant\) lirePage\(premiere\)/)
  assert.match(source('components/Gains.tsx'), /const \[avant\] = useState\(\(\) => niveauVu\(\)\)/)
  // Le musée ne télécharge pas l'écran des gains pour autant : le module du niveau n'importe rien.
  const chemin = importsStatiques(path.join(client, 'views/CabinetApp.tsx'))
  assert.ok(chemin.has(path.join(client, 'niveauVu.ts')), 'niveauVu.ts est sur le chemin')
  assert.ok(!chemin.has(path.join(client, 'components/Gains.tsx')), 'Gains.tsx ne part pas avec le musée')
  assert.deepEqual([...importsStatiques(path.join(client, 'niveauVu.ts'))], [path.join(client, 'niveauVu.ts')])
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
  // L'échéance se lit à l'heure du serveur, par une seule règle pure (`aEnvoyerALEcheance`, l'épreuve suivante), qui dit aussi le
  // geste qui part : l'effet ne fait plus que l'appeler, et insister à l'instant qu'elle dit. Sans garde à lui — la sienne, que
  // rien n'éprouvait, changée en `if (pret || !pret) return`, n'envoyait plus jamais rien et passait toutes les épreuves (la
  // relecture du lot page-1) : ses deux seuls `if`, le plan absent et la vue qui a changé de rang depuis, se lisent ici.
  const effet = /const envoi = aEnvoyerALEcheance\(vue, serverNow\(\), pret\)[\s\S]*?\}, \[vue, pret, jouer\]\)/.exec(partie)?.[0] ?? ''
  assert.ok(effet, 'l’effet de l’échéance appelle la règle pure')
  assert.match(effet, /^const envoi = aEnvoyerALEcheance\(vue, serverNow\(\), pret\)\n\s+if \(!envoi\) return\n/)
  assert.match(effet, /if \(vueRef\.current\.rang === rang\) await jouer\(envoi\.geste\(localRef\.current\), true\)/)
  assert.match(effet, /\{ premier: envoi\.dans \}/)
  assert.equal([...effet.matchAll(/\bif \(/g)].length, 2, `l’effet n’a que ses deux gardes : ${effet}`)
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

test('la réponse part d’elle-même à l’échéance, sous la pause comprise, et pas avant : une règle pure, que l’effet appelle', async () => {
  // L'envoi à l'échéance n'était gardé que par le texte de son effet : un mutant qui n'envoyait plus jamais rien (sa garde changée
  // en `if (pret || !pret) return`) passait les cent trente-sept épreuves des quatre fichiers qui lisent `Partie.tsx` (l'audit du
  // code du 25 octobre 2026). La règle sortie de l'effet se juge sur les vues du vrai serveur.
  type Envoi = { dans: number; geste: (local: unknown) => unknown }
  const { aEnvoyerALEcheance } = (await import(url('views/cabinet/Partie.tsx'))) as { aEnvoyerALEcheance: (v: VueDeLaPartie, t: number, pret: unknown) => Envoi | null }
  const lesEcrans = await ecrans()
  const ecran = lesEcrans.pari
  /** Dans combien de temps la réponse part — null : elle ne part pas. */
  const dans = (v: VueDeLaPartie, t: number, e: unknown = ecran) => aEnvoyerALEcheance(v, t, e)?.dans ?? null
  // Une manche qui se joue : à son échéance, ni avant — dans ce qui lui reste, à l'heure du serveur ; passée, tout de suite.
  const v = vues.pari
  const reste = v.chrono!.echeance - v.maintenant
  assert.ok(reste > 0)
  assert.equal(dans(v, v.maintenant), reste)
  assert.equal(dans(v, v.maintenant + 1_000), reste - 1_000)
  assert.equal(dans(v, v.chrono!.echeance + 5_000), 0)
  // Sous la pause de « Quitter ? » : à l'échéance reculée de ce qui reste de pause — la confirmation encore ouverte.
  const p = vues.pause
  assert.equal(dans(p, p.maintenant), p.chrono!.echeance + p.chrono!.pauseResteMs! - p.maintenant)
  // Rien sans l'écran du jeu — il dit ce qui part —, ni sans chrono : entre « Juste ! » et le choix du Pari, à la révélation, finie.
  assert.equal(dans(v, v.maintenant, null), null)
  for (const sans of [vues.auChoix, vues.gagne, vues.fini]) assert.equal(dans(sans, sans.maintenant), null, sans.phase)
  // La mise se décide sans chrono, et sans manche montrée rien ne se répond : rien ne part.
  assert.equal(dans({ ...v, phase: 'avant' } as VueDeLaPartie, v.maintenant), null)
  assert.equal(dans({ ...v, enCours: undefined }, v.maintenant), null)
  // Ce qui part : la réponse « auto » de la manche ouverte, de ce que la page tient à l'instant où elle part — rien au Pari, le
  // serveur sait déjà ce qui compte ; au Filet, le curseur et le filet qu'il a sous les yeux, bougés depuis que l'envoi s'est prévu.
  assert.deepEqual(aEnvoyerALEcheance(v, v.maintenant, ecran)!.geste(null), { quoi: 'repondre', manche: v.manche, auto: true })
  const f = vues.filet
  const tenu = { x: (f.enCours as FiletMontre).piste.min, taille: 'petit' }
  assert.deepEqual(aEnvoyerALEcheance(f, f.maintenant, lesEcrans.filet)!.geste(tenu), { quoi: 'repondre', manche: f.manche, auto: true, reponse: { filet: tenu } })
})

test('le chrono qui presse se voit sans couleur ni mouvement : un sablier devant ses secondes, une barre plus épaisse — dès dix secondes au Cabinet', async () => {
  // Camille, daltonienne (la tablée du 25 octobre 2026) : à cinq secondes, le chrono ne changeait que de couleur, et en deutéranopie
  // le rouge devient un kaki plus sombre que l'or ; sous « réduire les animations », sa pulsation s'arrête. Le sablier, une forme,
  // se voit sans l'une ni l'autre. Le même chrono sert les téléphones d'une soirée et l'écran commun : cinq secondes, d'office.
  const { serverNow } = await import(url('clock.ts'))
  const chrono = (reste: number, plus: object = {}) => rendu('components/TimerBar', 'TimerBar', { deadline: serverNow() + reste, duration: 45, ...plus })
  const sablier = /<span class="timer-seconds urgent"><svg class="icon"[^>]*>(?:(?!<\/svg>).)*<\/svg>4<\/span>/
  const presse = await chrono(4_000)
  assert.match(presse, /class="timer-track urgent"/)
  assert.match(presse, sablier)
  const calme = await chrono(20_000)
  assert.doesNotMatch(calme, /urgent/)
  assert.doesNotMatch(calme, /<span class="timer-seconds"><svg/)
  // Le seuil se règle : à dix secondes, huit pressent ; d'office, non.
  assert.match(await chrono(8_000, { urgence: 10 }), /<span class="timer-seconds urgent"><svg class="icon"/)
  assert.doesNotMatch(await chrono(8_000), /urgent/)
  // En pause, l'icône de la pause, pas le sablier : la pause n'est pas une urgence.
  const fige = await chrono(4_000, { frozenMs: 4_000 })
  assert.doesNotMatch(fige, /urgent/)
  assert.match(fige, /<span class="timer-seconds paused"><svg class="icon"/)
  // Le sablier est celui de l'application, le même dessin que « Prendre son temps ».
  const { Icon } = await import(url('components/Icon.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  const dessin = renderToStaticMarkup(React.createElement(Icon, { name: 'hourglass' }))
  assert.ok(presse.includes(dessin), 'le sablier de l’application')
  // Au Cabinet, des manches de 25 à 120 secondes : cinq secondes arrivaient tard. La tête rendue le dit à son chrono même — à huit
  // secondes de l'échéance, il presse déjà ; à douze, pas encore : seul le texte de l'appel se lisait, et le seuil ramené à cinq
  // passait toutes les épreuves (la relecture du lot page-1).
  assert.match(source('views/cabinet/Partie.tsx'), /<TimerBar deadline=\{chrono\.echeance\} duration=\{chrono\.dureeMs \/ 1000\} frozenMs=\{chrono\.figeMs\} urgence=\{SECONDES_QUI_PRESSENT\} \/>/)
  const tete = async (ms: number) =>
    /<header class="cab-tete-partie">[\s\S]*?<\/header>/.exec(await laPartie(vues.pari, { chrono: { echeance: serverNow() + ms, dureeMs: 45_000 } }))?.[0] ?? ''
  assert.match(await tete(8_000), /<span class="timer-seconds urgent"><svg class="icon"/)
  assert.doesNotMatch(await tete(12_000), /urgent/)
  // La feuille : la barre s'épaissit, plus fort que les thèmes, qui posent sa hauteur (0,3,0) ; les secondes s'appuient d'un
  // trait, plus faible qu'eux : un thème qui pose le sien le garde — sous Héros, le trait de l'urgence, plus fort, remplaçait le
  // contour noir de bande dessinée par un trait rouge sur le chiffre rouge (la relecture du lot page-1).
  const css = readFileSync(path.join(client, 'styles.css'), 'utf8')
  assert.match(css, /\n:root \.timer \.timer-track\.urgent \{[^}]*transform: scaleY\([\d.]+\);/)
  assert.match(css, /\n\.timer-seconds\.urgent \{[^}]*-webkit-text-stroke: [^;]+;/)
  assert.doesNotMatch(css, /:root[^{,]*\.timer-seconds\.urgent \{[^}]*-webkit-text-stroke/)
  // Un thème qui borde sa barre la garde telle quelle à l'urgence : `scaleY` en épaississait le bord du haut et celui du bas, pas
  // ceux des côtés — sous Héros, cinq pixels contre trois. Et un thème qui pose le trait de ses secondes le pose plus fort que
  // celui de l'urgence.
  const dossier = path.join(client, 'themes')
  const bordees: string[] = []
  for (const fichier of readdirSync(dossier).filter(f => f.endsWith('.css'))) {
    const cle = fichier.replace(/\.css$/, '')
    const feuille = readFileSync(path.join(dossier, fichier), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const regles = (sel: string) => [...feuille.matchAll(new RegExp(`(?:^|\\n)([^{}\\n]*${echapper(sel)}) \\{([^}]*)\\}`, 'g'))]
    if (regles('.timer-track').some(r => /(?:^|[\s;])border(?:-(?:top|bottom|width))?\s*:/.test(r[2]))) {
      bordees.push(cle)
      assert.match(feuille, new RegExp(`\\n:root\\[data-theme='${cle}'\\] \\.timer \\.timer-track\\.urgent \\{ transform: none; \\}`), `${cle} borde sa barre : l’urgence ne l’étire pas`)
    }
    for (const [, sel, corps] of regles('.timer-seconds')) {
      if (/-webkit-text-stroke/.test(corps)) assert.match(sel, new RegExp(`^:root\\[data-theme='${cle}'\\] `), `${cle} pose le trait de ses secondes plus fort que l’urgence : ${sel}`)
    }
  }
  // La lecture voit bien les barres bordées d'aujourd'hui : sans elles, la boucle ne prouverait rien.
  for (const cle of ['heros', 'gameboy', 'plage']) assert.ok(bordees.includes(cle), `${cle} borde sa barre`)
})

test('la bande d’une manche : ce que la tête et le pied collés laissent, posé sur la page en pixels de la page — mesuré à l’ouverture de l’étape, il ne regrandit pas', async () => {
  // La question collée de l'Épingle, sa carte et le tableau du Détail se règlent sur elle (`--cab-tete`, `--cab-fenetre`,
  // `--cab-place`) : sans elle, la question et le tableau se collaient sous la tête, et la carte se bornait à toute la fenêtre —
  // seul le rendu l'aurait vu. Et elle dépendait du pied, qui change en pleine manche : Éclairer servi, la carte-bonus le quitte,
  // et en 277 × 492 le tableau du Détail regrandissait de onze pixels, ses titres avec lui, sous le doigt qui venait d'Éclairer ;
  // la carte de l'Épingle passait de 188 à 241 pixels (la relecture du lot page-1). Mesurée à l'ouverture de l'étape, elle ne fait
  // plus que se resserrer quand le pied grandit — « Pas à pas » ouvert, la carte-bonus encore là —, et revient à son ouverture.
  type Ouverture = { cle: string } | null
  const { poserLaBande, TETE_COLLEE, PIED_COLLE, QUESTION_COLLEE, AIR_SOUS_LA_QUESTION } = (await import(url('views/cabinet/bande.ts'))) as {
    poserLaBande: (page: object, fenetre: { innerWidth: number; innerHeight: number }, cle: string | null, avant: Ouverture) => Ouverture
    TETE_COLLEE: string
    PIED_COLLE: string
    QUESTION_COLLEE: string
    AIR_SOUS_LA_QUESTION: number
  }
  // Un faux élément : la page d'une partie, le texte du téléphone à 130 % posé en zoom, sur un écran de 360 × 640.
  const hauteurs: Record<string, number> = { [TETE_COLLEE]: 116, [PIED_COLLE]: 128, [QUESTION_COLLEE]: 60 }
  const posees: Record<string, string> = {}
  const page = {
    querySelector: (s: string) => (s in hauteurs ? { offsetHeight: hauteurs[s] } : null),
    currentCSSZoom: 1.3,
    style: { setProperty: (k: string, v: string) => void (posees[k] = v) },
  }
  let fenetre = { innerWidth: 360, innerHeight: 640 }
  const place = (pied: number, haut = 640) => `${Math.floor(haut / 1.3 - 116 - pied - 60 - AIR_SOUS_LA_QUESTION)}px`
  let o = poserLaBande(page, fenetre, 'p:0:1', null)
  // En pixels de la page : la fenêtre ramenée au zoom (640 / 1,3) ; la place, ce que laissent la tête, le pied, la question et l'air.
  assert.deepEqual(posees, { '--cab-tete': '116px', '--cab-fenetre': '492px', '--cab-place': place(128) })
  // Éclairer a servi : la carte-bonus quitte le pied, et rien ne regrandit sous le doigt.
  hauteurs[PIED_COLLE] = 68
  o = poserLaBande(page, fenetre, 'p:0:1', o)
  assert.equal(posees['--cab-place'], place(128))
  // « Pas à pas » ouvert, la carte-bonus encore au pied : la bande se resserre, pour que la question et la carte tiennent encore ;
  // refermé, elle revient à son ouverture.
  hauteurs[PIED_COLLE] = 180
  o = poserLaBande(page, fenetre, 'p:0:1', o)
  assert.equal(posees['--cab-place'], place(180))
  hauteurs[PIED_COLLE] = 128
  o = poserLaBande(page, fenetre, 'p:0:1', o)
  assert.equal(posees['--cab-place'], place(128))
  // La barre d'adresse qui se replie grandit la fenêtre : rien ne regrandit ; qui se redéplie la rapetisse : tout se resserre.
  o = poserLaBande(page, { innerWidth: 360, innerHeight: 700 }, 'p:0:1', o)
  assert.deepEqual([posees['--cab-fenetre'], posees['--cab-place']], ['492px', place(128)])
  o = poserLaBande(page, { innerWidth: 360, innerHeight: 600 }, 'p:0:1', o)
  assert.deepEqual([posees['--cab-fenetre'], posees['--cab-place']], ['462px', place(128, 600)])
  // La tête suit toujours : la question se colle sous elle, quoi qu'il arrive.
  hauteurs[TETE_COLLEE] = 120
  o = poserLaBande(page, fenetre, 'p:0:1', o)
  assert.equal(posees['--cab-tete'], '120px')
  hauteurs[TETE_COLLEE] = 116
  // Entre deux manches (la révélation, la mise : pas d'étape), la bande d'à présent, et l'ouverture gardée — la pause de « Quitter ? »
  // passée, la manche reprend où elle en était.
  hauteurs[PIED_COLLE] = 68
  const pendant = poserLaBande(page, fenetre, null, o)
  assert.equal(posees['--cab-place'], place(68))
  assert.equal(pendant, o)
  o = poserLaBande(page, fenetre, 'p:0:1', pendant)
  assert.equal(posees['--cab-place'], place(128))
  // L'étape suivante se mesure à son ouverture ; le téléphone tourné aussi.
  o = poserLaBande(page, fenetre, 'p:1:1', o)
  assert.equal(posees['--cab-place'], place(68))
  hauteurs[PIED_COLLE] = 128
  fenetre = { innerWidth: 480, innerHeight: 800 }
  o = poserLaBande(page, fenetre, 'p:1:1', o)
  assert.deepEqual([posees['--cab-fenetre'], posees['--cab-place']], ['615px', place(128, 800)])
  // Sans zoom, sans pied ni question — une manche du Pari : la fenêtre telle quelle, rien de retiré pour ce qui n'y est pas.
  delete hauteurs[PIED_COLLE]
  delete hauteurs[QUESTION_COLLEE]
  poserLaBande({ ...page, currentCSSZoom: undefined }, { innerWidth: 360, innerHeight: 640 }, 'q:0:1', null)
  assert.deepEqual(posees, { '--cab-tete': '116px', '--cab-fenetre': '640px', '--cab-place': `${640 - 116 - AIR_SOUS_LA_QUESTION}px` })
  // La page de la partie porte la mesure, à sa racine, et ne la refait qu'au besoin : à l'étape ou à la forme qui changent, et quand
  // la tête, le pied, la question ou la fenêtre changent de taille — pas à chaque lettre du Mot ni à chaque cran du Filet.
  const partie = source('views/cabinet/Partie.tsx')
  assert.match(partie, /<div ref=\{page\} className="player-shell cab-page cab-partie">/)
  assert.match(partie, /useBandeDeLaManche\(page, cleDeLaBande, formeDeLaBande\)/)
  assert.match(partie, /\}, \[page, cle, forme\]\)/)
  // Ce qui borne la bande n'a qu'une copie, que la partie, le Mot et le rendu lisent.
  for (const f of ['views/cabinet/Partie.tsx', 'views/cabinet/jeux/MotMystere.tsx']) {
    assert.doesNotMatch(source(f), /\.cab-pied-partie:not\(\.cab-pied-pose\)|querySelector\('\.cab-tete-partie'\)/, f)
  }
  assert.match(source('views/cabinet/jeux/MotMystere.tsx'), /bandeALEcran\(document, window\.innerHeight\)/)
  const rendu = readFileSync(path.join(client, '../../server/scripts/rendu-cabinet.ts'), 'utf8')
  assert.doesNotMatch(rendu, /\.cab-pied-partie:not\(\.cab-pied-pose\)|querySelector\('\.cab-tete-partie'\)/)
  assert.match(rendu, /from '\.\.\/\.\.\/client\/src\/views\/cabinet\/bande'/)
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
  // Ce que vaut la réponse, sur la ligne de la question ; « Reculer d'un pas » seul sur la sienne, sous le tableau : une ligne de
  // moins entre le tableau et ses titres.
  assert.match(html, /<div class="cab-tete-question"><h2 class="cab-question cab-surtitre">[^<]*<\/h2><p class="cab-vaut">Ta réponse vaut /)
  assert.match(html, /<div class="cab-detail-gestes"><button type="button" class="btn cab-reculer">(?:(?!<\/button>).)*<\/button><\/div>/)
  assert.ok(html.indexOf('cab-detail-cadre') < html.indexOf('cab-detail-gestes') && html.indexOf('cab-detail-gestes') < html.indexOf('cab-titres'))
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
  // Le cadre passe à chaque jeu où sont ses images, et « Mes réponses » aussi ; tous deux y ajoutent comment la manche s'est
  // tranchée (`fin` : la Réplique quittée au bon mot le dit, `cabinet-ecran-neufs.test.ts`) — « Mes réponses » le taisait, et c'est
  // le seul écran où l'on revoit une manche quittée.
  assert.match(partie, /<ecran\.Revelation corps=\{r\.corps\} partie=\{vue\.id\} tirage=\{r\.tirage\} fin=\{r\.fin\} \/>/)
  assert.match(source('views/cabinet/Bilan.tsx'), /<ecran\.Revelation corps=\{m\.revelation\.corps\} partie=\{vue\.id\} tirage=\{m\.revelation\.tirage\} fin=\{m\.revelation\.fin\} \/>/)
})

test('la feuille du Détail et de la Frise : le cadre du tableau à hauteur fixe, les années en chiffres droits, le nom du tableau avant lui', () => {
  const css = readFileSync(path.join(client, 'styles.css'), 'utf8')
  const debut = css.indexOf('/* ── Le Cabinet de curiosités')
  const section = css.slice(debut, css.indexOf('/* ── ', debut + 10)).replace(/\/\*[\s\S]*?\*\//g, '')
  // Le cadre garde sa hauteur d'un cadrage à l'autre, d'un tableau en largeur à un tableau en hauteur : rien ne saute sous le doigt.
  // Et il se colle sous la tête de la partie, sur un sol plein : en 360 × 640, le tableau et ses quatre titres ne tenaient pas
  // ensemble (688 px pour 540), et Jeanne faisait des allers-retours pendant cinquante-cinq secondes (la tablée du 25 octobre 2026).
  assert.match(section, /\.cab-detail-cadre \{ position: sticky; top: var\(--cab-tete, 0px\); z-index: 1;[^}]*height: [^;]+;[^}]*background: [^;]*var\(--bg\)[^;]*;[^}]*\}/)
  // Sa hauteur ne suit que la fenêtre et la bande que mesure la partie, jamais l'image ; et il laisse sous lui la place d'un titre
  // de trois lignes : en 277 × 492, la carte-bonus au pied, le cadre et un titre long ne tenaient pas ensemble.
  assert.match(section, /\.cab-detail-cadre \{[^}]*height: min\(0\.36 \* var\(--cab-fenetre, 100dvh\), 240px, var\(--cab-place, 100dvh\) - 120px\); min-height: 150px;/)
  // Collé, il couvre aussi les 8 pixels du fondu du bas de la tête — deux de plus pour ses coins arrondis — : ce qui passait
  // dessous s'y lisait en trace entre la tête et lui (la relecture du lot page-1). Son ombre pleine reste dans l'écart qui le
  // sépare de la ligne d'au-dessus (14 px) : la page en haut, elle ne couvre rien.
  const ombre = /\.cab-detail-cadre \{[^}]*box-shadow: 0 -(\d+)px 0 (\d+)px var\(--bg\);/.exec(section)
  assert.ok(ombre, 'le cadre couvre le fondu de la tête')
  const couvre = Number(ombre[1]) + Number(ombre[2])
  assert.ok(couvre >= 8 + 2 && couvre < 14, `${couvre} px couverts au-dessus du cadre`)
  assert.match(section, /\.cab-tete-partie \{[^}]*background: linear-gradient\(180deg, var\(--bg\) calc\(100% - 8px\), transparent\);/)
  assert.match(section, /\.cab-manche \{ gap: 14px; \}/)
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
  // prend : dorée en jouant ou doublée, elle ne le prend que si elle n'en avait pas — le serveur garde le premier, et la fin le
  // dit (`BilanVu.devientSonCartel`, lu de la ligne que la base rend). Gagnée avec le sien puis dorée à 9 sur 9, le bilan disait
  // « Son cartel » d'une manche que l'œuvre rouverte ne montrait pas ; achetée puis dorée en jouant, il taisait celui qu'elle
  // venait de prendre (`cabinet-poussiere.test.ts`, par le vrai serveur). Relu sans la fin — ni `gains` ni `devientSonCartel` :
  // un geste rejoué, sa réponse perdue —, il le dit encore d'une œuvre gagnée, qui l'a pris à coup sûr, et ne promet rien d'une
  // dorée ou d'une doublée ; la fin dite, la base seule en décide, gagnée comprise.
  const ecran = (await ecrans()).pari
  const g = vues.gagnee
  // La chasse gagnée de Hugo : la fin a dit que la partie devient son cartel, et ses gains, que seule la fin porte.
  assert.equal(g.bilan!.devientSonCartel, true)
  assert.ok(g.bilan!.gains, 'la fin porte ses gains')
  const appris = { gagnee: 'en la gagnant', 'gagnee-doree': 'en la gagnant', doree: 'en la dorant', double: 'en la rejouant' } as const
  for (const issue of ['gagnee', 'gagnee-doree', 'doree', 'double'] as const) {
    for (const devient of [true, false]) {
      for (const fin of [true, false]) {
        const { devientSonCartel: _, gains, ...sans } = g.bilan!
        const vue = { ...g, bilan: { ...sans, issue, ...(fin && { gains }), ...(devient && { devientSonCartel: true as const }) } } as VueDeLaPartie
        const t = texte(await rendu('views/cabinet/Bilan', 'BilanDeLaPartie', { vue, ecran, onMusee: rien }))
        const sonCartel = devient || (!fin && (issue === 'gagnee' || issue === 'gagnee-doree'))
        const titre = `${sonCartel ? 'Son cartel : ce' : 'Ce'} que tu as appris ${appris[issue]}`
        const ou = `${issue}, ${devient ? 'son cartel dit' : 'sans le dire'}, ${fin ? 'la fin' : 'relu'}`
        assert.match(t, new RegExp(`${titre} ${lu(g.bilan!.cartel!.sujet)}`), ou)
        if (!sonCartel) assert.doesNotMatch(t, /Son cartel/, ou)
      }
    }
  }
  // Par les routes : la chasse gagnée de Basile, la réponse de son dernier geste perdue en route. Renvoyé, le geste reçoit 409 et
  // la partie relue en base — la mémoire l'a oubliée à la fin —, sans la fin : le bilan redit pourtant « Son cartel ».
  const basile = await inscrireProfil(b.banc.url, 'basile', 'Basile')
  const finie = await unPariParfait(b, basile, ok(await commencer(b, basile, { origine: 'chasse', oeuvre: 'lecon', carte: null }), 'la chasse de Basile'))
  assert.deepEqual([finie.bilan?.issue, finie.bilan?.devientSonCartel], ['gagnee-doree', true])
  const renvoi = await jouer(b, basile, { id: finie.id, rang: finie.rang - 1 }, { quoi: 'repondre', manche: 2, reponse: { pari: { choix: 0 } } })
  assert.equal(renvoi.status, 409)
  const relue = (renvoi.corps as unknown as { partie: VueDeLaPartie }).partie
  assert.deepEqual([relue.bilan?.issue, relue.bilan?.devientSonCartel, relue.bilan?.gains], ['gagnee-doree', undefined, undefined], 'relue sans la fin')
  const t = texte(await rendu('views/cabinet/Bilan', 'BilanDeLaPartie', { vue: relue, ecran, onMusee: rien }))
  assert.match(t, new RegExp(`Son cartel : ce que tu as appris en la gagnant ${lu(relue.bilan!.cartel!.sujet)}`))
  // Les mots d'une seule source : le bilan ne les recopie pas.
  assert.doesNotMatch(source('views/cabinet/Bilan.tsx'), /en la gagnant/)
  // Le glossaire de « Comment ça marche ? » non plus ne dit pas qu'un cartel vient toujours de la partie qui l'a gagnée.
  assert.match(GLOSSAIRE.cartel.sens, /en la gagnant ou en la rejouant/)
  // Ce que la page dit d'un bilan relu, la boucle plus haut l'éprouve : le commentaire du champ partagé n'a qu'à ne pas le
  // contredire, et à dire où vit la règle. « Le bilan ne dit « Son cartel » que là » se lisait comme une règle, et la page la
  // démentait ; ses mots, eux, restent libres.
  const lesVues = readFileSync(path.resolve(client, '../..', 'shared/cabinet/vues.ts'), 'utf8')
  const commentaire = /\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*devientSonCartel\?: true/.exec(lesVues)?.[1] ?? ''
  assert.ok(commentaire, 'le champ a son commentaire')
  assert.doesNotMatch(commentaire, /que là/)
  assert.match(commentaire, /`titreAuBilan`/)
  assert.match(source('views/cabinet/Cartel.tsx'), /export function titreAuBilan\b/)
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
  // La page d'un serveur sans l'Épingle (`sansLEpingle`) : Coup d'œil s'y trouve, et son jeu n'y est pas livré.
  const riche = sansLEpingle({ ...page, poussiere: 100_000 })
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
  assert.ok(!riche.jeux.includes(JEU_DE_L_OEUVRE['coup-d-oeil']))
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
  // le toast que le même départ aurait rendu (`cabinet-regles.test.ts`, la règle seule ; `cabinet-poussiere.test.ts`, le refus des
  // chasses par le vrai serveur).
  // La page d'un serveur sans l'Épingle (`sansLEpingle`) : les neuf jeux sont livrés, l'ordre des refus se rend sur elle.
  const sansElle = sansLEpingle()
  const sansChasse = { ...sansElle, chasses: { ...sansElle.chasses, restent: 0 } }
  const raisonDe = (html: string, debut: string) => raisonsDe(html).get(boutonsDe(html).find(x => x.texte.startsWith(debut))!.raison!)
  // À lui, à un jeu pas livré (l'Épingle) : la raison est qu'il n'a plus de chasse, et le jeu à venir ne se dit pas.
  assert.ok(!sansElle.jeux.includes(JEU_DE_L_OEUVRE['coup-d-oeil']))
  const aLui = await lOeuvre('coup-d-oeil', {}, sansChasse)
  assert.equal(raisonDe(aLui, 'La rejouer'), PLUS_DE_CHASSE)
  assert.doesNotMatch(texte(aLui), new RegExp(JEU_PAS_LIVRE))
  // Une œuvre qui manque, à un jeu pas livré : de même.
  const aVenir = sansElle.salles.flatMap(s => s.oeuvres).find(o => !o.possedee && o.bientot)!
  assert.equal(raisonDe(await lOeuvre(aVenir.cle, {}, sansChasse), 'Partir à sa recherche'), PLUS_DE_CHASSE)
  // Une partie qui attend se dit avant tout.
  assert.equal(raisonDe(await lOeuvre('coup-d-oeil', {}, { ...sansChasse, enCours: vues.pari }), 'La rejouer'), texte(laPartieAttend(vues.pari.jeu)).trim())
  // Des chasses qui restent : le jeu qui n'est pas livré.
  assert.equal(raisonDe(await lOeuvre('coup-d-oeil', {}, sansElle), 'La rejouer'), JEU_PAS_LIVRE)
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
  // Les neuf jeux ; « Reprendre », sous la raison, ramène à la partie qui attend (section 18).
  eteints(boutonsDe(libres).filter(x => x.texte !== 'Reprendre'), libres)
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
  // La raison que la reprise montre aussi : au gros bouton du musée, ses mots à lui ; ailleurs, ceux du refus, importés.
  assert.doesNotMatch(source('views/cabinet/PartieQuiAttend.tsx'), /t’attend :|reprends-la ou quitte/)
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
  // Ce que disent les marques, en mots, une fois, sous la grille — chaque case le redit à l'oreille.
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
  // La phrase vit dans la règle du Mot (`longueurRefusee`, `shared/cabinet/jeux/mot.ts`), que la page importe : recopiée, un mot
  // retouché d'un seul côté, la page contredisait le serveur. Cette épreuve les tient ensemble, par la route.
  assert.doesNotMatch(source('views/cabinet/jeux/MotMystere.tsx'), /Il faut/, 'la page ne recopie pas la phrase')
  const v = ok(await commencer(b, ines, { origine: 'libre', jeu: 'mot', carte: null }), 'un Mot de plus')
  const m = v.enCours as MotMontre
  const refus = await jouer(b, ines, v, { quoi: 'essai', manche: 0, lettres: 'AB' })
  assert.equal(refus.status, 400)
  const { MOT } = (await import(url('views/cabinet/jeux/MotMystere.tsx'))) as { MOT: { localDe: (m: MotMontre) => object } }
  const html = await laPartie(v, { local: { ...MOT.localDe(m), dit: true } })
  const dit = /<p class="cab-raison cab-longueur" role="status">(.*?)<\/p>/.exec(html)?.[1]
  assert.ok(dit, 'la longueur dite')
  assert.equal(texte(dit).trim(), (refus.corps as unknown as { error: string }).error)
  const { longueurRefusee } = await import('../../shared/cabinet/jeux/mot')
  assert.equal(texte(dit).trim(), longueurRefusee(m.longueur))
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
  // Et un grand pas de chaque côté, sous la piste : sans glisser, « Un cran de plus » coûtait soixante touchers (Camille, à la
  // tablée), et la ramette restait hors d'atteinte.
  assert.match(html, /<div class="cab-grands-pas"><button type="button" class="cab-cran cab-grand-pas" aria-label="Un grand pas de moins">.*?<\/button><button type="button" class="cab-cran cab-grand-pas" aria-label="Un grand pas de plus">.*?<\/button><\/div>/)
  assert.ok(html.indexOf('cab-filet-curseur') < html.indexOf('cab-grands-pas') && html.indexOf('cab-grands-pas') < html.indexOf('cab-tailles'))
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
  // Un grand pas : un dixième de la piste, à son cran près, jamais moins d'un cran ni au-delà de ses bornes ; de là où le curseur
  // part, toute valeur de la piste se prend en cinq grands pas et une moitié de grand pas en crans — quinze au plus : la plus
  // longue piste que tire le Filet a 290 crans, un grand pas de 29 — sans glisser, au lecteur d'écran, d'un pouce qui tremble (la
  // tablée du 25 octobre 2026 : soixante touchers de « Un cran de plus » pour Camille). « Dix crans », écrit d'abord, ne valait
  // que pour les pistes écrites à la main : une piste de 280 en demande quatorze (la relecture du lot page-1). D'où les pistes
  // mêmes que le Filet tire, années et estimations, à travers les valeurs qu'il pose.
  const { grandPas } = (await import(url('views/cabinet/jeux/Filet.tsx'))) as { grandPas: (m: FiletMontre, l: Local, sens: 1 | -1) => Local }
  const CRANS_AU_PLUS = 15
  const pistes = new Map<string, FiletMontre['piste']>()
  for (const piste of [p, { min: 0, max: 540, pas: 3 }, { min: 1800, max: 1919, pas: 1 }, { min: 0, max: 20_000, pas: 100 }, { min: 0, max: 7, pas: 1 }]) pistes.set(JSON.stringify(piste), piste)
  const tirees = (valeur: number, annee: boolean) => {
    for (const h of [0, 0.37, 0.999]) {
      const piste = pisteDuFilet(valeur, annee, () => h, 2026)
      if (piste) pistes.set(JSON.stringify(piste), piste)
    }
  }
  for (let valeur = 10; valeur < 2_000_000; valeur *= 1.009) {
    tirees(Math.round(valeur), false)
    tirees(Number(valeur.toFixed(2)), false)
  }
  for (const annee of [1515, 1789, 1871, 1914, 1969, 1980]) tirees(annee, true)
  assert.ok(pistes.size > 300, `${pistes.size} pistes`)
  let pire = 0
  for (const piste of pistes.values()) {
    const mm = { ...m, piste } as FiletMontre
    const ici: Local = { x: milieuDeLaPiste(piste), taille: 'moyen' }
    const pas = grandPas(mm, ici, 1).x - ici.x
    assert.ok(pas >= piste.pas - 1e-9, `${JSON.stringify(piste)} : au moins un cran (${pas})`)
    assert.ok(Math.abs(pas - (piste.max - piste.min) / 10) <= piste.pas / 2 + 1e-9 || pas === piste.pas, `${JSON.stringify(piste)} : un dixième de la piste (${pas})`)
    assert.equal(grandPas(mm, bouger(mm, ici, piste.max), 1).x, piste.max)
    assert.equal(grandPas(mm, bouger(mm, ici, piste.min), -1).x, piste.min)
    // Pour chaque place : le moins de crans qu'il lui faut, après cinq grands pas au plus d'un côté ou de l'autre — dans un sens
    // puis dans l'autre au besoin : une borne haute hors des crans (0 à 4100, de 21 en 21) se prend telle quelle, et « Un cran de
    // moins » y mène au cran d'en dessous du dernier.
    const crans = new Map<number, number>()
    const retenir = (x: number, c: number) => crans.set(x, Math.min(crans.get(x) ?? Infinity, c))
    for (const sens of [-1, 1] as const) {
      let l = ici
      for (let g = 0; g <= 5; g++) {
        if (g > 0) l = grandPas(mm, l, sens)
        const vus = new Set([l.x])
        let front = [l]
        retenir(l.x, 0)
        for (let c = 1; c <= CRANS_AU_PLUS && front.length; c++) {
          const suivants: Local[] = []
          for (const d of front) {
            for (const vers of [-1, 1] as const) {
              const lc = cran(mm, d, vers)
              if (vus.has(lc.x)) continue
              vus.add(lc.x)
              retenir(lc.x, c)
              suivants.push(lc)
            }
          }
          front = suivants
        }
      }
    }
    for (let k = 0; k * piste.pas <= piste.max - piste.min + 1e-9; k++) {
      const auCran = bouger(mm, ici, piste.min + k * piste.pas).x
      assert.ok(crans.has(auCran), `${JSON.stringify(piste)} : ${auCran} hors d’atteinte`)
      pire = Math.max(pire, crans.get(auCran)!)
    }
  }
  assert.ok(pire <= CRANS_AU_PLUS, `${pire} crans`)
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
  // Raté, son filet ne se lit pas comme un gain : « Le grand filet ★☆☆ » s'entendait « une étoile sur trois » (Hugo, au lecteur
  // d'écran) — il dit ce qu'il valait, en mots, sans étoiles à compter.
  const lance = /<p class="cab-ligne cab-filet-lance">(.*?)<\/p>/.exec(cote)?.[1] ?? ''
  assert.equal(texte(lance).trim(), `Le grand filet (il valait ${ETOILES_DU_FILET.grand} étoile${ETOILES_DU_FILET.grand > 1 ? 's' : ''})`)
  assert.doesNotMatch(lance, /sentier-etoiles|aria-label="\d étoiles? sur 3"/)
  // Dans le filet, ses étoiles se montrent : elles sont gagnées.
  assert.match(/<p class="cab-ligne cab-filet-lance">(.*?)<\/p>/.exec(html)?.[1] ?? '', new RegExp(`aria-label="${ETOILES_DU_FILET.petit} étoiles? sur 3"`))
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
    ['MotMystere', 'mot', ['etatDesTouches', 'longueurRefusee']],
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
  // Dès le premier essai, la ligne à taper revient entre la tête et le clavier collés, d'autant qu'il faut : au premier, elle restait
  // sous le clavier (Jeanne a tapé C-O-U-L-E-U-R sans rien voir s'écrire, à la tablée du 25 octobre 2026), et centrée dans la
  // fenêtre dès le deuxième, c'est la question qui passait sous la tête.
  const codeDuMot = mot.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(codeDuMot, /essais\.length === 0/)
  assert.doesNotMatch(codeDuMot, /scrollIntoView/)
  // La bande, celle même que la partie mesure (`bande.ts`) : le Mot en avait sa copie.
  assert.match(mot, /defilementPourLaLigne\(ligne\.getBoundingClientRect\(\), bandeALEcran\(document, window\.innerHeight\)\)/)
  assert.match(mot, /window\.scrollBy\(/)
  // Le clavier de l'ordinateur, posé le temps de la manche, et retiré.
  assert.match(mot, /window\.addEventListener\('keydown', clavier\)/)
  assert.match(mot, /return \(\) => window\.removeEventListener\('keydown', clavier\)/)
})

test('la ligne à taper du Mot se ramène entre la tête et le clavier collés, juste assez : une règle pure, sur les boîtes que la page mesure', async () => {
  type Boite = { top: number; bottom: number }
  const { defilementPourLaLigne } = (await import(url('views/cabinet/jeux/MotMystere.tsx'))) as { defilementPourLaLigne: (ligne: Boite, bande: Boite) => number }
  // Mesurées en 277 × 492, le texte à 130 % (la tablée du 25 octobre 2026) : la ligne sous le clavier, la bande du bas de la tête au
  // haut du clavier. Elle remonte de son débord et d'un souffle — pas au milieu : la question y passait sous la tête.
  assert.equal(defilementPourLaLigne({ top: 350, bottom: 393 }, { top: 100, bottom: 328 }), 69)
  // Déjà dans la bande : rien ne bouge.
  assert.equal(defilementPourLaLigne({ top: 200, bottom: 243 }, { top: 100, bottom: 328 }), 0)
  assert.equal(defilementPourLaLigne({ top: 100, bottom: 328 }, { top: 100, bottom: 328 }), 0)
  // Sous la tête (un retour en arrière, la page défilée) : elle redescend.
  assert.equal(defilementPourLaLigne({ top: 60, bottom: 103 }, { top: 100, bottom: 328 }), -44)
  // Plus haute que la bande : son haut sous la tête, jamais caché par elle.
  assert.equal(defilementPourLaLigne({ top: 400, bottom: 700 }, { top: 100, bottom: 328 }), 296)
  // Ce que disent les marques vient sous la grille : au-dessus, elle poussait la ligne à taper sous le clavier.
  const html = await laPartie(vues.mot)
  assert.ok(html.indexOf('class="cab-mot-grille"') < html.indexOf('class="cab-legende"'), 'la légende sous la grille')
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
  // Les deux grands pas tiennent sur leur rangée quelle que soit l'unité : « + 24 épisodes » sur une ligne chacun, côte à côte,
  // élargissaient la page de 21 pixels en 277 × 492 (le rendu de la relecture du lot page-1). Chacun sa colonne, qui se réduit, et
  // son mot passe à la ligne ; jamais le signe sans son nombre (une espace insécable, `Filet.tsx`).
  assert.match(section, /\.cab-grands-pas \{[^}]*display: grid; grid-template-columns: repeat\(2, minmax\(0, max-content\)\);[^}]*justify-content: space-between;/)
  const grand = /\.cab-cran\.cab-grand-pas \{([^}]*)\}/.exec(section)?.[1] ?? ''
  assert.doesNotMatch(grand, /nowrap/)
  assert.match(grand, /height: auto; min-height: 44px;/)
  assert.match(source('views/cabinet/jeux/Filet.tsx'), /`−\\u\{a0\}\$\{grand\}`[\s\S]*`\+\\u\{a0\}\$\{grand\}`/)
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
  // Deux réveils qui se suivent avant qu'on ait lu le premier se fondent par la fonction même du serveur : l'épreuve « deux réveils
  // se fondent à la page comme au serveur » les éprouve, une fois.
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
  assert.match(app, /const recevoir = useCallback\(\(p: PageDuCabinet\) => \{\s*setEtat\(\{ e: 'pret', page: p \}\)\s*if \(p\.reveil\) setReveil\(r => fondreLesReveils\(r, p\.reveil\) \?\? null\)/)
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

test('deux réveils se fondent à la page comme au serveur, par une seule fonction : chaque gardien une fois, neuf s’il l’était dans l’un, la première luciole', async () => {
  // La page et le serveur en avaient chacun sa copie (`fondreDesReveils`, `fondreLesReveils`) : l'une évoluée seule, ils ne
  // fondaient plus deux réveils de la même façon. Une seule, pure, dans `shared/cabinet/vues.ts`, que les deux importent.
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const serveur = (f: string) => readFileSync(path.resolve(client, '../../server/src/core/cabinet', f), 'utf8')
  assert.match(source('views/CabinetApp.tsx'), /import \{[^}]*\bfondreLesReveils\b[^}]*\} from '\.\.\/\.\.\/\.\.\/shared\/cabinet\/vues'/)
  assert.match(serveur('magasin.ts'), /import \{[^}]*\bfondreLesReveils\b[^}]*\} from '\.\.\/\.\.\/\.\.\/\.\.\/shared\/cabinet\/vues'/)
  for (const [ou, s] of [
    ['views/cabinet/reveils.ts', source('views/cabinet/reveils.ts')],
    ['views/CabinetApp.tsx', source('views/CabinetApp.tsx')],
    ['core/cabinet/gardiens.ts', serveur('gardiens.ts')],
    ['core/cabinet/magasin.ts', serveur('magasin.ts')],
  ]) {
    assert.doesNotMatch(code(s), /function fondre|fondreDesReveils|const fondre/, `${ou} : pas de copie`)
  }
  const phenix = { gardiens: [{ legendaire: 'lg:phenix', neuf: false }] }
  const deux = { gardiens: [{ legendaire: 'lg:phenix', neuf: true }, { legendaire: 'lg:oracle', neuf: true }], compagnon: COMPAGNON_DE_L_EXPEDITION }
  const scarabee = { gardiens: [{ legendaire: 'lg:scarabee', neuf: true }] }
  const luciole = { gardiens: [], compagnon: COMPAGNON_DE_L_EXPEDITION }
  const cas: [ReveilDesGardiens | null, ReveilDesGardiens | null, ReveilDesGardiens | undefined][] = [
    [phenix, deux, { gardiens: deux.gardiens, compagnon: COMPAGNON_DE_L_EXPEDITION }],
    [deux, phenix, deux],
    [scarabee, deux, { gardiens: [...scarabee.gardiens, ...deux.gardiens], compagnon: COMPAGNON_DE_L_EXPEDITION }],
    [deux, deux, deux],
    [luciole, phenix, { gardiens: phenix.gardiens, compagnon: COMPAGNON_DE_L_EXPEDITION }],
    [phenix, null, phenix],
    [null, scarabee, scarabee],
    [null, null, undefined],
  ]
  for (const [x, y, attendu] of cas) assert.deepEqual(fondreLesReveils(x, y), attendu, JSON.stringify([x, y]))
  // Rien n'y vaut `null` et absent dit rien : la page lui passe le réveil d'une page qui n'en porte pas (`p.reveil`, absent), et le
  // seul qu'il y ait revient tel quel, le même objet.
  const seul = { gardiens: [{ legendaire: 'lg:phenix', neuf: true }] }
  assert.equal(fondreLesReveils(null, seul), seul)
  assert.equal(fondreLesReveils(seul, undefined), seul)
  assert.equal(fondreLesReveils(null, undefined), undefined)
  // Le serveur en fond plus de deux d'un coup : la partie d'hier close, puis la dépense qui rend la page.
  assert.deepEqual(fondreLesReveils(phenix, null, scarabee, luciole), { gardiens: [...phenix.gardiens, ...scarabee.gardiens], compagnon: COMPAGNON_DE_L_EXPEDITION })
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
  assert.match(source('views/CabinetApp.tsx'), /if \(p\.reveil\) setReveil\(r => fondreLesReveils\(r, p\.reveil\) \?\? null\)\s+void nicheApresLeReveil\(p\)/)
})

// ── 19. Ce que la tablée du 25 octobre 2026 ne savait pas lire à l'écran ──
//
// La reprise d'une partie qui attend, d'où qu'on la cherche ; ce que les règles disent au moment où elles comptent — le cadre
// doré, le seuil, « Retenter », ce qu'on emporte en quittant ; « Comment ça marche ? » qui s'ouvre sur l'essentiel ; ce que
// l'oreille entend des étoiles et des « Jouer » ; le titre de l'onglet (`retours/2026-10-25/synthese.md`, axes 2, 7, 8, 11, 13, 14).

/** Une case de la visite, écrite comme le serveur la rend. */
const uneCase = (c: Partial<CaseVue> & Pick<CaseVue, 'jeu' | 'enJeu'>): CaseVue => ({ faite: false, ...c })
/** Une page dont la visite a ces cases, et l'échange pris : seuls les gestes de chaque case. */
const laVisiteDe = (cases: CaseVue[], plus: Partial<PageDuCabinet> = {}): PageDuCabinet => ({
  ...page,
  enCours: null,
  visite: { ...page.visite, cases, echange: { possible: false, refus: 'Tu as déjà changé un jeu aujourd’hui' } },
  ...plus,
})
const enGagnant = { rarete: 'rare' as const, salle: 'erudit' as const }
/** Une œuvre de Léa sans cadre doré — une des quatre de départ : sa Leçon a le sien. */
const aLuiSansCadre = () => page.salles.flatMap(s => s.oeuvres).find(o => o.possedee && !o.doree)!

test('une partie qui attend se reprend de partout : sa case « En cours » et un seul « Reprendre », et les comptes ne retiennent que les cases qui ont une issue', async () => {
  // Rechargée en pleine Frise depuis la visite, Ophélie retombait sur « 1 sur 3 faite », une case « Faite · Commencée » sans
  // bouton, et « Ta partie à la Frise t'attend » en texte nu : seul le musée la reprenait (la tablée du 25 octobre 2026).
  const frise = { ...vues.pari, id: 'la-frise', jeu: 'frise', origine: 'visite' } as VueDeLaPartie
  const cases = [
    uneCase({ jeu: 'frise', enJeu: enGagnant, faite: true, seuil: 6 }),
    uneCase({ jeu: 'pari', enJeu: { rarete: 'commun', salle: 'rempart' }, seuil: 5 }),
    uneCase({ jeu: 'eclair', enJeu: { poussiere: true } }),
  ]
  const attend = laVisiteDe(cases, { enCours: frise })
  const raison = texte(laPartieAttend('frise')).trim()
  const html = await rendu('views/cabinet/Visite', 'Visite', { page: attend, busy: false, onJouer: rien, onEchanger: rien, onReprendre: rien })
  const t = texte(html)
  assert.match(t, /0 sur 3 faite/, 'la case en cours n’est pas faite')
  assert.match(t, new RegExp(`En cours ${JEUX.frise.nom}`))
  assert.doesNotMatch(t, /Commencée/)
  const reprendre = boutonsDe(html).filter(x => x.texte === 'Reprendre')
  assert.equal(reprendre.length, 1, 'un seul « Reprendre »')
  assert.ok(!reprendre[0].eteint)
  // Les deux autres « Jouer » en sourdine, la raison du serveur dite une fois, au-dessus des cases.
  const jouer = boutonsDe(html).filter(x => x.texte === 'Jouer')
  assert.equal(jouer.length, 2)
  assert.ok(jouer.every(j => j.eteint && raisonsDe(html).get(j.raison!) === raison))
  assert.equal([...t.matchAll(new RegExp(echapper(raison), 'g'))].length, 1)
  // Le musée compte de même : la visite n'a rien de fait tant que sa case n'a pas d'issue.
  assert.match(texte(await musee(attend)), /0 sur 3 faite/)
  assert.match(texte(await musee({ ...attend, enCours: null, visite: { ...attend.visite, cases: [{ ...cases[0], issue: 'manquee' }, cases[1], cases[2]] } })), /1 sur 3 faite/)
  // Une chasse ou une libre qui attend : la raison au-dessus de ce qu'elle éteint, et « Reprendre » sous elle — la visite, les
  // jeux libres, une œuvre, l'annonce ; jamais deux.
  const ailleurs = laVisiteDe(
    cases.map((c, k) => (k === 0 ? { ...c, issue: 'gagnee' as const } : c)),
    { enCours: vues.pari },
  )
  const ecransQuiAttendent = [
    await rendu('views/cabinet/Visite', 'Visite', { page: ailleurs, busy: false, onJouer: rien, onEchanger: rien, onReprendre: rien }),
    await rendu('views/cabinet/Visite', 'JouerLibrement', { page: ailleurs, onJouer: rien, onReprendre: rien }),
    await lOeuvre('expose', { onReprendre: rien }, ailleurs),
    await rendu('views/cabinet/Annonce', 'Annonce', { page: ailleurs, demande: { origine: 'chasse', oeuvre: 'expose' }, carte: null, busy: false, onCarte: rien, onCommencer: rien, onRetour: rien, onReprendre: rien }),
  ]
  for (const e of ecransQuiAttendent) {
    assert.equal(boutonsDe(e).filter(x => x.texte === 'Reprendre' && !x.eteint).length, 1, texte(e).slice(0, 80))
    assert.equal([...texte(e).matchAll(new RegExp(echapper(texte(laPartieAttend(vues.pari.jeu)).trim()), 'g'))].length, 1)
  }
  // Rien n'attend : rien à reprendre.
  const sansPartie = await rendu('views/cabinet/Visite', 'Visite', { page: laVisiteDe(cases.slice(1)), busy: false, onJouer: rien, onEchanger: rien, onReprendre: rien })
  assert.equal(boutonsDe(sansPartie).filter(x => x.texte === 'Reprendre').length, 0)
  // La page passe la reprise à chacun : la partie qui attend, rouverte telle que la page la tient.
  const app = source('views/CabinetApp.tsx')
  // Jusqu'à la fin de la balise : un `=>` des autres gestes n'en est pas la fin.
  for (const ecran of ['Visite', 'JouerLibrement', 'Oeuvre', 'Annonce']) assert.match(app, new RegExp(`<${ecran}\\b(?:=>|[^>])*?onReprendre=\\{reprendre\\}`, 's'), ecran)
  // Un bouton neuf de la page passe au lever du doigt (`toucher.test.ts`) : la partie paraît sous lui.
  assert.match(source('views/cabinet/PartieQuiAttend.tsx'), /\{\.\.\.toucher\(/)
  sansJargon(html, 'la visite d’une partie qui attend')
})

test('rechargée sur l’entrée d’une partie qui attend, la page la rouvre sur la même entrée ; sans partie, la marque s’efface', async () => {
  const { partieARouvrir, poserLEntreeDeLaPartie, partieDansLEntree } = await import(url('views/cabinet/ecrans.ts'))
  // « Commencer » depuis la visite, puis recharger : la manche revient à l'écran, sans détour par la visite qui la disait faite.
  const r = historique('/cabinet#visite')
  r.h.replaceState({ fiestappGarde: true }, '')
  poserLEntreeDeLaPartie(r.h)
  assert.equal(partieARouvrir(r.h, vues.pari), vues.pari)
  assert.ok(partieDansLEntree(r.h.state), 'la même entrée, toujours marquée : le retour la consomme comme avant')
  assert.deepEqual([r.longueur(), r.url()], [2, '/cabinet#visite'], 'aucune entrée de plus')
  // Rien n'attend plus — finie d'un autre onglet, close le lendemain : la marque s'efface, les autres repères restent.
  const s = historique('/cabinet#visite')
  s.h.replaceState({ fiestappGarde: true }, '')
  poserLEntreeDeLaPartie(s.h)
  assert.equal(partieARouvrir(s.h, null), null)
  assert.ok(!partieDansLEntree(s.h.state))
  assert.deepEqual(s.h.state, { fiestappGarde: true })
  // Hors de l'entrée d'une partie, rien ne se rouvre : le musée la propose, on la reprend si l'on veut.
  const u = historique('/cabinet')
  assert.equal(partieARouvrir(u.h, vues.pari), null)
  assert.equal(u.longueur(), 1)
  // Ce que la page ouvre, décidé en entier hors de l'effet (`ouvertureAuChargement`) : la partie qui attend, à son écran de jeu ;
  // rien sans elle, ni hors de son entrée. Gardé par le seul texte de son appel, un effet qui ne faisait rien de son résultat
  // passait toutes les épreuves (la relecture du lot page-2).
  const { ouvertureAuChargement } = await import(url('views/cabinet/ecrans.ts'))
  const o = historique('/cabinet#visite')
  poserLEntreeDeLaPartie(o.h)
  assert.deepEqual(ouvertureAuChargement(o.h, vues.pari), { e: 'jeu', vue: vues.pari })
  assert.ok(partieDansLEntree(o.h.state))
  const sans = historique('/cabinet#visite')
  poserLEntreeDeLaPartie(sans.h)
  assert.equal(ouvertureAuChargement(sans.h, null), null)
  assert.ok(!partieDansLEntree(sans.h.state), 'sans partie, la marque s’efface')
  assert.equal(ouvertureAuChargement(historique('/cabinet').h, vues.pari), null)
  // La page le décide à sa première page reçue, celle qui dit la partie qui attend — pas avant, à l'aveugle —, et pose ce que la
  // décision rend, tel quel.
  const app = source('views/CabinetApp.tsx')
  assert.match(app, /const ouverture = vivant \? ouvertureAuChargement\(window\.history, p\.enCours\) : null\s+if \(ouverture\) setEnPartie\(ouverture\)/)
  assert.doesNotMatch(app.slice(app.indexOf('export function CabinetApp')), /effacerLaMarqueAuChargement\(window\.history\)/, 'plus effacée au montage, sans savoir')
})

test('le titre de l’onglet suit l’écran : chaque écran du musée, l’annonce, chaque manche d’une partie et son bilan', async () => {
  const { titreDeLEcran, titreDeLAnnonce, titreDeLaPartie, ecranDeLAdresse } = await import(url('views/cabinet/ecrans.ts'))
  // Hugo, au lecteur d'écran, passait d'un onglet à l'autre : tous disaient « Le Cabinet de curiosités · FiestApp ».
  assert.equal(titreDeLEcran({ e: 'musee' }, page), 'Le Cabinet de curiosités · FiestApp')
  assert.equal(titreDeLEcran({ e: 'visite' }, page), 'La visite du jour · Le Cabinet · FiestApp')
  assert.equal(titreDeLEcran({ e: 'libre' }, page), 'Jouer librement · Le Cabinet · FiestApp')
  assert.equal(titreDeLEcran({ e: 'gardiens' }, page), 'Les gardiens · Le Cabinet · FiestApp')
  assert.equal(titreDeLEcran({ e: 'murs' }, page), 'Tes murs · Le Cabinet · FiestApp')
  assert.equal(titreDeLEcran({ e: 'salle', salle: 'rempart' }, page), `${SALLES.find(s => s.cle === 'rempart')!.nom} · Le Cabinet · FiestApp`)
  assert.equal(titreDeLEcran({ e: 'oeuvre', oeuvre: 'lecon' }, page), 'Leçon · Le Cabinet · FiestApp')
  // Un cadre vide ne se nomme pas — ni à l'écran, ni dans l'onglet : on découvre son œuvre en la gagnant.
  const vide = titreDeLEcran({ e: 'oeuvre', oeuvre: 'expose' }, page)
  assert.doesNotMatch(vide, new RegExp(OEUVRES.find(o => o.cle === 'expose')!.nom))
  assert.match(vide, /^Un cadre vide de la salle de l’Érudit · Le Cabinet · FiestApp$/)
  // Chaque écran de `ecrans.ts` a le sien, distinct.
  const tous = ['', '#visite', '#libre', '#gardiens', '#murs', ...SALLES.map(s => `#salle-${s.cle}`)].map(h => titreDeLEcran(ecranDeLAdresse(h), page))
  assert.equal(new Set(tous).size, tous.length, tous.join(' | '))
  for (const t of tous) assert.match(t, / · FiestApp$/)
  // L'annonce, puis chaque manche — la mise d'avant comprise —, puis le bilan.
  assert.equal(titreDeLAnnonce('detail'), 'Le Détail · Le Cabinet · FiestApp')
  assert.equal(titreDeLaPartie({ jeu: 'detail', manche: 0 }, false), 'Le Détail, manche 1 sur 3 · Le Cabinet · FiestApp')
  assert.equal(titreDeLaPartie({ jeu: 'pari', manche: 2 }, false), 'Le Pari, manche 3 sur 3 · Le Cabinet · FiestApp')
  assert.equal(titreDeLaPartie({ jeu: 'detail', manche: 2 }, true), 'Le Détail, le bilan · Le Cabinet · FiestApp')
  // Posés à chaque écran : la page pour le musée et l'annonce, la partie pour ses manches — `main.tsx` y repose seul le
  // « [preprod] » de la préproduction (il observe le titre).
  assert.match(source('views/CabinetApp.tsx'), /document\.title = titre/)
  assert.match(source('views/cabinet/Partie.tsx'), /document\.title = titreDeLaPartie\(vue, montrerLeBilan\)/)
  assert.match(source('main.tsx'), /new MutationObserver\(prefixer\)\.observe\(titre, \{ childList: true \}\)/)
})

test('les étoiles se disent à l’oreille : leurs glyphes cachés, « 2 étoiles » dit — l’annonce, les règles, le choix du Pari', async () => {
  const { aLOreille, etoilesDites } = await import(url('views/cabinet/EnEtoiles.tsx'))
  // Hugo entendait « étoile noire, étoile noire » (la tablée du 25 octobre 2026).
  assert.equal(etoilesDites(1), '1 étoile')
  assert.equal(etoilesDites(3), '3 étoiles')
  assert.equal(aLOreille(MOTS_DU_PARI.garder), `Garder ${etoilesDites(ETOILES_DU_PARI.garder)}`)
  // Après un nombre, une virgule : « 3 ou 4 ★★ » ne s'entend pas « 3 ou 4 2 étoiles ».
  assert.equal(aLOreille('en 1 ou 2 essais ★★★ · 3 ou 4 ★★ · 5 ★'), 'en 1 ou 2 essais 3 étoiles · 3 ou 4, 2 étoiles · 5, 1 étoile')
  assert.equal(aLOreille('sans étoile'), 'sans étoile')
  /** Ce que l'oreille lit d'un rendu : tout, sauf ce qui lui est caché. */
  const sansLeCache = (html: string) => html.replace(/<span aria-hidden="true">[^<]*<\/span>/g, '')
  const annonce = await rendu('views/cabinet/Annonce', 'Annonce', { page, demande: { origine: 'libre', jeu: 'mot' }, carte: null, busy: false, onCarte: rien, onCommencer: rien, onRetour: rien })
  const regles = await rendu('views/cabinet/Regles', 'Regles', { jeux: page.jeux })
  const auChoix = await laPartie(vues.auChoix)
  const choix = auChoix.slice(auChoix.indexOf('class="quiz-player cab-manche"'))
  for (const [ou, html] of [
    ['l’annonce', annonce],
    ['les règles', regles],
    ['le choix du Pari', choix],
  ] as const) {
    assert.match(html, /<span aria-hidden="true">★+<\/span><span class="sr-only">/, ou)
    assert.doesNotMatch(sansLeCache(html), /★/, `${ou} : une étoile que l’oreille lirait en glyphe`)
  }
  // Le texte lu à l'oreille, sa virgule collée au nombre qu'elle suit (le rendu garde l'espace d'avant les glyphes).
  assert.match(texte(sansLeCache(annonce)).replace(/ ,/g, ','), new RegExp(echapper(aLOreille(JEUX.mot.bareme.replace(/^./, c => c.toUpperCase())))))
  // Les deux gestes du Pari se nomment en mots : « Garder 2 étoiles ».
  assert.match(choix, new RegExp(`<button type="button" class="btn btn-big" aria-label="${echapper(aLOreille(MOTS_DU_PARI.garder))}"`))
  assert.match(choix, new RegExp(`<button type="button" class="btn btn-primary btn-big" aria-label="Parier pour ${etoilesDites(ETOILES_DU_PARI.parier)}"`))
  // Le nom de « Parier » vient du barème, comme son voisin : la flèche s'y entend « pour ». Écrit à la main, le verbe avait deux
  // sources, et un « Parier » retouché dans `motsDuPari` n'aurait pas changé ce qu'entend l'oreille (la relecture du lot page-2).
  assert.equal(aLOreille(MOTS_DU_PARI.parier), `Parier pour ${etoilesDites(ETOILES_DU_PARI.parier)}`)
  assert.equal(aLOreille('Parier → ★★★'), 'Parier pour 3 étoiles')
  const pari = source('views/cabinet/jeux/Pari.tsx')
  assert.match(pari, /aria-label=\{aLOreille\(MOTS_DU_PARI\.parier\)\}/)
  assert.doesNotMatch(pari, /`Parier/, 'le verbe écrit à la main')
  // Les barèmes de `JEUX` ne changent pas : l'œil lit toujours ses glyphes.
  assert.match(JEUX.mot.bareme, /★/)
})

test('trois « Jouer » et trois « Changer de jeu » de noms distincts : l’oreille sait lequel elle touche', async () => {
  const cases = (['pari', 'eclair', 'indices'] as const).map(jeu => uneCase({ jeu, enJeu: enGagnant, seuil: 6 }))
  const trois = laVisiteDe(cases, { visite: { ...page.visite, cases, echange: { possible: true } } })
  const html = await rendu('views/cabinet/Visite', 'Visite', { page: trois, busy: false, onJouer: rien, onEchanger: rien })
  const noms = [...html.matchAll(/<button [^>]*aria-label="([^"]+)"/g)].map(m => texte(m[1]).trim())
  assert.deepEqual(noms, [`Jouer ${JEUX.pari.a}`, `Changer de jeu : ${JEUX.pari.nom}`, `Jouer ${JEUX.eclair.a}`, `Changer de jeu : ${JEUX.eclair.nom}`, `Jouer ${JEUX.indices.a}`, `Changer de jeu : ${JEUX.indices.nom}`])
  assert.equal(new Set(noms).size, 6)
  // À l'œil, rien ne change ; et la tablée trouve encore « Jouer » par une partie de son nom (règle `tablee.md`).
  assert.equal([...html.matchAll(/>Jouer<\/button>/g)].length, 3)
  assert.equal([...html.matchAll(/>Changer de jeu<\/button>/g)].length, 3)
})

test('le contour d’une porte ne reste plus sous le doigt : chaque survol du Cabinet sous `@media (hover: hover)`', () => {
  // Camille, au doigt : la porte touchée gardait le contour d'or d'une salle complète, et elle l'a lue comme conseillée.
  const section = sectionDuCabinet()
  assert.match(section, /@media \(hover: hover\) \{\s*\.cab-porte:hover \.cab-arche \{ border-color: var\(--accent\); \}\s*\}/)
  const horsDesRequetes = section.replace(/@media \(hover: hover\) \{(?:[^{}]*\{[^{}]*\})+\s*\}/g, '')
  assert.doesNotMatch(horsDesRequetes, /:hover/, 'un survol hors de sa requête colle au doigt')
})

test('le bandeau de la fête ne paraît qu’avec sa phrase, et la visite faite ne promet pas une chasse qui ne reste pas', async () => {
  // La Citrouille réveillée, il ne restait que « Halloween » et une icône (cinq joueurs sur six l'ont dit).
  assert.doesNotMatch(texte(await musee({ ...neuf, fete: { cle: 'halloween', nom: 'Halloween' } })), /Halloween/)
  const avecSaPhrase = { cle: 'halloween' as const, nom: 'Halloween', gardien: { legendaire: 'lg:citrouille', dit: 'Gagne une œuvre, et la Citrouille se réveillera.' } }
  assert.match(texte(await musee({ ...neuf, fete: avecSaPhrase })), /Halloween .*Gagne une œuvre, et la Citrouille se réveillera\./)
  // « Faite : reviens demain, ou pars à la chasse », sans chasse (Lucas).
  const faite = laVisiteDe(page.visite.cases.map(c => ({ ...c, faite: true, issue: 'manquee' as const })))
  const tuile = async (p: PageDuCabinet) => texte(/<a class="gros-bouton[^"]*" href="#visite">.*?<\/a>/.exec(await musee(p))?.[0] ?? '')
  assert.doesNotMatch(await tuile({ ...faite, chasses: { ...faite.chasses, restent: 0 } }), /chasse/)
  assert.match(await tuile({ ...faite, chasses: { ...faite.chasses, restent: 0 } }), /Faite : reviens demain/)
  assert.match(await tuile({ ...faite, chasses: { ...faite.chasses, restent: 2 } }), /Faite : reviens demain, ou pars à la chasse/)
})

test('« Comment ça marche ? » s’ouvre sur l’essentiel : « En bref », puis les mots du Cabinet, et les neuf jeux repliés', async () => {
  // Jeanne et Ophélie : trente-trois lignes en six sections, le lexique tout au bout — « le genre de texte qui me ferait lâcher
  // une appli ». Théo et Hugo la trouvaient complète : le reste ne bouge pas.
  const html = await rendu('views/cabinet/Regles', 'Regles', { jeux: page.jeux, parties: 3 })
  const t = texte(html)
  assert.match(t, /^\s*En bref La visite du jour : 3 parties, une œuvre à gagner chacune\. Assez d’étoiles, et l’œuvre entre dans ton musée\. Une salle complète réveille son gardien\./)
  const ou = (s: string) => html.indexOf(s)
  assert.ok(ou('En bref') < ou('Les mots du Cabinet') && ou('Les mots du Cabinet') < ou('Ton musée'), 'le lexique juste après « En bref »')
  assert.ok(ou('Les mots du Cabinet') < ou('Les neuf jeux'), 'le lexique avant les neuf jeux')
  // Les neuf jeux, repliés : chaque annonce redit le sien.
  const replies = /<details class="glossaire cab-regles-replie"><summary>.*?Les neuf jeux et leurs étoiles.*?<\/summary>(.*?)<\/details>/.exec(html)
  assert.ok(replies, 'les neuf jeux sous un <details>')
  for (const j of CLES_DES_JEUX) assert.match(replies[1], new RegExp(echapper(JEUX[j].nom)), j)
  // Une case de la visite se joue une fois, et se retente au même jeu, pour une chasse.
  assert.match(t, /Chacune se joue une fois ; manquée, son œuvre se retente au même jeu pour une chasse\./)
  sansJargon(html, 'les règles')
})

test('le cadre doré se dit à l’écran : à l’annonce d’une œuvre en jeu, sous la carte-bonus qui l’ôterait, et à la mise', async () => {
  const annonce = (demande: object, carte: string | null = null) =>
    rendu('views/cabinet/Annonce', 'Annonce', { page, demande, carte, busy: false, onCarte: rien, onCommencer: rien, onRetour: rien })
  // Théo : misé, 9 sur 9, l'œuvre sans cadre doré — rien ne l'avait dit avant.
  assert.match(texte(await annonce({ origine: 'chasse', oeuvre: 'expose' })), /Toutes ses manches parfaites, sans qu’un pouvoir serve : son cadre doré\./)
  // Sous la carte emportée, ce qui l'ôte : s'en servir, ou répondre dans le temps qu'elle donne en plus. Protéger ne sert qu'à une
  // manche imparfaite : le cadre était déjà perdu, rien à dire.
  assert.match(texte(await annonce({ origine: 'chasse', oeuvre: 'expose' }, 'coup-d-oeil')), /T’en servir ôte le cadre doré\./)
  assert.match(texte(await annonce({ origine: 'chasse', oeuvre: 'expose' }, 'echange')), /T’en servir ôte le cadre doré\./)
  assert.match(texte(await annonce({ origine: 'chasse', oeuvre: 'expose' }, 'concentration')), /Répondre dans le temps en plus ôte le cadre doré\./)
  assert.doesNotMatch(texte(await annonce({ origine: 'chasse', oeuvre: 'expose' }, 'prudence')), /ôte le cadre doré/)
  // Sans œuvre en jeu, pas de cadre à perdre : rien.
  assert.doesNotMatch(texte(await annonce({ origine: 'libre', jeu: 'pari' }, 'coup-d-oeil')), /cadre doré/)
  // La mise : tant que la partie peut finir parfaite, miser perdrait le cadre ; une manche déjà imparfaite, il est perdu.
  const carte = { cle: 'tout-ou-rien', pouvoir: 'miser', force: 1, reste: 1, dit: ceQueFaitLaCarte('miser', 1, 'pari') }
  const avant = { ...vues.pari, origine: 'chasse', enJeu: enGagnant, seuil: 6, phase: 'avant', carte, pouvoir: { jouable: true }, enCours: undefined, chrono: undefined } as unknown as VueDeLaPartie
  assert.match(texte(await laPartie(avant)), /Tu vises le cadre doré : miser le perdrait\./)
  const sans = { etoiles: null, naturel: null }
  const imparfaite = { ...avant, phase: 'revele', manches: [{ etoiles: 2, naturel: 2 }, sans, sans] } as unknown as VueDeLaPartie
  assert.doesNotMatch(texte(await laPartie(imparfaite, { miser: 1 })), /cadre doré/)
  const parfaite = { ...imparfaite, manches: [{ etoiles: 3, naturel: 3 }, sans, sans] } as unknown as VueDeLaPartie
  assert.match(texte(await laPartie(parfaite, { miser: 1 })), /Tu vises le cadre doré/)
  // Parfaite, mais aidée — éclairée, misée, changée, le temps en plus : sa note le dit, le cadre est déjà perdu.
  for (const note of ['éclairée', '+2 : mise gagnée', 'changée', 'temps en plus']) {
    const aidee = { ...imparfaite, manches: [{ etoiles: 3, naturel: 3, note }, sans, sans] } as unknown as VueDeLaPartie
    assert.doesNotMatch(texte(await laPartie(aidee, { miser: 1 })), /cadre doré/, note)
  }
  assert.doesNotMatch(texte(await laPartie({ ...avant, origine: 'libre', enJeu: null, seuil: null } as VueDeLaPartie)), /cadre doré/)
})

test('le seuil se rappelle en partie : « 0 / 9 ★ » et « il en faut 6 » dans la tête — jamais en partie libre', async () => {
  // Camille n'a su ni s'il fallait parier, ni que l'œuvre était perdue : l'annonce disait le seuil, la tête plus.
  const chasse = { ...vues.pari, origine: 'chasse', enJeu: enGagnant, seuil: 6 } as VueDeLaPartie
  const tete = (html: string) => /<header class="cab-tete-partie">[\s\S]*?<\/header>/.exec(html)?.[0] ?? ''
  const avecSeuil = tete(await laPartie(chasse))
  assert.match(texte(avecSeuil), /0 \/ 9 ★ il en faut 6/)
  assert.match(avecSeuil, /aria-label="0 étoile sur 9, il en faut 6"/)
  assert.doesNotMatch(texte(tete(await laPartie(vues.pari))), /il en faut/)
})

test('« Retenter » à l’écran : au bilan d’une visite manquée et sous sa case — en sourdine avec la raison du serveur, et jamais l’œuvre', async () => {
  const ecran = (await ecrans()).pari
  // Camille, ses deux parties de la visite perdues : « seules les deux chasses permettent de retenter une œuvre ». La page le
  // propose par la case, et le serveur retrouve l'œuvre (`DemandeLue`) : la page ne la reçoit pas (invariant 1).
  const dit = 'Pas assez d’étoiles cette fois. Il en fallait 6. L’œuvre reste à gagner.'
  const manquee = (retenter?: object) => ({ ...vues.fini, origine: 'visite', enJeu: enGagnant, seuil: 6, bilan: { ...vues.fini.bilan!, issue: 'manquee', dit, ...(retenter && { retenter }) } }) as VueDeLaPartie
  const bilan = (v: VueDeLaPartie) => rendu('views/cabinet/Bilan', 'BilanDeLaPartie', { vue: v, ecran, onMusee: rien, onRetenter: rien })
  const possible = await bilan(manquee({ possible: true }))
  const retenter = boutonsDe(possible).find(x => x.texte.startsWith('Retenter'))
  assert.equal(retenter?.texte, `Retenter cette œuvre ${JEUX.pari.a} · une chasse`)
  assert.ok(!retenter!.eteint)
  const prises = await bilan(manquee({ possible: false, refus: PLUS_DE_CHASSE }))
  const enSourdine = boutonsDe(prises).find(x => x.texte.startsWith('Retenter'))!
  assert.ok(enSourdine.eteint, 'les chasses prises : en sourdine, jamais `disabled`')
  assert.equal(raisonsDe(prises).get(enSourdine.raison!), PLUS_DE_CHASSE)
  assert.doesNotMatch(prises, /<button[^>]* disabled/)
  assert.ok(!boutonsDe(await bilan(manquee())).some(x => x.texte.startsWith('Retenter')), 'sans « Retenter » du serveur, rien')
  // Sous sa case : la même règle, la même raison.
  const cases = [uneCase({ jeu: 'pari', enJeu: enGagnant, faite: true, issue: 'manquee', seuil: 6, retenter: { possible: true } }), uneCase({ jeu: 'eclair', enJeu: enGagnant, seuil: 6 })]
  const visite = await rendu('views/cabinet/Visite', 'Visite', { page: laVisiteDe(cases), busy: false, onJouer: rien, onEchanger: rien })
  assert.match(texte(visite), /L’œuvre reste à gagner : retente-la pour une chasse/)
  assert.ok(!boutonsDe(visite).find(x => x.texte === `Retenter cette œuvre ${JEUX.pari.a} · une chasse`)!.eteint)
  const sansChasse = await rendu('views/cabinet/Visite', 'Visite', { page: laVisiteDe([{ ...cases[0], retenter: { possible: false, refus: PLUS_DE_CHASSE } }, cases[1]]), busy: false, onJouer: rien, onEchanger: rien })
  const eteint = boutonsDe(sansChasse).find(x => x.texte.startsWith('Retenter'))!
  assert.ok(eteint.eteint)
  assert.equal(raisonsDe(sansChasse).get(eteint.raison!), PLUS_DE_CHASSE)
  // Son œuvre gagnée depuis — une chasse, un achat — : plus rien à retenter, et la case le dit. Telle que le serveur la rend :
  // l'œuvre à lui, sa case passe « pour dorer » (`enjeuDe`), le seuil de son double à la place du sien.
  const gagneeDepuis = uneCase({ jeu: 'pari', enJeu: { pourDorer: aLuiSansCadre().cle }, faite: true, issue: 'manquee', seuilDuDouble: 6, retenter: { possible: false, refus: SON_OEUVRE_EST_A_TOI } })
  const aLui = await rendu('views/cabinet/Visite', 'Visite', { page: laVisiteDe([gagneeDepuis, cases[1]]), busy: false, onJouer: rien, onEchanger: rien })
  assert.ok(!boutonsDe(aLui).some(x => x.texte.startsWith('Retenter')))
  assert.match(texte(aLui), new RegExp(SON_OEUVRE_EST_A_TOI))
  assert.doesNotMatch(texte(aLui), /L’œuvre reste à gagner/)
  // L'annonce de la retente dit l'enjeu de sa case, jamais l'œuvre : la demande vise la case.
  const { annonceDe } = await import(url('views/cabinet/Annonce.tsx'))
  const p = laVisiteDe(cases)
  assert.deepEqual(annonceDe(p, { origine: 'chasse', case: 0, retente: true }), { jeu: 'pari', piece: 'Une chasse', enJeu: 'Peut te faire gagner une œuvre rare de la salle de l’Érudit', seuil: 6, dorer: false })
  const html = await rendu('views/cabinet/Annonce', 'Annonce', { page: p, demande: { origine: 'chasse', case: 0, retente: true }, carte: null, busy: false, onCarte: rien, onCommencer: rien, onRetour: rien })
  assert.match(texte(html), /Une chasse Le Pari .*Peut te faire gagner une œuvre rare de la salle de l’Érudit/)
  assert.match(texte(html), /revenir au musée ne coûte pas ta chasse/)
  // La page l'envoie par la case, avec la carte-bonus choisie à l'annonce ; la retente du bilan rouvre l'annonce de sa case.
  assert.match(source('views/CabinetApp.tsx'), /jouer\(\{ origine: 'chasse', case: k, retente: true \}\)/)
  assert.match(source('views/cabinet/Visite.tsx'), /onJouer\(\{ origine: 'chasse', case: k, retente: true \}\)/)
})

test('une case de la visite se joue une fois, et l’annonce le dit avant « Commencer »', async () => {
  // Camille : sa case perdue était « Faite », et rien ne l'avait dit — l'annonce rassurait même : « Rien ne compte avant ».
  const annonce = async (c: CaseVue) =>
    texte(await rendu('views/cabinet/Annonce', 'Annonce', { page: laVisiteDe([c]), demande: { origine: 'visite', case: 0 }, carte: null, busy: false, onCarte: rien, onCommencer: rien, onRetour: rien }))
  const aGagner = await annonce(uneCase({ jeu: 'pari', enJeu: enGagnant, seuil: 6 }))
  assert.match(aGagner, /Rien ne compte avant « Commencer » : revenir au musée ne coûte pas ta partie de la visite\./)
  assert.match(aGagner, /Ensuite, elle se joue une fois aujourd’hui — manquée, son œuvre se retente au même jeu pour une chasse\./)
  // Pour dorer, ou pour la poussière d'or : rien à retenter, elle se joue une fois.
  for (const enJeu of [{ pourDorer: 'lecon' }, { poussiere: true }] as const) {
    const t = await annonce(uneCase({ jeu: 'eclair', enJeu }))
    assert.match(t, /Ensuite, elle se joue une fois aujourd’hui\./)
    assert.doesNotMatch(t, /se retente/)
  }
})

test('« Quitter ? » dit ce qu’on emporte, comme le serveur le compte : les étoiles, Protéger compris, et la poussière d’or', async () => {
  const { messageDuQuitter } = await import(url('views/cabinet/Partie.tsx'))
  const prudence = { cle: 'prudence', pouvoir: 'proteger', force: 1, reste: 0, dit: '' }
  // Lucas, sous Prudence : quitter d'emblée valait une étoile et quatre poussières, quand « Quitter ? » promettait « les étoiles
  // déjà gagnées ». Le serveur le compte (`siTuQuittes`), la page le dit.
  const chasse = messageDuQuitter({ origine: 'chasse', total: 0, carte: prudence, siTuQuittes: { total: 1, poussiere: 4 } })
  assert.equal(chasse.titre, 'Quitter ?')
  assert.equal(chasse.message, 'Tu repars avec 1 étoile, Protéger compris, et 4 poussières d’or ; ta chasse est utilisée.')
  assert.equal(messageDuQuitter({ origine: 'visite', total: 0, carte: null, siTuQuittes: { total: 0, poussiere: 0 } }).message, 'Tu repars sans étoile ni poussière d’or ; cette partie de la visite est faite.')
  assert.equal(messageDuQuitter({ origine: 'visite', total: 4, carte: null, siTuQuittes: { total: 4, poussiere: 8 } }).message, 'Tu repars avec 4 étoiles et 8 poussières d’or ; cette partie de la visite est faite.')
  // Protéger ne se dit que s'il a compté : une carte qui n'a rien relevé n'est pas « comprise ».
  assert.doesNotMatch(messageDuQuitter({ origine: 'chasse', total: 1, carte: prudence, siTuQuittes: { total: 1, poussiere: 4 } }).message, /Protéger/)
  // En libre : l'une des parties qui paient, ou pour le plaisir.
  const libre = messageDuQuitter({ origine: 'libre', total: 3, carte: null, siTuQuittes: { total: 3, poussiere: 6 } })
  assert.deepEqual(libre, { titre: 'Quitter cette partie ?', message: 'Tu repars avec 3 étoiles et 6 poussières d’or : c’est l’une de tes parties libres qui paient.' })
  assert.equal(messageDuQuitter({ origine: 'libre', total: 3, carte: null, siTuQuittes: { total: 3, poussiere: 0 } }).message, 'Tu repars avec 3 étoiles.')
  // Le chrono, après : figé, ou qui continue.
  assert.match(
    messageDuQuitter({ origine: 'chasse', total: 0, carte: null, siTuQuittes: { total: 0, poussiere: 0 } }, { pauseMs: 9_000 }).message,
    /; ta chasse est utilisée\. Le chrono t’attend 9 secondes au plus, la manche cachée\.$/,
  )
  // La partie lit la vue d'à présent : celle que la pause vient de rendre.
  assert.match(source('views/cabinet/Partie.tsx'), /messageDuQuitter\(vueRef\.current, \{ pauseMs, refus \}\)/)
})

test('l’annonce lit le seuil que le serveur dit : celui de la case, le double d’une case pour dorer, trois paris gagnés au Pari', async () => {
  const annonce = async (c: CaseVue) =>
    texte(await rendu('views/cabinet/Annonce', 'Annonce', { page: laVisiteDe([c]), demande: { origine: 'visite', case: 0 }, carte: null, busy: false, onCarte: rien, onCommencer: rien, onRetour: rien }))
  // Un seuil que le barème du code ne dirait pas : la page le lit de la case, elle ne le redérive plus.
  assert.notEqual(SEUILS_DES_RARETES.rare, 8)
  assert.match(await annonce(uneCase({ jeu: 'eclair', enJeu: enGagnant, seuil: 8 })), /Il faut 8 étoiles sur 9 pour la gagner\./)
  // Une case pour dorer : le cadre, et le double de son seuil — d'une œuvre à lui sans cadre doré (la Leçon de Léa a le sien : sa
  // case ne promettrait plus que le double, plus bas).
  const sansCadre = aLuiSansCadre()
  const dorer = await annonce(uneCase({ jeu: 'eclair', enJeu: { pourDorer: sansCadre.cle }, seuilDuDouble: 6 }))
  assert.match(dorer, new RegExp(`Pour dorer ${echapper(sansCadre.nom)}`))
  assert.match(dorer, /Pour la dorer : toutes ses manches parfaites, sans qu’un pouvoir ait servi\./)
  assert.match(dorer, /Sans cadre doré, 6 étoiles sur 9 font un double : sa poussière d’or en plus\./)
  // Au Pari, une manche parfaite est un pari gagné : garder n'en vaut que deux.
  assert.ok(ETOILES_DU_PARI.garder < 3)
  assert.match(await annonce(uneCase({ jeu: 'pari', enJeu: { pourDorer: sansCadre.cle }, seuilDuDouble: 6 })), /Pour la dorer : trois paris gagnés, sans qu’un pouvoir ait servi\./)
  assert.equal(JEU_DE_L_OEUVRE.lecon, 'pari')
  const chasse = await rendu('views/cabinet/Annonce', 'Annonce', { page, demande: { origine: 'chasse', oeuvre: 'lecon' }, carte: null, busy: false, onCarte: rien, onCommencer: rien, onRetour: rien })
  assert.match(texte(chasse), /Pour la dorer : trois paris gagnés/)
  assert.doesNotMatch(texte(chasse), /font un double/, 'pas de double en chasse')
  assert.doesNotMatch(source('views/cabinet/Annonce.tsx'), /SEUILS_DES_RARETES|\bseuilDe\b/)
})

/**
 * La force d'un sélecteur sans virgule (CSS Selectors 4), en un nombre : les identifiants, puis les classes, attributs et
 * pseudo-classes, puis les éléments. `:where()` ne compte rien ; `:not()` et `:is()`, leur argument — seuls ceux des feuilles
 * qu'on relit ici, sans liste dedans.
 */
function forceDuSelecteur(selecteur: string): number {
  let s = selecteur
  while (s.includes(':where(')) s = s.replace(/:where\((?:[^()]|\([^()]*\))*\)/, ' ')
  s = s.replace(/:(?:not|is)\(([^()]*)\)/g, ' $1 ')
  const compter = (motif: RegExp) => {
    const n = (s.match(motif) ?? []).length
    s = s.replace(motif, ' ')
    return n
  }
  const ids = compter(/#[\w-]+/g)
  const classes = compter(/\[[^\]]*\]/g) + compter(/\.[\w-]+/g) + compter(/(?<!:):[\w-]+/g)
  const elements = compter(/::[\w-]+/g) + compter(/(?<![\w-])[a-z][\w-]*/gi)
  return ids * 10_000 + classes * 100 + elements
}

test('sous chaque thème, une étiquette du Cabinet garde ses dix-sept pixels et son espacement : son relevé est plus fort que le `.label` d’un thème', () => {
  // Le rendu du 25 octobre 2026 sous le Film noir : son `.label` espacé de 0,3 em, aussi fort que le relevé du Cabinet et chargé
  // après lui, faisait passer « Le Cabinet de curiosités » sur deux lignes ; le Grimoire le redescendait à 12 px, le Cahier à 13.
  assert.equal(forceDuSelecteur(":root[data-theme='filmnoir'] .label"), 300)
  assert.equal(forceDuSelecteur(":root[data-theme='sommet'] .label:where(:not(.carte-fond, .carte-fond *))"), 300)
  const regles = [...sectionDuCabinet().matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, sel, decl]) => ({ sels: sel.split(',').map(x => x.trim()), decl }))
  // Le relevé : la taille, l'espacement et les capitales de chaque `.label` de la page et de ses feuilles.
  for (const ou of ['.cab-page', '.cab-feuille']) {
    const releve = regles.find(r => r.sels.some(x => x.endsWith(`${ou} .label`)) && /font-size/.test(r.decl) && /letter-spacing/.test(r.decl) && /text-transform/.test(r.decl))
    assert.ok(releve, `${ou} .label relevé`)
    const force = forceDuSelecteur(releve.sels.find(x => x.endsWith(`${ou} .label`))!)
    for (const t of themesDuClient()) {
      const css = t.css.replace(/\/\*[\s\S]*?\*\//g, '')
      for (const [, sel, decl] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        if (!/font-size|letter-spacing|text-transform/.test(decl)) continue
        // Ce que le thème pose, sous sa racine — l'Ivoire compris, qui vit dans la feuille même —, sur toute étiquette.
        for (const x of sel.split(/,(?![^(]*\))/).map(y => y.trim())) {
          if (!/^:root\[data-theme='[\w-]+'\] \.label(?::where\([^]*\))?$/.test(x)) continue
          assert.ok(forceDuSelecteur(x) < force, `${t.cle} : « ${x} » (${forceDuSelecteur(x)}) l’emporte sur « ${releve.sels.join(', ')} » (${force})`)
        }
      }
    }
  }
})

test('au Sommet, ce que le Cabinet pose à même la page se lit sur un sol plein, pas sur la neige peinte', () => {
  // Le rendu du 25 octobre 2026, au Sommet : « 2 chasses aujourd'hui » à 1,36:1, le nom d'une salle sous sa porte à 2,28:1 — le
  // halo du thème ne tient pas sur la montagne. La colonne du Cabinet prend le sol de la nuit, opaque.
  const sommet = themesDuClient().find(t => t.cle === 'sommet')!
  const css = sommet.css.replace(/\/\*[\s\S]*?\*\//g, '')
  const regle = /:root\[data-theme='sommet'\] \.cab-page \{([^}]*)\}/.exec(css)
  assert.ok(regle, 'le Sommet pose un sol sous la colonne du Cabinet')
  const fond = /background(?:-color)?:\s*var\((--[\w-]+)\)/.exec(regle[1])?.[1]
  assert.ok(fond, regle[1])
  const valeur = sommet.jetons.get(fond)!
  assert.match(valeur, /^#[0-9a-f]{6}$/i, `${fond} : ${valeur}, opaque`)
})

test('sous chaque thème peint, la colonne du Cabinet a son sol plein : son tableau ne passe plus sous ses lignes', () => {
  // La relecture du lot page-2 demandait ce que deviendrait le prochain thème peint : mesurés au rendu du 26 octobre 2026, ils
  // passaient tous sous les lignes du Cabinet — l'Horloge (« « Je tiens bon » » à 1,92:1 sur ses aiguilles), le Ciel
  // (« Prendre son temps » à 2,09:1), les Heures (la question d'un Pari à 1,58:1 sur la page du mois). Un thème est peint quand
  // sa feuille cite ses décors (`--decor-…`, le bloc que `decors.ts --livrer` réécrit).
  const peints = themesDuClient().filter(t => /--decor-[\w-]+\s*:/.test(t.css))
  assert.deepEqual(peints.map(t => t.cle).sort(), ['ciel', 'heures', 'horloge', 'sommet'])
  for (const t of peints) {
    const css = t.css.replace(/\/\*[\s\S]*?\*\//g, '')
    const regle = new RegExp(`:root\\[data-theme='${t.cle}'\\] \\.cab-page \\{([^}]*)\\}`).exec(css)
    assert.ok(regle, `${t.cle} : un sol sous la colonne du Cabinet`)
    const fond = /background(?:-color)?:\s*var\((--[\w-]+)\)/.exec(regle[1])?.[1]
    assert.ok(fond, `${t.cle} : ${regle[1]}`)
    assert.match(t.jetons.get(fond) ?? '', /^#[0-9a-f]{6}$/i, `${t.cle} : ${fond}, opaque`)
  }
})

test('« Commencer » envoie ce que le serveur lit — la retente par sa case comprise —, sans forcer le type de la demande', () => {
  // `DemandeLue` : une partie de la visite, une chasse, un jeu libre, et « Retenter » par sa case.
  assert.match(source('api.ts'), /commencer: \(demande: DemandeLue\) =>/)
  assert.match(source('views/cabinet/ecrans.ts'), /export type PartieDemandee = SansCarte<DemandeLue>/)
  assert.doesNotMatch(source('views/CabinetApp.tsx'), /as DemandeDeDepart/)
})

// ── La relecture du lot page-2 ────────────────────────────────────────────
//
// Ce que deux relecteurs ont trouvé en rendant la page sur les vues que le serveur rend vraiment : une œuvre achetée après sa case
// manquée, une chasse qui attend au-dessus de cases manquées, une chasse pour dorer, une œuvre dorée dans la journée.

/** La visite d'une page, rendue telle que `CabinetApp` la montre. */
const laVisite = (p: PageDuCabinet) => rendu('views/cabinet/Visite', 'Visite', { page: p, busy: false, onJouer: rien, onEchanger: rien, onReprendre: rien })
/** Un profil neuf, sa poussière d'or écrite à la main : de quoi acheter une œuvre sans jouer d'abord. */
async function unProfilRiche(login: string, prenom: string) {
  const c = await inscrireProfil(b.banc.url, login, prenom)
  const id = (await lire(b, c, '/api/joueur/moi?leger')).corps.profile.id as string
  aLaMain(b.fichier, `INSERT INTO cabinet_profils (profile_id, poussiere, cree_le, maj_le) VALUES ('${id}', 1000, 0, 0) ON CONFLICT (profile_id) DO UPDATE SET poussiere = 1000`)
  ok(await laPage(b, c), `la page de ${prenom}`)
  return c
}

test('une case manquée dont l’œuvre est à lui depuis le dit, sans « Retenter » — quel que soit le refus que le serveur dit d’abord', async () => {
  // Achetée après la visite manquée, l'œuvre fait passer sa case « pour dorer » (`enjeuDe`), et le serveur refuse la retente pour
  // la partie qui attend ou les chasses prises avant de dire « Son œuvre est déjà à toi » (`cadreDuDepart`) : la case disait « Pas
  // de dorure cette fois », et « Retenter » en sourdine pour une œuvre déjà à lui.
  const o = aLuiSansCadre()
  const gagnee = uneCase({ jeu: 'eclair', enJeu: enGagnant, faite: true, issue: 'gagnee', oeuvre: 'lecon' })
  const chasse = { ...vues.pari, origine: 'chasse' } as VueDeLaPartie
  for (const [refus, enCours] of [
    [SON_OEUVRE_EST_A_TOI, null],
    [PLUS_DE_CHASSE, null],
    [laPartieAttend(chasse.jeu), chasse],
  ] as const) {
    const manquee = uneCase({ jeu: 'pari', enJeu: { pourDorer: o.cle }, faite: true, issue: 'manquee', seuilDuDouble: 5, retenter: { possible: false, refus } })
    const html = await laVisite(laVisiteDe([manquee, gagnee], { enCours }))
    const t = texte(html)
    assert.ok(!boutonsDe(html).some(x => x.texte.startsWith('Retenter')), `${refus} : rien à retenter`)
    assert.match(t, new RegExp(`Faite ${JEUX.pari.nom} ${SON_OEUVRE_EST_A_TOI}`), refus)
    assert.doesNotMatch(t, /Pas de dorure/, refus)
    if (refus !== SON_OEUVRE_EST_A_TOI) assert.doesNotMatch(t, new RegExp(echapper(texte(refus).trim())), `${refus} : une raison sous un geste qui n’est pas là`)
  }
  // Par le vrai serveur : la case quittée, son œuvre achetée, puis une chasse qui attend, puis les deux chasses prises.
  const sacha = await unProfilRiche('sacha', 'Sacha')
  const visite = ok(await commencer(b, sacha, { origine: 'visite', case: 0, carte: null }), 'la visite')
  const cible = departEnBase(b.fichier, visite.id).cible
  assert.ok(estUneOeuvre(cible), 'une case d’un musée neuf vise une œuvre')
  ok(await jouer(b, sacha, visite, { quoi: 'quitter' }), 'quittée : manquée')
  ok(await poster(b, sacha, `/api/cabinet/oeuvre/${cible}/achat`, { prix: PRIX_D_UNE_OEUVRE[oeuvreDe(cible)!.rarete] }), 'l’achat')
  const lues: PageDuCabinet[] = [ok(await laPage(b, sacha), 'achetée')]
  const aDorer = 'prudence'
  for (let i = 0; i < CHASSES_PAR_JOUR; i++) {
    const c = ok(await commencer(b, sacha, { origine: 'chasse', oeuvre: aDorer, carte: null }), `la chasse ${i + 1}`)
    if (i === 0) lues.push(ok(await laPage(b, sacha), 'une chasse qui attend'))
    ok(await jouer(b, sacha, c, { quoi: 'quitter' }), 'quittée')
  }
  lues.push(ok(await laPage(b, sacha), 'les chasses prises'))
  // Le refus que le serveur dit d'abord n'y change rien : la page ne lit pas l'ordre de ses refus.
  assert.ok(lues.every(p => p.visite.cases[0].retenter?.possible === false), JSON.stringify(lues.map(p => p.visite.cases[0].retenter)))
  for (const p of lues) {
    assert.ok('pourDorer' in p.visite.cases[0].enJeu, 'sa case passe « pour dorer »')
    const html = await laVisite(p)
    assert.ok(!boutonsDe(html).some(x => x.texte.startsWith('Retenter')), p.visite.cases[0].retenter?.refus)
    assert.match(texte(html), new RegExp(`Faite ${echapper(JEUX[p.visite.cases[0].jeu].nom)} ${SON_OEUVRE_EST_A_TOI}`))
    assert.doesNotMatch(texte(html), /Pas de dorure/)
  }
})

test('une partie qui attend éteint aussi « Retenter » : sa raison dite une fois, au-dessus des cases, et un seul « Reprendre » — toutes les cases faites comprises', async () => {
  // La retente même est une chasse : pendant qu'elle attend, chaque case manquée redisait la raison sous son « Retenter », et les
  // trois cases faites, la visite disait « reprends-la » trois fois sans un seul « Reprendre ».
  const chasse = { ...vues.pari, origine: 'chasse' } as VueDeLaPartie
  const raison = texte(laPartieAttend(chasse.jeu)).trim()
  const manquee = (jeu: CleDeJeu) => uneCase({ jeu, enJeu: enGagnant, faite: true, issue: 'manquee', seuil: 6, retenter: { possible: false, refus: laPartieAttend(chasse.jeu) } })
  /** Ce qu'une visite qui attend doit dire : la raison une fois, en tête, que chaque geste éteint désigne, et un seul « Reprendre ». */
  const uneFois = (html: string, ou: string) => {
    assert.equal([...texte(html).matchAll(new RegExp(echapper(raison), 'g'))].length, 1, `${ou} : la raison dite une fois`)
    assert.equal(boutonsDe(html).filter(x => x.texte === 'Reprendre' && !x.eteint).length, 1, `${ou} : un seul « Reprendre »`)
    const enTete = /<p id="([^"]+)" class="cab-raison cab-raison-en-tete">/.exec(html)
    assert.ok(enTete && html.indexOf(enTete[0]) < html.indexOf('class="cab-cases"'), `${ou} : la raison au-dessus des cases`)
    const retenter = boutonsDe(html).filter(x => x.texte.startsWith('Retenter'))
    assert.ok(retenter.length > 0, ou)
    for (const r of retenter) assert.ok(r.eteint && r.raison === enTete[1], `${ou} : « Retenter » désigne la raison d’en tête`)
  }
  uneFois(await laVisite(laVisiteDe([manquee('pari'), uneCase({ jeu: 'eclair', enJeu: enGagnant, seuil: 6 })], { enCours: chasse })), 'une case encore à jouer')
  uneFois(await laVisite(laVisiteDe([manquee('pari'), manquee('mot'), manquee('frise')], { enCours: chasse })), 'toutes faites')
  // Une partie de la visite qui attend : sa case porte « Reprendre », la raison au-dessus se tait d'un second, la case manquée la désigne.
  const enVisite = { ...vues.pari, origine: 'visite' } as VueDeLaPartie
  const ici = await laVisite(laVisiteDe([uneCase({ jeu: 'pari', enJeu: enGagnant, faite: true, seuil: 6 }), manquee('mot')], { enCours: enVisite }))
  uneFois(ici, 'sa case en cours')
  assert.match(texte(ici), new RegExp(`En cours ${JEUX.pari.nom}`))
  // Par le vrai serveur : la case quittée, sa retente commencée ; puis les trois cases faites, et une seconde retente.
  const yael = await unProfilRiche('yael', 'Yaël')
  const v0 = ok(await commencer(b, yael, { origine: 'visite', case: 0, carte: null }), 'la visite')
  ok(await jouer(b, yael, v0, { quoi: 'quitter' }), 'quittée : manquée')
  const retente = ok(await commencer(b, yael, { origine: 'chasse', case: 0, retente: true, carte: null }), 'la retente')
  const pendant = ok(await laPage(b, yael), 'la retente qui attend')
  const raisonLue = texte(laPartieAttend(pendant.enCours!.jeu)).trim()
  const lueUneFois = (html: string, ou: string) => {
    assert.equal([...texte(html).matchAll(new RegExp(echapper(raisonLue), 'g'))].length, 1, `${ou} : la raison dite une fois`)
    assert.equal(boutonsDe(html).filter(x => x.texte === 'Reprendre' && !x.eteint).length, 1, `${ou} : un seul « Reprendre »`)
  }
  lueUneFois(await laVisite(pendant), 'deux cases à jouer')
  ok(await jouer(b, yael, retente, { quoi: 'quitter' }), 'la retente quittée')
  for (const k of [1, 2]) ok(await jouer(b, yael, ok(await commencer(b, yael, { origine: 'visite', case: k, carte: null }), `la case ${k}`), { quoi: 'quitter' }), 'quittée')
  ok(await commencer(b, yael, { origine: 'chasse', case: 0, retente: true, carte: null }), 'la seconde retente')
  const toutes = ok(await laPage(b, yael), 'toutes faites')
  assert.ok(toutes.visite.cases.every(c => c.faite))
  lueUneFois(await laVisite(toutes), 'toutes faites')
})

test('la tête d’une partie pour dorer ne promet pas un seuil qui ne donne rien : rien en chasse, le double en visite', async () => {
  // Une chasse pour dorer fige un seuil (`cadreDuDepart`) : sans cadre doré, elle est manquée, il n'y a pas de double en chasse
  // (`issueDe`). La tête disait « il en faut 5 » sous l'annonce qui venait de dire « toutes ses manches parfaites ».
  const tete = (html: string) => /<header class="cab-tete-partie">[\s\S]*?<\/header>/.exec(html)?.[0] ?? ''
  const o = aLuiSansCadre()
  const enChasse = tete(await laPartie({ ...vues.pari, origine: 'chasse', enJeu: { pourDorer: o.cle }, seuil: 5 } as VueDeLaPartie))
  assert.doesNotMatch(texte(enChasse), /il en faut|double/)
  assert.match(enChasse, /aria-label="0 étoile sur 9"/)
  // En visite, ce seuil est celui de son double : la tête le dit pour ce qu'il est.
  const enVisite = tete(await laPartie({ ...vues.pari, origine: 'visite', enJeu: { pourDorer: o.cle }, seuil: 5 } as VueDeLaPartie))
  assert.match(texte(enVisite), /0 \/ 9 ★ le double à 5/)
  assert.doesNotMatch(texte(enVisite), /il en faut/)
  assert.match(enVisite, /aria-label="0 étoile sur 9, le double à 5"/)
  // Par le vrai serveur : la chasse d'une œuvre de départ — Prudence, au Pari — porte bien ce seuil.
  assert.ok(OEUVRES_DE_DEPART.includes('prudence') && JEU_DE_L_OEUVRE.prudence === 'pari')
  const tess = await unProfilRiche('tess', 'Tess')
  const c = ok(await commencer(b, tess, { origine: 'chasse', oeuvre: 'prudence', carte: null }), 'la chasse pour dorer')
  assert.deepEqual(c.enJeu, { pourDorer: 'prudence' })
  assert.notEqual(c.seuil, null)
  assert.doesNotMatch(texte(tete(await laPartie(c))), /il en faut|double/)
  ok(await jouer(b, tess, c, { quoi: 'quitter' }), 'quittée')
})

test('« Retenter » au bilan n’ouvre son annonce que sur la page relue : perdue en route, le bilan reste et le dit', async () => {
  // Relue en échec, la retente retombait sur la page d'avant la partie — rouverte au rechargement ou par « Reprendre », elle la
  // disait encore en cours : l'annonce éteignait « Commencer », et son « Reprendre » rouvrait une partie finie.
  const { laCaseDeLaRetente } = await import(url('views/cabinet/ecrans.ts'))
  const cases = [uneCase({ jeu: 'eclair', enJeu: enGagnant }), uneCase({ jeu: 'pari', enJeu: enGagnant, faite: true, issue: 'manquee', seuil: 6, retenter: { possible: true } })]
  assert.equal(laCaseDeLaRetente(laVisiteDe(cases), 'pari'), 1, 'la case retrouvée par son jeu')
  assert.equal(laCaseDeLaRetente(laVisiteDe(cases), 'mot'), 'musee', 'minuit passé : la visite n’a plus son jeu')
  assert.equal(laCaseDeLaRetente(null, 'pari'), null, 'la page pas relue : rien ne s’ouvre')
  const app = source('views/CabinetApp.tsx')
  const corps = app.slice(app.indexOf('const retenterDuBilan'), app.indexOf('const ecrire'))
  assert.doesNotMatch(corps, /\?\? page\b/, 'jamais la page d’avant la partie')
  assert.match(corps, /const k = laCaseDeLaRetente\(relue, jeu\)\s+if \(k === null\) return/)
  assert.match(corps, /showToast\(\{ kind: 'error', message: motifDe\(e\) \}\)/, 'l’échec se dit')
})

test('une case pour dorer dont l’œuvre s’est dorée dans la journée ne promet plus le cadre : l’annonce dit le double, la carte-bonus et la mise n’ont rien à ôter', async () => {
  // La dorure achetée — ou une chasse — dans la journée laisse sa case « pour dorer » (`enjeuDe` ne lit que la possession) :
  // l'annonce disait « Pour la dorer : toutes ses manches parfaites », la carte-bonus « T'en servir ôte le cadre doré », la mise
  // « Tu vises le cadre doré », quand la partie ne peut plus que doubler (`issueDe`).
  const doree = page.salles.flatMap(s => s.oeuvres).find(o => o.possedee && o.doree)!
  assert.equal(doree.cle, 'lecon', 'la Leçon de Léa, gagnée dans un cadre doré')
  const c = uneCase({ jeu: 'eclair', enJeu: { pourDorer: doree.cle }, seuilDuDouble: 6 })
  const annonce = texte(await rendu('views/cabinet/Annonce', 'Annonce', { page: laVisiteDe([c]), demande: { origine: 'visite', case: 0 }, carte: 'coup-d-oeil', busy: false, onCarte: rien, onCommencer: rien, onRetour: rien }))
  assert.doesNotMatch(annonce, /Pour dorer|Pour la dorer|ôte le cadre doré|Sans cadre doré/)
  assert.match(annonce, new RegExp(`Pour un double de ${echapper(doree.nom)}`))
  assert.match(annonce, /Son cadre est déjà doré : 6 étoiles sur 9 font un double, sa poussière d’or en plus\./)
  const { annonceDe } = await import(url('views/cabinet/Annonce.tsx'))
  assert.equal(annonceDe(laVisiteDe([c]), { origine: 'visite', case: 0 }).dorer, false)
  // La visite le dit de même, sur sa case, et sa peinture montre le cadre déjà là.
  const visite = await laVisite(laVisiteDe([c]))
  assert.match(texte(visite), new RegExp(`À jouer ${echapper(JEUX.eclair.nom)} Pour un double de ${echapper(doree.nom)}`))
  assert.match(visite, /<li class="cab-case">.*exp-vc-doree/)
  assert.doesNotMatch(await laVisite(laVisiteDe([{ ...c, enJeu: { pourDorer: aLuiSansCadre().cle } }])), /exp-vc-doree/)
  // La mise : son cadre pas encore doré, miser le perdrait ; déjà doré, rien à perdre.
  const carte = { cle: 'tout-ou-rien', pouvoir: 'miser', force: 1, reste: 1, dit: ceQueFaitLaCarte('miser', 1, 'pari') }
  const avant = { ...vues.pari, origine: 'visite', enJeu: { pourDorer: doree.cle }, seuil: 6, phase: 'avant', carte, pouvoir: { jouable: true }, enCours: undefined, chrono: undefined } as unknown as VueDeLaPartie
  assert.match(texte(await laPartie(avant)), /Tu vises le cadre doré/)
  assert.doesNotMatch(texte(await laPartie(avant, { cadreDejaDore: true })), /cadre doré/)
  // La page le lit de sa page, la partie le reçoit de `CabinetApp` jusqu'à sa mise.
  assert.match(source('views/CabinetApp.tsx'), /cadreDejaDore=\{dejaDoree\(p, vue\.enJeu\)\}/)
  assert.match(source('views/cabinet/Partie.tsx'), /cadreDejaDore=\{cadreDejaDore\}/)
  assert.match(source('views/cabinet/Partie.tsx'), /viseLeCadreDore\(vue, cadreDejaDore\)/)
})

test('« Quitter ? » compte ses étoiles par l’accord du Cabinet, et la tête par le sien : deux fonctions, deux noms', () => {
  // `ceQuOnEmporte` recomposait « N étoile(s) » à la main, à côté d'une `etoilesDites` locale qui disait « sur 9 », homonyme de
  // celle d'`EnEtoiles.tsx` : deux sens sous un nom.
  const partie = source('views/cabinet/Partie.tsx')
  assert.match(partie, /import \{[^}]*\betoilesDites\b[^}]*\} from '\.\/EnEtoiles'/)
  assert.doesNotMatch(partie, /étoile\$\{/, 'un accord écrit à la main')
  assert.doesNotMatch(partie, /const etoilesDites\b/, 'une seconde `etoilesDites`')
})
