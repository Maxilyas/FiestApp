import { useEffect, useState, type ReactNode } from 'react'
import { api, motifDe } from '../api'
import { Icon, type IconName } from './Icon'
import { barreArrondie, useLargeur } from './QgVueDEnsemble'
import { formatNumber } from '../../../shared/typographie'
import { jourAvant, jourDe } from '../../../shared/jour'
import { JOURS_DE_LA_SEMAINE, dureeEcrite, graduations, heureEcrite, jourAbrege, jourDeLaSemaine, quandEcrit } from '../../../shared/qg'
import {
  MEMOIRE_DE_L_HEBERGEUR_MO,
  PROCESSEUR_DE_L_HEBERGEUR_PCT,
  tempsDeReponse,
  type EvenementDuServeur,
  type HeureDuServeur,
  type PageDuServeur,
} from '../../../shared/santeDuServeur'

/** Une semaine de réveils en compte une quinzaine : les douze derniers d'emblée, le reste sur demande. */
const EVENEMENTS_MONTRES = 12

/** « mar. 13 oct. » */
const dateCourte = (instant: number) => `${JOURS_DE_LA_SEMAINE[jourDeLaSemaine(instant)].court} ${jourAbrege(jourDe(instant))}`

/** « aujourd’hui, 21 h », « hier, 23 h », « mar. 13 oct., 14 h » : une heure du relevé — il ne sait pas la minute. */
function heureDuReleve(heure: number, maintenant: number): string {
  const ronde = heureEcrite(heure).replace(/ 00$/, '')
  const jour = jourDe(heure)
  const aujourdhui = jourDe(maintenant)
  return `${jour === aujourdhui ? 'aujourd’hui' : jour === jourAvant(aujourdhui) ? 'hier' : dateCourte(heure)}, ${ronde}`
}

/** « aujourd’hui à 7 h 02 », « hier à 23 h 10 », « ven. 9 oct. à 14 h 12 » : l'heure d'un réveil compte, même une semaine après. */
function quandDuServeur(instant: number, maintenant: number): string {
  const jour = jourDe(instant)
  const aujourdhui = jourDe(maintenant)
  if (jour === aujourdhui || jour === jourAvant(aujourdhui)) return quandEcrit(instant, maintenant)
  return `${dateCourte(instant)} à ${heureEcrite(instant)}`
}

const erreurs = (n: number) => `${formatNumber(n)} erreur${n > 1 ? 's' : ''}`

/**
 * La santé du serveur au QG (`/admin#serveur`, les choix du 13 octobre 2026) :
 * sept jours heure par heure, gardés dans la base permanente — ce que les
 * joueurs attendent, la charge à côté des invités connectés, les erreurs,
 * les réveils et les arrêts. La page se lit à son ouverture ; le serveur ne
 * relit la base qu'une fois la minute.
 */
export function QgServeur() {
  const [page, setPage] = useState<PageDuServeur | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api.admin.serveur().then(setPage, e => setError(motifDe(e)))
  }, [])

  if (error) return <p className="error">{error}</p>
  if (!page) return <p className="serif-note">Chargement…</p>
  return <SanteDuServeurAuQg page={page} />
}

