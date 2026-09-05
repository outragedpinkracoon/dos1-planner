(function () {
'use strict';

var R = window.DOS_RULES,
    ABILITIES = window.DOS_ABILITIES,
    TALENTS = window.DOS_TALENTS,
    PRESETS = window.DOS_PRESETS,
    SKILLS = window.DOS_SKILLS;

var STORE_KEY = 'dos1-planner:slice1';      // the build currently on screen
var BUILDS_KEY = 'dos1-planner:builds';     // named saves, keyed by name

// ---------------------------------------------------------------- state
var state = null;

function blankState() {
  var attrs = {};
  R.attributes.list.forEach(function (a) { attrs[a.id] = R.attributes.base; });
  return {
    preset: 'custom',
    level: 1,
    attrs: attrs,
    abilities: {},   // id -> rank
    talents: [],     // names
    skills: [],      // learned skill names
    granted: [],     // preset-given skills - the game grants these regardless of slots
    grantedTalents: [], // companion talents that bypass their prerequisites
    attrFloor: null, // per-attribute minimum; companions can start below the base 5
    buildName: null, // name of the saved build currently loaded, if any
    gearAttrs: {},   // attribute id -> bonus from equipment
    gearAbils: {},   // ability id -> rank bonus from equipment
    showGear: false,       // whether the gear steppers are visible
    onlyLearnableTalents: false,
    onlyLearnableSkills: false
  };
}

function load() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (!raw) return blankState();
    var s = JSON.parse(raw), base = blankState();
    // merge defensively so a data change never bricks a saved build
    base.preset = s.preset || 'custom';
    base.level = clamp(s.level || 1, 1, R.maxLevel);
    R.attributes.list.forEach(function (a) {
      if (typeof s.attrs?.[a.id] === 'number') base.attrs[a.id] = s.attrs[a.id];
    });
    base.abilities = s.abilities || {};
    base.talents = Array.isArray(s.talents) ? s.talents : [];
    base.skills = Array.isArray(s.skills) ? s.skills : [];
    base.granted = Array.isArray(s.granted) ? s.granted : [];
    base.grantedTalents = Array.isArray(s.grantedTalents) ? s.grantedTalents : [];
    base.attrFloor = s.attrFloor || null;
    base.buildName = s.buildName || null;
    base.gearAttrs = s.gearAttrs || {};
    base.gearAbils = s.gearAbils || {};
    base.showGear = !!s.showGear;
    base.onlyLearnableTalents = !!s.onlyLearnableTalents;
    base.onlyLearnableSkills = !!s.onlyLearnableSkills;
    return base;
  } catch (e) { return blankState(); }
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
}

// ---------------------------------------------------------------- saved builds
// Builds are keyed by name: saving under an existing name overwrites it,
// saving under a new one creates another entry.
function loadBuilds() {
  try {
    var raw = localStorage.getItem(BUILDS_KEY);
    var obj = raw ? JSON.parse(raw) : {};
    return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
  } catch (e) { return {}; }
}

function saveBuilds(b) {
  try { localStorage.setItem(BUILDS_KEY, JSON.stringify(b)); return true; }
  catch (e) { return false; }
}

function buildNames() {
  var b = loadBuilds();
  return Object.keys(b).sort(function (x, y) {
    return (b[y].savedAt || 0) - (b[x].savedAt || 0);
  });
}

function snapshot() {
  var copy = JSON.parse(JSON.stringify(state));
  delete copy.buildName;
  return copy;
}

function storeBuild(name) {
  name = (name || '').trim();
  if (!name) return { ok: false, why: 'Give the build a name first.' };

  var builds = loadBuilds(),
      existed = Object.prototype.hasOwnProperty.call(builds, name),
      prior = existed && builds[name].state,
      next = snapshot();

  // Bag/tools/skill-override live only on the crafting page's copy of this
  // build. Saving the planner side must not erase them.
  if (prior) {
    next.bag = prior.bag;
    next.benchTools = prior.benchTools;
    next.craftSkills = prior.craftSkills;
  }

  builds[name] = { savedAt: Date.now(), state: next };
  if (!saveBuilds(builds)) return { ok: false, why: 'Could not save - storage is full or blocked.' };

  state.buildName = name;
  save();
  return { ok: true, overwrote: existed };
}

