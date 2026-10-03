"""Opt-in, live service smoke test. Never treats test points as deposits."""
import asyncio
import json
from pathlib import Path
from geomineral.analysis import build_analysis
from geomineral.providers import collect
from geomineral.schemas import AnalysisRequest, Point, now

REGIONS = [('Kalgoorlie', -30.7489, 121.4658, 'AU'), ('Greenbushes', -33.85, 116.06, 'AU'), ('Calama', -22.315, -68.929, 'CL'), ('Peak District', 53.30, -1.80, 'GB'), ('Pacific control', 0, -140, None), ('San Francisco', 37.7, -122.4, 'US'), ('Uhonmora development point', 6.98, 6.12, 'NG'), ('Sudbury', 46.49, -80.99, 'CA')]


async def main():
    results = []
    for name, lat, lng, country in REGIONS:
        point = Point(name=name, lat=lat, lng=lng, country_code=country)
        sources = await collect(point, 25, set())
        result = build_analysis(AnalysisRequest(location=point), sources)
        results.append({'location': point.model_dump(), 'retrieved_at': now(), 'providers': [{'id': s.source.id, 'status': s.status, 'evidence_count': len(s.evidence), 'occurrence_count': len(s.occurrences)} for s in sources], 'assessments': result['assessments'], 'evidence_quality': result['evidence_quality'], 'model_version': result['model_version']})
        print(name, [(s.source.id, s.status, len(s.evidence)) for s in sources], flush=True)
    Path('docs/validation-live.json').write_text(json.dumps(results, indent=2), encoding='utf-8')


if __name__ == '__main__':
    asyncio.run(main())
