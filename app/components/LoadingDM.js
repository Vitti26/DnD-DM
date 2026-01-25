import { ScrollText } from 'lucide-react';

export const LoadingDM = () => (
    <div className="flex items-center gap-2 p-4 italic text-slate-600 animate-pulse">
        <ScrollText className="animate-bounce" size={18} />
        <span>El Maestro está consultando los antiguos tomos...</span>
    </div>
);
