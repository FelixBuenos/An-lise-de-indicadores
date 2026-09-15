// js/componentes/diagnostico.js

let registrosSemanasAtuais = [];
let todasSemanasFilial = [];
let filialAtual = "";
let periodoAtual = "";
let supabaseInstancia = null;

/**
 * Função principal de inicialização do diagnóstico semanal
 */
export async function renderizarDiagnostico(
	supabase,
	filialEscolhida,
	periodoEscolhido,
) {
	if (!filialEscolhida || !periodoEscolhido) return;

	supabaseInstancia = supabase;
	filialAtual = filialEscolhida;
	periodoAtual = periodoEscolhido;

	const container = document.getElementById("container-diagnostico-semanal");
	if (!container) return;

	const partesData = periodoEscolhido.split("|");
	const dataFinalAtualStr = partesData[1];

	// Busca os 5 registros mais recentes retroativos da filial a partir da data final selecionada
	const { data: registros, error } = await supabase
		.from("dados_lojas")
		.select("*")
		.eq("filial", filialEscolhida)
		.lte("data_final", dataFinalAtualStr)
		.order("data_final", { ascending: false })
		.limit(5);

	if (error || !registros || registros.length === 0) {
		container.style.display = "none";
		return;
	}

	registrosSemanasAtuais = registros;
	container.style.display = "block";

	// Atualiza cabeçalho com nome da loja
	const labelLoja = document.getElementById("diagnostico-loja-nome");
	if (labelLoja) labelLoja.textContent = filialEscolhida;

	// Popula o select de comparação com opções inteligentes
	await popularSeletorComparacao();

	// Executa a análise comparativa de todos os indicadores
	await processarAnaliseComparativa();
}

/**
 * Popula o select com opções de semanas anteriores, meses anteriores e histórico
 */
