import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Icon } from './Icon'
import { GrosBouton } from './Pieces'
import { LienConsole } from './LienConsole'
import { spacePath } from '../routes'
import { api } from '../api'
import { PAGE_DES_DUELS, adresseDuDuel } from '../views/adressesDesDuels'
import type { PublicSpace } from '../../../shared/space'
import { jourDe, type CarriereDuJour } from '../../../shared/jour'
import { espacesFines } from '../format'
import { branche, deLaBranche } from '../../../shared/branches'
import { PALIER_DU_MAITRE, type SentiersDAccueil } from '../../../shared/sentiers'
import type { DefiDAccueil } from '../../../shared/campagne'
import { placeDuJour } from '../../../shared/course'
import { DUELS_POUR_LA_RECOMPENSE, ligueParCle, type DuelsDAccueil } from '../../../shared/duels'
import type { CabinetDAccueil } from '../../../shared/cabinet/vues'
// Il n'importe rien, et l'en-tête de l'accueil le tire déjà par `shared/legendaires.ts` (`Identite.tsx`).
import { EXPEDITION_EN_PRODUCTION, EXPEDITION_REMPLACEE } from '../../../shared/jokers'
import type { AnnonceDeLAdministrateur, ProfilDAccueil } from '../../../shared/profil'
import { saison } from '../../../shared/saisons'
// Ses cartes n'importent que ce que l'accueil a déjà : l'en-tête tire `shared/profil.ts` (`Identite.tsx`).
import { CarteDeLAdministrateur } from './CarteDeLAdministrateur'
// Ils n'importent rien : le premier script de chaque page les lit déjà (`main.tsx`).
import { BOUTON_BIENTOT, BOUTON_EN_MAINTENANCE, PASTILLE_AVANT_PREMIERE, type BoutonDeLaPage, type PageEnMaintenance } from '../../../shared/maintenance'
import { boutonEteint, cabinetIci } from '../maintenance'
import { BlasonDeLigue } from './Blason'
import { PastilleNouveau } from './AfficheDeLaNouveaute'
import type { PageALAffiche } from '../../../shared/affiches'

// L'accueil, selon qui le tient.
//
// Un profil n'y voit que ce qu'il vient faire (`AccueilJouer`) : l'animateur
// lié à un profil y avait aussi sa carte « J'anime », qui ne faisait plus que
// doubler des portes qu'il a déjà — « Créer un salon » au-dessus, « Mes
// quiz » et « Compte » dans le menu, l'écran commun et l'historique dans
// son Compte (la remarque du propriétaire du 3 octobre 2026). Seule la
// console ouverte ici sans profil la garde : elle n'a ni menu ni salon.

/**
 * « J'anime », pour la console ouverte sur ce navigateur sans profil : ce
 * que l'animateur fait de son espace — l'écran commun, ses quiz, son
 * compte, l'historique —, au-dessus de « Me connecter ».
 */
export function JAnime({ espace }: { espace: PublicSpace }) {
  return (
    <section className="card ce-soir" aria-labelledby="accueil-j-anime">
      <h3 id="accueil-j-anime">
        <Icon name="monitor" />
        J’anime
        <span className="accueil-espace">{espace.title}</span>
      </h3>
      {/* Ouvert par la console (« Accueil », dans sa bande), il y ramène au
          lieu d'en ouvrir une seconde dans cet onglet. */}
      <LienConsole className="btn btn-primary btn-block" />
      <div className="ce-soir-autres accueil-raccourcis">
        <a className="btn btn-small" href="/edit">
          <Icon name="edit" />
          Mes quiz
        </a>
        <a className="btn btn-small" href="/compte">
          <Icon name="users" />
          Mon compte
        </a>
        <a className="btn btn-small" href={spacePath(espace.slug, 'soirees')}>
          <Icon name="book" />
          Historique
        </a>
      </div>
    </section>
  )
}

/**
 * La ligne d'un bouton de l'accueil (l'accueil compact du 9 novembre 2026,
 * `retours/2026-11-09/accueil-compact/`) : chaque bouton est une rangée, et
 * une rangée n'a qu'une ligne sous son titre. `detail` dit l'essentiel — ce
 * qui l'attend là, en une trentaine de caractères : il tient à côté d'une
 * pastille en 360 de large — ; `suite`, ce que la phrase ajoute, morceau par
 * morceau, chacun avec sa ponctuation : la rangée ne montre que ceux qui
 * tiennent entiers (`GrosBouton`), le lecteur d'écran lit tout. Une phrase
 * d'avant dont le début disait déjà l'essentiel est restée la même, coupée à
 * ses jointures ; les autres ont pris les mots de la maquette.
 */
export interface LigneDuBouton {
  detail: string
  suite?: string[]
}

