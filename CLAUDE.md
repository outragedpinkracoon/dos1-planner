# DOS1 EE Build Planner

A single-page planner for **Divinity: Original Sin Enhanced Edition** character builds.
No build step, no framework, no dependencies — open `index.html` in a browser.

Built because respeccing in DOS1 EE is impractical, so builds need to be planned
before they are committed in game.

```
open index.html
```

## Files

```
index.html      three-column layout, loads the five data files then app.js
app.css         all styling, dark theme, single stylesheet
app.js          all logic in one IIFE, no modules
data/rules.js       progression maths and the skill-slot table
data/abilities.js   30 abilities across 6 categories
data/talents.js     50 talents with machine-readable prerequisites
data/skills.js      130 skills, 8 schools x 3 tiers
data/presets.js     12 classes + Custom, and 4 companions
```

Data files assign to `window.DOS_*` and are plain `<script>` tags, in dependency
order. `app.js` reads them as globals.

## The rules it enforces

Everything here is verified against the fextralife wiki and checked by the
scripts described under **Testing**.

| Pool | Rule |
|---|---|
| Attributes | base 5 each, +5 at creation, +1 per **even** level, cap 15 → 15 spendable at L20 |
| Ability points | 5 at creation; +1/level at L2-5, +2 at L6-10, +3 at L11+ → 49 at L20 |
| Ability rank cost | rank *n* costs *n* points, so rank 5 costs 15 cumulative |
| Talents | 2 at creation, then one each at levels 3, 7, 11, 15, 19, 23 → 7 by L20 |

Skill slots per school, indexed by ability rank (`R.skillSlots`):

| Rank | Novice | Adept | Master |
|---|---|---|---|
| 1 | 3 | — | — |
| 2 | 5 | 2 | — |
| 3 | 6 | 3 | — |
| 4 | 6 | 4 | 1 |
| 5 | 6 | 4 | 2 |

Two game rules are deliberately **shown, not blocked**, because neither is a hard
gate in game:

- **Ability rank below a skill's recommendation** costs +2 AP per rank short.
  The skill stays learnable; the card shows `11 AP (+4)`.
- **Attribute below a skill's requirement** reduces effectiveness by 10% per
  point. Shown as "Under-attributed", not a lock.

## Architecture

`state` is one object, persisted to `localStorage` on every change:

```js
{
  preset, level, buildName,
  attrs: {strength: 5, ...},      // absolute values
  abilities: {geomancer: 2, ...}, // id -> rank, absent means 0
  talents: [names], skills: [names],
  granted: [names],               // preset-given skills, exempt from slot limits
  grantedTalents: [names],        // companion talents that bypass prerequisites
  attrFloor: {...} | null         // per-attribute minimum, for companions below base 5
}
```

Rendering is full-redraw: `renderAll()` prunes, then re-renders every panel and
saves. No diffing, no virtual DOM. At this data size it is imperceptible and it
removes a whole class of stale-view bugs. Events are delegated from container
elements, so re-rendering never orphans a listener.

**Pruning is load-bearing.** Lowering a level or an ability rank can invalidate
choices already made. `pruneTalents()` and `pruneSkills()` run at the top of
every `renderAll()` and silently drop what is no longer legal — except anything
in `granted` / `grantedTalents`. Without these, the app would happily display
builds the game would reject.

### Storage

| Key | Contents |
|---|---|
| `dos1-planner:slice1` | the working build currently on screen |
| `dos1-planner:builds` | named saves, `{name: {savedAt, state}}` |

Builds are keyed by name: saving under an existing name overwrites it, a new
name creates another entry. `restoreBuild()` merges onto `blankState()`, so
builds saved by an older version survive new fields being added.

## Things that look like bugs but are not

**Companion sheets break player creation rules.** They are hand-authored by the
game and do not reconcile against level-3 budgets:

| | Attributes | Abilities | Note |
|---|---|---|---|
| Madora | 6/6 | 7/7 | the only clean one |
| Bairdotr | 6/6 | **8/7** | |
| Wolgraff | 6/6 | **9/7** | **Strength 4**, below the base 5 |
| Jahan | **7/6** | 7/7 | |

Their values are stored exactly as published and the pool bars show red where
they are over. Do not "fix" these to balance — the overspend is the accurate
representation. Wolgraff's Strength 4 is why `attrFloor` exists.

**Classes can grant skills their rank cannot slot.** Fighter opens with
Whirlwind, an *adept* Man-at-Arms skill, at Man-at-Arms 1 — which grants zero
adept slots. Preset skills go into `granted`, are tagged `CLASS` in the UI,
do not consume a slot, and cannot be clicked off. This was a real bug: pruning
deleted Whirlwind silently on load.

**Madora keeps Comeback Kid without Willpower 5.** Companion talents go into
`grantedTalents` and skip prerequisite checks, tagged `GIVEN`.

**Make Invisible and Netherswap** are master-tier but only ask for Aerotheurge 3.
The tier gate (rank 4) binds, not their stated requirement.

## Unverified data

Four entries are absent from the fextralife pages and carry `unverified: true`,
rendered with a ⚠ tooltip. Their stats are **guesses** — correct them if real
values turn up in game:

- **Dust Devil** — Madora's starting skill, assumed novice Man-at-Arms
- **Razor's Edge** — Wolgraff's starting skill, assumed novice Scoundrel
- **Arrow Recovery** — Ranger and Bairdotr's talent, prerequisite guessed
- **Tenebrium** — Bairdotr's ability, a mid-game unlock

Jahan's attributes were once suspected of being a wiki typo. Adding Bairdotr and
Wolgraff showed three of four companions overspend, so it is authoring, not an
error. Do not chase it.

## Testing

There is no test runner. Verification is done with throwaway `python3` heredocs
that parse the data files with regex and check invariants — this catches data
errors, which is where the bugs have actually been. Worth re-running after any
data change:

- pool maths against known wiki totals (49 / 15 / 7 at level 20)
- every class spends exactly 5 attributes, 5 ability points, 2 talents
- every preset's skills, talents and abilities resolve to real entries
- preset skills fit their starting slots, or are correctly `granted`
- `{}` and `()` balance in `app.js`; every `id=` in the HTML is wired; no
  `el.*` reference lacks an element

The Fighter/Whirlwind and Wolgraff/Strength-4 bugs were both found this way, not
by clicking around.

## Not built

Deliberately out of scope so far:

- **Level-by-level spend sheet** — the planned next slice: one row per level
  showing what to spend and when, reverse-derived from a finished build, so it
  can be followed at the keyboard. Would also surface deliberate point banking.
- **Crafting** — explicitly deferred by the user as a separate project
- **Gear bonuses** — no +X to attributes or abilities from equipment
- **Lone Wolf** — the talent is listed but its +1 ability point per level is not
  applied to the pools
- **Multi-character party view** — one build at a time was a deliberate choice;
  companions are just presets in the same dropdown
