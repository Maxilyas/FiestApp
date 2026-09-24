// La typographie de ce qu'on lit au mur : dérivations pures, partagées par le
// client, le serveur et les tests.
//
// Rien de ce qui passe ici n'est écrit en base : un texte saisi reste tel qu'on
// l'a tapé, et c'est son affichage qui se corrige — une règle améliorée
// profite alors aux soirées passées comme aux questions déjà écrites.

/** Espace fine insécable : avant ? ! ; et à l'intérieur des guillemets. */
const FINE = ' '
/** Espace insécable, pleine : avant les deux-points, comme le veut l'usage. */
const INSECABLE = ' '
/**
 * Gluon (U+2060, WORD JOINER) : aucune coupure de part et d'autre, et rien à
 * dessiner. Le trait d'union insécable (U+2011) aurait fait l'affaire, mais ni
 * Figtree ni Cormorant ne l'ont : le navigateur l'aurait pris dans une autre
 * police, trait plus court ou carré vide sous Windows 10. Le gluon, lui, est
 * invisible par définition — aucune police n'a besoin de le connaître.
 */
const GLUON = '\u2060'

/**
 * « de » ou « d’ » devant un prénom : « La soirée d’Antoine », « de Bob ».
 *
 * Le h s'élide aussi (« d’Hugo », « d’Hélène ») : parmi les prénoms, le h
 * aspiré est l'exception, et « de Hugo » sonnait plus faux au mur qu'un
 * « d’Hervé » discutable. Le y reste consonne (« de Yann »), et ce qui ne
 * commence pas par une lettre — un chiffre, un emoji — garde « de ».
 */
export function de(nom: string): string {
  const initiale = nom.trim().normalize('NFD').charAt(0).toLowerCase()
  return /[aeiouh]/.test(initiale) ? 'd’' : 'de '
}

/** « d’Antoine », « de Bob » : la préposition collée au prénom. */
export const deNom = (nom: string) => `${de(nom)}${nom.trim()}`

/**
 * « 1ʳᵉ », « 2ᵉ »… Au féminin, parce qu'il se lit devant « place » : on ne
 * sait pas qui tient le téléphone, et « 1ᵉʳ sur 7 » écrivait au masculin la
 * victoire de Camille. Les équipes sont féminines, elles aussi.
 */
export const rang = (n: number) => (n === 1 ? '1ʳᵉ' : `${n}ᵉ`)

/** « 1ʳᵉ place », « 3ᵉ place » : un rang que personne ne lit au masculin. */
export const place = (n: number) => `${rang(n)} place`

/**
 * Les espaces insécables de la typographie française, posées à l'affichage.
 *
 * Une espace ordinaire avant « ? » laissait le point d'interrogation seul en
 * début de ligne, au mur, sous une question saisie « …de Sam ? ». On ne
 * remplace que les espaces **déjà là** devant ? ! ; : — une question tapée en
 * anglais (« Why? ») ne reçoit pas une espace qu'elle n'avait pas —, mais on
 * en pose toujours à l'intérieur des guillemets français, qui n'existent que
 * dans un texte français. Le trait d'union de l'inversion (« a-t-il »,
 * « est-elle », « va-t-on ») ne se coupe plus : le mur lisait « Sam a- » en
 * fin de ligne et « t-il marché ? » sous lui. Idempotente : repasser un texte
 * déjà traité ne le change plus.
 */
export function espacesFines(texte: string): string {
  return texte
    .replace(/[   ]+([?!;])/g, `${FINE}$1`)
    .replace(/[   ]+:/g, `${INSECABLE}:`)
    .replace(/«[   ]*/g, `«${FINE}`)
    .replace(/[   ]*»/g, `${FINE}»`)
    .replace(/-(t-)?(?=(?:il|elle|on)s?(?![\p{L}\p{N}]))/giu, (_, t: string | undefined) => (t ? `-${GLUON}${t.charAt(0)}-${GLUON}` : `-${GLUON}`))
}
