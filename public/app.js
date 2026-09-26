/*
 * =====================================================================
 *  Agenda da Turma — app.js
 *  PARTE 4 de 4: a agenda no banco, membros, fotos e o site no ar
 * =====================================================================
 *  O que o site faz:
 *   - login com a conta Google (fica logado até clicar em "Sair da conta")
 *   - criar grupos com código e pedir pra entrar; admins aprovam
 *   - a agenda de cada grupo fica no banco: o que um admin marca aparece
 *     na hora pra todo mundo do grupo
 *   - admins tornam outras pessoas admin e tiram pessoas do grupo;
 *     qualquer um pode sair; admins podem apagar o grupo
 *   - cada pessoa pode trocar a própria foto, e admins trocam a foto do grupo
 *
 *  Tudo o que é novo desde a parte 3 está marcado com "(novo)".
 *
 *  Como este arquivo está organizado (leia de cima pra baixo):
 *   1. Firebase: imports e configuração
 *   2. Constantes e estado
 *   3. Funções de ajuda
 *   4. Login e conta
 *   5. Fotos: a sua e a do grupo (novo)
 *   6. Grupos: ouvir o banco, abrir e trocar
 *   7. Criar grupo e mostrar o código
 *   8. Entrar com código e pedidos enviados
 *   9. Admin: pedidos pra entrar
 *  10. Membros: admins, tirar do grupo, sair e apagar (novo)
 *  11. Calendário (agora com os itens do banco)
 *  12. O que tem no dia escolhido
 *  13. Adicionar e apagar itens (agora no banco)
 *  14. Ligar os botões e começar
 *
 *  Regra de ouro de segurança: texto que vem de fora (o que as pessoas
 *  digitam, nomes que vêm do banco...) SEMPRE entra na página como texto
 *  (textContent ou a função el), nunca com innerHTML. Assim ninguém
 *  consegue "injetar" código no site.
 *
 *  E a segunda regra de ouro: o que o site esconde na tela (por exemplo,
 *  o botão Adicionar pra quem não é admin) NÃO é proteção de verdade.
 *  Quem protege os dados é o arquivo firestore.rules, que roda no
 *  servidor do Google. O código daqui roda no navegador de cada um e
 *  qualquer pessoa pode mexer nele.
 * =====================================================================
 */

// ---------------------------------------------------------------------
// 1. Firebase: imports e configuração
// ---------------------------------------------------------------------
// O Firebase vem direto dos servidores do Google, por isso o endereço
// completo. Os imports usam a mesma versão (12.19.0); se um dia for
// atualizar, troque o número em todos eles.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs, // (novo) ler vários documentos de uma vez
  setDoc,
  addDoc, // (novo) criar documento com id automático
  updateDoc, // (novo) mudar só alguns campos
  deleteDoc,
  query,
  where,
  limit, // (novo)
  onSnapshot,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove, // (novo) tira um valor de uma lista
  deleteField, // (novo) apaga um campo
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// A configuração do seu projeto fica no firebase-config.js.
// Ele é carregado aqui, com import() dentro de um try, e não com um import
// lá em cima, por um motivo: se tiver algum erro de digitação nele, o site
// consegue avisar na tela em vez de ficar travado em "Carregando…".
let firebaseConfig = null;
try {
  const arquivo = await import("./firebase-config.js");
  firebaseConfig = arquivo.firebaseConfig;
} catch (erro) {
  console.error("Não consegui ler o firebase-config.js:", erro);
}

// Se tiver algum problema com a configuração, ele fica anotado aqui.
// Texto vazio quer dizer que está tudo certo.
let problemaNaConfiguracao = "";
if (!firebaseConfig) {
  problemaNaConfiguracao = "arquivo";
} else if (typeof firebaseConfig.apiKey !== "string" || firebaseConfig.apiKey.startsWith("COLE")) {
  problemaNaConfiguracao = "falta-colar";
}

const AVISOS_DE_CONFIGURACAO = {
  arquivo:
    "Não consegui ler o arquivo public/firebase-config.js. Veja se ele está na pasta public e se não sumiu nenhuma aspa, vírgula ou chave na hora de colar. O Console do navegador (F12) mostra onde está o erro.",
  "falta-colar":
    "Falta configurar o Firebase. Abra o arquivo public/firebase-config.js e cole a configuração do seu projeto. O passo a passo está no LEIAME.md.",
  valores:
    "A configuração do Firebase tem algum valor errado. Confira o que você colou em public/firebase-config.js.",
};

let auth = null;
let db = null;
if (!problemaNaConfiguracao) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app); // o login fica salvo no navegador até a pessoa clicar em "Sair da conta"
    db = getFirestore(app); // o banco de dados
  } catch (erro) {
    console.error(erro);
    problemaNaConfiguracao = "valores";
  }
}

// ---------------------------------------------------------------------
// 2. Constantes e estado
// ---------------------------------------------------------------------
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const DIAS_DA_SEMANA = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

// Tipos de item. A chave (prova, trabalho...) é o que fica guardado;
// o valor é o que aparece na tela.
const TIPOS = { prova: "Prova", trabalho: "Trabalho", tarefa: "Tarefa", outro: "Outro" };

// Ordem dentro de um dia: prova primeiro, porque é o que mais importa.
const ORDEM_DOS_TIPOS = ["prova", "trabalho", "tarefa", "outro"];

// Código do grupo: 6 caracteres, sem os que se confundem (0 e O, 1, I e L).
// As regras do banco (firestore.rules) conferem esse mesmo formato.
const ALFABETO_DO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const TAMANHO_DO_CODIGO = 6;

// Tamanho máximo de um grupo (as regras do banco conferem o mesmo número).
const MAXIMO_DE_MEMBROS = 150;

// (novo) Fotos escolhidas no site: o navegador corta num quadrado de
// 160 x 160 pixels e transforma num texto (JPEG em "base64"), que vai
// direto pro banco. Assim não precisa do Cloud Storage, que exige o
// plano pago do Firebase. As regras conferem o formato e o tamanho.
const TAMANHO_DA_FOTO = 160;
const LIMITE_DA_FOTO = 60000; // caracteres (a foto costuma ficar entre 8 e 20 mil)

// Só mostramos fotos que vêm do Google ou que foram feitas pelo próprio site.
const FOTO_DO_GOOGLE = /^https:\/\/[a-z0-9]+\.googleusercontent\.com\//;
const FOTO_DO_SITE = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/; // (novo)

const hojeAoAbrir = lerISO(hojeISO());

// Tudo o que o site "sabe" agora fica neste objeto.
const estado = {
  usuario: null, // a conta logada (vem do Firebase), ou null se não tem ninguém
  minhaFoto: "", // (novo) a foto que a pessoa escolheu no site ("" = usa a do Google)
  grupos: [], // os grupos em que a pessoa é membro (vêm do banco)
  grupoAtualId: null, // o grupo aberto na tela
  mesVisivel: { ano: hojeAoAbrir.ano, mes: hojeAoAbrir.mes }, // mes vai de 0 (jan) a 11 (dez)!
  diaSelecionado: hojeISO(),
  itensDoMes: [], // os itens do mês que está na tela (vêm do banco)
  itensDoMesChave: null, // (novo) de qual grupo e mês são esses itens
  pedidosDoGrupo: [], // pedidos esperando aprovação (só admins recebem)
  pedidosDoGrupoId: null, // de qual grupo são esses pedidos
  grupoEmEspera: null, // grupo achado pelo código, antes de pedir pra entrar
  codigoMostrado: null, // grupo cujo código está aberto na janela
  abrirQuandoChegar: null, // grupo recém-criado pra abrir assim que chegar do banco
  saidaVoluntaria: null, // (novo) grupo que a própria pessoa acabou de sair ou apagar
  fotoEmEdicao: null, // (novo) { alvo: "eu" ou "grupo", grupoId, nova } enquanto a janela de foto está aberta
};

// "Ouvintes" do banco: cada um fica recebendo as mudanças em tempo real.
// Guardamos a função que o Firebase devolve, porque chamar ela para de ouvir.
const ouvintes = { grupos: null, pedidos: null, itens: null, minhaFoto: null };

// Grupos que a pessoa criou neste navegador desde que abriu o site.
// Serve pra não mostrar avisos errados (veja criarGrupo e ouvirMeusGrupos).
const gruposCriadosAgora = new Set();

// (novo) Fotos que outras pessoas escolheram no site: { uid => { foto, quando } }.
// Guardamos por alguns minutos pra não ficar buscando no banco toda hora.
const fotosPersonalizadas = new Map();
const VALIDADE_DAS_FOTOS = 5 * 60 * 1000; // 5 minutos, em milissegundos

// Admin é quem está na lista "admins" do grupo.
function souAdmin(grupo = grupoAtual()) {
  return Boolean(grupo && estado.usuario && grupo.admins?.includes(estado.usuario.uid));
}
function grupoAtual() {
  return grupoPorId(estado.grupoAtualId);
}
function grupoPorId(grupoId) {
  return estado.grupos.find((grupo) => grupo.id === grupoId) ?? null;
}

// ---------------------------------------------------------------------
// 3. Funções de ajuda
// ---------------------------------------------------------------------
// Atalho: $("grade") é o mesmo que document.getElementById("grade")
const $ = (id) => document.getElementById(id);

/**
 * Cria um elemento HTML de um jeito seguro.
 * el("p", { className: "nota" }, "Olá") vira <p class="nota">Olá</p>
 * Textos viram texto de verdade (nunca HTML), então não dá pra injetar código.
 */
function el(tag, props = {}, ...filhos) {
  const elemento = document.createElement(tag);
  for (const [chave, valor] of Object.entries(props)) {
    if (valor === undefined || valor === null || valor === false) continue;
    if (chave === "className") elemento.className = valor;
    else if (chave.startsWith("on") && typeof valor === "function") {
      elemento.addEventListener(chave.slice(2).toLowerCase(), valor); // onClick vira "click"
    } else if (valor === true) elemento.setAttribute(chave, "");
    else elemento.setAttribute(chave, String(valor));
  }
  for (const filho of filhos.flat()) {
    if (filho === null || filho === undefined || filho === false) continue;
    elemento.append(filho); // append com texto cria um nó de texto (seguro)
  }
  return elemento;
}

