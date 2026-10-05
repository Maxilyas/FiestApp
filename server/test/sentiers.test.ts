// Les sentiers du savoir : le second mode de la campagne solo, où se gagnent
// les avatars du savoir (`shared/sentiers.ts`).
//
// Un sentier par branche, douze paliers chacun ; un palier pose seize
// questions de sa catégorie et se valide à douze bonnes réponses — ce sont
// les questions qui durcissent. Un portrait tous les deux paliers, un titre
// de maître au palier facultatif d'après le sommet. Un palier raté coûte une
// vie ; un palier déjà validé se rejoue sans risque. Le serveur compte tout,
// et ne donne la bonne réponse qu'après la sienne (invariant 1).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import {
  PALIERS,
  PALIER_DU_MAITRE,
  QUESTIONS_PAR_EPREUVE,
  SEUIL_DES_PALIERS,
  SEUIL_DU_MAITRE,
  VIES_PAR_JOUR,
  cleDeMaitre,
  epreuveFinie,
  etoilesDe,
  issueDe,
  maitresDe,
  nomDuTitre,
  paliersDesPortraits,
  regleDuPalier,
  sentierQuOnAvance,
  viesDe,
  type SentierDuJoueur,
} from '../../shared/sentiers'
import { BRANCHES, PALIER_DU_PORTRAIT } from '../../shared/branches'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { BaseDeLaCampagne, lireQuestionDeLaBase } from '../src/core/baseCampagne'
import { tirerUneEpreuve } from '../src/core/campagne'
import { XP_PAR_JUSTE, niveauDeQuestion } from '../../shared/campagne'

// ── Les règles pures ───────────────────────────────────────────────────────

test('douze paliers de seize questions à douze bonnes réponses, plus durs à chaque marche — puis le maître', () => {
  assert.equal(PALIERS.length, 13)
  const poids = { facile: 0, moyen: 1, difficile: 2, expert: 3 } as const
  let avant = -1
  for (const r of PALIERS) {
    const total = Object.values(r.melange).reduce((n, x) => n + (x ?? 0), 0)
    assert.equal(total, QUESTIONS_PAR_EPREUVE, `palier ${r.n} : seize questions`)
    // La difficulté moyenne du mélange ne redescend jamais.
    const dur = Object.entries(r.melange).reduce((n, [niveau, x]) => n + poids[niveau as keyof typeof poids] * (x ?? 0), 0) / total
    assert.ok(dur > avant, `palier ${r.n} plus dur que le précédent`)
    avant = dur
  }
  assert.deepEqual(
    PALIERS.slice(0, 12).map(r => r.seuil),
    Array(12).fill(SEUIL_DES_PALIERS),
    'la même règle partout : douze sur seize',
  )
  assert.equal(SEUIL_DES_PALIERS, 12)
  // Les avatars tous les deux paliers, ceux de `PALIER_DU_PORTRAIT`, le sixième au sommet.
  assert.deepEqual(
    PALIERS.filter(r => r.avatar !== null).map(r => [r.n, r.avatar]),
    PALIER_DU_PORTRAIT.map((n, rang) => [n, rang]),
  )
  // Aucune experte sur un palier à avatar : une loterie qu'on gagnerait à l'usure.
  for (const r of PALIERS.slice(0, 12)) assert.equal(r.melange.expert, undefined, `palier ${r.n} sans experte`)
  const maitre = regleDuPalier(PALIER_DU_MAITRE)!
  assert.deepEqual([maitre.maitre, maitre.seuil, maitre.melange], [true, SEUIL_DU_MAITRE, { expert: 16 }])
  assert.equal(SEUIL_DU_MAITRE, 9)
  // Pas de vrai ou faux dès le cinquième, toute la catégorie dès le neuvième.
  assert.deepEqual(
    PALIERS.map(r => `${r.sansVraiFaux ? 'V' : '-'}${r.touteLaCategorie ? 'T' : '-'}`).join(' '),
    '-- -- -- -- V- V- V- V- VT VT VT VT VT',
  )
  assert.equal(regleDuPalier(0), null)
  assert.equal(regleDuPalier(14), null)
  assert.equal(regleDuPalier('3'), null, 'un palier vient en nombre')
})

