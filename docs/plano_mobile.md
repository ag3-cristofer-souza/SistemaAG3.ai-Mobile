# Plano — AG3 Mobile

Versão 3, 06/11/2026. Caminhos de código são relativos aos repositórios `SistemaAG3.ai-Backend-Django` e
`SistemaAG3.ai-Frontend`.

**Estado:** Ondas 1 a 4 commitadas (a 4 só mudou o app). Faltam o teste contra o Django local e os testes em aparelho real
(seção 9), inclusive áudio como nota de voz na Meta e na Wafly.

## 1. Resumo

- **O quê:** um webapp instalável (PWA) para celular, em `mobile.ag3system.com`. O operador atende as conversas dele e o
  gestor acompanha a operação à distância. O papel do usuário define as abas, e as duas visões chegam juntas.
- **Como:** React + Vite + TypeScript, a mesma base do painel, consumindo a API e o WebSocket da **produção atual em
  Django**. Notificações pelo Firebase Cloud Messaging (FCM), no celular e no navegador do computador.
- **No backend:** sessões independentes por login, tela de usuários online no Django Admin, visibilidade do operador
  garantida no servidor, notificações, proteção contra envio duplicado e números "agora" para o gestor.
- **Onde está o esforço:** o maior volume é o front. O maior risco está nos ajustes do backend que tocam login e acesso
  em produção, e nas notificações e no áudio do iPhone.
- **Cuidado principal:** o app não terá homologação própria da API, então os testes acontecem em produção. A seção 7.1 e
  as etapas de liberação em 8.1 e 8.3 existem por isso.
- **Prazo:** 11 a 15 semanas para uma pessoa em tempo integral. É estimativa grosseira, a ser revista depois da Onda 0.

## 2. Decisões já tomadas (06/11)

| Tema | Decisão |
|---|---|
| Formato | Webapp instalável, não app de loja. Sem contas Apple/Google, sem revisão de loja, atualização imediata |
| Notificações | FCM, no webapp instalado e no navegador. **Quem gerencia o Firebase é o Django**: credenciais, aparelhos, o que enviar e quando |
| Sessões | Independentes: sair em um lugar não derruba os outros. O usuário é o mesmo |
| Controle | Tela no Django Admin: quantos usuários estão online, quais e em quais sistemas |
| Visibilidade | No app, o operador tem o mesmo acesso de hoje no painel, agora garantido pelo servidor (regra em 8.3) |
| Áudio | Vai como áudio do WhatsApp. Transcrição fica fora daqui; se vier, é no servidor depois de receber |
| Visões | Operador e gestor são igualmente necessários e aparecem juntos desde a primeira entrega |
| Backend | Todo o consumo aponta para a produção atual em Django |
| Domínio | `mobile.ag3system.com`, a ser criado pelo Daniel durante o projeto |
| Identidade | Globo, marca AG3.AI e abertura da landing (`LP-AG3`); fundo azul-marinho `#12224e`, a cor `--chip` do site, e ícones em fundo branco, como no site |
| Hospedagem do webapp | Hostinger ou Railway, a definir pelo Daniel. O plano funciona nas duas (7.1) |

## 3. O que já dá para aproveitar

| Necessidade | Já existe | Observação |
|---|---|---|
| Login e 2FA | `POST /auth/login`, `/auth/login/mfa` | Ganha um campo opcional de sistema |
| Empresa ativa | `X-Company-Id` + `GET /users/workspaces` | 403 = sem vínculo com a empresa |
| Conversas e mensagens | `GET /conversations`, `/counts`, `/messages`, `send-message`, `mark-read` | No app, pedir 30 conversas por página (padrão: 500) e deduplicar mensagens por `id` |
| Ações | `assign`, `transfer`, `hold`, `resume`, `finish`, `return-to-queue`, `notes` | Reuso direto |
| Mídia | `POST /conversations/{id}/media` | Reuso direto |
| Tempo real | `src/lib/realtime.ts` | Já reconecta ao voltar para a tela e sincroniza o que perdeu |
| Gravação de áudio | `src/hooks/inbox/useAudioRecorder.ts` | Já gera ogg/opus no navegador, sem conversão no servidor (testar no iPhone) |
| Player de áudio | `components/ui/whatsapp-audio.tsx` | Testar ogg no iPhone |
| Números por período | `/dashboard/overview`, `/metrics/attendance`, `/metrics/whatsapp-performance` | O escopo por papel é aplicado no servidor |
| Carga da equipe | `GET /conversations/team-capacity` | Só gestor/admin |
| SLA e origem | `/reports/entries/sla`, `/reports/marketing/visao` | Reuso direto |
| Interface | shadcn, Tailwind, recharts, react-virtuoso | Copiar o subconjunto usado e redesenhar as telas para celular |

