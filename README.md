# Bestpresso

Bestpresso is a brewing-first Decaid skin. This repository currently contains the interface foundation and a static brewing screen driven entirely by typed fixtures.

## Development

```sh
npm install
npm run dev
```

Use `npm run build` for the static production output and `npm run lint` for code quality checks.

## Architecture

- `src/app`: composition and application shell
- `src/components`: reusable visual primitives
- `src/features`: brewing, machine, profile, and history surfaces
- `src/fixtures`: mock models used before Decaid integration
- `src/domain`: browser-independent product types
- `src/styles`: visual tokens, layout, and responsive behavior

Real Decaid REST and WebSocket APIs are intentionally out of scope for this milestone.
