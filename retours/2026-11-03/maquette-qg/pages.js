'use strict'
// Les pages de la maquette, première moitié : les pièces communes, puis la
// commande (poste, direct, alertes, journal) et la technique (serveur,
// base et miroir, erreurs, téléphones). Les modes, les joueurs et le
// contenu sont dans `pages-modes.js`.

// ── Les pièces communes ───────────────────────────────────────────────

/** Une étiquette de source : ce que le serveur mesure déjà, ce qu'il faudra calculer, ce qu'il faudra relever. */
function source(sorte) {
  const nom = { la: 'Déjà mesuré', derive: 'À calculer', nouveau: 'Nouveau relevé' }[sorte]
  return h('span', { class: 'source ' + sorte, title: nom }, nom)
}

function tetePage({ surtitre, titre, chapo, droite, neuf }) {
  return h('div', { class: 'tete-page' },
    h('div', { class: 'gauche' },
      h('div', { class: 'surtitre' }, surtitre, neuf ? h('span', { class: 'neuf' }, 'NOUVEAU') : null),
      h('h1', { class: 'titre-page' }, titre),
      chapo ? h('p', { class: 'chapo' }, chapo) : null,
    ),
    droite ? h('div', { class: 'droite' }, droite) : null,
  )
}

/** Une console : une surface, son titre, ce qu'elle lit, et son contenu. */
function console_({ titre, etiquette, sous, droite, src, hud, classe = '', lecture, corps }) {
  return h('section', { class: `console ${hud ? 'hud ' + (hud === 'vert' ? 'vert' : '') : ''} ${classe}`.trim() },
    titre || etiquette || droite || src
      ? h('div', { class: 'console-tete' },
          h('div', { class: 'gauche' },
            etiquette ? h('span', { class: 'etiquette' }, etiquette) : null,
            titre ? h('h3', null, titre) : null,
            sous ? h('div', { class: 'sous' }, sous) : null,
            lecture || null,
          ),
          droite || src ? h('div', { class: 'droite' }, droite || null, src ? source(src) : null) : null,
        )
      : null,
    corps,
  )
}

/** Une tuile : un chiffre, son écart à la période d'avant, sa courbe. */
/**
 * Une tuile : un chiffre, son écart à la période d'avant, sa courbe. L'écart
 * se colore selon qu'il va dans le bon sens ; ce qu'on dit en plus suit,
 * en sourdine.
 */
function tuile({ nom, valeur, unite, ecart, monteEstBien = true, courbe, couleur, src, cle, detail, contre = 'vs avant', vive }) {
  let ligne = [detail || '']
  if (ecart != null && Number.isFinite(ecart)) {
    const bien = Math.abs(ecart) < 0.5 ? null : (ecart > 0) === monteEstBien
    ligne = [
      h('span', { class: bien == null ? '' : bien ? 'ecart-bon' : 'ecart-mauvais' }, `${ecart > 0.5 ? '▲' : ecart < -0.5 ? '▼' : '='} ${ecartSigne(ecart)} ${contre}`),
      detail ? ' · ' + detail : null,
    ]
  }
  return h('div', { class: 'tuile' + (vive ? ' vive' : '') },
    h('div', { class: 'tuile-nom' }, cle ? h('span', { class: 'cle', style: { background: cle } }) : null, nom, src ? h('span', { style: { marginLeft: 'auto' } }, source(src)) : null),
    h('div', { class: 'tuile-valeur' }, valeur, unite ? h('small', null, unite) : null),
    h('div', { class: 'tuile-ecart' }, ligne),
    courbe ? etincelle(courbe, { couleur: couleur || 'var(--or)' }) : null,
  )
}

function legende(items) {
  return h('div', { class: 'legende' },
    items.map(it => h('span', null, h('span', { class: (it.trait ? 'trait' : 'cle') + (it.tirets ? ' tirets' : ''), style: { background: it.couleur, color: it.couleur } }), it.nom)),
  )
}

function onglets(liste, actif, surChoix) {
  return h('div', { class: 'onglets', role: 'tablist' },
    liste.map(o =>
      h('button', { type: 'button', class: 'onglet', role: 'tab', 'aria-selected': String(o.cle === actif), onClick: () => surChoix(o.cle) },
        o.icone ? icone(o.icone) : null, o.nom, o.compte != null ? h('span', { class: 'compte' }, o.compte) : null),
    ),
  )
}

function puces(liste, actifs, surChoix, { multi = false } = {}) {
  return h('div', { class: 'puces' },
    liste.map(p =>
      h('button', { type: 'button', class: 'puce', 'aria-pressed': String(multi ? actifs.has(p.cle) : actifs === p.cle), onClick: () => surChoix(p.cle) },
        p.couleur ? h('span', { class: 'cle', style: { background: p.couleur } }) : null, p.nom, p.compte != null ? h('span', { class: 'compte' }, p.compte) : null),
    ),
  )
}

function statut(sorte, texte) {
  const ic = { ok: 'ok', veille: 'maintenance', serieux: 'maintenance', critique: 'erreur', neutre: 'info', neuf: 'etincelles' }[sorte]
  return h('span', { class: 'statut ' + sorte }, icone(ic), texte)
}

/**
 * Un tableau triable. colonnes : [{ cle, nom, n (nombre), rendre(ligne), valeur(ligne) pour trier, largeur }]
 * Le tri se retient par sa clé (`id`) le temps de la visite.
 */
const TRIS = new Map()
function tableau({ id, colonnes, lignes, triInitial, sensInitial = 'desc', surLigne, vide = 'Rien à montrer', choisie }) {
  const memo = TRIS.get(id) || { cle: triInitial, sens: sensInitial }
  TRIS.set(id, memo)
  const cadre = h('div', { class: 'cadre-tableau' })
  const dessiner = () => {
    const col = colonnes.find(c => c.cle === memo.cle)
    const triees = col
      ? lignes.slice().sort((a, b) => {
          const va = col.valeur ? col.valeur(a) : a[col.cle]
          const vb = col.valeur ? col.valeur(b) : b[col.cle]
          const r = typeof va === 'string' ? va.localeCompare(vb, 'fr') : (va ?? -Infinity) - (vb ?? -Infinity)
          return memo.sens === 'asc' ? r : -r
        })
      : lignes
    const table = h('table', { class: 'donnees' },
      h('thead', null,
        h('tr', null,
          colonnes.map(c => {
            const actif = memo.cle === c.cle
            return h('th', { class: c.n ? 'n' : null, 'aria-sort': actif ? (memo.sens === 'asc' ? 'ascending' : 'descending') : null, style: c.largeur ? { width: c.largeur } : null, scope: 'col' },
              c.tri === false
                ? h('span', null, c.nom)
                : h('button', { type: 'button', class: 'tri', onClick: () => {
                      if (memo.cle === c.cle) memo.sens = memo.sens === 'asc' ? 'desc' : 'asc'
                      else {
                        memo.cle = c.cle
                        memo.sens = c.n ? 'desc' : 'asc'
                      }
                      dessiner()
                    } },
                    c.nom, h('span', { class: 'fleche' }, actif ? icone(memo.sens === 'asc' ? 'haut' : 'bas') : icone('tri'))),
            )
          }),
        ),
      ),
      h('tbody', null,
        triees.length
          ? triees.map(l =>
              h('tr', { class: (surLigne ? 'cliquable' : '') + (choisie && choisie(l) ? ' choisie' : ''), tabindex: surLigne ? '0' : null, onClick: surLigne ? () => surLigne(l) : null, onKeydown: surLigne ? e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), surLigne(l)) : null },
                colonnes.map(c => h('td', { class: (c.n ? 'n ' : '') + (c.classe || '') }, c.rendre ? c.rendre(l) : l[c.cle])),
              ),
            )
          : h('tr', null, h('td', { colspan: colonnes.length, class: 'discret' }, vide)),
      ),
    )
    cadre.replaceChildren(table)
  }
  dessiner()
  return cadre
}

function verbeDe(route) {
  const [verbe, ...reste] = route.split(' ')
  return [h('span', { class: 'verbe ' + verbe.toLowerCase() }, verbe), reste.join(' ')]
}
function part(x, couleur = 'var(--or)') {
  return h('span', { class: 'part' }, h('span', null, pct(x * 100, x < 0.1 ? 1 : 0)), h('span', { class: 'part-piste' }, h('span', { class: 'part-plein', style: { width: Math.max(2, x * 100) + '%', background: couleur } })))
}
function ecartTexte(x, monteEstBien = false) {
  if (x == null || !Number.isFinite(x)) return h('span', { class: 'discret' }, '—')
  const bien = Math.abs(x) < 3 ? null : (x > 0) === monteEstBien
  return h('span', { class: 'ecart ' + (bien == null ? 'discret' : bien ? 'ecart-bon' : 'ecart-mauvais') }, (x > 0 ? '▲ ' : x < 0 ? '▼ ' : '') + ecartSigne(x))
}

/** Le tiroir : le détail d'une ligne, par-dessus la page. */
function ouvrirTiroir(contenu, titre) {
  const calques = document.getElementById('calques')
  const avant = document.activeElement
  const fermer = () => {
    calques.replaceChildren()
    document.removeEventListener('keydown', echap)
    document.getElementById('app').inert = false
    if (avant && avant.focus) avant.focus()
  }
  const echap = e => e.key === 'Escape' && fermer()
  const boite = h('aside', { class: 'tiroir', role: 'dialog', 'aria-modal': 'true', 'aria-label': titre, tabindex: '-1' },
    h('div', { class: 'tiroir-tete' }, h('div', { style: { minWidth: 0 } }, contenu.tete), h('button', { type: 'button', class: 'icone-bouton fermer', 'aria-label': 'Fermer', onClick: fermer }, icone('fermer'))),
    contenu.corps,
  )
  calques.replaceChildren(h('div', { class: 'voile', onClick: fermer }), boite)
  document.getElementById('app').inert = true
  document.addEventListener('keydown', echap)
  boite.focus({ preventScroll: true })
}

/** Le rail des événements d'une fenêtre, du plus récent au plus ancien. */
function evenementsDe(f) {
  const liste = EVENEMENTS.filter(e => e.t >= f.debut && e.t <= f.fin)
  // Les réveils de chaque matin, comptés à part : ils sont tous pareils.
  return liste.sort((a, b) => b.t - a.t)
}

/** L'heure d'un fil : « 22:03 » aujourd'hui, « hier 23:02 », « dim. 1 · 18:10 » avant. */
function heureCourte(t) {
  const p = paris(t)
  const hm = `${String(p.h).padStart(2, '0')}:${String(p.m).padStart(2, '0')}`
  const j = minuit(maintenant())
  if (t >= j) return hm
  if (t >= j - JOUR) return 'hier ' + hm
  return `${jourCourt(t)} ${hm}`
}

function libellePlage(etat) {
  if (etat.perso) return `${jourCourt(etat.perso.debut)} ${heureEcrite(etat.perso.debut)} → ${jourCourt(etat.perso.fin)} ${heureEcrite(etat.perso.fin)}`
  return { direct: 'le direct', '1h': 'la dernière heure', '24h': 'les dernières 24 heures', '7j': 'les sept derniers jours', '30j': 'les trente derniers jours', '90j': 'les quatre-vingt-dix derniers jours' }[etat.plage]
}
const libelleDuPas = pas => (pas < MINUTE ? 'dix secondes par dix secondes' : pas < 5 * MINUTE ? 'minute par minute' : pas < HEURE ? 'cinq minutes par cinq minutes' : pas < 6 * HEURE ? 'heure par heure' : pas < JOUR ? 'six heures par six heures' : 'jour par jour')

// ── Le poste de commande ──────────────────────────────────────────────

