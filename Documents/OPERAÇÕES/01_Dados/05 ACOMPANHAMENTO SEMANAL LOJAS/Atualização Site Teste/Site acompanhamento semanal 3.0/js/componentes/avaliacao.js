// js/componentes/avaliacao.js

import { supabase } from "../servicos/supabaseClient.js";

let analistaLogado = null;

// ==========================================
// OBTER SESSÃO DO USUÁRIO
// ==========================================
async function obterSessao() {
	try {
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (session) {
			analistaLogado =
				session.user.email || session.user.user_metadata?.name || null;
			const inputAnalista = document.getElementById("aval-analista");
			if (inputAnalista && analistaLogado) {
				inputAnalista.value = analistaLogado;
			}
		}
	} catch (e) {
		console.warn("Erro ao obter sessão em avaliacao:", e);
	}
}

// ==========================================
// FORMATAR NOME DO ANALISTA / CRIADOR
// ==========================================
function formatarNomeAnalista(analista) {
	if (!analista || analista.trim() === "") return "Não informado";
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
// FUNÇÃO PARA ABRIR O MODAL
// ==========================================
export function abrirModalDemanda() {
	const modal = document.getElementById("modal-avaliacao");
	if (!modal) {
		console.error("Modal #modal-avaliacao não encontrado no DOM.");
		return;
	}

	const inputLoja = document.getElementById("aval-loja");
	const selectFerramenta = document.getElementById("aval-ferramenta");
	const inputFerramentaOutros = document.getElementById("aval-ferramenta-outros");
	const selectPrioridade = document.getElementById("aval-prioridade");
	const selectResponsavel = document.getElementById("aval-responsavel");
	const inputData = document.getElementById("aval-data");
	const inputPrazo = document.getElementById("aval-prazo");
	const inputAnalista = document.getElementById("aval-analista");
	const textareaDescricao = document.getElementById("aval-descricao");

	const selectLojaAtual = document.getElementById("select-loja");
	let nomeLojaAtual =
		selectLojaAtual && selectLojaAtual.selectedIndex >= 0
			? selectLojaAtual.options[selectLojaAtual.selectedIndex].text
			: "";

	if (
		nomeLojaAtual.toLowerCase().includes("carregando") ||
		nomeLojaAtual.toLowerCase().includes("selecione")
	) {
		nomeLojaAtual = "";
	}

	if (inputLoja) inputLoja.value = nomeLojaAtual;
	if (inputData) inputData.value = new Date().toISOString().split("T")[0];
	if (inputPrazo) inputPrazo.value = "";
	if (inputAnalista) {
		inputAnalista.value = analistaLogado || "";
		inputAnalista.readOnly = true;
	}
	if (selectFerramenta) selectFerramenta.value = "";
	if (inputFerramentaOutros) {
		inputFerramentaOutros.value = "";
		inputFerramentaOutros.style.display = "none";
	}
	if (selectPrioridade) selectPrioridade.value = "Média";
	if (selectResponsavel) selectResponsavel.value = "";
	if (textareaDescricao) textareaDescricao.value = "";

	modal.style.display = "flex";
}

window.abrirModalDemanda = abrirModalDemanda;

// ==========================================
// SALVAR DEMANDA NO SUPABASE
// ==========================================
async function salvarDemanda() {
	const modal = document.getElementById("modal-avaliacao");
	const inputLoja = document.getElementById("aval-loja");
	const selectFerramenta = document.getElementById("aval-ferramenta");
	const inputFerramentaOutros = document.getElementById("aval-ferramenta-outros");
	const selectPrioridade = document.getElementById("aval-prioridade");
	const selectResponsavel = document.getElementById("aval-responsavel");
	const inputData = document.getElementById("aval-data");
	const inputPrazo = document.getElementById("aval-prazo");
	const textareaDescricao = document.getElementById("aval-descricao");
	const btnSalvar = document.getElementById("btn-salvar-avaliacao");

	const loja = inputLoja ? inputLoja.value.trim() : "";
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
	const responsavel = selectResponsavel ? selectResponsavel.value.trim() : "";
	const dataCriacao = inputData?.value
		? inputData.value
		: new Date().toISOString().split("T")[0];
	const prazo = inputPrazo?.value ? inputPrazo.value : null;
	const analista = analistaLogado || "Analista";
	const descricao = textareaDescricao ? textareaDescricao.value.trim() : "";

	if (
		!loja ||
		loja.toLowerCase().includes("selecione") ||
		loja.toLowerCase().includes("carregando")
	) {
		alert(
			"Por favor, selecione uma filial no filtro do topo antes de cadastrar a demanda.",
		);
		return;
	}

	if (!ferramenta) {
		alert("Por favor, selecione a ferramenta relacionada.");
		if (selectFerramenta) selectFerramenta.focus();
		return;
	}

	if (!responsavel) {
		alert(
			"Por favor, selecione quem é o responsável (Operações ou Associado).",
		);
		if (selectResponsavel) selectResponsavel.focus();
		return;
	}

	if (!descricao) {
		alert("Por favor, descreva a demanda detalhadamente.");
		if (textareaDescricao) textareaDescricao.focus();
		return;
	}

	if (btnSalvar) {
		btnSalvar.disabled = true;
		btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
	}

	const agoraISO = new Date().toISOString();

	const { error } = await supabase.from("demandas").insert([
		{
			loja: loja,
			ferramenta: ferramenta,
			prioridade: prioridade,
			responsavel: responsavel,
			data_criacao: dataCriacao,
			prazo: prazo,
			status: "pendente",
			analista: analista,
			descricao: descricao,
			data_conclusao: null,
			created_at: agoraISO,
		},
	]);

	if (btnSalvar) {
		btnSalvar.disabled = false;
		btnSalvar.innerHTML = '<i class="fas fa-check"></i> Salvar Demanda';
	}

	if (error) {
		console.error("Erro ao salvar demanda:", error);
		alert(`Erro ao salvar demanda: ${error.message}`);
		return;
	}

	alert(
		"Demanda cadastrada com sucesso! Ela já está disponível no Gerenciador de Demandas.",
	);
	if (modal) modal.style.display = "none";

	// Recarregar histórico da filial imediatamente
	const selectLojaAtual = document.getElementById("select-loja");
	const filialAtual = selectLojaAtual ? selectLojaAtual.value : loja;
	await carregarHistorico(supabase, filialAtual);
}

// ==========================================
// INICIALIZAR COMPONENTE E EVENTOS
// ==========================================
export function inicializarModalAvaliacao(_instanciaSupabase) {
	obterSessao();

	const modal = document.getElementById("modal-avaliacao");
	const btnAbrir = document.getElementById("btn-nova-avaliacao");
	const btnFechar = document.getElementById("btn-fechar-modal");
	const btnCancelar = document.getElementById("btn-cancelar-modal-aval");
	const btnSalvar = document.getElementById("btn-salvar-avaliacao");

	if (btnAbrir) {
		btnAbrir.onclick = (e) => {
			e.preventDefault();
			abrirModalDemanda();
		};
	}

	if (btnFechar && modal) {
		btnFechar.onclick = (e) => {
			e.preventDefault();
			modal.style.display = "none";
		};
	}

	if (btnCancelar && modal) {
		btnCancelar.onclick = (e) => {
			e.preventDefault();
			modal.style.display = "none";
		};
	}

	if (btnSalvar) {
		btnSalvar.onclick = async (e) => {
			e.preventDefault();
			await salvarDemanda();
		};
	}

	const selectFerramenta = document.getElementById("aval-ferramenta");
	const inputFerramentaOutros = document.getElementById("aval-ferramenta-outros");

	if (selectFerramenta && inputFerramentaOutros) {
		selectFerramenta.addEventListener("change", () => {
			if (selectFerramenta.value === "OUTROS") {
				inputFerramentaOutros.style.display = "block";
				inputFerramentaOutros.focus();
			} else {
				inputFerramentaOutros.style.display = "none";
				inputFerramentaOutros.value = "";
			}
		});
	}
}

// ==========================================
// CARREGAR HISTÓRICO DE DEMANDAS DA FILIAL
// ==========================================
export async function carregarHistorico(supabaseInst, filial) {
	const sb = supabaseInst || supabase;
	if (!sb) return;

	const tbody = document.querySelector("#tabela-historico tbody");
	if (!tbody) return;

	const selectLoja = document.getElementById("select-loja");
	let nomeLojaTexto = filial || (selectLoja?.value ? selectLoja.value : "");

	if (selectLoja && selectLoja.selectedIndex >= 0) {
		const txt = selectLoja.options[selectLoja.selectedIndex].text;
		if (
			txt &&
			!txt.toLowerCase().includes("carregando") &&
			!txt.toLowerCase().includes("selecione")
		) {
			nomeLojaTexto = txt;
		}
	}

	if (
		!nomeLojaTexto ||
		nomeLojaTexto.toLowerCase().includes("selecione") ||
		nomeLojaTexto.toLowerCase().includes("carregando")
	) {
		tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: #888; font-style: italic; padding: 24px;">
                    Selecione uma filial no filtro acima para visualizar o histórico de demandas.
                </td>
            </tr>
        `;
		return;
	}

	const lojaLimpa = nomeLojaTexto.trim();
	// Extrai o nome da cidade/loja (ex: de "Conviva Acopiara" pega "Acopiara", ou o nome completo)
	const termoBusca = lojaLimpa.replace(/^Conviva\s+/i, "").trim();

	// Consulta no Supabase sem erros de sintaxe PostgREST
	const { data, error } = await sb
		.from("demandas")
		.select("*")
		.ilike("loja", `%${termoBusca || lojaLimpa}%`)
		.order("data_criacao", { ascending: false })
		.limit(100);

	if (error) {
		console.error("Erro ao buscar histórico de demandas da filial:", error);
		tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: #dc3545; padding: 24px;">
                    Erro ao carregar histórico de demandas.
                </td>
            </tr>
        `;
		return;
	}

	if (!data || data.length === 0) {
		tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: #888; font-style: italic; padding: 24px;">
                    Nenhuma demanda registrada para esta filial até o momento.
                </td>
            </tr>
        `;
		return;
	}

	tbody.innerHTML = data
		.map((item) => {
			const ehConcluido = item.status === "concluido";
			const badgeStatus = ehConcluido
				? '<span style="background: #ecfdf5; color: #047857; padding: 3px 8px; border-radius: 12px; font-weight: 700; font-size: 0.75rem; text-transform: uppercase;">Concluído</span>'
				: '<span style="background: #fff7ed; color: #c2410c; padding: 3px 8px; border-radius: 12px; font-weight: 700; font-size: 0.75rem; text-transform: uppercase;">Pendente</span>';

			const prioridade = item.prioridade || "Média";
			let corPrioridade = "#d97706";
			let iconePrioridade = "";
			if (prioridade === "Alta") {
				corPrioridade = "#dc2626";
				iconePrioridade = "";
			}
			if (prioridade === "Baixa") {
				corPrioridade = "#16a34a";
				iconePrioridade = "";
			}

			const nomeCriador = formatarNomeAnalista(item.analista);

			return `
            <tr>
                <td style="white-space: nowrap; font-weight: 600; color: #475569;">${formatarDataBr(item.data_criacao)}</td>
                <td><span style="font-weight: 700; color: #4338ca;">${item.ferramenta || "-"}</span></td>
                <td><span style="font-weight: 700; color: ${corPrioridade};">${iconePrioridade} ${prioridade}</span></td>
                <td style="max-width: 320px; line-height: 1.4;">${item.descricao || "-"}</td>
                <td><span style="font-weight: 600;">${item.responsavel || "-"}</span></td>
                <td>
                    <span style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 16px; font-size: 0.78rem; font-weight: 600; background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0;">
                        <i class="fas fa-user-circle" style="color: #0055a5;"></i> ${nomeCriador}
                    </span>
                </td>
                <td>${badgeStatus}</td>
            </tr>
        `;
		})
		.join("");
}

function formatarDataBr(dataString) {
	if (!dataString) return "-";
	const partes = dataString.split("-");
	if (partes.length !== 3) return dataString;
	return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// Auto inicialização imediata
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () =>
		inicializarModalAvaliacao(supabase),
	);
} else {
	inicializarModalAvaliacao(supabase);
}
