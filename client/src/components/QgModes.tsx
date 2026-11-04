import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { confirmDialog } from './Dialog'
import { Icon } from './Icon'
import { Etincelle, GrapheDuTemps, TuileDuQg, barreArrondie, useLargeur } from './QgGraphes'
import { etiquetteDeLAxe, nomDuSeau } from './QgVueDEnsemble'
import { fluxDuQg } from '../qgFlux'
import { formatNumber } from '../../../shared/typographie'
import { jourEnToutesLettres } from '../../../shared/jour'
import { NOM_DU_MODE, ecartALHabitude, graduations, jourAbrege, type CompteDuJour, type EcartALHabitude, type ModeDuQg, type VueDEnsemble } from '../../../shared/qg'
import { PERIODE_EN_TOUTES_LETTRES, ecartALaPeriodeDAvant, type PeriodeDuQg } from '../../../shared/qgPeriodes'
import { POINTS_DU_DIRECT } from '../../../shared/qgDirect'
import { marchesDeLEntonnoir, partiesParJoueur, type EtapeDeLEntonnoir } from '../../../shared/qgModes'

/**
 * Les pièces que partagent les pages des modes du QG — le quiz du jour, la
 * campagne, les duels, l'économie : un chiffre en tuile, et un chiffre jour
 * par jour en barres d'une seule série ; et depuis le QG 2 (lot 5), le
 * gabarit qu'elles posent en tête (`GabaritDUnMode`).
 */

/**
 * Un chiffre en tuile : son nom, sa valeur, ce qui l'explique — et, quand on
 * a de quoi comparer, son écart à la même heure des sept jours d'avant, comme
 * les tuiles de la vue d'ensemble.
 */
export function Chiffre({ nom, valeur, detail, compte }: { nom: string; valeur: string; detail?: ReactNode; compte?: CompteDuJour | null }) {
  const ecart = compte ? ecartALHabitude(compte) : null
  return (
    <li className="qg-tuile">
      <span className="qg-tuile-nom">{nom}</span>
      <span className="qg-tuile-valeur num">{valeur}</span>
      {ecart && (
        <span
          className={'qg-ecart' + (ecart.sens ? ` qg-ecart-${ecart.sens}` : '')}
          title={compte?.habituel != null ? `D’habitude à cette heure : ${formatNumber(compte.habituel)}` : undefined}
        >
          {ecart.sens && <Icon name={ecart.sens === 'plus' ? 'arrow-up' : 'arrow-down'} />}
          {ecart.texte}
          {ecart.suite && <span className="sr-only">{ecart.suite}</span>}
        </span>
      )}
      {detail && <span className="qg-ecart qg-tuile-detail">{detail}</span>}
    </li>
  )
}

/** Une espace insécable : au téléphone, « 100 » finissait une ligne et « % » ouvrait la suivante. */
export const INSECABLE = ' '

/** Une part en pour cent, le signe collé au nombre ; « – » quand rien ne la fonde. */
export const enPourcentsEcrits = (n: number | null) => (n === null ? '–' : `${formatNumber(n)}${INSECABLE}%`)

/**
 * « Masquer » d'un classement — celui du mois du quiz du jour, celui des
 * duels : un seul masque pour les deux, une seule confirmation. Elle parle
 * du profil, jamais de la personne : un prénom ne dit pas qui l'on est. Et
 * elle dit où il se lève : on le cherchait sans le trouver (le 14 octobre 2026).
 */
export function confirmerLeMasque(nom: string): Promise<boolean> {
  return confirmDialog({
    title: `Masquer ${nom} du classement ?`,
    message:
      'Le profil ne paraîtra plus aux classements du quiz du jour et des duels, ni sur les podiums et les lauriers, et on ne pourra plus le défier. Personne ne l’en avertit : sur son téléphone, sa ligne reste. Il se remet au classement d’un geste, depuis sa fiche ou la liste des profils masqués.',
    confirmLabel: 'Masquer',
  })
}

const MARGE = { gauche: 36, droite: 4, haut: 20, bas: 24 }
const MARGE_PETITE = { gauche: 2, droite: 2, haut: 16, bas: 4 }