## 4. O que precisa mudar no backend

| # | Tema | Situação hoje | Evidência |
|---|---|---|---|
| B1 | Sessões | Um token por usuário: sair em um lugar derruba todos | `apps/accounts/services/tokens.py`, `LogoutView` |
| B2 | Usuários online | Não existe; `user_profiles.status` é o estado da conta, não presença | `apps/accounts/models.py` |
| B3 | Visibilidade | A regra está só na tela; API e WebSocket entregam conversas de toda a empresa ao operador | Ver 4.1 |
| B4 | Notificações | Não há FCM nem nada equivalente | Busca em `apps/`, `geon/` e `requirements*.txt` |
| B5 | Envio | `send-message` sem proteção contra repetição | `SendMessageSerializer` |
| B6 | Números agora | Não há endpoint único do momento para o gestor | `/metrics/*` trabalha por período |

Ajuste simples, de configuração: o WebSocket só aceita conexões de sites autorizados. O domínio novo entra na lista
`ALLOWED_ORIGINS`, que também vale para a API.

### 4.1 O que o operador vê hoje no painel

| Caminho | Comportamento | Restrito ao operador? |
|---|---|---|
| Abas Pendentes, Minhas, Em espera, Finalizadas | Filtra pelo operador, mas **quem filtra é a tela** (`useConversationPanel.ts`) | Só na tela |
| Abas IA e Todas | Vazias para operador | Só na tela |
| Aba Grupos | Filtra pelo canal selecionado (compartilhado ou atribuído a ele) e, se ele tiver squad, pelo squad do lead; grupo não é distribuído a um operador | Só na tela |
| Filtro "Cards sem dono" | Disponível a todos; para o operador, restringe a lista dele, sem incluir conversas de outros | Só na tela |
| Board | Mostra os cards dele e os sem dono (`views_produtos.visible`) e permite assumir | Sim, no servidor |
| Link com `conversationId`, telefone ou lead | Abre qualquer conversa da empresa (`useAttendancePanelContext.ts`) | Não |
| `GET /conversations` e `GET /conversations/{id}` | Só conferem a empresa (`_conv`, `apply_list_filters`) | Não |
| `GET /conversations/{id}/messages` | Nem usa `_conv`; sem mensagens, busca pelo lead e por outras conversas do mesmo número | Não |
| WebSocket | `conversations` e `messages` vão para todos da empresa, com o texto da mensagem (`apps/realtime/visibility.py`) | Não |

Ou seja: o operador comum vê só o dele nas abas principais, mas quem tiver o token consegue ler tudo pela API, e o
navegador dele já recebe o texto das mensagens da empresa inteira, mesmo sem mostrar.

## 5. Produto

### Operador

- **Conversas:** abas Pendentes, Minhas, Em espera, Grupos e Finalizadas, com não lidas e busca, seguindo a regra de 8.3.
- **Chat:** texto, resposta citada, foto, câmera, documento, áudio, notas internas e status de entrega.
- **Ações:** assumir, transferir, colocar em espera, finalizar e devolver à fila, respeitando o limite de conversas
  simultâneas.
- **Notificações:** conversa atribuída ou transferida e nova mensagem nas conversas dele.
- **Conta:** trocar empresa, perfil, preferências de notificação, "não incomodar" e sair.

### Gestor

| Aba | Conteúdo | Atualização |
|---|---|---|
| **Agora** | Fila sem dono e maior espera, em atendimento, em espera, com IA, operadores online e carga de cada um, canais desconectados | Até ~15 s de atraso, com "atualizado há X s" |
| **Hoje** | Novos atendimentos, espera média, transferências, qualificações da IA e leads por hora, comparados com a mesma hora de 7 dias atrás | Até ~1 min |
| **Equipe** | Desempenho por operador; toque abre as conversas dele | Até ~1 min |
| **Comercial** | Funil, conversões, origem e SLA, com seletor de período; custos para quem já pode vê-los | Ao abrir e ao puxar |
| **Conversas** | Mesmas telas do operador, com a visão da empresa | Tempo real |

