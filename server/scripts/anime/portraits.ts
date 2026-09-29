// Les soixante-douze portraits des branches en images : un style par
// branche (l'essai des styles, validé), un ingrédient de plus par palier
// (« La montée en puissance », option A : mêmes sujets, mêmes seuils).
//
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/anime/portraits.ts [branche…] --lot
//   … --sans-appel            # rien de payé : références, assemblage, planche
//   … --regenerer=br:thor,…   # repayer ces images (et leurs découpes)
//   … --redecouper=br:thor,…  # repayer ces découpes seulement
//
// Sans branche nommée, toutes. Chaque palier a sa recette :
//
// - le premier (le visage) : le personnage seul, peint sur un fond uni
//   qu'on détoure — le disque teinté de sa branche le reçoit ;
// - du deuxième au cinquième : une illustration entière, le personnage dans
//   son décor, que le disque découpe ; puis sa découpe, que Nano Banana
//   repeint à partir d'elle — le personnage gardé tel quel, tout le reste en
//   fond uni. Détourée et alignée sur l'illustration, elle en donne la forme :
//   la silhouette dorée d'un portrait à gagner, le ciel rare de l'Éclat
//   derrière un visage qui garde ses couleurs, et au cinquième ce qui sort
//   du disque ;
// - le sixième (la forme ultime) : l'image de l'essai des styles, telle
//   qu'elle a été validée (`export/styles/style-<branche>`), et sa découpe.
//
// Deux passes, donc : les images, puis les découpes, qui partent d'elles.
// En lot (`--lot`), chaque passe coûte la moitié et revient en quelques
// minutes ; un lot qui tarde se reprend par son nom au lancement suivant
// (`lots-en-cours.json`). Une image payée n'est jamais redemandée sans
// --regenerer, et l'ancienne est gardée à côté. Le journal
// (`journal-portraits.json`) garde les jetons et le coût estimé de chacune.
//
// Sortie : ../export/portraits/<branche>/ — les références, les consignes,
// les images et les découpes brutes, et dans app/ les fichiers de
// l'application (WebP, 512 et 256 pixels pour les 100 unités du disque de
// `Portrait.tsx`). `livrer.ts` les pose dans le client.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import { CHROMAS, PALIERS, STYLES, SUJETS, type Chroma } from './consignes'
import { coutEstime, enPartie, formatDe, generer, lancerLot, lireLot, type Demande, type Partie, type Rendu } from './gemini'
import { dansLaPage, deDataUrl, pagePixels } from './pixels'

Object.assign(globalThis, { React })
const { renderToStaticMarkup } = await import('react-dom/server')
const duClient = (fichier: string) => import(new URL(`../../../client/src/${fichier}`, import.meta.url).href)
const { Portrait } = await duClient('components/Portrait.tsx')
const { BRANCHES } = await import('../../../shared/branches')
for (const b of BRANCHES) await duClient(`components/portraits/${b.key}.ts`)

const args = process.argv.slice(2)
const LOT = args.includes('--lot')
const SANS_APPEL = args.includes('--sans-appel')
const liste = (nom: string) => (args.find(a => a.startsWith(`--${nom}=`))?.slice(nom.length + 3) ?? '').split(',').filter(Boolean)
const REGENERER = liste('regenerer')
const REDECOUPER = liste('redecouper')
/** Ce qu'on attend un lot, au plus, avant de rendre la main : il se reprend au lancement suivant. */
const ATTENTE = Number(process.env.ATTENTE ?? 1800)
const voulues = args.filter(a => !a.startsWith('--'))
const racine = path.resolve('../export/portraits')
const MODELE = process.env.MODELE ?? 'gemini-3-pro-image'
const TAILLE = process.env.TAILLE ?? '1K'
/**
 * Les tailles des fichiers de l'application, pour 100 unités du disque : la
 * grande pour ce qu'on regarde (la fin de soirée, la carte), la petite pour
 * les listes — l'avatar d'une carte, à 3 em sur un téléphone trois fois plus
 * dense, en demande 250.
 */
const TAILLES = [512, 256]
const QUALITE = 0.82

/**
 * La part de la largeur de l'image que couvre le carré 0 → 100 du disque,
 * palier par palier. Presque toute l'image jusqu'au quatrième (les coins
 * tombent) ; moins au cinquième et au sixième, dont le personnage sort du
 * disque par le haut : ce qui dépasse est dans la marge.
 */
