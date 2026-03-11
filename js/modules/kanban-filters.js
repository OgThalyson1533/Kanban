/**
 * LIFE CONTROL — Kanban Filters Module
 * Filtros avançados, busca e paginação para o Kanban
 */

import { state } from './state.js';

export const kanbanFilters = {
  search: '',
  priority: [],        // ['high', 'med', 'low']
  complexity: [],      // ['low', 'medium', 'high']
  tags: [],           // ['work', 'personal', etc]
  assignee: [],       // ['name1', 'name2']
  status: [],         // ['backlog', 'next', 'doing', 'blocked', 'review', 'done']
  deadline: {
    from: null,
    to: null,
    overdue: false,  
  },
  sort: 'created-desc', // 'priority', 'deadline', 'created-asc', 'created-desc', 'complexity'
};

export function applyKanbanFilters() {
  const filtered = state.tasks.filter(task => {
    // Search filter
    if (kanbanFilters.search) {
      const q = kanbanFilters.search.toLowerCase();
      const match = task.title.toLowerCase().includes(q) ||
                    (task.description || '').toLowerCase().includes(q) ||
                    (task.assignee || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    
    // Priority filter
    if (kanbanFilters.priority.length > 0) {
      if (!kanbanFilters.priority.includes(task.priority || 'med')) return false;
    }
    
    // Complexity filter
    if (kanbanFilters.complexity.length > 0) {
      if (!kanbanFilters.complexity.includes(task.complexity || 'medium')) return false;
    }
    
    // Tags filter
    if (kanbanFilters.tags.length > 0) {
      const taskTags = task.tags || [];
      const hasTag = kanbanFilters.tags.some(tag => taskTags.includes(tag));
      if (!hasTag) return false;
    }
    
    // Assignee filter
    if (kanbanFilters.assignee.length > 0) {
      if (!kanbanFilters.assignee.includes(task.assignee || '')) return false;
    }
    
    // Status filter
    if (kanbanFilters.status.length > 0) {
      if (!kanbanFilters.status.includes(task.status)) return false;
    }
    
    // Deadline filter
    if (kanbanFilters.deadline.from || kanbanFilters.deadline.to) {
      if (!task.deadline) {
        if (kanbanFilters.deadline.from || kanbanFilters.deadline.to) return false;
      } else {
        if (kanbanFilters.deadline.from && task.deadline < kanbanFilters.deadline.from) return false;
        if (kanbanFilters.deadline.to && task.deadline > kanbanFilters.deadline.to) return false;
      }
    }
    
    // Overdue filter
    if (kanbanFilters.deadline.overdue) {
      if (!task.deadline || task.completedAt || Date.now() <= task.deadline) return false;
    }
    
    return true;
  });
  
  // Apply sorting
  filtered.sort((a, b) => {
    switch (kanbanFilters.sort) {
      case 'priority':
        const pOrder = { high: 0, med: 1, low: 2 };
        return (pOrder[a.priority || 'med'] || 1) - (pOrder[b.priority || 'med'] || 1);
      case 'deadline':
        const aDeadline = a.deadline || Infinity;
        const bDeadline = b.deadline || Infinity;
        return aDeadline - bDeadline;
      case 'complexity':
        const cOrder = { low: 0, medium: 1, high: 2 };
        return (cOrder[a.complexity || 'medium'] || 1) - (cOrder[b.complexity || 'medium'] || 1);
      case 'created-asc':
        return (a.createdAt || 0) - (b.createdAt || 0);
      case 'created-desc':
      default:
        return (b.createdAt || 0) - (a.createdAt || 0);
    }
  });
  
  return filtered;
}

export function getFilterStats() {
  const all = state.tasks;
  return {
    total: all.length,
    filtered: applyKanbanFilters().length,
    overdue: all.filter(t => t.deadline && Date.now() > t.deadline && !t.completedAt).length,
    blocked: all.filter(t => t.status === 'blocked').length,
  };
}

export function clearAllFilters() {
  kanbanFilters.search = '';
  kanbanFilters.priority = [];
  kanbanFilters.complexity = [];
  kanbanFilters.tags = [];
  kanbanFilters.assignee = [];
  kanbanFilters.status = [];
  kanbanFilters.deadline = { from: null, to: null, overdue: false };
  kanbanFilters.sort = 'created-desc';
}

export function getAvailableTags() {
  const tags = new Set();
  state.tasks.forEach(t => {
    (t.tags || []).forEach(tag => tags.add(tag));
  });
  return Array.from(tags).sort();
}

export function getAvailableAssignees() {
  const assignees = new Set();
  state.tasks.forEach(t => {
    if (t.assignee) assignees.add(t.assignee);
  });
  return Array.from(assignees).sort();
}

export function toggleFilterPriority(priority) {
  const idx = kanbanFilters.priority.indexOf(priority);
  if (idx >= 0) {
    kanbanFilters.priority.splice(idx, 1);
  } else {
    kanbanFilters.priority.push(priority);
  }
}

export function toggleFilterComplexity(complexity) {
  const idx = kanbanFilters.complexity.indexOf(complexity);
  if (idx >= 0) {
    kanbanFilters.complexity.splice(idx, 1);
  } else {
    kanbanFilters.complexity.push(complexity);
  }
}

export function toggleFilterTag(tag) {
  const idx = kanbanFilters.tags.indexOf(tag);
  if (idx >= 0) {
    kanbanFilters.tags.splice(idx, 1);
  } else {
    kanbanFilters.tags.push(tag);
  }
}

export function toggleFilterAssignee(assignee) {
  const idx = kanbanFilters.assignee.indexOf(assignee);
  if (idx >= 0) {
    kanbanFilters.assignee.splice(idx, 1);
  } else {
    kanbanFilters.assignee.push(assignee);
  }
}

export function toggleFilterOverdue() {
  kanbanFilters.deadline.overdue = !kanbanFilters.deadline.overdue;
}

export function setSort(sortType) {
  kanbanFilters.sort = sortType;
}

export function setSearch(query) {
  kanbanFilters.search = query;
}
