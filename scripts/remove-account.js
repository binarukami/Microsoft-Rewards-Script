#!/usr/bin/env node
/**
 * Script para remover contas com segurança
 * Cria backup automático antes de remover
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PROJECT_ROOT = process.cwd();
const ACCOUNTS_FILE = path.join(PROJECT_ROOT, 'src', 'accounts.json');
const BACKUP_DIR = path.join(PROJECT_ROOT, 'backups');

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

function createBackup() {
  try {
    // Criar diretório de backups se não existir
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFile = path.join(BACKUP_DIR, `accounts-backup-${timestamp}.json`);
    
    fs.copyFileSync(ACCOUNTS_FILE, backupFile);
    
    info(`✓ Backup criado: ${path.basename(backupFile)}`);
    return backupFile;
  } catch (err) {
    error(`Erro ao criar backup: ${err.message}`);
    return null;
  }
}

function groupBySet(accounts) {
  const grouped = {};
  accounts.forEach((acc, idx) => {
    const setName = acc.set || 'sem-set';
    if (!grouped[setName]) {
      grouped[setName] = [];
    }
    grouped[setName].push({ ...acc, originalIndex: idx });
  });
  return grouped;
}

async function selectRemovalMode() {
  clearScreen();
  log('\n' + '='.repeat(60));
  log(bold('  Modo de Remoção'));
  log('='.repeat(60) + '\n');
  
  log('Como deseja remover contas?');
  log('  1) Remover conta específica');
  log('  2) Remover todas as contas de um set');
  log('  3) Remover múltiplas contas');
  log('  0) Cancelar');
  log('');
  
  const choice = await prompt('Escolha uma opção: ');
  return choice;
}

async function selectSingleAccount(accounts) {
  clearScreen();
  log('\n' + '='.repeat(60));
  log(bold('  Selecionar Conta para Remover'));
  log('='.repeat(60) + '\n');
  
  const grouped = groupBySet(accounts);
  const sets = Object.keys(grouped).sort();
  
  sets.forEach(setName => {
    log(`\n${bold(`Set: ${setName}`)}`);
    grouped[setName].forEach((acc, idx) => {
      const hasProxy = acc.proxy && acc.proxy.url ? '🔒' : '  ';
      log(`  ${acc.originalIndex + 1}) ${hasProxy} ${acc.email}`);
    });
  });
  
  log('');
  const choice = await prompt('Número da conta (0 para cancelar): ');
  const index = parseInt(choice) - 1;
  
  if (choice === '0' || isNaN(index) || index < 0 || index >= accounts.length) {
    return null;
  }
  
  return [index];
}

async function selectSet(accounts) {
  const grouped = groupBySet(accounts);
  const sets = Object.keys(grouped).sort();
  
  clearScreen();
  log('\n' + '='.repeat(60));
  log(bold('  Selecionar Set para Remover'));
  log('='.repeat(60) + '\n');
  
  sets.forEach((setName, idx) => {
    const count = grouped[setName].length;
    log(`  ${idx + 1}) ${setName} (${count} conta${count !== 1 ? 's' : ''})`);
  });
  
  log('');
  const choice = await prompt('Número do set (0 para cancelar): ');
  const index = parseInt(choice) - 1;
  
  if (choice === '0' || isNaN(index) || index < 0 || index >= sets.length) {
    return null;
  }
  
  const selectedSet = sets[index];
  const indices = grouped[selectedSet].map(acc => acc.originalIndex);
  
  warn(`\n⚠️  Isso removerá ${indices.length} conta(s) do set "${selectedSet}"!`);
  return indices;
}

async function selectMultipleAccounts(accounts) {
  clearScreen();
  log('\n' + '='.repeat(60));
  log(bold('  Selecionar Múltiplas Contas'));
  log('='.repeat(60) + '\n');
  
  const grouped = groupBySet(accounts);
  const sets = Object.keys(grouped).sort();
  
  sets.forEach(setName => {
    log(`\n${bold(`Set: ${setName}`)}`);
    grouped[setName].forEach((acc, idx) => {
      const hasProxy = acc.proxy && acc.proxy.url ? '🔒' : '  ';
      log(`  ${acc.originalIndex + 1}) ${hasProxy} ${acc.email}`);
    });
  });
  
  log('');
  info('Digite os números separados por vírgula (ex: 1,3,5)');
  const input = await prompt('Números (0 para cancelar): ');
  
  if (input === '0') {
    return null;
  }
  
  const indices = input
    .split(',')
    .map(n => parseInt(n.trim()) - 1)
    .filter(n => !isNaN(n) && n >= 0 && n < accounts.length);
  
  if (indices.length === 0) {
    error('Nenhuma conta válida selecionada!');
    return null;
  }
  
  // Remover duplicatas
  const uniqueIndices = [...new Set(indices)].sort((a, b) => a - b);
  
  warn(`\n⚠️  Você selecionou ${uniqueIndices.length} conta(s) para remover!`);
  return uniqueIndices;
}

function displayAccountsToRemove(accounts, indices) {
  log('\n' + '─'.repeat(60));
  log(bold('Contas que serão removidas:'));
  log('─'.repeat(60));
  
  indices.forEach(idx => {
    const acc = accounts[idx];
    log(`  • ${acc.email} [${acc.set || 'sem-set'}]`);
  });
  
  log('─'.repeat(60));
}

async function confirmRemoval(count) {
  const plural = count !== 1 ? 's' : '';
  warn(`\n⚠️  ATENÇÃO: Isso removerá ${count} conta${plural} permanentemente!`);
  info('Um backup será criado antes da remoção.\n');
  
  const confirm = await prompt(`Digite "CONFIRMAR" para remover ${count} conta${plural}: `);
  return confirm === 'CONFIRMAR';
}

async function main() {
  clearScreen();
  log('\n' + '═'.repeat(60));
  log(bold('           GERENCIADOR DE CONTAS - REMOÇÃO'));
  log('═'.repeat(60));
  
  const accounts = loadAccounts();
  
  if (accounts.length === 0) {
    warn('\nNenhuma conta encontrada!');
    info('Use: npm run add-account para adicionar contas.\n');
    rl.close();
    process.exit(0);
  }
  
  const mode = await selectRemovalMode();
  let indicesToRemove = null;
  
  switch (mode) {
    case '1':
      indicesToRemove = await selectSingleAccount(accounts);
      break;
    case '2':
      indicesToRemove = await selectSet(accounts);
      break;
    case '3':
      indicesToRemove = await selectMultipleAccounts(accounts);
      break;
    case '0':
      info('\nOperação cancelada.\n');
      rl.close();
      process.exit(0);
    default:
      error('\nOpção inválida!');
      rl.close();
      process.exit(1);
  }
  
  if (!indicesToRemove || indicesToRemove.length === 0) {
    info('\nOperação cancelada.\n');
    rl.close();
    process.exit(0);
  }
  
  // Mostrar contas que serão removidas
  displayAccountsToRemove(accounts, indicesToRemove);
  
  // Confirmar
  if (!await confirmRemoval(indicesToRemove.length)) {
    warn('\nRemoção cancelada.\n');
    rl.close();
    process.exit(0);
  }
  
  // Criar backup
  log('');
  const backupPath = createBackup();
  if (!backupPath) {
    error('\nFalha ao criar backup. Remoção cancelada por segurança.\n');
    rl.close();
    process.exit(1);
  }
  
  // Remover contas (do maior índice para o menor para evitar problemas)
  const sortedIndices = indicesToRemove.sort((a, b) => b - a);
  sortedIndices.forEach(idx => {
    accounts.splice(idx, 1);
  });
  
  // Salvar
  if (saveAccounts(accounts)) {
    success(`\n✓ ${indicesToRemove.length} conta(s) removida(s) com sucesso!`);
    info(`Backup disponível em: ${path.relative(PROJECT_ROOT, backupPath)}`);
  } else {
    error('\n✗ Falha ao salvar alterações!');
    error('Restaure o backup se necessário.');
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
