import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { confirmDialog } from './Dialog'
import { Icon } from './Icon'
import { AujourdhuiDeLaCampagne, CeQuOnJoue, DefiDeLaSemaineAuQg, ParcoursDeThemeAuQg, ViesDesSentiersAuQg } from './QgCampagne'
import { Chiffre, GabaritDUnMode, TuileParJoueur, enPourcentsEcrits } from './QgModes'
import { VersLesSignalements } from './QgSignalements'
import { PrenomDuJoueur } from './PrenomDuJoueur'
import { VersUnePageDuContenu } from './QgReserves'
import { enPourcents } from '../../../shared/qgDuJour'
import { entonnoirDuSolo } from '../../../shared/qgModes'
import type { PeriodeDuQg } from '../../../shared/qgPeriodes'
import { espacesFines, quand } from '../format'
import { showToast } from '../state'
import { formatNumber } from '../../../shared/typographie'
import { jourDe, jourEnToutesLettres } from '../../../shared/jour'
import type { VueDEnsemble } from '../../../shared/qg'
import type { SuiviDeLaCampagne } from '../../../shared/qgCampagne'
import { NIVEAUX, type AdminDeLaCampagne, type Niveau } from '../../../shared/campagne'
import { BRANCHES } from '../../../shared/branches'
import {
  ESSAIS_POUR_CROIRE,
  MARCHES_D_UN_PALIER,
  PALIERS,
  PALIER_DU_MAITRE,
  QUESTIONS_PAR_EPREUVE,
  TAUX_DU_CALIBRAGE,
  difficulteDuMelange,
  estimationDuMelange,
  lectureDuPalier,
  marcheMoyenne,
  melangesDesReglages,
  memeMelange,
  regleDuPalier,
  texteDuMelange,
  type AdminDesSentiers,
  type Melange,
  type MelangesRegles,
  type StatsDuPalier,
} from '../../../shared/sentiers'
import { texteDuMelangeCourt } from './melanges'

/**
 * La campagne, côté administrateur (`/admin#campagne`) : les chiffres
 * d'aujourd'hui, ce qu'on joue sous-mode par sous-mode, le défi de la
 * semaine, les parcours de thème, les vies (`QgCampagne.tsx`) ; les sentiers
 * palier par palier, et le mélange de chacun à régler ; puis les lignes qui
 * mènent à ce qui a déménagé au QG 2, lot 7 — sa base et la routine du matin
 * (« Réserves et base », `QgReserves.tsx`), les questions que leurs réponses
 * contredisent (« Questions », `QgQuestions.tsx`) — et aux questions que les
 * joueurs signalent : elles se relisent sur leur page, avec celles du quiz du
 * jour (`AdminSignalements.tsx`). La vue d'ensemble du QG lui prête ses trente
 * jours : déjà lus, ils ne se relisent pas ici — et, depuis le QG 2 (lot 5),
 * ses périodes, que le gabarit des modes pose en tête (`GabaritDUnMode`). Le
 * Cabinet de curiosités a sa page : la campagne le garde parmi ses
 * sous-modes, pas dans son gabarit.
 */