/**
 * Le bouton de la campagne : le sentier qu'il avance, puis ses vies ; tant
 * qu'il n'en avance aucun, les deux modes, et la série d'abord. Il ouvre la
 * campagne, jamais un sentier seul : mené à `#sentier-scene`, « la
 * campagne » ouvrait la scène sans les onglets de la campagne. Sur ses
 * sentiers, celui qu'il avance est en tête, à un toucher. Le défi de la
 * semaine a quitté ce bouton pour le sien, sous le quiz du jour
 * (`boutonDuDefi`) ; les défis de ses amis sont au bouton des duels
 * (`boutonDesDuels`).
 */
export function boutonDeLaCampagne(c: SentiersDAccueil | undefined): LigneDuBouton & { href: string; pastille?: string } {
  const b = branche(c?.avance?.branche)
  // Le carnet passe devant le sentier — pas devant une épreuve laissée en route : c'est le rendez-vous du lendemain,
  // que seul l'onglet comptait, deux écrans plus loin. L'adresse du carnet (`ADRESSE_DU_CARNET`) écrite ici, comme celle des sentiers.
  if (c?.aRevoir && !c.avance?.laissee) {
    const n = c.aRevoir
    return {
      // Sa pastille dit déjà « À revoir » : le compte d'abord, la phrase d'avant à la suite.
      detail: n > 1 ? `${n} questions de ton carnet` : 'Une question de ton carnet',
      suite: n > 1 ? [' t’attendent', espacesFines(' : revois-les pour les apprendre')] : [' t’attend', espacesFines(' : revois-la pour l’apprendre')],
      href: '/campagne#carnet',
      pastille: 'À revoir',
    }
  }
  // « les sentiers de tes avatars » : quels avatars, et qu'est-ce qu'un sentier ? (l'experte du jeu solo, le 11 octobre 2026)
  // Ce qu'on y gagne : les deux modes sur une ligne (« Une série sans fin, ou des portraits à gagner » en prenait deux).
  if (!c?.avance || !b) return { detail: 'Une série sans fin, des portraits', suite: [' à gagner'], href: '/campagne' }
  // Un nombre ne quitte pas son mot : « palier 5 », « 11 vies ».
  const palier = c.avance.palier === PALIER_DU_MAITRE ? `palier de maître ${deLaBranche(b)}` : `palier\u00a0${c.avance.palier} ${deLaBranche(b)}`
  const vies = `${c.vies}\u00a0vie${c.vies > 1 ? 's' : ''}`
  // Ses vies à la suite, pas dans l'essentiel : « Palier de maître du tour du monde · 12 vies » ne tient pas en 360 de large,
  // et coupé au bout il perdait justement ses vies. Sans vie, « plus de vie » d'abord — c'est ce qui l'arrête —, « avant
  // minuit » ensuite.
  const suiteDesVies = c.vies > 0 ? [` · ${vies}`] : [' · plus de vie', ' avant minuit']
  return {
    // Une épreuve laissée en route passe devant son palier : c'est elle qui l'attend.
    ...(c.avance.laissee ? { detail: 'Épreuve en cours', suite: [...suiteDesVies, ` · ${palier}`] } : { detail: palier.charAt(0).toUpperCase() + palier.slice(1), suite: suiteDesVies }),
    // L'adresse des sentiers (`ADRESSE_DES_SENTIERS`), écrite ici : l'importer
    // ferait venir toute la page des sentiers dans celle de l'accueil.
    href: '/campagne#sentiers',
  }
}

/** « 8 bonnes réponses » : le nombre ne quitte pas ses mots à la ligne. */
const bonnesReponses = (n: number) => `${n} bonne${n > 1 ? 's' : ''} réponse${n > 1 ? 's' : ''}`

/**
 * Le bouton du quiz du jour : sa série d'abord — c'est elle qu'on vient
 * tenir, et sa pastille dit déjà « À jouer » —, sinon ce qu'il est. Joué, il
 * le dit, sa série avec. Une fête en cours dont le timbre lui manque passe
 * devant : c'est là qu'il se gagne, ses jours comptés.
 */
export function boutonDuJour({ joue, serie, fete }: { joue: boolean; serie: number; fete?: { emoji: string } }): LigneDuBouton {
  // « 12 jours » d'un bloc : « jours » restait seul sur sa ligne en 360.
  const saSerie = serie > 1 ? `série de ${serie} jours` : ''
  if (joue) return { detail: saSerie ? `Joué · ${saSerie}` : 'Joué aujourd’hui' }
  if (fete) return { detail: `${fete.emoji} Un timbre à gagner`, ...(saSerie && { suite: [` · ${saSerie}`] }) }
  return { detail: saSerie ? saSerie.charAt(0).toUpperCase() + saSerie.slice(1) : 'Dix questions pour tous' }
}

/**
 * Le bouton du défi de la semaine, sous le quiz du jour : ceux qui l'ont
 * relevé, le sien à reprendre, ou sa place une fois relevé — ce que sa page
 * montre (`defiDAccueil`).
 */
