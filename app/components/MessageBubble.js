export const MessageBubble = ({ message }) => {
    const isDM = message.rol === 'dm';
    return (
        <div className={`flex ${isDM ? 'justify-start' : 'justify-end'} mb-4`}>
            <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${isDM
                ? 'bg-white/70 border-l-8 border-red-900 rounded-tl-none font-serif text-lg italic text-stone-900'
                : 'bg-slate-800 text-white rounded-tr-none font-sans'
                }`}>
                <span className="text-[10px] font-black uppercase opacity-60 block mb-1 tracking-wider">
                    {isDM 
                        ? '📜 Dungeon Master' 
                        : message.personaje 
                            ? `⚔️ ${message.personaje} (${message.autor || 'Aventurero'})`
                            : `⚔️ ${message.autor || 'Acción'}`
                    }
                </span>
                <p className="leading-relaxed whitespace-pre-wrap">{message.texto}</p>
            </div>
        </div>
    );
};