export const DISQUE = [0.94, 0.92, 0.92, 0.92, 0.76, 0.84]
/** Le cadre du personnage, dans le repère du disque (origine, côté) : le carré, ou plus large quand il en sort. */
export const CADRE_PERSO: [number, number][] = [[0, 100], [0, 100], [0, 100], [0, 100], [-20, 140], [-20, 140]]

// ── Les consignes ─────────────────────────────────────────────────────────
// En anglais, comme celles de l'essai. Le style de la branche (`STYLES`),
// son échelle et le palier (`PALIERS`) disent comment on la dessine ; le
// sujet (`SUJETS`), qui c'est.

// Le cadrage ne parle jamais de cercle : « tiens-toi dans un cercle de 90 %
// de la largeur » faisait dessiner ce cercle, un badge sur fond blanc (la
// Gorgone, Anubis et Poséidon du premier lot).
const COMMUN =
  'Square avatar illustration for a party quiz game — one of six avatars of a themed series, each tier richer than the one before. ' +
  'Paint the scene edge to edge over the whole square: no round badge or sticker shape, no drawn circle, no vignette, no frame, no border, ' +
  'and never a white or blank background — the scene covers every pixel. ' +
  'It must read instantly even as a tiny round icon: a strong silhouette, big clear shapes, the face well lit. ' +
  'No text, no letters, no numbers, no signature, no watermark. Output one square image (1:1 aspect ratio).'

const PREMIER =
  'Square avatar for a party quiz game — the first and simplest of a themed series of six. ' +
  'The subject alone, head and shoulders, centered, facing the viewer: its head in the upper middle of the canvas, its shoulders reaching the bottom edge. ' +
  'It must read instantly even as a tiny round icon: a strong silhouette, big clear shapes, the face well lit. ' +
  'No text, no letters, no numbers, no signature, no watermark. Output one square image (1:1 aspect ratio).'

/** Le cadrage des paliers 2 à 4 : le disque en prend presque tout, sauf les coins. */
const CADRAGE =
  'Framing: the subject centered, its head, hands and key props well inside the canvas and away from the four corners, which will be cut off. ' +
  'The setting fills the whole canvas behind it.'

/** Le débord du cinquième : sans le dire, le modèle ramène tout dans le cadre. */
const cadrageDebord = (deborde: string) =>
  'Framing: the subject centered and a little lower than usual, its face and body well inside the canvas; ' +
  `${deborde} rises high above its head, up into the top band of the canvas near the top edge — that is what this tier is about. ` +
  'The setting fills the whole canvas behind it.'

const REFERENCE =
  'The attached image is the current flat vector avatar of this subject, a simple placeholder: use it only to know who the subject is — ' +
  'its colors, clothes and props. Do not copy its drawing, pose or framing.'

const fondUni = (c: Chroma) => {
  const { hex, nom } = CHROMAS[c]
  const teinte = c === 'vert' ? 'green' : 'magenta or pink'
  return (
    `Background: a single perfectly flat, uniform ${nom} (${hex}) filling the entire canvas edge to edge — no gradient, no texture, no paper grain, ` +
    'no floor, no cast shadow, no glow or light spilling onto it, no vignette. The style’s paper, print or film texture applies to the subject only. ' +
    `Do not use any ${teinte} on the subject.`
  )
}

const decoupe = (garde: string, c: Chroma) => {
  const { hex, nom } = CHROMAS[c]
  return (
    `Edit the attached image. Keep ${garde} exactly as it is — same pose, same position, same size, same outline, same colors and details, untouched. ` +
    'Replace everything else — the whole setting, sky, ground, background objects, and the effects that are not attached to the subject — ' +
    `with a single perfectly flat, uniform ${nom} (${hex}) filling the canvas edge to edge: no gradient, no shadow, no glow, no texture, no paper grain on it. ` +
    'Do not move, resize, crop, redraw or restyle the subject. Output one square image (1:1 aspect ratio).'
  )
}

interface Fiche {
  cle: string
  id: string
  nom: string
  branche: string
  /** Le palier, de 0 (le visage) à 5 (la forme ultime). */
  i: number
  dossier: string
}

const fiches: Fiche[] = BRANCHES.filter((b: any) => voulues.length === 0 || voulues.includes(b.key)).flatMap((b: any) =>
  b.portraits.map((p: any, i: number) => ({ cle: p.key, id: p.key.slice(3), nom: p.nom, branche: b.key, i, dossier: path.join(racine, b.key) })),
)
if (fiches.length === 0) throw new Error(`Aucune branche parmi : ${voulues.join(', ')}`)

/** Le nom du sujet, tel que sa consigne le dit avant ses deux-points : « the Minotaur ». */
const nomDuSujet = (cle: string) => SUJETS[cle].sujet.slice(0, SUJETS[cle].sujet.indexOf(':'))

