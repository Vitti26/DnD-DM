import { ICONOS_CLASE } from './Icons';

export const PlayerCard = ({ jugador }) => (
    <div className="group relative bg-slate-900/90 text-white p-4 rounded-xl border border-slate-700 shadow-xl overflow-hidden transition-all hover:scale-[1.02]">
        {/* Fondo decorativo sutil */}
        <div className="absolute top-0 right-0 opacity-10 p-2">
            {ICONOS_CLASE[jugador.clase]}
        </div>

        <div className="relative z-10 flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg shadow-inner border border-slate-600">
                {ICONOS_CLASE[jugador.clase]}
            </div>

            <div className="flex-1">
                <div className="flex justify-between items-end">
                    <h3 className="font-bold text-lg tracking-tight">{jugador.nombre}</h3>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">LVL {jugador.nivel}</span>
                </div>

                {/* Barra de vida con "Glow" (Brillo) */}
                <div className="w-full bg-slate-800 h-3 rounded-full mt-1 border border-slate-700 overflow-hidden">
                    <div
                        className={`h-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(34,197,94,0.3)] ${jugador.hp > 10 ? 'bg-green-500' : 'bg-red-600'
                            }`}
                        style={{ width: `${(jugador.hp / 20) * 100}%` }}
                    />
                </div>
                <div className="flex justify-between mt-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{jugador.raza} {jugador.clase}</p>
                    <span className="text-xs font-mono font-bold">{jugador.hp} / 20 HP</span>
                </div>
            </div>
        </div>
    </div>
);
