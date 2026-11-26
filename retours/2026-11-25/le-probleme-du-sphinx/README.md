# Les problèmes du Sphinx : la maquette

Le 25 novembre 2026. Le propriétaire : « Quelque chose que j'adorais c'est
“Can you solve this Riddle” de TED-Ed, une chaîne YouTube […] Ça serait
possible d'avoir ce genre de chose ? » Les vidéos ne se reprennent pas — leurs
histoires et leurs textes sont à leurs auteurs —, mais les casse-tête qu'elles
mettent en scène sont souvent des classiques bien plus anciens : un problème
du domaine public, raconté avec nos mots.

Une page, sans dépendance, hors de l'application : rien ici n'est servi par
FiestApp. Elle est publiée en artefact privé (le lien est dans la conversation
du 25 novembre 2026).

## Ce qu'elle montre

Le problème du passeur, du loup, de la chèvre et du chou, attribué à Alcuin
d'York (*Propositiones ad acuendos juvenes*, n° XVIII, vers l'an 800) : tout le
monde le connaît, il ne gâche aucun vrai problème de la réserve.

- **L'arrivée** : le Sphinx annonce « pas d'énigme en vers aujourd'hui, un
  *problème* », la phrase du Divin du moment en jeu, puis « J'écoute ! » ou
  « Plus tard ».
- **Le problème** : une petite histoire en trois paragraphes, la rivière
  dessinée en tête, et une réponse fermée — **un nombre** (combien de
  traversées, au moins ? trois essais) ou **un choix** (qui passe en premier ?
  trois cartes, un seul essai ; un mauvais choix montre ce qui arrive).
- **Un indice**, à côté de « Plus tard » et de la langue au chat.
- **La solution, traversée par traversée** : la barque fait chaque aller-retour
  pendant que le Sphinx explique, un compteur de 1 à 7, puis pourquoi on ne
  peut pas faire moins.

Le bouton « Maquette » mène à chaque moment et règle la forme de la réponse,
l'indice, le son et le mouvement.

## Ce qui a été décidé

Le propriétaire, le même jour, sur la maquette :

1. **« Les deux selon problème »** : un nombre ou un choix, chaque problème le
   sien.
2. **« Pas d'indice »**.
3. **« Une bonne part, et qu'il y en ait assez souvent (1/5 ça serait
   cool) »** : une visite sur cinq (`PART_DES_PROBLEMES`).

Ce qui s'en est fait — l'application ne dessine pas de rivière : chaque étape
de la solution s'écrit au-dessus du Sphinx, avec une ligne d'emojis qui montre
l'état —, et ce que le joueur voit : `docs/produit/le-sphinx.md` (« Les
problèmes ») ; la décision : « Une visite sur cinq, un problème façon TED-Ed »
(`docs/architecture/decisions.md`).

## Les problèmes de la réserve

Le même jour, quarante problèmes écrits d'après des livres du domaine public
et la tradition, racontés avec nos mots — chacun son récit, sa question, sa
réponse fermée, sa solution pas à pas, sa difficulté estimée par qui l'a
écrit (`problemes-candidats.json`, **avec leurs réponses** : le propriétaire
joue aussi, il ne le relit pas).

**Résolus à l'aveugle**, comme les énigmes : deux joueurs simulés, sans outils
ni réponses, à qui l'on n'a donné que les énoncés — un fort, qui raisonne sur
le papier et dit si une autre réponse tient ; un ordinaire, en deux ou trois
minutes, et sa certitude de 1 à 5. Ce qu'ils ont rendu est dans chaque
candidat (`aveugle`), sans leurs mots :

- **Le fort les trouve tous** ; l'ordinaire en manque cinq, chaque fois avec
  assurance.
- **Quatre écartés** (`retenu: false`, `raison`) : un joueur y a vu une
  ambiguïté ou une autre réponse. Le Sphinx refuserait peut-être une bonne
  réponse, et le doute ne se lève pas sans le lire.
- **La difficulté** : facile quand les deux trouvent, difficile quand
  l'ordinaire se trompe avec assurance — l'échelle des énigmes. Un problème
  laisse le temps de poser son raisonnement, et presque tout serait tombé
  facile : un problème que l'ordinaire trouve et que son auteur jugeait
  difficile se dit moyen.

**La réserve : 36 problèmes** (`server/content/sphinx/problemes.json`) — 17 à
un nombre, 19 à un choix ; 26 faciles, 6 moyens, 4 difficiles.

## La regarder

```bash
retours/2026-11-25/le-probleme-du-sphinx/construire.sh /tmp/probleme   # la page, l'accueil, le Sphinx du dépôt
cd /tmp/probleme && python3 -m http.server 8766                        # puis http://localhost:8766/local.html
```