export function boutonDuDefi(d: DefiDAccueil | undefined): LigneDuBouton & { pastille?: string } {
  // Une base qui s'en est tue : ce qu'il est, sans un chiffre — sa page dira le reste.
  if (!d) return { detail: 'La même série pour tous', suite: [', jusqu’à dimanche'] }
  if (d.releve) {
    // « 4ᵉ place sur 10 » d'un bloc : coupée, elle laissait « 10 » seul sur sa ligne. Loin des premiers, ni place ni rang.
    const place = placeDuJour(d.releve.rang, d.joueurs, d.releve.justes)
    // Sa place d'abord — c'est elle qu'on vient lire —, ses bonnes réponses à la suite : les deux ne tiennent pas en 360.
    return place
      ? { detail: `Relevé · ${place.replace(/ /g, '\xa0')}`, suite: [` · ${bonnesReponses(d.releve.justes)}`] }
      : { detail: espacesFines(`Relevé : ${bonnesReponses(d.releve.justes)}`) }
  }
  if (d.enCours) {
    // Sa pastille dit « À finir » : où il en est, puis le geste.
    return { detail: d.enCours.justes > 0 ? bonnesReponses(d.enCours.justes) : 'Ton défi t’attend', suite: [espacesFines(' : reprends-le')], pastille: 'À finir' }
  }
  const n = d.joueurs
  return {
    detail: n > 1 ? `${n} joueurs l’ont relevé` : n === 1 ? 'Un joueur l’a relevé' : 'À toi d’ouvrir le bal',
    suite: [' · jusqu’à dimanche'],
    pastille: 'À relever',
  }
}

/** « un résultat à voir », « 3 défis à relever » : ce que compte le chiffre rouge, pour l'oreille. */
const aVoir = (n: number) => (n > 9 ? 'plus de 9 résultats à voir' : n > 1 ? `${n} résultats à voir` : 'un résultat à voir')
const aRelever = (n: number) => (n > 9 ? 'plus de 9 défis à relever' : n > 1 ? `${n} défis à relever` : 'un défi à relever')

/**
 * Le bouton des duels (le souhait du propriétaire du 11 octobre 2026 : une
 * tuile de l'accueil sous le quiz du jour) : un duel qu'il a lancé et que
 * l'autre vient de jouer passe devant — la tuile s'allume, « X a joué ton
 * duel » (la maquette A4, choisie par le propriétaire le 12 octobre 2026 :
 * « on ne sait pas quand quelqu'un a terminé si on a gagné ou pas ») —, puis
 * un duel qu'on lui a envoyé — qui le défie —, tous comptés en rouge, puis
 * son duel laissé en route ; sinon sa ligue, sa cote et ce qui manque à sa
 * récompense de lundi — ou ce qu'elle rapportera. Avant son premier duel, ce
 * qu'on y fait.
 */
export function boutonDesDuels(d: DuelsDAccueil | undefined): LigneDuBouton & { compteur?: { n: number; label: string }; allume?: true } {
  if (d?.resultats && d.resultats.n > 0) {
    const { n, de } = d.resultats
    const recus = d.defisRecus?.n ?? 0
    return {
      ...(n > 1 ? { detail: `${de} et ${n - 1} autre${n > 2 ? 's' : ''} ont joué`, suite: [' tes duels'] } : { detail: `${de} a joué ton duel` }),
      compteur: { n: n + recus, label: recus > 0 ? `${aVoir(n)} et ${aRelever(recus)}` : aVoir(n) },
      allume: true,
    }
  }
  if (d?.defisRecus && d.defisRecus.n > 0) {
    const { n } = d.defisRecus
    const autres = n - 1
    // « et 2 autres », sans « amis » : on peut être défié par qui l'on ne connaît pas encore.
    return {
      detail: `${d.defisRecus.de} te défie${autres > 0 ? `, et ${autres} autre${autres > 1 ? 's' : ''}` : ''}`,
      suite: [espacesFines(' : à toi de jouer')],
      // Blanc sur rouge, en haut à droite, comme des messages qui attendent (le souhait du propriétaire du 12 octobre
      // 2026) : la pastille dorée « 3 défis » se fondait parmi « À relever » et « À jouer », sur les boutons du dessus.
      // Le serveur n'en lit que dix (`DEFIS_RECUS_MONTRES`) : passé neuf, il peut y en avoir plus.
      compteur: { n, label: aRelever(n) },
    }
  }
  // Un prénom long ne coupe pas la phrase au milieu d'un mot : « t'attend » ne paraît qu'entier.
  if (d?.enCours) return { detail: `Ton duel contre ${d.enCours.nom}`, suite: [' t’attend'] }
  // Le dé ne joue que contre Automate (le 13 octobre 2026) : « un joueur au hasard » promettait quelqu'un.
  if (!d || d.joues === 0) return { detail: 'Défie qui tu veux', suite: [', ou Automate', espacesFines(' : monte de ligue')] }
  const manque = DUELS_POUR_LA_RECOMPENSE - d.semaine.duels
  // Le lundi, ce que la semaine passée vient de verser — tant que la nouvelle n'a pas son premier duel :
  // sans lui, la récompense arrivait au solde sans un mot, et la tuile redisait « encore 3 duels ».
  if (d.semainePassee && d.semaine.duels === 0) {
    const ligue = ligueParCle(d.semainePassee.ligue).nom
    return {
      detail: `+${d.semainePassee.confettis}\u00a0confettis pour ta semaine`,
      suite: [` en ${ligue.charAt(0).toLowerCase()}${ligue.slice(1)}`, ` · encore ${manque}\u00a0duels pour la prochaine`],
    }
  }
  // Un nombre ne quitte pas son mot à la ligne : « cote » d'un côté, « 1084 » de l'autre.
  return {
    detail: `${ligueParCle(d.ligue).nom} · cote\u00a0${d.cote}`,
    // Ce que sa semaine attend encore de lui, à la suite : la phrase entière fait 58 caractères, une rangée de téléphone en
    // montre une quarantaine (`rendu-accueil.ts`). Elle paraît là où la rangée a la place — une tablette, un ordinateur —, et
    // se lit toujours à l'oreille.
    suite: [` · ${manque > 0 ? `encore ${manque}\u00a0duel${manque > 1 ? 's' : ''} pour ta récompense` : `+${ligueParCle(d.semaine.ligue).confettis}\u00a0confettis lundi`}`],
  }
}

