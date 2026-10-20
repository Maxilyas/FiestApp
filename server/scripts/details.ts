// Les images du « détail », une forme de question de l'Expédition : un
// tableau célèbre dont on ne voit d'abord qu'un détail, qui s'élargit en
// quatre cadrages jusqu'au tableau entier (`retours/2026-10-20/la-frise.md`,
// « Le détail, quand les images viendront »). Depuis `server/` :
//
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/details.ts choisir      les candidats, de la base et de Wikidata
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/details.ts telecharger  leurs miniatures, dans le cache
//   npx tsx scripts/details.ts planches                          des planches quadrillées, pour choisir à l'œil
//   npx tsx scripts/details.ts decouper                          les quatre cadrages et la fiche
//   npx tsx scripts/details.ts verifier                          ce que `details.test.ts` garde, en plus court
//
// Les candidats sont les tableaux que la base de la campagne pose déjà
// (« Qui a peint « … » ? ») : la forme tirera ses leurres de la même base.
// Le peintre est mort en 1955 au plus tard — soixante-dix ans révolus en
// 2026 : le tableau est du domaine public partout où l'application se joue.
//
// Le choix d'un détail se fait à l'œil, sur les planches : parlant pour qui
// connaît le tableau, jamais ce qui le nomme d'un coup (la main de la
// Joconde, pas son visage). Il vit ici (`DETAILS`), avec ce qu'on a écarté et
// pourquoi (`ECARTES`) : un script qui refait tout doit savoir ce qu'on a vu.
//
// Le cache (la réponse de Wikidata, les miniatures, les planches) vit dans
// `.details/`, à la racine, que git ignore. Les images livrées et leur fiche
// vont dans `server/content/details/` — hors de `client/public` : servi en
// fichier statique, le tableau entier se téléchargeait avant la réponse
// (invariant 1) ; la forme sert chaque cadrage à son heure.
//
// Wikimedia refuse une requête sans User-Agent identifiable, une largeur de
// miniature hors de sa liste (1920, 1280 et 960 passent) et l'original : une
// miniature à la fois, cinq secondes entre deux ; sur un 429, la largeur
// suivante, puis on attend de plus en plus. Le 20 octobre 2026, cent onze
// miniatures ont pris une heure.
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SERVEUR } from '../src/racine'
import { lireLaBase } from '../src/core/baseCampagne'
import { Wikidata, anneeDe, qidDe } from './faits-wikidata'
import { dansLaPage, deDataUrl, pagePixels } from './anime/pixels'

const CACHE = path.join(SERVEUR, '..', '.details')
export const DOSSIER_DES_DETAILS = path.join(SERVEUR, 'content', 'details')
export const FICHE_DES_DETAILS = path.join(DOSSIER_DES_DETAILS, 'tableaux.json')
const CANDIDATS = path.join(CACHE, 'candidats.json')
const UA = 'FiestAppDetail/0.1 (https://github.com/Maxilyas/FiestApp) node'

/** Soixante-dix ans après la mort du peintre, au 1er janvier : en 2026, mort en 1955 au plus tard. */
export const MORT_AU_PLUS_TARD = 1955
/** La largeur du détail, en part de celle du tableau ; les cadrages suivants, jusqu'au tableau entier. */
export const ECHELLES = [0.2, 0.36, 0.6, 1] as const
/** Ce qu'un cadrage pèse au plus, et sa taille : environ 640 de large, jamais plus de 800 de haut. */
export const POIDS_MAX = 40 * 1024
const LARGEUR = 640
const HAUTEUR_MAX = 800
/** Un tableau que moins de dix Wikipédia décrivent est, sous un titre célèbre, une copie ou une version obscure (« Marat assassiné », 0). */
const LIENS_MIN = 10
/** Les plus liés d'abord : les 111 premiers, regardés le 20 octobre 2026, en ont donné cent (`DETAILS`) et onze écartés (`ECARTES`). */
const A_REGARDER = 111
/** Entre deux requêtes à Wikimedia : à une seconde et demie, une image sur deux attendait un 429 de plus en plus long. */
const PAUSE = 5_000
/** Les largeurs de miniature que Wikimedia accepte, de la plus grande : le détail en est agrandi. */
const LARGEURS = [1920, 1280, 960] as const

