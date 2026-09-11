# Bestpresso v0.1.26 — Patch 002

This release includes all v0.1.26 features and both patches.

## Unified settings
- Manage Bestpresso preferences and supported Decaid settings in one place, including drink preparation, cleaning, devices, power, display, and advanced machine controls.
- Choose Celsius or Fahrenheit, plus device-default, 12-hour, or 24-hour time.
- Customize completion sound, the early reservoir warning, and chart thickness across all charts: Thin (1px), Medium (2px), or Thick (3px).
- Settings reflect known homescreen values while loading, with Save and Cancel for preference changes.
- Hot water uses weight stopping when a scale is connected and shares the universal Yield look-ahead setting.

## Visual and usability improvements
- Refreshed card backgrounds and subtle outlines, darker homescreen panels, and a stronger animated selected-profile border.
- Better-aligned metric controls and more compact tablet layouts.
- Separate chart legends and stage labels prevent overlap on shorter screens; axis labels resize without becoming distorted.
- Compact live-shot and history title bars and stage cards on screens 700px tall or shorter.
- Two-column settings details from 1000px wide, with excess spacing removed when lists stack below that width.

## Reliability
- Brightness choices are now remembered by Bestpresso and reapplied to Decaid when reconnecting. Wake/disconnect handling no longer unnecessarily resets brightness to 100.
- Completion audio uses MP3 for broader browser compatibility.
- Improved final-yield stability after a shot completes.

## Notes
- Available machine controls depend on the Decaid version, platform, and connection.
- The machine's own needs-water state always takes priority.
- Decaid still resets display brightness when closing a skin; Bestpresso restores its saved choice when connected again.
- Automated tests and browser layout checks pass. The new brightness behavior still needs verification on a physical tablet.

Install the attached **bestpresso-v0.1.26-patch002.zip** in Decaid.
