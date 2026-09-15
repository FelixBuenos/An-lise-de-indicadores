// js/componentes/exportar.js

export function inicializarExportacaoPDF() {
	const botao = document.getElementById("btn-exportar-pdf");
	if (!botao) return;

	botao.addEventListener("click", () => {
		// Aciona o motor nativo de PDF do navegador
		window.print();
	});
}
