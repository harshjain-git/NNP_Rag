"use client";

import React, { useState } from "react";
import type { ProjectConfig, UpdateProjectConfigPayload, LLMProviderName } from "@/types";
import { ShieldIcon } from "@/components/ui/icons";

interface ProjectConfigurationProps {
  config: ProjectConfig | null;
  isLoading: boolean;
  isSaving: boolean;
  onSave: (payload: UpdateProjectConfigPayload) => Promise<boolean>;
}

function NumField({
  label,
  value,
  onChange,
  step,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-300 mb-1">{label}</label>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-1.5 rounded-xl bg-[#2f2f2f] border border-zinc-700 text-xs sm:text-sm text-white focus:outline-hidden"
      />
    </div>
  );
}

export function ProjectConfiguration({
  config,
  isLoading,
  isSaving,
  onSave,
}: ProjectConfigurationProps) {
  if (isLoading || !config) {
    return (
      <div className="p-8 text-center text-xs text-zinc-500 bg-[#262626] rounded-2xl border border-zinc-800">
        Loading system configuration...
      </div>
    );
  }

  return (
    <ConfigForm
      key={JSON.stringify(config)}
      config={config}
      isSaving={isSaving}
      onSave={onSave}
    />
  );
}

function ConfigForm({
  config,
  isSaving,
  onSave,
}: {
  config: ProjectConfig;
  isSaving: boolean;
  onSave: (payload: UpdateProjectConfigPayload) => Promise<boolean>;
}) {
  const [llmProvider, setLlmProvider] = useState<LLMProviderName>(config.models.llmProvider);
  const [llmModel, setLlmModel] = useState(config.models.llmModel);

  const [topK, setTopK] = useState(config.retrieval.topK);
  const [minSimilarity, setMinSimilarity] = useState(config.retrieval.minSimilarity);
  const [minSufficiencyScore, setMinSufficiencyScore] = useState(config.retrieval.minSufficiencyScore);

  const [structuralTarget, setStructuralTarget] = useState(config.chunking.structuralTarget);
  const [structuralMax, setStructuralMax] = useState(config.chunking.structuralMax);
  const [fallbackChunkSize, setFallbackChunkSize] = useState(config.chunking.fallbackChunkSize);
  const [fallbackOverlap, setFallbackOverlap] = useState(config.chunking.fallbackOverlap);
  const [minChunkChars, setMinChunkChars] = useState(config.chunking.minChunkChars);

  const [temperature, setTemperature] = useState(config.generation.temperature);
  const [maxTokens, setMaxTokens] = useState(config.generation.maxTokens);
  const [concurrency, setConcurrency] = useState(config.system.ingestionConcurrency);
  const [error, setError] = useState<string | null>(null);

  const DEFAULT_MODELS: Record<LLMProviderName, string> = {
    groq: "llama-3.3-70b-versatile",
    gemini: "gemini-1.5-flash",
    ollama: "llama3:8b",
  };

  const handleProviderChange = (newProvider: LLMProviderName) => {
    setLlmProvider(newProvider);
    if (!llmModel || Object.values(DEFAULT_MODELS).includes(llmModel)) {
      setLlmModel(DEFAULT_MODELS[newProvider]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!llmModel.trim()) return setError("LLM Model identifier cannot be empty.");
    if (topK < 1 || topK > 50) return setError("Retrieval topK must be between 1 and 50.");
    if (structuralMax < structuralTarget) return setError("Structural Max must be >= Structural Target.");
    if (fallbackOverlap >= fallbackChunkSize) return setError("Fallback Overlap must be < Fallback Chunk Size.");

    await onSave({
      models: { llmProvider, llmModel: llmModel.trim() },
      retrieval: { topK, minSimilarity, minSufficiencyScore },
      chunking: { structuralTarget, structuralMax, fallbackChunkSize, fallbackOverlap, minChunkChars },
      generation: { temperature, maxTokens },
      system: { ingestionConcurrency: concurrency },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-2xl bg-red-950/40 border border-red-800 text-red-200 text-xs">
          {error}
        </div>
      )}

      {/* 1. Models */}
      <div className="p-4 rounded-2xl bg-[#262626] border border-zinc-800 space-y-3">
        <h3 className="text-sm font-semibold text-white">Models</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">LLM Provider</label>
            <select
              value={llmProvider}
              onChange={(e) => handleProviderChange(e.target.value as LLMProviderName)}
              className="w-full px-3 py-1.5 rounded-xl bg-[#2f2f2f] border border-zinc-700 text-xs sm:text-sm text-white focus:outline-hidden"
            >
              <option value="ollama">Ollama (Local)</option>
              <option value="groq">Groq (Cloud)</option>
              <option value="gemini">Gemini (Cloud)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">LLM Model</label>
            <input
              type="text"
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-[#2f2f2f] border border-zinc-700 text-xs sm:text-sm text-white focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Embedding Provider</label>
            <input
              type="text"
              value="local"
              disabled
              className="w-full px-3 py-1.5 rounded-xl bg-[#222] border border-zinc-800 text-xs text-zinc-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Embedding Model (512-dim)</label>
            <input
              type="text"
              value={config.models.embeddingModel}
              disabled
              className="w-full px-3 py-1.5 rounded-xl bg-[#222] border border-zinc-800 text-xs text-zinc-500 cursor-not-allowed font-mono"
            />
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-blue-950/30 border border-blue-900/40 text-[11px] text-blue-300 flex items-center gap-2">
          <ShieldIcon className="w-4 h-4 text-blue-400 shrink-0" />
          <span>pgvector schema is locked to 512 dimensions. Changing embedding models requires re-indexing.</span>
        </div>
      </div>

      {/* 2. Retrieval */}
      <div className="p-4 rounded-2xl bg-[#262626] border border-zinc-800 space-y-3">
        <h3 className="text-sm font-semibold text-white">Retrieval</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NumField label="Top-K Chunks" value={topK} onChange={setTopK} min={1} max={50} />
          <NumField label="Min Similarity" value={minSimilarity} onChange={setMinSimilarity} step="0.05" min={0} max={1} />
          <NumField label="Sufficiency Score" value={minSufficiencyScore} onChange={setMinSufficiencyScore} step="0.05" min={0} max={1} />
        </div>
      </div>

      {/* 3. Chunking */}
      <div className="p-4 rounded-2xl bg-[#262626] border border-zinc-800 space-y-3">
        <h3 className="text-sm font-semibold text-white">Chunking</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <NumField label="Structural Target" value={structuralTarget} onChange={setStructuralTarget} min={100} max={5000} />
          <NumField label="Structural Max" value={structuralMax} onChange={setStructuralMax} min={100} max={10000} />
          <NumField label="Fallback Chunk Size" value={fallbackChunkSize} onChange={setFallbackChunkSize} min={100} max={5000} />
          <NumField label="Fallback Overlap" value={fallbackOverlap} onChange={setFallbackOverlap} min={0} max={2500} />
          <NumField label="Min Chunk Chars" value={minChunkChars} onChange={setMinChunkChars} min={50} max={1000} />
        </div>
      </div>

      {/* 4. Generation & System */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-[#262626] border border-zinc-800 space-y-3">
          <h3 className="text-sm font-semibold text-white">Generation</h3>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Temperature" value={temperature} onChange={setTemperature} step="0.05" min={0} max={1} />
            <NumField label="Max Tokens" value={maxTokens} onChange={setMaxTokens} min={64} max={4096} />
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-[#262626] border border-zinc-800 space-y-3">
          <h3 className="text-sm font-semibold text-white">System</h3>
          <NumField label="Ingestion Concurrency" value={concurrency} onChange={setConcurrency} min={1} max={10} />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2 rounded-full bg-white text-black text-xs font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
        >
          {isSaving ? "Saving..." : "Save Configuration"}
        </button>
      </div>
    </form>
  );
}
