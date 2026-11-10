// L'album des trophées (la maquette 1, choisie par le propriétaire le
// 13 octobre 2026) : une page par mode, et sous chaque trophée qui monte, sa
// piste — chaque étape, son métal, ce qu'elle ouvre.
//
// Les pistes se lisent dans les règles qui ouvrent chaque chose — les
// gerbes, les thèmes, les légendaires disent les leurs ; les fonds n'ont
// qu'une fonction, leur étape est écrite à la main dans `shared/pistes.ts` :
// ce fichier la vérifie contre elle, une étape fausse promettrait un fond
// qui ne vient pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { ABSORBES, DU_CHAMPION_DU_MOIS, ceQuIlOuvre, ceQuOuvreLeTrophee, etapesDeLaPiste } from '../../shared/pistes'
import { albumDesTrophees, compteDesTrophees, ouJouer, pageDuDebutDesTrophees, seuilDeLEtape } from '../../shared/trophees'
import { pageDuTrophee } from '../../shared/pagesDesTrophees'
import { FONDS, fondsOuverts, type CeQuOuvreUnFond } from '../../shared/fonds'
import { GERBES } from '../../shared/gerbes'
import { THEMES, themeGagne } from '../../shared/themes'
import { LEGENDAIRES, PREFIXES_DES_VOIES_RANGEES, estUneVoieRangee, partiesDe, voiesDe } from '../../shared/legendaires'
import { HAUTS_FAITS_DE_CARRIERE, HAUTS_FAITS_REGAGNABLES, clePalier, hautFait, type HautFaitVu } from '../../shared/hautsfaits'
import { SEUILS_DU_LAURIER } from '../../shared/jour'
import { voieDeLExpeditionDite } from '../../shared/jokers'
import { CONFETTIS_D_UN_RANG } from '../../shared/cabinet/bareme'
import { NOMS_DES_DEFIS, PHRASES_DES_DEFIS } from '../../shared/cabinet/sceaux'
import { CARTES_PEINTES } from '../../client/src/components/cartes-peintes'

const lieu = { pathname: '/profil', search: '', hash: '', origin: 'http://banc' }
Object.assign(globalThis, { React, window: { location: lieu }, location: lieu })

/** Ce qu'un profil a fait tomber à une valeur d'une piste : ses métaux, comme le serveur les range. */
function rangesA(piste: string, valeur: number): Map<string, number> {
  const ranges = new Map<string, number>()
  const h = hautFait(piste)
  if (h?.famille === 'carriere') h.paliers.forEach((seuil, i) => valeur >= seuil && ranges.set(clePalier(piste, i + 1), 1))
  // Ce qu'une piste absorbe se compte avec elle : Le Laurier, une fois par victoire.
  for (const [absorbe, p] of Object.entries(ABSORBES)) if (p === piste && valeur > 0) ranges.set(absorbe, valeur)
  return ranges
}

/** Ce que la règle des fonds lit d'un profil arrivé à une valeur d'une piste. */
function etatDuFond(piste: string, valeur: number): CeQuOuvreUnFond {
  return {
    niveau: piste === 'hf:legende' ? valeur : 1,
    jour: { joues: piste === 'hf:assidu' ? valeur : 0, victoires: piste === 'hf:champion-du-jour' ? valeur : 0 },
    recompenses: rangesA(piste, valeur),
    maitres: piste === 'maitres' ? valeur : 0,
  }
}

