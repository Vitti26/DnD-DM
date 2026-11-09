"use client";
import { VitralDM } from './ui/VitralDM';

export function LoadingDM({ mensaje = "El Dungeon Master está narrando la escena..." }) {
    return (
        <div className="flex items-center gap-3 p-3 my-2 rounded-xl bg-[#e3d0ab]/40 border border-[#8a6a3e]/40 shadow-inner max-w-md">
            <div className="shrink-0 scale-75 -my-2 -ml-2">
                <VitralDM pensando={true} />
            </div>
            <div className="flex-1">
                <p className="font-garamond italic text-sm text-[#3d2716] font-semibold">
                    {mensaje}
                </p>
            </div>
        </div>
    );
}
