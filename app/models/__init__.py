"""SQLAlchemy tables. Schema matches docs/architecture.md section 4.

No business logic here. Constraints that matter for dedup/matching
(unique names, source keys, match pairs) are enforced at the DB level.
"""

import datetime as dt

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Search(Base):
    __tablename__ = "searches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role: Mapped[str] = mapped_column(String(200), nullable=False)
    location: Mapped[str] = mapped_column(String(200), nullable=False)
    experience: Mapped[str] = mapped_column(String(100), nullable=False)
    query_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    raw_count: Mapped[int] = mapped_column(Integer, default=0)
    canonical_count: Mapped[int] = mapped_column(Integer, default=0)
    dup_removed: Mapped[int] = mapped_column(Integer, default=0)
    is_live: Mapped[bool] = mapped_column(Boolean, default=False)
    retrieved_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    jobs: Mapped[list["Job"]] = relationship(back_populates="search")
    skill_gaps: Mapped[list["SkillGap"]] = relationship(back_populates="search")


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name_raw: Mapped[str] = mapped_column(String(300), default="")
    name_norm: Mapped[str] = mapped_column(String(300), nullable=False, unique=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    jobs: Mapped[list["Job"]] = relationship(back_populates="company")


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    search_id: Mapped[int | None] = mapped_column(
        ForeignKey("searches.id"), nullable=True
    )
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    title_raw: Mapped[str] = mapped_column(String(300), default="")
    title_norm: Mapped[str] = mapped_column(String(300), default="")
    location_raw: Mapped[str] = mapped_column(String(300), default="")
    location_norm: Mapped[str] = mapped_column(String(300), default="")
    via: Mapped[str] = mapped_column(Text, default="")  # JSON list stored as text
    apply_link: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str] = mapped_column(Text, default="")
    posted_text: Mapped[str] = mapped_column(String(200), default="")
    salary_text: Mapped[str] = mapped_column(String(200), default="")
    source_key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    serpapi_job_id: Mapped[str] = mapped_column(String(300), default="")
    extra_links: Mapped[str] = mapped_column(Text, default="[]")
    first_seen: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    last_seen: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    dup_count: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (
        Index("ix_jobs_company_title", "company_id", "title_norm"),
        Index("ix_jobs_last_seen", "last_seen"),
    )

    search: Mapped["Search | None"] = relationship(back_populates="jobs")
    company: Mapped["Company"] = relationship(back_populates="jobs")

    @property
    def via_display(self) -> str:
        """Human-readable source list; `via` is stored as a JSON array."""
        import json as _json

        try:
            items = _json.loads(self.via or "[]")
        except ValueError:
            return self.via
        if isinstance(items, list):
            return ", ".join(str(v) for v in items if v)
        return str(items)

    skills: Mapped[list["JobSkill"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )
    evidences: Mapped[list["Evidence"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )
    matches: Mapped[list["Match"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )


class Evidence(Base):
    __tablename__ = "evidences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"), nullable=True)
    company_id: Mapped[int | None] = mapped_column(
        ForeignKey("companies.id"), nullable=True
    )
    engine: Mapped[str] = mapped_column(String(50), nullable=False)
    query: Mapped[str] = mapped_column(Text, default="")
    evidence_type: Mapped[str] = mapped_column(String(50), default="")
    claim: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)  # supporting|limited|warning
    source_title: Mapped[str] = mapped_column(Text, default="")
    source_url: Mapped[str] = mapped_column(Text, default="")
    source_snippet: Mapped[str] = mapped_column(Text, default="")
    source_date: Mapped[str] = mapped_column(Text, default="")
    retrieved_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    __table_args__ = (
        Index("ix_evidences_job", "job_id"),
        Index("ix_evidences_company", "company_id"),
        Index("ix_evidences_job_type", "job_id", "evidence_type"),
    )

    job: Mapped["Job | None"] = relationship(back_populates="evidences")


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), default="Fresher")
    experience_years: Mapped[float] = mapped_column(Float, default=0.0)
    location: Mapped[str] = mapped_column(String(200), default="")
    preferred_role: Mapped[str] = mapped_column(String(200), default="")
    job_type_pref: Mapped[str] = mapped_column(String(50), default="any")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    resume_text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    skills: Mapped[list["CandidateSkill"]] = relationship(
        back_populates="candidate", cascade="all, delete-orphan"
    )


class CandidateSkill(Base):
    __tablename__ = "candidate_skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("candidates.id"), nullable=False
    )
    skill_norm: Mapped[str] = mapped_column(String(100), nullable=False)
    source: Mapped[str] = mapped_column(String(50), default="pasted")

    __table_args__ = (
        UniqueConstraint("candidate_id", "skill_norm", name="uq_candidate_skill"),
    )

    candidate: Mapped["Candidate"] = relationship(back_populates="skills")


class JobSkill(Base):
    __tablename__ = "job_skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), nullable=False)
    skill_norm: Mapped[str] = mapped_column(String(100), nullable=False)
    evidence_snippet: Mapped[str] = mapped_column(Text, default="")

    __table_args__ = (
        UniqueConstraint("job_id", "skill_norm", name="uq_job_skill"),
        Index("ix_job_skills_skill", "skill_norm"),
    )

    job: Mapped["Job"] = relationship(back_populates="skills")


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("candidates.id"), nullable=False
    )
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), nullable=False)
    total: Mapped[int] = mapped_column(Integer, default=0)
    skill_pts: Mapped[int] = mapped_column(Integer, default=0)
    title_pts: Mapped[int] = mapped_column(Integer, default=0)
    exp_pts: Mapped[int] = mapped_column(Integer, default=0)
    loc_pts: Mapped[int] = mapped_column(Integer, default=0)
    type_pts: Mapped[int] = mapped_column(Integer, default=0)
    matched_skills: Mapped[list] = mapped_column(JSON, default=list)
    missing_skills: Mapped[list] = mapped_column(JSON, default=list)
    reasons: Mapped[list] = mapped_column(JSON, default=list)
    computed_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    __table_args__ = (
        UniqueConstraint("candidate_id", "job_id", name="uq_match_candidate_job"),
    )

    job: Mapped["Job"] = relationship(back_populates="matches")


class SkillGap(Base):
    __tablename__ = "skill_gaps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    search_id: Mapped[int] = mapped_column(ForeignKey("searches.id"), nullable=False)
    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("candidates.id"), nullable=False
    )
    skill_norm: Mapped[str] = mapped_column(String(100), nullable=False)
    missing_in_count: Mapped[int] = mapped_column(Integer, default=0)
    total_jobs: Mapped[int] = mapped_column(Integer, default=0)

    search: Mapped["Search"] = relationship(back_populates="skill_gaps")


class ApiUsage(Base):
    __tablename__ = "api_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    engine: Mapped[str] = mapped_column(String(50), default="")
    query: Mapped[str] = mapped_column(Text, default="")
    params_hash: Mapped[str] = mapped_column(String(64), default="")
    status: Mapped[str] = mapped_column(String(20), default="")
    http_status: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )


class CacheEntry(Base):
    __tablename__ = "cache_entries"

    cache_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    engine: Mapped[str] = mapped_column(String(50), default="")
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    retrieved_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    expires_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (Index("ix_cache_expires", "expires_at"),)
