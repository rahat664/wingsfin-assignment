import React from 'react';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import type { ChartPoint } from '../types';

const chartContext = React.createContext<ChartPoint[]>([]);

vi.mock('recharts', () => {
  function Provider({ data, children }: { data?: ChartPoint[]; children: React.ReactNode }) {
    return <chartContext.Provider value={data ?? []}>{children}</chartContext.Provider>;
  }

  return {
    Area: () => null,
    CartesianGrid: () => null,
    LineChart: ({ data, children }: { data?: ChartPoint[]; children: React.ReactNode }) => (
      <Provider data={data}>{children}</Provider>
    ),
    Line: ({ dot }: { dot?: React.ReactElement }) => {
      const data = React.useContext(chartContext);

      return (
        <div data-testid="line">
          {data.map((point, index) =>
            React.isValidElement(dot)
              ? React.cloneElement(dot as React.ReactElement<any>, {
                  cx: index * 12,
                  cy: index * 12,
                  payload: point,
                  key: point.time,
                })
              : null,
          )}
        </div>
      );
    },
    ReferenceLine: () => null,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Tooltip: ({ content }: { content?: React.ReactElement }) => {
      const data = React.useContext(chartContext);

      if (!React.isValidElement(content)) return null;

      const payloadPoint = data[data.length - 1];

      return React.cloneElement(content as React.ReactElement<any>, {
        active: true,
        label: payloadPoint?.time,
        payload: payloadPoint ? [{ payload: payloadPoint }] : [],
      });
    },
    XAxis: () => null,
    YAxis: () => null,
  };
});

import { MarketChart } from './MarketChart';

describe('MarketChart', () => {
  const points: ChartPoint[] = [
    {
      time: '2026-06-03T10:00:00.000Z',
      value: 100,
      yesterdayClose: 99,
      status: 'ABOVE',
      isLatest: false,
    },
    {
      time: '2026-06-03T10:01:00.000Z',
      value: 101.2345,
      yesterdayClose: 99,
      status: 'ABOVE',
      isLatest: true,
    },
    {
      time: '2026-06-03T10:02:00.000Z',
      value: null,
      yesterdayClose: 99,
      status: 'NO_DATA',
      isLatest: false,
      isFuture: true,
    },
  ];

  it('renders the latest value, legend labels, live badge, tooltip, and heartbeat marker', () => {
    const { container } = render(
      <MarketChart
        title="Index view - DSEX"
        symbol="DSEX"
        points={points}
        totalPoints={3}
        lastUpdatedLabel="Jun 3, 2026, 10:01 AM"
        timeZone="UTC"
        marketOpen
      />,
    );

    expect(screen.getByText('Latest')).toBeInTheDocument();
    expect(screen.getByText('101.2345')).toBeInTheDocument();
    expect(screen.getByText('Above yesterday close')).toBeInTheDocument();
    expect(screen.getByText('Below yesterday close')).toBeInTheDocument();
    expect(screen.getByText('Equal to yesterday close')).toBeInTheDocument();
    expect(screen.getByLabelText(/live market indicator/i)).toBeInTheDocument();
    expect(screen.getByText(/no value yet/i)).toBeInTheDocument();
    expect(container.querySelector('.heartbeat-pulse')).toBeInTheDocument();
  });

  it('does not crash when the chart only receives future points', () => {
    render(
      <MarketChart
        title="Index view - DSEX"
        symbol="DSEX"
        points={[
          {
            time: '2026-06-03T10:00:00.000Z',
            value: null,
            yesterdayClose: 99,
            status: 'NO_DATA',
            isLatest: false,
            isFuture: true,
          },
        ]}
        totalPoints={1}
        lastUpdatedLabel="Jun 3, 2026, 10:00 AM"
        timeZone="UTC"
      />,
    );

    expect(screen.getByText('Index view - DSEX')).toBeInTheDocument();
    expect(screen.getAllByText('--').length).toBeGreaterThan(0);
  });
});
