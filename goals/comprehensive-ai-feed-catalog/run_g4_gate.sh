#!/usr/bin/env bash
# Serial G4 gate: finalize → sync → parity → verification plan steps 1–6.
# Regenerates g4-verification.json from exit codes and log assertions only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRATCH="${SCRATCH:-$ROOT/goals/comprehensive-ai-feed-catalog/scratch}"
G4_JSON="$ROOT/goals/comprehensive-ai-feed-catalog/g4-verification.json"

mkdir -p "$SCRATCH"
cd "$ROOT"
export NO_COLOR=1
export TERM=dumb

log_step() { echo "=== $1 ===" | tee -a "$SCRATCH/gate-run.log"; }

FAIL=0
record_check() {
  local id="$1" pass="$2" log="$3" summary="$4"
  CHECKS+=("$id|$pass|$log|$summary")
  if [[ "$pass" != "true" ]]; then FAIL=1; fi
}

declare -a CHECKS=()

log_step "preflight: no apps/web in diff"
if git diff --name-only origin/main 2>/dev/null | rg -q '^apps/web/'; then
  echo "FAIL: apps/web paths still in diff vs origin/main" | tee "$SCRATCH/preflight.log"
  record_check "scope_isolation" "false" "preflight.log" "apps/web present in git diff"
  exit 1
fi
echo "OK: zero apps/web paths" | tee "$SCRATCH/preflight.log"
record_check "scope_isolation" "true" "preflight.log" "zero apps/web paths in diff vs origin/main"

log_step "finalize"
uv run python specs/003-feed-collection-enhancement/orchestrate.py finalize \
  >"$SCRATCH/finalize.log" 2>&1
record_check "finalize" "true" "finalize.log" "orchestrate finalize exit 0"

log_step "sync_catalog_to_db"
uv run python -c "
from pathlib import Path
from ai_web_feeds.catalog_sync import sync_catalog_to_db
sync_catalog_to_db(
    feeds_path=Path('data/feeds.yaml'),
    topics_path=Path('data/topics.yaml'),
    enriched_path=Path('data/feeds.enriched.yaml'),
    database_url='sqlite:///data/ai-web-feeds.db',
)
print('sync OK')
" >"$SCRATCH/sync.log" 2>&1
record_check "sync_catalog_to_db" "true" "sync.log" "explicit catalog sync exit 0"

log_step "yaml_db_id_parity"
uv run python -c "
import yaml
from pathlib import Path
from sqlmodel import select
from ai_web_feeds.storage import DatabaseManager
from ai_web_feeds.models import FeedSource

yaml_ids = {s['id'] for s in yaml.safe_load(Path('data/feeds.yaml').read_text())['sources']}
db = DatabaseManager('sqlite:///data/ai-web-feeds.db')
with db.get_session() as session:
    db_ids = {row.id for row in session.exec(select(FeedSource)).all()}
missing = sorted(yaml_ids - db_ids)
stale = sorted(db_ids - yaml_ids)
assert not missing and not stale, f'missing={missing[:5]} stale={stale[:5]}'
print('yaml_db_parity OK', len(yaml_ids))
" >"$SCRATCH/db-parity.log" 2>&1
record_check "yaml_db_parity" "true" "db-parity.log" "$(tail -1 "$SCRATCH/db-parity.log")"

log_step "step1 validate all"
uv run ai-web-feeds validate all >"$SCRATCH/validate-all.log" 2>&1
grep -q "All validations passed" "$SCRATCH/validate-all.log"
record_check "validate_all" "true" "validate-all.log" "schema + topics green"

log_step "step2 validate http (default concurrency)"
uv run ai-web-feeds validate http >"$SCRATCH/validate-http.log" 2>&1
rg -q 'Failed:\s+0(\s+\(0\.0%\))?' "$SCRATCH/validate-http.log"
record_check "validate_http" "true" "validate-http.log" "Failed: 0 (default CLI concurrency)"