export function AdminCampagne({
  vue,
  versLesSignalements,
  versLesReserves,
  versLesContredites,
  periode = '24h',
  comparer = false,
}: {
  vue: VueDEnsemble | null
  versLesSignalements: () => void
  versLesReserves: () => void
  versLesContredites: () => void
  periode?: PeriodeDuQg
  comparer?: boolean
}) {
  const [etat, setEtat] = useState<AdminDeLaCampagne | null>(null)
  const [erreur, setErreur] = useState('')
  const [suivi, setSuivi] = useState<SuiviDeLaCampagne | null>(null)
  const [suiviEnPanne, setSuiviEnPanne] = useState(false)

  const charger = () =>
    api.admin
      .campagne()
      .then(setEtat)
      .catch(e => setErreur(motifDe(e)))
  // Le suivi à part : la base se montre sans attendre le défi, et une panne de l'un n'ôte pas l'autre.
  const chargerLeSuivi = () =>
    api.admin.suiviDeLaCampagne().then(
      s => {
        setSuivi(s)
        setSuiviEnPanne(false)
      },
      () => setSuiviEnPanne(true),
    )
  useEffect(() => {
    void charger()
    void chargerLeSuivi()
  }, [])

  const totaux = vue?.periodes?.[periode]?.totaux
  const finies = totaux?.finies ? enPourcents({ justes: totaux.finies.campagne, sur: totaux.parties.campagne }) : null
  const etapes = totaux && entonnoirDuSolo(totaux, 'campagne')
  return (
    <>
      <GabaritDUnMode
        mode="campagne"
        vue={vue}
        periode={periode}
        comparer={comparer}
        tuiles={
          <>
            <Chiffre
              nom="Parties finies"
              valeur={enPourcentsEcrits(finies)}
              detail={totaux?.finies ? `${formatNumber(totaux.finies.campagne)} sur ${formatNumber(totaux.parties.campagne)} commencées` : undefined}
            />
            <TuileParJoueur mode="campagne" vue={vue} periode={periode} detail="en moyenne" />
          </>
        }
        entonnoir={
          etapes
            ? {
                titre: 'D’une partie commencée à sa fin',
                etapes,
                note: 'Toutes ses sortes ensemble — séries, épreuves des sentiers, parcours, révisions, défi —, sans le Cabinet, qui a sa page. Une partie laissée se reprend, et se finit plus tard.',
              }
            : null
        }
      />
      <AujourdhuiDeLaCampagne vue={vue} suivi={suivi} />
      {suiviEnPanne && <p className="serif-note">La base permanente ne répond pas : le défi, les parcours et les vies reviendront en rouvrant la page.</p>}
      <CeQuOnJoue vue={vue} />
      <DefiDeLaSemaineAuQg suivi={suivi} />
      <div className="qg-deux">
        <ParcoursDeThemeAuQg suivi={suivi} />
        <ViesDesSentiersAuQg suivi={suivi} />
      </div>

      <AdminSentiers />

      {erreur ? (
        <p className="error">{erreur}</p>
      ) : !etat ? (
        <p className="serif-note">Chargement…</p>
      ) : (
        <LignesDeLaBase etat={etat} versLesReserves={versLesReserves} versLesContredites={versLesContredites} versLesSignalements={versLesSignalements} />
      )}
    </>
  )
}

/**
 * Ce qui a déménagé au QG 2, lot 7, en une ligne chacun : la base et la
 * routine du matin vivent sur « Réserves et base », ce que les réponses
 * contredisent (le souhait du propriétaire du 15 octobre 2026, « la liste des
 * moyennes que personne ne trouve ») sur « Questions », les plus nettes
 * d'abord, « Reclasser » la difficulté qu'elles disent déjà choisie ; puis la
 * ligne des questions signalées.
 */
function LignesDeLaBase({
  etat,
  versLesReserves,
  versLesContredites,
  versLesSignalements,
}: {
  etat: AdminDeLaCampagne
  versLesReserves: () => void
  versLesContredites: () => void
  versLesSignalements: () => void
}) {
  const ajoutees = etat.ajouts.septJours
  return (
    <section className="admin-groupe" aria-label="La base de la campagne">
      <VersUnePageDuContenu
        icone="book"
        href="/admin#reserves"
        titre={`La base : ${formatNumber(etat.jouables)} questions à jouer`}
        detail={`sur ${formatNumber(etat.questions)} · ${ajoutees > 0 ? `${formatNumber(ajoutees)} ajoutée${ajoutees > 1 ? 's' : ''} par la routine ces sept jours` : 'rien d’ajouté par la routine ces sept jours'} · catégorie par marche, la routine du matin : Réserves et base`}
        ouvrir={versLesReserves}
      />
      <VersUnePageDuContenu
        icone="bulb"
        href="/admin#questions"
        titre={
          etat.contreditesEnTout > 0
            ? `${formatNumber(etat.contreditesEnTout)} question${etat.contreditesEnTout > 1 ? 's' : ''} que leurs réponses contredisent`
            : 'Aucune question que ses réponses contredisent'
        }
        detail="jouées cinq fois au moins, leur part de bonnes réponses dit une autre marche que la leur : les relire et les reclasser, sur Questions"
        ouvrir={versLesContredites}
      />
      {/* Les signalements se relisent sur leur page, avec ceux du quiz du jour (le choix du 14 octobre 2026). */}
      <VersLesSignalements questions={etat.signalements.length} ouvrir={versLesSignalements} />
    </section>
  )
}

