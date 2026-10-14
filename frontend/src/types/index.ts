export * from "./auth";
export * from "./documents";
export * from "./chat";
export * from "./conversations";
export * from "./prompts";
export * from "./admin";
export * from "./events";

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorResponse {
  error: string;
  statusCode?: number;
  details?: ApiErrorDetail[];
}
