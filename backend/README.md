# Backend — API Essencial Cosméticos

API REST em Node.js + Express com banco SQLite.

```bash
npm install
cp .env.example .env    # preencha o JWT_SECRET
npm run dev             # http://localhost:3000/api
npm test                # testes de integração
npm run seed:demo       # dados de exemplo (só em banco sem produtos)
```

## Organização

| Pasta | Responsabilidade |
| --- | --- |
| `routes/` | Define os endpoints e quem pode acessar (`authenticate`, `authorizeRoles`) |
| `controllers/` | Lê `req` e devolve `res`. Não tem regra de negócio |
| `services/` | Regras de negócio e validações |
| `repositories/` | Consultas SQL |
| `middlewares/` | JWT, permissão por perfil e tratamento de erros |
| `database/` | `schema.sql`, seed de usuários e seed de demonstração |
| `shared/` | `AppError`, validações, datas, perfis e paginação |

Erros esperados (validação, permissão, regra de negócio) são lançados como `AppError` e chegam ao cliente assim:

```json
{ "error": "Estoque insuficiente para Batom Matte (disponível: 1).", "code": "INSUFFICIENT_STOCK" }
```

Qualquer outro erro é registrado no console e devolvido como `500`.

## Autenticação

`POST /api/auth/login` com `{ "email", "password" }` devolve `{ token, user }`. As demais rotas exigem o header `Authorization: Bearer <token>`. O token expira em 8 horas.

## Endpoints

Todas as rotas começam com `/api`. **Admin** = só o perfil ADMIN.

### Produtos e estoque

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/products?search=` | Todos | Lista produtos (funcionário não recebe `purchase_price`) |
| GET | `/products/:id` | Todos | Detalhe do produto |
| POST | `/products` | Admin | Cadastra produto |
| PUT | `/products/:id` | Admin | Atualiza os campos enviados |
| DELETE | `/products/:id` | Admin | Exclui (`409` se já tiver vendas/movimentações) |
| POST | `/products/:id/stock/entry` | Todos | Entrada de estoque `{ quantity }` |
| POST | `/products/:id/stock/adjustment` | Todos | Ajuste positivo ou negativo `{ quantity }` |
| GET | `/stock/alerts/minimum` | Todos | Produtos no estoque mínimo ou abaixo |
| GET | `/stock/alerts/expiration?days=30` | Todos | Produtos que vencem nos próximos dias |
| GET | `/stock/replenishment?threshold=5` | Todos | Lista de reposição com quantidade sugerida |
| GET | `/stock/replenishment/pdf` | Todos | Lista de reposição em PDF |
| POST / DELETE | `/stock/replenishment/:id/dismiss` | Todos | Tira / devolve um produto da lista de reposição |

### Vendas (comandas)

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/sales` | Abre comanda `{ client_name }` |
| GET | `/sales/:id` | Comanda com itens |
| POST | `/sales/:id/items` | Adiciona item `{ product_id, quantity }` |
| DELETE | `/sales/:id/items/:itemId` | Remove item |
| POST | `/sales/:id/finalize` | Finaliza `{ payment_method, discount_percent?, amount_received? }` |
| POST | `/sales/:id/cancel` | Cancela comanda aberta |
| POST | `/sales/:id/settle` | Quita venda a prazo `{ payment_method, amount_received? }` |
| GET | `/sales/open/list` | Comandas abertas |
| GET | `/sales/pending/list` | Vendas a prazo não pagas |
| GET | `/sales/history/finalized?page=1&limit=20` | Histórico paginado |

Funcionário só enxerga e altera as vendas que ele mesmo abriu.

### Caixa e relatórios

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/cash/summary/daily?date=AAAA-MM-DD` | Todos | Resumo do dia (lucro só para admin) |
| GET | `/cash/closure?date=` | Todos | Se o caixa do dia está fechado |
| POST | `/cash/close` | Todos | Fecha o caixa de hoje |
| POST | `/cash/reopen` | Admin | Reabre o caixa de hoje |
| GET | `/dashboard/monthly?year=&month=` | Admin | Indicadores do mês e comparação com o anterior |
| GET | `/reports/monthly/pdf?year=&month=` | Admin | Relatório mensal em PDF |

### Usuários e backup

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/users?page=&limit=` | Todos | Admin vê todos; funcionário vê só o próprio cadastro |
| POST | `/users` | Admin | Cadastra `{ name, email, password, role }` |
| PUT | `/users/:id` | Todos | Funcionário só edita o próprio cadastro e não muda o perfil |
| DELETE | `/users/:id` | Admin | Exclui (não permite excluir o último admin nem a si mesmo) |
| GET | `/backup/status` | Admin | Horário e pasta do backup automático |
| POST | `/backup/manual` | Admin | Gera um backup agora |

## Regras de negócio

- Desconto máximo de 50% por venda.
- Só comandas abertas podem ser alteradas, finalizadas ou canceladas.
- Pagamento em dinheiro exige o valor recebido e calcula o troco.
- A finalização roda em uma transação: se faltar estoque de um item, nada é baixado.
- Venda a prazo baixa o estoque ao finalizar e entra no caixa quando é quitada.
- Com o caixa do dia fechado, não é possível abrir, finalizar ou quitar vendas.
- O sistema sempre mantém pelo menos um administrador.

## Variáveis de ambiente

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `3000` | Porta da API |
| `JWT_SECRET` | — | Obrigatória. Segredo para assinar os tokens |
| `BACKUP_AUTO_HOUR` / `BACKUP_AUTO_MINUTE` | `7` / `30` | Horário do backup automático |
| `BACKUP_DIRECTORY` | `backend/backups` | Pasta dos backups (pode ser uma pasta do Google Drive) |
| `DATABASE_DIR` | `backend/database` | Pasta do banco (o Electron usa a pasta de dados do usuário) |
