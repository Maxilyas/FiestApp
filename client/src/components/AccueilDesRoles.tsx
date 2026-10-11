import { type ReactNode } from 'react'
import { Icon } from './Icon'
import { GrosBouton } from './Pieces'
import { LienConsole } from './LienConsole'
import { spacePath } from '../routes'
import type { PublicSpace } from '../../../shared/space'
import { jourDe, type CarriereDuJour } from '../../../shared/jour'
import { espacesFines } from '../format'
import { branche, deLaBranche } from '../../../shared/branches'
import { PALIER_DU_MAITRE, type SentiersDAccueil } from '../../../shared/sentiers'
import { DUELS_POUR_LA_RECOMPENSE, ligueParCle, type DuelsDAccueil } from '../../../shared/duels'
import { BlasonDeLigue } from './Blason'

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
 * sentiers, celui qu'il avance est en tête, à un toucher. Les défis de ses
 * amis sont au bouton des duels (`boutonDesDuels`).
 */
export function boutonDeLaCampagne(c: SentiersDAccueil | undefined): { detail: string; href: string; pastille?: string } {
  const b = branche(c?.avance?.branche)
  if (!c?.avance || !b) return { detail: 'Une série sans fin, ou les sentiers de tes avatars', href: '/campagne' }
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

/**
 * Le bouton des duels (le souhait du propriétaire du 11 octobre 2026 : une
 * tuile de l'accueil sous le quiz du jour) : un défi qu'un ami lui a envoyé
 * passe devant — qui le défie, une pastille —, puis son duel laissé en
 * route ; sinon sa ligue, sa cote et ce qui manque à sa récompense de lundi
 * — ou ce qu'elle rapportera. Avant son premier duel, ce qu'on y fait.
 */
export function boutonDesDuels(d: DuelsDAccueil | undefined): { detail: string; pastille?: string } {
  if (d?.defisRecus && d.defisRecus.n > 0) {
    const autres = d.defisRecus.n - 1
    return {
      detail: espacesFines(`${d.defisRecus.de} te défie${autres > 0 ? `, et ${autres} autre${autres > 1 ? 's' : ''} ami${autres > 1 ? 's' : ''}` : ''} : à toi de jouer`),
      pastille: d.defisRecus.n > 1 ? `${d.defisRecus.n} défis` : 'Un défi',
    }
  }
  if (d?.enCours) return { detail: espacesFines(`Ton duel contre ${d.enCours.nom} t’attend`) }
  if (!d || d.joues === 0) return { detail: espacesFines('Un joueur de ton niveau, son score à battre : monte de ligue') }
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

/**
 * L'accueil d'un profil : ce qu'on vient faire, en gros boutons — une soirée
 * où l'on joue déjà passe devant tout (« Revenir chez Hugo »), puis le quiz
 * du jour, créer un salon, rejoindre une soirée. Chacun ouvre sa page, qui en
 * dit plus : un toucher de plus qu'une carte qui montrait tout, mais un
 * écran qu'on lit d'un coup d'œil.
 *
 * Il remplace « Je joue » et « Ce soir », dont les boutons changeaient de
 * place et de taille selon l'heure et les rôles. Tout le monde a son salon :
 * il n'y a plus de porte d'animateur à chercher.
 */
export function AccueilJouer({
  enCours,
  onRejoindre,
  lendemain,
  jour,
  aujourdhui,
  campagne,
  duels,
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
  /** Ses duels : sa ligue, sa cote, sa semaine — et qui le défie. */
  duels?: DuelsDAccueil
}) {
  // Joué aujourd'hui (à l'heure de Paris) : le bouton le dit, sans pastille.
  // Le jour vient du serveur : calculé ici, son `Intl` chargeait les données
  // du français avant le premier écran ; un serveur d'avant ne le dit pas.
  const dernier = jour?.jours[0]?.jour
  const joueAujourdhui = !!dernier && dernier === (aujourdhui ?? jourDe(Date.now()))
  const serie = jour && jour.serie > 1 ? ` · série de ${jour.serie} jours` : ''
  const laCampagne = boutonDeLaCampagne(campagne)
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
        <GrosBouton icone={<Icon name="target" />} titre="La campagne" detail={laCampagne.detail} pastille={laCampagne.pastille} href={laCampagne.href} />
        <GrosBouton
          icone={<Icon name="sun" />}
          titre="Le quiz du jour"
          detail={joueAujourdhui ? `Joué aujourd’hui${serie}` : `Dix questions, les mêmes pour tous${serie}`}
          pastille={jour && !joueAujourdhui ? 'À jouer' : undefined}
          href="/jour"
        />
        {/* Sous le quiz du jour : un joueur à la fois, chacun sur son téléphone, à son heure. Son blason dès son premier duel. */}
        <GrosBouton
          icone={duels && duels.joues > 0 ? <BlasonDeLigue ligue={duels.ligue} taille={26} decoratif /> : <Icon name="swords" />}
          titre="Les duels"
          detail={lesDuels.detail}
          pastille={lesDuels.pastille}
          href="/duels"
        />
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