function pagePoste(etat) {
  const f = fenetre(etat, 'produit')
  const ft = fenetre(etat, 'tech')
  const av = fenetreDAvant(f)
  const parties = MODES.map(m => serieDuMode(m.cle, f))
  const partiesAvant = MODES.map(m => serieDuMode(m.cle, av))
  const totalParties = somme(parties.map(somme))
  const totalAvant = somme(partiesAvant.map(somme))
  const questions = somme(MODES.map((m, k) => somme(parties[k]) * QUESTIONS_PAR_PARTIE[m.cle]))
  const questionsAvant = somme(MODES.map((m, k) => somme(partiesAvant[k]) * QUESTIONS_PAR_PARTIE[m.cle]))
  const joueurs = joueursUniques(f)
  const joueursAvant = joueursUniques(av)
  // Des personnes, pas des parties : sur une semaine, ceux du jour ne s'additionnent pas — chacun compte une fois.
  const personnes = fen => {
    if (fen.duree < 7 * JOUR) return Math.round(somme(joueursUniques(fen)) * (fen.duree <= HEURE ? 0.9 : 0.42))
    const jours = joueursUniques({ ...fen, pas: JOUR, t: seaux(fen.debut, fen.fin, JOUR) })
    return Math.round(moyenne(jours) * (fen.duree >= 30 * JOUR ? 2.45 : 1.62))
  }
  const nbJoueurs = personnes(f)
  const nbJoueursAvant = personnes(av)
  const p95 = serie('p95', ft)
  const p95Avant = serie('p95', fenetreDAvant(ft))
  const nouveaux = Math.round((f.duree / JOUR) * 4.6 + 2)
  const confettis = Math.round(totalParties * 7.8)
  const variation = (a, b) => (b ? ((a - b) / b) * 100 : null)
  const regroupe = n => {
    // La courbe d'une tuile : douze points, quelle que soit la fenêtre.
    const pasG = Math.max(1, Math.floor(n.length / 12))
    const r = []
    for (let i = 0; i < n.length; i += pasG) r.push(somme(n.slice(i, i + pasG)))
    return r
  }
  const toutes = f.t.map((_, i) => somme(parties.map(p => p[i])))

  const vueJoueurs = etat.vuePoste !== 'participations'
  const lecture = h('div', { class: 'lecture' })
  const graphe = grapheTemps({
    f, hauteur: 240, empile: !vueJoueurs, evenements: true, lecture, groupe: 'poste',
    nom: 'Participations par mode',
    series: vueJoueurs
      ? [{ nom: 'Joueurs', valeurs: joueurs.map(v => Math.round(v)), couleur: 'var(--or)', forme: 'colonnes' }]
      : MODES.map((m, k) => ({ nom: m.nom, valeurs: parties[k].map(v => Math.round(v)), couleur: m.couleur })),
    avant: etat.comparer && vueJoueurs ? [{ valeurs: joueursAvant.map(v => Math.round(v)), couleur: 'var(--encre-2)' }] : null,
    surZoom: (a, b) => zoomer(a, b),
  })

  return [
    tetePage({
      surtitre: 'Commande',
      titre: 'Poste de commande',
      chapo: 'L’état du service, les chiffres de la période et ce qui attend un geste, en un regard. La barre du haut règle le temps de toute la page.',
      droite: [h('span', { class: 'bouton', style: { cursor: 'default' } }, icone('horloge'), dateLongue(maintenant()) + ' · ' + heureEcrite(maintenant()))],
    }),
    h('div', { class: 'grille' },
      console_({
        classe: 'l-12', hud: true, etiquette: 'État du service', src: 'la',
        corps: [
          h('div', { class: 'etat-general' },
            h('div', { class: 'grand' }, h('em', null, 'Trois points'), ' à regarder · le reste est au vert'),
            h('span', { class: 'statut critique' }, icone('erreur'), '2 erreurs serveur depuis 21 h'),
            h('span', { class: 'statut serieux' }, icone('maintenance'), 'Arrêt net hier à 23 h 02'),
            h('span', { class: 'statut veille' }, icone('fusee'), 'a41c9e2 ralentit une route'),
          ),
          // Ce qui ne va pas d'abord : le regard tombe sur le rouge, pas sur la sixième case.
          h('div', { class: 'voyants quatre' },
            [
              ['critique', 'Erreurs serveur', '2 à regarder · Cabinet'],
              ['veille', 'Version a41c9e2', 'une route du Cabinet + 68 %'],
              ['ok', 'Ce qu’un joueur attend', 'p95 238 ms · 1 min'],
              ['ok', 'Temps réel', '13 sockets · 0 refus'],
              ['ok', 'Turso', 'p95 61 ms · 4 % neuves'],
              ['ok', 'Miroir', '3 écritures en attente'],
              ['ok', 'Quota de Turso', '32 % du mois, projeté'],
              ['ok', 'Mémoire', '236 sur 512 Mo'],
            ].map(([sorte, nom, detail]) =>
              h('div', { class: 'voyant-bloc' }, h('span', { class: 'voyant ' + (sorte === 'ok' ? '' : sorte) }), h('b', null, nom), h('small', null, detail)),
            ),
          ),
          h('div', { class: 'bas-de-console' },
            h('span', null, h('b', { class: 'second' }, 'Modes de jeu : '), 'les cinq répondent'),
            MODES.map(m => h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } }, h('span', { class: 'voyant' }), m.nom)),
            h('span', { style: { marginLeft: 'auto' } }, 'Relu toutes les dix secondes, sans Turso'),
          ),
        ],
      }),
    ),
    h('div', { class: 'tuiles bloc', style: { marginTop: '16px' } },
      tuile({ nom: 'Joueurs', valeur: nombre(nbJoueurs), ecart: variation(nbJoueurs, nbJoueursAvant), courbe: regroupe(joueurs), src: 'derive' }),
      tuile({ nom: 'Parties', valeur: nombre(Math.round(totalParties)), ecart: variation(totalParties, totalAvant), courbe: regroupe(toutes), src: 'la' }),
      tuile({ nom: 'Questions jouées', valeur: compact(Math.round(questions)), ecart: variation(questions, questionsAvant), courbe: regroupe(toutes), src: 'la' }),
      tuile({ nom: 'Nouveaux profils', valeur: nombre(nouveaux), ecart: 12, courbe: [2, 4, 3, 5, 3, 6, 4, 9, 5, 4, 7, 6], src: 'la' }),
      tuile({ nom: 'Confettis gagnés', valeur: compact(confettis), ecart: variation(totalParties, totalAvant) * 0.9, courbe: regroupe(toutes), src: 'la' }),
      tuile({ nom: 'Ressenti · 95ᵉ centile', valeur: ms(centile(p95, 0.5)), ecart: variation(centile(p95, 0.5), centile(p95Avant, 0.5)), monteEstBien: false, courbe: p95.filter(x => x != null).slice(-24), couleur: 'var(--or)', src: 'la' }),
    ),
    h('div', { class: 'grille' },
      console_({
        classe: 'l-8 etire',
        etiquette: vueJoueurs ? 'Joueurs uniques' : 'Participations, mode par mode',
        titre: `${libelleDuPas(f.pas)[0].toUpperCase() + libelleDuPas(f.pas).slice(1)}, sur ${libellePlage(etat)}`,
        lecture,
        droite: puces([{ cle: 'joueurs', nom: 'Joueurs' }, { cle: 'participations', nom: 'Participations' }], vueJoueurs ? 'joueurs' : 'participations', c => {
          etat.vuePoste = c
          rendrePage()
        }),
        src: 'la',
        corps: [
          graphe,
          h('div', { class: 'bas-de-console' },
            vueJoueurs ? h('span', null, 'Chaque personne une fois par seau, tous modes confondus ; un invité sans profil, une fois par soirée.') : legende(MODES.map(m => ({ nom: m.nom, couleur: m.couleur }))),
            h('span', { class: 'astuce', style: { marginLeft: 'auto' } }, icone('zoom'), 'Glisser pour zoomer · ▲ mise en ligne · ◆ ouverture, affiche'),
          ),
        ],
      }),
      console_({
        classe: 'l-4 etire', etiquette: 'À traiter', titre: 'Ce qui attend un geste', droite: h('span', { class: 'pastille' }, '5'), src: 'la',
        corps: h('ul', { class: 'liste' },
          [
            ['critique', 'erreur', '2 erreurs serveur à regarder', 'POST /api/cabinet/traversee/:id/geste · TypeError', 'erreurs'],
            ['serieux', 'serveur', 'Le serveur s’est arrêté net hier', 'à 23 h 02, sans s’éteindre · mémoire 486 Mo', 'serveur'],
            ['veille', 'drapeau', '3 questions signalées à relire', 'quiz du jour 2 · campagne 1', 'signalements'],
            ['veille', 'soiree', 'Une soirée laissée en plan', 'salon de Hugo · sans un geste depuis 7 h', 'soirees'],
            ['neutre', 'reserve', 'Réserve du quiz du jour : 9 jours', 'la routine du matin a ajouté 20 questions', 'reserves'],
          ].map(([sev, ic, titre, detail, page]) =>
            h('li', null, h('button', { type: 'button', class: 'chose', onClick: () => aller(page) },
              h('span', { class: 'bande ' + sev }), h('span', { class: 'rond' }, icone(ic)), h('span', null, h('b', null, titre), h('small', null, detail)), icone('chevron'))),
          ),
        ),
      }),
    ),
    h('div', { class: 'grille' },
      console_({
        classe: 'l-4 etire', etiquette: 'En ce moment', titre: 'Qui joue, à la minute', hud: 'vert', src: 'nouveau',
        droite: h('span', { class: 'fraicheur' }, h('span', { class: 'pouls' }), 'en direct'),
        corps: [
          h('div', { class: 'barres' },
            [['soiree', 11, '1 soirée · question 12 sur 20'], ['campagne', 14, ''], ['cabinet', 6, '4 traversées en route'], ['jour', 7, ''], ['duel', 3, '']].map(([cle, n, detail]) =>
              h('div', { class: 'barre' }, h('span', { class: 'nom' }, h('span', { class: 'cle', style: { width: '8px', height: '8px', borderRadius: '2px', background: MODE[cle].couleur, display: 'inline-block' } }), MODE[cle].nom), h('span', { class: 'piste' }, h('span', { class: 'plein', style: { width: (n / 16) * 100 + '%', background: MODE[cle].couleur, display: 'block' } })), h('span', { class: 'val' }, nombre(n))),
            ),
          ),
          h('div', { class: 'bas-de-console' }, h('span', null, h('b', { class: 'second' }, '41'), ' en partie · ', h('b', { class: 'second' }, '58'), ' en ligne'), h('button', { type: 'button', class: 'bouton', style: { marginLeft: 'auto' }, onClick: () => aller('direct') }, 'Ouvrir le direct', icone('droite'))),
        ],
      }),
      console_({
        classe: 'l-4 etire', etiquette: 'Santé du serveur', titre: 'Les dernières 24 heures', src: 'la',
        corps: (() => {
          const f24 = { ...fenetre({ plage: '24h' }, 'tech') }
          const f24h = { debut: f24.debut, fin: f24.fin, duree: f24.duree, pas: HEURE, t: seaux(f24.debut, f24.fin, HEURE) }
          return [
            grapheTemps({ f: f24h, hauteur: 92, unite: 'ms', nuits: true, nom: 'Ressenti au 95e centile', series: [{ nom: 'p95', valeurs: serie('p95', f24h), couleur: 'var(--or)', forme: 'aire' }], margeGauche: 46 }),
            h('div', { class: 'voyants', style: { marginTop: '12px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } },
              [['', 'Processeur', '4,1 % sur 10 %'], ['', 'Mémoire', '236 Mo · pic 302'], ['critique', 'Erreurs', '2 depuis 21 h'], ['', 'Gels', '3 · le pire 2,9 s']].map(([s2, n2, d2]) => h('div', { class: 'voyant-bloc' }, h('span', { class: 'voyant ' + s2 }), h('b', null, n2), h('small', null, d2))),
            ),
          ]
        })(),
      }),
      console_({
        classe: 'l-4 etire', etiquette: 'Fil des événements', titre: 'Ce qui s’est passé', src: 'derive',
        corps: h('ul', { class: 'fil' },
          [
            [T0 - 38 * MINUTE, 'var(--critique)', h('span', null, h('b', null, 'Erreur serveur'), ' · POST /api/cabinet/traversee/:id/geste')],
            [T0 - 1 * HEURE - 52 * MINUTE, 'var(--mode-soiree)', h('span', null, h('b', null, 'Soirée lancée'), ' · salon de Karim · 11 invités')],
            [T0 - 7 * HEURE - 10 * MINUTE, 'var(--or)', h('span', null, h('b', null, 'Geste'), ' · 50 confettis offerts à Léa (@lea)')],
            [T0 - 15 * HEURE - 46 * MINUTE, 'var(--encre-2)', h('span', null, h('b', null, 'Réveil'), ' · prêt en 3,7 s')],
            [Date.UTC(2026, 10, 2, 22, 4), 'var(--encre-2)', h('span', null, h('b', null, 'Redémarrage'), ' · après l’arrêt net')],
            [Date.UTC(2026, 10, 2, 22, 2), 'var(--critique)', h('span', null, h('b', null, 'Arrêt net'), ' · mémoire 486 Mo')],
            [VERSION_COURANTE.t, 'var(--or)', h('span', null, h('b', null, 'Mise en ligne'), ' · ', h('span', { class: 'mono' }, 'a41c9e2'))],
          ].map(([t, c, quoi]) => h('li', null, h('time', null, heureCourte(t)), h('span', { class: 'point', style: { background: c } }), h('span', { class: 'quoi' }, quoi))),
        ),
      }),
    ),
  ]
}

