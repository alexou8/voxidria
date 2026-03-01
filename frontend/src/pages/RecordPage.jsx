import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import {
  createSession,
  getUploadUrl,
  uploadAudioToStorage,
  finalizeTask,
  READING_PASSAGE,
  synthesizeSpeech,
} from "../services/api";
import "./RecordPage.css";

//🇬🇧
const READING_SENTENCES = {
  en: { label: "English", flag: "🇨🇦", text: READING_PASSAGE },
  zh: { label: "Mandarin", flag: "🇨🇳", text: "飞速棕色的猫跳过了河边懒洋洋的狗。" },
  hi: { label: "Hindi", flag: "🇮🇳", text: "तेज़ भूरे लोमड़े ने नदी के किनारे आलसी कुत्ते के ऊपर से कूद गए।" },
};

const TASKS = [
  {
    id: "sustain",
    backendType: "SUSTAINED_VOWEL",
    step: 1,
    title: "Sustained Pitch",
    instruction: 'Say "Ahhh" clearly and steadily',
    detail: 'Hold the vowel sound for at least 5 seconds in a quiet environment. Keep a steady volume and pitch. Do not stop and restart.',
    duration: 5,
    icon: "🎤",
    skippable: false,
  },
  {
    id: "reading",
    backendType: "READING",
    step: 2,
    title: "Sentence Reading",
    instruction: "Read the sentence below aloud at a natural pace",
    detail: "Read the sentence clearly, as you would in normal conversation. Do not rush or slow down artificially.",
    duration: 8,
    icon: "📖",
    skippable: true,
  },
];

