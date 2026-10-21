import { useEffect, useState, type ReactNode } from 'react'
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
// Il n'importe rien, et l'en-tête de l'accueil le tire déjà par `shared/legendaires.ts` (`Identite.tsx`).
import { EXPEDITION_EN_PRODUCTION } from '../../../shared/jokers'
import type { AnnonceDeLAdministrateur } from '../../../shared/profil'
// Ses cartes n'importent que ce que l'accueil a déjà : l'en-tête tire `shared/profil.ts` (`Identite.tsx`).
import { CarteDeLAdministrateur } from './CarteDeLAdministrateur'
// Ils n'importent rien : le premier script de chaque page les lit déjà (`main.tsx`).
import { BOUTON_BIENTOT, BOUTON_EN_MAINTENANCE, PASTILLE_AVANT_PREMIERE, type BoutonDeLaPage, type PageEnMaintenance } from '../../../shared/maintenance'
import { boutonEteint } from '../maintenance'
import { BlasonDeLigue } from './Blason'
import { JourEtDefi } from './JourEtDefi'

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
 * Le bouton de la campagne : le sentier qu'il avance et ses vies ; tant qu'il
 * n'en avance aucun, les deux modes, et la série d'abord. Il ouvre la
 * campagne, jamais un sentier seul : mené à `#sentier-scene`, « la
 * campagne » ouvrait la scène sans les onglets de la campagne. Sur ses
 * sentiers, celui qu'il avance est en tête, à un toucher. Le défi de la
 * semaine a quitté ce bouton pour son onglet, à côté du quiz du jour
 * (`boutonDuDefi`) ; les défis de ses amis sont au bouton des duels
 * (`boutonDesDuels`).
 */
export function boutonDeLaCampagne(c: SentiersDAccueil | undefined): { detail: string; href: string; pastille?: string } {
  const b = branche(c?.avance?.branche)
  // Le carnet passe devant le sentier — pas devant une épreuve laissée en route : c'est le rendez-vous du lendemain,
  // que seul l'onglet comptait, deux écrans plus loin. L'adresse du carnet (`ADRESSE_DU_CARNET`) écrite ici, comme celle des sentiers.
  if (c?.aRevoir && !c.avance?.laissee) {
    const n = c.aRevoir
    return {
      detail: espacesFines(
        n > 1 ? `${n} questions de ton carnet t’attendent : revois-les pour les apprendre` : 'Une question de ton carnet t’attend : revois-la pour l’apprendre',
      ),
      href: '/campagne#carnet',
      pastille: 'À revoir',
    }
  }
  // « les sentiers de tes avatars » : quels avatars, et qu'est-ce qu'un sentier ? (l'experte du jeu solo, le 11 octobre 2026)
  // Ce qu'on y gagne, en deux lignes au téléphone.
  if (!c?.avance || !b) return { detail: 'Une série sans fin, ou des portraits à gagner', href: '/campagne' }
  // Un nombre ne quitte pas son mot à la ligne : « 11 » d'un côté, « vies » de l'autre.
  const palier = c.avance.palier === PALIER_DU_MAITRE ? `palier de maître ${deLaBranche(b)}` : `palier\u00a0${c.avance.palier} ${deLaBranche(b)}`
  const vies = c.vies > 0 ? `${c.vies}\u00a0vie${c.vies > 1 ? 's' : ''}` : 'plus de vie avant minuit'
  return {
    detail: espacesFines(`${c.avance.laissee ? `Ton épreuve t’attend : ${palier}` : `Vers le ${palier}`} · ${vies}`),
    // L'adresse des sentiers (`ADRESSE_DES_SENTIERS`), écrite ici : l'importer
    // ferait venir toute la page des sentiers dans celle de l'accueil.
    href: '/campagne#sentiers',
  }
}

/** « 8 bonnes réponses » : le nombre ne quitte pas ses mots à la ligne. */
const bonnesReponses = (n: number) => `${n} bonne${n > 1 ? 's' : ''} réponse${n > 1 ? 's' : ''}`

