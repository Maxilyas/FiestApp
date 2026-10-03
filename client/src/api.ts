import type { AdminDeLaCampagne, CorrectionDeCampagne, EtatDeCampagne, ReponseDeCampagne, SerieDeCampagne } from '../../shared/campagne'
import type { MemoireDuQuiz, QuizDef, QuizQuestionDef, QuizSummary } from '../../shared/library'
import type { ArchiveSummary } from '../../shared/archive'
import type { ModeleResume, PourQui } from '../../shared/modeles'
import type { ReglagesDuQuiz } from '../../shared/hasard'
import type { EntreeDeProgramme, Programme } from '../../shared/programme'
import type { EntreeDuCatalogue, StatutAuCatalogue } from '../../shared/partage'
import type { EspaceDAdministration, PublicAccount, PublicSpace, SpaceSettings } from '../../shared/space'
import type { FinitionChoisie, ProfilDAdministration, ProfilDeLEspace, PublicProfile, PublicProfileDetail } from '../../shared/profil'
import { MOTIFS, echecPassager, motifEchec, motifHttp, statutPassager } from '../../shared/erreurs'
import { enAttendantLeReveil, type Attente } from '../../shared/reveil'
import type { ClassementDuJour, PartieDuJour, RevelationDuJour } from '../../shared/jour'
import type { BoutiqueDuProfil } from '../../shared/themes'
import { applySample } from './clock'

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
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz', ...init?.headers },
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

export const api = {
  list: () => req<QuizSummary[]>('/api/quizzes'),
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
    me: () => req<Me>('/api/auth/me'),
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
      }>('/api/joueur/moi'),
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
    /** « Ouvrir le salon » : l'espace du profil, sa console ouverte ici, et le code du salon. */
    salon: () => req<{ espace: PublicSpace; code: string | null; nouveau: boolean }>('/api/joueur/salon', { method: 'POST' }),
    deconnexion: () => req<{ ok: true }>('/api/joueur/deconnexion', { method: 'POST' }),
    enregistrer: (patch: {
      name?: string
      avatar?: string
      finition?: FinitionChoisie
      legendaire?: string | null
      titre?: string | null
      vitrine?: string[] | null
      fond?: string | null
      theme?: string | null
      eclat?: { cle: string; brille: boolean }
    }) =>
      req<{ profile: PublicProfile }>('/api/joueur/moi', { method: 'PUT', body: JSON.stringify(patch) }),
    /**
     * Acheter un thème en confettis, et le porter aussitôt. Pas de reprise
     * au réveil du serveur : rejoué, un achat passé répondrait « déjà à toi ».
     * La boutique revient telle que le serveur l'a comptée.
     */
    acheterTheme: (theme: string) =>
      req<{ profile: PublicProfile; boutique: BoutiqueDuProfil }>('/api/joueur/themes', {
        method: 'POST',
        body: JSON.stringify({ theme }),
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
    etat: () => req<EtatDeCampagne>('/api/campagne'),
    commencer: (categories: string[]) => req<SerieDeCampagne>('/api/campagne/serie', { method: 'POST', body: JSON.stringify({ categories }) }),
    repondre: (serie: string, index: number, choix: number) =>
      req<ReponseDeCampagne>(`/api/campagne/serie/${encodeURIComponent(serie)}/reponse`, { method: 'POST', body: JSON.stringify({ index, choix }) }),
    correction: (serie: string) => req<CorrectionDeCampagne[]>(`/api/campagne/serie/${encodeURIComponent(serie)}/correction`),
    /** « Signaler une erreur » sur une question déjà jouée de la série. */
    signaler: (serie: string, index: number, texte: string) =>
      req<{ ok: true }>(`/api/campagne/serie/${encodeURIComponent(serie)}/signalement`, { method: 'POST', body: JSON.stringify({ index, texte }) }),
  },
  jour: {
    etat: () => avecLHeure(() => req<PartieDuJour>('/api/jour')),
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
    /** Le catalogue du serveur, toutes les copies : proposées, publiées, refusées, retirées. */
    catalogue: () => req<EntreeDuCatalogue[]>('/api/admin/catalogue'),
    /** Une copie proposée, questions comprises, pour la relire. */
    entreeDuCatalogue: (id: string) =>
      req<EntreeDuCatalogue & { questions: QuizQuestionDef[] }>(`/api/admin/catalogue/${encodeURIComponent(id)}`),
    statutAuCatalogue: (id: string, statut: StatutAuCatalogue) =>
      req<{ ok: true }>(`/api/admin/catalogue/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ statut }) }),
    /** Le quiz du jour : la réserve, les signalements, les profils masqués. */
    jour: () => req<AdminDuJour>('/api/admin/jour'),
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
    repondue: boolean
    annulee?: boolean
  }[]
}

/**
 * Une requête qui remesure l'heure du serveur : l'envoi, l'heure qu'il a
 * écrite en répondant (l'en-tête `Date` n'a que la seconde), et le retour —
 * la mesure la plus rapide l'emporte (`shared/clock.ts`).
 */
async function avecLHeure(appel: () => Promise<PartieDuJour>): Promise<PartieDuJour> {
  const sentAt = Date.now()
  const reponse = await appel()
  if (typeof reponse.maintenant === 'number') applySample({ serverTime: reponse.maintenant, sentAt, receivedAt: Date.now() })
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
