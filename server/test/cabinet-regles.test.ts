// Une partie du Cabinet de curiosités jouée en pur, de son départ à son bilan
// (la règle `.claude/rules/cabinet.md` ; le pourquoi de chaque choix,
// `docs/architecture/decisions.md`, « Le Cabinet de curiosités ») : le pli des
// gestes, les pièces qu'il range, les étoiles après les pouvoirs, le cadre
// doré, l'issue et la poussière, la lecture d'un départ, d'un geste et d'un
// bilan, le musée — la visite, la série, les gardiens dus, les refus. Le
// chrono a son fichier (`cabinet-chronos.test.ts`), les neuf jeux les leurs ;
// les routes viendront avec le serveur du Cabinet.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import * as B from '../../shared/cabinet/bareme'
import { OEUVRES, OEUVRES_DE_DEPART, JEU_DE_L_OEUVRE, oeuvresDeLaSalle, type CleDOeuvre } from '../../shared/cabinet/oeuvres'
import { GARDIENS_DES_SALLES } from '../../shared/cabinet/salles'
import { JOKER_DU_TEMPS, JOKER_D_ECLAIRER } from '../../shared/cabinet/pieces'
import {
  ETAT_DU_DEPART,
  bilanDe,
  cadreDore,
  issueDe,
  phaseDe,
  ILLISIBLE,
  pliDeLaPartie,
  poussiereDeLaPartie,
  pouvoirMaintenant,
  refusDuGeste,
  resultatDe,
  VERSIONS_DU_BILAN_DU_CABINET,
  VERSIONS_DU_DEPART,
  VERSION_DU_BILAN_DU_CABINET,
  type DepartDUnePartie,
  type GesteDuCabinet,
  type GesteEcrit,
  type Manche,
} from '../../shared/cabinet/partie'
import { BORNES_DES_BILANS, lireLeBilan, lireLeDepart, lireUnGeste } from '../../shared/cabinet/lecture'
import {
  CASE_DEJA_FAITE,
  CHOISIS_UNE_CASE,
  DEMANDE_ILLISIBLE,
  PLUS_DE_CHASSE,
  RETENTER_SANS_VISITE_MANQUEE,
  SON_OEUVRE_EST_A_TOI,
  cadreDuDepart,
  gardiensDus,
  jeuDeLEchange,
  laPartieAttend,
  museeDe,
  possedees,
  prixDe,
  prochainGardien,
  refusDeLAchat,
  refusDeLEchange,
  refusDuDepart,
  retenteDeLaCase,
  seuilDeLaCase,
  serieApresUnJour,
  serieMontree,
  soldeDe,
  visiteDuJour,
  visiteEchangee,
  visitesAGarder,
  type DemandeLue,
  type LigneDOeuvre,
  type LigneDuProfil,
  type Musee,
  type PartieDuJour,
  type VisiteFigee,
} from '../../shared/cabinet/musee'
import { vuesDuCabinet } from '../../shared/cabinet/vues'
import { GLOSSAIRE } from '../../shared/glossaire'
import { PREFIXE_DE_LA_FRISE } from '../../shared/frise'
import { REGLES } from '../../shared/cabinet/jeux/index'
import { CLES_DES_JEUX, JEUX, type CleDeJeu } from '../../shared/cabinet/jeux/regle'
import * as Outils from '../../shared/cabinet/jeux/outils'
import type { FriseTiree } from '../../shared/cabinet/jeux/frise'
import type { RepliqueTiree } from '../../shared/cabinet/jeux/replique'
import { jourAvant } from '../../shared/jour'
import { JOUR, MIDI, Partie, S, carte, departDe, ouvrir, tirageDe } from './cabinet-plans'

// ── Le registre et ses outils ───────────────────────────────────────────

test('le registre : les neuf règles, chacune sous sa clé, et un seul module d’outils', () => {
  assert.deepEqual(Object.keys(REGLES).sort(), [...CLES_DES_JEUX].sort())
  for (const jeu of CLES_DES_JEUX) assert.equal(REGLES[jeu].cle, jeu, jeu)
  // Les trois lots des jeux avaient chacun leur copie des outils, mot pour mot : elles se sont fondues en une.
  const dossier = new URL('../../shared/cabinet/jeux/', import.meta.url)
  for (const f of ['deLaBase.ts', 'aides.ts', 'duContenu.ts']) assert.ok(!existsSync(new URL(f, dossier)), `${f} : fondu dans outils.ts`)
  const outils = Object.keys(Outils)
  for (const nom of ['GESTE_A_JUGER', 'SANS_REPONSE', 'naturelDe', 'choixDe', 'auHasard', 'battre', 'rienAEclairer', 'eclairerSertEncore', 'champsDuGeste', 'reponseEnvoyee', 'estUnIndex', 'pieceDeLaQuestion', 'pieceDuContenu'])
    assert.ok(outils.includes(nom), nom)
  // Aucun jeu ne les redéfinit : une deuxième copie finirait par dire autre chose.
  const redefini = /\b(?:const|function)\s+(GESTE_A_JUGER|SANS_REPONSE|champsDuGeste|reponseEnvoyee|rienAEclairer|eclairerSertEncore|battre|auHasard|naturelDe|choixDe|estUnIndex|pieceDeLaQuestion|pieceDuContenu)\b/
  for (const f of readdirSync(dossier).filter(x => x.endsWith('.ts') && x !== 'outils.ts')) {
    const code = readFileSync(new URL(f, dossier), 'utf8')
    assert.doesNotMatch(code, redefini, `${f} recopie un outil`)
  }
})

test('ce que l’annonce dit des étapes d’un jeu est ce que sa règle joue', () => {
  // La page lit `JEUX` sans tirer les règles des jeux : leurs étapes s'y écrivent à la main, et Prendre son temps en dit
  // ses secondes — « par manche », ou « à chacune de ses deux questions » au Pari et à la Réplique (la tablée du
  // 26 octobre 2026). Écrites de travers, l'annonce promettrait à l'Éclair dix secondes par affirmation.
  for (const jeu of CLES_DES_JEUX) assert.equal(JEUX[jeu].etapes, REGLES[jeu].etapes, jeu)
  assert.deepEqual(
    CLES_DES_JEUX.filter(j => JEUX[j].etapes === 2),
    ['pari', 'replique'],
  )
})

// ── Les scénarios : une partie entière de chaque jeu ────────────────────

/** L'ordre juste d'une manche de la Frise, en jetons de l'écran : les ancres et les nouveaux venus rangés dans le temps. */
function ordreJuste(t: FriseTiree): number[] {
  const ancres = t.vagues.slice(0, t.vague).flat().sort((a, b) => a - b)
  const nouveaux = t.vagues[t.vague]
  const jeton = (r: number) => (ancres.includes(r) ? ancres.indexOf(r) : ancres.length + nouveaux.indexOf(r))
  return [...ancres, ...nouveaux].sort((a, b) => a - b).map(jeton)
}

const repondre = (manche: Manche, reponse?: object): GesteDuCabinet => ({ quoi: 'repondre', manche, ...(reponse && { reponse }) }) as GesteDuCabinet
const essai = (manche: Manche, lettres: string): GesteDuCabinet => ({ quoi: 'essai', manche, lettres })
const FAUX = ['KAUNASS', 'PALANGA', 'SIAULIA', 'KLAIPED', 'TRAKAIS']

/** Une partie entière de chaque jeu, geste par geste, chacun à quelques secondes du précédent. */
function scenario(jeu: CleDeJeu, d: DepartDUnePartie): GesteDuCabinet[] {
  const rep = (k: number) => d.tirages[k] as RepliqueTiree
  switch (jeu) {
    case 'pari':
      return [ouvrir(0), repondre(0, { pari: { choix: 1 } }), { quoi: 'parier', manche: 0 }, repondre(0, { pari: { choix: 3 } }), ouvrir(1), repondre(1, { pari: { choix: 0 } }), ouvrir(2), repondre(2, { pari: { choix: 1 } }), { quoi: 'garder', manche: 2 }]
    case 'eclair':
      return [ouvrir(0), repondre(0, { eclair: { reponses: [true, false, true, false, true] } }), ouvrir(1), repondre(1, { eclair: { reponses: [true, true, true, true, true] } }), ouvrir(2), repondre(2)]
    case 'mot':
      return [ouvrir(0), essai(0, 'VILNIUS'), ouvrir(1), essai(1, FAUX[0]), essai(1, FAUX[1]), essai(1, 'VILNIUS'), ouvrir(2), ...FAUX.map(f => essai(2, f))]
    case 'filet':
      return [ouvrir(0), repondre(0, { filet: { x: 1852, taille: 'petit' } }), ouvrir(1), repondre(1, { filet: { x: 1860, taille: 'moyen' } }), ouvrir(2), repondre(2, { filet: { x: 1800, taille: 'grand' } })]
    case 'detail':
      return [ouvrir(0), repondre(0, { detail: { titre: 2 } }), ouvrir(1), { quoi: 'reculer', manche: 1 }, repondre(1, { detail: { titre: 2 } }), ouvrir(2), repondre(2, { detail: { titre: 0 } })]
    case 'frise':
      return [0, 1, 2].flatMap(k => [ouvrir(k as Manche), repondre(k as Manche, { frise: { ordre: ordreJuste(d.tirages[k] as FriseTiree) } })])
    case 'epingle':
      return [ouvrir(0), repondre(0, { epingle: { lat: 47.902, lon: 1.909 } }), ouvrir(1), repondre(1, { epingle: { lat: 48.85, lon: 2.35 } }), ouvrir(2), repondre(2)]
    case 'indices':
      return [
        ouvrir(0),
        { quoi: 'nom', manche: 0, texte: 'Victor Hugo' },
        ouvrir(1),
        // Un indice, une erreur : quatre au compte, ★★ (`INDICES_DES_ETOILES`) — l'erreur seule n'en fait plus que trois.
        { quoi: 'indice', manche: 1 },
        { quoi: 'nom', manche: 1, texte: 'Zola' },
        { quoi: 'nom', manche: 1, texte: 'Hugo' },
        ouvrir(2),
        { quoi: 'indice', manche: 2 },
        repondre(2),
      ]
    case 'replique':
      return [
        ouvrir(0),
        { quoi: 'mot', manche: 0, choix: rep(0).bonMot },
        repondre(0, { replique: { qui: rep(0).bonneQui } }),
        ouvrir(1),
        { quoi: 'mot', manche: 1, choix: (rep(1).bonMot + 1) % 4 },
        repondre(1, { replique: { qui: rep(1).bonneQui } }),
        ouvrir(2),
        repondre(2),
        repondre(2, { replique: { qui: (rep(2).bonneQui + 1) % 3 } }),
      ]
  }
}

/** Les étoiles naturelles que chaque scénario donne, manche par manche. */
const NATUREL_DU_SCENARIO: Record<CleDeJeu, [number, number, number]> = {
  // La troisième manche gardée : deux étoiles depuis le calibrage du 25 octobre 2026 (`ETOILES_DU_PARI`).
  pari: [3, 0, 2],
  eclair: [3, 1, 0],
  mot: [3, 2, 0],
  filet: [3, 2, 0],
  detail: [3, 2, 0],
  frise: [3, 3, 3],
  epingle: [3, 2, 0],
  indices: [3, 2, 0],
  replique: [3, 1, 0],
}

function jouerLeScenario(jeu: CleDeJeu, d = departDe(jeu)): Partie {
  const p = new Partie(d)
  scenario(jeu, d).forEach((g, i) => p.joue(g, MIDI + i * 2 * S))
  return p
}

test('une partie entière de chaque jeu se joue en pur : trois manches, une pièce par verdict, la fin', () => {
  for (const jeu of CLES_DES_JEUX) {
    const p = jouerLeScenario(jeu)
    const e = p.etat
    assert.equal(phaseDe(e), 'finie', jeu)
    assert.equal(e.fin?.pourquoi, 'jouee', jeu)
    assert.deepEqual(resultatDe(p.depart, e).naturel, NATUREL_DU_SCENARIO[jeu], jeu)
    // Une pièce par verdict : deux au Pari parié, une partout ailleurs ; à la suite, chacune à sa position.
    assert.equal(e.pieces.length, jeu === 'pari' ? 4 : 3, jeu)
    assert.deepEqual(e.pieces.map(x => x.position), e.pieces.map((_, i) => i), jeu)
    assert.deepEqual([...new Set(e.pieces.map(x => x.manche))], [0, 1, 2], jeu)
    // Chaque identifiant est unique dans sa partie : le signalement joint par (partie, identifiant).
    assert.equal(new Set(e.pieces.map(x => x.piece.id)).size, e.pieces.length, `${jeu} : deux pièces au même identifiant`)
    for (const x of e.pieces) {
      // Juste dès deux étoiles naturelles, au Pari à sa bonne réponse ; aucune n'a été aidée.
      const naturel = NATUREL_DU_SCENARIO[jeu][x.manche]
      if (jeu !== 'pari') assert.equal(x.juste, naturel >= B.ETOILES_D_UNE_JUSTE, `${jeu} manche ${x.manche}`)
      assert.equal(x.joker, null, jeu)
      assert.equal(x.piece.cabinet.jeu, jeu)
      assert.equal(x.piece.cabinet.manche, x.manche)
    }
  }
})

