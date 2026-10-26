// Contenu écrit à la main pour la maquette : les lieux de l'Épingle, les frises,
// les « Qui suis-je ? » et les répliques. Le reste vient de la vraie base.

window.FRANCE = [
  [2.55,51.08],[1.85,50.95],[1.6,50.73],[1.6,50.2],[1.08,49.92],[0.1,49.5],[-0.3,49.3],[-1.25,49.4],[-1.6,49.65],[-1.95,49.7],
  [-1.6,48.84],[-2.0,48.65],[-3.05,48.8],[-4.0,48.72],[-4.77,48.4],[-4.73,48.04],[-4.2,47.8],[-3.4,47.7],[-3.1,47.5],[-2.2,47.27],
  [-2.2,47.0],[-1.8,46.5],[-1.15,46.15],[-1.05,45.62],[-1.2,44.65],[-1.56,43.48],[-1.78,43.36],[-1.4,43.05],[-0.7,42.8],[0.7,42.7],
  [1.7,42.5],[2.6,42.4],[3.17,42.43],[3.05,42.7],[3.2,43.2],[3.5,43.28],[3.7,43.4],[4.0,43.55],[4.6,43.4],[5.37,43.3],
  [5.93,43.1],[6.65,43.25],[7.0,43.55],[7.27,43.7],[7.5,43.78],[7.0,44.2],[6.9,44.7],[7.0,45.3],[6.8,45.85],[6.15,46.15],
  [6.1,46.6],[6.9,47.3],[7.55,47.6],[7.6,48.2],[7.8,48.6],[8.2,48.97],[7.0,49.15],[6.4,49.47],[5.8,49.55],[4.85,49.8],
  [4.85,50.15],[4.2,49.98],[3.7,50.3],[3.1,50.8]
];
window.CORSE = [[9.35,43.0],[9.55,42.6],[9.4,41.4],[8.8,41.5],[8.6,42.0],[8.7,42.6]];
window.VILLES = [['Paris',2.35,48.86],['Lyon',4.84,45.76],['Marseille',5.37,43.3],['Bordeaux',-0.58,44.84],['Lille',3.06,50.63],['Nantes',-1.55,47.22],['Strasbourg',7.75,48.58]];

