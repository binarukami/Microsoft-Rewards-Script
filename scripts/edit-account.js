#!/usr/bin/env node
/**
 * Script para editar contas existentes
 * Permite modificar email, senha, proxy e set
 */

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PROJECT_ROOT = process.cwd();
const ACCOUNTS_FILE = path.join(PROJECT_ROOT, 'src', 'accounts.json');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function log(msg) { console.log(msg); }
function error(msg) { console.error(`\x1b[31m${msg}\x1b[0m`); }
function success(msg) { console.log(`\x1b[32m${msg}\x1b[0m`); }
function info(msg) { console.log(`\x1b[36m${msg}\x1b[0m`); }
function warn(msg) { console.log(`\x1b[33m${msg}\x1b[0m`); }
function bold(msg) { return `\x1b[1m${msg}\x1b[0m`; }

/**
 * Limpa o terminal
 */
function clearScreen() {
  process.stdout.write('\x1Bc');
}

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

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

function getAvailableSets(accounts) {
  const sets = new Set();
  accounts.forEach(acc => {
    if (acc.set) sets.add(acc.set);
  });
  return Array.from(sets).sort();
}

function countAccountsInSet(accounts, setName) {
  return accounts.filter(acc => acc.set === setName).length;
}

async function selectAccount(accounts) {
  clearScreen();
  log('\n' + '='.repeat(60));
  log(bold('  Selecionar Conta para Editar'));
  log('='.repeat(60) + '\n');
  
  accounts.forEach((acc, idx) => {
    const hasProxy = acc.proxy && acc.proxy.url ? '🔒' : '🔓';
    log(`  ${chalk.cyan(`[${acc.set || 'sem-set'}]`)} ${idx + 1}) ${hasProxy} ${acc.email}`);
  });
  
  log('');
  const choice = await prompt('Escolha o número da conta: ');
  const index = parseInt(choice) - 1;
  
  if (isNaN(index) || index < 0 || index >= accounts.length) {
    error('Escolha inválida!');
    return null;
  }
  
  return index;
}

async function editMenu(account, accounts, accountIndex) {
  clearScreen();
  log('\n' + '='.repeat(60));
  log(bold(`  Editando: ${account.email}`));
  log('='.repeat(60) + '\n');
  
  log('O que deseja editar?');
  log('  1) Email');
  log('  2) Senha');
  log('  3) Set');
  log('  4) Proxy');
  log('  5) Remover proxy');
  log('  6) Ver detalhes');
  log('  0) Voltar');
  log('');
  
  const choice = await prompt('Escolha uma opção: ');
  
  switch (choice) {
    case '1':
      return await editEmail(account, accounts);
    case '2':
      return await editPassword(account);
    case '3':
      return await editSet(account, accounts, accountIndex);
    case '4':
      return await editProxy(account);
    case '5':
      return await removeProxy(account);
    case '6':
      displayAccountDetails(account);
      return await editMenu(account, accounts, accountIndex);
    case '0':
      return null;
    default:
      error('\nOpção inválida!');
      return await editMenu(account, accounts, accountIndex);
  }
}

async function editEmail(account, accounts) {
  const oldEmail = account.email;
  log(`\nEmail atual: ${bold(oldEmail)}`);
  
  const newEmail = await prompt('Novo email (Enter para cancelar): ');
  if (!newEmail) {
    info('Operação cancelada.');
    return null;
  }
  
  // Validar email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    error('Email inválido!');
    return null;
  }
  
  // Verificar se já existe
  if (accounts.some(acc => acc.email.toLowerCase() === newEmail.toLowerCase() && acc.email !== oldEmail)) {
    error('Este email já está cadastrado!');
    return null;
  }
  
  account.email = newEmail;
  success(`✓ Email atualizado: ${oldEmail} → ${newEmail}`);
  return true;
}

async function editPassword(account) {
  log('\nSenha atual: ' + '*'.repeat(account.password.length));
  
  const newPassword = await prompt('Nova senha (Enter para cancelar): ');
  if (!newPassword) {
    info('Operação cancelada.');
    return null;
  }
  
  if (newPassword.length < 6) {
    error('Senha deve ter pelo menos 6 caracteres!');
    return null;
  }
  
  account.password = newPassword;
  success('✓ Senha atualizada!');
  return true;
}

