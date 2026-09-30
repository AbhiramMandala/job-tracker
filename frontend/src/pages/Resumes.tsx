import { useEffect, useState } from "react";
import { api, downloadResume } from "../services/api";
import type { ResumeMeta } from "../types";
import { ConfirmModal, EmptyState, Spinner } from "../components/ui";

export function ResumesPage({ notify }: { notify: (m: string) => void }) {
  const [items, setItems] = useState<ResumeMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ResumeMeta | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api
      .get<{ items: ResumeMeta[] }>("/api/resumes")
      .then((d) => setItems(d.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > 5 * 1024 * 1024) {
      setError("File must be under 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const created = await api.upload<ResumeMeta>("/api/resumes", form);
      setItems((prev) => [created, ...prev]);
      notify("Resume uploaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    await api.del(`/api/resumes/${toDelete.id}`);
    setItems((prev) => prev.filter((r) => r.id !== toDelete.id));
    setToDelete(null);
    notify("Resume deleted.");
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Resumes</h1>
        <label className="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          {busy ? "Uploading…" : "Upload resume"}
          <input type="file" className="hidden" accept=".pdf,.doc,.docx,.txt" onChange={upload} disabled={busy} />
        </label>
      </div>
      <p className="text-sm text-slate-500">PDF, DOC, DOCX, or TXT up to 5 MB. Files are stored in R2; only metadata lives in D1.</p>
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {items.length === 0 ? (
        <EmptyState title="No resumes yet" hint="Upload your first resume to attach it to applications." />
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg bg-white p-3 text-sm shadow-sm">
              <div>
                <p className="font-medium">{r.filename}</p>
                <p className="text-slate-500">{(r.size / 1024).toFixed(1)} KB · {r.created_at.slice(0, 10)}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => void downloadResume(r.id, r.filename)} className="text-blue-700 underline">Download</button>
                <button onClick={() => setToDelete(r)} className="text-red-700 underline">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {toDelete && <ConfirmModal title="Delete resume?" body={`${toDelete.filename} will be removed from storage.`} onCancel={() => setToDelete(null)} onConfirm={() => void remove()} />}
    </div>
  );
}
