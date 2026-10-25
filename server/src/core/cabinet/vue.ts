// Ce que le téléphone reçoit du Cabinet de curiosités : la page du musée
// (`pageDuCabinet`), une partie (`vueDeLaPartie`) et le cartel d'une œuvre
// (`cartelDe`), bâtis champ par champ
// des types nés complets de `shared/cabinet/vues.ts` (invariant 1). Rien ne
// s'y étale : un champ neuf du départ figé — sa graine, ses rechanges, la
// bonne réponse d'une manche pas encore tranchée — n'y part jamais de
// lui-même, le piège `montree` de l'Expédition. Le corps d'une manche, c'est
// `montrer` de son jeu qui le choisit ; sa révélation, `reveler`, une fois le
// verdict rendu ; le cartel, `cartel` (`cabinet-secret.test.ts` relit le plan
// en base et le cherche dans chaque réponse).
//
// La partie en cours et une partie finie passent par le même pli et la même
// vue (invariant 14) : « Mes réponses » révèle chaque manche d'une partie
// finie comme la partie l'a révélée, et le cartel d'une œuvre relit la manche
// que son bilan garde comme le bilan l'a dite.
import type { CartelLu, LectureDuCabinet, PartieGardee, PartieLue } from './magasin'
import { CHANGEMENTS_PAR_PARTIE, CHASSES_PAR_JOUR, ECLAIRAGES_PAR_PARTIE, LIBRES_QUI_PAIENT, MANCHES_PAR_PARTIE, SEUILS_DES_RARETES } from '../../../../shared/cabinet/bareme'
import { echeanceDe, pauseEnCours, pauseResteMs } from '../../../../shared/cabinet/chrono'
import { regleDe } from '../../../../shared/cabinet/jeux/index'
import {
  caseCommencee,
  chassesRestantes,
  dorees,
  enjeuDe,
  libresQuiPaientEncore,
  possedees,
  poussieresDites,
  prixDe,
  prochainGardien,
  refusDeLEchange,
  serieMontree,
  soldeDe,
  type EnjeuDUneCase,
  type Musee,
  type OrigineDUneOeuvre,
} from '../../../../shared/cabinet/musee'
import { JEU_DE_L_OEUVRE, OEUVRES_DE_DEPART, estUneOeuvre, oeuvre, oeuvresDeLaSalle, type CleDOeuvre } from '../../../../shared/cabinet/oeuvres'
import {
  etapeEnCours,
  etoilesDesManches,
  leChronoCourt,
  mancheDe,
  mancheEnCours,
  phaseDe,
  pouvoirMaintenant,
  resultatDe,
  type BilanDUnePartie,
  type DepartDUnePartie,
  type EtatDeLaPartie,
  type MancheDuPli,
} from '../../../../shared/cabinet/partie'
import { ceQueFaitLaCarte } from '../../../../shared/cabinet/pouvoirs'
import { AUTRES_GARDIENS, GARDIENS, GARDIENS_DES_SALLES, SALLES, conditionDuGardien, pouvoirDuGardien, salle } from '../../../../shared/cabinet/salles'
import type {
  BilanVu,
  Cartel,
  CartelDuBilan,
  CarteVue,
  CaseVue,
  FeteVue,
  GainsDuCabinet,
  GardienVu,
  MancheVue,
  OeuvreVue,
  PageDuCabinet,
  RevelationVue,
  SalleVue,
  VueDeLaPartie,
} from '../../../../shared/cabinet/vues'
import { horsDeLaBase } from '../../../../shared/horsDeLaBase'
import { jourDe, jourEnToutesLettres } from '../../../../shared/jour'
import { legendaire } from '../../../../shared/legendaires'

// ── Les mots ──────────────────────────────────────────────────────────────

