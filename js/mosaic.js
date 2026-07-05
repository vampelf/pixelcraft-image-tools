import { loadImage, canvasToBlob, fileToDataURL, formatBytes, downloadFile } from './utils.js';

export class ImageMosaic {
    constructor() {
        this.originalImage = null;
        this.originalFileName = '';
        
        // Settings
        this.gridSize = 15;
        this.brushRadius = 30;
        
        // Dimension
        this.displayWidth = 0;
        this.displayHeight = 0;
        
        // Drawing state
        this.isPainting = false;
        
        // Canvas Layers
        // 1. Visible Screen Canvas
        this.canvas = document.getElementById('mosaic-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 2. Offscreen original scaled clean image
        this.cleanCanvas = document.createElement('canvas');
        this.cleanCtx = this.cleanCanvas.getContext('2d');
        
        // 3. Offscreen pixelated image
        this.pixelatedCanvas = document.createElement('canvas');
        this.pixelatedCtx = this.pixelatedCanvas.getContext('2d');
        
        // 4. Offscreen drawing mask (black/white where painted)
        this.maskCanvas = document.createElement('canvas');
        this.maskCtx = this.maskCanvas.getContext('2d');
        
        // DOM Elements
        this.dropzone = document.getElementById('mosaic-dropzone');
        this.fileInput = document.getElementById('mosaic-file-input');
        this.workspace = document.getElementById('mosaic-workspace');
        
        this.gridSlider = document.getElementById('mosaic-size');
        this.gridVal = document.getElementById('mosaic-size-val');
        this.brushSlider = document.getElementById('mosaic-brush-radius');
        this.brushVal = document.getElementById('mosaic-brush-radius-val');
        
        this.btnSave = document.getElementById('btn-mosaic-save');
        this.btnReset = document.getElementById('btn-mosaic-reset');
        this.brushIndicator = document.getElementById('brush-indicator');
        this.canvasContainer = document.getElementById('mosaic-canvas-container');
        
        this.initEvents();
    }

    initEvents() {
        // Drag/Drop
        ['dragenter', 'dragover'].forEach(eventName => {
            this.dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                this.dropzone.classList.add('dragover');
            }, false);
        });
        ['dragleave', 'drop'].forEach(eventName => {
            this.dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                this.dropzone.classList.remove('dragover');
            }, false);
        });
        this.dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt.files.length > 0) this.handleFile(dt.files[0]);
        });
        this.dropzone.addEventListener('click', (e) => {
            if (e.target !== this.fileInput) {
                this.fileInput.click();
            }
        });
        this.fileInput.addEventListener('click', (e) => e.stopPropagation());
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) this.handleFile(e.target.files[0]);
        });

        // Sliders
        this.gridSlider.addEventListener('input', (e) => {
            this.gridSize = parseInt(e.target.value);
            this.gridVal.textContent = `${this.gridSize}px`;
            if (this.originalImage) {
                this.generatePixelatedImage();
                this.composeOutput();
            }
        });
        this.brushSlider.addEventListener('input', (e) => {
            this.brushRadius = parseInt(e.target.value);
            this.brushVal.textContent = `${this.brushRadius}px`;
            this.updateBrushIndicatorSize();
        });

        // Actions
        this.btnReset.addEventListener('click', () => this.resetMask());
        this.btnSave.addEventListener('click', () => this.saveImage());

        // Mouse Drawing Events on Visible Canvas
        this.canvas.addEventListener('mousedown', (e) => this.startPaint(e.clientX, e.clientY));
        window.addEventListener('mousemove', (e) => this.paintMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', () => this.stopPaint());

        // Touch Drawing Events on Visible Canvas
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                this.startPaint(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });
        window.addEventListener('touchmove', (e) => {
            if (this.isPainting && e.touches.length === 1) {
                e.preventDefault();
                this.paintMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });
        window.addEventListener('touchend', () => this.stopPaint());

        // Hover brush indicator inside canvas container
        this.canvas.addEventListener('mouseenter', () => {
            if (this.originalImage) this.brushIndicator.style.display = 'block';
        });
        this.canvas.addEventListener('mouseleave', () => {
            this.brushIndicator.style.display = 'none';
        });
    }

    async handleFile(file) {
        if (!file.type.startsWith('image/')) return;
        this.originalFileName = file.name;

        try {
            const url = await fileToDataURL(file);
            this.originalImage = await loadImage(url);
            
            this.dropzone.classList.add('hidden');
            this.workspace.classList.remove('hidden');
            
            this.setupCanvases();
        } catch (err) {
            console.error('Failed to load image for mosaic: ', err);
        }
    }

    setupCanvases() {
        const origW = this.originalImage.naturalWidth;
        const origH = this.originalImage.naturalHeight;
        
        // Fitting size inside display container
        const maxDisplayW = Math.min(this.canvasContainer.clientWidth - 40, 800);
        const maxDisplayH = 480;
        
        let dW = origW;
        let dH = origH;
        
        if (dW > maxDisplayW) {
            dH = (maxDisplayW / dW) * dH;
            dW = maxDisplayW;
        }
        if (dH > maxDisplayH) {
            dW = (maxDisplayH / dH) * dW;
            dH = maxDisplayH;
        }
        
        this.displayWidth = Math.round(dW);
        this.displayHeight = Math.round(dH);
        
        // Setup screen canvas
        this.canvas.width = this.displayWidth;
        this.canvas.height = this.displayHeight;
        
        // Setup clean image cache canvas
        this.cleanCanvas.width = this.displayWidth;
        this.cleanCanvas.height = this.displayHeight;
        this.cleanCtx.drawImage(this.originalImage, 0, 0, this.displayWidth, this.displayHeight);
        
        // Setup mask canvas
        this.maskCanvas.width = this.displayWidth;
        this.maskCanvas.height = this.displayHeight;
        this.resetMask();
        
        // Setup pixelated Canvas
        this.pixelatedCanvas.width = this.displayWidth;
        this.pixelatedCanvas.height = this.displayHeight;
        this.generatePixelatedImage();
        
        this.updateBrushIndicatorSize();
        this.composeOutput();
    }

    generatePixelatedImage() {
        const w = this.displayWidth;
        const h = this.displayHeight;
        const pSize = this.gridSize;
        
        // 1. Draw scaled down version of clean canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = Math.max(1, Math.round(w / pSize));
        tempCanvas.height = Math.max(1, Math.round(h / pSize));
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.cleanCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
        
        // 2. Draw scaled up back to pixelatedCanvas context
        this.pixelatedCtx.clearRect(0, 0, w, h);
        this.pixelatedCtx.imageSmoothingEnabled = false;
        this.pixelatedCtx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, w, h);
    }

    resetMask() {
        this.maskCtx.fillStyle = 'rgba(0,0,0,0)';
        this.maskCtx.clearRect(0, 0, this.displayWidth, this.displayHeight);
        
        if (this.originalImage) {
            this.composeOutput();
        }
    }

    composeOutput() {
        if (!this.originalImage) return;
        // Draw clean image onto visible canvas
        this.ctx.clearRect(0, 0, this.displayWidth, this.displayHeight);
        this.ctx.drawImage(this.cleanCanvas, 0, 0);
        
        // Mask the pixelated image onto visible canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.displayWidth;
        tempCanvas.height = this.displayHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw pixelated image first
        tempCtx.drawImage(this.pixelatedCanvas, 0, 0);
        
        // Composite mask (keep only painted parts)
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(this.maskCanvas, 0, 0);
        
        // Overlay onto visible canvas
        this.ctx.drawImage(tempCanvas, 0, 0);
    }

    updateBrushIndicatorSize() {
        if (!this.canvas) return;
        
        // Adjust for css vs physical pixel scaling ratio
        const rect = this.canvas.getBoundingClientRect();
        const ratio = rect.width / this.displayWidth;
        const size = this.brushRadius * 2 * ratio;
        
        this.brushIndicator.style.width = `${size}px`;
        this.brushIndicator.style.height = `${size}px`;
    }

    getCanvasCoordinates(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left) * (this.displayWidth / rect.width),
            y: (clientY - rect.top) * (this.displayHeight / rect.height)
        };
    }

    startPaint(clientX, clientY) {
        if (!this.originalImage) return;
        this.isPainting = true;
        this.paint(clientX, clientY);
    }

    paintMove(clientX, clientY) {
        // Position brush indicator element
        const rect = this.canvas.getBoundingClientRect();
        
        // Position relative to canvas container
        const containerRect = this.canvasContainer.getBoundingClientRect();
        const left = clientX - containerRect.left;
        const top = clientY - containerRect.top;
        
        this.brushIndicator.style.left = `${left}px`;
        this.brushIndicator.style.top = `${top}px`;
        
        if (this.isPainting) {
            this.paint(clientX, clientY);
        }
    }

    stopPaint() {
        this.isPainting = false;
    }

    paint(clientX, clientY) {
        const coords = this.getCanvasCoordinates(clientX, clientY);
        
        this.maskCtx.save();
        this.maskCtx.fillStyle = '#ffffff';
        this.maskCtx.beginPath();
        this.maskCtx.arc(coords.x, coords.y, this.brushRadius, 0, Math.PI * 2);
        this.maskCtx.fill();
        this.maskCtx.restore();
        
        this.composeOutput();
    }

    async saveImage() {
        if (!this.originalImage) return;

        const origW = this.originalImage.naturalWidth;
        const origH = this.originalImage.naturalHeight;
        
        // 1. Create a full resolution clean canvas
        const fullCleanCanvas = document.createElement('canvas');
        fullCleanCanvas.width = origW;
        fullCleanCanvas.height = origH;
        const cleanCtx = fullCleanCanvas.getContext('2d');
        cleanCtx.drawImage(this.originalImage, 0, 0);

        // 2. Create a full resolution pixelated canvas
        const fullPixelCanvas = document.createElement('canvas');
        fullPixelCanvas.width = origW;
        fullPixelCanvas.height = origH;
        const pixelCtx = fullPixelCanvas.getContext('2d');
        
        // Map grid size proportional to full resolution
        const scaleProportion = origW / this.displayWidth;
        const fullGridSize = Math.max(1, Math.round(this.gridSize * scaleProportion));
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = Math.max(1, Math.round(origW / fullGridSize));
        tempCanvas.height = Math.max(1, Math.round(origH / fullGridSize));
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.originalImage, 0, 0, tempCanvas.width, tempCanvas.height);
        
        pixelCtx.imageSmoothingEnabled = false;
        pixelCtx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, origW, origH);

        // 3. Create a full resolution mask canvas
        const fullMaskCanvas = document.createElement('canvas');
        fullMaskCanvas.width = origW;
        fullMaskCanvas.height = origH;
        const maskCtx = fullMaskCanvas.getContext('2d');
        
        // Draw the scaled-up mask
        maskCtx.drawImage(this.maskCanvas, 0, 0, origW, origH);

        // 4. Composite them on a final output canvas
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = origW;
        outputCanvas.height = origH;
        const outCtx = outputCanvas.getContext('2d');
        
        // Draw full resolution original
        outCtx.drawImage(fullCleanCanvas, 0, 0);
        
        // Draw masked pixelation
        const tempCompose = document.createElement('canvas');
        tempCompose.width = origW;
        tempCompose.height = origH;
        const tempComposeCtx = tempCompose.getContext('2d');
        
        tempComposeCtx.drawImage(fullPixelCanvas, 0, 0);
        tempComposeCtx.globalCompositeOperation = 'destination-in';
        tempComposeCtx.drawImage(fullMaskCanvas, 0, 0);
        
        outCtx.drawImage(tempCompose, 0, 0);

        // 5. Download
        const blob = await canvasToBlob(outputCanvas, 'image/png');
        const baseName = this.originalFileName.slice(0, this.originalFileName.lastIndexOf('.')) || this.originalFileName;
        downloadFile(blob, `${baseName}_mosaic.png`);
    }
}
