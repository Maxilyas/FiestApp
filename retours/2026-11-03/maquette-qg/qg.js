'use strict'
// La coque du QG 2 : le rail, la barre de commande — le temps de toute la
// page, la comparaison, l'état du service —, l'adresse de chaque page
// (`#serveur-routes`), la palette de commandes (⌘K), le mur de contrôle
// qui fait tourner les pages sur un écran, et le battement du direct.

const ETAT = { page: 'poste', onglet: null, plage: '7j', perso: null, comparer: false, vuePoste: 'joueurs' }

const RAIL = [
  { groupe: 'Commande', pages: [
    { cle: 'poste', nom: 'Poste de commande', icone: 'poste', pastille: 5 },
    { cle: 'direct', nom: 'En direct', icone: 'direct', direct: true, neuf: true },
    { cle: 'alertes', nom: 'Alertes', icone: 'cloche', pastille: 3, neuf: true },
    { cle: 'journal', nom: 'Journal', icone: 'journal' },
  ] },
  { groupe: 'Audience', pages: [
    { cle: 'joueurs', nom: 'Joueurs', icone: 'joueurs', neuf: true, compte: '247' },
    { cle: 'profils', nom: 'Profils', icone: 'profil', compte: '392' },
    { cle: 'salons', nom: 'Salons', icone: 'salon', compte: '14' },
    { cle: 'economie', nom: 'Économie', icone: 'economie' },
  ] },
  { groupe: 'Modes', pages: [
    { cle: 'comparer', nom: 'Côte à côte', icone: 'comparer' },
    { cle: 'soirees', nom: 'Soirées', icone: 'soiree', mode: 'soiree', douce: 1 },
    { cle: 'jour', nom: 'Quiz du jour', icone: 'jour', mode: 'jour' },
    { cle: 'campagne', nom: 'Campagne', icone: 'campagne', mode: 'campagne' },
    { cle: 'cabinet', nom: 'Cabinet', icone: 'cabinet', mode: 'cabinet', neuf: true },
    { cle: 'duels', nom: 'Duels', icone: 'duels', mode: 'duel' },
  ] },
  { groupe: 'Contenu', pages: [
    { cle: 'questions', nom: 'Questions', icone: 'questions', neuf: true },
    { cle: 'signalements', nom: 'Signalements', icone: 'drapeau', douce: 3 },
    { cle: 'reserves', nom: 'Réserves et base', icone: 'reserve' },
    { cle: 'catalogue', nom: 'Catalogue', icone: 'catalogue' },
  ] },
  { groupe: 'Technique', pages: [
    { cle: 'serveur', nom: 'Serveur', icone: 'serveur', douce: 1 },
    { cle: 'base', nom: 'Base et miroir', icone: 'base', neuf: true },
    { cle: 'erreurs', nom: 'Erreurs', icone: 'erreur', pastille: 2 },
    { cle: 'telephones', nom: 'Téléphones', icone: 'telephone', neuf: true },
  ] },
  { groupe: 'Animer', pages: [
    { cle: 'annonces', nom: 'Annonces', icone: 'annonce' },
    { cle: 'nouveautes', nom: 'Nouveautés', icone: 'etincelles' },
    { cle: 'maintenance', nom: 'Maintenance', icone: 'maintenance' },
  ] },
]
const PAGES_DU_RAIL = RAIL.flatMap(g => g.pages.map(p => ({ ...p, groupe: g.groupe })))

const RENDUS = {
  poste: pagePoste, direct: pageDirect, alertes: pageAlertes, journal: pageJournal,
  joueurs: pageJoueurs, profils: pageProfils, salons: pageSalons, economie: pageEconomie,
  comparer: pageComparer,
  soirees: e => pageMode('soiree', e), jour: e => pageMode('jour', e), campagne: e => pageMode('campagne', e), cabinet: e => pageMode('cabinet', e), duels: e => pageMode('duel', e),
  questions: pageQuestions, signalements: () => pageReprise('signalements'), reserves: pageReserves, catalogue: () => pageReprise('catalogue'),
  serveur: pageServeur, base: pageBase, erreurs: pageErreurs, telephones: pageTelephones,
  annonces: () => pageReprise('annonces'), nouveautes: () => pageReprise('nouveautes'), maintenance: () => pageReprise('maintenance'),
}
const ONGLETS_DU_SERVEUR = ['signaux', 'routes', 'temps-reel', 'gels', 'versions']

