import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, Plus, MessageSquare, Trash2, 
  Terminal, Paperclip, X, Menu, Ghost, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * NIGHTXGPT - VERCEL DEPLOYMENT EDITION
 * Perbaikan: Penanganan variabel lingkungan untuk target ES2015
 */

const STORAGE_KEY = 'NIGHTX_V1_DATA';
const generateId = () => Math.random().toString(36).substring(2, 15);

const parseMarkdown = (text) => {
  if (!text) return "";
  let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  
  // Code block rendering
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<div class="my-4 rounded border border-red-900/40 bg-black/80 font-mono text-[11px] overflow-hidden">
      <div class="flex justify-between bg-red-950/20 px-3 py-1.5 border-b border-red-900/20 text-red-500 uppercase">
        <span>${lang || 'terminal'}</span>
        <button class="hover:text-white" onclick="navigator.clipboard.writeText(atob('${btoa(code)}'))">COPY</button>
      </div>
      <pre class="p-4 overflow-x-auto text-red-100/90">${code.trim()}</pre>
    </div>`;
  });

  html = html.replace(/`([^`]+)`/g, '<code class="bg-red-950/40 text-red-400 px-1 rounded font-mono font-bold">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b class="text-red-600 font-bold">$1</b>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-lg font-black text-red-600 mb-2 border-b border-red-950">$1</h1>');
  
  return html.replace(/\n/g, '<br />');
};

export default function App() {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  // Perbaikan akses variabel lingkungan untuk kompatibilitas kompilasi
  const [apiKey, setApiKey] = useState(() => {
    try {
      // Menggunakan pengecekan opsional untuk menghindari error kompilasi pada target lama
      const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
      return env.VITE_OPENROUTER_API_KEY || '';
    } catch (e) {
      return '';
    }
  });
  
  const scrollRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setChats(parsed);
      if (parsed.length > 0) setActiveChatId(parsed[0].id);
    } else { createNewChat(); }
  }, []);

  useEffect(() => {
    if (chats.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chats, isLoading]);

  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId) || null, [chats, activeChatId]);

  const createNewChat = () => {
    const id = generateId();
    setChats(prev => [{ id, title: 'Fragmen Memori', messages: [], createdAt: Date.now() }, ...prev]);
    setActiveChatId(id);
  };

  const onSendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    if (!apiKey) {
      const errorMsg = { 
        id: generateId(), 
        role: 'assistant', 
        content: "⚠️ **PROTOKOL GAGAL**: API Key tidak terdeteksi. Pastikan variabel `VITE_OPENROUTER_API_KEY` sudah diatur di Vercel atau masukkan secara manual di sidebar." 
      };
      setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...c.messages, { id: generateId(), role: 'user', content: input }, errorMsg] } : c));
      setInput('');
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
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
            { role: "system", content: "Kamu adalah NightXGPT. AI entitas horor cyberpunk. Bahasa dingin, singkat, dan teknis." },
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
    } catch {
      setChats(prev => prev.map(c => c.id === activeChatId ? {
        ...c, messages: [...c.messages, { id: generateId(), role: 'assistant', content: "⚠️ **SIGNAL LOST**." }]
      } : c));
    } finally { setIsLoading(false); }
  };

  return (
    <div className="flex w-screen h-screen bg-black text-red-50 font-sans overflow-hidden fixed inset-0">
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
            className="w-72 bg-zinc-950 border-r border-red-950/40 flex flex-col z-30 h-full flex-shrink-0"
          >
            <div className="p-6 border-b border-red-950/20 flex items-center justify-between">
              <h1 className="text-xl font-black text-red-600 italic tracking-tighter">NIGHT<span className="text-white">X</span></h1>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-zinc-600"><X size={18}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              <button onClick={createNewChat} className="w-full flex items-center justify-center gap-2 p-3 border border-red-600/40 rounded hover:bg-red-600/10 text-xs font-bold uppercase transition-all">
                <Plus size={14} /> Sesi Baru
              </button>
              {chats.map(chat => (
                <div key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`group flex items-center justify-between p-3 rounded cursor-pointer ${activeChatId === chat.id ? 'bg-red-950/20 text-red-500' : 'text-zinc-500 hover:bg-zinc-900'}`}>
                  <div className="flex items-center gap-3 truncate text-xs font-mono uppercase">
                    <MessageSquare size={14} /> <span className="truncate">{chat.title}</span>
                  </div>
                  <Trash2 size={12} className="opacity-0 group-hover:opacity-100 hover:text-red-600" onClick={(e) => { e.stopPropagation(); setChats(chats.filter(c => c.id !== chat.id)); }} />
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-red-950/30">
              <label className="text-[9px] text-red-900 font-black uppercase tracking-widest block mb-2">Manual Access</label>
              <input 
                type="password" 
                placeholder="API KEY" 
                value={apiKey} 
                onChange={e => setApiKey(e.target.value)} 
                className="w-full bg-zinc-900 border border-red-950/30 p-2 rounded text-[10px] focus:border-red-600 outline-none text-red-200" 
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col relative h-full min-w-0 bg-black">
        <header className="h-14 border-b border-red-950/20 flex items-center px-6 justify-between z-10">
          <button onClick={() => setIsSidebarOpen(true)} className={`${isSidebarOpen ? 'hidden' : 'block'} p-2 text-red-600`}><Menu size={18} /></button>
          <div className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">CONNECTION: SECURE</div>
          <Ghost size={16} className="text-red-900" />
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-10 space-y-6 custom-scrollbar">
          <div className="max-w-3xl mx-auto w-full">
            {activeChat?.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                <Ghost size={60} className="mb-4 text-red-700 animate-pulse" />
                <p className="text-xs font-mono uppercase tracking-[0.3em]">Siap menerima transmisi...</p>
              </div>
            ) : (
              activeChat?.messages.map((m) => (
                <div key={m.id} className={`flex w-full mb-8 ${m.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                   <div className={`flex max-w-[90%] ${m.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'}`}>
                      <div className={`mx-3 px-4 py-2 rounded-lg text-sm ${m.role === 'assistant' ? 'bg-zinc-900 border border-red-950 text-red-100' : 'bg-red-900/20 border border-red-600 text-white shadow-[0_0_15px_rgba(255,0,0,0.1)]'}`}>
                         <div dangerouslySetInnerHTML={{ __html: parseMarkdown(m.content) }} />
                      </div>
                   </div>
                </div>
              ))
            )}
            {isLoading && <div className="text-red-600 text-[10px] font-mono animate-pulse ml-4 tracking-widest uppercase">Menghubungkan ke Void...</div>}
          </div>
        </div>

        <footer className="p-6 bg-gradient-to-t from-black via-black to-transparent">
          <div className="max-w-3xl mx-auto relative">
            <form onSubmit={onSendMessage} className="flex items-center bg-zinc-950 border border-red-950/50 rounded-xl p-2 shadow-2xl focus-within:border-red-600 transition-all">
              <textarea 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), onSendMessage())}
                placeholder="Ketik perintah transmisi..." 
                className="flex-1 bg-transparent p-3 outline-none text-xs text-red-50 max-h-32 custom-scrollbar"
                rows={1}
              />
              <button 
                type="submit" 
                disabled={isLoading || !input.trim()} 
                className="bg-red-900/80 hover:bg-red-600 p-3 rounded-lg text-white ml-2 transition-all disabled:opacity-10"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </footer>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #2a0000; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #5a0000; }
        textarea { field-sizing: content; }
      `}} />
    </div>
  );
}