/** Un tableau de la fiche (`server/content/details/tableaux.json`). */
export interface TableauDuDetail {
  qid: string
  titre: string
  peintre: string
  annee: number | null
  mortDuPeintre: number
  fichier: string
  page: string
  statut: 'domaine public'
  /** Quatre cadrages, du détail au tableau entier, en fractions de l'image : x, y, largeur, hauteur. */
  cadrages: [number, number, number, number][]
  /** Les questions de la base qui le demandent. */
  questions: string[]
}

interface Candidat {
  qid: string
  titre: string
  peintre: string
  annee: number | null
  mortDuPeintre: number
  fichier: string
  liens: number
  questions: string[]
}

/**
 * Le centre du détail, en fractions du tableau, choisi à l'œil sur sa planche.
 * Le détail fait un cinquième de la largeur : posé trop près du bord, il est
 * ramené dedans.
 */
const DETAILS: Record<string, [number, number]> = {
  Q12418: [0.50, 0.83], // La Joconde : les mains
  Q128910: [0.80, 0.55], // La Cène : trois apôtres à droite
  Q471379: [0.11, 0.40], // Le Cri : les deux promeneurs du pont
  Q45585: [0.55, 0.86], // La Nuit étoilée : le village et son clocher
  Q185372: [0.66, 0.40], // La Jeune Fille à la perle : le pan du turban
  Q29530: [0.22, 0.40], // La Liberté guidant le peuple : l'homme au haut-de-forme
  Q219831: [0.92, 0.72], // La Ronde de nuit : le tambour
  Q151047: [0.80, 0.62], // La Naissance de Vénus : la robe fleurie de l'Heure
  Q208758: [0.74, 0.92], // Les Ménines : le chien
  Q154469: [0.45, 0.33], // Les Mangeurs de pommes de terre : la lampe
  Q698487: [0.56, 0.62], // Le Baiser : les cercles de la robe
  Q1892745: [0.82, 0.92], // Salvator Mundi : la sphère de cristal
  Q474338: [0.42, 0.45], // La Dame à l'hermine : le collier
  Q157541: [0.17, 0.25], // Les Tournesols : une fleur fanée
  Q321303: [0.62, 0.56], // Le Jardin des délices : les fruits géants
  Q311243: [0.78, 0.37], // Le Voyageur contemplant une mer de nuages : le rocher dans la brume
  Q212616: [0.64, 0.24], // Le Radeau de la Méduse : l'homme qui agite son linge
  Q478271: [0.74, 0.40], // Les Cosaques zaporogues écrivant une lettre au sultan de Turquie : les rieurs du fond
  Q152509: [0.20, 0.88], // Le Déjeuner sur l'herbe : le panier renversé
  Q152867: [0.74, 0.72], // La Maja nue : les coussins
  Q464782: [0.45, 0.17], // American Gothic : la fenêtre gothique
  Q661378: [0.92, 0.73], // La Leçon d'anatomie du docteur Tulp : le livre ouvert
  Q167605: [0.27, 0.68], // La Laitière : la corbeille de pain
  Q683274: [0.88, 0.73], // Bal du moulin de la Galette : les verres sur la table
  Q220859: [0.09, 0.91], // Les Époux Arnolfini : les socques (le lustre montrait la signature du peintre)
  Q737062: [0.95, 0.62], // Olympia : le chat noir
  Q476458: [0.88, 0.74], // Le Serment des Horaces : les femmes en pleurs
  Q1025704: [0.72, 0.73], // Terrasse du café le soir : les tables de la terrasse
  Q523974: [0.28, 0.90], // Vue de Delft : les deux femmes sur la berge
  Q727875: [0.82, 0.45], // Vénus d'Urbin : les servantes au coffre
  Q1245354: [0.08, 0.85], // Un bar aux Folies Bergère : les bouteilles du comptoir
  Q500985: [0.62, 0.58], // Chasseurs dans la neige : les patineurs
  Q1133420: [0.80, 0.16], // La Reddition de Bréda : les lances
  Q1231009: [0.18, 0.62], // Le Sacre de Napoléon : l'assistance
  Q328079: [0.06, 0.94], // La Madone Sixtine : la tiare
  Q533619: [0.12, 0.12], // Les Proverbes flamands : les tartes sur le toit
  Q1170315: [0.17, 0.16], // Carré noir sur fond blanc : un coin du carré, ses craquelures
  Q699091: [0.93, 0.85], // La Tour de Babel : le port et ses bateaux
  Q17277950: [0.22, 0.22], // Les Joueurs de cartes : le chapeau du fumeur
  Q354396: [0.60, 0.72], // Portrait d'Adele Bloch-Bauer I : les yeux de la robe
  Q656434: [0.76, 0.68], // La Belle Ferronnière : le nœud de la manche
  Q1212937: [0.72, 0.60], // Les Ambassadeurs : le luth
  Q1978815: [0.90, 0.52], // La Grande Odalisque : le rideau et la pipe
  Q4195595: [0.50, 0.92], // Ivan le Terrible tue son fils : le tapis et le sceptre tombé
  Q540488: [0.73, 0.88], // Un enterrement à Ornans : le chien
  Q890678: [0.20, 0.35], // D'où venons-nous ? Que sommes-nous ? Où allons-nous ? : l'idole bleue
  Q969377: [0.62, 0.20], // La Vocation de saint Matthieu : la fenêtre
  Q500951: [0.66, 0.58], // Le Christ jaune : le paysan au loin
  Q546297: [0.10, 0.22], // Lamentation sur le Christ mort : les pleureuses
  Q588695: [0.55, 0.20], // L'Art de la peinture : le lustre
  Q153441: [0.50, 0.92], // La Fornarina : les mains sur le drapé rouge
  Q275349: [0.42, 0.24], // Vénus à son miroir : le ruban du miroir
  Q644856: [0.12, 0.74], // Le Triomphe de la Mort : la charrette de crânes
  Q1133821: [0.12, 0.72], // La Mort de Sardanapale : la tête du cheval
  Q1167178: [0.47, 0.86], // L'Atelier du peintre : le chat blanc
  Q1167907: [0.30, 0.72], // Le Déjeuner des canotiers : les bouteilles et le raisin
  Q1192570: [0.65, 0.16], // La Parabole des aveugles : le clocher
  Q1239950: [0.35, 0.44], // L'Absinthe : la carafe
  Q2366825: [0.07, 0.52], // La Charrette de foin : la maison au bord de l'eau
  Q2727560: [0.82, 0.48], // La Décollation de saint Jean-Baptiste : les prisonniers à la fenêtre
  Q2290433: [0.72, 0.34], // Scènes des massacres de Scio : le cheval cabré
  Q669994: [0.36, 0.90], // L'Île des morts : la barque et la figure blanche
  Q94802: [0.45, 0.61], // L'Enterrement du comte d'Orgaz : les fraises des gentilshommes
  Q2293936: [0.60, 0.90], // Le Petit Bacchus malade : les pêches
  Q334360: [0.60, 0.60], // L'Abbaye dans une forêt de chênes : la fenêtre de l'abbaye en ruine
  Q194137: [0.82, 0.48], // La Mer de glace : l'épave du navire
  Q1368055: [0.25, 0.27], // Des glaneuses : les meules au loin
  Q2339059: [0.12, 0.65], // Pluie, Vapeur et Vitesse : le pont de gauche
  Q794077: [0.84, 0.42], // Amour sacré et Amour profane : le clocher du village
  Q405814: [0.60, 0.12], // La Nef des fous : la cime de l'arbre
  Q1216387: [0.30, 0.68], // La Dentellière : les fils qui débordent du coussin
  Q2304870: [0.15, 0.17], // Les Sept Péchés capitaux et les Quatre Dernières Étapes humaines : le médaillon du lit de mort
  Q867403: [0.88, 0.82], // La Vierge au long cou : la colonne et le prophète
  Q1314013: [0.18, 0.26], // Les Sabines : la forteresse
  Q2213811: [0.55, 0.68], // Le Chariot de foin : les roues du chariot
  Q2317837: [0.12, 0.62], // Le Cauchemar : la table et ses fioles
  Q257580: [0.85, 0.84], // Le Dernier Voyage du Téméraire : la bouée au crépuscule
  Q3808227: [0.90, 0.12], // Jeunes Filles au piano : le bouquet sur le piano
  Q930535: [0.68, 0.74], // Femmes de Tahiti : les mains qui tressent
  Q951105: [0.50, 0.38], // Le Repas chez Levi : la tour derrière les arcades
  Q1114571: [0.75, 0.88], // Les Parapluies : le cerceau
  Q1452762: [0.12, 0.50], // Rue de Paris, temps de pluie : la voiture à cheval
  Q2480921: [0.40, 0.88], // La Vierge au chanoine Van der Paele : le tapis
  Q3080509: [0.75, 0.85], // La Baigneuse Valpinçon : la dentelle du drap
  Q531329: [0.48, 0.47], // Le Pèlerinage à l'île de Cythère : les angelots dans le ciel
  Q107486133: [0.75, 0.25], // L'Ange déchu : les anges qui passent
  Q1090837: [0.88, 0.38], // Une baignade à Asnières : la voile sur la Seine
  Q164517: [0.40, 0.55], // La Danse : les deux mains qui se cherchent
  Q2445726: [0.72, 0.50], // The Lady of Shalott : les bougies de la barque
  Q2571560: [0.88, 0.72], // L'Angélus : la brouette
  Q26250: [0.70, 0.92], // Le Fifre : les guêtres
  Q276174: [0.15, 0.62], // Les Roses d'Héliogabale : les pétales
  Q693746: [0.35, 0.90], // Le Moine au bord de la mer : le moine, minuscule sur la grève
  Q1237863: [0.10, 0.12], // Pollice verso : la foule des gradins
  Q1282840: [0.50, 0.88], // Napoléon Ier sur le trône impérial : l'aigle du tapis
  Q13726073: [0.30, 0.45], // Le Chardonneret : la mangeoire
  Q746716: [0.15, 0.60], // Narcisse : la main sur l'eau
  Q1212737: [0.62, 0.85], // Femmes d'Alger dans leur appartement : le narguilé
  Q1217187: [0.50, 0.32], // La Calomnie d'Apelle : la statue dans sa niche
  Q16333797: [0.25, 0.62], // Vertumne : le lys
}