/** Une question au singulier, comme les marches des sentiers : « une question moyenne ». */
const QUESTION_DE_NIVEAU: Record<Niveau, string> = { facile: 'facile', moyen: 'moyenne', difficile: 'difficile', expert: 'experte' }

/** « 1,4 » : un chiffre après la virgule, à la française — et « 3 » quand il n'y en a pas. */
const dec = (x: number) => (Number.isInteger(x) ? formatNumber(x) : x.toFixed(1).replace('.', ','))
const pc = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`)
const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${formatNumber(n)} ${n > 1 ? motPluriel : mot}`

/** La chance d'un essai au seuil d'une règle : null tant que personne ne l'a tenté à ce seuil-là. */
export function parEssaiAuSeuil(p: StatsDuPalier, seuil: number): number | null {
  const x = p.seuils.find(c => c.seuil === seuil)
  return x && x.essais > 0 ? x.validees / x.essais : null
}

/**
 * Ce que la première ligne d'un palier dit de ceux qui l'ont tenté : combien
 * l'ont validé, et du premier coup, combien y restent bloqués et ce qu'ils y
 * ont laissé, puis ceux qui l'attendent sans l'avoir tenté. Celui qui échoue
 * garde sa place : « 0,0 vie perdue avant de valider » ne voyait que ceux
 * qui avaient validé (la remarque du propriétaire du 5 octobre 2026).
 */
export function progressionDuPalier(p: StatsDuPalier): string {
  const l = lectureDuPalier(p)
  const parties: string[] = []
  if (p.joueurs > 0) {
    parties.push(pluriel(p.joueurs, 'joueur'))
    if (p.valides === 0) parties.push('aucun ne l’a validé')
    else parties.push(`${formatNumber(p.valides)} l’${p.valides > 1 ? 'ont' : 'a'} validé${p.premierCoup > 0 ? `, ${formatNumber(p.premierCoup)} du premier coup` : ''}`)
    if (l.bloques > 0 && l.echecsParBloque !== null) {
      const echecs = l.echecsParBloque
      parties.push(`${pluriel(l.bloques, 'bloqué')} (${dec(echecs)} échec${echecs >= 2 ? 's' : ''}${l.bloques > 1 ? ' chacun' : ''})`)
    }
  }
  if (p.enAttente > 0) parties.push(`${formatNumber(p.enAttente)} l’attend${p.enAttente > 1 ? 'ent' : ''} sans l’avoir tenté`)
  return parties.length > 0 ? parties.join(' · ') : 'Aucune épreuve'
}

/**
 * Ce que la seconde ligne dit de l'effort : les essais et ce qu'il en faut
 * pour valider, la part de bonnes réponses — la difficulté sans le seuil —,
 * les abandons, la chance d'un essai aux seuils d'avant, et les rejeux à
 * part. Un palier repris des portraits d'avant, qu'un joueur joue pour la
 * première fois, est un rejeu : il ne paraissait nulle part.
 */
