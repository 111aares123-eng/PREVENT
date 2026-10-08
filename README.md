# PREVENT

### Connecting the warnings before they become incidents.

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat&logo=tailwind-css&logoColor=white)
![SQLite](https://img.shields.io/badge/Storage-SQLite-003B57?style=flat&logo=sqlite&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-146%2F146_Passing-success?style=flat)

PREVENT is an AI-assisted safety intelligence and early-warning decision-support platform. It connects scattered, low-intensity warning signals across maintenance logs, inspection audits, driver reports, passenger complaints, near-misses, and operational records to surface escalating risk patterns before they become critical incidents.

> **Decision-Support Notice**: PREVENT is an early-warning prioritization tool designed to support human safety operators. It does **not** claim to predict accidents with certainty, does **not** replace certified safety inspectors or domain engineers, and does **not** make autonomous operational shutdown decisions.

---

## Project Overview

In complex operations—such as transit networks, aviation fleets, logistics, and heavy equipment—catastrophic failures rarely happen without prior warning. Instead, early indicators appear across disconnected channels:

- A depot mechanic replaces a worn brake shoe.
- A passenger notes abnormal stopping jerkiness in a feedback app.
- A state auditor spots slight brake balance variance during an annual inspection.
- A driver notes soft brake pedal travel on a rainy shift.
- A vehicle overshoots a platform stopping mark during service.

Viewed in isolation, each report seems minor, routine, or benign. Disconnected systems and siloed teams often log these signals independently without realizing they belong to the same escalating pattern.

PREVENT aggregates these signals around:
1. **The target asset** (e.g., `BUS-142`)
2. **The specific vehicle subsystem** (e.g., braking, steering, doors/body)
3. **Time and interval acceleration** (contracting time between signals)
4. **Severity escalation** (routine maintenance $\to$ complaint $\to$ audit fault $\to$ near-miss)
5. **Cross-source corroboration** (independent observations across drivers, mechanics, passengers, inspectors)
6. **Mitigation status** (whether a corrective repair was completed or verified)

> *"PREVENT doesn't try to predict the future. It helps organizations notice when the warning signs they already have are starting to connect."*

---

## Problem Statement

> **"Scattered safety warnings make it difficult to identify escalating risks before incidents occur."**

In real-world operations:
- **Signals are fragmented across disparate systems**: Maintenance databases, telematics feeds, customer feedback portals, and driver shift logs rarely communicate.
- **Different teams see different puzzle pieces**: Workshop managers see work orders; dispatchers see delays; safety officers see incident reports weeks later.
- **Isolated analysis misses compounding escalation**: Standard log viewers evaluate events individually. Two minor notes on the same subsystem within 48 hours look harmless unless correlated.
- **Operators need prioritization, not another raw log stream**: Fleet operators need to know **which** asset needs attention today, **why now**, and **what evidence** supports that conclusion.

---

## How PREVENT Works

PREVENT pairs an AI natural-language extraction layer with a deterministic mathematical risk engine:

```text
Raw Natural-Language Report (driver log, passenger note, mechanic remark)
                            ↓
       AI Event Extraction (Groq → Gemini → Mock Fallback)
                            ↓
         Pydantic Schema Validation & Normalization
                            ↓
               Human Review & Confirmation
                            ↓
       Structured Safety Event Persisted to Database
                            ↓
       Deterministic Mathematical Risk Engine
       ├── Base Severity & Recency Decay
       ├── Repetition Frequency Penalty
       ├── Cross-Source Role Corroboration
       ├── Temporal Interval Acceleration
       ├── Near-Miss / Incident Anchor
       └── Corrective Action Mitigation Discount
                            ↓
       Explainable Risk Score + Confidence Score + Evidence Graph
                            ↓
       "WHY NOW" Intelligence + Prescriptive Recommended Action
```

### The Role of AI vs. The Deterministic Engine

| Component | Responsibility | What It Does NOT Do |
| :--- | :--- | :--- |
| **LLM Extraction Layer** | Parses raw, unstructured natural-language reports into structured JSON (`subsystem`, `severity`, `event_type`, `reporter_role`). | Does **not** calculate, estimate, or modify risk scores. Does not persist data without human confirmation. |
| **Deterministic Risk Engine** | Computes exact mathematical risk scores ($0\text{--}100$) and factor waterfalls using verified rules. | Does **not** use black-box neural networks, fuzzy logic, or uninterpretable embeddings. |
| **Human Operator** | Reviews extracted fields in a confirmation modal and verifies operational relevance before persistence. | Does not have to manually transcribe handwritten logs or cross-reference multiple databases. |

---

## Key Features

- **Multi-Source Signal Convergence**: Correlates maintenance tasks, passenger feedback, driver notes, safety audits, near-misses, and collision reports into a single unified timeline.
- **Explainable Deterministic Risk Scoring**: Every point in an asset's score ($0\text{--}100$) is traceable to an exact mathematical formula broken down into six interpretable components.
- **Calibrated Risk Bands**: Categorizes assets into four operational tiers:
  - `LOW` ($0.0\text{--}39.9$): Routine operational baseline.
  - `MEDIUM` ($40.0\text{--}69.9$): Emerging issue requiring proactive investigation.
  - `HIGH` ($70.0\text{--}89.9$): Immediate supervisory attention and depot inspection.
  - `CRITICAL` ($90.0\text{--}100.0$): Urgent grounding and corrective intervention.
- **Risk Trajectory**: Replays chronological risk progression as events accumulate, demonstrating how risk escalated from baseline to critical.
- **"WHY NOW" Intelligence**: Explains why an asset requires attention today:
  - **Quiet Assets**: Displays calm, non-alarming status (`"NO ACTIVE ESCALATION DETECTED"`), noting days since the last low-severity event without false alarms.
  - **Escalating Assets**: Surfaces the active contributing factors (contracting intervals, multi-role convergence, severity jumps).
- **Evidence Relationship Graph**: Visualizes relational connections linking Asset $\to$ Subsystems $\to$ Corroborating Events $\to$ Risk Factors $\to$ Final Assessment.
- **In-Memory What-If Simulator**: Allows safety officers to inject hypothetical warning signals (e.g., simulated severe braking report or collision) to preview risk shifts in real time **without mutating database records**.
- **Independent Confidence Scoring**: Evaluates evidence volume, source diversity, subsystem focus, and timeline consistency ($0\text{--}100\%$) independently of risk severity.
- **Mitigation & Verification Semantics**: Recognizes completed repairs ($-22.0\text{ pts}$) and verified post-repair inspections ($-35.0\text{ pts}$) to reduce active risk while preserving permanent historical records. Subsequent warnings cancel the discount and re-escalate risk.
- **Graceful Temporal Decay**: Isolated acute hazards decline smoothly past a 12-hour grace period; new related warnings reactivate historical evidence as part of the connected chain.
- **Multilingual Ingestion & Voice Recording**: Ingests field observations via text or voice recording using the browser native `MediaRecorder` API in English, Tamil, Hindi, Tanglish, and Hinglish. Audio is transcribed, normalized into canonical safety taxonomy, and staged with audio evidence context.
- **Human-in-the-Loop Event Ingestion**: Extracted reports (text and voice) are previewed and editable by human supervisors before permanent database ingestion.
- **Multilingual Action Guidance & Human Decision Support**: Connects "WHY NOW" intelligence to prescriptive operational actions (Monitor, Inspect, Inspect + Escalate, Isolate + Escalate) displayed in English, Tamil (`தமிழ்`), or Hindi (`हिन्दी`) with human override options (`Accept`, `Custom`, `Dismiss`).

---

## Calibrated Risk Model

PREVENT evaluates risk on a bounded scale from **$0.0$ to $100.0$**:

| Risk Band | Score Range | Operational Meaning | Example Fleet State |
| :---: | :---: | :--- | :--- |
| **LOW** | $0.0\text{--}39.9$ | **Routine Monitoring**: Normal operational baseline. Standard scheduled maintenance applies. | `BUS-105` ($9.6$ LOW), `BUS-112` ($9.8$ LOW), `BUS-318` ($29.8$ LOW) |
| **MEDIUM** | $40.0\text{--}69.9$ | **Investigation**: Emerging pattern on a single subsystem. Heightened surveillance recommended. | `BUS-091` ($43.3$ MEDIUM — recurring door seal wear) |
| **HIGH** | $70.0\text{--}89.9$ | **Immediate Attention**: Multi-source convergence with severe warning. Schedule depot inspection within 24h. | `BUS-142` ($82.0$ HIGH — converging braking warnings) |
| **CRITICAL** | $90.0\text{--}100.0$ | **Urgent Intervention**: Active near-miss or critical hazard. Ground vehicle immediately for overhaul. | `BUS-142 + Collision` ($95.5$ CRITICAL) |

> **Calibration Note**: A score of $82.0$ does **not** mean an "82% probability of a crash." It indicates that the volume, severity, cross-source diversity, and acceleration of accumulated evidence place the asset in the upper $80\text{th}$ percentile of operational concern.

---

## Canonical Demo Scenario: BUS-142

`BUS-142` serves as the primary demonstration vehicle in the bundled seed dataset:

### Chronological Signal Accumulation

```text
Day 1  │ Sep 01 09:15 │ Maintenance        │ Technician  │ Minor front brake pad wear noted during routine 30k inspection.
Day 5  │ Sep 05 17:40 │ Complaint          │ Passenger   │ Rider reported bus shuddered violently and took long to stop at 4th St.
Day 9  │ Sep 09 14:10 │ Inspection         │ Inspector   │ State safety audit logged brake caliper pressure imbalance (18%).
Day 14 │ Sep 14 07:25 │ Operational Report │ Driver      │ Morning driver noted brake pedal felt spongey with excessive travel.
Day 17 │ Sep 17 18:00 │ Near-Miss          │ Safety Off. │ Bus overshot red signal by 15 feet in wet weather; emergency stop applied.
```

### Risk Assessment Output

- **Current Risk Score**: **82.0 HIGH**
- **Confidence Score**: **86.0%**
- **Primary Subsystem**: **Braking System**
- **Factor Breakdown**:
  - Base Severity & Recency: $+25.0\text{ pts}$
  - Repeated Frequency Penalty: $+14.0\text{ pts}$ (4 repeated faults on braking)
  - Cross-Source Corroboration: $+20.0\text{ pts}$ (5 distinct reporting roles)
  - Temporal Acceleration: $+13.0\text{ pts}$ (event intervals contracted from 4.0 days to 3.0 days)
  - Near-Miss Anchor: $+10.0\text{ pts}$
- **Recommended Action**: `"IMMEDIATE ACTION REQUIRED: Ground BUS-142 immediately for comprehensive Braking System overhaul. Dispatch mobile maintenance unit and pull onboard telematics logs."`

### What-If Simulation Verification

- **Simulate a New Severe Braking Report Today**:
  - Score shifts: $82.0 \to \mathbf{85.5\text{ HIGH}}$ (monotonic increase, never decreases).
- **Simulate a Collision Scenario**:
  - Score shifts: $82.0 \to \mathbf{95.5\text{ CRITICAL}}$ (reaches critical intervention threshold).
- **Database Safety**: Zero database mutations; persistent record count remains unchanged.

---

## Mitigation & Verification Semantics

When corrective action is logged, PREVENT adjusts active risk while retaining the complete historical audit trail:

| Scenario | Risk Score | Risk Level | Rationale |
| :--- | :---: | :---: | :--- |
| **BUS-142 Baseline** | $82.0$ | `HIGH` | 5 unmitigated warning signals converging on braking. |
| **+ Completed Repair** (`"Brake pads replaced and caliper service completed"`) | $60.0$ | `MEDIUM` | Meaningful discount ($-22.0\text{ pts}$). Hazard addressed, but historical near-miss still monitored. |
| **+ Verified Inspection** (`"Post-repair inspection passed, brake deceleration certified"`) | $47.0$ | `MEDIUM` | Stronger discount ($-35.0\text{ pts}$). Certified post-repair inspection reduces active concern. |
| **+ Subsequent Warning Post-Repair** (`"Driver reports abnormal pedal feel post-service"`) | $85.5$ | `HIGH` | Recurring fault after repair eliminates mitigation discount and escalates risk back up. |

---

## "WHY NOW" Intelligence: Quiet vs. Escalating Assets

PREVENT provides clear contextual contrast between quiet baseline assets and actively escalating assets:

### Quiet Asset Example: `BUS-105` (Risk: 9.6 LOW)
- **Headline**: `"NO ACTIVE ESCALATION DETECTED — BUS-105 remains within normal operational baseline."`
- **Summary**: `"Last relevant signal: 1d ago (severity 1/5). No recent recurrence, no corroborating sources, and no current escalation."`
- **Active Signals**:
  - `[info] Active escalation state`: No active escalation detected
  - `[info] Observation context`: Last signal recorded 1d ago (severity 1/5)
  - `[info] Corroboration state`: Routine observations without compounding pattern

### Escalating Asset Example: `BUS-142` (Risk: 82.0 HIGH)
- **Headline**: `"BUS-142 has transitioned from isolated maintenance observations to a multi-source safety pattern."`
- **Summary**: `"Multiple independent warning signals around the braking subsystem have escalated from maintenance observation to near-miss."`
- **Active Signals**:
  - `[positive] Related signals detected`: 5 related signals detected
  - `[positive] Multiple independent sources`: 5 distinct sources
  - `[positive] Severity escalation`: Severity jumped from $2 \to 5$
  - `[positive] Temporal acceleration`: Intervals are contracting
  - `[critical] Near-miss detected`: 1 near-miss anchor
  - `[positive] Subsystem concentration`: All signals focus on braking

---

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                       │
│  TypeScript • Tailwind CSS • Recharts • Lucide • Vite Client │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTP REST JSON
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                   FastAPI Backend Service                    │
│                                                              │
│  ┌────────────────────────┐      ┌────────────────────────┐  │
│  │    Event Ingestion     │      │   LLM Provider Router  │  │
│  │   & Schema Validator   │◄────►│  Groq → Gemini → Mock  │  │
│  └───────────┬────────────┘      └────────────────────────┘  │
│              │                                               │
│              ▼                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │             Deterministic Risk Engine                  │  │
│  │  ├── Temporal Analyzer (interval contraction & decay)  │  │
│  │  ├── Correlation Engine (cross-source corroboration)   │  │
│  │  ├── Mitigation Evaluator (repair & audit discounts)   │  │
│  │  └── WHY NOW Analyzer (signal relevance synthesis)     │  │
│  └───────────────────────────┬────────────────────────────┘  │
└──────────────────────────────┼───────────────────────────────┘
                               │ SQLAlchemy ORM
                               ▼
┌──────────────────────────────────────────────────────────────┐
│               SQLite Database (prevent.db)                   │
│          Assets • Safety Events • Risk Assessments           │
└──────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technologies | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Recharts, Lucide React, React Router v7 | Responsive, high-density operational command dashboard with interactive charts and evidence graphs. |
| **Backend** | Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy, Uvicorn | High-performance asynchronous REST API with strict type validation and dependency injection. |
| **Intelligence** | Deterministic Risk Engine, Temporal Analyzer, Correlation Engine, Why-Now Analyzer | Mathematical risk calculation, confidence scoring, evidence graphs, and temporal decay. |
| **AI Extraction** | Multi-tier Router: Groq SDK (`openai/gpt-oss-20b`), Google GenAI SDK (`gemini-2.5-flash`), Mock Provider | Structured JSON extraction from natural-language reports with automatic resilient fallback. |
| **Storage** | SQLite (`sqlite:///./prevent.db`) | Zero-friction local development and deterministic test isolation (`prevent_test.db`). |
| **Testing** | Pytest, AnyIO | 113 automated unit, integration, calibration, and regression test cases. |

---

## LLM Provider Routing

PREVENT uses an isolated, multi-tiered router for natural-language event extraction:

```text
                    Raw Safety Report
                           │
                           ▼
                  ┌──────────────────┐
                  │   Groq PRIMARY   │
                  └────────┬─────────┘
                           │ (Temporary availability failure / 503 / 429)
                           ▼
                  ┌──────────────────┐
                  │ Gemini SECONDARY │
                  └────────┬─────────┘
                           │ (Temporary availability failure / 503 / 429)
                           ▼
                  ┌──────────────────┐
                  │  Mock FALLBACK   │ (Offline deterministic heuristic)
                  └────────┬─────────┘
                           │
                           ▼
                  Pydantic Schema Validation
                           │
                           ▼
                  Human Confirmation Modal
                           │
                           ▼
                     Database Ingestion
```

- **Failover Policy**: Only temporary network or capacity errors (`503 Service Unavailable`, `429 Rate Limit`) trigger fallback to the next provider tier.
- **Fail-Fast Policy**: Authentication errors (`401/403 Invalid API Key`) and invalid configuration raise explicit errors immediately to avoid silently masking misconfigurations.
- **Zero API Key Requirement**: For local offline evaluation or CI/CD pipelines, setting `LLM_PROVIDER=mock` executes full extraction without external network calls.

---

## Verified API Endpoints

All endpoints are hosted under `/api/v1` and verified via automated test suites:

| Method | Path | Summary | Description |
| :---: | :--- | :--- | :--- |
| `GET` | `/health` | Health Check | Returns `{"status": "ok"}` to verify backend liveness. |
| `GET` | `/api/v1/fleet/overview` | Fleet Overview | Evaluates all monitored assets, risk distribution, and attention queues. |
| `GET` | `/api/v1/assets/{asset_id}` | Full Asset Dossier | Returns risk score, confidence, factor waterfall, recommendations, and evidence graph. |
| `GET` | `/api/v1/assets/{asset_id}/timeline` | Event Timeline | Returns chronological event history with sources, severities, and metadata. |
| `GET` | `/api/v1/assets/{asset_id}/risk-history` | Risk Trajectory | Replays step-by-step risk scores as historical events accumulated. |
| `GET` | `/api/v1/assets/{asset_id}/why-now` | Why-Now Intelligence | Returns structured indicators explaining why the asset needs attention today. |
| `POST` | `/api/v1/events/extract` | Text Extraction Preview | Extracts structured event fields from multilingual free text for review **without database writes**. |
| `POST` | `/api/v1/events/extract-audio` | Audio Extraction Preview | Transcribes voice audio and extracts structured fields for review **without database writes**. |
| `POST` | `/api/v1/events` | Ingest Safety Event | Persists confirmed event and recalculates asset risk scores. |
| `POST` | `/api/v1/simulation/simulate-signal` | What-If Simulation | In-memory hypothetical signal simulation; returns before/after deltas with **zero DB mutations**. |

---

## Project Structure

```text
PREVENT/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/                 # Endpoints: fleet, assets, events, simulation
│   │   │   ├── deps.py             # FastAPI dependency injection (DB, RiskEngine, LLM)
│   │   │   └── router.py           # Root v1 API router
│   │   ├── core/
│   │   │   └── config.py           # Application settings and configurable scoring weights
│   │   ├── db/
│   │   │   ├── base.py             # SQLAlchemy declarative base metadata
│   │   │   └── session.py          # Database engine and sessionmaker
│   │   ├── models/                 # SQLAlchemy models (Asset, Event, RiskAssessment)
│   │   ├── schemas/                # Pydantic schemas (fleet, event, simulation, intelligence)
│   │   ├── services/
│   │   │   ├── llm/                # Multi-tier provider router (Groq, Gemini, Mock)
│   │   │   ├── correlation_engine.py  # Evidence graph and cross-source analysis
│   │   │   ├── event_ingestion.py     # Ingestion coordination and preview
│   │   │   ├── risk_engine.py         # Deterministic mathematical scoring engine
│   │   │   ├── temporal_analyzer.py   # Interval acceleration and decay heuristics
│   │   │   └── why_now_analyzer.py    # Contextual Why-Now narrative and signal generator
│   │   └── main.py                 # FastAPI application factory and CORS middleware
│   ├── .env.example                # Template for backend environment variables
│   └── .env                        # Local backend environment file (gitignored)
├── data/
│   └── scenarios/
│       ├── bus_142_escalation.json # Canonical 5-event braking escalation dataset
│       ├── fleet_baseline_noise.json # 7 background assets with 27 operational events
│       └── seed_data.py            # Database initialization and timestamp rebasing script
├── frontend/
│   ├── src/
│   │   ├── components/             # UI components (dossier, timeline, graph, simulator, why-now)
│   │   ├── pages/                  # Route views (Dashboard, AssetDetail)
│   │   ├── services/               # Axios/fetch API service client
│   │   ├── types/                  # TypeScript interface definitions matching schemas
│   │   ├── App.tsx                 # Route setup and layout wrappers
│   │   └── main.tsx                # React root mount
│   ├── package.json                # Frontend package dependencies and scripts
│   ├── vite.config.ts              # Vite configuration
│   └── .env.example                # Template for frontend environment variables
├── tests/                          # 113 automated verification tests across 10 test modules
├── prevent.db                      # Local SQLite operational database
├── prevent_test.db                 # Isolated SQLite test database
└── README.md                       # Repository engineering documentation
```

---

## Local Development Setup

### Prerequisites

- **Python 3.10+** (Python 3.11 recommended)
- **Node.js 18+** and **npm**
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/111aares123-eng/PREVENT.git
cd PREVENT
```

### 2. Backend Configuration & Setup

1. **Configure Environment Variables**:
   Copy `backend/.env.example` to `backend/.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```
   *(For offline development with Mock extraction, no API keys are required.)*

2. **Initialize and Seed the Database**:
   ```bash
   python -m data.scenarios.seed_data
   ```
   *Note: The seed script re-anchors the scenario timelines to current UTC so that all events fall within the rolling 30-day analysis window. To preserve frozen historical dates, pass `--frozen`.*

3. **Start the FastAPI Backend**:
   ```bash
   python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
   ```
   - Interactive OpenAPI documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
   - Health Check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

### 3. Frontend Setup

1. **Configure Environment**:
   Copy `frontend/.env.example` to `frontend/.env`:
   ```bash
   cp frontend/.env.example frontend/.env
   ```

2. **Install Dependencies & Start Dev Server**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   - Web Application Dashboard: [http://localhost:5173/](http://localhost:5173/)

---

## Environment Variables

All secrets remain strictly confined to the backend and are never exposed to client-side bundles.

### Backend (`backend/.env`)

```ini
# Multi-Tier Routing: groq (Primary) -> gemini (Secondary) -> mock (Final Fallback)
LLM_PRIMARY=groq
LLM_SECONDARY=gemini
LLM_FALLBACK=mock

# Groq Configuration (Primary)
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b

# Google Gemini Configuration (Secondary)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

# Database URL (Defaults to SQLite for local development)
DATABASE_URL=sqlite:///./prevent.db
```

### Frontend (`frontend/.env`)

```ini
VITE_API_BASE_URL=http://localhost:8000
```

> **Security Note**: `.env` files are ignored by git. Never commit API keys or production database credentials to source control.

---

## Verification & Testing

PREVENT maintains a comprehensive, deterministic test suite:

### Backend Test Suite

```bash
python -m pytest -v
```

- **Current Status**: **146 / 146 Tests Passing**
- **Test Modules**:
  - `test_phase1a_db_models.py`: Database schema integrity and relational constraints.
  - `test_phase1b_risk_engine.py`: Mathematical point attribution and factor formulas.
  - `test_phase1c_api.py`: FastAPI endpoints, error codes, and responses.
  - `test_phase1e_ai_ingestion.py`: Structured extraction, mock heuristics, and router failovers.
  - `test_phase2_risk_history_and_why_now.py`: Risk trajectory replay and Why-Now indicators.
  - `test_risk_engine_calibration.py`: Score bounds, monotonicity, and collision benchmarks.
  - `test_risk_behavior_mitigation_and_decay.py`: 16 regression cases covering decay, mitigation discounts, and post-repair re-escalation.
  - `test_timestamp_and_risk_window.py`: UTC clock handling and 30-day window preservation.
  - `test_clock_consistency.py`: Replay consistency across reference times.
  - `test_asset_id_authoritative_ingestion.py`: Operator asset assignment overrides.
  - `test_multilingual_text_ingestion.py`: Multilingual text understanding across English, Tamil, Hindi, Tanglish, and Hinglish.
  - `test_audio_ingestion.py`: Voice audio transcription pipeline, speech-to-text routing, and preview contracts.
  - `test_action_guidance.py`: Deterministic multilingual operational action guidance and database non-mutation invariance.

### Frontend Production Build

```bash
cd frontend
npm run build
```

- **Current Status**: **0 TypeScript errors, 0 Vite build warnings.**

---

## Design Principles

### What PREVENT Is NOT:
- **NOT an Accident Prediction Oracle**: PREVENT does not generate statistical percentages predicting whether a vehicle will crash tomorrow.
- **NOT a Replacement for Safety Professionals**: PREVENT surfaces correlated patterns; human inspectors verify mechanical integrity and decide operational outcomes.
- **NOT a Generic Predictive-Maintenance System**: PREVENT focuses specifically on escalating safety hazards and regulatory compliance risks across multi-source human and audit reports, rather than basic sensor vibration curves.
- **NOT a Black-Box AI Scorer**: The LLM never computes risk scores; all scoring is performed by transparent, auditable mathematical formulas.

### What PREVENT IS:
- **An Early-Warning Prioritization System**: Helps operations supervisors focus attention on the assets exhibiting the strongest compounding hazard signals.
- **A Multi-Source Correlation Layer**: Bridges the gap between disconnected teams (drivers, riders, mechanics, state inspectors).
- **An Explainable Decision-Support Tool**: Provides auditable, line-by-line justification for every point of assigned risk.
- **A Human-in-the-Loop Intelligence Assistant**: Keeps operators in control of evidence ingestion and operational response.

> *"Risk is not certainty. It is an indicator of where human attention is most urgently needed today."*

---

## Limitations

- **Observability Dependency**: PREVENT can only correlate signals that are recorded in data. Unreported anomalies cannot be factored into risk calculations.
- **Data Quality & Reporting Latency**: Delays or inaccuracies in initial shift logs can affect temporal acceleration calculations until corrected.
- **Context Dependence**: Subsystem importance and severity thresholds vary across operational domains (e.g., municipal buses vs. rail vs. aviation).
- **Human Action Requirement**: Calculating a risk score does not fix a vehicle; organizational processes must exist to take action on generated recommendations.

---

## Future Scope

The following capabilities represent architectural roadmaps for future enterprise integration:
- **Enterprise CMMS Integrations**: Bi-directional synchronization with platforms like IBM Maximo, SAP Plant Maintenance, and Fleetio.
- **Multi-Domain Expansion**: Tailored scoring profiles for rail rolling stock, maritime vessels, and commercial aviation ground equipment.
- **Closed-Loop Work Order Tracking**: Direct dispatching of work orders from PREVENT's recommended action interface.
- **Cryptographic Event Provenance**: Tamper-evident audit logging for regulatory compliance and accident investigation boards.
- **Real-Time Notification Dispatch**: Webhook and alert routing to Slack, PagerDuty, or SMS dispatch networks for `CRITICAL` risk alerts.
- **Production PostgreSQL Deployment**: Automated database migration scripts and containerized deployment manifests.

---

## Security & Data Privacy

- **Backend-Only Secrets**: All LLM API keys and database credentials reside exclusively in server-side environment variables.
- **No Client Exposure**: Vite build bundles contain zero secret keys or private provider URLs.
- **Human Verification Gate**: AI-extracted data is staged for human review before persistent database writes occur.
- **Non-Mutating Simulation**: What-If modeling executes strictly in memory with zero risk of corrupting historical audit data.

---

## License

No license has currently been specified for this project. All rights are reserved by the repository owner.

---

## Hackathon Context

PREVENT was conceptualized and developed as an **Open Innovation** safety intelligence hackathon project. It addresses the fundamental operational challenge of turning fragmented, low-intensity safety observations into actionable, explainable early-warning intelligence.