/** La page lue : quatre chiffres, les temps de réponse, la charge, les erreurs, les réveils et les arrêts, le tableau. */
export function SanteDuServeurAuQg({ page }: { page: PageDuServeur }) {
  const { chiffres: c, enMarche, maintenant } = page
  return (
    <>
      <p className="muted small">
        {enMarche.env === 'production' || enMarche.env === null ? 'Production' : enMarche.env}
        {enMarche.version && ` · version ${enMarche.version}`} · en marche depuis {dureeEcrite(maintenant - enMarche.depuis)}. Sept jours heure par heure ;
        la nuit, l’hébergeur endort le serveur : ses heures sont hachurées.
      </p>

      <section className="qg-jour" aria-labelledby="serveur-semaine">
        <div className="qg-section-tete">
          <h2 className="compte-groupe" id="serveur-semaine">
            Cette semaine
          </h2>
        </div>
        <ul className="qg-tuiles qg-tuiles-quatre">
          <Tuile
            nom="Démarrages"
            valeur={formatNumber(c.demarrages.n)}
            detail={c.demarrages.plusLongMs === null ? 'réveils et mises en ligne' : `le plus long : prêt en ${tempsDeReponse(c.demarrages.plusLongMs)}`}
            alerte={c.arretsNets > 0 ? `${formatNumber(c.arretsNets)} arrêt${c.arretsNets > 1 ? 's' : ''} net${c.arretsNets > 1 ? 's' : ''}` : null}
          />
          <Tuile
            nom="Erreurs serveur"
            valeur={formatNumber(c.erreurs.n)}
            detail={c.erreurs.derniere === null ? 'aucune cette semaine' : `la dernière : ${heureDuReleve(c.erreurs.derniere, maintenant)}`}
          />
          <Tuile
            nom="Turso, 95ᵉ centile"
            valeur={c.base.derniere === null ? '–' : tempsDeReponse(c.base.derniere)}
            detail={c.base.habituelle === null ? 'la dernière heure mesurée' : `${tempsDeReponse(c.base.habituelle)} d’habitude`}
          />
          <Tuile
            nom="Routes, 95ᵉ centile"
            valeur={c.routes.derniere === null ? '–' : tempsDeReponse(c.routes.derniere)}
            detail={
              c.routes.plusLente
                ? `la plus lente : ${c.routes.plusLente.route}`
                : c.routes.habituelle === null
                  ? 'la dernière heure mesurée'
                  : `${tempsDeReponse(c.routes.habituelle)} d’habitude`
            }
          />
        </ul>
      </section>

      <Heures
        id="serveur-routes"
        titre="Ce qu’un joueur attend"
        sousTitre="le 95ᵉ centile des routes d’API, heure par heure"
        heures={page.heures}
        valeur={h => h.routes}
        ecrire={tempsDeReponse}
        classe="qg-serveur-temps"
        maintenant={maintenant}
      />
      <Heures
        id="serveur-turso"
        titre="Turso"
        sousTitre="le 95ᵉ centile d’un aller-retour vers la base, heure par heure"
        heures={page.heures}
        valeur={h => h.base}
        ecrire={tempsDeReponse}
        classe="qg-serveur-temps"
        maintenant={maintenant}
      />
      <LaCharge heures={page.heures} maintenant={maintenant} />
      <Heures
        id="serveur-erreurs"
        titre="Les erreurs serveur"
        sousTitre="les routes et les sockets en erreur, et les exceptions échappées, heure par heure"
        heures={page.heures}
        valeur={h => (h.eveille ? h.erreurs : null)}
        ecrire={erreurs}
        classe="qg-serveur-erreur"
        maintenant={maintenant}
      >
        {c.erreurs.sources.length > 0 && (
          <ul className="qg-liste qg-sources">
            {c.erreurs.sources.map(s => (
              <li key={s.source}>
                <span className="qg-source">{s.source}</span>
                <span className="num">{erreurs(s.n)}</span>
              </li>
            ))}
          </ul>
        )}
      </Heures>

      <Evenements evenements={page.evenements} maintenant={maintenant} />
      <TableauDesHeures heures={page.heures} maintenant={maintenant} />
    </>
  )
}

function Tuile({ nom, valeur, detail, alerte }: { nom: string; valeur: string; detail: ReactNode; alerte?: string | null }) {
  return (
    <li className="qg-tuile">
      <span className="qg-tuile-nom">{nom}</span>
      <span className="qg-tuile-valeur num">{valeur}</span>
      <span className="qg-ecart qg-tuile-detail">{detail}</span>
      {alerte && (
        <span className="qg-ecart qg-ecart-moins">
          <Icon name="alert" />
          {alerte}
        </span>
      )}
    </li>
  )
}