Alertas para o gestor, com limites configuráveis: fila sem dono acima de X minutos e canal desconectado.

Os totais vêm dos endpoints do painel, para o celular e o painel web não divergirem.

### Fora da primeira versão

Board de CRM, assistentes de IA, cadência, campanhas, ligações, configurações, envio offline em fila, transcrição de
áudio e visão consolidada de várias empresas.

## 6. Stack

### Front-end

| Função | Tecnologia | Motivo |
|---|---|---|
| Base | Vite 8 + React 18 + TypeScript 5 | Mesma base do painel, o que permite copiar hooks e componentes |
| Instalável e offline | `vite-plugin-pwa` (Workbox) | Gera manifesto e service worker, com espaço para o código das notificações |
| Notificações | `@firebase/app` + `@firebase/messaging` | Atende ao FCM sem carregar o Firebase inteiro, nem o Firestore e o gRPC que ele traz |
| Dados da API | TanStack Query + axios, com cache em memória | Cache, paginação e nova busca após reconexão, como no painel |
| Tempo real | WebSocket nativo, a partir de `lib/realtime.ts` | Já reconecta e sincroniza |
| Rotas | React Router 7 | Abre a conversa a partir da notificação. O painel está na 6, que tem alerta de redirecionamento aberto |
| Interface | Tailwind + shadcn/Radix + `vaul` | Mesma identidade visual, com painéis deslizantes de celular |
| Lista do chat | `react-virtuoso` | Aguenta conversas longas, e o painel já usa |
| Gráficos | Recharts | Já usado no painel; números muito dinâmicos podem ser só cards |
| Áudio | `opus-media-recorder` | Já grava em ogg; precisa de teste no iPhone |
| Validação | Zod na fronteira da API | Pega resposta inesperada antes de quebrar a tela |
| Testes | Vitest + Testing Library + Playwright | Playwright simula tela de celular, mas não substitui aparelho real |
| Erros em campo | Sentry, sem corpo de mensagem | Mostra falhas que só acontecem nos celulares |

**Não usar agora:**

- **Next.js:** o app fica todo atrás de login, então renderizar no servidor não traz ganho.
- **React Native ou Flutter:** jogariam fora o reaproveitamento do painel.
- **Capacitor:** só se as notificações no iPhone não funcionarem bem.
- **Redux ou Zustand:** quase todo o estado vem da API; TanStack Query e estado local devem bastar no início.

### Backend

Continua em Django, DRF, Channels, Celery e Redis. Nenhuma dependência nova: o envio ao FCM usa `httpx` e `cryptography`,
que já estão nas imagens, sem `firebase-admin`.

### Limites do formato (confirmar em aparelho na Onda 0)

| Tema | Android | iPhone |
|---|---|---|
| Notificação | Navegador ou instalado | **Só instalado na tela de início**, iOS 16.4 ou superior, com permissão pedida por toque |
| Instalação | Convite do Chrome | Manual, por Compartilhar → Adicionar à Tela de Início; o app precisa ensinar o passo a passo |
| Sessão | — | O login feito no Safari pode não passar para o instalado; orientar a instalar antes de entrar |
| Com a tela fechada | Sem conexão; o aviso vem por notificação | Igual |
| Gravar e tocar ogg | Esperado funcionar | Testar os dois |

**Saída se o iPhone não atender:** empacotar o mesmo código com Capacitor. O código e o FCM continuam valendo, mas aí
volta a existir conta e revisão de loja.

## 7. Arquitetura do app

```
src/api/          cliente HTTP, schemas, um módulo por domínio
src/realtime/     conexão única (a partir de lib/realtime.ts)
src/features/     auth, workspace, shell, conversas, gestor, conta, install, diagnostics
src/ui/           componentes
src/lib/          sessão, papéis, instalação, notificações, áudio
src/sw.ts         service worker: arquivos do app + notificações
```

- **Código compartilhado:** copiar do painel o que serve e adaptar. Um pacote comum só compensa se as cópias começarem a
  divergir.
- **Dados pessoais:** o service worker guarda só os arquivos do app, nunca respostas da API. Ao sair ou perder acesso à
  empresa, limpa tudo.
