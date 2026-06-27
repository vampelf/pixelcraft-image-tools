import { fileToDataURL, downloadFile } from './utils.js';
import { i18n } from './i18n.js';

export class GifMaker {
    constructor() {
        this.frames = []; // Array of frame objects: { id, file, dataURL }
        this.currentId = 0;
        this.draggedIndex = null;
        
        // DOM Elements
        this.dropzone = document.getElementById('gif-dropzone');
        this.fileInput = document.getElementById('gif-file-input');
        this.workspace = document.getElementById('gif-workspace');
        
        this.framesGrid = document.getElementById('gif-frames-grid');
        this.frameCountText = document.getElementById('gif-frame-count');
        this.btnAddMore = document.getElementById('btn-gif-add-more');
        
        this.delaySlider = document.getElementById('gif-delay');
        this.delayVal = document.getElementById('gif-delay-val');
        this.widthSelect = document.getElementById('gif-width');
        this.heightSelect = document.getElementById('gif-height');
        
        this.customSizeGroup = document.getElementById('gif-custom-size-group');
        this.customWidthInput = document.getElementById('gif-custom-width');
        this.customHeightInput = document.getElementById('gif-custom-height');
        
        this.btnGenerate = document.getElementById('btn-gif-generate');
        this.previewContainer = document.getElementById('gif-preview-container');
        this.previewImg = document.getElementById('gif-preview-img');
        this.btnDownload = document.getElementById('btn-download-gif');
        this.loader = document.getElementById('gif-loader');
        
        this.initEvents();
    }

    initEvents() {
        // Drag & Drop
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
            this.handleFiles(dt.files);
        });
        this.dropzone.addEventListener('click', (e) => {
            if (e.target !== this.fileInput) {
                this.fileInput.click();
            }
        });
        this.fileInput.addEventListener('click', (e) => e.stopPropagation());
        this.fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Add more frames button
        const fileInputAdd = document.createElement('input');
        fileInputAdd.type = 'file';
        fileInputAdd.multiple = true;
        fileInputAdd.accept = 'image/*';
        fileInputAdd.style.display = 'none';
        document.body.appendChild(fileInputAdd);
        
        this.btnAddMore.addEventListener('click', () => fileInputAdd.click());
        fileInputAdd.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
            fileInputAdd.value = ''; // Reset
        });

        // Delay Speed
        this.delaySlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value) / 100;
            this.delayVal.textContent = `${value.toFixed(2)}s`;
        });

        // Dropdown size selectors
        this.widthSelect.addEventListener('change', () => this.toggleCustomSizeInputs());
        this.heightSelect.addEventListener('change', () => this.toggleCustomSizeInputs());

        // Generate GIF
        this.btnGenerate.addEventListener('click', () => this.generateGIF());
    }

    toggleCustomSizeInputs() {
        const isCustomW = this.widthSelect.value === 'custom';
        const isCustomH = this.heightSelect.value === 'custom';
        
        if (isCustomW || isCustomH) {
            this.customSizeGroup.classList.remove('hidden');
        } else {
            this.customSizeGroup.classList.add('hidden');
        }
    }

    async handleFiles(fileList) {
        const addedFiles = Array.from(fileList).filter(file => file.type.startsWith('image/'));
        if (addedFiles.length === 0) return;

        const promises = addedFiles.map(async (file) => {
            const dataURL = await fileToDataURL(file);
            this.frames.push({
                id: ++this.currentId,
                file: file,
                dataURL: dataURL
            });
        });

        await Promise.all(promises);
        this.updateUI();
    }

    updateUI() {
        if (this.frames.length > 0) {
            this.dropzone.classList.add('hidden');
            this.workspace.classList.remove('hidden');
        } else {
            this.dropzone.classList.remove('hidden');
            this.workspace.classList.add('hidden');
        }
        
        this.frameCountText.textContent = this.frames.length;
        this.renderFrames();
    }

    renderFrames() {
        this.framesGrid.innerHTML = '';
        
        this.frames.forEach((frame, idx) => {
            const item = document.createElement('div');
            item.className = 'frame-item';
            item.setAttribute('draggable', 'true');
            item.setAttribute('data-index', idx);
            
            item.innerHTML = `
                <img src="${frame.dataURL}" alt="Frame Thumbnail">
                <span class="frame-number">${idx + 1}</span>
                <button class="frame-delete-btn" title="${i18n.t('action-delete')}">&times;</button>
            `;
            
            // Delete action
            item.querySelector('.frame-delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteFrame(idx);
            });

            // HTML5 Drag and Drop events for reordering
            item.addEventListener('dragstart', (e) => {
                this.draggedIndex = idx;
                e.dataTransfer.effectAllowed = 'move';
                item.style.opacity = '0.5';
            });

            item.addEventListener('dragend', () => {
                item.style.opacity = '1';
                this.draggedIndex = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const dropIndex = parseInt(item.getAttribute('data-index'));
                if (this.draggedIndex !== null && this.draggedIndex !== dropIndex) {
                    const draggedItem = this.frames[this.draggedIndex];
                    // Reorder array
                    this.frames.splice(this.draggedIndex, 1);
                    this.frames.splice(dropIndex, 0, draggedItem);
                    this.renderFrames();
                }
            });

            this.framesGrid.appendChild(item);
        });
    }

    deleteFrame(idx) {
        this.frames.splice(idx, 1);
        this.updateUI();
    }

    generateGIF() {
        if (this.frames.length === 0) return;
        
        // Show loader, hide generate button and preview
        this.btnGenerate.classList.add('hidden');
        this.previewContainer.classList.add('hidden');
        this.loader.classList.remove('hidden');
        
        // Parameters
        const delaySeconds = parseFloat(this.delaySlider.value) / 100;
        
        let width = parseInt(this.widthSelect.value);
        if (this.widthSelect.value === 'custom') {
            width = parseInt(this.customWidthInput.value) || 500;
        }
        
        let height = parseInt(this.heightSelect.value);
        if (this.heightSelect.value === 'custom') {
            height = parseInt(this.customHeightInput.value) || 500;
        }

        const images = this.frames.map(f => f.dataURL);

        // Run gifshot encoding
        // Check window.gifshot (library loaded via CDN in index.html)
        if (typeof gifshot === 'undefined') {
            alert(i18n.t('alert-lib-missing'));
            this.btnGenerate.classList.remove('hidden');
            this.loader.classList.add('hidden');
            return;
        }

        gifshot.createGIF({
            images: images,
            interval: delaySeconds,
            gifWidth: width,
            gifHeight: height,
            numWorkers: 2,
            sampleInterval: 10,
            keepAspectRatio: true
        }, (obj) => {
            if (!obj.error) {
                const base64Img = obj.image;
                this.previewImg.src = base64Img;
                
                // Setup download button
                this.btnDownload.href = base64Img;
                this.btnDownload.download = `pixelcraft_gif_${Date.now()}.gif`;
                
                // Show results
                this.previewContainer.classList.remove('hidden');
            } else {
                alert(i18n.t('status-error') + `: ${obj.errorMsg}`);
            }
            
            this.btnGenerate.classList.remove('hidden');
            this.loader.classList.add('hidden');
        });
    }
}