test('une épreuve se valide dès le seuil, continue pour les étoiles, s’arrête à la faute de trop', () => {
  assert.equal(issueDe(11, 11, 12), null)
  assert.equal(issueDe(12, 12, 12), 'validee', 'validée dès la douzième bonne réponse')
  assert.equal(epreuveFinie(12, 12, 12), false, 'mais elle continue, pour les étoiles')
  assert.equal(epreuveFinie(12, 16, 12), true)
  assert.equal(issueDe(7, 11, 12), null, 'quatre fautes : on peut encore')
  assert.equal(issueDe(7, 12, 12), 'ratee', 'la cinquième : douze ne sont plus possibles')
  assert.equal(epreuveFinie(7, 12, 12), true)
  // Une, deux, trois étoiles : au seuil, à mi-chemin du sans-faute, au sans-faute.
  assert.deepEqual([11, 12, 13, 14, 15, 16].map(j => etoilesDe(j, 12)), [0, 1, 1, 2, 2, 3])
  assert.deepEqual([8, 9, 12, 13, 15, 16].map(j => etoilesDe(j, 9)), [0, 1, 1, 2, 2, 3])
})

test('douze vies par jour, rendues à minuit ; la réserve achetée sert ensuite, et ne périme pas', () => {
  const jour = '2026-10-05'
  assert.deepEqual(viesDe(new Map(), 0, jour), { jour: VIES_PAR_JOUR, reserve: 0 })
  assert.equal(VIES_PAR_JOUR, BRANCHES.length, 'autant que de sentiers')
  assert.deepEqual(viesDe(new Map([[jour, 3]]), 0, jour), { jour: 9, reserve: 0 })
  // Hier, quatorze échecs : deux vies prises dans la réserve de cinq.
  assert.deepEqual(viesDe(new Map([['2026-10-04', 14]]), 5, jour), { jour: 12, reserve: 3 }, 'celles du jour reviennent, la réserve garde ce qui reste')
  assert.deepEqual(viesDe(new Map([[jour, 15]]), 5, jour), { jour: 0, reserve: 2 })
  assert.deepEqual(viesDe(new Map([[jour, 40]]), 5, jour), { jour: 0, reserve: 0 }, 'jamais sous zéro')
})

test('les portraits d’avant valent leurs paliers, et le maître a son titre', () => {
  assert.deepEqual([0, 1, 3, 6, 9].map(paliersDesPortraits), [0, 2, 6, 12, 12])
  assert.deepEqual(maitresDe({ foret: 13, stade: 12, mythes: 13 }), ['mythes', 'foret'])
  assert.equal(cleDeMaitre('foret'), 'maitre:foret')
  assert.equal(nomDuTitre('maitre:foret'), 'Maître de la forêt')
  assert.equal(nomDuTitre('maitre:stade'), 'Maître du stade')
  assert.equal(nomDuTitre('hf:encyclopedie'), 'L’Encyclopédie', 'un titre de haut fait garde son nom')
  assert.equal(nomDuTitre('maitre:inconnu'), null)
  assert.equal(nomDuTitre(null), null)
})