// ── Ce que le navigateur retient (sous filet : un stockage bloqué ne casse rien) ──

function retenir(cle, valeur) {
  try {
    localStorage.setItem('qg2.' + cle, JSON.stringify(valeur))
  } catch {}
}
function relire(cle, defaut) {
  try {
    const v = localStorage.getItem('qg2.' + cle)
    return v == null ? defaut : JSON.parse(v)
  } catch {
    return defaut
  }
}

// ── L'adresse ─────────────────────────────────────────────────────────

function lireAdresse() {
  const brut = decodeURIComponent(location.hash.slice(1))
  if (!brut) return { page: 'poste', onglet: null }
  const i = brut.indexOf('-')
  const page = i < 0 ? brut : brut.slice(0, i)
  if (!RENDUS[page]) return { page: 'poste', onglet: null }
  return { page, onglet: i < 0 ? null : brut.slice(i + 1) }
}
function ecrireAdresse() {
  const voulue = '#' + ETAT.page + (ETAT.onglet && ETAT.onglet !== 'vue' && ETAT.onglet !== 'signaux' ? '-' + ETAT.onglet : '')
  if (location.hash !== voulue) history.replaceState(null, '', voulue)
}

function aller(page, onglet = null) {
  ETAT.page = page
  ETAT.onglet = onglet
  document.body.classList.remove('rail-ouvert')
  ecrireAdresse()
  rendreTout(true)
  window.scrollTo(0, 0)
  document.getElementById('page').focus({ preventScroll: true })
}

// ── Le rail ───────────────────────────────────────────────────────────

function rendreRail() {
  const rail = document.getElementById('rail')
  rail.replaceChildren(
    h('div', { class: 'marque' },
      h('span', { class: 'marque-logo', 'aria-hidden': 'true' }, 'QG'),
      h('span', { class: 'marque-nom' }, 'Le QG', h('small', null, 'Salle de contrôle')),
      h('span', { class: 'env' }, 'PROD'),
    ),
    h('button', { type: 'button', class: 'rail-recherche', onClick: ouvrirPalette }, icone('chercher'), 'Aller à…', h('kbd', null, '⌘K')),
    ...RAIL.map(g =>
      h('div', { class: 'rail-groupe' },
        h('span', { class: 'rail-titre' }, g.groupe),
        g.pages.map(p =>
          h('a', { class: 'rail-lien', href: '#' + p.cle, 'aria-current': ETAT.page === p.cle ? 'page' : null, onClick: e => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); aller(p.cle) } },
            p.mode ? h('span', { style: { position: 'relative', display: 'inline-grid' } }, icone(p.icone), h('span', { style: { position: 'absolute', right: '-3px', bottom: '-2px', width: '6px', height: '6px', borderRadius: '50%', background: MODE[p.mode].couleur, boxShadow: '0 0 0 2px #0b0f18' } })) : icone(p.icone),
            p.nom,
            h('span', { class: 'fin' },
              p.neuf ? h('span', { class: 'neuf' }, 'NEUF') : null,
              p.direct ? h('span', { class: 'pouls' }) : null,
              p.pastille ? h('span', { class: 'pastille' }, String(p.pastille), h('span', { class: 'sr' }, ' à traiter')) : null,
              p.douce ? h('span', { class: 'pastille douce' }, String(p.douce)) : null,
              p.compte && !p.pastille && !p.douce ? h('span', { class: 'compte' }, p.compte) : null,
            ),
          ),
        ),
      ),
    ),
    h('div', { class: 'rail-pied' },
      h('a', { class: 'rail-lien', href: '#mur', onClick: e => { e.preventDefault(); basculerLeMur() } }, icone('ecran'), 'Mur de contrôle'),
      h('a', { class: 'rail-lien', href: '#poste', onClick: e => e.preventDefault() }, icone('droite'), 'Mon compte'),
    ),
  )
}

// ── La barre de commande ──────────────────────────────────────────────