/**
 * Un chiffre jour par jour, en barres d'une seule série, dans l'écran
 * nocturne des graphiques du QG (`.qg-ecran`) : la couleur de son mode,
 * vérifiée sur ce fond-là (`MODES_DU_QG`). Le jour survolé — touché au
 * téléphone, où il n'y a pas d'infobulle — se dit dessous, aujourd'hui
 * sinon ; chaque barre a la sienne. `petit` : les petits multiples d'une
 * page, sans graduations ni dates.
 */
export function GrapheDesJours({
  jours,
  valeurs,
  classe,
  dire,
  titre,
  petit = false,
}: {
  /** Les jours de Paris, le plus ancien d'abord, aujourd'hui en dernier. */
  jours: readonly string[]
  valeurs: readonly number[]
  /** La couleur de la série : `qg-mode-jour`, `qg-mode-campagne`… */
  classe: string
  /** Un nombre en mots : « 118 joueurs ». */
  dire: (n: number) => string
  /** Ce que le graphique montre, pour le lecteur d'écran. */
  titre: string
  petit?: boolean
}) {
  const [choisi, choisir] = useState<number | null>(null)
  const [boite, largeur] = useLargeur(petit ? 240 : 640)
  const marge = petit ? MARGE_PETITE : MARGE
  const hauteur = petit ? 64 : Math.round(Math.min(220, Math.max(140, largeur * 0.26)))
  const n = jours.length
  const crans = graduations(Math.max(0, ...valeurs))
  const sommet = (petit ? Math.max(1, ...valeurs) : crans[crans.length - 1]) || 1
  const utile = { l: Math.max(1, largeur - marge.gauche - marge.droite), h: hauteur - marge.haut - marge.bas }
  const pas = utile.l / Math.max(1, n)
  const barre = Math.min(24, Math.max(2, pas * 0.66))
  const y = (v: number) => marge.haut + utile.h - (v / sommet) * utile.h
  const xDe = (i: number) => marge.gauche + i * pas
  const lu = choisi ?? n - 1
  // Au téléphone, trois dates sous l'axe ; à l'ordinateur, une par semaine, comptée depuis aujourd'hui.
  const etiquettes = petit ? [] : largeur < 480 ? [0, Math.floor((n - 1) / 2), n - 1] : jours.map((_, i) => i).filter(i => (n - 1 - i) % 7 === 0)
  const ancre = (i: number) => (i >= n - 2 ? 'end' : i <= 1 ? 'start' : 'middle')
  const xTexte = (i: number) => (ancre(i) === 'end' ? xDe(i) + pas : ancre(i) === 'start' ? xDe(i) : xDe(i) + pas / 2)
  if (n === 0) return null
  const resume = `${titre}, du ${jourEnToutesLettres(jours[0], true)} à aujourd’hui : de ${dire(Math.min(...valeurs))} à ${dire(Math.max(...valeurs))} par jour, ${dire(valeurs[n - 1])} aujourd’hui.`
  return (
    <div className="qg-jours">
      <div ref={boite} className="qg-graphe">
        <svg viewBox={`0 0 ${largeur} ${hauteur}`} role="img" aria-label={resume} onPointerLeave={() => choisir(null)}>
          {choisi !== null && <rect className="qg-graphe-choisi" x={xDe(choisi)} y={marge.haut} width={pas} height={utile.h} rx={4} />}
          {!petit && (
            <>
              <g className="qg-graphe-grille">
                {crans.map(c => (
                  <line key={c} x1={marge.gauche} x2={largeur - marge.droite} y1={y(c)} y2={y(c)} />
                ))}
              </g>
              <g className="qg-graphe-axe" textAnchor="end">
                {crans.map(c => (
                  <text key={c} x={marge.gauche - 8} y={y(c) + 4}>
                    {formatNumber(c)}
                  </text>
                ))}
              </g>
              <g className="qg-graphe-axe">
                {etiquettes.map(i => (
                  <text key={i} x={xTexte(i)} y={hauteur - 6} textAnchor={ancre(i)}>
                    {i === n - 1 ? 'aujourd’hui' : jourAbrege(jours[i])}
                  </text>
                ))}
              </g>
            </>
          )}
          {petit && (
            <g className="qg-graphe-grille">
              <line x1={marge.gauche} x2={largeur - marge.droite} y1={y(0)} y2={y(0)} />
            </g>
          )}
          {jours.map((j, i) => {
            const v = valeurs[i] ?? 0
            const h = (v / sommet) * utile.h
            const x = xDe(i) + (pas - barre) / 2
            return (
              <g key={j}>
                <title>{`${jourEnToutesLettres(j)} : ${dire(v)}`}</title>
                {v > 0 && <path className={classe} d={barreArrondie(x, y(0) - h, barre, h)} />}
                {/* La cible du survol et du toucher : toute la hauteur, toute la largeur du jour. */}
                <rect className="qg-graphe-cible" x={xDe(i)} y={marge.haut} width={pas} height={utile.h} onPointerEnter={() => choisir(i)} onClick={() => choisir(i)} />
              </g>
            )
          })}
          <text className="qg-graphe-total" x={xTexte(lu)} y={Math.max(12, y(valeurs[lu] ?? 0) - 6)} textAnchor={ancre(lu)}>
            {formatNumber(valeurs[lu] ?? 0)}
          </text>
        </svg>
      </div>
      <p className="qg-legende-jour">
        {lu === n - 1 ? 'Aujourd’hui' : jourEnToutesLettres(jours[lu])} · {dire(valeurs[lu] ?? 0)}
      </p>
    </div>
  )
}

