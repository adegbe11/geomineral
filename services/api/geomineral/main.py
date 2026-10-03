import asyncio
import json
import logging
import os
import re
import secrets
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from uuid import uuid4

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession

from . import config, deeptime, land
from .auth import (
    current_user,
    hash_password,
    require_admin,
    require_user,
    token_hash,
    verify_password,
)
from .db import (
    AnalysisRun,
    Base,
    DatasetState,
    FieldRecord,
    Project,
    Session,
    User,
    engine,
    get_db,
    upgrade_local,
)
from .geo import polygon_area_m2
from .providers import SOURCES
from .schemas import AnalysisRequest, Credentials, Point, ProjectInput, RecordInput
from .vision import ScanInput, identify
from .vision import status as vision_status

logging.basicConfig(level=logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app):
    if not config.PRODUCTION:
        Base.metadata.create_all(engine)
        upgrade_local(engine)
    yield


app = FastAPI(title="GeoMineral API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Guest-Token"],
)
requests: dict[str, deque] = defaultdict(deque)


@app.middleware("http")
async def guard(request: Request, call_next):
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("origin")
        if origin and origin not in config.ORIGINS:
            return Response("Origin not allowed", status_code=403)
        if request.headers.get("sec-fetch-site") == "cross-site":
            return Response("Cross-site request not allowed", status_code=403)
        limit = (
            11_500_000
            if request.url.path == "/api/scan"
            or re.fullmatch(r"/api/projects/[^/]+/records", request.url.path)
            else 100_000
        )
        size = 0
        chunks = []
        async for chunk in request.stream():
            size += len(chunk)
            if size > limit:
                return Response("Request too large", status_code=413)
            chunks.append(chunk)
        request._body = b"".join(chunks)
        key = (request.client.host if request.client else "local") + request.url.path
        queue, instant = requests[key], time.monotonic()
        while queue and queue[0] < instant - 60:
            queue.popleft()
        if len(queue) >= 20:
            return Response("Please wait a minute before trying again.", status_code=429)
        queue.append(instant)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/scan/status")
async def scan_status():
    return await vision_status()


@app.post("/api/scan")
async def scan(body: ScanInput, request: Request, user: User | None = Depends(current_user)):
    # Guests may scan with the app's guest token; a scan never stores photos.
    if not user and len(request.headers.get("x-guest-token", "")) < 32:
        raise HTTPException(401, "Sign in or open the app to scan.")
    return await identify(body)


def issue_session(user: User, db: DBSession, response: Response, mobile: bool = False):
    token = secrets.token_urlsafe(32)
    db.add(
        Session(token_hash=token_hash(token), user_id=user.id, expires_at=time.time() + 86400 * 7)
    )
    db.commit()
    if mobile:
        return {"id": user.id, "email": user.email, "is_admin": user.is_admin, "token": token}
    response.set_cookie(
        "gm_session",
        token,
        httponly=True,
        secure=config.COOKIE_SECURE,
        samesite="lax",
        max_age=86400 * 7,
        path="/",
    )
    return {"id": user.id, "email": user.email, "is_admin": user.is_admin}


