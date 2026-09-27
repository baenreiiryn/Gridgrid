import './style.css';
import type { AppState, LayoutMode, PanelBounds, PanelConfig, WorkspaceConfig } from '../electron/types';

const appEl = document.querySelector<HTMLDivElement>('#app')!;
let state: AppState;
let stats = new Map<string, { memoryMB: number; pid: number }>();
let boundsRaf = 0;

function esc(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!);
}

function activeWorkspace(): WorkspaceConfig {
  return state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) ?? state.workspaces[0];
}

function layoutLabel(layout: LayoutMode): string {
  return ({ auto: 'Grade', columns: 'Colunas', rows: 'Linhas', focus: 'Foco' } as Record<LayoutMode, string>)[layout];
}

function render(): void {
  const workspace = activeWorkspace();
  const panels = workspace.panels;

  appEl.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">GG</div>
          <div><strong>Gridgrid</strong><span>multissessão local</span></div>
        </div>

        <div class="sidebar-title"><span>Workspaces</span><button id="add-workspace" title="Novo workspace">+</button></div>
        <div class="workspace-list">
          ${state.workspaces.map((item) => `
            <button class="workspace-item ${item.id === workspace.id ? 'active' : ''}" data-workspace="${item.id}">
              <span class="workspace-dot"></span>
              <span>${esc(item.name)}</span>
              <small>${item.panels.length}</small>
            </button>
          `).join('')}
        </div>

        <div class="sidebar-title accounts-title"><span>Contas</span><button id="add-panel" title="Nova conta">+</button></div>
        <div class="account-list">
          ${panels.length ? panels.map((panel) => `
            <button class="account-item ${workspace.focusedPanelId === panel.id ? 'selected' : ''}" data-panel-select="${panel.id}">
              <i style="--panel-color:${panel.color}"></i>
              <span><strong>${esc(panel.name)}</strong><small>${stats.get(panel.id)?.memoryMB ?? 0} MB</small></span>
              ${panel.muted ? '<b title="Silenciado">M</b>' : ''}
            </button>
          `).join('') : '<div class="empty-sidebar">Nenhuma conta neste workspace.</div>'}
        </div>

        <div class="sidebar-footer">
          <div><span>Sessões</span><strong>${panels.length}</strong></div>
          <div><span>Memória</span><strong>${panels.reduce((sum, panel) => sum + (stats.get(panel.id)?.memoryMB ?? 0), 0)} MB</strong></div>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <div class="workspace-heading">
            <button id="rename-workspace" class="ghost icon-button" title="Renomear">✎</button>
            <div><strong>${esc(workspace.name)}</strong><span>${panels.length} ${panels.length === 1 ? 'sessão' : 'sessões'} independente${panels.length === 1 ? '' : 's'}</span></div>
          </div>
          <div class="layout-switcher">
            ${(['auto', 'columns', 'rows', 'focus'] as LayoutMode[]).map((layout) => `
              <button class="${workspace.layout === layout ? 'active' : ''}" data-layout="${layout}">${layoutLabel(layout)}</button>
            `).join('')}
          </div>
          <button id="delete-workspace" class="ghost danger" ${state.workspaces.length <= 1 ? 'disabled' : ''}>Excluir workspace</button>
        </header>

        <section id="canvas" class="canvas layout-${workspace.layout}">
          ${panels.length ? panelCards(workspace) : emptyCanvas()}
        </section>

        <footer class="statusbar">
          <span><i class="online-dot"></i> Local</span>
          <span>${panels.length} WebContentsView</span>
          <span class="status-spacer"></span>
          <span>Gridgrid v0.1.0</span>
        </footer>
      </main>
    </div>
  `;

  bindEvents();
  scheduleBounds();
}

function panelCards(workspace: WorkspaceConfig): string {
  const panels = workspace.panels;
  const focusId = workspace.focusedPanelId ?? panels[0]?.id;
  return panels.map((panel) => {
    const hidden = workspace.layout === 'focus' && panel.id !== focusId;
    return `
      <article class="panel ${hidden ? 'panel-hidden' : ''}" data-panel-card="${panel.id}" style="--panel-color:${panel.color}">
        <div class="panel-toolbar">
          <button class="panel-focus-dot" data-action="focus" data-panel="${panel.id}" title="Focar"></button>
          <input class="panel-name" data-name="${panel.id}" value="${esc(panel.name)}" aria-label="Nome da conta" />
          <div class="panel-actions">
            <button data-action="zoom-out" data-panel="${panel.id}" title="Diminuir zoom">−</button>
            <span>${Math.round(panel.zoom * 100)}%</span>
            <button data-action="zoom-in" data-panel="${panel.id}" title="Aumentar zoom">+</button>
            <button data-action="mute" data-panel="${panel.id}" title="${panel.muted ? 'Ativar áudio' : 'Silenciar'}">${panel.muted ? '🔇' : '🔊'}</button>
            <button data-action="reload" data-panel="${panel.id}" title="Recarregar">↻</button>
            <button data-action="remove" data-panel="${panel.id}" title="Remover conta">×</button>
          </div>
        </div>
        <div class="address-row">
          <input data-url="${panel.id}" value="${esc(panel.url)}" aria-label="Endereço" />
          <button data-action="go" data-panel="${panel.id}">Ir</button>
        </div>
        <div class="web-slot" data-web-slot="${panel.id}"></div>
      </article>
    `;
  }).join('');
}

function emptyCanvas(): string {
  return `
    <div class="empty-canvas">
      <div class="empty-icon">▦</div>
      <h2>Nenhuma sessão aberta</h2>
      <p>Adicione uma conta. Cada painel terá cookies, cache e login próprios.</p>
      <button id="empty-add-panel" class="primary">Adicionar primeira conta</button>
    </div>
  `;
}

function bindEvents(): void {
  document.querySelectorAll<HTMLElement>('[data-workspace]').forEach((button) => {
    button.addEventListener('click', async () => {
      state = await window.gridgrid.setActiveWorkspace(button.dataset.workspace!);
      render();
    });
  });

  document.querySelector('#add-workspace')?.addEventListener('click', async () => {
    const name = prompt('Nome do workspace:', `Workspace ${state.workspaces.length + 1}`);
    if (name === null) return;
    state = await window.gridgrid.addWorkspace(name);
    render();
  });

  document.querySelector('#rename-workspace')?.addEventListener('click', async () => {
    const workspace = activeWorkspace();
    const name = prompt('Novo nome:', workspace.name);
    if (!name?.trim()) return;
    state = await window.gridgrid.renameWorkspace(workspace.id, name);
    render();
  });

  document.querySelector('#delete-workspace')?.addEventListener('click', async () => {
    const workspace = activeWorkspace();
    if (!confirm(`Excluir o workspace "${workspace.name}" e seus painéis?`)) return;
    state = await window.gridgrid.removeWorkspace(workspace.id);
    render();
  });

  const addPanel = async () => {
    const workspace = activeWorkspace();
    state = await window.gridgrid.addPanel(workspace.id, { url: 'https://huntera.com.br/' });
    render();
  };

  document.querySelector('#add-panel')?.addEventListener('click', addPanel);
  document.querySelector('#empty-add-panel')?.addEventListener('click', addPanel);

  document.querySelectorAll<HTMLElement>('[data-layout]').forEach((button) => {
    button.addEventListener('click', async () => {
      const workspace = activeWorkspace();
      state = await window.gridgrid.setLayout(workspace.id, button.dataset.layout as LayoutMode);
      render();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-panel-select]').forEach((button) => {
    button.addEventListener('click', async () => {
      const workspace = activeWorkspace();
      state = await window.gridgrid.focusPanel(workspace.id, button.dataset.panelSelect!);
      if (workspace.layout === 'focus') render();
      else {
        document.querySelector(`[data-panel-card="${button.dataset.panelSelect}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  });

  document.querySelectorAll<HTMLInputElement>('[data-name]').forEach((input) => {
    input.addEventListener('change', async () => {
      const workspace = activeWorkspace();
      state = await window.gridgrid.updatePanel(workspace.id, input.dataset.name!, { name: input.value });
      render();
    });
  });

  document.querySelectorAll<HTMLInputElement>('[data-url]').forEach((input) => {
    input.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') return;
      await window.gridgrid.navigatePanel(input.dataset.url!, input.value);
    });
  });

  document.querySelectorAll<HTMLElement>('[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.dataset.action!;
      const panelId = button.dataset.panel!;
      const workspace = activeWorkspace();
      const panel = workspace.panels.find((item) => item.id === panelId);
      if (!panel) return;

      if (action === 'reload') await window.gridgrid.reloadPanel(panelId);
      if (action === 'go') {
        const input = document.querySelector<HTMLInputElement>(`[data-url="${panelId}"]`);
        if (input) await window.gridgrid.navigatePanel(panelId, input.value);
      }
      if (action === 'mute') {
        state = await window.gridgrid.updatePanel(workspace.id, panelId, { muted: !panel.muted });
        render();
      }
      if (action === 'zoom-in' || action === 'zoom-out') {
        const step = action === 'zoom-in' ? 0.1 : -0.1;
        state = await window.gridgrid.updatePanel(workspace.id, panelId, { zoom: Math.round((panel.zoom + step) * 10) / 10 });
        render();
      }
      if (action === 'focus') {
        state = await window.gridgrid.focusPanel(workspace.id, panelId);
        if (workspace.layout === 'focus') render();
      }
      if (action === 'remove') {
        if (!confirm(`Remover "${panel.name}"? Os dados da sessão permanecem no computador por enquanto.`)) return;
        state = await window.gridgrid.removePanel(workspace.id, panelId);
        render();
      }
    });
  });
}

