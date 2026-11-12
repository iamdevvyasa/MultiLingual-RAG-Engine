import { FileUp, LibraryBig } from "lucide-react";

function FeatureSwitcher({ mode, onChange }) {
  return (
    <nav
      aria-label="VaaniRAG features"
      className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-5 pt-5 sm:flex-row"
    >
      <button
        type="button"
        aria-pressed={mode === "knowledge"}
        onClick={() => onChange("knowledge")}
        className={`flex flex-1 items-center gap-3 rounded-2xl border px-5 py-4 text-left transition ${
          mode === "knowledge"
            ? "border-[#8A6F9E]/45 bg-white/80 text-[#2F3E46] shadow-sm"
            : "border-[#2F3E46]/10 bg-white/35 text-[#2F3E46]/55 hover:bg-white/60"
        }`}
      >
        <LibraryBig size={19} strokeWidth={1.8} />
        <span>
          <strong className="block text-sm font-semibold">Knowledge Base</strong>
          <span className="text-xs opacity-65">Ask across the built-in collection</span>
        </span>
      </button>
      <button
        type="button"
        aria-pressed={mode === "documents"}
        onClick={() => onChange("documents")}
        className={`flex flex-1 items-center gap-3 rounded-2xl border px-5 py-4 text-left transition ${
          mode === "documents"
            ? "border-[#8A6F9E]/45 bg-white/80 text-[#2F3E46] shadow-sm"
            : "border-[#2F3E46]/10 bg-white/35 text-[#2F3E46]/55 hover:bg-white/60"
        }`}
      >
        <FileUp size={19} strokeWidth={1.8} />
        <span>
          <strong className="block text-sm font-semibold">Upload & Ask</strong>
          <span className="text-xs opacity-65">Question your own documents</span>
        </span>
      </button>
    </nav>
  );
}

export default FeatureSwitcher;
