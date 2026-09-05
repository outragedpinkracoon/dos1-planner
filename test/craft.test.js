// buildRank() re-derives the planner's effRank() logic against a build's raw
// saved state, since crafting.html doesn't load app.js. This is the one place
// that duplication can drift, so it gets its own coverage.
/* global describe, it, chai */
(function () {
'use strict';
var expect = chai.expect;
var T = window.DOS_CRAFT_TEST;

describe('Crafting tests', function () {

  describe('buildRank', function () {

    it('reads paid rank plus gear, same as the planner', function () {
      var bs = { abilities: { crafting: 2 }, gearAbils: { crafting: 1 } };
      expect(T.buildRank(bs, 'Crafting')).to.equal(3);
    });

    it('adds Scientist as a stacking +1, same as the planner does', function () {
      var bs = { talents: ['Scientist'], abilities: { crafting: 2 } };
      expect(T.buildRank(bs, 'Crafting')).to.equal(3);
      expect(T.buildRank(bs, 'Smithing')).to.equal(1);
    });

    it('stacks Scientist, paid rank and gear together', function () {
      var bs = { talents: ['Scientist'], abilities: { crafting: 2 }, gearAbils: { crafting: 1 } };
      expect(T.buildRank(bs, 'Crafting')).to.equal(4);
    });

    it('counts a granted Scientist the same as a picked one', function () {
      var bs = { grantedTalents: ['Scientist'] };
      expect(T.buildRank(bs, 'Crafting')).to.equal(1);
    });

    it('leaves non-crafting builds at 0 with no talent, ranks or gear', function () {
      var bs = {};
      expect(T.buildRank(bs, 'Crafting')).to.equal(0);
      expect(T.buildRank(bs, 'Smithing')).to.equal(0);
    });
  });
});
})();
