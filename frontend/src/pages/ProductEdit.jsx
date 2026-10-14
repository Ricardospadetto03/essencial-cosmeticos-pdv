import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { showToast } from "../utils/toast";
import { formatMoneyInput, parseMoneyInput, toMoneyInput } from "../utils/money";

function getErrorMessage(err, fallback) {
  return err?.response?.data?.error || fallback;
}

function ProductEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = location.state?.from || "/products";

  const [form, setForm] = useState({
    name: "",
    brand: "",
    size: "",
    purchase_price: "",
    sale_price: "",
    minimum_stock: "0",
    expiration_date: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      setLoading(true);
      try {
        const { data } = await api.get(`/products/${id}`);
        setForm({
          name: data.name || "",
          brand: data.brand || "",
          size: data.size || "",
          purchase_price: toMoneyInput(data.purchase_price),
          sale_price: toMoneyInput(data.sale_price),
          minimum_stock: String(data.minimum_stock ?? 0),
          expiration_date: data.expiration_date || "",
        });
      } catch (err) {
        showToast(getErrorMessage(err, "Falha ao carregar produto."), "error");
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [id]);

  function goBack() {
    // Voltando para o estoque, abre direto a aba de produtos.
    if (backTo === "/stock") {
      navigate("/stock", { state: { viewMode: "PRODUCTS" } });
      return;
    }
    navigate(backTo);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleMoneyChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: formatMoneyInput(value) }));
  }

  async function handleSave(event) {
    event.preventDefault();

    const purchasePrice = parseMoneyInput(form.purchase_price);
    const salePrice = parseMoneyInput(form.sale_price);
    if (!Number.isFinite(purchasePrice) || !Number.isFinite(salePrice)) {
      showToast("Informe preços válidos.", "error");
      return;
    }

    setSaving(true);
    try {
      await api.put(`/products/${id}`, {
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        size: form.size || null,
        purchase_price: purchasePrice,
        sale_price: salePrice,
        minimum_stock: Number(form.minimum_stock || 0),
        expiration_date: form.expiration_date || null,
      });
      showToast("Produto atualizado.", "success");
      goBack();
    } catch (err) {
      showToast(getErrorMessage(err, "Falha ao atualizar produto."), "error");
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Excluir o produto "${form.name}"? Essa ação não pode ser desfeita.`)) return;

    setSaving(true);
    try {
      await api.delete(`/products/${id}`);
      showToast("Produto excluído.", "success");
      goBack();
    } catch (err) {
      showToast(getErrorMessage(err, "Falha ao excluir produto."), "error");
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="state-message">Carregando produto...</p>;
  }

  return (
    <section>
      <h2>Editar Produto #{id}</h2>
      <p className="muted">
        O estoque não é alterado aqui: use Entrada ou Ajuste no módulo Estoque para manter o histórico.
      </p>

      <form className="inline-form section-card products-form" onSubmit={handleSave}>
        <h3>Dados do Produto</h3>
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
            onChange={handleMoneyChange}
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
            onChange={handleMoneyChange}
            required
          />
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
            Salvar alterações
          </button>
          <button type="button" className="btn-ghost" onClick={goBack} disabled={saving}>
            Voltar
          </button>
          <button type="button" className="btn-danger" onClick={handleDelete} disabled={saving}>
            Excluir produto
          </button>
        </div>
      </form>
    </section>
  );
}

export default ProductEdit;
