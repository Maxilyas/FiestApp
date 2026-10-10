import { Fragment, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { Ecusson } from './Ecusson'
import { Medaille } from './Jour'
import { Case, LUEUR, OR, lueur } from './Atlas'
import { UnProche } from './Trophees'
import { Calendrier } from './Calendrier'
import { espacesFines, formatNumber } from '../format'
import { lesPlusProches } from '../../../shared/proches'
import { prochainSeuil } from '../../../shared/ecussons'
import { BRANCHES } from '../../../shared/branches'
import type { HautFaitVu } from '../../../shared/hautsfaits'
import { NOM_RARETE, type Rarete } from '../../../shared/badges'
import type { PublicProfileDetail } from '../../../shared/profil'
import { LIEU_DES_TROPHEES, comptesDesTrophees, listesDesTrophees, type LieuDesTrophees, type PartieDesTrophees } from '../../../shared/collection'

// Les trophées, dans « Ma collection » : dix collections en liste — une
// ligne chacune, son compte et sa jauge —, qu'on déplie sur place, rangées
// par où elles se gagnent : en soirée, au quiz du jour, en campagne, et
// partout. Sept lignes mêlaient deux logiques, et la partie était
// « incompréhensible » (un retour du 10 octobre 2026). Une seule ouverte à
// la fois : des cartes empilées faisaient une page qu'on ne lisait plus.
// Chaque case dépliée s'ouvre sur sa règle. La vitrine, qui y tenait sa
// ligne, se règle dans « Ma carte » : c'est la carte qui la montre.

type Collection = PartieDesTrophees

/** Une teinte par collection : l'icône de sa ligne, son compte, sa jauge. Jamais un texte long. */
const COULEURS: Record<Collection, string> = {
  eclats: OR,
  ombres: '#b9a6ff',
  prix: '#ff6b8a',
  paliers: '#ff9f5a',
  jour: '#ffd36e',
  paliersDuJour: '#ffb454',
  campagne: '#6ec8ff',
  paliersDeCampagne: '#59a8ff',
  ecussons: '#7ccf6a',
  paliersDeToujours: '#e9c46a',
}

/** Les sections, dans l'ordre : où se gagne ce qu'elles rangent. */
const SECTIONS: { lieu: LieuDesTrophees; nom: string }[] = [
  { lieu: 'soiree', nom: 'En soirée' },
  { lieu: 'jour', nom: 'Au quiz du jour' },
  { lieu: 'campagne', nom: 'En campagne' },
  { lieu: 'partout', nom: 'Partout' },
]
const METAUX = ['Bronze', 'Argent', 'Or'] as const

/** La branche d'une catégorie, pour sa couleur. */
const lueurDe = (categorie: string) => LUEUR[BRANCHES.find(b => b.categorie === categorie)?.key ?? 'monde']

/** Une jauge fine : où l'on en est, sans un chiffre de plus. */
export function JaugeFine({ part }: { part: number }) {
  return (
    <span className="jauge-fine" aria-hidden="true">
      <span style={{ width: `${Math.round(Math.max(0, Math.min(1, part)) * 100)}%` }} />
    </span>
  )
}

interface Collectionnable {
  key: string
  emoji: string
  title: string
  rule: string
  fois: number
  rarete?: Rarete | null
}

/**
 * Une ligne d'une collection : son emblème, son nom, ce qu'on y trouve, son
 * compte et sa jauge — elle se déplie sur place, sous son nom. Les trophées
 * et « Ma collection » ont les mêmes.
 */
export function LigneDeCollection({
  id,
  emoji,
  nom,
  detail,
  compte,
  part,
  couleur,
  ouverte,
  onToucher,
  children,
}: {
  id?: string
  emoji: string
  nom: string
  detail: string
  compte: string
  part: number
  couleur: string
  ouverte: boolean
  onToucher: () => void
  children: ReactNode
}) {
  return (
    <li id={id} className={'trophee' + (ouverte ? ' trophee-ouvert' : '')} style={lueur(couleur)}>
      <button type="button" className="trophee-ligne" aria-expanded={ouverte} onClick={onToucher}>
        <span className="trophee-emoji" aria-hidden="true">
          {emoji}
        </span>
        <span className="trophee-texte">
          <b>{nom}</b>
          <span className="muted small">{detail}</span>
        </span>
        <span className="trophee-compte">
          {compte}
          <JaugeFine part={part} />
        </span>
        <Icon name="chevron-down" className="trophee-chevron" />
      </button>
      {ouverte && <div className="trophee-contenu">{children}</div>}
    </li>
  )
}

export function TropheesAtlas({ profil }: { profil: PublicProfileDetail }) {
  const [collection, setCollection] = useState<Collection | null>(null)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const toucher = (k: string) => setOuvert(o => (o === k ? null : k))
  const choisir = (c: Collection | null) => {
    setCollection(c)
    setOuvert(null)
  }

  // Ce que chaque collection montre, et son compte : la règle de « Ma
  // collection » (`shared/collection.ts`), qui fait aussi son total.
  const { eclats, ombres, duJour, deCampagne, paliers, paliersDuJour, paliersDeCampagne, paliersDeToujours, prix, ecussons } = listesDesTrophees(profil)
  const comptes = new Map(comptesDesTrophees(profil).map(c => [c.partie, c]))
  const jour = profil.jour
  const proches = lesPlusProches(profil.hautsFaits, profil.legendaires)

  /** Une grille de hauts faits ou de prix : allumés si on les a, la règle à l'ouverture. */
  const grille = (liste: Collectionnable[], quoi: string) => (
    <div className="hud-grille">
      {liste.map(h => (
        <Fragment key={h.key}>
          <Case
            gagne={h.fois > 0}
            ouverte={ouvert === h.key}
            label={`${h.title}${h.fois > 0 ? `, ${h.fois} fois` : ', pas encore'}`}
            marque={h.fois > 0 ? `×${h.fois}` : ''}
            onClick={() => toucher(h.key)}
          >
            <span className="hud-emoji" aria-hidden="true">
              {h.emoji}
            </span>
          </Case>
          {ouvert === h.key && (
            <div className="hud-fiche">
              <div className="hud-detail">
                <span className="hud-detail-emoji" aria-hidden="true">
                  {h.emoji}
                </span>
                <b>{h.title}</b>
                <p className="small">{espacesFines(h.rule)}</p>
                {h.rarete && <p className="small muted">{NOM_RARETE[h.rarete]}</p>}
                <p className="small hud-detail-compte">{h.fois > 0 ? `${quoi} ${h.fois} fois` : 'Pas encore'}</p>
              </div>
            </div>
          )}
        </Fragment>
      ))}
    </div>
  )

  /** Un haut fait de carrière : ses trois métaux, et ce qui manque au suivant. */
  const palier = (h: HautFaitVu) => {
    const valeur = h.valeur ?? 0
    const mesure = valeur < 2 && h.ruleUne ? h.ruleUne : h.rule
    return (
      <li key={h.key} className="palier-ligne">
        <span className="palier-emoji" aria-hidden="true">
          {h.emoji}
        </span>
        <span className="palier-texte">
          <b>{h.title}</b>
          <span className="palier-metaux" role="img" aria-label={`${Math.min(3, h.fois)} palier${h.fois > 1 ? 's' : ''} sur 3`}>
            {METAUX.map((m, k) => (
              <i key={m} className={`palier-metal palier-${m.toLowerCase()}` + (k < h.fois ? ' allume' : '')} />
            ))}
          </span>
          {h.prochain ? (
            <>
              <JaugeFine part={valeur / h.prochain} />
              <span className="atlas-seuil">
                {/* Le niveau s'écrit devant son chiffre ; le reste, derrière. */}
                {h.key === 'hf:legende'
                  ? `Niveau ${valeur} · ${METAUX[Math.min(2, h.fois)]} au niveau ${h.prochain}`
                  : `${formatNumber(valeur)} / ${formatNumber(h.prochain)} ${mesure} · ${METAUX[Math.min(2, h.fois)]} à ${formatNumber(h.prochain)}`}
              </span>
            </>
          ) : (
            <span className="atlas-seuil">Tous les paliers</span>
          )}
        </span>
      </li>
    )
  }

  const contenus: Record<Collection, ReactNode> = {
    eclats: (
      <>
        <p className="muted small">Ils se décernent à la fin de chaque soirée, et certains réveillent un légendaire.</p>
        {grille(eclats, 'Réussi')}
      </>
    ),
    ombres: grille(ombres, 'Subi'),
    paliers: <ul className="paliers">{paliers.map(palier)}</ul>,
    paliersDuJour: <ul className="paliers">{paliersDuJour.map(palier)}</ul>,
    paliersDeCampagne: <ul className="paliers">{paliersDeCampagne.map(palier)}</ul>,
    paliersDeToujours: <ul className="paliers">{paliersDeToujours.map(palier)}</ul>,
    ecussons: (
      <ul className="hud-ecussons">
        {ecussons.map(e => {
          const suivant = prochainSeuil(e.palier)
          return (
            <li key={e.categorie} style={lueur(lueurDe(e.categorie))} className={e.palier > 0 ? 'hud-gagne' : 'hud-ferme'}>
              <Ecusson categorie={e.categorie} palier={e.palier} />
              <JaugeFine part={suivant ? e.justes / suivant : 1} />
              <span className="atlas-seuil">{suivant ? `${formatNumber(e.justes)} / ${formatNumber(suivant)}` : `${formatNumber(e.justes)} · or`}</span>
            </li>
          )
        })}
      </ul>
    ),
    prix: grille(prix, 'Remporté'),
    jour:
      !jour || jour.joues === 0 ? (
        <p className="atlas-objectif">
          Dix questions chaque jour, les mêmes pour tous.{' '}
          <a className="link-inline" href="/jour">
            Jouer celui d’aujourd’hui
          </a>
        </p>
      ) : (
        <>
          <div className="medailles-du-jour" role="list" aria-label="Mes médailles">
            {(['or', 'argent', 'bronze'] as const).map(m => (
              <span key={m} role="listitem" className={jour.medailles[m] > 0 ? 'hud-gagne' : 'hud-ferme'}>
                <Medaille medaille={m} className="medaille-grande" />
                <b>{jour.medailles[m]}</b>
              </span>
            ))}
          </div>
          <div className="hud-chiffres">
            <span>
              <b>{formatNumber(jour.joues)}</b>jours joués
            </span>
            <span>
              <b>{jour.record}</b>meilleure série
            </span>
            <span>
              <b>{formatNumber(jour.meilleurScore)}</b>meilleur score
            </span>
          </div>
          <p className="muted small">Ceux qui se gagnent au quiz du jour — à la fin de la partie, ou la nuit qui le clôt.</p>
          {grille(duJour, 'Réussi')}
          {profil.calendrier && (
            <Calendrier
              pages={profil.calendrier.pages}
              dorees={profil.calendrier.dorees}
              moisEnCours={profil.calendrier.mois}
              joursCeMois={profil.calendrier.joursCeMois}
            />
          )}
        </>
      ),
    campagne: (
      <>
        <p className="muted small">
          Ceux qui se gagnent dans une série à trois vies, et au défi de la semaine.{' '}
          <a className="link-inline" href="/campagne">
            Jouer une série
          </a>
        </p>
        {grille(deCampagne, 'Réussi')}
      </>
    ),
  }

  const LIGNES: { cle: Collection; emoji: string; nom: string; detail: string }[] = [
    { cle: 'eclats', emoji: '⚡', nom: 'Hauts faits', detail: 'Ce qu’on réussit de remarquable en soirée' },
    { cle: 'ombres', emoji: '💥', nom: 'Coups du sort', detail: 'Les soirées où rien ne va' },
    { cle: 'prix', emoji: '🏅', nom: 'Prix', detail: 'Ceux qu’annonce la fin d’une soirée' },
    { cle: 'paliers', emoji: '🎖️', nom: 'Paliers des soirées', detail: 'Bronze, argent, or, soirée après soirée' },
    { cle: 'jour', emoji: '☀️', nom: 'Hauts faits du jour', detail: 'Tes médailles, ses hauts faits, le calendrier' },
    { cle: 'paliersDuJour', emoji: '📆', nom: 'Paliers du jour', detail: 'Bronze, argent, or, jour après jour' },
    { cle: 'campagne', emoji: '🧗', nom: 'Hauts faits de campagne', detail: 'La série à trois vies, le défi de la semaine' },
    { cle: 'paliersDeCampagne', emoji: '⛰️', nom: 'Paliers de campagne', detail: 'Bronze, argent, or, série après série' },
    { cle: 'ecussons', emoji: '🛡️', nom: 'Écussons', detail: 'Les bonnes réponses de chaque catégorie, où que tu joues' },
    { cle: 'paliersDeToujours', emoji: '🌟', nom: 'Paliers de toujours', detail: 'Ton niveau, et tes Éclats de partout' },
  ]

  return (
    <>
      {/* Ce qu'il peut chasser bientôt, d'où qu'il vienne : avant le catalogue. */}
      {proches.length > 0 && (
        <div className="proches trophees-proches">
          <span className="label">Les plus proches</span>
          {proches.map(p => (
            <UnProche key={p.key} p={p} />
          ))}
        </div>
      )}
      {SECTIONS.map(s => (
        <section key={s.lieu} className="trophees-section" aria-labelledby={`trophees-${s.lieu}`}>
          <h3 id={`trophees-${s.lieu}`} className="label trophees-lieu">
            {s.nom}
          </h3>
          {/* Une ligne par collection, qu'on déplie sur place. */}
          <ul className="trophees-liste">
            {LIGNES.filter(l => LIEU_DES_TROPHEES[l.cle] === s.lieu).map(l => {
              const ouverte = collection === l.cle
              const { acquis, total } = comptes.get(l.cle) ?? { acquis: 0, total: 0 }
              return (
                <LigneDeCollection
                  key={l.cle}
                  emoji={l.emoji}
                  nom={l.nom}
                  detail={l.detail}
                  // Partout le même compte que la jauge : « 1 victoire » sur une jauge de hauts faits ne disait pas la même chose.
                  compte={`${acquis}/${total}`}
                  part={acquis / Math.max(1, total)}
                  couleur={COULEURS[l.cle]}
                  ouverte={ouverte}
                  onToucher={() => choisir(ouverte ? null : l.cle)}
                >
                  {contenus[l.cle]}
                </LigneDeCollection>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}
