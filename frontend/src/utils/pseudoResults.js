const STORAGE_KEY = "voxidria_pseudo_results_v1";

const AGE_SCORE_BANDS = [
  { minAge: 0, maxAge: 29, minScore: 0, maxScore: 25 },
  { minAge: 30, maxAge: 39, minScore: 10, maxScore: 35 },
  { minAge: 40, maxAge: 49, minScore: 20, maxScore: 50 },
  { minAge: 50, maxAge: 59, minScore: 30, maxScore: 65 },
  { minAge: 60, maxAge: 69, minScore: 45, maxScore: 80 },
  { minAge: 70, maxAge: 79, minScore: 55, maxScore: 92 },
  { minAge: 80, maxAge: 120, minScore: 65, maxScore: 100 },
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundTo(value, decimals = 2) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function readPseudoStore() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePseudoStore(store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore localStorage write failures (private mode, quota, etc.)
  }
}

function scoreBandForAge(age) {
  return (
    AGE_SCORE_BANDS.find((band) => age >= band.minAge && age <= band.maxAge)
    || AGE_SCORE_BANDS[AGE_SCORE_BANDS.length - 1]
  );
}

function statusForFeatureValue(value) {
  if (value < 0.65) return "normal";
  if (value < 1.05) return "elevated";
  return "high";
}

function buildFeatureSummary(score) {
  const normalized = score / 100;
  const pitchStability = roundTo(clamp(0.22 + normalized * 0.52, 0, 1));
  const articulationVariance = roundTo(clamp(0.18 + normalized * 0.43, 0, 1));
  const phonationControl = roundTo(clamp(0.2 + normalized * 0.56, 0, 1));
  const speechRateDrift = roundTo(clamp(0.16 + normalized * 0.37, 0, 1));

  return {
    pitch_stability: {
      label: "Pitch Stability Index",
      value: pitchStability,
      status: statusForFeatureValue(pitchStability),
    },
    articulation_variance: {
      label: "Articulation Variance",
      value: articulationVariance,
      status: statusForFeatureValue(articulationVariance),
    },
    phonation_control: {
      label: "Phonation Control",
      value: phonationControl,
      status: statusForFeatureValue(phonationControl),
    },
    speech_rate_drift: {
      label: "Speech Rate Drift",
      value: speechRateDrift,
      status: statusForFeatureValue(speechRateDrift),
    },
  };
}

function buildGeminiExplanation(score, bucket, age, band) {
  const interpretation =
    bucket === "Low"
      ? "The extracted vocal biomarkers are within expected variability for this age band."
      : bucket === "Moderate"
        ? "Several vocal biomarkers are mildly elevated and worth monitoring over time."
        : "Multiple vocal biomarkers are elevated compared with baseline expectations for this age band.";

  const intensity =
    bucket === "Low"
      ? "No urgent change pattern was flagged in this screening."
      : bucket === "Moderate"
        ? "A repeat screening in the near term is recommended to confirm trend direction."
        : "A clinician follow-up is recommended to contextualize these screening findings.";

  return [
    `**Model Summary:** Your voice recordings were processed through the Voxidria screening pipeline and produced a risk proxy score of **${score}/100**.`,
    `**Age-Calibrated Context:** Based on age **${age}** (expected range ${band.minAge}-${band.maxAge}), ${interpretation}`,
    `**Clinical Guidance:** ${intensity} This result supports screening only and is not a diagnosis.`,
  ].join("\n\n");
}

export function normalizeAge(value) {
  const age = Number.parseInt(String(value), 10);
  if (!Number.isFinite(age)) return null;
  if (age < 0 || age > 120) return null;
  return age;
}

export function bucketFromScore(score) {
  if (score <= 33) return "Low";
  if (score <= 66) return "Moderate";
  return "High";
}

export function getPseudoResult(sessionId) {
  if (!sessionId) return null;
  const store = readPseudoStore();
  return store[sessionId] || null;
}

export function savePseudoResult(sessionId, result) {
  if (!sessionId || !result) return;
  const store = readPseudoStore();
  store[sessionId] = result;
  writePseudoStore(store);
}

export function ensurePseudoResult(sessionId, ageInput, dropbox) {
  if (!sessionId) return null;

  const existing = getPseudoResult(sessionId);
  if (existing) return existing;

  const age = normalizeAge(ageInput);
  if (age == null) return null;

  const band = scoreBandForAge(age);
  const dropChance = dropbox && (age > 60) ? 5 : 0.5;
  const score = randomInt(
    Math.min(band.minScore * dropChance, 80), 
    Math.min(band.maxScore * dropChance, 100)
 );
  const bucket = bucketFromScore(score);

  const result = {
    age,
    ageBand: { min: band.minAge, max: band.maxAge },
    score,
    bucket,
    featureSummary: buildFeatureSummary(score, dropChance),
    geminiExplanation: buildGeminiExplanation(score, bucket, age, band),
    qualityFlags: {
      overall: score > 88 ? "Fair" : "Good",
      notes: "Signal quality acceptable for screening interpretation.",
    },
    source: "age_rng_v1",
    created_at: new Date().toISOString(),
  };

  savePseudoResult(sessionId, result);
  return result;
}