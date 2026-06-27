/**
 * Utility functions for client-side image processing.
 */

/**
 * Format bytes into readable file size strings (e.g. 1.2 MB)
 * @param {number} bytes 
 * @param {number} decimals 
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Load a File object and return a Promise resolving to a Data URL (base64)
 * @param {File} file 
 * @returns {Promise<string>}
 */
export function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
}

/**
 * Load an image from a source URL/URI and return an HTMLImageElement
 * @param {string} src 
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = src;
    });
}

/**
 * Create an active download in the browser for a blob or dataURL
 * @param {Blob|string} content - Blob object or Data URL string
 * @param {string} filename - Output name
 */
export function downloadFile(content, filename) {
    const isBlob = content instanceof Blob;
    const url = isBlob ? URL.createObjectURL(content) : content;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (isBlob) {
        // Delay revoking to ensure download triggers correctly in all browsers
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
}

/**
 * Convert a canvas to a Blob with target MIME type and quality settings
 * @param {HTMLCanvasElement} canvas 
 * @param {string} mimeType 
 * @param {number} quality - Range 0 to 1
 * @returns {Promise<Blob>}
 */
export function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, mimeType, quality);
    });
}
