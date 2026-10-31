// @central-id demo
// @central-name Demonstração da Central
// @central-version 1.0.0
// @central-match https://example.com/*
// @central-enabled true

// Este arquivo é um módulo da Central. Não instale diretamente no Tampermonkey.
(function () {
  'use strict';

  if (document.getElementById('central-demo-selo')) return;
  const selo = document.createElement('div');
  selo.id = 'central-demo-selo';
  selo.textContent = '✅ Script recebido do GitHub e executado!';
  Object.assign(selo.style, {
    position: 'fixed', left: '16px', bottom: '16px', zIndex: '2147483646',
    background: '#0f766e', color: '#fff', padding: '12px 16px',
    font: '600 13px Segoe UI, sans-serif', borderRadius: '12px',
    boxShadow: '0 10px 30px #0003'
  });
  document.body.appendChild(selo);
  console.log('[CENTRAL:demo] Exemplo executado. API:', API.id, API.version);
})();
