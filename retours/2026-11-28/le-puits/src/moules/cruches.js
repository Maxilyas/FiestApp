'use strict'
/* Les cruches : mesurer une quantité qu'aucun récipient ne mesure, en versant
   de l'un dans l'autre. On ne verse jamais « un peu » : jusqu'à vider l'un ou
   remplir l'autre. Tartaglia en pose au XVIe siècle, Bachet en 1612, Dudeney
   en fait un chapitre entier.

   Une fiche donne : `vases` (nom, cap), `plein` (ce que chacun contient au
   départ), `fontaine` (on peut remplir et vider à volonté) et `cible` — une
   quantité à tenir dans un vase (`{ un: 4 }`) ou ce que chacun doit contenir
   (`{ tous: [4, 10, 3, 3] }`, null pour un vase qui n'importe pas).

   Le moule tire aussi des énigmes sans fin : deux cruches, une fontaine, une
   quantité — et le programme ne garde que celles qui se résolvent, au nombre de
   gestes que la profondeur demande. */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.cruche = ['..#####..', '...###...', '..#####..', '.#######.', '.#######.', '.#######.', '.#######.', '..#####..', '.........']

  P.style(`
.cr { display: grid; gap: 10px; }
.cr-vases { display: flex; align-items: flex-end; justify-content: center; gap: 10px; min-height: 176px; padding: 10px 6px 0; }
.cr-vase { position: relative; width: 62px; padding: 0; background: none; border: 0; display: grid; justify-items: center; gap: 4px; }
.cr-verre { position: relative; width: 100%; border: 3px solid rgba(243, 236, 226, 0.5); border-top: 0; border-radius: 0 0 12px 12px; background: rgba(0, 0, 0, 0.25); overflow: hidden; }
.cr-eau { position: absolute; left: 0; right: 0; bottom: 0; background: linear-gradient(180deg, #8fb1d8, #46699a); transition: height 0.35s ease; }
.cr-vase.choisi .cr-verre { border-color: var(--or-clair); box-shadow: 0 0 14px rgba(var(--sable), 0.5); }
.cr-vase b { font: 600 17px/1 var(--f-pixel); color: var(--ink); font-variant-numeric: tabular-nums; }
.cr-vase small { font-size: 10.5px; color: var(--muted); }
.cr-gestes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cr-gestes button { min-height: 44px; border: 1px solid rgba(217, 181, 106, 0.5); border-radius: 10px; background: rgba(0, 0, 0, 0.3); font: 600 14px var(--f-texte); color: var(--ink); }
.cr-gestes button[disabled] { opacity: 0.4; cursor: default; }
.cr-but { margin: 0; text-align: center; font-size: 12.5px; color: var(--or-clair); }
`)

  const atteint = (f, n) => (f.cible.un != null ? n.includes(f.cible.un) : f.cible.tous.every((v, i) => v == null || n[i] === v))

  const moule = P.moule({
    cle: 'cruches',
    nom: 'Les cruches',
    socle: 'chemin',
    glyphe: 'cruche',
    unite: ['geste', 'gestes'],
    depart: f => ({ n: f.plein.slice(), choisi: null }),
    signature: e => e.n.join(','),
    compte: coup => coup.choisit === undefined,
    coups(f, e) {
      const r = []
      f.vases.forEach((v, i) => {
        if (f.fontaine && e.n[i] < v.cap) r.push({ remplit: i })
        if (f.fontaine && e.n[i] > 0) r.push({ vide: i })
        f.vases.forEach((w, j) => { if (i !== j && e.n[i] > 0 && e.n[j] < w.cap) r.push({ verse: [i, j] }) })
      })
      return r
    },
    jouer(f, e, coup) {
      if (coup.choisit !== undefined) return { etat: { ...e, choisi: coup.choisit } }
      const n = e.n.slice()
      if (coup.remplit !== undefined) {
        if (n[coup.remplit] === f.vases[coup.remplit].cap) return { refus: 'Elle est déjà pleine.' }
        n[coup.remplit] = f.vases[coup.remplit].cap
      } else if (coup.vide !== undefined) {
        if (!n[coup.vide]) return { refus: 'Elle est déjà vide.' }
        n[coup.vide] = 0
      } else {
        const [i, j] = coup.verse
        const passe = Math.min(n[i], f.vases[j].cap - n[j])
        if (!n[i]) return { refus: 'Il n’y a rien à verser.' }
        if (!passe) return { refus: 'Celle-là est déjà pleine.' }
        n[i] -= passe
        n[j] += passe
      }
      return { etat: { n, choisi: null } }
    },
    fini: (f, e) => (atteint(f, e.n) ? { gagne: true } : null),
    dessiner({ f, e, agir, fige }) {
      const haut = Math.max(...f.vases.map(v => v.cap))
      const vase = (v, i) => h('button', {
        type: 'button', class: `cr-vase ${e.choisi === i ? 'choisi' : ''}`, disabled: fige,
        'aria-label': `${v.nom} : ${e.n[i]} sur ${v.cap}`,
        onclick: () => {
          if (e.choisi === null) return agir({ choisit: i })
          if (e.choisi === i) return agir({ choisit: null })
          agir({ verse: [e.choisi, i] })
        },
      },
      h('b', null, String(e.n[i])),
      h('span', { class: 'cr-verre', style: `height:${Math.round(34 + 96 * v.cap / haut)}px` }, h('i', { class: 'cr-eau', style: `height:${100 * e.n[i] / v.cap}%` })),
      h('small', null, `${v.nom} · ${v.cap}`))
      const but = f.cible.un != null
        ? `Le but : ${P.pluriel(f.cible.un, f.mesure || 'mesure')} dans l’une d’elles.`
        : `Le but : ${f.vases.map((v, i) => (f.cible.tous[i] == null ? null : `${f.cible.tous[i]} dans ${v.dans || v.nom.toLowerCase()}`)).filter(Boolean).join(', ')}.`
      return h('div', { class: 'cr' },
        h('p', { class: 'cr-but' }, but),
        h('div', { class: 'cr-vases' }, f.vases.map(vase)),
        f.fontaine && h('div', { class: 'cr-gestes' },
          h('button', { type: 'button', disabled: fige || e.choisi === null, onclick: () => agir({ remplit: e.choisi }) }, 'Remplir à la fontaine'),
          h('button', { type: 'button', disabled: fige || e.choisi === null, onclick: () => agir({ vide: e.choisi }) }, 'Vider')))
    },
    // Deux cruches premières entre elles mesurent toute quantité : le tirage n'a plus qu'à choisir combien de gestes il veut.
    tirer(graine, niveau) {
      const alea = P.alea(graine)
      const PAIRES = [[3, 5], [4, 7], [3, 7], [5, 7], [4, 9], [5, 8], [7, 9], [5, 9], [7, 10], [8, 11], [7, 12], [9, 11], [5, 12]]
      const voulus = [[4, 6], [6, 8], [8, 10], [10, 14], [14, 30]][Math.min(4, Math.max(0, niveau - 1))]
      const candidates = []
      for (const [a, b] of PAIRES) {
        for (let cible = 1; cible < b; cible++) {
          if (cible === a) continue
          const f = { id: `cruches-${a}-${b}-${cible}`, moule: 'cruches', vases: [{ nom: 'La grande', cap: b }, { nom: 'La petite', cap: a }], plein: [0, 0], fontaine: true, cible: { un: cible } }
          const r = P.plusCourt(moule, f)
          if (r && r.coups >= voulus[0] && r.coups <= voulus[1]) candidates.push([f, a, b, cible])
        }
      }
      const [f, a, b, cible] = P.parmi(alea, candidates)
      return {
        ...f, niveau, tiree: true,
        titre: `${b} et ${a} font ${cible}`,
        source: 'Tirée par le programme, sur le modèle de Bachet (1612)',
        recit: [`Une fontaine, une cruche de ${b} mesures, une autre de ${a}. Aucune marque sur leurs flancs.`, `Il m’en faut ${cible}, pas une goutte de plus.`],
        regle: 'Touche une cruche, puis celle où verser.',
      }
    },
  })

  /* ---------------------------------------------------------------- */

  P.fiche({
    id: 'fontaine-5-3', moule: 'cruches', niveau: 2,
    titre: 'La fontaine et les deux cruches',
    source: 'Tradition, d’après les problèmes de mesure de Tartaglia (XVIe siècle)',
    recit: [
      'Une fontaine, une cruche de cinq mesures, une autre de trois. Aucune marque sur leurs flancs.',
      'Il m’en faut quatre, pas une goutte de plus.',
    ],
    regle: 'Touche une cruche, puis celle où verser.',
    vases: [{ nom: 'La grande', cap: 5 }, { nom: 'La petite', cap: 3 }], plein: [0, 0], fontaine: true, cible: { un: 4 },
  })

  P.fiche({
    id: 'dudeney-365', moule: 'cruches', niveau: 5,
    titre: 'Le nouveau problème des mesures',
    source: 'H. E. Dudeney, Amusements in Mathematics, n° 365, 1917',
    recit: [
      'Un marchand a deux jarres de dix pintes, pleines de vin, et deux mesures vides : une de cinq, une de quatre.',
      'Il veut exactement trois pintes dans chacune des deux mesures.',
      'Ni fontaine, ni vin perdu : on ne fait que verser.',
    ],
    regle: 'Touche un récipient, puis celui où verser.',
    mesure: 'pinte',
    vases: [
      { nom: 'Jarre', cap: 10, dans: 'une jarre' }, { nom: 'Jarre', cap: 10, dans: 'l’autre' },
      { nom: 'Mesure', cap: 5, dans: 'la mesure de cinq' }, { nom: 'Mesure', cap: 4, dans: 'la mesure de quatre' },
    ],
    plein: [10, 10, 0, 0], fontaine: false, cible: { tous: [null, null, 3, 3] },
  })
}
