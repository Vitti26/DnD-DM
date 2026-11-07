"use client";

// Input numérico que confirma al salir del campo o pulsar Enter (evita reordenar mientras escribes).
export function NumInput({ value, onCommit, className = '', min, max, title }) {
    const commit = (e) => {
        let n = parseInt(e.target.value, 10);
        if (!Number.isFinite(n)) { e.target.value = value; return; }
        if (min !== undefined) n = Math.max(min, n);
        if (max !== undefined) n = Math.min(max, n);
        if (n !== value) onCommit(n);
        else e.target.value = value;
    };
    return (
        <input
            key={value}
            type="number"
            defaultValue={value}
            title={title}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            className={`bg-slate-950/60 border border-slate-700 rounded-md text-center font-mono outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${className}`}
        />
    );
}