/** Ce que la base rend d'une partie, relu comme le serveur le relira : le départ et chaque geste écrits en JSON, puis leurs lecteurs. */
function relueDeLaBase(p: Partie): { depart: DepartDUnePartie; gestes: GesteEcrit[] } {
  const depart = lireLeDepart(JSON.stringify(p.depart))
  assert.ok(depart, 'le départ écrit se relit')
  const gestes = p.gestes.map(({ geste, faitLe }) => {
    const relu = lireUnGeste(JSON.stringify(geste), { duServeur: true })
    assert.ok(relu, `${JSON.stringify(geste)} écrit, illisible`)
    return { geste: relu, faitLe }
  })
  return { depart, gestes }
}

test('le pli rejoué est le pli d’une traite : un rechargement, un réveil, un autre serveur retrouvent la même partie', () => {
  for (const jeu of CLES_DES_JEUX) {
    const p = jouerLeScenario(jeu)
    // Par le chemin d'un rechargement : le JSON de la base, puis `lireLeDepart` et `lireUnGeste` — un champ
    // qu'un lecteur perdrait (la mise, `auto`, une réponse) y changerait la partie.
    const relue = relueDeLaBase(p)
    assert.deepEqual(pliDeLaPartie(relue.depart, relue.gestes), p.etat, jeu)
    // Et à chaque geste : la partie en cours relue à n'importe quel instant est celle qu'on jouait.
    for (let n = 0; n <= p.gestes.length; n++) {
      const relue = pliDeLaPartie(p.depart, p.gestes.slice(0, n))
      assert.equal(relue.rang, n + 1, `${jeu} : le rang suit les gestes écrits`)
    }
  }
  // La mise, une réponse envoyée d'elle-même à l'échéance, Éclairer : chacun survit au passage par la base.
  const misee = new Partie(departDe('mot', { carte: carte('miser', 2, 'quitte-ou-double') }))
  auMot(misee, 0, 3, MIDI, { miser: true })
  auMot(misee, 1, 2, MIDI + 20 * S)
  auMot(misee, 2, 3, MIDI + 40 * S)
  const auto = new Partie(departDe('filet', { carte: carte('eclairer', 2, 'repere') }))
  auto.joue(ouvrir(0), MIDI)
  auto.joue({ quoi: 'eclairer', manche: 0 }, MIDI + S)
  auto.joue({ quoi: 'repondre', manche: 0, auto: true, reponse: { filet: { x: 1852, taille: 'moyen' } } }, MIDI + B.DUREES_DES_JEUX.filet * S)
  for (const p of [misee, auto]) {
    const relue = relueDeLaBase(p)
    assert.deepEqual(pliDeLaPartie(relue.depart, relue.gestes), p.etat)
  }
  assert.equal(misee.etat.misee, 0)
  assert.equal(auto.etat.pieces[0].joker, JOKER_D_ECLAIRER)
  // Un geste écrit que la relecture refuse ne change rien, mais compte à son rang : le suivant reste celui de la base.
  const p = jouerLeScenario('mot')
  const avecUnIntrus = [...p.gestes.slice(0, 2), { geste: essai(1, 'VILNIUS'), faitLe: MIDI + 3 * S }, ...p.gestes.slice(2)]
  const relue = pliDeLaPartie(p.depart, avecUnIntrus)
  assert.equal(relue.ignores, 1)
  assert.equal(relue.rang, p.etat.rang + 1)
  assert.deepEqual(relue.pieces, p.etat.pieces)
})

test('un geste se refuse en mots, et rien ne change : une manche à la fois, dans l’ordre', () => {
  const p = new Partie(departDe('mot'))
  assert.equal(p.refuse(essai(0, 'VILNIUS'), MIDI), 'Cette manche n’est pas encore ouverte')
  assert.equal(p.refuse(ouvrir(1), MIDI), 'Ce n’est pas la manche suivante : recharge la page')
  p.joue(ouvrir(0), MIDI)
  assert.equal(p.refuse(ouvrir(1), MIDI + S), 'Réponds d’abord à cette manche')
  assert.equal(p.refuse(essai(1, 'VILNIUS'), MIDI + S), 'Ce geste vise une autre manche : recharge la page')
  assert.equal(p.refuse(essai(0, 'VILNI'), MIDI + S), 'Il faut 7 lettres', 'le refus du jeu, mot pour mot')
  assert.equal(p.refuse({ quoi: 'garder', manche: 0 }, MIDI + S), 'Ce geste ne se lit pas : recharge la page', 'un geste d’un autre jeu')
  assert.equal(p.refuse({ quoi: 'eclairer', manche: 0 }, MIDI + S), 'Tu n’as emporté aucune carte-bonus')
  p.joue(essai(0, 'VILNIUS'), MIDI + 2 * S)
  assert.equal(p.refuse(essai(0, 'VILNIUS'), MIDI + 3 * S), 'Cette manche est déjà jouée')
  assert.equal(refusDuGeste(p.depart, p.etat, ouvrir(1), MIDI + 4 * S), null)
  p.joue({ quoi: 'quitter' }, MIDI + 5 * S)
  assert.equal(p.refuse(ouvrir(1), MIDI + 6 * S), 'Cette partie est finie')
  assert.equal(p.refuse({ quoi: 'quitter' }, MIDI + 6 * S), 'Cette partie est finie')
})

// ── Quitter ─────────────────────────────────────────────────────────────

test('quitter compte zéro et `choix` NULL partout, sauf le Pari gardé ; une manche jamais ouverte, sans pièce', () => {
  // Ce qu'il avait fait dans la manche avant de quitter, pour chaque jeu qui a des gestes à lui.
  const avant: Partial<Record<CleDeJeu, (d: DepartDUnePartie) => GesteDuCabinet[]>> = {
    mot: () => [essai(0, FAUX[0]), essai(0, FAUX[1])],
    detail: () => [{ quoi: 'reculer', manche: 0 }],
    indices: () => [{ quoi: 'nom', manche: 0, texte: 'Zola' }],
    replique: d => [{ quoi: 'mot', manche: 0, choix: (d.tirages[0] as RepliqueTiree).bonMot }],
  }
  for (const jeu of CLES_DES_JEUX) {
    const p = new Partie(departDe(jeu))
    p.joue(ouvrir(0), MIDI)
    for (const g of avant[jeu]?.(p.depart) ?? []) p.joue(g, MIDI + S)
    p.joue({ quoi: 'quitter' }, MIDI + 2 * S)
    assert.equal(p.etat.fin?.pourquoi, 'quittee', jeu)
    assert.equal(p.etat.pieces.length, 1, `${jeu} : la manche vue s'écrit, les deux jamais ouvertes non`)
    const [x] = p.etat.pieces
    assert.equal(x.juste, false, jeu)
    assert.equal(x.choix, null, `${jeu} : quittée, elle n'a pas de réponse — même au bon mot, même après des essais`)
    assert.deepEqual(resultatDe(p.depart, p.etat).naturel, [0, 0, 0], jeu)
    assert.equal(p.etat.manches[0].fin, 'quittee', jeu)
    // La règle du jeu le dit elle-même : le pli ne fait que la lire.
    const r = REGLES[jeu] as unknown as { juger(t: unknown, e: unknown, x: 'quittee'): { naturel: number; pieces: { choix: number | null }[] } }
    const v = r.juger(p.depart.tirages[0], p.etat.manches[0].etat, 'quittee')
    assert.equal(v.naturel, 0, jeu)
    assert.ok(v.pieces.every(y => y.choix === null), jeu)
  }
  // Le Pari juste au premier coup, laissé au choix : il les avait gagnées, ses étoiles sont gardées.
  const pari = new Partie(departDe('pari'))
  pari.joue(ouvrir(0), MIDI)
  pari.joue(repondre(0, { pari: { choix: 1 } }), MIDI + S)
  pari.joue({ quoi: 'quitter' }, MIDI + 2 * S)
  assert.deepEqual(resultatDe(pari.depart, pari.etat).naturel, [B.ETOILES_DU_PARI.garder, 0, 0])
  assert.equal(B.ETOILES_DU_PARI.garder, 2)
  assert.deepEqual(
    pari.etat.pieces.map(x => [x.juste, x.choix]),
    [[true, 1]],
  )
})

test('quitter après une dernière manche expirée : la partie était déjà jouée, à l’heure de son échéance', () => {
  const filet = B.DUREES_DES_JEUX.filet * S
  const jouee = (fin: GesteDuCabinet) => {
    const p = new Partie(departDe('filet'))
    p.joue(ouvrir(0), MIDI)
    p.joue(repondre(0, { filet: { x: 1852, taille: 'petit' } }), MIDI + S)
    p.joue(ouvrir(1), MIDI + 2 * S)
    p.joue(repondre(1, { filet: { x: 1852, taille: 'moyen' } }), MIDI + 3 * S)
    // La troisième s'ouvre, puis le téléphone s'éteint : elle expire sans un geste.
    p.joue(ouvrir(2), MIDI + 4 * S)
    p.joue(fin, MIDI + 4 * S + filet + 120 * S)
    return p
  }
  const limite = MIDI + 4 * S + filet + B.GRACE_D_UNE_MANCHE_MS
  for (const fin of [{ quoi: 'quitter' }, { quoi: 'clore', pourquoi: 'lendemain' }] as GesteDuCabinet[]) {
    const p = jouee(fin)
    assert.deepEqual(p.etat.manches.map(m => m.fin), ['jugee', 'jugee', 'expiree'], fin.quoi)
    // « Quitter » arrive sur une partie finie : il ne la réécrit pas en partie quittée.
    assert.deepEqual(p.etat.fin, { le: limite, pourquoi: 'jouee' }, fin.quoi)
    const r = resultatDe(p.depart, p.etat)
    assert.deepEqual([r.quittee, r.lendemain], [false, false], fin.quoi)
    assert.equal(bilanDe(p.depart, p.etat, null).quittee, undefined, fin.quoi)
  }
})

test('la page du lendemain clôt la partie : la manche ouverte expirée à son heure, la partie close, rangée au jour du départ', () => {
  const p = new Partie(departDe('mot'))
  p.joue(ouvrir(0), MIDI)
  p.joue(essai(0, FAUX[0]), MIDI + S)
  const lendemain = MIDI + 24 * 3600 * S
  // Jamais de la page : seul le serveur écrit `clore`.
  assert.equal(lireUnGeste({ quoi: 'clore', pourquoi: 'lendemain' }), null)
  p.joue({ quoi: 'clore', pourquoi: 'lendemain' }, lendemain)
  const [x] = p.etat.pieces
  // Expirée : ce que le serveur savait compte — l'essai fait, une réponse fausse —, à l'heure où elle a cessé d'attendre.
  assert.equal(x.choix, -1)
  assert.equal(x.repondueLe, MIDI + B.DUREES_DES_JEUX.mot * S + B.GRACE_D_UNE_MANCHE_MS)
  assert.equal(p.etat.manches[0].fin, 'expiree')
  assert.equal(p.etat.fin?.pourquoi, 'lendemain')
  const bilan = bilanDe(p.depart, p.etat, null)
  assert.equal(bilan.lendemain, true)
  assert.equal(bilan.quittee, undefined)
})

// ── Les étoiles, les pouvoirs, le cadre doré ────────────────────────────

/** Une manche du Mot jouée pour tant d'étoiles naturelles, dans les temps. */
function auMot(p: Partie, k: Manche, naturel: 0 | 1 | 2 | 3, t: number, o: { miser?: true } = {}) {
  p.joue(ouvrir(k, o.miser), t)
  const faux = { 3: 0, 2: 2, 1: 4, 0: 5 }[naturel]
  for (let i = 0; i < faux; i++) p.joue(essai(k, FAUX[i]), t + (i + 1) * S)
  if (naturel > 0) p.joue(essai(k, 'VILNIUS'), t + (faux + 1) * S)
}
const partieAuMot = (naturels: readonly (0 | 1 | 2 | 3)[], d: Parameters<typeof departDe>[1] = {}, misee: Manche | null = null) => {
  const p = new Partie(departDe('mot', d))
  naturels.forEach((n, k) => auMot(p, k as Manche, n, MIDI + k * 20 * S, misee === k ? { miser: true } : {}))
  return p
}