test('chaque fond est sur sa piste, à l’étape même où sa règle l’ouvre — le Triomphe au titre de champion du mois', () => {
  let ranges = 0
  for (const piste of [...HAUTS_FAITS_DE_CARRIERE.map(h => h.key), 'maitres', 'pages']) {
    for (const etape of etapesDeLaPiste(piste)) {
      for (const r of etape.recompenses.filter(x => x.sorte === 'fond')) {
        ranges++
        assert.ok(fondsOuverts(etatDuFond(piste, etape.seuil)).includes(r.cle as never), `${r.cle} ouvert à ${etape.seuil} sur ${piste}`)
        assert.ok(!fondsOuverts(etatDuFond(piste, etape.seuil - 1)).includes(r.cle as never), `${r.cle} pas avant ${etape.seuil} sur ${piste}`)
      }
    }
  }
  // Tous, sauf celui du champion du mois, ceux du trésor, que seul le coffre de la semaine donne,
  // et ceux des savoirs, que seule la boutique vend.
  const duTresor = FONDS.filter(f => f.tresor)
  const enBoutique = FONDS.filter(f => f.savoir)
  assert.equal(duTresor.length, 6)
  assert.equal(enBoutique.length, 12)
  assert.equal(ranges, FONDS.length - 1 - duTresor.length - enBoutique.length)
  // Un fond des savoirs n'est à lui que s'il l'a acheté — pas même au niveau 100, ni d'un coffre.
  for (const f of enBoutique) {
    assert.ok(!fondsOuverts({ niveau: 100, jour: { joues: 999, victoires: 999 }, recompenses: new Map(), maitres: 12, tresors: new Set([`fond:${f.key}`]) }).includes(f.key), f.key)
    assert.ok(fondsOuverts({ niveau: 1, jour: { joues: 0, victoires: 0 }, recompenses: new Map(), achetes: new Set([f.key]) }).includes(f.key), f.key)
  }
  assert.deepEqual(DU_CHAMPION_DU_MOIS.map(r => r.cle), ['triomphe'])
  assert.ok(fondsOuverts({ niveau: 1, jour: { joues: 0, victoires: 0 }, recompenses: new Map([['mois:2026-10', 1]]) }).includes('triomphe'))
  // Un fond du trésor n'est à lui que si un coffre le lui a donné — pas même au niveau 100.
  for (const f of duTresor) {
    assert.ok(!fondsOuverts({ niveau: 100, jour: { joues: 999, victoires: 999 }, recompenses: new Map(), maitres: 12 }).includes(f.key), f.key)
    assert.ok(fondsOuverts({ niveau: 1, jour: { joues: 0, victoires: 0 }, recompenses: new Map(), tresors: new Set([`fond:${f.key}`]) }).includes(f.key), f.key)
  }
})

test('chaque thème qui se gagne, chaque gerbe et chaque légendaire sont sur la piste ou le trophée qui les ouvre', () => {
  // Les thèmes : à l'étape où `themeGagne` les donne, et pas avant.
  const pages = (n: number) => new Map(Array.from({ length: n }, (_, i) => [`heures:${String(i + 1).padStart(2, '0')}`, 1] as [string, number]))
  for (const t of THEMES.filter(x => x.gagne)) {
    const ou = [...HAUTS_FAITS_DE_CARRIERE.map(h => h.key), 'maitres', 'pages'].flatMap(piste =>
      etapesDeLaPiste(piste)
        .filter(e => e.recompenses.some(r => r.sorte === 'theme' && r.cle === t.key))
        .map(e => ({ piste, seuil: e.seuil })),
    )
    assert.equal(ou.length, 1, `${t.key} : une étape`)
    const { piste, seuil } = ou[0]
    const etat = (v: number) => ({ maitres: piste === 'maitres' ? v : 0, recompenses: piste === 'pages' ? pages(v) : rangesA(piste, v) })
    assert.ok(themeGagne(t, etat(seuil)), `${t.key} à ${seuil}`)
    assert.ok(!themeGagne(t, etat(seuil - 1)), `${t.key} pas avant ${seuil}`)
  }
  // Les gerbes : chacune une fois, sur une étape de piste ou un trophée qui se regagne — celles du trésor nulle part :
  // seul un coffre les donne ; celles des fêtes non plus : leur saison les ouvre, comme son légendaire, sans piste.
  for (const g of GERBES.filter(x => !('profil' in x.par))) {
    const surLesPistes = HAUTS_FAITS_DE_CARRIERE.flatMap(h => etapesDeLaPiste(h.key)).filter(e => e.recompenses.some(r => r.sorte === 'gerbe' && r.cle === g.key)).length
    const surLesTrophees = HAUTS_FAITS_REGAGNABLES.flatMap(h => ceQuOuvreLeTrophee(h.key)).filter(x => x.recompense.sorte === 'gerbe' && x.recompense.cle === g.key).length
    assert.equal(surLesPistes + surLesTrophees, 'tresor' in g.par || 'fete' in g.par || 'defis' in g.par ? 0 : 1, g.key)
  }
  // Les légendaires : chaque partie de chaque voie dit ce qu'elle ouvre — hors des voies rangées (les saisons,
  // l'expédition, le Cabinet, et le timbre d'une fête depuis le 1er novembre 2026), qui n'ont pas de piste : on les a, ou non.
  assert.deepEqual([...PREFIXES_DES_VOIES_RANGEES], ['saison:', 'expedition:', 'cabinet:', 'timbre:'])
  for (const l of LEGENDAIRES) {
    for (const voie of voiesDe(l)) {
      for (const c of partiesDe(voie)) {
        if (estUneVoieRangee(c.hautFait)) {
          assert.deepEqual(ceQuOuvreLeTrophee(c.hautFait), [], `${c.hautFait} n’est pas un trophée`)
          continue
        }
        const ouvre =
          'palier' in c
            ? ceQuIlOuvre(clePalier(c.hautFait, c.palier))
            : ABSORBES[c.hautFait]
              ? etapesDeLaPiste(ABSORBES[c.hautFait]).find(e => e.seuil === c.fois)?.recompenses ?? []
              : ceQuOuvreLeTrophee(c.hautFait).filter(x => x.fois === c.fois).map(x => x.recompense)
        assert.ok(ouvre.some(r => r.sorte === 'legendaire' && r.cle === l.key), `${l.key} : ${JSON.stringify(c)}`)
      }
    }
  }
})

