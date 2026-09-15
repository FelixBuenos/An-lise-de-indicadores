// js/componentes/tabela-media.js

export async function preencherTabelaMedia(
	supabase,
	filialEscolhida,
	periodoEscolhido,
) {
	const partesData = periodoEscolhido.split("|");
	const dataFinalAtualStr = partesData[1];

	const { data: registrosLoja, error: erroLoja } = await supabase
		.from("tabela_completa")
		.select("*")
		.eq("filial", filialEscolhida)
		.eq("data_final", dataFinalAtualStr)
		.order("data_final", { ascending: false })
		.limit(1);

	if (erroLoja) {
		console.error("Erro na tabela_completa:", erroLoja);
		return;
	}

	const dadosLoja =
		registrosLoja && registrosLoja.length > 0 ? registrosLoja[0] : null;
	if (!dadosLoja) return;

	const classeLoja = dadosLoja?.cluster || dadosLoja?.status;
	if (!classeLoja) return;

	// Preenche a Linha 1 (Média da Classe)
	await preencherLinhaMediaClasseComFerramenta(
		supabase,
		dadosLoja,
		filialEscolhida,
		dataFinalAtualStr,
	);

	// 2. PREPARAÇÃO DA BUSCA NA META_CLUSTER (Cobre Classe 1 até Classe 5)
	const clusterIdentificado = String(
		dadosLoja?.cluster || dadosLoja?.status || "",
	).trim();
	const clusterNormalizado = clusterIdentificado
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");

	let termoBuscaCluster = "classe 2";
	if (
		clusterNormalizado.includes("classe 1") ||
		clusterNormalizado === "alto" ||
		clusterNormalizado === "alta"
	) {
		termoBuscaCluster = "classe 1";
	} else if (
		clusterNormalizado.includes("classe 2") ||
		clusterNormalizado === "medio" ||
		clusterNormalizado === "media"
	) {
		termoBuscaCluster = "classe 2";
	} else if (
		clusterNormalizado.includes("classe 3") ||
		clusterNormalizado === "baixo" ||
		clusterNormalizado === "baixa"
	) {
		termoBuscaCluster = "classe 3";
	} else if (clusterNormalizado.includes("classe 4")) {
		termoBuscaCluster = "classe 4";
	} else if (
		clusterNormalizado.includes("classe 5") ||
		clusterNormalizado === "critico"
	) {
		termoBuscaCluster = "classe 5";
	}

	// Busca as metas ignorando espaços em branco
	const { data: metasCluster, error: erroMercado } = await supabase
		.from("meta_cluster")
		.select("*")
		.ilike("cluster", `%${termoBuscaCluster}%`);

	if (erroMercado) {
		console.error("Erro ao buscar meta_cluster:", erroMercado);
		return;
	}

	// 3. PREENCHIMENTO NO HTML (AJUSTADO PARA A LINHA DO MEIO - ÍNDICE 1)
	const linhasTabelaLarga = document.querySelectorAll(".tabela-larga tbody tr");
	const linhaMediaMercado = linhasTabelaLarga[1]; // Segunda linha (linha do meio)
	const celulasMeta = linhaMediaMercado.querySelectorAll("td");

	const mapaIndicadores = {
		"venda liquida": 1,
		"qtd cliente": 2,
		"itens por cliente": 3,
		aproveitamento: 4,
		"ticket medio": 5,
		cmv: 6,
		desconto: 7,
		cobertura: 8,
		excesso: 9,
		falta: 10,
	};

	// Limpa a linha com traços por defeito
	for (let i = 1; i <= 10; i++) {
		celulasMeta[i].textContent = "-";
	}

	if (metasCluster && metasCluster.length > 0) {
		metasCluster.forEach((meta) => {
			if (!meta.indicador) return;

			const indicadorNome = meta.indicador
				.trim()
				.toLowerCase()
				.normalize("NFD")
				.replace(/[\u0300-\u036f]/g, "");
			const colunaIndex = mapaIndicadores[indicadorNome];

			if (colunaIndex) {
				// Define formatação
				let tipoFormato = "moeda";
				if (indicadorNome === "itens por cliente") tipoFormato = "decimal";
				else if (indicadorNome === "qtd cliente")
					tipoFormato = "inteiro_formatado";
				else if (["cobertura", "excesso"].includes(indicadorNome))
					tipoFormato = "inteiro_puro";
				else if (
					["aproveitamento", "cmv", "desconto", "falta", "eas"].includes(
						indicadorNome,
					)
				)
					tipoFormato = "percentual";

				// Pega apenas o valor máximo e o operador máximo
				const valorMax = meta.valor_max;
				const opMax =
					meta.operador_max && meta.operador_max !== "EMPTY"
						? meta.operador_max.trim()
						: "";

				let textoFinal = "-";

				// Se existir um valor máximo no banco, formata com o operador
				if (valorMax !== null && valorMax !== undefined) {
					textoFinal =
						`${opMax} ${formatarValor(valorMax, tipoFormato)}`.trim();
				}

				celulasMeta[colunaIndex].textContent = textoFinal;
			}
		});
	} else {
		console.warn(
			"A busca na meta_cluster não retornou nenhuma linha! Verifique o RLS.",
		);
	}
}

