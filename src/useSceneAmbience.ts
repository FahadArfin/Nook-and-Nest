import { useEffect, useRef, useState } from 'react';
import type { AtmosphereFrame } from './sceneAtmosphere';

/** Replaces the existing App tone effect. Enabled is session-only, explicit user intent. */
export function useSceneAmbience(enabled: boolean, frame: AtmosphereFrame | null): string | undefined {
  const [error, setError] = useState<string>();
  const rainGain = useRef<GainNode | undefined>(undefined);
  const currentRain = useRef(frame?.rain ?? 0); currentRain.current = frame?.rain ?? 0;
  useEffect(() => {
    if (rainGain.current) rainGain.current.gain.value = currentRain.current * .007;
  }, [frame?.rain]);
  useEffect(() => {
    if (!enabled) { setError(undefined); return; }
    let context: AudioContext | undefined, stopped = false;
    const sources: (OscillatorNode | AudioBufferSourceNode)[] = [];
    const quietError = () => { if (!stopped) setError('Sound could not start. Turn sound off and on to try again.'); };
    const visibility = () => {
      if (!context || context.state === 'closed') return;
      const action = document.hidden ? context.suspend() : context.resume(); void action.catch(quietError);
    };
    try {
      if (!window.AudioContext) { quietError(); return; }
      context = new window.AudioContext(); setError(undefined);
      const gain = context.createGain(); gain.gain.value = .012; gain.connect(context.destination);
      [174, 220].forEach((frequency, index) => {
        const oscillator = context!.createOscillator(), tone = context!.createGain();
        oscillator.type = index ? 'sine' : 'triangle'; oscillator.frequency.value = frequency;
        tone.gain.value = index ? .3 : .18; oscillator.connect(tone).connect(gain); oscillator.start(); sources.push(oscillator);
      });
      // Reused two-second noise buffer: no fetch, streaming, timer or frame-dependent allocation.
      const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate), samples = buffer.getChannelData(0);
      let seed = 17;
      for (let i = 0; i < samples.length; i++) { seed = (seed * 16807) % 2147483647; samples[i] = seed / 1073741823.5 - 1; }
      const noise = context.createBufferSource(), filter = context.createBiquadFilter(), rain = context.createGain();
      filter.type = 'lowpass'; filter.frequency.value = 1200;
      rain.gain.value = currentRain.current * .007; rainGain.current = rain;
      noise.buffer = buffer; noise.loop = true; noise.connect(filter).connect(rain).connect(context.destination); noise.start(); sources.push(noise);
      document.addEventListener('visibilitychange', visibility); visibility();
    } catch { quietError(); }
    return () => {
      stopped = true; document.removeEventListener('visibilitychange', visibility); rainGain.current = undefined;
      for (const source of sources) { try { source.stop(); } catch { /* Already stopped during shutdown. */ } source.disconnect(); }
      if (context && context.state !== 'closed') void context.close().catch(() => {});
    };
  }, [enabled]);
  return error;
}