/** Sans survol, la dernière heure mesurée : celle-ci, à peine commencée, n'a souvent rien encore. */
function derniereMesuree(valeurs: readonly (number | null)[]): number {
  let i = valeurs.length - 1
  while (i > 0 && valeurs[i] === null) i--
  return i
}

/**
 * Une carte, un graphique : sept jours heure par heure, et l'heure survolée
 * — touchée, au téléphone — sous lui : à cent soixante-huit barres, aucune
 * ne porte son chiffre.
 */
function Heures({
  id,
  titre,
  sousTitre,
  heures,
  valeur,
  ecrire,
  classe,
  maintenant,
  children,
}: {
  id: string
  titre: string
  sousTitre: string
  heures: HeureDuServeur[]
  valeur: (h: HeureDuServeur) => number | null
  ecrire: (v: number) => string
  classe: string
  maintenant: number
  children?: ReactNode
}) {
  const [choisie, setChoisie] = useState<number | null>(null)
  const h = heures[choisie ?? derniereMesuree(heures.map(valeur))]
  const v = valeur(h)
  return (
    <section className="qg-carte qg-ecran" aria-labelledby={id}>
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id={id}>{titre}</h2>
        <span className="muted small">{sousTitre}</span>
      </div>
      <GrapheDesHeures id={id} nom={titre} heures={heures} valeur={valeur} ecrire={ecrire} classe={classe} maintenant={maintenant} choisie={choisie} choisir={setChoisie} />
      <p className="qg-legende-jour" aria-live="polite">
        {heureDuReleve(h.heure, maintenant)} : {!h.eveille ? 'endormi' : v === null ? 'rien de mesuré' : ecrire(v)}
      </p>
      {children}
    </section>
  )
}

const pourcentsDUnCoeur = (v: number) => `${formatNumber(v)} %`
const megaOctets = (v: number) => `${formatNumber(v)} Mo`
const invites = (v: number) => `${formatNumber(v)} invité${v > 1 ? 's' : ''}`

/** Les quatre graphiques de la charge, l'un sous l'autre, le même temps pour tous. */
const MESURES_DE_CHARGE: {
  cle: string
  nom: string
  detail: string
  valeur: (h: HeureDuServeur) => number | null
  ecrire: (v: number) => string
  ecrireAxe?: (v: number) => string
  plafond?: number
}[] = [
  { cle: 'processeur', nom: 'Processeur', detail: 'la moyenne de l’heure, en part d’un cœur', valeur: h => h.processeur, ecrire: pourcentsDUnCoeur, plafond: PROCESSEUR_DE_L_HEBERGEUR_PCT },
  { cle: 'boucle', nom: 'Boucle', detail: 'le pire gel de l’heure — toute la salle l’attend', valeur: h => h.boucle, ecrire: tempsDeReponse },
  { cle: 'memoire', nom: 'Mémoire', detail: 'le pic de l’heure', valeur: h => h.memoire, ecrire: megaOctets, plafond: MEMOIRE_DE_L_HEBERGEUR_MO },
  { cle: 'invites', nom: 'Invités connectés', detail: 'le pic de l’heure, toutes soirées confondues', valeur: h => h.invites, ecrire: invites, ecrireAxe: formatNumber },
]

/**
 * La charge, heure par heure (le conseil suivi le 13 octobre 2026) : les
 * temps de réponse disent qu'une soirée a été lente, la charge dit pourquoi
 * — le processeur au plafond de l'hébergeur, un gel de la boucle, la mémoire
 * —, à côté de la salle qui la fait. Les traits pointillés : les plafonds de
 * l'hébergeur gratuit, un dixième de cœur et 512 Mo.
 */
