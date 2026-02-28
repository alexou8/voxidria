const API_BASE = "/api";

export async function fetchVoiceTasks(getAccessToken) {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/voice/tasks`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch voice tasks");
  return res.json();
}

export async function analyzeRecording(audioBlob, getAccessToken) {
  const token = await getAccessToken();
  const form = new FormData();
  form.append("audio", audioBlob, "recording.webm");

  const res = await fetch(`${API_BASE}/voice/analyze`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Analysis failed");
  }

  return res.json();
}
