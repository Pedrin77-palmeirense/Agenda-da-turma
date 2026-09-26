// =====================================================================
//  Configuração do Firebase
// =====================================================================
//  Aqui vão os dados do SEU projeto no Firebase (passo 1 do LEIAME).
//
//  Como colar sem quebrar o arquivo:
//   1. No console do Firebase, copie só as linhas de DENTRO das chaves,
//      da linha do apiKey até a linha do appId.
//   2. Aqui embaixo, selecione as linhas que têm COLE_AQUI e cole por cima.
//   3. A primeira linha (export const firebaseConfig = {) e a última (};)
//      continuam aqui, do jeito que estão.
//
//  Não cole o código inteiro que o Firebase mostra (aquele com "import" e
//  "initializeApp"). Essa parte já está pronta no app.js.
//
//  Essas chaves NÃO são senha: elas só dizem ao site qual projeto usar,
//  e qualquer pessoa consegue vê-las abrindo o código de um site.
//  Quem protege os dados de verdade são as regras de segurança do banco
//  de dados, que chegam na parte 3.
// =====================================================================

export const firebaseConfig = {
  apiKey: "AIzaSyAuMVVfPAMCcQ_3j9-hWnfJ6MuENgenEc8",
  authDomain: "agenda-da-turma.firebaseapp.com",
  projectId: "agenda-da-turma",
  storageBucket: "agenda-da-turma.firebasestorage.app",
  messagingSenderId: "273356875061",
  appId: "1:273356875061:web:44d422d5f338d6ae5f187c"
};
