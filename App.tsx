
import React, { useState, useEffect, useRef } from 'react';
import { SUBTITLE_SEGMENTS, FREUD_LECTURE_TEXT } from './constants';
import { generateSpeech, decodeBase64, decodeAudioBuffer } from './services/geminiService';

const FreudCharacter: React.FC<{ isTalking: boolean }> = ({ isTalking }) => {
  return (
    <div className="relative w-48 h-64 transform scale-150 origin-bottom">
      {/* Head */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 bg-[#e0ac69] shadow-[inset_-4px_-4px_0px_rgba(0,0,0,0.2)]">
        {/* Hair/Top */}
        <div className="absolute top-0 left-0 w-full h-4 bg-[#d3d3d3]"></div>
        
        {/* Glasses */}
        <div className="absolute top-8 left-2 w-8 h-8 border-4 border-black rounded-full"></div>
        <div className="absolute top-8 right-2 w-8 h-8 border-4 border-black rounded-full"></div>
        <div className="absolute top-11 left-10 w-4 h-1 bg-black"></div>

        {/* Beard */}
        <div className="absolute bottom-0 left-0 w-full h-10 bg-[#cfcfcf] flex flex-wrap p-1">
           {[...Array(12)].map((_, i) => (
             <div key={i} className="w-2 h-2 bg-white/50 m-0.5"></div>
           ))}
        </div>

        {/* Mouth */}
        <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-4 bg-[#8b0000] transition-all duration-100 ${isTalking ? 'h-3' : 'h-1 opacity-50'}`}></div>
      </div>

      {/* Body */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 w-32 h-40 bg-[#5d4037] shadow-[inset_-6px_-6px_0px_rgba(0,0,0,0.3)]">
        {/* Shirt/Tie Area */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-full bg-[#fff] flex flex-col items-center">
           <div className="w-2 h-4 bg-black mt-2"></div> {/* Tie */}
        </div>
        {/* Suit Buttons */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 flex flex-col gap-4">
           <div className="w-2 h-2 bg-black/40"></div>
           <div className="w-2 h-2 bg-black/40"></div>
        </div>
      </div>

      {/* Arms */}
      <div className={`absolute top-28 -left-4 w-10 h-24 bg-[#4e342e] origin-top transition-transform duration-500 ${isTalking ? 'rotate-[-20deg]' : 'rotate-0'}`}></div>
      <div className={`absolute top-28 -right-4 w-10 h-24 bg-[#4e342e] origin-top transition-transform duration-700 ${isTalking ? 'rotate-[15deg]' : 'rotate-0'}`}></div>
    </div>
  );
};

const App: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSubtitleIndex, setCurrentSubtitleIndex] = useState(0);
  const [mouthJiggle, setMouthJiggle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const subtitleIntervalRef = useRef<any>(null);

  useEffect(() => {
    let mouthInterval: any;
    if (isPlaying) {
      mouthInterval = setInterval(() => {
        setMouthJiggle(prev => !prev);
      }, 150 + Math.random() * 100);
      return () => clearInterval(mouthInterval);
    } else {
      setMouthJiggle(false);
    }
  }, [isPlaying]);

  const startLecture = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Step 1: Ensure API Key Selection (Mandatory for Gemini 2.5 series in some environments)
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio.openSelectKey();
        // Assuming key selection was successful to proceed
      }

      // Step 2: Generate Audio
      const base64Audio = await generateSpeech(FREUD_LECTURE_TEXT);
      if (!base64Audio) {
        throw new Error("Empty audio response from server.");
      }

      // Step 3: Audio Setup
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const audioBytes = decodeBase64(base64Audio);
      const audioBuffer = await decodeAudioBuffer(audioBytes, audioContextRef.current);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        setIsPlaying(false);
        setCurrentSubtitleIndex(0);
        if (subtitleIntervalRef.current) {
          clearInterval(subtitleIntervalRef.current);
          subtitleIntervalRef.current = null;
        }
      };

      sourceNodeRef.current = source;
      source.start(0);
      setIsPlaying(true);
      setIsLoading(false);

      // Subtitle Sync Logic
      const segmentDurationMs = (audioBuffer.duration / SUBTITLE_SEGMENTS.length) * 1000;
      if (subtitleIntervalRef.current) clearInterval(subtitleIntervalRef.current);
      
      subtitleIntervalRef.current = setInterval(() => {
        setCurrentSubtitleIndex(prev => {
          if (prev >= SUBTITLE_SEGMENTS.length - 1) {
            if (subtitleIntervalRef.current) {
              clearInterval(subtitleIntervalRef.current);
              subtitleIntervalRef.current = null;
            }
            return prev;
          }
          return prev + 1;
        });
      }, segmentDurationMs);

    } catch (err: any) {
      console.error("Lecture Audio Error:", err);
      
      // Handle key selection requirement if reported by API
      if (err.message?.includes("Requested entity was not found") || err.message?.includes("Rpc failed")) {
        setError("API Connection Issue. Please ensure you have selected a valid API key with billing enabled.");
        // Prompt for key selection again as a fallback
        await (window as any).aistudio.openSelectKey();
      } else {
        setError(err.message || "An unexpected audio error occurred.");
      }
      setIsLoading(false);
    }
  };

  const stopLecture = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) {}
    }
    if (subtitleIntervalRef.current) {
      clearInterval(subtitleIntervalRef.current);
      subtitleIntervalRef.current = null;
    }
    setIsPlaying(false);
    setCurrentSubtitleIndex(0);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#1a1a1a]">
      <header className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-[#FFD700] mb-2 drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          VOXEL FREUD LIVE
        </h1>
        <p className="text-xl text-gray-400">Cinematic Psychoanalysis Lecture</p>
      </header>

      <div className="w-full max-w-4xl mc-container p-2 relative">
        <div className="aspect-video bg-[#0c0c0c] flex items-center justify-center overflow-hidden pixel-border relative">
          
          <div className="absolute inset-0 flex flex-col items-center justify-end pointer-events-none opacity-40">
             <div className="w-full h-1/2 flex gap-4 px-10">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex-1 bg-[#222] h-full shadow-[inset_0px_10px_0px_black]"></div>
                ))}
             </div>
          </div>

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.1)_0%,transparent_60%)] pointer-events-none"></div>

          <div className="absolute bottom-0 w-full h-16 bg-[#5d4037] shadow-[0_-8px_0px_rgba(0,0,0,0.5)] flex justify-center">
             <div className="w-32 h-24 bg-[#3e2723] absolute -top-16 border-x-4 border-t-4 border-black/50 z-20">
                <div className="w-full h-2 bg-[#d3d3d3] mt-2 opacity-20"></div>
             </div>
          </div>

          <div className={`z-10 transition-transform duration-1000 ${isPlaying ? 'scale-110 -translate-y-4' : 'scale-100'}`}>
            <FreudCharacter isTalking={isPlaying && mouthJiggle} />
          </div>

          {!isPlaying && (
            <div className="absolute inset-0 bg-black/40 z-30 flex items-center justify-center">
               {isLoading ? (
                 <div className="flex flex-col items-center">
                   <div className="w-16 h-16 border-8 border-t-[#FFD700] border-gray-700 rounded-full animate-spin mb-4"></div>
                   <p className="text-2xl text-white font-bold tracking-widest">CONNECTING TO LECTURE...</p>
                 </div>
               ) : (
                 <button 
                  onClick={startLecture}
                  className="mc-button px-12 py-6 text-4xl text-white font-bold hover:bg-[#9b9b9b] active:translate-y-1"
                 >
                   START LECTURE
                 </button>
               )}
            </div>
          )}

          {isPlaying && (
            <div className="absolute bottom-20 left-0 right-0 px-12 z-40">
              <div className="bg-black/70 p-6 rounded-sm border-2 border-white/10 backdrop-blur-md animate-subtitle">
                <p className="text-2xl md:text-3xl text-[#FFD700] text-center leading-relaxed font-bold tracking-wide">
                  {SUBTITLE_SEGMENTS[currentSubtitleIndex]}
                </p>
              </div>
            </div>
          )}

          {error && !isLoading && !isPlaying && (
            <div className="absolute top-10 bg-red-600/90 p-4 border-2 border-black text-white font-bold z-50 max-w-lg text-center mx-4">
              <p>SYSTEM FAULT: {error}</p>
              <button 
                onClick={() => (window as any).aistudio.openSelectKey()}
                className="mt-2 underline text-sm"
              >
                Switch API Key
              </button>
            </div>
          )}

          {isPlaying && (
            <button 
              onClick={stopLecture}
              className="absolute top-4 right-4 mc-button px-4 py-2 text-white font-bold z-50 text-sm"
            >
              STOP LECTURE
            </button>
          )}
        </div>
      </div>

      <footer className="mt-8 max-w-2xl w-full grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#333] p-4 pixel-border">
          <h2 className="text-[#FFD700] text-lg mb-2 font-bold uppercase underline">Current Session</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            Lecture: "A General Introduction to Psychoanalysis"<br/>
            Speaker: Sigmund Freud (Voxelized)<br/>
            Voice: Gemini 2.5 TTS
          </p>
        </div>
        <div className="bg-[#333] p-4 pixel-border">
          <h2 className="text-[#FFD700] text-lg mb-2 font-bold uppercase underline">Note</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            If audio fails to load, ensure your selected API key is from a paid GCP project.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