test('la piste du Champion du jour : Le Laurier y est compté, ses lauriers grandissent à ses seuils, et chaque étape dit ce qu’elle ouvre', () => {
  const etapes = etapesDeLaPiste('hf:champion-du-jour')
  assert.deepEqual(
    etapes.map(e => `${seuilDeLEtape('hf:champion-du-jour', e.seuil)}${e.metal ? ` (${e.metal})` : ''}`),
    ['1 victoire (1)', '3 victoires', '5 victoires (2)', '10 victoires', '20 victoires (3)', '30 victoires', '50 victoires'],
  )
  // Le laurier du lendemain grandit aux seuils mêmes du Champion du jour.
  for (const [i, seuil] of SEUILS_DU_LAURIER.entries()) assert.ok(etapes.find(e => e.seuil === seuil)!.recompenses.some(r => r.cle === `laurier:${i + 1}`), `laurier ${i + 1}`)
  assert.ok(etapes.find(e => e.seuil === 10)!.recompenses.some(r => r.sorte === 'fond' && r.cle === 'kintsugi'))
  assert.ok(etapes.find(e => e.seuil === 50)!.recompenses.some(r => r.sorte === 'theme' && r.cle === 'horloge'))
  // Ce qu'un palier ouvre se dit à sa chute ; un trophée qui se regagne, sans savoir combien de fois, rien.
  assert.deepEqual(ceQuIlOuvre('hf:assidu:2').map(r => r.cle).sort(), ['lg:renard', 'nuit'].sort())
  assert.deepEqual(ceQuIlOuvre('hf:laurier'), [])
  assert.deepEqual(ceQuIlOuvre('hf:laurier', 10).map(r => r.cle), ['kintsugi'])
})

/** Un haut fait du catalogue, tel que la page du profil le reçoit. */
const vu = (key: string, fois: number, plus: Partial<HautFaitVu> = {}): HautFaitVu => {
  const h = hautFait(key)!
  return { key, famille: h.famille, emoji: h.emoji, title: h.title, rule: 'règle', ton: 'ton' in h ? h.ton : 'eclat', fois, ...plus } as HautFaitVu
}

/** Un profil qui n'a encore rien : tout le catalogue à zéro, comme sa page le reçoit. */
const NEUF = {
  hautsFaits: [...HAUTS_FAITS_REGAGNABLES.map(h => vu(h.key, 0)), ...HAUTS_FAITS_DE_CARRIERE.map(h => vu(h.key, 0, { valeur: 0 }))],
  prix: Array.from({ length: 20 }, (_, i) => ({ key: `prix-${i}`, emoji: '🏅', title: `Prix ${i}`, rule: 'règle', fois: 0 })),
  ecussons: Array.from({ length: 12 }, (_, i) => ({ categorie: `Catégorie ${i}`, palier: 0, justes: 0 })),
  calendrier: { pages: [], dorees: [], mois: '2026-10', joursCeMois: 0 },
  titresDates: [],
  sentiers: {},
}

