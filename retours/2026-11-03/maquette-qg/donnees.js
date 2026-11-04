'use strict'
// Les données inventées de la maquette — à l'échelle de la production du
// début novembre 2026 : une centaine de joueurs par jour, quelques soirées
// par semaine, le soir plus fort que le matin, l'hébergeur endormi la nuit,
// le Cabinet ouvert le 31 octobre, son affiche le 1er novembre, un arrêt net
// hier à 23 h 02, une version mise en ligne hier qui a ralenti une route du
// Cabinet. Chaque chiffre est une fonction du temps : zoomer ne le change pas.

// ── L'horloge de la maquette ───────────────────────────────────────────

const ouverture = Date.now()
/** L'instant de la maquette : 22 h 41 au chargement, puis l'heure avance pour de vrai. */
const maintenant = () => T0 + (Date.now() - ouverture)

// ── Les événements : mises en ligne, réveils, arrêts, ouvertures ──────

const VERSIONS = [
  { version: 'c19f5a0', t: Date.UTC(2026, 9, 27, 9, 5), pretMs: 4200, titre: 'Les défis des cartes (préproduction d’abord)' },
  { version: '7d03b18', t: Date.UTC(2026, 9, 30, 14, 40), pretMs: 3800, titre: 'La traversée en trois actes' },
  { version: 'e2b7d44', t: Date.UTC(2026, 10, 1, 11, 20), pretMs: 3600, titre: 'Le Quiz, dixième jeu du Cabinet' },
  { version: 'a41c9e2', t: Date.UTC(2026, 10, 2, 13, 12), pretMs: 3900, titre: 'Les assauts des gardiens tirés parmi tous les jeux' },
]
const VERSION_COURANTE = VERSIONS[VERSIONS.length - 1]

/** Les moments qui expliquent une courbe : ils se posent sur chaque graphique du temps. */
const EVENEMENTS = [
  ...VERSIONS.map(v => ({ t: v.t, sorte: 'mise-en-ligne', titre: `Mise en ligne ${v.version}`, detail: `${v.titre} · prête en ${ms(v.pretMs)}` })),
  { t: Date.UTC(2026, 9, 19, 16, 30), fin: Date.UTC(2026, 9, 19, 18, 50), sorte: 'incident', titre: 'Quiz du jour en panne', detail: 'Le quiz du jour et les défis ne s’ouvraient plus · page en maintenance 2 h 20' },
  { t: Date.UTC(2026, 9, 19, 19, 5), sorte: 'annonce', titre: 'Annonce à tous', detail: '« L’incident est résolu » · +50 confettis chacun' },
  { t: Date.UTC(2026, 9, 29, 18, 40), fin: Date.UTC(2026, 9, 29, 19, 22), sorte: 'incident', titre: 'Turso lent', detail: 'Turso au-delà d’une seconde au 95ᵉ centile pendant 42 min' },
  { t: Date.UTC(2026, 9, 31, 8, 30), sorte: 'ouverture', titre: 'Le Cabinet ouvre à tous', detail: 'La traversée remplace l’Expédition' },
  { t: Date.UTC(2026, 10, 1, 9, 0), sorte: 'affiche', titre: 'Affiche « Le Cabinet de curiosités »', detail: 'En tête de chaque accueil, « Nouveau » sur son bouton · +20 confettis à la première visite' },
  { t: Date.UTC(2026, 10, 2, 22, 2), sorte: 'arret-net', titre: 'Arrêt net', detail: 'Plus un signe après 23 h 02 · la mémoire montait depuis 21 h (486 Mo)' },
  { t: Date.UTC(2026, 10, 2, 22, 4), sorte: 'redemarrage', titre: 'Redémarrage', detail: 'Après l’arrêt net · prêt en 4,1 s' },
]

// ── Le rythme d'une journée ────────────────────────────────────────────

const cloche = (x, centre, largeur, hauteur) => hauteur * Math.exp(-((x - centre) ** 2) / (2 * largeur * largeur))

/** La nuit, l'hébergeur gratuit dort — sauf la nuit d'Halloween, où une soirée a tenu jusqu'à 2 h 40. */
function endormi(t) {
  const p = paris(t)
  const hh = p.h + p.m / 60
  if (p.mois === 10 && p.jour === 1 && hh < 2.67) return false
  if (p.mois === 9 && p.jour === 31 && hh >= 0.5 && hh < 1.4) return false
  return hh >= 0.6 && hh < 6.92
}

/** L'heure qui suit un réveil : chaque premier aller-retour relit ce qu'il n'a plus en mémoire. */
function apresReveil(t) {
  const p = paris(t)
  const hh = p.h + p.m / 60
  return hh >= 6.92 && hh < 7.6
}

/** Combien de joueurs jouent à un instant, tous modes confondus (hors soirées) : la forme d'une journée. */
function rythmeSolo(t) {
  if (endormi(t)) return 0
  const p = paris(t)
  const hh = p.h + p.m / 60
  let v = 0.05 + cloche(hh, 8.3, 0.75, 0.42) + cloche(hh, 12.9, 1.0, 0.5) + cloche(hh, 18.2, 1.3, 0.42) + cloche(hh, 21.3, 1.25, 1.0)
  if (p.sem === 0) v *= 1.12
  if (p.sem === 6) v *= 1.05
  return v
}

/** La croissance lente de l'été à novembre, et le coup de fouet du Cabinet. */
function croissance(t) {
  const jours = (t - Date.UTC(2026, 7, 1)) / JOUR
  let g = 0.72 + jours * 0.0029
  if (t > Date.UTC(2026, 9, 31, 8)) g *= 1.08
  if (t > Date.UTC(2026, 10, 1, 9)) g *= 1.06
  return g
}

// ── Les soirées : une liste d'événements, pas un débit ────────────────

