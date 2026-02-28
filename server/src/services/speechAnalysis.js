const fs = require("fs");
const path = require("path");

/**
 * Analyzes a voice recording and returns a Parkinson's risk score (0-100).
 *
 * In production this would call a speech-based ML model (e.g. a trained
 * classifier on vocal biomarkers like jitter, shimmer, HNR, and MFCC
 * features). Here we use a deterministic simulation based on audio file
 * properties so results are consistent for testing.
 */
async function analyzeVoiceRecording(filePath) {
  const stats = fs.statSync(filePath);
  const fileSizeKB = stats.size / 1024;

  // Derive a deterministic score from the file size so the same recording
  // always produces the same result.  Real implementation would extract
  // acoustic features and run them through a trained model.
  const seed = fileSizeKB * 7.3 + 13;
  const riskScore = Math.round(((Math.sin(seed) + 1) / 2) * 100);

  // Simulated feature extraction results
  const features = {
    jitter: +(0.002 + (Math.sin(seed * 1.1) + 1) * 0.008).toFixed(4),
    shimmer: +(0.02 + (Math.sin(seed * 1.3) + 1) * 0.06).toFixed(4),
    hnr: +(15 + (Math.sin(seed * 1.5) + 1) * 8).toFixed(2),
    mfccVariance: +(0.5 + (Math.sin(seed * 1.7) + 1) * 2).toFixed(3),
  };

  return {
    riskScore: Math.min(100, Math.max(0, riskScore)),
    features,
    modelVersion: "v1.0.0-simulation",
    analyzedAt: new Date().toISOString(),
  };
}

module.exports = { analyzeVoiceRecording };