async function popularSeletorComparacao() {
	const select = document.getElementById("select-comparar-diagnostico");
	if (!select) return;

	select.innerHTML = "";

	const partesPeriodo = periodoAtual.split("|");
	const dataInicioAtual = new Date(`${partesPeriodo[0]}T12:00:00`);

	// Busca semanas históricas da filial (para localizar a mesma semana de meses anteriores)
	try {
		const { data: todasSemanas } = await supabaseInstancia
			.from("dados_lojas")
			.select("data_inicio, data_final")
			.eq("filial", filialAtual)
			.order("data_final", { ascending: false })
			.limit(52); // Histórico do último ano

		todasSemanasFilial = todasSemanas || [];
	} catch (e) {
		console.warn("Erro ao carregar histórico para comparação:", e);
		todasSemanasFilial = [];
	}

	// 1. Mesma Semana do Mês Anterior (~4 semanas / ~28 dias antes) - PRIMEIRO FILTRO PADRÃO
	const semanaMesAnterior = encontrarSemanaPorMesesAtras(dataInicioAtual, 1);
	let valorPadraoInicial = "semana_2";

	if (semanaMesAnterior) {
		const optMesAnt = document.createElement("option");
		optMesAnt.value = `data:${semanaMesAnterior.data_inicio}|${semanaMesAnterior.data_final}`;
		optMesAnt.textContent = `📅 Mesma Semana do Mês Anterior (${formatarDataBR(semanaMesAnterior.data_inicio)} a ${formatarDataBR(semanaMesAnterior.data_final)})`;
		select.appendChild(optMesAnt);
		valorPadraoInicial = optMesAnt.value;
	}

	// 2. Semana Anterior Imediata (Semana 2)
	const optSemana2 = document.createElement("option");
	optSemana2.value = "semana_2";
	const s2 = registrosSemanasAtuais[1];
	optSemana2.textContent = s2
		? `Semana Anterior (Semana 2: ${formatarDataBR(s2.data_inicio)} a ${formatarDataBR(s2.data_final)})`
		: "Semana Anterior (Semana 2)";
	select.appendChild(optSemana2);

	// 3. Semana 3 (2 semanas atrás)
	if (registrosSemanasAtuais.length >= 3) {
		const s3 = registrosSemanasAtuais[2];
		const optSemana3 = document.createElement("option");
		optSemana3.value = "semana_3";
		optSemana3.textContent = `Semana 3 (2 sem. atrás: ${formatarDataBR(s3.data_inicio)} a ${formatarDataBR(s3.data_final)})`;
		select.appendChild(optSemana3);
	}

	// 4. Semana 4 (3 semanas atrás)
	if (registrosSemanasAtuais.length >= 4) {
		const s4 = registrosSemanasAtuais[3];
		const optSemana4 = document.createElement("option");
		optSemana4.value = "semana_4";
		optSemana4.textContent = `Semana 4 (3 sem. atrás: ${formatarDataBR(s4.data_inicio)} a ${formatarDataBR(s4.data_final)})`;
		select.appendChild(optSemana4);
	}

	// 5. Mesma Semana de 2 Meses Anteriores (~8 semanas / ~56 dias antes)
	const semana2Meses = encontrarSemanaPorMesesAtras(dataInicioAtual, 2);
	if (semana2Meses) {
		const opt2Meses = document.createElement("option");
		opt2Meses.value = `data:${semana2Meses.data_inicio}|${semana2Meses.data_final}`;
		opt2Meses.textContent = `📅 Mesma Semana de 2 Meses Anteriores (${formatarDataBR(semana2Meses.data_inicio)} a ${formatarDataBR(semana2Meses.data_final)})`;
		select.appendChild(opt2Meses);
	}

	// 6. Mesma Semana de 3 Meses Anteriores (~12 semanas / ~84 dias antes)
	const semana3Meses = encontrarSemanaPorMesesAtras(dataInicioAtual, 3);
	if (semana3Meses) {
		const opt3Meses = document.createElement("option");
		opt3Meses.value = `data:${semana3Meses.data_inicio}|${semana3Meses.data_final}`;
		opt3Meses.textContent = `📅 Mesma Semana de 3 Meses Anteriores (${formatarDataBR(semana3Meses.data_inicio)} a ${formatarDataBR(semana3Meses.data_final)})`;
		select.appendChild(opt3Meses);
	}

	// 7. Comparar com Metas de Mercado
	const optMetas = document.createElement("option");
	optMetas.value = "metas_mercado";
	optMetas.textContent = "🎯 Metas de Mercado";
	select.appendChild(optMetas);

	// 8. Histórico Geral com todas as outras semanas cadastradas
	if (todasSemanasFilial.length > 0) {
		const grupoHistorico = document.createElement("optgroup");
		grupoHistorico.label = "Histórico Geral de Semanas";

		todasSemanasFilial.forEach((s) => {
			const chave = `${s.data_inicio}|${s.data_final}`;
			if (chave !== periodoAtual) {
				const opt = document.createElement("option");
				opt.value = `data:${chave}`;
				opt.textContent = `Semana de ${formatarDataBR(s.data_inicio)} a ${formatarDataBR(s.data_final)}`;
				grupoHistorico.appendChild(opt);
			}
		});

		if (grupoHistorico.children.length > 0) {
			select.appendChild(grupoHistorico);
		}
	}

	// Define sempre por padrão a primeira opção (Mesma Semana do Mês Anterior)
	select.value = valorPadraoInicial;

	// Listener para recalcular imediatamente ao trocar de opção
	select.onchange = async () => {
		await processarAnaliseComparativa();
	};
}

/**
 * Localiza a semana equivalente a N meses atrás
 */
