const chaves = document.getElementById("chaves");
const barril = document.getElementById("barril");
const sanduiche = document.getElementById("sanduiche");
const gameover = document.getElementById("gameover");
const pipa = document.getElementById("pipa");
const tela = document.getElementById("tela");
const trilha = document.getElementById("trilha");

let pontuacao = 0;
let jogoAtivo = false;           // só vira true quando o jogador clica em INICIAR
let posicaoChaves = 30;
let sanduicheDisponivel = false;   // true só enquanto há um sanduíche na tela pronto pra ser pego
let sanduicheEmCena = false;       // true do lançamento até ele sair da tela ou ser pego
let segundos = 0;

// ===== Pontos =====
const PONTOS_POR_BARRIL = 2;   // cada barril pulado soma 2 pontos
let pontos = 0;
let barrilContado = false;     // evita contar o mesmo barril duas vezes

// ===== Dificuldade por fase: 5 minutos, 1 minuto por fase =====
// O fator de velocidade multiplica o tempo que o barril leva pra cruzar a tela
// (1 = começo, quanto menor, mais rápido). Dentro de cada minuto a velocidade sobe
// aos poucos até o valor "fatorFinal" da fase, sem tranco na virada.
const DURACAO_BARRIL_INICIAL = 3.5;     // segundos pra cruzar a tela no começo
const DURACAO_FASE = 60;                // segundos de cada fase
const FASES = [
    { nome: "Tranquilo",  fatorFinal: 0.85 },   // 3,5s -> ~3,0s pra cruzar a tela
    { nome: "Esquentando", fatorFinal: 0.68 },  // -> ~2,4s
    { nome: "Difícil",    fatorFinal: 0.52 },   // -> ~1,8s
    { nome: "Complicado", fatorFinal: 0.38 },   // -> ~1,3s
    { nome: "Impossível", fatorFinal: 0.22 }    // -> ~0,8s
];
const TEMPO_TOTAL = DURACAO_FASE * FASES.length;   // 300s = 5 minutos

let fatorVelocidade = 1;

function indiceDaFase(seg) {
    return Math.min(Math.floor(seg / DURACAO_FASE), FASES.length - 1);
}

function fatorPeloTempo(seg) {
    const s = Math.min(seg, TEMPO_TOTAL);
    const i = indiceDaFase(s);
    const fatorInicial = (i === 0) ? 1 : FASES[i - 1].fatorFinal;
    const progresso = (s - i * DURACAO_FASE) / DURACAO_FASE;
    return fatorInicial + (FASES[i].fatorFinal - fatorInicial) * progresso;
}

function aplicarVelocidade(elemento, duracaoInicial) {
    elemento.style.setProperty("--duracao", (duracaoInicial * fatorVelocidade).toFixed(3) + "s");
}

// Trocar a duração no meio da animação faz o CSS recalcular o progresso e o
// elemento "teleporta" pro meio da tela. Por isso, junto com a nova duração,
// reiniciamos a animação do zero: ela sempre começa na ponta direita da tela.
function reiniciarComNovaVelocidade(elemento, duracaoInicial, atrasoSegundos) {
    aplicarVelocidade(elemento, duracaoInicial);
    elemento.style.setProperty("--atraso", (atrasoSegundos || 0).toFixed(3) + "s");
    elemento.style.animation = "none";
    void elemento.offsetWidth;
    elemento.style.animation = "";
}

// O barril só muda de velocidade quando completa a volta (está fora da tela),
// assim não dá "tranco" na animação.
barril.addEventListener("animationiteration", function() {
    if (!jogoAtivo) return;

    fatorVelocidade = fatorPeloTempo(segundos);

    barrilContado = false;

    // O próximo barril espera um intervalo fora da tela antes de entrar
    const duracao = DURACAO_BARRIL_INICIAL * fatorVelocidade;
    const atraso = intervaloAteProximoBarril;
    intervaloAteProximoBarril = amostrarIntervalo(duracao);

    reiniciarComNovaVelocidade(barril, DURACAO_BARRIL_INICIAL, atraso);
    agendarSanduiche(duracao, atraso, intervaloAteProximoBarril);
});

const botaoReiniciar = document.createElement("button");
botaoReiniciar.id = "botaoReiniciar";
botaoReiniciar.innerText = "REINICIAR JOGO";
tela.appendChild(botaoReiniciar);