// Datas: usamos texto no formato "AAAA-MM-DD" (ex.: "2026-09-24").
// Assim não tem confusão com fuso horário, e dá pra comparar e ordenar como
// texto: "2026-09-24" vem antes de "2026-10-01", igual às datas de verdade.
// (É isso que deixa o banco buscar "os itens do mês" com >= e <=.)
function doisDigitos(numero) {
  return String(numero).padStart(2, "0"); // 7 vira "07"
}
function paraISO(ano, mes, dia) {
  return `${ano}-${doisDigitos(mes + 1)}-${doisDigitos(dia)}`; // +1 porque o mês começa no 0
}
function hojeISO() {
  const agora = new Date();
  return paraISO(agora.getFullYear(), agora.getMonth(), agora.getDate());
}
function lerISO(iso) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return { ano, mes: mes - 1, dia };
}
function diasNoMes(ano, mes) {
  return new Date(ano, mes + 1, 0).getDate(); // "dia 0" do mês seguinte = último dia deste mês
}
// Soma (ou subtrai) dias de uma data. Funciona até virando o mês ou o ano.
function somarDias(iso, dias) {
  const { ano, mes, dia } = lerISO(iso);
  const data = new Date(ano, mes, dia + dias);
  return paraISO(data.getFullYear(), data.getMonth(), data.getDate());
}
function maiuscula(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
// "2026-09-24" vira "Quinta-feira, 24 de setembro"
function formatarDiaLongo(iso) {
  const { ano, mes, dia } = lerISO(iso);
  const diaDaSemana = DIAS_DA_SEMANA[new Date(ano, mes, dia).getDay()];
  return `${diaDaSemana}, ${dia} de ${MESES[mes]}`;
}

// Se aparecer um tipo desconhecido, trata como "outro".
function tipoValido(tipo) {
  return TIPOS[tipo] ? tipo : "outro";
}
// Ordena por tipo (prova primeiro) e, dentro do tipo, por ordem alfabética.
function ordenarItens(itens) {
  return [...itens].sort(
    (a, b) =>
      ORDEM_DOS_TIPOS.indexOf(tipoValido(a.tipo)) - ORDEM_DOS_TIPOS.indexOf(tipoValido(b.tipo)) ||
      (a.titulo || "").localeCompare(b.titulo || "", "pt-BR"),
  );
}

// Sorteia um código usando o gerador aleatório seguro do navegador
// (Math.random() não serve pra isso: dá pra adivinhar os próximos números).
function gerarCodigo() {
  const sorteio = crypto.getRandomValues(new Uint32Array(TAMANHO_DO_CODIGO));
  return Array.from(sorteio, (numero) => ALFABETO_DO_CODIGO[numero % ALFABETO_DO_CODIGO.length]).join("");
}
// "k7m 2qx" vira "K7M2QX": maiúsculas, sem espaço nem traço.
function normalizarCodigo(texto) {
  return texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Pequenas lembranças guardadas no próprio navegador (último grupo
// aberto e pedidos enviados). Cada conta tem as suas: a chave leva o uid.
function chaveLocal(nome) {
  return `agenda-da-turma:${nome}:${estado.usuario?.uid ?? "ninguem"}`;
}
function lerLocal(chave, padrao = null) {
  try {
    const valor = localStorage.getItem(chave);
    return valor === null ? padrao : JSON.parse(valor);
  } catch {
    return padrao;
  }
}
function gravarLocal(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // navegador sem espaço ou com armazenamento bloqueado: o site funciona mesmo assim
  }
}

// Troca a tela que aparece (só uma tela fica visível por vez).
const TELAS = ["tela-carregando", "tela-login", "tela-inicio", "tela-grupo"];
function mostrarTela(idDaTela) {
  for (const tela of TELAS) $(tela).hidden = tela !== idDaTela;
  $("topo").hidden = idDaTela === "tela-login" || idDaTela === "tela-carregando";
}

// Aviso rápido que aparece embaixo e some sozinho.
let temporizadorDoAviso;
function avisar(mensagem) {
  const caixa = $("aviso");
  caixa.textContent = mensagem;
  // "popover" coloca o aviso por cima até das janelas abertas (navegadores novos).
  if (typeof caixa.showPopover === "function") {
    if (caixa.matches(":popover-open")) caixa.hidePopover();
    caixa.showPopover();
  }
  caixa.classList.add("visivel");
  clearTimeout(temporizadorDoAviso);
  // Mensagem mais comprida fica mais tempo na tela, pra dar tempo de ler.
  temporizadorDoAviso = setTimeout(esconderAviso, Math.max(4200, mensagem.length * 70));
}
function esconderAviso() {
  const caixa = $("aviso");
  clearTimeout(temporizadorDoAviso);
  caixa.classList.remove("visivel");
  if (typeof caixa.hidePopover === "function" && caixa.matches(":popover-open")) caixa.hidePopover();
}

// Transforma os erros técnicos do Firebase em mensagens que dá pra entender.
function explicarErro(erro) {
  const codigo = erro?.code || "";
  const mensagem = erro?.message || "";
  // A pessoa fechou a janela do Google sem escolher a conta: não é erro, só desistiu.
  if (codigo === "auth/popup-closed-by-user" || codigo === "auth/cancelled-popup-request") return null;
  if (codigo === "auth/popup-blocked") {
    return "O navegador bloqueou a janela do Google. Libere pop-ups pra este endereço e tente de novo.";
  }
  if (codigo === "auth/unauthorized-domain") {
    return "Este endereço não está autorizado no Firebase. Se estiver no Live Server, troque 127.0.0.1 por localhost na barra de endereço.";
  }
  if (codigo === "auth/operation-not-allowed" || codigo === "auth/configuration-not-found") {
    return "O login com Google ainda não foi ligado no Firebase. Veja o passo 2 do LEIAME.";
  }
  if (codigo.includes("api-key")) {
    return AVISOS_DE_CONFIGURACAO.valores;
  }
  if (codigo === "auth/network-request-failed" || codigo === "unavailable") {
    return "Sem conexão com a internet. Confira e tente de novo.";
  }
  if (codigo === "auth/web-storage-unsupported" || codigo === "auth/operation-not-supported-in-this-environment") {
    return "Este navegador bloqueou o login. Tente abrir o site no Chrome, no Edge, no Firefox ou no Safari.";
  }
  if (/database .*does not exist/i.test(mensagem)) {
    return "O banco de dados ainda não foi criado no Firebase. Veja o passo 3 do LEIAME.";
  }
  if (codigo === "permission-denied") {
    return "O banco não deixou fazer isso. Se acontecer sempre, confira se as regras do firestore.rules mais novas foram publicadas (passo 4 do LEIAME).";
  }
  if (codigo === "resource-exhausted") {
    return "O limite gratuito do Firebase de hoje acabou. Amanhã volta ao normal.";
  }
  return "Algo deu errado. Tente de novo daqui a pouco.";
}
function mostrarErro(erro) {
  console.error(erro); // o erro completo continua no Console (F12), pra quem quiser investigar
  const mensagem = explicarErro(erro);
  if (mensagem) avisar(mensagem);
}

// Janelas (usamos o <dialog> do próprio HTML).
function abrirDialogo(id) {
  const janela = $(id);
  if (!janela.open) janela.showModal();
  return janela;
}
function fecharDialogo(id) {
  const janela = $(id);
  if (janela.open) janela.close();
}
// Fecha todas as janelas abertas (usado quando alguém entra ou sai da conta).
function fecharTodosDialogos() {
  for (const janela of document.querySelectorAll("dialog[open]")) janela.close();
}
// Fecha as janelas que dependem do grupo aberto (usado ao trocar de grupo).
// A do código fica aberta de propósito: ela aparece logo depois de criar um grupo.
function fecharDialogosDoGrupo() {
  for (const id of ["dialogo-membros", "dialogo-pedidos", "dialogo-item"]) fecharDialogo(id);
  if (estado.fotoEmEdicao?.alvo === "grupo") fecharDialogo("dialogo-foto"); // (novo)
}

// Janela de "tem certeza?". Uso: if (await confirmar({...})) { ... }
function confirmar({ titulo, texto, botao = "Confirmar", perigo = false }) {
  return new Promise((resolver) => {
    const janela = $("dialogo-confirmar");
    $("confirmar-titulo").textContent = titulo;
    $("confirmar-texto").textContent = texto;
    const botaoOk = $("confirmar-ok");
    botaoOk.textContent = botao;
    botaoOk.classList.toggle("botao-perigo", perigo);
    botaoOk.classList.toggle("botao-primario", !perigo);
    janela.returnValue = "";
    // Quando a janela fecha, returnValue diz qual botão foi apertado ("ok" ou "cancelar").
    janela.addEventListener("close", () => resolver(janela.returnValue === "ok"), { once: true });
    janela.showModal();
  });
}

// Só aceita foto do Google ou foto feita pelo próprio site. Qualquer outra coisa vira "".
function fotoSegura(url) {
  if (typeof url !== "string") return "";
  if (FOTO_DO_GOOGLE.test(url)) return url;
  if (url.length <= LIMITE_DA_FOTO && FOTO_DO_SITE.test(url)) return url; // (novo)
  return "";
}

// Nome e foto da conta Google da pessoa logada. É o que vai pro pedido
// pra entrar e pra lista de membros (as regras só aceitam foto do Google ali).
function meuPerfil() {
  const usuario = estado.usuario;
  return {
    nome: (usuario.displayName || "Estudante").trim().slice(0, 80) || "Estudante",
    foto: FOTO_DO_GOOGLE.test(usuario.photoURL || "") ? usuario.photoURL.slice(0, 1000) : "",
  };
}

// (novo) A foto que aparece de alguém: a que a pessoa escolheu no site,
// senão a do Google, senão nenhuma (aí aparece a primeira letra do nome).
function minhaFotoParaMostrar() {
  return estado.minhaFoto || meuPerfil().foto;
}
function fotoDe(uid, fotoDoGoogle) {
  if (uid === estado.usuario?.uid) return minhaFotoParaMostrar();
  return fotosPersonalizadas.get(uid)?.foto || fotoDoGoogle || "";
}

// Bolinha com a foto da pessoa (ou a primeira letra do nome, se não tiver foto).
function avatar(nome, foto, classe = "avatar") {
  const inicial = (nome || "?").trim().charAt(0).toUpperCase() || "?";
  const caixa = el("span", { className: classe, "aria-hidden": "true" });
  const url = fotoSegura(foto);
  if (url) {
    // no-referrer: sem isso, às vezes o Google se recusa a mostrar a foto em outros sites.
    const imagem = el("img", { src: url, alt: "", referrerpolicy: "no-referrer", loading: "lazy" });
    imagem.addEventListener("error", () => caixa.replaceChildren(inicial)); // foto não carregou: mostra a letra
    caixa.append(imagem);
  } else {
    caixa.append(inicial);
  }
  return caixa;
}

// (novo) Quadradinho com a foto do grupo (ou a primeira letra do nome).
// "tag" e "props" deixam criar um <button> pra quem pode trocar a foto.
function fotoDoGrupo(nome, foto, { tag = "span", classe = "foto-grupo", ...props } = {}) {
  const inicial = (nome || "?").trim().charAt(0).toUpperCase() || "?";
  const caixa = el(tag, { className: classe, ...props });
  const url = fotoSegura(foto);
  if (url) {
    const imagem = el("img", { src: url, alt: "" });
    imagem.addEventListener("error", () => imagem.replaceWith(inicial));
    caixa.append(imagem);
  } else {
    caixa.append(inicial);
  }
  return caixa;
}

// ---------------------------------------------------------------------
// 4. Login e conta
// ---------------------------------------------------------------------
async function entrar() {
  if (!auth) return;
  const provedor = new GoogleAuthProvider();
  // Sempre pergunta qual conta usar (ajuda em computador com mais de uma conta Google).
  provedor.setCustomParameters({ prompt: "select_account" });

  const botao = $("botao-entrar");
  botao.disabled = true; // evita abrir duas janelas do Google com dois cliques
  try {
    await signInWithPopup(auth, provedor);
    // Não precisa trocar de tela aqui: o Firebase avisa a função
    // quandoAContaMudar, lá embaixo, e ela cuida disso.
  } catch (erro) {
    mostrarErro(erro);
  } finally {
    botao.disabled = false;
  }
}

async function sair() {
  fecharDialogo("dialogo-menu");
  try {
    await signOut(auth); // a tela de login volta sozinha, pelo quandoAContaMudar
  } catch (erro) {
    mostrarErro(erro);
  }
}

// O Firebase chama esta função quando o site abre (pra contar se já tem
// alguém logado), quando alguém entra e quando alguém sai.
// "usuario" é a conta logada, ou null se não tem ninguém.
function quandoAContaMudar(usuario) {
  const acabouDeSair = estado.usuario !== null && usuario === null;
  pararDeOuvirTudo(); // para de receber os dados da conta anterior
  fecharTodosDialogos();

  // Recomeça do zero, no mês de hoje.
  const hoje = lerISO(hojeISO());
  Object.assign(estado, {
    usuario,
    minhaFoto: "",
    grupos: [],
    grupoAtualId: null,
    mesVisivel: { ano: hoje.ano, mes: hoje.mes },
    diaSelecionado: hojeISO(),
    itensDoMes: [],
    itensDoMesChave: null,
    pedidosDoGrupo: [],
    pedidosDoGrupoId: null,
    grupoEmEspera: null,
    codigoMostrado: null,
    abrirQuandoChegar: null,
    saidaVoluntaria: null,
    fotoEmEdicao: null,
  });
  fotosPersonalizadas.clear(); // (novo)

  if (!usuario) {
    mostrarTela("tela-login");
    if (acabouDeSair) avisar("Você saiu da conta.");
    return;
  }

  preencherAvatarDoTopo();
  mostrarTela("tela-carregando"); // enquanto os grupos não chegam do banco
  ouvirMinhaFoto(); // (novo)
  ouvirMeusGrupos();
}

function preencherAvatarDoTopo() {
  $("botao-menu").replaceChildren(avatar(meuPerfil().nome, minhaFotoParaMostrar()));
}

function abrirMenu() {
  desenharMenu();
  abrirDialogo("dialogo-menu");
}
function desenharMenu() {
  const { nome } = meuPerfil();
  $("menu-avatar").replaceChildren(avatar(nome, minhaFotoParaMostrar(), "avatar avatar-grande"));
  $("menu-nome").textContent = nome;
  $("menu-email").textContent = estado.usuario.email || "";
  // "outro" só faz sentido pra quem já está em algum grupo
  $("menu-entrar-codigo").textContent = estado.grupos.length ? "Entrar em outro grupo" : "Entrar com código";
}

// Folha de enfeite da tela de login: o mês atual com alguns dias
// "riscados" de marca-texto. A animação dos riscos está no style.css.
function desenharFolhaDecorativa() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth();
  $("deco-mes").textContent = maiuscula(MESES[mes]);

  // Dia do mês => tipo (a cor do risco)
  const marcados = { 3: "tarefa", 8: "prova", 11: "trabalho", 15: "tarefa", 17: "outro", 22: "prova", 24: "trabalho", 27: "tarefa" };
  const primeiro = new Date(ano, mes, 1).getDay();
  const total = diasNoMes(ano, mes);
  const celulas = [];
  let ordem = 0; // a ordem em que cada risco aparece na animação

  for (let i = 0; i < primeiro; i++) celulas.push(el("div", { className: "dia vazio" }));
  for (let dia = 1; dia <= total; dia++) {
    const tipo = marcados[dia];
    const numero = el("span", { className: tipo ? `numero riscado tipo-${tipo}` : "numero" }, String(dia));
    if (tipo) numero.style.setProperty("--ordem", String(ordem++));
    celulas.push(el("div", { className: "dia" }, numero));
  }
  const sobra = (7 - ((primeiro + total) % 7)) % 7;
  for (let i = 0; i < sobra; i++) celulas.push(el("div", { className: "dia vazio" }));

  $("deco-grade").replaceChildren(...celulas);
}

// ---------------------------------------------------------------------
// 5. Fotos: a sua e a do grupo (novo)
// ---------------------------------------------------------------------
//  A foto que a pessoa escolhe fica em usuarios/{uid}. A do grupo fica no
//  próprio grupo, no campo "foto". As duas são JPEGs pequenos, em texto.
// ---------------------------------------------------------------------

// Fica ouvindo a própria foto: se trocar em outro aparelho, muda aqui também.
function ouvirMinhaFoto() {
  pararDeOuvir("minhaFoto");
  ouvintes.minhaFoto = onSnapshot(
    doc(db, "usuarios", estado.usuario.uid),
    (documento) => {
      estado.minhaFoto = fotoSegura(documento.data()?.foto);
      preencherAvatarDoTopo();
      if ($("dialogo-menu").open) desenharMenu();
      if ($("dialogo-membros").open) desenharMembros();
    },
    (erro) => {
      ouvintes.minhaFoto = null;
      console.error(erro); // sem a foto escolhida, o site usa a do Google: dá pra seguir
    },
  );
}

// Busca no banco as fotos escolhidas por outras pessoas (as que ainda não
// temos ou que já ficaram velhas). Devolve true se alguma mudou.
async function buscarFotosPersonalizadas(uids) {
  const agora = Date.now();
  const faltando = [...new Set(uids)].filter(
    (uid) => uid !== estado.usuario.uid && !(fotosPersonalizadas.get(uid)?.quando > agora - VALIDADE_DAS_FOTOS),
  );
  let mudou = false;
  await Promise.all(
    faltando.map(async (uid) => {
      let foto = "";
      try {
        const documento = await getDoc(doc(db, "usuarios", uid));
        foto = fotoSegura(documento.data()?.foto);
      } catch {
        // sem internet, por exemplo: fica sem a foto escolhida por enquanto
      }
      if (fotosPersonalizadas.get(uid)?.foto !== foto) mudou = true;
      fotosPersonalizadas.set(uid, { foto, quando: Date.now() });
    }),
  );
  return mudou;
}

// Corta a imagem no quadrado do meio, diminui pra 160 x 160 e transforma em JPEG.
// Tudo acontece no navegador: a foto original não sai do aparelho.
async function prepararFoto(arquivo) {
  if (!arquivo.type.startsWith("image/")) throw new Error("nao-e-imagem");
  const imagem = await createImageBitmap(arquivo); // já respeita a foto "de lado" do celular

  const lado = Math.min(imagem.width, imagem.height);
  const canvas = document.createElement("canvas");
  canvas.width = TAMANHO_DA_FOTO;
  canvas.height = TAMANHO_DA_FOTO;
  const pincel = canvas.getContext("2d");
  pincel.fillStyle = "#FFFFFF"; // fundo branco pra PNG transparente não ficar preto
  pincel.fillRect(0, 0, TAMANHO_DA_FOTO, TAMANHO_DA_FOTO);
  pincel.imageSmoothingQuality = "high";
  pincel.drawImage(
    imagem,
    (imagem.width - lado) / 2, // de onde cortar (x)
    (imagem.height - lado) / 2, // de onde cortar (y)
    lado,
    lado,
    0,
    0,
    TAMANHO_DA_FOTO,
    TAMANHO_DA_FOTO,
  );
  imagem.close?.();

  // Se passar do limite, vai baixando a qualidade.
  let qualidade = 0.85;
  let foto = canvas.toDataURL("image/jpeg", qualidade);
  while (foto.length > LIMITE_DA_FOTO && qualidade > 0.4) {
    qualidade -= 0.15;
    foto = canvas.toDataURL("image/jpeg", qualidade);
  }
  if (!FOTO_DO_SITE.test(foto) || foto.length > LIMITE_DA_FOTO) throw new Error("grande-demais");
  return foto;
}

// Abre a janela de foto. alvo = "eu" (a sua foto) ou "grupo" (a do grupo aberto).
function abrirFoto(alvo) {
  const grupo = grupoAtual();
  if (alvo === "grupo" && !souAdmin(grupo)) return;
  estado.fotoEmEdicao = { alvo, grupoId: alvo === "grupo" ? grupo.id : null, nova: null };
  $("foto-titulo").textContent = alvo === "eu" ? "Sua foto" : "Foto do grupo";
  $("foto-texto").textContent =
    alvo === "eu"
      ? "Quem está nos seus grupos vê essa foto. Escolha uma que você mostraria pra turma toda."
      : `Todo mundo de ${grupo.nome} vê essa foto.`;
  $("erro-foto").textContent = "";
  desenharPreviaDaFoto();
  abrirDialogo("dialogo-foto");
}

function desenharPreviaDaFoto() {
  const edicao = estado.fotoEmEdicao;
  if (!edicao) return;
  const botaoTirar = $("foto-tirar");
  if (edicao.alvo === "eu") {
    const { nome, foto: fotoDoGoogle } = meuPerfil();
    const escolhida = edicao.nova !== null ? edicao.nova : estado.minhaFoto;
    $("foto-previa").replaceChildren(avatar(nome, escolhida || fotoDoGoogle));
    botaoTirar.textContent = fotoDoGoogle ? "Usar a foto do Google" : "Tirar foto";
    botaoTirar.hidden = !escolhida;
  } else {
    const grupo = grupoPorId(edicao.grupoId);
    const atual = edicao.nova !== null ? edicao.nova : grupo?.foto || "";
    $("foto-previa").replaceChildren(fotoDoGrupo(grupo?.nome, atual, { classe: "foto-grupo foto-grupo-grande" }));
    botaoTirar.textContent = "Tirar foto";
    botaoTirar.hidden = !fotoSegura(atual);
  }
  $("foto-salvar").disabled = edicao.nova === null; // nada mudou ainda
}

async function quandoEscolherArquivo(evento) {
  const arquivo = evento.target.files?.[0];
  evento.target.value = ""; // deixa escolher o mesmo arquivo de novo, se quiser
  if (!arquivo || !estado.fotoEmEdicao) return;
  const erro = $("erro-foto");
  erro.textContent = "";
  try {
    estado.fotoEmEdicao.nova = await prepararFoto(arquivo);
    desenharPreviaDaFoto();
  } catch (falha) {
    console.error(falha);
    erro.textContent =
      falha.message === "nao-e-imagem"
        ? "Esse arquivo não é uma imagem. Escolha uma foto em JPG ou PNG."
        : "Não consegui abrir essa imagem. Tente outra foto, em JPG ou PNG.";
  }
}

function tirarFotoEmEdicao() {
  if (!estado.fotoEmEdicao) return;
  estado.fotoEmEdicao.nova = ""; // "" = sem foto escolhida
  desenharPreviaDaFoto();
}

async function salvarFoto() {
  const edicao = estado.fotoEmEdicao;
  if (!edicao || edicao.nova === null) return;
  const botao = $("foto-salvar");
  botao.disabled = true;
  try {
    if (edicao.alvo === "eu") {
      const minhaRef = doc(db, "usuarios", estado.usuario.uid);
      if (edicao.nova) await setDoc(minhaRef, { foto: edicao.nova, atualizadoEm: serverTimestamp() });
      else await deleteDoc(minhaRef); // tirar a foto = apagar o documento (a foto some do banco)
    } else {
      await updateDoc(doc(db, "grupos", edicao.grupoId), { foto: edicao.nova });
    }
    fecharDialogo("dialogo-foto");
    avisar(edicao.nova ? "Foto salva." : "Foto tirada.");
  } catch (falha) {
    mostrarErro(falha);
    botao.disabled = false;
  }
}

// ---------------------------------------------------------------------
// 6. Grupos: ouvir o banco, abrir e trocar
// ---------------------------------------------------------------------
//  Como o banco está organizado (o firestore.rules protege cada parte):
//
//   grupos/{id}                 nome, série, escola, código, foto, membros,
//                               admins e o nome e a foto do Google de cada membro
//   grupos/{id}/pedidos/{uid}   pedido pra entrar (o id é o uid de quem pediu)
//   grupos/{id}/itens/{id}      o que está marcado na agenda (novo)
//   codigos/{código}            qual grupo tem esse código (e o nome dele)
//   usuarios/{uid}              a foto que a pessoa escolheu no site (novo)
// ---------------------------------------------------------------------
function pararDeOuvir(nome) {
  if (ouvintes[nome]) {
    ouvintes[nome](); // chamar a função devolvida pelo onSnapshot para de ouvir
    ouvintes[nome] = null;
  }
}
function pararDeOuvirTudo() {
  for (const nome of Object.keys(ouvintes)) pararDeOuvir(nome);
}

// Fica ouvindo os grupos em que a pessoa é membro. O onSnapshot chama a
// função de novo sempre que algo muda no banco: um grupo novo, um pedido
// aprovado, alguém que entrou ou saiu... Por isso a tela se atualiza sozinha.
function ouvirMeusGrupos() {
  pararDeOuvir("grupos");
  const uid = estado.usuario.uid;
  // Só os grupos que têm o meu uid na lista "membros".
  // As regras do banco só deixam fazer essa busca com o próprio uid.
  const consulta = query(collection(db, "grupos"), where("membros", "array-contains", uid));
  let primeiraVez = true;

  ouvintes.grupos = onSnapshot(
    consulta,
    // Também avisa quando o servidor confirma algo que a gente salvou (veja "pendente" abaixo).
    { includeMetadataChanges: true },
    (resultado) => {
      // Antes da primeira resposta do servidor, o Firebase pode mandar uma lista
      // "do cache" (a memória do próprio navegador), que pode vir vazia ou velha.
      // Pra não mostrar a tela errada nem avisos errados, esperamos a do servidor.
      if (primeiraVez && resultado.metadata.fromCache) return;

      const idsAntes = new Set(estado.grupos.map((grupo) => grupo.id));
      const grupoAberto = grupoAtual();
      estado.grupos = resultado.docs
        .map((documento) => ({
          id: documento.id,
          ...documento.data(),
          // true enquanto o servidor ainda não confirmou uma mudança feita neste navegador
          pendente: documento.metadata.hasPendingWrites,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      const idsAgora = new Set(estado.grupos.map((grupo) => grupo.id));

      if (!primeiraVez) {
        // Grupo que apareceu agora e que eu tinha pedido pra entrar: fui aprovado!
        const pedidos = new Set(pedidosLembrados().map((pedido) => pedido.id));
        for (const grupo of estado.grupos) {
          if (!idsAntes.has(grupo.id) && pedidos.has(grupo.id)) {
            avisar(`Pedido aprovado: agora você está em ${grupo.nome}.`);
          }
        }
        // O grupo aberto sumiu da lista: um admin me tirou ou apagou o grupo.
        // Não avisa se fui eu que saí ou apaguei, nem se é um grupo que eu
        // estava criando e o banco recusou.
        const sumiu = grupoAberto && !idsAgora.has(grupoAberto.id);
        if (sumiu && grupoAberto.id !== estado.saidaVoluntaria && !gruposCriadosAgora.has(grupoAberto.id)) {
          avisar(`Você não faz mais parte de ${grupoAberto.nome}.`);
        }
      }
      if (estado.saidaVoluntaria && !idsAgora.has(estado.saidaVoluntaria)) estado.saidaVoluntaria = null;
      primeiraVez = false;
      esquecerPedidosAprovados();

      // Qual grupo mostrar?
      let alvo = null;
      if (estado.abrirQuandoChegar && idsAgora.has(estado.abrirQuandoChegar)) {
        alvo = estado.abrirQuandoChegar; // o grupo que acabou de ser criado
        estado.abrirQuandoChegar = null;
      } else if (estado.grupoAtualId && idsAgora.has(estado.grupoAtualId)) {
        alvo = estado.grupoAtualId; // continua no mesmo
      } else {
        const ultimo = lerLocal(chaveLocal("ultimo-grupo")); // o último que a pessoa abriu
        alvo = idsAgora.has(ultimo) ? ultimo : (estado.grupos[0]?.id ?? null);
      }

      if (alvo) abrirGrupo(alvo);
      else mostrarInicio();
    },
    (erro) => {
      mostrarErro(erro);
      mostrarInicio();
    },
  );
}

// Mostra a agenda de um grupo.
function abrirGrupo(grupoId) {
  if (!grupoPorId(grupoId)) {
    mostrarInicio();
    return;
  }
  if (estado.grupoAtualId !== grupoId) {
    fecharDialogosDoGrupo();
    estado.grupoAtualId = grupoId;
    gravarLocal(chaveLocal("ultimo-grupo"), grupoId);
  }
  // (novo) Começa a ouvir os itens do mês, se ainda não estiver ouvindo este grupo e este mês.
  if (estado.itensDoMesChave !== chaveDosItens()) ouvirItensDoMes();
  atualizarOuvintePedidos();
  desenharCabecalhoGrupo();
  desenharSeletorDeGrupo();
  mostrarTela("tela-grupo");
  desenharCalendario();
  desenharDia();
  atualizarDialogosAbertos();
}

// Tela de quem ainda não está em nenhum grupo.
function mostrarInicio() {
  estado.grupoAtualId = null;
  pararDeOuvir("itens"); // (novo)
  estado.itensDoMes = [];
  estado.itensDoMesChave = null;
  atualizarOuvintePedidos(); // sem grupo aberto, para de ouvir os pedidos
  fecharDialogosDoGrupo();
  desenharSeletorDeGrupo();
  mostrarTela("tela-inicio");
  desenharPendentes();
}

// Foto, nome, série, escola e botões do grupo aberto.
function desenharCabecalhoGrupo() {
  const grupo = grupoAtual();
  const admin = souAdmin(grupo);
  const quantos = grupo.membros.length;
  // (novo) A foto: pra admin, é um botão que abre a janela de trocar a foto.
  $("lugar-foto-grupo").replaceChildren(
    admin
      ? fotoDoGrupo(grupo.nome, grupo.foto, { tag: "button", type: "button", "aria-label": "Trocar a foto do grupo", onClick: () => abrirFoto("grupo") })
      : fotoDoGrupo(grupo.nome, grupo.foto, { "aria-hidden": "true" }),
  );
  $("nome-grupo").textContent = grupo.nome;
  $("info-grupo").textContent = [grupo.serie, grupo.escola, `${quantos} ${quantos === 1 ? "membro" : "membros"}`]
    .filter(Boolean)
    .join(", ");
  $("botao-adicionar").hidden = !admin;
  $("botao-pedidos").hidden = !admin;
  atualizarBotaoPedidos();
}

// Com mais de um grupo, aparece uma lista no topo pra trocar.
function desenharSeletorDeGrupo() {
  const varios = estado.grupos.length > 1;
  $("seletor-grupo-rotulo").hidden = !varios;
  $("topo").classList.toggle("com-seletor", varios);
  const seletor = $("seletor-grupo");
  seletor.replaceChildren(...estado.grupos.map((grupo) => el("option", { value: grupo.id }, grupo.nome)));
  seletor.value = estado.grupoAtualId ?? "";
}

// Quando os dados do grupo mudam, as janelas abertas acompanham.
function atualizarDialogosAbertos() {
  if ($("dialogo-membros").open) desenharMembros();
  if ($("dialogo-pedidos").open) {
    if (souAdmin()) desenharPedidos();
    else fecharDialogo("dialogo-pedidos");
  }
  if ($("dialogo-item").open && !souAdmin()) fecharDialogo("dialogo-item");
  if ($("dialogo-foto").open && estado.fotoEmEdicao?.alvo === "grupo") {
    if (souAdmin()) desenharPreviaDaFoto();
    else fecharDialogo("dialogo-foto");
  }
}

// ---------------------------------------------------------------------
// 7. Criar grupo e mostrar o código
// ---------------------------------------------------------------------
function abrirCriarGrupo() {
  const formulario = $("form-criar");
  formulario.reset();
  $("erro-criar").textContent = "";
  abrirDialogo("dialogo-criar");
  formulario.elements.nome.focus();
}

async function criarGrupo(evento) {
  evento.preventDefault(); // sem isso, o formulário recarregaria a página
  const formulario = evento.target;
  const erro = $("erro-criar");
  const nome = formulario.elements.nome.value.trim();
  const serie = formulario.elements.serie.value.trim();
  const escola = formulario.elements.escola.value.trim();
  if (!nome) {
    erro.textContent = "Dê um nome pro grupo (por exemplo: 9º B).";
    formulario.elements.nome.focus();
    return;
  }

  const botao = formulario.querySelector('[type="submit"]');
  botao.disabled = true;
  erro.textContent = "";
  const eu = estado.usuario.uid;
  const grupoRef = doc(collection(db, "grupos")); // reserva um id novo pro grupo
  gruposCriadosAgora.add(grupoRef.id);
  try {
    let codigo = "";

    // O grupo e o código são salvos juntos, num "lote" (writeBatch):
    // ou os dois dão certo, ou nenhum é salvo.
    // Se o código sorteado já for de outro grupo, o banco recusa o lote
    // e a gente sorteia outro (até 3 vezes).
    for (let tentativa = 1; ; tentativa++) {
      codigo = gerarCodigo();
      // O Firebase mostra o que a gente salva na hora, antes mesmo de o
      // servidor confirmar (o nome disso é "latency compensation"). Então o
      // grupo pode chegar no ouvirMeusGrupos antes do commit terminar:
      // por isso ele já fica marcado pra abrir desde agora.
      estado.abrirQuandoChegar = grupoRef.id;
      const lote = writeBatch(db);
      lote.set(grupoRef, {
        nome,
        serie,
        escola,
        codigo,
        criadoPor: eu,
        criadoEm: serverTimestamp(), // a hora do servidor, não a do computador
        membros: [eu],
        admins: [eu],
        membrosInfo: { [eu]: meuPerfil() },
      });
      lote.set(doc(db, "codigos", codigo), { grupoId: grupoRef.id, nome });
      try {
        await lote.commit();
        break; // deu certo
      } catch (falha) {
        if (falha.code === "permission-denied" && tentativa < 3) continue; // tenta outro código
        throw falha;
      }
    }

    fecharDialogo("dialogo-criar");
    mostrarCodigoDoGrupo({ id: grupoRef.id, nome, codigo }, true);
  } catch (falha) {
    estado.abrirQuandoChegar = null;
    mostrarErro(falha);
  } finally {
    botao.disabled = false;
  }
}

// Janela com o código grande, pra passar pra turma.
function mostrarCodigoDoGrupo(grupo, recemCriado = false) {
  estado.codigoMostrado = { id: grupo.id, nome: grupo.nome, codigo: grupo.codigo };
  $("codigo-titulo").textContent = recemCriado ? "Grupo criado" : `Código de ${grupo.nome}`;
  $("codigo-texto").textContent = recemCriado
    ? `Passe este código pra turma. Quem digitar vai pedir pra entrar em ${grupo.nome}, e você aprova em Pedidos.`
    : "Quem digitar este código pede pra entrar, e um admin aprova. Passe só pra quem é da turma.";
  $("codigo-valor").textContent = grupo.codigo;
  // Compartilhar (abre o WhatsApp e outros apps) só existe em alguns navegadores, quase sempre no celular.
  $("botao-compartilhar").hidden = typeof navigator.share !== "function";
  abrirDialogo("dialogo-codigo-grupo");
}

async function copiarCodigo() {
  const codigo = estado.codigoMostrado?.codigo;
  if (!codigo) return;
  try {
    await navigator.clipboard.writeText(codigo);
    avisar("Código copiado.");
  } catch {
    avisar("Não deu pra copiar. Selecione o código e copie na mão.");
  }
}

async function compartilharCodigo() {
  const grupo = estado.codigoMostrado;
  if (!grupo) return;
  // Endereço do site: só faz sentido mandar quando ele está publicado, não no localhost.
  const publicado = !["localhost", "127.0.0.1"].includes(location.hostname);
  try {
    await navigator.share({
      title: "Agenda da Turma",
      text: `Código do grupo ${grupo.nome} na Agenda da Turma: ${grupo.codigo}`,
      url: publicado ? location.origin : undefined,
    });
  } catch (erro) {
    if (erro.name !== "AbortError") avisar("Não deu pra compartilhar. Use o Copiar código.");
  }
}

// ---------------------------------------------------------------------
// 8. Entrar com código e pedidos enviados
// ---------------------------------------------------------------------
function abrirEntrarComCodigo() {
  const formulario = $("form-codigo");
  formulario.reset();
  $("erro-codigo").textContent = "";
  abrirDialogo("dialogo-codigo");
  formulario.elements.codigo.focus();
}

async function buscarGrupoPeloCodigo(evento) {
  evento.preventDefault();
  const formulario = evento.target;
  const erro = $("erro-codigo");
  const codigo = normalizarCodigo(formulario.elements.codigo.value);
  if (codigo.length !== TAMANHO_DO_CODIGO) {
    erro.textContent = "O código tem 6 letras e números. Confira e tente de novo.";
    formulario.elements.codigo.focus();
    return;
  }

  const botao = formulario.querySelector('[type="submit"]');
  botao.disabled = true;
  erro.textContent = "";
  try {
    // A coleção "codigos" diz qual grupo tem esse código.
    // Ela só mostra o id e o nome do grupo: o resto só membros veem.
    const achado = await getDoc(doc(db, "codigos", codigo));
    if (!achado.exists()) {
      erro.textContent = "Não achei nenhum grupo com esse código. Confira as letras e os números.";
      formulario.elements.codigo.focus();
      return;
    }
    const grupo = { id: achado.data().grupoId, nome: achado.data().nome };

    // Já está no grupo? Então é só abrir.
    if (grupoPorId(grupo.id)) {
      fecharDialogo("dialogo-codigo");
      abrirGrupo(grupo.id);
      avisar(`Você já está em ${grupo.nome}.`);
      return;
    }

    // Já pediu antes? (cada pessoa só tem um pedido por grupo, com o id igual ao uid dela)
    const meuPedido = await getDoc(doc(db, "grupos", grupo.id, "pedidos", estado.usuario.uid));
    fecharDialogo("dialogo-codigo");
    mostrarPedidoDeEntrada(grupo, meuPedido.exists());
  } catch (falha) {
    mostrarErro(falha);
  } finally {
    botao.disabled = false;
  }
}

// Janela "achei o grupo": só dá pra ver a agenda depois de pedir e ser aprovado.
function mostrarPedidoDeEntrada(grupo, jaPediu) {
  estado.grupoEmEspera = grupo;
  $("entrar-nome").textContent = grupo.nome;
  $("entrar-texto").textContent = jaPediu
    ? "Você já pediu pra entrar neste grupo. Agora é só esperar um admin aprovar."
    : "Pra ver a agenda, peça pra entrar. Os admins do grupo vão ver o seu nome e a sua foto e decidir se aprovam.";
  $("botao-pedir").hidden = jaPediu;
  $("botao-cancelar-pedido").hidden = !jaPediu;
  abrirDialogo("dialogo-entrar");
}

async function pedirParaEntrar() {
  const grupo = estado.grupoEmEspera;
  if (!grupo) return;
  const botao = $("botao-pedir");
  botao.disabled = true;
  try {
    await setDoc(doc(db, "grupos", grupo.id, "pedidos", estado.usuario.uid), {
      ...meuPerfil(), // nome e foto do Google
      criadoEm: serverTimestamp(),
    });
    lembrarPedido(grupo);
    fecharDialogo("dialogo-entrar");
    avisar(`Pedido enviado pra ${grupo.nome}. Quando um admin aprovar, o grupo aparece aqui.`);
    if (!estado.grupoAtualId) desenharPendentes();
  } catch (falha) {
    mostrarErro(falha);
  } finally {
    botao.disabled = false;
  }
}

async function cancelarPedido(grupo) {
  if (!grupo) return;
  try {
    await deleteDoc(doc(db, "grupos", grupo.id, "pedidos", estado.usuario.uid));
    esquecerPedido(grupo.id);
    fecharDialogo("dialogo-entrar");
    avisar("Pedido cancelado.");
    if (!estado.grupoAtualId) desenharPendentes();
  } catch (falha) {
    mostrarErro(falha);
  }
}

// Quem pediu não consegue ler o grupo antes de ser aprovado (as regras não deixam).
// Então o próprio navegador guarda a lista dos pedidos enviados, pra mostrar na tela inicial.
function pedidosLembrados() {
  const lista = lerLocal(chaveLocal("pedidos"), []);
  return Array.isArray(lista)
    ? lista.filter((pedido) => typeof pedido?.id === "string" && typeof pedido?.nome === "string")
    : [];
}
function lembrarPedido(grupo) {
  const lista = pedidosLembrados().filter((pedido) => pedido.id !== grupo.id);
  lista.push({ id: grupo.id, nome: grupo.nome });
  gravarLocal(chaveLocal("pedidos"), lista);
}
function esquecerPedido(grupoId) {
  gravarLocal(chaveLocal("pedidos"), pedidosLembrados().filter((pedido) => pedido.id !== grupoId));
}
// Pedido aprovado: o grupo já está na lista de grupos, então sai da lista de pedidos.
function esquecerPedidosAprovados() {
  const meus = new Set(estado.grupos.map((grupo) => grupo.id));
  const lista = pedidosLembrados();
  const resto = lista.filter((pedido) => !meus.has(pedido.id));
  if (resto.length !== lista.length) gravarLocal(chaveLocal("pedidos"), resto);
}

// Descobre como está um pedido: "esperando", "aprovado" ou "recusado".
async function situacaoDoPedido(pedido) {
  try {
    const meuPedido = await getDoc(doc(db, "grupos", pedido.id, "pedidos", estado.usuario.uid));
    if (meuPedido.exists()) return "esperando";
  } catch {
    return "esperando"; // sem internet, por exemplo: na dúvida, continua esperando
  }
  // O pedido sumiu. Se eu consigo ler o grupo, é porque fui aprovado.
  // Se o banco não deixa, é porque o pedido foi recusado.
  try {
    await getDoc(doc(db, "grupos", pedido.id));
    return "aprovado";
  } catch (erro) {
    return erro.code === "permission-denied" ? "recusado" : "esperando";
  }
}

// Lista "Pedidos que você enviou" na tela inicial.
let versaoDosPendentes = 0; // evita que uma checagem antiga apague o resultado de uma mais nova
async function desenharPendentes() {
  const versao = ++versaoDosPendentes;
  const pedidos = pedidosLembrados();
  const bloco = $("bloco-pendentes");
  if (!pedidos.length || !db) {
    bloco.hidden = true;
    return;
  }
  const situacoes = await Promise.all(pedidos.map(situacaoDoPedido));
  if (versao !== versaoDosPendentes || !estado.usuario) return; // chegou uma checagem mais nova

  const linhas = [];
  pedidos.forEach((pedido, posicao) => {
    const situacao = situacoes[posicao];
    if (situacao === "aprovado") {
      esquecerPedido(pedido.id); // o grupo chega sozinho pelo ouvirMeusGrupos
      return;
    }
    const esperando = situacao === "esperando";
    linhas.push(
      el(
        "li",
        { className: "pendente" },
        el("span", { className: "pendente-nome" }, pedido.nome),
        el("span", { className: "pendente-status" }, esperando ? "Esperando aprovação" : "Não foi aprovado"),
        esperando
          ? el("button", { type: "button", className: "botao-texto texto-perigo", onClick: () => cancelarPedido(pedido) }, "Cancelar pedido")
          : el(
              "button",
              {
                type: "button",
                className: "botao-texto",
                onClick: () => {
                  esquecerPedido(pedido.id);
                  desenharPendentes();
                },
              },
              "Tirar da lista",
            ),
      ),
    );
  });
  $("lista-pendentes").replaceChildren(...linhas);
  bloco.hidden = linhas.length === 0;
}

// ---------------------------------------------------------------------
// 9. Admin: pedidos pra entrar
// ---------------------------------------------------------------------
// Admins ficam ouvindo os pedidos do grupo aberto, então o botão
// "Pedidos" se atualiza na hora em que alguém pede pra entrar.
function atualizarOuvintePedidos() {
  const grupo = grupoAtual();
  const deveOuvir = souAdmin(grupo);
  if (deveOuvir && estado.pedidosDoGrupoId === grupo.id) return; // já está ouvindo este grupo

  pararDeOuvir("pedidos");
  estado.pedidosDoGrupo = [];
  estado.pedidosDoGrupoId = null;
  atualizarBotaoPedidos();
  if (!deveOuvir) return;

  // Grupo que acabou de ser criado aqui e o servidor ainda não confirmou:
  // o banco ainda não "conhece" o grupo e recusaria. O ouvirMeusGrupos chama
  // esta função de novo quando a confirmação chegar, e aí a gente começa.
  if (grupo.pendente) return;

  const grupoId = grupo.id;
  estado.pedidosDoGrupoId = grupoId;
  ouvintes.pedidos = onSnapshot(
    collection(db, "grupos", grupoId, "pedidos"),
    (resultado) => {
      estado.pedidosDoGrupo = resultado.docs
        .map((documento) => ({ uid: documento.id, ...documento.data() }))
        // Quem pediu primeiro aparece primeiro. (criadoEm pode chegar vazio por um instante.)
        .sort((a, b) => (a.criadoEm?.toMillis?.() ?? 0) - (b.criadoEm?.toMillis?.() ?? 0));
      atualizarBotaoPedidos();
      if ($("dialogo-pedidos").open) desenharPedidos();
    },
    (erro) => {
      // Quando dá erro, o Firebase desliga o ouvinte. Anotamos isso
      // pra ele poder ser ligado de novo na próxima atualização do grupo.
      ouvintes.pedidos = null;
      estado.pedidosDoGrupoId = null;
      // (novo) Se a pessoa acabou de deixar de ser admin (ou de estar no grupo),
      // o banco corta o acesso e dá erro aqui. Aí não é problema: esperamos
      // um pouco pra ver se ainda é admin antes de mostrar o erro.
      setTimeout(() => {
        if (estado.grupoAtualId === grupoId && souAdmin()) mostrarErro(erro);
      }, 2000);
    },
  );
}

// O botão fica amarelo e mostra quantos pedidos tem.
function atualizarBotaoPedidos() {
  const quantos = estado.pedidosDoGrupo.length;
  const botao = $("botao-pedidos");
  botao.textContent = quantos ? `Pedidos (${quantos})` : "Pedidos";
  botao.classList.toggle("tem-pedidos", quantos > 0);
}

function abrirPedidos() {
  desenharPedidos();
  abrirDialogo("dialogo-pedidos");
}

function desenharPedidos() {
  const lista = $("lista-pedidos");
  if (!estado.pedidosDoGrupo.length) {
    lista.replaceChildren(el("li", { className: "sem-itens" }, "Ninguém pedindo pra entrar agora."));
    return;
  }
  lista.replaceChildren(
    ...estado.pedidosDoGrupo.map((pedido) =>
      el(
        "li",
        { className: "pessoa" },
        avatar(pedido.nome, fotoDe(pedido.uid, pedido.foto)),
        el("span", { className: "pessoa-texto" }, el("span", { className: "pessoa-nome" }, pedido.nome)),
        el(
          "span",
          { className: "pessoa-acoes" },
          el(
            "button",
            { type: "button", className: "botao-texto texto-perigo", "aria-label": `Recusar ${pedido.nome}`, onClick: () => recusarPedido(pedido) },
            "Recusar",
          ),
          el(
            "button",
            { type: "button", className: "botao botao-primario botao-pequeno", "aria-label": `Aprovar ${pedido.nome}`, onClick: () => aprovarPedido(pedido) },
            "Aprovar",
          ),
        ),
      ),
    ),
  );
  // (novo) Busca as fotos que as pessoas escolheram no site e desenha de novo se mudar algo.
  buscarFotosPersonalizadas(estado.pedidosDoGrupo.map((pedido) => pedido.uid)).then((mudou) => {
    if (mudou && $("dialogo-pedidos").open) desenharPedidos();
  });
}

// Aprovar = colocar a pessoa em "membros" (com nome e foto) e apagar o pedido,
// as duas coisas juntas num lote.
async function aprovarPedido(pedido) {
  const grupo = grupoAtual();
  if (!grupo) return;
  if (grupo.membros.length >= MAXIMO_DE_MEMBROS) {
    avisar(`O grupo já tem ${MAXIMO_DE_MEMBROS} pessoas, que é o máximo.`);
    return;
  }
  try {
    const lote = writeBatch(db);
    lote.update(doc(db, "grupos", grupo.id), {
      membros: arrayUnion(pedido.uid), // arrayUnion junta na lista sem repetir
      // "membrosInfo.UID" muda só a parte daquela pessoa, sem mexer nas outras.
      // As regras conferem que o nome e a foto são os mesmos do pedido.
      [`membrosInfo.${pedido.uid}`]: { nome: pedido.nome, foto: pedido.foto ?? "" },
    });
    lote.delete(doc(db, "grupos", grupo.id, "pedidos", pedido.uid));
    await lote.commit();
    avisar(`${pedido.nome} entrou no grupo.`);
  } catch (falha) {
    mostrarErro(falha);
  }
}

// Recusar = apagar o pedido. Se a pessoa pedir de novo, ele aparece outra vez.
async function recusarPedido(pedido) {
  try {
    await deleteDoc(doc(db, "grupos", estado.grupoAtualId, "pedidos", pedido.uid));
    avisar(`Pedido de ${pedido.nome} recusado.`);
  } catch (falha) {
    mostrarErro(falha);
  }
}

// ---------------------------------------------------------------------
// 10. Membros: admins, tirar do grupo, sair e apagar (novo)
// ---------------------------------------------------------------------
function abrirMembros() {
  desenharMembros();
  abrirDialogo("dialogo-membros");
}

function desenharMembros() {
  const grupo = grupoAtual();
  if (!grupo) return;
  const eu = estado.usuario.uid;
  const euSouAdmin = souAdmin(grupo);
  const admins = new Set(grupo.admins);
  const pessoas = grupo.membros
    .map((uid) => ({
      uid,
      nome: grupo.membrosInfo?.[uid]?.nome || "Sem nome",
      fotoDoGoogle: grupo.membrosInfo?.[uid]?.foto || "",
      admin: admins.has(uid),
    }))
    // Admins primeiro, depois em ordem alfabética
    .sort((a, b) => Number(b.admin) - Number(a.admin) || a.nome.localeCompare(b.nome, "pt-BR"));

  $("lista-membros").replaceChildren(
    ...pessoas.map((pessoa) => {
      // Admins veem ações pras outras pessoas (pra si mesmo, é o "Sair do grupo" lá embaixo).
      const acoes =
        euSouAdmin && pessoa.uid !== eu
          ? el(
              "span",
              { className: "pessoa-acoes" },
              el(
                "button",
                { type: "button", className: "botao-texto", "aria-label": `${pessoa.admin ? "Tirar admin de" : "Tornar admin"} ${pessoa.nome}`, onClick: () => alternarAdmin(pessoa) },
                pessoa.admin ? "Tirar admin" : "Tornar admin",
              ),
              el(
                "button",
                { type: "button", className: "botao-texto texto-perigo", "aria-label": `Tirar ${pessoa.nome} do grupo`, onClick: () => tirarDoGrupo(pessoa) },
                "Tirar do grupo",
              ),
            )
          : null;
      return el(
        "li",
        { className: "pessoa" },
        avatar(pessoa.nome, fotoDe(pessoa.uid, pessoa.fotoDoGoogle)),
        el(
          "span",
          { className: "pessoa-texto" },
          el("span", { className: "pessoa-nome" }, pessoa.uid === eu ? `${pessoa.nome} (você)` : pessoa.nome),
          el("span", { className: "pessoa-papel" }, pessoa.admin ? "Admin" : "Membro"),
        ),
        acoes,
      );
    }),
  );

  // Sair do grupo: o grupo nunca pode ficar sem admin.
  const soTemEu = grupo.membros.length === 1;
  const unicoAdmin = euSouAdmin && grupo.admins.length === 1;
  const botaoSair = $("botao-sair-grupo");
  botaoSair.hidden = false;
  botaoSair.disabled = soTemEu || unicoAdmin;
  const nota = $("nota-sair");
  nota.hidden = !(soTemEu || unicoAdmin);
  nota.textContent = soTemEu
    ? "Só tem você no grupo. Pra sair, apague o grupo."
    : "Só você é admin. Pra sair, antes torne outra pessoa admin.";
  $("botao-apagar-grupo").hidden = !euSouAdmin;

  // Busca as fotos que as pessoas escolheram no site e desenha de novo se mudar algo.
  buscarFotosPersonalizadas(grupo.membros).then((mudou) => {
    if (mudou && $("dialogo-membros").open) desenharMembros();
  });
}

async function alternarAdmin(pessoa) {
  const grupo = grupoAtual();
  if (!grupo) return;
  if (!pessoa.admin) {
    const ok = await confirmar({
      titulo: `Tornar ${pessoa.nome} admin?`,
      texto: "Admins marcam coisas na agenda, aprovam pedidos e podem tirar pessoas do grupo.",
      botao: "Tornar admin",
    });
    if (!ok) return;
  }
  try {
    await updateDoc(doc(db, "grupos", grupo.id), {
      admins: pessoa.admin ? arrayRemove(pessoa.uid) : arrayUnion(pessoa.uid),
    });
    avisar(pessoa.admin ? `${pessoa.nome} não é mais admin.` : `${pessoa.nome} agora é admin.`);
  } catch (falha) {
    mostrarErro(falha);
  }
}

// Tirar do grupo: sai de "membros", de "admins" (se for) e o nome e a foto
// dela são apagados do grupo. Tudo numa mudança só.
async function tirarDoGrupo(pessoa) {
  const grupo = grupoAtual();
  if (!grupo) return;
  const ok = await confirmar({
    titulo: `Tirar ${pessoa.nome} do grupo?`,
    texto: "A pessoa deixa de ver a agenda. Pra voltar, ela vai precisar pedir de novo.",
    botao: "Tirar do grupo",
    perigo: true,
  });
  if (!ok) return;
  try {
    await updateDoc(doc(db, "grupos", grupo.id), {
      membros: arrayRemove(pessoa.uid),
      admins: arrayRemove(pessoa.uid),
      [`membrosInfo.${pessoa.uid}`]: deleteField(),
    });
    avisar(`${pessoa.nome} não está mais no grupo.`);
  } catch (falha) {
    mostrarErro(falha);
  }
}

async function sairDoGrupo() {
  const grupo = grupoAtual();
  if (!grupo) return;
  const ok = await confirmar({
    titulo: `Sair de ${grupo.nome}?`,
    texto: "Você deixa de ver a agenda. Pra voltar, vai precisar do código e da aprovação de um admin.",
    botao: "Sair do grupo",
    perigo: true,
  });
  if (!ok) return;
  const eu = estado.usuario.uid;
  estado.saidaVoluntaria = grupo.id; // pra não aparecer "você não faz mais parte" (foi você que saiu)
  try {
    await updateDoc(doc(db, "grupos", grupo.id), {
      membros: arrayRemove(eu),
      admins: arrayRemove(eu),
      [`membrosInfo.${eu}`]: deleteField(),
    });
    fecharDialogo("dialogo-membros");
    avisar(`Você saiu de ${grupo.nome}.`);
  } catch (falha) {
    estado.saidaVoluntaria = null;
    mostrarErro(falha);
  }
}

// Apagar o grupo: primeiro os itens e os pedidos (o banco não apaga
// "o que tem dentro" sozinho), depois o código e o grupo, juntos.
async function apagarGrupo() {
  const grupo = grupoAtual();
  if (!grupo || !souAdmin(grupo)) return;
  const ok = await confirmar({
    titulo: `Apagar ${grupo.nome}?`,
    texto: "A agenda, os pedidos e o código somem pra todo mundo do grupo. Isso não dá pra desfazer.",
    botao: "Apagar grupo",
    perigo: true,
  });
  if (!ok) return;
  estado.saidaVoluntaria = grupo.id;
  const botao = $("botao-apagar-grupo");
  botao.disabled = true;
  try {
    for (const subcolecao of ["itens", "pedidos"]) {
      // Apaga de 400 em 400 (um lote aceita até 500 mudanças).
      for (;;) {
        const pagina = await getDocs(query(collection(db, "grupos", grupo.id, subcolecao), limit(400)));
        if (pagina.empty) break;
        const lote = writeBatch(db);
        pagina.docs.forEach((documento) => lote.delete(documento.ref));
        await lote.commit();
      }
    }
    const lote = writeBatch(db);
    lote.delete(doc(db, "codigos", grupo.codigo));
    lote.delete(doc(db, "grupos", grupo.id));
    await lote.commit();
    fecharDialogo("dialogo-membros");
    avisar(`${grupo.nome} foi apagado.`);
  } catch (falha) {
    estado.saidaVoluntaria = null;
    mostrarErro(falha);
  } finally {
    botao.disabled = false;
  }
}

// ---------------------------------------------------------------------
// 11. Calendário (agora com os itens do banco)
// ---------------------------------------------------------------------
// (novo) Qual grupo e mês deveriam estar na tela, ex.: "abc123/2026-09-01".
function chaveDosItens() {
  const grupo = grupoAtual();
  if (!grupo) return null;
  return `${grupo.id}/${paraISO(estado.mesVisivel.ano, estado.mesVisivel.mes, 1)}`;
}

// (novo) Fica ouvindo os itens do mês que está na tela.
// Como as datas são texto "AAAA-MM-DD", "o mês de setembro" é tudo
// entre "2026-09-01" e "2026-09-30".
function ouvirItensDoMes() {
  pararDeOuvir("itens");
  estado.itensDoMes = [];
  estado.itensDoMesChave = null;
  const grupo = grupoAtual();
  // Grupo recém-criado que o servidor ainda não confirmou: espera (igual aos pedidos).
  if (!grupo || grupo.pendente) return;

  const { ano, mes } = estado.mesVisivel;
  const inicio = paraISO(ano, mes, 1);
  const fim = paraISO(ano, mes, diasNoMes(ano, mes));
  const grupoId = grupo.id;
  estado.itensDoMesChave = chaveDosItens();
  const consulta = query(
    collection(db, "grupos", grupoId, "itens"),
    where("data", ">=", inicio),
    where("data", "<=", fim),
  );
  ouvintes.itens = onSnapshot(
    consulta,
    (resultado) => {
      estado.itensDoMes = resultado.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
      desenharCalendario();
      desenharDia();
    },
    (erro) => {
      ouvintes.itens = null;
      estado.itensDoMesChave = null;
      // Se a pessoa acabou de sair (ou ser tirada) do grupo, o banco corta o
      // acesso e dá erro aqui. Nesse caso quem avisa é o ouvirMeusGrupos, então
      // esperamos um pouco pra ver se o grupo ainda está aberto.
      setTimeout(() => {
        if (estado.grupoAtualId === grupoId) mostrarErro(erro);
      }, 2000);
    },
  );
}

// Vai pra um dia (e troca de mês, se precisar).
function irParaDia(iso, focar = false) {
  const { ano, mes } = lerISO(iso);
  estado.diaSelecionado = iso;
  if (ano !== estado.mesVisivel.ano || mes !== estado.mesVisivel.mes) {
    estado.mesVisivel = { ano, mes };
    ouvirItensDoMes(); // (novo) mês novo: pede ao banco os itens dele
  }
  desenharCalendario(focar);
  desenharDia();
}

// Botões ‹ e ›: quantos = -1 volta um mês, quantos = 1 avança um mês.
function mudarMes(quantos) {
  let { ano, mes } = estado.mesVisivel;
  mes += quantos;
  if (mes < 0) {
    mes = 11;
    ano -= 1;
  } else if (mes > 11) {
    mes = 0;
    ano += 1;
  }
  // No mês de hoje, escolhe hoje; nos outros meses, o dia 1.
  const hoje = lerISO(hojeISO());
  const dia = hoje.ano === ano && hoje.mes === mes ? hoje.dia : 1;
  irParaDia(paraISO(ano, mes, dia));
}

function desenharCalendario(focar = false) {
  const { ano, mes } = estado.mesVisivel;
  $("titulo-mes").textContent = `${maiuscula(MESES[mes])} de ${ano}`;

  const grade = $("grade");
  const tinhaFoco = grade.contains(document.activeElement);
  const hoje = hojeISO();

  // Separa os itens por dia: { "2026-09-24" => [item, item], ... }
  const porDia = new Map();
  for (const item of estado.itensDoMes) {
    if (!porDia.has(item.data)) porDia.set(item.data, []);
    porDia.get(item.data).push(item);
  }

  const celulas = [];

  // Quadradinhos vazios antes do dia 1 (a semana começa no domingo)
  const primeiroDiaDaSemana = new Date(ano, mes, 1).getDay(); // 0 = domingo
  for (let i = 0; i < primeiroDiaDaSemana; i++) {
    celulas.push(el("div", { className: "dia vazio", "aria-hidden": "true" }));
  }

  // Um botão pra cada dia do mês
  const total = diasNoMes(ano, mes);
  for (let dia = 1; dia <= total; dia++) {
    const iso = paraISO(ano, mes, dia);
    const itens = ordenarItens(porDia.get(iso) || []);
    const selecionado = iso === estado.diaSelecionado;
    const classes = ["dia"];
    if (iso === hoje) classes.push("hoje");
    if (selecionado) classes.push("selecionado");

    // Texto pra quem usa leitor de tela, ex.: "24 de setembro, hoje, 2 itens"
    let rotulo = `${dia} de ${MESES[mes]}`;
    if (iso === hoje) rotulo += ", hoje";
    if (itens.length) rotulo += `, ${itens.length} ${itens.length === 1 ? "item" : "itens"}`;

    celulas.push(
      el(
        "button",
        {
          type: "button",
          className: classes.join(" "),
          "data-dia": iso,
          "aria-label": rotulo,
          "aria-pressed": selecionado ? "true" : "false",
          // Só o dia escolhido entra no Tab; o resto se anda com as setas.
          tabindex: selecionado ? "0" : "-1",
          onClick: () => irParaDia(iso),
        },
        el("span", { className: "numero" }, String(dia)),
        el(
          "span",
          { className: "marcas", "aria-hidden": "true" },
          // Até 3 marcas por dia; se tiver mais, aparece "+1", "+2"...
          itens.slice(0, 3).map((item) => el("span", { className: `marca tipo-${tipoValido(item.tipo)}` })),
          itens.length > 3 ? el("span", { className: "mais" }, `+${itens.length - 3}`) : null,
        ),
      ),
    );
  }

  // Completa a última semana com quadradinhos vazios
  const sobra = (7 - ((primeiroDiaDaSemana + total) % 7)) % 7;
  for (let i = 0; i < sobra; i++) {
    celulas.push(el("div", { className: "dia vazio", "aria-hidden": "true" }));
  }

  grade.replaceChildren(...celulas);

  // Quem usa teclado não perde o lugar quando o calendário é redesenhado.
  if (focar || tinhaFoco) grade.querySelector(".dia.selecionado")?.focus();
}

// ---------------------------------------------------------------------
// 12. O que tem no dia escolhido
// ---------------------------------------------------------------------
function desenharDia() {
  const iso = estado.diaSelecionado;
  $("titulo-dia").textContent = formatarDiaLongo(iso) + (iso === hojeISO() ? " (hoje)" : "");
  const admin = souAdmin();
  const itens = ordenarItens(estado.itensDoMes.filter((item) => item.data === iso));
  const lista = $("lista-itens");

  if (!itens.length) {
    lista.replaceChildren(
      el(
        "li",
        { className: "sem-itens" },
        admin
          ? "Nada marcado. Toque em Adicionar pra colocar uma prova, um trabalho ou uma tarefa."
          : "Nada marcado pra este dia.",
      ),
    );
    return;
  }
  lista.replaceChildren(...itens.map((item) => desenharItem(item, admin)));
}

function desenharItem(item, admin) {
  const tipo = tipoValido(item.tipo);
  return el(
    "li",
    { className: `item tipo-${tipo}` },
    el(
      "div",
      { className: "item-topo" },
      el("span", { className: "etiqueta" }, TIPOS[tipo]),
      item.materia ? el("span", { className: "materia" }, item.materia) : null,
      admin
        ? el(
            "button",
            {
              type: "button",
              className: "botao-texto texto-perigo",
              "aria-label": `Apagar ${item.titulo}`,
              onClick: () => apagarItem(item),
            },
            "Apagar",
          )
        : null,
    ),
    el("p", { className: "item-titulo" }, item.titulo),
    item.descricao ? el("p", { className: "item-descricao" }, item.descricao) : null,
  );
}

// ---------------------------------------------------------------------
// 13. Adicionar e apagar itens (agora no banco)
// ---------------------------------------------------------------------
function abrirNovoItem() {
  const formulario = $("form-item");
  formulario.reset(); // limpa o que foi digitado da última vez
  formulario.elements.data.value = estado.diaSelecionado; // já vem com o dia escolhido
  $("erro-item").textContent = "";
  abrirDialogo("dialogo-item");
  formulario.elements.titulo.focus();
}

async function salvarItem(evento) {
  evento.preventDefault(); // sem isso, o formulário recarregaria a página
  const formulario = evento.target;
  const erro = $("erro-item");
  const dados = {
    titulo: formulario.elements.titulo.value.trim(),
    tipo: tipoValido(formulario.elements.tipo.value),
    materia: formulario.elements.materia.value.trim(),
    descricao: formulario.elements.descricao.value.trim(),
    data: formulario.elements.data.value,
  };
  if (!dados.titulo) {
    erro.textContent = "Escreva o que é (por exemplo: Prova de frações).";
    formulario.elements.titulo.focus();
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) {
    erro.textContent = "Escolha a data.";
    formulario.elements.data.focus();
    return;
  }

  const botao = formulario.querySelector('[type="submit"]');
  botao.disabled = true;
  try {
    // (novo) Salva no banco. Quem estiver ouvindo esse mês (todo mundo do
    // grupo com a agenda aberta) recebe o item na hora, pelo ouvirItensDoMes.
    await addDoc(collection(db, "grupos", estado.grupoAtualId, "itens"), {
      ...dados,
      criadoPor: estado.usuario.uid,
      criadoEm: serverTimestamp(),
    });
    fecharDialogo("dialogo-item");
    irParaDia(dados.data); // vai pro dia do item, mesmo se for em outro mês
    avisar("Adicionado na agenda.");
  } catch (falha) {
    mostrarErro(falha);
  } finally {
    botao.disabled = false;
  }
}

async function apagarItem(item) {
  const ok = await confirmar({
    titulo: "Apagar da agenda?",
    texto: `“${item.titulo}” vai sumir pra todo mundo do grupo.`,
    botao: "Apagar",
    perigo: true,
  });
  if (!ok) return;
  try {
    await deleteDoc(doc(db, "grupos", estado.grupoAtualId, "itens", item.id)); // (novo)
    avisar("Apagado da agenda.");
  } catch (falha) {
    mostrarErro(falha);
  }
}

// ---------------------------------------------------------------------
// 14. Ligar os botões e começar
// ---------------------------------------------------------------------
function ligarEventos() {
  $("botao-entrar").addEventListener("click", entrar);
  $("botao-menu").addEventListener("click", abrirMenu);
  $("menu-sair").addEventListener("click", sair);

  // (novo) Fotos
  $("menu-trocar-foto").addEventListener("click", () => {
    fecharDialogo("dialogo-menu");
    abrirFoto("eu");
  });
  $("foto-escolher").addEventListener("click", () => $("foto-arquivo").click());
  $("foto-arquivo").addEventListener("change", quandoEscolherArquivo);
  $("foto-tirar").addEventListener("click", tirarFotoEmEdicao);
  $("foto-salvar").addEventListener("click", salvarFoto);
  $("dialogo-foto").addEventListener("close", () => {
    estado.fotoEmEdicao = null;
  });

  // Grupos
  $("menu-entrar-codigo").addEventListener("click", () => {
    fecharDialogo("dialogo-menu");
    abrirEntrarComCodigo();
  });
  $("menu-criar").addEventListener("click", () => {
    fecharDialogo("dialogo-menu");
    abrirCriarGrupo();
  });
  $("inicio-entrar-codigo").addEventListener("click", abrirEntrarComCodigo);
  $("inicio-criar").addEventListener("click", abrirCriarGrupo);
  $("form-criar").addEventListener("submit", criarGrupo);
  $("form-codigo").addEventListener("submit", buscarGrupoPeloCodigo);
  $("botao-pedir").addEventListener("click", pedirParaEntrar);
  $("botao-cancelar-pedido").addEventListener("click", () => cancelarPedido(estado.grupoEmEspera));
  $("seletor-grupo").addEventListener("change", (evento) => abrirGrupo(evento.target.value));
  $("botao-codigo").addEventListener("click", () => mostrarCodigoDoGrupo(grupoAtual()));
  $("botao-copiar").addEventListener("click", copiarCodigo);
  $("botao-compartilhar").addEventListener("click", compartilharCodigo);
  $("botao-membros").addEventListener("click", abrirMembros);
  $("botao-pedidos").addEventListener("click", abrirPedidos);
  $("botao-sair-grupo").addEventListener("click", sairDoGrupo); // (novo)
  $("botao-apagar-grupo").addEventListener("click", apagarGrupo); // (novo)

  // Voltou pra aba do site na tela inicial: confere de novo os pedidos enviados.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && estado.usuario && !$("tela-inicio").hidden) desenharPendentes();
  });

  // Calendário e itens
  $("mes-anterior").addEventListener("click", () => mudarMes(-1));
  $("mes-seguinte").addEventListener("click", () => mudarMes(1));
  $("botao-hoje").addEventListener("click", () => irParaDia(hojeISO()));
  $("botao-adicionar").addEventListener("click", abrirNovoItem);
  $("form-item").addEventListener("submit", salvarItem);

  // Setas do teclado andam pelos dias do calendário.
  $("grade").addEventListener("keydown", (evento) => {
    const passos = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[evento.key];
    if (!passos) return;
    evento.preventDefault();
    irParaDia(somarDias(estado.diaSelecionado, passos), true);
  });

  // Botões com data-fechar fecham a janela em que estão.
  document.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-fechar]");
    if (botao) botao.closest("dialog")?.close();
  });
  // Clicar no fundo escuro, fora da janela, também fecha.
  // (Janelas com formulário não fecham assim, pra ninguém perder o que digitou sem querer.)
  for (const janela of document.querySelectorAll("dialog")) {
    janela.addEventListener("click", (evento) => {
      if (evento.target === janela && !janela.querySelector("input, textarea")) janela.close();
    });
  }
}

function iniciar() {
  desenharFolhaDecorativa();
  ligarEventos();

  // Sem a configuração do Firebase não dá pra entrar:
  // mostra o aviso na tela de login e para por aqui.
  if (problemaNaConfiguracao) {
    const aviso = $("nota-config");
    aviso.textContent = AVISOS_DE_CONFIGURACAO[problemaNaConfiguracao];
    aviso.hidden = false;
    $("botao-entrar").disabled = true;
    mostrarTela("tela-login");
    return;
  }

  // Daqui pra frente, quem escolhe a tela é o login:
  // o Firebase chama quandoAContaMudar agora e sempre que alguém entrar ou sair.
  onAuthStateChanged(auth, quandoAContaMudar);
}

iniciar();