window.EPINGLES = [
  { theme: 'Les grands sièges', lieux: [
    { nom: 'Alésia', ville: "Alise-Sainte-Reine, en Côte-d'Or", lat: 47.537, lon: 4.5, date: '52 av. J.-C.', an: -52,
      recit: "Vercingétorix s'enferme avec son armée sur un plateau fortifié. César l'encercle et attend qu'il se rende.", q: 'Où se trouvait Alésia ?',
      savais: "César fit bâtir deux lignes de fortifications : 15 km tournées vers la ville, 21 km vers l'extérieur, contre l'armée venue la délivrer." },
    { nom: 'Orléans', ville: 'Orléans, dans le Loiret', lat: 47.902, lon: 1.909, date: '1429', an: 1429,
      recit: "Une jeune fille de dix-sept ans entraîne les troupes du roi et fait lever le siège anglais en neuf jours.", q: 'Quelle ville a-t-elle délivrée ?',
      savais: "Depuis 1430, la ville fête Jeanne d'Arc chaque année au début du mois de mai." },
    { nom: 'La Rochelle', ville: 'La Rochelle, en Charente-Maritime', lat: 46.16, lon: -1.151, date: '1627 – 1628', an: 1628,
      recit: "Pour affamer une ville protestante, Richelieu fait barrer son port d'une digue de 1 500 mètres.", q: 'Où se trouve cette ville ?',
      savais: "Le siège dura plus d'un an : la ville passa d'environ 27 000 habitants à 5 000." }
  ]},
  { theme: 'Ils sont nés ici', lieux: [
    { nom: 'Domrémy', ville: 'Domrémy-la-Pucelle, dans les Vosges', lat: 48.443, lon: 5.674, date: 'vers 1412', an: 1412,
      recit: "Fille de paysans, elle entend des voix dans le jardin de son père et part rejoindre le roi à Chinon.", q: "Où est née Jeanne d'Arc ?",
      savais: "Sa maison natale existe toujours : on la visite au bord de la Meuse." },
    { nom: 'Ajaccio', ville: 'Ajaccio, en Corse', lat: 41.919, lon: 8.738, date: '1769', an: 1769,
      recit: "Le futur empereur naît dans une famille de petite noblesse, sur une île qui vient de changer de pays.", q: 'Où est né Napoléon Bonaparte ?',
      savais: "La Corse était devenue française un an plus tôt, en 1768." },
    { nom: 'Besançon', ville: 'Besançon, dans le Doubs', lat: 47.238, lon: 6.024, date: '1802', an: 1802,
      recit: "« Ce siècle avait deux ans ! » : c'est ainsi que l'auteur des Misérables raconte sa propre naissance.", q: 'Où est né Victor Hugo ?',
      savais: "Il n'y a vécu que ses premiers mois : son père, officier, fut vite muté ailleurs." }
  ]},
  { theme: "Les lieux de l'art", lieux: [
    { nom: 'Lascaux', ville: 'Montignac, en Dordogne', lat: 45.054, lon: 1.169, date: '1940', an: 1940,
      recit: "En septembre, quatre adolescents suivent leur chien dans un trou et découvrent des taureaux peints il y a environ 18 000 ans.", q: 'Où se trouve la grotte de Lascaux ?',
      savais: "Fermée au public depuis 1963 pour protéger les peintures, elle se visite en réplique." },
    { nom: 'Arles', ville: 'Arles, dans les Bouches-du-Rhône', lat: 43.677, lon: 4.631, date: '1888', an: 1888,
      recit: "Un peintre hollandais loue une maison jaune et rêve d'y fonder un atelier du Midi.", q: 'Où Van Gogh peint-il ses Tournesols ?',
      savais: "En quinze mois sur place, il peint près de 200 tableaux." },
    { nom: 'Giverny', ville: "Giverny, dans l'Eure", lat: 49.075, lon: 1.533, date: '1883', an: 1883,
      recit: "Un peintre impressionniste s'installe dans un village normand et y creuse un bassin couvert de nymphéas.", q: 'Où vivait Claude Monet ?',
      savais: "Il y a vécu 43 ans, jusqu'à sa mort en 1926 ; ses jardins se visitent." }
  ]},
  { theme: 'Lieux de mémoire', lieux: [
    { nom: 'Bayeux', ville: 'Bayeux, dans le Calvados', lat: 49.276, lon: -0.703, date: '1066', an: 1066,
      recit: "Une longue toile brodée raconte comment Guillaume, duc de Normandie, a conquis l'Angleterre.", q: 'Où est exposée cette tapisserie ?',
      savais: "Elle mesure près de 70 mètres de long, et c'est en réalité une broderie." },
    { nom: 'Omaha Beach', ville: 'Colleville-sur-Mer, dans le Calvados', lat: 49.36, lon: -0.85, date: '6 juin 1944', an: 1944,
      recit: "À l'aube, des milliers de soldats américains débarquent sur une plage normande sous le feu allemand.", q: 'Où se trouve Omaha Beach ?',
      savais: "Le cimetière américain qui domine la plage compte plus de 9 000 tombes." },
    { nom: 'Verdun', ville: 'Verdun, dans la Meuse', lat: 49.16, lon: 5.384, date: '1916', an: 1916,
      recit: "Français et Allemands s'y affrontent pendant des mois ; plus de 300 000 soldats y meurent.", q: 'Où se trouve Verdun ?',
      savais: "La bataille dura environ 300 jours, de février à décembre 1916." }
  ]},
  { theme: 'Lieux sacrés', lieux: [
    { nom: 'Reims', ville: 'Reims, dans la Marne', lat: 49.258, lon: 4.032, date: '1429', an: 1429,
      recit: "Pendant des siècles, les rois de France viennent s'y faire sacrer dans la cathédrale.", q: 'Où les rois étaient-ils sacrés ?',
      savais: "Charles VII y est sacré en 1429, avec Jeanne d'Arc à ses côtés." },
    { nom: 'Lourdes', ville: 'Lourdes, dans les Hautes-Pyrénées', lat: 43.095, lon: -0.046, date: '1858', an: 1858,
      recit: "Une jeune fille de quatorze ans, Bernadette, raconte avoir vu une dame dans une grotte au bord du gave.", q: 'Où se trouve cette grotte ?',
      savais: "Plusieurs millions de pèlerins y viennent chaque année." },
    { nom: 'Carnac', ville: 'Carnac, dans le Morbihan', lat: 47.584, lon: -3.078, date: 'il y a 6 000 ans', an: -4500,
      recit: "Des milliers de pierres dressées s'alignent sur des kilomètres, sans qu'on sache vraiment pourquoi.", q: 'Où se trouvent ces alignements ?',
      savais: "On y compte plus de 3 000 menhirs, dressés il y a plus de 6 000 ans." }
  ]},
  { theme: 'Premières et savoir-faire', lieux: [
    { nom: 'Chamonix', ville: 'Chamonix, en Haute-Savoie', lat: 45.924, lon: 6.869, date: '1924', an: 1924,
      recit: "Une petite ville de montagne accueille les tout premiers Jeux olympiques d'hiver.", q: 'Où ont eu lieu ces Jeux ?',
      savais: "Au programme : seize épreuves, dont le curling." },
    { nom: 'Toulouse', ville: 'Toulouse, en Haute-Garonne', lat: 43.604, lon: 1.444, date: '1969', an: 1969,
      recit: "Le 2 mars, l'avion supersonique franco-britannique Concorde décolle pour son premier vol.", q: "D'où a-t-il décollé ?",
      savais: "Ce premier vol d'essai a duré 27 minutes." },
    { nom: 'Grasse', ville: 'Grasse, dans les Alpes-Maritimes', lat: 43.658, lon: 6.924, date: '2018', an: 2018,
      recit: "Une ville de Provence cultive la rose et le jasmin pour les grands parfumeurs depuis des siècles.", q: 'Quelle est la capitale du parfum ?',
      savais: "Ses savoir-faire du parfum sont inscrits au patrimoine immatériel de l'UNESCO depuis 2018." }
  ]}
];