test('le total se plafonne à neuf ; Miser : parfaite, trois et le bonus, sinon zéro — une fois, sans avoir vu', () => {
  const p = partieAuMot([3, 3, 3], { carte: carte('miser', 3, 'tout-ou-rien') }, 0)
  const r = resultatDe(p.depart, p.etat)
  assert.deepEqual(r.etoiles, [3 + B.BONUS_DE_MISE[3], 3, 3])
  assert.equal(r.total, B.ETOILES_D_UNE_PARTIE, 'plafonné à neuf')
  assert.equal(r.cadreDore, false, 'la mise a servi')
  const ratee = partieAuMot([2, 3, 3], { carte: carte('miser', 1, 'tout-ou-rien') }, 0)
  assert.deepEqual(resultatDe(ratee.depart, ratee.etat).etoiles, [0, 3, 3], 'misée imparfaite : rien')
  // Une seule mise par partie, décidée à l'ouverture.
  const deux = new Partie(departDe('mot', { carte: carte('miser', 1, 'tout-ou-rien') }))
  auMot(deux, 0, 3, MIDI, { miser: true })
  assert.equal(deux.refuse(ouvrir(1, true), MIDI + 10 * S), 'La mise a déjà servi')
  assert.equal(new Partie(departDe('mot')).refuse(ouvrir(0, true), MIDI), 'Tu n’as emporté aucune carte-bonus')
  assert.equal(new Partie(departDe('mot', { carte: carte('eclairer') })).refuse(ouvrir(0, true), MIDI), 'Ta carte-bonus n’a pas ce pouvoir')
  const vue = new Partie(departDe('mot', { carte: carte('miser', 1, 'tout-ou-rien') }))
  vue.joue(ouvrir(0), MIDI)
  assert.equal(vue.refuse(ouvrir(0, true), MIDI + S), 'La mise se décide avant de voir la manche')
})

test('Protéger porte la première manche imparfaite, et elle seule ; la juste se lit au naturel', () => {
  const p = partieAuMot([3, 1, 2], { carte: carte('proteger', 1, 'prudence') })
  const r = resultatDe(p.depart, p.etat)
  assert.deepEqual(r.etoiles, [3, 1 + B.BONUS_DE_PROTECTION[1], 2], 'la deuxième, pas la troisième')
  assert.equal(r.aidee, true)
  // Portée de ★ à ★★, la manche ne paie pas un confetti de plus : sa pièce reste fausse.
  assert.equal(p.etat.pieces[1].juste, false)
  // Zéro compris, mais d'une étoile seulement, à toute force : relevée de deux par le Phénix, une manche ratée faisait avec
  // une manche juste au hasard les cinq étoiles d'une commune (le calibrage du 26 octobre 2026).
  const zero = partieAuMot([0, 3, 3], { carte: carte('proteger', 3, 'lg:phenix') })
  assert.deepEqual(resultatDe(zero.depart, zero.etat).etoiles, [B.BONUS_D_UNE_MANCHE_RATEE, 3, 3], 'zéro compris, d’une étoile')
  const une = partieAuMot([1, 3, 3], { carte: carte('proteger', 3, 'lg:phenix') })
  assert.deepEqual(resultatDe(une.depart, une.etat).etoiles, [1 + B.BONUS_DE_PROTECTION[3], 3, 3], 'imparfaite, pas ratée : le bonus de sa force')
  const parfaite = partieAuMot([3, 3, 3], { carte: carte('proteger', 1, 'prudence') })
  const sans = resultatDe(parfaite.depart, parfaite.etat)
  assert.equal(sans.aidee, false, 'rien à protéger : la carte n’a pas servi')
  assert.equal(sans.cadreDore, true)
})

test('Protéger ne relève qu’une manche répondue : ni la manche quittée, ni celle que le temps a finie sans une réponse', () => {
  // Quitter d'emblée sous Prudence valait une étoile, et quatre poussières : « Quitter ? » promettait les étoiles déjà
  // gagnées (la tablée du 25 octobre 2026, l'arbitrage du 26).
  const quittee = new Partie(departDe('mot', { origine: 'chasse', cible: 'bastion', but: 'gagner', seuil: 7, carte: carte('proteger', 3, 'lg:phenix') }))
  quittee.joue(ouvrir(0), MIDI)
  quittee.joue({ quoi: 'quitter' }, MIDI + S)
  const r = resultatDe(quittee.depart, quittee.etat)
  assert.deepEqual(r.etoiles, [0, 0, 0], 'la manche quittée reste à zéro')
  assert.equal(r.aidee, false, 'la carte n’a pas servi')
  assert.equal(r.repondue, false)
  assert.equal(bilanDe(quittee.depart, quittee.etat, { possedee: false, doree: false }).poussiere, 0, 'ni étoile ni poussière')
  // Quittée après une réponse fausse : la manche répondue — ratée — se relève, et la partie paie son plancher.
  const apres = partieAuMot([0], { origine: 'chasse', cible: 'bastion', but: 'gagner', seuil: 7, carte: carte('proteger', 1, 'prudence') })
  apres.joue(ouvrir(1), MIDI + 30 * S)
  apres.joue({ quoi: 'quitter' }, MIDI + 31 * S)
  assert.deepEqual(resultatDe(apres.depart, apres.etat).etoiles, [B.BONUS_D_UNE_MANCHE_RATEE, 0, 0])
  assert.equal(bilanDe(apres.depart, apres.etat, { possedee: false, doree: false }).poussiere, B.POUSSIERE_MIN)
  // La première manche expirée sans un essai ne se protège pas : la suivante, répondue à une étoile, le prend.
  const expiree = new Partie(departDe('mot', { carte: carte('proteger', 1, 'prudence') }))
  expiree.joue(ouvrir(0), MIDI)
  // La page envoie d'elle-même ce qu'elle tient — ici, rien —, arrivé après la grâce : la manche a expiré sans un essai.
  expiree.joue({ quoi: 'repondre', manche: 0, auto: true }, MIDI + B.DUREES_DES_JEUX.mot * S + B.GRACE_D_UNE_MANCHE_MS + S)
  const t = MIDI + B.DUREES_DES_JEUX.mot * S + 10 * S
  auMot(expiree, 1, 1, t)
  auMot(expiree, 2, 3, t + 30 * S)
  assert.deepEqual(expiree.etat.manches.map(m => m.fin), ['expiree', 'jugee', 'jugee'])
  assert.deepEqual(resultatDe(expiree.depart, expiree.etat).etoiles, [0, 1 + B.BONUS_DE_PROTECTION[1], 3])
})

test('le cadre doré : trois manches parfaites sans qu’un pouvoir ait servi — emporter une carte ne coûte rien', () => {
  assert.equal(cadreDore([3, 3, 3], false), true)
  assert.equal(cadreDore([3, 3, 2], false), false)
  assert.equal(cadreDore([3, 3, 3], true), false)
  // Chaque carte, emportée sans servir : le cadre reste doré.
  for (const [pouvoir, cle] of [['eclairer', 'coup-d-oeil'], ['changer', 'echange'], ['temps', 'concentration'], ['miser', 'tout-ou-rien'], ['proteger', 'prudence']] as const) {
    const p = partieAuMot([3, 3, 3], { carte: carte(pouvoir, 1, cle), rechanges: 1 })
    assert.equal(resultatDe(p.depart, p.etat).cadreDore, true, `${pouvoir} emporté, pas joué`)
  }
  // Éclairer qui a servi : plus de cadre doré, et la pièce de la manche le porte.
  const eclairee = new Partie(departDe('mot', { carte: carte('eclairer', 1) }))
  eclairee.joue(ouvrir(0), MIDI)
  eclairee.joue({ quoi: 'eclairer', manche: 0 }, MIDI + S)
  eclairee.joue(essai(0, 'VILNIUS'), MIDI + 2 * S)
  auMot(eclairee, 1, 3, MIDI + 20 * S)
  auMot(eclairee, 2, 3, MIDI + 40 * S)
  assert.equal(resultatDe(eclairee.depart, eclairee.etat).cadreDore, false)
  assert.deepEqual(eclairee.etat.pieces.map(x => x.joker), [JOKER_D_ECLAIRER, null, null])
  // Changer qui a servi : plus de cadre doré, mais la pièce reste nue — une autre question, posée comme les autres (D6).
  const changee = new Partie(departDe('mot', { carte: carte('changer', 1, 'echange'), rechanges: 1 }))
  changee.joue(ouvrir(0), MIDI)
  changee.joue({ quoi: 'changer', manche: 0 }, MIDI + S)
  changee.joue(essai(0, 'VILNIUS'), MIDI + 2 * S)
  auMot(changee, 1, 3, MIDI + 20 * S)
  auMot(changee, 2, 3, MIDI + 40 * S)
  assert.equal(resultatDe(changee.depart, changee.etat).cadreDore, false)
  assert.equal(changee.etat.pieces[0].joker, null)
  assert.equal(changee.etat.pieces[0].tirage, 3, 'la rechange du plan')
  assert.equal(changee.etat.pieces[0].piece.id, 'm3')
})

test('Changer : avant de jouer, la rechange suivante du plan, la même échéance — jamais à la Frise', () => {
  const p = new Partie(departDe('mot', { carte: carte('changer', 2, 'detour'), rechanges: 2 }))
  p.joue(ouvrir(0), MIDI)
  p.joue({ quoi: 'changer', manche: 0 }, MIDI + 10 * S)
  const m = p.etat.manches[0]
  assert.equal(m.tirage, 3)
  assert.equal(m.etapes[0].ouverteLe, MIDI, 'le chrono continue')
  p.joue(essai(0, FAUX[0]), MIDI + 11 * S)
  assert.equal(p.refuse({ quoi: 'changer', manche: 0 }, MIDI + 12 * S), 'Change avant de répondre')
  p.joue(essai(0, 'VILNIUS'), MIDI + 13 * S)
  p.joue(ouvrir(1), MIDI + 14 * S)
  p.joue({ quoi: 'changer', manche: 1 }, MIDI + 15 * S)
  assert.equal(p.etat.manches[1].tirage, 4)
  p.joue(essai(1, 'VILNIUS'), MIDI + 16 * S)
  p.joue(ouvrir(2), MIDI + 17 * S)
  assert.equal(p.refuse({ quoi: 'changer', manche: 2 }, MIDI + 18 * S), 'Plus de rechange pour cette partie')
  const frise = new Partie(departDe('frise', { carte: carte('changer', 3, 'lg:janus') }))
  frise.joue(ouvrir(0), MIDI)
  assert.equal(frise.refuse({ quoi: 'changer', manche: 0 }, MIDI + S), 'Changer ne sert pas à la Frise')
})

test('Éclairer : ses usages par partie, et le hasard tiré de la graine secrète — la même graine, le même effet', () => {
  const pari = (graine: string) => {
    const p = new Partie(departDe('pari', { carte: carte('eclairer', 2, 'repere'), graine }))
    p.joue(ouvrir(0), MIDI)
    p.joue({ quoi: 'eclairer', manche: 0 }, MIDI + S)
    return p
  }
  const effacee = (graine: string) => (pari(graine).etat.manches[0].etat as { effacees: number[][] }).effacees[0]
  assert.deepEqual(effacee('une-graine'), effacee('une-graine'), 'rejouée, la même')
  // D'une graine à l'autre, une autre : le hasard tient à elle seule — c'est pourquoi elle ne quitte jamais le serveur.
  assert.ok(new Set(Array.from({ length: 30 }, (_, i) => effacee(`g${i}`)[0])).size > 1)
  const p = pari('une-graine')
  p.joue({ quoi: 'eclairer', manche: 0 }, MIDI + 2 * S)
  assert.equal(p.refuse({ quoi: 'eclairer', manche: 0 }, MIDI + 3 * S), 'Éclairer a déjà servi deux fois')
  assert.equal(pouvoirMaintenant(p.depart, p.etat, MIDI + 3 * S)?.refus, 'Éclairer a déjà servi deux fois')
  assert.equal(new Partie(departDe('pari', { carte: carte('proteger') })).refuse({ quoi: 'eclairer', manche: 0 }, MIDI), 'Cette manche n’est pas encore ouverte')
})

test('le Pari parié laisse deux pièces : seule sa première question, sans aide, est nue', () => {
  const p = jouerLeScenario('pari')
  const [q1, q2] = p.etat.pieces
  assert.deepEqual([q1.etape, q2.etape], [1, 2])
  assert.equal(q1.piece.forme, undefined, 'nue : elle mesure')
  assert.equal(q2.piece.forme, 'pari')
  assert.deepEqual([q1.juste, q1.choix, q2.juste, q2.choix], [true, 1, true, 3])
  // Éclairée, la première porte sa forme et son pouvoir ; la seconde, seulement si l'étape du pari l'a été.
  const e = new Partie(departDe('pari', { carte: carte('eclairer', 1) }))
  e.joue(ouvrir(0), MIDI)
  e.joue({ quoi: 'eclairer', manche: 0 }, MIDI + S)
  e.joue(repondre(0, { pari: { choix: 1 } }), MIDI + 2 * S)
  e.joue({ quoi: 'parier', manche: 0 }, MIDI + 3 * S)
  e.joue(repondre(0, { pari: { choix: 3 } }), MIDI + 4 * S)
  assert.deepEqual(e.etat.pieces.map(x => [x.piece.forme, x.joker]), [['pari', JOKER_D_ECLAIRER], ['pari', null]])
})