/**
 * Le bouton du Cabinet : sa traversée en route — « Acte 2 sur 3 · 4 cœurs »,
 * « En route ». Le serveur ne la dit que d'une traversée qu'il a en mémoire
 * (`ProfilDAccueil.cabinet`) : sinon, la ligne de toujours, ce qu'on y fait,
 * plutôt qu'un aller-retour de plus à chaque accueil.
 */
export function boutonDuCabinet(c: CabinetDAccueil | undefined): LigneDuBouton & { pastille?: string } {
  // Ce qu'on y gagne d'abord : « Trois actes, trois gardiens, un légendaire au bout » passait sur deux lignes, et coupée
  // au bout elle perdait justement son légendaire.
  if (!c) return { detail: 'Un légendaire au bout', suite: [' · trois actes, trois gardiens'] }
  // « sur 3 » et « 4 cœurs » d'un bloc chacun : coupée ailleurs, la ligne laissait un chiffre seul en 360, à côté de la pastille.
  return { detail: `Acte ${c.acte} sur 3 · ${c.coeurs} ${c.coeurs > 1 ? 'cœurs' : 'cœur'}`, pastille: 'En route' }
}

/** Rien de fermé, rien d'essayé avant tout le monde. */
const RIEN_DE_FERME: Partial<Record<PageEnMaintenance, BoutonDeLaPage>> = {}
/** Aucune page à l'affiche. */
const RIEN_DE_NOUVEAU: readonly PageALAffiche[] = []

/**
 * L'accueil d'un profil : ce qu'on vient faire, en gros boutons — une soirée
 * où l'on joue déjà passe devant tout (« Revenir chez Hugo »), puis la
 * campagne, le quiz du jour, le défi de la semaine, les duels, l'Expédition,
 * le Cabinet de curiosités, créer un salon, rejoindre une soirée.
 * Chacun ouvre sa page, qui en dit plus : un toucher de plus qu'une carte qui
 * montrait tout, mais un écran qu'on lit d'un coup d'œil.
 *
 * En lignes depuis le 9 novembre 2026 (« j'aimerais que tout soit visible
 * sans avoir à scroll plus bas », le propriétaire ; la maquette « Les
 * lignes », `retours/2026-11-09/accueil-compact/`) : une carte par section,
 * ses boutons dedans, un filet entre eux, une seule ligne sous chaque titre
 * (`LigneDuBouton`). Empilés, chacun sur deux ou trois lignes de texte, ils
 * faisaient 1096 px en 360 × 640 pour 575 visibles au-dessus du menu. Les
 * lignes partent de 48 px et se partagent la hauteur de l'écran
 * (`--jouer-part`, la part de chaque section : une par ligne) ; « Entre
 * amis », deux boutons côte à côte dans la même carte. Le quiz du jour et le
 * défi de la semaine s'y voient tous les deux : la tuile à deux onglets du
 * 19 octobre 2026 (`JourEtDefi`) montrait le défi sans prendre un bouton de
 * plus ; en lignes, les deux tiennent dans sa place, sans onglet à toucher.
 * Mêmes boutons, mêmes noms, mêmes adresses, dans l'ordre d'avant.
 *
 * Il remplace « Je joue » et « Ce soir », dont les boutons changeaient de
 * place et de taille selon l'heure et les rôles. Tout le monde a son salon :
 * il n'y a plus de porte d'animateur à chercher.
 *
 * Une page fermée — en maintenance, ou bientôt disponible — éteint son
 * bouton, et sa ligne dit pourquoi : on ne l'apprenait qu'en touchant. Le
 * défi fermé seul éteint sa ligne, sous le quiz du jour. Une page qu'il essaie
 * avant tout le monde le dit d'une pastille. Une page à l'affiche
 * (`shared/affiches.ts`) dit « Nouveau » tant qu'il n'y est pas allé — après
 * ce qui l'attend déjà là : « À jouer », un résultat, une traversée en route.
 */