/**
 * La tuile du défi de la semaine, dans son onglet à côté du quiz du jour :
 * ceux qui l'ont relevé, le sien à reprendre, ou sa place une fois relevé —
 * ce que sa page montre (`defiDAccueil`). Deux lignes au plus en 360 de
 * large : son titre en prend déjà deux, à côté de sa pastille.
 */
export function boutonDuDefi(d: DefiDAccueil | undefined): { detail: string; pastille?: string } {
  // Une base qui s'en est tue : ce qu'il est, sans un chiffre — sa page dira le reste.
  if (!d) return { detail: 'La même série pour tous, jusqu’à dimanche' }
  if (d.releve) {
    // « 4ᵉ place sur 10 » d'un bloc : coupée, elle laissait « 10 » seul sur sa ligne. Loin des premiers, ni place ni rang.
    const place = placeDuJour(d.releve.rang, d.joueurs, d.releve.justes)
    return { detail: espacesFines(place ? `${bonnesReponses(d.releve.justes)} · ${place.replace(/ /g, '\xa0')}` : `Relevé : ${bonnesReponses(d.releve.justes)}`) }
  }
  if (d.enCours) {
    return { detail: espacesFines(d.enCours.justes > 0 ? `${bonnesReponses(d.enCours.justes)} : reprends-le` : 'Ton défi t’attend : reprends-le'), pastille: 'À finir' }
  }
  const n = d.joueurs
  return {
    detail: espacesFines(n > 1 ? `${n} joueurs l’ont relevé · jusqu’à dimanche` : n === 1 ? 'Un joueur l’a relevé · jusqu’à dimanche' : 'La même série pour tous : à toi d’ouvrir le bal'),
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
export function boutonDesDuels(d: DuelsDAccueil | undefined): { detail: string; compteur?: { n: number; label: string }; allume?: true } {
  if (d?.resultats && d.resultats.n > 0) {
    const { n, de } = d.resultats
    const recus = d.defisRecus?.n ?? 0
    return {
      detail: espacesFines(n > 1 ? `${de} et ${n - 1} autre${n > 2 ? 's' : ''} ont joué tes duels` : `${de} a joué ton duel`),
      compteur: { n: n + recus, label: recus > 0 ? `${aVoir(n)} et ${aRelever(recus)}` : aVoir(n) },
      allume: true,
    }
  }
  if (d?.defisRecus && d.defisRecus.n > 0) {
    const { n } = d.defisRecus
    const autres = n - 1
    // « et 2 autres », sans « amis » : on peut être défié par qui l'on ne connaît pas encore.
    return {
      detail: espacesFines(`${d.defisRecus.de} te défie${autres > 0 ? `, et ${autres} autre${autres > 1 ? 's' : ''}` : ''} : à toi de jouer`),
      // Blanc sur rouge, en haut à droite, comme des messages qui attendent (le souhait du propriétaire du 12 octobre
      // 2026) : la pastille dorée « 3 défis » se fondait parmi « À relever » et « À jouer », sur les boutons du dessus.
      // Le serveur n'en lit que dix (`DEFIS_RECUS_MONTRES`) : passé neuf, il peut y en avoir plus.
      compteur: { n, label: aRelever(n) },
    }
  }
  if (d?.enCours) return { detail: espacesFines(`Ton duel contre ${d.enCours.nom} t’attend`) }
  // Le dé ne joue que contre Automate (le 13 octobre 2026) : « un joueur au hasard » promettait quelqu'un.
  if (!d || d.joues === 0) return { detail: espacesFines('Défie qui tu veux, ou Automate : monte de ligue') }
  const manque = DUELS_POUR_LA_RECOMPENSE - d.semaine.duels
  // Le lundi, ce que la semaine passée vient de verser — tant que la nouvelle n'a pas son premier duel :
  // sans lui, la récompense arrivait au solde sans un mot, et la tuile redisait « encore 3 duels ».
  if (d.semainePassee && d.semaine.duels === 0) {
    const ligue = ligueParCle(d.semainePassee.ligue).nom
    return {
      detail: espacesFines(
        `+${d.semainePassee.confettis}\u00a0confettis pour ta semaine en ${ligue.charAt(0).toLowerCase()}${ligue.slice(1)} · encore ${manque}\u00a0duels pour la prochaine`,
      ),
    }
  }
  // Un nombre ne quitte pas son mot à la ligne : « cote » d'un côté, « 1084 » de l'autre.
  return {
    detail: espacesFines(
      `${ligueParCle(d.ligue).nom} · cote\u00a0${d.cote} · ${manque > 0 ? `encore ${manque}\u00a0duel${manque > 1 ? 's' : ''} pour ta récompense` : `+${ligueParCle(d.semaine.ligue).confettis}\u00a0confettis lundi`}`,
    ),
  }
}

/** Rien de fermé, rien d'essayé avant tout le monde. */
const RIEN_DE_FERME: Partial<Record<PageEnMaintenance, BoutonDeLaPage>> = {}

/**
 * L'accueil d'un profil : ce qu'on vient faire, en gros boutons — une soirée
 * où l'on joue déjà passe devant tout (« Revenir chez Hugo »), puis la
 * campagne, le quiz du jour et le défi de la semaine — une tuile, deux
 * onglets (`JourEtDefi`) —, les duels, créer un salon, rejoindre une soirée.
 * Chacun ouvre sa page, qui en dit plus : un toucher de plus qu'une carte qui
 * montrait tout, mais un écran qu'on lit d'un coup d'œil.
 *
 * Il remplace « Je joue » et « Ce soir », dont les boutons changeaient de
 * place et de taille selon l'heure et les rôles. Tout le monde a son salon :
 * il n'y a plus de porte d'animateur à chercher.
 *
 * Une page fermée — en maintenance, ou bientôt disponible — éteint son
 * bouton, et sa ligne dit pourquoi : on ne l'apprenait qu'en touchant. Le
 * défi fermé seul éteint sa tuile, sous son onglet. Une page qu'il essaie
 * avant tout le monde le dit d'une pastille.
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
  etats = RIEN_DE_FERME,
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
  /** Ce que dit le bouton de chaque page fermée, pour lui (`boutonsDesPages`, `client/src/maintenance.ts`). */
  etats?: Partial<Record<PageEnMaintenance, BoutonDeLaPage>>
}) {
  // Joué aujourd'hui (à l'heure de Paris) : le bouton le dit, sans pastille.
  // Le jour vient du serveur : calculé ici, son `Intl` chargeait les données
  // du français avant le premier écran ; un serveur d'avant ne le dit pas.
  const dernier = jour?.jours[0]?.jour
  const joueAujourdhui = !!dernier && dernier === (aujourdhui ?? jourDe(Date.now()))
  // « 12 jours » d'un bloc : « jours » restait seul sur sa ligne en 360.
  const serie = jour && jour.serie > 1 ? ` · série de ${jour.serie} jours` : ''
  // Éteinte pour lui : en maintenance — pour tous —, ou bientôt disponible sans qu'il l'essaie.
  const eteinte = (page: PageEnMaintenance) => {
    const e = etats[page]
    return e === 'maintenance' || e === 'bientot' ? e : undefined
  }
  const pourquoi = (page: PageEnMaintenance) => espacesFines(etats[page] === 'bientot' ? BOUTON_BIENTOT : BOUTON_EN_MAINTENANCE)
  const enAvantPremiere = (page: PageEnMaintenance) => (etats[page] === 'avant-premiere' ? PASTILLE_AVANT_PREMIERE : undefined)
  const laCampagne = boutonDeLaCampagne(campagne)
  const leDefi = boutonDuDefi(defi)
  const lesDuels = boutonDesDuels(duels)
  return (
    <div className="accueil-gestes">
      {/* Il joue déjà quelque part : on y revient d'un toucher, avant tout. */}
      {enCours.map(e => (
        <GrosBouton key={e.slug} principal icone={<Icon name="rotate" />} titre={`Revenir chez ${e.nom}`} detail="Ta soirée continue" href={spacePath(e.slug)} />
      ))}
      {/* Deux sections, nommées : seul, et à plusieurs — quatre boutons de même
          poids ne disaient pas lesquels se jouent sans personne. */}
      <section className="jouer-section" aria-labelledby="jouer-seul">
        <span className="label" id="jouer-seul">
          Seul
        </span>
        {eteinte('campagne') ? (
          <GrosBouton icone={<Icon name="target" />} titre="La campagne" detail={pourquoi('campagne')} ferme={eteinte('campagne')} href="/campagne" />
        ) : (
          <GrosBouton
            icone={<Icon name="target" />}
            titre="La campagne"
            detail={laCampagne.detail}
            pastille={laCampagne.pastille ?? enAvantPremiere('campagne')}
            href={laCampagne.href}
          />
        )}
        {/* Le quiz du jour et le défi de la semaine, au même endroit : la tuile du quiz du jour, ouverte d'office, et
            celle du défi, sous deux onglets (le choix du propriétaire du 19 octobre 2026 — au troisième onglet de la
            campagne, beaucoup ne savaient pas que le défi existait). Un point d'or sur l'onglet de ce qui attend. */}
        <JourEtDefi
          jour={
            <GrosBouton
              icone={<Icon name="sun" />}
              titre="Le quiz du jour"
              detail={eteinte('jour') ? pourquoi('jour') : joueAujourdhui ? `Joué aujourd’hui${serie}` : `Dix questions, les mêmes pour tous${serie}`}
              pastille={eteinte('jour') ? undefined : jour && !joueAujourdhui ? 'À jouer' : enAvantPremiere('jour')}
              ferme={eteinte('jour')}
              href="/jour"
            />
          }
          defi={
            <GrosBouton
              icone={<Icon name="trophy" />}
              titre="Le défi de la semaine"
              detail={eteinte('defi') ? pourquoi('defi') : leDefi.detail}
              pastille={eteinte('defi') ? undefined : (leDefi.pastille ?? enAvantPremiere('defi'))}
              ferme={eteinte('defi')}
              href="/campagne#defi"
            />
          }
          attend={{
            ...(!eteinte('jour') && jour && !joueAujourdhui && { jour: 'à jouer' }),
            ...(!eteinte('defi') && leDefi.pastille && { defi: leDefi.pastille.toLowerCase() }),
          }}
        />
        {/* Sous le quiz du jour : un joueur à la fois, chacun sur son téléphone, à son heure. Son blason dès son premier duel. */}
        {eteinte('duels') ? (
          <GrosBouton icone={<Icon name="swords" />} titre="Les duels" detail={pourquoi('duels')} ferme={eteinte('duels')} href="/duels" />
        ) : (
          <GrosBouton
            icone={duels && duels.joues > 0 ? <BlasonDeLigue ligue={duels.ligue} taille={26} decoratif /> : <Icon name="swords" />}
            titre="Les duels"
            detail={lesDuels.detail}
            pastille={
              lesDuels.allume ? (
                <span className="pastille-resultat">
                  <Icon name="spark" />
                  Résultat
                </span>
              ) : (
                enAvantPremiere('duels')
              )
            }
            compteur={lesDuels.compteur}
            allume={lesDuels.allume}
            href="/duels"
          />
        )}
        {/* Avec ses jokers (le brief du 17 octobre 2026, l'étape 2) ; le drapeau la referme, son bouton avec — et le QG l'annonce pour bientôt. */}
        {EXPEDITION_EN_PRODUCTION && (
          <GrosBouton
            icone={<Icon name="flag" />}
            titre="L’Expédition"
            detail={eteinte('expedition') ? pourquoi('expedition') : 'Trois gardiens à vaincre, un légendaire au bout'}
            pastille={enAvantPremiere('expedition')}
            ferme={eteinte('expedition')}
            href="/expedition"
          />
        )}
      </section>
      <section className="jouer-section" aria-labelledby="jouer-amis">
        <span className="label" id="jouer-amis">
          Entre amis
        </span>
        <GrosBouton icone={<Icon name="plus" />} titre="Créer un salon" detail="Tu lances les quiz : tu joues, ou tu animes" href="/salon" />
        <GrosBouton icone={<Icon name="users" />} titre="Rejoindre une soirée" detail="Avec son code, ou le QR de l’hôte" onClick={onRejoindre} />
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
