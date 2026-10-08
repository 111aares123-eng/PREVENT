"""
Core configuration and settings for PREVENT.
Houses all configurable weights for risk scoring and confidence calculation,
ensuring no hardcoded magic numbers exist across the platform.
"""
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent



class RiskScoringWeights(BaseModel):
    """Configurable weights and thresholds for the explainable risk engine."""
    # Rolling analysis window (in days)
    analysis_window_days: int = Field(default=30, description="Rolling time window for event correlation")
    
    # Recency decay half-life in days (exponential decay: older events carry diminishing weight)
    recency_half_life_days: float = Field(default=10.0, description="Half-life in days for recency decay")
    
    # Severity multiplier: raw contribution = severity * severity_weight * recency_weight
    severity_weight: float = Field(default=3.5, description="Point multiplier per severity level (1-5)")
    max_severity_points: float = Field(default=25.0, description="Maximum points obtainable from base severity")
    
    # Frequency penalty per repeated occurrence on same subsystem
    frequency_penalty_per_event: float = Field(default=3.5, description="Points added for each event beyond the first")
    max_frequency_points: float = Field(default=16.0, description="Maximum frequency points")
    
    # Cross-source corroboration tiers (number of distinct reporter roles on same subsystem)
    # {min_distinct_sources: bonus_points}
    cross_source_tiers: Dict[int, float] = Field(
        default={
            2: 8.0,
            3: 14.0,
            4: 20.0
        },
        description="Bonus points awarded based on distinct reporting roles corroborating the issue"
    )
    max_cross_source_points: float = Field(default=20.0, description="Maximum cross-source corroboration points")
    
    # Temporal acceleration heuristic (shortening intervals between events)
    temporal_acceleration_bonus: float = Field(
        default=13.0,
        description="Points awarded when consecutive event intervals strictly decrease or contract rapidly with escalating severity"
    )
    short_interval_threshold_days: float = Field(
        default=3.5,
        description="Threshold in days considered a rapid follow-up event"
    )
    short_interval_bonus: float = Field(
        default=7.0,
        description="Points awarded if latest interval is under threshold"
    )
    max_temporal_points: float = Field(default=15.0, description="Maximum temporal acceleration points")
    
    # Near-miss / Critical event anchor
    near_miss_anchor_points: float = Field(
        default=10.0,
        description="Points added if any event is a near-miss or critical incident (severity >= 4)"
    )
    
    # Cross-subsystem spillover weight (how much secondary subsystem risks contribute to overall score)
    cross_subsystem_spillover: float = Field(
        default=0.08,
        description="Fraction of secondary subsystem risk scores added to total"
    )
    
    # Risk level classification thresholds
    threshold_low_max: float = Field(default=39.9, description="Max score for LOW risk")
    threshold_medium_max: float = Field(default=69.9, description="Max score for MEDIUM risk")
    threshold_high_max: float = Field(default=84.9, description="Max score for HIGH risk")
    # Above 85 is CRITICAL


class ConfidenceScoringWeights(BaseModel):
    """
    Configurable weights for the Confidence Score (0-100%).
    Confidence represents the certainty/reliability of the assessment based on
    evidence volume, independent source diversity, temporal consistency, and subsystem specificity.
    """
    # Source diversity weight (up to 40% of confidence)
    max_source_diversity_points: float = Field(default=35.0)
    points_per_distinct_source: float = Field(default=9.0)
    
    # Evidence volume weight (up to 25% of confidence)
    max_evidence_volume_points: float = Field(default=25.0)
    points_per_event: float = Field(default=5.0)
    
    # Subsystem specificity weight (up to 20% of confidence)
    # Higher confidence when signals converge on a single specific subsystem rather than scattered
    max_subsystem_focus_points: float = Field(default=20.0)
    
    # Temporal consistency weight (up to 20% of confidence)
    # Higher confidence when events have clear temporal sequence within the observation window
    max_temporal_coherence_points: float = Field(default=20.0)


class Settings(BaseSettings):
    """Global application settings."""
    PROJECT_NAME: str = "PREVENT — Proactive Risk Intelligence Platform"
    API_V1_PREFIX: str = "/api/v1"
    
    # Database URL: default to SQLite for zero-friction local development
    DATABASE_URL: str = "sqlite:///./prevent.db"
    
    # Reference anchor time for deterministic evaluation of synthetic datasets.
    # If None, the engine defaults to the latest event timestamp in the fleet.
    DEFAULT_ANCHOR_TIME: Optional[str] = "2026-09-17T18:00:00Z"
    
    # CORS allowed origins for local development (e.g. React / Vite)
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
        description="Allowed origins for CORS"
    )

    # Modular sub-configs
    risk_weights: RiskScoringWeights = Field(default_factory=RiskScoringWeights)
    confidence_weights: ConfidenceScoringWeights = Field(default_factory=ConfidenceScoringWeights)

    # LLM Provider Configuration
    LLM_PROVIDER: str = Field(default="mock", description="LLM provider: 'mock' or 'gemini'")
    GEMINI_API_KEY: Optional[str] = Field(default=None, description="Google Gemini API key")
    GEMINI_MODEL: str = Field(default="gemini-2.5-flash", description="Gemini model identifier for structured extraction")

    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_DIR / ".env"), "backend/.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
