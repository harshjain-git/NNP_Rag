"use client";

import React, { useEffect, useRef } from "react";
import type { Message } from "@/types";
import { MessageItem } from "./message-item";

interface MessageListProps {
  messages: Message[];
  isGenerating?: boolean;
}

export function MessageList({ messages, isGenerating = false }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  return (
    <div className="w-full max-w-3xl flex-1 flex flex-col space-y-6 py-4">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}

      {/* Generating / Thinking Indicator */}
      {isGenerating && (
        <div className="flex items-center gap-2 text-zinc-400 text-xs sm:text-sm pl-1 py-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse [animation-delay:200ms]" />
            <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse [animation-delay:400ms]" />
          </div>
          <span className="text-zinc-500 text-xs">Generating grounded answer...</span>
        </div>
      )}

      <div ref={bottomRef} className="h-2" />
    </div>
  );
}
