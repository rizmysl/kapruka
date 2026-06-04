import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

interface RawData {
  id?: string;
  name?: string;
  price?: number;
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

export default function ChatApp() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'bot', text: "Ayubowan! I am your Colombo Gift Concierge. What kind of gift are you looking for today?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeProduct, setActiveProduct] = useState<RawData | null>(null); // Controls the right pane
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async (eOrText: any) => {
        if (eOrText?.preventDefault) eOrText.preventDefault();
        
        const userText = typeof eOrText === 'string' ? eOrText : input;
        if (!userText.trim()) return;

        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userText }]);
        setIsLoading(true);

        try {
            const response = await fetch('http://localhost:8002/chat/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ message: userText })
            });

            const data = await response.json();

            setMessages(prev => [...prev, { 
                role: 'bot', 
                text: data.text,
                tool: data.tool_called,
                raw_data: data.raw_data
            }]);

            // If the AI fetched a specific product, automatically open it in the right pane!
            if (data.tool_called === 'kapruka_get_product' && data.raw_data) {
                setActiveProduct(data.raw_data);
            }

        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'bot', text: "Sorry, I had trouble reaching the Kapruka database." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-screen w-full bg-[#FDF2F4] overflow-hidden font-sans">
            
            {/* PANE 1: LEFT SIDEBAR (Kapruka Deep Blue) */}
            <div className="w-64 bg-[#002F6C] text-white flex flex-col shadow-2xl z-20 hidden md:flex">
                <div className="p-6 pb-2">
                    <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
                        <span className="text-[#FF7A00]">k</span>apruka
                    </h1>
                    <p className="text-xs text-white/60 mt-1 font-medium tracking-wider uppercase">Gift Concierge</p>
                </div>

                <nav className="flex-1 px-4 mt-8 space-y-2">
                    <a href="#" className="flex items-center gap-3 px-4 py-3 bg-white/10 rounded-xl text-sm font-semibold transition-colors">
                        💬 Active Chat
                    </a>
                    <a href="#" className="flex items-center gap-3 px-4 py-3 text-white/60 hover:bg-white/5 rounded-xl text-sm font-medium transition-colors">
                        📦 Order History
                    </a>
                    <a href="#" className="flex items-center gap-3 px-4 py-3 text-white/60 hover:bg-white/5 rounded-xl text-sm font-medium transition-colors">
                        ⚙️ Settings
                    </a>
                </nav>

                <div className="p-6">
                    <div className="bg-white/10 p-4 rounded-xl text-xs text-white/70">
                        <p className="font-semibold text-white mb-1">Hackathon Build</p>
                        <p>Powered by Gemini & MCP</p>
                    </div>
                </div>
            </div>

            {/* PANE 2: CENTER CHAT FEED (Maroon Light Background) */}
            <div className="flex-1 flex flex-col relative h-full">
                
                {/* Mobile Header (Hidden on Desktop) */}
                <div className="md:hidden bg-[#002F6C] text-white p-4 shadow-md z-10 flex justify-between items-center">
                    <h1 className="text-lg font-bold">Kapruka Concierge</h1>
                    <button className="text-white/80">☰</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8">
                    <AnimatePresence>
                        {messages.map((msg, index) => (
                            <motion.div 
                                key={index} 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ type: "spring", stiffness: 260, damping: 25 }}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[80%] p-5 shadow-sm backdrop-blur-md ${
                                    msg.role === 'user' 
                                        ? 'bg-[#FF7A00] text-white rounded-3xl rounded-br-sm' 
                                        : 'bg-white/90 text-gray-800 border border-[#7A1C2C]/20 rounded-3xl rounded-bl-sm shadow-xl'
                                }`}>
                                    
                                    {/* Conversational text */}
                                    {msg.text && (
                                        <div className="prose prose-sm max-w-none">
                                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                                        </div>
                                    )}

                                    {/* Search Results Block */}
                                    {msg.tool === 'kapruka_search_products' && msg.raw_data?.structuredContent?.result && (
                                        <motion.div 
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                                            className="mt-4 p-4 bg-[#FDF2F4]/50 rounded-2xl border border-[#7A1C2C]/10 prose prose-sm max-w-none text-sm"
                                        >
                                            <ReactMarkdown>{msg.raw_data.structuredContent.result}</ReactMarkdown>
                                        </motion.div>
                                    )}

                                    {/* Logistics Badge */}
                                    {msg.tool === 'kapruka_check_delivery' && msg.raw_data && (
                                        <div className="mt-4 p-4 bg-white rounded-2xl border border-[#7A1C2C]/20 flex items-center gap-4">
                                            <div className="p-3 bg-[#FF7A00] text-white rounded-xl text-xl animate-bounce">🚚</div>
                                            <div className="flex-1">
                                                <h4 className="font-bold text-gray-800 text-sm">Delivery to {msg.raw_data.city || 'Destination'}</h4>
                                                <div className="mt-1 flex gap-4 text-xs font-medium">
                                                    <span className="text-[#7A1C2C]">💰 Fee: {msg.raw_data.currency} {msg.raw_data.cost}</span>
                                                    <span className="text-green-600">⏱️ Time: {msg.raw_data.estimated_days}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* 5. Render Checkout Link (For kapruka_create_order) */}
                                    {msg.tool === 'kapruka_create_order' && msg.raw_data && (
                                        <motion.div 
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ type: "spring", stiffness: 260, damping: 25 }}
                                            className="mt-5 p-6 bg-gradient-to-br from-[#002F6C] to-[#001f4d] text-white rounded-3xl shadow-2xl border border-[#002F6C]/50 flex flex-col items-center text-center gap-3 relative overflow-hidden"
                                        >
                                            {/* Subtle background glow effect */}
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF7A00]/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
                                            
                                            <div className="w-14 h-14 bg-[#FF7A00] rounded-2xl flex items-center justify-center text-3xl shadow-lg z-10">
                                                🛍️
                                            </div>
                                            
                                            <div className="z-10">
                                                <h4 className="font-extrabold text-xl tracking-tight">Order Ready!</h4>
                                                <p className="text-sm text-white/80 mt-1.5 max-w-[260px] leading-relaxed">
                                                    Your delivery details are confirmed and your items are locked in. 
                                                </p>
                                            </div>

                                            {/* The Live Payment Link */}
                                            {msg.raw_data.checkout_url ? (
                                                <a 
                                                    href={msg.raw_data.checkout_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mt-3 w-full py-4 bg-white text-[#002F6C] hover:bg-[#FDF2F4] hover:text-[#7A1C2C] hover:shadow-[0_0_20px_rgba(255,122,0,0.3)] font-extrabold rounded-xl shadow-md transition-all duration-300 uppercase tracking-widest text-sm z-10"
                                                >
                                                    Proceed to Payment 💳
                                                </a>
                                            ) : (
                                                <div className="mt-3 w-full py-4 bg-white/10 text-white/50 font-bold rounded-xl border border-white/10 uppercase tracking-widest text-sm z-10">
                                                    Generating Link...
                                                </div>
                                            )}
                                            
                                            <div className="text-[10px] text-white/40 flex items-center gap-1.5 mt-2 z-10 font-medium tracking-wide uppercase">
                                                <span>🔒 Secure 60-Minute Price Lock</span>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Contextual Badge indicating Product is in Right Pane */}
                                    {msg.tool === 'kapruka_get_product' && msg.raw_data && (
                                        <button 
                                            onClick={() => setActiveProduct(msg.raw_data || null)}
                                            className="mt-3 text-xs font-bold text-[#7A1C2C] bg-[#FDF2F4] px-3 py-1.5 rounded-full hover:bg-[#7A1C2C] hover:text-white transition-colors flex items-center gap-1"
                                        >
                                            🔍 View Product Details ➡️
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white/80 p-4 rounded-3xl rounded-bl-sm border border-[#7A1C2C]/20 shadow-sm flex gap-2 items-center">
                                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 bg-[#FF7A00] rounded-full" />
                                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-[#FF7A00] rounded-full" />
                                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-[#FF7A00] rounded-full" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-6 pt-0">
                    <AnimatePresence>
                        {!isLoading && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="flex gap-2 overflow-x-auto hide-scrollbar pb-3"
                            >
                                {['🎂 Find Birthday Cakes', '🧸 Educational Toys', '🚚 Check Kandy Delivery'].map((chip, index) => (
                                    <button
                                        key={index}
                                        onClick={() => sendMessage(chip)}
                                        className="whitespace-nowrap px-4 py-2 bg-white/90 backdrop-blur-md border border-[#002F6C]/10 rounded-full text-sm font-medium text-[#002F6C] hover:bg-[#FDF2F4] hover:text-[#7A1C2C] hover:border-[#7A1C2C]/30 shadow-sm transition-all duration-200"
                                    >
                                        {chip}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={sendMessage} className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Message the concierge..."
                            className="flex-1 p-4 bg-white border border-[#002F6C]/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7A00] shadow-sm text-gray-700"
                            disabled={isLoading}
                        />
                        <button 
                            type="submit" 
                            disabled={isLoading || !input.trim()}
                            className="px-6 py-4 bg-[#FF7A00] text-white font-bold rounded-2xl hover:bg-[#e66e00] disabled:opacity-50 transition-colors shadow-md"
                        >
                            Send
                        </button>
                    </form>
                </div>
            </div>

            {/* PANE 3: RIGHT PRODUCT INSPECTOR */}
            <AnimatePresence>
                {activeProduct && (
                    <motion.div 
                        initial={{ x: 400, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 400, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 260, damping: 25 }}
                        className="w-80 lg:w-[400px] bg-white border-l border-[#002F6C]/10 shadow-2xl flex flex-col z-30 h-full"
                    >
                        <div className="p-4 flex justify-between items-center border-b border-gray-100 bg-[#FDF2F4]/30">
                            <h3 className="font-semibold text-[#002F6C] text-sm uppercase tracking-wider">Product Inspector</h3>
                            <button 
                                onClick={() => setActiveProduct(null)}
                                className="text-gray-400 hover:text-[#7A1C2C] p-2 bg-white rounded-full hover:bg-[#FDF2F4] transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                            {/* Product Image */}
                            <div className="rounded-3xl overflow-hidden bg-gray-50 border border-gray-100 p-2 shadow-inner">
                                {activeProduct.image_url ? (
                                    <img 
                                        src={activeProduct.image_url} 
                                        alt={activeProduct.name} 
                                        className="w-full h-64 object-contain rounded-2xl"
                                    />
                                ) : (
                                    <div className="w-full h-64 flex items-center justify-center text-gray-400">No Image Available</div>
                                )}
                            </div>

                            {/* Product Details */}
                            <div>
                                <h2 className="text-2xl font-bold text-[#002F6C] leading-tight mb-2">
                                    {activeProduct.name || 'Kapruka Item'}
                                </h2>
                                <div className="flex items-center justify-between mt-4 border-t border-b border-gray-100 py-4">
                                    <span className="text-3xl font-extrabold text-[#FF7A00]">
                                        {activeProduct.currency} {activeProduct.price}
                                    </span>
                                    <span className={`text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wide ${activeProduct.in_stock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {activeProduct.in_stock ? '● In Stock' : '○ Out of Stock'}
                                    </span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-auto space-y-3 pt-6">
                                {activeProduct.direct_url && (
                                    <a 
                                        href={activeProduct.direct_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block w-full text-center bg-[#002F6C] hover:bg-[#001f4d] shadow-lg hover:shadow-xl text-white py-4 rounded-2xl font-bold transition-all duration-200"
                                    >
                                        View on Kapruka Main Store
                                    </a>
                                )}
                                <button 
                                    onClick={() => {
                                        sendMessage(`Check delivery options to Kandy for ${activeProduct.name}`);
                                    }}
                                    className="block w-full text-center bg-white border-2 border-[#7A1C2C] text-[#7A1C2C] hover:bg-[#FDF2F4] py-3 rounded-2xl font-bold transition-all duration-200"
                                >
                                    🚚 Calculate Shipping
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}