# Bestpresso

Bestpresso is a brewing-first Decaid skin. The brewing screen reads live Decaid values through typed adapters and falls back to fixtures when the gateway is unavailable.

## Development

```sh
npm install
npm run dev
```

Use `npm run build` for the static production output and `npm run lint` for code quality checks.

## Architecture

- `src/app`: composition and application shell
- `src/api`: Decaid configuration, REST, WebSocket, and domain adapters
- `src/components`: reusable visual primitives
- `src/features`: brewing, machine, profile, and history surfaces
- `src/fixtures`: offline fallback models
- `src/domain`: browser-independent product types
- `src/styles`: visual tokens, layout, and responsive behavior

## Testing with Decaid

Bestpresso discovers the Decaid gateway the same way as Streamline.js: it uses the page hostname by default and honors the existing `localStorage.reaHostname` override.

For local development against an iPad or another Decaid host, open:

```text
http://127.0.0.1:5173/?gateway=YOUR_DECAID_IP
```

The gateway query value is remembered as `localStorage.bestpressoGateway`. Decaid REST is read from port `8080`; machine, scale, and reservoir values update from the matching WebSocket feeds. If Decaid cannot be reached, the status pill displays `Demo` and the interface retains its fixture values.

For local stage-strip review, open `/?page=previous-pull` for the completed six-stage history fixture or `/?demoShot=live` for the active six-stage shot-monitoring fixture. The live demo query is development-only and is not enabled in production builds.

The dashboard reads Streamline's five shared favorite-profile slots from Decaid and keeps their saved order. A new installation starts with the first five visible profiles; removing a favorite leaves an empty slot. `See all profiles` opens the profile library, with search, source and category filters, alphabetical/recent sorting, and a dedicated Favorites view. Reordering favorites saves the same slot order used by the home cover flow. When all slots are full, a chooser lets the user replace one without deleting its recipe.

Profile detail has a full-width pressure/flow graph header, overlapping target metrics, and separate metadata and description cards. Select applies the recipe to Decaid. Create, JSON import, edit/copy, favorite, and protected delete use the existing verified API flows. Built-in profiles are edited as copies and cannot be deleted; deleting a user profile preserves recorded shots. New saves retain Created/Imported provenance, while legacy records without source metadata appear as Saved. Closing detail restores the current library filters. All views honor the skin theme, temperature unit, and chart line-weight preferences.

Selecting a non-favorite adds it as a sixth carousel item while rendering only five cards at once. Swiping to a favorite keeps that ad-hoc profile in rotation; it is removed only when an espresso pull begins with a different profile. Each profile chart uses that recipe's ordered pump steps, durations, and transitions. Fast transitions render as steps and smooth transitions as ramps. Across Bestpresso charts, pressure is green, flow blue, temperature red, and yield flow (g/s) coffee brown.

The scale card resolves the connected device name from Decaid's device list and reads its live weight from the scale snapshot stream. When Decaid has a preferred scale configured but that scale is disconnected, Bestpresso starts a silent quick scan every five seconds without changing the card to its manual Searching state. When no scale is connected, the weight is replaced by a search control that starts Decaid's normal scan-and-auto-connect flow. A connected, non-zero scale can be tared by tapping its weight or refresh control, and the skin also sends one tare request when a new espresso extraction begins.

When Decaid reports the machine in its `espresso` state, Bestpresso automatically replaces the dashboard with the zoomed brewing view. Its native SVG chart plots live pressure, flow, mix/group temperature, and connected-scale yield flow (g/s), together with dashed pressure and flow targets. The time axis starts at 10 seconds and expands in five-second increments within the same screen width. Samples are synchronized from Decaid's machine and scale snapshot streams and kept in a bounded in-memory buffer. Decaid profile-frame indexes are matched to the active profile's step names, producing a horizontally scrollable stage strip with live duration, yield, temperature range, and first/peak/final pressure for every observed stage. The red Stop control requests Decaid's `idle` machine state and remains pending until the telemetry stream confirms that extraction ended. Graph sampling is limited to Decaid's `preinfusion` and `pouring` substates, so it freezes as soon as the machine enters `pouringDone` instead of drawing the post-cutoff settling tail; gateways without substates retain the broader `espresso` fallback. At the end of the pull, the completed graph remains on screen until the user taps the grey Close control. Pulls with at least five seconds of observed extraction become the dashboard's Previous pull immediately, including a compact SVG snapshot of their pressure, flow, and yield-flow traces; interrupted starts do not replace the previous successful shot. On startup, connected mode reads Decaid's canonical `/shots/latest` record and then fetches `/shots/{id}` for its measurements; it never substitutes fixture history when the gateway has no stored shot or the history request fails. A newly completed pull is also reconciled with Decaid's persisted record after recording finishes.

Machine and profile values with a green chevron beside their label are editable while Decaid is connected. The full label-and-value metric is a touch target, which keeps long readings clear of the card edge. Tapping one opens a touch-first ruler instead of the system keyboard: temperatures, times, and whole-volume settings use the integer variant, while grind, dose, espresso yield, and flow use the decimal variant. Both the number row and tick row form one continuous drag surface. The two variants also support arrow keys and preset chips; choosing a preset animates the ruler to its value, and the setting is only applied after Save. Hot-water volume and temperature plus steam temperature, maximum time, and flow are written to the active Decaid workflow; the shared Streamline keys are updated for settings Streamline resynchronizes. Profile temperature, grind, and dose activate the edited profile in the workflow and are recorded in its metadata. Target yield is shown and editable only for profiles that already define stop-at-weight; profiles without it preserve a null yield target so Bestpresso cannot introduce an artificial stop. Bestpresso re-renders from Decaid's response and reports saving, saved, partial-save, and error states instead of treating an optimistic local value as confirmation.

The status pill first confirms Decaid availability and then the machine device's own connected state from `/devices`; stale temperature frames never outrank either connection gate. Only a connected machine can show thermal status. Explicit `booting`, `heating`, `preheating`, and `preparingForShot` signals mean Heating, while the thermal tracker also recognizes a 0.3 °C rise from either mix or group temperature as active warm-up. Espresso, flush, hot water, and steam hold the preceding thermal status. A machine that was Ready remains Ready after an operation while its lagging temperature is no more than 8 °C below target; a larger deficit returns it to Heating. `Not heating — Check power button` is limited to an explicit no-AC signal or a temperature below 70 °C that shows no measurable rise for 10 seconds. Tank removal preserves the prior thermal state while separately showing the water alert. The `time-to-ready.reaplugin` contributes only the seconds estimate after the connected and thermal gates agree that the machine is heating.

The header Sleep control sends `sleeping`, replaces the skin with a clock wake surface, and asks Decaid to dim the tablet to the screensaver brightness (7% by default, configurable in Settings). Touching and holding that surface for one second dismisses it, sends `idle`, and restores the brightness that was active before sleeping (or returns to OS-managed brightness when no prior value is available). When a screen-off delay is configured in Settings, the saver blacks out — brightness 0 with no visible content — that many seconds after the machine sleeps; the same one-second hold wakes it. The Settings control opens Decaid's bundled settings interface and supplies `backName=Bestpresso` so its Back control returns to the skin. Other machine commands remain disabled.
