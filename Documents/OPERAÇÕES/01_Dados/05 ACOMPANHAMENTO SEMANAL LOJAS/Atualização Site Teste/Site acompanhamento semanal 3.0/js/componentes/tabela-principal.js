// js/componentes/tabela-principal.js

export async function preencherTabelaPrincipal(supabase, filialEscolhida, periodoEscolhido) {
    
    // =========================================================
    // 1. ATUALIZA CABEÇALHOS COM AS DATAS
    // =========================================================
    function atualizarCabecalhosSemanas(periodo) {
        if (!periodo) return;
        const [dataInicioStr, dataFinalStr] = periodo.split('|');

        // Usamos T12:00:00 para evitar o bug de fuso horário brasileiro no JS que atrasa a data em 1 dia
        const dataInicio = new Date(`${dataInicioStr}T12:00:00`);
        const dataFinal = new Date(`${dataFinalStr}T12:00:00`);

        function formatar(data) {
            const dia = String(data.getDate()).padStart(2, '0');
            const mes = String(data.getMonth() + 1).padStart(2, '0');
            return `${dia}/${mes}`;
        }

        function subtrair(data, dias) {
            const d = new Date(data);
            d.setDate(d.getDate() - dias);
            return d;
        }

        // Calcula as datas tirando 7, 14 e 21 dias da data base
        const txtAtual = `${formatar(dataInicio)} a ${formatar(dataFinal)}`;
        const txtSemana2 = `${formatar(subtrair(dataInicio, 7))} a ${formatar(subtrair(dataFinal, 7))}`;
        const txtSemana3 = `${formatar(subtrair(dataInicio, 14))} a ${formatar(subtrair(dataFinal, 14))}`;
        const txtSemana4 = `${formatar(subtrair(dataInicio, 21))} a ${formatar(subtrair(dataFinal, 21))}`;

        // Seleciona os cabeçalhos da tabela azul e injeta as datas com uma fonte menor
        const ths = document.querySelectorAll('.tabela-principal thead th');
        if (ths.length >= 5) {
            ths[1].innerHTML = `SEMANA 4<br><span style="font-size: 0.85em; font-weight: normal;">${txtSemana4}</span>`;
            ths[2].innerHTML = `SEMANA 3<br><span style="font-size: 0.85em; font-weight: normal;">${txtSemana3}</span>`;
            ths[3].innerHTML = `SEMANA 2<br><span style="font-size: 0.85em; font-weight: normal;">${txtSemana2}</span>`;
            ths[4].innerHTML = `SEMANA ATUAL<br><span style="font-size: 0.85em; font-weight: normal;">${txtAtual}</span>`;
        }
    }

    // Executa a troca de datas no cabeçalho imediatamente
    atualizarCabecalhosSemanas(periodoEscolhido);

    // =========================================================
    // 2. BUSCA DINÂMICA POR ORDEM CRONOLÓGICA DECRESCENTE
    // =========================================================
    const partesData = periodoEscolhido.split('|');
    const dataFinalAtualStr = partesData[1]; 

    // Buscamos os 5 últimos registros da filial retroativos a partir da data selecionada
    const { data: registros, error } = await supabase
        .from('dados_lojas')
        .select('*')
        .eq('filial', filialEscolhida)
        .lte('data_final', dataFinalAtualStr)      // lte = Menor ou igual à data selecionada
        .order('data_final', { ascending: false }) // Traz do mais recente para o mais antigo
        .limit(5);                                 // Garante que só puxa as 5 semanas necessárias

    if (error) {
        console.error('Erro ao buscar dados da tabela principal:', error);
        return;
    }

    // Se o banco retornar vazio para os filtros selecionados, interrompe para evitar erros
    if (!registros || registros.length === 0) return;

    // =========================================================
    // 3. DICIONÁRIO DE DE-PARA (HTML vs Banco)
    // =========================================================
    const deParaIndicadores = {
        'Venda Liquida': { coluna: 'venda_liquida', tipo: 'moeda' },
        'Itens Por Cliente': { coluna: 'itens_por_cliente', tipo: 'decimal' }, 
        'Aproveitamento': { coluna: 'aproveitamento', tipo: 'percentual_uma_casa' },
        'Ticket Médio': { coluna: 'ticket_medio', tipo: 'moeda' },
        'CMV': { coluna: 'cmv', tipo: 'percentual_uma_casa' },
        'Desconto': { coluna: 'desconto', tipo: 'percentual_uma_casa' },
        'Cobertura': { coluna: 'cobertura', tipo: 'inteiro_puro' }, 
        'Excesso': { coluna: 'excesso', tipo: 'inteiro_puro' },     
        'Falta': { coluna: 'falta', tipo: 'percentual_uma_casa' },
        'EAS': { coluna: 'eas', tipo: 'percentual_uma_casa' }
    };

    // =========================================================
    // 4. PREENCHER AS LINHAS DA TABELA AZUL
    // =========================================================
    const linesTabela = document.querySelectorAll('.tabela-principal tbody tr'); 

    linesTabela.forEach(linha => {
        const celulaIndicador = linha.querySelector('.coluna-fixa');
        if (!celulaIndicador) return;

        const nomeIndicador = celulaIndicador.textContent.trim();
        const config = deParaIndicadores[nomeIndicador];

        if (config) {
            const celulas = linha.querySelectorAll('td');

            // DISTRIBUIÇÃO POR POSIÇÃO NO ARRAY:
            // Como ordenamos decrescente, registros[0] é sempre o período mais novo (Semana Atual)
            const valorSAtual = registros[0] ? registros[0][config.coluna] : null;
            const valorS2     = registros[1] ? registros[1][config.coluna] : null;
            const valorS3     = registros[2] ? registros[2][config.coluna] : null;
            const valorS4     = registros[3] ? registros[3][config.coluna] : null;
            const valorMsMa   = registros[4] ? registros[4][config.coluna] : null;

            // Injeta a formatação tratada nas colunas do HTML respeitando o cabeçalho
            celulas[1].textContent = formatarValor(valorS4, config.tipo);     // Coluna Semana 4
            celulas[2].textContent = formatarValor(valorS3, config.tipo);     // Coluna Semana 3
            celulas[3].textContent = formatarValor(valorS2, config.tipo);     // Coluna Semana 2
            celulas[4].textContent = formatarValor(valorSAtual, config.tipo); // Coluna Semana Atual
            celulas[5].textContent = formatarValor(valorMsMa, config.tipo);   // Coluna MS / SA
        }
    });
}

// --- CENTRAL DE FORMATAÇÃO ---
function formatarValor(valor, tipo) {
    if (valor === null || valor === undefined) return '-';
    const num = parseFloat(valor);
    if (isNaN(num)) return '-';

    switch (tipo) {
        case 'moeda':
            return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        case 'percentual_uma_casa':
            const valorPercentual = num <= 1 && num > 0 ? num * 100 : num;
            return valorPercentual.toFixed(1).replace('.', ',') + '%';
        case 'decimal':
            return num.toFixed(2).replace('.', ',');
        case 'inteiro_puro':
            return Math.round(num).toString();
        default:
            return num.toString();
    }
}