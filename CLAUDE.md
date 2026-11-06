# Instruções do projeto: AG3 Mobile

Webapp instalável (PWA) para celular: o operador atende as conversas dele e o gestor acompanha a operação. React + Vite +
TypeScript, consumindo a API e o WebSocket da produção em Django. Responda em português, curto.

**Plano e estado: `docs/plano_mobile.md`. Comece por ele.** Backend: `../SistemaAG3.ai-Backend-Django` (tem CLAUDE.md
próprio, que vale ao mexer lá). Painel web, de onde vêm os padrões: `../SistemaAG3.ai-Frontend`.

## O que você NUNCA faz

1. `git commit` ou `git push`: quem commita é o Daniel. `status`, `diff` e `log` pode.
2. Chamar a API de produção, Firebase ou qualquer provedor real. Testes usam API e WebSocket simulados.
3. Colocar segredo no repositório ou no navegador, ou configurar o Firebase aqui. **Quem gerencia o Firebase é o Django**:
   credenciais, aparelhos, o que enviar e quando. O app só pede a permissão, busca a configuração pública em
   `GET /push/config`, registra o token e exibe o que chegar.
4. Guardar resposta da API no service worker: são dados de clientes.
5. Chamar `POST /auth/logout` com token que não seja sessão própria (`ag3s_`): o token do painel é compartilhado, e isso
   derrubaria o painel web do usuário.

## O que pode rodar

Sempre com Node 22 (`nvm use`): `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`. Tudo simulado.

## Como se programa aqui

- Regra de acesso é do servidor. A navegação por papel só organiza a tela.
- Toda resposta da API passa por um schema Zod em `src/api/`.
- Mudança de backend: só aditiva, sem alterar o comportamento do painel web.
- `src/sw.ts` fica fino; a lógica vai em `src/sw-logic.ts`, com teste.
- Toda notificação recebida é exibida: o iPhone retira a permissão de quem recebe push sem mostrar nada.
- Alvo de toque com no mínimo 44 px, campo com 16 px (abaixo disso o iPhone dá zoom) e respeito à área segura.
- Testar comportamento de aparelho em aparelho real: `/diagnostico` existe para isso.

## Ciclo

código → verificações verdes → Daniel commita. Mudou o backend: ele roda a suíte de lá e aplica pela esteira.
