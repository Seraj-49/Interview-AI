import axios from "axios";
import crypto from "crypto";

const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 50;
const audioCache = new Map();
const inFlightRequests = new Map();

const getCacheKey = (text) => crypto.createHash("sha256").update(`${process.env.ELEVENLABS_VOICE_ID}|${process.env.ELEVENLABS_MODEL_ID}|${text}`).digest("hex");
const storeCachedAudio = (key, audio) => {
    audioCache.set(key, { audio, createdAt: Date.now() });
    while (audioCache.size > MAX_CACHE_ENTRIES) audioCache.delete(audioCache.keys().next().value);
};
const providerErrorMessage = (error) => {
    const data = error.response?.data;
    if (Buffer.isBuffer(data)) {
        try { const parsed = JSON.parse(data.toString("utf8")); return parsed.detail?.message || parsed.detail || parsed.message || data.toString("utf8").slice(0, 300); } catch { return data.toString("utf8").slice(0, 300); }
    }
    return data?.detail?.message || data?.detail || data?.message || error.message;
};

const requestElevenLabsAudio = async (text) => {
    const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(process.env.ELEVENLABS_VOICE_ID)}?output_format=mp3_44100_128`,
        { text: text.slice(0, 5000), model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } },
        { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" }, responseType: "arraybuffer" }
    );
    const audio = Buffer.from(response.data);
    const contentType = response.headers["content-type"] || "audio/mpeg";
    if (!audio.length || !contentType.startsWith("audio/")) throw new Error("ElevenLabs returned an invalid audio response.");
    console.info("[TTS:ElevenLabs] API success", { contentType, byteLength: audio.length });
    return { audio, contentType: "audio/mpeg" };
};

export const generateQuestionAudio = async ({ text }) => {
    if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID || !process.env.ELEVENLABS_MODEL_ID) {
        const error = new Error("ElevenLabs TTS is not configured.");
        error.status = 503;
        throw error;
    }
    if (!text?.trim()) {
        const error = new Error("Question text is required for speech generation.");
        error.status = 400;
        throw error;
    }
    const key = getCacheKey(text);
    const cached = audioCache.get(key);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
        console.info("[TTS:ElevenLabs] cache hit", { textLength: text.length, byteLength: cached.audio.length });
        return { audio: cached.audio, contentType: "audio/mpeg" };
    }
    audioCache.delete(key);
    if (inFlightRequests.has(key)) {
        console.info("[TTS:ElevenLabs] joining in-flight request", { textLength: text.length });
        return inFlightRequests.get(key);
    }
    console.info("[TTS:ElevenLabs] request started", { textLength: text.length, modelIdConfigured: Boolean(process.env.ELEVENLABS_MODEL_ID), voiceIdConfigured: Boolean(process.env.ELEVENLABS_VOICE_ID) });
    const request = requestElevenLabsAudio(text)
        .then((result) => { storeCachedAudio(key, result.audio); return result; })
        .catch((error) => {
            const message = providerErrorMessage(error);
            console.error("[TTS:ElevenLabs] API failure", { status: error.response?.status, code: error.code, message });
            const providerError = new Error(`ElevenLabs TTS failed: ${message}`);
            providerError.status = error.response?.status || 502;
            throw providerError;
        })
        .finally(() => inFlightRequests.delete(key));
    inFlightRequests.set(key, request);
    return request;
};
