import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "../src/rag/ingestion/parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const uploadsDir = path.resolve(backendRoot, "uploads");

const findSamplePdf = (): string | null => {
  if (!fs.existsSync(uploadsDir)) return null;
  const files = fs.readdirSync(uploadsDir);
  const pdfs = files.filter((f) => f.toLowerCase().endsWith(".pdf"));
  if (pdfs.length === 0) return null;
  // Return the first found PDF (or prioritize apa1 / Document if matches)
  return path.join(uploadsDir, pdfs[0]);
};

async function main() {
  const rawArgs = process.argv.slice(2);

  // Normalize args in case user typed --uploads/... or --path/... without space after npm --
  const args = rawArgs.map((arg) => {
    if (arg.startsWith("--") && (arg.includes("/") || arg.includes("\\") || arg.endsWith(".pdf"))) {
      return arg.replace(/^--/, "");
    }
    return arg;
  });

  // Check for optional page limits: e.g. --max 2 or --pages 1,2,3
  let maxPages: number | undefined;
  let targetPages: string | undefined;

  const maxIndex = args.findIndex((a) => a === "--max" || a.startsWith("--max="));
  if (maxIndex !== -1) {
    const val = args[maxIndex].includes("=")
      ? args[maxIndex].split("=")[1]
      : args[maxIndex + 1];
    if (val) maxPages = parseInt(val, 10);
  }

  const pagesIndex = args.findIndex((a) => a === "--pages" || a.startsWith("--pages="));
  if (pagesIndex !== -1) {
    const val = args[pagesIndex].includes("=")
      ? args[pagesIndex].split("=")[1]
      : args[pagesIndex + 1];
    if (val) targetPages = val;
  }

  // Find candidate target file
  let targetFile = args.find((arg) => {
    if (arg.startsWith("--")) return false;
    // Don't treat values consumed by --max or --pages as file
    if (maxPages && arg === String(maxPages)) return false;
    if (targetPages && arg === targetPages) return false;
    return true;
  });

  // If the targetFile looks like a page range (e.g., "3,6" or "1-5"), assign it to targetPages
  if (targetFile && /^[\d,-]+$/.test(targetFile) && !fs.existsSync(targetFile)) {
    if (!targetPages) targetPages = targetFile;
    targetFile = undefined;
  }

  if (!targetFile) {
    const sample = findSamplePdf();
    if (!sample) {
      console.error("❌ No PDF file provided and no sample PDF found in backend/uploads/");
      console.log("\nUsage:");
      console.log("  npm run test:parse -- <path-to-pdf> [--max <number>] [--pages <target-pages>]");
      console.log("  npx tsx scripts/test-parser.ts <path-to-pdf> [--max <number>] [--pages <target-pages>]\n");
      process.exit(1);
    }
    targetFile = sample;
    console.log(`ℹ️  No file specified. Using detected sample PDF:\n   ${targetFile}\n`);
  } else {
    // Check if relative path or inside uploads
    const resolved = path.resolve(process.cwd(), targetFile);
    if (!fs.existsSync(resolved)) {
      const inUploads = path.resolve(uploadsDir, targetFile);
      if (fs.existsSync(inUploads)) {
        targetFile = inUploads;
      } else {
        targetFile = resolved;
      }
    } else {
      targetFile = resolved;
    }
  }

  if (!fs.existsSync(targetFile)) {
    console.error(`❌ File does not exist: ${targetFile}`);
    process.exit(1);
  }

  console.log(`🚀 Parsing document with LlamaParse: ${path.basename(targetFile)}...`);
  if (maxPages) console.log(`   (Limiting to max ${maxPages} pages)`);
  if (targetPages) console.log(`   (Targeting specific pages: ${targetPages})`);
  const startTime = Date.now();

  try {
    const result = await parseDocument(targetFile, { maxPages, targetPages });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Parsing completed in ${duration}s!`);
    console.log(`📄 Total Pages: ${result.pages.length}`);
    console.log(`📝 Total Characters: ${result.text.length}\n`);

    console.log("----------------- Page Breakdown -----------------");
    for (const page of result.pages) {
      const firstLine = page.text.trim().split("\n")[0] || "(empty)";
      console.log(
        `• Page ${page.pageNumber}: ${page.text.length} chars | First line: "${firstLine.slice(0, 60)}"`
      );
    }
    console.log("--------------------------------------------------\n");

    // Save full markdown output for manual inspection
    const outputDir = path.resolve(backendRoot, "parsed_output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const baseName = path.basename(targetFile, path.extname(targetFile));
    const outputPath = path.join(outputDir, `${baseName}.parsed.md`);

    const fileContent = [
      `# Parsed Output for: ${path.basename(targetFile)}`,
      `> Extracted via LlamaParse on ${new Date().toISOString()}`,
      `> Total Pages: ${result.pages.length} | Total Chars: ${result.text.length}`,
      "",
      "---",
      "",
      ...result.pages.map((p) => [
        `<!-- PAGE ${p.pageNumber} START -->`,
        `## [Page ${p.pageNumber}]`,
        "",
        p.text,
        "",
        `<!-- PAGE ${p.pageNumber} END -->`,
        "---",
        "",
      ].join("\n")),
    ].join("\n");

    fs.writeFileSync(outputPath, fileContent, "utf-8");

    console.log(`💾 Full Markdown saved for inspection:`);
    console.log(`   ${outputPath}\n`);
    console.log(`💡 You can open this file in your editor to inspect the full formatting, tables, and headers.`);
  } catch (error) {
    console.error("❌ Error during parsing:", error);
    process.exit(1);
  }
}

main();
