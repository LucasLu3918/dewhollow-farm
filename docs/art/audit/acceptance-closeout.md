# Acceptance closeout — Dewhollow Farm art and pet fix

**Audited revision:** `57b3770fbee9ae789060761a1fee19bd79938f76` (`main`, 2026-10-23)  
**Plan:** `Dewhollow_Farm_Art_Quality_Pet_Fix_Agent_Plan_zh-TW.md`  
**Purpose:** distinguish implemented fixes from the plan's broader acceptance gates. A green test suite does not imply that every visual, device, or performance criterion passed.

## Task acceptance matrix

| Task | Status | Evidence that passes | Remaining acceptance work |
|---|---|---|---|
| DF-ART-001 — regression audit | **Partial** | `report.md` compares old, regressed, and fixed pet renders; records root cause, asset hashes, selected asset scope, and PR history. | No full per-asset dimensions/alpha/anchor/offset/rig audit table; no recorded A/B of filter/finalization methods; subjective whole-project style consistency is unverified. |
| DF-PET-002 — black cat | **Partial** | Restored `pet.cat` identity and existing rig/save ID; original and in-game render are recognizable as a black cat; companion E2E and snapshots pass. | Tail is shorter than the brief; no targeted proof of foot anchor, collision, and occlusion together. |
| DF-PET-003 — quokka | **Partial** | Animal silhouette, asset key, rig, village placement and interaction have E2E/render evidence; user approved using the second quokka candidate as the base. | No version/hash-bound human signoff for the integrated PNG; exact species recognition in the small in-game render remains unverified. |
| DF-ART-004 — art pipeline | **Partial** | User approved the exact style sheet revision recorded in `asset-review.md`; candidate/reviewed/approved/integrated workflow and exclusive-create output safety are documented and tested. | No complete per-asset alpha/scale/loading visual audit or animation-frame identity checklist. |
| DF-MAP-005 — map ground and occlusion | **Partial** | Greenhouse fence ground is explicit; map unit and pixel-sampling checks protect corrected cells. New deterministic Chromium coverage passes for four seasons, field edges, shop wall, greenhouse fence, door transitions, forest tree collision/overlap, mature field, lake and mine. Seven scene baselines are committed. | Mature-field snapshot exposes the current crop placeholder as a red circle on a black square; building-depth coverage beyond the tested tree overlap and full-town/farm visual review remain incomplete. |
| DF-FEEL-006 — day loop and gameplay | **Partial** | Multiday crop/forage/shipping/sleep/save loop checks time, energy, inventory, and currency; separate farm, livestock, fishing, and mining tests exist. New rendered NPC E2E passes dialogue, shop open/close, daily-repeat protection, out-of-range refusal, save/reload, and unchanged gold/inventory/friendship/time/quest state. It also verifies the resident quest remains locked at the actual friendship level. | No integrated rendered success path for quest acceptance/completion; rendered current-target and refusal feedback across every gameplay system remain incomplete. |
| DF-MOBILE-007 — mobile | **Partial** | Four viewport sizes, selected touch controls, long-press/cancel, rotation, hit-target and responsive layout checks pass. New touch-driven Chromium flows pass in portrait (390×844) and landscape (844×390), covering dialogue, shop, till/plant/water/harvest, sleep and save/reload with state assertions. | Physical-device behavior, safe-area and real-device text readability remain unverified. |
| DF-QA-008 — visual/save/performance QA | **Partial** | Save slots, synthetic v1 migration, corrupt/newer saves, multi-day persistence and pet snapshots are covered. New deterministic seasonal, mature-field, lake and mine baselines are committed; targeted mobile/map/NPC tests and `npm run check` have passed separately. | The integrated full E2E suite has not yet been rerun on this combined head; mature crop art is still a placeholder; no paired desktop/mobile FPS, input-latency, load-time, or memory baseline; no external historical shipped-save fixture. |

## Current automated verification

