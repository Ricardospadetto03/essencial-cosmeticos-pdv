const bcrypt = require('bcrypt');
const AppError = require('../shared/AppError');
const { ROLES, VALID_ROLES } = require('../shared/roles');
const { parseId, assertPayload } = require('../shared/validation');
const userRepository = require('../repositories/userRepository');

const MIN_PASSWORD_LENGTH = 6;
const BCRYPT_ROUNDS = 10;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateEmail(email) {
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
    throw new AppError('Email inválido.', 400, 'INVALID_EMAIL');
  }
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(
      `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      400,
      'INVALID_PASSWORD'
    );
  }
}

function validateRole(role) {
  if (!VALID_ROLES.includes(role)) {
    throw new AppError('Perfil inválido. Use ADMIN ou FUNCIONARIO.', 400, 'INVALID_ROLE');
  }
}

async function assertEmailIsAvailable(email, currentUserId) {
  const owner = await userRepository.findByEmail(email);
  if (owner && owner.id !== currentUserId) {
    throw new AppError('Este email já está cadastrado.', 409, 'EMAIL_ALREADY_EXISTS');
  }
}

async function findUserOrFail(id) {
  const user = await userRepository.findById(id);
  if (!user) {
    throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND');
  }
  return user;
}

/**
 * Impede que o sistema fique sem nenhum administrador.
 */
async function assertIsNotLastAdmin(user, message, code) {
  if (user.role !== ROLES.ADMIN) {
    return;
  }
  const adminCount = await userRepository.countByRole(ROLES.ADMIN);
  if (adminCount <= 1) {
    throw new AppError(message, 409, code);
  }
}

/**
 * @param {{ name: string, email: string, password: string, role: string }} payload
 */
async function createUser(payload) {
  assertPayload(payload);

  const name = String(payload.name || '').trim();
  const email = normalizeEmail(payload.email);

  if (!name) {
    throw new AppError('O nome é obrigatório.', 400, 'INVALID_NAME');
  }
  validateEmail(email);
  validatePassword(payload.password);
  validateRole(payload.role);
  await assertEmailIsAvailable(email);

  const passwordHash = await bcrypt.hash(payload.password, BCRYPT_ROUNDS);
  const { id } = await userRepository.createUser({
    name,
    email,
    password: passwordHash,
    role: payload.role,
  });

  return userRepository.findById(id);
}

async function getUserById(id) {
  return findUserOrFail(parseId(id));
}

/**
 * @param {{limit:number, offset:number}|null} pagination
 */
async function listUsers(pagination) {
  if (!pagination) {
    return userRepository.listUsers();
  }

  const [users, total] = await Promise.all([
    userRepository.listUsers(pagination),
    userRepository.countUsers(),
  ]);

  return { data: users, total };
}

/**
 * Atualiza apenas os campos enviados. A senha, se enviada, é salva como hash.
 */
async function updateUser(id, payload) {
  const userId = parseId(id);
  assertPayload(payload);
  const existingUser = await findUserOrFail(userId);

  const updateData = {};

  if (payload.name !== undefined) {
    const name = String(payload.name || '').trim();
    if (!name) {
      throw new AppError('O nome é obrigatório.', 400, 'INVALID_NAME');
    }
    updateData.name = name;
  }

  if (payload.email !== undefined) {
    const email = normalizeEmail(payload.email);
    validateEmail(email);
    await assertEmailIsAvailable(email, userId);
    updateData.email = email;
  }

  if (payload.role !== undefined) {
    validateRole(payload.role);
    if (payload.role !== ROLES.ADMIN) {
      await assertIsNotLastAdmin(
        existingUser,
        'Não é possível rebaixar o último administrador do sistema.',
        'LAST_ADMIN_DEMOTE_FORBIDDEN'
      );
    }
    updateData.role = payload.role;
  }

  // Senha vazia no formulário de edição significa "não alterar".
  if (payload.password) {
    validatePassword(payload.password);
    updateData.password = await bcrypt.hash(payload.password, BCRYPT_ROUNDS);
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError('Nenhum campo válido para atualização.', 400, 'NO_UPDATE_FIELDS');
  }

  await userRepository.updateUser(userId, updateData);
  return userRepository.findById(userId);
}

async function deleteUser(id) {
  const userId = parseId(id);
  const user = await findUserOrFail(userId);

  await assertIsNotLastAdmin(
    user,
    'Não é possível excluir o último administrador do sistema.',
    'LAST_ADMIN_DELETE_FORBIDDEN'
  );

  try {
    return await userRepository.deleteUser(userId);
  } catch (error) {
    // Vendas e fechamentos de caixa guardam quem fez a operação.
    if (String(error.message).includes('FOREIGN KEY constraint failed')) {
      throw new AppError(
        'Este usuário já registrou vendas ou fechamentos de caixa e não pode ser excluído.',
        409,
        'USER_IN_USE'
      );
    }
    throw error;
  }
}

module.exports = {
  createUser,
  getUserById,
  listUsers,
  updateUser,
  deleteUser,
};