function LaCharge({ heures, maintenant }: { heures: HeureDuServeur[]; maintenant: number }) {
  const [choisie, setChoisie] = useState<number | null>(null)
  const h = heures[choisie ?? derniereMesuree(heures.map(x => x.processeur))]
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="serveur-charge">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="serveur-charge">La charge, heure par heure</h2>
        <span className="muted small">relevée toutes les dix secondes ; en pointillé, les plafonds de l’hébergeur gratuit</span>
      </div>
      {MESURES_DE_CHARGE.map((m, i) => (
        <div key={m.cle} className="qg-charge">
          <span className="qg-charge-nom">
            <b>{m.nom}</b> · {m.detail}
          </span>
          <GrapheDesHeures
            id={`serveur-${m.cle}`}
            nom={m.nom}
            heures={heures}
            valeur={m.valeur}
            ecrire={m.ecrire}
            ecrireAxe={m.ecrireAxe}
            classe="qg-serveur-temps"
            maintenant={maintenant}
            choisie={choisie}
            choisir={setChoisie}
            plafond={m.plafond}
            compact
            sansJours={i < MESURES_DE_CHARGE.length - 1}
          />
        </div>
      ))}
      <p className="qg-legende-jour" aria-live="polite">
        {heureDuReleve(h.heure, maintenant)} :{' '}
        {!h.eveille
          ? 'endormi'
          : h.processeur === null
            ? 'rien de mesuré'
            : MESURES_DE_CHARGE.map(m => {
                const v = m.valeur(h)
                return m.cle === 'invites' ? invites(v ?? 0) : `${m.nom.toLowerCase()} ${v === null ? '–' : m.ecrire(v)}`
              }).join(' · ')}
      </p>
    </section>
  )
}

const MARGE = { gauche: 52, droite: 4, haut: 14, bas: 22 }

/**
 * Sept jours heure par heure, en barres d'une seule série dans l'écran
 * nocturne : cent soixante-huit heures, la nuit endormie hachurée. Le
 * survol se partage : dans la pile de la charge, une heure choisie l'est
 * dans les quatre graphiques.
 */
