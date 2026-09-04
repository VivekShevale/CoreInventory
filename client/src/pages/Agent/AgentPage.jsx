// src/pages/Agent/AgentPage.jsx
// Full-page Inventory Agent — MCP-based, persistent chat history per user

import React, {
  useState, useRef, useEffect, useCallback, useMemo
} from 'react';
import { Link } from 'react-router-dom';
import {
  Bot, ArrowLeft, Trash2,
  Package, Truck, PackageCheck, ArrowLeftRight,
  AlertTriangle, CheckCircle2, XCircle, Loader2,
  ChevronRight, Send, Zap, History, RefreshCw,
} from 'lucide-react';
import api from '../../configs/api';

// ── Quick starters ────────────────────────────────────────────────────────────
const STARTERS = [
  { label: 'Stock overview',     msg: "Give me a full stock summary — what's low and what's healthy?" },
  { label: 'Inventory value',    msg: 'What is our total inventory value broken down by category?' },
  { label: 'Pending operations', msg: 'Show all pending operations. Highlight any that are late.' },
  { label: 'Create receipt',     msg: 'I want to create a new receipt from a vendor.' },
  { label: 'Create delivery',    msg: 'I want to create a delivery order for a customer.' },
  { label: 'Internal transfer',  msg: 'I want to transfer stock between two locations.' },
  { label: 'Stock adjustment',   msg: 'I need to do a stock adjustment for damaged goods.' },
  { label: 'Recent movements',   msg: 'Show me stock movements from the last 14 days.' },
  { label: 'Low stock items',    msg: 'Which products are below their reorder point?' },
  { label: 'Move history',       msg: 'What came in and went out this week?' },
];

// ── Markdown renderer ─────────────────────────────────────────────────────────
function Markdown({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} className="h-1" />;
        const renderInline = (str) =>
          str.split(/(\*\*[^*]+\*\*)/).map((p, j) =>
            p.startsWith('**') && p.endsWith('**')
              ? <strong key={j} className="font-semibold text-zinc-900 dark:text-white">{p.slice(2, -2)}</strong>
              : p
          );
        if (t.startsWith('## '))
          return <p key={i} className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm mt-2">{renderInline(t.slice(3))}</p>;
        if (t.startsWith('• ') || t.startsWith('- '))
          return (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-zinc-400 mt-0.5 flex-shrink-0 text-xs">•</span>
              <span className="text-zinc-700 dark:text-zinc-300">{renderInline(t.slice(2))}</span>
            </div>
          );
        return <p key={i} className="text-zinc-700 dark:text-zinc-300">{renderInline(t)}</p>;
      })}
    </div>
  );
}

