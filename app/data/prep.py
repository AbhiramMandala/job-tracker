"""Generic study starting points per skill norm.

These are NOT predictions of what any company will ask. They render only
beside topics actually reported in collected evidence, labeled as commonly
useful starting points.
"""

PREP_POINTERS: dict[str, list[str]] = {
    "sql": ["SQL joins (INNER / LEFT)", "GROUP BY + aggregations", "Subqueries"],
    "python": ["OOP fundamentals", "Lists, dicts and string practice",
               "One small project you can explain end-to-end"],
    "java": ["OOP fundamentals", "Collections framework basics", "Exception handling"],
    "javascript": ["Closures and promises", "Array methods", "DOM basics"],
    "react": ["Components, props and state", "useEffect mental model", "A small demo app"],
    "node": ["Event loop basics", "Building a REST endpoint", "npm project layout"],
    "django": ["Models + ORM queries", "Views and URL routing", "Admin basics"],
    "fastapi": ["Path operations + validation", "Dependency injection basics", "A sample CRUD API"],
    "aws": ["Core services overview (EC2, S3)", "IAM basics", "Deploying a toy app"],
    "docker": ["Dockerfile basics", "Image vs container", "docker-compose overview"],
    "git": ["Branching + merging", "Resolving conflicts", "Writing clear commits"],
    "linux": ["Common shell commands", "File permissions", "Logs and processes"],
}
