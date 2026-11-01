// La base de la campagne, de son écriture à son rangement
// (`server/src/core/baseCampagne.ts`).
//
//   npx tsx scripts/base-campagne.ts consigne <Catégorie> <sous-thème>:<n> …   la consigne d'un lot, pour une IA (--nombres : des questions à nombre)
//   npx tsx scripts/base-campagne.ts verifier [--nombres] <lot.json> …          ce que le rangement refuserait, et pourquoi (--nombres : ce qui ne se jouerait pas au plus près)
//   npx tsx scripts/base-campagne.ts ranger <lot.json> …                        range des lots vérifiés dans la base
//   npx tsx scripts/base-campagne.ts stats                                      la base, par catégorie, sous-thème et difficulté
//   npx tsx scripts/base-campagne.ts voisines [<lot.json> …]                    les questions qui posent sans doute le même fait, et les intitulés presque pareils
//   npx tsx scripts/base-campagne.ts racines                                    les questions dont l'intitulé souffle la bonne réponse par sa racine, à relire
//   npx tsx scripts/base-campagne.ts fiche <lot.json> …                         la fiche de relecture : l'essentiel de chaque question, une ligne ou trois
//   npx tsx scripts/base-campagne.ts appliquer <decisions.json>                 ce que la relecture a décidé : retirer, corriger une phrase ou une difficulté
//   npx tsx scripts/base-campagne.ts retirer <id> …                              retire des questions de la base, par identifiant
//   npx tsx scripts/base-campagne.ts reclasser <reclassements.json>             change la catégorie, le sous-thème ou les étiquettes de questions de la base, sous leur identifiant
//   npx tsx scripts/base-campagne.ts inventaire <thème>                          l'inventaire d'un thème, famille par famille, à relire (core/inventaires.ts)
//   npx tsx scripts/base-campagne.ts couverture <thème> [<lot.json> …]           les sujets de son inventaire qu'aucune question n'aborde encore, ou une seule
//
// Un lot est un tableau JSON d'entrées sans identifiant, écrit par une IA
// selon la consigne — à la main, ou par milliers par `generer-campagne.ts`.
// Le rangement tire l'identifiant de chacune, écarte ce que la base, les
// quiz livrés ou le lot lui-même ont déjà — le même intitulé, ou le même
// fait sous un autre (`core/memeFait.ts`) —, et réécrit les fichiers de la
// base, une question par ligne : une relecture de PR s'y fait question par
// question.