const SALONS = ['Karim', 'Nadia', 'Hugo', 'Léa', 'Camille', 'Sacha', 'Inès', 'Jules', 'Louise', 'Mehdi', 'Clara', 'Antoine', 'Zoé', 'Bastien']
function slugDuSalon(nom) {
  const h = empreinte('salon:' + nom).toString(36)
  return 's-' + h.slice(0, 4)
}
const SOIREES = (() => {
  const liste = []
  const debut = minuit(T0) - 95 * JOUR
  for (let j = 0; j < 96; j++) {
    const jour = debut + j * JOUR
    const sem = paris(jour + 12 * HEURE).sem
    const n = sem === 5 || sem === 6 ? 2 + Math.floor(hasard('soirees-n', j) * 2.4) : sem === 0 ? Math.floor(hasard('soirees-n', j) * 1.8) : hasard('soirees-n', j) < 0.42 ? 1 : 0
    const halloween = paris(jour + 12 * HEURE).mois === 9 && paris(jour + 12 * HEURE).jour === 31
    for (let k = 0; k < n + (halloween ? 2 : 0); k++) {
      const cle = j * 10 + k
      const heureDebut = (sem === 5 || sem === 6 ? 20.4 : 19.8) + hasard('soiree-h', cle) * 1.5
      const duree = 75 + hasard('soiree-d', cle) * 110 + (halloween ? 90 : 0)
      const invites = Math.max(3, Math.round(5 + hasard('soiree-i', cle) * 9 + (hasard('soiree-j', cle) > 0.85 ? 9 : 0) + (halloween ? 8 : 0)))
      const quiz = 1 + Math.floor(hasard('soiree-q', cle) * 3.2)
      const salon = SALONS[Math.floor(hasard('soiree-s', cle) * SALONS.length)]
      const t = jour + heureDebut * HEURE
      const essai = hasard('soiree-e', cle) < 0.06
      const enPlan = hasard('soiree-p', cle) < 0.07
      liste.push({ id: 'so' + cle, t, fin: t + duree * MINUTE, invites, quiz, salon, slug: slugDuSalon(salon), essai, issue: essai ? 'essai' : enPlan ? 'plan' : 'close', profils: Math.round(invites * (0.48 + hasard('soiree-pr', cle) * 0.22)) })
    }
  }
  // Ce soir : celle de Karim en cours, celle de Hugo laissée en plan depuis l'après-midi.
  const ceSoir = minuit(T0)
  liste.push({ id: 'so-karim', t: ceSoir + 20 * HEURE + 49 * MINUTE, fin: null, invites: 11, quiz: 2, salon: 'Karim', slug: slugDuSalon('Karim'), issue: 'en-cours', question: 12, questions: 20, profils: 6, enAttente: 3 })
  liste.push({ id: 'so-hugo', t: ceSoir + 14 * HEURE + 20 * MINUTE, fin: null, invites: 4, quiz: 1, salon: 'Hugo', slug: slugDuSalon('Hugo'), issue: 'en-plan', question: 6, questions: 15, profils: 2, enAttente: 0, dernierGeste: ceSoir + 15 * HEURE + 31 * MINUTE })
  return liste.filter(s => s.t < T0).sort((a, b) => a.t - b.t)
})()

/** Les invités connectés à un instant : ceux des soirées qui tournent. */
function invitesA(t) {
  let n = 0
  for (const s of SOIREES) {
    if (s.t > t) break
    const fin = s.fin ?? t + 1
    if (t >= s.t && t < fin && s.issue !== 'en-plan') n += s.invites * (t - s.t < 8 * MINUTE ? (t - s.t) / (8 * MINUTE) : 1)
  }
  return n
}

// ── Les modes : un débit par heure ────────────────────────────────────

const MODES = [
  { cle: 'soiree', nom: 'Soirées', couleur: 'var(--mode-soiree)', hex: '#c98500', icone: 'soiree', page: 'soirees' },
  { cle: 'campagne', nom: 'Campagne', couleur: 'var(--mode-campagne)', hex: '#199e70', icone: 'campagne', page: 'campagne' },
  { cle: 'cabinet', nom: 'Cabinet', couleur: 'var(--mode-cabinet)', hex: '#9085e9', icone: 'cabinet', page: 'cabinet' },
  { cle: 'jour', nom: 'Quiz du jour', couleur: 'var(--mode-jour)', hex: '#d95926', icone: 'jour', page: 'jour' },
  { cle: 'duel', nom: 'Duels', couleur: 'var(--mode-duel)', hex: '#3987e5', icone: 'duels', page: 'duels' },
]
const MODE = Object.fromEntries(MODES.map(m => [m.cle, m]))

/** Le Cabinet : quelques testeurs depuis le 24 octobre, ouvert le 31, son affiche le 1er novembre. */
function poidsDuCabinet(t) {
  if (t < Date.UTC(2026, 9, 24, 8)) return 0
  if (t < Date.UTC(2026, 9, 31, 8, 30)) return 0.05
  if (t < Date.UTC(2026, 10, 1, 9)) return 0.42
  const jours = (t - Date.UTC(2026, 10, 1, 9)) / JOUR
  return 0.95 - Math.min(0.25, jours * 0.08)
}

/** Les parties qui commencent par heure, mode par mode (une soirée : ses invités qui jouent). */
function partiesParHeure(mode, t) {
  if (mode === 'soiree') return invitesA(t) * 0.9
  const r = rythmeSolo(t) * croissance(t)
  const p = paris(t)
  const hh = p.h + p.m / 60
  switch (mode) {
    case 'jour':
      return r * 9.5 * (1 + cloche(hh, 8.3, 0.8, 0.9) + cloche(hh, 12.7, 0.9, 0.35))
    case 'campagne':
      return r * 7.4 * (1 + cloche(hh, 21.5, 1.4, 0.25))
    case 'cabinet':
      return r * 4.6 * poidsDuCabinet(t)
    case 'duel':
      return r * 4.2 * (1 + cloche(hh, 21.8, 1.2, 0.3))
  }
  return 0
}
/** Les questions jouées par partie, mode par mode. */
const QUESTIONS_PAR_PARTIE = { soiree: 14, jour: 10, campagne: 13, cabinet: 9, duel: 10 }

/**
 * Combien sur un seau [t, t + pas) : on intègre le débit heure par heure,
 * et un bruit propre au seau — le même seau donne toujours le même chiffre.
 */
function integrer(debit, cle, t, pas) {
  const n = pas >= JOUR ? 24 : pas >= 6 * HEURE ? 6 : 1
  const sous = pas / n
  let total = 0
  for (let i = 0; i < n; i++) {
    const milieu = t + sous * (i + 0.5)
    total += debit(milieu) * (sous / HEURE)
  }
  const amplitude = pas >= JOUR ? 0.06 : pas >= HEURE ? 0.1 : pas >= 5 * MINUTE ? 0.18 : 0.3
  return Math.max(0, total * (1 + amplitude * bruit(cle, Math.floor(t / pas))))
}