window.FRISES = [
  { theme: 'La conquête spatiale', evts: [
    ['Spoutnik 1, premier satellite artificiel', 1957], ["Youri Gagarine, premier homme dans l'espace", 1961],
    ["Valentina Terechkova, première femme dans l'espace", 1963], ['Premiers pas sur la Lune', 1969],
    ['Premier vol de la navette Columbia', 1981], ['Lancement du télescope Hubble', 1990],
    ['Premier module de la Station spatiale internationale', 1998]],
    savais: "Le vol de Gagarine a duré 108 minutes : un seul tour de la Terre, et il a sauté en parachute avant l'atterrissage." },
  { theme: 'Les inventions', evts: [
    ["Gutenberg imprime avec des caractères mobiles", 1450], ['Premier vol humain en montgolfière', 1783],
    ['Niépce réalise la première photographie', 1826], ['Bell dépose le brevet du téléphone', 1876],
    ['Première projection publique des frères Lumière', 1895], ['Premier vol motorisé des frères Wright', 1903],
    ['Tim Berners-Lee invente le Web', 1989]],
    savais: "La première photographie de Niépce a demandé plusieurs heures de pose : on y voit les toits vus de sa fenêtre." },
  { theme: 'Histoire de France', evts: [
    ['Charlemagne couronné empereur', 800], ['Victoire de François Ier à Marignan', 1515],
    ["Henri IV signe l'édit de Nantes", 1598], ['Prise de la Bastille', 1789],
    ['Napoléon sacré empereur', 1804], ["Abolition définitive de l'esclavage", 1848],
    ['Les Françaises obtiennent le droit de vote', 1944]],
    savais: "Le soir du 14 juillet 1789, la Bastille ne gardait que sept prisonniers." },
  { theme: 'La musique populaire', evts: [
    ['Elvis Presley enregistre Heartbreak Hotel', 1956], ['Premier album des Beatles', 1963],
    ['Festival de Woodstock', 1969], ['Sony lance le Walkman', 1979],
    ['Michael Jackson sort Thriller', 1982], ["Apple lance l'iPod", 2001], ['Lancement de Spotify', 2008]],
    savais: "Thriller reste l'album le plus vendu de l'histoire, avec plus de 70 millions d'exemplaires estimés." }
];

