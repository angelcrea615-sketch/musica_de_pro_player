const fs = require('fs');
const path = 'data/canciones_listado.json';

// Cargar el archivo
const rawData = fs.readFileSync(path, 'utf8');
const data = JSON.parse(rawData);

function limpiarTexto(texto) {
    if (!texto) return "";
    return texto.replace(/\.(mp3|wav|flac|m4a|aac|ogg|webm)$/i, "").trim();
}

function procesarItem(item) {
    if (typeof item === 'string') {
        const nombreBase = limpiarTexto(item.split('/').pop());
        let artista = "Artista desconocido";
        let titulo = nombreBase;

        if (nombreBase.includes(" - ")) {
            [artista, titulo] = nombreBase.split(" - ");
        } else if (nombreBase.includes("-")) {
            [titulo, artista] = nombreBase.split("-");
        }

        return { archivo_github: item, artista: artista.trim(), titulo: titulo.trim() };
    } 
    
    if (typeof item === 'object') {
        const archivo = item.archivo_github || item.path || item.url_final || "";
        const nombreBase = limpiarTexto(archivo.split('/').pop() || item.titulo || "");
        
        let artista = item.artista || "";
        let titulo = item.titulo || "";

        if ((!artista || artista === 'Artista desconocido' || artista === 'YouTube') && nombreBase.includes(" - ")) {
            [artista, titulo] = nombreBase.split(" - ");
        }

        return {
            ...item,
            titulo: titulo || 'Sin título',
            artista: artista || 'Artista desconocido',
            archivo_github: archivo
        };
    }
    return item;
}

// Procesar según sea array u objeto
const catalogoLimpio = Array.isArray(data) ? data.map(procesarItem) : Object.fromEntries(Object.entries(data).map(([k, v]) => [k, procesarItem(v)]));

// Guardar
fs.writeFileSync(path, JSON.stringify(catalogoLimpio, null, 2), 'utf8');
console.log("¡Catálogo limpiado con Node.js!");
