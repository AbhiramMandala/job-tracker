"""Curated career/developer resources for the Useful Tools page.

Curated from the author's Useful Website collection plus a small starter set.
Deliberately EXCLUDED: pirated book PDFs, login-gated pages, personal
Google Docs/Colab links (rot + access issues), unofficial mirrors, transient
Linktree pages, and off-topic entries (games, anime, music, photography) —
none of those help a job seeker discover, verify, prepare, or apply.
Every entry needs an https URL, a category from CATEGORIES, and a one-line
factual description. No invented claims about any site.
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
    {
        "name": "IndiaBIX",
        "url": "https://www.indiabix.com/",
        "category": "Interview Preparation",
        "description": "Aptitude, reasoning and technical practice questions.",
        "why": "Practice the aptitude rounds JobSetu reports for a company.",
    },
    {
        "name": "TCS NQT Aptitude PYQs",
        "url": "https://www.lets-code.co.in/previousyearcodingquestion/tcsnqtaptitude/",
        "category": "Interview Preparation",
        "description": "Previous-year aptitude questions for TCS NQT-style tests.",
        "why": "Targeted practice when mass-recruiter rounds appear in prep topics.",
    },
    {
        "name": "InterviewBit",
        "url": "https://www.interviewbit.com/",
        "category": "Interview Preparation",
        "description": "Coding practice and interview preparation tracks.",
        "why": "Work through coding topics flagged in role prep lists.",
    },
    {
        "name": "workat.tech",
        "url": "https://workat.tech/problem-solving/practice/topics",
        "category": "Interview Preparation",
        "description": "Topic-wise coding practice problems.",
        "why": "Drill the exact topics your prep panel highlights.",
    },
    {
        "name": "Prepverse",
        "url": "https://www.prepverse.xyz/",
        "category": "Interview Preparation",
        "description": "Mock interview practice platform.",
        "why": "Rehearse after reading a company's reported process.",
    },
    {
        "name": "30 Days Coding — SQL",
        "url": "https://30dayscoding.com/interview/sql",
        "category": "Interview Preparation",
        "description": "SQL interview questions and practice.",
        "why": "SQL tops most backend prep lists — practice it here.",
    },
    {
        "name": "Blind 75",
        "url": "https://www.designgurus.io/blind75",
        "category": "Interview Preparation",
        "description": "Curated list of 75 essential coding problems.",
        "why": "A bounded DSA set when coding rounds are reported.",
    },
    {
        "name": "GFG DSA Tutorial",
        "url": "https://www.geeksforgeeks.org/dsa-tutorial-learn-data-structures-and-algorithms/",
        "category": "Interview Preparation",
        "description": "Data structures and algorithms tutorial series.",
        "why": "Learn the DSA topics behind technical-round questions.",
    },
    {
        "name": "Exercism",
        "url": "https://exercism.org/",
        "category": "Interview Preparation",
        "description": "Free coding exercises with mentor feedback.",
        "why": "Hands-on practice for languages in your skill gaps.",
    },
    {
        "name": "Automate the Boring Stuff",
        "url": "https://automatetheboringstuff.com/",
        "category": "Interview Preparation",
        "description": "Free practical Python programming book.",
        "why": "Strengthen Python fundamentals for backend roles.",
    },
    {
        "name": "WHOIS Lookup",
        "url": "https://www.whois.com/",
        "category": "Company Research",
        "description": "Look up domain-registration information.",
        "why": "Domain details that may help with basic company/domain research.",
    },
    {
        "name": "QuickRef",
        "url": "https://quickref.me/",
        "category": "Developer Tools",
        "description": "Cheat sheets for languages and tools.",
        "why": "Quick syntax refreshers while preparing.",
    },
    {
        "name": "OverAPI",
        "url": "https://overapi.com/",
        "category": "Developer Tools",
        "description": "Collected cheat sheets for programming topics.",
        "why": "Fast revision cards for interview prep.",
    },
    {
        "name": "JavaScript.info",
        "url": "https://javascript.info/",
        "category": "Developer Tools",
        "description": "In-depth modern JavaScript tutorial.",
        "why": "Reference when JavaScript appears in role skills.",
    },
    {
        "name": "Uiverse",
        "url": "https://uiverse.io/elements",
        "category": "Developer Tools",
        "description": "Open-source UI elements and components.",
        "why": "Design inspiration for developer portfolio pages.",
    },
    {
        "name": "Learn Git Branching",
        "url": "https://learngitbranching.js.org/",
        "category": "Developer Tools",
        "description": "Interactive visual Git tutorial.",
        "why": "Git shows up in almost every skill gap — learn it here.",
    },
    {
        "name": "Project-Based Learning",
        "url": "https://github.com/practical-tutorials/project-based-learning",
        "category": "Developer Tools",
        "description": "Curated list of project tutorials across stacks.",
        "why": "Build the portfolio projects interviewers ask about.",
    },
    {
        "name": "Jobright",
        "url": "https://jobright.ai/",
        "category": "Resume / Career",
        "description": "AI-assisted job matching and resume tools.",
        "why": "A second opinion on matching and resume wording.",
    },
    {
        "name": "MyJobFlow",
        "url": "https://www.myjobflow.com/",
        "category": "Resume / Career",
        "description": "Job application tracking and workflow.",
        "why": "Track the roles you apply to from JobSetu.",
    },
    {
        "name": "Peerlist",
        "url": "https://peerlist.io/",
        "category": "Resume / Career",
        "description": "No-code portfolio and professional profile pages.",
        "why": "Showcase the projects behind your skills.",
    },
    {
        "name": "GitHub Education Pack",
        "url": "https://education.github.com/pack",
        "category": "Resume / Career",
        "description": "Free developer tools for students.",
        "why": "Free tiers for building and hosting portfolio work.",
    },
    {
        "name": "Forage",
        "url": "https://www.theforage.com/",
        "category": "Resume / Career",
        "description": "Free virtual work-experience programs.",
        "why": "Add practical simulations alongside applications.",
    },
]


# Trust labels describe the NATURE of the source (whose page it is), never a
# quality guarantee by JobSetu.
TRUST: dict[str, str] = {
    "SerpApi Documentation": "Official",
    "SerpApi Free Plan": "Official",
    "GitHub Education Pack": "Official",
    "AmbitionBox": "Established Resource",
    "Glassdoor India": "Established Resource",
    "LinkedIn Jobs": "Established Resource",
    "Python Docs": "Established Resource",
    "roadmap.sh": "Established Resource",
    "GFG DSA Tutorial": "Established Resource",
    "IndiaBIX": "Established Resource",
    "InterviewBit": "Established Resource",
    "workat.tech": "Established Resource",
    "Automate the Boring Stuff": "Established Resource",
    "WHOIS Lookup": "Established Resource",
    "Blind 75": "External Tool",
    "Jobright": "External Tool",
    "MyJobFlow": "External Tool",
    "Peerlist": "External Tool",
    "Forage": "External Tool",
}


def valid_resources() -> list[dict]:
    """Entries with an https URL and a known category, plus trust label."""
    out = []
    for r in RESOURCES:
        if not (r.get("url", "").startswith("https://")
                and r.get("category") in CATEGORIES
                and r.get("name") and r.get("description")):
            continue
        entry = dict(r)
        entry["trust"] = TRUST.get(r["name"], "Community Resource")
        out.append(entry)
    return out
