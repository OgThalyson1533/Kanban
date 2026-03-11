/**
 * LIFE CONTROL — Validation Module
 * Validações robustas para todos os inputs e dados
 */

export const ValidationRules = {
  task: {
    title: {
      required: true,
      minLength: 3,
      maxLength: 120,
      message: 'Título deve ter entre 3 e 120 caracteres',
    },
    description: {
      maxLength: 2000,
      message: 'Descrição não deve exceder 2000 caracteres',
    },
    estimatedMinutes: {
      type: 'number',
      min: 5,
      max: 1440,
      message: 'Tempo estimado deve ser entre 5 e 1440 minutos',
    },
    priority: {
      enum: ['high', 'med', 'low'],
      message: 'Prioridade inválida',
    },
    complexity: {
      enum: ['low', 'medium', 'high'],
      message: 'Complexidade inválida',
    },
    status: {
      enum: ['backlog', 'next', 'doing', 'blocked', 'review', 'done'],
      message: 'Status inválido',
    },
  },
  
  finance: {
    amount: {
      type: 'number',
      min: 0.01,
      max: 999999,
      message: 'Valor deve ser entre 0.01 e 999999',
    },
    description: {
      required: true,
      minLength: 2,
      maxLength: 120,
      message: 'Descrição deve ter entre 2 e 120 caracteres',
    },
    category: {
      required: true,
      message: 'Categoria é obrigatória',
    },
  },
  
  goal: {
    title: {
      required: true,
      minLength: 3,
      maxLength: 100,
      message: 'Título deve ter entre 3 e 100 caracteres',
    },
    target: {
      type: 'number',
      min: 0.01,
      max: 99999999,
      message: 'Meta inválida',
    },
    deadline: {
      type: 'date',
      message: 'Data inválida',
    },
  },
};

/**
 * Valida um objeto contra regras de validação
 * @returns { isValid: boolean, errors: { [field]: string } }
 */
export function validateObject(obj, rules) {
  const errors = {};
  
  Object.entries(rules).forEach(([field, fieldRules]) => {
    const value = obj[field];
    
    // Required
    if (fieldRules.required && !value && value !== 0) {
      errors[field] = fieldRules.message || `${field} é obrigatório`;
      return;
    }
    
    if (!value && value !== 0) return; // Skip further validation if not required and empty
    
    // Type
    if (fieldRules.type === 'number') {
      if (isNaN(value) || typeof value !== 'number' && isNaN(Number(value))) {
        errors[field] = fieldRules.message || `${field} deve ser um número`;
        return;
      }
    }
    
    // Min/Max length
    if (fieldRules.minLength && String(value).length < fieldRules.minLength) {
      errors[field] = fieldRules.message;
      return;
    }
    if (fieldRules.maxLength && String(value).length > fieldRules.maxLength) {
      errors[field] = fieldRules.message;
      return;
    }
    
    // Min/Max value
    if (fieldRules.min !== undefined && Number(value) < fieldRules.min) {
      errors[field] = fieldRules.message;
      return;
    }
    if (fieldRules.max !== undefined && Number(value) > fieldRules.max) {
      errors[field] = fieldRules.message;
      return;
    }
    
    // Enum
    if (fieldRules.enum && !fieldRules.enum.includes(value)) {
      errors[field] = fieldRules.message;
      return;
    }
    
    // Date validation
    if (fieldRules.type === 'date') {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        errors[field] = fieldRules.message;
        return;
      }
    }
  });
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Valida uma tarefa
 */
export function validateTask(task) {
  const rules = { ...ValidationRules.task };
  
  // Validações customizadas
  if (task.deadline && task.createdAt && task.deadline < task.createdAt) {
    return {
      isValid: false,
      errors: { deadline: 'Prazo não pode ser anterior à data de criação' },
    };
  }
  
  if (task.completedAt && task.startedAt && task.completedAt < task.startedAt) {
    return {
      isValid: false,
      errors: { completedAt: 'Data de conclusão não pode ser anterior ao início' },
    };
  }
  
  return validateObject(task, rules);
}

/**
 * Valida uma transação financeira
 */
export function validateFinance(finance) {
  return validateObject(finance, ValidationRules.finance);
}

/**
 * Valida uma meta
 */
export function validateGoal(goal) {
  return validateObject(goal, ValidationRules.goal);
}

/**
 * Mostra erros em um formulário
 */
export function showFieldErrors(errors) {
  Object.entries(errors).forEach(([field, message]) => {
    const input = document.getElementById(`td-${field}`) || document.getElementById(`fin-${field}`) || document.getElementById(`goal-${field}`);
    if (input) {
      input.classList.add('input--error');
      input.setAttribute('data-error', message);
    }
  });
}

/**
 * Limpa erros visuais
 */
export function clearFieldErrors() {
  document.querySelectorAll('.input--error').forEach(el => {
    el.classList.remove('input--error');
    el.removeAttribute('data-error');
  });
}
