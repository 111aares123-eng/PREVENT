/**
 * Centralized API client service.
 * Connects React components to the FastAPI backend.
 */
import type {
  FleetOverviewResponse,
  AssetDetailResponse,
  AssetTimelineResponse,
  SimulateSignalRequest,
  SimulateSignalResponse
} from '../types/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      let errorDetail = `Request failed with status ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson.detail) {
          errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {
        // Fallback to text if not json
      }
      throw new ApiError(errorDetail, response.status);
    }

    return (await response.json()) as T;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(err?.message || 'Network connection failed', 0);
  }
}

export const api = {
  checkHealth: () => request<{ status: string }>('/health'),

  getFleetOverview: () => request<FleetOverviewResponse>('/api/v1/fleet/overview'),

  getAssetDetail: (assetId: string) =>
    request<AssetDetailResponse>(`/api/v1/assets/${encodeURIComponent(assetId)}`),

  getAssetTimeline: (assetId: string) =>
    request<AssetTimelineResponse>(`/api/v1/assets/${encodeURIComponent(assetId)}/timeline`),

  simulateSignal: (payload: SimulateSignalRequest) =>
    request<SimulateSignalResponse>('/api/v1/simulation/simulate-signal', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
