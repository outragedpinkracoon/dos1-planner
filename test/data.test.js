// Data integrity. CLAUDE.md notes the real bugs (Fighter/Whirlwind,
// Wolgraff/Strength-4) were found by checking invariants, not by clicking.
/* global describe, it, chai */
(function () {
'use strict';
var expect = chai.expect;
var T = window.DOS_TEST;
var R = window.DOS_RULES;
var ABILITIES = window.DOS_ABILITIES;
var TALENTS = window.DOS_TALENTS;
var SKILLS = window.DOS_SKILLS;
var PRESETS = window.DOS_PRESETS;

var abilIds = ABILITIES.map(function (a) { return a.id; });
var attrIds = R.attributes.list.map(function (a) { return a.id; });
var talentNames = TALENTS.map(function (t) { return t.name; });
var TIERS = ['novice', 'adept', 'master'];

describe('data shape', function () {

  it('has the documented counts', function () {
    expect(ABILITIES).to.have.lengthOf(30);
    expect(TALENTS).to.have.lengthOf(50);
    expect(SKILLS).to.have.lengthOf(130);
  });

  it('has unique ability ids', function () {
    expect(new Set(abilIds).size).to.equal(abilIds.length);
  });

  it('has unique skill names', function () {
    var names = SKILLS.map(function (s) { return s.n; });
    expect(new Set(names).size).to.equal(names.length);
  });

  it('has unique talent names', function () {
    expect(new Set(talentNames).size).to.equal(talentNames.length);
  });

  it('covers 8 schools x 3 tiers', function () {
    var schools = new Set(SKILLS.map(function (s) { return s.s; }));
    expect(schools.size).to.equal(8);
    schools.forEach(function (id) {
      expect(abilIds, id + ' is a real ability').to.include(id);
    });
  });
});

describe('skills', function () {

  it('names a school that is a skill-gating ability', function () {
    var schoolIds = ABILITIES.filter(function (a) { return a.school; })
                             .map(function (a) { return a.id; });
    SKILLS.forEach(function (s) {
      expect(schoolIds, s.n).to.include(s.s);
    });
  });

  it('uses a known tier', function () {
    SKILLS.forEach(function (s) {
      expect(TIERS, s.n).to.include(s.t);
    });
  });

  it('recommends a rank within 1-5', function () {
    SKILLS.forEach(function (s) {
      expect(s.rank, s.n).to.be.within(1, R.abilityPoints.maxRank);
    });
  });

  it('requires only real attributes, at sane values', function () {
    SKILLS.forEach(function (s) {
      if (!s.attr) return;
      Object.keys(s.attr).forEach(function (k) {
        expect(attrIds, s.n + ' -> ' + k).to.include(k);
        expect(s.attr[k], s.n).to.be.within(1, 20);
      });
    });
  });

  // Toggled stances (Melee Defensive Stance and friends) genuinely cost 0 AP,
  // so this is at-least-0, not above-0.
  it('has a non-negative AP cost and cooldown', function () {
    SKILLS.forEach(function (s) {
      expect(s.ap, s.n).to.be.at.least(0);
      expect(s.cd, s.n).to.be.at.least(0);
    });
  });

  it('is reachable — every skill can be slotted at some rank', function () {
    // A tier with no slots at any rank would be a permanently dead skill.
    SKILLS.forEach(function (s) {
      var reachable = R.skillSlots.some(function (row) { return row[s.t] > 0; });
      expect(reachable, s.n + ' (' + s.t + ')').to.equal(true);
    });
  });
});

describe('talents', function () {

  it('points prerequisites at real abilities and attributes', function () {
    TALENTS.forEach(function (t) {
      if (!t.req) return;
      if (t.req.ability !== undefined) {
        expect(abilIds, t.name).to.include(t.req.ability);
        expect(t.req.rank, t.name).to.be.within(1, R.abilityPoints.maxRank);
      }
      if (t.req.attr !== undefined) {
        expect(attrIds, t.name).to.include(t.req.attr);
      }
      if (t.req.level !== undefined) {
        expect(t.req.level, t.name).to.be.within(1, R.maxLevel);
      }
    });
  });

  it('has a description on every talent', function () {
    TALENTS.forEach(function (t) {
      expect(t.desc, t.name).to.be.a('string').and.not.empty;
    });
  });
});

describe('presets', function () {

  var all = PRESETS.classes.concat(PRESETS.companions);
  // Custom is the deliberate blank slate - you spend its points yourself,
  // so it is exempt from the creation budgets the real classes must hit.
  var builtClasses = PRESETS.classes.filter(function (c) { return c.id !== 'custom'; });

  it('spends exactly 5 attribute points on every class', function () {
    builtClasses.forEach(function (c) {
      var spent = Object.keys(c.attrs).reduce(function (n, k) {
        return n + c.attrs[k];
      }, 0);
      expect(spent, c.name).to.equal(R.attributes.creationPoints);
    });
  });

  it('spends exactly 5 ability points on every class', function () {
    builtClasses.forEach(function (c) {
      var spent = Object.keys(c.abilities).reduce(function (n, id) {
        return n + T.rankCost(c.abilities[id]);
      }, 0);
      expect(spent, c.name).to.equal(R.abilityPoints.creationPoints);
    });
  });

  it('takes exactly 2 talents on every class', function () {
    builtClasses.forEach(function (c) {
      expect(c.talents, c.name).to.have.lengthOf(R.talents.creationPoints);
    });
  });

  it('resolves every preset skill to a real skill', function () {
    all.forEach(function (c) {
      (c.skills || []).forEach(function (n) {
        expect(T.skillByName(n), c.name + ' -> ' + n).to.exist;
      });
    });
  });

  it('resolves every preset talent to a real talent', function () {
    all.forEach(function (c) {
      (c.talents || []).forEach(function (n) {
        expect(talentNames, c.name + ' -> ' + n).to.include(n);
      });
    });
  });

  it('resolves every preset ability to a real ability, at a legal rank', function () {
    all.forEach(function (c) {
      Object.keys(c.abilities || {}).forEach(function (id) {
        expect(abilIds, c.name + ' -> ' + id).to.include(id);
        expect(c.abilities[id], c.name).to.be.within(1, R.abilityPoints.maxRank);
      });
    });
  });

  it('has unique preset ids', function () {
    var ids = all.map(function (c) { return c.id; });
    expect(new Set(ids).size).to.equal(ids.length);
  });
});

describe('companions', function () {
  // Hand-authored by the game: these deliberately break creation budgets.
  // Asserted as-published so a "helpful" rebalance is caught, not welcomed.

  function comp(id) {
    return PRESETS.companions.find(function (c) { return c.id === id; });
  }

  // Companions record absolute values in attrsTotal, not bonuses over base.
  it('keeps Wolgraff at Strength 4, below the base 5', function () {
    var w = comp('wolgraff');
    expect(w, 'wolgraff preset exists').to.exist;
    expect(w.attrsTotal.strength).to.equal(4);
    expect(w.attrsTotal.strength).to.be.below(R.attributes.base);
  });

  it('gives every companion a full absolute attribute sheet', function () {
    PRESETS.companions.forEach(function (c) {
      expect(c.attrsTotal, c.name).to.be.an('object');
      attrIds.forEach(function (id) {
        expect(c.attrsTotal[id], c.name + ' -> ' + id).to.be.a('number');
      });
    });
  });

  it('lets companions overspend their level-3 budget', function () {
    // Bairdotr 8/7, Wolgraff 9/7, Jahan 7/6 attributes. Documented, not a bug.
    var over = PRESETS.companions.filter(function (c) {
      var abil = Object.keys(c.abilities || {}).reduce(function (n, id) {
        return n + T.rankCost(c.abilities[id]);
      }, 0);
      return abil > 7;
    });
    expect(over.length, 'at least one companion overspends abilities').to.be.above(0);
  });
});

describe('unverified entries are flagged, not hidden', function () {

  it('marks the four known-guessed planner entries', function () {
    var flagged = TALENTS.filter(function (t) { return t.unverified; })
      .map(function (t) { return t.name; })
      .concat(SKILLS.filter(function (s) { return s.unverified; })
        .map(function (s) { return s.n; }))
      .concat(ABILITIES.filter(function (a) { return a.unverified; })
        .map(function (a) { return a.name; }));

    ['Dust Devil', "Razor's Edge", 'Arrow Recovery', 'Tenebrium']
      .forEach(function (n) {
        expect(flagged, n + ' should carry unverified:true').to.include(n);
      });
  });
});

describe('rules table', function () {

  it('has a slot row per rank, 0 through 5', function () {
    expect(R.skillSlots).to.have.lengthOf(R.abilityPoints.maxRank + 1);
  });

  it('never lets slots shrink as rank rises', function () {
    TIERS.forEach(function (tier) {
      for (var i = 1; i < R.skillSlots.length; i++) {
        expect(R.skillSlots[i][tier], tier + ' at rank ' + i)
          .to.be.at.least(R.skillSlots[i - 1][tier]);
      }
    });
  });

  it('opens each tier at the documented rank', function () {
    function opensAt(tier) {
      return R.skillSlots.findIndex(function (r) { return r[tier] > 0; });
    }
    expect(opensAt('novice')).to.equal(1);
    expect(opensAt('adept')).to.equal(2);
    expect(opensAt('master')).to.equal(4);
  });
});

})();
