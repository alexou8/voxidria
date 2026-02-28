/**
 * Gemini "Reading Task" Analysis Module
 *
 * Compares the user's speech transcript against the original reading passage
 * to identify speech patterns associated with Parkinson's disease screening:
 *   - Missed/added/substituted words (alignment errors)
 *   - Hesitation markers, repetitions, and long pauses (fluency markers)
 *   - Summary metrics (word error rate estimate, coverage ratio)
 *
 * IMPORTANT DISCLAIMER:
 *   This analysis is a screening aid ONLY. It does not constitute a medical
 *   diagnosis. Results must not be presented as diagnostic conclusions.
 *
 * Gemini is used for its natural language comparison and labeling capability.
 * We set low temperature for deterministic, structured output.
 */

export interface TranscriptWord {
  word: string;
  start_ms: number;
  end_ms: number;
}

export interface ReadingAnalysisInput {
  original_text: string;
  transcript_text: string;
  transcript_words?: TranscriptWord[];   // optional word-level timestamps
  silence_threshold_ms?: number;         // default 700ms — pauses longer than this are flagged
}

export interface ReadingAnalysisOutput {
  alignment: {
    missing_phrases: string[];                              // words/phrases in original but not said
    extra_phrases: string[];                                // words/phrases said but not in original
    substitutions: Array<{ expected: string; said: string }>; // word-level swaps
  };
  fluency: {
    hesitation_markers: Array<{ token: string; count: number }>; // "um", "uh", etc.
    repetitions: Array<{ phrase: string; count: number }>;        // "the the", etc.
    long_pauses: Array<{ start_ms: number; end_ms: number; duration_ms: number }>; // only if timestamps provided
  };
  metrics: {
    word_error_rate_estimate: number; // 0..1 (approximate, not exact WER)
    coverage_ratio: number;           // fraction of original passage covered (0..1)
  };
  summary: string[]; // 3–5 plain-language bullet points for the patient
}

/**
 * Run the reading task analysis using Gemini.
 *
 * The GEMINI_API_KEY is read from the server-side environment — it must never
 * be exposed to the frontend.
 */
export async function analyzeReading(
  input: ReadingAnalysisInput
): Promise<ReadingAnalysisOutput> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is not configured");

  // Allow model to be configured; default to a capable model with long context
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-1.5-pro";
  const silenceThreshold = input.silence_threshold_ms ?? 700;

  // Build optional word-timestamps section
  const wordTimestampsSection = input.transcript_words?.length
    ? `\nWord-level timestamps (JSON array):\n${JSON.stringify(input.transcript_words, null, 2)}\nSilence threshold: ${silenceThreshold}ms — flag gaps between words longer than this as long_pauses.\n`
    : "\nNo word timestamps provided. Return an empty array for long_pauses.\n";

  const prompt = `You are a clinical speech analysis engine for a Parkinson's disease screening tool.
Your task is to compare a user's spoken transcript against the original passage and identify speech irregularities.

IMPORTANT: Return ONLY a valid JSON object. No markdown, no code fences, no explanation text.

ORIGINAL PASSAGE:
"""
${input.original_text}
"""

USER TRANSCRIPT (what the user actually said):
"""
${input.transcript_text}
"""
${wordTimestampsSection}
Analyze and return this exact JSON structure:
{
  "alignment": {
    "missing_phrases": ["phrase the user skipped"],
    "extra_phrases": ["phrase the user added that wasn't in original"],
    "substitutions": [{"expected": "original word", "said": "what user said"}]
  },
  "fluency": {
    "hesitation_markers": [{"token": "um", "count": 3}],
    "repetitions": [{"phrase": "and and", "count": 1}],
    "long_pauses": [{"start_ms": 1200, "end_ms": 2100, "duration_ms": 900}]
  },
  "metrics": {
    "word_error_rate_estimate": 0.12,
    "coverage_ratio": 0.88
  },
  "summary": [
    "The user read most of the passage accurately.",
    "Two words were substituted with similar-sounding alternatives.",
    "One hesitation marker ('um') was noted.",
    "Speech pace appeared slightly slower than typical."
  ]
}

Analysis rules:
- Normalize case and strip punctuation before comparing words.
- missing_phrases: contiguous groups of words from the original that were entirely skipped.
- extra_phrases: contiguous groups of words said by the user that don't appear in the original (excluding hesitation markers).
- substitutions: individual words replaced with a different word (not just skipped).
- Hesitation markers include: um, uh, ah, er, hmm, uh-huh, and filler uses of "like", "you know", "so".
- Repetitions: immediately repeated words or short phrases (e.g., "the the", "and I and I").
- word_error_rate_estimate: (insertions + deletions + substitutions) / total_words_in_original, clamped to [0, 1].
- coverage_ratio: number_of_original_words_read_correctly / total_words_in_original, range [0, 1].
- summary: 3–5 short, plain English bullet points a patient can understand. Do not use medical jargon.
- Do NOT claim diagnosis or imply medical conclusions.

Return ONLY the JSON object.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,          // Low temperature for consistent, structured output
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawContent) {
    throw new Error("Gemini returned an empty response");
  }

  // Parse the JSON; try to extract from surrounding text as a fallback
  try {
    return JSON.parse(rawContent) as ReadingAnalysisOutput;
  } catch {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ReadingAnalysisOutput;
    }
    throw new Error(
      `Gemini returned unparseable content: ${rawContent.substring(0, 300)}`
    );
  }
}