botaoReiniciar.addEventListener("click", function() {
    window.location.reload();
});

const placar = document.createElement("div");
placar.innerText = "Sanduíches: 0";
placar.className = "hud";
placar.style.top = "15px";
placar.style.left = "15px";
tela.appendChild(placar);

const placarPontos = document.createElement("div");
placarPontos.innerText = "Pontos: 0";
placarPontos.className = "hud";
placarPontos.style.top = "68px";
placarPontos.style.left = "15px";
tela.appendChild(placarPontos);

const cronometro = document.createElement("div");
cronometro.innerText = "Tempo: " + formatarTempo(TEMPO_TOTAL);
cronometro.className = "hud";
cronometro.style.top = "15px";
cronometro.style.right = "15px";
tela.appendChild(cronometro);

const indicadorFase = document.createElement("div");
indicadorFase.className = "hud";
indicadorFase.style.top = "68px";
indicadorFase.style.right = "15px";
tela.appendChild(indicadorFase);

const mensagemFinal = document.createElement("div");
mensagemFinal.className = "hud";
mensagemFinal.style.left = "50%";
mensagemFinal.style.top = "58%";
mensagemFinal.style.transform = "translate(-50%, -50%)";
mensagemFinal.style.display = "none";
mensagemFinal.style.zIndex = "12";
mensagemFinal.style.whiteSpace = "nowrap";
tela.appendChild(mensagemFinal);

function formatarTempo(seg) {
    const minutos = Math.floor(seg / 60);
    const resto = seg % 60;

    return String(minutos).padStart(2, "0") + ":" + String(resto).padStart(2, "0");
}

function atualizarIndicadorFase() {
    const i = indiceDaFase(segundos);
    indicadorFase.innerText = "Fase " + (i + 1) + "/" + FASES.length + " - " + FASES[i].nome;
}

atualizarIndicadorFase();

// Contagem regressiva: quando chega em 0, o jogo termina
const intervaloCronometro = setInterval(function() {
    if (!jogoAtivo) return;

    segundos++;

    const restante = TEMPO_TOTAL - segundos;
    cronometro.innerText = "Tempo: " + formatarTempo(Math.max(restante, 0));
    atualizarIndicadorFase();

    if (restante <= 0) {
        acabouOTempo();
    }
}, 1000);

// ===== Altura aleatória do sanduíche =====
// A cada volta o sanduíche aparece numa altura diferente:
// baixo dá pra pegar andando; os mais altos exigem pular.
const ALTURA_MIN_SANDUICHE = 30;       // px acima do chão
const ALTURA_MAX_SANDUICHE = 360;      // px acima do chão (o pulo chega a 320px)
const DIFERENCA_MINIMA_ALTURA = 90;    // evita repetir quase a mesma altura da última vez
let ultimaAlturaSanduiche = 180;

function sortearAlturaSanduiche() {
    let altura;

    do {
        altura = ALTURA_MIN_SANDUICHE + Math.random() * (ALTURA_MAX_SANDUICHE - ALTURA_MIN_SANDUICHE);
    } while (Math.abs(altura - ultimaAlturaSanduiche) < DIFERENCA_MINIMA_ALTURA);

    ultimaAlturaSanduiche = altura;
    sanduiche.style.bottom = Math.round(altura) + "px";
}

// ===== Intervalo entre barris e sanduíche no meio =====
// Depois que um barril sai da tela, o próximo espera um intervalo antes de entrar.
// O intervalo cresce quando o jogo está rápido, pra sempre sobrar tempo de:
//   pular o barril -> pegar o sanduíche (mesmo o alto) -> pular o próximo barril.
// O sanduíche viaja na mesma velocidade do barril, então esses tempos valem
// também no lugar onde o Chaves está.
const INTERVALO_MIN = 0.5;        // segundos de pausa mínima entre barris
const INTERVALO_VARIACAO = 0.6;   // soma um valor aleatório de 0 a 0.6s (o ritmo não fica previsível)
const FOLGA_REACAO = 0.15;        // folga extra (s) além da duração do pulo

let intervaloAteProximoBarril = 0;

// Tempo mínimo (s) entre dois pulos seguidos: duração do pulo + folga
function tempoMinimoEntrePulos() {
    return duracaoDoPulo() / 1000 + FOLGA_REACAO;
}

