// graficos.js

import { supabase } from './js/servicos/supabaseClient.js';
import { inicializarFiltros } from './js/componentes/filtros.js';
import { obterDadosGraficos } from './js/servicos/graficosService.js';

let chartPositivo = null;
let chartCritico = null;
let chartOscilacao = null;
let chartDistribuicao = null;

function destruirGraficos() {
    if (chartPositivo) { chartPositivo.destroy(); chartPositivo = null; }
    if (chartCritico) { chartCritico.destroy(); chartCritico = null; }
    if (chartOscilacao) { chartOscilacao.destroy(); chartOscilacao = null; }
    if (chartDistribuicao) { chartDistribuicao.destroy(); chartDistribuicao = null; }
}

function alternarVisibilidadeMensagem(elementIdCanvas, elementIdMsg, possuiDados) {
    const canvas = document.getElementById(elementIdCanvas) || document.getElementById(elementIdCanvas.replace(/([A-Z])/g, "-$1").toLowerCase());
    const msg = document.getElementById(elementIdMsg);

    if (canvas && msg) {
        if (possuiDados) {
            canvas.style.display = 'block';
            msg.style.display = 'none';
        } else {
            canvas.style.display = 'none';
            msg.style.display = 'block';
        }
    }
}

/**
 * Preenche e exibe o card da tabela dinamicamente com base na fatia clicada
 */