// ── Le direct ─────────────────────────────────────────────────────────

/** Le fil du direct : ce qui arrive, inventé au fil des secondes, mêmes règles que le QG — des soirées, rien que des chiffres. */
const FIL = []
let dernierTirage = 0
function nourrirLeFil(t) {
  const modeles = [
    () => ({ sorte: 'parties', couleur: MODE.jour.couleur, texte: [h('b', null, PRENOMS[Math.floor(hasard('f1', t / 1000) * 24)]), ' a fini le quiz du jour · ', h('span', { class: 'mono' }, `${4 + Math.floor(hasard('f2', t / 1000) * 7)}/10`)] }),
    () => ({ sorte: 'parties', couleur: MODE.campagne.couleur, texte: [h('b', null, PRENOMS[Math.floor(hasard('f3', t / 1000) * 24)]), ' valide le palier ', h('span', { class: 'mono' }, String(1 + Math.floor(hasard('f4', t / 1000) * 11))), ' du sentier ', ['Histoire', 'Sciences', 'Musique', 'Géographie', 'Cinéma & séries'][Math.floor(hasard('f5', t / 1000) * 5)]] }),
    () => ({ sorte: 'parties', couleur: MODE.cabinet.couleur, texte: [h('b', null, PRENOMS[Math.floor(hasard('f6', t / 1000) * 24)]), ' ', ['bat le Renard', 'tombe face au Sphinx', 'achète un cœur chez le marchand', 'ouvre un coffre', 'gagne sa traversée · le Dragon'][Math.floor(hasard('f7', t / 1000) * 5)]] }),
    () => ({ sorte: 'parties', couleur: MODE.duel.couleur, texte: [h('b', null, PRENOMS[Math.floor(hasard('f8', t / 1000) * 24)]), ' lance un duel classé · ', h('span', { class: 'mono' }, `cote ${1100 + Math.floor(hasard('f9', t / 1000) * 400)}`)] }),
    () => ({ sorte: 'soirees', couleur: MODE.soiree.couleur, texte: [h('b', null, 'Salon de Karim'), ' · question ', h('span', { class: 'mono' }, String(12 + Math.floor((t - T0) / 40000) % 9)), ' révélée · 11 invités'] }),
    () => ({ sorte: 'serveur', couleur: 'var(--encre-2)', texte: [h('b', null, 'Gel de la boucle'), ' · ', h('span', { class: 'mono' }, ms(520 + hasard('fa', t / 1000) * 900)), ' · soirée · rangement après le quiz'] }),
    () => ({ sorte: 'erreurs', couleur: 'var(--critique)', texte: [h('b', null, 'Erreur 500'), ' · ', h('span', { class: 'mono' }, 'POST /api/cabinet/traversee/:id/geste')] }),
  ]
  const poids = [0.24, 0.22, 0.17, 0.12, 0.17, 0.05, 0.03]
  const n = hasard('fil-n', Math.floor(t / 2000)) < 0.62 ? 1 : 0
  for (let k = 0; k < n; k++) {
    let r = hasard('fil-m', Math.floor(t / 2000) * 3 + k)
    let i = 0
    while (r > poids[i] && i < poids.length - 1) r -= poids[i++]
    FIL.unshift({ t, ...modeles[i](), neuf: true })
  }
  FIL.length = Math.min(FIL.length, 60)
}
function amorcerLeFil() {
  if (FIL.length) return
  for (let t = maintenant() - 4 * MINUTE; t < maintenant(); t += 2000) nourrirLeFil(t)
  for (const e of FIL) e.neuf = false
  dernierTirage = maintenant()
}

function pageDirect(etat) {
  amorcerLeFil()
  const zones = {}
  const cpt = (cle, nom, detail, unite) => {
    const valeur = h('span', null, '—')
    zones[cle] = valeur
    zones[cle + '-detail'] = h('div', { class: 'detail' }, detail)
    return h('div', { class: 'compteur' }, h('div', { class: 'nom' }, nom), h('div', { class: 'valeur' }, valeur, unite ? h('small', null, unite) : null), zones[cle + '-detail'])
  }
  const filtres = etat.filtreFil || 'tout'
  const fil = h('ul', { class: 'fil', 'aria-live': 'polite' })
  const graphes = {
    requetes: h('div'), p95: h('div'), processeur: h('div'), memoire: h('div'),
  }
  const modes = h('div', { class: 'modes' })
  const locaux = new Set()
  const mettreAJour = () => {
    // Ce que le tour d'avant avait monté se défait : les graphes du direct se redessinent toutes les deux secondes.
    for (const ro of locaux) {
      ro.disconnect()
      OBSERVES.delete(ro)
    }
    locaux.clear()
    VISEURS.delete('direct')
    collecteur = locaux
    try {
      mettreAJourLeDirect()
    } finally {
      collecteur = null
    }
  }
  const mettreAJourLeDirect = () => {
    const t = maintenant()
    const f = { debut: t - 15 * MINUTE, fin: t, duree: 15 * MINUTE, pas: 10 * SECONDE, t: seaux(t - 15 * MINUTE, t, 10 * SECONDE) }
    const req = serie('requetes', f)
    const p95 = serie('p95', f)
    const cpu = serie('processeur', f)
    const mem = serie('memoire', f)
    const derniere = arr => {
      for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]
      return null
    }
    const parMin = somme(req.slice(-6))
    zones.connectes.textContent = nombre(Math.round(METRIQUES.connectes.point(t)))
    zones.requetes.textContent = nombre(Math.round(parMin))
    zones.p95.textContent = ms(derniere(p95))
    zones.erreurs.textContent = nombre(somme(serie('erreurs', { ...f, t: f.t.slice(-30) })))
    zones.processeur.textContent = nombre(derniere(cpu), 1)
    zones.memoire.textContent = nombre(Math.round(derniere(mem)))
    zones.boucle.textContent = ms(METRIQUES.boucle.point(t, 10 * SECONDE))
    zones.turso.textContent = ms(METRIQUES.turso.point(t, 10 * SECONDE))
    const g = (cle, opts) => graphes[cle].replaceChildren(grapheTemps({ f, hauteur: 118, groupe: 'direct', margeGauche: 46, ...opts }))
    g('requetes', { nom: 'Requêtes par dix secondes', series: [{ nom: 'requêtes', valeurs: req, couleur: 'var(--or)', forme: 'colonnes' }] })
    g('p95', { nom: 'Ressenti', unite: 'ms', series: [{ nom: 'p95', valeurs: p95, couleur: 'var(--or)', forme: 'aire' }] })
    g('processeur', { nom: 'Processeur', unite: '%', plafond: { v: 10, texte: 'plafond · 10 %' }, series: [{ nom: 'processeur', valeurs: cpu, couleur: 'var(--or)', forme: 'aire', unite: 'pct-coeur' }] })
    g('memoire', { nom: 'Mémoire', unite: 'Mo', plafond: { v: 512, texte: 'plafond · 512 Mo' }, yMax: 300, series: [{ nom: 'mémoire', valeurs: mem, couleur: 'var(--or)', forme: 'aire' }] })
    const enJeu = { soiree: 11, campagne: 14, cabinet: 6, jour: 7, duel: 3 }
    modes.replaceChildren(...MODES.map(m => {
      const n = Math.max(0, Math.round(enJeu[m.cle] + 2 * bruit('direct-' + m.cle, Math.floor(t / 6000))))
      const fm = { debut: t - 15 * MINUTE, fin: t, duree: 15 * MINUTE, pas: MINUTE, t: seaux(t - 15 * MINUTE, t, MINUTE) }
      return h('button', { type: 'button', class: 'mode', onClick: () => aller(m.page) },
        h('span', { class: 'mode-nom' }, h('span', { class: 'cle', style: { background: m.couleur } }), m.nom),
        h('span', { class: 'mode-chiffre' }, nombre(n)),
        h('span', { class: 'mode-detail' }, m.cle === 'soiree' ? '1 soirée · 11 invités' : m.cle === 'cabinet' ? '4 traversées en route' : 'en partie'),
        etincelle(serieDuMode(m.cle, fm), { couleur: m.couleur, hauteur: 26 }),
      )
    }))
    if (t - dernierTirage >= 2000 && !etat.filEnPause) {
      for (let u = dernierTirage + 2000; u <= t; u += 2000) nourrirLeFil(u)
      dernierTirage = t
    }
    const visibles = FIL.filter(e => filtres === 'tout' || e.sorte === filtres).slice(0, 18)
    fil.replaceChildren(...visibles.map(e => {
      const li = h('li', { class: e.neuf ? 'neuf-arrive' : null }, h('time', null, horodatage(e.t)), h('span', { class: 'point', style: { background: e.couleur } }), h('span', { class: 'quoi' }, e.texte.map(x => (typeof x === 'string' ? x : x.cloneNode(true)))))
      e.neuf = false
      return li
    }))
  }

  const page = [
    tetePage({
      surtitre: 'Commande', neuf: true,
      titre: 'En direct',
      chapo: 'Ce qui se passe à la seconde, relu toutes les deux secondes en mémoire — ni Turso, ni la base locale : le direct ne coûte rien au quota.',
      droite: [
        h('span', { class: 'statut ok', style: { padding: '6px 10px' } }, h('span', { class: 'pouls' + (etat.filEnPause ? ' arrete' : '') }), etat.filEnPause ? 'En pause' : 'En direct'),
        h('button', { type: 'button', class: 'bouton', onClick: () => { etat.filEnPause = !etat.filEnPause; rendrePage() } }, icone(etat.filEnPause ? 'lecture' : 'pause'), etat.filEnPause ? 'Reprendre' : 'Mettre en pause'),
      ],
    }),
    h('div', { class: 'compteurs' },
      cpt('connectes', 'En ligne', 'profils vus ces 5 min, invités connectés'),
      cpt('requetes', 'Requêtes · dernière minute', 'pages, fichiers, API'),
      cpt('p95', 'Ressenti · 95ᵉ centile', 'les routes d’API, une minute'),
      cpt('erreurs', 'Erreurs serveur · 5 min', 'toutes sources confondues'),
      cpt('processeur', 'Processeur', 'sur un plafond de 10 % d’un cœur', '%'),
      cpt('memoire', 'Mémoire', 'sur les 512 Mo de l’hébergeur', 'Mo'),
      cpt('boucle', 'Boucle · pire gel', 'les dix dernières secondes'),
      cpt('turso', 'Turso · 95ᵉ centile', 'un aller-retour vers la base'),
    ),
    h('div', { class: 'grille' },
      console_({ classe: 'l-12', etiquette: 'Par mode, à l’instant', titre: 'Qui est en partie', src: 'nouveau', droite: h('span', { class: 'astuce' }, 'Les quinze dernières minutes, minute par minute'), corps: modes }),
    ),
    h('div', { class: 'grille' },
      h('div', { class: 'l-8 paire' },
        console_({ etiquette: 'Trafic', titre: 'Requêtes, dix secondes par dix secondes', src: 'nouveau', corps: graphes.requetes }),
        console_({ etiquette: 'Ressenti', titre: 'Ce qu’un joueur attend', src: 'nouveau', corps: graphes.p95 }),
        console_({ etiquette: 'Charge', titre: 'Processeur', src: 'la', corps: graphes.processeur }),
        console_({ etiquette: 'Charge', titre: 'Mémoire', src: 'la', corps: graphes.memoire }),
      ),
      console_({
        classe: 'l-4 etire', etiquette: 'Fil en direct', titre: 'Ce qui arrive', src: 'nouveau',
        droite: puces([{ cle: 'tout', nom: 'Tout' }, { cle: 'parties', nom: 'Parties' }, { cle: 'soirees', nom: 'Soirées' }, { cle: 'erreurs', nom: 'Erreurs' }], filtres, c => { etat.filtreFil = c; rendrePage() }),
        corps: [fil, h('div', { class: 'bas-de-console' }, 'Des soirées des autres, rien que des chiffres : ni quiz, ni question, ni prénom d’invité.')],
      }),
    ),
    h('div', { class: 'grille' },
      console_({
        classe: 'l-12', etiquette: 'Soirées en cours', titre: 'Les salles, à la seconde', src: 'la',
        corps: h('div', { class: 'cartes' },
          SOIREES.filter(s2 => s2.issue === 'en-cours' || s2.issue === 'en-plan').map(s2 =>
            h('div', { class: 'carte' },
              h('div', { class: 'carte-tete' }, h('b', null, `Salon de ${s2.salon}`), s2.issue === 'en-cours' ? statut('ok', 'en cours') : statut('veille', 'laissée en plan')),
              h('div', { class: 'carte-ligne' }, h('span', null, 'Question'), h('b', null, `${s2.question} sur ${s2.questions}`)),
              h('div', { class: 'progression' }, h('span', { style: { width: (s2.question / s2.questions) * 100 + '%', background: 'var(--mode-soiree)' } })),
              h('div', { class: 'carte-ligne' }, h('span', null, 'Invités'), h('b', null, `${s2.invites} · ${s2.profils} à profil`)),
              h('div', { class: 'carte-ligne' }, h('span', null, s2.issue === 'en-cours' ? 'Depuis' : 'Sans un geste depuis'), h('b', null, dureeMin((maintenant() - (s2.dernierGeste || s2.t)) / MINUTE))),
              h('div', { class: 'carte-ligne' }, h('span', null, 'Sauvegarde'), h('b', null, s2.enAttente ? `${s2.enAttente} écritures en attente` : 'à jour')),
              s2.issue === 'en-plan' ? h('button', { type: 'button', class: 'bouton', onClick: () => aller('soirees') }, 'Clore la soirée…') : null,
            ),
          ),
        ),
      }),
    ),
  ]
  requestAnimationFrame(mettreAJour)
  etat.surTic = mettreAJour
  return page
}

