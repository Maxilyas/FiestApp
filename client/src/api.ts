import type {
  AdminDeLaCampagne,
  AmisDeLaFeuille,
  ChoixDeLaCampagne,
  CorrectionDeCampagne,
  CorrectionDeQuestion,
  DefiDeLaSemaine,
  DuelEntreAmis,
  MesAmis,
  EtatDeCampagne,
  FinDeSerie,
  MesRencontres,
  QuestionCorrigee,
  RencontreDeCampagne,
  ReponseDeCampagne,
  ResumeDuDuel,
  SerieDeCampagne,
} from '../../shared/campagne'
import type { AdminDesSentiers, EpreuveDeSentier, EtatDesSentiers, FinDEpreuve, Melange, ReponseDEpreuve } from '../../shared/sentiers'
import type { EtatDuCarnet, FaitAppris } from '../../shared/revision'
import type { ApresUnGeste, ArticleDeLEchoppe, GesteDExpedition, PageDeLExpedition, ReponseDExpedition, VueDeLExpedition } from '../../shared/expedition'
import type { CleDeFiole } from '../../shared/rencontres'
import type { EpreuveDeSujet, EtatDesSujets, ReponseDuSujet } from '../../shared/sentiersDeSujets'
import type { MemoireDuQuiz, QuizDef, QuizQuestionDef, QuizSummary } from '../../shared/library'
import type { ArchiveSummary } from '../../shared/archive'
import type { ModeleResume, PourQui } from '../../shared/modeles'
import type { ApercuDuQuiz, BaseDuQuizToutPret, ChoixDuQuiz } from '../../shared/quizToutPret'
import type { ReglagesDuQuiz } from '../../shared/hasard'
import type { EntreeDeProgramme, Programme } from '../../shared/programme'
import type { EquipePreparee } from '../../shared/teams'
import type { EntreeDuCatalogue, StatutAuCatalogue } from '../../shared/partage'
import type { EspaceDAdministration, PublicAccount, PublicSpace, SpaceSettings } from '../../shared/space'
import type { FicheDuJoueur, FinitionChoisie, ProfilDAccueil, ProfilDAdministration, ProfilDeLEspace, PublicProfile, PublicProfileDetail } from '../../shared/profil'
import { MOTIFS, echecPassager, motifEchec, motifHttp, statutPassager } from '../../shared/erreurs'
import { enAttendantLeReveil, type Attente } from '../../shared/reveil'
import type { ClassementDuJour, PartieDuJour, ReglagesDesNotifications, RevelationDuJour } from '../../shared/jour'
import type { BoutiqueDuProfil, SoldeDeConfettis } from '../../shared/themes'
import type { NouveautesDeLaLoge, VusDeLaLoge } from '../../shared/piecesDeLaLoge'
import type { MissionsDuJour } from '../../shared/missions'
import type { CoffreOuvert } from '../../shared/coffre'
import type { CompagnonAcquis } from '../../shared/compagnons'
import type { EnjeuDuDuel, EtatDesDuels, FaceAFace, JoueurADefier, JoueurCroise, PageDHistoire } from '../../shared/duels'
import type { DirectDuQg, JournalDuQg, PageDesSoirees, SorteDeGeste, VueDEnsemble } from '../../shared/qg'
import type { PageDuServeur } from '../../shared/santeDuServeur'
import type { EtatDUnePage, EtatDeLaMaintenance, PageEnMaintenance } from '../../shared/maintenance'
import type { SuiviDuJour } from '../../shared/qgDuJour'
import type { SuiviDeLaCampagne } from '../../shared/qgCampagne'
import type { SuiviDesDuels } from '../../shared/qgDuels'
import type { PageDeLEconomie } from '../../shared/qgEconomie'
import type { PageDeLActivite } from '../../shared/qgActivite'
import type { Classement, PageDesSignalements } from '../../shared/qgSignalements'
import { applySample, mesureDeLaReponse, tempsDuPrechargement } from './clock'
import { DEPART } from '../../shared/depart'

/**
 * Une erreur d'API qui porte ce que le serveur a joint au message.
 *
 * Pour l'instant une seule chose y voyage : l'identifiant libre proposé quand
 * celui qu'on voulait est pris. Sans lui, une invitée qui n'y connaît rien
 * resterait devant un refus qu'elle ne sait pas contourner.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly suggestion?: string,
    /** Un échec qui passe tout seul — l'hébergeur qui se réveille : une écriture peut l'attendre (`auReveil`). */
    readonly passager = false,
    /** Le statut HTTP, quand le serveur a répondu ; rien quand la requête n'est pas revenue. */
    readonly statut?: number,
  ) {
    super(message)
  }
}

/**
 * Le serveur a lu la demande et la refuse (un 4xx) : la refaire telle quelle
 * recevrait le même refus. Le contraire d'un réseau coupé ou d'un serveur qui
 * redémarre, où retoucher finit par passer.
 */
export const refusDuServeur = (e: unknown): boolean => e instanceof ApiError && e.statut !== undefined && e.statut < 500

/**
 * Session absente ou périmée — ou identifiants refusés : l'appelant renvoie
 * vers la connexion. Le message est celui du serveur, qui sait faire la
 * différence entre les deux.
 */
export class UnauthorizedError extends ApiError {}

/**
 * Le quiz a été enregistré ailleurs depuis que les modifications en cours
 * sont parties — l'autre appareil. `updatedAt` : la version qu'il a laissée,
 * d'où repartir pour garder la sienne quand même.
 */
export class ConflitError extends ApiError {
  constructor(
    message: string,
    readonly updatedAt: number,
  ) {
    super(message, undefined, false, 409)
  }
}

/**
 * Ce qu'on montre d'un échec : le motif du serveur, ou l'un des nôtres, qui
 * disent quoi faire. Jamais le texte d'une exception du navigateur — il est
 * en anglais, et il ne dit rien à un invité.
 */
export const motifDe = (e: unknown): string => (e instanceof ApiError ? e.message : MOTIFS.imprevu)

/**
 * Au-delà, la requête est abandonnée. Sans délai, un réseau qui avale les
 * paquets sans rien refuser laissait « Me connecter » grisé pendant des
 * minutes, et l'invité ne savait pas qu'il pouvait réessayer. Large quand
 * même : la 4G d'une salle bondée, et un hébergeur qui se réveille.
 */
const DELAI_REQUETE_MS = 20_000

/** Le corps lu comme du JSON — `undefined` s'il n'en est pas. */
function lireJson(texte: string): unknown {
  try {
    return JSON.parse(texte)
  } catch {
    return undefined
  }
}

/**
 * Toute requête part avec le cookie de session — le navigateur s'en charge —
 * et un en-tête maison que seule cette page peut poser : une page tierce qui
 * tenterait une écriture à notre place serait refusée avant d'être lue.
 *
 * Ce qu'elle lève se montre tel quel à l'invité : un message du serveur, ou
 * l'un des `MOTIFS` — jamais le texte anglais du navigateur.
 */
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const abandon = new AbortController()
  const minuteur = setTimeout(() => abandon.abort(), DELAI_REQUETE_MS)
  let res: Response
  let texte: string
  try {
    res = await fetch(path, {
      ...init,
      signal: abandon.signal,
      credentials: 'same-origin',
      // Du JSON s'annonce avec un corps, et seulement avec lui : une lecture
      // qui s'annonçait en JSON invitait le serveur à lire un corps qu'elle
      // n'a pas — « Requête illisible » au QG, le 14 octobre 2026.
      headers: { ...(init?.body != null && { 'Content-Type': 'application/json' }), 'X-Requested-With': 'quizz', ...init?.headers },
    })
    // Le corps se lit sous le même délai : une réponse qui arrive au
    // compte-gouttes n'est pas une réponse.
    texte = await res.text()
  } catch (e) {
    throw new ApiError(motifEchec(e), undefined, echecPassager(e))
  } finally {
    clearTimeout(minuteur)
  }
  const corps = lireJson(texte)
  // Le motif du serveur d'abord : un mot de passe faux n'est pas une session
  // expirée, et le dire « Connexion requise » faisait chercher ailleurs.
  if (res.status === 401) throw new UnauthorizedError(motifHttp(401, corps), undefined, false, 401)
  const conflit = (corps as { conflit?: { updatedAt?: unknown } } | undefined)?.conflit
  if (res.status === 409 && typeof conflit?.updatedAt === 'number') {
    throw new ConflitError(motifHttp(409, corps), conflit.updatedAt)
  }
  if (!res.ok) {
    const suggestion = (corps as { suggestion?: unknown } | undefined)?.suggestion
    throw new ApiError(
      motifHttp(res.status, corps),
      typeof suggestion === 'string' ? suggestion : undefined,
      statutPassager(res.status),
      res.status,
    )
  }
  if (corps === undefined) throw new ApiError(MOTIFS.illisible)
  return corps as T
}

