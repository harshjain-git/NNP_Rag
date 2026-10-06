import "dotenv/config";

const DATABASE_URL = process.env.DATABASE_URL;

const LLAMAPARSE_API_KEY =
  process.env.LLAMAPARSE_API_KEY || process.env.LLAMA_CLOUD_API_KEY;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

if (!LLAMAPARSE_API_KEY) {
  throw new Error("LLAMAPARSE_API_KEY is not defined");
}

export { DATABASE_URL, LLAMAPARSE_API_KEY };