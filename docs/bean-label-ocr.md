# Bean Label OCR and Bean History

## Purpose

Allow a user to photograph a coffee bag label, extract useful metadata, review it, and save it to a personal bean history. A saved bean can remember a grind-size reference for each profile with which it is brewed.

This feature reads printed label text. It does not attempt to identify a coffee by looking at the physical beans, estimate roast level, or assess defects.

## Product principles

- OCR output is always a suggestion. The user reviews the fields before saving.
- Scanning should be faster than entering the same information manually.
- The first implementation should work locally and should not require a cloud account.
- A grind setting is reference data only. It must not alter profile mechanics or machine behaviour.
- Bean records and profile records remain independent. Their grind-size relationship is stored separately.
- Manual entry must remain available when a label cannot be read.

## Primary user flow

1. The user chooses **Add beans** and then **Scan label**.
2. Bestpresso opens the rear camera or Android camera picker.
3. The user captures one still image of the label.
4. Bestpresso prepares the image and runs OCR.
5. Recognised text is mapped into editable bean fields.
6. The user reviews, corrects, and confirms the metadata.
7. Bestpresso saves the bean in the user's bean history.
8. When brewing, the user may associate the selected bean with the selected profile.
9. A saved grind size becomes the remembered reference for that exact bean and profile combination.

## Bean metadata

### Initial fields

- Roaster
- Coffee name
- Country or origin
- Region
- Producer, farm, or washing station
- Variety
- Process
- Roast date
- Tasting notes
- Optional bag-label image
- Date added
- First used date
- Last used date
- Archived or finished state

All OCR-populated fields remain editable. Unknown fields should stay empty rather than being guessed.

### Possible future fields

- Purchase date
- Bag weight
- Remaining amount
- Roaster URL
- Lot or harvest information
- Altitude
- Decaf method
- User notes and rating

## Data model

The exact storage mechanism can change, but the logical entities should remain separate.

```text
Bean
  id
  roaster
  name
  origin
  region
  producer
  variety
  process
  roastDate
  tastingNotes[]
  labelImageRef?
  createdAt
  firstUsedAt?
  lastUsedAt?
  archivedAt?

BeanProfileGrindReference
  beanId
  profileId
  grindSize
  updatedAt

ShotBeanLink
  shotId
  beanId
  profileId
  grindSizeUsed?
```

`BeanProfileGrindReference` should use the bean and profile IDs as a unique pair. Updating a grind size changes only that pairing.

## Grind-size behaviour

When Bestpresso needs to show a grind-size reference, use this precedence:

1. Grind size saved for the selected bean and selected profile
2. Optional general grind reference saved for the bean
3. Grind size already stored on the profile
4. Default value of `20`

When a bean and profile are both selected, saving an adjusted grind size should update their paired reference. It should not rewrite the Decent profile unless the user is explicitly editing that profile through the profile editor.

The pairing should support Bestpresso's existing decimal grind-size format and range. The value is a user reference and has no direct effect on extraction control.

## Bean history behaviour

- Each saved bean appears in a searchable, most-recently-used list.
- Selecting a bean exposes its metadata, associated shots, profiles used, and remembered grind references.
- Recording a shot updates the bean's `lastUsedAt` value.
- A shot retains the bean link and the grind size used at that time, even if the current reference later changes.
- Finishing a bag archives it without deleting its shot relationships.
- An archived bean can be restored.

## OCR pipeline

```text
Capture still image
  -> correct orientation
  -> crop to label
  -> resize and improve contrast when needed
  -> OCR
  -> normalise recognised text
  -> map candidate values to fields
  -> user review
  -> save
```

Field parsing should prefer recognisable label patterns without inventing content. For example:

- A date near "roasted", "roast date", or "roasted on" is a roast-date candidate.
- Terms such as washed, natural, honey, anaerobic, or carbonic maceration are process candidates.
- Unclassified text remains visible as raw recognised text during review so the user can use it manually.

## Recommended first implementation

### Skin dependencies

- `tesseract.js`
- Locally bundled Tesseract Web Worker
- Locally bundled WebAssembly core files
- Locally bundled language data, initially English
- Browser Canvas API for rotation, crop, resize, and contrast preparation

