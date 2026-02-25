const { defineConfig } = require('vite');
const { resolve } = require('path');

module.exports = defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                obrigado: resolve(__dirname, 'obrigado/index.html')
            }
        }
    }
});
