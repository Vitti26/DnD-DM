export function Medallon({ valor, etiqueta, icono: Icono, size = "normal" }) {
    const isSmall = size === "small";

    return (
        <div className="flex flex-col items-center justify-center text-center">
            <div className={`relative rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 ${
                isSmall ? 'w-10 h-10' : 'w-12 h-12'
            } bg-gradient-to-br from-[#c8a45a] via-[#9c7a3c] to-[#4a1212] p-[2px]`}>
                {/* Anillo interior */}
                <div className="w-full h-full rounded-full bg-[#1f140e] flex flex-col items-center justify-center border border-[#c8a45a]/60">
                    {Icono && <Icono size={isSmall ? 10 : 12} className="text-[#c8a45a] mb-0.5 opacity-80" />}
                    <span className={`font-cinzel font-bold text-white leading-none ${isSmall ? 'text-xs' : 'text-sm'}`}>
                        {valor}
                    </span>
                </div>
            </div>
            {etiqueta && (
                <span className="font-cinzel text-[9px] uppercase tracking-wider text-[#c9ae80] font-bold mt-1">
                    {etiqueta}
                </span>
            )}
        </div>
    );
}

