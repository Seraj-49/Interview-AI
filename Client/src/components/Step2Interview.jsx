import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { FaBookmark, FaPause, FaPlay, FaRegBookmark, FaVolumeMute, FaVolumeUp } from "react-icons/fa";
import femaleVideo from "../assets/Videos/female-ai.mp4";
import maleVideo from "../assets/Videos/male-ai.mp4";
import { ServerUrl } from "../config/api";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import Timer from "./Timer";

const getTtsErrorMessage = async (requestError) => {
  const payload = requestError.response?.data;
  if (payload instanceof Blob) {
    try {
      const parsed = JSON.parse(await payload.text());
      return parsed.message || "The TTS service returned an error.";
    } catch { return "The TTS service returned an unreadable error response."; }
  }
  return payload?.message || requestError.message || "Unable to generate question audio.";
};

function Step2Interview({ interviewData, onFinish }) {
  const [questions, setQuestions] = useState(() => interviewData?.questions || []);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(() => interviewData?.questions?.[0]?.timeLimit || 60);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speechRate, setSpeechRate] = useState(0.95);
  const [speechVolume, setSpeechVolume] = useState(1);
  const [interviewPaused, setInterviewPaused] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCanPlay, setAudioCanPlay] = useState(false);
  const [answerReady, setAnswerReady] = useState(false);
  const answerBaseRef = useRef("");
  const timeLeftRef = useRef(interviewData?.questions?.[0]?.timeLimit || 60);
  const timeoutSubmittedRef = useRef(false);
  const submitAnswerRef = useRef(null);
  const spokenQuestionRef = useRef(null);
  const audioRef = useRef(null);
  const audioUrlRef = useRef("");
  const audioRequestRef = useRef(null);
  const audioReadyCancelRef = useRef(null);
  const audioContextRef = useRef(null);
  const question = questions[questionIndex];
  const timeLimit = question?.timeLimit || 60;
  const [muted, setMuted] = useState(false);
  const audioSupported = typeof window !== "undefined" && typeof window.Audio === "function" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function";

  const handleTranscript = useCallback((transcript) => setAnswer(`${answerBaseRef.current} ${transcript}`.trim()), []);
  const { supported: recognitionSupported, recording, error: microphoneError, volume, start, stop } = useSpeechRecognition({ onTranscript: handleTranscript });

  const stopQuestionAudio = useCallback(() => {
    audioReadyCancelRef.current?.();
    audioReadyCancelRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      // Removing handlers first makes an intentional stop/replacement invisible to the error UI.
      audio.onloadedmetadata = null; audio.oncanplay = null; audio.onplay = null; audio.onended = null; audio.onerror = null;
      audio.pause(); audio.removeAttribute("src"); audio.load(); audioRef.current = null;
    }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = ""; setAudioPlaying(false); setAudioCanPlay(false);
  }, []);
  const cancelAudioRequest = useCallback(() => {
    audioRequestRef.current?.controller.abort();
    audioRequestRef.current = null;
  }, []);
  const playQuestionAudio = useCallback(async (force = false) => {
    if (!question || (!voiceEnabled && !force)) return false;
    const requestKey = `${interviewData.interviewId}:${question._id}`;
    if (audioRequestRef.current?.key === requestKey) return false;
    audioRequestRef.current?.controller.abort();
    const controller = new AbortController();
    audioRequestRef.current = { key: requestKey, controller };
    stopQuestionAudio(); setAnswerReady(false); setAudioLoading(true);
    try {
      console.info("[TTS:ElevenLabs] frontend audio loading", { interviewId: interviewData.interviewId, questionId: question._id, questionLength: question.question.length });
      const response = await axios.get(`${ServerUrl}/api/interview/${interviewData.interviewId}/questions/${question._id}/audio`, { responseType: "blob", withCredentials: true, signal: controller.signal });
      if (audioRequestRef.current?.key !== requestKey) return false;
      const contentType = response.headers["content-type"] || "";
      const byteLength = response.data?.size || 0;
      console.info("[TTS] frontend audio response", { contentType, byteLength });
      if (!contentType.startsWith("audio/") || !byteLength) throw new Error("The TTS endpoint did not return playable audio.");
      const audioBlob = new Blob([response.data], { type: "audio/mpeg" });
      if (!audioBlob.size) throw new Error("Received empty audio data.");
      const url = URL.createObjectURL(audioBlob); audioUrlRef.current = url;
      const audio = new Audio(); audioRef.current = audio; audio.src = url; audio.volume = muted ? 0 : speechVolume; audio.playbackRate = speechRate;
      audio.preload = "auto";
      audio.onloadedmetadata = () => console.info("[TTS] browser audio metadata loaded", { questionId: question._id, duration: audio.duration });
      audio.oncanplay = () => { console.info("[TTS] browser audio ready", { questionId: question._id }); setAudioCanPlay(true); };
      audio.onplay = () => { console.info("[TTS] browser playback started", { questionId: question._id }); setAudioPlaying(true); };
      audio.onended = () => { console.info("[TTS] browser playback ended", { questionId: question._id }); if (audioRef.current === audio) { audioRef.current = null; if (audioUrlRef.current === url) { URL.revokeObjectURL(url); audioUrlRef.current = ""; } } setAudioPlaying(false); setAnswerReady(true); };
      audio.onerror = () => { if (audioRef.current !== audio || !audio.currentSrc) return; console.error("[TTS] browser audio error", { questionId: question._id, mediaError: audio.error?.message || audio.error?.code }); setAudioPlaying(false); setAudioCanPlay(false); setVoiceEnabled(false); setError(`Generated question audio could not be played${audio.error?.message ? `: ${audio.error.message}` : "."}`); };
      await new Promise((resolve, reject) => {
        const cleanup = () => { audio.removeEventListener("canplay", ready); audio.removeEventListener("error", failed); if (audioReadyCancelRef.current === cancel) audioReadyCancelRef.current = null; };
        const ready = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error("The generated audio could not be loaded.")); };
        const cancel = () => { cleanup(); const cancellation = new Error("Audio playback was cancelled."); cancellation.name = "AbortError"; reject(cancellation); };
        audioReadyCancelRef.current = cancel;
        audio.addEventListener("canplay", ready, { once: true }); audio.addEventListener("error", failed, { once: true });
        if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) ready(); else audio.load();
      });
      if (!audio.src) throw new Error("Audio source was cleared before playback.");
      console.info("[TTS] browser playback requested", { questionId: question._id, hasSource: Boolean(audio.src) }); await audio.play(); return true;
    } catch (requestError) { if (axios.isCancel(requestError) || requestError.name === "AbortError") return false; const message = await getTtsErrorMessage(requestError); console.error("[TTS] frontend playback failure", { status: requestError.response?.status, message }); setVoiceEnabled(false); setError(message); return false; }
    finally { if (audioRequestRef.current?.key === requestKey) audioRequestRef.current = null; setAudioLoading(false); }
  }, [interviewData.interviewId, muted, question, speechRate, speechVolume, stopQuestionAudio, voiceEnabled]);

  useEffect(() => {
    if (!voiceEnabled) return undefined;
    if (spokenQuestionRef.current === questionIndex) return undefined;
    const id = window.setTimeout(() => { spokenQuestionRef.current = questionIndex; playQuestionAudio(); }, 100);
    return () => window.clearTimeout(id);
  }, [playQuestionAudio, questionIndex, voiceEnabled]);
  useEffect(() => () => { stop(); cancelAudioRequest(); stopQuestionAudio(); audioContextRef.current?.close?.(); }, [cancelAudioRequest, stop, stopQuestionAudio]);

  const submitAnswer = useCallback(async (timedOut = false) => {
    if (!question || submitting) return;
    stop(); cancelAudioRequest(); stopQuestionAudio(); setSubmitting(true); setError("");
    try {
      const result = await axios.post(`${ServerUrl}/api/interview/submit-answer`, { interviewId: interviewData.interviewId, questionIndex, answer: timedOut ? "" : answer.trim(), timeTaken: timeLimit - timeLeftRef.current }, { withCredentials: true });
      const nextQuestions = result.data.followUpQuestion ? [...questions, result.data.followUpQuestion] : questions;
      if (result.data.followUpQuestion) setQuestions(nextQuestions);
      if (questionIndex < nextQuestions.length - 1) {
        const next = nextQuestions[questionIndex + 1]; const nextTime = next.timeLimit || 60;
        answerBaseRef.current = ""; setAnswer(""); setAnswerReady(false); timeLeftRef.current = nextTime; timeoutSubmittedRef.current = false; spokenQuestionRef.current = null; setTimeLeft(nextTime); setQuestionIndex((index) => index + 1);
      } else {
        const report = await axios.post(`${ServerUrl}/api/interview/finish`, { interviewId: interviewData.interviewId }, { withCredentials: true });
        onFinish(report.data);
      }
    } catch (requestError) { setError(requestError.response?.data?.message || "Unable to save your answer. Please try again."); }
    finally { setSubmitting(false); }
  }, [answer, cancelAudioRequest, interviewData.interviewId, onFinish, question, questionIndex, questions, stop, stopQuestionAudio, submitting, timeLimit]);
  useEffect(() => { submitAnswerRef.current = submitAnswer; }, [submitAnswer]);

  useEffect(() => {
    if (!question || submitting || interviewPaused || !answerReady) return undefined;
    const id = window.setInterval(() => setTimeLeft((value) => {
      const next = Math.max(0, value - 1); timeLeftRef.current = next;
      if (next === 0 && !timeoutSubmittedRef.current) { timeoutSubmittedRef.current = true; window.setTimeout(() => submitAnswerRef.current?.(true), 0); }
      return next;
    }), 1000);
    return () => window.clearInterval(id);
  }, [answerReady, interviewPaused, question, questionIndex, submitting]);

  const enableVoice = async () => {
    if (!audioSupported || audioLoading) { if (!audioSupported) setError("This browser cannot play interview audio."); return; }
    setError(""); setAudioLoading(true); setAnswerReady(false);
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) { audioContextRef.current ||= new AudioContext(); if (audioContextRef.current.state === "suspended") await audioContextRef.current.resume(); }
      setVoiceEnabled(true); spokenQuestionRef.current = questionIndex;
      await playQuestionAudio(true);
    } catch (activationError) { setVoiceEnabled(false); setError(`Unable to enable audio: ${activationError.message}`); }
    finally { setAudioLoading(false); }
  };
  const disableVoice = () => { cancelAudioRequest(); stopQuestionAudio(); setVoiceEnabled(false); setAudioLoading(false); setInterviewPaused(false); setAnswerReady(true); };
  const startRecording = async () => { answerBaseRef.current = answer; await start(); };
  const togglePause = async () => { if (interviewPaused) { setInterviewPaused(false); try { if (audioRef.current?.paused) await audioRef.current.play(); } catch (playError) { setError(`Unable to resume audio: ${playError.message}`); } } else { setInterviewPaused(true); stop(); audioRef.current?.pause(); } };
  const toggleBookmark = async () => {
    try {
      const result = await axios.patch(`${ServerUrl}/api/interview/${interviewData.interviewId}/questions/${question._id}/bookmark`, {}, { withCredentials: true });
      setQuestions((current) => current.map((item) => item._id === question._id ? { ...item, isBookmarked: result.data.bookmarked } : item));
    } catch (requestError) { setError(requestError.response?.data?.message || "Unable to bookmark this question."); }
  };
  if (!interviewData?.interviewId || !question) return <div className="p-8 text-center">Interview data is missing. Please start again.</div>;
  const isMale = false;
  const displayStatus = submitting ? "Evaluating Answer" : interviewPaused ? "Interview Paused" : audioLoading ? "Loading Question Audio" : audioPlaying ? "AI Speaking" : recording ? "Listening" : voiceEnabled ? "Waiting for Answer" : "Enable Audio";

  return <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-100 flex items-center justify-center p-4 sm:p-6"><div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl border border-gray-200 grid lg:grid-cols-2 overflow-hidden">
    <section className="bg-emerald-50 p-6 sm:p-10 flex flex-col justify-center gap-6"><div className={`w-full max-w-md rounded-2xl overflow-hidden shadow-xl transition-transform ${audioPlaying ? "scale-[1.02] ring-4 ring-emerald-300 animate-pulse" : ""}`}><video src={isMale ? maleVideo : femaleVideo} muted playsInline autoPlay loop className="w-full aspect-video object-cover" /></div>
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-md p-6 space-y-4"><div className="flex justify-between items-center"><span className="text-sm text-gray-500">Interview Status</span><span className="text-sm font-semibold text-emerald-600">{displayStatus}</span></div><p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700" aria-live="polite"><span className="font-semibold">Live subtitle: </span>{question.question}</p><div className="h-px bg-gray-200" /><div className="flex items-center justify-between gap-4"><Timer timeLeft={timeLeft} totalTime={timeLimit} /><div className="flex flex-wrap justify-end gap-2"><button title="Replay question" onClick={() => playQuestionAudio()} disabled={!voiceEnabled || audioLoading} className="rounded-full bg-gray-100 p-3 hover:bg-gray-200 disabled:opacity-50"><FaPlay /></button><button title={muted ? "Unmute interviewer" : "Mute interviewer"} onClick={() => { const nextMuted = !muted; setMuted(nextMuted); if (audioRef.current) audioRef.current.volume = nextMuted ? 0 : speechVolume; }} disabled={!voiceEnabled} className="rounded-full bg-gray-100 p-3 hover:bg-gray-200 disabled:opacity-50">{muted ? <FaVolumeMute /> : <FaVolumeUp />}</button><button title={interviewPaused ? "Resume interview" : "Pause interview"} onClick={togglePause} disabled={!voiceEnabled || !audioPlaying} className="rounded-full bg-gray-100 p-3 hover:bg-gray-200 disabled:opacity-50">{interviewPaused ? <FaPlay /> : <FaPause />}</button></div></div>
        <div className="grid grid-cols-2 gap-3 text-xs"><label>Speed {speechRate.toFixed(2)}<input value={speechRate} onChange={(event) => setSpeechRate(Number(event.target.value))} min="0.7" max="1.3" step="0.05" type="range" className="mt-2 w-full" /></label><label>Volume<input value={speechVolume} onChange={(event) => { const nextVolume = Number(event.target.value); setSpeechVolume(nextVolume); if (audioRef.current && !muted) audioRef.current.volume = nextVolume; }} min="0" max="1" step="0.1" type="range" className="mt-2 w-full" /></label><p className="col-span-2 rounded-lg border border-gray-200 p-2 text-gray-500">Voice is configured securely through ElevenLabs on the server.</p></div>
      </div></section>
    <section className="p-6 sm:p-10 flex flex-col"><div className="flex justify-between gap-4 text-sm font-medium text-emerald-700 mb-6"><span>Question {questionIndex + 1} of {questions.length}</span><span>{interviewData.role} · {interviewData.mode}</span></div><div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} /></div><div className="mt-6 flex gap-4"><h1 className="flex-1 text-2xl sm:text-3xl font-bold text-gray-900 leading-snug">{question.question}</h1><button onClick={toggleBookmark} title={question.isBookmarked ? "Remove bookmark" : "Bookmark question"} className="h-fit rounded-full bg-gray-100 p-3 text-emerald-700 hover:bg-emerald-100">{question.isBookmarked ? <FaBookmark /> : <FaRegBookmark />}</button></div>{!audioSupported && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">HTML audio is unavailable in this browser. Read the subtitle above and continue with your answer.</p>}{!voiceEnabled ? <button type="button" onClick={enableVoice} disabled={!audioSupported || audioLoading} className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-black px-6 py-3 font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-400"><FaVolumeUp />{audioLoading ? "Initializing interview audio..." : "Enable Interview Audio"}</button> : <div className="mt-6 flex items-center justify-between rounded-2xl bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700"><span className="flex items-center gap-2"><FaVolumeUp />{audioLoading ? "Loading question audio..." : audioCanPlay || audioPlaying ? "Audio Enabled" : "Audio Enabled"}</span><button type="button" onClick={disableVoice} className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs hover:bg-emerald-100">Disable Audio</button></div>}
      <div className="mt-5 flex items-center justify-between gap-3"><p className="text-sm text-gray-500">{recording ? "Recording your answer…" : recognitionSupported ? "Use the microphone or type your answer." : "Speech recognition is unavailable; type your answer."}</p><button onClick={recording ? stop : startRecording} disabled={submitting || !recognitionSupported || interviewPaused} className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${recording ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}><span className={`h-2 w-2 rounded-full ${recording ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />{recording ? "Stop recording" : "Start answering"}</button></div>{recording && <div className="mt-3 flex h-8 items-end gap-1" aria-label="Live audio waveform">{Array.from({ length: 18 }, (_, index) => <span key={index} className="w-1 rounded-full bg-emerald-500 transition-all" style={{ height: `${6 + ((volume + index * 13) % 25)}px` }} />)}</div>}{microphoneError && <p className="mt-3 text-sm text-red-600">{microphoneError}</p>}<textarea value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={submitting || timeLeft === 0 || interviewPaused} placeholder="Your transcribed or typed answer appears here. You can edit it before submitting." className="mt-5 min-h-44 w-full rounded-2xl border border-gray-300 p-4 outline-none focus:ring-2 focus:ring-emerald-500 resize-y" />{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<button onClick={() => submitAnswer()} disabled={submitting || interviewPaused} className="mt-6 w-full rounded-full bg-gray-900 py-3 font-semibold text-white transition hover:bg-emerald-600 disabled:bg-gray-400">{submitting ? "AI is evaluating your answer..." : questionIndex === questions.length - 1 ? "Finish interview" : "Submit and continue"}</button>
    </section>
  </div></div>;
}
export default Step2Interview;
