
import { GoogleGenAI, Modality } from "@google/genai";

/**
 * Generates speech audio for the lecture text using Gemini TTS.
 * @param text The lecture content to be converted to speech.
 * @returns Base64 encoded raw PCM audio data.
 */
export async function generateSpeech(text: string): Promise<string | undefined> {
  // Always create a new instance right before use to ensure the latest API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio;
  } catch (error) {
    console.error("Internal Gemini TTS Error:", error);
    throw error;
  }
}

/**
 * Manually decodes a base64 string into a Uint8Array.
 */
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio data (S16_LE) into an AudioBuffer.
 */
export async function decodeAudioBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const length = Math.floor(data.byteLength / 2);
  const dataInt16 = new Int16Array(length);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  
  for (let i = 0; i < length; i++) {
    dataInt16[i] = view.getInt16(i * 2, true);
  }

  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
