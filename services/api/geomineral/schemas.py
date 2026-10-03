from datetime import datetime, timezone
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field, field_validator


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Point(BaseModel):
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lng: float = Field(ge=-180, le=180, allow_inf_nan=False)
    name: str = Field(default="Selected location", max_length=250)
    country_code: str | None = Field(default=None, max_length=3)


class Credentials(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=12, max_length=128)

    @field_validator("email")
    @classmethod
    def email_valid(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value or "." not in value.split("@")[-1]:
            raise ValueError("Enter a valid email address")
        return value


class Source(BaseModel):
    id: str
    provider_name: str
    provider_type: str
    dataset_name: str
    source_url: str
    api_url: str
    licence: str
    commercial_use_allowed: bool
    attribution_required: bool = True
    resolution: str
    data_format: str = "JSON"
    country_code: str | None = None
    status: str = "enabled"
    notes: str = ""


class Evidence(BaseModel):
    id: str
    source_id: str
    feature_id: str
    evidence_type: str
    description: str
    commodity: str | None = None
    direction: Literal["positive", "negative", "context", "missing"] = "context"
    strength: Literal["weak", "moderate", "strong"] = "weak"
    observed_or_inferred: Literal["observed", "reported", "model-derived", "inferred"] = "reported"
    reliability: str = "Regional; requires local verification"
    distance_m: float | None = None
    raw_value: dict = Field(default_factory=dict)
    retrieved_at: str = Field(default_factory=now)


class ProviderResult(BaseModel):
    source: Source
    status: Literal["available", "empty", "unavailable", "disabled"]
    evidence: list[Evidence] = Field(default_factory=list)
    occurrences: list[dict] = Field(default_factory=list)
    layers: dict = Field(default_factory=dict)
    message: str = ""
    retrieved_at: str = Field(default_factory=now)
    dataset_version: str = "Live service; upstream version unspecified"


class Category(StrEnum):
    INSUFFICIENT = "Insufficient evidence"
    LOW = "Low"
    MODERATE = "Moderate"
    HIGH = "High"


class Assessment(BaseModel):
    commodity: str
    prospectivity: Category
    evidence_quality: str
    explanation: str
    evidence_ids: list[str]
    missing: list[str]
    score: int = 0
    site_count: int = 0
    nearest_km: float | None = None
    producer_count: int = 0
    host_rocks: list[str] = Field(default_factory=list)
    papers: list[dict] = Field(default_factory=list)
    samples: list[dict] = Field(default_factory=list)


class AnalysisRequest(BaseModel):
    location: Point
    radius_km: float = Field(default=25, ge=1, le=100)


class ProjectInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    location: Point
    analysis_id: str | None = None
    polygon: list[list[float]] | None = Field(default=None, max_length=500)


class RecordInput(BaseModel):
    kind: Literal["observation", "sample"]
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=10000)
    location: Point
    rock_type: str = Field(default="", max_length=120)
    method: str = Field(default="", max_length=120)
    chain_of_custody: str = Field(default="", max_length=2000)
    photos: list[str] = Field(default_factory=list, max_length=3)
    # Voice note as a data URI; about two minutes of compressed speech.
    audio: str | None = Field(default=None, max_length=2_000_000)

    @field_validator("audio")
    @classmethod
    def clean_audio(cls, value: str | None) -> str | None:
        import re

        if value and not re.fullmatch(
            r"data:audio/(mp4|m4a|x-m4a|aac|mpeg|webm|ogg)(;codecs=[\w.]+)?;base64,[A-Za-z0-9+/=]+",
            value,
        ):
            raise ValueError("Voice note must be an audio file")
        return value or None

    @field_validator("photos")
    @classmethod
    def clean_photos(cls, values: list[str]) -> list[str]:
        from .photos import normalize_photo

        return [normalize_photo(value) for value in values]
