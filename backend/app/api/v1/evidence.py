"""
Evidence Track API Endpoint.

Provides read-only access to empirical real-world safety evidence derived from
official NHTSA Office of Defects Investigation (ODI) public datasets.

This endpoint is completely isolated from PREVENT's operational RiskEngine and
database models, providing retrospective validation for signal convergence.
"""
from fastapi import APIRouter, status
from backend.app.services.evidence.nhtsa_analyzer import NHTSAEvidenceAnalyzer

router = APIRouter(prefix="/evidence", tags=["Real-World Evidence"])


@router.get(
    "/nhtsa",
    status_code=status.HTTP_200_OK,
    summary="Get NHTSA Real-World Safety Evidence",
    description=(
        "Returns empirical, retrospective analysis of official NHTSA public complaints "
        "and recalls evaluating PREVENT's core signal convergence hypothesis. "
        "Operates strictly read-only on verified local evidence snapshots with zero DB coupling."
    )
)
def get_nhtsa_evidence() -> dict:
    """Retrieve normalized evidence metrics and traceable exemplar records."""
    analyzer = NHTSAEvidenceAnalyzer()
    return analyzer.analyze()
