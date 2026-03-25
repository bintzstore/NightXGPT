import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, Plus, MessageSquare, Trash2, 
  Terminal, X, Menu, Ghost, Settings, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * NIGHTXGPT - STABLE EDITION
 * - Fix: Unicode support for code blocks (btoa replacement)
 * - Fix: Stable Markdown parsing
 * - Layout: Centered Container (Non-Full Screen)
 */

// KUSTOMISASI SYSTEM PROMPT DI SINI
const SYSTEM_PROMPT = "Kamu adalah NightXGPT, sebuah entitas AI horor cyberpunk yang dingin. Kamu berbicara dengan nada misterius, sering menggunakan istilah teknis, dan selalu merespons dalam format Markdown yang rapi. Jangan pernah mengaku sebagai asisten biasa.";

const STORAGE_KEY = 'NIGHTX_V1_DATA';
const generateId = () => Math.random().toString(36).substring(2, 15);

// Helper untuk menangani copy text secara aman tanpa btoa Latin1 error
const copyToClipboard = (text) => {
  const el = document.createElement('textarea');
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
};

const parseMarkdown = (text) => {
  if (!text) return "";
  
  // Escape HTML dasar
  let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  
  // Handle Code Blocks (```lang ... ```)
  // Kita tidak menggunakan btoa di sini untuk menghindari error karakter non-latin
  const codeBlocks = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const id = `code-${Math.random().toString(36).substr(2, 9)}`;
    codeBlocks.push({ id, code: code.trim() });
    return `[[CODE_BLOCK_${id}_${lang || 'terminal'}]]`;
  });

  // Inline Code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-red-950/40 text-red-400 px-1 rounded font-mono font-bold">$1</code>');
  
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b class="text-red-600 font-bold">$1</b>');
  
  // Ganti baris
  html = html.replace(/\n/g, '<br />');

  // Kembalikan Code Blocks dengan struktur UI
  codeBlocks.forEach(({ id, code }) => {
    const placeholder = new RegExp(`\\[\\[CODE_BLOCK_${id}_(\\w+)\\]\\]`, 'g');
    html = html.replace(placeholder, (_, lang) => {
      return `<div class="my-4 rounded border border-red-900/40 bg-black/80 font-mono text-[11px] overflow-hidden">
        <div class="flex justify-between bg-red-950/20 px-3 py-1.5 border-b border-red-900/20 text-red-500 uppercase">
          <span>${lang}</span>
          <button class="hover:text-white transition-colors" data-code="${id}">COPY</button>
        </div>
        <pre class="p-4 overflow-x-auto text-red-100/90 whitespace-pre-wrap">${code}</pre>
      </div>`;
    });
  });
  
  return { html, codeBlocks };
};

