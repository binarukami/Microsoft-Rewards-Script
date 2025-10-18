#!/usr/bin/env node
/**
 * Script para visualizar todas as contas organizadas por set
 * Mostra informações detalhadas de cada conta
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const ACCOUNTS_FILE = path.join(PROJECT_ROOT, 'src', 'accounts.json');

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

/**
 * Carrega as contas
 */
function loadAccounts() {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) {
      error(`Arquivo de contas não encontrado: ${ACCOUNTS_FILE}`);
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
 * Agrupa contas por set
 */
function groupAccountsBySet(accounts) {
  const grouped = {};
  accounts.forEach((account, index) => {
    const setName = account.set || 'sem-set';
    if (!grouped[setName]) {
      grouped[setName] = [];
    }
    grouped[setName].push({ ...account, index });
  });
  return grouped;
}

/**
 * Formata informações do proxy
 */
function formatProxy(proxy) {
  if (!proxy || !proxy.url) {
    return '\x1b[90mNão configurado\x1b[0m';
  }
  return `${proxy.url}:${proxy.port}`;
}

/**
 * Exibe estatísticas gerais
 */
function displayStats(accounts, grouped) {
  const totalSets = Object.keys(grouped).length;
  const setsWithSpace = Object.values(grouped).filter(accs => accs.length < 6).length;
  const fullSets = Object.values(grouped).filter(accs => accs.length >= 6).length;
  
  log('\n' + '='.repeat(60));
  log(bold('  ESTATÍSTICAS GERAIS'));
  log('='.repeat(60));
  log(`  Total de contas:     ${bold(accounts.length)}`);
  log(`  Total de sets:       ${bold(totalSets)}`);
  log(`  Sets com espaço:     ${success('✓')} ${setsWithSpace}`);
  log(`  Sets completos:      ${fullSets > 0 ? warn('●') : success('✓')} ${fullSets}`);
  log('='.repeat(60));
}

/**
 * Exibe contas por set
 */
function displayAccountsBySet(grouped) {
  const sets = Object.keys(grouped).sort();
  
  sets.forEach((setName, setIndex) => {
    const accounts = grouped[setName];
    const count = accounts.length;
    const status = count >= 6 ? warn('[COMPLETO]') : success(`[${count}/6]`);
    
    log(`\n${bold(`Set: ${setName}`)} ${status}`);
    log('─'.repeat(60));
    
    accounts.forEach((account, idx) => {
      const number = (idx + 1).toString().padStart(2, '0');
      const hasProxy = account.proxy && account.proxy.url ? '🔒' : '  ';
      
      log(`  ${number}. ${hasProxy} ${bold(account.email)}`);
      log(`      Senha:  ${'*'.repeat(Math.min(account.password.length, 12))}`);
      log(`      Proxy:  ${formatProxy(account.proxy)}`);
      log(`      Index:  #${account.index}`);
      
      if (idx < accounts.length - 1) {
        log('');
      }
    });
    
    if (setIndex < sets.length - 1) {
      log('');
    }
  });
}

/**
 * Exibe contas sem set
 */
function displayAccountsWithoutSet(accounts) {
  const withoutSet = accounts.filter(acc => !acc.set);
  
  if (withoutSet.length > 0) {
    warn(`\n⚠️  ${withoutSet.length} conta(s) sem set definido!`);
    withoutSet.forEach(acc => {
      log(`   - ${acc.email}`);
    });
  }
}

/**
 * Exibe modo de uso detalhado
 */
function displayDetailedView(accounts) {
  log('\n' + '='.repeat(60));
  log(bold('  TODAS AS CONTAS (Visão Detalhada)'));
  log('='.repeat(60));
  
  accounts.forEach((account, index) => {
    const hasProxy = account.proxy && account.proxy.url;
    
    log(`\n${bold(`#${index + 1}`)} - ${bold(account.email)}`);
    log(`  Set:      ${account.set || '\x1b[90m(não definido)\x1b[0m'}`);
    log(`  Senha:    ${'*'.repeat(Math.min(account.password.length, 12))}`);
    log(`  Proxy:    ${formatProxy(account.proxy)}`);
    
    if (hasProxy && account.proxy.username) {
      log(`  Proxy Auth: ${account.proxy.username}`);
    }
  });
}

/**
 * Exporta para CSV
 */
function exportToCSV(accounts) {
  const csvLines = ['Email,Set,Has_Proxy,Proxy_URL'];
  
  accounts.forEach(account => {
    const hasProxy = account.proxy && account.proxy.url ? 'Sim' : 'Não';
    const proxyUrl = account.proxy && account.proxy.url ? `${account.proxy.url}:${account.proxy.port}` : '';
    csvLines.push(`${account.email},${account.set || ''},${hasProxy},${proxyUrl}`);
  });
  
  const csvPath = path.join(PROJECT_ROOT, 'accounts-export.csv');
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
  success(`\n✓ Exportado para: ${csvPath}`);
}

/**
 * Função principal
 */
function main() {
  const args = process.argv.slice(2);
  const detailed = args.includes('--detailed') || args.includes('-d');
  const exportCsv = args.includes('--export') || args.includes('-e');
  
  clearScreen();
  log('\n' + '═'.repeat(60));
  log(bold('           GERENCIADOR DE CONTAS - VISUALIZAÇÃO'));
  log('═'.repeat(60));
  
  const accounts = loadAccounts();
  
  if (accounts.length === 0) {
    warn('\nNenhuma conta encontrada!');
    info('Use: npm run add-account para adicionar contas.\n');
    process.exit(0);
  }
  
  const grouped = groupAccountsBySet(accounts);
  
  // Estatísticas
  displayStats(accounts, grouped);
  
  // Visualização por set (padrão)
  if (!detailed) {
    displayAccountsBySet(grouped);
    displayAccountsWithoutSet(accounts);
  }
  
  // Visualização detalhada
  if (detailed) {
    displayDetailedView(accounts);
  }
  
  // Exportar CSV
  if (exportCsv) {
    exportToCSV(accounts);
  }
  
  // Dicas
  log('\n' + '─'.repeat(60));
  info('Dicas:');
  log('  • Use --detailed ou -d para visão detalhada');
  log('  • Use --export ou -e para exportar CSV');
  log('  • npm run edit-account para editar contas');
  log('  • npm run remove-account para remover contas');
  log('═'.repeat(60));
  log('');
  info('Pressione Enter para voltar ao menu principal...');
  
  // Aguardar Enter para voltar
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  stdin.once('data', () => {
    stdin.setRawMode(false);
    stdin.pause();
    process.exit(0);
  });
}

// Executar
try {
  main();
} catch (err) {
  error(`\nErro: ${err.message}`);
  process.exit(1);
}