// ── Les seaux d'une plage ─────────────────────────────────────────────

const PLAGES = [
  { cle: 'direct', nom: 'Direct', duree: 15 * MINUTE, pasTech: 10 * SECONDE, pasProduit: MINUTE },
  { cle: '1h', nom: '1 h', duree: HEURE, pasTech: MINUTE, pasProduit: 5 * MINUTE },
  { cle: '24h', nom: '24 h', duree: JOUR, pasTech: 5 * MINUTE, pasProduit: HEURE },
  { cle: '7j', nom: '7 j', duree: 7 * JOUR, pasTech: HEURE, pasProduit: HEURE },
  { cle: '30j', nom: '30 j', duree: 30 * JOUR, pasTech: 6 * HEURE, pasProduit: JOUR },
  { cle: '90j', nom: '90 j', duree: 90 * JOUR, pasTech: JOUR, pasProduit: JOUR },
]
const PLAGE = Object.fromEntries(PLAGES.map(p => [p.cle, p]))

function pasPour(duree) {
  if (duree <= 20 * MINUTE) return 10 * SECONDE
  if (duree <= 2 * HEURE) return MINUTE
  if (duree <= 2 * JOUR) return 5 * MINUTE
  if (duree <= 10 * JOUR) return HEURE
  if (duree <= 40 * JOUR) return 6 * HEURE
  return JOUR
}

/** Les débuts des seaux d'une fenêtre, alignés : à l'heure, au jour de Paris. */
function seaux(debut, fin, pas) {
  let premier
  if (pas >= JOUR) premier = minuit(debut)
  else premier = Math.floor(debut / pas) * pas
  const liste = []
  for (let t = premier; t < fin; t += pas) {
    if (pas >= JOUR) t = minuit(t + 2 * HEURE)
    liste.push(t)
  }
  return liste
}

/** La fenêtre que la barre de commande a choisie : { debut, fin, pas, …}. */
function fenetre(etat, sorte = 'tech') {
  const fin = etat.perso ? etat.perso.fin : maintenant()
  const duree = etat.perso ? etat.perso.fin - etat.perso.debut : PLAGE[etat.plage].duree
  const debut = fin - duree
  const pas = etat.perso ? pasPour(duree) : sorte === 'tech' ? PLAGE[etat.plage].pasTech : PLAGE[etat.plage].pasProduit
  return { debut, fin, duree, pas, t: seaux(debut, fin, pas) }
}
/** La même fenêtre, juste avant : la période d'avant, pour comparer. */
function fenetreDAvant(f) {
  const d = f.debut - f.duree
  return { debut: d, fin: f.debut, duree: f.duree, pas: f.pas, t: f.t.map(t => t - f.duree) }
}

// ── Le serveur : ce que le relevé garde ───────────────────────────────

/** Le débit de requêtes HTTP par heure (pages, fichiers, API — ni le temps réel, ni /healthz). */
function requetesParHeure(t) {
  if (endormi(t)) return 0
  const solo = MODES.reduce((a, m) => a + (m.cle === 'soiree' ? 0 : partiesParHeure(m.cle, t)), 0)
  // Une partie solo : une trentaine d'appels d'API, plus les pages et les fichiers ; un invité : sa page, ses images.
  return 220 + solo * 44 + invitesA(t) * 14
}
const dansUnIncident = (t, sorte) => EVENEMENTS.some(e => e.sorte === sorte && e.fin && t >= e.t && t < e.fin)
/** Le soir du 2 novembre : la mémoire monte, la boucle gèle, puis l'arrêt net à 23 h 02. */
const avantLArret = t => t >= Date.UTC(2026, 10, 2, 20, 0) && t < Date.UTC(2026, 10, 2, 22, 2)
const arreteNet = t => t >= Date.UTC(2026, 10, 2, 22, 2) && t < Date.UTC(2026, 10, 2, 22, 4)