// ── Le gabarit d'un mode (le QG 2, lot 5) ─────────────────────────────────

/**
 * Ce qu'une partie s'appelle dans le gabarit d'un mode, au pluriel puis à l'unité : en soirée, chaque invité qui a
 * joué est une participation ; au Cabinet, une partie est une épreuve de sa traversée — la page compte, elle, les
 * traversées ; aux duels, chaque côté d'un duel, contre Automate compris, comme « Duels joués » de leur page.
 */
const NOM_DES_PARTIES: Record<ModeDuQg, { pluriel: string; un: string }> = {
  soiree: { pluriel: 'Participations', un: 'participation' },
  campagne: { pluriel: 'Parties', un: 'partie' },
  cabinet: { pluriel: 'Épreuves', un: 'épreuve' },
  jour: { pluriel: 'Parties', un: 'partie' },
  duel: { pluriel: 'Duels', un: 'duel' },
}

/** L'entonnoir qu'une page donne à son gabarit : ses marches, son titre, et ce qu'elles ne disent pas. */
export interface EntonnoirDuGabarit {
  titre: string
  etapes: readonly EtapeDeLEntonnoir[]
  note?: string
}

/**
 * Le gabarit d'un mode (« Deux gabarits pour toutes les pages », la
 * proposition du 3 novembre 2026, `retours/2026-11-03/le-qg.md`) : ce que
 * chaque page de mode pose en tête — les soirées, le quiz du jour, la
 * campagne, les duels, et le Cabinet de curiosités sur la sienne, sans ses
 * tuiles. Sur la période de la barre : les joueurs du mode et ses parties,
 * chacun son écart à la période d'avant et sa courbe, puis les tuiles de la
 * page (`tuiles` : des `TuileDuQg`, des `Chiffre`, `TuileParJoueur`, deux au
 * plus — la rangée en tient quatre ; une tuile que la page pose déjà dans
 * « Aujourd'hui » n'y revient pas : deux tuiles pareilles l'une sous l'autre
 * se lisaient comme une erreur, au rendu du lot 5) ; la participation seau
 * par seau, la période d'avant en filet quand on compare ; « En ce moment »,
 * ce qui s'y joue à la minute — le flux du direct (`fluxDuQg`), et ce que la
 * page y ajoute (`enCeMoment`) ; puis son entonnoir, s'il a de quoi le dire
 * (`entonnoir`). Tout vient de la vue d'ensemble, déjà lue (`vue.periodes`),
 * et du flux : le gabarit ne relit rien. Ce qui est propre à la page se pose
 * dessous, tel quel.
 *
 * Une page de plus le pose de même, en tête et sans attendre ce qu'elle lit
 * elle-même. Une page qui a déjà ses tuiles sur sa propre durée les garde
 * (`sansTuiles`) et ne prend que la courbe et « En ce moment » — le Cabinet, ses
 * trente jours de traversées (`QgCabinet.tsx`) :
 *
 *   <GabaritDUnMode mode="cabinet" vue={vue} periode={periode} comparer={comparer} sansTuiles
 *     enCeMoment={page && <span className="small">3 traversées en route</span>} />
 *
 * Une partie commencée, puis finie, se lit déjà dans la vue
 * (`entonnoirDuSolo(totaux, mode)`, `shared/qgModes.ts`) ; un entonnoir à
 * plus de marches vient de la page (`entonnoir`, ses `etapes`).
 */