// ── Le serveur ────────────────────────────────────────────────────────

function zoomer(debut, fin) {
  ETAT.perso = { debut, fin, depuis: ETAT.plage }
  rendreTout()
}

function pageServeur(etat) {
  const onglet = etat.onglet || 'signaux'
  const f = fenetre(etat, 'tech')
  const tete = tetePage({
    surtitre: 'Technique',
    titre: 'Le serveur',
    chapo: `Production · en marche depuis ${dureeMin((maintenant() - Date.UTC(2026, 10, 3, 5, 55)) / MINUTE)} · version a41c9e2. ${libelleDuPas(f.pas)[0].toUpperCase() + libelleDuPas(f.pas).slice(1)} sur ${libellePlage(etat)} ; la nuit, l’hébergeur endort le serveur : ses heures sont hachurées.`,
    droite: [
      h('span', { class: 'statut neutre' }, icone('fusee'), 'a41c9e2 · mise en ligne hier à 14 h 12'),
      h('a', { class: 'bouton', href: '#serveur', onClick: e => e.preventDefault() }, 'Graphiques de Render', icone('lien')),
    ],
  })
  const tabs = onglets(
    [
      { cle: 'signaux', nom: 'Les signaux', icone: 'eclair' },
      { cle: 'routes', nom: 'Les routes', icone: 'journal', compte: ROUTES.length },
      { cle: 'temps-reel', nom: 'Le temps réel', icone: 'direct' },
      { cle: 'gels', nom: 'Ce qui gèle', icone: 'gel' },
      { cle: 'versions', nom: 'Les versions', icone: 'fusee', compte: VERSIONS.length },
    ],
    onglet,
    c => {
      etat.onglet = c
      rendrePage()
    },
  )
  const corps = { signaux: serveurSignaux, routes: serveurRoutes, 'temps-reel': serveurTempsReel, gels: serveurGels, versions: serveurVersions }[onglet](etat, f)
  return [tete, tabs, ...corps]
}

function serveurSignaux(etat, f) {
  const av = fenetreDAvant(f)
  const p95 = serie('p95', f)
  const p50 = serie('p50', f)
  const req = serie('requetes', f)
  const e5 = serie('erreurs', f)
  const cpu = serie('processeur', f)
  const mem = serie('memoire', f)
  const boucle = serie('boucle', f)
  const turso = serie('turso', f)
  const totalReq = somme(req)
  const totalReqAvant = somme(serie('requetes', av))
  const totalE5 = somme(e5)
  const p95Med = centile(p95, 0.5)
  const p95MedAvant = centile(serie('p95', av), 0.5)
  const pic = max(req) / (f.pas / HEURE)
  const lecture = h('div', { class: 'lecture' })
  const surZoom = (a, b) => zoomer(a, b)
  const petit = (titre, etiquette, opts, src = 'la') => {
    const l = h('div', { class: 'lecture' })
    return console_({ classe: 'l-6', etiquette, titre, src, lecture: l, corps: grapheTemps({ f, hauteur: 136, groupe: 'serveur', nuits: true, evenements: true, lecture: l, surZoom, margeGauche: 50, ...opts }) })
  }
  const regroupe = arr => {
    const n = Math.max(1, Math.floor(arr.length / 14))
    const r = []
    for (let i = 0; i < arr.length; i += n) r.push(moyenne(arr.slice(i, i + n)))
    return r.filter(x => x != null)
  }
  return [
    h('div', { class: 'tuiles t-4' },
      tuile({ nom: 'Latence · ce qu’un joueur attend', valeur: ms(p95Med), detail: `médiane ${ms(centile(p50, 0.5))}`, ecart: ((p95Med - p95MedAvant) / p95MedAvant) * 100, monteEstBien: false, courbe: regroupe(p95), src: 'la' }),
      tuile({ nom: 'Trafic · requêtes servies', valeur: compact(Math.round(totalReq)), ecart: ((totalReq - totalReqAvant) / totalReqAvant) * 100, detail: `au pic ${nombre(Math.round(pic))}/h`, courbe: regroupe(req), src: 'la' }),
      tuile({ nom: 'Erreurs serveur', valeur: nombre(totalE5), unite: `· ${nombre((totalE5 / Math.max(1, totalReq)) * 100, 3)} %`, detail: '2 à regarder · 0 ignorée', courbe: regroupe(e5), couleur: 'var(--critique)', src: 'la' }),
      tuile({ nom: 'Saturation · processeur', valeur: nombre(centile(cpu, 0.95), 1), unite: '% sur 10', detail: `mémoire au pire ${mo(max(mem))} sur 512`, courbe: regroupe(cpu), src: 'la' }),
    ),
    h('div', { class: 'grille' },
      console_({
        classe: 'l-12', hud: true, etiquette: 'Latence', titre: 'Ce qu’un joueur attend · les routes d’API', src: 'la', lecture,
        droite: [
          legende([{ nom: '95ᵉ centile', couleur: 'var(--or)', trait: true }, { nom: 'médiane', couleur: 'rgba(217,181,106,0.55)', trait: true }].concat(etat.comparer ? [{ nom: 'période d’avant', couleur: 'var(--encre-2)', trait: true, tirets: true }] : [])),
          etat.perso ? h('button', { type: 'button', class: 'bouton', onClick: () => { ETAT.perso = null; rendreTout() } }, icone('retour'), 'Revenir à ' + PLAGE[etat.perso.depuis || '7j'].nom) : null,
        ],
        corps: [
          grapheTemps({
            f, hauteur: 250, unite: 'ms', groupe: 'serveur', nuits: true, evenements: true, lecture, surZoom, nom: 'Temps de réponse des routes d’API',
            series: [{ nom: '95ᵉ centile', nomCourt: 'p95', nomBas: 'médiane', valeurs: p95, bas: p50, couleur: 'var(--or)', forme: 'bande' }],
            avant: etat.comparer ? [{ valeurs: serie('p95', av), couleur: 'var(--encre-2)' }] : null,
          }),
          h('div', { class: 'bas-de-console' },
            h('span', { class: 'astuce' }, icone('zoom'), 'Glisser sur un graphique pour zoomer : toute la page suit.'),
            h('span', null, '▲ mise en ligne · ✕ arrêt net · ○ redémarrage · bande rouge : incident'),
          ),
        ],
      }),
    ),
    h('div', { class: 'grille' },
      petit('Requêtes servies', 'Trafic', { nom: 'Requêtes', series: [{ nom: 'requêtes', valeurs: req, couleur: 'var(--or)', forme: 'colonnes' }] }),
      petit('Erreurs serveur (5xx)', 'Erreurs', { nom: 'Erreurs', series: [{ nom: 'erreurs', valeurs: e5, couleur: 'var(--critique)', forme: 'colonnes' }] }),
      petit('Processeur, en moyenne', 'Saturation', { nom: 'Processeur', unite: '%', plafond: { v: 10, texte: 'plafond · 10 % d’un cœur' }, series: [{ nom: 'processeur', valeurs: cpu, couleur: 'var(--or)', forme: 'aire', unite: 'pct-coeur' }] }),
      petit('Mémoire, au pire', 'Saturation', { nom: 'Mémoire', unite: 'Mo', plafond: { v: 512, texte: 'plafond · 512 Mo' }, series: [{ nom: 'mémoire', valeurs: mem, couleur: 'var(--or)', forme: 'ligne' }] }),
      petit('Gel de la boucle, au pire', 'Saturation', { nom: 'Gel de la boucle', unite: 'ms', series: [{ nom: 'pire gel', valeurs: boucle, couleur: 'var(--or)', forme: 'colonnes' }] }),
      petit('Turso · un aller-retour', 'Base', { nom: 'Turso', unite: 'ms', plafond: { v: 1000, texte: 'lent · 1 s' }, series: [{ nom: 'p95', valeurs: turso, couleur: 'var(--or)', forme: 'ligne' }] }),
    ),
    h('div', { class: 'grille' },
      console_({
        classe: 'l-12', etiquette: 'Événements de la période', titre: 'Réveils, mises en ligne, arrêts', src: 'la',
        corps: tableau({
          id: 'evenements', triInitial: 't', colonnes: [
            { cle: 't', nom: 'Quand', rendre: e => quand(e.t, maintenant()), valeur: e => e.t },
            { cle: 'sorte', nom: 'Sorte', rendre: e => h('span', { style: { display: 'inline-flex', gap: '8px', alignItems: 'center' } }, s('svg', { width: 12, height: 12, viewBox: '-6 -6 12 12' }, glyphe(FORME_D_EVENEMENT[e.sorte].forme === 'bande' ? 'croix' : FORME_D_EVENEMENT[e.sorte].forme, 0, 0, FORME_D_EVENEMENT[e.sorte].couleur)), FORME_D_EVENEMENT[e.sorte].nom) },
            { cle: 'titre', nom: 'Quoi', rendre: e => h('span', null, h('b', null, e.titre), h('span', { class: 'discret' }, ' · ' + (e.detail || ''))) },
            { cle: 'duree', nom: 'Durée', n: true, rendre: e => (e.fin ? dureeMin((e.fin - e.t) / MINUTE) : '—'), valeur: e => (e.fin ? e.fin - e.t : 0) },
          ],
          lignes: evenementsDe(f).length ? evenementsDe(f) : [],
          vide: 'Aucun événement sur cette période · les réveils de chaque matin sont comptés à part : 7 cette semaine, prêts en 3,6 à 4,4 s.',
        }),
      }),
    ),
  ]
}

