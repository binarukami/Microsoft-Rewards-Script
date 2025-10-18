#!/usr/bin/env node
/**
 * Script para iniciar o projeto com seleção de set de contas
 * Permite escolher qual conjunto de contas deve ser usado
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

const PROJECT_ROOT = process.cwd();
const ACCOUNTS_FILE = path.join(PROJECT_ROOT, 'src', 'accounts.json');
const SETUP_FILE = path.join(PROJECT_ROOT, 'setup', 'setup.mjs');
const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'scripts');
const ADD_ACCOUNT_SCRIPT = path.join(SCRIPTS_DIR, 'add-account.js');
const LIST_ACCOUNTS_SCRIPT = path.join(SCRIPTS_DIR, 'list-accounts.js');
const EDIT_ACCOUNT_SCRIPT = path.join(SCRIPTS_DIR, 'edit-account.js');
const REMOVE_ACCOUNT_SCRIPT = path.join(SCRIPTS_DIR, 'remove-account.js');
const VALIDATE_ACCOUNTS_SCRIPT = path.join(SCRIPTS_DIR, 'validate-accounts.js');

let rl = null;

function log(msg) { console.log(msg); }
function error(msg) { console.error(`\x1b[31m${msg}\x1b[0m`); }
function success(msg) { console.log(`\x1b[32m${msg}\x1b[0m`); }
function info(msg) { console.log(`\x1b[36m${msg}\x1b[0m`); }

/**
 * Limpa o terminal
 */
function clearScreen() {
  // Limpa terminal em diferentes sistemas
  process.stdout.write('\x1Bc'); // Alternativa mais compatível
  // ou process.stdout.write('\033c'); 
  // ou console.clear();
}

/**
 * Cria uma nova interface readline
 */
function createReadline() {
  if (rl) {
    try {
      rl.close();
    } catch (e) {
      // Ignorar erro se já estiver fechado
    }
  }
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return rl;
}

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
function promptForSet(availableSets, readline) {
  return new Promise((resolve) => {
    clearScreen();
    log('\n====================================');
    log('  Seleção de Set de Contas');
    log('====================================\n');
    
    log('Sets disponíveis:');

    availableSets.forEach((set, index) => {
      const countText = set.count === 1 ? '1 conta' : `${set.count} contas`;
      log(`  ${index + 1}) ${set.name} (${countText})`);
    });
    
    log('');
    readline.question('Escolha o número do set que deseja usar: ', (answer) => {
      const choice = parseInt(answer.trim());
      
      if (isNaN(choice) || choice < 1 || choice > availableSets.length) {
        error('\nEscolha inválida!');
        readline.close();
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
 * Pergunta qual ação o usuário deseja realizar
 */
function promptMainMenu(readline) {
  return new Promise((resolve) => {
    clearScreen();
    log('\n' + '═'.repeat(60));
    log('           \x1b[1mMicrosoft Rewards - Menu Principal\x1b[0m');
    log('═'.repeat(60) + '\n');
    
    log('\x1b[36m🚀 EXECUÇÃO\x1b[0m');
    log('  1) Iniciar o projeto (selecionar set)\n');
    
    log('\x1b[33m📋 GERENCIAR CONTAS\x1b[0m');
    log('  2) Adicionar conta');
    log('  3) Visualizar contas');
    log('  4) Editar conta');
    log('  5) Remover conta');
    log('  6) Validar contas\n');
    
    log('\x1b[31m❌ SAIR\x1b[0m');
    log('  0) Sair\n');
    
    log('─'.repeat(60));
    
    readline.question('Escolha uma opção: ', (answer) => {
      const choice = parseInt(answer.trim());
      resolve(choice);
    });
  });
}

/**
 * Executa um script genérico
 */
function runScript(scriptPath, scriptName = 'Script') {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: PROJECT_ROOT
    });
    
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${scriptName} exited with code ${code}`));
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
    // Criar nova instância do readline
    const currentRl = createReadline();
    
    // Menu principal
    const choice = await promptMainMenu(currentRl);
    
    // Fechar readline para executar scripts
    currentRl.close();
    
    switch (choice) {
      case 0:
        // Sair
        success('\n✓ Até logo!\n');
        process.exit(0);
        break;
        
      case 1:
        // Iniciar projeto
        if (!fs.existsSync(SETUP_FILE)) {
          error(`\nArquivo de setup não encontrado: ${SETUP_FILE}`);
          process.exit(1);
        }

        // Obter sets disponíveis
        const { sets: availableSets, accounts } = getAvailableSets();
        
        if (availableSets.length === 0) {
          error('\nNenhum set de contas válido encontrado!');
          error('Verifique o arquivo src/accounts.json ou adicione contas.');
          info('Use: npm run add-account\n');
          process.exit(1);
        }

        // Reabrir readline para perguntar o set
        const setRl = createReadline();
        const selectedSet = await promptForSet(availableSets, setRl);
        setRl.close();
        
        // Perguntar se usuário quer habilitar headless via MEMORY_HEADLESS ou forçar com FORCE_HEADLESS
        const envRl = createReadline();

        const forceHeadless = await new Promise((resolve) => {
          envRl.question('Deseja forçar headless (FORCE_HEADLESS=1)? Isso sobrescreve outras configurações. (s/n): ', (answer) => {
            const a = (answer || '').trim().toLowerCase();
            resolve(a === 's' || a === 'y');
          });
        });
        envRl.close();

        if (forceHeadless) {
          process.env.FORCE_HEADLESS = '1';
          info('FORCE_HEADLESS definido como 1 (forçando headless)');
        } else {
          if (process.env.FORCE_HEADLESS) delete process.env.FORCE_HEADLESS;
        }

        // Executar setup com o set selecionado
        await runSetup(selectedSet);
        break;
        
      case 2:
        // Adicionar conta
        clearScreen();
        info('\n📝 Abrindo adicionar conta...\n');
        await runScript(ADD_ACCOUNT_SCRIPT, 'Add Account');
        return main();
        
      case 3:
        // Visualizar contas
        clearScreen();
        info('\n👀 Visualizando contas...\n');
        await runScript(LIST_ACCOUNTS_SCRIPT, 'List Accounts');
        return main();
        
      case 4:
        // Editar conta
        clearScreen();
        info('\n✏️  Abrindo editor de contas...\n');
        await runScript(EDIT_ACCOUNT_SCRIPT, 'Edit Account');
        return main();
        
      case 5:
        // Remover conta
        clearScreen();
        info('\n🗑️  Abrindo remoção de contas...\n');
        await runScript(REMOVE_ACCOUNT_SCRIPT, 'Remove Account');
        return main();
        
      case 6:
        // Validar contas
        clearScreen();
        info('\n✅ Validando contas...\n');
        await runScript(VALIDATE_ACCOUNTS_SCRIPT, 'Validate Accounts');
        return main();
        
      default:
        error('\n✗ Opção inválida!');
        return main();
    }
    
  } catch (err) {
    error(`\nErro: ${err.message}`);
    if (rl) {
      rl.close();
    }
    process.exit(1);
  }
}

// Tratar Ctrl+C
process.on('SIGINT', () => {
  log('\n\nInterrompido pelo usuário.');
  if (rl) {
    rl.close();
  }
  process.exit(1);
});

// Executar
main();
