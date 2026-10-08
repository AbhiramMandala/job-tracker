"""Curated skill vocabulary + deterministic extractor. No LLM, no ML.

`SKILLS` maps canonical lowercase name -> alias list (first alias is the
canonical spelling). Matching is longest-alias-first with matched spans
blanked out, so "sql" never fires inside an already-matched "mysql".

Limitations (documented, not hidden):
- Closed vocabulary: unknown tools/frameworks are missed, not guessed.
- "go" matches only via "golang" (bare "go" is too noisy in prose).
- "ts"/"tf"-style micro-abbreviations are excluded except "js".
- Context is keyword-based; "no docker experience needed" still matches.
"""

import re

SKILLS: dict[str, list[str]] = {
    "python": ["python", "python3", "py"],
    "fastapi": ["fastapi", "fast api"],
    "django": ["django"],
    "flask": ["flask"],
    "postgresql": ["postgresql", "postgres", "psql"],
    "mysql": ["mysql"],
    "redis": ["redis"],
    "docker": ["docker"],
    "kubernetes": ["kubernetes", "k8s"],
    "aws": ["amazon web services", "aws"],
    "azure": ["microsoft azure", "azure"],
    "gcp": ["google cloud platform", "google cloud", "gcp"],
    "git": ["git"],
    "rest": ["rest apis", "rest api", "restful", "rest"],
    "graphql": ["graphql"],
    "kafka": ["apache kafka", "kafka"],
    "celery": ["celery"],
    "linux": ["linux"],
    "mongodb": ["mongodb", "mongo"],
    "sql": ["sql"],
    "javascript": ["javascript", "js"],
    "typescript": ["typescript"],
    "react": ["react.js", "reactjs", "react"],
    "node": ["node.js", "nodejs", "node"],
    "java": ["java"],
    "spring": ["spring boot", "spring"],
    "cpp": ["c++", "cpp"],
    "html": ["html"],
    "css": ["css"],
    "sqlite": ["sqlite"],
    "elasticsearch": ["elastic search", "elasticsearch"],
    "rabbitmq": ["rabbit mq", "rabbitmq"],
    "jenkins": ["jenkins"],
    "terraform": ["terraform"],
    "cicd": ["ci/cd", "cicd", "ci cd"],
    "pytorch": ["pytorch", "torch"],
    "tensorflow": ["tensorflow"],
    "sklearn": ["scikit learn", "scikit-learn", "sklearn"],
    "pandas": ["pandas"],
    "numpy": ["numpy"],
    "airflow": ["apache airflow", "airflow"],
    "spark": ["apache spark", "pyspark", "spark"],
    "selenium": ["selenium"],
    "postman": ["postman"],
    "firebase": ["firebase"],
    "nextjs": ["next.js", "nextjs", "next js"],
    "vue": ["vue.js", "vuejs", "vue"],
    "angular": ["angularjs", "angular"],
    "express": ["express.js", "express"],
    "dotnet": ["asp.net", "dotnet", ".net"],
    "php": ["php"],
    "ruby": ["ruby on rails", "rails", "ruby"],
    "go": ["golang"],
    "rust": ["rust"],
    "kotlin": ["kotlin"],
    "swift": ["swift"],
    "flutter": ["flutter"],
    "dart": ["dart"],
    "nginx": ["nginx"],
    "pytest": ["pytest"],
    "figma": ["figma"],
    "jira": ["jira"],
    "agile": ["agile", "scrum"],
    "microservices": ["micro services", "microservices"],
}

DISPLAY: dict[str, str] = {
    "postgresql": "PostgreSQL",
    "mysql": "MySQL",
    "aws": "AWS",
    "gcp": "GCP",
    "graphql": "GraphQL",
    "mongodb": "MongoDB",
    "sql": "SQL",
    "javascript": "JavaScript",
    "typescript": "TypeScript",
    "cpp": "C++",
    "html": "HTML",
    "css": "CSS",
    "sqlite": "SQLite",
    "cicd": "CI/CD",
    "pytorch": "PyTorch",
    "tensorflow": "TensorFlow",
    "sklearn": "scikit-learn",
    "numpy": "NumPy",
    "nextjs": "Next.js",
    "vue": "Vue",
    "dotnet": ".NET",
    "php": "PHP",
    "api": "API",
}

_ALIAS_TO_CANONICAL: dict[str, str] = {}
for _canon, _aliases in SKILLS.items():
    for _alias in _aliases:
        _ALIAS_TO_CANONICAL.setdefault(_alias, _canon)

# Longest alias first so "amazon web services" wins over "aws"-style
# fragments and multi-word skills match before their sub-words.
_SORTED_ALIASES: list[tuple[str, str, "re.Pattern[str]"]] = []
for _alias, _canon in sorted(
    _ALIAS_TO_CANONICAL.items(), key=lambda kv: -len(kv[0])
):
    _SORTED_ALIASES.append(
        (
            _alias,
            _canon,
            # Lookbehind keeps "." so versioned names ("node.js") are not
            # split; lookahead drops "." so sentence-final periods
            # ("... FastAPI.") still match. Longest-first + blanking
            # protects "node" inside an already-matched "node.js".
            re.compile(r"(?<![a-z0-9+#.])" + re.escape(_alias) + r"(?![a-z0-9+#])"),
        )
    )


def normalize_skill(raw: str) -> str:
    """Map free text to a canonical skill key ("" when empty)."""
    cleaned = re.sub(r"\s+", " ", (raw or "").strip().lower())
    if not cleaned or len(cleaned) > 50:
        return ""
    return _ALIAS_TO_CANONICAL.get(cleaned, cleaned)


def display_skill(norm: str) -> str:
    """Human label for a canonical skill key."""
    return DISPLAY.get(norm, norm)


def extract_skills(text: str) -> list[tuple[str, str]]:
    """Return [(canonical_skill, snippet)] in order of first appearance.

    Deterministic, idempotent, pure function.
    """
    lowered = (text or "").lower()
    if not lowered.strip():
        return []
    original = lowered
    found: dict[str, tuple[int, str]] = {}  # norm -> (position, snippet)
    for alias, canon, pattern in _SORTED_ALIASES:
        if canon in found:
            continue
        match = pattern.search(lowered)
        if match is None:
            continue
        start, end = match.span()
        snippet = re.sub(
            r"\s+", " ", original[max(0, start - 40): end + 40]
        ).strip()
        found[canon] = (start, snippet)
        # Blank the span so shorter aliases can't fire inside it.
        lowered = lowered[:start] + (" " * (end - start)) + lowered[end:]
    return [(canon, found[canon][1]) for canon in sorted(found, key=lambda c: found[c][0])]
