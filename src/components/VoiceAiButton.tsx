import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import { getProducts } from '../services/storageService';
import {
  isSpeechRecognitionSupported,
  processVoiceTranscriptWithGemini,
  VoiceAiParseResult,
  playMagicChime,
  getGeminiApiKey,
} from '../services/voiceAiService';
import {
  Mic,
  MicOff,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  Volume2,
  Radio,
  Trash2,
  Search,
  Tag,
  CreditCard,
  HandMetal,
} from 'lucide-react';

export interface VoiceAiButtonProps {
  products: Product[];
  onResult: (result: VoiceAiParseResult) => void;
  showToast: (msg: string, type?: 'success' | 'info') => void;
  isActive?: boolean;
  hasCart?: boolean;
}

export const VoiceAiButton: React.FC<VoiceAiButtonProps> = ({
  products,
  onResult,
  showToast,
  isActive = true,
  hasCart = false,
}) => {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isCardOpen, setIsCardOpen] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Nomor 4: Push-to-Talk (PTT) Mode & Audio Level Meter
  const [pttMode, setPttMode] = useState<'toggle' | 'ptt'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mte_voice_mode');
      if (saved === 'ptt' || saved === 'toggle') return saved;
    }
    return 'toggle';
  });
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const recognitionRef = useRef<any>(null);
  const spokenTextRef = useRef<string>('');
  const isManuallyStoppedRef = useRef<boolean>(false);
  const closeTimerRef = useRef<any>(null);

  // Audio Context & Analyser refs untuk level meter
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const isKeyDownHoldingRef = useRef<boolean>(false);

  useEffect(() => {
    setIsSupported(isSpeechRecognitionSupported());
  }, []);

  const handleTogglePttMode = (mode: 'toggle' | 'ptt') => {
    setPttMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mte_voice_mode', mode);
    }
  };

  // Mulai Audio Level Meter dari mic
  const startAudioMeter = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.5;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const loop = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        // Konversi ke persentase 0-100 dengan skala lebih responsif
        const normalized = Math.min(100, Math.round((avg / 75) * 100));
        setAudioLevel(normalized);
        animFrameRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      // Audio level meter opsional
    }
  };

  const stopAudioMeter = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  };

  // Keyboard shortcut F8 & Spacebar (Hold-to-Talk)
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Abaikan jika user sedang mengetik di input form atau modal lain
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea' || (e.target as HTMLElement)?.isContentEditable;

      if (e.key === 'F8') {
        e.preventDefault();
        if (pttMode === 'ptt') {
          if (!isKeyDownHoldingRef.current && !isListening && !isProcessing) {
            isKeyDownHoldingRef.current = true;
            startListening();
          }
        } else {
          if (isListening) {
            stopListening();
          } else if (!isProcessing) {
            startListening();
          }
        }
      } else if (e.code === 'Space' && pttMode === 'ptt' && isCardOpen && !isInput) {
        // Spacebar Hold-to-Talk jika card sedang terbuka dan tidak di input
        e.preventDefault();
        if (!isKeyDownHoldingRef.current && !isListening && !isProcessing) {
          isKeyDownHoldingRef.current = true;
          startListening();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        if (pttMode === 'ptt' && isKeyDownHoldingRef.current) {
          isKeyDownHoldingRef.current = false;
          if (isListening) {
            stopListening();
          }
        }
      } else if (e.code === 'Space' && pttMode === 'ptt' && isCardOpen) {
        if (isKeyDownHoldingRef.current) {
          isKeyDownHoldingRef.current = false;
          if (isListening) {
            stopListening();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isActive, isListening, isProcessing, pttMode, isCardOpen]);

  // Bersihkan resource saat unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      stopAudioMeter();
    };
  }, []);

  const startListening = () => {
    if (!isSupported) {
      setIsCardOpen(true);
      setErrorMessage('Browser ini belum mendukung Web Speech API. Anda dapat mengetik perintah langsung di kotak bawah.');
      return;
    }

    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setTranscript('');
    setInterimText('');
    setErrorMessage(null);
    setLastSummary(null);
    spokenTextRef.current = '';
    isManuallyStoppedRef.current = false;

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.lang = 'id-ID';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setIsCardOpen(true);
        playMagicChime('start');
        startAudioMeter();
      };

      recognition.onresult = (event: any) => {
        let finalStr = '';
        let interimStr = '';

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalStr += res[0].transcript + ' ';
          } else {
            interimStr += res[0].transcript + ' ';
          }
        }

        const total = (finalStr + interimStr).trim();
        spokenTextRef.current = total;
        setTranscript(finalStr.trim());
        setInterimText(interimStr.trim());
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setErrorMessage('Izin mikrofon ditolak. Mohon izinkan akses mikrofon di pengaturan browser Anda.');
          playMagicChime('error');
          stopAudioMeter();
        } else if (event.error === 'no-speech') {
          // Timeout jeda hening wajar di lingkungan ramai
        } else if (event.error !== 'aborted') {
          console.warn('Speech recognition notice:', event.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        stopAudioMeter();
        const fullText = (spokenTextRef.current || transcript || interimText).trim();
        // Jika kasir sudah bicara dan selesai, otomatis proses
        if (fullText && !isProcessing && !isManuallyStoppedRef.current) {
          processTranscript(fullText);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
      stopAudioMeter();
      setErrorMessage('Tidak dapat mengakses mikrofon: ' + (err.message || 'Error'));
    }
  };

  const stopListening = () => {
    isManuallyStoppedRef.current = true;
    stopAudioMeter();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
    const fullText = (spokenTextRef.current || transcript || interimText).trim();
    if (fullText) {
      processTranscript(fullText);
    } else {
      setErrorMessage('Belum ada ucapan yang tertangkap. Anda bisa coba bicara lagi atau ketik di kotak teks bawah.');
    }
  };

  const cancelSession = () => {
    isManuallyStoppedRef.current = true;
    stopAudioMeter();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }
    setIsListening(false);
    setIsProcessing(false);
    setIsCardOpen(false);
    setTranscript('');
    setInterimText('');
    setErrorMessage(null);
  };

  const processTranscript = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setErrorMessage('Belum ada ucapan yang tertangkap. Silakan tekan mic dan sebutkan perintah.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const liveProducts = getProducts().length > 0 ? getProducts() : products;
      const result = await processVoiceTranscriptWithGemini(trimmed, liveProducts);

      // Berhasil jika success dan memiliki data aksi kasir valid
      const hasActionData =
        (result.items && result.items.length > 0) ||
        result.action === 'CLEAR_CART' ||
        result.action === 'REMOVE_ITEM' ||
        result.action === 'CHECK_STOCK' ||
        result.action === 'OPEN_PAYMENT' ||
        result.action === 'FINALIZE_PAYMENT' ||
        result.action === 'RESET_TRANSACTION' ||
        Boolean(result.payment);

      if (result.success && hasActionData) {
        playMagicChime('success');
        setLastSummary(result.summary);
        onResult(result);

        // Auto close setelah 2.4 detik agar kasir sempat melihat feedback visual
        closeTimerRef.current = setTimeout(() => {
          setIsCardOpen(false);
          setLastSummary(null);
          setTranscript('');
          setInterimText('');
        }, 2400);
      } else {
        playMagicChime('error');
        setErrorMessage(
          result.error || 'AI belum berhasil mengenali perintah atau nama barang. Coba ucapkan lebih spesifik.'
        );
      }
    } catch (err: any) {
      playMagicChime('error');
      setErrorMessage('Gagal memproses suara: ' + (err.message || 'Periksa koneksi'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    const text = manualInput.trim();
    setManualInput('');
    setTranscript(text);
    processTranscript(text);
  };

  const currentDisplay = transcript + (interimText ? (transcript ? ' ' : '') + interimText : '');
  const hasGeminiKey = Boolean(getGeminiApiKey());

  return (
    <>
      {/* FLOATING ACTION BUTTON (FAB) DENGAN LIQUID GLASS THEME BLUE */}
      <div className={`voice-fab-container ${hasCart ? 'has-cart' : ''}`}>
        <button
          type="button"
          id="btn-voice-ai-fab"
          className={`voice-fab-btn ${isListening ? 'listening' : ''} ${isProcessing ? 'processing' : ''}`}
          onClick={() => {
            if (pttMode === 'ptt') {
              // Jika di mode PTT dan card belum buka, buka dialog
              if (!isCardOpen) {
                setIsCardOpen(true);
              }
            } else {
              if (isListening) {
                stopListening();
              } else if (!isCardOpen) {
                startListening();
              } else {
                setIsCardOpen(false);
              }
            }
          }}
          onPointerDown={() => {
            if (pttMode === 'ptt' && !isListening && !isProcessing) {
              startListening();
            }
          }}
          onPointerUp={() => {
            if (pttMode === 'ptt' && isListening) {
              stopListening();
            }
          }}
          title={
            isProcessing
              ? 'AI sedang memproses suara...'
              : isListening
              ? 'Mendengarkan ucapan kasir...'
              : pttMode === 'ptt'
              ? 'AI Suara (Tahan untuk Bicara / F8)'
              : 'AI Suara Kasir (F8) - Klik untuk bicara'
          }
          aria-label="AI Suara Kasir"
        >
          {isProcessing ? (
            <Loader2 className="voice-fab-icon spin" size={24} />
          ) : isListening ? (
            <div className="voice-mic-active-wrapper">
              <Mic className="voice-fab-icon mic-pulse" size={24} />
              <span className="voice-ring-pulse" />
              <span className="voice-ring-pulse-2" />
            </div>
          ) : (
            <div className="voice-idle-icon-wrapper">
              <Sparkles className="voice-sparkle-badge" size={13} />
              <Mic className="voice-fab-icon" size={24} />
            </div>
          )}
        </button>

        {/* FLOATING DIALOG CARD SAAT MENDENGARKAN ATAU MEMPROSES */}
        {isCardOpen && (
          <div className="voice-ai-card">
            {/* Header Dialog */}
            <div className="voice-ai-header">
              <div className="voice-ai-title-wrap">
                <div className="voice-ai-glow-icon">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h4 className="voice-ai-title">Kasir Suara AI</h4>
                  <span className="voice-ai-subtitle">
                    {hasGeminiKey ? '⚡ Cerdas & Responsif (Gemini AI)' : 'Mode Offline Cerdas'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="voice-ai-close-btn"
                onClick={cancelSession}
                title="Tutup (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Sub-Header: Mode Selector (Toggle vs Push-to-Talk) */}
            <div className="voice-mode-bar">
              <span className="voice-mode-label">Mode Mic:</span>
              <div className="voice-mode-pills">
                <button
                  type="button"
                  className={`voice-mode-pill ${pttMode === 'toggle' ? 'active' : ''}`}
                  onClick={() => handleTogglePttMode('toggle')}
                  title="Klik mic untuk mulai, klik lagi atau diam untuk selesai"
                >
                  <Radio size={12} />
                  Klik Mulai
                </button>
                <button
                  type="button"
                  className={`voice-mode-pill ${pttMode === 'ptt' ? 'active' : ''}`}
                  onClick={() => handleTogglePttMode('ptt')}
                  title="Tekan & tahan tombol mic / F8 / Space sambil bicara"
                >
                  <HandMetal size={12} />
                  Tahan Bicara (PTT)
                </button>
              </div>
            </div>

            {/* Body: Status, Audio Meter & Live Wave */}
            <div className="voice-ai-body">
              {isListening && (
                <div className="voice-listening-visual">
                  <div className="voice-wave-container">
                    <span className="wave-bar bar-1" />
                    <span className="wave-bar bar-2" />
                    <span className="wave-bar bar-3" />
                    <span className="wave-bar bar-4" />
                    <span className="wave-bar bar-5" />
                  </div>

                  {/* Nomor 4: Real-time Audio Level Meter Bar */}
                  <div className="voice-audio-meter-container" title="Indikator sensitivitas volume mikrofon">
                    <div className="voice-meter-label-wrap">
                      <span className="voice-meter-label">Volume Mic:</span>
                      <span className="voice-meter-status">
                        {audioLevel > 18 ? '🟢 Suara Terdeteksi' : '⚪ Hening / Menunggu'}
                      </span>
                    </div>
                    <div className="voice-meter-track">
                      <div
                        className="voice-meter-fill"
                        style={{
                          width: `${Math.max(6, audioLevel)}%`,
                          background:
                            audioLevel > 65
                              ? 'linear-gradient(90deg, #10b981, #f59e0b, #ef4444)'
                              : audioLevel > 25
                              ? 'linear-gradient(90deg, #38bdf8, #10b981)'
                              : '#94a3b8',
                        }}
                      />
                    </div>
                  </div>

                  <p className="voice-listening-status">
                    {pttMode === 'ptt'
                      ? 'Tahan tombol sambil berbicara...'
                      : 'Silakan sebutkan barang atau perintah kasir...'}
                  </p>
                </div>
              )}

              {isProcessing && (
                <div className="voice-processing-visual">
                  <Loader2 size={32} className="spin voice-proc-spinner" />
                  <p className="voice-proc-status">
                    AI sedang memproses perintah & mencocokkan produk...
                  </p>
                </div>
              )}

              {lastSummary && (
                <div className="voice-success-box">
                  <CheckCircle2 size={20} className="voice-success-icon" />
                  <div>
                    <strong>Berhasil!</strong>
                    <p>{lastSummary}</p>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="voice-error-box">
                  <AlertCircle size={18} className="voice-error-icon" />
                  <p>{errorMessage}</p>
                </div>
              )}

              {/* Teks Suara Realtime */}
              <div className="voice-transcript-bubble">
                {currentDisplay ? (
                  <p className="voice-transcript-text">
                    "{currentDisplay}"
                  </p>
                ) : (
                  <p className="voice-transcript-placeholder">
                    Bicara bebas: <em>"Baut baja 50 biji, pipa rucika 2 batang, bayar uang pas"</em> atau <em>"Cek stok kran onda"</em>
                  </p>
                )}
              </div>

              {/* Action buttons saat di dalam Card */}
              {pttMode === 'ptt' ? (
                <div className="voice-ptt-button-wrap">
                  <button
                    type="button"
                    className={`voice-ptt-hold-btn ${isListening ? 'holding' : ''}`}
                    onPointerDown={startListening}
                    onPointerUp={stopListening}
                    onPointerCancel={stopListening}
                  >
                    <Mic size={18} />
                    {isListening ? 'Lepas untuk Selesai' : 'Tekan & Tahan untuk Bicara'}
                  </button>
                </div>
              ) : (
                isListening && (
                  <div className="voice-card-actions">
                    <button
                      type="button"
                      className="voice-btn-done"
                      onClick={stopListening}
                    >
                      <CheckCircle2 size={16} />
                      Selesai Bicara & Proses
                    </button>
                  </div>
                )
              )}

              {/* Quick Guidance Chips (Paket Kasir Lengkap) */}
              <div className="voice-command-chips">
                <span className="chips-title">Contoh Perintah Kasir:</span>
                <div className="chips-container">
                  <span className="voice-chip chip-add" title="Menambah barang ke struk">
                    + Beli Barang
                  </span>
                  <span className="voice-chip chip-del" title='Contoh: "Hapus pipa" / "Hapus yang tadi"'>
                    <Trash2 size={10} /> Hapus / Batal
                  </span>
                  <span className="voice-chip chip-stock" title='Contoh: "Cek stok kran onda 1/2"'>
                    <Search size={10} /> Cek Stok/Harga
                  </span>
                  <span className="voice-chip chip-nego" title='Contoh: "Beri diskon 5 ribu"'>
                    <Tag size={10} /> Nego/Diskon
                  </span>
                  <span className="voice-chip chip-pay" title='Contoh: "Bayar uang pas" / "Buka bayar"'>
                    <CreditCard size={10} /> Uang Pas / Bayar
                  </span>
                </div>
              </div>

              {/* Form Input Teks Manual (Bila mic bising atau ingin ketik cepat) */}
              <form onSubmit={handleManualSubmit} className="voice-manual-form">
                <input
                  type="text"
                  placeholder="Atau ketik ucapan di sini..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="voice-manual-input"
                  disabled={isProcessing}
                />
                <button
                  type="submit"
                  disabled={!manualInput.trim() || isProcessing}
                  className="voice-manual-send-btn"
                  title="Kirim ke AI"
                >
                  <Send size={15} />
                </button>
              </form>
            </div>

            {/* Quick Tips Footer */}
            <div className="voice-ai-footer">
              <span className="voice-tip-text">
                💡 <strong>Pintasan:</strong> Tekan <strong>F8</strong> untuk mic, atau tahan <strong>Space</strong> di mode PTT.
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
