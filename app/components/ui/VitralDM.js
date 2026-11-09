export function VitralDM({ pensando = false, className = "" }) {
    return (
        <div className={`relative flex items-center justify-center ${className}`}>
            <svg
                viewBox="0 0 120 120"
                className={`w-14 h-14 md:w-16 md:h-16 transition-all duration-700 ${
                    pensando ? 'animate-pulse drop-shadow-[0_0_15px_rgba(200,164,90,0.8)] scale-105' : 'drop-shadow-md'
                }`}
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <radialGradient id="solDorado" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#fef08a" />
                        <stop offset="60%" stopColor="#c8a45a" />
                        <stop offset="100%" stopColor="#7b1f1f" />
                    </radialGradient>
                    <linearGradient id="marcoVitral" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#c8a45a" />
                        <stop offset="50%" stopColor="#8a6a3e" />
                        <stop offset="100%" stopColor="#241510" />
                    </linearGradient>
                </defs>

                {/* Marco de arco ojival / vitral */}
                <circle cx="60" cy="60" r="54" fill="#241510" stroke="url(#marcoVitral)" strokeWidth="4" />
                <circle cx="60" cy="60" r="48" fill="url(#solDorado)" opacity="0.85" />

                {/* Segmentos poligonales de vitral gótico */}
                <path d="M60 12 L85 45 L60 60 Z" fill="#4b2a5e" opacity="0.6" stroke="#241510" strokeWidth="1.5" />
                <path d="M60 12 L35 45 L60 60 Z" fill="#7b1f1f" opacity="0.65" stroke="#241510" strokeWidth="1.5" />
                <path d="M35 45 L15 65 L60 60 Z" fill="#4a1212" opacity="0.7" stroke="#241510" strokeWidth="1.5" />
                <path d="M85 45 L105 65 L60 60 Z" fill="#4b2a5e" opacity="0.7" stroke="#241510" strokeWidth="1.5" />
                <path d="M15 65 L60 108 L60 60 Z" fill="#7b1f1f" opacity="0.75" stroke="#241510" strokeWidth="1.5" />
                <path d="M105 65 L60 108 L60 60 Z" fill="#4a1212" opacity="0.75" stroke="#241510" strokeWidth="1.5" />

                {/* Silueta central de Dragón / Ojo Arcana */}
                <path
                    d="M50 48 C55 42 65 42 70 48 C75 54 78 62 70 70 C64 76 60 82 60 82 C60 82 56 76 50 70 C42 62 45 54 50 48 Z"
                    fill="#1f140e"
                    stroke="#c8a45a"
                    strokeWidth="1.5"
                />
                <circle cx="60" cy="58" r="4" fill="#fef08a" />
            </svg>

            {pensando && (
                <div className="absolute -bottom-5 text-[10px] font-cinzel font-bold text-[#c8a45a] tracking-widest uppercase animate-pulse">
                    El DM reflexiona...
                </div>
            )}
        </div>
    );
}

