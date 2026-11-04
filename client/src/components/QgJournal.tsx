import { useEffect, useRef, useState, type RefObject } from 'react'
import { api, motifDe } from '../api'
import { espacesFines } from '../format'
import { Icon, type IconName } from './Icon'
import { Onglets } from './Onglets'
import { FormeDuRepere } from './QgGraphes'
import { dureeEcrite, heureEcrite, NOM_DE_LA_SORTE, type GesteDuQg, type SorteDeGeste } from '../../../shared/qg'
import { jourAvant, jourDe, jourEnToutesLettres } from '../../../shared/jour'
import { NOM_DE_LA_GRAVITE, REGLE, type IncidentDuQg } from '../../../shared/qgAlertes'
import {
  avantApres,
  ecartDeLAvantApres,
  filParJour,
  JOURS_DE_L_AVANT_APRES,
  JOURS_DES_REPERES_DU_JOURNAL,
  moyenneEcrite,
  type JoursDeLAvantApres,
  type RepereDuQg,
  type ReperesDuQg,
  type SorteDeRepere,
} from '../../../shared/qgEffets'

/**
 * Les filtres du journal : tout, les repères — ce qui se compare avant / après —, le serveur, ou une sorte de gestes.
 * « Autre » ne se filtre pas : il n'existe que si une route a oublié sa phrase.
 */
type Filtre = 'tous' | 'reperes' | 'serveur' | Exclude<SorteDeGeste, 'autre'>
const FILTRES: readonly Filtre[] = ['tous', 'reperes', 'serveur', 'soiree', 'profil', 'salon', 'catalogue', 'jour', 'campagne', 'duel', 'maintenance', 'annonce', 'erreur']
const nomDuFiltre = (f: Filtre) => (f === 'tous' ? 'Tous' : f === 'reperes' ? 'Repères' : f === 'serveur' ? 'Serveur' : NOM_DE_LA_SORTE[f])

const ICONE: Record<SorteDeGeste, IconName> = {
  soiree: 'glass',
  profil: 'users',
  salon: 'home',
  catalogue: 'globe',
  jour: 'sun',
  campagne: 'target',
  duel: 'swords',
  maintenance: 'alert',
  annonce: 'megaphone',
  erreur: 'x-circle',
  autre: 'clipboard',
}

/** D'où vient un repère, sous sa phrase, comme la sorte d'un geste. */
const DE_QUOI: Record<SorteDeRepere, string> = {
  'mise-en-ligne': 'Serveur',
  'arret-net': 'Serveur',
  maintenance: 'Maintenance',
  ouverture: 'Maintenance',
  affiche: 'Nouveautés',
  annonce: 'Annonces',
  reglage: 'Réglages',
}

/**
 * Une ligne du fil : un geste — et le repère qu'il pose, s'il en pose un —, un repère seul (une mise en ligne, un arrêt
 * net ; au filtre des repères, chacun), un incident des alertes.
 */
type LigneDuFil =
  | { genre: 'geste'; cle: string; quand: number; geste: GesteDuQg; repere: RepereDuQg | null }
  | { genre: 'repere'; cle: string; quand: number; repere: RepereDuQg }
  | { genre: 'incident'; cle: string; quand: number; incident: IncidentDuQg }

const duServeur = (r: RepereDuQg) => r.sorte === 'mise-en-ligne' || r.sorte === 'arret-net'
const enCapitale = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const nJours = (n: number) => `${n} jour${n > 1 ? 's' : ''}`

/**
 * Journal et repères (`/admin#journal`) : ce que l'administrateur a fait d'ici, et ce qui s'est passé au serveur — ses
 * mises en ligne, ses arrêts nets, les incidents des alertes —, au même fil, du plus récent au plus ancien, rangé par
 * jour (la proposition du 3 novembre 2026 ; la revue du 4, P2.2). Chaque geste qui change quelque chose s'y note de
 * lui-même (`server/src/core/journalDesGestes.ts`), cinquante à la fois. Ceux qui posent un repère sur les courbes du QG
 * — une page fermée ou rouverte, une affiche, une annonce, un réglage — et les mises en ligne se comparent :
 * « Avant / après » les pose sur les quatorze jours de chaque côté, dans la carte en tête.
 */
