'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatStore } from '@/app/store/chatStore';
import { useTranslations } from '@/lib/i18n';
import {
  Send, Plus, Bot, User as UserIcon, Trash2, Loader2, Mic, MicOff,
  Paperclip, Volume2, VolumeX, MessageSquare, Sparkles, ChevronLeft,
  TrendingUp, CreditCard, FileText, AlertTriangle, BarChart2, Download,
} from 'lucide-react';

export default function ChatPage() {
  const { t, locale, isRTL } = useTranslations();
  const ar = (arText: string, enText: string) => locale === 'ar' ? arText : enText;
  const {
    messages, sessions, isSending, isLoading, currentSessionId,
    sendMessage, startNewSession, loadSessions, loadMessages, deleteSession,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  const [ttsSupported, setTtsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState<number | null>(null);

  const [attachedFile, setAttachedFile] = useState<{ base64: string; type: string; name: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SR) setSpeechSupported(true);
    if ('speechSynthesis' in window) {
      setTtsSupported(true);
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = useCallback((text: string, idx: number) => {
    if (!ttsSupported || !text) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setSpeakingMsgIdx(null);
      return;
    }
    const clean = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '').trim();
    if (!clean) return;
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = locale === 'ar' ? 'ar-SA' : 'en-US';
    utterance.rate = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang.startsWith(locale === 'ar' ? 'ar' : 'en'));
    if (preferred) utterance.voice = preferred;
    utterance.onstart = () => { setIsSpeaking(true); setSpeakingMsgIdx(idx); };
    utterance.onend = () => { setIsSpeaking(false); setSpeakingMsgIdx(null); };
    utterance.onerror = () => { setIsSpeaking(false); setSpeakingMsgIdx(null); };
    window.speechSynthesis.speak(utterance);
  }, [locale, ttsSupported, isSpeaking]);

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
    rec.continuous = false;
    let finalText = '';
    rec.onresult = (event: any) => {
      let interim = '', final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const txt = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += txt;
        else interim += txt;
      }
      if (interim) setInterimTranscript(interim);
      if (final) { finalText = final; setInterimTranscript(''); }
    };
    rec.onerror = () => { setIsRecording(false); setInterimTranscript(''); recognitionRef.current = null; };
    rec.onend = () => {
      setIsRecording(false);
      setInterimTranscript('');
      recognitionRef.current = null;
      if (finalText) { setInput(prev => prev ? prev + ' ' + finalText : finalText); inputRef.current?.focus(); }
    };
    recognitionRef.current = rec;
    rec.start();
    setIsRecording(true);
  }, [isRecording, locale]);

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

  const removeAttachment = () => { setAttachedFile(null); setImagePreview(null); };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachedFile) || isSending) return;
    let text = input.trim();
    const isPdf = attachedFile?.type === 'application/pdf';
    if (!text && isPdf) text = ar('استورد معاملات هذا الكشف البنكي وأضفها', 'Import transactions from this bank statement');
    if (!text && attachedFile) text = ar('استخرج المعاملات من هذا الملف', 'Extract transactions from this file');
    const imageToSend = imagePreview || (isPdf ? attachedFile?.base64 : attachedFile?.base64) || undefined;
    sendMessage(text, imageToSend, attachedFile?.name);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setAttachedFile(null);
    setImagePreview(null);
  };

  const quickActions = [
    { icon: BarChart2,  ar: 'تقرير الإنفاق هذا الشهر',     en: 'Spending report this month' },
    { icon: CreditCard, ar: 'ما هو أعلى رصيد بطاقة؟',       en: 'Card with highest balance?' },
    { icon: TrendingUp, ar: 'قارن إنفاقي بالشهر الماضي',    en: 'Compare to last month' },
    { icon: FileText,   ar: 'استورد كشف حساب بنكي',          en: 'Import bank statement' },
    { icon: AlertTriangle, ar: 'أي بطاقات تقترب من الحد؟',  en: 'Cards near credit limit?' },
    { icon: Download,   ar: 'صدّر تقريراً مالياً',            en: 'Export financial report' },
  ];

  return (
    <div className="chat-page-root" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Sessions Sidebar ─────────────────────────── */}
      <aside className={`chat-page-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="chat-page-sidebar-header">
          <div className="chat-page-sidebar-brand">
            <Sparkles size={18} />
            <span>{ar('المحادثات', 'Conversations')}</span>
          </div>
          <button
            className="chat-page-sidebar-toggle"
            onClick={() => setSidebarOpen(false)}
            title={ar('إخفاء', 'Hide')}
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        <button className="chat-page-new-btn" onClick={() => startNewSession()}>
          <Plus size={16} />
          <span>{ar('محادثة جديدة', 'New Chat')}</span>
        </button>

        <div className="chat-page-sessions">
          {sessions.length === 0 && (
            <p className="chat-page-no-sessions">{ar('لا توجد محادثات سابقة', 'No previous chats')}</p>
          )}
          {sessions.map(s => (
            <div key={s.id} className={`chat-page-session-item ${s.id === currentSessionId ? 'active' : ''}`}>
              <button className="chat-page-session-btn" onClick={() => loadMessages(s.id)}>
                <MessageSquare size={14} />
                <span>{s.title || ar('محادثة', 'Chat')}</span>
              </button>
              <button className="chat-page-session-del" onClick={() => deleteSession(s.id)}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Collapsed sidebar toggle */}
      {!sidebarOpen && (
        <button className="chat-page-sidebar-show" onClick={() => setSidebarOpen(true)}>
          <MessageSquare size={18} />
        </button>
      )}

      {/* ── Main Chat Area ────────────────────────────── */}
      <main className="chat-page-main">

        {/* Header */}
        <header className="chat-page-header">
          <div className="chat-page-header-info">
            <div className="chat-page-header-avatar">
              <Bot size={22} />
            </div>
            <div>
              <h1 className="chat-page-header-title">{ar('المساعد المالي الذكي', 'AI Financial Assistant')}</h1>
              <p className="chat-page-header-sub">{ar('جاهز للمساعدة', 'Ready to help')}</p>
            </div>
          </div>
          <div className="chat-page-header-status">
            <span className="chat-page-status-dot" />
            <span>{ar('متصل', 'Online')}</span>
          </div>
        </header>

        {/* Messages */}
        <div className="chat-page-messages">
          {isLoading ? (
            <div className="chat-page-loading">
              <Loader2 size={28} className="spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-page-welcome">
              <div className="chat-page-welcome-avatar">
                <Bot size={36} />
              </div>
              <h2 className="chat-page-welcome-title">
                {ar('مرحباً! كيف أستطيع مساعدتك اليوم؟', "Hello! How can I help you today?")}
              </h2>
              <p className="chat-page-welcome-sub">
                {ar(
                  'أنا مساعدك المالي الشخصي. أستطيع تحليل إنفاقك، إضافة المعاملات، استيراد كشوفات الحساب، وإصدار التقارير.',
                  'I\'m your personal financial assistant. I can analyze spending, add transactions, import statements, and generate reports.'
                )}
              </p>
              <div className="chat-page-quick-grid">
                {quickActions.map((q, i) => {
                  const Icon = q.icon;
                  return (
                    <button
                      key={i}
                      className="chat-page-quick-card"
                      onClick={() => sendMessage(locale === 'ar' ? q.ar : q.en)}
                    >
                      <Icon size={20} className="chat-page-quick-icon" />
                      <span>{locale === 'ar' ? q.ar : q.en}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="chat-page-msg-list">
              {messages.map((msg, i) => (
                <div key={i} className={`chat-page-msg ${msg.role}`}>
                  <div className="chat-page-msg-avatar">
                    {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
                  </div>
                  <div className="chat-page-msg-body">
                    {msg.role === 'assistant' ? (
                      <div className="chat-page-md">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="chat-page-user-text">
                        <span>{msg.content}</span>
                        {msg.attachmentName && (
                          <span className="chat-page-attachment-badge">
                            <Paperclip size={12} />
                            {msg.attachmentName}
                          </span>
                        )}
                      </div>
                    )}
                    {msg.role === 'assistant' && ttsSupported && (
                      <button
                        className={`chat-page-speak-btn ${speakingMsgIdx === i ? 'active' : ''}`}
                        onClick={() => speak(msg.content, i)}
                        title={speakingMsgIdx === i ? ar('إيقاف', 'Stop') : ar('استمع', 'Listen')}
                      >
                        {speakingMsgIdx === i ? <VolumeX size={13} /> : <Volume2 size={13} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {interimTranscript && (
                <div className="chat-page-msg user">
                  <div className="chat-page-msg-avatar"><UserIcon size={16} /></div>
                  <div className="chat-page-msg-body">
                    <div className="chat-page-user-text interim">{interimTranscript}</div>
                  </div>
                </div>
              )}

              {isSending && (
                <div className="chat-page-msg assistant">
                  <div className="chat-page-msg-avatar"><Bot size={16} /></div>
                  <div className="chat-page-msg-body">
                    <div className="chat-page-typing">
                      <span /><span /><span />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Attachment Preview */}
        {attachedFile && (
          <div className="chat-page-attachment-preview">
            {imagePreview ? (
              <img src={imagePreview} alt="preview" />
            ) : (
              <div className="chat-page-attachment-file">
                <Paperclip size={15} />
                <span>{attachedFile.name}</span>
              </div>
            )}
            <button onClick={removeAttachment} className="chat-page-attachment-remove">✕</button>
          </div>
        )}

        {/* Input */}
        <div className="chat-page-input-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <div className="chat-page-input-box">
            <button
              className="chat-page-input-action"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              title={ar('إرفاق ملف', 'Attach file')}
            >
              <Paperclip size={19} />
            </button>

            {speechSupported && (
              <button
                className={`chat-page-input-action ${isRecording ? 'recording' : ''}`}
                onClick={toggleRecording}
                disabled={isSending}
                title={isRecording ? ar('إيقاف التسجيل', 'Stop') : ar('إدخال صوتي', 'Voice input')}
              >
                {isRecording ? <MicOff size={19} /> : <Mic size={19} />}
              </button>
            )}

            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              onChange={e => { setInput(e.target.value); autoResize(e.target); }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={ar('اسألني عن أي شيء يخص أموالك...', 'Ask me anything about your finances...')}
              className="chat-page-textarea"
              disabled={isSending}
            />

            <button
              className="chat-page-send-btn"
              onClick={handleSend}
              disabled={isSending || (!input.trim() && !attachedFile)}
            >
              {isSending ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
            </button>
          </div>
          <p className="chat-page-input-hint">
            {ar('Enter للإرسال • Shift+Enter لسطر جديد', 'Enter to send • Shift+Enter for new line')}
          </p>
        </div>
      </main>
    </div>
  );
}