/** « la Chouette d’Argent » : le nom d'un gardien dans une phrase. */
const leGardien = (cle: string): string => {
  const nom = legendaire(cle)?.nom ?? cle
  return nom.charAt(0).toLowerCase() + nom.slice(1)
}
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`
const nomDe = (cle: string | undefined): string => oeuvre(cle)?.nom ?? 'L’œuvre'

// ── Une partie ────────────────────────────────────────────────────────────

/**
 * Ce qui est en jeu, tel que le départ l'a figé : une rareté et une salle tant
 * que l'œuvre est à gagner — jamais l'œuvre visée —, l'œuvre à dorer, ou la
 * poussière d'or. Null en partie libre.
 */
function enJeuDuDepart(d: DepartDUnePartie): EnjeuDUneCase | null {
  if (d.origine === 'libre') return null
  const o = oeuvre(d.cible)
  if (!o) return { poussiere: true }
  return d.but === 'dorer' ? { pourDorer: o.cle } : { rarete: o.rarete, salle: o.salle }
}

/** La carte-bonus emportée, et ce qu'il en reste : les usages d'Éclairer, de Changer — borné aux rechanges du plan —, de la mise. */
function carteDe(d: DepartDUnePartie, e: EtatDeLaPartie): CarteVue | null {
  if (!d.carte) return null
  const { cle, pouvoir, force } = d.carte
  const rechanges = Math.max(0, d.tirages.length - MANCHES_PAR_PARTIE - e.servis.changer)
  const reste =
    pouvoir === 'eclairer'
      ? Math.max(0, ECLAIRAGES_PAR_PARTIE[force] - e.servis.eclairer)
      : pouvoir === 'changer'
        ? Math.min(rechanges, Math.max(0, CHANGEMENTS_PAR_PARTIE[force] - e.servis.changer))
        : pouvoir === 'miser'
          ? e.misee === null
            ? 1
            : 0
          : 0
  return { cle, pouvoir, force, reste, dit: ceQueFaitLaCarte(pouvoir, force, d.jeu) }
}

/** La révélation d'une manche tranchée : le corps de son jeu, et ses pièces que « Signaler une erreur » peut viser — les questions de la base seules. */
function revelationDe(d: DepartDUnePartie, e: EtatDeLaPartie, m: MancheDuPli): RevelationVue | undefined {
  if (!m.verdict || !m.fin) return undefined
  return {
    manche: m.manche,
    tirage: m.tirage,
    fin: m.fin,
    signalables: e.pieces.filter(p => p.manche === m.manche && !horsDeLaBase(p.piece.id)).map(p => p.position),
    corps: regleDe(d.jeu).reveler(d.tirages[m.tirage], m.etat, m.verdict) as RevelationVue['corps'],
  }
}

/** Ce que vaut chaque manche à présent, et pourquoi ses étoiles diffèrent de ses naturelles : « +4 : mise gagnée ». */
function manchesDe(d: DepartDUnePartie, e: EtatDeLaPartie): MancheVue[] {
  const finie = e.fin !== null
  return etoilesDesManches(d, e).map((x, k) => {
    const note =
      x.naturel === null || x.etoiles === null
        ? undefined
        : x.misee
          ? x.naturel === 3
            ? `+${x.etoiles - 3} : mise gagnée`
            : 'Mise perdue'
          : x.protegee && x.etoiles > x.naturel
            ? `+${x.etoiles - x.naturel} : protégée`
            : undefined
    const m = e.manches[k]
    const revelation = finie && m ? revelationDe(d, e, m) : undefined
    return { etoiles: x.etoiles, naturel: x.naturel, ...(note && { note }), ...(x.fin && { fin: x.fin }), ...(revelation && { revelation }) }
  })
}

/** Le chrono de l'étape en cours, à l'heure du serveur : son échéance, sa durée, et sous la pause ce qui en reste. */
function chronoDe(m: MancheDuPli | undefined, t: number): VueDeLaPartie['chrono'] {
  if (!m || !leChronoCourt(m)) return undefined
  const etape = etapeEnCours(m)
  return { echeance: echeanceDe(etape, t), dureeMs: etape.dureeMs, ...(pauseEnCours(etape) && { pauseResteMs: pauseResteMs(etape, t) }) }
}

/** Ce que dit le bilan de l'œuvre en jeu, en une phrase. */
function bilanDit(d: DepartDUnePartie, b: BilanDUnePartie): string {
  const nom = nomDe(d.cible ?? undefined)
  switch (b.issue) {
    case 'gagnee':
      return `${nom} entre dans ton musée`
    case 'gagnee-doree':
      return `${nom} entre dans ton musée, dans un cadre doré`
    case 'doree':
      return `${nom} prend son cadre doré`
    case 'double':
      return `${nom} était déjà à toi : sa poussière d’or en plus`
    case 'manquee':
      return d.but === 'dorer' ? 'Pas de dorure cette fois' : `Pas assez d’étoiles cette fois. Il en fallait ${d.seuil}. L’œuvre reste à gagner.`
    case 'libre':
      if (d.origine !== 'libre') return 'Tout ton musée est doré : cette partie rapporte de la poussière d’or'
      return b.poussiere > 0 ? `${poussieresDites(b.poussiere)} pour ta partie libre` : 'Les cinq parties libres du jour ont payé : celle-ci se joue pour le plaisir'
  }
}

/** Ce que la fin a rapporté, tel que l'écran des gains de la campagne le lit. */
function gainsDe(p: PartieLue): GainsDuCabinet | undefined {
  if (!p.gains) return undefined
  const { recompenses, legendaires } = p.gains.recompenses
  return {
    xp: p.gains.xp.reduce((a, b) => a + b, 0),
    confettis: p.etat.pieces.filter(x => x.juste).length,
    ...(recompenses && recompenses.length > 0 && { recompenses }),
    ...(legendaires && legendaires.length > 0 && { legendaires }),
  }
}

/**
 * Ce que le cartel d'une partie garde, en clair : la manche que son bilan figé
 * désigne, relue par la règle de son jeu sur son tirage et son verdict — la
 * question telle que la partie l'a lue, sa réponse, « Le savais-tu ? ». Le
 * même chemin pour le bilan qui vient de tomber et pour le cartel relu des
 * semaines après (invariant 14).
 */
function cartelDuBilan(p: PartieGardee): CartelDuBilan | null {
  const b = p.bilan
  const m = b?.cartel === null || b?.cartel === undefined ? undefined : p.etat.manches[b.cartel]
  return m?.verdict ? { manche: m.manche, ...regleDe(p.depart.jeu).cartel(p.depart.tirages[m.tirage], m.verdict) } : null
}

/**
 * Le bilan à l'écran : le bilan figé, champ par champ — un champ ajouté au
 * bilan n'y part pas de lui-même, comme le reste de la vue —, son cartel en
 * clair (la manche qu'il garde, relue de son jeu), l'œuvre, et les gains de la
 * fin.
 */
function bilanVu(p: PartieLue): BilanVu | undefined {
  const b = p.bilan
  if (!b) return undefined
  const cartel = cartelDuBilan(p)
  const gains = gainsDe(p)
  return {
    etoiles: b.etoiles,
    naturel: b.naturel,
    aidee: b.aidee,
    total: b.total,
    ...(b.quittee && { quittee: true as const }),
    ...(b.lendemain && { lendemain: true as const }),
    issue: b.issue,
    poussiere: b.poussiere,
    cartel,
    seuil: p.depart.seuil,
    dit: bilanDit(p.depart, b),
    ...(b.oeuvre !== undefined && estUneOeuvre(b.oeuvre) && { oeuvre: b.oeuvre }),
    ...(gains && { gains }),
  }
}

/**
 * Une partie telle que le pli la dit à `t` (`p.lueA`) : où elle en est, ce que
 * vaut chaque manche, le chrono de l'étape en cours, le pouvoir de sa
 * carte-bonus, la manche qui se joue sans sa réponse — la révélation de celle
 * qui vient d'être tranchée —, et, finie, son bilan et chaque manche révélée.
 */
export function vueDeLaPartie(p: PartieLue): VueDeLaPartie {
  const { depart: d, etat: e } = p
  const t = p.lueA
  const m = mancheEnCours(e)
  const pouvoir = pouvoirMaintenant(d, e, t)
  const enCours = m && !m.verdict ? (regleDe(d.jeu).montrer(d.tirages[m.tirage], m.etat) as VueDeLaPartie['enCours']) : undefined
  const revelation = m?.verdict ? revelationDe(d, e, m) : undefined
  const chrono = chronoDe(m, t)
  const bilan = e.fin ? bilanVu(p) : undefined
  return {
    id: p.id,
    maintenant: t,
    rang: e.rang,
    jeu: d.jeu,
    origine: d.origine,
    enJeu: enJeuDuDepart(d),
    seuil: d.seuil,
    carte: carteDe(d, e),
    manche: mancheDe(e),
    // L'adresse des images du Détail le porte : un indice du plan, que la vue dit — jamais ce qu'il désigne.
    ...(m && { tirage: m.tirage }),
    phase: phaseDe(e),
    manches: manchesDe(d, e),
    total: resultatDe(d, e).total,
    ...(chrono && { chrono }),
    ...(pouvoir && { pouvoir }),
    ...(enCours && { enCours }),
    ...(revelation && { revelation }),
    ...(bilan && { bilan }),
  }
}

// ── Le cartel d'une œuvre ─────────────────────────────────────────────────

/** « le 24 octobre 2026 », « le 1er novembre 2026 » : le jour de Paris d'une partie, en clair — sans `Intl`, que la page n'a pas à charger. */
const leJourDit = (jour: string): string => `le ${jourEnToutesLettres(jour, true)} ${jour.slice(0, 4)}`

/** Comment une œuvre sans cartel de partie est entrée, en une phrase : son cartel d'office. */
const ENTREES_D_OFFICE: Readonly<Record<Exclude<OrigineDUneOeuvre, 'partie'>, string>> = {
  depart: 'Offerte à ton arrivée.',
  achat: 'Achetée avec ta poussière d’or.',
  expedition: 'Rapportée de l’Expédition.',
}

/**
 * Ce que son cartel promet, tant que son cadre n'est pas doré : rejouée en
 * chasse pour le dorer, elle prendra le cartel de cette partie-là. Doré, rien
 * ne le lui donnera plus — la phrase se tait plutôt que de promettre.
 */
const CE_QUE_GARDERA_LE_CARTEL = 'Rejoue-la pour dorer son cadre : elle gardera ici ce que tu auras appris.'

/**
 * Le cartel d'une œuvre à lui, champ par champ : la manche que sa partie a
 * gardée (`cartelDuBilan`, le même pli que le bilan tombé), son jeu, son
 * thème, son total, son jour ; sinon la phrase de son entrée — offerte,
 * achetée, rapportée, ou gagnée par une partie qui n'avait rien à raconter.
 * Rien de la partie que la page ne voyait déjà à son bilan : ni le plan, ni
 * la graine, ni une rechange.
 *
 * Gagnée sans rien à raconter, sa ligne ne nomme pas sa partie (`serie_id`
 * garde un cartel, et un double pourra encore lui en donner un) : la phrase
 * dit le jour de son entrée (`gagnee_le`), pas celui de la partie — une
 * partie commencée la veille, ou close par la page d'un autre jour, la fait
 * entrer ce jour-là : « Gagnée en jouant, le 27 » datait du jour de la
 * clôture une partie jouée le 24.
 */
export function cartelDe(lu: CartelLu): Cartel {
  const { oeuvre, ligne, partie } = lu
  const origine = ligne?.origine ?? 'depart'
  const doree = (ligne?.doreeLe ?? null) !== null
  const garde = partie?.bilan ? cartelDuBilan(partie) : null
  if (partie?.bilan && garde) {
    return {
      oeuvre,
      origine,
      doree,
      partie: {
        id: partie.id,
        jeu: partie.depart.jeu,
        ...(partie.depart.theme !== undefined && { theme: partie.depart.theme }),
        jour: leJourDit(partie.depart.jour),
        total: partie.bilan.total,
        issue: partie.bilan.issue,
        sujet: garde.sujet,
        reponse: garde.reponse,
        anecdote: garde.anecdote,
      },
    }
  }
  const entree = origine === 'partie' ? `Entrée dans ton musée ${leJourDit(jourDe(ligne?.gagneeLe ?? 0))}, gagnée en jouant.` : ENTREES_D_OFFICE[origine]
  return { oeuvre, origine, doree, dit: doree ? entree : `${entree} ${CE_QUE_GARDERA_LE_CARTEL}` }
}

// ── La page du musée ──────────────────────────────────────────────────────

/**
 * Un gardien, réveillé ou non. La voie se dira gardien par gardien quand ils
 * se rangeront sur l'étagère (le lot des gardiens) : d'ici là, un gardien
 * qu'il a vient d'ailleurs — l'Expédition, une saison.
 */
function gardienVu(m: Musee, cle: string): GardienVu {
  const reveille = m.legendaires.has(cle)
  return { legendaire: cle, reveille, ...(reveille && { voie: 'ailleurs' as const }), condition: conditionDuGardien(cle) ?? '', pouvoir: pouvoirDuGardien(cle)! }
}

function sallesDe(m: Musee, jeux: readonly string[]): SalleVue[] {
  const a = possedees(m)
  const d = dorees(m)
  return SALLES.map(s => {
    const oeuvres = oeuvresDeLaSalle(s.cle).map((o): OeuvreVue => {
      const possedee = a.has(o.cle)
      const doree = d.has(o.cle)
      const origine = m.oeuvres.get(o.cle)?.origine ?? (OEUVRES_DE_DEPART.includes(o.cle) ? 'depart' : undefined)
      const jeu = JEU_DE_L_OEUVRE[o.cle]
      const prix = !possedee ? prixDe(o.cle, 'achat') : !doree ? prixDe(o.cle, 'dorure') : null
      return {
        cle: o.cle,
        nom: o.nom,
        rarete: o.rarete,
        possedee,
        doree,
        ...(origine && { origine }),
        jeu,
        ...(!jeux.includes(jeu) && { bientot: true as const }),
        seuil: SEUILS_DES_RARETES[o.rarete],
        ...(prix !== null && { prix }),
      }
    })
    const [premier, second] = GARDIENS_DES_SALLES[s.cle]
    return {
      cle: s.cle,
      nom: s.nom,
      devise: s.devise,
      oeuvres,
      complete: oeuvres.every(o => o.possedee),
      doree: oeuvres.every(o => o.doree),
      gardiens: [gardienVu(m, premier), gardienVu(m, second)],
    }
  })
}

/** La visite du jour, case par case : son jeu, son enjeu — jamais l'œuvre visée d'une case pas gagnée —, et ce qu'elle a donné. */
function visiteVue(l: LectureDuCabinet): PageDuCabinet['visite'] {
  const m = l.musee
  const cases = l.visite.cases.map((c, k): CaseVue => {
    const jouee = m.duJour.parties.find(p => p.origine === 'visite' && p.visite === k)
    const gagnee = jouee?.issue === 'gagnee' || jouee?.issue === 'gagnee-doree' || jouee?.issue === 'doree'
    return {
      jeu: c.jeu,
      enJeu: enjeuDe(m, c),
      faite: caseCommencee(m, k),
      ...(jouee?.issue && { issue: jouee.issue }),
      ...(gagnee && c.cible !== null && { oeuvre: c.cible as CleDOeuvre }),
      ...(!l.jeux.includes(c.jeu) && { bientot: true as const }),
    }
  })
  // Une case encore à jouer, s'il en reste une : la seule règle des échanges dit le reste.
  const libre = l.visite.cases.findIndex((_, k) => !caseCommencee(m, k))
  const refus = refusDeLEchange(m, l.visite, libre < 0 ? 0 : libre, l.jeuDeLEchange)
  return { jour: l.visite.jour, cases, echange: refus ? { possible: false, refus } : { possible: true } }
}

/** La fête du jour, au calendrier du Cabinet, et son gardien tant qu'il dort. */
function feteVue(l: LectureDuCabinet): FeteVue | null {
  if (!l.fete) return null
  const gardien = AUTRES_GARDIENS.find(g => 'saison' in g.reveil && g.reveil.saison === l.fete!.key)?.legendaire
  return {
    cle: l.fete.key,
    nom: l.fete.nom,
    ...(gardien && !l.musee.legendaires.has(gardien) && { gardien: { legendaire: gardien, dit: `Gagne une œuvre, et ${leGardien(gardien)} se réveillera.` } }),
  }
}

/** La page du Cabinet : tout ce que l'annonce et le musée montrent, sans la réponse de rien ni l'œuvre visée d'une case. */
export function pageDuCabinet(l: LectureDuCabinet): PageDuCabinet {
  const m = l.musee
  const prochain = prochainGardien(m)
  const ou = prochain ? salle(prochain.salle) : undefined
  return {
    maintenant: l.maintenant,
    salles: sallesDe(m, l.jeux),
    gardiens: {
      tous: GARDIENS.map(g => gardienVu(m, g)),
      ...(prochain &&
        ou && { prochain: { legendaire: prochain.legendaire, dit: `${legendaire(prochain.legendaire)?.nom ?? prochain.legendaire} : encore ${pluriel(prochain.manquent, 'œuvre')} ${ou.dansLaSalle}` } }),
    },
    visite: visiteVue(l),
    chasses: { restent: chassesRestantes(m), parJour: CHASSES_PAR_JOUR },
    libres: { paientEncore: libresQuiPaientEncore(m), parJour: LIBRES_QUI_PAIENT },
    serie: serieMontree(m.profil, l.jour),
    poussiere: soldeDe(m),
    enCours: l.enCours ? vueDeLaPartie(l.enCours) : null,
    fete: feteVue(l),
    expedition: l.expeditionEnRoute ? 'en-route' : null,
    rapportees: [...m.oeuvres.values()].filter(o => o.origine === 'expedition').length,
    jeux: [...l.jeux],
  }
}
