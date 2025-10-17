#!/usr/bin/env node
/**
 * Script para adicionar contas ao arquivo accounts.json
 * Limita a 6 contas por set e permite criar novos sets
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PROJECT_ROOT = process.cwd();
const ACCOUNTS_FILE = path.join(PROJECT_ROOT, 'src', 'accounts.json');

// Criar interface para leitura de input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function log(msg) { console.log(msg); }
function error(msg) { console.error(`\x1b[31m${msg}\x1b[0m`); }
function success(msg) { console.log(`\x1b[32m${msg}\x1b[0m`); }
function info(msg) { console.log(`\x1b[36m${msg}\x1b[0m`); }
function warn(msg) { console.log(`\x1b[33m${msg}\x1b[0m`); }

/**
 * Limpa o terminal
 */
function clearScreen() {
  process.stdout.write('\x1Bc');
}

/**
 * Promessa para ler input do usuário
 */
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Lê o arquivo de contas
 */
function loadAccounts() {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    error(`Erro ao ler arquivo de contas: ${err.message}`);
    return [];
  }
}

/**
 * Salva o arquivo de contas
 */
function saveAccounts(accounts) {
  try {
    const data = JSON.stringify(accounts, null, 4);
    fs.writeFileSync(ACCOUNTS_FILE, data, 'utf8');
    return true;
  } catch (err) {
    error(`Erro ao salvar arquivo de contas: ${err.message}`);
    return false;
  }
}

/**
 * Conta contas por set
 */
function countAccountsBySet(accounts) {
  const count = {};
  accounts.forEach(account => {
    if (account.set) {
      count[account.set] = (count[account.set] || 0) + 1;
    }
  });
  return count;
}

/**
 * Obtém lista de sets únicos
 */
function getAvailableSets(accounts) {
  const sets = new Set();
  accounts.forEach(account => {
    if (account.set) {
      sets.add(account.set);
    }
  });
  return Array.from(sets).sort();
}

/**
 * Valida email
 */
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Verifica se email já existe
 */
function emailExists(accounts, email) {
  return accounts.some(account => account.email.toLowerCase() === email.toLowerCase());
}

/**
 * Seleciona ou cria um set
 */
async function selectOrCreateSet(accounts) {
  const existingSets = getAvailableSets(accounts);
  const setCount = countAccountsBySet(accounts);

  clearScreen();
  log('\n====================================');
  log('  Selecionar ou Criar Set');
  log('====================================\n');

  if (existingSets.length > 0) {
    log('Sets existentes:');
    existingSets.forEach((set, index) => {
      const count = setCount[set] || 0;
      const available = 6 - count;
      const status = available > 0 ? `\x1b[32m${available} vaga(s) disponível(is)\x1b[0m` : `\x1b[31mLotado\x1b[0m`;
      log(`  ${index + 1}) ${set} - ${count}/6 contas (${status})`);
    });
    log(`  ${existingSets.length + 1}) Criar novo set`);
    log(`  0) Voltar ao menu principal`);
  } else {
    info('Nenhum set existe ainda. Você criará o primeiro set.');
    return await createNewSet();
  }

  log('');
  const choice = await prompt('Escolha uma opção: ');
  const choiceNum = parseInt(choice);
  
  // Opção de voltar
  if (choiceNum === 0) {
    info('\nVoltando ao menu principal...');
    rl.close();
    process.exit(0);
  }

  if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > existingSets.length + 1) {
    error('Opção inválida!');
    return null;
  }

  if (choiceNum === existingSets.length + 1) {
    return await createNewSet();
  }

  const selectedSet = existingSets[choiceNum - 1];
  const currentCount = setCount[selectedSet] || 0;

  if (currentCount >= 6) {
    error(`\nO set "${selectedSet}" já possui 6 contas (limite máximo)!`);
    warn('Escolha outro set ou crie um novo.\n');
    return await selectOrCreateSet(accounts);
  }

  return selectedSet;
}

/**
 * Cria um novo set
 */
async function createNewSet() {
  log('');
  const setName = await prompt('Digite o nome do novo set: ');
  
  if (!setName || setName.length === 0) {
    error('Nome do set não pode ser vazio!');
    return await createNewSet();
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(setName)) {
    error('Nome do set deve conter apenas letras, números, hífen ou underscore!');
    return await createNewSet();
  }

  success(`✓ Novo set "${setName}" será criado`);
  return setName;
}

/**
 * Coleta dados da nova conta
 */