- **Dashboard:** busca o snapshot ao abrir e usa eventos de conversa como sinal para buscar de novo, no máximo a cada
  15 s. Sem WebSocket, consulta a cada 30 s. Com a tela fechada, não busca nada.
- **Envio:** gera um id por mensagem e mostra a bolha na hora. Em erro de rede, repete com o mesmo id. Erro de negócio,
  como a janela de 24 h da Meta, mostra o texto do backend e não repete.

### 7.1 Hospedagem e produção

O webapp são arquivos estáticos em uma imagem com nginx, igual ao `ag3-front`: a URL da API entra por variável quando o
container sobe (`docker/40-geon-runtime-config.sh`). A mesma imagem serve para as duas hospedagens, com workflow próprio
no repositório do app.

| | Hostinger (k3s atual) | Railway |
|---|---|---|
| Implantação | Deployment e ingress, como `k8s/base/front.yaml`; manifests aplicados antes do deploy | Serviço Docker, com nginx escutando em `$PORT` |
| Custo | Sem custo novo | Cobrança própria |
| Operação | Mesmo cluster e runbook do resto | Painel e deploy à parte |
| Se a VPS cair | App e API caem juntos | O app abre, mas sem API também não funciona |

**Recomendação: Hostinger.** Com uma API única, a Railway não traz ganho de disponibilidade e adiciona mais um lugar para
operar. Nas duas, `sw.js` precisa ir sem cache na borda.

**Decisão do Daniel (06/11): Railway**, com `mobile.ag3system.com` em nuvem laranja na Cloudflare, que exige o modo SSL **Full**.
A imagem foi conferida localmente com `PORT=8080`. Variáveis: `PORT`, `VITE_API_URL` e `VITE_REALTIME_URL`.

**Endereços:** API em `https://api.ag3system.com` e WebSocket em `wss://api.ag3system.com/ws/realtime`, como em
`k8s/base/front.yaml` (confirmado pelo Daniel).

**O que muda por não haver homologação da API:**

- Testes em produção só com **empresa, usuários e canal de teste**. Nenhuma mensagem real sai para cliente antes do
  piloto.
- Desenvolvimento local contra o Django local: a API de produção recusa `localhost` e URLs de preview, pois só aceita as
  origens de `ALLOWED_ORIGINS`.
- Mudanças do backend só aditivas, atrás de configuração quando tocam login ou visibilidade, e aplicadas pela esteira.
- Toda mudança precisa manter o painel web funcionando sem alteração, porque ele usa o mesmo backend.

## 8. Mudanças no backend, em detalhe

Tudo segue o `CLAUDE.md` do backend: `ContractAPIView`, contratos alterados à mão no mesmo commit, escrita por gateway,
provedores mockados nos testes, migration pela esteira e compatível com a versão no ar. Cada onda fecha com um adendo no
plano, a partir da letra **(hb)**.

### 8.1 Sessões independentes (B1)

- Tabela nova `user_sessions`: usuário, hash do token, sistema (`painel` ou `mobile`), aparelho ou navegador, IP,
  última empresa, `last_seen_at`, `expires_at`, `revoked_at` e motivo.
- `POST /auth/login` e `/auth/login/mfa` aceitam um campo opcional `client`. Sem ele, o sistema é `painel`, então o
  front atual funciona sem mudança. O formato da resposta não muda.
- `GeonTokenAuthentication` e `RealtimeConsumer._decode` passam a aceitar a sessão nova, sem deixar de aceitar os tokens
  atuais de `authtoken_token`.
- `last_seen_at` grava no máximo uma vez por minuto por sessão, com controle no Redis.

**Liberação em duas etapas, porque o login é de produção:**

1. Só logins com `client: mobile` criam sessão nova. O painel segue como está, e o app já fica independente dele.
2. Depois de validado, uma configuração liga sessões novas também para o painel. Os tokens antigos valem até expirar, e
   só então o código legado sai.

A tabela abaixo vale para as sessões novas: até a etapa 2, os logins do painel continuam com o token único de hoje.

| Evento | O que cai |
|---|---|
| Sair | Só aquela sessão |
| Trocar a própria senha | As outras; a atual segue com token novo |
| Senha redefinida, usuário inativado ou removido | Todas |
| Admin derruba | A sessão escolhida ou todas |

