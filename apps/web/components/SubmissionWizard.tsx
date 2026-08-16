"use client";

import { ChangeEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, FileUp } from "lucide-react";
import { SUBMISSION_TYPES, formatLabel } from "@storyboard/shared";
import { api } from "@/lib/api";

type Upload = { key: string; name: string; progress: number; state: string; status: "uploading" | "complete" | "failed" };
type FormState = {
  title: string;
  submissionType: string;
  genre: string;
  language: string;
  logline: string;
  synopsis: string;
  castCrew: string;
  estimatedDuration: string;
  additionalNotes: string;
  rightsConfirmed: boolean;
};

const initial: FormState = {
  title: "",
  submissionType: "STORY",
  genre: "",
  language: "English",
  logline: "",
  synopsis: "",
  castCrew: "",
  estimatedDuration: "",
  additionalNotes: "",
  rightsConfirmed: false
};

export function SubmissionWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initial);
  const [draftId, setDraftId] = useState("");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showCharacterList, setShowCharacterList] = useState(false);
  const draftPromise = useRef<Promise<string> | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const ensureDraft = async () => {
    if (draftId) return draftId;
    if (draftPromise.current) return draftPromise.current;
    const body = {
      ...form,
      estimatedDuration: form.estimatedDuration ? Number(form.estimatedDuration) : null
    };
    draftPromise.current = api<{ submission: { id: string } }>("/submissions", {
      method: "POST",
      body: JSON.stringify(body)
    }).then(response => {
      setDraftId(response.submission.id);
      return response.submission.id;
    }).finally(() => { draftPromise.current = null; });
    return draftPromise.current;
  };

  const next = async () => {
    setError("");
    setBusy(true);
    try {
      if (step === 1 && (!form.title.trim() || !form.genre.trim() || !form.language.trim())) {
        throw new Error("Complete the required project details to continue.");
      }

      if (step === 2) {
        if (!form.logline.trim() || !form.synopsis.trim()) throw new Error("Add a logline and synopsis to continue.");
        await ensureDraft();
      }

      if (step === 3 && uploads.some(item => item.status === "uploading")) {
        throw new Error("Wait for the current upload to finish, or continue without adding another file.");
      }

      if (step === 4 && !form.rightsConfirmed) {
        throw new Error("Confirm that you have the right to submit these materials before continuing.");
      }

      setStep(current => Math.min(5, current + 1));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to continue");
    } finally {
      setBusy(false);
    }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    let id: string;
    try {
      id = await ensureDraft();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save draft");
      return;
    }

    for (const [index, file] of files.entries()) {
      const key = `${Date.now()}-${index}-${file.name}`;
      const updateUpload = (patch: Partial<Upload>) => setUploads(current => current.map(item => item.key === key ? { ...item, ...patch } : item));
      setUploads(current => [...current, { key, name: file.name, progress: 0, state: "Preparing", status: "uploading" }]);
      let fileId = "";
      try {
        const init = await api<any>(`/submissions/${id}/uploads/initiate`, {
          method: "POST",
          body: JSON.stringify({ originalName: file.name, mimeType: file.type, sizeBytes: file.size })
        });
        fileId = init.file.id;
        const size = init.partSize;
        const parts = [];
        for (let start = 0, part = 1; start < file.size; start += size, part++) {
          const signed = await api<{ url: string }>(`/files/${init.file.id}/sign-part`, {
            method: "POST",
            body: JSON.stringify({ partNumber: part })
          });
          const response = await fetch(signed.url, {
            method: "PUT",
            body: file.slice(start, Math.min(start + size, file.size))
          });
          if (!response.ok) throw new Error(`Part ${part} failed`);
          parts.push({ ETag: response.headers.get("etag") || "", PartNumber: part });
          const progress = Math.round(Math.min(start + size, file.size) / file.size * 100);
          updateUpload({ progress, state: `Uploading · ${progress}%` });
        }
        await api(`/files/${init.file.id}/complete`, {
          method: "POST",
          body: JSON.stringify({ parts })
        });
        updateUpload({ progress: 100, state: "Complete", status: "complete" });
      } catch (cause) {
        if (fileId) await api(`/files/${fileId}/upload`, { method: "DELETE" }).catch(() => undefined);
        updateUpload({ state: cause instanceof Error ? cause.message : "Upload failed", status: "failed" });
      }
    }
    event.target.value = "";
  };

  const submit = async () => {
    if (!form.rightsConfirmed) {
      setStep(4);
      setError("Confirm that you have the right to submit these materials before submitting.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const id = await ensureDraft();
      await api(`/submissions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          estimatedDuration: form.estimatedDuration ? Number(form.estimatedDuration) : null
        })
      });
      const response = await api<{ submission: { id: string } }>(`/submissions/${id}/submit`, { method: "POST" });
      router.push(`/creator/submissions/${response.submission.id}?received=1`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  };

  const labels = ["Project details", "The story", "Files", "Rights", "Review"];
  const synopsisWords = form.synopsis.trim() ? form.synopsis.trim().split(/\s+/).length : 0;
  const completedUploads = uploads.filter(item => item.status === "complete");

  return (
    <div className="form-shell">
      <aside className="steps">
        {labels.map((label, index) => (
          <div key={label} className={`step ${step === index + 1 ? "active" : ""}`} aria-current={step === index + 1 ? "step" : undefined}>
            <b>{step > index + 1 ? <Check size={13} /> : index + 1}</b>{label}
          </div>
        ))}
      </aside>

      <section className="form-card">
        {error && <div className="alert" role="alert">{error}</div>}

        {step === 1 && (
          <>
            <div className="eyebrow">Step 1 of 5</div>
            <h2>Tell us what you’re making.</h2>
            <div className="field-grid">
              <Field label="Project title" value={form.title} onChange={value => set("title", value)} required />
              <label className="field">
                <span>Submission type</span>
                <select value={form.submissionType} onChange={event => set("submissionType", event.target.value)}>
                  {SUBMISSION_TYPES.map(type => <option key={type} value={type}>{formatLabel(type)}</option>)}
                </select>
              </label>
              <Field label="Genre" value={form.genre} onChange={value => set("genre", value)} placeholder="Drama, comedy, documentary…" required />
              <Field label="Language" value={form.language} onChange={value => set("language", value)} required />
              <Field label="Estimated duration (minutes)" type="number" value={form.estimatedDuration} onChange={value => set("estimatedDuration", value)} placeholder="Optional" />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="eyebrow">Step 2 of 5</div>
            <h2>Bring the idea into focus.</h2>
            <p className="story-guidance">The logline and synopsis can be as short as your idea needs. You can add a separate character list below.</p>

            <label className="field">
              <span>Logline</span>
              <textarea
                value={form.logline}
                maxLength={500}
                required
                onChange={event => set("logline", event.target.value)}
                placeholder="Summarize the central dramatic idea in one or two compelling sentences."
              />
              <span className="field-meta">
                <span>One or two sentences</span>
                <span>{form.logline.length}/500</span>
              </span>
            </label>

            <label className="field">
              <span>Synopsis / description</span>
              <textarea
                value={form.synopsis}
                maxLength={10000}
                required
                onChange={event => set("synopsis", event.target.value)}
                placeholder="Tell us the story, characters, world, and creative intention."
              />
              <span className="field-meta">
                <span>Any length is fine</span>
                <span>{synopsisWords} word{synopsisWords === 1 ? "" : "s"}</span>
              </span>
            </label>

            <label className="character-list-toggle">
              <input type="checkbox" checked={showCharacterList} onChange={event => { const checked=event.target.checked; setShowCharacterList(checked); if(!checked)set("castCrew",""); }} />
              <span><strong>Add a character list</strong><small>Optional — list one, three, or any number of story characters.</small></span>
            </label>

            {showCharacterList && (
              <label className="field character-list-field">
                <span>Story characters <small>(optional)</small></span>
                <textarea value={form.castCrew} maxLength={3000} onChange={event => set("castCrew", event.target.value)} placeholder={'Example:\nAsha — a determined young filmmaker\nRavi — her estranged brother\nMira — their childhood friend'} />
                <span className="hint">Add one character per line. Brief role descriptions are optional.</span>
              </label>
            )}

            <label className="field">
              <span>Additional notes <small>(optional)</small></span>
              <textarea value={form.additionalNotes} onChange={event => set("additionalNotes", event.target.value)} placeholder="Anything else reviewers should know?" />
            </label>
          </>
        )}

        {step === 3 && (
          <>
            <div className="eyebrow">Step 3 of 5</div>
            <h2>Add your material.</h2>
            <div className="dropzone">
              <FileUp size={32} />
              <h3>Choose files to upload</h3>
              <p>File upload is optional. You can continue without attaching anything.</p>
              <p className="hint">PDF, DOC, DOCX, TXT, RTF, ODT · JPG, PNG, WEBP · MP4, MOV, WEBM up to 1 GB</p>
              <input id="submission-files" className="visually-hidden" type="file" multiple onChange={upload} accept=".pdf,.doc,.docx,.txt,.rtf,.odt,.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm" />
              <label className="button secondary" style={{ marginTop: 12 }} htmlFor="submission-files">Browse files</label>
            </div>
            {uploads.map((item, index) => (
              <div className="upload-row" key={`${item.name}-${index}`}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{item.name}</strong><span className="hint" role="status">{item.state}</span>
                </div>
                {item.status !== "failed" && <div className="progress" role="progressbar" aria-label={`Upload progress for ${item.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.progress}><span style={{ width: `${item.progress}%` }} /></div>}
                {item.status === "failed" && <button type="button" className="button secondary" onClick={()=>setUploads(current=>current.filter(upload=>upload.key!==item.key))}>Dismiss</button>}
              </div>
            ))}
            <p className="hint" style={{ marginTop: 16 }}>Uploads go directly to private object storage. Large video data does not pass through the application server.</p>
          </>
        )}

        {step === 4 && (
          <>
            <div className="eyebrow">Step 4 of 5</div>
            <h2>Your work remains yours.</h2>
            <div className="card" style={{ marginBottom: 22 }}>
              <h3>Creator rights notice</h3>
              <p className="prose">Submitting work does not transfer your copyright or ownership. You grant only the limited permission needed to privately store and review the material. Any later production agreement will be presented separately and requires your express acceptance.</p>
            </div>
            <div className="required-notice">Required before submission</div>
            <div className="rights-confirmation">
              <input id="rights-confirmed" type="checkbox" required checked={form.rightsConfirmed} onChange={event => { set("rightsConfirmed", event.target.checked); setError(""); }} />
              <div><label htmlFor="rights-confirmed">I confirm that I have the right to submit these materials and consent to secure storage and review.</label><p className="hint" style={{margin:"7px 0 0"}}>Please read the <Link href="/terms" target="_blank" rel="noopener noreferrer" style={{textDecoration:"underline"}}>submission terms</Link> before confirming.</p></div>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <div className="eyebrow">Step 5 of 5</div>
            <h2>One last read-through.</h2>
            <div className="detail-stack">
              <div className="card"><div className="card-kicker">Project</div><h3>{form.title}</h3><p>{formatLabel(form.submissionType)} · {form.genre} · {form.language}</p></div>
              <div className="card"><div className="card-kicker">Logline</div><p className="prose">{form.logline}</p></div>
              <div className="card"><div className="card-kicker">Synopsis</div><p className="prose">{form.synopsis}</p></div>
              {form.castCrew && <div className="card"><div className="card-kicker">Characters</div><p className="prose pre-line">{form.castCrew}</p></div>}
              <div className="card"><div className="card-kicker">Files</div><p>{completedUploads.length ? `${completedUploads.length} file${completedUploads.length === 1 ? "" : "s"} attached` : "No files attached"}</p></div>
            </div>
          </>
        )}

        <div className="form-actions">
          {step > 1 ? (
            <button type="button" className="button secondary" onClick={() => { setError(""); setStep(current => current - 1); }}><ChevronLeft size={15} />Back</button>
          ) : <span />}
          {step < 5 ? (
            <button type="button" className="button" disabled={busy || (step === 3 && uploads.some(item=>item.status==="uploading"))} onClick={next}>{busy ? "Saving…" : "Continue"} <ChevronRight size={15} /></button>
          ) : (
            <button type="button" className="button accent" disabled={busy} onClick={submit}>{busy ? "Submitting…" : "Submit work"} <ChevronRight size={15} /></button>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, required }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <label className="field">
      <span>{label}{required ? " *" : ""}</span>
      <input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} required={required} />
    </label>
  );
}