export function effortDuPalier(p: StatsDuPalier, seuilDuJour: number): string {
  const l = lectureDuPalier(p)
  const parties: string[] = []
  if (p.essais > 0) {
    parties.push(`${pluriel(p.essais, 'essai')}${l.essaisPourValider !== null ? `, ${dec(l.essaisPourValider)} pour valider` : ''}`)
    if (l.bonnesReponses !== null) parties.push(`${pc(l.bonnesReponses)} de bonnes réponses`)
    if (p.abandons > 0) parties.push(pluriel(p.abandons, 'abandon'))
    // Un seuil changé ne vaut que pour les épreuves d'après : les deux se lisent côte à côte.
    for (const x of p.seuils) {
      if (x.seuil !== seuilDuJour) parties.push(`à ${x.seuil}/${QUESTIONS_PAR_EPREUVE} : ${pc(x.validees / x.essais)} par essai (${pluriel(x.essais, 'essai')})`)
    }
  }
  if (p.rejeux === 1) parties.push(`1 rejeu, ${p.rejeuxValides === 1 ? 'validé' : 'raté'}`)
  else if (p.rejeux > 1) {
    const valides = p.rejeuxValides === 0 ? 'aucun validé' : `${formatNumber(p.rejeuxValides)} validé${p.rejeuxValides > 1 ? 's' : ''}`
    parties.push(`${formatNumber(p.rejeux)} rejeux, ${valides}`)
  }
  return parties.join(' · ')
}

/** Les marches, au pluriel : ce sont des questions. */
const MARCHES: Record<Niveau, string> = { facile: 'Faciles', moyen: 'Moyennes', difficile: 'Difficiles', expert: 'Expertes' }

/**
 * Les sentiers du savoir, palier par palier (`shared/sentiers.ts`), sur les
 * trois derniers mois, les rejeux à part : la chance d'un essai au seuil du
 * jour, qui l'a validé — du premier coup ou non —, qui y reste bloqué, ce
 * que les essais coûtent. Au-dessus, les bonnes réponses par marche, à côté
 * de ce que le calibrage suppose : une marche plus dure qu'annoncé fait un
 * mur que le calcul ne voyait pas. Dessous, les plus bloqués. Un palier
 * plus facile que celui d'avant se signale : c'est un mélange à revoir. Le
 * seuil se règle dans le code ; le mélange de chaque palier, ici même
 * (« Régler », le choix du 13 octobre 2026), pour les douze sentiers.
 */
