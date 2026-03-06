"use strict";

export const ToastManager = {
    show(msg, tipo = 'success') {
        const tc = document.getElementById('toast-container');
        if (!tc) return;
        const t = document.createElement('div');
        t.className = `toast ${tipo}`;
        t.innerHTML = `<span>${msg}</span><div class="toast-bar"></div>`;
        tc.appendChild(t);
        setTimeout(() => {
            t.style.opacity = '0';
            setTimeout(() => t.remove(), 300);
        }, 2500);
    }
};