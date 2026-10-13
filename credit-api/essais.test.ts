// L'outillage du crédit, sans réseau et sans un centime : une fausse API rend
// ce qu'un modèle rendrait, et l'on vérifie ce que les scripts en font — la
// base relue, corrigée, reclassée ; une génération écrite, corrigée, relue —
// et ce qu'ils disent aux modèles : le jugement de l'agent correcteur, lu
// dans son fichier, et les règles du classement, lues dans la consigne.
//
//   node --import tsx --test credit-api/essais.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type Anthropic from '@anthropic-ai/sdk'
import { lireLaBase, lireQuestionDeLaBase, type QuestionDeLaBase } from '../server/src/core/baseCampagne'
import { charger, finie } from '../server/scripts/generer-campagne'
import { lireLot } from '../server/scripts/lots-campagne'
import { CATEGORIES, type Categorie } from '../shared/categories'
import { SOUS_THEMES } from '../shared/etiquettes'
import { coutDUnMessage, jsonDe, lireLeCarnet, verrouiller, type API, type Demande, type LotLu } from './api'
import { champsLus, decisionsDe, jugementDuRelecteur, schemaDesDecisions, systemeDuRelecteur, verdictDe } from './consignes'
import { apercu } from './apercu'
import { appliquer, appliquerALaBase, avancer, carteDe, charger as chargerLaRelecture, decisionsFinales, ecrireLaBase, preparerLaRelecture, type ContexteDeRelecture, type Relecture } from './relire'
import { avancerLaGeneration, chargerLEtat, commandeDesNombres, preparerLaGeneration, refusDuLot, type ContexteDeGeneration } from './generer'

// ── Des questions que le juge accepte ───────────────────────────────────

/** Une entrée qu'accepte le juge de la base : sa bonne réponse et ses mots lui sont propres. */
function entree(n: number, { categorie = 'Géographie' as Categorie, sousTheme = '', difficulte = 3 } = {}): Record<string, unknown> {
  const mauvaises = [`Leurre ${n} premier`, `Leurre ${n} second`, `Leurre ${n} troisième`]
  return {
    texte: `Quel fait numéro ${n} distingue ce lieu ${n} de ses voisins ?`,
    reponses: [`Réponse ${n} exacte`, ...mauvaises],
    bonne: 0,
    anecdote: 'Une anecdote vraie.',
    categorie,
    sousTheme: sousTheme || SOUS_THEMES[categorie][0].cle,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date: null,
    entites: [{ nom: `Lieu ${n}`, type: 'lieu', description: 'pour lever l’homonymie' }],
    portee: 'monde',
    valeur: null,
    leurres: [...mauvaises, `Leurre ${n} quatrième`, `Leurre ${n} cinquième`, `Leurre ${n} sixième`],
    dureeDeVie: 'stable',
    explication: 'Parce que.',
    source: { titre: `Lieu ${n}`, site: 'wikipedia-fr' },
    confiance: 3,
    aRelire: [],
  }
}

/** Une question à nombre qui se joue au plus près : une hauteur en mètres, plus de cent. */
function aNombre(n: number, o: Parameters<typeof entree>[1] = {}): Record<string, unknown> {
  const h = 200 + n * 7
  const mauvaises = [`${h + 40} m`, `${h - 30} m`, `${h + 90} m`]
  return {
    ...entree(n, o),
    texte: `Combien de mètres mesure la tour numéro ${n} ?`,
    reponses: [`${h} m`, ...mauvaises],
    valeur: { nombre: h, unite: 'm' },
    leurres: [...mauvaises, `${h + 120} m`, `${h - 60} m`, `${h + 150} m`],
  }
}

function question(n: number, o: Parameters<typeof entree>[1] = {}, faire = entree): QuestionDeLaBase {
  const lu = lireQuestionDeLaBase({ ...faire(n, o), id: `base${String(n).padStart(4, '0')}` })
  if ('refus' in lu) throw new Error(lu.refus)
  return lu.question
}

// ── Une fausse API ───────────────────────────────────────────────────────