/** Les candidats écartés à l'œil, et pourquoi. */
const ECARTES: Record<string, string> = {
  Q252485: "La Grande Vague de Kanagawa : une estampe, pas un tableau, et la marge du papier autour",
  Q186953: "L'École d'Athènes : la fresque avec le mur, la porte et le soubassement autour",
  Q334138: "L'Origine du monde : trop cru pour un jeu ouvert dès dix ans, et le cadre doré autour",
  Q227494: "Trente-six vues du mont Fuji : une série d'estampes, pas un tableau",
  Q549847: "Le Printemps : un liseré du cadre doré tout autour",
  Q1189907: "Les Nymphéas : une série de quelque deux cent cinquante toiles : la question ne dit pas laquelle",
  Q1200522: "Les Désastres de la guerre : une série de gravures, pas un tableau",
  Q2027662: "Le Bain turc : un tondo posé sur du blanc, et une foule de nus pour un jeu ouvert dès dix ans",
  Q2045726: "La Bataille d'Anghiari : une copie de Rubens : l'original de Léonard est perdu",
  Q2343778: "La Belle Jardinière : l'arc du cadre doré se voit en haut",
  Q557000: "Les Meules : une série de vingt-cinq toiles : la question ne dit pas laquelle",
}

const norme = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Les tableaux de la base : leur titre, les questions qui les citent, et ce qu'elles disent (pour reconnaître le peintre). */
function tableauxDeLaBase(): Map<string, { ids: string[]; textes: string[] }> {
  const out = new Map<string, { ids: string[]; textes: string[] }>()
  for (const q of lireLaBase().questions) {
    if (q.meta.sousTheme !== 'peinture') continue
    const entites = q.meta.entites ?? []
    for (const e of entites) {
      if (e.type !== 'oeuvre') continue
      const t = out.get(e.nom) ?? { ids: [], textes: [] }
      t.ids.push(q.id)
      t.textes.push(norme([q.texte, q.reponses[q.bonne], q.meta.explication ?? '', ...entites.map(x => `${x.nom} ${x.description ?? ''}`)].join(' ')))
      out.set(e.nom, t)
    }
  }
  return out
}