// ── Les seuils, les issues, la poussière ────────────────────────────────

test('l’issue d’une partie : gagnée au seuil figé, dorée sans faute, doublée en visite, manquée en deçà, libre sans œuvre', () => {
  const d = (o: Partial<DepartDUnePartie>) => departDe('mot', { origine: 'visite', visite: 0, cible: 'bastion', but: 'gagner', seuil: 7, ...o })
  const a = (total: number, dore = false) => ({ total, cadreDore: dore })
  const pas = { possedee: false, doree: false }
  const aLui = { possedee: true, doree: false }
  assert.equal(issueDe(d({}), a(7), pas), 'gagnee')
  assert.equal(issueDe(d({}), a(6), pas), 'manquee')
  assert.equal(issueDe(d({}), a(9, true), pas), 'gagnee-doree')
  assert.equal(issueDe(d({ but: 'dorer' }), a(9, true), aLui), 'doree')
  assert.equal(issueDe(d({ but: 'dorer' }), a(8), aLui), 'double')
  assert.equal(issueDe(d({ but: 'dorer' }), a(6), aLui), 'manquee')
  // Gagnée en chasse depuis le départ, ou achetée : elle est à lui à la fin, et se double ou se dore.
  assert.equal(issueDe(d({ but: 'gagner' }), a(8), aLui), 'double')
  assert.equal(issueDe(d({ origine: 'chasse', visite: undefined, but: 'dorer' }), a(9, true), aLui), 'doree')
  assert.equal(issueDe(d({ origine: 'chasse', visite: undefined, but: 'dorer' }), a(8), aLui), 'manquee', 'pas de double en chasse')
  assert.equal(issueDe(d({ origine: 'libre', visite: undefined, cible: null, but: null, seuil: null }), a(9, true), null), 'libre')
  assert.equal(issueDe(d({ cible: null, but: null, seuil: null }), a(9), null), 'libre', 'une case sans rien à gagner')
})

test('la poussière : deux par étoile et quatre au moins en visite et en chasse répondues, le double, les libres qui paient', () => {
  const visite = departDe('mot', { origine: 'visite', visite: 0, cible: 'bastion', but: 'dorer', seuil: 7 })
  assert.equal(poussiereDeLaPartie(visite, { total: 0, issue: 'manquee', repondue: true }), B.POUSSIERE_MIN)
  assert.equal(poussiereDeLaPartie(visite, { total: 1, issue: 'manquee', repondue: true }), B.POUSSIERE_MIN, 'quatre au moins, même ratée')
  // Quittée d'emblée, ou laissée sans une réponse : rien — quatre poussières se gagnaient à quitter (le 26 octobre 2026).
  assert.equal(poussiereDeLaPartie(visite, { total: 0, issue: 'manquee', repondue: false }), 0, 'rien de répondu, rien de gagné')
  assert.equal(poussiereDeLaPartie(visite, { total: 9, issue: 'doree', repondue: true }), 9 * B.POUSSIERE_PAR_ETOILE)
  assert.equal(poussiereDeLaPartie(visite, { total: 8, issue: 'double', repondue: true }), 8 * B.POUSSIERE_PAR_ETOILE + B.POUSSIERE_DU_DOUBLE.epique)
  const libre = departDe('mot')
  assert.equal(poussiereDeLaPartie(libre, { total: 7, issue: 'libre', repondue: true }), 7 * B.POUSSIERE_PAR_ETOILE)
  assert.equal(poussiereDeLaPartie(libre, { total: 0, issue: 'libre', repondue: true }), 0, 'libre : sans plancher')
  assert.equal(poussiereDeLaPartie({ ...libre, payee: false }, { total: 9, issue: 'libre', repondue: true }), 0, 'au-delà des cinq du jour, pour le plaisir')
  // Ses mots la promettent à qui a répondu — le glossaire du bas de la page, celui de la référence —, jamais à toute
  // visite « même ratée » : quittée d'emblée, elle ne rapporte plus rien (la relecture du 26 octobre 2026).
  assert.match(GLOSSAIRE.poussiere.sens, /répond/, GLOSSAIRE.poussiere.sens)
  const deLaReference = readFileSync(new URL('../../docs/reference/glossaire.md', import.meta.url), 'utf8')
    .split('\n')
    .find(l => l.startsWith('| Poussière d'))!
  assert.match(deLaReference, /répond/, deLaReference)
  // Le bilan la fige, avec l'issue et l'œuvre.
  const p = partieAuMot([3, 3, 3], { origine: 'visite', visite: 1, cible: 'plume', but: 'gagner', seuil: B.SEUILS_DES_RARETES.commun })
  const bilan = bilanDe(p.depart, p.etat, { possedee: false, doree: false })
  assert.deepEqual({ issue: bilan.issue, poussiere: bilan.poussiere, oeuvre: bilan.oeuvre, total: bilan.total }, { issue: 'gagnee-doree', poussiere: 18, oeuvre: 'plume', total: 9 })
  // Le cartel garde la manche la plus étoilée naturellement qui a une anecdote — la première, à égalité.
  assert.equal(bilan.cartel, 0)
})

// ── Relire un départ, un geste, un bilan ────────────────────────────────

test('un départ se relit variante par variante — la zone de l’Épingle et l’ordre des effacés compris —, et une version inconnue se refuse', () => {
  for (const jeu of CLES_DES_JEUX) {
    const d = departDe(jeu, { carte: carte('eclairer', 2, 'repere'), rechanges: 2, origine: 'visite', visite: 2, cible: 'plume', but: 'gagner', seuil: 5, theme: 'Un thème' })
    assert.deepEqual(lireLeDepart(JSON.stringify(d)), d, jeu)
    assert.deepEqual(lireLeDepart(d), d, `${jeu}, déjà un objet`)
  }
  const epingle = departDe('epingle')
  assert.ok((lireLeDepart(JSON.stringify(epingle))!.tirages[0] as { decalage: unknown }).decalage)
  const replique = departDe('replique')
  assert.deepEqual((lireLeDepart(JSON.stringify(replique))!.tirages[1] as RepliqueTiree).ordreDesEffaces, (replique.tirages[1] as RepliqueTiree).ordreDesEffaces)
  // Ce qui ne se relit pas : une version inconnue, un jeu inconnu, un tirage d'un autre jeu, un champ mal formé.
  const mot = departDe('mot')
  // Le départ tel que la base le rend, du JSON qu'on abîme champ par champ.
  const casse = (f: (x: any) => void) => {
    const x = JSON.parse(JSON.stringify(mot))
    f(x)
    return lireLeDepart(x)
  }
  assert.equal(casse(x => (x.v = 2)), null, 'une version que ce code ne joue pas')
  assert.equal(casse(x => delete x.v), null)
  assert.equal(casse(x => (x.jeu = 'rebus')), null)
  assert.equal(casse(x => (x.tirages[1] = tirageDe('pari', 1))), null, 'un tirage d’un autre jeu')
  assert.equal(casse(x => (x.tirages = x.tirages.slice(0, 2))), null, 'moins de trois manches')
  assert.equal(casse(x => (x.graine = '')), null)
  assert.equal(casse(x => (x.jour = '2026-02-30')), null)
  assert.equal(casse(x => (x.cible = 'constructor')), null)
  assert.equal(casse(x => (x.carte = { cle: 'x', pouvoir: 'voler', force: 1 })), null)
  assert.equal(casse(x => (x.origine = 'visite')), null, 'une visite sans sa case')
  assert.equal(casse(x => (x.tirages[0].lettres = 'vilnius')), null)
  assert.equal(lireLeDepart('{pas du json'), null)
  // Son chrono, figé : une étape par étape de son jeu, du temps en plus seulement sous la carte qui le donne.
  assert.equal(casse(x => delete x.chrono), null, 'sans son chrono')
  assert.equal(casse(x => (x.chrono.etapesMs = [120_000, 25_000])), null, 'deux étapes au Mot mystère')
  assert.equal(casse(x => (x.chrono.etapesMs = [0])), null)
  assert.equal(casse(x => (x.chrono.enPlusMs = 10_000)), null, 'du temps en plus sans la carte qui le donne')
  assert.equal(casse(x => (x.chrono.graceMs = -1)), null)
  assert.equal(lireLeDepart(JSON.stringify(departDe('pari', { chrono: { etapesMs: [35_000], enPlusMs: 0, graceMs: 1_500, pauseMs: 30_000 } }))), null, 'une seule étape au Pari')
  // Un champ que le format n'a pas ne voyage pas.
  const relu = casse(x => (x.reponse = 'VILNIUS'))!
  assert.ok(!('reponse' in relu))
  // L'Épingle sans son décalage, la Réplique sans l'ordre de ses effacés : illisibles, plutôt qu'un Éclairer qui tirerait de la graine.
  const sansDecalage = JSON.parse(JSON.stringify(epingle))
  delete sansDecalage.tirages[0].decalage
  assert.equal(lireLeDepart(sansDecalage), null)
  // Son rayon se fige avec lui (le 26 octobre 2026) : sans rayon, ou un rayon qui laisserait le lieu hors de la zone, illisible.
  assert.equal((lireLeDepart(JSON.stringify(epingle))!.tirages[0] as { decalage: { rayonKm: number } }).decalage.rayonKm, B.RAYON_D_ECLAIRER_KM)
  const sansRayon = JSON.parse(JSON.stringify(epingle))
  delete sansRayon.tirages[0].decalage.rayonKm
  assert.equal(lireLeDepart(sansRayon), null, 'sans son rayon')
  const tropCourt = JSON.parse(JSON.stringify(epingle))
  tropCourt.tirages[0].decalage.rayonKm = tropCourt.tirages[0].decalage.km
  assert.equal(lireLeDepart(tropCourt), null, 'un rayon qui ne contient pas le lieu')
  const sansOrdre = JSON.parse(JSON.stringify(replique))
  sansOrdre.tirages[0].ordreDesEffaces = [[0, 0], []]
  assert.equal(lireLeDepart(sansOrdre), null)
  // Le Filet : une piste d'années coupée à l'année du départ — une réponse dans l'avenir ne se relit pas. Ce que le
  // barème pose ou non (`seTendAuFilet`), le tireur l'a jugé au départ : relu au barème du jour, un recul allongé
  // aurait rendu illisibles les parties déjà jouées, et leur cartel avec.
  const filet = JSON.parse(JSON.stringify(departDe('filet')))
  filet.tirages[0] = { ...filet.tirages[0], valeur: 2015, piste: { min: 1990, max: 2027, pas: 1 } }
  assert.equal(lireLeDepart(filet), null, 'une piste qui passe l’année du départ')
  filet.tirages[0].piste.max = 2026
  assert.ok(lireLeDepart(filet), 'un départ écrit est un fait : le barème du jour ne le rejuge pas')
  // La Frise : trois vagues d'une même frise, chacune à sa manche, jamais de rechange.
  const frise = JSON.parse(JSON.stringify(departDe('frise')))
  frise.tirages = [frise.tirages[1], frise.tirages[0], frise.tirages[2]]
  assert.equal(lireLeDepart(frise), null)
})

/**
 * Un départ et un bilan de chaque version connue, tels que la base les garde : écrits à la main, jamais par
 * `departDe` ni les constantes du jour — sinon l'épreuve suivrait le code, et une version retirée de la liste, ou
 * relue au barème d'aujourd'hui, passerait inaperçue (l'Expédition a perdu ses bilans à une v8 oubliée).
 */
const MOT_ECRIT = (id: string) =>
  `{"jeu":"mot","question":{"id":"${id}","texte":"Quelle est la capitale de la Lituanie ?","reponses":["Riga","Vilnius","Tallinn","Minsk"],"bonne":1,"categorie":"Géographie","anecdote":null,"niveau":"facile"},"lettres":"VILNIUS","affiche":"Vilnius"}`
