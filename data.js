// ── Country names (ISO numeric → French name) ──
// Codes 9000+ = nations autoproclamées/non-reconnues (codes fictifs)
const NAMES = {
  // Afrique
  12:'Algérie',24:'Angola',204:'Bénin',72:'Botswana',854:'Burkina Faso',
  108:'Burundi',120:'Cameroun',132:'Cap-Vert',140:'Rép. Centrafricaine',
  148:'Tchad',174:'Comores',178:'Rép. du Congo',180:'RD Congo',262:'Djibouti',
  818:'Égypte',232:'Érythrée',231:'Éthiopie',266:'Gabon',270:'Gambie',
  288:'Ghana',324:'Guinée',624:'Guinée-Bissau',226:'Guinée Équatoriale',
  384:'Côte d\'Ivoire',404:'Kenya',426:'Lesotho',430:'Liberia',434:'Libye',
  450:'Madagascar',454:'Malawi',466:'Mali',478:'Mauritanie',480:'Maurice',
  504:'Maroc',508:'Mozambique',516:'Namibie',562:'Niger',566:'Nigeria',
  646:'Rwanda',678:'São Tomé-et-Príncipe',686:'Sénégal',694:'Sierra Leone',
  706:'Somalie',710:'Afrique du Sud',729:'Soudan',736:'Soudan du Sud',
  748:'Eswatini',768:'Togo',788:'Tunisie',800:'Ouganda',834:'Tanzanie',
  894:'Zambie',716:'Zimbabwe',
  // Amériques
  32:'Argentine',44:'Bahamas',52:'Barbade',84:'Belize',68:'Bolivie',
  76:'Brésil',124:'Canada',152:'Chili',170:'Colombie',188:'Costa Rica',
  192:'Cuba',214:'Rép. Dominicaine',218:'Équateur',222:'El Salvador',
  308:'Grenade',320:'Guatemala',328:'Guyana',332:'Haïti',340:'Honduras',
  388:'Jamaïque',484:'Mexique',558:'Nicaragua',591:'Panama',600:'Paraguay',
  604:'Pérou',630:'Porto Rico',659:'Saint-Kitts-et-Nevis',662:'Sainte-Lucie',
  670:'Saint-Vincent',740:'Suriname',780:'Trinité-et-Tobago',840:'États-Unis',
  858:'Uruguay',862:'Venezuela',304:'Groenland',
  // Asie
  4:'Afghanistan',50:'Bangladesh',64:'Bhoutan',96:'Brunei',116:'Cambodge',
  156:'Chine',356:'Inde',360:'Indonésie',364:'Iran',368:'Irak',392:'Japon',
  398:'Kazakhstan',408:'Corée du Nord',410:'Corée du Sud',417:'Kirghizstan',
  418:'Laos',458:'Malaisie',462:'Maldives',496:'Mongolie',104:'Myanmar',
  524:'Népal',512:'Oman',586:'Pakistan',608:'Philippines',682:'Arabie Saoudite',
  702:'Singapour',144:'Sri Lanka',760:'Syrie',762:'Tadjikistan',764:'Thaïlande',
  626:'Timor-Leste',795:'Turkménistan',860:'Ouzbékistan',704:'Viêt Nam',
  887:'Yémen',784:'Émirats Arabes Unis',414:'Koweït',634:'Qatar',48:'Bahreïn',
  // Europe
  8:'Albanie',20:'Andorre',40:'Autriche',51:'Arménie',31:'Azerbaïdjan',
  112:'Biélorussie',56:'Belgique',70:'Bosnie-Herzégovine',100:'Bulgarie',
  191:'Croatie',196:'Chypre',203:'Tchéquie',208:'Danemark',233:'Estonie',
  246:'Finlande',250:'France',268:'Géorgie',276:'Allemagne',300:'Grèce',
  348:'Hongrie',352:'Islande',372:'Irlande',380:'Italie',428:'Lettonie',
  438:'Liechtenstein',440:'Lituanie',442:'Luxembourg',470:'Malte',
  498:'Moldavie',492:'Monaco',499:'Monténégro',528:'Pays-Bas',578:'Norvège',
  616:'Pologne',620:'Portugal',642:'Roumanie',643:'Russie',674:'Saint-Marin',
  688:'Serbie',703:'Slovaquie',705:'Slovénie',724:'Espagne',752:'Suède',
  756:'Suisse',804:'Ukraine',826:'Royaume-Uni',336:'Vatican',807:'Macédoine du Nord',
  // Moyen-Orient
  275:'Palestine',376:'Israël',400:'Jordanie',422:'Liban',
  // Océanie
  36:'Australie',242:'Fidji',296:'Kiribati',584:'Îles Marshall',583:'Micronésie',
  520:'Nauru',554:'Nouvelle-Zélande',585:'Palaos',598:'Papouasie-N.-G.',
  882:'Samoa',90:'Îles Salomon',776:'Tonga',798:'Tuvalu',548:'Vanuatu',
  // Nations autoproclamées / non-reconnues (codes fictifs 9000+)
  9001:'Kosovo',9002:'Taiwan',9003:'Somaliland',9004:'Ossétie du Sud',
  9005:'Abkhazie',9006:'Transnistrie',9007:'Kurdistan',9008:'Sahara Occidental',
  9009:'Haut-Karabakh',9010:'Lougansk (LPR)',9011:'Donetsk (DPR)',9012:'Chypre du Nord',
  9020:'Cachemire',
};

