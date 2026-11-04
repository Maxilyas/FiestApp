// La page du Cabinet de curiosités au QG (`/admin#cabinet`, le 4 novembre 2026) et « Rendre une traversée bloquée » :
// la page se dérive des résumés des traversées (`cabinet_traversees.resume`), pure, en tranches comme d'une traite ; un
// résumé s'écrit dans le lot qui finit sa traversée, et une traversée finie avant la colonne se résume une fois, à la
// première page qui la lit ; les jours finis se lisent une fois et se gardent jusqu'au minuit suivant ; des joueurs,
// rien que le prénom et l'identifiant. Rendre une traversée la referme là où elle en est, sans rien coûter ni donner —
// son épreuve en cours avec elle, que plus rien ne paie —, jamais une autre que celle montrée, ni celle dont le
// légendaire attend ; une traversée illisible se rend aussi.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import React from 'react'
import { connexionAnimateur, inscrireProfil } from './banc'
import { aLaMain, bancDuCabinet, enBase, fermerLesMagasins, jouer, lire, ok, poster, type BancDuCabinet } from './cabinet-banc'
import { enTranches } from '../src/core/tourniquet'
import { GESTE_CROISE, SON_LEGENDAIRE_L_ATTEND, UNE_AUTRE_TRAVERSEE } from '../src/core/cabinet/magasin'
import { lotDeLaTraverseeQuiCommence, lotDeLaTraverseeRendue } from '../src/core/cabinet/ecriture'
import { lectureDesPiecesDesParties, lectureDesTraverseesFinies, lecturesDeLaTraverseeEnRoute, lecturesDesTraverseesVivantes } from '../src/core/cabinet/tables'
import { dUneTraite } from '../../shared/tranches'
import { jourDe } from '../../shared/jour'
import { dureeCourteEcrite, minuitsDeParis, type GesteDuQg } from '../../shared/qg'
import { idDeLaFiche, idDeLaReplique, idDuLieu } from '../../shared/cabinet/pieces'
import { lireLeResume, resumeDeLaTraversee, VERSION_DU_RESUME, type ResumeDeLaTraversee } from '../../shared/cabinet/resume'
import {
  DUREE_D_UNE_MANCHE_MAX_MS,
  etatDeLaTraversee,
  jouerUnGesteDeLaTraversee,
  lireUnGesteDeLaTraversee,
  tracerLaCarte,
  type DepartDeLaTraversee,
  type EtatDeLaTraversee,
  type GesteDeLaTraversee,
} from '../../shared/cabinet/traversee'
import {
  JOURS_DU_CABINET,
  etatDeLaTraverseeEnRoute,
  indicesLus,
  kmDeLEpingle,
  nommerLaPage,
  ouElleEnEst,
  pageDuCabinetEnTranches,
  peutSeRendre,
  profilsANommer,
  type EntreesDeLaPage,
  type PageANommer,
  type PageDuCabinetAuQg,
  type PieceAuQg,
  type TraverseeAuQg,
} from '../../shared/qgCabinet'
import { legendaire } from '../../shared/legendaires'
import type { FicheDuJoueur } from '../../shared/profil'
import type { PageDeLaTraversee, VueDeLaPartie, VueDeLaTraversee } from '../../shared/cabinet/vues'

const H = 3_600_000
const JOUR = 24 * H
const GARDIENS: [string, string, string] = ['lg:renard', 'lg:sphinx', 'lg:dragon']
const PREFIXES = { lieu: idDuLieu(''), fiche: idDeLaFiche(''), replique: idDeLaReplique('') }

// ── Les dérivations, pures ──────────────────────────────────────────────────

/** Un résumé de traversée, ses gardiens d'office et trois cartes. */
function resume(r: Partial<ResumeDeLaTraversee> = {}): ResumeDeLaTraversee {
  return {
    v: VERSION_DU_RESUME,
    acte: 0,
    ou: 'carte',
    gardiens: [...GARDIENS],
    vaincus: [],
    assauts: [0, 0, 0],
    cartes: [
      { cle: 'parade', niveau: 1 },
      { cle: 'cagnotte', niveau: 1 },
      { cle: 'panacee', niveau: 1 },
    ],
    or: 0,
    coeurs: 4,
    coeursMax: 5,
    epreuves: [],
    maitrises: [],
    defis: 0,
    dernier: null,
    ...r,
  }
}

/**
 * Les traversées d'un mois inventé et les pièces de leurs épreuves : une de chaque issue, trois en route — dont une
 * illisible, et une dont le légendaire attend —, le 4 novembre 2026 à midi, à Paris.
 */
