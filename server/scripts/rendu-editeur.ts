// L'éditeur d'un quiz (`/edit?quiz=…`), au téléphone d'abord.
//
// « Est ce que tu peux revoir l'onglet quiz maintenant ? Tu peux si tu le
// souhaites modifier la disposition et l'aspect si tu trouves cela
// nécessaire » (le propriétaire, le 10 novembre 2026). On vient ici écrire une
// question et ses réponses : c'est ce qui se voit d'abord, et une question
// tient sur un écran. Avant, en 360 × 640, un QCM à quatre réponses faisait
// 1071 px de haut — un écran et deux tiers ; 1125 dans un quiz qui mélange ses
// réponses —, et le texte de la première question n'arrivait qu'à 588 px, au
// bas du premier écran, sous cinq rangées : son numéro, deux de sortes, deux
// de gestes. Depuis, 541 px, et son texte à 250.
//
// Ce qui ne se voit qu'au navigateur se mesure ici, sur un serveur jetable, à
// huit tailles — six téléphones, du petit de référence (360 × 640) au grand
// (412 × 915), dont un iPhone dans Safari, ses barres dépliées (390 × 664), et
// un grand Android dans Chrome (412 × 800) ; une tablette (768 × 1024) ; un
// portable (1366 × 768), à la souris. Ses cas :
//
//   trois      le quiz du relevé d'avant : deux QCM à quatre réponses, une estimation
//   dix        dix questions variées, le quiz mélangeant ses réponses comme tout quiz né dans l'éditeur : un QCM à quatre
//              réponses — la question type —, à deux (un vrai ou faux), à trois et aux textes longs (un QCM en tient quatre
//              au plus, `MAX_ANSWERS` : pas de QCM à six), une estimation, « plusieurs bonnes réponses », « à remettre dans
//              l'ordre », « Qui dans la salle ? », une photo qui disparaît et son anecdote, une question à compléter — sa
//              photo attendue —, une question mise de côté
//   tout-pret  un quiz tiré de la base : sa marche à côté du numéro, « Une autre » parmi ses gestes
//   longue     la carte la plus longue : photo, observation, extrait, anecdote, note, intertitre, photo de la révélation
//   vide       un quiz sans question
//   neuve      le même, « Ajouter une question » touché
//   deplacee   une question descendue : « Annuler » sous la rangée collée
//   enregistre le titre retouché, « Enregistrer » touché : l'heure de l'enregistrement à côté de « Régler tout le quiz »
//   replis     les replis d'une carte ouverts : ses réglages rares, ce qui l'entoure
//   regler     « Régler tout le quiz » ouvert, un tirage choisi
//   liste      « Coller une liste » ouvert, une liste collée
//   apercu     l'aperçu d'une question
//   etroit     les dix questions sur le plus étroit des téléphones (320 × 568)
//   encoche    les mêmes sous l'encoche d'un iPhone (390 × 844, 47 px en haut, 34 en bas), l'application installée : le
//              titre commence sous elle, et la rangée collée s'y arrête — la page défilée s'y photographie aussi
//   ivoire     les dix questions sous le thème clair
//   sans-croissance  les mêmes dans un navigateur sans `field-sizing`, l'intitulé sur ses deux lignes — dit, sans faire échouer
//   agrandi    le texte agrandi à 130 % — dit, sans faire échouer
//
// À chaque photo : la hauteur de la page et de chaque carte, où commence le
// texte de la première question, ce qui reste collé en haut une fois la page
// défilée, ce qui déborde de côté — de la page, d'une carte —, chaque cible de
// doigt sondée au demi-pixel (`elementFromPoint`), le plus petit texte, les
// champs sous 16 px (iOS agrandit la page au toucher), ce que l'écran tait à
// l'œil.
//
//   npm run build -w client
//   cd server && npx tsx scripts/rendu-editeur.ts ../export/editeur
//
// `SEULEMENT=dix,regler` ne joue que ces cas ; `TAILLES=360x640,1366x768`, que
// ces tailles ; `--client=<dossier>`, après le dossier des photos, photographie
// un autre client construit — celui d'avant une retouche, comme
// `rendu-loge.ts`. Le script sort en erreur si une question type dépasse sa
// hauteur (`PLAFONDS`), si le texte de la première question passe sous la
// moitié de l'écran, si une cible de doigt descend sous 44 px — là où l'on
// touche : six téléphones et la tablette —, un texte sous 11 px, un champ sous
// 16 px, si la page ou une carte déborde de côté, ou si, sous l'encoche, le
// titre ou la rangée collée passent sous elle.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connexionAnimateur, creerQuiz, demarrer, ecrire, estimation, qcm } from '../test/banc'
import type { QuizQuestionDef } from '../../shared/library'

const ici = path.dirname(fileURLToPath(import.meta.url))
const demandes = process.argv.slice(2)
const sortie = path.resolve(demandes.find(a => !a.startsWith('--')) ?? path.join(ici, '../../export/editeur'))
/** Un autre client construit que `client/dist` : celui d'avant une retouche, pour comparer. */
const autreClient = demandes.find(a => a.startsWith('--client='))?.slice('--client='.length)
mkdirSync(sortie, { recursive: true })
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

type Ecran = [number, number]
/**
 * Le petit téléphone de référence, un iPhone dans Safari (ses barres dépliées), un moyen, un grand Android dans Chrome,
 * un iPhone d'aujourd'hui en application installée, un grand Android ; une tablette debout ; un portable.
 */
