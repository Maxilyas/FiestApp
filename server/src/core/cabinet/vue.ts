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
import {
  CHANGEMENTS_PAR_PARTIE,
  CHASSES_PAR_JOUR,
  COEURS_D_UNE_MONTEE,
  ECLAIRAGES_PAR_PARTIE,
  ETOILES_D_UNE_PARTIE,
  ETOILES_PAR_MANCHE,
  LIBRES_QUI_PAIENT,
  MANCHES_PAR_PARTIE,
  SEUILS_DES_RARETES,
  VAGUES_DE_LA_FRISE,
} from '../../../../shared/cabinet/bareme'
import { deplier, estUneFriseDeSujet, idDeLaFriseATheme, idDuLieu } from '../../../../shared/cabinet/pieces'
import { PREFIXE_DE_LA_FRISE } from '../../../../shared/frise'
import { dansLesTemps, echeanceDe, pauseEnCours, pauseResteMs } from '../../../../shared/cabinet/chrono'
import { regleDe } from '../../../../shared/cabinet/jeux/index'
import {
  AUCUN_AUTRE_JEU,
  caseCommencee,
  chassesRestantes,
  dorees,
  enjeuDe,
  gardiensDus,
  libresQuiPaientEncore,
  possedees,
  prixDe,
  prochainGardien,
  refusDeLEchange,
  retenteDeLaCase,
  serieMontree,
  seuilDeLaCase,
  soldeDe,
  type EnjeuDUneCase,
  type Musee,
  type OrigineDUneOeuvre,
} from '../../../../shared/cabinet/musee'
import { JEU_DE_L_OEUVRE, OEUVRES, OEUVRES_DE_DEPART, estUneOeuvre, oeuvre, oeuvresDeLaSalle, type CleDOeuvre } from '../../../../shared/cabinet/oeuvres'
import {
  bilanDe,
  etapeEnCours,
  etoilesDesManches,
  jouerUnGeste,
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
import { POUVOIRS, ceQueFaitLaCarte } from '../../../../shared/cabinet/pouvoirs'
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
  TourVue,
  VisiteVue,
  VueDeLaPartie,
} from '../../../../shared/cabinet/vues'
import type { RecordDeLaTour, TourDuJour } from '../../../../shared/cabinet/montee'
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
  // Une porte de la tour sans œuvre — un cœur, les étoiles doublées — n'a rien du musée en jeu, comme une partie libre.
  if (d.origine === 'libre' || (d.origine === 'montee' && d.cible === null)) return null
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

/**
 * La révélation d'une manche tranchée : le corps de son jeu, ses pièces que « Signaler une erreur » peut viser — les questions
 * de la base seules —, et, misée, si la mise est gagnée : le titre du corps vient du jeu, qui ne sait rien d'elle.
 */
function revelationDe(d: DepartDUnePartie, e: EtatDeLaPartie, m: MancheDuPli): RevelationVue | undefined {
  if (!m.verdict || !m.fin) return undefined
  return {
    manche: m.manche,
    tirage: m.tirage,
    fin: m.fin,
    signalables: e.pieces.filter(p => p.manche === m.manche && !horsDeLaBase(p.piece.id)).map(p => p.position),
    corps: regleDe(d.jeu).reveler(d.tirages[m.tirage], m.etat, m.verdict) as RevelationVue['corps'],
    ...(e.misee === m.manche && { misee: m.verdict.naturel === ETOILES_PAR_MANCHE ? ('gagnee' as const) : ('perdue' as const) }),
  }
}

/**
 * Ce que vaut chaque manche à présent, et pourquoi ses étoiles diffèrent de
 * ses naturelles — « +3 : mise gagnée », « +1 : protégée » —, ou pourquoi ses
 * trois étoiles ne dorent pas de cadre : une manche aidée le dit (« éclairée »,
 * « changée », « temps en plus »). À la tablée du 25 octobre 2026, un 9 sur 9
 * entrait sans cadre doré sans un mot, et « +2 : mise gagnée » se lisait comme
 * un gain que le plafond de la partie avait mangé : la note le dit
 * (« au-delà de 9 »).
 */
