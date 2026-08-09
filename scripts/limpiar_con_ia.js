const fs = require('fs');

async function corregirConIA(cancion, apiKey) {
    const textoAnalizar = cancion.titulo || cancion.archivo_github || "";
    
    const prompt = `Analiza este texto de una canción: "${textoAnalizar}". 
    Separa correctamente el Título y el Artista real. 
    Si no hay un artista claro, pon "Artista desconocido". 
    Responde ÚNICAMENTE con un JSON estricto con este formato exacto, sin texto adicional: {"titulo": "...", "artista": "..."}`;

    let intentos = 0;
    while (intentos < 3) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            
            const result = await response.json();

            if (!response.ok) {
                console.warn(`⚠️ Intento ${intentos + 1} - Error de API:`, result?.error?.message || response.statusText);
                intentos++;
                await new Promise(r => setTimeout(r, 10000));
                continue;
            }

            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                console.warn(`⚠️ Intento ${intentos + 1} - Respuesta vacía de la IA.`);
                intentos++;
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }

            const jsonString = text.replace(/```json|```/g, '').trim();
            return JSON.parse(jsonString);
        } catch (e) {
            console.warn(`⚠️ Intento ${intentos + 1} - Error de red/JSON:`, e.message);
            intentos++;
            await new Promise(r => setTimeout(r, 10000));
        }
    }
    return null;
}

async function run() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ ERROR: No se encontró la GEMINI_API_KEY en los Secrets de GitHub.");
        process.exit(1);
    }

    const pathArchivo = 'data/canciones_listado.json';
    if (!fs.existsSync(pathArchivo)) {
        console.error(`❌ ERROR: No se encontró el archivo en ${pathArchivo}`);
        process.exit(1);
    }

    let data;
    try {
        data = JSON.parse(fs.readFileSync(pathArchivo, 'utf8'));
    } catch (e) {
        console.error(`❌ ERROR CRÍTICO: El archivo JSON está corrupto. Detalle:`, e.message);
        process.exit(1);
    }

    console.log(`🚀 Iniciando procesamiento de ${data.length} canciones con Gemini 1.5 Flash (v1 directo)...`);

    let cambiosRealizados = false;

    for (let i = 0; i < data.length; i++) {
        let cancion = data[i];
        const textoAnalizar = cancion.titulo || cancion.archivo_github || "";
        
        console.log(`\n[${i + 1}/${data.length}] Analizando: "${textoAnalizar}"`);
        
        const resultadoIA = await corregirConIA(cancion, apiKey);
        
        if (resultadoIA && resultadoIA.titulo && resultadoIA.artista) {
            data[i].titulo = resultadoIA.titulo;
            data[i].artista = resultadoIA.artista;
            cambiosRealizados = true;
            console.log(`✅ Éxito -> Artista: "${resultadoIA.artista}" | Título: "${resultadoIA.titulo}"`);
        } else {
            console.log(`⚠️ Se omitió esta canción tras varios reintentos.`);
        }

        // Pausa de 6 segundos para respetar el límite gratuito de la API
        await new Promise(r => setTimeout(r, 6000));
    }

    if (cambiosRealizados) {
        fs.writeFileSync(pathArchivo, JSON.stringify(data, null, 2), 'utf8');
        console.log("\n🎉 ¡Archivo guardado con los cambios de la IA!");
    } else {
        console.log("\n⚠️ No se realizó ningún cambio en el archivo.");
    }
}

run();
