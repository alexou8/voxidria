import { useEffect, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import {
  createSession,
  getUploadUrl,
  uploadAudioToStorage,
  finalizeTask,
  READING_PASSAGE,
  synthesizeSpeech,
} from "../services/api";
import ResultsCard from "../components/ResultsCard";
import "./RecordPage.css";

const TASKS = [
  {
    type: "SUSTAINED_VOWEL",
    title: "Sustained Vowel",
    durationSeconds: 5,
    instruction: 'Take a deep breath and say "ahhh" for about 5 seconds, as steadily as you can.',
    icon: "🎵",
  },
  {
    type: "READING",
    title: "Reading Task",
    durationSeconds: 15,
    instruction: "Read the following passage aloud at your natural pace:",
    passage: READING_PASSAGE,
    icon: "📖",
  },
  {
    type: "DDK",
    title: "Rapid Syllables",
    durationSeconds: 10,
    instruction: 'Repeat "pa-ta-ka" as quickly and clearly as you can for about 10 seconds.',
    icon: "🔄",
  },
];

// Step identifiers for the flow
const STEPS = { CONSENT: "consent", TASK: "task", UPLOADING: "uploading", RESULTS: "results" };
const TASK_GUIDE_SECTION = {
  SUSTAINED_VOWEL: "AHHH_TEST",
  READING: "READING_TEST",
  DDK: "PA_TA_KA_TEST",
};
const TASK_GUIDE_LABEL = {
  SUSTAINED_VOWEL: 'Hear "ahhh" instructions',
  READING: "Hear reading instructions",
  DDK: 'Hear "pa-ta-ka" instructions',
};

export default function RecordPage() {
  const { getAccessTokenSilently } = useAuth0();
  const recorder = useVoiceRecorder();
  const guideAudioRef = useRef(null);
  const latestGuideRequestId = useRef(0);

  const [step, setStep] = useState(STEPS.CONSENT);
  const [selectedTask, setSelectedTask] = useState(TASKS[1]); // default: READING
  const [sessionId, setSessionId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [guideAudioUrl, setGuideAudioUrl] = useState("");
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideError, setGuideError] = useState(null);

  useEffect(() => {
    if (!guideAudioUrl || !guideAudioRef.current) return;
    guideAudioRef.current.currentTime = 0;
    guideAudioRef.current.play().catch(() => {
      // Some browsers require explicit user interaction for playback.
    });
  }, [guideAudioUrl]);

  useEffect(
    () => () => {
      if (guideAudioRef.current) {
        guideAudioRef.current.pause();
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      if (guideAudioUrl) {
        URL.revokeObjectURL(guideAudioUrl);
      }
    };
  }, [guideAudioUrl]);

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const resetGuide = () => {
    latestGuideRequestId.current += 1;
    if (guideAudioRef.current) {
      guideAudioRef.current.pause();
      guideAudioRef.current.currentTime = 0;
    }
    setGuideAudioUrl("");
    setGuideLoading(false);
    setGuideError(null);
  };

  const playMedicalAssistant = async (section) => {
    const requestId = latestGuideRequestId.current + 1;
    latestGuideRequestId.current = requestId;

    if (guideAudioRef.current) {
      guideAudioRef.current.pause();
      guideAudioRef.current.currentTime = 0;
    }

    setGuideError(null);
    setGuideLoading(true);

    try {
      const audioBlob = await synthesizeSpeech(
        "",
        "MEDICAL_ASSISTANT",
        getAccessTokenSilently,
        { section }
      );
      if (latestGuideRequestId.current !== requestId) return;
      setGuideAudioUrl(URL.createObjectURL(audioBlob));
    } catch (err) {
      if (latestGuideRequestId.current !== requestId) return;
      setGuideError(err.message || "Could not load medical assistant audio.");
    } finally {
      if (latestGuideRequestId.current === requestId) {
        setGuideLoading(false);
      }
    }
  };

  const handleConsent = async () => {
    setError(null);
    try {
      const deviceMeta = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        screenWidth: window.screen.width,
      };
      const data = await createSession("1.0", deviceMeta, getAccessTokenSilently);
      resetGuide();
      setSessionId(data.session_id);
      setTasks(data.tasks);
      setStep(STEPS.TASK);
    } catch (err) {
      console.error("Create session failed:", err);
      setError("Could not start session. Please try again.");
    }
  };

  const handleAnalyze = async () => {
    if (!recorder.audioBlob || !sessionId) return;
    setStep(STEPS.UPLOADING);
    setError(null);

    try {
      // 1. Get signed upload URL from backend
      const contentType = recorder.audioBlob.type || "audio/webm";
      const { signedUrl } = await getUploadUrl(
        sessionId,
        selectedTask.type,
        contentType,
        getAccessTokenSilently
      );

      // 2. Upload audio directly to Supabase Storage (no secrets sent to browser)
      await uploadAudioToStorage(signedUrl, recorder.audioBlob);


      const currentTask = tasks.find(
        (t) => t.task_type === selectedTask.type
      );

      // 3. Finalize task — backend runs Gemini reading analysis for READING tasks
      const finalized = await finalizeTask(
        currentTask.task_id,
        "",           // transcript: Web Speech API integration is a stretch goal
        getAccessTokenSilently
      );

      setResults({
        task_type: selectedTask.type,
        task_status: finalized.task_status,
        analysis_json: finalized.analysis_json,
        session_id: sessionId,
      });
      setStep(STEPS.RESULTS);
    } catch (err) {
      setError(err.message || "Analysis failed. Please try again.");
      setStep(STEPS.TASK);
    }
  };

  const handleReset = () => {
    resetGuide();
    recorder.reset();
    setResults(null);
    setError(null);
    setStep(STEPS.TASK);
  };

  const handleStartOver = () => {
    resetGuide();
    recorder.reset();
    setResults(null);
    setError(null);
    setSessionId(null);
    setStep(STEPS.CONSENT);
  };

  // --- Consent screen ---
  if (step === STEPS.CONSENT) {
    return (
      <div className="record-page">
        <div className="consent-card">
          <h1>Before You Begin</h1>
          <div className="consent-body">
            <p>
              Voxidria will record short voice samples and analyze them to
              estimate your speech risk profile. By proceeding, you agree to:
            </p>
            <ul>
              <li>Allow microphone access for recording</li>
              <li>Your audio being stored securely for analysis</li>
              <li>Receiving a screening score — <strong>not a medical diagnosis</strong></li>
            </ul>
            <div className="disclaimer-box">
              <strong>Medical Disclaimer:</strong> This tool does not diagnose
              Parkinson's disease or any other condition. If you are concerned
              about your health, please consult a qualified healthcare
              professional.
            </div>
            <div className="assistant-guide">
              <button
                className="btn btn-outline"
                onClick={() => playMedicalAssistant("CONSENT_OVERVIEW")}
                disabled={guideLoading}
              >
                {guideLoading ? "Loading assistant..." : "Hear Medical Assistant Overview"}
              </button>
              {guideAudioUrl && (
                <audio
                  ref={guideAudioRef}
                  className="audio-preview"
                  controls
                  src={guideAudioUrl}
                />
              )}
              {guideError && <p className="error-msg">{guideError}</p>}
            </div>
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button className="btn btn-primary btn-lg" onClick={handleConsent}>
            I Understand — Continue
          </button>
        </div>
      </div>
    );
  }

  // --- Uploading / analyzing screen ---
  if (step === STEPS.UPLOADING) {
    return (
      <div className="record-page">
        <div className="uploading-card">
          <div className="spinner" aria-label="Analyzing" />
          <h2>Analyzing your recording…</h2>
          <p className="text-muted">
            Uploading audio and running speech analysis. This may take a few seconds.
          </p>
        </div>
      </div>
    );
  }

  // --- Results screen ---
  if (step === STEPS.RESULTS && results) {
    return (
      <div className="record-page">
        <ResultsCard results={results} />
        <div className="results-actions">
          <button className="btn btn-primary" onClick={handleReset}>
            Record Another Task
          </button>
          <button className="btn btn-outline" onClick={handleStartOver}>
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  // --- Recording screen ---
  return (
    <div className="record-page">
      <h1>Voice Recording</h1>

      {/* Task selector */}
      <div className="task-selector">
        <label className="label">Select a task:</label>
        <div className="task-cards">
          {TASKS.map((task) => (
            <button
              key={task.type}
              className={`task-card ${selectedTask.type === task.type ? "task-card--active" : ""}`}
              onClick={() => { setSelectedTask(task); handleReset(); }}
            >
              <span className="task-card-icon">{task.icon}</span>
              <strong>{task.title}</strong>
              <span className="task-duration">{task.durationSeconds}s</span>
            </button>
          ))}
        </div>
      </div>

      {/* Task instruction */}
      <div className="task-instruction">
        <p>{selectedTask.instruction}</p>
        {selectedTask.passage && (
          <blockquote className="reading-passage">
            "{selectedTask.passage}"
          </blockquote>
        )}
        <div className="assistant-guide">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => playMedicalAssistant(TASK_GUIDE_SECTION[selectedTask.type])}
            disabled={guideLoading}
          >
            {guideLoading ? "Loading assistant..." : TASK_GUIDE_LABEL[selectedTask.type]}
          </button>
          {guideAudioUrl && (
            <audio
              ref={guideAudioRef}
              className="audio-preview"
              controls
              src={guideAudioUrl}
            />
          )}
          {guideError && <p className="error-msg">{guideError}</p>}
        </div>
      </div>

      {/* Recorder controls */}
      <div className="recorder-section">
        {recorder.error && <p className="error-msg">{recorder.error}</p>}
        {error && <p className="error-msg">{error}</p>}

        <div className="recorder-visual">
          <div className={`mic-circle ${recorder.isRecording ? "recording" : ""}`}>
            <span className="mic-icon">🎙️</span>
          </div>
          <p className="recorder-timer">{formatDuration(recorder.duration)}</p>
        </div>

        <div className="recorder-actions">
          {!recorder.isRecording && !recorder.audioBlob && (
            <button className="btn btn-primary btn-lg" onClick={recorder.startRecording}>
              Start Recording
            </button>
          )}

          {recorder.isRecording && (
            <button className="btn btn-danger btn-lg" onClick={recorder.stopRecording}>
              Stop Recording
            </button>
          )}

          {recorder.audioBlob && !recorder.isRecording && (
            <>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleAnalyze}
              >
                Analyze Recording
              </button>
              <button className="btn btn-outline" onClick={handleReset}>
                Discard &amp; Re-record
              </button>
            </>
          )}
        </div>

        {recorder.audioBlob && (
          <audio
            className="audio-preview"
            controls
            src={URL.createObjectURL(recorder.audioBlob)}
          />
        )}
      </div>
    </div>
  );
}
