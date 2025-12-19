
import React, { useState, useEffect, useRef } from 'react';
import { SUBTITLE_SEGMENTS } from './constants';
import { generateSpeechSegment, decodeBase64, decodeAudioBuffer } from './services/geminiService';

const FreudCharacter: React.FC<{ isTalking: boolean; gesture: number }> = ({ isTalking, gesture }) => {
  return (
    <div className="relative w-48 h-64 transform scale-150 origin-bottom transition-transform duration-700">
      {/* Head */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 bg-[#e0ac69] shadow-[inset_-4px_-4px_0px_rgba(0,0,0,0.2)] transition-transform duration-300 ${isTalking ? 'translate-y-[-2px]' : ''}`}>
        <div className="absolute top-0 left-0 w-full h-4 bg-[#d3d3d3]"></div>
        <div className="absolute top-8 left-2 w-8 h-8 border-4 border-black rounded-full"></div>
        <div className="absolute top-8 right-2 w-8 h-8 border-4 border-black rounded-full"></div>
        <div className="absolute top-11 left-10 w-4 h-1 bg-black"></div>
        <div className="absolute bottom-0 left-0 w-full h-10 bg-[#cfcfcf] flex flex-wrap p-1">
           {[...Array(12)].map((_, i) => (
             <div key={i} className="w-2 h-2 bg-white/50 m-0.5"></div>
           ))}
        </div>
        <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-4 bg-[#8b0000] transition-all duration-100 ${isTalking ? 'h-3' : 'h-1 opacity-50'}`}></div>
      </div>

      {/* Body */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 w-32 h-40 bg-[#5d4037] shadow-[inset_-6px_-6px_0px_rgba(0,0,0,0.3)]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-full bg-[#fff] flex flex-col items-center">
           <div className="w-2 h-4 bg-black mt-2"></div>
        </div>
        <div className="absolute top-12 left-1/2 -translate-x-1/2 flex flex-col gap-4">
           <div className="w-2 h-2 bg-black/40"></div>
           <div className="w-2 h-2 bg-black/40"></div>
        </div>
      </div>

      {/* Arms */}
      <div className={`absolute top-28 -left-4 w-10 h-24 bg-[#4e342e] origin-top transition-transform duration-500 ${gesture === 1 ? 'rotate-[-45deg]' : 'rotate-[-5deg]'}`}></div>
      <div className={`absolute top-28 -right-4 w-10 h-24 bg-[#4e342e] origin-top transition-transform duration-700 ${gesture === 2 ? 'rotate-[45deg]' : 'rotate-[5deg]'}`}></div>
    </div>
  );
};

const App: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSubtitleIndex, setCurrentSubtitleIndex] = useState(0);
  const [mouthJiggle, setMouthJiggle] = useState(false);
  const [gesture, setGesture] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setMouthJiggle(prev => !prev);
        if (Math.random() > 0.8) setGesture(Math.floor(Math.random() * 3));
      }, 150);
      return () => clearInterval(interval);
    } else {
      setMouthJiggle(false);
      setGesture(0);
    }
  }, [isPlaying]);

  const playSegment = async (index: number) => {
    if (!isPlayingRef.current) return;
    if (index >= SUBTITLE_SEGMENTS.length) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      return;
    }

    setCurrentSubtitleIndex(index);
    try {
      const base64Audio = await generateSpeechSegment(SUBTITLE_SEGMENTS[index]);
      if (!base64Audio) throw new Error("Audio generation failed for segment " + index);

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

      const audioBytes = decodeBase64(base64Audio);
      const audioBuffer = await decodeAudioBuffer(audioBytes, audioContextRef.current);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        // Move to next segment automatically
        playSegment(index + 1);
      };

      sourceNodeRef.current = source;
      source.start(0);
    } catch (err: any) {
      console.error(err);
      setError("Segment Error: " + (err.message || "Unknown error during playback."));
      setIsPlaying(false);
      isPlayingRef.current = false;
    }
  };

  const startLecture = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Step 1: Handle API Key Selection (Mandatory for Gemini 2.5 series)
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio.openSelectKey();
      }

      setIsPlaying(true);
      isPlayingRef.current = true;
      setIsLoading(false);
      
      // Start sequential playback starting from segment 0
      await playSegment(0);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Initialization failed. Please check your connection.");
      setIsLoading(false);
    }
  };

  const stopLecture = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
    }
    setIsPlaying(false);
    isPlayingRef.current = false;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#1a1a1a]">
      <header className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-[#FFD700] mb-2 drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          VOXEL FREUD LIVE
        </h1>
        <p className="text-xl text-gray-400">Chinese Psychoanalysis Lecture</p>
      </header>

      <div className="w-full max-w-4xl mc-container p-2 relative">
        <div className="aspect-video bg-[#0c0c0c] flex items-center justify-center overflow-hidden pixel-border relative">
          
          {/* Audience Perspective Shadows */}
          <div className="absolute inset-0 flex flex-col items-center justify-end pointer-events-none opacity-40">
             <div className="w-full h-1/2 flex gap-4 px-10">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex-1 bg-[#222] h-full shadow-[inset_0px_10px_0px_black]"></div>
                ))}
             </div>
          </div>

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.1)_0%,transparent_60%)] pointer-events-none"></div>

          {/* The Wooden Stage */}
          <div className="absolute bottom-0 w-full h-16 bg-[#5d4037] shadow-[0_-8px_0px_rgba(0,0,0,0.5)] flex justify-center">
             <div className="w-32 h-24 bg-[#3e2723] absolute -top-16 border-x-4 border-t-4 border-black/50 z-20">
                <div className="w-full h-2 bg-[#d3d3d3] mt-2 opacity-20"></div>
             </div>
          </div>

          {/* Voxel Freud */}
          <div className={`z-10 transition-transform duration-1000 ${isPlaying ? 'scale-110 -translate-y-4' : 'scale-100'}`}>
            <FreudCharacter isTalking={isPlaying && mouthJiggle} gesture={gesture} />
          </div>

          {!isPlaying && !isLoading && (
            <div className="absolute inset-0 bg-black/40 z-30 flex items-center justify-center">
               <button 
                onClick={startLecture}
                className="mc-button px-12 py-6 text-4xl text-white font-bold hover:bg-[#9b9b9b] active:translate-y-1"
               >
                 START LECTURE (AI VOICE)
               </button>
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 bg-black/40 z-30 flex items-center justify-center">
               <div className="text-center">
                 <div className="w-12 h-12 border-4 border-t-[#FFD700] border-gray-600 rounded-full animate-spin mx-auto mb-4"></div>
                 <p className="text-xl font-bold">PREPARING AUDIENCE...</p>
               </div>
            </div>
          )}

          {isPlaying && (
            <div className="absolute bottom-20 left-0 right-0 px-12 z-40">
              <div className="bg-black/80 p-6 rounded-sm border-2 border-[#FFD700]/30 backdrop-blur-md animate-subtitle">
                <p className="text-2xl md:text-3xl text-[#FFD700] text-center leading-relaxed font-bold tracking-wide drop-shadow-lg">
                  {SUBTITLE_SEGMENTS[currentSubtitleIndex]}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute top-10 bg-red-600 p-4 border-2 border-black text-white font-bold z-50 max-w-md text-center mx-4">
              <p>SYSTEM FAULT: {error}</p>
              <button onClick={() => (window as any).aistudio.openSelectKey()} className="mt-2 block underline mx-auto">Update API Key</button>
            </div>
          )}

          {isPlaying && (
            <button 
              onClick={stopLecture}
              className="absolute top-4 right-4 mc-button px-4 py-2 text-white font-bold z-50 text-sm"
            >
              STOP
            </button>
          )}
        </div>
      </div>

      <footer className="mt-8 max-w-2xl w-full grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#333] p-4 pixel-border">
          <h2 className="text-[#FFD700] text-lg mb-2 font-bold uppercase underline">Engine</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            API: Gemini 2.5 Flash TTS<br/>
            Language: Chinese (Mandarin)<br/>
            Voice: Prebuilt 'Kore' (Deep Scholarly)
          </p>
        </div>
        <div className="bg-[#333] p-4 pixel-border">
          <h2 className="text-[#FFD700] text-lg mb-2 font-bold uppercase underline">Troubleshoot</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            If audio doesn't play, ensure you've selected a paid API key and that your volume is up.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
