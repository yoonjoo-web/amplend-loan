/**
 * Evaluates formulas with field references in {{fieldName}} format
 * Supports: IF(), IFERROR(), EOMONTH(), ROUND(), basic math operations, comparison operators
 */

// Helper function to get the last day of a month
function getEndOfMonth(dateStr, monthsToAdd = 0) {
  if (!dateStr) return null;
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  
  // Convert monthsToAdd to number if it's a string
  const months = typeof monthsToAdd === 'string' ? parseInt(monthsToAdd, 10) : monthsToAdd;
  if (isNaN(months)) return null;
  
  // Add months
  date.setMonth(date.getMonth() + months + 1);
  // Set to day 0 of next month (which is last day of current month)
  date.setDate(0);
  
  return date.toISOString().split('T')[0];
}

// Helper function to convert date string to days since epoch (for arithmetic)
function dateToNumber(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
}

// Helper function to convert days since epoch back to date string
function numberToDate(days) {
  if (days === null || days === undefined || isNaN(days)) return null;
  // Modern dates should be between 1970-2100 (0 to ~47000 days)
  if (days < 0 || days > 60000) return null;
  const date = new Date(days * 24 * 60 * 60 * 1000);
  return date.toISOString().split('T')[0];
}

// Helper to find matching closing parenthesis
function findMatchingCloseParen(str, startIndex) {
  let depth = 1;
  for (let i = startIndex + 1; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Helper to split function arguments respecting nested parentheses
function splitArguments(argsStr) {
  const args = [];
  let current = '';
  let depth = 0;
  
  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];
    
    if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    args.push(current.trim());
  }
  
  return args;
}