function restoreBuild(name) {
  var rec = loadBuilds()[name];
  if (!rec || !rec.state) return false;
  state = Object.assign(blankState(), rec.state);
  // bag/benchTools/craftSkills live only on the build record, never on the
  // working state - crafting.html reads and writes them there directly.
  delete state.bag;
  delete state.benchTools;
  delete state.craftSkills;
  state.buildName = name;
  save();
  return true;
}

function deleteBuild(name) {
  var builds = loadBuilds();
  delete builds[name];
  saveBuilds(builds);
  if (state.buildName === name) { state.buildName = null; save(); }
}

function describeBuild(rec) {
  var s = rec.state || {},
      p = findPreset(s.preset),
      when = rec.savedAt ? new Date(rec.savedAt) : null;
  var bits = [(p ? p.name : 'Custom') + ' L' + (s.level || 1)];
  if (when) bits.push(when.toLocaleDateString());
  return bits.join(' · ');
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// Everything else interpolated here comes from the data files, but bag item
// names arrive via localStorage, which is hand-editable.
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

// ---------------------------------------------------------------- pools
// Attributes: 5 at creation + 1 per even level + Bigger and Better's flat +1.
function attrTotal() {
  var t = R.attributes.creationPoints + Math.floor(state.level / 2);
  if (hasTalent('Bigger and Better')) t += 1;
  return t;
}
function attrSpent() {
  return R.attributes.list.reduce(function (sum, a) {
    return sum + (state.attrs[a.id] - attrFloor(a.id));
  }, 0);
}

// Abilities: 5 at creation + per-level table, cumulative, + All Skilled Up's flat +2.
function abilTotal() {
  var t = R.abilityPoints.creationPoints;
  for (var l = 2; l <= state.level; l++) t += R.abilityPoints.perLevel(l);
  if (hasTalent('All Skilled Up')) t += 2;
  return t;
}
// Rank n costs n, so rank R costs R*(R+1)/2 cumulative.
function rankCost(rank) { return rank * (rank + 1) / 2; }
function abilSpent() {
  return Object.keys(state.abilities).reduce(function (sum, id) {
    return sum + rankCost(state.abilities[id] || 0);
  }, 0);
}

// Talents: 2 at creation + one at each listed level reached.
function talTotal() {
  var t = R.talents.creationPoints;
  R.talents.gainedAtLevels.forEach(function (l) { if (state.level >= l) t++; });
  return t;
}
function talSpent() { return state.talents.length; }

function rank(id) { return state.abilities[id] || 0; }

// Gear bonuses stack on top of spent points. They never cost pool points, and
// they are what every requirement, cap and slot check reads.
function gearAttr(id) { return state.gearAttrs[id] || 0; }
function gearAbil(id) { return state.gearAbils[id] || 0; }

function effAttr(id) { return state.attrs[id] + gearAttr(id); }

function hasTalent(name) {
  return state.talents.indexOf(name) >= 0 ||
    (state.grantedTalents && state.grantedTalents.indexOf(name) >= 0);
}

var SCIENTIST_ABILS = ['blacksmithing', 'crafting'];

// Scientist's +1 Blacksmithing/+1 Crafting is a flat, uncosted floor, same
// spirit as gear: it never touches abilSpent, only what effRank reports.
function talentAbilFloor(id) {
  return (hasTalent('Scientist') && SCIENTIST_ABILS.indexOf(id) >= 0) ? 1 : 0;
}

function effRank(id) {
  return Math.max(rank(id) + gearAbil(id), talentAbilFloor(id));
}

function attrFloor(id) {
  return (state.attrFloor && typeof state.attrFloor[id] === 'number')
    ? state.attrFloor[id] : R.attributes.base;
}

// ---------------------------------------------------------------- talents
function talentMet(t) {
  var q = t.req;
  if (!q) return { ok: true };
  if (q.level !== undefined)
    return state.level >= q.level
      ? { ok: true } : { ok: false, why: 'Requires level ' + q.level };
  if (q.ability !== undefined) {
    var ab = ABILITIES.find(function (a) { return a.id === q.ability; });
    return effRank(q.ability) >= q.rank
      ? { ok: true } : { ok: false, why: 'Requires ' + (ab ? ab.name : q.ability) + ' ' + q.rank };
  }
  if (q.attr !== undefined) {
    var at = R.attributes.list.find(function (a) { return a.id === q.attr; });
    return effAttr(q.attr) >= q.value
      ? { ok: true } : { ok: false, why: 'Requires ' + (at ? at.name : q.attr) + ' ' + q.value };
  }
  return { ok: true };
}

// Dropping an ability rank or a level can invalidate an already-picked talent.
// Drop those rather than leave an illegal build on screen.
function isGrantedTalent(n) { return state.grantedTalents.indexOf(n) >= 0; }

function pruneTalents() {
  var kept = state.talents.filter(function (name) {
    if (isGrantedTalent(name)) return true;
    var t = TALENTS.find(function (x) { return x.name === name; });
    return t ? talentMet(t).ok : false;
  });
  if (kept.length !== state.talents.length) state.talents = kept;
}

// ---------------------------------------------------------------- skills
var TIERS = ['novice', 'adept', 'master'];

function schoolAbilities() {
  return ABILITIES.filter(function (a) { return a.school; });
}

// Slots granted at the current rank, per tier.
function slotsFor(id) {
  return R.skillSlots[clamp(effRank(id), 0, R.skillSlots.length - 1)];
}

function isGranted(n) { return state.granted.indexOf(n) >= 0; }

// Granted skills sit outside the slot economy, so they are not counted here.
function knownIn(schoolId, tier) {
  return state.skills.filter(function (n) {
    if (isGranted(n)) return false;
    var s = skillByName(n);
    return s && s.s === schoolId && s.t === tier;
  }).length;
}

var _skillIndex = null;
function skillByName(n) {
  if (!_skillIndex) {
    _skillIndex = {};
    SKILLS.forEach(function (s) { _skillIndex[s.n] = s; });
  }
  return _skillIndex[n];
}

function isKnown(n) { return state.skills.indexOf(n) >= 0; }

// Why can't I learn this? null when it is learnable.
function skillLock(s) {
  if (effRank(s.s) < 1) {
    var ab = ABILITIES.find(function (a) { return a.id === s.s; });
    return 'Requires ' + (ab ? ab.name : s.s) + ' 1';
  }
  var slots = slotsFor(s.s)[s.t];
  if (slots <= 0) {
    var need = R.skillSlots.findIndex(function (row) { return row[s.t] > 0; });
    var ab2 = ABILITIES.find(function (a) { return a.id === s.s; });
    return 'Needs ' + (ab2 ? ab2.name : s.s) + ' ' + need + ' for ' + s.t + ' skills';
  }
  if (knownIn(s.s, s.t) >= slots) {
    return 'No ' + s.t + ' slots left (' + slots + '/' + slots + ')';
  }
  return null;
}

// Skills can be used below their recommended rank at +2 AP per rank short.
function apPenalty(s) {
  var short = Math.max(0, (s.rank || 1) - effRank(s.s));
  return short * 2;
}

// Attribute requirement is a soft scaling rule, not a hard gate: below the
// listed value the skill is less effective, it is not forbidden.
function attrShortfall(s) {
  if (!s.attr) return null;
  var out = [];
  Object.keys(s.attr).forEach(function (k) {
    var have = effAttr(k), need = s.attr[k];
    if (have < need) {
      var at = R.attributes.list.find(function (a) { return a.id === k; });
      out.push((at ? at.name : k) + ' ' + have + '/' + need);
    }
  });
  return out.length ? out : null;
}

// Dropping a rank can leave you over your slot allowance. Trim the overflow
// rather than show an illegal loadout.
function pruneSkills() {
  var kept = [];
  var used = {};
  state.skills.forEach(function (n) {
    var s = skillByName(n);
    if (!s) return;
    if (isGranted(n)) { kept.push(n); return; }
    var key = s.s + ':' + s.t;
    used[key] = used[key] || 0;
    if (used[key] < slotsFor(s.s)[s.t]) { used[key]++; kept.push(n); }
  });
  if (kept.length !== state.skills.length) state.skills = kept;
}

// ---------------------------------------------------------------- render
var el = {};

function renderPools() {
  [['poolAttr', attrSpent(), attrTotal()],
   ['poolAbil', abilSpent(), abilTotal()],
   ['poolTal',  talSpent(),  talTotal()]
  ].forEach(function (row) {
    var node = el[row[0]], spent = row[1], total = row[2];
    node.querySelector('.pool-val').innerHTML = '<b>' + spent + '</b> / ' + total;
    node.querySelector('.bar i').style.width =
      (total ? clamp(spent / total * 100, 0, 100) : 0) + '%';
    node.classList.toggle('full', spent === total && total > 0);
    node.classList.toggle('over', spent > total);
  });
}

// The effective value is what every requirement check reads, so it is the number
// shown large; the points-only base drops to a subscript, and only when gear
// actually differs from it.
function valStack(eff, base, g, boosted) {
  return '<span class="stat-val' + (boosted ? ' boosted' : '') + (g ? ' geared' : '') + '">' +
    eff + (g ? '<i class="base-sub">' + base + '</i>' : '') +
  '</span>';
}

// One chip instead of a second stepper pair: click adds, the minus only exists
// once there is something to take away. The column is always present so
// toggling gear never reflows the row.
function gearChip(id, g, incAttr, decAttr, atCap) {
  if (!state.showGear) return '<div class="gear-ctrl"></div>';
  return '<div class="gear-ctrl">' +
    (g ? '<button class="step gear" data-' + decAttr + '="' + id + '">&minus;</button>'
       : '<span class="gear-spacer"></span>') +
    '<button class="chip' + (g ? ' on' : '') + '" data-' + incAttr + '="' + id + '"' +
      (atCap ? ' disabled' : '') +
      ' title="Bonus from equipment - never costs points">' +
      (g ? '+' + g : '+') +
    '</button>' +
  '</div>';
}

function renderAttrs() {
  var left = attrTotal() - attrSpent();
  el.attrList.innerHTML = '';
  R.attributes.list.forEach(function (a) {
    var v = state.attrs[a.id], base = attrFloor(a.id),
        g = gearAttr(a.id), eff = v + g;
    var row = document.createElement('div');
    row.className = 'stat';
    row.innerHTML =
      '<div class="stat-name">' + a.name + '</div>' +
      '<div class="stat-ctrl">' +
        '<button class="step" data-dec="' + a.id + '"' + (v <= base ? ' disabled' : '') + '>&minus;</button>' +
        valStack(eff, v, g, v > base) +
        '<button class="step" data-inc="' + a.id + '"' +
          (v >= R.attributes.softCap || left <= 0 ? ' disabled' : '') + '>+</button>' +
      '</div>' +
      gearChip(a.id, g, 'gearinc', 'geardec') +
      '<div class="stat-desc">' + a.desc + '</div>';
    el.attrList.appendChild(row);
  });
}

function renderAbilities() {
  var left = abilTotal() - abilSpent();
  var cats = [];
  ABILITIES.forEach(function (a) { if (cats.indexOf(a.cat) < 0) cats.push(a.cat); });

  el.abilList.innerHTML = '';
  cats.forEach(function (cat) {
    var wrap = document.createElement('div');
    wrap.className = 'abil-cat';
    wrap.innerHTML = '<h3>' + cat + '</h3>';

    ABILITIES.filter(function (a) { return a.cat === cat; }).forEach(function (a) {
      var r = rank(a.id),
          up = r + 1,                                  // cost to go one rank higher
          canUp = r < R.abilityPoints.maxRank && left >= up;

      var g = gearAbil(a.id), eff = effRank(a.id);

      var pips = '';
      for (var i = 1; i <= R.abilityPoints.maxRank; i++) {
        var cls = i <= r ? ' on' : (i <= eff ? ' gear' : '');
        pips += '<span class="pip' + cls + '"></span>';
      }

      var row = document.createElement('div');
      row.className = 'abil';
      row.innerHTML =
        '<div class="abil-name">' + a.name +
          (a.school ? '<span class="school-tag">school</span>' : '') +
          (a.unverified ? '<span class="unverified" title="Not fully documented on the wiki - treat as unconfirmed">&#9888;</span>' : '') +
        '</div>' +
        '<div class="stat-ctrl">' +
          '<button class="step" data-abildec="' + a.id + '"' + (r <= 0 ? ' disabled' : '') + '>&minus;</button>' +
          '<span class="pips">' + pips + '</span>' +
          '<button class="step" data-abilinc="' + a.id + '"' + (canUp ? '' : ' disabled') + '>+</button>' +
          (r < R.abilityPoints.maxRank ? '<span class="cost-note">' + up + 'p</span>' : '') +
        '</div>' +
        gearChip(a.id, g, 'gearabilinc', 'gearabildec',
                 eff >= R.abilityPoints.maxRank) +
        '<div class="abil-desc">' + a.desc + '</div>';
      wrap.appendChild(row);
    });
    el.abilList.appendChild(wrap);
  });
}

function renderTalents() {
  var left = talTotal() - talSpent(),
      onlyAvail = state.onlyLearnableTalents;

  el.talentList.innerHTML = '';
  TALENTS.forEach(function (t) {
    var picked = state.talents.indexOf(t.name) >= 0,
        grantedT = isGrantedTalent(t.name),
        met = talentMet(t),
        // locked = can't click it right now (and isn't already picked)
        locked = !picked && (!met.ok || left <= 0);

    if (onlyAvail && locked) return;

    var node = document.createElement('div');
    node.className = 'talent' + (picked ? ' picked' : '') + (grantedT ? ' granted' : '') +
                     (locked ? ' locked' : '');
    node.dataset.talent = t.name;
    node.innerHTML =
      '<div class="talent-name">' + t.name +
        (grantedT ? '<span class="granted-tag">given</span>' : '') +
        (t.unverified ? '<span class="unverified" title="Not listed on the fextralife talents table - treat as unconfirmed">&#9888;</span>' : '') +
      '</div>' +
      '<div class="talent-desc">' + t.desc + '</div>' +
      (!met.ok && !grantedT ? '<div class="talent-req">' + met.why + '</div>' : '');
    el.talentList.appendChild(node);
  });
}

function renderSkills() {
  var q = (el.skillSearch.value || '').trim().toLowerCase(),
      onlyLearnable = state.onlyLearnableSkills;

  el.skillList.innerHTML = '';
  var shown = 0;

  schoolAbilities().forEach(function (ab) {
    var r = rank(ab.id), slots = slotsFor(ab.id);

    var pool = SKILLS.filter(function (s) { return s.s === ab.id; });
    var visible = pool.filter(function (s) {
      if (q && (s.n + ' ' + s.d).toLowerCase().indexOf(q) < 0) return false;
      if (onlyLearnable && !isKnown(s.n) && skillLock(s)) return false;
      return true;
    });
    if (!visible.length) return;
    shown += visible.length;

    var box = document.createElement('div');
    box.className = 'school' + (r === 0 ? ' rank0' : '');
    // open by default when you have the school, or when a search is narrowing things
    if (r > 0 || q) box.classList.add('open');
    box.dataset.school = ab.id;

    var head = '<div class="school-head">' +
      '<span class="school-caret">&#9654;</span>' +
      '<span class="school-title">' + ab.name + '</span>' +
      '<span class="school-rank">' + (r ? 'RANK ' + r : 'NOT TAKEN') + '</span>' +
    '</div>';

    var slotRow = '<div class="slots">' + TIERS.map(function (t) {
      var cap = slots[t], have = knownIn(ab.id, t);
      return '<span class="slot' + (cap === 0 ? ' none' : '') +
             (cap > 0 && have >= cap ? ' full' : '') + '">' +
        '<span class="slot-tier">' + t + '</span>' +
        '<span class="slot-num">' + (cap === 0 ? '&mdash;' : have + '/' + cap) + '</span>' +
      '</span>';
    }).join('') + '</div>';

    var body = '<div class="school-body">';
    TIERS.forEach(function (t) {
      var inTier = visible.filter(function (s) { return s.t === t; });
      if (!inTier.length) return;
      body += '<div class="tier-label">' + t + '</div>';
      inTier.forEach(function (s) {
        var known = isKnown(s.n),
            granted = isGranted(s.n),
            lock = known ? null : skillLock(s),
            pen = apPenalty(s),
            short = attrShortfall(s);

        var cost = (s.ap + pen) + ' AP';
        if (pen) cost += ' <span class="skill-ap-pen">(+' + pen + ')</span>';
        cost += ' &middot; ' + (s.cd === 0 ? '1/combat' : 'CD ' + s.cd);

        body += '<div class="skill' + (known ? ' known' : '') + (granted ? ' granted' : '') + (lock ? ' locked' : '') + '"' +
                ' data-skill="' + s.n.replace(/"/g, '&quot;') + '">' +
          '<div class="skill-top">' +
            '<span class="skill-name">' + s.n +
              (granted ? '<span class="granted-tag">class</span>' : '') +
              (s.unverified ? '<span class="unverified" title="Not listed on the fextralife tier pages - treat as unconfirmed">&#9888;</span>' : '') +
            '</span>' +
            '<span class="skill-cost">' + cost + '</span>' +
          '</div>' +
          '<div class="skill-desc">' + s.d + '</div>' +
          (short ? '<div class="skill-lock">Under-attributed: ' + short.join(', ') + ' &mdash; reduced effect</div>' : '') +
          (lock ? '<div class="skill-lock">' + lock + '</div>' : '') +
          '<div class="skill-src">' + s.src + '</div>' +
        '</div>';
      });
    });
    body += '</div>';

    box.innerHTML = head + slotRow + body;
    el.skillList.appendChild(box);
  });

  if (!shown) el.skillList.innerHTML = '<div class="empty">No skills match.</div>';
  el.skillCount.textContent = state.skills.length + ' known';
}

function renderBuilds() {
  var names = buildNames(),
      builds = loadBuilds();

  el.buildList.innerHTML = '';
  if (!names.length) {
    el.buildList.innerHTML = '<div class="empty-builds">No saved builds yet.</div>';
  } else {
    names.forEach(function (n) {
      var node = document.createElement('div');
      node.className = 'build' + (state.buildName === n ? ' active' : '');
      node.dataset.build = n;
      node.innerHTML =
        '<div class="build-info">' +
          '<div class="build-name"></div>' +
          '<div class="build-meta">' + describeBuild(builds[n]) + '</div>' +
        '</div>' +
        '<button class="build-del" data-del="1" title="Delete this build">&times;</button>';
      // set as text so a build named with markup cannot inject any
      node.querySelector('.build-name').textContent = n;
      el.buildList.appendChild(node);
    });
  }

  // Keep the name box in step with what is loaded, unless it is being typed in.
  if (document.activeElement !== el.buildName)
    el.buildName.value = state.buildName || '';

  var typed = el.buildName.value.trim();
  el.saveBtn.textContent =
    typed && Object.prototype.hasOwnProperty.call(builds, typed) ? 'Overwrite' : 'Save';
}

// The bag itself is edited on the crafting page - that is where the 600-item
// vocabulary lives, and it is stored on the saved build record, not on the
// working state, so this page can only show it once the build has been saved.
function renderBagPeek() {
  var rec = state.buildName ? loadBuilds()[state.buildName] : null,
      bag = (rec && rec.state && rec.state.bag) || {},
      benchTools = (rec && rec.state && rec.state.benchTools) || {},
      names = Object.keys(bag).sort(),
      tools = Object.keys(benchTools).length;

  el.bagSub.textContent = names.length ? names.length + ' items' : '';

  if (!state.buildName) {
    el.bagHint.textContent = 'Save this build to give it a bag on the crafting page.';
    el.bagPeek.innerHTML = '';
  } else if (!names.length && !tools) {
    el.bagHint.textContent = 'Nothing carried yet. The crafting page saves what ' +
      'you pick up against this build.';
    el.bagPeek.innerHTML = '';
  } else {
    el.bagHint.textContent = tools
      ? tools + (tools === 1 ? ' station' : ' stations') + ' at the bench.'
      : '';
    el.bagPeek.innerHTML = names.slice(0, 12).map(function (n) {
      return '<span class="peek">' + escapeHtml(n) + '</span>';
    }).join('') +
      (names.length > 12
        ? '<span class="peek more">+' + (names.length - 12) + ' more</span>'
        : '');
  }

  // Carry the loaded build through, so crafting.html opens on the same character.
  el.bagOpen.href = state.buildName
    ? 'crafting.html?build=' + encodeURIComponent(state.buildName)
    : 'crafting.html';
}

function renderAll() {
  pruneTalents();
  pruneSkills();
  renderPools();
  renderAttrs();
  renderAbilities();
  renderTalents();
  renderSkills();
  renderBuilds();
  el.levelOut.textContent = state.level;
  el.levelSlider.value = state.level;
  el.presetSelect.value = state.preset;
  el.gearToggle.checked = state.showGear;
  el.talentFilter.checked = state.onlyLearnableTalents;
  el.skillFilter.checked = state.onlyLearnableSkills;
  // stays mounted and merely disables, so the bar never reflows
  el.gearClear.disabled =
    !(Object.keys(state.gearAttrs).length || Object.keys(state.gearAbils).length);
  var p = findPreset(state.preset);
  el.presetBlurb.textContent = p ? p.blurb : '';
  renderBagPeek();
  save();
}

// ---------------------------------------------------------------- actions
function findPreset(id) {
  return PRESETS.classes.find(function (c) { return c.id === id; }) ||
         PRESETS.companions.find(function (c) { return c.id === id; });
}

function applyPreset(id) {
  var p = findPreset(id);
  if (!p) return;
  var fresh = blankState();
  fresh.preset = id;
  fresh.buildName = null;                          // a preset is a fresh, unsaved build

  // Companions arrive at a fixed level with their points already committed, and
  // their attributes are absolute rather than bonuses on top of the base 5.
  if (p.attrsTotal) {
    fresh.level = p.joinLevel;
    fresh.attrFloor = {};
    Object.keys(p.attrsTotal).forEach(function (k) {
      fresh.attrs[k] = p.attrsTotal[k];
      // Wolgraff starts at Strength 4, under the base 5, so his floor is his own value.
      fresh.attrFloor[k] = Math.min(p.attrsTotal[k], R.attributes.base);
    });
  } else {
    fresh.level = state.level;                     // keep where you were
    Object.keys(p.attrs || {}).forEach(function (k) {
      fresh.attrs[k] = R.attributes.base + p.attrs[k];
    });
  }
  fresh.abilities = Object.assign({}, p.abilities || {});
  fresh.talents = (p.talents || []).slice();
  // Companion talents ignore the normal prerequisites - Madora has Comeback Kid
  // without the Willpower 5 it would otherwise need. Mark them so pruning spares them.
  fresh.grantedTalents = p.attrsTotal ? (p.talents || []).slice() : [];
  fresh.skills = (p.skills || []).slice();
  // A class hands you its starting skills even when your rank grants no slot for
  // them - Fighter opens with Whirlwind at Man-at-Arms 1, which has no adept slot.
  fresh.granted = (p.skills || []).slice();
  state = fresh;
  renderAll();
}

function bind() {
  // level
  el.levelSlider.addEventListener('input', function () {
    state.level = +this.value;
    el.levelOut.textContent = state.level;
    renderAll();
  });

  // preset
  el.presetSelect.addEventListener('change', function () {
    var p = findPreset(this.value);
    el.presetBlurb.textContent = p ? p.blurb : '';
  });
  el.applyPreset.addEventListener('click', function () {
    applyPreset(el.presetSelect.value);
  });

  // attributes
  el.attrList.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var inc = b.dataset.inc, dec = b.dataset.dec,
        ginc = b.dataset.gearinc, gdec = b.dataset.geardec;
    if (inc && attrTotal() - attrSpent() > 0 && state.attrs[inc] < R.attributes.softCap)
      state.attrs[inc]++;
    if (dec && state.attrs[dec] > attrFloor(dec))
      state.attrs[dec]--;
    // Gear is uncapped: it is the one way past the attribute cap of 15.
    if (ginc) state.gearAttrs[ginc] = gearAttr(ginc) + 1;
    if (gdec && gearAttr(gdec) > 0) {
      state.gearAttrs[gdec]--;
      if (!state.gearAttrs[gdec]) delete state.gearAttrs[gdec];
    }
    renderAll();
  });

  // abilities
  el.abilList.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var inc = b.dataset.abilinc, dec = b.dataset.abildec,
        ginc = b.dataset.gearabilinc, gdec = b.dataset.gearabildec;
    // Gear ranks stop at 5, the same ceiling the ability itself has.
    if (ginc && effRank(ginc) < R.abilityPoints.maxRank)
      state.gearAbils[ginc] = gearAbil(ginc) + 1;
    if (gdec && gearAbil(gdec) > 0) {
      state.gearAbils[gdec]--;
      if (!state.gearAbils[gdec]) delete state.gearAbils[gdec];
    }
    if (inc) {
      var next = rank(inc) + 1;
      if (next <= R.abilityPoints.maxRank && abilTotal() - abilSpent() >= next)
        state.abilities[inc] = next;
    }
    if (dec && rank(dec) > 0) {
      state.abilities[dec]--;
      if (!state.abilities[dec]) delete state.abilities[dec];
    }
    renderAll();
  });

  // talents
  el.talentList.addEventListener('click', function (e) {
    var node = e.target.closest('.talent'); if (!node) return;
    var name = node.dataset.talent;
    if (isGrantedTalent(name)) return;              // companion-given, not yours to drop
    var i = state.talents.indexOf(name);
    if (i >= 0) { state.talents.splice(i, 1); renderAll(); return; }
    if (node.classList.contains('locked')) return;
    state.talents.push(name);
    renderAll();
  });
  el.talentFilter.addEventListener('change', function () {
    state.onlyLearnableTalents = el.talentFilter.checked;
    renderAll();
  });

  // skills
  el.skillList.addEventListener('click', function (e) {
    var head = e.target.closest('.school-head');
    if (head) { head.parentNode.classList.toggle('open'); return; }

    var node = e.target.closest('.skill'); if (!node) return;
    if (node.classList.contains('granted')) return;   // class-given, not yours to drop
    var name = node.dataset.skill,
        i = state.skills.indexOf(name);
    if (i >= 0) { state.skills.splice(i, 1); renderAll(); return; }
    if (node.classList.contains('locked')) return;
    state.skills.push(name);
    renderAll();
  });
  el.skillSearch.addEventListener('input', renderSkills);
  el.skillFilter.addEventListener('change', function () {
    state.onlyLearnableSkills = el.skillFilter.checked;
    renderAll();
  });