- `npm run check`: TypeScript, 148 Vitest files, 1,541 passed, 1 skipped, production build and bundle budget passed.
- Full Chromium E2E: 177 passed on the merged candidate.
- Combined follow-up head `07b509e51469ceeb96217e330ff98af25475f95b`: `npm run test:e2e` passed all 184 tests (9 workers, 2.7 minutes), including mobile portrait/landscape, map-world baselines/collisions, and NPC acceptance. An earlier combined run exposed an invalid exact-one crop-yield assertion; the domain's configured harvest range is 1–2. The test now checks configured yield range, one harvest event, one energy cost, and cleared plot state. No runtime duplicate-action defect was reproduced.
- Companion snapshot stability: 10/10 repeated runs; farm snapshot hash stable. Existing village snapshot variance is within its matcher but has no quantified diff image.
- CI run `39933822805` passed both jobs on the final candidate head `bc365d5f8bb8fc37a82a02f2660163261805af22`.
- Follow-up isolated verification: mobile flow 2/2 passed in portrait/landscape after the yield assertion correction; map-world spec 4/4 passed before its final isolated collision assertion, then that collision case passed 1/1 and the mature-field snapshot passed in its targeted run; NPC flow 1/1 passed. NPC `npm run check` passed. The combined 184-test run above supersedes the separate-run limitation.
- There is no project lint script. No physical iOS or Android device result is claimed.

## Known gaps and disposition

| ID | Severity / status | Scope and reproduction | Owner | Follow-up |
|---|---|---|---|---|
| QA-DEVICE-01 | **Unrated verification gap; no runtime regression established** | iOS/Android performance and safe-area behavior. Use the S1–S8 scenarios in `docs/DEVICE_PERF.md`; collect three runs per device for FPS, input latency, load time, and memory. | QA with device access | Keep `DEVICE_PENDING` until physical-device results are attached. |
| QA-MOBILE-02 | **Partial** | Real touch in browser at 390×844 and 844×390 completes movement, farming actions, dialogue, shop, sleep and save/reload. | E2E owner | Physical device, safe-area and touch-text review remain open. |
| QA-MAP-03 | **Partial** | Deterministic season/collision/depth test and seven baselines; tested blockers include shop wall, greenhouse fence, tree, doors and field edge. | Map/E2E owner | Add broader house/building depth review and inspect/fix the mature-crop placeholder shown in the baseline. |
| QA-VISUAL-04 | **Partial** | Mature-field, lake, mine and four seasonal farm baselines committed. | Art/QA owner | Mature-field baseline exposes placeholder crop rendering (red circle on black square); provide approved crop art or explicitly defer it before final visual signoff. |
| ART-PET-05 | **Review pending** | Current integrated quokka is `public/assets/characters/marsupial-2x.png`; approval so far identifies the second candidate as the base, not this exact derived PNG version. | User / art owner | Record exact PNG SHA-256 after the user reviews the displayed integrated image. |
| ART-STYLE-06 | **Closed for style-sheet direction** | User approved the displayed `docs/art/style-sheet.png` revision on 2026-10-23; exact SHA-256 and approval record are in `docs/art/asset-review.md`. The image retains its historical pre-approval caption. | Project maintainers | Keep individual asset review and approval independent from this style reference. |
| ART-CAT-07 | **Known cosmetic deviation** | Current black cat is recognizable; its tail is shorter than the written brief. | Art owner | Revisit only if a longer tail can be achieved without harming the approved old-cat restoration. |
| ART-CROP-08 | **Known visible placeholder** | `content/assets.json` declares `crop.sweet-radish` as `占位（程式產生）`; the deterministic mature-field snapshot visibly renders it as a red circular mark on a black square. | Art/content owner | Replace with approved transparent crop art and update the baseline, or explicitly defer it; don't mark the mature-field art gate passed while this placeholder remains. |

## Signoff record

- **Pet direction approval:** user confirmed “restore the old black cat; use the second quokka candidate as the base.” This approves direction, not the exact current PNG hash.
- **Style reference approval:** user approved the displayed `docs/art/style-sheet.png` as the overall pixel-art style reference on 2026-10-23; SHA-256 `9cf2c3db8e3047b577386f873b58b4c17ff1379263329e44b5930a60bdbcc4ae`.
- **Current exact integrated quokka PNG SHA-256:** pending exact-version review.
- **Style-sheet approval:** approved for the recorded SHA-256 above; this signoff covers style direction only.
- **Physical-device performance evidence:** pending.
