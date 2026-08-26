// main.js

// ==========================================
// 1. TODOS OS IMPORTS NO TOPO DO ARQUIVO
// ==========================================
import { supabase } from './js/servicos/supabaseClient.js';
import { inicializarFiltros } from './js/componentes/filtros.js?v=75';
import { inicializarDestaqueInterativo } from './js/componentes/interacoes.js';
import { inicializarExportacaoPDF } from './js/componentes/exportar.js'; 
import { inicializarModalAvaliacao, carregarHistorico } from './js/componentes/avaliacao.js?v=75';

import { filtroObserver } from './js/servicos/FiltroObserver.js';
import { preencherTabelaChecklist } from './js/componentes/tabela-checklist.js?v=85';
import { preencherTabelaPrincipal } from './js/componentes/tabela-principal.js?v=85';
import { preencherTabelaMedia } from './js/componentes/tabela-media.js?v=85';
import { renderizarDiagnostico } from './js/componentes/diagnostico.js?v=85';



// ==========================================
// 3. FUNÇÕES MATEMÁTICAS E DE RENDERIZAÇÃO
// ==========================================

// Converte decimal (0.09882) em porcentagem (9.9%)
function formatarPorcentagem(valor) {
    if (valor === null || valor === undefined || isNaN(valor)) return "-";
    return (valor * 100).toFixed(1) + "%";
}

// Calcula a média de uma coluna específica de um array de objetos
function calcularMedia(arrayDeDados, nomeDaColuna) {
    const valoresValidos = arrayDeDados
        .map(item => item[nomeDaColuna])
        .filter(v => v !== null && v !== undefined && !isNaN(v));

    if (valoresValidos.length === 0) return 0;
    
    const soma = valoresValidos.reduce((total, num) => total + Number(num), 0);
    return soma / valoresValidos.length;
}

// Limpa toda a tabela (Valor e Cluster)
function limparTabelaRH() {
    const ids = [
        'rh-folha', 'rh-comissao', 'rh-premiacao', 'rh-horas', 'rh-perdas',
        'cluster-folha', 'cluster-comissao', 'cluster-premiacao', 'cluster-horas', 'cluster-perdas'
    ];
    ids.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = "-";
    });
}

// ==========================================
// 4. FUNÇÃO PRINCIPAL DE INTELIGÊNCIA (RH)
// ==========================================
async function buscarDadosRH(nomeFilial, periodoSelecionado) {
    if (!nomeFilial || nomeFilial === 'todas' || !periodoSelecionado) {
        limparTabelaRH();
        return;
    }

    try {
        // Separa a string da semana que vem do HTML (Ex: "2026-03-22|2026-03-28")
        const [dataInicioUi, dataFimUi] = periodoSelecionado.split('|');

        // --- PASSO 1: Busca os dados recentes de RH da filial selecionada ---
        const { data: dadosFilial, error: errFilial } = await supabase
            .from('dados_rh')
            .select('*')
            .eq('filial', nomeFilial)
            .order('data', { ascending: false })
            .limit(1)
            .single();

        if (errFilial || !dadosFilial) {
            limparTabelaRH();
            console.warn(`Nenhum dado encontrado em dados_rh para a filial: ${nomeFilial}`);
            return;
        }

        const dataReferencia = dadosFilial.data; // Guardamos a data para o cálculo da média

        // Injeta os dados da filial na coluna "VALOR"
        document.getElementById('rh-folha').textContent = formatarPorcentagem(dadosFilial.folha_pagamento);
        document.getElementById('rh-comissao').textContent = formatarPorcentagem(dadosFilial.comissao);
        document.getElementById('rh-premiacao').textContent = formatarPorcentagem(dadosFilial.premiacao);
        document.getElementById('rh-horas').textContent = formatarPorcentagem(dadosFilial.horas_extras);
        document.getElementById('rh-perdas').textContent = formatarPorcentagem(dadosFilial.perdas);

        // --- PASSO 2: Mapeamento de Cluster via data_inicio e data_final ---
        const { data: dadosCluster, error: errCluster } = await supabase
            .from('tabela_completa')
            .select('cluster')
            .eq('filial', nomeFilial)
            .eq('data_inicio', dataInicioUi)
            .eq('data_final', dataFimUi)
            .order('data_final', { ascending: false })
            .limit(1);

        if (errCluster || !dadosCluster || dadosCluster.length === 0 || !dadosCluster[0].cluster) {
            console.warn("Cluster não encontrado para as datas informadas na tabela_completa.");
            return;
        }

        const nomeCluster = dadosCluster[0].cluster;

        // --- PASSO 3: Busca TODAS as filiais desse mesmo cluster no mesmo intervalo de datas ---
        const { data: listaFiliais, error: errLista } = await supabase
            .from('tabela_completa')
            .select('filial')
            .eq('cluster', nomeCluster)
            .eq('data_inicio', dataInicioUi)
            .eq('data_final', dataFimUi)
            .order('data_final', { ascending: false })
            .limit(1000);

        const filiaisDoCluster = listaFiliais.map(f => f.filial);

        // --- PASSO 4: Busca os dados de RH do cluster na MESMA DATA e calcula a média ---
        const { data: dadosDoGrupo, error: errGrupo } = await supabase
            .from('dados_rh')
            .select('*')
            .in('filial', filiaisDoCluster)
            .eq('data', dataReferencia)
            .order('data', { ascending: false })
            .limit(1000); 

        // Injeta as médias na coluna "CLUSTER"
        document.getElementById('cluster-folha').textContent = formatarPorcentagem(calcularMedia(dadosDoGrupo, 'folha_pagamento'));
        document.getElementById('cluster-comissao').textContent = formatarPorcentagem(calcularMedia(dadosDoGrupo, 'comissao'));
        document.getElementById('cluster-premiacao').textContent = formatarPorcentagem(calcularMedia(dadosDoGrupo, 'premiacao'));
        document.getElementById('cluster-horas').textContent = formatarPorcentagem(calcularMedia(dadosDoGrupo, 'horas_extras'));
        document.getElementById('cluster-perdas').textContent = formatarPorcentagem(calcularMedia(dadosDoGrupo, 'perdas'));

    } catch (err) {
        console.error("Erro inesperado no processamento do RH e Cluster:", err);
        limparTabelaRH();
    }
}


