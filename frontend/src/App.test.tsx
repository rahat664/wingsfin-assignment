import { render } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoryResponse } from './types';

const apiMocks = vi.hoisted(() => ({
  getMarketHistory: vi.fn(),
  getMarketStatus: vi.fn(),
}));

const socketMock = vi.hoisted(() => {
  const mock: {
    connected: boolean;
    connect: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
  } = {
    connected: false,
    connect: vi.fn(() => {
      mock.connected = true;
    }),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };

  return mock;
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

vi.mock('./api', () => apiMocks);
vi.mock('./socket', () => ({ socket: socketMock }));
vi.mock('./components/MarketChart', () => ({
  MarketChart: ({
    title,
    isLoading,
    marketOpen,
  }: {
    title: string;
    isLoading?: boolean;
    marketOpen?: boolean;
  }) => (
    <section data-testid="market-chart">
      <h2>{title}</h2>
      <p>{isLoading ? 'Loading chart' : 'Chart ready'}</p>
      <p>{marketOpen ? 'Live market' : 'Closed market'}</p>
    </section>
  ),
}));

import App from './App';

function createHistoryResponse(
  overrides: Partial<HistoryResponse> & { points: HistoryResponse['points'] },
): HistoryResponse {
  return {
    marketOpen: true,
    type: 'INDEX',
    symbol: 'DSEX',
    openTime: '2026-06-03T10:00:00.000Z',
    currentTime: '2026-06-03T10:02:00.000Z',
    totalPoints: overrides.points.length,
    latestValue: 123.4567,
    yesterdayClose: 120,
    ...overrides,
  };
}

describe('App', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    socketMock.connected = false;
    socketMock.connect.mockImplementation(() => {
      socketMock.connected = true;
    });
    socketMock.emit.mockImplementation(() => undefined);
    socketMock.on.mockImplementation(() => undefined);
    socketMock.off.mockImplementation(() => undefined);

    apiMocks.getMarketStatus.mockResolvedValue({
      marketOpen: true,
      now: '2026-06-03T10:00:00.000Z',
      openTime: '10:00',
      closeTime: '20:00',
      timezone: 'Asia/Dhaka',
    });

    apiMocks.getMarketHistory.mockResolvedValue(
      createHistoryResponse({
        points: [
          {
            time: '2026-06-03T10:00:00.000Z',
            value: 120,
            yesterdayClose: 119,
            status: 'ABOVE',
            isLatest: false,
          },
          {
            time: '2026-06-03T10:01:00.000Z',
            value: 123.4567,
            yesterdayClose: 120,
            status: 'ABOVE',
            isLatest: true,
          },
        ],
      }),
    );
  });

  it('defaults to Index - DSEX and shows the loading state while history is fetched', async () => {
    const pendingHistory = deferred<HistoryResponse>();
    apiMocks.getMarketHistory.mockReturnValueOnce(pendingHistory.promise);

    render(<App />);

    const chartSelect = screen.getByRole('combobox', { name: /chart view/i });

    expect(chartSelect).toHaveDisplayValue('Index view - DSEX');
    expect(screen.getByTestId('market-chart')).toHaveTextContent('Loading chart');
    expect(screen.getByTestId('market-chart')).toHaveTextContent('Live market');
  });

  it('switches from Index - DSEX to Stock - GP and unsubscribes then resubscribes the socket room', async () => {
    const user = userEvent.setup();
    const stockHistory = createHistoryResponse({
      type: 'STOCK',
      symbol: 'GP',
      latestValue: 245.88,
      yesterdayClose: 238.88,
      points: [
        {
          time: '2026-06-03T10:00:00.000Z',
          value: 238.88,
          yesterdayClose: 238.88,
          status: 'EQUAL',
          isLatest: false,
        },
        {
          time: '2026-06-03T10:01:00.000Z',
          value: 245.88,
          yesterdayClose: 238.88,
          status: 'ABOVE',
          isLatest: true,
        },
      ],
    });

    apiMocks.getMarketHistory
      .mockResolvedValueOnce(
        createHistoryResponse({
          type: 'INDEX',
          symbol: 'DSEX',
          points: [],
        }),
      )
      .mockResolvedValueOnce(stockHistory);

    render(<App />);

    await waitFor(() =>
      expect(socketMock.emit).toHaveBeenCalledWith('market.subscribe', {
        type: 'INDEX',
        symbol: 'DSEX',
      }),
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: /chart view/i }),
      'STOCK',
    );

    expect(screen.getByRole('combobox', { name: /chart view/i })).toHaveDisplayValue(
      'Stock view - GP',
    );

    await waitFor(() =>
      expect(socketMock.emit).toHaveBeenCalledWith('market.unsubscribe', {
        type: 'INDEX',
        symbol: 'DSEX',
      }),
    );
    await waitFor(() =>
      expect(socketMock.emit).toHaveBeenCalledWith('market.subscribe', {
        type: 'STOCK',
        symbol: 'GP',
      }),
    );
    expect(screen.getByTestId('market-chart')).toHaveTextContent('Stock view - GP');
  });

  it('shows the closed-market message when history says the market is closed', async () => {
    apiMocks.getMarketHistory.mockResolvedValueOnce({
      marketOpen: false,
      message: 'Market is closed. Charts are available only during market hours.',
      points: [],
      totalPoints: 0,
      latestValue: null,
      yesterdayClose: null,
    });

    render(<App />);

    await waitFor(() => expect(apiMocks.getMarketHistory).toHaveBeenCalled());
    expect(await screen.findByText(/historical data is still available/i)).toBeInTheDocument();
    expect(
      screen.getByText(/market is closed\. charts are available only during market hours\./i),
    ).toBeInTheDocument();
  });

  it('shows a clear error state when the history API fails', async () => {
    const pendingHistory = deferred<HistoryResponse>();
    apiMocks.getMarketHistory.mockReturnValueOnce(pendingHistory.promise);

    render(<App />);

    await waitFor(() => expect(apiMocks.getMarketHistory).toHaveBeenCalled());
    pendingHistory.reject(new Error('history failed'));

    expect(await screen.findByText(/unable to load chart data/i)).toBeInTheDocument();
    expect(screen.getByText(/could not load market history/i)).toBeInTheDocument();
  });

  it('renders the chart title, latest value, and live indicator after a successful history load', async () => {
    render(<App />);

    await waitFor(() => expect(apiMocks.getMarketHistory).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId('market-chart')).toHaveTextContent('Index view - DSEX'),
    );
    expect(screen.getByText('123.4567')).toBeInTheDocument();
  });
});
