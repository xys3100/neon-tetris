// --- WEB AUDIO SYNTHESIZER ---
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('neon_tetris_muted') === 'true';
    this.updateIcon();
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  }

  toggle() {
    this.muted = !this.muted;
    localStorage.setItem('neon_tetris_muted', this.muted);
    this.updateIcon();
    
    if (!this.muted) {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.playTone(440, 'sine', 0.1, 0.05);
    }
  }

  updateIcon() {
    const icon = document.getElementById('sound-icon');
    if (!icon) return;
    if (this.muted) {
      icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`;
    } else {
      icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>`;
    }
  }

  playTone(freq, type, duration, volume, slideTo = null) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
      }
      
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio play failed:", e);
    }
  }

  playMove() {
    this.playTone(130, 'triangle', 0.04, 0.12, 60);
  }

  playRotate() {
    this.playTone(220, 'sine', 0.08, 0.12, 380);
  }

  playDrop() {
    this.playTone(90, 'triangle', 0.12, 0.25, 20);
  }

  playHold() {
    this.playTone(280, 'sine', 0.15, 0.12, 580);
  }

  playLineClear(linesCount) {
    const baseFreqs = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    for (let i = 0; i < Math.min(linesCount, 4); i++) {
      setTimeout(() => {
        this.playTone(baseFreqs[i], 'sawtooth', 0.3, 0.08, baseFreqs[i] * 1.5);
      }, i * 65);
    }
  }

  playLevelUp() {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, index) => {
      setTimeout(() => {
        this.playTone(freq, 'square', 0.25, 0.06, freq * 1.05);
      }, index * 90);
    });
  }

  playGameOver() {
    const notes = [392.00, 311.13, 261.63, 196.00]; // G4, Eb4, C4, G3
    notes.forEach((freq, index) => {
      setTimeout(() => {
        this.playTone(freq, 'sawtooth', 0.35, 0.15, freq * 0.6);
      }, index * 170);
    });
  }
}

export const sounds = new SoundManager();
