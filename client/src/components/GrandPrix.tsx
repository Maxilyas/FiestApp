// Ce que le Grand Prix dessine lui-même (`shared/grandPrix.ts`) : ses chevaux,
// des constellations — des étoiles reliées de fils de lumière, la décision du
// propriétaire du 19 novembre 2026 (« chevaux constellation ») : rien à
// peindre, raccord avec le ciel de la course, et léger sur un vieux
// téléphone —, son obstacle, une barre d'étoiles, et le flot, la rosette du
// concours hippique, l'avatar de la personne battue en son cœur. Le fantôme
// se dessine en pointillé bleu ; le coureur, en or.
//
// Rien ne bouge que par `transform` et `opacity` (la règle des dessins de
// l'application), et rien du tout si le téléphone demande moins de mouvement
// (`styles.css`, « Le Grand Prix »).

import { Avatar } from './Avatar'
import { Feuille } from './Pieces'
import { RUBANS, RUBAN_D_HONNEUR, type CleDeRuban, type FantomeVu } from '../../../shared/grandPrix'

/** Les étoiles d'un cheval au saut, dans un repère de 120 × 72 : ses articulations. */
const ETOILES_DU_SAUT: readonly [number, number, number][] = [
  [104, 26, 2.2], [92, 10, 1.8], [90, 3, 1.2], [90, 28, 1.3], [72, 30, 2.6], [54, 33, 1.4], [36, 30, 2.4], [24, 30, 1.2], [14, 38, 1.3],
  [10, 48, 1.6], [76, 46, 1.8], [86, 54, 1.3], [82, 62, 1.6], [80, 60, 1.2], [74, 66, 1.5], [50, 48, 1.3], [38, 46, 1.8], [24, 54, 1.2],
  [10, 58, 1.5], [28, 60, 1.2], [16, 68, 1.5],
]

/** Ses fils : l'encolure, le dos, la queue, le ventre, et les quatre jambes repliées sous lui. */
const FILS_DU_SAUT: readonly string[] = [
  '104,26 92,10 72,30 54,33 36,30 24,30 14,38 10,48',
  '92,10 90,3',
  '104,26 90,28 72,30',
  '72,30 76,46 74,50 86,54 82,62',
  '76,46 70,50 80,60 74,66',
  '76,46 50,48 38,46 36,30',
  '38,46 24,54 10,58',
  '42,48 28,60 16,68',
]

/** Au galop, entre deux sauts : les jambes sous lui. */
const ETOILES_DU_GALOP: readonly [number, number, number][] = [
  [104, 22, 2.2], [92, 6, 1.8], [72, 28, 2.7], [54, 31, 1.3], [36, 30, 2.5], [14, 40, 1.3], [10, 50, 1.6], [74, 46, 1.9], [80, 58, 1.3],
  [76, 72, 1.6], [64, 56, 1.2], [66, 72, 1.6], [40, 46, 1.9], [30, 58, 1.2], [34, 72, 1.6], [22, 58, 1.2], [14, 68, 1.6],
]

const FILS_DU_GALOP: readonly string[] = [
  '104,22 92,6 72,28 54,31 36,30 24,32 14,40 10,50',
  '104,22 90,26 72,28',
  '72,28 74,46 80,58 76,72',
  '74,46 64,56 66,72',
  '74,46 50,48 40,46 36,30',
  '40,46 30,58 34,72',
  '40,46 22,58 14,68',
]

/** Les ailes de Pégase, pour la constellation d'un prix. */
const FILS_DES_AILES: readonly string[] = ['70,30 62,12 52,0 40,-6', '62,12 54,16 44,12', '66,22 56,26 47,24']

export type PoseDuCheval = 'galop' | 'saut'

/**
 * Un cheval d'étoiles. Le fantôme, en pointillé bleu ; le coureur, en or.
 * Décoratif : sa place dans la course se dit en mots à côté.
 */
export function ChevalDEtoiles({ pose, fantome = false, className }: { pose: PoseDuCheval; fantome?: boolean; className?: string }) {
  const etoiles = pose === 'saut' ? ETOILES_DU_SAUT : ETOILES_DU_GALOP
  const fils = pose === 'saut' ? FILS_DU_SAUT : FILS_DU_GALOP
  return (
    <svg className={`gp-cheval${fantome ? ' gp-cheval-fantome' : ''}${className ? ` ${className}` : ''}`} viewBox="0 -2 120 76" aria-hidden="true">
      <g className="gp-fils">
        {fils.map(p => (
          <polyline key={p} points={p} />
        ))}
      </g>
      <g className="gp-etoiles">
        {etoiles.map(([x, y, r]) => (
          <circle key={`${x},${y}`} cx={x} cy={y} r={r} />
        ))}
      </g>
    </svg>
  )
}

