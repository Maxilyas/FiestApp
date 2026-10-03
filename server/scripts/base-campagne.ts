// La base de la campagne, de son écriture à son rangement
// (`server/src/core/baseCampagne.ts`).
//
//   npx tsx scripts/base-campagne.ts consigne <Catégorie> <sous-thème>:<n> …   la consigne d'un lot, pour une IA
//   npx tsx scripts/base-campagne.ts verifier <lot.json> …                      ce que le rangement refuserait, et pourquoi
//   npx tsx scripts/base-campagne.ts ranger <lot.json> …                        range des lots vérifiés dans la base
//   npx tsx scripts/base-campagne.ts stats                                      la base, par catégorie, sous-thème et difficulté
//   npx tsx scripts/base-campagne.ts voisines [<lot.json> …]                    les questions qui posent sans doute le même fait
//
// Un lot est un tableau JSON d'entrées sans identifiant, écrit par une IA
// selon la consigne. Le rangement tire l'identifiant de chacune, écarte ce
// que la base, les quiz livrés ou le lot lui-même ont déjà, et réécrit les
// fichiers de la base, une question par ligne : une relecture de PR s'y
// fait question par question.

import { randomBytes } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { SERVEUR } from '../src/racine'
import { DOSSIER_DE_LA_BASE, ETIQUETTES_ECARTEES, MAX_REPONSE, fichierDeCategorie, lireLaBase, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { empreinteDe } from '../src/core/jour'
import { CATEGORIES } from '../../shared/categories'
import { AGES, ETIQUETTES, SOUS_THEMES } from '../../shared/etiquettes'
import { sansAccent } from '../../shared/homonymes'

/** Au-delà, l'intitulé se lit mal sur un téléphone : un avertissement, pas un refus. */
const TEXTE_CONSEILLE = 160
const REPONSE_CONSEILLEE = 45

/** Les intitulés des quiz livrés : la base ne les reprend pas, le quiz du jour s'en est amorcé. */
function empreintesDesLivres(): Set<string> {
  const dossier = path.join(SERVEUR, 'content/quiz')
  const vues = new Set<string>()
  for (const f of readdirSync(dossier).filter(f => f.endsWith('.json'))) {
    const quiz = JSON.parse(readFileSync(path.join(dossier, f), 'utf8')) as { questions?: { text?: string }[] }
    for (const q of quiz.questions ?? []) if (q.text) vues.add(empreinteDe(q.text))
  }
  return vues
}

function lireLot(fichier: string): unknown[] {
  const brut = JSON.parse(readFileSync(fichier, 'utf8')) as unknown
  if (!Array.isArray(brut)) throw new Error(`${fichier} : un tableau JSON est attendu`)
  return brut
}

/** L'ordre des champs dans le fichier : la question d'abord, ses métadonnées ensuite. */
function enLigne(q: QuestionDeLaBase): string {
  const m = q.meta
  return JSON.stringify({
    id: q.id,
    texte: q.texte,
    reponses: q.reponses,
    bonne: q.bonne,
    anecdote: q.anecdote,
    categorie: m.categorie,
    sousTheme: m.sousTheme,
    etiquettes: m.etiquettes,
    difficulte: m.difficulte,
    ageMin: m.ageMin,
    date: m.date,
    entites: m.entites,
    portee: m.portee,
    valeur: m.valeur,
    leurres: m.leurres,
    dureeDeVie: m.dureeDeVie,
    explication: m.explication,
    source: m.source,
    confiance: m.confiance,
    aRelire: m.aRelire,
  })
}

function verifier(fichiers: string[]): number {
  const { questions: base } = lireLaBase()
  const dansLaBase = new Set(base.map(q => q.empreinte))
  const livres = empreintesDesLivres()
  const vues = new Map<string, string>()
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
      const lu = lireQuestionDeLaBase(brut, { sansId: true })
      if ('refus' in lu) {
        refus++
        return console.log(`✗ REFUS ${ou} « ${texte} » — ${lu.refus}`)
      }
      const q = lu.question
      const deja = vues.get(q.empreinte)
      if (deja) {
        refus++
        return console.log(`✗ REFUS ${ou} « ${texte} » — doublon de ${deja}`)
      }
      if (dansLaBase.has(q.empreinte)) {
        refus++
        return console.log(`✗ REFUS ${ou} « ${texte} » — déjà dans la base`)
      }
      if (livres.has(q.empreinte)) {
        refus++
        return console.log(`✗ REFUS ${ou} « ${texte} » — déjà dans un quiz livré`)
      }
      vues.set(q.empreinte, ou)
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
  const empreintes = new Set(base.map(q => q.empreinte))
  const livres = empreintesDesLivres()
  const parCategorie = new Map<string, QuestionDeLaBase[]>(CATEGORIES.map(c => [c, base.filter(q => q.meta.categorie === c)]))
  let rangees = 0
  const ecartees: string[] = []
  for (const fichier of fichiers) {
    lireLot(fichier).forEach((brut, i) => {
      const lu = lireQuestionDeLaBase(brut, { sansId: true })
      const ou = `${path.basename(fichier)} #${i}`
      if ('refus' in lu) return ecartees.push(`${ou} — ${lu.refus}`)
      const q = lu.question
      if (empreintes.has(q.empreinte) || livres.has(q.empreinte)) return ecartees.push(`${ou} — déjà là : ${q.texte}`)
      empreintes.add(q.empreinte)
      parCategorie.get(q.meta.categorie)!.push({ ...q, id: nouvelId(ids) })
      rangees++
    })
  }
  mkdirSync(DOSSIER_DE_LA_BASE, { recursive: true })
  for (const [categorie, questions] of parCategorie) {
    if (questions.length === 0) continue
    writeFileSync(path.join(DOSSIER_DE_LA_BASE, fichierDeCategorie(categorie)), `[\n${questions.map(enLigne).join(',\n')}\n]\n`)
  }
  for (const e of ecartees) console.log(`écartée : ${e}`)
  console.log(`${rangees} question(s) rangée(s), ${ecartees.length} écartée(s). La base en compte ${base.length + rangees}.`)
}

/** Les mots qui portent le sens d'un intitulé : sans accents, sans les petits mots. */
const VIDES = new Set(['dans', 'avec', 'quel', 'quelle', 'quels', 'quelles', 'lequel', 'laquelle', 'sont', 'était', 'etait', 'cette', 'quoi', 'pour', 'plus', 'comment', 'combien', 'nomme', 'appelle', 'appelait'])
function mots(texte: string): Set<string> {
  return new Set(
    sansAccent(texte)
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(m => m.length > 3 && !VIDES.has(m)),
  )
}
function proximite(a: Set<string>, b: Set<string>): number {
  let communs = 0
  for (const m of a) if (b.has(m)) communs++
  return communs / Math.max(1, a.size + b.size - communs)
}

/**
 * Les questions qui posent sans doute le même fait, que l'empreinte laisse
 * passer parce qu'elles le tournent autrement : la même bonne réponse et des
 * intitulés voisins, ou deux intitulés presque pareils dans un sous-thème.
 * Une liste à relire à la main, pas un refus : « Paris » répond à bien des
 * questions différentes.
 */
function voisines(fichiers: string[]) {
  const entrees: { ou: string; q: QuestionDeLaBase }[] = []
  if (fichiers.length === 0) for (const q of lireLaBase().questions) entrees.push({ ou: q.id, q })
  for (const f of fichiers) {
    lireLot(f).forEach((brut, i) => {
      const lu = lireQuestionDeLaBase(brut, { sansId: true })
      if (!('refus' in lu)) entrees.push({ ou: `${path.basename(f)} #${i}`, q: lu.question })
    })
  }
  const vus = entrees.map(e => ({ ...e, mots: mots(e.q.texte), juste: sansAccent(e.q.reponses[e.q.bonne]) }))
  let paires = 0
  for (let i = 0; i < vus.length; i++) {
    for (let j = i + 1; j < vus.length; j++) {
      const a = vus[i]
      const b = vus[j]
      const p = proximite(a.mots, b.mots)
      const memeReponse = a.juste === b.juste
      if ((memeReponse && p >= 0.34) || (a.q.meta.sousTheme === b.q.meta.sousTheme && p >= 0.6)) {
        paires++
        console.log(`${a.ou} « ${a.q.texte} » → ${a.q.reponses[a.q.bonne]}\n${b.ou} « ${b.q.texte} » → ${b.q.reponses[b.q.bonne]}\n`)
      }
    }
  }
  console.log(`${paires} paire(s) à relire sur ${vus.length} questions.`)
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

/**
 * La consigne d'écriture d'un lot : ce qu'on donne à une IA pour écrire des
 * questions de la base, déjà étiquetées. Ses champs sont ceux de la
 * consigne d'étiquetage de la réserve (`core/etiquetage.ts`), et le même
 * juge les relit (`lireEtiquetage`, par `lireQuestionDeLaBase`) : un champ
 * qu'elle décrirait autrement serait refusé à la vérification, pas rangé.
 */
export function consigneDEcriture(categorie: (typeof CATEGORIES)[number], quotas: { cle: string; n: number }[], lot: string, dossier: string): string {
  const total = quotas.reduce((s, q) => s + q.n, 0)
  const sousThemes = SOUS_THEMES[categorie]
  const part = quotas.map(q => `- ${q.cle} (${sousThemes.find(s => s.cle === q.cle)?.nom}) : ${q.n} questions`).join('\n')
  const etiquettes = ETIQUETTES.map(f =>
    f.regle
      ? `${f.famille} — ${f.regle} : ${f.etiquettes.map(e => `${e.cle} (${e.nom})`).join(', ')}`
      : [f.famille, ...f.etiquettes.filter(e => !ETIQUETTES_ECARTEES.includes(e.cle)).map(e => `- ${e.cle} : ${e.definition}`)].join('\n'),
  ).join('\n')
  const tousLesSousThemes = Object.entries(SOUS_THEMES)
    .map(([c, liste]) => `- ${c} : ${liste.map(s => s.cle).join(', ')}`)
    .join('\n')
  return `LA BASE DE LA CAMPAGNE DE FIESTAPP — ${total} QUESTIONS À ÉCRIRE, CATÉGORIE « ${categorie} »

FiestApp est un quiz joué sur téléphone par des francophones de tous âges, surtout des adultes en France. Sa campagne solo est une série de questions qui montent en difficulté — faciles, moyennes, difficiles, puis expertes —, avec trois vies et sans chronomètre ; après chaque réponse, le joueur découvre la bonne et une anecdote : c'est là qu'il apprend. La campagne puise dans une très grande base écrite d'avance, pour qu'un joueur n'y croise jamais deux fois la même question. Tu écris une partie de cette base : des questions sûres, variées, bien dosées, et déjà décrites par leurs métadonnées, dans un format qu'un programme relit et refuse au moindre écart.

TA PART — ${total} questions, catégorie « ${categorie} »
${part}
Dans chaque sous-thème, la difficulté (échelle plus bas) se répartit ainsi : environ 10 % de 1, 25 % de 2, 30 % de 3, 22 % de 4, 13 % de 5. Les faciles viennent toutes seules : écris d'abord les 4 et les 5, sans les rendre obscures.

CE QUI FAIT UNE BONNE QUESTION
- Un fait sûr, qui ne changera pas : ni actualité, ni « actuel », ni « aujourd'hui », ni record qui peut tomber, ni palmarès en cours, ni chiffre approximatif. Un fait daté se date dans l'intitulé (« En 1998, … »). Si tu n'es pas certain à cent pour cent de la bonne réponse ET des trois autres, change de question.
- Une seule bonne réponse, sans discussion possible, et trois mauvaises certainement fausses.
- Quatre réponses courtes (${REPONSE_CONSEILLEE} caractères au plus de préférence, ${MAX_REPONSE} au maximum), de même nature, de même forme et toutes plausibles : quatre villes du même pays, quatre années proches, quatre peintres de la même époque. Jamais de réponse absurde ou comique, jamais « Aucune » ou « Toutes », jamais la réponse ni un mot de la réponse dans l'intitulé, jamais de négation (« Lequel n'est pas… »).
- Un intitulé court et clair (${TEXTE_CONSEILLE} caractères au plus de préférence), qui se comprend seul : pas de photo, pas de son, pas de « ci-dessus ».
- Une anecdote vraie, toujours, en une ou deux phrases (220 caractères au plus) : elle apprend autre chose que la réponse, et ne contient aucun chiffre ni nom dont tu ne sois pas sûr.
- Le vrai ou faux est rare : au plus une question sur dix, seulement pour démentir une idée reçue (étiquette idee-recue) ; ses réponses sont exactement ["Vrai", "Faux"].
- Des sujets variés : jamais deux questions sur le même fait, ni la même question retournée (« Quelle est la capitale de X ? » puis « X a pour capitale… ? »). Varie les tournures : pas vingt « Quel est… ? » d'affilée.
- De France et du monde : environ un tiers de questions de culture française (portée france), le reste connu au-delà.
- Pas d'emoji, pas de sexualité, pas de politique d'aujourd'hui, rien qui révèle la fin d'un film, d'une série ou d'un livre, rien de cruel pour une personne réelle ou un peuple. Une question sur l'alcool est permise (ageMin 18), avec mesure.
- Le français soigné : accents, majuscules, apostrophes droites ('), une espace avant ? ! : ;, des guillemets « » autour d'un titre cité seulement s'il le faut.

L'ÉCHELLE DE DIFFICULTÉ — la part d'adultes francophones qui trouveraient la bonne réponse parmi les quatre
1 = presque tout le monde, 90 % et plus (« Quel fleuve traverse Paris ? ») ;
2 = la plupart, environ 70 % (« Quel peintre a peint La Nuit étoilée ? ») ;
3 = une personne sur deux (« Dans quel pays se trouve la ville de Porto ? ») ;
4 = un amateur éclairé, environ 35 % (« Quelle est la capitale de l'Australie ? ») ;
5 = un passionné, ou un piège qui fait tomber sous le hasard : moins de 25 % (« Quel est le plus long fleuve de France ? » — la Loire ; la Seine attire). Une 5 n'est pas obscure pour autant : en lisant la réponse, on se dit « j'aurais pu le savoir », ou « tiens ! ».
Les leurres règlent la difficulté : quatre réponses très proches rendent une question plus dure.
Vrai ou faux (le hasard donne 50 %) : 1 = 95 % et plus ; 2 = 85 % ; 3 = 70 % ; 4 = 55 % ; 5 = moins de 50 %, l'idée reçue l'emporte.

LE FORMAT — un fichier = un tableau JSON, une entrée par question, exactement ces champs, dans cet ordre :
- texte : l'intitulé.
- reponses : quatre chaînes, ou ["Vrai", "Faux"]. Place la bonne au hasard parmi les quatre (pas toujours en premier) : le jeu les mélange, mais une base dont la bonne est toujours la première trahit sa paresse.
- bonne : l'index (0 à 3) de la bonne réponse dans reponses.
- anecdote : une ou deux phrases (voir plus haut).
- categorie : « ${categorie} », recopiée telle quelle.
- sousTheme : la clé d'un sous-thème de ta part (liste plus haut). Une question qui, à la réflexion, relève d'une autre catégorie (règles de partage plus bas) : ne l'écris pas, écris-en une autre.
- etiquettes : de zéro à trois clés de la liste plus bas, chacune seulement si sa définition s'applique à la lettre à la question ou à sa bonne réponse, jamais à un leurre. La plupart des questions n'en ont qu'une, ou aucune.
- difficulte : de 1 à 5 (échelle plus haut).
- ageMin : 6, 10, 14 ou 18 — le plus jeune âge où la question est à la fois convenable et compréhensible. 6 : ce qu'un enfant connaît avant de bien lire ; 10 : l'école primaire ; 14 : le collège, ou un sujet qui demande de la maturité — dans le doute entre 10 et 14, mets 10 ; 18 : réservé aux adultes (l'alcool). Ce n'est pas la difficulté.
- date : {"valeur", "precision"} pour une œuvre, un monument, un événement, une invention ou une institution — sa sortie, son achèvement, son jour —, à la précision que tu connais avec certitude (jour, mois, annee, decennie ou siecle) ; valeur s'écrit AAAA, AAAA-MM ou AAAA-MM-JJ, une année avant notre ère en négatif sans zéros devant (« -27 »), une décennie ou un siècle par sa première année (les années 1990 = « 1990 », le XIXe siècle = « 1801 »). Une personne reçoit la date de l'événement que cite la question, null si elle n'en cite aucun. null pour un fait sans date : une capitale, un animal, une règle, un mot, une mesure.
- entites : de une à trois choses dont parle la question, la plus importante d'abord : {"nom", "type", "description"}. type parmi personne (réelle), personnage (de fiction), lieu (ville, pays, fleuve, monument, bâtiment, astre…), oeuvre, organisation (entreprise, équipe, institution, État même disparu), groupe (peuple, civilisation, dynastie), espece (animal ou plante), evenement (daté, y compris un traité), objet (chose fabriquée ou matière), notion (idée, phénomène, règle, unité, organe). description : quelques mots qui lèvent l'homonymie (« fleuve du nord de la France »). Jamais d'identifiant Wikidata.
- portee : france si un adulte qui n'a pas grandi en France a peu de chances de la connaître ; francophonie si elle suppose la culture francophone au-delà de la France ; monde sinon.
- valeur : quand la bonne réponse est un nombre ou une année, {"nombre", "unite"} (l'unité vide "" pour un nombre pur) ; null sinon.
- leurres : SIX À HUIT mauvaises réponses, de la plus vraisemblable à la moins vraisemblable : les trois de la question y sont toutes, recopiées caractère pour caractère, classées avec les autres ; celles que tu ajoutes ont la même nature et la même forme que la bonne, et sont certainement fausses. Seule exception : quand il existe en tout moins de sept réponses possibles (les cinq océans), donne-les toutes. Vrai ou faux : la seule autre réponse, ["Faux"] ou ["Vrai"].
- dureeDeVie : "stable", toujours — tu n'écris que des faits qui ne changeront pas.
- explication : une phrase de 200 caractères au plus qui dit pourquoi la bonne réponse est la bonne et, s'il y a un piège, pourquoi il trompe. Aucun fait au-delà de ce qui justifie la réponse, et elle ne répète pas l'anecdote.
- source : {"titre", "site"} : le titre exact de l'article où vérifier la réponse, site valant wikipedia-fr, wikipedia-en ou wikidata. Jamais d'adresse.
- confiance : 3, toujours — une question dont un seul élément te fait hésiter (la réponse, un leurre, l'anecdote, l'explication, la date) ne s'écrit pas : remplace-la.
- aRelire : [] — s'il y aurait quelque chose à relire, la question ne s'écrit pas. Seule exception : une étiquette de la famille Prudence s'accompagne de ["sensible"].

LES SOUS-THÈMES DE TOUTE LA BASE — pour savoir où s'arrête ta catégorie
${tousLesSousThemes}

LES ÉTIQUETTES — clé : ce qu'elle veut dire
${etiquettes}

LES RÈGLES DE PARTAGE — elles disent à quelle catégorie appartient un savoir
- Animaux, plantes et dinosaures → Nature ; corps humain, espace, astres, météo, maths, technologies → Sciences.
- Un événement daté — qui, quand — → Histoire, même s'il touche aux sciences (le premier pas sur la Lune : Histoire, explorations) ; comment une chose fonctionne → Sciences.
- Le calendrier, l'heure, les unités et leurs calculs → Culture générale (mesures) ; l'origine d'un mot, une écriture, un alphabet → Culture générale (langue) ; la mythologie → Culture générale (mythes).
- Un monument ou un lieu célèbre → Géographie (sites) quand la réponse est le lieu ou un fait sur le lieu ; quand la réponse est une personne, un peuple ou une date — qui l'a bâti, en quelle année —, c'est de l'Histoire.
- BD et manga → Arts & lettres (bd) ; un film tiré d'une BD → Cinéma ; une musique de film → Musique (ecrans) ; un aliment ou une boisson → Cuisine, l'alcool dans Cuisine (boissons).
- C'est le savoir demandé qui décide : « Quel acteur joue Indiana Jones ? » est du cinéma, pas une célébrité.
- Les étiquettes ne répètent jamais ce qu'un autre champ dit déjà : ni le pays, ni l'époque, ni la catégorie.

COMMENT TRAVAILLER
1. Écris par fichiers de 30 à 40 questions, dans ${dossier}/${lot}-01.json, puis ${lot}-02.json, etc. Un fichier ne contient que le tableau JSON, rien d'autre.
2. Après chaque fichier, lance : cd /home/user/FiestApp/server && npx tsx scripts/base-campagne.ts verifier ${dossier}/${lot}-NN.json — puis corrige ou remplace chaque question REFUSÉE et chaque AVERTISSEMENT, et relance jusqu'à zéro refus.
3. Avant d'écrire un nouveau fichier, relis tes intitulés déjà écrits : jamais deux questions sur le même fait, même dans deux fichiers.
4. Relis chaque question comme un correcteur exigeant avant de l'écrire : la bonne réponse est-elle certaine et la seule possible ? Chaque leurre est-il certainement faux ? L'anecdote est-elle exacte ? Au moindre doute, remplace la question. Mieux vaut une question simple et sûre qu'une question brillante et fausse.
5. À la fin, vérifie tous tes fichiers d'un coup (verifier ${dossier}/${lot}-*.json : zéro refus, aucun doublon) et rends un bilan court : le nombre de questions par sous-thème et par difficulté. N'écris rien ailleurs que dans tes fichiers ${lot}-NN.json.

EXEMPLE — deux entrées (Géographie et Sport) ; n'en reprends pas les questions
[
  {"texte": "Quelle est la capitale de l'Australie ?", "reponses": ["Sydney", "Melbourne", "Canberra", "Perth"], "bonne": 2, "anecdote": "Canberra a été bâtie exprès pour devenir la capitale : Sydney et Melbourne se disputaient le titre.", "categorie": "Géographie", "sousTheme": "capitales", "etiquettes": ["piege"], "difficulte": 4, "ageMin": 10, "date": null, "entites": [{"nom": "Canberra", "type": "lieu", "description": "ville d'Australie"}, {"nom": "Australie", "type": "lieu", "description": "pays d'Océanie"}], "portee": "monde", "valeur": null, "leurres": ["Sydney", "Melbourne", "Brisbane", "Perth", "Adélaïde", "Darwin"], "dureeDeVie": "stable", "explication": "Sydney est la plus grande ville du pays, d'où le piège ; la capitale fédérale est Canberra.", "source": {"titre": "Canberra", "site": "wikipedia-fr"}, "confiance": 3, "aRelire": []},
  {"texte": "Combien de joueurs une équipe de rugby à XV aligne-t-elle sur le terrain ?", "reponses": ["11", "13", "15", "18"], "bonne": 2, "anecdote": "Le sport tient son nom de la ville anglaise de Rugby, dont le collège passe pour l'avoir vu naître au XIXe siècle.", "categorie": "Sport", "sousTheme": "rugby", "etiquettes": [], "difficulte": 1, "ageMin": 10, "date": null, "entites": [{"nom": "Rugby à XV", "type": "notion", "description": "sport collectif au ballon ovale"}], "portee": "monde", "valeur": {"nombre": 15, "unite": "joueurs"}, "leurres": ["13", "14", "16", "11", "12", "18"], "dureeDeVie": "stable", "explication": "Le nom le dit : le rugby à XV se joue à quinze ; à treize, c'est le rugby à XIII, une autre discipline.", "source": {"titre": "Rugby à XV", "site": "wikipedia-fr"}, "confiance": 3, "aRelire": []}
]
`
}

const [commande, ...args] = process.argv.slice(2)
if (commande === 'verifier') {
  if (args.length === 0) throw new Error('verifier <lot.json> …')
  process.exitCode = verifier(args) > 0 ? 1 : 0
} else if (commande === 'ranger') {
  if (args.length === 0) throw new Error('ranger <lot.json> …')
  ranger(args)
} else if (commande === 'stats') {
  stats()
} else if (commande === 'voisines') {
  voisines(args)
} else if (commande === 'consigne') {
  const [categorie, ...parts] = args
  const c = CATEGORIES.find(x => sansAccent(x) === sansAccent(categorie ?? ''))
  if (!c || parts.length === 0) throw new Error('consigne <Catégorie> <sous-thème>:<n> … [--lot=nom] [--dossier=chemin]')
  const lot = parts.find(p => p.startsWith('--lot='))?.slice(6) ?? 'lot'
  const dossier = parts.find(p => p.startsWith('--dossier='))?.slice(10) ?? '/home/user/FiestApp/.lots-campagne'
  const quotas = parts
    .filter(p => !p.startsWith('--'))
    .map(p => {
      const [cle, n] = p.split(':')
      if (!SOUS_THEMES[c].some(s => s.cle === cle)) throw new Error(`sous-thème inconnu dans ${c} : ${cle}`)
      return { cle, n: Number(n) }
    })
  process.stdout.write(consigneDEcriture(c, quotas, lot, dossier))
} else {
  console.log('base-campagne.ts consigne | verifier | ranger | stats | voisines')
}
