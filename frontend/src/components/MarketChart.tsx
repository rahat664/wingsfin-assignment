import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartPoint } from '../types';
import { getLatestRealPoint } from '../utils/marketSeries';

const POINT_COLORS = {
  ABOVE: '#7327F5',
  BELOW: '#F52738',
  EQUAL: '#EE27F5',
  NO_DATA: '#94A3B8',
} as const;

type MarketChartProps = {
  title: string;
  symbol: string;
  points: ChartPoint[];
  totalPoints: number;
  lastUpdatedLabel: string;
  timeZone?: string;
  marketOpen?: boolean;
  isLoading?: boolean;
};

function formatTime(value: string | number, timeZone?: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
}

function formatValue(value: number | null | undefined) {
  if (value === null || value === undefined) return '--';
  return value.toFixed(4);
}

function formatSignedValue(value: number | null | undefined) {
  if (value === null || value === undefined) return '--';
  return value > 0 ? `+${value.toFixed(4)}` : value.toFixed(4);
}

function formatSignedPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return '--';
  return value > 0 ? `+${value.toFixed(2)}%` : `${value.toFixed(2)}%`;
}

function CustomDot(props: any) {
  const { cx, cy, payload } = props;

  if (!payload || payload.value === null || payload.isFuture) {
    return null;
  }

  const color = POINT_COLORS[payload.status as keyof typeof POINT_COLORS] ?? POINT_COLORS.NO_DATA;

  return (
    <g>
      {payload.isLatest ? (
        <circle
          cx={cx}
          cy={cy}
          r={12}
          fill="rgba(109, 40, 217, 0.14)"
          className="heartbeat-pulse"
        />
      ) : null}
      <circle
        cx={cx}
        cy={cy}
        r={payload.isLatest ? 5.5 : 4}
        fill={color}
        stroke="#ffffff"
        strokeWidth={2}
      />
    </g>
  );
}

