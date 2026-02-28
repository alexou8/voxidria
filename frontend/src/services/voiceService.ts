import { supabase } from "@/lib/supabaseClient"; // adjust if needed

const SUPABASE_FUNCTION_URL =
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;

export async function uploadAudio(
  sessionId: string,
  taskId: string,
  blob: Blob
) {
  const filePath = `${sessionId}/${taskId}.webm`;

  const { error } = await supabase.storage
    .from("voice-recordings")
    .upload(filePath, blob, {
      contentType: "audio/webm",
      upsert: true,
    });

  if (error) throw error;

  return filePath;
}

export async function finalizeTask(
  taskId: string,
  audioPath: string,
  duration: number,
  accessToken: string
) {
  const response = await fetch(
    `${SUPABASE_FUNCTION_URL}/finalize-task`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        task_id: taskId,
        audio_path: audioPath,
        duration_ms: duration,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to finalize task");
  }

  return response.json();
}