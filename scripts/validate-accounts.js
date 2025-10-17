#!/usr/bin/env node
/**
 * Script para validar contas
 * Verifica formato, duplicatas e integridade dos dados
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

const issues = {
  critical: [],
  warning: [],
  info: []
};

function loadAccounts() {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) {
      issues.critical.push('Arquivo de contas não encontrado');
      return null;
    }
    const data = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    issues.critical.push(`Erro ao ler arquivo: ${err.message}`);
    return null;
  }
}

function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validateStructure(accounts) {
  log('\n' + bold('1. Validando Estrutura...'));
  
  if (!Array.isArray(accounts)) {
    issues.critical.push('O arquivo não contém um array válido');
    return false;
  }
  
  if (accounts.length === 0) {
    issues.warning.push('Nenhuma conta encontrada no arquivo');
    return false;
  }
  
  success(`✓ ${accounts.length} conta(s) encontrada(s)`);
  return true;
}

function validateFields(accounts) {
  log('\n' + bold('2. Validando Campos Obrigatórios...'));
  
  let valid = true;
  
  accounts.forEach((account, idx) => {
    const accountNum = idx + 1;
    
    // Email
    if (!account.email) {
      issues.critical.push(`Conta #${accountNum}: Email não definido`);
      valid = false;
    } else if (!validateEmail(account.email)) {
      issues.critical.push(`Conta #${accountNum}: Email inválido (${account.email})`);
      valid = false;
    }
    
    // Senha
    if (!account.password) {
      issues.critical.push(`Conta #${accountNum}: Senha não definida`);
      valid = false;
    } else if (account.password.length < 6) {
      issues.warning.push(`Conta #${accountNum}: Senha muito curta (${account.email})`);
    }
    
    // Set
    if (!account.set) {
      issues.warning.push(`Conta #${accountNum}: Set não definido (${account.email})`);
    } else if (!/^[a-zA-Z0-9_-]+$/.test(account.set)) {
      issues.warning.push(`Conta #${accountNum}: Nome do set contém caracteres inválidos (${account.set})`);
    }
    
    // Proxy
    if (!account.proxy) {
      issues.info.push(`Conta #${accountNum}: Proxy não configurado (${account.email})`);
    } else {
      if (typeof account.proxy !== 'object') {
        issues.critical.push(`Conta #${accountNum}: Estrutura de proxy inválida`);
        valid = false;
      } else if (account.proxy.url && !account.proxy.port) {
        issues.warning.push(`Conta #${accountNum}: Proxy com URL mas sem porta (${account.email})`);
      }
    }
  });
  
  if (valid && issues.warning.length === 0 && issues.info.length === 0) {
    success('✓ Todos os campos estão válidos');
  } else if (valid) {
    warn('⚠ Campos válidos, mas com avisos');
  } else {
    error('✗ Erros críticos encontrados nos campos');
  }
  
  return valid;
}

function validateDuplicates(accounts) {
  log('\n' + bold('3. Verificando Duplicatas...'));
  
  const emails = new Map();
  let hasDuplicates = false;
  
  accounts.forEach((account, idx) => {
    const email = account.email.toLowerCase();
    
    if (emails.has(email)) {
      issues.critical.push(`Email duplicado: ${account.email} (contas #${emails.get(email) + 1} e #${idx + 1})`);
      hasDuplicates = true;
    } else {
      emails.set(email, idx);
    }
  });
  
  if (!hasDuplicates) {
    success('✓ Nenhuma duplicata encontrada');
  } else {
    error('✗ Emails duplicados encontrados');
  }
  
  return !hasDuplicates;
}

function validateSets(accounts) {
  log('\n' + bold('4. Validando Sets...'));
  
  const setCount = {};
  let valid = true;
  
  accounts.forEach(account => {
    const setName = account.set || 'sem-set';
    setCount[setName] = (setCount[setName] || 0) + 1;
  });
  
  Object.entries(setCount).forEach(([setName, count]) => {
    if (count > 6) {
      issues.critical.push(`Set "${setName}" possui ${count} contas (máximo: 6)`);
      valid = false;
    } else if (count === 6) {
      issues.info.push(`Set "${setName}" está completo (6/6)`);
    } else {
      issues.info.push(`Set "${setName}" possui ${count}/6 contas`);
    }
  });
  
  if (valid) {
    success('✓ Todos os sets estão dentro do limite');
  } else {
    error('✗ Sets com excesso de contas');
  }
  
  return valid;
}

function validateProxies(accounts) {
  log('\n' + bold('5. Validando Proxies...'));
  
  let configured = 0;
  let errors = 0;
  
  accounts.forEach((account, idx) => {
    if (account.proxy && account.proxy.url) {
      configured++;
      
      // Validar estrutura
      if (!account.proxy.port || account.proxy.port === 0) {
        issues.warning.push(`Conta #${idx + 1}: Proxy sem porta válida (${account.email})`);
        errors++;
      }
      
      // Validar URL básica
      if (!account.proxy.url.includes('.')) {
        issues.warning.push(`Conta #${idx + 1}: URL de proxy suspeita (${account.email})`);
        errors++;
      }
    }
  });
  
  if (configured === 0) {
    info(`ℹ Nenhuma conta com proxy configurado`);
  } else if (errors === 0) {
    success(`✓ ${configured} proxy(s) configurado(s) corretamente`);
  } else {
    warn(`⚠ ${configured} proxy(s) configurado(s), ${errors} com problemas`);
  }
  
  return true;
}

function validateSecurity(accounts) {
  log('\n' + bold('6. Validando Segurança...'));
  
  let weak = 0;
  
  accounts.forEach((account, idx) => {
    const password = account.password;
    
    // Senha fraca
    if (password.length < 8) {
      weak++;
    } else if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      issues.info.push(`Conta #${idx + 1}: Senha pode ser mais forte (${account.email})`);
    }
    
    // Senha comum
    const commonPasswords = ['password', '123456', 'qwerty', 'admin'];
    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
      issues.warning.push(`Conta #${idx + 1}: Senha muito comum (${account.email})`);
      weak++;
    }
  });
  
  if (weak === 0) {
    success('✓ Senhas adequadas');
  } else {
    warn(`⚠ ${weak} senha(s) fraca(s) detectada(s)`);
  }
  
  return true;
}

function displayReport() {
  log('\n' + '═'.repeat(60));
  log(bold('           RELATÓRIO DE VALIDAÇÃO'));
  log('═'.repeat(60));
  
  const totalIssues = issues.critical.length + issues.warning.length;
  
  if (issues.critical.length > 0) {
    log('\n' + error(bold(`❌ ERROS CRÍTICOS (${issues.critical.length}):`)));
    issues.critical.forEach(issue => {
      log(error(`   • ${issue}`));
    });
  }
  
  if (issues.warning.length > 0) {
    log('\n' + warn(bold(`⚠️  AVISOS (${issues.warning.length}):`)));
    issues.warning.forEach(issue => {
      log(warn(`   • ${issue}`));
    });
  }
  
  if (issues.info.length > 0 && (issues.critical.length > 0 || issues.warning.length > 0)) {
    log('\n' + info(bold(`ℹ️  INFORMAÇÕES (${issues.info.length}):`)));
    issues.info.slice(0, 5).forEach(issue => {
      log(info(`   • ${issue}`));
    });
    if (issues.info.length > 5) {
      log(info(`   ... e mais ${issues.info.length - 5} informação(ões)`));
    }
  }
  
  log('\n' + '─'.repeat(60));
  
  if (totalIssues === 0) {
    success(bold('✓ VALIDAÇÃO COMPLETA: Tudo OK!'));
    log('  Todas as contas estão válidas e prontas para uso.');
  } else if (issues.critical.length === 0) {
    warn(bold('⚠ VALIDAÇÃO COMPLETA: Avisos encontrados'));
    log('  As contas podem ser usadas, mas recomenda-se revisar os avisos.');
  } else {
    error(bold('✗ VALIDAÇÃO FALHOU: Erros críticos encontrados'));
    log('  Corrija os erros antes de usar as contas.');
  }
  
  log('═'.repeat(60) + '\n');
  
  return issues.critical.length === 0;
}

function main() {
  clearScreen();
  log('\n' + '═'.repeat(60));
  log(bold('           VALIDADOR DE CONTAS'));
  log('═'.repeat(60));
  
  const accounts = loadAccounts();
  
  if (!accounts) {
    displayReport();
    info('\nPressione Enter para voltar ao menu principal...');
    
    // Aguardar Enter
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.once('data', () => {
      stdin.setRawMode(false);
      stdin.pause();
      process.exit(1);
    });
    return;
  }
  
  // Executar validações
  validateStructure(accounts);
  validateFields(accounts);
  validateDuplicates(accounts);
  validateSets(accounts);
  validateProxies(accounts);
  validateSecurity(accounts);
  
  // Exibir relatório
  const isValid = displayReport();
  
  info('\nPressione Enter para voltar ao menu principal...');
  
  // Aguardar Enter
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  stdin.once('data', () => {
    stdin.setRawMode(false);
    stdin.pause();
    process.exit(isValid ? 0 : 1);
  });
}

try {
  main();
} catch (err) {
  error(`\nErro fatal: ${err.message}`);
  process.exit(1);
}
