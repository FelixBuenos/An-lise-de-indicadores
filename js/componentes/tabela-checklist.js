// js/componentes/tabela-checklist.js

export async function preencherTabelaChecklist(
	supabase,
	filialEscolhida,
	periodoEscolhido,
) {
	const partesData = periodoEscolhido.split("|");
	const dataFinal = partesData[1];

	const [ano, mes] = dataFinal.split("-");

	// Função auxiliar inteligente para calcular datas retroativas (M, M-1, M-2)
	function calcularDataMes(anoRef, mesRef, subtrairMeses) {
		let m = parseInt(mesRef, 10) - subtrairMeses;
		let a = parseInt(anoRef, 10);
		while (m <= 0) {
			m += 12;
			a--;
		}
		return `${a}-${String(m).padStart(2, "0")}-01`;
	}

	const dataMesAtual = calcularDataMes(ano, mes, 0);
	const dataMesAnterior = calcularDataMes(ano, mes, 1);
	const dataMesRetrasado = calcularDataMes(ano, mes, 2);

	// Variáveis para rastrear qual mês realmente vai aparecer na tela
	let dataUsadaAtual = dataMesAtual;
	let dataUsadaAnterior = dataMesAnterior;

	let { data: dataLojaAtual } = await supabase
		.from("nota_checklist_lojas")
		.select("area, nota")
		.eq("filial", filialEscolhida)
		.eq("data", dataMesAtual)
		.order("data", { ascending: false })
		.limit(1000);

	let { data: dataLojaAnterior } = await supabase
		.from("nota_checklist_lojas")
		.select("area, nota")
		.eq("filial", filialEscolhida)
		.eq("data", dataMesAnterior)
		.order("data", { ascending: false })
		.limit(1000);

	let { data: dataRede } = await supabase
		.from("media_checklist_rede")
		.select("area, media_rede")
		.eq("data", dataMesAtual)
		.order("data", { ascending: false })
		.limit(1000);

	// ====================================================================
	// LÓGICA DE FALLBACK: SE O MÊS ATUAL ESTIVER ZERADO, PUXA OS DADOS ANTIGOS
	// ====================================================================
	if (!dataLojaAtual || dataLojaAtual.length === 0) {
		// Atualiza as datas que vão aparecer no cabeçalho
		dataUsadaAtual = dataMesAnterior;
		dataUsadaAnterior = dataMesRetrasado;

		// A "Nota da Loja" atual vira o mês anterior
		dataLojaAtual = dataLojaAnterior;

		// O "Mês Anterior" precisa buscar a nota do mês retrasado
		const fallbackRetrasado = await supabase
			.from("nota_checklist_lojas")
			.select("area, nota")
			.eq("filial", filialEscolhida)
			.eq("data", dataMesRetrasado)
			.order("data", { ascending: false })
			.limit(1000);
		dataLojaAnterior = fallbackRetrasado.data || [];

		// A "Média da Rede" também escorrega para o mês anterior para a comparação ficar justa
		const fallbackRede = await supabase
			.from("media_checklist_rede")
			.select("area, media_rede")
			.eq("data", dataMesAnterior)
			.order("data", { ascending: false })
			.limit(1000);
		dataRede = fallbackRede.data || [];
	}

	// 3. CRIA OS DICIONÁRIOS DE MEMÓRIA PARA PREENCHIMENTO RÁPIDO
	const dicLojaAtual = {};
	if (dataLojaAtual) {
		dataLojaAtual.forEach((item) => {
			dicLojaAtual[item.area.trim().toLowerCase()] = item.nota;
		});
	}

	const dicLojaAnterior = {};
	if (dataLojaAnterior) {
		dataLojaAnterior.forEach((item) => {
			dicLojaAnterior[item.area.trim().toLowerCase()] = item.nota;
		});
	}

	const dicRede = {};
	if (dataRede) {
		dataRede.forEach((item) => {
			dicRede[item.area.trim().toLowerCase()] = item.media_rede;
		});
	}

	// 4. PREENCHIMENTO VISUAL
	const linhasTabela = document.querySelectorAll(".tabela-resumo tbody tr");

	linhasTabela.forEach((linha) => {
		const celulaArea = linha.querySelector(".coluna-fixa");

		if (celulaArea) {
			const nomeArea = celulaArea.textContent.trim();

			// ==============================================================
			// TRAVA DE SEGURANÇA REATIVADA PARA O ENCARTE
			// ==============================================================
			// Ignora a última linha porque o encarte é puxado da tabela checklist_encarte
			if (nomeArea === "Checklist promocional") {
				return;
			}

			const celulas = linha.querySelectorAll("td");
			const celulaMesAnterior = celulas[1];
			const celulaNotaLoja = celulas[2];
			const celulaMediaRede = celulas[3];

			const nomeAreaBusca = nomeArea.toLowerCase();

			// A. Preenche: MÉDIA DA REDE
			let mediaRedeNum = 0;
			if (dicRede[nomeAreaBusca] !== undefined) {
				mediaRedeNum = Math.round(dicRede[nomeAreaBusca]);
				celulaMediaRede.textContent = `${mediaRedeNum}%`;
			} else {
				celulaMediaRede.textContent = "-";
			}

			// B. Preenche: MÊS ANTERIOR
			if (dicLojaAnterior[nomeAreaBusca] !== undefined) {
				const notaMesAnteriorNum = Math.round(
					dicLojaAnterior[nomeAreaBusca] * 100,
				);
				celulaMesAnterior.textContent = `${notaMesAnteriorNum}%`;
			} else {
				celulaMesAnterior.textContent = "-";
			}

			// C. Preenche: NOTA DA LOJA ATUAL e APLICA CORES
			celulaNotaLoja.classList.remove("nota-verde", "nota-vermelha"); // Limpa cores velhas

			if (dicLojaAtual[nomeAreaBusca] !== undefined) {
				const notaLojaNum = Math.round(dicLojaAtual[nomeAreaBusca] * 100);
				celulaNotaLoja.textContent = `${notaLojaNum}%`;

				// --- REGRAS DE COLORAÇÃO ---
				if (notaLojaNum === 100) {
					celulaNotaLoja.classList.add("nota-verde");
				} else if (notaLojaNum < mediaRedeNum) {
					celulaNotaLoja.classList.add("nota-vermelha");
				} else if (notaLojaNum >= mediaRedeNum) {
					celulaNotaLoja.classList.add("nota-verde");
				}
			} else {
				celulaNotaLoja.textContent = "-";
			}
		}
	});

	// ====================================================================
	// 5. ATUALIZAÇÃO DOS TÍTULOS DAS COLUNAS COM O NOME DO MÊS
	// ====================================================================
	function obterNomeMes(dataString) {
		const numeroMes = parseInt(dataString.split("-")[1], 10);
		const nomesMeses = [
			"JAN",
			"FEV",
			"MAR",
			"ABR",
			"MAI",
			"JUN",
			"JUL",
			"AGO",
			"SET",
			"OUT",
			"NOV",
			"DEZ",
		];
		return nomesMeses[numeroMes - 1];
	}

	const thMesAnterior = document.getElementById("th-mes-anterior");
	const thNotaLoja = document.getElementById("th-nota-loja");

	if (thMesAnterior && thNotaLoja) {
		thMesAnterior.textContent = `MÊS ANTERIOR (${obterNomeMes(dataUsadaAnterior)})`;
		thNotaLoja.textContent = `NOTA LOJA (${obterNomeMes(dataUsadaAtual)})`;
	}

	// ====================================================================
	// 6. BUSCA ESPECÍFICA PARA O ENCARTE PROMOCIONAL (MÊS ANTERIOR)
	// ====================================================================
	// Tabela: checklist_encarte | Coluna Loja: unidade | Coluna Nota: resultado

	try {
		const { data: dataEncarteAnterior } = await supabase
			.from("checklist_encarte")
			.select("resultado")
			.eq("unidade", filialEscolhida) // Mapeamento correto da coluna 'unidade'
			.eq("data", dataUsadaAnterior)
			.order("data", { ascending: false })
			.limit(1)
			.single();

		const tdMesAnteriorEncarte = document.getElementById(
			"mes-anterior-checklist-encarte",
		);

		if (tdMesAnteriorEncarte) {
			if (dataEncarteAnterior && dataEncarteAnterior.resultado !== null) {
				tdMesAnteriorEncarte.textContent = `${Math.round(dataEncarteAnterior.resultado)}%`;
			} else {
				tdMesAnteriorEncarte.textContent = "-";
			}
		}
	} catch {
		console.warn(
			"Nenhum dado de encarte anterior encontrado para a filial:",
			filialEscolhida,
		);
	}
}
