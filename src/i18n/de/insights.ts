import type { insightsEn } from '../en/insights.ts'
import type { Translation } from '../types.ts'

export const insightsDe = {
  'insights.profile.unknown': 'Unbekanntes Profil',
  // Shared across insights + history contexts
  'insights.common.close': 'Schließen',
  'insights.common.retry': 'Erneut versuchen',
  'insights.common.duration': 'Dauer',
  'insights.common.yield': 'Menge',
  'insights.common.savedInDecaid': 'In Decaid gespeichert',
  'insights.common.brewsPct': { one: '{count} Bezug · {pct}%', other: '{count} Bezüge · {pct}%' },

  // Shot detail overlay
  'insights.detail.loadError': 'Dieses Diagramm ist auf diesem Gerät nicht gespeichert oder nicht mehr verfügbar. Mit Decaid verbinden und erneut versuchen.',
  'insights.detail.offlineBanner': 'Offline · gespeichertes Diagramm',
  'insights.detail.fallbackTitle': 'Bezugsdetails',
  'insights.detail.connectToLoad': 'Mit Decaid verbinden, um diesen Bezug zu laden.',
  'insights.detail.loadingShot': 'Gespeicherter Bezug wird geladen…',

  // Period / filter text
  'insights.period.latestSavedRecords': 'Neueste {count} gespeicherte Einträge',
  'insights.filter.all': 'Alle Bezüge',
  'insights.filter.selectedProfile': 'Ausgewähltes Profil',

  // Recorded-brews table
  'insights.table.ariaLabel': 'Erfasste Bezüge',
  'insights.table.when': 'Wann',
  'insights.table.profile': 'Profil',
  'insights.table.dose': 'Dosis',
  'insights.table.analysis': 'Analyse',
  'insights.table.rowAriaLabel': '{profile} analysieren, {date} um {time}',
  'insights.table.emptyNoCache': 'Die Historie erscheint, sobald Decaid verbunden ist.',
  'insights.table.emptyNoMatches': 'Keine gespeicherten Bezüge passen zu dieser Ansicht.',

  // Rail / navigation
  'insights.nav.closeLabel': 'Auswertung schließen',
  'insights.nav.navigationAriaLabel': 'Auswertungsnavigation',
  'insights.nav.eyebrow': 'DEINE BEZÜGE',
  'insights.nav.overview': 'Übersicht',
  'insights.nav.history': 'Historie',
  'insights.nav.latestRecords': 'Neueste {count} Einträge',
  'insights.nav.cachedOnDevice': 'Auf diesem Gerät zwischengespeichert',

  // Section headings
  'insights.heading.overview': 'Deine Bezüge',
  'insights.heading.history': 'Historie',

  // Header controls
  'insights.controls.drinkTypeLabel': 'Getränkeart',
  'insights.controls.periodLabel': 'Zeitraum',
  'insights.controls.lastDays': 'Letzte {days} Tage',
  'insights.controls.allCachedHistory': 'Gesamte gespeicherte Historie',

  // Drink type names
  'insights.drink.espresso': 'Espresso',
  'insights.drink.pourover': 'Pour-over',
  'insights.drink.other': 'Sonstige / unbekannt',
  'insights.drink.all': 'Alle erfassten Aktivitäten',
  'insights.drink.allOption': 'Alle Aktivitäten',

  // Sync status banner
  'insights.sync.recordsSaved': '{shown} von {total} Einträgen gespeichert',
  'insights.sync.storageWarning': 'Offline-Speicher ist nicht verfügbar. Die Daten dieser Sitzung überstehen das Schließen der App möglicherweise nicht.',
  'insights.sync.limitedCoverage': 'Eingeschränkte Datenabdeckung — es werden gespeicherte Einträge angezeigt, kein vollständiger Zeitraum.',
  'insights.sync.notEnoughHistory': 'Nicht genug Historie für einen Vergleich.',
  'insights.sync.refresh': 'Aktualisieren',

  // Overview: by-day chart
  'insights.overview.byDay': 'Nach Tag',
  'insights.overview.weekdayChartAriaLabel': 'Bezüge nach Wochentag',
  'insights.overview.weekdayAriaLabel': '{weekday}, {period}: {count} gespeicherte Bezüge. Bezüge ansehen',
  'insights.overview.weekdayAriaLabelComparison': '{weekday}, {period}: {count} gespeicherte Bezüge. {priorPeriod}: {priorCount}. Bezüge ansehen',

  // Overview: period metrics
  'insights.metrics.sectionAriaLabel': 'Zusammenfassung des Zeitraums',
  'insights.metrics.brews': 'Bezüge',
  'insights.metrics.brewsChange': '{delta} ggü. {period}',
  'insights.metrics.cachedRecordsOnly': 'Nur gespeicherte Einträge',
  'insights.metrics.brewingDays': 'Tage mit Bezug',
  'insights.metrics.brewingDaysHint': 'Ein Tag mit mindestens einem Bezug',
  'insights.metrics.typicalYield': 'Typische Menge',
  'insights.metrics.needsReadings': 'Braucht 5 Messwerte',
  'insights.metrics.readingsOf': '{coverage}/{count} Messwerte',
  'insights.metrics.mostUsedProfile': 'Meistgenutztes Profil',
  'insights.metrics.noBrewsInView': 'Keine Bezüge in dieser Ansicht',

  // Overview: profiles panel
  'insights.profiles.heading': 'Profile, zu denen du zurückkehrst',
  'insights.profiles.subheading': 'Gruppiert nach Profilname',
  'insights.profiles.allBrews': 'Alle Bezüge ↗',

  // Overview: story panel
  'insights.story.eyebrowChanging': 'WAS SICH ÄNDERT',
  'insights.story.eyebrowPattern': 'DEIN MUSTER',
  'insights.story.headingChanging': 'Ein neuer Favorit zeichnet sich ab.',
  'insights.story.headingActive': 'Deine Bezüge, einer nach dem anderen.',
  'insights.story.headingEmpty': 'Dein nächster Bezug beginnt die Geschichte.',
  'insights.story.changingBody': '{profile} taucht in {pct}% der Bezüge dieses Zeitraums auf, gegenüber {priorPct}% zuvor.',
  'insights.story.staticBody': 'Entdecke die erfassten Bezüge hinter diesen Zahlen. Vergleiche erscheinen, sobald beide Zeiträume abgedeckt sind.',
  'insights.story.cachedBrewsCount': '{count} gespeicherte Bezüge · {period}',
  'insights.story.exploreBrews': 'Diese Bezüge entdecken ↗',

  // Overview: recent brews
  'insights.recent.heading': 'Hinter den Zahlen',
  'insights.recent.viewAllHistory': 'Gesamte Historie ansehen ↗',

  // History list section
  'insights.history.clearFilterAriaLabel': 'Filter zurücksetzen',
  'insights.history.searchLabel': 'Profile suchen',
  'insights.history.recordedBrewsCount': '{count} erfasste Bezüge',
  'insights.history.yieldReadingsCount': '{count} mit Mengenwerten',
  'insights.history.tapToAnalyse': 'Bezug antippen, um zu analysieren ↗',
  'insights.history.shownCount': '{visible} von {total} angezeigt',
  'insights.history.showMore': 'Weitere Bezüge anzeigen',

  // Footnote
  'insights.footnote.main': 'Nur lesend · {timezone} · Die Dosis stammt vom gespeicherten Bezug und kann eine Zielvorgabe statt einer gemessenen Dosis sein. Die Dauer verwendet gespeicherte Messwerte; fehlende Zeiten bleiben —. Fehlende ältere Mengenwerte laden mit dem Diagramm nach. Bekannte Reinigungs-/Kalibrierdatensätze sind von den Getränke-Summen ausgeschlossen; ältere Einträge erkennen Simulationen möglicherweise nicht.',
  'insights.footnote.omitted': '{count} Einträge haben kein verwendbares Datum oder keine ID.',

  // "By hour" coxcomb chart
  'insights.coxcomb.sectionAriaLabel': 'Bezüge über 24 Stunden',
  'insights.coxcomb.heading': 'Nach Stunde',
  'insights.coxcomb.periodGroupAriaLabel': 'Zeitraum des Stundendiagramms',
  'insights.coxcomb.chartAriaLabel': '{period}: Bezüge in Zweistundenfenstern, im Uhrzeigersinn mit Mittag oben und Mitternacht unten. Der hellere Bereich ist 6 bis 18 Uhr, der dunklere Bereich ist die Nacht. Die Sektorfläche stellt die Anzahl dar; beide Zeiträume nutzen denselben Maßstab.',
  'insights.coxcomb.sectorAriaLabel': { one: '{period}, {range}: {count} Bezug', other: '{period}, {range}: {count} Bezüge' },
  'insights.coxcomb.brewWord': { one: 'Bezug', other: 'Bezüge' },
  'insights.coxcomb.allDay': '24 h',
  'insights.coxcomb.allDayAriaLabel': '24 Stunden',
  'insights.coxcomb.viewBrewsAriaLabel': 'Bezüge ansehen: {selection}',

  // Home entry cards (Insights + latest shot)
  'insights.home.sectionAriaLabel': 'Auswertung und letzter Bezug',
  'insights.home.openInsightsAriaLabel': 'Auswertung öffnen',
  'insights.home.periodContext': 'Espresso-Bezüge von heute und den vorangegangenen sechs Tagen. Heute ist noch nicht abgeschlossen. Die durchschnittliche Menge nutzt {coverage} von {count} gespeicherten Messwerten.',
  'insights.home.dayAriaLabel': '{weekday} {date}: {count} gespeicherte Bezüge',
  'insights.home.periodLine1': 'Letzte 7 Tage',
  'insights.home.periodLine2': 'Auswertung',
  'insights.home.shotsLabel': 'Bezüge',
  'insights.home.cachedShotsLabel': 'Gespeicherte Bezüge',
  'insights.home.avgYield': 'Ø Menge',
  'insights.home.noSavedBrews': 'Noch keine gespeicherten Bezüge',
  'insights.home.waitingForHistory': 'Warte auf gespeicherte Historie',
  'insights.home.openLatestShotAriaLabel': 'Letzten Bezug öffnen: {name}',
  'insights.home.openBrewHistoryAriaLabel': 'Historie öffnen',
  'insights.home.dateTimeLabel': '{date}, {time}',

  // HistoryPanel (compact card)
  'insights.historyPanel.loading': 'Historie wird geladen…',
  'insights.historyPanel.emptyNoCups': 'Du hast noch keine Tasse gefüllt',
  'insights.historyPanel.error': 'Historie nicht verfügbar',
  'insights.historyPanel.openAriaLabel': 'Historie öffnen: {profile}',
  'insights.historyPanel.totalYield': 'Gesamtmenge',
  'insights.historyPanel.totalTime': 'Gesamtzeit',
  'insights.historyPanel.today': 'Heute, {time}',
  'insights.historyPanel.lastPull': 'Letzter Bezug',

  // PreviousShotScreen (full browser / detail)
  'insights.previousShot.dateUnavailable': 'Datum nicht verfügbar',
  'insights.previousShot.title': 'Historie',
  'insights.previousShot.findingPulls': 'Deine Bezüge werden gesucht…',
  'insights.previousShot.noCupsYet': 'Du hast noch keine Tasse gefüllt.',
  'insights.previousShot.fallbackTitle': 'Historie',
  'insights.previousShot.chartAriaLabelWeight': 'Historie: {profile}',
  'insights.previousShot.chartAriaLabelGeneric': 'Historien-Diagramm',
  'insights.previousShot.loadError': 'Dieser Bezug konnte nicht geladen werden. Bitte erneut auswählen.',

  // MiniShotChart
  "insights.miniChart.ariaLabelWeight": "Diagramm: Druck, Durchfluss und Bezugsfluss des vorherigen Bezugs",
  'insights.miniChart.ariaLabelCleaning': 'Diagramm: Druck und Durchfluss der vorherigen Reinigung',

  // Background sync / chart status
  'insights.status.unavailableRetrying': 'Historie nicht verfügbar · wird automatisch erneut versucht',
  'insights.status.loading': 'Historie wird geladen…',
  'insights.status.showingSavedRetrying': 'Zeigt gespeicherte Historie · wird automatisch erneut versucht',
  'insights.status.limitedCached': 'Eingeschränkte Historie · gespeicherte Einträge',
  'insights.chart.unavailableRetrying': 'Diagramm nicht verfügbar · wird automatisch erneut versucht',
  'insights.chart.retrying': 'Diagramm wird erneut versucht…',
  'insights.chart.empty': 'Kein Diagramm für diesen Bezug gespeichert',
  'insights.chart.loading': 'Diagramm wird geladen…',
  'insights.period.dayMonth': '{day}. {month}',
  'insights.period.dayOnly': '{day}.',
} satisfies Translation<typeof insightsEn>