async function collectAccountData(setName) {
  clearScreen();
  log('\n====================================');
  log('  Dados da Nova Conta');
  log('====================================\n');
  info(`Set: ${setName}`);
  info('Digite "0" a qualquer momento para cancelar\n');

  // Email
  let email;
  while (true) {
    email = await prompt('Email: ');
    if (email === '0') {
      info('\nOperação cancelada. Voltando ao menu principal...');
      rl.close();
      process.exit(0);
    }
    if (!email) {
      error('Email não pode ser vazio!');
      continue;
    }
    if (!isValidEmail(email)) {
      error('Email inválido!');
      continue;
    }
    break;
  }

  // Senha
  let password;
  while (true) {
    password = await prompt('Senha: ');
    if (password === '0') {
      info('\nOperação cancelada. Voltando ao menu principal...');
      rl.close();
      process.exit(0);
    }
    if (!password) {
      error('Senha não pode ser vazia!');
      continue;
    }
    if (password.length < 6) {
      error('Senha deve ter pelo menos 6 caracteres!');
      continue;
    }
    break;
  }

  // Proxy (opcional)
  log('\n--- Configuração de Proxy (opcional) ---');
  info('Pressione Enter para pular se não usar proxy\n');

  const useProxy = await prompt('Deseja configurar proxy? (s/n) [n]: ');
  
  let proxyConfig = {
    proxyAxios: true,
    url: '',
    port: 0,
    username: '',
    password: ''
  };

  if (useProxy.toLowerCase() === 's' || useProxy.toLowerCase() === 'sim') {
    const proxyUrl = await prompt('URL do proxy: ');
    const proxyPort = await prompt('Porta do proxy: ');
    const proxyUsername = await prompt('Username do proxy (opcional): ');
    const proxyPassword = await prompt('Senha do proxy (opcional): ');

    if (proxyUrl && proxyPort) {
      proxyConfig = {
        proxyAxios: true,
        url: proxyUrl,
        port: parseInt(proxyPort) || 0,
        username: proxyUsername || '',
        password: proxyPassword || ''
      };
    }
  }

  return {
    email,
    password,
    proxy: proxyConfig,
    set: setName
  };
}

/**
 * Exibe resumo da conta
 */
function displayAccountSummary(account) {
  clearScreen();
  log('\n====================================');
  log('  Resumo da Conta');
  log('====================================\n');
  log(`Email:    ${account.email}`);
  log(`Senha:    ${'*'.repeat(account.password.length)}`);
  log(`Set:      ${account.set}`);
  
  if (account.proxy.url) {
    log(`Proxy:    ${account.proxy.url}:${account.proxy.port}`);
  } else {
    log(`Proxy:    Não configurado`);
  }
  log('');
}

/**
 * Função principal
 */
async function main() {
  clearScreen();
  log('\n====================================');
  log('  Adicionar Nova Conta');
  log('====================================\n');

  const accounts = loadAccounts();
  
  // Selecionar ou criar set
  const setName = await selectOrCreateSet(accounts);
  
  if (!setName) {
    error('\nOperação cancelada.');
    rl.close();
    process.exit(1);
  }

  // Coletar dados da conta
  const newAccount = await collectAccountData(setName);

  // Verificar se email já existe
  if (emailExists(accounts, newAccount.email)) {
    error(`\nErro: O email "${newAccount.email}" já está cadastrado!`);
    rl.close();
    process.exit(1);
  }

  // Exibir resumo
  displayAccountSummary(newAccount);

  // Confirmar
  const confirm = await prompt('Deseja adicionar esta conta? (s/n/0=cancelar): ');
  
  if (confirm === '0') {
    info('\nOperação cancelada. Voltando ao menu principal...');
    rl.close();
    process.exit(0);
  }
  
  if (confirm.toLowerCase() !== 's' && confirm.toLowerCase() !== 'sim') {
    warn('\nOperação cancelada. Voltando ao menu principal...');
    rl.close();
    process.exit(0);
  }

  // Adicionar conta
  accounts.push(newAccount);

  // Salvar
  if (saveAccounts(accounts)) {
    success('\n✓ Conta adicionada com sucesso!');
    
    const setCount = countAccountsBySet(accounts);
    const currentCount = setCount[setName];
    const remaining = 6 - currentCount;
    
    info(`\nSet "${setName}": ${currentCount}/6 contas`);
    if (remaining > 0) {
      info(`Ainda é possível adicionar ${remaining} conta(s) neste set.`);
    } else {
      warn(`Set "${setName}" está completo (6/6 contas).`);
    }

    // Perguntar se quer adicionar outra conta
    log('');
    const addAnother = await prompt('Deseja adicionar outra conta? (s/n): ');
    
    if (addAnother.toLowerCase() === 's' || addAnother.toLowerCase() === 'sim') {
      rl.close();
      // Reiniciar o script
      const { spawn } = require('child_process');
      const child = spawn(process.argv[0], [process.argv[1]], {
        stdio: 'inherit',
        cwd: PROJECT_ROOT
      });
      child.on('exit', (code) => process.exit(code));
      return;
    }
    
    info('\nRetornando ao menu principal...');
  } else {
    error('\n✗ Falha ao salvar a conta.');
  }

  rl.close();
}

// Tratar Ctrl+C
process.on('SIGINT', () => {
  log('\n\nOperação cancelada pelo usuário.');
  rl.close();
  process.exit(1);
});

// Executar
main().catch(err => {
  error(`\nErro: ${err.message}`);
  rl.close();
  process.exit(1);
});
