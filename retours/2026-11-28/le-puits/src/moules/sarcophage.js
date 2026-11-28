'use strict'
/* Le sarcophage caché : une sonde. Sous l'une des dalles d'une grille dort un
   sarcophage ; on touche une dalle, et le Sphinx dit à combien de pas on en
   est — de côté ou de haut en bas, jamais en biais. C'est « Mugwump », le
   cache-cache sur grille que Bob Albrecht publie en 1973 dans le journal de la
   People's Computer Company (et David Ahl dans BASIC Computer Games, 1978), où
   la distance se donnait à vol d'oiseau. Compter en pas change tout : deux
   dalles bien choisies — deux coins voisins — situent le sarcophage où qu'il
   soit, et la troisième est la sienne.
   Au dernier niveau, le Sphinx peut mentir une fois, d'un pas : le jeu des
   questions à un mensonge de Stanislaw Ulam (1976).

   Une fiche donne `large` et `haut` (la grille), `menteur`, `graine` (d'où sort
   la cachette) et `coupsMax`. Rien ne s'écrit à la main : le moule tire. */
{
  const P = globalThis.P
  const { h } = P

  P.glyphes.sarcophage = ['...###...', '..#####..', '.#######.', '.##.#.##.', '.#######.', '..#####..', '..##.##..', '..#####..', '...###...']

  P.style(`
.sa { display: grid; gap: 6px; justify-items: center; }
.sa-grille { display: grid; gap: 4px; touch-action: manipulation; }
.sa-dalle { width: var(--cote); height: var(--cote); padding: 0; display: grid; place-items: center; border: 0; border-radius: 5px; background: #3a2e26; box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.07); font: 600 19px/1 var(--f-pixel); color: var(--or-clair); font-variant-numeric: tabular-nums; }
.sa-dalle.vue { background: var(--boite); box-shadow: inset 0 0 0 1px rgba(217, 181, 106, 0.55); cursor: default; }
.sa-dalle.trouve { background: linear-gradient(180deg, var(--or-clair), var(--or)); box-shadow: 0 0 14px rgba(var(--sable), 0.6); color: #1a1412; }
.sa-dalle[disabled] { cursor: default; }
.sa-etat { width: 100%; display: flex; justify-content: space-between; gap: 8px; margin: 0; font-size: 12px; line-height: 1.4; color: var(--muted); }
.sa-etat b { color: var(--or-clair); font-weight: 600; }
`)

  const pas = (f, a, b) => Math.abs(a % f.large - b % f.large) + Math.abs(Math.floor(a / f.large) - Math.floor(b / f.large))
  const auPlusLoin = (f, c) => Math.max(c % f.large, f.large - 1 - c % f.large) + Math.max(Math.floor(c / f.large), f.haut - 1 - Math.floor(c / f.large))

  /* En combien de touches trouve-t-on à coup sûr ? Un minimax sur ce qu'on sait encore : `surs`, les dalles
     qu'aucune réponse ne contredit (s'il est là, le Sphinx n'a pas encore menti), et `doutes`, celles qu'une
     seule réponse contredit, d'un pas (s'il est là, son mensonge est fait). `peut` dit si k touches suffisent
     quoi qu'il réponde ; la dernière doit être la bonne dalle, où il ne peut pas mentir. Une dalle ne se
     touche qu'une fois, dans le calcul comme dans le jeu. */
  const GARANTIS = new Map()
  function garanti(f) {
    const cle = `${f.large}x${f.haut}${f.menteur ? 'm' : ''}`
    if (GARANTIS.has(cle)) return GARANTIS.get(cle)
    const n = f.large * f.haut
    const vus = new Map()
    const partage = (surs, doutes, c) => {
      const m = new Map()
      const range = (d, p, sur) => { if (!m.has(d)) m.set(d, [[], []]); m.get(d)[sur ? 0 : 1].push(p) }
      for (const p of surs) {
        if (p === c) continue
        const d = pas(f, p, c)
        range(d, p, true)
        if (f.menteur) { if (d > 1) range(d - 1, p, false); range(d + 1, p, false) }
      }
      for (const p of doutes) if (p !== c) range(pas(f, p, c), p, false)
      // La plus grosse part d'abord : c'est elle qui fait échouer une touche, autant le savoir tout de suite.
      return [...m.values()].sort((a, b) => b[0].length + b[1].length - a[0].length - a[1].length)
    }
    const peut = (surs, doutes, k, touchees) => {
      const reste = surs.length + doutes.length
      if (reste <= 1) return reste <= k
      if (k < 2) return false
      const cleDuNoeud = `${surs}|${doutes}|${k}|${touchees}`
      if (vus.has(cleDuNoeud)) return vus.get(cleDuNoeud)
      const essais = []
      for (let c = 0; c < n; c++) {
        if (touchees.includes(c)) continue
        const parts = partage(surs, doutes, c)
        const grosse = parts.length ? parts[0][0].length + parts[0][1].length : 0
        // Une touche qui n'écarte rien ne vaut pas d'être essayée ; à deux touches de la fin, il faut qu'elle sépare tout.
        if (grosse < reste && !(k === 2 && grosse > 1)) essais.push([grosse, c, parts])
      }
      essais.sort((a, b) => a[0] - b[0])
      const r = essais.some(([, c, parts]) => {
        const apres = [...touchees, c].sort((a, b) => a - b)
        return parts.every(([s, d]) => peut(s, d, k - 1, apres))
      })
      vus.set(cleDuNoeud, r)
      return r
    }
    const toutes = Array.from({ length: n }, (_, i) => i)
    let k = 1
    while (!peut(toutes, [], k, [])) k++
    GARANTIS.set(cle, k)
    return k
  }

  const moule = P.moule({
    cle: 'sarcophage',
    nom: 'Le sarcophage caché',
    socle: 'sonde',
    glyphe: 'sarcophage',
    unite: ['touche', 'touches'],
    // Dans l'application, la cachette et le mensonge prévu resteraient au serveur, qui ne rendrait que des
    // nombres de pas : ici tout vit dans l'état, et la maquette ne triche que si on ouvre la console.
    depart(f, tour) {
      const alea = P.alea(f.graine + (tour || 0))
      const secret = P.entier(alea, 0, f.large * f.haut - 1)
      // Le mensonge se décide d'avance, à une touche tirée au sort : sur la dernière, il ne changerait rien — c'est sa façon de ne pas mentir.
      return { secret, touches: [], ment: f.menteur ? { au: P.entier(alea, 0, f.coupsMax - 1), de: P.parmi(alea, [-1, 1]) } : null }
    },
    jauge: (f, e) => `${e.touches.length} sur ${f.coupsMax}`,
    coups: (f, e) => Array.from({ length: f.large * f.haut }, (_, c) => c).filter(c => !e.touches.some(t => t.c === c)).map(c => ({ touche: c })),
    jouer(f, e, coup) {
      const c = coup.touche
      if (!Number.isInteger(c) || c < 0 || c >= f.large * f.haut) return { refus: 'Touche une dalle de la grille.' }
      if (e.touches.some(t => t.c === c)) return { refus: 'Tu as déjà touché cette dalle.' }
      const vrai = pas(f, c, e.secret)
      let d = vrai
      if (e.ment && e.ment.au === e.touches.length && vrai) {
        // Un mensonge qui dirait « zéro », ou plus loin que la grille ne va, se dénoncerait tout seul.
        d = vrai + e.ment.de
        if (d < 1) d = vrai + 1
        if (d > auPlusLoin(f, c)) d = vrai > 1 ? vrai - 1 : vrai
      }
      return { etat: { ...e, touches: [...e.touches, { c, d }] } }
    },
    fini(f, e) {
      const derniere = e.touches[e.touches.length - 1]
      if (derniere && derniere.c === e.secret) return { gagne: true }
      if (e.touches.length < f.coupsMax) return null
      return { perdu: `Il dormait rangée ${Math.floor(e.secret / f.large) + 1}, colonne ${e.secret % f.large + 1}. Je le cache ailleurs.` }
    },
    verifier(f) {
      const n = garanti(f)
      if (n > f.coupsMax) return { ok: false, note: `il faut ${n} touches pour être sûr, la fiche n’en donne que ${f.coupsMax}` }
      return { ok: true, coups: n, note: `trouvé à coup sûr${f.menteur ? ', même s’il ment' : ''} ; ${f.coupsMax} permises` }
    },
    dessiner({ f, e, agir, dire, fige }) {
      // La grille et sa ligne d'état tiennent ensemble dans le cadre : en 7 × 7, une dalle fait encore 40 pixels.
      const cote = Math.min(56, Math.floor((328 - 4 * (f.large - 1)) / f.large), Math.floor((340 - 24 - 4 * (f.haut - 1)) / f.haut))
      const clos = fige || !!moule.fini(f, e)
      const dalle = c => {
        const t = e.touches.find(x => x.c === c)
        const ou = `Rangée ${Math.floor(c / f.large) + 1}, colonne ${c % f.large + 1}`
        if (t && c === e.secret) return h('button', { type: 'button', class: 'sa-dalle trouve', disabled: true, 'aria-label': `${ou} : le sarcophage`, html: P.glyphe('sarcophage', Math.round(cote * 0.62)) })
        if (t) return h('button', { type: 'button', class: 'sa-dalle vue', disabled: true, 'aria-label': `${ou} : à ${t.d} pas` }, String(t.d))
        return h('button', {
          type: 'button', class: 'sa-dalle', disabled: clos, 'aria-label': `${ou} : pas encore touchée`,
          onclick: () => {
            // La réponse se lit sur le coup qu'on va jouer : le Sphinx la dit, sauf si la partie s'arrête là.
            const r = moule.jouer(f, e, { touche: c })
            agir({ touche: c })
            if (!r.etat || moule.fini(f, r.etat)) return
            const d = r.etat.touches[r.etat.touches.length - 1].d
            dire(d === 1 ? 'Tu brûles : à un pas.' : `À ${d} pas.`)
          },
        })
      }
      const reste = f.coupsMax - e.touches.length
      return h('div', { class: 'sa' },
        h('div', { class: 'sa-grille', style: `--cote:${cote}px;grid-template-columns:repeat(${f.large},${cote}px)`, role: 'group', 'aria-label': `${f.large * f.haut} dalles, ${f.haut} rangées de ${f.large}` },
          Array.from({ length: f.large * f.haut }, (_, c) => dalle(c))),
        h('p', { class: 'sa-etat' },
          h('span', null, reste > 1 ? ['Encore ', h('b', null, `${reste} touches`), '.'] : reste === 1 ? h('b', null, 'Dernière touche.') : 'Plus de touche.'),
          f.menteur && h('span', null, 'Une réponse peut mentir d’un pas.')))
    },
    // Rien à inventer que la grille : la cachette sort de la graine, et le minimax a dit une fois pour toutes
    // ce que chaque grille demande — trois touches sans mensonge, cinq avec, de 4 × 4 à 7 × 7.
    tirer(graine, niveau) {
      const NIVEAUX = [
        // Les deux premiers niveaux laissent une touche de trop : on y apprend le jeu avant d'y chercher la trouvaille.
        { large: 4, haut: 4, coupsMax: 4 },
        { large: 5, haut: 5, coupsMax: 4 },
        { large: 6, haut: 6, coupsMax: 3 },
        { large: 7, haut: 7, coupsMax: 3 },
        { large: 7, haut: 7, coupsMax: 5, menteur: true },
      ]
      const n = NIVEAUX[Math.min(4, Math.max(0, niveau - 1))]
      const dalles = n.large * n.haut
      const EN_MOTS = ['', '', '', 'trois', 'quatre', 'cinq']
      return {
        id: `sarcophage-${n.large}x${n.haut}${n.menteur ? 'm' : ''}-${n.coupsMax}-${graine}`, moule: 'sarcophage', niveau, tiree: true,
        titre: n.menteur ? 'Le sarcophage et le menteur' : `Le sarcophage sous ${dalles} dalles`,
        source: 'Tirée par le programme, sur le modèle de « Mugwump », cache-cache sur grille de Bob Albrecht (People’s Computer Company, 1973)'
          + (n.menteur ? ', et du jeu à un mensonge de Stanislaw Ulam (1976)' : ''),
        recit: [
          `Sous l’une de ces ${dalles} dalles dort un sarcophage.`,
          'Touche une dalle : je te dirai à combien de pas il se trouve, de dalle en dalle, jamais en biais.',
          n.menteur
            ? `Tu as ${EN_MOTS[n.coupsMax]} touches. Mais une fois, une seule, je pourrai te mentir d’un pas.`
            : `Tu as ${EN_MOTS[n.coupsMax]} touches : la dernière doit être la sienne.`,
        ],
        regle: n.menteur
          ? 'Des pas de côté ou de haut en bas. Une de mes réponses, au plus, est fausse d’un pas.'
          : 'Un pas va d’une dalle à sa voisine, de côté ou de haut en bas, jamais en biais.',
        large: n.large, haut: n.haut, menteur: !!n.menteur, graine, coupsMax: n.coupsMax,
      }
    },
  })

  /* ---------------------------------------------------------------- */

  // Deux tirages gardés tels quels, pour l'atelier : le premier pardonne une touche, le second n'en laisse pas une.
  const SOURCE = '« Mugwump », cache-cache sur grille de Bob Albrecht (People’s Computer Company, 1973) — ici, on compte en pas'
  P.fiche({ ...moule.tirer(1978, 2), id: 'sarcophage-a', tiree: false, titre: 'Le sarcophage caché', source: SOURCE })
  P.fiche({ ...moule.tirer(1922, 4), id: 'sarcophage-b', tiree: false, titre: 'Le sarcophage sous le sable', source: SOURCE })
}
