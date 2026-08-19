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

The dashboard reads Streamline's five shared favorite-profile slots from Decaid and keeps their saved order; if no assignments exist it falls back to the first five visible profiles. `Manage profiles` opens Bestpresso's own profile page, which is reserved for the future profile-management workflow.

The scale card resolves the connected device name from Decaid's device list and reads its live weight from the scale snapshot stream. When no scale is connected, the weight is replaced by a search control that starts Decaid's normal scan-and-auto-connect flow.

The header Sleep control sends `sleeping`, replaces the skin with a full black wake surface, and asks Decaid to set the tablet brightness to `0`. Tapping anywhere on that surface dismisses it immediately, sends `idle`, and restores the brightness that was active before sleeping (or returns to OS-managed brightness when no prior value is available). Heating state comes from the confirmed machine snapshot, including Decaid's `idle` + `preparingForShot` warm-up state and any live group temperature below the active group-temperature target. The `time-to-ready.reaplugin` supplies a seconds countdown once it has enough rising-temperature history to estimate the heating rate. Bestpresso does not impose a separate fixed group or mix-temperature cutoff. The Settings control opens Decaid's bundled settings interface and supplies `backName=Bestpresso` so its Back control returns to the skin. Other machine commands and profile writes remain disabled.