function scheduleBounds(): void {
  cancelAnimationFrame(boundsRaf);
  boundsRaf = requestAnimationFrame(sendBounds);
}

function sendBounds(): void {
  if (!state) return;
  const workspace = activeWorkspace();
  const items: PanelBounds[] = workspace.panels.map((panel) => {
    const slot = document.querySelector<HTMLElement>(`[data-web-slot="${panel.id}"]`);
    if (!slot || slot.offsetParent === null) {
      return { panelId: panel.id, x: 0, y: 0, width: 1, height: 1, visible: false };
    }
    const rect = slot.getBoundingClientRect();
    return {
      panelId: panel.id,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      visible: rect.width > 1 && rect.height > 1
    };
  });
  window.gridgrid.setPanelBounds(items);
}

new ResizeObserver(scheduleBounds).observe(document.documentElement);
window.addEventListener('resize', scheduleBounds);
window.addEventListener('scroll', scheduleBounds, true);

document.addEventListener('visibilitychange', scheduleBounds);

async function refreshStats(): Promise<void> {
  try {
    const values = await window.gridgrid.getRuntimeStats();
    stats = new Map(values.map((item) => [item.panelId, { memoryMB: item.memoryMB, pid: item.pid }]));
    document.querySelectorAll<HTMLElement>('[data-panel-select]').forEach((item) => {
      const panelId = item.dataset.panelSelect!;
      const small = item.querySelector('small');
      if (small) small.textContent = `${stats.get(panelId)?.memoryMB ?? 0} MB`;
    });
    const footer = document.querySelector('.sidebar-footer');
    if (footer) {
      const strongs = footer.querySelectorAll('strong');
      const workspace = activeWorkspace();
      if (strongs[1]) strongs[1].textContent = `${workspace.panels.reduce((sum, panel) => sum + (stats.get(panel.id)?.memoryMB ?? 0), 0)} MB`;
    }
  } catch {
    // Window may be closing.
  }
}

(async () => {
  state = await window.gridgrid.getState();
  render();
  await refreshStats();
  setInterval(refreshStats, 3000);
})();