import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { DOSSIER_DE_LA_BASE, entreeDeLaBase, fichierDeCategorie, lireLaBase, lireQuestionDeLaBase, souffleeParSaRacine, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { REPONSE_CONSEILLEE, TEXTE_CONSEILLE, consigneDEcriture, empreintesDesLivres } from '../src/core/consigneCampagne'
import { lireLEstimation } from '../src/core/estimation'
import { rangsPossibles } from '../src/core/rangDeLaBonne'
import { IndexDesFaits, presquePareils, traitsDe, type TraitsDUnIntitule } from '../src/core/memeFait'
import { couverture, inventairesDuTheme, lireLeSujet, repartirLesFamilles } from '../src/core/inventaires'
import { CATEGORIES } from '../../shared/categories'
import { AGES, SOUS_THEMES } from '../../shared/etiquettes'
import { sansAccent } from '../../shared/homonymes'
import { SUJETS, sujetParCle, sujetsDe } from '../../shared/sujets'
import { DOSSIER_DES_LOTS, FICHIER_DE_LOT, TriDesEntrees, appliquerLesDecisions, ecrireLot, ficheDUneEntree, lireLot, type Decision } from './lots-campagne'

/** Une ligne du fichier : la forme de `entreeDeLaBase`, celle des dépôts de la routine aussi. */
const enLigne = (q: QuestionDeLaBase) => JSON.stringify(entreeDeLaBase(q))

/** `nombres` : une part à nombre (`consigne --nombres`) — chaque question qui ne se jouerait pas au plus près s'avertit. */
function verifier(fichiers: string[], { nombres = false } = {}): number {
  // Toute la base, toutes catégories, puis ce que les lots vérifiés ensemble ont déjà.
  const tri = new TriDesEntrees(lireLaBase().questions, empreintesDesLivres())
  let refus = 0
  let avertissements = 0
  const parSousTheme = new Map<string, number>()
  const parDifficulte = new Map<number, number>()
  let total = 0
  for (const fichier of fichiers) {
    let entrees: unknown[]
    try {
      entrees = lireLot(fichier)
    } catch (e) {
      console.log(`✗ ${fichier} : ${(e as Error).message}`)
      refus++
      continue
    }
    entrees.forEach((brut, i) => {
      const ou = `${path.basename(fichier)} #${i}`
      const texte = String((brut as { texte?: unknown })?.texte ?? '').slice(0, 90)
      const jugee = tri.juger(brut, ou)
      if ('refus' in jugee) {
        refus++
        return console.log(`✗ REFUS ${ou} « ${texte} » — ${jugee.refus}`)
      }
      const q = jugee.question
      total++
      parSousTheme.set(q.meta.sousTheme, (parSousTheme.get(q.meta.sousTheme) ?? 0) + 1)
      parDifficulte.set(q.meta.difficulte, (parDifficulte.get(q.meta.difficulte) ?? 0) + 1)
      const avertir = (motif: string) => {
        avertissements++
        console.log(`! AVERTISSEMENT ${ou} « ${texte} » — ${motif}`)
      }
      if (q.reponses.length === 4 && q.meta.leurres.length < 6) avertir(`${q.meta.leurres.length} leurres : six à huit attendus`)
      if (Array.from(q.texte).length > TEXTE_CONSEILLE) avertir(`intitulé de ${Array.from(q.texte).length} caractères : ${TEXTE_CONSEILLE} au plus de préférence`)
      const longue = q.reponses.find(r => Array.from(r).length > REPONSE_CONSEILLEE)
      if (longue) avertir(`réponse longue (${longue}) : ${REPONSE_CONSEILLEE} caractères au plus de préférence`)
      if (!q.anecdote) avertir('pas d’anecdote')
      if (!q.meta.explication) avertir('pas d’explication')
      if (!q.meta.source) avertir('pas de source')
      // Pas un refus : une étymologie est souvent voulue. Mais « Les Deux Fridas » souffle Frida Kahlo, et une
      // question soufflée ne vient qu'en dernier recours au quiz tout prêt.
      const racines = souffleeParSaRacine(q)
      if (racines.length > 0) avertir(`la bonne réponse se lit dans l’intitulé par sa racine (${racines.join(', ')}) : reformule, ou garde-la si c’est voulu`)
      // Une année, un nombre, un jour : le jeu tire la place de la bonne parmi ses leurres (`reponsesAuRangTire`) — s'ils ne
      // l'entourent pas, elle ne peut pas être la plus petite, ou la plus grande, et sa place la trahit encore.
      const rangs = rangsPossibles(q)
      if (rangs && rangs.length < 4) {
        const place =
          rangs.length === 1 && (rangs[0] === 0 || rangs[0] === 3)
            ? `sera toujours la plus ${rangs[0] === 0 ? 'petite' : 'grande'}`
            : `ne sera jamais ${!rangs.includes(0) && !rangs.includes(3) ? 'la plus petite ni la plus grande' : !rangs.includes(0) ? 'la plus petite' : 'la plus grande'}`
        avertir(`ses leurres n’entourent pas la bonne réponse : elle ${place} des quatre — trois leurres plus petits et trois plus grands, quand la grandeur le permet`)
      }
      if (nombres) {
        const estimation = lireLEstimation(q)
        if ('refus' in estimation) avertir(`ne se jouera pas au plus près : ${estimation.refus}`)
      }
    })
  }
  console.log(`\n${total} question(s) acceptée(s), ${refus} refus, ${avertissements} avertissement(s).`)
  console.log(`Par sous-thème : ${[...parSousTheme].map(([k, n]) => `${k} ${n}`).join(' · ')}`)
  console.log(`Par difficulté : ${[1, 2, 3, 4, 5].map(d => `${d}: ${parDifficulte.get(d) ?? 0}`).join(' · ')}`)
  return refus
}

function nouvelId(pris: Set<string>): string {
  for (;;) {
    const id = Array.from(randomBytes(8), o => 'abcdefghijklmnopqrstuvwxyz0123456789'[o % 36]).join('')
    if (!pris.has(id)) {
      pris.add(id)
      return id
    }
  }
}

function ranger(fichiers: string[]) {
  const { questions: base, refusees } = lireLaBase()
  if (refusees.length > 0) throw new Error(`La base a ${refusees.length} entrée(s) défectueuse(s) : corrige-les avant de ranger.`)
  const ids = new Set(base.map(q => q.id))
  const tri = new TriDesEntrees(base, empreintesDesLivres())
  const parCategorie = new Map<string, QuestionDeLaBase[]>(CATEGORIES.map(c => [c, base.filter(q => q.meta.categorie === c)]))
  let rangees = 0
  const ecartees: string[] = []
  for (const fichier of fichiers) {
    lireLot(fichier).forEach((brut, i) => {
      const ou = `${path.basename(fichier)} #${i}`
      const jugee = tri.juger(brut, ou)
      if ('refus' in jugee) return ecartees.push(`${ou} « ${String((brut as { texte?: unknown })?.texte ?? '').slice(0, 90)} » — ${jugee.refus}`)
      const q = jugee.question
      parCategorie.get(q.meta.categorie)!.push({ ...q, id: nouvelId(ids) })
      rangees++
    })
  }
  ecrireLaBase(parCategorie)
  for (const e of ecartees) console.log(`écartée : ${e}`)
  console.log(`${rangees} question(s) rangée(s), ${ecartees.length} écartée(s). La base en compte ${base.length + rangees}.`)
}

/** Réécrit les fichiers de la base, une question par ligne — la forme exacte que `ranger` a toujours écrite. */
function ecrireLaBase(parCategorie: ReadonlyMap<string, readonly QuestionDeLaBase[]>) {
  mkdirSync(DOSSIER_DE_LA_BASE, { recursive: true })
  for (const [categorie, questions] of parCategorie) {
    const fichier = path.join(DOSSIER_DE_LA_BASE, fichierDeCategorie(categorie))
    if (questions.length === 0 && !existsSync(fichier)) continue
    writeFileSync(fichier, `[\n${questions.map(enLigne).join(',\n')}\n]\n`)
  }
}

/**
 * Retire des questions de la base, par identifiant : un doublon que
 * `voisines` a montré, une question dont la bonne réponse change (elle se
 * range ensuite, neuve, sous un identifiant neuf). Ses réponses passées
 * gardent leur série, qui a recopié la question : rien ne se perd des
 * mesures ni des écussons.
 */
function retirer(ids: string[]) {
  const { questions: base, refusees } = lireLaBase()
  if (refusees.length > 0) throw new Error(`La base a ${refusees.length} entrée(s) défectueuse(s) : corrige-les avant de retirer.`)
  const inconnus = ids.filter(id => !base.some(q => q.id === id))
  if (inconnus.length > 0) throw new Error(`identifiant(s) absent(s) de la base : ${inconnus.join(', ')}`)
  const sortir = new Set(ids)
  ecrireLaBase(new Map(CATEGORIES.map(c => [c, base.filter(q => q.meta.categorie === c && !sortir.has(q.id))])))
  console.log(`${sortir.size} question(s) retirée(s). La base en compte ${base.length - sortir.size}.`)
}

/**
 * Ce qu'un humain relit d'un coup d'œil : les paires que `verifier` et
 * `ranger` refuseraient (le même fait, `IndexDesFaits`) — dans la base, celles
 * qu'on y a gardées ; sur des lots, entre eux et avec la base —, puis deux
 * intitulés presque pareils dans un sous-thème, de réponses différentes, que
 * nulle règle ne refuse : « le plus long fleuve de France » et « … d'Europe ».
 */
function voisines(fichiers: string[]) {
  const base = lireLaBase().questions
  const ou = new Map<QuestionDeLaBase, string>(base.map(q => [q, q.id]))
  const lots: QuestionDeLaBase[] = []
  for (const f of fichiers) {
    lireLot(f).forEach((brut, i) => {
      const lu = lireQuestionDeLaBase(brut, { sansId: true })
      if ('refus' in lu) return
      ou.set(lu.question, `${path.basename(f)} #${i}`)
      lots.push(lu.question)
    })
  }
  const nouvelles = new Set(lots)
  const dire = (q: QuestionDeLaBase) => `${ou.get(q)} [${q.meta.categorie}] « ${q.texte} » → ${q.reponses[q.bonne]}`
  // Sans lot, toute la base ; avec, chaque paire qui touche un lot.
  const vise = ([a, b]: [QuestionDeLaBase, QuestionDeLaBase]) => nouvelles.size === 0 || nouvelles.has(a) || nouvelles.has(b)
  let memes = 0
  for (const paire of new IndexDesFaits([...base, ...lots]).paires()) {
    if (!vise(paire)) continue
    memes++
    console.log(`${dire(paire[0])}\n${dire(paire[1])}\n`)
  }
  const parSousTheme = new Map<string, { q: QuestionDeLaBase; traits: TraitsDUnIntitule }[]>()
  for (const q of [...base, ...lots]) {
    const cle = `${q.meta.categorie}/${q.meta.sousTheme}`
    const groupe = parSousTheme.get(cle) ?? parSousTheme.set(cle, []).get(cle)!
    groupe.push({ q, traits: traitsDe(q.texte) })
  }
  let pareils = 0
  for (const groupe of parSousTheme.values()) {
    for (let i = 0; i < groupe.length; i++) {
      for (let j = i + 1; j < groupe.length; j++) {
        const [a, b] = [groupe[i], groupe[j]]
        if (sansAccent(a.q.reponses[a.q.bonne]) === sansAccent(b.q.reponses[b.q.bonne]) || !vise([a.q, b.q])) continue
        if (!presquePareils(a.traits, b.traits)) continue
        pareils++
        console.log(`${dire(a.q)}\n${dire(b.q)}\n`)
      }
    }
  }
  console.log(`${memes} paire(s) sur le même fait, ${pareils} paire(s) d'intitulés presque pareils, sur ${base.length + lots.length} questions.`)
}

/**
 * La fiche de relecture d'un lot : ce qu'un correcteur doit juger — l'intitulé,
 * la bonne réponse, les autres, l'anecdote, l'explication, la difficulté —
 * sans les métadonnées qui ne se vérifient pas d'un coup d'œil. Trois à
 * quatre fois moins à lire que le lot lui-même : la relecture de toute la
 * base tient alors dans le budget d'une session.
 */
function fiche(fichiers: string[]) {
  for (const f of fichiers) lireLot(f).forEach((brut, i) => console.log(ficheDUneEntree(`${path.basename(f)}#${i}`, brut)))
}

/**
 * Applique les décisions d'une relecture à ses lots : `[{ "ref": "A1-01.json#4",
 * "action": "retirer" | "corriger", "champs": { "anecdote"?, "explication"?,
 * "difficulte"?, "texte"? }, "motif" }]`. Une correction ne touche jamais aux
 * réponses : une réponse douteuse retire la question, dans le doute. Une
 * correction que la vérification refuse retire la question aussi. Les
 * références se lisent dans le dossier du fichier de décisions.
 */
function appliquer(fichier: string) {
  const dossier = path.dirname(fichier)
  const decisions = JSON.parse(readFileSync(fichier, 'utf8')) as Decision[]
  const lots = new Map<string, unknown[]>()
  for (const d of decisions) {
    const nom = d.ref.split('#')[0]
    if (!lots.has(nom)) lots.set(nom, lireLot(path.join(dossier, nom)))
  }
  const fait = appliquerLesDecisions(decisions, lots)
  for (const [nom, entrees] of fait.lots) ecrireLot(path.join(dossier, nom), entrees)
  for (const d of fait.ignorees) console.log(`ignorée : ${d.ref} — aucun champ corrigeable (${Object.keys(d.champs ?? {}).join(', ') || 'aucun'})`)
  console.log(`${fait.corrigees} question(s) corrigée(s), ${fait.retirees} retirée(s)${fait.ignorees.length > 0 ? `, ${fait.ignorees.length} correction(s) ignorée(s)` : ''}.`)
}

/**
 * Les questions de la base dont l'intitulé souffle la bonne réponse par sa
 * racine (`souffleeParSaRacine`), à relire : reformuler, monter la
 * difficulté — ou garder une étymologie voulue. Le quiz tout prêt ne les
 * prend qu'en dernier recours ; la campagne les pose comme les autres.
 */
function racines() {
  const soufflees = lireLaBase().questions.filter(q => q.soufflee)
  for (const q of soufflees) {
    console.log(`${q.id} [${q.meta.categorie} · ${q.meta.difficulte}] ${q.texte} → ${q.reponses[q.bonne]} (${souffleeParSaRacine(q).join(', ')})`)
  }
  console.log(`\n${soufflees.length} question(s) à relire.`)
}

/** Un reclassement : la question, par son identifiant, et ce qui change — l'étiquette à poser s'ajoute à celles qu'elle a (`ajouter`). */
interface Reclassement {
  id: string
  categorie?: string
  sousTheme?: string
  etiquettes?: string[]
  ajouter?: string[]
}

/**
 * Reclasse des questions de la base sous leur identifiant : leur catégorie,
 * leur sous-thème, leurs étiquettes. Ce que « Reclasser » fait au QG dans
 * Turso (`CampagneStore.reclasser`), ici dans les fichiers du dépôt :
 * l'identifiant ne bouge pas, ses réponses et ses mesures la suivent. Les
 * sous-thèmes neufs de la danse et de la santé (le 15 octobre 2026) ont
 * repris ainsi les questions que la base avait déjà sur eux. Chaque
 * question reclassée repasse par le juge de la base — trois étiquettes au
 * plus, un sous-thème de sa catégorie — : un seul refus, et rien ne s'écrit.
 */
function reclasser(fichier: string) {
  const { questions: base, refusees } = lireLaBase()
  if (refusees.length > 0) throw new Error(`La base a ${refusees.length} entrée(s) défectueuse(s) : corrige-les avant de reclasser.`)
  const demandes = JSON.parse(readFileSync(fichier, 'utf8')) as Reclassement[]
  const parId = new Map(base.map(q => [q.id, q]))
  const reclassees = new Map<string, QuestionDeLaBase>()
  const refus: string[] = []
  for (const d of demandes) {
    const q = reclassees.get(d.id) ?? parId.get(d.id)
    if (!q) {
      refus.push(`${d.id} : absente de la base`)
      continue
    }
    const entree = entreeDeLaBase(q)
    if (d.categorie !== undefined) entree.categorie = d.categorie
    if (d.sousTheme !== undefined) entree.sousTheme = d.sousTheme
    if (d.etiquettes !== undefined) entree.etiquettes = d.etiquettes
    if (d.ajouter !== undefined) entree.etiquettes = [...new Set([...(entree.etiquettes as string[]), ...d.ajouter])]
    const lu = lireQuestionDeLaBase(entree)
    if ('refus' in lu) refus.push(`${d.id} « ${q.texte.slice(0, 80)} » — ${lu.refus}`)
    else reclassees.set(d.id, lu.question)
  }
  if (refus.length > 0) {
    for (const r of refus) console.log(`✗ ${r}`)
    throw new Error(`${refus.length} reclassement(s) refusé(s) : rien n'est écrit.`)
  }
  const apres = base.map(q => reclassees.get(q.id) ?? q)
  ecrireLaBase(new Map(CATEGORIES.map(c => [c, apres.filter(q => q.meta.categorie === c)])))
  console.log(`${reclassees.size} question(s) reclassée(s), sous leur identifiant. La base en compte ${base.length}.`)
}

/** Le thème d'une commande, s'il a un inventaire ; sinon, l'erreur dit lesquels en ont un. */
function themeAInventaire(cle: string | undefined) {
  const theme = sujetParCle(cle)
  if (theme && inventairesDuTheme(theme).length > 0) return theme
  throw new Error(`un thème qui a un inventaire : ${SUJETS.filter(s => inventairesDuTheme(s).length > 0).map(s => s.cle).join(', ')}`)
}

/**
 * L'inventaire d'un thème en clair, à relire avant une génération : chaque
 * sous-thème, son périmètre, sa prudence, puis chaque famille, ce qu'une
 * commande de six cents questions lui donnerait (`repartirLesFamilles`), et
 * ses sujets.
 */
function inventaireEnClair(cle: string | undefined, total = 600) {
  const theme = themeAInventaire(cle)
  const inventaires = inventairesDuTheme(theme)
  const parts = repartirLesFamilles(inventaires, total)
  const lignes = [`# ${theme.nom} — l'inventaire`, '', `Sur ${total} questions à écrire, ce que chaque famille en recevrait.`]
  for (const inventaire of inventaires) {
    const nom = SOUS_THEMES[inventaire.categorie].find(s => s.cle === inventaire.sousTheme)?.nom
    const siennes = parts.filter(p => p.inventaire === inventaire)
    lignes.push('', `## ${inventaire.categorie} › ${nom} — ${siennes.reduce((s, p) => s + p.n, 0)} questions`, '', inventaire.perimetre)
    if (inventaire.prudence) lignes.push('', `*Prudence : ${inventaire.prudence}*`)
    for (const { famille, n } of siennes) lignes.push('', `### ${famille.nom} — ${n} questions`, '', famille.sujets.map(s => lireLeSujet(s).nom).join(' · '))
  }
  process.stdout.write(`${lignes.join('\n')}\n`)
}

/**
 * Ce que l'inventaire d'un thème a déjà (`couverture`) : pour chaque famille,
 * les sujets qu'aucune de ses questions n'aborde, puis ceux qui n'en ont
 * qu'une — la base, et les lots nommés, pas encore rangés.
 */
function couvertureDuTheme(cle: string | undefined, fichiers: string[]) {
  const theme = themeAInventaire(cle)
  const lots = fichiers.flatMap(f => lireLot(f).flatMap(brut => {
    const lu = lireQuestionDeLaBase(brut, { sansId: true })
    return 'question' in lu ? [lu.question] : []
  }))
  const duTheme = (q: QuestionDeLaBase) => sujetsDe(q.meta).includes(theme.cle)
  const siennes = [...lireLaBase().questions, ...lots].filter(duTheme)
  // Les lots d'une génération mêlent souvent deux thèmes : on ne compte que les siennes.
  const desLots = lots.filter(duTheme).length
  console.log(`${theme.nom} : ${siennes.length} questions${desLots > 0 ? `, dont ${desLots} des lots` : ''}.`)
  for (const inventaire of inventairesDuTheme(theme)) {
    const deLui = siennes.filter(q => q.meta.categorie === inventaire.categorie && q.meta.sousTheme === inventaire.sousTheme).length
    console.log(`\n${inventaire.categorie} › ${inventaire.sousTheme} : ${deLui} questions`)
    for (const { famille, sujets } of couverture(inventaire, siennes)) {
      const aucune = sujets.filter(s => s.questions === 0).map(s => s.nom)
      const une = sujets.filter(s => s.questions === 1).map(s => s.nom)
      console.log(`  ${famille} — ${sujets.length - aucune.length}/${sujets.length} sujets abordés`)
      if (aucune.length > 0) console.log(`    sans question : ${aucune.join(' · ')}`)
      if (une.length > 0) console.log(`    une seule : ${une.join(' · ')}`)
    }
  }
}

function stats() {
  const { questions, refusees } = lireLaBase()
  console.log(`${questions.length} questions${refusees.length ? `, ${refusees.length} entrée(s) défectueuse(s)` : ''}\n`)
  for (const c of CATEGORIES) {
    const qs = questions.filter(q => q.meta.categorie === c)
    if (qs.length === 0) continue
    const parSt = SOUS_THEMES[c].map(s => `${s.cle} ${qs.filter(q => q.meta.sousTheme === s.cle).length}`).join(' · ')
    const parD = [1, 2, 3, 4, 5].map(d => qs.filter(q => q.meta.difficulte === d).length).join('/')
    console.log(`${c} : ${qs.length} — difficulté 1 à 5 : ${parD}\n  ${parSt}`)
  }
  const parAge = AGES.map(a => `${a} ans : ${questions.filter(q => q.meta.ageMin === a).length}`).join(' · ')
  console.log(`\nÂge minimum : ${parAge}`)
}

const [commande, ...args] = process.argv.slice(2)
if (commande === 'verifier') {
  const fichiers = args.filter(a => a !== '--nombres')
  if (fichiers.length === 0) throw new Error('verifier [--nombres] <lot.json> …')
  process.exitCode = verifier(fichiers, { nombres: args.includes('--nombres') }) > 0 ? 1 : 0
} else if (commande === 'ranger') {
  if (args.length === 0) throw new Error('ranger <lot.json> …')
  ranger(args)
} else if (commande === 'stats') {
  stats()
} else if (commande === 'voisines') {
  voisines(args)
} else if (commande === 'fiche') {
  fiche(args)
} else if (commande === 'appliquer') {
  if (args.length !== 1) throw new Error('appliquer <decisions.json>')
  appliquer(args[0])
} else if (commande === 'consigne') {
  const [categorie, ...parts] = args
  const c = CATEGORIES.find(x => sansAccent(x) === sansAccent(categorie ?? ''))
  if (!c || parts.length === 0) throw new Error('consigne <Catégorie> <sous-thème>:<n> … [--lot=nom] [--dossier=chemin] [--nombres]')
  const lot = parts.find(p => p.startsWith('--lot='))?.slice(6) ?? 'lot'
  const dossier = parts.find(p => p.startsWith('--dossier='))?.slice(10) ?? DOSSIER_DES_LOTS
  const quotas = parts
    .filter(p => !p.startsWith('--'))
    .map(p => {
      const [cle, n] = p.split(':')
      if (!SOUS_THEMES[c].some(s => s.cle === cle)) throw new Error(`sous-thème inconnu dans ${c} : ${cle}`)
      return { cle, n: Number(n) }
    })
  // Ce que ses sous-thèmes ont déjà : la base, et les lots du dossier pas
  // encore rangés. Pas toute la catégorie — quatre cents intitulés, dix mille
  // jetons par consigne — : un fait déjà posé ailleurs, `verifier` le refuse.
  const vises = new Set(quotas.map(q => q.cle))
  const deja = [
    ...lireLaBase().questions.filter(q => q.meta.categorie === c && vises.has(q.meta.sousTheme)).map(q => q.texte),
    ...(existsSync(dossier) ? readdirSync(dossier) : [])
      .filter(f => FICHIER_DE_LOT.test(f))
      .flatMap(f => lireLot(path.join(dossier, f)) as { texte?: string; categorie?: string; sousTheme?: string }[])
      .filter(e => e.categorie === c && vises.has(e.sousTheme ?? '') && typeof e.texte === 'string')
      .map(e => e.texte!),
  ]
  // `--nombres` : des questions à nombre, qui se joueront aussi en estimation au quiz tout prêt.
  process.stdout.write(consigneDEcriture(c, quotas, { sorte: 'lots', lot, dossier }, deja, { nombres: parts.includes('--nombres') }))
} else if (commande === 'retirer') {
  if (args.length === 0) throw new Error('retirer <id> …')
  retirer(args)
} else if (commande === 'racines') {
  racines()
} else if (commande === 'reclasser') {
  if (args.length !== 1) throw new Error('reclasser <reclassements.json>')
  reclasser(args[0])
} else if (commande === 'inventaire') {
  inventaireEnClair(args[0])
} else if (commande === 'couverture') {
  couvertureDuTheme(args[0], args.slice(1))
} else {
  console.log('base-campagne.ts consigne | verifier | ranger | stats | voisines | racines | fiche | appliquer | retirer | reclasser | inventaire | couverture')
}