/** Qui est connecté, son espace, et le profil joueur qu'il y a rattaché. */
export interface Me {
  account: PublicAccount
  space: PublicSpace
  /** Le profil qui tient l'espace, tel que « Mon compte » le montre. */
  profil?: ProfilDeLEspace | null
}

/** Un lien d'activation : le jeton et sa date limite. */
export interface Activation {
  token: string
  expiresAt: number
}

/** L'adresse à envoyer : le jeton voyage dans le fragment, que le navigateur garde pour lui. */
export const activationUrl = (token: string) => `${window.location.origin}/activer#t=${token}`

/** Un geste de l'expédition, avec le rang qu'il croit suivre : un double toucher ne joue pas deux fois. */
const gesteDExpedition = (id: string, rang: number, geste: GesteDExpedition) =>
  req<ApresUnGeste>(`/api/expedition/${encodeURIComponent(id)}/geste`, { method: 'POST', body: JSON.stringify({ rang, geste }) })

/**
 * Les mots d'un dévoilement de l'expédition, à mesure que le serveur les
 * dit : une réponse qui s'écrit mot à mot, un par ligne — jamais l'intitulé
 * entier d'avance (invariant 1). `recevoir` reçoit à chaque fois tous les
 * mots dits ; la promesse se tient au dernier, ou à l'abandon (`signal`).
 */
async function lireLeDevoilement(id: string, position: number, recevoir: (mots: string[]) => void, signal: AbortSignal): Promise<void> {
  const r = await fetch(`/api/expedition/${encodeURIComponent(id)}/devoilement?position=${position}`, { signal, cache: 'no-store' })
  if (!r.ok || !r.body) throw new Error('Le texte ne se dévoile pas : recharge la page')
  const lecteur = r.body.getReader()
  const decodeur = new TextDecoder()
  const mots: string[] = []
  let reste = ''
  for (;;) {
    const { value, done } = await lecteur.read()
    if (done) return
    reste += decodeur.decode(value, { stream: true })
    const lignes = reste.split('\n')
    reste = lignes.pop() ?? ''
    if (lignes.length > 0) {
      mots.push(...lignes)
      recevoir([...mots])
    }
  }
}