export function GabaritDUnMode({
  mode,
  vue,
  periode,
  comparer = false,
  tuiles,
  sansTuiles = false,
  entonnoir,
  enCeMoment,
}: {
  mode: ModeDuQg
  vue: VueDEnsemble | null
  periode: PeriodeDuQg
  comparer?: boolean
  tuiles?: ReactNode
  /** La page garde les siennes : ni les joueurs ni les parties de la période en tuiles. */
  sansTuiles?: boolean
  entonnoir?: EntonnoirDuGabarit | null
  enCeMoment?: ReactNode
}) {
  const a = vue?.periodes?.[periode]
  const t = a?.totaux
  const avant = a?.avant?.totaux
  const id = `gabarit-${mode}`
  return (
    <>
      {!sansTuiles && (
        <section className="qg-chiffres" aria-labelledby={`${id}-chiffres`}>
          <div className="qg-section-tete">
            <h2 className="compte-groupe" id={`${id}-chiffres`}>
              Sur {PERIODE_EN_TOUTES_LETTRES[periode]}
            </h2>
            <span className="muted small">{a?.avant ? 'comparé à la période d’avant, arrêtée au même instant' : periode === '30j' ? 'le mois d’avant n’est pas gardé' : ''}</span>
          </div>
          <ul className="qg-tuiles qg-tuiles-quatre">
            <TuileDuQg
              nom="Joueurs"
              mode={mode}
              valeur={t?.modes[mode]}
              ecart={t && ecartALaPeriodeDAvant(t.modes[mode], avant?.modes[mode])}
              etincelle={a?.seaux.map(s => s.modes[mode])}
              detail={mode === 'soiree' ? 'un invité sans profil, une fois par soirée' : undefined}
            />
            <TuileDuQg
              nom={NOM_DES_PARTIES[mode].pluriel}
              mode={mode}
              valeur={t?.parties[mode]}
              ecart={t && ecartALaPeriodeDAvant(t.parties[mode], avant?.parties[mode])}
              etincelle={a?.seaux.map(s => s.parties[mode])}
              detail={mode === 'soiree' ? 'chaque invité de chaque soirée' : undefined}
            />
            {tuiles}
          </ul>
        </section>
      )}
      <div className="qg-gabarit">
        <CourbeDuMode mode={mode} vue={vue} periode={periode} comparer={comparer} />
        <EnCeMomentDuMode mode={mode}>{enCeMoment}</EnCeMomentDuMode>
      </div>
      {entonnoir && <EntonnoirDuMode mode={mode} periode={periode} {...entonnoir} />}
    </>
  )
}

/**
 * Une tuile qu'une page pose parmi les siennes (`tuiles`) : ce qu'un joueur du
 * mode y a joué, en moyenne, sur la période (`partiesParJoueur`), tiré de la
 * vue comme les deux premières. La période d'avant dit son chiffre, jamais un
 * pourcentage : de 1,2 à 1,1, ce n'est pas « 8 % de moins ».
 */
export function TuileParJoueur({ mode, vue, periode, detail }: { mode: ModeDuQg; vue: VueDEnsemble | null; periode: PeriodeDuQg; detail?: ReactNode }) {
  const a = vue?.periodes?.[periode]
  const n = a ? partiesParJoueur(a.totaux, mode) : null
  const avant = a?.avant ? partiesParJoueur(a.avant.totaux, mode) : null
  const ecart: EcartALHabitude | null =
    n === null || avant === null ? null : { sens: null, texte: n === avant ? 'comme avant' : `${formatNumber(avant)} avant`, suite: '' }
  return <TuileDuQg nom={`${NOM_DES_PARTIES[mode].pluriel} par joueur`} valeur={n} ecart={ecart} detail={n === null ? undefined : detail} />
}

