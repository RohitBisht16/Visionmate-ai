"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type SpeechRecognitionType = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
  onresult: ((event: any) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionType;

// Speech recognition isn't in the standard DOM typings; typed locally to avoid
// conflicting global Window augmentations across components.
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export default function GlobalVoiceAssistant() {
  const router = useRouter();
  const pathname = usePathname();

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    setMounted(true);
    return () => {
      recognitionRef.current?.stop();
      if (typeof window !== "undefined") {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // --------------------------------------------------
  // SPEAK
  // --------------------------------------------------

  const speak = (text: string) => {
    if (!text || typeof window === "undefined") return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Hindi if Hindi script is detected
    if (/[\u0900-\u097F]/.test(text)) {
      utterance.lang = "hi-IN";
    } else {
      utterance.lang = "en-IN";
    }

    utterance.rate = 0.9;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setSpeaking(true);
    };

    utterance.onend = () => {
      setSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  // --------------------------------------------------
  // NAVIGATION
  // --------------------------------------------------

  const navigate = (path: string, message: string) => {
    setAnswer(message);
    speak(message);

    setTimeout(() => {
      router.push(path);
    }, 1000);
  };

  // --------------------------------------------------
  // COMMAND ROUTER
  // --------------------------------------------------

  const processCommand = async (rawText: string) => {
    const text = rawText.toLowerCase().trim();

    if (!text) return;

    setThinking(true);
    setAnswer("");

    const hasNavIntent =
      /\b(le\s*jao|jao|kholo|dikhao|open|go\s*to|take\s*me|navigate|show|page|section|par|per|pe)\b/i.test(
        text
      ) || /जाओ|ले जाओ|खोलो|दिखाओ|पेज/.test(text);

    // -----------------------------------------------
    // DASHBOARD
    // -----------------------------------------------

    if (
      text.includes("dashboard") ||
      text.includes("home page") ||
      text.includes("home par") ||
      text.includes("home per") ||
      text.includes("overview") ||
      text.includes("होम") ||
      text.includes("डैशबोर्ड")
    ) {
      setThinking(false);
      navigate("/dashboard", "Okay, I'm taking you to the dashboard.");
      return;
    }

    // -----------------------------------------------
    // MEDICINE SCANNER (/scan)
    // -----------------------------------------------

    if (
      text.includes("scan medicine") ||
      text.includes("medicine scan") ||
      text.includes("tablet scan") ||
      text.includes("dawai scan") ||
      text.includes("दवाई स्कैन")
    ) {
      setThinking(false);
      navigate("/scan", "Okay, I'm opening the medicine scanner.");
      return;
    }

    // -----------------------------------------------
    // MY MEDICINES (/medicines)
    // -----------------------------------------------

    if (
      text.includes("my medicines") ||
      text.includes("my medicine") ||
      text.includes("meri medicines") ||
      text.includes("meri medicine") ||
      text.includes("active medicine") ||
      text.includes("मेरी मेडिसिन") ||
      text.includes("मेरी दवाइयां") ||
      text.includes("मेरी दवाइयाँ") ||
      text.includes("दवाइयां दिखाओ") ||
      text.includes("दवाइयाँ दिखाओ") ||
      (hasNavIntent &&
        (text.includes("medicine") ||
          text.includes("dawai") ||
          text.includes("दवाई") ||
          text.includes("दवाइ")))
    ) {
      setThinking(false);
      navigate("/medicines", "Sure, I'm opening your medicines section.");
      return;
    }

    // -----------------------------------------------
    // PRESCRIPTION SCANNER (/prescription/scan)
    // -----------------------------------------------

    if (
      text.includes("prescription scan") ||
      text.includes("scan prescription") ||
      text.includes("prescription scanner") ||
      text.includes("prescription ko scan") ||
      text.includes("prescription scan karo") ||
      text.includes("प्रिस्क्रिप्शन स्कैन") ||
      text.includes("प्रिस्क्रिप्शन स्कैन करो")
    ) {
      setThinking(false);
      navigate(
        "/prescription/scan",
        "Okay, I'm opening the prescription scanner."
      );
      return;
    }

    // -----------------------------------------------
    // PRESCRIPTIONS PAGE (/prescriptions or /prescription/scan)
    // -----------------------------------------------

    if (
      text.includes("prescriptions") ||
      text.includes("prescription history") ||
      text.includes("meri prescriptions") ||
      text.includes("prescription dikhao") ||
      text.includes("प्रिस्क्रिप्शन दिखाओ") ||
      (hasNavIntent &&
        (text.includes("prescription") ||
          text.includes("parcha") ||
          text.includes("प्रिस्क्रिप्शन") ||
          text.includes("पर्चा")))
    ) {
      setThinking(false);
      navigate("/prescription/scan", "Sure, I'm taking you to the prescription page.");
      return;
    }

    // -----------------------------------------------
    // SAFETY CENTER (/safety)
    // -----------------------------------------------

    if (
      text.includes("safety center") ||
      text.includes("safety") ||
      text.includes("सेफ्टी सेंटर") ||
      text.includes("सुरक्षा")
    ) {
      setThinking(false);
      navigate("/safety", "Okay, I'm opening the Safety Center.");
      return;
    }

    // -----------------------------------------------
    // HISTORY (/history)
    // -----------------------------------------------

    if (
      text.includes("history") ||
      text.includes("हिस्ट्री") ||
      (hasNavIntent && (text.includes("record") || text.includes("purana")))
    ) {
      setThinking(false);
      navigate("/history", "Sure, I'm opening your medical history.");
      return;
    }

    // -----------------------------------------------
    // PROFILE (/profile)
    // -----------------------------------------------

    if (
      text.includes("profile") ||
      text.includes("emergency") ||
      text.includes("allergy") ||
      text.includes("प्रोफाइल")
    ) {
      setThinking(false);
      navigate("/profile", "Sure, I'm opening your profile page.");
      return;
    }

    // -----------------------------------------------
    // ASK VISIONMATE (/ask)
    // -----------------------------------------------

    if (
      text.includes("ask visionmate") ||
      text.includes("ai chat") ||
      text.includes("chat with ai") ||
      text.includes("ai se baat")
    ) {
      setThinking(false);
      navigate("/ask", "Okay, I'm opening Ask Visionmate.");
      return;
    }

    // -----------------------------------------------
    // BACK
    // -----------------------------------------------

    if (
      text === "go back" ||
      text === "back" ||
      text.includes("peeche jao") ||
      text.includes("piche jao") ||
      text.includes("पीछे जाओ")
    ) {
      setThinking(false);
      setAnswer("Okay, going back.");
      speak("Okay, going back.");

      setTimeout(() => {
        router.back();
      }, 1000);

      return;
    }

    // -----------------------------------------------
    // GENERAL AI QUESTION
    // -----------------------------------------------

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: rawText,
          messages: [],
          context: {
            currentPage: pathname,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "AI request failed");
      }

      const aiAnswer =
        data.answer ||
        data.message ||
        data.response ||
        "Sorry, I couldn't understand that.";

      setAnswer(aiAnswer);
      speak(aiAnswer);
    } catch (error) {
      console.error(error);

      const errorMessage =
        "Sorry, I couldn't connect to Visionmate right now.";

      setAnswer(errorMessage);
      speak(errorMessage);
    } finally {
      setThinking(false);
    }
  };

  // --------------------------------------------------
  // START LISTENING
  // --------------------------------------------------

  const startListening = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setAnswer(
        "Voice recognition is not supported in this browser. Please use Chrome or Edge."
      );
      return;
    }

    window.speechSynthesis.cancel();

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognitionRef.current = recognition;

    setTranscript("");
    setAnswer("");
    setListening(true);

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      const currentText = finalText || interimText;

      setTranscript(currentText);

      if (finalText.trim()) {
        setListening(false);
        processCommand(finalText.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Voice error:", event);

      setListening(false);

      let message = "Voice recognition failed.";

      if (event.error === "not-allowed") {
        message = "Please allow microphone permission in your browser.";
      }

      if (event.error === "no-speech") {
        message = "I didn't hear anything. Please try again.";
      }

      setAnswer(message);
    };

    recognition.onend = () => {
      setListening(false);
    };

    try {
      recognition.start();
    } catch (error) {
      console.error(error);
      setListening(false);
    }
  };

  // --------------------------------------------------
  // STOP
  // --------------------------------------------------

  const stopEverything = () => {
    recognitionRef.current?.stop();

    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel();
    }

    setListening(false);
    setSpeaking(false);
    setThinking(false);
  };

  if (!mounted) return null;

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <>
      {/* Floating microphone */}
      <button
        onClick={() => {
          if (listening || speaking || thinking) {
            stopEverything();
            return;
          }

          setOpen(true);
          startListening();
        }}
        aria-label="Voice Assistant"
        className={`
          fixed bottom-6 right-6 z-[9999]
          flex h-16 w-16 items-center justify-center
          rounded-full shadow-2xl
          transition-all duration-200
          ${
            listening
              ? "scale-110 bg-red-500"
              : "bg-emerald-600 hover:scale-105 hover:bg-emerald-700"
          }
        `}
      >
        <span className="text-3xl">{listening ? "🔴" : "🎙️"}</span>
      </button>

      {/* Voice panel */}
      {open && (
        <div className="fixed bottom-28 right-6 z-[9998] w-[340px] max-w-[calc(100vw-32px)] rounded-3xl border border-line bg-white p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold">
                Visionmate Voice
              </h3>

              <p className="text-xs text-slate-500">
                Speak in Hindi, English or Hinglish
              </p>
            </div>

            <button
              onClick={() => {
                stopEverything();
                setOpen(false);
              }}
              className="rounded-full px-3 py-1 text-lg hover:bg-slate-100"
            >
              ×
            </button>
          </div>

          <div className="mt-5 rounded-2xl bg-[#F5F8F7] p-4">
            {listening && (
              <div className="text-center">
                <div className="text-4xl">🎙️</div>

                <p className="mt-2 font-semibold text-emerald-700">
                  Listening...
                </p>

                <p className="mt-1 text-xs text-slate-500">Speak now</p>
              </div>
            )}

            {thinking && (
              <div className="text-center">
                <div className="text-4xl">🤖</div>

                <p className="mt-2 font-semibold">Understanding...</p>
              </div>
            )}

            {speaking && (
              <div className="text-center">
                <div className="text-4xl">🔊</div>

                <p className="mt-2 font-semibold text-emerald-700">
                  Visionmate is speaking...
                </p>
              </div>
            )}

            {!listening &&
              !thinking &&
              !speaking &&
              !transcript &&
              !answer && (
                <div className="text-center">
                  <div className="text-4xl">👋</div>

                  <p className="mt-2 font-semibold">How can I help?</p>
                </div>
              )}

            {transcript && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-500">YOU SAID</p>

                <p className="mt-1 text-sm">&quot;{transcript}&quot;</p>
              </div>
            )}

            {answer && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500">
                  VISIONMATE
                </p>

                <p className="mt-1 text-sm leading-6">{answer}</p>
              </div>
            )}
          </div>

          {/* Replay */}
          {answer && !speaking && (
            <button
              onClick={() => speak(answer)}
              className="mt-3 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold"
            >
              🔊 Replay
            </button>
          )}

          {/* Stop */}
          {(listening || thinking || speaking) && (
            <button
              onClick={stopEverything}
              className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            >
              Stop
            </button>
          )}

          {/* Examples */}
          {!listening && !thinking && !answer && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500">
                TRY SAYING
              </p>

              <div className="mt-2 space-y-2 text-xs text-slate-600">
                <p>&quot;Meri medicines dikhao&quot;</p>
                <p>&quot;Prescription page par le jao&quot;</p>
                <p>&quot;History kholo&quot;</p>
                <p>&quot;Profile page par le jao&quot;</p>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}