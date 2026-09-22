# Bestpresso v0.1.32 — More languages

- Added French, Italian, Spanish, Traditional Chinese and Simplified Chinese. Choose your language in Settings → App experience, or follow your device.
- Localised numbers, decimal input, dates and times respect regional preferences. Profile names and saved measurements stay unchanged.
- Shorter French and Italian status labels and settings headings, with status pills that fit their content and consistent 12px right padding.
- Clearer early-stop calibration and flow/pressure limiter wording, including updated German explanations.
- Improved spacing for translated profile settings and narrow-screen headers.

Thanks to the Decent Espresso / Streamline.js translation contributors for reusable terminology. Language feedback and native-speaker corrections are welcome.

## Patch 001 — Yield flow and home-screen refinements

- Live extraction and shot-history charts now show Yield flow in g/s on the brown line, with translated labels in every supported language. Total yield remains available in grams; missing flow readings are left blank rather than shown as zero.
- The hot-water dispensing screen now clearly shows Target temperature, instead of the machine's mix-temperature reading. Dispensing behavior is unchanged.
- Steam starts with a neutral loading state until its setting is confirmed, avoiding a brief incorrect On display.
- Improved status-pill spacing, inset utility-card dividers, and breathing room for insight and history cards.
- Enforced Bestpresso's tare protection during active shots when enabled.

Install `bestpresso-v0.1.32-patch001.zip` in Decaid.

## Patch 002 — Yield consistency and spacing

- The completed final stage now matches total yield, including captured drips, in live view and history. Cached history uses its saved total; earlier stages, recorded chart samples and exit reasons remain unchanged.
- Hot-water, steam and flush modals remain visible for 500 ms after stopping, with content-sized metric panels and balanced padding.
- Insight and last-shot captions have matching side and bottom padding. The last-shot graph has 4px of bottom clearance to avoid clipping its lowest line.

Install `bestpresso-v0.1.32-patch002.zip` in Decaid.

## Patch 003 — Home-card layout

- The home-screen history chart is now edge-to-edge, clipped at both sides, top-aligned and 6px shorter.
- Added 4px more horizontal padding to insight and history captions.
- Added the GPLv3 license declaration to the README.

Install `bestpresso-v0.1.32-patch003.zip` in Decaid.

## Patch 004 — History chart height

- Increased the home-screen history chart height by 4px, preserving its top alignment, edge-to-edge layout and caption padding.

Install `bestpresso-v0.1.32-patch004.zip` in Decaid.

## Patch 005 — Optional sleep-screen blackout

- Added Screen off after in Power settings. The clock can go black after a configurable delay; disabled by default. This dims the display to zero rather than powering off the panel.
- Tap the black screen to bring back the clock without waking the machine. Hold for one second on either screen to wake the machine and restore normal brightness.
- Restoring the clock restarts the blackout timer. Clock updates and hint animations stop while blacked out.

Thanks to the PR93 contributor for the initial implementation.

Install `bestpresso-v0.1.32-patch005.zip` in Decaid.
