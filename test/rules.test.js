// Progression maths, gear/talent floors, slot limits and pruning.
// These are the rules CLAUDE.md documents; the numbers here are the wiki totals.
/* global describe, it, chai */
(function () {
'use strict';
var expect = chai.expect;
var T = window.DOS_TEST;

// Every test drives the app's own functions against a state it owns, so
// nothing leaks between tests and localStorage is never touched.
function st(over) {
  var s = T.blankState();
  Object.keys(over || {}).forEach(function (k) { s[k] = over[k]; });
  T.setState(s);
  return s;
}

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

  it("applies Scientist as a floor of 1, not a bonus", function () {
    st({ talents: ['Scientist'] });
    expect(T.effRank('crafting')).to.equal(1);
    expect(T.effRank('blacksmithing')).to.equal(1);

    // A floor does not stack on top of a paid rank.
    st({ talents: ['Scientist'], abilities: { crafting: 3 } });
    expect(T.effRank('crafting')).to.equal(3);
  });

  it('adds gear on top of the Scientist floor', function () {
    // Scientist sets crafting's floor to 1 with 0 ranks paid. Gear should
    // stack on top of that floor, same as it stacks on top of a paid rank.
    st({ talents: ['Scientist'], gearAbils: { crafting: 1 } });
    expect(T.effRank('crafting')).to.equal(2);
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

})();
