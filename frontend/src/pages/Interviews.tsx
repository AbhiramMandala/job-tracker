import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { api } from "../services/api";
import type { Application, Interview } from "../types";
import { ConfirmModal, EmptyState, PageHeader, RowSkeleton, inputCls } from "../components/ui";

const TYPES = ["PHONE", "OA", "TECHNICAL", "HR", "BEHAVIORAL", "FINAL"];

function bucket(when: string): "past" | "today" | "week" | "later" {
  const t = new Date(when).getTime();
  const day = 86400000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (t < startOfToday.getTime()) return "past";
  if (t < startOfToday.getTime() + day) return "today";
  if (t < startOfToday.getTime() + 7 * day) return "week";
  return "later";
}

const GROUPS: { key: "today" | "week" | "later" | "past"; title: string }[] = [
  { key: "today", title: "Today" },
  { key: "week", title: "This week" },
  { key: "later", title: "Later" },
  { key: "past", title: "Past" },
];

export function InterviewsPage({ notify }: { notify: (m: string) => void }) {
  const [items, setItems] = useState<Interview[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ application_id: "", interview_type: "TECHNICAL", scheduled_at: "", interviewer: "", meeting_url: "", notes: "" });
  const [toDelete, setToDelete] = useState<string | null>(null);

  const load = () => {
    Promise.all([
      api.get<{ items: Interview[] }>("/api/interviews?upcoming=false"),
      api.get<{ items: Application[] }>("/api/applications?limit=100"),
    ])
      .then(([i, a]) => {
        setItems(i.items);
        setApps(a.items);
        if (!form.application_id && a.items[0]) setForm((f) => ({ ...f, application_id: a.items[0]!.id }));
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const grouped = useMemo(() => {
    const sorted = [...items].sort((a, b) => (a.scheduled_at > b.scheduled_at ? 1 : -1));
    return GROUPS.map((g) => ({ ...g, items: sorted.filter((i) => bucket(i.scheduled_at) === g.key) }));
  }, [items]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.application_id || !form.scheduled_at) return;
    const created = await api.post<Interview>("/api/interviews", {
      ...form,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
    });
    setItems((prev) => [...prev, created].sort((a, b) => (a.scheduled_at > b.scheduled_at ? 1 : -1)));
    setForm({ ...form, scheduled_at: "", interviewer: "", meeting_url: "", notes: "" });
    notify("Interview scheduled.");
  };

  const remove = async () => {
    if (!toDelete) return;
    await api.del(`/api/interviews/${toDelete}`);
    setItems((prev) => prev.filter((i) => i.id !== toDelete));
    setToDelete(null);
    notify("Interview deleted.");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Interviews" description="Your preparation workspace." />
        <RowSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Interviews" description="Prepare, track, and follow through on every conversation." />
      <form onSubmit={create} className="reveal grid gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm sm:grid-cols-3">
        <select aria-label="Application" className={inputCls} value={form.application_id} onChange={(e) => setForm({ ...form, application_id: e.target.value })}>
          {apps.map((a) => <option key={a.id} value={a.id}>{a.company} — {a.job_title}</option>)}
        </select>
        <select aria-label="Stage" className={inputCls} value={form.interview_type} onChange={(e) => setForm({ ...form, interview_type: e.target.value })}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input aria-label="Date and time" type="datetime-local" className={inputCls} value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
        <input aria-label="Interviewer" placeholder="Interviewer" className={inputCls} value={form.interviewer} onChange={(e) => setForm({ ...form, interviewer: e.target.value })} />
        <input aria-label="Meeting URL" placeholder="Meeting URL" className={inputCls} value={form.meeting_url} onChange={(e) => setForm({ ...form, meeting_url: e.target.value })} />
        <button className="btn-shine rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Schedule</button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No interviews scheduled"
          body="Once an application reaches the interview stage, your upcoming conversations will appear here — with stage, time, and prep notes."
          action={{ to: "/applications", label: "Review applications" }}
        />
      ) : (
        <div className="space-y-5">
          {grouped.map((g) =>
            g.items.length > 0 && (
              <section key={g.key} aria-label={g.title}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{g.title}</h2>
                <div className="mt-2 space-y-2">
                  {g.items.map((i) => (
                    <div key={i.id} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold">{i.company ?? i.application_id}</p>
                          <p className="text-slate-600 dark:text-slate-400">
                            {i.interview_type} · {new Date(i.scheduled_at).toLocaleString()}
                            {i.interviewer && ` · with ${i.interviewer}`}
                          </p>
                          {i.notes && <p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-400">{i.notes}</p>}
                          <div className="mt-1 flex flex-wrap gap-3">
                            {i.meeting_url && <a className="font-medium text-blue-700 dark:text-blue-400 underline" href={i.meeting_url} target="_blank" rel="noreferrer">Join meeting →</a>}
                            <Link className="font-medium text-blue-700 dark:text-blue-400 underline" to={`/applications/${i.application_id}`}>Open application →</Link>
                          </div>
                        </div>
                        <button onClick={() => setToDelete(i.id)} className="shrink-0 text-sm text-red-700 dark:text-red-400 underline">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
      )}
      {toDelete && <ConfirmModal title="Delete interview?" body="This cannot be undone." onCancel={() => setToDelete(null)} onConfirm={() => void remove()} />}
    </div>
  );
}