function consigneImage(f: Fiche): string {
  const s = STYLES[f.branche]
  const sujet = SUJETS[f.cle]
  if (f.i === 0) return [PREMIER, PALIERS[0], s.style, s.echelle[0], `Subject: ${sujet.sujet}`, REFERENCE, fondUni(sujet.chroma ?? 'vert')].join('\n\n')
  const cadrage = f.i === 4 ? cadrageDebord(sujet.deborde ?? 'part of the subject') : CADRAGE
  return [COMMUN, PALIERS[f.i], s.style, s.echelle[f.i], `Subject: ${sujet.sujet}`, cadrage, REFERENCE].join('\n\n')
}

function consigneDecoupe(f: Fiche): string {
  if (f.i === 5) {
    const s = STYLES[f.branche]
    return decoupe(s.ultimeGarde, s.ultimeChroma)
  }
  const sujet = SUJETS[f.cle]
  const garde = sujet.garde ?? `${nomDuSujet(f.cle)} with everything it wears and holds`
  return decoupe(sujet.deborde ? `${garde}, and ${sujet.deborde}` : garde, sujet.chroma ?? 'vert')
}

// ── Les fichiers ──────────────────────────────────────────────────────────

const existant = (dossier: string, nom: string) => ['png', 'jpg', 'webp'].map(e => path.join(dossier, `${nom}.${e}`)).find(f => existsSync(f))
const imageDe = (f: Fiche) => existant(f.dossier, `image-${f.id}`)
const decoupeDe = (f: Fiche) => existant(f.dossier, `decoupe-${f.id}`)
const enDataUrl = (fichier: string) => {
  const b = readFileSync(fichier)
  return `data:${formatDe(b).mime};base64,${b.toString('base64')}`
}

/** Met une image payée de côté, datée : on ne jette jamais ce qui a coûté. */
function mettreDeCote(fichier: string | undefined) {
  if (!fichier) return
  const ext = path.extname(fichier)
  renameSync(fichier, fichier.slice(0, -ext.length) + `.ancien-${Date.now()}${ext}`)
}

const cheminJournal = path.join(racine, 'journal-portraits.json')
mkdirSync(racine, { recursive: true })
const journal: any[] = existsSync(cheminJournal) ? JSON.parse(readFileSync(cheminJournal, 'utf8')) : []
const total = () => journal.reduce((n, e) => n + (e.cout ?? 0), 0)

/** Range une image payée, et son coût au journal — écrit à chaque image : une panne au milieu ne perd pas le compte. */
function ranger(cle: string, quoi: 'image' | 'decoupe', r: Rendu, lot: boolean) {
  const f = fiches.find(x => x.cle === cle)
  if (!f) return console.log(`${cle} : réponse d'une autre branche, ignorée`)
  writeFileSync(path.join(f.dossier, `${quoi}-${f.id}.${formatDe(r.image).ext}`), r.image)
  const cout = coutEstime(r.jetons, { lot })
  journal.push({ cle, quoi, date: new Date().toISOString(), modele: MODELE, taille: TAILLE, lot, secondes: r.secondes, jetons: r.jetons, cout })
  writeFileSync(cheminJournal, JSON.stringify(journal, null, 2) + '\n')
  console.log(`  ${cle} · ${quoi} : environ ${cout.toFixed(3)} $ (total ${total().toFixed(2)} $)`)
}

// ── Le tout ───────────────────────────────────────────────────────────────

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'portraits.js'))('playwright')
}
const { chromium } = chargerPlaywright()
const nav = await chromium.launch({ headless: true })

/** La référence d'un portrait : son dessin d'aujourd'hui, par le vrai composant, en 512. */
async function reference(page: any, f: Fiche) {
  const cible = path.join(f.dossier, `ref-${f.id}.png`)
  if (existsSync(cible)) return cible
  const svg = renderToStaticMarkup(React.createElement(Portrait, { cle: f.cle }))
  await page.setContent(`<!doctype html><body style="margin:0"><div style="width:512px;height:512px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`)
  await page.screenshot({ path: cible, omitBackground: true, clip: { x: 0, y: 0, width: 512, height: 512 } })
  return cible
}

type Quoi = 'image' | 'decoupe'
interface Appel extends Demande {
  quoi: Quoi
}

const cheminLots = path.join(racine, 'lots-en-cours.json')