Rotas novas: `GET /auth/sessions` e `DELETE /auth/sessions/{id}`, para a pessoa ver e encerrar as próprias. Tarefa
periódica apaga sessões vencidas há mais de 90 dias.

### 8.2 Usuários online no Django Admin (B2)

**O que conta como online:** atividade nos últimos 2 minutos, por requisição ou `ping` do WebSocket (25 s). Grava
`last_seen_at` em `user_sessions` no máximo uma vez por minuto, com o limite no cache. Como depende do tempo, um pod que
morre não deixa ninguém "online" para sempre.

Tela em "Clientes & Usuários", no padrão de `apps/sysconfig/admin.py` e `GeonModelAdmin`:

- **Totais:** usuários únicos online, sessões abertas, por sistema e por empresa.
- **Lista:** usuário, empresa, sistema, aparelho ou navegador, última atividade e IP, com filtros.
- **Ação:** derrubar sessão.
- **Histórico:** sessões anteriores no cadastro da tabela.

Limitações: com o webapp fechado, a conexão cai e a pessoa aparece offline, mesmo recebendo notificações. Até a etapa 2
de 8.1, o painel aparece por usuário, sem detalhar aparelho ou navegador. A mesma presença alimenta "operadores online"
na aba Agora.

### 8.3 Visibilidade do operador (B3)

Regra: o que o operador já tem hoje no painel, agora aplicado pelo servidor em uma função única. Gestor e admin
continuam vendo a empresa.

| Caso | Condição | Aparece em |
|---|---|---|
| **A. Dele** | `assigned_agent_id` igual ao usuário | Listas e abertura direta |
| **B. Grupo** | Grupo em canal compartilhado ou atribuído a ele; se ele tiver squad, o lead precisa ser do squad | Aba Grupos e abertura direta |
| **C. Pelo lead** | Lead atribuído a ele, ou lead com card aberto dele ou sem dono | **Só abertura direta**, a partir de um lead ou card |

**Conversa sem dono:** não entra nas listas do operador, como hoje. Só abre pelo caso C, e é por esse caminho que ele a
assume.

**Diferença consciente em relação ao painel:** hoje um link com `conversationId` abre qualquer conversa da empresa. No
app, conversa fora dos três casos responde 404, inclusive por link.

- **API:** verificação na base de `ConversationAPIView` e `MessageAPIView`, mais `GET /conversations` (A e B) e
  `/counts`. Teste de guarda para toda rota nova de conversa respeitar a regra.
- **`/messages`:** o desvio para mensagens do lead ou do mesmo número passa a respeitar a regra.
- **WebSocket:**
  - `conversations` e `conversation_assignments`: inteiros nas dele; ao ser transferida, vira remoção da lista;
  - grupos: só um aviso com o id, e o app consulta a API, que aplica a regra;
  - demais conversas: nada é enviado;
  - `messages`: só da conversa aberta na tela, pela mensagem nova `{"type": "focus", "conversation_id": …}`, com
    permissão conferida na hora e retirada se ele perder o acesso.
- **Quem liga:** o servidor, pela sessão. O cliente não pode escolher ver mais.
  - Sessões `mobile`: sempre.
  - Sessões `painel`: sem a regra até a decisão D1. A configuração prevista aqui não foi criada: a mudança será em
    `scope_for` (`apps/messaging/services/visibility.py`).
- **Feito na Onda 2 (adendo hd):** `messages` só pelo foco vale para toda sessão do app, inclusive gestor, para não gastar
  dados com o texto da empresa inteira.

### 8.4 Notificações (B4)

**Toda a gestão fica no Django.** O webapp não tem chave nem configuração do Firebase: ele pede a permissão, busca a
configuração pública, registra o token e exibe o que chegar.

**Parte 1: configuração, aparelhos e teste (na Onda 1)**

- Tela "Notificações (Firebase)" no Django Admin, no padrão das telas de e-mail e Wafly em `apps/sysconfig/admin.py`:
  liga e desliga, configuração web, chave VAPID e conta de serviço. Tudo em `system_settings`, com a conta de serviço
  cifrada por `SYSTEM_SETTINGS_KEY`, sem voltar para tela nem log.
