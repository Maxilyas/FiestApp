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
 * Le bouton de la campagne : le sentier qu'il avance et ses vies, et il y
 * mène ; tant qu'il n'en avance aucun, les deux modes, et la série d'abord.
 */
export function boutonDeLaCampagne(c: SentiersDAccueil | undefined): { detail: string; href: string } {
  const b = branche(c?.avance?.branche)
  if (!c?.avance || !b) return { detail: 'Une série sans fin, ou les sentiers de tes avatars', href: '/campagne' }
  // Un nombre ne quitte pas son mot à la ligne : « 11 » d'un côté, « vies » de l'autre.
  const palier = c.avance.palier === PALIER_DU_MAITRE ? `palier de maître ${deLaBranche(b)}` : `palier\u00a0${c.avance.palier} ${deLaBranche(b)}`
  const vies = c.vies > 0 ? `${c.vies}\u00a0vie${c.vies > 1 ? 's' : ''}` : 'plus de vie avant minuit'
  return {
    detail: espacesFines(`${c.avance.laissee ? `Ton épreuve t’attend : ${palier}` : `Vers le ${palier}`} · ${vies}`),
    href: `/campagne#sentier-${b.key}`,
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
  campagne,
}: {
  enCours: { nom: string; slug: string }[]
  onRejoindre: () => void
  lendemain: ReactNode
  /** Sa carrière au quiz du jour : sa série, et s'il a déjà joué aujourd'hui. */
  jour?: CarriereDuJour
  /** Ses sentiers : ses vies, et celui qu'il avance. */
  campagne?: SentiersDAccueil
}) {
  // Joué aujourd'hui (à l'heure de Paris) : le bouton le dit, sans pastille.
  const joueAujourdhui = jour?.jours[0]?.jour === jourDe(Date.now())
  const serie = jour && jour.serie > 1 ? ` · série de ${jour.serie} jours` : ''
  const laCampagne = boutonDeLaCampagne(campagne)
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
        <GrosBouton icone={<Icon name="target" />} titre="La campagne" detail={laCampagne.detail} href={laCampagne.href} />
        <GrosBouton
          icone={<Icon name="sun" />}
          titre="Le quiz du jour"
          detail={joueAujourdhui ? `Joué aujourd’hui${serie}` : `Dix questions, les mêmes pour tous${serie}`}
          pastille={jour && !joueAujourdhui ? 'À jouer' : undefined}
          href="/jour"
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