window.QUI = [
  { cles: ['curie'], rep: 'Marie Curie', ind: ['Je suis née à Varsovie.', "J'ai reçu deux prix Nobel, dans deux sciences différentes.", "J'ai découvert le polonium, nommé d'après mon pays natal.", 'Mon mari s’appelait Pierre.', 'Je repose au Panthéon.'],
    savais: 'Elle est la première femme à avoir reçu un prix Nobel, en 1903.' },
  { cles: ['napoleon', 'bonaparte'], rep: 'Napoléon Bonaparte', ind: ['Je suis né sur une île.', 'Je suis mort sur une autre île.', "J'ai donné mon nom à un code de lois.", "J'ai perdu à Waterloo.", 'Je me suis sacré empereur à Notre-Dame en 1804.'],
    savais: "Il est mort à Sainte-Hélène, une île perdue au milieu de l'Atlantique sud." },
  { cles: ['vinci', 'leonard'], rep: 'Léonard de Vinci', ind: ["J'ai dessiné des machines volantes.", "J'écrivais souvent à l'envers, en miroir.", "J'ai fini ma vie à Amboise, invité par François Ier.", "J'ai peint La Cène.", "Mon tableau le plus célèbre est au Louvre, derrière une vitre."],
    savais: "Il est mort au Clos Lucé, à Amboise, en 1519." },
  { cles: ['verne'], rep: 'Jules Verne', ind: ['Je suis né à Nantes.', "J'ai imaginé un sous-marin nommé Nautilus.", "J'ai envoyé mes héros au centre de la Terre.", 'Mon éditeur s’appelait Hetzel.', 'Mon Phileas Fogg fait le tour du monde en 80 jours.'],
    savais: 'Il est l’un des auteurs les plus traduits au monde.' },
  { cles: ['eiffel'], rep: 'Gustave Eiffel', ind: ['Je suis ingénieur, né à Dijon.', "J'ai conçu la structure intérieure de la statue de la Liberté.", "J'ai construit le viaduc de Garabit.", 'Ma tour la plus célèbre devait être démontée au bout de vingt ans.', 'Elle domine Paris depuis 1889.'],
    savais: "Sa tour a été sauvée parce qu'elle servait d'antenne de radio." },
  { cles: ['chanel', 'coco'], rep: 'Coco Chanel', ind: ['Je suis née à Saumur.', "J'ai grandi dans un orphelinat.", "J'ai rendu célèbre la petite robe noire.", 'Mon prénom de baptême est Gabrielle.', 'Mon parfum le plus connu porte le numéro 5.'],
    savais: 'Le N° 5 a été lancé en 1921.' },
  { cles: ['pasteur'], rep: 'Louis Pasteur', ind: ['Je suis né dans le Jura.', 'J’ai sauvé les élevages de vers à soie.', 'Une méthode pour conserver le lait porte mon nom.', "J'ai mis au point un vaccin contre la rage.", 'Un institut parisien porte mon nom.'],
    savais: 'En 1885, il soigne de la rage un garçon de neuf ans, Joseph Meister.' },
  { cles: ['moliere', 'poquelin'], rep: 'Molière', ind: ['Mon vrai nom est Jean-Baptiste Poquelin.', "J'ai dirigé L'Illustre Théâtre.", "J'ai écrit pour Louis XIV.", 'On appelle le français « la langue de » mon nom.', "J'ai écrit Le Malade imaginaire."],
    savais: "Il est mort en 1673, quelques heures après avoir joué Le Malade imaginaire." },
  { cles: ['mozart'], rep: 'Wolfgang Amadeus Mozart', ind: ['Je suis né à Salzbourg.', "Enfant, j'ai joué devant les cours d'Europe.", "J'ai écrit un opéra où un oiseleur s'appelle Papageno.", 'Mon deuxième prénom est Amadeus.', 'Mon Requiem est resté inachevé.'],
    savais: "Il a composé plus de 600 œuvres et il est mort à 35 ans." }
];

