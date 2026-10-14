import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer, IncomingMessage } from "node:http";
import type {
  IngestionEvent,
  IngestionEventType,
  IngestionEventPayload,
} from "./events.js";
import { handleClientConnection, verifyAuthToken } from "./chat.handler.js";

let wss: WebSocketServer | null = null;

/**
 * Initializes the WebSocket server attached to the existing Node.js HTTP server.
 */
export const initRealtimeServer = (
  server: HttpServer,
  path: string = "/ws"
): WebSocketServer => {
  wss = new WebSocketServer({ server, path });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    ws.on("error", (err) => {
      console.error("WebSocket client connection error:", err);
    });

    // Extract optional token from URL query string (?token=...)
    let initialUser: { id: string; role: string } | null = null;
    if (req.url) {
      try {
        const url = new URL(req.url, "http://localhost");
        const token = url.searchParams.get("token");
        if (token) {
          initialUser = verifyAuthToken(token);
        }
      } catch {
        // Ignore URL parsing errors
      }
    }
    // Attach chat streaming message handling and session isolation
    handleClientConnection(ws, initialUser);

    // Send initial handshake acknowledgment
    ws.send(
      JSON.stringify({
        type: "connection.connected",
        payload: {
          message: "Connected to NNT RAG realtime stream",
          timestamp: new Date().toISOString(),
        },
      }),
      (err) => {
        if (err) console.error("Failed to send handshake acknowledgment:", err);
      }
    );
  });

  return wss;
};

/**
 * Publishes an ingestion lifecycle event to all connected WebSocket clients.
 * Application and ingestion code use this abstraction without managing WebSocket connections directly.
 */
export const publishIngestionEvent = (
  type: IngestionEventType,
  payload: IngestionEventPayload
): void => {
  if (!wss) return;

  const event: IngestionEvent = {
    type,
    payload: {
      ...payload,
      timestamp: payload.timestamp || new Date().toISOString(),
    },
  };

  const serialized = JSON.stringify(event);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized, (err) => {
        if (err) console.error("Failed to send ingestion event to client:", err);
      });
    }
  }
};

/**
 * Returns current count of connected WebSocket clients.
 */
export const getConnectedClientsCount = (): number => {
  return wss ? wss.clients.size : 0;
};

/**
 * Closes the realtime WebSocket server.
 */
export const closeRealtimeServer = async (): Promise<void> => {
  if (!wss) return;
  for (const client of wss.clients) {
    client.terminate();
  }
  return new Promise((resolve, reject) => {
    wss!.close((err) => {
      if (err) reject(err);
      else {
        wss = null;
        resolve();
      }
    });
  });
};
