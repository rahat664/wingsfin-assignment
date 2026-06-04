import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { getMarketHistory, getMarketStatus } from './api';
import { MarketChart } from './components/MarketChart';
import { socket } from './socket';
import type {
  ChartPoint,
  ChartSelection,
  HistoryResponse,
  LiveTickEvent,
  MarketSessionConfig,
} from './types';
import {
  extendSeriesToCurrentMinute,
  getLatestRealPoint,
  mergeLiveTick,
  padToMarketClose,
} from './utils/marketSeries';

const CHART_OPTIONS: Record<'INDEX' | 'STOCK', ChartSelection> = {
  INDEX: {
    label: 'Index view - DSEX',
    type: 'INDEX',
    symbol: 'DSEX',
  },
  STOCK: {
    label: 'Stock view - GP',
    type: 'STOCK',
    symbol: 'GP',
  },
};

const MARKET_TIME_OPTIONS = [
  { value: '08:30', label: '08:30 AM - Early session' },
  { value: '09:00', label: '09:00 AM - Morning session' },
  { value: '09:30', label: '09:30 AM - Pre-open window' },
  { value: '10:00', label: '10:00 AM - Market opens' },
  { value: '10:30', label: '10:30 AM - Active trading' },
  { value: '11:00', label: '11:00 AM - Active trading' },
  { value: '11:30', label: '11:30 AM - Mid-morning' },
  { value: '12:00', label: '12:00 PM - Midday' },
  { value: '12:30', label: '12:30 PM - Lunch window' },
  { value: '13:00', label: '01:00 PM - Afternoon session' },
  { value: '13:30', label: '01:30 PM - Afternoon session' },
  { value: '14:00', label: '02:00 PM - Late session' },
  { value: '14:30', label: '02:30 PM - Market closes' },
  { value: '20:00', label: '08:00 PM - Extended close' },
  { value: '15:00', label: '03:00 PM - Post-close buffer' },
  { value: '15:30', label: '03:30 PM - Extended buffer' },
];

