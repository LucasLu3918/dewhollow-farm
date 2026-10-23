# Acceptance closeout — Dewhollow Farm art and pet fix

**Functional candidate validated:** `616be307e9280a01cb4b944a8b18c51f8b317c1c` (PR #16, merged to `main`). Verification was repeated on 2026-10-24 using the Node 24 runtime required by `.nvmrc`; the documentation follow-up still needs its own PR CI.
**Plan:** `Dewhollow_Farm_Art_Quality_Pet_Fix_Agent_Plan_zh-TW.md`  
**Purpose:** distinguish implemented fixes from the plan's broader acceptance gates. A green test suite does not imply that every visual, device, or performance criterion passed.

## Task acceptance matrix

| Task | Status | Evidence that passes | Remaining acceptance work |
|---|---|---|---|
| DF-ART-001 — regression audit | **Partial** | The regression report compares old, regressed, and fixed pet renders and records root cause, hashes, scope, and PR history. The metadata audit covers all 65 manifest entries and includes a same-source NEAREST/LANCZOS/palette comparison. | Rig-specific anchor/offset coverage for every asset and subjective whole-project style consistency remain incomplete. |
| DF-PET-002 — black cat | **Partial** | Restored `pet.cat` identity and existing rig/save ID. The rendered E2E verifies the 48×48 display, tile foot anchor, pass-through collision, southbound and northbound occlusion, and building collision/door behavior. | The restored cat's tail is shorter than the written brief. |
| DF-PET-003 — quokka | **Partial** | User approved the second candidate as the base, exact integrated PNG SHA-256 `614fc13c48dab042962c7dc39f2353890d5f038e04076205a99cad27aed822d7`, and its 48×48 village render as recognizable quokka without bear/person appearance. The reviewed snapshot is `tests/e2e/companions.spec.ts-snapshots/pet-companions-village.png` (SHA-256 `af0118ece49de2f5b5f39ab63874711bcfe11c4a08e70adcfdf29ebd7c2906b8`). Existing placement, interaction, and v1-save acceptance verify that the 96×96 source asset renders at 48×48 and that the current pass-through home tile remains traversable. | A signed anatomy checklist and an external historical shipped-save fixture remain unavailable; the v1 record here is a synthetic compatibility fixture. |
| DF-ART-004 — art pipeline | **Partial** | User approved the exact style-sheet revision recorded in `asset-review.md`; candidate/reviewed/approved/integrated workflow and exclusive-create output safety are documented and tested. Asset provenance and dimensions are inventoried. | A complete alpha/scale/loading visual audit and animation-frame identity checklist remain incomplete. |
| DF-MAP-005 — map ground and occlusion | **Partial** | Greenhouse ground is explicit; map unit and pixel-sampling tests cover four seasons, field edges, shop wall, greenhouse fence, doors, tree collision/overlap, pet depth ordering, mature field, lake and mine. Eight scene baselines are committed. | Building-depth coverage beyond the tested tree/pet interactions and full-town/farm visual review remain incomplete. |
| DF-FEEL-006 — day loop and gameplay | **Partial** | Multiday crop/forage/shipping/sleep/save loop checks time, energy, inventory and currency. Rendered NPC acceptance verifies dialogue, shop, daily-repeat protection, range refusal and unchanged state across reload. A rendered bulletin quest acceptance/completion success path now verifies visible feedback and persistence. | Rendered current-target and refusal feedback across every gameplay system remain incomplete. |
| DF-MOBILE-007 — mobile | **Partial** | Four viewport sizes, touch controls, long-press/cancel, rotation, hit targets and responsive layout pass. Portrait (390×844) and landscape (844×390) touch flows cover dialogue, shop, farming, sleep and save/reload. | Physical-device behavior, safe areas and real-device text readability remain unverified. |
| DF-QA-008 — visual/save/performance QA | **Partial** | Save slots, synthetic v1 migration, corrupt/newer saves, multi-day persistence, pet depth and deterministic map baselines are covered. The combined 190-test Chromium suite now passes on the integrated candidate. | No physical-device FPS/input-latency/load-time/memory baseline or external historical shipped-save fixture is available. Broader visual review remains open. |

## Current automated verification

- `npm run check` on `616be30` with Node 24.22.1: typecheck, 148 Vitest files, 1,541 passed, 1 skipped, production build and bundle budget passed (2.778 MB raw first-load size; 8 MB budget).
- `npm run test:e2e -- --workers=4` on `616be30` with Node 24.22.1: all 190 Chromium tests passed in 4.4 minutes.
- Pet-depth E2E: all five cases passed in the full suite and 10 repeated runs (50/50) under nine workers. Pixel ordering compares same-pose WebGL captures and retains a strict foreground-pixel majority assertion.
- Runtime note: `.nvmrc` specifies Node 24. An attempted run with system Node 26.11.1 crashed Vite's dev server; that run is not counted as product test evidence.
- Resident/shop stability E2E: three repeated runs passed (11.8, 11.7 and 11.9 seconds); route avoids the scheduled NPC blockers while preserving dialogue, purchase/refusal, persistence and unchanged-state assertions.
- Sweet-radish asset manifest tests: 30/30 passed. Mature-field E2E passed after snapshot regeneration and on the combined suite.
- Quest success E2E: focused test passed and is included in the 190-test combined run.
- There is no project lint script. No physical iOS or Android device result is claimed. The pushed PR head still needs its remote required checks.

## Known gaps and disposition

| ID | Severity / status | Scope and reproduction | Owner | Follow-up |
|---|---|---|---|---|
| QA-DEVICE-01 | **Blocked by unavailable hardware; no runtime regression established** | User confirmed no physical iOS/Android device is available. Performance and safe-area behavior remain unverified. Use scenarios S1–S8 in `docs/DEVICE_PERF.md`; collect three runs per device for FPS, input latency, load time and memory when hardware is available. | QA with device access | Keep `DEVICE_PENDING` until physical-device results are attached. |
| QA-MOBILE-02 | **Partial** | Browser touch at 390×844 and 844×390 completes movement, farming, dialogue, shop, sleep and save/reload. | E2E owner | Physical-device, safe-area and real-device text review remain open. |
| QA-MAP-03 | **Partial** | Deterministic season/collision/depth tests and eight baselines; blockers include shop wall, greenhouse fence, tree, pets, doors and field edge. | Map/E2E owner | Broader house/building depth review and full-town/farm visual review remain open. |
| QA-VISUAL-04 | **Partial** | Mature-field, lake, mine and four seasonal farm baselines committed. Sweet-radish art is approved and integrated. | Art/QA owner | Other crop assets remain generated placeholders; broader visual review is open. |
| ART-PET-05 | **Exact asset and reviewed scene approved** | User approved `public/assets/characters/marsupial-2x.png`, SHA-256 `614fc13c48dab042962c7dc39f2353890d5f038e04076205a99cad27aed822d7`, and confirmed the 48×48 quokka is recognizable in the village screenshot with no bear/person impression. The screenshot hash and approval scope are recorded in `docs/art/asset-review.md`. | Art / QA owner | This approval does not cover other directions, animation frames, or assets. |
| ART-STYLE-06 | **Closed for style-sheet direction** | User approved the displayed `docs/art/style-sheet.png` revision on 2026-10-23; exact SHA-256 and approval record are in `docs/art/asset-review.md`. The image retains its historical pre-approval caption. | Project maintainers | Keep individual asset review independent from the style reference. |
| ART-CAT-07 | **Known cosmetic deviation** | Current black cat is recognizable; its tail is shorter than the written brief. | Art owner | Revisit only if a longer tail can be achieved without harming the approved restoration. |
| ART-CROP-08 | **Closed for the approved crop asset** | User approved exact `public/assets/crops/sweet-radish-2x.png` (128×128 RGBA, density 2); the PNG was copied without redraw/resampling and appears in the mature-field baseline. | Art/content owner | Keep approval scoped to this exact PNG; other crops remain placeholders. |

## Signoff record

- **Pet direction approval:** user confirmed “restore the old black cat; use the second quokka candidate as the base.” This records the chosen direction.
- **Quokka rendered-size review:** user reviewed the 48×48 village snapshot `tests/e2e/companions.spec.ts-snapshots/pet-companions-village.png` (SHA-256 `af0118ece49de2f5b5f39ab63874711bcfe11c4a08e70adcfdf29ebd7c2906b8`) and confirmed it reads as a quokka, not a bear or person, on 2026-10-24.
- **Sweet-radish approval:** user approved exact 128×128 PNG, SHA-256 `e7cb6a3631de28f28cda03e9ced2725a1bf30c6f8634975e0a53964f47e8fbe7`, on 2026-10-23; copied without redraw/resampling to `public/assets/crops/sweet-radish-2x.png` and registered at density 2.
- **Style reference approval:** user approved `docs/art/style-sheet.png` as the overall pixel-art direction on 2026-10-23; SHA-256 `9cf2c3db8e3047b577386f873b58b4c17ff1379263329e44b5930a60bdbcc4ae`.
- **Current exact quokka PNG:** `public/assets/characters/marsupial-2x.png`, SHA-256 `614fc13c48dab042962c7dc39f2353890d5f038e04076205a99cad27aed822d7`, approved by the user on 2026-10-23.
- **Physical-device evidence:** pending; user confirmed no iOS/Android device is available for this run.
