import fs from "node:fs";
import { LlamaCloud } from "@llamaindex/llama-cloud";
import { LLAMAPARSE_API_KEY } from "../../config/env.js";

import { cleanText } from "./cleaner.js";

const client = new LlamaCloud({ apiKey: LLAMAPARSE_API_KEY });

export { cleanText } from "./cleaner.js";

export interface ParsedPage {
  pageNumber: number;
  text: string;
}

export interface ParseResult {
  text: string;
  pages: ParsedPage[];
}

export interface ParseOptions {
  maxPages?: number;
  targetPages?: string;
}

export const parseDocument = async (
  filePath: string,
  options?: ParseOptions
): Promise<ParseResult> => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const page_ranges =
    options?.maxPages !== undefined || options?.targetPages !== undefined
      ? {
          ...(options.maxPages !== undefined ? { max_pages: options.maxPages } : {}),
          ...(options.targetPages !== undefined ? { target_pages: options.targetPages } : {}),
        }
      : undefined;

  const result = await client.parsing.parse({
    upload_file: fs.createReadStream(filePath),
    tier: "cost_effective",
    version: "latest",
    expand: ["markdown"],
    ...(page_ranges ? { page_ranges } : {}),
  });

  const rawPages = result.markdown?.pages ?? [];
  const pages: ParsedPage[] = rawPages
    .filter((page) => "markdown" in page)
    .map((page) => {
      const p = page as { page_number: number; markdown: string };
      return {
        pageNumber: p.page_number,
        text: cleanText(p.markdown),
      };
    });

  const text = pages.map((p) => p.text).join("\n\n");

  return {
    text,
    pages,
  };
};