export function QgJournal() {
  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [gestes, setGestes] = useState<GesteDuQg[] | null>(null)
  const [suite, setSuite] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [enCours, setEnCours] = useState(false)
  /** Un an de repères, lus une fois ; « echec » s'ils ne se lisent pas — le fil des gestes reste. */
  const [reperes, setReperes] = useState<ReperesDuQg | 'echec' | null>(null)
  /** Les incidents des trente jours, lus une fois, et l'heure du serveur qui les date ; vides s'ils ne se lisent pas. */
  const [incidents, setIncidents] = useState<{ maintenant: number; incidents: IncidentDuQg[] } | null>(null)
  const [choisi, setChoisi] = useState<RepereDuQg | null>(null)
  const carte = useRef<HTMLElement>(null)
  const titre = useRef<HTMLHeadingElement>(null)
  const sorte = filtre === 'tous' || filtre === 'reperes' || filtre === 'serveur' ? null : filtre
  // Le filtre montré : une page d'avant demandée sous un autre ne s'y ajoute pas.
  const sorteMontree = useRef(sorte)
  sorteMontree.current = sorte

  useEffect(() => {
    // Un filtre changé pendant la lecture d'avant : seule la dernière se pose.
    let perime = false
    setGestes(null)
    setSuite(null)
    setError('')
    api.admin.gestes({ sorte }).then(
      j => {
        if (perime) return
        setGestes(j.gestes)
        setSuite(j.suite)
      },
      e => !perime && setError(motifDe(e)),
    )
    return () => {
      perime = true
    }
  }, [sorte])

  useEffect(() => {
    let parti = false
    api.admin.reperes(JOURS_DES_REPERES_DU_JOURNAL).then(
      r => !parti && setReperes(r),
      () => !parti && setReperes('echec'),
    )
    api.admin.regles().then(
      p => !parti && setIncidents({ maintenant: p.maintenant, incidents: p.incidents }),
      () => !parti && setIncidents({ maintenant: Date.now(), incidents: [] }),
    )
    return () => {
      parti = true
    }
  }, [])

  const avant = async () => {
    if (!suite || enCours) return
    setEnCours(true)
    const pour = sorte
    try {
      const j = await api.admin.gestes({ sorte: pour, suite })
      if (sorteMontree.current !== pour) return
      setGestes(g => [...(g ?? []), ...j.gestes])
      setSuite(j.suite)
    } catch (e) {
      if (sorteMontree.current === pour) setError(motifDe(e))
    } finally {
      setEnCours(false)
    }
  }

  /** Un repère choisi dans le fil : la carte le compare, et remonte sous les yeux au téléphone, où elle est en tête. */
  const comparer = (r: RepereDuQg) => {
    setChoisi(r)
    requestAnimationFrame(() => {
      const boite = carte.current?.getBoundingClientRect()
      if (boite && (boite.top < 0 || boite.top > window.innerHeight / 2)) carte.current?.scrollIntoView({ block: 'start' })
      // Le lecteur d'écran suit : la carte a changé, ailleurs dans la page.
      titre.current?.focus({ preventScroll: true })
    })
  }

  const lus = reperes && reperes !== 'echec' ? reperes.reperes : []
  const parCle = new Map(lus.map(r => [r.cle, r]))
  const maintenant = incidents?.maintenant ?? Date.now()
  let lignes: LigneDuFil[] = []
  let pret = true
  if (filtre === 'reperes') {
    pret = reperes !== null
    lignes = lus.map(r => ({ genre: 'repere', cle: r.cle, quand: r.quand, repere: r }))
  } else {
    const serveur: LigneDuFil[] =
      filtre === 'tous' || filtre === 'serveur'
        ? [
            ...lus.filter(duServeur).map(r => ({ genre: 'repere' as const, cle: r.cle, quand: r.quand, repere: r })),
            ...(incidents?.incidents ?? []).map(i => ({ genre: 'incident' as const, cle: `incident:${i.id}`, quand: i.debut, incident: i })),
          ]
        : []
    if (filtre === 'serveur') {
      pret = reperes !== null && incidents !== null
      lignes = serveur
    } else {
      pret = gestes !== null
      const deGestes = (gestes ?? []).map(g => ({ genre: 'geste' as const, cle: g.id, quand: g.quand, geste: g, repere: parCle.get(g.id) ?? null }))
      // Tant que des gestes plus anciens attendent « Voir les gestes d'avant », le serveur ne descend pas plus bas qu'eux :
      // le fil reste dans l'ordre de l'heure.
      const plusAncien = suite && deGestes.length > 0 ? deGestes[deGestes.length - 1].quand : -Infinity
      lignes = [...deGestes, ...serveur.filter(l => l.quand >= plusAncien)]
    }
  }
  lignes.sort((a, b) => b.quand - a.quand)
  /** Un fil vide le dit — et, les repères illisibles, il ne passe pas pour un fil sans rien. */
  const vide = (): string => {
    if ((filtre === 'reperes' || filtre === 'serveur') && reperes === 'echec') return 'Les repères ne se lisent pas pour l’instant : réessaie dans un instant.'
    if (filtre === 'reperes') return 'Aucun repère encore : une mise en ligne, une page fermée ou rouverte, une affiche, une annonce, un réglage s’y poseront.'
    if (filtre === 'serveur') return 'Rien du serveur : ni mise en ligne ni arrêt net ces huit jours, ni incident ces trente jours.'
    return sorte ? 'Aucun geste de ce côté-là.' : 'Rien encore : tes gestes s’écriront ici.'
  }

  return (
    <>
      <p className="muted small">
        {espacesFines(
          'Ce que tu as fait d’ici, et ce qui s’est passé au serveur — mises en ligne, arrêts nets, incidents —, du plus récent au plus ancien. Un repère se pose aussi sur les courbes du QG : « Avant / après » le compare aux quatorze jours d’avant.',
        )}
      </p>
      <div className="qg-journal-et-reperes">
        <CarteAvantApres
          boite={carte}
          titre={titre}
          choisi={choisi}
          reperes={reperes}
          onChoisir={comparer}
          onFermer={() => setChoisi(null)}
        />
        <div className="qg-journal-fil">
          <Onglets
            onglets={FILTRES.map(f => ({ id: f, nom: nomDuFiltre(f) }))}
            actif={filtre}
            onChoisir={setFiltre}
            label="Ce que le fil montre"
            idOnglet={f => `journal-${f}`}
            idPanneau={() => 'journal-gestes'}
            className="onglets-puces"
          />
          <div className="qg-journal" role="tabpanel" id="journal-gestes" aria-labelledby={`journal-${filtre}`}>
            {error && filtre !== 'reperes' && filtre !== 'serveur' ? (
              <p className="error">{error}</p>
            ) : !pret ? (
              <p className="serif-note">Chargement…</p>
            ) : lignes.length === 0 ? (
              <p className="serif-note">{espacesFines(vide())}</p>
            ) : (
              <>
                {filParJour(lignes, Date.now()).map(groupe => (
                  <section key={groupe.jour} className="qg-journal-jour" aria-label={groupe.titre}>
                    <h2 className="compte-groupe">{groupe.titre}</h2>
                    <ul className="qg-liste">
                      {groupe.items.map(l => (
                        <LigneDuJournal key={l.cle} ligne={l} maintenant={maintenant} onComparer={comparer} />
                      ))}
                    </ul>
                  </section>
                ))}
                {suite && filtre !== 'reperes' && filtre !== 'serveur' && (
                  <button type="button" className="btn btn-ghost qg-journal-avant" aria-disabled={enCours || undefined} onClick={avant}>
                    Voir les gestes d’avant
                  </button>
                )}
              </>
            )}
            {(filtre === 'reperes' || filtre === 'serveur') && pret && (
              <p className="muted small">
                {espacesFines(
                  filtre === 'reperes'
                    ? 'Un an de repères. Les mises en ligne et les arrêts nets, huit jours : le relevé des démarrages n’en garde pas plus.'
                    : 'Les mises en ligne et les arrêts nets se lisent sur huit jours — le relevé des démarrages n’en garde pas plus —, les incidents sur trente.',
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/** « Avant / après » sur la ligne d'un repère : sous sa phrase, à portée du pouce. */
function BoutonComparer({ repere, onComparer }: { repere: RepereDuQg; onComparer: (r: RepereDuQg) => void }) {
  return (
    <button type="button" className="qg-comparer" onClick={() => onComparer(repere)}>
      <Icon name="bar-chart" />
      Avant / après
    </button>
  )
}

function LigneDuJournal({ ligne: l, maintenant, onComparer }: { ligne: LigneDuFil; maintenant: number; onComparer: (r: RepereDuQg) => void }) {
  if (l.genre === 'geste') {
    const g = l.geste
    return (
      <li className="qg-geste">
        <span className="qg-rond">
          <Icon name={ICONE[g.sorte]} />
        </span>
        <span className="qg-ligne-texte">
          {/* Les espaces insécables à l'affichage : au téléphone, un « ouvrant restait seul en bout de ligne. */}
          <span>{espacesFines(g.resume)}</span>
          <span className="muted small">
            {heureEcrite(g.quand)} · {NOM_DE_LA_SORTE[g.sorte]}
          </span>
          {l.repere && <BoutonComparer repere={l.repere} onComparer={onComparer} />}
        </span>
      </li>
    )
  }
  if (l.genre === 'repere') {
    const r = l.repere
    return (
      <li className="qg-geste">
        <span className={'qg-rond' + (r.sorte === 'arret-net' ? ' qg-rond-alerte' : '')}>
          <svg className="qg-bulle-forme" viewBox="0 0 12 12" aria-hidden="true">
            <FormeDuRepere sorte={r.sorte} x={6} y={6} />
          </svg>
        </span>
        <span className="qg-ligne-texte">
          <span>{espacesFines(enCapitale(r.nom))}</span>
          <span className="muted small">
            {heureEcrite(r.quand)} · {DE_QUOI[r.sorte]}
          </span>
          <BoutonComparer repere={r} onComparer={onComparer} />
        </span>
      </li>
    )
  }
  const i = l.incident
  return (
    <li className="qg-geste">
      <span className={'qg-rond' + (i.gravite === 'veille' ? '' : ' qg-rond-alerte')}>
        <Icon name={i.fin === null ? 'alert' : 'check-circle'} />
      </span>
      <span className="qg-ligne-texte">
        <span>
          {/* Une règle retirée depuis garde son incident : il se nomme par sa clé. */}
          {`Incident : ${REGLE[i.regle]?.nom ?? i.regle}`} <span className={`qg-gravite qg-gravite-${i.gravite} small`}>{NOM_DE_LA_GRAVITE[i.gravite]}</span>
        </span>
        <span className="small">{espacesFines(i.cause)}</span>
        <span className="muted small">
          {heureEcrite(i.debut)} · {i.fin === null ? `en cours depuis ${dureeEcrite(maintenant - i.debut)}` : `${dureeEcrite(i.fin - i.debut)}, au calme à ${heureEcrite(i.fin)}`} · Alertes
        </span>
      </span>
    </li>
  )
}

/**
 * La carte « Avant / après » (la revue du 4 novembre 2026, P2.2 : « le Cabinet du 31 octobre a-t-il pris des joueurs à
 * la campagne, ou en a-t-il amené ? ») : un repère choisi, les quatorze jours d'avant son jour et les quatorze d'après,
 * chaque chiffre de la mémoire du QG en un jour moyen et son écart (`avantApres`, `shared/qgEffets.ts`). Rien de choisi,
 * elle tient en trois lignes — au téléphone, le fil reste sous le pouce — et propose le dernier repère.
 */
function CarteAvantApres({
  boite,
  titre,
  choisi,
  reperes,
  onChoisir,
  onFermer,
}: {
  boite: RefObject<HTMLElement | null>
  titre: RefObject<HTMLHeadingElement | null>
  choisi: RepereDuQg | null
  reperes: ReperesDuQg | 'echec' | null
  onChoisir: (r: RepereDuQg) => void
  onFermer: () => void
}) {
  const jour = choisi ? jourDe(choisi.quand) : null
  const [autour, setAutour] = useState<{ jour: string; lu: JoursDeLAvantApres | 'echec' } | null>(null)
  useEffect(() => {
    if (!jour) return
    // Un autre repère choisi pendant la lecture : seule la dernière se pose.
    let perime = false
    api.admin.joursAutourDUnRepere(jour).then(
      lu => !perime && setAutour({ jour, lu }),
      () => !perime && setAutour({ jour, lu: 'echec' }),
    )
    return () => {
      perime = true
    }
  }, [jour])

  const tous = reperes && reperes !== 'echec' ? reperes.reperes : []
  const dernier = tous.at(-1) ?? null
  const lu = autour && autour.jour === jour ? autour.lu : null
  const aa = lu && lu !== 'echec' && choisi && jour ? avantApres(new Map(lu.jours), jour, choisi.mode, lu.aujourdhui) : null
  // Les autres repères de ces vingt-neuf jours : ce qui bouge n'est pas forcément l'effet de celui-ci.
  const autres = choisi && jour ? tous.filter(r => r.cle !== choisi.cle && jourDe(r.quand) >= jourAvant(jour, JOURS_DE_L_AVANT_APRES) && jourDe(r.quand) <= jourAvant(jour, -JOURS_DE_L_AVANT_APRES)).length : 0
  const N = JOURS_DE_L_AVANT_APRES

  return (
    <section ref={boite} className="qg-carte qg-ecran qg-avant-apres" aria-labelledby="journal-avant-apres">
      <div className="qg-carte-tete">
        <h2 id="journal-avant-apres" ref={titre} tabIndex={-1}>
          Avant / après
        </h2>
        {choisi && (
          <button type="button" className="salon-geste" onClick={onFermer}>
            <Icon name="x" />
            Fermer
          </button>
        )}
      </div>
      {!choisi ? (
        <>
          <p className="muted small">
            {espacesFines(
              reperes === 'echec'
                ? 'Les repères ne se lisent pas pour l’instant : la comparaison attend.'
                : `Un repère du fil comparé aux ${N} jours d’avant son jour et aux ${N} d’après, sur les chiffres de la mémoire du QG : « Avant / après » sur sa ligne.`,
            )}
          </p>
          {dernier && (
            <button type="button" className="salon-geste qg-avant-apres-dernier" onClick={() => onChoisir(dernier)}>
              <Icon name="bar-chart" />
              {espacesFines(`Le plus récent — ${dernier.nom}`)}
            </button>
          )}
        </>
      ) : (
        <>
          <div className="qg-avant-apres-repere">
            <svg className="qg-bulle-forme" viewBox="0 0 12 12" aria-hidden="true">
              <FormeDuRepere sorte={choisi.sorte} x={6} y={6} />
            </svg>
            <span className="qg-ligne-texte">
              <b>{espacesFines(enCapitale(choisi.nom))}</b>
              <span className="muted small">{`${jourEnToutesLettres(jour!)} à ${heureEcrite(choisi.quand)}`}</span>
            </span>
          </div>
          {lu === null ? (
            <p className="serif-note">Chargement…</p>
          ) : lu === 'echec' || !aa ? (
            <p className="muted small">La mémoire du QG ne se lit pas pour l’instant : la comparaison attend.</p>
          ) : (
            <>
              <p className="muted small">
                {espacesFines(
                  [
                    `Un jour moyen de chaque côté : les ${N} jours d’avant son jour, les ${N} d’après — son jour à part.`,
                    aa.apres.finis === 0
                      ? 'Il est d’aujourd’hui : l’après se lira dès demain, un jour de plus chaque jour.'
                      : aa.apres.finis < N
                        ? `Il n’a que ${nJours(aa.apres.finis)} : l’après se lit sur ${aa.apres.finis} sur ${N}, un de plus chaque jour.`
                        : null,
                    aa.avant.connus === 0
                      ? 'La mémoire du QG ne remonte pas avant lui : l’avant ne se lit pas.'
                      : aa.avant.connus < N || aa.apres.connus < aa.apres.finis
                        ? `La mémoire du QG ne sait pas ${nJours(N - aa.avant.connus + aa.apres.finis - aa.apres.connus)} de ces ${aa.apres.finis + N} : ils ne comptent pas — un jour qui manque n’est pas une baisse.`
                        : null,
                  ]
                    .filter(Boolean)
                    .join(' '),
                )}
              </p>
              <div className="qg-tableau">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Par jour</th>
                      <th scope="col">Avant</th>
                      <th scope="col">Après</th>
                      <th scope="col">Écart</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aa.lignes.map(l => {
                      const ecart = ecartDeLAvantApres(l.avant, l.apres)
                      return (
                        <tr key={l.cle}>
                          <th scope="row" className="qg-tableau-texte">
                            {l.nom}
                          </th>
                          <td className="num">{l.avant === null ? '–' : moyenneEcrite(l.avant)}</td>
                          <td className="num">{l.apres === null ? '–' : moyenneEcrite(l.apres)}</td>
                          <td>
                            {ecart ? (
                              <span className={'qg-ecart' + (ecart.sens ? ` qg-ecart-${ecart.sens}` : '') + (ecart.faible ? ' qg-ecart-faible' : '')}>
                                {ecart.sens && <Icon name={ecart.sens === 'plus' ? 'arrow-up' : 'arrow-down'} />}
                                {ecart.texte}
                                {ecart.suite && <span className="sr-only">{ecart.suite}</span>}
                              </span>
                            ) : (
                              '–'
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="muted small">
                {espacesFines(
                  `Une comparaison, pas une preuve : d’autres choses ont pu changer ces jours-là${
                    autres > 0 ? ` — ${autres > 1 ? `${autres} autres repères y tombent` : 'un autre repère y tombe'}` : ''
                  }.`,
                )}
              </p>
            </>
          )}
        </>
      )}
    </section>
  )
}
