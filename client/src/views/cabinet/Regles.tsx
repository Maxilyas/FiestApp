import type { ReactNode } from 'react'
import { Glossaire } from '../../components/Glossaire'
import { Icon, type IconName } from '../../components/Icon'
import { Feuille } from '../../components/Pieces'
import { espacesFines } from '../../format'
import {
  CASES_DE_LA_VISITE,
  CHASSES_PAR_JOUR,
  ECHANGES_PAR_JOUR,
  ETOILES_D_UNE_PARTIE,
  ETOILES_PAR_MANCHE,
  JOURS_DU_SCARABEE,
  JOURS_SANS_REDITE,
  LIBRES_QUI_PAIENT,
  MANCHES_PAR_PARTIE,
  POUSSIERE_MIN,
  POUSSIERE_PAR_ETOILE,
  PRIX_D_UNE_DORURE,
  PRIX_D_UNE_OEUVRE,
  SEUILS_DES_RARETES,
} from '../../../../shared/cabinet/bareme'
import { CLES_DES_JEUX, JEUX, type CleDeJeu } from '../../../../shared/cabinet/jeux/regle'
import { OEUVRES } from '../../../../shared/cabinet/oeuvres'
import { POUVOIRS } from '../../../../shared/cabinet/pouvoirs'
import { SALLES } from '../../../../shared/cabinet/salles'
import { apresDeuxPoints, enDebutDeLigne } from './Musee'

// « Comment ça marche ? » : les règles du Cabinet en une feuille, une ligne
// chacune — jamais en paragraphes sur les pages (la leçon de l'Expédition, la
// revue du 18 octobre 2026 : « Trop d'infos écrites sur la page on s'y
// perd »). Chaque chiffre vient du barème (`shared/cabinet/bareme.ts`), et
// chaque jeu dit son geste et son barème par `JEUX`, composés des mêmes
// chiffres : un barème changé change aussi ce que la feuille promet. Les mots
// du Cabinet viennent du glossaire de l'application.

/** Les mots du Cabinet, au glossaire. */
const MOTS = ['oeuvre', 'salle', 'cadreDore', 'gardien', 'cartel', 'carteBonus', 'visite', 'chasse', 'manche', 'poussiere'] as const

/** « 200 à 700 » : les bornes d'un barème par rareté. */
const deA = (prix: Readonly<Record<string, number>>) => `${Math.min(...Object.values(prix))} à ${Math.max(...Object.values(prix))}`

function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="cab-regles-section">
      <h3>{titre}</h3>
      <ul className="cab-regles">{children}</ul>
    </section>
  )
}

function Ligne({ icone, children }: { icone: IconName; children: ReactNode }) {
  return (
    <li>
      <Icon name={icone} />
      <span>{typeof children === 'string' ? espacesFines(children) : children}</span>
    </li>
  )
}

/**
 * `parties` : les cases de la visite du jour, telles que la page les montre — tant que des jeux ne sont pas livrés, il y en a
 * moins que le barème n'en promet, et le musée disait « 2 parties » au-dessus d'une règle qui en disait trois.
 */