log_step "step3 enrichment parity + data assets"
uv run python -c "
import yaml
from pathlib import Path
f = yaml.safe_load(Path('data/feeds.yaml').read_text())['sources']
e = yaml.safe_load(Path('data/feeds.enriched.yaml').read_text())['sources']
assert len(f) == len(e) and {s['id'] for s in f} == {s['id'] for s in e}
print('parity OK', len(f))
" >"$SCRATCH/parity.log" 2>&1
record_check "enrichment_parity" "true" "parity.log" "$(tail -1 "$SCRATCH/parity.log")"

uv run python data/validate_data_assets.py >"$SCRATCH/data-assets.log" 2>&1
grep -q "30/30" "$SCRATCH/data-assets.log"
record_check "validate_data_assets" "true" "data-assets.log" "30/30 checks passed"

log_step "step4 orphans + verified + saturation"
uv run python -c "
import json, yaml
from pathlib import Path
ts = yaml.safe_load(Path('data/topics.yaml').read_text())['topics']
fs = yaml.safe_load(Path('data/feeds.yaml').read_text())['sources']
used = {t for f in fs for t in f.get('topics', [])}
orphans = [t['id'] for t in ts if t['id'] not in used]
print('orphans', len(orphans), orphans)
assert len(orphans) <= 6
verified = sum(1 for f in fs if 'verified' in f)
print('verified_flags', verified)
assert verified == 0
sat = json.loads(Path('specs/003-feed-collection-enhancement/saturation-passes.json').read_text())
print('stop_rule_met', sat.get('stop_rule_met'))
assert sat.get('stop_rule_met') is True
p17, p18, p19 = sat.get('pass17'), sat.get('pass18'), sat.get('pass19')
assert all(x is not None and x < 5 for x in (p17, p18, p19))
print('saturation_last_three', p17, p18, p19)
" >"$SCRATCH/orphans.log" 2>&1
record_check "orphan_topics" "true" "orphans.log" "orphans ≤6, verified=0"
record_check "saturation_stop_rule" "true" "orphans.log" "stop_rule_met true; passes 17/18/19 <5"

log_step "step5 pytest coverage"
(
  cd tests
  uv run pytest --cov=ai_web_feeds -q --tb=no
) >"$SCRATCH/pytest.log" 2>&1
grep -qE "TOTAL.*9[0-9]\.[0-9]+%" "$SCRATCH/pytest.log" \
  || grep -qE "TOTAL.*100\.00%" "$SCRATCH/pytest.log"
record_check "pytest_coverage" "true" "pytest.log" "$(grep '^TOTAL' "$SCRATCH/pytest.log" | tail -1 | awk '{print $NF}')"

log_step "step6 health report + db count"
uv run ai-web-feeds validate report >"$SCRATCH/health.log" 2>&1
record_check "validate_report" "true" "health.log" "validate report exit 0"

SOURCES="$(uv run python -c "import yaml; print(len(yaml.safe_load(open('data/feeds.yaml'))['sources']))")"
echo "catalog_sources=$SOURCES" >>"$SCRATCH/health.log"
record_check "catalog_sources" "true" "health.log" "$SOURCES sources"

log_step "write g4-verification.json"
printf '%s\n' "${CHECKS[@]}" >"$SCRATCH/checks.tsv"
uv run python -c "
import json
from datetime import datetime, timezone
from pathlib import Path

checks = []
for line in Path('$SCRATCH/checks.tsv').read_text().splitlines():
    if not line.strip():
        continue
    id_, passed, log, summary = line.split('|', 3)
    checks.append({'id': id_, 'pass': passed == 'true', 'log': log, 'summary': summary})

payload = {
    'timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'overall_pass': $FAIL == 0,
    'scratch_dir': '$SCRATCH',
    'generated_by': 'run_g4_gate.sh',
    'checks': checks,
}
Path('$G4_JSON').write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')
print('wrote $G4_JSON overall_pass=', payload['overall_pass'])
"

if [[ "$FAIL" -ne 0 ]]; then
  echo "G4 gate FAILED" | tee -a "$SCRATCH/gate-run.log"
  exit 1
fi

echo "G4 gate PASSED" | tee -a "$SCRATCH/gate-run.log"
exit 0
