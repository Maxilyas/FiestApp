import { Fragment, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { Ecusson } from './Ecusson'
import { Medaille } from './Jour'
import { Case, LUEUR, OR, lueur } from './Atlas'
import { MaVitrine, UnProche, laVitrine } from './Trophees'
import { espacesFines, formatNumber } from '../format'
import { lesPlusProches } from '../../../shared/proches'
import { prochainSeuil } from '../../../shared/ecussons'
import { BRANCHES } from '../../../shared/branches'
import type { HautFaitVu } from '../../../shared/hautsfaits'
import { NOM_RARETE, type Rarete } from '../../../shared/badges'
import type { PublicProfileDetail } from '../../../shared/profil'

// Les trophées, simples : la vitrine sur une ligne, puis six collections en
// liste — une ligne chacune, son compte et sa jauge —, qu'on déplie sur
// place. Une seule ouverte à la fois : six cartes empilées faisaient une
// page qu'on ne lisait plus. Chaque case dépliée s'ouvre sur sa règle.

type Collection = 'eclats' | 'ombres' | 'paliers' | 'ecussons' | 'prix' | 'jour'

/** Une teinte par collection : l'icône de sa ligne, son compte, sa jauge. Jamais un texte long. */
const COULEURS: Record<Collection, string> = {
  eclats: OR,
  ombres: '#b9a6ff',
  paliers: '#ff9f5a',
  ecussons: '#7ccf6a',
  prix: '#ff6b8a',
  jour: '#ffd36e',
}
const METAUX = ['Bronze', 'Argent', 'Or'] as const

/** La branche d'une catégorie, pour sa couleur. */
const lueurDe = (categorie: string) => LUEUR[BRANCHES.find(b => b.categorie === categorie)?.key ?? 'monde']

/** Une jauge fine : où l'on en est, sans un chiffre de plus. */
function JaugeFine({ part }: { part: number }) {
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

export function TropheesAtlas({
  profil,
  busy,
  enregistrer,
}: {
  profil: PublicProfileDetail
  busy: boolean
  enregistrer: (patch: { vitrine: string[] | null }) => void
}) {
  const [collection, setCollection] = useState<Collection | null>(null)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [changer, setChanger] = useState(false)
  const toucher = (k: string) => setOuvert(o => (o === k ? null : k))
  const choisir = (c: Collection | null) => {
    setCollection(c)
    setOuvert(null)
  }

  const soiree = profil.hautsFaits.filter(h => h.famille === 'soiree')
  const eclats = soiree.filter(h => h.ton !== 'ombre')
  const ombres = soiree.filter(h => h.ton === 'ombre')
  const paliers = profil.hautsFaits.filter(h => h.famille === 'carriere')
  const prix = profil.prix ?? []
  const ecussons = profil.ecussons ?? []
  const jour = profil.jour
  const proches = lesPlusProches(profil.hautsFaits, profil.legendaires)
  const { gagnes, montres } = laVitrine(profil)
  const eus = (l: readonly { fois: number }[]) => l.filter(x => x.fois > 0).length
  const crans = paliers.reduce((s, h) => s + Math.min(3, h.fois), 0)
  const ecussonsEus = ecussons.filter(e => e.palier > 0).length

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
        {/* Ce qu'il peut chasser à la prochaine soirée, avant le catalogue. */}
        {proches.length > 0 && (
          <div className="proches">
            <span className="label">Les plus proches</span>
            {proches.map(p => (
              <UnProche key={p.key} p={p} />
            ))}
          </div>
        )}
        <p className="muted small">Ils se décernent à la fin de chaque soirée, et certains réveillent un légendaire.</p>
        {grille(eclats, 'Réussi')}
      </>
    ),
    ombres: grille(ombres, 'Subi'),
    paliers: <ul className="paliers">{paliers.map(palier)}</ul>,
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
        </>
      ),
  }

  const victoires = jour?.victoires ?? 0
  const LIGNES: { cle: Collection; emoji: string; nom: string; detail: string; compte: string; part: number }[] = [
    { cle: 'eclats', emoji: '⚡', nom: 'Hauts faits', detail: 'Ce qu’on réussit de remarquable en soirée', compte: `${eus(eclats)}/${eclats.length}`, part: eus(eclats) / Math.max(1, eclats.length) },
    { cle: 'ombres', emoji: '💥', nom: 'Coups du sort', detail: 'Les soirées où rien ne va', compte: `${eus(ombres)}/${ombres.length}`, part: eus(ombres) / Math.max(1, ombres.length) },
    { cle: 'paliers', emoji: '🎖️', nom: 'Paliers', detail: 'Bronze, argent, or, sur toute ta carrière', compte: `${crans}/${paliers.length * 3}`, part: crans / Math.max(1, paliers.length * 3) },
    { cle: 'ecussons', emoji: '🛡️', nom: 'Écussons', detail: 'Les bonnes réponses de chaque catégorie', compte: `${ecussonsEus}/${ecussons.length}`, part: ecussonsEus / Math.max(1, ecussons.length) },
    { cle: 'prix', emoji: '🏅', nom: 'Prix', detail: 'Ceux qu’annonce la fin d’une soirée', compte: `${eus(prix)}/${prix.length}`, part: eus(prix) / Math.max(1, prix.length) },
    { cle: 'jour', emoji: '☀️', nom: 'Quiz du jour', detail: 'Tes médailles du matin', compte: `${victoires} victoire${victoires > 1 ? 's' : ''}`, part: jour && jour.joues > 0 ? 1 : 0 },
  ]

  return (
    <div className="trophees">
      {/* La vitrine, sur une ligne : ce que sa carte montre à la salle. */}
      <section className="vitrine-ligne" aria-label="Ma vitrine">
        <span className="vitrine-ligne-texte">
          <span className="label">Ma vitrine</span>
          {gagnes.length > 0 ? (
            <button type="button" className="link-inline" aria-expanded={changer} onClick={() => setChanger(c => !c)}>
              {changer ? 'Fermer' : 'Changer'}
            </button>
          ) : (
            <span className="muted small">Elle se remplit à la fin de chaque soirée</span>
          )}
        </span>
        <span className="vitrine-ligne-medailles">
          {montres.slice(0, 3).map(v => (
            <span key={v.key} className="vitrine-petite" title={v.title}>
              <span aria-hidden="true">{v.emoji}</span>
              <span className="sr-only">{v.title}</span>
            </span>
          ))}
        </span>
      </section>
      {changer && <MaVitrine profil={profil} busy={busy} enregistrer={enregistrer} />}

      {/* Six collections en liste : une ligne chacune, qu'on déplie sur place. */}
      <ul className="trophees-liste">
        {LIGNES.map(l => {
          const ouverte = collection === l.cle
          return (
            <li key={l.cle} className={'trophee' + (ouverte ? ' trophee-ouvert' : '')} style={lueur(COULEURS[l.cle])}>
              <button type="button" className="trophee-ligne" aria-expanded={ouverte} onClick={() => choisir(ouverte ? null : l.cle)}>
                <span className="trophee-emoji" aria-hidden="true">
                  {l.emoji}
                </span>
                <span className="trophee-texte">
                  <b>{l.nom}</b>
                  <span className="muted small">{l.detail}</span>
                </span>
                <span className="trophee-compte">
                  {l.compte}
                  <JaugeFine part={l.part} />
                </span>
                <Icon name="chevron-down" className="trophee-chevron" />
              </button>
              {ouverte && <div className="trophee-contenu">{contenus[l.cle]}</div>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
