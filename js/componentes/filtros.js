// js/componentes/filtros.js

import { filtroObserver } from '../servicos/FiltroObserver.js';

export async function inicializarFiltros(supabase) {
    const lojaSelect = document.getElementById('select-loja');
    const periodoSelect = document.getElementById('select-periodo');
    const mesSelect = document.getElementById('select-mes');
    const statusSelect = document.getElementById('select-status'); 
    const redeSelect = document.getElementById('select-rede'); 
    const btnFiltrar = document.getElementById('btn-filtrar');
    
    let todasFiliais = []; // Guarda a lista original de todas as filiais
    let filialParaRede = {}; // Mapeamento de cada filial para a sua Rede atual

    // Parâmetros de URL (Deep Linking a partir de Demandas)
    const urlParams = new URLSearchParams(window.location.search);
    let urlFilialParam = urlParams.get('filial');
    let urlDataParam = urlParams.get('data');

    function formatarDataBR(dataSql) {
        if (!dataSql) return '';
        const [ano, mes, dia] = dataSql.split('-'); 
        return `${dia}/${mes}/${ano}`;
    }

    function encontrarIndiceLoja(select, termo) {
        if (!select || !termo) return -1;
        const termoLimpo = termo.trim().toLowerCase();
        const termoSemConviva = termoLimpo
            .replace(/^farm[áa]cias?\s+conviva\s+/i, '')
            .replace(/^conviva\s+/i, '')
            .trim();

        // 1. Match exato
        for (let i = 0; i < select.options.length; i++) {
            const val = (select.options[i].value || '').trim().toLowerCase();
            const txt = (select.options[i].text || '').trim().toLowerCase();
            if (val === termoLimpo || txt === termoLimpo) return i;
        }

        // 2. Match por cidade/unidade (ex: "Acopiara")
        if (termoSemConviva) {
            for (let i = 0; i < select.options.length; i++) {
                const val = (select.options[i].value || '').trim().toLowerCase();
                const txt = (select.options[i].text || '').trim().toLowerCase();
                if (val.includes(termoSemConviva) || txt.includes(termoSemConviva)) return i;
            }
        }

        return -1;
    }

    // ==========================================
    // CARREGAR ESTRUTURA DE FILTROS
    // ==========================================
    async function carregarFiltros() {
        const { data, error } = await supabase
            .from('dados_lojas')
            .select('filial, rede, data_inicio, data_final')
            .order('data_final', { ascending: false })
            .limit(5000);

        if (error) {
            console.error('Erro ao carregar os dados:', error);
            return;
        }

        const filiaisUnicas = new Set();
        const semanasUnicas = new Map();
        const redesUnicas = new Set();
        const mapeamentoFilialRedeLocal = {};
        const mesesUnicos = new Map();
        const semanasPorMes = {};

        const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

        data.forEach(linha => {
            filiaisUnicas.add(linha.filial); 
            if (linha.rede) {
                redesUnicas.add(linha.rede);
                if (!mapeamentoFilialRedeLocal[linha.filial]) {
                    mapeamentoFilialRedeLocal[linha.filial] = linha.rede;
                }
            }
            
            const valorEscondido = `${linha.data_inicio}|${linha.data_final}`;
            const dataInicioBR = formatarDataBR(linha.data_inicio);
            const dataFinalBR = formatarDataBR(linha.data_final);
            const textoVisivel = `${dataInicioBR} até ${dataFinalBR}`;
            
            semanasUnicas.set(valorEscondido, textoVisivel);

            if (linha.data_final) {
                const [ano, mesStr] = linha.data_final.split('-');
                const chaveMes = `${ano}-${mesStr}`;
                const nomeMes = `${mesesNomes[parseInt(mesStr, 10) - 1]}/${ano}`;
                
                mesesUnicos.set(chaveMes, nomeMes);

                if (!semanasPorMes[chaveMes]) {
                    semanasPorMes[chaveMes] = [];
                }
                if (!semanasPorMes[chaveMes].some(s => s.chave === valorEscondido)) {
                    semanasPorMes[chaveMes].push({ chave: valorEscondido, texto: textoVisivel });
                }
            }
        });

        todasFiliais = Array.from(filiaisUnicas).sort(); 
        filialParaRede = mapeamentoFilialRedeLocal;
        
        // Popula as Redes
        if (redeSelect) {
            redeSelect.innerHTML = '<option value="">Todas</option>';
            Array.from(redesUnicas).sort().forEach(rede => {
                const option = document.createElement('option');
                option.value = rede;
                option.textContent = rede;
                redeSelect.appendChild(option);
            });
        }

        // Popula as filiais inicialmente
        if (lojaSelect) {
            lojaSelect.innerHTML = '<option value=""></option>'; 
            todasFiliais.forEach(filial => {
                const option = document.createElement('option');
                option.value = filial;
                option.textContent = filial; 
                lojaSelect.appendChild(option);
            });
        }

        // Popula os Meses
        if (mesSelect) {
            mesSelect.innerHTML = '<option value="">Todos</option>';
            const chavesMesesOrdenadas = Array.from(mesesUnicos.keys()).sort();
            chavesMesesOrdenadas.forEach(chave => {
                const option = document.createElement('option');
                option.value = chave;
                option.textContent = mesesUnicos.get(chave);
                mesSelect.appendChild(option);
            });
        }

        // Atualizar dropdown de semanas
        function atualizarDropdownSemanas() {
            if (!periodoSelect) return;

            const mesEscolhido = mesSelect ? mesSelect.value : '';
            periodoSelect.innerHTML = '';

            if (mesEscolhido) {
                const semanasDoMes = semanasPorMes[mesEscolhido] || [];
                semanasDoMes.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.chave;
                    option.textContent = item.texto;
                    periodoSelect.appendChild(option);
                });
            } else {
                const chavesSemanas = Array.from(semanasUnicas.keys()).sort().reverse();
                chavesSemanas.forEach(chave => {
                    const option = document.createElement('option');
                    option.value = chave; 
                    option.textContent = semanasUnicas.get(chave); 
                    periodoSelect.appendChild(option);
                });
            }

            // Se veio data via URL, seleciona a semana exata da demanda
            if (urlDataParam && periodoSelect.options.length > 0) {
                let semanaEncontrada = false;
                for (let i = 0; i < periodoSelect.options.length; i++) {
                    const val = periodoSelect.options[i].value;
                    if (val && val.includes('|')) {
                        const [dInicio, dFinal] = val.split('|');
                        if (dInicio <= urlDataParam && urlDataParam <= dFinal) {
                            periodoSelect.selectedIndex = i;
                            semanaEncontrada = true;
                            break;
                        }
                    }
                }
                if (!semanaEncontrada && periodoSelect.options.length > 0) {
                    periodoSelect.selectedIndex = 0;
                }
            } else if (periodoSelect.options.length > 0) {
                periodoSelect.selectedIndex = 0;
            }
        }

        if (mesSelect) {
            mesSelect.addEventListener('change', async () => {
                atualizarDropdownSemanas();
                await atualizarFiltroFiliais();
            });
        }

        // Popula inicialmente as semanas
        atualizarDropdownSemanas();

        // Popula e filtra filiais de forma assíncrona garantida
        await atualizarFiltroFiliais(urlFilialParam);
    }

    // ==========================================
    // NOVA INTELIGÊNCIA: FILTRO EM CASCATA DE FILIAIS
    // ==========================================
    async function atualizarFiltroFiliais(filialPreSelecionar = null) {
        if (!lojaSelect) return;

        const semanaEscolhida = periodoSelect ? periodoSelect.value : '';
        const statusEscolhido = statusSelect ? statusSelect.value : '';
        const redeEscolhida = redeSelect ? redeSelect.value : '';

        lojaSelect.innerHTML = '<option value="">Carregando...</option>';

        if (!semanaEscolhida) {
            lojaSelect.innerHTML = '<option value=""></option>';
            todasFiliais.forEach(filial => {
                if (redeEscolhida && filialParaRede[filial] !== redeEscolhida) {
                    return;
                }
                const option = document.createElement('option');
                option.value = filial;
                option.textContent = filial;
                lojaSelect.appendChild(option);
            });

            tratarSelecaoFilial(filialPreSelecionar);
            return;
        }

        const [dataInicio] = semanaEscolhida.split('|');

        const { data, error } = await supabase
            .from('tabela_completa')
            .select('filial, status')
            .eq('data_inicio', dataInicio)
            .not('status', 'is', null)
            .neq('status', '')
            .order('data_final', { ascending: false })
            .limit(1000);

        if (error) {
            console.error("Erro ao puxar filiais por status:", error);
            lojaSelect.innerHTML = '<option value="">Erro ao carregar</option>';
            return;
        }

        let filiaisFiltradas = data || [];
        if (statusEscolhido) {
            filiaisFiltradas = filiaisFiltradas.filter(linha => {
                const s = (linha.status || '').toLowerCase();
                if (statusEscolhido === 'critico') return s.includes('crítico') || s.includes('critico');
                if (statusEscolhido === 'medio') return s.includes('médio') || s.includes('medio');
                if (statusEscolhido === 'baixo') return s.includes('baixo');
                return true;
            });
        }

        let filiaisUnicasFiltradas = Array.from(new Set(filiaisFiltradas.map(f => f.filial)));

        if (redeEscolhida) {
            filiaisUnicasFiltradas = filiaisUnicasFiltradas.filter(filial => filialParaRede[filial] === redeEscolhida);
        }

        // Se veio uma filial por parâmetro (deep link), garante que ela esteja na lista se ainda não estiver
        const alvoFilial = filialPreSelecionar || urlFilialParam;
        if (alvoFilial) {
            const jaTem = filiaisUnicasFiltradas.some(f => f.toLowerCase().includes(alvoFilial.toLowerCase()) || alvoFilial.toLowerCase().includes(f.toLowerCase()));
            if (!jaTem) {
                const filialOriginal = todasFiliais.find(f => f.toLowerCase().includes(alvoFilial.toLowerCase()) || alvoFilial.toLowerCase().includes(f.toLowerCase()));
                if (filialOriginal) {
                    filiaisUnicasFiltradas.push(filialOriginal);
                }
            }
        }

        filiaisUnicasFiltradas.sort();

        lojaSelect.innerHTML = '<option value=""></option>';
        if (filiaisUnicasFiltradas.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "Nenhuma loja encontrada";
            lojaSelect.appendChild(option);
        } else {
            filiaisUnicasFiltradas.forEach(filial => {
                const option = document.createElement('option');
                option.value = filial;
                option.textContent = filial;
                lojaSelect.appendChild(option);
            });
        }

        tratarSelecaoFilial(filialPreSelecionar);
    }

    function tratarSelecaoFilial(filialAlvo) {
        const termo = filialAlvo || urlFilialParam;
        if (!termo || !lojaSelect) return;

        const idx = encontrarIndiceLoja(lojaSelect, termo);
        if (idx >= 0) {
            lojaSelect.selectedIndex = idx;

            const filialEscolhida = lojaSelect.value;
            const semanaEscolhida = periodoSelect ? periodoSelect.value : '';

            if (filialEscolhida && semanaEscolhida) {
                filtroObserver.notificar({
                    filial: filialEscolhida,
                    periodo: semanaEscolhida,
                    status: statusSelect ? statusSelect.value : ''
                });
            }
        }
    }

    if (periodoSelect) periodoSelect.addEventListener('change', () => atualizarFiltroFiliais());
    if (statusSelect) statusSelect.addEventListener('change', () => atualizarFiltroFiliais());
    if (redeSelect) redeSelect.addEventListener('change', () => atualizarFiltroFiliais());

    // ==========================================
    // FUNÇÃO UNIFICADA: NOTA E MÉDIA DO ENCARTE
    // ==========================================
    async function carregarDadosChecklistEncarte(supabase, lojaSelecionada) {
        const celulaNota = document.getElementById('dado-checklist-encarte');
        const celulaMedia = document.getElementById('media-checklist-encarte');
        
        if (!celulaNota || !celulaMedia) return; 
        
        celulaNota.textContent = '...';
        celulaMedia.textContent = '...';
        celulaMedia.removeAttribute('style');

        try {
            const { data: dataRecente, error: erroData } = await supabase
                .from('checklist_encarte')
                .select('data')
                .order('data', { ascending: false })
                .limit(1);

            if (erroData || !dataRecente || dataRecente.length === 0) {
                celulaNota.textContent = '-';
                celulaMedia.textContent = '-';
                return;
            }

            const dataMaisNova = dataRecente[0].data;

            const { data: notas, error: erroNotas } = await supabase
                .from('checklist_encarte')
                .select('unidade, resultado')
                .eq('data', dataMaisNova)
                .order('data', { ascending: false })
                .limit(1000);

            if (erroNotas || !notas || notas.length === 0) {
                celulaNota.textContent = '-';
                celulaMedia.textContent = '-';
                return;
            }

            const notesValidas = notas.map(n => parseFloat(n.resultado)).filter(n => !isNaN(n));
            let mediaRede = null;
            
            if (notesValidas.length > 0) {
                const soma = notesValidas.reduce((acc, nota) => acc + nota, 0);
                mediaRede = soma / notesValidas.length;
                celulaMedia.textContent = `${mediaRede.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}%`;
            } else {
                celulaMedia.textContent = '-';
            }

            const dadoLoja = notas.find(n => n.unidade === lojaSelecionada);
            
            if (dadoLoja && dadoLoja.resultado !== null) {
                const notaLoja = parseFloat(dadoLoja.resultado);
                celulaNota.textContent = `${notaLoja.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}%`;
                
                if (mediaRede !== null) {
                    if (notaLoja >= mediaRede) {
                        celulaNota.style.color = '#16a34a'; 
                    } else {
                        celulaNota.style.color = '#dc2626'; 
                    }
                } else {
                    celulaNota.style.color = '#0f172a';
                }
                
                celulaNota.style.fontWeight = '700'; 
            } else {
                celulaNota.textContent = '-';
                celulaMedia.textContent = '-';
                celulaNota.style.color = '#0f172a';
            }

        } catch (error) {
            console.error("Erro ao processar encarte:", error);
            celulaNota.textContent = 'Erro';
            celulaMedia.textContent = 'Erro';
        }
    }

    // ==========================================
    // CLIQUE NO BOTÃO FILTRAR (AVISA OBSERVER)
    // ==========================================
    if (btnFiltrar) {
        btnFiltrar.addEventListener('click', () => {
            const filialEscolhida = lojaSelect.value;
            const semanaEscolhida = periodoSelect.value;

            if (!filialEscolhida || !semanaEscolhida) {
                alert('Por favor, selecione uma filial e um período.');
                return;
            }

            filtroObserver.notificar({
                filial: filialEscolhida,
                periodo: semanaEscolhida,
                status: statusSelect ? statusSelect.value : ''
            });
        });
    }

    // ==========================================
    // INSCREVE A ATUALIZAÇÃO LOCAL DE FILTROS
    // ==========================================
    filtroObserver.inscrever(async (dados) => {
        const filialEscolhida = dados.filial;

        try {
            await carregarDadosChecklistEncarte(supabase, filialEscolhida);

            const tbodyMedia = document.querySelector('.tabela-larga table tbody');
            if (tbodyMedia) {
                const linhaAntiga = tbodyMedia.querySelector('.linha-meta-injetada');
                if (linhaAntiga) linhaAntiga.remove();

                const trMeta = document.createElement('tr');
                trMeta.className = 'linha-meta-injetada'; 
                trMeta.innerHTML = `
                    <td class="coluna-fixa" style="font-weight: 700; color: #0f172a;">Meta Ideal</td>
                    <td style="font-weight: 700;">-</td>
                    <td style="font-weight: 700;">-</td>
                    <td style="font-weight: 700;">3</td>
                    <td style="font-weight: 700;">&gt; 60%</td>
                    <td style="font-weight: 700;">&gt; R$ 50,00</td>
                    <td style="font-weight: 700;">60% A 65%</td>
                    <td style="font-weight: 700;">25% A 30%</td>
                    <td style="font-weight: 700;">45 a 60</td>
                    <td style="font-weight: 700;">&lt; 20</td>
                    <td style="font-weight: 700;">&lt; 9%</td>
                `;
                tbodyMedia.appendChild(trMeta);
            }

        } catch (error) {
            console.error('Erro ao processar atualização local do filtro:', error);
        }
    });

    await carregarFiltros();
}