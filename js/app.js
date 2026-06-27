/**
 * PixelCraft - Main Application Coordinator
 */

import { FormatConverter, ImageCompressor } from './converter.js';
import { ImageCropper } from './cropper.js';
import { ImageMosaic } from './mosaic.js';
import { GifMaker } from './gifMaker.js';
import { i18n } from './i18n.js';

class App {
    constructor() {
        this.initLanguages();
        this.initNavigation();
        this.initModules();
    }

    initLanguages() {
        // Initial translation rendering
        i18n.translateDOM();
        
        const langSelect = document.getElementById('app-lang-select');
        if (langSelect) {
            langSelect.value = i18n.currentLang;
            langSelect.addEventListener('change', (e) => {
                i18n.setLanguage(e.target.value);
            });
        }

        // Listen for manual language changes
        window.addEventListener('languagechange', () => {
            lucide.createIcons();
        });
    }

    initNavigation() {
        const desktopNavItems = document.querySelectorAll('.nav-item');
        const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
        const tabPanels = document.querySelectorAll('.tab-panel');

        const switchTab = (tabId) => {
            // Update panels
            tabPanels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === `tab-${tabId}`) {
                    panel.classList.add('active');
                }
            });

            // Update Desktop Nav
            desktopNavItems.forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('data-tab') === tabId) {
                    item.classList.add('active');
                }
            });

            // Update Mobile Nav
            mobileNavItems.forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('data-tab') === tabId) {
                    item.classList.add('active');
                }
            });

            // Re-render Lucide icons on tab switch to ensure dynamically added icons load properly
            lucide.createIcons();

            // Trigger canvas dimension updates for interactive tools in case they were hidden during initialization
            if (tabId === 'crop' && this.cropper) {
                this.cropper.applyTransforms();
            }
            if (tabId === 'mosaic' && this.mosaic) {
                this.mosaic.updateBrushIndicatorSize();
                this.mosaic.composeOutput();
            }
        };

        // Wire up Desktop Nav click listeners
        desktopNavItems.forEach(item => {
            item.addEventListener('click', () => {
                const tabId = item.getAttribute('data-tab');
                switchTab(tabId);
            });
        });

        // Wire up Mobile Nav click listeners
        mobileNavItems.forEach(item => {
            item.addEventListener('click', () => {
                const tabId = item.getAttribute('data-tab');
                switchTab(tabId);
            });
        });
    }

    initModules() {
        // Instantiate features on window load
        try {
            this.converter = new FormatConverter();
            this.compressor = new ImageCompressor();
            this.cropper = new ImageCropper();
            this.mosaic = new ImageMosaic();
            this.gifMaker = new GifMaker();
            
            // Initial render of Lucide Icons
            lucide.createIcons();
        } catch (err) {
            console.error('Failed to initialize feature modules: ', err);
        }
    }
}

// Start Application
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
        window.app = new App();
    });
} else {
    window.app = new App();
}