/** Une question de la base, inventée : `n`, sa difficulté, son sous-thème, et vrai-faux ou non. */
function question(n: number, difficulte: number, sousTheme: string, vraiFaux = false) {
  const lu = lireQuestionDeLaBase({
    id: `q${String(n).padStart(7, '0')}`,
    texte: `La question inventée numéro ${n}, est-ce bien celle-ci ?`,
    reponses: vraiFaux ? ['Vrai', 'Faux'] : [`Bonne ${n}`, `Autre A${n}`, `Autre B${n}`, `Autre C${n}`],
    bonne: 0,
    anecdote: `L'anecdote ${n}.`,
    categorie: 'Nature',
    sousTheme,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date: null,
    entites: [],
    portee: 'monde',
    valeur: null,
    leurres: vraiFaux ? ['Faux'] : [`Autre A${n}`, `Autre B${n}`, `Autre C${n}`],
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(lu.refus)
  return lu.question
}

test('une épreuve tire son mélange, jamais vues d’abord, sans vrai-faux là où le palier n’en veut pas, et toute la catégorie au neuvième', () => {
  const sousThemes = SOUS_THEMES.Nature.map(s => s.cle)
  // Deux cents questions : toutes les difficultés, tous les sous-thèmes, un quart en vrai-faux.
  const base = new BaseDeLaCampagne(Array.from({ length: 200 }, (_, i) => question(i, 1 + (i % 5), sousThemes[i % sousThemes.length], i % 4 === 3)))
  const mesure = new Map()
  const niveauDe = (q: { meta: { difficulte: number } }) => niveauDeQuestion(q.meta.difficulte)

  const p2 = tirerUneEpreuve(base.questions, regleDuPalier(2)!, new Set(), mesure)
  assert.equal(p2.length, 16)
  assert.equal(new Set(p2.map(x => x.question.id)).size, 16, 'seize questions différentes')
  assert.deepEqual(
    [p2.filter(x => x.niveau === 'facile').length, p2.filter(x => x.niveau === 'moyen').length],
    [14, 2],
    'le mélange du deuxième palier',
  )
  for (const x of p2) assert.equal(niveauDe(x.question), x.niveau)

  // Jamais vues d'abord : tout ce qui a été vu passe derrière.
  const vues = new Set(base.questions.filter(q => niveauDe(q) === 'moyen').slice(0, 10).map(q => q.id))
  const p7 = tirerUneEpreuve(base.questions, regleDuPalier(7)!, vues, mesure)
  assert.equal(p7.filter(x => vues.has(x.question.id)).length, 0, 'il reste assez de moyennes jamais vues')
  assert.equal(p7.filter(x => x.question.reponses.length === 2).length, 0, 'pas de vrai-faux au septième')

  // Au neuvième, chaque sous-thème a sa question avant qu'un autre en ait deux.
  const p9 = tirerUneEpreuve(base.questions, regleDuPalier(9)!, new Set(), mesure)
  const parSousTheme = new Map<string, number>()
  for (const x of p9) parSousTheme.set(x.question.meta.sousTheme, (parSousTheme.get(x.question.meta.sousTheme) ?? 0) + 1)
  assert.equal(parSousTheme.size, Math.min(16, sousThemes.length), 'toute la catégorie')
  assert.ok(Math.max(...parSousTheme.values()) - Math.min(...parSousTheme.values()) <= 1, 'aussi également que possible')

  // Une catégorie qui manque d'un niveau emprunte au voisin : l'épreuve se joue quand même.
  const faciles = new BaseDeLaCampagne(Array.from({ length: 20 }, (_, i) => question(i, 1, sousThemes[0])))
  const p12 = tirerUneEpreuve(faciles.questions, regleDuPalier(12)!, new Set(), mesure)
  assert.equal(p12.length, 16)
  // Trop peu de questions : le sentier le dit.
  assert.throws(() => tirerUneEpreuve(faciles.questions.slice(0, 15), regleDuPalier(1)!, new Set(), mesure), /pas encore assez de questions/)
})

test('le sentier qu’on avance : l’épreuve laissée d’abord, sinon le plus haut qui n’est pas au sommet', () => {
  const s = (branche: string, paliers: number) => ({ branche, paliers, acquis: 0, etoiles: [] }) as unknown as SentierDuJoueur
  assert.equal(sentierQuOnAvance([s('foret', 0), s('stade', 0)], null), null, 'rien de commencé')
  assert.deepEqual(sentierQuOnAvance([s('foret', 3), s('scene', 7), s('stade', 7)], null), { branche: 'scene', palier: 8, laissee: false }, 'le plus haut ; à égalité, le premier des branches')
  // Le maître est facultatif : un sentier au sommet n'attend plus rien.
  assert.deepEqual(sentierQuOnAvance([s('foret', 12), s('scene', 2), s('stade', PALIER_DU_MAITRE)], null), { branche: 'scene', palier: 3, laissee: false })
  assert.equal(sentierQuOnAvance([s('foret', 12), s('stade', PALIER_DU_MAITRE)], null), null)
  assert.deepEqual(
    sentierQuOnAvance([s('stade', 7)], { branche: 'foret', palier: PALIER_DU_MAITRE }),
    { branche: 'foret', palier: PALIER_DU_MAITRE, laissee: true },
    'l’épreuve laissée d’abord, celle du maître comprise',
  )
})

// ── Sur le serveur ─────────────────────────────────────────────────────────

/** Samedi 26 septembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)

type Reponse = { status: number; corps: any }
const lire = (banc: Banc, cookie: string, chemin: string): Promise<Reponse> =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: await r.json() }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}): Promise<Reponse> =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: await r.json() }))

/** La bonne réponse d'une question de `baseDEssai` : celle qui commence par « Bonne ». */
const bonneDe = (q: { reponses: string[] }) => q.reponses.findIndex(r => r.startsWith('Bonne'))

/**
 * Joue une épreuve : `justes` bonnes réponses d'abord, puis des fautes,
 * jusqu'à sa fin. Rend la dernière réponse du serveur.
 */
async function jouer(banc: Banc, cookie: string, epreuve: any, justes: number): Promise<any> {
  let e = epreuve
  let derniere: any = null
  let i = 0
  while (!e.finie && e.question) {
    const q = e.question
    assert.equal(q.bonne, undefined, 'jamais la bonne réponse avant la sienne')
    const choix = i < justes ? bonneDe(q) : (bonneDe(q) + 1) % q.reponses.length
    const r = await poster(banc, cookie, `/api/campagne/epreuve/${e.id}/reponse`, { index: q.index, choix })
    assert.equal(r.status, 200, r.corps.error)
    derniere = r.corps
    e = r.corps.epreuve
    i++
  }
  return derniere
}

async function avecBanc(scenario: (banc: Banc, horloge: { t: number }) => Promise<void>) {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(120, { categories: ['Nature'] }) })
  try {
    await scenario(banc, horloge)
  } finally {
    await banc.close()
  }
}

