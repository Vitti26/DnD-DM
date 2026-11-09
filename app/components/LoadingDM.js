"use client";
import { Sparkles } from 'lucide-react';
import { VitralDM } from './ui/VitralDM';

export function LoadingDM({ mensaje = "El Dungeon Master está consultando los grimorios arcanos..." }) {
    return (
        <div className="flex items-center gap-4 p-4 my-2 rounded-xl bg-[#e3d0ab]/30 border border-[#8a6a3e]/30 backdrop-blur-sm shadow-inner max-w-xl animate-pulse">
            <div className="shrink-0 scale-75 -my-2 -ml-2">
                <VitralDM pensando={true} />
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-1.5 text-xs font-cinzel font-bold text-[#7b1f1f] uppercase tracking-wider mb-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#c8a45a] animate-spin" />
                    <span>Invocación en curso</span>
                </div>
                <p className="font-garamond italic text-sm text-[#3d2716]">
                    {mensaje}
                </p>
            </div>
        </div>
    );
}