const TELEPHONES: Ecran[] = [[360, 640], [390, 664], [360, 740], [412, 800], [390, 844], [412, 915]]
const TABLETTE: Ecran = [768, 1024]
const PORTABLE: Ecran = [1366, 768]
const TOUS_LES_ECRANS: Ecran[] = [...TELEPHONES, TABLETTE, PORTABLE]
const TROIS_ECRANS: Ecran[] = [[360, 640], [390, 844], PORTABLE]
const PETIT: Ecran[] = [[360, 640]]
/**
 * Ce que la largeur fait de l'éditeur : un téléphone le range en une colonne (`max-width: 600px`, `styles.css`), une
 * tablette garde la carte d'un ordinateur sous le doigt, un portable se pilote à la souris.
 */
type Sorte = 'telephone' | 'tablette' | 'portable'
const sorteDe = ([largeur]: Ecran): Sorte => (largeur <= 600 ? 'telephone' : largeur < 1000 ? 'tablette' : 'portable')

const seulement = (process.env.SEULEMENT ?? '').split(',').filter(Boolean)
const retenu = (nom: string) => !seulement.length || seulement.includes(nom)
const tailles = (process.env.TAILLES ?? '').split(',').filter(Boolean)
const voulus = (ecrans: Ecran[]) => (tailles.length ? ecrans.filter(([l, h]) => tailles.includes(`${l}x${h}`)) : ecrans)

/** La hauteur d'une cible de doigt, et sa largeur, au moins. */
const CIBLE = 44
/** Le plus petit texte : l'étiquette, 11 px à la taille ordinaire (`--t-label`). */
const PLANCHER = 0.6875
/** Sous 16 px, iOS agrandit la page quand on touche un champ. */
const CHAMP = 16
/** Le temps que la carte arrivée quelque part s'éclaire, et que la page la rejoigne (`SPOT_MS`, `EditorApp.tsx`). */
const SPOT_MS = 1800

/**
 * Ce que l'éditeur mesure, la page en haut. En texte : `tsx` y glisserait des `__name` — et sans accent grave dedans, qui
 * fermerait le gabarit.
 */
const LA_PAGE = `(() => {
  const racine = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const dit = el => [...(el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.textContent || el.getAttribute('title') || el.tagName).trim().replace(/\\s+/g, ' ')].slice(0, 34).join('')
  const quoi = el => (el.getAttribute('class') || el.tagName.toLowerCase()).trim().split(/\\s+/).slice(0, 2).join('.')
  // Caché à l'œil, encore lu : les déclarations de .sr-only, sur lui ou sur un parent.
  const tu = el => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e)
      if (s.position === 'absolute' && s.clipPath.includes('inset(50%)')) return true
    }
    return false
  }
  const visible = el => {
    const r = el.getBoundingClientRect()
    if (r.width <= 1 || r.height <= 1) return false
    // Dans un repli fermé, une boîte garde ses mesures sans se dessiner : checkVisibility le sait.
    if (el.checkVisibility && !el.checkVisibility()) return false
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const s = getComputedStyle(e)
      if (s.display === 'none' || s.visibility === 'hidden') return false
    }
    return !tu(el)
  }
  // Ce qui coupe ou fait défiler ce qu'il contient : ce qui en dépasse ne dépasse pas de la page.
  const borne = el => {
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e)
      if (s.overflowX !== 'visible' || s.position === 'fixed') return true
    }
    return false
  }
  // Une fenêtre posée sur la page — l'aperçu, la photo en grand — vit dans sa carte sans en faire partie.
  const fenetre = el => !!el.closest('.preview-backdrop, .dialog-backdrop')
  const editeur = document.querySelector('.preview-frame, .dialog') || document.querySelector('.editor') || document.body
  const tete = document.querySelector('.editor-header')
  const boite = el => {
    if (typeof el === 'string') el = document.querySelector(el)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return r.width > 1 && r.height > 1 ? { haut: Math.round(r.top + scrollY), bas: Math.round(r.bottom + scrollY), h: Math.round(r.height) } : null
  }
  const cartes = [...document.querySelectorAll('.question-card')].map((c, i) => {
    const r = c.getBoundingClientRect()
    const champ = c.querySelector('textarea')
    const dedans = [...c.querySelectorAll('*')].filter(e => !fenetre(e)).filter(visible).filter(e => !borne(e) || e.parentElement === c)
    const sortent = dedans.filter(e => { const b = e.getBoundingClientRect(); return b.right > r.right + 0.5 || b.left < r.left - 0.5 })
    return {
      n: i + 1,
      haut: Math.round(r.top + scrollY),
      h: Math.round(r.height),
      // Sa boîte, pour la retrouver sur la photo de la page entière.
      x: Math.round(r.left),
      l: Math.round(r.width),
      // Où commence son intitulé, depuis le haut de la carte.
      texte: champ ? Math.round(champ.getBoundingClientRect().top - r.top) : null,
      blocs: [...c.children].filter(e => !fenetre(e)).filter(visible).map(e => quoi(e) + ' ' + Math.round(e.getBoundingClientRect().height)),
      deborde: [...new Set(sortent.map(e => quoi(e) + ' « ' + dit(e) + ' »'))].slice(0, 4),
    }
  })
  const premier = document.querySelector('.question-card textarea')
  // Ce qui dépasse de la page, de côté : la boîte qui passe le bord, hors de ce qu'un cadre coupe ou fait défiler.
  const large = Math.max(0, document.documentElement.scrollWidth - innerWidth)
  const dehors = [...editeur.querySelectorAll('*')].filter(visible).filter(e => !borne(e)).filter(e => { const b = e.getBoundingClientRect(); return b.right > innerWidth + 0.5 || b.left < -0.5 })
  // Les textes : le plus petit, ceux sous le plancher, ce qui est coupé au bout.
  const petits = []
  let plusPetit = null
  const tus = new Set()
  const marcheur = document.createTreeWalker(editeur, NodeFilter.SHOW_TEXT)
  for (let t = marcheur.nextNode(); t; t = marcheur.nextNode()) {
    const el = t.parentElement
    if (!el || !t.textContent.trim() || el.closest('option, script, style')) continue
    if (tu(el)) { if (getComputedStyle(el).display !== 'none') tus.add(dit(el)); continue }
    if (!visible(el)) continue
    const taille = parseFloat(getComputedStyle(el).fontSize)
    if (plusPetit === null || taille < plusPetit.taille) plusPetit = { taille, dit: dit(el) }
    if (taille < racine * ${PLANCHER} - 0.01) petits.push('« ' + dit(el) + ' » ' + taille + ' px')
  }
  const coupes = [...editeur.querySelectorAll('button, .pill, summary, label > span, .muted, b, strong')].filter(visible)
    .filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible' && !e.querySelector('input, textarea, select'))
    .map(e => quoi(e) + ' « ' + dit(e) + ' »')
  // Les champs où l'on écrit : sous 16 px, iOS agrandit la page.
  const champs = [...editeur.querySelectorAll('input:not([type=radio]):not([type=checkbox]):not([type=file]):not([hidden]), textarea, select')].filter(visible)
    .map(e => ({ dit: dit(e), taille: parseFloat(getComputedStyle(e).fontSize) }))
  return {
    ecran: innerWidth + '×' + innerHeight,
    page: document.documentElement.scrollHeight,
    defile: Math.max(0, document.documentElement.scrollHeight - innerHeight),
    large,
    dehors: [...new Set(dehors.map(e => quoi(e) + ' « ' + dit(e) + ' »'))].slice(0, 6),
    tete: boite(tete),
    corps: boite('.editor > .page-corps'),
    premierTexte: premier ? Math.round(premier.getBoundingClientRect().top + scrollY) : null,
    cartes,
    panneau: boite('.regler-tout') || boite('.import-panel') || boite('.preview-frame'),
    pied: boite('.editor > .page-corps > .row:last-of-type'),
    plusPetit,
    petits: [...new Set(petits)],
    coupes: [...new Set(coupes)].slice(0, 8),
    champsPetits: [...new Set(champs.filter(c => c.taille < ${CHAMP} - 0.01).map(c => '« ' + c.dit + ' » ' + c.taille + ' px'))],
    tus: [...tus],
  }
})()`