test('l’album compte tout ce qui se gagne par ce qu’on a fait : 253 trophées, une page par mode — et s’ouvre où l’on joue', () => {
  const pages = albumDesTrophees(NEUF as any)
  assert.deepEqual(
    pages.map(p => `${p.page} ${p.acquis}/${p.total}`),
    // La soirée : huit pistes de trois métaux, onze exploits, neuf coups du sort, vingt prix ;
    // le quiz du jour : six pistes — La Plume depuis le 2 novembre 2026 —, six exploits, trois coups, douze pages ; la campagne : quatre pistes — le
    // Globe-trotter, le passeport de l'expédition, depuis le 18 octobre 2026 —, cinq exploits ; les duels : six
    // ligues, six bordures serties ; les sentiers : trois pistes, deux exploits, douze maîtres ; le Cabinet, depuis le
    // 1er novembre 2026 : L'Explorateur, rangé en campagne jusque-là, et depuis le 4 ses six pistes de fond, ses dix
    // jeux de trois métaux et ses cinq exploits ; partout : douze écussons de trois métaux, le niveau et les Éclats.
    ['soiree 0/64', 'jour 0/39', 'campagne 0/17', 'duels 0/12', 'sentiers 0/23', 'cabinet 0/56', 'partout 0/42'],
  )
  assert.deepEqual(compteDesTrophees(NEUF as any), { acquis: 0, total: 253 })
  // Les pistes du Cabinet ne se comptent que là où le serveur les cite — là où le Cabinet s'ouvre : un serveur où il est
  // fermé les tait, et sa collection ne compte pas ce qu'elle ne montre nulle part — ni ses exploits, qui n'ont de case
  // que là ; sans rien d'autre du Cabinet, sa page ne s'ouvre pas.
  const sansLui = { ...NEUF, hautsFaits: NEUF.hautsFaits.filter(h => !HAUTS_FAITS_DE_CARRIERE.some(x => x.auCabinet && x.key === h.key)) }
  assert.deepEqual(compteDesTrophees(sansLui as any), { acquis: 0, total: 197 })
  assert.ok(!albumDesTrophees(sansLui as any).some(p => p.sections.some(s => s.cases.some(c => c.cle === 'hf:explorateur'))))
  assert.ok(!albumDesTrophees(sansLui as any).some(p => p.page === 'cabinet'), 'pas de page « Cabinet 0/0 »')
  // Le Globe-trotter de même, là où l'Expédition est effacée : le serveur ne le cite plus qu'à ses détenteurs, et la
  // collection des autres ne compte plus « 0 sur 3 » un passeport qu'aucune page ne tamponne. Les trois autres pistes de
  // la campagne restent.
  const sansPasseport = { ...NEUF, hautsFaits: NEUF.hautsFaits.filter(h => h.key !== 'hf:globe-trotter') }
  assert.deepEqual(compteDesTrophees(sansPasseport as any), { acquis: 0, total: 250 })
  const campagneSans = albumDesTrophees(sansPasseport as any).find(p => p.page === 'campagne')!
  assert.equal(`${campagneSans.acquis}/${campagneSans.total}`, '0/14')
  assert.deepEqual(campagneSans.sections[0].cases.map(c => c.cle), ['hf:alpiniste', 'hf:erudit', 'hf:marathonien'])
  // Cité — à son détenteur, ou là où l'Expédition répond encore —, sa case reste, son bronze dessus.
  const tenu = albumDesTrophees({ ...NEUF, hautsFaits: NEUF.hautsFaits.map(h => (h.key === 'hf:globe-trotter' ? { ...h, fois: 1, valeur: 12, prochain: 40 } : h)) } as any)
  assert.equal(tenu.find(p => p.page === 'campagne')!.sections[0].cases.find(c => c.cle === 'hf:globe-trotter')?.metaux, 1)
  // Cité, sa case compte des traversées gagnées — « 0 traversée » pour qui n'a pas encore gagné la première : elles
  // s'additionnent, comme les salles qu'il comptait du 26 octobre au 1er novembre 2026 ; le niveau d'explorateur,
  // qu'il comptait avant, n'en avait pas de zéro, d'où son « 0 » à part.
  const explorateur = (vus: typeof NEUF.hautsFaits) => albumDesTrophees({ ...NEUF, hautsFaits: vus } as any).find(p => p.page === 'cabinet')!.sections[0].cases.find(c => c.cle === 'hf:explorateur')!
  assert.equal(explorateur(NEUF.hautsFaits).compte, '0 traversée')
  const parti = explorateur(NEUF.hautsFaits.map(h => (h.key === 'hf:explorateur' ? { ...h, fois: 1, valeur: 2 } : h)))
  assert.deepEqual([parti.compte, parti.metaux, parti.prochain], ['2 traversées', 1, 5])
  assert.equal(seuilDeLEtape('hf:explorateur', 1), '1 traversée')
  assert.equal(seuilDeLEtape('hf:explorateur', 15), '15 traversées')
  // Un détenteur d'avant — l'argent gagné au niveau d'explorateur ou aux salles, aucune traversée encore — le garde, et
  // sa piste le dit : ses deux premières étapes atteintes, la prochaine celle de l'or. La jauge ne fait pas descendre
  // ce qui est rangé.
  const detenteur = explorateur(NEUF.hautsFaits.map(h => (h.key === 'hf:explorateur' ? { ...h, fois: 2, valeur: 0, prochain: 15 } : h)))
  assert.deepEqual([detenteur.aLui, detenteur.metaux, detenteur.compte, detenteur.prochain], [true, 2, '0 traversée', 15])
  assert.deepEqual(
    detenteur.etapes!.map(e => [e.seuil, e.metal, e.atteinte, e.prochaine]),
    [
      [1, 1, true, false],
      [5, 2, true, false],
      [15, 3, false, true],
    ],
  )
  // Rien encore : le quiz du jour, ce qu'on joue le plus. Sinon, le mode où il a le plus.
  assert.equal(pageDuDebutDesTrophees(NEUF as any), 'jour')
  const campagne = { ...NEUF, hautsFaits: NEUF.hautsFaits.map(h => (h.key === 'hf:alpiniste' ? { ...h, fois: 2, valeur: 15 } : h)) }
  assert.equal(pageDuDebutDesTrophees(campagne as any), 'campagne')
  // Une piste compte un trophée par métal ; un exploit, une fois quel que soit son nombre.
  const page = albumDesTrophees(campagne as any).find(p => p.page === 'campagne')!
  assert.deepEqual([page.acquis, page.sections[0].cases[0].cle, page.sections[0].cases[0].metaux, page.sections[0].cases[0].compte], [2, 'hf:alpiniste', 2, 'record 15'])
  // La prochaine étape de sa piste, et ce qu'elle ouvre : l'or, et le thème du Sommet.
  const prochaine = page.sections[0].cases[0].etapes!.find(e => e.prochaine)!
  assert.deepEqual([prochaine.seuil, prochaine.metal, prochaine.recompenses.map(r => r.cle).includes('sommet')], [20, 3, true])
})

