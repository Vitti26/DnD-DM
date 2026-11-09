import './globals.css';
import { Cinzel, EB_Garamond } from 'next/font/google';

const cinzel = Cinzel({
    subsets: ['latin'],
    variable: '--font-cinzel',
    display: 'swap',
});

const ebGaramond = EB_Garamond({
    subsets: ['latin'],
    variable: '--font-garamond',
    display: 'swap',
});

export const metadata = {
    title: 'Mesa Arcana — Dungeon Master con IA',
    description: 'Crónicas y partidas de D&D 5e narradas en tiempo real por un Dungeon Master de IA',
};

export default function RootLayout({ children }) {
    return (
        <html lang="es" className={`${cinzel.variable} ${ebGaramond.variable}`}>
            <body className="bg-slate-950 text-slate-100 font-garamond antialiased selection:bg-amber-800 selection:text-amber-100">
                {children}
            </body>
        </html>
    );
}
