# PREVENT

> **Connecting the warnings before they become incidents.**

PREVENT is an early-warning safety intelligence and decision-support platform. It connects weak, distributed warning signals—such as maintenance logs, driver reports, passenger complaints, safety audits, and near-miss records—across time, operational subsystems, and reporting roles to identify escalating risks before they manifest as critical failures.

---

## What PREVENT Does

In complex operational environments (such as public transit fleets, aviation, manufacturing, or healthcare), warning signs rarely appear all at once in a single system. Instead, disparate signals accumulate across silos:
- A routine maintenance check detects early component wear.
- A passenger submits a subtle ride-quality complaint.
- A regular inspection notes an intermittent fault.
- A driver logs abnormal control responsiveness.
- A near-miss event is reported.

Viewed in isolation, each report may appear minor or acceptable. However, when correlated temporally and by subsystem, they reveal compounding, accelerating safety risks. PREVENT correlates these multi-source signals, calculates an explainable risk score (0–100) and evidence confidence score (0–100%), constructs an evidence relationship graph, and generates prioritized preventive actions.

---

## Current MVP Scope

- **Domain Scenario**: Fleet safety management for municipal transit buses.
- **Reference Target**: Asset `BUS-142` exhibiting an escalating 5-event braking progression across 5 independent operational roles.
- **Fleet Baseline**: 7 background assets with 27 normal and medium operational events for contextual fleet comparison.
- **Deterministic Risk Engine**: Multi-factor scoring model with transparent factor breakdowns:
  - Base Severity & Exponential Recency Decay ($t_{1/2} = 10$ days)
  - Frequency Penalty
  - Cross-Source Corroboration
  - Temporal Escalation & Interval Contraction
  - Near-Miss Anchor
- **Evidence Confidence**: Independent metric reflecting signal diversity, volume, and cross-source consistency.
- **Interactive What-If Simulation**: In-memory hypothetical scenario modeling that tests how prospective signals impact asset risk without altering database records.
- **Operational Dashboard**: Control-room styled React dashboard displaying fleet KPIs, risk distributions, sortable attention queues, factor waterfalls, chronological timelines, evidence graphs, and simulation tools.

---

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy, Pydantic v2, SQLite, Pytest
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide React, Recharts, React Router v7
- **Architecture**: Modular service-oriented design (RiskEngine, TemporalAnalyzer, CorrelationEngine) exposing clean REST APIs.

---

## Project Structure

```text
PREVENT/
├── backend/
│   └── app/
│       ├── api/
│       │   └── v1/             # Fleet, asset, timeline, and simulation endpoints
│       ├── core/               # Risk engine weights and application config
│       ├── db/                 # Database engine and session management
│       ├── models/             # SQLAlchemy ORM models (Asset, Event, RiskAssessment)
│       ├── schemas/            # Pydantic request/response schemas
│       ├── services/           # RiskEngine, TemporalAnalyzer, CorrelationEngine
│       └── main.py             # FastAPI entrypoint and middleware
├── data/
│   └── scenarios/              # Seed datasets (BUS-142 escalation, fleet noise)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── assets/         # AssetHeader
│   │   │   ├── dashboard/      # FleetKpiCards, RiskDistributionChart, AssetsTable
│   │   │   ├── evidence/       # EvidenceGraphView
│   │   │   ├── layout/         # Navigation Header
│   │   │   ├── risk/           # RiskBadge, TrendBadge, FactorWaterfall, RiskScoreGauge
│   │   │   ├── simulation/     # WhatIfSimulator
│   │   │   └── timeline/       # EventTimeline
│   │   ├── pages/              # Dashboard, AssetDetail
│   │   ├── services/           # Centralized API service client
│   │   ├── types/              # TypeScript API interfaces
│   │   ├── App.tsx             # Route definitions
│   │   └── main.tsx            # React application root
├── tests/                      # Automated pytest test suite (28 tests)
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- Git

### 1. Database Setup & Seeding

From the project root:

```bash
# Seed the SQLite database with fleet baseline and target scenarios
python -m data.scenarios.seed_data
```

### 2. Running the Backend

```bash
# Start FastAPI backend server on port 8000
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

The interactive OpenAPI documentation will be accessible at:
- Swagger UI: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

### 3. Running the Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

The dashboard will be available at:
- Web UI: `http://localhost:5173/`

### 4. Running Tests

Run the backend verification suite (covers database models, risk algorithms, temporal analysis, and API endpoints):

```bash
python -m pytest -v
```
