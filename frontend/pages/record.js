import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Image from "next/image";

const TASKS = [
  {
    id: "sustain",
    step: 1,
    title: "Sustained Pitch",
    instruction: 'Say "Ahhh" clearly and steadily',
    detail: "Hold the vowel sound for at least 5 seconds in a quiet environment. Keep a steady volume and pitch. Do not stop and restart.",
    duration: 5,
    icon: "🎙",
    prompt: '"Ahhh..."',
  },
  {
    id: "reading",
    step: 2,
    title: "Sentence Reading",
    instruction: "Read the sentence below aloud at a natural pace",
    detail: "Read the sentence clearly, as you would in normal conversation. Do not rush or slow down artificially.",
    duration: 8,
    icon: "📖",
    prompt: '"The quick brown fox jumps over the lazy dog near the river bank."',
  },
];

export default function Record() {
  const router = useRouter();
  const [currentTask, setCurrentTask]     = useState(0);
  const [phase, setPhase]                 = useState("intro");
  const [isRecording, setIsRecording]     = useState(false);
  const [elapsed, setElapsed]             = useState(0);
  const [recordings, setRecordings]       = useState({});
  const [bars, setBars]                   = useState(Array(24).fill(4));
  const [consentChecked, setConsentChecked] = useState(false);
  const [uploadError, setUploadError]     = useState(null);

  const mediaRef     = useRef(null);
  const chunksRef    = useRef([]);
  const timerRef     = useRef(null);
  const analyserRef  = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef    = useRef(null);

  const task = TASKS[currentTask];

  useEffect(() => {
    if (!isRecording) {
      cancelAnimationFrame(animFrameRef.current);
      // eslint-disable-next-line
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
        setBars(prev => prev.map(() => Math.random() * 52 + 4));
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      // eslint-disable-next-line
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

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
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordings(prev => ({ ...prev, [task.id]: blob }));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access denied. Please allow microphone access in your browser and try again.");
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
      setCurrentTask(t => t + 1);
      setElapsed(0);
    } else {
      setPhase("uploading");
      uploadAll();
    }
  }

  async function uploadAll() {
    try {
      // TODO: Replace with real upload to your FastAPI backend
      // const form = new FormData();
      // Object.entries(recordings).forEach(([k,v]) => form.append(k, v, `${k}.webm`));
      // const res = await fetch("/api/upload", { method:"POST", body: form });
      // const data = await res.json();
      // router.push(`/results?session=${data.session_id}`);
      await new Promise(r => setTimeout(r, 2000));
      router.push("/results?session=mock");
    } catch (e) {
      setUploadError("Upload failed. Please try again.");
      setPhase("done");
    }
  }

  const hasCurrentRecording = !!recordings[task?.id];

  return (
    <>
      <Head>
        <title>Voice Screening — Voxidria</title>
      </Head>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --navy:  #1A2E44;
          --green: #21E6C1;
          --lime:  #A4FF00;
          --slate: #F9FAFB;
          --white: #FFFFFF;
          --muted: #6B7280;
          --border:#E5E7EB;
          --danger:#EF4444;
          --warn:  #F7CC3B;
          --font:  'Montserrat', sans-serif;
        }
        html, body { background: var(--slate); color: var(--navy); font-family: var(--font); min-height: 100vh; }

        @keyframes fadeUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes ripple  { 0%{transform:scale(0.9);opacity:1} 100%{transform:scale(2.5);opacity:0} }
        .fade-up { animation: fadeUp 0.5s ease both; }

        nav {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.1rem 2.5rem; background: var(--white);
          border-bottom: 1px solid var(--border);
          position: sticky; top: 0; z-index: 100;
          box-shadow: 0 1px 8px rgba(26,46,68,0.06);
        }
        .nav-logo { display: flex; align-items: center; gap: 0.6rem; cursor: pointer; }
        .nav-logo img { height: 38px; width: auto; }
        .btn-back {
          background: transparent; border: 1.5px solid var(--border); color: var(--muted);
          padding: 0.45rem 1rem; border-radius: 6px; font-family: var(--font);
          font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .btn-back:hover { border-color: var(--navy); color: var(--navy); }

        main { max-width: 660px; margin: 0 auto; padding: 3rem 2rem; }

        /* Stepper */
        .stepper { display: flex; margin-bottom: 2.5rem; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--white); }
        .step-item { flex: 1; padding: 0.85rem 1rem; display: flex; align-items: center; gap: 0.6rem; font-size: 0.8rem; font-weight: 600; border-right: 1px solid var(--border); transition: all 0.25s; color: var(--muted); }
        .step-item:last-child { border-right: none; }
        .step-item.active { background: rgba(33,230,193,0.08); color: var(--navy); }
        .step-item.done   { background: rgba(33,230,193,0.05); color: var(--green); }
        .step-num { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 700; flex-shrink: 0; }
        .step-item.active .step-num { background: linear-gradient(135deg, var(--navy), var(--green)); color: white; }
        .step-item.done   .step-num { background: rgba(33,230,193,0.2); color: var(--green); }
        .step-item.pending .step-num { background: var(--slate); color: var(--muted); border: 1px solid var(--border); }

        /* Task card */
        .task-card { background: var(--white); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(26,46,68,0.07); }
        .task-header { padding: 1.8rem; border-bottom: 1px solid var(--border); background: linear-gradient(135deg, rgba(26,46,68,0.03), rgba(33,230,193,0.04)); }
        .task-icon { font-size: 2rem; margin-bottom: 0.7rem; }
        .task-title { font-size: 1.4rem; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 0.3rem; color: var(--navy); }
        .task-instruction { font-size: 0.82rem; color: #0fa88a; font-weight: 600; }
        .task-body { padding: 1.8rem; }
        .task-detail { font-size: 0.82rem; color: var(--muted); line-height: 1.7; margin-bottom: 1.5rem; }

        .prompt-box {
          background: linear-gradient(135deg, rgba(26,46,68,0.04), rgba(33,230,193,0.06));
          border: 1px solid rgba(33,230,193,0.25); border-radius: 10px;
          padding: 1.2rem 1.5rem; font-size: 1.15rem; font-weight: 700;
          color: var(--navy); text-align: center; margin-bottom: 1.8rem; line-height: 1.5;
        }

        .waveform { display: flex; align-items: center; justify-content: center; gap: 4px; height: 64px; margin-bottom: 1.5rem; }
        .wave-bar { width: 5px; border-radius: 3px; background: linear-gradient(to top, var(--navy), var(--green)); transition: height 0.05s ease; opacity: 0.6; }
        .wave-bar.inactive { background: var(--border); opacity: 1; }

        .record-btn-wrap { display: flex; flex-direction: column; align-items: center; gap: 0.8rem; margin-bottom: 1.8rem; }
        .record-btn {
          width: 80px; height: 80px; border-radius: 50%; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.6rem; position: relative; transition: all 0.2s;
        }
        .record-btn.idle { background: var(--slate); border: 2px solid var(--border); }
        .record-btn.idle:hover { border-color: var(--danger); transform: scale(1.05); }
        .record-btn.recording { background: var(--danger); animation: pulse 1.5s ease-in-out infinite; }
        .record-btn.recording::before {
          content: ''; position: absolute; inset: -8px; border-radius: 50%;
          border: 2px solid var(--danger); animation: ripple 1.5s ease-out infinite;
        }
        .record-label { font-size: 0.75rem; color: var(--muted); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }

        .timer { font-size: 2rem; font-weight: 300; letter-spacing: 0.1em; color: var(--navy); text-align: center; margin-bottom: 0.5rem; }
        .timer-bar { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; margin-bottom: 1.8rem; }
        .timer-fill { height: 100%; background: linear-gradient(90deg, var(--navy), var(--green)); border-radius: 2px; transition: width 1s linear; }

        .recorded-badge {
          display: flex; align-items: center; gap: 0.6rem; justify-content: center;
          padding: 0.7rem 1.2rem; background: rgba(33,230,193,0.08);
          border: 1px solid rgba(33,230,193,0.25); border-radius: 8px;
          font-size: 0.8rem; color: #0fa88a; font-weight: 600; margin-bottom: 1.5rem;
        }
        .dot-green { width: 7px; height: 7px; border-radius: 50%; background: var(--green); }

        .btn-submit {
          width: 100%; padding: 1rem; border-radius: 10px; font-family: var(--font);
          font-size: 1rem; font-weight: 700; cursor: pointer; transition: all 0.2s; border: none;
          background: linear-gradient(135deg, var(--navy), var(--green));
          color: white; box-shadow: 0 4px 16px rgba(33,230,193,0.2);
        }
        .btn-submit:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-submit:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }

        /* Consent */
        .consent-wrap { background: var(--white); border: 1px solid var(--border); border-radius: 16px; padding: 2.5rem; box-shadow: 0 2px 12px rgba(26,46,68,0.07); }
        .consent-title { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 0.4rem; color: var(--navy); }
        .consent-sub { font-size: 0.83rem; color: var(--muted); margin-bottom: 1.8rem; line-height: 1.6; }
        .consent-list { list-style: none; display: flex; flex-direction: column; gap: 0.7rem; margin-bottom: 1.8rem; }
        .consent-list li { display: flex; align-items: flex-start; gap: 0.7rem; font-size: 0.82rem; color: var(--muted); line-height: 1.5; }
        .consent-list li::before { content: '→'; color: var(--green); flex-shrink: 0; font-weight: 700; }
        .consent-check { display: flex; align-items: center; gap: 0.8rem; cursor: pointer; margin-bottom: 1.8rem; padding: 1rem; background: var(--slate); border: 1.5px solid var(--border); border-radius: 10px; transition: border-color 0.2s; }
        .consent-check:hover { border-color: var(--green); }
        .consent-check input { width: 16px; height: 16px; accent-color: var(--green); cursor: pointer; }
        .consent-check span { font-size: 0.85rem; font-weight: 600; color: var(--navy); line-height: 1.4; }

        /* Uploading */
        .uploading-wrap { text-align: center; padding: 5rem 2rem; }
        .spinner { width: 48px; height: 48px; border: 3px solid var(--border); border-top-color: var(--green); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1.5rem; }
        .uploading-title { font-size: 1.4rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--navy); }
        .uploading-sub { font-size: 0.82rem; color: var(--muted); line-height: 1.6; }
      `}</style>

      <nav>
        <div className="nav-logo" onClick={() => router.push("/")}>
          <Image src="/logo.png" alt="Voxidria" width={84} height={28} />
        </div>
        <button className="btn-back" onClick={() => router.push("/dashboard")}>← Dashboard</button>
      </nav>

      <main>
        {phase === "intro" && (
          <div className="consent-wrap fade-up">
            <div className="task-icon">🎙</div>
            <div className="consent-title">Before you begin</div>
            <div className="consent-sub">
              You&apos;ll complete 2 short voice recordings. Each takes under 15 seconds.
              Make sure you&apos;re in a quiet room with your microphone unobstructed.
            </div>
            <ul className="consent-list">
              <li>Your voice data is stored securely and linked only to your account.</li>
              <li>Audio may be deleted at any time from your dashboard.</li>
              <li>Results are a screening estimate only — not a medical diagnosis.</li>
              <li>By proceeding you consent to voice data collection for analysis.</li>
            </ul>
            <label className="consent-check">
              <input type="checkbox" checked={consentChecked} onChange={e => setConsentChecked(e.target.checked)} />
              <span>I understand this is a screening tool, not a medical diagnosis, and I consent to voice recording.</span>
            </label>
            <button className="btn-submit" disabled={!consentChecked} onClick={() => setPhase("recording")}>
              Begin Screening →
            </button>
          </div>
        )}

        {phase === "recording" && (
          <>
            <div className="stepper fade-up">
              {TASKS.map((t, i) => (
                <div key={t.id} className={`step-item ${i === currentTask ? "active" : recordings[t.id] ? "done" : "pending"}`}>
                  <div className="step-num">{recordings[t.id] && i !== currentTask ? "✓" : i + 1}</div>
                  {t.title}
                </div>
              ))}
            </div>

            <div className="task-card fade-up">
              <div className="task-header">
                <div className="task-icon">{task.icon}</div>
                <div className="task-title">{task.title}</div>
                <div className="task-instruction">{task.instruction}</div>
              </div>
              <div className="task-body">
                <div className="task-detail">{task.detail}</div>
                <div className="prompt-box">{task.prompt}</div>

                <div className="waveform">
                  {bars.map((h, i) => (
                    <div key={i} className={`wave-bar ${!isRecording ? "inactive" : ""}`} style={{ height: h }} />
                  ))}
                </div>

                {isRecording && (
                  <>
                    <div className="timer">{String(Math.floor(elapsed/60)).padStart(2,"0")}:{String(elapsed%60).padStart(2,"0")}</div>
                    <div className="timer-bar">
                      <div className="timer-fill" style={{ width:`${Math.min((elapsed/task.duration)*100,100)}%` }} />
                    </div>
                  </>
                )}

                {hasCurrentRecording && !isRecording && (
                  <div className="recorded-badge">
                    <div className="dot-green" /> Recording saved · {elapsed}s captured · Re-record below to redo
                  </div>
                )}

                <div className="record-btn-wrap">
                  <button className={`record-btn ${isRecording ? "recording" : "idle"}`} onClick={isRecording ? stopRecording : startRecording}>
                    {isRecording ? "⏹" : "⏺"}
                  </button>
                  <div className="record-label">{isRecording ? "Tap to stop" : "Tap to record"}</div>
                </div>

                <button className="btn-submit" disabled={!hasCurrentRecording || isRecording} onClick={nextTask}>
                  {currentTask < TASKS.length - 1 ? "Next Task → (2/2)" : "Submit All Recordings →"}
                </button>
              </div>
            </div>
          </>
        )}

        {phase === "uploading" && (
          <div className="uploading-wrap fade-up">
            <div className="spinner" />
            <div className="uploading-title">Analysing your voice...</div>
            <div className="uploading-sub">Running feature extraction and ML inference.<br />This usually takes under 10 seconds.</div>
          </div>
        )}
      </main>
    </>
  );
}
