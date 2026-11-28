# La Pyramide du Sphinx : la maquette d'un étage

Le 28 novembre 2026. Le joueur le plus avancé approche des douze maîtres des
sentiers, et le propriétaire cherche ce qui vient ensuite. Après plusieurs
pistes écartées (des sentiers à règle, la réponse la plus rare, une voyante) :
« que penses tu d'un sentier spéciale énigme ? Ou pas sentier mais nouveau
mode de jeu débloqué. Le sphinx amène des énigmes pour débloquer les divins.
On pourrait imaginer un truc ultra complet d'énigme ? » Puis, sur la
proposition d'une pyramide à étages : « Go fait une maquette jouable ».

Une page, sans dépendance, hors de l'application : rien ici n'est servi par
FiestApp. Elle est publiée en artefact privé (le lien est dans la conversation
du 28 novembre 2026). Elle reprend la boîte, les couleurs et la police pixel de
la visite du Sphinx (`retours/2026-11-24/le-sphinx/`).

## Ce qu'elle montre

1. **L'arrivée** : le Sphinx naît en mosaïque sur sa boîte et ouvre sa
   pyramide à qui lui a répondu cinq fois sur l'accueil.
2. **L'étage** : six salles rangées en pyramide — une, deux, trois —, chacune
   sa famille d'énigmes et son glyphe de neuf pixels, et la porte du gardien à
   la base. On entre où l'on veut.
3. **Les vers** et **les mots** : une énigme et un logogriphe, la troisième
   famille du recueil de 1858 que la visite ne pose pas encore. Trois essais,
   « Tu brûles… », « Plus tard », la langue au chat : les règles de la visite.
4. **Les problèmes** : un récit, un nombre à taper, et la solution pas à pas.
5. **Les menteurs** : trois scribes, chacun une vérité et un mensonge ; un seul
   essai, d'un toucher.
6. **Les codes** : une tablette chiffrée et sa molette. La clé est la réponse
   d'une autre salle : les salles se répondent.
7. **Les machines** : on ne lit plus un problème, on le joue **contre le
   Sphinx**. Dix dalles, des stèles de deux, qui ne peut plus poser a perdu. Il
   ne se trompe jamais ; on rejoue autant qu'on veut, jusqu'à trouver comment
   le battre.
8. **La porte du gardien** : une énigme faite des réponses des six salles. Elle
   écoute à quatre glyphes d'or, et rend un titre.

Le bouton « Maquette », sur l'étage : avoir quatre glyphes d'or d'un coup,
moins de mouvement, tout recommencer. Ce qu'on a joué reste sur le téléphone.

## Ce qui est inventé

**Tout ce qu'elle pose.** Le propriétaire joue aussi au Sphinx : rien ne vient
de sa réserve (`server/content/sphinx/`), et aucune réponse de la maquette n'en
est une — vérifié par programme, sans rien lire ni afficher. Les deux pièces en
vers sont écrites « à la manière du recueil », pas tirées de lui. Ici les
réponses vivent dans la page ; dans l'application, elles ne quitteraient pas le
serveur avant la fin de la salle (invariant 1).

## Les règles qu'elle essaie

- **L'or et le sable.** Une salle résolue rend son mot et un glyphe d'or. Une
  salle perdue, ou la langue au chat, rend son mot quand même — il sert à
  l'énigme du gardien — mais s'ensable, sans or. Perdre ne bloque donc jamais
  l'étage ; c'est la porte qui compte l'or.
- **Les essais suivent la visite** : trois pour un mot ou un nombre, un seul
  pour un choix, et un mot qui n'est pas un nombre ne coûte rien.
- **Une machine se rejoue à volonté** : on n'y cherche pas une réponse mais une
  façon de jouer, et la trouver demande de perdre.
- **Pas d'indice**, comme dans la visite ; la solution se déroule à la fin.
- **Rien ne presse** : « Plus tard » garde les essais, une salle attend des
  jours.

## Ce qui reste à décider

- **Les mots des Divins.** La visite en souffle un neuf par jour en moyenne, un
  choix du 25 novembre 2026. Un mode où l'on enchaîne les énigmes ne peut pas
  en souffler au même tarif : la maquette n'en donne aucun.
- **La réserve.** Le Sphinx a 148 pièces, et une pièce vue ne revient jamais :
  la Pyramide viderait ses visites. Il lui faut la sienne — les logogriphes et
  les charades que le recueil a encore, et les familles qui se génèrent (les
  menteurs, les codes, les machines).
- **L'énigme du gardien** lie les réponses d'un étage : ses six pièces
  s'écrivent ensemble, et une salle perdue ne peut pas être remplacée par une
  autre pièce sans défaire l'énigme. D'où le sable.
- **Ce qui ouvre la Pyramide** (cinq énigmes résolues, ici), **ce qu'elle
  rend** (un titre, ici), et ce que devient un étage où trois salles se sont
  ensablées (ici, il se rebâtit).

## La relancer

```bash
bash retours/2026-11-28/la-pyramide/construire.sh /tmp/pyramide   # la page et le Sphinx peint
node retours/2026-11-28/la-pyramide/jouer.mjs /tmp/pyramide /tmp/pyramide/photos   # une partie entière, en 360 × 640
```

`jouer.mjs` joue les six salles et la porte, perd une partie de dalles puis la
gagne, photographie chaque écran, et sort en erreur si la page en lève une ou
si quelque chose déborde.
