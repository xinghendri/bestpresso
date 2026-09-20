/** Brewing insights (Auswertung), shot history (Historie) and the previous-shot browser. */
export const insightsEn = {
  'insights.profile.unknown': 'Unknown profile',
  // Shared across insights + history contexts
  'insights.common.close': 'Close',
  'insights.common.retry': 'Retry',
  'insights.common.duration': 'Duration',
  'insights.common.yield': 'Yield',
  'insights.common.savedInDecaid': 'Saved in Decaid',
  'insights.common.brewsPct': { one: '{count} brew · {pct}%', other: '{count} brews · {pct}%' },

  // Shot detail overlay
  'insights.detail.loadError': 'This graph isn’t saved on this device yet, or is no longer available. Connect to Decaid and retry.',
  'insights.detail.offlineBanner': 'Offline · saved graph',
  'insights.detail.fallbackTitle': 'Shot detail',
  'insights.detail.connectToLoad': 'Connect to Decaid to load this shot.',
  'insights.detail.loadingShot': 'Loading recorded shot…',

  // Period / filter text
  'insights.period.latestSavedRecords': 'Latest {count} saved records',
  'insights.filter.all': 'All brews',
  'insights.filter.selectedProfile': 'Selected profile',

  // Recorded-brews table
  'insights.table.ariaLabel': 'Recorded brews',
  'insights.table.when': 'When',
  'insights.table.profile': 'Profile',
  'insights.table.dose': 'Dose',
  'insights.table.analysis': 'Analysis',
  'insights.table.rowAriaLabel': 'Analyse {profile}, {date} at {time}',
  'insights.table.emptyNoCache': 'History will appear once Decaid is connected.',
  'insights.table.emptyNoMatches': 'No saved brews match this view.',

  // Rail / navigation
  'insights.nav.closeLabel': 'Close insights',
  'insights.nav.navigationAriaLabel': 'Insights navigation',
  'insights.nav.eyebrow': 'YOUR BREWING',
  'insights.nav.overview': 'Overview',
  'insights.nav.history': 'History',
  'insights.nav.latestRecords': 'Latest {count} records',
  'insights.nav.cachedOnDevice': 'Cached on this device',

  // Section headings
  'insights.heading.overview': 'Your brewing',
  'insights.heading.history': 'Brew history',

  // Header controls
  'insights.controls.drinkTypeLabel': 'Drink type',
  'insights.controls.periodLabel': 'Period',
  'insights.controls.lastDays': 'Last {days} days',
  'insights.controls.allCachedHistory': 'All cached history',

  // Drink type names
  'insights.drink.espresso': 'Espresso',
  'insights.drink.pourover': 'Pour-over',
  'insights.drink.other': 'Other / unknown',
  'insights.drink.all': 'All recorded activities',
  'insights.drink.allOption': 'All activities',

  // Sync status banner
  'insights.sync.recordsSaved': '{shown} of {total} records saved',
  'insights.sync.storageWarning': 'Offline storage is unavailable. This session’s data may not survive closing the app.',
  'insights.sync.limitedCoverage': 'Limited date coverage — showing cached records, not a complete period.',
  'insights.sync.notEnoughHistory': 'Not enough history for comparison.',
  'insights.sync.refresh': 'Refresh',

  // Overview: by-day chart
  'insights.overview.byDay': 'By day',
  'insights.overview.weekdayChartAriaLabel': 'Brews by weekday',
  'insights.overview.weekdayAriaLabel': '{weekday}, {period}: {count} cached brews. View shots',
  'insights.overview.weekdayAriaLabelComparison': '{weekday}, {period}: {count} cached brews. {priorPeriod}: {priorCount}. View shots',

  // Overview: period metrics
  'insights.metrics.sectionAriaLabel': 'Period summary',
  'insights.metrics.brews': 'Brews',
  'insights.metrics.brewsChange': '{delta} vs {period}',
  'insights.metrics.cachedRecordsOnly': 'Cached records only',
  'insights.metrics.brewingDays': 'Brewing days',
  'insights.metrics.brewingDaysHint': 'A day with at least one brew',
  'insights.metrics.typicalYield': 'Typical yield',
  'insights.metrics.needsReadings': 'Needs 5 yield readings',
  'insights.metrics.readingsOf': '{coverage}/{count} readings',
  'insights.metrics.mostUsedProfile': 'Most-used profile',
  'insights.metrics.noBrewsInView': 'No brews in this view',

  // Overview: profiles panel
  'insights.profiles.heading': 'Profiles you return to',
  'insights.profiles.subheading': 'Grouped by profile name',
  'insights.profiles.allBrews': 'All brews ↗',

  // Overview: story panel
  'insights.story.eyebrowChanging': 'WHAT’S CHANGING',
  'insights.story.eyebrowPattern': 'YOUR PATTERN',
  'insights.story.headingChanging': 'A new go-to is taking shape.',
  'insights.story.headingActive': 'Your brewing, one shot at a time.',
  'insights.story.headingEmpty': 'Your next brew starts the story.',
  'insights.story.changingBody': '{profile} appears in {pct}% of this period’s brews, up from {priorPct}%.',
  'insights.story.staticBody': 'Explore the recorded brews behind these numbers. Comparisons appear when both periods are covered.',
  'insights.story.cachedBrewsCount': '{count} cached brews · {period}',
  'insights.story.exploreBrews': 'Explore these brews ↗',

  // Overview: recent brews
  'insights.recent.heading': 'Behind the numbers',
  'insights.recent.viewAllHistory': 'View all history ↗',

  // History list section
  'insights.history.clearFilterAriaLabel': 'Clear insight filter',
  'insights.history.searchLabel': 'Search profiles',
  'insights.history.recordedBrewsCount': '{count} recorded brews',
  'insights.history.yieldReadingsCount': '{count} with yield readings',
  'insights.history.tapToAnalyse': 'Tap a brew to analyse ↗',
  'insights.history.shownCount': '{visible} of {total} shown',
  'insights.history.showMore': 'Show more brews',

  // Footnote
  'insights.footnote.main': 'Read-only · {timezone} · Dose comes from the saved shot, and may be a target rather than a measured dose. Duration uses saved measurements; unavailable timings remain —. Older missing yield loads with the graph. Known cleaning/calibration records are excluded from drink totals; older records may not identify simulation.',
  'insights.footnote.omitted': '{count} records lack a usable date or ID.',

  // "By hour" coxcomb chart
  'insights.coxcomb.sectionAriaLabel': 'Brewing across 24 hours',
  'insights.coxcomb.heading': 'By hour',
  'insights.coxcomb.periodGroupAriaLabel': 'Time chart period',
  'insights.coxcomb.chartAriaLabel': '{period}: brews in two-hour windows, clockwise with noon at the top and midnight at the bottom. Lighter base is 6 am to 6 pm; darker base is night. Sector area represents count; both periods use the same scale.',
  'insights.coxcomb.sectorAriaLabel': { one: '{period}, {range}: {count} brew', other: '{period}, {range}: {count} brews' },
  'insights.coxcomb.brewWord': { one: 'brew', other: 'brews' },
  'insights.coxcomb.allDay': '24h',
  'insights.coxcomb.allDayAriaLabel': '24 hours',
  'insights.coxcomb.viewBrewsAriaLabel': 'View brews: {selection}',

  // Home entry cards (Insights + latest shot)
  'insights.home.sectionAriaLabel': 'Brewing insights and latest shot',
  'insights.home.openInsightsAriaLabel': 'Open brewing insights',
  'insights.home.periodContext': 'Espresso brews from today and the previous six days. Today is still in progress. Average yield uses {coverage} of {count} saved readings.',
  'insights.home.dayAriaLabel': '{weekday} {date}: {count} cached shots',
  'insights.home.periodLine1': 'Past 7 days',
  'insights.home.periodLine2': 'insight',
  'insights.home.shotsLabel': 'Shots',
  'insights.home.cachedShotsLabel': 'Cached shots',
  'insights.home.avgYield': 'Avg. yield',
  'insights.home.noSavedBrews': 'No saved brews yet',
  'insights.home.waitingForHistory': 'Waiting for saved history',
  'insights.home.openLatestShotAriaLabel': 'Open latest shot: {name}',
  'insights.home.openBrewHistoryAriaLabel': 'Open brew history',
  'insights.home.dateTimeLabel': '{date}, {time}',

  // HistoryPanel (compact card)
  'insights.historyPanel.loading': 'Loading shot history…',
  'insights.historyPanel.emptyNoCups': 'You haven’t filled any cups yet',
  'insights.historyPanel.error': 'Shot history unavailable',
  'insights.historyPanel.openAriaLabel': 'Open shot history: {profile}',
  'insights.historyPanel.totalYield': 'Total yield',
  'insights.historyPanel.totalTime': 'Total time',
  'insights.historyPanel.today': 'Today, {time}',
  'insights.historyPanel.lastPull': 'Last pull',

  // PreviousShotScreen (full browser / detail)
  'insights.previousShot.dateUnavailable': 'Date unavailable',
  'insights.previousShot.title': 'Shot history',
  'insights.previousShot.findingPulls': 'Finding your pulls…',
  'insights.previousShot.noCupsYet': "You haven't filled any cups yet.",
  'insights.previousShot.fallbackTitle': 'Pull history',
  'insights.previousShot.chartAriaLabelWeight': 'Shot history: {profile}',
  'insights.previousShot.chartAriaLabelGeneric': 'Shot history chart',
  'insights.previousShot.loadError': 'That pull couldn’t be loaded. Try selecting it again.',

  // MiniShotChart
  "insights.miniChart.ariaLabelWeight": "Previous shot pressure, flow, and yield flow graph",
  'insights.miniChart.ariaLabelCleaning': 'Previous cleaning pressure and flow graph',

  // Background sync / chart status
  'insights.status.unavailableRetrying': 'History unavailable · retrying automatically',
  'insights.status.loading': 'Loading history…',
  'insights.status.showingSavedRetrying': 'Showing saved history · retrying automatically',
  'insights.status.limitedCached': 'Limited history · cached records',
  'insights.chart.unavailableRetrying': 'Chart unavailable · retrying automatically',
  'insights.chart.retrying': 'Retrying chart…',
  'insights.chart.empty': 'No graph recorded for this shot',
  'insights.chart.loading': 'Loading chart…',
  'insights.period.dayMonth': '{day} {month}',
  'insights.period.dayOnly': '{day}',
} as const
