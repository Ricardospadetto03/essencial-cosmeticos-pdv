const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const AppError = require('../shared/AppError');
const { assertPayload } = require('../shared/validation');
const userRepository = require('../repositories/userRepository');

const TOKEN_EXPIRATION = '8h';

/**
 * Valida email e senha e devolve um JWT com o id e o perfil do usuário.
 * @param {{ email: string, password: string }} payload
 */
async function login(payload) {
  assertPayload(payload);

  const email = String(payload.email || '').trim().toLowerCase();
  const { password } = payload;

  if (!email || !password) {
    throw new AppError('Informe email e senha.', 400, 'VALIDATION_ERROR');
  }

  const user = await userRepository.findByEmail(email);
  // Mesma mensagem para email e senha errados, para não revelar quais
  // emails existem no sistema.
  const passwordMatches = user ? await bcrypt.compare(String(password), user.password) : false;

  if (!passwordMatches) {
    throw new AppError('Email ou senha incorretos.', 401, 'INVALID_CREDENTIALS');
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRATION,
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

module.exports = {
  login,
};