const DEPARTS_ECRITS: Record<number, string> = {
  1: `{"v":1,"jeu":"mot","origine":"chasse","jour":"2026-10-24","cible":"plume","but":"gagner","seuil":5,"payee":true,"carte":{"cle":"concentration","pouvoir":"temps","force":1},"graine":"8c1d2e7a-3b4f-4c5d-9e6f-0a1b2c3d4e5f","chrono":{"etapesMs":[120000],"enPlusMs":10000,"graceMs":1500,"pauseMs":30000},"tirages":[${MOT_ECRIT('m-a')},${MOT_ECRIT('m-b')},${MOT_ECRIT('m-c')}]}`,
}
const BILANS_ECRITS: Record<number, string> = {
  1: '{"v":1,"etoiles":[7,3,0],"naturel":[3,3,0],"aidee":true,"total":9,"quittee":true,"issue":"gagnee","poussiere":18,"oeuvre":"plume","cartel":0}',
}

test('chaque version connue se relit, écrite en dur : le départ et son chrono figé, le bilan et ses bornes figées', () => {
  for (const v of VERSIONS_DU_DEPART) {
    const d = lireLeDepart(DEPARTS_ECRITS[v])
    assert.ok(d, `le départ v${v} ne se relit plus`)
    assert.equal(d.v, v, 'sa version, telle qu’écrite : le pli la lit')
    // Il se joue à son chrono : le Mot à 120 s, dix secondes de « Prendre son temps », la grâce et la pause d'alors.
    const p = new Partie(d)
    p.joue(ouvrir(0), MIDI)
    p.joue(essai(0, 'VILNIUS'), MIDI + 131 * S)
    assert.deepEqual([p.etat.manches[0].fin, p.etat.pieces[0].juste, p.etat.pieces[0].joker], ['jugee', true, JOKER_DU_TEMPS])
  }
  for (const v of VERSIONS_DU_BILAN_DU_CABINET) {
    const b = lireLeBilan(BILANS_ECRITS[v])
    assert.ok(b, `le bilan v${v} ne se relit plus`)
    assert.equal(b.v, v)
  }
  assert.deepEqual(lireLeBilan(BILANS_ECRITS[1])?.etoiles, [7, 3, 0], 'une mise gagnée de son temps : trois et quatre')
  // Les bornes d'un bilan sont celles de sa version, figées avec elle : le barème du jour doit tenir dans celles de la
  // version qu'il écrit — une mise relevée, sans version neuve, écrirait des bilans que la relecture refuserait.
  const bornes = BORNES_DES_BILANS[VERSION_DU_BILAN_DU_CABINET]
  assert.ok(B.ETOILES_PAR_MANCHE + Math.max(...Object.values(B.BONUS_DE_MISE)) <= bornes.etoiles, 'une mise plus forte : monter VERSION_DU_BILAN_DU_CABINET')
  assert.ok(B.ETOILES_PAR_MANCHE <= bornes.naturel && B.ETOILES_D_UNE_PARTIE <= bornes.total)
})

test('un geste se relit champ par champ : un nom de cinq mille signes se coupe, `clore` ne vient jamais de la page', () => {
  const nom = lireUnGeste({ quoi: 'nom', manche: 0, texte: 'Hugo'.repeat(1250) })
  assert.ok(nom && nom.quoi === 'nom')
  assert.equal(nom.texte.length, B.SIGNES_D_UN_GESTE_MAX, 'coupé par `tronquer`, avant d’être jugé et écrit')
  // Un emoji à la frontière ne laisse pas sa moitié : `tronquer`, jamais `slice`.
  const emoji = lireUnGeste({ quoi: 'nom', manche: 0, texte: `${'a'.repeat(B.SIGNES_D_UN_GESTE_MAX - 1)}😀😀` })
  assert.ok(emoji && emoji.quoi === 'nom')
  assert.equal(emoji.texte, `${'a'.repeat(B.SIGNES_D_UN_GESTE_MAX - 1)}😀`)
  assert.equal(lireUnGeste({ quoi: 'essai', manche: 0, lettres: 'A'.repeat(B.SIGNES_D_UN_GESTE_MAX + 1) }), null)
  assert.equal(lireUnGeste({ quoi: 'essai', manche: 0, lettres: 'vilnius' }), null, 'des capitales sans accents')
  assert.deepEqual(lireUnGeste('{"quoi":"essai","manche":1,"lettres":"VILNIUS","en":"trop"}'), { quoi: 'essai', manche: 1, lettres: 'VILNIUS' })
  assert.equal(lireUnGeste({ quoi: 'reculer', manche: 3 }), null)
  assert.equal(lireUnGeste({ quoi: 'reculer', manche: '0' }), null)
  assert.equal(lireUnGeste({ quoi: 'voler', manche: 0 }), null)
  assert.deepEqual(lireUnGeste({ quoi: 'ouvrir', manche: 0, miser: false }), { quoi: 'ouvrir', manche: 0 })
  assert.deepEqual(lireUnGeste({ quoi: 'ouvrir', manche: 1, miser: true }), { quoi: 'ouvrir', manche: 1, miser: true })
  assert.deepEqual(lireUnGeste({ quoi: 'quitter', manche: 9 }), { quoi: 'quitter' })
  assert.equal(lireUnGeste({ quoi: 'clore', pourquoi: 'lendemain' }), null)
  assert.deepEqual(lireUnGeste({ quoi: 'clore', pourquoi: 'lendemain' }, { duServeur: true }), { quoi: 'clore', pourquoi: 'lendemain' })
  // Un geste écrit se relit tel qu'il a été écrit : coupé à son arrivée, il ne se recoupe pas au barème du jour — un
  // nom jugé sur soixante signes le resterait, même la borne abaissée.
  const ecrit = lireUnGeste(JSON.stringify({ quoi: 'nom', manche: 0, texte: 'Victor Hugo'.padEnd(B.SIGNES_D_UN_GESTE_MAX + 10, '.') }), { duServeur: true })
  assert.ok(ecrit && ecrit.quoi === 'nom')
  assert.equal(ecrit.texte.length, B.SIGNES_D_UN_GESTE_MAX + 10)
  // Une réponse : une seule clé de jeu, ses champs relus ; rien d'envoyé, la page à l'échéance.
  assert.deepEqual(lireUnGeste({ quoi: 'repondre', manche: 0, auto: true }), { quoi: 'repondre', manche: 0, auto: true })
  assert.deepEqual(lireUnGeste({ quoi: 'repondre', manche: 0, reponse: { filet: { x: 1852.5, taille: 'moyen', y: 3 } } }), {
    quoi: 'repondre',
    manche: 0,
    reponse: { filet: { x: 1852.5, taille: 'moyen' } },
  })
  for (const reponse of [
    { pari: { choix: 1 }, filet: { x: 1, taille: 'petit' } },
    { pari: { choix: '1' } },
    { filet: { x: Number.NaN, taille: 'petit' } },
    { filet: { x: 1, taille: 'constructor' } },
    { epingle: { lat: '47', lon: 1 } },
    { frise: { ordre: [0, 0, 1] } },
    { eclair: { reponses: [true, 'vrai'] } },
    { constructor: { choix: 1 } },
    'pari',
  ])
    assert.equal(lireUnGeste({ quoi: 'repondre', manche: 0, reponse }), null, JSON.stringify(reponse))
})

test('un bilan se relit à sa version, champ par champ ; une version inconnue se refuse', () => {
  const p = partieAuMot([3, 2, 1], { origine: 'chasse', cible: 'bastion', but: 'gagner', seuil: 7 })
  const bilan = bilanDe(p.depart, p.etat, { possedee: false, doree: false })
  assert.equal(bilan.issue, 'manquee')
  assert.deepEqual(lireLeBilan(JSON.stringify(bilan)), bilan)
  for (const casse of [{ v: 2 }, { issue: 'ratee' }, { total: 10 }, { naturel: [3, 3] }, { etoiles: [3, 3, 9] }, { oeuvre: 'lg:phenix' }, { cartel: 3 }, { poussiere: -1 }])
    assert.equal(lireLeBilan({ ...bilan, ...casse }), null, JSON.stringify(casse))
  // Une mise gagnée vaut trois et la plus forte mise.
  assert.ok(lireLeBilan({ ...bilan, etoiles: [3 + Math.max(...Object.values(B.BONUS_DE_MISE)), 3, 3] }))
})

// ── Le musée ────────────────────────────────────────────────────────────

/** Minuit de Paris, le 24 octobre 2026 (l'heure d'été : UTC+2). */
const MINUIT = Date.UTC(2026, 9, 23, 22, 0, 0)

const ligne = (oeuvre: string, o: Partial<LigneDOeuvre> = {}): LigneDOeuvre => ({
  oeuvre,
  origine: 'partie',
  gagneeLe: MINUIT - 3600 * S,
  saison: null,
  serieId: null,
  prix: null,
  doreeLe: null,
  dorure: null,
  prixDorure: null,
  serieDoree: null,
  ...o,
})
const profil = (o: Partial<LigneDuProfil> = {}): LigneDuProfil => ({ poussiere: 0, serie: 0, serieJour: null, serieRecord: 0, visites: [], partie: null, ...o })
const partieDuJour = (o: Partial<PartieDuJour>): PartieDuJour => ({ id: 'x', commenceeLe: MIDI, finieLe: MIDI, issue: null, origine: 'libre', visite: null, jeu: 'mot', cible: null, payee: true, total: 0, ...o })
const tout = (o: Partial<LigneDOeuvre> = {}) => OEUVRES.map(x => ligne(x.cle, o))
const sauf = (cles: readonly string[], o: Partial<LigneDOeuvre> = {}) => OEUVRES.filter(x => !cles.includes(x.cle)).map(x => ligne(x.cle, o))
const NEUF = [...CLES_DES_JEUX]

test('ce qu’il possède : ses lignes et les quatre de départ ; son solde, gagné moins dépensé', () => {
  const m = museeDe({ jour: JOUR, profil: profil({ poussiere: 500 }), oeuvres: [ligne('bastion', { origine: 'achat', prix: 400 }), ligne('plume', { doreeLe: MIDI, dorure: 'poussiere', prixDorure: 50 })] })
  assert.deepEqual([...possedees(m)].sort(), [...OEUVRES_DE_DEPART, 'bastion', 'plume'].sort())
  assert.equal(soldeDe(m), 50)
  assert.equal(soldeDe(museeDe({ jour: JOUR })), 0, 'jamais joué')
})

test('les gardiens dus : salle complète, salle dorée, le Cabinet entier, trente jours, une œuvre gagnée en jouant pendant la fête', () => {
  const voies = (m: Musee) => gardiensDus(m).map(g => g.voie)
  assert.deepEqual(voies(museeDe({ jour: JOUR })), [])
  const rempart = oeuvresDeLaSalle('rempart').map(o => ligne(o.cle))
  assert.deepEqual(voies(museeDe({ jour: JOUR, oeuvres: rempart })), ['cabinet:phenix'])
  const doree = oeuvresDeLaSalle('rempart').map(o => ligne(o.cle, { doreeLe: MIDI }))
  assert.deepEqual(voies(museeDe({ jour: JOUR, oeuvres: doree })), ['cabinet:phenix', 'cabinet:ouroboros'])
  // Le Cabinet entier : chaque salle complète, et le Trou noir ; les quatre de départ y comptent sans ligne.
  const entier = gardiensDus(museeDe({ jour: JOUR, oeuvres: sauf(OEUVRES_DE_DEPART) }))
  assert.deepEqual(entier.map(g => g.legendaire), [...Object.values(GARDIENS_DES_SALLES).map(([premier]) => premier), 'lg:trou-noir'])
  assert.deepEqual(voies(museeDe({ jour: JOUR, profil: profil({ serieRecord: B.JOURS_DU_SCARABEE }) })), ['cabinet:scarabee'])
  assert.deepEqual(voies(museeDe({ jour: JOUR, profil: profil({ serieRecord: B.JOURS_DU_SCARABEE - 1 }) })), [])
  assert.deepEqual(voies(museeDe({ jour: JOUR, oeuvres: [ligne('plume', { saison: 'halloween' })] })), ['saison:halloween'])
  // Un achat n'a pas de saison qui compte : seule une œuvre gagnée en jouant.
  assert.deepEqual(voies(museeDe({ jour: JOUR, oeuvres: [ligne('plume', { saison: 'noel', origine: 'achat' })] })), [])
})

test('le prochain gardien : la salle la plus près d’être complète dont le premier gardien dort', () => {
  const presque = oeuvresDeLaSalle('devin').slice(2).map(o => ligne(o.cle))
  assert.deepEqual(prochainGardien(museeDe({ jour: JOUR, oeuvres: presque })), { legendaire: 'lg:sphinx', salle: 'devin', manquent: 2 })
  // Le Sphinx déjà à lui, par une autre voie : la salle suivante.
  const autre = prochainGardien(museeDe({ jour: JOUR, oeuvres: presque, legendaires: ['lg:sphinx'] }))
  assert.notEqual(autre?.salle, 'devin')
  assert.equal(prochainGardien(museeDe({ jour: JOUR, oeuvres: sauf(OEUVRES_DE_DEPART) })), null, 'tout est complet')
})