export function AccueilJouer({
  enCours,
  onRejoindre,
  lendemain,
  jour,
  aujourdhui,
  campagne,
  defi,
  duels,
  traversee,
  fete,
  etats = RIEN_DE_FERME,
  cabinet = cabinetIci(),
  remplacee = EXPEDITION_REMPLACEE,
  nouvelles = RIEN_DE_NOUVEAU,
}: {
  enCours: { nom: string; slug: string }[]
  onRejoindre: () => void
  lendemain: ReactNode
  /** Sa carrière au quiz du jour : sa série, et s'il a déjà joué aujourd'hui. */
  jour?: CarriereDuJour
  /** Le jour de Paris, dit par le serveur (`ProfilDAccueil.aujourdhui`). */
  aujourdhui?: string
  /** Ses sentiers : ses vies, et celui qu'il avance. */
  campagne?: SentiersDAccueil
  /** Le défi de la semaine : qui l'a relevé, et sa tentative — sa place, une fois relevé. */
  defi?: DefiDAccueil
  /** Ses duels : sa ligue, sa cote, sa semaine — et qui le défie. */
  duels?: DuelsDAccueil
  /** Sa traversée du Cabinet, en route : son acte et ses cœurs — dite d'une traversée que le serveur a en mémoire. */
  traversee?: CabinetDAccueil
  /** La fête du jour, et si son timbre de l'année est déjà à lui : la tuile du quiz du jour l'annonce tant qu'il lui manque. */
  fete?: ProfilDAccueil['fete']
  /** Ce que dit le bouton de chaque page fermée, pour lui (`boutonsDesPages`, `client/src/maintenance.ts`). */
  etats?: Partial<Record<PageEnMaintenance, BoutonDeLaPage>>
  /** Le Cabinet de curiosités répond-il sur ce serveur ? Le serveur le dit dans la page (`cabinetIci`) ; fermé, pas de bouton. */
  cabinet?: boolean
  /**
   * L'Expédition a-t-elle laissé place au Cabinet (`EXPEDITION_REMPLACEE`) ?
   * Son départ est fermé partout, la préproduction comprise : un drapeau du
   * code le sait. Une épreuve le force, pour lire l'accueil tel qu'il sera.
   */
  remplacee?: boolean
  /** Les pages à l'affiche où il n'est pas encore allé (`ceQueMontreLAccueil`) : « Nouveau » sur leur bouton. */
  nouvelles?: readonly PageALAffiche[]
}) {
  // Joué aujourd'hui (à l'heure de Paris) : le bouton le dit, sans pastille.
  // Le jour vient du serveur : calculé ici, son `Intl` chargeait les données
  // du français avant le premier écran ; un serveur d'avant ne le dit pas.
  const dernier = jour?.jours[0]?.jour
  const joueAujourdhui = !!dernier && dernier === (aujourdhui ?? jourDe(Date.now()))
  // Éteinte pour lui : en maintenance — pour tous —, ou bientôt disponible sans qu'il l'essaie.
  const eteinte = (page: PageEnMaintenance) => {
    const e = etats[page]
    return e === 'maintenance' || e === 'bientot' ? e : undefined
  }
  // La ligne d'un bouton fermé, coupée à sa jointure : « En maintenance » tient toujours sur la rangée, « : reviens un peu
  // plus tard » là où elle a la place — entière, elle était coupée au bout en 360 de large.
  const pourquoi = (page: PageEnMaintenance): LigneDuBouton => {
    if (etats[page] === 'bientot') return { detail: BOUTON_BIENTOT }
    const [debut, ...reste] = BOUTON_EN_MAINTENANCE.split(/(?= : )/)
    return { detail: debut, suite: reste.map(espacesFines) }
  }
  const enAvantPremiere = (page: PageEnMaintenance) => (etats[page] === 'avant-premiere' ? PASTILLE_AVANT_PREMIERE : undefined)
  // Ce qu'aucune autre pastille ne dit : « Nouveau », sur la page d'une affiche qu'il n'a pas encore ouverte.
  const nouveau = (page: PageALAffiche) => (nouvelles.includes(page) ? <PastilleNouveau /> : undefined)
  const laCampagne = boutonDeLaCampagne(campagne)
  const leDefi = boutonDuDefi(defi)
  const lesDuels = boutonDesDuels(duels)
  const leCabinet = boutonDuCabinet(traversee)
  // Une fête en cours, son timbre de l'année pas encore à lui : le bouton du quiz du jour l'annonce — c'est là qu'il se gagne,
  // ses jours comptés. Gagné, il redit sa ligne de toujours.
  const laFete = fete && !fete.timbre ? saison(fete.cle) : undefined
  const leJour = boutonDuJour({ joue: joueAujourdhui, serie: jour?.serie ?? 0, fete: laFete })
  const avecLExpedition = EXPEDITION_EN_PRODUCTION && !remplacee
  // La part de hauteur de chaque section quand l'écran en a de reste : une par ligne, pour que toutes grandissent du même
  // pas ; les deux boutons d'« Entre amis », côte à côte, un peu plus d'une.
  const part = (lignes: number) => ({ '--jouer-part': lignes }) as CSSProperties
  return (
    <div className="accueil-gestes">
      {/* Il joue déjà quelque part : on y revient d'un toucher, avant tout. */}
      {enCours.map(e => (
        <GrosBouton key={e.slug} principal icone={<Icon name="rotate" />} titre={`Revenir chez ${e.nom}`} detail="Ta soirée continue" href={spacePath(e.slug)} />
      ))}
      {/* Deux sections, nommées : seul, et à plusieurs — quatre boutons de même
          poids ne disaient pas lesquels se jouent sans personne. Chacune sa carte, ses boutons en lignes dedans. */}
      <section className="jouer-section" aria-labelledby="jouer-seul" style={part(4 + (avecLExpedition ? 1 : 0) + (cabinet ? 1 : 0))}>
        <span className="label" id="jouer-seul">
          Seul
        </span>
        <div className="jouer-carte">
          {eteinte('campagne') ? (
            <GrosBouton icone={<Icon name="target" />} titre="La campagne" {...pourquoi('campagne')} ferme={eteinte('campagne')} href="/campagne" />
          ) : (
            <GrosBouton
              icone={<Icon name="target" />}
              titre="La campagne"
              detail={laCampagne.detail}
              suite={laCampagne.suite}
              pastille={laCampagne.pastille ?? enAvantPremiere('campagne') ?? nouveau('campagne')}
              href={laCampagne.href}
            />
          )}
          {/* Le quiz du jour, puis le défi de la semaine, chacun sa ligne et ce qui l'attend : rangé au troisième onglet de
              la campagne, le défi, beaucoup ne savaient pas qu'il existait (le propriétaire, le 19 octobre 2026) ; une tuile à
              deux onglets l'a montré jusqu'au 9 novembre 2026, sans prendre un bouton de plus. En lignes, les deux tiennent
              dans sa place, et rien n'est à toucher pour le voir. */}
          <GrosBouton
            icone={<Icon name="sun" />}
            titre="Le quiz du jour"
            {...(eteinte('jour') ? pourquoi('jour') : leJour)}
            pastille={eteinte('jour') ? undefined : jour && !joueAujourdhui ? 'À jouer' : (enAvantPremiere('jour') ?? nouveau('jour'))}
            ferme={eteinte('jour')}
            href="/jour"
          />
          <GrosBouton
            icone={<Icon name="trophy" />}
            titre="Le défi de la semaine"
            detail={eteinte('defi') ? pourquoi('defi').detail : leDefi.detail}
            suite={eteinte('defi') ? pourquoi('defi').suite : leDefi.suite}
            pastille={eteinte('defi') ? undefined : (leDefi.pastille ?? enAvantPremiere('defi'))}
            ferme={eteinte('defi')}
            href="/campagne#defi"
          />
          {/* Sous le quiz du jour : un joueur à la fois, chacun sur son téléphone, à son heure. Son blason dès son premier duel. */}
          {eteinte('duels') ? (
            <GrosBouton icone={<Icon name="swords" />} titre="Les duels" {...pourquoi('duels')} ferme={eteinte('duels')} href="/duels" />
          ) : (
            <GrosBouton
              icone={duels && duels.joues > 0 ? <BlasonDeLigue ligue={duels.ligue} taille={22} decoratif /> : <Icon name="swords" />}
              titre="Les duels"
              detail={lesDuels.detail}
              suite={lesDuels.suite}
              pastille={
                lesDuels.allume ? (
                  <span className="pastille-resultat">
                    <Icon name="spark" />
                    Résultat
                  </span>
                ) : (
                  (enAvantPremiere('duels') ?? nouveau('duels'))
                )
              }
              compteur={lesDuels.compteur}
              allume={lesDuels.allume}
              href="/duels"
            />
          )}
          {/* Avec ses jokers (le brief du 17 octobre 2026, l'étape 2) ; le drapeau la referme, son bouton avec.
              Remplacée, son départ fermé : le bouton s'en va, et le Cabinet, juste dessous, prend sa place. Le QG ne la
              ferme plus depuis le 1er novembre 2026 (`PAGES_EN_MAINTENANCE`) : il n'y a plus rien à fermer. */}
          {avecLExpedition && (
            <GrosBouton icone={<Icon name="flag" />} titre="L’Expédition" detail="Trois gardiens à vaincre" suite={[', un légendaire au bout']} href="/expedition" />
          )}
          {/* Le musée à remplir, là où le serveur l'ouvre — la préproduction d'abord : une constante du code ne la
              distingue pas de la production. Il prend la place de l'Expédition quand elle cède la sienne (`remplacee`). */}
          {cabinet && (
            <GrosBouton
              icone={<Icon name="landmark" />}
              titre="Le Cabinet de curiosités"
              detail={eteinte('cabinet') ? pourquoi('cabinet').detail : leCabinet.detail}
              suite={eteinte('cabinet') ? pourquoi('cabinet').suite : leCabinet.suite}
              pastille={eteinte('cabinet') ? undefined : (leCabinet.pastille ?? enAvantPremiere('cabinet') ?? nouveau('cabinet'))}
              ferme={eteinte('cabinet')}
              href="/cabinet"
            />
          )}
        </div>
      </section>
      <section className="jouer-section" aria-labelledby="jouer-amis" style={part(1.2)}>
        <span className="label" id="jouer-amis">
          Entre amis
        </span>
        {/* Une carte elle aussi, coupée en deux : les deux boutons côte à côte, leur nom d'abord. Leur ligne dit le plus
            court — la moitié d'une rangée n'a pas la place de « Avec son code, ou le QR de l'hôte ». */}
        <div className="jouer-carte jouer-duo">
          <GrosBouton icone={<Icon name="plus" />} titre="Créer un salon" detail="Tu lances les quiz" suite={[espacesFines(' : tu joues, ou tu animes')]} href="/salon" />
          <GrosBouton icone={<Icon name="users" />} titre="Rejoindre une soirée" detail="Code ou QR de l’hôte" onClick={onRejoindre} />
        </div>
      </section>
      {lendemain}
    </div>
  )
}

