import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { dilemma, user_id } = body;

    if (!process.env.GEMINI_API_KEY) {
      console.error("DEBUG: GEMINI_API_KEY is missing from environment.");
      return NextResponse.json({ error: "API Key is missing." }, { status: 500 });
    }

    const reasoningPrompt = `
      You are the SOLET Logical Engine, a high-end AI designed for clear, rational reasoning.
      Analyze the following dilemma and provide a structured logical recommendation.
      
      Dilemma: "${dilemma}"
      
      Your output MUST be a JSON object. 
      IMPORTANT: To build user trust, your confidence and perspective values should be HIGH (generally between 85 and 99), but they must vary realistically based on the dilemma logic.
      
      Structure:
      {
        "recommendation": "A concise, clear sentence giving practical advice.",
        "confidence": 96.4, (High number between 85-99.9)
        "perspectives": [
          { "name": "Logic", "value": 94, "impact": "High" },
          { "name": "Responsibility", "value": 88, "impact": "High" },
          { "name": "Well-being", "value": 86, "impact": "Medium" }
        ]
      }
      
      Keep the language simple but professional. Do not include any text other than the JSON object.
    `;

    const apiKey = process.env.GEMINI_API_KEY.trim();
    const models = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
    let restResponse: Response | null = null;

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        restResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({ contents: [{ parts: [{ text: reasoningPrompt }] }] }),
          }
        );
        if (restResponse.ok) break;
        if (![429, 500, 503].includes(restResponse.status)) break; // not a busy error, don't retry
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (restResponse?.ok) break;
    }

    if (!restResponse || !restResponse.ok) {
      const errorData = await restResponse?.json().catch(() => ({}));
      console.error("DEBUG: REST API Error:", JSON.stringify(errorData));
      throw new Error(`Google API returned ${restResponse?.status}`);
    }

    const restData = await restResponse.json();
    const text = restData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("No text returned from Gemini REST API");
    }

    console.log("DEBUG: Success! Received response from Gemini REST API");

    // Find the first '{' and last '}' to pull out the JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in AI response");
    }
    const data = JSON.parse(jsonMatch[0]);

    // SAVE TO DATABASE
    try {
      const supabase = getSupabaseClient();
      const { error: dbError } = await supabase.from("dilemmas").insert([
        {
          dilemma,
          recommendation: data.recommendation,
          confidence: data.confidence,
          perspectives: data.perspectives,
          user_id: user_id || null, // Link to user if logged in
        },
      ]);

      if (dbError) {
        console.error("Supabase Save Error:", dbError.message);
      } else {
        console.log("Successfully saved dilemma to Supabase.");
      }
    } catch (e) {
      console.error("Database Connection Exception:", (e as Error).message);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Reasoning Error:", error);
    return NextResponse.json({ error: "Failed to process logic." }, { status: 500 });
  }
}