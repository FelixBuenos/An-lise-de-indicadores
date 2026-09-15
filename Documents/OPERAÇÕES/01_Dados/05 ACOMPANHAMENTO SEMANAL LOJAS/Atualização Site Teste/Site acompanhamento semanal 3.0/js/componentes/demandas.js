// js/componentes/demandas.js

import { supabase } from "../servicos/supabaseClient.js";

// ==========================================
// VARIÁVEIS GLOBAIS
// ==========================================
let analistaLogado = null;
let ehGestorLogado = false;
let todasDemandasDoBanco = [];
let demandasFiltradas = [];
let ordemDataAsc = true; // true = mais antigo para mais novo; false = mais novo para mais antigo

// ==========================================
// VERIFICAÇÃO DE GESTOR VIA BANCO DE DADOS
// ==========================================
async function checarPerfilGestorNoBanco(emailUsuario) {
	if (!emailUsuario) return false;

	try {
		const { data, error } = await supabase
			.from("gestores")
			.select("email")
			.ilike("email", emailUsuario.trim())
			.limit(1);

		if (error) {
			console.warn(
				"Tabela de gestores não encontrada ou erro na consulta:",
				error.message,
			);
			return false;
		}

		return data && data.length > 0;
	} catch (err) {
		console.error("Erro ao verificar gestor:", err);
		return false;
	}
}

// ==========================================
// PROTEÇÃO DE ROTA E INICIALIZAÇÃO
// ==========================================
async function iniciarSistema() {
	// Verificar sessão
	const {
		data: { session },
	} = await supabase.auth.getSession();
	if (!session) {
		window.location.href = "login.html";
		return;
	}

	// Obter email ou nome do usuário logado obrigatoriamente
	analistaLogado =
		session.user.email || session.user.user_metadata?.name || null;

	// Consulta no banco de dados Supabase na tabela 'gestores'
	ehGestorLogado = await checarPerfilGestorNoBanco(analistaLogado);

	// Renderizar Badge de Perfil no cabeçalho
	const badgePerfil = document.getElementById("badge-perfil-usuario");
	if (badgePerfil) {
		badgePerfil.style.display = "inline-flex";
		if (ehGestorLogado) {
			badgePerfil.className = "badge-perfil-tag badge-perfil-gestor";
			badgePerfil.innerHTML =
				'<i class="fas fa-user-shield"></i> Administrador Geral (Acesso Total)';
			badgePerfil.title =
				"Você possui permissão de Administrador Geral para editar, concluir e excluir qualquer demanda.";
		} else {
			badgePerfil.className = "badge-perfil-tag badge-perfil-usuario";
			badgePerfil.innerHTML = `<i class="fas fa-user"></i> ${formatarNomeAnalista(analistaLogado)}`;
			badgePerfil.title = `Você pode visualizar todas as demandas, mas só pode alterar e excluir as demandas criadas por você (${analistaLogado}).`;
		}
	}

	// Inicializa campo de analista no modal de cadastro como somente leitura
	const inputCadAnalista = document.getElementById("cad-demanda-analista");
	if (inputCadAnalista && analistaLogado) {
		inputCadAnalista.value = analistaLogado;
		inputCadAnalista.readOnly = true;
	}

	// Inicializa campo de data no modal de cadastro
	const inputCadData = document.getElementById("cad-demanda-data");
	if (inputCadData) {
		inputCadData.value = new Date().toISOString().split("T")[0];
	}

	// Atualiza o ícone do cabeçalho de ordenação por data
	atualizarIconeOrdenacao();

	// Carregar lista de filiais nos selects
	await carregarFiltroLojas();

	// Carregar lista de criadores no filtro
	await carregarFiltroCriadores();

	// Carregar lista de ferramentas no filtro
	await carregarFiltroFerramentas();

	// Carregar demandas da tabela
	await carregarDemandas();

	// Configurar canal em tempo real (Supabase Realtime)
	configurarRealtime();

	// Configurar eventos
	configurarEventos();
}

// ==========================================
// CONFIGURAR SUPABASE REALTIME
// ==========================================
function configurarRealtime() {
	try {
		supabase
			.channel("demandas-mudancas-realtime")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "demandas" },
				() => {
					carregarDemandas(false); // Atualização silenciosa em tempo real
				},
			)
			.subscribe();
	} catch (e) {
		console.warn("Realtime não pôde ser inicializado:", e);
	}
}

// ==========================================
// ATUALIZAR ÍCONE DE ORDENAÇÃO POR DATA
// ==========================================
function atualizarIconeOrdenacao() {
	const icone = document.getElementById("icone-ordem-data");
	const thData = document.getElementById("th-ordenar-data");
	if (!icone || !thData) return;

	if (ordemDataAsc) {
		icone.className = "fas fa-sort-numeric-down";
		thData.title =
			"Ordenado do mais antigo para o mais novo. Clique para ver do mais novo para o mais antigo.";
	} else {
		icone.className = "fas fa-sort-numeric-down-alt";
		thData.title =
			"Ordenado do mais novo para o mais antigo. Clique para ver do mais antigo para o mais novo.";
	}
}

