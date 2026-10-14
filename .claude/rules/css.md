---
paths:
  - "client/src/**/*.css"
  - "shared/typographie.ts"
  - "server/test/{design,typographie}.test.ts"
---

# Le CSS du client, et la typographie

## Les jetons

- **Côté client** : `--accent-text` pour ce qui s'écrit, `--accent-text-hover`
  pour son survol, `--accent` pour les aplats (le contraste d'Ivoire en
  dépend) ; les trois métaux d'un palier écrivent en `--bronze-text`,
  `--argent-text` et `--or-text` ; les petites boîtes prennent
  `--radius-xs`, et l'or du décor des fonds se lit dans `--fond-or`, posé
  sur `.carte-fond` (`design.test.ts` y veille) ; le focus n'a qu'un
  anneau, `--focus`, posé une fois pour tout élément
  (`:where(…):focus-visible`) — un composant n'en règle que
  l'`outline-offset`. Aucun texte ne descend sous `--t-label` (0,6875 rem,
  les 11 px de `.label`, en `rem` pour suivre le texte agrandi) : la garde
  ne relit que sa liste de sélecteurs, et `.chiffre dt` (10 px) comme
  `.bilan-you` (0,68 rem) y échappent encore.
- **Une convention s'écrit en dur**, et aucun thème ne la repeint : le
  compteur des gros boutons, blanc sur rouge (`.gros-compteur`,
  `design.test.ts`) — `--alert` vire au jaune sous Braises.

## Le texte

- **La typographie se pose à l'affichage, jamais en base**
  (`shared/typographie.ts`) : `espacesFines` ne remplace que les espaces
  déjà là devant ? ! ; : — « Why? » reste tel quel —, en pose toujours dans
  « », colle l'inversion (« a-t-il ») par un gluon U+2060, et se repasse
  sans rien changer — le trait d'union insécable U+2011 n'est ni dans
  Figtree ni dans Cormorant : il viendrait d'une autre police, ou en carré
  sous Windows 10.
  `formatNumber` s'écrit sans `Intl` (règle `client.md`) et ne groupe les
  milliers qu'à cinq chiffres : « 1889 » reste une année. Un rang s'écrit
  au féminin (« 1ʳᵉ place »). `typographie.test.ts` compare `formatNumber`
  à `toLocaleString('fr-FR')` sur des milliers de nombres.

## Les pièges

- **En CSS, `transform` se compose APRÈS `rotate`**, et une animation qui pose
  `transform` écrase celui de l'élément : le toast, centré par
  `translateX(-50%)`, partait sur la droite. Centre par marges.
- **Cormorant (`--serif`) écrit ses chiffres à l'ancienne** : un nombre qu'on
  lit seul — un score, une place, un solde — pose `lining-nums`, sans quoi
  « 0 bonne réponse » se lisait « O bonne réponse ». Et
  `font-variant-numeric` est une seule propriété : `tabular-nums` seul efface
  le `lining-nums` d'une règle plus large — écris les deux
  (`design.test.ts`).
- **Chaque taille de police d'un emoji se met en forme à part** : des
  particules à vingt-deux tailles tirées au hasard coûtaient 100 à 230 ms de
  mise en forme à la révélation, au processeur ×4 ; à une seule taille,
  réduites par `transform: scale()`, 20 ms (la gerbe, règle `themes.md`).
  Une taille qui varie d'un élément à l'autre passe par `scale()`, jamais
  par `font-size` — et se réduit, sans s'agrandir : l'emoji reste net. Un
  emoji dans un `content:` compte pour `emojis.test.ts`, comme un texte.
- **Une classe assemblée couvre tout son préfixe** : la garde des classes
  mortes (S7, `design.test.ts`) tient pour vivante toute classe qui commence
  par un préfixe construit dans le code (`gerbe-${…}`) — `.gerbe-a-gagner`
  n'est plus posée par rien et passe. Une classe qu'on retire se cherche à
  la main.
