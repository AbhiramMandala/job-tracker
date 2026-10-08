"""Internal Pydantic models for Google Jobs data.

These decouple the rest of the app from raw SerpApi JSON shapes.
Every field is optional-with-default because upstream omits fields
freely (no salary, no apply options, no description, ...).
"""

from pydantic import BaseModel, Field, model_validator


class ApplyOption(BaseModel):
    title: str = ""
    link: str = ""


class JobItem(BaseModel):
    """One normalized listing from a Google Jobs page."""

    title: str = ""
    company_name: str = ""
    location: str = ""
    description: str = ""
    via: str = ""
    posted_at: str = ""
    salary: str = ""
    apply_options: list[ApplyOption] = Field(default_factory=list)
    apply_link: str = ""
    job_id: str = ""
    share_link: str = ""

    @model_validator(mode="after")
    def _default_apply_link(self) -> "JobItem":
        if not self.apply_link and self.apply_options:
            self.apply_link = self.apply_options[0].link
        return self

    @classmethod
    def from_serpapi(cls, raw: object) -> "JobItem":
        """Parse one entry of `jobs_results`. Never raises on bad shapes."""
        if not isinstance(raw, dict):
            return cls()
        detected = raw.get("detected_extensions")
        if not isinstance(detected, dict):
            detected = {}

        extensions = raw.get("extensions")
        posted_at = str(detected.get("posted_at") or "").strip()
        if not posted_at and isinstance(extensions, list) and extensions:
            posted_at = str(extensions[0] or "").strip()
        salary = str(detected.get("salary") or "").strip()

        options: list[ApplyOption] = []
        apply_opts = raw.get("apply_options")
        if isinstance(apply_opts, list):
            for opt in apply_opts:
                if isinstance(opt, dict):
                    options.append(
                        ApplyOption(
                            title=str(opt.get("title") or ""),
                            link=str(opt.get("link") or ""),
                        )
                    )
        apply_link = options[0].link if options else ""

        return cls(
            title=str(raw.get("title") or ""),
            company_name=str(raw.get("company_name") or ""),
            location=str(raw.get("location") or ""),
            description=str(raw.get("description") or ""),
            via=str(raw.get("via") or ""),
            posted_at=posted_at,
            salary=salary,
            apply_options=options,
            apply_link=apply_link,
            job_id=str(raw.get("job_id") or ""),
            share_link=str(raw.get("share_link") or ""),
        )


class JobsPage(BaseModel):
    """One fetched page: items plus the token for the next page (if any)."""

    items: list[JobItem] = Field(default_factory=list)
    next_page_token: str = ""