@app.post("/api/auth/register", status_code=201)
@app.post("/api/mobile/auth/register", status_code=201)
def register(
    body: Credentials, request: Request, response: Response, db: DBSession = Depends(get_db)
):
    user = User(id=str(uuid4()), email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Unable to create account with these details. Try signing in.")
    return issue_session(user, db, response, mobile=request.url.path.startswith("/api/mobile/"))


@app.post("/api/auth/login")
@app.post("/api/mobile/auth/login")
def login(body: Credentials, request: Request, response: Response, db: DBSession = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Email or password was not recognized.")
    return issue_session(user, db, response, mobile=request.url.path.startswith("/api/mobile/"))


@app.post("/api/auth/logout")
def logout(request: Request, response: Response, db: DBSession = Depends(get_db)):
    authorization = request.headers.get("authorization", "")
    token = (
        authorization[7:]
        if authorization.startswith("Bearer ")
        else request.cookies.get("gm_session", "")
    )
    session = db.get(Session, token_hash(token))
    if session:
        db.delete(session)
        db.commit()
    response.delete_cookie("gm_session", path="/")
    return {"ok": True}


@app.get("/api/auth/me")
def me(user: User | None = Depends(current_user)):
    return {"id": user.id, "email": user.email, "is_admin": user.is_admin} if user else None


@app.post("/api/mobile/guest")
def mobile_guest():
    return {"token": secrets.token_urlsafe(32)}


geocoder_lock = asyncio.Lock()
last_geocode = 0.0
geocoder_cache: dict[str, tuple[float, list]] = {}


@app.get("/api/search")
async def search(q: str):
    global last_geocode
    q = q.strip()
    if len(q) < 2 or len(q) > 200:
        raise HTTPException(422, "Enter a place name or latitude, longitude.")
    if re.fullmatch(r"[+\-\d.eE\s]+,[+\-\d.eE\s]+", q):
        try:
            lat, lng = [float(part.strip()) for part in q.split(",")]
            return [Point(lat=lat, lng=lng, name=f"{lat:.5f}, {lng:.5f}").model_dump()]
        except (ValueError, TypeError):
            raise HTTPException(
                422, "Latitude must be between -90 and 90; longitude between -180 and 180."
            )
    if q in geocoder_cache and geocoder_cache[q][0] > time.monotonic() - 3600:
        return geocoder_cache[q][1]
    async with geocoder_lock:
        await asyncio.sleep(max(0, 1.1 - (time.monotonic() - last_geocode)))
        last_geocode = time.monotonic()
        try:
            async with httpx.AsyncClient(
                timeout=12, headers={"User-Agent": config.USER_AGENT}
            ) as client:
                result = await client.get(
                    os.getenv("GEOCODER_URL", "https://nominatim.openstreetmap.org/search"),
                    params={"q": q, "format": "jsonv2", "limit": 6, "addressdetails": 1},
                )
                result.raise_for_status()
                places = [
                    Point(
                        lat=float(row["lat"]),
                        lng=float(row["lon"]),
                        name=row["display_name"],
                        country_code=row.get("address", {}).get("country_code", "").upper() or None,
                    ).model_dump()
                    for row in result.json()
                ]
                if len(geocoder_cache) >= 500:
                    geocoder_cache.clear()
                geocoder_cache[q] = (time.monotonic(), places)
                return places
        except (httpx.HTTPError, ValueError, KeyError):
            raise HTTPException(
                503,
                "Place search is temporarily unavailable. Enter latitude, longitude or drop a pin on the map.",
            )


@app.get("/api/land")
async def land_status(lat: float, lng: float):
    point = Point(lat=lat, lng=lng)
    try:
        return await land.lookup(point.lat, point.lng)
    except (httpx.HTTPError, ValueError, KeyError):
        raise HTTPException(503, "Land status is unavailable right now.")


@app.get("/api/deeptime")
async def deep_time(lat: float, lng: float):
    point = Point(lat=lat, lng=lng)
    return {"ages": await deeptime.positions(point.lat, point.lng)}


@app.get("/api/deeptime/coastlines")
async def deep_time_coastlines(age: int):
    if age not in deeptime.AGES:
        raise HTTPException(422, "Unsupported age")
    try:
        return {"age": age, "rings": await deeptime.coastlines(age)}
    except (httpx.HTTPError, ValueError, KeyError):
        raise HTTPException(503, "Past maps are unavailable right now.")


@app.get("/api/reverse")
async def reverse(lat: float, lng: float):
    """Short place name for a point; falls back to coordinates when unknown."""
    global last_geocode
    point = Point(lat=lat, lng=lng)
    key = f"rev:{point.lat:.3f},{point.lng:.3f}"
    if key in geocoder_cache and geocoder_cache[key][0] > time.monotonic() - 3600:
        return geocoder_cache[key][1]
    fallback = Point(lat=lat, lng=lng, name=f"{lat:.5f}, {lng:.5f}").model_dump()
    async with geocoder_lock:
        await asyncio.sleep(max(0, 1.1 - (time.monotonic() - last_geocode)))
        last_geocode = time.monotonic()
        try:
            async with httpx.AsyncClient(
                timeout=8, headers={"User-Agent": config.USER_AGENT}
            ) as client:
                result = await client.get(
                    os.getenv(
                        "REVERSE_GEOCODER_URL", "https://nominatim.openstreetmap.org/reverse"
                    ),
                    params={"lat": lat, "lon": lng, "format": "jsonv2", "zoom": 10},
                )
                result.raise_for_status()
                row = result.json()
        except (httpx.HTTPError, ValueError):
            return fallback
    address = row.get("address", {}) if isinstance(row, dict) else {}
    parts = [
        address.get(k)
        for k in ("city", "town", "village", "municipality", "county", "state", "country")
        if address.get(k)
    ]
    if not parts:
        return fallback
    place = Point(
        lat=lat,
        lng=lng,
        name=", ".join(dict.fromkeys(parts[:3]))[:250],
        country_code=(address.get("country_code") or "").upper()[:3] or None,
    ).model_dump()
    if len(geocoder_cache) >= 500:
        geocoder_cache.clear()
    geocoder_cache[key] = (time.monotonic(), place)
    return place


def accessible_run(run: AnalysisRun | None, user: User | None, request: Request):
    guest = request.headers.get("x-guest-token") or request.cookies.get("gm_guest", "")
    if not run or not (
        (user and run.user_id == user.id)
        or (run.user_id is None and guest and run.guest_hash == token_hash(guest))
    ):
        raise HTTPException(404, "Analysis not found.")
    return run


@app.post("/api/analyses", status_code=202)
def analyze(
    body: AnalysisRequest,
    request: Request,
    response: Response,
    user: User | None = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    guest = (
        request.headers.get("x-guest-token")
        or request.cookies.get("gm_guest")
        or secrets.token_urlsafe(32)
    )
    if not user:
        response.set_cookie(
            "gm_guest",
            guest,
            httponly=True,
            secure=config.COOKIE_SECURE,
            samesite="lax",
            max_age=86400,
            path="/",
        )
    run = AnalysisRun(
        id=str(uuid4()),
        user_id=user.id if user else None,
        guest_hash=token_hash(guest) if not user else None,
        request_json=body.model_dump_json(),
    )
    db.add(run)
    db.commit()
    return {"id": run.id, "status": run.status}


@app.get("/api/analyses/{run_id}")
def get_analysis(
    run_id: str,
    request: Request,
    user: User | None = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    run = accessible_run(db.get(AnalysisRun, run_id), user, request)
    return {
        "id": run.id,
        "status": run.status,
        "progress": json.loads(run.progress) if run.progress else {},
        "result": json.loads(run.result_json) if run.result_json else None,
        "error": run.error,
    }


def owned_project(project_id: str, user: User, db: DBSession) -> Project:
    project = db.get(Project, project_id)
    if not project or project.owner_id != user.id:
        raise HTTPException(404, "Project not found.")
    return project


def project_dict(project: Project):
    return {
        **json.loads(project.payload),
        "id": project.id,
        "name": project.name,
        "created_at": project.created_at,
        "visibility": "Private",
    }


@app.get("/api/projects")
def projects(user: User = Depends(require_user), db: DBSession = Depends(get_db)):
    owned = list(
        db.scalars(
            select(Project).where(Project.owner_id == user.id).order_by(Project.created_at.desc())
        )
    )
    counts = dict(
        db.execute(
            select(FieldRecord.project_id, func.count())
            .where(FieldRecord.project_id.in_([p.id for p in owned]))
            .group_by(FieldRecord.project_id)
        ).all()
    )
    return [{**project_dict(p), "record_count": counts.get(p.id, 0)} for p in owned]


class ProjectRename(BaseModel):
    name: str = Field(min_length=1, max_length=120)


@app.patch("/api/projects/{project_id}")
def rename_project(
    project_id: str,
    body: ProjectRename,
    user: User = Depends(require_user),
    db: DBSession = Depends(get_db),
):
    project = owned_project(project_id, user, db)
    project.name = body.name.strip()
    db.commit()
    return project_dict(project)


@app.delete("/api/projects/{project_id}", status_code=204)
def delete_project(
    project_id: str, user: User = Depends(require_user), db: DBSession = Depends(get_db)
):
    project = owned_project(project_id, user, db)
    for record in db.scalars(select(FieldRecord).where(FieldRecord.project_id == project.id)):
        db.delete(record)
    db.delete(project)
    db.commit()
    return Response(status_code=204)


@app.delete("/api/projects/{project_id}/records/{record_id}", status_code=204)
def delete_record(
    project_id: str,
    record_id: str,
    user: User = Depends(require_user),
    db: DBSession = Depends(get_db),
):
    owned_project(project_id, user, db)
    record = db.get(FieldRecord, record_id)
    if not record or record.project_id != project_id:
        raise HTTPException(404, "Record not found")
    db.delete(record)
    db.commit()
    return Response(status_code=204)


@app.post("/api/projects", status_code=201)
def create_project(
    body: ProjectInput,
    request: Request,
    user: User = Depends(require_user),
    db: DBSession = Depends(get_db),
):
    payload = body.model_dump()
    if body.analysis_id:
        run = accessible_run(db.get(AnalysisRun, body.analysis_id), user, request)
        analyzed = AnalysisRequest.model_validate_json(run.request_json).location
        if (
            abs(analyzed.lat - body.location.lat) > 1e-6
            or abs(analyzed.lng - body.location.lng) > 1e-6
        ):
            raise HTTPException(422, "The attached analysis must describe this project point.")
    if body.polygon:
        try:
            payload["area_m2"] = polygon_area_m2(body.polygon)
        except ValueError as exc:
            raise HTTPException(422, str(exc))
    project = Project(
        id=str(uuid4()), owner_id=user.id, name=body.name.strip(), payload=json.dumps(payload)
    )
    db.add(project)
    db.commit()
    return project_dict(project)


@app.get("/api/records")
def my_records(user: User = Depends(require_user), db: DBSession = Depends(get_db)):
    """Every record the user owns, newest first, without photo data."""
    rows = db.execute(
        select(FieldRecord, Project.name)
        .join(Project, FieldRecord.project_id == Project.id)
        .where(Project.owner_id == user.id)
        .order_by(FieldRecord.created_at.desc())
    ).all()
    out = []
    for record, project_name in rows:
        payload = json.loads(record.payload)
        photos = payload.pop("photos", []) or []
        payload.pop("audio", None)
        out.append(
            {
                "id": record.id,
                "project_id": record.project_id,
                "project_name": project_name,
                "created_at": record.created_at,
                "photo_count": len(photos),
                **payload,
            }
        )
    return out


@app.get("/api/projects/{project_id}")
def project_detail(
    project_id: str, user: User = Depends(require_user), db: DBSession = Depends(get_db)
):
    project = owned_project(project_id, user, db)
    records = [
        {"id": r.id, "created_at": r.created_at, **json.loads(r.payload)}
        for r in db.scalars(
            select(FieldRecord)
            .where(FieldRecord.project_id == project.id)
            .order_by(FieldRecord.created_at.desc())
        )
    ]
    return {**project_dict(project), "records": records}


@app.post("/api/projects/{project_id}/records", status_code=201)
def create_record(
    project_id: str,
    body: RecordInput,
    user: User = Depends(require_user),
    db: DBSession = Depends(get_db),
):
    owned_project(project_id, user, db)
    if body.kind == "sample":
        records = db.scalars(select(FieldRecord).where(FieldRecord.project_id == project_id))
        if any(
            json.loads(r.payload)["title"] == body.title
            and json.loads(r.payload)["kind"] == "sample"
            for r in records
        ):
            raise HTTPException(409, "That sample ID already exists in this project.")
    record = FieldRecord(id=str(uuid4()), project_id=project_id, payload=body.model_dump_json())
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "That sample ID already exists in this project.")
    return {
        "id": record.id,
        "created_at": record.created_at,
        **body.model_dump(),
        "verification": "Private; unverified",
    }


@app.get("/api/projects/{project_id}/report")
def report(project_id: str, user: User = Depends(require_user), db: DBSession = Depends(get_db)):
    project = owned_project(project_id, user, db)
    payload = json.loads(project.payload)
    run = db.get(AnalysisRun, payload.get("analysis_id")) if payload.get("analysis_id") else None
    return {
        "project": project_detail(project_id, user, db),
        "owner": user.email,
        "analysis": json.loads(run.result_json) if run and run.result_json else None,
        "notice": "Geological context only. Not a mineral resource estimate or authorization to explore.",
    }


@app.get("/api/datasets")
def datasets(db: DBSession = Depends(get_db)):
    states = {s.id: s.enabled for s in db.scalars(select(DatasetState))}
    return [
        {
            **s.model_dump(),
            "status": "enabled" if states.get(s.id, True) and config.LIVE_PROVIDERS else "disabled",
        }
        for s in SOURCES
    ]


class DatasetUpdate(BaseModel):
    enabled: bool


@app.patch("/api/admin/datasets/{source_id}")
def dataset_update(
    source_id: str,
    body: DatasetUpdate,
    user: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    if source_id not in {s.id for s in SOURCES}:
        raise HTTPException(404, "Unknown dataset.")
    state = db.get(DatasetState, source_id) or DatasetState(id=source_id)
    state.enabled = body.enabled
    db.add(state)
    db.commit()
    log.info("dataset_changed actor=%s source=%s enabled=%s", user.id, source_id, body.enabled)
    return {"id": source_id, "enabled": state.enabled}
