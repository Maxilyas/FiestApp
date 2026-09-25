import { FormulaireSoiree } from '../components/Rejoindre'
import { slugTape } from '../../../shared/adresses'

/**
 * Une adresse qui ne mène nulle part.
 *
 * L'accueil (`/`), lui, est la page du profil : on se connecte avec son
 * profil, on anime si on a un espace, on rejoint sinon (voir `ProfilApp`).
 * Ici, on est arrivé sur `/nimportequoi` — on redemande le nom de la soirée
 * plutôt que de laisser quelqu'un devant une page vide.
 */
export function LandingApp() {
  // Seule une adresse d'un segment est un nom de soirée mal tapé : sous
  // « /banc/nimportequoi », « banc » existe, c'est la page qui manque.
  const seg = window.location.pathname.split('/').filter(Boolean)
  const tape = seg.length === 1 ? slugTape(seg[0]) : ''
  return <FormulaireSoiree perdu={tape} onCancel={() => window.location.assign('/')} />
}
