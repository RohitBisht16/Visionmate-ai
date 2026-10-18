"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionErrorEvent = Event & {
  error: string;
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const starters = [
  "What medicines are saved in my dashboard?",
  "Summarize my saved prescriptions.",
  "What safety information is available for me?",
  "Explain something about my medicines in simple language.",
];

export default function AIChatBox() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I’m Visionmate AI. Ask me a general question or ask about information saved in your dashboard.",
    },
  ]);

  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [status, setStatus] = useState("");

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const messagesRef = useRef<Message[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  function getLanguage() {
    return "en-IN";
  }

  function speakAnswer(text: string) {
    if (!("speechSynthesis" in window)) {
      setStatus("Voice output is not supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    if (text.match(/[\u0900-\u097F]/)) {
      speech.lang = "hi-IN";
    } else {
      speech.lang = "en-IN";
    }

    speech.rate = 0.85;
    speech.pitch = 1;

    speech.onstart = () => {
      setSpeaking(true);
      setStatus("🔊 Visionmate is speaking...");
    };

    speech.onend = () => {
      setSpeaking(false);
      setStatus("");
    };

    speech.onerror = () => {
      setSpeaking(false);
      setStatus("Voice response could not be played.");
    };

    window.speechSynthesis.speak(speech);
  }

  function stopSpeaking() {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setStatus("");
  }

  async function askAI(text: string) {
    if (!text.trim() || busy) return;

    const cleanText = text.trim();

    setQuestion("");
    setBusy(true);

    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: cleanText,
      },
    ]);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: cleanText,
          messages: messagesRef.current.slice(-10),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "AI request failed");
      }

      const answer =
        data?.answer ||
        "Sorry, I could not understand your question.";

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: answer,
        },
      ]);

      // Automatically speak AI answer
      speakAnswer(answer);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The AI assistant is temporarily unavailable.";

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: message,
        },
      ]);

      speakAnswer(message);
    } finally {
      setBusy(false);
    }
  }

  function startListening() {
    if (busy) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatus(
        "❌ Voice input is not supported. Please use Chrome or Edge."
      );
      return;
    }

    if (listening) return;

    const recognition = new SpeechRecognition();

    recognition.lang = getLanguage();
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setListening(true);
      setStatus("🎙️ Listening... Speak now");
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      transcript = transcript.trim();

      if (transcript) {
        setQuestion(transcript);
        setStatus(`📝 "${transcript}"`);
      }

      // Automatically send when speech is final
      const lastResult =
        event.results[event.results.length - 1];

      if (lastResult && lastResult.isFinal && transcript) {
        recognition.stop();

        setTimeout(() => {
          askAI(transcript);
        }, 300);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);

      setListening(false);

      if (event.error === "not-allowed") {
        setStatus(
          "❌ Microphone permission denied. Allow microphone access in your browser."
        );
      } else if (event.error === "no-speech") {
        setStatus("⚠️ I didn't hear anything. Please try again.");
      } else if (event.error === "audio-capture") {
        setStatus("❌ No microphone was detected.");
      } else {
        setStatus(`❌ Voice error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error(error);
      setListening(false);
      setStatus("❌ Could not start microphone.");
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
    setStatus("");
  }

  function sendQuestion(event?: FormEvent) {
    event?.preventDefault();

    if (!question.trim() || busy) return;

    askAI(question);
  }

  return (
    <section className="rounded-3xl border border-line bg-white p-5 shadow-[0_12px_35px_rgba(15,42,46,.06)] sm:p-6">

      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-[.16em] text-signal">
          Ask Visionmate
        </p>

        <h2 className="mt-2 font-display text-2xl sm:text-3xl">
          Your AI medication assistant
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/55">
          Speak naturally and Visionmate will understand your question and
          answer you with voice.
        </p>
      </div>

      {/* Voice Assistant */}
      <div className="mt-6 rounded-3xl border border-line bg-[#F7FAF9] p-6">

        <div className="text-center">
          <p className="text-sm font-bold text-ink">
            🎙️ Voice Assistant
          </p>

          <p className="mt-1 text-xs text-ink/50">
            Hindi • English • Hinglish
          </p>

          {/* Microphone */}
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            disabled={busy}
            className={`mx-auto mt-6 grid h-28 w-28 place-items-center rounded-full text-5xl text-white shadow-xl transition ${
              listening
                ? "animate-pulse bg-red-500"
                : "bg-signal hover:scale-105"
            } disabled:opacity-50`}
          >
            {listening ? "⏹️" : "🎙️"}
          </button>

          <p className="mt-4 text-base font-bold text-ink">
            {listening
              ? "Listening..."
              : busy
              ? "Thinking..."
              : speaking
              ? "Speaking..."
              : "Tap microphone to speak"}
          </p>

          {/* Status */}
          {status && (
            <div className="mx-auto mt-4 max-w-lg rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink/70">
              {status}
            </div>
          )}

          {/* Current recognized text */}
          {question && (
            <div className="mx-auto mt-4 max-w-lg rounded-xl bg-[#E9F4F2] px-4 py-3 text-sm text-ink">
              <span className="font-bold">You said:</span>{" "}
              {question}
            </div>
          )}

          {/* Stop voice */}
          {speaking && (
            <button
              type="button"
              onClick={stopSpeaking}
              className="mt-4 rounded-xl border border-line bg-white px-5 py-2 text-sm font-bold"
            >
              🔇 Stop Voice
            </button>
          )}
        </div>
      </div>

      {/* Suggested questions */}
      <div className="mt-5 flex flex-wrap gap-2">
        {starters.map((starter) => (
          <button
            key={starter}
            type="button"
            onClick={() => setQuestion(starter)}
            className="rounded-full border border-line bg-[#FBFEFD] px-3 py-2 text-xs font-semibold text-ink/65 hover:border-signal/30 hover:text-signal"
          >
            {starter}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="mt-5 h-[390px] overflow-y-auto rounded-2xl border border-line bg-[#F7FAF9] p-4">
        <div className="space-y-4">

          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${
                message.role === "user"
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              <div
                className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "rounded-br-md bg-[#0A3537] text-white"
                    : "rounded-bl-md border border-line bg-white text-ink/75"
                }`}
              >
                {message.content}

                {message.role === "assistant" && (
                  <button
                    type="button"
                    onClick={() => speakAnswer(message.content)}
                    className="mt-2 block text-xs font-bold text-signal hover:underline"
                  >
                    🔊 Listen
                  </button>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink/45">
                Thinking...
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Text chat fallback */}
      <form onSubmit={sendQuestion} className="mt-4 flex gap-2">

        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type or speak your question..."
          disabled={busy}
          className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none placeholder:text-ink/35 focus:border-signal focus:ring-2 focus:ring-signal/10"
        />

        <button
          type="button"
          onClick={listening ? stopListening : startListening}
          disabled={busy}
          className="rounded-xl border border-line bg-white px-4 py-3 text-xl hover:border-signal disabled:opacity-45"
        >
          🎙️
        </button>

        <button
          type="submit"
          disabled={busy || !question.trim()}
          className="rounded-xl bg-signal px-5 py-3 text-sm font-bold text-white disabled:opacity-45"
        >
          {busy ? "..." : "Send"}
        </button>

      </form>

      <p className="mt-3 text-[11px] leading-5 text-ink/40">
        Informational assistance only. Visionmate does not diagnose, prescribe,
        or recommend changing medication doses.
      </p>

    </section>
  );
}