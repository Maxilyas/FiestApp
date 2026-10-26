// Le dernier niveau que cette page a vu : celui du profil à son ouverture,
// puis celui de chaque fin. L'écran des gains dit la montée de niveau qu'une
// partie a faite en s'y comparant (`useNiveauRelu`, `components/Gains.tsx`) :
// rien de retenu, la première fin d'une page ne savait pas d'où elle partait,
// et taisait « Niveau 8 ! », la finition et l'avatar de collection qu'il
// ouvrait — le premier bilan du Cabinet, dont la page ne le retenait pas.
//
// Hors de l'écran des gains, et sans un import : une page le retient dès son
// ouverture, et l'importer de `Gains.tsx` faisait télécharger au musée du
// Cabinet l'écran des gains et ses catalogues, qui ne servent qu'à la fin
// (`cabinet-ecran.test.ts` relit son chemin).

let vu: number | null = null

/** La page vient de lire le profil — ou une fin, de le relire : son niveau sert de point de départ. Sans niveau, rien ne change. */
export function retenirLeNiveau(niveau: number | undefined): void {
  if (niveau !== undefined) vu = niveau
}

/** Le niveau retenu ; null tant que la page n'a lu aucun profil. */
export const niveauVu = (): number | null => vu
