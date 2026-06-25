import { useState, useRef, useEffect, Fragment, startTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import confetti from 'canvas-confetti';

import { getParsedData, getDynamicGreeting } from './utils/helpers';
import { ImageWithFallback } from './components/common/ImageWithFallback';
import {
  SendIcon, SunIcon, MoonIcon, EditIcon, ChatIcon, HelpIcon, HistoryIcon, CategoriesIcon,
  CartIcon, TrashIcon, SidebarIcon, FallbackImageIcon,
  AttachmentIcon, MicrophoneIcon
} from './components/icons';

import aylaAvatar from './assets/ayla_avatar.png';

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
  image?: string;
  timestamp?: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

const techPattern = `url('data:image/svg+xml;utf8,<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="2" fill="black"/><circle cx="80" cy="30" r="3" fill="black"/><circle cx="40" cy="80" r="2" fill="black"/><circle cx="70" cy="90" r="1.5" fill="black"/><path d="M20 20 L80 30 L40 80 Z" fill="none" stroke="black" stroke-width="0.5" stroke-dasharray="2,2"/><path d="M20 20 L40 80" fill="none" stroke="black" stroke-width="0.5"/><path d="M80 30 L70 90 L40 80" fill="none" stroke="black" stroke-width="0.5"/><path d="M0 50 L20 20 M100 50 L80 30 M50 100 L40 80 M50 0 L80 30" fill="none" stroke="black" stroke-width="0.2"/></svg>')`;

import { translations } from './translations';

// ── Sri Lankan occasions & holidays awareness ──
const getSriLankaOccasion = (): string | null => {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const day = now.getDate();
    const hour = now.getHours();

    // Major Sri Lankan occasions
    if (month === 4 && day >= 10 && day <= 16) return 'Sinhala & Tamil New Year is coming up 🎊';
    if (month === 2 && day >= 12 && day <= 16) return "Valentine's Day is around the corner 💝";
    if (month === 5 && day >= 9 && day <= 14) return "Mother's Day is coming up 💐";
    if (month === 12 && day >= 20 && day <= 31) return 'Christmas season is here 🎄';
    if (month === 12 && day >= 28 || (month === 1 && day <= 3)) return 'New Year celebrations are here 🎉';
    if (month === 6 && day >= 14 && day <= 18) return 'Poson Poya is approaching 🌕';
    if (month === 5 && day >= 20 && day <= 25) return 'Vesak season is here 🏮';
    if (month === 6 && day >= 18 && day <= 22) return "Father's Day is coming up 👨‍👧";
    // Time-of-day context
    if (hour >= 6 && hour < 11) return null; // morning — no special occasion
    if (hour >= 11 && hour < 14) return null;
    return null;
};

const getInitialWelcomeMsg = (): Message => {
    const occasion = getSriLankaOccasion();
    const occasionLine = occasion ? `\n\n✨ *${occasion}* — perfect time to send something special!` : '';
    return {
        role: 'bot',
        text: `${getDynamicGreeting()} I'm **Ayla**, your Kapruka AI Gift Concierge — powered by Gemini & MCP. 🎁${occasionLine}\n\nTell me who you're shopping for and I'll find the perfect gift!`,
        timestamp: Date.now()
    };
};

// ── Contextual suggestion chips per tool ──
const getSuggestionsForTool = (tool: string | undefined): string[] => {
    if (!tool) return ['🎁 Find birthday gifts', '💐 Send flowers', '🎂 Order a cake', '📦 Track my order'];
    switch (tool) {
        case 'kapruka_search_products':
            return ['🔍 Refine search', '📍 Check delivery', '🛒 Add to cart & checkout', '🔀 Show me something different'];
        case 'kapruka_get_product':
            return ['🛒 Add to cart', '📍 Check delivery to Colombo', '💬 Tell me more about this', '🔍 Find similar products'];
        case 'kapruka_check_delivery':
            return ['✅ Proceed to checkout', '📍 Check another city', '🛒 View my cart', '🔍 Search more gifts'];
        case 'kapruka_create_order':
            return ['📦 Track this order', '🎁 Send another gift', '🔍 Browse more products', '🏠 Start over'];
        case 'kapruka_track_order':
            return ['📞 Contact support', '🎁 Send another gift', '🔍 Shop for more'];
        case 'kapruka_list_categories':
            return ['🎂 Show Cakes', '💐 Show Flowers', '🍫 Show Chocolates', '🧸 Show Soft Toys'];
        case 'kapruka_set_reminder':
            return ['🔍 Find gifts for this event', '🎂 Order a cake', '💐 Browse flowers', '📍 Check delivery options'];
        default:
            return ['🎁 Browse gifts', '📍 Check delivery', '🎂 Birthday ideas', '📦 Track order'];
    }
};

export default function ChatApp() {
    const [currentLang, setCurrentLang] = useState<'en' | 'si' | 'ta'>('en');
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

    const formatMessageTime = (timestamp?: number) => {
        if (!timestamp) return '';
        return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(timestamp));
    };
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
            setMobileSidebarOpen(false);
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
        setMobileSidebarOpen(false);
        // Reset scroll position to top
        setTimeout(() => {
            const chatContainer = document.getElementById('main-chat-container');
            if (chatContainer) chatContainer.scrollTop = 0;
        }, 10);
    };

    const switchSession = (id: string) => {
        setActiveSessionId(id);
        setActiveProduct(null);
        setActivePayment(null);
        setShowHelp(false);
        setShowHistory(false);
        setMobileSidebarOpen(false);
        // Reset scroll position to top
        setTimeout(() => {
            const chatContainer = document.getElementById('main-chat-container');
            if (chatContainer) chatContainer.scrollTop = 0;
        }, 10);
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
    const [loadingPhrase, setLoadingPhrase] = useState('Ayla is thinking...');
    const [activeProduct, setActiveProduct] = useState<any>(null);
    const [activePayment, setActivePayment] = useState<any>(null);
    const [iframeLoading, setIframeLoading] = useState(true);
    const [suggestedActions, setSuggestedActions] = useState<string[]>(getSuggestionsForTool(undefined));
    const [lastSearchContext, setLastSearchContext] = useState<{query?: string; products?: string[]; lastTool?: string}>({});
    const [prefetchedProducts, setPrefetchedProducts] = useState<any[]>([]);
    // Gate the Mock/Live dev toggle behind ?dev=true in URL
    const showDevTools = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === 'true';

    // ── Reminder State ──
    const [reminders, setReminders] = useState<Array<{id: string; event_name: string; event_date: string; recipient_relation?: string; created_at: number}>>(() => {
        try { return JSON.parse(localStorage.getItem('ayla-reminders') || '[]'); } catch { return []; }
    });

    // Register service worker + check reminders on load
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/reminder-sw.js').catch(err => {
                console.warn('[Ayla] SW registration failed:', err);
            });
        }
    }, []);

    // Check reminders daily via the service worker
    useEffect(() => {
        if (reminders.length === 0) return;
        if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
        if (Notification.permission === 'denied') return;

        const doCheck = () => {
            navigator.serviceWorker.ready.then(reg => {
                if (reg.active) {
                    reg.active.postMessage({ type: 'CHECK_REMINDERS', reminders });
                }
            });
        };

        doCheck();
        const interval = setInterval(doCheck, 60 * 60 * 1000); // Re-check hourly
        return () => clearInterval(interval);
    }, [reminders]);

    // Save a new reminder and request notification permission
    const saveReminder = (reminderData: {event_name: string; event_date: string; recipient_relation?: string}) => {
        const newReminder = {
            id: `reminder_${Date.now()}`,
            event_name: reminderData.event_name,
            event_date: reminderData.event_date,
            recipient_relation: reminderData.recipient_relation,
            created_at: Date.now()
        };

        setReminders(prev => {
            const updated = [...prev, newReminder];
            localStorage.setItem('ayla-reminders', JSON.stringify(updated));
            return updated;
        });

        // Request notification permission if not already granted
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    // Immediately tell SW to check
                    navigator.serviceWorker.ready.then(reg => {
                        if (reg.active) {
                            reg.active.postMessage({ type: 'CHECK_REMINDERS', reminders: [newReminder] });
                        }
                    });
                }
            });
        } else if (Notification.permission === 'granted') {
            navigator.serviceWorker.ready.then(reg => {
                if (reg.active) {
                    reg.active.postMessage({ type: 'CHECK_REMINDERS', reminders: [newReminder] });
                }
            });
        }
    };

    // ── Image Upload State ──
    const [attachedImage, setAttachedImage] = useState<string | null>(null);
    const [attachedImageMime, setAttachedImageMime] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64String = event.target?.result as string;
            setAttachedImage(base64String);
            setAttachedImageMime(file.type);
        };
        reader.readAsDataURL(file);
    };

    // ── Voice Input State ──
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef<any>(null);
    const [liveTranscript, setLiveTranscript] = useState('');
    // Initialize Web Speech API
    const sendMessageRef = useRef<any>(null);

    useEffect(() => {
        if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            
            let silenceTimer: any = null;
            let accumulatedTranscript = '';
            let isSending = false;

            recognitionRef.current.onstart = () => {
                setIsRecording(true);
                accumulatedTranscript = '';
                setLiveTranscript('');
                isSending = false;
            };
            
            recognitionRef.current.onresult = (event: any) => {
                if (isSending) return;
                
                let currentInterim = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        accumulatedTranscript += event.results[i][0].transcript + ' ';
                    } else {
                        currentInterim += event.results[i][0].transcript;
                    }
                }
                
                const fullText = (accumulatedTranscript + currentInterim).trim();
                setLiveTranscript(fullText);
                
                if (silenceTimer) clearTimeout(silenceTimer);
                
                silenceTimer = setTimeout(() => {
                    if (fullText && sendMessageRef.current) {
                        isSending = true;
                        sendMessageRef.current(fullText);
                        accumulatedTranscript = '';
                        setLiveTranscript('');
                        if (recognitionRef.current) {
                            recognitionRef.current.stop();
                        }
                    }
                }, 2000); // 2 second pause is perfect for auto-send
            };
            
            recognitionRef.current.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                setIsRecording(false);
            };
            
            recognitionRef.current.onend = () => {
                setIsRecording(false);
                if (silenceTimer) clearTimeout(silenceTimer);
            };
        }
    }, []);

    // Update recognition language
    useEffect(() => {
        if (recognitionRef.current) {
            // Use en-LK instead of en-US to better handle local accents and Singlish loanwords
            const langMap = { en: 'en-LK', si: 'si-LK', ta: 'ta-LK' };
            recognitionRef.current.lang = langMap[currentLang as keyof typeof langMap] || 'en-LK';
        }
    }, [currentLang]);

    const toggleRecording = () => {
        if (!recognitionRef.current) {
            alert("Your browser does not support voice input.");
            return;
        }
        if (isRecording) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
    };


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
    const [useMock, setUseMock] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('kapruka-use-mock');
            if (saved !== null) return saved === 'true';
        }
        return false; // Default to Live API mode for new users
    });
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
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    const handleProductClick = (product: any) => {
        setActiveProduct(product);
        setShowCartPanel(false);
    };

    const handleToggleCart = () => {
        setShowCartPanel(prev => {
            if (!prev) setActiveProduct(null);
            return !prev;
        });
    };

    const addToCart = (product: any) => {
        setCart(prev => {
            const exists = prev.find(p => p.id === product.id);
            if (exists) return prev.map(p => p.id === product.id ? { ...p, qty: p.qty + 1 } : p);
            return [...prev, { ...product, qty: 1 }];
        });
        setActiveProduct(null);
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
            q: "Is Ayla just a shopping bot?",
            a: "Not at all! Ayla is designed to be your personal AI companion. Whether you need gift ideas, are stressed about planning an anniversary, need relationship advice, or just want to chat about your day, she's here to listen without judgment and support you."
        },
        {
            q: "What languages can I use to chat?",
            a: "Ayla is fully fluent in English, Sinhala, and Tamil. She also understands 'Singlish' and 'Tanglish'! Just start typing or speaking in whatever language feels most comfortable to you."
        },
        {
            q: "Can you deliver on specific dates or same-day?",
            a: "Yes! We offer island-wide delivery in Sri Lanka. You can schedule gifts for specific dates like birthdays, and we even offer same-day delivery for select items in the Colombo area. Just ask Ayla to 'Check delivery to [City]'."
        },
        {
            q: "Can I customize gifts through the chat?",
            a: "Yes! You can ask Ayla to customize cakes with specific icing messages, pick preferred flower colors, or build custom hampers. Just let her know exactly what you have in mind."
        },
        {
            q: "How do I check my order status?",
            a: "Just ask Ayla! Type or say 'Track my order [Order Number]' and she will instantly provide you with real-time updates on your delivery."
        },
        {
            q: "Is it safe to pay through the chat?",
            a: "100% safe. Once your cart is ready, Ayla provides a secure checkout link. Your payment is processed through Kapruka's secure bank gateway, accepting Visa, MasterCard, Amex, and local mobile wallets."
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

    useEffect(() => {
        localStorage.setItem('kapruka-use-mock', String(useMock));
    }, [useMock]);

    // ── Rotating promotional personality phrases ──
    const loadingPhrases = [
        "Searching Kapruka's 10,000+ premium gifts... 🎁",
        "Checking same-day delivery slots in Sri Lanka... 🚚",
        "Looking for the freshest cakes and flowers... 🎂",
        "Curating the best options for your loved ones... ✨",
        "Verifying secure checkout options... 🔒",
        "Ayla is picking the perfect match... 🌟"
    ];
    useEffect(() => {
        if (!isLoading) return;
        let i = 0;
        setLoadingPhrase(loadingPhrases[0]);
        const interval = setInterval(() => {
            i = (i + 1) % loadingPhrases.length;
            setLoadingPhrase(loadingPhrases[i]);
        }, 2000);
        return () => clearInterval(interval);
    }, [isLoading]);

    // ── Prefetch popular products for homepage carousel ──
    useEffect(() => {
        const prefetch = async () => {
            try {
                const isDev = import.meta.env.MODE === 'development';
                const apiUrl = isDev ? '/api-proxy/chat/message' : (import.meta.env.VITE_API_URL + '/chat/message');
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ message: 'Show me popular gifts', use_mock: false, history: [] })
                });
                if (!res.ok) return;
                const data = await res.json();
                const results = data?.raw_data?.results;
                if (Array.isArray(results) && results.length > 0) {
                    setPrefetchedProducts(results.slice(0, 6));
                }
            } catch (_) { /* silent fail — homepage still shows emoji fallbacks */ }
        };
        prefetch();
    }, []);


    // ── Smart chip resolver — turns generic chip text into contextual messages ──
    const resolveChipMessage = (chipText: string): string => {
        const stripped = chipText.replace(/^[\p{Emoji}\s]+/u, '').trim();
        const { query, products } = lastSearchContext;

        const productList = products && products.length > 0
            ? `(I already saw: ${products.slice(0, 3).join(', ')})`
            : '';

        switch (stripped) {
            case 'Show me something different':
                return query
                    ? `Show me different ${query} options, something I haven't seen yet ${productList}. Try a different style, category, or price range.`
                    : 'Show me something completely different — surprise me with a unique gift idea!';

            case 'Refine search':
                return query
                    ? `Help me refine my search for ${query}. What filters or options can we adjust?`
                    : 'Help me refine my search with better filters.';

            case 'Add to cart & checkout':
                return products && products.length > 0
                    ? `I want to buy the ${products[0]}. Help me add it to cart and proceed to checkout.`
                    : 'Help me add the item to cart and checkout.';

            case 'Add to cart':
                return products && products.length > 0
                    ? `Add the ${products[0]} to my cart.`
                    : 'Add this item to my cart.';

            case 'Check delivery':
            case 'Check delivery to Colombo':
                return 'Check delivery availability and cost to Colombo.';

            case 'Proceed to checkout':
                return 'I am ready to checkout. Please help me place the order.';

            case 'Find similar products':
                return query
                    ? `Find me products similar to ${products?.[0] || query} — same style but different options.`
                    : 'Find me similar products.';

            case 'Find gifts for this event':
                return query
                    ? `Find me gifts for ${query}`
                    : 'Find me gifts for this upcoming event.';

            default:
                return stripped;
        }
    };

    const sendMessage = async (eOrText: any) => {
        if (eOrText?.preventDefault) eOrText.preventDefault();
        const userText = typeof eOrText === 'string' ? eOrText : input;
        if (!userText.trim() && !attachedImage) return;

        setInput('');
        
        // Capture image state for the request
        const currentImage = attachedImage;
        const currentMime = attachedImageMime;
        
        setAttachedImage(null);
        setAttachedImageMime(null);

        const updatedMessages = [...messages, { role: 'user' as const, text: userText, image: currentImage || undefined, timestamp: Date.now() }];
        setMessages(updatedMessages);
        setIsLoading(true);

        const history = updatedMessages
            .slice(1, -1)
            .map(msg => {
                let historyText = msg.text;
                if (msg.role === 'model' && msg.tool && msg.raw_data) {
                    const filters = msg.raw_data.applied_filters ? JSON.stringify(msg.raw_data.applied_filters) : '';
                    historyText += `\n[System internal memory: I previously executed ${msg.tool} tool with filters: ${filters}]`;
                }
                return { role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: historyText }] };
            })
            .slice(-20);

        try {
            const isDev = import.meta.env.MODE === 'development';
            const apiUrl = isDev ? '/api-proxy/chat/message' : (import.meta.env.VITE_API_URL + '/chat/message');
            const token = import.meta.env.VITE_CHAT_TOKEN || '';
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Accept': 'application/json',
                    'X-Chat-Token': token
                },
                body: JSON.stringify({ 
                    message: userText, 
                    use_mock: useMock, 
                    history,
                    image: currentImage || undefined,
                    mime_type: currentMime || undefined
                })
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
                raw_data: data.raw_data,
                timestamp: Date.now()
            }]);
            
            if (data.tool_called === 'kapruka_get_product' && data.raw_data) {
                setActiveProduct(getParsedData(data.raw_data));
            }

            // 🔔 Save reminder to localStorage + trigger notification permission
            if (data.tool_called === 'kapruka_set_reminder' && data.raw_data) {
                const parsed = getParsedData(data.raw_data);
                if (parsed?.status === 'success' && parsed?.event_name && parsed?.event_date) {
                    saveReminder({
                        event_name: parsed.event_name,
                        event_date: parsed.event_date,
                        recipient_relation: parsed.recipient_relation
                    });
                }
            }

            // Update contextual suggestion chips + capture last search context
            setSuggestedActions(getSuggestionsForTool(data.tool_called));
            if (data.tool_called === 'kapruka_search_products' && data.raw_data) {
                const parsed = getParsedData(data.raw_data);
                const productNames = (parsed?.results || []).slice(0, 6).map((p: any) => p.name).filter(Boolean);
                const appliedQuery = parsed?.applied_filters?.q || userText;
                setLastSearchContext({ query: appliedQuery, products: productNames, lastTool: 'kapruka_search_products' });
            } else if (data.tool_called) {
                setLastSearchContext(prev => ({ ...prev, lastTool: data.tool_called }));
            }

            // 🎉 Confetti on successful order creation only
            const isOrderSuccess = data.tool_called === 'kapruka_create_order'
                && data.raw_data
                && !data.raw_data?.error
                && !data.raw_data?.text_content  // Kapruka puts errors here
                && data.raw_data?.checkout_url || data.raw_data?.payment_url || data.raw_data?.pay_url || data.raw_data?.url  // must have a payment link
                && !/(sorry|couldn|rate.?limit|failed|error)/i.test(data.text || '');  // LLM text must not be an apology

            if (isOrderSuccess) {
                confetti({
                    particleCount: 150,
                    spread: 80,
                    origin: { y: 0.6 },
                    colors: ['#002F6C', '#7A1C2C', '#8B6CE5', '#ffffff', '#FFD700'],
                });
                setTimeout(() => confetti({ particleCount: 60, spread: 50, origin: { y: 0.55 }, angle: 60, colors: ['#8B6CE5', '#FFD700'] }), 400);
                setTimeout(() => confetti({ particleCount: 60, spread: 50, origin: { y: 0.55 }, angle: 120, colors: ['#002F6C', '#ffffff'] }), 600);
            }
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'bot', text: "Sorry, I had trouble reaching the Kapruka database. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        sendMessageRef.current = sendMessage;
    }, [sendMessage]);

    return (
        <div className={`flex h-[100dvh] w-full overflow-hidden font-sans transition-colors duration-300 ${darkMode ? 'bg-dark-bg' : 'bg-gradient-to-br from-indigo-50 via-white to-purple-50 animate-mesh'}`}>

            {/* ═══════════════ MOBILE SIDEBAR BACKDROP ═══════════════ */}
            {mobileSidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
                    onClick={() => setMobileSidebarOpen(false)}
                />
            )}

            {/* ═══════════════ PANE 1: SIDEBAR ═══════════════ */}
            <div className={`flex flex-col z-40 transition-all duration-300 ${
                sidebarCollapsed ? 'md:w-16 md:border-r' : 'md:w-64 md:border-r'
            } ${
                darkMode
                    ? 'bg-dark-surface/80 backdrop-blur-xl border-dark-border'
                    : 'bg-gradient-to-b from-[#251845]/90 via-[#190f30]/95 to-[#0e071c] shadow-2xl border-r border-white/15 backdrop-blur-2xl'
            } fixed md:relative inset-y-0 left-0 w-72 md:flex ${
                mobileSidebarOpen ? 'flex translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
            } md:!transform-none`}>
                {/* Logo */}
                <div className={`p-4 pb-3 flex items-center justify-between ${sidebarCollapsed ? 'flex-col gap-2' : 'flex-row'}`}>
                    {!sidebarCollapsed ? (
                        <div>
                            <h1 className="text-2xl font-black tracking-tight flex items-center gap-1">
                                <span className="gradient-text">K</span>
                                <span className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">apruka</span>
                            </h1>
                            <p className={`text-[10px] mt-1 font-bold tracking-[0.2em] uppercase ${darkMode ? 'text-dark-muted' : 'text-cyan-300/80 drop-shadow-[0_0_6px_rgba(0,255,255,0.3)]'}`}>
                                Ayla · AI Concierge
                            </p>
                        </div>
                    ) : (
                        <h1 className="text-2xl font-black tracking-tight">
                            <span className="gradient-text">K</span>
                        </h1>
                    )}
                    <div className="flex items-center gap-1">
                        {/* Mobile close button */}
                        <button
                            onClick={() => { setMobileSidebarOpen(false); }}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer md:hidden ${
                                darkMode ? 'text-dark-muted hover:bg-white/5 hover:text-dark-text' : 'text-pink-300 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                        {/* Desktop collapse button */}
                        <button 
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)} 
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer hidden md:block ${
                                darkMode ? 'text-dark-muted hover:bg-white/5 hover:text-dark-text' : 'text-pink-300 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            <SidebarIcon />
                        </button>
                    </div>
                </div>

                <div className="px-3 mt-4 flex justify-center">
                    <button
                        onClick={startNewChat}
                        className={`flex items-center justify-center gap-2 rounded-xl text-xs font-extrabold transition-all duration-300 border cursor-pointer active:scale-95 ${
                            sidebarCollapsed ? 'p-2.5' : 'w-full px-4 py-2.5'
                        } ${
                            darkMode
                                ? 'bg-brand-purple/15 border-brand-purple/30 text-brand-purple-accent hover:bg-brand-purple/25'
                                : 'bg-gradient-to-r from-pink-500/80 via-fuchsia-500/80 to-purple-600/80 border-white/30 text-white shadow-[0_4px_15px_rgba(236,72,153,0.3)] hover:shadow-[0_4px_20px_rgba(236,72,153,0.45)] hover:from-pink-500 hover:to-purple-600'
                        }`}
                        title={sidebarCollapsed ? "New Chat" : undefined}
                    >
                        <span className="flex items-center justify-center text-sm"><EditIcon /></span>
                        {!sidebarCollapsed && "New Chat"}
                    </button>
                </div>

                <nav className="px-3 mt-4 space-y-1">
                    <button onClick={() => { setShowHelp(false); setShowHistory(false); setActiveProduct(null); setActivePayment(null); setMobileSidebarOpen(false); }}
                        className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer ${
                            sidebarCollapsed ? 'justify-center w-10 h-10 px-0 mx-auto' : 'w-full px-4 text-left'
                        } ${
                            !showHelp && !showHistory && !activeProduct && !activePayment
                                ? darkMode ? 'bg-brand-purple/20 border border-brand-purple-accent/35 text-brand-purple-accent shadow-[0_0_12px_rgba(168,85,247,0.15)]' : 'bg-white/15 border border-white/25 text-white shadow-[0_0_12px_rgba(255,255,255,0.05)]'
                                : darkMode ? 'text-dark-muted hover:bg-white/5 hover:text-dark-text border border-transparent' : 'text-white/70 hover:bg-white/10 hover:text-white border border-transparent hover:border-white/10'
                        }`}
                        title={sidebarCollapsed ? "Active Chat" : undefined}
                    >
                        <span className="flex items-center justify-center"><ChatIcon /></span>
                        {!sidebarCollapsed && "Active Chat"}
                    </button>
                    <button onClick={() => { setShowHelp(true); setShowHistory(false); setActiveProduct(null); setActivePayment(null); setMobileSidebarOpen(false); }}
                        className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 cursor-pointer ${
                            sidebarCollapsed ? 'justify-center w-10 h-10 px-0 mx-auto' : 'w-full px-4 text-left'
                        } ${
                            showHelp
                                ? darkMode ? 'bg-brand-purple/20 border border-brand-purple-accent/35 text-brand-purple-accent shadow-[0_0_12px_rgba(168,85,247,0.15)]' : 'bg-white/15 border border-white/25 text-white shadow-[0_0_12px_rgba(255,255,255,0.05)]'
                                : darkMode ? 'text-dark-muted hover:bg-white/5 hover:text-dark-text border border-transparent' : 'text-white/70 hover:bg-white/10 hover:text-white border border-transparent hover:border-white/10'
                        }`}
                        title={sidebarCollapsed ? "How to Use" : undefined}
                    >
                        <span className="flex items-center justify-center"><HelpIcon /></span>
                        {!sidebarCollapsed && "How to Use"}
                    </button>
                    <button onClick={() => { setShowHelp(false); setShowHistory(true); setActiveProduct(null); setActivePayment(null); setMobileSidebarOpen(false); }}
                        className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 cursor-pointer ${
                            sidebarCollapsed ? 'justify-center w-10 h-10 px-0 mx-auto' : 'w-full px-4 text-left'
                        } ${
                            showHistory
                                ? darkMode ? 'bg-brand-purple/20 border border-brand-purple-accent/35 text-brand-purple-accent shadow-[0_0_12px_rgba(168,85,247,0.15)]' : 'bg-white/15 border border-white/25 text-white shadow-[0_0_12px_rgba(255,255,255,0.05)]'
                                : darkMode ? 'text-dark-muted hover:bg-white/5 hover:text-dark-text border border-transparent' : 'text-white/70 hover:bg-white/10 hover:text-white border border-transparent hover:border-white/10'
                        }`}
                        title={sidebarCollapsed ? "Order History" : undefined}
                    >
                        <span className="flex items-center justify-center"><HistoryIcon /></span>
                        {!sidebarCollapsed && "Order History"}
                    </button>
                    <button onClick={() => { setShowHelp(false); setShowHistory(false); setActiveProduct(null); setActivePayment(null); setMobileSidebarOpen(false); sendMessage("Show me all categories"); }}
                        className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 cursor-pointer ${
                            sidebarCollapsed ? 'justify-center w-10 h-10 px-0 mx-auto' : 'w-full px-4 text-left'
                        } ${
                            darkMode ? 'text-dark-muted hover:bg-white/5 hover:text-dark-text border border-transparent' : 'text-white/70 hover:bg-white/10 hover:text-white border border-transparent hover:border-white/10'
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
                        <p className={`text-[9px] font-extrabold tracking-[0.25em] uppercase px-1 mb-2 ${darkMode ? 'text-dark-muted' : 'text-cyan-300 drop-shadow-[0_0_6px_rgba(0,255,255,0.3)]'}`}>
                            Chat History
                        </p>
                    )}
                    <div className="space-y-0.5">
                        {chatSessions.filter(s => s.messages.some(m => m.role === 'user')).map(session => (
                            <div
                                key={session.id}
                                onClick={() => switchSession(session.id)}
                                className={`flex items-center rounded-xl transition-all duration-300 group cursor-pointer ${
                                    sidebarCollapsed ? 'justify-center w-10 h-10 px-0 mx-auto' : 'w-full gap-2.5 px-3 py-2.5 text-left border border-transparent'
                                } ${
                                    session.id === activeSessionId
                                        ? darkMode ? 'bg-brand-purple/20 border border-brand-purple-accent/30 text-white shadow-[0_0_10px_rgba(168,85,247,0.1)]' : 'bg-white/15 border border-white/20 text-white shadow-[0_0_10px_rgba(255,255,255,0.05)]'
                                        : darkMode ? 'hover:bg-white/5 hover:border-white/5' : 'hover:bg-white/8 hover:border-white/10'
                                }`}
                                title={sidebarCollapsed ? session.title : undefined}
                            >
                                <span className={`flex items-center justify-center flex-shrink-0 ${
                                    session.id === activeSessionId
                                        ? darkMode ? 'text-brand-purple-accent' : 'text-pink-300 drop-shadow-[0_0_6px_rgba(244,114,182,0.4)]'
                                        : darkMode ? 'text-dark-muted' : 'text-white/50'
                                }`}><ChatIcon /></span>
                                {!sidebarCollapsed && (
                                    <>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-semibold truncate ${
                                                session.id === activeSessionId
                                                    ? darkMode ? 'text-dark-text' : 'text-cyan-200'
                                                    : darkMode ? 'text-dark-muted group-hover:text-dark-text' : 'text-white/70 group-hover:text-white'
                                            }`}>{session.title}</p>
                                            <p className={`text-[9px] truncate mt-0.5 ${
                                                darkMode ? 'text-dark-muted/60' : 'text-white/40'
                                            }`}>{session.messages.length - 1} message{session.messages.length !== 2 ? 's' : ''}</p>
                                        </div>
                                        <button
                                            onClick={(e) => deleteSession(e, session.id)}
                                            className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${
                                                darkMode ? 'text-red-400 hover:bg-red-500/20' : 'text-red-400 hover:bg-red-500/20'
                                            }`}
                                        >
                                            <TrashIcon />
                                        </button>
                                        {session.id === activeSessionId && (
                                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ml-1 ${
                                                darkMode ? 'bg-brand-purple' : 'bg-cyan-300 shadow-[0_0_6px_rgba(0,255,255,0.8)]'
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
                    <p className={`text-[9px] font-extrabold tracking-[0.25em] uppercase px-4 mb-2 ${darkMode ? 'text-dark-muted' : 'text-pink-300 drop-shadow-[0_0_6px_rgba(244,114,182,0.3)]'}`}>
                        Preferences Settings
                    </p>
                )}

                {/* Controls */}
                <div className={`px-4 space-y-3 mb-4 ${sidebarCollapsed ? 'flex flex-col items-center px-0' : ''}`}>
                    {/* Dark Mode Toggle */}
                    <button
                        onClick={() => startTransition(() => setDarkMode(!darkMode))}
                        className={`flex items-center rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer border ${
                            sidebarCollapsed 
                                ? 'w-10 h-10 justify-center p-0 hover:bg-brand-purple/20 text-white border-transparent'
                                : 'w-full justify-between px-4 py-3 bg-white/10 border-white/20 text-white hover:bg-white/15'
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
                            <div className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${darkMode ? 'bg-brand-purple/50 border border-brand-purple-accent/30' : 'bg-white/20 border border-white/30'}`}>
                                <motion.div
                                    animate={{ x: darkMode ? 20 : 0 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-md"
                                />
                            </div>
                        )}
                    </button>

                    {/* Mock/Live Toggle — only visible in dev mode (?dev=true) */}
                    {showDevTools && (
                    <div className={`${
                        sidebarCollapsed 
                            ? 'w-10 h-10 flex items-center justify-center rounded-xl cursor-pointer hover:bg-white/10 border border-transparent'
                            : 'p-4 rounded-xl transition-colors duration-300 bg-white/10 border border-white/20'
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
                                    <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-dark-muted' : 'text-cyan-300/85'}`}>
                                        {useMock ? 'Using sample data' : 'Calling Gemini + MCP'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setUseMock(!useMock)}
                                    className={`relative w-12 h-6 rounded-full transition-colors duration-300 cursor-pointer ${
                                        useMock ? 'bg-brand-purple/50 border border-brand-purple-accent/30' : 'bg-emerald-500/50 border border-emerald-400/30'
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
                    )}
                </div>

                {/* Footer */}
                {!sidebarCollapsed && (
                    <div className="px-4 pb-4">
                        <div className={`p-3 rounded-xl text-[10px] border ${
                            darkMode ? 'bg-white/5 text-dark-muted border border-dark-border' : 'bg-white/5 text-white/60 border-white/10'
                        }`}>
                            <p className="font-bold mb-0.5 text-lg gradient-text">Hackathon 2026</p>
                            <p className="font-medium text-white/75">Powered by Gemini · MCP · Kapruka</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══════════════ PANE 2: CHAT FEED ═══════════════ */}
            <div className={`flex-1 flex flex-col relative h-full noise-bg ${darkMode ? 'bg-[#121212]' : 'bg-[#402970]'}`}>
                {/* WhatsApp style shopping doodle background */}
                <div 
                    className={`absolute inset-0 pointer-events-none z-0 transition-opacity duration-500 ${darkMode ? 'bg-white opacity-[0.03]' : 'bg-[#002F6C] opacity-[0.04]'}`}
                    style={{
                        maskImage: techPattern,
                        WebkitMaskImage: techPattern,
                        maskRepeat: 'repeat',
                        WebkitMaskRepeat: 'repeat',
                        maskSize: '180px',
                        WebkitMaskSize: '180px',
                    }}
                />

                {/* ── Global Alert Bar ── */}
                <div className="w-full bg-red-600 dark:bg-red-900/40 text-white text-center py-1.5 px-4 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 z-20 relative">
                    <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-100"></span></span>
                    Order within <span className="font-mono bg-black/20 px-1 rounded">02:15:34</span> for same-day delivery
                </div>

                {/* ── Desktop Header Bar ── */}
                <div className={`hidden md:flex items-center justify-between px-6 py-3 border-b z-10 transition-colors duration-300 ${
                    darkMode
                        ? 'bg-dark-surface/60 backdrop-blur border-dark-border'
                        : 'bg-white/10 backdrop-blur-xl border-white/20 shadow-[0_4px_30px_rgba(255,255,255,0.05)]'
                }`}>
                    {/* Left: active chat info */}
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${
                            darkMode ? 'bg-brand-purple/20 text-brand-purple-accent' : 'bg-brand-purple/10 text-brand-purple'
                        }`}><ChatIcon /></div>
                        <div>
                            <p className={`text-sm font-bold leading-tight ${
                                darkMode ? 'text-dark-text' : 'text-white drop-shadow-sm'
                            }`}>{activeSession?.title || 'Active Chat'}</p>
                            <p className={`text-[10px] ${
                                darkMode ? 'text-dark-muted' : 'text-cyan-100/80 font-medium'
                            }`}>{messages.length - 1} message{messages.length !== 2 ? 's' : ''} · {useMock ? '🧪 Mock' : '🔴 Live'}</p>
                        </div>
                    </div>
                    {/* Right: actions */}
                    <div className="flex items-center gap-2">
                        {/* Language Selector */}
                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold mr-1.5 border shadow-inner ${
                            darkMode ? 'border-dark-border bg-white/5' : 'border-white/20 bg-white/10'
                        }`}>
                            <span className="text-sm mr-0.5">🌐</span>
                            {(['en', 'si', 'ta'] as const).map((lang) => {
                                const labels = { en: 'English', si: 'සිංහල', ta: 'தமிழ்' };
                                const isActive = currentLang === lang;
                                return (
                                    <button
                                        key={lang}
                                        onClick={() => setCurrentLang(lang)}
                                        className={`px-1.5 py-0.5 rounded transition-all duration-200 cursor-pointer ${
                                            isActive
                                                ? darkMode 
                                                    ? 'bg-brand-purple/20 text-brand-purple-accent font-bold' 
                                                    : 'bg-white/20 text-cyan-300 font-bold shadow-[0_0_10px_rgba(0,255,255,0.2)]'
                                                : darkMode
                                                    ? 'text-dark-muted hover:text-dark-text'
                                                    : 'text-white/60 hover:text-white'
                                        }`}
                                    >
                                        {labels[lang]}
                                    </button>
                                );
                            })}
                        </div>

                        <button 
                            onClick={handleToggleCart}
                            className={`relative flex items-center justify-center p-2 rounded-lg transition-all duration-200 cursor-pointer ${
                            darkMode
                                ? 'bg-white/5 text-dark-muted hover:bg-white/10 hover:text-dark-text border border-dark-border'
                                : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                        }`}>
                            <span className="flex items-center justify-center"><CartIcon /></span>
                            {cart.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-brand-purple text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-sm">
                                    {cart.reduce((total, item) => total + item.qty, 0)}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => startTransition(() => setDarkMode(!darkMode))}
                            className={`p-2 rounded-lg transition-all duration-200 ${
                                darkMode
                                    ? 'bg-dark-card text-white hover:bg-brand-purple/20 hover:text-brand-purple border border-dark-border hover:border-brand-purple/50'
                                    : 'bg-white/10 text-white hover:bg-white/20 border border-white/20 shadow-sm'
                            }`}
                        >
                            {darkMode ? <SunIcon /> : <MoonIcon />}
                        </button>
                    </div>
                </div>

                {/* Mobile Header */}
                <div className={`md:hidden p-4 shadow-md z-20 relative flex flex-col gap-2 transition-colors duration-300 ${
                    darkMode ? 'bg-dark-surface border-b border-dark-border' : 'bg-[#002F6C]'
                }`}>
                    <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-1.5 z-30">
                            <button
                                onClick={() => setMobileSidebarOpen(true)}
                                className={`relative z-30 p-2 cursor-pointer flex items-center justify-center rounded-lg transition-colors ${darkMode ? 'text-white hover:bg-white/10' : 'text-white/80 hover:bg-white/20'}`}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                            </button>
                            <h1 className="text-base font-bold text-white whitespace-nowrap">Ayla</h1>
                        </div>
                        <div className="flex items-center gap-1 z-30">
                            <button onClick={() => { startNewChat(); }} className={`relative z-30 p-2 cursor-pointer flex items-center justify-center rounded-lg transition-colors ${darkMode ? 'text-brand-purple-accent hover:bg-brand-purple/20' : 'text-white/80 hover:bg-white/20'}`}>
                                <span className="pointer-events-none flex"><EditIcon /></span>
                            </button>
                            <button 
                                onClick={handleToggleCart}
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
                    {/* Mobile Language Selector */}
                    <div className="flex items-center gap-1.5 justify-center py-1 border-t border-white/10 dark:border-dark-border/40 text-[11px]">
                        <span className="text-white/60 dark:text-dark-muted font-medium">🌐 Language:</span>
                        {(['en', 'si', 'ta'] as const).map((lang) => {
                            const labels = { en: 'English', si: 'සිංහල', ta: 'தமிழ்' };
                            const isActive = currentLang === lang;
                            return (
                                <button
                                    key={lang}
                                    onClick={() => setCurrentLang(lang)}
                                    className={`px-2 py-0.5 rounded transition-all duration-200 cursor-pointer ${
                                        isActive
                                            ? 'bg-white/20 text-white font-bold'
                                            : 'text-white/60 hover:text-white dark:text-dark-muted dark:hover:text-dark-text'
                                    }`}
                                >
                                    {labels[lang]}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Messages / Help View */}
                {showHelp ? (
                    <div className="flex-1 flex flex-col overflow-y-auto p-6 md:p-10 space-y-6 relative z-10">
                        {/* FAQ Header */}
                        <div className="flex justify-between items-center pb-4 border-b border-white/10 dark:border-dark-border">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight text-white">
                                    How to Chat with <span className="gradient-text">Ayla</span>
                                </h2>
                                <p className={`text-[10px] font-black tracking-[0.25em] uppercase mt-1 ${darkMode ? 'text-dark-muted' : 'text-cyan-300 drop-shadow-[0_0_6px_rgba(0,255,255,0.3)]'}`}>
                                    Frequently Asked Questions &amp; Guide
                                </p>
                            </div>
                            <button
                                onClick={() => setShowHelp(false)}
                                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-300 border cursor-pointer active:scale-95 ${
                                    darkMode
                                        ? 'bg-white/10 border-white/15 text-white hover:bg-white/20'
                                        : 'bg-gradient-to-r from-pink-500/80 to-purple-600/80 border-white/20 text-white hover:from-pink-500 hover:to-purple-600 shadow-md'
                                }`}
                            >
                                ← Back to Chat
                            </button>
                        </div>

                        {/* Welcome Card */}
                        <div className={`rounded-2xl p-6 border backdrop-blur-md ${
                            darkMode ? 'bg-brand-purple/10 border-brand-purple-accent/20' : 'bg-white/10 border-white/20 shadow-md'
                        }`}>
                            <div className="flex items-center gap-4 mb-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl shadow-lg shadow-pink-500/20">
                                    🎁
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-base text-white">Meet Ayla</h3>
                                    <p className={`text-xs mt-0.5 ${darkMode ? 'text-dark-muted' : 'text-cyan-300 font-bold'}`}>Your AI-powered gift shopping assistant for Sri Lanka</p>
                                </div>
                            </div>
                            <p className={`text-sm leading-relaxed ${darkMode ? 'text-dark-muted' : 'text-white/90'}`}>
                                Simply type what you're looking for in natural language. You can search products, check delivery availability, place orders, and track shipments — all through a conversational interface.
                            </p>
                        </div>

                        {/* Example Prompts */}
                        <div>
                            <p className={`text-xs font-extrabold uppercase tracking-widest mb-3 text-pink-300 drop-shadow-[0_0_6px_rgba(244,114,182,0.4)]`}>Try these examples</p>
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
                                        className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 border cursor-pointer active:scale-95 ${
                                            darkMode
                                                ? 'bg-white/5 border border-dark-border text-dark-text hover:bg-brand-purple/20 hover:border-brand-purple/40 hover:text-brand-purple'
                                                : 'bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-cyan-300/40 hover:text-cyan-200 shadow-sm backdrop-blur-sm'
                                        }`}
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* FAQ Accordion */}
                        <div className="max-w-6xl w-full mx-auto space-y-4 pb-10">
                            <div className="text-center mb-8">
                                <h3 className="text-2xl font-extrabold mb-2 text-white">Frequently Asked Questions</h3>
                                <p className={`text-sm ${darkMode ? 'text-dark-muted' : 'text-cyan-300/80 font-medium'}`}>Everything you need to know about shopping with Ayla.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {faqs.map((faq, idx) => {
                                    const isExpanded = expandedFaq === idx;
                                    return (
                                        <div
                                            key={idx}
                                            className={`rounded-2xl border overflow-hidden transition-all duration-300 backdrop-blur-md ${
                                                isExpanded
                                                    ? darkMode ? 'bg-brand-purple/10 border-brand-purple-accent/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'bg-white/20 border-pink-300/40 shadow-lg shadow-pink-500/10'
                                                    : darkMode ? 'bg-dark-card border-dark-border hover:border-brand-purple-accent/30' : 'bg-white/10 border-white/20 hover:border-cyan-300/40 hover:shadow-md'
                                            }`}
                                        >
                                            <button
                                                onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                                                className="w-full flex justify-between items-start px-6 py-5 text-left cursor-pointer group"
                                            >
                                                <span className={`text-[15px] font-semibold pr-4 leading-snug group-hover:text-pink-300 transition-colors ${darkMode ? 'text-dark-text' : 'text-white'}`}>{faq.q}</span>
                                                <span className={`text-2xl font-light transition-transform duration-300 flex-shrink-0 mt-[-4px] ${isExpanded ? 'rotate-45 text-pink-300' : 'text-white/60 group-hover:text-pink-300'} ${darkMode && !isExpanded ? 'text-dark-muted' : ''}`}>
                                                    +
                                                </span>
                                            </button>
                                            <div 
                                                className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-40 opacity-100 mb-4' : 'max-h-0 opacity-0'} overflow-hidden`}
                                            >
                                                <div className={`px-6 text-[14px] leading-relaxed border-t mt-1 pt-4 ${
                                                    darkMode ? 'text-dark-muted border-dark-border' : 'text-white/80 border-white/10'
                                                }`}>
                                                    {faq.a}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                <>
                    {messages.length === 1 && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="hidden sm:block fixed right-[-10%] md:right-[-15%] lg:right-[-12%] 2xl:right-[-10%] top-[10%] md:top-[15%] w-72 h-72 md:w-[500px] md:h-[500px] lg:w-[700px] lg:h-[950px] 2xl:w-[850px] 2xl:h-[950px] pointer-events-none z-10 blur-[0.5px] drop-shadow-2xl"
                        >
                            <img src="/ayla_3d_avatar.png" alt="Ayla AI" className="w-full h-full object-contain relative z-10" style={{ opacity: 0.15 }} />
                        </motion.div>
                    )}
                    <div id="main-chat-container" className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-10 space-y-6 relative z-10 w-full max-w-7xl mx-auto">
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
                                className="flex flex-col items-center max-w-7xl mx-auto py-6 text-center gap-10"
                            >
                                 {/* Hero Section */}
                                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className="relative flex flex-col items-center gap-6 w-full max-w-7xl px-4 py-8">
                                    
                                    {/* Center: Text & Actions */}
                                    <AnimatePresence mode="wait">
                                    <motion.div 
                                        key={currentLang}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -5 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex flex-col items-center text-center gap-2 z-10"
                                    >
                                        <p className="text-cyan-300 text-base md:text-lg font-extrabold tracking-wide bg-white/10 px-6 py-2 rounded-full border border-white/20 backdrop-blur-md mb-3 shadow-[0_0_15px_rgba(0,255,255,0.3)]">
                                            ආයුබෝවන් • வணக்கம் • Welcome
                                        </p>
                                        <h2 className="text-4xl sm:text-5xl md:text-7xl font-serif font-black tracking-tighter leading-[1] max-w-6xl bg-clip-text text-transparent pb-2 drop-shadow-md bg-gradient-to-br from-white via-cyan-50 to-pink-100">
                                            {translations[currentLang].heroTitle.split('Ayla').map((part, i, arr) => (
                                                <Fragment key={i}>
                                                    {part}
                                                    {i < arr.length - 1 && (
                                                        <span className="font-script font-normal tracking-normal pb-2 inline-block -mb-4 px-2 text-pink-400 drop-shadow-[0_0_15px_rgba(244,114,182,0.8)]">
                                                            Ayla
                                                        </span>
                                                    )}
                                                </Fragment>
                                            ))}
                                        </h2>
                                        <p className="text-sm md:text-base lg:text-lg max-w-2xl leading-relaxed text-white/90">
                                            {translations[currentLang].heroDesc}
                                        </p>

                                        {/* Playful Capability Text */}
                                        <p className="italic font-bold text-sm md:text-base text-pink-300 drop-shadow-[0_0_10px_rgba(255,105,180,0.6)]">
                                            {translations[currentLang].tryMeText}
                                        </p>

                                        {/* Language Support Indicator Trust Badge */}
                                        <div className="mt-2 flex flex-col items-center gap-1.5 px-6 py-3 rounded-2xl border backdrop-blur-md bg-white/10 border-white/20 shadow-[0_0_20px_rgba(0,255,255,0.15)]">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">🇱🇰</span>
                                                <span className="text-xs font-bold tracking-wider text-cyan-300">
                                                    {translations[currentLang].trustIndicator}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-white/80 font-medium">
                                                {translations[currentLang].trustIndicatorSub}
                                            </span>
                                        </div>
                                        
                                        {/* Trust Indicators */}
                                        <div className="flex flex-col sm:flex-row flex-wrap justify-center items-center gap-3 sm:gap-6 mt-4 text-[11px] font-bold tracking-wider text-white/90">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] opacity-90 drop-shadow-[0_0_8px_rgba(255,215,0,0.8)]">⭐</span> <span className="drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">RATED BY CUSTOMERS</span>
                                            </div>
                                            <div className="w-1 h-1 rounded-full hidden sm:block bg-white/40 shadow-[0_0_5px_rgba(255,255,255,0.5)]"></div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] opacity-90 drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]">🚚</span> <span className="drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">SAME-DAY DELIVERY</span>
                                            </div>
                                            <div className="w-1 h-1 rounded-full hidden sm:block bg-white/40 shadow-[0_0_5px_rgba(255,255,255,0.5)]"></div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] opacity-90 drop-shadow-[0_0_8px_rgba(255,105,180,0.8)]">🎁</span> <span className="drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">5,000+ DELIVERED</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                    </AnimatePresence>

                                </motion.div>

                                    {/* Mobile-only Quick Prompts */}
                                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className="md:hidden w-full max-w-lg text-left px-4">
                                        <p className="text-xs font-bold uppercase tracking-widest mb-3 text-cyan-300 drop-shadow-[0_0_8px_rgba(0,255,255,0.5)]">
                                            {translations[currentLang].tryPrompts}
                                        </p>
                                        <div className="grid grid-cols-2 gap-2.5">
                                            {[
                                                { t: "Find gifts under Rs. 5,000", i: "🏷️" },
                                                { t: "Birthday cakes", i: "🎂" },
                                                { t: "Anniversary hampers", i: "🥂" },
                                                { t: "Premium Luxury Gifts", i: "💎" },
                                            ].map((p, i) => (
                                                <button 
                                                    key={i}
                                                    onClick={() => sendMessage(p.t)}
                                                    className={`text-left p-3.5 rounded-2xl border transition-all duration-200 flex items-start gap-2 cursor-pointer active:scale-95 ${
                                                        darkMode ? 'bg-dark-card/50 border-dark-border hover:border-brand-purple-accent/50' : 'bg-white/10 border-white/20 hover:bg-white/15 text-white'
                                                    }`}
                                                >
                                                    <span className="text-lg">{p.i}</span>
                                                    <span className={`text-xs font-semibold leading-snug ${darkMode ? 'text-dark-text' : 'text-white'}`}>{p.t}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>

                                    {/* Scroll Down Indicator */}
                                    <motion.div 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.8, duration: 0.5 }}
                                        className="hidden md:flex mt-8 mb-4 flex-col items-center justify-center cursor-pointer group"
                                        onClick={() => {
                                            const chatContainer = document.querySelector('.overflow-y-auto.z-10');
                                            if (chatContainer) chatContainer.scrollBy({ top: 450, behavior: 'smooth' });
                                        }}
                                    >
                                        <span className={`text-[10px] font-bold tracking-widest uppercase mb-3 transition-colors ${darkMode ? 'text-dark-muted group-hover:text-brand-purple-accent' : 'text-white/60 group-hover:text-cyan-300'}`}>
                                            Scroll to explore
                                        </span>
                                        <motion.div
                                            animate={{ y: [0, 8, 0] }}
                                            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-sm transition-all duration-300 ${darkMode ? 'bg-dark-card border border-brand-purple-accent/30 text-brand-purple-accent group-hover:bg-brand-purple/20' : 'bg-white/10 border border-white/20 text-pink-300 group-hover:bg-white/20 group-hover:border-pink-300/50 group-hover:shadow-[0_0_15px_rgba(244,114,182,0.4)]'}`}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                        </motion.div>
                                    </motion.div>
                                {/* Customer-Focused Benefits */}
                                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className="hidden md:grid grid-cols-1 tablet:grid-cols-3 gap-4 w-full max-w-6xl text-left">
                                    {/* Benefit 1 */}
                                    <div className={`p-6 rounded-3xl border transition-all duration-300 bg-white/10 border-white/20 shadow-md backdrop-blur-md hover:bg-white/15 hover:border-cyan-300/40 hover:shadow-[0_0_20px_rgba(0,255,255,0.15)] hover:-translate-y-1`}>
                                        <span className="text-3xl mb-4 block">🎁</span>
                                        <h4 className="font-extrabold text-sm mb-2 text-cyan-200 drop-shadow-[0_0_6px_rgba(0,255,255,0.3)]">Find the Perfect Gift</h4>
                                        <p className="text-xs leading-relaxed text-white/90">AI recommendations based on occasion and budget.</p>
                                    </div>
                                    {/* Benefit 2 */}
                                    <div className={`p-6 rounded-3xl border transition-all duration-300 bg-white/10 border-white/20 shadow-md backdrop-blur-md hover:bg-white/15 hover:border-cyan-300/40 hover:shadow-[0_0_20px_rgba(0,255,255,0.15)] hover:-translate-y-1`}>
                                        <span className="text-3xl mb-4 block">🚚</span>
                                        <h4 className="font-extrabold text-sm mb-2 text-cyan-200 drop-shadow-[0_0_6px_rgba(0,255,255,0.3)]">Island-Wide Delivery</h4>
                                        <p className="text-xs leading-relaxed text-white/90">Real-time delivery estimates and tracking.</p>
                                    </div>
                                    {/* Benefit 3 */}
                                    <div className={`p-6 rounded-3xl border transition-all duration-300 bg-white/10 border-white/20 shadow-md backdrop-blur-md hover:bg-white/15 hover:border-cyan-300/40 hover:shadow-[0_0_20px_rgba(0,255,255,0.15)] hover:-translate-y-1`}>
                                        <span className="text-3xl mb-4 block">⚡</span>
                                        <h4 className="font-extrabold text-sm mb-2 text-cyan-200 drop-shadow-[0_0_6px_rgba(0,255,255,0.3)]">Fast Checkout</h4>
                                        <p className="text-xs leading-relaxed text-white/90">Complete purchases without leaving the conversation.</p>
                                    </div>
                                </motion.div>

                                {/* Suggested Prompts Grid */}
                                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className="hidden md:block w-full max-w-6xl text-left mt-4">
                                    <div className="hidden md:block w-full text-center px-4">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 text-cyan-300 drop-shadow-[0_0_8px_rgba(0,255,255,0.5)]">
                                            {translations[currentLang].tryPrompts}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 tablet:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {[
                                            { t: "Find gifts under Rs. 5,000", i: "🏷️", sub: "Budget Friendly" },
                                            { t: "Gifts from Rs. 5k - 10k", i: "🎁", sub: "Mid-Range" },
                                            { t: "Premium Luxury Gifts", i: "💎", sub: "High-End" },
                                            { t: "Anniversary hampers", i: "🥂", sub: "Popular" },
                                            { t: "මට උපන්දින කේක් පෙන්නන්න", i: "🎂", sub: "Sinhala (සිංහල)" },
                                            { t: "எனக்கு சாக்லேட் வேண்டும்", i: "🍫", sub: "Tamil (தமிழ்)" },
                                            { t: "Kandy walata mal yawanna", i: "💐", sub: "Singlish" },
                                            { t: "Colombo delivery venuma", i: "🚚", sub: "Tanglish" }
                                        ].map((p, i) => (
                                            <button 
                                                key={i}
                                                onClick={() => sendMessage(p.t)}
                                                className={`text-left p-4 rounded-2xl border transition-all duration-300 flex flex-col items-start gap-2 group cursor-pointer hover:-translate-y-1 bg-white/10 border-white/20 hover:bg-white/15 hover:border-pink-300/40 shadow-sm backdrop-blur-md hover:shadow-[0_0_20px_rgba(244,114,182,0.25)]`}
                                            >
                                                <div className="flex items-center gap-2 w-full mb-1">
                                                    <span className="text-xl">{p.i}</span>
                                                    <span className="text-[9px] uppercase font-black tracking-widest text-cyan-300/90 drop-shadow-[0_0_5px_rgba(0,255,255,0.3)]">{p.sub}</span>
                                                </div>
                                                <span className="text-xs font-semibold leading-relaxed text-white group-hover:text-pink-300 transition-colors">{p.t}</span>
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>

                                {/* Local Trust Section */}
                                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className="hidden md:block w-full max-w-6xl text-left mt-4">
                                    <div className={`p-6 md:p-8 rounded-3xl border backdrop-blur-md shadow-lg ${
                                        darkMode ? 'bg-dark-card/40 border-dark-border/80' : 'bg-white/10 border-white/20'
                                    }`}>
                                        <h3 className="text-sm font-bold uppercase tracking-widest mb-6 text-cyan-300 drop-shadow-[0_0_8px_rgba(0,255,255,0.4)]">
                                            {translations[currentLang].servingCities}
                                        </h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 laptop:grid-cols-6 gap-3 mb-6">
                                            {['Colombo', 'Kandy', 'Galle', 'Jaffna', 'Negombo', 'Batticaloa'].map((city) => (
                                                <div 
                                                    key={city}
                                                    className="py-3 px-4 rounded-xl border border-white/20 text-center font-bold text-xs transition-all duration-300 bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.05)] hover:bg-white/20 hover:border-cyan-300/40 hover:text-cyan-200 hover:scale-105"
                                                >
                                                    📍 {city}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex justify-center">
                                            <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                                darkMode ? 'bg-brand-purple/10 border border-brand-purple-accent/30 text-brand-purple-accent' : 'bg-brand-purple/5 border border-brand-purple/25 text-brand-purple'
                                            }`}>
                                                <span>⚡</span>
                                                <span>{translations[currentLang].sameDayBanner}</span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Shop By Occasion */}
                                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className="hidden md:block w-full max-w-6xl text-left mt-8">
                                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-6 ${darkMode ? 'text-dark-muted' : 'text-pink-300 drop-shadow-[0_0_8px_rgba(244,114,182,0.4)]'}`}>Shop By Occasion</h3>
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
                                                className={`flex flex-col items-center justify-center p-6 rounded-3xl border transition-all duration-300 cursor-pointer hover:-translate-y-1 bg-white/10 border-white/20 hover:bg-white/15 hover:border-cyan-300/40 shadow-sm backdrop-blur-md hover:shadow-[0_0_20px_rgba(0,255,255,0.25)]`}
                                            >
                                                <span className="text-4xl mb-3">{occ.emoji}</span>
                                                <span className="font-extrabold text-sm text-white group-hover:text-cyan-200 transition-colors drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">{occ.title}</span>
                                                <span className="text-[10px] mt-1 text-white/80">{occ.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>

                                {/* Popular Products Carousel */}
                                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className="hidden md:block w-full max-w-7xl text-left mt-8 overflow-hidden">
                                    <div className="flex justify-between items-end mb-6 px-4 md:px-0">
                                        <h3 className={`text-xs font-bold uppercase tracking-widest ${darkMode ? 'text-dark-muted' : 'text-pink-300 drop-shadow-[0_0_8px_rgba(244,114,182,0.4)]'}`}>Popular Gifts This Week</h3>
                                    </div>
                                    <div className="flex overflow-x-auto gap-4 pb-6 snap-x snap-mandatory hide-scrollbar px-4 md:px-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                        <style>{`
                                            .hide-scrollbar::-webkit-scrollbar { display: none; }
                                        `}</style>
                                        {(prefetchedProducts.length > 0 ? prefetchedProducts : [
                                            { id: 'fb1', name: "Premium Red Roses Bouquet", price: { amount: 8500, currency: 'LKR' }, img: "🌹", in_stock: true },
                                            { id: 'fb2', name: "Ribbon Cake 1Kg", price: { amount: 4200, currency: 'LKR' }, img: "🍰", in_stock: true },
                                            { id: 'fb3', name: "Ferrero Rocher 24 Pcs", price: { amount: 6800, currency: 'LKR' }, img: "🍫", in_stock: true },
                                            { id: 'fb4', name: "Customized Photo Frame", price: { amount: 3500, currency: 'LKR' }, img: "🖼️", in_stock: true },
                                            { id: 'fb5', name: "Fruit & Cheese Hamper", price: { amount: 12000, currency: 'LKR' }, img: "🍇", in_stock: true },
                                            { id: 'fb6', name: "Soft Teddy Bear (Large)", price: { amount: 7500, currency: 'LKR' }, img: "🧸", in_stock: true }
                                        ]).map((prod: any, i: number) => (
                                            <motion.div
                                                key={prod.id || i}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.07 }}
                                                whileHover={{ y: -4, scale: 1.02 }}
                                                className={`min-w-[200px] md:min-w-[240px] snap-start flex flex-col p-4 rounded-3xl border transition-all duration-300 cursor-pointer bg-white/10 border-white/20 hover:border-pink-300/40 shadow-sm backdrop-blur-md hover:shadow-[0_0_20px_rgba(244,114,182,0.25)]`}
                                                onClick={() => sendMessage(`I want to buy ${prod.name}`)}
                                            >
                                                <div className="h-32 rounded-2xl flex items-center justify-center mb-4 overflow-hidden bg-white/5 border border-white/10 backdrop-blur-sm">
                                                    {prod.image_url ? (
                                                        <img src={prod.image_url} alt={prod.name} className="max-h-full max-w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                                                    ) : (
                                                <span className="text-6xl">{prod.img || '🎁'}</span>
                                                    )}
                                                </div>
                                                <h4 className="font-extrabold text-xs mb-1 line-clamp-2 text-white">{prod.name}</h4>
                                                <p className="text-[11px] text-cyan-300 font-extrabold mt-1 drop-shadow-[0_0_5px_rgba(0,255,255,0.3)]">
                                                    {prod.price?.currency || 'LKR'} {(prod.price?.amount || prod.price)?.toLocaleString?.() ?? prod.price}
                                                </p>
                                                <div className="mt-3 inline-block px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[8px] font-bold uppercase rounded-full self-start">
                                                    {prod.in_stock !== false ? 'Available Today' : 'Out of Stock'}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>

                                {/* Social Proof */}
                                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className="w-full max-w-6xl text-left mt-4 mb-8">
                                    <div className={`p-8 rounded-3xl border flex flex-col md:flex-row items-center gap-8 bg-white/10 border-white/20 shadow-md backdrop-blur-md`}>
                                        <div className="flex-1 text-center md:text-left">
                                            <h3 className="text-3xl font-extrabold mb-2 text-cyan-300 drop-shadow-[0_0_10px_rgba(0,255,255,0.5)]">4.8/5 Rating</h3>
                                            <p className="text-xs uppercase tracking-widest font-extrabold text-pink-300 drop-shadow-[0_0_8px_rgba(244,114,182,0.4)]">100+ Verified Reviews</p>
                                        </div>
                                        <div className="flex-[2] text-sm italic border-l-2 border-pink-400 pl-6 py-2 text-white/90">
                                            "Ordered flowers at 10 AM and delivered by lunch. The AI assistant made it incredibly easy. Amazing experience!"
                                            <span className="block mt-2 font-bold not-italic text-xs text-cyan-300">— Sarah M. (Colombo 07)</span>
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
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-3`}
                                    >
                                        {/* Ayla Avatar */}
                                        {msg.role !== 'user' && (
                                            <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border border-white/20 dark:border-dark-border shadow-[0_4px_12px_rgba(0,0,0,0.1)] bg-black/5 z-10 hidden sm:block mb-1">
                                                <img src={aylaAvatar} alt="Ayla" className="w-full h-full object-cover" />
                                            </div>
                                        )}

                                        <div className={`max-w-[85%] sm:max-w-[80%] md:max-w-4xl p-5 transition-all duration-300 relative ${
                                            msg.role === 'user'
                                                ? 'candy-user-bubble rounded-3xl rounded-br-lg'
                                                : 'candy-bubble rounded-3xl rounded-bl-lg'
                                        }`}>

                                    {/* Attached Image */}
                                    {msg.image && (
                                        <div className="mb-3">
                                            <img src={msg.image} alt="Attached" className="max-w-full h-auto rounded-xl max-h-48 object-cover shadow-sm border border-white/20" />
                                        </div>
                                    )}

                                    {/* Conversational text */}
                                    {msg.text && (
                                        <div className="prose prose-sm max-w-none !text-current">
                                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                                        </div>
                                    )}

                                    {/* ── Realistic Timestamp & Read Ticks ── */}
                                    {msg.timestamp && (
                                        <div className="flex justify-end items-center gap-1 mt-1 text-[10px] font-medium opacity-70">
                                            <span>{formatMessageTime(msg.timestamp)}</span>
                                            {msg.role === 'user' && (
                                                <svg className="w-3.5 h-3.5 ml-0.5 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M18 6L7 17l-5-5"></path>
                                                    <path d="M22 10l-5 5"></path>
                                                </svg>
                                            )}
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
                                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 laptop:grid-cols-3 xl:grid-cols-4 gap-4">
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
                                                        <div 
                                                            onClick={() => handleProductClick(product)}
                                                            className={`relative h-44 overflow-hidden flex items-center justify-center cursor-pointer ${
                                                                darkMode ? 'bg-dark-bg' : 'bg-gradient-to-br from-gray-50 to-gray-100'
                                                            }`}
                                                        >
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
                                                            {/* Stock badge */}
                                                            <span className={`absolute top-3 left-3 text-[9px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide shadow-sm ${
                                                                product.in_stock
                                                                    ? 'bg-emerald-500 text-white'
                                                                    : 'bg-red-500 text-white'
                                                            }`}>
                                                                {product.in_stock ? '✓ In Stock' : '× Sold Out'}
                                                            </span>
                                                        </div>

                                                        {/* Content */}
                                                        <div className="p-4 flex flex-col flex-1">
                                                            {/* Name */}
                                                            <h4 
                                                                onClick={() => handleProductClick(product)}
                                                                className={`font-bold text-[13px] leading-snug line-clamp-2 flex-1 mb-2 cursor-pointer transition-colors ${
                                                                    darkMode ? 'text-dark-text hover:text-brand-purple-accent' : 'text-gray-900 hover:text-brand-purple'
                                                                }`}
                                                            >
                                                                {product.name}
                                                            </h4>

                                                            <p className={`text-[10px] font-medium mb-3 ${darkMode ? 'text-dark-muted' : 'text-gray-500'}`}>
                                                                🚚 Same-day delivery available
                                                            </p>

                                                            {/* Price row */}
                                                            <div className="flex items-center justify-between mb-4">
                                                                <div>
                                                                    <p className={`text-[9px] font-semibold uppercase tracking-wide ${
                                                                        darkMode ? 'text-dark-muted' : 'text-gray-400'
                                                                    }`}>Price</p>
                                                                    <p className={`text-base font-black ${darkMode ? 'text-brand-purple-accent' : 'text-brand-purple'}`}>
                                                                        {product.price?.currency || 'LKR'} {(product.price?.amount || product.price)?.toLocaleString?.() ?? (product.price?.amount || product.price)}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* CTA Button */}
                                                            <div className="flex flex-col gap-2">
                                                                {cart.find(p => p.id === product.id) ? (
                                                                    <div className={`flex items-center justify-between rounded-xl p-1 border ${darkMode ? 'bg-brand-purple-accent/10 border-brand-purple-accent/20' : 'bg-brand-purple/10 border-brand-purple/20'}`}>
                                                                        <button onClick={() => removeFromCart(product.id)} className={`w-8 h-8 flex items-center justify-center font-bold text-lg rounded-lg transition-colors ${darkMode ? 'text-brand-purple-accent hover:bg-brand-purple-accent/20' : 'text-brand-purple hover:bg-brand-purple/20'}`}>-</button>
                                                                        <span className={`font-bold text-[13px] ${darkMode ? 'text-brand-purple-accent' : 'text-brand-purple'}`}>In Cart ({cart.find(p => p.id === product.id)?.qty})</span>
                                                                        <button onClick={() => addToCart(product)} className={`w-8 h-8 flex items-center justify-center font-bold text-lg rounded-lg transition-colors ${darkMode ? 'text-brand-purple-accent hover:bg-brand-purple-accent/20' : 'text-brand-purple hover:bg-brand-purple/20'}`}>+</button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => addToCart(product)}
                                                                        disabled={!product.in_stock}
                                                                        className="w-full py-2.5 rounded-xl text-[13px] font-bold transition-all duration-200 disabled:opacity-40 bg-gradient-to-br from-brand-purple to-brand-purple-dark text-white hover:shadow-lg hover:shadow-brand-purple/30 hover:opacity-90"
                                                                    >
                                                                        Add to Cart
                                                                    </button>
                                                                )}
                                                                {/* WhatsApp Share */}
                                                                {product.url && (
                                                                    <a
                                                                        href={`https://wa.me/?text=${encodeURIComponent(`Hey! Found this on Kapruka 🛍️%0A*${product.name}*%0APrice: ${product.price?.currency || 'LKR'} ${product.price?.amount?.toLocaleString?.() || product.price}%0A${product.url}`)}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className={`w-full py-2 rounded-xl text-[11px] font-bold text-center transition-all duration-200 flex items-center justify-center gap-1.5 ${
                                                                            darkMode ? 'bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366]/20' : 'bg-[#25D366]/10 text-[#128C7E] border border-[#25D366]/30 hover:bg-[#25D366]/20'
                                                                        }`}
                                                                    >
                                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                                                        Share via WhatsApp
                                                                    </a>
                                                                )}
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
                                                        <p className="text-[10px] text-white/90 bg-white/10 px-2.5 py-1 rounded-md mt-1.5 font-mono uppercase tracking-widest font-bold inline-block border border-white/20">
                                                            Ref: {orderRef}
                                                        </p>
                                                    )}
                                                    {(() => {
                                                        const items = orderData.items || orderData.cart || orderData.products;
                                                        if (!items || !items.length) return null;
                                                        return (
                                                            <div className="w-full mt-4 bg-white/5 p-4 rounded-2xl border border-white/10 text-left text-xs space-y-2">
                                                                <h5 className="font-bold text-white/80 mb-2 uppercase tracking-widest text-[10px]">Order Items</h5>
                                                                <div className="space-y-2">
                                                                    {items.map((item: any, idx: number) => (
                                                                        <div key={idx} className="flex justify-between items-start gap-2 text-white/70">
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="truncate">{item.qty || item.quantity || 1}x {item.name || item.product_name || item.product_id}</p>
                                                                            </div>
                                                                            {(item.price || item.unit_price) && (
                                                                                <div className="whitespace-nowrap">
                                                                                    {currency} {((item.price || item.unit_price) * (item.qty || item.quantity || 1)).toLocaleString()}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                    {(() => {
                                                        const addr = orderData.shipping_address || orderData.shipping || orderData.delivery || orderData.recipient;
                                                        if (!addr) return null;
                                                        const name = addr.name || addr.recipient_name || (orderData.recipient && orderData.recipient.name);
                                                        const phone = addr.phone || addr.contact || (orderData.recipient && orderData.recipient.phone);
                                                        return (
                                                            <div className="w-full mt-2 bg-white/5 p-4 rounded-2xl border border-white/10 text-left text-xs">
                                                                <h5 className="font-bold text-white/80 mb-2 uppercase tracking-widest text-[10px]">Shipping To</h5>
                                                                {name && <p className="text-white/70 font-semibold">{name}</p>}
                                                                {(addr.line1 || addr.address || addr.address_line_1) && <p className="text-white/60">{addr.line1 || addr.address || addr.address_line_1}</p>}
                                                                {addr.city && <p className="text-white/60">{addr.city}</p>}
                                                                {phone && <p className="text-white/60 mt-1">{phone}</p>}
                                                                {addr.date && <p className="text-white/60 mt-1 font-bold">On: {addr.date}</p>}
                                                            </div>
                                                        );
                                                    })()}
                                                    {orderData.summary && (
                                                        <div className="w-full my-2 bg-white/5 p-4 rounded-2xl border border-white/10 text-left text-xs space-y-2">
                                                            <div className="flex justify-between text-white/70">
                                                                <span>Items Total</span>
                                                                <span>{currency} {orderData.summary.items_total}</span>
                                                            </div>
                                                            <div className="flex justify-between text-white/70">
                                                                <span>Delivery Fee</span>
                                                                <span>{currency} {orderData.summary.delivery_fee}</span>
                                                            </div>
                                                            <div className="h-px bg-white/10 my-1" />
                                                            <div className="flex justify-between font-black text-sm text-white bg-white/10 p-2 rounded-lg mt-2">
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
                                    {/* ── 7. Scheduled Reminder ── */}
                                    {msg.tool === 'kapruka_set_reminder' && msg.raw_data && (() => {
                                        const reminderData = getParsedData(msg.raw_data);
                                        if (reminderData?.status !== 'success') return null;
                                        return (
                                            <motion.div 
                                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                className={`mt-4 mb-2 overflow-hidden rounded-2xl border shadow-sm ${
                                                    darkMode ? 'bg-dark-card/60 border-brand-purple/30' : 'bg-gradient-to-br from-[#FFF5F7] to-white border-[#7A1C2C]/20'
                                                }`}
                                            >
                                                <div className={`px-4 py-3 border-b flex items-center gap-2 ${
                                                    darkMode ? 'border-dark-border bg-black/20' : 'border-[#7A1C2C]/10 bg-white/50'
                                                }`}>
                                                    <span className="text-xl">⏰</span>
                                                    <h4 className={`text-sm font-bold m-0 ${darkMode ? 'text-brand-purple-accent' : 'text-[#7A1C2C]'}`}>
                                                        Reminder Scheduled!
                                                    </h4>
                                                </div>
                                                <div className="p-4 space-y-3">
                                                    <div className="flex items-start gap-3">
                                                        <div className={`p-2 rounded-xl flex-shrink-0 ${darkMode ? 'bg-brand-purple/10' : 'bg-[#FDF2F4]'}`}>
                                                            <span className="text-xl">🎉</span>
                                                        </div>
                                                        <div>
                                                            <p className={`text-xs font-semibold mb-1 tracking-wider ${darkMode ? 'text-dark-muted' : 'text-gray-500'}`}>EVENT</p>
                                                            <p className={`text-sm font-bold m-0 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                                                                {reminderData.event_name || 'Special Occasion'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start gap-3">
                                                        <div className={`p-2 rounded-xl flex-shrink-0 ${darkMode ? 'bg-brand-purple/10' : 'bg-[#FDF2F4]'}`}>
                                                            <span className="text-xl">📅</span>
                                                        </div>
                                                        <div>
                                                            <p className={`text-xs font-semibold mb-1 tracking-wider ${darkMode ? 'text-dark-muted' : 'text-gray-500'}`}>DATE</p>
                                                            <p className={`text-sm font-bold m-0 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                                                                {reminderData.event_date || 'Upcoming'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Calendar Actions */}
                                                    <div className={`pt-3 mt-1 border-t flex flex-col sm:flex-row gap-2 ${darkMode ? 'border-white/10' : 'border-[#7A1C2C]/10'}`}>
                                                        <a 
                                                            href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(reminderData.event_name || 'Event')}&dates=${reminderData.event_date?.replace(/-/g, '')}/${reminderData.event_date?.replace(/-/g, '')}&details=Kapruka%20Gift%20Reminder`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                                                                darkMode ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'
                                                            }`}
                                                        >
                                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm4.207 12.793-1.414 1.414L11 12.414V7h2v4.586l3.207 3.207z"></path></svg>
                                                            Google Calendar
                                                        </a>
                                                        <button 
                                                            onClick={() => {
                                                                const eventName = reminderData.event_name || 'Event';
                                                                const formattedDate = (reminderData.event_date || '').replace(/-/g, '');
                                                                if(!formattedDate) return;
                                                                const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:${formattedDate}\nDTEND;VALUE=DATE:${formattedDate}\nSUMMARY:${eventName}\nDESCRIPTION:Kapruka Reminder\nEND:VEVENT\nEND:VCALENDAR`;
                                                                const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
                                                                const link = document.createElement('a');
                                                                link.href = window.URL.createObjectURL(blob);
                                                                link.setAttribute('download', `${eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`);
                                                                document.body.appendChild(link);
                                                                link.click();
                                                                document.body.removeChild(link);
                                                            }}
                                                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                                                                darkMode ? 'bg-white/10 text-white hover:bg-white hover:text-black' : 'bg-gray-100 text-gray-700 hover:bg-gray-800 hover:text-white'
                                                            }`}
                                                        >
                                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-2V2h-2v2H9V2H7v2H5c-1.103 0-2 .897-2 2v14c0 1.103.897 2 2 2h14c1.103 0 2-.897 2-2V6c0-1.103-.897-2-2-2zm.002 16H5V8h14l.002 12z"></path><path d="M11 10h2v5h-2zM7 10h2v5H7zM15 10h2v5h-2z"></path></svg>
                                                            Apple / Outlook
                                                        </button>
                                                    </div>
                                                </div>
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

                    {/* Loading Indicator — Personality Phrases */}
                    {isLoading && (
                        <div className="flex justify-start">
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`p-4 rounded-3xl rounded-bl-lg shadow-sm flex gap-3 items-center max-w-xs ${
                                    darkMode ? 'glass' : 'glass-strong'
                                }`}
                            >
                                <div className="flex gap-1.5 items-center flex-shrink-0">
                                    <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.2 }}
                                        className="w-2 h-2 bg-gradient-to-r from-pink-400 to-brand-purple rounded-full" />
                                    <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }}
                                        className="w-2 h-2 bg-gradient-to-r from-pink-400 to-brand-purple rounded-full" />
                                    <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }}
                                        className="w-2 h-2 bg-gradient-to-r from-pink-400 to-brand-purple rounded-full" />
                                </div>
                                <motion.span
                                    key={loadingPhrase}
                                    initial={{ opacity: 0, x: 6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={`text-xs font-semibold italic ${
                                        darkMode ? 'text-dark-muted' : 'text-gray-500'
                                    }`}
                                >
                                    {loadingPhrase}
                                </motion.span>
                            </motion.div>
                        </div>
                    )}

                    {/* ── Smart Contextual Suggestion Chips ── */}
                    {!isLoading && messages.length > 1 && (
                        <motion.div
                            key={suggestedActions.join('')}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="flex flex-wrap gap-2 pb-2"
                        >
                            {suggestedActions.map((action, i) => (
                                <motion.button
                                    key={action}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.1 * i }}
                                    onClick={() => sendMessage(resolveChipMessage(action))}
                                    className={`px-3.5 py-2 rounded-full text-[11px] font-semibold transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer gum-control ${
                                        darkMode
                                            ? 'bg-dark-card border-dark-border text-dark-muted hover:bg-brand-purple/15 hover:text-brand-purple-accent hover:border-brand-purple/40'
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-brand-purple hover:text-white hover:border-brand-purple shadow-sm'
                                    }`}
                                >
                                    {action}
                                </motion.button>
                            ))}
                        </motion.div>
                    )}
                    {/* Invisible spacer to give the last message breathing room so it's not flush with the input box */}
                    <div className="h-12 md:h-16 shrink-0" />
                    <div ref={messagesEndRef} />
                </div>
                </>
                )}

                {/* ── Input Area ── */}
                <div className="p-4 md:p-6 pt-0 relative z-10 w-full max-w-7xl mx-auto">

                    {/* Image Preview Thumbnail */}
                    <AnimatePresence>
                        {attachedImage && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="absolute -top-16 left-6 p-1 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl shadow-lg flex items-center gap-2 group z-20"
                            >
                                <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-100 dark:border-dark-border">
                                    <img src={attachedImage} alt="Preview" className="w-full h-full object-cover" />
                                </div>
                                <button 
                                    onClick={() => { setAttachedImage(null); setAttachedImageMime(null); }}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:scale-110 transition-transform"
                                >
                                    <TrashIcon />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {isRecording ? (
                        <div 
                            onClick={toggleRecording}
                            className="relative flex items-center w-full h-[54px] bg-[#0A0A0A] rounded-full border border-green-500/40 shadow-[0_0_20px_rgba(34,197,94,0.15)] px-5 z-20 overflow-hidden cursor-pointer hover:border-green-400 transition-colors"
                            title="Click to cancel"
                        >
                            <span className="text-green-400 font-bold text-sm tracking-wide min-w-max mr-4 z-10 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)] overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px] sm:max-w-[400px]">
                                {liveTranscript || "Listening..."}
                            </span>
                            <div className="flex items-center gap-[5px] h-8 flex-1 opacity-70 pointer-events-none overflow-hidden mask-image-linear-gradient-to-r">
                                {[
                                    { h: "12px", d: 0.0 }, { h: "20px", d: 0.2 }, { h: "10px", d: 0.4 }, { h: "24px", d: 0.1 },
                                    { h: "16px", d: 0.5 }, { h: "8px", d: 0.3 }, { h: "22px", d: 0.6 }, { h: "14px", d: 0.2 },
                                    { h: "28px", d: 0.0 }, { h: "12px", d: 0.4 }, { h: "20px", d: 0.7 }, { h: "10px", d: 0.1 },
                                    { h: "24px", d: 0.5 }, { h: "16px", d: 0.3 }, { h: "8px", d: 0.6 }, { h: "22px", d: 0.2 },
                                    { h: "14px", d: 0.5 }, { h: "26px", d: 0.1 }, { h: "10px", d: 0.4 }, { h: "18px", d: 0.7 },
                                    { h: "12px", d: 0.3 }, { h: "24px", d: 0.6 }, { h: "8px", d: 0.1 }, { h: "16px", d: 0.5 },
                                    { h: "20px", d: 0.2 }, { h: "10px", d: 0.4 }, { h: "26px", d: 0.0 }, { h: "14px", d: 0.3 },
                                    { h: "22px", d: 0.6 }, { h: "12px", d: 0.1 }, { h: "18px", d: 0.5 }, { h: "8px", d: 0.2 }
                                ].map((bar, i) => (
                                    <motion.div 
                                        key={i}
                                        animate={{ height: ["6px", bar.h, "6px"] }} 
                                        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: bar.d }} 
                                        className="w-1.5 bg-green-400 rounded-full flex-shrink-0" 
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={sendMessage} className="relative flex items-center w-full z-20">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleImageSelect} 
                                accept="image/*" 
                                className="hidden" 
                            />
                            <button type="button" onClick={() => fileInputRef.current?.click()} className={`absolute left-2 p-2 rounded-full transition-colors cursor-pointer ${darkMode ? 'text-white/60 hover:text-cyan-300 hover:bg-white/10' : 'text-brand-purple/70 hover:text-brand-purple hover:bg-brand-purple/10'}`}>
                                <AttachmentIcon />
                            </button>
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={translations[currentLang].inputPlaceholder}
                                className={`w-full py-4 pl-12 pr-[100px] rounded-full focus-glow transition-all duration-300 text-sm placeholder:tracking-wide neu-input ${
                                    darkMode
                                        ? 'bg-dark-card/80 text-dark-text placeholder:text-dark-muted border border-dark-border focus:border-brand-purple/50'
                                        : 'bg-white text-gray-700 placeholder:text-gray-400 border border-gray-200 focus:border-brand-purple/50'
                                }`}
                                disabled={isLoading}
                            />
                            <div className="absolute right-1.5 flex items-center gap-1">
                                <button 
                                    type="button" 
                                    onClick={toggleRecording} 
                                    className={`p-2 rounded-full transition-all duration-300 cursor-pointer flex items-center justify-center w-10 h-10 ${
                                        darkMode ? 'text-white/60 hover:text-pink-300 hover:bg-white/10 border border-transparent' : 'text-brand-purple/70 hover:text-pink-500 hover:bg-brand-purple/10 border border-transparent'
                                    }`}
                                    title="Voice Input"
                                >
                                    <MicrophoneIcon />
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading || !input.trim()}
                                    className={`w-10 h-10 rounded-full transition-all duration-300 active:scale-95 flex items-center justify-center cursor-pointer shadow-md ${
                                        (!isLoading && input.trim())
                                            ? 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 hover:shadow-[0_0_15px_rgba(236,72,153,0.6)] text-white'
                                            : darkMode
                                                ? 'bg-[#252D44]/60 text-dark-muted border border-[#252D44] cursor-not-allowed opacity-50'
                                                : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-50'
                                    }`}
                                >
                                    <SendIcon />
                                </button>
                            </div>
                        </form>
                    )}
                    <p className={`text-center text-[10px] mt-2.5 font-medium tracking-wide ${darkMode ? 'text-dark-muted' : 'text-white/40'}`}>
                        Ayla is an AI Agent and can make mistakes. Please double-check before use.
                    </p>
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
                        className={`fixed md:absolute right-0 top-0 bottom-0 lg:relative w-full sm:w-[360px] laptop:w-[400px] flex flex-col z-50 h-full transition-colors duration-300 shadow-2xl lg:shadow-none ${
                            darkMode
                                ? 'bg-dark-surface/95 backdrop-blur-xl border-l border-dark-border'
                                : 'bg-white/95 backdrop-blur-xl border-l border-[#002F6C]/10'
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
                                    onClick={() => sendMessage(`Check delivery options to Kandy for product "${activeProduct.name}" (ID: ${activeProduct.id})`)}
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
                        className={`fixed md:relative right-0 top-0 bottom-0 w-full md:w-96 lg:w-[460px] flex flex-col z-50 h-full transition-colors duration-300 ${
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
                        className={`fixed md:relative right-0 top-0 bottom-0 w-full md:w-80 lg:w-[400px] flex flex-col z-50 h-full transition-colors duration-300 ${
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
                        className={`fixed md:absolute right-0 top-0 bottom-0 w-full sm:w-[360px] laptop:w-[400px] flex flex-col z-50 h-full transition-colors duration-300 shadow-2xl ${
                            darkMode
                                ? 'bg-dark-surface/95 backdrop-blur-xl border-l border-dark-border'
                                : 'bg-white/95 backdrop-blur-xl border-l border-[#002F6C]/10'
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