// ==========================================
// 5. INICIALIZAÇÃO SEGURA E OBSERVERS
// ==========================================
async function iniciarSistema() {
    // 1. Verifica imediatamente se existe uma sessão activa antes de renderizar os dados
    const { data: { session } } = await supabase.auth.getSession();

    // 2. Se não estiver logado, bloqueia o acesso e redireciona para a tela de login
    if (!session) {
        window.location.href = 'login.html';
        return; 
    }

    // 3. Inicializa o modal de demandas imediatamente
    inicializarModalAvaliacao(supabase);

    // Carrega os filtros buscando as filiais e semanas
    await inicializarFiltros(supabase);
    
    // Inicializa o efeito visual de clique nas linhas da tabela azul
    inicializarDestaqueInterativo();

    // Inicializa a função do botão de exportar para PDF
    inicializarExportacaoPDF();
    
    // ---------------------------------------------------------
    // OS OUVINTES (Inscrevendo as tabelas no Observer)
    // ---------------------------------------------------------
    
    // O Diagnóstico Semanal Inteligente se inscreve para ouvir as mudanças de filtro
    filtroObserver.inscrever((dados) => {
        renderizarDiagnostico(supabase, dados.filial, dados.periodo);
    });

    // A Tabela RH se inscreve para ouvir as mudanças de filtro
    filtroObserver.inscrever((dados) => {
        buscarDadosRH(dados.filial, dados.periodo);
    });

    // A Tabela Checklist se inscreve para ouvir as mudanças de filtro
    filtroObserver.inscrever((dados) => {
        preencherTabelaChecklist(supabase, dados.filial, dados.periodo);
    });

    // A Tabela Principal se inscreve para ouvir as mudanças de filtro
    filtroObserver.inscrever((dados) => {
        preencherTabelaPrincipal(supabase, dados.filial, dados.periodo);
    });

    // A Tabela Média se inscreve para ouvir as mudanças de filtro
    filtroObserver.inscrever((dados) => {
        preencherTabelaMedia(supabase, dados.filial, dados.periodo);
    });

    // O Histórico de Demandas se inscreve para atualizar sempre que mudar de loja
    filtroObserver.inscrever((dados) => {
        carregarHistorico(supabase, dados.filial);
    });

    // ---------------------------------------------------------
    // CARGA INICIAL E MUDANÇA DIRETA DO HISTÓRICO
    // ---------------------------------------------------------
    const selectLojaInicial = document.getElementById('select-loja');
    if (selectLojaInicial) {
        // Carga inicial
        carregarHistorico(supabase, selectLojaInicial.value);

        // Atualização instantânea ao trocar o dropdown
        selectLojaInicial.addEventListener('change', () => {
            carregarHistorico(supabase, selectLojaInicial.value);
        });
    }

    // Função do botão de Sair (Logout)
    const btnSair = document.getElementById('btn-sair');
    if (btnSair) {
        btnSair.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = 'login.html';
        });
    }
}

// Dispara a função protetora assim que a estrutura do HTML estiver pronta no navegador
document.addEventListener('DOMContentLoaded', iniciarSistema);