// ── Country flags (ISO numeric → emoji) ──
const FLAGS = {
  4:'🇦🇫',8:'🇦🇱',12:'🇩🇿',20:'🇦🇩',24:'🇦🇴',31:'🇦🇿',32:'🇦🇷',36:'🇦🇺',
  40:'🇦🇹',44:'🇧🇸',48:'🇧🇭',50:'🇧🇩',51:'🇦🇲',52:'🇧🇧',56:'🇧🇪',
  64:'🇧🇹',68:'🇧🇴',70:'🇧🇦',72:'🇧🇼',76:'🇧🇷',84:'🇧🇿',90:'🇸🇧',
  96:'🇧🇳',100:'🇧🇬',104:'🇲🇲',108:'🇧🇮',112:'🇧🇾',116:'🇰🇭',120:'🇨🇲',
  124:'🇨🇦',132:'🇨🇻',140:'🇨🇫',144:'🇱🇰',148:'🇹🇩',152:'🇨🇱',156:'🇨🇳',
  170:'🇨🇴',174:'🇰🇲',178:'🇨🇬',180:'🇨🇩',188:'🇨🇷',191:'🇭🇷',192:'🇨🇺',
  196:'🇨🇾',203:'🇨🇿',204:'🇧🇯',208:'🇩🇰',214:'🇩🇴',218:'🇪🇨',222:'🇸🇻',
  226:'🇬🇶',231:'🇪🇹',232:'🇪🇷',233:'🇪🇪',242:'🇫🇯',246:'🇫🇮',250:'🇫🇷',
  262:'🇩🇯',266:'🇬🇦',268:'🇬🇪',270:'🇬🇲',276:'🇩🇪',288:'🇬🇭',296:'🇰🇮',
  300:'🇬🇷',304:'🇬🇱',308:'🇬🇩',320:'🇬🇹',324:'🇬🇳',328:'🇬🇾',332:'🇭🇹',336:'🇻🇦',
  340:'🇭🇳',348:'🇭🇺',352:'🇮🇸',356:'🇮🇳',360:'🇮🇩',364:'🇮🇷',368:'🇮🇶',
  372:'🇮🇪',376:'🇮🇱',380:'🇮🇹',384:'🇨🇮',388:'🇯🇲',392:'🇯🇵',398:'🇰🇿',
  400:'🇯🇴',404:'🇰🇪',408:'🇰🇵',410:'🇰🇷',414:'🇰🇼',417:'🇰🇬',418:'🇱🇦',
  422:'🇱🇧',426:'🇱🇸',428:'🇱🇻',430:'🇱🇷',434:'🇱🇾',438:'🇱🇮',440:'🇱🇹',
  442:'🇱🇺',450:'🇲🇬',454:'🇲🇼',458:'🇲🇾',462:'🇲🇻',466:'🇲🇱',470:'🇲🇹',
  478:'🇲🇷',480:'🇲🇺',484:'🇲🇽',492:'🇲🇨',496:'🇲🇳',498:'🇲🇩',499:'🇲🇪',
  504:'🇲🇦',508:'🇲🇿',512:'🇴🇲',516:'🇳🇦',520:'🇳🇷',524:'🇳🇵',528:'🇳🇱',
  548:'🇻🇺',554:'🇳🇿',558:'🇳🇮',562:'🇳🇪',566:'🇳🇬',578:'🇳🇴',583:'🇫🇲',
  584:'🇲🇭',585:'🇵🇼',586:'🇵🇰',591:'🇵🇦',598:'🇵🇬',600:'🇵🇾',604:'🇵🇪',
  608:'🇵🇭',616:'🇵🇱',620:'🇵🇹',624:'🇬🇼',626:'🇹🇱',630:'🇵🇷',634:'🇶🇦',
  642:'🇷🇴',643:'🇷🇺',646:'🇷🇼',659:'🇰🇳',662:'🇱🇨',670:'🇻🇨',674:'🇸🇲',
  678:'🇸🇹',682:'🇸🇦',686:'🇸🇳',688:'🇷🇸',694:'🇸🇱',702:'🇸🇬',703:'🇸🇰',
  704:'🇻🇳',705:'🇸🇮',706:'🇸🇴',710:'🇿🇦',716:'🇿🇼',724:'🇪🇸',729:'🇸🇩',
  736:'🇸🇸',740:'🇸🇷',748:'🇸🇿',752:'🇸🇪',756:'🇨🇭',760:'🇸🇾',762:'🇹🇯',
  764:'🇹🇭',768:'🇹🇬',776:'🇹🇴',780:'🇹🇹',784:'🇦🇪',788:'🇹🇳',792:'🇹🇷',
  795:'🇹🇲',798:'🇹🇻',800:'🇺🇬',804:'🇺🇦',807:'🇲🇰',818:'🇪🇬',826:'🇬🇧',
  834:'🇹🇿',840:'🇺🇸',854:'🇧🇫',858:'🇺🇾',860:'🇺🇿',862:'🇻🇪',882:'🇼🇸',
  887:'🇾🇪',894:'🇿🇲',275:'🇵🇸',
  // Nations autoproclamées (drapeau générique ou spécifique)
  9001:'🏴 ',9002:'🇹🇼',9003:'🏴 ',9004:'🏴 ',9005:'🏴 ',9006:'🏴 ',
  9007:'🏴 ',9008:'🏴 ',9009:'🏴 ',9010:'🏴 ',9011:'🏴 ',9012:'🏴 ',
  9020:'🏔',
};