function GrapheDesHeures({
  id,
  nom,
  heures,
  valeur,
  ecrire,
  ecrireAxe = ecrire,
  classe,
  maintenant,
  choisie,
  choisir,
  plafond,
  compact = false,
  sansJours = false,
}: {
  id: string
  nom: string
  heures: HeureDuServeur[]
  valeur: (h: HeureDuServeur) => number | null
  ecrire: (v: number) => string
  ecrireAxe?: (v: number) => string
  classe: string
  maintenant: number
  choisie: number | null
  choisir: (i: number | null) => void
  /** Un trait pointillé : le plafond de l'hébergeur. L'échelle le contient toujours. */
  plafond?: number
  compact?: boolean
  /** Sans les jours sous l'axe : un graphique de la pile, sous lequel un autre les porte. */
  sansJours?: boolean
}) {
  const [boite, largeur] = useLargeur(640)
  const hauteur = compact ? Math.round(Math.min(110, Math.max(80, largeur * 0.12))) : Math.round(Math.min(190, Math.max(130, largeur * 0.22)))
  const marge = { ...MARGE, bas: sansJours ? 6 : MARGE.bas }
  const valeurs = heures.map(valeur)
  const crans = graduations(Math.max(0, plafond ?? 0, ...valeurs.map(v => v ?? 0)))
  const sommet = crans[crans.length - 1] || 1
  const utile = { l: Math.max(1, largeur - marge.gauche - marge.droite), h: hauteur - marge.haut - marge.bas }
  const n = heures.length
  const pas = utile.l / n
  const barre = Math.max(1, pas * 0.7)
  const y = (v: number) => marge.haut + utile.h - (v / sommet) * utile.h
  const xDe = (i: number) => marge.gauche + i * pas

  // Les jours, et les plages endormies : des indices consécutifs.
  const jours: { debut: number; fin: number }[] = []
  const endormies: { debut: number; fin: number }[] = []
  heures.forEach((h, i) => {
    const dernier = jours.at(-1)
    if (dernier && jourDe(heures[dernier.debut].heure) === jourDe(h.heure)) dernier.fin = i
    else jours.push({ debut: i, fin: i })
    if (h.eveille) return
    const plage = endormies.at(-1)
    if (plage && plage.fin === i - 1) plage.fin = i
    else endormies.push({ debut: i, fin: i })
  })

  const mesurees = valeurs.filter((x): x is number => x !== null)
  const resume = mesurees.length
    ? `${nom}, sept jours : de ${ecrire(Math.min(...mesurees))} à ${ecrire(Math.max(...mesurees))} selon l’heure.`
    : `${nom}, sept jours : rien de mesuré.`

  return (
    <div ref={boite} className="qg-graphe">
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} role="img" aria-label={resume} onPointerLeave={() => choisir(null)}>
        <defs>
          <pattern id={`${id}-endormi`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" className="qg-endormi-trait" />
          </pattern>
        </defs>
        {endormies.map(p => (
          <rect key={p.debut} x={xDe(p.debut)} y={marge.haut} width={(p.fin - p.debut + 1) * pas} height={utile.h} fill={`url(#${id}-endormi)`} />
        ))}
        {choisie !== null && <rect className="qg-graphe-choisi" x={xDe(choisie)} y={marge.haut} width={Math.max(pas, 2)} height={utile.h} />}
        <g className="qg-graphe-grille">
          {crans.map(cran => (
            <line key={cran} x1={marge.gauche} x2={largeur - marge.droite} y1={y(cran)} y2={y(cran)} />
          ))}
          {jours.slice(1).map(j => (
            <line key={j.debut} className="qg-graphe-jour" x1={xDe(j.debut)} x2={xDe(j.debut)} y1={marge.haut} y2={marge.haut + utile.h} />
          ))}
        </g>
        <g className="qg-graphe-axe" textAnchor="end">
          {crans.map(cran => (
            <text key={cran} x={marge.gauche - 8} y={y(cran) + 4}>
              {cran === 0 ? '0' : ecrireAxe(cran)}
            </text>
          ))}
        </g>
        {!sansJours && (
          <g className="qg-graphe-axe" textAnchor="middle">
            {jours.map(j => {
              const large = (j.fin - j.debut + 1) * pas
              if (large < 26) return null
              const debut = heures[j.debut].heure
              return (
                <text key={j.debut} x={xDe(j.debut) + large / 2} y={hauteur - 6}>
                  {jourDe(debut) === jourDe(maintenant) ? 'auj.' : JOURS_DE_LA_SEMAINE[jourDeLaSemaine(debut)].court}
                </text>
              )
            })}
          </g>
        )}
        {valeurs.map((val, i) =>
          val !== null && val > 0 ? <path key={i} className={classe} d={barreArrondie(xDe(i) + (pas - barre) / 2, y(val), barre, (val / sommet) * utile.h)} /> : null,
        )}
        {plafond !== undefined && (
          <g>
            <line className="qg-graphe-plafond" x1={marge.gauche} x2={largeur - marge.droite} y1={y(plafond)} y2={y(plafond)} />
            <text className="qg-graphe-plafond-nom" x={largeur - marge.droite} y={y(plafond) - 4} textAnchor="end">
              plafond
            </text>
          </g>
        )}
        {heures.map((heure, i) => (
          <rect
            key={heure.heure}
            className="qg-graphe-cible"
            x={xDe(i)}
            y={marge.haut}
            width={pas}
            height={utile.h}
            onPointerEnter={() => choisir(i)}
            onClick={() => choisir(i)}
          />
        ))}
      </svg>
    </div>
  )
}

const SORTES: Record<EvenementDuServeur['sorte'], { icone: IconName; nom: string; alerte?: boolean }> = {
  reveil: { icone: 'sun', nom: 'Réveil' },
  'mise-en-ligne': { icone: 'arrow-up', nom: 'Mise en ligne' },
  relance: { icone: 'rotate', nom: 'Relancé' },
  'apres-arret': { icone: 'rotate', nom: 'Redémarrage après un arrêt net' },
  'arret-net': { icone: 'alert', nom: 'Arrêt net', alerte: true },
}

