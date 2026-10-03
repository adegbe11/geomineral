"""Durable SQL-backed worker. Claim jobs atomically; preserve each source snapshot."""

import asyncio
import json
import logging
import time

from sqlalchemy import select, update

from .analysis import build_analysis
from .config import PRODUCTION
from .db import AnalysisRun, Base, DatasetState, SessionLocal, engine
from .providers import collect
from .schemas import AnalysisRequest

log = logging.getLogger(__name__)


async def process_one() -> bool:
    with SessionLocal() as db:
        db.execute(
            update(AnalysisRun)
            .where(AnalysisRun.status == "processing", AnalysisRun.claimed_at < time.time() - 180)
            .values(status="queued")
        )
        run = db.scalar(
            select(AnalysisRun)
            .where(AnalysisRun.status == "queued")
            .order_by(AnalysisRun.created_at)
            .limit(1)
        )
        if not run:
            db.commit()
            return False
        claimed = db.execute(
            update(AnalysisRun)
            .where(AnalysisRun.id == run.id, AnalysisRun.status == "queued")
            .values(status="processing", claimed_at=time.time())
        )
        db.commit()
        if not claimed.rowcount:
            return True
        run_id, request = run.id, AnalysisRequest.model_validate_json(run.request_json)
        disabled = {
            s.id for s in db.scalars(select(DatasetState).where(DatasetState.enabled.is_(False)))
        }
    try:
        providers = await collect(request.location, request.radius_km, disabled)
        result = build_analysis(request, providers)
        with SessionLocal() as db:
            db.execute(
                update(AnalysisRun)
                .where(AnalysisRun.id == run_id)
                .values(status="complete", result_json=json.dumps(result))
            )
            db.commit()
    except Exception:
        log.exception("analysis_failed id=%s", run_id)
        with SessionLocal() as db:
            db.execute(
                update(AnalysisRun)
                .where(AnalysisRun.id == run_id)
                .values(
                    status="failed", error="The analysis could not be completed. Please try again."
                )
            )
            db.commit()
    return True


async def main():
    if not PRODUCTION:
        Base.metadata.create_all(engine)
    while True:
        if not await process_one():
            await asyncio.sleep(1)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    asyncio.run(main())
