# Features from origin/main dropped by the 2026-08-18 force-push

Local `main` and `origin/main` had diverged from the repo's very first commit
(`1139734`, "Initial commit: wirezatUI component library") — 29 commits ahead
locally, 17 commits ahead on origin, no shared history since the root commit.
On 2026-08-18, local `main` was force-pushed over `origin/main`, permanently
discarding the 17 origin-only commits below. Logged here in case any of this
needs to be re-implemented against the current (local) codebase.

Origin-only commits (oldest → newest), never merged into local:

- `29cd25e` Add generic `.glint` sheen overlay component
- `b3ed7d7` Raise default page width to the 1140-1200px industry standard
- `dc02d2e` fix(virtual-window): skip hidden siblings when measuring row-group edges
- `7c8118f` fix: give the auth page its own scrollport, `.app-shell` no longer provides one
- `3411976` fix: constrain `.app-shell` to viewport height so `.main` actually scrolls
- `5db8975` fix(virtual-window): only load when ancestor-mode content is near the viewport
- `8a77466` Add `skeleton.css`: shimmering loading placeholder component
- `613eb1b` Fix double page-load in self-mode checkViewport, resync stale active row on eviction
- `f7ba905` Rebuild `WuiAutocomplete` on top of VirtualWindow
- `638ca4b` Fix VirtualWindow: resync `_off` after backward eviction, make loading guard generation-aware
- `72424e0` Add VirtualWindow: shared virtual-scroll core for self- and ancestor-scrolled lists
- `4f1a133` Unify hover-marquee into a shared base, add icontext + icon-cycle components
- `386bf56` Make `openModal` name-aware for pages with multiple modals
- `be9768b` Support multiple modal-backdrops per page
- `f966d0e` fix(auth): add `silent401` opt-out to `apiFetch`/`getUser`/header init
- `664b96e` Animate collapsible group header toggle
- `69b1031` Add graph and popover components; rework view-picker to icon-button group

Biggest items worth re-checking against current local code:
- **VirtualWindow** — shared virtual-scroll core, with several follow-up fixes
  (eviction resync, generation-aware loading guard, hidden-sibling measurement,
  ancestor-mode near-viewport gating). `WuiAutocomplete` was rebuilt on top of it.
- **skeleton.css** — shimmering loading placeholder component, no local equivalent.
- **`.glint` sheen overlay component** — local has its own Glint port
  (`feat(effects): port Glint sheen-sweep effect 1:1 from mc_optimizer`), diff
  not compared line-by-line, may already be equivalent.
- **icontext + icon-cycle components**, unified hover-marquee base — local has
  its own marquee work (`marquee.js`, `wireMarquee()`), not confirmed equivalent.
- **graph + popover components**, view-picker as icon-button group.
- **Multi-modal-backdrop support + name-aware `openModal`** — local has its own
  modal rewrite (`feat(modal): preset dispatch (confirm/prompt/form/checklist/...)`),
  not confirmed to cover the multi-modal-per-page case.
- **`.app-shell` viewport-height constraint / auth page scrollport fixes** —
  layout fixes, worth spot-checking `.app-shell` scroll behavior still works.
- **`silent401` opt-out on `apiFetch`/`getUser`/header init auth flow.**
