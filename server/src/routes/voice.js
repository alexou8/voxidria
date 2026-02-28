const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { checkJwt } = require("../middleware/auth");
const { analyzeVoiceRecording } = require("../services/speechAnalysis");
const { explainResults } = require("../services/gemini");
const config = require("../config/env");

const router = express.Router();

// Ensure uploads directory exists
if (!fs.existsSync(config.uploadsDir)) {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: config.uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".webm";
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "audio/webm",
      "audio/wav",
      "audio/mpeg",
      "audio/ogg",
      "audio/mp4",
      "audio/x-wav",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`));
    }
  },
});

// POST /api/voice/analyze — upload a voice recording and get results
router.post("/analyze", checkJwt, upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file provided" });
  }

  try {
    const analysis = await analyzeVoiceRecording(req.file.path);
    const explanation = await explainResults(analysis.riskScore, analysis.features);

    res.json({
      id: path.basename(req.file.filename, path.extname(req.file.filename)),
      riskScore: analysis.riskScore,
      features: analysis.features,
      explanation,
      modelVersion: analysis.modelVersion,
      analyzedAt: analysis.analyzedAt,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({ error: "Failed to analyze recording" });
  }
});

// GET /api/voice/tasks — return the list of voice tasks the user should perform
router.get("/tasks", checkJwt, (_req, res) => {
  res.json({
    tasks: [
      {
        id: "sustained-vowel",
        title: "Sustained Vowel",
        instruction: 'Say "Ahhh" for as long and as steadily as you can.',
        durationSeconds: 10,
      },
      {
        id: "sentence-reading",
        title: "Sentence Reading",
        instruction:
          'Read the following sentence aloud: "The quick brown fox jumps over the lazy dog near the riverbank."',
        durationSeconds: 15,
      },
      {
        id: "free-speech",
        title: "Free Speech",
        instruction:
          "Describe what you did yesterday in a few sentences. Speak naturally.",
        durationSeconds: 30,
      },
    ],
  });
});

module.exports = router;