function unMoisDeTraversees(): EntreesDeLaPage {
  // Le 4 novembre 2026, midi à Paris : trente jours, le plus ancien d'abord.
  const maintenant = Date.UTC(2026, 10, 4, 11, 0)
  const minuits = minuitsDeParis(maintenant, JOURS_DU_CABINET)
  const [depuis, aujourdhui] = [minuits[0], minuits[minuits.length - 1]]
  const t = (o: Partial<TraverseeAuQg> & Pick<TraverseeAuQg, 'id' | 'profileId' | 'commenceeLe'>): TraverseeAuQg => ({ finieLe: null, issue: null, legendaire: null, resume: resume(), ...o })
  const traversees: TraverseeAuQg[] = [
    // Gagnée par p1, le légendaire du Sphinx — ses trois gardiens vaincus, le Sphinx en maître.
    t({
      id: 'A',
      profileId: 'p1',
      commenceeLe: minuits[27] + 2 * H,
      finieLe: minuits[27] + 3 * H,
      issue: 'gagnee',
      legendaire: 'lg:sphinx',
      resume: resume({
        acte: 2,
        ou: 'legendaire',
        vaincus: [...GARDIENS],
        assauts: [1, 1, 1],
        maitrises: ['lg:sphinx'],
        dernier: minuits[27] + 3 * H,
        epreuves: [
          { partie: 'a1', jeu: 'pari', acte: 0, etoiles: [3, 2, 0], durees: [20_000, 30_000, 40_000], aides: { eclairer: 1, changer: 0, temps: 0 } },
          { partie: 'a2', jeu: 'epingle', acte: 1, etoiles: [1, 0, null], quittee: true, aides: { eclairer: 0, changer: 0, temps: 0 } },
          { partie: 'a3', jeu: 'quiz', acte: 2, gardien: true, theme: 'Histoire', etoiles: [3, 3, 3], vaincu: true },
        ],
      }),
    }),
    // Perdue par p2 à l'acte II, le même jour ; d'autres cartes.
    t({
      id: 'B',
      profileId: 'p2',
      commenceeLe: minuits[27] + 4 * H,
      finieLe: minuits[27] + 6 * H,
      issue: 'perdue',
      resume: resume({
        acte: 1,
        vaincus: ['lg:renard'],
        assauts: [1, 2, 0],
        cartes: [
          { cle: 'parade', niveau: 2 },
          { cle: 'coup-d-oeil', niveau: 1 },
          { cle: 'echange', niveau: 1 },
        ],
        epreuves: [{ partie: 'b1', jeu: 'epingle', acte: 0, etoiles: [0, 0, 1], perdue: true }],
      }),
    }),
    // Abandonnée par p1 avant même ses cartes, le lendemain.
    t({ id: 'C', profileId: 'p1', commenceeLe: minuits[28] + H, finieLe: minuits[28] + H + 30 * 60_000, issue: 'abandonnee', resume: resume({ ou: 'cartes', cartes: [] }) }),
    // Rendue au QG ce matin : ni gagnée, ni perdue, ni abandonnée.
    t({ id: 'D', profileId: 'p3', commenceeLe: minuits[28] + 5 * H, finieLe: aujourdhui + 3 * H, issue: 'rendue' }),
    // En route depuis quarante jours, ses trois gardiens vaincus — son légendaire l'attend : hors du mois, mais en route.
    t({ id: 'E', profileId: 'p4', commenceeLe: depuis - 10 * JOUR, resume: resume({ acte: 2, ou: 'legendaire', vaincus: [...GARDIENS], dernier: minuits[5] }) }),
    // En route, illisible pour ce code : elle passe devant les autres.
    t({ id: 'F', profileId: 'p5', commenceeLe: aujourdhui + H, resume: null }),
    // En route, en pleine épreuve du Mot.
    t({ id: 'G', profileId: 'p2', commenceeLe: aujourdhui + 30 * 60_000, resume: resume({ ou: 'epreuve', enJeu: 'mot', dernier: aujourdhui + 2 * H }) }),
  ]
  const piece = (partie: string, id: string, juste: boolean, composee: string | null): PieceAuQg => ({ partie, id, juste, composee })
  const pieces: PieceAuQg[] = [
    piece('a2', idDuLieu('lyon'), false, '45.7,4.8|120'),
    piece('a2', idDuLieu('lyon'), false, '45.7,4.8|300'),
    piece('b1', idDuLieu('lyon'), true, '45.7,4.8|20'),
    // Deux fois seulement : en dessous de trois, un échec dit le joueur, pas le contenu.
    piece('a2', idDuLieu('brest'), false, '48.4,-4.5|80'),
    piece('b1', idDuLieu('brest'), false, '48.4,-4.5|90'),
    piece('a1', idDeLaFiche('chopin'), true, '2|0'),
    piece('a1', idDeLaFiche('chopin'), false, '4|1'),
    piece('a1', idDeLaFiche('chopin'), true, '3|0'),
    piece('b1', idDeLaReplique('r1'), false, null),
    piece('b1', idDeLaReplique('r1'), false, null),
    piece('b1', idDeLaReplique('r1'), false, null),
    // La pièce d'une partie qu'aucune traversée du mois ne nomme : elle ne compte pas.
    piece('ailleurs', idDuLieu('lyon'), false, '45.7,4.8|900'),
  ]
  return {
    traversees,
    pieces,
    signalements: new Map([['pari', 2]]),
    noms: { lieux: new Map([['lyon', 'Lyon']]), fiches: new Map([['chopin', 'Frédéric Chopin']]), repliques: new Map([['r1', '« Bonjour » — Moi']]) },
    minuits,
    maintenant,
  }
}

/** Ses profils nommés, sauf p3, supprimé depuis ; p5 suspendu ; p1 tient quatre rangs de défis et une épreuve de maître. */
function nommerLeMois(page: PageANommer): PageDuCabinetAuQg {
  const nom = (id: string) => ({ id, nom: `Nom ${id}`, login: id, suspendu: id === 'p5' })
  return nommerLaPage(page, new Map(['p1', 'p2', 'p4', 'p5'].map(id => [id, nom(id)])), new Map([['p1', { rangs: 4, maitrises: 1 }]]))
}