/** Les réveils, les mises en ligne et les arrêts nets, le plus récent d'abord. */
function Evenements({ evenements, maintenant }: { evenements: EvenementDuServeur[]; maintenant: number }) {
  const [tous, setTous] = useState(false)
  const montres = tous ? evenements : evenements.slice(0, EVENEMENTS_MONTRES)
  return (
    <section className="qg-carte" aria-labelledby="serveur-evenements">
      <div className="qg-carte-tete">
        <h2 id="serveur-evenements">Réveils et arrêts</h2>
        {evenements.length > 0 && <span className="etiquette num">{evenements.length}</span>}
      </div>
      {evenements.length === 0 ? (
        <p className="muted small">Aucun démarrage cette semaine.</p>
      ) : (
        <ul className="qg-liste">
          {montres.map(e => {
            const sorte = SORTES[e.sorte]
            const quand = quandDuServeur(e.quand, maintenant)
            return (
              <li key={`${e.sorte}-${e.quand}`} className="qg-geste">
                <span className={'qg-rond' + (sorte.alerte ? ' qg-rond-alerte' : '')} aria-hidden="true">
                  <Icon name={sorte.icone} />
                </span>
                <span className="qg-ligne-texte">
                  <b>{sorte.nom}</b>
                  <span className="muted small">
                    {e.sorte === 'arret-net'
                      ? `dernier signe ${quand} : il ne s’est pas éteint proprement`
                      : [quand, e.pretEnMs !== null && `prêt en ${tempsDeReponse(e.pretEnMs)}`, e.sorte === 'mise-en-ligne' && e.version && `version ${e.version}`]
                          .filter(Boolean)
                          .join(' · ')}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {!tous && evenements.length > EVENEMENTS_MONTRES && (
        <button type="button" className="lien-discret qg-suite" onClick={() => setTous(true)}>
          Et {evenements.length - EVENEMENTS_MONTRES} de plus cette semaine
          <Icon name="chevron-down" />
        </button>
      )}
    </section>
  )
}

/** Les chiffres, heure par heure : le tableau des graphiques, rendu à l'ouverture seulement — cent soixante-huit lignes. */
function TableauDesHeures({ heures, maintenant }: { heures: HeureDuServeur[]; maintenant: number }) {
  const [ouvert, setOuvert] = useState(false)
  const eveillees = heures.filter(h => h.eveille).reverse()
  return (
    <section className="qg-carte" aria-labelledby="serveur-tableau">
      <div className="qg-carte-tete">
        <h2 id="serveur-tableau">Heure par heure</h2>
      </div>
      <details className="qg-tableau" onToggle={e => setOuvert((e.target as HTMLDetailsElement).open)}>
        <summary>Les chiffres des {formatNumber(eveillees.length)} heures éveillées</summary>
        {ouvert && (
          <table>
            <thead>
              <tr>
                <th scope="col">Heure</th>
                <th scope="col">Routes</th>
                <th scope="col">Turso</th>
                <th scope="col">Erreurs</th>
                {/* La charge, à l'ordinateur seulement : au téléphone, l'heure n'avait plus de place. */}
                <th scope="col" className="qg-colonne-large">
                  Processeur
                </th>
                <th scope="col" className="qg-colonne-large">
                  Mémoire
                </th>
                <th scope="col" className="qg-colonne-large">
                  Invités
                </th>
              </tr>
            </thead>
            <tbody>
              {eveillees.map(h => (
                <tr key={h.heure}>
                  <th scope="row">{heureDuReleve(h.heure, maintenant)}</th>
                  <td className="num">{h.routes === null ? '–' : tempsDeReponse(h.routes)}</td>
                  <td className="num">{h.base === null ? '–' : tempsDeReponse(h.base)}</td>
                  <td className="num">{formatNumber(h.erreurs)}</td>
                  <td className="num qg-colonne-large">{h.processeur === null ? '–' : pourcentsDUnCoeur(h.processeur)}</td>
                  <td className="num qg-colonne-large">{h.memoire === null ? '–' : megaOctets(h.memoire)}</td>
                  <td className="num qg-colonne-large">{h.invites === null ? '–' : formatNumber(h.invites)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>
    </section>
  )
}
