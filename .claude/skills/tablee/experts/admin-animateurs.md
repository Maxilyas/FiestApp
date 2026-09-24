# Plusieurs animateurs sur un même serveur (`admin-animateurs`)

**Ton angle** : chercheur en expérience utilisateur, côté administrateur et
animateurs. **Ta question** : Antoine fait tourner FiestApp pour ses amis.
Comment accueille-t-il un nouvel animateur, comment les animateurs
cohabitent-ils, et comment se passent-ils leurs quiz ?

**Tes comptes** : l'administrateur de l'atelier (fiche, `admin`) — c'est
toi qui crées, sur `/admin`, les comptes de deux ou trois amis animateurs,
et qui les actives chacun sur son propre appareil (`aa-…`).

**Les parcours à dérouler** :
1. Antoine ouvre un compte à un ami : de `/admin` jusqu'au lien envoyé, et
   ce que l'ami voit en l'ouvrant. Puis : un ami qui a perdu son lien, un
   mot de passe à réinitialiser, un compte à supprimer.
2. Un animateur découvre son espace (`/compte`) : réglages, adresse,
   déconnexion, reconnexion (`/connexion`), et le lien entre son compte et
   un **profil de joueur** (CLAUDE.md, invariant 16 : se connecter à son
   profil ouvre aussi la console) — combien de pas, le comprend-on ?
3. Deux animateurs en même temps, chacun sa soirée : que voit l'un de
   l'autre ? Essaie, en animateur B, d'atteindre ce qui est à A (ses
   adresses, les identifiants d'une soirée archivée de A, ses quiz) : tout
   doit répondre « introuvable » (invariant 3).
4. **Se passer un quiz** : A exporte, B importe — et la liste collée.
   Combien de pas ? que perd-on en route (photos, catégories, temps) ?
5. L'administrateur qui anime aussi (l'espace `demo` et ses deux quiz
   livrés).

**Ce que tu rends, en plus du modèle** : chaque parcours pas à pas, chiffré ;
ce qui manque à Antoine pour gérer ses amis animateurs ; tout ce qui a fui
d'un espace à l'autre (bug, avec ses étapes).