test('chaque trophée a sa page : celle du mode où il se gagne', () => {
  for (const [cle, page] of [
    ['hf:bavard:2', 'soiree'],
    ['hf:phenix', 'soiree'],
    ['eclair', 'soiree'],
    ['hf:assidu:1', 'jour'],
    ['hf:laurier', 'jour'],
    ['mois:2026-10', 'jour'],
    ['heures:10', 'jour'],
    ['hf:funambule', 'campagne'],
    ['hf:marathonien:3', 'campagne'],
    ['hf:explorateur:2', 'cabinet'],
    ['cabinet:defi:parade:2', 'cabinet'],
    // Une épreuve de maître d'avant le 4 novembre 2026 : sa ligne rangée garde sa page.
    ['cabinet:maitrise:phenix', 'cabinet'],
    ['hf:jeu-pari:2', 'cabinet'],
    ['hf:bestiaire:1', 'cabinet'],
    ['hf:intouchable', 'cabinet'],
    ['ligue:or', 'duels'],
    ['maitre:foret', 'sentiers'],
    ['hf:randonneur:2', 'sentiers'],
    ['hf:impeccable', 'sentiers'],
    ['hf:legende:2', 'partout'],
    ['ecusson:Histoire', 'partout'],
  ])
    assert.equal(pageDuTrophee(cle), page, cle)
})

async function rendu(composant: string, props: object): Promise<string> {
  return renduDe(composant, props)
}

