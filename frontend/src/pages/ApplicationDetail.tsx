import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import type { Application, Interview, Note } from "../types";
import { ConfirmModal, Spinner, StatusBadge, inputCls } from "../components/ui";

const STATUSES = ["SAVED", "APPLIED", "OA", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"];

export function ApplicationDetailPage({ notify }: { notify: (m: string) => void }) {
  const { id } = useParams();
  const navigate = useNavigate();
  type Detail = Application & { interviews: Interview[]; note_items: Note[] };
  const [app, setApp] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [status, setStatus] = useState("");

  const load = () => {
    if (!id) return;
    api
      .get<Detail>(`/api/applications/${id}`)
      .then((d) => {
        setApp(d);
        setStatus(d.status);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  };

  useEffect(load, [id]);

  if (error) return <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!app) return <Spinner />;

  const saveStatus = async () => {
    try {
      const updated = await api.put<Application>(`/api/applications/${app.id}`, { status });
      setApp({ ...app, status: updated.status });
      notify("Status updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const remove = async () => {
    await api.del(`/api/applications/${app.id}`);
    notify("Application deleted.");
    navigate("/applications");
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteDraft.trim()) return;
    const n = await api.post<Note>("/api/notes", { application_id: app.id, content: noteDraft.trim() });
    setApp({ ...app, note_items: [n, ...app.note_items] });
    setNoteDraft("");
    notify("Note added.");
  };

  const saveNoteEdit = async () => {
    if (!editingNote) return;
    const updated = await api.put<Note>(`/api/notes/${editingNote.id}`, { content: editingNote.content });
    setApp({ ...app, note_items: app.note_items.map((n) => (n.id === updated.id ? updated : n)) });
    setEditingNote(null);
  };

  const deleteNote = async (noteId: string) => {
    await api.del(`/api/notes/${noteId}`);
    setApp({ ...app, note_items: app.note_items.filter((n) => n.id !== noteId) });
  };

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("/applications")} className="text-sm text-blue-700 underline">← Back to applications</button>
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold">{app.company} — {app.job_title}</h1>
          <StatusBadge status={app.status} />
        </div>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Location</dt><dd>{app.location || "—"}</dd></div>
          <div><dt className="text-slate-500">Applied</dt><dd>{app.application_date?.slice(0, 10)}</dd></div>
          <div><dt className="text-slate-500">Job URL</dt><dd>{app.job_url ? <a className="text-blue-700 underline" href={app.job_url} target="_blank" rel="noreferrer">Open posting</a> : "—"}</dd></div>
          <div><dt className="text-slate-500">Contact</dt><dd>{app.contact_person || "—"} {app.contact_email && `(${app.contact_email})`}</dd></div>
          <div className="sm:col-span-2"><dt className="text-slate-500">Notes</dt><dd className="whitespace-pre-wrap">{app.notes || "—"}</dd></div>
          {app.follow_up_date && <div className="sm:col-span-2"><dt className="text-slate-500">Follow-up</dt><dd>⚠ {app.follow_up_date?.slice(0, 10)} — {app.follow_up_notes}</dd></div>}
        </dl>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select aria-label="Status" className={inputCls + " max-w-52"} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={saveStatus} className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-white">Save status</button>
          <button onClick={() => setConfirmDelete(true)} className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50">Delete</button>
        </div>
      </div>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Interviews ({app.interviews.length})</h2>
        <div className="mt-2 space-y-2 text-sm">
          {app.interviews.map((i) => (
            <div key={i.id} className="rounded-md border border-slate-200 p-2">
              <p className="font-medium">{i.interview_type} · {new Date(i.scheduled_at).toLocaleString()}</p>
              <p className="text-slate-600">{i.interviewer} {i.meeting_url && <a className="text-blue-700 underline" href={i.meeting_url} target="_blank" rel="noreferrer">Join</a>}</p>
            </div>
          ))}
          {app.interviews.length === 0 && <p className="text-slate-500">No interviews yet — add one from the Interviews page.</p>}
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Notes</h2>
        <form onSubmit={addNote} className="mt-2 flex gap-2">
          <input aria-label="New note" className={inputCls} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Add a note…" />
          <button className="shrink-0 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Add</button>
        </form>
        <div className="mt-3 space-y-2 text-sm">
          {app.note_items.map((n) => (
            <div key={n.id} className="rounded-md border border-slate-200 p-2">
              {editingNote?.id === n.id ? (
                <div className="flex gap-2">
                  <input className={inputCls} value={editingNote.content} onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })} />
                  <button onClick={saveNoteEdit} className="rounded-md bg-slate-800 px-3 py-1 text-white">Save</button>
                  <button onClick={() => setEditingNote(null)} className="rounded-md border px-3 py-1">Cancel</button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-pre-wrap">{n.content}</p>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => setEditingNote(n)} className="text-blue-700 underline">Edit</button>
                    <button onClick={() => void deleteNote(n.id)} className="text-red-700 underline">Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {confirmDelete && (
        <ConfirmModal title="Delete application?" body={`This will permanently delete ${app.company} — ${app.job_title} and its interviews/notes.`} onCancel={() => setConfirmDelete(false)} onConfirm={() => void remove()} />
      )}
    </div>
  );
}

