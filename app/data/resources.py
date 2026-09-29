"""Curated career/developer resources for the Useful Tools page.

STARTER SET curated by the author — not copied from anywhere. The Notion
"Useful Website" page could not be fetched automatically (login/JS-gated);
paste its entries here to expand the collection. Every entry needs an https
URL, a category from CATEGORIES, and a one-line description.
"""

CATEGORIES = (
    "Job Search",
    "Company Research",
    "Interview Preparation",
    "Developer Tools",
    "Resume / Career",
)

RESOURCES: list[dict] = [
    {
        "name": "SerpApi Documentation",
        "url": "https://serpapi.com/search-api",
        "category": "Developer Tools",
        "description": "Search-engine API parameters, responses and engines.",
        "why": "The data source behind JobSetu — see what live search can return.",
    },
    {
        "name": "SerpApi Free Plan",
        "url": "https://serpapi.com/users/sign_up",
        "category": "Developer Tools",
        "description": "Free account with monthly search credits for building.",
        "why": "Run JobSetu with live data using the same setup as this demo.",
    },
    {
        "name": "AmbitionBox",
        "url": "https://www.ambitionbox.com",
        "category": "Company Research",
        "description": "Company reviews, salaries and interview experiences in India.",
        "why": "Cross-check an employer beyond JobSetu's cited evidence.",
    },
    {
        "name": "Glassdoor India",
        "url": "https://www.glassdoor.co.in",
        "category": "Company Research",
        "description": "Employee reviews, salaries and interview reports.",
        "why": "A second public source for company and interview context.",
    },
    {
        "name": "LinkedIn Jobs",
        "url": "https://www.linkedin.com/jobs",
        "category": "Job Search",
        "description": "Large job listing network with company pages.",
        "why": "Verify a listing also exists on a major platform.",
    },
    {
        "name": "Python Docs",
        "url": "https://docs.python.org/3/",
        "category": "Interview Preparation",
        "description": "Official Python language documentation and tutorial.",
        "why": "First stop when Python topics show up in prep lists.",
    },
    {
        "name": "roadmap.sh",
        "url": "https://roadmap.sh",
        "category": "Interview Preparation",
        "description": "Community learning roadmaps for developer roles.",
        "why": "Turn JobSetu skill gaps into a study order.",
    },
]


def valid_resources() -> list[dict]:
    """Entries with an https URL and a known category."""
    return [r for r in RESOURCES
            if r.get("url", "").startswith("https://")
            and r.get("category") in CATEGORIES
            and r.get("name") and r.get("description")]