export function Regles({ jeux, parties = CASES_DE_LA_VISITE }: { jeux: readonly CleDeJeu[]; parties?: number }) {
  const s = SEUILS_DES_RARETES
  return (
    <>
      <Section titre="Ton musée">
        <Ligne icone="landmark">{`${OEUVRES.length} œuvres peintes, rangées en ${SALLES.length} salles.`}</Ligne>
        <Ligne icone="star">{`Une partie : ${MANCHES_PAR_PARTIE} manches de ${ETOILES_PAR_MANCHE} étoiles, ${ETOILES_D_UNE_PARTIE} en tout.`}</Ligne>
        <Ligne icone="target">{`Une œuvre se gagne à ${s.commun} étoiles si elle est commune, ${s.rare} rare ou maudite, ${s.epique} épique.`}</Ligne>
        <Ligne icone="sparkles">Trois manches parfaites, sans qu’un pouvoir ait servi : son cadre est doré.</Ligne>
        <Ligne icone="crown">Une salle complète réveille son gardien ; toute dorée, un second.</Ligne>
      </Section>
      <Section titre="Chaque jour">
        <Ligne icone="sun">{`La visite du jour : ${parties} parties, chacune une œuvre en jeu que tu découvres en la gagnant.`}</Ligne>
        <Ligne icone="shuffle">{`Un jeu de la visite se change, ${ECHANGES_PAR_JOUR === 1 ? 'une fois' : `${ECHANGES_PAR_JOUR} fois`} par jour.`}</Ligne>
        <Ligne icone="search">{`${CHASSES_PAR_JOUR} chasses : touche un cadre vide, et joue au jeu où se trouve son œuvre.`}</Ligne>
        <Ligne icone="dice">{`Jouer librement, autant que tu veux : les ${LIBRES_QUI_PAIENT} premières parties libres paient leur poussière d’or.`}</Ligne>
        <Ligne icone="calendar">{`Une visite ou une chasse chaque jour fait ta série ; au ${JOURS_DU_SCARABEE}ᵉ jour, le Scarabée se réveille.`}</Ligne>
        <Ligne icone="flag">Quitter une partie la compte avec ses étoiles : elle ne se rejoue pas.</Ligne>
      </Section>
      <Section titre="La poussière d’or">
        <Ligne icone="sparkles">{`Une visite ou une chasse en rapporte ${POUSSIERE_PAR_ETOILE} par étoile, ${POUSSIERE_MIN} au moins, même ratée.`}</Ligne>
        <Ligne icone="bag">{`Elle achète une œuvre précise (${deA(PRIX_D_UNE_OEUVRE)}) ou dore un cadre (${deA(PRIX_D_UNE_DORURE)}).`}</Ligne>
        <Ligne icone="lock">Elle ne sort jamais du Cabinet.</Ligne>
      </Section>
      <Section titre="Les cartes-bonus">
        <Ligne icone="hanger">Avant une partie, emporte une de tes œuvres ou un gardien réveillé : son pouvoir t’aide, il ne s’use jamais.</Ligne>
        <Ligne icone="medal">Sa salle donne le pouvoir, sa rareté la force ; un gardien a la plus haute.</Ligne>
        {Object.values(POUVOIRS).map(p => (
          <Ligne key={p.nom} icone="zap">
            <b>{p.nom}</b>
            {espacesFines(` : ${apresDeuxPoints(p.dit)}`)}
          </Ligne>
        ))}
      </Section>
      <Section titre="Les neuf jeux">
        {CLES_DES_JEUX.map(j => (
          <Ligne key={j} icone="gamepad">
            <b>{JEUX[j].nom}</b>
            {espacesFines(` : ${apresDeuxPoints(JEUX[j].geste)}`)}
            {/* Son barème sur sa ligne : collé à la phrase, « France. à moins de 40 km ★★★ » se lisait comme une faute. */}
            <span className="cab-bareme">
              {espacesFines(enDebutDeLigne(JEUX[j].bareme))}
              {!jeux.includes(j) && <span className="cab-pastille">bientôt</span>}
            </span>
          </Ligne>
        ))}
      </Section>
      <Section titre="Ce que tu apprends">
        <Ligne icone="book">Chaque œuvre gagnée garde sur son cartel ce que la partie t’a appris.</Ligne>
        <Ligne icone="clock">{`Ce que tu as vu ne revient pas avant ${JOURS_SANS_REDITE} jours, d’un jeu à l’autre.`}</Ligne>
      </Section>
      <Glossaire mots={[...MOTS]} titre="Les mots du Cabinet" />
    </>
  )
}

/** Les règles en feuille, ouvertes de « Comment ça marche ? » — au musée, et à l'annonce d'une partie. */
export function FeuilleDesRegles({ jeux, parties, onFermer }: { jeux: readonly CleDeJeu[]; parties?: number; onFermer: () => void }) {
  return (
    <Feuille titre="Comment ça marche ?" onFermer={onFermer} className="cab-feuille">
      <Regles jeux={jeux} parties={parties} />
    </Feuille>
  )
}