function amostrarIntervalo(duracaoBarril) {
    // barril + intervalo precisam caber 2 pulos (um pro sanduíche, outro pro barril seguinte)
    const minimo = Math.max(INTERVALO_MIN, 2 * tempoMinimoEntrePulos() - duracaoBarril);
    return minimo + Math.random() * INTERVALO_VARIACAO;
}

// Sorteia o momento do sanduíche entre dois barris, sempre com tempo de sobra dos dois lados
function agendarSanduiche(duracaoBarril, atrasoAteBarril, intervaloDepois) {
    const m = tempoMinimoEntrePulos();
    const periodo = duracaoBarril + intervaloDepois;           // de um barril entrar até o seguinte entrar
    const deslocamento = m + Math.random() * (periodo - 2 * m); // depois do barril, antes do próximo

    setTimeout(function() {
        if (!jogoAtivo) return;
        lancarSanduiche(duracaoBarril);
    }, (atrasoAteBarril + deslocamento) * 1000);
}

function lancarSanduiche(duracao) {
    if (sanduicheEmCena) return;

    sanduicheEmCena = true;
    sanduicheDisponivel = true;

    sanduiche.classList.remove("voando");
    void sanduiche.offsetWidth;

    sanduiche.style.setProperty("--duracao", duracao.toFixed(3) + "s");   // mesma velocidade do barril
    sortearAlturaSanduiche();

    sanduiche.style.display = "block";
    sanduiche.classList.add("voando");
}

function guardarSanduiche() {
    sanduicheEmCena = false;
    sanduicheDisponivel = false;
    sanduiche.classList.remove("voando");
    sanduiche.style.display = "none";
}

// Saiu pela esquerda sem ser pego
sanduiche.addEventListener("animationend", function(event) {
    if (event.animationName === "movimentoSanduiche") {
        guardarSanduiche();
    }
});

// ===== Pulo =====
// O pulo é mais curto que antes e encurta ainda mais conforme o jogo acelera
// (1300ms no começo -> ~850ms na velocidade máxima).
const BUFFER_PULO_MS = 200;   // se apertar espaço até 200ms antes de pousar, o pulo sai assim que tocar no chão
let pedidoPuloEm = -Infinity;

function duracaoDoPulo() {
    return 550 + 750 * fatorVelocidade;
}

function pular() {
    if (!jogoAtivo) return;

    // Ainda no ar: guarda o pedido e pula assim que pousar
    if (chaves.classList.contains("pulo")) {
        pedidoPuloEm = performance.now();
        return;
    }

    chaves.style.setProperty("--duracao-pulo", Math.round(duracaoDoPulo()) + "ms");
    chaves.classList.add("pulo");
}

chaves.addEventListener("animationend", function(event) {
    if (event.animationName === "pular") {
        chaves.classList.remove("pulo");

        if (jogoAtivo && performance.now() - pedidoPuloEm <= BUFFER_PULO_MS) {
            pedidoPuloEm = -Infinity;
            void chaves.offsetWidth;
            pular();
        }
    }
});

document.addEventListener("keydown", function(event) {
    if (!jogoAtivo) return;

    if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        pular();
    }

    if (event.code === "ArrowRight") {
        event.preventDefault();
        posicaoChaves += 24;

        if (posicaoChaves > tela.clientWidth - chaves.offsetWidth) {
            posicaoChaves = tela.clientWidth - chaves.offsetWidth;
        }

        chaves.style.left = posicaoChaves + "px";
    }

    if (event.code === "ArrowLeft") {
        event.preventDefault();
        posicaoChaves -= 24;

        if (posicaoChaves < 0) {
            posicaoChaves = 0;
        }

        chaves.style.left = posicaoChaves + "px";
    }
});

// ===== Contato real (colisão pelo desenho, não pela caixa da imagem) =====
// As imagens têm bordas transparentes, então a caixa da imagem é maior que o desenho.
// Cada forma abaixo é o contorno real do desenho, em faixas horizontais, com valores
// de 0 a 1 em relação ao tamanho da imagem: [esquerda, topo, direita, base].
// Foram medidas a partir dos pixels visíveis dos arquivos em /imagens.
// Se trocar alguma imagem, as formas precisam ser medidas de novo.