function manchesDe(d: DepartDUnePartie, e: EtatDeLaPartie): MancheVue[] {
  const finie = e.fin !== null
  const etoiles = etoilesDesManches(d, e)
  const auDelaDuPlafond = etoiles.reduce((n, x) => n + (x.etoiles ?? 0), 0) > ETOILES_D_UNE_PARTIE
  return etoiles.map((x, k) => {
    const m = e.manches[k]
    const notes: string[] = []
    if (x.naturel !== null && x.etoiles !== null) {
      if (x.misee) notes.push(x.naturel === ETOILES_PAR_MANCHE ? `+${x.etoiles - ETOILES_PAR_MANCHE} : mise gagnée${auDelaDuPlafond ? `, au-delà de ${ETOILES_D_UNE_PARTIE}` : ''}` : 'Mise perdue')
      else if (x.protegee && x.etoiles > x.naturel) notes.push(`+${x.etoiles - x.naturel} : protégée`)
      if (m?.etapes.some(s => s.eclairee)) notes.push('éclairée')
      if (m && m.tirage >= MANCHES_PAR_PARTIE) notes.push('changée')
      if (m?.etapes.some(s => s.tempsEnPlus)) notes.push('temps en plus')
    }
    const note = notes.length > 0 ? notes.join(' · ') : undefined
    const revelation = finie && m ? revelationDe(d, e, m) : undefined
    return { etoiles: x.etoiles, naturel: x.naturel, ...(note && { note }), ...(x.fin && { fin: x.fin }), ...(revelation && { revelation }) }
  })
}

/**
 * Le chrono de l'étape en cours, à l'heure du serveur : son échéance, sa durée, sous la pause ce qui en reste, et ce que
 * Prendre son temps lui a ajouté (sa durée moins sa durée normale, figées à l'ouverture de l'étape par le chrono du départ) :
 * la page y pose le repère du temps en plus, qui ôte le cadre doré.
 */
function chronoDe(m: MancheDuPli | undefined, t: number): VueDeLaPartie['chrono'] {
  if (!m || !leChronoCourt(m)) return undefined
  const etape = etapeEnCours(m)
  const enPlusMs = etape.dureeMs - etape.dureeNormaleMs
  return {
    echeance: echeanceDe(etape, t),
    dureeMs: etape.dureeMs,
    ...(pauseEnCours(etape) && { pauseResteMs: pauseResteMs(etape, t) }),
    ...(enPlusMs > 0 && { enPlusMs }),
  }
}

/**
 * Ce que le bilan sait de la journée, au-delà du bilan figé, quand le serveur
 * tient le musée du jour en mémoire (`PartieLue.aujourdhui`) : « Retenter »
 * et les libres qui paient encore, d'une partie d'aujourd'hui ; le cadre de
 * son œuvre, d'une partie de n'importe quel jour.
 */
interface CeQueSaitLeJour extends Pick<BilanVu, 'retenter' | 'libresQuiPaientEncore'> {
  /**
   * Le cadre de son œuvre est doré à présent — seulement d'un double, qui ne
   * dore rien : il l'était déjà à sa fin, ou l'est devenu depuis. Absent sans
   * le musée.
   */
  cadreDejaDore?: boolean
}

/**
 * Pourquoi neuf étoiles naturelles n'ont pas doré son cadre : la carte-bonus a
 * servi — la seule de la partie, et Protéger ne relève pas une partie
 * parfaite. « Une œuvre de plus ! » ne disait rien du cadre que Prendre son
 * temps, dans le temps en plus, venait d'ôter (Théo, à la tablée). Un double
 * n'a perdu son cadre que s'il en avait un à dorer : une case de la visite
 * dont l'œuvre s'est dorée le matin — sa dorure achetée, une chasse gagnée
 * dans un cadre doré — se double aussi à neuf sur neuf, et la phrase parlait
 * d'une perte qui n'existait pas. Le bilan figé ne le sait pas ; sans le musée
 * de la mémoire, la phrase se tait plutôt que de l'inventer.
 */
