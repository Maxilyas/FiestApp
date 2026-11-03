'use strict'
// Les pages de la maquette, seconde moitié : l'audience (joueurs, profils,
// salons, économie), les modes — un seul gabarit, cinq pages, dont celle du
// Cabinet qui manquait —, et le contenu (questions, réserves, et les pages
// reprises telles quelles).

// ── Les pièces des pages produit ──────────────────────────────────────

/** La fenêtre des pages produit : jour par jour dès une semaine, heure par heure en deçà. */
function fenetreProduit(etat) {
  const f = fenetre(etat, 'produit')
  if (f.duree >= 7 * JOUR && f.pas < JOUR) return { ...f, pas: JOUR, t: seaux(f.debut, f.fin, JOUR) }
  return f
}
const variation = (a, b) => (b ? ((a - b) / b) * 100 : null)
function douze(valeurs) {
  const n = Math.max(1, Math.floor(valeurs.length / 12))
  const r = []
  for (let i = 0; i < valeurs.length; i += n) r.push(somme(valeurs.slice(i, i + n)))
  return r
}
function entonnoir(etapes, couleur) {
  const premier = etapes[0].n || 1
  return h('div', { class: 'entonnoir' },
    etapes.map((e, i) => {
      const avant = i ? etapes[i - 1].n : null
      return [
        h('div', { class: 'etape' },
          h('span', { class: 'nom' }, e.nom),
          h('span', { class: 'piste' }, h('span', { class: 'plein', style: { width: (e.n / premier) * 100 + '%', background: couleur } })),
          h('span', { class: 'chiffres' }, nombre(e.n), h('small', null, i ? `${pct((e.n / premier) * 100)} du départ` : 'le départ')),
        ),
        avant && avant > e.n && (avant - e.n) / avant > 0.08 ? h('div', { class: 'etape' }, h('span'), h('span', { class: 'perte' }, `−${pct(((avant - e.n) / avant) * 100)} à cette marche${e.perte ? ' · ' + e.perte : ''}`), h('span')) : null,
      ]
    }),
  )
}
function barresCouchees(items, { couleur = 'var(--or)', format = v => pct(v), max: m, large = false } = {}) {
  const haut = m ?? Math.max(...items.map(i => i.v))
  return h('div', { class: 'barres' + (large ? ' larges' : '') },
    items.map(it =>
      h('div', { class: 'barre', title: it.note || null },
        h('span', { class: 'nom' }, it.points || null, it.nom),
        h('span', { class: 'piste' }, h('span', { class: 'plein', style: { width: Math.max(1, (it.v / haut) * 100) + '%', background: it.couleur || couleur, display: 'block' } })),
        h('span', { class: 'val' }, format(it.v)),
      ),
    ),
  )
}
function cartesDActions(actions) {
  return h('div', { class: 'cartes' },
    actions.map(a =>
      h('div', { class: 'carte' },
        h('div', { class: 'carte-tete' }, h('b', { style: { fontFamily: 'var(--f-ui)', fontSize: '13.5px' } }, a.nom), a.neuf ? statut('neuf', 'proposé') : statut('neutre', 'existe')),
        h('span', { class: 'second', style: { fontSize: '12.5px' } }, a.detail),
        h('button', { type: 'button', class: 'bouton' + (a.danger ? ' danger' : ''), style: { justifySelf: 'start' } }, a.bouton),
      ),
    ),
  )
}
/** Quand on joue : jour de la semaine × heure, tous modes ou un seul. */
function heuresDeJeu(cle) {
  const jours = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.']
  const lundi = minuit(T0) - ((paris(T0).sem + 6) % 7) * JOUR - 7 * JOUR
  const valeurs = jours.map((_, j) =>
    Array.from({ length: 24 }, (_, hh) => {
      const t = lundi + j * JOUR + (hh + 0.5) * HEURE
      if (endormi(t)) return null
      if (cle === 'soiree') return (paris(t).sem === 5 || paris(t).sem === 6 ? 1 : 0.25) * cloche(hh, 21.5, 1.2, 1)
      if (cle) return partiesParHeure(cle, t)
      return MODES.reduce((a, m) => a + partiesParHeure(m.cle, t), 0)
    }),
  )
  const haut = Math.max(...valeurs.flat().filter(v => v != null))
  const total = somme(valeurs.flat())
  return chaleur({
    lignes: jours,
    colonnes: Array.from({ length: 24 }, (_, i) => (i % 3 === 0 ? `${i} h` : '')),
    valeurs: valeurs.map(l => l.map(v => (v == null ? null : v / haut))),
    largeurNom: 44,
    texte: (i, j) => ({ titre: `${['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][i]} · ${j} h → ${j + 1} h`, valeur: valeurs[i][j] == null ? 'endormi' : pct((valeurs[i][j] / total) * 100, 1), nom: valeurs[i][j] == null ? 'l’hébergeur dort' : 'des parties de la semaine' }),
    legendeBas: 'calme', legendeHaut: 'le pic',
  })
}

// ── Les joueurs ───────────────────────────────────────────────────────

function pageJoueurs(etat) {
  const f = fenetreProduit(etat)
  const fJ = f.duree >= 7 * JOUR ? f : { debut: maintenant() - 30 * JOUR, fin: maintenant(), duree: 30 * JOUR, pas: JOUR, t: seaux(maintenant() - 30 * JOUR, maintenant(), JOUR) }
  const dau = joueursUniques(fJ).map(v => Math.round(v))
  const wau = dau.map((v, i) => Math.round(v * 1.62 + 6 * bruit('wau', i)))
  const mau = dau.map((v, i) => Math.round(v * 2.45 + 8 * bruit('mau', i)))
  const lecture = h('div', { class: 'lecture' })
  const nouveaux = Math.round((f.duree / JOUR) * 4.6 + 2)
  const invites = SOIREES.filter(s2 => s2.t >= f.debut && s2.t < f.fin).reduce((a, s2) => a + s2.invites - s2.profils, 0)
  const cohortes = chaleur({
    lignes: COHORTES.map(c => `${dateCourte(c.lundi)} · ${c.taille}`),
    colonnes: Array.from({ length: 9 }, (_, k) => (k ? `S+${k}` : 'S0')),
    valeurs: COHORTES.map(c => Array.from({ length: 9 }, (_, k) => (c.parts[k] == null ? null : k === 0 ? 1 : c.parts[k] / 70))),
    largeurNom: 92, hauteurCase: 24,
    ecrire: (i, k) => (COHORTES[i].parts[k] == null ? null : k === 0 ? String(COHORTES[i].taille) : COHORTES[i].parts[k] + ' %'),
    texte: (i, k) => ({ titre: `Inscrits la semaine du ${dateCourte(COHORTES[i].lundi)}`, valeur: COHORTES[i].parts[k] == null ? 'pas encore' : k ? COHORTES[i].parts[k] + ' %' : COHORTES[i].taille + ' profils', nom: k ? `revenus ${k} semaine${k > 1 ? 's' : ''} après` : 'la cohorte' }),
    legendeBas: 'peu reviennent', legendeHaut: 'tous reviennent',
  })
  const ouvrirJoueur = j => ouvrirFiche(j)
  return [
    tetePage({ surtitre: 'Audience', neuf: true, titre: 'Les joueurs', chapo: 'Combien jouent, combien reviennent, et qui décroche — les profils seulement, un invité sans profil ne se suit pas d’un soir à l’autre.' }),
    h('div', { class: 'tuiles' },
      tuile({ nom: 'Aujourd’hui', valeur: '101', detail: 'joueurs, à 22 h 41 · ▲ 9 % à la même heure', courbe: dau.slice(-14), src: 'la' }),
      tuile({ nom: 'Ces sept jours', valeur: nombre(wau[wau.length - 1]), ecart: 6, courbe: wau.slice(-14), src: 'derive' }),
      tuile({ nom: 'Ces trente jours', valeur: nombre(mau[mau.length - 1]), ecart: 11, courbe: mau.slice(-14), src: 'derive' }),
      tuile({ nom: 'Fidélité', valeur: pct((dau[dau.length - 2] / mau[mau.length - 2]) * 100), detail: 'joueurs du jour sur ceux du mois', src: 'derive' }),
      tuile({ nom: 'Nouveaux profils', valeur: nombre(nouveaux), detail: `sur ${libellePlage(etat)}`, src: 'la' }),
      tuile({ nom: 'Invités sans profil', valeur: nombre(invites), detail: 'venus en soirée', src: 'la' }),
    ),
    h('div', { class: 'grille' },
      console_({
        classe: 'l-8 etire', etiquette: 'Actifs', titre: 'Joueurs du jour, de la semaine, du mois', lecture, src: 'derive',
        droite: legende([{ nom: 'du jour', couleur: 'var(--or)', trait: true }, { nom: 'des sept jours', couleur: 'var(--or-vif)', trait: true }, { nom: 'des trente jours', couleur: 'var(--encre-2)', trait: true }]),
        corps: grapheTemps({ f: fJ, hauteur: 240, evenements: true, lecture, nom: 'Joueurs actifs', series: [{ nom: 'des trente jours', nomCourt: 'sur 30 j', valeurs: mau, couleur: 'var(--encre-2)', forme: 'ligne' }, { nom: 'des sept jours', nomCourt: 'sur 7 j', valeurs: wau, couleur: 'var(--or-vif)', forme: 'ligne' }, { nom: 'du jour', valeurs: dau, couleur: 'var(--or)', forme: 'aire' }] }),
      }),
      console_({
        classe: 'l-4 etire', etiquette: 'Segments', titre: 'Où en est chacun', src: 'derive',
        corps: [
          h('div', { class: 'segments', role: 'img', 'aria-label': SEGMENTS.map(x => `${x.nom} ${x.n}`).join(', ') },
            SEGMENTS.map(x => h('span', { style: { flex: String(x.n), background: x.couleur }, class: ['risque', 'endormis'].includes(x.cle) ? 'clair' : '' }, x.n)),
          ),
          h('div', { class: 'barres', style: { marginTop: '14px' } },
            SEGMENTS.map(x => h('div', { class: 'barre' }, h('span', { class: 'nom' }, h('span', { style: { width: '9px', height: '9px', borderRadius: '2px', background: x.couleur, display: 'inline-block' } }), x.nom), h('span', { class: 'second', style: { fontSize: '12px' } }, x.detail), h('span', { class: 'val' }, nombre(x.n)))),
          ),
          h('div', { class: 'bas-de-console' }, h('button', { type: 'button', class: 'bouton', onClick: () => aller('annonces') }, icone('annonce'), 'Écrire aux endormis'), h('span', null, '141 profils absents depuis plus d’un mois')),
        ],
      }),
    ),
    h('div', { class: 'grille' },
      console_({ classe: 'l-7', etiquette: 'Rétention', titre: 'Qui revient, semaine après semaine', sous: 'Chaque ligne : les profils inscrits une semaine ; chaque case : la part qui a joué N semaines plus tard.', src: 'nouveau', corps: cohortes }),
      console_({ classe: 'l-5', etiquette: 'Rythme', titre: 'Quand on joue, tous modes', sous: 'La semaine dernière, heure par heure ; la nuit, l’hébergeur dort.', src: 'derive', corps: heuresDeJeu(null) }),
    ),
    h('div', { class: 'grille' },
      console_({
        classe: 'l-6', etiquette: 'Mélange', titre: 'Qui joue à quoi', sous: 'Les profils actifs ces trente jours, par les modes qu’ils jouent.', src: 'derive',
        corps: barresCouchees(
          [
            [['jour'], 'Quiz du jour seul', 21], [['jour', 'campagne'], 'Quiz du jour et campagne', 18], [['jour', 'campagne', 'duel'], 'Jour, campagne, duels', 14], [['campagne'], 'Campagne seule', 12], [['campagne', 'cabinet'], 'Campagne et Cabinet', 9], [['soiree'], 'Soirées seules', 9], [['soiree', 'jour', 'campagne', 'cabinet', 'duel'], 'Un peu de tout', 6], [['duel'], 'Duels seuls', 5],
          ].map(([modes, nom, v]) => ({ nom, v, points: h('span', { style: { display: 'inline-flex', gap: '2px', marginRight: '4px' } }, MODES.map(m => h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: modes.includes(m.cle) ? m.couleur : 'rgba(148,166,196,0.18)', display: 'inline-block' } }))) })),
          { large: true },
        ),
      }),
      console_({
        classe: 'l-6', etiquette: 'Arrivées', titre: 'D’où viennent les nouveaux profils', sous: 'L’écran où le profil a été créé.', src: 'nouveau',
        corps: [
          barresCouchees([{ nom: 'Pendant une soirée', v: 58 }, { nom: 'Depuis l’accueil', v: 29 }, { nom: 'Par un lien de duel', v: 8 }, { nom: 'Par le quiz du jour partagé', v: 5 }]),
          h('div', { class: 'bas-de-console' }, 'Une soirée fait six profils sur dix : la sortie de la soirée est la porte d’entrée.'),
        ],
      }),
    ),
    h('div', { class: 'grille' },
      console_({
        classe: 'l-12', etiquette: 'Les profils', titre: 'Qui joue le plus', sous: 'Trente jours · une ligne ouvre sa fiche.', src: 'la',
        corps: tableJoueurs(JOUEURS, ouvrirJoueur, 'joueurs'),
      }),
    ),
  ]
}