Do not load OCR dependencies from a CDN. They should be packaged with the skin so scanning works offline and does not depend on third-party availability.

### Camera capture

Start with a still-image capture control that invokes the Android camera or file picker. This is simpler and less demanding than continuous video recognition.

An embedded live camera using `getUserMedia()` requires Decaid host support:

- Android camera permission in the app manifest
- Runtime permission handling
- WebView permission-request handling
- A secure or locally trusted skin origin

The current Decaid Android host does not declare camera permission or handle WebView camera permission requests. Therefore, camera-picker capture should be tested first; an embedded camera requires coordinated Decaid changes.

### Performance

- Create and retain one OCR worker while the scan flow is open.
- Process a still image rather than every camera frame.
- Resize the image so label text remains legible without processing the camera's full-resolution output.
- Show recognition progress and allow cancellation.
- Keep manual entry usable if OCR initialization or recognition fails.

## Alternative recognition engines

If browser OCR is too slow on the target tablet, preserve the same Bestpresso flow and replace only the recognition layer.

### Native Android OCR

Google ML Kit Text Recognition can run locally through a Decaid-native bridge. Its bundled Latin model is available immediately and avoids a first-use model download, at the cost of increasing the host app size.

This option requires changes to Decaid and is not deliverable as a skin-only ZIP.

### Cloud OCR

A cloud service may improve difficult-label recognition but introduces network dependency, privacy disclosure, operating cost, and secret management. API keys must never be embedded in the skin. Cloud OCR is not recommended for the first version.

## Duplicate handling

Before creating a bean, compare normalised values for:

- Roaster
- Coffee name
- Roast date

If a likely match exists, offer the user a choice to use the existing bean or save a new bag. Do not merge automatically because repeat purchases can share the same name but have different roast dates or lots.

## Privacy and storage

- Run OCR locally for the initial release.
- Explain whether the label image will be stored before saving it.
- Allow the user to discard the image after extracting the text.
- Deleting or archiving a bean must not silently delete historical shot records.
- If cloud recognition is introduced later, require explicit disclosure before uploading an image.

## Error and recovery states

- Camera unavailable: allow image selection or manual entry.
- Permission denied: explain how to retry without trapping the user.
- Text not detected: retain the photo and open an empty editable form.
- Partial recognition: populate only confident candidates.
- OCR assets unavailable: show manual entry and a retry action.
- Save failure: retain the reviewed form and image until the user retries or discards them.

## Phase plan

### Phase 1 — bean library foundation

- Bean records and bean history
- Manual add and edit
- Archive and restore
- Link a bean to a shot
- Bean/profile grind references

### Phase 2 — label scanning

- Android camera-picker capture
- Local Tesseract OCR
- Editable review screen
- Duplicate suggestions
- English-language labels

### Phase 3 — quality improvements

- Guided crop and perspective correction
- Additional OCR languages
- Improved metadata parsing
- Recognition-quality telemetry that contains no label images or recognised text

### Phase 4 — optional native acceleration

- Decaid camera permission and WebView bridge
- Embedded camera preview
- ML Kit recognition if performance testing justifies it

## Initial acceptance criteria

- A user can add a bean manually without using the camera.
- A user can photograph or select a label image and receive editable OCR suggestions.
- OCR works without an internet connection after the skin is installed.
- Failed or incomplete OCR never blocks manual completion.
- A saved bean appears in bean history and can be selected for brewing.
- A completed shot can retain a link to the selected bean.
- The same bean can have different grind-size references for different profiles.
- The same profile can have different grind-size references for different beans.
- Selecting a bean/profile pair restores its most recently saved grind-size reference.
- Updating a paired grind reference does not change extraction mechanics or overwrite the source profile.
- Historical shots retain the grind value used at the time of the shot.

## Decisions to make before implementation

- Where bean records live: skin storage, a Decaid database/API, or account-backed sync
- Whether label images are retained by default
- Whether a bean must be selected before a shot or may be attached afterward
- Whether saving grind size updates automatically or requires an explicit "Remember for this coffee" action
- Which languages are required for the first OCR release
- Whether the camera-picker flow works reliably in every supported Decaid WebView target
