// app/layout.js
import './globals.css';

export const metadata = {
    title: 'D&D AI Master',
    description: 'Tu Dungeon Master personal con IA',
}

export default function RootLayout({ children }) {
    return (
        <html lang="es">
            <body>
                {children}
            </body>
        </html>
    )
}