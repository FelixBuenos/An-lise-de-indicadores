import { filtroObserver } from '../servicos/FiltroObserver.js';

export function inicializarModalAvaliacao(supabase) {
    const modal = document.getElementById('modal-avaliacao');
    const btnAbrir = document.getElementById('btn-nova-avaliacao');
    const btnFechar = document.getElementById('btn-fechar-modal');

    const inputLoja = document.getElementById('aval-loja');
    const inputSemana = document.getElementById('aval-semana');
    const inputData = document.getElementById('aval-data');
    const inputAnalista = document.getElementById('aval-analista');
    const inputAssociado = document.getElementById('aval-associado');
    const corpoTabela = document.getElementById('corpo-tabela-avaliacao');
    const msgVazia = document.getElementById('msg-tabela-vazia');
    const btnSalvar = document.getElementById('btn-salvar-avaliacao');

    const btnBlocoComercial = document.getElementById('btn-bloco-comercial');
    const btnBlocoChecklist = document.getElementById('btn-bloco-checklist');
    const btnBlocoRh = document.getElementById('btn-bloco-rh');
    const btnLimparTabela = document.getElementById('btn-limpar-tabela');

    const containerSelecao = document.getElementById('container-selecao-dinamica');
    const labelCategoria = document.getElementById('label-categoria-selecionada');
    const selectDinamico = document.getElementById('select-indicador-dinamico');
    const btnAddDinamico = document.getElementById('btn-add-indicador-dinamico');

    const hoje = new Date().toISOString().split('T')[0];
    if (inputData) inputData.value = hoje;

    filtroObserver.inscrever((dados) => {
        const selectLoja = document.getElementById('select-loja');
        const nomeLojaTexto = selectLoja && selectLoja.selectedIndex >= 0
            ? selectLoja.options[selectLoja.selectedIndex].text
            : dados.filial;

        if (inputLoja) inputLoja.value = nomeLojaTexto;
        if (inputSemana) inputSemana.value = dados.periodo;

        carregarHistorico(supabase, dados.filial);
    });

   if (btnAbrir) {
    btnAbrir.addEventListener('click', () => {
        if (btnSalvar) btnSalvar.style.display = 'inline-block';
        if (btnBlocoComercial) btnBlocoComercial.style.display = 'inline-block';
        if (btnBlocoChecklist) btnBlocoChecklist.style.display = 'inline-block';
        if (btnBlocoRh) btnBlocoRh.style.display = 'inline-block';
        if (btnLimparTabela) btnLimparTabela.style.display = 'inline-block';
        if (containerSelecao) containerSelecao.style.display = 'none';

        if (inputAnalista) {
            inputAnalista.disabled = false;
            inputAnalista.readOnly = false;
            inputAnalista.value = '';
            inputAnalista.style.backgroundColor = '';
            inputAnalista.style.color = '';
            inputAnalista.style.cursor = '';
        }

        if (inputAssociado) {
            inputAssociado.disabled = false;
            inputAssociado.readOnly = false;
            inputAssociado.value = '';
            inputAssociado.style.backgroundColor = '';
            inputAssociado.style.color = '';
            inputAssociado.style.cursor = '';
        }

        if (inputData) {
            inputData.disabled = false;
            inputData.readOnly = false;
            inputData.value = hoje;
            inputData.style.backgroundColor = '';
            inputData.style.color = '';
            inputData.style.cursor = '';
        }

        if (inputLoja) {
            inputLoja.disabled = false;
            inputLoja.readOnly = true;
            inputLoja.style.backgroundColor = '';
            inputLoja.style.color = '';
            inputLoja.style.cursor = '';
        }

        if (inputSemana) {
            inputSemana.disabled = false;
            inputSemana.readOnly = true;
            inputSemana.style.backgroundColor = '';
            inputSemana.style.color = '';
            inputSemana.style.cursor = '';
        }

        corpoTabela.innerHTML = '';

        if (msgVazia) msgVazia.style.display = 'block';

        const selectLojaAtual = document.getElementById('select-loja');
const selectPeriodoAtual = document.getElementById('select-periodo');

const nomeLojaAtual = selectLojaAtual && selectLojaAtual.selectedIndex >= 0
    ? selectLojaAtual.options[selectLojaAtual.selectedIndex].text
    : '';

const periodoAtual = selectPeriodoAtual ? selectPeriodoAtual.value : '';

if (inputLoja) {
    inputLoja.value = nomeLojaAtual;
}

if (inputSemana) {
    inputSemana.value = periodoAtual;
}

        modal.style.display = 'flex';
    });
}
if (btnFechar) {
    btnFechar.addEventListener('click', () => {
        modal.style.display = 'none';
    });
}
    

    function adicionarLinhaIndicador(indicador, resultado, acao, status, somenteLeitura = false) {
        const novaLinha = document.createElement('tr');
        const readonlyAttr = somenteLeitura ? 'readonly' : '';
        const bgEstilo = somenteLeitura
            ? 'background-color: #f8f9fa; color: #333; border: 1px solid #e9ecef; cursor: not-allowed;'
            : '';
        const esconderBotao = somenteLeitura ? 'display: none;' : '';

        novaLinha.innerHTML = `
            <td class="nome-indicador"><strong>${indicador}</strong></td>
            <td>
                <input type="text" value="${resultado}" ${readonlyAttr} placeholder="Buscando..." style="width: 100%; padding: 6px; border-radius: 4px; text-align: center; font-weight: bold; ${bgEstilo}">
            </td>
            <td>
                <textarea rows="2" ${readonlyAttr} style="width: 100%; border-radius: 4px; padding: 5px; resize: vertical; ${bgEstilo}">${acao}</textarea>
            </td>
            <td>
                <input type="text" value="${status}" ${readonlyAttr} placeholder="Status..." style="width: 100%; padding: 6px; border-radius: 4px; ${bgEstilo}">
            </td>
            <td style="text-align: center; ${esconderBotao}">
                <button class="btn-remover-linha" style="color:red; background:none; border:none; cursor:pointer;">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;

        if (!somenteLeitura) {
            novaLinha.querySelector('.btn-remover-linha').addEventListener('click', () => {
                novaLinha.remove();

                if (corpoTabela.children.length === 0 && msgVazia) {
                    msgVazia.style.display = 'block';
                }
            });
        }

        corpoTabela.appendChild(novaLinha);
        return novaLinha;
    }

    const dicionarioMapeamento = {
        'Venda Líquida': { tabela: 'tabela_completa', coluna: 'venda_liquida', tipo: 'moeda' },
        'Itens Por Cliente': { tabela: 'tabela_completa', coluna: 'itens_por_cliente', tipo: 'decimal' },
        'Aproveitamento': { tabela: 'tabela_completa', coluna: 'aproveitamento', tipo: 'porcentagem' },
        'Ticket Médio': { tabela: 'tabela_completa', coluna: 'ticket_medio', tipo: 'moeda' },
        'CMV': { tabela: 'tabela_completa', coluna: 'cmv', tipo: 'porcentagem' },
        'Desconto': { tabela: 'tabela_completa', coluna: 'desconto', tipo: 'porcentagem' },
        'Cobertura': { tabela: 'tabela_completa', coluna: 'cobertura', tipo: 'numero' },
        'Excesso': { tabela: 'tabela_completa', coluna: 'excesso', tipo: 'numero' },
        'Falta': { tabela: 'tabela_completa', coluna: 'falta', tipo: 'porcentagem' },
        'EAS': { tabela: 'tabela_completa', coluna: 'eas', tipo: 'porcentagem' },

        'Estrutura da Área Externa': {
            tabela: 'nota_checklist_lojas',
            coluna: 'nota',
            colunaArea: 'area',
            area: 'Estrutura da Área Externa',
            tipo: 'porcentagem'
        },
        'Estrutura da Área Interior': {
            tabela: 'nota_checklist_lojas',
            coluna: 'nota',
            colunaArea: 'area',
            area: 'Estrutura da Área Interior',
            tipo: 'porcentagem'
        },
        'Atendimento e Padronização': {
            tabela: 'nota_checklist_lojas',
            coluna: 'nota',
            colunaArea: 'area',
            area: 'Atendimento e Padronização',
            tipo: 'porcentagem'
        },
       'Exposição de produtos': {
        tabela: 'nota_checklist_lojas',
        coluna: 'nota',
        colunaArea: 'area',
        area: 'Exposição%',
        tipo: 'porcentagem'
        },
        'Delivery e Entrega': {
            tabela: 'nota_checklist_lojas',
            coluna: 'nota',
            colunaArea: 'area',
            area: 'Delivery e Entrega',
            tipo: 'porcentagem'
        },
        'Aspectos Gerais': {
            tabela: 'nota_checklist_lojas',
            coluna: 'nota',
            colunaArea: 'area',
            area: 'Aspectos Gerais',
            tipo: 'porcentagem'
        },
        'Checklist promocional': {
         tabela: 'checklist_encarte',
        coluna: 'resultado',
        colunaLoja: 'unidade',
        colunaData: 'data',
        tipo: 'porcentagem'
        },

        'Folha de Pagamento': { tabela: 'dados_rh', coluna: 'folha_pagamento', tipo: 'porcentagem' },
        'Comissão': { tabela: 'dados_rh', coluna: 'comissao', tipo: 'porcentagem' },
        'Premiação': { tabela: 'dados_rh', coluna: 'premiacao', tipo: 'porcentagem' },
        'Horas Extras': { tabela: 'dados_rh', coluna: 'horas_extras', tipo: 'porcentagem' },
        'Perdas x Faturamento': { tabela: 'dados_rh', coluna: 'perdas', tipo: 'porcentagem' }
    };

    const listasPorCategoria = {
        comercial: [
            'Venda Líquida',
            'Itens Por Cliente',
            'Aproveitamento',
            'Ticket Médio',
            'CMV',
            'Desconto',
            'Cobertura',
            'Excesso',
            'Falta',
            'EAS'
        ],
        checklist: [
            'Estrutura da Área Externa',
            'Estrutura da Área Interior',
            'Atendimento e Padronização',
            'Exposição de produtos',
            'Delivery e Entrega',
            'Aspectos Gerais',
            'Checklist promocional'
        ],
        rh: [
            'Folha de Pagamento',
            'Comissão',
            'Premiação',
            'Horas Extras',
            'Perdas x Faturamento'
        ]
    };

    function formatarValorAutomatico(valor, tipo) {
        if (valor === null || valor === undefined || valor === '') return '-';

        const num = Number(valor);
        if (isNaN(num)) return valor;

        switch (tipo) {
            case 'moeda':
                return num.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                });

            case 'porcentagem':
                return (num > 1 || num === 0)
                    ? num.toLocaleString('pt-BR', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 1
                    }) + '%'
                    : (num * 100).toLocaleString('pt-BR', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 1
                    }) + '%';

            case 'decimal':
                return num.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 3
                });

            case 'numero':
                return Math.round(num).toString();

            default:
                return valor;
        }
    }

    function abrirSelecaoDeIndicadores(titulo, categoria) {
        if (containerSelecao) containerSelecao.style.display = 'flex';
        if (labelCategoria) labelCategoria.textContent = titulo;

        selectDinamico.innerHTML = '<option value="">Selecione um indicador...</option>';

        listasPorCategoria[categoria].forEach((indicador) => {
            const option = document.createElement('option');
            option.value = indicador;
            option.textContent = indicador;
            selectDinamico.appendChild(option);
        });
    }

    if (btnBlocoComercial) {
        btnBlocoComercial.addEventListener('click', () => {
            abrirSelecaoDeIndicadores('INDICADORES DE FATURAMENTO', 'comercial');
        });
    }

    if (btnBlocoChecklist) {
        btnBlocoChecklist.addEventListener('click', () => {
            abrirSelecaoDeIndicadores('INDICADORES DE CHECKLIST', 'checklist');
        });
    }

    if (btnBlocoRh) {
        btnBlocoRh.addEventListener('click', () => {
            abrirSelecaoDeIndicadores('INDICADORES DE RH', 'rh');
        });
    }

    if (btnLimparTabela) {
        btnLimparTabela.addEventListener('click', () => {
            corpoTabela.innerHTML = '';

            if (msgVazia) msgVazia.style.display = 'block';
            if (containerSelecao) containerSelecao.style.display = 'none';
        });
    }

    if (btnAddDinamico) {
        btnAddDinamico.addEventListener('click', async () => {
            if (!selectDinamico || !selectDinamico.value) {
                alert('Por favor, selecione um indicador na lista.');
                return;
            }

            const indicadorSelecionado = selectDinamico.value;
            const linhasAtuais = corpoTabela.querySelectorAll('tr');
            let indicadorJaExiste = false;

            linhasAtuais.forEach((tr) => {
                const nomeNaTabela = tr.querySelector('.nome-indicador').textContent;

                if (nomeNaTabela === indicadorSelecionado) {
                    indicadorJaExiste = true;
                }
            });

            if (indicadorJaExiste) {
                alert(`O indicador "${indicadorSelecionado}" já foi adicionado à tabela.`);
                return;
            }

            if (msgVazia) msgVazia.style.display = 'none';

            const linhaCriada = adicionarLinhaIndicador(indicadorSelecionado, '', '', '', false);
            const inputResultado = linhaCriada.querySelectorAll('input')[0];
            inputResultado.value = 'Buscando...';

            selectDinamico.value = '';

            const selectLoja = document.getElementById('select-loja');
            const selectPeriodo = document.getElementById('select-periodo');

            const nomeFilialTexto = selectLoja && selectLoja.selectedIndex >= 0
                ? selectLoja.options[selectLoja.selectedIndex].text
                : '';

            const periodo = selectPeriodo ? selectPeriodo.value : '';
            const mapeamento = dicionarioMapeamento[indicadorSelecionado];

            if (
                !mapeamento ||
                !nomeFilialTexto ||
                nomeFilialTexto.toLowerCase().includes('selecione') ||
                !periodo
            ) {
                inputResultado.value = '-';
                return;
            }

            try {
                let valorObtido = null;
                const [dataInicio, dataFim] = periodo.split('|');

                if (mapeamento.tabela === 'tabela_completa') {
                    const { data, error } = await supabase
                        .from('tabela_completa')
                        .select(mapeamento.coluna)
                        .eq('filial', nomeFilialTexto.trim())
                        .eq('data_inicio', dataInicio)
                        .eq('data_final', dataFim)
                        .order('data_final', { ascending: false })
                        .limit(1);

                    if (error) {
                        console.error('Erro ao buscar faturamento:', error);
                    }

                    if (!error && data && data.length > 0) {
                        valorObtido = data[0][mapeamento.coluna];
                    }
                }

    else if (mapeamento.tabela === 'nota_checklist_lojas') {
    const { data, error } = await supabase
        .from('nota_checklist_lojas')
        .select('nota, area, data')
        .eq('filial', nomeFilialTexto.trim())
        .ilike('area', mapeamento.area)
        .order('data', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Erro ao buscar checklist:', error);
    }

    if (!error && data && data.length > 0) {
        valorObtido = data[0].nota;
    }
}

else if (mapeamento.tabela === 'checklist_encarte') {
    const { data, error } = await supabase
        .from('checklist_encarte')
        .select(mapeamento.coluna)
        .eq(mapeamento.colunaLoja, nomeFilialTexto.trim())
        .order(mapeamento.colunaData, { ascending: false })
        .limit(1);

    if (error) {
        console.error('Erro ao buscar checklist promocional:', error);
    }

    if (!error && data && data.length > 0) {
        valorObtido = data[0][mapeamento.coluna];
    }
}

                else if (mapeamento.tabela === 'dados_rh') {
                    const { data, error } = await supabase
                        .from('dados_rh')
                        .select(mapeamento.coluna)
                        .eq('filial', nomeFilialTexto.trim())
                        .order('data', { ascending: false })
                        .limit(1);

                    if (error) {
                        console.error('Erro ao buscar RH:', error);
                    }

                    if (!error && data && data.length > 0) {
                        valorObtido = data[0][mapeamento.coluna];
                    }
                }

                inputResultado.value = formatarValorAutomatico(valorObtido, mapeamento.tipo);
            } catch (err) {
                console.error('Erro na busca automatizada:', err);
                inputResultado.value = 'Erro';
            }
        });
    }

    if (btnSalvar) {
        btnSalvar.addEventListener('click', async () => {
            const lines = corpoTabela.querySelectorAll('tr');

            if (lines.length === 0) {
                alert('Adicione pelo menos um indicador antes de salvar.');
                return;
            }

            const detalhes = Array.from(lines).map((tr) => ({
                indicador: tr.querySelector('.nome-indicador').textContent,
                resultado: tr.querySelectorAll('input')[0].value,
                acao: tr.querySelector('textarea').value,
                status: tr.querySelectorAll('input')[1].value
            }));

            const { error } = await supabase.from('avaliacoes_semanais').insert([{
                loja: inputLoja.value,
                data_avaliacao: inputData.value,
                semana: inputSemana.value,
                analista: inputAnalista.value,
                associado: inputAssociado.value,
                avaliacoes_detalhes: detalhes
            }]);

            if (error) {
                alert('Erro ao salvar: ' + error.message);
            } else {
                alert('Avaliação salva com sucesso!');

                modal.style.display = 'none';
                corpoTabela.innerHTML = '';

                if (msgVazia) msgVazia.style.display = 'block';
                if (containerSelecao) containerSelecao.style.display = 'none';

                const filialCodigo = document.getElementById('select-loja').value;
                carregarHistorico(supabase, filialCodigo);
            }
        });
    }

    configurarCliqueHistorico(
        supabase,
        modal,
        inputLoja,
        inputData,
        inputSemana,
        inputAnalista,
        inputAssociado,
        corpoTabela,
        msgVazia,
        btnSalvar,
        btnBlocoComercial,
        btnBlocoChecklist,
        btnBlocoRh,
        btnLimparTabela,
        containerSelecao,
        adicionarLinhaIndicador
    );
}

function configurarCliqueHistorico(
    supabase,
    modal,
    inputLoja,
    inputData,
    inputSemana,
    inputAnalista,
    inputAssociado,
    corpoTabela,
    msgVazia,
    btnSalvar,
    btnBlocoComercial,
    btnBlocoChecklist,
    btnBlocoRh,
    btnLimparTabela,
    containerSelecao,
    adicionarLinhaIndicador
) {
    const tabelaHistorico = document.getElementById('tabela-historico');
    if (!tabelaHistorico) return;

    tabelaHistorico.addEventListener('click', async (e) => {
        const botaoVisualizar = e.target.closest('.btn-visualizar-historico');
        if (!botaoVisualizar) return;

        const idRegistro = botaoVisualizar.getAttribute('data-id');

        const { data, error } = await supabase
            .from('avaliacoes_semanais')
            .select('*')
            .eq('id', idRegistro)
            .single();

        if (error || !data) {
            alert('Não foi possível carregar os detalhes desta avaliação.');
            return;
        }

        if (btnSalvar) btnSalvar.style.display = 'none';
        if (btnBlocoComercial) btnBlocoComercial.style.display = 'none';
        if (btnBlocoChecklist) btnBlocoChecklist.style.display = 'none';
        if (btnBlocoRh) btnBlocoRh.style.display = 'none';
        if (btnLimparTabela) btnLimparTabela.style.display = 'none';
        if (containerSelecao) containerSelecao.style.display = 'none';

        const estiloBloqueado = 'background-color: #f1f3f5; color: #495057; cursor: not-allowed;';

        if (inputLoja) {
            inputLoja.disabled = true;
            inputLoja.style.cssText = estiloBloqueado;
        }

        if (inputSemana) {
            inputSemana.disabled = true;
            inputSemana.style.cssText = estiloBloqueado;
        }

        if (inputData) {
            inputData.disabled = true;
            inputData.style.cssText = estiloBloqueado;
        }

        if (inputAnalista) {
            inputAnalista.disabled = true;
            inputAnalista.style.cssText = estiloBloqueado;
        }

        if (inputAssociado) {
            inputAssociado.disabled = true;
            inputAssociado.style.cssText = estiloBloqueado;
        }

        if (inputLoja) inputLoja.value = data.loja;
        if (inputData) inputData.value = data.data_avaliacao;
        if (inputSemana) inputSemana.value = data.semana;
        if (inputAnalista) inputAnalista.value = data.analista;
        if (inputAssociado) inputAssociado.value = data.associado;

        corpoTabela.innerHTML = '';

        if (msgVazia) msgVazia.style.display = 'none';

        if (data.avaliacoes_detalhes && Array.isArray(data.avaliacoes_detalhes)) {
            data.avaliacoes_detalhes.forEach((det) => {
                adicionarLinhaIndicador(det.indicador, det.resultado, det.acao, det.status, true);
            });
        }

        modal.style.display = 'flex';
    });
}



export async function carregarHistorico(supabase, filial) {
    if (!supabase) return;

    const tbody = document.querySelector('#tabela-historico tbody');
    if (!tbody) return;

    const selectLoja = document.getElementById('select-loja');
    const nomeLojaTexto = selectLoja && selectLoja.selectedIndex >= 0
        ? selectLoja.options[selectLoja.selectedIndex].text
        : filial;

    if (!nomeLojaTexto || nomeLojaTexto.toLowerCase().includes('selecione')) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; color: #888; font-style: italic;">
                    Selecione uma filial para carregar o histórico.
                </td>
            </tr>
        `;
        return;
    }

    const { data, error } = await supabase
        .from('avaliacoes_semanais')
        .select('*')
        .eq('loja', nomeLojaTexto.trim())
        .order('data_avaliacao', { ascending: false })
        .limit(1000);

    if (error) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; color: #dc3545;">
                    Erro ao obter dados do histórico.
                </td>
            </tr>
        `;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; color: #888; font-style: italic;">
                    Nenhuma avaliação registrada para esta filial.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data.map((item) => `
        <tr>
            <td>${formatarDataBr(item.data_avaliacao)}</td>
            <td>${item.associado || '-'}</td>
            <td style="display: flex; justify-content: space-between; align-items: center; border-bottom: none;">
                <span>${item.avaliacoes_detalhes ? item.avaliacoes_detalhes.length : 0} indicador(es) avaliado(s)</span>
                <button class="btn-visualizar-historico" data-id="${item.id}" style="background: #2b55a1; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 5px;">
                    <i class="fas fa-eye"></i> Visualizar
                </button>
            </td>
        </tr>
    `).join('');
}

function formatarDataBr(dataString) {
    if (!dataString) return '-';

    const partes = dataString.split('-');

    if (partes.length !== 3) return dataString;

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}