function rendreCommande() {
  const barre = document.getElementById('commande')
  const p = PAGES_DU_RAIL.find(x => x.cle === ETAT.page)
  const fraicheur = h('span', { class: 'fraicheur', id: 'fraicheur', title: 'La dernière relecture des chiffres de la page' }, h('span', { class: 'pouls' }), 'à l’instant')
  barre.replaceChildren(
    h('button', { type: 'button', class: 'bouton-menu', 'aria-label': 'Les pages du QG', onClick: () => document.body.classList.toggle('rail-ouvert') }, icone('menu')),
    h('div', { class: 'ariane' }, h('span', { class: 'outil-large' }, p.groupe), h('span', { class: 'outil-large', 'aria-hidden': 'true' }, '›'), h('b', null, p.nom)),
    h('div', { class: 'plages', role: 'group', 'aria-label': 'La période de toute la page' },
      PLAGES.map(pl =>
        h('button', { type: 'button', class: pl.cle === 'direct' ? 'direct' : null, 'aria-pressed': String(!ETAT.perso && ETAT.plage === pl.cle), onClick: () => { ETAT.plage = pl.cle; ETAT.perso = null; rendreTout() } },
          pl.cle === 'direct' ? h('span', { class: 'pouls' }) : null, pl.nom),
      ),
      ETAT.perso
        ? h('button', { type: 'button', 'aria-pressed': 'true', title: 'Revenir à la période d’avant le zoom', onClick: () => { ETAT.perso = null; rendreTout() } }, icone('zoom'), `${jourCourt(ETAT.perso.debut)} ${heureEcrite(ETAT.perso.debut)} → ${heureEcrite(ETAT.perso.fin)}`, icone('fermer'))
        : h('button', { type: 'button', title: 'Glisser sur un graphique pour choisir une période', onClick: () => notifier('Glissez sur un graphique du temps : la période choisie s’applique à toute la page.') }, icone('zoom'), 'Perso'),
    ),
    h('button', { type: 'button', class: 'bascule outil-large', 'aria-pressed': String(ETAT.comparer), 'aria-label': 'Comparer à la période d’avant', title: 'Comparer à la période d’avant : chaque courbe la montre en filet, chaque tuile dit son écart', onClick: () => { ETAT.comparer = !ETAT.comparer; rendreTout() } }, h('span', { class: 'interrupteur' }), h('span', { class: 'outil-large' }, 'Comparer')),
    h('div', { class: 'commande-droite' },
      fraicheur,
      h('a', { class: 'etat', href: '#alertes', onClick: e => { e.preventDefault(); aller('alertes') } }, h('span', { class: 'voyant critique' }), '3 alertes'),
      h('button', { type: 'button', class: 'icone-bouton outil-ecran', 'aria-label': 'Aller à… (⌘K)', onClick: ouvrirPalette }, icone('chercher')),
      h('button', { type: 'button', class: 'icone-bouton outil-ecran outil-large', 'aria-label': 'Mur de contrôle', title: 'Mur de contrôle : les pages tournent seules', onClick: basculerLeMur }, icone('ecran')),
    ),
  )
}

// ── Rendre ────────────────────────────────────────────────────────────

let derniereRelecture = Date.now()
function rendrePage(arrivee = false) {
  const page = document.getElementById('page')
  const y = window.scrollY
  liberer()
  oublierLesViseurs()
  ETAT.surTic = null
  if (ETAT.page === 'serveur' && ETAT.onglet && !ONGLETS_DU_SERVEUR.includes(ETAT.onglet)) ETAT.onglet = null
  page.replaceChildren(...RENDUS[ETAT.page](ETAT).flat(Infinity).filter(Boolean))
  page.classList.toggle('recharge', arrivee)
  if (arrivee) setTimeout(() => page.classList.remove('recharge'), 260)
  if (!arrivee) window.scrollTo(0, y)
  derniereRelecture = Date.now()
  ecrireAdresse()
}
function rendreTout(arrivee = false) {
  rendreRail()
  rendreCommande()
  rendrePage(arrivee)
}

// ── Le battement : le direct toutes les deux secondes, la fraîcheur ──

setInterval(() => {
  if (document.hidden) return
  if (ETAT.surTic) ETAT.surTic()
  else if (ETAT.plage === 'direct' && !ETAT.perso && ['serveur', 'base', 'erreurs', 'poste'].includes(ETAT.page) && Date.now() - derniereRelecture > 5000 && !document.getElementById('calques').children.length) rendrePage()
  const f = document.getElementById('fraicheur')
  if (f) {
    const s2 = Math.round((Date.now() - derniereRelecture) / 1000)
    f.lastChild.textContent = ETAT.surTic || ETAT.plage === 'direct' ? 'en direct' : s2 < 5 ? 'à l’instant' : `il y a ${s2} s`
  }
}, 2000)