async function preencherLinhaMediaClasseComFerramenta(
	supabase,
	dadosClasse,
	filialEscolhida,
	dataFinalAtualStr,
) {
	if (!dadosClasse) return;
	const linhasTabelaLarga = document.querySelectorAll(".tabela-larga tbody tr");
	const linhaMediaClasse = linhasTabelaLarga[0];
	const celulas = linhaMediaClasse.querySelectorAll("td");

	// =========================================================
	// CÁLCULO DA MÉDIA DE QTD CLIENTE POR CLASSE (CLUSTER)
	// =========================================================
	let mediaQtdCliente = null;

	try {
		const clusterAlvo = String(dadosClasse.cluster || "").trim();
		const clusterAlvoNorm = clusterAlvo
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "");
		const statusAlvo = String(dadosClasse.status || "").trim();
		const statusAlvoNorm = statusAlvo
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "");

		// 1. Busca todas as filiais da mesma semana para obter o conjunto de lojas da mesma classe
		let { data: registrosClasse } = await supabase
			.from("tabela_completa")
			.select("filial, cluster, status, qtd_cliente")
			.eq("data_final", dataFinalAtualStr);

		// Se não encontrar registros para a data_final, busca a listagem geral com cluster definido
		if (!registrosClasse || registrosClasse.length === 0) {
			const { data: todosRegistros } = await supabase
				.from("tabela_completa")
				.select("filial, cluster, status, qtd_cliente")
				.not("filial", "is", null);
			registrosClasse = todosRegistros;
		}

		if (registrosClasse && registrosClasse.length > 0) {
			// Filtra as lojas que pertencem rigorosamente ao mesmo cluster/classe
			const lojasMesmaClasse = registrosClasse.filter((r) => {
				if (clusterAlvoNorm) {
					const c = String(r.cluster || "")
						.toLowerCase()
						.normalize("NFD")
						.replace(/[\u0300-\u036f]/g, "")
						.trim();
					if (c) return c === clusterAlvoNorm;
				}
				if (statusAlvoNorm) {
					const s = String(r.status || "")
						.toLowerCase()
						.normalize("NFD")
						.replace(/[\u0300-\u036f]/g, "")
						.trim();
					return s === statusAlvoNorm;
				}
				return false;
			});

			// Evita duplicação caso haja mais de um registro para a mesma filial
			const mapaFiliais = new Map();
			lojasMesmaClasse.forEach((r) => {
				const nome = (r.filial || "").trim();
				if (nome && !mapaFiliais.has(nome)) {
					mapaFiliais.set(nome, r);
				}
			});
			const listaLojasUnicas = Array.from(mapaFiliais.values());

			// Verifica se a tabela_completa já possui a coluna qtd_cliente preenchida
			const qtdsDiretas = listaLojasUnicas
				.map((r) => parseFloat(r.qtd_cliente))
				.filter((v) => !Number.isNaN(v) && v > 0);

			if (qtdsDiretas.length > 0) {
				const soma = qtdsDiretas.reduce((a, b) => a + b, 0);
				mediaQtdCliente = soma / qtdsDiretas.length;
			} else {
				// Pega os nomes das filiais da classe e busca os valores da semana em dados_lojas
				const nomesFiliais = listaLojasUnicas
					.map((r) => r.filial)
					.filter(Boolean);

				if (nomesFiliais.length > 0) {
					const { data: dadosSemana } = await supabase
						.from("dados_lojas")
						.select("filial, qtd_cliente")
						.eq("data_final", dataFinalAtualStr)
						.in("filial", nomesFiliais);

					if (dadosSemana && dadosSemana.length > 0) {
						const valoresValidos = dadosSemana
							.map((r) => parseFloat(r.qtd_cliente))
							.filter((v) => !Number.isNaN(v) && v > 0);

						if (valoresValidos.length > 0) {
							const soma = valoresValidos.reduce((a, b) => a + b, 0);
							mediaQtdCliente = soma / valoresValidos.length;
						}
					}
				}
			}
		}
	} catch (errCalculo) {
		console.error(
			"Erro ao calcular média de Qtd Cliente da classe:",
			errCalculo,
		);
	}

	celulas[1].textContent = formatarValor(
		dadosClasse.media_venda_liquida,
		"moeda",
	);
	celulas[2].textContent = formatarValor(mediaQtdCliente, "inteiro_formatado");
	celulas[3].textContent = formatarValor(
		dadosClasse.media_itens_por_cliente,
		"decimal",
	);
	celulas[4].textContent = formatarValor(
		dadosClasse.media_aproveitamento,
		"percentual",
	);
	celulas[5].textContent = formatarValor(
		dadosClasse.media_ticket_medio,
		"moeda",
	);
	celulas[6].textContent = formatarValor(dadosClasse.media_cmv, "percentual");
	celulas[8].textContent = formatarValor(
		dadosClasse.media_cobertura,
		"inteiro_puro",
	);
	celulas[9].textContent = formatarValor(
		dadosClasse.media_excesso,
		"inteiro_puro",
	);
	celulas[10].textContent = formatarValor(
		dadosClasse.media_falta,
		"percentual",
	);

	// =========================================================
	// CÁLCULO ESPECÍFICO DE DESCONTO POR FERRAMENTA (Analysis / Pricing)
	// =========================================================
	let valorDescontoFormatado = formatarValor(
		dadosClasse.media_desconto,
		"percentual",
	);
	let badgeFerramentaHtml = "";

	try {
		// 1. Busca os registros da tabela de ferramentas
		const { data: todasFerramentas, error: errFerramentas } = await supabase
			.from("lojas_ferramenta_desconto")
			.select("*");

		if (!errFerramentas && todasFerramentas && todasFerramentas.length > 0) {
			// Localiza a ferramenta da filial atual
			const filialLimpa = filialEscolhida.trim().toLowerCase();
			const configLoja = todasFerramentas.find((item) => {
				const nomeLoja = (item.loja || item.lojas || item.filial || "")
					.trim()
					.toLowerCase();
				return (
					nomeLoja === filialLimpa ||
					filialLimpa.includes(nomeLoja) ||
					nomeLoja.includes(filialLimpa)
				);
			});

			const ferramentaRaw =
				configLoja?.ferramenta_desconto || configLoja?.ferramento_desconto;

			if (ferramentaRaw) {
				const ferramenta = ferramentaRaw.trim().toUpperCase();
				badgeFerramentaHtml = `<div style="font-size: 0.72rem; font-weight: 700; color: #0284c7; text-transform: uppercase; margin-top: 3px; letter-spacing: 0.5px;">[${ferramenta}]</div>`;

				// 2. Filtra todas as lojas cadastradas que utilizam a mesma ferramenta
				const nomesLojasMesmaFerramenta = todasFerramentas
					.filter((item) => {
						const ferr = (
							item.ferramenta_desconto ||
							item.ferramento_desconto ||
							""
						)
							.trim()
							.toUpperCase();
						return ferr === ferramenta;
					})
					.map((item) => item.loja || item.lojas || item.filial)
					.filter(Boolean);

				if (nomesLojasMesmaFerramenta.length > 0) {
					// 3. Busca o desconto das lojas da MESMA CLASSE e MESMA SEMANA que usam essa ferramenta
					let queryClasseFerramenta = supabase
						.from("tabela_completa")
						.select("desconto, filial, cluster, status")
						.eq("data_final", dataFinalAtualStr)
						.in("filial", nomesLojasMesmaFerramenta);

					if (dadosClasse.cluster) {
						queryClasseFerramenta = queryClasseFerramenta.eq(
							"cluster",
							dadosClasse.cluster,
						);
					} else if (dadosClasse.status) {
						queryClasseFerramenta = queryClasseFerramenta.eq(
							"status",
							dadosClasse.status,
						);
					}

					const { data: registrosClasseFerramenta, error: errRegistros } =
						await queryClasseFerramenta;

					if (
						!errRegistros &&
						registrosClasseFerramenta &&
						registrosClasseFerramenta.length > 0
					) {
						const descontosValidos = registrosClasseFerramenta
							.map((r) => r.desconto)
							.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));

						if (descontosValidos.length > 0) {
							const soma = descontosValidos.reduce(
								(total, num) => total + Number(num),
								0,
							);
							const media = soma / descontosValidos.length;
							valorDescontoFormatado = formatarValor(media, "percentual");
						}
					}
				}
			}
		}
	} catch (e) {
		console.warn(
			"Não foi possível calcular o desconto individual por ferramenta:",
			e,
		);
	}

	// Injeta o valor do desconto com a badge identificadora embaixo
	celulas[7].innerHTML = `<div>${valorDescontoFormatado}</div>${badgeFerramentaHtml}`;
}

function formatarValor(valor, tipo) {
	if (valor === null || valor === undefined || valor === "") return "-";
	const num = parseFloat(valor);
	if (Number.isNaN(num)) return "-";

	switch (tipo) {
		case "moeda":
			return num.toLocaleString("pt-BR", {
				style: "currency",
				currency: "BRL",
			});
		case "percentual": {
			const valorPercentual = num <= 1 && num > 0 ? num * 100 : num;
			return `${valorPercentual.toFixed(1).replace(".", ",")}%`;
		}
		case "decimal":
			return num.toFixed(2).replace(".", ",");
		case "inteiro_formatado":
			return Math.round(num).toLocaleString("pt-BR");
		case "inteiro_puro":
			return Math.round(num).toString();
		default:
			return num.toString();
	}
}
