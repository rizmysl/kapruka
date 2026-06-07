import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

import { getParsedData, getDynamicGreeting } from './utils/helpers';
import { ImageWithFallback } from './components/common/ImageWithFallback';
import {
  SendIcon, SunIcon, MoonIcon, EditIcon, ChatIcon, HelpIcon, HistoryIcon, CategoriesIcon,
  CartIcon, TrashIcon, SidebarIcon, FallbackImageIcon,
  AttachmentIcon, MicrophoneIcon
} from './components/icons';

interface RawData {
  id?: string;
  name?: string;
  price?: number | any;
  currency?: string;
  image_url?: string;
  direct_url?: string;
  in_stock?: boolean;
  [key: string]: any;
}

interface Message {
  role: 'user' | 'bot' | string;
  text: string;
  tool?: string;
  raw_data?: RawData;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

const getInitialWelcomeMsg = (): Message => ({ 
    role: 'bot', 
    text: `${getDynamicGreeting()} I'm your Colombo Gift Concierge — powered by AI. Tell me who you're shopping for, and I'll find the perfect gift!` 
});

export default function ChatApp() {
    // ── Chat sessions ──
    const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => {
        const initial: ChatSession = { id: Date.now().toString(), title: 'Chat 1', messages: [getInitialWelcomeMsg()], createdAt: Date.now() };
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('kapruka-sessions');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && parsed.length > 0) return parsed;
            }
        }
        return [initial];
    });
    const [activeSessionId, setActiveSessionId] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('kapruka-sessions');
            if (saved) {
                const sessions: ChatSession[] = JSON.parse(saved);
                if (sessions && sessions.length > 0) return sessions[0].id;
            }
        }
        return chatSessions[0]?.id || Date.now().toString();
    });

    const activeSession = chatSessions.find(s => s.id === activeSessionId) || chatSessions[0];
    const messages = activeSession?.messages || [getInitialWelcomeMsg()];

    const setMessages = (updaterOrMessages: Message[] | ((prev: Message[]) => Message[])) => {
        const currentId = activeSession?.id;
        if (!currentId) return;
        
        setChatSessions(prev => {
            const sessionExists = prev.some(s => s.id === currentId);
            const workingState = sessionExists ? prev : [{ id: currentId, title: 'Chat', messages: [getInitialWelcomeMsg()], createdAt: Date.now() }, ...prev];
            
            const updated = workingState.map(s => {
                if (s.id !== currentId) return s;
                const newMessages = typeof updaterOrMessages === 'function'
                    ? updaterOrMessages(s.messages)
                    : updaterOrMessages;
                // Auto-update session title from first user message
                const firstUser = newMessages.find(m => m.role === 'user');
                const title = firstUser ? firstUser.text.slice(0, 28) + (firstUser.text.length > 28 ? '…' : '') : s.title;
                return { ...s, messages: newMessages, title };
            });
            // Only persist sessions that have at least one user message
            const toSave = updated.filter(s => s.messages.some(m => m.role === 'user'));
            localStorage.setItem('kapruka-sessions', JSON.stringify(toSave));
            return updated;
        });
    };

    const startNewChat = () => {
        // If the current session has no user messages, just reset it instead of creating a blank duplicate
        const currentHasMessages = activeSession?.messages.some(m => m.role === 'user');
        if (!currentHasMessages) {
            setActiveProduct(null);
            setActivePayment(null);
            setShowHelp(false);
            setShowHistory(false);
            return;
        }
        const newId = Date.now().toString();
        const newSession: ChatSession = {
            id: newId,
            title: `Chat ${chatSessions.filter(s => s.messages.some(m => m.role === 'user')).length + 1}`,
            messages: [getInitialWelcomeMsg()],
            createdAt: Date.now(),
        };
        const updated = [newSession, ...chatSessions];
        setChatSessions(updated);
        // Don't save the new empty session — it will be saved once the user sends a message
        setActiveSessionId(newId);
        setActiveProduct(null);
        setActivePayment(null);
        setShowHelp(false);
        setShowHistory(false);
    };

    const switchSession = (id: string) => {
        setActiveSessionId(id);
        setActiveProduct(null);
        setActivePayment(null);
        setShowHelp(false);
        setShowHistory(false);
    };

    const deleteSession = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setChatSessions(prev => {
            const updated = prev.filter(s => s.id !== id);
            localStorage.setItem('kapruka-sessions', JSON.stringify(updated.filter(s => s.messages.some(m => m.role === 'user'))));
            
            if (activeSessionId === id) {
                if (updated.length > 0) {
                    setActiveSessionId(updated[0].id);
                } else {
                    const newId = Date.now().toString();
                    updated.push({
                        id: newId,
                        title: 'Chat 1',
                        messages: [getInitialWelcomeMsg()],
                        createdAt: Date.now(),
                    });
                    setActiveSessionId(newId);
                }
            }
            return updated;
        });
    };

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeProduct, setActiveProduct] = useState<any>(null);
    const [activePayment, setActivePayment] = useState<any>(null);
    const [iframeLoading, setIframeLoading] = useState(true);

    // ── Ghost Typing Indicator for Placeholder ──
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [placeholderText, setPlaceholderText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    
    useEffect(() => {
        if (input.length > 0) return; // Stop animating if user is typing

        const placeholders = [
            'Type "Send a birthday cake to Nugegoda by 4 PM"',
            'Type "What\'s a good anniversary gift?"',
            'Type "Track my current order"'
        ];
        const currentString = placeholders[placeholderIndex];
        let typingSpeed = isDeleting ? 15 : 40; // Smoother and faster typing
        
        if (!isDeleting && placeholderText === currentString) {
            typingSpeed = 2500; // Pause at end of typing
            setIsDeleting(true);
        } else if (isDeleting && placeholderText === '') {
            setIsDeleting(false);
            setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
            typingSpeed = 500; // Pause before typing next
        }
        
        const timeout = setTimeout(() => {
            setPlaceholderText(currentString.substring(0, placeholderText.length + (isDeleting ? -1 : 1)));
        }, typingSpeed);
        
        return () => clearTimeout(timeout);
    }, [placeholderText, isDeleting, placeholderIndex, input]);

    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success'>('idle');
    const [paidOrders, setPaidOrders] = useState<any[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('kapruka-orders');
            return saved ? JSON.parse(saved) : [];
        }
        return [];
    });
    const [showHistory, setShowHistory] = useState(false);
    const [useMock, setUseMock] = useState(true);
    const [darkMode, setDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('kapruka-dark') === 'true';
        }
        return false;
    });

    // Custom feature states
    const [showHelp, setShowHelp] = useState(false);
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    const [addGreetingCard, setAddGreetingCard] = useState(false);
    const [cardOccasion, setCardOccasion] = useState('Birthday');
    const [cardMessage, setCardMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [cart, setCart] = useState<any[]>([]);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [showCartPanel, setShowCartPanel] = useState(false);

    const addToCart = (product: any) => {
        setCart(prev => {
            const exists = prev.find(p => p.id === product.id);
            if (exists) return prev.map(p => p.id === product.id ? { ...p, qty: p.qty + 1 } : p);
            return [...prev, { ...product, qty: 1 }];
        });
        setShowCartPanel(true);
    };

    const increaseQty = (id: string) => {
        setCart(prev => prev.map(item => item.id === id ? { ...item, qty: item.qty + 1 } : item));
    };

    const decreaseQty = (id: string) => {
        setCart(prev => prev.map(item => item.id === id ? { ...item, qty: Math.max(1, item.qty - 1) } : item).filter(item => item.qty > 0));
    };

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const faqs = [
        {
            q: "How do I find a product?",
            a: "You can search by typing queries like 'Show me chocolate cakes', 'Look for teddy bears', or 'Do you have red roses?'. The AI will search Kapruka's catalog and display a rich interactive grid."
        },
        {
            q: "Can I check if delivery is available to my town?",
            a: "Yes! You can ask 'Check delivery to Colombo 04' or click the 'Calculate Shipping' button on any product inspect panel. The concierge will check the flat rate and delivery date."
        },
        {
            q: "How do I place an order?",
            a: "Just tell the AI 'I want to buy SOFTTOY001218' or click the 'Buy' button. The concierge will ask for the required delivery fields (Recipient Name, Address, Sender Name, Date) and generate a secure checkout card."
        },
        {
            q: "What payment methods are supported?",
            a: "Kapruka checkout supports Visa, MasterCard, AMEX, and local mobile wallets. You can pay directly via our secure in-app checkout panel or open the payment link in a new tab."
        },
        {
            q: "How can I track my order status?",
            a: "Go to your 'Order History' in the sidebar and click 'Track Order', or ask the AI directly: 'Track order KAPRUKA-12345'."
        }
    ];

    useEffect(() => {
        if (messages.length > 1) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', darkMode);
        localStorage.setItem('kapruka-dark', String(darkMode));
    }, [darkMode]);

    const sendMessage = async (eOrText: any) => {
        if (eOrText?.preventDefault) eOrText.preventDefault();
        const userText = typeof eOrText === 'string' ? eOrText : input;
        if (!userText.trim()) return;

        setInput('');
        const updatedMessages = [...messages, { role: 'user' as const, text: userText }];
        setMessages(updatedMessages);
        setIsLoading(true);

        const history = updatedMessages
            .slice(1, -1)
            .map(msg => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] }))
            .slice(-20);

        try {
            const isDev = import.meta.env.DEV;
            const apiUrl = isDev ? '/api-proxy/chat/message' : 'http://127.0.0.1:8002/chat/message';
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ message: userText, use_mock: useMock, history })
            });
            const data = await response.json();
            
            if (!response.ok) {
                console.error("Server returned an error:", data);
                throw new Error(data.message || data.error_body?.error?.message || "Server Error");
            }

            setMessages(prev => [...prev, {
                role: 'bot', 
                text: data.text || "Sorry, I didn't receive a valid text response.", 
                tool: data.tool_called, 
                raw_data: data.raw_data
            }]);
            
            if (data.tool_called === 'kapruka_get_product' && data.raw_data) {
                setActiveProduct(getParsedData(data.raw_data));
            }
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'bot', text: "Sorry, I had trouble reaching the Kapruka database. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`flex h-screen w-full overflow-hidden font-sans transition-colors duration-300 ${darkMode ? 'bg-dark-bg' : 'bg-gradient-to-br from-indigo-50 via-white to-purple-50 animate-mesh'}`}>

            {/* ═══════════════ PANE 1: SIDEBAR ═══════════════ */}
            <div className={`flex flex-col z-20 hidden md:flex transition-all duration-300 ${
                sidebarCollapsed ? 'w-16 border-r' : 'w-64 border-r'
            } ${
                darkMode
                    ? 'bg-dark-surface/80 backdrop-blur-xl border-dark-border'
                    : 'bg-gradient-to-b from-[#002F6C] to-[#001845] shadow-2xl border-white/10'
            }`}>
                {/* Logo */}
                <div className={`p-4 pb-3 flex flex-col items-center justify-between ${sidebarCollapsed ? 'gap-2' : 'flex-row'}`}>
                    {!sidebarCollapsed ? (
                        <div>
                            <h1 className="text-2xl font-black tracking-tight flex items-center gap-1">
                                <span className="gradient-text">K</span>
                                <span className="text-white">apruka</span>
                            </h1>
                            <p className={`text-[10px] mt-1 font-semibold tracking-[0.2em] uppercase ${darkMode ? 'text-dark-muted' : 'text-white/50'}`}>
                                Gift Concierge · AI
                            </p>
                        </div>
                    ) : (
                        <h1 className="text-2xl font-black tracking-tight">
                            <span className="gradient-text">K</span>
                        </h1>
                    )}
                    <button 
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)} 
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer hidden md:block ${
                            darkMode ? 'text-dark-muted hover:bg-white/5 hover:text-dark-text' : 'text-white/60 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        <SidebarIcon />
                    </button>
                </div>

                <div className="px-3 mt-4 flex justify-center">
                    <button
                        onClick={startNewChat}
                        className={`flex items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all duration-200 border cursor-pointer ${
                            sidebarCollapsed ? 'p-2.5' : 'w-full px-4 py-2.5'
                        } ${
                            darkMode
                                ? 'bg-brand-purple/15 border-brand-purple/30 text-brand-purple-accent hover:bg-brand-purple/25'
                                : 'bg-white/15 border-white/30 text-white hover:bg-white/25'
                        }`}
                        title={sidebarCollapsed ? "New Chat" : undefined}
                    >
                        <span className="flex items-center justify-center text-sm"><EditIcon /></span>
                        {!sidebarCollapsed && "New Chat"}
                    </button>
                </div>

                <nav className="px-3 mt-4 space-y-1">
                    <button onClick={() => { setShowHelp(false); setShowHistory(false); setActiveProduct(null); setActivePayment(null); }}
                        className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                            sidebarCollapsed ? 'justify-center w-10 h-10 px-0 mx-auto' : 'w-full px-4 text-left'
                        } ${
                            !showHelp && !showHistory && !activeProduct && !activePayment
                                ? darkMode ? 'bg-brand-purple/10 text-brand-purple-accent' : 'bg-white/10 text-white'
                                : darkMode ? 'text-dark-muted hover:bg-white/5' : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                        }`}
                        title={sidebarCollapsed ? "Active Chat" : undefined}
                    >
                        <span className="flex items-center justify-center"><ChatIcon /></span>
                        {!sidebarCollapsed && "Active Chat"}
                    </button>
                    <button onClick={() => { setShowHelp(true); setShowHistory(false); setActiveProduct(null); setActivePayment(null); }}
                        className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                            sidebarCollapsed ? 'justify-center w-10 h-10 px-0 mx-auto' : 'w-full px-4 text-left'
                        } ${
                            showHelp
                                ? darkMode ? 'bg-brand-purple/10 text-brand-purple-accent' : 'bg-white/10 text-white'
                                : darkMode ? 'text-dark-muted hover:bg-white/5' : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                        }`}
                        title={sidebarCollapsed ? "How to Use" : undefined}
                    >
                        <span className="flex items-center justify-center"><HelpIcon /></span>
                        {!sidebarCollapsed && "How to Use"}
                    </button>
                    <button onClick={() => { setShowHelp(false); setShowHistory(true); setActiveProduct(null); setActivePayment(null); }}
                        className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                            sidebarCollapsed ? 'justify-center w-10 h-10 px-0 mx-auto' : 'w-full px-4 text-left'
                        } ${
                            showHistory
                                ? darkMode ? 'bg-brand-purple/10 text-brand-purple-accent' : 'bg-white/10 text-white'
                                : darkMode ? 'text-dark-muted hover:bg-white/5' : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                        }`}
                        title={sidebarCollapsed ? "Order History" : undefined}
                    >
                        <span className="flex items-center justify-center"><HistoryIcon /></span>
                        {!sidebarCollapsed && "Order History"}
                    </button>
                    <button onClick={() => { setShowHelp(false); setShowHistory(false); setActiveProduct(null); setActivePayment(null); sendMessage("Show me all categories"); }}
                        className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                            sidebarCollapsed ? 'justify-center w-10 h-10 px-0 mx-auto' : 'w-full px-4 text-left'
                        } ${
                            darkMode ? 'text-dark-muted hover:bg-white/5' : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                        }`}
                        title={sidebarCollapsed ? "Categories" : undefined}
                    >
                        <span className="flex items-center justify-center"><CategoriesIcon /></span>
                        {!sidebarCollapsed && "Categories"}
                    </button>
                </nav>

                {/* Chat Session History */}
                <div className="flex-1 overflow-y-auto px-3 mt-4 min-h-0 hide-scrollbar">
                    {!sidebarCollapsed && (
                        <p className={`text-[9px] font-bold tracking-[0.2em] uppercase px-1 mb-2 ${darkMode ? 'text-dark-muted' : 'text-white/40'}`}>
                            Chat History
                        </p>
                    )}
                    <div className="space-y-0.5">
                        {chatSessions.filter(s => s.messages.some(m => m.role === 'user')).map(session => (
                            <div
                                key={session.id}
                                onClick={() => switchSession(session.id)}
                                className={`flex items-center rounded-xl transition-all duration-200 group cursor-pointer ${
                                    sidebarCollapsed ? 'justify-center w-10 h-10 px-0 mx-auto' : 'w-full gap-2.5 px-3 py-2.5 text-left'
                                } ${
                                    session.id === activeSessionId
                                        ? darkMode ? 'bg-brand-purple/15 border border-brand-purple-accent/25' : 'bg-white/15 border border-white/20'
                                        : darkMode ? 'hover:bg-white/5' : 'hover:bg-white/8'
                                }`}
                                title={sidebarCollapsed ? session.title : undefined}
                            >
                                <span className={`flex items-center justify-center flex-shrink-0 ${
                                    session.id === activeSessionId
                                        ? darkMode ? 'text-brand-purple-accent' : 'text-white'
                                        : darkMode ? 'text-dark-muted' : 'text-white/40'
                                }`}><ChatIcon /></span>
                                {!sidebarCollapsed && (
                                    <>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-medium truncate ${
                                                session.id === activeSessionId
                                                    ? darkMode ? 'text-dark-text' : 'text-white'
                                                    : darkMode ? 'text-dark-muted group-hover:text-dark-text' : 'text-white/50 group-hover:text-white/80'
                                            }`}>{session.title}</p>
                                            <p className={`text-[9px] truncate mt-0.5 ${
                                                darkMode ? 'text-dark-muted/60' : 'text-white/30'
                                            }`}>{session.messages.length - 1} message{session.messages.length !== 2 ? 's' : ''}</p>
                                        </div>
                                        <button
                                            onClick={(e) => deleteSession(e, session.id)}
                                            className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${
                                                darkMode ? 'text-red-400 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-100'
                                            }`}
                                        >
                                            <TrashIcon />
                                        </button>
                                        {session.id === activeSessionId && (
                                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ml-1 ${
                                                darkMode ? 'bg-brand-purple' : 'bg-white'
                                            }`} />
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Preferences Header */}
                {!sidebarCollapsed && (
                    <p className={`text-[9px] font-bold tracking-[0.2em] uppercase px-4 mb-2 ${darkMode ? 'text-dark-muted' : 'text-white/40'}`}>
                        Preferences Settings
                    </p>
                )}

                {/* Controls */}
                <div className={`px-4 space-y-3 mb-4 ${sidebarCollapsed ? 'flex flex-col items-center px-0' : ''}`}>
                    {/* Dark Mode Toggle */}
                    <button
                        onClick={() => setDarkMode(!darkMode)}
                        className={`flex items-center rounded-xl text-sm font-medium transition-all duration-300 cursor-pointer ${
                            sidebarCollapsed 
                                ? 'w-10 h-10 justify-center p-0 hover:bg-brand-purple/20 text-white'
                                : 'w-full justify-between px-4 py-3 bg-white/10 text-white hover:bg-white/15'
                        } ${
                            !sidebarCollapsed && darkMode ? 'bg-dark-card border border-dark-border text-white hover:bg-brand-purple/20 hover:border-brand-purple-accent/50' : ''
                        }`}
                        title={sidebarCollapsed ? "Toggle Theme" : undefined}
                    >
                        <span className="flex items-center gap-2">
                            {darkMode ? <MoonIcon /> : <SunIcon />}
                            {!sidebarCollapsed && (darkMode ? 'Dark Mode' : 'Light Mode')}
                        </span>
                        {!sidebarCollapsed && (
                            <div className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${darkMode ? 'bg-brand-purple' : 'bg-white/30'}`}>
                                <motion.div
                                    animate={{ x: darkMode ? 20 : 0 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-md"
                                />
                            </div>
                        )}
                    </button>

                    {/* Mock/Live Toggle */}
                    <div className={`${
                        sidebarCollapsed 
                            ? 'w-10 h-10 flex items-center justify-center rounded-xl cursor-pointer hover:bg-white/10'
                            : 'p-4 rounded-xl transition-colors duration-300 bg-white/10'
                    } ${
                        !sidebarCollapsed && darkMode ? 'bg-white/5 border border-dark-border' : ''
                    }`}
                    onClick={sidebarCollapsed ? () => setUseMock(!useMock) : undefined}
                    title={sidebarCollapsed ? (useMock ? "Switch to Live API" : "Switch to Mock Mode") : undefined}
                    >
                        {sidebarCollapsed ? (
                            <span className="text-base">{useMock ? '🧪' : '🔴'}</span>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className={`text-xs font-bold tracking-wide ${darkMode ? 'text-dark-text' : 'text-white'}`}>
                                        {useMock ? '🧪 Mock Mode' : '🔴 Live API'}
                                    </p>
                                    <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-dark-muted' : 'text-white/40'}`}>
                                        {useMock ? 'Using sample data' : 'Calling Gemini + MCP'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setUseMock(!useMock)}
                                    className={`relative w-12 h-6 rounded-full transition-colors duration-300 cursor-pointer ${
                                        useMock ? 'bg-brand-purple' : 'bg-emerald-500'
                                    }`}
                                >
                                    <motion.div
                                        animate={{ x: useMock ? 0 : 24 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md"
                                    />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                {!sidebarCollapsed && (
                    <div className="px-4 pb-4">
                        <div className={`p-3 rounded-xl text-[10px] ${
                            darkMode ? 'bg-white/5 text-dark-muted border border-dark-border' : 'bg-white/5 text-white/40'
                        }`}>
                            <p className={`font-bold mb-0.5 ${darkMode ? 'text-dark-text' : 'text-white/70'}`}>Hackathon 2026</p>
                            <p>Powered by Gemini · MCP · Kapruka</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══════════════ PANE 2: CHAT FEED ═══════════════ */}
            <div className="flex-1 flex flex-col relative h-full noise-bg">

                {/* ── Desktop Header Bar ── */}
                <div className={`hidden md:flex items-center justify-between px-6 py-3 border-b z-10 transition-colors duration-300 ${
                    darkMode
                        ? 'bg-dark-surface/60 backdrop-blur border-dark-border'
                        : 'bg-white/70 backdrop-blur border-gray-100 shadow-sm'
                }`}>
                    {/* Left: active chat info */}
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${
                            darkMode ? 'bg-brand-purple/20 text-brand-purple-accent' : 'bg-brand-purple/10 text-brand-purple'
                        }`}><ChatIcon /></div>
                        <div>
                            <p className={`text-sm font-bold leading-tight ${
                                darkMode ? 'text-dark-text' : 'text-gray-900'
                            }`}>{activeSession?.title || 'Active Chat'}</p>
                            <p className={`text-[10px] ${
                                darkMode ? 'text-dark-muted' : 'text-gray-400'
                            }`}>{messages.length - 1} message{messages.length !== 2 ? 's' : ''} · {useMock ? '🧪 Mock' : '🔴 Live'}</p>
                        </div>
                    </div>
                    {/* Right: actions */}
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setShowCartPanel(!showCartPanel)}
                            className={`relative flex items-center justify-center p-2 rounded-lg transition-all duration-200 cursor-pointer ${
                            darkMode
                                ? 'bg-white/5 text-dark-muted hover:bg-white/10 hover:text-dark-text border border-dark-border'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                            <span className="flex items-center justify-center"><CartIcon /></span>
                            {cart.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-brand-purple text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-sm">
                                    {cart.reduce((total, item) => total + item.qty, 0)}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className={`p-2 rounded-lg transition-all duration-200 ${
                                darkMode
                                    ? 'bg-dark-card text-white hover:bg-brand-purple/20 hover:text-brand-purple border border-dark-border hover:border-brand-purple/50'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {darkMode ? <SunIcon /> : <MoonIcon />}
                        </button>
                    </div>
                </div>

                {/* Mobile Header */}
                <div className={`md:hidden p-4 shadow-md z-10 flex justify-between items-center transition-colors duration-300 ${
                    darkMode ? 'bg-dark-surface border-b border-dark-border' : 'bg-[#002F6C]'
                }`}>
                    <h1 className="text-lg font-bold text-white">Kapruka Concierge</h1>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setShowCartPanel(!showCartPanel)}
                            className="relative text-white/80 p-2 flex items-center justify-center cursor-pointer"
                        >
                            <CartIcon />
                            {cart.length > 0 && (
                                <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full shadow-sm">
                                    {cart.reduce((total, item) => total + item.qty, 0)}
                                </span>
                            )}
                        </button>
                        <button onClick={() => setDarkMode(!darkMode)} className={`p-2 flex items-center justify-center rounded-lg transition-colors ${darkMode ? 'text-brand-purple-accent hover:bg-brand-purple/20' : 'text-white/80 hover:bg-white/20'}`}>
                            {darkMode ? <SunIcon /> : <MoonIcon />}
                        </button>
                    </div>
                </div>

                {/* Messages / Help View */}
                {showHelp ? (
                    <div className="flex-1 flex flex-col overflow-y-auto p-6 md:p-10 space-y-6 relative z-10">
                        {/* FAQ Header */}
                        <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-dark-border">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
                                    How to Use <span className="bg-gradient-to-r from-brand-purple via-brand-purple-light to-[#A17BD9] bg-clip-text text-transparent">Kapruka Concierge</span>
                                </h2>
                                <p className={`text-[10px] font-extrabold tracking-[0.25em] uppercase mt-1 ${darkMode ? 'text-dark-muted' : 'text-brand-purple/60'}`}>
                                    Frequently Asked Questions &amp; Guide
                                </p>
                            </div>
                            <button
                                onClick={() => setShowHelp(false)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                                    darkMode
                                        ? 'bg-white/10 text-white hover:bg-white/20'
                                        : 'bg-brand-purple text-white hover:opacity-90'
                                }`}
                            >
                                ← Back to Chat
                            </button>
                        </div>

                        {/* Welcome Card */}
                        <div className={`rounded-2xl p-6 border ${
                            darkMode ? 'bg-brand-purple/10 border-brand-purple-accent/20' : 'bg-gradient-to-br from-brand-purple/5 to-brand-purple-light/10 border-brand-purple/15'
                        }`}>
                            <div className="flex items-center gap-4 mb-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-brand-purple to-brand-purple-light rounded-xl flex items-center justify-center text-2xl shadow-lg shadow-brand-purple/20">
                                    🎁
                                </div>
                                <div>
                                    <h3 className={`font-bold text-base ${darkMode ? 'text-dark-text' : 'text-gray-900'}`}>Welcome to Kapruka Concierge</h3>
                                    <p className={`text-xs mt-0.5 ${darkMode ? 'text-dark-muted' : 'text-gray-500'}`}>Your AI-powered gift shopping assistant for Sri Lanka</p>
                                </div>
                            </div>
                            <p className={`text-sm leading-relaxed ${darkMode ? 'text-dark-muted' : 'text-gray-600'}`}>
                                Simply type what you're looking for in natural language. You can search products, check delivery availability, place orders, and track shipments — all through a conversational interface.
                            </p>
                        </div>

                        {/* Example Prompts */}
                        <div>
                            <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${darkMode ? 'text-dark-muted' : 'text-brand-purple/60'}`}>Try these examples</p>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    '🎂 Show me birthday cakes',
                                    '🧸 Find soft toys under LKR 2000',
                                    '💐 Red rose bouquets',
                                    '🚚 Check delivery to Kandy',
                                    '📦 Track order KAPRUKA-12345',
                                    '🗂️ List all categories'
                                ].map((prompt, i) => (
                                    <button
                                        key={i}
                                        onClick={() => { setShowHelp(false); sendMessage(prompt); }}
                                        className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 ${
                                            darkMode
                                                ? 'bg-white/5 border border-dark-border text-dark-text hover:bg-brand-purple/20 hover:border-brand-purple/40 hover:text-brand-purple'
                                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-brand-purple hover:text-white hover:border-brand-purple shadow-sm'
                                        }`}
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* FAQ Accordion */}
                        <div className="max-w-3xl w-full mx-auto space-y-3 pb-6">
                            <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${darkMode ? 'text-dark-muted' : 'text-brand-purple/60'}`}>Frequently Asked Questions</p>
                            {faqs.map((faq, idx) => {
                                const isExpanded = expandedFaq === idx;
                                return (
                                    <div
                                        key={idx}
                                        className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
                                            isExpanded
                                                ? darkMode ? 'bg-brand-purple/10 border-brand-purple-accent/30' : 'bg-brand-purple/5 border-brand-purple/20'
                                                : darkMode ? 'bg-dark-card border-dark-border hover:border-brand-purple-accent/20' : 'bg-white border-gray-100 hover:border-brand-purple/15 shadow-sm'
                                        }`}
                                    >
                                        <button
                                            onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                                            className="w-full flex justify-between items-center px-5 py-4 text-left cursor-pointer"
                                        >
                                            <span className={`text-sm font-semibold ${darkMode ? 'text-dark-text' : 'text-gray-800'}`}>{faq.q}</span>
                                            <span className={`text-lg transition-transform duration-300 ml-3 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''} ${darkMode ? 'text-brand-purple-accent' : 'text-brand-purple'}`}>
                                                ⌄
                                            </span>
                                        </button>
                                        {isExpanded && (
                                            <div className={`px-5 pb-5 text-sm leading-relaxed ${
                                                darkMode ? 'text-dark-muted' : 'text-gray-600'
                                            }`}>
                                                {faq.a}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 relative z-10">
                    <AnimatePresence>
                        {messages.length === 1 ? (
                            <motion.div
                                key="empty-state"
                                variants={{
                                    hidden: { opacity: 0 },
                                    show: {
                                        opacity: 1,
                                        transition: { staggerChildren: 0.15 }
                                    }
                                }}
                                initial="hidden"
                                animate="show"
                                exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
                                className="flex flex-col items-center max-w-5xl mx-auto py-6 text-center gap-10"
                            >
                                {/* Hero Section */}
                                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className="flex flex-col items-center gap-4">
                                    <h2 className="text-4xl md:text-6xl font-serif font-bold tracking-tight leading-tight">
                                        Your Personal <span className="italic font-bold bg-gradient-to-r from-brand-purple via-brand-purple-light to-[#A17BD9] bg-clip-text text-transparent">AI Shopping Concierge</span>
                                    </h2>
                                    <p className={`text-sm md:text-base max-w-2xl leading-relaxed ${darkMode ? 'text-dark-muted' : 'text-gray-600'}`}>
                                        Find gifts, compare options, arrange delivery, and checkout in minutes — all through a simple conversation.
                                    </p>
                                    
                                    {/* Trust Indicators */}
                                    <div className="flex flex-wrap justify-center gap-4 md:gap-8 mt-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-yellow-400 text-lg">⭐⭐⭐⭐⭐</span>
                                            <span className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-dark-text' : 'text-gray-800'}`}>Rated by Customers</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-lg ${darkMode ? 'text-brand-purple-accent' : 'text-[#002F6C]'}`}>🚚</span>
                                            <span className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-dark-text' : 'text-gray-800'}`}>Same-Day Delivery</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-lg ${darkMode ? 'text-brand-purple-accent' : 'text-[#002F6C]'}`}>🎁</span>
                                            <span className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-dark-text' : 'text-gray-800'}`}>5,000+ Delivered</span>
                                        </div>
                                    </div>
                                    
                                    {/* Urgency Countdown */}
                                    <div className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50">
                                        <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-red-700 dark:text-red-400">Order within <span className="font-mono">02:15:34</span> for same-day delivery</span>
                                    </div>
                                </motion.div>

                                {/* Concierge Welcome Card */}
                                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className={`w-full max-w-2xl p-6 md:p-8 text-left rounded-3xl border relative overflow-hidden group shadow-xl ${
                                    darkMode ? 'bg-gradient-to-br from-dark-card to-black border-dark-border' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
                                }`}>
                                    <div className="absolute top-0 left-0 w-2 h-full bg-brand-purple"></div>
                                    <h3 className={`text-2xl font-bold mb-4 flex items-center flex-wrap gap-3 ${darkMode ? 'text-dark-text' : 'text-gray-900'}`}>
                                        Ayubowan 👋 <span className="text-sm font-normal text-brand-purple bg-brand-purple/10 px-3 py-1 rounded-full border border-brand-purple/20">I'm your personal shopping concierge.</span>
                                    </h3>
                                    <p className={`text-sm mb-4 leading-relaxed ${darkMode ? 'text-dark-muted' : 'text-gray-600'}`}>Tell me:</p>
                                    <ul className={`text-sm space-y-3 mb-6 pl-2 ${darkMode ? 'text-dark-muted' : 'text-gray-700'}`}>
                                        <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-brand-purple"></span>What occasion is it?</li>
                                        <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-brand-purple"></span>What's your budget?</li>
                                        <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-brand-purple"></span>Where should it be delivered?</li>
                                    </ul>
                                    <p className={`text-sm font-bold ${darkMode ? 'text-brand-purple-accent' : 'text-brand-purple'}`}>I'll find the perfect gift instantly.</p>
                                </motion.div>

                                {/* Customer-Focused Benefits */}
                                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl text-left">
                                    {/* Benefit 1 */}
                                    <div className={`p-6 rounded-3xl border transition-all duration-300 ${darkMode ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-100 shadow-sm'}`}>
                                        <span className="text-3xl mb-4 block">🎁</span>
                                        <h4 className={`font-bold text-sm mb-2 ${darkMode ? 'text-dark-text' : 'text-gray-900'}`}>Find the Perfect Gift</h4>
                                        <p className={`text-xs leading-relaxed ${darkMode ? 'text-dark-muted' : 'text-gray-500'}`}>AI recommendations based on occasion and budget.</p>
                                    </div>
                                    {/* Benefit 2 */}
                                    <div className={`p-6 rounded-3xl border transition-all duration-300 ${darkMode ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-100 shadow-sm'}`}>
                                        <span className="text-3xl mb-4 block">🚚</span>
                                        <h4 className={`font-bold text-sm mb-2 ${darkMode ? 'text-dark-text' : 'text-gray-900'}`}>Island-Wide Delivery</h4>
                                        <p className={`text-xs leading-relaxed ${darkMode ? 'text-dark-muted' : 'text-gray-500'}`}>Real-time delivery estimates and tracking.</p>
                                    </div>
                                    {/* Benefit 3 */}
                                    <div className={`p-6 rounded-3xl border transition-all duration-300 ${darkMode ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-100 shadow-sm'}`}>
                                        <span className="text-3xl mb-4 block">⚡</span>
                                        <h4 className={`font-bold text-sm mb-2 ${darkMode ? 'text-dark-text' : 'text-gray-900'}`}>Fast Checkout</h4>
                                        <p className={`text-xs leading-relaxed ${darkMode ? 'text-dark-muted' : 'text-gray-500'}`}>Complete purchases without leaving the conversation.</p>
                                    </div>
                                </motion.div>

                                {/* Suggested Prompts Grid */}
                                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className="w-full max-w-4xl text-left mt-4">
                                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-6 ${darkMode ? 'text-dark-muted' : 'text-brand-purple/60'}`}>Try these prompts</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {[
                                            { t: "Find a birthday gift under Rs. 10,000", i: "🎂" },
                                            { t: "Send flowers to Colombo today", i: "💐" },
                                            { t: "Anniversary gift ideas", i: "🎁" },
                                            { t: "Premium chocolate hampers", i: "🍫" },
                                            { t: "Find electronics gifts", i: "📱" },
                                            { t: "Corporate gifting solutions", i: "🎉" }
                                        ].map((p, i) => (
                                            <button 
                                                key={i}
                                                onClick={() => sendMessage(p.t)}
                                                className={`text-left p-4 rounded-2xl border transition-all duration-200 flex items-center gap-3 group cursor-pointer hover:-translate-y-1 ${
                                                    darkMode ? 'bg-dark-card/50 border-dark-border hover:border-brand-purple-accent/50 hover:bg-brand-purple/5' : 'bg-white border-gray-200 hover:border-brand-purple hover:shadow-lg'
                                                }`}
                                            >
                                                <span className="text-2xl">{p.i}</span>
                                                <span className={`text-xs font-semibold ${darkMode ? 'text-dark-text group-hover:text-brand-purple-accent' : 'text-gray-700 group-hover:text-brand-purple'}`}>{p.t}</span>
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>

                                {/* Shop By Occasion */}
                                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className="w-full max-w-4xl text-left mt-8">
                                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-6 ${darkMode ? 'text-dark-muted' : 'text-brand-purple/60'}`}>Shop By Occasion</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {[
                                            { title: 'Birthday', desc: 'Cakes & Gifts', emoji: '🎂' },
                                            { title: 'Anniversary', desc: 'Flowers & Jewelry', emoji: '💍' },
                                            { title: 'Baby Shower', desc: 'Toys & Essentials', emoji: '👶' },
                                            { title: 'Graduation', desc: 'Books & Tech', emoji: '🎓' },
                                            { title: 'Corporate', desc: 'Hampers & Awards', emoji: '🏢' },
                                            { title: 'Romance', desc: 'Chocolates & Roses', emoji: '❤️' }
                                        ].map((occ, i) => (
                                            <button
                                                key={i}
                                                onClick={() => sendMessage(`Show me gifts for ${occ.title}`)}
                                                className={`flex flex-col items-center justify-center p-6 rounded-3xl border transition-all duration-300 cursor-pointer hover:-translate-y-1 ${
                                                    darkMode ? 'bg-dark-card border-dark-border hover:border-brand-purple-accent/50' : 'bg-white border-gray-200 shadow-sm hover:shadow-xl hover:border-brand-purple/30'
                                                }`}
                                            >
                                                <span className="text-4xl mb-3">{occ.emoji}</span>
                                                <span className={`font-bold text-sm ${darkMode ? 'text-dark-text' : 'text-gray-900'}`}>{occ.title}</span>
                                                <span className={`text-[10px] mt-1 ${darkMode ? 'text-dark-muted' : 'text-gray-500'}`}>{occ.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>

                                {/* Popular Products Carousel */}
                                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className="w-full max-w-5xl text-left mt-8 overflow-hidden">
                                    <div className="flex justify-between items-end mb-6 px-4 md:px-0">
                                        <h3 className={`text-xs font-bold uppercase tracking-widest ${darkMode ? 'text-dark-muted' : 'text-brand-purple/60'}`}>Popular Gifts This Week</h3>
                                    </div>
                                    <div className="flex overflow-x-auto gap-4 pb-6 snap-x snap-mandatory hide-scrollbar px-4 md:px-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                        <style>{`
                                            .hide-scrollbar::-webkit-scrollbar { display: none; }
                                        `}</style>
                                        {[
                                            { name: "Premium Red Roses Bouquet", price: "LKR 8,500", img: "🌹" },
                                            { name: "Ribbon Cake 1Kg", price: "LKR 4,200", img: "🍰" },
                                            { name: "Ferrero Rocher 24 Pcs", price: "LKR 6,800", img: "🍫" },
                                            { name: "Customized Photo Frame", price: "LKR 3,500", img: "🖼️" },
                                            { name: "Fruit & Cheese Hamper", price: "LKR 12,000", img: "🍇" },
                                            { name: "Soft Teddy Bear (Large)", price: "LKR 7,500", img: "🧸" }
                                        ].map((prod, i) => (
                                            <div key={i} className={`min-w-[200px] md:min-w-[240px] snap-start flex flex-col p-4 rounded-3xl border transition-all duration-300 cursor-pointer ${
                                                darkMode ? 'bg-dark-card border-dark-border hover:border-brand-purple-accent' : 'bg-white border-gray-100 shadow-md hover:shadow-xl hover:border-brand-purple/50'
                                            }`} onClick={() => sendMessage(`I want to buy a ${prod.name}`)}>
                                                <div className={`h-32 rounded-2xl flex items-center justify-center text-6xl mb-4 ${darkMode ? 'bg-dark-surface' : 'bg-gray-50'}`}>
                                                    {prod.img}
                                                </div>
                                                <h4 className={`font-bold text-xs mb-1 line-clamp-1 ${darkMode ? 'text-dark-text' : 'text-gray-900'}`}>{prod.name}</h4>
                                                <p className="text-[10px] text-brand-purple font-bold mt-1">{prod.price}</p>
                                                <div className="mt-3 inline-block px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[8px] font-bold uppercase rounded-full self-start">Available Today</div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>

                                {/* Social Proof */}
                                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className="w-full max-w-4xl text-left mt-4 mb-8">
                                    <div className={`p-8 rounded-3xl border flex flex-col md:flex-row items-center gap-8 ${
                                        darkMode ? 'bg-dark-card/50 border-dark-border' : 'bg-[#FDF2F4]/30 border-[#002F6C]/10'
                                    }`}>
                                        <div className="flex-1 text-center md:text-left">
                                            <h3 className={`text-3xl font-serif font-bold mb-2 ${darkMode ? 'text-dark-text' : 'text-[#002F6C]'}`}>4.8/5 Rating</h3>
                                            <p className={`text-xs uppercase tracking-widest font-bold ${darkMode ? 'text-brand-purple-accent' : 'text-brand-purple'}`}>100+ Verified Reviews</p>
                                        </div>
                                        <div className={`flex-[2] text-sm italic border-l-2 pl-6 py-2 ${darkMode ? 'border-brand-purple-accent/30 text-dark-muted' : 'border-brand-purple/20 text-gray-600'}`}>
                                            "Ordered flowers at 10 AM and delivered by lunch. The AI assistant made it incredibly easy. Amazing experience!"
                                            <span className="block mt-2 font-bold not-italic text-xs text-brand-purple">— Sarah M. (Colombo 07)</span>
                                        </div>
                                    </div>
                                </motion.div>

                            </motion.div>
                        ) : (
                            <motion.div 
                                key="messages-list" 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }} 
                                className="space-y-6"
                            >
                                {messages.map((msg, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, y: 20, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 28 }}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[80%] p-5 transition-colors duration-300 ${
                                        msg.role === 'user'
                                            ? 'bg-gradient-to-br from-[#8B6CE5] to-[#5939A1] text-white rounded-3xl rounded-br-lg shadow-lg shadow-[#8B6CE5]/20'
                                            : darkMode
                                                ? 'glass rounded-3xl rounded-bl-lg shadow-lg'
                                                : 'glass-strong rounded-3xl rounded-bl-lg shadow-lg'
                                    }`}>

                                    {/* Conversational text */}
                                    {msg.text && (
                                        <div className={`prose prose-sm max-w-none ${
                                            msg.role === 'user'
                                                ? 'prose-invert'
                                                : darkMode ? 'prose-invert' : ''
                                        }`}>
                                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                                        </div>
                                    )}

                                    {/* ── 1. Search Results Grid ── */}
                                    {msg.tool === 'kapruka_search_products' && msg.raw_data && (() => {
                                        const searchData = getParsedData(msg.raw_data);
                                        const resultsArray = Array.isArray(searchData) ? searchData : (searchData?.results || []);
                                        
                                        if (!resultsArray || resultsArray.length === 0) {
                                            const mdText = msg.raw_data?.result || msg.raw_data?.structuredContent?.result;
                                            return mdText ? (
                                                <div className={`mt-4 p-4 rounded-2xl border prose prose-sm max-w-none text-sm ${
                                                    darkMode ? 'bg-dark-card/50 border-dark-border text-dark-text' : 'bg-[#FDF2F4]/50 border-[#7A1C2C]/10 text-gray-800'
                                                }`}>
                                                    <ReactMarkdown>{mdText}</ReactMarkdown>
                                                </div>
                                            ) : null;
                                        }

                                        return (
                                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {resultsArray.map((product: any) => (
                                                    <motion.div
                                                        key={product.id}
                                                        initial={{ opacity: 0, y: 12 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        whileHover={{ y: -6, scale: 1.015 }}
                                                        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                                                        className={`rounded-3xl flex flex-col overflow-hidden transition-all duration-300 ${
                                                            darkMode
                                                                ? 'bg-dark-card border border-dark-border hover:border-brand-purple/40 shadow-xl hover:shadow-brand-purple/10'
                                                                : 'bg-white border border-gray-100 shadow-lg hover:shadow-2xl'
                                                        }`}
                                                    >
                                                        {/* Image Area */}
                                                        <div className={`relative h-44 overflow-hidden flex items-center justify-center ${
                                                            darkMode ? 'bg-dark-bg' : 'bg-gradient-to-br from-gray-50 to-gray-100'
                                                        }`}>
                                                            <ImageWithFallback 
                                                                src={product.image_url} 
                                                                alt={product.name}
                                                                className="max-h-full max-w-full object-contain transition-transform duration-500 hover:scale-110"
                                                                fallback={
                                                                    <div className={`flex flex-col items-center justify-center w-full h-full opacity-60 ${darkMode ? 'text-dark-muted' : 'text-gray-400'}`}>
                                                                        <FallbackImageIcon className="w-10 h-10 mb-2 opacity-50" />
                                                                        <span className="text-[10px] font-bold uppercase tracking-widest">No Image</span>
                                                                    </div>
                                                                }
                                                            />
                                                            {/* Gradient overlay at bottom */}
                                                            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/20 to-transparent" />
                                                            {/* Stock badge */}
                                                            <span className={`absolute top-3 left-3 text-[9px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide shadow-sm ${
                                                                product.in_stock
                                                                    ? 'bg-emerald-500 text-white'
                                                                    : 'bg-red-500 text-white'
                                                            }`}>
                                                                {product.in_stock ? '✓ In Stock' : '× Sold Out'}
                                                            </span>
                                                            {/* Quick inspect overlay */}
                                                            <button
                                                                onClick={() => setActiveProduct(product)}
                                                                className="absolute top-3 right-3 w-7 h-7 rounded-xl bg-black/30 backdrop-blur-sm text-white text-xs flex items-center justify-center hover:bg-black/50 transition-colors"
                                                            >
                                                                🔍
                                                            </button>
                                                        </div>

                                                        {/* Content */}
                                                        <div className="p-4 flex flex-col flex-1">
                                                            {/* Product ID */}
                                                            <p className={`text-[9px] font-mono font-bold uppercase tracking-widest mb-1 ${
                                                                darkMode ? 'text-dark-muted' : 'text-gray-400'
                                                            }`}>{product.id}</p>

                                                            {/* Name */}
                                                            <h4 className={`font-bold text-[13px] leading-snug line-clamp-2 flex-1 mb-3 ${
                                                                darkMode ? 'text-dark-text' : 'text-gray-900'
                                                            }`}>{product.name}</h4>

                                                            {/* Price row */}
                                                            <div className="flex items-center justify-between mb-3">
                                                                <div>
                                                                    <p className={`text-[9px] font-semibold uppercase tracking-wide ${
                                                                        darkMode ? 'text-dark-muted' : 'text-gray-400'
                                                                    }`}>Price</p>
                                                                    <p className="text-base font-black text-brand-purple">
                                                                        {product.price?.currency || 'LKR'} {(product.price?.amount || product.price)?.toLocaleString?.() ?? (product.price?.amount || product.price)}
                                                                    </p>
                                                                </div>
                                                                {cart.find(p => p.id === product.id) && (
                                                                    <span className="text-[9px] px-2 py-1 bg-brand-purple/10 text-brand-purple font-bold rounded-full border border-brand-purple/20">
                                                                        🛒 ×{cart.find(p => p.id === product.id)?.qty}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* 3 Action Buttons */}
                                                            <div className="grid grid-cols-3 gap-1.5">
                                                                {/* Delivery */}
                                                                <button
                                                                    onClick={() => sendMessage(`Check delivery availability for product ${product.id}`)}
                                                                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-[9px] font-bold transition-all duration-200 ${
                                                                        darkMode
                                                                            ? 'bg-white/5 text-dark-muted hover:bg-emerald-900/30 hover:text-emerald-400 border border-dark-border hover:border-emerald-800'
                                                                            : 'bg-gray-50 text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-100 hover:border-emerald-200'
                                                                    }`}
                                                                >
                                                                    <span className="text-base">🚚</span>
                                                                    Delivery
                                                                </button>
                                                                {/* Add to Cart */}
                                                                <button
                                                                    onClick={() => addToCart(product)}
                                                                    disabled={!product.in_stock}
                                                                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-[9px] font-bold transition-all duration-200 disabled:opacity-40 ${
                                                                        darkMode
                                                                            ? 'bg-white/5 text-dark-muted hover:bg-brand-purple/20 hover:text-brand-purple border border-dark-border hover:border-brand-purple/30'
                                                                            : 'bg-gray-50 text-gray-500 hover:bg-brand-purple/10 hover:text-brand-purple border border-gray-100 hover:border-brand-purple/20'
                                                                    }`}
                                                                >
                                                                    <span className="text-base">🛒</span>
                                                                    Cart
                                                                </button>
                                                                {/* Buy Now */}
                                                                <button
                                                                    onClick={() => sendMessage(`I would like to checkout and order product ${product.id} (${product.name}). Please help me complete the purchase.`)}
                                                                    disabled={!product.in_stock}
                                                                    className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-[9px] font-bold transition-all duration-200 disabled:opacity-40 bg-gradient-to-br from-brand-purple to-brand-purple-dark text-white hover:shadow-lg hover:shadow-brand-purple/30 hover:opacity-90"
                                                                >
                                                                    <span className="text-base">🛍️</span>
                                                                    Buy
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        );
                                    })()}

                                    {/* ── 2. Delivery Card ── */}
                                    {msg.tool === 'kapruka_check_delivery' && msg.raw_data && (() => {
                                        const deliveryData = getParsedData(msg.raw_data);
                                        if (!deliveryData) return null;

                                        // Fallback for errors or missing city
                                        if (deliveryData.text_content || deliveryData.error || deliveryData.reason || deliveryData.available === false && !deliveryData.city) {
                                            let errorMessage = deliveryData.reason || deliveryData.text_content || deliveryData.error || 'The selected date or city is invalid. Please try again.';
                                            
                                            // Attempt to extract cleaner error from raw text_content JSON dumps
                                            if (typeof errorMessage === 'string') {
                                                const match = errorMessage.match(/\{.*\}/);
                                                if (match) {
                                                    try {
                                                        const parsed = JSON.parse(match[0]);
                                                        if (parsed.reason) errorMessage = parsed.reason;
                                                    } catch(e) {}
                                                }
                                                // Clean up common Kapruka MCP prefixes
                                                errorMessage = errorMessage.replace('Error: Bad request — ', '').replace('. Check your input parameters.', '').trim();
                                            }

                                            const isHardError = errorMessage.toLowerCase().includes('error') || errorMessage.toLowerCase().includes('invalid');
                                            
                                            return (
                                                <div className={`mt-4 p-4 rounded-xl border flex items-start gap-3 ${
                                                    isHardError 
                                                        ? darkMode ? 'bg-red-900/20 border-red-900/50 text-red-400' : 'bg-red-50 border-red-200 text-red-700'
                                                        : darkMode ? 'bg-amber-900/20 border-amber-900/50 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'
                                                }`}>
                                                    <span className="text-xl">⚠️</span>
                                                    <div>
                                                        <h4 className="font-bold text-sm">{isHardError ? 'Delivery Check Failed' : 'Delivery Notice'}</h4>
                                                        <p className="text-xs mt-1 leading-relaxed opacity-90">{errorMessage}</p>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className={`mt-4 p-4 rounded-2xl shadow-md transition-colors duration-300 ${
                                                    darkMode ? 'bg-dark-card border border-dark-border' : 'bg-white border border-[#7A1C2C]/10'
                                                }`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className="p-3 bg-gradient-to-br from-brand-purple to-brand-purple-dark text-white rounded-2xl text-xl shadow-md">🚚</div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className={`font-extrabold text-sm ${darkMode ? 'text-dark-text' : 'text-[#002F6C]'}`}>
                                                                Delivery to {deliveryData.city}
                                                            </h4>
                                                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                                                deliveryData.available
                                                                    ? darkMode ? 'bg-emerald-900/50 text-emerald-400' : 'bg-green-100 text-green-700'
                                                                    : darkMode ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-700'
                                                            }`}>
                                                                {deliveryData.available ? 'Available' : 'Unavailable'}
                                                            </span>
                                                        </div>
                                                        <div className="mt-2 grid grid-cols-2 gap-3 text-xs font-semibold">
                                                            <div className={`p-2 rounded-xl ${darkMode ? 'bg-dark-bg border border-dark-border' : 'bg-[#FDF2F4] border border-[#7A1C2C]/5'}`}>
                                                                <p className={`text-[9px] font-medium ${darkMode ? 'text-dark-muted' : 'text-gray-400'}`}>Shipping Fee</p>
                                                                <p className={`mt-0.5 ${darkMode ? 'text-brand-purple-accent' : 'text-[#7A1C2C]'}`}>{deliveryData.currency || 'LKR'} {deliveryData.rate || deliveryData.cost}</p>
                                                            </div>
                                                            <div className={`p-2 rounded-xl ${darkMode ? 'bg-dark-bg border border-dark-border' : 'bg-[#FDF2F4] border border-[#7A1C2C]/5'}`}>
                                                                <p className={`text-[9px] font-medium ${darkMode ? 'text-dark-muted' : 'text-gray-400'}`}>Delivery Date</p>
                                                                <p className="text-emerald-500 mt-0.5">{deliveryData.checked_date || deliveryData.estimated_days}</p>
                                                            </div>
                                                        </div>
                                                        {deliveryData.perishable_warning && (
                                                            <div className={`mt-3 p-2 rounded-xl text-[9px] flex items-center gap-2 ${
                                                                darkMode ? 'bg-yellow-900/20 border border-yellow-800/30 text-yellow-400' : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                                                            }`}>
                                                                <span>⚠️</span>
                                                                <p className="font-medium leading-normal">{deliveryData.perishable_warning}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })()}

                                    {/* ── 3. Checkout Card ── */}
                                    {msg.tool === 'kapruka_create_order' && msg.raw_data && (() => {
                                        const orderData = getParsedData(msg.raw_data);
                                        if (!orderData) return null;

                                        if (orderData.text_content || orderData.error) {
                                            const errMsg = orderData.text_content || orderData.error;
                                            return (
                                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                                    className={`mt-4 p-4 rounded-2xl text-sm flex items-start gap-3 ${
                                                        darkMode ? 'bg-red-900/20 border border-red-800/30 text-red-400' : 'bg-red-50 border border-red-200 text-red-800'
                                                    }`}>
                                                    <span className="text-xl">⚠️</span>
                                                    <div>
                                                        <p className="font-bold text-xs uppercase tracking-wider mb-1">Order Could Not Be Created</p>
                                                        <p className="text-xs leading-relaxed">{errMsg}</p>
                                                    </div>
                                                </motion.div>
                                            );
                                        }

                                        const payUrl = orderData.checkout_url || orderData.payment_url || orderData.pay_url || orderData.url;
                                        const orderRef = orderData.order_ref || orderData.order_id || orderData.reference || orderData.pnref;
                                        const total = orderData.summary?.grand_total || orderData.grand_total || orderData.total;
                                        const currency = orderData.summary?.currency || orderData.currency || 'LKR';

                                        return (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ type: "spring", stiffness: 260, damping: 25 }}
                                                className="mt-5 p-6 bg-gradient-to-br from-[#002F6C] to-[#001845] text-white rounded-3xl shadow-2xl flex flex-col items-center text-center gap-3 relative overflow-hidden"
                                            >
                                                <div className="absolute top-0 right-0 w-40 h-40 bg-brand-purple/15 rounded-full blur-3xl -mr-10 -mt-10" />
                                                <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-blue/30 rounded-full blur-3xl -ml-10 -mb-10" />

                                                <div className="w-14 h-14 bg-gradient-to-br from-brand-purple to-brand-purple-dark rounded-2xl flex items-center justify-center text-3xl shadow-lg z-10 animate-float">
                                                    🛍️
                                                </div>

                                                <div className="z-10 w-full">
                                                    <h4 className="font-extrabold text-xl tracking-tight">Order Created!</h4>
                                                    {orderRef && (
                                                        <p className="text-[9px] text-brand-purple mt-1 font-mono uppercase tracking-widest font-bold">
                                                            Ref: {orderRef}
                                                        </p>
                                                    )}
                                                    {orderData.summary && (
                                                        <div className="my-4 bg-white/5 p-4 rounded-2xl border border-white/10 text-left text-xs space-y-2">
                                                            <div className="flex justify-between text-white/70">
                                                                <span>Items Total</span>
                                                                <span>{currency} {orderData.summary.items_total}</span>
                                                            </div>
                                                            <div className="flex justify-between text-white/70">
                                                                <span>Delivery Fee</span>
                                                                <span>{currency} {orderData.summary.delivery_fee}</span>
                                                            </div>
                                                            <div className="h-px bg-white/10 my-1" />
                                                            <div className="flex justify-between font-bold text-sm text-brand-purple">
                                                                <span>Grand Total</span>
                                                                <span>{currency} {total}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {payUrl ? (
                                                    <div className="w-full flex flex-col gap-2.5 z-10">
                                                        <button
                                                            onClick={() => setActivePayment({ url: payUrl, orderRef, total, currency })}
                                                            className="mt-2 w-full py-3.5 bg-white text-[#002F6C] hover:bg-[#FDF2F4] hover:text-[#7A1C2C] font-extrabold rounded-xl shadow-md transition-all duration-300 uppercase tracking-wider text-[11px] block text-center cursor-pointer hover:shadow-[0_0_25px_rgba(255,255,255,0.25)]"
                                                        >
                                                            Pay in App 📱
                                                        </button>
                                                        <a href={payUrl} target="_blank" rel="noopener noreferrer"
                                                            className="text-[10px] text-white/60 hover:text-white underline transition-all font-semibold tracking-wide"
                                                        >
                                                            Or open in new tab ↗️
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <div className="mt-2 w-full py-4 bg-white/10 text-white/50 font-bold rounded-xl border border-white/10 uppercase tracking-widest text-xs z-10 text-center">
                                                        Payment link will be sent to your phone
                                                    </div>
                                                )}
                                                <p className="text-[9px] text-white/30 mt-2 z-10 font-medium tracking-wide uppercase">🔒 Secure 60-Minute Price Lock</p>
                                            </motion.div>
                                        );
                                    })()}

                                    {/* ── 4. Order Tracking Timeline ── */}
                                    {msg.tool === 'kapruka_track_order' && msg.raw_data && (() => {
                                        const trackData = getParsedData(msg.raw_data);
                                        if (!trackData) return null;

                                        const steps = [
                                            { key: 'received', label: 'Order Received', icon: '📝' },
                                            { key: 'confirmed', label: 'Confirmed', icon: '💳' },
                                            { key: 'shipped', label: 'Dispatched', icon: '🚚' },
                                            { key: 'delivered', label: 'Delivered', icon: '🎉' }
                                        ];

                                        const currentStatus = (trackData.status || '').toLowerCase();
                                        let activeIndex = 0;
                                        if (currentStatus === 'confirmed') activeIndex = 1;
                                        else if (currentStatus === 'shipped' || currentStatus === 'out-for-delivery') activeIndex = 2;
                                        else if (currentStatus === 'delivered') activeIndex = 3;

                                        return (
                                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                                className={`mt-4 p-5 rounded-2xl shadow-md transition-colors duration-300 ${
                                                    darkMode ? 'bg-dark-card border border-dark-border' : 'bg-white border border-[#7A1C2C]/10'
                                                }`}>
                                                <div className={`flex justify-between items-center pb-3 border-b ${darkMode ? 'border-dark-border' : 'border-gray-100'}`}>
                                                    <div>
                                                        <p className={`text-[9px] uppercase tracking-wider font-bold ${darkMode ? 'text-dark-muted' : 'text-gray-400'}`}>Order Tracking</p>
                                                        <h4 className={`font-extrabold text-xs font-mono mt-0.5 ${darkMode ? 'text-dark-text' : 'text-[#002F6C]'}`}>{trackData.order_number}</h4>
                                                    </div>
                                                    <span className="px-3 py-1 bg-brand-purple/10 text-brand-purple text-xs font-bold rounded-full border border-brand-purple/20">
                                                        {trackData.status_display || trackData.status}
                                                    </span>
                                                </div>

                                                <div className="mt-5 space-y-4">
                                                    {steps.map((step, idx) => {
                                                        const isCompleted = idx <= activeIndex;
                                                        const isActive = idx === activeIndex;
                                                        return (
                                                            <div key={step.key} className="flex gap-3 relative">
                                                                {idx < steps.length - 1 && (
                                                                    <div className={`absolute left-4 top-8 bottom-0 w-0.5 -ml-px ${
                                                                        idx < activeIndex ? 'bg-emerald-500' : darkMode ? 'bg-dark-border' : 'bg-gray-200'
                                                                    }`} />
                                                                )}
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm z-10 transition-all ${
                                                                    isCompleted
                                                                        ? 'bg-emerald-500 text-white font-bold'
                                                                        : darkMode ? 'bg-dark-bg text-dark-muted' : 'bg-gray-100 text-gray-400'
                                                                } ${isActive ? 'ring-4 ring-emerald-500/20 scale-110' : ''}`}>
                                                                    {step.icon}
                                                                </div>
                                                                <div className="flex-1 pt-0.5">
                                                                    <p className={`text-xs font-bold ${isCompleted ? (darkMode ? 'text-dark-text' : 'text-gray-800') : (darkMode ? 'text-dark-muted' : 'text-gray-400')}`}>
                                                                        {step.label}
                                                                    </p>
                                                                    {isCompleted && trackData.progress?.[idx] && (
                                                                        <p className={`text-[9px] mt-0.5 ${darkMode ? 'text-dark-muted' : 'text-gray-400'}`}>
                                                                            {trackData.progress[idx].timestamp}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {trackData.recipient && (
                                                    <div className={`mt-5 p-3 rounded-xl text-[10px] space-y-1 ${
                                                        darkMode ? 'bg-dark-bg border border-dark-border' : 'bg-[#FDF2F4] border border-[#7A1C2C]/5'
                                                    }`}>
                                                        <p className={`font-extrabold uppercase tracking-wider text-[8px] mb-1 ${darkMode ? 'text-brand-purple-accent' : 'text-[#7A1C2C]'}`}>Shipping Details</p>
                                                        <p className={darkMode ? 'text-dark-text' : ''}><span className={`font-semibold ${darkMode ? 'text-dark-muted' : 'text-gray-500'}`}>Recipient:</span> {trackData.recipient.name} ({trackData.recipient.phone})</p>
                                                        <p className={darkMode ? 'text-dark-text' : ''}><span className={`font-semibold ${darkMode ? 'text-dark-muted' : 'text-gray-500'}`}>Address:</span> {trackData.recipient.address}, {trackData.recipient.city}</p>
                                                    </div>
                                                )}
                                            </motion.div>
                                        );
                                    })()}

                                    {/* ── 5. Categories Grid ── */}
                                    {msg.tool === 'kapruka_list_categories' && msg.raw_data && (() => {
                                        const catData = getParsedData(msg.raw_data);
                                        const categories = catData?.categories || (Array.isArray(catData) ? catData : null);
                                        if (!categories || !Array.isArray(categories)) return null;

                                        const emojiMap: Record<string, string> = {
                                            cakes: '🎂', flowers: '💐', chocolates: '🍫', clothing: '👗',
                                            jewellery: '💎', perfumes: '✨', grocery: '🛒', liquor: '🍷',
                                            softtoy: '🧸', sports: '⚽', electronic: '📱', fashion: '👠',
                                            fruits: '🍇', cosmetics: '💄', birthday: '🎉', wedding: '💒',
                                            christmas: '🎄', valentine: '❤️', anniversary: '🥂', kidstoys: '🎮',
                                            household: '🏠', pet: '🐾', pharmacy: '💊', babyitems: '👶',
                                            default: '🏷️'
                                        };

                                        return (
                                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex flex-wrap gap-2">
                                                {categories.slice(0, 24).map((cat: any) => {
                                                    const name = cat.name || cat;
                                                    const emoji = emojiMap[name.toLowerCase()] || emojiMap.default;
                                                    return (
                                                        <button key={name} onClick={() => sendMessage(`Show me ${name} products`)}
                                                            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 shadow-sm flex items-center gap-1.5 ${
                                                                darkMode
                                                                    ? 'bg-dark-card border border-dark-border text-dark-text hover:bg-brand-purple/10 hover:text-brand-purple hover:border-brand-purple/30'
                                                                    : 'bg-white border border-[#002F6C]/10 text-[#002F6C] hover:bg-[#002F6C] hover:text-white hover:border-[#002F6C]'
                                                            }`}>
                                                            <span>{emoji}</span><span>{name}</span>
                                                        </button>
                                                    );
                                                })}
                                            </motion.div>
                                        );
                                    })()}

                                    {/* ── 6. Cities Grid ── */}
                                    {msg.tool === 'kapruka_list_delivery_cities' && msg.raw_data && (() => {
                                        const cityData = getParsedData(msg.raw_data);
                                        const cities = cityData?.cities || (Array.isArray(cityData) ? cityData : null);
                                        if (!cities || !Array.isArray(cities)) {
                                            const mdText = msg.raw_data?.result || msg.raw_data?.structuredContent?.result || msg.raw_data?.text_content || JSON.stringify(msg.raw_data);
                                            return mdText ? (
                                                <div className={`mt-4 p-4 rounded-2xl border prose prose-sm max-w-none text-sm ${
                                                    darkMode ? 'bg-dark-card/50 border-dark-border text-dark-text' : 'bg-[#FDF2F4]/50 border-[#7A1C2C]/10 text-gray-800'
                                                }`}>
                                                    <ReactMarkdown>{mdText}</ReactMarkdown>
                                                </div>
                                            ) : null;
                                        }

                                        if (cities.length === 0) {
                                            return (
                                                <div className={`mt-4 p-4 rounded-2xl border prose prose-sm max-w-none text-sm ${
                                                    darkMode ? 'bg-dark-card/50 border-dark-border text-dark-text' : 'bg-[#FDF2F4]/50 border-[#7A1C2C]/10 text-gray-800'
                                                }`}>
                                                    <p>No delivery cities found matching that query. Please try another city.</p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex flex-wrap gap-2">
                                                {cities.slice(0, 16).map((city: any) => {
                                                    const cityName = city.name || city;
                                                    return (
                                                        <button key={cityName} onClick={() => sendMessage(`Check delivery options to ${cityName} for SOFTTOY001218`)}
                                                            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 shadow-sm flex items-center gap-1.5 ${
                                                                darkMode
                                                                    ? 'bg-dark-card border border-dark-border text-dark-text hover:bg-brand-purple/10 hover:text-brand-purple hover:border-brand-purple/30'
                                                                    : 'bg-white border border-[#002F6C]/10 text-[#002F6C] hover:bg-[#002F6C] hover:text-white hover:border-[#002F6C]'
                                                            }`}>
                                                            <span>📍</span><span>{cityName}</span>
                                                        </button>
                                                    );
                                                })}
                                            </motion.div>
                                        );
                                    })()}

                                    {/* Product Inspector Badge */}
                                    {msg.tool === 'kapruka_get_product' && msg.raw_data && (
                                        <button
                                            onClick={() => setActiveProduct(getParsedData(msg.raw_data))}
                                            className={`mt-3 text-xs font-bold px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 ${
                                                darkMode
                                                    ? 'text-brand-purple bg-brand-purple/10 hover:bg-brand-purple hover:text-white'
                                                    : 'text-[#7A1C2C] bg-[#FDF2F4] hover:bg-[#7A1C2C] hover:text-white'
                                            }`}
                                        >
                                            🔍 View Product Details ➡️
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                        </motion.div>
                    )}
                    </AnimatePresence>

                    {/* Loading Indicator */}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className={`p-4 rounded-3xl rounded-bl-lg shadow-sm flex gap-2.5 items-center ${
                                darkMode ? 'glass' : 'glass-strong'
                            }`}>
                                <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.2 }}
                                    className="w-2.5 h-2.5 bg-gradient-to-r from-brand-purple to-brand-purple-dark rounded-full" />
                                <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }}
                                    className="w-2.5 h-2.5 bg-gradient-to-r from-brand-purple to-brand-purple-dark rounded-full" />
                                <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }}
                                    className="w-2.5 h-2.5 bg-gradient-to-r from-brand-purple to-brand-purple-dark rounded-full" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                )}

                {/* ── Input Area ── */}
                <div className="p-4 md:p-6 pt-0 relative z-10">
                    <AnimatePresence>
                        {!isLoading && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="flex flex-col gap-2 mb-3 mt-1"
                            >
                                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 items-center">
                                    <span className={`text-[10px] font-bold uppercase tracking-widest whitespace-nowrap mr-2 ${darkMode ? 'text-dark-muted' : 'text-gray-400'}`}>Popular:</span>
                                    {['🎂 Birthday cake delivery', '💐 Flower bouquets', '🍫 Chocolate gifts', '🎁 Anniversary hampers'].map((chip, index) => (
                                        <button
                                            key={index}
                                            onClick={() => sendMessage(chip)}
                                            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200 ${
                                                darkMode
                                                    ? 'bg-dark-card/50 text-dark-text border border-dark-border hover:border-brand-purple hover:text-brand-purple'
                                                    : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-purple hover:text-brand-purple'
                                            }`}
                                        >
                                            {chip}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-3 items-center">
                                    <span className={`text-[10px] font-bold uppercase tracking-widest whitespace-nowrap mr-2 ${darkMode ? 'text-dark-muted' : 'text-gray-400'}`}>Budget:</span>
                                    {['Under Rs. 5,000', 'Rs. 5,000 – 10,000', 'Rs. 10,000 – 25,000', '💎 Premium Gifts'].map((chip, index) => (
                                        <button
                                            key={index}
                                            onClick={() => sendMessage(`Find gifts ${chip}`)}
                                            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200 ${
                                                darkMode
                                                    ? 'bg-dark-card/50 text-dark-text border border-dark-border hover:border-brand-purple hover:text-brand-purple'
                                                    : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-purple hover:text-brand-purple'
                                            }`}
                                        >
                                            {chip}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={sendMessage} className="relative flex items-center w-full">
                        <button type="button" onClick={() => alert('Image upload coming soon!')} className={`absolute left-2 p-2 rounded-full transition-colors cursor-pointer ${darkMode ? 'text-dark-muted hover:text-dark-text hover:bg-white/10' : 'text-gray-400 hover:text-brand-purple hover:bg-brand-purple/10'}`}>
                            <AttachmentIcon />
                        </button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="What gift are you looking for today?"
                            className={`w-full py-4 pl-12 pr-[100px] rounded-full focus-glow transition-all duration-300 text-sm placeholder:tracking-wide shadow-sm ${
                                darkMode
                                    ? 'bg-dark-card/80 text-dark-text placeholder:text-dark-muted border border-dark-border focus:border-brand-purple/50'
                                    : 'bg-white text-gray-700 placeholder:text-gray-400 border border-gray-200 focus:border-brand-purple/50'
                            }`}
                            disabled={isLoading}
                        />
                        <div className="absolute right-1.5 flex items-center gap-1">
                            <button type="button" onClick={() => alert('Voice input coming soon!')} className={`p-2 rounded-full transition-colors cursor-pointer ${darkMode ? 'text-dark-muted hover:text-dark-text hover:bg-white/10' : 'text-gray-400 hover:text-brand-purple hover:bg-brand-purple/10'}`}>
                                <MicrophoneIcon />
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading || !input.trim()}
                                className="w-10 h-10 bg-gradient-to-br from-brand-purple to-brand-purple-dark text-white rounded-full hover:shadow-lg hover:shadow-brand-purple/25 disabled:opacity-40 disabled:hover:shadow-none transition-all duration-300 active:scale-95 flex items-center justify-center cursor-pointer"
                            >
                                <SendIcon />
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* ═══════════════ PANE 3: PRODUCT INSPECTOR ═══════════════ */}
            <AnimatePresence>
                {activeProduct && (
                    <motion.div
                        initial={{ x: 400, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 400, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 280, damping: 28 }}
                        className={`w-80 lg:w-[400px] flex flex-col z-30 h-full transition-colors duration-300 ${
                            darkMode
                                ? 'bg-dark-surface/95 backdrop-blur-xl border-l border-dark-border'
                                : 'bg-white/95 backdrop-blur-xl border-l border-[#002F6C]/10 shadow-2xl'
                        }`}
                    >
                        {/* Header */}
                        <div className={`p-4 flex justify-between items-center border-b transition-colors duration-300 ${
                            darkMode ? 'border-dark-border' : 'border-gray-100 bg-[#FDF2F4]/30'
                        }`}>
                            <h3 className={`font-semibold text-sm uppercase tracking-wider ${darkMode ? 'text-dark-text' : 'text-[#002F6C]'}`}>
                                Product Inspector
                            </h3>
                            <button
                                onClick={() => setActiveProduct(null)}
                                className={`p-2 rounded-full transition-colors ${
                                    darkMode ? 'text-dark-muted hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-[#7A1C2C] hover:bg-[#FDF2F4]'
                                }`}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
                            {/* Image */}
                            <div className={`rounded-2xl overflow-hidden p-2 relative group ${
                                darkMode ? 'bg-dark-card border border-dark-border' : 'bg-gray-50 border border-gray-100'
                            }`}>
                                {(() => {
                                    const imgUrl = activeProduct.image_url || activeProduct.images?.[0];
                                    return (
                                        <ImageWithFallback 
                                            src={imgUrl} 
                                            alt={activeProduct.name}
                                            className="w-full h-64 object-contain rounded-xl group-hover:scale-105 transition-transform duration-500"
                                            fallback={
                                                <div className={`w-full h-64 flex flex-col items-center justify-center rounded-xl bg-gradient-to-br ${darkMode ? 'from-dark-bg to-black/20 text-dark-muted' : 'from-gray-100 to-gray-50 text-gray-400'}`}>
                                                    <FallbackImageIcon className="w-16 h-16 mb-3 opacity-30" />
                                                    <span className="text-xs font-bold uppercase tracking-widest opacity-60">Image Unavailable</span>
                                                </div>
                                            }
                                        />
                                    );
                                })()}
                            </div>

                            {/* Name & Price */}
                            <div>
                                <h2 className={`text-xl font-extrabold leading-tight mb-2 ${darkMode ? 'text-dark-text' : 'text-[#002F6C]'}`}>
                                    {activeProduct.name || 'Kapruka Item'}
                                </h2>
                                <div className={`flex items-center justify-between mt-3 py-3 border-t border-b ${
                                    darkMode ? 'border-dark-border' : 'border-gray-100'
                                }`}>
                                    <span className="text-2xl font-extrabold text-brand-purple">
                                        {activeProduct.price?.currency || activeProduct.currency || 'LKR'} {typeof activeProduct.price === 'object' ? activeProduct.price.amount : activeProduct.price}
                                    </span>
                                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide ${
                                        activeProduct.in_stock
                                            ? darkMode ? 'bg-emerald-900/50 text-emerald-400' : 'bg-green-100 text-green-700'
                                            : darkMode ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-700'
                                    }`}>
                                        {activeProduct.in_stock ? '● In Stock' : '○ Out of Stock'}
                                    </span>
                                </div>
                            </div>

                            {/* Description */}
                            {(activeProduct.description || activeProduct.summary) && (
                                <div className={`text-xs leading-relaxed pb-4 border-b ${
                                    darkMode ? 'text-dark-muted border-dark-border' : 'text-gray-600 border-gray-100'
                                }`}>
                                    <h4 className={`font-bold mb-1 ${darkMode ? 'text-dark-text' : 'text-[#002F6C]'}`}>Description</h4>
                                    <p>{activeProduct.description || activeProduct.summary}</p>
                                </div>
                            )}

                            {/* Attributes */}
                            {activeProduct.attributes && (
                                <div className={`grid grid-cols-2 gap-2 text-[10px] p-3 rounded-xl ${
                                    darkMode ? 'bg-dark-card border border-dark-border' : 'bg-gray-50 border border-gray-100'
                                }`}>
                                    {activeProduct.attributes.weight && (
                                        <div>
                                            <span className={`block ${darkMode ? 'text-dark-muted' : 'text-gray-400'}`}>Weight</span>
                                            <span className={`font-bold ${darkMode ? 'text-dark-text' : 'text-gray-700'}`}>{activeProduct.attributes.weight}</span>
                                        </div>
                                    )}
                                    {activeProduct.attributes.vendor && (
                                        <div>
                                            <span className={`block ${darkMode ? 'text-dark-muted' : 'text-gray-400'}`}>Vendor</span>
                                            <span className={`font-bold ${darkMode ? 'text-dark-text' : 'text-gray-700'}`}>{activeProduct.attributes.vendor}</span>
                                        </div>
                                    )}
                                    {activeProduct.rating && (
                                        <div className="col-span-2 mt-1 flex items-center gap-1">
                                            <span className="text-yellow-400">★</span>
                                            <span className={`font-bold ${darkMode ? 'text-dark-text' : 'text-gray-700'}`}>{activeProduct.rating} / 5.0</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="mt-auto space-y-3 pt-4">
                                {(() => {
                                    const storeUrl = activeProduct.direct_url || activeProduct.url;
                                    return storeUrl ? (
                                        <a href={storeUrl} target="_blank" rel="noopener noreferrer"
                                            className={`block w-full text-center py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 ${
                                                darkMode
                                                    ? 'bg-white/10 text-white hover:bg-white/20 border border-dark-border'
                                                    : 'bg-[#002F6C] hover:bg-[#001f4d] text-white shadow-lg hover:shadow-xl'
                                            }`}>
                                            View on Kapruka Store
                                        </a>
                                    ) : null;
                                })()}
                                <button
                                    onClick={() => sendMessage(`I would like to checkout and order product ${activeProduct.id || activeProduct.name} (${activeProduct.name}). Please help me complete the purchase.`)}
                                    className="block w-full text-center bg-gradient-to-r from-brand-purple to-brand-purple-dark text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:shadow-lg hover:shadow-brand-purple/25 transition-all duration-200"
                                >
                                    🛒 Buy This Gift
                                </button>
                                <button
                                    onClick={() => sendMessage(`Check delivery options to Kandy for ${activeProduct.name || activeProduct.id}`)}
                                    className={`block w-full text-center py-3 rounded-xl font-bold text-xs transition-all duration-200 border-2 ${
                                        darkMode
                                            ? 'border-dark-border text-dark-text hover:bg-white/5'
                                            : 'border-[#7A1C2C] text-[#7A1C2C] hover:bg-[#FDF2F4]'
                                    }`}
                                >
                                    🚚 Calculate Shipping
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══════════════ PANE 4: SECURE PAYMENT TERMINAL ═══════════════ */}
            <AnimatePresence>
                {activePayment && (
                    <motion.div
                        initial={{ x: 450, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 450, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 280, damping: 28 }}
                        className={`w-96 lg:w-[460px] flex flex-col z-30 h-full transition-colors duration-300 ${
                            darkMode
                                ? 'bg-dark-surface/95 backdrop-blur-xl border-l border-dark-border'
                                : 'bg-white/95 backdrop-blur-xl border-l border-[#002F6C]/10 shadow-2xl'
                        }`}
                    >
                        {/* Header */}
                        <div className={`p-4 flex justify-between items-center border-b transition-colors duration-300 ${
                            darkMode ? 'border-dark-border' : 'border-gray-100 bg-[#FDF2F4]/30'
                        }`}>
                            <div>
                                <h3 className={`font-bold text-sm uppercase tracking-wider ${darkMode ? 'text-dark-text' : 'text-[#002F6C]'}`}>
                                    Secure Checkout 🔒
                                </h3>
                                <p className={`text-[9px] font-mono mt-0.5 ${darkMode ? 'text-brand-purple-accent' : 'text-[#7A1C2C] font-semibold'}`}>
                                    REF: {activePayment.orderRef}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setActivePayment(null);
                                    setPaymentStatus('idle');
                                    setIframeLoading(true);
                                }}
                                className={`p-2 rounded-full transition-colors ${
                                    darkMode ? 'text-dark-muted hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-[#7A1C2C] hover:bg-[#FDF2F4]'
                                }`}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
                            {/* Check if mock payment url */}
                            {(() => {
                                const isMock = activePayment.url.includes('mock-link') || useMock;

                                if (isMock) {
                                    // ──────── MOCK PAYMENT GATEWAY ────────
                                    if (paymentStatus === 'processing') {
                                        return (
                                            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
                                                <div className="w-16 h-16 border-4 border-brand-purple border-t-transparent rounded-full animate-spin" />
                                                <div>
                                                    <h4 className={`font-bold text-base ${darkMode ? 'text-dark-text' : 'text-gray-800'}`}>Processing Payment...</h4>
                                                    <p className={`text-xs mt-1 ${darkMode ? 'text-dark-muted' : 'text-gray-500'}`}>Contacting Kapruka Secure Gateway</p>
                                                </div>
                                            </div>
                                        );
                                    }

                                    if (paymentStatus === 'success') {
                                        return (
                                            <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
                                                <motion.div
                                                    initial={{ scale: 0.5, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                                                    className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-white text-4xl shadow-lg shadow-emerald-500/20 animate-glow-pulse"
                                                >
                                                    ✓
                                                </motion.div>
                                                <div>
                                                    <h4 className="font-extrabold text-lg text-emerald-500">Payment Successful!</h4>
                                                    <p className={`text-xs mt-1 max-w-xs ${darkMode ? 'text-dark-muted' : 'text-gray-500'}`}>
                                                        Your payment of {activePayment.currency} {(Number(activePayment.total) + (addGreetingCard ? 250 : 0)).toLocaleString()} has been authorized. Re-routing back to concierge...
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="flex flex-col gap-5 flex-1 justify-between h-full">
                                            <div className="space-y-5">
                                                {/* Order Summary Mini-card */}
                                                <div className={`p-4 rounded-2xl ${darkMode ? 'bg-dark-card border border-dark-border' : 'bg-gray-50 border border-gray-100'}`}>
                                                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${darkMode ? 'text-dark-text' : 'text-[#002F6C]'}`}>Order Summary</h4>
                                                    <div className="space-y-1.5 text-xs">
                                                        <div className="flex justify-between">
                                                            <span className={darkMode ? 'text-dark-muted' : 'text-gray-500'}>Status</span>
                                                            <span className="text-amber-500 font-bold">Awaiting Payment</span>
                                                        </div>
                                                        {addGreetingCard && (
                                                            <>
                                                                <div className="flex justify-between">
                                                                    <span className={darkMode ? 'text-dark-muted' : 'text-gray-500'}>Greeting Card</span>
                                                                    <span className="text-brand-purple dark:text-brand-purple-light font-bold">{cardOccasion} (+ LKR 250)</span>
                                                                </div>
                                                                {cardMessage && (
                                                                    <div className={`mt-1 p-2 rounded-lg text-[10px] italic leading-normal border ${
                                                                        darkMode ? 'bg-white/5 border-white/5 text-dark-muted' : 'bg-white border-gray-100 text-gray-500'
                                                                    }`}>
                                                                        "{cardMessage}"
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                        <div className="flex justify-between">
                                                            <span className={darkMode ? 'text-dark-muted' : 'text-gray-500'}>Grand Total</span>
                                                            <span className={`font-bold ${darkMode ? 'text-dark-text' : 'text-gray-800'}`}>
                                                                {activePayment.currency} {(Number(activePayment.total) + (addGreetingCard ? 250 : 0)).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Greeting Card Addon Section */}
                                                <div className={`p-4 rounded-2xl border transition-all duration-300 ${
                                                    addGreetingCard
                                                        ? darkMode ? 'bg-brand-purple/10 border-brand-purple-accent/40 shadow-lg' : 'bg-[#FDF2F4] border-[#7A1C2C]/20 shadow-md'
                                                        : darkMode ? 'bg-dark-card/40 border-dark-border/40' : 'bg-white border-gray-100 shadow-sm'
                                                }`}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg">💌</span>
                                                            <div>
                                                                <h4 className={`text-xs font-bold ${darkMode ? 'text-dark-text' : 'text-[#002F6C]'}`}>Add Premium Greeting Card</h4>
                                                                <p className={`text-[10px] ${darkMode ? 'text-dark-muted' : 'text-gray-400'}`}>Handwritten card with your order (+ LKR 250)</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => setAddGreetingCard(!addGreetingCard)}
                                                            className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${
                                                                addGreetingCard ? 'bg-brand-purple' : 'bg-gray-300 dark:bg-dark-border'
                                                            }`}
                                                        >
                                                            <motion.div
                                                                animate={{ x: addGreetingCard ? 20 : 0 }}
                                                               transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                                className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-md"
                                                            />
                                                        </button>
                                                    </div>

                                                    {addGreetingCard && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="mt-4 pt-3 border-t border-dashed border-gray-200 dark:border-dark-border/50 space-y-3.5 text-xs"
                                                        >
                                                            <div>
                                                                <label className={`block font-semibold mb-1 ${darkMode ? 'text-dark-muted' : 'text-gray-500'}`}>Occasion</label>
                                                                <select
                                                                    value={cardOccasion}
                                                                    onChange={(e) => setCardOccasion(e.target.value)}
                                                                    className={`w-full p-2.5 rounded-xl border text-xs focus:ring-2 focus:ring-brand-purple focus:outline-none ${
                                                                        darkMode ? 'bg-dark-card border-dark-border text-dark-text' : 'bg-white border-gray-200 text-gray-800'
                                                                    }`}
                                                                >
                                                                    <option value="Birthday">Birthday 🎂</option>
                                                                    <option value="Anniversary">Anniversary 💍</option>
                                                                    <option value="Love / Valentine">Love / Romance ❤️</option>
                                                                    <option value="Congratulations">Congratulations 🎉</option>
                                                                    <option value="Get Well Soon">Get Well Soon 🩹</option>
                                                                    <option value="Thank You">Thank You 🙏</option>
                                                                </select>
                                                            </div>

                                                            <div>
                                                                <label className={`block font-semibold mb-1 ${darkMode ? 'text-dark-muted' : 'text-gray-500'}`}>Handwritten Message (Optional)</label>
                                                                <textarea
                                                                    value={cardMessage}
                                                                    onChange={(e) => setCardMessage(e.target.value)}
                                                                    placeholder="Write a custom warm message..."
                                                                    maxLength={300}
                                                                    rows={3}
                                                                    className={`w-full p-2.5 rounded-xl border text-xs focus:ring-2 focus:ring-brand-purple focus:outline-none resize-none ${
                                                                        darkMode ? 'bg-dark-card border-dark-border text-dark-text' : 'bg-white border-gray-200 text-gray-800'
                                                                    }`}
                                                                />
                                                                <p className="text-[9px] text-right text-gray-400 mt-1">{cardMessage.length} / 300</p>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </div>

                                                {/* Mock Gateway Header */}
                                                <div className="flex items-center gap-2.5 pb-3 border-b border-dashed border-gray-200 dark:border-dark-border">
                                                    <span className="text-lg">💳</span>
                                                    <div>
                                                        <h4 className={`text-xs font-extrabold uppercase tracking-wide ${darkMode ? 'text-dark-text' : 'text-gray-800'}`}>Card Payment Details</h4>
                                                        <p className={`text-[10px] ${darkMode ? 'text-dark-muted' : 'text-gray-400'}`}>Simulated Secure Transaction</p>
                                                    </div>
                                                </div>

                                                {/* Form Fields */}
                                                <div className="space-y-4 text-xs">
                                                    <div>
                                                        <label className={`block font-semibold mb-1 ${darkMode ? 'text-dark-muted' : 'text-gray-600'}`}>Cardholder Name</label>
                                                        <input
                                                            type="text"
                                                            value="M Rizmy"
                                                            readOnly
                                                            className={`w-full p-3 rounded-xl border font-bold ${
                                                                darkMode
                                                                    ? 'bg-dark-card border-dark-border text-dark-text'
                                                                    : 'bg-gray-100 border-gray-200 text-gray-800'
                                                            }`}
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className={`block font-semibold mb-1 ${darkMode ? 'text-dark-muted' : 'text-gray-600'}`}>Card Number</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value="4111 2222 3333 4444"
                                                                readOnly
                                                                className={`w-full p-3 rounded-xl border font-bold font-mono tracking-widest ${
                                                                    darkMode
                                                                        ? 'bg-dark-card border-dark-border text-dark-text'
                                                                        : 'bg-gray-100 border-gray-200 text-gray-800'
                                                                }`}
                                                            />
                                                            <span className="absolute right-3 top-3.5 text-xs font-bold text-blue-500">VISA</span>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className={`block font-semibold mb-1 ${darkMode ? 'text-dark-muted' : 'text-gray-600'}`}>Expiry Date</label>
                                                            <input
                                                                type="text"
                                                                value="12/28"
                                                                readOnly
                                                                className={`w-full p-3 rounded-xl border font-bold text-center ${
                                                                    darkMode
                                                                        ? 'bg-dark-card border-dark-border text-dark-text'
                                                                        : 'bg-gray-100 border-gray-200 text-gray-800'
                                                                }`}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className={`block font-semibold mb-1 ${darkMode ? 'text-dark-muted' : 'text-gray-600'}`}>CVV</label>
                                                            <input
                                                                type="password"
                                                                value="123"
                                                                readOnly
                                                                className={`w-full p-3 rounded-xl border font-bold text-center tracking-widest ${
                                                                    darkMode
                                                                        ? 'bg-dark-card border-dark-border text-dark-text'
                                                                        : 'bg-gray-100 border-gray-200 text-gray-800'
                                                                }`}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className={`p-3 rounded-xl flex items-center gap-2.5 text-[10px] ${
                                                        darkMode ? 'bg-emerald-950/20 border border-emerald-900/30 text-emerald-400' : 'bg-emerald-50 border border-emerald-100 text-emerald-800'
                                                    }`}>
                                                        <span>🛡️</span>
                                                        <p className="font-medium">Sandbox Mode Active. Payments are simulated and secure.</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Submit Button */}
                                            <div className="pt-4">
                                                <button
                                                    onClick={() => {
                                                        setPaymentStatus('processing');
                                                        setTimeout(() => {
                                                            setPaymentStatus('success');
                                                            setTimeout(() => {
                                                                const newOrder = {
                                                                    orderRef: activePayment.orderRef,
                                                                    total: Number(activePayment.total) + (addGreetingCard ? 250 : 0),
                                                                    currency: activePayment.currency,
                                                                    date: new Date().toLocaleString()
                                                                };
                                                                setPaidOrders(prev => {
                                                                    const updated = [newOrder, ...prev];
                                                                    localStorage.setItem('kapruka-orders', JSON.stringify(updated));
                                                                    return updated;
                                                                });
                                                                setActivePayment(null);
                                                                setPaymentStatus('idle');
                                                                sendMessage(`I have completed the payment for order ${activePayment.orderRef}. Please track my order.`);
                                                            }, 1500);
                                                        }, 2000);
                                                    }}
                                                    className="w-full bg-gradient-to-r from-brand-purple to-brand-purple-dark text-white py-4 rounded-xl font-bold uppercase tracking-wider hover:shadow-lg hover:shadow-brand-purple/25 transition-all cursor-pointer text-center"
                                                >
                                                    Simulate Payment 🔒
                                                </button>
                                            </div>
                                        </div>
                                    );
                                } else {
                                    // ──────── LIVE IFRAME CHECKOUT ────────
                                    return (
                                        <div className="flex flex-col gap-4 flex-1 h-full relative">
                                            <div className={`p-3 rounded-xl flex flex-col gap-1.5 text-[10px] border ${
                                                darkMode ? 'bg-dark-card border-dark-border text-dark-text' : 'bg-slate-50 border-slate-200 text-slate-700'
                                            }`}>
                                                <div className="flex items-center gap-1.5 font-bold">
                                                    <span>🔒</span>
                                                    <span>Direct Gateway Secure Frame</span>
                                                </div>
                                                <p className="leading-relaxed">
                                                    Some banks restrict rendering within frames. If this window is blank or payment fails to progress, use the button below to complete it.
                                                </p>
                                                <a
                                                    href={activePayment.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mt-1 font-bold text-brand-purple hover:underline flex items-center gap-1"
                                                >
                                                    Open Checkout In New Window ↗️
                                                </a>
                                            </div>

                                            {/* ── LIVE MODE: GREETING CARD ADD-ON ── */}
                                            <div className={`p-4 rounded-2xl transition-all duration-300 border ${
                                                addGreetingCard
                                                    ? darkMode ? 'bg-brand-purple/10 border-brand-purple-accent/40 shadow-lg' : 'bg-[#FDF2F4] border-[#7A1C2C]/20 shadow-md'
                                                    : darkMode ? 'bg-dark-card/40 border-dark-border/40' : 'bg-white border-gray-100 shadow-sm'
                                            }`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">💌</span>
                                                        <div>
                                                            <h4 className={`text-xs font-bold ${darkMode ? 'text-dark-text' : 'text-[#002F6C]'}`}>Add Premium Greeting Card</h4>
                                                            <p className={`text-[10px] ${darkMode ? 'text-dark-muted' : 'text-gray-400'}`}>Handwritten card with your order (+ LKR 250)</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => setAddGreetingCard(!addGreetingCard)}
                                                        className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${
                                                            addGreetingCard ? 'bg-brand-purple' : 'bg-gray-300 dark:bg-dark-border'
                                                        }`}
                                                    >
                                                        <motion.div
                                                            animate={{ x: addGreetingCard ? 20 : 0 }}
                                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                            className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-md"
                                                        />
                                                    </button>
                                                </div>

                                                {addGreetingCard && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="mt-4 pt-3 border-t border-dashed border-gray-200 dark:border-dark-border/50 space-y-3.5 text-xs"
                                                    >
                                                        <div>
                                                            <label className={`block font-semibold mb-1 ${darkMode ? 'text-dark-muted' : 'text-gray-500'}`}>Occasion</label>
                                                            <select
                                                                value={cardOccasion}
                                                                onChange={(e) => setCardOccasion(e.target.value)}
                                                                className={`w-full p-2.5 rounded-xl border text-xs focus:ring-2 focus:ring-brand-purple focus:outline-none ${
                                                                    darkMode ? 'bg-dark-card border-dark-border text-dark-text' : 'bg-white border-gray-200 text-gray-800'
                                                                }`}
                                                            >
                                                                <option value="Birthday">Birthday 🎂</option>
                                                                <option value="Anniversary">Anniversary 💍</option>
                                                                <option value="Love / Valentine">Love / Romance ❤️</option>
                                                                <option value="Congratulations">Congratulations 🎉</option>
                                                                <option value="Get Well Soon">Get Well Soon 🩹</option>
                                                                <option value="Thank You">Thank You 🙏</option>
                                                            </select>
                                                        </div>

                                                        <div>
                                                            <label className={`block font-semibold mb-1 ${darkMode ? 'text-dark-muted' : 'text-gray-500'}`}>Handwritten Message (Optional)</label>
                                                            <textarea
                                                                value={cardMessage}
                                                                onChange={(e) => setCardMessage(e.target.value)}
                                                                placeholder="Write a custom warm message..."
                                                                maxLength={300}
                                                                rows={3}
                                                                className={`w-full p-2.5 rounded-xl border text-xs focus:ring-2 focus:ring-brand-purple focus:outline-none resize-none ${
                                                                    darkMode ? 'bg-dark-card border-dark-border text-dark-text' : 'bg-white border-gray-200 text-gray-800'
                                                                }`}
                                                            />
                                                            <div className="flex justify-between items-center mt-1">
                                                                <p className={`text-[9px] ${darkMode ? 'text-brand-purple-accent' : 'text-[#7A1C2C]'}`}>*This message will be attached to the final order</p>
                                                                <span className={`text-[9px] ${darkMode ? 'text-dark-muted' : 'text-gray-400'}`}>{cardMessage.length}/300</span>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </div>
                                            <div className={`flex-1 rounded-2xl overflow-hidden border relative ${
                                                darkMode ? 'border-dark-border bg-black' : 'border-gray-200 bg-white'
                                            }`}>
                                                {iframeLoading && (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-sm z-10">
                                                        <div className="w-10 h-10 border-4 border-brand-purple border-t-transparent rounded-full animate-spin" />
                                                        <p className="mt-4 text-xs font-bold text-gray-500 dark:text-dark-muted animate-pulse">Loading Secure Gateway...</p>
                                                    </div>
                                                )}
                                                <iframe
                                                    src={activePayment.url}
                                                    title="Kapruka Payment Gateway"
                                                    className={`w-full h-full border-none transition-opacity duration-500 ${iframeLoading ? 'opacity-0' : 'opacity-100'}`}
                                                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                                                    onLoad={() => setIframeLoading(false)}
                                                />
                                            </div>
                                        </div>
                                    );
                                }
                            })()}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══════════════ PANE 5: ORDER HISTORY ═══════════════ */}
            <AnimatePresence>
                {showHistory && (
                    <motion.div
                        initial={{ x: 400, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 400, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 280, damping: 28 }}
                        className={`w-80 lg:w-[400px] flex flex-col z-30 h-full transition-colors duration-300 ${
                            darkMode
                                ? 'bg-dark-surface/95 backdrop-blur-xl border-l border-dark-border'
                                : 'bg-white/95 backdrop-blur-xl border-l border-[#002F6C]/10 shadow-2xl'
                        }`}
                    >
                        {/* Header */}
                        <div className={`p-4 flex justify-between items-center border-b transition-colors duration-300 ${
                            darkMode ? 'border-dark-border' : 'border-gray-100 bg-[#FDF2F4]/30'
                        }`}>
                            <h3 className={`font-semibold text-sm uppercase tracking-wider ${darkMode ? 'text-dark-text' : 'text-[#002F6C]'}`}>
                                Order History
                            </h3>
                            <button
                                onClick={() => setShowHistory(false)}
                                className={`p-2 rounded-full transition-colors ${
                                    darkMode ? 'text-dark-muted hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-[#7A1C2C] hover:bg-[#FDF2F4]'
                                }`}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                            {paidOrders.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
                                    <svg className={`w-20 h-20 mx-auto ${darkMode ? 'text-dark-muted/40' : 'text-brand-purple/20'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                    </svg>
                                    <div>
                                        <h4 className={`font-bold text-base ${darkMode ? 'text-dark-text' : 'text-gray-800'}`}>No Orders Found</h4>
                                        <p className={`text-xs mt-1 max-w-[200px] mx-auto ${darkMode ? 'text-dark-muted' : 'text-gray-500'}`}>
                                            You haven't made any purchases yet. Your completed orders will appear here.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {paidOrders.map((order, index) => (
                                        <motion.div
                                            key={index}
                                            whileHover={{ y: -2 }}
                                            className={`p-4 rounded-2xl border transition-all duration-200 ${
                                                darkMode
                                                    ? 'bg-dark-card border-dark-border hover:border-brand-purple/40'
                                                    : 'bg-white border-gray-100 shadow-sm hover:shadow-md'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${darkMode ? 'text-brand-purple-accent' : 'text-brand-purple-dark'}`}>
                                                        {order.orderRef}
                                                    </span>
                                                    <p className={`text-[9px] ${darkMode ? 'text-dark-muted' : 'text-gray-400'}`}>
                                                        {order.date}
                                                    </p>
                                                </div>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
                                                    Paid
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-baseline mt-3 mb-4">
                                                <span className={`text-xs ${darkMode ? 'text-dark-muted' : 'text-gray-500'}`}>Total Paid</span>
                                                <span className="text-sm font-extrabold text-brand-purple">
                                                    {order.currency || 'LKR'} {order.total}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setShowHistory(false);
                                                    sendMessage(`Track order ${order.orderRef}`);
                                                }}
                                                className="w-full py-2 bg-gradient-to-r from-brand-purple to-brand-purple-dark text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:shadow-md hover:shadow-brand-purple/20 transition-all duration-200"
                                            >
                                                Track Order 🚚
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══════════════ PANE 5: SHOPPING CART PANEL ═══════════════ */}
            <AnimatePresence>
                {showCartPanel && (
                    <motion.div
                        initial={{ x: 400, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 400, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 280, damping: 28 }}
                        className={`w-80 lg:w-[400px] flex flex-col z-30 h-full transition-colors duration-300 relative ${
                            darkMode
                                ? 'bg-dark-surface/95 backdrop-blur-xl border-l border-dark-border'
                                : 'bg-white/95 backdrop-blur-xl border-l border-[#002F6C]/10 shadow-2xl'
                        }`}
                    >
                        {/* Header */}
                        <div className={`p-4 flex justify-between items-center border-b transition-colors duration-300 ${
                            darkMode ? 'border-dark-border' : 'border-gray-100 bg-[#FDF2F4]/30'
                        }`}>
                            <div className="flex items-center gap-2">
                                <span className={`text-base flex items-center justify-center ${darkMode ? 'text-brand-purple-accent' : 'text-[#002F6C]'}`}><CartIcon /></span>
                                <h3 className={`font-bold text-sm ${darkMode ? 'text-dark-text' : 'text-gray-900'}`}>Shopping Cart</h3>
                            </div>
                            <button onClick={() => setShowCartPanel(false)} className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                darkMode ? 'text-dark-muted hover:bg-white/5 hover:text-dark-text' : 'text-gray-500 hover:bg-gray-100'
                            }`}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {cart.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-center py-20 gap-4 h-full">
                                    <span className={`text-5xl ${darkMode ? 'text-dark-muted/30' : 'text-gray-200'}`}><CartIcon /></span>
                                    <div>
                                        <h4 className={`font-bold text-sm ${darkMode ? 'text-dark-text' : 'text-gray-800'}`}>Your Cart is Empty</h4>
                                        <p className={`text-xs mt-1 max-w-[200px] mx-auto ${darkMode ? 'text-dark-muted' : 'text-gray-500'}`}>
                                            Explore the catalog and add products to start shopping.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {cart.map(item => (
                                        <div key={item.id} className={`p-3 rounded-2xl border transition-all duration-200 flex gap-3 items-center ${
                                            darkMode ? 'bg-dark-card border-dark-border' : 'bg-white border-gray-100 shadow-sm'
                                        }`}>
                                            <ImageWithFallback 
                                                src={item.image_url || item.images?.[0]} 
                                                className="w-12 h-12 rounded-xl object-cover shadow-sm"
                                                fallback={
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${darkMode ? 'bg-dark-bg text-dark-muted' : 'bg-gray-100 text-gray-400'}`}>
                                                        <FallbackImageIcon className="w-6 h-6 opacity-50" />
                                                    </div>
                                                }
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs font-semibold truncate ${darkMode ? 'text-dark-text' : 'text-gray-800'}`}>{item.name}</p>
                                                <p className="text-[10px] text-brand-purple mt-0.5 font-bold">{item.price.currency || 'LKR'} {item.price.amount.toLocaleString()}</p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <button onClick={() => decreaseQty(item.id)} className={`w-5 h-5 flex items-center justify-center rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                                                        darkMode ? 'border-dark-border text-dark-text hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-100'
                                                    }`}>-</button>
                                                    <span className={`text-xs font-bold ${darkMode ? 'text-dark-text' : 'text-gray-900'}`}>{item.qty}</span>
                                                    <button onClick={() => increaseQty(item.id)} className={`w-5 h-5 flex items-center justify-center rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                                                        darkMode ? 'border-dark-border text-dark-text hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-100'
                                                    }`}>+</button>
                                                </div>
                                            </div>
                                            <button onClick={() => removeFromCart(item.id)} className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                                darkMode ? 'text-red-400 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-50'
                                            }`}>
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Summary & Checkout */}
                        {cart.length > 0 && (
                            <div className={`p-4 border-t transition-colors duration-300 space-y-4 ${
                                darkMode ? 'border-dark-border bg-dark-card/20' : 'border-gray-100 bg-[#FDF2F4]/10'
                            }`}>
                                <div className="space-y-1.5">
                                    <div className={`flex justify-between text-xs font-bold ${darkMode ? 'text-dark-text' : 'text-gray-800'}`}>
                                        <span>Total Items</span>
                                        <span>{cart.reduce((sum, item) => sum + item.qty, 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-extrabold text-brand-purple">
                                        <span>Subtotal</span>
                                        <span>LKR {cart.reduce((sum, item) => sum + (item.price.amount * item.qty), 0).toLocaleString()}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowCartPanel(false);
                                        const itemsStr = cart.map(i => `- ${i.qty}x ${i.name} (ID: ${i.id})`).join('\n');
                                        sendMessage(`I am ready to checkout with the following items in my cart:\n${itemsStr}\n\nPlease ask me for the recipient, delivery address, and sender details step-by-step so we can create the order!`);
                                    }}
                                    className="w-full py-3 bg-gradient-to-r from-brand-purple to-brand-purple-dark text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all duration-300 text-center cursor-pointer uppercase tracking-wider"
                                >
                                    Proceed to Checkout
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}