- `GET /push/config`: a parte pública da configuração, para usuário autenticado.
- `POST` e `DELETE /push/devices`: registra e remove o token do aparelho, ligado à sessão. Sair da sessão apaga o registro.
- Admin: lista de aparelhos por usuário e sistema, com "Enviar notificação de teste".
- Novo app `apps/push`, com `services/`, `tasks.py`, `schedules.py` e `consumers.py`. Envio pela API HTTP v1 do FCM, com
  `httpx`, com o JWT da conta de serviço assinado por `cryptography`.
- Sem fila nesta parte: o teste do Admin envia direto, como o teste de e-mail.
- Token inválido devolvido pelo FCM desativa o aparelho na hora.

**Parte 2: disparos e preferências (na Onda 5)**

- Fila `push` e worker `celery-worker-push`, nos contratos e no k8s, conforme `test_k8s_workers.py`. Manifests antes do
  deploy.
- Disparo depois do commit, sem HTTP dentro de transação:
  - conversa atribuída ou transferida: `OperatorNotifications.notify_assignment`, que já é o ponto único;
  - nova mensagem do cliente em conversa com dono: `apps/messaging/services/inbound.py`, agrupando por conversa;
  - alertas do gestor: tarefa periódica no Beat.
- Preferências por usuário guardadas no Django, e histórico de envios no Admin, sem o conteúdo da mensagem.
- O painel web ganha um botão "Ativar notificações" com o mesmo mecanismo.
- Ganho futuro: pular o aviso pelo WhatsApp do sistema quando o operador tiver notificação ativa, reduzindo o risco de
  bloqueio desse número.

### 8.5 Proteção contra envio duplicado (B5)

Campo opcional `client_message_id` em `send-message`. Chave no Redis por empresa e id, com validade de 24 h: repetição
devolve a mensagem já criada, sem novo envio ao provedor. Não exige migration.

### 8.6 `GET /dashboard/live` (B6)

```json
{"data": {"as_of": "…",
          "queue": {"unassigned": 0, "oldest_wait_seconds": 0, "in_attendance": 0, "on_hold": 0, "with_ai": 0},
          "operators": [{"user_id": "…", "name": "…", "online": true, "systems": ["mobile"], "active": 0, "limit": 0}],
          "channels": {"connected": 0, "disconnected": []}}}
```

- Só gestor/admin. Snapshot por empresa no Redis, válido por ~10 s, com uma única reconstrução por vez. Advisory lock de
  sessão não serve, por causa do PgBouncer.
- **Feito na Onda 3 (adendo he):** além do previsto, `queue.pending` e, por operador, `in_attendance` e `on_hold`. `active`
  conta só as pendentes, como o limite de conversas do backend. A tela também consulta a cada 60 s com o WebSocket ligado,
  porque operador entrar ou canal cair não geram evento de conversa.
- Extrair a lógica de `TeamCapacityView` para um serviço compartilhado, em vez de duplicá-la.
- Conferir `EXPLAIN` com volume real antes de ligar.

## 9. Ondas

| Onda | Entrega | Pronto quando | Estimativa |
|---|---|---|---|
| **0. Testes em aparelho** | Repositório, `CLAUDE.md`, CI, imagem, tela de instalação | Em Android e iPhone físicos, em `mobile.ag3system.com` e com empresa de teste: instalar, entrar, WebSocket em produção, notificação FCM de teste, gravar e tocar ogg | 1 sem. |
| **1. Sessões, online e Firebase** | 8.1, etapa 1, 8.2 e 8.4, parte 1 | Sair no app não derruba o painel; a tela do Admin mostra quem está online e onde; o Admin envia uma notificação de teste a um aparelho | 2–3 sem. |
| **2. Regras do backend** | 8.3 e 8.5 | Teste prova que operador só lê os casos A, B e C por API e WebSocket; painel sem mudança | 1–2 sem. |
| **3. As duas visões, leitura** | Login, 2FA, troca de empresa, navegação por papel, 8.6, aba Agora, conversas e chat em leitura | Operador e gestor usam a própria visão; número igual ao do painel; sem mensagem perdida depois de trocar de rede ou voltar à tela | 2–3 sem. |
| **4. Chat: ação** | Envio, áudio, citação, ações, notas | Teste em rede ruim sem duplicidade; áudio chega como nota de voz na Meta e na Wafly | 2 sem. |
| **5. Notificações** | 8.4, parte 2, botão no painel web | Com o app fechado, a notificação abre a conversa certa; sair interrompe os avisos | 1–2 sem. |
| **6. Gestor completo** | Hoje, Equipe, Comercial, alertas | Totais iguais aos do painel no mesmo período | 1–2 sem. |
| **7. Piloto** | Revisão de segurança, ajustes, 8.1 etapa 2, empresa piloto | 2 semanas de uso real sem incidente grave | 1 sem. + piloto |

