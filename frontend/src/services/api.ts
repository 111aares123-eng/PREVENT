/**
 * Centralized API client service.
 * Connects React components to the FastAPI backend.
 */
import type {
  FleetOverviewResponse,
  AssetDetailResponse,
  AssetTimelineResponse,
  SimulateSignalRequest,
  SimulateSignalResponse,
  EventExtractResponse,
  EventCreateRequest,
  EventIngestionResponse,
  RiskHistoryResponse,
  WhyNowResponse
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
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  const headers: Record<string, string> = {};

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (options?.headers) {
    Object.assign(headers, options.headers);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
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

  getAssetRiskHistory: (assetId: string) =>
    request<RiskHistoryResponse>(`/api/v1/assets/${encodeURIComponent(assetId)}/risk-history`),

  getAssetWhyNow: (assetId: string) =>
    request<WhyNowResponse>(`/api/v1/assets/${encodeURIComponent(assetId)}/why-now`),

  simulateSignal: (payload: SimulateSignalRequest) =>
    request<SimulateSignalResponse>('/api/v1/simulation/simulate-signal', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  extractEvent: (reportText: string, assetId?: string | null) =>
    request<EventExtractResponse>('/api/v1/events/extract', {
      method: 'POST',
      body: JSON.stringify({
        report_text: reportText,
        ...(assetId ? { asset_id: assetId.trim().toUpperCase() } : {}),
      }),
    }),

  extractEventFromAudio: (audioBlob: Blob, filename = 'voice_report.webm', assetId?: string | null) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, filename);
    if (assetId && assetId.trim()) {
      formData.append('asset_id', assetId.trim().toUpperCase());
    }
    return request<EventExtractResponse>('/api/v1/events/extract-audio', {
      method: 'POST',
      body: formData,
    });
  },

  ingestEvent: (payload: EventCreateRequest) =>
    request<EventIngestionResponse>('/api/v1/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getNhtsaEvidence: () => request<import('../types/api').NHTSAEvidenceResponse>('/api/v1/evidence/nhtsa'),
};
