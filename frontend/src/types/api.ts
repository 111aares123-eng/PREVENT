/**
 * TypeScript API contracts matching backend FastAPI schemas.
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TrendDirection = 'IMPROVING' | 'STABLE' | 'ESCALATING' | 'RAPIDLY_ESCALATING';

export interface FleetAssetSummary {
  asset_id: string;
  asset_type: string;
  make_model: string;
  depot_location: string;
  criticality: string;
  status: string;
  risk_score: number;
  confidence: number;
  risk_level: RiskLevel;
  trend: TrendDirection;
  primary_subsystem: string;
  recommended_action: string;
  total_events_count: number;
  latest_event_timestamp: string | null;
}

export interface RiskDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface FleetOverviewResponse {
  total_assets: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  critical_risk_count: number;
  risk_distribution: RiskDistribution;
  assets_requiring_attention: FleetAssetSummary[];
  assets: FleetAssetSummary[];
  evaluated_at: string;
}

export interface AssetInfo {
  asset_id: string;
  asset_type: string;
  make_model: string;
  depot_location: string;
  criticality: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface EvidenceGraphNode {
  id: string;
  label: string;
  type: 'asset' | 'subsystem' | 'event' | 'risk_factor';
  metadata: Record<string, any>;
}

export interface EvidenceGraphEdge {
  source: string;
  target: string;
  relation: string;
  metadata: Record<string, any>;
}

export interface EvidenceGraphData {
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
}

export interface SubsystemDetail {
  subsystem: string;
  subsystem_total_score: number;
  base_severity_points: number;
  frequency_penalty_points: number;
  cross_source_bonus_points: number;
  temporal_acceleration_points: number;
  near_miss_anchor_points: number;
  event_count: number;
  distinct_sources_count: number;
  distinct_roles: string[];
  temporal_rationale: string;
  is_contracting: boolean;
  is_severity_escalating: boolean;
}

export interface WhyNowSignalItem {
  label: string;
  value: string;
  severity: 'info' | 'warning' | 'critical' | 'positive';
  evidence_event_ids: string[];
}

export interface FactorContributionItem {
  factor_key?: string;
  label: string;
  points: number;
}

export interface WhyNowResponse {
  asset_id: string;
  headline: string;
  summary: string;
  signals: WhyNowSignalItem[];
  factor_contributions: FactorContributionItem[];
  current_risk_score: number;
  risk_level: RiskLevel;
  primary_subsystem: string;
  total_signals_count: number;
  distinct_sources_count: number;
}

export interface RiskHistoryPoint {
  timestamp: string;
  event_id: string;
  event_type: string;
  subsystem?: string | null;
  severity: number;
  description: string;
  risk_score: number;
  risk_level?: RiskLevel | null;
}

export interface RiskHistoryResponse {
  asset_id: string;
  total_points: number;
  points: RiskHistoryPoint[];
  trend: TrendDirection;
  current_risk_score: number;
  current_risk_level: RiskLevel;
}

export interface AssetDetailResponse {
  asset: AssetInfo;
  risk_score: number;
  confidence: number;
  risk_level: RiskLevel;
  trend: TrendDirection;
  primary_subsystem: string;
  factor_breakdown: {
    base_severity_points: number;
    frequency_penalty_points: number;
    cross_source_bonus_points: number;
    temporal_acceleration_points: number;
    near_miss_anchor_points: number;
    cross_subsystem_spillover: number;
    total_score: number;
  };
  confidence_breakdown: {
    source_diversity_points: number;
    evidence_volume_points: number;
    subsystem_focus_points: number;
    temporal_coherence_points: number;
    total_confidence: number;
  };
  subsystems_breakdown: Record<string, SubsystemDetail>;
  recommended_action: string;
  explanation_narrative: string;
  evidence_graph: EvidenceGraphData;
  computed_at: string;
  why_now?: WhyNowResponse;
  risk_history?: RiskHistoryResponse;
}

export interface TimelineEventItem {
  id: string;
  timestamp: string;
  event_type: string;
  subsystem: string;
  severity: number;
  description: string;
  source: string;
  reporter_role: string;
  is_simulated: boolean;
  location?: string | null;
  raw_metadata?: Record<string, any> | null;
}

export interface AssetTimelineResponse {
  asset_id: string;
  total_events: number;
  events: TimelineEventItem[];
}

export interface SimulateSignalRequest {
  asset_id: string;
  timestamp?: string;
  event_type: string;
  subsystem: string;
  severity: number;
  description: string;
  source: string;
  reporter_role: string;
  location?: string;
}

export interface SimulateSignalResponse {
  asset_id: string;
  before_risk_score: number;
  after_risk_score: number;
  risk_score_delta: number;
  before_risk_level: RiskLevel;
  after_risk_level: RiskLevel;
  before_confidence: number;
  after_confidence: number;
  confidence_delta: number;
  before_trend: TrendDirection;
  after_trend: TrendDirection;
  factor_breakdown_delta: Record<string, number>;
  explanation_of_change: string;
  simulated_assessment: any;
}

export interface EventMetadata {
  weather?: string;
  source?: string;
  audio_transcribed?: boolean;
  transcript?: string;
  detected_language?: string;
  transcription_provider?: string;
  original_text?: string;
  [key: string]: any;
}

export interface ExtractedEventData {
  asset_id: string;
  event_type: string;
  subsystem: string;
  severity: number;
  description: string;
  source: string;
  reporter_role: string;
  timestamp?: string | null;
  location?: string | null;
  raw_metadata?: EventMetadata | Record<string, any> | null;
}

export interface EventExtractRequest {
  report_text: string;
  asset_id?: string | null;
}

export interface EventExtractResponse {
  extracted_event: ExtractedEventData | null;
  provider: string;
  validation_status: 'valid' | 'invalid';
  validation_errors?: string[] | null;
  raw_extraction?: Record<string, any> | null;
  fallback_used?: boolean;
  fallback_message?: string | null;
}

export interface EventCreateRequest {
  asset_id: string;
  timestamp?: string;
  event_type: string;
  subsystem: string;
  severity: number;
  description: string;
  source: string;
  reporter_role: string;
  location?: string | null;
  is_simulated?: boolean;
  raw_metadata?: Record<string, any> | null;
}

export interface EventIngestionResponse {
  event: TimelineEventItem;
  asset_id: string;
  previous_risk_score: number;
  updated_risk_score: number;
  risk_score_delta: number;
  previous_risk_level: RiskLevel;
  updated_risk_level: RiskLevel;
  previous_confidence: number;
  updated_confidence: number;
  confidence_delta: number;
  factor_breakdown: Record<string, number>;
  factor_breakdown_delta: Record<string, number>;
  explanation_narrative: string;
  why_risk_changed: string[];
}

// ==========================================
// REAL-WORLD EVIDENCE (NHTSA) TYPES
// ==========================================

export interface NHTSACohort {
  make: string;
  model: string;
  model_year: number;
}

export interface NHTSACaseStudy {
  title: string;
  target_subsystem: string;
  official_recall_campaign: string;
  official_investigation_action: string;
  recall_effective_date: string;
}

export interface NHTSAMetadata {
  source: string;
  dataset_name: string;
  cohort: NHTSACohort;
  case_study: NHTSACaseStudy;
  disclaimer: string;
}

export interface NHTSASummary {
  total_cohort_records: number;
  target_subsystem: string;
  target_subsystem_records: number;
  subsystem_concentration_pct: number;
  precursor_signals: number;
  precursor_pct: number;
  critical_outcomes: number;
  critical_pct: number;
  pre_action_signals: number;
  post_action_signals: number;
  lead_time_days: number | null;
  lead_time_months: number | null;
}

export interface NHTSASafetyAction {
  campaign_number: string;
  action_number: string;
  action_date: string;
  component: string;
  defect_summary: string;
  consequence: string;
  remedy: string;
}

export interface NHTSASubsystemItem {
  subsystem: string;
  count: number;
  percentage: number;
  is_target: boolean;
}

export interface NHTSATimelineItem {
  period: string;
  precursor_count: number;
  critical_count: number;
  total_count: number;
  action_marker: boolean;
  action_label?: string | null;
}

export interface NHTSASignalDiversityItem {
  symptom: string;
  count: number;
  percentage: number;
}

export interface NHTSATraceableSignal {
  odi_number: number;
  filed_date: string;
  incident_date: string;
  context_label: string;
  severity_tier: 'PRECURSOR' | 'CRITICAL';
  crash: boolean;
  injuries: number;
  primary_subsystem: string;
  components: string[];
  summary_excerpt: string;
  official_lookup_url: string;
}

export interface NHTSAEvidenceResponse {
  metadata: NHTSAMetadata;
  summary: NHTSASummary;
  safety_action: NHTSASafetyAction;
  subsystem_breakdown: NHTSASubsystemItem[];
  temporal_timeline: NHTSATimelineItem[];
  signal_diversity: NHTSASignalDiversityItem[];
  traceable_signals: NHTSATraceableSignal[];
}
