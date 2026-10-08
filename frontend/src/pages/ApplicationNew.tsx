import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { FieldError, inputCls } from "../components/ui";

const STATUSES = ["SAVED", "APPLIED", "OA", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"];
const JOB_TYPES = ["FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT", "REMOTE"];

export function ApplicationNewPage({ notify }: { notify: (m: string) => void }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    company: "",
    job_title: "",
    location: "",
    job_url: "",
    job_type: "FULL_TIME",
    salary: "",
    application_date: new Date().toISOString().slice(0, 10),
    status: "SAVED",
    notes: "",
    contact_person: "",
    contact_email: "",
    follow_up_date: "",
    follow_up_reminder: false,
    follow_up_notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.company.trim() || !form.job_title.trim()) {
      setError("Company and job title are required.");
      return;
    }
    setBusy(true);
    try {
      const created = await api.post<{ id: string }>("/api/applications", {
        ...form,
        follow_up_date: form.follow_up_date || null,
      });
      notify("Application created.");
      navigate(`/applications/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="reveal mx-auto max-w-2xl rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm">
      <h1 className="text-xl font-bold">New application</h1>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <div><label className="text-sm font-medium" htmlFor="company">Company *</label><input id="company" className={inputCls} value={form.company} onChange={(e) => set("company", e.target.value)} /></div>
        <div><label className="text-sm font-medium" htmlFor="title">Job title *</label><input id="title" className={inputCls} value={form.job_title} onChange={(e) => set("job_title", e.target.value)} /></div>
        <div><label className="text-sm font-medium">Location</label><input className={inputCls} value={form.location} onChange={(e) => set("location", e.target.value)} /></div>
        <div><label className="text-sm font-medium">Job URL</label><input className={inputCls} value={form.job_url} onChange={(e) => set("job_url", e.target.value)} /></div>
        <div>
          <label className="text-sm font-medium">Job type</label>
          <select className={inputCls} value={form.job_type} onChange={(e) => set("job_type", e.target.value)}>
            {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div><label className="text-sm font-medium">Salary</label><input className={inputCls} value={form.salary} onChange={(e) => set("salary", e.target.value)} /></div>
        <div><label className="text-sm font-medium">Application date</label><input type="date" className={inputCls} value={form.application_date} onChange={(e) => set("application_date", e.target.value)} /></div>
        <div>
          <label className="text-sm font-medium">Status</label>
          <select className={inputCls} value={form.status} onChange={(e) => set("status", e.target.value)}>
            {STATUSES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div><label className="text-sm font-medium">Contact person</label><input className={inputCls} value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} /></div>
        <div><label className="text-sm font-medium">Contact email</label><input className={inputCls} value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} /></div>
        <div><label className="text-sm font-medium">Follow-up date</label><input type="date" className={inputCls} value={form.follow_up_date} onChange={(e) => set("follow_up_date", e.target.value)} /></div>
        <div className="flex items-end gap-2 pb-2">
          <input id="rem" type="checkbox" checked={form.follow_up_reminder} onChange={(e) => set("follow_up_reminder", e.target.checked)} />
          <label htmlFor="rem" className="text-sm">Follow-up reminder</label>
        </div>
        <div className="sm:col-span-2"><label className="text-sm font-medium">Notes</label><textarea rows={3} className={inputCls} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        <div className="sm:col-span-2"><label className="text-sm font-medium">Follow-up notes</label><textarea rows={2} className={inputCls} value={form.follow_up_notes} onChange={(e) => set("follow_up_notes", e.target.value)} /></div>
        <FieldError message={error ?? undefined} />
        <div className="sm:col-span-2">
          <button disabled={busy} className="btn-shine rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
            {busy ? "Saving…" : "Create application"}
          </button>
        </div>
      </form>
    </div>
  );
}