window.REPLIQUES = [
  { avant: "T'as de beaux", apres: ', tu sais.', mot: 'yeux', leurres: ['souliers', 'restes', 'cheveux'], qui: 'Jean Gabin', autres: ['Michel Simon', 'Louis Jouvet'], film: 'Le Quai des brumes, 1938' },
  { avant: "Atmosphère, atmosphère, est-ce que j'ai une", apres: " d'atmosphère ?", mot: 'gueule', leurres: ['tête', 'allure', 'mine'], qui: 'Arletty', autres: ['Michèle Morgan', 'Simone Signoret'], film: 'Hôtel du Nord, 1938' },
  { avant: "Les cons, ça ose tout. C'est même à ça qu'on les", apres: '.', mot: 'reconnaît', leurres: ['repère', 'aime', 'évite'], qui: 'Lino Ventura', autres: ['Jean Gabin', 'Bernard Blier'], film: 'Les Tontons flingueurs, 1963' },
  { avant: "J'ai glissé,", apres: ' !', mot: 'chef', leurres: ['sergent', 'patron', 'maman'], qui: 'Jean Lefebvre', autres: ['Pierre Mondy', 'Aldo Maccione'], film: 'Mais où est donc passée la 7e compagnie ?, 1973' },
  { avant: 'Non. Je suis ton', apres: '.', mot: 'père', leurres: ['frère', 'maître', 'ami'], qui: 'Dark Vador', autres: ['Yoda', 'Han Solo'], film: "L'Empire contre-attaque, 1980" },
  { avant: 'Houston, nous avons un', apres: '.', mot: 'problème', leurres: ['souci', 'visiteur', 'retard'], qui: 'Tom Hanks', autres: ['Kevin Costner', 'Ed Harris'], film: 'Apollo 13, 1995' },
  { avant: 'Je suis le roi du', apres: ' !', mot: 'monde', leurres: ['bateau', 'pétrole', 'ciel'], qui: 'Leonardo DiCaprio', autres: ['Brad Pitt', 'Johnny Depp'], film: 'Titanic, 1997' },
  { avant: 'Il faut que tout change pour que rien ne', apres: '.', mot: 'change', leurres: ['bouge', 'meure', 'cesse'], qui: 'Alain Delon', autres: ['Jean-Paul Belmondo', 'Burt Lancaster'], film: 'Le Guépard, 1963' },
  { avant: 'Ils sont fous, ces', apres: ' !', mot: 'Romains', leurres: ['Gaulois', 'Bretons', 'Goths'], qui: 'Obélix', autres: ['Astérix', 'Panoramix'], film: 'Astérix, depuis 1959' },
  { avant: "Toto, j'ai l'impression que nous ne sommes plus au", apres: '.', mot: 'Kansas', leurres: ['Texas', 'Canada', 'cinéma'], qui: 'Judy Garland', autres: ['Shirley Temple', 'Marilyn Monroe'], film: "Le Magicien d'Oz, 1939" },
  { avant: "Maman disait toujours : la vie, c'est comme une boîte de", apres: '.', mot: 'chocolats', leurres: ['biscuits', 'conserve', 'nuit'], qui: 'Tom Hanks', autres: ['Robin Williams', 'Kevin Bacon'], film: 'Forrest Gump, 1994' },
  { avant: 'Mon nom est Bond,', apres: ' Bond.', mot: 'James', leurres: ['John', 'Jack', 'Jimmy'], qui: 'Sean Connery', autres: ['Roger Moore', 'Michael Caine'], film: 'James Bond 007 contre Dr No, 1962' }
];