// ── La palette de commandes ───────────────────────────────────────────

const sansAccents = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
function choixDeLaPalette() {
  const choix = []
  for (const p of PAGES_DU_RAIL) choix.push({ groupe: 'Pages', nom: p.nom, detail: p.groupe, icone: p.icone, faire: () => aller(p.cle) })
  for (const [cle, nom] of [['routes', 'Les routes'], ['temps-reel', 'Le temps réel'], ['gels', 'Ce qui gèle'], ['versions', 'Les versions']]) choix.push({ groupe: 'Pages', nom: `Serveur › ${nom}`, detail: 'Technique', icone: 'serveur', faire: () => aller('serveur', cle) })
  for (const [cle, nom] of [['jeux', 'Les dix jeux'], ['cartes', 'Cartes et gardiens'], ['contenu', 'Le contenu']]) choix.push({ groupe: 'Pages', nom: `Cabinet › ${nom}`, detail: 'Modes', icone: 'cabinet', faire: () => aller('cabinet', cle) })
  choix.push({ groupe: 'Pages', nom: 'Campagne › Les sentiers', detail: 'Modes', icone: 'campagne', faire: () => aller('campagne', 'sentiers') })
  for (const a of [
    ['Passer en direct', 'direct', () => { ETAT.plage = 'direct'; ETAT.perso = null; rendreTout() }],
    ['Voir les trente derniers jours', 'horloge', () => { ETAT.plage = '30j'; ETAT.perso = null; rendreTout() }],
    ['Comparer à la période d’avant', 'comparer', () => { ETAT.comparer = !ETAT.comparer; rendreTout() }],
    ['Lancer le mur de contrôle', 'ecran', basculerLeMur],
    ['Faire une annonce à tous', 'annonce', () => aller('annonces')],
    ['Fermer une page en maintenance', 'maintenance', () => aller('maintenance')],
    ['Montrer d’où viennent les chiffres', 'info', basculerLesSources],
  ]) choix.push({ groupe: 'Actions', nom: a[0], icone: a[1], faire: a[2] })
  for (const j of JOUEURS) choix.push({ groupe: 'Profils', nom: j.nom, detail: j.pseudo, icone: 'profil', faire: () => ouvrirFiche(j) })
  for (const r of ROUTES) choix.push({ groupe: 'Routes', nom: r.r, mono: true, icone: 'serveur', faire: () => { aller('serveur', 'routes'); ETAT.chercheRoute = r.r.split(' ')[1]; rendrePage() } })
  for (const q of QUESTIONS) choix.push({ groupe: 'Questions', nom: q.texte, detail: q.categorie, icone: 'questions', faire: () => ouvrirQuestion(q) })
  return choix
}
function ouvrirPalette() {
  const calques = document.getElementById('calques')
  if (calques.querySelector('.palette')) return
  const tous = choixDeLaPalette()
  let visibles = []
  let choisi = 0
  const champ = h('input', { id: 'palette-champ', placeholder: 'Une page, un profil, une route, une question…', 'aria-label': 'Aller à', autocomplete: 'off', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palette-liste' })
  const liste = h('ul', { class: 'palette-liste', id: 'palette-liste', role: 'listbox' })
  const avant = document.activeElement
  const fermer = () => {
    calques.replaceChildren()
    document.getElementById('app').inert = false
    if (avant && avant.focus) avant.focus()
  }
  const dessiner = () => {
    const q = sansAccents(champ.value.trim())
    visibles = (q ? tous.filter(c => sansAccents(c.nom + ' ' + (c.detail || '')).includes(q)) : tous.filter(c => c.groupe === 'Pages' || c.groupe === 'Actions')).slice(0, 40)
    choisi = Math.min(choisi, Math.max(0, visibles.length - 1))
    const items = []
    let groupe = null
    visibles.forEach((c, i) => {
      if (c.groupe !== groupe) {
        groupe = c.groupe
        items.push(h('li', { class: 'palette-groupe', role: 'presentation' }, groupe))
      }
      items.push(h('li', { class: 'palette-choix', role: 'option', id: 'choix-' + i, 'aria-selected': String(i === choisi), onClick: () => { fermer(); c.faire() }, onPointermove: () => { if (choisi !== i) { choisi = i; dessiner() } } },
        icone(c.icone), h('span', { class: c.mono ? 'mono' : null, style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, c.nom), c.detail ? h('small', null, c.detail) : null))
    })
    liste.replaceChildren(...(items.length ? items : [h('li', { class: 'palette-vide' }, 'Rien ne correspond.')]))
    champ.setAttribute('aria-activedescendant', visibles.length ? 'choix-' + choisi : '')
    liste.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }
  champ.addEventListener('input', () => { choisi = 0; dessiner() })
  champ.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); choisi = Math.min(visibles.length - 1, choisi + 1); dessiner() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); choisi = Math.max(0, choisi - 1); dessiner() }
    else if (e.key === 'Enter' && visibles[choisi]) { e.preventDefault(); const c = visibles[choisi]; fermer(); c.faire() }
    else if (e.key === 'Escape') { e.preventDefault(); fermer() }
  })
  calques.replaceChildren(
    h('div', { class: 'voile', onClick: fermer }),
    h('div', { class: 'palette', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Aller à' },
      h('div', { class: 'palette-champ' }, icone('chercher'), champ, h('span', { class: 'kbd' }, 'Échap')),
      liste,
      h('div', { class: 'palette-pied' }, h('span', null, '↑ ↓ choisir'), h('span', null, '⏎ ouvrir'), h('span', null, '⌘K ou / partout')),
    ),
  )
  document.getElementById('app').inert = true
  dessiner()
  champ.focus()
}

