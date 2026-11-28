'use strict'
/* Les sabliers : mesurer une durée qu'aucun sablier ne mesure, avec deux
   sabliers qui n'en mesurent pas d'autre. Les cousins des cruches — on retourne
   au lieu de verser —, posés dans les mêmes recueils depuis le XIXe siècle :
   l'œuf de quinze minutes et les sabliers de sept et de onze. Tout l'art est
   dans ce qu'on a le droit de préparer avant de dire « je commence ».

   Le temps n'est pas réel : on retourne, ou on laisse couler jusqu'à ce qu'un
   sablier se vide — on ne sait rien d'un sablier à mi-course. Une fiche donne
   `sabliers` (la durée de chacun, en minutes) et `cible` (la durée à mesurer). */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.sablier = ['#########', '.#######.', '..#####..', '...###...', '....#....', '...#.#...', '..#.#.#..', '.#.###.#.', '#########']

  P.style(`
.sb { display: grid; gap: 8px; }
.sb-tete { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin: 0; font-size: 12.5px; color: var(--muted); }
.sb-tete b { color: var(--or-clair); font-weight: 600; }
.sb-tete .sb-temps b { font: 600 17px/1 var(--f-pixel); color: var(--ink); font-variant-numeric: tabular-nums; }
.sb-rang { display: flex; justify-content: center; align-items: flex-end; gap: 14px; min-height: 172px; }
.sb-sablier { width: 132px; padding: 6px 4px 5px; display: grid; justify-items: center; gap: 4px; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(217, 181, 106, 0.38); border-radius: 12px; }
.sb-sablier[disabled] { cursor: default; opacity: 0.75; }
.sb-sablier small { font-size: 11px; color: var(--muted); }
.sb-sablier .sb-geste { font: 600 12px/1 var(--f-texte); color: var(--or-clair); }
.sb-verre { display: grid; grid-template-columns: 62px 34px; align-items: center; column-gap: 6px; }
.sb-bulbe { position: relative; width: 62px; background: rgba(243, 236, 226, 0.16); overflow: hidden; }
.sb-bulbe.sb-haut { clip-path: polygon(0 0, 100% 0, 58% 100%, 42% 100%); border-top: 3px solid rgba(243, 236, 226, 0.6); }
.sb-bulbe.sb-bas { clip-path: polygon(42% 0, 58% 0, 100% 100%, 0 100%); border-bottom: 3px solid rgba(243, 236, 226, 0.6); }
.sb-sable { position: absolute; left: 0; right: 0; bottom: 0; background: linear-gradient(180deg, var(--or-clair), var(--or)); transition: height 0.35s ease; }
.sb-filet { position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--or-clair); }
.sb-verre b { font: 600 17px/1 var(--f-pixel); color: var(--ink); font-variant-numeric: tabular-nums; }
.sb-verre b small { display: block; margin-top: 2px; font: 500 9.5px/1 var(--f-texte); color: var(--muted); }
.sb-gestes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sb-gestes button { min-height: 44px; padding: 2px 6px; border: 1px solid rgba(217, 181, 106, 0.5); border-radius: 10px; background: rgba(0, 0, 0, 0.3); font: 600 13.5px/1.15 var(--f-texte); color: var(--ink); }
.sb-gestes button small { display: block; font-weight: 500; font-size: 10.5px; color: var(--muted); }
.sb-gestes button[disabled] { opacity: 0.4; cursor: default; }
`)

  const minutes = n => P.pluriel(n, 'minute')
  const coule = e => e.haut.some(x => x > 0)
  // Toutes les façons de retourner au même instant : un sablier, l'autre, ou les deux d'un seul geste.
  const lots = n => Array.from({ length: (1 << n) - 1 }, (_, k) => Array.from({ length: n }, (_, i) => i).filter(i => (k + 1) >> i & 1))

  P.moule({
    cle: 'sabliers',
    nom: 'Les sabliers',
    socle: 'chemin',
    glyphe: 'sablier',
    unite: ['geste', 'gestes'],
    // Un sablier coule dès qu'il a du sable en haut : `haut` suffit, et rien ne peut le contredire.
    depart: f => ({ haut: f.sabliers.map(() => 0), t: 0, parti: false, dit: false }),
    // Avant « je commence », le temps ne se compte pas : deux préparations qui laissent le même sable sont la même.
    signature: e => e.haut.join(',') + (e.parti ? '|' + e.t : '') + (e.dit ? '!' : ''),
    jauge: (f, e) => (e.parti ? `${e.t} min sur ${f.cible}` : null),
    coups(f, e) {
      if (e.dit) return []
      return [...lots(f.sabliers.length).map(l => ({ retourne: l })), ...(coule(e) ? [{ attend: true }] : []), e.parti ? { maintenant: true } : { commence: true }]
    },
    jouer(f, e, coup) {
      if (e.dit) return { refus: 'Tu as déjà dit « maintenant ».' }
      if (coup.retourne) {
        if (!coup.retourne.length || coup.retourne.some(i => f.sabliers[i] === undefined)) return { refus: 'Touche un sablier pour le retourner.' }
        return { etat: { ...e, haut: e.haut.map((x, i) => (coup.retourne.includes(i) ? f.sabliers[i] - x : x)) } }
      }
      if (coup.attend) {
        // Sans sable qui coule, rien ne dirait quand s'arrêter d'attendre : le temps ne se lit que sur un sablier qui se vide.
        if (!coule(e)) return { refus: 'Aucun sablier ne coule : rien ne te dirait quand t’arrêter.' }
        const dt = Math.min(...e.haut.filter(x => x > 0))
        return { etat: { ...e, haut: e.haut.map(x => Math.max(0, x - dt)), t: e.t + (e.parti ? dt : 0) } }
      }
      if (coup.commence) return e.parti ? { refus: 'Tu as déjà commencé.' } : { etat: { ...e, parti: true, t: 0 } }
      if (coup.maintenant) return e.parti ? { etat: { ...e, dit: true } } : { refus: 'Dis d’abord « Je commence ».' }
      return { refus: 'Je n’ai pas compris ce geste.' }
    },
    fini(f, e) {
      if (e.dit && e.t === f.cible) return { gagne: true }
      if (e.dit) return { perdu: e.t ? `Trop tôt : il ne s’est écoulé que ${minutes(e.t)}.` : 'Trop tôt : pas un grain n’a coulé depuis ton départ.' }
      // Passé la cible, plus rien ne rattrape le compte : autant le dire tout de suite.
      if (e.parti && e.t > f.cible) return { perdu: `Trop tard : ${minutes(e.t)} ont passé, il en fallait ${f.cible}.` }
      return null
    },
    dessiner({ f, e, agir, fige }) {
      const grand = Math.max(...f.sabliers)
      const sablier = (cap, i) => {
        const haut = Math.round(22 + 34 * cap / grand)
        const bulbe = (ou, n) => h('span', { class: `sb-bulbe sb-${ou}`, style: `height:${haut}px` },
          h('i', { class: 'sb-sable', style: `height:${100 * n / cap}%` }),
          ou === 'bas' && e.haut[i] > 0 && h('i', { class: 'sb-filet' }))
        return h('button', {
          type: 'button', class: 'sb-sablier', disabled: fige || e.dit,
          'aria-label': `Retourner le sablier de ${minutes(cap)} : ${e.haut[i]} en haut, ${cap - e.haut[i]} en bas`,
          onclick: () => agir({ retourne: [i] }),
        },
        h('small', null, `Sablier de ${cap} min`),
        h('span', { class: 'sb-verre' },
          bulbe('haut', e.haut[i]), h('b', null, String(e.haut[i]), h('small', null, 'en haut')),
          bulbe('bas', cap - e.haut[i]), h('b', null, String(cap - e.haut[i]), h('small', null, 'en bas'))),
        h('span', { class: 'sb-geste' }, e.haut[i] > 0 ? 'il coule · ↻ retourner' : '↻ retourner'))
      }
      return h('div', { class: 'sb' },
        h('p', { class: 'sb-tete' },
          h('span', null, 'Le but : ', h('b', null, `${f.cible} min`)),
          h('span', { class: 'sb-temps' }, e.parti ? ['Depuis ton départ : ', h('b', null, `${e.t} min`)] : 'Le compte n’a pas commencé.')),
        h('div', { class: 'sb-rang' }, f.sabliers.map(sablier)),
        h('div', { class: 'sb-gestes' },
          h('button', { type: 'button', disabled: fige || e.dit, onclick: () => agir({ retourne: f.sabliers.map((_, i) => i) }) }, f.sabliers.length > 2 ? 'Les retourner tous' : 'Retourner les deux', h('small', null, 'au même instant')),
          h('button', { type: 'button', disabled: fige || e.dit || !coule(e), onclick: () => agir({ attend: true }) }, 'Laisser couler', h('small', null, 'jusqu’à un sablier vide'))),
        h('div', { class: 'pose' }, e.parti
          ? h('button', { type: 'button', class: 'bouton', disabled: fige || e.dit, onclick: () => agir({ maintenant: true }) }, 'C’est maintenant !')
          : h('button', { type: 'button', class: 'bouton', disabled: fige, onclick: () => agir({ commence: true }) }, 'Je commence')))
    },
  })

  /* ---------------------------------------------------------------- */

  const fiche = (a, b, cible, niveau, titre, source, recit) => P.fiche({
    id: `sabliers-${a}-${b}-${cible}`, moule: 'sabliers', niveau, titre, source,
    recit: [...recit, 'Retourne-les quand tu veux, autant que tu veux.', 'Dis « Je commence », puis « C’est maintenant ! » : je compterai le temps passé entre les deux.'],
    regle: 'Touche un sablier pour le retourner. Le temps ne passe que lorsque tu laisses couler.',
    sabliers: [a, b], cible,
  })
  fiche(3, 5, 7, 2, 'Les deux sabliers', 'Tradition, XIXe siècle : les problèmes de sabliers, cousins de ceux des cruches',
    ['Deux sabliers : l’un dure trois minutes, l’autre cinq. Il m’en faut sept, pas une de plus.'])
  fiche(4, 7, 9, 3, 'Neuf minutes', 'Tradition, XIXe siècle : les sabliers de quatre et de sept minutes',
    ['Un sablier de quatre minutes, un autre de sept. Mesure-m’en neuf, exactement.'])
  fiche(7, 11, 15, 4, 'L’œuf de quinze minutes', 'Tradition : l’œuf à cuire quinze minutes avec les sabliers de sept et de onze',
    ['Un œuf d’ibis doit cuire quinze minutes. Je n’ai que deux sabliers : sept minutes et onze.'])
}
