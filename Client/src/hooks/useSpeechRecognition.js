import { useCallback, useEffect, useRef, useState } from "react";

export function useSpeechRecognition({ onTranscript }) {
  const recognitionRef = useRef(null);
  const [supported] = useState(() => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [volume, setVolume] = useState(0);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const frameRef = useRef(null);

  const stopMeter = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    frameRef.current = null; audioContextRef.current = null; streamRef.current = null; setVolume(0);
  }, []);
  const stop = useCallback(() => { recognitionRef.current?.stop(); stopMeter(); setRecording(false); }, [stopMeter]);

  const start = useCallback(async () => {
    if (!supported) { setError("Speech recognition is not supported in this browser. Please type your answer instead."); return; }
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const Context = window.AudioContext || window.webkitAudioContext;
      const context = new Context(); const analyser = context.createAnalyser();
      context.createMediaStreamSource(stream).connect(analyser); audioContextRef.current = context;
      const meter = () => { const values = new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(values); setVolume(values.reduce((sum, value) => sum + value, 0) / values.length); frameRef.current = requestAnimationFrame(meter); }; meter();
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new Recognition(); recognition.continuous = true; recognition.interimResults = true; recognition.lang = "en-US";
      recognition.onresult = (event) => { let transcript = ""; for (let index = event.resultIndex; index < event.results.length; index += 1) transcript += event.results[index][0].transcript; onTranscript(transcript, event.results[event.results.length - 1].isFinal); };
      recognition.onerror = (event) => { if (event.error !== "aborted") setError(event.error === "not-allowed" ? "Microphone access was denied. Allow it in browser settings, or type your answer." : "Speech recognition stopped. You can continue by typing."); };
      recognition.onend = () => { setRecording(false); stopMeter(); };
      recognitionRef.current = recognition; recognition.start(); setRecording(true);
    } catch (requestError) { setError(requestError.name === "NotAllowedError" ? "Microphone access was denied. Allow it in browser settings, or type your answer." : "Unable to access the microphone. Please check your device and try again."); }
  }, [onTranscript, stopMeter, supported]);

  useEffect(() => () => stop(), [stop]);
  return { supported, recording, error, volume, start, stop };
}
