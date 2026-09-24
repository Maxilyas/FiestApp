/**
 * Trois paliers de taille selon la longueur : une question fleuve ne doit
 * pas chasser les réponses hors de l'écran.
 *
 * Dans son propre module : l'éditeur et le téléphone s'en servent aussi, et
 * l'importer depuis la vue de l'écran commun aurait embarqué toute cette vue
 * dans leur paquet.
 */
export function questionSizeClass(text: string | undefined): string {
  const n = (text ?? '').length
  if (n > 120) return ' q-sm'
  if (n > 70) return ' q-md'
  return ''
}

/**
 * Le palier des réponses : la plus longue décide pour toute la grille — des
 * cartes de tailles différentes feraient croire qu'une réponse compte plus.
 * Au-delà de 60 caractères, une réponse passait en quatre lignes à la télé
 * et sortait de sa carte ; une liste écrite par une IA en produit volontiers
 * (120 permis).
 */
export function answersSizeClass(answers: readonly string[] | undefined): string {
  const n = Math.max(0, ...(answers ?? []).map(a => a.length))
  if (n > 90) return ' ans-sm'
  if (n > 60) return ' ans-md'
  return ''
}