/** Une réponse comme l'API la rend : son texte, et ce qu'elle a coûté en jetons. */
function message(texte: string, model: string): Anthropic.Message {
  return {
    id: 'msg_faux',
    type: 'message',
    role: 'assistant',
    model,
    content: [{ type: 'text', text: texte, citations: null }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 10_000, output_tokens: 2_000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
  } as unknown as Anthropic.Message
}

/** Ce que reçoit le modèle d'une demande : le texte de son premier message. */
const consigneDe = (d: Demande) => String(d.params.messages[0].content)

class FausseAPI implements API {
  envoyes: Demande[][] = []
  constructor(private readonly repondre: (d: Demande) => string | { erreur: string }) {}
  async envoyer(demandes: readonly Demande[]) {
    this.envoyes.push([...demandes])
    return `lot_${this.envoyes.length}`
  }
  async lire(id: string): Promise<LotLu> {
    const resultats = new Map()
    for (const d of this.envoyes[Number(id.slice(4)) - 1]) {
      const r = this.repondre(d)
      resultats.set(d.id, typeof r === 'string' ? { message: message(r, d.params.model) } : { erreur: r.erreur })
    }
    return { fini: true, resume: 'tout rendu', resultats }
  }
}

const dossierNeuf = (prefixe: string) => mkdtempSync(path.join(tmpdir(), prefixe))

// ── Ce qu'on lit d'une réponse ───────────────────────────────────────────

test('le JSON d’une réponse se lit tel quel, dans son dernier bloc, ou entre deux phrases', () => {
  assert.deepEqual(jsonDe('[{"a":1}]'), [{ a: 1 }])
  assert.deepEqual(jsonDe('J’ai vérifié {deux} sources.\n```json\n{"verdict":"garder"}\n```'), { verdict: 'garder' }, 'le bloc, malgré les accolades de la phrase')
  assert.deepEqual(jsonDe('Voici le lot :\n[{"texte":"x"}]\nBonne relecture.'), [{ texte: 'x' }])
  assert.equal(jsonDe('rien qui se lise'), undefined)
})

test('le coût d’une réponse : moitié prix en lot, les recherches en plus', () => {
  const m = message('x', 'claude-opus-5-5')
  assert.equal(coutDUnMessage(m), ((10_000 * 4 + 2_000 * 20) / 1e6) * 0.5)
  const cherche = { ...m, usage: { ...m.usage, server_tool_use: { web_search_requests: 3, web_fetch_requests: 0 } } } as Anthropic.Message
  assert.ok(Math.abs(coutDUnMessage(cherche) - coutDUnMessage(m) - 0.03) < 1e-9)
  assert.throws(() => coutDUnMessage({ ...m, model: 'un-modele-inconnu' }), /Tarif inconnu/)
})

test('un seul « avancer » à la fois : un autre processus vivant tient le verrou, un mort le rend', () => {
  const dossier = dossierNeuf('verrou-')
  const lacher = verrouiller(dossier)
  lacher()
  writeFileSync(path.join(dossier, 'verrou'), String(process.ppid))
  assert.throws(() => verrouiller(dossier), /Un autre « avancer » tourne déjà/)
  writeFileSync(path.join(dossier, 'verrou'), '999999999')
  verrouiller(dossier)()
  assert.ok(!existsSync(path.join(dossier, 'verrou')), 'lâché, il n’en reste rien')
})

// ── Ce qu'on dit aux modèles ─────────────────────────────────────────────

test('le correcteur juge comme l’agent du dépôt : son jugement se lit dans son fichier', () => {
  const j = jugementDuRelecteur()
  assert.match(j.intro, /^Tu es le correcteur indépendant/)
  for (const n of [1, 2, 3, 4, 5]) assert.match(j.criteres, new RegExp(`^${n}\\. `, 'm'), `le critère ${n}`)
  assert.match(j.decisions, /"retirer"/)
  assert.match(j.decisions, /"corriger"/)
  const lots = systemeDuRelecteur('lots', j)
  assert.match(lots, /dans le doute, on retire/)
  assert.doesNotMatch(lots, /avec Write|N'ouvre que/, 'rien de ce qui ne vaut que pour un agent')
})

test('le second correcteur de la base doute au lieu de retirer, et juge le classement avec les règles du rédacteur', () => {
  const base = systemeDuRelecteur('base')
  assert.match(base, /- douter — /)
  assert.match(base, /⚠ racine/)
  assert.match(base, /6\. est-elle bien classée \?/)
  assert.match(base, /LES RÈGLES DE PARTAGE/)
  assert.match(base, /LES ÉTIQUETTES/)
  assert.match(base, /- etiquettes : de zéro à trois clés/, 'la règle des étiquettes de la consigne')
  for (const c of CATEGORIES) assert.ok(base.includes(`- ${c} : `), `les sous-thèmes de ${c}`)
  assert.doesNotMatch(base, /COMMENT TRAVAILLER|dans le doute, on retire/, 'ni la façon d’écrire, ni le retrait au moindre doute')
})

test('le schéma des décisions tient les règles des sorties structurées : tout objet fermé, chaque clé requise', () => {
  const verifier = (s: unknown, ou: string): void => {
    if (!s || typeof s !== 'object') return
    const o = s as Record<string, unknown>
    if (o.type === 'object') {
      assert.equal(o.additionalProperties, false, `${ou} : additionalProperties`)
      assert.deepEqual([...(o.required as string[])].sort(), Object.keys(o.properties as object).sort(), `${ou} : required`)
    }
    for (const [k, v] of Object.entries(o)) {
      if (Array.isArray(v)) v.forEach((x, i) => verifier(x, `${ou}.${k}[${i}]`))
      else verifier(v, `${ou}.${k}`)
    }
  }
  verifier(schemaDesDecisions(['retirer', 'corriger']), 'lots')
  verifier(schemaDesDecisions(['retirer', 'corriger', 'douter'], { classement: true }), 'base')
})

test('les décisions se lisent à la référence près, sans un champ vide ni un champ qui ne se corrige pas', () => {
  const refs = new Set(['g1-01.json#0', 'g1-01.json#1', 'g1-01.json#2', 'g1-01.json#3'])
  const rendu = message(
    JSON.stringify({
      decisions: [
        { ref: '[g1-01#0]', action: 'retirer', champs: null, motif: 'faux' },
        { ref: 'g1-01.json#1', action: 'corriger', champs: { texte: null, anecdote: 'Juste.', explication: null, difficulte: null }, motif: 'anecdote' },
        { ref: 'g1-01.json#2', action: 'corriger', champs: { texte: null, anecdote: null, explication: null, difficulte: null }, motif: 'rien' },
        { ref: 'g1-01.json#3', action: 'corriger', champs: { categorie: 'Histoire', sousTheme: 'guerres' }, motif: 'reclasser un lot' },
        { ref: 'g9-01.json#0', action: 'retirer', champs: null, motif: 'une autre fiche' },
      ],
    }),
    'claude-opus-5-5',
  )
  const lues = decisionsDe(rendu, refs)!
  assert.deepEqual(lues.decisions, [
    { ref: 'g1-01.json#0', action: 'retirer', motif: 'faux' },
    { ref: 'g1-01.json#1', action: 'corriger', champs: { anecdote: 'Juste.' }, motif: 'anecdote' },
  ])
  assert.equal(lues.ecartees, 3, 'la correction vide, le reclassement d’un lot, la référence inconnue')
  assert.equal(decisionsDe(message('pas de JSON', 'claude-opus-5-5'), refs), null)
  // La base, elle, se reclasse ; et un doute garde son reclassement.
  const base = decisionsDe(
    message(
      JSON.stringify({
        decisions: [
          { ref: 'base0001', action: 'corriger', champs: { texte: null, anecdote: null, explication: null, difficulte: null, categorie: 'histoire', sousTheme: 'guerres', etiquettes: [] }, motif: 'Histoire' },
          { ref: 'base0002', action: 'douter', champs: { texte: 'ignoré', anecdote: null, explication: null, difficulte: null, categorie: null, sousTheme: null, etiquettes: ['piege'] }, motif: 'vérifier' },
        ],
      }),
      'claude-opus-5-5',
    ),
    new Set(['base0001', 'base0002']),
    { classement: true },
  )!
  assert.deepEqual(base.decisions, [
    { ref: 'base0001', action: 'corriger', champs: { categorie: 'Histoire', sousTheme: 'guerres', etiquettes: [] }, motif: 'Histoire' },
    { ref: 'base0002', action: 'douter', champs: { etiquettes: ['piege'] }, motif: 'vérifier' },
  ])
  assert.deepEqual(champsLus({ difficulte: '4', intitule: ' Nouvel intitulé ? ' }), { difficulte: 4, texte: 'Nouvel intitulé ?' })
  assert.equal(champsLus({ difficulte: 9 }), undefined)
})

test('le verdict d’un doute se lit dans son dernier bloc, sources comprises ; une correction vide n’en est pas un', () => {
  const v = verdictDe(message('J’ai cherché.\n```json\n{"verdict":"corriger","champs":{"anecdote":"Vraie.","categorie":"Histoire"},"motif":"date","sources":["https://fr.wikipedia.org/x",3]}\n```', 'claude-opus-5-5'))
  assert.deepEqual(v, { action: 'corriger', champs: { anecdote: 'Vraie.' }, motif: 'date', sources: ['https://fr.wikipedia.org/x'] }, 'le classement reste à la première passe')
  assert.equal(verdictDe(message('```json\n{"verdict":"corriger","champs":{},"motif":"?"}\n```', 'claude-opus-5-5')), null)
  assert.equal(verdictDe(message('Je ne sais pas.', 'claude-opus-5-5')), null)
})

// ── La relecture de la base ──────────────────────────────────────────────

test('une relecture entière : la passe des fiches, les doutes vérifiés, puis la base corrigée, reclassée, sans ses retirées', async () => {
  const geo = SOUS_THEMES['Géographie']
  const questions = [1, 2, 3, 4, 5, 6].map(n => question(n, { sousTheme: geo[n % 3].cle }))
  const dossier = dossierNeuf('relecture-')
  const dossierDeLaBase = dossierNeuf('base-')
  ecrireLaBase(dossierDeLaBase, questions)
  assert.deepEqual(
    lireLaBase(dossierDeLaBase).questions.map(q => q.id),
    questions.map(q => q.id),
    'la base écrite se relit telle quelle',
  )
  for (const l of readFileSync(path.join(dossierDeLaBase, 'geographie.json'), 'utf8').trimEnd().split('\n').slice(1, -1)) assert.match(l, /^\{"id":"[a-z0-9]{8}",.*\},?$/)

  const dites: string[] = []
  const api = new FausseAPI(d => {
    if (d.id.startsWith('p1-')) {
      const fiche = consigneDe(d)
      const decisions = []
      if (fiche.includes('[base0001]')) decisions.push({ ref: 'base0001', action: 'retirer', champs: null, motif: 'la bonne réponse est fausse' })
      if (fiche.includes('[base0002]')) decisions.push({ ref: 'base0002', action: 'corriger', champs: { texte: null, anecdote: 'Une anecdote juste.', explication: null, difficulte: 4 }, motif: 'anecdote fausse' })
      if (fiche.includes('[base0003]')) decisions.push({ ref: '[base0003]', action: 'douter', champs: { categorie: 'Géographie', sousTheme: geo[4].cle, etiquettes: null }, motif: 'la date a-t-elle changé ?' })
      // Un sous-thème d'une autre catégorie : le juge le refuse, la question reste telle quelle.
      if (fiche.includes('[base0004]')) decisions.push({ ref: 'base0004', action: 'corriger', champs: { categorie: 'Géographie', sousTheme: 'guerres' }, motif: 'mal rangée' })
      return JSON.stringify({ decisions })
    }
    assert.equal(d.id, 'p2-base0003', 'seul le doute part en vérification')
    assert.ok(d.params.tools?.some(t => (t as { type: string }).type === 'web_search_20260209'), 'avec la recherche sur le web')
    return 'Les sources confirment.\n```json\n{"verdict": "garder", "champs": null, "motif": "confirmé", "sources": ["https://fr.wikipedia.org/wiki/Lieu"]}\n```'
  })
  const ctx: ContexteDeRelecture = { dossier, base: questions, api, budget: 50, dire: l => dites.push(l) }
  const r = preparerLaRelecture(ctx, { parFiche: 5 })
  assert.deepEqual(
    r.fiches.map(f => f.ids.length),
    [5, 1],
    'des fiches d’une seule catégorie, cinq questions au plus',
  )
  assert.match(carteDe(questions[0]), /^\[base0001\] Géographie › \S+ · étiquettes : aucune · d3 · 10 ans\n {2}Quel fait/)

  assert.equal(await avancer(ctx, chargerLaRelecture(dossier, r.nom)), 'envoye')
  assert.equal(api.envoyes[0].length, 2, 'une demande par fiche')
  assert.equal(await avancer(ctx, chargerLaRelecture(dossier, r.nom)), 'envoye', 'les fiches rendues, le doute part')
  assert.equal(await avancer(ctx, chargerLaRelecture(dossier, r.nom)), 'fini')
  const relue = chargerLaRelecture(dossier, r.nom)
  assert.equal(relue.relues.length, 2)
  assert.equal(relue.verifiees.base0003.action, 'garder')
  const carnet = lireLeCarnet(dossier)
  assert.equal(carnet.lots.length, 2)
  assert.ok(carnet.lots.every(l => l.cout! > 0 && l.prevu > 0), 'chaque lot a son coût prévu, puis mesuré')

  const finales = decisionsFinales(relue)
  assert.deepEqual([...finales.keys()].sort(), ['base0001', 'base0002', 'base0003', 'base0004'])
  assert.deepEqual(finales.get('base0003')!.champs, { categorie: 'Géographie', sousTheme: geo[4].cle }, 'le doute levé garde son reclassement')

  appliquer({ dossier, dire: l => dites.push(l) }, relue, { dossierDeLaBase })
  const apres = new Map(lireLaBase(dossierDeLaBase).questions.map(q => [q.id, q]))
  assert.equal(apres.size, 5)
  assert.ok(!apres.has('base0001'), 'retirée')
  assert.equal(apres.get('base0002')!.anecdote, 'Une anecdote juste.', 'corrigée sous le même identifiant')
  assert.equal(apres.get('base0002')!.meta.difficulte, 4)
  assert.equal(apres.get('base0003')!.meta.sousTheme, geo[4].cle, 'reclassée')
  assert.equal(apres.get('base0004')!.meta.sousTheme, questions[3].meta.sousTheme, 'un reclassement refusé laisse la question où elle était')
  const journal = readFileSync(path.join(dossier, `relecture-${r.nom}.journal.md`), 'utf8')
  assert.match(journal, /- retirée \[base0001\]/)
  assert.match(journal, /- corrigée \[base0002\].*anecdote : « Une anecdote vraie\. » → « Une anecdote juste\. »/)
  assert.match(journal, /- reclassée \[base0003\]/)
  assert.match(journal, /- reclassement ignoré \[base0004\]/)
  assert.throws(() => preparerLaRelecture({ ...ctx, base: [...apres.values()] }), /Rien à relire/, 'le pilote ne se relit pas deux fois')
})

test('une correction que le juge refuse, ou qui reprend l’intitulé d’une autre, retire sa question', () => {
  const [a, b, c] = [1, 2, 3].map(n => question(n))
  const fait = appliquerALaBase(
    [a, b, c],
    new Map([
      ['base0001', { action: 'corriger' as const, champs: { texte: `Que vaut ${a.reponses[a.bonne]} ici ?` }, motif: 'reformuler' }],
      ['base0002', { action: 'corriger' as const, champs: { texte: c.texte }, motif: 'reformuler' }],
    ]),
  )
  assert.deepEqual(
    fait.questions.map(q => q.id),
    ['base0003'],
  )
  assert.match(fait.journal[0], /refusée par le juge : la bonne réponse est écrite dans l’intitulé/)
  assert.match(fait.journal[1], /reprend l'intitulé de \[base0003\]/)
})

test('l’aperçu dit chaque décision sous sa question, avant et après, sans rien écrire', () => {
  const [a, b, c] = [1, 2, 3].map(n => question(n))
  const r: Relecture = {
    nom: 'essai',
    creee: '2026-10-13T00:00:00.000Z',
    effort: 'high',
    fiches: [{ nom: 'f001', ids: ['base0001', 'base0002', 'base0003'] }],
    relues: ['f001'],
    decisions: {
      base0001: { action: 'retirer', motif: 'la bonne réponse est fausse' },
      base0002: { action: 'corriger', champs: { anecdote: 'Une anecdote juste.' }, motif: 'anecdote fausse' },
      base0003: { action: 'douter', motif: 'la date a-t-elle changé ?' },
    },
    verifiees: { base0003: { action: 'garder', motif: 'confirmé', sources: ['https://fr.wikipedia.org/wiki/Lieu'] } },
    essais: {},
    lots: [],
  }
  const avant = JSON.stringify([a, b, c])
  const md = apercu(r, [a, b, c])
  assert.equal(JSON.stringify([a, b, c]), avant, 'les questions restent telles quelles')
  assert.match(md, /1 retirée\(s\), 1 corrigée\(s\), 0 reclassée\(s\) ; la base passerait de 3 à 2 questions/)
  assert.match(md, /## Les retraits \(1\)\n\n\*\*\[base0001\]\*\* Géographie › /)
  assert.ok(md.includes(`> ${b.texte}`), 'la question telle que les joueurs la lisent')
  assert.match(md, /- \*\*corriger\*\* — anecdote fausse — `anecdote` → « Une anecdote juste\. »/)
  assert.match(md, /- \*\*Le verdict : garder\*\* — confirmé\n- Sources : https:\/\/fr\.wikipedia\.org\/wiki\/Lieu/)
  assert.match(md, /- corrigée \[base0002\].*anecdote : « Une anecdote vraie\. » → « Une anecdote juste\. »/, 'le journal qu’« appliquer » écrirait')
})

test('un lot qui ferait passer le budget ne part pas', async () => {
  const api = new FausseAPI(() => JSON.stringify({ decisions: [] }))
  const ctx: ContexteDeRelecture = { dossier: dossierNeuf('budget-'), base: [question(1)], api, budget: 0.000001, dire: () => {} }
  const r = preparerLaRelecture(ctx)
  await assert.rejects(avancer(ctx, r), /Budget : 0\.00 \$ dépensés/)
  assert.equal(api.envoyes.length, 0)
})

test('une fiche en erreur repart, trois fois au plus', async () => {
  const api = new FausseAPI(() => ({ erreur: 'overloaded_error : surcharge' }))
  const dites: string[] = []
  const ctx: ContexteDeRelecture = { dossier: dossierNeuf('essais-'), base: [question(1)], api, budget: 50, dire: l => dites.push(l) }
  const r = preparerLaRelecture(ctx)
  for (let i = 0; i < 3; i++) assert.equal(await avancer(ctx, chargerLaRelecture(ctx.dossier, r.nom)), 'envoye')
  assert.equal(await avancer(ctx, chargerLaRelecture(ctx.dossier, r.nom)), 'bloque')
  assert.equal(api.envoyes.length, 3)
  assert.ok(dites.some(l => l.includes('échec 3/3')))
})

// ── La génération ────────────────────────────────────────────────────────

/** Ce qu'écrirait un rédacteur : les questions que sa part demande, chacune son fait. */
function ecrire(consigne: string, depart: number): Record<string, unknown>[] {
  const categorie = /CATÉGORIE « ([^»]+) »/.exec(consigne)![1] as Categorie
  let n = depart
  return [...consigne.matchAll(/^- ([a-z-]+) \(.*\) : (\d+) questions?(?: de difficulté (\d))?$/gm)].flatMap(([, cle, combien, d]) =>
    Array.from({ length: Number(combien) }, () => entree(n++, { categorie, sousTheme: cle, difficulte: Number(d ?? 3) })),
  )
}

test('une génération par l’API : écrite, corrigée là où le juge refuse, relue, jusqu’au bilan', async () => {
  const base = [1, 2, 3].map(n => question(n))
  let suivante = 100
  let corrections = 0
  const api = new FausseAPI(d => {
    if (d.id.startsWith('e-')) {
      const lot = ecrire(consigneDe(d), suivante)
      suivante += 50
      // Le premier lot reprend une question de la base : le juge la refuse, elle repart en correction.
      if (d.id.endsWith('-01')) lot[0] = { ...lot[0], texte: base[0].texte }
      return JSON.stringify(lot)
    }
    if (/^c\d+-/.test(d.id)) {
      corrections++
      assert.match(consigneDe(d), /LE JUGE A RELU TON LOT[\s\S]*déjà dans la base/)
      const combien = Number(/Rends seulement le tableau JSON de ces (\d+) remplaçantes/.exec(consigneDe(d))?.[1] ?? (consigneDe(d).includes('de cette remplaçante') ? 1 : NaN))
      const rempl = Array.from({ length: combien }, () => entree(suivante++))
      return JSON.stringify(rempl)
    }
    // Le correcteur retire la première question de sa fiche.
    const ref = /^\[([^\]]+)\]/m.exec(consigneDe(d))![1]
    return JSON.stringify({ decisions: [{ ref, action: 'retirer', champs: null, motif: 'faux' }] })
  })
  const dites: string[] = []
  const ctx: ContexteDeGeneration = { dossier: dossierNeuf('lots-'), base, livres: new Set(), dire: l => dites.push(l), api, budget: 50, dossierApi: dossierNeuf('api-') }
  const { g, prevu } = preparerLaGeneration(ctx, { questions: 8, categories: ['Géographie'], parLot: 5 })
  assert.ok(prevu > 0)
  let etape = ''
  for (let i = 0; i < 20 && etape !== 'fini'; i++) etape = await avancerLaGeneration(ctx, charger(ctx, g.nom), chargerLEtat(ctx.dossierApi, g.nom))
  assert.equal(etape, 'fini', dites.join('\n'))
  assert.ok(finie(charger(ctx, g.nom)))
  assert.equal(corrections, 1, 'un tour de correction, pour la seule refusée')
  const lots = readdirSync(ctx.dossier).filter(f => new RegExp(`^${g.nom}-\\d+\\.json$`).test(f))
  const gardees = lots.reduce((s, f) => s + lireLot(path.join(ctx.dossier, f)).length, 0)
  const fiches = charger(ctx, g.nom).vagues.reduce((s, v) => s + (v.fiches?.length ?? 0), 0)
  assert.equal(gardees, 8 - fiches, 'les huit écrites, moins une retirée par fiche')
  for (const f of lots) for (const e of lireLot(path.join(ctx.dossier, f))) assert.notEqual((e as { texte: string }).texte, base[0].texte, 'la refusée a laissé sa place')
  assert.ok(!dites.some(l => /redacteur-campagne|À lancer/.test(l)), 'rien qui parle d’agents à lancer')
  assert.ok(dites.some(l => l.includes('ranger')), 'le bilan dit comment ranger')
  assert.ok(!existsSync(path.join(ctx.dossierApi, `generation-${g.nom}`)) || readdirSync(path.join(ctx.dossierApi, `generation-${g.nom}`)).length === 0, 'plus aucun brouillon')
})

test('une part à nombre : là où un nombre se pose déjà, et ce qui ne se joue pas au plus près repart', () => {
  const geo = SOUS_THEMES['Géographie']
  const base = [
    ...[1, 2, 3].map(n => question(n, { sousTheme: geo[2].cle }, aNombre)),
    question(4, { sousTheme: geo[0].cle }),
  ]
  const commandes = commandeDesNombres(base, 24, ['Géographie', 'Sport'])
  assert.deepEqual(commandes.get('Géographie'), [{ cle: geo[2].cle, n: 12 }], 'le seul sous-thème qui a déjà ses nombres')
  assert.equal(
    commandes.get('Sport')!.reduce((s, q) => s + q.n, 0),
    12,
    'une catégorie sans nombres les répartit partout',
  )
  const ctx = { dossier: dossierNeuf('nombres-'), base, livres: new Set<string>(), dire: () => {} }
  const refus = refusDuLot(ctx, [], [aNombre(50), entree(51)], true)
  assert.deepEqual(
    refus.map(r => r.i),
    [1],
  )
  assert.match(refus[0].motif, /ne se jouera pas au plus près/)
  assert.deepEqual(refusDuLot(ctx, [], [entree(51)], false), [], 'hors d’une part à nombre, une question sans nombre passe')
})
