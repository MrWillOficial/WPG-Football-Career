import React from 'react';
import { createRoot } from 'react-dom/client';
import { CareerApp } from './app/CareerApp.jsx';
import { STORAGE_KEY } from './app/useCareerController.js';
import './styles/theme.css';

// Save salvo antes de uma correção de bug pode ficar incompatível com o
// código novo e travar o app já na restauração — sem conseguir nem chegar
// numa tela com botão de reiniciar. `?reset=1` na URL limpa o save ANTES do
// app montar, funcionando mesmo quando o save quebrado impede o carregamento
// normal. Roda antes de qualquer render — nunca depende do app já estar de pé.
try {
  if (new URLSearchParams(window.location.search).get('reset') === '1') {
    window.localStorage.removeItem(STORAGE_KEY);
    const url = new URL(window.location.href);
    url.searchParams.delete('reset');
    window.history.replaceState(null, '', url);
  }
} catch (e) { /* localStorage indisponível — segue sem limpar */ }

createRoot(document.getElementById('root')).render(<CareerApp />);