test('la page du Cabinet : ses pistes, ses dix jeux, ses exploits payés selon leur rareté, et le défi de chaque carte', async () => {
  // « Est-ce que l'on voit quelque part dans la collection, album des trophées, une section cabinets ? » (le
  // propriétaire, le 1er novembre 2026) : non, jusque-là. Puis, le 4 novembre 2026, « peu nombreux en expérience » : six
  // pistes de fond, une par jeu, des exploits — et les épreuves de maître parties (« inutile, il faut enlever ça »).
  const rangs = Object.fromEntries(Object.keys(NOMS_DES_DEFIS).map(c => [c, 0]))
  const tient = { ...NEUF, defisDuCabinet: { rangs: { ...rangs, parade: 2, cagnotte: 3 } } }
  const page = albumDesTrophees(tient as any).find(p => p.page === 'cabinet')!
  assert.deepEqual(
    page.sections.map(x => [x.cle, x.acquis, x.total]),
    [
      ['pistes', 0, 21],
      ['jeux', 0, 30],
      ['exploits', 0, 5],
      ['defis', 5, 30],
    ],
  )
  assert.deepEqual(compteDesTrophees(tient as any), { acquis: 5, total: 253 + 30 })
  // Les pistes : L'Explorateur d'abord, puis celles de fond ; leurs mots courts sous leur case.
  const [pistes, jeux, exploits, sesDefis] = page.sections
  assert.deepEqual(
    pistes.cases.map(c => [c.cle, c.compte]),
    [
      ['hf:explorateur', '0 traversée'],
      ['hf:pensionnaire', '0 épreuve'],
      ['hf:chasseur', '0 gardien'],
      ['hf:bestiaire', '0 gardien'],
      ['hf:coffre-fort', '0 pièce'],
      ['hf:perfectionniste', '0 parfaite'],
      ['hf:invaincu', '0 d’affilée'],
    ],
  )
  // Les dix jeux, dans l'ordre de la carte de la traversée, chacun l'emoji de son jeu ; la Frise, qu'aucun gardien ne
  // joue, à ses paliers à elle.
  assert.equal(jeux.cases.length, 10)
  const frise = jeux.cases.find(c => c.cle === 'hf:jeu-frise')!
  assert.deepEqual([frise.titre, frise.regle, frise.etapes!.map(e => e.seuil)], ['Le Chronologiste', 'épreuves menées au bout à la Frise', [3, 12, 35]])
  assert.equal(seuilDeLEtape('hf:jeu-pari', 25), '25 épreuves')
  // Les exploits : ils se regagnent, et rapportent selon leur rareté — la plus rare, le plus.
  const implacable = exploits.cases.find(c => c.cle === 'hf:implacable')!
  assert.deepEqual([implacable.sorte, implacable.rarete, implacable.xp], ['exploit', 'legendaire', 400])
  const fil = exploits.cases.find(c => c.cle === 'hf:sur-le-fil')!
  assert.deepEqual([fil.rarete, fil.xp], ['epique', 200])
  assert.match(exploits.aide, /Plus un exploit est rare, plus il rapporte/)
  // Les défis, dans l'ordre des cartes, ce qu'il tient d'abord : chacun sa carte, ses métaux, ce que chaque rang demande
  // et rapporte — des confettis au bronze et à l'argent, et dès l'argent le dos doré de sa carte au choix des cartes
  // (`.cab-tv-doree`), un titre à l'or.
  const defis = sesDefis.cases
  assert.deepEqual(
    defis.slice(0, 2).map(c => [c.cle, c.titre, c.metaux, c.compte, c.carte]),
    [
      ['cabinet:defi:parade', 'Sans filet', 2, 'Argent', 'parade'],
      ['cabinet:defi:cagnotte', 'Le Trésorier', 3, 'Or', 'cagnotte'],
    ],
  )
  const parade = defis[0]
  assert.equal(parade.regle, 'Au dos de la carte Parade')
  assert.deepEqual(
    parade.etapes!.map(e => [e.metal, e.atteinte, e.prochaine, e.dit, e.gain]),
    [
      [1, true, false, PHRASES_DES_DEFIS.parade[0], `${CONFETTIS_D_UN_RANG[0]} confettis`],
      [2, true, false, PHRASES_DES_DEFIS.parade[1], `${CONFETTIS_D_UN_RANG[1]} confettis, et son dos doré`],
      [3, false, false, PHRASES_DES_DEFIS.parade[2], 'Le titre « Sans filet »'],
    ],
  )
  // Leurs fiches : ses rangs, leurs phrases, ce qu'ils rapportent ; le chemin du Cabinet tant qu'il en reste.
  const fiche = await rendu('FicheDuTrophee', { c: parade, page: 'cabinet', visuel: '', cabinet: true })
  assert.match(fiche, /<span class="label album-etiquette">Ses rangs<\/span>/)
  assert.match(fiche, /Un acte fini sans qu’une Parade serve/)
  assert.match(fiche, /Le titre «\s?Sans filet\s?»/)
  assert.match(fiche, /Tenu à l’Argent : il ne se reprend jamais\./)
  assert.match(fiche, /href="\/cabinet">Aller au Cabinet<\/a>/)
  assert.doesNotMatch(fiche, /XP/, 'un défi ne rapporte pas d’expérience')
  // La fiche d'un exploit dit ce qu'il rapporte à chaque fois, et mène au Cabinet.
  const ficheDeLExploit = await rendu('FicheDuTrophee', { c: implacable, page: 'cabinet', visuel: implacable.emoji, cabinet: true })
  assert.match(ficheDeLExploit, /400/)
  assert.match(ficheDeLExploit, /href="\/cabinet">Aller au Cabinet<\/a>/)
  // La page rendue : chaque défi a la peinture de sa carte pour visuel — en couleur ce qu'il tient, éteint le reste
  // (`.trophee-manque .trophee-image`) ; plus aucun médaillon de gardien.
  const album = await rendu('AlbumDesTrophees', { profil: { ...tient, legendaires: [] }, page: 'cabinet', onPage: () => {} })
  const caseDe = (cle: string) => album.match(new RegExp(`<button[^>]*class="trophee-case [^"]*"[^>]*>(?:(?!</button>).)*${cle}`, 's'))?.[0] ?? ''
  assert.ok(album.includes(`src="${CARTES_PEINTES.parade[1]}"`), 'la peinture de la Parade')
  for (const carte of Object.keys(NOMS_DES_DEFIS) as (keyof typeof CARTES_PEINTES)[]) assert.ok(album.includes(`src="${CARTES_PEINTES[carte][1]}"`), carte)
  assert.doesNotMatch(album, /maître|maitrise/i, 'plus d’épreuve de maître')
  assert.match(caseDe(CARTES_PEINTES.parade[1]), /class="trophee-case trophee-defi"/, 'tenu : en couleur')
  assert.match(caseDe(CARTES_PEINTES['coup-d-oeil'][1]), /class="trophee-case trophee-defi trophee-manque"/, 'pas encore : éteint')
  assert.match(album, /aria-label="Sans filet, bronze, argent"/, 'à l’oreille, ses métaux — rien de vide')
  assert.match(album, /aria-label="L’Œil nu, pas encore"/)
  // Le Cabinet fermé ici — le serveur ne dit rien de ses défis — : ses pistes, ses jeux et ses exploits, pas ses défis.
  assert.deepEqual(albumDesTrophees(NEUF as any).find(p => p.page === 'cabinet')!.sections.map(x => x.cle), ['pistes', 'jeux', 'exploits'])
})