document.addEventListener('keydown', e => {
  const tape = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')
  if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    ouvrirPalette()
  } else if (e.key === '/' && !tape) {
    e.preventDefault()
    ouvrirPalette()
  } else if (e.key === 'Escape' && document.body.classList.contains('mur')) basculerLeMur()
})

// ── Le mur de contrôle ────────────────────────────────────────────────

const PAGES_DU_MUR = [['poste', null], ['direct', null], ['serveur', null], ['cabinet', null], ['joueurs', null]]
let mur = null
function basculerLeMur() {
  if (mur) {
    clearInterval(mur.tour)
    mur.barre.remove()
    mur.sortir.remove()
    mur = null
    document.body.classList.remove('mur')
    return rendreTout()
  }
  document.body.classList.add('mur')
  const avance = h('span')
  mur = {
    i: 0, depuis: Date.now(),
    barre: h('div', { class: 'mur-avance', 'aria-hidden': 'true' }, avance),
    sortir: h('button', { type: 'button', class: 'bouton mur-sortir', onClick: basculerLeMur }, icone('fermer'), 'Quitter le mur'),
  }
  document.body.append(mur.barre, mur.sortir)
  aller(...PAGES_DU_MUR[0])
  mur.tour = setInterval(() => {
    const part = (Date.now() - mur.depuis) / 20000
    avance.style.width = Math.min(100, part * 100) + '%'
    if (part >= 1) {
      mur.i = (mur.i + 1) % PAGES_DU_MUR.length
      mur.depuis = Date.now()
      aller(...PAGES_DU_MUR[mur.i])
    }
  }, 250)
}

// ── Les sources des chiffres, le bandeau ──────────────────────────────

function basculerLesSources() {
  const on = !document.body.classList.contains('avec-sources')
  document.body.classList.toggle('avec-sources', on)
  document.getElementById('bouton-sources').setAttribute('aria-pressed', String(on))
  document.getElementById('bouton-sources').textContent = on ? 'Cacher les sources' : 'Montrer d’où viennent les chiffres'
  retenir('sources', on)
}
document.getElementById('bouton-sources').addEventListener('click', basculerLesSources)
document.getElementById('bandeau-fermer').addEventListener('click', () => {
  document.getElementById('bandeau').hidden = true
  retenir('bandeau', false)
})
if (relire('bandeau', true) === false) document.getElementById('bandeau').hidden = true
if (relire('sources', false)) basculerLesSources()

// ── Le départ ─────────────────────────────────────────────────────────

window.addEventListener('hashchange', () => {
  const a = lireAdresse()
  if (a.page !== ETAT.page || a.onglet !== ETAT.onglet) {
    ETAT.page = a.page
    ETAT.onglet = a.onglet
    rendreTout(true)
  }
})
{
  const a = lireAdresse()
  ETAT.page = a.page
  ETAT.onglet = a.onglet
  rendreTout()
}
