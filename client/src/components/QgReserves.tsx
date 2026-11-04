import { useEffect, useState, type ReactNode } from 'react'
import { api, motifDe } from '../api'
import { Flamme, Icon, type IconName } from './Icon'
import { CarteDeChaleur, TuileDuQg } from './QgGraphes'
import { GrapheDesJours } from './QgModes'
import type { Faire } from './QgSignalements'
import { copierTexte } from '../copier'
import { espacesFines } from '../format'
import { showToast } from '../state'
import { formatNumber } from '../../../shared/typographie'
// Le même seuil que « À traiter », au poste de commande — celui que la page des alertes règle : écrit deux fois, il
// pouvait s'allumer ici et pas là.
import { ALERTE_JOURS_D_AVANCE, quandEcrit } from '../../../shared/qg'
import { nomDuSousTheme } from '../../../shared/qgSignalements'
import { nomCourt } from '../../../shared/categories'
import type { AjoutsDeLaRoutine } from '../../../shared/campagne'
import type { QuizQuestionDef } from '../../../shared/library'
import { JOURS_DES_APPORTS, type BaseDeLaCampagneAuQg, type ContenuDuCabinetAuQg, type EtatDesQuestions, type PageDesReserves, type ReserveDuJourAuQg } from '../../../shared/qgContenu'

/**
 * Les réserves et la base au QG (`/admin#reserves`, le QG 2, lot 7 — la
 * proposition du 3 novembre 2026, « Les réserves et la base ») : de quoi
 * tenir. La réserve du quiz du jour — ses jours d'avance, de quoi la remplir,
 * venus de la page du quiz du jour, ses questions prêtes catégorie par
 * catégorie, ce qui y est entré chaque jour —, la base de la campagne en carte
 * de chaleur, catégorie par marche — là où une case pâlit, les sentiers et le
 * Quiz du Cabinet tirent toujours les mêmes —, la routine du matin, venue de
 * la page de la campagne, et le contenu neuf du Cabinet. Une seule lecture
 * (`GET /api/admin/reserves`), gardée une minute au serveur.
 */
export function QgReserves({
  seuilDeLaReserve = ALERTE_JOURS_D_AVANCE,
  apresUnGeste,
  versLesQuestions,
}: {
  /** Les jours d'avance sous lesquels la réserve s'allume : celui que la vue d'ensemble lit des alertes réglées. */
  seuilDeLaReserve?: number
  apresUnGeste: () => void
  versLesQuestions: (etat: EtatDesQuestions) => void
}) {
  const [page, setPage] = useState<PageDesReserves | null>(null)
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)

  const charger = () =>
    api.admin.reserves().then(
      p => {
        setPage(p)
        setErreur('')
      },
      e => setErreur(motifDe(e)),
    )
  useEffect(() => {
    void charger()
  }, [])

  const faire: Faire = async (appel, merci) => {
    setOccupe(true)
    try {
      await appel()
      showToast({ kind: 'info', message: merci })
      await charger()
      // La réserve qui remonte éteint l'alerte de « À traiter », et la pastille du rail.
      apresUnGeste()
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(false)
    }
  }

  if (erreur && !page) return <p className="error">{erreur}</p>
  const contredites = page?.campagne.carte.reduce((n, c) => n + c.marches.reduce((m, x) => m + x.contredites, 0), 0)
  const entrees = page?.jour.parJour.reduce((n, j) => n + j.routine + j.autres, 0)
  const duCabinet = page?.cabinet?.sortes.reduce((n, s) => n + s.entrees, 0)
  return (
    <>
      <p className="muted small">
        De quoi tenir : la réserve du quiz du jour, la base de la campagne par catégorie et par marche, et le contenu neuf du Cabinet. Ce que chaque question
        donne en jeu se lit sur la page des questions.
      </p>
      <ul className="qg-tuiles">
        <TuileDuQg
          nom="Réserve du quiz du jour"
          mode="jour"
          valeur={page?.jour.joursDAvance}
          detail={page && `jours d’avance · ${formatNumber(page.jour.pretes)} prêtes`}
        />
        <TuileDuQg nom="Entrées dans la réserve" mode="jour" valeur={entrees} detail={`ces ${JOURS_DES_APPORTS} jours`} />
        <TuileDuQg nom="Base de la campagne" mode="campagne" valeur={page?.campagne.jouables} detail={page && `jouables sur ${formatNumber(page.campagne.questions)}`} />
        <TuileDuQg nom="Contredites" mode="campagne" valeur={contredites} detail="à reclasser" onOuvrir={() => versLesQuestions('contredites')} />
        <TuileDuQg nom="Ajoutées à la base" mode="campagne" valeur={page?.campagne.ajouts.septJours} detail="par la routine, ces sept jours" />
        <TuileDuQg nom="Contenu du Cabinet" mode="cabinet" valeur={duCabinet} detail={page && (page.cabinet ? 'lieux, fiches, répliques, frises' : 'illisible pour l’instant')} />
      </ul>
      {!page ? (
        <p className="serif-note">Chargement…</p>
      ) : (
        <>
          <LaReserveDuJour
            reserve={page.jour}
            seuil={seuilDeLaReserve}
            maintenant={page.maintenant}
            occupe={occupe}
            faire={faire}
            recharger={charger}
            apresUnGeste={apresUnGeste}
          />
          <div className="qg-deux">
            <PretesParCategorie reserve={page.jour} />
            <EntreesJourParJour reserve={page.jour} />
          </div>
          <CarteDeLaBase base={page.campagne} versLesContredites={() => versLesQuestions('contredites')} />
          <LaRoutineDuMatin ajouts={page.campagne.ajouts} maintenant={page.maintenant} occupe={occupe} faire={faire} />
          <LeContenuDuCabinet cabinet={page.cabinet} />
        </>
      )}
    </>
  )
}

