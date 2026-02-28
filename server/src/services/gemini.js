const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("../config/env");

let genAI = null;

function getClient() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  }
  return genAI;
}

/**
 * Uses Gemini to generate a plain-language explanation of the Parkinson's
 * risk assessment results and recommended next steps.
 */
async function explainResults(riskScore, features) {
  if (!config.gemini.apiKey) {
    return getFallbackExplanation(riskScore, features);
  }

  try {
    const model = getClient().getGenerativeModel({
      model: "gemini-2.0-flash",
    });

    const prompt = `You are a helpful medical information assistant for a voice-based Parkinson's screening tool called Voxidria. A user just completed a voice recording task and received their results.

IMPORTANT: You are NOT a doctor. Always remind the user that this is a screening tool, not a diagnosis.

The analysis results are:
- Risk Score: ${riskScore}/100 (0 = very low risk, 100 = very high risk)
- Vocal Jitter: ${features.jitter} (normal range: 0.001-0.007)
- Vocal Shimmer: ${features.shimmer} (normal range: 0.01-0.05)
- Harmonics-to-Noise Ratio (HNR): ${features.hnr} dB (normal: >20 dB)
- MFCC Variance: ${features.mfccVariance}

Please provide:
1. A clear, empathetic explanation of the risk score in plain language (2-3 sentences)
2. What the vocal features suggest (2-3 sentences, avoid overly technical language)
3. Recommended next steps based on the risk level (2-4 bullet points)

Keep the tone reassuring but honest. Use simple language that anyone can understand.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini API error:", error.message);
    return getFallbackExplanation(riskScore, features);
  }
}

function getFallbackExplanation(riskScore, features) {
  let level, description, steps;

  if (riskScore <= 25) {
    level = "low";
    description =
      "Your voice analysis shows a low risk score. The vocal characteristics analyzed fall within typical ranges, which is a positive sign.";
    steps = [
      "Continue monitoring your vocal health periodically",
      "Consider repeating this screening in 6-12 months",
      "Maintain a healthy lifestyle with regular exercise",
    ];
  } else if (riskScore <= 50) {
    level = "mild";
    description =
      "Your voice analysis shows a mild risk score. Some vocal characteristics are slightly outside typical ranges, though this can be influenced by many factors including fatigue, stress, or respiratory conditions.";
    steps = [
      "Consider discussing these results with your primary care physician",
      "Repeat this screening in 3-6 months to track any changes",
      "Note any changes in your voice, movement, or sleep patterns",
      "Stay physically active, as exercise supports neurological health",
    ];
  } else if (riskScore <= 75) {
    level = "moderate";
    description =
      "Your voice analysis shows a moderate risk score. Several vocal characteristics differ from typical ranges. While this does not constitute a diagnosis, it may warrant professional evaluation.";
    steps = [
      "Schedule an appointment with your primary care physician to discuss these results",
      "Consider a referral to a neurologist for a comprehensive evaluation",
      "Repeat this screening in 1-3 months to monitor any trends",
      "Keep a journal of any other symptoms you may notice",
    ];
  } else {
    level = "elevated";
    description =
      "Your voice analysis shows an elevated risk score. Multiple vocal characteristics are outside typical ranges. This is a screening result, not a diagnosis, but professional follow-up is recommended.";
    steps = [
      "Schedule an appointment with a neurologist for a comprehensive evaluation as soon as possible",
      "Share these screening results with your healthcare provider",
      "Repeat this screening in 2-4 weeks to confirm the findings",
      "Remember that many conditions can affect vocal characteristics — a specialist can provide proper assessment",
    ];
  }

  return `## Your Risk Assessment: ${level.charAt(0).toUpperCase() + level.slice(1)} (${riskScore}/100)

${description}

**What the vocal features suggest:** Your voice was analyzed for several characteristics including vocal steadiness (jitter: ${features.jitter}), volume consistency (shimmer: ${features.shimmer}), and voice clarity (HNR: ${features.hnr} dB). These measurements help identify subtle changes that may be associated with neurological conditions.

**Recommended next steps:**
${steps.map((s) => `- ${s}`).join("\n")}

> **Important disclaimer:** This is a screening tool, not a medical diagnosis. Only a qualified healthcare professional can diagnose Parkinson's disease or any other medical condition. Many factors can influence voice characteristics, and an elevated score does not necessarily indicate the presence of disease.`;
}

module.exports = { explainResults };
