import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  AlertCircle,
  RefreshCw,
  FileText,
  Volume2
} from 'lucide-react';
import { api } from '../../services/api';
import type { EventExtractResponse } from '../../types/api';

export type RecorderState =
  | 'IDLE'
  | 'RECORDING'
  | 'RECORDED'
  | 'UPLOADING'
  | 'TRANSCRIBING'
  | 'EXTRACTING'
  | 'ERROR';

interface AudioRecorderProps {
  assetId: string;
  onExtractionSuccess: (response: EventExtractResponse) => void;
  onSwitchToText?: () => void;
  disabled?: boolean;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  assetId,
  onExtractionSuccess,
  onSwitchToText,
  disabled = false,
}) => {
  const [recorderState, setRecorderState] = useState<RecorderState>('IDLE');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [isBrowserSupported, setIsBrowserSupported] = useState(true);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // References
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Check browser support on mount
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      !!navigator.mediaDevices.getUserMedia &&
      typeof window.MediaRecorder !== 'undefined';
    setIsBrowserSupported(supported);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, []);

  const cleanupResources = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {
        // Ignored
      }
      audioContextRef.current = null;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/wav',
    ];
    for (const t of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return 'audio/webm';
  };

  // Start recording
  const startRecording = async () => {
    setErrorMessage(null);

    if (!isBrowserSupported) {
      setErrorMessage(
        "Voice recording isn't supported in this browser. Please enter the report as text."
      );
      setRecorderState('ERROR');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // Setup audio level visualizer
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateAudioLevel = () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
              animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
            }
          };
          updateAudioLevel();
        }
      } catch {
        // Visualizer is optional
      }

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        if (blob.size === 0) {
          setErrorMessage('Recorded audio was empty. Please check your microphone and try again.');
          setRecorderState('ERROR');
          return;
        }

        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setRecorderState('RECORDED');
      };

      recorder.start(250); // Collect data every 250ms
      setRecorderState('RECORDING');
      setRecordingDuration(0);

      const startTime = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 250);
    } catch (err: any) {
      cleanupResources();
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage(
          'Microphone permission was denied. Please allow microphone access in your browser settings to record voice observations.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No microphone detected on your system. Please connect an audio input device.');
      } else {
        setErrorMessage(err?.message || 'Failed to start recording. Please verify audio input settings.');
      }
      setRecorderState('ERROR');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioLevel(0);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignored
      }
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {
        // Ignored
      }
      audioContextRef.current = null;
    }
  };

  // Discard and reset
  const handleDiscard = () => {
    cleanupResources();
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setAudioBlob(null);
    setRecordingDuration(0);
    setAudioCurrentTime(0);
    setIsPlaying(false);
    setErrorMessage(null);
    setProcessingStage('');
    setRecorderState('IDLE');
  };

  // Audio playback toggle
  const togglePlayAudio = () => {
    if (!audioUrl) return;

    if (!audioPlayerRef.current) {
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        setAudioCurrentTime(0);
      };

      audio.ontimeupdate = () => {
        setAudioCurrentTime(audio.currentTime);
      };
    }

    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  // Submit audio for extraction
  const handleSubmitAudio = async () => {
    if (!audioBlob || audioBlob.size === 0) {
      setErrorMessage('No audio recorded. Please record your observation first.');
      setRecorderState('ERROR');
      return;
    }

    if (!assetId.trim()) {
      setErrorMessage('Please select a target asset before submitting the voice report.');
      setRecorderState('ERROR');
      return;
    }

    setErrorMessage(null);
    setRecorderState('UPLOADING');
    setProcessingStage('Uploading audio...');

    try {
      // Small simulated progressive stage cues for pleasant UX feedback
      const timer1 = setTimeout(() => {
        setRecorderState('TRANSCRIBING');
        setProcessingStage('Transcribing voice observation...');
      }, 700);

      const timer2 = setTimeout(() => {
        setRecorderState('EXTRACTING');
        setProcessingStage('Understanding safety report & normalizing fields...');
      }, 1600);

      const response = await api.extractEventFromAudio(
        audioBlob,
        'voice_observation.webm',
        assetId
      );

      clearTimeout(timer1);
      clearTimeout(timer2);

      // On successful extraction, pass response to parent review flow
      onExtractionSuccess(response);
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          'Failed to transcribe or extract event from audio. You can retry or switch to text input.'
      );
      setRecorderState('ERROR');
    }
  };

  const isProcessing =
    recorderState === 'UPLOADING' ||
    recorderState === 'TRANSCRIBING' ||
    recorderState === 'EXTRACTING';

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-5 space-y-4">
      {/* Header & Supported Languages Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Mic className="w-3.5 h-3.5 text-orange-600" />
            Voice Observation Ingestion
          </span>
          <p className="text-xs text-slate-500 mt-0.5 font-sans">
            Speak your observation naturally. The system will transcribe and normalize safety fields.
          </p>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 self-start sm:self-center">
          English • தமிழ் • हिन्दी • Tanglish • Hinglish
        </span>
      </div>

      {/* STATE 1: IDLE */}
      {recorderState === 'IDLE' && (
        <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled || !isBrowserSupported}
            className="w-20 h-20 rounded-full bg-slate-900 hover:bg-slate-800 active:scale-95 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer group"
            title="Start voice recording"
          >
            <Mic className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
          </button>

          <div className="space-y-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800 block">
              Tap to Record Voice
            </span>
            <p className="text-xs text-slate-500 font-sans max-w-sm">
              Press the button and describe what you observed, felt, or inspected on asset{' '}
              <span className="font-mono font-bold text-slate-700">{assetId || 'selected asset'}</span>.
            </p>
          </div>
        </div>
      )}

      {/* STATE 2: RECORDING */}
      {recorderState === 'RECORDING' && (
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-5">
          {/* Live Recording Badge & Timer */}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-mono font-bold tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
              Recording
            </span>
            <span className="font-mono text-2xl font-bold text-slate-900">
              {formatTime(recordingDuration)}
            </span>
          </div>

          {/* Sound Activity Visualizer Bars */}
          <div className="flex items-center justify-center gap-1.5 h-10 w-full max-w-xs px-4">
            {[...Array(16)].map((_, i) => {
              const heightMultiplier = Math.sin((i + 1) * 0.4) * 0.5 + 0.5;
              const barHeight = Math.max(
                4,
                Math.min(36, Math.round(audioLevel * heightMultiplier * 0.4 + 4))
              );
              return (
                <div
                  key={i}
                  className="w-1.5 rounded-full bg-orange-500 transition-all duration-75"
                  style={{ height: `${barHeight}px` }}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-red-600 hover:bg-red-700 text-white font-mono text-xs font-bold uppercase tracking-wider shadow transition-all cursor-pointer"
            >
              <Square className="w-4 h-4 fill-white" />
              Stop Recording
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              className="text-xs text-slate-500 hover:text-slate-800 px-3 py-2 rounded hover:bg-slate-200/50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* STATE 3: RECORDED (Playback & Confirmation) */}
      {recorderState === 'RECORDED' && (
        <div className="space-y-4 py-2">
          {/* Audio Review Card */}
          <div className="rounded border border-slate-200 bg-white p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={togglePlayAudio}
                className="w-10 h-10 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer"
                title={isPlaying ? 'Pause audio' : 'Play audio preview'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <div>
                <span className="text-xs font-mono font-bold uppercase text-slate-900 block">
                  Voice Observation Recorded
                </span>
                <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <Volume2 className="w-3 h-3 text-slate-400" />
                  {formatTime(audioCurrentTime)} / {formatTime(recordingDuration)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleDiscard}
                className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-3 py-2 rounded border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Record Again
              </button>

              <button
                type="button"
                onClick={handleSubmitAudio}
                className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded bg-slate-900 hover:bg-slate-800 text-white shadow transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Understand Voice Report
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 font-sans text-center">
            Review the audio recording above before processing. The extracted structured event will be
            presented for your verification before any data is saved.
          </p>
        </div>
      )}

      {/* STATE 4: PROCESSING (UPLOADING / TRANSCRIBING / EXTRACTING) */}
      {isProcessing && (
        <div className="py-10 flex flex-col items-center justify-center text-center space-y-4">
          <div className="relative flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-slate-900 animate-spin" />
            <Mic className="w-4 h-4 text-orange-600 absolute" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 block">
              {processingStage || 'Processing Voice Report...'}
            </span>
            <p className="text-xs text-slate-500 font-sans max-w-sm">
              Converting speech to text, identifying language, and mapping evidence onto PREVENT's
              canonical safety schema.
            </p>
          </div>

          {/* Sequential Phase Steps */}
          <div className="flex items-center gap-2 pt-2 text-[11px] font-mono">
            <span
              className={`px-2 py-0.5 rounded border ${
                recorderState === 'UPLOADING'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              1. Upload
            </span>
            <span className="text-slate-300">→</span>
            <span
              className={`px-2 py-0.5 rounded border ${
                recorderState === 'TRANSCRIBING'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              2. Transcribe
            </span>
            <span className="text-slate-300">→</span>
            <span
              className={`px-2 py-0.5 rounded border ${
                recorderState === 'EXTRACTING'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              3. Understand
            </span>
          </div>
        </div>
      )}

      {/* STATE 5: ERROR */}
      {recorderState === 'ERROR' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
          <div className="flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-1">
              <span className="font-bold uppercase tracking-wide block">
                Recording or Ingestion Issue
              </span>
              <p className="text-xs text-red-800 leading-relaxed">
                {errorMessage || 'An error occurred during voice ingestion.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-red-200/60">
            <button
              type="button"
              onClick={handleDiscard}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Try Recording Again
            </button>

            {onSwitchToText && (
              <button
                type="button"
                onClick={onSwitchToText}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
              >
                <FileText className="w-3 h-3" />
                Switch to Text Report
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