export function evaluateFormula(formula, fieldValues = {}) {
  if (!formula) return null;

  try {
    // Track if formula explicitly uses EOMONTH (date function)
    const explicitlyUsesEomonth = formula.match(/EOMONTH\s*\(/i);
    // Track if formula has date arithmetic (date field + number or date field - number)
    const hasDateArithmetic = formula.match(/\{\{[^}]+\}\}\s*[+\-]\s*\d+|\d+\s*[+\-]\s*\{\{[^}]+\}\}/);
    
    // Replace {{fieldName}} with actual values
    let processedFormula = formula.replace(/\{\{(\w+)\}\}/g, (match, fieldName) => {
      const value = fieldValues[fieldName];
      
      // Handle different value types
      if (value === null || value === undefined || value === '') {
        return 'null';
      }
      if (typeof value === 'string') {
        // If it's a date string, wrap in quotes
        if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
          return `"${value}"`;
        }
        // For other strings, wrap in quotes and escape internal quotes
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
      }
      return value;
    });

    // Replace ROUND() function with custom implementation (Excel-style with precision)
    let depth = 0;
    let maxDepth = 10;
    while (processedFormula.includes('ROUND(') && depth < maxDepth) {
      const match = /ROUND\s*\(/i.exec(processedFormula);
      if (!match) break;
      
      const startIndex = match.index + match[0].length - 1;
      const endIndex = findMatchingCloseParen(processedFormula, startIndex);
      
      if (endIndex === -1) break;
      
      const argsStr = processedFormula.substring(startIndex + 1, endIndex);
      const args = splitArguments(argsStr);
      
      if (args.length === 2) {
        const replacement = `_round(${args[0]}, ${args[1]})`;
        processedFormula = processedFormula.substring(0, match.index) + replacement + processedFormula.substring(endIndex + 1);
      } else if (args.length === 1) {
        const replacement = `Math.round(${args[0]})`;
        processedFormula = processedFormula.substring(0, match.index) + replacement + processedFormula.substring(endIndex + 1);
      }
      depth++;
    }

    // Replace EOMONTH() function - returns numeric days for arithmetic
    depth = 0;
    while (processedFormula.includes('EOMONTH(') && depth < maxDepth) {
      const match = /EOMONTH\s*\(/i.exec(processedFormula);
      if (!match) break;
      
      const startIndex = match.index + match[0].length - 1;
      const endIndex = findMatchingCloseParen(processedFormula, startIndex);
      
      if (endIndex === -1) break;
      
      const argsStr = processedFormula.substring(startIndex + 1, endIndex);
      const args = splitArguments(argsStr);
      
      if (args.length === 2) {
        const replacement = `_eomonth(${args[0]}, ${args[1]})`;
        processedFormula = processedFormula.substring(0, match.index) + replacement + processedFormula.substring(endIndex + 1);
      }
      depth++;
    }

    // Replace IFERROR() function
    depth = 0;
    while (processedFormula.includes('IFERROR(') && depth < maxDepth) {
      const match = /IFERROR\s*\(/i.exec(processedFormula);
      if (!match) break;
      
      const startIndex = match.index + match[0].length - 1;
      const endIndex = findMatchingCloseParen(processedFormula, startIndex);
      
      if (endIndex === -1) break;
      
      const argsStr = processedFormula.substring(startIndex + 1, endIndex);
      const args = splitArguments(argsStr);
      
      if (args.length === 2) {
        const replacement = `_iferror(${args[0]}, ${args[1]})`;
        processedFormula = processedFormula.substring(0, match.index) + replacement + processedFormula.substring(endIndex + 1);
      }
      depth++;
    }

    // Replace = with == for comparison (but not ==, !=, <=, >=)
    processedFormula = processedFormula.replace(/([^=!<>])=([^=])/g, '$1==$2');

    // Replace IF() function with ternary operator
    depth = 0;
    while (processedFormula.includes('IF(') && depth < maxDepth) {
      const match = /IF\s*\(/i.exec(processedFormula);
      if (!match) break;
      
      const startIndex = match.index + match[0].length - 1;
      const endIndex = findMatchingCloseParen(processedFormula, startIndex);
      
      if (endIndex === -1) break;
      
      const argsStr = processedFormula.substring(startIndex + 1, endIndex);
      const args = splitArguments(argsStr);
      
      if (args.length === 3) {
        const replacement = `(${args[0]} ? ${args[1]} : ${args[2]})`;
        processedFormula = processedFormula.substring(0, match.index) + replacement + processedFormula.substring(endIndex + 1);
      }
      depth++;
    }

    // Replace ^ with ** for exponentiation
    processedFormula = processedFormula.replace(/\^/g, '**');

    // Replace common function names
    processedFormula = processedFormula.replace(/MAX\(/gi, 'Math.max(');
    processedFormula = processedFormula.replace(/MIN\(/gi, 'Math.min(');
    processedFormula = processedFormula.replace(/ABS\(/gi, 'Math.abs(');
    processedFormula = processedFormula.replace(/FLOOR\(/gi, 'Math.floor(');
    processedFormula = processedFormula.replace(/CEIL\(/gi, 'Math.ceil(');
    processedFormula = processedFormula.replace(/SQRT\(/gi, 'Math.sqrt(');

    // Before evaluation, convert date strings AND nulls in arithmetic operations
    // Replace null+number or number+null patterns with proper null handling
    processedFormula = processedFormula.replace(
      /null\s*([+\-])\s*(\d+)/g,
      (match, operator, number) => {
        return `_nullSafeOp(null, "${operator}", ${number})`;
      }
    );
    
    processedFormula = processedFormula.replace(
      /(\d+)\s*([+\-])\s*null/g,
      (match, number, operator) => {
        return `_nullSafeOp(${number}, "${operator}", null)`;
      }
    );
    
    // Convert date strings in arithmetic operations to numbers
    processedFormula = processedFormula.replace(
      /"(\d{4}-\d{2}-\d{2}[^"]*)"\s*([+\-*/])/g,
      (match, dateStr, operator) => {
        return `_dateToNum("${dateStr}") ${operator}`;
      }
    );
    
    processedFormula = processedFormula.replace(
      /([+\-*/])\s*"(\d{4}-\d{2}-\d{2}[^"]*)"/g,
      (match, operator, dateStr) => {
        return `${operator} _dateToNum("${dateStr}")`;
      }
    );

    // Create helper functions for the evaluation context
    const _eomonth = (dateStr, months) => {
      const result = getEndOfMonth(dateStr, months);
      // Return as numeric days for arithmetic operations
      return result ? dateToNumber(result) : null;
    };

    const _iferror = (value, errorValue) => {
      try {
        if (value === null || value === undefined || (typeof value === 'number' && (isNaN(value) || !isFinite(value)))) {
          return errorValue;
        }
        return value;
      } catch (e) {
        return errorValue;
      }
    };

    const _round = (value, decimals) => {
      if (value === null || value === undefined) return null;
      const multiplier = Math.pow(10, decimals || 0);
      return Math.round(value * multiplier) / multiplier;
    };

    const _dateToNum = (dateStr) => {
      if (typeof dateStr === 'number') return dateStr;
      return dateToNumber(dateStr);
    };
    
    // Null-safe operation for date arithmetic
    const _nullSafeOp = (a, operator, b) => {
      if (a === null || b === null) return null;
      if (operator === '+') return a + b;
      if (operator === '-') return a - b;
      return null;
    };

    console.log('Original formula:', formula);
    console.log('Processed formula:', processedFormula);

    // Evaluate the formula
    const result = new Function('_eomonth', '_iferror', '_round', '_dateToNum', '_nullSafeOp', `return ${processedFormula}`)(_eomonth, _iferror, _round, _dateToNum, _nullSafeOp);
    
    console.log('Formula result (raw):', result, 'Type:', typeof result);
    
    // Handle the result
    if (result === null || result === undefined) {
      console.log('Result is null/undefined, returning null');
      return null;
    }
    if (typeof result === 'number' && isNaN(result)) {
      console.log('Result is NaN, returning null');
      return null;
    }
    if (typeof result === 'number' && !isFinite(result)) {
      console.log('Result is not finite, returning null');
      return null;
    }
    
    // If result is already a string, return it
    if (typeof result === 'string') {
      console.log('Result is already a string, returning as-is');
      return result;
    }
    
    // ONLY convert to date if:
    // 1. Formula explicitly uses EOMONTH OR has date arithmetic pattern, AND
    // 2. Result is in valid date range (15000-25000 = years 2011-2038)
    if ((explicitlyUsesEomonth || hasDateArithmetic) && typeof result === 'number' && result >= 15000 && result <= 25000) {
      const dateStr = numberToDate(result);
      console.log('Formula uses date operations and result looks like a date (', result, 'days), converting to:', dateStr);
      if (dateStr) return dateStr;
    }
    
    console.log('Returning numeric result:', result);
    return result;
  } catch (error) {
    console.error('Formula evaluation error:', error.message);
    console.error('Formula:', error);
    console.error('Stack:', error.stack);
    return null;
  }
}