test('la série se lit jusqu’à la veille tant qu’il n’a pas joué ; rompue, zéro, et le record reste', () => {
  assert.deepEqual(serieMontree(profil({ serie: 12, serieJour: JOUR, serieRecord: 12 }), JOUR), { jours: 12, aJouer: false, record: 12 })
  assert.deepEqual(serieMontree(profil({ serie: 12, serieJour: jourAvant(JOUR), serieRecord: 14 }), JOUR), { jours: 12, aJouer: true, record: 14 })
  assert.deepEqual(serieMontree(profil({ serie: 12, serieJour: jourAvant(JOUR, 2), serieRecord: 14 }), JOUR), { jours: 0, aJouer: false, record: 14 })
  assert.deepEqual(serieMontree(null, JOUR), { jours: 0, aJouer: false, record: 0 })
})

test('la série compte un jour joué : déjà compté, rien ; la veille la prolonge ; un autre la recommence ; un jour d’avant ne la fait pas reculer', () => {
  // La règle de la mémoire, celle de l'instruction du geste qui l'écrit (`lotDuGeste`, `cabinet-routes.test.ts` par les routes).
  assert.deepEqual(serieApresUnJour(null, JOUR), { serie: 1, serieJour: JOUR, serieRecord: 1 }, 'son premier jour')
  assert.deepEqual(serieApresUnJour(profil({ serie: 4, serieJour: jourAvant(JOUR), serieRecord: 6 }), JOUR), { serie: 5, serieJour: JOUR, serieRecord: 6 })
  assert.deepEqual(serieApresUnJour(profil({ serie: 6, serieJour: jourAvant(JOUR), serieRecord: 6 }), JOUR), { serie: 7, serieJour: JOUR, serieRecord: 7 }, 'un record')
  assert.deepEqual(serieApresUnJour(profil({ serie: 4, serieJour: JOUR, serieRecord: 4 }), JOUR), { serie: 4, serieJour: JOUR, serieRecord: 4 }, 'le jour déjà compté')
  assert.deepEqual(serieApresUnJour(profil({ serie: 4, serieJour: jourAvant(JOUR, 2), serieRecord: 6 }), JOUR), { serie: 1, serieJour: JOUR, serieRecord: 6 }, 'rompue')
  // La partie d'hier close aujourd'hui, après une d'aujourd'hui : la série ne recule pas, le jour compté reste le plus récent.
  assert.deepEqual(serieApresUnJour(profil({ serie: 3, serieJour: JOUR, serieRecord: 3 }), jourAvant(JOUR)), { serie: 3, serieJour: JOUR, serieRecord: 3 })
})

test('la visite vise chaque jour la salle du prochain gardien : une de ses cases, tant qu’un gardien dort', () => {
  const o = { graine: 'secret:profil', jour: JOUR, minuit: MINUIT, jeux: NEUF }
  const salleDe = (cle: string | null) => OEUVRES.find(x => x.cle === cle)?.salle
  // Deux œuvres manquent au Devin : au seul poids des raretés, elles ne sortaient qu'au hasard de toutes les manquantes.
  const presque = oeuvresDeLaSalle('devin').slice(2).map(x => ligne(x.cle))
  for (let n = 0; n < 200; n++) {
    const v = visiteDuJour(museeDe({ jour: JOUR, oeuvres: presque }), { ...o, graine: `g${n}` })
    assert.ok(v.cases.some(c => salleDe(c.cible) === 'devin'), `g${n} : ${v.cases.map(c => c.cible)}`)
  }
  // Le Sphinx déjà à lui par une autre voie : la salle du prochain, la suivante.
  const sansLeSphinx = museeDe({ jour: JOUR, oeuvres: presque, legendaires: ['lg:sphinx'] })
  const suivante = prochainGardien(sansLeSphinx)!.salle
  assert.notEqual(suivante, 'devin')
  for (let n = 0; n < 50; n++) {
    assert.ok(visiteDuJour(sansLeSphinx, { ...o, graine: `g${n}` }).cases.some(c => salleDe(c.cible) === suivante), `g${n} vise ${suivante}`)
  }
  // Une chasse du matin complète le Devin et réveille le Sphinx : la visite d'avant le premier départ ne change pas.
  const leMatin = museeDe({ jour: JOUR, oeuvres: [...presque, ...oeuvresDeLaSalle('devin').slice(0, 2).map(x => ligne(x.cle, { gagneeLe: MIDI }))], legendaires: ['lg:sphinx'] })
  for (let n = 0; n < 50; n++) assert.deepEqual(visiteDuJour(leMatin, { ...o, graine: `g${n}` }), visiteDuJour(museeDe({ jour: JOUR, oeuvres: presque }), { ...o, graine: `g${n}` }))
  // La dernière case seule change : les autres tirent au même hasard, qu'un gardien dorme ou non.
  const veillent = Object.values(GARDIENS_DES_SALLES).map(([premier]) => premier)
  for (let n = 0; n < 50; n++) {
    const avec = visiteDuJour(museeDe({ jour: JOUR, oeuvres: presque }), { ...o, graine: `g${n}` })
    const sans = visiteDuJour(museeDe({ jour: JOUR, oeuvres: presque, legendaires: veillent }), { ...o, graine: `g${n}` })
    assert.deepEqual(avec.cases.slice(0, -1), sans.cases.slice(0, -1))
  }
})

test('la visite du jour : la même graine, la même ; trois jeux différents, ceux des deux jours d’avant après', () => {
  const o = { graine: 'secret:profil', jour: JOUR, minuit: MINUIT, jeux: NEUF }
  const m = museeDe({ jour: JOUR })
  const v = visiteDuJour(m, o)
  assert.deepEqual(visiteDuJour(m, o), v, 'rien ne coûte avant de jouer : dérivée, et la même à chaque page')
  assert.equal(v.cases.length, B.CASES_DE_LA_VISITE)
  assert.equal(new Set(v.cases.map(c => c.jeu)).size, B.CASES_DE_LA_VISITE, 'trois jeux différents')
  assert.equal(v.figee, false)
  assert.notDeepEqual(visiteDuJour(m, { ...o, graine: 'secret:autre' }).cases, v.cases, 'une autre graine, une autre visite')
  // Les visites figées des deux jours d'avant — échange compris — passent après : la visite varie d'un jour à l'autre.
  for (let n = 0; n < 40; n++) {
    const graine = `g${n}`
    const veille: VisiteFigee = { jour: jourAvant(JOUR), cases: NEUF.slice(n % 3, (n % 3) + 3).map(jeu => ({ jeu, cible: null, but: null })) }
    const avantVeille: VisiteFigee = { jour: jourAvant(JOUR, 2), cases: NEUF.slice(3 + (n % 3), 6 + (n % 3)).map(jeu => ({ jeu, cible: null, but: null })) }
    const recents = new Set([...veille.cases, ...avantVeille.cases].map(c => c.jeu))
    const w = visiteDuJour(museeDe({ jour: JOUR, profil: profil({ visites: [veille, avantVeille] }) }), { ...o, graine })
    assert.ok(w.cases.every(c => !recents.has(c.jeu)), `${graine} : ${w.cases.map(c => c.jeu)} redit les jours d'avant`)
    // Pas de récurrence : un jour plus ancien ne change rien.
    const plusVieux: VisiteFigee = { jour: jourAvant(JOUR, 3), cases: NEUF.slice(0, 3).map(jeu => ({ jeu, cible: null, but: null })) }
    assert.deepEqual(visiteDuJour(museeDe({ jour: JOUR, profil: profil({ visites: [veille, avantVeille, plusVieux] }) }), { ...o, graine }), w)
  }
  // Figée, elle se relit telle quelle : un jeu livré dans la journée ne la change pas.
  const figee: VisiteFigee = { jour: JOUR, cases: [{ jeu: 'pari', cible: 'plume', but: 'gagner' }], echange: 0 }
  assert.deepEqual(visiteDuJour(museeDe({ jour: JOUR, profil: profil({ visites: [figee] }) }), o), { jour: JOUR, cases: figee.cases, echange: 0, figee: true })
  // Moins de trois jeux livrés : moins de cases, jamais deux fois le même jeu.
  assert.deepEqual(visiteDuJour(m, { ...o, jeux: ['pari', 'eclair'] }).cases.map(c => c.jeu).sort(), ['eclair', 'pari'])
  assert.deepEqual(visiteDuJour(m, { ...o, jeux: [] }).cases, [])
  // Elle garde les trois derniers jours, le sien d'abord.
  const gardees = visitesAGarder(v, [{ jour: jourAvant(JOUR), cases: [] }, { jour: jourAvant(JOUR, 2), cases: [] }, { jour: jourAvant(JOUR, 3), cases: [] }])
  assert.deepEqual(gardees.map(x => x.jour), [JOUR, jourAvant(JOUR), jourAvant(JOUR, 2)])
})

test('les œuvres de la visite : trois distinctes parmi ce qui lui manquait à minuit, au poids de leur rareté ; puis à dorer ; puis la poussière', () => {
  const o = { graine: 'secret:profil', jour: JOUR, minuit: MINUIT, jeux: NEUF }
  // Il ne lui en manque que trois : ce sont elles.
  const trois = ['bastion', 'plume', 'surmenage']
  const v = visiteDuJour(museeDe({ jour: JOUR, oeuvres: sauf([...trois, ...OEUVRES_DE_DEPART]) }), o)
  assert.deepEqual(v.cases.map(c => c.cible).sort(), [...trois].sort())
  assert.ok(v.cases.every(c => c.but === 'gagner'))
  // Gagnée depuis minuit, elle manquait encore au matin : la visite ne change pas pendant le jour.
  const matin = visiteDuJour(museeDe({ jour: JOUR, oeuvres: [...sauf([...trois, ...OEUVRES_DE_DEPART]), ligne('plume', { gagneeLe: MIDI })] }), o)
  assert.ok(matin.cases.some(c => c.cible === 'plume'))
  // Rien ne lui manque : à dorer ; tout est doré : la poussière.
  const aDorer = visiteDuJour(museeDe({ jour: JOUR, oeuvres: [...sauf(['plume']), ligne('plume')].map(l => (l.oeuvre === 'plume' ? l : { ...l, doreeLe: MINUIT - S })) }), o)
  assert.deepEqual(aDorer.cases.map(c => [c.cible, c.but]), [['plume', 'dorer'], [null, null], [null, null]])
  const rien = visiteDuJour(museeDe({ jour: JOUR, oeuvres: tout({ doreeLe: MINUIT - S }) }), o)
  assert.ok(rien.cases.every(c => c.cible === null && c.but === null))
  // Au poids : surtout des communes, une épique de temps en temps.
  const compte: Record<string, number> = {}
  for (let n = 0; n < 2000; n++) {
    const cible = visiteDuJour(museeDe({ jour: JOUR }), { ...o, graine: `p${n}` }).cases[0].cible!
    const rarete = OEUVRES.find(x => x.cle === cible)!.rarete
    compte[rarete] = (compte[rarete] ?? 0) + 1
  }
  assert.ok(compte.commun / 2000 > 0.55 && compte.commun / 2000 < 0.7, JSON.stringify(compte))
  assert.ok((compte.epique ?? 0) / 2000 < 0.12, JSON.stringify(compte))
})

test('l’échange : une fois par jour, une case pas jouée, un jeu ni de la visite ni des deux jours d’avant', () => {
  const o = { graine: 'secret:profil', jour: JOUR, minuit: MINUIT, jeux: NEUF }
  const veille: VisiteFigee = { jour: jourAvant(JOUR), cases: NEUF.slice(0, 3).map(jeu => ({ jeu, cible: null, but: null })) }
  const m = museeDe({ jour: JOUR, profil: profil({ visites: [veille] }) })
  const v = visiteDuJour(m, o)
  const jeu = jeuDeLEchange(m, v, o)!
  assert.ok(jeu && !v.cases.some(c => c.jeu === jeu) && !veille.cases.some(c => c.jeu === jeu))
  assert.equal(refusDeLEchange(m, v, 1, jeu), null)
  const echangee = visiteEchangee(v, 1, jeu)
  assert.equal(echangee.cases[1].jeu, jeu)
  assert.equal(echangee.cases[1].cible, v.cases[1].cible, 'l’œuvre en jeu reste')
  assert.equal(refusDeLEchange(m, echangee, 0, jeu), 'Tu as déjà changé un jeu aujourd’hui')
  const jouee = museeDe({ jour: JOUR, parties: [partieDuJour({ origine: 'visite', visite: 1 })] })
  // Les mêmes mots que le départ de cette case : la page disait « déjà jouée » d'un bouton, « déjà faite » de l'autre.
  assert.equal(refusDeLEchange(jouee, v, 1, jeu), 'Cette partie de la visite est déjà faite')
  assert.equal(refusDeLEchange(jouee, v, 1, jeu), refusDuDepart(jouee, { origine: 'visite', case: 1, carte: null }, v, NEUF))
  assert.equal(refusDeLEchange(m, v, 7, jeu), 'Choisis une partie de la visite')
  // Trois jeux livrés, tous dans la visite : rien à proposer.
  const seuls = visiteDuJour(m, { ...o, jeux: ['pari', 'eclair', 'mot'] })
  assert.equal(jeuDeLEchange(m, seuls, { ...o, jeux: ['pari', 'eclair', 'mot'] }), null)
  assert.equal(refusDeLEchange(m, seuls, 0, null), 'Aucun autre jeu à proposer aujourd’hui')
})