/**
 * Les cibles de doigt : chaque bouton, lien, champ, liste, repli et lecteur — et ce qu'un doigt y touche vraiment, sondé de
 * demi-pixel en demi-pixel depuis son milieu (`elementFromPoint`) : une pastille basse que sa boîte de toucher élargit
 * compte avec elle, un bouton à demi couvert par son voisin sans ce qu'il couvre. Une case ou un rond dans son étiquette
 * se touche par elle : sa cible est l'étiquette, hors des autres champs qu'elle porte. La page défile jusqu'à chacune : à
 * lancer après la photo. Regroupées par leur nom sans ses chiffres ; de chaque groupe, la plus basse et la plus étroite.
 */
const LES_CIBLES = `(() => {
  const dit = el => [...(el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.getAttribute('title') || el.tagName).trim().replace(/\\s+/g, ' ')].slice(0, 40).join('')
  const cadre = document.querySelector('.preview-backdrop, .dialog-backdrop') || document.querySelector('.editor') || document.body
  const CHAMPS = 'input:not([type=radio]):not([type=checkbox]), textarea, select, button, a[href], summary, audio'
  const groupes = {}
  for (const el of cadre.querySelectorAll('button, a[href], input:not([type=file]):not([hidden]), textarea, select, summary, audio[controls]')) {
    const boite = el.getBoundingClientRect()
    if (boite.width < 1 || boite.height < 1) continue
    // Dans un repli fermé, rien ne se touche.
    if (el.checkVisibility && !el.checkVisibility()) continue
    let cache = false
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e)
      if (s.display === 'none' || s.visibility === 'hidden') cache = true
    }
    if (cache) continue
    const coche = el.matches('input[type=radio], input[type=checkbox]')
    const porteur = coche ? el.closest('label') || el : el
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })
    const r = (coche ? el : porteur).getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const dedans = (x, y) => {
      const e = document.elementFromPoint(x, y)
      if (!e || !porteur.contains(e)) return false
      // Dans l'étiquette d'une case, un autre champ prend le doigt pour lui.
      if (coche && e !== el) { const autre = e.closest(CHAMPS); if (autre && porteur.contains(autre) && autre !== porteur) return false }
      return true
    }
    let h = 0, l = 0
    if (dedans(cx, cy)) {
      h = l = 0.5
      for (let y = cy - 0.5; cy - y < 60 && dedans(cx, y); y -= 0.5) h += 0.5
      for (let y = cy + 0.5; y - cy < 60 && dedans(cx, y); y += 0.5) h += 0.5
      for (let x = cx - 0.5; cx - x < 60 && dedans(x, cy); x -= 0.5) l += 0.5
      for (let x = cx + 0.5; x - cx < 60 && dedans(x, cy); x += 0.5) l += 0.5
    }
    const nom = dit(el).replace(/\\d+/g, 'N')
    const g = groupes[nom] || (groupes[nom] = { nom, n: 0, h: Infinity, l: Infinity, vu: Math.round(boite.width) + '×' + Math.round(boite.height), sorte: el.tagName.toLowerCase() })
    g.n++
    g.h = Math.min(g.h, h)
    g.l = Math.min(g.l, l)
  }
  scrollTo(0, 0)
  return Object.values(groupes)
})()`