function encontrarSemanaPorMesesAtras(dataInicioAtual, qtdMeses) {
	if (!todasSemanasFilial || todasSemanasFilial.length === 0) return null;

	const diasAlvo = qtdMeses * 28;
	const dataAlvo = new Date(dataInicioAtual);
	dataAlvo.setDate(dataAlvo.getDate() - diasAlvo);

	let melhorSemana = null;
	let menorDiferenca = Infinity;

	todasSemanasFilial.forEach((s) => {
		const chave = `${s.data_inicio}|${s.data_final}`;
		if (chave === periodoAtual) return;

		const dInicio = new Date(`${s.data_inicio}T12:00:00`);
		const diffDias = Math.abs((dInicio - dataAlvo) / (1000 * 60 * 60 * 24));

		if (diffDias < menorDiferenca && diffDias <= 14) {
			menorDiferenca = diffDias;
			melhorSemana = s;
		}
	});

	return melhorSemana;
}

/**
 * Processa a análise comparativa entre a semana atual e a semana selecionada
 */
async function processarAnaliseComparativa() {
	const select = document.getElementById("select-comparar-diagnostico");
	const tipoComparacao = select ? select.value : "semana_2";

	const regAtual = registrosSemanasAtuais[0];
	if (!regAtual) return;

	let regComparacao = null;
	const _comparandoComMeta = tipoComparacao === "metas_mercado";

	if (tipoComparacao === "semana_2") {
		regComparacao = registrosSemanasAtuais[1] || null;
	} else if (tipoComparacao === "semana_3") {
		regComparacao = registrosSemanasAtuais[2] || null;
	} else if (tipoComparacao === "semana_4") {
		regComparacao = registrosSemanasAtuais[3] || null;
	} else if (tipoComparacao.startsWith("data:")) {
		const datas = tipoComparacao.replace("data:", "").split("|");
		const dataFim = datas[1];

		const emMemoria = registrosSemanasAtuais.find(
			(r) => r.data_final === dataFim,
		);
		if (emMemoria) {
			regComparacao = emMemoria;
		} else {
			// Busca pontual de apenas 1 registro no banco
			const { data: regHistorico } = await supabaseInstancia
				.from("dados_lojas")
				.select("*")
				.eq("filial", filialAtual)
				.eq("data_final", dataFim)
				.maybeSingle();

			regComparacao = regHistorico;
		}
	}

	gerarRelatorioInsights(regAtual, regComparacao);
}

/**
 * Analisa todos os indicadores e gera os cards detalhados de Pontos Fortes e Pontos de Atenção
 */
