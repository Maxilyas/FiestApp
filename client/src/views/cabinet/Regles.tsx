import type { ReactNode } from 'react'
import { Glossaire } from '../../components/Glossaire'
import { Icon, type IconName } from '../../components/Icon'
import { Feuille } from '../../components/Pieces'
import { espacesFines, formatNumber } from '../../format'
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
import { OEUVRES, RARETES, type Rarete } from '../../../../shared/cabinet/oeuvres'
import { POUVOIRS } from '../../../../shared/cabinet/pouvoirs'
import { SALLES } from '../../../../shared/cabinet/salles'
import { EnEtoiles } from './EnEtoiles'
import { adresseDe } from './ecrans'
import { apresDeuxPoints, compte, enDebutDeLigne } from './Musee'

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
const deA = (prix: Readonly<Record<string, number>>) => `${formatNumber(Math.min(...Object.values(prix)))} à ${formatNumber(Math.max(...Object.values(prix)))}`

const RARETE_AU_FEMININ: Readonly<Record<Rarete, string>> = { commun: 'commune', rare: 'rare', maudit: 'maudite', epique: 'épique' }

/**
 * « Une fois par jour » : le barème ne permet qu'un échange, et son type le
 * tient (`ECHANGES_PAR_JOUR: 1`) — la visite figée n'a place que pour un. La
 * ligne lisait encore « N fois », une branche qui ne servait jamais ; un barème
 * qui en permettrait deux ne compilerait plus ici, et la feuille ne promettra
 * pas un échange que le serveur refuse.
 */
const ECHANGES_DITS: Readonly<Record<1, string>> = { 1: 'une fois' }

/**
 * « 5 étoiles si elle est commune, 6 rare ou maudite, 7 épique » : chaque
 * rareté à son seuil, lu au barème ; deux voisines ne se disent ensemble que
 * si leurs seuils sont égaux — la ligne lisait celui des rares pour les
 * maudites, et un seuil des maudites changé l'aurait laissée mentir.
 */