// ── Initial bilateral relations for the 13 playable nations ──
const INIT_REL = {
  840:{826:'ally',250:'ally',276:'ally',124:'ally',36:'ally',554:'ally',392:'ally',410:'ally',376:'ally',616:'ally',380:'ally',724:'ally',620:'ally',246:'ally',752:'ally',528:'ally',56:'ally',40:'ally',203:'ally',300:'ally',208:'ally',578:'ally',372:'ally',400:'ally',818:'neutral',643:'hostile',364:'hostile',408:'hostile',760:'hostile',112:'hostile',275:'hostile',156:'tension',862:'tension',192:'tension',704:'tension',356:'neutral',76:'neutral',682:'neutral',792:'neutral',710:'neutral'},
  156:{643:'ally',408:'ally',704:'ally',840:'hostile',376:'hostile',410:'hostile',392:'hostile',826:'tension',250:'tension',276:'tension',36:'tension',356:'tension',792:'tension',275:'neutral',76:'neutral',682:'neutral',710:'neutral'},
  643:{112:'ally',860:'ally',804:'war',840:'hostile',826:'hostile',250:'hostile',276:'hostile',616:'hostile',246:'hostile',752:'hostile',372:'hostile',528:'hostile',56:'hostile',40:'hostile',156:'ally',364:'neutral',682:'neutral',275:'neutral',356:'neutral',76:'neutral'},
  250:{840:'ally',276:'ally',826:'ally',380:'ally',724:'ally',528:'ally',56:'ally',616:'ally',246:'ally',752:'ally',124:'ally',36:'ally',203:'ally',642:'ally',300:'ally',643:'hostile',156:'tension',788:'neutral',504:'neutral',12:'neutral',76:'neutral',818:'neutral'},
  276:{840:'ally',250:'ally',826:'ally',380:'ally',528:'ally',56:'ally',616:'ally',246:'ally',752:'ally',724:'ally',203:'ally',40:'ally',642:'ally',643:'hostile',156:'tension',356:'neutral',76:'neutral'},
  826:{840:'ally',250:'ally',276:'ally',36:'ally',124:'ally',554:'ally',392:'ally',410:'ally',376:'ally',616:'ally',380:'ally',724:'ally',246:'ally',752:'ally',528:'ally',56:'ally',643:'hostile',364:'hostile',156:'tension',275:'hostile',356:'neutral',76:'neutral'},
  356:{36:'ally',76:'neutral',586:'hostile',156:'tension',643:'tension',408:'tension',840:'neutral',826:'neutral',250:'neutral'},
  76:{170:'ally',32:'ally',604:'ally',858:'ally',840:'neutral',250:'neutral',276:'neutral',826:'neutral',156:'neutral',643:'neutral',862:'tension'},
  392:{840:'ally',826:'ally',410:'ally',36:'ally',156:'hostile',408:'hostile',643:'tension',356:'neutral',250:'neutral'},
  792:{840:'tension',826:'tension',250:'tension',276:'tension',528:'tension',643:'tension',376:'hostile',804:'tension',682:'neutral',356:'neutral',275:'ally',422:'tension'},
  364:{643:'ally',156:'ally',760:'ally',887:'ally',422:'ally',275:'ally',840:'hostile',376:'hostile',826:'hostile',682:'hostile',784:'hostile',792:'tension',586:'tension'},
  682:{784:'ally',414:'ally',634:'ally',400:'ally',818:'neutral',840:'neutral',826:'neutral',250:'neutral',364:'hostile',887:'hostile',643:'neutral',156:'neutral',275:'tension',792:'tension'},
  804:{840:'ally',826:'ally',250:'ally',276:'ally',616:'ally',36:'ally',643:'war',112:'hostile',156:'tension',682:'neutral',356:'neutral'},
  275:{364:'ally',634:'ally',792:'ally',376:'war',840:'hostile',826:'hostile',818:'tension',682:'tension',400:'neutral',156:'neutral',643:'neutral'},
  400:{840:'ally',682:'ally',784:'ally',818:'neutral',376:'neutral',275:'neutral',364:'hostile',156:'neutral',250:'neutral'},
  422:{364:'ally',760:'ally',376:'hostile',840:'tension',682:'tension',275:'neutral',400:'neutral',156:'neutral'},
  818:{682:'ally',784:'ally',376:'neutral',840:'neutral',275:'neutral',400:'neutral',364:'tension',156:'neutral',826:'neutral'},
  376:{840:'ally',826:'ally',250:'tension',276:'tension',275:'war',364:'hostile',422:'hostile',760:'hostile',818:'neutral',400:'neutral',792:'hostile'}
};