function tableJoueurs(liste, surLigne, id) {
  return tableau({
    id, triInitial: 'questions', surLigne,
    colonnes: [
      { cle: 'nom', nom: 'Joueur', rendre: j => h('span', null, h('b', null, j.nom), h('span', { class: 'discret mono', style: { fontSize: '11.5px', marginLeft: '8px' } }, j.pseudo)) },
      { cle: 'jours', nom: 'Jours actifs', n: true, rendre: j => `${j.jours}/30` },
      { cle: 'parties', nom: 'Parties', n: true },
      { cle: 'questions', nom: 'Questions', n: true, rendre: j => nombre(j.questions) },
      { cle: 'manie', nom: 'Préfère', rendre: j => (j.manie === 'tout' ? h('span', { class: 'second' }, 'un peu de tout') : h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } }, h('span', { style: { width: '8px', height: '8px', borderRadius: '2px', background: MODE[j.manie].couleur, display: 'inline-block' } }), MODE[j.manie].nom)) },
      { cle: 'serie', nom: 'Série', n: true, rendre: j => `${j.serie} j` },
      { cle: 'niveau', nom: 'Niveau', n: true },
      { cle: 'derniere', nom: 'Dernière venue', n: true, rendre: j => ilYA(j.derniere, maintenant()) },
    ],
    lignes: liste,
  })
}

function ouvrirFiche(j) {
  const f = { debut: T0 - 30 * JOUR, fin: T0, duree: 30 * JOUR, pas: JOUR, t: seaux(T0 - 30 * JOUR, T0, JOUR) }
  const parts = MODES.map(m => ({ m, v: f.t.map((t, i) => (hasard('fiche' + j.nom + m.cle, i) < (j.manie === m.cle ? 0.8 : j.manie === 'tout' ? 0.4 : 0.15) ? Math.round(2 + hasard('fv' + j.nom, i) * 6) : 0)) }))
  ouvrirTiroir({
    tete: [h('div', { class: 'surtitre' }, 'Profil · ' + j.pseudo), h('h2', null, j.nom)],
    corps: [
      h('div', { class: 'tuiles t-4' }, tuile({ nom: 'Niveau', valeur: String(j.niveau) }), tuile({ nom: 'Jours actifs', valeur: `${j.jours}/30` }), tuile({ nom: 'Série du jour', valeur: `${j.serie} j` }), tuile({ nom: 'Cote des duels', valeur: nombre(j.cote) })),
      h('section', null, h('h4', null, 'Ses trente jours, mode par mode'), grapheTemps({ f, hauteur: 150, empile: true, series: parts.map(p => ({ nom: p.m.nom, valeurs: p.v, couleur: p.m.couleur })) }), legende(MODES.map(m => ({ nom: m.nom, couleur: m.couleur })))),
      h('section', null, h('h4', null, 'L’aider'), h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, ['Offrir des confettis', 'Offrir un Éclat', 'Offrir un coffre', 'Tirer un code de secours', 'Lever le verrou de connexion'].map(x => h('button', { type: 'button', class: 'bouton' }, x)))),
      h('section', null, h('h4', null, 'Modérer'), h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, h('button', { type: 'button', class: 'bouton' }, 'Changer son prénom'), h('button', { type: 'button', class: 'bouton' }, 'Suspendre'), h('button', { type: 'button', class: 'bouton danger' }, 'Supprimer…'))),
      h('p', { class: 'discret', style: { fontSize: '12.5px' } }, 'La fiche d’aujourd’hui, en tiroir : elle s’ouvre de n’importe quelle page qui nomme un joueur.'),
    ],
  }, j.nom)
}

function pageProfils(etat) {
  const filtre = etat.filtreProfils || 'tous'
  return [
    tetePage({ surtitre: 'Audience', titre: 'Les profils', chapo: 'Chercher, trier, ouvrir une fiche. La fiche et ses gestes ne changent pas ; la liste se trie sur chaque colonne et se filtre en un toucher.' }),
    h('div', { class: 'barre-outils' },
      h('label', { class: 'champ' }, icone('chercher'), h('input', { id: 'cherche-profil', placeholder: 'Un prénom, un identifiant…', 'aria-label': 'Chercher un profil' })),
      puces([{ cle: 'tous', nom: 'Tous', compte: 392 }, { cle: 'actifs', nom: 'Actifs ce mois', compte: 247 }, { cle: 'endormis', nom: 'Endormis', compte: 34 }, { cle: 'masques', nom: 'Hors classement', compte: 2 }, { cle: 'suspendus', nom: 'Suspendus', compte: 1 }, { cle: 'testeurs', nom: 'Testeurs', compte: 3 }], filtre, c => { etat.filtreProfils = c; rendrePage() }),
    ),
    tableJoueurs(JOUEURS, ouvrirFiche, 'profils'),
    h('div', { class: 'tableau-pied' }, h('span', null, '24 profils montrés sur 392 · une ligne ouvre la fiche'), source('la')),
  ]
}

function pageSalons(etat) {
  const f = { debut: maintenant() - 30 * JOUR, fin: maintenant() }
  const lignes = SALONS.map(nom => {
    const siennes = SOIREES.filter(s2 => s2.salon === nom && s2.t >= f.debut)
    const toutes = SOIREES.filter(s2 => s2.salon === nom)
    const invites = siennes.map(s2 => s2.invites).sort((a, b) => a - b)
    return {
      nom, slug: slugDuSalon(nom), soirees: siennes.length, total: toutes.length,
      derniere: toutes.length ? toutes[toutes.length - 1].t : null,
      invites: invites.length ? invites[Math.floor(invites.length / 2)] : null,
      quiz: siennes.length ? somme(siennes.map(s2 => s2.quiz)) / siennes.length : null,
      plan: siennes.filter(s2 => s2.issue === 'plan').length,
    }
  })
  return [
    tetePage({ surtitre: 'Audience', titre: 'Les salons', chapo: 'Chaque espace, nommé par son titulaire, et ce qu’on y joue — des chiffres seulement : ni quiz, ni titre, ni invité.' }),
    h('div', { class: 'tuiles t-4' },
      tuile({ nom: 'Salons', valeur: String(SALONS.length), detail: '2 désactivés', src: 'la' }),
      tuile({ nom: 'Actifs ce mois', valeur: String(lignes.filter(l => l.soirees).length), detail: 'au moins une soirée', src: 'derive' }),
      tuile({ nom: 'Soirées ce mois', valeur: String(somme(lignes.map(l => l.soirees))), ecart: 14, src: 'la' }),
      tuile({ nom: 'Laissées en plan', valeur: String(somme(lignes.map(l => l.plan))), detail: 'closes depuis le QG', src: 'la' }),
    ),
    h('div', { class: 'bloc', style: { marginTop: '16px' } },
      tableau({
        id: 'salons', triInitial: 'soirees',
        colonnes: [
          { cle: 'nom', nom: 'Salon', rendre: l => h('span', null, h('b', null, `Salon de ${l.nom}`), h('span', { class: 'discret mono', style: { fontSize: '11.5px', marginLeft: '8px' } }, l.slug)) },
          { cle: 'soirees', nom: 'Soirées · 30 j', n: true },
          { cle: 'total', nom: 'Depuis toujours', n: true },
          { cle: 'invites', nom: 'Invités (médiane)', n: true, rendre: l => (l.invites ?? '—') },
          { cle: 'quiz', nom: 'Quiz par soirée', n: true, rendre: l => (l.quiz == null ? '—' : nombre(l.quiz, 1)) },
          { cle: 'plan', nom: 'En plan', n: true },
          { cle: 'derniere', nom: 'La dernière', n: true, rendre: l => (l.derniere ? quand(l.derniere, maintenant()) : '—') },
        ],
        lignes,
      }),
    ),
  ]
}

function pageEconomie(etat) {
  const f = fenetreProduit(etat)
  const gagnes = f.t.map((t, i) => Math.round(MODES.reduce((a, m) => a + integrer(u => partiesParHeure(m.cle, u), 'eco-' + m.cle, t, f.pas), 0) * 7.8))
  const depenses = gagnes.map((v, i) => Math.round(v * (0.58 + 0.4 * hasard('dep', i)) * (hasard('dep2', i) > 0.9 ? 2.1 : 1)))
  const lecture = h('div', { class: 'lecture' })
  return [
    tetePage({ surtitre: 'Audience', titre: 'L’économie', chapo: 'Les confettis : d’où ils viennent, où ils partent, ce qui circule. Une page à lire : les prix restent dans le code.' }),
    h('div', { class: 'tuiles' },
      tuile({ nom: 'Gagnés', valeur: compact(somme(gagnes)), ecart: 9, courbe: douze(gagnes), src: 'la' }),
      tuile({ nom: 'Dépensés', valeur: compact(somme(depenses)), ecart: 22, courbe: douze(depenses), src: 'la' }),
      tuile({ nom: 'En circulation', valeur: compact(1288400), detail: 'tous les soldes, relus ce matin', src: 'la' }),
      tuile({ nom: 'Solde médian', valeur: nombre(2140), detail: 'de ceux qui ont joué ce mois', src: 'la' }),
      tuile({ nom: 'Achats', valeur: nombre(318), detail: 'thèmes, compagnons, fonds, objets', src: 'la' }),
      tuile({ nom: 'Éclats tombés', valeur: nombre(27), detail: '17 légendaires portés', src: 'la' }),
    ),
    h('div', { class: 'grille' },
      console_({ classe: 'l-12', etiquette: 'Flux', titre: 'Gagnés et dépensés', lecture, src: 'la', droite: legende([{ nom: 'gagnés', couleur: 'var(--or)', trait: true }, { nom: 'dépensés', couleur: 'var(--encre-2)', trait: true }]), corps: grapheTemps({ f, hauteur: 220, evenements: true, lecture, series: [{ nom: 'gagnés', valeurs: gagnes, couleur: 'var(--or)', forme: 'aire' }, { nom: 'dépensés', valeurs: depenses, couleur: 'var(--encre-2)', forme: 'ligne' }] }) }),
    ),
    h('div', { class: 'grille' },
      console_({ classe: 'l-6', etiquette: 'Sources', titre: 'D’où viennent les confettis', src: 'la', corps: barresCouchees(SOURCES_DE_CONFETTIS.map(([nom, v]) => ({ nom, v }))) }),
      console_({ classe: 'l-6', etiquette: 'Dépenses', titre: 'Où ils partent', src: 'la', corps: barresCouchees(DEPENSES_DE_CONFETTIS.map(([nom, v]) => ({ nom, v })), { couleur: 'var(--encre-2)' }) }),
    ),
  ]
}

