// js/servicos/FiltroObserver.js

class FiltroObserver {
    constructor() {
        this.ouvintes = []; // Lista de quem está escutando a rádio
    }

    // Método para as tabelas ligarem o rádio
    inscrever(funcaoOuvinte) {
        this.ouvintes.push(funcaoOuvinte);
    }

    // Método para o botão gritar no alto-falante
    notificar(dadosDoFiltro) {
        console.log("📢 Observer: Notificando ouvintes com os dados ->", dadosDoFiltro);
        this.ouvintes.forEach(ouvinte => ouvinte(dadosDoFiltro));
    }
}

// Criamos uma única "rádio" para o painel inteiro usar
export const filtroObserver = new FiltroObserver();