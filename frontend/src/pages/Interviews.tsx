import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { Application, Interview } from "../types";
import { ConfirmModal, EmptyState, Spinner, inputCls } from "../components/ui";

const TYPES = ["PHONE", "OA", "TECHNICAL", "HR", "BEHAVIORAL", "FINAL"];

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

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Interviews</h1>
      <form onSubmit={create} className="grid gap-2 rounded-lg bg-white p-3 shadow-sm sm:grid-cols-3">
        <select aria-label="Application" className={inputCls} value={form.application_id} onChange={(e) => setForm({ ...form, application_id: e.target.value })}>
          {apps.map((a) => <option key={a.id} value={a.id}>{a.company} — {a.job_title}</option>)}
        </select>
        <select aria-label="Type" className={inputCls} value={form.interview_type} onChange={(e) => setForm({ ...form, interview_type: e.target.value })}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input aria-label="Date" type="datetime-local" className={inputCls} value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
        <input aria-label="Interviewer" placeholder="Interviewer" className={inputCls} value={form.interviewer} onChange={(e) => setForm({ ...form, interviewer: e.target.value })} />
        <input aria-label="Meeting URL" placeholder="Meeting URL" className={inputCls} value={form.meeting_url} onChange={(e) => setForm({ ...form, meeting_url: e.target.value })} />
        <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Schedule</button>
      </form>

      {items.length === 0 ? (
        <EmptyState title="No interviews" hint="Schedule your first interview above." />
      ) : (
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-lg bg-white p-3 text-sm shadow-sm">
              <div>
                <p className="font-medium">{i.company ?? i.application_id} · {i.interview_type}</p>
                <p className="text-slate-600">{new Date(i.scheduled_at).toLocaleString()} {i.interviewer && `with ${i.interviewer}`}</p>
              </div>
              <button onClick={() => setToDelete(i.id)} className="text-sm text-red-700 underline">Delete</button>
            </div>
          ))}
        </div>
      )}
      {toDelete && <ConfirmModal title="Delete interview?" body="This cannot be undone." onCancel={() => setToDelete(null)} onConfirm={() => void remove()} />}
    </div>
  );
}
