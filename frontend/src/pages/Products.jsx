import React, { useState } from "react";
import api from "../services/api";
import { showToast } from "../utils/toast";
import { formatMoneyInput, parseMoneyInput } from "../utils/money";

const EMPTY_PRODUCT_FORM = {
  name: "",
  brand: "",
  size: "",
  purchase_price: "",
  sale_price: "",
  stock: "0",
  minimum_stock: "0",
  expiration_date: "",
};

function Products() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_PRODUCT_FORM);

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function resetForm() {
    setForm(EMPTY_PRODUCT_FORM);
  }

  async function handleSaveProduct(event) {
    event.preventDefault();

    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      size: form.size || null,
      purchase_price: parseMoneyInput(form.purchase_price),
      sale_price: parseMoneyInput(form.sale_price),
      stock: Number(form.stock || 0),
      minimum_stock: Number(form.minimum_stock || 0),
      expiration_date: form.expiration_date || null,
    };

    if (!Number.isFinite(payload.purchase_price) || !Number.isFinite(payload.sale_price)) {
      showToast("Informe preço de custo e preço de venda válidos.", "error");
      return;
    }

    setSaving(true);
    try {
      await api.post("/products", payload);
      showToast("Produto cadastrado.", "success");
      resetForm();
    } catch (err) {
      showToast(err?.response?.data?.error || "Falha ao cadastrar produto.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2>Produtos</h2>
      <p className="muted">Cadastro de produtos centralizado. Consulta e busca ficam no módulo Estoque.</p>

      <form className="inline-form section-card products-form" onSubmit={handleSaveProduct}>
        <h3>Cadastrar Produto</h3>
        <label>
          Nome
          <input name="name" value={form.name} onChange={handleFormChange} required />
        </label>
        <label>
          Marca
          <input name="brand" value={form.brand} onChange={handleFormChange} />
        </label>
        <label>
          Tamanho
          <select name="size" value={form.size} onChange={handleFormChange}>
            <option value="">Sem tamanho</option>
            <option value="P">P</option>
            <option value="M">M</option>
            <option value="G">G</option>
            <option value="GG">GG</option>
          </select>
        </label>
        <label>
          Preço de custo
          <input
            name="purchase_price"
            type="text"
            inputMode="numeric"
            placeholder="R$ 0,00"
            value={form.purchase_price}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, purchase_price: formatMoneyInput(event.target.value) }))
            }
            required
          />
        </label>
        <label>
          Preço de venda
          <input
            name="sale_price"
            type="text"
            inputMode="numeric"
            placeholder="R$ 0,00"
            value={form.sale_price}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, sale_price: formatMoneyInput(event.target.value) }))
            }
            required
          />
        </label>
        <label>
          Estoque inicial
          <input name="stock" type="number" min="0" value={form.stock} onChange={handleFormChange} />
        </label>
        <label>
          Estoque mínimo
          <input
            name="minimum_stock"
            type="number"
            min="0"
            value={form.minimum_stock}
            onChange={handleFormChange}
          />
        </label>
        <label>
          Validade
          <input
            name="expiration_date"
            type="date"
            value={form.expiration_date}
            onChange={handleFormChange}
          />
        </label>
        <div className="inline-row products-form-actions">
          <button className="btn-primary" type="submit" disabled={saving}>
            Cadastrar produto
          </button>
          <button type="button" className="btn-ghost" onClick={resetForm} disabled={saving}>
            Limpar formulário
          </button>
        </div>
      </form>
    </section>
  );
}

export default Products;