// ── La vue comparée ───────────────────────────────────────────────────

function pageComparer(etat) {
  const f = fenetreProduit(etat)
  const av = fenetreDAvant(f)
  const lignes = MODES.map(m => {
    const parties = serieDuMode(m.cle, f)
    const joueurs = joueursDuMode(m.cle, f)
    const total = somme(parties)
    return {
      m, nom: m.nom, parties: Math.round(total), questions: Math.round(total * QUESTIONS_PAR_PARTIE[m.cle]),
      joueurs: Math.round(max(joueurs) * (f.duree > JOUR ? 2.4 : 1.3)),
      reussite: { soiree: 58, jour: 64, campagne: 61, cabinet: 57, duel: 55 }[m.cle],
      duree: { soiree: 118, jour: 3.4, campagne: 4.8, cabinet: 21, duel: 3.1 }[m.cle],
      retour: { soiree: 22, jour: 71, campagne: 63, cabinet: 48, duel: 52 }[m.cle],
      ecart: variation(total, somme(serieDuMode(m.cle, av))),
      tendance: douze(parties),
    }
  })
  const totalQ = somme(lignes.map(l => l.questions))
  return [
    tetePage({ surtitre: 'Modes', titre: 'Les modes, côte à côte', chapo: 'L’ancienne page de l’activité : la quantité de chaque mode, et ce qui se compare d’un mode à l’autre — la réussite, la durée d’une partie, qui revient.' }),
    h('div', { class: 'grille' },
      console_({
        classe: 'l-12', etiquette: 'Part des questions jouées', titre: `${compact(totalQ)} questions sur ${libellePlage(etat)}`, src: 'la',
        corps: [
          h('div', { class: 'segments', role: 'img', 'aria-label': lignes.map(l => `${l.nom} ${pct((l.questions / totalQ) * 100)}`).join(', ') },
            lignes.map(l => h('span', { class: 'clair', style: { flex: String(l.questions), background: l.m.couleur } }, l.questions / totalQ > 0.09 ? `${l.nom} · ${pct((l.questions / totalQ) * 100)}` : '')),
          ),
          legende(lignes.map(l => ({ nom: `${l.nom} · ${compact(l.questions)}`, couleur: l.m.couleur }))),
        ],
      }),
    ),
    h('div', { class: 'grille' },
      console_({
        classe: 'l-12', etiquette: 'Mode par mode', titre: 'Ce qui se compare', src: 'derive',
        corps: tableau({
          id: 'comparer', triInitial: 'questions', surLigne: l => aller(l.m.page),
          colonnes: [
            { cle: 'nom', nom: 'Mode', rendre: l => h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '8px' } }, h('span', { style: { width: '9px', height: '9px', borderRadius: '3px', background: l.m.couleur, display: 'inline-block' } }), h('b', null, l.nom)) },
            { cle: 'joueurs', nom: 'Joueurs', n: true },
            { cle: 'parties', nom: 'Parties', n: true, rendre: l => nombre(l.parties) },
            { cle: 'questions', nom: 'Questions', n: true, rendre: l => compact(l.questions) },
            { cle: 'reussite', nom: 'Réussite', n: true, rendre: l => pct(l.reussite) },
            { cle: 'duree', nom: 'Une partie', n: true, rendre: l => dureeMin(l.duree) },
            { cle: 'retour', nom: 'Revenus à J+7', n: true, rendre: l => pct(l.retour) },
            { cle: 'ecart', nom: 'vs avant', n: true, rendre: l => ecartTexte(l.ecart, true) },
            { cle: 'tendance', nom: 'Tendance', tri: false, rendre: l => miniCourbe(l.tendance, l.m.couleur) },
          ],
          lignes,
        }),
      }),
    ),
    h('div', { class: 'grille' },
      MODES.map(m => {
        const lecture = h('div', { class: 'lecture' })
        return console_({ classe: 'l-4' + (m.cle === 'duel' ? ' l-seul' : ''), etiquette: m.nom, titre: 'Parties, ' + libelleDuPas(f.pas), lecture, corps: grapheTemps({ f, hauteur: 120, lecture, groupe: 'comparer', margeGauche: 40, series: [{ nom: 'parties', valeurs: serieDuMode(m.cle, f).map(Math.round), couleur: m.couleur, forme: 'colonnes' }] }) })
      }),
    ),
  ]
}

// ── Le gabarit d'un mode ──────────────────────────────────────────────

/** La tête et les onglets de chaque mode, puis l'onglet ouvert. */
function pageMode(cle, etat) {
  const g = GABARITS[cle]
  const onglet = etat.onglet && g.onglets.some(o => o.cle === etat.onglet) ? etat.onglet : g.onglets[0].cle
  return [
    tetePage({ surtitre: 'Modes', neuf: g.neuf, titre: g.titre, chapo: g.chapo, droite: g.droite ? g.droite() : null }),
    onglets(g.onglets, onglet, c => { etat.onglet = c; rendrePage() }),
    ...g[onglet](etat),
  ]
}

/** Les tuiles communes à chaque mode : joueurs, parties, questions, puis les siennes. */
function tuilesDuMode(cle, f, propres) {
  const av = fenetreDAvant(f)
  const parties = serieDuMode(cle, f)
  const total = somme(parties)
  const totalAvant = somme(serieDuMode(cle, av))
  const joueurs = Math.round(max(joueursDuMode(cle, f)) * (f.duree > JOUR ? 2.4 : 1.3))
  return h('div', { class: 'tuiles' },
    tuile({ nom: 'Joueurs', valeur: nombre(joueurs), ecart: variation(total, totalAvant) * 0.8, courbe: douze(joueursDuMode(cle, f)), couleur: MODE[cle].couleur, src: 'derive', cle: MODE[cle].couleur }),
    tuile({ nom: 'Parties', valeur: nombre(Math.round(total)), ecart: variation(total, totalAvant), courbe: douze(parties), couleur: MODE[cle].couleur, src: 'la' }),
    ...propres,
  )
}

function grapheDuMode(cle, f, etat, opts = {}) {
  const lecture = h('div', { class: 'lecture' })
  const series = opts.series || [{ nom: 'parties', valeurs: serieDuMode(cle, f).map(Math.round), couleur: MODE[cle].couleur, forme: 'colonnes' }]
  return console_({
    classe: 'l-8 etire', etiquette: opts.etiquette || 'Activité', titre: opts.titre || `Parties, ${libelleDuPas(f.pas)}`, lecture, src: opts.src || 'la',
    droite: opts.legende ? legende(opts.legende) : null,
    corps: [
      grapheTemps({ f, hauteur: 236, evenements: true, lecture, empile: opts.empile, nom: opts.titre || 'Parties', series, surZoom: zoomer, avant: etat.comparer && !opts.empile ? [{ valeurs: serieDuMode(cle, fenetreDAvant(f)).map(Math.round), couleur: 'var(--encre-2)' }] : null }),
      opts.bas ? h('div', { class: 'bas-de-console' }, opts.bas) : null,
    ],
  })
}

function enCeMoment(titre, corps, src = 'nouveau') {
  return console_({ classe: 'l-4 etire', etiquette: 'En ce moment', titre, hud: 'vert', src, droite: h('span', { class: 'fraicheur' }, h('span', { class: 'pouls' }), 'en direct'), corps })
}

