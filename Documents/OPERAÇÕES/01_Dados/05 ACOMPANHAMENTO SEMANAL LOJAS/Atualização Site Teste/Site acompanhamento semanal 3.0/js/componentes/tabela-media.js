// js/componentes/tabela-media.js

export async function preencherTabelaMedia(supabase, filialEscolhida, periodoEscolhido) {
    const partesData = periodoEscolhido.split('|');
    const dataFinalAtualStr = partesData[1]; 

    const { data: registrosLoja, error: erroLoja } = await supabase
        .from('tabela_completa')
        .select('*')
        .eq('filial', filialEscolhida)
        .eq('data_final', dataFinalAtualStr)
        .order('data_final', { ascending: false })
        .limit(1); 

    if (erroLoja) {
        console.error('Erro na tabela_completa:', erroLoja);
        return;
    }

    const dadosLoja = registrosLoja && registrosLoja.length > 0 ? registrosLoja[0] : null;
    if (!dadosLoja) return;

    const classeLoja = dadosLoja?.status;
    if (!classeLoja) return;

    // Preenche a Linha 1 (Média da Classe)
    preencherLinhaMediaClasse(dadosLoja);

    // 2. PREPARAÇÃO DA BUSCA NA META_CLUSTER
    const statusNormalizado = String(classeLoja).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    let termoBuscaCluster = "classe 2"; 
    if (statusNormalizado === 'alto' || statusNormalizado === 'alta') {
        termoBuscaCluster = 'classe 1';
    } else if (statusNormalizado === 'medio' || statusNormalizado === 'media') {
        termoBuscaCluster = 'classe 2';
    } else if (statusNormalizado === 'baixo' || statusNormalizado === 'baixa') {
        termoBuscaCluster = 'classe 3';
    }

    // Busca as metas ignorando espaços em branco
    const { data: metasCluster, error: erroMercado } = await supabase
        .from('meta_cluster')
        .select('*')
        .ilike('cluster', `%${termoBuscaCluster}%`); 

    if (erroMercado) {
        console.error('Erro ao buscar meta_cluster:', erroMercado);
        return;
    }

    // 3. PREENCHIMENTO NO HTML (AJUSTADO PARA A LINHA DO MEIO - ÍNDICE 1)
    const linhasTabelaLarga = document.querySelectorAll('.tabela-larga tbody tr');
    const linhaMediaMercado = linhasTabelaLarga[1]; // Segunda linha (linha do meio)
    const celulasMeta = linhaMediaMercado.querySelectorAll('td');

    const mapaIndicadores = {
        'venda liquida': 1,
        'itens por cliente': 2,
        'aproveitamento': 3,
        'ticket medio': 4,
        'cmv': 5,
        'desconto': 6,
        'cobertura': 7,
        'excesso': 8,
        'falta': 9,
        'eas': 10
    };

    // Limpa a linha com traços por defeito
    for (let i = 1; i <= 10; i++) {
        celulasMeta[i].textContent = '-';
    }

    if (metasCluster && metasCluster.length > 0) {
        metasCluster.forEach(meta => {
            if (!meta.indicador) return;

            const indicadorNome = meta.indicador.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const colunaIndex = mapaIndicadores[indicadorNome];

            if (colunaIndex) {
                // Define formatação
                let tipoFormato = 'moeda';
                if (indicadorNome === 'itens por cliente') tipoFormato = 'decimal';
                else if (['cobertura', 'excesso'].includes(indicadorNome)) tipoFormato = 'inteiro_puro';
                else if (['aproveitamento', 'cmv', 'desconto', 'falta', 'eas'].includes(indicadorNome)) tipoFormato = 'percentual';

                // Pega apenas o valor máximo e o operador máximo
                const valorMax = meta.valor_max;
                const opMax = (meta.operador_max && meta.operador_max !== 'EMPTY') ? meta.operador_max.trim() : '';

                let textoFinal = '-';

                // Se existir um valor máximo no banco, formata com o operador
                if (valorMax !== null && valorMax !== undefined) {
                    textoFinal = `${opMax} ${formatarValor(valorMax, tipoFormato)}`.trim();
                }

                celulasMeta[colunaIndex].textContent = textoFinal;
            }
        });
    } else {
        console.warn('A busca na meta_cluster não retornou nenhuma linha! Verifique o RLS.');
    }
}

function preencherLinhaMediaClasse(dadosClasse) {
    if (!dadosClasse) return;
    const linhasTabelaLarga = document.querySelectorAll('.tabela-larga tbody tr');
    const linhaMediaClasse = linhasTabelaLarga[0]; 
    const celulas = linhaMediaClasse.querySelectorAll('td');

    celulas[1].textContent = formatarValor(dadosClasse.media_venda_liquida, 'moeda');
    celulas[2].textContent = formatarValor(dadosClasse.media_itens_por_cliente, 'decimal');
    celulas[3].textContent = formatarValor(dadosClasse.media_aproveitamento, 'percentual');
    celulas[4].textContent = formatarValor(dadosClasse.media_ticket_medio, 'moeda');
    celulas[5].textContent = formatarValor(dadosClasse.media_cmv, 'percentual');
    celulas[6].textContent = formatarValor(dadosClasse.media_desconto, 'percentual');
    celulas[7].textContent = formatarValor(dadosClasse.media_cobertura, 'inteiro_puro');
    celulas[8].textContent = formatarValor(dadosClasse.media_excesso, 'inteiro_puro');
    celulas[9].textContent = formatarValor(dadosClasse.media_falta, 'percentual');
    celulas[10].textContent = formatarValor(dadosClasse.media_eas, 'percentual');
}

function formatarValor(valor, tipo) {
    if (valor === null || valor === undefined || valor === '') return '-';
    const num = parseFloat(valor);
    if (isNaN(num)) return '-';

    switch (tipo) {
        case 'moeda':
            return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        case 'percentual':
            const valorPercentual = (num <= 1 && num > 0) ? num * 100 : num;
            return valorPercentual.toFixed(1).replace('.', ',') + '%';
        case 'decimal':
            return num.toFixed(2).replace('.', ',');
        case 'inteiro_puro':
            return Math.round(num).toString();
        default:
            return num.toString();
    }
}