/** Les annonces de l'administrateur déjà montrées sur ce téléphone, profil par profil. */
const cleDesAnnoncesVues = (profileId: string) => `quizz.annonces.vues.${profileId}`

/** Celles qu'il n'a pas encore vues ici — retenues aussitôt comme vues : elles ne se montrent qu'une fois. */
function annoncesNouvelles(profileId: string, annonces: readonly AnnonceDeLAdministrateur[]): AnnonceDeLAdministrateur[] {
  try {
    const vues = new Set<string>(JSON.parse(localStorage.getItem(cleDesAnnoncesVues(profileId)) ?? '[]'))
    const nouvelles = annonces.filter(a => !vues.has(a.id))
    // On ne garde que celles que le serveur dit encore : un mois au plus, la liste ne grossit pas.
    // Une annonce qui pose une question n'est retenue qu'une fois répondue (`retenirUneAnnonce`) :
    // « Plus tard » la laisse revenir à la prochaine visite.
    if (nouvelles.length > 0) {
      localStorage.setItem(
        cleDesAnnoncesVues(profileId),
        JSON.stringify(annonces.filter(a => vues.has(a.id) || !(a.sorte === 'annonce' && a.question)).map(a => a.id)),
      )
    }
    return nouvelles
  } catch {
    // Sans stockage, elles reviendraient à chaque passage : elles se taisent, comme la bannière des duels.
    return []
  }
}

