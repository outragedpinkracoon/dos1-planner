/* DOS1 EE crafting reference.
   Same shape as app.js: one IIFE, no modules, full redraw, delegated events. */
(function () {
'use strict';

var DATA    = window.DOS_RECIPES;
var RECIPES = DATA.recipes;
var ITEMS   = DATA.items;

var KEY = 'dos1-planner:craft';           // the loose bag, when no build is loaded
var BUILDS_KEY = 'dos1-planner:builds';   // the planner's named saves

/* The two crafting abilities, as the planner stores them. The recipe data calls
   blacksmithing "Smithing". */
var ABIL = { Crafting: 'crafting', Smithing: 'blacksmithing' };

function loadBuilds() {
  try {
    var b = JSON.parse(localStorage.getItem(BUILDS_KEY) || '{}');
    return b && typeof b === 'object' ? b : {};
  } catch (e) { return {}; }
}

function saveBuilds(b) {
  try { localStorage.setItem(BUILDS_KEY, JSON.stringify(b)); return true; }
  catch (e) { return false; }
}

/* Points-bought rank plus any gear bonus - same shape as the planner's effRank().
   Scientist's +1 Crafting/+1 Blacksmithing stacks the same way gear does, so it
   has to be added here too, or a build that leans on Scientist instead of paid
   ranks shows up on this page as if the skill were never taken. */
function hasTalent(bs, name) {
  return (bs.talents || []).indexOf(name) >= 0 ||
    (bs.grantedTalents || []).indexOf(name) >= 0;
}

function buildRank(bs, name) {
  var id = ABIL[name];
  var scientist = (name === 'Crafting' || name === 'Smithing') && hasTalent(bs, 'Scientist') ? 1 : 0;
  return ((bs.abilities || {})[id] || 0) + ((bs.gearAbils || {})[id] || 0) + scientist;
}

/* ---------- item lookup ---------- */

var byName = {};
ITEMS.forEach(function (it) { byName[it.name] = it; });

/* Stations only: fixed in the world, never consumed. Implements like a knife or
   bucket are carried and can be consumed, so they live in the bag instead. */
var STATIONS = ITEMS.filter(function (it) { return it.tool; })
                    .map(function (it) { return it.name; });

/* Recipes that produce a given item, and recipes that consume it. */
var makes = {}, usedBy = {};
RECIPES.forEach(function (r) {
  (makes[r.result] = makes[r.result] || []).push(r);
  ingredientsOf(r).forEach(function (name) {
    (usedBy[name] = usedBy[name] || []).push(r);
  });
});

/* Recipes with identical inputs, keyed by those inputs. 148 of the 499 are tier
   ladders - "Anvil + Iron Bar" makes a tier 1 sword at Smithing 1 and a tier 5 at
   Smithing 5. Shown as one card with the ladder inside, not five near-identical
   cards, because the useful question is "what does MY skill get me". */
var ladders = {};
RECIPES.forEach(function (r) {
  var k = r.a.join('|') + '\u241F' + r.b.join('|');
  (ladders[k] = ladders[k] || []).push(r);
});
Object.keys(ladders).forEach(function (k) {
  ladders[k].sort(function (x, y) { return x.level - y.level; });
});

function ladderOf(r) { return ladders[r.a.join('|') + '\u241F' + r.b.join('|')]; }

/* Every distinct ingredient name a recipe mentions, both slots, all alternatives. */
function ingredientsOf(r) {
  var seen = {}, out = [];
  r.a.concat(r.b).forEach(function (n) {
    if (!seen[n]) { seen[n] = 1; out.push(n); }
  });
  return out;
}

/* ---------- state ---------- */

function blank() {
  return {
    mode: 'make',
    build: null,                 // name of the loaded build, null = loose bag
    bag: {},                     // name -> true
    tools: {},                   // name -> true, stations at the bench
    skills: { Crafting: 0, Smithing: 0 },   // only used when no build is loaded
    override: null,              // {Crafting,Smithing} typed over a build's ranks
    typeFilter: '',
    hideOverLevel: false
  };
}

var state = load();

/* ---------- the loaded build ----------
   When a build is loaded the bag belongs to that character: it is read from and
   written straight back to the planner's saved-builds store, so the two pages
   cannot drift. With no build loaded the bag is loose and lives under KEY. */

function currentBuild() {
  if (!state.build) return null;
  var rec = loadBuilds()[state.build];
  return rec && rec.state ? rec : null;
}

/* Write the bag back into the build it belongs to. */
function syncToBuild() {
  if (!state.build) return;
  var builds = loadBuilds(), rec = builds[state.build];
  if (!rec || !rec.state) return;
  rec.state.bag = state.bag;
  rec.state.benchTools = state.tools;
  rec.state.craftSkills = state.override;
  saveBuilds(builds);
}

/* Pull bag, stations and skills out of a build and onto the page. */
function adoptBuild(name) {
  var rec = loadBuilds()[name];
  if (!rec || !rec.state) return false;
  state.build = name;
  state.bag = rec.state.bag || {};
  state.tools = rec.state.benchTools || {};
  state.override = rec.state.craftSkills || null;
  return true;
}

/* The skill levels in force: a typed override, else the build's ranks, else the
   manual numbers used when planning without a build. */
function skillLevels() {
  if (state.override) return state.override;
  var rec = currentBuild();
  if (rec) {
    return {
      Crafting: buildRank(rec.state, 'Crafting'),
      Smithing: buildRank(rec.state, 'Smithing')
    };
  }
  return state.skills;
}

function load() {
  var s = blank();
  try {
    var raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    Object.keys(s).forEach(function (k) {
      if (raw[k] !== undefined && raw[k] !== null) s[k] = raw[k];
    });
    // Drop anything the data no longer knows about.
    Object.keys(s.bag).forEach(function (n) { if (!byName[n]) delete s.bag[n]; });
  } catch (e) { /* corrupt storage, start clean */ }
  return s;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  syncToBuild();
}

/* ---------- the matcher ---------- */

/* A slot is satisfied if any one of its alternatives is available.
   Stations count as available when ticked at the bench; everything else when
   it is in the bag.
   Returns the name that satisfied it, or null. */
function slotHave(slot) {
  for (var i = 0; i < slot.length; i++) {
    var n = slot[i];
    if (byName[n] && byName[n].tool) { if (state.tools[n]) return n; }
    else if (state.bag[n]) return n;
  }
  return null;
}

/* How a recipe stands against the current bag: 'have', 'near' (one slot short),
   or 'no'. Also reports which slot is missing, for the near-miss list. */
function status(r) {
  var a = slotHave(r.a), b = slotHave(r.b);
  if (a && b) return { state: 'have', a: a, b: b };
  if (a && !b) return { state: 'near', a: a, need: r.b };
  if (!a && b) return { state: 'near', b: b, need: r.a };
  return { state: 'no' };
}

/* Does the character's skill cover this recipe? Level 0 / no skill is always yes. */
function skillOK(r) {
  if (!r.skill || !r.level) return true;
  return (skillLevels()[r.skill] || 0) >= r.level;
}

/* ---------- rendering ---------- */

var el = {};
['skillRows','toolRows','bagList','bagCount','bagEmpty','bagSearch','bagSuggest',
 'makeList','makeCount','nearList','nearCount','typeFilter','hideOverLevel',
 'keepSearch','keepList','howSearch','howResult','clearBag',
 'buildPick','buildNote','skillNote'
].forEach(function (id) { el[id] = document.getElementById(id); });

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function renderBuildPicker() {
  var builds = loadBuilds(), names = Object.keys(builds).sort();

  el.buildPick.innerHTML =
    '<option value="">Loose bag (no build)</option>' +
    names.map(function (n) {
      var s = builds[n].state || {}, c = Object.keys(s.bag || {}).length;
      return '<option value="' + esc(n) + '"' + (n === state.build ? ' selected' : '') + '>' +
        esc(n) + (c ? ' \u00b7 ' + c + ' items' : '') + '</option>';
    }).join('');

  // A build named in the URL but since deleted: fall back rather than wedge.
  if (state.build && !builds[state.build]) {
    state.build = null;
    state.override = null;
  }
  el.buildNote.textContent = names.length
    ? ''
    : 'No saved builds yet. Save one on the planner to keep a bag against it.';
}

function renderAll() {
  renderModes();
  renderBuildPicker();
  renderSkills();
  renderTools();
  renderBag();
  if (state.mode === 'make') renderMake();
  if (state.mode === 'keep') renderKeep();
  if (state.mode === 'how')  renderHow();
  save();
}

function renderModes() {
  document.querySelectorAll('.mode').forEach(function (b) {
    b.classList.toggle('on', b.dataset.mode === state.mode);
  });
  document.querySelectorAll('.mode-panel').forEach(function (p) {
    p.hidden = p.dataset.panel !== state.mode;
  });
}

function renderSkills() {
  var lv = skillLevels(), rec = currentBuild(), overridden = !!state.override;

  el.skillRows.innerHTML = ['Crafting', 'Smithing'].map(function (s) {
    var v = lv[s] || 0,
        from = rec ? buildRank(rec.state, s) : null,
        differs = rec && overridden && v !== from;
    return '<div class="stat">' +
      '<span class="stat-name">' + s +
        (differs ? '<i class="from-build" title="' + s + ' ' + from +
                   ' in this build">was ' + from + '</i>' : '') +
      '</span>' +
      '<span class="stat-ctrl">' +
        '<button class="step" data-skill="' + s + '" data-d="-1"' + (v <= 0 ? ' disabled' : '') + '>&minus;</button>' +
        '<span class="stat-val' + (differs ? ' boosted' : '') + '">' + v + '</span>' +
        '<button class="step" data-skill="' + s + '" data-d="1"' + (v >= 5 ? ' disabled' : '') + '>+</button>' +
      '</span></div>';
  }).join('');

  el.skillNote.innerHTML = rec
    ? (overridden
        ? 'Typed over <b>' + esc(state.build) + '</b>. ' +
          '<button class="linkish" data-resetskills>Use the build\u2019s ranks</button>'
        : 'From <b>' + esc(state.build) + '</b>, including gear.')
    : 'Recipes above your level are shown greyed, never hidden.';
}

function renderTools() {
  el.toolRows.innerHTML = STATIONS.map(function (n) {
    var on = !!state.tools[n];
    return '<label class="tool' + (on ? ' on' : '') + '">' +
      '<input type="checkbox" data-tool="' + esc(n) + '"' + (on ? ' checked' : '') + '> ' +
      esc(n) + '</label>';
  }).join('');
}

function renderBag() {
  var names = Object.keys(state.bag).sort();
  el.bagCount.textContent = names.length ? names.length + ' items' : '';
  el.bagEmpty.hidden = names.length > 0;
  el.bagList.innerHTML = names.map(function (n) {
    return '<span class="chip" data-drop="' + esc(n) + '">' + esc(n) +
           '<i>&times;</i></span>';
  }).join('');
}

/* -- mode: what can I make -- */

function renderMake() {
  if (!el.typeFilter.options.length) {
    el.typeFilter.innerHTML = '<option value="">All types</option>' +
      DATA.types.map(function (t) {
        return '<option value="' + esc(t) + '">' + esc(t) + '</option>';
      }).join('');
    el.typeFilter.value = state.typeFilter;
    el.hideOverLevel.checked = state.hideOverLevel;
  }

  var have = [], near = [], done = {};
  RECIPES.forEach(function (r) {
    if (state.typeFilter && r.type !== state.typeFilter) return;

    // One card per input combination: the best rung the skill currently reaches,
    // or the cheapest rung if none is reachable yet.
    var rung = ladderOf(r), key = r.a.join('|') + '\u241F' + r.b.join('|') + r.type;
    if (done[key]) return;
    done[key] = 1;
    var pick = null;
    rung.forEach(function (x) {
      if (x.type !== r.type) return;
      if (skillOK(x)) pick = x;                 // sorted by level, so last wins
    });
    var best = pick || rung[0];
    var ok = skillOK(best);
    if (state.hideOverLevel && !ok) return;

    var st = status(best);
    var entry = { r: best, st: st, ok: ok, rungs: rung.length > 1 ? rung : null };
    if (st.state === 'have') have.push(entry);
    else if (st.state === 'near') near.push(entry);
  });

  // Craftable first, and within that the ones your skill actually covers.
  have.sort(function (x, y) {
    return (y.ok - x.ok) || x.r.result.localeCompare(y.r.result);
  });
  near.sort(function (x, y) {
    return (y.ok - x.ok) || x.r.result.localeCompare(y.r.result);
  });

  el.makeCount.textContent = have.length ? have.length + ' recipes' : '';
  el.nearCount.textContent = near.length ? near.length + ' recipes' : '';

  el.makeList.innerHTML = have.length
    ? have.map(function (x) { return recipeCard(x.r, x.ok, null, x.rungs); }).join('')
    : '<p class="empty">Nothing yet. Add what you are carrying, and tick the tools ' +
      'you have at the bench &mdash; most recipes need an anvil, oven or mortar.</p>';

  el.nearList.innerHTML = near.length
    ? near.slice(0, 60).map(function (x) {
        return recipeCard(x.r, x.ok, x.st.need, x.rungs);
      }).join('')
    : '<p class="empty">&mdash;</p>';
}

/* need:  the unsatisfied slot, drawn as "pick one of these"
   rungs: the other outcomes these same inputs give at other skill levels */
function recipeCard(r, ok, need, rungs) {
  var lvl = r.skill
    ? '<span class="lvl' + (ok ? '' : ' short') + '">' + esc(r.skill) + ' ' + r.level + '</span>'
    : '<span class="lvl none">no skill</span>';
  var warn = r.unverified
    ? ' <span class="warn-flag" title="' + esc(r.note || 'Unverified') + '">&#9888;</span>'
    : '';
  return '<div class="recipe' + (ok ? '' : ' over') + '">' +
    '<div class="recipe-head">' +
      '<b>' + esc(r.result) + '</b>' + warn +
      '<span class="type-tag">' + esc(r.type) + '</span>' + lvl +
    '</div>' +
    '<div class="recipe-body">' + slotHtml(r.a) + '<i>+</i>' + slotHtml(r.b) + '</div>' +
    (need ? '<div class="need">need ' + need.map(function (n) {
        return '<em>' + esc(n) + '</em>';
      }).join(' or ') + '</div>' : '') +
    ladderHtml(r, rungs) +
    '</div>';
}

/* Same inputs, different outcome as the skill rises. Marks where you are. */
function ladderHtml(r, rungs) {
  if (!rungs) return '';
  var rows = rungs.filter(function (x) { return x.type === r.type; });
  if (rows.length < 2) return '';
  return '<div class="ladder">' + rows.map(function (x) {
    var here = x.id === r.id, reach = skillOK(x);
    return '<span class="rung' + (here ? ' here' : '') + (reach ? '' : ' locked') + '">' +
      '<b>' + x.level + '</b> ' + esc(x.result) + '</span>';
  }).join('') + '</div>';
}

function slotHtml(slot) {
  return '<span class="slot">' + slot.map(function (n) {
    var it = byName[n] || {};
    var cls = it.tool ? 'ing tool' : 'ing';
    if (it.tool ? state.tools[n] : state.bag[n]) cls += ' got';
    return '<span class="' + cls + '" data-add="' + esc(n) + '">' + esc(n) + '</span>';
  }).join('<u>or</u>') + '</span>';
}

/* -- mode: what should I keep -- */

function renderKeep() {
  var q = (el.keepSearch.value || '').toLowerCase().trim();
  var list = ITEMS.filter(function (it) {
    if (!usedBy[it.name]) return false;          // feeds nothing, not worth listing
    return !q || it.name.toLowerCase().indexOf(q) >= 0;
  });
  list.sort(function (a, b) { return b.uses - a.uses || a.name.localeCompare(b.name); });

  el.keepList.innerHTML = list.slice(0, 80).map(function (it) {
    var rs = usedBy[it.name];
    return '<div class="keep">' +
      '<div class="keep-head">' +
        '<b>' + esc(it.name) + '</b>' +
        (it.tool ? '<span class="type-tag tool-tag">STATION</span>' : '') +
        (it.craftable ? '<span class="type-tag">craftable</span>' : '') +
        '<span class="uses">' + rs.length + ' recipe' + (rs.length === 1 ? '' : 's') + '</span>' +
      '</div>' +
      '<div class="keep-body">' + rs.slice(0, 14).map(function (r) {
        return '<span class="feeds" data-how="' + esc(r.result) + '">' + esc(r.result) + '</span>';
      }).join('') +
      (rs.length > 14 ? '<span class="feeds more">+' + (rs.length - 14) + ' more</span>' : '') +
      '</div></div>';
  }).join('') || '<p class="empty">No item matches.</p>';
}

/* -- mode: how do I make X -- */

function renderHow() {
  var q = (el.howSearch.value || '').toLowerCase().trim();
  if (!q) {
    el.howResult.innerHTML = '<p class="empty">Search for something you want to make.</p>';
    return;
  }
  var hits = Object.keys(makes).filter(function (n) {
    return n.toLowerCase().indexOf(q) >= 0;
  }).sort();

  if (!hits.length) {
    el.howResult.innerHTML = '<p class="empty">Nothing craftable matches &ldquo;' +
      esc(q) + '&rdquo;.</p>';
    return;
  }
  el.howResult.innerHTML = hits.slice(0, 8).map(function (n) {
    return '<div class="tree-root"><h3>' + esc(n) + '</h3>' + tree(n, 0, {}, {}) + '</div>';
  }).join('');
}

/* Recursive ingredient tree.

   `seen` breaks cycles - some recipes are reversible (two potions make a bottle,
   a bottle makes a potion) and would recurse forever.

   `drawn` stops the same sub-tree being expanded twice in one answer. Large
   Healing Potion has four routes that all bottom out in Minor Healing Potion,
   and expanding it under each one buries the actual difference between them. */
function tree(name, depth, seen, drawn) {
  var rs = makes[name];
  if (!rs || depth > 4) return '';
  if (seen[name]) return '<div class="node cycle">&#8635; ' + esc(name) + ' (loops)</div>';
  seen = Object.assign({}, seen); seen[name] = 1;

  // Collapse tier ladders: one route per input combination, cheapest rung first.
  var byInputs = {}, routes = [];
  rs.forEach(function (r) {
    var k = r.a.join('|') + '\u241F' + r.b.join('|');
    if (byInputs[k]) { byInputs[k].alts.push(r); return; }
    byInputs[k] = { r: r, alts: [] };
    routes.push(byInputs[k]);
  });

  return routes.map(function (route) {
    var r = route.r;
    var lvl = r.skill ? esc(r.skill) + ' ' + r.level : 'no skill';
    var alt = route.alts.length
      ? '<span class="rung-note">+' + route.alts.length + ' higher tier' +
        (route.alts.length === 1 ? '' : 's') + '</span>'
      : '';

    var kids = ingredientsOf(r).map(function (ing) {
      var isTool = byName[ing] && byName[ing].tool;
      var have = isTool ? state.tools[ing] : state.bag[ing];
      var sub = '';
      if (!drawn[ing]) {
        drawn[ing] = 1;
        sub = tree(ing, depth + 1, seen, drawn);
      } else if (makes[ing]) {
        sub = '<div class="node repeat">shown above</div>';
      }
      // Exactly one source note: you have it, you can make it, or you must find it.
      var note = have ? '<span class="raw got-note">in your bag</span>'
               : isTool ? '<span class="raw">a station</span>'
               : makes[ing] ? ''
               : '<span class="raw">found in world</span>';
      return '<div class="node' + (have ? ' got' : '') + '">' +
        '<span class="node-name">' + esc(ing) + '</span>' +
        (isTool ? '<span class="type-tag tool-tag">STATION</span>' : '') + note +
        (sub ? '<div class="sub">' + sub + '</div>' : '') +
        '</div>';
    }).join('<div class="plus">+</div>');

    return '<div class="branch"><div class="branch-head">' +
      '<span class="lvl">' + lvl + '</span>' +
      '<span class="type-tag">' + esc(r.type) + '</span>' + alt + '</div>' + kids + '</div>';
  }).join('');
}

/* ---------- events (delegated from containers, as in app.js) ----------
   Wired up inside init(), which bails if the page has none of crafting.html's
   elements - the same convention app.js uses so both files can load on the
   test page without their DOM wiring throwing. */

function init() {
  if (!el.buildPick) return;

document.querySelector('.modebar').addEventListener('click', function (e) {
  var b = e.target.closest('.mode');
  if (!b) return;
  state.mode = b.dataset.mode;
  renderAll();
});

el.skillRows.addEventListener('click', function (e) {
  var b = e.target.closest('[data-skill]');
  if (!b || b.disabled) return;
  var s = b.dataset.skill, lv = skillLevels();
  var next = Math.max(0, Math.min(5, (lv[s] || 0) + (+b.dataset.d)));

  if (state.build) {
    // Typing over a build's ranks starts an override, seeded from what is
    // showing so the other skill does not jump.
    state.override = state.override || { Crafting: lv.Crafting, Smithing: lv.Smithing };
    state.override[s] = next;
  } else {
    state.skills[s] = next;
  }
  renderAll();
});

el.skillNote.addEventListener('click', function (e) {
  if (!e.target.closest('[data-resetskills]')) return;
  state.override = null;
  renderAll();
});

el.buildPick.addEventListener('change', function () {
  var name = el.buildPick.value;
  if (!name) {
    // Back to a loose bag. The build keeps whatever was last synced to it.
    state.build = null;
    state.override = null;
    state.bag = {};
    state.tools = {};
  } else {
    adoptBuild(name);
  }
  renderAll();
});

el.toolRows.addEventListener('change', function (e) {
  var c = e.target.closest('[data-tool]');
  if (!c) return;
  if (c.checked) state.tools[c.dataset.tool] = true;
  else delete state.tools[c.dataset.tool];
  renderAll();
});

el.bagList.addEventListener('click', function (e) {
  var c = e.target.closest('[data-drop]');
  if (!c) return;
  delete state.bag[c.dataset.drop];
  renderAll();
});

/* Clicking any ingredient anywhere adds it — the fastest way to fill the bag. */
document.addEventListener('click', function (e) {
  var a = e.target.closest('[data-add]');
  if (a) {
    var n = a.dataset.add;
    if (byName[n] && byName[n].tool) {
      if (state.tools[n]) delete state.tools[n]; else state.tools[n] = true;
    } else {
      if (state.bag[n]) delete state.bag[n]; else state.bag[n] = true;
    }
    renderAll();
    return;
  }
  var h = e.target.closest('[data-how]');
  if (h) {
    state.mode = 'how';
    el.howSearch.value = h.dataset.how;
    renderAll();
    el.howSearch.scrollIntoView({ block: 'nearest' });
  }
});

/* Bag autocomplete. */
el.bagSearch.addEventListener('input', function () {
  var q = el.bagSearch.value.toLowerCase().trim();
  if (!q) { el.bagSuggest.innerHTML = ''; return; }
  var hits = ITEMS.filter(function (it) {
    return !it.tool && !state.bag[it.name] &&
           it.name.toLowerCase().indexOf(q) >= 0;
  }).slice(0, 10);
  el.bagSuggest.innerHTML = hits.map(function (it) {
    return '<button type="button" data-pick="' + esc(it.name) + '">' + esc(it.name) +
      '<span>' + (usedBy[it.name] ? usedBy[it.name].length + ' uses' : 'end product') +
      '</span></button>';
  }).join('');
});

el.bagSuggest.addEventListener('click', function (e) {
  var b = e.target.closest('[data-pick]');
  if (!b) return;
  state.bag[b.dataset.pick] = true;
  el.bagSearch.value = '';
  el.bagSuggest.innerHTML = '';
  renderAll();
});

el.typeFilter.addEventListener('change', function () {
  state.typeFilter = el.typeFilter.value; renderAll();
});
el.hideOverLevel.addEventListener('change', function () {
  state.hideOverLevel = el.hideOverLevel.checked; renderAll();
});
el.keepSearch.addEventListener('input', renderKeep);
el.howSearch.addEventListener('input', renderHow);

el.clearBag.addEventListener('click', function () {
  if (state.build &&
      Object.keys(state.bag).length &&
      !confirm('Empty the bag saved against "' + state.build + '"?')) return;
  state.bag = {}; state.tools = {};
  renderAll();
});

/* ?build=Name opens straight onto that character's bag, which is how the
   planner's "Open crafting" link arrives. */
var qs = /[?&]build=([^&]*)/.exec(location.search);
if (qs) {
  var want = decodeURIComponent(qs[1].replace(/\+/g, ' '));
  if (loadBuilds()[want]) adoptBuild(want);
}

/* Deep link: crafting.html#Some Item opens the tree for it. */
if (location.hash.length > 1) {
  state.mode = 'how';
  el.howSearch.value = decodeURIComponent(location.hash.slice(1));
}

renderAll();
}

init();

// Test-only hatch, same shape and same caveat as app.js's DOS_TEST: nothing in
// craft.js reads it, so it changes no behaviour, but it's a live hook onto
// the running page, not a sealed test build.
window.DOS_CRAFT_TEST = {
  buildRank: buildRank, hasTalent: hasTalent
};
})();
