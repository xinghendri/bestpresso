/** Shell wording: app frame, status pill, value adjuster, machine utility cards, sleep, updates, cleaning. */
export const shellEn = {
  // App.tsx — Visualizer import
  'shell.app.visualizerPluginDisabled': 'Enable the Visualizer plugin in Decaid settings first.',
  'shell.app.visualizerSignInRequired': 'Sign in to Visualizer in Decaid settings before importing a share code.',
  'shell.app.visualizerUnavailable': 'Visualizer import is not available in this Decaid setup.',
  'shell.app.visualizerImportFailed': 'Visualizer could not import that share code.',
  'shell.app.visualizerImportMissing': 'The profile was imported, but Decaid did not return it to Bestpresso.',

  // AppShell.tsx
  'shell.appShell.expandUtilityPanels': 'Expand utility panels',
  'shell.appShell.minimizeUtilityPanels': 'Minimize utility panels',
  'shell.appShell.machineControls': 'Machine controls',
  'shell.appShell.sleep': 'Sleep',
  'shell.appShell.wake': 'Wake',
  'shell.appShell.requestInProgress': '{label} request in progress',
  'shell.appShell.cleaningSequences': 'Cleaning sequences',
  'shell.appShell.cleaning': 'Cleaning',
  'shell.appShell.settings': 'Settings',

  // StatusPill.tsx
  'shell.status.ready': 'ready',
  'shell.status.heating': 'Heating',
  'shell.status.notHeating': 'Not heating',
  'shell.status.thirsty': 'Thirsty',
  'shell.status.sleeping': 'sleeping',
  'shell.status.disconnected': 'disconnected',
  'shell.status.connecting': 'connecting',
  'shell.status.demo': 'Demo',
  'shell.status.sourceMachine': 'Machine',
  'shell.status.sourceData': 'Data source',
  'shell.status.tooltip': '{source}: {status}',
  'shell.status.notHeatingTooltip': 'The group is not warming. Check the physical power button.',
  'shell.status.checkPowerButton': 'Check power button',
  'shell.status.heatingTooltip': 'Machine is heating',
  'shell.status.thirstyTooltip': 'Water reservoir needs water',

  // FullscreenPrompt.tsx / FullscreenToggle.tsx
  'shell.fullscreen.addToHomeScreenTitle': 'Add to Home Screen',
  'shell.fullscreen.addToHomeScreenBody': 'Tap Share, then Add to Home Screen for the best fullscreen experience.',
  'shell.fullscreen.gotIt': 'Got it',
  'shell.fullscreen.recommendedTitle': 'Fullscreen recommended',
  'shell.fullscreen.recommendedBody': 'Use fullscreen to give your controls more room.',
  'shell.fullscreen.error': 'Fullscreen could not be opened. You can continue normally.',
  'shell.fullscreen.opening': 'Opening…',
  'shell.fullscreen.enter': 'Enter fullscreen',
  'shell.fullscreen.exit': 'Exit fullscreen',
  'shell.fullscreen.later': 'Later',

  // domain/valueAdjustments.ts — titles read by Settings, Brew, Builder too
  'shell.adjust.hotWaterVolume.title': 'Hot water volume',
  'shell.adjust.hotWaterTemperature.title': 'Hot water temperature',
  'shell.adjust.steamTemperature.title': 'Steam target temperature',
  'shell.adjust.hotWaterDuration.title': 'Hot water max duration',
  'shell.adjust.steamDuration.title': 'Steam duration',
  'shell.adjust.steamFlow.title': 'Steam flow',
  'shell.adjust.temperature.title': 'Brew temperature',
  'shell.adjust.grindSetting.title': 'Grind size',
  'shell.adjust.dose.title': 'Dose',
  'shell.adjust.targetYield.title': 'Yield',
  'shell.adjust.builderPressure.title': 'Pressure',
  'shell.adjust.builderFlow.title': 'Flow',
  'shell.adjust.builderTemperature.title': 'Temperature',
  'shell.adjust.builderDuration.title': 'Max time',
  'shell.adjust.builderVolume.title': 'Move on volume',
  'shell.adjust.builderYield.title': 'Move on yield',

  // ValueAdjustmentProvider.tsx
  'shell.adjust.cancel': 'Cancel',
  'shell.adjust.save': 'Save',
  'shell.adjust.adjustAria': 'Adjust {label}',
  'shell.adjust.optionsAria': '{label} options',
  'shell.adjust.enterWithKeypadAria': 'Enter {label} with keypad',
  'shell.adjust.valueAnnouncement': '{label}, {value}',
  'shell.adjust.emptyValue': 'empty',
  'shell.adjust.maxError': 'Maximum is {max}.',
  'shell.adjust.minError': 'Minimum is {min}.',
  'shell.adjust.requiredError': 'Enter a number.',
  'shell.adjust.gestureTip': 'Swipe with two fingers for steps of 10, or three fingers for steps of 100.',
  'shell.adjust.suggestionsAria': '{label} suggestions',
  'shell.adjust.typicalRatiosAria': '{label} typical ratios',

  // NumericKeypad.tsx
  'shell.adjust.keypadAria': 'Enter {label}',
  'shell.adjust.deleteLastDigit': 'Delete last digit',
  'shell.adjust.decimalPoint': 'Decimal point',
  'shell.adjust.dismissKeypad': 'Dismiss number keypad',

  // Metric.tsx
  'shell.adjust.editMetricAria': 'Edit {label}, current value {value}{unit}',

  // MachineUtilityCard.tsx / DrinkUtilityCard.tsx
  'shell.machine.expandToView': 'Expand utility panels to view {label}',
  'shell.machine.disableSteamHeating': 'Disable steam heating',
  'shell.machine.enableSteamHeating': 'Enable steam heating',
  'shell.machine.steamTemperatureAria': 'Steam temperature',
  'shell.machine.steamGaugeValueText': '{current} current, {target} target',
  'shell.machine.steamHeatingOff': 'Steam heating off',
  'shell.machine.off': 'Off',
  'shell.machine.offLower': 'off',
  'shell.machine.editSteamTemperatureAria': 'Edit steam temperature, current {current}, target {target}',

  // MachineUtilityCard.tsx — reservoir
  'shell.tank.needsWater': 'Water reservoir needs water, {value}',
  'shell.tank.low': 'Water reservoir is getting low, {value}',
  'shell.tank.status': 'Water reservoir, {value}',
  'shell.tank.unknownLevel': 'unknown level',

  // MachineUtilityCard.tsx / ScaleDevicePicker.tsx — scale
  'shell.scale.searching': 'Searching…',
  'shell.scale.search': 'Search',
  'shell.scale.tareTitle': 'Tare scale',
  'shell.scale.tareAria': 'Tare scale, current weight {value}{unit}',
  'shell.scale.selectTitle': 'Select scale to connect',
  'shell.scale.devicesFound': { one: '{count} device found', other: '{count} devices found' },
  'shell.scale.connectAria': 'Connect {name}',
  'shell.scale.connecting': 'Connecting…',

  // LiveUtilityOperationOverlay.tsx
  'shell.liveOperation.hotWater': 'Dispensing hot water',
  'shell.liveOperation.steaming': 'Steaming',
  'shell.liveOperation.flushing': 'Flushing',
  "shell.liveOperation.targetTemperature": "Target temperature",

  // SleepWakeScreen.tsx
  'shell.sleep.wakeAria': 'Hold with one finger for 1 second to wake machine',
  'shell.sleep.touchAndHold': 'Touch and hold to wake',

  // DecaidUpdatePrompt.tsx
  'shell.updates.title': 'Decaid update available',
  'shell.updates.description': 'Version {version} is ready with the latest improvements and fixes.',
  'shell.updates.newerVersionFallback': 'a newer version',
  'shell.updates.installedVersion': 'Installed version {version}',
  'shell.updates.downloadingAria': 'Downloading update, {progress}% complete',
  'shell.updates.downloading': 'Downloading… {progress}%',
  'shell.updates.installing': 'Opening the installer…',
  'shell.updates.close': 'Close',
  'shell.updates.later': 'Later',
  'shell.updates.updating': 'Updating…',
  'shell.updates.updateDecaid': 'Update Decaid',
  'shell.updates.viewDownload': 'View download',
  'shell.updates.installFailed': 'The update could not be started.',
  'shell.updates.connectionLost': 'Bestpresso lost its connection to Decaid. Try again in a moment.',

  // CleaningSequencePicker.tsx
  'shell.cleaning.title': 'Cleaning',
  'shell.cleaning.tapHint': 'Tap %ICON% on your machine to start.',
  'shell.cleaning.selectProfile': 'Select a cleaning profile.',
  'shell.cleaning.loading': 'Loading cleaning profile…',
  'shell.cleaning.loadError': 'Could not load. Select a profile to retry.',
  'shell.cleaning.close': 'Close',
  'shell.cleaning.empty': 'No cleaning sequences are available yet.',

  // api/decaid/adapters.ts — shot stage fallback names
  'shell.brewStage.preinfusion': 'Pre-infusion',
  'shell.brewStage.cooling': 'Cooling',
  'shell.brewStage.extraction': 'Extraction',
  'shell.brewStage.stageNumber': 'Stage {n}',

  // api/decaid/adapters.ts — profile title fallbacks
  'shell.profile.untitled': 'Untitled profile',
  'shell.profile.previousPull': 'Previous pull',
} as const
