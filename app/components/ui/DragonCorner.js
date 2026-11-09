export function DragonCorner({ className = "w-10 h-10 text-amber-700" }) {
    return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
            {/* Esquina ornamentada con motivo de dragón / filigrana */}
            <path
                d="M2 2H20C26 2 30 6 30 12C30 18 24 22 18 22H14L22 34H14L6 22H2V2Z"
                fill="currentColor"
                opacity="0.85"
            />
            <path
                d="M2 2V20C2 26 6 30 12 30C18 30 22 24 22 18V14L34 22V14L22 6V2H2Z"
                fill="currentColor"
                opacity="0.85"
            />
            <circle cx="8" cy="8" r="3" fill="#c8a45a" />
            <path d="M4 44L44 4" stroke="#c8a45a" strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />
        </svg>
    );
}

