import React, { useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { showToast } from "../utils/toast";
import PaginationControls from "../components/PaginationControls";

const USERS_PAGE_SIZE = 20;

const EMPTY_USER_FORM = {
  name: "",
  email: "",
  role: "FUNCIONARIO",
  password: "",
};

const ROLE_LABELS = {
  ADMIN: "Administrador",
  FUNCIONARIO: "Funcionário",
};

function getErrorMessage(err, fallback) {
  return err?.response?.data?.error || fallback;
}

function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // null = cadastrando um novo usuário; número = editando esse id.
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_USER_FORM);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const isEditing = editId !== null;

  async function loadUsers(targetPage = page) {
    setLoading(true);
    try {
      const { data } = await api.get("/users", {
        params: { page: targetPage, limit: USERS_PAGE_SIZE },
      });
      setUsers(data.data);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) {
      showToast(getErrorMessage(err, "Falha ao carregar usuários."), "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function startEdit(targetUser) {
    setEditId(targetUser.id);
    setForm({
      name: targetUser.name || "",
      email: targetUser.email || "",
      role: targetUser.role || "FUNCIONARIO",
      password: "",
    });
  }

  function resetForm() {
    setEditId(null);
    setForm(EMPTY_USER_FORM);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
    };
    if (form.password) {
      payload.password = form.password;
    }

    try {
      if (isEditing) {
        await api.put(`/users/${editId}`, payload);
        showToast("Usuário atualizado.", "success");
      } else {
        await api.post("/users", payload);
        showToast("Usuário cadastrado.", "success");
      }
      resetForm();
      await loadUsers();
    } catch (err) {
      showToast(getErrorMessage(err, "Falha ao salvar usuário."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteUser(targetUser) {
    if (!window.confirm(`Excluir o usuário ${targetUser.name}?`)) return;

    setSaving(true);
    try {
      await api.delete(`/users/${targetUser.id}`);
      showToast("Usuário excluído.", "success");
      if (editId === targetUser.id) resetForm();
      await loadUsers();
    } catch (err) {
      showToast(getErrorMessage(err, "Falha ao excluir usuário."), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2>Usuários</h2>
      <p className="muted">Cadastre quem pode acessar o sistema e defina o perfil de cada um.</p>

      <form className="inline-form section-card" onSubmit={handleSubmit}>
        <h3>{isEditing ? `Editar usuário #${editId}` : "Novo usuário"}</h3>
        <label>
          Nome
          <input name="name" value={form.name} onChange={handleFormChange} required />
        </label>
        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={handleFormChange} required />
        </label>
        <label>
          Perfil
          <select name="role" value={form.role} onChange={handleFormChange}>
            <option value="FUNCIONARIO">{ROLE_LABELS.FUNCIONARIO}</option>
            <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
          </select>
        </label>
        <label>
          {isEditing ? "Nova senha (opcional)" : "Senha"}
          <input
            name="password"
            type="password"
            minLength={6}
            value={form.password}
            onChange={handleFormChange}
            placeholder={isEditing ? "Deixe em branco para manter" : "Mínimo de 6 caracteres"}
            required={!isEditing}
          />
        </label>
        <div className="inline-row">
          <button className="btn-primary" type="submit" disabled={saving}>
            {isEditing ? "Salvar alterações" : "Cadastrar"}
          </button>
          {isEditing ? (
            <button className="btn-ghost" type="button" onClick={resetForm} disabled={saving}>
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      {loading ? (
        <p className="state-message">Carregando usuários...</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Email</th>
                <th>Perfil</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((currentUser) => (
                <tr key={currentUser.id}>
                  <td>{currentUser.id}</td>
                  <td>{currentUser.name}</td>
                  <td>{currentUser.email}</td>
                  <td>{ROLE_LABELS[currentUser.role] || currentUser.role}</td>
                  <td className="inline-actions">
                    <button
                      className="btn-ghost"
                      type="button"
                      onClick={() => startEdit(currentUser)}
                      disabled={saving}
                    >
                      Editar
                    </button>
                    <button
                      className="btn-danger"
                      type="button"
                      onClick={() => handleDeleteUser(currentUser)}
                      disabled={saving || currentUser.id === user?.id}
                      title={
                        currentUser.id === user?.id ? "Você não pode excluir o próprio usuário" : undefined
                      }
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaginationControls page={page} totalPages={totalPages} onPageChange={loadUsers} />
    </section>
  );
}

export default Users;
