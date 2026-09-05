// Divinity: Original Sin Enhanced Edition — core progression rules
// Sources: fextralife wiki, divinity.fandom, Steam community verification
window.DOS_RULES = {
  maxLevel: 23,          // practical EE cap; game ends ~19-21
  planLevel: 20,         // default planning target

  // Attributes: everyone starts at 5, +5 to spend at creation, +1 per EVEN level
  attributes: {
    base: 5,
    creationPoints: 5,
    softCap: 15,         // hard block without gear
    gainOnEvenLevel: 1,
    list: [
      { id:'strength',     name:'Strength',     desc:'+20 carry weight/pt (base 10). +6 offense rating/pt for STR weapons. Gates heavy armour & STR skills.' },
      { id:'dexterity',    name:'Dexterity',    desc:'+5 defence rating/pt (base 5). +6 offense rating/pt for DEX weapons. Gates Scoundrel/Marksman skills.' },
      { id:'intelligence', name:'Intelligence', desc:'-1 turn magic skill cooldown per 2 pts above 4. +6 offense rating/pt for INT weapons. Gates all magic skills.' },
      { id:'constitution', name:'Constitution', desc:'+1 max AP per pt (base 7). +6.2 vitality per pt and level.' },
      { id:'speed',        name:'Speed',        desc:'+0.1 movement/pt. +0.5 initiative/pt. +0.5 start AP/pt (base 2). +0.5 turn AP/pt (base 3.5).' },
      { id:'perception',   name:'Perception',   desc:'+1 hearing/pt. +0.5 initiative/pt. +0.5 start AP/pt. +1% crit per pt above 5. Trap detection, ranged accuracy range.' }
    ]
  },

  // Ability points: L2-5 = 1/level, L6-10 = 2/level, L11+ = 3/level. 5 at creation.
  abilityPoints: {
    creationPoints: 5,
    perLevel: function (lvl) { if (lvl <= 1) return 0; if (lvl <= 5) return 1; if (lvl <= 10) return 2; return 3; },
    // cost to raise an ability from rank n-1 to rank n == n
    costToRank: function (rank) { return rank; },
    maxRank: 5
  },

  // Talents: 2 at creation, +1 at level 3, +1 every 4 levels thereafter (7, 11, 15, 19, 23)
  talents: {
    creationPoints: 2,
    gainedAtLevels: [3, 7, 11, 15, 19, 23]
  },

  // Skill slots per school by ability rank. Index = rank.
  skillSlots: [
    { novice:0, adept:0, master:0 },   // rank 0
    { novice:3, adept:0, master:0 },   // rank 1
    { novice:5, adept:2, master:0 },   // rank 2
    { novice:6, adept:3, master:0 },   // rank 3
    { novice:6, adept:4, master:1 },   // rank 4
    { novice:6, adept:4, master:2 }    // rank 5
  ],

  notes: [
    'Each skill lists a recommended ability rank. Below it, AP cost +2 per rank short.',
    'Attribute below a skill requirement: -10% effectiveness per point. Above: +5% per point.',
    'Lone Wolf: +70% vitality, +2 turn AP, +1 ability point per level-up, but party capped at 2.'
  ]
};