const METRIQUES = {
  requetes: {
    nom: 'Requêtes', unite: 'req', sorte: 'somme',
    seau: (t, pas) => (arreteNet(t) ? 0 : integrer(requetesParHeure, 'req', t, pas)),
  },
  refusees: {
    nom: 'Refusées (4xx)', sorte: 'somme',
    seau: (t, pas) => integrer(u => requetesParHeure(u) * 0.011, 'r4', t, pas),
  },
  erreurs: {
    nom: 'Erreurs serveur (5xx)', sorte: 'somme',
    seau: (t, pas) => {
      const n = pas >= HEURE ? Math.round(pas / HEURE) : 1
      let total = 0
      for (let i = 0; i < n; i++) {
        const u = t + (i + 0.5) * (pas / n)
        let lambda = requetesParHeure(u) * 0.00009 * (pas / n / HEURE)
        if (dansUnIncident(u, 'incident')) lambda += 30 * (pas / n / HEURE)
        if (avantLArret(u) && u > Date.UTC(2026, 10, 2, 21, 30)) lambda += 26 * (pas / n / HEURE)
        if (u > VERSION_COURANTE.t && (u > T0 - 90 * MINUTE)) lambda += 1.1 * (pas / n / HEURE)
        total += poisson(lambda, 'e5', Math.floor(u / (pas / n)))
      }
      return total
    },
  },
  p95: {
    nom: 'Temps de réponse · 95ᵉ centile', unite: 'ms', sorte: 'centile',
    point: (t, pas) => {
      if (endormi(t)) return null
      const charge = requetesParHeure(t) / 3200
      let v = 132 + 120 * charge * charge + 26 * bruit('p95', Math.floor(t / Math.max(pas, MINUTE)))
      if (apresReveil(t)) v += 420 * (1 - (paris(t).h + paris(t).m / 60 - 6.92) / 0.7)
      if (dansUnIncident(t, 'incident')) v += 1450
      if (avantLArret(t)) v += Math.max(0, (t - Date.UTC(2026, 10, 2, 20, 0)) / (122 * MINUTE)) * 2300
      if (t > VERSION_COURANTE.t) v += 18
      if (pas < 5 * MINUTE) v += 60 * bruit('p95f', Math.floor(t / pas))
      return Math.max(48, v)
    },
  },
  p50: {
    nom: 'Médiane', unite: 'ms', sorte: 'centile',
    point: (t, pas) => {
      const v = METRIQUES.p95.point(t, pas)
      return v == null ? null : v * (0.35 + 0.04 * bruit('p50', Math.floor(t / Math.max(pas, MINUTE))))
    },
  },
  turso: {
    nom: 'Turso · 95ᵉ centile', unite: 'ms', sorte: 'centile',
    point: (t, pas) => {
      if (endormi(t)) return null
      let v = 58 + 14 * bruit('turso', Math.floor(t / Math.max(pas, MINUTE))) + 10 * (requetesParHeure(t) / 3200)
      if (apresReveil(t)) v += 160
      if (dansUnIncident(t, 'incident') && t > Date.UTC(2026, 9, 29, 0)) v += 1340
      return Math.max(22, v)
    },
  },
  processeur: {
    nom: 'Processeur', unite: '% d’un cœur', sorte: 'moyenne',
    point: (t, pas) => {
      if (endormi(t)) return null
      const v = 0.6 + requetesParHeure(t) * 0.0028 + 0.35 * bruit('cpu', Math.floor(t / Math.max(pas, MINUTE)))
      return borner(v + (avantLArret(t) ? 1.6 : 0), 0.2, 10.6)
    },
  },
  memoire: {
    nom: 'Mémoire', unite: 'Mo', sorte: 'max',
    point: (t, pas) => {
      if (endormi(t)) return null
      const p = paris(t)
      const depuisReveil = Math.max(0, p.h + p.m / 60 - 6.92) + (p.h < 3 ? 17 : 0)
      let v = 148 + depuisReveil * 6.2 + requetesParHeure(t) * 0.011 + 9 * Math.sin(t / (23 * MINUTE)) + 6 * bruit('mem', Math.floor(t / Math.max(pas, 5 * MINUTE)))
      if (avantLArret(t)) v += ((t - Date.UTC(2026, 10, 2, 20, 0)) / (122 * MINUTE)) * 215
      if (t >= Date.UTC(2026, 10, 2, 22, 4) && t < Date.UTC(2026, 10, 2, 23, 30)) v = 160 + ((t - Date.UTC(2026, 10, 2, 22, 4)) / HEURE) * 30
      return Math.min(498, v)
    },
  },
  boucle: {
    nom: 'Gel de la boucle (le pire)', unite: 'ms', sorte: 'max',
    point: (t, pas) => {
      if (endormi(t)) return null
      let v = 38 + 70 * hasard('boucle', Math.floor(t / Math.max(pas, MINUTE)))
      const enSoiree = invitesA(t) > 0
      const minuteDeLHeure = paris(t).m
      if (enSoiree && (pas >= HEURE || (minuteDeLHeure >= 16 && minuteDeLHeure <= 18))) v = 2100 + 800 * hasard('gel', Math.floor(t / HEURE))
      else if (pas >= HEURE && hasard('gel-solo', Math.floor(t / HEURE)) > 0.82) v = 600 + 900 * hasard('gel-s2', Math.floor(t / HEURE))
      if (avantLArret(t)) v = Math.max(v, 3200 + 1600 * hasard('gel-a', Math.floor(t / (10 * MINUTE))))
      if (apresReveil(t)) v = Math.max(v, 820)
      return v
    },
  },
  connectes: {
    nom: 'En ligne', unite: '', sorte: 'max',
    point: t => (endormi(t) ? null : Math.round(invitesA(t) + rythmeSolo(t) * croissance(t) * 46 * (1 + 0.1 * bruit('cx', Math.floor(t / MINUTE))))),
  },
  /** Les clients du temps réel : les téléphones des invités et les écrans des soirées — le solo passe par l'API. */
  sockets: {
    nom: 'Clients du temps réel', unite: '', sorte: 'max',
    point: t => (endormi(t) ? null : Math.round(invitesA(t) * 1.04 + (invitesA(t) > 0 ? 2 : 0) + (hasard('sk', Math.floor(t / (10 * MINUTE))) > 0.7 ? 1 : 0))),
  },
  envoyes: {
    nom: 'Envoyé', unite: 'Mo', sorte: 'somme',
    seau: (t, pas) => integrer(u => requetesParHeure(u) * 0.0128, 'net', t, pas),
  },
}

/** Les valeurs d'une métrique sur une fenêtre (un tableau aligné sur ses seaux). */
function serie(cle, f) {
  const m = METRIQUES[cle]
  return f.t.map(t => {
    if (m.seau) {
      if (f.pas <= HEURE && endormi(t + f.pas / 2)) return null
      return m.seau(t, f.pas)
    }
    if (f.pas >= 6 * HEURE) {
      const vals = []
      for (let u = t; u < t + f.pas; u += HEURE) vals.push(m.point(u + HEURE / 2, HEURE))
      const v = vals.filter(x => x != null)
      if (!v.length) return null
      if (m.sorte === 'max' || m.sorte === 'centile') return m.sorte === 'centile' ? centile(v, 0.9) : max(v)
      return moyenne(v)
    }
    return m.point(t + f.pas / 2, f.pas)
  })
}

/** Une série de mode : parties (ou questions) par seau. */
function serieDuMode(mode, f, quoi = 'parties') {
  const k = quoi === 'questions' ? QUESTIONS_PAR_PARTIE[mode] : 1
  return f.t.map(t => integrer(u => partiesParHeure(mode, u) * k, 'mode-' + mode + quoi, t, f.pas))
}
/** Les joueurs uniques par seau : moins que les parties, pas proportionnels. */
function joueursDuMode(mode, f) {
  const partiesParJoueur = { soiree: 1, jour: 1, campagne: 2.3, cabinet: 2.6, duel: 1.8 }[mode]
  return serieDuMode(mode, f).map(v => v / partiesParJoueur)
}
function joueursUniques(f) {
  return f.t.map((t, i) => {
    let total = 0
    for (const m of MODES) total += integrer(u => partiesParHeure(m.cle, u), 'ju-' + m.cle, t, f.pas) / ({ soiree: 1, jour: 1, campagne: 2.3, cabinet: 2.6, duel: 1.8 }[m.cle])
    return total * (f.pas >= JOUR ? 0.62 : 0.78)
  })
}

// ── Les routes d'API ───────────────────────────────────────────────────