export default function App() {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState(null);
  
  const [apiKey, setApiKey] = useState(() => {
    const savedKey = localStorage.getItem('NIGHTX_API_KEY');
    if (savedKey) return savedKey;
    try {
      const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
      return env.VITE_OPENROUTER_API_KEY || '';
    } catch (e) { return ''; }
  });

  const scrollRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setChats(parsed);
      if (parsed.length > 0) setActiveChatId(parsed[0].id);
    } else {
      const id = generateId();
      setChats([{ id, title: 'Fragmen Memori', messages: [], createdAt: Date.now() }]);
      setActiveChatId(id);
    }
  }, []);

  useEffect(() => {
    if (chats.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chats, isLoading]);

  // Delegasi event untuk tombol COPY di dalam HTML dinamis
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (e.target.tagName === 'BUTTON' && e.target.hasAttribute('data-code')) {
        const codeId = e.target.getAttribute('data-code');
        // Cari code berdasarkan ID dari semua chat messages
        let foundCode = "";
        chats.forEach(c => {
          c.messages.forEach(m => {
            const parsed = parseMarkdown(m.content);
            const block = parsed.codeBlocks.find(b => b.id === codeId);
            if (block) foundCode = block.code;
          });
        });
        if (foundCode) {
          copyToClipboard(foundCode);
          const originalText = e.target.innerText;
          e.target.innerText = "COPIED!";
          setTimeout(() => { e.target.innerText = originalText; }, 2000);
        }
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [chats]);

  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId) || null, [chats, activeChatId]);

  const createNewChat = () => {
    const id = generateId();
    setChats(prev => [{ id, title: 'Fragmen Memori', messages: [], createdAt: Date.now() }, ...prev]);
    setActiveChatId(id);
    setErrorStatus(null);
    setIsSidebarOpen(false);
  };

  const handleApiKeyChange = (val) => {
    setApiKey(val);
    localStorage.setItem('NIGHTX_API_KEY', val);
    setErrorStatus(null);
  };

  const fetchWithRetry = async (url, options, retries = 5, backoff = 1000) => {
    try {
      const response = await fetch(url, options);
      if (response.status === 401) throw new Error("UNAUTHORIZED");
      if (!response.ok && retries > 0) throw new Error("RETRY");
      return response;
    } catch (err) {
      if (err.message === "UNAUTHORIZED") throw err;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw err;
    }
  };

  const onSendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    setErrorStatus(null);

    if (!apiKey) {
      setErrorStatus("API Key Hilang");
      return;
    }

    const userMsg = { id: generateId(), role: 'user', content: input, timestamp: Date.now() };
    setChats(prev => prev.map(c => c.id === activeChatId ? {
      ...c, 
      messages: [...c.messages, userMsg],
      title: c.messages.length === 0 ? input.slice(0, 20) : c.title
    } : c));

    const history = [...(activeChat?.messages || []), userMsg];
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetchWithRetry("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${apiKey}`, 
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "NightXGPT"
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-chat-v3.1",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...history.map(m => ({ role: m.role, content: m.content }))
          ],
          stream: true
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiContent = "";
      const aiId = generateId();

      setChats(prev => prev.map(c => c.id === activeChatId ? {
        ...c, messages: [...c.messages, { id: aiId, role: 'assistant', content: '', timestamp: Date.now() }]
      } : c));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          if (line.includes('[DONE]')) break;
          try {
            const data = JSON.parse(line.slice(6));
            aiContent += data.choices[0]?.delta?.content || "";
            setChats(prev => prev.map(c => c.id === activeChatId ? {
              ...c, messages: c.messages.map(m => m.id === aiId ? { ...m, content: aiContent } : m)
            } : c));
          } catch {}
        }
      }
    } catch (err) {
      const msg = err.message === "UNAUTHORIZED" 
        ? "⚠️ **ERROR 401**: Akses ditolak. Cek API Key."
        : "⚠️ **SIGNAL LOST**: Gagal menghubungi void.";
      setErrorStatus(err.message === "UNAUTHORIZED" ? "401: Unauthorized" : "Connection Error");
      setChats(prev => prev.map(c => c.id === activeChatId ? {
        ...c, messages: [...c.messages, { id: generateId(), role: 'assistant', content: msg }]
      } : c));
    } finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen w-full bg-[#050000] text-red-50 font-sans flex items-center justify-center p-0 sm:p-4 md:p-8 relative selection:bg-red-900/30">
      {/* BACKGROUND DECOR */}
      <div className="fixed inset-0 pointer-events-none opacity-20 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-900/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-950/20 blur-[120px] rounded-full"></div>
      </div>

      {/* CENTERED CONTAINER */}
      <div className="w-full max-w-5xl h-[100vh] sm:h-[85vh] bg-[#0a0a0a] border border-red-950/30 sm:rounded-3xl shadow-[0_0_50px_rgba(0,0,0,1)] flex overflow-hidden relative z-10">
        
        {/* MOBILE OVERLAY SIDEBAR */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
            />
          )}
        </AnimatePresence>

        {/* SIDEBAR */}
        <aside className={`
          absolute lg:relative w-72 h-full bg-[#080808] border-r border-red-950/20 flex flex-col z-50 transition-transform duration-300
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-6 border-b border-red-950/10 flex items-center justify-between">
            <h1 className="text-xl font-black text-red-700 italic flex items-center gap-2">
              NIGHT<span className="text-white">X</span>
            </h1>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-zinc-500"><X size={20}/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            <button onClick={createNewChat} className="w-full flex items-center justify-center gap-2 p-3 bg-red-950/10 border border-red-900/30 rounded-xl hover:bg-red-900/20 text-[10px] font-bold uppercase tracking-[0.2em] transition-all mb-4">
              <Plus size={14} /> NEW SESSION
            </button>
            {chats.map(chat => (
              <div key={chat.id} onClick={() => { setActiveChatId(chat.id); setIsSidebarOpen(false); }} className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${activeChatId === chat.id ? 'bg-red-950/20 text-red-500 border border-red-900/20 shadow-lg' : 'text-zinc-500 hover:bg-zinc-900/50'}`}>
                <div className="flex items-center gap-3 truncate text-[11px] font-mono uppercase tracking-tighter">
                  <MessageSquare size={14} className={activeChatId === chat.id ? 'text-red-600' : 'text-zinc-700'} /> 
                  <span className="truncate">{chat.title}</span>
                </div>
                <Trash2 size={12} className="opacity-0 group-hover:opacity-100 hover:text-red-600" onClick={(e) => { e.stopPropagation(); setChats(chats.filter(c => c.id !== chat.id)); }} />
              </div>
            ))}
          </div>

          <div className="p-6 bg-black/40 border-t border-red-950/10">
            <div className="flex items-center gap-2 mb-3">
              <Settings size={12} className="text-red-900" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-red-900">Config</span>
            </div>
            <input 
              type="password" 
              placeholder="API KEY" 
              value={apiKey} 
              onChange={e => handleApiKeyChange(e.target.value)} 
              className={`w-full bg-[#050505] border p-2.5 rounded-lg text-[10px] outline-none transition-all ${errorStatus ? 'border-red-600 text-red-400' : 'border-red-950/20 focus:border-red-600 text-red-200'}`} 
            />
            {errorStatus && <p className="text-[8px] text-red-600 mt-2 font-mono uppercase text-center animate-pulse">{errorStatus}</p>}
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a] relative">
          <header className="h-16 border-b border-red-950/10 flex items-center px-6 justify-between z-10 bg-black/10 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-red-600"><Menu size={20} /></button>
              <div className="flex flex-col">
                <span className="text-[9px] text-zinc-600 font-mono tracking-[0.3em] uppercase leading-none mb-1">Status</span>
                <span className="text-xs text-red-500 font-black uppercase tracking-tighter italic">{isLoading ? 'Syncing...' : 'Stable'}</span>
              </div>
            </div>
            <div className="h-8 w-8 rounded-lg bg-red-950/10 border border-red-900/20 flex items-center justify-center">
              <Ghost size={16} className="text-red-600 animate-pulse" />
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-10 py-10 space-y-8 custom-scrollbar scroll-smooth">
            <div className="max-w-3xl mx-auto w-full">
              {activeChat?.messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-10 py-32 pointer-events-none select-none text-center">
                  <Ghost size={80} className="text-red-700 mb-6" />
                  <h2 className="text-3xl font-black italic tracking-tighter text-red-600 mb-2">NIGHTX</h2>
                  <p className="text-[10px] font-mono uppercase tracking-[0.6em]">Waiting for transmission</p>
                </div>
              ) : (
                activeChat?.messages.map((m) => (
                  <div key={m.id} className={`flex w-full ${m.role === 'assistant' ? 'justify-start' : 'justify-end animate-in fade-in slide-in-from-bottom-2 duration-300'}`}>
                     <div className={`flex max-w-[95%] sm:max-w-[85%] ${m.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'}`}>
                        <div className={`flex-shrink-0 h-9 w-9 rounded-xl flex items-center justify-center mt-1 border ${m.role === 'assistant' ? 'bg-black border-red-900/50 text-red-600' : 'bg-red-800 border-red-500 text-white'}`}>
                          {m.role === 'assistant' ? <Ghost size={16} /> : <Terminal size={16} />}
                        </div>
                        <div className={`mx-3 px-5 py-4 rounded-2xl text-[13px] leading-relaxed ${m.role === 'assistant' ? 'bg-zinc-900/30 border border-red-950/30 text-red-50/90' : 'bg-red-900/20 border border-red-600/30 text-white shadow-xl'}`}>
                           <div className="prose prose-invert prose-red max-w-none" dangerouslySetInnerHTML={{ __html: parseMarkdown(m.content).html }} />
                        </div>
                     </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex items-center gap-3 ml-12 text-red-700 text-[10px] font-mono animate-pulse tracking-[0.2em] uppercase">
                  <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping"></div>
                  Processing transmission...
                </div>
              )}
            </div>
          </div>

          <footer className="p-6 sm:p-10 bg-gradient-to-t from-black via-[#0a0a0a] to-transparent">
            <div className="max-w-3xl mx-auto relative">
              <div className={`relative bg-[#050505] border rounded-2xl p-2 transition-all duration-500 ${errorStatus ? 'border-red-600' : 'border-red-950/40 focus-within:border-red-600/60'}`}>
                <form onSubmit={onSendMessage} className="flex items-end p-1">
                  <textarea 
                    value={input} 
                    onChange={e => setInput(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), onSendMessage())}
                    placeholder="Enter command..."
                    className="flex-1 bg-transparent p-3 outline-none text-[13px] text-red-50 max-h-48 custom-scrollbar placeholder:text-zinc-800 min-h-[44px]"
                    rows={1}
                  />
                  <button 
                    type="submit" 
                    disabled={isLoading || !input.trim()} 
                    className="bg-red-900 hover:bg-red-700 p-3.5 rounded-xl text-white ml-2 transition-all disabled:opacity-5 active:scale-95"
                  >
                    <Send size={20} />
                  </button>
                </form>
              </div>
            </div>
          </footer>
        </main>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #2a0000; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6a0000; }
        textarea { field-sizing: content; }
        
        @media (max-width: 640px) {
          .sm\\:h-\\[85vh\\] { height: 100vh !important; }
          .sm\\:rounded-3xl { border-radius: 0 !important; }
        }
      `}} />
    </div>
  );
}
