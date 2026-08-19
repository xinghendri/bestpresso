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

The dashboard reads Streamline's five shared favorite-profile slots from Decaid and keeps their saved order; if no assignments exist it falls back to the first five visible profiles. `Manage profiles` opens the full visible profile list.

The header Sleep control mirrors Streamline's confirmed-state behavior: it sends `sleeping` while the machine is awake and `idle` while it is asleep, then waits for the machine snapshot to confirm the change. Heating state comes from the confirmed machine snapshot, with an optional live countdown from the `time-to-ready.reaplugin` feed. The Settings control opens Bestpresso's settings route and supports browser Back navigation. Other machine commands and workflow/profile writes remain disabled.
