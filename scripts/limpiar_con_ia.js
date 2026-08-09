const fs = require('fs');

async function corregirConIA(cancion, apiKey) {
    const textoAnalizar = cancion.titulo || cancion.archivo_github || "";
    
    const prompt = `Analiza este texto de una canción de música: "${textoAnalizar}". 
    Separa correctamente el Título y el Artista real. 
    Si no hay un artista claro, deduce el artista por el nombre o pon "Artista desconocido". 
    Responde ÚNICAMENTE con un JSON estricto con este formato exacto, sin texto adicional: {"titulo": "...", "artista": "..."}`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        const result = await response.json();
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) return null;

        // Limpiamos formato markdown si la IA responde con ```json ... ```
        const jsonString = text.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("Error al conectar con Gemini:", e.message);
        return null;
    }
}

async function run() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No se encontró la GEMINI_API_KEY en las variables de entorno.");
        process.exit(1);
    }

    const pathArchivo = 'data/canciones_listado.json';
    if (!fs.existsSync(pathArchivo)) {
        console.error(`No se encontró el archivo en ${pathArchivo}`);
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(pathArchivo, 'utf8'));
    console.log(`Iniciando procesamiento de ${data.length} canciones con IA...`);

    for (let i = 0; i < data.length; i++) {
        let cancion = data[i];
        
        // Procesamos todas las canciones que no tengan artista o cuyo título parezca un archivo crudo/desordenado
        console.log(`[${i + 1}/${data.length}] Analizando: "${cancion.titulo}"`);
        
        const resultadoIA = await corregirConIA(cancion, apiKey);
        
        if (resultadoIA && resultadoIA.titulo && resultadoIA.artista) {
            data[i].titulo = resultadoIA.titulo;
            data[i].artista = resultadoIA.artista; // ¡Aquí se añade o actualiza el campo artista!
            console.log(`✅ Actualizado -> Artista: "${resultadoIA.artista}" | Título: "${resultadoIA.titulo}"`);
        } else {
            console.log(`⚠️ No se pudo procesar esta canción, se mantiene igual.`);
        }

        // Pequeña pausa de 1 segundo para no saturar los límites de la API gratuita de Gemini
        await new Promise(r => setTimeout(r, 1000));
    }

    fs.writeFileSync(pathArchivo, JSON.stringify(data, null, 2), 'utf8');
    console.log("🎉 ¡Proceso de limpieza con IA finalizado y guardado con éxito!");
}

run();
