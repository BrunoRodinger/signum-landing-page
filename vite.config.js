const { defineConfig } = require('vite');
const { resolve } = require('path');

module.exports = defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                b2c: resolve(__dirname, 'b2c/index.html'),
                obrigado: resolve(__dirname, 'obrigado/index.html'),
                diagnostico: resolve(__dirname, 'diagnostico/index.html'),
                diagnosticoB2b: resolve(__dirname, 'diagnostico-b2b/index.html')
            }
        }
    }
});