// ==========================================
// CARREGAR FILTRO DE LOJAS
// ==========================================
async function carregarFiltroLojas() {
	const selectFiltroLoja = document.getElementById("filtro-loja");
	const selectCadLoja = document.getElementById("cad-demanda-loja");

	// Busca lojas de dados_lojas e de demandas
	const [{ data: dadosLojas }, { data: dadosDemandas }] = await Promise.all([
		supabase.from("dados_lojas").select("filial").limit(2000),
		supabase.from("demandas").select("loja").limit(2000),
	]);

	const todasLojas = new Set();
	if (dadosLojas) {
		dadosLojas.forEach((d) => {
			if (d.filial) todasLojas.add(d.filial.trim());
		});
	}
	if (dadosDemandas) {
		dadosDemandas.forEach((d) => {
			if (d.loja) todasLojas.add(d.loja.trim());
		});
	}

	const lojasOrdenadas = Array.from(todasLojas).sort();

	// Preenche filtro de lojas na barra superior
	if (selectFiltroLoja) {
		const valorAtual = selectFiltroLoja.value;
		selectFiltroLoja.innerHTML = '<option value="">Todas</option>';
		lojasOrdenadas.forEach((loja) => {
			const option = document.createElement("option");
			option.value = loja;
			option.textContent = loja;
			selectFiltroLoja.appendChild(option);
		});
		if (valorAtual) selectFiltroLoja.value = valorAtual;
	}

	// Preenche select de lojas no modal de cadastro
	if (selectCadLoja) {
		selectCadLoja.innerHTML = '<option value="">Selecione a loja...</option>';
		lojasOrdenadas.forEach((loja) => {
			const option = document.createElement("option");
			option.value = loja;
			option.textContent = loja;
			selectCadLoja.appendChild(option);
		});
	}
}

// ==========================================
// CARREGAR FILTRO DE CRIADORES (CRIADO POR)
// ==========================================
async function carregarFiltroCriadores() {
	const selectCriador = document.getElementById("filtro-criador");
	if (!selectCriador) return;

	const { data, error } = await supabase
		.from("demandas")
		.select("analista")
		.limit(2000);

	if (error || !data) return;

	const criadoresUnicos = new Set();
	data.forEach((d) => {
		if (d.analista && d.analista.trim() !== "") {
			criadoresUnicos.add(d.analista.trim());
		}
	});

	const valorAtual = selectCriador.value;
	selectCriador.innerHTML = '<option value="">Todos</option>';

	Array.from(criadoresUnicos)
		.sort()
		.forEach((criador) => {
			const option = document.createElement("option");
			option.value = criador;
			option.textContent = formatarNomeAnalista(criador);
			selectCriador.appendChild(option);
		});

	if (valorAtual) selectCriador.value = valorAtual;
}

// ==========================================
// CARREGAR FILTRO DE FERRAMENTAS
// ==========================================
async function carregarFiltroFerramentas() {
	const selectFiltro = document.getElementById("filtro-ferramenta");
	if (!selectFiltro) return;

	const ferramentasPadrao = [
		"ERP",
		"APP CONVIVA",
		"PEC",
		"PBM",
		"GC",
		"FIDELIZA",
		"BÚSSOLA",
	];
	const todasFerramentas = new Set(ferramentasPadrao);

	const { data, error } = await supabase
		.from("demandas")
		.select("ferramenta")
		.limit(2000);

	if (!error && data) {
		data.forEach((d) => {
			if (d.ferramenta && d.ferramenta.trim() !== "") {
				todasFerramentas.add(d.ferramenta.trim());
			}
		});
	}

	const valorAtual = selectFiltro.value;
	selectFiltro.innerHTML = '<option value="">Todas</option>';
	Array.from(todasFerramentas)
		.sort()
		.forEach((ferr) => {
			const option = document.createElement("option");
			option.value = ferr;
			option.textContent = ferr;
			selectFiltro.appendChild(option);
		});

	if (valorAtual) selectFiltro.value = valorAtual;
}

// ==========================================
// FORMATAR NOME DO ANALISTA/CRIADOR
// ==========================================
function formatarNomeAnalista(analista) {
	if (!analista || analista.trim() === "") return "Não informado";

	// Se for e-mail (ex: felix.buenos@farmaciasconviva.com.br), formata para "Felix Buenos"
	if (analista.includes("@")) {
		const parteAntes = analista.split("@")[0];
		return parteAntes
			.replace(/\./g, " ")
			.replace(/_/g, " ")
			.replace(/\b\w/g, (l) => l.toUpperCase());
	}

	return analista;
}

