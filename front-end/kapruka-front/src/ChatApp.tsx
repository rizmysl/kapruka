import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

export default function ChatApp() {
    const [messages, setMessages] = useState([
        { role: 'bot', text: "Ayubowan! I am your Colombo Gift Concierge. What kind of gift are you looking for today?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userText = input;
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
                raw_data: data.raw_data // We are now saving the raw data to state!
            }]);

        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'bot', text: "Sorry, I had trouble reaching the Kapruka database." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen max-w-3xl mx-auto bg-gray-50 border-x shadow-xl font-sans">
            <div className="bg-orange-500 text-white p-4 shadow-md z-10">
                <h1 className="text-xl font-bold">Kapruka Gift Concierge</h1>
                <p className="text-sm opacity-90">Powered by Gemini & MCP</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                            msg.role === 'user' 
                                ? 'bg-orange-500 text-white rounded-br-none' 
                                : 'bg-white text-gray-800 border rounded-bl-none'
                        }`}>
                            
                            {/* 1. Render standard conversational text */}
                            {msg.text && (
                                <div className="prose prose-sm max-w-none">
                                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                                </div>
                            )}

                            {/* 2. Render Search Results List */}
                            {msg.tool === 'kapruka_search_products' && msg.raw_data?.structuredContent?.result && (
                                <div className="mt-4 p-4 bg-gray-100 rounded-xl border prose prose-sm max-w-none text-sm">
                                    <ReactMarkdown>{msg.raw_data.structuredContent.result}</ReactMarkdown>
                                </div>
                            )}

                            {/* 3. Render Rich Product Card (For kapruka_get_product) */}
                            {msg.tool === 'kapruka_get_product' && msg.raw_data && (
                                <div className="mt-4 border rounded-xl overflow-hidden bg-white shadow-sm max-w-sm">
                                    {msg.raw_data.image_url && (
                                        <img 
                                            src={msg.raw_data.image_url} 
                                            alt={msg.raw_data.name} 
                                            className="w-full h-48 object-cover"
                                        />
                                    )}
                                    <div className="p-4">
                                        <h3 className="font-bold text-lg leading-tight mb-2">
                                            {msg.raw_data.name || 'Kapruka Product'}
                                        </h3>
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-orange-600 font-bold text-lg">
                                                {msg.raw_data.currency} {msg.raw_data.price}
                                            </span>
                                            <span className={`text-xs px-2 py-1 rounded-full ${msg.raw_data.in_stock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {msg.raw_data.in_stock ? 'In Stock' : 'Out of Stock'}
                                            </span>
                                        </div>
                                        {msg.raw_data.direct_url && (
                                            <a 
                                                href={msg.raw_data.direct_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block w-full text-center bg-orange-500 text-white py-2 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
                                            >
                                                View on Kapruka
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {/* Tool execution badge */}
                            {msg.tool && (
                                <div className="mt-3 text-xs text-gray-400 border-t pt-2 flex items-center gap-1">
                                    <span>🔍 Searched database via {msg.tool}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white text-gray-500 border p-4 rounded-2xl rounded-bl-none shadow-sm animate-pulse">
                            Thinking...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t">
                <form onSubmit={sendMessage} className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="E.g., Find me a chocolate cake..."
                        className="flex-1 p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                        disabled={isLoading}
                    />
                    <button 
                        type="submit" 
                        disabled={isLoading || !input.trim()}
                        className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors"
                    >
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
}