const FORMA_BARRIL = [
    [0.389, 0.077, 0.625, 0.083],
    [0.174, 0.083, 0.826, 0.166],
    [0.14, 0.166, 0.862, 0.249],
    [0.119, 0.249, 0.884, 0.333],
    [0.105, 0.333, 0.896, 0.416],
    [0.099, 0.416, 0.901, 0.5],
    [0.099, 0.5, 0.901, 0.583],
    [0.104, 0.583, 0.894, 0.667],
    [0.115, 0.667, 0.884, 0.75],
    [0.141, 0.75, 0.855, 0.833],
    [0.173, 0.833, 0.822, 0.916],
    [0.359, 0.916, 0.631, 0.925]
];

// Chaves: média dos 16 quadros do GIF (braços e pernas balançam na corrida)
const FORMA_CHAVES = [
    [0.458, 0.031, 0.607, 0.059],
    [0.414, 0.059, 0.641, 0.122],
    [0.406, 0.122, 0.707, 0.185],
    [0.38, 0.185, 0.715, 0.248],
    [0.353, 0.248, 0.678, 0.311],
    [0.364, 0.311, 0.66, 0.374],
    [0.343, 0.374, 0.66, 0.437],
    [0.301, 0.437, 0.654, 0.5],
    [0.277, 0.5, 0.662, 0.559],
    [0.267, 0.559, 0.662, 0.622],
    [0.28, 0.622, 0.628, 0.685],
    [0.277, 0.685, 0.66, 0.748],
    [0.27, 0.748, 0.636, 0.811],
    [0.272, 0.811, 0.636, 0.874],
    [0.322, 0.874, 0.613, 0.937],
    [0.343, 0.937, 0.576, 0.965]
];

const FORMA_SANDUICHE = [
    [0.352, 0.08, 0.613, 0.125],
    [0.168, 0.125, 0.864, 0.25],
    [0.118, 0.25, 0.888, 0.375],
    [0.106, 0.375, 0.9, 0.5],
    [0.111, 0.5, 0.896, 0.625],
    [0.11, 0.625, 0.887, 0.75],
    [0.137, 0.75, 0.873, 0.875],
    [0.42, 0.875, 0.655, 0.926]
];

// Folga de cada lado: o contato só conta se os desenhos se sobrepõem de verdade
// (ignora o pixel que só "raspa" na borda).
const TOLERANCIA_PX = 4;

function faixasNaTela(elemento, forma) {
    const r = elemento.getBoundingClientRect();
    const faixas = [];

    for (const f of forma) {
        const faixa = {
            left:   r.left + f[0] * r.width + TOLERANCIA_PX,
            top:    r.top  + f[1] * r.height + TOLERANCIA_PX,
            right:  r.left + f[2] * r.width - TOLERANCIA_PX,
            bottom: r.top  + f[3] * r.height - TOLERANCIA_PX
        };

        if (faixa.right > faixa.left && faixa.bottom > faixa.top) {
            faixas.push(faixa);
        }
    }

    return faixas;
}

function bordaEsquerdaVisivel(elemento, forma) {
    const r = elemento.getBoundingClientRect();
    return r.left + Math.min(...forma.map(f => f[0])) * r.width;
}

function bordaDireitaVisivel(elemento, forma) {
    const r = elemento.getBoundingClientRect();
    return r.left + Math.max(...forma.map(f => f[2])) * r.width;
}

function verificarColisao(elementoA, formaA, elementoB, formaB) {
    const faixasA = faixasNaTela(elementoA, formaA);
    const faixasB = faixasNaTela(elementoB, formaB);

    for (const a of faixasA) {
        for (const b of faixasB) {
            if (a.right > b.left && a.left < b.right &&
                a.bottom > b.top && a.top < b.bottom) {
                return true;
            }
        }
    }

    return false;
}

function acabouOTempo() {
    if (!jogoAtivo) return;

    jogoAtivo = false;

    clearInterval(intervaloCronometro);

    pipa.style.animationPlayState = "paused";

    barril.style.setProperty("display", "none", "important");
    sanduiche.style.display = "none";

    chaves.classList.remove("pulo");

    cronometro.innerText = "Tempo: 00:00";
    mensagemFinal.innerText = "Tempo esgotado! " + pontos + " pontos e " + pontuacao + " sanduíches";
    mensagemFinal.style.display = "block";

    gameover.style.display = "block";
    gameover.style.visibility = "visible";

    botaoReiniciar.style.display = "block";
}

