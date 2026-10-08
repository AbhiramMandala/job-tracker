"""One-off evaluation: precision / recall / F1 of the duplicate-listing filter.

Runs hand-labeled listing pairs through `is_duplicate_norms` and reports
metrics plus every miss. Labels are the author's judgments on synthetic
fixtures — this measures performance on THESE fixtures, not real-world
accuracy. Real-world accuracy would need labeled production pairs.

Run:  python eval_dedup_metrics.py        (no API key, no network, no DB)
"""

from app.schemas.jobs import JobItem
from app.services.deduplicator import is_duplicate_norms
from app.services.normalizer import normalize_job

LINK_A = [{"title": "Apply", "link": "https://indeed.com/j123"}]
LINK_B = [{"title": "Apply", "link": "https://linkedin.com/jobs/456"}]
LINK_C = [{"title": "Apply", "link": "https://naukri.com/job/789"}]


def item(title, company, desc, location="Hyderabad", links=LINK_A):
    return JobItem(title=title, company_name=company, location=location,
                   description=desc, apply_options=links)


# (name, item_a, item_b, expected_is_duplicate)
PAIRS = [
    # --- expected duplicates ---
    ("identical", item("Python Backend Developer", "Acme Tech", "Build REST APIs with Python and Django."),
     item("Python Backend Developer", "Acme Tech", "Build REST APIs with Python and Django."), True),
    ("cross-portal", item("Python Backend Developer", "Acme Tech", "Build REST APIs with Python and Django.", links=LINK_A),
     item("Python Backend Developer", "Acme Tech", "Build REST APIs with Python and Django.", links=LINK_B), True),
    ("company-variant", item("Python Backend Developer", "Acme Tech", "Build REST APIs with Python and Django.", links=LINK_A),
     item("Python Backend Developer", "ACME Technologies", "Build REST APIs with Python and Django.", links=LINK_B), True),
    ("title-reworded", item("Python Backend Developer", "Acme Tech", "Build REST APIs with Python, Django and PostgreSQL. 0-1 years experience.", links=LINK_A),
     item("Backend Developer (Python)", "Acme Tech", "Build REST APIs with Python, Django and PostgreSQL. Freshers welcome.", links=LINK_C), True),
    ("desc-truncated", item("Python Backend Developer", "Acme Tech", "Build REST APIs with Python and Django. Work with PostgreSQL, Docker, and AWS in an agile team.", links=LINK_A),
     item("Python Backend Developer", "Acme Tech", "Build REST APIs with Python.", links=LINK_B), True),
    ("location-format", item("Python Backend Developer", "Acme Tech", "Build REST APIs with Python and Django.", location="Hyderabad", links=LINK_A),
     item("Python Backend Developer", "Acme Tech", "Build REST APIs with Python and Django.", location="Hyderabad, Telangana", links=LINK_B), True),
    ("case-punct", item("Python Backend Developer!", "acme tech", "BUILD rest APIs with Python...", links=LINK_A),
     item("python backend developer", "Acme Tech", "Build REST APIs with Python", links=LINK_B), True),
    ("seniority-word", item("Python Developer - Fresher", "Acme Tech", "Entry level Python role. Build REST APIs with Django.", links=LINK_A),
     item("Python Developer (Fresher)", "Acme Tech", "Entry level Python role. Build REST APIs with Django.", links=LINK_B), True),
    # --- expected non-duplicates ---
    ("diff-company-same-title", item("Python Backend Developer", "Acme Tech", "Build REST APIs with Python and Django.", links=LINK_A),
     item("Python Backend Developer", "Globex Corp", "Build REST APIs with Python and Django.", links=LINK_B), False),
    ("same-company-diff-role", item("Python Backend Developer", "Acme Tech", "Build REST APIs with Python and Django.", links=LINK_A),
     item("Frontend Developer", "Acme Tech", "Build UIs with React and TypeScript.", links=LINK_B), False),
    ("junior-vs-senior", item("Junior Python Developer", "Acme Tech", "Entry level. Learn REST APIs with Python.", links=LINK_A),
     item("Senior Python Developer", "Acme Tech", "8+ years. Lead architecture and mentor the team.", links=LINK_B), False),
    ("diff-city", item("Python Backend Developer", "Acme Tech", "Build REST APIs with Python and Django.", location="Hyderabad", links=LINK_A),
     item("Python Backend Developer", "Acme Tech", "Build REST APIs with Python and Django.", location="Bengaluru", links=LINK_B), False),
    ("unrelated", item("Python Backend Developer", "Acme Tech", "Build REST APIs with Python.", links=LINK_A),
     item("Staff Nurse Night Shift", "City Hospital", "Patient care and ward management.", location="Chennai", links=LINK_B), False),
    ("missing-company", item("Python Backend Developer", "Acme Tech", "Build REST APIs with Python.", links=LINK_A),
     item("Python Backend Developer", "", "Build REST APIs with Python.", links=LINK_B), False),
    ("shared-token-diff-firm", item("Python Backend Developer", "Acme Tech", "Build REST APIs with Python and Django.", links=LINK_A),
     item("Python Backend Developer", "Acme Foods", "Food delivery operations and logistics.", links=LINK_B), False),
    ("same-company-diff-stack", item("Backend Developer", "Acme Tech", "Java Spring microservices on AWS.", links=LINK_A),
     item("Backend Developer", "Acme Tech", "Python Django APIs on GCP.", links=LINK_B), False),
    ("intern-vs-fulltime", item("Python Developer Intern", "Acme Tech", "6 month internship. Stipend provided.", links=LINK_A),
     item("Python Developer", "Acme Tech", "Full time role. Build REST APIs with Django.", links=LINK_B), False),
    ("support-vs-dev", item("Python Developer", "Acme Tech", "Customer support for Python SDK users.", links=LINK_A),
     item("Python Developer", "Acme Tech", "Build REST APIs with Python and Django.", links=LINK_B), False),
]


def main() -> int:
    tp = fp = tn = fn = 0
    misses = []
    for name, a, b, expected in PAIRS:
        got = is_duplicate_norms(normalize_job(a), normalize_job(b))
        if got and expected:
            tp += 1
        elif got and not expected:
            fp += 1
            misses.append((name, "FALSE POSITIVE (merged, should stay separate)"))
        elif not got and not expected:
            tn += 1
        else:
            fn += 1
            misses.append((name, "FALSE NEGATIVE (kept separate, should merge)"))
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    print(f"pairs: {len(PAIRS)}  (dupes={sum(1 for p in PAIRS if p[3])}, non-dupes={sum(1 for p in PAIRS if not p[3])})")
    print(f"TP={tp}  FP={fp}  TN={tn}  FN={fn}")
    print(f"precision={precision:.3f}  recall={recall:.3f}  F1={f1:.3f}")
    if misses:
        print("misses:")
        for name, kind in misses:
            print(f"  - {name}: {kind}")
    else:
        print("no misses on these fixtures")
    print("NOTE: labels are author judgments on synthetic fixtures, not real-world accuracy.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
