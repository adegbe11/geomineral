"""Contract for a future reviewed visual-identification service.

No production model or upload storage is connected. The disabled adapter is an
explicit capability response, never a simulated identification.
"""

from typing import Literal, Protocol

from pydantic import BaseModel, Field


class RockCandidate(BaseModel):
    name: str
    confidence: Literal["Very Limited", "Limited", "Moderate"]
    observed_features: list[str]
    limitations: list[str]
    suggested_nonhazardous_checks: list[str]


class RockIdentification(BaseModel):
    status: Literal["unavailable", "insufficient_photos", "complete"]
    candidates: list[RockCandidate] = Field(default_factory=list)
    message: str
    model_version: str | None = None


class RockIdentificationProvider(Protocol):
    async def identify(self, private_object_keys: list[str]) -> RockIdentification: ...


class UnavailableRockProvider:
    async def identify(self, private_object_keys: list[str]) -> RockIdentification:
        return RockIdentification(
            status="unavailable",
            message="Photo identification is not connected. No mineral identification has been made.",
        )