function exibirTabelaDetalhamento(categoriaNome, listaLojas, corBadge) {
    const container = document.getElementById('container-detalhe-rosca');
    const titulo = document.getElementById('titulo-detalhe-rosca');
    const subtitulo = document.getElementById('subtitulo-detalhe-rosca');
    const tbody = document.getElementById('tbody-detalhe-rosca');

    if (!container || !tbody) return;

    titulo.innerHTML = `Lojas na Categoria: <span style="color: ${corBadge}">${categoriaNome}</span> (${listaLojas.length} filiais)`;
    subtitulo.textContent = `Listagem completa de filiais classificadas como ${categoriaNome.toLowerCase()} na semana.`;

    tbody.innerHTML = '';

    if (listaLojas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b;">Nenhuma loja encontrada nesta categoria.</td></tr>`;
    } else {
        listaLojas.forEach(loja => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 600; color: #0f172a;">${loja.filial}</td>
                <td>${loja.rede}</td>
                <td><span style="background-color: ${corBadge}20; color: ${corBadge}; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">${loja.status}</span></td>
                <td style="font-weight: 600;">${loja.indice.toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderizarGraficos(dados) {
    destruirGraficos();

    // Esconde a tabela de detalhamento ao trocar os filtros gerais
    const containerTabela = document.getElementById('container-detalhe-rosca');
    if (containerTabela) containerTabela.style.display = 'none';

    const canvasPositivo = document.getElementById('chartPositivo') || document.getElementById('chart-positivo');
    const canvasCritico = document.getElementById('chartCritico') || document.getElementById('chart-critico');
    const canvasOscilacao = document.getElementById('chartOscilacao') || document.getElementById('chart-oscilacao');
    const possuiPositivos = dados.topPositivos && dados.topPositivos.length > 0;
    const possuiCriticos = dados.topCriticos && dados.topCriticos.length > 0;
    const possuiOscilacao = dados.topOscilacao && dados.topOscilacao.length > 0;

    alternarVisibilidadeMensagem('chartPositivo', 'msg-sem-dados-positivo', possuiPositivos);
    alternarVisibilidadeMensagem('chartCritico', 'msg-sem-dados-critico', possuiCriticos);
    alternarVisibilidadeMensagem('chartOscilacao', 'msg-sem-dados-oscilacao', possuiOscilacao);

    const opcoesBaseBarras = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { 
            x: { 
                beginAtZero: true,
                grid: { display: false, drawBorder: false },
                ticks: { callback: function(value) { return value; } }
            },
            y: { grid: { display: false, drawBorder: false } }
        }
    };

    if (canvasPositivo && possuiPositivos) {
        chartPositivo = new Chart(canvasPositivo.getContext('2d'), {
            type: 'bar',
            data: {
                labels: dados.topPositivos.map(d => d.label),
                datasets: [{
                    data: dados.topPositivos.map(d => d.valor),
                    backgroundColor: '#2ecc71',
                    borderRadius: 4,
                    barPercentage: 0.65
                }]
            },
            options: opcoesBaseBarras
        });
    }

    if (canvasCritico && possuiCriticos) {
        chartCritico = new Chart(canvasCritico.getContext('2d'), {
            type: 'bar',
            data: {
                labels: dados.topCriticos.map(d => d.label),
                datasets: [{
                    data: dados.topCriticos.map(d => d.valor),
                    backgroundColor: '#ef4444',
                    borderRadius: 4,
                    barPercentage: 0.65
                }]
            },
            options: opcoesBaseBarras
        });
    }

    if (canvasOscilacao && possuiOscilacao) {
        chartOscilacao = new Chart(canvasOscilacao.getContext('2d'), {
            type: 'bar',
            data: {
                labels: dados.topOscilacao.map(d => d.label),
                datasets: [{
                    data: dados.topOscilacao.map(d => d.valor),
                    backgroundColor: '#f59e0b',
                    borderRadius: 4,
                    barPercentage: 0.65
                }]
            },
            options: opcoesBaseBarras
        });
    }

    // ==========================================
    // ATUALIZAÇÃO DOS BOTÕES DE STATUS INTERATIVOS
    // ==========================================
    if (dados.distribuicao) {
        const countBaixo = document.getElementById('count-baixo');
        const countMedio = document.getElementById('count-medio');
        const countAlto = document.getElementById('count-alto');

        if (countBaixo) countBaixo.textContent = `(${dados.distribuicao.saudavel.total})`;
        if (countMedio) countMedio.textContent = `(${dados.distribuicao.alerta.total})`;
        if (countAlto) countAlto.textContent = `(${dados.distribuicao.critico.total})`;

        const btnBaixo = document.getElementById('btn-status-baixo');
        const btnMedio = document.getElementById('btn-status-medio');
        const btnAlto = document.getElementById('btn-status-alto');

        if (btnBaixo) {
            btnBaixo.replaceWith(btnBaixo.cloneNode(true));
            document.getElementById('btn-status-baixo').addEventListener('click', () => {
                exibirTabelaDetalhamento('Baixo', dados.distribuicao.saudavel.lojas, '#10b981');
            });
        }
        if (btnMedio) {
            btnMedio.replaceWith(btnMedio.cloneNode(true));
            document.getElementById('btn-status-medio').addEventListener('click', () => {
                exibirTabelaDetalhamento('Médio', dados.distribuicao.alerta.lojas, '#f59e0b');
            });
        }
        if (btnAlto) {
            btnAlto.replaceWith(btnAlto.cloneNode(true));
            document.getElementById('btn-status-alto').addEventListener('click', () => {
                exibirTabelaDetalhamento('Alto', dados.distribuicao.critico.lojas, '#ef4444');
            });
        }
    }
}

async function atualizarPagina() {
    const selectEl = document.getElementById('select-periodo');
    if (!selectEl || !selectEl.value) return;

    const periodoAtual = selectEl.value;
    const currentIndex = selectEl.selectedIndex;
    let periodoAnterior = null;
    
    if (currentIndex >= 0 && currentIndex < selectEl.options.length - 1) {
        periodoAnterior = selectEl.options[currentIndex + 1].value;
    }

    const dados = await obterDadosGraficos(periodoAtual, periodoAnterior);
    renderizarGraficos(dados);
}

document.addEventListener('DOMContentLoaded', async () => {
    await inicializarFiltros(supabase);

    const selectEl = document.getElementById('select-periodo');
    const btnAtualizar = document.getElementById('btn-atualizar-graficos') || document.getElementById('btnAtualizar');
    const btnFecharTabela = document.getElementById('btn-fechar-detalhe-rosca');

    if (btnFecharTabela) {
        btnFecharTabela.addEventListener('click', () => {
            const containerTabela = document.getElementById('container-detalhe-rosca');
            if (containerTabela) containerTabela.style.display = 'none';
        });
    }

    if (selectEl && selectEl.value) {
        await atualizarPagina();
    }

    if (btnAtualizar) {
        btnAtualizar.addEventListener('click', atualizarPagina);
    }

    if (selectEl) {
        selectEl.addEventListener('change', atualizarPagina);
    }
});