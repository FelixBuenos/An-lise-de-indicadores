// js/componentes/interacoes.js

export function inicializarDestaqueInterativo() {
    const linhasTabelaAzul = document.querySelectorAll('.tabela-principal tbody tr');
    const tabelaPreta = document.querySelector('.tabela-larga');

    const mapaColunas = {
        'venda liquida': 1,
        'qtd cliente': 2,
        'qtd clientes': 2,
        'quantidade de clientes': 2,
        'itens por cliente': 3,
        'aproveitamento': 4,
        'ticket medio': 5,
        'cmv': 6,
        'desconto': 7,
        'cobertura': 8,
        'excesso': 9,
        'falta': 10
    };

    linhasTabelaAzul.forEach(linha => {
        linha.addEventListener('click', () => {
            
            // 1. Descobre qual indicador foi clicado
            const nomeIndicador = linha.querySelector('td').textContent
                .trim()
                .toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            const indiceColuna = mapaColunas[nomeIndicador];
            
            if (!indiceColuna) return; // Se clicar numa linha inválida, não faz nada

            const colunaCssIndex = indiceColuna + 1;
            const thAlvo = tabelaPreta.querySelector(`thead tr th:nth-child(${colunaCssIndex})`);

            // 2. VERIFICAÇÃO INTELIGENTE: A coluna alvo JÁ está destacada?
            const jaEstaDestacada = thAlvo && thAlvo.classList.contains('destaque-coluna');

            // 3. Limpa a tela (apaga todos os destaques existentes)
            document.querySelectorAll('.destaque-coluna').forEach(elemento => {
                elemento.classList.remove('destaque-coluna');
            });

            // 4. Se a coluna NÃO estava destacada, nós acendemos ela.
            // Se ela já estava destacada, o passo 3 já apagou e o código para por aqui (Efeito de apagar).
            if (!jaEstaDestacada) {
                
                // Destaca o Cabeçalho
                if (thAlvo) thAlvo.classList.add('destaque-coluna');

                // Destaca as células do corpo
                const linhasCorpo = tabelaPreta.querySelectorAll('tbody tr');
                linhasCorpo.forEach(tr => {
                    const td = tr.querySelector(`td:nth-child(${colunaCssIndex})`);
                    if (td) td.classList.add('destaque-coluna');
                });
            }
        });
    });
}