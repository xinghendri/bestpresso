# Milk Assist

Branch: `ashwinjv/milk-assist-v2` (PR #103, issue #99). Scope: an optional steam-time suggestion from the weighed milk; no change to the Steaming modal, the collapsed steam strip, or any steam flow while the feature is off.

Steam time on the machine is a fixed value. Milk Assist suggests a steam time from the weight of the milk in the jug: the user calibrates once by steaming a known amount of milk, and afterwards a tap on the steam card writes the suggestion to the Decaid workflow. It is off by default and stored per device.

```
milkGrams        = scaleGrams - jugGrams
suggestedSeconds = round(milkGrams × calSeconds / calGrams)   // clamped to 10 to 120 s
```

1 g of milk is treated as 1 ml. The 10 to 120 s bounds mirror `SETTINGS_PROTOCOL.steam.duration`.

## Implemented

- **Settings:** one Milk Assist toggle at the end of Prepare drinks, Steam defaults. Off by default. Not disabled by `workflowUnavailable`, because the flag is device local.
- **Steam card:** while enabled, a Steam time metric replaces Max duration in the expanded steam card. The row keeps two columns.
  - **Live** (scale connected, milk above the jug weight plus 10 g, calibration stored): label `Steam time · {grams} g` at tenth-gram precision, value is the suggested seconds with the tare circling-arrows icon. Tapping writes `steamSettings.duration`.
  - **Idle** (anything else): label `Steam time`, value is the current workflow duration. Tapping opens the dialog, or the wizard when no calibration exists.
- **Dialog:** jug weight, calibration pair and derived rate (seconds per 150 ml), with Close, Adjust time (the standard value ruler, for changing the time without a steam) and Recalibrate.
- **Calibration wizard:** weigh the empty jug (or use the saved weight), add the milk, then steam and stop. The captured seconds are editable before saving, because the measured run includes the machine's stop and purge tail (about 7 to 8 s). Saving writes the captured time clamped to 10 to 120 s; the calibration pair keeps the measured value.

Every write is a user tap; the feature never writes automatically. The standard top save notice is the only confirmation.

## Code map

| File | Responsibility |
| --- | --- |
| `src/features/machine/milkAssist.ts` | Pure logic and storage: constants, `suggestedSteamSeconds`, `clampSteamDuration`, `liveSuggestion`, `ratePer150Ml`, the store (`normalizeMilkAssist`, `readMilkAssist`, `writeMilkAssist`, `useMilkAssist`), the wizard reducer and `stableWeight`. |
| `src/features/machine/MilkAssistFeature.tsx` | UI: `MilkAssistMetric`, the dialog, the wizard overlay, and `useMilkAssistFeature`, which returns the metric props and the mounted overlays. |
| `src/app/AppShell.tsx` | One hook call; passes the metric to the steam card and renders the overlays. |
| `src/features/machine/DrinkUtilityCard.tsx`, `MachineUtilityCard.tsx` | An optional `milkAssist` prop that swaps the duration metric. |
| `src/features/brew/useBrewingData.ts` | `updateMachineSetting` resolves `true` once Decaid confirms a write and `false` otherwise. |
| `src/features/machine/drinkUtilityCards.css` | The Milk Assist block at the end of the file. |
| `test/milkAssist.test.ts` | Unit tests for every pure function above. |

## Storage

```
key: bestpresso.milkAssist.v1
{ enabled: boolean, jugGrams: number|null, calGrams: number|null,
  calSeconds: number|null, pendingRestoreSeconds: number|null }
```

Follows the `bestpresso.preferences.v1` pattern: normalize on read, swallow storage failures, broadcast a change event. Grams are positive rounded integers. Calibration seconds are valid from 5 to 120; a pending restore accepts any workflow duration from 1 to 120 s, so it always survives storage. No Decaid schema change; invisible to Streamline.

## Safety net and recovery

The wizard owns the only automatic duration writes, and every one is bounded:

- Entering step 3 writes 120 s only once the current duration is known. It first persists that duration as `pendingRestoreSeconds`; the write is latched by a dedicated boolean ref, so it happens once per attempt.
- Save writes the captured time; Cancel writes the pending value back. Either clears `pendingRestoreSeconds` only after Decaid confirms the write. A failed write keeps the backup.
- If the overlay unmounts mid-wizard (sleep screen, live brew), it re-seeds the restore value from storage on remount and does not overwrite it.
- If the app closes mid-wizard, or a restore write failed, `useMilkAssistFeature` retries the pending value once per launch as soon as settings are writable, and clears it only on success.

## Developer experience

Dev builds accept an opt-in query flag, following the existing `?demoShot=live` pattern:

| URL | Result |
| --- | --- |
| `localhost:5173/` | Production behavior |
| `?milkScale=626` | Simulated connected scale reading 626 g: the live state |
| `?milkScale=0` | Simulated empty scale: the idle state |

The simulated reading feeds both the steam card and the wizard, so the jug and milk capture steps work in dev. The first use seeds a starter calibration (412 g jug, 214 g · 24 s) into the real store, only if none is stored. A connected real scale always wins. The flag does not affect the scale card itself. Milk Assist must still be switched on in Settings. Production builds ignore the flag.

Gotchas:

- **The machine is 1024x600.** The steam card has no spare vertical pixels there. Any change must add no height to the card; verify at that size.
- **Specificity trap:** `index.css` has `.utility-card--steam .metric:first-child .metric__reading:not(...)` at specificity 0,5,0, which captures the Steam time reading because it reuses the `.metric` classes. Any color on that reading needs at least 0,6,0.
- **Narrow-card guard test:** `test/drinkUtilityCards.test.ts` forbids `font-size` inside the `@container (max-width:340px)` block and pins the steam settings grid to `grid-template-rows:minmax(0,1fr) var(--drink-metric-height)`. Do not change that grid.
- **Stability sampling is interval based** (250 ms). Sampling only on value change starves the 1.5 s window when the reading is steady, and a constant reading never becomes stable.
- **Wizard grid:** the overlay is a three-row grid (header, flexible body, footer). Messages belong inside the step body, never as direct children of `.milk-wizard`, or they displace the body row.
- **i18n:** every string goes through `t()` in all seven catalogs, with entries in `docs/localisation-contextual-drafts.json` and `docs/localisation-spanish-provenance.json`. Append new entries without reformatting those files. Rendered unit literals (`g`, `s`) are allowlisted in `src/i18n/interface-literals.json`. `npm test` and `npm run i18n:check` enforce this.

## Known limitation

The suggestion reads the absolute scale weight. A scale tared with weight on it (including the skin's automatic tare at the start of a shot) offsets the milk reading by that weight.

## Verification

- `npm run lint`, `npm test`, `npm run build`, `npm run i18n:check`.
- Visual checks on the dev server at 1024x600 with `?milkScale=626` and `?milkScale=0`.
- Full hardware validation on the machine's 1024x600 tablet with a connected scale: calibration with a real steam, the daily weigh, set and steam loop, and cancel and save while the connection drops (the duration is restored on the next launch).

## Possible follow-ups

- Split the metric into two tap targets: label and chevron open the dialog in every state, value and icon set the time. Today the dialog is only reachable from the idle state.
- Remember the last stop-and-purge trim and pre-apply it in the wizard.
