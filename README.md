# AG3 Mobile

Webapp instalável para atendimento e acompanhamento da operação AG3. Plano e estado: [docs/plano_mobile.md](docs/plano_mobile.md).

## Rodar localmente

Precisa de Node 22 e do backend Django local (ver o README de lá). A API de produção recusa `localhost`.

```sh
nvm use
npm install
npm run dev        # http://localhost:3000
```

A porta 3000 já é aceita pelo CORS do Django em `APP_ENV=dev`. O `.env.development` espera a API em `localhost:8000` e o
realtime em `localhost:8070` (daphne + `manage.py realtime_bridge`).

## Testar no Android

Com o celular no USB e a depuração ligada, o `adb reverse` faz o celular enxergar a sua máquina como `localhost`. O
navegador trata `localhost` como seguro, então a instalação e as notificações funcionam sem HTTPS.

```sh
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8000 tcp:8000
adb reverse tcp:8070 tcp:8070
npm run dev
```

Abra `http://localhost:3000` no Chrome do celular e use **Testar este aparelho**, disponível no login e em Conta.

## Verificações

```sh
npm run lint
npm test
npm run build
npm run test:e2e   # usa o Chrome instalado; API e WebSocket são simulados
```

## Imagem

Configuração pública entra quando o container sobe. A mesma imagem serve para qualquer hospedagem:

```sh
docker build -t ag3-mobile .
docker run -p 8080:80 \
  -e VITE_API_URL=https://api.ag3system.com \
  -e VITE_REALTIME_URL=wss://api.ag3system.com/ws/realtime \
  ag3-mobile
```

Em produção, o app roda no cluster da Hostinger: cada push no `main` passa pelas verificações e implanta sozinho
(`.github/workflows/ci.yml`). Subida inicial: `docs/runbook_vps.md`, A7.17, no repositório do backend.

## Notificações

Quem gerencia o Firebase é o Django: credenciais, aparelhos e envios. O app não tem chave nem configuração própria. Ele
pede a permissão, busca a configuração pública em `GET /push/config`, registra o token no Django e exibe o que chegar.

## Ícones

`src/assets/` tem a marca copiada de `LP-AG3`. Se o globo mudar, rode `node scripts/gerar-icones.mjs`.