### O que falta para fechar a Onda 0

O código está pronto. Faltam os testes em aparelho, na tela **Testar este aparelho**:

| Teste | Depende de | Situação |
|---|---|---|
| Android com o backend local (`adb reverse`, ver README) | Android | Pode ser feito agora |
| Notificação remota | Projeto Firebase, que o Daniel está criando, cadastrado no Django (Onda 1) | Aguardando |
| Android em produção | `mobile.ag3system.com`, hospedagem e origem liberada (`deploy/vps/29_origem_mobile.sh`) | Aguardando |
| iPhone: notificação, gravar e tocar ogg | iPhone, previsto para breve, e HTTPS | Aguardando |

Empresa, gestor, operador e canal de teste em produção já existem.

**Risco enquanto não houver iPhone:** as ondas seguintes avançam sem a confirmação de que notificação e áudio funcionam
nele. Se falharem, as saídas estão na seção 12.

## 10. Segurança e LGPD

- Token no `localStorage`, como no painel, com CSP bloqueante desde o início (o painel ainda está em modo relatório).
- Sentry sem corpo de mensagem nem telefone.
- Notificação passa pelo Google e aparece na tela bloqueada: por padrão, sem o texto da mensagem (D2).
- IP e aparelho nas sessões são dados pessoais: visíveis só para admin, e apagados junto com a sessão.
- Revisar a política de privacidade com quem responde pela LGPD na empresa.

## 11. Testes e entrega

- **App:** Vitest e Testing Library no realtime, regras de abas, schemas e envio; Playwright nos fluxos principais.
- **Backend:** suíte atual, mais sessões, presença, visibilidade, idempotência e FCM mockado com `httpx.MockTransport`.
- **Rede real:** roteiro manual em 4G fraco, modo avião e troca de Wi-Fi em cada onda do chat.
- **Contrato entre repositórios:** verificação no CI de que todo path usado pelo app existe em
  `geon/contracts/http_routes.json`.
- **Ambiente:** o Node padrão desta máquina é o 16; o `.nvmrc` fixa o 22. Fora de `localhost`, o teste de notificação
  exige HTTPS.

## 12. Riscos

| Risco | Mitigação |
|---|---|
| Operador de iPhone não instalar e ficar sem notificação | Tela de instalação antes do login, com opção de continuar no navegador; aviso quando a permissão estiver desligada |
| Notificação web atrasar ou não chegar no iPhone | Medir na Onda 0 e no piloto; se falhar, empacotar com Capacitor |
| Teste em produção atingir cliente real | Só empresa e canal de teste até o piloto (7.1) |
| Sessões novas quebrarem o login do painel | Etapa 1 só para o app; o painel só muda na etapa 2 |
| Regra de visibilidade esconder ou expor conversa | Ligar primeiro só para `mobile`, com testes dos casos A, B e C; web em etapa própria (D1) |
| `opus-media-recorder` falhar no iPhone | Testar na Onda 0; se falhar, gravar com o `MediaRecorder` do navegador e converter para ogg no servidor com `ffmpeg` |
| Picos no painel causados pelos celulares | Snapshot em cache, intervalo mínimo e nada com a tela fechada |
| Login barrado em 4G, com IP compartilhado | O limite é de 20/min por IP; monitorar 429 no piloto |

## 13. Decisões pendentes

| # | Decisão | Recomendação |
|---|---|---|
| D1 | Aplicar a regra de 8.3 também no painel web | Sim, em etapa própria depois do piloto: fecha a API e o WebSocket, mas o link direto para conversa de outro deixa de abrir |
| D2 | Texto da notificação | Nome do contato + "Nova mensagem", sem o conteúdo |
| D3 | Validade da sessão no app | Expira após 30 dias sem uso; 2FA em cada aparelho novo, para quem tem 2FA ligado |
| D4 | Hospedagem do webapp | Hostinger, no k3s atual (7.1) |
