import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { fetchVoiceTasks, analyzeRecording } from "../services/api";
import ResultsCard from "../components/ResultsCard";
import "./RecordPage.css";

export default function RecordPage() {
  const { getAccessTokenSilently } = useAuth0();
  const recorder = useVoiceRecorder();

  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchVoiceTasks(() => getAccessTokenSilently())
      .then((data) => {
        setTasks(data.tasks);
        setSelectedTask(data.tasks[0]);
      })
      .catch(() => setError("Could not load voice tasks."));
  }, [getAccessTokenSilently]);

  const handleAnalyze = async () => {
    if (!recorder.audioBlob) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const data = await analyzeRecording(
        recorder.audioBlob,
        () => getAccessTokenSilently()
      );
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    recorder.reset();
    setResults(null);
    setError(null);
  };

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (results) {
    return (
      <div className="record-page">
        <ResultsCard results={results} />
        <button className="btn btn-primary btn-lg" onClick={handleReset}>
          Record Another
        </button>
      </div>
    );
  }

  return (
    <div className="record-page">
      <h1>Voice Recording</h1>

      {/* Task selector */}
      {tasks.length > 0 && (
        <div className="task-selector">
          <label className="label">Select a task:</label>
          <div className="task-cards">
            {tasks.map((task) => (
              <button
                key={task.id}
                className={`task-card ${selectedTask?.id === task.id ? "task-card--active" : ""}`}
                onClick={() => { setSelectedTask(task); handleReset(); }}
              >
                <strong>{task.title}</strong>
                <span className="task-duration">{task.durationSeconds}s</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Task instruction */}
      {selectedTask && (
        <div className="task-instruction">
          <p>{selectedTask.instruction}</p>
        </div>
      )}

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
                disabled={isAnalyzing}
              >
                {isAnalyzing ? "Analyzing..." : "Analyze Recording"}
              </button>
              <button className="btn btn-outline" onClick={handleReset}>
                Discard & Re-record
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
