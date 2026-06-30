'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatStore } from '@/app/store/chatStore';
import { cardsAPI } from '@/app/api/cards';
import { useTranslations } from '@/lib/i18n';
import {
  MessageCircle, X, Send, Plus, Bot, User as UserIcon, Clock, Trash2,
  Loader2, Mic, MicOff, Paperclip, Volume2, VolumeX,
} from 'lucide-react';

export default function ChatPanel() {
  const { t, locale, isRTL } = useTranslations();
  const {
    isOpen, messages, sessions, isSending, isLoading, currentSessionId,
    toggleChat, closeChat, sendMessage, startNewSession, loadSessions, loadMessages, deleteSession,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [showSessions, setShowSessions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Voice input (STT)
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  // Voice output (TTS)
  const [ttsSupported, setTtsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Voice Mode: full conversation — auto-sends after STT, auto-speaks AI reply
  const [voiceMode, setVoiceMode] = useState(false);
  const lastSpokenMsgCount = useRef(0);

  // File/image attachment
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ base64: string; type: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SR) setSpeechSupported(true);
    if ('speechSynthesis' in window) {
      setTtsSupported(true);
      // Pre-load voices list (needed on some browsers)
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    if (isOpen) { inputRef.current?.focus(); loadSessions(); }
  }, [isOpen, loadSessions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, []);

  // ── TTS ───────────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!ttsSupported || !text) return;
    window.speechSynthesis.cancel();

    // Strip markdown formatting for cleaner speech
    const clean = text
      .replace(/\*\*/g, '').replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`/g, '').replace(/>\s/g, '')
      .trim();

    if (!clean) return;

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = locale === 'ar' ? 'ar-SA' : 'en-US';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Pick best matching voice
    const voices = window.speechSynthesis.getVoices();
    const langPrefix = locale === 'ar' ? 'ar' : 'en';
    const preferred = voices.find(v => v.lang.startsWith(langPrefix));
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend   = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [locale, ttsSupported]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  // Auto-speak new AI messages when Voice Mode is active
  useEffect(() => {
    if (!voiceMode || isSending) return;
    if (messages.length > lastSpokenMsgCount.current) {
      const last = messages[messages.length - 1];
      if (last?.role === 'assistant') {
        speak(last.content);
        lastSpokenMsgCount.current = messages.length;
      }
    }
  }, [messages, isSending, voiceMode, speak]);

  // ── Voice Mode Toggle ─────────────────────────────────────────────────
  const toggleVoiceMode = useCallback(() => {
    setVoiceMode(prev => {
      const next = !prev;
      if (!next) {
        stopSpeaking();
        recognitionRef.current?.abort();
        recognitionRef.current = null;
        setIsRecording(false);
        setInterimTranscript('');
      } else {
        // Don't re-speak messages that exist before voice mode was enabled
        lastSpokenMsgCount.current = messages.length;
      }
      return next;
    });
  }, [messages.length, stopSpeaking]);

  // ── STT ───────────────────────────────────────────────────────────────
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsRecording(false);
      setInterimTranscript('');
      return;
    }

    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = locale === 'ar' ? 'ar-SA' : 'en-US';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    let finalText = '';

    rec.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (interim) setInterimTranscript(interim);
      if (final) {
        finalText = final;
        setInterimTranscript('');
      }
    };

    rec.onerror = () => {
      setIsRecording(false);
      setInterimTranscript('');
      recognitionRef.current = null;
    };

    rec.onend = () => {
      setIsRecording(false);
      setInterimTranscript('');
      recognitionRef.current = null;
      if (finalText) {
        if (voiceMode) {
          // Auto-send in voice mode
          sendMessage(finalText);
        } else {
          setInput(prev => prev ? prev + ' ' + finalText : finalText);
          inputRef.current?.focus();
        }
        finalText = '';
      }
    };

    // Stop TTS before speaking
    stopSpeaking();

    recognitionRef.current = rec;
    rec.start();
    setIsRecording(true);
  }, [isRecording, locale, voiceMode, sendMessage, stopSpeaking]);

  // ── Image Attachment ──────────────────────────────────────────────────
  const handleImageSelect = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (file.type.startsWith('image/')) setImagePreview(base64);
      setAttachedFile({ base64, type: file.type, name: file.name });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const removeImagePreview = useCallback(() => { setImagePreview(null); setAttachedFile(null); }, []);

  // ── Send ──────────────────────────────────────────────────────────────
  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  };

  const handleSend = async () => {
    if ((!input.trim() && !imagePreview && !attachedFile) || isSending) return;
    const isPdf = attachedFile?.type === 'application/pdf';
    const isImage = attachedFile?.type?.startsWith('image/') || !!imagePreview;

    let text = input.trim();
    if (!text) {
      if (imagePreview || isImage) {
        text = ar('استخرج المعاملات من هذا الكشف/الصورة وأضفها تلقائياً', 'Extract transactions from this statement/image and add them automatically');
      } else if (isPdf) {
        text = ar('استورد معاملات هذا الكشف البنكي وأضفها', 'Import transactions from this bank statement and add them');
      }
    }

    // For PDFs, send base64 as image to AI (Gemini supports PDF inline)
    const imageToSend = imagePreview || (attachedFile && !isPdf ? attachedFile.base64 : null) || (isPdf ? attachedFile?.base64 : null);
    sendMessage(text, imageToSend || undefined, attachedFile?.name);
    setInput('');
    if (inputRef.current) { inputRef.current.style.height = 'auto'; }
    setImagePreview(null);
    setAttachedFile(null);
  };

  // ── Helpers ───────────────────────────────────────────────────────────
  const ar = (arText: string, enText: string) => locale === 'ar' ? arText : enText;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      {/* FAB */}
      <button
        className={`chat-fab ${voiceMode ? 'voice-mode-active' : ''}`}
        onClick={toggleChat}
        type="button"
        aria-label="Chat"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {isOpen && (
        <div className="chat-panel">

          {/* ── Header ── */}
          <div className={`chat-header ${voiceMode ? 'voice-mode-header' : ''}`}>
            <div className="chat-header-title">
              <Bot size={20} />
              <span>{t('chat.title') || 'AI Assistant'}</span>
              {voiceMode && (
                <span className="chat-voice-badge">
                  {ar('صوتي', 'Voice')}
                </span>
              )}
            </div>
            <div className="chat-header-actions">
              {ttsSupported && speechSupported && (
                <button
                  onClick={toggleVoiceMode}
                  className={`chat-header-btn ${voiceMode ? 'voice-on' : ''}`}
                  type="button"
                  title={voiceMode ? ar('إيقاف الوضع الصوتي', 'Disable voice mode') : ar('تفعيل الوضع الصوتي', 'Enable voice mode')}
                >
                  {voiceMode ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
              )}
              <button onClick={() => setShowSessions(!showSessions)} className="chat-header-btn" type="button">
                <Clock size={18} />
              </button>
              <button onClick={() => { startNewSession(); setShowSessions(false); }} className="chat-header-btn" type="button">
                <Plus size={18} />
              </button>
              <button onClick={closeChat} className="chat-header-btn" type="button">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ── Voice Status Bar ── */}
          {voiceMode && (
            <div className="chat-voice-status-bar">
              {isRecording ? (
                <>
                  <span className="chat-voice-indicator recording" />
                  <span>{ar('جاري الاستماع...', 'Listening...')}</span>
                </>
              ) : isSpeaking ? (
                <>
                  <span className="chat-voice-indicator speaking" />
                  <span>{ar('جاري الكلام...', 'Speaking...')}</span>
                  <button className="chat-voice-stop-speaking" onClick={stopSpeaking} type="button">
                    <VolumeX size={11} />
                    <span>{ar('إيقاف', 'Stop')}</span>
                  </button>
                </>
              ) : isSending ? (
                <>
                  <Loader2 size={11} className="chat-voice-spin" />
                  <span>{ar('جاري التفكير...', 'Thinking...')}</span>
                </>
              ) : (
                <>
                  <span className="chat-voice-indicator idle" />
                  <span>{ar('اضغط المايك للكلام', 'Tap mic to speak')}</span>
                </>
              )}
            </div>
          )}

          {/* ── Sessions Sidebar ── */}
          {showSessions && (
            <div className="chat-sessions">
              <div className="chat-sessions-title">{t('chat.sessions') || 'Previous Chats'}</div>
              {sessions.length === 0 && (
                <p className="chat-sessions-empty">{ar('لا توجد محادثات سابقة', 'No previous chats')}</p>
              )}
              {sessions.map(s => (
                <div key={s.id} className={`chat-session-item ${s.id === currentSessionId ? 'active' : ''}`}>
                  <button
                    onClick={() => { loadMessages(s.id); setShowSessions(false); }}
                    className="chat-session-btn"
                    type="button"
                  >
                    {s.title || 'Chat'}
                  </button>
                  <button onClick={() => deleteSession(s.id)} className="chat-session-delete" type="button">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Messages ── */}
          <div className="chat-messages">
            {isLoading ? (
              <div className="chat-loading"><Loader2 size={24} className="scan-spinner" /></div>
            ) : messages.length === 0 ? (
              <div className="chat-welcome">
                <div className="chat-welcome-avatar">
                  <Bot size={28} />
                </div>
                <div className="chat-welcome-text">
                  <strong>{ar('مرحباً! أنا مساعدك المالي الذكي', 'Hello! I\'m your AI financial advisor')}</strong>
                  <p>{ar('أستطيع تحليل إنفاقك، إضافة وحذف المعاملات، استيراد كشوفات الحساب، وإصدار التقارير المالية الاحترافية.', 'I can analyze your spending, add/delete transactions, import bank statements, and generate professional financial reports.')}</p>
                </div>
                <div className="chat-quick-actions">
                  <p className="chat-quick-label">{ar('اقتراحات سريعة:', 'Quick suggestions:')}</p>
                  <div className="chat-quick-grid">
                    {[
                      { icon: '📊', ar: 'تقرير الإنفاق هذا الشهر', en: 'Spending report this month' },
                      { icon: '💳', ar: 'ما هو أعلى رصيد بطاقة؟', en: 'Which card has highest balance?' },
                      { icon: '📥', ar: 'أضف معاملة من SMS', en: 'Add transaction from SMS' },
                      { icon: '📈', ar: 'قارن إنفاقي بالشهر الماضي', en: 'Compare spending to last month' },
                      { icon: '⚠️', ar: 'أي بطاقات تقترب من الحد؟', en: 'Cards near credit limit?' },
                      { icon: '📄', ar: 'استورد كشف حساب بنكي', en: 'Import bank statement' },
                    ].map((q, i) => (
                      <button
                        key={i}
                        className="chat-quick-btn"
                        onClick={() => { sendMessage(locale === 'ar' ? q.ar : q.en); }}
                        type="button"
                      >
                        <span>{q.icon}</span>
                        <span>{locale === 'ar' ? q.ar : q.en}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
                  <div className="chat-msg-avatar">
                    {msg.role === 'user' ? <UserIcon size={14} /> : <Bot size={14} />}
                  </div>
                  <div className="chat-msg-bubble">
                    {msg.role === 'assistant' ? (
                      <div className="chat-md">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <span className="chat-msg-text">
                        {msg.content}
                        {msg.attachmentName && (
                          <span className="chat-msg-attachment">📎 {msg.attachmentName}</span>
                        )}
                      </span>
                    )}
                    {msg.role === 'assistant' && ttsSupported && (
                      <button
                        className={`chat-msg-speak-btn ${isSpeaking ? 'speaking' : ''}`}
                        onClick={() => isSpeaking ? stopSpeaking() : speak(msg.content)}
                        type="button"
                        title={isSpeaking ? ar('إيقاف', 'Stop') : ar('قراءة بصوت عالٍ', 'Read aloud')}
                      >
                        {isSpeaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Live interim transcript */}
            {interimTranscript && (
              <div className="chat-msg chat-msg-user">
                <div className="chat-msg-avatar"><UserIcon size={16} /></div>
                <div className="chat-msg-bubble chat-interim">{interimTranscript}</div>
              </div>
            )}

            {/* Thinking indicator */}
            {isSending && (
              <div className="chat-msg chat-msg-assistant">
                <div className="chat-msg-avatar"><Bot size={16} /></div>
                <div className="chat-msg-bubble chat-typing">
                  <span className="chat-dot" /><span className="chat-dot" /><span className="chat-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── File/Image Preview ── */}
          {(imagePreview || attachedFile) && (
            <div className="chat-image-preview">
              {imagePreview ? (
                <img src={imagePreview} alt="Attached" />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', fontSize: '0.8rem' }}>
                  <Paperclip size={14} />
                  <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedFile?.name}</span>
                </div>
              )}
              <button className="chat-image-preview-remove" onClick={removeImagePreview} type="button" aria-label="Remove attachment">
                <X size={14} />
              </button>
            </div>
          )}

          {/* ── Input Area ── */}
          <div className={`chat-input-area ${voiceMode ? 'voice-mode' : ''}`} style={{ position: 'relative' }}>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} style={{ display: 'none' }} />

            {voiceMode ? (
              /* ── Voice Mode: Big centered mic ── */
              <div className="chat-voice-input-row">
                <button
                  onClick={toggleRecording}
                  className={`chat-voice-mic-big ${isRecording ? 'recording' : ''}`}
                  type="button"
                  disabled={isSending || isSpeaking}
                  title={isRecording ? ar('إيقاف التسجيل', 'Stop recording') : ar('اضغط للكلام', 'Tap to speak')}
                >
                  {isRecording ? <MicOff size={30} /> : <Mic size={30} />}
                </button>
                <span className="chat-voice-hint">
                  {isRecording
                    ? ar('اضغط للإيقاف', 'Tap to stop')
                    : isSpeaking
                    ? ar('جاري الكلام...', 'Speaking...')
                    : isSending
                    ? ar('جاري التفكير...', 'Thinking...')
                    : ar('اضغط للكلام', 'Tap to speak')}
                </span>
              </div>
            ) : (
              /* ── Normal Mode: Text input + extras ── */
              <>
                {/* Recording active bar */}
                {isRecording && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '6px 12px', background: 'var(--danger)', zIndex: 10, borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }} />
                    <span style={{ fontSize: '0.78rem', color: '#fff', fontWeight: 600 }}>{ar('جاري التسجيل... اضغط للإيقاف', 'Recording... tap to stop')}</span>
                    <button onClick={toggleRecording} type="button" style={{ background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: 6, padding: '2px 8px', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                      {ar('إيقاف', 'Stop')}
                    </button>
                  </div>
                )}
                <div className="chat-input-extras">
                  <button
                    onClick={handleImageSelect}
                    className="chat-attach-btn"
                    type="button"
                    title={t('chat.attachImage') || 'Attach image'}
                    disabled={isSending}
                  >
                    <Paperclip size={18} />
                  </button>
                  {speechSupported && (
                    <button
                      onClick={toggleRecording}
                      className={`chat-voice-btn ${isRecording ? 'recording' : ''}`}
                      type="button"
                      title={isRecording ? (t('chat.stopRecording') || 'Stop') : (t('chat.voiceInput') || 'Voice')}
                      disabled={isSending}
                    >
                      {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                  )}
                </div>
                <textarea
                  ref={inputRef}
                  value={input}
                  rows={1}
                  onChange={e => { setInput(e.target.value); autoResize(e.target); }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={t('chat.placeholder') || 'Ask about your finances...'}
                  className="chat-input"
                  disabled={isSending}
                  style={{ resize: 'none', overflowY: 'hidden', lineHeight: '1.45' }}
                />
                <button
                  onClick={handleSend}
                  disabled={isSending || (!input.trim() && !imagePreview && !attachedFile)}
                  className="chat-send-btn"
                  type="button"
                >
                  <Send size={18} />
                </button>
              </>
            )}
          </div>

        </div>
      )}
    </>
  );
}
