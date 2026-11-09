import { DragonCorner } from './ui/DragonCorner';

export const MessageBubble = ({ message }) => {
    const isDM = message.rol === 'dm';

    if (isDM) {
        return (
            <div className="flex justify-start mb-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="relative max-w-[95%] md:max-w-[85%] bg-pergamino-real text-[#241510] p-6 md:p-8 rounded-2xl border-2 border-[#8a6a3e] shadow-2xl overflow-hidden">
                    {/* Filigranas en las esquinas */}
                    <div className="absolute top-1 left-1 pointer-events-none opacity-40">
                        <DragonCorner className="w-8 h-8 text-[#7b1f1f]" />
                    </div>
                    <div className="absolute top-1 right-1 pointer-events-none opacity-40 transform rotate-90">
                        <DragonCorner className="w-8 h-8 text-[#7b1f1f]" />
                    </div>

                    {/* Encabezado del DM */}
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#8a6a3e]/40">
                        <span className="font-cinzel text-xs font-bold uppercase tracking-widest text-[#7b1f1f] drop-shadow-sm">
                            Crónica del Dungeon Master
                        </span>
                    </div>

                    {/* Texto narrativo con letra capitular */}
                    <div className="font-garamond text-base md:text-lg leading-relaxed text-[#241510] letra-capitular whitespace-pre-wrap font-medium">
                        {message.texto}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-end mb-5 w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="max-w-[85%] md:max-w-[70%] bg-[#1f140e] text-[#f3e7ce] p-4 md:p-5 rounded-2xl rounded-tr-none border border-[#8a6a3e]/80 shadow-xl">
                <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-[#8a6a3e]/30">
                    <span className="font-cinzel text-[11px] font-bold uppercase tracking-wider text-[#c8a45a]">
                        {message.personaje 
                            ? `${message.personaje} (${message.autor || 'Aventurero'})`
                            : (message.autor || 'Acción de la Compañía')
                        }
                    </span>
                </div>
                <p className="font-garamond text-sm md:text-base leading-relaxed text-amber-50/90 whitespace-pre-wrap">
                    {message.texto}
                </p>
            </div>
        </div>
    );
};
