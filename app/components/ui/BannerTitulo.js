export function BannerTitulo({ children, className = "" }) {
    return (
        <div className={`relative inline-flex items-center justify-center my-2 ${className}`}>
            {/* Cinta pergamino central */}
            <div className="relative z-10 px-6 py-1.5 bg-gradient-to-r from-[#c9ae80] via-[#e3d0ab] to-[#c9ae80] border-y-2 border-[#8a6a3e] shadow-md">
                <span className="font-cinzel text-xs md:text-sm font-bold uppercase tracking-widest text-[#241510] drop-shadow-sm flex items-center gap-2">
                    {children}
                </span>
            </div>

            {/* Pliegue izquierdo */}
            <div className="absolute -left-3 top-1 z-0 w-4 h-full bg-[#8a6a3e] transform -skew-y-12 shadow-sm rounded-l-sm" />
            <div className="absolute -left-4 top-2 z-0 w-3 h-4 bg-[#4a1212] transform -skew-y-12" />

            {/* Pliegue derecho */}
            <div className="absolute -right-3 top-1 z-0 w-4 h-full bg-[#8a6a3e] transform skew-y-12 shadow-sm rounded-r-sm" />
            <div className="absolute -right-4 top-2 z-0 w-3 h-4 bg-[#4a1212] transform skew-y-12" />
        </div>
    );
}