const FAMILLES = [
  { cle: 'joueur', nom: 'Joueur' },
  { cle: 'jour', nom: 'Quiz du jour' },
  { cle: 'campagne', nom: 'Campagne' },
  { cle: 'cabinet', nom: 'Cabinet' },
  { cle: 'duels', nom: 'Duels' },
  { cle: 'soirees', nom: 'Soirées' },
  { cle: 'qg', nom: 'QG' },
]
/** Leur part des appels de l'API, leur temps d'habitude au 95ᵉ centile, et ce qu'elles lisent. */
const ROUTES = [
  { r: 'GET /api/joueur/moi', f: 'joueur', part: 0.105, p95: 205 },
  { r: 'PUT /api/joueur/moi', f: 'joueur', part: 0.012, p95: 150 },
  { r: 'GET /api/joueur/nouveautes', f: 'joueur', part: 0.052, p95: 58 },
  { r: 'PUT /api/joueur/vus', f: 'joueur', part: 0.018, p95: 64 },
  { r: 'GET /api/joueur/missions', f: 'joueur', part: 0.031, p95: 118 },
  { r: 'POST /api/joueur/coffre', f: 'joueur', part: 0.002, p95: 380 },
  { r: 'GET /api/joueur/carte/:id', f: 'joueur', part: 0.021, p95: 112 },
  { r: 'PUT /api/joueur/compagnons/:cle', f: 'joueur', part: 0.004, p95: 132 },
  { r: 'GET /api/jour', f: 'jour', part: 0.061, p95: 128 },
  { r: 'POST /api/jour/commencer', f: 'jour', part: 0.012, p95: 236 },
  { r: 'POST /api/jour/suivante', f: 'jour', part: 0.07, p95: 84 },
  { r: 'POST /api/jour/repondre', f: 'jour', part: 0.075, p95: 142 },
  { r: 'GET /api/jour/classement', f: 'jour', part: 0.016, p95: 96 },
  { r: 'GET /api/jour/correction/:jour', f: 'jour', part: 0.009, p95: 104 },
  { r: 'POST /api/jour/sablier', f: 'jour', part: 0.001, p95: 162 },
  { r: 'POST /api/campagne/serie', f: 'campagne', part: 0.014, p95: 418 },
  { r: 'POST /api/campagne/serie/:id/reponse', f: 'campagne', part: 0.128, p95: 246 },
  { r: 'GET /api/campagne/choix', f: 'campagne', part: 0.019, p95: 152 },
  { r: 'POST /api/campagne/vies', f: 'campagne', part: 0.001, p95: 210 },
  { r: 'POST /api/campagne/defi', f: 'campagne', part: 0.003, p95: 392 },
  { r: 'POST /api/campagne/duel', f: 'duels', part: 0.006, p95: 334 },
  { r: 'GET /api/campagne/duel/:code', f: 'duels', part: 0.011, p95: 138 },
  { r: 'GET /api/cabinet/traversee', f: 'cabinet', part: 0.024, p95: 262 },
  { r: 'POST /api/cabinet/traversee', f: 'cabinet', part: 0.003, p95: 520 },
  { r: 'POST /api/cabinet/traversee/:id/geste', f: 'cabinet', part: 0.029, p95: 312, regression: 1.68, erreurs: 2 },
  { r: 'POST /api/cabinet/partie', f: 'cabinet', part: 0.01, p95: 448 },
  { r: 'POST /api/cabinet/partie/:id/geste', f: 'cabinet', part: 0.058, p95: 188 },
  { r: 'GET /api/cabinet/partie/:id/detail/:tirage/:cadrage', f: 'cabinet', part: 0.008, p95: 640 },
  { r: 'GET /s/:slug/recap.json', f: 'soirees', part: 0.006, p95: 476 },
  { r: 'GET /s/:slug/entree.json', f: 'soirees', part: 0.009, p95: 92 },
  { r: 'GET /api/admin/qg/direct', f: 'qg', part: 0.021, p95: 34 },
  { r: 'GET /api/admin/qg', f: 'qg', part: 0.0012, p95: 910 },
  { r: 'GET /api/admin/serveur', f: 'qg', part: 0.0004, p95: 1180 },
]

/** Le tableau des routes sur une fenêtre : de quoi trier sur tout. */
function tableDesRoutes(f) {
  const total = somme(serie('requetes', f)) * 0.68
  const avant = fenetreDAvant(f)
  const totalAvant = somme(serie('requetes', avant)) * 0.68
  const charge = moyenne(serie('p95', f).filter(x => x != null)) / 230 || 1
  const tempsTotal = ROUTES.reduce((a, x) => a + x.part * x.p95 * 0.42, 0)
  return ROUTES.map((x, i) => {
    const appels = Math.round(total * x.part * (1 + 0.08 * bruit('route-n', i)))
    const appelsAvant = Math.round(totalAvant * x.part * (1 + 0.08 * bruit('route-na', i)))
    const nouvelle = x.regression && f.fin > VERSION_COURANTE.t
    const facteur = nouvelle ? (f.debut > VERSION_COURANTE.t ? x.regression : 1 + (x.regression - 1) * ((f.fin - VERSION_COURANTE.t) / f.duree)) : 1
    const p95 = x.p95 * charge * facteur * (1 + 0.07 * bruit('route-p', i))
    const p95Avant = x.p95 * charge * (1 + 0.07 * bruit('route-pa', i))
    const p50 = p95 * (0.34 + 0.06 * hasard('route-m', i))
    const pire = p95 * (2.2 + 2.5 * hasard('route-x', i)) + (x.f === 'campagne' && f.duree > 2 * HEURE ? 9000 : 0)
    const e5 = Math.round(appels * 0.00006 + (nouvelle && f.fin > T0 - 2 * HEURE ? x.erreurs : 0) + (f.duree >= 7 * JOUR && x.f === 'campagne' && i === 16 ? 9 : 0))
    const e4 = Math.round(appels * (x.r.startsWith('GET /api/joueur/carte') ? 0.04 : 0.004) * (1 + bruit('route-4', i)))
    const tendance = Array.from({ length: 24 }, (_, k) => x.p95 * (1 + 0.12 * bruit('route-t' + i, k)) * (nouvelle && k >= 15 ? x.regression : 1))
    return {
      route: x.r, famille: x.f, appels, parHeure: appels / Math.max(f.duree / HEURE * (f.duree >= JOUR ? 0.74 : 1), 0.25), p50, p95, max: pire, e5, e4,
      tauxErreur: appels ? (e5 / appels) * 100 : 0,
      temps: (appels * p95 * 0.42) / 1000,
      part: (x.part * x.p95 * 0.42) / tempsTotal,
      ecart: ((p95 - p95Avant) / p95Avant) * 100,
      appelsAvant, tendance, regression: nouvelle ? x.regression : null,
    }
  })
}

