import { loadImage, canvasToBlob, fileToDataURL, formatBytes, downloadFile } from './utils.js';
import { i18n } from './i18n.js';

export class FormatConverter {
    constructor() {
        this.files = []; // List of uploaded files: { id, file, status, convertedBlob, originalSize, convertedSize, dataURL, convertedName }
        this.currentId = 0;
        
        // Dom Elements
        this.dropzone = document.getElementById('convert-dropzone');
        this.fileInput = document.getElementById('convert-file-input');
        this.workspace = document.getElementById('convert-workspace');
        this.fileList = document.getElementById('convert-file-list');
        this.fileCount = document.getElementById('convert-file-count');
        this.targetFormatSelect = document.getElementById('convert-target-format');
        this.btnConvertAll = document.getElementById('btn-convert-all');
        this.btnDownloadAll = document.getElementById('btn-download-all-convert');
        this.btnClear = document.getElementById('btn-clear-convert');
        this.actionFooter = document.getElementById('convert-action-footer');
        
        this.initEvents();
        
        // Redraw file list dynamically when language changes
        window.addEventListener('languagechange', () => {
            this.renderFileList();
        });
    }

    initEvents() {
        // Drag and drop events
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
            const files = dt.files;
            this.handleFiles(files);
        });

        this.dropzone.addEventListener('click', (e) => {
            if (e.target !== this.fileInput) {
                this.fileInput.click();
            }
        });

        this.fileInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        this.fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Conversion actions
        this.btnConvertAll.addEventListener('click', () => this.convertAll());
        this.btnDownloadAll.addEventListener('click', () => this.downloadAll());
        this.btnClear.addEventListener('click', () => this.clearAll());
    }

    handleFiles(fileList) {
        const addedFiles = Array.from(fileList).filter(file => file.type.startsWith('image/'));
        if (addedFiles.length === 0) return;

        addedFiles.forEach(file => {
            const fileObj = {
                id: ++this.currentId,
                file: file,
                name: file.name,
                originalSize: file.size,
                status: 'ready', // ready, working, done, error
                convertedBlob: null,
                convertedSize: 0,
                convertedName: '',
                dataURL: null
            };
            this.files.push(fileObj);
            
            // Generate DataURL for preview
            fileToDataURL(file).then(url => {
                fileObj.dataURL = url;
                this.updateFileItemRow(fileObj);
            });
        });

        this.updateUI();
    }

    updateUI() {
        if (this.files.length > 0) {
            this.dropzone.classList.add('hidden');
            this.workspace.classList.remove('hidden');
        } else {
            this.dropzone.classList.remove('hidden');
            this.workspace.classList.add('hidden');
        }
        
        this.fileCount.textContent = this.files.length;
        
        // Re-render file list items (only those not rendered yet, or fully re-render for simplicity)
        this.renderFileList();
        
        // Check if any file is done to show/hide Download All
        const hasConverted = this.files.some(f => f.status === 'done');
        if (hasConverted) {
            this.actionFooter.classList.remove('hidden');
        } else {
            this.actionFooter.classList.add('hidden');
        }
    }

    renderFileList() {
        this.fileList.innerHTML = '';
        this.files.forEach(fileObj => {
            const li = document.createElement('li');
            li.className = 'file-item';
            li.id = `file-item-${fileObj.id}`;
            
            const formatExtension = fileObj.name.split('.').pop().toUpperCase();
            
            li.innerHTML = `
                <div class="file-info-col">
                    <div class="file-icon">
                        <i data-lucide="image"></i>
                    </div>
                    <div class="file-details">
                        <div class="file-name" title="${fileObj.name}">${fileObj.name}</div>
                        <div class="file-meta">
                            <span>${formatBytes(fileObj.originalSize)}</span>
                            <span>•</span>
                            <span class="file-format-badge">${formatExtension}</span>
                        </div>
                    </div>
                </div>
                <div class="file-status-col">
                    <span class="status-badge ${fileObj.status}" id="status-badge-${fileObj.id}">
                        ${this.getStatusText(fileObj.status)}
                    </span>
                    <div class="item-actions" id="item-actions-${fileObj.id}">
                        <button class="file-action-btn delete-btn" title="${i18n.t('action-delete')}"><i data-lucide="trash-2"></i></button>
                    </div>
                </div>
            `;
            
            // Wire up event listeners
            li.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeFile(fileObj.id);
            });

            this.fileList.appendChild(li);
        });
        
        lucide.createIcons();
    }

    updateFileItemRow(fileObj) {
        const li = document.getElementById(`file-item-${fileObj.id}`);
        if (!li) return;
        
        // Update status badge
        const badge = li.querySelector(`#status-badge-${fileObj.id}`);
        if (badge) {
            badge.className = `status-badge ${fileObj.status}`;
            badge.innerHTML = this.getStatusText(fileObj.status);
        }

        // If converted, show new size and download button
        if (fileObj.status === 'done' && fileObj.convertedBlob) {
            const metaCol = li.querySelector('.file-meta');
            if (metaCol) {
                metaCol.innerHTML = `
                    <span>${formatBytes(fileObj.originalSize)}</span>
                    <i data-lucide="arrow-right" style="width: 12px; height: 12px;"></i>
                    <span style="color: #34d399; font-weight: 600;">${formatBytes(fileObj.convertedSize)}</span>
                `;
            }
            
            const actionsContainer = li.querySelector(`#item-actions-${fileObj.id}`);
            if (actionsContainer) {
                actionsContainer.innerHTML = `
                    <button class="file-action-btn download-btn" title="${i18n.t('action-download')}"><i data-lucide="download"></i></button>
                    <button class="file-action-btn delete-btn" title="${i18n.t('action-delete')}"><i data-lucide="trash-2"></i></button>
                `;
                
                actionsContainer.querySelector('.download-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    downloadFile(fileObj.convertedBlob, fileObj.convertedName);
                });
                
                actionsContainer.querySelector('.delete-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.removeFile(fileObj.id);
                });
            }
            
            lucide.createIcons();
        }
    }

    getStatusText(status) {
        switch (status) {
            case 'ready': return `<i data-lucide="clock" style="width: 12px; height: 12px"></i> ${i18n.t('status-ready')}`;
            case 'working': return `<i class="spinner" style="width: 12px; height: 12px; border-width: 1.5px; border-top-color: currentColor;"></i> ${i18n.t('status-working')}`;
            case 'done': return `<i data-lucide="check-circle" style="width: 12px; height: 12px"></i> ${i18n.t('status-done')}`;
            case 'error': return `<i data-lucide="alert-circle" style="width: 12px; height: 12px"></i> ${i18n.t('status-error')}`;
            default: return '';
        }
    }

    removeFile(id) {
        this.files = this.files.filter(f => f.id !== id);
        this.updateUI();
    }

    clearAll() {
        this.files = [];
        this.fileInput.value = '';
        this.updateUI();
    }

    async convertFile(fileObj, targetFormat) {
        if (fileObj.status === 'done') return;
        
        fileObj.status = 'working';
        this.updateFileItemRow(fileObj);

        try {
            const dataUrl = fileObj.dataURL || await fileToDataURL(fileObj.file);
            const img = await loadImage(dataUrl);
            
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            // Determine MIME quality, defaults to 0.9 for conversion
            const quality = 0.95; 
            const blob = await canvasToBlob(canvas, targetFormat, quality);
            
            // Map MIME to extension
            let extension = 'png';
            if (targetFormat === 'image/webp') extension = 'webp';
            if (targetFormat === 'image/jpeg') extension = 'jpg';
            
            // Create a clean output filename
            const dotIdx = fileObj.name.lastIndexOf('.');
            const baseName = dotIdx !== -1 ? fileObj.name.slice(0, dotIdx) : fileObj.name;
            
            fileObj.convertedBlob = blob;
            fileObj.convertedSize = blob.size;
            fileObj.convertedName = `${baseName}.${extension}`;
            fileObj.status = 'done';
        } catch (err) {
            console.error('File conversion error: ', err);
            fileObj.status = 'error';
        }

        this.updateFileItemRow(fileObj);
    }

    async convertAll() {
        const targetFormat = this.targetFormatSelect.value;
        const promises = this.files.map(fileObj => this.convertFile(fileObj, targetFormat));
        
        await Promise.all(promises);
        
        // Refresh action footer state
        const hasConverted = this.files.some(f => f.status === 'done');
        if (hasConverted) {
            this.actionFooter.classList.remove('hidden');
        }
    }

    downloadAll() {
        let delay = 0;
        this.files.forEach(fileObj => {
            if (fileObj.status === 'done' && fileObj.convertedBlob) {
                setTimeout(() => {
                    downloadFile(fileObj.convertedBlob, fileObj.convertedName);
                }, delay);
                delay += 300; // Small delay to prevent browser download triggers blocking
            }
        });
    }
}

