"""Canned SerpApi Google Jobs payloads for tests. Never hits the network."""

PAGE_1 = {
    "jobs_results": [
        {
            "title": "Python Backend Developer",
            "company_name": "Acme Technologies Pvt. Ltd.",
            "location": "Hyderabad, Telangana, India",
            "via": "Indeed",
            "description": "<p>Build REST APIs with Python and FastAPI.</p>",
            "extensions": ["2 days ago"],
            "detected_extensions": {
                "posted_at": "2 days ago",
                "salary": "6-10 LPA",
                "schedule_type": "Full-time",
            },
            "apply_options": [{"title": "Indeed", "link": "https://indeed.com/job-1"}],
            "job_id": "abc123",
            "share_link": "https://google.com/jobs/abc123",
        },
        {
            "title": "  PYTHON backend developer ",
            "company_name": "ACME TECHNOLOGIES",
            "location": "hyderabad",
            "via": "LinkedIn",
            "description": "Build REST APIs with Python and FastAPI.",
            "detected_extensions": {"posted_at": "3 days ago"},
            "apply_options": [
                {"title": "LinkedIn", "link": "https://linkedin.com/job-1"}
            ],
            "job_id": "different-token-same-posting",
        },
        {
            "title": "Junior Data Analyst",
            # company/location/description omitted on purpose (upstream does this)
            "via": "Naukri",
            "apply_options": [],
        },
    ],
    "serpapi_pagination": {"next_page_token": "TOKEN-2"},
}

PAGE_2 = {
    "jobs_results": [
        {
            "title": "DevOps Trainee",
            "company_name": "Other Corp",
            "location": "Bengaluru, India",
            "via": "Indeed",
            "description": "Linux basics.",
            "detected_extensions": {"posted_at": "5 days ago"},
            "apply_options": [{"title": "Indeed", "link": "https://indeed.com/job-9"}],
        }
    ],
    "serpapi_pagination": {},
}

EMPTY = {"jobs_results": [], "serpapi_pagination": {}}