// ── La réserve du quiz du jour ──────────────────────────────────────────────

const SOURCES: Record<string, string> = { livre: 'Quiz livrés', liste: 'Liste collée', ia: 'Écrite par l’IA', public: 'Question du public' }

/**
 * La réserve, venue de la page du quiz du jour (le QG 2, lot 7 : déplacée, pas
 * recopiée — la page du jour en garde une ligne) : ses jours d'avance — ce
 * qu'on vient vérifier, et ce qui s'allume quand elle baisse —, le
 * remplissage automatique, les derniers apports, et de quoi la remplir à la
 * main : « Coller une liste » (le format de l'éditeur), la consigne de la
 * routine pour une IA, les prochains jours et « Retirer ».
 */
function LaReserveDuJour({
  reserve,
  seuil,
  maintenant,
  occupe,
  faire,
  recharger,
  apresUnGeste,
}: {
  reserve: ReserveDuJourAuQg
  seuil: number
  maintenant: number
  occupe: boolean
  faire: Faire
  recharger: () => Promise<void>
  apresUnGeste: () => void
}) {
  const [liste, setListe] = useState<string | null>(null)
  const [prochaines, setProchaines] = useState<{ id: string; question: QuizQuestionDef; source: string }[] | null>(null)
  /** La consigne que le presse-papiers a refusée : dépliée, prête à sélectionner à la main. */
  const [consigne, setConsigne] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const dernierDepot = reserve.apports.find(a => a.source === 'ia')

  const coller = async () => {
    if (!liste?.trim()) return
    setEnCours(true)
    try {
      const r = await api.admin.listeDuJour(liste)
      const raisons = r.ecartees.length > 0 ? ` · ${r.ecartees.length} écartée${r.ecartees.length > 1 ? 's' : ''}` : ''
      showToast({ kind: r.ajoutees > 0 ? 'info' : 'error', message: `${r.ajoutees} question${r.ajoutees > 1 ? 's' : ''} ajoutée${r.ajoutees > 1 ? 's' : ''}${raisons}` })
      if (r.ajoutees > 0) setListe(null)
      await recharger()
      apresUnGeste()
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setEnCours(false)
    }
  }

  /**
   * « Copier la consigne pour une IA » : la même que celle de la routine, à
   * coller dans le chatbot de son choix — sa réponse se recolle ensuite
   * dans « Coller une liste ». Le secours quand la routine s'arrête.
   */
  const copierLaConsigne = async () => {
    setEnCours(true)
    try {
      const { consigne } = await api.admin.consigneDuJour()
      if (await copierTexte(consigne)) {
        setConsigne(null)
        showToast({ kind: 'info', message: 'Consigne copiée : colle-la dans ton IA, puis sa réponse dans « Coller une liste »' })
      } else {
        setConsigne(consigne)
      }
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setEnCours(false)
    }
  }

  const bloque = occupe || enCours
  return (
    <section className={'admin-hud' + (reserve.joursDAvance < seuil ? ' admin-hud-alerte' : '')} aria-labelledby="reserve-titre">
      <span className="salon-hud-label" id="reserve-titre">
        <Flamme /> La réserve du quiz du jour
      </span>
      <div className="reserve-tete">
        <span className="reserve-jours num">{reserve.joursDAvance}</span>
        <div>
          <b>jour{reserve.joursDAvance > 1 ? 's' : ''} d’avance</b>
          <span className="muted small">
            {reserve.pretes} question{reserve.pretes > 1 ? 's' : ''} prête{reserve.pretes > 1 ? 's' : ''} · {reserve.posees} déjà posée
            {reserve.posees > 1 ? 's' : ''}
            {reserve.retirees > 0 && ` · ${reserve.retirees} retirée${reserve.retirees > 1 ? 's' : ''}`} · alerte sous {seuil} jour{seuil > 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <div className="jauge reserve-jauge" aria-hidden="true">
        <span className="jauge-plein" style={{ width: `${Math.min(100, (reserve.joursDAvance / 30) * 100)}%` }} />
      </div>
      {reserve.joursDAvance < seuil && (
        <p className="error">
          {`Moins de ${seuil} jour${seuil > 1 ? 's' : ''} d’avance. Colle une liste, ou copie la consigne dans ton IA : sans question neuve, la réserve rejouera les plus anciennes.`}
        </p>
      )}
      <p className="reserve-remplissage small">
        <Icon name={reserve.remplissage.automatique ? 'check-circle' : 'lock'} />
        {reserve.remplissage.automatique ? (
          <span>
            <b>Remplissage automatique ouvert</b> : une routine Claude Code y dépose les questions.
            {dernierDepot ? ` Dernier dépôt : ${quandEcrit(dernierDepot.quand, maintenant)}.` : ' Aucun dépôt pour l’instant.'}
          </span>
        ) : (
          <span>
            <b>Pas de remplissage automatique</b> : pose <code>RESERVE_TOKEN</code> sur le serveur (docs/exploitation/mise-en-ligne.md, étape 9), ou copie la
            consigne dans ton IA.
          </span>
        )}
      </p>
      <p className="muted small">
        Dix questions par jour, catégories mêlées, pas deux fois la même. Le quiz du jour joue les questions à choix, sans photo : les estimations, les variantes
        et les photos sont écartées, et le disent.
      </p>
      {reserve.apports.length > 0 && (
        <ul className="journal-reserve">
          {reserve.apports.map(a => (
            <li key={a.quand}>
              <Icon name="check-circle" />
              <span>
                <b>{quandEcrit(a.quand, maintenant)}</b> · {SOURCES[a.source] ?? a.source} · {a.ajoutees} ajoutée{a.ajoutees > 1 ? 's' : ''}
                {a.ecartees.length > 0 && `, ${a.ecartees.length} écartée${a.ecartees.length > 1 ? 's' : ''} (${[...new Set(a.ecartees.map(e => e.raison))].join(', ')})`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {liste !== null ? (
        <div className="liste-a-coller">
          <textarea
            className="input"
            rows={10}
            value={liste}
            onChange={e => setListe(e.target.value)}
            placeholder={'Quelle est la capitale de l’Australie ?\n*Canberra\nSydney\nMelbourne\n\n# Histoire\nEn quelle année…'}
            aria-label="La liste de questions"
          />
          <div className="row">
            <button className="btn btn-primary" disabled={bloque || !liste.trim()} onClick={() => void coller()}>
              Ajouter à la réserve
            </button>
            <button className="btn btn-ghost" onClick={() => setListe(null)}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="admin-gestes">
          <button type="button" className="salon-geste admin-geste-oui" onClick={() => setListe('')}>
            <Icon name="clipboard" />
            Coller une liste
          </button>
          <button type="button" className="salon-geste" disabled={bloque} onClick={() => void copierLaConsigne()}>
            <Icon name="copy" />
            Copier la consigne pour une IA
          </button>
          <button
            type="button"
            className="salon-geste"
            onClick={() =>
              prochaines
                ? setProchaines(null)
                : api.admin
                    .prochainesDuJour()
                    .then(setProchaines)
                    .catch(e => showToast({ kind: 'error', message: motifDe(e) }))
            }
          >
            <Icon name="eye" />
            {prochaines ? 'Masquer les prochains jours' : 'Voir les prochains jours'}
          </button>
        </div>
      )}
      {consigne && (
        <div className="consigne-a-copier">
          <p className="muted small">Le navigateur a refusé la copie : sélectionne la consigne à la main.</p>
          <pre className="import-example import-format-complet">{consigne}</pre>
        </div>
      )}
      {prochaines && (
        <ol className="prochaines-du-jour small">
          {prochaines.map(p => (
            <li key={p.id}>
              {p.question.text}{' '}
              <span className="muted">
                · {p.question.answers[p.question.correct]}
                {p.question.category && ` · ${p.question.category}`}
              </span>{' '}
              <button
                className="link-inline"
                disabled={bloque}
                onClick={() => void faire(() => api.admin.retirerDuJour(p.id), 'Retirée de la réserve').then(() => setProchaines(ps => ps && ps.filter(x => x.id !== p.id)))}
              >
                Retirer
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** Les questions prêtes de chaque catégorie, la plus fournie d'abord : le tirage mêle les catégories, celle qui s'épuise revient moins. */
function PretesParCategorie({ reserve }: { reserve: ReserveDuJourAuQg }) {
  const haut = Math.max(1, ...reserve.parCategorie.map(c => c.pretes))
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="reserve-categories">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="reserve-categories">Les prêtes, catégorie par catégorie</h2>
        <span className="muted small">celles qui attendent leur jour · les questions du public à part : une par jour, leur file à elles</span>
      </div>
      {reserve.parCategorie.length === 0 ? (
        <p className="muted small">Aucune question prête : la réserve rejoue les plus anciennes.</p>
      ) : (
        <ul className="qg-pistes">
          {reserve.parCategorie.map(c => (
            <li key={c.categorie ?? ''} className="qg-piste-ligne">
              <span className="qg-piste-nom">{c.categorie ?? 'Sans catégorie'}</span>
              <span className="qg-piste" aria-hidden="true">
                <i className="qg-mode-jour" style={{ width: `${(c.pretes / haut) * 100}%` }} />
              </span>
              <b className="num">{formatNumber(c.pretes)}</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Ce qui est entré dans la réserve chaque jour de ces deux semaines : la routine du matin, et le reste dit à part. */
function EntreesJourParJour({ reserve }: { reserve: ReserveDuJourAuQg }) {
  const autres = reserve.parJour.reduce((n, j) => n + j.autres, 0)
  const sansRien = reserve.parJour.filter(j => j.routine === 0).length
  return (
    <section className="qg-carte qg-ecran" aria-labelledby="reserve-jours">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="reserve-jours">Ce que la routine du matin y dépose</h2>
        <span className="muted small">
          {espacesFines(
            `les questions ajoutées chaque jour, ces ${JOURS_DES_APPORTS} jours${autres > 0 ? ` · et ${formatNumber(autres)} par d’autres voies : une liste collée, une question du public` : ''}`,
          )}
        </span>
      </div>
      <GrapheDesJours
        jours={reserve.parJour.map(j => j.jour)}
        valeurs={reserve.parJour.map(j => j.routine)}
        classe="qg-mode-jour"
        dire={n => `${formatNumber(n)} question${n > 1 ? 's' : ''} déposée${n > 1 ? 's' : ''}`}
        titre="Les questions que la routine du matin a déposées, jour par jour"
      />
      {sansRien > 0 && (
        <p className="muted small">
          {sansRien === reserve.parJour.length
            ? 'La routine n’a rien déposé ces deux semaines : elle tourne derrière RESERVE_TOKEN, une fois l’hébergeur réveillé.'
            : `${sansRien} matin${sansRien > 1 ? 's' : ''} sans dépôt : l’hébergeur dormait peut-être encore, ou la réserve était assez pleine.`}
        </p>
      )}
    </section>
  )
}

// ── La base de la campagne ──────────────────────────────────────────────────

type VueDeLaBase = 'jouables' | 'contredites' | 'difficultes'

/** Chaque vue de la carte, et ce qu'une case compte — au singulier jusqu'à un : « 0 question jouable ». */
const VUES_DE_LA_BASE: { id: VueDeLaBase; nom: string; dit: string; une: string }[] = [
  { id: 'jouables', nom: 'Jouables', dit: 'questions jouables', une: 'question jouable' },
  { id: 'contredites', nom: 'Contredites', dit: 'questions que leurs réponses contredisent', une: 'question que ses réponses contredisent' },
  { id: 'difficultes', nom: 'Difficulté estimée', dit: 'questions jouables', une: 'question jouable' },
]
/**
 * Les colonnes : ce que l'en-tête montre, et ce qu'il dit à l'oreille comme à la lecture d'une case. Abrégé : une
 * colonne n'a qu'une cinquantaine de pixels au téléphone, et « Difficiles » y passait sur « Expertes » (le rendu du
 * 4 novembre 2026).
 */
const MARCHES = [
  { nom: 'faciles', court: 'Fac.' },
  { nom: 'moyennes', court: 'Moy.' },
  { nom: 'difficiles', court: 'Diff.' },
  { nom: 'expertes', court: 'Exp.' },
]
const DIFFICULTES = [1, 2, 3, 4, 5].map(d => ({ nom: `difficulté ${d}`, court: String(d) }))

/**
 * La base de la campagne en carte de chaleur (`CarteDeChaleur`, le kit du
 * QG : un vrai tableau, chaque case son nombre et sa phrase entière, les
 * flèches d'une case à l'autre, l'or des joueurs en six paliers mesurés sur la
 * console), catégorie par marche — celle où la campagne tire chaque question,
 * jamais recalculée ici —, ou par difficulté estimée à l'écriture, ce que la
 * routine du matin rattrape. Les catégories sous leur nom court : douze noms
 * entiers ne tenaient pas dans la colonne des en-têtes.
 */
function CarteDeLaBase({ base, versLesContredites }: { base: BaseDeLaCampagneAuQg; versLesContredites: () => void }) {
  const [vue, setVue] = useState<VueDeLaBase>('jouables')
  const colonnes = vue === 'difficultes' ? DIFFICULTES : MARCHES
  const valeurs = base.carte.map(c => (vue === 'difficultes' ? c.difficultes : c.marches.map(m => (vue === 'jouables' ? m.jouables : m.contredites))))
  const haut = Math.max(1, ...valeurs.flat())
  const { dit, une } = VUES_DE_LA_BASE.find(v => v.id === vue)!
  return (
    <section className="qg-console" aria-labelledby="base-titre">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">La base de la campagne</span>
          <h2 id="base-titre">{vue === 'difficultes' ? 'Catégorie par catégorie, par difficulté estimée' : 'Catégorie par catégorie, marche par marche'}</h2>
          <span className="muted small">
            {espacesFines(
              vue === 'difficultes'
                ? 'De 1, presque tout le monde la trouve, à 5, un passionné : l’estimation de l’écriture, que la routine du matin rattrape là où elle manque.'
                : vue === 'contredites'
                  ? 'Jouées cinq fois au moins, leur part de bonnes réponses dit une autre marche que la leur : elles se reclassent depuis la page des questions.'
                  : 'La marche où la campagne tire chaque question. Là où une case pâlit, les sentiers et le Quiz du Cabinet tirent toujours les mêmes.',
            )}
          </span>
        </div>
        <div className="onglets onglets-puces" role="group" aria-label="Ce que la carte compte">
          {VUES_DE_LA_BASE.map(v => (
            <button key={v.id} type="button" className={'onglet' + (vue === v.id ? ' actif' : '')} aria-pressed={vue === v.id} onClick={() => setVue(v.id)}>
              {v.nom}
            </button>
          ))}
        </div>
      </div>
      <CarteDeChaleur
        resume={`La base de la campagne : les ${dit}, par catégorie et ${vue === 'difficultes' ? 'par difficulté estimée, de 1 à 5' : 'par marche'}`}
        lignes={base.carte.map((c, i) => ({
          nom: c.categorie,
          ...(nomCourt(c.categorie) !== c.categorie && { court: nomCourt(c.categorie) }),
          detail: formatNumber(valeurs[i].reduce((s, n) => s + n, 0)),
        }))}
        colonnes={colonnes}
        cases={valeurs.map((ligne, i) =>
          ligne.map((n, j) => ({ part: n / haut, texte: formatNumber(n), dit: `${base.carte[i].categorie}, ${colonnes[j].nom} : ${formatNumber(n)} ${n > 1 ? dit : une}` })),
        )}
        legende={['peu', 'beaucoup']}
      />
      <p className="muted small">
        {espacesFines(
          `${formatNumber(base.questions)} questions écrites et étiquetées d’avance, rien qu’à la campagne : ${formatNumber(base.jouables)} à jouer${base.retirees > 0 ? `, ${formatNumber(base.retirees)} retirée${base.retirees > 1 ? 's' : ''}` : ''}. Celles que la réserve du quiz du jour contient aussi ne sortent pas en campagne. La mesure des marches se refait toutes les six heures.`,
        )}
      </p>
      {vue === 'contredites' && (
        <button type="button" className="salon-geste admin-geste-oui qg-plus" onClick={versLesContredites}>
          <Icon name="bulb" />
          Les relire et les reclasser
        </button>
      )}
    </section>
  )
}

/**
 * Ce que la routine du matin a déposé dans la base (`/api/campagne/base`),
 * venu de la page de la campagne : de quoi voir qu'elle tourne, et relire ses
 * dernières questions — c'est la première fois qu'un humain les lit.
 * « Retirer » les sort de la campagne pour tous, comme une question signalée.
 */
function LaRoutineDuMatin({ ajouts, maintenant, occupe, faire }: { ajouts: AjoutsDeLaRoutine; maintenant: number; occupe: boolean; faire: Faire }) {
  return (
    <section className="qg-console" aria-labelledby="routine-titre">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">La base de la campagne</span>
          <h2 id="routine-titre">La routine du matin</h2>
          <span className="muted small">ce qu’elle a ajouté à la base, les plus récentes d’abord</span>
        </div>
      </div>
      {ajouts.total === 0 ? (
        <p className="muted small">
          Rien de déposé pour l’instant. La routine de la réserve du quiz du jour agrandit aussi la base, chaque matin, une fois son étape « base de la campagne »
          ajoutée (docs/exploitation/mise-en-ligne.md, étape 9).
        </p>
      ) : (
        <>
          <p className="muted small">
            {formatNumber(ajouts.aujourdhui)} question{ajouts.aujourdhui > 1 ? 's' : ''} aujourd’hui · {formatNumber(ajouts.septJours)} ces sept derniers jours ·{' '}
            {formatNumber(ajouts.total)} en tout{ajouts.dernierLe !== null && <> · dernier dépôt {quandEcrit(ajouts.dernierLe, maintenant)}</>}
          </p>
          <ul className="campagne-ajouts">
            {ajouts.derniers.map(a => (
              <li key={a.id} className={a.retiree ? 'campagne-ajout-retire' : undefined}>
                <p>
                  <b>« {a.texte} »</b>{' '}
                  <span className="muted">
                    · {a.categorie} › {nomDuSousTheme(a.categorie, a.sousTheme)} · difficulté {a.difficulte} · {quandEcrit(a.ajouteeLe, maintenant)}
                  </span>
                </p>
                {a.retiree ? (
                  <p className="muted small">{a.remplacee ? 'Corrigée : une nouvelle version se joue à sa place.' : 'Retirée de la campagne.'}</p>
                ) : (
                  <button className="btn btn-small btn-ghost" disabled={occupe} onClick={() => void faire(() => api.admin.retirerDeLaCampagne(a.id), 'Retirée de la campagne')}>
                    Retirer
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

// ── Le Cabinet ──────────────────────────────────────────────────────────────

const NOM_DE_LA_SORTE: Record<ContenuDuCabinetAuQg['sortes'][number]['sorte'], { nom: string; groupes: string }> = {
  lieux: { nom: 'Les lieux', groupes: 'par thème : une partie en joue trois du même' },
  fiches: { nom: 'Les fiches', groupes: 'par catégorie' },
  repliques: { nom: 'Les répliques', groupes: 'par catégorie' },
  frises: { nom: 'Les frises à thème', groupes: 'par catégorie : chacune son thème' },
}

/**
 * Le contenu neuf du Cabinet, compté — ce qui n'est pas une question de la
 * base : le Quiz et les autres jeux en posent, et la carte de la base les
 * compte déjà. Lu du disque une fois par processus ; illisible, la page le dit.
 */
function LeContenuDuCabinet({ cabinet }: { cabinet: ContenuDuCabinetAuQg | null }) {
  return (
    <section className="qg-console" aria-labelledby="cabinet-titre">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Le Cabinet de curiosités</span>
          <h2 id="cabinet-titre">Son contenu neuf</h2>
          <span className="muted small">ce que ses jeux posent hors de la base de la campagne · livré avec le serveur</span>
        </div>
      </div>
      {!cabinet ? (
        <p className="muted small">Le contenu du Cabinet ne s’est pas lu : il reviendra en rouvrant la page.</p>
      ) : (
        <div className="qg-deux">
          {cabinet.sortes.map(s => {
            const haut = Math.max(1, ...s.groupes.map(g => g.entrees))
            return (
              <section key={s.sorte} className="qg-carte qg-ecran" aria-labelledby={`cabinet-${s.sorte}`}>
                <div className="qg-carte-tete qg-carte-tete-pile">
                  <h3 id={`cabinet-${s.sorte}`}>{`${NOM_DE_LA_SORTE[s.sorte].nom} · ${formatNumber(s.entrees)}`}</h3>
                  <span className="muted small">{`pour ${s.jeu}, ${NOM_DE_LA_SORTE[s.sorte].groupes}`}</span>
                </div>
                <ul className="qg-pistes">
                  {s.groupes.map(g => (
                    <li key={g.nom} className="qg-piste-ligne">
                      <span className="qg-piste-nom">{g.nom}</span>
                      <span className="qg-piste" aria-hidden="true">
                        <i className="qg-mode-cabinet" style={{ width: `${(g.entrees / haut) * 100}%` }} />
                      </span>
                      <b className="num">{formatNumber(g.entrees)}</b>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ── Les lignes qui y mènent ─────────────────────────────────────────────────

/**
 * La ligne qui mène à une page du contenu, à la place de ce qui a déménagé :
 * la réserve sur la page du quiz du jour, la base et la routine sur celle de
 * la campagne, les questions contredites aussi (le QG 2, lot 7). La forme de
 * celle qui mène aux signalements (`VersLesSignalements`).
 */
export function VersUnePageDuContenu({
  icone,
  titre,
  detail,
  href,
  alerte = false,
  ouvrir,
}: {
  icone: IconName
  titre: ReactNode
  detail: string
  href: string
  alerte?: boolean
  ouvrir: () => void
}) {
  return (
    <a
      className="qg-ligne signalements-lien"
      href={href}
      onClick={e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        ouvrir()
      }}
    >
      <span className={'qg-rond' + (alerte ? ' qg-rond-alerte' : '')}>
        <Icon name={icone} />
      </span>
      <span className="qg-ligne-texte">
        <b>{titre}</b>
        <span className="muted small">{detail}</span>
      </span>
      <Icon name="chevron-right" className="qg-chevron" />
    </a>
  )
}