function serveurRoutes(etat, f) {
  const famille = etat.familleRoute || 'toutes'
  const lentes = !!etat.seulementLentes
  const cherche = (etat.chercheRoute || '').toLowerCase()
  let lignes = tableDesRoutes(f)
  const toutes = lignes
  if (famille !== 'toutes') lignes = lignes.filter(l => l.famille === famille)
  if (lentes) lignes = lignes.filter(l => l.p95 > 300)
  if (cherche) lignes = lignes.filter(l => l.route.toLowerCase().includes(cherche))
  const champ = h('input', { id: 'cherche-route', type: 'search', placeholder: 'Filtrer une route…', value: etat.chercheRoute || '', 'aria-label': 'Filtrer une route' })
  champ.addEventListener('input', () => {
    etat.chercheRoute = champ.value
    const pos = champ.selectionStart
    rendrePage()
    const c = document.getElementById('cherche-route')
    if (c) {
      c.focus()
      c.setSelectionRange(pos, pos)
    }
  })
  const csv = () => {
    const texte = ['route;appels;p50_ms;p95_ms;max_ms;erreurs_5xx;refus_4xx;temps_s'].concat(lignes.map(l => [l.route, l.appels, Math.round(l.p50), Math.round(l.p95), Math.round(l.max), l.e5, l.e4, Math.round(l.temps)].join(';'))).join('\n')
    navigator.clipboard?.writeText(texte).then(() => notifier('Tableau copié en CSV : collez-le dans un tableur.'), () => notifier('La copie a été refusée par le navigateur.'))
  }
  return [
    h('div', { class: 'barre-outils' },
      h('label', { class: 'champ' }, icone('chercher'), champ),
      puces([{ cle: 'toutes', nom: 'Toutes', compte: toutes.length }].concat(FAMILLES.map(x => ({ cle: x.cle, nom: x.nom, compte: toutes.filter(l => l.famille === x.cle).length }))), famille, c => { etat.familleRoute = c; rendrePage() }),
      h('button', { type: 'button', class: 'bascule', 'aria-pressed': String(lentes), onClick: () => { etat.seulementLentes = !lentes; rendrePage() } }, h('span', { class: 'interrupteur' }), 'Au-delà de 300 ms'),
      h('button', { type: 'button', class: 'bouton', style: { marginLeft: 'auto' }, onClick: csv }, icone('exporter'), 'Copier en CSV'),
    ),
    tableau({
      id: 'routes', triInitial: 'temps',
      surLigne: l => ouvrirLaRoute(l, f),
      colonnes: [
        { cle: 'route', nom: 'Route', classe: 'route', rendre: l => h('span', null, verbeDe(l.route), l.regression ? h('span', { class: 'statut veille', style: { marginLeft: '8px' } }, 'depuis a41c9e2') : null) },
        { cle: 'appels', nom: 'Appels', n: true, rendre: l => nombre(l.appels) },
        { cle: 'parHeure', nom: '/h éveillé', n: true, rendre: l => nombre(l.parHeure, l.parHeure < 10 ? 1 : 0) },
        { cle: 'p50', nom: 'Médiane', n: true, rendre: l => ms(l.p50) },
        { cle: 'p95', nom: 'p95', n: true, rendre: l => h('b', { style: { color: l.p95 > 500 ? 'var(--critique-texte)' : l.p95 > 300 ? '#ffd166' : 'var(--encre)' } }, ms(l.p95)) },
        { cle: 'max', nom: 'Pire', n: true, rendre: l => ms(l.max) },
        { cle: 'e5', nom: '5xx', n: true, rendre: l => (l.e5 ? h('b', { style: { color: 'var(--critique-texte)' } }, nombre(l.e5)) : h('span', { class: 'discret' }, '0')) },
        { cle: 'e4', nom: '4xx', n: true, rendre: l => nombre(l.e4) },
        { cle: 'temps', nom: 'Temps serveur', n: true, rendre: l => part(l.part) },
        { cle: 'ecart', nom: 'p95 vs avant', n: true, rendre: l => ecartTexte(l.ecart) },
        { cle: 'tendance', nom: 'Tendance', tri: false, rendre: l => miniCourbe(l.tendance, 'var(--or)', !!l.regression) },
      ],
      lignes,
      vide: 'Aucune route ne correspond.',
    }),
    h('div', { class: 'tableau-pied' },
      h('span', null, `${lignes.length} routes sur ${libellePlage(etat)} · sous leur modèle, jamais leur adresse · triées par le temps serveur qu’elles prennent : leurs appels fois leur temps.`),
      source('nouveau'),
    ),
  ]
}

