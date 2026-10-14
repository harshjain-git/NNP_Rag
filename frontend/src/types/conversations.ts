import type { Citation } from "./chat";

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[] | null;
  createdAt: string;
}

export interface ConversationListResponse {
  conversations: Conversation[];
}

export interface ConversationDetailResponse {
  conversation: Conversation & {
    messages: Message[];
  };
  messages: Message[];
}

export interface DeleteConversationResponse {
  message: string;
  id: string;
}