async function choisir() {
  const base = tableauxDeLaBase()
  const wd = new Wikidata(CACHE)
  const titres = [...base.keys()].map(t => `${JSON.stringify(t)}@fr`).join(' ')
  // Sans classe exigée : « Le Cri » ou « Les Tournesols » ne sont pas des
  // « peintures » sur Wikidata (une série, une version), et seules des copies
  // obscures sortaient sous leur nom. Le peintre nommé par la question trie.
  const lignes = await wd.sparql(`SELECT ?item ?l ?img ?peintre ?pl ?mort ?date ?n WHERE {
  VALUES ?l { ${titres} }
  ?item rdfs:label ?l ; wdt:P18 ?img ; wdt:P170 ?peintre ; wikibase:sitelinks ?n .
  ?peintre wdt:P570 ?mort .
  OPTIONAL { ?item wdt:P571 ?date }
  OPTIONAL { ?peintre rdfs:label ?pl FILTER(lang(?pl) = 'fr') }
}`)
  // Un titre a ses homonymes (« Les Tournesols » d'Egon Schiele) : on garde celui
  // dont le peintre est nommé par la question, et, de ceux-là, le plus lié.
  const parTitre = new Map<string, Candidat>()
  let sansPeintre = 0
  for (const l of lignes) {
    const qid = qidDe(l.item)
    const mort = anneeDe(l.mort)
    if (!qid || mort === null || !l.pl) continue
    const b = base.get(l.l)!
    const nomDeFamille = norme(l.pl).split(' ').filter(m => m.length > 2).pop() ?? ''
    if (!b.textes.some(t => t.includes(nomDeFamille))) {
      sansPeintre++
      continue
    }
    const fichier = decodeURIComponent(l.img.slice(l.img.indexOf('FilePath/') + 9)).replace(/ /g, '_')
    const c: Candidat = { qid, titre: l.l, peintre: l.pl, annee: l.date ? anneeDe(l.date) : null, mortDuPeintre: mort, fichier, liens: Number(l.n), questions: [...new Set(b.ids)].sort() }
    const avant = parTitre.get(l.l)
    // Plusieurs peintres (un atelier) ou plusieurs dates : la mort la plus tardive compte.
    if (avant?.qid === qid) avant.mortDuPeintre = Math.max(avant.mortDuPeintre, mort)
    else if (!avant || c.liens > avant.liens) parTitre.set(l.l, c)
  }
  const candidats = [...parTitre.values()]
    .filter(c => c.mortDuPeintre <= MORT_AU_PLUS_TARD && c.liens >= LIENS_MIN && /\.(jpe?g|png)$/i.test(c.fichier))
    .sort((a, b) => b.liens - a.liens || a.qid.localeCompare(b.qid))
  mkdirSync(CACHE, { recursive: true })
  writeFileSync(CANDIDATS, JSON.stringify(candidats, null, 1))
  console.log(`${base.size} tableaux dans la base, ${parTitre.size} trouvés sur Wikidata (${sansPeintre} homonymes d'un autre peintre écartés), ${candidats.length} candidats du domaine public :`)
  for (const c of candidats) console.log(`  ${c.qid.padEnd(10)} ${String(c.liens).padStart(3)}  ${c.titre} — ${c.peintre} (†${c.mortDuPeintre})${ECARTES[c.qid] ? '  [écarté]' : DETAILS[c.qid] ? '' : '  [à voir]'}`)
}

