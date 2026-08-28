
// js/login.js

import { supabase } from './servicos/supabaseClient.js';



// ==========================================
// DAQUI PARA BAIXO O SEU CÓDIGO CONTINUA IGUAL...
// ==========================================
const formLogin = document.getElementById('form-login');
const btnEntrar = document.getElementById('btn-entrar');
const divErro = document.getElementById('mensagem-erro');

formLogin.addEventListener('submit', async (evento) => {
    evento.preventDefault(); 
    
    btnEntrar.textContent = 'Validando...';
    btnEntrar.disabled = true;
    divErro.style.display = 'none';

    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: senha,
    });

    if (error) {
        divErro.textContent = 'E-mail ou senha incorretos. Tente novamente.';
        divErro.style.display = 'block';
        btnEntrar.textContent = 'Entrar no Dashboard';
        btnEntrar.disabled = false;
    } else {
        // ==========================================
        // AJUSTE FEITO AQUI: 
        // Agora joga para a tela de escolha dos sistemas (balões)
        // ==========================================
        window.location.href = 'painel.html';
    }
});