// ── Le temps réel : les messages des sockets ──────────────────────────

const EVENEMENTS_TEMPS_REEL = [
  { e: 'player:action', part: 0.52, p95: 6, nom: 'Réponses et gestes des invités' },
  { e: 'player:join', part: 0.06, p95: 14, nom: 'Un invité se présente' },
  { e: 'player:reprendre', part: 0.004, p95: 22, nom: 'Reprendre une fiche' },
  { e: 'party:watch', part: 0.08, p95: 4, nom: 'Un écran regarde la soirée' },
  { e: 'host:hello', part: 0.02, p95: 9, nom: 'Un écran d’animateur arrive' },
  { e: 'host:launch', part: 0.008, p95: 38, nom: 'Lancer un quiz' },
  { e: 'host:next', part: 0.07, p95: 11, nom: 'Question suivante, révéler' },
  { e: 'host:scene', part: 0.01, p95: 7, nom: 'Changer de scène' },
  { e: 'host:closeParty', part: 0.0015, p95: 640, nom: 'Clore la soirée' },
]

// ── Les joueurs : présence, cohortes, segments ───────────────────────

const PRENOMS = ['Léa', 'Gabriel', 'Arthur', 'Inès', 'Paul', 'Chloé', 'Adam', 'Manon', 'Basile', 'Anna', 'Noé', 'Léna', 'Nathan', 'Camille', 'Hugo', 'Jules', 'Louise', 'Lucas', 'Zoé', 'Mila', 'Théo', 'Jade', 'Sacha', 'Rose']
const JOUEURS = PRENOMS.map((p, i) => {
  const manies = ['campagne', 'jour', 'duel', 'cabinet', 'tout']
  const manie = manies[i % manies.length]
  const jours = Math.round(30 - i * 0.9 - hasard('jours', i) * 5)
  const parties = Math.round(220 - i * 7 + hasard('parties', i) * 40)
  return {
    nom: p, pseudo: '@' + p.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), manie,
    jours: borner(jours, 3, 30), parties, questions: Math.round(parties * (9.5 + hasard('qpp', i) * 3)),
    serie: Math.round(hasard('serie', i) * 64 + (i < 5 ? 30 : 0)), niveau: 12 + Math.round(hasard('niv', i) * 30),
    derniere: T0 - Math.round(hasard('der', i) * (i > 18 ? 9 : 1.2) * JOUR),
    cote: 1040 + Math.round(hasard('cote', i) * 470),
  }
})

/** Les cohortes : la semaine d'inscription, puis la part revenue chaque semaine d'après. */
const COHORTES = Array.from({ length: 12 }, (_, i) => {
  const lundi = minuit(T0) - (paris(T0).sem + 6) % 7 * JOUR - (11 - i) * 7 * JOUR
  const taille = Math.round(16 + hasard('coh-t', i) * 14 + (i === 11 ? 14 : 0) + (i === 10 ? 6 : 0))
  const semaines = 11 - i
  const parts = []
  for (let k = 0; k <= Math.min(8, semaines); k++) {
    if (k === 0) parts.push(100)
    else {
      const base = 52 * Math.pow(k, -0.42) * (i >= 9 ? 1.12 : 1) * (1 + 0.1 * bruit('coh', i * 10 + k))
      parts.push(Math.round(borner(base, 4, 92)))
    }
  }
  return { lundi, taille, parts }
})

const SEGMENTS = [
  { cle: 'nouveaux', nom: 'Nouveaux', detail: 'inscrits ces sept jours', n: 34, couleur: '#fbe3ad' },
  { cle: 'reguliers', nom: 'Réguliers', detail: 'trois jours par semaine ou plus', n: 88, couleur: '#e8c27a' },
  { cle: 'occasionnels', nom: 'Occasionnels', detail: 'joué ces sept jours, moins souvent', n: 71, couleur: '#c79a3e' },
  { cle: 'risque', nom: 'À risque', detail: 'absents depuis 7 à 13 jours', n: 27, couleur: '#8f6c22' },
  { cle: 'endormis', nom: 'Endormis', detail: 'absents depuis 14 à 30 jours', n: 34, couleur: '#5a4415' },
]

// ── Le Cabinet de curiosités ───────────────────────────────────────────

const JEUX_DU_CABINET = [
  { cle: 'pari', nom: 'Le Pari', reussite: 71, etoiles: 2.3, duree: 1.4, quitte: 3, eclairer: 22, signal: 1 },
  { cle: 'eclair', nom: 'L’Éclair', reussite: 64, etoiles: 2.0, duree: 0.8, quitte: 2, eclairer: 9, signal: 0 },
  { cle: 'mot', nom: 'Le Mot mystère', reussite: 58, etoiles: 1.8, duree: 2.1, quitte: 7, eclairer: 41, signal: 2 },
  { cle: 'filet', nom: 'Le Filet', reussite: 39, etoiles: 1.3, duree: 1.6, quitte: 9, eclairer: 18, signal: 4 },
  { cle: 'detail', nom: 'Le Détail', reussite: 66, etoiles: 2.1, duree: 1.2, quitte: 4, eclairer: 27, signal: 0 },
  { cle: 'frise', nom: 'La Frise', reussite: 52, etoiles: 1.7, duree: 1.9, quitte: 6, eclairer: 33, signal: 1 },
  { cle: 'epingle', nom: 'L’Épingle', reussite: 47, etoiles: 1.5, duree: 2.0, quitte: 8, eclairer: 25, signal: 3 },
  { cle: 'indices', nom: 'Les Indices', reussite: 61, etoiles: 1.9, duree: 1.7, quitte: 5, eclairer: 38, signal: 1 },
  { cle: 'replique', nom: 'La Réplique', reussite: 55, etoiles: 1.7, duree: 1.5, quitte: 6, eclairer: 29, signal: 2 },
  { cle: 'quiz', nom: 'Le Quiz', reussite: 69, etoiles: 2.2, duree: 1.3, quitte: 2, eclairer: 15, signal: 0 },
]
const CARTES_DU_CABINET = [
  { nom: 'Coup d’œil', choisie: 46, victoire: 24 },
  { nom: 'Second souffle', choisie: 44, victoire: 31 },
  { nom: 'Parade', choisie: 41, victoire: 29 },
  { nom: 'Panacée', choisie: 35, victoire: 27 },
  { nom: 'Échange', choisie: 31, victoire: 20 },
  { nom: 'Quitte ou double', choisie: 27, victoire: 18 },
  { nom: 'Cagnotte', choisie: 22, victoire: 19 },
  { nom: 'Concentration', choisie: 21, victoire: 21 },
  { nom: 'Coup de grâce', choisie: 18, victoire: 26 },
  { nom: 'Pourboire', choisie: 15, victoire: 17 },
]
const ACTES = [
  { nom: 'Acte I · La Serre aux merveilles', gardiens: [['Renard', 78, 3], ['Coq', 81, 4], ['Chouette', 64, 2], ['Tigre', 71, 1], ['Chauve-souris', 69, 2], ['Scarabée', 74, 3]] },
  { nom: 'Acte II · La Bibliothèque engloutie', gardiens: [['Sphinx', 51, 1], ['Janus', 58, 1], ['Phénix', 55, 2], ['Fantôme', 62, 1], ['Salamandre', 60, 0], ['Lion', 39, 0], ['Oracle', 49, 1], ['Serpent', 57, 1]] },
  { nom: 'Acte III · L’Observatoire', gardiens: [['Dragon', 61, 1], ['Kraken', 66, 0], ['Chimère', 58, 1], ['Ouroboros', 63, 0], ['Trou noir', 52, 0], ['Comète', 41, 0]] },
]
const TRAVERSEES_EN_ROUTE = [
  { qui: 'Léa', ou: 'Acte II · face au Sphinx', coeurs: 2, or: 41, depuis: 23, progres: 0.62 },
  { qui: 'Inès', ou: 'Acte III · chez le marchand', coeurs: 1, or: 63, depuis: 31, progres: 0.81 },
  { qui: 'Hugo', ou: 'Acte I · le Pari', coeurs: 3, or: 18, depuis: 9, progres: 0.22 },
  { qui: 'Théo', ou: 'Acte I · choisit ses cartes', coeurs: 3, or: 0, depuis: 1, progres: 0.03 },
]