test('la page se dérive des traversées et des pièces de leurs épreuves : chaque section, en tranches comme d’une traite, puis nommée', async () => {
  const e = unMoisDeTraversees()
  const { maintenant } = e
  const page = dUneTraite(pageDuCabinetEnTranches(e, PREFIXES))
  assert.deepEqual(await enTranches(pageDuCabinetEnTranches(e, PREFIXES)), page, 'en tranches, la même page')

  assert.equal(page.jours.length, JOURS_DU_CABINET)
  assert.equal(page.jours.at(-1), jourDe(maintenant))
  // Les traversées du mois : toutes sauf E, commencée avant ; chaque profil une fois.
  assert.deepEqual(page.totaux, { joueurs: 4, commencees: 6, gagnees: 1, perdues: 1, abandonnees: 1, rendues: 1, enRoute: 2, epreuves: 4, dureeMediane: H })
  assert.deepEqual(page.parJour[27], { jour: page.jours[27], gagnee: 1, perdue: 1, abandonnee: 0, rendue: 0, 'en-route': 0 })
  assert.deepEqual(page.parJour[28], { jour: page.jours[28], gagnee: 0, perdue: 0, abandonnee: 1, rendue: 1, 'en-route': 0 })
  assert.deepEqual(page.parJour[29], { jour: page.jours[29], gagnee: 0, perdue: 0, abandonnee: 0, rendue: 0, 'en-route': 2 })
  assert.deepEqual(
    page.entonnoir.map(m => [m.marche, m.n]),
    [
      ['commencee', 6],
      ['cartes', 4],
      ['acte1', 2],
      ['acte2', 1],
      ['acte3', 1],
      ['legendaire', 1],
    ],
  )
  assert.deepEqual(page.chutes, [
    { acte: 0, perdues: 0, abandonnees: 1 },
    { acte: 1, perdues: 1, abandonnees: 0 },
    { acte: 2, perdues: 0, abandonnees: 0 },
  ])
  // Celles en route, de tout âge : l'illisible d'abord, puis celle qui a bougé en dernier.
  assert.equal(page.enRouteEnTout, 3)
  assert.deepEqual(
    page.enRoute.map(r => [r.id, r.ou?.sorte ?? null, r.ou?.enJeu ?? null]),
    [
      ['F', null, null],
      ['G', 'epreuve', 'mot'],
      ['E', 'legendaire', null],
    ],
  )
  const jeu = (cle: string) => page.jeux.find(j => j.jeu === cle)!
  assert.deepEqual(jeu('pari'), { jeu: 'pari', epreuves: 1, assauts: 0, manches: 3, reussies: 2, etoiles: 5, duree: 30_000, quittees: 0, avecAides: 1, eclairees: 1, signalements: 2 })
  assert.deepEqual(jeu('epingle'), { jeu: 'epingle', epreuves: 2, assauts: 0, manches: 5, reussies: 2, etoiles: 2, duree: null, quittees: 1, avecAides: 1, eclairees: 0, signalements: null })
  assert.deepEqual(jeu('quiz'), { jeu: 'quiz', epreuves: 1, assauts: 1, manches: 3, reussies: 3, etoiles: 9, duree: null, quittees: 0, avecAides: 0, eclairees: 0, signalements: null })
  // Le Mot se signale — ses questions sont de la base — : zéro, pas « sans objet ».
  assert.equal(jeu('mot').signalements, 0)
  assert.equal(page.jeux.length, 10, 'les dix jeux, joués ou non')
  assert.deepEqual(
    page.cartes.map(c => [c.cle, c.choisie, c.finies, c.gagnees]),
    [
      ['parade', 4, 2, 1],
      ['cagnotte', 3, 1, 1],
      ['panacee', 3, 1, 1],
      ['coup-d-oeil', 1, 1, 0],
      ['echange', 1, 1, 0],
    ],
  )
  assert.deepEqual(page.legendaires, [{ cle: 'lg:sphinx', n: 1 }])
  assert.deepEqual(
    page.gardiens.map(g => [g.acte, g.cle, g.tire, g.affronte, g.vaincu, g.maitrise]),
    [
      [0, 'lg:renard', 5, 2, 2, 0],
      [1, 'lg:sphinx', 5, 2, 1, 1],
      [2, 'lg:dragon', 5, 1, 1, 0],
    ],
  )
  assert.deepEqual(page.contenu.epingle, [{ id: 'lyon', nom: 'Lyon', joues: 3, trouves: 1, km: 120 }])
  assert.deepEqual(page.contenu.indices, [{ id: 'chopin', nom: 'Frédéric Chopin', joues: 3, trouves: 2, indices: 3 }])
  assert.deepEqual(page.contenu.repliques, [{ id: 'r1', nom: '« Bonjour » — Moi', joues: 3, trouves: 0 }])
  assert.deepEqual(page.contenu.quiz, [{ theme: 'Histoire', epreuves: 1, manches: 3, reussies: 3 }])
  assert.deepEqual(
    page.joueurs.map(j => [j.profileId, j.traversees, j.gagnees, j.epreuves]),
    [
      ['p1', 2, 1, 3],
      ['p2', 2, 0, 1],
      ['p3', 1, 0, 0],
      ['p5', 1, 0, 0],
    ],
  )
  assert.equal(page.joueursEnTout, 4)

  // Nommée : chacun par son prénom et son identifiant ; un profil supprimé depuis ne se nomme pas, sa ligne part.
  assert.deepEqual(profilsANommer(page).sort(), ['p1', 'p2', 'p3', 'p4', 'p5'])
  const nommee = nommerLeMois(page)
  assert.deepEqual(
    nommee.joueurs.map(j => [j.profil.id, j.rangs, j.maitrises]),
    [
      ['p1', 4, 1],
      ['p2', 0, 0],
      ['p5', 0, 0],
    ],
  )
  assert.deepEqual(
    nommee.enRoute.map(r => [r.id, r.profil.login, r.profil.suspendu]),
    [
      ['F', 'p5', true],
      ['G', 'p2', false],
      ['E', 'p4', false],
    ],
  )
  assert.ok(!('profileId' in nommee.enRoute[0]) && !('profileId' in nommee.joueurs[0]), 'nommée, une ligne ne porte plus que son profil')
})

