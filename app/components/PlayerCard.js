import { ICONOS_CLASE } from './Icons';
import { Medallon } from './ui/Medallon';
import { Shield, Heart } from 'lucide-react';

export const PlayerCard = ({ jugador }) => {
    const hpMax = jugador.hp_max || (jugador.clase === "Bárbaro" ? 14 : jugador.clase === "Guerrero" ? 12 : 10);
    const hpActual = jugador.hp !== undefined ? jugador.hp : hpMax;
    const porcentajeHp = Math.max(0, Math.min(100, Math.round((hpActual / hpMax) * 100)));
    const ca = jugador.ca || 12;

    return (
        <div className="group relative bg-[#1f140e] text-[#f3e7ce] p-3.5 rounded-2xl border-2 border-[#8a6a3e] shadow-xl overflow-hidden transition-all hover:scale-[1.02] hover:border-[#c8a45a]/80">
            {/* Fondo con textura sutil de pergamino envejecido */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#241510] via-[#1a0f0b] to-[#120a07] opacity-95 pointer-events-none" />

            {/* Icono de clase en filigrana de fondo */}
            <div className="absolute -right-2 -bottom-2 opacity-10 text-[#c8a45a] pointer-events-none transform rotate-12 scale-125">
                {ICONOS_CLASE[jugador.clase]}
            </div>

            <div className="relative z-10 space-y-2.5">
                {/* Cabecera con Nombre y Nivel */}
                <div className="flex justify-between items-start border-b border-[#8a6a3e]/40 pb-2">
                    <div>
                        <h3 className="font-cinzel font-bold text-base text-amber-100 group-hover:text-amber-200 transition-colors leading-tight drop-shadow-sm">
                            {jugador.nombre}
                        </h3>
                        <span className="text-[10px] font-cinzel font-bold uppercase tracking-wider text-[#c8a45a] block mt-0.5">
                            {jugador.raza} · {jugador.clase}
                        </span>
                    </div>

                    <div className="px-2 py-0.5 rounded-full bg-[#7b1f1f] border border-[#c8a45a]/60 text-[10px] font-cinzel font-bold text-amber-100 shadow-sm">
                        Nivel {jugador.nivel || 1}
                    </div>
                </div>

                {/* Medallones de CA y PV */}
                <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-3">
                        <Medallon
                            valor={hpActual}
                            etiqueta="Puntos de Vida"
                            icono={Heart}
                            size="small"
                        />
                        <Medallon
                            valor={ca}
                            etiqueta="Armadura"
                            icono={Shield}
                            size="small"
                        />
                    </div>

                    {/* Barra de vida en estilo lacre / tinta */}
                    <div className="flex-1 max-w-[120px]">
                        <div className="flex justify-between text-[9px] font-cinzel text-amber-200/80 mb-1 font-bold">
                            <span>Vida</span>
                            <span>{hpActual}/{hpMax}</span>
                        </div>
                        <div className="w-full bg-[#120a07] h-2.5 rounded-full border border-[#8a6a3e]/60 overflow-hidden shadow-inner p-[1px]">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${
                                    porcentajeHp > 50
                                        ? 'bg-gradient-to-r from-emerald-700 to-emerald-500'
                                        : porcentajeHp > 25
                                            ? 'bg-gradient-to-r from-amber-700 to-amber-500'
                                            : 'bg-gradient-to-r from-red-800 to-red-600 animate-pulse'
                                }`}
                                style={{ width: `${porcentajeHp}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Inventario resumido o condiciones si las hay */}
                {jugador.inventario && jugador.inventario.length > 0 && (
                    <div className="pt-2 border-t border-[#8a6a3e]/30 flex items-center gap-1.5 text-[10px] text-amber-200/70 font-garamond truncate">
                        <span className="text-[#c8a45a] font-cinzel font-bold text-[9px] uppercase">Equipo:</span>
                        <span className="truncate italic">{jugador.inventario.join(', ')}</span>
                    </div>
                )}
            </div>
        </div>
    );
};
