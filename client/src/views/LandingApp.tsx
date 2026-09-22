import { FormulaireSoiree } from '../components/Rejoindre'

/**
 * Une adresse qui ne mène nulle part.
 *
 * L'accueil (`/`), lui, est la page du profil : on se connecte avec son
 * profil, on anime si on a un espace, on rejoint sinon (voir `ProfilApp`).
 * Ici, on est arrivé sur `/nimportequoi` — on redemande le nom de la soirée
 * plutôt que de laisser quelqu'un devant une page vide.
 */
export function LandingApp() {
  return <FormulaireSoiree perdu onCancel={() => window.location.assign('/')} />
}
