// js/componentes/appLauncher.js
import { supabase } from "../servicos/supabaseClient.js";

export async function inicializarAppLauncher() {
	const btnAppLauncher = document.getElementById("btn-app-launcher");
	const menuAppLauncher = document.getElementById("app-launcher-menu");
	const gridContainer = document.getElementById("app-launcher-grid");

	if (!btnAppLauncher || !menuAppLauncher) return;

	// 1. Configurar eventos de clique e fechamento
	btnAppLauncher.addEventListener("click", (e) => {
		e.stopPropagation();
		const estaEscondido = menuAppLauncher.classList.contains("hidden");
		if (estaEscondido) {
			menuAppLauncher.classList.remove("hidden");
			btnAppLauncher.classList.add("ativo");
		} else {
			menuAppLauncher.classList.add("hidden");
			btnAppLauncher.classList.remove("ativo");
		}
	});

	document.addEventListener("click", (e) => {
		if (
			!menuAppLauncher.contains(e.target) &&
			!btnAppLauncher.contains(e.target)
		) {
			menuAppLauncher.classList.add("hidden");
			btnAppLauncher.classList.remove("ativo");
		}
	});

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			menuAppLauncher.classList.add("hidden");
			btnAppLauncher.classList.remove("ativo");
		}
	});

	// 2. Carregar os dados dinâmicos do Supabase
	if (!gridContainer) return;

	try {
		const { data: solucoes, error } = await supabase
			.from("menu_solucoes")
			.select("*")
			.eq("ativo", true)
			.order("ordem", { ascending: true });

		if (error) {
			console.error("Erro ao carregar menu de soluções:", error);
			gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444; font-size: 0.85rem; padding: 12px;">Não foi possível carregar as soluções.</div>`;
			return;
		}

		if (!solucoes || solucoes.length === 0) {
			gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #64748b; font-size: 0.85rem; padding: 12px;">Nenhuma solução cadastrada.</div>`;
			return;
		}

		// Renderiza cada item
		gridContainer.innerHTML = solucoes
			.map((item) => {
				const urlDestino =
					item.url && item.url.trim() !== "" && item.url !== "#"
						? item.url
						: "#";
				const targetAttr =
					urlDestino !== "#" ? 'target="_blank" rel="noopener noreferrer"' : "";

				let iconeHtml = "";
				const iconeStr = (item.icone || "").trim();

				if (
					iconeStr.startsWith("http://") ||
					iconeStr.startsWith("https://") ||
					iconeStr.startsWith("/") ||
					iconeStr.startsWith("imagens/") ||
					iconeStr.endsWith(".png") ||
					iconeStr.endsWith(".svg") ||
					iconeStr.endsWith(".jpg") ||
					iconeStr.endsWith(".jpeg")
				) {
					// É um link de imagem do Storage ou arquivo local
					const inicial = (item.nome || "S").charAt(0).toUpperCase();
					iconeHtml = `
                    <div class="app-launcher-icon-wrapper">
                        <img src="${iconeStr}" alt="${item.nome}" onerror="this.parentElement.innerHTML='<div class=\\'app-launcher-fallback-badge\\'>${inicial}</div>'">
                    </div>
                `;
				} else if (iconeStr.startsWith("fa") || iconeStr.includes("fa-")) {
					// É uma classe de ícone do FontAwesome
					iconeHtml = `
                    <div class="app-launcher-icon-wrapper">
                        <i class="${iconeStr}"></i>
                    </div>
                `;
				} else {
					// Fallback: Letra inicial estilizada
					const inicial = (item.nome || "S").charAt(0).toUpperCase();
					iconeHtml = `
                    <div class="app-launcher-icon-wrapper">
                        <div class="app-launcher-fallback-badge">${inicial}</div>
                    </div>
                `;
				}

				return `
                <a href="${urlDestino}" ${targetAttr} class="app-launcher-item" title="${item.nome}">
                    ${iconeHtml}
                    <span>${item.nome}</span>
                </a>
            `;
			})
			.join("");
	} catch (err) {
		console.error("Falha na requisição do menu_solucoes:", err);
	}
}
