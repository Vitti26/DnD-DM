import { Send } from 'lucide-react';

export const ChatInput = ({ input, setInput, onSend, loading, onTyping }) => (
    <div className="flex gap-2 bg-white p-3 rounded-lg shadow-sm border border-slate-200">
        <input
            className="flex-1 p-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-500"
            value={input}
            onChange={(e) => {
                setInput(e.target.value);
                if (onTyping) onTyping();
            }}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
            placeholder="Describe qué hace tu personaje..."
            disabled={loading}
        />
        <button
            onClick={onSend}
            disabled={loading}
            className="bg-slate-800 text-white px-6 py-2 rounded font-bold disabled:bg-gray-400 hover:bg-slate-700 transition-colors flex items-center justify-center"
        >
            <Send className="w-4 h-4" />
        </button>
    </div>
);
