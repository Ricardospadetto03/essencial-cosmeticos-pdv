const userService = require('../services/userService');
const AppError = require('../shared/AppError');
const { ROLES } = require('../shared/roles');
const { parseId } = require('../shared/validation');
const { parsePagination, buildPaginatedResponse } = require('../shared/pagination');

async function createUser(req, res, next) {
  try {
    const user = await userService.createUser(req.body);
    return res.status(201).json(user);
  } catch (error) {
    return next(error);
  }
}

/**
 * Admin recebe a lista completa; funcionário recebe só o próprio cadastro.
 */
async function listUsers(req, res, next) {
  try {
    if (req.user.role !== ROLES.ADMIN) {
      const ownUser = await userService.getUserById(req.user.id);
      return res.json([ownUser]);
    }

    const pagination = parsePagination(req.query);
    const result = await userService.listUsers(pagination);

    if (pagination) {
      return res.json(buildPaginatedResponse(result.data, result.total, pagination));
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * Admin edita qualquer usuário. Funcionário só edita o próprio cadastro
 * e não pode mudar o próprio perfil.
 */
async function updateUser(req, res, next) {
  try {
    const targetUserId = parseId(req.params.id);

    if (req.user.role !== ROLES.ADMIN) {
      if (req.user.id !== targetUserId) {
        throw new AppError('Acesso negado.', 403, 'FORBIDDEN');
      }
      if (req.body?.role !== undefined) {
        throw new AppError('Você não pode alterar o próprio perfil.', 403, 'FORBIDDEN');
      }
    }

    const user = await userService.updateUser(targetUserId, req.body);
    return res.json(user);
  } catch (error) {
    return next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const targetUserId = parseId(req.params.id);

    if (req.user.id === targetUserId) {
      throw new AppError('Você não pode excluir o próprio usuário.', 400, 'CANNOT_DELETE_SELF');
    }

    const result = await userService.deleteUser(targetUserId);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createUser,
  listUsers,
  updateUser,
  deleteUser,
};
