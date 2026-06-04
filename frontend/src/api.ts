import axios from 'axios';
import type {
  HistoryResponse,
  InstrumentType,
  MarketSessionConfig,
  MarketStatusResponse,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export const api = axios.create({
    baseURL: API_BASE_URL,
});

export async function getMarketHistory(
  type: InstrumentType,
  symbol: string,
  sessionConfig?: MarketSessionConfig,
) {
    const response = await api.get<HistoryResponse>('/market/history', {
        params: {
            type,
            symbol,
            ...sessionConfig,
        },
    });

    return response.data;
}

export async function getMarketStatus() {
    const response = await api.get<MarketStatusResponse>('/market/status');
    return response.data;
}
