"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatIcon, CloseIcon, LogoMark, SendIcon } from "./icons";
import { OPEN_CHAT_EVENT } from "@/lib/chat-events";
import { cn } from "@/lib/cn";

interface Message {
  role: "user" | "bot";
  text: string;
}

const WELCOME: Message = {
  role: "bot",
  text: "Hi! I'm the schools assistant. Ask me about curricula, fees, or areas in Dubai.",
};

const SUGGESTIONS = [
  "Which schools offer the IB?",
  "What does a KHDA rating mean?",
  "British schools under AED 50,000",
];

/**
 * Streams the reply from /api/chat, calling onChunk as text arrives so the
 * answer appears while it is being written. Prior turns are sent along so the
 * assistant can follow a conversation rather than answering each message cold.
 */
async function streamBotReply(
  history: Message[],
  userText: string,
  onChunk: (text: string) => void,
  signal: AbortSignal
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chatInput: userText,
      history: history.map((m) => ({ role: m.role, text: m.text })),
    }),
    signal,
  });

  if (!res.body) {
    onChunk(await res.text());
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // send() reads history without depending on `messages`, so the callback
  // identity stays stable while a reply streams in.
  const messagesRef = useRef(messages);

  // The navbar CTA (and anything else) can open the panel via a window event.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, sending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Drop an in-flight reply if the panel closes or the page unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      // Snapshot the turns before this one — that is what the model needs.
      const priorTurns = messagesRef.current.slice(1);

      setMessages((m) => [...m, { role: "user", text: trimmed }]);
      setInput("");
      setSending(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let started = false;

      const append = (chunk: string) => {
        if (!chunk) return;
        setMessages((m) => {
          if (!started) {
            started = true;
            return [...m, { role: "bot", text: chunk }];
          }
          const next = [...m];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, text: last.text + chunk };
          return next;
        });
      };

      try {
        await streamBotReply(priorTurns, trimmed, append, controller.signal);
        if (!started) append("Sorry, I didn't catch that. Please try again.");
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          append(
            "Sorry, I couldn't reach the assistant right now. Please try again in a moment."
          );
        }
      } finally {
        setSending(false);
        abortRef.current = null;
        inputRef.current?.focus();
      }
    },
    [sending]
  );

  const showSuggestions = messages.length === 1 && !sending;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close the schools assistant" : "Open the schools assistant"}
        aria-expanded={open}
        aria-controls="chat-panel"
        className={cn(
          "fixed bottom-5 right-5 z-50 flex size-13 items-center justify-center rounded-full",
          "bg-brand-700 p-3.5 text-white shadow-lg",
          "transition-[background-color,transform,box-shadow] duration-200 ease-out",
          "hover:bg-brand-800 hover:shadow-panel active:scale-95 sm:bottom-6 sm:right-6"
        )}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>

      {open && (
        <div
          id="chat-panel"
          ref={panelRef}
          role="dialog"
          aria-label="Schools assistant"
          className={cn(
            "animate-pop-in fixed bottom-24 right-4 z-50 flex flex-col overflow-hidden",
            "h-[30rem] max-h-[calc(100dvh-8rem)] w-[calc(100vw-2rem)] max-w-[22rem]",
            "rounded-xl border border-ink-200 bg-white shadow-panel sm:right-6"
          )}
        >
          <header className="flex items-center gap-2.5 border-b border-ink-200 bg-white px-4 py-3">
            <span className="flex size-7 items-center justify-center rounded-md bg-brand-700 p-1.5 text-white">
              <LogoMark />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-900">
                Schools assistant
              </p>
              <p className="text-[11px] text-ink-500">
                Answers based on this site
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="-mr-1.5 flex size-8 items-center justify-center rounded-md p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              <CloseIcon />
            </button>
          </header>

          <div
            className="scrollbar-slim flex-1 space-y-3 overflow-y-auto bg-ink-50 px-4 py-4"
            aria-live="polite"
            aria-atomic="false"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "w-fit max-w-[88%] whitespace-pre-line rounded-lg px-3 py-2 text-[13px] leading-relaxed",
                  m.role === "user"
                    ? "ml-auto bg-brand-700 text-white"
                    : "border border-ink-200 bg-white text-ink-700 shadow-xs"
                )}
              >
                {m.text}
              </div>
            ))}

            {sending && (
              <div className="flex w-fit items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 py-2.5 shadow-xs">
                <span className="sr-only">Assistant is typing</span>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="animate-blink size-1.5 rounded-full bg-ink-400"
                    style={{ animationDelay: `${i * 160}ms` }}
                  />
                ))}
              </div>
            )}

            {showSuggestions && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-sm border border-ink-200 bg-white px-2.5 py-1.5 text-left text-xs font-medium text-ink-600 shadow-xs transition-colors hover:border-ink-300 hover:text-ink-900"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-ink-200 bg-white p-2.5"
          >
            <label htmlFor="chat-input" className="sr-only">
              Ask the schools assistant
            </label>
            <input
              id="chat-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a school…"
              autoComplete="off"
              className="h-9 flex-1 rounded-md border border-ink-200 bg-white px-3 text-[13px] text-ink-900 placeholder:text-ink-400 transition-[border-color,box-shadow] focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/12"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              aria-label="Send message"
              className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-700 p-2.5 text-white transition-colors hover:bg-brand-800 disabled:pointer-events-none disabled:opacity-40"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