const lireCandidats = (): Candidat[] => JSON.parse(readFileSync(CANDIDATS, 'utf8'))

/** L'adresse d'une miniature : Commons range ses fichiers sous l'empreinte md5 de leur nom. */
export function adresseDeLaMiniature(fichier: string, largeur: number): string {
  const h = createHash('md5').update(fichier).digest('hex')
  const nom = encodeURIComponent(fichier)
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${h[0]}/${h.slice(0, 2)}/${nom}/${largeur}px-${nom}`
}

const imageDuCache = (qid: string) => readdirSync(path.join(CACHE, 'images')).find(f => f.startsWith(`${qid}-`))
const attendre = (ms: number) => new Promise(r => setTimeout(r, ms))

async function telecharger() {
  mkdirSync(path.join(CACHE, 'images'), { recursive: true })
  for (const c of lireCandidats().slice(0, A_REGARDER)) {
    if (ECARTES[c.qid] || imageDuCache(c.qid)) continue
    // Une miniature que personne n'a encore demandée se fabrique, et Wikimedia
    // en rationne la fabrique : la 1920 répond souvent 429 quand la 1280, déjà
    // faite pour les pages de Commons, passe aussitôt. Un 429 fait donc
    // descendre d'une largeur ; refusé aux trois, on attend, de plus en plus.
    for (let tour = 1; tour <= 4 && !imageDuCache(c.qid); tour++) {
      let rationne = false
      for (const largeur of LARGEURS) {
        await attendre(PAUSE)
        const r = await fetch(adresseDeLaMiniature(c.fichier, largeur), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) })
        if (r.ok) {
          const ext = (r.headers.get('content-type') ?? '').includes('png') ? 'png' : 'jpg'
          writeFileSync(path.join(CACHE, 'images', `${c.qid}-${largeur}.${ext}`), Buffer.from(await r.arrayBuffer()))
          console.log(`  ${c.qid} ${largeur} px — ${c.titre}`)
          break
        }
        // Un 400 ou un 404 : l'original est plus étroit que cette largeur, on prend la suivante.
        if (r.status === 429) rationne = true
      }
      if (!imageDuCache(c.qid) && rationne) {
        console.error(`  ${c.qid} : 429 aux trois largeurs, on attend ${30 * tour} s`)
        await attendre(30_000 * tour)
      } else break
    }
    if (!imageDuCache(c.qid)) console.error(`  ${c.qid} : aucune miniature — ${c.titre}`)
  }
}

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'details.js'))('playwright')
}

const dataUrl = (fichier: string) => `data:image/${fichier.endsWith('.png') ? 'png' : 'jpeg'};base64,${readFileSync(fichier).toString('base64')}`

// Dans la page : une vignette quadrillée (un trait tous les dixièmes, chiffré),
// et un cadrage réduit à sa taille, encodé de moins en moins fort jusqu'à son
// poids. Le quadrillage donne à l'œil le centre d'un détail en fractions.
const OUTILS = String.raw`
async function vignette(src, cote, titre) {
  const img = await charger(src)
  const k = cote / Math.max(img.naturalWidth, img.naturalHeight)
  const l = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k)
  const c = toile(l, h + 22), x = c.getContext('2d')
  x.imageSmoothingQuality = 'high'
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height)
  x.drawImage(img, 0, 0, l, h)
  x.font = '13px sans-serif'
  for (let i = 1; i < 10; i++) {
    x.strokeStyle = i === 5 ? 'rgba(255,0,0,.9)' : 'rgba(255,255,0,.7)'
    x.beginPath(); x.moveTo(l * i / 10, 0); x.lineTo(l * i / 10, h); x.moveTo(0, h * i / 10); x.lineTo(l, h * i / 10); x.stroke()
    x.fillStyle = '#ff0'; x.fillText(String(i), l * i / 10 + 2, 13); x.fillText(String(i), 2, h * i / 10 - 2)
  }
  x.fillStyle = '#000'; x.fillText(titre, 4, h + 16)
  return c.toDataURL('image/png')
}
async function cadrage(src, r, largeur, hauteurMax, poidsMax) {
  const img = await charger(src)
  const W = img.naturalWidth, H = img.naturalHeight
  const sx = r[0] * W, sy = r[1] * H, sl = r[2] * W, sh = r[3] * H
  let k = Math.min(largeur / sl, hauteurMax / sh)
  // La qualité seule ne suffit pas à une toile chargée (l'or d'Adele
  // Bloch-Bauer pesait 58 Ko à 0,2) : passé 0,5, l'image rapetisse.
  for (;;) {
    const c = toile(Math.round(sl * k), Math.round(sh * k)), x = c.getContext('2d')
    x.imageSmoothingQuality = 'high'
    x.drawImage(img, sx, sy, sl, sh, 0, 0, c.width, c.height)
    for (let q = 0.8; q >= 0.5; q -= 0.06) {
      const d = c.toDataURL('image/webp', q)
      if ((d.length - d.indexOf(',') - 1) * 0.75 <= poidsMax) return d
    }
    k *= 0.9
  }
}
`

async function avecLaPage<T>(f: (page: any) => Promise<T>): Promise<T> {
  const { chromium } = chargerPlaywright()
  const nav = await chromium.launch({ headless: true })
  try {
    const page = await pagePixels(nav)
    await page.addScriptTag({ content: OUTILS })
    return await f(page)
  } finally {
    await nav.close()
  }
}

/** Des planches de six, à regarder : celles des tableaux qui n'ont encore ni détail ni écart. */
async function planches() {
  const dossier = path.join(CACHE, 'planches')
  rmSync(dossier, { recursive: true, force: true })
  mkdirSync(dossier, { recursive: true })
  const voir = lireCandidats().filter(c => !DETAILS[c.qid] && !ECARTES[c.qid] && imageDuCache(c.qid))
  await avecLaPage(async page => {
    for (const c of voir) {
      const d = await dansLaPage<string>(page, 'vignette', dataUrl(path.join(CACHE, 'images', imageDuCache(c.qid)!)), 600, `${c.qid} ${c.titre} — ${c.peintre}`)
      writeFileSync(path.join(dossier, `${c.qid}.png`), deDataUrl(d))
    }
  })
  console.log(`${voir.length} vignettes dans ${dossier}`)
}

/**
 * Les quatre cadrages, emboîtés : chacun interpole linéairement le détail et
 * le tableau entier — un rectangle compris entre deux rectangles emboîtés
 * contient le premier et tient dans le second.
 */
export function cadragesDe(centre: readonly [number, number]): [number, number, number, number][] {
  const d = ECHELLES[0]
  const x0 = Math.min(1 - d, Math.max(0, centre[0] - d / 2))
  const y0 = Math.min(1 - d, Math.max(0, centre[1] - d / 2))
  const arrondi = (v: number) => Math.round(v * 10_000) / 10_000
  return ECHELLES.map(s => {
    const t = (s - d) / (1 - d)
    return [arrondi(x0 * (1 - t)), arrondi(y0 * (1 - t)), arrondi(s), arrondi(s)]
  })
}

async function decouper() {
  const candidats = lireCandidats().filter(c => DETAILS[c.qid] && !ECARTES[c.qid])
  const fiche: TableauDuDetail[] = []
  mkdirSync(DOSSIER_DES_DETAILS, { recursive: true })
  const voulus = new Set<string>()
  await avecLaPage(async page => {
    for (const c of candidats) {
      const image = imageDuCache(c.qid)
      if (!image) throw new Error(`${c.qid} : pas de miniature dans le cache, lance telecharger`)
      const src = dataUrl(path.join(CACHE, 'images', image))
      const cadrages = cadragesDe(DETAILS[c.qid])
      for (const [i, r] of cadrages.entries()) {
        const nom = `${c.qid}-${i + 1}.webp`
        writeFileSync(path.join(DOSSIER_DES_DETAILS, nom), deDataUrl(await dansLaPage<string>(page, 'cadrage', src, r, LARGEUR, HAUTEUR_MAX, POIDS_MAX)))
        voulus.add(nom)
      }
      fiche.push({
        qid: c.qid,
        titre: c.titre,
        peintre: c.peintre,
        annee: c.annee,
        mortDuPeintre: c.mortDuPeintre,
        fichier: c.fichier,
        page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(c.fichier)}`,
        statut: 'domaine public',
        cadrages,
        questions: c.questions,
      })
    }
  })
  for (const f of readdirSync(DOSSIER_DES_DETAILS)) if (f.endsWith('.webp') && !voulus.has(f)) rmSync(path.join(DOSSIER_DES_DETAILS, f))
  fiche.sort((a, b) => a.qid.localeCompare(b.qid))
  // Un tableau par ligne : une diff dit lequel a changé.
  writeFileSync(FICHE_DES_DETAILS, `[\n${fiche.map(t => '  ' + JSON.stringify(t)).join(',\n')}\n]\n`)
  console.log(`${fiche.length} tableaux, ${voulus.size} images dans ${DOSSIER_DES_DETAILS}`)
  verifier()
}