const banc = await demarrer(autreClient ? { clientDist: path.resolve(autreClient) } : {})
const navigateur = await chromium.launch({ headless: true })
const rapport: Record<string, any> = {}
let rate = 0

/**
 * La hauteur qu'une carte ne dépasse pas, par sorte d'écran : ce qui a été atteint le 10 novembre 2026, plus une
 * dizaine de pixels de jeu. `type`, la question type — un QCM à quatre réponses, ses replis fermés : 541 px sur les six
 * téléphones (1071 avant, 1125 dans un quiz qui mélange ses réponses), 570 sur la tablette (570 avant, ses cibles sous
 * 44 px relevées), 438 sur le portable et 480 dans un quiz qui mélange — sa quatrième pastille pousse « Anecdote, note,
 * intertitre » sur sa rangée — (526 avant). `neuve`, la carte qu'« Ajouter une question » pose, vide, et qui dit ce qui
 * lui manque : 596 px au téléphone (1166 avant), 514 au portable (560).
 */
const PLAFONDS: Record<'type' | 'neuve', Record<Sorte, number>> = {
  type: { telephone: 550, tablette: 580, portable: 490 },
  neuve: { telephone: 605, tablette: 640, portable: 525 },
}

try {
  const admin = await connexionAnimateur(banc.url)
  const envoyer = async (fichier: string, mime: string) => {
    const dataUrl = `data:${mime};base64,${readFileSync(path.join(ici, fichier)).toString('base64')}`
    const r = await ecrire(banc.url, '/api/images', { dataUrl }, admin)
    if (!r.ok) throw new Error(`La pièce ne part pas (${r.status} ${await r.text()})`)
    return ((await r.json()) as { url: string }).url
  }
  /** Un quiz né dans l'éditeur : ses réponses se mélangent à chaque partie (`EditorApp`, `creer`). */
  const creer = async (titre: string, questions: Partial<QuizQuestionDef>[]) => {
    const r = await ecrire(banc.url, '/api/quizzes', { title: titre, questions, reglages: { melangerReponses: true }, origine: 'editeur' }, admin)
    if (!r.ok) throw new Error(`Le quiz ne se crée pas (${r.status} ${await r.text()})`)
    return ((await r.json()) as { id: string }).id
  }
  const photoDeLaMaison = await envoyer('../content/quiz/images/memoire-5-maison.jpg', 'image/jpeg')
  const photoDesBallons = await envoyer('../content/quiz/images/memoire-8-ballons.jpg', 'image/jpeg')
  // Quelques octets suffisent : le serveur vérifie le type annoncé, pas le son.
  const extrait = await ecrire(banc.url, '/api/images', { dataUrl: 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA' }, admin).then(async r => ((await r.json()) as { url: string }).url)

  // Le quiz du relevé d'avant (`rendu-mes-quiz.ts`, le 10 novembre 2026) : créé comme le banc le crée, sans réglages.
  const trois = await creerQuiz(
    banc.url,
    admin,
    [qcm('La capitale de l’Australie ?', ['Canberra', 'Sydney', 'Melbourne', 'Perth']), qcm('Le plus long fleuve d’Europe ?', ['La Volga', 'Le Danube', 'Le Rhin', 'La Loire']), estimation('La hauteur du mont Blanc ?', 4806, 'm')],
    'Géographie des grandes vacances chez Mamie Jeanne',
  )
  const dix = await creer('Le grand quiz de l’été', [
    qcm('La capitale de l’Australie ?', ['Canberra', 'Sydney', 'Melbourne', 'Perth']),
    qcm('La Grande Muraille de Chine se voit à l’œil nu depuis la Lune.', ['Vrai', 'Faux'], 1),
    { ...qcm('Dans quel pays s’étend la plus grande part de la forêt tropicale que traverse le fleuve du même nom qu’elle ?', ['Le Brésil, pour plus de la moitié de sa surface', 'La République démocratique du Congo', 'L’Indonésie et ses dix-sept mille îles'], 0, 30), category: 'Géographie' },
    { ...estimation('La hauteur du mont Blanc ?', 4806, 'm', 30), category: 'Géographie' },
    { ...qcm('Lesquelles de ces villes sont des capitales ?', ['Ottawa', 'Sydney', 'Berne', 'Istanbul']), variante: 'plusieurs', bonnes: [0, 2] },
    { ...qcm('Du plus ancien au plus récent ?', ['La prise de la Bastille', 'Le sacre de Napoléon', 'La tour Eiffel', 'Le premier pas sur la Lune']), variante: 'ordre' },
    { ...qcm('Qui dans la salle chante le plus faux ?', []), variante: 'sondage' },
    { ...qcm('De quelle couleur était la porte de la maison ?', ['Rouge', 'Bleue', 'Verte', 'Jaune']), image: photoDeLaMaison, observeSeconds: 5, anecdote: 'Elle a été repeinte trois fois depuis.' },
    { ...qcm('Quel est ce monument ?', ['La tour Eiffel', 'Big Ben', 'Le Colisée']), photoAttendue: 'tour-eiffel.jpg' },
    { ...qcm('Combien de joueurs dans une équipe de rugby à XV ?', ['Treize', 'Quinze', 'Onze', 'Sept'], 1), deCote: true, category: 'Sport' },
  ])
  const longue = await creer('Tout ce qu’une question peut porter', [
    {
      ...qcm('Quel titre accompagnait cette photo, la plus longue des questions qu’un animateur puisse écrire sur son téléphone un soir de fête ?', ['La Macarena', 'Mambo n° 5', 'Les Lacs du Connemara', 'Alexandrie Alexandra']),
      image: photoDeLaMaison,
      observeSeconds: 8,
      son: extrait,
      imageRevelation: photoDesBallons,
      anecdote: 'Sortie en 1993, elle n’a quitté les pistes de danse qu’à la fin de la décennie.',
      note: 'Raconte le mariage de Julie.',
      intertitre: 'Manche 2 : la musique',
      category: 'Jeux & pop culture',
      ordreFixe: true,
      duration: 45,
    },
    { ...estimation('Combien pèse le gâteau ?', 0, 'g', 60), enDirect: true },
  ])
  // Celui qu'on enregistre d'ici : à part, son titre change en base.
  const aEnregistrer = await creer('Géographie', [qcm('La capitale de l’Australie ?', ['Canberra', 'Sydney', 'Melbourne', 'Perth']), qcm('Le plus long fleuve d’Europe ?', ['La Volga', 'Le Danube', 'Le Rhin', 'La Loire'])])
  const vide = await creer('Sciences (à écrire)', [])
  const neuve = await creer('Nouveau quiz', [])
  const liste = await creer('Nouveau quiz', [])
  // Un quiz tiré de la base : la marche de chaque question à côté de son numéro, « Une autre » parmi ses gestes.
  const toutPret = await ecrire(banc.url, '/api/quiz-tout-pret', { categories: ['Histoire'], sujet: null, difficulte: 'progressive', nombre: 10, enfants: false, estimations: true }, admin).then(async r => {
    if (!r.ok) throw new Error(`Le quiz tout prêt ne se compose pas (${r.status} ${await r.text()})`)
    return ((await r.json()) as { id: string }).id
  })

  const ouvrir = async (ecran: Ecran, encoche = 0) => {
    const [largeur, hauteur] = ecran
    const tactile = sorteDe(ecran) !== 'portable'
    const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: tactile ? 2 : 1, isMobile: sorteDe(ecran) === 'telephone', hasTouch: tactile, reducedMotion: 'reduce' })
    const [cle, valeur] = admin.split('=')
    await ctx.addCookies([{ name: cle, value: valeur, url: banc.url }])
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    // L'encoche d'un iPhone et sa barre d'accueil, 34 px en bas : Chromium sans écran les tient à zéro (skill `regarder-le-rendu`).
    if (encoche) {
      const cdp = await ctx.newCDPSession(page)
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: encoche, topMax: encoche, bottom: 34, bottomMax: 34, left: 0, leftMax: 0, right: 0, rightMax: 0 } })
    }
    return { ctx, page }
  }
  /** L'éditeur arrivé : son quiz lu, ses images, ses polices. */
  const attendre = async (page: any, attendu: string) => {
    await page.waitForSelector(attendu, { timeout: 15000 })
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
    await page.evaluate('document.fonts.ready')
    await page.waitForTimeout(500)
  }

  type Attendu = {
    /** La carte qu'on détaille, par son numéro : la question type. */
    type?: number
    /** Sa hauteur ne dépasse pas ce plafond, celui de l'écran (`PLAFONDS`). */
    plafond?: keyof typeof PLAFONDS
    /** Le texte de la première question commence dans la moitié haute de l'écran. */
    texteEnHaut?: boolean
    /** Dit sans faire échouer : le texte agrandi. */
    libre?: boolean
    /** Une fenêtre couvre la page — l'aperçu : pas de photo de la page entière. */
    fenetre?: boolean
    /** L'encoche de l'écran, en pixels : ni le titre ni la rangée collée de l'en-tête ne passent dessous. */
    encoche?: number
  }
  /** Mesure l'écran, sonde ses cibles, le photographie — lui, puis la page entière —, et dit ce qui tient. */
  const mesurer = async (page: any, n: string, ecran: Ecran, attendu: Attendu = {}) => {
    if ((await page.evaluate('scrollY')) !== 0) {
      await page.evaluate('scrollTo(0, 0)')
      await page.waitForTimeout(300)
    }
    const m = (await page.evaluate(LA_PAGE)) as any
    m.titre = (await page.evaluate(`Math.round(document.querySelector('.editor-header .title-input').getBoundingClientRect().top)`)) as number
    // Ce que le titre laisse de vide avant la rangée du retour et d'« Enregistrer », la page en haut.
    m.sousLeTitre = (await page.evaluate(`Math.round(document.querySelector('.editor-header .retour-liste').getBoundingClientRect().top - document.querySelector('.editor-header .title-input').getBoundingClientRect().bottom)`)) as number
    // Ce qui reste collé en haut une fois la page défilée : la tête, moins ce qui s'en va avec la page — et où
    // commence sa rangée, celle du retour et d'« Enregistrer ».
    if (m.defile > 400 && m.tete) {
      await page.evaluate('scrollTo(0, 400)')
      await page.waitForTimeout(150)
      m.colle = (await page.evaluate(`Math.max(0, Math.round(document.querySelector('.editor-header').getBoundingClientRect().bottom))`)) as number
      m.rangee = (await page.evaluate(`Math.round(document.querySelector('.editor-header .retour-liste').getBoundingClientRect().top)`)) as number
      // Le titre, qui s'en va avec la page : s'il est encore à l'écran, se touche-t-il — se lit-il — encore ?
      m.titreEnVue = (await page.evaluate(`(() => {
        const titre = document.querySelector('.editor-header .title-input')
        const r = titre.getBoundingClientRect()
        if (r.bottom <= 1) return false
        return document.elementFromPoint(r.left + r.width / 2, Math.max(1, r.bottom - 3)) === titre
      })()`)) as boolean
      // Sous une encoche, la page défilée se photographie aussi : ce qui se colle sous elle.
      if (attendu.encoche) await page.screenshot({ path: path.join(sortie, `${n}-defile.png`) })
      await page.evaluate('scrollTo(0, 0)')
    }
    // L'aperçu : une réponse d'un seul mot s'y lit sur une ligne. Dans des cases trop étroites pour sa taille, elle se
    // coupait par syllabes (« Can-berra », « Mel-bour-ne » sur trois lignes, au téléphone).
    if (attendu.fenetre) {
      m.reponsesCoupees = (await page.evaluate(`[...document.querySelectorAll('.preview-stage .ans-text')].filter(e => {
        if (/\\s/.test(e.textContent.trim())) return false
        const plage = document.createRange()
        plage.selectNodeContents(e)
        return new Set([...plage.getClientRects()].map(r => Math.round(r.top))).size > 1
      }).map(e => e.textContent.trim())`)) as string[]
    }
    m.cibles = (await page.evaluate(LES_CIBLES)) as { nom: string; n: number; h: number; l: number; vu: string; sorte: string }[]
    await page.waitForTimeout(150)
    await page.screenshot({ path: path.join(sortie, `${n}.png`) })
    // La page entière : l'écran agrandi à sa hauteur, puis une photo ordinaire — jamais `fullPage`, ni la photo d'un
    // élément plus haut que l'écran. L'une et l'autre rendent au téléphone émulé un pointeur fin (`pointer: coarse` ne
    // vaut plus, jusqu'au rechargement), et ses boutons reprennent leurs 36 px de souris : la page photographiée n'était
    // plus celle qu'on venait de mesurer, 8 px de moins par bouton. L'éditeur ne lit pas la hauteur de l'écran : agrandi,
    // c'est la même page.
    if (m.defile > 0 && !attendu.fenetre) {
      await page.setViewportSize({ width: ecran[0], height: m.page })
      await page.waitForTimeout(250)
      await page.screenshot({ path: path.join(sortie, `${n}-entiere.png`) })
      await page.setViewportSize({ width: ecran[0], height: ecran[1] })
    }
    rapport[n] = m
    const [, hauteur] = ecran
    const tactile = sorteDe(ecran) !== 'portable'
    const plafond = attendu.plafond ? PLAFONDS[attendu.plafond][sorteDe(ecran)] : null
    const lignes: string[] = []
    const fautes: string[] = []
    const type = attendu.type ? m.cartes[attendu.type - 1] : null
    lignes.push(
      `${n} — la page ${m.page} px${m.defile ? ` (défile de ${m.defile})` : ''}` +
        (m.tete ? ` · la tête ${m.tete.h} px${m.colle !== undefined ? `, ${m.colle} collés` : ''}` : '') +
        (m.premierTexte !== null ? ` · le texte de la question 1 à ${m.premierTexte} px (${Math.round((100 * m.premierTexte) / hauteur)} % de l’écran)` : '') +
        (m.panneau ? ` · le panneau ${m.panneau.haut}→${m.panneau.bas} (${m.panneau.h} px)` : ''),
    )
    if (m.cartes.length) lignes.push(`   cartes : ${m.cartes.map((c: any) => `${c.n}·${c.h}`).join('  ')} px${type ? ` — la question type, ${type.h} px, son texte à ${type.texte} px de son haut` : ''}`)
    if (type) lignes.push(`   la question type : ${type.blocs.join(' · ')}`)
    if (type && plafond !== null && type.h > plafond) fautes.push(`LA QUESTION TYPE FAIT ${type.h} PX, ${plafond} AU PLUS`)
    if (attendu.texteEnHaut && m.premierTexte !== null && m.premierTexte > hauteur / 2) fautes.push(`LE TEXTE DE LA PREMIÈRE QUESTION COMMENCE À ${m.premierTexte} PX, SOUS LA MOITIÉ DE L’ÉCRAN (${hauteur / 2})`)
    if (m.large) fautes.push(`LA PAGE DÉBORDE DE ${m.large} PX EN LARGEUR : ${m.dehors.join(' ; ')}`)
    if (attendu.encoche) {
      lignes.push(`   sous une encoche de ${attendu.encoche} px : le titre à ${m.titre} px, ${m.sousLeTitre} px entre lui et sa rangée, qui se colle à ${m.rangee ?? '—'} px une fois la page défilée`)
      if (m.titre < attendu.encoche) fautes.push(`LE TITRE COMMENCE À ${m.titre} PX, SOUS L’ENCOCHE (${attendu.encoche})`)
      if (m.rangee !== undefined && m.rangee < attendu.encoche) fautes.push(`LA RANGÉE COLLÉE COMMENCE À ${m.rangee} PX, SOUS L’ENCOCHE (${attendu.encoche})`)
      // L'encoche se tient par un cache collé en haut de la page, pas par un vide laissé sous le titre : le titre
      // remonte derrière lui.
      if (m.sousLeTitre > 16) fautes.push(`LE TITRE LAISSE ${m.sousLeTitre} PX VIDES AU-DESSUS DE SA RANGÉE`)
      if (m.titreEnVue) fautes.push('LE TITRE SE LIT ENCORE SOUS L’ENCOCHE, LA PAGE DÉFILÉE')
    }
    const sorties = m.cartes.filter((c: any) => c.deborde.length)
    if (sorties.length) fautes.push(`DÉBORDE DE SA CARTE : ${sorties.map((c: any) => `question ${c.n} — ${c.deborde.join(' ; ')}`).join(' · ')}`)
    // Une cible de doigt, là où l'on touche : un portable se pilote à la souris.
    const basses = (m.cibles as { nom: string; h: number; l: number; vu: string }[]).filter(c => c.h < CIBLE || c.l < CIBLE)
    if (tactile && basses.length) fautes.push(`CIBLE SOUS ${CIBLE} PX : ${basses.map(c => `« ${c.nom} » ${c.l}×${c.h} (sa boîte ${c.vu})`).join(' ; ')}`)
    if (m.reponsesCoupees?.length) fautes.push(`DANS L’APERÇU, UNE RÉPONSE D’UN MOT SE COUPE EN DEUX LIGNES : ${m.reponsesCoupees.join(' ; ')}`)
    if (m.petits.length) fautes.push(`TEXTE SOUS 11 PX : ${m.petits.join(' ; ')}`)
    if (tactile && m.champsPetits.length) fautes.push(`CHAMP SOUS ${CHAMP} PX : ${m.champsPetits.join(' ; ')}`)
    lignes.push(`   le plus petit texte : ${m.plusPetit ? `${m.plusPetit.taille} px (« ${m.plusPetit.dit} »)` : '—'} · ${m.cibles.length} sortes de cibles, la plus basse ${Math.min(...m.cibles.map((c: any) => c.h))} px, la plus étroite ${Math.min(...m.cibles.map((c: any) => c.l))} px`)
    if (m.coupes.length) lignes.push(`   coupé au bout : ${m.coupes.join(' ; ')}`)
    if (m.tus.length) lignes.push(`   tu à l’œil, encore lu : ${m.tus.map((t: string) => `« ${t} »`).join(' ; ')}`)
    for (const l of lignes) console.log(l)
    for (const f of fautes) console.log(`   ${attendu.libre ? '(dit, sans faire échouer) ' : ''}${f}`)
    if (fautes.length && !attendu.libre) rate++
    return m
  }

  /** Un cas : un quiz ouvert dans l'éditeur à chaque taille, un geste éventuel avant la photo. */
  const cas = async (nom: string, quiz: string, ecrans: Ecran[], attendu: (ecran: Ecran) => Attendu = () => ({}), geste?: (page: any, ecran: Ecran) => Promise<void>, texte?: number) => {
    if (!retenu(nom)) return
    for (const ecran of voulus(ecrans)) {
      const ceQuiEstAttendu = attendu(ecran)
      const { ctx, page } = await ouvrir(ecran, ceQuiEstAttendu.encoche)
      await page.goto(`${banc.url}/edit?quiz=${quiz}`)
      await attendre(page, '.editor-header.is-collant')
      if (texte) {
        await page.addStyleTag({ content: `html { font-size: ${texte}% !important; }` })
        await page.waitForTimeout(400)
      }
      if (geste) await geste(page, ecran)
      await mesurer(page, `${nom}-${ecran[0]}x${ecran[1]}`, ecran, ceQuiEstAttendu)
      await ctx.close()
    }
  }
  /** Au doigt là où l'on touche, à la souris sur le portable. */
  const appuyer = (cible: any, ecran: Ecran) => (sorteDe(ecran) === 'portable' ? cible.click() : cible.tap())
  const toucher = (page: any, ecran: Ecran, nom: string | RegExp) => appuyer(page.getByRole('button', { name: nom }).first(), ecran)

  // La question type et le premier écran : ce qui doit tenir, à chaque taille.
  const tenu = (): Attendu => ({ type: 1, plafond: 'type', texteEnHaut: true })
  await cas('trois', trois, TOUS_LES_ECRANS, tenu)
  await cas('dix', dix, TOUS_LES_ECRANS, tenu)
  await cas('tout-pret', toutPret, TROIS_ECRANS, () => ({ type: 1, texteEnHaut: true }))
  await cas('longue', longue, TROIS_ECRANS, () => ({ type: 1 }))
  await cas('vide', vide, TROIS_ECRANS)
  await cas('neuve', neuve, TROIS_ECRANS, () => ({ type: 1, plafond: 'neuve', texteEnHaut: true }), async (page, ecran) => {
    await toucher(page, ecran, 'Ajouter une question')
    await page.waitForSelector('.question-card')
    await page.waitForTimeout(400)
  })
  // Une question déplacée : « Annuler » sous la rangée collée, et la carte arrivée à sa place.
  await cas('deplacee', dix, TROIS_ECRANS, () => ({ texteEnHaut: true }), async (page, ecran) => {
    await toucher(page, ecran, 'Descendre la question 1')
    await page.waitForSelector('.undo-line')
    await page.waitForTimeout(SPOT_MS)
  })
  // Le quiz enregistré d'ici : l'heure de l'enregistrement, à la suite de « Régler tout le quiz ».
  await cas('enregistre', aEnregistrer, TROIS_ECRANS, tenu, async (page, ecran) => {
    // Un titre par écran : le même, déjà en base, ne changerait rien, et « Enregistrer » resterait éteint.
    await page.getByLabel('Titre du quiz').fill(`Géographie des vacances (${ecran[0]} × ${ecran[1]})`)
    await toucher(page, ecran, 'Enregistrer')
    await page.locator('.editor-header .btn-primary', { hasText: 'Enregistré' }).waitFor({ timeout: 15000 })
    await page.waitForTimeout(300)
  })
  // Les replis d'un QCM ouverts : ses réglages rares, ce qui l'entoure.
  await cas('replis', dix, TROIS_ECRANS, () => ({ type: 1 }), async (page, ecran) => {
    // Un par un, le premier encore fermé : ouvert, un repli sort de la liste, et le suivant y change de rang.
    const fermes = page.locator('.question-card').first().locator('details:not([open]) > summary')
    for (let essai = 0; essai < 4 && (await fermes.count()) > 0; essai++) {
      await appuyer(fermes.first(), ecran)
      await page.waitForTimeout(150)
    }
    await page.waitForTimeout(300)
  })
  await cas('regler', dix, TROIS_ECRANS, undefined, async (page, ecran) => {
    await toucher(page, ecran, 'Régler tout le quiz')
    await page.waitForSelector('.regler-tout')
    await toucher(page, ecran, 'Un tirage au hasard')
    await page.waitForTimeout(300)
  })
  await cas('liste', liste, TROIS_ECRANS, undefined, async (page, ecran) => {
    await toucher(page, ecran, 'Coller une liste')
    await page.waitForSelector('.import-panel')
    await page.locator('.import-panel textarea.import-area').first().fill('Titre : Les capitales\n\nLa capitale du Canada ?\n* Ottawa\nToronto\nMontréal\n\nLa hauteur de la tour Eiffel ?\n= 330 m\nPhoto : tour-eiffel.jpg')
    await page.waitForTimeout(300)
  })
  await cas('apercu', dix, TROIS_ECRANS, () => ({ fenetre: true }), async (page, ecran) => {
    await toucher(page, ecran, 'Aperçu de la question 1')
    await page.waitForSelector('.preview-frame')
    await page.waitForTimeout(400)
  })
  // Le plus étroit des téléphones : la sorte y passe sous le numéro — rien ne doit y déborder ni s'y toucher sur moins
  // de 44 px ; sa hauteur se dit, sans plafond.
  await cas('etroit', dix, [[320, 568]], () => ({ type: 1 }))
  // Sous l'encoche d'un iPhone, l'application installée : le titre commence sous elle, et la rangée collée s'y arrête.
  await cas('encoche', dix, [[390, 844]], () => ({ type: 1, plafond: 'type', encoche: 47 }))
  // Sous le thème clair — Ivoire vit dans `styles.css`, ses jetons se posent d'un attribut : la bonne réponse, teintée
  // dans son champ, le sélecteur des sortes et les replis s'y lisent-ils encore ?
  await cas('ivoire', dix, [[360, 640], PORTABLE], tenu, async page => {
    await page.evaluate(`document.documentElement.dataset.theme = 'ivoire'`)
    await page.waitForTimeout(300)
  })
  // Un navigateur qui ne connaît pas `field-sizing` — l'intitulé n'y grandit pas avec son texte, il garde ses deux
  // lignes : ce que la carte y prend de plus, dit sans faire échouer.
  await cas('sans-croissance', dix, PETIT, () => ({ type: 1, plafond: 'type', texteEnHaut: true, libre: true }), async page => {
    await page.addStyleTag({ content: 'textarea { field-sizing: fixed !important; }' })
    await page.waitForTimeout(300)
  })
  await cas('agrandi', dix, PETIT, () => ({ type: 1, plafond: 'type', texteEnHaut: true, libre: true }), undefined, 130)

  writeFileSync(path.join(sortie, 'mesures.json'), JSON.stringify(rapport, null, 2))
  console.log(`Photos et mesures dans ${sortie}`)
  // Par le code de sortie de Node, pas `process.exit()` : ce qui vient de s'écrire part d'abord (règle `tests.md`).
  if (rate > 0) {
    console.log(`${rate} écran${rate > 1 ? 's' : ''} où ce qui doit tenir ne tient pas`)
    process.exitCode = 1
  }
} finally {
  await navigateur.close()
  await banc.close()
}
