import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function safeRows(rows: unknown) {
  return Array.isArray(rows) ? rows.slice(0, 100) : [];
}

function extractGeminiText(data: any): string {
  const candidates = Array.isArray(data?.candidates)
    ? data.candidates
    : [];

  const parts: string[] = [];

  for (const candidate of candidates) {
    for (const part of candidate?.content?.parts ?? []) {
      if (
        typeof part?.text === "string" &&
        part.text.trim()
      ) {
        parts.push(part.text.trim());
      }
    }
  }

  return parts.join("\n").trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(status: number) {
  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function getGeminiErrorMessage(data: any, fallback: string) {
  return (
    data?.error?.message ||
    data?.error?.status ||
    fallback
  );
}

export async function POST(request: Request) {
  try {
    // -----------------------------------------
    // AUTHENTICATION
    // -----------------------------------------

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Please log in first.",
        },
        { status: 401 }
      );
    }

    // -----------------------------------------
    // REQUEST
    // -----------------------------------------

    const body = await request.json();

    const question = String(
      body?.question ?? ""
    ).trim();

    const incomingMessages = Array.isArray(
      body?.messages
    )
      ? (body.messages as ChatMessage[]).slice(-12)
      : [];

    if (!question) {
      return NextResponse.json(
        {
          error: "Please enter a question.",
        },
        { status: 400 }
      );
    }

    if (question.length > 4000) {
      return NextResponse.json(
        {
          error: "Question is too long.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // USER DASHBOARD DATA
    // -----------------------------------------

    const [
      profileResult,
      medicinesResult,
      prescriptionsResult,
      prescriptionMedicinesResult,
      historyResult,
      safetyResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle(),

      supabase
        .from("user_medicines")
        .select("*")
        .eq("user_id", user.id)
        .limit(100),

      supabase
        .from("prescriptions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(50),

      supabase
        .from("prescription_medicines")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(100),

      supabase
        .from("medication_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(100),

      supabase
        .from("safety_alerts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(100),
    ]);

    const context = {
      profile: profileResult.data ?? null,
      medicines: safeRows(
        medicinesResult.data
      ),
      prescriptions: safeRows(
        prescriptionsResult.data
      ),
      prescription_medicines: safeRows(
        prescriptionMedicinesResult.data
      ),
      medication_history: safeRows(
        historyResult.data
      ),
      safety_alerts: safeRows(
        safetyResult.data
      ),
    };

    // -----------------------------------------
    // GEMINI API KEY
    // -----------------------------------------

    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "AI is not configured. Add GEMINI_API_KEY to .env.local and restart the server.",
        },
        { status: 503 }
      );
    }

    // -----------------------------------------
    // MODELS
    // -----------------------------------------

    const primaryModel =
      process.env.GEMINI_MODEL ||
      "gemini-3.8-flash";

    const fallbackModel =
      process.env.GEMINI_FALLBACK_MODEL ||
      "gemini-3.5-flash-lite";

    // Both are currently listed as stable Gemini API
    // models by Google.
    console.log(
      "VisionMate Gemini models:",
      {
        primaryModel,
        fallbackModel,
      }
    );

    // -----------------------------------------
    // SYSTEM INSTRUCTION
    // -----------------------------------------

    const systemInstruction = `
You are Visionmate AI, the assistant inside a private medication-management dashboard.

You can answer normal general questions.

You also have access to the authenticated user's private dashboard data below.

DATA RULES:
- Dashboard data belongs only to the current authenticated user.
- Never claim a record exists unless it appears below.
- Never invent medicines, prescriptions, dates, safety alerts, statistics, or patient details.
- If requested dashboard data is absent, say it is not available.
- Treat OCR-derived prescription information as potentially uncertain.

MEDICAL SAFETY:
- Provide informational assistance, not diagnosis or prescribing.
- Do not tell the user to start, stop, or change a medicine or dose.
- For individualized dosing, diagnosis, overdose, severe symptoms, pregnancy-related medication decisions, or other high-risk medical questions, advise verification with a qualified healthcare professional or urgent/emergency care when appropriate.
- Do not turn uncertain OCR into a definite medical fact.
- Do not fabricate citations or sources.

GENERAL QUESTIONS:
- Answer normal non-medical questions directly.
- If current information is needed and no live web-search tool is available, clearly say that the answer may not be current.

LANGUAGE:
- Answer in the language used by the user.
- English and Hindi are supported.
- Hinglish is also supported.

USER DASHBOARD DATA:
${JSON.stringify(context, null, 2)}
`;

    // -----------------------------------------
    // CHAT HISTORY
    // -----------------------------------------

    const history = incomingMessages
      .filter(
        (message) =>
          message &&
          (message.role === "user" ||
            message.role === "assistant") &&
          typeof message.content === "string"
      )
      .map((message) => ({
        role:
          message.role === "assistant"
            ? "model"
            : "user",

        parts: [
          {
            text: message.content.slice(
              0,
              6000
            ),
          },
        ],
      }));

    const contents = [
      ...history,
      {
        role: "user",
        parts: [
          {
            text: question,
          },
        ],
      },
    ];

    // -----------------------------------------
    // GEMINI CALL
    // -----------------------------------------

    async function callGemini(model: string) {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model
        )}:generateContent`;

      let lastStatus = 0;
      let lastError: any = null;

      // Retry transient errors.
      for (
        let attempt = 0;
        attempt < 3;
        attempt++
      ) {
        try {
          const response = await fetch(url, {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "x-goog-api-key": apiKey,
            },

            body: JSON.stringify({
              /*
               * IMPORTANT:
               * Gemini REST API expects systemInstruction
               * using camelCase.
               */
              systemInstruction: {
                parts: [
                  {
                    text: systemInstruction,
                  },
                ],
              },

              contents,

              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 1200,
              },
            }),
          });

          const responseText =
            await response.text();

          let data: any = null;

          try {
            data = JSON.parse(
              responseText
            );
          } catch {
            data = null;
          }

          lastStatus = response.status;

          // Successful response
          if (response.ok) {
            return {
              ok: true,
              status: response.status,
              data,
              error: null,
            };
          }

          const errorMessage =
            getGeminiErrorMessage(
              data,
              responseText
            );

          lastError = {
            message: errorMessage,
            status: response.status,
            data,
          };

          console.error(
            `Gemini ${model} attempt ${
              attempt + 1
            } failed:`,
            {
              status: response.status,
              message: errorMessage,
            }
          );

          // Don't retry 400 / 401 / 403 etc.
          if (
            !isRetryable(
              response.status
            )
          ) {
            break;
          }

          // Exponential backoff:
          // 1.5 sec → 3 sec → 6 sec
          if (attempt < 2) {
            await sleep(
              1500 *
                Math.pow(
                  2,
                  attempt
                )
            );
          }
        } catch (error: any) {
          lastError = {
            message:
              error?.message ||
              "Network error",
          };

          console.error(
            `Gemini network error (${model}):`,
            error
          );

          if (attempt < 2) {
            await sleep(
              1500 *
                Math.pow(
                  2,
                  attempt
                )
            );
          }
        }
      }

      return {
        ok: false,
        status: lastStatus,
        data: null,
        error: lastError,
      };
    }

    // -----------------------------------------
    // PRIMARY MODEL
    // -----------------------------------------

    let usedModel = primaryModel;

    let result =
      await callGemini(
        primaryModel
      );

    // -----------------------------------------
    // FALLBACK MODEL
    // -----------------------------------------

    if (
      !result.ok &&
      fallbackModel !== primaryModel &&
      isRetryable(result.status)
    ) {
      console.warn(
        `Trying fallback Gemini model: ${fallbackModel}`
      );

      usedModel =
        fallbackModel;

      result =
        await callGemini(
          fallbackModel
        );
    }

    // -----------------------------------------
    // FINAL ERROR
    // -----------------------------------------

    if (
      !result.ok ||
      !result.data
    ) {
      const status =
        result.status || 500;

      const actualError =
        result.error?.message ||
        "Unknown Gemini error";

      console.error(
        "VisionMate Gemini final error:",
        {
          model: usedModel,
          status,
          error: actualError,
        }
      );

      // Invalid API key
      if (
        status === 401 ||
        status === 403
      ) {
        return NextResponse.json(
          {
            error:
              "Gemini API authentication failed. Check your GEMINI_API_KEY.",
          },
          { status: 502 }
        );
      }

      // Rate limit
      if (status === 429) {
        return NextResponse.json(
          {
            error:
              "Gemini API rate limit reached. Please wait a moment and try again.",
          },
          { status: 429 }
        );
      }

      // Temporary Gemini problem
      if (
        status >= 500 ||
        status === 408
      ) {
        return NextResponse.json(
          {
            error:
              "Gemini is temporarily unavailable. Please try again in a moment.",
          },
          { status: 503 }
        );
      }

      // Other error
      return NextResponse.json(
        {
          error:
            `Gemini request failed: ${actualError}`,
        },
        { status: 502 }
      );
    }

    // -----------------------------------------
    // EXTRACT ANSWER
    // -----------------------------------------

    const answer =
      extractGeminiText(
        result.data
      );

    if (!answer) {
      console.error(
        "Gemini returned no text:",
        JSON.stringify(
          result.data
        )
      );

      return NextResponse.json(
        {
          error:
            "Gemini returned an empty response. Please try again.",
        },
        { status: 502 }
      );
    }

    // -----------------------------------------
    // SAVE CONVERSATION
    // -----------------------------------------

    try {
      const conversation =
        await supabase
          .from("ai_conversations")
          .insert({
            user_id: user.id,
            title:
              question.slice(
                0,
                80
              ),
          })
          .select("id")
          .single();

      if (
        conversation.data?.id
      ) {
        await supabase
          .from("ai_messages")
          .insert([
            {
              conversation_id:
                conversation.data
                  .id,
              user_id:
                user.id,
              role: "user",
              content:
                question,
            },

            {
              conversation_id:
                conversation.data
                  .id,
              user_id:
                user.id,
              role: "assistant",
              content:
                answer,
            },
          ]);
      }
    } catch (saveError) {
      // Conversation saving should never
      // break the AI response.
      console.warn(
        "Could not save AI conversation:",
        saveError
      );
    }

    // -----------------------------------------
    // RESPONSE
    // -----------------------------------------

    return NextResponse.json({
      answer,
      usedDashboardData: true,
      model: usedModel,
    });
  } catch (error: any) {
    console.error(
      "Ask Visionmate error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "We couldn't complete the AI request. Please try again.",
      },
      { status: 500 }
    );
  }
}