async function editSet(account, accounts, accountIndex) {
  const currentSet = account.set || 'sem-set';
  log(`\nSet atual: ${bold(currentSet)}`);
  
  const availableSets = getAvailableSets(accounts);
  
  log('\nSets disponíveis:');
  availableSets.forEach((set, idx) => {
    const count = countAccountsInSet(accounts, set);
    const isCurrent = set === currentSet;
    const marker = isCurrent ? '→' : ' ';
    const status = count >= 6 ? warn('[6/6 COMPLETO]') : success(`[${count}/6]`);
    log(`  ${marker} ${idx + 1}) ${set} ${status}`);
  });
  log(`    ${availableSets.length + 1}) Criar novo set`);
  log('');
  
  const choice = await prompt('Escolha o set (Enter para cancelar): ');
  if (!choice) {
    info('Operação cancelada.');
    return null;
  }
  
  const index = parseInt(choice) - 1;
  let newSet;
  
  if (index === availableSets.length) {
    // Criar novo set
    newSet = await prompt('Nome do novo set: ');
    if (!newSet || !/^[a-zA-Z0-9_-]+$/.test(newSet)) {
      error('Nome do set inválido!');
      return null;
    }
  } else if (index >= 0 && index < availableSets.length) {
    newSet = availableSets[index];
  } else {
    error('Escolha inválida!');
    return null;
  }
  
  // Verificar limite do set destino (não contar a conta atual)
  const targetSetCount = accounts.filter((acc, idx) => 
    acc.set === newSet && idx !== accountIndex
  ).length;
  
  if (targetSetCount >= 6) {
    error(`Set "${newSet}" já possui 6 contas (limite máximo)!`);
    return null;
  }
  
  account.set = newSet;
  success(`✓ Set atualizado: ${currentSet} → ${newSet}`);
  return true;
}

async function editProxy(account) {
  log('\n--- Configuração de Proxy ---\n');
  
  if (account.proxy && account.proxy.url) {
    log(`Proxy atual: ${account.proxy.url}:${account.proxy.port}`);
    log('');
  }
  
  const url = await prompt('URL do proxy: ');
  if (!url) {
    info('Operação cancelada.');
    return null;
  }
  
  const port = await prompt('Porta: ');
  const username = await prompt('Username (opcional): ');
  const password = await prompt('Senha (opcional): ');
  
  account.proxy = {
    proxyAxios: true,
    url: url,
    port: parseInt(port) || 0,
    username: username || '',
    password: password || ''
  };
  
  success('✓ Proxy configurado!');
  return true;
}

async function removeProxy(account) {
  if (!account.proxy || !account.proxy.url) {
    info('Esta conta não possui proxy configurado.');
    return null;
  }
  
  const confirm = await prompt('Confirma remoção do proxy? (s/n): ');
  if (confirm.toLowerCase() !== 's') {
    info('Operação cancelada.');
    return null;
  }
  
  account.proxy = {
    proxyAxios: true,
    url: '',
    port: 0,
    username: '',
    password: ''
  };
  
  success('✓ Proxy removido!');
  return true;
}

function displayAccountDetails(account) {
  log('\n' + '─'.repeat(60));
  log(bold('Detalhes da Conta:'));
  log('─'.repeat(60));
  log(`Email:    ${account.email}`);
  log(`Senha:    ${'*'.repeat(account.password.length)}`);
  log(`Set:      ${account.set || '(não definido)'}`);
  
  if (account.proxy && account.proxy.url) {
    log(`Proxy:    ${account.proxy.url}:${account.proxy.port}`);
    if (account.proxy.username) {
      log(`Proxy User: ${account.proxy.username}`);
    }
  } else {
    log(`Proxy:    Não configurado`);
  }
  log('─'.repeat(60));
}

async function main() {
  clearScreen();
  log('\n' + '═'.repeat(60));
  log(bold('           GERENCIADOR DE CONTAS - EDIÇÃO'));
  log('═'.repeat(60));
  
  const accounts = loadAccounts();
  
  if (accounts.length === 0) {
    warn('\nNenhuma conta encontrada!');
    info('Use: npm run add-account para adicionar contas.\n');
    rl.close();
    process.exit(0);
  }
  
  const accountIndex = await selectAccount(accounts);
  if (accountIndex === null) {
    rl.close();
    process.exit(0);
  }
  
  const account = accounts[accountIndex];
  let modified = false;
  
  while (true) {
    const result = await editMenu(account, accounts, accountIndex);
    
    if (result === null) {
      break;
    }
    
    if (result === true) {
      modified = true;
    }
  }
  
  if (modified) {
    log('');
    const save = await prompt('Salvar alterações? (s/n): ');
    
    if (save.toLowerCase() === 's') {
      if (saveAccounts(accounts)) {
        success('\n✓ Alterações salvas com sucesso!');
      } else {
        error('\n✗ Falha ao salvar alterações.');
      }
    } else {
      warn('\nAlterações descartadas.');
    }
  } else {
    info('\nNenhuma alteração foi feita.');
  }
  
  info('\nRetornando ao menu principal...');
  rl.close();
}

process.on('SIGINT', () => {
  log('\n\nOperação cancelada.');
  rl.close();
  process.exit(1);
});

main().catch(err => {
  error(`\nErro: ${err.message}`);
  rl.close();
  process.exit(1);
});
