// DOS1 EE preset classes and companions.
// attrs = bonus points ON TOP of the base 5 (they consume the 5 creation points).
// abilities = starting ranks. Companions join at level 3 with points already spent.
window.DOS_PRESETS = {
  classes: [
    { id:'battlemage', name:'Battlemage', blurb:'Amplifies brute strength with powerful magic. One-hander and shield.',
      attrs:{strength:2,intelligence:2,constitution:1},
      abilities:{man_at_arms:1,single_handed:1,shield_spec:1,witchcraft:1,pyrokinetic:1},
      talents:['Opportunist','What a Rush'],
      skills:['Oath of Desecration','Burning Touch','Crushing Fist'] },

    { id:'cleric', name:'Cleric', blurb:'Melee support: heals and buffs alongside sword and board.',
      attrs:{strength:2,intelligence:1,constitution:1,speed:1},
      abilities:{man_at_arms:1,single_handed:1,shield_spec:1,armour_spec:1,hydrosophist:1},
      talents:['My Precious','Anaconda'],
      skills:['Melee Power Stance','Divine Light','Regeneration'] },

    { id:'enchanter', name:'Enchanter', blurb:'Water and air control mage with a wand.',
      attrs:{intelligence:2,speed:2,perception:1},
      abilities:{telekinesis:1,hydrosophist:1,aerotheurge:1,charisma:1,wand:1},
      talents:['Escapist','Elemental Affinity'],
      skills:['Teleportation','Slow Current','Freezing Touch'] },

    { id:'fighter', name:'Fighter', blurb:'Pure close-combat brawler with one-hander and shield.',
      attrs:{strength:2,constitution:1,speed:1,perception:1},
      abilities:{man_at_arms:1,single_handed:1,shield_spec:1,armour_spec:1,body_building:1},
      talents:['Opportunist','My Precious'],
      skills:['Melee Power Stance','Whirlwind','Battering Ram'] },

    { id:'inquisitor', name:'Inquisitor', blurb:'Dual-wielding caster mixing curses and elements.',
      attrs:{intelligence:2,constitution:1,speed:2},
      abilities:{witchcraft:1,pyrokinetic:1,aerotheurge:1,dual_wielding:1,wand:1},
      talents:['Far Out Man','Stench'],
      skills:['Thunder Jump','Vampiric Touch','Burning Touch'] },

    { id:'knight', name:'Knight', blurb:'Two-handed tank and party support.',
      attrs:{strength:3,constitution:1,speed:1},
      abilities:{man_at_arms:1,two_handed:1,armour_spec:1,leadership:1,body_building:1},
      talents:['Opportunist','What a Rush'],
      skills:['Battering Ram','Cure Wounds','Encourage'] },

    { id:'ranger', name:'Ranger', blurb:'Bow specialist and crafter.',
      attrs:{dexterity:3,speed:1,perception:1},
      abilities:{expert_marksman:1,bow:1,blacksmithing:1,loremaster:1,crafting:1},
      talents:['Bully','Arrow Recovery'],
      skills:['First Aid','Ranged Power Stance','Ricochet'] },

    { id:'rogue', name:'Rogue', blurb:'Dual-dagger sneak attacker.',
      attrs:{dexterity:3,speed:2},
      abilities:{scoundrel:1,sneaking:1,dual_wielding:2},
      talents:['Guerrilla','Back-Stabber'],
      skills:['Walk in Shadows','Lacerate','Fast Track'] },

    { id:'shadowblade', name:'Shadowblade', blurb:'Dagger hybrid with air and curse magic.',
      attrs:{dexterity:1,intelligence:2,speed:2},
      abilities:{scoundrel:1,witchcraft:1,aerotheurge:1,sneaking:1,dual_wielding:1},
      talents:['Back-Stabber','Leech'],
      skills:['Thunder Jump','Walk in Shadows','Vampiric Touch'] },

    { id:'wayfarer', name:'Wayfarer', blurb:'Crossbow ranger with earth magic and crafting.',
      attrs:{dexterity:2,intelligence:1,constitution:1,perception:1},
      abilities:{expert_marksman:1,crossbow:1,geomancer:1,crafting:1,lucky_charm:1},
      talents:['Pet Pal','Scientist'],
      skills:['First Aid','Summon Spider','Ricochet'] },

    { id:'witch', name:'Witch', blurb:'Curses, summons and earth magic.',
      attrs:{intelligence:3,speed:1,perception:1},
      abilities:{witchcraft:1,willpower:1,geomancer:1,loremaster:1,charisma:1},
      talents:['Pet Pal','Walk it Off'],
      skills:['Summon Spider','Oath of Desecration','Vampiric Touch'] },

    { id:'wizard', name:'Wizard', blurb:'Fire and earth blaster.',
      attrs:{intelligence:2,constitution:1,speed:1,perception:1},
      abilities:{willpower:1,pyrokinetic:1,geomancer:1,loremaster:1,charisma:1},
      talents:['Know-it-All','Far Out Man'],
      skills:['Midnight Oil','Flare','Boulder Bash'] },

    { id:'custom', name:'Custom', blurb:'Blank slate. Spend all 5 attribute points, 5 ability points and 2 talents yourself.',
      attrs:{}, abilities:{}, talents:[], skills:[] }
  ],

  // Companions join at level 3 with their points already committed.
  // attrsTotal = absolute attribute values (not bonuses).
  // NOTE: companion talents can break the normal prerequisite rules - Madora has
  // Comeback Kid without the Willpower 5 it would normally require. Slice 3 must
  // treat pre-assigned companion talents as granted, not re-validate them.
  companions: [
    { id:'madora', name:'Madora', joinLevel:3, base:'knight',
      blurb:'Recruited in the King Crab Tavern, Cyseal. Two-handed Man-at-Arms.',
      attrsTotal:{strength:8,dexterity:5,intelligence:5,constitution:7,speed:6,perception:5},
      abilities:{two_handed:2,body_building:1,man_at_arms:2},
      talents:['Comeback Kid','Opportunist','What a Rush'],
      skills:['Battering Ram','Crushing Fist','Dust Devil','Helping Hand','Melee Power Stance'] },

    // NOTE: companion sheets are hand-authored and do not obey player creation
    // rules. Jahan is 1 attribute point over the level-3 budget, Bairdotr is 1
    // ability point over, Wolgraff is 2 over and has Strength 4 - below the base
    // 5 a player character cannot go under. Values are left exactly as published;
    // the app displays the overspend rather than inventing corrections.
    { id:'bairdotr', name:'Bairdotr', joinLevel:3, base:'ranger',
      blurb:'Recruited from the jail near the Legion Headquarters, Cyseal. Bow ranger and loremaster.',
      attrsTotal:{strength:5,dexterity:7,intelligence:5,constitution:7,speed:6,perception:6},
      abilities:{bow:1,tenebrium:1,loremaster:2,expert_marksman:2},
      talents:['Arrow Recovery','Bully','Stench'],
      skills:['Ricochet','Treat Poisoning','Ranged Power Stance'] },

    { id:'wolgraff', name:'Wolgraff', joinLevel:3, base:'rogue',
      blurb:'Recruited in the tunnels under the cemetery, Cyseal. Mute dual-dagger rogue.',
      attrsTotal:{strength:4,dexterity:7,intelligence:5,constitution:5,speed:8,perception:7},
      abilities:{dual_wielding:2,scoundrel:2,lockpicking:1,pickpocketing:1,sneaking:1},
      talents:['Back-Stabber','Light Stepper','Escapist'],
      skills:["Razor's Edge",'Fast Track','Walk in Shadows','Cloak and Dagger'] },

    { id:'jahan', name:'Jahan', joinLevel:3, base:'wizard',
      blurb:'Recruited in Cyseal (Evelyn\'s quest line area). Air and water mage. Note: his published attributes total one point over the level-3 budget.',
      attrsTotal:{strength:5,dexterity:5,intelligence:9,constitution:7,speed:5,perception:6},
      abilities:{willpower:1,aerotheurge:2,hydrosophist:2},
      talents:['Elemental Affinity','Far Out Man','Scientist'],
      skills:['Regeneration','Rain','Bitter Cold','Blitz Bolt','Shocking Touch','Teleportation'] }
  ]
};
