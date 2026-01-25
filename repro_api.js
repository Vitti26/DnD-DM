// Native fetch used

async function testApi() {
    try {
        const response = await fetch('http://localhost:3001/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mensaje: "Hola Master",
                jugadores: [],
                idioma: "es",
                historial: []
            })
        });

        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error("Response body:", text);
            return;
        }

        const data = await response.json();
        console.log("Success:", data);
    } catch (err) {
        console.error("Fetch error:", err);
    }
}

testApi();
