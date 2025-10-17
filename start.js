#!/usr/bin/env node
/**
 * Script para iniciar o projeto com seleção de set de contas
 * Permite escolher qual conjunto de contas deve ser usado
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

const PROJECT_ROOT = __dirname;
const ACCOUNTS_FILE = path.join(PROJECT_ROOT, 'src', 'accounts.json');
const SETUP_FILE = path.join(PROJECT_ROOT, 'setup', 'setup.mjs');

// Criar interface para leitura de input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function log(msg) { console.log(msg); }
function error(msg) { console.error(`\x1b[31m${msg}\x1b[0m`); }
function success(msg) { console.log(`\x1b[32m${msg}\x1b[0m`); }
function info(msg) { console.log(`\x1b[36m${msg}\x1b[0m`); }

/**
 * Lê o arquivo accounts.json e retorna os sets únicos disponíveis com contagem
 */
function getAvailableSets() {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) {
      error(`Arquivo de contas não encontrado: ${ACCOUNTS_FILE}`);
      return { sets: [], accounts: [] };
    }

    const accountsData = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
    const accounts = JSON.parse(accountsData);

    if (!Array.isArray(accounts) || accounts.length === 0) {
      error('Arquivo de contas está vazio ou em formato inválido');
      return { sets: [], accounts: [] };
    }

    // Contar contas por set
    const setCount = {};
    accounts.forEach(account => {
      if (account.set && typeof account.set === 'string') {
        setCount[account.set] = (setCount[account.set] || 0) + 1;
      }
    });

    // Retornar sets ordenados com informação de contagem
    const sets = Object.keys(setCount).sort().map(set => ({
      name: set,
      count: setCount[set]
    }));

    return { sets, accounts };
  } catch (err) {
    error(`Erro ao ler arquivo de contas: ${err.message}`);
    return { sets: [], accounts: [] };
  }
}

/**
 * Pergunta ao usuário qual set deseja usar
 */
function promptForSet(availableSets) {
  return new Promise((resolve) => {
    log('\n====================================');
    log('  Seleção de Set de Contas');
    log('====================================\n');
    
    log('Sets disponíveis:');
    availableSets.forEach((set, index) => {
      const countText = set.count === 1 ? '1 conta' : `${set.count} contas`;
      log(`  ${index + 1}) ${set.name} (${countText})`);
    });
    
    log('');
    rl.question('Escolha o número do set que deseja usar: ', (answer) => {
      const choice = parseInt(answer.trim());
      
      if (isNaN(choice) || choice < 1 || choice > availableSets.length) {
        error('\nEscolha inválida!');
        rl.close();
        process.exit(1);
      }
      
      const selectedSet = availableSets[choice - 1];
      resolve(selectedSet);
    });
  });
}

/**
 * Executa o setup.mjs com a variável de ambiente ACCOUNT_SET definida
 */
function runSetup(accountSet) {
  return new Promise((resolve, reject) => {
    const countText = accountSet.count === 1 ? '1 conta' : `${accountSet.count} contas`;
    success(`\n✓ Set selecionado: ${accountSet.name} (${countText})`);
    info(`\nIniciando setup com ACCOUNT_SET=${accountSet.name}...\n`);
    
    const env = { ...process.env, ACCOUNT_SET: accountSet.name };
    
    const child = spawn('node', [SETUP_FILE], {
      stdio: 'inherit',
      env: env,
      cwd: PROJECT_ROOT
    });
    
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Setup exited with code ${code}`));
      }
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Função principal
 */
async function main() {
  try {
    // Verificar se o arquivo de setup existe
    if (!fs.existsSync(SETUP_FILE)) {
      error(`Arquivo de setup não encontrado: ${SETUP_FILE}`);
      process.exit(1);
    }

    // Obter sets disponíveis
    const { sets: availableSets, accounts } = getAvailableSets();
    
    if (availableSets.length === 0) {
      error('Nenhum set de contas válido encontrado!');
      error('Verifique o arquivo src/accounts.json');
      process.exit(1);
    }

    // Perguntar qual set usar
    const selectedSet = await promptForSet(availableSets);
    
    // Fechar interface de leitura
    rl.close();
    
    // Executar setup com o set selecionado
    await runSetup(selectedSet);
    
  } catch (err) {
    error(`\nErro: ${err.message}`);
    process.exit(1);
  }
}

// Tratar Ctrl+C
process.on('SIGINT', () => {
  log('\n\nInterrompido pelo usuário.');
  rl.close();
  process.exit(1);
});

// Executar
main();