export const api = {
  list: () => req<QuizSummary[]>(DEPART.quiz),
  /** Les quiz qui contiennent ces mots — titre, intitulés, réponses. */
  chercher: (q: string) => req<QuizSummary[]>(`/api/quizzes?q=${encodeURIComponent(q)}`),
  /** Range un quiz à l'écart (hors de la liste et du choix de la soirée), ou l'en ressort. */
  archiver: (id: string, archive: boolean) =>
    req<{ ok: true }>(`/api/quizzes/${id}/archive`, { method: 'POST', body: JSON.stringify({ archive }) }),
  get: (id: string) => req<QuizDef>(`/api/quizzes/${id}`),
  /** Ce que l'historique sait du quiz et de chacune de ses questions : « réussie par 23 % le 14 mars ». */
  memoire: (id: string) => req<MemoireDuQuiz>(`/api/quizzes/${id}/memoire`),
  create: (title: string, questions?: unknown[], reglages?: ReglagesDuQuiz) =>
    req<QuizDef>('/api/quizzes', { method: 'POST', body: JSON.stringify({ title, questions, reglages }) }),
  /**
   * `base` : la version d'où partent les modifications — le serveur refuse
   * (`ConflitError`) si le quiz a été enregistré ailleurs depuis. `jeton` :
   * le même pour tous les essais d'un même « Enregistrer », pour qu'un essai
   * rejoué au réveil n'entre pas en conflit avec celui qui était passé.
   * `essai` : son numéro, qui croît d'un essai à l'autre — un essai abandonné
   * qui n'arrive qu'après le suivant ne réécrit pas son ancien texte.
   */
  save: (
    id: string,
    title: string,
    questions: QuizQuestionDef[],
    base?: number,
    jeton?: string,
    essai?: number,
    reglages?: ReglagesDuQuiz,
  ) =>
    req<QuizDef>(`/api/quizzes/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title, questions, base, jeton, essai, reglages }),
    }),
  remove: (id: string) => req<{ ok: true }>(`/api/quizzes/${id}`, { method: 'DELETE' }),
  duplicate: (id: string) => req<QuizDef>(`/api/quizzes/${id}/duplicate`, { method: 'POST' }),
  /** Les quiz livrés avec l'application, et la copie de l'un d'eux dans son espace. */
  modeles: () => req<ModeleResume[]>('/api/modeles'),
  /** Une copie du modèle — personnalisée, s'il le demande et qu'on a répondu à « Pour qui ? ». */
  partirDe: (modele: string, pourQui?: PourQui) =>
    req<QuizDef>(`/api/modeles/${encodeURIComponent(modele)}`, { method: 'POST', body: JSON.stringify(pourQui ?? {}) }),
  /** Un quiz tout prêt, tiré de la base de la campagne (`shared/quizToutPret.ts`) : ce qu'elle offre, puis le quiz composé. */
  quizToutPret: {
    base: () => req<BaseDuQuizToutPret>('/api/quiz-tout-pret'),
    composer: (choix: ChoixDuQuiz) => req<QuizDef>('/api/quiz-tout-pret', { method: 'POST', body: JSON.stringify(choix) }),
    /** Ce qu'un choix composerait, sans rien ranger : combien de questions, dont combien d'estimations. */
    apercu: (choix: ChoixDuQuiz) => req<ApercuDuQuiz>('/api/quiz-tout-pret/apercu', { method: 'POST', body: JSON.stringify(choix) }),
    /** « Une autre » : la voisine d'une question tirée de la base, hors du quiz tel que l'éditeur l'a (`quiz`). */
    uneAutre: (corps: { id: string; kind: QuizQuestionDef['kind']; quiz: string[] }) =>
      req<QuizQuestionDef>('/api/quiz-tout-pret/une-autre', { method: 'POST', body: JSON.stringify(corps) }),
  },
  uploadImage: (dataUrl: string) =>
    req<{ url: string }>('/api/images', { method: 'POST', body: JSON.stringify({ dataUrl }) }),
  /** Partager : un code à un animateur de ce serveur, une copie au catalogue (`shared/partage.ts`). */
  partage: {
    /** Un code neuf, valable sept jours, sur le quiz tel qu'il est maintenant. */
    creer: (quizId: string) => req<{ code: string; expiresAt: number }>(`/api/quizzes/${quizId}/partage`, { method: 'POST' }),
    revoquer: (code: string) => req<{ ok: true }>(`/api/partages/${encodeURIComponent(code)}`, { method: 'DELETE' }),
    /** La copie du quiz qu'un code désigne, rangée dans sa bibliothèque. */
    recevoir: (code: string) => req<QuizDef>('/api/partages/recevoir', { method: 'POST', body: JSON.stringify({ code }) }),
    proposer: (quizId: string, description: string) =>
      req<EntreeDuCatalogue>(`/api/quizzes/${quizId}/catalogue`, { method: 'POST', body: JSON.stringify({ description }) }),
    /** Les copies publiées au catalogue du serveur. */
    catalogue: () => req<EntreeDuCatalogue[]>('/api/catalogue'),
    partirDuCatalogue: (id: string) => req<QuizDef>(`/api/catalogue/${encodeURIComponent(id)}`, { method: 'POST' }),
  },
  /** Les programmes de soirée : les quiz de ce soir, dans l'ordre, chacun avec son multiplicateur. */
  programmes: {
    list: () => req<Programme[]>('/api/programmes'),
    /** Commence un programme, qui devient celui de ce soir. */
    creer: (titre: string, entrees: EntreeDeProgramme[] = []) =>
      req<Programme>('/api/programmes', { method: 'POST', body: JSON.stringify({ titre, entrees }) }),
    modifier: (id: string, patch: { titre?: string; entrees?: EntreeDeProgramme[] }) =>
      req<Programme>(`/api/programmes/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    /** En fait le programme de ce soir — ou le range, avec `actif` à faux. */
    activer: (id: string, actif: boolean) =>
      req<{ ok: true }>(`/api/programmes/${id}/activer`, { method: 'POST', body: JSON.stringify({ actif }) }),
    supprimer: (id: string) => req<{ ok: true }>(`/api/programmes/${id}`, { method: 'DELETE' }),
  },
  /** L'historique des soirées : le lire est public, le retoucher demande d'être connecté. */
  archives: {
    rename: (id: string, title: string) =>
      req<ArchiveSummary>(`/api/soirees/${id}`, { method: 'PUT', body: JSON.stringify({ title }) }),
    remove: (id: string) => req<{ ok: true }>(`/api/soirees/${id}`, { method: 'DELETE' }),
  },
  /** Se connecter, activer son compte, changer de mot de passe. */
  auth: {
    me: () => req<Me>(DEPART.console),
    login: (login: string, password: string) =>
      req<Me>('/api/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }),
    logout: () => req<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
    /** Ce qu'ouvre un lien d'activation, sans le consommer. */
    lireActivation: (token: string) =>
      // Le compte ne vient qu'avec un lien encore valide.
      req<
        | { login: string; name: string; slug: string; etat: 'valide' }
        | { login?: undefined; name?: undefined; slug?: undefined; etat: 'servi' | 'perime' }
      >('/api/auth/activation', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    activate: (token: string, password: string) =>
      req<Me>('/api/auth/activate', { method: 'POST', body: JSON.stringify({ token, password }) }),
    changePassword: (current: string, next: string) =>
      req<{ ok: true }>('/api/auth/password', { method: 'POST', body: JSON.stringify({ current, next }) }),
    /** La télé sans session demande un code à afficher, et le jeton qui l'attend. */
    appairage: () => req<{ code: string; jeton: string; expireA: number }>('/api/auth/appairage', { method: 'POST', body: '{}' }),
    /**
     * La télé attend : `attente` tant que personne n'a validé, `ok` quand sa
     * session est posée, `perime` quand il lui faut un code neuf.
     */
    attenteAppairage: (jeton: string) =>
      req<{ attente?: true; ok?: true; perime?: true }>('/api/auth/appairage/attente', { method: 'POST', body: JSON.stringify({ jeton }) }),
    /** Le téléphone connecté valide le code affiché par la télé. */
    validerAppairage: (code: string) =>
      req<{ ok: true }>('/api/auth/appairage/valider', { method: 'POST', body: JSON.stringify({ code }) }),
  },
  /**
   * Le profil d'un joueur récurrent. Rien ici n'est nécessaire pour jouer :
   * l'invité anonyme ne passe par aucune de ces routes et ne perd rien.
   */
  joueur: {
    /**
     * Sa propre page : le détail complet, étagère à badges et historique.
     * Sans cookie, rend `null` — ce n'est pas une erreur, c'est un invité.
     * `espace` est la soirée qu'anime ce profil, s'il en anime une ;
     * `enCours`, celles où il joue en ce moment.
     */
    moi: () =>
      req<{
        profile: PublicProfileDetail | null
        espace: PublicSpace | null
        /** Les soirées en cours où ce profil est inscrit. Absent d'un serveur d'avant. */
        enCours?: { nom: string; slug: string }[]
      }>(DEPART.moi),
    /**
     * Ce qu'une page de jeu montre de lui — prénom, niveau, thème —, sans le
     * détail : le quiz du jour et la campagne n'attendent plus son historique
     * pour ouvrir leur partie. Sans cookie, `null`.
     */
    moiLeger: () => req<{ profile: PublicProfile | null }>(DEPART.moiLeger),
    /** L'accueil : l'en-tête, sa carrière au quiz du jour et son solde — la soirée en cours et l'espace aussi, comme `moi`. */
    moiAccueil: () =>
      req<{ profile: ProfilDAccueil | null; espace: PublicSpace | null; enCours?: { nom: string; slug: string }[] }>(DEPART.moiAccueil),
    connexion: (login: string, password: string) =>
      req<{ profile: PublicProfile; espace: PublicSpace | null }>('/api/joueur/connexion', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      }),
    /** Rend le code de secours — la seule fois où il existe en clair. */
    inscription: (input: { login: string; password: string; name: string; avatar: string }) =>
      req<{ profile: PublicProfile; espace: PublicSpace | null; recovery: string }>('/api/joueur/inscription', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    /** L'espace du profil (créé la première fois) et sa console ouverte ici, sans ouvrir le salon. */
    espace: () => req<{ espace: PublicSpace; nouveau: boolean }>('/api/joueur/espace', { method: 'POST' }),
    /** « Ouvrir le salon » : l'espace du profil, sa console ouverte ici, et le code du salon — avec ses équipes préparées, s'il en a. */
    salon: (corps: { equipes?: EquipePreparee[] } = {}) =>
      req<{ espace: PublicSpace; code: string | null; nouveau: boolean }>('/api/joueur/salon', { method: 'POST', body: JSON.stringify(corps) }),
    deconnexion: () => req<{ ok: true }>('/api/joueur/deconnexion', { method: 'POST' }),
    /** Ce qu'il a de neuf à porter, compté : la pastille rouge de « Profil » — rien sans profil. */
    nouveautes: () => req<NouveautesDeLaLoge>('/api/joueur/nouveautes'),
    /**
     * Le compagnon de sa niche et où il en est, et tous les siens — sa fiche,
     * ouverte au toucher de la niche ; null et rien sans compagnon. Un serveur
     * d'avant ne dit que le premier.
     */
    niche: () => req<{ niche: CompagnonAcquis | null; compagnons?: CompagnonAcquis[] }>('/api/joueur/niche'),
    /** Ce qu'il règle d'un de ses compagnons, depuis sa niche : son nom (vide, il n'en a plus), la forme qu'il y montre (null : sa plus haute). */
    reglerCompagnon: (compagnon: string, reglage: { nom?: string; montree?: number | null }) =>
      req<{ profile: PublicProfile }>(`/api/joueur/compagnons/${encodeURIComponent(compagnon)}`, { method: 'PUT', body: JSON.stringify(reglage) }),
    /** Ce qu'il vient de voir dans sa loge, retenu pour tous ses appareils. */
    retenirLesVus: (vus: VusDeLaLoge) => req<{ ok: true }>('/api/joueur/vus', { method: 'PUT', body: JSON.stringify({ vus }) }),
    /** Ses missions du jour : tirées à sa première visite, ce qui vient d'être fait retenu et dit (`nouvelles`). */
    missions: () => req<MissionsDuJour>(DEPART.missions),
    /**
     * Ouvrir le coffre d'une semaine passée : le tirage se fait une fois. Pas
     * de reprise au réveil du serveur : rejouée, l'ouverture redonnerait le
     * même objet — le geste se refait d'un toucher.
     */
    ouvrirLeCoffre: (semaine: string) => req<{ coffre: CoffreOuvert }>('/api/joueur/coffre', { method: 'POST', body: JSON.stringify({ semaine }) }),
    enregistrer: (patch: {
      name?: string
      avatar?: string
      finition?: FinitionChoisie
      legendaire?: string | null
      titre?: string | null
      vitrine?: string[] | null
      fond?: string | null
      theme?: string | null
      gerbe?: string | null
      eclat?: { cle: string; brille: boolean }
      /** Le compagnon de sa niche, parmi ceux qu'il a adoptés ; null : la règle (`compagnonDeLaNiche`). */
      niche?: string | null
    }) =>
      req<{ profile: PublicProfile }>('/api/joueur/moi', { method: 'PUT', body: JSON.stringify(patch) }),
    /**
     * Acheter un thème en confettis, et le porter aussitôt — ou le garder pour
     * plus tard (`porter: false`). Pas de reprise au réveil du serveur :
     * rejoué, un achat passé répondrait « déjà à toi ». La boutique revient
     * telle que le serveur l'a comptée.
     */
    acheterTheme: (theme: string, porter = true) =>
      req<{ profile: PublicProfile; boutique: BoutiqueDuProfil }>('/api/joueur/themes', {
        method: 'POST',
        body: JSON.stringify({ theme, porter }),
      }),
    /** Adopter un compagnon, à sa première forme : il s'installe dans sa niche, ou attend son tour (`installer: false`). Il ne se porte que dans la loge. */
    acheterCompagnon: (compagnon: string, installer = true) =>
      req<{ profile: PublicProfile; boutique: BoutiqueDuProfil }>('/api/joueur/compagnons', {
        method: 'POST',
        body: JSON.stringify({ compagnon, installer }),
      }),
    /** Acheter un fond des savoirs — le porter aussitôt, ou le garder pour plus tard. Ses fonds reviennent relus, le nouveau compris. */
    acheterFond: (fond: string, porter = true) =>
      req<{ profile: PublicProfile; boutique: BoutiqueDuProfil; fond: string | null; fonds: string[] }>('/api/joueur/fonds', {
        method: 'POST',
        body: JSON.stringify({ fond, porter }),
      }),
    /**
     * Changer son mot de passe : il faut l'actuel, ou le code de secours pour
     * qui l'a oublié. La session seule ne suffit pas — un téléphone se prête
     * en soirée. Par le code, la réponse porte le neuf : c'est la seule fois
     * où il existe en clair, et la page doit le montrer.
     */
    motDePasse: (preuve: { current?: string; code?: string; next: string }) =>
      req<{ ok: true; recovery?: string }>('/api/joueur/mot-de-passe', { method: 'POST', body: JSON.stringify(preuve) }),
    /** Le code de secours se consomme : on en rend un neuf. */
    secours: (login: string, code: string, password: string) =>
      req<{ recovery: string; profile: PublicProfile | null; espace?: PublicSpace | null }>('/api/joueur/secours', {
        method: 'POST',
        body: JSON.stringify({ login, code, password }),
      }),
  },
  /**
   * Le quiz du jour, pour les profils : une partie par jour, chronométrée
   * par le serveur. Chaque réponse du serveur remesure l'heure : le chrono
   * d'une question se lit à l'heure du serveur (invariant 6), et ce
   * téléphone-là n'a pas de liaison temps réel pour la mesurer.
   */
  /** La campagne solo : une série qui monte en difficulté, trois vies (`shared/campagne.ts`). */
  campagne: {
    etat: () => req<EtatDeCampagne>(DEPART.campagne),
    /** Ses catégories et ses sujets jouables, les mêmes pour tous : ce que la préparation d'un duel propose. */
    choix: () => req<ChoixDeLaCampagne>('/api/campagne/choix'),
    /** Une série neuve : sur ces catégories (aucune : toutes), ou sur un sujet qui les traverse (`shared/sujets.ts`). */
    commencer: (categories: string[], sujet?: string | null) =>
      req<SerieDeCampagne>('/api/campagne/serie', { method: 'POST', body: JSON.stringify({ categories, ...(sujet && { sujet }) }) }),
    repondre: (serie: string, index: number, choix: number) =>
      req<ReponseDeCampagne>(`/api/campagne/serie/${encodeURIComponent(serie)}/reponse`, { method: 'POST', body: JSON.stringify({ index, choix }) }),
    correction: (serie: string) => req<CorrectionDeCampagne[]>(`/api/campagne/serie/${encodeURIComponent(serie)}/correction`),
    /** « Recommencer » : la série finit là, comme perdue — son record et ses hauts faits lus sur ce qu'elle a joué. */
    abandonner: (serie: string) => req<FinDeSerie>(`/api/campagne/serie/${encodeURIComponent(serie)}/abandon`, { method: 'POST' }),
    /** « Signaler une erreur » sur une question déjà jouée de la série. */
    signaler: (serie: string, index: number, texte: string) =>
      req<{ ok: true }>(`/api/campagne/serie/${encodeURIComponent(serie)}/signalement`, { method: 'POST', body: JSON.stringify({ index, texte }) }),
    /**
     * Le défi de la semaine : une série d'un autre mode — ses réponses, sa
     * correction et ses signalements passent par celles de la série.
     */
    defi: () => req<DefiDeLaSemaine>('/api/campagne/defi'),
    releverLeDefi: () => req<SerieDeCampagne>('/api/campagne/defi', { method: 'POST' }),
    /** Le défi entre amis : le lancer (et jouer sa propre tentative), le relire par son code, le relever, retrouver les siens. */
    duel: {
      /**
       * Le lancer : ses catégories ou son sujet, et contre qui — un duel
       * classé, qui lui part à sa dernière réponse (`adversaire`) ; d'une page
       * d'avant, des amis choisis (`amis`).
       */
      lancer: (categories: string[], sujet?: string | null, amis: string[] = [], adversaire?: string) =>
        req<{ code: string; serie: SerieDeCampagne; enjeu?: EnjeuDuDuel }>('/api/campagne/duel', {
          method: 'POST',
          body: JSON.stringify({ categories, ...(sujet && { sujet }), ...(amis.length > 0 && { amis }), ...(adversaire && { adversaire }) }),
        }),
      lire: (code: string) => req<DuelEntreAmis>(`/api/campagne/duel/${encodeURIComponent(code)}`),
      relever: (code: string) => req<SerieDeCampagne>(`/api/campagne/duel/${encodeURIComponent(code)}`, { method: 'POST' }),
      miens: () => req<ResumeDuDuel[]>('/api/campagne/duels'),
      /** L'envoyer à des amis : il les attend dans leurs duels. */
      envoyer: (code: string, amis: string[]) =>
        req<{ envoyes: number }>(`/api/campagne/duel/${encodeURIComponent(code)}/envoi`, { method: 'POST', body: JSON.stringify({ amis }) }),
    },
    /** Ses amis — ceux avec qui il a joué un défi entre amis — et les défis qu'ils lui ont envoyés ; lus pour un de ses défis, ceux qui l'ont déjà. */
    amis: {
      lire: (duel?: string) => req<MesAmis>(`/api/campagne/amis${duel ? `?duel=${encodeURIComponent(duel)}` : ''}`),
      retirer: (id: string) => req<{ ok: true }>(`/api/campagne/amis/${encodeURIComponent(id)}/retrait`, { method: 'POST' }),
      /** L'ajouter à sa liste, trouvé par son prénom : sans demande ni attente. */
      ajouter: (id: string) => req<{ ok: true }>(`/api/campagne/amis/${encodeURIComponent(id)}/ajout`, { method: 'POST' }),
    },
    /**
     * Le dé, un duel classé contre Automate : tiré sur ses catégories ou son
     * sujet — celui laissé en route reprend, sur les siens. Une série d'un
     * autre mode : ses réponses passent par celles de la série.
     */
    rencontre: {
      commencer: (choix: { categories?: readonly string[]; sujet?: string | null } = {}) =>
        req<RencontreDeCampagne>('/api/campagne/rencontre', {
          method: 'POST',
          body: JSON.stringify({ categories: choix.sujet ? [] : (choix.categories ?? []), ...(choix.sujet && { sujet: choix.sujet }) }),
        }),
      miennes: () => req<MesRencontres>('/api/campagne/rencontres'),
    },
    /**
     * Le carnet de révision (`shared/revision.ts`) : une révision est une
     * série d'un autre mode — ses réponses et ses signalements passent par
     * celles de la série.
     */
    carnet: {
      etat: () => req<EtatDuCarnet>(DEPART.carnet),
      appris: () => req<FaitAppris[]>('/api/campagne/carnet/appris'),
      /**
       * Une révision : celle laissée en route, ou les questions dont le
       * rendez-vous est arrivé — tout le carnet (`tout`), en avance compris ;
       * `recommencer` referme celle laissée en route et en tire une neuve, sur
       * ce qu'elle visait. `categories` ou `sujet` la visent, comme une série.
       */
      reviser: (o: { tout?: boolean; recommencer?: boolean; categories?: readonly string[]; sujet?: string } = {}) =>
        req<SerieDeCampagne>('/api/campagne/revision', { method: 'POST', body: JSON.stringify(o) }),
    },
    /** Les parcours de thème — les sentiers à thème d'avant (`shared/sentiersDeSujets.ts`) : une épreuve de sujet est une série d'un autre mode — sa correction et ses signalements passent par celles de la série. */
    sujets: {
      etat: () => req<EtatDesSujets>(DEPART.sujets),
      commencer: (sujet: string, palier: number) => req<EpreuveDeSujet>('/api/campagne/sujets/epreuve', { method: 'POST', body: JSON.stringify({ sujet, palier }) }),
      repondre: (epreuve: string, index: number, choix: number) =>
        req<ReponseDuSujet>(`/api/campagne/sujets/epreuve/${encodeURIComponent(epreuve)}/reponse`, { method: 'POST', body: JSON.stringify({ index, choix }) }),
    },
    /**
     * Les sentiers du savoir (`shared/sentiers.ts`) : une épreuve est une
     * série d'un autre mode — sa correction et ses signalements passent par
     * celles de la série.
     */
    sentiers: {
      etat: () => req<EtatDesSentiers>(DEPART.sentiers),
      commencer: (branche: string, palier: number) =>
        req<EpreuveDeSentier>('/api/campagne/sentiers/epreuve', { method: 'POST', body: JSON.stringify({ branche, palier }) }),
      repondre: (epreuve: string, index: number, choix: number) =>
        req<ReponseDEpreuve>(`/api/campagne/epreuve/${encodeURIComponent(epreuve)}/reponse`, { method: 'POST', body: JSON.stringify({ index, choix }) }),
      /** L'abandonner — ou, validée, s'arrêter là : sa fin vient avec (`fin`), le portrait se révèle. */
      abandonner: (epreuve: string) =>
        req<EtatDesSentiers & { fin?: FinDEpreuve }>(`/api/campagne/epreuve/${encodeURIComponent(epreuve)}/abandon`, { method: 'POST' }),
      acheterVies: (nombre: number) => req<EtatDesSentiers>('/api/campagne/vies', { method: 'POST', body: JSON.stringify({ nombre }) }),
    },
  },
  /**
   * L'Expédition (`shared/expedition.ts`) : sa page, partir avec son équipée,
   * un geste — qui porte le rang qu'il croit suivre —, une réponse — avec la
   * position de sa question ; deux réponses sous Double chance —, l'abandon.
   * Une partie d'un autre mode : sa correction et ses signalements passent par
   * celles de la série.
   */
  expedition: {
    page: () => req<PageDeLExpedition>(DEPART.expedition),
    /** Partir avec son équipée — et, là où elles s'ouvrent (partout, depuis qu'elles sont le jeu), aux rencontres, avec sa catégorie fétiche, le dos de son paquet et son cran de l'Ascension. */
    partir: (equipee: readonly string[], plus: { rencontres?: true; fetiche?: string; dos?: string; ascension?: number } = {}) =>
      req<VueDeLExpedition>('/api/expedition', { method: 'POST', body: JSON.stringify({ equipee, ...plus }) }),
    avancer: (id: string, rang: number, vers: string) => gesteDExpedition(id, rang, { quoi: 'avancer', vers }),
    /** En rencontre : sa mise dite, il voit la question qui attend (`position`). */
    voir: (id: string, rang: number, mise: number, position?: number) => gesteDExpedition(id, rang, { quoi: 'voir', mise, ...(position !== undefined && { position }) }),
    /** Un joker : sur la question qui attend (`position` : un joker périmé est refusé), sur la carte, ou posé. */
    jouer: (id: string, rang: number, joker: string, plus: { position?: number; categorie?: string; montre?: number } = {}) =>
      gesteDExpedition(id, rang, { quoi: 'jouer', joker, ...plus }),
    /** Ce qu'il prend d'une offre : ses jokers, et le talisman ou la fiole qui en prend la place. */
    prendre: (id: string, rang: number, jokers: readonly string[], talisman?: string, fiole?: CleDeFiole) =>
      gesteDExpedition(id, rang, { quoi: 'prendre', jokers: [...jokers], ...(talisman !== undefined && { talisman }), ...(fiole !== undefined && { fiole }) }),
    /** Une fiole bue — pendant une question, sur celle qui attend (`position`), comme une carte jouée sur elle. */
    boire: (id: string, rang: number, fiole: CleDeFiole, position?: number) => gesteDExpedition(id, rang, { quoi: 'boire', fiole, ...(position !== undefined && { position }) }),
    /** Au campement : une vie — ou, `retirer`, ce joker ôté de son paquet ; `ameliorer`, cette carte améliorée (le jeu complet). */
    camper: (id: string, rang: number, choix: { retirer?: string; ameliorer?: string } = {}) =>
      gesteDExpedition(id, rang, { quoi: 'camper', ...(choix.retirer !== undefined && { retirer: choix.retirer }), ...(choix.ameliorer !== undefined && { ameliorer: choix.ameliorer }) }),
    /** À l'échoppe : un article contre des écus — le joker de l'étal, ou celui qu'on retire. */
    acheter: (id: string, rang: number, article: ArticleDeLEchoppe, joker?: string) => gesteDExpedition(id, rang, { quoi: 'acheter', article, ...(joker !== undefined && { joker }) }),
    garder: (id: string, rang: number, legendaire: string) => gesteDExpedition(id, rang, { quoi: 'garder', legendaire }),
    repondre: (id: string, position: number, choix: number | readonly number[]) =>
      req<ReponseDExpedition>(`/api/expedition/${encodeURIComponent(id)}/reponse`, { method: 'POST', body: JSON.stringify({ position, choix }) }),
    abandonner: (id: string) => req<ApresUnGeste>(`/api/expedition/${encodeURIComponent(id)}/abandon`, { method: 'POST' }),
    devoilement: lireLeDevoilement,
  },
  /** Les duels classés (`shared/duels.ts`) : sa cote, sa ligue, sa semaine, le classement — leur page, `/duels`. */
  duels: {
    etat: () => req<EtatDesDuels>(DEPART.duels),
    /** La suite de son historique, au « Voir plus » : après le dernier duel qu'il a sous les yeux, sa date puis sa série. */
    historique: (apres: { le: number; cle: string }) => req<PageDHistoire>(`/api/duels/historique?le=${apres.le}&cle=${encodeURIComponent(apres.cle)}`),
    /** Quelqu'un à défier ou à ajouter, par son prénom. */
    chercher: (texte: string) => req<JoueurADefier[]>(`/api/duels/joueurs?q=${encodeURIComponent(texte)}`),
    /** Un joueur touché — sa carte, la préparation ouverte à son adresse : ce que la recherche dirait de lui, s'il est son ami, et sa propre cote. */
    joueur: (profileId: string) => req<FaceAFace>(`/api/duels/joueurs/${encodeURIComponent(profileId)}`),
    /** La feuille des amis : sa liste — qui est en ligne, entre amis réciproques —, qui l'a ajouté, et des joueurs croisés. */
    amis: () => req<AmisDeLaFeuille>('/api/duels/amis'),
    /** Des joueurs croisés — une soirée, un duel, le défi de la semaine, son niveau —, pour « Contre qui ? ». */
    croises: () => req<JoueurCroise[]>('/api/duels/croises'),
  },
  jour: {
    etat: () => avecLHeure(() => req<PartieDuJour>(DEPART.jour), DEPART.jour),
    commencer: () => avecLHeure(() => req<PartieDuJour>('/api/jour/commencer', { method: 'POST' })),
    suivante: () => avecLHeure(() => req<PartieDuJour>('/api/jour/suivante', { method: 'POST' })),
    repondre: (jour: string, index: number, choix: number) =>
      req<RevelationDuJour>('/api/jour/repondre', { method: 'POST', body: JSON.stringify({ jour, index, choix }) }),
    classement: (periode: { jour?: string; mois?: string } = {}) =>
      req<ClassementDuJour>(
        `/api/jour/classement${periode.mois ? `?mois=${periode.mois}` : periode.jour ? `?jour=${periode.jour}` : ''}`,
      ),
    correction: (jour: string) => req<CorrectionDuJour>(`/api/jour/correction/${jour}`),
    signaler: (jour: string, index: number, texte: string) =>
      req<{ ok: true }>('/api/jour/signaler', { method: 'POST', body: JSON.stringify({ jour, index, texte }) }),
    /** Des sabliers pour sa série, en confettis — deux au plus en tout : ceux qui l'attendent, et son solde. */
    sablier: (nombre = 1) => req<{ sabliers: number; confettis: SoldeDeConfettis }>('/api/jour/sablier', { method: 'POST', body: JSON.stringify({ nombre }) }),
    /**
     * Le rappel du soir de ce téléphone (`rappel.ts`) : la clé du serveur,
     * puis l'abonnement. Chaque réponse dit son réglage.
     */
    rappel: {
      cle: () => req<{ cle: string; heure: number }>('/api/jour/rappel'),
      abonner: (abonnement: PushSubscriptionJSON, activer = false) =>
        req<ReglagesDesNotifications>('/api/jour/rappel', { method: 'POST', body: JSON.stringify({ abonnement, ...(activer && { activer }) }) }),
      desabonner: (endpoint: string) => req<ReglagesDesNotifications>('/api/jour/rappel', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
    },
  },
  space: {
    saveSettings: (settings: Partial<SpaceSettings>) =>
      req<{ space: PublicSpace }>('/api/space/settings', { method: 'PUT', body: JSON.stringify(settings) }),
    /** Rattache son profil joueur à son espace : il faut prouver les deux. */
    lierProfil: (login: string, password: string) =>
      req<{ profil: ProfilDeLEspace }>('/api/space/profil', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      }),
    /** `preuve` : le mot de passe du profil rattaché, ou celui du compte. */
    detacherProfil: (preuve: string) =>
      req<{ profil: null }>('/api/space/profil', { method: 'DELETE', body: JSON.stringify({ preuve }) }),
  },
  /** Réservé à l'administrateur : les comptes des autres animateurs. */
  admin: {
    /** Le QG, ce qui se passe en ce moment : lu en mémoire, la page le redemande toutes les dix secondes. */
    qgDirect: () => req<DirectDuQg>('/api/admin/qg/direct'),
    /** Le QG, la vue d'ensemble : trente jours lus dans la base permanente, redemandés toutes les cinq minutes. */
    qg: () => req<VueDEnsemble>('/api/admin/qg'),
    /** Le journal des gestes, une page à la fois : par sorte, à partir du curseur de la page d'avant. */
    gestes: ({ sorte, cible, suite }: { sorte?: SorteDeGeste | null; cible?: string | null; suite?: string | null } = {}) => {
      const q = new URLSearchParams()
      if (sorte) q.set('sorte', sorte)
      if (cible) q.set('cible', cible)
      if (suite) q.set('suite', suite)
      // Pas `q.size` : un Safari d'avant 17 ne l'a pas, et le filtre se perdait.
      const s = q.toString()
      return req<JournalDuQg>(`/api/admin/gestes${s ? `?${s}` : ''}`)
    },
    /** Le bilan des soirées : trente jours en chiffres, quand on joue, la taille des salles, l'historique du mois. */
    soirees: () => req<PageDesSoirees>('/api/admin/soirees'),
    /** La santé du serveur sur sept jours : les temps de réponse, les réveils et les arrêts, les erreurs. */
    serveur: () => req<PageDuServeur>('/api/admin/serveur'),
    /** L'activité : trente jours de questions jouées et de parties, mode par mode, et ce que chaque profil a joué. */
    activite: () => req<PageDeLActivite>('/api/admin/activite'),
    /** Clore une soirée laissée en plan, comme son animateur l'aurait close : rangée, ses invités crédités. */
    cloreLaSoiree: (spaceId: string) =>
      req<{ close: true; rangee: boolean }>(`/api/admin/soirees/${encodeURIComponent(spaceId)}/clore`, { method: 'POST' }),
    /** Le bandeau rouge et les pages en maintenance, tels qu'ils sont posés. */
    maintenance: () => req<EtatDeLaMaintenance>('/api/admin/maintenance'),
    /** Poser le bandeau, ou le retirer (`null`) ; rend l'état d'après. */
    poserLeBandeau: (texte: string | null) => req<EtatDeLaMaintenance>('/api/admin/maintenance/bandeau', { method: 'PUT', body: JSON.stringify({ texte }) }),
    /** Ce que devient une page : ouverte à tous, en maintenance, bientôt disponible ; rend l'état d'après. */
    changerLaPage: (page: PageEnMaintenance, etat: EtatDUnePage) =>
      req<EtatDeLaMaintenance>(`/api/admin/maintenance/pages/${page}`, { method: 'PUT', body: JSON.stringify({ etat }) }),
    /** Un testeur de plus pour une page bientôt disponible, ou de moins ; rend l'état d'après. */
    ajouterUnTesteur: (page: PageEnMaintenance, profileId: string) =>
      req<EtatDeLaMaintenance>(`/api/admin/maintenance/pages/${page}/testeurs/${encodeURIComponent(profileId)}`, { method: 'PUT' }),
    retirerUnTesteur: (page: PageEnMaintenance, profileId: string) =>
      req<EtatDeLaMaintenance>(`/api/admin/maintenance/pages/${page}/testeurs/${encodeURIComponent(profileId)}`, { method: 'DELETE' }),
    /** Tous les espaces, chacun avec son titulaire : les salons des profils, les comptes à mot de passe. */
    espaces: () => req<EspaceDAdministration[]>('/api/admin/espaces'),
    /** Fusionner deux identités d'avant : l'espace prend ce profil pour titulaire, ses quiz d'ailleurs le rejoignent. */
    rattacher: (id: string, login: string) =>
      req<{ ok: true; recopies: number; ancien: string | null }>(`/api/admin/espaces/${encodeURIComponent(id)}/titulaire`, {
        method: 'POST',
        body: JSON.stringify({ login }),
      }),
    activation: (id: string) =>
      req<{ activation: Activation }>(`/api/admin/accounts/${id}/activation`, { method: 'POST' }),
    disable: (id: string) => req<{ account: PublicAccount }>(`/api/admin/accounts/${id}/disable`, { method: 'POST' }),
    enable: (id: string) => req<{ account: PublicAccount }>(`/api/admin/accounts/${id}/enable`, { method: 'POST' }),
    update: (id: string, patch: { name?: string; slug?: string }) =>
      req<{ account: PublicAccount }>(`/api/admin/accounts/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    /** Un compte désactivé seulement ; tout ce qu'il a laissé part avec lui. */
    /** `reprendre` : ce que ses soirées ont crédité aux joueurs part avec lui. */
    remove: (id: string, credits: 'garder' | 'reprendre') =>
      req<{ ok: true }>(`/api/admin/accounts/${id}?credits=${credits}`, { method: 'DELETE' }),
    /** « Les profils » : ceux qu'on cherche, ou les derniers vus. */
    profils: (cherche: string) =>
      req<{ total: number; profils: ProfilDAdministration[] }>(`/api/admin/profils?q=${encodeURIComponent(cherche)}`),
    /** Supprime un profil et ce qui n'était qu'à lui ; l'espace qu'il tenait reste, détaché. */
    supprimerProfil: (id: string) =>
      req<{ ok: true; salon: 'detache' | null }>(`/api/admin/profils/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    /** La fiche d'un joueur : où il en est dans chaque mode, ses confettis, sa connexion, l'épreuve qui l'attend. */
    fiche: (id: string) => req<FicheDuJoueur>(`/api/admin/profils/${encodeURIComponent(id)}`),
    /** Les gestes de la fiche d'un joueur, chacun noté au journal. */
    offrirDesConfettis: (id: string, confettis: number, mot: string) =>
      req<{ ok: true; confettis: number; mot: string | null }>(`/api/admin/profils/${encodeURIComponent(id)}/confettis`, {
        method: 'POST',
        body: JSON.stringify({ confettis, mot }),
      }),
    codeDeSecours: (id: string) =>
      req<{ code: string; login: string }>(`/api/admin/profils/${encodeURIComponent(id)}/secours`, { method: 'POST', body: '{}' }),
    renommer: (id: string, nom: string) =>
      req<{ ok: true; nom: string }>(`/api/admin/profils/${encodeURIComponent(id)}/prenom`, { method: 'POST', body: JSON.stringify({ nom }) }),
    suspendre: (id: string) => req<{ ok: true }>(`/api/admin/profils/${encodeURIComponent(id)}/suspendre`, { method: 'POST', body: '{}' }),
    reactiver: (id: string) => req<{ ok: true }>(`/api/admin/profils/${encodeURIComponent(id)}/reactiver`, { method: 'POST', body: '{}' }),
    rouvrirLaConnexion: (id: string) => req<{ ok: true }>(`/api/admin/profils/${encodeURIComponent(id)}/connexion`, { method: 'POST', body: '{}' }),
    libererLEpreuve: (id: string) =>
      req<{ ok: true; sentier: string; palier: number }>(`/api/admin/profils/${encodeURIComponent(id)}/epreuve`, { method: 'POST', body: '{}' }),
    /** Le catalogue du serveur, toutes les copies : proposées, publiées, refusées, retirées. */
    catalogue: () => req<EntreeDuCatalogue[]>('/api/admin/catalogue'),
    /** Une copie proposée, questions comprises, pour la relire. */
    entreeDuCatalogue: (id: string) =>
      req<EntreeDuCatalogue & { questions: QuizQuestionDef[] }>(`/api/admin/catalogue/${encodeURIComponent(id)}`),
    statutAuCatalogue: (id: string, statut: StatutAuCatalogue) =>
      req<{ ok: true }>(`/api/admin/catalogue/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ statut }) }),
    /** Le quiz du jour : la réserve, les signalements, les profils masqués. */
    jour: () => req<AdminDuJour>('/api/admin/jour'),
    /** Ce que le QG suit du quiz du jour : le tirage question par question, le classement du mois, les séries, le rappel du soir. */
    suiviDuJour: () => req<SuiviDuJour>('/api/admin/jour/suivi'),
    prochainesDuJour: () => req<{ id: string; question: QuizQuestionDef; source: string }[]>('/api/admin/jour/prochaines'),
    /** La consigne à coller dans une IA, celle que suit la routine : trente questions. */
    consigneDuJour: () => req<{ consigne: string; joursDAvance: number; aEcrire: number }>('/api/admin/jour/consigne'),
    listeDuJour: (texte: string) =>
      req<{ ajoutees: number; ecartees: { texte: string; raison: string }[]; ignores: string[] }>('/api/admin/jour/liste', {
        method: 'POST',
        body: JSON.stringify({ texte }),
      }),
    garderDuJour: (jour: string, index: number) =>
      req<{ ok: true }>('/api/admin/jour/garder', { method: 'POST', body: JSON.stringify({ jour, index }) }),
    annulerDuJour: (jour: string, index: number) =>
      req<{ ok: true }>('/api/admin/jour/annuler', { method: 'POST', body: JSON.stringify({ jour, index }) }),
    retirerDuJour: (reserveId: string, jour?: string, index?: number) =>
      req<{ ok: true }>('/api/admin/jour/retirer', { method: 'POST', body: JSON.stringify({ reserveId, jour, index }) }),
    profilsDuJour: (q: string) => req<ProfilMasquable[]>(`/api/admin/jour/profils?q=${encodeURIComponent(q)}`),
    masquerDuJour: (profileId: string, masque: boolean) =>
      req<{ ok: true }>('/api/admin/jour/masquer', { method: 'POST', body: JSON.stringify({ profileId, masque }) }),
    /** La campagne : sa base, et les questions que les joueurs signalent. */
    campagne: () => req<AdminDeLaCampagne>('/api/admin/campagne'),
    garderDeLaCampagne: (questionId: string) => req<{ ok: true }>('/api/admin/campagne/garder', { method: 'POST', body: JSON.stringify({ questionId }) }),
    retirerDeLaCampagne: (questionId: string) => req<{ ok: true }>('/api/admin/campagne/retirer', { method: 'POST', body: JSON.stringify({ questionId }) }),
    /** Corriger une question signalée : sous le même identifiant, ou un neuf si la bonne réponse change. */
    corrigerDansLaCampagne: (questionId: string, correction: CorrectionDeQuestion) =>
      req<QuestionCorrigee>('/api/admin/campagne/corriger', { method: 'POST', body: JSON.stringify({ questionId, correction }) }),
    /** La reclasser : sa catégorie, son sous-thème, sa difficulté estimée. */
    reclasserDansLaCampagne: (questionId: string, classement: Classement) =>
      req<{ ok: true }>('/api/admin/campagne/reclasser', { method: 'POST', body: JSON.stringify({ questionId, classement }) }),
    /** Les signalements : à relire, au quiz du jour et en campagne, et ce qui a été fait des questions relues ces trente jours. */
    signalements: () => req<PageDesSignalements>('/api/admin/signalements'),
    /**
     * Corriger une question du jour signalée : sa version de la réserve, et le
     * jour qui l'a posée quand la bonne réponse ne change pas ; `annuler`
     * annule aussi ses points pour tous quand elle change.
     */
    corrigerDuJour: (jour: string, index: number, correction: CorrectionDeQuestion, annuler: boolean) =>
      req<{ jourAussi: boolean; nouvelle: boolean; annulee: boolean }>('/api/admin/jour/corriger', {
        method: 'POST',
        body: JSON.stringify({ jour, index, correction, annuler }),
      }),
    /** La reclasser pour ses prochains tirages : sa catégorie — son sous-thème et sa difficulté, si la routine l'a décrite. */
    reclasserDuJour: (jour: string, index: number, classement: Classement) =>
      req<{ ok: true }>('/api/admin/jour/reclasser', { method: 'POST', body: JSON.stringify({ jour, index, classement }) }),
    /** Les sentiers, palier par palier : toutes les branches, ou une seule. */
    sentiers: (branche?: string) => req<AdminDesSentiers>(`/api/admin/campagne/sentiers${branche ? `?branche=${encodeURIComponent(branche)}` : ''}`),
    /** Ce que le QG suit de la campagne : les paliers du jour, le défi de la semaine, les parcours de thème, les vies. */
    suiviDeLaCampagne: () => req<SuiviDeLaCampagne>('/api/admin/campagne/suivi'),
    /** Régler le mélange d'un palier pour les douze sentiers ; null le rend à celui d'origine. */
    reglerLeMelange: (palier: number, melange: Melange | null) =>
      req<{ palier: number; avant: Melange; apres: Melange; origine: boolean }>(`/api/admin/campagne/paliers/${palier}/melange`, {
        method: 'POST',
        body: JSON.stringify({ melange }),
      }),
    /** Ce que le QG suit des duels : les duels classés lancés, les ligues, le classement, ceux qui attendent leur adversaire. */
    suiviDesDuels: () => req<SuiviDesDuels>('/api/admin/duels/suivi'),
    /** Annuler un duel classé que l'adversaire n'a pas commencé : il ne compte pour personne. */
    annulerUnDuel: (code: string) => req<{ ok: true; code: string }>(`/api/admin/duels/${encodeURIComponent(code)}/annuler`, { method: 'POST', body: '{}' }),
    /** L'économie : les confettis gagnés et dépensés, ceux qui circulent, les meilleures ventes, les Éclats et les légendaires. */
    economie: () => req<PageDeLEconomie>('/api/admin/economie'),
  },
}

/** Un profil tel que l'administration du quiz du jour le trouve. */
export interface ProfilMasquable {
  id: string
  login: string
  nom: string
  avatar: string
  masque: boolean
}

/** Ce que l'administration du quiz du jour montre. */
export interface AdminDuJour {
  reserve: {
    pretes: number
    joursDAvance: number
    posees: number
    retirees: number
    apports: { quand: number; source: string; ajoutees: number; ecartees: { texte: string; raison: string }[] }[]
  }
  signalements: {
    jour: string
    index: number
    reserveId: string
    texte: string
    bonne: string
    joueurs: number
    textes: string[]
    annulee: boolean
    annulable: boolean
  }[]
  masques: ProfilMasquable[]
  /** Une routine remplit la réserve : `RESERVE_TOKEN` est posé sur le serveur. */
  remplissage: { automatique: boolean }
  aujourdhui: string
}

/** Les questions d'un jour, relues : ses réponses, ses anecdotes, et ce qu'on y a fait. */
export interface CorrectionDuJour {
  jour: string
  questions: {
    texte: string
    reponses: string[]
    bonne: number
    categorie: string | null
    anecdote: string | null
    trouveePar: number | null
    choix: number | null
    juste: boolean
    points: number
    /** En combien de temps sa réponse est partie — null sans réponse à temps. */
    ms: number | null
    /** Le chrono de la question, en secondes. */
    duree: number
    /** Ce que la rapidité a payé d'une bonne réponse : le reste de ses points est celui de la bonne réponse. */
    rapidite: number | null
    repondue: boolean
    /** Sa réponse est arrivée après l'échéance : elle n'a pas compté. */
    tropTard?: boolean
    annulee?: boolean
  }[]
}

/**
 * Une requête qui remesure l'heure du serveur : l'envoi, l'heure qu'il a
 * écrite en répondant (l'en-tête `Date` n'a que la seconde), et le retour —
 * la mesure la plus rapide l'emporte (`shared/clock.ts`).
 */
async function avecLHeure(appel: () => Promise<PartieDuJour>, adresse?: string): Promise<PartieDuJour> {
  const sentAt = Date.now()
  const reponse = await appel()
  // La première partie de la page peut être celle que le serveur a fait
  // précharger : son aller-retour se lit alors dans le préchargement.
  const mesure = mesureDeLaReponse(reponse, { sentAt, receivedAt: Date.now() }, () => (adresse ? tempsDuPrechargement(adresse) : null))
  if (mesure) applySample(mesure)
  return reponse
}

/**
 * Un appel qui attend le réveil de l'hébergeur au lieu d'échouer au bout de
 * vingt secondes — voir `shared/reveil.ts`. Seulement pour ce qu'on peut
 * rejouer sans dommage : un essai abandonné a pu arriver quand même.
 */
export function auReveil<T>(appel: () => Promise<T>, attente: Omit<Attente, 'passager'> = {}): Promise<T> {
  return enAttendantLeReveil(appel, { ...attente, passager: e => e instanceof ApiError && e.passager })
}

/**
 * Qui est connecté, demandé une seule fois par page. Les pages publiques
 * s'en servent pour reconnaître l'animateur de l'espace ; un invité reçoit
 * 401, et c'est le cas normal : null, sans bruit.
 */
let meOnce: Promise<Me | null> | null = null
export function currentMe(): Promise<Me | null> {
  if (!meOnce) meOnce = api.auth.me().catch(() => null)
  return meOnce
}

/**
 * Ouvre la console par le profil connecté ici — son espace créé la première
 * fois (`/api/joueur/espace`). « Mes quiz » et « Compte » sont des pièces du
 * menu de tout profil : sans compte d'animateur, ils renvoyaient à une
 * connexion qu'aucun joueur n'avait. Vrai si la console est ouverte ;
 * faux sans profil — la page demande alors la connexion, comme avant.
 */
/**
 * Se connecter là où s'ouvre une console — `/connexion`, l'écran commun :
 * avec son profil d'abord (un seul profil, le choix du 3 octobre 2026), sa
 * console avec — créée s'il n'avait pas encore d'espace —, sinon avec un
 * compte d'animateur d'avant, que la migration n'a pas pu rattacher. Un refus
 * des deux portes remonte en `UnauthorizedError`.
 */
export async function seConnecter(login: string, password: string): Promise<void> {
  try {
    const { espace } = await api.joueur.connexion(login, password)
    if (!espace) await api.joueur.espace()
    return
  } catch (e) {
    if (!(e instanceof UnauthorizedError)) throw e
  }
  await api.auth.login(login, password)
}

export async function ouvrirParLeProfil(): Promise<boolean> {
  try {
    await api.joueur.espace()
    return true
  } catch (e) {
    if (e instanceof UnauthorizedError) return false
    throw e
  }
}

/**
 * Réduit et recompresse la photo dans le navigateur avant l'envoi : une photo
 * de téléphone fait 4 Mo, on n'en garde que ~100 Ko — la base reste légère et
 * l'affichage instantané sur l'écran commun.
 *
 * WebP d'abord, un quart plus léger que le JPEG à qualité égale. Un navigateur
 * qui ne sait pas l'encoder répond avec un autre format : on repasse alors en
 * JPEG plutôt que d'envoyer un PNG de plusieurs mégaoctets.
 */
export async function compressImage(file: File, maxSide = 1280, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Impossible de préparer la photo')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const webp = canvas.toDataURL('image/webp', quality)
  if (webp.startsWith('data:image/webp')) return webp
  return canvas.toDataURL('image/jpeg', quality)
}