test('commencer : les refus en mots, une seule règle que la page lit pour griser', () => {
  const o = { graine: 'secret:profil', jour: JOUR, minuit: MINUIT, jeux: NEUF }
  const m = museeDe({ jour: JOUR })
  const v = visiteDuJour(m, o)
  const refus = (mu: Musee, d: Parameters<typeof refusDuDepart>[1], jeux = NEUF) => refusDuDepart(mu, d, v, jeux)
  assert.equal(refus(museeDe({ jour: JOUR, enCours: { id: 'p', jeu: 'filet' } }), { origine: 'libre', jeu: 'mot', carte: null }), 'Ta partie au Filet t’attend : reprends-la ou quitte-la d’abord')
  assert.equal(refus(museeDe({ jour: JOUR, parties: [partieDuJour({ origine: 'visite', visite: 0 })] }), { origine: 'visite', case: 0, carte: null }), 'Cette partie de la visite est déjà faite')
  assert.equal(refus(m, { origine: 'visite', case: 3, carte: null }), 'Choisis une partie de la visite')
  const deuxChasses = museeDe({ jour: JOUR, parties: [partieDuJour({ origine: 'chasse' }), partieDuJour({ origine: 'chasse' })] })
  assert.equal(refus(deuxChasses, { origine: 'chasse', oeuvre: 'bastion', carte: null }), 'Plus de chasse pour aujourd’hui : elles reviennent à minuit')
  // Les chasses se comptent avant le jeu : une œuvre d'un jeu pas encore livré se refuse d'abord faute de chasse — l'ordre que la
  // page suit, et que le serveur, ses neuf jeux livrés, ne peut plus montrer (`cabinet-poussiere.test.ts`).
  const sansSonJeu = NEUF.filter(j => j !== JEU_DE_L_OEUVRE.bastion)
  assert.equal(refus(deuxChasses, { origine: 'chasse', oeuvre: 'bastion', carte: null }, sansSonJeu), 'Plus de chasse pour aujourd’hui : elles reviennent à minuit')
  assert.equal(refus(m, { origine: 'chasse', oeuvre: 'bastion', carte: null }, sansSonJeu), 'Ce jeu arrive bientôt')
  assert.equal(refus(m, { origine: 'chasse', oeuvre: 'bastion', carte: null, jeu: 'pari' }), `Cette œuvre se trouve à l’Épingle`)
  assert.equal(refus(m, { origine: 'chasse', case: 0, retente: true, carte: null }), 'Retenter ne sert qu’après une partie de la visite manquée')
  assert.equal(refus(museeDe({ jour: JOUR, oeuvres: [ligne('bastion', { doreeLe: MIDI })] }), { origine: 'chasse', oeuvre: 'bastion', carte: null }), 'Cette œuvre est déjà dorée')
  // Une demande qui ne se lit pas — une origine inconnue, un départ relu de travers — se dit dans les mots du serveur, une seule copie.
  assert.equal(refus(m, { origine: 'ailleurs' } as unknown as Parameters<typeof refusDuDepart>[1]), DEMANDE_ILLISIBLE)
  assert.equal(DEMANDE_ILLISIBLE, 'Choisis une partie de la visite, une chasse ou un jeu libre')
  assert.equal(refus(m, { origine: 'chasse', oeuvre: 'lg:phenix', carte: null }), 'Cette œuvre n’est pas au Cabinet')
  assert.equal(refus(m, { origine: 'libre', jeu: 'rebus', carte: null }), 'Choisis un des neuf jeux')
  assert.equal(refus(m, { origine: 'libre', jeu: 'mot', carte: null }, ['pari']), 'Ce jeu arrive bientôt')
  assert.equal(refus(m, { origine: 'libre', jeu: 'mot', carte: 'bastion' }), 'Tu n’as pas cette carte-bonus')
  assert.equal(refus(m, { origine: 'libre', jeu: 'mot', carte: 'lg:phenix' }), 'Tu n’as pas cette carte-bonus', 'un gardien qui dort')
  assert.equal(refus(m, { origine: 'libre', jeu: 'mot', carte: 'lg:licorne' }), 'Tu n’as pas cette carte-bonus', 'un légendaire sans joker')
  // Ce qui passe : le cadre figé au départ — le jeu, l'œuvre, le seuil, la carte et sa force.
  assert.deepEqual(cadreDuDepart(m, { origine: 'libre', jeu: 'mot', carte: 'coup-d-oeil' }, v, NEUF), {
    jeu: 'mot',
    origine: 'libre',
    cible: null,
    but: null,
    seuil: null,
    payee: true,
    carte: { cle: 'coup-d-oeil', pouvoir: 'eclairer', force: 1 },
  })
  const phenix = cadreDuDepart(museeDe({ jour: JOUR, legendaires: ['lg:phenix'] }), { origine: 'chasse', oeuvre: 'bastion', carte: 'lg:phenix' }, v, NEUF)
  assert.deepEqual(phenix, { jeu: JEU_DE_L_OEUVRE.bastion, origine: 'chasse', cible: 'bastion', but: 'gagner', seuil: B.SEUILS_DES_RARETES.epique, payee: true, carte: { cle: 'lg:phenix', pouvoir: 'proteger', force: 3 } })
  // Retenter : après une visite manquée, par sa case — jamais par l'œuvre, que la page ne sait pas —, au jeu de la visite.
  const manquee = museeDe({ jour: JOUR, parties: [partieDuJour({ origine: 'visite', visite: 0, cible: 'bastion', issue: 'manquee', jeu: 'pari' })] })
  assert.deepEqual(cadreDuDepart(manquee, { origine: 'chasse', case: 0, retente: true, carte: null }, v, NEUF), {
    jeu: 'pari',
    origine: 'chasse',
    cible: 'bastion',
    but: 'gagner',
    retente: true,
    seuil: B.SEUILS_DES_RARETES.epique,
    payee: true,
    carte: null,
  })
  // La visite : sa case, son œuvre, son seuil ; gagnée depuis le matin, elle se joue pour la dorer.
  const c = v.cases[0]
  const cadre = cadreDuDepart(museeDe({ jour: JOUR, oeuvres: [ligne(c.cible!, { gagneeLe: MIDI })] }), { origine: 'visite', case: 0, carte: null }, v, NEUF)
  assert.deepEqual(cadre, { jeu: c.jeu, origine: 'visite', visite: 0, cible: c.cible, but: 'dorer', seuil: B.SEUILS_DES_RARETES[OEUVRES.find(x => x.cle === c.cible)!.rarete], payee: true, carte: null })
  // Les libres qui paient : cinq par jour.
  const cinq = museeDe({ jour: JOUR, parties: Array.from({ length: B.LIBRES_QUI_PAIENT }, () => partieDuJour({ origine: 'libre' })) })
  assert.equal((cadreDuDepart(cinq, { origine: 'libre', jeu: 'mot', carte: null }, v, NEUF) as { payee: boolean }).payee, false)
})

test('« Retenter » vise la case de la visite manquée, jamais l’œuvre : ses refus ne disent que la case, et la page lit son verdict', () => {
  const o = { graine: 'secret:profil', jour: JOUR, minuit: MINUIT, jeux: NEUF }
  const v = visiteDuJour(museeDe({ jour: JOUR }), o)
  const visee = v.cases[1].cible!
  // Une case venue du téléphone peut être n'importe quoi : la règle la relit.
  const sansCarte = (k: unknown) => ({ origine: 'chasse', case: k as number, retente: true, carte: null }) as const
  const refus = (mu: Musee, k: unknown) => refusDuDepart(mu, sansCarte(k), v, NEUF)
  const manquee = partieDuJour({ id: 'la-visite', origine: 'visite', visite: 1, cible: visee, issue: 'manquee', jeu: v.cases[1].jeu, commenceeLe: MIDI })
  const m = museeDe({ jour: JOUR, parties: [manquee] })

  // Elle part au jeu de la case, l'œuvre qu'elle visait en jeu, et prend une chasse.
  const cadre = cadreDuDepart(m, sansCarte(1), v, NEUF)
  assert.deepEqual(typeof cadre === 'string' ? cadre : [cadre.origine, cadre.jeu, cadre.cible, cadre.retente], ['chasse', v.cases[1].jeu, visee, true])
  // Ses refus, mot pour mot — chacun ne dit que la case, que la page connaît : jouée ou non, manquée ou non.
  assert.equal(refus(m, 0), RETENTER_SANS_VISITE_MANQUEE, 'une case pas jouée')
  assert.equal(refus(museeDe({ jour: JOUR, parties: [{ ...manquee, issue: 'gagnee' }] }), 1), RETENTER_SANS_VISITE_MANQUEE, 'une case gagnée')
  for (const k of [3, -1, 1.5, '1', null]) assert.equal(refus(m, k), CHOISIS_UNE_CASE, String(k))
  const deuxChasses = museeDe({ jour: JOUR, parties: [manquee, partieDuJour({ origine: 'chasse' }), partieDuJour({ origine: 'chasse' })] })
  assert.equal(refus(deuxChasses, 1), PLUS_DE_CHASSE)
  // Gagnée depuis, ailleurs — une chasse, un achat — : elle est à lui, plus rien à retenter.
  const gagneeDepuis = museeDe({ jour: JOUR, parties: [manquee], oeuvres: [ligne(visee, { origine: 'achat', gagneeLe: MIDI + 60 * S })] })
  assert.equal(refus(gagneeDepuis, 1), SON_OEUVRE_EST_A_TOI)
  assert.equal(refus(museeDe({ jour: JOUR, parties: [manquee], enCours: { id: 'p', jeu: 'filet' } }), 1), laPartieAttend('filet'))

  // Ce que la page en montre, case par case : la règle des départs même, sans la carte-bonus, qui n'y change rien.
  assert.equal(retenteDeLaCase(museeDe({ jour: JOUR }), v, 1, NEUF), null, 'une case pas jouée ne propose rien')
  assert.deepEqual(retenteDeLaCase(m, v, 1, NEUF), { possible: true })
  assert.deepEqual(retenteDeLaCase(deuxChasses, v, 1, NEUF), { possible: false, refus: PLUS_DE_CHASSE })
  assert.deepEqual(retenteDeLaCase(gagneeDepuis, v, 1, NEUF), { possible: false, refus: SON_OEUVRE_EST_A_TOI })
  // Ce qui ne se fera jamais se dit avant ce qui attend, comme pour un achat : son œuvre à lui, ni la partie finie ni
  // minuit ne rouvriront la retente — « Plus de chasse », « Ta partie t'attend » la promettaient pour plus tard, sous la
  // case et au bilan relu. Le départ le dit dans le même ordre : la case et son toast ne se contredisent pas.
  const aLui = (mu: Partial<Parameters<typeof museeDe>[0]>) => museeDe({ jour: JOUR, oeuvres: [ligne(visee, { origine: 'achat', gagneeLe: MIDI + 60 * S })], ...mu })
  for (const [quoi, mu] of [
    ['les chasses prises', aLui({ parties: [manquee, partieDuJour({ origine: 'chasse' }), partieDuJour({ origine: 'chasse' })] })],
    ['une partie qui attend', aLui({ parties: [manquee], enCours: { id: 'p', jeu: 'filet' } })],
    ['les deux', aLui({ parties: [manquee, partieDuJour({ origine: 'chasse' }), partieDuJour({ origine: 'chasse' })], enCours: { id: 'p', jeu: 'filet' } })],
  ] as const) {
    assert.deepEqual(retenteDeLaCase(mu, v, 1, NEUF), { possible: false, refus: SON_OEUVRE_EST_A_TOI }, quoi)
    assert.equal(refus(mu, 1), SON_OEUVRE_EST_A_TOI, `${quoi} : le départ`)
  }
  // Une œuvre qui lui manque encore garde l'ordre de toute chasse : la partie qui attend, puis plus de chasse.
  assert.deepEqual(retenteDeLaCase(museeDe({ jour: JOUR, parties: [manquee], enCours: { id: 'p', jeu: 'filet' } }), v, 1, NEUF), { possible: false, refus: laPartieAttend('filet') })
  // Une case « pour dorer » manquée : son œuvre était à lui avant la partie — rien à retenter, rien à dire.
  const aLuiAvant = museeDe({ jour: JOUR, parties: [manquee], oeuvres: [ligne(visee, { gagneeLe: MIDI - 60 * S })] })
  assert.equal(retenteDeLaCase(aLuiAvant, v, 1, NEUF), null)
  // Jamais l'œuvre : ni le verdict, ni ses refus ne la nomment.
  for (const mu of [m, deuxChasses, gagneeDepuis]) assert.ok(!JSON.stringify(retenteDeLaCase(mu, v, 1, NEUF)).includes(visee))
})