test('la page à l’écran : chaque section, « Rendre » sur ce qui se rend, les gardiens et les cartes par leur nom — rien d’un Divin', async () => {
  Object.assign(globalThis, { React, window: { location: { pathname: '/admin', search: '', hash: '#cabinet', origin: 'http://banc' } } })
  const { CabinetAuQg } = await import(new URL('../../client/src/components/QgCabinet.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html = renderToStaticMarkup(React.createElement(CabinetAuQg, { page: nommerLeMois(dUneTraite(pageDuCabinetEnTranches(unMoisDeTraversees(), PREFIXES))) }))
  for (const titre of ['Ces trente jours', 'Jour par jour', 'Les traversées en route', 'Du départ au légendaire', 'Où l’on tombe', 'Les jeux', 'Les cartes', 'Le légendaire choisi', 'Les gardiens', 'Les joueurs', 'Ce qu’on y fait']) {
    assert.ok(html.includes(`>${titre}</h2>`), titre)
  }
  // « Rendre » sur celles qui se rendent — l'illisible comprise —, jamais sur celle dont le légendaire attend.
  assert.deepEqual([...html.matchAll(/aria-label="Rendre la traversée de ([^"]+)"/g)].map(m => m[1]), ['Nom p5', 'Nom p2'])
  for (const cle of [...GARDIENS, 'lg:sphinx']) assert.ok(html.includes(legendaire(cle)!.nom), cle)
  for (const nom of ['Parade', 'Cagnotte', 'Le Pari', 'L’Épingle', 'Lyon', 'Frédéric Chopin']) assert.ok(html.includes(nom), nom)
  // Les issues en couleurs d'état, la pile dans l'ordre vérifié : jamais une couleur de mode sur une issue.
  assert.match(html, /qg-cabinet-gagnee/)
  assert.doesNotMatch(html, /qg-mode-(soiree|campagne|jour|duel)/)
  for (const rien of [/divin/i, /undefined/, /NaN/, /\[object Object\]/]) assert.doesNotMatch(html, rien)
})

test('où en est une traversée, en mots : la page, la fiche et le journal la disent pareil', () => {
  assert.equal(ouElleEnEst({ acte: 1, sorte: 'epreuve', enJeu: 'pari' }), 'Acte II, en pleine épreuve (Le Pari)')
  assert.equal(ouElleEnEst({ acte: 2, sorte: 'gardien', enJeu: 'epingle' }), 'Acte III, face à son gardien (L’Épingle)')
  assert.equal(ouElleEnEst({ acte: 2, sorte: 'gardien', enJeu: null }), 'Acte III, devant son gardien')
  assert.equal(ouElleEnEst({ acte: 0, sorte: 'cartes', enJeu: null }), 'au choix de ses cartes')
  assert.equal(ouElleEnEst({ acte: 0, sorte: 'coffre', enJeu: null }), 'Acte I, au coffre')
  assert.equal(ouElleEnEst({ acte: 1, sorte: 'marchand', enJeu: null }), 'Acte II, chez le marchand')
  assert.equal(ouElleEnEst({ acte: 0, sorte: 'carte', enJeu: null }), 'Acte I, sur la carte')
  const ou = { acte: 1 as const, sorte: 'carte' as const, enJeu: null, gardien: 'lg:sphinx', coeurs: 1, coeursMax: 5, or: 42, epreuves: 3 }
  assert.equal(etatDeLaTraverseeEnRoute({ ou }), 'Acte II, sur la carte · 1 cœur sur 5 · 42 pièces d’or')
  assert.equal(etatDeLaTraverseeEnRoute({ ou: null }), 'illisible sur ce serveur — elle bloque sûrement')
  // Ses trois gardiens à terre, rien ne bloque : la rendre lui prendrait son légendaire.
  assert.equal(peutSeRendre({ ou: { ...ou, sorte: 'legendaire' } }), false)
  assert.equal(peutSeRendre({ ou }), true)
  assert.equal(peutSeRendre({ ou: null }), true, 'illisible, elle se rend : c’est elle qui bloque le plus sûrement')
  // Ce que les pièces ont gardé : la distance d'une épingle, les indices lus d'une fiche ; rien de travers.
  assert.equal(kmDeLEpingle('45.7,4.8|119.6'), 119.6)
  for (const casse of [null, '', '45.7,4.8', '45.7,4.8|', '45.7,4.8|loin', '45.7,4.8|-3']) assert.equal(kmDeLEpingle(casse), null, String(casse))
  assert.equal(indicesLus('3|1'), 3)
  for (const casse of [null, '', 'x|1', '1.5|0', '-1|0']) assert.equal(indicesLus(casse), null, String(casse))
  // Le temps d'une manche, en secondes : « moins d'une minute » n'en dirait rien ; insécable, il ne se coupe pas.
  const lu = (ms: number) => dureeCourteEcrite(ms).replace(/ /g, ' ')
  assert.deepEqual([lu(42_400), lu(60_000), lu(65_000), lu(3_599_000), lu(-5)], ['42 s', '1 min', '1 min 5 s', '59 min 59 s', '0 s'])
  assert.doesNotMatch(dureeCourteEcrite(65_000), / /)
})

/** Une carte tracée au hasard d'une graine, à la version 1 — sans assauts tirés, comme une traversée d'avant le 3 novembre 2026. */
function departDe(graine: number): DepartDeLaTraversee {
  let x = graine
  const hasard = () => ((x = (x * 16807) % 2147483647) / 2147483647)
  return { v: 1, jour: '2026-10-24', actes: tracerLaCarte(hasard, GARDIENS, { epingle: ['Rome'], frise: ['Rome'] }).map(({ assauts: _, ...a }) => a) }
}

/**
 * Les gestes d'une traversée jouée jusqu'à ce que `arret` dise stop, comme le serveur les aurait écrits : chaque épreuve
 * conclue sans faute — le temps de ses manches et son « Quitter ? » quand `conclusion` les donne —, chaque amélioration
 * offerte à la première carte qui monte encore.
 */
function gestesJusqua(
  depart: DepartDeLaTraversee,
  arret: (e: EtatDeLaTraversee) => boolean,
  conclusion: (n: number) => Partial<Extract<GesteDeLaTraversee, { quoi: 'conclure' }>> = () => ({}),
): GesteDeLaTraversee[] {
  const gestes: GesteDeLaTraversee[] = [{ quoi: 'cartes', cartes: ['cagnotte', 'parade', 'panacee'] }]
  const etat = () => etatDeLaTraversee(depart, gestes.map(geste => ({ geste, faitLe: 0 })))
  let e = etat()
  let p = 0
  while (!arret(e)) {
    if (e.ameliorations > 0) gestes.push({ quoi: 'ameliorer', carte: e.cartes.find(c => c.niveau < 3)!.cle })
    else {
      const ici = depart.actes[e.acte].etapes
      const suivantes = e.ou.sorte === 'gardien' ? [e.ou.etape] : ici.find(s => s.id === e.position)!.suivantes
      const etape = ici.find(s => s.id === (suivantes.find(id => ici.find(s => s.id === id)?.sorte === 'epreuve') ?? suivantes[0]))!
      if (etape.sorte === 'coffre' || etape.sorte === 'marchand') gestes.push({ quoi: 'aller', etape: etape.id })
      else {
        const partie = `fausse-${depart.actes[0].etapes[0].id}-${++p}`
        gestes.push({ quoi: 'epreuve', etape: etape.id, partie }, { quoi: 'conclure', partie, manches: [3, 3, 3].map(etoiles => ({ etoiles, misee: false })), ...conclusion(p) })
      }
    }
    e = etat()
  }
  assert.equal(e.ignores, 0)
  return gestes
}

test('le résumé d’une traversée se refait de son pli et se relit à sa forme ; « rendre » ne vient que du serveur', () => {
  const depart = departDe(7)
  // Deux épreuves conclues : la première dit le temps de ses manches et qu'il l'a quittée, la seconde rien — une d'avant.
  const gestes = gestesJusqua(
    depart,
    e => e.epreuves >= 2,
    n => (n === 1 ? { durees: [12_000, 30_000, null], quittee: true } : {}),
  )
  const ecrits = gestes.map((geste, k) => ({ geste, faitLe: 1_000 + k }))
  const r = resumeDeLaTraversee(depart, ecrits)
  assert.equal(r.v, VERSION_DU_RESUME)
  assert.deepEqual(r.gardiens, GARDIENS)
  assert.equal(r.epreuves.length, 2)
  assert.deepEqual(r.epreuves[0].durees, [12_000, 30_000, null])
  assert.equal(r.epreuves[0].quittee, true)
  assert.equal(r.epreuves[1].durees, undefined, 'une conclusion d’avant ne dit pas le temps')
  assert.deepEqual(
    r.cartes.map(c => c.cle),
    ['cagnotte', 'parade', 'panacee'],
  )
  assert.equal(r.dernier, 1_000 + gestes.length - 1)
  // Relu de sa colonne tel qu'écrit ; une autre version, une forme abîmée se refont de leur pli.
  assert.deepEqual(lireLeResume(JSON.stringify(r)), r)
  assert.deepEqual(lireLeResume(r), r)
  assert.equal(lireLeResume({ ...r, v: VERSION_DU_RESUME + 1 }), null)
  assert.equal(lireLeResume({ ...r, epreuves: [{ ...r.epreuves[0], etoiles: [4, 0, 0] }] }), null)
  assert.equal(lireLeResume({ ...r, gardiens: ['dv:chronos', 'lg:sphinx', 'lg:dragon'] }), null, 'jamais un gardien qui n’en est pas un')
  assert.equal(lireLeResume('{pas du json'), null)
  assert.equal(lireLeResume(null), null)

  // « Rendre » : la page ne l'envoie pas, le serveur l'écrit ; le pli la referme, rendue, devant la carte.
  assert.equal(lireUnGesteDeLaTraversee({ quoi: 'rendre' }), null)
  assert.deepEqual(lireUnGesteDeLaTraversee({ quoi: 'rendre' }, true), { quoi: 'rendre' })
  const avant = etatDeLaTraversee(depart, ecrits)
  const apres = jouerUnGesteDeLaTraversee(depart, avant, { quoi: 'rendre' }, 9_999)
  assert.ok(typeof apres !== 'string')
  assert.deepEqual(apres.fin, { issue: 'rendue', le: 9_999 })
  assert.equal(apres.ou.sorte, 'carte')
  assert.equal(apres.or, avant.or, 'rien ne se paie')
  assert.equal(apres.coeurs, avant.coeurs)
  assert.equal(typeof jouerUnGesteDeLaTraversee(depart, apres, { quoi: 'rendre' }, 10_000), 'string', 'rendue, elle ne se rend pas deux fois')
  // Son résumé : rendue devant la carte, et son dernier passage reste le sien — « rendre » est le geste de l'administrateur.
  const rendue = resumeDeLaTraversee(depart, [...ecrits, { geste: { quoi: 'rendre' }, faitLe: 9_999 }])
  assert.deepEqual([rendue.ou, rendue.dernier, rendue.epreuves.length], ['carte', r.dernier, 2])

  // Une conclusion écrite par le serveur garde le temps de ses manches et son « Quitter ? » ; abîmés, elle se refuse.
  const conclure = { quoi: 'conclure', partie: 'p', manches: [3, 0, 1].map(etoiles => ({ etoiles, misee: false })) }
  assert.deepEqual(lireUnGesteDeLaTraversee({ ...conclure, durees: [1_000, null, 2_000], quittee: true }, true), { ...conclure, durees: [1_000, null, 2_000], quittee: true })
  for (const durees of [[1_000, 2_000], [-1, 0, 0], [DUREE_D_UNE_MANCHE_MAX_MS + 1, 0, 0], [1.5, 0, 0], 'vite']) {
    assert.equal(lireUnGesteDeLaTraversee({ ...conclure, durees }, true), null, JSON.stringify(durees))
  }
  assert.equal(lireUnGesteDeLaTraversee({ ...conclure, quittee: 'oui' }, true), null)
})

// ── Par les routes ──────────────────────────────────────────────────────────

let b: BancDuCabinet
let admin: string
before(async () => {
  b = await bancDuCabinet()
  admin = await connexionAnimateur(b.banc.url)
})
after(() => b?.banc.close())
after(fermerLesMagasins)

const idDe = async (cookie: string) => (await lire(b, cookie, '/api/joueur/moi?leger')).corps.profile.id as string
const laPageDuQg = async () => ok(await lire<PageDuCabinetAuQg>(b, admin, '/api/admin/cabinet'), 'la page du Cabinet au QG')
const laFiche = async (id: string) => ok(await lire<FicheDuJoueur>(b, admin, `/api/admin/profils/${id}`), 'la fiche')
const rendre = (id: string, corps: unknown) => poster<{ error?: string; ok?: true; id?: string; lisible?: boolean; acte?: number | null; ou?: string | null; enJeu?: string | null; epreuveFermee?: boolean }>(b, admin, `/api/admin/profils/${id}/traversee`, corps)
const saTraversee = (cookie: string) => lire<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee')
const geste = (cookie: string, t: Pick<VueDeLaTraversee, 'id' | 'rang'>, g: Record<string, unknown>) =>
  poster<PageDeLaTraversee & { error?: string }>(b, cookie, `/api/cabinet/traversee/${t.id}/geste`, { rang: t.rang, geste: g })
async function partir(cookie: string): Promise<VueDeLaTraversee> {
  const t = ok(await poster<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee', {}), 'le départ').traversee!
  return ok(await geste(cookie, t, { quoi: 'cartes', cartes: ['coup-d-oeil', 'cagnotte', 'panacee'] }), 'les cartes').traversee!
}
const q = (s: string) => `'${s.replace(/'/g, "''")}'`

/**
 * Une traversée écrite à la main dans la base, derrière le dos du serveur : ses gestes jusqu'à `arret`, finie à `fin` s'il
 * le faut — sans résumé, comme une traversée finie avant la colonne. `depart` : le départ tel qu'écrit, illisible au besoin.
 */
function aLaMainEnBase(
  profil: string,
  id: string,
  o: { commenceeLe: number; arret: (e: EtatDeLaTraversee) => boolean; puis?: GesteDeLaTraversee[]; fin?: { le: number; issue: 'gagnee' | 'perdue' | 'abandonnee'; legendaire?: string }; depart?: string },
) {
  const depart = departDe(id.length * 31 + 5)
  const gestes = [...gestesJusqua(depart, o.arret), ...(o.puis ?? [])]
  aLaMain(
    b.fichier,
    [
      `INSERT INTO cabinet_traversees (id, profile_id, depart, commencee_le, finie_le, issue, legendaire) VALUES (${q(id)}, ${q(profil)}, ${q(o.depart ?? JSON.stringify(depart))}, ${o.commenceeLe},
        ${o.fin ? o.fin.le : 'NULL'}, ${o.fin ? q(o.fin.issue) : 'NULL'}, ${o.fin?.legendaire ? q(o.fin.legendaire) : 'NULL'})`,
      ...gestes.map((g, k) => `INSERT INTO cabinet_traversee_gestes (traversee_id, rang, geste, fait_le, uid) VALUES (${q(id)}, ${k + 1}, ${q(JSON.stringify(g))}, ${o.commenceeLe + k * 60_000}, 'u${k}')`),
    ].join(';\n'),
  )
}
const ligneDe = (id: string) =>
  enBase(b.fichier, db => db.prepare('SELECT finie_le, issue, legendaire, resume FROM cabinet_traversees WHERE id = ?').get(id) as { finie_le: number | null; issue: string | null; legendaire: string | null; resume: string | null })

test('la page au QG : les traversées finies se résument une fois, celles en route se nomment, rien de plus d’un joueur ; les jours finis se gardent jusqu’à minuit', async () => {
  const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa', '🦊')
  const max = await inscrireProfil(b.banc.url, 'max', 'Max', '🐻')
  const [idLea, idMax] = [await idDe(lea), await idDe(max)]
  // Léa : une traversée abandonnée il y a deux jours, après deux épreuves — finie avant la colonne, sans résumé.
  aLaMainEnBase(idLea, 'abandonnee-de-lea', { commenceeLe: b.horloge.t - 3 * JOUR, arret: e => e.epreuves >= 2, puis: [{ quoi: 'abandonner' }], fin: { le: b.horloge.t - 2 * JOUR, issue: 'abandonnee' } })
  // Max : une gagnée hier, le Sphinx choisi au bout ; et une neuve, en route, partie par les routes.
  aLaMainEnBase(idMax, 'gagnee-de-max', {
    commenceeLe: b.horloge.t - 2 * JOUR,
    arret: e => e.ou.sorte === 'legendaire',
    puis: [{ quoi: 'legendaire', gardien: 'lg:sphinx' }],
    fin: { le: b.horloge.t - JOUR, issue: 'gagnee', legendaire: 'lg:sphinx' },
  })
  const enRoute = await partir(max)
  assert.equal(ligneDe('abandonnee-de-lea').resume, null)

  const page = await laPageDuQg()
  assert.deepEqual(
    [page.totaux.commencees, page.totaux.joueurs, page.totaux.gagnees, page.totaux.abandonnees, page.totaux.perdues, page.totaux.enRoute],
    [3, 2, 1, 1, 0, 1],
  )
  assert.deepEqual(page.legendaires, [{ cle: 'lg:sphinx', n: 1 }])
  assert.equal(page.entonnoir.find(m => m.marche === 'legendaire')?.n, 1)
  for (const issue of ['gagnee', 'perdue', 'abandonnee', 'rendue', 'en-route'] as const) {
    assert.equal(
      page.parJour.reduce((n, j) => n + j[issue], 0),
      { gagnee: 1, perdue: 0, abandonnee: 1, rendue: 0, 'en-route': 1 }[issue],
      issue,
    )
  }
  // La traversée d'avant la colonne s'est résumée, une fois, de son pli : ses deux épreuves.
  assert.equal(lireLeResume(ligneDe('abandonnee-de-lea').resume)?.epreuves.length, 2)
  // Celle en route : son joueur par son prénom et son identifiant, rien d'autre — ni avatar, ni Divin.
  assert.equal(page.enRoute.length, 1)
  assert.equal(page.enRoute[0].id, enRoute.id)
  assert.deepEqual(page.enRoute[0].profil, { id: idMax, nom: 'Max', login: 'max', suspendu: false })
  assert.deepEqual([page.enRoute[0].ou?.sorte, page.enRoute[0].ou?.acte, page.enRoute[0].ou?.coeurs], ['carte', 0, enRoute.coeurs])
  assert.deepEqual(
    page.joueurs.map(j => [j.profil.login, j.traversees, j.gagnees]),
    [
      ['max', 2, 1],
      ['lea', 1, 0],
    ],
  )
  assert.deepEqual(Object.keys(page.joueurs[0].profil).sort(), ['id', 'login', 'nom', 'suspendu'])
  const texte = JSON.stringify(page)
  for (const rien of ['🦊', '🐻', 'divin', 'dv:', 'avatar', 'motdepasse']) assert.ok(!texte.includes(rien), `« ${rien} » dans la page`)
  // Un joueur sans console n'y entre pas.
  assert.notEqual((await lire(b, lea, '/api/admin/cabinet')).status, 200)

  // Max abandonne : son résumé s'écrit dans le lot qui la finit, sans attendre la page.
  ok(await geste(max, enRoute, { quoi: 'abandonner' }), 'abandonner')
  const resumee = lireLeResume(ligneDe(enRoute.id).resume)
  assert.ok(resumee, 'résumée dans le lot de sa fin')
  assert.deepEqual(
    resumee.cartes.map(c => c.cle),
    ['coup-d-oeil', 'cagnotte', 'panacee'],
  )
  const apres = await laPageDuQg()
  assert.deepEqual([apres.totaux.abandonnees, apres.totaux.enRoute, apres.enRoute.length], [2, 0, 0])

  // Les jours finis se gardent jusqu'à minuit : une traversée d'avant-hier changée derrière le dos du serveur ne change pas la page…
  aLaMain(b.fichier, "UPDATE cabinet_traversees SET issue = 'perdue' WHERE id = 'abandonnee-de-lea'")
  assert.deepEqual([(await laPageDuQg()).totaux.abandonnees, (await laPageDuQg()).totaux.perdues], [2, 0])
  // …jusqu'au jour suivant, qui les relit une fois.
  b.horloge.t += JOUR
  const lendemain = await laPageDuQg()
  assert.deepEqual([lendemain.totaux.abandonnees, lendemain.totaux.perdues, lendemain.totaux.commencees], [1, 1, 3])
})

test('rendre une traversée bloquée : celle montrée seulement, refermée là où elle en est, son épreuve avec — rien ne se paie ni ne se rend, puis une neuve', async () => {
  const zoe = await inscrireProfil(b.banc.url, 'zoe', 'Zoé', '🐼')
  const idZoe = await idDe(zoe)
  const t = await partir(zoe)
  const etape = t.actes[0].etapes.find(e => e.id === t.atteignables.find(id => t.actes[0].etapes.find(x => x.id === id)?.sorte === 'epreuve'))!
  const entree = ok(await geste(zoe, t, { quoi: 'aller', etape: etape.id, ...(etape.choix && { theme: 0 }) }), 'l’entrée').traversee!
  const partie = entree.partie! as VueDeLaPartie
  assert.equal(entree.ou.sorte, 'epreuve')

  // Sa fiche la dit : en pleine épreuve, ses cœurs, son or.
  const fiche = await laFiche(idZoe)
  assert.equal(fiche.traversee?.id, t.id)
  assert.deepEqual([fiche.traversee?.ou?.sorte, fiche.traversee?.ou?.enJeu, fiche.traversee?.ou?.coeurs], ['epreuve', etape.jeu, entree.coeurs])

  // Ce que Zoé a, avant : rien ne doit bouger.
  const sesComptes = () =>
    enBase(b.fichier, db => ({
      reponses: (db.prepare('SELECT COUNT(*) AS n FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id WHERE s.profile_id = ?').get(idZoe) as { n: number }).n,
      gestes: (db.prepare('SELECT COUNT(*) AS n FROM cabinet_gestes WHERE serie_id = ?').get(partie.id) as { n: number }).n,
      badges: (db.prepare('SELECT COUNT(*) AS n FROM profile_badges WHERE profile_id = ?').get(idZoe) as { n: number }).n,
      xp: (db.prepare('SELECT COALESCE(SUM(xp), 0) AS n FROM profile_xp WHERE profile_id = ?').get(idZoe) as { n: number }).n,
    }))
  const avant = sesComptes()

  // Une autre que celle montrée ne se rend pas à l'aveugle ; sans rien dire, la page a vieilli.
  const sansRien = await rendre(idZoe, {})
  assert.equal(sansRien.status, 400)
  const autre = await rendre(idZoe, { traversee: 'une-autre' })
  assert.equal(autre.status, 409)
  assert.equal(autre.corps.error, UNE_AUTRE_TRAVERSEE)
  assert.equal(ligneDe(t.id).finie_le, null)

  const rendue = await rendre(idZoe, { traversee: t.id })
  assert.equal(rendue.status, 200, JSON.stringify(rendue.corps))
  assert.deepEqual(rendue.corps, { ok: true, id: t.id, lisible: true, acte: 0, ou: 'epreuve', enJeu: etape.jeu, epreuveFermee: true })
  // En base : sa fin à l'heure du geste, l'issue vide, son résumé ; le geste `rendre` au journal de la traversée ; son
  // épreuve close sans être conclue ; la ligne du profil la lâche.
  const ligne = ligneDe(t.id)
  assert.deepEqual([ligne.finie_le, ligne.issue, ligne.legendaire], [b.horloge.t, null, null])
  assert.equal(lireLeResume(ligne.resume)?.epreuves.length, 0)
  const dernier = enBase(b.fichier, db => db.prepare('SELECT geste FROM cabinet_traversee_gestes WHERE traversee_id = ? ORDER BY rang DESC LIMIT 1').get(t.id) as { geste: string })
  assert.deepEqual(JSON.parse(dernier.geste), { quoi: 'rendre' })
  const serie = enBase(b.fichier, db => db.prepare('SELECT finie_le, issue, bilan FROM campagne_series WHERE id = ?').get(partie.id) as { finie_le: number | null; issue: string | null; bilan: string | null })
  assert.deepEqual(serie, { finie_le: b.horloge.t, issue: null, bilan: null })
  assert.equal(enBase(b.fichier, db => (db.prepare('SELECT partie FROM cabinet_profils WHERE profile_id = ?').get(idZoe) as { partie: string | null }).partie), null)
  assert.deepEqual(sesComptes(), avant, 'rien ne se paie ni ne se rend')

  // L'épreuve encore à l'écran ne paie plus rien : son geste se refuse, et ne s'écrit pas.
  const tard = await jouer(b, zoe, partie, { quoi: 'quitter' })
  assert.equal(tard.status, 400)
  assert.equal((tard.corps as unknown as { error: string }).error, GESTE_CROISE)
  assert.deepEqual(sesComptes(), avant)

  // Le journal du QG le dit, sur son profil ; sa fiche ne la dit plus.
  const gestes = ok(await lire<{ gestes: GesteDuQg[] }>(b, admin, `/api/admin/gestes?cible=${idZoe}`), 'ses gestes').gestes
  assert.match(gestes[0].resume, /^Traversée du Cabinet rendue, sans rien coûter : Zoé \(@zoe\) — Acte I, en pleine épreuve \(.+\)$/)
  assert.equal((await laFiche(idZoe)).traversee, null)
  assert.equal((await rendre(idZoe, { traversee: t.id })).status, 404, 'plus rien en route')

  // Sa page dit la traversée refermée ; une neuve part aussitôt.
  const refermee = ok(await saTraversee(zoe), 'sa page').traversee!
  assert.equal(refermee.fin?.issue, 'rendue')
  assert.equal(ok(await poster<PageDeLaTraversee>(b, zoe, '/api/cabinet/traversee', {}), 'une neuve').traversee?.ou.sorte, 'cartes')
  // La page du QG la compte rendue — ni perdue, ni abandonnée.
  assert.equal((await laPageDuQg()).totaux.rendues, 1)
})

test('ses trois gardiens vaincus, son légendaire l’attend : rien ne se rend ; une traversée illisible pour ce serveur se rend, et se dit telle', async () => {
  const hugo = await inscrireProfil(b.banc.url, 'hugo', 'Hugo', '🐯')
  const ines = await inscrireProfil(b.banc.url, 'ines', 'Inès', '🐨')
  const [idHugo, idInes] = [await idDe(hugo), await idDe(ines)]
  aLaMainEnBase(idHugo, 'au-legendaire', { commenceeLe: b.horloge.t - H, arret: e => e.ou.sorte === 'legendaire' })
  assert.equal((await laFiche(idHugo)).traversee?.ou?.sorte, 'legendaire')
  const refus = await rendre(idHugo, { traversee: 'au-legendaire' })
  assert.equal(refus.status, 400)
  assert.equal(refus.corps.error, SON_LEGENDAIRE_L_ATTEND)
  assert.equal(ligneDe('au-legendaire').finie_le, null)

  // Un départ d'une version à venir : la page la nomme en tête, sans rien en dire ; elle se rend.
  aLaMainEnBase(idInes, 'illisible', { commenceeLe: b.horloge.t - 2 * H, arret: () => true, depart: JSON.stringify({ v: 99 }) })
  const page = await laPageDuQg()
  assert.equal(page.enRoute[0]?.id, 'illisible')
  assert.equal(page.enRoute[0]?.ou, null)
  assert.equal((await laFiche(idInes)).traversee?.ou, null)
  const rendue = await rendre(idInes, { traversee: 'illisible' })
  assert.equal(rendue.status, 200, JSON.stringify(rendue.corps))
  assert.deepEqual(rendue.corps, { ok: true, id: 'illisible', lisible: false, acte: null, ou: null, enJeu: null, epreuveFermee: false })
  assert.deepEqual([ligneDe('illisible').finie_le, ligneDe('illisible').resume], [b.horloge.t, null])
  const gestes = ok(await lire<{ gestes: GesteDuQg[] }>(b, admin, `/api/admin/gestes?cible=${idInes}`), 'ses gestes').gestes
  assert.equal(gestes[0].resume, 'Traversée du Cabinet rendue, sans rien coûter : Inès (@ines) — illisible sur ce serveur')
})

test('les lectures du QG passent par l’index de la fin des traversées ; la garde du départ garde celui du profil', () => {
  // `better-sqlite3` ne lit que des paramètres anonymes : les numérotés se récrivent, leurs valeurs dans l'ordre lu.
  const anonyme = (sql: string, args: readonly unknown[]) => {
    const lus: unknown[] = []
    return { sql: sql.replace(/\?(\d+)/g, (_, n: string) => (lus.push(args[Number(n) - 1]), '?')), args: /\?\d/.test(sql) ? lus : [...args] }
  }
  const db = new Database(b.fichier, { readonly: true })
  try {
    const plan = (i: string | { sql: string; args?: unknown }) => {
      const a = typeof i === 'string' ? { sql: i, args: [] } : anonyme(i.sql, (i.args ?? []) as unknown[])
      return (db.prepare(`EXPLAIN QUERY PLAN ${a.sql}`).all(...a.args) as { detail: string }[]).map(e => e.detail).join('\n')
    }
    // Une table parcourue — jamais la ligne de constantes d'un `INSERT … SELECT`, qui n'en est pas une.
    const PARCOURUE = /SCAN (?!CONSTANT ROW)/
    const t = b.horloge.t
    for (const i of [lectureDesTraverseesFinies(t - 30 * JOUR, t), ...lecturesDesTraverseesVivantes(t)]) {
      const p = plan(i)
      assert.match(p, /SEARCH (t|cabinet_traversees) USING INDEX cabinet_traversees_finie \(finie_le/, p)
      assert.doesNotMatch(p, /SCAN (t|g|cabinet_traversees|cabinet_traversee_gestes)\b/, p)
    }
    // La traversée en route d'un profil, et la garde du départ — une seule en route — : par l'index du profil.
    for (const i of [...lecturesDeLaTraverseeEnRoute('qui'), ...lotDeLaTraverseeQuiCommence({ id: 'x', profileId: 'qui', depart: departDe(3), t })]) {
      const p = plan(i)
      assert.match(p, /USING (COVERING )?INDEX cabinet_traversees_profil \(profile_id=\?\)/, p)
      assert.doesNotMatch(p, PARCOURUE, p)
    }
    // Rendre : chaque instruction par une clé.
    for (const i of lotDeLaTraverseeRendue({ id: 'x', profileId: 'qui', t, uid: 'u', resume: null })) assert.doesNotMatch(plan(i), PARCOURUE, plan(i))
    // Les pièces des épreuves, par la clé de leurs parties.
    assert.doesNotMatch(plan(lectureDesPiecesDesParties(['a', 'b'])), PARCOURUE)
  } finally {
    db.close()
  }
})
