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
  Flame,
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

  const recognitionRef = useRef<any>(null);
  const spokenTextRef = useRef<string>('');
  const isManuallyStoppedRef = useRef<boolean>(false);
  const closeTimerRef = useRef<any>(null);

  useEffect(() => {
    setIsSupported(isSpeechRecognitionSupported());
  }, []);

  // Keyboard shortcut F8 untuk mulai/berhenti bicara
  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        if (isListening) {
          stopListening();
        } else if (!isProcessing) {
          startListening();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, isListening, isProcessing]);

  // Bersihkan speech recognition saat unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
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
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMessage('Izin mikrofon ditolak. Mohon izinkan akses mikrofon di pengaturan browser Anda.');
          playMagicChime('error');
        } else if (event.error === 'no-speech') {
          // Hanya timeout suara, tidak perlu error fatal
        } else if (event.error !== 'aborted') {
          setErrorMessage(`Terjadi kendala mic (${event.error}). Silakan coba lagi.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
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
      setErrorMessage('Tidak dapat mengakses mikrofon: ' + (err.message || 'Error'));
    }
  };

  const stopListening = () => {
    isManuallyStoppedRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    const fullText = (spokenTextRef.current || transcript || interimText).trim();
    if (fullText) {
      processTranscript(fullText);
    } else {
      setErrorMessage('Belum ada ucapan yang tertangkap. Anda bisa coba bicara lagi atau ketik langsung di kotak teks bawah.');
    }
  };

  const cancelSession = () => {
    isManuallyStoppedRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
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
      setErrorMessage('Belum ada ucapan yang tertangkap. Silakan tekan tombol mic dan sebutkan barang.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const liveProducts = getProducts().length > 0 ? getProducts() : products;
      const result = await processVoiceTranscriptWithGemini(trimmed, liveProducts);

      if (result.success && result.items.length > 0) {
        playMagicChime('success');
        setLastSummary(result.summary);
        onResult(result);

        // Auto close setelah 2.2 detik agar kasir sempat melihat feedback visual
        closeTimerRef.current = setTimeout(() => {
          setIsCardOpen(false);
          setLastSummary(null);
          setTranscript('');
          setInterimText('');
        }, 2200);
      } else {
        playMagicChime('error');
        setErrorMessage(
          result.error || 'AI belum berhasil mengenali nama barang dari ucapan tersebut. Coba sebutkan lebih jelas.'
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
            if (isListening) {
              stopListening();
            } else if (!isCardOpen) {
              startListening();
            } else {
              setIsCardOpen(false);
            }
          }}
          title={
            isProcessing
              ? 'AI sedang memproses suara...'
              : isListening
              ? 'Klik untuk selesai bicara & buat transaksi'
              : 'AI Suara Kasir (F8) - Bicara untuk buat transaksi otomatis'
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
                    {hasGeminiKey ? '⚡ Didukung Google Gemini AI' : 'Mode Offline Cerdas'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="voice-ai-close-btn"
                onClick={cancelSession}
                title="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body: Status & Live Wave */}
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
                  <p className="voice-listening-status">
                    Silakan sebutkan barang belanjaan...
                  </p>
                </div>
              )}

              {isProcessing && (
                <div className="voice-processing-visual">
                  <Loader2 size={32} className="spin voice-proc-spinner" />
                  <p className="voice-proc-status">
                    Otak AI sedang mencocokkan produk & menghitung total...
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
                    Contoh: <em>"Baut baja ringan 50 biji, pipa paralon rucika setengah 2 batang, lem alteco satu"</em>
                  </p>
                )}
              </div>

              {/* Action buttons saat mendengarkan */}
              {isListening && (
                <div className="voice-card-actions">
                  <button
                    type="button"
                    className="voice-btn-done"
                    onClick={stopListening}
                  >
                    <CheckCircle2 size={16} />
                    Selesai & Generate Struk
                  </button>
                </div>
              )}

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
                💡 <strong>Tips:</strong> Bisa sebutkan jumlah, satuan (sak, dim, lonjor, rol), atau uang bayar!
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