/** Attend les lots en cours ; rend vrai s'ils sont tous revenus. */
async function attendre(lots: { nom: string; quoi: Quoi }[]): Promise<boolean> {
  const t0 = Date.now()
  const restants = [...lots]
  while (restants.length) {
    for (const l of [...restants]) {
      const etat = await lireLot(l.nom)
      if (!etat.fini) continue
      console.log(`lot ${l.nom} (${l.quoi}) : ${etat.etat} en ${((Date.now() - t0) / 1000).toFixed(0)} s`)
      for (const [cle, r] of etat.resultats) typeof r === 'string' ? console.log(`  ${cle} · ${l.quoi} : ${r}`) : ranger(cle, l.quoi, r, true)
      restants.splice(restants.indexOf(l), 1)
      writeFileSync(cheminLots, JSON.stringify(restants) + '\n')
    }
    if (!restants.length) break
    if (Date.now() - t0 > ATTENTE * 1000) {
      console.log(`${restants.length} lot(s) encore en route après ${ATTENTE} s : relance plus tard pour les reprendre.`)
      return false
    }
    await new Promise(ok => setTimeout(ok, 20_000))
  }
  return true
}

/** Envoie les appels : en lots de moins de quinze mégaoctets, ou un par un sans --lot. */
async function envoyer(appels: Appel[]) {
  if (!LOT) {
    for (const a of appels) {
      console.log(`  ${a.cle} · ${a.quoi} : ${MODELE} ${TAILLE}…`)
      try {
        ranger(a.cle, a.quoi, await generer(a.parties, { modele: MODELE, taille: TAILLE }), false)
      } catch (e) {
        console.log(`  ${a.cle} · ${a.quoi} : ${(e as Error).message}`)
      }
    }
    return true
  }
  const lots: { nom: string; quoi: Quoi }[] = []
  for (const quoi of ['image', 'decoupe'] as Quoi[]) {
    const lesQuels = appels.filter(a => a.quoi === quoi)
    let paquet: Appel[] = []
    let poids = 0
    const partir = async () => {
      if (!paquet.length) return
      const nom = await lancerLot(paquet, { modele: MODELE, taille: TAILLE, nom: `fiestapp-portraits-${quoi}` })
      console.log(`lot ${nom} : ${paquet.length} ${quoi === 'image' ? 'image(s)' : 'découpe(s)'}, ${(poids / 1e6).toFixed(1)} Mo`)
      lots.push({ nom, quoi })
      writeFileSync(cheminLots, JSON.stringify(lots) + '\n')
      paquet = []
      poids = 0
    }
    for (const a of lesQuels) {
      const p = JSON.stringify(a.parties).length
      if (poids + p > 15e6) await partir()
      paquet.push(a)
      poids += p
    }
    await partir()
  }
  return attendre(lots)
}

