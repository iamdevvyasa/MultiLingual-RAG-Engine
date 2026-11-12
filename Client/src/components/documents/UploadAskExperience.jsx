import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, LoaderCircle, Trash2, UploadCloud } from "lucide-react";
import {
  getStoredDocumentFiles,
  removeDocumentFile,
  saveDocumentFiles,
} from "../../lib/documentStorage";

const ACCEPTED_TYPES = ".pdf,.docx,.txt,.md,.csv,.json";
const SESSION_KEY = "vaanirag-document-session";

function getSessionId() {
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(SESSION_KEY, created);
  return created;
}

function UploadAskExperience({ onSubmit, hasConversation, isProcessing }) {
  const [sessionId] = useState(getSessionId);
  const [documents, setDocuments] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [question, setQuestion] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const selectedCount = selectedIds.length;
  const canAsk = selectedCount > 0 && question.trim().length > 0 && !isProcessing;

  const uploadFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setError("");
    setIsUploading(true);
    try {
      await saveDocumentFiles(sessionId, files);
      const body = new FormData();
      body.append("sessionId", sessionId);
      files.forEach((file) => body.append("documents", file));
      const response = await fetch("/api/documents", { method: "POST", body });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.message || "Unable to process the selected documents.");
      setDocuments((current) => [...current, ...(data.documents || [])]);
      setSelectedIds((current) => [...current, ...(data.documents || []).map((document) => document.id)]);
    } catch (uploadError) {
      setError(uploadError.message || "Unable to process the selected documents.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [sessionId]);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      const response = await fetch(`/api/documents?sessionId=${encodeURIComponent(sessionId)}`);
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.message || "Unable to load your document session.");
      if (!active) return;
      if (data.documents?.length) {
        setDocuments(data.documents);
        setSelectedIds(data.documents.map((document) => document.id));
        return;
      }

      const storedFiles = await getStoredDocumentFiles(sessionId);
      if (active && storedFiles.length) {
        await uploadFiles(storedFiles);
      }
    };

    restoreSession().catch((restoreError) => {
      if (active) setError(restoreError.message);
    });
    return () => {
      active = false;
    };
  }, [sessionId, uploadFiles]);

  const removeDocument = useCallback(async (document) => {
    setError("");
    try {
      const response = await fetch(`/api/documents/${document.id}?sessionId=${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Unable to remove this document.");
      await removeDocumentFile(sessionId, document);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setSelectedIds((current) => current.filter((id) => id !== document.id));
    } catch (removeError) {
      setError(removeError.message);
    }
  }, [sessionId]);

  const toggleSelection = (id) => {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  };

  const submitQuestion = (event) => {
    event.preventDefault();
    if (!canAsk) return;
    onSubmit(question.trim(), {
      endpoint: "/api/documents/query",
      documentSessionId: sessionId,
      selectedDocumentIds: selectedIds,
    });
    setQuestion("");
  };

  const selectionLabel = useMemo(() => (
    selectedCount === 1 ? "1 document selected" : `${selectedCount} documents selected`
  ), [selectedCount]);

  return (
    <section className="mx-auto w-full max-w-3xl px-5 pb-8 pt-8" aria-labelledby="upload-ask-title">
      {!hasConversation && (
        <div className="mb-7">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.25em] text-[#8A6F9E]">Private document workspace</p>
          <h1 id="upload-ask-title" className="text-3xl font-medium tracking-[-0.03em] text-[#2F3E46] sm:text-4xl">
            Upload documents. Ask with confidence.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#2F3E46]/60">
            Select only the files you want searched. VaaniRAG will ground the answer in those documents and show the source file.
          </p>
        </div>
      )}

      <div className="rounded-3xl border border-[#2F3E46]/10 bg-white/65 p-4 shadow-sm sm:p-6">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="hidden"
          onChange={(event) => uploadFiles(event.target.files)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-[#8A6F9E]/45 bg-[#8A6F9E]/[0.06] px-5 py-7 text-sm font-medium text-[#5D496C] transition hover:bg-[#8A6F9E]/[0.11] disabled:cursor-wait disabled:opacity-60"
        >
          {isUploading ? <LoaderCircle className="animate-spin" size={20} /> : <UploadCloud size={20} />}
          {isUploading ? "Reading and indexing documents..." : "Choose multiple documents"}
        </button>

        {documents.length > 0 && (
          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2F3E46]/55">Your documents</p>
              <span className="text-xs text-[#2F3E46]/45">{selectionLabel}</span>
            </div>
            <div className="space-y-2">
              {documents.map((document, index) => {
                const selected = selectedIds.includes(document.id);
                return (
                  <div key={document.id} className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition ${selected ? "border-[#8A6F9E]/35 bg-[#8A6F9E]/[0.07]" : "border-[#2F3E46]/[0.08] bg-white/45"}`}>
                    <button
                      type="button"
                      aria-label={`${selected ? "Deselect" : "Select"} ${document.name}`}
                      aria-pressed={selected}
                      onClick={() => toggleSelection(document.id)}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${selected ? "border-[#8A6F9E] bg-[#8A6F9E] text-white" : "border-[#2F3E46]/15 text-transparent"}`}
                    >
                      <Check size={16} />
                    </button>
                    <FileText size={18} className="shrink-0 text-[#8A6F9E]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-[#2F3E46]">{index + 1}. {document.name}</span>
                      <span className="text-xs text-[#2F3E46]/45">{document.type} · {document.chunkCount} searchable sections</span>
                    </span>
                    <button type="button" onClick={() => removeDocument(document)} aria-label={`Remove ${document.name}`} className="rounded-lg p-2 text-[#2F3E46]/35 transition hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <form onSubmit={submitQuestion} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={selectedCount ? "Ask about the selected documents..." : "Select a document to start asking..."}
            disabled={!documents.length || isProcessing}
            className="min-h-12 flex-1 rounded-2xl border border-[#2F3E46]/10 bg-white/75 px-4 text-sm text-[#2F3E46] outline-none placeholder:text-[#2F3E46]/35 focus:border-[#8A6F9E]/55"
          />
          <button type="submit" disabled={!canAsk} className="min-h-12 rounded-2xl bg-[#5D496C] px-5 text-sm font-medium text-white transition hover:bg-[#4E3D5A] disabled:cursor-not-allowed disabled:opacity-35">
            Ask selected files
          </button>
        </form>
        {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </section>
  );
}

async function readResponse(response) {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(
      response.status
        ? `Document service returned an empty response (HTTP ${response.status}).`
        : "Document service is unavailable. Start the VaaniRAG backend and try again.",
    );
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Document service returned an invalid response (HTTP ${response.status}).`);
  }
}

export default UploadAskExperience;