function sansCadreDore(d: DepartDUnePartie, b: BilanDUnePartie, cadreDejaDore: boolean | undefined): string | null {
  if (!b.aidee || !d.carte || !b.naturel.every(n => n === ETOILES_PAR_MANCHE)) return null
  if (b.issue === 'double' && cadreDejaDore !== false) return null
  return `${POUVOIRS[d.carte.pouvoir].nom} a servi`
}

/** « Encore 4 parties libres qui paient aujourd'hui » : ce qu'il en reste, quand le serveur le sait du jour. */
function libresDites(n: number | undefined): string {
  if (n === undefined) return ''
  return n === 0 ? '. Les suivantes se jouent pour le plaisir' : `. Encore ${n} ${n > 1 ? 'parties libres qui paient' : 'partie libre qui paie'} aujourd’hui`
}

/**
 * Ce que dit le bilan de l'œuvre en jeu, en une phrase. Une partie libre se
 * dit à son départ, qui l'a comptée payée ou non (`payee`), jamais à sa
 * poussière : une libre qui paie, finie sans étoile, disait que les libres du
 * jour avaient toutes payé (Hugo, à la tablée du 25 octobre 2026). Payée, la
 * phrase tait le nombre que la ligne de la poussière du bilan dit déjà, et le
 * jour : « Mes réponses » la relit la semaine d'après, et une libre commencée
 * avant minuit finit le lendemain.
 */
function bilanDit(d: DepartDUnePartie, b: BilanDUnePartie, jour: CeQueSaitLeJour): string {
  const nom = nomDe(d.cible ?? undefined)
  const servi = sansCadreDore(d, b, jour.cadreDejaDore)
  switch (b.issue) {
    case 'gagnee':
      return `${d.origine === 'montee' ? 'La porte s’ouvre : ' : ''}${nom} entre dans ton musée${servi ? ` — sans cadre doré : ${servi}` : ''}`
    case 'gagnee-doree':
      return `${d.origine === 'montee' ? 'La porte s’ouvre : ' : ''}${nom} entre dans ton musée, dans un cadre doré`
    case 'doree':
      return `${nom} prend son cadre doré`
    case 'double':
      return `${nom} était déjà à toi : sa poussière d’or en plus${servi ? ` — sans cadre doré : ${servi}` : ''}`
    case 'manquee':
      if (d.origine === 'montee') return `La porte reste fermée : il fallait ${d.seuil} étoiles. ${nom} reste à gagner, et la montée perd un cœur.`
      if (d.but === 'dorer') return servi ? `Pas de dorure cette fois : ${servi}` : 'Pas de dorure cette fois'
      return `Pas assez d’étoiles cette fois. Il en fallait ${d.seuil}. L’œuvre reste à gagner.`
    case 'libre':
      if (d.origine === 'montee') return porteDite(d, b)
      if (d.origine !== 'libre') return 'Tout ton musée est doré : cette partie rapporte de la poussière d’or'
      if (!d.payee) return `Les ${LIBRES_QUI_PAIENT} parties libres du jour ont payé : celle-ci se joue pour le plaisir`
      return b.poussiere > 0 ? 'Une des parties libres qui paient' : `Aucune étoile cette fois : pas de poussière d’or${libresDites(jour.libresQuiPaientEncore)}`
  }
}

/** Ce qu'une porte de la tour sans œuvre a fait : ouverte, ce qu'elle donne ; fermée, le cœur qu'elle coûte. */
function porteDite(d: DepartDUnePartie, b: BilanDUnePartie): string {
  if (b.total < (d.seuil ?? 0)) return `La porte reste fermée : il fallait ${d.seuil} étoiles, et la montée perd un cœur.`
  return d.montee?.butin === 'coeur' ? 'La porte s’ouvre : un cœur de plus pour la montée.' : 'La porte s’ouvre : les étoiles de l’étage comptent double.'
}

/**
 * Ce que le bilan d'une partie dit du reste de la journée, quand le serveur
 * tient le musée du jour en mémoire (`PartieLue.aujourdhui`) : « Retenter »
 * une partie de la visite manquée aujourd'hui, par sa case ; les libres qui
 * paient encore, après une libre payée qui n'a rien rapporté. Une partie d'un
 * jour d'avant n'a rien à en dire — la case du même rang, aujourd'hui, est une
 * autre. Le cadre de l'œuvre d'un double, lui, se lit au musée d'aujourd'hui
 * pour une partie de n'importe quel jour : un cadre doré ne se perd jamais.
 */