try {
  const page = await pagePixels(nav, 512)
  for (const f of fiches) mkdirSync(path.join(f.dossier, 'app'), { recursive: true })
  for (const cle of REGENERER) {
    const f = fiches.find(x => x.cle === cle)
    if (!f) throw new Error(`${cle} : pas dans les branches demandées`)
    if (f.i === 5) throw new Error(`${cle} : la forme ultime est l'image validée de l'essai des styles — c'est là qu'elle se repaie`)
    mettreDeCote(imageDe(f))
    mettreDeCote(decoupeDe(f))
  }
  for (const cle of REDECOUPER) {
    const f = fiches.find(x => x.cle === cle)
    if (!f) throw new Error(`${cle} : pas dans les branches demandées`)
    mettreDeCote(decoupeDe(f))
  }

  // La forme ultime : l'image validée de l'essai des styles.
  for (const f of fiches.filter(x => x.i === 5)) {
    const validee = existant(path.resolve('../export/styles'), `style-${f.branche}`)
    if (!validee) throw new Error(`${f.branche} : pas d'image validée dans export/styles`)
    const ici = path.join(f.dossier, `image-${f.id}${path.extname(validee)}`)
    if (!imageDe(f)) copyFileSync(validee, ici)
  }

  // Un lot laissé en route la dernière fois : on le reprend d'abord.
  const enCours = existsSync(cheminLots) ? readFileSync(cheminLots, 'utf8').trim() : ''
  if (enCours && enCours !== '[]') {
    console.log('Reprise des lots en route')
    if (!(await attendre(JSON.parse(enCours)))) process.exit(0)
  }

  // Deux passes au plus : les images, puis les découpes de celles qui viennent d'arriver.
  for (let passe = 1; passe <= 2; passe++) {
    const appels: Appel[] = []
    for (const f of fiches) {
      const image = imageDe(f)
      if (!image && f.i < 5) {
        const consigne = consigneImage(f)
        writeFileSync(path.join(f.dossier, `consigne-${f.id}.txt`), consigne + '\n')
        appels.push({ cle: f.cle, quoi: 'image', parties: [enPartie(await reference(page, f)), { text: consigne }] })
      } else if (image && f.i > 0 && !decoupeDe(f)) {
        const consigne = consigneDecoupe(f)
        writeFileSync(path.join(f.dossier, `consigne-decoupe-${f.id}.txt`), consigne + '\n')
        // La découpe ne demande que la forme : l'image part en 768, en JPEG.
        const reduite = await dansLaPage<string>(page, 'jpegReduit', enDataUrl(image), 768, 0.9)
        appels.push({
          cle: f.cle,
          quoi: 'decoupe',
          parties: [{ inlineData: { mimeType: 'image/jpeg', data: reduite.slice(reduite.indexOf(',') + 1) } } as Partie, { text: consigne }],
        })
      }
    }
    // Sans appel, les consignes et les références sont écrites : on les relit avant de payer.
    if (!appels.length || SANS_APPEL) break
    console.log(`Passe ${passe} : ${appels.filter(a => a.quoi === 'image').length} image(s), ${appels.filter(a => a.quoi === 'decoupe').length} découpe(s)`)
    if (!(await envoyer(appels))) process.exit(0)
  }

  // L'assemblage : détourer, aligner, poser dans les cadres de l'application.
  console.log('Assemblage')
  const bilan: Record<string, unknown> = {}
  for (const f of fiches) {
    const image = imageDe(f)
    if (!image) {
      console.log(`  ${f.cle} : pas encore d'image`)
      continue
    }
    const app = path.join(f.dossier, 'app')
    let sortie: { disque: Record<number, string>; perso: Record<number, string> }
    if (f.i === 0) {
      const d = await dansLaPage<any>(page, 'detourer', enDataUrl(image))
      writeFileSync(path.join(f.dossier, `detoure-${f.id}.png`), deDataUrl(d.plein))
      sortie = await dansLaPage(page, 'assembler', { image: d.plein, disque: DISQUE[0], cadre: CADRE_PERSO[0], tailles: TAILLES, qualite: QUALITE })
      bilan[f.cle] = { fond: d.fond, transparents: +d.transparents.toFixed(3) }
      console.log(`  ${f.cle} : fond ${d.fond}, ${(d.transparents * 100).toFixed(0)} % transparent`)
    } else {
      const dec = decoupeDe(f)
      if (!dec) {
        console.log(`  ${f.cle} : pas encore de découpe`)
        continue
      }
      const d = await dansLaPage<any>(page, 'detourer', enDataUrl(dec))
      writeFileSync(path.join(f.dossier, `detoure-${f.id}.png`), deDataUrl(d.plein))
      const a = await dansLaPage<any>(page, 'aligner', enDataUrl(image), d.plein)
      sortie = await dansLaPage(page, 'assembler', {
        image: enDataUrl(image),
        decoupe: d.plein,
        s: a.s,
        dx: a.dx,
        dy: a.dy,
        disque: DISQUE[f.i],
        cadre: CADRE_PERSO[f.i],
        tailles: TAILLES,
        qualite: QUALITE,
      })
      bilan[f.cle] = { fond: d.fond, transparents: +d.transparents.toFixed(3), alignement: a }
      console.log(
        `  ${f.cle} : fond ${d.fond}, ${(d.transparents * 100).toFixed(0)} % transparent ; ` +
          `aligné ×${a.s.toFixed(3)} (${(a.dx * 100).toFixed(1)} %, ${(a.dy * 100).toFixed(1)} %), écart ${a.sansAlignement.toFixed(0)} → ${a.ecart.toFixed(0)}`,
      )
    }
    for (const [variante, tailles] of Object.entries(sortie)) {
      for (const [t, data] of Object.entries(tailles)) writeFileSync(path.join(app, `${f.id}-${variante}-${t}.webp`), deDataUrl(data))
    }
  }
  writeFileSync(path.join(racine, 'assemblage.json'), JSON.stringify(bilan, null, 2) + '\n')
  const fichiers = fiches.flatMap(f => (existsSync(path.join(f.dossier, 'app')) ? readdirSync(path.join(f.dossier, 'app')) : []))
  console.log(`${fichiers.length} fichier(s) prêts ; coût estimé à ce jour : ${total().toFixed(2)} $`)
} catch (e) {
  console.error((e as Error).message)
  process.exitCode = 1
} finally {
  await nav.close()
}
