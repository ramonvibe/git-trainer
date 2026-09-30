# GitQuest

Treinamento interativo de Git em uma SPA estática, sem dependências ou build.

## Rodar o MVP

```bash
cd git-trainer
npm start
```

Abra `http://localhost:8080`.

Cada colega cria seu próprio acesso com nome e senha. O servidor salva usuários, progresso, ranking e comentários em `data.json` (esse arquivo não deve ser publicado nem versionado).

## Publicar

Suba a pasta em um servidor com Node.js e execute `npm start`. Para manter os dados durante reinícios, faça backup do `data.json`.

Se abrir apenas o `index.html`, a interface continua funcionando como demo local, mas login e ranking compartilhado só funcionam pelo `npm start`.
