import { useEffect, useState } from "react";
import { Download, FileText, Upload } from "lucide-react";
import { api, downloadResume } from "../services/api";
import type { ResumeMeta } from "../types";
import { ConfirmModal, EmptyState, PageHeader, RowSkeleton } from "../components/ui";

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

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Resumes" description="Your application materials, ready for the next opportunity." />
        <RowSkeleton rows={4} />
      </div>
    );
  }

  const uploadLabel = (
    <label className="btn-shine inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
      <Upload size={16} aria-hidden="true" />
      {busy ? "Uploading…" : "Upload resume"}
      <input type="file" className="hidden" accept=".pdf,.doc,.docx,.txt" onChange={upload} disabled={busy} />
    </label>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Resumes"
        description="PDF, DOC, DOCX, or TXT up to 5 MB. Stored securely; link them to applications when you apply."
        actions={uploadLabel}
      />
      {error && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-400" role="alert">
          {error} Your files are safe. <button className="underline" onClick={load}>Try again</button>
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState
          art="document"
          title="No resumes yet"
          body="Add your first resume so it's ready to attach the moment you apply."
          action={{ to: "/applications", label: "Browse applications" }}
        />
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div key={r.id} className="reveal relative flex items-center justify-between gap-2 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 pl-5 text-sm shadow-sm">
              <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-red-400 via-red-500 to-red-700" />
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400">
                  <FileText size={18} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.filename}</p>
                  <p className="text-slate-500 dark:text-slate-400">{(r.size / 1024).toFixed(1)} KB · Uploaded {r.created_at.slice(0, 10)}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <button onClick={() => void downloadResume(r.id, r.filename)} className="inline-flex items-center gap-1 font-medium text-blue-700 dark:text-blue-400 underline">
                  <Download size={14} aria-hidden="true" />Download
                </button>
                <button onClick={() => setToDelete(r)} className="font-medium text-red-700 dark:text-red-400 underline">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {toDelete && <ConfirmModal title="Delete resume?" body={`${toDelete.filename} will be removed from storage.`} onCancel={() => setToDelete(null)} onConfirm={() => void remove()} />}
    </div>
  );
}