/** Pégase en constellation : l'emblème d'un prix pas encore peint, et la marque du Grand Prix. */
export function PegaseDEtoiles({ className }: { className?: string }) {
  return (
    <svg className={`gp-pegase${className ? ` ${className}` : ''}`} viewBox="-2 -10 124 84" aria-hidden="true">
      <g className="gp-fils">
        {[...FILS_DU_SAUT, ...FILS_DES_AILES].map(p => (
          <polyline key={p} points={p} />
        ))}
      </g>
      <g className="gp-etoiles">
        {[...ETOILES_DU_SAUT, [40, -6, 1.8] as const, [52, 0, 1.3] as const, [62, 12, 1.6] as const].map(([x, y, r]) => (
          <circle key={`${x},${y}`} cx={x} cy={y} r={r} />
        ))}
      </g>
    </svg>
  )
}

/** L'obstacle : deux montants et trois barres d'étoiles ; la barre du haut tombée, une faute. */
export function Obstacle({ tombee = false, fantome = false, className }: { tombee?: boolean; fantome?: boolean; className?: string }) {
  return (
    <svg className={`gp-obstacle${className ? ` ${className}` : ''}`} viewBox="0 0 66 76" aria-hidden="true">
      <g className="gp-montants">
        <line x1="6" y1="4" x2="6" y2="72" />
        <line x1="56" y1="4" x2="56" y2="72" />
      </g>
      <g className="gp-barres">
        {!tombee && <line x1="6" y1="24" x2="56" y2="24" />}
        <line x1="6" y1="38" x2="56" y2="38" />
        <line x1="6" y1="52" x2="56" y2="52" />
      </g>
      {tombee && <line className={`gp-barre-tombee${fantome ? ' gp-barre-du-fantome' : ''}`} x1="10" y1="66" x2="64" y2="73" />}
      <g className="gp-etoiles">
        <circle cx="6" cy="4" r="2.6" />
        <circle cx="56" cy="4" r="2.6" />
      </g>
    </svg>
  )
}

/**
 * Le flot, la rosette des cavaliers classés : ses rubans à la couleur du
 * Grand Prix — l'or pour le flot d'honneur de la personne fêtée —, et en son
 * cœur l'avatar de la personne battue, tel qu'il le portait ce jour-là. Le
 * prix générique de chaque Grand Prix : dessiné ici, rien à peindre.
 */
export function Flot({ ruban, honneur = false, fantome, nom, taille = 96, className }: {
  ruban: CleDeRuban
  honneur?: boolean
  fantome: FantomeVu | null
  /** Ce que le lecteur d'écran en dit : « Le flot du Grand Prix de Léa ». */
  nom: string
  taille?: number
  className?: string
}) {
  const couleurs = honneur ? RUBAN_D_HONNEUR : RUBANS[ruban]
  return (
    <span className={`gp-flot${className ? ` ${className}` : ''}`} role="img" aria-label={nom} style={{ width: taille, height: taille * 1.25 }}>
      <svg viewBox="0 0 120 150" aria-hidden="true">
        <polygon points="44,70 30,148 40,139 50,148 60,80" fill={couleurs.pli} />
        <polygon points="76,70 90,148 80,139 70,148 60,80" fill={couleurs.pli} />
        <circle cx="60" cy="58" r="54" fill={couleurs.rond} />
        <circle cx="60" cy="58" r="49" fill="none" stroke={couleurs.pli} strokeWidth="10" strokeDasharray="3 3.4" />
        <circle cx="60" cy="58" r="38" fill={honneur ? '#f3e3b5' : '#d9b56a'} />
        <circle cx="60" cy="58" r="34" fill="none" stroke={honneur ? '#c9a35a' : '#a9853f'} strokeWidth="5" strokeDasharray="2 2.4" />
        <circle cx="60" cy="58" r="28" fill="#1c2246" stroke="#f3e3b5" strokeWidth="1.5" />
      </svg>
      {fantome && (
        // Le cœur du flot fait un peu moins de la moitié de sa largeur : l'avatar y tient, son cercle avec.
        <span className="gp-flot-coeur" aria-hidden="true" style={{ fontSize: Math.round(taille * 0.3) }}>
          <Avatar avatar={fantome.avatar} finition={fantome.finition} eclat={fantome.eclat} legendaire={fantome.legendaire} sceau={fantome.sceau} />
        </span>
      )}
    </span>
  )
}

/** Le ciel de la course : la Voie lactée et quelques étoiles, posés derrière tout. */
export function CielDuGrandPrix({ className }: { className?: string }) {
  return (
    <svg className={`gp-ciel${className ? ` ${className}` : ''}`} viewBox="0 0 390 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <ellipse cx="210" cy="140" rx="300" ry="46" className="gp-voie-lactee" transform="rotate(-15 210 140)" />
      <g className="gp-etoiles-du-ciel">
        {[
          [18, 60, 1], [48, 150, 0.8], [76, 80, 0.6], [104, 190, 1.1], [130, 50, 0.7], [150, 130, 0.6], [182, 70, 1], [210, 170, 0.7], [236, 50, 0.9],
          [262, 140, 0.6], [290, 80, 1.2], [318, 180, 0.7], [344, 60, 0.8], [370, 130, 1], [380, 210, 0.6], [26, 240, 0.7], [160, 250, 0.6], [300, 255, 0.7],
        ].map(([x, y, r]) => (
          <circle key={`${x},${y}`} cx={x} cy={y} r={r} />
        ))}
      </g>
    </svg>
  )
}