// Guerres actives au démarrage (Janvier 2025)
// defCode: { attacker, progress (0=défenseur domine, 100=attaquant domine), zones }
const INIT_WARS = {
  804: { attacker: 643, progress: 22, zones: ["Donets'k","Luhans'k","Zaporizhzhya","Kherson"] },
  275: { attacker: 376, progress: 75, zones: ['Gaza'] },
};

// Tensions mondiales additionnelles pour worldRels
const INIT_WORLD_TENSIONS = {
  '104-156': 'tension',   // Myanmar-Chine : tensions frontalières
  '376-422': 'hostile',   // Israël-Liban : hostilités
  '376-364': 'hostile',   // Israël-Iran
  '682-887': 'hostile',   // Arabie Saoudite-Yémen (Houthis)
  '356-586': 'hostile',   // Inde-Pakistan
  '408-410': 'hostile',   // Corée du Nord-Corée du Sud
  '376-275': 'war',       // Israël-Palestine
  '643-804': 'war',       // Russie-Ukraine
};

// ══════════════════════════════════════════
// ── Blocs géopolitiques (réels en 2025) ──
// ══════════════════════════════════════════
const GEO_BLOCS = {
  // Alliances militaires
  NATO: [840,124,826,250,276,380,724,616,792,300,56,528,578,208,352,442,246,752,
         703,705,191,8,499,807,233,428,440,348,203,642,100,620,372,470],
  OTSC: [643,112,51,398,417,762],
  // Blocs économiques/politiques
  UE:    [250,276,380,724,616,300,56,528,208,246,752,703,705,191,807,233,428,440,
          348,203,642,100,620,372,470,196,40,442],
  BRICS: [156,643,356,76,710,364,818,231,682,784],
  ASEAN: [360,764,704,608,458,702,104,418,116,96],
  CCG:   [682,784,414,634,48,512],
  LIGUE_ARABE: [818,682,368,760,400,422,788,12,434,504,729,887,275,48,414,634,784,512,478],
  MERCOSUR: [76,32,858,600],
  UNION_AFRICAINE: [12,24,204,72,854,108,120,132,140,148,174,178,180,262,818,232,231,
                     266,270,288,324,624,226,384,404,426,430,434,450,454,466,478,480,
                     504,508,516,562,566,646,678,686,694,706,710,729,736,748,768,788,
                     800,834,894,716],
  OCS: [156,643,356,586,398,417,762,860],
  // Blocs informels
  FIVE_EYES: [840,826,124,36,554],
  QUAD:      [840,356,392,36],
};

// Conflits / alliances bilatéraux spécifiques (référence 2025)
const BILATERAL_CONFLICTS = [
  // [codeA, codeB, statut]
  [643, 804, 'war'],       // Russie-Ukraine
  [376, 275, 'war'],       // Israël-Palestine
  [376, 364, 'hostile'],   // Israël-Iran
  [376, 422, 'hostile'],   // Israël-Liban
  [376, 760, 'hostile'],   // Israël-Syrie
  [356, 586, 'hostile'],   // Inde-Pakistan
  [156, 9002, 'hostile'],  // Chine-Taiwan
  [408, 410, 'hostile'],   // Corées
  [408, 840, 'hostile'],   // Corée du Nord-USA
  [408, 392, 'hostile'],   // Corée du Nord-Japon
  [364, 682, 'hostile'],   // Iran-Arabie Saoudite
  [364, 840, 'hostile'],   // Iran-USA
  [840, 862, 'hostile'],   // USA-Venezuela
  [840, 192, 'hostile'],   // USA-Cuba
  [840, 156, 'tension'],   // USA-Chine
  [840, 643, 'hostile'],   // USA-Russie
  [156, 392, 'tension'],   // Chine-Japon
  [156, 608, 'tension'],   // Chine-Philippines
  [156, 410, 'tension'],   // Chine-Corée du Sud
  [156, 356, 'tension'],   // Chine-Inde
  [300, 792, 'tension'],   // Grèce-Turquie
  [51, 31, 'hostile'],     // Arménie-Azerbaïdjan
  [12, 504, 'tension'],    // Algérie-Maroc
  [504, 9008, 'hostile'],  // Maroc-Sahara Occidental
  [688, 9001, 'hostile'],  // Serbie-Kosovo
  [706, 9003, 'hostile'],  // Somalie-Somaliland
  [682, 887, 'hostile'],   // Arabie Saoudite-Yémen
  [643, 268, 'tension'],   // Russie-Géorgie
  [643, 616, 'hostile'],   // Russie-Pologne
  [643, 246, 'hostile'],   // Russie-Finlande
  [643, 752, 'hostile'],   // Russie-Suède
  [112, 804, 'hostile'],   // Biélorussie-Ukraine
  [364, 784, 'hostile'],   // Iran-EAU
  [792, 275, 'ally'],      // Turquie-Palestine
  [364, 275, 'ally'],      // Iran-Palestine
  [156, 643, 'ally'],      // Chine-Russie
  [156, 408, 'ally'],      // Chine-Corée du Nord
  [643, 112, 'ally'],      // Russie-Biélorussie
  [643, 760, 'ally'],      // Russie-Syrie
  [364, 760, 'ally'],      // Iran-Syrie
  [364, 422, 'ally'],      // Iran-Liban (Hezbollah)
  [682, 784, 'ally'],      // Arabie Saoudite-EAU
  [682, 818, 'ally'],      // Arabie Saoudite-Égypte
];

