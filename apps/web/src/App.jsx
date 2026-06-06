import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Plus,
  Trash2,
  FileText,
  Upload,
  Sparkles,
  Loader2,
  FileCode,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sun,
  Moon,
  Search,
  Database,
  Cpu,
  Activity,
  Pencil,
  Check,
  X,
  FileUp,
  Inbox,
  Globe,
  Layers,
  ChevronRight,
  BookOpen,
  Menu
} from 'lucide-react';

import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card } from './components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog';

// Custom Markdown Inline Style Parser
const parseInlineMarkdown = (text) => {
  if (!text) return '';
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|https?:\/\/[^\s]+)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-bold text-slate-900 dark:text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    } else if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={index} className="italic text-slate-800 dark:text-slate-200">
          {part.slice(1, -1)}
        </em>
      );
    } else if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="px-1.5 py-0.5 rounded font-mono text-xs bg-slate-100 dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-800">
          {part.slice(1, -1)}
        </code>
      );
    } else if (part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5">
          {part}
          <Globe className="h-3 w-3 inline" />
        </a>
      );
    } else {
      return part;
    }
  });
};

// Custom Markdown Renderer Component
const Markdown = ({ text, streaming }) => {
  if (!text) return null;
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    const isLastPart = index === parts.length - 1;
    if (part.startsWith('```') && part.endsWith('```')) {
      const match = part.match(/```(\w*)\n([\s\S]*?)```/);
      const language = match ? match[1] : '';
      const code = match ? match[2] : part.slice(3, -3);
      const [copied, setCopied] = useState(false);

      const handleCopy = () => {
        navigator.clipboard.writeText(code.trim());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      };

      return (
        <div key={index} className="relative my-4 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs shadow-sm">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 select-none">
            <span className="font-semibold uppercase tracking-wider">{language || 'code'}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus:outline-none"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-500">Copied!</span>
                </>
              ) : (
                <>
                  <FileCode className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-4 overflow-x-auto whitespace-pre"><code className="text-slate-800 dark:text-slate-200">{code.trim()}</code></pre>
          {isLastPart && streaming && (
            <div className="px-4 pb-2 text-slate-400">
              <span className="inline-block w-1.5 h-3 bg-indigo-500 dark:bg-indigo-400 animate-pulse"></span>
            </div>
          )}
        </div>
      );
    } else {
      const lines = part.split('\n');
      let renderedElements = [];
      let currentList = [];
      let listType = null;

      const flushList = (key) => {
        if (currentList.length > 0) {
          if (listType === 'ul') {
            renderedElements.push(
              <ul key={`list-ul-${key}`} className="list-disc pl-5 mb-4 space-y-1 text-slate-700 dark:text-slate-200">
                {currentList}
              </ul>
            );
          } else if (listType === 'ol') {
            renderedElements.push(
              <ol key={`list-ol-${key}`} className="list-decimal pl-5 mb-4 space-y-1 text-slate-700 dark:text-slate-200">
                {currentList}
              </ol>
            );
          }
          currentList = [];
          listType = null;
        }
      };

      lines.forEach((line, lineIdx) => {
        const isLastLine = isLastPart && lineIdx === lines.length - 1;

        // Headers check
        const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headerMatch) {
          flushList(lineIdx);
          const level = headerMatch[1].length;
          const content = parseInlineMarkdown(headerMatch[2]);
          const classes = level === 1
            ? "text-2xl font-bold mt-4 mb-2 text-slate-950 dark:text-slate-50"
            : level === 2
              ? "text-xl font-bold mt-4 mb-2 text-slate-900 dark:text-slate-100"
              : "text-lg font-bold mt-3 mb-1.5 text-slate-900 dark:text-slate-200";

          const HeadingTag = `h${Math.min(level, 4)}`;
          renderedElements.push(
            React.createElement(HeadingTag, { key: lineIdx, className: classes }, [
              content,
              isLastLine && streaming && <span key="cursor" className="inline-block w-1.5 h-5 bg-indigo-500 dark:bg-indigo-400 animate-pulse ml-1 align-middle"></span>
            ])
          );
          return;
        }

        // Unordered list item check
        const ulMatch = line.match(/^[-*+]\s+(.*)$/);
        if (ulMatch) {
          if (listType !== 'ul') {
            flushList(lineIdx);
            listType = 'ul';
          }
          currentList.push(
            <li key={`li-${lineIdx}`} className="leading-relaxed text-slate-700 dark:text-slate-200">
              {parseInlineMarkdown(ulMatch[1])}
              {isLastLine && streaming && <span className="inline-block w-1.5 h-3.5 bg-indigo-500 dark:bg-indigo-400 animate-pulse ml-1 align-middle"></span>}
            </li>
          );
          return;
        }

        // Ordered list item check
        const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
        if (olMatch) {
          if (listType !== 'ol') {
            flushList(lineIdx);
            listType = 'ol';
          }
          currentList.push(
            <li key={`li-${lineIdx}`} className="leading-relaxed text-slate-700 dark:text-slate-200">
              {parseInlineMarkdown(olMatch[2])}
              {isLastLine && streaming && <span className="inline-block w-1.5 h-3.5 bg-indigo-500 dark:bg-indigo-400 animate-pulse ml-1 align-middle"></span>}
            </li>
          );
          return;
        }

        // Empty line check
        if (line.trim() === '') {
          flushList(lineIdx);
          return;
        }

        // Normal paragraph text
        flushList(lineIdx);
        renderedElements.push(
          <p key={lineIdx} className="mb-3 leading-relaxed text-slate-700 dark:text-slate-200">
            {parseInlineMarkdown(line)}
            {isLastLine && streaming && <span className="inline-block w-1.5 h-4 bg-indigo-500 dark:bg-indigo-400 animate-pulse ml-1 align-middle"></span>}
          </p>
        );
      });

      flushList(lines.length);
      return <div key={index}>{renderedElements}</div>;
    }
  });
};