const MARKET_TIME_ZONE_OPTIONS = [
  { value: 'Asia/Dhaka', label: 'Bangladesh Time (Asia/Dhaka)' },
  { value: 'Asia/Kolkata', label: 'India Time (Asia/Kolkata)' },
  { value: 'Asia/Singapore', label: 'Singapore Time (Asia/Singapore)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'Europe/London', label: 'London Time (Europe/London)' },
  { value: 'America/New_York', label: 'New York Time (America/New_York)' },
];

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

function formatDateTime(value?: string | null, timeZone?: string) {
  if (!value) return '--';

  return new Intl.DateTimeFormat([], {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value));
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '--';
  return numberFormatter.format(value);
}

function formatDelta(value: number | null, percentage: number | null) {
  if (value === null) return '--';

  const signedValue = value > 0 ? `+${numberFormatter.format(value)}` : numberFormatter.format(value);

  if (percentage === null) {
    return signedValue;
  }

  const signedPercentage =
    percentage > 0
      ? `+${percentage.toFixed(2)}%`
      : `${percentage.toFixed(2)}%`;

  return `${signedValue} (${signedPercentage})`;
}

function App() {
  const [selectedKey, setSelectedKey] = useState<'INDEX' | 'STOCK'>('INDEX');
  const [sessionSettings, setSessionSettings] = useState<MarketSessionConfig | null>(null);
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [marketOpen, setMarketOpen] = useState(true);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(true);
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);

  const selectedChart = useMemo(() => CHART_OPTIONS[selectedKey], [selectedKey]);
  const sessionOpenValue = sessionSettings?.openTime ?? '10:00';
  const sessionCloseValue = sessionSettings?.closeTime ?? '20:00';
  const sessionTimeZoneValue = sessionSettings?.timeZone ?? 'Asia/Dhaka';

  const latestPoint = useMemo(() => getLatestRealPoint(points), [points]);
  const latestValue = latestPoint?.value ?? history?.latestValue ?? null;
  const yesterdayClose = latestPoint?.yesterdayClose ?? history?.yesterdayClose ?? null;
  const valueDelta =
    latestValue !== null && yesterdayClose !== null ? latestValue - yesterdayClose : null;
  const valueDeltaPct =
    valueDelta !== null && yesterdayClose ? (valueDelta / yesterdayClose) * 100 : null;
  const livePointCount = points.filter((point) => !point.isFuture && point.value !== null).length;
  const totalPoints = history?.totalPoints ?? points.length;
  const lastUpdatedLabel = formatDateTime(
    latestPoint?.time ?? history?.currentTime ?? null,
    sessionSettings?.timeZone,
  );
  const sessionLabel = sessionSettings
    ? `${sessionSettings.openTime} - ${sessionSettings.closeTime} (${sessionSettings.timeZone})`
    : '--';
  const canUseLiveFeed = marketOpen && !statusLoading && sessionSettings !== null;

  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      setStatusLoading(true);

      try {
        const status = await getMarketStatus();

        if (!isMounted) return;

        setSessionSettings({
          openTime: status.openTime,
          closeTime: status.closeTime,
          timeZone: status.timezone,
        });
      } catch (error) {
        console.error(error);

        if (isMounted) {
          setSessionSettings({
            openTime: '10:00',
            closeTime: '20:00',
            timeZone: 'Asia/Dhaka',
          });
        }
      } finally {
        if (isMounted) {
          setStatusLoading(false);
        }
      }
    }

    loadStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionSettings) return;

    const activeSessionSettings = sessionSettings;
    let isMounted = true;

    async function loadHistory() {
      setLoading(true);
      setMessage('');

      try {
        const data = await getMarketHistory(
          selectedChart.type,
          selectedChart.symbol,
          activeSessionSettings,
        );

        if (!isMounted) return;

        setHistory(data);
        setMarketOpen(data.marketOpen);

        if (!data.marketOpen) {
          setPoints([]);
          setMessage(data.message ?? 'Market is closed.');
          return;
        }

        setPoints(padToMarketClose(data.points, activeSessionSettings.closeTime));
      } catch (error) {
        console.error(error);

        if (isMounted) {
          setHistory(null);
          setMessage('Could not load market history.');
          setPoints([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [selectedChart.type, selectedChart.symbol, sessionSettings]);

  useEffect(() => {
    if (!canUseLiveFeed) return;

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('market.subscribe', {
      type: selectedChart.type,
      symbol: selectedChart.symbol,
    });

    function handleTick(tick: LiveTickEvent) {
      if (tick.type !== selectedChart.type || tick.symbol !== selectedChart.symbol) {
        return;
      }

      setPoints((currentPoints) =>
        mergeLiveTick(currentPoints, tick, sessionSettings?.closeTime),
      );
      setHistory((currentHistory) =>
        currentHistory
          ? {
              ...currentHistory,
              latestValue: tick.value,
              yesterdayClose: tick.yesterdayClose,
              currentTime: tick.time,
            }
          : currentHistory,
      );
    }

    socket.on('market.tick', handleTick);

    return () => {
      socket.emit('market.unsubscribe', {
        type: selectedChart.type,
        symbol: selectedChart.symbol,
      });

      socket.off('market.tick', handleTick);
    };
  }, [canUseLiveFeed, selectedChart.type, selectedChart.symbol, sessionSettings?.closeTime]);

  useEffect(() => {
    if (!canUseLiveFeed) return;

    const timer = window.setInterval(() => {
      setPoints((currentPoints) =>
        extendSeriesToCurrentMinute(currentPoints, sessionSettings?.closeTime),
      );
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [canUseLiveFeed, sessionSettings?.closeTime]);

  useEffect(() => {
    let rafId = 0;

    const updateHeaderState = () => {
      rafId = window.requestAnimationFrame(() => {
        setIsHeaderCompact(window.scrollY > 18);
      });
    };

    updateHeaderState();
    window.addEventListener('scroll', updateHeaderState, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateHeaderState);
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <main className="app-shell">
      <header className={`topbar ${isHeaderCompact ? 'topbar--compact' : ''}`}>
        <div className="brand-lockup">
          <span className="brand-mark">WF</span>
          <div>
            <p className="eyebrow">WingsFin Take-Home Assignment</p>
            <h1>Real-Time Market Data Visualization</h1>
          </div>
        </div>

        <div className="topbar-meta">
          <span
            className={`status-pill ${marketOpen ? 'status-pill--live' : 'status-pill--muted'}`}
          >
            <span className="status-dot" />
            {statusLoading
              ? 'Loading session settings'
              : marketOpen
                ? 'Live market feed'
                : 'Market closed'}
          </span>

          <label
            className="select-field select-field--premium select-field--floating"
            htmlFor="chart-type"
            data-filled="true"
          >
            <span>Chart view</span>
            <small className="select-field__helper">Choose the instrument to inspect</small>
            <select
              id="chart-type"
              value={selectedKey}
              onChange={(event) => setSelectedKey(event.target.value as 'INDEX' | 'STOCK')}
            >
              {Object.entries(CHART_OPTIONS).map(([key, option]) => (
                <option key={key} value={key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <section className="surface-panel session-panel" aria-label="Market session settings">
        <div className="session-panel__header">
          <div>
            <span className="eyebrow">Session controls</span>
            <h2>Adjust market hours and timezone</h2>
          </div>
          <p>
            Change the open/close window and timezone, then the chart will reload against the
            selected market session.
          </p>
        </div>

        <div className="session-panel__grid">
          <label
            className="select-field select-field--premium select-field--floating"
            htmlFor="market-open-time"
            data-filled="true"
          >
            <span>Market open</span>
            <small className="select-field__helper">Pick the start of the active session</small>
            <select
              id="market-open-time"
              value={sessionOpenValue}
              onChange={(event) =>
                setSessionSettings((current) => ({
                  openTime: event.target.value,
                  closeTime: current?.closeTime ?? sessionCloseValue,
                  timeZone: current?.timeZone ?? sessionTimeZoneValue,
                }))
              }
              disabled={statusLoading}
            >
              {MARKET_TIME_OPTIONS.map((time) => (
                <option key={time.value} value={time.value}>
                  {time.label}
                </option>
              ))}
            </select>
          </label>

          <label
            className="select-field select-field--premium select-field--floating"
            htmlFor="market-close-time"
            data-filled="true"
          >
            <span>Market close</span>
            <small className="select-field__helper">Pick the end of the active session</small>
            <select
              id="market-close-time"
              value={sessionCloseValue}
              onChange={(event) =>
                setSessionSettings((current) => ({
                  openTime: current?.openTime ?? sessionOpenValue,
                  closeTime: event.target.value,
                  timeZone: current?.timeZone ?? sessionTimeZoneValue,
                }))
              }
              disabled={statusLoading}
            >
              {MARKET_TIME_OPTIONS.map((time) => (
                <option key={time.value} value={time.value}>
                  {time.label}
                </option>
              ))}
            </select>
          </label>

          <label
            className="select-field select-field--premium select-field--floating"
            htmlFor="market-time-zone"
            data-filled="true"
          >
            <span>Timezone</span>
            <small className="select-field__helper">Match the chart to the local market clock</small>
            <select
              id="market-time-zone"
              value={sessionTimeZoneValue}
              onChange={(event) =>
                setSessionSettings((current) => ({
                  openTime: current?.openTime ?? sessionOpenValue,
                  closeTime: current?.closeTime ?? sessionCloseValue,
                  timeZone: event.target.value,
                }))
              }
              disabled={statusLoading}
            >
              {MARKET_TIME_ZONE_OPTIONS.map((zone) => (
                <option key={zone.value} value={zone.value}>
                  {zone.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="hero-grid">
        <div className="surface-panel hero-copy">
          <div className="hero-copy__header">
            <span className="eyebrow">Live chart console</span>
            <span
              className={`mini-badge ${marketOpen ? 'mini-badge--live' : 'mini-badge--muted'}`}
            >
              {statusLoading
                ? 'Loading session settings'
                : marketOpen
                  ? 'Socket subscription active'
                  : 'Historical view'}
            </span>
          </div>

          <p className="subtitle">
            Irregular market updates are normalized into a 1-minute chart timeline with
            forward-filled values, so the chart stays readable even when ticks arrive at uneven
            intervals.
          </p>

          <div className="hero-points">
            <article>
              <span>Session</span>
              <strong>{sessionLabel}</strong>
            </article>
            <article>
              <span>Points</span>
              <strong>{compactNumberFormatter.format(totalPoints)}</strong>
            </article>
            <article>
              <span>Last update</span>
              <strong>{lastUpdatedLabel}</strong>
            </article>
            <article>
              <span>Visible live points</span>
              <strong>{compactNumberFormatter.format(livePointCount)}</strong>
            </article>
          </div>
        </div>

        <aside className="surface-panel stats-panel">
          <div className="stats-grid">
            <article className="stat-card stat-card--accent">
              <span>Latest value</span>
              <strong>{formatNumber(latestValue)}</strong>
              <p>{selectedChart.label}</p>
            </article>
            <article className="stat-card">
              <span>Yesterday close</span>
              <strong>{formatNumber(yesterdayClose)}</strong>
              <p>Reference line on the chart</p>
            </article>
            <article className="stat-card">
              <span>Change</span>
              <strong>{formatDelta(valueDelta, valueDeltaPct)}</strong>
              <p>Compared with yesterday close</p>
            </article>
            <article className="stat-card">
              <span>Refresh cadence</span>
              <strong>1 second</strong>
              <p>Forward-fills minute gaps</p>
            </article>
          </div>

          <div className="insight-box">
            <p className="insight-box__label">What the UI emphasizes</p>
            <ul>
              <li>Clear market state and session context</li>
              <li>One select control for accessible chart switching</li>
              <li>Consistent spacing, surfaces, and visual hierarchy</li>
            </ul>
          </div>
        </aside>
      </section>

      {!marketOpen ? (
        <section className="surface-panel empty-state empty-state--warning" aria-live="polite">
          <div>
            <span className="mini-badge mini-badge--muted">Market closed</span>
            <h2>Historical data is still available</h2>
            <p>{message}</p>
          </div>
        </section>
      ) : message ? (
        <section className="surface-panel empty-state empty-state--warning" aria-live="polite">
          <div>
            <span className="mini-badge mini-badge--muted">Notice</span>
            <h2>Unable to load chart data</h2>
            <p>{message}</p>
          </div>
        </section>
      ) : (
        <MarketChart
          title={selectedChart.label}
          symbol={selectedChart.symbol}
          points={points}
          totalPoints={totalPoints}
          lastUpdatedLabel={lastUpdatedLabel}
          isLoading={loading || statusLoading}
          marketOpen={marketOpen}
          timeZone={sessionSettings?.timeZone}
        />
      )}
    </main>
  );
}

export default App;