// Rivalités inter-blocs
const BLOC_RIVALRIES = [
  ['NATO', 'OTSC', 'tension'],
  ['FIVE_EYES', 'OCS', 'tension'],
];

// ══════════════════════════════════════════
// ── Reconnaissance territoriale (états disputés) ──
// ══════════════════════════════════════════
const RECOGNITION = {
  9001: { // Kosovo
    recognized_by: new Set([840,826,250,276,380,392,124,36,554,410,792,616,
                            246,752,528,56,40,203,642,300,208,578,372,191,
                            8,499,807,233,428,440,348,703,705,620,470]),
    not_recognized_by: new Set([643,156,356,724,688,100,498]),
    claimed_by: 688,
    un_member: false,
    default_recognized: true
  },
  9002: { // Taiwan
    recognized_by: new Set([585,584,296,776,798,520,882,548,242,308,
                            659,662,670,332,84,320,591,600]),
    not_recognized_by: new Set([156,643,408]),
    claimed_by: 156,
    un_member: false,
    default_recognized: false
  },
  275: { // Palestine
    recognized_by: new Set([643,156,364,792,682,818,12,788,504,434,
                            562,466,854,686,324,384,231,404,800,834,
                            356,586,360,458,50,144,524,104,418,116,
                            704,862,192,170,68,218,604,76,32]),
    not_recognized_by: new Set([840,826,124,36,276]),
    claimed_by: 376,
    un_member: false,
    default_recognized: true
  },
  9003: { // Somaliland
    recognized_by: new Set([]),
    not_recognized_by: new Set([]),
    claimed_by: 706,
    un_member: false,
    default_recognized: false
  },
  9008: { // Sahara Occidental
    recognized_by: new Set([12,706,862,192,408,760,364,887]),
    not_recognized_by: new Set([840,250,682,784]),
    claimed_by: 504,
    un_member: false,
    default_recognized: false
  },
  9012: { // Chypre du Nord
    recognized_by: new Set([792]),
    not_recognized_by: new Set([]),
    claimed_by: 196,
    un_member: false,
    default_recognized: false
  },
};

function isRecognizedBy(territoryCode, observerCode) {
  const rec = RECOGNITION[territoryCode];
  if (!rec) return true;
  if (rec.recognized_by.has(observerCode)) return true;
  if (rec.not_recognized_by.has(observerCode)) return false;
  return rec.default_recognized;
}

// Rang de priorité des statuts (plus haut = plus fort, ne pas écraser)
const _REL_RANK = { neutral: 0, tension: 1, ally: 2, hostile: 3, war: 4, unrecognized: 5 };
function _applyRel(rel, code, statut) {
  const cur = rel[code];
  if (!cur) { rel[code] = statut; return; }
  if ((_REL_RANK[statut] || 0) > (_REL_RANK[cur] || 0)) rel[code] = statut;
}