export default function RecordPage() {
  const navigate = useNavigate();
  const { getAccessTokenSilently } = useAuth0();

  const [currentTask, setCurrentTask] = useState(0);
  const [phase, setPhase] = useState("intro");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordings, setRecordings] = useState({});
  const [bars, setBars] = useState(Array(24).fill(4));
  const [consentChecked, setConsentChecked] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [language, setLanguage] = useState("en");
  const [languageChosen, setLanguageChosen] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessionError, setSessionError] = useState(null);
  const [taskSwitchWarning, setTaskSwitchWarning] = useState("");

  // Guide audio (ElevenLabs)
  const guideAudioRef = useRef(null);
  const latestGuideReqId = useRef(0);
  const [guideAudioUrl, setGuideAudioUrl] = useState("");
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideError, setGuideError] = useState(null);

  // MediaRecorder refs
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);
  const taskSwitchTimerRef = useRef(null);

  const task = TASKS[currentTask];
  const isReadingTask = task?.id === "reading";
  const sentence = READING_SENTENCES[language];
  const hasCurrentRecording = !!recordings[task?.id];

  // Show language picker when arriving at reading task recording phase
  useEffect(() => {
    if (task?.id === "reading" && phase === "recording") {
      setShowLangPicker(true);
    }
  }, [currentTask, phase, task?.id]);

  // Waveform animation
  useEffect(() => {
    if (!isRecording) {
      cancelAnimationFrame(animFrameRef.current);
      setBars(Array(24).fill(4));
      return;
    }
    const animate = () => {
      if (analyserRef.current) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const step = Math.floor(data.length / 24);
        setBars(Array.from({ length: 24 }, (_, i) => Math.max(4, (data[i * step] / 255) * 56 + 4)));
      } else {
        setBars((prev) => prev.map(() => Math.random() * 52 + 4));
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isRecording]);

  // Elapsed timer
  useEffect(() => {
    if (isRecording) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  // Cleanup guide audio on unmount
  useEffect(() => {
    return () => {
      if (guideAudioUrl) URL.revokeObjectURL(guideAudioUrl);
      if (guideAudioRef.current) guideAudioRef.current.pause();
      if (taskSwitchTimerRef.current) clearTimeout(taskSwitchTimerRef.current);
    };
  }, [guideAudioUrl]);

  // Play guide audio when URL changes
  useEffect(() => {
    if (!guideAudioUrl || !guideAudioRef.current) return;
    guideAudioRef.current.currentTime = 0;
    guideAudioRef.current.play().catch(() => {});
  }, [guideAudioUrl]);

  const playMedicalAssistant = async (section) => {
    const reqId = latestGuideReqId.current + 1;
    latestGuideReqId.current = reqId;
    if (guideAudioRef.current) {
      guideAudioRef.current.pause();
      guideAudioRef.current.currentTime = 0;
    }
    setGuideError(null);
    setGuideLoading(true);
    try {
      const blob = await synthesizeSpeech("", "MEDICAL_ASSISTANT", getAccessTokenSilently, { section });
      if (latestGuideReqId.current !== reqId) return;
      setGuideAudioUrl(URL.createObjectURL(blob));
    } catch (err) {
      if (latestGuideReqId.current !== reqId) return;
      setGuideError(err.message || "Could not load audio.");
    } finally {
      if (latestGuideReqId.current === reqId) setGuideLoading(false);
    }
  };

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordings((prev) => ({ ...prev, [task.id]: blob }));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setIsRecording(true);
    } catch {
      alert("Microphone access denied. Please allow microphone access and try again.");
    }
  }

  function stopRecording() {
    if (mediaRef.current && isRecording) {
      mediaRef.current.stop();
      setIsRecording(false);
    }
  }

  function nextTask() {
    if (currentTask < TASKS.length - 1) {
      setCurrentTask((t) => t + 1);
      setElapsed(0);
    } else {
      setPhase("uploading");
      uploadAll();
    }
  }

  function skipTask() {
    setPhase("uploading");
  }

  async function handleConsent() {
    setSessionError(null);
    try {
      const deviceMeta = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        screenWidth: window.screen.width,
      };
      const data = await createSession("1.0", deviceMeta, getAccessTokenSilently);
      setSessionId(data.session_id);
      setPhase("recording");
    } catch (err) {
      setSessionError("Could not start session. Please try again.");
    }
  }

  async function uploadAll() {
    setUploadError(null);
    try {
      for (const taskDef of TASKS) {
        const blob = recordings[taskDef.id];
        if (!blob) continue;
        const contentType = blob.type || "audio/webm";
        const { signedUrl } = await getUploadUrl(sessionId, taskDef.backendType, contentType, getAccessTokenSilently);
        await uploadAudioToStorage(signedUrl, blob);
        await finalizeTask(sessionId, taskDef.backendType, "", getAccessTokenSilently);
      }
      navigate(`/results?session=${sessionId}`);
    } catch (err) {
      console.log(err);
      setUploadError("Upload failed. Please try again.");
      setPhase("recording");
    }
  }

  function changeTests(t, i) {
    if(recordings[task.id] || isReadingTask) {
      setCurrentTask(i);
    } else if(task.id === t.id){
      // Nothing
    } else {
      setTaskSwitchWarning("Please complete the current recording before switching tasks.");
      if (taskSwitchTimerRef.current) clearTimeout(taskSwitchTimerRef.current);
      taskSwitchTimerRef.current = setTimeout(() => {
        setTaskSwitchWarning("");
      }, 3000);
    }
  }

  // ── INTRO / CONSENT ──────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <>
        <nav className="rp-nav">
          <div className="rp-nav-logo" onClick={() => navigate("/")}>
            <img src="/logo.png" alt="Voxidria" height="38" />
          </div>
          <button className="rp-btn-back" onClick={() => navigate("/")}>← Back</button>
        </nav>
        <main className="rp-main">
          <div className="rp-consent-wrap rp-fade-up">
            <div className="rp-task-icon">🎙️</div>
            <div className="rp-consent-title">Before you begin</div>
            <div className="rp-consent-sub">
              You'll complete up to 2 short voice recordings. Each takes under 15 seconds.
              Make sure you're in a quiet room with your microphone unobstructed.
            </div>
            <ul className="rp-consent-list">
              <li>Your voice data is stored securely and linked only to your account.</li>
              <li>Audio may be deleted at any time from your dashboard.</li>
              <li>Results are a screening estimate only — not a medical diagnosis.</li>
              <li>By proceeding you consent to voice data collection for analysis.</li>
            </ul>
            <label className="rp-consent-check">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
              <span>I understand this is a screening tool, not a medical diagnosis, and I consent to voice recording.</span>
            </label>
            {/* Medical assistant guide */}
            <div className="rp-guide-row">
              <button
                className="rp-btn-guide"
                onClick={() => playMedicalAssistant("CONSENT_OVERVIEW")}
                disabled={guideLoading}
              >
                {guideLoading ? "Loading assistant…" : "🎧 Hear Medical Assistant Overview"}
              </button>
              {guideAudioUrl && <audio ref={guideAudioRef} controls src={guideAudioUrl} className="rp-audio" />}
              {guideError && <p className="rp-error">{guideError}</p>}
            </div>
            {sessionError && <p className="rp-error">{sessionError}</p>}
            <button className="rp-btn-submit" disabled={!consentChecked} onClick={handleConsent}>
              Begin Screening →
            </button>
          </div>
        </main>
      </>
    );
  }

  // ── UPLOADING ─────────────────────────────────────────────────────────────
  if (phase === "uploading") {
    return (
      <>
        <nav className="rp-nav">
          <div className="rp-nav-logo"><img src="/logo.png" alt="Voxidria" height="38" /></div>
        </nav>
        <main className="rp-main">
          <div className="rp-uploading-wrap rp-fade-up">
            <div className="rp-spinner" />
            <div className="rp-uploading-title">Analysing your voice…</div>
            <div className="rp-uploading-sub">
              Running feature extraction and ML inference.<br />
              This usually takes under 10 seconds.
            </div>
            {!uploadError && navigate(`/results?session=${sessionId}`)}
            {uploadError && <p className="rp-error" style={{ marginTop: "1rem" }}>{uploadError}</p>}
          </div>
        </main>
      </>
    );
  } else {
    // ── RECORDING ─────────────────────────────────────────────────────────────
    return (
      <>
        {taskSwitchWarning && (
          <div className="rp-flash-wrap" role="alert" aria-live="assertive">
            <div className="rp-flash-popup">
              <div className="rp-flash-glow" />
              <div className="rp-flash-copy">
                <div className="rp-flash-title">Hold up</div>
                <div className="rp-flash-message">{taskSwitchWarning}</div>
              </div>
              <div className="x-button">
                <button
                  type="button"
                  className="rp-flash-close"
                  onClick={() => setTaskSwitchWarning("")}
                  aria-label="Dismiss warning"
                >
                  x
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Language Picker Modal */}
        {showLangPicker && !languageChosen && (
          <div className="rp-lang-overlay" onClick={() => setShowLangPicker(false)}>
            <div className="rp-lang-modal" onClick={(e) => e.stopPropagation()}>
              <div className="rp-lang-modal-title">🌐 Choose your language</div>
              <div className="rp-lang-modal-sub">
                Select the language you'd like to read the sentence in.
              </div>
              <div className="rp-lang-options">
                {Object.entries(READING_SENTENCES).map(([code, lang]) => (
                  <div
                    key={code}
                    className={`rp-lang-option${language === code ? " selected" : ""}`}
                    onClick={() => setLanguage(code)}
                  >
                    <span className="rp-lang-flag">{lang.flag}</span>
                    <span className="rp-lang-name">{lang.label}</span>
                    {language === code && <span className="rp-lang-check">✓</span>}
                  </div>
                ))}
              </div>
              <button className="rp-btn-submit" onClick={() => {
                setShowLangPicker(false);
                setLanguageChosen(true);
              }}>
                Confirm — {READING_SENTENCES[language].flag} {READING_SENTENCES[language].label}
              </button>
            </div>
          </div>
        )}
        <nav className="rp-nav">
          <div className="rp-nav-logo" onClick={() => navigate("/")}>
            <img src="/logo.png" alt="Voxidria" height="38" />
          </div>
          <button className="rp-btn-back" onClick={() => navigate("/")}>← Dashboard</button>
        </nav>

        <main className="rp-main">
          {/* Stepper */}
          <div className="rp-stepper rp-fade-up">
            {TASKS.map((t, i) => (
              <button key={t.id} className={`unstyled-btn rp-step-item ${i === currentTask ? "active" : recordings[t.id] ? "done" : "pending"} `} 
                onClick={() => changeTests(t, i)}>
                <div
                  className={`rp-step-item ${i === currentTask ? "active" : recordings[t.id] ? "done" : "pending"} `}
                >
                  <div className="rp-step-num">
                    {recordings[t.id] && i !== currentTask ? "✓" : i + 1}
                  </div>
                  {t.title}
                </div>
              </button>
            ))}
          </div>

          {/* Task Card */}
          <div className="rp-task-card rp-fade-up">
            <div className="rp-task-header">
              <div className="rp-task-header-top">
                <div>
                  <div className="rp-task-icon">{task.icon}</div>
                  <div className="rp-task-title">{task.title}</div>
                  <div className="rp-task-instruction">{task.instruction}</div>
                </div>
                {task.skippable && !isRecording && (
                  <button className="rp-btn-skip" onClick={skipTask}>Skip →</button>
                )}
              </div>
            </div>
            <div className="rp-task-body">
              <div className="rp-task-detail">{task.detail}</div>

              {/* Language badge + sentence for reading task */}
              {isReadingTask && (
                <>
                  <div className="rp-lang-badge" onClick={() => {
                    setShowLangPicker(true);
                    setLanguageChosen(false);
                    }}>
                    {sentence.flag} {sentence.label} · Change language →
                  </div>
                  <div className="rp-prompt-box">{sentence.text}</div>
                </>
              )}

              {/* Prompt for pitch task */}
              {!isReadingTask && <div className="rp-prompt-box">&quot;Ahhh…&quot;</div>}

              {/* Medical assistant guide */}
              <div className="rp-guide-row" style={{ marginBottom: "1rem" }}>
                <button
                  className="rp-btn-guide"
                  onClick={() => playMedicalAssistant(
                    task.id === "sustain" ? "AHHH_TEST" : "READING_TEST"
                  )}
                  disabled={guideLoading}
                >
                  {guideLoading ? "Loading…" : `🎧 Hear ${task.title} instructions`}
                </button>
                {guideAudioUrl && <audio ref={guideAudioRef} controls src={guideAudioUrl} className="rp-audio" />}
                {guideError && <p className="rp-error">{guideError}</p>}
              </div>

              {/* Waveform */}
              <div className="rp-waveform">
                {bars.map((h, i) => (
                  <div
                    key={i}
                    className={`rp-wave-bar${!isRecording ? " inactive" : ""}`}
                    style={{ height: h }}
                  />
                ))}
              </div>

              {/* Timer */}
              {isRecording && (
                <>
                  <div className="rp-timer">
                    {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
                  </div>
                  <div className="rp-timer-bar">
                    <div
                      className="rp-timer-fill"
                      style={{ width: `${Math.min((elapsed / task.duration) * 100, 100)}%` }}
                    />
                  </div>
                </>
              )}

              {/* Recorded badge */}
              {hasCurrentRecording && !isRecording && (
                <div className="rp-recorded-badge">
                  <div className="rp-dot-green" /> Recording saved · {elapsed}s captured · Re-record below to redo
                </div>
              )}

              {/* Record button */}
              <div className="rp-record-btn-wrap">
                <button
                  className={`rp-record-btn ${isRecording ? "recording" : "idle"}`}
                  onClick={isRecording ? stopRecording : startRecording}
                >
                  {isRecording ? "⏹" : "⏺"}
                </button>
                <div className="rp-record-label">{isRecording ? "Tap to stop" : "Tap to record"}</div>
              </div>

              <button
                className="rp-btn-submit"
                disabled={!hasCurrentRecording || isRecording}
                onClick={nextTask}
              >
                {currentTask < TASKS.length - 1
                  ? `Next Task → (${currentTask + 2}/${TASKS.length})`
                  : "Submit All Recordings →"}
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }
}