function perderJogo() {
    if (!jogoAtivo) return;

    jogoAtivo = false;

    clearInterval(intervaloCronometro);

    const posicaoBarril = barril.getBoundingClientRect();
    const posicaoTela = tela.getBoundingClientRect();

    pipa.style.animationPlayState = "paused";

    barril.style.setProperty("display", "none", "important");
    sanduiche.style.display = "none";

    chaves.classList.remove("pulo");
    chaves.src = "imagens/perdeu.png";

    chaves.style.animation = "none";
    chaves.style.setProperty("width", "300px", "important");
    chaves.style.height = "auto";

    chaves.style.left =
        (posicaoBarril.left - posicaoTela.left +
        (posicaoBarril.width - 300) / 2) + "px";

    chaves.style.top =
        (posicaoBarril.top - posicaoTela.top - 180) + "px";

    chaves.style.bottom = "auto";
    chaves.style.zIndex = "6";
    chaves.style.display = "block";

    gameover.style.display = "block";
    gameover.style.visibility = "visible";

    botaoReiniciar.style.display = "block";
}

setInterval(function() {
    if (!jogoAtivo) return;

    if (verificarColisao(chaves, FORMA_CHAVES, barril, FORMA_BARRIL)) {
        perderJogo();
        return;
    }

    // Barril pulado: o barril inteiro já passou pelo Chaves sem encostar
    if (!barrilContado &&
        bordaDireitaVisivel(barril, FORMA_BARRIL) < bordaEsquerdaVisivel(chaves, FORMA_CHAVES)) {
        barrilContado = true;
        pontos += PONTOS_POR_BARRIL;
        placarPontos.innerText = "Pontos: " + pontos;
    }

    if (sanduicheDisponivel) {
        if (verificarColisao(chaves, FORMA_CHAVES, sanduiche, FORMA_SANDUICHE)) {
            pontuacao++;
            placar.innerText = "Sanduíches: " + pontuacao;

            guardarSanduiche();
        }
    }
}, 20);


// ===== Tela inicial =====
// O jogo só começa quando o jogador clica em INICIAR (ou aperta Espaço/Enter).
const telaInicial = document.getElementById("inicio");
const botaoIniciar = document.getElementById("botaoIniciar");

function iniciarJogo() {
    if (jogoAtivo || !tela.classList.contains("aguardando")) return;

    jogoAtivo = true;
    tela.classList.remove("aguardando");

    // Trilha sonora: começa aqui porque o navegador só deixa tocar áudio depois de um clique/tecla
    trilha.volume = 0.5;
    trilha.currentTime = 0;
    trilha.play().catch(function() {});

    // Some com a tela inicial com um fade e depois remove do HTML
    telaInicial.classList.add("saindo");
    setTimeout(function() {
        telaInicial.remove();
    }, 400);

    // Primeiro ciclo: o primeiro barril começa a correr agora
    intervaloAteProximoBarril = amostrarIntervalo(DURACAO_BARRIL_INICIAL);
    reiniciarComNovaVelocidade(barril, DURACAO_BARRIL_INICIAL, 0);
    agendarSanduiche(DURACAO_BARRIL_INICIAL, 0, intervaloAteProximoBarril);
}

botaoIniciar.addEventListener("click", iniciarJogo);

document.addEventListener("keydown", function(event) {
    if (!tela.classList.contains("aguardando")) return;

    if (event.code === "Space" || event.code === "Enter") {
        event.preventDefault();
        if (!event.repeat) iniciarJogo();
    }
});

// ===== Mutar a música =====
// A música toca do início do jogo até o Game Over. O botão (ou a tecla M) liga e desliga o som.
const botaoMusica = document.getElementById("botaoMusica");

function atualizarBotaoMusica() {
    botaoMusica.innerText = (trilha.muted ? "🔇" : "🔊") + " Música (M)";
}

function alternarMusica() {
    trilha.muted = !trilha.muted;
    atualizarBotaoMusica();
}

botaoMusica.addEventListener("click", function() {
    alternarMusica();
    botaoMusica.blur();   // senão o Espaço (pulo) "apertaria" o botão de novo
});

document.addEventListener("keydown", function(event) {
    if (event.code === "KeyM" && !event.repeat) {
        alternarMusica();
    }
});
