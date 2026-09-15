// js/servicos/graficosService.js

import { supabase } from "./supabaseClient.js";

function parseNumero(valor) {
	const num = parseFloat(valor);
	return Number.isNaN(num) ? 0 : num;
}

export async function obterDadosGraficos(periodoSelecionado, periodoAnterior) {
	if (!periodoSelecionado) {
		return {
			topPositivos: [],
			topCriticos: [],
			topOscilacao: [],
			distribuicao: {
				saudavel: { total: 0, lojas: [] },
				alerta: { total: 0, lojas: [] },
				critico: { total: 0, lojas: [] },
			},
		};
	}

	const [, dataFimAtual] = periodoSelecionado.split("|");
	const dataFimAnterior = periodoAnterior
		? periodoAnterior.split("|")[1]
		: null;

	try {
		const [resBaixo, resCritico, resAtualCompleto, resAnteriorCompleto] =
			await Promise.all([
				supabase
					.from("tabela_completa")
					.select("filial, indice")
					.eq("data_final", dataFimAtual)
					.order("indice", { ascending: true })
					.limit(10),

				supabase
					.from("tabela_completa")
					.select("filial, indice")
					.eq("data_final", dataFimAtual)
					.order("indice", { ascending: false })
					.limit(10),

				supabase
					.from("tabela_completa")
					.select("filial, indice, status, rede")
					.eq("data_final", dataFimAtual)
					.order("data_final", { ascending: false })
					.limit(1000),

				dataFimAnterior
					? supabase
							.from("tabela_completa")
							.select("filial, indice")
							.eq("data_final", dataFimAnterior)
							.order("data_final", { ascending: false })
							.limit(1000)
					: Promise.resolve({ data: [] }),
			]);

		const topPositivos = (resBaixo.data || []).map((item) => ({
			label: item.filial || "Sem Nome",
			valor: parseNumero(item.indice),
		}));

		const topCriticos = (resCritico.data || []).map((item) => ({
			label: item.filial || "Sem Nome",
			valor: parseNumero(item.indice),
		}));

		// Estrutura expandida para suportar a busca das lojas no clique
		const distribuicao = {
			saudavel: { total: 0, lojas: [] },
			alerta: { total: 0, lojas: [] },
			critico: { total: 0, lojas: [] },
		};

		const mapaAnterior = new Map();
		const listaOscilacao = [];

		(resAnteriorCompleto.data || []).forEach((item) => {
			if (item.filial) mapaAnterior.set(item.filial, parseNumero(item.indice));
		});

		(resAtualCompleto.data || []).forEach((item) => {
			const lojaObj = {
				filial: item.filial || "Sem Nome",
				indice: parseNumero(item.indice),
				status: item.status || "N/I",
				rede: item.rede || "N/I",
			};

			if (item.status) {
				const s = item.status.toLowerCase();
				if (s.includes("baixo") || s.includes("saudavel")) {
					distribuicao.saudavel.total++;
					distribuicao.saudavel.lojas.push(lojaObj);
				} else if (s.includes("médio") || s.includes("medio")) {
					distribuicao.alerta.total++;
					distribuicao.alerta.lojas.push(lojaObj);
				} else if (s.includes("crítico") || s.includes("critico")) {
					distribuicao.critico.total++;
					distribuicao.critico.lojas.push(lojaObj);
				}
			}

			if (item.filial && mapaAnterior.has(item.filial)) {
				const dif = parseNumero(item.indice) - mapaAnterior.get(item.filial);
				if (dif > 0) listaOscilacao.push({ label: item.filial, valor: dif });
			}
		});

		const topOscilacao = listaOscilacao
			.sort((a, b) => b.valor - a.valor)
			.slice(0, 10);

		return { topPositivos, topCriticos, topOscilacao, distribuicao };
	} catch (erro) {
		console.error("[graficosService] Falha:", erro);
		return {
			topPositivos: [],
			topCriticos: [],
			topOscilacao: [],
			distribuicao: {
				saudavel: { total: 0, lojas: [] },
				alerta: { total: 0, lojas: [] },
				critico: { total: 0, lojas: [] },
			},
		};
	}
}
