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

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export default function GlobalVoiceAssistant() {
  const router = useRouter();
  const pathname = usePathname();

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);

  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");

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

  const navigate = (
    path: string,
    message: string
  ) => {
    setAnswer(message);

    speak(message);

    setTimeout(() => {
      router.push(path);
    }, 1200);
  };

  // --------------------------------------------------
  // COMMAND ROUTER
  // --------------------------------------------------

  const processCommand = async (rawText: string) => {
    const text = rawText.toLowerCase().trim();

    if (!text) return;

    setThinking(true);
    setAnswer("");

    // -----------------------------------------------
    // DASHBOARD
    // -----------------------------------------------

    if (
      text.includes("dashboard") ||
      text.includes("home page") ||
      text.includes("home par") ||
      text.includes("dashboard par") ||
      text.includes("dashboard pe") ||
      text.includes("होम") ||
      text.includes("डैशबोर्ड")
    ) {
      setThinking(false);

      navigate(
        "/dashboard",
        "Okay, I'm taking you to the dashboard."
      );

      return;
    }

    // -----------------------------------------------
    // MY MEDICINES
    // -----------------------------------------------

    if (
      text.includes("my medicines") ||
      text.includes("my medicine") ||
      text.includes("meri medicines") ||
      text.includes("meri medicine") ||
      text.includes("medicine section") ||
      text.includes("medicines section") ||
      text.includes("medicines dikhao") ||
      text.includes("medicine dikhao") ||
      text.includes("मेरी मेडिसिन") ||
      text.includes("मेरी दवाइयां") ||
      text.includes("मेरी दवाइयाँ") ||
      text.includes("दवाइयां दिखाओ") ||
      text.includes("दवाइयाँ दिखाओ")
    ) {
      setThinking(false);

      navigate(
        "/medicines",
        "Sure, I'm opening your medicines section."
      );

      return;
    }

    // -----------------------------------------------
    // PRESCRIPTION SCANNER
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
    // PRESCRIPTION HISTORY
    // -----------------------------------------------

    if (
      text.includes("prescriptions") ||
      text.includes("prescription history") ||
      text.includes("meri prescriptions") ||
      text.includes("prescription dikhao") ||
      text.includes("प्रिस्क्रिप्शन दिखाओ")
    ) {
      setThinking(false);

      navigate(
        "/prescriptions",
        "Sure, I'm opening your prescriptions."
      );

      return;
    }

    // -----------------------------------------------
    // SAFETY CENTER
    // -----------------------------------------------

    if (
      text.includes("safety center") ||
      text.includes("safety") ||
      text.includes("safety section") ||
      text.includes("safety kholo") ||
      text.includes("सेफ्टी सेंटर") ||
      text.includes("सुरक्षा")
    ) {
      setThinking(false);

      navigate(
        "/safety",
        "Okay, I'm opening the Safety Center."
      );

      return;
    }

    // -----------------------------------------------
    // HISTORY
    // -----------------------------------------------

    if (
      text.includes("history") ||
      text.includes("my history") ||
      text.includes("meri history") ||
      text.includes("history dikhao") ||
      text.includes("हिस्ट्री दिखाओ")
    ) {
      setThinking(false);

      navigate(
        "/history",
        "Sure, I'm opening your history."
      );

      return;
    }

    // -----------------------------------------------
    // ASK VISIONMATE
    // -----------------------------------------------

    if (
      text.includes("ask visionmate") ||
      text.includes("ai chat") ||
      text.includes("chat with ai") ||
      text.includes("ai se baat")
    ) {
      setThinking(false);

      navigate(
        "/ask",
        "Okay, I'm opening Ask Visionmate."
      );

      return;
    }

    // -----------------------------------------------
    // BACK
    // -----------------------------------------------

    if (
      text === "go back" ||
      text === "back" ||
      text.includes("peeche jao") ||
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
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

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

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
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
        message =
          "Please allow microphone permission in your browser.";
      }

      if (event.error === "no-speech") {
        message =
          "I didn't hear anything. Please try again.";
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

  // --------------------------------------------------
  // CLEANUP
  // --------------------------------------------------

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();

      if (typeof window !== "undefined") {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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
        <span className="text-3xl">
          {listening ? "🔴" : "🎙️"}
        </span>
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

                <p className="mt-1 text-xs text-slate-500">
                  Speak now
                </p>
              </div>
            )}

            {thinking && (
              <div className="text-center">
                <div className="text-4xl">🤖</div>

                <p className="mt-2 font-semibold">
                  Understanding...
                </p>
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

                  <p className="mt-2 font-semibold">
                    How can I help?
                  </p>
                </div>
              )}

            {transcript && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-500">
                  YOU SAID
                </p>

                <p className="mt-1 text-sm">
                  "{transcript}"
                </p>
              </div>
            )}

            {answer && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500">
                  VISIONMATE
                </p>

                <p className="mt-1 text-sm leading-6">
                  {answer}
                </p>
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
                <p>• "Meri medicines dikhao"</p>
                <p>• "Prescription scan karo"</p>
                <p>• "Safety center kholo"</p>
                <p>• "Dashboard par le jao"</p>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}