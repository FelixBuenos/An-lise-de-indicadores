// js/componentes/graficoTendencia.js

import { obterHistoricoTendencia } from "../servicos/graficosService.js";

// Instância global privada do gráfico para controle de ciclo de vida (destruição e re-renderização)
let chartInstance = null;

/**
 * Destrói a instância anterior do Chart.js para evitar vazamento de memória (Memory Leak)
 * e sobreposição visual ao aplicar novos filtros.
 */
function destruirGraficoExistente() {
	if (chartInstance) {
		chartInstance.destroy();
		chartInstance = null;
	}
}

/**
 * Renderiza o gráfico de linha de tendência utilizando a biblioteca Chart.js.
 * @param {string} elementId - ID do elemento <canvas>
 * @param {Object} dadosFormatados - Objeto contendo { labels, valores }
 */
function desenharGraficoLinha(elementId, dadosFormatados) {
	const canvas = document.getElementById(elementId);
	if (!canvas) return;

	destruirGraficoExistente();

	const ctx = canvas.getContext("2d");

	// Configuração declarativa do gráfico
	chartInstance = new Chart(ctx, {
		type: "line",
		data: {
			labels: dadosFormatados.labels,
			datasets: [
				{
					label: "Índice de Desempenho Histórico",
					data: dadosFormatados.valores,
					borderColor: "#0055a5",
					backgroundColor: "rgba(0, 85, 165, 0.1)",
					borderWidth: 3,
					fill: true,
					tension: 0.3, // Curva suave na linha
					pointRadius: 5,
					pointHoverRadius: 7,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					display: true,
					position: "top",
				},
				tooltip: {
					callbacks: {
						label: (context) => ` Desempenho: ${context.parsed.y.toFixed(1)}%`,
					},
				},
			},
			scales: {
				y: {
					beginAtZero: true,
					grid: {
						color: "rgba(0, 0, 0, 0.05)",
					},
				},
				x: {
					grid: {
						display: false,
					},
				},
			},
		},
	});
}

/**
 * Controladora responsável por orquestrar a busca e renderização do gráfico de tendência.
 * @param {string} filialEscolhida
 */
export async function inicializarGraficoTendencia(filialEscolhida) {
	if (!filialEscolhida) return;

	try {
		// 1. Busca os dados via serviço isolado
		const dados = await obterHistoricoTendencia(filialEscolhida);

		// 2. Renderiza na View
		desenharGraficoLinha("canvas-grafico-tendencia", dados);
	} catch (erro) {
		console.error("[graficoTendencia.js] Erro ao carregar gráfico:", erro);
	}
}