// ==========================================
// ESCAPAR CARACTERES HTML
// ==========================================
function escaparHtml(str) {
	if (!str) return "";
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

// ==========================================
// CARREGAR DEMANDAS DO BANCO
// ==========================================
async function carregarDemandas() {
	const filtroLoja = document.getElementById("filtro-loja")?.value || "";
	const filtroFerramenta =
		document.getElementById("filtro-ferramenta")?.value || "";
	const filtroPrioridade =
		document.getElementById("filtro-prioridade")?.value || "";
	const filtroResponsavel =
		document.getElementById("filtro-responsavel")?.value || "";
	const filtroCriador = document.getElementById("filtro-criador")?.value || "";
	const filtroStatus = document.getElementById("filtro-status")?.value || "";

	const tbody = document.getElementById("corpo-tabela-demandas");
	const msgVazia = document.getElementById("msg-demandas-pagina-vazia");

	if (!tbody) return;

	// Construir query com ordenação dinâmica por data (Visível para todos os usuários)
	let query = supabase
		.from("demandas")
		.select("*")
		.order("data_criacao", { ascending: ordemDataAsc })
		.order("id", { ascending: ordemDataAsc });

	if (filtroLoja) {
		query = query.eq("loja", filtroLoja);
	}
	if (filtroFerramenta) {
		query = query.eq("ferramenta", filtroFerramenta);
	}
	if (filtroPrioridade) {
		query = query.eq("prioridade", filtroPrioridade);
	}
	if (filtroResponsavel) {
		query = query.eq("responsavel", filtroResponsavel);
	}
	if (filtroCriador) {
		query = query.eq("analista", filtroCriador);
	}
	if (filtroStatus) {
		query = query.eq("status", filtroStatus);
	}

	const { data, error } = await query.limit(1000);

	if (error) {
		console.error("Erro ao buscar demandas:", error);
		tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; color: #dc3545; padding: 40px;">
                    Erro ao carregar demandas. Tente novamente.
                </td>
            </tr>
        `;
		if (msgVazia) msgVazia.style.display = "none";
		atualizarContadores([], [], []);
		return;
	}

	todasDemandasDoBanco = data || [];
	aplicarBuscaRapida();
}

// ==========================================
// APLICAR BUSCA RÁPIDA (CLIENT-SIDE)
// ==========================================
function aplicarBuscaRapida() {
	const termoBusca = (
		document.getElementById("campo-busca-rapida")?.value || ""
	)
		.toLowerCase()
		.trim();

	if (!termoBusca) {
		demandasFiltradas = todasDemandasDoBanco;
	} else {
		demandasFiltradas = todasDemandasDoBanco.filter((d) => {
			const loja = (d.loja || "").toLowerCase();
			const desc = (d.descricao || "").toLowerCase();
			const ferramenta = (d.ferramenta || "").toLowerCase();
			const analista = (d.analista || "").toLowerCase();
			const responsavel = (d.responsavel || "").toLowerCase();
			const prioridade = (d.prioridade || "").toLowerCase();

			return (
				loja.includes(termoBusca) ||
				desc.includes(termoBusca) ||
				ferramenta.includes(termoBusca) ||
				analista.includes(termoBusca) ||
				responsavel.includes(termoBusca) ||
				prioridade.includes(termoBusca)
			);
		});
	}

	renderizarTabela(demandasFiltradas);
}

// ==========================================
// RENDERIZAR TABELA
// ==========================================
function renderizarTabela(data) {
	const tbody = document.getElementById("corpo-tabela-demandas");
	const msgVazia = document.getElementById("msg-demandas-pagina-vazia");

	if (!tbody) return;

	if (!data || data.length === 0) {
		tbody.innerHTML = "";
		if (msgVazia) {
			msgVazia.innerHTML = `
                <i class="fas fa-search" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 12px; display: block;"></i>
                ${!ehGestorLogado ? "Você ainda não possui demandas cadastradas com seu login." : "Nenhuma demanda encontrada para os filtros selecionados."}
            `;
			msgVazia.style.display = "block";
		}
		atualizarContadores([], [], []);
		return;
	}

	if (msgVazia) msgVazia.style.display = "none";

	// Separar para contadores
	const pendentes = data.filter((d) => d.status === "pendente");
	const concluidas = data.filter((d) => d.status === "concluido");
	atualizarContadores(data, pendentes, concluidas);

	const hojeStr = new Date().toISOString().split("T")[0];

	// Renderizar tabela
	tbody.innerHTML = data
		.map((demanda, index) => {
			const ehConcluida = demanda.status === "concluido";
			const classeRow = ehConcluida ? "demanda-row-concluida" : "";

			// Badge de responsável
			let classeBadgeResp = "";
			let iconeResp = "";
			switch (demanda.responsavel) {
				case "Operações":
					classeBadgeResp = "badge-resp-operacoes";
					iconeResp = '<i class="fas fa-cogs"></i>';
					break;
				case "Associado":
					classeBadgeResp = "badge-resp-associado";
					iconeResp = '<i class="fas fa-user-tie"></i>';
					break;
				default:
					classeBadgeResp = "badge-resp-operacoes";
					iconeResp = '<i class="fas fa-tag"></i>';
			}

			// Badge de prioridade
			const prioridade = demanda.prioridade || "Média";
			let classeBadgePrioridade = "badge-prioridade-media";
			let iconePrioridade = "";
			if (prioridade === "Alta") {
				classeBadgePrioridade = "badge-prioridade-alta";
				iconePrioridade = "";
			} else if (prioridade === "Baixa") {
				classeBadgePrioridade = "badge-prioridade-baixa";
				iconePrioridade = "";
			}

			// Badge de prazo / SLA
			let prazoHtml =
				'<span style="color: #94a3b8; font-size: 0.8rem;">-</span>';
			if (demanda.prazo) {
				const dataPrazoBr = formatarDataBr(demanda.prazo);
				if (!ehConcluida && demanda.prazo < hojeStr) {
					prazoHtml = `<span class="badge-prazo badge-prazo-atrasado" title="Prazo expirado em ${dataPrazoBr}"><i class="fas fa-exclamation-triangle"></i> ${dataPrazoBr}</span>`;
				} else if (!ehConcluida && demanda.prazo === hojeStr) {
					prazoHtml = `<span class="badge-prazo badge-prazo-hoje" title="Vence hoje!"><i class="fas fa-bolt"></i> Hoje</span>`;
				} else {
					prazoHtml = `<span class="badge-prazo"><i class="fas fa-calendar-check"></i> ${dataPrazoBr}</span>`;
				}
			}

			// Badge de status
			const classeBadgeStatus = ehConcluida
				? "badge-status-concluido"
				: "badge-status-pendente";
			const iconeStatus = ehConcluida
				? '<i class="fas fa-check-circle"></i>'
				: '<i class="fas fa-clock"></i>';
			const textoStatus = ehConcluida ? "Concluído" : "Pendente";

			// Coluna de ações
			let acaoStatusHtml = "";
			const podeAlterar = verificarPermissao(demanda.analista);
			const nomeCriadorFormatado = formatarNomeAnalista(demanda.analista);

			if (ehConcluida) {
				const dataConclusao = demanda.data_conclusao
					? formatarDataBr(demanda.data_conclusao)
					: "";
				if (podeAlterar) {
					acaoStatusHtml = `
                    <span class="demanda-concluido-texto" title="Concluído em ${dataConclusao}">
                        <i class="fas fa-check-circle"></i> ${dataConclusao || "Concluído"}
                    </span>
                    <button type="button" class="btn-reabrir-demanda" data-id="${demanda.id}" title="Reabrir demanda para pendente">
                        <i class="fas fa-undo"></i> Reabrir
                    </button>
                `;
				} else {
					acaoStatusHtml = `
                    <span class="demanda-concluido-texto" title="Concluído em ${dataConclusao}">
                        <i class="fas fa-check-circle"></i> ${dataConclusao || "Concluído"}
                    </span>
                `;
				}
			} else {
				if (podeAlterar) {
					acaoStatusHtml = `
                    <button type="button" class="btn-concluir-demanda" data-id="${demanda.id}" title="Marcar como concluída">
                        <i class="fas fa-check"></i> Concluir
                    </button>
                `;
				} else {
					acaoStatusHtml = `
                    <span style="color: #64748b; font-size: 0.78rem; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;" title="Apenas o autor (${nomeCriadorFormatado}) ou o administrador geral podem alterar esta demanda">
                        <i class="fas fa-lock" style="font-size: 0.75rem; color: #94a3b8;"></i> Somente Leitura
                    </span>
                `;
				}
			}

			// Botões de Editar e Excluir
			let botoesGestaoHtml = "";
			if (podeAlterar) {
				botoesGestaoHtml = `
                <button type="button" class="btn-editar-demanda" data-id="${demanda.id}" title="Editar esta demanda">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button type="button" class="btn-excluir-demanda" data-id="${demanda.id}" title="Excluir esta demanda">
                    <i class="fas fa-trash-alt"></i> Excluir
                </button>
            `;
			}

			const ferramentaTexto = demanda.ferramenta || "-";
			const lojaTexto = demanda.loja || "-";
			const lojaUrlParam = encodeURIComponent(demanda.loja || "");
			const dataCriacaoParam = demanda.data_criacao || "";
			const linkLojaHtml = demanda.loja
				? `<a href="index.html?filial=${lojaUrlParam}&data=${dataCriacaoParam}" class="link-loja-tabela" title="Clique para abrir os indicadores de ${lojaTexto} na semana de ${formatarDataBr(demanda.data_criacao)}">
                <span>${lojaTexto}</span> <i class="fas fa-external-link-alt link-loja-icone"></i>
               </a>`
				: "-";

			// Descrição formatada com line-clamp e expansão
			const textoDescricao = demanda.descricao || "";
			const textoDescricaoEscapado = escaparHtml(textoDescricao);
			let descricaoHtml = "-";
			if (textoDescricao) {
				const ehLongo = textoDescricao.trim().length > 70;
				descricaoHtml = `
                    <div class="demanda-descricao-conteudo">
                        <span class="demanda-descricao-texto" title="${textoDescricaoEscapado}">${textoDescricaoEscapado}</span>
                        ${
							ehLongo
								? `<button type="button" class="btn-toggle-descricao" title="Clique para expandir ou recolher o texto">
                                    <i class="fas fa-chevron-down"></i> Ver mais
                                   </button>`
								: ""
						}
                    </div>
                `;
			}

			return `
            <tr class="${classeRow}" style="animation-delay: ${index * 0.03}s">
                <td class="demanda-col-data">${formatarDataBr(demanda.data_criacao)}</td>
                <td class="demanda-col-loja">${linkLojaHtml}</td>
                <td>
                    <span class="badge-ferramenta" title="Ferramenta: ${ferramentaTexto}">
                        <i class="fas fa-cube"></i> ${ferramentaTexto}
                    </span>
                </td>
                <td>
                    <span class="badge-prioridade ${classeBadgePrioridade}">
                        ${iconePrioridade} ${prioridade}
                    </span>
                </td>
                <td class="demanda-col-descricao">${descricaoHtml}</td>
                <td><span class="badge-resp ${classeBadgeResp}">${iconeResp} ${demanda.responsavel || "-"}</span></td>
                <td>${prazoHtml}</td>
                <td>
                    <span class="badge-analista" title="${demanda.analista || "Não informado"}">
                        <i class="fas fa-user-circle"></i> ${nomeCriadorFormatado}
                    </span>
                </td>
                <td><span class="badge-status ${classeBadgeStatus}">${iconeStatus} ${textoStatus}</span></td>
                <td>
                    <div class="acoes-demanda-container">
                        ${acaoStatusHtml}
                        ${botoesGestaoHtml}
                    </div>
                </td>
            </tr>
        `;
		})
		.join("");

	// Event listeners para Ver mais / Recolher descrição
	tbody.querySelectorAll(".btn-toggle-descricao").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			const wrapper = btn.closest(".demanda-descricao-conteudo");
			if (!wrapper) return;
			const expandido = wrapper.classList.toggle("expandido");
			if (expandido) {
				btn.innerHTML = '<i class="fas fa-chevron-up"></i> Recolher';
			} else {
				btn.innerHTML = '<i class="fas fa-chevron-down"></i> Ver mais';
			}
		});
	});

	// Event listeners para Concluir
	tbody
		.querySelectorAll(".btn-concluir-demanda:not([disabled])")
		.forEach((btn) => {
			btn.addEventListener("click", async () => {
				const idDemanda = btn.getAttribute("data-id");
				await alterarStatusDemanda(idDemanda, "concluido", btn);
			});
		});

	// Event listeners para Reabrir
	tbody.querySelectorAll(".btn-reabrir-demanda").forEach((btn) => {
		btn.addEventListener("click", async () => {
			const idDemanda = btn.getAttribute("data-id");
			await alterarStatusDemanda(idDemanda, "pendente", btn);
		});
	});

	// Event listeners para Editar
	tbody.querySelectorAll(".btn-editar-demanda").forEach((btn) => {
		btn.addEventListener("click", () => {
			const idDemanda = btn.getAttribute("data-id");
			abrirModalEdicao(idDemanda);
		});
	});

	// Event listeners para Excluir
	tbody.querySelectorAll(".btn-excluir-demanda").forEach((btn) => {
		btn.addEventListener("click", async () => {
			const idDemanda = btn.getAttribute("data-id");
			await excluirDemanda(idDemanda, btn);
		});
	});
}

// ==========================================
// EXPORTAR PARA EXCEL (.XLSX)
// ==========================================
function exportarParaExcel() {
	if (!demandasFiltradas || demandasFiltradas.length === 0) {
		alert("Não há demandas visíveis para exportar.");
		return;
	}

	if (typeof XLSX === "undefined") {
		alert("Biblioteca de exportação não carregada. Verifique sua conexão.");
		return;
	}

	// Formatar linhas para a planilha
	const dadosPlanilha = demandasFiltradas.map((d) => ({
		ID: d.id,
		"Data de Registro": formatarDataBr(d.data_criacao),
		"Filial / Loja": d.loja || "",
		Ferramenta: d.ferramenta || "",
		Prioridade: d.prioridade || "Média",
		"Descrição da Demanda": d.descricao || "",
		Responsável: d.responsavel || "",
		"Prazo de Resolução": d.prazo ? formatarDataBr(d.prazo) : "-",
		"Criado por": d.analista || "",
		Status: d.status === "concluido" ? "Concluído" : "Pendente",
		"Data de Conclusão": d.data_conclusao
			? formatarDataBr(d.data_conclusao)
			: "-",
	}));

	const ws = XLSX.utils.json_to_sheet(dadosPlanilha);

	// Ajustar larguras das colunas
	ws["!cols"] = [
		{ wch: 8 }, // ID
		{ wch: 16 }, // Data
		{ wch: 22 }, // Loja
		{ wch: 16 }, // Ferramenta
		{ wch: 12 }, // Prioridade
		{ wch: 45 }, // Descricao
		{ wch: 14 }, // Responsavel
		{ wch: 18 }, // Prazo
		{ wch: 28 }, // Criado por
		{ wch: 14 }, // Status
		{ wch: 18 }, // Data Conclusao
	];

	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, "Demandas");

	const dataHoje = new Date().toISOString().split("T")[0];
	XLSX.writeFile(wb, `Demandas_Conviva_${dataHoje}.xlsx`);
}

// ==========================================
// ABRIR MODAL PARA CADASTRO
// ==========================================
function abrirModalCadastro() {
	const modal = document.getElementById("modal-cadastro-demanda");
	const inputId = document.getElementById("edit-demanda-id");
	const titulo = document.getElementById("modal-demanda-titulo");
	const btnTexto = document.getElementById("btn-salvar-texto");
	const selectLoja = document.getElementById("cad-demanda-loja");
	const selectFerramenta = document.getElementById("cad-demanda-ferramenta");
	const selectPrioridade = document.getElementById("cad-demanda-prioridade");
	const selectResp = document.getElementById("cad-demanda-responsavel");
	const inputData = document.getElementById("cad-demanda-data");
	const inputPrazo = document.getElementById("cad-demanda-prazo");
	const inputAnalista = document.getElementById("cad-demanda-analista");
	const textareaDesc = document.getElementById("cad-demanda-descricao");

	if (!modal) return;

	if (inputId) inputId.value = "";
	if (titulo)
		titulo.innerHTML =
			'<i class="fas fa-plus-circle" style="margin-right: 8px;"></i> Cadastrar Nova Demanda';
	if (btnTexto) btnTexto.textContent = "Salvar Demanda";

	if (selectLoja) selectLoja.value = "";
	if (selectFerramenta) selectFerramenta.value = "";
	const inputFerramentaOutros = document.getElementById(
		"cad-demanda-ferramenta-outros",
	);
	if (inputFerramentaOutros) {
		inputFerramentaOutros.value = "";
		inputFerramentaOutros.style.display = "none";
	}
	if (selectPrioridade) selectPrioridade.value = "Média";
	if (selectResp) selectResp.value = "";
	if (inputData) inputData.value = new Date().toISOString().split("T")[0];
	if (inputPrazo) inputPrazo.value = "";

	// Analista é sempre preenchido com o usuário logado e travado
	if (inputAnalista) {
		inputAnalista.value = analistaLogado || "";
		inputAnalista.readOnly = true;
	}

	if (textareaDesc) textareaDesc.value = "";

	modal.style.display = "flex";
}

// ==========================================
// ABRIR MODAL PARA EDIÇÃO
// ==========================================
function abrirModalEdicao(idDemanda) {
	const demanda = todasDemandasDoBanco.find(
		(d) => String(d.id) === String(idDemanda),
	);
	if (!demanda) {
		alert("Demanda não encontrada.");
		return;
	}

	if (!verificarPermissao(demanda.analista)) {
		alert(
			"Apenas o autor desta demanda ou o Administrador Geral podem editá-la.",
		);
		return;
	}

	const modal = document.getElementById("modal-cadastro-demanda");
	const inputId = document.getElementById("edit-demanda-id");
	const titulo = document.getElementById("modal-demanda-titulo");
	const btnTexto = document.getElementById("btn-salvar-texto");
	const selectLoja = document.getElementById("cad-demanda-loja");
	const selectFerramenta = document.getElementById("cad-demanda-ferramenta");
	const inputFerramentaOutros = document.getElementById(
		"cad-demanda-ferramenta-outros",
	);
	const selectPrioridade = document.getElementById("cad-demanda-prioridade");
	const selectResp = document.getElementById("cad-demanda-responsavel");
	const inputData = document.getElementById("cad-demanda-data");
	const inputPrazo = document.getElementById("cad-demanda-prazo");
	const inputAnalista = document.getElementById("cad-demanda-analista");
	const textareaDesc = document.getElementById("cad-demanda-descricao");

	if (!modal) return;

	if (inputId) inputId.value = demanda.id;
	if (titulo)
		titulo.innerHTML =
			'<i class="fas fa-edit" style="margin-right: 8px;"></i> Editar Demanda';
	if (btnTexto) btnTexto.textContent = "Atualizar Demanda";

	if (selectLoja) selectLoja.value = demanda.loja || "";

	// Trata ferramenta padrão vs ferramenta customizada ("Outros")
	const ferramentasPadrao = [
		"ERP",
		"APP CONVIVA",
		"PEC",
		"PBM",
		"GC",
		"FIDELIZA",
		"BÚSSOLA",
	];
	const valFerr = (demanda.ferramenta || "").trim();
	if (selectFerramenta) {
		if (ferramentasPadrao.includes(valFerr)) {
			selectFerramenta.value = valFerr;
			if (inputFerramentaOutros) {
				inputFerramentaOutros.value = "";
				inputFerramentaOutros.style.display = "none";
			}
		} else if (valFerr) {
			selectFerramenta.value = "OUTROS";
			if (inputFerramentaOutros) {
				inputFerramentaOutros.value = valFerr;
				inputFerramentaOutros.style.display = "block";
			}
		} else {
			selectFerramenta.value = "";
			if (inputFerramentaOutros) {
				inputFerramentaOutros.value = "";
				inputFerramentaOutros.style.display = "none";
			}
		}
	}

	if (selectPrioridade) selectPrioridade.value = demanda.prioridade || "Média";
	if (selectResp) selectResp.value = demanda.responsavel || "";
	if (inputData)
		inputData.value =
			demanda.data_criacao || new Date().toISOString().split("T")[0];
	if (inputPrazo) inputPrazo.value = demanda.prazo || "";

	// Analista da demanda preservado e travado
	if (inputAnalista) {
		inputAnalista.value = demanda.analista || analistaLogado || "";
		inputAnalista.readOnly = true;
	}

	if (textareaDesc) textareaDesc.value = demanda.descricao || "";

	modal.style.display = "flex";
}

// ==========================================
// SALVAR OU ATUALIZAR DEMANDA
// ==========================================
async function salvarDemanda() {
	const inputId = document.getElementById("edit-demanda-id");
	const selectLoja = document.getElementById("cad-demanda-loja");
	const selectFerramenta = document.getElementById("cad-demanda-ferramenta");
	const inputFerramentaOutros = document.getElementById(
		"cad-demanda-ferramenta-outros",
	);
	const selectPrioridade = document.getElementById("cad-demanda-prioridade");
	const selectResp = document.getElementById("cad-demanda-responsavel");
	const inputData = document.getElementById("cad-demanda-data");
	const inputPrazo = document.getElementById("cad-demanda-prazo");
	const textareaDesc = document.getElementById("cad-demanda-descricao");

	const idDemanda = inputId ? inputId.value.trim() : "";
	const loja = selectLoja ? selectLoja.value.trim() : "";
	let ferramenta = selectFerramenta ? selectFerramenta.value.trim() : "";
	if (ferramenta.toUpperCase() === "OUTROS") {
		const valorOutros = inputFerramentaOutros
			? inputFerramentaOutros.value.trim()
			: "";
		if (!valorOutros) {
			alert("Por favor, digite o nome da ferramenta no campo 'OUTROS'.");
			if (inputFerramentaOutros) inputFerramentaOutros.focus();
			return;
		}
		ferramenta = valorOutros;
	}
	const prioridade = selectPrioridade ? selectPrioridade.value.trim() : "Média";
	const responsavel = selectResp ? selectResp.value.trim() : "";
	const dataCriacao = inputData
		? inputData.value
		: new Date().toISOString().split("T")[0];
	const prazo = inputPrazo?.value ? inputPrazo.value : null;
	const analista = analistaLogado || "Analista";
	const descricao = textareaDesc ? textareaDesc.value.trim() : "";

	if (!loja) {
		alert("Por favor, selecione a filial / loja.");
		if (selectLoja) selectLoja.focus();
		return;
	}

	if (!ferramenta) {
		alert("Por favor, selecione a ferramenta relacionada à demanda.");
		if (selectFerramenta) selectFerramenta.focus();
		return;
	}

	if (!responsavel) {
		alert("Por favor, selecione o responsável (Operações ou Associado).");
		if (selectResp) selectResp.focus();
		return;
	}

	if (!descricao) {
		alert("Por favor, descreva a demanda detalhadamente.");
		if (textareaDesc) textareaDesc.focus();
		return;
	}

	const agoraISO = new Date().toISOString();

	if (idDemanda) {
		// Valida se a demanda existente pode ser alterada pelo usuário logado
		const demandaExistente = todasDemandasDoBanco.find(
			(d) => String(d.id) === String(idDemanda),
		);
		if (demandaExistente && !verificarPermissao(demandaExistente.analista)) {
			alert(
				"Apenas o autor desta demanda ou o Administrador Geral podem atualizá-la.",
			);
			return;
		}

		// Modo Edição
		const { error } = await supabase
			.from("demandas")
			.update({
				loja: loja,
				ferramenta: ferramenta,
				prioridade: prioridade,
				descricao: descricao,
				responsavel: responsavel,
				data_criacao: dataCriacao,
				prazo: prazo,
			})
			.eq("id", idDemanda);

		if (error) {
			console.error("Erro ao atualizar demanda:", error);
			alert(`Erro ao atualizar demanda: ${error.message}`);
			return;
		}

		alert("Demanda atualizada com sucesso!");
	} else {
		// Modo Criação
		const { error } = await supabase.from("demandas").insert([
			{
				loja: loja,
				ferramenta: ferramenta,
				prioridade: prioridade,
				descricao: descricao,
				responsavel: responsavel,
				status: "pendente",
				analista: analista,
				data_criacao: dataCriacao,
				prazo: prazo,
				data_conclusao: null,
				created_at: agoraISO,
			},
		]);

		if (error) {
			console.error("Erro ao cadastrar demanda:", error);
			alert(`Erro ao cadastrar demanda: ${error.message}`);
			return;
		}

		alert("Demanda cadastrada com sucesso!");
	}

	// Fecha o modal
	const modal = document.getElementById("modal-cadastro-demanda");
	if (modal) modal.style.display = "none";

	// Recarrega lista e contadores
	await carregarFiltroLojas();
	await carregarFiltroCriadores();
	await carregarFiltroFerramentas();
	await carregarDemandas();
}

// ==========================================
// EXCLUIR DEMANDA
// ==========================================
async function excluirDemanda(idDemanda, botao) {
	const demanda = todasDemandasDoBanco.find(
		(d) => String(d.id) === String(idDemanda),
	);
	if (demanda && !verificarPermissao(demanda.analista)) {
		alert(
			"Apenas o autor desta demanda ou o Administrador Geral podem excluí-la.",
		);
		return;
	}

	if (
		!confirm(
			"Tem certeza de que deseja EXCLUIR esta demanda definitivamente? Esta ação não pode ser desfeita.",
		)
	) {
		return;
	}

	const row = botao.closest("tr");
	if (row) row.style.opacity = "0.3";

	const { error } = await supabase
		.from("demandas")
		.delete()
		.eq("id", idDemanda);

	if (error) {
		console.error("Erro ao excluir demanda:", error);
		alert(`Erro ao excluir demanda: ${error.message}`);
		if (row) row.style.opacity = "1";
		return;
	}

	alert("Demanda excluída com sucesso!");
	await carregarFiltroCriadores();
	await carregarDemandas();
}

// ==========================================
// ALTERAR STATUS DA DEMANDA (CONCLUIR OU REABRIR)
// ==========================================
async function alterarStatusDemanda(idDemanda, novoStatus, botao) {
	const demanda = todasDemandasDoBanco.find(
		(d) => String(d.id) === String(idDemanda),
	);
	if (demanda && !verificarPermissao(demanda.analista)) {
		alert(
			"Apenas o autor desta demanda ou o Administrador Geral podem alterar o status desta demanda.",
		);
		return;
	}

	const msgConfirm =
		novoStatus === "concluido"
			? "Deseja marcar esta demanda como concluída?"
			: "Deseja reabrir esta demanda para pendente?";

	if (!confirm(msgConfirm)) return;

	const row = botao.closest("tr");
	if (row) row.classList.add("demanda-concluindo");

	const hoje = new Date().toISOString().split("T")[0];

	const { error } = await supabase
		.from("demandas")
		.update({
			status: novoStatus,
			data_conclusao: novoStatus === "concluido" ? hoje : null,
		})
		.eq("id", idDemanda);

	if (error) {
		alert(`Erro ao atualizar demanda: ${error.message}`);
		if (row) row.classList.remove("demanda-concluindo");
		return;
	}

	// Recarregar a tabela
	await carregarDemandas();
}

// ==========================================
// VERIFICAR PERMISSÃO
// ==========================================
function verificarPermissao(analistaCriador) {
	// 1. Administrador Geral (tabela 'gestores' no Supabase) tem permissão irrestrita
	if (ehGestorLogado) return true;

	if (!analistaLogado) return false;

	// Se não há criador registrado na demanda antiga, permite apenas adm
	if (!analistaCriador || analistaCriador.trim() === "") {
		return false;
	}

	const logado = analistaLogado.trim().toLowerCase();
	const criador = analistaCriador.trim().toLowerCase();

	// 2. Comparação exata
	if (logado === criador) return true;

	// 3. Comparação de nomes e prefixos de e-mail (ex: "felix.buenos" vs "Felix Buenos")
	const logadoPrefix = logado.includes("@") ? logado.split("@")[0] : logado;
	const criadorPrefix = criador.includes("@") ? criador.split("@")[0] : criador;

	const limparStr = (s) => s.replace(/[^a-z0-9]/g, "");

	const logadoLimpo = limparStr(logadoPrefix);
	const criadorLimpo = limparStr(criadorPrefix);

	if (logadoLimpo === criadorLimpo) return true;
	if (logadoLimpo.length >= 4 && criadorLimpo.includes(logadoLimpo))
		return true;
	if (criadorLimpo.length >= 4 && logadoLimpo.includes(criadorLimpo))
		return true;

	return false;
}

// ==========================================
// ATUALIZAR CONTADORES
// ==========================================
function atualizarContadores(total, pendentes, concluidas) {
	const elTotal = document.getElementById("contador-total");
	const elPendentes = document.getElementById("contador-pendentes");
	const elConcluidas = document.getElementById("contador-concluidas");

	if (elTotal) animarContador(elTotal, total.length);
	if (elPendentes) animarContador(elPendentes, pendentes.length);
	if (elConcluidas) animarContador(elConcluidas, concluidas.length);
}

function animarContador(elemento, valorFinal) {
	const valorAtual = parseInt(elemento.textContent, 10) || 0;
	if (valorAtual === valorFinal) return;

	const duracao = 350;
	const inicio = performance.now();

	function atualizar(tempoAtual) {
		const progresso = Math.min((tempoAtual - inicio) / duracao, 1);
		const valor = Math.round(
			valorAtual + (valorFinal - valorAtual) * progresso,
		);
		elemento.textContent = valor;

		if (progresso < 1) {
			requestAnimationFrame(atualizar);
		}
	}

	requestAnimationFrame(atualizar);
}

// ==========================================
// FORMATAR DATA BR
// ==========================================
function formatarDataBr(dataString) {
	if (!dataString) return "-";
	const partes = dataString.split("-");
	if (partes.length !== 3) return dataString;
	return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// ==========================================
// CONFIGURAR EVENTOS
// ==========================================
function configurarEventos() {
	// Busca rápida em tempo real (digitação)
	const inputBusca = document.getElementById("campo-busca-rapida");
	if (inputBusca) {
		inputBusca.addEventListener("input", () => aplicarBuscaRapida());
	}

	// Botão exportar Excel
	const btnExcel = document.getElementById("btn-exportar-excel");
	if (btnExcel) {
		btnExcel.addEventListener("click", () => exportarParaExcel());
	}

	// Filtragem dinâmica ao alterar selects
	const selectLoja = document.getElementById("filtro-loja");
	const selectFerramenta = document.getElementById("filtro-ferramenta");
	const selectPrioridade = document.getElementById("filtro-prioridade");
	const selectResp = document.getElementById("filtro-responsavel");
	const selectCriador = document.getElementById("filtro-criador");
	const selectStatus = document.getElementById("filtro-status");

	if (selectLoja)
		selectLoja.addEventListener("change", () => carregarDemandas());
	if (selectFerramenta)
		selectFerramenta.addEventListener("change", () => carregarDemandas());
	if (selectPrioridade)
		selectPrioridade.addEventListener("change", () => carregarDemandas());
	if (selectResp)
		selectResp.addEventListener("change", () => carregarDemandas());
	if (selectCriador)
		selectCriador.addEventListener("change", () => carregarDemandas());
	if (selectStatus)
		selectStatus.addEventListener("change", () => carregarDemandas());

	// Clique na coluna DATA para alternar ordenação (mais novo <-> mais antigo)
	const thData = document.getElementById("th-ordenar-data");
	if (thData) {
		thData.addEventListener("click", () => {
			ordemDataAsc = !ordemDataAsc;
			atualizarIconeOrdenacao();
			carregarDemandas();
		});
	}

	// Modal de Cadastro / Edição
	const modalDemanda = document.getElementById("modal-cadastro-demanda");
	const btnAbrirModal = document.getElementById("btn-abrir-modal-demanda");
	const btnFecharModal = document.getElementById("btn-fechar-modal-demanda");
	const btnCancelarModal = document.getElementById("btn-cancelar-demanda");
	const btnSalvarDemanda = document.getElementById("btn-salvar-nova-demanda");

	if (btnAbrirModal) {
		btnAbrirModal.addEventListener("click", () => abrirModalCadastro());
	}

	if (btnFecharModal && modalDemanda) {
		btnFecharModal.addEventListener("click", () => {
			modalDemanda.style.display = "none";
		});
	}

	if (btnCancelarModal && modalDemanda) {
		btnCancelarModal.addEventListener("click", () => {
			modalDemanda.style.display = "none";
		});
	}

	if (btnSalvarDemanda) {
		btnSalvarDemanda.addEventListener("click", async () => {
			await salvarDemanda();
		});
	}

	// Alternar campo manual de "Outros" em Ferramenta
	const selectFerramentaModal = document.getElementById(
		"cad-demanda-ferramenta",
	);
	const inputFerramentaOutros = document.getElementById(
		"cad-demanda-ferramenta-outros",
	);
	if (selectFerramentaModal && inputFerramentaOutros) {
		selectFerramentaModal.addEventListener("change", () => {
			if (selectFerramentaModal.value.toUpperCase() === "OUTROS") {
				inputFerramentaOutros.style.display = "block";
				inputFerramentaOutros.focus();
			} else {
				inputFerramentaOutros.style.display = "none";
				inputFerramentaOutros.value = "";
			}
		});
	}

	// Botão sair
	const btnSair = document.getElementById("btn-sair");
	if (btnSair) {
		btnSair.addEventListener("click", async () => {
			await supabase.auth.signOut();
			window.location.href = "login.html";
		});
	}
}

// ==========================================
// INICIAR
// ==========================================
document.addEventListener("DOMContentLoaded", iniciarSistema);
