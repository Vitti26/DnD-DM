import { Scroll, Shield } from 'lucide-react';

export const MessageBubble = ({ message }) => {
    const isDM = message.rol === 'dm';
    return (
        <div className={`flex ${isDM ? 'justify-start' : 'justify-end'} mb-4`}>
            <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${isDM
                ? 'bg-white/60 border-l-8 border-red-900 rounded-tl-none font-serif text-lg italic'
                : 'bg-slate-800 text-white rounded-tr-none font-sans'
                }`}>
                <span className="text-[10px] font-black uppercase opacity-40 block mb-1">
                    {isDM ? '📜 Dungeon Master' : '⚔️ Acción'}
                </span>
                <p className="leading-relaxed">{message.texto}</p>
            </div>
        </div>
    );
};