// Ajouts de la version 2 : de quoi ne pas resservir la même manche avant une semaine.
window.EPINGLES.push(
  { theme: 'Châteaux et remparts', lieux: [
    { nom: 'Versailles', ville: 'Versailles, dans les Yvelines', lat: 48.805, lon: 2.12, date: '1682', an: 1682,
      recit: "Louis XIV quitte Paris et installe toute la cour dans l'ancien pavillon de chasse de son père, agrandi en palais.", q: 'Où la cour s’installe-t-elle ?',
      savais: 'La galerie des Glaces compte 357 miroirs.' },
    { nom: 'Chambord', ville: 'Chambord, dans le Loir-et-Cher', lat: 47.616, lon: 1.517, date: '1519', an: 1519,
      recit: "François Ier lance au bord de la forêt de Sologne le chantier du plus grand château de la Loire.", q: 'Où se dresse ce château ?',
      savais: 'Son escalier à double révolution permet à deux personnes de monter sans jamais se croiser.' },
    { nom: 'Carcassonne', ville: "Carcassonne, dans l'Aude", lat: 43.206, lon: 2.364, date: '1853', an: 1853,
      recit: "L'architecte Viollet-le-Duc entreprend de restaurer une cité médiévale fortifiée qui tombait en ruine.", q: 'Où se trouve cette cité ?',
      savais: 'Sa double enceinte compte 52 tours.' }
  ]},
  { theme: 'Envols et inventions', lieux: [
    { nom: 'Annonay', ville: 'Annonay, en Ardèche', lat: 45.24, lon: 4.67, date: '1783', an: 1783,
      recit: "Deux frères papetiers font s'élever devant la foule un grand ballon de toile et de papier gonflé d'air chaud.", q: 'Où les Montgolfier font-ils voler leur ballon ?',
      savais: 'Quelques mois plus tard, à Paris, deux hommes volaient pour la première fois à bord d’une montgolfière.' },
    { nom: 'Le Bourget', ville: 'Le Bourget, en Seine-Saint-Denis', lat: 48.95, lon: 2.43, date: '1927', an: 1927,
      recit: "Un jeune pilote américain se pose de nuit après avoir traversé seul l'Atlantique, sans escale.", q: 'Où Lindbergh atterrit-il ?',
      savais: 'Il avait volé trente-trois heures et demie sans dormir.' },
    { nom: 'La Ciotat', ville: 'La Ciotat, dans les Bouches-du-Rhône', lat: 43.175, lon: 5.605, date: '1895', an: 1895,
      recit: "Les frères Lumière filment un train qui entre en gare : l'un des tout premiers films de l'histoire.", q: 'Dans quelle gare ?',
      savais: 'On raconte que les spectateurs fuyaient devant le train à l’écran ; aucune preuve ne l’atteste.' }
  ]}
);
window.FRISES.push(
  { theme: 'Les Jeux olympiques', evts: [
    ['Premiers Jeux olympiques modernes, à Athènes', 1896], ['Des femmes concourent pour la première fois, à Paris', 1900],
    ["Premiers Jeux d'hiver, à Chamonix", 1924], ['Jesse Owens gagne quatre médailles d’or à Berlin', 1936],
    ['Jeux d’hiver de Grenoble', 1968], ['Nadia Comaneci obtient le premier 10 parfait', 1976], ['Paris accueille les Jeux pour la troisième fois', 2024]],
    savais: 'À Athènes en 1896, les vainqueurs recevaient une médaille d’argent et une branche d’olivier.' },
  { theme: 'Les chefs-d’œuvre de la peinture', evts: [
    ['Léonard de Vinci commence La Joconde', 1503], ['Vélasquez peint Les Ménines', 1656],
    ['Delacroix peint La Liberté guidant le peuple', 1830], ['Van Gogh peint La Nuit étoilée', 1889],
    ['Munch peint Le Cri', 1893], ['Klimt peint Le Baiser', 1908], ['Picasso peint Guernica', 1937]],
    savais: 'Picasso a peint Guernica, près de huit mètres de long, en à peine plus d’un mois.' }
);
window.QUI.push(
  { cles: ['gaulle'], rep: 'Charles de Gaulle', ind: ['Je suis né à Lille.', "J'ai écrit un livre intitulé Le Fil de l'épée.", "J'ai lancé un appel à la radio de Londres.", "J'ai fondé la Ve République.", 'Un aéroport parisien porte mon nom.'],
    savais: "L'appel du 18 juin 1940 n'a pas été enregistré : l'enregistrement qu'on entend date du 22 juin." },
  { cles: ['einstein'], rep: 'Albert Einstein', ind: ['Je suis né à Ulm, en Allemagne.', "J'ai travaillé dans un bureau des brevets, à Berne.", "J'ai reçu le prix Nobel pour l'effet photoélectrique.", 'Une photo me montre tirant la langue.', 'Ma formule la plus célèbre est E = mc².'],
    savais: 'Son prix Nobel de 1921 ne récompense pas la relativité.' },
  { cles: ['cleopatre'], rep: 'Cléopâtre', ind: ["J'ai régné sur l'Égypte.", 'Ma famille venait de Grèce.', "J'ai aimé Jules César, puis Marc Antoine.", 'On raconte que je suis morte mordue par un serpent.', 'Pascal a écrit que si mon nez avait été plus court, la face du monde aurait changé.'],
    savais: 'Elle a vécu plus près de notre époque que de la construction de la pyramide de Khéops.' },
  { cles: ['piaf'], rep: 'Édith Piaf', ind: ['Je suis née à Paris, en 1915.', 'On m’appelait « la Môme ».', "J'ai aimé un boxeur, Marcel Cerdan.", "J'ai chanté Hymne à l'amour.", 'Non, je ne regrette rien.'],
    savais: 'Elle mesurait un mètre quarante-sept.' },
  { cles: ['colomb'], rep: 'Christophe Colomb', ind: ['Je suis né à Gênes.', "Les souverains d'Espagne ont financé mon voyage.", 'Mes navires s’appelaient la Niña, la Pinta et la Santa María.', 'Je pensais arriver aux Indes.', "J'ai abordé l'Amérique en 1492."],
    savais: "Il est mort convaincu d'avoir atteint l'Asie." },
  { cles: ['antoinette'], rep: 'Marie-Antoinette', ind: ['Je suis née à Vienne.', "Ma mère était l'impératrice Marie-Thérèse.", "J'ai fait construire un hameau à Versailles.", 'On m’appelait « l’Autrichienne ».', "J'ai été guillotinée en 1793."],
    savais: '« Qu’ils mangent de la brioche » : elle ne l’a sans doute jamais dit.' }
);
window.REPLIQUES.push(
  { avant: "L'enfer, c'est les", apres: '.', mot: 'autres', leurres: ['hommes', 'voisins', 'remords'], qui: 'Jean-Paul Sartre', autres: ['Albert Camus', 'Simone de Beauvoir'], film: 'Huis clos, au théâtre, 1944' },
  { avant: 'Rodrigue, as-tu du', apres: ' ?', mot: 'cœur', leurres: ['courage', 'temps', 'feu'], qui: 'Don Diègue', autres: ['Chimène', 'Don Gormas'], film: 'Le Cid, de Corneille, 1637' },
  { avant: 'Hasta la vista,', apres: '.', mot: 'baby', leurres: ['amigo', 'señor', 'muchacho'], qui: 'Arnold Schwarzenegger', autres: ['Sylvester Stallone', 'Bruce Willis'], film: 'Terminator 2, 1991' },
  { avant: 'E.T. téléphone', apres: '.', mot: 'maison', leurres: ['Elliott', 'au ciel', 'la nuit'], qui: 'E.T.', autres: ['Elliott', 'Gertie'], film: "E.T. l'extra-terrestre, 1982" },
  { avant: "Je vais lui faire une offre qu'il ne pourra pas", apres: '.', mot: 'refuser', leurres: ['payer', 'oublier', 'comprendre'], qui: 'Marlon Brando', autres: ['Al Pacino', 'Robert De Niro'], film: 'Le Parrain, 1972' },
  { avant: 'Élémentaire, mon cher', apres: '.', mot: 'Watson', leurres: ['Hastings', 'ami', 'Lestrade'], qui: 'Sherlock Holmes', autres: ['Hercule Poirot', 'Arsène Lupin'], film: 'Les films de Sherlock Holmes, dès 1929' },
  { avant: 'Allô maman,', apres: ' !', mot: 'bobo', leurres: ['dodo', 'bisou', 'au secours'], qui: 'Alain Souchon', autres: ['Laurent Voulzy', 'Michel Jonasz'], film: 'une chanson, 1977' }
);
