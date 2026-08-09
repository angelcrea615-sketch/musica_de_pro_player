const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

async function run() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ ERROR: No se encontró la GEMINI_API_KEY en los Secrets de GitHub.");
        process.exit(1);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const pathArchivo = 'data/canciones_listado.json';
    if (!fs.existsSync(pathArchivo)) {
        console.error(`❌ ERROR: No se encontró el archivo en ${pathArchivo}`);
        process.exit(1);
    }

    let data;
    try {
        const contenido = fs.readFileSync(pathArchivo, 'utf8');
        data = JSON.parse(contenido);
    } catch (e) {
        console.error(`❌ ERROR CRÍTICO: El archivo JSON tiene un error de sintaxis. Detalle:`, e.message);
        process.exit(1);
    }

    console.log(`🚀 Iniciando procesamiento de ${data.length} canciones con Gemini 2.0 Flash (con pausa de seguridad)...`);

    let cambiosRealizados = false;

    for (let i = 0; i < data.length; i++) {
        let cancion = data[i];
        const textoAnalizar = cancion.titulo || cancion.archivo_github || "";
        
        console.log(`\n[${i + 1}/${data.length}] Analizando: "${textoAnalizar}"`);
        
        const prompt = `Analiza este texto de una canción: "${textoAnalizar}". 
        Separa correctamente el Título y el Artista real. 
        Si no hay un artista claro, pon "Artista desconocido". 
        Responde ÚNICAMENTE con un JSON estricto con este formato exacto, sin texto adicional: {"titulo": "...", "artista": "..."}`;

        let intentos = 0;
        let exito = false;

        while (intentos < 3 && !exito) {
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
                exito = true;
            } catch (e) {
                intentos++;
                console.warn(`⚠️ Intento ${intentos} fallido (${e.message}). Reintentando en 10 segundos...`);
                await new Promise(r => setTimeout(r, 10000));
            }
        }

        // Pausa de 6 segundos entre cada canción para respetar el límite de 10 peticiones por minuto de la capa gratuita
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