// ── Confirm action card ───────────────────────────────────────────────────────
function ConfirmCard({ onConfirm, onCancel }) {
  return (
    <div className="flex gap-2 mt-3 pt-3 border-t border-amber-200 dark:border-amber-900/40">
      <button
        onClick={onConfirm}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-sm font-semibold transition-all"
      >
        <CheckCircle2 size={15} /> Yes, confirm
      </button>
      <button
        onClick={onCancel}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 active:scale-[0.98] text-zinc-700 dark:text-zinc-200 text-sm font-semibold transition-all"
      >
        <XCircle size={15} /> Cancel
      </button>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Message({ msg, onConfirm, onCancel }) {
  const isUser = msg.role === 'user';
  if (isUser) {
    return (
      <div className="flex justify-end mb-4 animate-in slide-in-from-right-2 duration-200">
        <div className="max-w-[75%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm shadow-sm">
          {msg.content}
        </div>
      </div>
    );
  }
  const bub = {
    confirm:   'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50',
    executed:  'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50',
    cancelled: 'bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700',
    error:     'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50',
    answer:    'bg-white dark:bg-zinc-800/90 border border-zinc-100 dark:border-zinc-700/60',
  }[msg.response_type] || 'bg-white dark:bg-zinc-800/90 border border-zinc-100 dark:border-zinc-700/60';

  return (
    <div className="flex gap-3 mb-4 animate-in slide-in-from-left-2 duration-200">
      <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
        <Bot size={15} className="text-white" />
      </div>
      <div className="flex-1 min-w-0 max-w-[90%]">
        <div className={`rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm ${bub}`}>
          {msg.streaming
            ? <div className="flex items-center gap-1.5 text-zinc-400 text-sm">
                <Loader2 size={13} className="animate-spin" />
                <span>Thinking…</span>
              </div>
            : <Markdown text={msg.content} />
          }
          {msg.response_type === 'confirm' && msg.pending_action && !msg.streaming && (
            <ConfirmCard onConfirm={onConfirm} onCancel={onCancel} />
          )}
        </div>
        {msg.latency_ms > 0 && (
          <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1 ml-1">{msg.latency_ms}ms</p>
        )}
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function SidebarPanel({ context, ctxLoading, onStarterClick }) {
  const pc = context?.pending || {};
  const lowItems = useMemo(
    () => (context?.products || []).filter(p => p.status !== 'ok'),
    [context]
  );
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2.5">Pending</p>
        {ctxLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-6 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse"/>)}</div>
        ) : (
          <div className="space-y-1.5">
            {[
              { label: 'Receipts',    val: pc.receipts,    icon: PackageCheck,   color: 'text-blue-600 dark:text-blue-400' },
              { label: 'Deliveries',  val: pc.deliveries,  icon: Truck,          color: 'text-teal-600 dark:text-teal-400' },
              { label: 'Transfers',   val: pc.transfers,   icon: ArrowLeftRight, color: 'text-purple-600 dark:text-purple-400' },
              { label: 'Adjustments', val: pc.adjustments, icon: Package,        color: 'text-zinc-500 dark:text-zinc-400' },
            ].map(({ label, val, icon: Icon, color }) => (
              <div key={label} className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-2">
                  <Icon size={12} className={color} />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
                </div>
                <span className={`text-xs font-semibold ${color}`}>{val ?? 0}</span>
              </div>
            ))}
            {pc.late > 0 && (
              <div className="flex items-center gap-2 text-red-500 mt-1 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                <AlertTriangle size={11} />
                <span className="text-xs font-medium">{pc.late} late</span>
              </div>
            )}
          </div>
        )}
      </div>

      {lowItems.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2.5">Needs attention</p>
          <div className="space-y-2">
            {lowItems.slice(0, 5).map(p => (
              <button key={p.id} onClick={() => onStarterClick(`Tell me about ${p.name} stock`)}
                className="w-full text-left flex items-center gap-2 group">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.status === 'out' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{p.name}</p>
                  <p className="text-xs text-zinc-400">{p.on_hand} {p.unit}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2.5">Quick actions</p>
        <div className="space-y-0.5">
          {STARTERS.slice(0, 7).map(s => (
            <button key={s.label} onClick={() => onStarterClick(s.msg)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left transition-colors group">
              <ChevronRight size={11} className="text-zinc-400 group-hover:text-blue-500 flex-shrink-0 transition-colors" />
              <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate group-hover:text-zinc-900 dark:group-hover:text-zinc-200 transition-colors">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AgentPage() {
  const [messages,        setMessages]        = useState([]);
  const [input,           setInput]           = useState('');
  const [loading,         setLoading]         = useState(false);
  const [historyLoading,  setHistoryLoading]  = useState(true);
  const [threadId,        setThreadId]        = useState(null);
  const [pendingAction,   setPendingAction]   = useState(null);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [context,         setContext]         = useState(null);
  const [ctxLoading,      setCtxLoading]      = useState(true);
  const [historyCount,    setHistoryCount]    = useState(0);

  const endRef   = useRef(null);
  const inputRef = useRef(null);
  const taRef    = useRef(null);

  // ── Load persistent history on mount ───────────────────────────────────────
  useEffect(() => {
    api.get('/api/agent/history?limit=80')
      .then(r => {
        const { messages: hist, thread_id, total } = r.data;
        if (hist && hist.length > 0) {
          // Convert DB history format to UI message format
          const uiMsgs = hist.map(m => ({
            role:          m.role,
            content:       m.content,
            response_type: m.role === 'assistant' ? 'answer' : undefined,
            streaming:     false,
            latency_ms:    0,
            _id:           m.id,
          }));
          setMessages(uiMsgs);
          setHistoryCount(total);
        }
        if (thread_id) setThreadId(thread_id);
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));

    // Load sidebar context
    api.get('/api/agent/context')
      .then(r => setContext(r.data))
      .catch(() => {})
      .finally(() => setCtxLoading(false));
  }, []);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading && !historyLoading) inputRef.current?.focus();
  }, [loading, historyLoading]);

  // ── Send message ────────────────────────────────────────────────────────────
  const send = useCallback(async (text, extraPayload = {}) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    if (taRef.current) taRef.current.style.height = '44px';
    setLoading(true);

    setMessages(prev => [...prev, { role: 'user', content: msg, _id: `u_${Date.now()}` }]);
    const placeholderId = `ai_${Date.now()}`;
    setMessages(prev => [...prev, {
      role: 'assistant', content: '', streaming: true,
      response_type: 'answer', _id: placeholderId,
    }]);

    const t0 = Date.now();
    try {
      const res = await api.post('/api/agent/chat', {
        message:          msg,
        pending_action:   pendingAction,
        awaiting_confirm: awaitingConfirm,
        ...extraPayload,
      });
      const d = res.data;

      if (d.thread_id && !threadId) setThreadId(d.thread_id);
      setPendingAction(d.pending_action || null);
      setAwaitingConfirm(d.awaiting_confirm || false);

      setMessages(prev => prev.map(m =>
        m._id === placeholderId ? {
          role:           'assistant',
          content:        d.response || '',
          response_type:  d.response_type || 'answer',
          pending_action: d.pending_action,
          latency_ms:     Date.now() - t0,
          streaming:      false,
        } : m
      ));
    } catch (e) {
      const errMsg = e.response?.data?.response || e.message || 'Connection error.';
      setMessages(prev => prev.map(m =>
        m._id === placeholderId ? {
          role: 'assistant', content: `⚠️ ${errMsg}`,
          response_type: 'error', streaming: false, latency_ms: Date.now() - t0,
        } : m
      ));
    }
    setLoading(false);
  }, [input, loading, threadId, pendingAction, awaitingConfirm]);

  // ── Clear history ───────────────────────────────────────────────────────────
  const clearChat = useCallback(async () => {
    if (!window.confirm('Clear your entire conversation history? This cannot be undone.')) return;
    try {
      await api.delete('/api/agent/history');
      setMessages([]);
      setPendingAction(null);
      setAwaitingConfirm(false);
      setHistoryCount(0);
    } catch (e) {
      console.error('Failed to clear history', e);
    }
  }, []);

  const handleConfirm = () => send('yes');
  const handleCancel  = () => send('no');

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const autoResize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
  };

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden">

      {/* ── Left sidebar ──────────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
          <Link to="/"
            className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors mb-4">
            <ArrowLeft size={13} /> Dashboard
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Bot size={17} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI Agent</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-zinc-400">MCP · Groq</span>
              </div>
            </div>
          </div>

          {/* History badge */}
          {historyCount > 0 && (
            <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700">
              <History size={11} className="text-zinc-400" />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {historyCount} messages in history
              </span>
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button onClick={clearChat}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
              <Trash2 size={11} /> Clear history
            </button>
            {threadId && (
              <div className="px-2 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center gap-1" title={`Thread: ${threadId}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-mono">Active</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <SidebarPanel context={context} ctxLoading={ctxLoading} onStarterClick={(msg) => send(msg)} />
        </div>
      </aside>

      {/* ── Main chat area ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-50 dark:bg-zinc-950">

        {/* Topbar */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              Inventory Agent
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-medium">MCP</span>
            </h1>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              Real-time database access via MCP · Persistent history · Confirmation-gated writes
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Zap size={11} className="text-amber-500" />
            <span>Llama 3.3 70B</span>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto">

            {/* History loading spinner */}
            {historyLoading && (
              <div className="flex items-center justify-center gap-2 text-zinc-400 text-sm py-8">
                <RefreshCw size={14} className="animate-spin" />
                <span>Loading your conversation history…</span>
              </div>
            )}

            {/* Welcome screen — only when history is loaded AND empty */}
            {!historyLoading && messages.length === 0 && (
              <div className="text-center mb-10">
                <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-5 shadow-lg">
                  <Bot size={30} className="text-white" />
                </div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  What can I help with?
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 max-w-md mx-auto">
                  I can answer any inventory question and create receipts, deliveries, transfers,
                  or adjustments — just describe what you need. Your conversation is saved automatically.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-left">
                  {STARTERS.map(s => (
                    <button key={s.label} onClick={() => send(s.msg)}
                      className="px-3.5 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-left hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all group">
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">{s.label}</p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 line-clamp-1">{s.msg}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg, i) => (
              <Message
                key={msg._id || i}
                msg={msg}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
              />
            ))}

            <div ref={endRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 px-4 pb-5 pt-3 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            {awaitingConfirm && pendingAction && (
              <div className="mb-2.5 flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle size={13} />
                  <span>Waiting for confirmation — type <strong>yes</strong> or <strong>no</strong></span>
                </div>
                <button onClick={handleCancel} className="text-xs text-amber-600 dark:text-amber-400 hover:underline">Cancel</button>
              </div>
            )}

            <div className="flex items-end gap-2.5">
              <textarea
                ref={el => { inputRef.current = el; taRef.current = el; }}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                onInput={autoResize}
                disabled={loading || historyLoading}
                rows={1}
                placeholder={
                  awaitingConfirm
                    ? "Type yes to confirm or no to cancel…"
                    : "Ask about stock, or say 'create a receipt from Metro Steel for 100 kg steel rod to Stock Zone A'…"
                }
                className="flex-1 resize-none text-sm px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 disabled:opacity-60 transition-all"
                style={{ minHeight: 44, maxHeight: 150 }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading || historyLoading}
                className="w-11 h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm flex-shrink-0"
              >
                {loading
                  ? <Loader2 size={17} className="animate-spin" />
                  : <Send size={16} />
                }
              </button>
            </div>

            <p className="text-xs text-zinc-400 dark:text-zinc-600 text-center mt-2.5">
              MCP tools · Confirmation required for all writes · History saved to PostgreSQL
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}