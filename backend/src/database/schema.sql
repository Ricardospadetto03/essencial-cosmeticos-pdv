-- Schema do banco. Todos os comandos são idempotentes (IF NOT EXISTS),
-- então o arquivo roda em todo start da aplicação.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- hash bcrypt
  role TEXT CHECK(role IN ('ADMIN','FUNCIONARIO')) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  brand TEXT,
  size TEXT CHECK(size IN ('P','M','G','GG')),
  purchase_price REAL NOT NULL,
  sale_price REAL NOT NULL,
  stock INTEGER DEFAULT 0,
  minimum_stock INTEGER DEFAULT 0,
  expiration_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Uma venda começa como OPEN (comanda) e termina FINALIZED ou CANCELED.
-- Venda a PRAZO fica FINALIZED com settled_at nulo até ser quitada.
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  client_name TEXT,
  status TEXT CHECK(status IN ('OPEN','FINALIZED','CANCELED')) DEFAULT 'OPEN',
  discount_percent REAL DEFAULT 0 CHECK(discount_percent <= 50),
  payment_method TEXT CHECK(payment_method IN ('DINHEIRO','PIX','CARTAO','PRAZO')),
  total REAL DEFAULT 0,
  amount_received REAL,
  change_amount REAL DEFAULT 0,
  settled_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- purchase_price_snapshot guarda o custo do produto no momento da venda,
-- assim o lucro de vendas antigas não muda quando o custo é atualizado.
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  purchase_price_snapshot REAL NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Histórico de toda alteração de estoque. reference_id aponta para a venda
-- quando type = 'SALE'.
CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  type TEXT CHECK(type IN ('ENTRY','ADJUSTMENT','SALE')) NOT NULL,
  quantity INTEGER NOT NULL,
  reference_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Produtos que o usuário tirou manualmente da lista de reposição.
CREATE TABLE IF NOT EXISTS replenishment_exclusions (
  product_id INTEGER PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Fechamento de caixa: no máximo um por dia, com os totais congelados.
CREATE TABLE IF NOT EXISTS cash_closures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  closure_date DATE NOT NULL UNIQUE,
  total_sold REAL NOT NULL DEFAULT 0,
  sales_count INTEGER NOT NULL DEFAULT 0,
  by_payment_json TEXT NOT NULL DEFAULT '[]',
  closed_by_user_id INTEGER NOT NULL,
  closed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (closed_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);
