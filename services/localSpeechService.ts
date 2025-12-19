
export interface SpeechOptions {
  onBoundary?: (charIndex: number) => void;
  onEnd?: () => void;
  onStart?: () => void;
}

export class LocalSpeechService {
  private synth: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  private getBestVoice(): SpeechSynthesisVoice | null {
    const voices = this.synth.getVoices();
    // Prefer mature sounding voices if available
    const preferred = voices.find(v => 
      v.name.includes('Daniel') || 
      v.name.includes('Alex') || 
      v.name.includes('Tingting') || // Good for Chinese if text is Chinese
      v.lang.startsWith('zh')
    );
    return preferred || voices[0];
  }

  public speak(text: string, options: SpeechOptions) {
    this.cancel();

    this.currentUtterance = new SpeechSynthesisUtterance(text);
    const voice = this.getBestVoice();
    if (voice) this.currentUtterance.voice = voice;

    // Adjust rate for a scholarly feel
    this.currentUtterance.rate = 0.9; 
    this.currentUtterance.pitch = 1.0;

    this.currentUtterance.onboundary = (event) => {
      if (options.onBoundary) options.onBoundary(event.charIndex);
    };

    this.currentUtterance.onend = () => {
      if (options.onEnd) options.onEnd();
    };

    this.currentUtterance.onstart = () => {
      if (options.onStart) options.onStart();
    };

    this.synth.speak(this.currentUtterance);
  }

  public cancel() {
    this.synth.cancel();
    this.currentUtterance = null;
  }

  public isSpeaking(): boolean {
    return this.synth.speaking;
  }
}

export const localSpeech = new LocalSpeechService();