/**
 * La participation d'un mode seau par seau, à sa couleur : ses joueurs —
 * chacun une fois par seau —, ou ses parties, d'un toucher. La période d'avant
 * en filet quand la barre compare. Le pas suit la période, comme au poste de
 * commande (`nomDuSeau`, `etiquetteDeLAxe`).
 */
function CourbeDuMode({ mode, vue, periode, comparer }: { mode: ModeDuQg; vue: VueDEnsemble | null; periode: PeriodeDuQg; comparer: boolean }) {
  const [quoi, setQuoi] = useState<'joueurs' | 'parties'>('joueurs')
  const a = vue?.periodes?.[periode]
  const seaux = a?.seaux ?? []
  const pas = a?.pas ?? 3_600_000
  const fin = vue?.maintenant ?? 0
  const debuts = seaux.map(s => s.debut)
  const lire = (s: (typeof seaux)[number]) => (quoi === 'joueurs' ? s.modes[mode] : s.parties[mode])
  const valeurs = seaux.map(lire)
  const avant = comparer && a?.avant ? a.avant.seaux.map(lire) : null
  const nom = quoi === 'joueurs' ? 'joueur' : NOM_DES_PARTIES[mode].un
  const id = `gabarit-courbe-${mode}`
  return (
    <section className="qg-console" aria-labelledby={id}>
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">{NOM_DU_MODE[mode]}</span>
          <h2 id={id}>Seau par seau, sur {PERIODE_EN_TOUTES_LETTRES[periode]}</h2>
          <span className="muted small">
            {quoi === 'joueurs'
              ? 'chaque personne compte une fois par seau'
              : mode === 'soiree'
                ? 'chaque invité qui a joué, au seau où sa soirée a commencé'
                : `chaque ${NOM_DES_PARTIES[mode].un}, qui que ce soit, au seau où ${mode === 'duel' ? 'il a' : 'elle a'} commencé`}
          </span>
        </div>
        <div className="onglets onglets-puces" role="group" aria-label="Ce que le graphique compte">
          {(['joueurs', 'parties'] as const).map(q => (
            <button key={q} type="button" className={'onglet' + (quoi === q ? ' actif' : '')} aria-pressed={quoi === q} onClick={() => setQuoi(q)}>
              {q === 'joueurs' ? 'Joueurs' : NOM_DES_PARTIES[mode].pluriel}
            </button>
          ))}
        </div>
      </div>
      {!a ? (
        <p className="serif-note">Chargement…</p>
      ) : valeurs.every(v => v === 0) ? (
        <p className="muted small">Personne n’y a joué sur {PERIODE_EN_TOUTES_LETTRES[periode]}.</p>
      ) : (
        <>
          <GrapheDuTemps
            etiquettes={seaux.map(s => nomDuSeau(s.debut, pas, fin))}
            axe={(i, largeur) => etiquetteDeLAxe(debuts, pas, i, largeur)}
            series={[{ cle: mode, nom: NOM_DU_MODE[mode], valeurs, classe: `qg-mode-${mode}` }]}
            empile={false}
            avant={avant}
            nomDuTotal={nom}
            resume={`${NOM_DU_MODE[mode]}, ${quoi === 'joueurs' ? 'ses joueurs' : `ses ${NOM_DES_PARTIES[mode].pluriel.toLowerCase()}`} sur ${PERIODE_EN_TOUTES_LETTRES[periode]} : de ${formatNumber(Math.min(...valeurs))} à ${formatNumber(Math.max(...valeurs))} par seau, ${formatNumber(valeurs.at(-1) ?? 0)} dans le dernier.`}
          />
          {avant && (
            <div className="qg-legende">
              <ul>
                <li>
                  <i className="qg-pastille-avant" aria-hidden="true" />
                  La période d’avant
                </li>
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/**
 * Ce qui se joue dans un mode à la minute, du flux du direct (`qgFlux.ts`) :
 * les profils passés sur ses pages ces cinq minutes — en soirée, les téléphones
 * connectés —, et ses quinze dernières minutes au pas de dix secondes. Des
 * nombres : le serveur ne dit pas qui. Ce que la page y ajoute vient dessous.
 */
export function EnCeMomentDuMode({ mode, children }: { mode: ModeDuQg; children?: ReactNode }) {
  // Le troisième argument rend la page au serveur aussi — les tests la rendent ainsi : le flux n'y a encore rien dit.
  const etat = useSyncExternalStore(fluxDuQg.abonner, fluxDuQg.lire, fluxDuQg.lire)
  const vivant = useSyncExternalStore(fluxDuQg.abonner, fluxDuQg.estVivant, () => false)
  const points = etat.enCours ? [...etat.points, etat.enCours].slice(-POINTS_DU_DIRECT) : []
  const n = etat.enCours?.modes[mode]
  const id = `gabarit-direct-${mode}`
  return (
    <section className="qg-console qg-hud" style={{ '--teinte': `var(--mode-${mode})` } as CSSProperties} aria-labelledby={id}>
      <div className="qg-console-tete">
        <span className="qg-etiquette" id={id}>
          <span className="admin-pouls" aria-hidden="true" />
          En ce moment
        </span>
        <span className="muted small">{vivant ? 'relu toutes les deux secondes' : 'le direct se branche…'}</span>
      </div>
      <span className="qg-tuile-valeur num">{n === undefined ? '–' : formatNumber(n)}</span>
      {/* Zéro s'écrit au singulier, comme partout dans le dépôt ; sous « – », le flux encore muet, le nom se lit en étiquette. */}
      <span className="qg-ecart">
        {mode === 'soiree'
          ? `${n === undefined || n > 1 ? 'téléphones connectés' : 'téléphone connecté'} à une soirée`
          : `${n === undefined || n > 1 ? 'profils passés' : 'profil passé'} sur ses pages ces cinq minutes`}
      </span>
      {points.length > 1 && <Etincelle valeurs={points.map(p => p.modes[mode])} />}
      <span className="muted small">les quinze dernières minutes, dix secondes par dix secondes</span>
      {children}
    </section>
  )
}

/**
 * L'entonnoir d'un mode : où l'on décroche, marche par marche — ce qui y
 * arrive en barre couchée à la couleur du mode, sa part du départ, et ce qui
 * s'est perdu depuis la marche d'avant (`marchesDeLEntonnoir`).
 */
export function EntonnoirDuMode({ mode, periode, titre, etapes, note }: { mode: ModeDuQg; periode: PeriodeDuQg } & EntonnoirDuGabarit) {
  const marches = marchesDeLEntonnoir(etapes)
  const depart = etapes[0]?.n ?? 0
  const id = `gabarit-entonnoir-${mode}`
  return (
    <section className="qg-console" aria-labelledby={id}>
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Entonnoir</span>
          <h2 id={id}>{titre}</h2>
          {note && <span className="muted small">{note}</span>}
        </div>
      </div>
      {depart === 0 ? (
        <p className="muted small">Rien encore sur {PERIODE_EN_TOUTES_LETTRES[periode]}.</p>
      ) : (
        <ol className="qg-pistes qg-entonnoir">
          {marches.map((m, i) => (
            <li key={m.nom} className="qg-piste-ligne">
              <span className="qg-piste-nom">{m.nom}</span>
              <span className="qg-piste" aria-hidden="true">
                {m.n > 0 && <i className={`qg-mode-${mode}`} style={{ width: `${Math.max(1, (m.n / depart) * 100)}%` }} />}
              </span>
              <b className="num">{formatNumber(m.n)}</b>
              {i > 0 && (
                <span className="qg-entonnoir-perte">
                  {m.perte === null ? '' : m.perte > 0 ? `−${enPourcentsEcrits(m.perte)} à cette marche · ` : 'rien de perdu à cette marche · '}
                  {m.duDepart === null ? '' : `${enPourcentsEcrits(m.duDepart)} du départ`}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
