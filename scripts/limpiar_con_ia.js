const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

async function run() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ ERROR: No se encontró la GEMINI_API_KEY en los Secrets de GitHub.");
        process.exit(1);
    }

    // Usamos 'gemini-pro' que es compatible con cualquier clave de Google AI Studio
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const pathArchivo = 'data/canciones_listado.json';
    if (!fs.existsSync(pathArchivo)) {
        console.error(`❌ ERROR: No se encontró el archivo en ${pathArchivo}`);
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(pathArchivo, 'utf8'));
    console.log(`🚀 Iniciando procesamiento de ${data.length} canciones con Gemini Pro...`);

    let cambiosRealizados = false;

    for (let i = 0; i < data.length; i++) {
        let cancion = data[i];
        const textoAnalizar = cancion.titulo || cancion.archivo_github || "";
        
        console.log(`\n[${i + 1}/${data.length}] Analizando: "${textoAnalizar}"`);
        
        const prompt = `Analiza este texto de una canción: "${textoAnalizar}". 
        Separa correctamente el Título y el Artista real. 
        Si no hay un artista claro, pon "Artista desconocido". 
        Responde ÚNICAMENTE con un JSON estricto con este formato exacto, sin texto adicional: {"titulo": "...", "artista": "..."}`;

        try {
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            
            const jsonString = responseText.replace(/```json|```/g, '').trim();
            const resultadoIA = JSON.parse(jsonString);

            if (resultadoIA && resultadoIA.titulo && resultadoIA.artista) {
                data[i].titulo = resultadoIA.titulo;
                data[i].artista = resultadoIA.artista;
                cambiosRealizados = true;
                console.log(`✅ Éxito -> Artista: "${resultadoIA.artista}" | Título: "${resultadoIA.titulo}"`);
            } else {
                console.log(`⚠️ Respuesta vacía o inválida de la IA.`);
            }
        } catch (e) {
            console.error(`❌ Error procesando canción:`, e.message);
        }

        // Pausa de 1 segundo para cuidar los límites de la API
        await new Promise(r => setTimeout(r, 1000));
    }

    if (cambiosRealizados) {
        fs.writeFileSync(pathArchivo, JSON.stringify(data, null, 2), 'utf8');
        console.log("\n🎉 ¡Archivo guardado con los cambios de la IA!");
    } else {
        console.log("\n⚠️ No se realizó ningún cambio en el archivo.");
    }
}

run();