function generateRelations(playerCode) {
  // 1. INIT_REL priorité max (données manuelles précises)
  const rel = INIT_REL[playerCode] ? { ...INIT_REL[playerCode] } : {};

  // 2. Conflits bilatéraux directs
  BILATERAL_CONFLICTS.forEach(([a, b, statut]) => {
    if (a === playerCode && !rel[b]) rel[b] = statut;
    else if (b === playerCode && !rel[a]) rel[a] = statut;
  });

  // 3. Détecter les blocs du joueur
  const playerBlocs = [];
  Object.entries(GEO_BLOCS).forEach(([name, members]) => {
    if (members.includes(playerCode)) playerBlocs.push(name);
  });

  // 4. Membres du même bloc militaire → ally
  const MILITARY_BLOCS = ['NATO', 'OTSC', 'FIVE_EYES', 'QUAD'];
  playerBlocs.filter(b => MILITARY_BLOCS.includes(b)).forEach(blocName => {
    GEO_BLOCS[blocName].forEach(code => {
      if (code !== playerCode && !rel[code]) rel[code] = 'ally';
    });
  });

  // 5. Blocs rivaux → tension (si pas déjà pire)
  BLOC_RIVALRIES.forEach(([blocA, blocB, statut]) => {
    const inA = GEO_BLOCS[blocA]?.includes(playerCode);
    const inB = GEO_BLOCS[blocB]?.includes(playerCode);
    if (inA) GEO_BLOCS[blocB]?.forEach(c => { if (c !== playerCode) _applyRel(rel, c, statut); });
    if (inB) GEO_BLOCS[blocA]?.forEach(c => { if (c !== playerCode) _applyRel(rel, c, statut); });
  });

  // 6. Appliquer la reconnaissance territoriale (si fonction dispo)
  if (typeof RECOGNITION !== 'undefined') {
    const playerRec = RECOGNITION[playerCode];
    if (playerRec && playerRec.claimed_by && !rel[playerRec.claimed_by]) {
      rel[playerRec.claimed_by] = 'hostile';
    }
    Object.keys(RECOGNITION).forEach(k => {
      const tCode = +k;
      if (tCode === playerCode) return;
      if (typeof isRecognizedBy === 'function' && !isRecognizedBy(tCode, playerCode) && !rel[tCode]) {
        rel[tCode] = 'unrecognized';
      }
    });
  }

  return rel;
}

// ── World bilateral relations initializer ──
function initWorldRels() {
  const PLAYABLE = [840,156,643,250,276,826,356,76,392,792,364,682,804,275,400,422,818,376];
  const wr = {};
  const setPair = (a, b, v) => {
    if (!v || v === 'neutral') return;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    const cur = wr[key];
    if (!cur || (_REL_RANK[v] || 0) > (_REL_RANK[cur] || 0)) wr[key] = v;
  };
  PLAYABLE.forEach(a => {
    PLAYABLE.forEach(b => {
      if (a >= b) return;
      setPair(a, b, (INIT_REL[a]?.[b]) || (INIT_REL[b]?.[a]));
    });
  });
  // Conflits bilatéraux → tous, pas seulement PLAYABLE (propagation monde)
  BILATERAL_CONFLICTS.forEach(([a, b, v]) => setPair(a, b, v));
  // Rivalités inter-blocs propagées au monde (via PLAYABLE seulement pour éviter explosion)
  BLOC_RIVALRIES.forEach(([blocA, blocB, v]) => {
    const aMembers = GEO_BLOCS[blocA] || [];
    const bMembers = GEO_BLOCS[blocB] || [];
    aMembers.forEach(a => bMembers.forEach(b => {
      if (PLAYABLE.includes(a) && PLAYABLE.includes(b)) setPair(a, b, v);
    }));
  });
  // Tensions/guerres mondiales supplémentaires
  if (typeof INIT_WORLD_TENSIONS !== 'undefined') {
    Object.entries(INIT_WORLD_TENSIONS).forEach(([k, v]) => { wr[k] = v; });
  }
  return wr;
}

// ── Display mappings ──
const REL_LABELS = {ally:'Allié',tension:'Tensions',hostile:'Hostile',war:'En guerre',neutral:'Neutre',unrecognized:'Non reconnu'};
const REL_COLORS = {ally:'#0f7a3c',tension:'#9a6210',hostile:'#8a1a1a',war:'#cc0000',neutral:'#14213a',player:'#d4920a',unrecognized:'#2a1a3a'};
const CAT_CLASS = {
  'DIPLOMATIQUE':'cat-diplo','MILITAIRE':'cat-mil','ÉCONOMIQUE':'cat-eco',
  'POLITIQUE':'cat-pol','HUMANITAIRE':'cat-hum','OPINION':'cat-opinion'
};