/** Les traversées par jour : commencées, puis leur issue. */
function traverseesDuJour(t) {
  const p = paris(t + 12 * HEURE)
  const cle = `${p.mois}-${p.jour}`
  const table = { '9-24': 1, '9-25': 2, '9-26': 1, '9-27': 2, '9-28': 1, '9-29': 3, '9-30': 2, '9-31': 18, '10-1': 41, '10-2': 33, '10-3': 26 }
  return table[cle] ?? 0
}

// ── Les questions : de quoi trier le contenu ──────────────────────────

const MARCHES = ['facile', 'moyenne', 'difficile', 'experte']
const QUESTIONS = [
  ['Quel est le plus long fleuve de France ?', 'Géographie', 'jour', 'facile', 81, 1240, 7.1, 0, ['La Loire', 'La Seine', 'Le Rhône', 'La Garonne'], 0],
  ['En quelle année la tour Eiffel a-t-elle été inaugurée ?', 'Histoire', 'campagne', 'moyenne', 54, 418, 9.4, 0, ['1889', '1900', '1878', '1867'], 0],
  ['Qui a peint « La Jeune Fille à la perle » ?', 'Arts & lettres', 'jour', 'moyenne', 62, 1180, 8.2, 0, ['Vermeer', 'Rembrandt', 'Rubens', 'Van Dyck'], 0],
  ['Combien de cœurs a une pieuvre ?', 'Nature', 'campagne', 'moyenne', 23, 386, 11.8, 2, ['Trois', 'Un', 'Deux', 'Huit'], 0, 'difficile'],
  ['Quel pays a remporté la Coupe du monde de football 2010 ?', 'Sport', 'jour', 'facile', 72, 1205, 6.8, 0, ['L’Espagne', 'Les Pays-Bas', 'L’Allemagne', 'L’Italie'], 0],
  ['Quelle planète possède le plus de lunes connues ?', 'Sciences', 'campagne', 'difficile', 31, 244, 12.4, 1, ['Saturne', 'Jupiter', 'Uranus', 'Neptune'], 0],
  ['Dans quel film entend-on « Je suis ton père » ?', 'Cinéma & séries', 'cabinet', 'facile', 88, 302, 5.1, 0, ['L’Empire contre-attaque', 'Un nouvel espoir', 'Le Retour du Jedi', 'La Menace fantôme'], 0],
  ['Quel ingrédient donne sa couleur au risotto alla milanese ?', 'Cuisine', 'jour', 'moyenne', 18, 1162, 10.6, 3, ['Le safran', 'Le curcuma', 'Le paprika', 'La carotte'], 0, 'difficile'],
  ['Qui a composé « Les Quatre Saisons » ?', 'Musique', 'campagne', 'facile', 84, 512, 6.2, 0, ['Vivaldi', 'Bach', 'Mozart', 'Haendel'], 0],
  ['Quelle est la capitale de l’Australie ?', 'Géographie', 'campagne', 'moyenne', 47, 690, 8.9, 0, ['Canberra', 'Sydney', 'Melbourne', 'Perth'], 0],
  ['Combien de joueurs compte une équipe de rugby à XV sur le terrain ?', 'Sport', 'jour', 'facile', 91, 1198, 5.4, 0, ['Quinze', 'Treize', 'Onze', 'Seize'], 0],
  ['Quel élément chimique a pour symbole « W » ?', 'Sciences', 'cabinet', 'difficile', 44, 158, 9.9, 0, ['Le tungstène', 'Le vanadium', 'Le xénon', 'L’osmium'], 0, 'moyenne'],
  ['Quel roi de France fut surnommé le Bien-Aimé ?', 'Histoire', 'campagne', 'moyenne', 39, 402, 10.2, 0, ['Louis XV', 'Louis XIV', 'Henri IV', 'Louis XVI'], 0],
  ['De quel jeu vidéo vient le personnage de Link ?', 'Jeux & pop culture', 'jour', 'facile', 86, 1215, 5.8, 0, ['The Legend of Zelda', 'Final Fantasy', 'Metroid', 'Kirby'], 0],
  ['Quelle couleur obtient-on en mélangeant du bleu et du jaune ?', 'Culture générale', 'campagne', 'facile', 96, 640, 4.2, 0, ['Le vert', 'Le violet', 'L’orange', 'Le marron'], 0, 'facile'],
  ['En quelle année a eu lieu la prise de la Bastille ?', 'Histoire', 'cabinet', 'facile', 90, 271, 5.0, 0, ['1789', '1792', '1776', '1799'], 0],
  ['Quel animal est le plus rapide sur terre ?', 'Nature', 'jour', 'facile', 87, 1174, 5.6, 0, ['Le guépard', 'Le lion', 'L’antilope', 'Le lévrier'], 0],
  ['Quel est le nom du célèbre vaisseau du capitaine Nemo ?', 'Arts & lettres', 'campagne', 'moyenne', 66, 338, 7.9, 0, ['Le Nautilus', 'Le Pequod', 'L’Hispaniola', 'Le Black Pearl'], 0],
  ['Quelle mer borde la ville d’Odessa ?', 'Géographie', 'campagne', 'difficile', 58, 221, 9.1, 0, ['La mer Noire', 'La mer Caspienne', 'La mer Baltique', 'La mer d’Azov'], 0, 'moyenne'],
  ['Qui chante « La Bohème » ?', 'Musique', 'jour', 'facile', 79, 1189, 6.0, 0, ['Charles Aznavour', 'Jacques Brel', 'Gilbert Bécaud', 'Léo Ferré'], 0],
  ['Combien d’os compte le corps humain adulte ?', 'Sciences', 'campagne', 'moyenne', 49, 455, 9.7, 1, ['206', '212', '196', '230'], 0],
  ['Quel pâtissier a créé le Paris-Brest ?', 'Cuisine', 'cabinet', 'experte', 12, 96, 13.1, 0, ['Louis Durand', 'Gaston Lenôtre', 'Antonin Carême', 'Pierre Hermé'], 0],
  ['Quelle série se déroule à Hawkins, dans l’Indiana ?', 'Cinéma & séries', 'jour', 'facile', 83, 1170, 6.4, 0, ['Stranger Things', 'Dark', 'Twin Peaks', 'Riverdale'], 0],
  ['Quel est le plus petit pays du monde ?', 'Géographie', 'campagne', 'facile', 88, 702, 5.3, 0, ['Le Vatican', 'Monaco', 'Saint-Marin', 'Nauru'], 0],
  ['Qui a écrit « Les Fleurs du mal » ?', 'Arts & lettres', 'jour', 'facile', 77, 1192, 6.9, 0, ['Baudelaire', 'Rimbaud', 'Verlaine', 'Hugo'], 0],
  ['Quelle fête célèbre-t-on le 2 février en France ?', 'Autour de la fête', 'campagne', 'moyenne', 71, 311, 7.0, 0, ['La Chandeleur', 'L’Épiphanie', 'Mardi gras', 'La Saint-Valentin'], 0, 'facile'],
  ['Combien de temps dure un match de handball (hors prolongations) ?', 'Sport', 'campagne', 'moyenne', 33, 288, 10.4, 1, ['60 minutes', '80 minutes', '70 minutes', '90 minutes'], 0, 'difficile'],
  ['Quel savant a formulé la loi de la gravitation universelle ?', 'Sciences', 'cabinet', 'facile', 85, 190, 5.9, 0, ['Isaac Newton', 'Galilée', 'Kepler', 'Einstein'], 0],
]
  .map(([texte, categorie, source, marche, reussite, reponses, temps, signalements, choix, bonne, observee], i) => {
    const marcheObservee = observee ?? (reussite >= 75 ? 'facile' : reussite >= 50 ? 'moyenne' : reussite >= 25 ? 'difficile' : 'experte')
    const repartition = choix.map((_, k) => (k === bonne ? reussite : 0))
    let reste = 100 - reussite
    for (let k = 0; k < choix.length; k++) {
      if (k === bonne) continue
      const part = k === choix.length - 1 ? reste : Math.round(reste * (0.45 + 0.3 * hasard('rep', i * 4 + k)))
      repartition[k] = part
      reste -= part
    }
    return {
      id: (source === 'jour' ? 'j' : source === 'cabinet' ? 'cab' : 'c') + (1200 + i * 37),
      texte, categorie, source, marche, marcheObservee, reussite, reponses, temps, signalements, choix, bonne, repartition,
      contredite: marcheObservee !== marche,
      etat: signalements >= 2 ? 'signalee' : 'active',
      derniere: T0 - Math.round(hasard('qd', i) * 9 * JOUR),
    }
  })

