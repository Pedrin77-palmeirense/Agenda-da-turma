# Agenda da Turma

A agenda de provas, trabalhos e tarefas da turma, num site só. Quem organiza marca, todo mundo vê.

Esta é a parte 4, a versão completa. O site já faz tudo isto:

- login com a conta Google, e a pessoa continua logada até clicar em "Sair da conta";
- grupos com código: quem digita o código pede pra entrar, e um admin aprova ou recusa;
- a agenda de cada grupo fica no banco de dados, e o que um admin marca aparece na hora pra todo mundo do grupo;
- admins tornam outras pessoas admin, tiram pessoas do grupo e podem apagar o grupo;
- qualquer pessoa pode sair do grupo, mas o grupo nunca fica sem admin;
- cada pessoa pode trocar a própria foto, e admins trocam a foto do grupo;
- o site funciona no computador e no celular, no tema claro (caderno quadriculado) e no escuro (lousa).

## O que mudou desde a parte 3

- `index.html`, `public/app.js` e `public/style.css` mudaram. O `index.html` agora fica fora da pasta `public`. No `app.js`, o que é novo está marcado com "(novo)".
- `firestore.rules` mudou. **É preciso publicar as regras novas (passo 4)**, senão a agenda, as fotos e os botões de membros não funcionam.
- `firebase.json` é novo. Ele diz ao Firebase o que publicar quando o site for pro ar (passo 6).
- `LEIAME.md` é este arquivo.

**Esta pasta vem sem o `firebase-config.js`, de propósito, pra não apagar o seu.** Copie o seu (o que você preencheu na parte 2) da pasta antiga pra dentro da `public` desta. Se esquecer, o site avisa na tela de login.

## Os arquivos

```
agenda-da-turma/
  index.html           as telas e as janelas (é este que você abre)
  firebase.json        o que publicar no Firebase Hosting
  firestore.rules      as regras de segurança do banco
  LEIAME.md            este arquivo
  public/              o resto do que vai pro navegador
    style.css          a aparência
    app.js             o que o site faz
    firebase-config.js a configuração do seu projeto (é você que coloca)
```

O `index.html` fica direto na pasta `agenda-da-turma`, fora da `public`. Por isso ele chama `public/style.css` e `public/app.js`, e o `firebase.json` publica a pasta toda, deixando de fora só o `firebase.json`, o `firestore.rules` e este LEIAME.

## Como o banco está organizado

```
codigos/{código}             qual grupo tem esse código (o id e o nome)
grupos/{id}                  nome, série, escola, código, foto, membros,
                             admins e o nome e a foto do Google de cada membro
grupos/{id}/pedidos/{uid}    pedido pra entrar (o id é o uid de quem pediu)
grupos/{id}/itens/{id}       o que está marcado na agenda
usuarios/{uid}               a foto que a pessoa escolheu no site
```

## Passos 1 e 2: projeto no Firebase e login com Google

Se o login já funciona, pule pro passo 3. Se não, com o responsável (o projeto fica na conta dele):