function ouvrirLaRoute(l, f) {
  const fl = { ...f }
  const p95 = serie('p95', fl).map((v, i) => (v == null ? null : v * (l.p95 / 230) * (l.regression && fl.t[i] > VERSION_COURANTE.t ? 1 : l.regression ? 1 / l.regression : 1)))
  const p50 = p95.map(v => (v == null ? null : v * 0.36))
  const appels = serie('requetes', fl).map(v => (v == null ? null : v * 0.68 * ROUTES.find(r => r.r === l.route).part))
  const lecture = h('div', { class: 'lecture' })
  const statuts = [
    { nom: '2xx', n: l.appels - l.e4 - l.e5, couleur: 'var(--bon)' },
    { nom: '4xx', n: l.e4, couleur: 'var(--veille)' },
    { nom: '5xx', n: l.e5, couleur: 'var(--critique)' },
  ]
  const total = somme(statuts.map(x => x.n)) || 1
  ouvrirTiroir({
    tete: [h('div', { class: 'surtitre' }, 'Route · ' + FAMILLES.find(x => x.cle === l.famille).nom), h('h2', { class: 'route' }, verbeDe(l.route))],
    corps: [
      h('div', { class: 'tuiles t-4' },
        tuile({ nom: 'Appels', valeur: compact(l.appels) }),
        tuile({ nom: 'p95', valeur: ms(l.p95), ecart: l.ecart, monteEstBien: false }),
        tuile({ nom: 'Pire', valeur: ms(l.max) }),
        tuile({ nom: 'Erreurs', valeur: nombre(l.e5), detail: `${nombre(l.tauxErreur, 3)} % des appels` }),
      ),
      h('section', null, h('h4', null, 'Son temps, sur la période'), lecture, grapheTemps({ f: fl, hauteur: 170, unite: 'ms', nuits: true, evenements: true, lecture, series: [{ nom: '95ᵉ centile', nomCourt: 'p95', valeurs: p95, bas: p50, couleur: 'var(--or)', forme: 'bande' }] })),
      h('section', null, h('h4', null, 'Ses appels'), grapheTemps({ f: fl, hauteur: 100, nuits: true, series: [{ nom: 'appels', valeurs: appels, couleur: 'var(--or)', forme: 'colonnes' }] })),
      h('section', null, h('h4', null, 'Ses réponses, par statut'),
        h('div', { class: 'segments', role: 'img', 'aria-label': statuts.map(x => `${x.nom} ${x.n}`).join(', ') },
          statuts.filter(x => x.n > 0).map(x => h('span', { style: { flex: String(Math.max(x.n / total, 0.03)), background: x.couleur }, class: x.nom === '2xx' || x.nom === '5xx' ? 'clair' : '' }, x.n / total > 0.08 ? `${x.nom} · ${pct((x.n / total) * 100, 1)}` : '')),
        ),
        legende(statuts.map(x => ({ nom: `${x.nom} · ${nombre(x.n)}`, couleur: x.couleur }))),
      ),
      h('section', null, h('h4', null, 'Par version'),
        tableau({
          id: 'route-versions-' + l.route, triInitial: 'quand',
          colonnes: [
            { cle: 'version', nom: 'Version', rendre: v => h('span', { class: 'mono' }, v.version) },
            { cle: 'quand', nom: 'En ligne depuis', rendre: v => quand(v.t, maintenant()), valeur: v => v.t },
            { cle: 'p95', nom: 'p95', n: true, rendre: v => ms(v.p95) },
            { cle: 'ecart', nom: 'vs la précédente', n: true, rendre: v => ecartTexte(v.ecart) },
          ],
          lignes: VERSIONS.map((v, i) => {
            const base = ROUTES.find(r => r.r === l.route).p95
            const p = base * (1 + 0.05 * bruit('rv', i)) * (l.regression && i === VERSIONS.length - 1 ? l.regression : 1)
            const pAvant = base * (1 + 0.05 * bruit('rv', i - 1))
            return { ...v, p95: p, ecart: i ? ((p - pAvant) / pAvant) * 100 : null }
          }),
        }),
      ),
      l.e5
        ? h('section', null, h('h4', null, 'Ses erreurs'),
            h('div', { class: 'console creuse' },
              h('b', null, 'TypeError · Cannot read properties of undefined (reading ‘or’)'),
              h('div', { class: 'discret mono', style: { fontSize: '12px', marginTop: '6px' } }, 'CabinetStore.gesteDeTraversee · server/src/core/cabinet/magasin.ts'),
              h('div', { class: 'discret', style: { marginTop: '6px', fontSize: '12.5px' } }, `${l.e5} fois · la dernière ${quand(T0 - 38 * MINUTE, maintenant())} · seulement sous a41c9e2`),
              h('div', { style: { marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' } }, h('button', { type: 'button', class: 'bouton', onClick: () => aller('erreurs') }, 'Ouvrir dans les erreurs'), h('button', { type: 'button', class: 'bouton' }, 'Copier le détail')),
            ))
        : null,
    ],
  }, l.route)
}

function serveurTempsReel(etat, f) {
  const connectes = serie('sockets', f)
  const messages = f.t.map((t, i) => (connectes[i] == null ? null : connectes[i] * (f.pas / MINUTE) * 1.9 * (1 + 0.15 * bruit('msg', i))))
  const lecture = h('div', { class: 'lecture' })
  const l2 = h('div', { class: 'lecture' })
  const total = somme(messages)
  return [
    h('div', { class: 'tuiles' },
      tuile({ nom: 'Connectés · au pire', valeur: nombre(Math.round(max(connectes))), detail: 'téléphones et écrans', src: 'la' }),
      tuile({ nom: 'Messages reçus', valeur: compact(Math.round(total)), detail: 'des clients du temps réel', src: 'nouveau' }),
      tuile({ nom: 'Traitement · p95', valeur: ms(9), detail: 'de l’arrivée à l’accusé', src: 'nouveau' }),
      tuile({ nom: '« Trop tard »', valeur: nombre(14), detail: 'réponses refusées, toutes à raison', src: 'la' }),
      tuile({ nom: 'Chronomètres · retard p95', valeur: ms(46), detail: 'après leur échéance', src: 'la' }),
      tuile({ nom: 'Reconnexions', valeur: nombre(31), detail: 'liaisons tombées puis revenues', src: 'nouveau' }),
    ),
    h('div', { class: 'grille' },
      console_({ classe: 'l-6', etiquette: 'Connectés', titre: 'Téléphones et écrans ouverts', lecture, src: 'la', corps: grapheTemps({ f, hauteur: 180, nuits: true, evenements: true, lecture, groupe: 'tr', series: [{ nom: 'connectés', valeurs: connectes, couleur: 'var(--or)', forme: 'aire' }], surZoom: zoomer }) }),
      console_({ classe: 'l-6', etiquette: 'Messages', titre: 'Ce que les clients envoient', lecture: l2, src: 'nouveau', corps: grapheTemps({ f, hauteur: 180, nuits: true, lecture: l2, groupe: 'tr', series: [{ nom: 'messages', valeurs: messages, couleur: 'var(--or)', forme: 'colonnes' }], surZoom: zoomer }) }),
    ),
    h('div', { class: 'grille' },
      console_({
        classe: 'l-12', etiquette: 'Par message', titre: 'Chaque message du temps réel, passé par ecouter()', src: 'nouveau',
        corps: tableau({
          id: 'sockets', triInitial: 'n',
          colonnes: [
            { cle: 'e', nom: 'Message', classe: 'route', rendre: x => h('span', null, h('span', { class: 'verbe ws' }, 'WS'), x.e) },
            { cle: 'nom', nom: 'Ce que c’est', rendre: x => h('span', { class: 'second' }, x.nom) },
            { cle: 'n', nom: 'Reçus', n: true, rendre: x => nombre(x.n) },
            { cle: 'p95', nom: 'Traitement p95', n: true, rendre: x => ms(x.p95) },
            { cle: 'refus', nom: 'Refusés', n: true, rendre: x => nombre(x.refus) },
            { cle: 'echecs', nom: 'En échec', n: true, rendre: x => (x.echecs ? h('b', { style: { color: 'var(--critique-texte)' } }, nombre(x.echecs)) : h('span', { class: 'discret' }, '0')) },
          ],
          lignes: EVENEMENTS_TEMPS_REEL.map((x, i) => ({ ...x, n: Math.round(total * x.part), refus: x.e === 'player:action' ? 14 : x.e === 'player:join' ? 3 : 0, echecs: x.e === 'host:closeParty' ? 1 : 0 })),
        }),
      }),
    ),
  ]
}

function serveurGels(etat, f) {
  const boucle = serie('boucle', f)
  const lecture = h('div', { class: 'lecture' })
  const ceQuiGele = [
    { quoi: 'soirée · rangement après le quiz', n: 12, ms: 21400, plusLong: 2900 },
    { quoi: 'fond · modèle du savoir', n: 5, ms: 7100, plusLong: 1900 },
    { quoi: 'POST /api/campagne/serie/:id/reponse', n: 4, ms: 3900, plusLong: 1300 },
    { quoi: 'fond · sujets et tirages', n: 3, ms: 2200, plusLong: 900 },
    { quoi: 'socket player:action', n: 3, ms: 1900, plusLong: 720 },
    { quoi: 'GET /api/admin/qg', n: 2, ms: 1400, plusLong: 760 },
    { quoi: 'sans rien de nommé', n: 6, ms: 3600, plusLong: 840 },
  ]
  const totalMs = somme(ceQuiGele.map(x => x.ms))
  return [
    h('div', { class: 'tuiles t-4' },
      tuile({ nom: 'Gels de plus d’une demi-seconde', valeur: nombre(35), detail: 'sur la période', src: 'la' }),
      tuile({ nom: 'Gelé en tout', valeur: ms(totalMs), detail: 'la boucle n’a rien servi', src: 'la' }),
      tuile({ nom: 'Le plus long', valeur: ms(4800), detail: 'hier à 22 h 51 · avant l’arrêt net', src: 'la' }),
      tuile({ nom: 'Sans rien de nommé', valeur: pct(17), detail: 'le ramasse-miettes, le plus souvent', src: 'la' }),
    ),
    h('div', { class: 'grille' },
      console_({ classe: 'l-12', etiquette: 'Gel de la boucle', titre: 'Le pire gel de chaque seau', lecture, src: 'la', corps: grapheTemps({ f, hauteur: 190, unite: 'ms', nuits: true, evenements: true, lecture, plafond: { v: 500, texte: 'un gel · 0,5 s' }, series: [{ nom: 'pire gel', valeurs: boucle, couleur: 'var(--or)', forme: 'colonnes' }], surZoom: zoomer }) }),
    ),
    h('div', { class: 'grille' },
      console_({
        classe: 'l-7', etiquette: 'Ce qui tournait', titre: 'Ce qui a couvert le plus de gel', src: 'la',
        corps: tableau({
          id: 'gels', triInitial: 'ms',
          colonnes: [
            { cle: 'quoi', nom: 'Ce qui tournait', classe: 'route' },
            { cle: 'n', nom: 'Gels', n: true },
            { cle: 'ms', nom: 'Durée cumulée', n: true, rendre: x => part(x.ms / totalMs) },
            { cle: 'plusLong', nom: 'Le plus long', n: true, rendre: x => ms(x.plusLong) },
          ],
          lignes: ceQuiGele,
        }),
      }),
      console_({
        classe: 'l-5', etiquette: 'Les plus longs', titre: 'Chacun, ce qu’il a pris', src: 'la',
        corps: h('ul', { class: 'fil' },
          [
            [Date.UTC(2026, 10, 2, 21, 51), 4800, 'processeur 3,1 s · ramasse-miettes 410 ms', 'POST /api/campagne/serie/:id/reponse ×3, fond · modèle du savoir'],
            [T0 - 1 * HEURE - 24 * MINUTE, 2900, 'processeur 287 ms · ramasse-miettes 120 ms', 'soirée · rangement après le quiz, chrono question, socket player:action ×9'],
            [T0 - 2 * HEURE - 24 * MINUTE, 2700, 'processeur 270 ms · ramasse-miettes 96 ms', 'soirée · rangement après le quiz, socket player:action ×10'],
            [T0 - 15 * HEURE - 44 * MINUTE, 1900, 'processeur 1,7 s · ramasse-miettes 60 ms', 'fond · modèle du savoir (au réveil)'],
          ].map(([t, d, cpu, quoi]) => h('li', null, h('time', null, ms(d)), h('span', { class: 'point', style: { background: d > 3000 ? 'var(--critique)' : 'var(--veille)' } }), h('span', { class: 'quoi' }, h('b', null, quand(t, maintenant())), h('br'), h('span', { class: 'discret' }, cpu), h('br'), h('span', { class: 'mono' }, quoi)))),
        ),
      }),
    ),
  ]
}

function serveurVersions(etat, f) {
  const comparees = VERSIONS.map((v, i) => {
    const p95 = [228, 236, 231, 249][i]
    const e = [0.21, 0.18, 0.2, 0.46][i]
    const cpu = [4.3, 4.6, 4.4, 4.5][i]
    const memo = [318, 331, 324, 486][i]
    return { ...v, p95, erreurs: e, cpu, memo, i }
  })
  return [
    h('p', { class: 'chapo', style: { marginTop: '-6px', marginBottom: '16px' } }, 'Chaque mise en ligne comparée à celle d’avant, sur ses heures éveillées : ce qu’elle a fait au ressenti, aux erreurs et à la charge. Une route qui ralentit de plus d’un tiers se signale d’elle-même.'),
    h('div', { class: 'grille' },
      comparees.slice().reverse().map(v => {
        const avant = comparees[v.i - 1]
        const ecart = (a, b) => (b == null ? null : ((a - b) / b) * 100)
        const regressee = v.version === 'a41c9e2'
        return console_({
          classe: 'l-6', hud: regressee, etiquette: v.version === VERSION_COURANTE.version ? 'En ligne' : 'Remplacée',
          titre: h('span', { class: 'mono' }, v.version), sous: `${v.titre} · mise en ligne ${quand(v.t, maintenant())} · prête en ${ms(v.pretMs)}`,
          droite: regressee ? statut('veille', '1 route plus lente') : statut('ok', 'rien à signaler'), src: 'derive',
          corps: [
            h('div', { class: 'tuiles t-4' },
              tuile({ nom: 'Ressenti · p95', valeur: ms(v.p95), ecart: ecart(v.p95, avant?.p95), monteEstBien: false, contre: 'vs la précédente' }),
              tuile({ nom: 'Erreurs / 1 000 req.', valeur: nombre(v.erreurs, 2), ecart: ecart(v.erreurs, avant?.erreurs), monteEstBien: false, contre: 'vs la précédente' }),
              tuile({ nom: 'Processeur', valeur: nombre(v.cpu, 1), unite: '%', ecart: ecart(v.cpu, avant?.cpu), monteEstBien: false, contre: 'vs la précédente' }),
              tuile({ nom: 'Mémoire au pire', valeur: nombre(v.memo), unite: 'Mo', ecart: ecart(v.memo, avant?.memo), monteEstBien: false, contre: 'vs la précédente' }),
            ),
            regressee
              ? h('div', { class: 'bas-de-console' },
                  h('span', null, h('b', { style: { color: '#ffd166' } }, 'Plus lente depuis a41c9e2 : '), h('span', { class: 'mono' }, 'POST /api/cabinet/traversee/:id/geste'), ' · p95 312 → 524 ms (+68 %) · 2 erreurs. La mémoire au pire vient de l’arrêt net d’hier soir.'),
                )
              : null,
          ],
        })
      }),
    ),
  ]
}

// ── La base et le miroir ──────────────────────────────────────────────

function pageBase(etat) {
  const f = fenetre(etat, 'tech')
  const turso = serie('turso', f)
  const lues = f.t.map((t, i) => {
    const r = METRIQUES.requetes.seau(t, f.pas)
    if (f.pas <= HEURE && endormi(t + f.pas / 2)) return null
    let v = r * 9.2
    if (f.pas <= HEURE && apresReveil(t)) v += 600000 * (f.pas / HEURE)
    if (f.pas >= JOUR) v += 600000
    return v
  })
  const lecture = h('div', { class: 'lecture' })
  const l2 = h('div', { class: 'lecture' })
  const neuves = f.t.map((t, i) => (turso[i] == null ? null : borner(4 + 3 * bruit('neuves', i) + (apresReveil(t) ? 40 : 0), 0, 100)))
  return [
    tetePage({ surtitre: 'Technique', titre: 'La base et le miroir', chapo: 'Turso — ce qu’un aller-retour coûte, ce que le serveur lit au quota du mois —, le miroir qui recopie chaque soirée, et les sauvegardes. La production, la préproduction et les sauvegardes lisent au même quota.', neuf: true }),
    h('div', { class: 'tuiles' },
      tuile({ nom: 'Turso · 95ᵉ centile', valeur: ms(centile(turso, 0.5)), detail: 'un aller-retour', courbe: turso.filter(x => x != null).slice(-24), src: 'la' }),
      tuile({ nom: 'Connexions neuves', valeur: pct(4), detail: 'gardées chaudes : 40 battements/h', src: 'la' }),
      tuile({ nom: 'Lignes lues', valeur: compact(somme(lues)), detail: 'sur la période', courbe: lues.filter(x => x != null).slice(-24), src: 'la' }),
      tuile({ nom: 'Lignes écrites', valeur: compact(somme(lues) * 0.006), detail: 'sur la période', src: 'la' }),
      tuile({ nom: 'File du miroir', valeur: '3', detail: 'écritures en attente · 0 échec', src: 'la' }),
      tuile({ nom: 'Dernière sauvegarde', valeur: '12 j', detail: 'npm run sauvegarde · à la main', src: 'nouveau' }),
    ),
    h('div', { class: 'grille' },
      console_({ classe: 'l-8 etire', etiquette: 'Quota', titre: 'Lignes lues par Turso', lecture, src: 'la', corps: [grapheTemps({ f, hauteur: 230, nuits: true, evenements: true, lecture, nom: 'Lignes lues', series: [{ nom: 'lignes lues', valeurs: lues, couleur: 'var(--or)', forme: 'colonnes' }], surZoom: zoomer }), h('div', { class: 'bas-de-console' }, 'Chaque réveil relit d’un coup le journal des réponses : la première heure du matin pèse autant qu’une soirée.')] }),
      console_({
        classe: 'l-4 etire', etiquette: 'Le mois', titre: 'Le quota, au rythme de la semaine', src: 'la',
        corps: [
          h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' } },
            jauge(0.32, { libelle: '32 %', sous: 'lues · 500 M', couleur: 'var(--or)' }),
            jauge(0.09, { libelle: '9 %', sous: 'écrites · 10 M', couleur: 'var(--or)' }),
          ),
          h('div', { class: 'barres', style: { marginTop: '10px' } },
            [['Ce serveur', 32, 'var(--or)'], ['La préproduction', 6, 'var(--encre-2)'], ['Les sauvegardes', 2, 'var(--encre-3)']].map(([n, v, c]) => h('div', { class: 'barre' }, h('span', { class: 'nom' }, n), h('span', { class: 'piste' }, h('span', { class: 'plein', style: { width: v * 2 + '%', background: c, display: 'block' } })), h('span', { class: 'val' }, pct(v)))),
          ),
          h('div', { class: 'bas-de-console' }, 'L’alerte s’allume à 50 %, rouge à 80 %. Le QG lui-même : 1,4 % de ce qui est lu.'),
        ],
      }),
    ),
    h('div', { class: 'grille' },
      console_({
        classe: 'l-8', etiquette: 'Ce qui lit le plus', titre: 'Les requêtes qui ont lu cent lignes ou plus d’un coup', src: 'la',
        corps: tableau({
          id: 'lectures', triInitial: 'part',
          colonnes: [
            { cle: 'q', nom: 'Requête, sans ses valeurs', classe: 'route', rendre: x => h('span', { style: { whiteSpace: 'normal' } }, x.q) },
            { cle: 'f', nom: 'Qui la lance' },
            { cle: 'appels', nom: 'Appels', n: true, rendre: x => compact(x.appels) },
            { cle: 'part', nom: 'Part du lu', n: true, rendre: x => part(x.part / 100) },
          ],
          lignes: LECTURES,
        }),
      }),
      console_({ classe: 'l-4', etiquette: 'Connexions', titre: 'La part des allers-retours qui ont rouvert leur connexion', lecture: l2, src: 'la', corps: grapheTemps({ f, hauteur: 150, unite: '%', nuits: true, lecture: l2, series: [{ nom: 'neuves', valeurs: neuves, couleur: 'var(--or)', forme: 'colonnes' }] }) }),
    ),
    h('div', { class: 'grille' },
      console_({
        classe: 'l-6', etiquette: 'Le miroir', titre: 'Chaque espace, sa file', src: 'la',
        corps: tableau({
          id: 'miroir', triInitial: 'attente',
          colonnes: [
            { cle: 'salon', nom: 'Salon', rendre: x => `Salon de ${x.salon}` },
            { cle: 'attente', nom: 'En attente', n: true },
            { cle: 'echecs', nom: 'Échecs 7 j', n: true },
            { cle: 'dernier', nom: 'Dernier envoi', rendre: x => ilYA(x.dernier, maintenant()), valeur: x => -x.dernier },
          ],
          lignes: [
            { salon: 'Karim', attente: 3, echecs: 0, dernier: T0 - 2000 },
            { salon: 'Hugo', attente: 0, echecs: 0, dernier: T0 - 7 * HEURE },
            { salon: 'Nadia', attente: 0, echecs: 1, dernier: T0 - 3 * JOUR },
            { salon: 'Léa', attente: 0, echecs: 0, dernier: T0 - 4 * JOUR },
          ],
        }),
      }),
      console_({
        classe: 'l-6', etiquette: 'Les sauvegardes', titre: 'La base permanente, en SQL daté', src: 'nouveau',
        corps: [
          h('div', { class: 'voyants' },
            h('div', { class: 'voyant-bloc' }, h('span', { class: 'voyant veille' }), h('b', null, 'La dernière, il y a 12 jours'), h('small', null, '22 oct. · 41 Mo · export/sauvegardes/')),
            h('div', { class: 'voyant-bloc' }, h('span', { class: 'voyant eteint' }), h('b', null, 'Aucune programmée'), h('small', null, 'npm run sauvegarde se lance à la main')),
          ),
          h('div', { class: 'bas-de-console' }, 'Proposé : la commande écrit une ligne au QG à chaque sauvegarde, et une alerte s’allume au-delà de sept jours.'),
        ],
      }),
    ),
  ]
}

// ── Les erreurs ───────────────────────────────────────────────────────

const ERREURS = [
  { cle: 'e1', source: 'POST /api/cabinet/traversee/:id/geste', nom: 'TypeError', message: 'Cannot read properties of undefined (reading ‘or’)', ou: 'CabinetStore.gesteDeTraversee · server/src/core/cabinet/magasin.ts', n: 2, derniere: T0 - 38 * MINUTE, versions: ['a41c9e2'], tri: 'regarder' },
  { cle: 'e2', source: 'hors route', nom: 'RangeError', message: 'Invalid array length', ou: 'enTranches · shared/qg.ts', n: 1, derniere: Date.UTC(2026, 10, 2, 21, 58), versions: ['a41c9e2'], tri: 'regarder', note: '' },
  { cle: 'e3', source: 'POST /api/campagne/serie/:id/reponse', nom: 'LibsqlError', code: 'SQLITE_BUSY', message: 'database is locked', ou: 'CampagneStore.repondre · server/src/core/campagne.ts', n: 9, derniere: Date.UTC(2026, 10, 2, 21, 49), versions: ['a41c9e2', 'e2b7d44'], tri: 'regler', note: 'Arrêt net : la base locale saturée' },
  { cle: 'e4', source: 'socket player:action', nom: 'Error', message: 'Réponse sans question', ou: 'ecouter · server/src/sockets.ts', n: 3, derniere: T0 - 2 * JOUR, versions: ['e2b7d44'], tri: 'ignorer', note: 'Un vieux téléphone qui rejoue' },
  { cle: 'e5', source: 'GET /api/jour', nom: 'FetchError', code: 'ECONNRESET', message: 'Turso a fermé la connexion sous la requête', ou: 'avecDelai · server/src/core/distante.ts', n: 6, derniere: Date.UTC(2026, 9, 29, 19, 3), versions: ['7d03b18'], tri: 'regle', note: 'Le soir où Turso était lent' },
]
function pageErreurs(etat) {
  const ong = etat.onglet || 'regarder'
  const liste = ERREURS.filter(e => (ong === 'regarder' ? e.tri === 'regarder' : ong === 'reglees' ? e.tri === 'regle' || e.tri === 'regler' : e.tri === 'ignorer'))
  const f = fenetre(etat, 'tech')
  const e5 = serie('erreurs', f)
  const lecture = h('div', { class: 'lecture' })
  return [
    tetePage({ surtitre: 'Technique', titre: 'Les erreurs', chapo: 'Les mêmes erreurs fondues, triées à la main : à regarder, réglées, ignorées. Une erreur réglée revient d’elle-même sous une version qui ne l’avait pas vue.' }),
    h('div', { class: 'grille' },
      console_({ classe: 'l-12', etiquette: 'Sur la période', titre: 'Erreurs serveur, par seau', lecture, src: 'la', corps: grapheTemps({ f, hauteur: 130, nuits: true, evenements: true, lecture, series: [{ nom: 'erreurs', valeurs: e5, couleur: 'var(--critique)', forme: 'colonnes' }], surZoom: zoomer }) }),
    ),
    onglets([{ cle: 'regarder', nom: 'À regarder', compte: 2 }, { cle: 'reglees', nom: 'Réglées', compte: 2 }, { cle: 'ignorees', nom: 'Ignorées', compte: 1 }], ong, c => { etat.onglet = c; rendrePage() }),
    tableau({
      id: 'erreurs-' + ong, triInitial: 'derniere',
      surLigne: e => ouvrirTiroir({
        tete: [h('div', { class: 'surtitre' }, e.source), h('h2', null, `${e.nom}${e.code ? ' · ' + e.code : ''}`)],
        corps: [
          h('p', { class: 'mono', style: { fontSize: '13px', whiteSpace: 'normal' } }, e.message),
          h('div', { class: 'tuiles t-3' }, tuile({ nom: 'Fois', valeur: nombre(e.n) }), tuile({ nom: 'La dernière', valeur: ilYA(e.derniere, maintenant()).replace('il y a ', '') }), tuile({ nom: 'Versions', valeur: String(e.versions.length), detail: e.versions.join(' · ') })),
          h('section', null, h('h4', null, 'D’où elle vient'), h('div', { class: 'console creuse mono', style: { fontSize: '12px', whiteSpace: 'pre-wrap' } }, `${e.ou}\nrouterDuCabinet · server/src/cabinet.ts\nnode_modules/express`)),
          h('section', null, h('h4', null, 'Un mot'), h('div', { class: 'champ', style: { flexBasis: 'auto' } }, h('input', { id: 'note-erreur', placeholder: 'Ce qu’on en sait, ce qu’on a fait', value: e.note || '' }))),
          h('section', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, h('button', { type: 'button', class: 'bouton or' }, icone('ok'), 'Réglée'), h('button', { type: 'button', class: 'bouton' }, 'Ignorer : sans gravité'), h('button', { type: 'button', class: 'bouton' }, 'Copier le détail')),
        ],
      }, e.nom),
      colonnes: [
        { cle: 'nom', nom: 'Sorte', rendre: e => h('b', null, e.nom + (e.code ? ' · ' + e.code : '')) },
        { cle: 'message', nom: 'Message', classe: 'texte', rendre: e => h('span', { class: 'second' }, e.message) },
        { cle: 'source', nom: 'Source', classe: 'route', rendre: e => (e.source.includes(' /') ? verbeDe(e.source) : e.source) },
        { cle: 'n', nom: 'Fois', n: true },
        { cle: 'derniere', nom: 'La dernière', n: true, rendre: e => quand(e.derniere, maintenant()) },
        { cle: 'versions', nom: 'Versions', rendre: e => h('span', { class: 'mono' }, e.versions.join(' · ')), valeur: e => e.versions.length },
      ],
      lignes: liste,
    }),
  ]
}

// ── Les alertes et les incidents ──────────────────────────────────────

const REGLES = [
  { nom: 'Un mode de jeu en panne', seuil: '3 échecs en 10 min', fenetre: 'tant que dure la panne', gravite: 'critique', qg: true, tel: true, etat: 'ok', derniere: Date.UTC(2026, 9, 19, 16, 32), existe: true },
  { nom: 'Arrêt net', seuil: 'un démarrage sans extinction', fenetre: '24 h', gravite: 'critique', qg: true, tel: false, etat: 'ouverte', derniere: Date.UTC(2026, 10, 2, 22, 2), existe: true },
  { nom: 'Erreurs serveur à regarder', seuil: '≥ 1 depuis l’heure d’avant', fenetre: '1 h', gravite: 'serieux', qg: true, tel: false, etat: 'ouverte', derniere: T0 - 38 * MINUTE, existe: true },
  { nom: 'Turso lent', seuil: 'p95 > 1 s · 20 allers-retours', fenetre: '1 h', gravite: 'veille', qg: true, tel: false, etat: 'ok', derniere: Date.UTC(2026, 9, 29, 18, 40), existe: true },
  { nom: 'Mémoire haute', seuil: '> 450 Mo', fenetre: 'à l’instant', gravite: 'serieux', qg: true, tel: false, etat: 'ok', derniere: Date.UTC(2026, 10, 2, 21, 40), existe: true },
  { nom: 'Quota de Turso', seuil: '> 50 % du mois, rouge à 80 %', fenetre: '7 j', gravite: 'veille', qg: true, tel: false, etat: 'ok', derniere: null, existe: true },
  { nom: 'Ressenti dégradé', seuil: 'p95 des routes > 800 ms', fenetre: '10 min', gravite: 'veille', qg: true, tel: false, etat: 'ok', derniere: Date.UTC(2026, 10, 2, 21, 52) },
  { nom: 'Taux d’erreur', seuil: '> 1 % des requêtes', fenetre: '15 min', gravite: 'serieux', qg: true, tel: true, etat: 'ok', derniere: Date.UTC(2026, 9, 29, 18, 50) },
  { nom: 'Gel long', seuil: 'un gel > 3 s', fenetre: 'à l’instant', gravite: 'veille', qg: true, tel: false, etat: 'ok', derniere: Date.UTC(2026, 10, 2, 21, 51) },
  { nom: 'Miroir en retard', seuil: '> 50 écritures ou 5 min sans succès', fenetre: 'à l’instant', gravite: 'critique', qg: true, tel: true, etat: 'ok', derniere: null },
  { nom: 'Réserve du quiz du jour', seuil: '< 3 jours d’avance', fenetre: 'chaque matin', gravite: 'veille', qg: true, tel: false, etat: 'ok', derniere: Date.UTC(2026, 9, 12, 6, 0) },
  { nom: 'Silence anormal', seuil: 'aucune partie de 19 h à 22 h', fenetre: 'chaque soir', gravite: 'veille', qg: true, tel: false, etat: 'ok', derniere: null },
  { nom: 'Rappel du soir en échec', seuil: '> 10 % d’envois échoués', fenetre: 'chaque tournée', gravite: 'veille', qg: true, tel: false, etat: 'ok', derniere: null },
  { nom: 'Version qui ralentit', seuil: 'une route + 33 % après une mise en ligne', fenetre: '6 h', gravite: 'veille', qg: true, tel: false, etat: 'ouverte', derniere: T0 - 5 * HEURE },
]
const INCIDENTS = [
  { regle: 'Un mode de jeu en panne', debut: Date.UTC(2026, 9, 19, 16, 32), fin: Date.UTC(2026, 9, 19, 18, 50), gravite: 'critique', cause: 'Le quiz du jour et les défis ne s’ouvraient plus · réparé par 3b8f1c2' },
  { regle: 'Turso lent', debut: Date.UTC(2026, 9, 29, 18, 40), fin: Date.UTC(2026, 9, 29, 19, 22), gravite: 'veille', cause: 'Turso au-delà d’une seconde · rien à faire de notre côté' },
  { regle: 'Taux d’erreur', debut: Date.UTC(2026, 9, 29, 18, 50), fin: Date.UTC(2026, 9, 29, 19, 15), gravite: 'serieux', cause: 'ECONNRESET sous Turso lent' },
  { regle: 'Mémoire haute', debut: Date.UTC(2026, 10, 2, 21, 40), fin: Date.UTC(2026, 10, 2, 22, 2), gravite: 'serieux', cause: 'La mémoire montait depuis 21 h' },
  { regle: 'Arrêt net', debut: Date.UTC(2026, 10, 2, 22, 2), fin: Date.UTC(2026, 10, 2, 22, 4), gravite: 'critique', cause: 'Redémarré en 2 min · 0 soirée perdue' },
  { regle: 'Version qui ralentit', debut: T0 - 5 * HEURE, fin: null, gravite: 'veille', cause: 'POST /api/cabinet/traversee/:id/geste + 68 % depuis a41c9e2' },
  { regle: 'Erreurs serveur à regarder', debut: T0 - 38 * MINUTE, fin: null, gravite: 'serieux', cause: '2 TypeError au Cabinet' },
]

function pageAlertes(etat) {
  const ouvertes = REGLES.filter(r => r.etat === 'ouverte').length
  const frise = h('div', { class: 'graphe' })
  monter(frise, largeur => {
    const debut = minuit(T0) - 20 * JOUR
    const fin = maintenant()
    const lignes = [...new Set(INCIDENTS.map(i => i.regle))]
    const ln = Math.min(190, largeur * 0.32)
    const L = largeur - ln - 10
    const H = lignes.length * 30 + 26
    const X = t => ln + ((t - debut) / (fin - debut)) * L
    const svg = s('svg', { width: largeur, height: H, viewBox: `0 0 ${largeur} ${H}` })
    const axe = s('g', { class: 'axe' })
    for (let t = minuit(debut + 26 * HEURE); t < fin; t = minuit(t + 26 * HEURE * 2)) {
      if (paris(t).sem !== 1 && L < 600) continue
      axe.append(s('text', { x: X(t), y: H - 6, 'text-anchor': 'middle' }, dateCourte(t)))
      svg.append(s('line', { x1: Math.round(X(t)) + 0.5, x2: Math.round(X(t)) + 0.5, y1: 0, y2: H - 20, stroke: 'rgba(148,166,196,0.07)' }))
    }
    lignes.forEach((r, k) => {
      axe.append(s('text', { x: ln - 10, y: k * 30 + 19, 'text-anchor': 'end', style: 'font: 500 11.5px var(--f-ui); fill: var(--encre-2)' }, r))
      svg.append(s('line', { x1: ln, x2: ln + L, y1: k * 30 + 15, y2: k * 30 + 15, stroke: 'rgba(148,166,196,0.1)' }))
    })
    for (const inc of INCIDENTS) {
      const k = lignes.indexOf(inc.regle)
      const x1 = X(inc.debut)
      const x2 = X(inc.fin ?? fin)
      const c = { critique: 'var(--critique)', serieux: 'var(--serieux)', veille: 'var(--veille)' }[inc.gravite]
      const r = s('rect', { x: x1 - 3, y: k * 30 + 8, width: Math.max(7, x2 - x1 + 6), height: 14, rx: 4, fill: c, 'fill-opacity': inc.fin ? 0.85 : 0.45, stroke: inc.fin ? 'none' : c, 'stroke-width': 1.5 })
      r.addEventListener('pointermove', e => montrerInfobulle(e.clientX, e.clientY, inc.regle, [{ couleur: c, carre: true, valeur: inc.fin ? dureeMin((inc.fin - inc.debut) / MINUTE) : 'en cours', nom: quand(inc.debut, maintenant()) }], inc.cause))
      r.addEventListener('pointerleave', cacherInfobulle)
      svg.append(r)
    }
    svg.append(axe)
    return svg
  })
  return [
    tetePage({ surtitre: 'Commande', neuf: true, titre: 'Alertes et incidents', chapo: 'Ce qui sonne, à partir de quand, et où : au QG seulement, ou sur ton téléphone aussi. Les seuils se règlent ici ; les barèmes du jeu, eux, restent dans le code.' }),
    h('div', { class: 'tuiles t-4' },
      tuile({ nom: 'Alertes ouvertes', valeur: String(ouvertes), detail: 'arrêt net, erreurs, une version', src: 'la' }),
      tuile({ nom: 'Incidents · 30 j', valeur: String(INCIDENTS.length), detail: 'deux critiques', src: 'nouveau' }),
      tuile({ nom: 'Retour à la normale', valeur: '25 min', detail: 'la médiane des incidents clos', src: 'nouveau' }),
      tuile({ nom: 'Modes disponibles · 30 j', valeur: '99,7 %', detail: 'le quiz du jour : 2 h 18 de panne', src: 'derive' }),
    ),
    h('div', { class: 'grille' },
      console_({
        classe: 'l-12', etiquette: 'Les règles', titre: 'Ce qui sonne', src: 'derive',
        droite: h('span', { class: 'astuce' }, 'Les six premières existent ; les huit autres sont proposées'),
        corps: tableau({
          id: 'regles', triInitial: 'etat', sensInitial: 'asc',
          colonnes: [
            { cle: 'etat', nom: 'État', rendre: r => (r.etat === 'ouverte' ? statut(r.gravite, 'ouverte') : statut('ok', 'au calme')), valeur: r => (r.etat === 'ouverte' ? 0 : 1) },
            { cle: 'nom', nom: 'Règle', rendre: r => h('span', null, h('b', null, r.nom), r.existe ? null : h('span', { class: 'statut neuf', style: { marginLeft: '8px' } }, 'proposée')) },
            { cle: 'seuil', nom: 'Seuil', tri: false, rendre: r => h('button', { type: 'button', class: 'seuil', title: 'Régler le seuil' }, r.seuil) },
            { cle: 'fenetre', nom: 'Sur', rendre: r => h('span', { class: 'second' }, r.fenetre) },
            { cle: 'gravite', nom: 'Gravité', rendre: r => statut(r.gravite, { critique: 'critique', serieux: 'sérieuse', veille: 'à surveiller' }[r.gravite]), valeur: r => ['critique', 'serieux', 'veille'].indexOf(r.gravite) },
            { cle: 'canal', nom: 'Prévenir', tri: false, rendre: r => h('span', { class: 'canal' }, h('button', { type: 'button', 'aria-pressed': String(r.qg) }, 'QG'), h('button', { type: 'button', 'aria-pressed': String(r.tel), onClick: e => { r.tel = !r.tel; e.currentTarget.setAttribute('aria-pressed', String(r.tel)) } }, 'Téléphone')) },
            { cle: 'derniere', nom: 'La dernière fois', n: true, rendre: r => (r.derniere ? quand(r.derniere, maintenant()) : h('span', { class: 'discret' }, 'jamais')), valeur: r => r.derniere || 0 },
          ],
          lignes: REGLES,
        }),
      }),
    ),
    h('div', { class: 'grille' },
      console_({ classe: 'l-8', etiquette: 'Les incidents', titre: 'Les trois dernières semaines', src: 'nouveau', droite: legende([{ nom: 'critique', couleur: 'var(--critique)' }, { nom: 'sérieux', couleur: 'var(--serieux)' }, { nom: 'à surveiller', couleur: 'var(--veille)' }]), corps: [frise, h('div', { class: 'bas-de-console' }, 'Plein : clos · contour : encore ouvert. Chaque incident garde sa cause et un mot, comme une erreur triée.')] }),
      console_({
        classe: 'l-4', etiquette: 'Sur ton téléphone', titre: 'Ceux qui sonnent', src: 'la',
        corps: [
          h('div', { class: 'voyants' },
            h('div', { class: 'voyant-bloc' }, h('span', { class: 'voyant' }), h('b', null, 'Ce téléphone'), h('small', null, 'empreinte 4f9a·21c0·77be·0d13')),
            h('div', { class: 'voyant-bloc' }, h('span', { class: 'voyant' }), h('b', null, 'Un autre'), h('small', null, 'empreinte b812·aa04·3e9f·c561')),
          ),
          h('div', { class: 'bas-de-console' }, h('button', { type: 'button', class: 'bouton' }, icone('cloche'), 'Envoyer un essai'), h('span', null, 'Cinq téléphones au plus, sans session.')),
        ],
      }),
    ),
  ]
}

// ── Le journal ────────────────────────────────────────────────────────

function pageJournal(etat) {
  const sorte = etat.sorteJournal || 'tout'
  const gestes = [
    [T0 - 7 * HEURE - 10 * MINUTE, 'profil', 'Confettis offerts : 50 à Léa (@lea), « Merci pour tes signalements »'],
    [T0 - 9 * HEURE, 'jour', 'Question retirée de la réserve : « Combien de cœurs a une pieuvre ? »'],
    [T0 - 26 * HEURE, 'serveur', 'Erreur triée : SQLITE_BUSY, réglée — « Arrêt net : la base locale saturée »'],
    [T0 - 30 * HEURE, 'campagne', 'Mélange du palier 5 réglé : 9 faciles, 5 moyennes, 2 difficiles (avant 8, 6, 2)'],
    [Date.UTC(2026, 10, 1, 9, 0), 'animer', 'Affiche posée : « Le Cabinet de curiosités », sept jours, 20 confettis à la première visite'],
    [Date.UTC(2026, 9, 31, 8, 30), 'maintenance', 'Page rouverte : le Cabinet de curiosités, ouvert à tous'],
    [Date.UTC(2026, 9, 30, 20, 12), 'duels', 'Duel annulé avant d’être joué : 7KQ2 (Arthur contre Manon)'],
    [Date.UTC(2026, 9, 29, 21, 4), 'soiree', 'Soirée laissée en plan close : salon de Clara, 6 invités'],
  ].filter(g => sorte === 'tout' || g[1] === sorte)
  return [
    tetePage({ surtitre: 'Commande', titre: 'Le journal', chapo: 'Chaque geste qui a changé quelque chose, jamais modifié — et, nouveau, les événements du serveur au même fil : on lit ensemble ce qu’on a fait et ce qui s’est passé.' }),
    h('div', { class: 'barre-outils' },
      h('label', { class: 'champ' }, icone('chercher'), h('input', { id: 'cherche-journal', placeholder: 'Chercher un profil, une question, une page…', 'aria-label': 'Chercher dans le journal' })),
      puces([{ cle: 'tout', nom: 'Tout' }, { cle: 'profil', nom: 'Profils' }, { cle: 'jour', nom: 'Quiz du jour' }, { cle: 'campagne', nom: 'Campagne' }, { cle: 'duels', nom: 'Duels' }, { cle: 'soiree', nom: 'Soirées' }, { cle: 'maintenance', nom: 'Maintenance' }, { cle: 'animer', nom: 'Animer' }, { cle: 'serveur', nom: 'Serveur' }], sorte, c => { etat.sorteJournal = c; rendrePage() }),
    ),
    console_({
      src: 'la',
      corps: h('ul', { class: 'fil' }, gestes.map(([t, so, texte]) => h('li', null, h('time', null, quand(t, maintenant()).replace(' à ', ' · ')), h('span', { class: 'point', style: { background: so === 'serveur' ? 'var(--critique)' : 'var(--or)' } }), h('span', { class: 'quoi' }, texte)))),
    }),
  ]
}

// ── Les téléphones des joueurs (proposé) ──────────────────────────────

function pageTelephones(etat) {
  const pagesVues = [
    { page: 'L’accueil', lcp: 1.9, inp: 120, cls: 0.02, erreurs: 3, vues: 4200 },
    { page: 'Le quiz du jour', lcp: 1.6, inp: 96, cls: 0.01, erreurs: 0, vues: 2900 },
    { page: 'La campagne', lcp: 2.3, inp: 180, cls: 0.04, erreurs: 1, vues: 2400 },
    { page: 'Le Cabinet', lcp: 3.4, inp: 260, cls: 0.09, erreurs: 6, vues: 1300 },
    { page: 'Une soirée (invité)', lcp: 1.4, inp: 88, cls: 0.0, erreurs: 2, vues: 610 },
    { page: 'L’écran commun', lcp: 2.0, inp: 140, cls: 0.03, erreurs: 0, vues: 46 },
    { page: 'Le profil', lcp: 2.1, inp: 150, cls: 0.05, erreurs: 0, vues: 1800 },
  ]
  return [
    tetePage({ surtitre: 'Technique', neuf: true, titre: 'Les téléphones', chapo: 'Ce que les joueurs vivent de leur côté : le temps qu’une page met à paraître, à répondre au doigt, ce qui saute, et le client qui plante. Mesuré dans la page, agrégé au serveur, sans un nom ni une adresse. Proposé en option : le 19 octobre, « le client qui plante » n’avait pas été retenu pour sonner — ici, il se lit seulement.' }),
    h('div', { class: 'tuiles' },
      tuile({ nom: 'Page affichée · p75', valeur: '2,1 s', detail: 'LCP, tous téléphones', src: 'nouveau' }),
      tuile({ nom: 'Réponse au doigt · p75', valeur: '150 ms', detail: 'INP', src: 'nouveau' }),
      tuile({ nom: 'Ce qui saute · p75', valeur: '0,03', detail: 'CLS', src: 'nouveau' }),
      tuile({ nom: 'Erreurs du client', valeur: '12', detail: '4 différentes', src: 'nouveau' }),
      tuile({ nom: 'Android / iPhone', valeur: '64 / 36', unite: '%', src: 'nouveau' }),
      tuile({ nom: 'Application installée', valeur: '41 %', detail: 'des profils actifs', src: 'nouveau' }),
    ),
    h('div', { class: 'grille' },
      console_({
        classe: 'l-12', etiquette: 'Page par page', titre: 'Le ressenti des téléphones', src: 'nouveau',
        corps: tableau({
          id: 'telephones', triInitial: 'lcp',
          colonnes: [
            { cle: 'page', nom: 'Page' },
            { cle: 'vues', nom: 'Vues', n: true, rendre: x => compact(x.vues) },
            { cle: 'lcp', nom: 'Affichée · p75', n: true, rendre: x => h('b', { style: { color: x.lcp > 2.5 ? '#ffd166' : 'var(--encre)' } }, nombre(x.lcp, 1) + ' s') },
            { cle: 'inp', nom: 'Au doigt · p75', n: true, rendre: x => h('b', { style: { color: x.inp > 200 ? '#ffd166' : 'var(--encre)' } }, ms(x.inp)) },
            { cle: 'cls', nom: 'Sauts', n: true, rendre: x => nombre(x.cls, 2) },
            { cle: 'erreurs', nom: 'Erreurs', n: true, rendre: x => (x.erreurs ? h('b', { style: { color: 'var(--critique-texte)' } }, String(x.erreurs)) : h('span', { class: 'discret' }, '0')) },
          ],
          lignes: pagesVues,
        }),
      }),
    ),
  ]
}

// ── Une notification en bas de l'écran ────────────────────────────────

function notifier(texte) {
  const t = h('div', { class: 'statut neutre', role: 'status', style: { position: 'fixed', left: '50%', bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)', zIndex: 95, padding: '10px 14px', fontSize: '13px', background: 'var(--console-haute)' } }, texte)
  document.body.append(t)
  setTimeout(() => t.remove(), 2600)
}