/** Ce que la fiche doit être : `details.test.ts` le garde, ceci le dit plus court après un découpage. */
export function refusDeLaFiche(fiche: readonly TableauDuDetail[], images: readonly string[], poids: (nom: string) => number): string[] {
  const refus: string[] = []
  const vus = new Set<string>()
  for (const t of fiche) {
    if (vus.has(t.qid)) refus.push(`${t.qid} : deux fois dans la fiche`)
    vus.add(t.qid)
    if (t.mortDuPeintre > MORT_AU_PLUS_TARD) refus.push(`${t.qid} : peintre mort en ${t.mortDuPeintre}, pas encore du domaine public`)
    if (t.cadrages.length !== 4) refus.push(`${t.qid} : ${t.cadrages.length} cadrages`)
    for (const [i, [x, y, l, h]] of t.cadrages.entries()) {
      if (x < 0 || y < 0 || l <= 0 || h <= 0 || x + l > 1.00001 || y + h > 1.00001) refus.push(`${t.qid} : cadrage ${i + 1} hors du tableau`)
      const avant = t.cadrages[i - 1]
      if (avant && !(x <= avant[0] && y <= avant[1] && x + l >= avant[0] + avant[2] - 1e-6 && y + h >= avant[1] + avant[3] - 1e-6 && l > avant[2]))
        refus.push(`${t.qid} : cadrage ${i + 1} n'emboîte pas le ${i}`)
    }
    const dernier = t.cadrages[3]
    if (dernier && dernier.join() !== '0,0,1,1') refus.push(`${t.qid} : le dernier cadrage n'est pas le tableau entier`)
    if (!t.questions.length) refus.push(`${t.qid} : aucune question de la base ne le demande`)
    for (let i = 1; i <= 4; i++) {
      const nom = `${t.qid}-${i}.webp`
      if (!images.includes(nom)) refus.push(`${nom} manque`)
      else if (poids(nom) > POIDS_MAX) refus.push(`${nom} pèse ${Math.round(poids(nom) / 1024)} Ko`)
    }
  }
  for (const nom of images) if (!vus.has(nom.replace(/-\d\.webp$/, ''))) refus.push(`${nom} : aucune fiche`)
  return refus
}

function verifier() {
  const fiche: TableauDuDetail[] = JSON.parse(readFileSync(FICHE_DES_DETAILS, 'utf8'))
  const images = readdirSync(DOSSIER_DES_DETAILS).filter(f => f.endsWith('.webp'))
  const poids = (nom: string) => readFileSync(path.join(DOSSIER_DES_DETAILS, nom)).length
  const refus = refusDeLaFiche(fiche, images, poids)
  const total = images.reduce((s, n) => s + poids(n), 0)
  console.log(`${fiche.length} tableaux, ${images.length} images, ${(total / 1024 / 1024).toFixed(1)} Mo${refus.length ? '' : ' — rien à redire'}`)
  for (const r of refus) console.error(`  ${r}`)
  if (refus.length) process.exitCode = 1
}

const COMMANDES: Record<string, () => unknown> = { choisir, telecharger, planches, decouper, verifier }
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const commande = COMMANDES[process.argv[2] ?? '']
  if (commande) await commande()
  else {
    console.error(`Usage : npx tsx scripts/details.ts <${Object.keys(COMMANDES).join('|')}>`)
    process.exitCode = 1
  }
}
