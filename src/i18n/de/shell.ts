import type { shellEn } from '../en/shell.ts'
import type { Translation } from '../types.ts'

export const shellDe = {
  // App.tsx — Visualizer import
  'shell.app.visualizerPluginDisabled': 'Aktiviere zuerst das Visualizer-Plugin in den Decaid-Einstellungen.',
  'shell.app.visualizerSignInRequired': 'Melde dich in den Decaid-Einstellungen bei Visualizer an, bevor du einen Freigabecode importierst.',
  'shell.app.visualizerUnavailable': 'Der Visualizer-Import ist in dieser Decaid-Einrichtung nicht verfügbar.',
  'shell.app.visualizerImportFailed': 'Visualizer konnte diesen Freigabecode nicht importieren.',
  'shell.app.visualizerImportMissing': 'Das Profil wurde importiert, aber Decaid hat es nicht an Bestpresso zurückgegeben.',

  // AppShell.tsx
  'shell.appShell.expandUtilityPanels': 'Bedienfelder erweitern',
  'shell.appShell.minimizeUtilityPanels': 'Bedienfelder verkleinern',
  'shell.appShell.machineControls': 'Maschinensteuerung',
  'shell.appShell.sleep': 'Schlafmodus',
  'shell.appShell.wake': 'Aufwecken',
  'shell.appShell.requestInProgress': '{label}-Anfrage läuft',
  'shell.appShell.cleaningSequences': 'Reinigungssequenzen',
  'shell.appShell.cleaning': 'Reinigung',
  'shell.appShell.settings': 'Einstellungen',

  // StatusPill.tsx
  'shell.status.ready': 'bereit',
  'shell.status.heating': 'Aufheizen',
  'shell.status.notHeating': 'Heizt nicht',
  'shell.status.thirsty': 'Durstig',
  'shell.status.sleeping': 'schlafmodus',
  'shell.status.disconnected': 'getrennt',
  'shell.status.connecting': 'verbindet',
  'shell.status.demo': 'Demo',
  'shell.status.sourceMachine': 'Maschine',
  'shell.status.sourceData': 'Datenquelle',
  'shell.status.tooltip': '{source}: {status}',
  'shell.status.notHeatingTooltip': 'Die Brühgruppe heizt nicht auf. Prüfe den physischen Netzschalter.',
  'shell.status.checkPowerButton': 'Netzschalter prüfen',
  'shell.status.heatingTooltip': 'Maschine heizt auf',
  'shell.status.thirstyTooltip': 'Wassertank braucht Wasser',

  // FullscreenPrompt.tsx / FullscreenToggle.tsx
  'shell.fullscreen.addToHomeScreenTitle': 'Zum Home-Bildschirm hinzufügen',
  'shell.fullscreen.addToHomeScreenBody': 'Tippe auf Teilen und dann auf „Zum Home-Bildschirm“, für die beste Vollbildansicht.',
  'shell.fullscreen.gotIt': 'Verstanden',
  'shell.fullscreen.recommendedTitle': 'Vollbild empfohlen',
  'shell.fullscreen.recommendedBody': 'Nutze den Vollbildmodus, damit deine Bedienelemente mehr Platz haben.',
  'shell.fullscreen.error': 'Vollbild konnte nicht geöffnet werden. Du kannst normal weitermachen.',
  'shell.fullscreen.opening': 'Öffnet …',
  'shell.fullscreen.enter': 'Vollbild aktivieren',
  'shell.fullscreen.exit': 'Vollbild beenden',
  'shell.fullscreen.later': 'Später',

  // domain/valueAdjustments.ts — titles read by Settings, Brew, Builder too
  'shell.adjust.hotWaterVolume.title': 'Heißwasser-Volumen',
  'shell.adjust.hotWaterTemperature.title': 'Heißwasser-Temperatur',
  'shell.adjust.steamTemperature.title': 'Dampf-Zieltemperatur',
  'shell.adjust.hotWaterDuration.title': 'Heißwasser Max. Dauer',
  'shell.adjust.steamDuration.title': 'Dampfdauer',
  'shell.adjust.steamFlow.title': 'Dampf-Durchfluss',
  'shell.adjust.temperature.title': 'Brühtemperatur',
  'shell.adjust.grindSetting.title': 'Mahlgrad',
  'shell.adjust.dose.title': 'Dosis',
  'shell.adjust.targetYield.title': 'Menge',
  'shell.adjust.builderPressure.title': 'Druck',
  'shell.adjust.builderFlow.title': 'Durchfluss',
  'shell.adjust.builderTemperature.title': 'Temperatur',
  'shell.adjust.builderDuration.title': 'Max. Zeit',
  'shell.adjust.builderVolume.title': 'Weiter bei Volumen',
  'shell.adjust.builderYield.title': 'Weiter bei Menge',

  // ValueAdjustmentProvider.tsx
  'shell.adjust.cancel': 'Abbrechen',
  'shell.adjust.save': 'Speichern',
  'shell.adjust.adjustAria': '{label} anpassen',
  'shell.adjust.optionsAria': '{label}-Optionen',
  'shell.adjust.enterWithKeypadAria': '{label} über Tastenfeld eingeben',
  'shell.adjust.valueAnnouncement': '{label}, {value}',
  'shell.adjust.emptyValue': 'leer',
  'shell.adjust.maxError': 'Maximum ist {max}.',
  'shell.adjust.minError': 'Minimum ist {min}.',
  'shell.adjust.requiredError': 'Gib eine Zahl ein.',
  'shell.adjust.gestureTip': 'Mit zwei Fingern wischen für Schritte von 10, mit drei Fingern für Schritte von 100.',
  'shell.adjust.suggestionsAria': '{label}-Vorschläge',
  'shell.adjust.typicalRatiosAria': '{label}, typische Verhältnisse',

  // NumericKeypad.tsx
  'shell.adjust.keypadAria': '{label} eingeben',
  'shell.adjust.deleteLastDigit': 'Letzte Ziffer löschen',
  'shell.adjust.decimalPoint': 'Dezimalzeichen',
  'shell.adjust.dismissKeypad': 'Zifferntastatur schließen',

  // Metric.tsx
  'shell.adjust.editMetricAria': '{label} bearbeiten, aktueller Wert {value}{unit}',

  // MachineUtilityCard.tsx / DrinkUtilityCard.tsx
  'shell.machine.expandToView': 'Bedienfelder erweitern, um {label} zu sehen',
  'shell.machine.disableSteamHeating': 'Dampfheizung ausschalten',
  'shell.machine.enableSteamHeating': 'Dampfheizung einschalten',
  'shell.machine.steamTemperatureAria': 'Dampftemperatur',
  'shell.machine.steamGaugeValueText': '{current} aktuell, {target} Ziel',
  'shell.machine.steamHeatingOff': 'Dampfheizung aus',
  'shell.machine.off': 'Aus',
  'shell.machine.offLower': 'aus',
  'shell.machine.editSteamTemperatureAria': 'Dampftemperatur bearbeiten, aktuell {current}, Ziel {target}',

  // MachineUtilityCard.tsx — reservoir
  'shell.tank.needsWater': 'Wassertank braucht Wasser, {value}',
  'shell.tank.low': 'Wassertank wird knapp, {value}',
  'shell.tank.status': 'Wassertank, {value}',
  'shell.tank.unknownLevel': 'unbekannter Füllstand',

  // MachineUtilityCard.tsx / ScaleDevicePicker.tsx — scale
  'shell.scale.searching': 'Sucht …',
  'shell.scale.search': 'Suchen',
  'shell.scale.tareTitle': 'Waage tarieren',
  'shell.scale.tareAria': 'Waage tarieren, aktuelles Gewicht {value}{unit}',
  'shell.scale.selectTitle': 'Waage zum Verbinden auswählen',
  'shell.scale.devicesFound': { one: '{count} Gerät gefunden', other: '{count} Geräte gefunden' },
  'shell.scale.connectAria': '{name} verbinden',
  'shell.scale.connecting': 'Verbindet …',

  // LiveUtilityOperationOverlay.tsx
  'shell.liveOperation.hotWater': 'Heißwasser läuft',
  'shell.liveOperation.steaming': 'Dampfen',
  'shell.liveOperation.flushing': 'Spült',
  "shell.liveOperation.targetTemperature": "Zieltemperatur",

  // SleepWakeScreen.tsx
  'shell.sleep.wakeAria': 'Mit einem Finger 1 Sekunde halten, um die Maschine aufzuwecken',
  'shell.sleep.touchAndHold': 'Berühren und halten zum Aufwecken',

  // DecaidUpdatePrompt.tsx
  'shell.updates.title': 'Decaid-Update verfügbar',
  'shell.updates.description': 'Version {version} steht mit den neuesten Verbesserungen und Fehlerbehebungen bereit.',
  'shell.updates.newerVersionFallback': 'eine neuere Version',
  'shell.updates.installedVersion': 'Installierte Version {version}',
  'shell.updates.downloadingAria': 'Update wird heruntergeladen, {progress}% abgeschlossen',
  'shell.updates.downloading': 'Lädt herunter … {progress}%',
  'shell.updates.installing': 'Installationsprogramm wird geöffnet …',
  'shell.updates.close': 'Schließen',
  'shell.updates.later': 'Später',
  'shell.updates.updating': 'Aktualisiert …',
  'shell.updates.updateDecaid': 'Decaid aktualisieren',
  'shell.updates.viewDownload': 'Download ansehen',
  'shell.updates.installFailed': 'Das Update konnte nicht gestartet werden.',
  'shell.updates.connectionLost': 'Bestpresso hat die Verbindung zu Decaid verloren. Versuch es gleich noch einmal.',

  // CleaningSequencePicker.tsx
  'shell.cleaning.title': 'Reinigung',
  'shell.cleaning.tapHint': 'Tippe an deiner Maschine auf %ICON%, um zu starten.',
  'shell.cleaning.selectProfile': 'Wähle ein Reinigungsprofil aus.',
  'shell.cleaning.loading': 'Reinigungsprofil wird geladen …',
  'shell.cleaning.loadError': 'Konnte nicht geladen werden. Wähle ein Profil, um es erneut zu versuchen.',
  'shell.cleaning.close': 'Schließen',
  'shell.cleaning.empty': 'Es sind noch keine Reinigungssequenzen verfügbar.',

  // api/decaid/adapters.ts — shot stage fallback names
  'shell.brewStage.preinfusion': 'Präinfusion',
  'shell.brewStage.cooling': 'Abkühlen',
  'shell.brewStage.extraction': 'Extraktion',
  'shell.brewStage.stageNumber': 'Phase {n}',

  // api/decaid/adapters.ts — profile title fallbacks
  'shell.profile.untitled': 'Unbenanntes Profil',
  'shell.profile.previousPull': 'Letzter Bezug',
} satisfies Translation<typeof shellEn>
