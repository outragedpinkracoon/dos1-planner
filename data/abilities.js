// DOS1 EE abilities, 6 categories. `school` = true means it gates skills of that name.
window.DOS_ABILITIES = [
  // ---- Weapons ----
  { id:'bow',            name:'Bow',                cat:'Weapons', desc:'+10% damage with bows per rank.' },
  { id:'crossbow',       name:'Crossbow',           cat:'Weapons', desc:'+crit chance and crit multiplier with crossbows (rank 1: +10% crit, 220% multiplier; ~+4%/+20% per rank).' },
  { id:'dual_wielding',  name:'Dual Wielding',      cat:'Weapons', desc:'Reduces off-hand damage penalty and AP cost of attacks. Penalty goes -20% at rank 1 to +5% bonus at high rank.' },
  { id:'single_handed',  name:'Single-Handed',      cat:'Weapons', desc:'+10% damage with one-handed weapons per rank.' },
  { id:'two_handed',     name:'Two-Handed',         cat:'Weapons', desc:'+crit chance and crit multiplier with two-handed weapons (same scaling as Crossbow).' },
  { id:'wand',           name:'Wand',               cat:'Weapons', desc:'+10% damage from main-hand wand attacks per rank.' },

  { id:'tenebrium',      name:'Tenebrium',          cat:'Weapons', desc:'Lets you handle tenebrium weapons without disease and adds tenebrium damage. Unlocked during the main quest.' },

  // ---- Defence ----
  { id:'armour_spec',    name:'Armour Specialist',  cat:'Defence', desc:'+armour rating and reduces movement penalty from heavy armour.' },
  { id:'body_building',  name:'Bodybuilding',       cat:'Defence', desc:'Improves saving throws vs Bleeding, Crippled, Frozen, Knocked Down, Petrified, Stunned, Diseased.' },
  { id:'shield_spec',    name:'Shield Specialist',  cat:'Defence', desc:'+blocking chance and shield armour rating.' },
  { id:'willpower',      name:'Willpower',          cat:'Defence', desc:'Improves saving throws vs Charmed, Feared, Muted, Taunted, Blinded, Slowed, Cursed.' },

  // ---- Skills (schools) ----
  { id:'aerotheurge',      name:'Aerotheurge',      cat:'Skills', school:true, attr:'intelligence', desc:'Air magic. Stuns, teleports, invisibility. Gates Aerotheurge skills.' },
  { id:'expert_marksman',  name:'Expert Marksman',  cat:'Skills', school:true, attr:'dexterity',    desc:'Ranged weapon skills, arrows, healing/cure abilities. Gates Expert Marksman skills.' },
  { id:'geomancer',        name:'Geomancer',        cat:'Skills', school:true, attr:'intelligence', desc:'Earth and poison magic, oil surfaces, summons, buffs. Gates Geomancer skills.' },
  { id:'hydrosophist',     name:'Hydrosophist',     cat:'Skills', school:true, attr:'intelligence', desc:'Water and ice magic, healing, freezing. Gates Hydrosophist skills.' },
  { id:'man_at_arms',      name:'Man-at-Arms',      cat:'Skills', school:true, attr:'strength',     desc:'Melee combat skills, stances, crowd control, party support. Gates Man-at-Arms skills.' },
  { id:'pyrokinetic',      name:'Pyrokinetic',      cat:'Skills', school:true, attr:'intelligence', desc:'Fire magic, burning, haste. Gates Pyrokinetic skills.' },
  { id:'scoundrel',        name:'Scoundrel',        cat:'Skills', school:true, attr:'dexterity',    desc:'Dagger and mobility skills, invisibility, haste. Gates Scoundrel skills.' },
  { id:'witchcraft',       name:'Witchcraft',       cat:'Skills', school:true, attr:'intelligence', desc:'Curses, debuffs, summons, resurrect. Gates Witchcraft skills.' },

  // ---- Personality ----
  { id:'charisma',       name:'Charisma',           cat:'Personality', desc:'Improves outcome of dialogue charm/intimidate/reason checks and shop prices.' },
  { id:'leadership',     name:'Leadership',         cat:'Personality', desc:'Grants nearby allies bonus to hit chance, resistances and saving throws.' },
  { id:'lucky_charm',    name:'Lucky Charm',        cat:'Personality', desc:'Chance to find extra/better loot when opening containers.' },
  { id:'bartering',      name:'Bartering',          cat:'Personality', desc:'Better buy and sell prices with traders.' },

  // ---- Craftsmanship ----
  { id:'blacksmithing',  name:'Blacksmithing',      cat:'Craftsmanship', desc:'Repair and improve weapons/armour; required for many smithing recipes.' },
  { id:'crafting',       name:'Crafting',           cat:'Craftsmanship', desc:'Combine items into better gear, potions, grenades, arrows.' },
  { id:'loremaster',     name:'Loremaster',         cat:'Craftsmanship', desc:'Identify items and inspect enemy stats/resistances.' },
  { id:'telekinesis',    name:'Telekinesis',        cat:'Craftsmanship', desc:'Move heavier objects at range out of combat.' },

  // ---- Nasty Deeds ----
  { id:'sneaking',       name:'Sneaking',           cat:'Nasty Deeds', desc:'Move faster and be harder to detect while sneaking.' },
  { id:'pickpocketing',  name:'Pickpocketing',      cat:'Nasty Deeds', desc:'Steal heavier/more valuable items from NPCs.' },
  { id:'lockpicking',    name:'Lockpicking',        cat:'Nasty Deeds', desc:'Open higher-level locks with lockpicks.' }
];
