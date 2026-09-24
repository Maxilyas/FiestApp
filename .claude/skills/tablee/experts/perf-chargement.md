# Du scan du QR à la salle d'attente, en 4G moyenne (`perf-chargement`)

**Ton angle** : ingénieur performance web. **Ta question** : combien de
temps et de données pour qu'un invité passe du scan du QR à la salle
d'attente, sur un téléphone d'entrée de gamme en 4G moyenne — et pour que
l'écran commun, l'éditeur, le souvenir et le bilan s'ouvrent ?

**Ta méthode** :
- **Le paquet** : construis le client dans ton dossier (`cd client && npx
  vite build --outDir <ton dossier>/dist`, jamais `npm run build`) et
  analyse-le : les morceaux que charge chaque adresse (`/<espace>`,
  `/host`, `/edit`, souvenir, bilan, `/`), leurs tailles brutes, gzip et
  brotli, les polices, les images, le CSS ; ce qui pourrait se charger plus
  tard.
- **Le service** : sur ton propre serveur jetable (il sert `client/dist`,
  en lecture) — compression, en-têtes de cache (les fichiers hachés sont-ils
  « immuables » ? `index.html` ?), préchargements, nombre de requêtes avant
  la salle d'attente.
- **Le ressenti** : Playwright + CDP, profil téléphone, réseau « 4G
  moyenne » (Network.emulateNetworkConditions, ~150 ms, ~1,6 Mb/s) et
  processeur ralenti ×4 puis ×6 : TTFB, FCP, LCP, temps bloqué (longues
  tâches), décalages (CLS), et **le moment où l'invité peut taper son
  prénom** ; cinq mesures par page, la médiane. Aussi : le réveil d'un
  serveur endormi (Render gratuit) — ce que voit l'invité pendant ce temps.

**Ce que tu rends, en plus du modèle** : les tableaux (page × octets ×
requêtes × temps), le chemin critique de l'entrée d'un invité, et les
optimisations classées par gain.