/**
 * Le Grand Prix du jour sur l'accueil, à la place de l'affiche d'une
 * nouveauté (« l'affiche du jour suffit », le propriétaire, le 19 novembre
 * 2026) : le même bandeau, ses mesures et sa place — l'accueil tient sur un
 * écran, et ses règles lisent `.affiche` (règle `profil.md`) —, le flot du
 * jour en guise de scène. Tout le bandeau mène à la course.
 */
export function BandeauDuGrandPrix({ gp }: { gp: import('../../../shared/grandPrix').GrandPrixDAccueil }) {
  const titre = `gp-bandeau-${gp.id}`
  const geste = gp.fete ? 'Mon Grand Prix' : gp.battu ? 'Recourir' : 'Courir'
  return (
    <section className="affiche affiche-bandeau gp-bandeau" aria-labelledby={titre}>
      <div className="affiche-scene gp-bandeau-scene" aria-hidden="true">
        <Flot ruban={gp.ruban} honneur={gp.fete} fantome={gp.fantome} nom="" taille={40} />
      </div>
      <p className="affiche-sur">{gp.fete ? 'Ton jour' : 'Aujourd’hui'}</p>
      <h2 className="affiche-titre" id={titre}>
        {gp.titre}
      </h2>
      <p className="affiche-phrase">
        {gp.fete
          ? `Toute la bande court contre ton fantôme${gp.vainqueurs > 0 ? ` : ${gp.vainqueurs} t’${gp.vainqueurs > 1 ? 'ont' : 'a'} battu` : ''}.`
          : gp.battu
            ? `Tu as battu ${gp.fantome.nom} : son flot est à toi.`
            : `Bats le fantôme de ${gp.fantome.nom}${gp.terrain.length > 0 ? ' sur son terrain' : ''}.`}
      </p>
      <div className="affiche-gestes">
        <a className="affiche-aller" href="/grand-prix">
          <span className="affiche-aller-texte">
            <span className="affiche-aller-ligne">{geste}</span>
          </span>
        </a>
      </div>
    </section>
  )
}

/** La carte de la fêtée vue, sur ce téléphone, pour ce Grand Prix : elle ne se redit pas à chaque accueil de sa journée. */
const cleDeLaFeteVue = (id: string) => `quizz.grand-prix.fete.${id}`

export function feteVue(id: string): boolean {
  try {
    return localStorage.getItem(cleDeLaFeteVue(id)) === '1'
  } catch {
    return false
  }
}

/**
 * Le réveil de la personne fêtée, le jour de son Grand Prix : une feuille
 * par-dessus l'accueil — le mot de l'administrateur, son flot d'honneur et
 * l'avatar en plus dans sa version à elle, rangés pour elle le jour venu.
 * Une feuille, pas une carte dans la page : posée au-dessus des boutons,
 * elle faisait défiler l'accueil de 300 pixels, et l'accueil tient sur un
 * écran (règle `profil.md`). Une fois par téléphone : la fermer la range ;
 * le bandeau du jour, lui, reste.
 */
export function FeteDuGrandPrix({ gp, onFermer }: { gp: import('../../../shared/grandPrix').GrandPrixDAccueil; onFermer: () => void }) {
  const fermer = () => {
    try {
      localStorage.setItem(cleDeLaFeteVue(gp.id), '1')
    } catch {
      // Un stockage refusé : la feuille reviendra à l'accueil suivant, rien de plus.
    }
    onFermer()
  }
  return (
    <Feuille
      titre="Ton Grand Prix"
      onFermer={fermer}
      className="gp-fete-feuille"
      pied={
        <div className="gp-fete-gestes">
          {gp.prixFete && (
            <a className="btn" href={`/profil?essayer=${encodeURIComponent(gp.prixFete)}#avatar`} onClick={fermer}>
              Le porter
            </a>
          )}
          <a className="btn btn-primary" href="/grand-prix" onClick={fermer}>
            Mon Grand Prix
          </a>
        </div>
      }
    >
      <div className="gp-fete">
        <CielDuGrandPrix />
        <h2>{gp.titre}</h2>
        {gp.mot && <p className="gp-fete-mot">« {gp.mot} »</p>}
        <div className="gp-fete-cadeaux">
          <figure>
            <Flot ruban={gp.ruban} honneur fantome={gp.fantome} nom="" taille={84} />
            <figcaption>Ton flot d’honneur</figcaption>
          </figure>
          {gp.prixFete && (
            <figure>
              <Avatar className="gp-fete-prix" avatar="🐴" legendaire={gp.prixFete} grand />
              <figcaption>{gp.nomDuPrixFete ?? 'Rien que pour toi'}</figcaption>
            </figure>
          )}
        </div>
        {/* Une ligne, dans sa nuit : le paragraphe qui la suivait sous la carte — son terrain, les règles, « toi aussi,
            tu peux courir » — était de trop (le propriétaire, le 19 novembre 2026). Le terrain se voit sur sa page. */}
        <p className="gp-fete-ligne">Toute la bande court contre ton fantôme</p>
      </div>
    </Feuille>
  )
}
