(function () {
'use strict';

var R = window.DOS_RULES,
    ABILITIES = window.DOS_ABILITIES,
    TALENTS = window.DOS_TALENTS,
    PRESETS = window.DOS_PRESETS;

var STORE_KEY = 'dos1-planner:slice1';

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
    skills: []       // reserved for slice 2
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
    return base;
  } catch (e) { return blankState(); }
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// ---------------------------------------------------------------- pools
// Attributes: 5 at creation + 1 per even level.
function attrTotal() {
  return R.attributes.creationPoints + Math.floor(state.level / 2);
}
function attrSpent() {
  return R.attributes.list.reduce(function (sum, a) {
    return sum + (state.attrs[a.id] - R.attributes.base);
  }, 0);
}

// Abilities: 5 at creation + per-level table, cumulative.
function abilTotal() {
  var t = R.abilityPoints.creationPoints;
  for (var l = 2; l <= state.level; l++) t += R.abilityPoints.perLevel(l);
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

// ---------------------------------------------------------------- talents
function talentMet(t) {
  var q = t.req;
  if (!q) return { ok: true };
  if (q.level !== undefined)
    return state.level >= q.level
      ? { ok: true } : { ok: false, why: 'Requires level ' + q.level };
  if (q.ability !== undefined) {
    var ab = ABILITIES.find(function (a) { return a.id === q.ability; });
    return rank(q.ability) >= q.rank
      ? { ok: true } : { ok: false, why: 'Requires ' + (ab ? ab.name : q.ability) + ' ' + q.rank };
  }
  if (q.attr !== undefined) {
    var at = R.attributes.list.find(function (a) { return a.id === q.attr; });
    return state.attrs[q.attr] >= q.value
      ? { ok: true } : { ok: false, why: 'Requires ' + (at ? at.name : q.attr) + ' ' + q.value };
  }
  return { ok: true };
}

// Dropping an ability rank or a level can invalidate an already-picked talent.
// Drop those rather than leave an illegal build on screen.
function pruneTalents() {
  var kept = state.talents.filter(function (name) {
    var t = TALENTS.find(function (x) { return x.name === name; });
    return t ? talentMet(t).ok : false;
  });
  if (kept.length !== state.talents.length) state.talents = kept;
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

function renderAttrs() {
  var left = attrTotal() - attrSpent();
  el.attrList.innerHTML = '';
  R.attributes.list.forEach(function (a) {
    var v = state.attrs[a.id], base = R.attributes.base;
    var row = document.createElement('div');
    row.className = 'stat';
    row.innerHTML =
      '<div class="stat-name">' + a.name + '</div>' +
      '<div class="stat-ctrl">' +
        '<button class="step" data-dec="' + a.id + '"' + (v <= base ? ' disabled' : '') + '>&minus;</button>' +
        '<span class="stat-val' + (v > base ? ' boosted' : '') + '">' + v + '</span>' +
        '<button class="step" data-inc="' + a.id + '"' +
          (v >= R.attributes.softCap || left <= 0 ? ' disabled' : '') + '>+</button>' +
      '</div>' +
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

      var pips = '';
      for (var i = 1; i <= R.abilityPoints.maxRank; i++)
        pips += '<span class="pip' + (i <= r ? ' on' : '') + '"></span>';

      var row = document.createElement('div');
      row.className = 'abil';
      row.innerHTML =
        '<div class="abil-name">' + a.name +
          (a.school ? '<span class="school-tag">school</span>' : '') + '</div>' +
        '<div class="stat-ctrl">' +
          '<button class="step" data-abildec="' + a.id + '"' + (r <= 0 ? ' disabled' : '') + '>&minus;</button>' +
          '<span class="pips">' + pips + '</span>' +
          '<button class="step" data-abilinc="' + a.id + '"' + (canUp ? '' : ' disabled') + '>+</button>' +
          (r < R.abilityPoints.maxRank ? '<span class="cost-note">' + up + 'p</span>' : '') +
        '</div>' +
        '<div class="abil-desc">' + a.desc + '</div>';
      wrap.appendChild(row);
    });
    el.abilList.appendChild(wrap);
  });
}

function renderTalents() {
  var left = talTotal() - talSpent(),
      onlyAvail = el.talentFilter.checked;

  el.talentList.innerHTML = '';
  TALENTS.forEach(function (t) {
    var picked = state.talents.indexOf(t.name) >= 0,
        met = talentMet(t),
        // locked = can't click it right now (and isn't already picked)
        locked = !picked && (!met.ok || left <= 0);

    if (onlyAvail && locked) return;

    var node = document.createElement('div');
    node.className = 'talent' + (picked ? ' picked' : '') + (locked ? ' locked' : '');
    node.dataset.talent = t.name;
    node.innerHTML =
      '<div class="talent-name">' + t.name +
        (t.unverified ? '<span class="unverified" title="Not listed on the fextralife talents table - treat as unconfirmed">&#9888;</span>' : '') +
      '</div>' +
      '<div class="talent-desc">' + t.desc + '</div>' +
      (!met.ok ? '<div class="talent-req">' + met.why + '</div>' : '');
    el.talentList.appendChild(node);
  });
}

function renderAll() {
  pruneTalents();
  renderPools();
  renderAttrs();
  renderAbilities();
  renderTalents();
  el.levelOut.textContent = state.level;
  el.levelSlider.value = state.level;
  el.presetSelect.value = state.preset;
  var p = PRESETS.classes.find(function (c) { return c.id === state.preset; });
  el.presetBlurb.textContent = p ? p.blurb : '';
  save();
}

// ---------------------------------------------------------------- actions
function applyPreset(id) {
  var p = PRESETS.classes.find(function (c) { return c.id === id; });
  if (!p) return;
  var fresh = blankState();
  fresh.preset = id;
  fresh.level = state.level;                       // keep where you were
  Object.keys(p.attrs || {}).forEach(function (k) {
    fresh.attrs[k] = R.attributes.base + p.attrs[k];
  });
  fresh.abilities = Object.assign({}, p.abilities || {});
  fresh.talents = (p.talents || []).slice();
  fresh.skills = (p.skills || []).slice();
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
    var p = PRESETS.classes.find(function (c) { return c.id === this.value; }, this);
    el.presetBlurb.textContent = p ? p.blurb : '';
  });
  el.applyPreset.addEventListener('click', function () {
    applyPreset(el.presetSelect.value);
  });

  // attributes
  el.attrList.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var inc = b.dataset.inc, dec = b.dataset.dec;
    if (inc && attrTotal() - attrSpent() > 0 && state.attrs[inc] < R.attributes.softCap)
      state.attrs[inc]++;
    if (dec && state.attrs[dec] > R.attributes.base)
      state.attrs[dec]--;
    renderAll();
  });

  // abilities
  el.abilList.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var inc = b.dataset.abilinc, dec = b.dataset.abildec;
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
    var name = node.dataset.talent,
        i = state.talents.indexOf(name);
    if (i >= 0) { state.talents.splice(i, 1); renderAll(); return; }
    if (node.classList.contains('locked')) return;
    state.talents.push(name);
    renderAll();
  });
  el.talentFilter.addEventListener('change', renderTalents);

  // reset
  el.resetBtn.addEventListener('click', function () {
    if (!confirm('Clear this build and start over?')) return;
    state = blankState();
    renderAll();
  });
}

// ---------------------------------------------------------------- init
function init() {
  ['presetSelect','presetBlurb','applyPreset','levelSlider','levelOut',
   'poolAttr','poolAbil','poolTal','attrList','abilList','talentList',
   'talentFilter','rulesNotes','resetBtn'
  ].forEach(function (id) { el[id] = document.getElementById(id); });

  el.levelSlider.max = R.planLevel;

  PRESETS.classes.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c.id; o.textContent = c.name;
    el.presetSelect.appendChild(o);
  });

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
