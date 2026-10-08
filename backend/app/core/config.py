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
    
    # Retention floor for unmitigated safety hazards (severity >= 3) on recurring active subsystems
    unmitigated_retention_floor: float = Field(
        default=0.65,
        description="Minimum weight retained by severe unmitigated warnings on active subsystems"
    )
    
    # Severity multiplier: raw contribution = severity * severity_weight * recency_weight
    severity_weight: float = Field(default=3.5, description="Point multiplier per severity level (1-5)")
    max_severity_points: float = Field(default=25.0, description="Maximum points obtainable from base severity")
    acute_max_severity_points: float = Field(
        default=35.0,
        description="Maximum base severity points for isolated acute severe events"
    )
    
    # Frequency penalty per repeated occurrence on same subsystem
    frequency_penalty_per_event: float = Field(default=3.5, description="Points added for each event beyond the first")
    max_frequency_points: float = Field(default=20.0, description="Maximum frequency points")
    
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
    short_interval_tolerance_days: float = Field(
        default=1.0,
        description="Smoothing tolerance window in days to prevent knife-edge score collapses from minor hour shifts"
    )
    short_interval_bonus: float = Field(
        default=7.0,
        description="Points awarded if latest interval is under threshold"
    )
    max_temporal_points: float = Field(default=16.0, description="Maximum temporal acceleration points")
    
    # Near-miss / Critical event anchors
    near_miss_anchor_points: float = Field(
        default=10.0,
        description="Base points added if any event is a near-miss or critical incident in a multi-event pattern"
    )
    compound_incident_bonus: float = Field(
        default=10.0,
        description="Bonus points added when an actual collision/incident occurs within a corroborated pattern"
    )
    max_near_miss_points: float = Field(
        default=25.0,
        description="Maximum points obtainable from near-miss / collision anchors"
    )
    
    # Cross-subsystem spillover weight (how much secondary subsystem risks contribute to overall score)
    cross_subsystem_spillover: float = Field(
        default=0.08,
        description="Fraction of secondary subsystem risk scores added to total"
    )
    
    # Risk level classification thresholds (calibrated 0-100 scale: 0-44 LOW, 45-69 MEDIUM, 70-89 HIGH, 90-100 CRITICAL)
    threshold_low_max: float = Field(default=44.9, description="Max score for LOW risk")
    threshold_medium_max: float = Field(default=69.9, description="Max score for MEDIUM risk")
    threshold_high_max: float = Field(default=89.9, description="Max score for HIGH risk")
    # Above 89.9 (90.0+) is CRITICAL


class ConfidenceScoringWeights(BaseModel):
    """
    Configurable weights for the Confidence Score (0-100%).
    Confidence represents the certainty/reliability of the assessment based on
    evidence volume, independent source diversity, temporal consistency, and subsystem specificity.
    Avoids casually returning 100%.
    """
    # Source diversity weight
    max_source_diversity_points: float = Field(default=28.0)
    points_per_distinct_source: float = Field(default=5.6)
    
    # Evidence volume weight
    max_evidence_volume_points: float = Field(default=22.0)
    points_per_event: float = Field(default=4.4)
    
    # Subsystem specificity weight
    max_subsystem_focus_points: float = Field(default=18.0)
    
    # Temporal consistency weight
    max_temporal_coherence_points: float = Field(default=18.0)
    
    # Maximum calibrated confidence ceiling (avoids casually returning 100%)
    max_calibrated_confidence: float = Field(
        default=96.0,
        description="Upper ceiling for confidence scores to reflect inherent real-world uncertainty"
    )


class Settings(BaseSettings):
    """Global application settings."""
    PROJECT_NAME: str = "PREVENT — Proactive Risk Intelligence Platform"
    API_V1_PREFIX: str = "/api/v1"
    
    # Database URL: default to SQLite for zero-friction local development
    DATABASE_URL: str = "sqlite:///./prevent.db"
    
    # Reference instant of the bundled seed scenarios (the moment their timelines treat as "now").
    # The risk engine itself always evaluates on the live UTC clock and never reads this value;
    # the seed script uses it to shift scenario timestamps onto today (see data/scenarios/seed_data.py).
    DEFAULT_ANCHOR_TIME: Optional[str] = "2026-09-17T18:00:00Z"
    
    # CORS allowed origins for local development (e.g. React / Vite)
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
        description="Allowed origins for CORS"
    )

    # Modular sub-configs
    risk_weights: RiskScoringWeights = Field(default_factory=RiskScoringWeights)
    confidence_weights: ConfidenceScoringWeights = Field(default_factory=ConfidenceScoringWeights)

    # LLM Provider & Router Configuration
    LLM_PROVIDER: Optional[str] = Field(default=None, description="Explicit provider override ('router', 'groq', 'gemini', 'mock')")
    LLM_PRIMARY: str = Field(default="groq", description="Primary LLM provider ('groq')")
    LLM_SECONDARY: str = Field(default="gemini", description="Secondary LLM provider ('gemini')")
    LLM_FALLBACK: str = Field(default="mock", description="Final fallback provider ('mock')")

    # Groq Configuration
    GROQ_API_KEY: Optional[str] = Field(default=None, description="Groq API key")
    GROQ_MODEL: str = Field(default="openai/gpt-oss-20b", description="Groq model identifier")

    # Gemini Configuration
    GEMINI_API_KEY: Optional[str] = Field(default=None, description="Google Gemini API key")
    GEMINI_MODEL: str = Field(default="gemini-2.5-flash", description="Gemini model identifier for structured extraction")

    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_DIR / ".env"), "backend/.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
