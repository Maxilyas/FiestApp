// Les faces d'un même fait : deux questions de la base qui posent le même fait
// sous deux formes — l'année d'une œuvre et le nom de son auteur, l'âge des
// noces d'or et leur nom. Le juge des faits les refusait toutes à l'écriture
// (`core/memeFait.ts`) : chaque fait connu n'existait que sous une face, et
// pas toujours la bonne pour le jeu qui le voulait. Le premier acte du Filet,
// qui demande des années que chaque Français sait placer, en a perdu 115 sur
// 129 le 12 novembre 2026 — la date d'une œuvre est presque toujours écrite
// dans l'intitulé de la question qui demande son auteur.
//
// Le risque que le juge gardait n'est pas qu'elles existent toutes les deux,
// mais qu'un joueur les croise de près : l'une souffle la réponse de l'autre,
// et la réponse donnée après la sœur ne mesure plus rien. La garde a donc
// passé du rangement au tirage, joueur par joueur (le choix du propriétaire du
// 12 novembre 2026) : jamais deux faces d'un fait dans une partie — elles ne
// passent qu'en tout dernier recours (`DejaPrises.memeFait`) —, une face vue
// compte pour vue chez ses sœurs, à la même heure (`vueDuFait`), et la mesure
// des difficultés écarte ce que la sœur avait soufflé
// (`JournalDesReponses.horsDeLaMesure`).
//
// Une question le dit d'elle-même dans la base (`QuestionDeLaBase.faceDe` :
// les identifiants des questions dont elle est une autre face, que le
// rangement pose) ; la base, lue, en tire les sœurs de chacune, dans les deux
// sens (`soeursDesLiees`), et les retient par la question même, comme ce que
// le build a préparé (`core/preparees.ts`) : chaque tirage les lit sans qu'on
// lui passe rien. Une question sans sœur — presque toutes — n'y a rien, et ne
// coûte qu'une lecture vide. Ce module n'importe rien.

const SOEURS = new WeakMap<object, readonly string[]>()

/** Les autres faces du fait de cette question, par leur identifiant ; undefined pour une question seule à le poser — presque toutes. */
export const soeursDe = (q: object): readonly string[] | undefined => SOEURS.get(q)

/** Ses sœurs, retenues par la question même (`BaseDeLaCampagne`) ; aucune les oublie. */
export function retenirLesSoeurs(q: object, soeurs: readonly string[] | undefined): void {
  if (soeurs && soeurs.length > 0) SOEURS.set(q, soeurs)
  else SOEURS.delete(q)
}

/**
 * Quand il a vu son fait pour la dernière fois : elle, ou l'une de ses sœurs.
 * Vue sous une face, une sœur l'est aussi — dans la fenêtre d'un tirage, elle
 * ne revient qu'en dernier recours ; au-delà, elle passe après ce qu'il n'a
 * jamais vu, comme une question qu'il aurait vue ce jour-là.
 */
export function vueDuFait(q: { id: string }, vues: Pick<ReadonlyMap<string, number>, 'get'>): number | undefined {
  let le = vues.get(q.id)
  const soeurs = SOEURS.get(q)
  if (!soeurs) return le
  for (const s of soeurs) {
    const v = vues.get(s)
    if (v !== undefined && (le === undefined || v > le)) le = v
  }
  return le
}

/**
 * Les sœurs de chaque question liée, dans les deux sens. `faceDe` ne se dit que
 * d'un côté — celle qui arrive nomme celles que la base a déjà —, mais l'une
 * souffle l'autre comme l'autre souffle l'une. Les sœurs d'une question sont
 * celles qu'un lien nomme, pas les sœurs de ses sœurs : deux questions qui
 * écrivent la même année dans leur intitulé ne posent pas le même fait pour
 * autant — de proche en proche, une grappe de la base en comptait onze. Un
 * lien vers une question absente — retirée, pas encore publiée — ne compte
 * pas.
 */
export function soeursDesLiees(liees: Iterable<{ id: string; faceDe?: readonly string[] }>, presente: (id: string) => boolean): Map<string, string[]> {
  const soeurs = new Map<string, string[]>()
  const lier = (a: string, b: string) => {
    const siennes = soeurs.get(a)
    if (!siennes) soeurs.set(a, [b])
    else if (!siennes.includes(b)) siennes.push(b)
  }
  for (const q of liees) {
    for (const autre of q.faceDe ?? []) {
      if (autre === q.id || !presente(autre)) continue
      lier(q.id, autre)
      lier(autre, q.id)
    }
  }
  return soeurs
}
