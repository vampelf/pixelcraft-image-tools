import { loadImage, canvasToBlob, fileToDataURL, formatBytes, downloadFile } from './utils.js';
import { i18n } from './i18n.js';

export class ImageCropper {
    constructor() {
        this.originalImage = null;
        this.originalFileName = '';
        this.transformedCanvas = null; // Canvas with all rotations/flips applied at full res
        
        // Transform State
        this.rotation = 0; // 0, 90, 180, 270
        this.flipH = false;
        this.flipV = false;
        this.aspectRatio = 'free'; // 'free', '1:1', '4:3', '16:9'
        
        // Visible Sizes
        this.displayWidth = 0;
        this.displayHeight = 0;
        
        // Dom Elements
        this.dropzone = document.getElementById('crop-dropzone');
        this.fileInput = document.getElementById('crop-file-input');
        this.workspace = document.getElementById('crop-workspace');
        
        this.canvas = document.getElementById('crop-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById('crop-overlay');
        this.canvasContainer = document.getElementById('crop-canvas-container');
        
        // Dialog Elements
        this.dialogOverlay = document.getElementById('dialog-overlay');
        this.dialogImg = document.getElementById('dialog-preview-img');
        this.dialogStats = document.getElementById('dialog-stats-text');
        this.dialogDownload = document.getElementById('btn-dialog-download');
        this.dialogClose = document.getElementById('btn-dialog-close');
        this.dialogCancel = document.getElementById('btn-dialog-cancel');
        
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

        // Aspect ratio buttons
        const ratioBtns = document.querySelectorAll('[data-ratio]');
        ratioBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                ratioBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.aspectRatio = btn.getAttribute('data-ratio');
                this.resetCropOverlay();
            });
        });

        // Rotate & Flip buttons
        document.getElementById('btn-crop-rot-ccw').addEventListener('click', () => this.rotate(-90));
        document.getElementById('btn-crop-rot-cw').addEventListener('click', () => this.rotate(90));
        document.getElementById('btn-crop-flip-h').addEventListener('click', () => this.flip('horizontal'));
        document.getElementById('btn-crop-flip-v').addEventListener('click', () => this.flip('vertical'));
        
        // Execute crop
        document.getElementById('btn-crop-execute').addEventListener('click', () => this.cropImage());
        document.getElementById('btn-crop-reset').addEventListener('click', () => this.resetTransformations());
        
        // Dialog overlay close
        this.dialogClose.addEventListener('click', () => this.closeDialog());
        this.dialogCancel.addEventListener('click', () => this.closeDialog());

        // Setup Drag & Crop handles
        this.setupOverlayDragging();
    }

    async handleFile(file) {
        if (!file.type.startsWith('image/')) return;
        this.originalFileName = file.name;
        
        try {
            const url = await fileToDataURL(file);
            this.originalImage = await loadImage(url);
            
            this.dropzone.classList.add('hidden');
            this.workspace.classList.remove('hidden');
            
            this.resetTransformations();
        } catch (err) {
            console.error('Failed to load image for cropping: ', err);
        }
    }

    resetTransformations() {
        this.rotation = 0;
        this.flipH = false;
        this.flipV = false;
        this.applyTransforms();
    }

    rotate(degrees) {
        this.rotation = (this.rotation + degrees + 360) % 360;
        this.applyTransforms();
    }

    flip(dir) {
        if (dir === 'horizontal') this.flipH = !this.flipH;
        if (dir === 'vertical') this.flipV = !this.flipV;
        this.applyTransforms();
    }

    applyTransforms() {
        if (!this.originalImage) return;

        // 1. Compute full-res transformed canvas
        const origW = this.originalImage.naturalWidth;
        const origH = this.originalImage.naturalHeight;
        
        const isSwapped = this.rotation === 90 || this.rotation === 270;
        const canvasW = isSwapped ? origH : origW;
        const canvasH = isSwapped ? origW : origH;
        
        this.transformedCanvas = document.createElement('canvas');
        this.transformedCanvas.width = canvasW;
        this.transformedCanvas.height = canvasH;
        const ctx = this.transformedCanvas.getContext('2d');
        
        ctx.translate(canvasW / 2, canvasH / 2);
        
        // Apply rotation
        ctx.rotate((this.rotation * Math.PI) / 180);
        
        // Apply flip
        const scaleX = this.flipH ? -1 : 1;
        const scaleY = this.flipV ? -1 : 1;
        ctx.scale(scaleX, scaleY);
        
        ctx.drawImage(this.originalImage, -origW / 2, -origH / 2);

        // 2. Compute fitting size inside display container
        const maxDisplayW = Math.min(this.canvasContainer.clientWidth - 40, 800);
        const maxDisplayH = 480;
        
        let dW = canvasW;
        let dH = canvasH;
        
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
        
        // Resize screen canvas
        this.canvas.width = this.displayWidth;
        this.canvas.height = this.displayHeight;
        
        // Draw transformed onto screen canvas
        this.ctx.drawImage(this.transformedCanvas, 0, 0, this.displayWidth, this.displayHeight);
        
        this.resetCropOverlay();
    }

    resetCropOverlay() {
        // Set overlay bounds to match screen canvas
        this.overlay.style.display = 'block';
        
        let width = Math.min(this.displayWidth * 0.8, 300);
        let height = Math.min(this.displayHeight * 0.8, 300);
        
        if (this.aspectRatio === '1:1') {
            const size = Math.min(width, height);
            width = size;
            height = size;
        } else if (this.aspectRatio === '4:3') {
            if (width / 4 * 3 <= height) {
                height = (width / 4) * 3;
            } else {
                width = (height / 3) * 4;
            }
        } else if (this.aspectRatio === '16:9') {
            if (width / 16 * 9 <= height) {
                height = (width / 16) * 9;
            } else {
                width = (height / 9) * 16;
            }
        }
        
        width = Math.round(width);
        height = Math.round(height);
        
        const left = Math.round((this.displayWidth - width) / 2);
        const top = Math.round((this.displayHeight - height) / 2);
        
        this.overlay.style.left = `${left}px`;
        this.overlay.style.top = `${top}px`;
        this.overlay.style.width = `${width}px`;
        this.overlay.style.height = `${height}px`;
    }

    setupOverlayDragging() {
        let isDragging = false;
        let activeHandle = null;
        let startX, startY;
        let startLeft, startTop, startWidth, startHeight;
        
        const onStart = (clientX, clientY, target) => {
            isDragging = true;
            startX = clientX;
            startY = clientY;
            
            startLeft = parseInt(this.overlay.style.left) || 0;
            startTop = parseInt(this.overlay.style.top) || 0;
            startWidth = this.overlay.offsetWidth;
            startHeight = this.overlay.offsetHeight;
            
            if (target.classList.contains('handle')) {
                activeHandle = target.getAttribute('data-handle');
            } else {
                activeHandle = 'body';
            }
        };

        const onMove = (clientX, clientY) => {
            if (!isDragging) return;
            
            const dx = clientX - startX;
            const dy = clientY - startY;
            
            let newLeft = startLeft;
            let newTop = startTop;
            let newWidth = startWidth;
            let newHeight = startHeight;
            
            const maxW = this.displayWidth;
            const maxH = this.displayHeight;
            
            // Get aspect ratio scale if locked
            let ratioVal = null;
            if (this.aspectRatio === '1:1') ratioVal = 1;
            if (this.aspectRatio === '4:3') ratioVal = 4 / 3;
            if (this.aspectRatio === '16:9') ratioVal = 16 / 9;

            if (activeHandle === 'body') {
                newLeft = Math.max(0, Math.min(maxW - startWidth, startLeft + dx));
                newTop = Math.max(0, Math.min(maxH - startHeight, startTop + dy));
            } else {
                // Dragging handles
                if (activeHandle.includes('e')) {
                    newWidth = Math.max(30, Math.min(maxW - startLeft, startWidth + dx));
                }
                if (activeHandle.includes('w')) {
                    const candidateLeft = Math.max(0, Math.min(startLeft + startWidth - 30, startLeft + dx));
                    newWidth = startWidth - (candidateLeft - startLeft);
                    newLeft = candidateLeft;
                }
                if (activeHandle.includes('s')) {
                    newHeight = Math.max(30, Math.min(maxH - startTop, startHeight + dy));
                }
                if (activeHandle.includes('n')) {
                    const candidateTop = Math.max(0, Math.min(startTop + startHeight - 30, startTop + dy));
                    newHeight = startHeight - (candidateTop - startTop);
                    newTop = candidateTop;
                }

                // Enforce Aspect Ratio constraints
                if (ratioVal) {
                    if (activeHandle === 'se') {
                        // Priority width, adjust height
                        newHeight = newWidth / ratioVal;
                        if (newTop + newHeight > maxH) {
                            newHeight = maxH - newTop;
                            newWidth = newHeight * ratioVal;
                        }
                    } else if (activeHandle === 'ne') {
                        newHeight = newWidth / ratioVal;
                        const finalTop = startTop + startHeight - newHeight;
                        if (finalTop < 0) {
                            newHeight = startTop + startHeight;
                            newWidth = newHeight * ratioVal;
                            newTop = 0;
                        } else {
                            newTop = finalTop;
                        }
                    } else if (activeHandle === 'sw') {
                        newHeight = newWidth / ratioVal;
                        if (newTop + newHeight > maxH) {
                            newHeight = maxH - newTop;
                            const deltaW = newHeight * ratioVal - newWidth;
                            newLeft = Math.max(0, newLeft - deltaW);
                            newWidth = newHeight * ratioVal;
                        }
                    } else if (activeHandle === 'nw') {
                        newHeight = newWidth / ratioVal;
                        const finalTop = startTop + startHeight - newHeight;
                        if (finalTop < 0) {
                            newHeight = startTop + startHeight;
                            const deltaW = newHeight * ratioVal - newWidth;
                            newLeft = Math.max(0, newLeft - deltaW);
                            newWidth = newHeight * ratioVal;
                            newTop = 0;
                        } else {
                            newTop = finalTop;
                        }
                    }
                }
            }
            
            this.overlay.style.left = `${Math.round(newLeft)}px`;
            this.overlay.style.top = `${Math.round(newTop)}px`;
            this.overlay.style.width = `${Math.round(newWidth)}px`;
            this.overlay.style.height = `${Math.round(newHeight)}px`;
        };

        const onEnd = () => {
            isDragging = false;
            activeHandle = null;
        };

        // Mouse listeners
        this.overlay.addEventListener('mousedown', (e) => {
            e.preventDefault();
            onStart(e.clientX, e.clientY, e.target);
        });
        window.addEventListener('mousemove', (e) => {
            onMove(e.clientX, e.clientY);
        });
        window.addEventListener('mouseup', () => {
            onEnd();
        });

        // Touch listeners for mobile
        this.overlay.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                onStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
            }
        }, { passive: true });
        window.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches.length === 1) {
                onMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });
        window.addEventListener('touchend', () => {
            onEnd();
        });
    }

    async cropImage() {
        if (!this.transformedCanvas) return;
        
        // 1. Read overlay coordinates relative to visible canvas
        const overlayLeft = parseInt(this.overlay.style.left) || 0;
        const overlayTop = parseInt(this.overlay.style.top) || 0;
        const overlayWidth = this.overlay.offsetWidth;
        const overlayHeight = this.overlay.offsetHeight;
        
        // 2. Map coordinates to transformedCanvas (full-res)
        const scaleX = this.transformedCanvas.width / this.displayWidth;
        const scaleY = this.transformedCanvas.height / this.displayHeight;
        
        const cropX = Math.max(0, Math.round(overlayLeft * scaleX));
        const cropY = Math.max(0, Math.round(overlayTop * scaleY));
        const cropW = Math.min(this.transformedCanvas.width - cropX, Math.round(overlayWidth * scaleX));
        const cropH = Math.min(this.transformedCanvas.height - cropY, Math.round(overlayHeight * scaleY));
        
        // 3. Create a canvas of the cropped size
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        
        const ctx = cropCanvas.getContext('2d');
        ctx.drawImage(this.transformedCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        
        // 4. Output as Blob
        const blob = await canvasToBlob(cropCanvas, 'image/png');
        const previewUrl = URL.createObjectURL(blob);
        
        // Render popup dialog
        this.dialogImg.src = previewUrl;
        this.dialogStats.innerHTML = `
            <div>${i18n.t('dialog-stat-crop-area')}: ${cropW} x ${cropH} px</div>
            <div style="margin-top: 0.25rem;">${i18n.t('dialog-stat-file-size')}: <strong>${formatBytes(blob.size)}</strong></div>
        `;
        
        const baseName = this.originalFileName.slice(0, this.originalFileName.lastIndexOf('.')) || this.originalFileName;
        this.dialogDownload.href = previewUrl;
        this.dialogDownload.download = `${baseName}_cropped.png`;
        
        this.openDialog();
    }

    openDialog() {
        this.dialogOverlay.classList.remove('hidden');
    }

    closeDialog() {
        this.dialogOverlay.classList.add('hidden');
    }
}