// ── L'économie : les confettis ─────────────────────────────────────────

const SOURCES_DE_CONFETTIS = [
  ['Campagne', 41], ['Quiz du jour', 23], ['Soirées', 12], ['Missions du jour', 9], ['Ligues des duels', 6], ['Défis du Cabinet', 4], ['Coffres de la semaine', 3], ['Tes dons', 2],
]
const DEPENSES_DE_CONFETTIS = [
  ['Compagnons', 38], ['Thèmes', 27], ['Fonds de carte', 14], ['Vies', 11], ['Sabliers', 7], ['Soins et jardin', 3],
]

// ── Turso : ce qui lit le plus ────────────────────────────────────────

const LECTURES = [
  { q: 'SELECT … FROM campagne_reponses WHERE serie_id IN (…)', f: 'Campagne', part: 19.6, appels: 41200 },
  { q: 'SELECT … FROM jour_reponses WHERE jour = ? (réveil)', f: 'Quiz du jour', part: 14.1, appels: 31 },
  { q: 'SELECT … FROM jour_reponses WHERE question = ?', f: 'Quiz du jour', part: 10.4, appels: 9800 },
  { q: 'SELECT … FROM profile_xp WHERE profile_id IN (…)', f: 'Profil', part: 8.9, appels: 18600 },
  { q: 'SELECT … FROM profile_badges WHERE profile_id = ?', f: 'Profil', part: 7.7, appels: 22400 },
  { q: 'SELECT json_group_array(…) FROM campagne_series WHERE commencee_le >= ?', f: 'QG', part: 5.8, appels: 96 },
  { q: 'SELECT … FROM soirees_v2 WHERE held_at >= ?', f: 'QG', part: 3.9, appels: 288 },
  { q: 'SELECT … FROM cabinet_traversee_gestes WHERE traversee_id = ?', f: 'Cabinet', part: 3.2, appels: 3100 },
  { q: 'SELECT … FROM campagne_duels WHERE cree_le >= ?', f: 'Duels', part: 2.6, appels: 1900 },
  { q: 'autres requêtes', f: '—', part: 23.8, appels: 211000 },
]