// gear bonuses
  el.gearToggle.addEventListener('change', function () {
    state.showGear = el.gearToggle.checked;
    renderAll();
  });
  el.gearClear.addEventListener('click', function (e) {
    // it lives inside the toggle's <label>, so stop the click reaching the checkbox
    e.preventDefault();
    e.stopPropagation();
    state.gearAttrs = {};
    state.gearAbils = {};
    renderAll();
  });

// saved builds
  function doSave() {
    var res = storeBuild(el.buildName.value);
    el.saveHint.textContent = res.ok
      ? (res.overwrote ? 'Overwrote "' + state.buildName + '".' : 'Saved as "' + state.buildName + '".')
      : res.why;
    renderAll();
  }
  el.saveBtn.addEventListener('click', doSave);
  el.buildName.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doSave(); }
  });
  // swap the button label between Save and Overwrite as you type
  el.buildName.addEventListener('input', renderBuilds);

  el.buildList.addEventListener('click', function (e) {
    var node = e.target.closest('.build'); if (!node) return;
    var name = node.dataset.build;

    if (e.target.closest('[data-del]')) {
      if (!confirm('Delete "' + name + '"?')) return;
      deleteBuild(name);
      el.saveHint.textContent = 'Deleted "' + name + '".';
      renderAll();
      return;
    }

    if (state.buildName === name) return;           // already loaded
    if (restoreBuild(name)) {
      el.saveHint.textContent = 'Loaded "' + name + '".';
      renderAll();
    }
  });

  // export / import
  el.exportBtn.addEventListener('click', function () {
    var payload = { app: 'dos1-planner', version: 1, exportedAt: Date.now(), builds: loadBuilds() };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dos1-builds.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  el.importBtn.addEventListener('click', function () { el.importFile.click(); });
  el.importFile.addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var incoming = data && data.builds;
        if (!incoming || typeof incoming !== 'object') throw new Error('no builds');

        var builds = loadBuilds(), added = 0, replaced = 0;
        Object.keys(incoming).forEach(function (n) {
          if (!incoming[n] || !incoming[n].state) return;
          if (Object.prototype.hasOwnProperty.call(builds, n)) replaced++; else added++;
          builds[n] = incoming[n];
        });
        saveBuilds(builds);
        el.saveHint.textContent = 'Imported ' + added + ' new, ' + replaced + ' replaced.';
      } catch (err) {
        el.saveHint.textContent = 'That file is not a build export.';
      }
      renderAll();
    };
    reader.readAsText(f);
    this.value = '';                                 // let the same file re-import
  });

  // reset
  el.resetBtn.addEventListener('click', function () {
    if (!confirm('Clear the working build and start over? Saved builds are kept.')) return;
    state = blankState();
    el.saveHint.textContent = '';
    renderAll();
  });
}