test('un sentier se gravit palier par palier : seize questions, douze pour valider, un portrait au deuxième', () =>
  avecBanc(async banc => {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const etat = (await lire(banc, lea, '/api/campagne/sentiers')).corps
    assert.deepEqual([etat.vies.jour, etat.vies.reserve, etat.vies.parJour], [VIES_PAR_JOUR, 0, VIES_PAR_JOUR])
    assert.equal(etat.sentiers.length, BRANCHES.length)
    assert.ok(etat.sentiers.every((s: any) => s.paliers === 0 && s.acquis === 0))
    assert.equal(etat.epreuve, null)

    // On ne saute pas de palier.
    const saut = await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 2 })
    assert.equal(saut.status, 400)
    assert.equal(saut.corps.error, 'Valide d’abord le palier 1')
    assert.equal((await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'jardin', palier: 1 })).corps.error, 'Ce sentier n’existe pas')

    // Le premier palier, sans faute : trois étoiles, rien à porter encore.
    const p1 = (await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 1 })).corps
    assert.deepEqual([p1.palier, p1.seuil, p1.total, p1.rejeu, p1.question.index], [1, 12, 16, false, 0])
    const fin1 = await jouer(banc, lea, p1, 16)
    assert.deepEqual([fin1.epreuve.issue, fin1.epreuve.finie, fin1.etoiles, fin1.avatar], ['validee', true, 3, undefined])
    assert.equal(fin1.xp, XP_PAR_JUSTE, 'une bonne réponse paie comme dans la série')

    // Le deuxième, à treize : validé à la douzième, l'épreuve va au bout, et le portrait tombe à la fin.
    const p2 = (await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 2 })).corps
    let e = p2
    let validee: any = null
    for (let i = 0; i < 12; i++) {
      const r = await poster(banc, lea, `/api/campagne/epreuve/${e.id}/reponse`, { index: e.question.index, choix: bonneDe(e.question) })
      e = r.corps.epreuve
      validee = r.corps
    }
    assert.deepEqual([validee.epreuve.issue, validee.epreuve.finie], ['validee', false], 'validée à douze, elle continue')
    const fin2 = await jouer(banc, lea, e, 1)
    assert.deepEqual([fin2.epreuve.justes, fin2.etoiles, fin2.avatar], [13, 1, 'br:ecureuil'])
    // L'écureuil se porte : le serveur l'accorde sur ses paliers.
    const porte = await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'br:ecureuil' }, lea, 'PUT')
    assert.equal(porte.status, 200)
    const lynx = await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'br:lynx' }, lea, 'PUT')
    assert.equal(((await lynx.json()) as any).error, 'Ce portrait se gagne au palier 6 du sentier de la forêt')

    // Ses sentiers le disent, avec les étoiles de chaque palier.
    const apres = (await lire(banc, lea, '/api/campagne/sentiers')).corps
    const foret = apres.sentiers.find((s: any) => s.branche === 'foret')
    assert.deepEqual([foret.paliers, foret.acquis, foret.etoiles.slice(0, 3)], [2, 0, [3, 1, 0]])
    assert.equal(apres.vies.jour, VIES_PAR_JOUR, 'aucune vie perdue')
    assert.equal(apres.confettis, 29, 'un confetti par bonne réponse')

    // Rejoué, le deuxième palier ne risque rien — et une meilleure note se dit.
    const rejeu = (await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 2 })).corps
    assert.equal(rejeu.rejeu, true)
    const finRejeu = await jouer(banc, lea, rejeu, 15)
    assert.deepEqual([finRejeu.etoiles, finRejeu.record, finRejeu.avatar], [2, true, undefined], 'pas de second portrait')
    const rate = await jouer(banc, lea, (await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 1 })).corps, 0)
    assert.deepEqual([rate.epreuve.issue, rate.epreuve.fausses, rate.vies], ['ratee', 5, undefined], 'raté en rejeu : rien de perdu')
    assert.equal((await lire(banc, lea, '/api/campagne/sentiers')).corps.vies.jour, VIES_PAR_JOUR)
  }))