1. Em [console.firebase.google.com](https://console.firebase.google.com), criem um projeto e adicionem um app da Web (ícone `</>`).
2. Copiem as linhas de dentro das chaves do `firebaseConfig` que aparece e colem no lugar das linhas com `COLE_AQUI` do `public/firebase-config.js` (o modelo está na pasta da parte 2).
3. No menu da esquerda, abram Segurança > Authentication, cliquem em Vamos começar e, na aba Método de login, ativem o Google.

O passo a passo com mais detalhes está no LEIAME da parte 2.

## Passo 3: banco de dados

Se já criaram o banco na parte 3, pule este passo. Se não:

1. No menu da esquerda do console, abram Firestore (fica em Databases & Storage) e cliquem em Criar banco de dados.
2. Se perguntar a edição, escolham a Standard. No local, `southamerica-east1 (São Paulo)`.
3. Escolham o **modo de produção**. Nunca o modo de teste: ele deixa qualquer pessoa da internet ler e apagar tudo.

## Passo 4: publicar as regras novas

1. No Firestore, abram a aba Regras e apaguem tudo o que estiver lá.
2. No VS Code, abram o `firestore.rules` desta pasta, copiem tudo e colem no console.
3. Cliquem em Publicar.

Toda vez que o `firestore.rules` mudar, é preciso colar e publicar de novo.

## Passo 5: testar no seu computador

1. Rode o `index.html` (o que fica direto na pasta `agenda-da-turma`) com o Live Server e troque `127.0.0.1` por `localhost` na barra de endereço.
2. Entre com a sua conta numa janela normal e com outra conta numa janela anônima (Ctrl+Shift+N no Chrome).
3. Na sua conta, crie um grupo e marque uma prova. Na outra, entre com o código e peça pra entrar. Aprove.
4. A prova aparece na outra janela. Marque mais uma coisa e veja chegar na hora, sem recarregar.
5. Teste também: trocar a sua foto, trocar a foto do grupo (clicando nela), tornar a outra conta admin e tirar ela do grupo.

## Passo 6: colocar o site no ar

O Firebase Hosting publica o site num endereço como `https://agenda-da-turma-1a2b3.web.app`, no plano gratuito. Façam com o responsável, porque o login do terminal é com a conta dona do projeto.

1. Instalem o Node.js, versão LTS, pelo [nodejs.org](https://nodejs.org).
2. No VS Code, abram a pasta `agenda-da-turma` (a que tem o `firebase.json`) e abram um terminal em Terminal > Novo terminal.
3. Instalem a ferramenta do Firebase (no Mac, se der erro de permissão, coloquem `sudo ` na frente e digitem a senha do computador):
   ```
   npm install -g firebase-tools
   ```
4. Entrem com a conta do responsável (abre o navegador). Se perguntar sobre enviar informações de uso, pode responder `n`:
   ```
   firebase login
   ```
5. Publiquem, trocando `SEU-ID` pelo `projectId` que está no seu `firebase-config.js`:
   ```
   firebase deploy --only hosting --project SEU-ID
   ```
6. No fim aparece o endereço do site (Hosting URL). Abram, entrem e confiram se está tudo lá.

Toda vez que mudar o código, é só rodar o comando do item 5 de novo.

Pra turma: mande o endereço do site e o código do grupo. No celular, dá pra deixar o site com cara de app: no Chrome, menu ⋮ > Adicionar à tela inicial; no Safari, botão de compartilhar > Adicionar à Tela de Início.

## As fotos

- A foto é cortada num quadrado de 160 x 160 pixels e vira um JPEG pequeno, de uns 10 mil caracteres, tudo no próprio navegador. A foto original não sai do aparelho.
- Ela fica guardada no banco (Firestore), e não no Cloud Storage do Firebase, porque o Storage exige o plano pago desde 2024.
- A sua foto aparece pra quem está nos seus grupos. A do grupo, pra quem é do grupo.
- "Tirar foto" apaga a foto do banco. Sem foto escolhida, o site usa a do Google (ou a primeira letra do nome).

## O que as regras protegem

- Só quem é membro vê o grupo e a agenda.
- Quem tem o código vê só o nome do grupo. Ninguém consegue listar os códigos que existem.
- Só entra quem pediu, e só um admin aprova. O nome e a foto que aparecem no pedido são os da própria pessoa.
- Só admins marcam e apagam coisas na agenda, tiram pessoas, mudam quem é admin, trocam a foto do grupo e apagam o grupo.
- O grupo nunca fica sem admin.
- Ninguém troca a foto de outra pessoa, e as fotos só entram no formato que o site faz, com tamanho limitado.

Esconder um botão no app não protege nada, porque qualquer pessoa pode mexer no código que roda no próprio navegador. Quem protege de verdade é o `firestore.rules`, que roda no servidor do Google.

## Pra quem é admin

- Só aprove quem você conhece da turma. Se não reconhecer o nome e a foto, recuse.
- Passe o código só pra turma.
- Se alguém usar o grupo pra zoar outra pessoa (com a foto, por exemplo), tire a pessoa do grupo e conte pra um adulto.

## Problemas comuns

**"O banco não deixou fazer isso".** Quase sempre são as regras antigas da parte 3. Publique as regras desta pasta (passo 4).

**"O banco de dados ainda não foi criado no Firebase".** Faltou o passo 3.

**"Não consegui ler o arquivo public/firebase-config.js".** Copie o seu `firebase-config.js` pra pasta `public` desta parte.

**"Não consegui abrir essa imagem".** Alguns computadores não abrem fotos HEIC, o formato do iPhone. Use uma foto JPG ou PNG, ou troque a foto pelo próprio iPhone.

**`firebase` não é reconhecido como comando.** O Node.js não foi instalado, ou o terminal foi aberto antes da instalação. Feche o VS Code, abra de novo e tente outra vez.

**No Windows, o terminal diz que a execução de scripts foi desabilitada.** No terminal do VS Code, clique na setinha ao lado do `+` e escolha Command Prompt. Rode os comandos nele.

**O deploy diz que não achou o projeto.** Confira o `SEU-ID` (é o `projectId` do `firebase-config.js`) e se o `firebase login` foi feito com a conta dona do projeto.

**No site publicado, o login não funciona quando o link é aberto de dentro do Instagram ou do WhatsApp.** O Google bloqueia login dentro desses apps. Abra o link no Chrome ou no Safari.

**Mudei o código, publiquei e nada mudou.** Recarregue sem cache: Ctrl+Shift+R (no Mac, Cmd+Shift+R).

**"O limite gratuito do Firebase de hoje acabou".** O plano gratuito tem um limite de leituras e gravações por dia. No dia seguinte volta.

## Pra continuar (desafios)

Do mais fácil pro mais difícil:

1. **Mostrar quem marcou cada item.** Todo item tem `criadoPor` (o uid). O nome está em `membrosInfo` do grupo.
2. **Lista "próximos 7 dias"** em cima do calendário, com o que vem por aí. Dica: `somarDias` e uma busca com `where("data", ">=", ...)` e `where("data", "<=", ...)`, igual à do mês.
3. **Editar um item.** As regras já deixam (admins, sem mudar `criadoPor` nem `criadoEm`): falta a tela e um `updateDoc`.
4. **Mudar o nome, a série e a escola do grupo.** Precisa de uma regra nova no `firestore.rules` e de atualizar o nome em `codigos` junto, num lote.
5. **Apagar a conta.** Sair de todos os grupos, apagar `usuarios/{uid}` e depois usar o `deleteUser` do Firebase Auth.
6. **Lembrete na véspera da prova.** É o mais difícil: precisa de Cloud Functions, que exige o plano pago, e no iPhone a notificação só funciona com o site adicionado à tela inicial.