function leJourDuBilan(p: PartieLue, b: BilanDUnePartie): CeQueSaitLeJour {
  const jour = p.aujourdhui
  if (!jour) return {}
  const d = p.depart
  if (b.issue === 'double') return d.cible !== null && estUneOeuvre(d.cible) ? { cadreDejaDore: dorees(jour.musee).has(d.cible) } : {}
  if (!jour.musee.duJour.parties.some(x => x.id === p.id)) return {}
  if (d.origine === 'visite' && d.visite !== undefined && b.issue === 'manquee') {
    const retenter = retenteDeLaCase(jour.musee, jour.visite, d.visite, jour.jeux)
    return retenter ? { retenter } : {}
  }
  return d.origine === 'libre' && d.payee && b.poussiere === 0 ? { libresQuiPaientEncore: libresQuiPaientEncore(jour.musee) } : {}
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
  const leJour = leJourDuBilan(p, b)
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
    dit: bilanDit(p.depart, b, leJour),
    ...(b.oeuvre !== undefined && estUneOeuvre(b.oeuvre) && { oeuvre: b.oeuvre }),
    ...(p.cartelDeSonOeuvre && { devientSonCartel: true as const }),
    ...(gardiens.length > 0 && { gardiens: gardiens.map(g => ({ legendaire: g.legendaire, neuf: g.neuf })) }),
    ...(gains && { gains }),
    ...(leJour.retenter && { retenter: leJour.retenter }),
    ...(leJour.libresQuiPaientEncore !== undefined && { libresQuiPaientEncore: leJour.libresQuiPaientEncore }),
  }
}

/**
 * Ce que vaudrait la partie quittée à cet instant (`VueDeLaPartie.siTuQuittes`) :
 * « Quitter » joué par le pli sur l'état, à l'heure de la vue, puis son bilan —
 * le chemin même de la fin, sans rien écrire : la règle qui changera
 * changera ce qu'il dit. L'œuvre en jeu, telle que le départ la tenait — rien
 * ne la change pendant une partie (`refusDeLAchat`) ; une partie quittée n'a
 * jamais trois manches parfaites, et son cadre doré ne s'y joue pas. Rien pour
 * une partie finie, ni pour une manche dont le temps est écoulé : la page
 * envoie d'elle-même sa réponse, et la révélation vient avec.
 */
