import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useGameStore = create(
    persist(
        (set) => ({
            idioma: 'es',
            jugadores: [],
            historial: [],
            enCombate: false,
            turnoIndex: 0,

            setIdioma: (lang) => set({ idioma: lang }),
            setJugadores: (lista) => set({ jugadores: lista }),
            setHistorial: (history) => set({ historial: history }),
            setEnCombate: (estado) => set({ enCombate: estado }),
            setTurnoIndex: (index) => set({ turnoIndex: index }),

            addMensaje: (msg) => set((state) => ({
                historial: [...state.historial, msg]
            })),
            resetGame: () => set({ jugadores: [], historial: [], idioma: 'es', enCombate: false, turnoIndex: 0 }),
        }),
        { name: 'dnd-session-cache' } // Nombre de la "caché"
    )
);