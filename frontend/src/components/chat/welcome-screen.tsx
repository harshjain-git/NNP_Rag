"use client";

import React from "react";

export interface SuggestionCard {
  title: string;
  description: string;
  prompt: string;
}

export const SUGGESTIONS: SuggestionCard[] = [
  {
    title: "Summarize key findings",
    description: "Get a comprehensive synthesis of your uploaded documents",
    prompt: "Summarize the key findings and executive takeaways across my documents.",
  },
  {
    title: "Compare policy clauses",
    description: "Identify differences and overlaps between reference guidelines",
    prompt: "Compare the primary clauses and requirements stated in the reference documents.",
  },
  {
    title: "Extract key metrics",
    description: "Locate quantitative data, dates, and tables from ingested files",
    prompt: "Extract the key performance indicators, dates, and numerical metrics from the files.",
  },
  {
    title: "Audit citations & sources",
    description: "Trace claims back to exact source text and page locations",
    prompt: "Provide an overview of the sources with verified citations and references.",
  },
];

interface WelcomeScreenProps {
  onSelectSuggestion: (prompt: string) => void;
}

export function WelcomeScreen({ onSelectSuggestion }: WelcomeScreenProps) {
  return (
    <div className="w-full max-w-3xl flex-1 flex flex-col items-center justify-center my-auto">
      {/* Welcome Section */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight mb-2.5">
          Ask your documents
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base max-w-md mx-auto">
          Search, synthesize, and query your knowledge base with verifiable citations.
        </p>
      </div>

      {/* Four Generously Rounded Suggestion Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
        {SUGGESTIONS.map((card, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectSuggestion(card.prompt)}
            className="p-5 rounded-2xl bg-[#262626]/80 hover:bg-[#2c2c2c] border border-zinc-800 hover:border-zinc-700 text-left transition-all group"
          >
            <p className="text-sm font-semibold text-zinc-200 group-hover:text-white mb-1">
              {card.title}
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {card.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
