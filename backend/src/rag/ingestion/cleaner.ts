/**
 * Conservative text cleaning and normalization step.
 * Executed after LlamaParse extraction and before chunking.
 *
 * Removes only obvious formatting and parser artifacts:
 * - Completely empty HTML elements (e.g. <td></td>, <th></th>)
 * - Standalone "---" page separators
 * - Excessive consecutive blank lines (collapses 3+ newlines to 2)
 * - Unnecessary whitespace (line trailing whitespace, leading/trailing page whitespace)
 *
 * Strictly preserves all meaningful document content and structure:
 * headers, lists, numbers, references, links, and non-empty tables.
 */
export const cleanText = (text: string): string => {
  if (!text) return "";

  let result = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  // 1. Remove completely empty HTML elements (e.g. <td></td>, <th></th>, <span></span>)
  // Handles standalone lines and inline tags, including nested empty elements
  let prev: string;
  let iterations = 0;
  do {
    prev = result;
    result = result
      .replace(/^[ \t]*<([a-zA-Z0-9]+)[^>]*>\s*<\/\1>[ \t]*(\n|$)/gm, "")
      .replace(/<([a-zA-Z0-9]+)[^>]*>\s*<\/\1>/g, "");
    iterations++;
  } while (result !== prev && iterations < 5);

  // 2. Remove standalone "---" page separators
  result = result.replace(/^[ \t]*-{3,}[ \t]*(\n|$)/gm, "");

  // 3. Remove trailing whitespace from each line
  result = result.replace(/[ \t]+$/gm, "");

  // 4. Collapse excessive consecutive blank lines (3+ newlines -> 2 newlines)
  result = result.replace(/\n{3,}/g, "\n\n");

  // 5. Trim leading and trailing whitespace
  return result.trim();
};