const generateObjectId = () => {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const random = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return timestamp + random;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState([]);

  // Theme Management
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Editing Session Title
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitleInput, setEditTitleInput] = useState('');

  // Pipeline Health Monitor
  const [healthStatus, setHealthStatus] = useState({
    gateway: 'loading',
    pythonService: 'loading',
    mongodb: 'loading'
  });

  // Drag-and-drop Ingest
  const [isDragging, setIsDragging] = useState(false);

  // Mobile Sidebar Drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Toast notifications state
  const [toasts, setToasts] = useState([]);
  const toast = ({ title, description, variant = 'default' }) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, description, variant }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Request Abort Ref
  const abortControllerRef = useRef(null);
  const isInternalSessionChangeRef = useRef(false);

  // Ingest form state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadStatus, setUploadStatus] = useState({ type: '', message: '' });
  const [showUploadModal, setShowUploadModal] = useState(false);

  const messagesEndRef = useRef(null);

  // Apply Theme Toggle
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Fetch all sessions and documents on mount
  useEffect(() => {
    fetchSessions();
    fetchUploadedDocs();
    checkPipelineHealth();

    // Check pipeline health every 15 seconds
    const healthInterval = setInterval(checkPipelineHealth, 15000);
    return () => clearInterval(healthInterval);
  }, []);

  // Fetch messages when current session changes
  useEffect(() => {
    if (currentSessionId) {
      if (isInternalSessionChangeRef.current) {
        isInternalSessionChangeRef.current = false;
        return;
      }
      fetchSessionDetails(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkPipelineHealth = async () => {
    try {
      const res = await fetch(`${API_URL}/api/health`);
      if (res.ok) {
        const data = await res.json();
        setHealthStatus({
          gateway: data.gateway || 'healthy',
          pythonService: data.pythonService || 'offline',
          mongodb: data.mongodb || 'disconnected'
        });
      } else {
        setHealthStatus({ gateway: 'error', pythonService: 'offline', mongodb: 'disconnected' });
      }
    } catch (err) {
      setHealthStatus({ gateway: 'offline', pythonService: 'offline', mongodb: 'disconnected' });
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0 && !currentSessionId) {
          setCurrentSessionId(data[0]._id);
        }
      }
    } catch (err) {
      console.error("Error fetching sessions:", err);
    }
  };

  const fetchSessionDetails = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Error fetching session details:", err);
    }
  };

  const createNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setIsSidebarOpen(false);
  };

  const deleteSession = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_URL}/api/sessions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const updated = sessions.filter(s => s._id !== id);
        setSessions(updated);
        if (currentSessionId === id) {
          setCurrentSessionId(updated.length > 0 ? updated[0]._id : null);
        }
        toast({
          title: "Session Deleted",
          description: "The conversation was deleted.",
          variant: "success"
        });
      } else {
        toast({
          title: "Delete Failed",
          description: "Failed to delete the session.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error("Error deleting session:", err);
      toast({
        title: "Error",
        description: "Network error occurred.",
        variant: "destructive"
      });
    }
  };

  const clearAllHistory = async () => {
    if (!window.confirm("Are you sure you want to clear ALL chat history? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API_URL}/api/sessions`, { method: 'DELETE' });
      if (res.ok) {
        setSessions([]);
        setCurrentSessionId(null);
        setMessages([]);
        toast({
          title: "History Cleared",
          description: "All chat sessions deleted.",
          variant: "success"
        });
      } else {
        toast({
          title: "Clear History Failed",
          description: "Failed to clear history.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error("Error clearing sessions:", err);
      toast({
        title: "Error",
        description: "Network error occurred.",
        variant: "destructive"
      });
    }
  };

  const startEditingSession = (id, title, e) => {
    e.stopPropagation();
    setEditingSessionId(id);
    setEditTitleInput(title || 'New Conversation');
  };

  const saveSessionRename = async (id) => {
    if (!editTitleInput.trim()) {
      setEditingSessionId(null);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitleInput.trim() })
      });
      if (res.ok) {
        setSessions(prev => prev.map(s => s._id === id ? { ...s, title: editTitleInput.trim() } : s));
        toast({
          title: "Session Renamed",
          description: `Saved as "${editTitleInput.trim()}"`,
          variant: "success"
        });
      }
    } catch (err) {
      console.error("Error renaming session:", err);
    } finally {
      setEditingSessionId(null);
    }
  };

  const fetchUploadedDocs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/documents`);
      if (res.ok) {
        const data = await res.json();
        setUploadedDocs(data.documents || []);
      }
    } catch (err) {
      console.error("Error fetching documents list:", err);
    }
  };

  useEffect(() => {
    if (showUploadModal) {
      fetchUploadedDocs();
    }
  }, [showUploadModal]);

  const deleteDocument = async (title) => {
    try {
      const res = await fetch(`${API_URL}/api/documents/${encodeURIComponent(title)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchUploadedDocs();
        toast({
          title: "Document Deleted",
          description: `"${title}" was deleted from knowledge.`,
          variant: "success"
        });
      } else {
        const data = await res.json();
        toast({
          title: "Error",
          description: data.error || "Failed to delete document.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error("Error deleting document:", err);
      toast({
        title: "Error",
        description: "Network error occurred.",
        variant: "destructive"
      });
    }
  };

  const handleUpload = async (e) => {
    if (e) e.preventDefault();
    if (!uploadFile) {
      setUploadStatus({ type: 'error', message: 'Please select a file to upload.' });
      return;
    }

    setIsUploading(true);
    setUploadStatus({ type: '', message: '' });

    const formData = new FormData();
    formData.append('file', uploadFile);
    if (uploadTitle) {
      formData.append('title', uploadTitle);
    }

    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        toast({
          title: "Document Ingested",
          description: `Successfully ingested "${uploadFile.name}"`,
          variant: "success"
        });
        setUploadStatus({ type: 'success', message: `Successfully ingested "${data.message || uploadFile.name}"` });
        setUploadFile(null);
        setUploadTitle('');
        fetchUploadedDocs();
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadStatus({ type: '', message: '' });
        }, 2000);
      } else {
        toast({
          title: "Ingestion Failed",
          description: data.error || 'Failed to ingest file.',
          variant: "destructive"
        });
        setUploadStatus({ type: 'error', message: data.error || 'Failed to ingest file.' });
      }
    } catch (err) {
      toast({
        title: "Upload Error",
        description: 'Network error occurred during upload.',
        variant: "destructive"
      });
      setUploadStatus({ type: 'error', message: 'Network error occurred during upload.' });
    } finally {
      setIsUploading(false);
    }
  };

  // Drag and Drop files handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split('.').pop().toLowerCase();
      if (['txt', 'md', 'pdf'].includes(ext)) {
        setUploadFile(file);
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
        setUploadStatus({ type: '', message: '' });
      } else {
        setUploadStatus({ type: 'error', message: 'Unsupported file type. Please upload TXT, MD, or PDF.' });
      }
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    triggerSendDirect(input.trim());
  };

  const triggerSendDirect = async (userQuery) => {
    setInput('');
    setIsLoading(true);

    // Create abort controller for this specific request
    abortControllerRef.current = new AbortController();

    // Generate session ID on client if not present to avoid duplicate sessions
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      activeSessionId = generateObjectId();
      isInternalSessionChangeRef.current = true;
      setCurrentSessionId(activeSessionId);
    }

    // Append user message AND assistant placeholder immediately (so it starts thinking instantly!)
    const tempUserMsg = { role: 'user', content: userQuery, createdAt: new Date() };
    const placeholderMsg = { role: 'assistant', content: '', sources: [], streaming: true };
    setMessages(prev => [...prev, tempUserMsg, placeholderMsg]);

    let currentResponseContent = '';
    let currentSources = [];

    try {
      const response = await fetch(`${API_URL}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userQuery,
          sessionId: activeSessionId
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || 'Failed to start response stream';
        toast({
          title: "Request Failed",
          description: errorMsg,
          variant: "destructive"
        });
        throw new Error(errorMsg);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const events = streamBuffer.split('\n\n');
        streamBuffer = events.pop(); // Save incomplete trailing event

        for (const event of events) {
          if (!event.trim()) continue;

          const lines = event.split('\n');
          let eventType = 'message';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.substring(7).trim();
            } else if (line.startsWith('data: ')) {
              eventData = line.substring(6).trim();
            }
          }

          if (eventData === '[DONE]') continue;

          try {
            const parsed = JSON.parse(eventData);

            if (eventType === 'session') {
              activeSessionId = parsed.sessionId;
              isInternalSessionChangeRef.current = true;
              setCurrentSessionId(activeSessionId);
            } else if (eventType === 'sources') {
              currentSources = parsed;
              setMessages(prev => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0 && next[lastIdx].role === 'assistant') {
                  const isFallback = (next[lastIdx].content || "").includes("I cannot find the answer");
                  next[lastIdx] = {
                    ...next[lastIdx],
                    sources: isFallback ? [] : parsed
                  };
                }
                return next;
              });
            } else if (eventType === 'message') {
              currentResponseContent += parsed;

              // Parse LLM-side sources if appended at the end (resilient with or without brackets)
              let displaySources = currentSources;
              let cleanResponseContent = currentResponseContent;
              const sourceMatch = currentResponseContent.match(/Sources Used:\s*\[(.*?)\]/i) ||
                currentResponseContent.match(/Sources Used:\s*([a-zA-Z0-9_\-\s,]+)$/i);
              if (sourceMatch) {
                const sourcesStr = sourceMatch[1];
                displaySources = sourcesStr.split(',').map(s => s.trim()).filter(Boolean);
                cleanResponseContent = currentResponseContent.replace(/Sources Used:\s*\[?.*?\]?(?:\s*$|\s*\n*$)/i, '').trim();
              }

              // Update last message
              setMessages(prev => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0 && next[lastIdx].role === 'assistant') {
                  const isFallback = cleanResponseContent.includes("I cannot find the answer");
                  next[lastIdx] = {
                    ...next[lastIdx],
                    content: cleanResponseContent,
                    sources: isFallback ? [] : displaySources
                  };
                }
                return next;
              });
            } else if (eventType === 'error') {
              currentResponseContent = `Error: ${parsed}`;
              setMessages(prev => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0 && next[lastIdx].role === 'assistant') {
                  next[lastIdx] = {
                    ...next[lastIdx],
                    content: currentResponseContent
                  };
                }
                return next;
              });
            }
          } catch (e) {
            // Ignore parse errors for partial events
          }
        }
      }

      // Complete
      setMessages(prev => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (lastIdx >= 0) {
          delete next[lastIdx].streaming;
          let content = next[lastIdx].content || '';
          let displaySources = next[lastIdx].sources || [];
          const sourceMatch = content.match(/Sources Used:\s*\[(.*?)\]/i) ||
            content.match(/Sources Used:\s*([a-zA-Z0-9_\-\s,]+)$/i);
          if (sourceMatch) {
            const sourcesStr = sourceMatch[1];
            displaySources = sourcesStr.split(',').map(s => s.trim()).filter(Boolean);
            content = content.replace(/Sources Used:\s*\[?.*?\]?(?:\s*$|\s*\n*$)/i, '').trim();
          }
          const isFallback = content.includes("I cannot find the answer");
          next[lastIdx].content = content;
          next[lastIdx].sources = isFallback ? [] : displaySources;
        }
        return next;
      });
      fetchSessions();

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request aborted successfully.');
      } else {
        console.error("Streaming error:", error);
        toast({
          title: "Streaming Failed",
          description: error.message || "Failed to stream message from assistant.",
          variant: "destructive"
        });
        setMessages(prev => {
          const next = [...prev];
          const lastIdx = next.length - 1;
          if (lastIdx >= 0 && next[lastIdx].role === 'assistant') {
            next[lastIdx] = {
              role: 'assistant',
              content: error.message || 'Connection lost. Please check backend services.',
              sources: []
            };
            return next;
          }
          return [...prev, { role: 'assistant', content: error.message || 'Connection lost. Please check backend services.' }];
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Filter sessions based on search query
  const filteredSessions = sessions.filter(s =>
    (s.title || 'New Conversation').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render Status Badge utility
  const renderStatus = (status) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'Connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 glow-pulse"></span>
            Online
          </span>
        );
      case 'loading':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Checking
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
            Offline
          </span>
        );
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-300 relative">

      {/* Mobile Sidebar Backdrop Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 md:relative md:flex w-80 border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 flex-col transition-transform duration-300 ease-in-out shrink-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}>

        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg text-indigo-600 dark:text-indigo-400">
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg">
              <Sparkles className="h-5 w-5 animate-pulse text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="font-semibold tracking-tight">SupportAI Agent</span>
          </div>

          <div className="flex items-center gap-1">
            {/* Close button for mobile drawer */}
            <Button
              onClick={() => setIsSidebarOpen(false)}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
              title="Close menu"
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Theme Toggle */}
            <Button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-600" />}
            </Button>

            <Button
              onClick={createNewChat}
              variant="outline"
              size="icon"
              className="h-8 w-8 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/60"
              title="New Chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <Input
              type="text"
              placeholder="Search chat history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 dark:focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">History</span>
            {sessions.length > 0 && (
              <button
                onClick={clearAllHistory}
                className="text-[10px] font-medium text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                title="Clear all history"
              >
                Clear All
              </button>
            )}
          </div>
          {filteredSessions.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50/50 dark:bg-slate-900/10 rounded-lg border border-dashed border-slate-200 dark:border-slate-850 p-4">
              {searchQuery ? "No matches found" : "No past conversations"}
            </div>
          ) : (
            filteredSessions.map(s => {
              const isEditing = editingSessionId === s._id;
              const isActive = currentSessionId === s._id;

              return (
                <div
                  key={s._id}
                  onClick={() => { if (!isEditing) { setCurrentSessionId(s._id); setIsSidebarOpen(false); } }}
                  className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${isActive
                    ? 'bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/30 text-indigo-950 dark:text-indigo-200 font-medium shadow-sm'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-900/60 text-slate-600 dark:text-slate-400 border border-transparent'
                    }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
                    <MessageSquare className={`h-4 w-4 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'}`} />
                    {isEditing ? (
                      <input
                        type="text"
                        value={editTitleInput}
                        onChange={(e) => setEditTitleInput(e.target.value)}
                        onBlur={() => saveSessionRename(s._id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveSessionRename(s._id);
                          if (e.key === 'Escape') setEditingSessionId(null);
                        }}
                        autoFocus
                        className="bg-white dark:bg-slate-950 text-xs px-1.5 py-0.5 rounded border border-indigo-500 dark:border-indigo-700 outline-none w-full text-slate-800 dark:text-slate-200 font-normal"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className="truncate text-xs select-none"
                        onDoubleClick={(e) => startEditingSession(s._id, s.title, e)}
                        title="Double-click to rename"
                      >
                        {s.title || 'Untitled Session'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0 gap-0.5">
                    {!isEditing && (
                      <button
                        onClick={(e) => startEditingSession(s._id, s.title, e)}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                        title="Rename conversation"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => deleteSession(s._id, e)}
                      className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400"
                      title="Delete conversation"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <Button
            onClick={() => setShowUploadModal(true)}
            variant="secondary"
            className="w-full justify-center gap-2 font-medium bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-sm text-slate-700 dark:text-slate-300 transition-colors duration-300"
          >
            <Upload className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>Manage Knowledge</span>
          </Button>
        </div>
      </div>

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 relative transition-colors duration-300">

        {/* App Header */}
        <div className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-10 transition-colors duration-300">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Hamburger Menu toggle for mobile responsive layouts */}
            <Button
              onClick={() => setIsSidebarOpen(true)}
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
              title="Open Sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${healthStatus.gateway === 'healthy' ? 'bg-emerald-500 glow-pulse' : 'bg-rose-500'}`}></span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pipeline Status</span>
            </div>

            {/* Quick badges in header */}
            <div className="hidden sm:flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-3">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Gateway:</span>
              <span className={`w-1.5 h-1.5 rounded-full ${healthStatus.gateway === 'healthy' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1">AI Engine:</span>
              <span className={`w-1.5 h-1.5 rounded-full ${healthStatus.pythonService === 'healthy' || healthStatus.pythonService === 'Connected' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1">Vector DB:</span>
              <span className={`w-1.5 h-1.5 rounded-full ${healthStatus.mongodb === 'connected' || healthStatus.mongodb === 'Connected' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            <Layers className="h-3.5 w-3.5 text-indigo-500" />
            <span className="font-mono">RAG Stack Online</span>
          </div>
        </div>

        {/* Chat History / Stream Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="max-w-3xl mx-auto mt-6 space-y-8 fade-enter fade-enter-active">

              {/* Dashboard Hero */}
              <div className="text-center space-y-4 max-w-xl mx-auto">
                <div className="inline-flex p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 shadow-sm">
                  <Sparkles className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                    SupportAI Intelligent Assistant
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Ask questions about company documentation, guidelines, or manuals. The system runs real-time semantic searches against vector stores.
                  </p>
                </div>
              </div>

              {/* RAG Pipeline Status Panel */}
              <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4.5 w-4.5 text-indigo-500" />
                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">System Dashboard</span>
                  </div>
                  <button
                    onClick={checkPipelineHealth}
                    className="text-xs text-indigo-500 hover:text-indigo-600 flex items-center gap-1 font-medium bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-800"
                  >
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Express API Gateway</span>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Node Gateway</span>
                      {renderStatus(healthStatus.gateway)}
                    </div>
                  </div>

                  <div className="flex flex-col p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">FastAPI AI Service</span>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Python Worker</span>
                      {renderStatus(healthStatus.pythonService)}
                    </div>
                  </div>

                  <div className="flex flex-col p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">Vector database</span>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">MongoDB Atlas</span>
                      {renderStatus(healthStatus.mongodb)}
                    </div>
                  </div>
                </div>

                {/* Library Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg text-indigo-500">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">Knowledge Library</div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {uploadedDocs.length} {uploadedDocs.length === 1 ? 'Manual' : 'Manuals'} Ingested
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 dark:bg-purple-950/20 rounded-lg text-purple-500">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">Active Discussions</div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {sessions.length} {sessions.length === 1 ? 'Session' : 'Sessions'} Logged
                      </div>
                    </div>
                  </div>
                </div>
              </Card>            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((m, index) => (
                <div
                  key={index}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} fade-enter fade-enter-active`}
                >
                  <div className={`max-w-[85%] rounded-2xl p-4 shadow-md ${m.role === 'user'
                    ? 'bg-indigo-600 dark:bg-indigo-700 text-white rounded-br-none'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none'
                    }`}>

                    {/* Message Content */}
                    <div className="prose prose-slate dark:prose-invert text-sm leading-relaxed whitespace-pre-wrap">
                      {m.content ? (
                        m.role === 'assistant' ? (
                          <Markdown text={m.content} streaming={m.streaming} />
                        ) : (
                          m.content
                        )
                      ) : (
                        m.streaming ? (
                          <div className="flex items-center gap-1.5 py-1">
                            <span className="w-2 h-2 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                            <span className="w-2 h-2 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                          </div>
                        ) : null
                      )}
                    </div>

                    {/* Sources / Citations */}
                    {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">
                          <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Sources Cited:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {m.sources.map((src, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 py-1 px-2.5 rounded-md text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 shadow-sm"
                            >
                              <FileCode className="h-3 w-3 text-indigo-500" />
                              {src}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors duration-300">
          <form onSubmit={handleSend} className="max-w-3xl mx-auto flex gap-3 items-center">
            <Input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask questions about company manuals..."
              className="flex-1 bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 dark:focus:border-indigo-500 shadow-inner h-11"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-11 px-5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white shadow-md border-transparent flex shrink-0 items-center justify-center rounded-lg"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </form>
          <div className="max-w-3xl mx-auto text-[10px] text-slate-400 dark:text-slate-500 text-center mt-1.5">
            RAG Pipeline dynamically searches vector index based on cosine similarity
          </div>
        </div>
      </div>

      {/* Upload Document Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="bg-white max-h-[90vh] overflow-y-auto dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 max-w-lg shadow-2xl" onClose={() => { setShowUploadModal(false); setUploadStatus({ type: '', message: '' }); }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-50 font-bold">
              <Upload className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <span>Reference Documents Management</span>
            </DialogTitle>
          </DialogHeader>

          {/* Form and Drop Zone */}
          <form onSubmit={handleUpload} className="space-y-4 mt-2 border-b border-slate-100 dark:border-slate-800 pb-6">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 dark:text-slate-500 mb-1.5">Document Title (Optional)</label>
              <Input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g. Employee Onboarding Manual"
                className="bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 dark:text-slate-500 mb-1.5">Select Document (.txt, .md, .pdf)</label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${isDragging
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-102 shadow-md'
                  : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 hover:dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40'
                  }`}
              >
                <input
                  type="file"
                  accept=".txt,.md,.pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      const file = e.target.files[0];
                      setUploadFile(file);
                      setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
                    }
                  }}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer text-center space-y-2 select-none">
                  <FileUp className={`h-10 w-10 mx-auto transition-transform ${isDragging ? 'animate-bounce text-indigo-500' : 'text-slate-400 dark:text-slate-500'}`} />
                  <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Click to browse or drag & drop</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">Supports TXT, MD, PDF up to 10MB</div>
                </label>
              </div>

              {uploadFile && (
                <div className="mt-3 text-xs flex items-center justify-between text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 p-2.5 rounded-lg truncate">
                  <div className="flex items-center gap-2 overflow-hidden mr-2">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate font-semibold">{uploadFile.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setUploadFile(null); setUploadTitle(''); }}
                    className="text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {uploadStatus.message && (
              <div className={`p-3 rounded-lg flex items-start gap-2.5 text-sm transition-all ${uploadStatus.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-rose-800 dark:text-rose-300'
                }`}>
                {uploadStatus.type === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                )}
                <span className="font-medium">{uploadStatus.message}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isUploading || !uploadFile}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md rounded-lg h-11 border-transparent"
              onClick={handleUpload}
            >
              {isUploading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Processing & Indexing Vector Chunks...</span>
                </>
              ) : (
                <span>Ingest to Vector DB</span>
              )}
            </Button>
          </form>

          {/* List of uploaded documents */}
          <div className="mt-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500 mb-2">Ingested Manuals ({uploadedDocs.length})</h4>
            <div className="max-h-36 overflow-y-auto space-y-2 pr-1.5">
              {uploadedDocs.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-900/20 rounded-lg border border-slate-100 dark:border-slate-800 p-4">
                  <Inbox className="h-8 w-8 text-slate-400 dark:text-slate-600 mx-auto mb-1" />
                  No documents uploaded yet
                </div>
              ) : (
                uploadedDocs.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors bg-white dark:bg-slate-900 shadow-sm">
                    <div className="flex items-center gap-2.5 overflow-hidden mr-4">
                      <div className="p-1 bg-indigo-50 dark:bg-indigo-950/40 rounded text-indigo-600 dark:text-indigo-400">
                        <FileText className="h-4 w-4 shrink-0" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{doc.title}</span>
                    </div>
                    <Button
                      onClick={() => deleteDocument(doc.title)}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 shrink-0"
                      title="Delete document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast Notifications Overlay Container */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full items-start gap-3 rounded-lg border p-4 shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${t.variant === 'destructive'
              ? 'bg-rose-600 border-rose-500 text-white dark:bg-rose-950 dark:border-rose-900 dark:text-rose-100'
              : t.variant === 'success'
                ? 'bg-emerald-600 border-emerald-500 text-white dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-100'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100'
              }`}
          >
            <div className="flex-1">
              {t.title && <h5 className="font-semibold text-sm leading-none tracking-tight mb-1">{t.title}</h5>}
              {t.description && <p className="text-xs opacity-90 leading-normal">{t.description}</p>}
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
              className="text-white/85 hover:text-white dark:text-slate-400 dark:hover:text-slate-200 transition-colors focus:outline-none shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