function CustomTooltip(props: any) {
  const { active, payload, label, timeZone } = props;

  if (!active || !payload?.length) return null;

  const point = payload[0].payload as ChartPoint;

  if (point.isFuture || point.value === null) {
    return (
      <div className="chart-tooltip">
        <strong>{formatTime(label, timeZone)}</strong>
        <p className="chart-tooltip__muted">No value yet</p>
      </div>
    );
  }

  const change =
    point.value !== null && point.yesterdayClose !== null
      ? point.value - point.yesterdayClose
      : null;
  const changePercent =
    change !== null && point.yesterdayClose
      ? (change / point.yesterdayClose) * 100
      : null;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__header">
        <strong>{formatTime(label, timeZone)}</strong>
        <span
          className={`chart-tooltip__chip ${
            change === null ? '' : change >= 0 ? 'is-positive' : 'is-negative'
          }`}
        >
          {change === null ? '--' : change >= 0 ? 'Above close' : 'Below close'}
        </span>
      </div>
      <dl>
        <div>
          <dt>Value</dt>
          <dd>{formatValue(point.value)}</dd>
        </div>
        <div>
          <dt>Yesterday close</dt>
          <dd>{formatValue(point.yesterdayClose)}</dd>
        </div>
        <div>
          <dt>Delta</dt>
          <dd>{formatSignedValue(change)}</dd>
        </div>
        <div>
          <dt>Move</dt>
          <dd>{formatSignedPercent(changePercent)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function MarketChart({
  title,
  symbol,
  points,
  totalPoints,
  lastUpdatedLabel,
  timeZone,
  marketOpen = false,
  isLoading = false,
}: MarketChartProps) {
  const latestPoint = getLatestRealPoint(points);
  const yesterdayClose = latestPoint?.yesterdayClose ?? null;
  const latestValue = latestPoint?.value ?? null;
  const change =
    latestValue !== null && yesterdayClose !== null ? latestValue - yesterdayClose : null;
  const changePercent =
    change !== null && yesterdayClose ? (change / yesterdayClose) * 100 : null;
  const changeClass = change === null ? '' : change >= 0 ? 'is-positive' : 'is-negative';
  const visiblePoints = points.filter((point) => !point.isFuture && point.value !== null).length;
  const showChart = !isLoading && points.length > 0;
  const chartAccent = change === null ? 'neutral' : change >= 0 ? 'positive' : 'negative';

  return (
    <section className="surface-panel chart-card chart-card--animated">
      <div className="chart-ambient chart-ambient--one" aria-hidden="true" />
      <div className="chart-ambient chart-ambient--two" aria-hidden="true" />

      <div className="chart-header">
        <div>
          <span className="eyebrow">Live market chart</span>
          <h2>{title}</h2>
          <p>
            {symbol} - {visiblePoints}/{totalPoints} points - updated {lastUpdatedLabel}
          </p>
          {marketOpen && !isLoading && (
            <span className="chart-live-pill" aria-label="Live market indicator">
              Live
            </span>
          )}
        </div>

        <div className="latest-value-box" aria-live="polite">
          <span>Latest</span>
          <strong>{isLoading ? 'Loading' : formatValue(latestValue)}</strong>
          <small className={changeClass}>
            {isLoading
              ? 'Preparing data'
              : change === null
                ? '--'
                : `${change >= 0 ? 'Above' : 'Below'} close`}
          </small>
        </div>
      </div>

      <div className={`chart-metrics chart-metrics--${chartAccent}`}>
        <article>
          <span>Yesterday close</span>
          <strong>{formatValue(yesterdayClose)}</strong>
        </article>
        <article>
          <span>Reference line</span>
          <strong>{isLoading ? 'Initializing' : 'Premium dash overlay'}</strong>
        </article>
        <article>
          <span>Move</span>
          <strong>{isLoading ? '--' : formatSignedPercent(changePercent)}</strong>
        </article>
      </div>

      <div className="chart-wrapper">
        {showChart ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 10, right: 18, left: 0, bottom: 6 }}>
              <defs>
                <linearGradient id="marketLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#7327F5" />
                  <stop offset="100%" stopColor="#EE27F5" />
                </linearGradient>
                <linearGradient id="marketArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(115, 39, 245, 0.32)" />
                  <stop offset="62%" stopColor="rgba(238, 39, 245, 0.10)" />
                  <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
                </linearGradient>
                <filter id="marketGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="7" result="blur" />
                  <feColorMatrix
                    in="blur"
                    type="matrix"
                    values="1 0 0 0 0.43 0 1 0 0 0.16 0 0 1 0 0.77 0 0 0 0.62 0"
                  />
                  <feMerge>
                    <feMergeNode />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <CartesianGrid
                stroke="rgba(148, 163, 184, 0.18)"
                strokeDasharray="4 6"
                vertical={false}
              />

              <XAxis
                dataKey="time"
                tickFormatter={(tick) => formatTime(tick, timeZone)}
                minTickGap={28}
                axisLine={false}
                tickLine={false}
                tickMargin={12}
                tick={{ fill: '#64748b', fontSize: 12 }}
              />

              <YAxis
                domain={['auto', 'auto']}
                tickFormatter={(value) => Number(value).toFixed(2)}
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                width={72}
                tick={{ fill: '#64748b', fontSize: 12 }}
              />

              <Tooltip
                content={<CustomTooltip timeZone={timeZone} />}
                cursor={{ stroke: '#6D28D9', strokeDasharray: '4 4' }}
              />

              {yesterdayClose !== null && (
                <ReferenceLine
                  y={yesterdayClose}
                  stroke="#0F172A"
                  strokeOpacity={0.7}
                  strokeDasharray="7 7"
                  label={{
                    value: 'Yesterday Close',
                    position: 'insideTopRight',
                    fill: '#475569',
                  }}
                />
              )}

              <Area
                type="monotone"
                dataKey="value"
                stroke="none"
                fill="url(#marketArea)"
                fillOpacity={1}
                connectNulls={false}
                isAnimationActive={false}
              />

              <Line
                type="monotone"
                dataKey="value"
                stroke="url(#marketLine)"
                strokeWidth={3.25}
                dot={<CustomDot />}
                activeDot={<CustomDot />}
                connectNulls={false}
                isAnimationActive={false}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#marketGlow)"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="chart-placeholder" aria-label="Loading chart preview">
            <div className="chart-placeholder__axis chart-placeholder__axis--y" />
            <div className="chart-placeholder__axis chart-placeholder__axis--x" />
            <div className="chart-placeholder__line chart-placeholder__line--one" />
            <div className="chart-placeholder__line chart-placeholder__line--two" />
            <div className="chart-placeholder__dots">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="chart-placeholder__badge">Loading live chart</div>
          </div>
        )}
      </div>

      <div className="legend-row">
        <div>
          <span className="legend-dot above" />
          Above yesterday close
        </div>
        <div>
          <span className="legend-dot below" />
          Below yesterday close
        </div>
        <div>
          <span className="legend-dot equal" />
          Equal to yesterday close
        </div>
      </div>
    </section>
  );
}
