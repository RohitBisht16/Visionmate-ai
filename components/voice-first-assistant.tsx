"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionErrorEvent = Event & {
  error: string;
};

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type RecognitionConstructor = new () => Recognition;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

export default function VoiceFirstAssistant() {
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState("Tap the microphone and speak.");

  const recognitionRef = useRef<Recognition | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  function speak(text: string) {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Indian English can handle many Hinglish responses.
    // Hindi-script responses will use Hindi voice where available.
    utterance.lang = /[\u0900-\u097F]/.test(text)
      ? "hi-IN"
      : "en-IN";

    utterance.rate = 0.85;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setSpeaking(true);
      setStatus("🔊 Visionmate is speaking...");
    };

    utterance.onend = () => {
      setSpeaking(false);
      setStatus("Tap the microphone and speak.");
    };

    utterance.onerror = () => {
      setSpeaking(false);
      setStatus("Voice response could not be played.");
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopVoice() {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setStatus("Voice stopped.");
  }

  async function processCommand(text: string) {
    const command = text.trim();

    if (!command) return;

    setThinking(true);
    setAnswer("");
    setStatus("🤖 Understanding your request...");

    const lower = command.toLowerCase();

    // Open existing prescription scanner
    if (
      lower.includes("scan my prescription") ||
      lower.includes("prescription scan") ||
      lower.includes("prescription ko scan")
    ) {
      const response =
        "Theek hai. Main prescription scanner open kar raha hoon.";

      setAnswer(response);
      speak(response);

      setTimeout(() => {
        window.location.href = "/prescription/scan";
      }, 2500);

      setThinking(false);
      return;
    }

    // Open medicines
    if (
      lower.includes("my medicines") ||
      lower.includes("meri medicines") ||
      lower.includes("meri medicine")
    ) {
      const response =
        "Theek hai. Main aapki saved medicines open kar raha hoon.";

      setAnswer(response);
      speak(response);

      setTimeout(() => {
        window.location.href = "/medicines";
      }, 2500);

      setThinking(false);
      return;
    }

    // General AI assistant
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: command,
          messages: [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "AI request failed");
      }

      const aiAnswer =
        data?.answer ||
        "Sorry, mujhe iska answer nahi mila.";

      setAnswer(aiAnswer);
      speak(aiAnswer);
      setStatus("Answer ready.");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Visionmate AI is temporarily unavailable.";

      setAnswer(errorMessage);
      speak(errorMessage);
      setStatus("There was a problem.");
    } finally {
      setThinking(false);
    }
  }

  function startListening() {
    if (thinking || listening) return;

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatus(
        "Voice input is not supported. Please use Chrome or Edge."
      );
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setListening(true);
      setTranscript("");
      setStatus("🎙️ Listening... Speak now.");
    };

    recognition.onresult = (event) => {
      let text = "";

      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }

      setTranscript(text);

      const lastResult =
        event.results[event.results.length - 1];

      if (lastResult?.isFinal && text.trim()) {
        recognition.stop();
        processCommand(text);
      }
    };

    recognition.onerror = (event) => {
      setListening(false);

      if (event.error === "not-allowed") {
        setStatus(
          "❌ Microphone permission denied. Please allow microphone access."
        );
      } else if (event.error === "no-speech") {
        setStatus("⚠️ I didn't hear anything. Please try again.");
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
    } catch {
      setListening(false);
      setStatus("Could not start microphone.");
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
    setStatus("Listening stopped.");
  }

  return (
    <section className="min-h-[calc(100vh-48px)] rounded-3xl border border-line bg-white p-6 shadow-[0_12px_35px_rgba(15,42,46,.06)] sm:p-10">

      {/* Header */}
      <header className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="font-display text-2xl font-semibold text-ink"
        >
          Visionmate AI
        </Link>

        <Link
          href="/dashboard"
          className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold"
        >
          Dashboard
        </Link>
      </header>

      {/* Main */}
      <div className="mx-auto max-w-2xl text-center">

        <p className="mt-12 text-xs font-bold uppercase tracking-[.18em] text-signal">
          Voice-First Mode
        </p>

        <h1 className="mt-3 font-display text-4xl font-semibold text-ink sm:text-5xl">
          Talk to Visionmate
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-ink/55 sm:text-base">
          Speak naturally in Hindi, English, or Hinglish.
          Visionmate will understand you and reply with voice.
        </p>

        {/* Microphone */}
        <button
          type="button"
          onClick={listening ? stopListening : startListening}
          disabled={thinking}
          className={`mx-auto mt-12 grid h-40 w-40 place-items-center rounded-full text-7xl text-white shadow-2xl transition sm:h-48 sm:w-48 ${
            listening
              ? "animate-pulse bg-red-500"
              : "bg-signal hover:scale-105"
          } disabled:cursor-not-allowed disabled:opacity-50`}
          aria-label="Voice assistant microphone"
        >
          {listening ? "⏹️" : "🎙️"}
        </button>

        <p className="mt-6 text-lg font-bold text-ink">
          {listening
            ? "Listening..."
            : thinking
            ? "Thinking..."
            : speaking
            ? "Speaking..."
            : "Tap to speak"}
        </p>

        <p className="mt-2 text-sm text-ink/45">
          {status}
        </p>

        {/* User speech */}
        {transcript && (
          <div className="mt-8 rounded-2xl border border-line bg-[#F7FAF9] p-5 text-left">
            <p className="text-xs font-bold uppercase tracking-wider text-signal">
              You said
            </p>

            <p className="mt-2 text-base leading-7 text-ink">
              {transcript}
            </p>
          </div>
        )}

        {/* AI answer */}
        {answer && (
          <div className="mt-4 rounded-2xl border border-line bg-[#E9F4F2] p-5 text-left">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-signal">
                Visionmate
              </p>

              <button
                type="button"
                onClick={() => speak(answer)}
                className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-signal"
              >
                🔊 Replay
              </button>
            </div>

            <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-ink">
              {answer}
            </p>

            {speaking && (
              <button
                type="button"
                onClick={stopVoice}
                className="mt-4 rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold"
              >
                🔇 Stop speaking
              </button>
            )}
          </div>
        )}

        {/* Quick examples */}
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {[
            "Meri medicines batao",
            "Meri prescription scan karo",
            "What medicines are saved?",
            "Mujhe simple language mein samjhao",
          ].map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => processCommand(text)}
              disabled={thinking || listening}
              className="rounded-2xl border border-line bg-[#FBFEFD] p-4 text-left text-sm font-semibold text-ink/70 hover:border-signal hover:text-signal disabled:opacity-50"
            >
              🎙️ {text}
            </button>
          ))}
        </div>

        {/* Elder mode */}
        <div className="mt-8 rounded-2xl bg-[#F7FAF9] p-5 text-left">
          <p className="font-bold text-ink">
            👴 Elder-friendly mode
          </p>

          <p className="mt-2 text-sm leading-6 text-ink/55">
            No typing is required. Speak your question and Visionmate
            automatically speaks the answer back to you.
          </p>
        </div>
      </div>
    </section>
  );
}