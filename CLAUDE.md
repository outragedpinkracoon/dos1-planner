# DOS1 EE Build Planner

Two plain pages for **Divinity: Original Sin Enhanced Edition** — a character
build planner and a crafting reference. No build step, no framework, no
dependencies; open either in a browser.

The planner exists because respeccing in DOS1 EE is impractical, so builds have
to be planned before they are committed in game. The crafting page exists
because the recipe list is 499 entries deep and the game tells you none of it.

```
open index.html      # build planner
open crafting.html   # crafting reference
```

## Files

```
index.html      three-column layout, loads the five data files then app.js
app.css         all styling, dark theme, shared by both pages
app.js          all logic in one IIFE, no modules
crafting.html   the crafting reference, three modes over one dataset
craft.js        crafting logic, same IIFE / full-redraw shape as app.js
craft.css       crafting-only styles, layered on app.css
data/rules.js       progression maths and the skill-slot table
data/abilities.js   30 abilities across 6 categories
data/talents.js     50 talents with machine-readable prerequisites
data/skills.js      130 skills, 8 schools x 3 tiers
data/presets.js     12 classes + Custom, and 4 companions
data/recipes.js     499 crafting recipes, generated (see Crafting)
scripts/verify_craft.py   invariant checks for the crafting page
```

Two pages, no shared JS: the planner and the crafting reference each load
their own data and keep their own `localStorage` key. They are linked in the
top bar.

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
  attrFloor: {...} | null,        // per-attribute minimum, for companions below base 5
  gearAttrs: {intelligence: 1},   // equipment bonuses, never cost pool points
  gearAbils: {geomancer: 1},
  showGear: false,                // are the gear steppers visible
  gearSlots: true                 // do gear-granted ranks unlock skill slots
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

## Gear bonuses

DOS1 gear is procedurally generated, so there is no item database to pick from.
Instead each attribute and ability row gets a second, dimmer stepper for "what my
kit adds", shown only when **Show gear bonuses** is ticked.

The rule that matters: **gear never touches the point economy, but drives every
requirement check.** `attrSpent()` and `abilSpent()` ignore it entirely, so a
bonus can never look like it costs or refunds points. Everything else reads the
effective value through two helpers:

```js
effAttr(id)  // state.attrs[id] + gearAttrs[id]
effRank(id)  // rank(id) + (gearSlots ? gearAbils[id] : 0)
```

Those feed skill slots, school locks, AP penalties, attribute shortfalls, and
both kinds of talent prerequisite. Attribute gear is deliberately uncapped — it
is the only way past the cap of 15. Ability gear stops at rank 5.

**`gearSlots` is a user-flippable rule.** Gear-granted ability ranks are believed
to unlock the matching skill slots in EE — reach Geomancer 4 with points, wear
+1, slot a second master skill. That was not confirmed from play, so the toggle
**Gear ranks grant skill slots** exists to turn it off. It defaults on.

Because pruning reads effective ranks, removing gear can invalidate skills the
gear was paying for, and they are dropped — the same behaviour as lowering a paid
rank, and correct, since the build is not legal without that item.

## Crafting

`crafting.html` answers three questions over one 499-recipe dataset:

| Mode | Question |
|---|---|
| **What can I make?** | tick your bag and the stations you are at, get everything craftable now, plus every recipe you are one item short of |
| **What should I keep?** | any junk item, and what it feeds into — Pixie Dust is in 31 recipes, Augmentor 30, Rope 24 |
| **How do I make X?** | the full ingredient tree, marking what is in your bag and what must be found |

State is one object under `dos1-planner:craft`, same full-redraw and delegated
events as the planner:

```js
{
  mode,                        // make | keep | how
  bag: {name: true},           // what you are carrying
  tools: {name: true},         // stations you are standing at
  skills: {Crafting, Smithing},
  typeFilter, hideOverLevel
}
```

### The data

`data/recipes.js` is generated from
[sethxd/divinity_crafting](https://github.com/sethxd/divinity_crafting) v0.4
and normalised. Regenerating it is a throwaway script, not a build step — the
committed file is the artefact. The normalisation that matters:

- **`|` alternatives become arrays.** `Water Barrel | Well` is two ways to
  satisfy one slot, not a literal item name. 28 recipes rely on this.
- **Raw asset ids are cleaned.** `LOOT_Wand_B` → `Wand (tier B)`,
  `Crafted Sword 01` → `Crafted Sword (tier 1)`.
- **Every ingredient is classified** as a station, an intermediate (it is also
  some recipe's result), or world loot.

### Stations are not tools

**A station is fixed in the world and never consumed** — anvil, oven, well,
the barrels. Those are the bench checklist, and `slotHave()` reads them from
`state.tools`.

A knife, bucket, hammer or cooking pot is *carried* and is genuinely
**consumed** by some recipes: `Anvil + Knife = Crafted Dagger` eats the knife.
Treating those as bench tools made eight recipes craftable from an empty bag.
They are ordinary bag items. `verify_craft.py` asserts no recipe consists
entirely of stations, which is what caught this.

### Tier ladders

148 of the 499 recipes — 30% — are the same inputs at different skill levels:
`Anvil + Iron Bar` gives a tier 1 sword at Smithing 1 and a tier 5 at
Smithing 5. Rendering those as five cards buries the actual question, which is
*what does my skill get me*. `ladders` groups recipes by their input signature
and each card shows one rung — the best your skill reaches — with the rest of
the ladder beneath it, locked rungs dimmed.

The same grouping runs in the ingredient tree, alongside a `drawn` set that
stops a shared sub-tree being expanded under every parent. Large Healing Potion
has four routes that all bottom out in Minor Healing Potion; the repeats
collapse to "shown above".

### Skill gates are shown, not hidden

Recipes above your Crafting or Smithing level render greyed, never removed —
the same choice the planner makes for ability shortfalls. **Hide above my
skill** is opt-in.

### Unverified

**Stunning Arrowhead** carries `unverified: true`. The source records it with
no ingredients at all; it is filled in as `Tooth + Knife` from fextralife,
but the wiki says crafting level 1 and both the source and a second search say
2, so the level is a guess. Same ⚠ tooltip convention as the planner's four
unverified entries.

Cloth boots are `Cloth Scraps + Anvil` at *Crafting*, not Smithing. That looks
wrong but is what the source says — left alone rather than silently corrected.

### Testing

`python3 scripts/verify_craft.py`, run from the repo root. Same philosophy as
the planner's throwaway heredocs, but kept as a file because the crafting data
is large enough to be worth re-checking:

- brace/paren balance in `craft.js`; every `el.*` resolves to a real `id`
- every ingredient resolves to an item, every type to a known type,
  every skill level in range
- no raw asset ids survived the cleanup
- the `craftable` flag agrees with the recipe list
- no recipe is made entirely of stations
- every CSS class used has a rule (bar the deliberate JS hooks)

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
- **Lone Wolf** — the talent is listed but its +1 ability point per level is not
  applied to the pools
- **Multi-character party view** — one build at a time was a deliberate choice;
  companions are just presets in the same dropdown
- **Crafting skill from gear** — the crafting page asks for your Crafting and
  Smithing levels directly rather than deriving them from a planned build, so a
  +1 Crafting item is just a number you type in. The two pages do not share
  state.
