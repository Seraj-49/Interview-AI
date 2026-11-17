import { useCallback, useEffect, useRef, useState } from "react";

const voiceMatchesPreference = (voice, preference) => {
  const name = voice.name.toLowerCase();
  const male = ["male", "david", "daniel", "mark", "george", "guy", "james"];
  const female = ["female", "zira", "samantha", "aria", "hazel", "jenny", "susan"];
  return (preference === "male" ? male : female).some((term) => name.includes(term));
};

export function useInterviewerVoice() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const utteranceRef = useRef(null);
  const [voices, setVoices] = useState([]);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!supported) return undefined;
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("en")));
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, [supported]);

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setSpeaking(false);
    setPaused(false);
  }, [supported]);

  const speak = useCallback((text, { preference = "female", voiceName = "", rate = 0.95, volume = 1, onEnd } = {}) => {
    if (!supported || muted || !text.trim()) return false;
    stop();
    const utterance = new SpeechSynthesisUtterance(text);
    const selected = voices.find((voice) => voice.name === voiceName) || voices.find((voice) => voiceMatchesPreference(voice, preference)) || voices[0] || null;
    utterance.voice = selected;
    utterance.rate = Math.max(0.6, Math.min(1.4, Number(rate) || 0.95));
    utterance.volume = Math.max(0, Math.min(1, Number(volume)));
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => { utteranceRef.current = null; setSpeaking(false); setPaused(false); onEnd?.(); };
    utterance.onerror = () => { utteranceRef.current = null; setSpeaking(false); setPaused(false); };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  }, [muted, stop, supported, voices]);

  const pause = useCallback(() => { if (supported && window.speechSynthesis.speaking) { window.speechSynthesis.pause(); setPaused(true); } }, [supported]);
  const resume = useCallback(() => { if (supported && window.speechSynthesis.paused) { window.speechSynthesis.resume(); setPaused(false); } }, [supported]);
  useEffect(() => () => stop(), [stop]);

  return { supported, voices, muted, setMuted, speaking, paused, speak, stop, pause, resume };
}
