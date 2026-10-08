/**
 * PREVENT — Phase 5: Field Action Workflow Types
 * 
 * Domain-agnostic type definitions for the human-controlled field action workflow:
 * Recommended Action -> Acknowledge -> Generic Safety Checklist -> Report Outcome.
 */

export type FieldActionStatus =
  | 'NOT_STARTED'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'OUTCOME_PENDING';

export type FieldActionOutcomeChoice = 'corrective_action' | 'anomaly_confirmed';

export interface FieldActionChecklist {
  isolationInspection: boolean;
  toleranceVerification: boolean;
  functionalCheck: boolean;
}

export interface FieldActionState {
  assetId: string;
  status: FieldActionStatus;
  acknowledgedAt: string | null;
  checklist: FieldActionChecklist;
  notes?: string;
  completedAt?: string | null;
}

export interface FieldActionContext {
  assetId: string;
  riskLevel: string;
  riskScore: number;
  primarySubsystem: string;
  whyNowSummary?: string;
  language: 'en' | 'ta' | 'hi';
  role: string;
}

export interface FieldActionOutcomePayload {
  assetId: string;
  primarySubsystem: string;
  actionStatus: FieldActionStatus;
  checklistCompletedCount: number;
  totalChecklistCount: number;
  acknowledgedAt: string | null;
  completedAt: string;
  notes?: string;
  outcomeChoice: FieldActionOutcomeChoice;
  suggestedEventType: string;
  suggestedReporterRole: string;
  initialReportText?: string;
}
