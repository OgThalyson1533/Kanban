/**
 * LIFE CONTROL — Kanban Filters UI
 * Renderização da interface de filtros
 */

import { kanbanFilters, getFilterStats, getAvailableTags, getAvailableAssignees } from './kanban-filters.js';

export function renderKanbanFiltersBar() {
  const filterBar = document.getElementById('kanbanFilterBar');
  if (!filterBar) return;
  
  const stats = getFilterStats();
  const tags = getAvailableTags();
  const assignees = getAvailableAssignees();
  
  const hasActiveFilters = kanbanFilters.search.length > 0 ||
                           kanbanFilters.priority.length > 0 ||
                           kanbanFilters.complexity.length > 0 ||
                           kanbanFilters.tags.length > 0 ||
                           kanbanFilters.assignee.length > 0 ||
                           kanbanFilters.status.length > 0 ||
                           kanbanFilters.deadline.overdue;
  
  filterBar.innerHTML = `
    <div class="kanban-filters">
      <!-- Search -->
      <div class="kanban-filters__group">
        <input 
          class="kanban-filters__search input"
          type="text"
          placeholder="🔍 Buscar tarefas…"
          value="${kanbanFilters.search}"
          onkeyup="window._setSearch(this.value)"
          style="flex: 1; max-width: 250px; font-size: 11px;"
        />
      </div>
      
      <!-- Sort -->
      <div class="kanban-filters__group">
        <select class="input" style="font-size: 11px;" onchange="window._setSort(this.value)">
          <option value="created-desc" ${kanbanFilters.sort === 'created-desc' ? 'selected' : ''}>📅 Mais recentes</option>
          <option value="created-asc" ${kanbanFilters.sort === 'created-asc' ? 'selected' : ''}>📅 Mais antigas</option>
          <option value="priority" ${kanbanFilters.sort === 'priority' ? 'selected' : ''}>🔴 Por prioridade</option>
          <option value="deadline" ${kanbanFilters.sort === 'deadline' ? 'selected' : ''}>⏰ Por prazo</option>
          <option value="complexity" ${kanbanFilters.sort === 'complexity' ? 'selected' : ''}>📊 Por complexidade</option>
        </select>
      </div>
      
      <!-- Priority filter -->
      <div class="kanban-filters__group">
        <label class="kanban-filters__label">PRIORIDADE</label>
        <div class="kanban-filters__options">
          <button class="kanban-filters__btn ${kanbanFilters.priority.includes('high') ? 'kanban-filters__btn--active' : ''}"
                  onclick="window._toggleFilterPriority('high')" title="Alta">🔴</button>
          <button class="kanban-filters__btn ${kanbanFilters.priority.includes('med') ? 'kanban-filters__btn--active' : ''}"
                  onclick="window._toggleFilterPriority('med')" title="Média">🟡</button>
          <button class="kanban-filters__btn ${kanbanFilters.priority.includes('low') ? 'kanban-filters__btn--active' : ''}"
                  onclick="window._toggleFilterPriority('low')" title="Baixa">🟢</button>
        </div>
      </div>
      
      <!-- Complexity filter -->
      <div class="kanban-filters__group">
        <label class="kanban-filters__label">COMPLEXIDADE</label>
        <div class="kanban-filters__options">
          <button class="kanban-filters__btn ${kanbanFilters.complexity.includes('low') ? 'kanban-filters__btn--active' : ''}"
                  onclick="window._toggleFilterComplexity('low')" title="Baixa">L</button>
          <button class="kanban-filters__btn ${kanbanFilters.complexity.includes('medium') ? 'kanban-filters__btn--active' : ''}"
                  onclick="window._toggleFilterComplexity('medium')" title="Média">M</button>
          <button class="kanban-filters__btn ${kanbanFilters.complexity.includes('high') ? 'kanban-filters__btn--active' : ''}"
                  onclick="window._toggleFilterComplexity('high')" title="Alta">H</button>
        </div>
      </div>
      
      <!-- Overdue filter -->
      <div class="kanban-filters__group">
        <button class="kanban-filters__btn kanban-filters__btn--icon ${kanbanFilters.deadline.overdue ? 'kanban-filters__btn--active' : ''}"
                onclick="window._toggleFilterOverdue()" title="Mostrar apenas atrasadas">
          ⚠️ Atrasadas ${stats.overdue > 0 ? `(${stats.overdue})` : ''}
        </button>
      </div>
      
      <!-- Tags -->
      ${tags.length > 0 ? `
        <div class="kanban-filters__group">
          <label class="kanban-filters__label">TAGS</label>
          <div class="kanban-filters__options">
            ${tags.map(tag => `
              <button class="kanban-filters__btn ${kanbanFilters.tags.includes(tag) ? 'kanban-filters__btn--active' : ''}"
                      onclick="window._toggleFilterTag('${tag}')" title="${tag}">${tag}</button>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <!-- Assignees -->
      ${assignees.length > 0 ? `
        <div class="kanban-filters__group">
          <label class="kanban-filters__label">ATRIBUÍDO A</label>
          <div class="kanban-filters__options">
            ${assignees.map(assignee => `
              <button class="kanban-filters__btn kanban-filters__btn--small ${kanbanFilters.assignee.includes(assignee) ? 'kanban-filters__btn--active' : ''}"
                      onclick="window._toggleFilterAssignee('${_esc(assignee)}')" title="${assignee}">👤 ${_esc(assignee)}</button>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <!-- Stats -->
      <div class="kanban-filters__stats">
        ${hasActiveFilters ? `
          <span class="kanban-filters__stat">
            Mostrando <strong>${stats.filtered}</strong> de <strong>${stats.total}</strong>
          </span>
          <button class="kanban-filters__clear" onclick="window._clearAllFilters()">✕ Limpar filtros</button>
        ` : `
          <span class="kanban-filters__stat">
            <strong>${stats.total}</strong> tarefas
          </span>
        `}
      </div>
    </div>
  `;
}

function _esc(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
