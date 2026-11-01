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

test('l’album compte tout ce qui se gagne par ce qu’on a fait : 197 trophées, une page par mode — et s’ouvre où l’on joue', () => {
  const pages = albumDesTrophees(NEUF as any)
  assert.deepEqual(
    pages.map(p => `${p.page} ${p.acquis}/${p.total}`),
    // La soirée : huit pistes de trois métaux, onze exploits, neuf coups du sort, vingt prix ;
    // le quiz du jour : cinq pistes, six exploits, trois coups, douze pages ; la campagne : cinq pistes — le
    // Globe-trotter, le passeport de l'expédition, depuis le 18 octobre 2026, et L'Explorateur, depuis le 19, aux
    // salles complètes du Cabinet depuis le 26 —, cinq exploits ; les duels : six ligues, six bordures serties ; les
    // sentiers : trois pistes, deux exploits, douze maîtres ; partout : douze écussons de trois métaux, le niveau et les Éclats.
    ['soiree 0/64', 'jour 0/36', 'campagne 0/20', 'duels 0/12', 'sentiers 0/23', 'partout 0/42'],
  )
  assert.deepEqual(compteDesTrophees(NEUF as any), { acquis: 0, total: 197 })
  // L'Explorateur ne se compte que là où le serveur le cite — là où le Cabinet s'ouvre : la production le tait tant
  // qu'il y est fermé, et sa collection ne compte pas trois trophées de salles qu'elle ne montre nulle part.
  const sansLui = { ...NEUF, hautsFaits: NEUF.hautsFaits.filter(h => h.key !== 'hf:explorateur') }
  assert.deepEqual(compteDesTrophees(sansLui as any), { acquis: 0, total: 194 })
  assert.ok(!albumDesTrophees(sansLui as any).some(p => p.sections.some(s => s.cases.some(c => c.cle === 'hf:explorateur'))))
  // Cité, sa case compte des salles — « 0 salle » pour qui n'a pas encore complété la première : elles s'additionnent,
  // comme les sentiers du Cartographe ; le niveau d'explorateur, qu'il comptait jusqu'au 26 octobre 2026, n'en avait pas
  // de zéro, d'où son « 0 » à part.
  const explorateur = (vus: typeof NEUF.hautsFaits) => albumDesTrophees({ ...NEUF, hautsFaits: vus } as any).find(p => p.page === 'campagne')!.sections[0].cases.find(c => c.cle === 'hf:explorateur')!
  assert.equal(explorateur(NEUF.hautsFaits).compte, '0 salle')
  const parti = explorateur(NEUF.hautsFaits.map(h => (h.key === 'hf:explorateur' ? { ...h, fois: 1, valeur: 2 } : h)))
  assert.deepEqual([parti.compte, parti.metaux, parti.prochain], ['2 salles', 1, 3])
  assert.equal(seuilDeLEtape('hf:explorateur', 1), '1 salle')
  assert.equal(seuilDeLEtape('hf:explorateur', 6), '6 salles')
  // Un détenteur d'avant — l'argent gagné au niveau d'explorateur, aucune salle encore — le garde, et sa piste le dit :
  // ses deux premières étapes atteintes, la prochaine celle de l'or. La jauge ne fait pas descendre ce qui est rangé.
  const detenteur = explorateur(NEUF.hautsFaits.map(h => (h.key === 'hf:explorateur' ? { ...h, fois: 2, valeur: 0, prochain: 6 } : h)))
  assert.deepEqual([detenteur.aLui, detenteur.metaux, detenteur.compte, detenteur.prochain], [true, 2, '0 salle', 6])
  assert.deepEqual(
    detenteur.etapes!.map(e => [e.seuil, e.metal, e.atteinte, e.prochaine]),
    [
      [1, 1, true, false],
      [3, 2, true, false],
      [6, 3, false, true],
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
    ['hf:explorateur:2', 'campagne'],
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

test('la fiche de L’Explorateur mène au Cabinet, où ses salles se complètent — pas à une série, que sa page de la campagne propose', async () => {
  const profil = { ...NEUF, hautsFaits: NEUF.hautsFaits.map(h => (h.key === 'hf:explorateur' ? { ...h, fois: 1, valeur: 2, prochain: 3 } : h)) }
  const c = albumDesTrophees(profil as any)
    .find(p => p.page === 'campagne')!
    .sections[0].cases.find(x => x.cle === 'hf:explorateur')!
  const html = await rendu('FicheDuTrophee', { c, page: 'campagne', visuel: c.emoji })
  assert.match(html, /Tu en es à 2 salles complètes du Cabinet\./)
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
  const detenteur = { ...NEUF, hautsFaits: NEUF.hautsFaits.map(h => (h.key === 'hf:explorateur' ? { ...h, fois: 2, valeur: 0, prochain: 6 } : h)) }
  const c = albumDesTrophees(detenteur as any)
    .find(p => p.page === 'campagne')!
    .sections[0].cases.find(x => x.cle === 'hf:explorateur')!
  const ferme = await rendu('FicheDuTrophee', { c, page: 'campagne', visuel: c.emoji, cabinet: false })
  assert.match(ferme, /<b class="galerie-detail-nom">L’Explorateur<\/b>/)
  assert.match(ferme, /Tu en es à 0 salle complète du Cabinet\./)
  assert.doesNotMatch(ferme, /album-aller/, 'aucun chemin')
  // La même fiche, le Cabinet ouvert : son chemin.
  assert.match(await rendu('FicheDuTrophee', { c, page: 'campagne', visuel: c.emoji, cabinet: true }), /href="\/cabinet">Aller au Cabinet<\/a>/)
  // Les autres pistes de la page gardent le leur, le Cabinet fermé ou non.
  const alpiniste = albumDesTrophees(NEUF as any)
    .find(p => p.page === 'campagne')!
    .sections[0].cases.find(x => x.cle === 'hf:alpiniste')!
  assert.match(await rendu('FicheDuTrophee', { c: alpiniste, page: 'campagne', visuel: alpiniste.emoji, cabinet: false }), /href="\/campagne">Jouer une série<\/a>/)
  // La règle pure que la fiche lit : ouvert d'office, comme `cabinetIci` sans la balise de la page.
  assert.equal(ouJouer('hf:explorateur', 'campagne', false), undefined)
  assert.deepEqual(ouJouer('hf:explorateur', 'campagne'), { nom: 'Aller au Cabinet', href: '/cabinet' })
  assert.deepEqual(ouJouer('hf:alpiniste', 'campagne', false), { nom: 'Jouer une série', href: '/campagne' })
})
