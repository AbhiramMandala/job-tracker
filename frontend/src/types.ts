export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export type ApplicationStatus =
  | "SAVED"
  | "APPLIED"
  | "OA"
  | "INTERVIEW"
  | "OFFER"
  | "REJECTED"
  | "WITHDRAWN";

export type JobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT" | "REMOTE";

export type InterviewType = "PHONE" | "OA" | "TECHNICAL" | "HR" | "BEHAVIORAL" | "FINAL";

export interface Application {
  id: string;
  user_id: string;
  company: string;
  job_title: string;
  location: string;
  job_url: string;
  job_type: JobType;
  salary: string;
  application_date: string;
  status: ApplicationStatus;
  notes: string;
  contact_person: string;
  contact_email: string;
  follow_up_date: string | null;
  follow_up_reminder: number;
  follow_up_notes: string;
  resume_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Interview {
  id: string;
  user_id: string;
  application_id: string;
  interview_type: InterviewType;
  scheduled_at: string;
  interviewer: string;
  meeting_url: string;
  notes: string;
  result: string;
  created_at: string;
  company?: string;
  job_title?: string;
}

export interface Note {
  id: string;
  user_id: string;
  application_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ResumeMeta {
  id: string;
  user_id: string;
  filename: string;
  content_type: string;
  size: number;
  r2_key: string;
  created_at: string;
}

export interface Dashboard {
  totals: { total: number; applied: number; interviewing: number; offers: number; rejected: number; saved: number };
  byStatus: { status: string; count: number }[];
  upcomingInterviews: Interview[];
  recentApplications: Application[];
  overdueFollowUps: { id: string; company: string; job_title: string; follow_up_date: string; follow_up_notes: string }[];
  upcomingFollowUps: { id: string; company: string; job_title: string; follow_up_date: string; follow_up_notes: string }[];
  cached?: boolean;
}