// ── Gemini JSON response schema (dynamic based on active modules) ──
function buildActionSchema(modules) {
  modules = modules || {};
  const props = {
    nouvelle_date: { type: 'STRING' },
    resume_action: { type: 'STRING' },
    evenements: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          categorie: { type: 'STRING' },
          titre:     { type: 'STRING' },
          texte:     { type: 'STRING' }
        },
        required: ['categorie', 'titre', 'texte']
      }
    },
    contacts_entrants: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          code:    { type: 'INTEGER' },
          sujet:   { type: 'STRING' },
          message: { type: 'STRING' }
        },
        required: ['code', 'sujet', 'message']
      }
    },
    conversations_auto: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          codes:   { type: 'ARRAY', items: { type: 'INTEGER' } },
          sujet:   { type: 'STRING' },
          message: { type: 'STRING' }
        },
        required: ['codes', 'sujet', 'message']
      }
    },
    relations_modifiees: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          code:   { type: 'INTEGER' },
          statut: { type: 'STRING' }
        },
        required: ['code', 'statut']
      }
    },
    evolutions_mondiales: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          paysA:          { type: 'INTEGER' },
          paysB:          { type: 'INTEGER' },
          nouveau_statut: { type: 'STRING' },
          raison_courte:  { type: 'STRING' }
        },
        required: ['paysA', 'paysB', 'nouveau_statut', 'raison_courte']
      }
    },
    evenements_mondiaux: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          lieu:   { type: 'STRING' },
          titre:  { type: 'STRING' },
          texte:  { type: 'STRING' }
        },
        required: ['lieu', 'titre', 'texte']
      }
    },
    evolutions_guerre: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          attaquant:     { type: 'INTEGER' },
          defenseur:     { type: 'INTEGER' },
          delta:         { type: 'INTEGER' },
          raison_courte: { type: 'STRING' },
          zone:          { type: 'STRING' }
        },
        required: ['attaquant', 'defenseur', 'delta', 'raison_courte', 'zone']
      }
    }
  };

  // Module: Ressources
  if (modules.ressources) {
    props.impact_ressources = {
      type: 'OBJECT',
      properties: {
        tresorerie: { type: 'INTEGER' },
        stabilite:  { type: 'INTEGER' },
        puissance:  { type: 'INTEGER' }
      }
    };
  }

  // Module: Opinion Publique
  if (modules.opinion) {
    props.opinion_publique = {
      type: 'OBJECT',
      properties: {
        score:       { type: 'INTEGER' },
        commentaire: { type: 'STRING' }
      },
      required: ['score', 'commentaire']
    };
  }

  // Module: Crises
  if (modules.crises) {
    props.evenement_crise = {
      type: 'OBJECT',
      properties: {
        titre:  { type: 'STRING' },
        effet:  { type: 'STRING' },
        impact: { type: 'STRING' }
      }
    };
  }

  // Insurrections / factions non-souveraines (toujours actif)
  props.nouvelles_factions = {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: {
        pays_hote:  { type: 'INTEGER' },
        nom:        { type: 'STRING' },
        intensite:  { type: 'INTEGER' }
      },
      required: ['pays_hote', 'nom', 'intensite']
    }
  };
  props.factions_terminees = {
    type: 'ARRAY',
    items: { type: 'STRING' }
  };

  // Modifications de carte
  props.map_changes = {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: {
        type:         { type: 'STRING' },
        region:       { type: 'STRING' },
        new_owner:    { type: 'STRING' },
        old_name:     { type: 'STRING' },
        new_name:     { type: 'STRING' },
        new_flag:     { type: 'STRING' },
        from_country: { type: 'STRING' },
        regions:      { type: 'ARRAY', items: { type: 'STRING' } },
        countries:    { type: 'ARRAY', items: { type: 'STRING' } },
        into:         { type: 'STRING' }
      },
      required: ['type']
    }
  };

  // Faisabilité de l'action du joueur
  props.faisabilite = {
    type: 'OBJECT',
    properties: {
      reussite: { type: 'STRING' },
      raison:   { type: 'STRING' }
    },
    required: ['reussite', 'raison']
  };

  return {
    type: 'OBJECT',
    properties: props,
    required: ['nouvelle_date', 'evenements', 'resume_action', 'evenements_mondiaux', 'faisabilite', 'map_changes']
  };
}

// ── Leader archetypes (ISO numeric → {archetype, trait}) ──
const LEADER_ARCHETYPES = {
  840: { type: 'Pragmatique',    trait: 'Intérêts d\'abord, idéologie ensuite.',          emoji: '🤝' },
  156: { type: 'Expansionniste', trait: 'Vision d\'une Chine dominante sur l\'Asie.',      emoji: '🐉' },
  643: { type: 'Nationaliste',   trait: 'Restaurer la grandeur perdue de la Russie.',      emoji: '🐻' },
  250: { type: 'Idéologue',      trait: 'Les valeurs européennes comme boussole morale.',   emoji: '🗼' },
  276: { type: 'Pragmatique',    trait: 'Stabilité économique et multilatéralisme.',        emoji: '⚙' },
  826: { type: 'Pragmatique',    trait: 'Influence diplomatique via soft power.',           emoji: '👑' },
  356: { type: 'Nationaliste',   trait: 'Affirmation de l\'Inde comme grande puissance.',  emoji: '🕌' },
   76: { type: 'Pacifiste',      trait: 'Coopération régionale et justice sociale.',        emoji: '🌴' },
  392: { type: 'Pacifiste',      trait: 'Commerce et paix, éviter tout conflit armé.',     emoji: '⛩' },
  792: { type: 'Expansionniste', trait: 'Influence sur les pays voisins, jeux d\'influence.',emoji: '🌙' },
  364: { type: 'Idéologue',      trait: 'La révolution islamique comme modèle exportable.', emoji: '☪' },
  682: { type: 'Pragmatique',    trait: 'Modernisation économique, stabilité dynastique.',  emoji: '🏜' },
  804: { type: 'Nationaliste',   trait: 'Survie et souveraineté face à l\'agression.',      emoji: '🌻' },
  275: { type: 'Idéologue',      trait: 'Résistance et lutte pour l\'autodétermination.',   emoji: '🕊' },
  376: { type: 'Nationaliste',   trait: 'Sécurité d\'Israël avant toute négociation.',      emoji: '✡' },
  400: { type: 'Pacifiste',      trait: 'Équilibre et médiation dans une région volatile.',  emoji: '🌺' },
  422: { type: 'Idéologue',      trait: 'Résistance aux puissances extérieures.',           emoji: '🌲' },
  818: { type: 'Pragmatique',    trait: 'Stabilité intérieure, pragmatisme régional.',      emoji: '🔱' },
};

