const bcrypt = require('bcrypt');
const userRepository = require('../repositories/userRepository');

const DEFAULT_USERS = [
  {
    name: 'Administrador',
    email: 'admin@essencial.com',
    password: 'admin123',
    role: 'ADMIN',
  },
  {
    name: 'Funcionário',
    email: 'funcionario@essencial.com',
    password: 'func123',
    role: 'FUNCIONARIO',
  },
];

/**
 * Cria os usuários padrão apenas na primeira execução (tabela vazia).
 * Depois disso o admin gerencia os usuários pela tela de Usuários.
 */
async function seedUsers() {
  if ((await userRepository.countUsers()) > 0) {
    return;
  }

  for (const user of DEFAULT_USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await userRepository.createUser({ ...user, password: passwordHash });
  }

  console.warn(
    'Usuários padrão criados (admin@essencial.com / funcionario@essencial.com). ' +
      'Troque as senhas no primeiro acesso.'
  );
}

module.exports = {
  seedUsers,
};