test('l’accueil dit ses vies et le sentier qu’il avance, lus avec le reste', () =>
  avecBanc(async banc => {
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const accueil = async () => (await lire(banc, tom, '/api/joueur/moi?accueil')).corps.profile.campagne
    assert.deepEqual(await accueil(), { vies: VIES_PAR_JOUR, avance: null }, 'rien de commencé')
    // L'épreuve laissée en cours, c'est elle qui l'attend.
    const p1 = (await poster(banc, tom, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 1 })).corps
    assert.deepEqual(await accueil(), { vies: VIES_PAR_JOUR, avance: { branche: 'foret', palier: 1, laissee: true } })
    // Validée : le palier suivant.
    await jouer(banc, tom, p1, 16)
    assert.deepEqual(await accueil(), { vies: VIES_PAR_JOUR, avance: { branche: 'foret', palier: 2, laissee: false } })
    // Ratée : une vie de moins, et le même palier qui l'attend.
    await jouer(banc, tom, (await poster(banc, tom, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 2 })).corps, 0)
    assert.deepEqual(await accueil(), { vies: VIES_PAR_JOUR - 1, avance: { branche: 'foret', palier: 2, laissee: false } })
    // Ce sont les vies de la page des sentiers.
    const etat = (await lire(banc, tom, '/api/campagne/sentiers')).corps
    assert.equal(etat.vies.jour + etat.vies.reserve, VIES_PAR_JOUR - 1)
  }))