// ── Capital coordinates [lng, lat] for arc drawing ──
const CAPITALS = {
   36:[149.1281,-35.2835], 76:[-47.9292,-15.7801], 124:[-75.6919,45.4215],
  156:[116.3912,39.9060],  170:[-74.0817, 4.7110],  250:[  2.3522,48.8566],
  276:[ 13.4050,52.5200],  275:[ 35.2007,31.9037],  356:[ 77.2090,28.6139],
  364:[ 51.3890,35.6892],  368:[ 44.3661,33.3406],  376:[ 35.2332,31.7683],
  380:[ 12.4964,41.9028],  392:[139.6917,35.6895],  400:[ 35.9239,31.9522],
  408:[125.7625,39.0194],  410:[126.9780,37.5665],  422:[ 35.5018,33.8938],
  484:[ -99.133,19.4326],  528:[  4.8952,52.3702],  554:[174.7762,-36.8485],
  586:[ 73.0479,33.7294],  616:[ 21.0122,52.2297],  643:[ 37.6176,55.7558],
  682:[ 46.7219,24.6877],  704:[105.8412,21.0245],  724:[ -3.7038,40.4168],
  752:[ 18.0686,59.3293],  760:[ 36.2765,33.5138],  792:[ 32.8597,39.9334],
  804:[ 30.5234,50.4501],  818:[ 31.2357,30.0444],  826:[ -0.1276,51.5074],
  840:[-77.0366,38.8951],
};

// ── Initial resource values by nation (0-100 index) ──
const INIT_RESOURCES = {
  840:{ tresorerie:94, stabilite:82, puissance:99 },
  156:{ tresorerie:89, stabilite:74, puissance:93 },
  643:{ tresorerie:48, stabilite:54, puissance:87 },
  250:{ tresorerie:74, stabilite:79, puissance:71 },
  276:{ tresorerie:83, stabilite:84, puissance:66 },
  826:{ tresorerie:77, stabilite:80, puissance:74 },
  356:{ tresorerie:68, stabilite:63, puissance:77 },
   76:{ tresorerie:58, stabilite:55, puissance:50 },
  392:{ tresorerie:81, stabilite:87, puissance:42 },
  792:{ tresorerie:50, stabilite:53, puissance:62 },
  364:{ tresorerie:38, stabilite:48, puissance:64 },
  682:{ tresorerie:72, stabilite:64, puissance:66 },
  804:{ tresorerie:28, stabilite:22, puissance:56 },
  275:{ tresorerie:12, stabilite:18, puissance:22 },
  376:{ tresorerie:73, stabilite:55, puissance:80 },
  400:{ tresorerie:40, stabilite:62, puissance:36 },
  422:{ tresorerie:10, stabilite:14, puissance:20 },
  818:{ tresorerie:38, stabilite:50, puissance:46 },
};

function getInitResources(code) {
  if (INIT_RESOURCES[code]) return { ...INIT_RESOURCES[code] };
  const isG7  = [840,826,250,276,380,124,392].includes(code);
  const isNATO = typeof GEO_BLOCS !== 'undefined' && GEO_BLOCS.NATO.includes(code);
  const isUE   = typeof GEO_BLOCS !== 'undefined' && GEO_BLOCS.UE.includes(code);
  const isBRICS = typeof GEO_BLOCS !== 'undefined' && GEO_BLOCS.BRICS.includes(code);
  const isDisputed = typeof RECOGNITION !== 'undefined' && !!RECOGNITION[code];
  let tresorerie = 40, stabilite = 50, puissance = 30;
  if (isG7)                  { tresorerie = 80; stabilite = 80; puissance = 70; }
  else if (isNATO && isUE)   { tresorerie = 65; stabilite = 72; puissance = 45; }
  else if (isNATO)           { tresorerie = 55; stabilite = 65; puissance = 50; }
  else if (isUE)             { tresorerie = 60; stabilite = 70; puissance = 35; }
  else if (isBRICS)          { tresorerie = 55; stabilite = 55; puissance = 55; }
  else if (isDisputed)       { tresorerie = 15; stabilite = 25; puissance = 20; }
  const jitter = () => Math.floor(Math.random() * 11) - 5;
  return {
    tresorerie: Math.max(5, Math.min(99, tresorerie + jitter())),
    stabilite:  Math.max(5, Math.min(99, stabilite  + jitter())),
    puissance:  Math.max(5, Math.min(99, puissance  + jitter()))
  };
}