// ---------------------------------------------------------------- init
function init() {
  ['presetSelect','presetBlurb','applyPreset','levelSlider','levelOut',
   'poolAttr','poolAbil','poolTal','attrList','abilList','talentList',
   'talentFilter','rulesNotes','resetBtn',
   'skillList','skillSearch','skillFilter','skillCount',
   'buildName','saveBtn','saveHint','buildList','exportBtn','importBtn','importFile',
   'gearToggle','gearClear',
   'bagSub','bagHint','bagPeek','bagOpen'
  ].forEach(function (id) { el[id] = document.getElementById(id); });

  el.levelSlider.max = R.planLevel;

  var gClasses = document.createElement('optgroup');
  gClasses.label = 'Classes';
  PRESETS.classes.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c.id; o.textContent = c.name;
    gClasses.appendChild(o);
  });
  el.presetSelect.appendChild(gClasses);

  var gComp = document.createElement('optgroup');
  gComp.label = 'Companions (join at level 3)';
  PRESETS.companions.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c.id; o.textContent = c.name;
    gComp.appendChild(o);
  });
  el.presetSelect.appendChild(gComp);

  R.notes.forEach(function (n) {
    var li = document.createElement('li');
    li.textContent = n;
    el.rulesNotes.appendChild(li);
  });

  state = load();
  bind();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
})();