export function seuilsDits(seuils: Readonly<Record<Rarete, number>>): string {
  const groupes: { seuil: number; raretes: string[] }[] = []
  for (const r of RARETES) {
    const dernier = groupes.at(-1)
    if (dernier && dernier.seuil === seuils[r]) dernier.raretes.push(RARETE_AU_FEMININ[r])
    else groupes.push({ seuil: seuils[r], raretes: [RARETE_AU_FEMININ[r]] })
  }
  return groupes.map((g, i) => `${g.seuil}${i === 0 ? ' étoiles si elle est ' : ' '}${g.raretes.join(' ou ')}`).join(', ')
}

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
export function Regles({ jeux, parties = CASES_DE_LA_VISITE, onMurs }: { jeux: readonly CleDeJeu[]; parties?: number; /** Mener à tes murs : la feuille qui les montre se ferme. */ onMurs?: () => void }) {
  return (
    <>
      {/* L'essentiel d'abord, en trois lignes, puis les mots du Cabinet : trente-trois lignes en six sections, le lexique tout au
          bout — « le genre de texte qui me ferait lâcher une appli » (Ophélie, à la tablée du 25 octobre 2026). Théo et Hugo la
          trouvaient complète : le reste suit, une ligne chacune, et les neuf jeux se replient — chaque annonce redit le sien. */}
      <Section titre="En bref">
        <Ligne icone="sun">{`La visite du jour : ${compte(parties, 'partie')}, une œuvre à gagner chacune.`}</Ligne>
        <Ligne icone="target">Assez d’étoiles, et l’œuvre entre dans ton musée.</Ligne>
        <Ligne icone="crown">Une salle complète réveille son gardien.</Ligne>
      </Section>
      <Glossaire mots={[...MOTS]} titre="Les mots du Cabinet" />
      <Section titre="Ton musée">
        <Ligne icone="landmark">{`${OEUVRES.length} œuvres peintes, rangées en ${SALLES.length} salles.`}</Ligne>
        <Ligne icone="star">{`Une partie : ${MANCHES_PAR_PARTIE} manches de ${ETOILES_PAR_MANCHE} étoiles, ${ETOILES_D_UNE_PARTIE} en tout.`}</Ligne>
        <Ligne icone="target">{`Une œuvre se gagne à ${seuilsDits(SEUILS_DES_RARETES)}.`}</Ligne>
        {/* « Toutes » plutôt qu'un nombre : le cadre doré veut chaque manche parfaite (`cadreDore`), combien qu'il y en ait. */}
        <Ligne icone="sparkles">Toutes ses manches parfaites, sans qu’un pouvoir ait servi : son cadre est doré.</Ligne>
        <Ligne icone="crown">Une salle complète réveille son gardien ; toute dorée, un second.</Ligne>
      </Section>
      <Section titre="Chaque jour">
        <Ligne icone="sun">{`La visite du jour : ${compte(parties, 'partie')}, chacune une œuvre en jeu que tu découvres en la gagnant.`}</Ligne>
        {/* Camille croyait pouvoir rejouer sa case perdue : « Faite », elle ne se rejoue pas — son œuvre, si, par une chasse. */}
        <Ligne icone="rotate">Chacune se joue une fois ; manquée, son œuvre se retente au même jeu pour une chasse.</Ligne>
        <Ligne icone="shuffle">{`Un jeu de la visite se change, ${ECHANGES_DITS[ECHANGES_PAR_JOUR]} par jour.`}</Ligne>
        <Ligne icone="search">{`${CHASSES_PAR_JOUR} chasses : touche un cadre vide, et joue au jeu où se trouve son œuvre.`}</Ligne>
        {/* Une œuvre a deux jeux selon le chemin : le sien, et celui de la case qui l'a mise en jeu — onze des quatorze œuvres gagnées
            à la visite de la tablée du 26 octobre 2026 l'avaient été ailleurs qu'à leur jeu, et leur fiche semblait se tromper. Le
            sien se dit par ce que son cadre vide affiche, pas par « sa chasse » : la retente d'une case manquée, une chasse, se joue
            au jeu de la case, et une case de la visite dore aussi, au jeu du jour — la ligne d'au-dessus le contredisait. */}
        <Ligne icone="gamepad">Chaque œuvre a son jeu, celui que son cadre vide affiche : on l’y cherche, on l’y dore ; la visite, elle, met ses œuvres en jeu aux jeux du jour.</Ligne>
        <Ligne icone="dice">{`Jouer librement, autant que tu veux : les ${LIBRES_QUI_PAIENT} premières parties libres paient leur poussière d’or.`}</Ligne>
        <Ligne icone="calendar">{`Une visite ou une chasse où tu réponds, chaque jour, fait ta série ; au ${JOURS_DU_SCARABEE}ᵉ jour, le Scarabée se réveille.`}</Ligne>
        <Ligne icone="flag">Quitter une partie la compte avec ses étoiles : elle ne se rejoue pas.</Ligne>
      </Section>
      <Section titre="La poussière d’or">
        <Ligne icone="sparkles">{`Une visite ou une chasse en rapporte ${POUSSIERE_PAR_ETOILE} par étoile, ${POUSSIERE_MIN} au moins dès que tu as répondu à une manche.`}</Ligne>
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
      {/* En lettres, comme le Cabinet se présente : `cabinet-ecran.test.ts` rougit si `CLES_DES_JEUX` n'en compte plus neuf. Repliés,
          comme le lexique : chaque annonce redit son jeu, son geste et son barème. */}
      <details className="glossaire cab-regles-replie">
        <summary>
          <Icon name="gamepad" />
          Les neuf jeux et leurs étoiles
          {/* Titré comme une section, il se dirait fermé pour de bon : le chevron dit qu'il s'ouvre, comme les autres replis. */}
          <Icon name="chevron-down" className="repli-chevron" />
        </summary>
        <ul className="cab-regles">
          {CLES_DES_JEUX.map(j => (
            <Ligne key={j} icone="gamepad">
              <b>{JEUX[j].nom}</b>
              {espacesFines(` : ${apresDeuxPoints(JEUX[j].geste)}`)}
              {/* Son barème sur sa ligne : collé à la phrase, « France. à moins de 40 km ★★★ » se lisait comme une faute. */}
              <span className="cab-bareme">
                <EnEtoiles texte={espacesFines(enDebutDeLigne(JEUX[j].bareme))} />
                {!jeux.includes(j) && <span className="cab-pastille">bientôt</span>}
              </span>
            </Ligne>
          ))}
        </ul>
      </details>
      <Section titre="Ce que tu apprends">
        <Ligne icone="book">Chaque œuvre gagnée garde sur son cartel ce que la partie t’a appris.</Ligne>
        {/* Le chemin de tes murs : la feuille se ferme en y menant, sans quoi elle restait ouverte par-dessus eux. */}
        <Ligne icone="repere">
          {espacesFines('Chaque lieu épinglé, chaque date rangée prend sa place sur ')}
          <a className="cab-lien-en-ligne" href={adresseDe({ e: 'murs' })} onClick={onMurs}>
            tes murs
          </a>
          .
        </Ligne>
        <Ligne icone="clock">{`Ce que tu as vu ne revient pas avant ${JOURS_SANS_REDITE} jours, d’un jeu à l’autre.`}</Ligne>
      </Section>
    </>
  )
}

/** Les règles en feuille, ouvertes de « Comment ça marche ? » — au musée, et à l'annonce d'une partie. */
export function FeuilleDesRegles({ jeux, parties, onFermer }: { jeux: readonly CleDeJeu[]; parties?: number; onFermer: () => void }) {
  return (
    <Feuille titre="Comment ça marche ?" onFermer={onFermer} className="cab-feuille">
      <Regles jeux={jeux} parties={parties} onMurs={onFermer} />
    </Feuille>
  )
}