test('un palier raté coûte une vie, abandonner aussi ; une épreuve à la fois', () =>
  avecBanc(async banc => {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    // Raté à la cinquième faute : l'épreuve s'arrête là, une vie de moins.
    const p1 = (await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 1 })).corps
    const rate = await jouer(banc, lea, p1, 3)
    assert.deepEqual([rate.epreuve.issue, rate.epreuve.finie, rate.epreuve.justes, rate.epreuve.fausses], ['ratee', true, 3, 5])
    assert.equal(rate.vies.jour, VIES_PAR_JOUR - 1)

    // Une épreuve à la fois : celle qu'on a laissée attend.
    const ouverte = (await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 1 })).corps
    const r1 = await poster(banc, lea, `/api/campagne/epreuve/${ouverte.id}/reponse`, { index: 0, choix: bonneDe(ouverte.question) })
    assert.equal(r1.status, 200)
    const autre = await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'stade', palier: 1 })
    assert.equal(autre.corps.error, 'Une épreuve t’attend : le palier 1 du sentier de la forêt. Finis-la, ou abandonne-la.')
    // Elle reprend où on l'a laissée, telle quelle.
    const reprise = (await lire(banc, lea, '/api/campagne/sentiers')).corps.epreuve
    assert.deepEqual([reprise.id, reprise.justes, reprise.question.index], [ouverte.id, 1, 1])
    const memeChose = (await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 1 })).corps
    assert.equal(memeChose.id, ouverte.id)

    // Le voisin n'en sait rien (invariant 3), et une réponse périmée ne compte pas.
    const intrus = await poster(banc, bob, `/api/campagne/epreuve/${ouverte.id}/reponse`, { index: 1, choix: 0 })
    assert.equal(intrus.corps.error, 'Cette épreuve est introuvable')
    assert.equal((await poster(banc, lea, `/api/campagne/epreuve/${ouverte.id}/reponse`, { index: 0, choix: 0 })).corps.error, 'Cette question est passée : l’épreuve a continué sans elle')
    // Une épreuve ne se répond pas comme une série, ni l'inverse.
    assert.equal((await poster(banc, lea, `/api/campagne/serie/${ouverte.id}/reponse`, { index: 1, choix: 0 })).corps.error, 'Cette série est introuvable')

    // Abandonner un palier en jeu : une vie, comme un échec — sinon on fermerait l'application à la dixième faute.
    const abandon = await poster(banc, lea, `/api/campagne/epreuve/${ouverte.id}/abandon`)
    assert.equal(abandon.status, 200)
    assert.deepEqual([abandon.corps.vies.jour, abandon.corps.epreuve], [VIES_PAR_JOUR - 2, null])
    assert.equal((await poster(banc, lea, `/api/campagne/epreuve/${ouverte.id}/reponse`, { index: 1, choix: 0 })).corps.error, 'Cette épreuve est finie')

    // La série à trois vies reste à part : elle n'a rien vu de tout ça.
    const campagne = (await lire(banc, lea, '/api/campagne')).corps
    assert.deepEqual([campagne.series, campagne.enCours], [0, null])
  }))

test('au sommet, le cerf ; puis le palier de maître, seize expertes à neuf, et son titre sous le prénom', () =>
  avecBanc(async banc => {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const id = (await lire(banc, lea, '/api/joueur/moi?leger')).corps.profile.id as string
    // Onze paliers de la forêt, déjà : posés comme la reprise les écrit.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      db.prepare(`INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, 'foret', 11, 1)`).run(id)
    } finally {
      db.close()
    }
    // Le maître attend le sommet.
    assert.equal((await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 13 })).corps.error, 'Valide d’abord le palier 12')
    const sommet = await jouer(banc, lea, (await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 12 })).corps, 12)
    assert.deepEqual([sommet.epreuve.issue, sommet.avatar, sommet.maitre], ['validee', 'br:cerf', undefined])

    // Le palier de maître : seize expertes, neuf suffisent — l'épreuve va au bout.
    const maitre = (await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 13 })).corps
    assert.deepEqual([maitre.seuil, maitre.total, maitre.question.niveau], [9, 16, 'expert'])
    const fin = await jouer(banc, lea, maitre, 9)
    assert.deepEqual([fin.epreuve.issue, fin.epreuve.finie, fin.etoiles, fin.maitre, fin.avatar], ['validee', true, 1, 'Maître de la forêt', undefined])

    // Son titre se porte, sous le prénom ; celui d'un autre sentier, non.
    const porte = await ecrire(banc.url, '/api/joueur/moi', { titre: 'maitre:foret' }, lea, 'PUT')
    assert.equal(porte.status, 200)
    assert.equal(((await porte.json()) as any).profile.titre, 'maitre:foret')
    const stade = await ecrire(banc.url, '/api/joueur/moi', { titre: 'maitre:stade' }, lea, 'PUT')
    assert.equal(((await stade.json()) as any).error, 'Ce titre se gagne au palier de maître du sentier du stade')
    const sentier = (await lire(banc, lea, '/api/campagne/sentiers')).corps.sentiers.find((x: any) => x.branche === 'foret')
    assert.deepEqual([sentier.paliers, sentier.acquis, sentier.etoiles[11], sentier.etoiles[12]], [13, 11, 1, 1])
  }))
