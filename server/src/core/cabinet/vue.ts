// Ce que le téléphone reçoit du Cabinet de curiosités : la page du musée
// (`pageDuCabinet`), une partie (`vueDeLaPartie`), le cartel d'une œuvre
// (`cartelDe`), tes murs (`mursDe`) et le bouton de l'accueil
// (`accueilDuCabinet`), bâtis champ par champ
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
import type { CartelLu, LectureDeLAccueil, LectureDesMurs, LectureDuCabinet, PartieGardee, PartieLue } from './magasin'
import { themeDuTirage } from './tirages/index'
import { CHANGEMENTS_PAR_PARTIE, CHASSES_PAR_JOUR, ECLAIRAGES_PAR_PARTIE, LIBRES_QUI_PAIENT, MANCHES_PAR_PARTIE, SEUILS_DES_RARETES, VAGUES_DE_LA_FRISE } from '../../../../shared/cabinet/bareme'
import { deplier, estUneFriseDeSujet, idDeLaFriseATheme, idDuLieu } from '../../../../shared/cabinet/pieces'
import { PREFIXE_DE_LA_FRISE } from '../../../../shared/frise'
import { echeanceDe, pauseEnCours, pauseResteMs } from '../../../../shared/cabinet/chrono'
import { regleDe } from '../../../../shared/cabinet/jeux/index'
import {
  caseCommencee,
  chassesRestantes,
  dorees,
  enjeuDe,
  gardiensDus,
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
import { JEU_DE_L_OEUVRE, OEUVRES, OEUVRES_DE_DEPART, estUneOeuvre, oeuvre, oeuvresDeLaSalle, type CleDOeuvre } from '../../../../shared/cabinet/oeuvres'
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
import { AUTRES_GARDIENS, GARDIENS, GARDIENS_DES_SALLES, GARDIENS_DE_SAISON, SALLES, conditionDuGardien, pouvoirDuGardien, salle, voieDuGardien } from '../../../../shared/cabinet/salles'
import type {
  BilanVu,
  CabinetDAccueil,
  Cartel,
  CartelDuBilan,
  CarteVue,
  CaseVue,
  FeteVue,
  GainsDuCabinet,
  GardienVu,
  MancheVue,
  MursDuCabinet,
  OeuvreVue,
  PageDuCabinet,
  RevelationVue,
  SalleVue,
  VueDeLaPartie,
} from '../../../../shared/cabinet/vues'
import { visiteAJouer } from '../../../../shared/cabinet/vues'
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

/**
 * Ce que la fin a rapporté, tel que l'écran des gains de la campagne le lit :
 * les légendaires à annoncer en grand — les gardiens neufs qu'elle a
 * réveillés, puis ceux que ses paliers ouvrent, chacun une fois —, et la
 * luciole qu'une première salle complète amène.
 */
function gainsDe(p: PartieLue): GainsDuCabinet | undefined {
  if (!p.gains) return undefined
  const { recompenses, legendaires: desPaliers } = p.gains.recompenses
  const reveil = p.gains.reveil
  const legendaires = [...new Set([...(reveil?.gardiens.filter(g => g.neuf).map(g => g.legendaire) ?? []), ...(desPaliers ?? [])])]
  return {
    xp: p.gains.xp.reduce((a, b) => a + b, 0),
    confettis: p.etat.pieces.filter(x => x.juste).length,
    ...(recompenses && recompenses.length > 0 && { recompenses }),
    ...(legendaires.length > 0 && { legendaires }),
    ...(reveil?.compagnon && { compagnon: reveil.compagnon }),
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
  // Chaque gardien que la fin a rangé, neuf ou non : « Salle complète ! Le Phénix veillait déjà sur elle. »
  const gardiens = p.gains?.reveil?.gardiens ?? []
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
    ...(p.cartelDeSonOeuvre && { devientSonCartel: true as const }),
    ...(gardiens.length > 0 && { gardiens: gardiens.map(g => ({ legendaire: g.legendaire, neuf: g.neuf })) }),
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
 * achetée, ou gagnée par une partie qui n'avait rien à raconter.
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
    // Le thème de la manche gardée, pas celui de la partie : à l'Épingle, une rechange de Changer est d'un autre fil, et le
    // cartel disait « Terroirs et savoir-faire » au-dessus d'un lieu de « La France sauvage ».
    const tirage = partie.etat.manches[garde.manche]?.tirage
    const theme = themeDuTirage(tirage === undefined ? undefined : partie.depart.tirages[tirage])
    return {
      oeuvre,
      origine,
      doree,
      partie: {
        id: partie.id,
        jeu: partie.depart.jeu,
        ...(theme !== undefined && { theme }),
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

// ── Tes murs ──────────────────────────────────────────────────────────────

type DateDuMur = MursDuCabinet['dates'][number]

/**
 * Tes murs, champ par champ : chaque lieu épinglé — son nom, sa commune, sa
 * date, ses coordonnées —, le plus récemment épinglé d'abord ; et la frise
 * personnelle, chaque date une fois, du plus ancien au plus récent : les sept
 * d'une frise à thème rangée jusqu'à sa dernière vague — avant, rien ne dit
 * lesquelles il a vues, sa pièce ne nomme que sa manche —, celles des nouveaux
 * venus d'une frise d'un sujet, celles d'une frise de l'Expédition. Ce qu'il a
 * appris trouve sa place, d'où qu'il vienne ; la même date vue deux fois garde
 * sa dernière vue, et dit où. Ce qui a quitté le contenu livré ou la base ne
 * s'y montre plus.
 */
export function mursDe(l: LectureDesMurs): MursDuCabinet {
  const lieux = l.lieux
    .flatMap(x => {
      const vuLe = l.vues.get(idDuLieu(x.id))
      return vuLe === undefined ? [] : [{ id: x.id, nom: x.nom, commune: x.commune, departement: x.departement, date: x.date, annee: x.annee, lat: x.lat, lon: x.lon, vuLe }]
    })
    .sort((a, b) => b.vuLe - a.vuLe || (a.id < b.id ? -1 : 1))
  const dates = new Map<string, DateDuMur>()
  const poser = (cle: string, d: DateDuMur) => {
    const avant = dates.get(cle)
    if (!avant || d.vuLe > avant.vuLe) dates.set(cle, d)
  }
  const derniere = VAGUES_DE_LA_FRISE.length - 1
  for (const f of l.frises) {
    const vuLe = l.vues.get(idDeLaFriseATheme(f.id, derniere))
    if (vuLe !== undefined) f.evenements.forEach((e, k) => poser(`theme:${f.id}:${k}`, { libelle: e.libelle, annee: e.annee, de: 'cabinet', vuLe }))
  }
  for (const [id, vuLe] of l.vues) {
    const de = estUneFriseDeSujet(id) ? 'cabinet' : id.startsWith(PREFIXE_DE_LA_FRISE) ? 'expedition' : null
    if (!de) continue
    for (const q of de === 'cabinet' ? deplier(id) : id.slice(PREFIXE_DE_LA_FRISE.length).split('+')) {
      const e = l.evenements.get(q)
      if (e) poser(q, { libelle: e.evenement, annee: e.annee, de, vuLe })
    }
  }
  return { lieux, dates: [...dates.values()].sort((a, b) => a.annee - b.annee || a.libelle.localeCompare(b.libelle, 'fr')) }
}

// ── La page du musée ──────────────────────────────────────────────────────

/**
 * Ce qui dit qu'un gardien s'est réveillé au Cabinet : sa voie rangée
 * (`cabinet:phenix`), ou ce que le musée lui doit à présent — sa salle
 * complète, sa fête jouée. La voie d'un gardien de saison (`saison:halloween`)
 * se gagne aussi au quiz du jour : rangée, elle ne dit pas le Cabinet, seul
 * son musée le dit.
 */
interface CeQueSaitLeCabinet {
  rangees: ReadonlySet<string>
  dus: ReadonlySet<string>
}

/**
 * Un gardien, réveillé ou non, et par quelle voie : le Cabinet, ou une autre —
 * l'Expédition, une soirée, le quiz du jour : « il veillait déjà sur toi ».
 */
function gardienVu(m: Musee, cle: string, sait: CeQueSaitLeCabinet): GardienVu {
  const reveille = m.legendaires.has(cle)
  const parLeCabinet = sait.dus.has(cle) || (!GARDIENS_DE_SAISON.includes(cle) && sait.rangees.has(voieDuGardien(cle) ?? ''))
  return {
    legendaire: cle,
    reveille,
    ...(reveille && { voie: parLeCabinet ? ('cabinet' as const) : ('ailleurs' as const) }),
    condition: conditionDuGardien(cle) ?? '',
    pouvoir: pouvoirDuGardien(cle)!,
  }
}

function sallesDe(m: Musee, jeux: readonly string[], sait: CeQueSaitLeCabinet): SalleVue[] {
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
    const complete = oeuvres.every(o => o.possedee)
    return {
      cle: s.cle,
      nom: s.nom,
      devise: s.devise,
      oeuvres,
      complete,
      doree: oeuvres.every(o => o.doree),
      gardiens: [gardienVu(m, premier, sait), gardienVu(m, second, sait)],
      // Complète un jour — son premier gardien s'est rangé —, puis rouverte : une œuvre peinte de plus est arrivée, et
      // son gardien veille encore (invariant 22).
      ...(!complete && sait.rangees.has(voieDuGardien(premier) ?? '') && { nouvelle: true as const }),
    }
  })
}

/**
 * La visite du jour, case par case : son jeu, son enjeu — jamais l'œuvre visée d'une case pas gagnée —, et ce qu'elle a donné.
 * La page la lit, et le bouton de l'accueil aussi (`accueilDuCabinet`) : la même visite, la même règle de « À jouer ».
 */
function visiteVue(l: LectureDeLAccueil): PageDuCabinet['visite'] {
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
  const sait: CeQueSaitLeCabinet = { rangees: l.rangees, dus: new Set(gardiensDus(m).map(d => d.legendaire)) }
  return {
    maintenant: l.maintenant,
    salles: sallesDe(m, l.jeux, sait),
    gardiens: {
      tous: GARDIENS.map(g => gardienVu(m, g, sait)),
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
    jeux: [...l.jeux],
    // Champ par champ, comme le reste : ce que la dépense vient de réveiller, et rien d'autre.
    ...(l.reveil && {
      reveil: { gardiens: l.reveil.gardiens.map(g => ({ legendaire: g.legendaire, neuf: g.neuf })), ...(l.reveil.compagnon && { compagnon: l.reveil.compagnon }) },
    }),
  }
}

/**
 * Le gros bouton de l'accueil : ses œuvres sur toutes, et si la visite du jour
 * attend un geste — sa vue même, que la page reçoit, lue par la règle du musée
 * (`visiteAJouer`) : une case d'un jeu « bientôt » n'attend que si l'échange
 * du jour peut encore la changer. Rien de la visite au-delà : ni son jeu, ni
 * l'œuvre qu'elle vise.
 */
export function accueilDuCabinet(l: LectureDeLAccueil): CabinetDAccueil {
  return { oeuvres: possedees(l.musee).size, sur: OEUVRES.length, aJouer: visiteAJouer(visiteVue(l)) }
}
