// The crafting page's logic: buildRank(), which re-derives the planner's
// effRank() against a build's raw saved state since crafting.html doesn't load
// app.js and that duplication can drift, plus the matcher that decides what a
// bag can make - slotHave, status, skillOK, the ladder grouping - and the
// invariants over data/recipes.js itself.
/* global describe, it, chai */
(function () {
'use strict';
var expect = chai.expect;
var C = window.DOS_CRAFT_TEST;
var DATA = window.DOS_RECIPES;
var RECIPES = DATA.recipes;

// Every matcher test drives craft.js's own functions against a state it owns,
// so nothing leaks between tests and localStorage is never touched.
function cs(over) {
  var s = C.blank();
  Object.keys(over || {}).forEach(function (k) { s[k] = over[k]; });
  C.setState(s);
  return s;
}

function byResult(name) {
  return RECIPES.find(function (r) { return r.result === name; });
}

describe('Crafting tests', function () {

  describe('buildRank', function () {

    it('reads paid rank plus gear, same as the planner', function () {
      var bs = { abilities: { crafting: 2 }, gearAbils: { crafting: 1 } };
      expect(C.buildRank(bs, 'Crafting')).to.equal(3);
    });

    it('adds Scientist as a stacking +1, same as the planner does', function () {
      var bs = { talents: ['Scientist'], abilities: { crafting: 2 } };
      expect(C.buildRank(bs, 'Crafting')).to.equal(3);
      expect(C.buildRank(bs, 'Smithing')).to.equal(1);
    });

    it('stacks Scientist, paid rank and gear together', function () {
      var bs = { talents: ['Scientist'], abilities: { crafting: 2 }, gearAbils: { crafting: 1 } };
      expect(C.buildRank(bs, 'Crafting')).to.equal(4);
    });

    it('counts a granted Scientist the same as a picked one', function () {
      var bs = { grantedTalents: ['Scientist'] };
      expect(C.buildRank(bs, 'Crafting')).to.equal(1);
    });

    it('leaves non-crafting builds at 0 with no talent, ranks or gear', function () {
      var bs = {};
      expect(C.buildRank(bs, 'Crafting')).to.equal(0);
      expect(C.buildRank(bs, 'Smithing')).to.equal(0);
    });
  });


describe('slotHave — stations vs carried items', function () {

  it('satisfies a station slot from the bench, never from the bag', function () {
    cs({ tools: { Anvil: true } });
    expect(C.slotHave(['Anvil'])).to.equal('Anvil');
    // A station in the bag is meaningless: you cannot carry an anvil.
    cs({ bag: { Anvil: true } });
    expect(C.slotHave(['Anvil'])).to.equal(null);
  });

  it('satisfies a carried tool from the bag, never from the bench', function () {
    // A knife is consumed by some recipes, so it is bag stock, not a station.
    cs({ bag: { Knife: true } });
    expect(C.slotHave(['Knife'])).to.equal('Knife');
    cs({ tools: { Knife: true } });
    expect(C.slotHave(['Knife'])).to.equal(null);
  });

  it('takes the first alternative it can satisfy', function () {
    cs({ tools: { 'Water Barrel': true, Well: true } });
    expect(C.slotHave(['Water Barrel', 'Well'])).to.equal('Water Barrel');
  });

  it('falls through to a later alternative when the first is missing', function () {
    cs({ tools: { Well: true } });
    expect(C.slotHave(['Water Barrel', 'Well'])).to.equal('Well');
  });

  it('mixes a bag alternative with a station alternative in one slot', function () {
    // Cup of Water: Bottle of Water is carried, Water Barrel and Well are not.
    cs({ bag: { 'Bottle of Water': true } });
    expect(C.slotHave(['Bottle of Water', 'Water Barrel', 'Well'])).to.equal('Bottle of Water');
    cs({ tools: { Well: true } });
    expect(C.slotHave(['Bottle of Water', 'Water Barrel', 'Well'])).to.equal('Well');
  });

  it('returns null for an empty bag and bench', function () {
    cs();
    expect(C.slotHave(['Anvil'])).to.equal(null);
    expect(C.slotHave(['Knife'])).to.equal(null);
  });

  it('returns null rather than throwing on an item the data does not know', function () {
    cs({ bag: { 'Not An Item': true } });
    // Unknown names are not stations, so they are read from the bag as normal.
    expect(C.slotHave(['Not An Item'])).to.equal('Not An Item');
    cs();
    expect(C.slotHave(['Not An Item'])).to.equal(null);
  });
});

describe('status — have, near, no', function () {

  var bw = byResult('Bucket of Water');   // Bucket + (Water Barrel | Well)

  it('reports have when both slots are satisfied', function () {
    cs({ bag: { Bucket: true }, tools: { Well: true } });
    var s = C.status(bw);
    expect(s.state).to.equal('have');
    expect(s.a).to.equal('Bucket');
    expect(s.b).to.equal('Well');
  });

  it('reports near and names the missing slot when only a is held', function () {
    cs({ bag: { Bucket: true } });
    var s = C.status(bw);
    expect(s.state).to.equal('near');
    expect(s.need).to.equal(bw.b);
  });

  it('reports near and names the missing slot when only b is held', function () {
    cs({ tools: { Well: true } });
    var s = C.status(bw);
    expect(s.state).to.equal('near');
    expect(s.need).to.equal(bw.a);
  });

  it('reports no when neither slot is satisfied', function () {
    cs();
    expect(C.status(bw).state).to.equal('no');
  });

  it('is never near on an empty bag — that is the whole point of two slots', function () {
    cs();
    RECIPES.forEach(function (r) {
      expect(C.status(r).state, r.result).to.equal('no');
    });
  });

  it('makes nothing from stations alone with an empty bag', function () {
    // The invariant that caught the carried-tool bug: ticking every station
    // at the bench must still craft nothing without ingredients.
    var tools = {};
    C.stations.forEach(function (n) { tools[n] = true; });
    cs({ tools: tools });
    var made = RECIPES.filter(function (r) { return C.status(r).state === 'have'; });
    expect(made.map(function (r) { return r.result; })).to.deep.equal([]);
  });
});

describe('skillOK — gates are shown, not hidden', function () {

  it('passes a recipe with no skill requirement at skill 0', function () {
    var free = RECIPES.find(function (r) { return !r.skill || !r.level; });
    cs({ skills: { Crafting: 0, Smithing: 0 } });
    expect(C.skillOK(free)).to.equal(true);
  });

  it('fails one rank short and passes exactly at the level', function () {
    var r = RECIPES.find(function (x) { return x.skill === 'Crafting' && x.level === 3; });
    cs({ skills: { Crafting: 2, Smithing: 0 } });
    expect(C.skillOK(r)).to.equal(false);
    cs({ skills: { Crafting: 3, Smithing: 0 } });
    expect(C.skillOK(r)).to.equal(true);
  });

  it('passes above the level', function () {
    var r = RECIPES.find(function (x) { return x.skill === 'Crafting' && x.level === 3; });
    cs({ skills: { Crafting: 5, Smithing: 0 } });
    expect(C.skillOK(r)).to.equal(true);
  });

  it('does not let Crafting satisfy a Smithing recipe', function () {
    var r = RECIPES.find(function (x) { return x.skill === 'Smithing' && x.level >= 3; });
    cs({ skills: { Crafting: 5, Smithing: 0 } });
    expect(C.skillOK(r)).to.equal(false);
  });

  it('treats a missing skill entry as 0 rather than throwing', function () {
    var r = RECIPES.find(function (x) { return x.skill === 'Crafting' && x.level >= 1; });
    cs({ skills: {} });
    expect(C.skillOK(r)).to.equal(false);
  });
});

describe('skillLevels — override beats build beats manual', function () {

  it('uses the manual numbers when no build is loaded', function () {
    cs({ skills: { Crafting: 2, Smithing: 3 } });
    expect(C.skillLevels()).to.deep.equal({ Crafting: 2, Smithing: 3 });
  });

  it('lets a typed override win over the manual numbers', function () {
    cs({ skills: { Crafting: 2, Smithing: 3 }, override: { Crafting: 5, Smithing: 5 } });
    expect(C.skillLevels()).to.deep.equal({ Crafting: 5, Smithing: 5 });
  });

  it('falls back to the manual numbers when the named build is gone', function () {
    // A build deleted in the planner must not leave this page reading a
    // record that no longer exists.
    cs({ build: 'No Such Build', skills: { Crafting: 1, Smithing: 1 } });
    expect(C.skillLevels()).to.deep.equal({ Crafting: 1, Smithing: 1 });
  });
});

describe('ingredientsOf', function () {

  it('lists both slots', function () {
    expect(C.ingredientsOf({ a: ['Anvil'], b: ['Iron Bar'] }))
      .to.deep.equal(['Anvil', 'Iron Bar']);
  });

  it('lists every alternative, not just the first', function () {
    var bw = byResult('Bucket of Water');
    expect(C.ingredientsOf(bw)).to.deep.equal(['Bucket', 'Water Barrel', 'Well']);
  });

  it('deduplicates a name appearing in both slots', function () {
    expect(C.ingredientsOf({ a: ['Rope'], b: ['Rope'] })).to.deep.equal(['Rope']);
  });
});

describe('ladders — same inputs, different skill levels', function () {

  it('groups every rung of a tier ladder under one signature', function () {
    var r = byResult('Crafted Two Handed Axe (tier 1)');
    var rungs = C.ladderOf(r);
    expect(rungs.length).to.be.above(1);
    rungs.forEach(function (x) {
      expect(x.a).to.deep.equal(r.a);
      expect(x.b).to.deep.equal(r.b);
    });
  });

  it('sorts the rungs by level, ascending', function () {
    var rungs = C.ladderOf(byResult('Crafted Two Handed Axe (tier 1)'));
    for (var i = 1; i < rungs.length; i++) {
      expect(rungs[i].level).to.be.at.least(rungs[i - 1].level);
    }
  });

  it('includes the recipe itself in its own ladder', function () {
    var r = byResult('Crafted Two Handed Axe (tier 3)');
    expect(C.ladderOf(r).indexOf(r)).to.be.at.least(0);
  });

  it('gives a one-off recipe a ladder of exactly itself', function () {
    var solo = RECIPES.find(function (r) { return C.ladderOf(r).length === 1; });
    expect(C.ladderOf(solo)).to.deep.equal([solo]);
  });

  it('never puts two recipes with different inputs in one ladder', function () {
    RECIPES.forEach(function (r) {
      var sig = r.a.join('|') + '␟' + r.b.join('|');
      C.ladderOf(r).forEach(function (x) {
        expect(x.a.join('|') + '␟' + x.b.join('|'), r.result).to.equal(sig);
      });
    });
  });
});

describe('recipe data invariants', function () {

  it('gives every recipe two non-empty slots', function () {
    RECIPES.forEach(function (r) {
      expect(r.a, r.result).to.be.an('array').that.is.not.empty;
      expect(r.b, r.result).to.be.an('array').that.is.not.empty;
    });
  });

  it('resolves every ingredient to a known item', function () {
    RECIPES.forEach(function (r) {
      C.ingredientsOf(r).forEach(function (n) {
        expect(C.byName[n], r.result + ' needs ' + n).to.be.an('object');
      });
    });
  });

  it('keeps every skill level within 0-5, on a skill the data knows', function () {
    RECIPES.forEach(function (r) {
      if (r.skill) expect(['Crafting', 'Smithing', 'Tenebrium'], r.result).to.contain(r.skill);
      expect(r.level, r.result).to.be.at.least(0);
      expect(r.level, r.result).to.be.at.most(5);
    });
  });

  // One recipe - Add Tenebrium Effect, at Tenebrium 3 - is gated on a third
  // ability the crafting page has no input for: ABIL maps Crafting and
  // Smithing only, so skillLevels() never reports Tenebrium and skillOK reads
  // it as 0. The recipe therefore renders permanently greyed, which is the
  // page's "shown, not hidden" behaviour and not a lie, but it can never go
  // green however the character is built. Asserted so the day a Tenebrium
  // input is added, this is what fails and says why.
  it('leaves the one Tenebrium recipe ungateable, since the page has no input for it', function () {
    var teneb = RECIPES.filter(function (r) { return r.skill === 'Tenebrium'; });
    expect(teneb).to.have.lengthOf(1);
    expect(teneb[0].result).to.equal('Add Tenebrium Effect');

    cs({ skills: { Crafting: 5, Smithing: 5 } });
    expect(C.skillLevels().Tenebrium).to.equal(undefined);
    expect(C.skillOK(teneb[0])).to.equal(false);
  });

  it('leaves no raw asset ids in the cleaned data', function () {
    RECIPES.forEach(function (r) {
      expect(r.result, r.result).to.not.match(/^LOOT_|_[A-E]$/);
    });
  });

  it('agrees between the craftable flag and the recipe list', function () {
    var made = {};
    RECIPES.forEach(function (r) { made[r.result] = true; });
    DATA.items.forEach(function (it) {
      if (it.craftable) expect(made[it.name], it.name + ' flagged craftable').to.equal(true);
    });
  });

  it('makes no recipe entirely out of stations', function () {
    var station = {};
    C.stations.forEach(function (n) { station[n] = true; });
    RECIPES.forEach(function (r) {
      var all = C.ingredientsOf(r).every(function (n) { return station[n]; });
      expect(all, r.result + ' is all stations').to.equal(false);
    });
  });

  it('keeps Stunning Arrowhead flagged unverified, with its guessed inputs', function () {
    var r = byResult('Stunning Arrowhead');
    expect(r.unverified).to.equal(true);
    expect(C.ingredientsOf(r)).to.contain('Knife');
  });
});


// The bag lives on the planner's build record, so three places in two files
// have to agree on the same field names: syncToBuild() writes them,
// storeBuild() copies them forward when the planner saves over the same name,
// and restoreBuild() strips them out of working state. The round-trip through
// localStorage is untested by choice (see CLAUDE.md, "Not built"), but the
// shape of what crosses between the pages is checked here.
describe('the bag\'s trip between the two pages', function () {

  var CRAFT_FIELDS = ['bag', 'benchTools', 'craftSkills'];

  it('keeps the crafting page\'s fields off a fresh planner build', function () {
    // blankState() is the planner's shape; the craft fields are added only by
    // the crafting page, and must not be part of a new build.
    var blank = window.DOS_TEST.blankState();
    CRAFT_FIELDS.forEach(function (f) {
      expect(blank, f).to.not.have.property(f);
    });
  });

  it('reads a build\'s ranks straight off the record the planner saved', function () {
    // What adoptBuild() hands to buildRank() is rec.state - a planner build,
    // untranslated. A build saved by the planner has to be readable as-is.
    var planner = window.DOS_TEST.presetState('wizard');
    expect(C.buildRank(planner, 'Crafting')).to.be.a('number');
    expect(C.buildRank(planner, 'Smithing')).to.be.a('number');
  });

  it('survives a planner build that has never seen the crafting page', function () {
    // No bag, no benchTools, no craftSkills - every read must default rather
    // than throw, since most builds are saved before crafting is opened.
    var planner = window.DOS_TEST.presetState('fighter');
    expect(planner.bag).to.equal(undefined);
    cs({ bag: planner.bag || {}, tools: planner.benchTools || {},
         override: planner.craftSkills || null });
    expect(C.skillLevels()).to.deep.equal({ Crafting: 0, Smithing: 0 });
    expect(C.slotHave(['Anvil'])).to.equal(null);
  });

  it('gives a Scientist build its crafting rank on this page', function () {
    // The end-to-end reason buildRank exists: a build that leans on the talent
    // rather than paid ranks must not read as unskilled here.
    var planner = window.DOS_TEST.blankState();
    planner.talents = ['Scientist'];
    expect(C.buildRank(planner, 'Crafting')).to.equal(1);

    cs({ build: null, skills: { Crafting: C.buildRank(planner, 'Crafting'),
                                Smithing: C.buildRank(planner, 'Smithing') } });
    var lvl1 = RECIPES.find(function (r) { return r.skill === 'Crafting' && r.level === 1; });
    expect(C.skillOK(lvl1)).to.equal(true);
  });

  it('treats an emptied bag as empty, not as absent', function () {
    // Clearing the bag writes {} rather than deleting the field; that must not
    // read back as "no bag recorded" and resurrect stale contents.
    cs({ bag: {} });
    expect(C.slotHave(['Knife'])).to.equal(null);
  });
});

});
})();