test('la retente dit par où la page l’envoie : la demande que le serveur lit, `DemandeLue`, par `api.cabinet.commencer` et `PartieDemandee`', () => {
  // Son commentaire disait que la page « ne propose pas encore la retente » : elle la propose, sous la case et au bilan,
  // et qui le lisait cherchait un chemin qui n'existait plus.
  const musee = readFileSync(new URL('../../shared/cabinet/musee.ts', import.meta.url), 'utf8')
  const avant = musee.slice(0, musee.indexOf('export type DemandeDeRetente'))
  const commentaire = avant.slice(avant.lastIndexOf('/**'))
  assert.doesNotMatch(commentaire, /pas encore/, 'la page propose la retente')
  for (const nom of ['DemandeLue', 'api.cabinet.commencer', 'PartieDemandee']) assert.ok(commentaire.includes(`\`${nom}\``), `le commentaire nomme ${nom}`)
  // Ce qu'il nomme existe tel quel côté page.
  const api = readFileSync(new URL('../../client/src/api.ts', import.meta.url), 'utf8')
  const ecrans = readFileSync(new URL('../../client/src/views/cabinet/ecrans.ts', import.meta.url), 'utf8')
  assert.match(api, /commencer: \(demande: DemandeLue\)/)
  assert.match(ecrans, /export type PartieDemandee = SansCarte<DemandeLue>/)
})

test('le seuil d’une case : celui que son départ figera — gagner son œuvre, ou son double quand elle est à lui', () => {
  const o = { graine: 'secret:profil', jour: JOUR, minuit: MINUIT, jeux: NEUF }
  const v = visiteDuJour(museeDe({ jour: JOUR }), o)
  for (const [k, c] of v.cases.entries()) {
    const cadre = cadreDuDepart(museeDe({ jour: JOUR }), { origine: 'visite', case: k, carte: null }, v, NEUF)
    assert.equal(seuilDeLaCase(c), typeof cadre === 'string' ? cadre : cadre.seuil, `case ${k}`)
    assert.equal(seuilDeLaCase(c), B.SEUILS_DES_RARETES[OEUVRES.find(x => x.cle === c.cible)!.rarete])
  }
  assert.equal(seuilDeLaCase({ cible: null }), null, 'une case pour la poussière d’or')
})

test('les refus n’ont qu’une copie : le magasin importe ceux de la règle des départs et du pli, il ne les recopie pas', () => {
  const magasin = readFileSync(new URL('../src/core/cabinet/magasin.ts', import.meta.url), 'utf8')
  for (const phrase of [DEMANDE_ILLISIBLE, ILLISIBLE, CASE_DEJA_FAITE, CHOISIS_UNE_CASE]) assert.ok(!magasin.includes(`'${phrase}'`), `le magasin recopie « ${phrase} »`)
  // La règle des départs et celle des échanges disent une case commencée dans les mêmes mots, d'une seule constante.
  const musee = readFileSync(new URL('../../shared/cabinet/musee.ts', import.meta.url), 'utf8')
  for (const phrase of [CASE_DEJA_FAITE, CHOISIS_UNE_CASE]) assert.equal(musee.split(`'${phrase}'`).length - 1, 1, `« ${phrase} » écrite une fois`)
  assert.ok(!musee.includes('est déjà jouée\''), 'la phrase d’avant de l’échange, revenue')
})

test('la retente ne se dit que par sa case, au calibrage aussi : la forme qui nommait son œuvre est partie', () => {
  // Le calibrage joue les deux côtés et savait l'œuvre qu'une case visait : la règle des départs lisait sa forme pour lui
  // (`RetenteDuCalibrage`), et la ramenait à la case. Il vise la case depuis le 26 octobre 2026 : plus rien ne la nomme, et
  // `cadreDuDepart` ne lit que ce que la page peut envoyer — une forme de plus y rouvrirait l'oracle de l'ordre des refus
  // (`cabinet-secret.test.ts`).
  const racine = new URL('../../', import.meta.url)
  const nommee = ['shared', 'server/src', 'server/scripts', 'client/src'].flatMap(dossier =>
    readdirSync(new URL(`${dossier}/`, racine), { recursive: true, encoding: 'utf8' })
      .filter(f => /\.tsx?$/.test(f) && readFileSync(new URL(`${dossier}/${f}`, racine), 'utf8').includes('RetenteDuCalibrage'))
      .map(f => `${dossier}/${f.replace(/\\/g, '/')}`),
  )
  assert.deepEqual(nommee, [])
  const calibrage = readFileSync(new URL('../scripts/calibrage-cabinet.ts', import.meta.url), 'utf8')
  assert.match(calibrage, /origine: 'chasse', case: [^,]+, retente: true/, 'le calibrage retente par la case')
  assert.doesNotMatch(calibrage, /oeuvre: [^,]+, carte: [^,]+, retente: true/, 'une retente qui nomme son œuvre')
  // Et la règle des départs refuse une retente qui ne dit pas sa case, même du calibrage : nommer l'œuvre ne la désigne plus.
  const m = museeDe({ jour: JOUR, profil: profil(), parties: [] })
  const v = visiteDuJour(m, { graine: 'g', jour: JOUR, minuit: MINUIT, jeux: NEUF })
  assert.equal(cadreDuDepart(m, { origine: 'chasse', oeuvre: v.cases[0].cible, carte: null, retente: true } as unknown as DemandeLue, v, NEUF), CHOISIS_UNE_CASE)
})

test('acheter, dorer : les refus en mots, le prix montré, le solde', () => {
  const m = museeDe({ jour: JOUR, profil: profil({ poussiere: 280 }), oeuvres: [ligne('plume', { doreeLe: MIDI })] })
  assert.equal(refusDeLAchat(m, 'lg:phenix', 0, 'achat'), 'Un gardien ne s’achète pas : il se réveille')
  assert.equal(refusDeLAchat(m, 'constructor', 0, 'achat'), 'Cette œuvre n’est pas au Cabinet')
  assert.equal(refusDeLAchat(m, 'prudence', 200, 'achat'), 'Elle est déjà à toi', 'une œuvre de départ')
  assert.equal(refusDeLAchat(m, 'bastion', 400, 'achat'), 'Le prix a changé : 700 poussières d’or. Réessaie.')
  assert.equal(refusDeLAchat(m, 'bastion', B.PRIX_D_UNE_OEUVRE.epique, 'achat'), 'Il te manque 420 poussières d’or')
  assert.equal(refusDeLAchat(m, 'memoire', B.PRIX_D_UNE_OEUVRE.commun, 'achat'), null)
  assert.equal(refusDeLAchat(m, 'bastion', B.PRIX_D_UNE_DORURE.epique, 'dorure'), 'Elle n’est pas encore à toi : gagne-la ou achète-la d’abord')
  assert.equal(refusDeLAchat(m, 'plume', B.PRIX_D_UNE_DORURE.commun, 'dorure'), 'Son cadre est déjà doré')
  assert.equal(refusDeLAchat(m, 'prudence', B.PRIX_D_UNE_DORURE.commun, 'dorure'), null)
  assert.equal(refusDeLAchat(museeDe({ jour: JOUR, profil: profil({ poussiere: 199 }) }), 'memoire', 200, 'achat'), 'Il te manque 1 poussière d’or')
  // Une partie qui attend : rien ne se dépense, quelle que soit l'œuvre — celle qu'elle vise ne se distingue pas des
  // autres. Ce qui ne se ferait jamais garde son refus à lui.
  const enPartie = museeDe({ jour: JOUR, profil: profil({ poussiere: 2000 }), oeuvres: [ligne('plume', { doreeLe: MIDI })], enCours: { id: 'p', jeu: 'filet' } })
  for (const [cle, sorte] of [['memoire', 'achat'], ['bastion', 'achat'], ['prudence', 'dorure']] as const)
    assert.equal(refusDeLAchat(enPartie, cle, prixDe(cle, sorte), sorte), 'Ta partie au Filet t’attend : reprends-la ou quitte-la d’abord', cle)
  assert.equal(refusDeLAchat(enPartie, 'prudence', 200, 'achat'), 'Elle est déjà à toi')
  assert.equal(refusDeLAchat(enPartie, 'plume', B.PRIX_D_UNE_DORURE.commun, 'dorure'), 'Son cadre est déjà doré')
})

test('les vues dépliées : un composé de l’Éclair vaut une vue de chacune de ses questions, la plus récente l’emporte', () => {
  const vues = vuesDuCabinet(new Map([['cab:eclair:a+b+c', 10], ['b', 20], ['cab:lieu:x', 5], ['cab:frise:s:d+e', 7]]))
  assert.deepEqual(Object.fromEntries(vues), { a: 10, b: 20, c: 10, 'cab:lieu:x': 5, d: 7, e: 7 })
  // Une frise de l'Expédition tient en une ligne, ses questions jointes : ses événements, dévoilés avec leur année, sont
  // vus comme ceux d'une frise du Cabinet — le Pari ne repose pas la semaine même la question dont elle a dit l'année.
  const avecLExpedition = vuesDuCabinet(new Map([[`${PREFIXE_DE_LA_FRISE}f+g+b`, 30], ['g', 40]]))
  assert.deepEqual(Object.fromEntries(avecLExpedition), { f: 30, g: 40, b: 30 })
})

test('le pouvoir de la carte-bonus, maintenant : la vue le porte, la page grise sans rien recopier', () => {
  assert.equal(pouvoirMaintenant(departDe('mot'), ETAT_DU_DEPART, MIDI), null, 'sans carte')
  const temps = departDe('mot', { carte: carte('temps', 1, 'concentration') })
  assert.deepEqual(pouvoirMaintenant(temps, ETAT_DU_DEPART, MIDI), { jouable: false, refus: 'Prendre son temps agit tout seul' })
  const miser = new Partie(departDe('mot', { carte: carte('miser', 1, 'tout-ou-rien') }))
  assert.deepEqual(pouvoirMaintenant(miser.depart, miser.etat, MIDI), { jouable: true }, 'avant la première manche')
  miser.joue(ouvrir(0), MIDI)
  assert.equal(pouvoirMaintenant(miser.depart, miser.etat, MIDI)?.refus, 'La mise se décide avant de voir la manche')
  const eclairer = new Partie(departDe('mot', { carte: carte('eclairer', 1) }))
  assert.equal(pouvoirMaintenant(eclairer.depart, eclairer.etat, MIDI)?.refus, 'Cette manche n’est pas encore ouverte')
  eclairer.joue(ouvrir(0), MIDI)
  assert.deepEqual(pouvoirMaintenant(eclairer.depart, eclairer.etat, MIDI + S), { jouable: true })
  assert.equal(pouvoirMaintenant(eclairer.depart, eclairer.etat, MIDI + 200 * S)?.refus, 'Le temps de cette manche est écoulé')
})

test('le pli ne garde aucune trace de sa graine dans ce qu’il range : les pièces ne la portent pas', () => {
  const p = jouerLeScenario('pari', departDe('pari', { graine: 'secret-du-serveur-1234' }))
  assert.ok(!JSON.stringify(p.etat.pieces).includes('secret-du-serveur-1234'))
  assert.ok(!JSON.stringify(bilanDe(p.depart, p.etat, null)).includes('secret-du-serveur-1234'))
  // Et chaque hasard que les règles rejouent part d'une graine que le serveur tient — celle de la partie, celle de la
  // visite —, jamais de ce que la page connaît seul : son profil, sa partie, un rang.
  const dossier = new URL('../../shared/cabinet/', import.meta.url)
  const appels = readdirSync(dossier, { recursive: true, encoding: 'utf8' })
    .filter(f => f.endsWith('.ts'))
    .flatMap(f =>
      readFileSync(new URL(f, dossier), 'utf8')
        .split('\n')
        .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .flatMap(l => [...l.matchAll(/hasardDe\(([^)]*)\)/g)].map(a => `${f} : ${a[1]}`)),
    )
  assert.ok(appels.length >= 3, appels.join('\n'))
  for (const a of appels) assert.match(a, /: `\$\{(?:\w+\.)?graine\}:/, `un hasard qui ne part pas d'une graine secrète — ${a}`)
})