const GABARITS = {
  // ── Les soirées ──
  soiree: {
    titre: 'Les soirées',
    chapo: 'Des soirées des autres, rien que des chiffres : le salon, où elle en est, combien d’invités — ni le quiz, ni la question, ni un prénom d’invité.',
    onglets: [{ cle: 'vue', nom: 'Tableau de bord', icone: 'poste' }, { cle: 'salles', nom: 'Les salles', icone: 'joueurs' }, { cle: 'historique', nom: 'L’historique', icone: 'journal' }, { cle: 'gestes', nom: 'Gestes', icone: 'cle' }],
    vue(etat) {
      const f = fenetreProduit(etat)
      const dans = SOIREES.filter(s2 => s2.t >= f.debut && s2.t < f.fin && s2.issue !== 'en-cours' && s2.issue !== 'en-plan')
      const invites = dans.map(s2 => s2.invites).sort((a, b) => a - b)
      const parJour = f.t.map(t => SOIREES.filter(s2 => s2.t >= t && s2.t < t + f.pas).length)
      const invitesSerie = f.t.map(t => Math.round(integrer(invitesA, 'inv', t, f.pas)))
      const ouvertes = Math.round(dans.length * 1.12) + 2
      return [
        h('div', { class: 'tuiles' },
          tuile({ nom: 'Soirées', valeur: nombre(dans.length), ecart: 14, courbe: douze(parJour), couleur: MODE.soiree.couleur, src: 'la', cle: MODE.soiree.couleur }),
          tuile({ nom: 'Salons actifs', valeur: nombre(new Set(dans.map(s2 => s2.salon)).size), detail: `sur ${SALONS.length}`, src: 'la' }),
          tuile({ nom: 'Invités · médiane', valeur: invites.length ? String(invites[Math.floor(invites.length / 2)]) : '—', detail: `${nombre(somme(invites))} en tout`, src: 'la' }),
          tuile({ nom: 'Durée · médiane', valeur: '1 h 58', detail: 'de la salle d’attente à la clôture', src: 'derive' }),
          tuile({ nom: 'Quiz par soirée', valeur: '2,4', src: 'la' }),
          tuile({ nom: 'Closes proprement', valeur: '84 %', detail: '7 % en plan · 9 % d’essais effacés', src: 'derive' }),
        ),
        h('div', { class: 'grille' },
          f.pas >= JOUR
            ? grapheDuMode('soiree', f, etat, { titre: 'Soirées, jour par jour', series: [{ nom: 'soirées', valeurs: parJour, couleur: MODE.soiree.couleur, forme: 'colonnes' }] })
            : grapheDuMode('soiree', f, etat, { titre: 'Invités connectés', series: [{ nom: 'invités', valeurs: invitesSerie, couleur: MODE.soiree.couleur, forme: 'aire' }] }),
          enCeMoment('La salle de Karim', [
            h('div', { class: 'carte-ligne' }, h('span', null, 'Question'), h('b', null, '12 sur 20 · quiz 2')),
            h('div', { class: 'progression', style: { margin: '8px 0 12px' } }, h('span', { style: { width: '60%', background: 'var(--mode-soiree)' } })),
            h('div', { class: 'carte-ligne' }, h('span', null, 'Invités'), h('b', null, '11 · 6 à profil')),
            h('div', { class: 'carte-ligne' }, h('span', null, 'Depuis'), h('b', null, dureeMin((maintenant() - (minuit(T0) + 20 * HEURE + 49 * MINUTE)) / MINUTE))),
            h('div', { class: 'carte-ligne' }, h('span', null, 'Ses réponses'), h('b', null, '97 % à temps · 3 trop tard')),
            h('div', { class: 'carte-ligne' }, h('span', null, 'Sauvegarde'), h('b', null, '3 écritures en attente')),
            h('div', { class: 'bas-de-console' }, h('span', { class: 'statut veille' }, icone('maintenance'), 'Salon de Hugo : en plan depuis 7 h'), h('button', { type: 'button', class: 'bouton', onClick: () => { etat.onglet = 'gestes'; rendrePage() } }, 'Clore…')),
          ], 'la'),
        ),
        h('div', { class: 'grille' },
          console_({ classe: 'l-6', etiquette: 'Entonnoir', titre: 'D’une salle ouverte à une soirée close', src: 'derive', corps: entonnoir([{ nom: 'Salle d’attente ouverte', n: ouvertes }, { nom: 'Un quiz lancé', n: Math.round(ouvertes * 0.9) }, { nom: 'Cinq questions jouées', n: Math.round(ouvertes * 0.85), perte: 'des essais' }, { nom: 'Close normalement', n: Math.round(ouvertes * 0.76), perte: 'laissées en plan' }], MODE.soiree.couleur) }),
          console_({ classe: 'l-6', etiquette: 'Rythme', titre: 'Quand on joue en soirée', src: 'derive', corps: heuresDeJeu('soiree') }),
        ),
      ]
    },
    salles() {
      const tranches = [['2 à 4', 9], ['5 à 8', 31], ['9 à 12', 34], ['13 à 20', 18], ['21 et plus', 4]]
      return [
        h('div', { class: 'grille' },
          console_({ classe: 'l-6', etiquette: 'Taille des salles', titre: 'Combien d’invités, quatre-vingt-dix jours', src: 'la', corps: colonnes(tranches.map(([nom, v]) => ({ nom, v })), { couleur: MODE.soiree.couleur, unite: ' soirées' }) }),
          console_({ classe: 'l-6', etiquette: 'Durée', titre: 'Combien de temps dure une soirée', src: 'derive', corps: colonnes([['< 1 h', 6], ['1 h', 17], ['1 h 30', 26], ['2 h', 24], ['2 h 30', 14], ['3 h +', 9]].map(([nom, v]) => ({ nom, v })), { couleur: MODE.soiree.couleur, unite: ' soirées' }) }),
        ),
        h('div', { class: 'grille' },
          console_({ classe: 'l-6', etiquette: 'Équipes', titre: 'Jouée en équipes', src: 'la', corps: barresCouchees([{ nom: 'Chacun pour soi', v: 71 }, { nom: 'En équipes', v: 29 }], { couleur: MODE.soiree.couleur }) }),
          console_({ classe: 'l-6', etiquette: 'Les quiz', titre: 'Ce qu’on lance', sous: 'Leur origine seulement : un quiz d’un espace n’a rien à faire ici.', src: 'derive', corps: barresCouchees([{ nom: 'Ses propres quiz', v: 54 }, { nom: 'Un quiz tout prêt', v: 27 }, { nom: 'Un modèle du catalogue', v: 19 }], { couleur: MODE.soiree.couleur }) }),
        ),
      ]
    },
    historique(etat) {
      const f = fenetreProduit(etat)
      const liste = SOIREES.filter(s2 => s2.t >= Math.min(f.debut, maintenant() - 30 * JOUR)).slice().reverse()
      return [
        tableau({
          id: 'soirees', triInitial: 't',
          colonnes: [
            { cle: 't', nom: 'Quand', rendre: s2 => quand(s2.t, maintenant()), valeur: s2 => s2.t },
            { cle: 'salon', nom: 'Salon', rendre: s2 => `Salon de ${s2.salon}` },
            { cle: 'invites', nom: 'Invités', n: true },
            { cle: 'profils', nom: 'À profil', n: true },
            { cle: 'quiz', nom: 'Quiz', n: true },
            { cle: 'duree', nom: 'Durée', n: true, rendre: s2 => (s2.fin ? dureeMin((s2.fin - s2.t) / MINUTE) : '—'), valeur: s2 => (s2.fin ? s2.fin - s2.t : 0) },
            { cle: 'issue', nom: 'Issue', rendre: s2 => ({ close: statut('ok', 'close'), plan: statut('veille', 'laissée en plan'), essai: statut('neutre', 'essai effacé'), 'en-cours': statut('ok', 'en cours'), 'en-plan': statut('veille', 'en plan') })[s2.issue] },
          ],
          lignes: liste,
        }),
      ]
    },
    gestes() {
      return [cartesDActions([
        { nom: 'Clore une soirée laissée en plan', detail: 'Salon de Hugo · 4 invités · sans un geste depuis 7 h. Close comme son animateur l’aurait close : l’archive, les crédits, la fin à chaque téléphone.', bouton: 'Clore la soirée…' },
        { nom: 'Prévenir les animateurs', detail: 'Le bandeau rouge se lit sur leur accueil et leur console ; une soirée ne se ferme jamais.', bouton: 'Poser un bandeau…' },
      ])]
    },
  },

  // ── Le quiz du jour ──
  jour: {
    titre: 'Le quiz du jour',
    chapo: 'Dix questions pour tout le monde, la série, le classement du mois, le rappel du soir — et la réserve qui les nourrit.',
    onglets: [{ cle: 'vue', nom: 'Tableau de bord', icone: 'poste' }, { cle: 'tirage', nom: 'Le tirage', icone: 'questions', compte: 10 }, { cle: 'classement', nom: 'Le classement', icone: 'couronne' }, { cle: 'rappel', nom: 'Le rappel du soir', icone: 'cloche' }, { cle: 'gestes', nom: 'Gestes', icone: 'cle' }],
    vue(etat) {
      const f = fenetreProduit(etat)
      return [
        tuilesDuMode('jour', f, [
          tuile({ nom: 'Parties finies', valeur: '91 %', detail: 'des parties commencées', src: 'derive' }),
          tuile({ nom: 'Score médian', valeur: '7', unite: 'sur 10', src: 'la' }),
          tuile({ nom: 'Bonnes réponses', valeur: '64 %', detail: 'laissées au temps comptées fausses', src: 'la' }),
          tuile({ nom: 'Réserve', valeur: '9 j', detail: 'd’avance · 90 questions prêtes', src: 'la' }),
        ]),
        h('div', { class: 'grille' },
          grapheDuMode('jour', f, etat, { titre: `Joueurs, ${libelleDuPas(f.pas)}`, series: [{ nom: 'joueurs', valeurs: joueursDuMode('jour', f).map(Math.round), couleur: MODE.jour.couleur, forme: 'colonnes' }] }),
          enCeMoment('Sept en partie', [
            barresCouchees([{ nom: 'Question 1 à 3', v: 2 }, { nom: 'Question 4 à 7', v: 3 }, { nom: 'Question 8 à 10', v: 2 }], { couleur: MODE.jour.couleur, format: v => String(v), max: 4 }),
            h('div', { class: 'bas-de-console' }, '96 ont joué aujourd’hui · ▲ 9 % à la même heure'),
          ]),
        ),
        h('div', { class: 'grille' },
          console_({ classe: 'l-6', etiquette: 'Entonnoir', titre: 'De l’accueil au lendemain', src: 'nouveau', corps: entonnoir([{ nom: 'Accueil ouvert', n: 142 }, { nom: 'Partie commencée', n: 105 }, { nom: 'Partie finie', n: 96 }, { nom: 'Revenu le lendemain', n: 68 }], MODE.jour.couleur) }),
          console_({ classe: 'l-6', etiquette: 'Scores', titre: 'Les scores d’aujourd’hui', src: 'la', corps: colonnes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(k => ({ nom: String(k), v: Math.round(cloche(k, 6.8, 1.7, 17) + (k === 10 ? 3 : 0)) })), { couleur: MODE.jour.couleur, unite: ' joueurs' }) }),
        ),
      ]
    },
    tirage() {
      const qs = QUESTIONS.filter(q => q.source === 'jour').slice(0, 10)
      return [
        tableau({
          id: 'tirage', triInitial: 'reussite', sensInitial: 'asc', surLigne: ouvrirQuestion,
          colonnes: [
            { cle: 'texte', nom: 'Question', classe: 'texte', rendre: q => h('span', null, q.texte, q.signalements >= 2 ? h('span', { class: 'statut veille', style: { marginLeft: '8px' } }, `${q.signalements} signalements`) : null) },
            { cle: 'categorie', nom: 'Catégorie', rendre: q => h('span', { class: 'second' }, q.categorie) },
            { cle: 'reussite', nom: 'Bonnes', n: true, rendre: q => h('span', { class: 'part' }, pct(q.reussite), h('span', { class: 'part-piste' }, h('span', { class: 'part-plein', style: { width: q.reussite + '%', background: q.reussite < 25 ? 'var(--critique)' : MODE.jour.couleur } }))) },
            { cle: 'temps', nom: 'Temps moyen', n: true, rendre: q => nombre(q.temps, 1) + ' s' },
            { cle: 'laissees', nom: 'Au temps', n: true, rendre: q => pct(3 + q.temps / 3, 0), valeur: q => q.temps },
            { cle: 'signalements', nom: 'Signalée', n: true },
          ],
          lignes: qs,
        }),
        h('div', { class: 'tableau-pied' }, h('span', null, 'Une ligne ouvre la question : ce que chaque réponse a recueilli, et ses gestes — Annuler ses points pour tous, Corriger, Retirer.'), source('la')),
      ]
    },
    classement() {
      return [
        h('div', { class: 'grille' },
          console_({
            classe: 'l-8', etiquette: 'Novembre', titre: 'Le classement du mois, tel que les joueurs le voient', src: 'la',
            corps: tableau({
              id: 'classement-jour', triInitial: 'points',
              colonnes: [
                { cle: 'rang', nom: 'Rang', n: true },
                { cle: 'nom', nom: 'Joueur', rendre: j => h('b', null, j.nom) },
                { cle: 'points', nom: 'Points', n: true, rendre: j => nombre(j.points) },
                { cle: 'serie', nom: 'Série', n: true, rendre: j => `${j.serie} j` },
                { cle: 'geste', nom: '', tri: false, rendre: () => h('button', { type: 'button', class: 'bouton', style: { padding: '4px 10px' } }, 'Masquer') },
              ],
              lignes: JOUEURS.slice(0, 10).map((j, i) => ({ ...j, rang: i + 1, points: 2400 - i * 137 })),
            }),
          }),
          console_({ classe: 'l-4', etiquette: 'Séries', titre: 'Les séries qui tiennent', src: 'la', corps: colonnes([['1–6', 41], ['7–13', 22], ['14–29', 17], ['30–59', 9], ['60+', 4]].map(([nom, v]) => ({ nom, v })), { couleur: MODE.jour.couleur, unite: ' joueurs' }) }),
        ),
      ]
    },
    rappel() {
      const sept = Array.from({ length: 7 }, (_, i) => minuit(T0) - (6 - i) * JOUR + 18 * HEURE)
      return [
        h('div', { class: 'tuiles t-5' },
          tuile({ nom: 'Téléphones abonnés', valeur: '74', ecart: 6, src: 'la' }),
          tuile({ nom: 'Envoyés ce soir', valeur: '70', detail: '4 avaient déjà joué', src: 'la' }),
          tuile({ nom: 'Échecs', valeur: '2', detail: '1 abonnement défait', src: 'la' }),
          tuile({ nom: 'Ouverts', valeur: '44 %', detail: 'un toucher sur la notification', src: 'nouveau' }),
          tuile({ nom: 'Joué après le rappel', valeur: '31 %', detail: 'dans l’heure', src: 'nouveau' }),
        ),
        h('div', { class: 'grille' },
          console_({ classe: 'l-12', etiquette: 'Les tournées', titre: 'Les sept derniers soirs', src: 'la', droite: legende([{ nom: 'envoyés', couleur: MODE.jour.couleur }, { nom: 'ouverts', couleur: '#f0a27f' }]), corps: grapheTemps({ f: { debut: sept[0] - 18 * HEURE, fin: T0, duree: 7 * JOUR, pas: JOUR, t: sept.map(t => minuit(t)) }, hauteur: 170, empile: false, series: [{ nom: 'envoyés', valeurs: [61, 63, 66, 66, 68, 71, 70], couleur: MODE.jour.couleur, forme: 'colonnes' }, { nom: 'ouverts', valeurs: [24, 29, 27, 31, 30, 33, 31], couleur: '#f0a27f', forme: 'ligne' }] }) }),
        ),
      ]
    },
    gestes() {
      return [cartesDActions([
        { nom: 'Annuler une question pour tous', detail: '« Quel ingrédient donne sa couleur au risotto alla milanese ? » — 18 % de bonnes, 3 signalements. Ses points disparaissent pour tous ; rien ne la rend.', bouton: 'Annuler ses points…', danger: true },
        { nom: 'Retirer de la réserve', detail: 'Une question prête qui ne doit pas sortir.', bouton: 'Retirer…' },
        { nom: 'Masquer du classement', detail: 'Depuis le classement du mois ; il vaut aussi pour celui des duels.', bouton: 'Ouvrir le classement' },
      ])]
    },
  },

  // ── La campagne ──
  campagne: {
    titre: 'La campagne',
    chapo: 'Les séries, les sentiers du savoir et leurs paliers, les parcours de thème, les révisions et le défi de la semaine. Le Cabinet a désormais sa page.',
    onglets: [{ cle: 'vue', nom: 'Tableau de bord', icone: 'poste' }, { cle: 'sentiers', nom: 'Les sentiers', icone: 'campagne' }, { cle: 'defi', nom: 'Le défi', icone: 'couronne' }, { cle: 'gestes', nom: 'Gestes', icone: 'cle' }],
    vue(etat) {
      const f = fenetreProduit(etat)
      const sous = [['Séries', 0.36], ['Sentiers', 0.3], ['Parcours de thème', 0.12], ['Révisions', 0.1], ['Défi de la semaine', 0.12]]
      const parties = serieDuMode('campagne', f)
      return [
        tuilesDuMode('campagne', f, [
          tuile({ nom: 'Paliers validés', valeur: '20', detail: '15 du premier coup', src: 'la' }),
          tuile({ nom: 'Réussite', valeur: '61 %', detail: 'des réponses', src: 'la' }),
          tuile({ nom: 'Vies achetées', valeur: '6', detail: '31 perdues', src: 'la' }),
          tuile({ nom: 'Défi de la semaine', valeur: '24', detail: 'joueurs · meilleur 10/10', src: 'la' }),
        ]),
        h('div', { class: 'grille' },
          grapheDuMode('campagne', f, etat),
          enCeMoment('Quatorze en partie', barresCouchees([{ nom: 'Sentiers', v: 6 }, { nom: 'Séries', v: 4 }, { nom: 'Défi', v: 2 }, { nom: 'Parcours', v: 1 }, { nom: 'Révisions', v: 1 }], { couleur: MODE.campagne.couleur, format: v => String(v), max: 7 })),
        ),
        h('div', { class: 'grille' },
          sous.map(([nom, p], k) => {
            const lecture = h('div', { class: 'lecture' })
            return console_({ classe: k < 3 ? 'l-4' : 'l-6', etiquette: 'Ce qu’on joue', titre: nom, lecture, corps: grapheTemps({ f, hauteur: 110, lecture, groupe: 'campagne', margeGauche: 38, series: [{ nom: 'parties', valeurs: parties.map((v, i) => Math.round(v * p * (1 + 0.2 * bruit('sous' + k, i)))), couleur: MODE.campagne.couleur, forme: 'colonnes' }] }) })
          }),
        ),
      ]
    },
    sentiers() {
      const cats = ['Culture générale', 'Histoire', 'Géographie', 'Sciences', 'Nature', 'Cinéma & séries', 'Musique', 'Arts & lettres', 'Sport', 'Cuisine', 'Jeux & pop culture', 'Autour de la fête']
      const vals = cats.map((c, i) => Array.from({ length: 12 }, (_, p) => borner(0.86 - p * 0.055 + 0.07 * bruit('sentier' + i, p) - (i === 9 ? 0.08 : 0), 0.08, 0.97)))
      return [
        h('div', { class: 'grille' },
          console_({
            classe: 'l-12', etiquette: 'Palier par palier', titre: 'La chance d’un essai, sur ce que les joueurs trouvent vraiment', sous: 'Chaque case : un palier d’un sentier ; le toucher dit son mélange et ce que l’estimation en attend.', src: 'la',
            droite: h('button', { type: 'button', class: 'bouton' }, 'Régler le mélange d’un palier…'),
            corps: chaleur({
              lignes: cats, colonnes: Array.from({ length: 12 }, (_, p) => `P${p + 1}`), valeurs: vals, largeurNom: 128, hauteurCase: 26,
              ecrire: (i, p) => pct(vals[i][p] * 100),
              texte: (i, p) => ({ titre: `${cats[i]} · palier ${p + 1}`, valeur: pct(vals[i][p] * 100), nom: 'des essais validés', note: `Mélange : ${9 - Math.floor(p / 3)} faciles, ${5 + Math.floor(p / 4)} moyennes, ${2 + Math.floor(p / 4)} difficiles · ${Math.round(40 - p * 2.5)} essais depuis le dernier réglage` }),
              legendeBas: 'dur', legendeHaut: 'facile',
            }),
          }),
        ),
        h('div', { class: 'grille' },
          console_({ classe: 'l-6', etiquette: 'Entonnoir', titre: 'Une épreuve de sentier', src: 'derive', corps: entonnoir([{ nom: 'Commencée', n: 412 }, { nom: 'Finie', n: 371, perte: 'arrêtées en route' }, { nom: 'Validée (10 sur 16)', n: 233 }, { nom: 'Trois étoiles', n: 61 }], MODE.campagne.couleur) }),
          console_({ classe: 'l-6', etiquette: 'Vies', titre: 'Perdues et achetées', src: 'la', corps: colonnes(['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'].map((nom, i) => ({ nom, v: [4, 6, 3, 5, 7, 4, 2][i] })), { couleur: MODE.campagne.couleur, unite: ' vies perdues' }) }),
        ),
      ]
    },
    defi() {
      return [
        h('div', { class: 'tuiles t-4' },
          tuile({ nom: 'Joueurs', valeur: '24', detail: '20 tentatives finies', src: 'la' }),
          tuile({ nom: 'Meilleur score', valeur: '10', detail: 'Nathan · aujourd’hui à 22 h 33', src: 'la' }),
          tuile({ nom: 'Score médian', valeur: '5', src: 'la' }),
          tuile({ nom: 'Semaine dernière', valeur: '32', detail: 'joueurs · 2 vainqueurs ex aequo', src: 'la' }),
        ),
        h('div', { class: 'grille' },
          console_({ classe: 'l-6', etiquette: 'Les scores', titre: 'Les tentatives finies', src: 'la', corps: colonnes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(k => ({ nom: String(k), v: [0, 1, 0, 1, 1, 5, 3, 5, 1, 2, 1][k] })), { couleur: MODE.campagne.couleur, unite: ' tentatives' }) }),
          console_({ classe: 'l-6', etiquette: 'Les plus ratées', titre: 'Sur cinq réponses au moins', src: 'la', corps: barresCouchees([{ nom: 'Q9 · Combien de cœurs a une pieuvre ?', v: 0 }, { nom: 'Q7 · Quelle planète a le plus de lunes ?', v: 18 }, { nom: 'Q6 · Combien dure un match de handball ?', v: 30 }], { couleur: MODE.campagne.couleur, max: 100 }) }),
        ),
      ]
    },
    gestes() {
      return [cartesDActions([
        { nom: 'Régler le mélange d’un palier', detail: 'Combien de faciles, de moyennes, de difficiles — seize en tout, pour les douze sentiers ensemble. Seules les épreuves qui commencent le tirent.', bouton: 'Régler…' },
        { nom: 'Reclasser une question contredite', detail: '14 questions dont les réponses disent une autre marche que la leur.', bouton: 'Ouvrir les questions', },
        { nom: 'Libérer une épreuve', detail: 'Depuis la fiche du joueur : l’épreuve se referme comme un rejeu, sans coûter une vie.', bouton: 'Chercher un profil' },
      ])]
    },
  },

  // ── Le Cabinet de curiosités ──
  cabinet: {
    neuf: true,
    titre: 'Le Cabinet de curiosités',
    chapo: 'La traversée en trois actes : ses dix jeux, ses dix cartes, ses gardiens, son marchand, le légendaire au bout. Ouvert à tous le 31 octobre ; ses parties comptaient jusqu’ici dans la campagne.',
    droite: () => [h('span', { class: 'statut ok' }, icone('ok'), 'Ouvert à tous'), h('span', { class: 'statut neuf' }, icone('etincelles'), 'À l’affiche jusqu’au 8 nov.')],
    onglets: [{ cle: 'vue', nom: 'Tableau de bord', icone: 'poste' }, { cle: 'jeux', nom: 'Les dix jeux', icone: 'questions', compte: 10 }, { cle: 'cartes', nom: 'Cartes et gardiens', icone: 'carte' }, { cle: 'contenu', nom: 'Le contenu', icone: 'reserve' }, { cle: 'joueurs', nom: 'Les joueurs', icone: 'joueurs' }, { cle: 'gestes', nom: 'Gestes', icone: 'cle' }],
    vue(etat) {
      const f = fenetreProduit(etat)
      const jours = f.pas >= JOUR
      const commencees = jours ? f.t.map(t => traverseesDuJour(t)) : f.t.map(t => Math.round(integrer(u => partiesParHeure('cabinet', u) / 9, 'trav', t, f.pas)))
      const gagnees = commencees.map((v, i) => Math.round(v * (0.2 + 0.05 * hasard('gagne', i))))
      const abandonnees = commencees.map((v, i) => Math.round(v * (0.17 + 0.05 * hasard('aband', i))))
      const perdues = commencees.map((v, i) => Math.max(0, v - gagnees[i] - abandonnees[i]))
      const total = somme(commencees)
      return [
        h('div', { class: 'tuiles' },
          tuile({ nom: 'Joueurs', valeur: nombre(Math.round(total * 0.48) + 3), detail: 'un profil une fois', src: 'derive', cle: MODE.cabinet.couleur }),
          tuile({ nom: 'Traversées commencées', valeur: nombre(total), courbe: douze(commencees), couleur: MODE.cabinet.couleur, detail: 'depuis l’ouverture', src: 'la' }),
          tuile({ nom: 'Gagnées', valeur: pct(total ? (somme(gagnees) / total) * 100 : 0), detail: `${nombre(somme(gagnees))} légendaires choisis`, src: 'la' }),
          tuile({ nom: 'Abandonnées', valeur: pct(total ? (somme(abandonnees) / total) * 100 : 0), detail: 'quittées avant le bout', src: 'la' }),
          tuile({ nom: 'Une traversée', valeur: '21 min', detail: 'médiane, de départ en fin', src: 'derive' }),
          tuile({ nom: 'Épreuves jouées', valeur: nombre(Math.round(total * 9.2)), detail: '9 par traversée', src: 'la' }),
        ),
        h('div', { class: 'grille' },
          grapheDuMode('cabinet', f, etat, {
            etiquette: 'Traversées', titre: `Traversées commencées, ${libelleDuPas(f.pas)}`, empile: true,
            legende: [{ nom: 'gagnées', couleur: '#b8b0ff' }, { nom: 'perdues', couleur: '#7a6fd8' }, { nom: 'abandonnées', couleur: '#4a4290' }],
            series: [{ nom: 'gagnées', valeurs: gagnees, couleur: '#b8b0ff' }, { nom: 'perdues', valeurs: perdues, couleur: '#7a6fd8' }, { nom: 'abandonnées', valeurs: abandonnees, couleur: '#4a4290' }],
            bas: h('span', null, '◆ 31 oct. : ouvert à tous · ◆ 1er nov. : son affiche sur chaque accueil. Avant, quelques testeurs.'),
          }),
          enCeMoment('Quatre traversées en route', h('div', { class: 'cartes', style: { gridTemplateColumns: 'minmax(0, 1fr)' } },
            TRAVERSEES_EN_ROUTE.map(tr => h('div', { class: 'carte', style: { padding: '10px 12px', gap: '6px' } },
              h('div', { class: 'carte-tete' }, h('b', { style: { fontFamily: 'var(--f-ui)' } }, tr.qui), h('span', { class: 'discret mono', style: { fontSize: '11px' } }, `${tr.coeurs} ♥ · ${tr.or} or · ${tr.depuis} min`)),
              h('span', { class: 'second', style: { fontSize: '12.5px' } }, tr.ou),
              h('div', { class: 'progression' }, h('span', { style: { width: tr.progres * 100 + '%', background: 'var(--mode-cabinet)' } })),
            )),
          )),
        ),
        h('div', { class: 'grille' },
          console_({ classe: 'l-6', etiquette: 'Entonnoir', titre: 'Du départ au légendaire', src: 'derive', corps: entonnoir([{ nom: 'Traversée commencée', n: total }, { nom: 'Trois cartes choisies', n: Math.round(total * 0.977) }, { nom: 'Acte I franchi', n: Math.round(total * 0.646), perte: 'le premier gardien' }, { nom: 'Acte II franchi', n: Math.round(total * 0.354), perte: 'la Bibliothèque engloutie' }, { nom: 'Acte III franchi', n: somme(gagnees) + Math.round(total * 0.01) }, { nom: 'Légendaire choisi', n: somme(gagnees) }], MODE.cabinet.couleur) }),
          console_({ classe: 'l-6', etiquette: 'Où l’on tombe', titre: 'La fin de chaque traversée close', src: 'derive', corps: [
            barresCouchees([{ nom: 'Acte I · la Serre', v: 35 }, { nom: 'Acte II · la Bibliothèque', v: 30 }, { nom: 'Acte III · l’Observatoire', v: 13 }, { nom: 'Gagnée', v: 22 }], { couleur: MODE.cabinet.couleur }),
            h('div', { class: 'bas-de-console' }, 'L’acte II perd trois joueurs sur dix : c’est là que le Lion et l’Oracle attendent.'),
          ] }),
        ),
      ]
    },
    jeux() {
      return [
        h('div', { class: 'grille' },
          console_({ classe: 'l-12', etiquette: 'Réussite', titre: 'Chaque jeu, la part des épreuves réussies', sous: 'Une étoile au moins ; les assauts des gardiens compris.', src: 'derive', corps: colonnes(JEUX_DU_CABINET.map(j => ({ nom: j.nom.replace(/^Les |^L[ea’'] ?/, ''), v: j.reussite, detail: `${nombre(j.etoiles, 1)} étoile${j.etoiles >= 2 ? 's' : ''} en moyenne` })), { couleur: MODE.cabinet.couleur, unite: ' %', hauteur: 170, format: v => String(v) }) }),
        ),
        h('div', { class: 'bloc', style: { marginTop: '16px' } },
          tableau({
            id: 'jeux', triInitial: 'reussite', sensInitial: 'asc',
            colonnes: [
              { cle: 'nom', nom: 'Jeu', rendre: j => h('b', null, j.nom) },
              { cle: 'epreuves', nom: 'Épreuves', n: true, valeur: j => j.reussite + j.duree, rendre: j => nombre(Math.round(118 + j.duree * 9)) },
              { cle: 'reussite', nom: 'Réussite', n: true, rendre: j => h('span', { class: 'part' }, pct(j.reussite), h('span', { class: 'part-piste' }, h('span', { class: 'part-plein', style: { width: j.reussite + '%', background: j.reussite < 45 ? 'var(--veille)' : MODE.cabinet.couleur } }))) },
              { cle: 'etoiles', nom: 'Étoiles', n: true, rendre: j => nombre(j.etoiles, 1) + ' / 3' },
              { cle: 'duree', nom: 'Une manche', n: true, rendre: j => dureeMin(j.duree) },
              { cle: 'quitte', nom: '« Quitter ? »', n: true, rendre: j => pct(j.quitte) },
              { cle: 'eclairer', nom: 'Éclairer', n: true, rendre: j => pct(j.eclairer) },
              { cle: 'signal', nom: 'Signalements', n: true, rendre: j => (j.signal ? h('b', { style: { color: j.signal >= 3 ? '#ffd166' : 'var(--encre)' } }, String(j.signal)) : h('span', { class: 'discret' }, '0')) },
            ],
            lignes: JEUX_DU_CABINET,
          }),
          h('div', { class: 'tableau-pied' }, h('span', null, 'Le Filet est le plus dur (39 %) et le plus signalé : sa cible, ou sa marge, mérite un regard. Le Mot mystère fait le plus Éclairer.'), source('derive')),
        ),
      ]
    },
    cartes() {
      return [
        h('div', { class: 'grille' },
          console_({ classe: 'l-7', etiquette: 'Les dix cartes', titre: 'Choisie, et ce qu’elle rapporte', sous: 'En abscisse, la part des traversées qui l’emportent ; en ordonnée, la part de celles-là gagnées.', src: 'derive', corps: nuage(CARTES_DU_CABINET.map(c => ({ nom: c.nom, x: c.choisie, y: c.victoire, note: c.nom === 'Coup de grâce' ? 'Peu choisie, et pourtant parmi les plus gagnantes.' : null })), { xNom: 'choisie', yNom: 'gagnées', xMed: 30, yMed: 22 }) }),
          console_({ classe: 'l-5', etiquette: 'Légendaires', titre: 'Celui qu’on choisit au bout', src: 'la', corps: barresCouchees([{ nom: 'Le Dragon', v: 6 }, { nom: 'Le Sphinx', v: 5 }, { nom: 'Le Renard', v: 4 }, { nom: 'La Chouette', v: 3 }, { nom: 'Le Kraken', v: 3 }, { nom: 'L’Oracle', v: 2 }, { nom: 'Le Lion', v: 2 }, { nom: 'La Comète', v: 1 }], { couleur: MODE.cabinet.couleur, format: v => String(v) }) }),
        ),
        h('div', { class: 'grille' },
          ACTES.map((a, k) => console_({
            classe: 'l-4' + (k === 2 ? ' l-seul' : ''), etiquette: `Acte ${['I', 'II', 'III'][k]}`, titre: a.nom.split(' · ')[1], sous: 'Vaincu, et maîtrisé', src: 'derive',
            corps: barresCouchees(a.gardiens.map(([nom, v, m]) => ({ nom: m ? `${nom} · ${m} maîtrise${m > 1 ? 's' : ''}` : nom, v })), { couleur: MODE.cabinet.couleur }),
          })),
        ),
      ]
    },
    contenu() {
      return [
        h('div', { class: 'grille' },
          console_({ classe: 'l-6', etiquette: 'L’Épingle', titre: 'Les lieux qu’on place le plus mal', src: 'derive', corps: tableau({ id: 'epingle', triInitial: 'km', colonnes: [{ cle: 'lieu', nom: 'Lieu' }, { cle: 'n', nom: 'Joués', n: true }, { cle: 'km', nom: 'À côté, médiane', n: true, rendre: x => nombre(x.km) + ' km' }], lignes: [['Le pic du Midi de Bigorre', 21, 212], ['Carcassonne', 26, 148], ['Le viaduc de Millau', 19, 131], ['Les gorges du Verdon', 23, 97], ['Le Mont-Saint-Michel', 30, 39], ['La dune du Pilat', 25, 34]].map(([lieu, n, km]) => ({ lieu, n, km })) }) }),
          console_({ classe: 'l-6', etiquette: 'Les Indices', titre: 'Les fiches les moins trouvées', src: 'derive', corps: tableau({ id: 'indices', triInitial: 'trouvee', sensInitial: 'asc', colonnes: [{ cle: 'qui', nom: 'Fiche' }, { cle: 'n', nom: 'Jouées', n: true }, { cle: 'trouvee', nom: 'Trouvée', n: true, rendre: x => pct(x.trouvee) }, { cle: 'indices', nom: 'Indices lus', n: true, rendre: x => nombre(x.indices, 1) }], lignes: [['Hedy Lamarr', 14, 12, 4.6], ['Ada Lovelace', 18, 28, 4.1], ['Olympe de Gouges', 16, 31, 3.9], ['Nikola Tesla', 22, 64, 2.7], ['Frida Kahlo', 20, 71, 2.4]].map(([qui, n, trouvee, indices]) => ({ qui, n, trouvee, indices })) }) }),
        ),
        h('div', { class: 'grille' },
          console_({ classe: 'l-6', etiquette: 'La Réplique', titre: 'Les répliques qu’on ne retrouve pas', src: 'derive', corps: barresCouchees([{ nom: '« Il faut cultiver notre jardin »', v: 34 }, { nom: '« Je pense, donc je suis »', v: 52 }, { nom: '« Le cœur a ses raisons… »', v: 47 }, { nom: '« Rien ne se perd, rien ne se crée… »', v: 58 }], { couleur: MODE.cabinet.couleur }) }),
          console_({ classe: 'l-6', etiquette: 'Le Quiz', titre: 'Les thèmes qu’on joue', src: 'derive', corps: barresCouchees([{ nom: 'Histoire', v: 19 }, { nom: 'Géographie', v: 16 }, { nom: 'Cinéma & séries', v: 14 }, { nom: 'Sciences', v: 12 }, { nom: 'Musique', v: 9 }, { nom: 'Autres thèmes', v: 30 }], { couleur: MODE.cabinet.couleur }) }),
        ),
      ]
    },
    joueurs() {
      const liste = JOUEURS.slice(0, 12).map((j, i) => ({ ...j, traversees: Math.round(14 - i * 0.9 + hasard('trv', i) * 3), gagnees: Math.round(4 - i * 0.3 + hasard('trg', i) * 2), defis: Math.round(6 - i * 0.4 + hasard('trd', i) * 3) }))
      return [
        h('div', { class: 'grille' },
          console_({ classe: 'l-8', etiquette: 'Les profils', titre: 'Qui traverse le plus', src: 'derive', corps: tableau({ id: 'cabinet-joueurs', triInitial: 'traversees', surLigne: ouvrirFiche, colonnes: [{ cle: 'nom', nom: 'Joueur', rendre: j => h('b', null, j.nom) }, { cle: 'traversees', nom: 'Traversées', n: true }, { cle: 'gagnees', nom: 'Gagnées', n: true }, { cle: 'defis', nom: 'Défis tenus', n: true }, { cle: 'derniere', nom: 'Dernière venue', n: true, rendre: j => ilYA(j.derniere, maintenant()) }], lignes: liste }) }),
          console_({ classe: 'l-4', etiquette: 'Défis des cartes', titre: 'Les rangs tenus', src: 'la', corps: [
            h('div', { class: 'segments' }, h('span', { style: { flex: '61', background: '#8f6c22' }, class: 'clair' }, 'Bronze · 61'), h('span', { style: { flex: '17', background: '#a9b5c7' } }, 'Argent · 17'), h('span', { style: { flex: '6', background: '#e8c27a' } }, '3')),
            legende([{ nom: 'Bronze · 61', couleur: '#8f6c22' }, { nom: 'Argent · 17', couleur: '#a9b5c7' }, { nom: 'Or · 3', couleur: '#e8c27a' }]),
            h('div', { class: 'bas-de-console' }, '9 épreuves de maître réussies, dont une sur le Lion.'),
          ] }),
        ),
      ]
    },
    gestes() {
      return [cartesDActions([
        { nom: 'Mettre le Cabinet en maintenance', detail: 'Sa page et son départ se ferment ; une épreuve en cours se finit. L’administrateur y entre encore.', bouton: 'Ouvrir la maintenance' },
        { nom: 'L’ouvrir à des testeurs', detail: '« Bientôt disponible » pour tous, ouvert à quelques profils.', bouton: 'Choisir des testeurs' },
        { nom: 'Poser une affiche', detail: 'Celle du 1er novembre se montre encore cinq jours : 212 ouvertes, 64 rangées.', bouton: 'Ouvrir les nouveautés' },
        { nom: 'Rendre une traversée bloquée', detail: 'Comme « Libérer une épreuve » des sentiers : la traversée se referme, rien ne se perd. À décider.', bouton: 'Chercher un profil', neuf: true },
      ])]
    },
  },

  // ── Les duels ──
  duel: {
    titre: 'Les duels',
    chapo: 'Contre Automate et contre un joueur, la cote, les ligues, le classement — et les duels classés qui attendent leur adversaire.',
    onglets: [{ cle: 'vue', nom: 'Tableau de bord', icone: 'poste' }, { cle: 'ligues', nom: 'Les ligues', icone: 'couronne' }, { cle: 'attente', nom: 'En attente', icone: 'horloge', compte: 6 }, { cle: 'gestes', nom: 'Gestes', icone: 'cle' }],
    vue(etat) {
      const f = fenetreProduit(etat)
      const tous = serieDuMode('duel', f)
      const automate = tous.map((v, i) => Math.round(v * (0.68 + 0.08 * bruit('aut', i))))
      const joueurs = tous.map((v, i) => Math.max(0, Math.round(v) - automate[i]))
      return [
        tuilesDuMode('duel', f, [
          tuile({ nom: 'Contre Automate', valeur: pct(70), detail: 'des duels joués', src: 'la' }),
          tuile({ nom: 'Classés lancés', valeur: '17', detail: '11 joués des deux côtés', src: 'la' }),
          tuile({ nom: 'En attente', valeur: '6', detail: 'le plus vieux expire dans 2 j', src: 'la' }),
          tuile({ nom: 'Expirés · 7 j', valeur: '4', detail: 'sans réponse', src: 'la' }),
        ]),
        h('div', { class: 'grille' },
          grapheDuMode('duel', f, etat, { empile: true, legende: [{ nom: 'contre un joueur', couleur: '#93bdf4' }, { nom: 'contre Automate', couleur: '#235ea8' }], series: [{ nom: 'contre Automate', valeurs: automate, couleur: '#235ea8' }, { nom: 'contre un joueur', valeurs: joueurs, couleur: '#93bdf4' }] }),
          enCeMoment('Trois duels en cours', barresCouchees([{ nom: 'Contre Automate', v: 2 }, { nom: 'Classés', v: 1 }], { couleur: MODE.duel.couleur, format: v => String(v), max: 3 })),
        ),
        h('div', { class: 'grille' },
          console_({ classe: 'l-6', etiquette: 'Entonnoir', titre: 'Un duel classé, de l’envoi au verdict', src: 'derive', corps: entonnoir([{ nom: 'Lancé', n: 64 }, { nom: 'Ouvert par l’adversaire', n: 49, perte: 'jamais ouvert' }, { nom: 'Joué des deux côtés', n: 43 }], MODE.duel.couleur) }),
          console_({ classe: 'l-6', etiquette: 'Les ligues', titre: 'Ceux que le classement compte', src: 'la', corps: colonnes(LIGUES_DUELS.map(([nom, v]) => ({ nom, v })), { couleur: MODE.duel.couleur, unite: ' joueurs' }) }),
        ),
      ]
    },
    ligues() {
      return [
        h('div', { class: 'grille' },
          console_({ classe: 'l-6', etiquette: 'Les ligues', titre: 'Des maîtres aux bronzes', src: 'la', corps: colonnes(LIGUES_DUELS.map(([nom, v]) => ({ nom, v })), { couleur: MODE.duel.couleur, unite: ' joueurs' }) }),
          console_({ classe: 'l-6', etiquette: 'La cote', titre: 'Sa répartition', src: 'derive', corps: colonnes([1000, 1050, 1100, 1150, 1200, 1250, 1300, 1350, 1400, 1450, 1500].map(c => ({ nom: String(c), v: Math.round(cloche(c, 1180, 120, 18)) })), { couleur: MODE.duel.couleur, unite: ' joueurs' }) }),
        ),
        h('div', { class: 'grille' },
          console_({ classe: 'l-12', etiquette: 'Le classement', titre: 'Ses dix premiers, tels que les joueurs le voient', src: 'la', corps: tableau({ id: 'duels-classement', triInitial: 'cote', colonnes: [{ cle: 'nom', nom: 'Joueur', rendre: j => h('b', null, j.nom) }, { cle: 'cote', nom: 'Cote', n: true }, { cle: 'ligue', nom: 'Ligue', rendre: j => LIGUES_DUELS[Math.min(5, Math.max(0, Math.floor((j.cote - 1000) / 100)))][0] }, { cle: 'geste', nom: '', tri: false, rendre: () => h('button', { type: 'button', class: 'bouton', style: { padding: '4px 10px' } }, 'Masquer') }], lignes: JOUEURS.slice(0, 10) }) }),
        ),
      ]
    },
    attente() {
      return [
        tableau({
          id: 'duels-attente', triInitial: 'expire', sensInitial: 'asc',
          colonnes: [
            { cle: 'code', nom: 'Duel', rendre: d => h('span', { class: 'mono' }, d.code) },
            { cle: 'de', nom: 'De', rendre: d => h('b', null, d.de) },
            { cle: 'a', nom: 'À' },
            { cle: 'lance', nom: 'Lancé', n: true, rendre: d => quand(d.lance, maintenant()) },
            { cle: 'expire', nom: 'Expire dans', n: true, rendre: d => dureeMin((d.expire - maintenant()) / MINUTE) },
            { cle: 'geste', nom: '', tri: false, rendre: () => h('button', { type: 'button', class: 'bouton', style: { padding: '4px 10px' } }, 'Annuler') },
          ],
          lignes: [['7KQ2', 'Arthur', 'Manon', 5.2], ['P3XD', 'Léna', 'Hugo', 4.1], ['M8RA', 'Nathan', 'Camille', 3.0], ['C2VB', 'Basile', 'Anna', 2.2], ['T9LE', 'Jade', 'Rose', 1.1], ['Q4NF', 'Gabriel', 'Paul', 0.4]].map(([code, de, a, j]) => ({ code, de, a, lance: T0 - j * JOUR, expire: T0 + (7 - j) * JOUR })),
        }),
      ]
    },
    gestes() {
      return [cartesDActions([
        { nom: 'Annuler un duel pas joué', detail: 'Il se ferme comme à son expiration ; commencé de l’autre côté, il compte déjà.', bouton: 'Voir ceux qui attendent' },
        { nom: 'Masquer du classement', detail: 'Le masque du quiz du jour vaut pour les deux classements.', bouton: 'Ouvrir le classement' },
      ])]
    },
  },
}
const LIGUES_DUELS = [['Bronze', 41], ['Argent', 33], ['Or', 22], ['Platine', 12], ['Diamant', 6], ['Maîtres', 2]]

// ── Les questions ─────────────────────────────────────────────────────

function ouvrirQuestion(q) {
  ouvrirTiroir({
    tete: [h('div', { class: 'surtitre' }, `${{ jour: 'Quiz du jour', campagne: 'Campagne', cabinet: 'Cabinet · le Quiz' }[q.source]} · ${q.categorie} · ${q.id}`), h('h2', null, q.texte)],
    corps: [
      h('div', { class: 'tuiles t-4' },
        tuile({ nom: 'Réponses', valeur: nombre(q.reponses) }),
        tuile({ nom: 'Bonnes', valeur: pct(q.reussite) }),
        tuile({ nom: 'Temps médian', valeur: nombre(q.temps, 1), unite: 's' }),
        tuile({ nom: 'Signalements', valeur: String(q.signalements) }),
      ),
      h('section', null, h('h4', null, 'Ce que chaque réponse a recueilli'),
        barresCouchees(q.choix.map((c, k) => ({ nom: (k === q.bonne ? '✓ ' : '') + c, v: q.repartition[k], couleur: k === q.bonne ? 'var(--bon)' : 'rgba(148,166,196,0.45)' })), { max: 100 }),
      ),
      h('section', null, h('h4', null, 'Sa marche'),
        h('p', { class: 'second', style: { margin: 0 } }, q.contredite ? h('span', null, 'Annoncée ', h('b', null, q.marche), ' · les réponses disent ', h('b', { style: { color: '#ffd166' } }, q.marcheObservee), '. Reclasser la propose déjà.') : h('span', null, 'Annoncée ', h('b', null, q.marche), ', et les réponses le confirment.')),
      ),
      h('section', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('button', { type: 'button', class: 'bouton' }, 'Corriger'),
        h('button', { type: 'button', class: 'bouton' + (q.contredite ? ' or' : '') }, 'Reclasser'),
        h('button', { type: 'button', class: 'bouton danger' }, q.source === 'jour' ? 'Retirer de la réserve' : 'Retirer de la campagne'),
        q.source === 'jour' ? h('button', { type: 'button', class: 'bouton danger' }, 'Annuler ses points pour tous') : null,
      ),
    ],
  }, q.texte)
}

function pageQuestions(etat) {
  const src = etat.sourceQ || 'toutes'
  const etatQ = etat.etatQ || 'toutes'
  const cherche = (etat.chercheQ || '').toLowerCase()
  let lignes = QUESTIONS
  if (src !== 'toutes') lignes = lignes.filter(q => q.source === src)
  if (etatQ === 'contredites') lignes = lignes.filter(q => q.contredite)
  if (etatQ === 'signalees') lignes = lignes.filter(q => q.signalements > 0)
  if (etatQ === 'pieges') lignes = lignes.filter(q => q.reussite < 25)
  if (cherche) lignes = lignes.filter(q => q.texte.toLowerCase().includes(cherche) || q.categorie.toLowerCase().includes(cherche))
  const champ = h('input', { id: 'cherche-question', type: 'search', placeholder: 'Un mot, une catégorie…', value: etat.chercheQ || '', 'aria-label': 'Chercher une question' })
  champ.addEventListener('input', () => {
    etat.chercheQ = champ.value
    const pos = champ.selectionStart
    rendrePage()
    const c = document.getElementById('cherche-question')
    if (c) {
      c.focus()
      c.setSelectionRange(pos, pos)
    }
  })
  return [
    tetePage({ surtitre: 'Contenu', neuf: true, titre: 'Les questions', chapo: 'Toutes les questions jouées, de tous les modes, au même endroit : ce qu’elles donnent vraiment, triées sur n’importe quelle colonne. Une ligne ouvre ses réponses et ses gestes — les mêmes qu’aux signalements.' }),
    h('div', { class: 'tuiles t-4' },
      tuile({ nom: 'Jouées sur la période', valeur: nombre(4912), detail: 'questions différentes', src: 'derive' }),
      tuile({ nom: 'Contredites', valeur: '14', detail: 'leurs réponses disent une autre marche', src: 'la' }),
      tuile({ nom: 'Pièges', valeur: '9', detail: 'moins d’un quart de bonnes', src: 'derive' }),
      tuile({ nom: 'Signalées', valeur: '3', detail: 'à relire', src: 'la' }),
    ),
    h('div', { class: 'barre-outils', style: { marginTop: '16px' } },
      h('label', { class: 'champ' }, icone('chercher'), champ),
      puces([{ cle: 'toutes', nom: 'Tous les modes' }, { cle: 'jour', nom: 'Quiz du jour', couleur: MODE.jour.couleur }, { cle: 'campagne', nom: 'Campagne', couleur: MODE.campagne.couleur }, { cle: 'cabinet', nom: 'Cabinet', couleur: MODE.cabinet.couleur }], src, c => { etat.sourceQ = c; rendrePage() }),
      puces([{ cle: 'toutes', nom: 'Toutes' }, { cle: 'contredites', nom: 'Contredites' }, { cle: 'pieges', nom: 'Pièges' }, { cle: 'signalees', nom: 'Signalées' }], etatQ, c => { etat.etatQ = c; rendrePage() }),
    ),
    tableau({
      id: 'questions', triInitial: 'reussite', sensInitial: 'asc', surLigne: ouvrirQuestion,
      colonnes: [
        { cle: 'texte', nom: 'Question', classe: 'texte', rendre: q => h('span', null, q.texte) },
        { cle: 'source', nom: 'Où', rendre: q => h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } }, h('span', { style: { width: '8px', height: '8px', borderRadius: '2px', background: MODE[q.source].couleur, display: 'inline-block' } }), { jour: 'Quiz du jour', campagne: 'Campagne', cabinet: 'Cabinet' }[q.source]) },
        { cle: 'categorie', nom: 'Catégorie', rendre: q => h('span', { class: 'second' }, q.categorie) },
        { cle: 'marche', nom: 'Marche', rendre: q => (q.contredite ? h('span', null, q.marche, h('span', { style: { color: '#ffd166' } }, ' → ' + q.marcheObservee)) : q.marche), valeur: q => MARCHES.indexOf(q.marche) },
        { cle: 'reponses', nom: 'Réponses', n: true, rendre: q => nombre(q.reponses) },
        { cle: 'reussite', nom: 'Bonnes', n: true, rendre: q => h('span', { class: 'part' }, pct(q.reussite), h('span', { class: 'part-piste' }, h('span', { class: 'part-plein', style: { width: q.reussite + '%', background: q.reussite < 25 ? 'var(--critique)' : 'var(--or)' } }))) },
        { cle: 'temps', nom: 'Temps', n: true, rendre: q => nombre(q.temps, 1) + ' s' },
        { cle: 'signalements', nom: 'Signal.', n: true },
        { cle: 'derniere', nom: 'Posée', n: true, rendre: q => ilYA(q.derniere, maintenant()) },
      ],
      lignes,
      vide: 'Aucune question ne correspond.',
    }),
    h('div', { class: 'tableau-pied' }, h('span', null, `${lignes.length} questions montrées · l’échantillon de la maquette ; en vrai, chaque question jouée sur la période`), source('derive')),
  ]
}

// ── Les réserves et la base ───────────────────────────────────────────

function pageReserves(etat) {
  const cats = ['Culture générale', 'Histoire', 'Géographie', 'Sciences', 'Nature', 'Cinéma & séries', 'Musique', 'Arts & lettres', 'Sport', 'Cuisine', 'Jeux & pop culture', 'Autour de la fête']
  const base = cats.map((c, i) => [180, 260, 210, 90].map((v, k) => Math.round(v * (0.6 + 0.8 * hasard('base' + i, k)) * (i === 11 ? 0.4 : 1) * (k === 3 && i === 9 ? 0.2 : 1))))
  const haut = Math.max(...base.flat())
  return [
    tetePage({ surtitre: 'Contenu', titre: 'Les réserves et la base', chapo: 'De quoi tenir : la réserve du quiz du jour, la base de la campagne par catégorie et par marche, le contenu neuf du Cabinet.' }),
    h('div', { class: 'tuiles' },
      tuile({ nom: 'Réserve du quiz du jour', valeur: '9 j', detail: 'd’avance · 90 prêtes', src: 'la' }),
      tuile({ nom: 'Base de la campagne', valeur: nombre(8420), detail: '7 912 jouables', src: 'la' }),
      tuile({ nom: 'Contredites', valeur: '14', detail: 'à reclasser', src: 'la' }),
      tuile({ nom: 'Lieux de l’Épingle', valeur: '312', src: 'la' }),
      tuile({ nom: 'Fiches des Indices', valeur: '180', src: 'la' }),
      tuile({ nom: 'Répliques', valeur: '240', src: 'la' }),
    ),
    h('div', { class: 'grille' },
      console_({
        classe: 'l-8', etiquette: 'La base de la campagne', titre: 'Catégorie par catégorie, marche par marche', sous: 'Là où une case pâlit, les sentiers et le Quiz du Cabinet tirent toujours les mêmes.', src: 'derive',
        corps: chaleur({ lignes: cats, colonnes: ['facile', 'moyenne', 'difficile', 'experte'], valeurs: base.map(l => l.map(v => v / haut)), largeurNom: 128, hauteurCase: 24, ecrire: (i, k) => String(base[i][k]), texte: (i, k) => ({ titre: `${cats[i]} · ${['facile', 'moyenne', 'difficile', 'experte'][k]}`, valeur: String(base[i][k]), nom: 'questions jouables' }), legendeBas: 'peu', legendeHaut: 'beaucoup' }),
      }),
      console_({
        classe: 'l-4', etiquette: 'Le quiz du jour', titre: 'La réserve', src: 'la',
        corps: [
          h('div', { style: { display: 'flex', justifyContent: 'center' } }, jauge(0.6, { libelle: '9 jours', sous: 'd’avance · alerte sous 3', couleur: 'var(--mode-jour)' })),
          colonnes(['mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.', 'lun.'].map((nom, i) => ({ nom, v: [20, 20, 0, 20, 20, 10, 20][i] })), { couleur: MODE.jour.couleur, hauteur: 120, unite: ' questions ajoutées' }),
          h('div', { class: 'bas-de-console' }, 'Jeudi, la routine du matin n’a rien ajouté : l’hébergeur dormait encore à 6 h 55.'),
        ],
      }),
    ),
  ]
}

// ── Les pages reprises ────────────────────────────────────────────────

const REPRISES = {
  signalements: {
    surtitre: 'Contenu', titre: 'Les signalements',
    garde: ['Une carte par question, quiz du jour et campagne mêlés, les plus signalées d’abord', 'Ses gestes : Corriger, Reclasser, Retirer, Annuler ses points, Garder', 'Les relues des trente derniers jours, chacune avec son issue', 'Le merci au joueur dont la remarque a servi'],
    change: ['Les signalements du Cabinet rejoignent la page, filtrés par jeu', 'Une question signalée s’ouvre dans le même tiroir que l’explorateur des questions', 'La pastille du rail compte aussi le Cabinet'],
  },
  catalogue: {
    surtitre: 'Contenu', titre: 'Le catalogue',
    garde: ['Les copies que les animateurs proposent à tous, relues avant d’être publiées', 'Publier, refuser, retirer'],
    change: ['Ce que chaque modèle publié est devenu : lancé combien de fois, dans combien de salons', 'Le tri par date, par auteur, par nombre de lancements'],
  },
  annonces: {
    surtitre: 'Animer', titre: 'Les annonces',
    garde: ['Un message à tous, son aperçu, des confettis pour chacun', 'Une question : un vote, une note, un mot libre', 'Retirer, clore la question'],
    change: ['Ce que l’annonce a fait : lue par combien, combien ont répondu, en combien de temps', 'Les annonces écrites à un segment de la page des joueurs (les endormis, les nouveaux) — à décider : aujourd’hui, une annonce va à tous'],
  },
  nouveautes: {
    surtitre: 'Animer', titre: 'Les nouveautés',
    garde: ['L’affiche en tête de chaque accueil, « Nouveau » sur le gros bouton', 'Sa durée, ses confettis à la première visite'],
    change: ['Son entonnoir : montrée, ouverte, rangée, page visitée — et ce que la page a gagné de joueurs, posé sur sa courbe (le losange ◆ des graphiques)'],
  },
  maintenance: {
    surtitre: 'Animer', titre: 'La maintenance',
    garde: ['Le bandeau rouge, les six pages qui se ferment, « bientôt disponible » et ses testeurs', 'L’administrateur qui entre partout'],
    change: ['Ce que la fermeture a coûté : les portes refusées (423) pendant qu’elle était posée', 'Chaque fermeture et réouverture posée sur les graphiques, comme une mise en ligne'],
  },
}
function pageReprise(cle) {
  const r = REPRISES[cle]
  return [
    tetePage({ surtitre: r.surtitre, titre: r.titre, chapo: 'Une page qui existe déjà et qui marche : elle passe au gabarit du QG 2 — la barre de commande, les tableaux triables, le tiroir —, et gagne ce qui suit.' }),
    h('div', { class: 'reprise' },
      console_({ etiquette: 'Ce qui reste', titre: 'Tel quel', src: 'la', corps: h('ul', null, r.garde.map(x => h('li', null, x))) }),
      console_({ etiquette: 'Ce qui change', titre: 'Avec le QG 2', src: 'derive', corps: h('ul', null, r.change.map(x => h('li', null, x))) }),
    ),
  ]
}