function AdminSentiers() {
  const [branche, setBranche] = useState('')
  const [stats, setStats] = useState<AdminDesSentiers | null>(null)
  const [erreur, setErreur] = useState('')
  /** Le palier qu'on règle, son éditeur ouvert sous sa ligne. */
  const [reglant, setReglant] = useState<number | null>(null)
  const [relecture, setRelecture] = useState(0)
  useEffect(() => {
    let vivant = true
    setErreur('')
    api.admin
      .sentiers(branche || undefined)
      .then(s => vivant && setStats(s))
      .catch(e => vivant && setErreur(motifDe(e)))
    return () => {
      vivant = false
    }
  }, [branche, relecture])
  const melanges = stats ? melangesDesReglages(stats.reglages) : {}
  return (
    <section className="admin-groupe" aria-labelledby="campagne-sentiers-titre">
      <h2 className="compte-groupe" id="campagne-sentiers-titre">
        Les sentiers
      </h2>
      {erreur && <p className="error">{erreur}</p>}
      {stats && (
        <>
          <div className="sentiers-admin-tuiles">
            <span>
              <b>{formatNumber(stats.semaine.joueurs)}</b>
              {stats.semaine.joueurs > 1 ? 'joueurs' : 'joueur'}
            </span>
            <span>
              <b>{formatNumber(stats.semaine.epreuves)}</b>
              {stats.semaine.epreuves > 1 ? 'épreuves' : 'épreuve'}
            </span>
            <span>
              <b>{formatNumber(stats.semaine.paliersValides)}</b>
              {stats.semaine.paliersValides > 1 ? 'paliers validés' : 'palier validé'}
            </span>
            <span>
              <b>{formatNumber(stats.semaine.viesPerdues)}</b>
              {stats.semaine.viesPerdues > 1 ? 'vies perdues' : 'vie perdue'}
            </span>
            <span>
              <b>{formatNumber(stats.semaine.viesAchetees)}</b>
              {stats.semaine.viesAchetees > 1 ? 'vies achetées' : 'vie achetée'}
            </span>
          </div>
          <p className="muted small">
            Ces sept derniers jours, rejeux compris pour les joueurs et les épreuves. Les paliers, eux, se lisent sur trois mois ; un joueur y compte une fois par sentier. Un rejeu
            — un palier déjà validé, ou repris des portraits d’avant — se compte à part : il ne coûte pas de vie.
          </p>
        </>
      )}
      <label className="row">
        <span className="muted small">Sentier</span>
        <select className="team-emoji-select" value={branche} onChange={e => setBranche(e.target.value)}>
          <option value="">Tous les sentiers</option>
          {BRANCHES.map(b => (
            <option key={b.key} value={b.key}>
              {`${b.nom} · ${b.categorie}`}
            </option>
          ))}
        </select>
      </label>
      {stats && (
        <>
          {/* Les bonnes réponses par marche de question, à côté de ce que le calibrage suppose. */}
          <div className="sentiers-admin-marches" aria-label="Bonnes réponses par marche de question">
            {NIVEAUX.map(niveau => {
              const x = stats.niveaux.find(c => c.niveau === niveau)
              return (
                <span key={niveau}>
                  <b className="num">{pc(x && x.questions > 0 ? x.justes / x.questions : null)}</b>
                  {MARCHES[niveau]}
                  <small>{`${pc(TAUX_DU_CALIBRAGE[niveau])} au calcul · ${pluriel(x?.questions ?? 0, 'réponse')}`}</small>
                </span>
              )
            })}
          </div>
          <p className="muted small">
            Les bonnes réponses en épreuve, hors rejeux, par marche de question — le calibrage des paliers suppose les chiffres « au calcul », ceux d’un joueur moyen. Elles
            se mesurent sur ceux qui y répondent : les difficiles ne tombent qu’à partir du huitième palier, devant des joueurs déjà forts. En face de chaque palier, la
            chance d’un essai au seuil du jour ; la barre :<span className="sentiers-admin-legende sentiers-admin-premier">validé du premier coup</span>{' '}
            <span className="sentiers-admin-legende sentiers-admin-ensuite">validé ensuite</span> <span className="sentiers-admin-legende sentiers-admin-bloque">bloqué</span>.{' '}
            {espacesFines(
              branche
                ? 'Un mélange se règle pour les douze sentiers ensemble : « Tous les sentiers » ouvre « Régler » sur chaque palier.'
                : '« Régler » change le mélange d’un palier pour les douze sentiers : les épreuves qui commencent le tirent, celles en cours gardent leurs questions.',
            )}
          </p>
          <ol className="sentiers-admin-paliers">
            {stats.paliers.map((p, i) => {
              const regle = regleDuPalier(p.palier, melanges)!
              const reglage = stats.reglages.find(r => r.palier === p.palier)
              const parEssai = parEssaiAuSeuil(p, regle.seuil)
              const essaisAuSeuil = p.seuils.find(c => c.seuil === regle.seuil)?.essais ?? 0
              const avant = i > 0 ? stats.paliers[i - 1] : null
              const parEssaiAvant = avant ? parEssaiAuSeuil(avant, PALIERS[avant.palier - 1].seuil) : null
              const essaisAvant = avant?.seuils.find(c => c.seuil === PALIERS[avant.palier - 1].seuil)?.essais ?? 0
              // Plus facile que le palier d'avant, sur assez d'essais pour le croire : à revoir.
              const remonte = !regle.maitre && parEssai !== null && parEssaiAvant !== null && essaisAuSeuil >= 10 && essaisAvant >= 10 && parEssai > parEssaiAvant
              const l = lectureDuPalier(p)
              const largeur = (n: number) => `${p.joueurs > 0 ? (n / p.joueurs) * 100 : 0}%`
              const effort = effortDuPalier(p, regle.seuil)
              return (
                <li key={p.palier} className={'sentiers-admin-ligne' + (remonte ? ' sentiers-admin-alerte' : '') + (regle.maitre ? ' sentiers-admin-maitre' : '')}>
                  <b>{regle.maitre ? 'Maître' : `P${p.palier}`}</b>
                  {/* « Régler » à côté du mélange qu'il change : sur sa propre ligne, il doublait la hauteur de chaque palier. */}
                  <span className="sentiers-admin-melange">
                    <span className="muted">{`${texteDuMelangeCourt(regle.melange)} · ${regle.seuil}/${QUESTIONS_PAR_EPREUVE}`}</span>
                    {!regle.maitre && !branche && (
                      <button
                        type="button"
                        className="sentiers-admin-regler"
                        aria-expanded={reglant === p.palier}
                        aria-controls={`regler-p${p.palier}`}
                        onClick={() => setReglant(reglant === p.palier ? null : p.palier)}
                      >
                        <Icon name="edit" />
                        Régler
                        <span className="sr-only">{` le palier ${p.palier}`}</span>
                      </button>
                    )}
                  </span>
                  <span className="sentiers-admin-chance">
                    <b className="num">{pc(parEssai)}</b>
                    <small>par essai</small>
                  </span>
                  <span className="sentiers-admin-barre" aria-hidden="true">
                    <i className="sentiers-admin-premier" style={{ width: largeur(p.premierCoup) }} />
                    <i className="sentiers-admin-ensuite" style={{ width: largeur(p.valides - p.premierCoup) }} />
                    <i className="sentiers-admin-bloque" style={{ width: largeur(l.bloques) }} />
                  </span>
                  <span className="small sentiers-admin-infos">
                    {progressionDuPalier(p)}
                    {remonte && <span className="sentiers-admin-puce">{`plus facile que P${p.palier - 1}`}</span>}
                  </span>
                  {effort && <span className="muted small sentiers-admin-effort">{effort}</span>}
                  {reglage && (
                    <span className="small sentiers-admin-reglage">
                      <span className="sentiers-admin-puce">réglé au QG</span>{' '}
                      <span className="muted">{`le ${jourEnToutesLettres(jourDe(reglage.regleLe), true)} · d’origine ${texteDuMelangeCourt(PALIERS[p.palier - 1].melange)} · depuis : ${reglage.essais > 0 ? `${pluriel(reglage.essais, 'essai')}, ${pc(reglage.validees / reglage.essais)} par essai` : 'aucun essai encore'}`}</span>
                    </span>
                  )}
                  {reglant === p.palier && !branche && (
                    <ReglerLeMelange
                      id={`regler-p${p.palier}`}
                      stats={stats}
                      palier={p}
                      melanges={melanges}
                      onFermer={() => setReglant(null)}
                      onRegle={() => {
                        setReglant(null)
                        setRelecture(n => n + 1)
                      }}
                    />
                  )}
                </li>
              )
            })}
          </ol>
          {stats.reglages.length > 0 && (
            <p className="muted small">
              {`Un palier réglé au QG pose son mélange aux épreuves commencées depuis ; « depuis » dit ce qu’elles en ont fait — trois mois de chiffres mêlent l’ancien mélange et le nouveau.`}
            </p>
          )}
          <h3 className="sentiers-admin-sous-titre">Les plus bloqués</h3>
          {stats.bloques.length === 0 ? (
            <p className="muted small">Personne n’a encore raté deux fois le palier qui l’attend.</p>
          ) : (
            <>
              <p className="muted small">Ceux qui ont le plus d’échecs sur le palier qui les attend, abandons compris — le maître à part, il est facultatif.</p>
              <ul className="sentiers-admin-bloques">
                {stats.bloques.map(x => {
                  const b = BRANCHES.find(c => c.key === x.branche)
                  return (
                    <li key={`${x.profileId}|${x.branche}`}>
                      {/* Son prénom ouvre sa fiche, où « Libérer l'épreuve » l'attend. */}
                      <PrenomDuJoueur id={x.prenom ? x.profileId : null} nom={x.prenom ?? 'Profil supprimé'} />
                      <span className="muted">{`${b?.nom ?? x.branche} · P${x.palier} · ${pluriel(x.echecs, 'échec')} · dernier échec ${quand(x.dernier)}`}</span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  )
}

type Marche = (typeof MARCHES_D_UN_PALIER)[number]

/**
 * Régler le mélange d'un palier (le choix du 13 octobre 2026 : « régler la
 * difficulté des paliers en fonction de ce que je vois ») : combien de
 * faciles, de moyennes, de difficiles — seize en tout, jamais d'experte —, la
 * difficulté que les joueurs liront, et la chance d'un essai qu'il donnerait,
 * estimée sur ce que les joueurs de ce palier trouvent vraiment
 * (`estimationDuMelange`). Il vaut pour les douze sentiers, aux épreuves qui
 * commencent ; « Revenir au mélange d'origine » le défait.
 */
function ReglerLeMelange({
  id,
  stats,
  palier: p,
  melanges,
  onFermer,
  onRegle,
}: {
  id: string
  stats: AdminDesSentiers
  palier: StatsDuPalier
  melanges: MelangesRegles
  onFermer: () => void
  onRegle: () => void
}) {
  const regle = regleDuPalier(p.palier, melanges)!
  const duCode = PALIERS[p.palier - 1]
  const reglage = stats.reglages.find(r => r.palier === p.palier)
  const [brouillon, setBrouillon] = useState(() => Object.fromEntries(MARCHES_D_UN_PALIER.map(m => [m, regle.melange[m] ?? 0])) as Record<Marche, number>)
  const [occupe, setOccupe] = useState(false)
  const total = MARCHES_D_UN_PALIER.reduce((n, m) => n + brouillon[m], 0)
  const complet = total === QUESTIONS_PAR_EPREUVE
  // D'où partir : les épreuves depuis le réglage, s'il y en a assez ; sinon les trois mois, joués pour l'essentiel sous le mélange d'origine.
  const depuis = reglage && reglage.essais >= ESSAIS_POUR_CROIRE ? reglage : null
  const reference = depuis
    ? { melange: depuis.melange, parEssai: depuis.validees / depuis.essais, essais: depuis.essais }
    : { melange: duCode.melange, parEssai: parEssaiAuSeuil(p, regle.seuil), essais: p.seuils.find(c => c.seuil === regle.seuil)?.essais ?? 0 }
  const estimation = complet ? estimationDuMelange(reference, brouillon, regle.seuil, stats.niveauxParPalier.filter(x => x.palier === p.palier)) : null
  // Un palier plus facile que celui d'avant, ou plus dur que le suivant : la difficulté lue ne monterait plus d'un palier à l'autre.
  const voisin = (n: number) => (n >= 1 && n < PALIER_DU_MAITRE ? regleDuPalier(n, melanges) : null)
  const avant = voisin(p.palier - 1)
  const apres = voisin(p.palier + 1)
  const marche = marcheMoyenne(brouillon)

  const regler = async (vers: Melange | null) => {
    const texte = texteDuMelange(vers ?? duCode.melange)
    const ok = await confirmDialog({
      title: vers ? `Régler le palier ${p.palier} ?` : `Rendre au palier ${p.palier} son mélange d’origine ?`,
      message: `Sur les douze sentiers, les épreuves qui commencent poseront ${texte}. Celles en cours gardent leurs questions, et aucun palier validé ne se reprend.`,
      confirmLabel: vers ? 'Régler' : 'Revenir à l’origine',
    })
    if (!ok) return
    setOccupe(true)
    try {
      await api.admin.reglerLeMelange(p.palier, vers)
      showToast({ kind: 'info', message: vers ? `Palier ${p.palier} réglé : ${texte}` : `Palier ${p.palier} rendu à son mélange d’origine : ${texte}` })
      onRegle()
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(false)
    }
  }

  return (
    <div className="sentiers-admin-editeur" id={id}>
      <p className="small">
        <b>{`Le mélange du palier ${p.palier}`}</b> <span className="muted">— seize questions, jamais d’experte, pour les douze sentiers</span>
      </p>
      <ul className="sentiers-admin-reglables">
        {MARCHES_D_UN_PALIER.map(m => (
          <li key={m}>
            <span>{MARCHES[m]}</span>
            <button
              type="button"
              className="btn btn-small"
              aria-label={`Une ${QUESTION_DE_NIVEAU[m]} de moins`}
              disabled={occupe || brouillon[m] === 0}
              onClick={() => setBrouillon(b => ({ ...b, [m]: b[m] - 1 }))}
            >
              −
            </button>
            <output className="num" aria-live="polite">
              {brouillon[m]}
            </output>
            <button
              type="button"
              className="btn btn-small"
              aria-label={`Une ${QUESTION_DE_NIVEAU[m]} de plus`}
              disabled={occupe || total >= QUESTIONS_PAR_EPREUVE}
              onClick={() => setBrouillon(b => ({ ...b, [m]: b[m] + 1 }))}
            >
              +
            </button>
          </li>
        ))}
      </ul>
      <p className="small">
        {espacesFines(
          complet
            ? `${QUESTIONS_PAR_EPREUVE} questions · les joueurs liront « ${difficulteDuMelange(brouillon)} »`
            : `${total} sur ${QUESTIONS_PAR_EPREUVE} : encore ${pluriel(QUESTIONS_PAR_EPREUVE - total, 'question')} à placer`,
        )}
      </p>
      {estimation && (
        <p className="small">
          {estimation.sur === 'mesures'
            ? `${pc(reference.parEssai)} par essai mesurés${depuis ? ' depuis le réglage' : ''} · environ ${pc(estimation.chance)} avec ce mélange`
            : `Au calcul, pour un joueur moyen : ${pc(estimation.chance)} par essai — trop peu d’épreuves sur ce palier pour l’estimer sur les vraies.`}
        </p>
      )}
      {complet && avant && marche < marcheMoyenne(avant.melange) && (
        <p className="small sentiers-admin-avertissement">{`Plus facile que le palier ${p.palier - 1} (${texteDuMelangeCourt(avant.melange)}) : la difficulté redescendrait d’un palier à l’autre.`}</p>
      )}
      {complet && apres && marche > marcheMoyenne(apres.melange) && (
        <p className="small sentiers-admin-avertissement">{`Plus dur que le palier ${p.palier + 1} (${texteDuMelangeCourt(apres.melange)}).`}</p>
      )}
      <div className="admin-gestes">
        <button type="button" className="btn btn-small btn-primary" disabled={occupe || !complet || memeMelange(brouillon, regle.melange)} onClick={() => void regler(brouillon)}>
          Appliquer
        </button>
        {reglage && (
          <button type="button" className="btn btn-small" disabled={occupe} onClick={() => void regler(null)}>
            Revenir au mélange d’origine
          </button>
        )}
        <button type="button" className="btn btn-small btn-ghost" disabled={occupe} onClick={onFermer}>
          Fermer
        </button>
      </div>
    </div>
  )
}
