const fs = require('fs');

async function obtenerModeloValido(apiKey) {
    try {
        console.log("🔍 Consultando modelos disponibles para tu API Key...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        
        if (data && data.models) {
            const modelo = data.models.find(m => 
                m.supportedGenerationMethods && 
                m.supportedGenerationMethods.includes("generateContent")
            );
            if (modelo) {
                console.log(`✅ Modelo detectado y seleccionado automáticamente: ${modelo.name}`);
                return modelo.name;
            }
        }
    } catch (e) {
        console.warn("⚠️ No se pudo listar automáticamente, usando respaldo v1beta.");
    }
    return "models/gemini-1.5-flash";
}

async function enviarPrompt(prompt, apiKey, nombreModelo, usarBusquedaWeb = false) {
    let intentos = 0;
    while (intentos < 3) {
        try {
            const bodyPayload = {
                contents: [{ parts: [{ text: prompt }] }]
            };

            // Si se requiere búsqueda profunda, activamos el buscador web (Grounding) de Gemini
            if (usarBusquedaWeb) {
                bodyPayload.tools = [{ googleSearch: {} }];
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${nombreModelo}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload)
            });
            
            const result = await response.json();

            if (!response.ok) {
                intentos++;
                await new Promise(r => setTimeout(r, 8000));
                continue;
            }

            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                intentos++;
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }

            const jsonString = text.replace(/```json|```/g, '').trim();
            return JSON.parse(jsonString);
        } catch (e) {
            intentos++;
            await new Promise(r => setTimeout(r, 8000));
        }
    }
    return null;
}

async function corregirConIA(cancion, apiKey, nombreModelo) {
    const textoAnalizar = cancion.titulo || cancion.archivo_github || "";
    
    // Primer intento: Análisis lógico directo local
    const prompt1 = `Analiza este texto de una canción: "${textoAnalizar}". 
    Separa correctamente el Título y el Artista real. Si el texto tiene formato como "Artista - Título", úsalo. 
    Si no hay un artista claro, pon "Artista desconocido". 
    Responde ÚNICAMENTE con un JSON estricto con este formato exacto, sin texto adicional: {"titulo": "...", "artista": "..."}`;

    let resultado = await enviarPrompt(prompt1, apiKey, nombreModelo, false);

    // SEGUNDO INTENTO: Si el artista es desconocido o vacío, buscamos activamente en YouTube Music / Internet usando Google Search Grounding
    const esDesconocido = !resultado || !resultado.artista || resultado.artista.toLowerCase().includes("desconocido") || resultado.artista.trim() === "";
    
    if (esDesconocido) {
        console.log(`   🌐 Artista no detectado. Buscando en YouTube Music e internet...`);
        
        const prompt2 = `Busca información en internet y YouTube Music sobre esta canción o archivo: "${textoAnalizar}". 
        Encuentra el nombre real de la canción (Título) y el artista o intérprete oficial.
        Responde ÚNICAMENTE con un JSON estricto, sin texto adicional: {"titulo": "...", "artista": "..."}`;
        
        const resultadoBusqueda = await enviarPrompt(prompt2, apiKey, nombreModelo, true);
        if (resultadoBusqueda && resultadoBusqueda.artista && !resultadoBusqueda.artista.toLowerCase().includes("desconocido")) {
            resultado = resultadoBusqueda;
        }
    }
    
    return resultado;
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

    const nombreModelo = await obtenerModeloValido(apiKey);
    console.log(`🚀 Iniciando procesamiento de ${data.length} canciones con búsqueda web de respaldo...`);

    let cambiosRealizados = false;

    for (let i = 0; i < data.length; i++) {
        let cancion = data[i];
        const textoAnalizar = cancion.titulo || cancion.archivo_github || "";
        
        console.log(`\n[${i + 1}/${data.length}] Analizando: "${textoAnalizar}"`);
        
        const resultadoIA = await corregirConIA(cancion, apiKey, nombreModelo);
        
        if (resultadoIA && resultadoIA.titulo && resultadoIA.artista) {
            data[i].titulo = resultadoIA.titulo;
            data[i].artista = resultadoIA.artista;
            cambiosRealizados = true;
            console.log(`✅ Éxito -> Artista: "${resultadoIA.artista}" | Título: "${resultadoIA.titulo}"`);
        } else {
            console.log(`⚠️ Se mantuvo el texto original al no encontrar coincidencias.`);
        }

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