/** Une annonce à question à laquelle il a répondu : elle ne reviendra plus sur ce téléphone. */
function retenirUneAnnonce(profileId: string, id: string) {
  try {
    const vues = new Set<string>(JSON.parse(localStorage.getItem(cleDesAnnoncesVues(profileId)) ?? '[]'))
    vues.add(id)
    localStorage.setItem(cleDesAnnoncesVues(profileId), JSON.stringify([...vues]))
  } catch {
    // Sans stockage, rien à retenir : le serveur ne redit pas une question à qui y a répondu.
  }
}

/**
 * Ce que l'administrateur a fait pour lui — des confettis offerts et son
 * mot, son prénom changé (la maquette validée le 13 octobre 2026), une
 * question qu'il a signalée et dont sa remarque a servi (celle du 14
 * octobre 2026, « Remercier le joueur »), ce qu'il a annoncé à tous (le 19
 * octobre 2026) —, en tête de l'accueil, une fois : sur ce téléphone, elles
 * sont retenues dès qu'elles paraissent, et leur bouton les range
 * (`CarteDeLAdministrateur`).
 */
export function AnnoncesDeLAdministrateur({
  profileId,
  prenom,
  annonces,
  onRepondu,
}: {
  profileId: string
  prenom: string
  annonces?: readonly AnnonceDeLAdministrateur[]
  /** Une réponse est partie : la page relit son solde, la récompense s'y ajoute. */
  onRepondu?: () => void
}) {
  const [montrees, setMontrees] = useState<AnnonceDeLAdministrateur[]>([])
  const cle = annonces?.map(a => a.id).join('|') ?? ''
  useEffect(() => {
    if (annonces && annonces.length > 0) setMontrees(annoncesNouvelles(profileId, annonces))
    // Relues seulement quand le serveur en dit d'autres.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, cle])
  if (montrees.length === 0) return null
  return (
    <ul className="annonces-admin" aria-label="De l’administrateur">
      {montrees.map(a => (
        <CarteDeLAdministrateur
          key={a.id}
          annonce={a}
          prenom={prenom}
          onRanger={() => setMontrees(m => m.filter(x => x.id !== a.id))}
          onRepondre={
            a.sorte === 'annonce' && a.question
              ? async reponse => {
                  const { confettis } = await api.joueur.repondreALAnnonce(a.id.replace(/^annonce:/, ''), reponse)
                  retenirUneAnnonce(profileId, a.id)
                  onRepondu?.()
                  return confettis
                }
              : undefined
          }
        />
      ))}
    </ul>
  )
}

/** Le dernier résultat que la bannière a annoncé sur ce téléphone : elle ne tombe qu'une fois par résultat. */
const CLE_RESULTAT_ANNONCE = 'quizz.duels.resultatAnnonce'
/** Le temps qu'elle reste, son trait d'or qui se vide. */
const BANNIERE_MS = 6000
/** Et celui qu'elle met à repartir. */
const DEPART_MS = 400

function dejaAnnonce(code: string): boolean {
  try {
    return localStorage.getItem(CLE_RESULTAT_ANNONCE) === code
  } catch {
    // Sans stockage, elle tomberait à chaque passage : elle se tait.
    return true
  }
}

function retenirLAnnonce(code: string) {
  try {
    localStorage.setItem(CLE_RESULTAT_ANNONCE, code)
  } catch {
    // Sans stockage, rien à retenir : `dejaAnnonce` l'a déjà tue.
  }
}

/**
 * La bannière d'un résultat (la maquette A4, choisie par le propriétaire le
 * 12 octobre 2026 : « on n'a pas de popup ou d'indicateur visuel qu'un match
 * est terminé ») : quand un duel qu'il a lancé vient d'être joué, elle tombe
 * en haut de l'accueil — « Duel terminé · Hugo a joué ton duel », « Voir »,
 * qui mène à sa carte du verdict —, puis repart d'elle-même, son trait d'or
 * vidé. Une fois par résultat, sur ce téléphone : la tuile des duels, elle,
 * reste allumée tant qu'il ne l'a pas vu.
 */
export function BanniereDuResultat({ resultats }: { resultats?: DuelsDAccueil['resultats'] }) {
  const [etat, setEtat] = useState<'cachee' | 'montree' | 'repart'>('cachee')
  // Les duels fermés — en maintenance, bientôt disponibles —, elle se tait
  // sans passer son tour : son « Voir » mènerait à leur page fermée, et elle
  // tombe une fois qu'ils rouvrent.
  const code = resultats && resultats.n > 0 && !boutonEteint('duels') ? resultats.code : null
  useEffect(() => {
    if (!code || dejaAnnonce(code)) return
    retenirLAnnonce(code)
    setEtat('montree')
    const repart = window.setTimeout(() => setEtat('repart'), BANNIERE_MS)
    const partie = window.setTimeout(() => setEtat('cachee'), BANNIERE_MS + DEPART_MS)
    return () => {
      window.clearTimeout(repart)
      window.clearTimeout(partie)
    }
    // Une fois par résultat : c'est son code qui la relance.
  }, [code])
  // Toujours là, vide d'abord : une région qui apparaît avec son texte n'est pas toujours lue. Hors du flux
  // (`banniere-duel-annonce`) : vide dans la colonne de l'accueil, elle y ajoutait un écart sous les gros boutons.
  return (
    <div className="banniere-duel-annonce" role="status">
      {etat !== 'cachee' && resultats && <BanniereVue resultats={resultats} repart={etat === 'repart'} />}
    </div>
  )
}

/** Ce que la bannière montre : le duel terminé, qui l'a joué, « Voir » — et son trait d'or qui se vide. */
export function BanniereVue({ resultats, repart = false }: { resultats: NonNullable<DuelsDAccueil['resultats']>; repart?: boolean }) {
  return (
    <div className={'banniere-duel' + (repart ? ' repart' : '')}>
      <span className="banniere-duel-icone" aria-hidden="true">
        <Icon name="swords" />
      </span>
      <span className="banniere-duel-texte">
        <b>Duel terminé</b>
        <span>{resultats.n > 1 ? `${resultats.de} et ${resultats.n - 1} autre${resultats.n > 2 ? 's' : ''} ont joué tes duels` : `${resultats.de} a joué ton duel`}</span>
      </span>
      <a className="banniere-duel-voir" href={`${PAGE_DES_DUELS}${adresseDuDuel(resultats.code)}`}>
        Voir
      </a>
      <i className="banniere-duel-temps" aria-hidden="true" />
    </div>
  )
}
