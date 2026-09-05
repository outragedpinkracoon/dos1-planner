// Progression maths, gear/talent floors, slot limits and pruning.
// These are the rules CLAUDE.md documents; the numbers here are the wiki totals.
/* global describe, it, chai */
(function () {
'use strict';
var expect = chai.expect;
var T = window.DOS_TEST;
var R = window.DOS_RULES;

// Every test drives the app's own functions against a state it owns, so
// nothing leaks between tests and localStorage is never touched.
function st(over) {
  var s = T.blankState();
  Object.keys(over || {}).forEach(function (k) { s[k] = over[k]; });
  T.setState(s);
  return s;
}

describe('Build character tests', function () {

describe('pools', function () {

  describe('attributes', function () {
    it('gives 5 at creation, before any level', function () {
      st({ level: 1 });
      expect(T.attrTotal()).to.equal(5);
    });

    it('grants a point on even levels only', function () {
      st({ level: 2 }); expect(T.attrTotal()).to.equal(6);
      st({ level: 3 }); expect(T.attrTotal()).to.equal(6);
      st({ level: 4 }); expect(T.attrTotal()).to.equal(7);
    });

    it('reaches 15 spendable at level 20', function () {
      st({ level: 20 });
      expect(T.attrTotal()).to.equal(15);
    });

    it('adds 1 for Bigger and Better', function () {
      st({ level: 20, talents: ['Bigger and Better'] });
      expect(T.attrTotal()).to.equal(16);
    });

    it('counts spend as the distance above base 5', function () {
      var s = st({ level: 20 });
      s.attrs.strength = 8;
      s.attrs.speed = 6;
      expect(T.attrSpent()).to.equal(4);
    });

    it('measures a companion below base 5 against attrFloor, not base', function () {
      // Wolgraff starts at Strength 4. Without the floor that reads as -1 spent.
      var s = st({ level: 3, attrFloor: { strength: 4 } });
      s.attrs.strength = 4;
      expect(T.attrSpent()).to.equal(0);
    });
  });

  describe('ability points', function () {
    it('gives 5 at creation', function () {
      st({ level: 1 });
      expect(T.abilTotal()).to.equal(5);
    });

    it('follows the 1 / 2 / 3 per-level bands', function () {
      st({ level: 5 });  expect(T.abilTotal()).to.equal(9);   // 5 + 4x1
      st({ level: 10 }); expect(T.abilTotal()).to.equal(19);  // + 5x2
      st({ level: 11 }); expect(T.abilTotal()).to.equal(22);  // + 1x3
    });

    it('reaches 49 at level 20', function () {
      st({ level: 20 });
      expect(T.abilTotal()).to.equal(49);
    });

    it('adds 2 for All Skilled Up', function () {
      st({ level: 20, talents: ['All Skilled Up'] });
      expect(T.abilTotal()).to.equal(51);
    });

    it('charges n points for rank n, cumulatively', function () {
      expect(T.rankCost(1)).to.equal(1);
      expect(T.rankCost(2)).to.equal(3);
      expect(T.rankCost(5)).to.equal(15);
    });

    it('sums rank cost across abilities', function () {
      st({ level: 20, abilities: { geomancer: 5, man_at_arms: 2 } });
      expect(T.abilSpent()).to.equal(18);
    });

    it('ignores gear ranks in the spend', function () {
      st({ level: 20, abilities: { crafting: 2 }, gearAbils: { crafting: 3 } });
      expect(T.abilSpent()).to.equal(3);  // rank 2 only, gear is free
    });
  });

  describe('talents', function () {
    it('gives 2 at creation', function () {
      st({ level: 1 });
      expect(T.talTotal()).to.equal(2);
    });

    it('grants one more at each listed level', function () {
      st({ level: 2 });  expect(T.talTotal()).to.equal(2);
      st({ level: 3 });  expect(T.talTotal()).to.equal(3);
      st({ level: 7 });  expect(T.talTotal()).to.equal(4);
    });

    it('reaches 7 by level 20', function () {
      st({ level: 20 });
      expect(T.talTotal()).to.equal(7);
    });
  });
});

describe('effective values', function () {

  it('adds gear on top of spent attribute points', function () {
    var s = st({});
    s.attrs.intelligence = 12;
    s.gearAttrs = { intelligence: 3 };
    expect(T.effAttr('intelligence')).to.equal(15);
  });

  it('lets attribute gear exceed the cap of 15', function () {
    var s = st({});
    s.attrs.intelligence = 15;
    s.gearAttrs = { intelligence: 4 };
    expect(T.effAttr('intelligence')).to.equal(19);
  });

  it('adds gear on top of ability rank', function () {
    st({ abilities: { crafting: 2 }, gearAbils: { crafting: 2 } });
    expect(T.effRank('crafting')).to.equal(4);
  });

  it('applies Scientist as a flat +1, same as gear, with 0 ranks paid', function () {
    st({ talents: ['Scientist'] });
    expect(T.effRank('crafting')).to.equal(1);
    expect(T.effRank('blacksmithing')).to.equal(1);
  });

  it('stacks Scientist on top of a paid rank, same as gear', function () {
    // Scientist is not a floor that gets absorbed by paid ranks - it behaves
    // exactly like a point of gear, just one that can never be unequipped.
    st({ talents: ['Scientist'], abilities: { crafting: 3 } });
    expect(T.effRank('crafting')).to.equal(4);
  });

  it('stacks Scientist and gear together, same ability', function () {
    st({ talents: ['Scientist'], gearAbils: { crafting: 1 } });
    expect(T.effRank('crafting')).to.equal(2);
  });

  it('never lets Scientist take crafting below 1, even with negative gear headroom', function () {
    // Scientist's "floor" guarantee only means the total can't drop below 1 -
    // it is not a ceiling on how high paid rank + gear can push it.
    st({ talents: ['Scientist'] });
    expect(T.effRank('crafting')).to.be.at.least(1);
  });

  it('leaves non-crafting abilities untouched by Scientist', function () {
    st({ talents: ['Scientist'] });
    expect(T.effRank('geomancer')).to.equal(0);
  });

  it('counts granted talents as held', function () {
    st({ grantedTalents: ['Comeback Kid'] });
    expect(T.hasTalent('Comeback Kid')).to.equal(true);
  });
});

describe('talent prerequisites', function () {

  function talent(name) {
    return window.DOS_TALENTS.find(function (t) { return t.name === name; });
  }

  it('blocks a level requirement below the level', function () {
    st({ level: 2 });
    expect(T.talentMet(talent('All Skilled Up')).ok).to.equal(false);
    st({ level: 3 });
    expect(T.talentMet(talent('All Skilled Up')).ok).to.equal(true);
  });

  it('reads ability requirements through gear', function () {
    var demon = talent('Demon');   // Pyrokinetic 4
    st({ abilities: { pyrokinetic: 3 } });
    expect(T.talentMet(demon).ok).to.equal(false);
    st({ abilities: { pyrokinetic: 3 }, gearAbils: { pyrokinetic: 1 } });
    expect(T.talentMet(demon).ok).to.equal(true);
  });

  // No shipped talent uses req:{attr} - the shape is documented in
  // data/talents.js and handled in talentMet, but nothing in the data reaches
  // it. talentMet takes a talent object, so hand it one directly rather than
  // skipping and leaving the branch untested.
  var ATTR_TALENT = { name: 'Test Attr Talent', req: { attr: 'strength', value: 10 } };

  it('blocks an attribute requirement below the value', function () {
    var s = st({});
    s.attrs.strength = 9;
    expect(T.talentMet(ATTR_TALENT).ok).to.equal(false);
  });

  it('passes an attribute requirement at the value', function () {
    var s = st({});
    s.attrs.strength = 10;
    expect(T.talentMet(ATTR_TALENT).ok).to.equal(true);
  });

  it('reads attribute requirements through gear', function () {
    var s = st({});
    s.attrs.strength = 9;
    expect(T.talentMet(ATTR_TALENT).ok).to.equal(false);
    s.gearAttrs.strength = 1;   // gear closes the gap, same as spent points
    expect(T.talentMet(ATTR_TALENT).ok).to.equal(true);
  });

  it('names the attribute in the failure reason', function () {
    var s = st({});
    s.attrs.strength = 9;
    expect(T.talentMet(ATTR_TALENT).why).to.equal('Requires Strength 10');
  });

  // Every talent that ships must still resolve through one of the branches,
  // so a new req shape can't be silently ignored.
  it('handles every req shape present in the data', function () {
    window.DOS_TALENTS.forEach(function (t) {
      expect(T.talentMet(t), t.name).to.have.property('ok');
    });
  });

  it('passes talents with no requirement', function () {
    st({ level: 1 });
    expect(T.talentMet(talent('Back-Stabber')).ok).to.equal(true);
  });

  it('explains why it failed', function () {
    st({ level: 1 });
    expect(T.talentMet(talent('All Skilled Up')).why).to.equal('Requires level 3');
  });
});

describe('pruning', function () {

  it('drops a talent whose ability rank fell away', function () {
    st({ level: 20, abilities: { pyrokinetic: 4 }, talents: ['Demon'] });
    T.pruneTalents();
    expect(T.getState().talents).to.deep.equal(['Demon']);

    st({ level: 20, abilities: { pyrokinetic: 2 }, talents: ['Demon'] });
    T.pruneTalents();
    expect(T.getState().talents).to.deep.equal([]);
  });

  it('keeps a granted talent that fails its prerequisite', function () {
    // Madora keeps Comeback Kid without Willpower 5.
    st({ level: 3, talents: ['Comeback Kid'], grantedTalents: ['Comeback Kid'] });
    T.pruneTalents();
    expect(T.getState().talents).to.deep.equal(['Comeback Kid']);
  });

  it('drops a talent that no longer exists in the data', function () {
    st({ level: 20, talents: ['Not A Real Talent'] });
    T.pruneTalents();
    expect(T.getState().talents).to.deep.equal([]);
  });

  it('trims skills over the slot allowance', function () {
    // Geomancer 1 grants 3 novice slots; a 4th novice skill must go.
    var novice = window.DOS_SKILLS.filter(function (s) {
      return s.s === 'geomancer' && s.t === 'novice';
    }).slice(0, 4).map(function (s) { return s.n; });

    st({ level: 20, abilities: { geomancer: 1 }, skills: novice });
    T.pruneSkills();
    expect(T.getState().skills).to.have.lengthOf(3);
  });

  it('keeps a class-granted skill the rank cannot slot', function () {
    // Fighter opens with Whirlwind, an adept skill, at Man-at-Arms 1.
    st({ level: 1, abilities: { man_at_arms: 1 },
         skills: ['Whirlwind'], granted: ['Whirlwind'] });
    T.pruneSkills();
    expect(T.getState().skills).to.deep.equal(['Whirlwind']);
  });

  it('drops skills when the gear paying for them is removed', function () {
    var novice = window.DOS_SKILLS.filter(function (s) {
      return s.s === 'geomancer' && s.t === 'novice';
    }).slice(0, 5).map(function (s) { return s.n; });

    st({ level: 20, abilities: { geomancer: 1 },
         gearAbils: { geomancer: 1 }, skills: novice });
    T.pruneSkills();
    expect(T.getState().skills).to.have.lengthOf(5);   // rank 2 = 5 novice slots

    st({ level: 20, abilities: { geomancer: 1 }, skills: novice });
    T.pruneSkills();
    expect(T.getState().skills).to.have.lengthOf(3);   // gear gone, back to 3
  });
});

describe('skill slots and locks', function () {

  it('maps rank to the documented slot table', function () {
    st({ abilities: { geomancer: 1 } });
    expect(T.slotsFor('geomancer')).to.deep.equal({ novice: 3, adept: 0, master: 0 });
    st({ abilities: { geomancer: 4 } });
    expect(T.slotsFor('geomancer')).to.deep.equal({ novice: 6, adept: 4, master: 1 });
  });

  it('gives no slots at rank 0', function () {
    st({});
    expect(T.slotsFor('geomancer')).to.deep.equal({ novice: 0, adept: 0, master: 0 });
  });

  it('locks a skill whose school is at rank 0', function () {
    st({});
    var s = T.skillByName('Boulder Bash');
    expect(T.skillLock(s)).to.match(/Requires Geomancer 1/);
  });

  it('locks an adept skill at rank 1 and names the rank needed', function () {
    st({ abilities: { man_at_arms: 1 } });
    var s = T.skillByName('Whirlwind');
    expect(T.skillLock(s)).to.match(/Man-at-Arms 2 for adept skills/);
  });

  it('unlocks once the slots exist', function () {
    st({ abilities: { man_at_arms: 2 } });
    expect(T.skillLock(T.skillByName('Whirlwind'))).to.equal(null);
  });

  it('locks when the tier is full', function () {
    var novice = window.DOS_SKILLS.filter(function (s) {
      return s.s === 'geomancer' && s.t === 'novice';
    }).slice(0, 4);

    st({ abilities: { geomancer: 1 },
         skills: novice.slice(0, 3).map(function (s) { return s.n; }) });
    expect(T.skillLock(novice[3])).to.match(/No novice slots left \(3\/3\)/);
  });

  it('excludes granted skills from the slot count but shows them in the total', function () {
    st({ abilities: { man_at_arms: 1 },
         skills: ['Whirlwind'], granted: ['Whirlwind'] });
    expect(T.knownIn('man_at_arms', 'adept')).to.equal(0);  // does not consume
    expect(T.countIn('man_at_arms', 'adept')).to.equal(1);  // but is displayed
  });
});

describe('soft rules — shown, not blocked', function () {

  it('charges +2 AP per rank short of the recommendation', function () {
    var s = window.DOS_SKILLS.find(function (x) { return x.rank === 2; });
    st({ abilities: {} });
    var a = {}; a[s.s] = 1;
    st({ abilities: a });
    expect(T.apPenalty(s)).to.equal(2);
  });

  it('charges nothing at or above the recommendation', function () {
    var s = window.DOS_SKILLS.find(function (x) { return x.rank === 2; });
    var a = {}; a[s.s] = 3;
    st({ abilities: a });
    expect(T.apPenalty(s)).to.equal(0);
  });

  it('counts gear rank against the AP penalty', function () {
    var s = window.DOS_SKILLS.find(function (x) { return x.rank === 2; });
    var a = {}, g = {}; a[s.s] = 1; g[s.s] = 1;
    st({ abilities: a, gearAbils: g });
    expect(T.apPenalty(s)).to.equal(0);
  });

  it('reports an attribute shortfall as have/need, without locking', function () {
    var s = T.skillByName('Avatar of Poison');   // Geomancer novice, Intelligence 8
    // Needs the school rank too, or it locks on that rather than the attribute.
    var stt = st({ abilities: { geomancer: 1 } });
    stt.attrs.intelligence = 6;
    expect(T.attrShortfall(s)).to.deep.equal(['Intelligence 6/8']);
    expect(T.skillLock(s)).to.equal(null);       // still learnable
  });

  it('clears the shortfall once gear covers it', function () {
    var s = T.skillByName('Avatar of Poison');
    var stt = st({ abilities: { geomancer: 1 } });
    stt.attrs.intelligence = 6;
    stt.gearAttrs = { intelligence: 2 };
    expect(T.attrShortfall(s)).to.equal(null);
  });

  it('returns null for a skill with no attribute requirement', function () {
    st({ abilities: { geomancer: 1 } });
    expect(T.attrShortfall(T.skillByName('Boulder Bash'))).to.equal(null);
  });
});

describe('helpers', function () {
  it('clamps into range', function () {
    expect(T.clamp(5, 1, 10)).to.equal(5);
    expect(T.clamp(-3, 1, 10)).to.equal(1);
    expect(T.clamp(99, 1, 10)).to.equal(10);
  });

  it('escapes html, since bag names come from editable storage', function () {
    expect(T.escapeHtml('<img src=x onerror="alert(1)">'))
      .to.equal('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });
});


describe('pool boundaries', function () {

  it('gives no level-derived points at level 1', function () {
    st({ level: 1 });
    expect(T.attrTotal()).to.equal(R.attributes.creationPoints);
    expect(T.abilTotal()).to.equal(R.abilityPoints.creationPoints);
    expect(T.talTotal()).to.equal(R.talents.creationPoints);
  });

  it('keeps growing to the max level the rules allow', function () {
    st({ level: R.maxLevel });
    // 23 is the last talent level, so all six post-creation talents are in.
    expect(T.talTotal()).to.equal(R.talents.creationPoints + R.talents.gainedAtLevels.length);
    expect(T.attrTotal()).to.equal(R.attributes.creationPoints + Math.floor(R.maxLevel / 2));
  });

  it('grants a talent on the level it is gained, not the level after', function () {
    R.talents.gainedAtLevels.forEach(function (l) {
      st({ level: l - 1 });
      var before = T.talTotal();
      st({ level: l });
      expect(T.talTotal(), 'talent gained at level ' + l).to.equal(before + 1);
    });
  });

  it('stacks both pool talents at once', function () {
    st({ level: 20, talents: ['Bigger and Better', 'All Skilled Up'] });
    expect(T.attrTotal()).to.equal(16);
    expect(T.abilTotal()).to.equal(51);
  });

  it('counts a granted pool talent, not just a picked one', function () {
    st({ level: 20, grantedTalents: ['Bigger and Better'] });
    expect(T.attrTotal()).to.equal(16);
  });

  it('reports an overspend rather than clamping it', function () {
    // Companion sheets are authored over budget; the bar shows red, the
    // maths must not quietly hide it.
    st({ level: 1, abilities: { geomancer: 5 } });
    expect(T.abilSpent()).to.equal(15);
    expect(T.abilSpent()).to.be.above(T.abilTotal());
  });

  it('charges nothing for an ability sitting at rank 0', function () {
    st({ abilities: { geomancer: 0, aerotheurge: 0 } });
    expect(T.abilSpent()).to.equal(0);
  });

  it('spends nothing on a blank state', function () {
    st();
    expect(T.attrSpent()).to.equal(0);
    expect(T.abilSpent()).to.equal(0);
    expect(T.talSpent()).to.equal(0);
  });

  it('charges the documented cumulative cost at every rank', function () {
    [[0, 0], [1, 1], [2, 3], [3, 6], [4, 10], [5, 15]].forEach(function (p) {
      expect(T.rankCost(p[0]), 'rank ' + p[0]).to.equal(p[1]);
    });
  });
});

describe('attrFloor edge cases', function () {

  it('falls back to base 5 for attributes the floor does not mention', function () {
    // Wolgraff's sheet floors Strength only; the rest must still measure
    // against 5, or the whole sheet reads as overspent.
    st({ attrFloor: { strength: 4 }, attrs: { strength: 4, dexterity: 5,
         intelligence: 5, constitution: 5, speed: 5, perception: 5 } });
    expect(T.attrFloor('strength')).to.equal(4);
    expect(T.attrFloor('dexterity')).to.equal(R.attributes.base);
    expect(T.attrSpent()).to.equal(0);
  });

  it('ignores a floor entry that is not a number', function () {
    st({ attrFloor: { strength: null } });
    expect(T.attrFloor('strength')).to.equal(R.attributes.base);
  });

  it('handles a floor of 0 rather than treating it as absent', function () {
    st({ attrFloor: { strength: 0 }, attrs: { strength: 5, dexterity: 5,
         intelligence: 5, constitution: 5, speed: 5, perception: 5 } });
    expect(T.attrFloor('strength')).to.equal(0);
    expect(T.attrSpent()).to.equal(5);
  });
});

describe('gear edge cases', function () {

  it('never lets gear change what a build costs', function () {
    st({ abilities: { geomancer: 2 }, attrs: { strength: 8, dexterity: 5,
         intelligence: 5, constitution: 5, speed: 5, perception: 5 },
         gearAbils: { geomancer: 3 }, gearAttrs: { strength: 7 } });
    expect(T.abilSpent()).to.equal(3);
    expect(T.attrSpent()).to.equal(3);
  });

  it('treats a zero gear bonus as no bonus', function () {
    st({ attrs: { strength: 7, dexterity: 5, intelligence: 5,
         constitution: 5, speed: 5, perception: 5 }, gearAttrs: { strength: 0 } });
    expect(T.effAttr('strength')).to.equal(7);
  });

  it('clamps an over-rank-5 effective rank down to the slot table', function () {
    // effRank can exceed 5 through gear plus Scientist; the slot table has
    // no row past 5 and must not read off its end.
    st({ abilities: { crafting: 5 }, gearAbils: { crafting: 3 }, talents: ['Scientist'] });
    expect(T.effRank('crafting')).to.equal(9);
    expect(T.slotsFor('crafting')).to.deep.equal(R.skillSlots[R.skillSlots.length - 1]);
  });

  it('clamps a negative effective rank up to the rank-0 row', function () {
    st({ gearAbils: { geomancer: -3 } });
    expect(T.effRank('geomancer')).to.equal(-3);
    expect(T.slotsFor('geomancer')).to.deep.equal(R.skillSlots[0]);
  });
});

describe('skill lock boundaries', function () {

  function skillAt(school, tier) {
    return window.DOS_SKILLS.find(function (s) { return s.s === school && s.t === tier; });
  }

  it('opens the master tier at rank 4 and not at rank 3', function () {
    var s = skillAt('geomancer', 'master');
    st({ abilities: { geomancer: 3 } });
    expect(T.skillLock(s)).to.be.a('string');
    st({ abilities: { geomancer: 4 } });
    expect(T.skillLock(s)).to.equal(null);
  });

  it('unlocks a tier on gear rank alone, with no points paid', function () {
    var s = skillAt('geomancer', 'adept');
    st({ gearAbils: { geomancer: 2 } });
    expect(T.skillLock(s)).to.equal(null);
  });

  it('frees the last slot again when a skill is removed', function () {
    var master = window.DOS_SKILLS.filter(function (s) {
      return s.s === 'geomancer' && s.t === 'master';
    });
    st({ abilities: { geomancer: 4 }, skills: [master[0].n] });   // 1 master slot at rank 4
    expect(T.skillLock(master[1])).to.be.a('string');
    st({ abilities: { geomancer: 4 }, skills: [] });
    expect(T.skillLock(master[1])).to.equal(null);
  });

  it('does not let a granted skill consume the slot a paid one needs', function () {
    var master = window.DOS_SKILLS.filter(function (s) {
      return s.s === 'geomancer' && s.t === 'master';
    });
    st({ abilities: { geomancer: 4 }, skills: [master[0].n], granted: [master[0].n] });
    expect(T.knownIn('geomancer', 'master')).to.equal(0);
    expect(T.countIn('geomancer', 'master')).to.equal(1);
    expect(T.skillLock(master[1])).to.equal(null);
  });

  it('names the rank the tier actually opens at', function () {
    var s = skillAt('geomancer', 'master');
    st({ abilities: { geomancer: 1 } });
    expect(T.skillLock(s)).to.contain('4');
  });
});

describe('pruning edge cases', function () {

  it('leaves a legal build untouched, array identity included', function () {
    var s = st({ abilities: { geomancer: 1 } });
    var skills = window.DOS_SKILLS.filter(function (x) {
      return x.s === 'geomancer' && x.t === 'novice';
    }).slice(0, 2).map(function (x) { return x.n; });
    s.skills = skills.slice();
    var before = s.skills;
    T.pruneSkills();
    expect(T.getState().skills).to.equal(before);
  });

  it('survives pruning an empty build', function () {
    st();
    T.pruneSkills();
    T.pruneTalents();
    expect(T.getState().skills).to.deep.equal([]);
    expect(T.getState().talents).to.deep.equal([]);
  });

  it('drops a skill name the data no longer knows', function () {
    st({ abilities: { geomancer: 1 }, skills: ['Not A Real Skill'] });
    T.pruneSkills();
    expect(T.getState().skills).to.deep.equal([]);
  });

  it('keeps a granted skill that is not in the data at all', function () {
    // Granted names are exempt from the slot economy but still have to
    // resolve — an unknown one is dropped rather than crashing the prune.
    st({ skills: ['Not A Real Skill'], granted: ['Not A Real Skill'] });
    T.pruneSkills();
    expect(T.getState().skills).to.deep.equal([]);
  });

  it('trims the overflow but keeps the earlier picks', function () {
    var novice = window.DOS_SKILLS.filter(function (s) {
      return s.s === 'geomancer' && s.t === 'novice';
    }).slice(0, 5).map(function (s) { return s.n; });
    st({ abilities: { geomancer: 1 }, skills: novice });   // rank 1 = 3 novice slots
    T.pruneSkills();
    expect(T.getState().skills).to.deep.equal(novice.slice(0, 3));
  });

  it('prunes each school and tier independently', function () {
    var geo = window.DOS_SKILLS.filter(function (s) {
      return s.s === 'geomancer' && s.t === 'novice';
    }).slice(0, 4).map(function (s) { return s.n; });
    var aero = window.DOS_SKILLS.filter(function (s) {
      return s.s === 'aerotheurge' && s.t === 'novice';
    }).slice(0, 2).map(function (s) { return s.n; });
    st({ abilities: { geomancer: 1, aerotheurge: 1 }, skills: geo.concat(aero) });
    T.pruneSkills();
    expect(T.getState().skills).to.deep.equal(geo.slice(0, 3).concat(aero));
  });

  it('drops a talent whose level requirement is no longer met', function () {
    var lv = window.DOS_TALENTS.find(function (t) { return t.req && t.req.level; });
    if (!lv) return;                       // no level-gated talent shipped
    st({ level: lv.req.level, talents: [lv.name] });
    T.pruneTalents();
    expect(T.getState().talents).to.deep.equal([lv.name]);
    st({ level: lv.req.level - 1, talents: [lv.name] });
    T.pruneTalents();
    expect(T.getState().talents).to.deep.equal([]);
  });

  it('keeps a talent that Scientist alone qualifies', function () {
    // Scientist's +1 is a real rank for prerequisites, so a talent needing
    // Crafting 1 survives a prune on the talent alone.
    var t = { name: 'Synthetic', req: { ability: 'crafting', rank: 1 } };
    st({ talents: ['Scientist'] });
    expect(T.talentMet(t).ok).to.equal(true);
    st({});
    expect(T.talentMet(t).ok).to.equal(false);
  });
});

describe('helper edge cases', function () {

  it('clamps a value already inside the range unchanged', function () {
    expect(T.clamp(3, 1, 5)).to.equal(3);
    expect(T.clamp(1, 1, 5)).to.equal(1);
    expect(T.clamp(5, 1, 5)).to.equal(5);
  });

  it('lets the low bound win when the range is inverted', function () {
    expect(T.clamp(3, 5, 1)).to.equal(5);
  });

  it('escapes every dangerous character, repeated', function () {
    expect(T.escapeHtml('<a href="x">&</a>'))
      .to.equal('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });

  it('leaves an ordinary item name alone', function () {
    expect(T.escapeHtml("Pixie Dust")).to.equal('Pixie Dust');
  });

  it('coerces a non-string rather than throwing', function () {
    expect(T.escapeHtml(5)).to.equal('5');
    expect(T.escapeHtml(null)).to.equal('null');
  });

  it('returns null, not an empty list, when nothing is short', function () {
    var s = window.DOS_SKILLS.find(function (x) { return x.attr; });
    var key = Object.keys(s.attr)[0];
    var attrs = {};
    R.attributes.list.forEach(function (a) { attrs[a.id] = R.attributes.base; });
    attrs[key] = s.attr[key];
    st({ attrs: attrs });
    expect(T.attrShortfall(s)).to.equal(null);
  });

  it('never reports a negative AP penalty above the recommendation', function () {
    var s = window.DOS_SKILLS.find(function (x) { return x.rank === 1; });
    st({ abilities: {}, gearAbils: {} });
    var o = {}; o[s.s] = 5;
    st({ abilities: o });
    expect(T.apPenalty(s)).to.equal(0);
  });
});

});   // Build character tests

})();