export class ImageCompressor {
    constructor() {
        this.originalFile = null;
        this.originalDataURL = null;
        this.compressedBlob = null;
        
        // DOM Elements
        this.dropzone = document.getElementById('compress-dropzone');
        this.fileInput = document.getElementById('compress-file-input');
        this.workspace = document.getElementById('compress-workspace');
        
        this.qualitySlider = document.getElementById('compress-quality');
        this.qualityVal = document.getElementById('quality-val');
        this.scaleSlider = document.getElementById('compress-scale');
        this.scaleVal = document.getElementById('scale-val');
        this.formatSelect = document.getElementById('compress-format');
        
        this.btnCompressRun = document.getElementById('btn-compress-run');
        this.btnDownload = document.getElementById('btn-download-compressed');
        
        this.lblOrigSize = document.getElementById('comp-orig-size');
        this.lblNewSize = document.getElementById('comp-new-size');
        this.lblRatio = document.getElementById('comp-ratio');
        this.previewImg = document.getElementById('compress-preview-img');
        
        this.initEvents();
    }

    initEvents() {
        // Drag and drop events
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
            const files = dt.files;
            if (files.length > 0) this.handleFile(files[0]);
        });

        this.dropzone.addEventListener('click', (e) => {
            if (e.target !== this.fileInput) {
                this.fileInput.click();
            }
        });

        this.fileInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) this.handleFile(e.target.files[0]);
        });

        // Param sliders change events
        this.qualitySlider.addEventListener('input', (e) => {
            this.qualityVal.textContent = `${e.target.value}%`;
        });
        
        this.scaleSlider.addEventListener('input', (e) => {
            this.scaleVal.textContent = `${e.target.value}%`;
        });

        this.btnCompressRun.addEventListener('click', () => this.compress());
    }

    async handleFile(file) {
        if (!file.type.startsWith('image/')) return;
        
        this.originalFile = file;
        this.lblOrigSize.textContent = formatBytes(file.size);
        
        // Auto select target format based on type to be helpful
        if (file.type === 'image/webp') {
            this.formatSelect.value = 'image/webp';
        } else if (file.type === 'image/png') {
            this.formatSelect.value = 'image/png';
        } else {
            this.formatSelect.value = 'image/jpeg';
        }

        try {
            this.originalDataURL = await fileToDataURL(file);
            this.dropzone.classList.add('hidden');
            this.workspace.classList.remove('hidden');
            
            // Run initial compression
            await this.compress();
        } catch (err) {
            console.error('Failed to load image for compression: ', err);
        }
    }

    async compress() {
        if (!this.originalFile) return;

        this.btnCompressRun.classList.add('disabled');
        this.btnCompressRun.innerHTML = `<span class="spinner" style="width:14px; height:14px; border-width:1.5px; border-top-color:currentColor;"></span> <span>${i18n.t('msg-compress-working')}</span>`;

        try {
            const img = await loadImage(this.originalDataURL);
            
            const quality = parseFloat(this.qualitySlider.value) / 100;
            const scale = parseFloat(this.scaleSlider.value) / 100;
            const mimeType = this.formatSelect.value;
            
            const canvas = document.createElement('canvas');
            const targetWidth = Math.max(1, Math.round(img.naturalWidth * scale));
            const targetHeight = Math.max(1, Math.round(img.naturalHeight * scale));
            
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            
            const ctx = canvas.getContext('2d');
            
            // Clean draw
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            
            const compressedBlob = await canvasToBlob(canvas, mimeType, quality);
            this.compressedBlob = compressedBlob;
            
            // Update UI details
            this.lblNewSize.textContent = formatBytes(compressedBlob.size);
            
            // Calculate saving ratio
            const savings = this.originalFile.size - compressedBlob.size;
            const ratioPercent = Math.round((savings / this.originalFile.size) * 100);
            
            if (ratioPercent >= 0) {
                this.lblRatio.textContent = `-${ratioPercent}%`;
                document.querySelector('.success-box').classList.remove('danger-box');
                document.querySelector('.success-box').classList.add('success-box');
            } else {
                // Occurs if scaling/format changes make files larger
                this.lblRatio.textContent = `+${Math.abs(ratioPercent)}%`;
                document.querySelector('.success-box').classList.add('danger-box');
            }
            
            // Show preview
            const previewUrl = URL.createObjectURL(compressedBlob);
            this.previewImg.src = previewUrl;
            
            // Set download button
            let extension = 'webp';
            if (mimeType === 'image/jpeg') extension = 'jpg';
            if (mimeType === 'image/png') extension = 'png';
            
            const origName = this.originalFile.name;
            const dotIdx = origName.lastIndexOf('.');
            const baseName = dotIdx !== -1 ? origName.slice(0, dotIdx) : origName;
            
            this.btnDownload.href = previewUrl;
            this.btnDownload.download = `${baseName}_compressed.${extension}`;
            this.btnDownload.classList.remove('disabled');
        } catch (err) {
            console.error('Compression failed: ', err);
        } finally {
            this.btnCompressRun.classList.remove('disabled');
            this.btnCompressRun.innerHTML = `<i data-lucide="zap"></i> <span>${i18n.t('btn-compress-run')}</span>`;
            lucide.createIcons();
        }
    }
}
