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

The dashboard reads Streamline's five shared favorite-profile slots from Decaid and keeps their saved order; if no assignments exist it falls back to the first five visible profiles. Each profile card builds its green pressure and blue water-flow curves from that profile's ordered pump steps, durations, and transitions, so swiping profiles changes the expected target graph as well as the settings. Fast transitions render as steps, while smooth and eased transitions render as ramps. Across Bestpresso's profile, live, and history graphs, pressure is green, water flow is blue, and weight is magenta. `Manage profiles` opens Bestpresso's own profile page, which is reserved for the future profile-management workflow.

The scale card resolves the connected device name from Decaid's device list and reads its live weight from the scale snapshot stream. When no scale is connected, the weight is replaced by a search control that starts Decaid's normal scan-and-auto-connect flow.

When Decaid reports the machine in its `espresso` state, Bestpresso automatically replaces the dashboard with the zoomed brewing view. Its native SVG chart plots live pressure, flow, mix/group temperature, and connected-scale weight, together with dashed pressure and flow targets. Samples are synchronized from Decaid's machine and scale snapshot streams and kept in a bounded in-memory buffer. At the end of the pull, the completed graph remains on screen until the user taps the grey Close control. Pulls with at least five seconds of observed extraction become the dashboard's Previous pull immediately, including a compact SVG snapshot of their pressure, flow, and weight traces; interrupted starts do not replace the previous successful shot. On startup, connected mode reads Decaid's canonical `/shots/latest` record and then fetches `/shots/{id}` for its measurements; it never substitutes fixture history when the gateway has no stored shot or the history request fails. A newly completed pull is also reconciled with Decaid's persisted record after recording finishes.

Machine and profile values with a green chevron beside their label are editable while Decaid is connected. The full label-and-value metric is a touch target, which keeps long readings clear of the card edge. Tapping one opens a touch-first ruler instead of the system keyboard: temperatures, times, and whole-volume settings use the integer variant, while grind, dose, espresso yield, and flow use the decimal variant. Both the number row and tick row form one continuous drag surface. The two variants also support arrow keys and preset chips; choosing a preset animates the ruler to its value, and the setting is only applied after Save. Hot-water volume and temperature plus steam temperature, maximum time, and flow are written to the active Decaid workflow; the shared Streamline keys are updated for settings Streamline resynchronizes. Profile temperature, grind, dose, and target yield activate the edited profile in the workflow and are recorded in its metadata, with temperature applied across all profile steps and target yield mirrored to the profile stop weight. Bestpresso re-renders from Decaid's response and reports saving, saved, partial-save, and error states instead of treating an optimistic local value as confirmation.

The status pill first confirms Decaid availability and then the machine device's own connected state from `/devices`; stale temperature frames never outrank either connection gate. Only a connected machine can show thermal status. `booting`, `heating`, and `preheating` explicitly mean Heating, while an idle machine is evaluated against both available mix and group targets instead of being assumed Ready. A 1 °C deficit enters Heating and the machine must recover to within 0.5 °C before returning to Ready. Active operations such as espresso, flush, hot water, and steam hold the preceding thermal status, then normal evaluation resumes when idle; 2-second Heating and 0.5-second Ready confirmations prevent transient post-operation flicker. Tank removal preserves the prior thermal state while separately showing the water alert. When the lagging temperature is at least 1 °C below target and fails to gain 0.3 °C for 10 seconds, the status changes to `Not heating — Check power button`; a renewed 0.3 °C rise restores Heating. The `time-to-ready.reaplugin` contributes only the seconds estimate after the connected and thermal gates agree that the machine is heating.

The header Sleep control sends `sleeping`, replaces the skin with a full black wake surface, and asks Decaid to set the tablet brightness to `0`. Tapping anywhere on that surface dismisses it immediately, sends `idle`, and restores the brightness that was active before sleeping (or returns to OS-managed brightness when no prior value is available). The Settings control opens Decaid's bundled settings interface and supplies `backName=Bestpresso` so its Back control returns to the skin. Other machine commands remain disabled.