function gerarRelatorioInsights(atual, comp) {
	const listaFortes = document.getElementById("diagnostico-pontos-fortes");
	const listaAtencao = document.getElementById("diagnostico-pontos-atencao");

	const badgePositivos = document.getElementById(
		"contador-diagnostico-positivo",
	);
	const badgeAtencao = document.getElementById("contador-diagnostico-atencao");

	if (!listaFortes || !listaAtencao) return;

	listaFortes.innerHTML = "";
	listaAtencao.innerHTML = "";

	const pontosFortes = [];
	const pontosAtencao = [];

	// Metas de Referência do Mercado Farmacêutico
	const METAS = {
		cmv: 0.63, // <= 63%
		desconto: 0.3, // <= 30%
		falta: 0.09, // <= 9%
		aproveitamento: 0.6, // >= 60%
		ticket_medio: 50.0, // >= R$ 50,00
		itens_cliente: 2.5, // >= 2,5 itens
		cobertura_max: 60, // <= 60 dias
		excesso_max: 40, // <= 40
		eas_max: 0.2, // <= 20%
	};

	// Identificação do período comparado
	const labelComp = comp
		? `período comparado (${formatarDataBR(comp.data_inicio)} a ${formatarDataBR(comp.data_final)})`
		: "período de referência";

	// 1. VENDA LÍQUIDA
	const vAtual = parseFloat(atual.venda_liquida) || 0;
	if (vAtual > 0) {
		if (comp?.venda_liquida) {
			const vComp = parseFloat(comp.venda_liquida) || 0;
			const deltaV = vComp > 0 ? ((vAtual - vComp) / vComp) * 100 : 0;
			const diffNominal = vAtual - vComp;

			if (deltaV >= 0) {
				pontosFortes.push({
					titulo: "Venda Líquida em Alta",
					texto: `Faturamento atual de <strong>${formatarMoeda(vAtual)}</strong> cresceu ${formatarMoeda(diffNominal)} (+${deltaV.toFixed(1)}%) em relação a ${formatarMoeda(vComp)} no ${labelComp}.`,
					delta: `+${deltaV.toFixed(1)}%`,
					tipoDelta: "positivo",
				});
			} else {
				pontosAtencao.push({
					titulo: "Queda na Venda Líquida",
					texto: `Faturamento atual de <strong>${formatarMoeda(vAtual)}</strong> recuou ${formatarMoeda(Math.abs(diffNominal))} (${deltaV.toFixed(1)}%) comparado a ${formatarMoeda(vComp)} no ${labelComp}.`,
					delta: `${deltaV.toFixed(1)}%`,
					tipoDelta: "negativo",
				});
			}
		} else {
			pontosFortes.push({
				titulo: "Venda Líquida Realizada",
				texto: `Faturamento registrado na semana: <strong>${formatarMoeda(vAtual)}</strong>.`,
				delta: "Semana OK",
				tipoDelta: "positivo",
			});
		}
	}

	// 2. QUANTIDADE DE CLIENTES
	const cAtual = parseFloat(atual.qtd_cliente) || 0;
	if (cAtual > 0) {
		if (comp?.qtd_cliente) {
			const cComp = parseFloat(comp.qtd_cliente) || 0;
			const deltaC = cComp > 0 ? ((cAtual - cComp) / cComp) * 100 : 0;
			const diffC = cAtual - cComp;

			if (deltaC >= 0) {
				pontosFortes.push({
					titulo: "Fluxo de Clientes Positivo",
					texto: `A loja atendeu <strong>${cAtual.toLocaleString("pt-BR")} clientes</strong> na semana, um aumento de ${formatarDeltaNominal(diffC)} atendimentos (+${deltaC.toFixed(1)}%) vs ${labelComp}.`,
					delta: `+${deltaC.toFixed(1)}%`,
					tipoDelta: "positivo",
				});
			} else {
				pontosAtencao.push({
					titulo: "Redução no Fluxo de Clientes",
					texto: `A loja atendeu <strong>${cAtual.toLocaleString("pt-BR")} clientes</strong>, recuo de ${Math.abs(diffC).toLocaleString("pt-BR")} atendimentos (${deltaC.toFixed(1)}%) vs ${cComp.toLocaleString("pt-BR")} no ${labelComp}.`,
					delta: `${deltaC.toFixed(1)}%`,
					tipoDelta: "negativo",
				});
			}
		}
	}

	// 3. CMV (Custo da Mercadoria Vendida)
	const cmvAtual = normalizarPercentual(atual.cmv);
	if (cmvAtual > 0) {
		const cmvComp = comp ? normalizarPercentual(comp.cmv) : 0;
		const deltaCMVPp = cmvComp > 0 ? (cmvAtual - cmvComp) * 100 : 0;
		const atingiuMeta = cmvAtual <= METAS.cmv;

		if (atingiuMeta) {
			let desc = `CMV controlado em <strong>${(cmvAtual * 100).toFixed(1)}%</strong> dentro da meta (<= 63,0%).`;
			if (cmvComp > 0) {
				desc += ` (Comparado a ${(cmvComp * 100).toFixed(1)}% no ${labelComp}: ${deltaCMVPp > 0 ? "+" : ""}${deltaCMVPp.toFixed(1)} p.p.).`;
			}
			pontosFortes.push({
				titulo: "CMV Saudável (Meta Batida)",
				texto: desc,
				delta: "Meta OK",
				tipoDelta: "positivo",
			});
		} else {
			let desc = `CMV em <strong>${(cmvAtual * 100).toFixed(1)}%</strong> está acima do teto recomendado de 63,0%.`;
			if (cmvComp > 0) {
				desc += ` No ${labelComp} o CMV era de ${(cmvComp * 100).toFixed(1)}% (${deltaCMVPp > 0 ? "+" : ""}${deltaCMVPp.toFixed(1)} p.p.).`;
			}
			pontosAtencao.push({
				titulo: "CMV Elevado (Alerta de Margem)",
				texto: desc,
				delta: "Acima da Meta",
				tipoDelta: "negativo",
			});
		}
	}

	// 4. DESCONTO
	const descAtual = normalizarPercentual(atual.desconto);
	if (descAtual > 0) {
		const descComp = comp ? normalizarPercentual(comp.desconto) : 0;
		const deltaDescPp = descComp > 0 ? (descAtual - descComp) * 100 : 0;
		const atingiuMetaDesc = descAtual <= METAS.desconto;

		if (atingiuMetaDesc) {
			let textoDesc = `Desconto concedido em <strong>${(descAtual * 100).toFixed(1)}%</strong> respeitando o teto de 30,0%.`;
			if (descComp > 0) {
				textoDesc += ` (No ${labelComp}: ${(descComp * 100).toFixed(1)}%).`;
			}
			pontosFortes.push({
				titulo: "Desconto Controlado",
				texto: textoDesc,
				delta: "Meta OK",
				tipoDelta: "positivo",
			});
		} else {
			let textoDesc = `Desconto em <strong>${(descAtual * 100).toFixed(1)}%</strong> ultrapassa o limite de 30,0%.`;
			if (descComp > 0) {
				textoDesc += ` Variação de ${deltaDescPp > 0 ? "+" : ""}${deltaDescPp.toFixed(1)} p.p. vs ${(descComp * 100).toFixed(1)}% no ${labelComp}.`;
			}
			pontosAtencao.push({
				titulo: "Desconto Acima do Padrão",
				texto: textoDesc,
				delta: "Atenção",
				tipoDelta: "negativo",
			});
		}
	}

	// 5. FALTA DE PRODUTOS (RUPTURA)
	const faltaAtual = normalizarPercentual(atual.falta);
	if (faltaAtual > 0) {
		const faltaComp = comp ? normalizarPercentual(comp.falta) : 0;
		const atingiuMetaFalta = faltaAtual <= METAS.falta;

		if (atingiuMetaFalta) {
			let textoFalta = `Índice de falta de estoque em <strong>${(faltaAtual * 100).toFixed(1)}%</strong> dentro da meta (<= 9,0%).`;
			if (faltaComp > 0) {
				textoFalta += ` (No ${labelComp}: ${(faltaComp * 100).toFixed(1)}%).`;
			}
			pontosFortes.push({
				titulo: "Baixa Ruptura de Estoque",
				texto: textoFalta,
				delta: "Estoque OK",
				tipoDelta: "positivo",
			});
		} else {
			let textoFalta = `Ruptura de estoque em <strong>${(faltaAtual * 100).toFixed(1)}%</strong> acima da meta máxima de 9,0%.`;
			if (faltaComp > 0) {
				textoFalta += ` Comparado a ${(faltaComp * 100).toFixed(1)}% no ${labelComp}.`;
			}
			pontosAtencao.push({
				titulo: "Ruptura / Falta de Estoque",
				texto: textoFalta,
				delta: "Crítico",
				tipoDelta: "negativo",
			});
		}
	}

	// 6. APROVEITAMENTO
	const aprovAtual = normalizarPercentual(atual.aproveitamento);
	if (aprovAtual > 0) {
		const aprovComp = comp ? normalizarPercentual(comp.aproveitamento) : 0;
		const atingiuMetaAprov = aprovAtual >= METAS.aproveitamento;

		if (atingiuMetaAprov) {
			pontosFortes.push({
				titulo: "Excelente Aproveitamento",
				texto: `Aproveitamento promocional em <strong>${(aprovAtual * 100).toFixed(1)}%</strong> bateu a meta (>= 60,0%).${aprovComp > 0 ? ` (No ${labelComp}: ${(aprovComp * 100).toFixed(1)}%).` : ""}`,
				delta: "Meta Batida",
				tipoDelta: "positivo",
			});
		} else {
			pontosAtencao.push({
				titulo: "Aproveitamento Abaixo da Meta",
				texto: `Aproveitamento promocional em <strong>${(aprovAtual * 100).toFixed(1)}%</strong> abaixo da meta de 60,0%.${aprovComp > 0 ? ` (No ${labelComp}: ${(aprovComp * 100).toFixed(1)}%).` : ""}`,
				delta: "Abaixo da Meta",
				tipoDelta: "negativo",
			});
		}
	}

	// 7. TICKET MÉDIO
	const ticketAtual = parseFloat(atual.ticket_medio) || 0;
	if (ticketAtual > 0) {
		const ticketComp = comp ? parseFloat(comp.ticket_medio) || 0 : 0;
		const deltaTicket =
			ticketComp > 0 ? ((ticketAtual - ticketComp) / ticketComp) * 100 : 0;

		if (ticketAtual >= METAS.ticket_medio) {
			pontosFortes.push({
				titulo: "Ticket Médio Forte",
				texto: `Ticket médio atual em <strong>${formatarMoeda(ticketAtual)}</strong> atingiu a meta (>= R$ 50,00).${ticketComp > 0 ? ` (+${deltaTicket.toFixed(1)}% vs ${formatarMoeda(ticketComp)}).` : ""}`,
				delta: "Meta Batida",
				tipoDelta: "positivo",
			});
		} else if (ticketComp > 0 && deltaTicket >= 0) {
			pontosFortes.push({
				titulo: "Ticket Médio em Evolução",
				texto: `Ticket médio de <strong>${formatarMoeda(ticketAtual)}</strong> subiu +${deltaTicket.toFixed(1)}% em relação a ${formatarMoeda(ticketComp)} no ${labelComp}.`,
				delta: `+${deltaTicket.toFixed(1)}%`,
				tipoDelta: "positivo",
			});
		} else if (ticketComp > 0 && deltaTicket < 0) {
			pontosAtencao.push({
				titulo: "Ticket Médio em Queda",
				texto: `Ticket médio atual de <strong>${formatarMoeda(ticketAtual)}</strong> recuou ${deltaTicket.toFixed(1)}% em relação a ${formatarMoeda(ticketComp)} no ${labelComp}.`,
				delta: `${deltaTicket.toFixed(1)}%`,
				tipoDelta: "negativo",
			});
		}
	}

	// 8. ITENS POR CLIENTE
	const itensAtual = parseFloat(atual.itens_por_cliente) || 0;
	if (itensAtual > 0) {
		const itensComp = comp ? parseFloat(comp.itens_por_cliente) || 0 : 0;
		if (itensAtual >= METAS.itens_cliente) {
			pontosFortes.push({
				titulo: "Cesta de Produtos Completa",
				texto: `Média de <strong>${itensAtual.toFixed(2)} itens por cliente</strong> bateu a meta (>= 2,50).`,
				delta: "Meta Batida",
				tipoDelta: "positivo",
			});
		} else if (itensComp > 0 && itensAtual < itensComp) {
			pontosAtencao.push({
				titulo: "Itens por Cesta Reduzidos",
				texto: `Média de <strong>${itensAtual.toFixed(2)} itens por cliente</strong> (recuo frente a ${itensComp.toFixed(2)} no ${labelComp}).`,
				delta: `${(((itensAtual - itensComp) / itensComp) * 100).toFixed(1)}%`,
				tipoDelta: "negativo",
			});
		}
	}

	// 9. COBERTURA DE ESTOQUE
	const cobAtual = parseFloat(atual.cobertura) || 0;
	if (cobAtual > 0) {
		const cobComp = comp ? parseFloat(comp.cobertura) || 0 : 0;
		if (cobAtual > METAS.cobertura_max) {
			pontosAtencao.push({
				titulo: "Cobertura de Estoque Elevada",
				texto: `Estoque suficiente para <strong>${Math.round(cobAtual)} dias</strong> (Meta máxima: 60 dias).${cobComp > 0 ? ` No ${labelComp} era de ${Math.round(cobComp)} dias.` : ""}`,
				delta: "Estoque Alto",
				tipoDelta: "negativo",
			});
		} else if (cobAtual >= 40 && cobAtual <= 60) {
			pontosFortes.push({
				titulo: "Cobertura de Estoque Equilibrada",
				texto: `Estoque calibrado em <strong>${Math.round(cobAtual)} dias</strong> de giro seguro.`,
				delta: "Meta OK",
				tipoDelta: "positivo",
			});
		}
	}

	// 10. EAS (Aspectos do Salão / Eficiência)
	const easAtual = normalizarPercentual(atual.eas);
	if (easAtual > 0) {
		if (easAtual <= METAS.eas_max) {
			pontosFortes.push({
				titulo: "EAS Controlado",
				texto: `Índice EAS em <strong>${(easAtual * 100).toFixed(1)}%</strong> dentro do limite (<= 20,0%).`,
				delta: "Meta OK",
				tipoDelta: "positivo",
			});
		} else {
			pontosAtencao.push({
				titulo: "EAS Acima do Limite",
				texto: `Índice EAS em <strong>${(easAtual * 100).toFixed(1)}%</strong> acima da meta máxima recomendada de 20,0%.`,
				delta: "Atenção",
				tipoDelta: "negativo",
			});
		}
	}

	// Atualiza contadores no topo do card
	if (badgePositivos)
		badgePositivos.innerHTML = `<i class="fas fa-check-circle"></i> ${pontosFortes.length} Pontos Fortes`;
	if (badgeAtencao)
		badgeAtencao.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${pontosAtencao.length} Pontos de Atenção`;

	// Renderiza HTML das 2 listas
	listaFortes.innerHTML =
		pontosFortes
			.map(
				(p) => `
        <li class="item-insight">
            <strong>${p.titulo} ${p.delta ? `<span class="tag-delta tag-delta-${p.tipoDelta}">${p.delta}</span>` : ""}</strong>
            ${p.texto}
        </li>
    `,
			)
			.join("") ||
		'<li class="item-insight">Nenhum ponto forte identificado no comparativo.</li>';

	listaAtencao.innerHTML =
		pontosAtencao
			.map(
				(p) => `
        <li class="item-insight">
            <strong>${p.titulo} ${p.delta ? `<span class="tag-delta tag-delta-${p.tipoDelta}">${p.delta}</span>` : ""}</strong>
            ${p.texto}
        </li>
    `,
			)
			.join("") ||
		'<li class="item-insight">Nenhum desvio crítico identificado na semana.</li>';
}

function normalizarPercentual(valor) {
	if (valor === null || valor === undefined || valor === "") return 0;
	const num = parseFloat(valor);
	if (Number.isNaN(num)) return 0;
	return num > 1 ? num / 100 : num;
}

function formatarMoeda(num) {
	return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDeltaNominal(valor) {
	const formatado = Math.abs(Math.round(valor)).toLocaleString("pt-BR");
	return valor >= 0 ? `+${formatado}` : `-${formatado}`;
}

function formatarDataBR(dataSql) {
	if (!dataSql) return "";
	const [, mes, dia] = dataSql.split("-");
	return `${dia}/${mes}`;
}

export function alternarVisibilidadeDiagnostico() {
	const corpo = document.getElementById("corpo-diagnostico");
	const btn = document.getElementById("btn-toggle-diagnostico");
	if (!corpo || !btn) return;

	if (corpo.style.display === "none") {
		corpo.style.display = "block";
		btn.innerHTML = '<i class="fas fa-chevron-up"></i> Recolher';
	} else {
		corpo.style.display = "none";
		btn.innerHTML = '<i class="fas fa-chevron-down"></i> Expandir';
	}
}

window.alternarVisibilidadeDiagnostico = alternarVisibilidadeDiagnostico;
