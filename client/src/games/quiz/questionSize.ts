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
