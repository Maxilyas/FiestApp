// Les garde-fous que la page et le serveur partagent.
//
// Purs : le test les appelle sans navigateur, la page sans serveur.

/** Tabulation, retour à la ligne, caractère nul… : l'analyseur d'adresses les efface sans prévenir. */
const CONTROLE = /[\u0000-\u001f\u007f]/

/**
 * La page où revenir après la connexion (`/connexion?next=/compte`), ou
 * `repli` si ce n'est pas une page d'ici.
 *
 * L'ancien test regardait les premiers caractères : « une barre, mais pas
 * deux ». Le navigateur, lui, lit une contre-oblique comme une barre et
 * efface la tabulation avant de résoudre : `/\ailleurs.example` et
 * `/<tab>/ailleurs.example` passaient le test et emmenaient l'animateur,
 * sitôt connecté, sur le site de qui avait fabriqué le lien. On ne devine
 * donc plus : on résout l'adresse comme le navigateur le fera, et seule
 * l'origine obtenue décide.
 */
export function pageDeRetour(next: string | null | undefined, origine: string, repli = '/host'): string {
  // Un lien honnête n'en porte pas, et un caractère que le navigateur efface
  // en silence rendrait l'adresse vérifiée différente de celle qu'on suit.
  if (!next || CONTROLE.test(next)) return repli
  try {
    const ici = new URL(origine)
    const cible = new URL(next, ici)
    if (cible.origin !== ici.origin) return repli
    // L'adresse relue, pas la chaîne reçue : c'est celle-là qu'on a vérifiée.
    return cible.pathname + cible.search + cible.hash
  } catch {
    return repli
  }
}