async function renduDe(composant: string, props: object): Promise<string> {
  const module = await import(new URL('../../client/src/components/AlbumDesTrophees.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

test('la fiche d’une piste : où il en est, ce qu’elle rapporte, chaque étape et ce qu’elle ouvre — et l’écran où la gagner', async () => {
  const profil = { ...NEUF, hautsFaits: NEUF.hautsFaits.map(h => (h.key === 'hf:champion-du-jour' ? { ...h, fois: 2, valeur: 7 } : h.key === 'hf:laurier' ? { ...h, fois: 7 } : h)) }
  const c = albumDesTrophees(profil as any)
    .find(p => p.page === 'jour')!
    .sections[0].cases.find(x => x.cle === 'hf:champion-du-jour')!
  const html = await rendu('FicheDuTrophee', { c, page: 'jour', visuel: c.emoji })
  assert.match(html, /<b class="galerie-detail-nom">Le Champion du jour<\/b>/)
  assert.match(html, /Tu en es à 7 victoires au quiz du jour\./)
  // Le Laurier, que la piste compte : sa ligne, et combien de fois il l'a eu.
  assert.match(html, /Le Laurier, \+50 XP à chaque victoire, se compte ici : tu l’as eu 7 fois\./)
  assert.match(html, /<span class="label album-etiquette">Ta piste<\/span>/)
  const etapes = [...html.matchAll(/<li class="piste-etape([^"]*)">.*?<b>([^<]+)/g)].map(m => `${m[2].trim()}${m[1]}`)
  assert.deepEqual(etapes, ['1 victoire · atteinte', '3 victoires atteinte', '5 victoires · atteinte', '10 victoires prochaine', '20 victoires ·', '30 victoires', '50 victoires'])
  // La prochaine : sa jauge, et ce qu'elle ouvre.
  // (Les guillemets tiennent au nom par des espaces fines : `espacesFines`.)
  assert.match(html, /le fond «\s?Kintsugi\s?»/)
  assert.match(html, /<span>7 sur 10<\/span>/)
  assert.match(html, /<a class="btn btn-small album-aller" href="\/jour">Jouer le quiz du jour<\/a>/)
  // Rien ne s'y porte.
  assert.doesNotMatch(html, /<button|Le porter/)
})

test('la fiche de L’Explorateur mène au Cabinet, où se gagnent ses traversées — pas à une série, que propose la campagne', async () => {
  const profil = { ...NEUF, hautsFaits: NEUF.hautsFaits.map(h => (h.key === 'hf:explorateur' ? { ...h, fois: 1, valeur: 2, prochain: 5 } : h)) }
  const c = albumDesTrophees(profil as any)
    .find(p => p.page === 'cabinet')!
    .sections[0].cases.find(x => x.cle === 'hf:explorateur')!
  const html = await rendu('FicheDuTrophee', { c, page: 'cabinet', visuel: c.emoji })
  assert.match(html, /Tu en es à 2 traversées gagnées au Cabinet\./)
  assert.match(html, /<a class="btn btn-small album-aller" href="\/cabinet">Aller au Cabinet<\/a>/)
  assert.doesNotMatch(html, /Jouer une série/)
  // Les autres pistes de la page mènent toujours à la série.
  const alpiniste = albumDesTrophees(NEUF as any)
    .find(p => p.page === 'campagne')!
    .sections[0].cases.find(x => x.cle === 'hf:alpiniste')!
  assert.match(await rendu('FicheDuTrophee', { c: alpiniste, page: 'campagne', visuel: alpiniste.emoji }), /href="\/campagne">Jouer une série<\/a>/)
})

// Le serveur cite L'Explorateur à ses détenteurs même là où le Cabinet est fermé — la production, tant qu'il n'y ouvre
// pas, où ils l'ont gagné au niveau d'explorateur. Leur fiche dit où ils en sont, sans chemin : le Cabinet n'y répond
// pas, et une série ne complète aucune salle. La page le sait du serveur (`cabinetIci`), jamais d'une constante.
test('le Cabinet fermé ici, la fiche de L’Explorateur ne mène nulle part — ni au Cabinet, ni à une série — et son détenteur y lit son métal', async () => {
  const detenteur = { ...NEUF, hautsFaits: NEUF.hautsFaits.map(h => (h.key === 'hf:explorateur' ? { ...h, fois: 2, valeur: 0, prochain: 15 } : h)) }
  const c = albumDesTrophees(detenteur as any)
    .find(p => p.page === 'cabinet')!
    .sections[0].cases.find(x => x.cle === 'hf:explorateur')!
  const ferme = await rendu('FicheDuTrophee', { c, page: 'cabinet', visuel: c.emoji, cabinet: false })
  assert.match(ferme, /<b class="galerie-detail-nom">L’Explorateur<\/b>/)
  assert.match(ferme, /Tu en es à 0 traversée gagnée au Cabinet\./)
  assert.doesNotMatch(ferme, /album-aller/, 'aucun chemin')
  // La même fiche, le Cabinet ouvert : son chemin.
  assert.match(await rendu('FicheDuTrophee', { c, page: 'cabinet', visuel: c.emoji, cabinet: true }), /href="\/cabinet">Aller au Cabinet<\/a>/)
  // Les autres pistes de la page gardent le leur, le Cabinet fermé ou non.
  const alpiniste = albumDesTrophees(NEUF as any)
    .find(p => p.page === 'campagne')!
    .sections[0].cases.find(x => x.cle === 'hf:alpiniste')!
  assert.match(await rendu('FicheDuTrophee', { c: alpiniste, page: 'campagne', visuel: alpiniste.emoji, cabinet: false }), /href="\/campagne">Jouer une série<\/a>/)
  // La règle pure que la fiche lit : ouvert d'office, comme `cabinetIci` sans la balise de la page.
  assert.equal(ouJouer('hf:explorateur', 'cabinet', false), undefined)
  assert.deepEqual(ouJouer('hf:explorateur', 'cabinet'), { nom: 'Aller au Cabinet', href: '/cabinet' })
  assert.equal(ouJouer('cabinet:defi:parade', 'cabinet', false), undefined, 'ni un défi')
  assert.deepEqual(ouJouer('cabinet:defi:parade', 'cabinet'), { nom: 'Aller au Cabinet', href: '/cabinet' })
  assert.deepEqual(ouJouer('hf:alpiniste', 'campagne', false), { nom: 'Jouer une série', href: '/campagne' })
  // Le Globe-trotter ne se tamponne qu'en expédition : « Jouer une série » ne l'a jamais avancé. Effacée — le drapeau du
  // code, d'office —, la fiche de son détenteur ne mène nulle part ; là où elle répondrait, à son départ.
  assert.equal(ouJouer('hf:globe-trotter', 'campagne', true, false), undefined)
  assert.deepEqual(ouJouer('hf:globe-trotter', 'campagne', true, true), { nom: 'Partir en expédition', href: '/expedition' })
  assert.deepEqual(ouJouer('hf:globe-trotter', 'campagne'), voieDeLExpeditionDite() ? { nom: 'Partir en expédition', href: '/expedition' } : undefined)
})