function siTuQuittesDe(d: DepartDUnePartie, e: EtatDeLaPartie, t: number): VueDeLaPartie['siTuQuittes'] {
  if (e.fin) return undefined
  const m = mancheEnCours(e)
  if (m && !m.verdict && leChronoCourt(m) && !dansLesTemps(etapeEnCours(m), t)) return undefined
  const quittee = jouerUnGeste(d, e, { quoi: 'quitter' }, t)
  if (typeof quittee === 'string') return undefined
  const b = bilanDe(d, quittee, d.cible === null ? null : { possedee: d.but === 'dorer', doree: false })
  return { total: b.total, poussiere: b.poussiere }
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
  const siTuQuittes = siTuQuittesDe(d, e, t)
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
    ...(siTuQuittes && { siTuQuittes }),
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
 * Ce que son cartel promet, tant que son cadre n'est pas doré : jouée en
 * chasse à son jeu pour le dorer, elle prendra le cartel de cette partie-là.
 * Doré, rien ne le lui donnera plus — la phrase se tait plutôt que de
 * promettre. « Joue-la », jamais « Rejoue-la » : offerte ou achetée, elle n'a
 * jamais été jouée, et la phrase tombait juste au-dessus de « La jouer à
 * l'Épingle pour la dorer » (la tablée du 26 octobre 2026, `Oeuvre.tsx`).
 */
const CE_QUE_GARDERA_LE_CARTEL = 'Joue-la à son jeu pour dorer son cadre : elle gardera ici ce que tu auras appris.'

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
 * La visite du jour, case par case : son jeu, son enjeu — jamais l'œuvre visée d'une case pas gagnée —, et ce qu'elle a donné ;
 * le seuil que son départ figera (pour dorer, celui de son double), et, manquée, « Retenter » par sa case : la page les lit
 * ici, sans relire le barème ni la règle des départs. La page la lit, et le bouton de l'accueil aussi (`accueilDuCabinet`) : la
 * même visite, la même règle de « À jouer ». Le calibrage aussi (`calibrage-cabinet.ts`) : ses joueurs choisissent leur échange
 * sur elle, comme la page, jamais sur la règle des échanges.
 */
export function visiteVue(l: LectureDeLAccueil): PageDuCabinet['visite'] {
  const m = l.musee
  const cases = l.visite.cases.map((c, k): CaseVue => {
    const jouee = m.duJour.parties.find(p => p.origine === 'visite' && p.visite === k)
    const gagnee = jouee?.issue === 'gagnee' || jouee?.issue === 'gagnee-doree' || jouee?.issue === 'doree'
    const enJeu = enjeuDe(m, c)
    const seuil = seuilDeLaCase(c)
    const retenter = retenteDeLaCase(m, l.visite, k, l.jeux)
    return {
      jeu: c.jeu,
      enJeu,
      faite: caseCommencee(m, k),
      ...(jouee?.issue && { issue: jouee.issue }),
      ...(gagnee && c.cible !== null && { oeuvre: c.cible as CleDOeuvre }),
      ...(!l.jeux.includes(c.jeu) && { bientot: true as const }),
      ...(seuil !== null && ('pourDorer' in enJeu ? { seuilDuDouble: seuil } : { seuil })),
      ...(retenter && { retenter }),
    }
  })
  // Une case encore à jouer, s'il en reste une : la seule règle des échanges dit le reste. Possible, le jeu qu'il donnerait, le
  // même pour toute case : la page le nomme sur son bouton et dans sa confirmation, et ne part plus à l'aveugle.
  const libre = l.visite.cases.findIndex((_, k) => !caseCommencee(m, k))
  const refus = refusDeLEchange(m, l.visite, libre < 0 ? 0 : libre, l.jeuDeLEchange)
  const echange: VisiteVue['echange'] = refus !== null || l.jeuDeLEchange === null ? { possible: false, refus: refus ?? AUCUN_AUTRE_JEU } : { possible: true, jeu: l.jeuDeLEchange }
  return { jour: l.visite.jour, cases, echange }
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
    tour: tourVue(l.tour, m.record),
    // Champ par champ, comme le reste : ce que la dépense vient de réveiller, et rien d'autre.
    ...(l.reveil && {
      reveil: { gardiens: l.reveil.gardiens.map(g => ({ legendaire: g.legendaire, neuf: g.neuf })), ...(l.reveil.compagnon && { compagnon: l.reveil.compagnon }) },
    }),
  }
}

/** La tour, champ par champ : la montée, l'étage à jouer et ses portes, le record — rien de la graine qui les a tirées. */
function tourVue(t: TourDuJour, record: RecordDeLaTour | null): TourVue {
  const m = t.montee
  return {
    montee: m && {
      n: m.n,
      carte: m.carte,
      coeurs: m.coeurs,
      etoiles: m.etoiles,
      hauteur: m.hauteur,
      enCours: m.enCours,
      finie: m.finie,
      sommet: m.sommet,
      etages: m.etages.map(e => ({ etage: e.etage, jeu: e.jeu, butin: e.butin, oeuvre: e.cible, seuil: e.seuil, total: e.total, ouverte: e.ouverte, etoiles: e.etoiles })),
    },
    aJouer: t.aJouer && {
      n: t.aJouer.n,
      etage: t.aJouer.etage,
      coeurs: t.aJouer.coeurs,
      portes: t.aJouer.portes.map(p => ({ porte: p.porte, jeu: p.jeu, butin: p.butin, oeuvre: p.cible, seuil: p.seuil, coffre: p.coffre })),
    },
    record: record && { etage: record.etage, etoiles: record.etoiles },
    coeurs: COEURS_D_UNE_MONTEE,
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
