const fs = require('fs');

async function corregirConIA(cancion, apiKey) {
    const prompt = `Analiza este nombre de archivo de música: "${cancion.archivo_github || cancion.titulo}". 
    Extrae el Título y el Artista real. Si el artista no es claro, pon "Desconocido". 
    Responde ÚNICAMENTE en formato JSON: {"titulo": "...", "artista": "..."}`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const result = await response.json();
        const text = result.candidates[0].content.parts[0].text;
        // Limpiamos el markdown de la respuesta si lo trae
        return JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch (e) {
        return { titulo: cancion.titulo, artista: cancion.artista }; // fallback si falla
    }
}

async function run() {
    const apiKey = process.env.GEMINI_API_KEY;
    const path = 'data/canciones_listado.json';
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));

    // Procesamos uno a uno (o por lotes si tienes muchísimos)
    for (let i = 0; i < data.length; i++) {
        // Solo procesamos si está "sucio" o sin artista claro
        if (data[i].artista === "Artista desconocido" || data[i].artista === "") {
            console.log(`Procesando con IA: ${data[i].titulo}`);
            const corregido = await corregirConIA(data[i], apiKey);
            data[i].titulo = corregido.titulo;
            data[i].artista = corregido.artista;
            // Delay para no saturar la API
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
}

run();
