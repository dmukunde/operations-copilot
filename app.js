/**
 * Operations Copilot — Main application
 * Consumes data via OperationsCopilot.DataAdapter (simulated or future live providers).
 */
(function () {
  'use strict';

  const OC = window.OperationsCopilot;
  const WORKDAY_HOURS = 8;
  const BREAK_THRESHOLD_MINUTES = 90;
  const STORAGE_KEY = 'operationsCopilotTasks';
  const STORAGE_IMPORTED = 'operationsCopilotImported';

  let tasks = [];
  let inbox = [];
  let schedule = [];
  let morningBrief = null;
  let selectedTaskId = null;
  let demoLoaded = false;

  let focusSession = {
    active: false,
    elapsedSeconds: 0,
    onBreak: false,
    timerInterval: null
  };

  const els = {
    currentDate: document.getElementById('currentDate'),
    dataSourceBadge: document.getElementById('dataSourceBadge'),
    taskForm: document.getElementById('taskForm'),
    taskList: document.getElementById('taskList'),
    taskCount: document.getElementById('taskCount'),
    kpiTotal: document.getElementById('kpiTotal'),
    kpiHigh: document.getElementById('kpiHigh'),
    kpiHours: document.getElementById('kpiHours'),
    kpiFocus: document.getElementById('kpiFocus'),
    kpiHighValue: document.getElementById('kpiHighValue'),
    kpiBreak: document.getElementById('kpiBreak'),
    kpiBreakCard: document.querySelector('.kpi-card.kpi-break'),
    morningBrief: document.getElementById('morningBrief'),
    briefSource: document.getElementById('briefSource'),
    smartInbox: document.getElementById('smartInbox'),
    inboxCount: document.getElementById('inboxCount'),
    todaySchedule: document.getElementById('todaySchedule'),
    scheduleCount: document.getElementById('scheduleCount'),
    productivityAnalytics: document.getElementById('productivityAnalytics'),
    workloadCheck: document.getElementById('workloadCheck'),
    focusTimeline: document.getElementById('focusTimeline'),
    breakMessage: document.getElementById('breakMessage'),
    breakTimer: document.getElementById('breakTimer'),
    breakRecommendation: document.getElementById('breakRecommendation'),
    breakIntelligence: document.getElementById('breakIntelligence'),
    startFocusBtn: document.getElementById('startFocusBtn'),
    endFocusBtn: document.getElementById('endFocusBtn'),
    takeBreakBtn: document.getElementById('takeBreakBtn'),
    opsAssistant: document.getElementById('opsAssistant'),
    assistantStatus: document.getElementById('assistantStatus'),
    loadDemoBtn: document.getElementById('loadDemoBtn'),
    demoToast: document.getElementById('demoToast'),
    executiveDashboard: document.getElementById('executiveDashboard'),
    execSource: document.getElementById('execSource'),
    opsBrief: document.getElementById('opsBrief'),
    copyBriefBtn: document.getElementById('copyBriefBtn'),
    copyCustomerBtn: document.getElementById('copyCustomerBtn'),
    copyEscalationBtn: document.getElementById('copyEscalationBtn'),
    markCompleteBtn: document.getElementById('markCompleteBtn'),
    deferTaskBtn: document.getElementById('deferTaskBtn'),
    deferLowBtn: document.getElementById('deferLowBtn'),
    endOfDayInsight: document.getElementById('endOfDayInsight'),
    assistantAiBadge: document.getElementById('assistantAiBadge')
  };

  let selectedTaskIntelligence = null;

  function getActiveTasks() {
    return tasks.filter((t) => (t.status || 'active') === 'active');
  }

  function getDeferredTasks() {
    return tasks.filter((t) => t.status === 'deferred');
  }

  function copyWithFeedback(btn, text) {
    navigator.clipboard.writeText(text).then(() => {
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('btn-success-flash');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('btn-success-flash');
      }, 2000);
    });
  }

  // ── Utilities ─────────────────────────────────────────────────

  function generateId(suffix) {
    return 'task_' + Date.now() + '_' + (suffix ?? Math.random().toString(36).slice(2, 7));
  }

  function deadlineOffsetHours(hours) {
    const d = new Date();
    d.setTime(d.getTime() + hours * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatDate(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  function formatDeadline(iso) {
    const d = new Date(iso);
    const diffHours = (d - Date.now()) / (1000 * 60 * 60);
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (diffHours < 0) return `${timeStr} (overdue)`;
    if (diffHours < 1) return `${timeStr} (${Math.round(diffHours * 60)}m left)`;
    if (diffHours < 24) return `${timeStr} (${Math.round(diffHours)}h left)`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + timeStr;
  }

  function formatTimer(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function badgeClass(priority) {
    return { High: 'badge-high', Medium: 'badge-medium', Low: 'badge-low' }[priority] || 'badge-muted';
  }

  function priorityWeight(p) {
    return { High: 30, Medium: 20, Low: 10 }[p] || 10;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    if (demoLoaded) {
      localStorage.setItem(STORAGE_IMPORTED, JSON.stringify({ inbox, schedule, morningBrief, selectedTaskId }));
    } else {
      localStorage.removeItem(STORAGE_IMPORTED);
    }
  }

  function loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) tasks = JSON.parse(stored);
    } catch (_) { tasks = []; }

    try {
      const imported = localStorage.getItem(STORAGE_IMPORTED);
      if (imported) {
        const data = JSON.parse(imported);
        inbox = data.inbox || [];
        schedule = data.schedule || [];
        morningBrief = data.morningBrief || null;
        selectedTaskId = data.selectedTaskId || null;
        demoLoaded = true;
        OC.DataAdapter.useProvider(OC.SimulatedData.createAirFreightDemoDay());
      }
    } catch (_) { /* keep defaults */ }
  }

  // ── Prioritization ──────────────────────────────────────────────

  function computeTaskScore(task) {
    const hoursUntil = (new Date(task.deadline) - Date.now()) / (1000 * 60 * 60);
    let score = priorityWeight(task.priority);
    if (hoursUntil < 0) score += 40;
    else if (hoursUntil < 1) score += 35;
    else if (hoursUntil < 3) score += 25;
    else if (hoursUntil < 6) score += 15;
    else if (hoursUntil < 24) score += 8;
    else score += 2;
    if (task.estimatedMinutes <= 15 && hoursUntil < 3) score += 5;
    if (task.estimatedMinutes >= 90 && hoursUntil > 6) score -= 5;
    if (task.energyRequired === 'High' && hoursUntil < 4) score += 8;
    if (task.blocksOtherWork) score += 20;
    if (['Shipment', 'Customer', 'Customs'].includes(task.category) && task.priority === 'High') score += 10;
    return Math.round(score);
  }

  function getRankedTasks() {
    return getActiveTasks()
      .map((t) => ({ ...t, score: computeTaskScore(t) }))
      .sort((a, b) => b.score - a.score);
  }

  function isUrgent(task) {
    const hoursUntil = (new Date(task.deadline) - Date.now()) / (1000 * 60 * 60);
    return task.priority === 'High' || hoursUntil < 2 || hoursUntil < 0;
  }

  function computeFocusScore() {
    const active = getActiveTasks();
    if (!active.length) return null;
    const ranked = getRankedTasks();
    const totalMinutes = active.reduce((s, t) => s + t.estimatedMinutes, 0);
    const urgentCount = active.filter(isUrgent).length;
    const blockingCount = active.filter((t) => t.blocksOtherWork).length;
    let score = 100;
    const ratio = totalMinutes / (WORKDAY_HOURS * 60);
    if (ratio > 1.2) score -= 25;
    else if (ratio > 1) score -= 15;
    else if (ratio > 0.85) score -= 5;
    if (urgentCount > 5) score -= 20;
    else if (urgentCount > 3) score -= 10;
    if (ranked.length >= 3 && ranked[0].score - ranked[2].score > 15) score += 5;
    score -= blockingCount * 5;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // ── Data Source Badge ───────────────────────────────────────────

  function renderDataSourceBadge() {
    const meta = OC.DataAdapter.getMeta();
    if (meta.mode === 'simulated') {
      els.dataSourceBadge.innerHTML = '<span class="sim-indicator"></span> Simulated imports active — Outlook · Teams · Gmail · Calendar · CargoWise · Airlines';
      els.dataSourceBadge.classList.add('sim-active');
    } else {
      els.dataSourceBadge.textContent = 'Local tasks only — load demo for simulated imports';
      els.dataSourceBadge.classList.remove('sim-active');
    }
  }

  // ── Morning Brief ───────────────────────────────────────────────

  function renderMorningBrief() {
    if (!morningBrief) {
      els.briefSource.textContent = 'Awaiting data';
      els.morningBrief.innerHTML = '<p class="empty-state">Load the Air Freight Demo Day to see your simulated morning brief.</p>';
      return;
    }

    els.briefSource.textContent = 'Simulated digest';
    const m = morningBrief.metrics;
    els.morningBrief.innerHTML = `
      <p class="brief-greeting">${escapeHtml(morningBrief.greeting)} — ${formatDate(new Date())}</p>
      <p class="brief-summary">${escapeHtml(morningBrief.summary)}</p>
      <ul class="brief-highlights">${morningBrief.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>
      <div class="brief-metrics">
        <span class="brief-metric"><strong>${m.actionEmails}</strong> action emails</span>
        <span class="brief-metric"><strong>${m.meetingsToday}</strong> meetings</span>
        <span class="brief-metric"><strong>${m.criticalTasks}</strong> critical tasks</span>
        <span class="brief-metric"><strong>${m.blockingTasks}</strong> blockers</span>
      </div>
      <p class="brief-first-move"><strong>Start here:</strong> ${escapeHtml(morningBrief.suggestedFirstMove)}</p>
    `;
  }

  // ── Executive Operations Dashboard ──────────────────────────────

  function computeExecutiveFromTasks(active) {
    const shipmentTasks = active.filter((t) => t.category === 'Shipment');
    const atRisk = active.filter((t) => t.priority === 'High' && (isUrgent(t) || t.blocksOtherWork));
    return {
      shipmentsOnTrack: Math.max(0, shipmentTasks.length - atRisk.length),
      shipmentsAtRisk: atRisk.length,
      criticalBlockers: active.filter((t) => t.blocksOtherWork).length,
      revenueAtRiskFormatted: '—',
      slaAtRisk: active.filter((t) => new Date(t.deadline) < new Date()).length,
      avgDelayExposure: '—',
      leadershipAction: atRisk[0]
        ? `Prioritize "${atRisk[0].name}" and clear blocking items before end of day.`
        : 'Review task queue and confirm priorities with the team.',
      atRiskShipments: []
    };
  }

  function renderExecutiveDashboard() {
    const active = getActiveTasks();
    let exec = OC.DataAdapter.getExecutiveDashboard(active);
    if (!exec && active.length) exec = computeExecutiveFromTasks(active);

    if (!exec) {
      els.execSource.textContent = 'Awaiting data';
      els.executiveDashboard.innerHTML = '<p class="empty-state">Load demo data to view network-wide shipment health and leadership metrics.</p>';
      return;
    }

    els.execSource.textContent = demoLoaded ? 'Simulated CargoWise / TMS' : 'Computed from tasks';

    const riskList = exec.atRiskShipments?.length
      ? `<div class="exec-risk-list">${exec.atRiskShipments.map((s) =>
          `<div class="exec-risk-item"><strong>${escapeHtml(s.awb)}</strong> ${escapeHtml(s.route)} · ${escapeHtml(s.customer)} · $${Math.round(s.valueUsd / 1000)}K</div>`
        ).join('')}</div>`
      : '';

    els.executiveDashboard.innerHTML = `
      <div class="exec-metrics">
        <div class="exec-metric exec-on-track">
          <span class="exec-metric-label">Shipments on Track</span>
          <span class="exec-metric-value">${exec.shipmentsOnTrack}</span>
          <span class="exec-metric-sub">${exec.totalActiveShipments ? `of ${exec.totalActiveShipments} active` : 'active lane'}</span>
        </div>
        <div class="exec-metric exec-at-risk">
          <span class="exec-metric-label">Shipments at Risk</span>
          <span class="exec-metric-value">${exec.shipmentsAtRisk}</span>
          <span class="exec-metric-sub">require intervention</span>
        </div>
        <div class="exec-metric exec-blockers">
          <span class="exec-metric-label">Critical Blockers</span>
          <span class="exec-metric-value">${exec.criticalBlockers}</span>
          <span class="exec-metric-sub">blocking downstream</span>
        </div>
        <div class="exec-metric exec-revenue">
          <span class="exec-metric-label">Revenue at Risk</span>
          <span class="exec-metric-value">${escapeHtml(exec.revenueAtRiskFormatted || '—')}</span>
          <span class="exec-metric-sub">exposed shipment value</span>
        </div>
        <div class="exec-metric exec-sla">
          <span class="exec-metric-label">SLA at Risk</span>
          <span class="exec-metric-value">${exec.slaAtRisk}</span>
          <span class="exec-metric-sub">customer contracts</span>
        </div>
        <div class="exec-metric exec-delay">
          <span class="exec-metric-label">Avg Delay Exposure</span>
          <span class="exec-metric-value">${escapeHtml(exec.avgDelayExposure)}</span>
          <span class="exec-metric-sub">at-risk shipments</span>
        </div>
      </div>
      ${riskList}
      <div class="exec-leadership">
        <h3>Recommended Leadership Action</h3>
        <p>${escapeHtml(exec.leadershipAction)}</p>
      </div>
    `;
  }

  // ── Operations Brief ────────────────────────────────────────────

  function buildOpsBriefData() {
    const ranked = getRankedTasks();
    const now = Date.now();
    const top3 = ranked.slice(0, 3);
    const risks = [];
    ranked.forEach((t) => {
      const h = (new Date(t.deadline) - now) / (1000 * 60 * 60);
      if (t.blocksOtherWork) risks.push(`${t.name} — blocking downstream work`);
      if (h < 0) risks.push(`${t.name} — overdue by ${Math.abs(Math.round(h))}h`);
      if (t.category === 'Customs' && t.priority === 'High') risks.push(`Customs risk: ${t.name}`);
    });
    const delayedUrgent = ranked.filter((t) => {
      const h = (new Date(t.deadline) - now) / (1000 * 60 * 60);
      return h < 0 || (t.priority === 'High' && h < 4);
    });
    const actions = [];
    if (top3[0]) actions.push(`Address "${top3[0].name}" immediately (${top3[0].estimatedMinutes} min)`);
    const blocking = ranked.find((t) => t.blocksOtherWork);
    if (blocking && blocking.id !== top3[0]?.id) actions.push(`Unblock: ${blocking.name}`);
    const customerEsc = ranked.find((t) => t.category === 'Customer' && t.priority === 'High');
    if (customerEsc) actions.push(`Send customer update: ${customerEsc.name}`);
    return { top3, risks, delayedUrgent, actions };
  }

  function generateOperationsBriefText() {
    const active = getActiveTasks();
    if (!active.length) return '';
    const { top3, risks, delayedUrgent, actions } = buildOpsBriefData();
    const exec = OC.DataAdapter.getExecutiveDashboard(active) || computeExecutiveFromTasks(active);
    const lines = [
      'OPERATIONS BRIEF — ' + formatDate(new Date()),
      '',
      'EXECUTIVE SUMMARY',
      `Shipments on track: ${exec.shipmentsOnTrack} | At risk: ${exec.shipmentsAtRisk} | Blockers: ${exec.criticalBlockers}`,
      `Revenue at risk: ${exec.revenueAtRiskFormatted || 'N/A'} | SLA at risk: ${exec.slaAtRisk}`,
      '',
      'TOP 3 PRIORITIES',
      ...top3.map((t, i) => `${i + 1}. ${t.name} (${t.category}, due ${formatDeadline(t.deadline)})`),
      '',
      'RISKS',
      ...(risks.length ? risks.slice(0, 5).map((r) => '• ' + r) : ['• None identified']),
      '',
      'DELAYED / URGENT',
      ...(delayedUrgent.length ? delayedUrgent.slice(0, 5).map((t) => '• ' + t.name + ' — ' + formatDeadline(t.deadline)) : ['• None']),
      '',
      'SUGGESTED ACTIONS',
      ...actions.slice(0, 4).map((a) => '• ' + a),
      '',
      'LEADERSHIP ACTION',
      exec.leadershipAction
    ];
    return lines.join('\n');
  }

  function renderOpsBrief() {
    const active = getActiveTasks();
    if (!active.length) {
      els.opsBrief.innerHTML = '<p class="empty-state">Your daily operations briefing generates from active tasks and shipment data.</p>';
      return;
    }
    const { top3, risks, delayedUrgent, actions } = buildOpsBriefData();
    els.opsBrief.innerHTML = `
      <div class="brief-section">
        <h3>Top 3 Priorities</h3>
        <ul>${top3.map((t, i) => `<li><strong>#${i + 1}</strong> ${escapeHtml(t.name)} — ${t.category}, due ${formatDeadline(t.deadline)}</li>`).join('')}</ul>
      </div>
      <div class="brief-section brief-risks">
        <h3>Risks</h3>
        <ul>${risks.length ? risks.slice(0, 5).map((r) => `<li>${escapeHtml(r)}</li>`).join('') : '<li>No critical risks identified</li>'}</ul>
      </div>
      <div class="brief-section brief-urgent">
        <h3>Delayed / Urgent Items</h3>
        <ul>${delayedUrgent.length ? delayedUrgent.slice(0, 5).map((t) => `<li>${escapeHtml(t.name)} — ${formatDeadline(t.deadline)}</li>`).join('') : '<li>No delayed items</li>'}</ul>
      </div>
      <div class="brief-section brief-actions">
        <h3>Suggested Next Actions</h3>
        <ul>${actions.slice(0, 4).map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
      </div>
    `;
  }

  // ── Command Actions ─────────────────────────────────────────────

  function updateCommandButtons() {
    const active = getActiveTasks();
    const selected = tasks.find((t) => t.id === selectedTaskId);
    const isActive = selected && (selected.status || 'active') === 'active';
    const lowValueCount = active.filter((t) =>
      t.valueTier === 'low' || (t.priority === 'Low' && ['Admin', 'Email'].includes(t.category))
    ).length;

    els.copyBriefBtn.disabled = active.length === 0;
    els.copyCustomerBtn.disabled = !selectedTaskIntelligence?.customerUpdate || !isActive;
    els.copyEscalationBtn.disabled = !selected || selected.status === 'completed';
    els.markCompleteBtn.disabled = !selected || selected.status === 'completed';
    els.deferTaskBtn.disabled = !isActive;
    els.deferLowBtn.disabled = lowValueCount === 0;
  }

  function handleCopyEscalation() {
    if (!selectedTaskIntelligence?.escalationNote) {
      const task = tasks.find((t) => t.id === selectedTaskId);
      if (task) selectedTaskIntelligence = OC.TaskIntelligence.analyze(task, { schedule, inbox });
    }
    if (selectedTaskIntelligence?.escalationNote) {
      copyWithFeedback(els.copyEscalationBtn, selectedTaskIntelligence.escalationNote);
    }
  }

  function handleDeferTask() {
    const task = tasks.find((t) => t.id === selectedTaskId);
    if (!task || (task.status || 'active') !== 'active') return;
    task.status = 'deferred';
    task.deferredAt = new Date().toISOString();
    selectedTaskId = getRankedTasks()[0]?.id || null;
    selectedTaskIntelligence = null;
    saveState();
    renderAll();
    updateBreakUI();
    els.demoToast.textContent = `Deferred: ${task.name}`;
    els.demoToast.hidden = false;
    setTimeout(() => { els.demoToast.hidden = true; }, 4000);
  }

  function handleCopyBrief() {
    const text = generateOperationsBriefText();
    if (text) copyWithFeedback(els.copyBriefBtn, text);
  }

  function handleCopyCustomer() {
    const text = selectedTaskIntelligence?.customerUpdate;
    if (!text) return;
    copyWithFeedback(els.copyCustomerBtn, text);
  }

  function handleMarkComplete() {
    const task = tasks.find((t) => t.id === selectedTaskId);
    if (!task || task.status === 'completed') return;
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    selectedTaskId = getRankedTasks()[0]?.id || null;
    selectedTaskIntelligence = selectedTaskId
      ? OC.TaskIntelligence.analyze(tasks.find((t) => t.id === selectedTaskId), { schedule, inbox })
      : null;
    saveState();
    renderAll();
    updateBreakUI();
    els.demoToast.textContent = `Task completed: ${task.name} — KPIs, workload, and focus plan updated.`;
    els.demoToast.hidden = false;
    setTimeout(() => { els.demoToast.hidden = true; }, 4000);
  }

  function handleDeferLowValue() {
    let count = 0;
    getActiveTasks().forEach((t) => {
      if (t.valueTier === 'low' || (t.priority === 'Low' && ['Admin', 'Email'].includes(t.category))) {
        t.status = 'deferred';
        t.deferredAt = new Date().toISOString();
        count++;
      }
    });
    if (selectedTaskId && tasks.find((t) => t.id === selectedTaskId)?.status === 'deferred') {
      selectedTaskId = getRankedTasks()[0]?.id || null;
    }
    saveState();
    renderAll();
    updateBreakUI();
    els.demoToast.textContent = `${count} low-value task${count !== 1 ? 's' : ''} deferred to end of day.`;
    els.demoToast.hidden = false;
    setTimeout(() => { els.demoToast.hidden = true; }, 4000);
  }

  // ── Smart Inbox ─────────────────────────────────────────────────

  function renderSmartInbox() {
    const actionEmails = inbox.filter((e) => e.requiresAction);
    els.inboxCount.textContent = `${actionEmails.length} action`;

    if (!actionEmails.length) {
      els.smartInbox.innerHTML = '<p class="empty-state">No action-required emails.</p>';
      return;
    }

    els.smartInbox.innerHTML = actionEmails.map((email) => `
      <article class="inbox-item ${email.priority === 'High' ? 'inbox-urgent' : ''}" data-email-id="${email.id}" data-task-id="${email.linkedTaskId || ''}">
        <div class="inbox-header">
          <span class="badge ${badgeClass(email.priority)}">${email.priority}</span>
          <span class="inbox-source">${escapeHtml(email.source.replace('simulated-', ''))}</span>
        </div>
        <h4 class="inbox-subject">${escapeHtml(email.subject)}</h4>
        <p class="inbox-from">${escapeHtml(email.from)}</p>
        <p class="inbox-preview">${escapeHtml(email.preview)}</p>
        <p class="inbox-action-reason"><strong>Action:</strong> ${escapeHtml(email.actionReason)}</p>
        ${email.linkedTaskId ? `<button type="button" class="btn btn-sm btn-link inbox-link-task" data-task-id="${email.linkedTaskId}">Open linked task →</button>` : ''}
      </article>
    `).join('');

    els.smartInbox.querySelectorAll('.inbox-link-task').forEach((btn) => {
      btn.addEventListener('click', () => selectTask(btn.dataset.taskId));
    });
  }

  // ── Today's Schedule ────────────────────────────────────────────

  function renderSchedule() {
    els.scheduleCount.textContent = `${schedule.length} events`;

    if (!schedule.length) {
      els.todaySchedule.innerHTML = '<p class="empty-state">No schedule loaded.</p>';
      return;
    }

    const typeIcon = { meeting: '📅', operational: '⚙️', break: '☕' };
    const sorted = [...schedule].sort((a, b) => a.startTime.localeCompare(b.startTime));

    els.todaySchedule.innerHTML = sorted.map((ev) => `
      <div class="schedule-item schedule-${ev.type}" data-task-id="${ev.linkedTaskId || ''}">
        <div class="schedule-time">${ev.startTime} – ${ev.endTime}</div>
        <div class="schedule-body">
          <span class="schedule-type">${typeIcon[ev.type] || '•'} ${ev.type}</span>
          <h4 class="schedule-title">${escapeHtml(ev.title)}</h4>
          ${ev.location ? `<p class="schedule-location">${escapeHtml(ev.location)}</p>` : ''}
          ${ev.attendees?.length ? `<p class="schedule-attendees">${escapeHtml(ev.attendees.join(', '))}</p>` : ''}
        </div>
        ${ev.linkedTaskId ? `<button type="button" class="btn btn-sm btn-link schedule-link-task" data-task-id="${ev.linkedTaskId}">View task</button>` : ''}
      </div>
    `).join('');

    els.todaySchedule.querySelectorAll('.schedule-link-task').forEach((btn) => {
      btn.addEventListener('click', () => selectTask(btn.dataset.taskId));
    });
  }

  // ── Productivity Analytics ──────────────────────────────────────

  function renderProductivityAnalytics() {
    const active = getActiveTasks();
    if (!active.length) {
      els.productivityAnalytics.innerHTML = '<p class="empty-state">Analytics appear when tasks are loaded.</p>';
      els.kpiHighValue.textContent = '—';
      renderEndOfDayInsight();
      return;
    }

    const analytics = OC.DataAdapter.getProductivityAnalytics(active);
    const total = analytics.highValueMinutes + analytics.mediumValueMinutes + analytics.lowValueMinutes;
    const highW = Math.round((analytics.highValueMinutes / total) * 100);
    const medW = Math.round((analytics.mediumValueMinutes / total) * 100);
    const lowW = 100 - highW - medW;

    const categories = Object.entries(analytics.byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    els.productivityAnalytics.innerHTML = `
      <div class="analytics-bars">
        <div class="analytics-bar-row">
          <span class="analytics-label">High-value</span>
          <div class="analytics-bar"><div class="analytics-fill fill-high" style="width:${highW}%"></div></div>
          <span class="analytics-pct">${analytics.highValuePercent}%</span>
        </div>
        <div class="analytics-bar-row">
          <span class="analytics-label">Medium</span>
          <div class="analytics-bar"><div class="analytics-fill fill-medium" style="width:${medW}%"></div></div>
          <span class="analytics-pct">${Math.round((analytics.mediumValueMinutes / total) * 100)}%</span>
        </div>
        <div class="analytics-bar-row">
          <span class="analytics-label">Low-value</span>
          <div class="analytics-bar"><div class="analytics-fill fill-low" style="width:${lowW}%"></div></div>
          <span class="analytics-pct">${analytics.lowValuePercent}%</span>
        </div>
      </div>
      <p class="analytics-insight">${escapeHtml(analytics.insight)}</p>
      <div class="analytics-categories">
        <h4>By category (minutes)</h4>
        <ul>${categories.map(([cat, min]) => `<li><span>${escapeHtml(cat)}</span><span>${min}m</span></li>`).join('')}</ul>
      </div>
    `;

    els.kpiHighValue.textContent = analytics.highValuePercent + '%';
    renderEndOfDayInsight();
  }

  function renderEndOfDayInsight() {
    const insight = OC.TaskIntelligence.endOfDayInsight(tasks);
    if (!insight.message) {
      els.endOfDayInsight.hidden = true;
      return;
    }
    els.endOfDayInsight.hidden = false;
    els.endOfDayInsight.innerHTML = `
      <div class="eod-icon">📊</div>
      <div class="eod-body">
        <h4>End-of-Day Insight</h4>
        <p>${escapeHtml(insight.message)}</p>
        <span class="eod-meta">${insight.totalHours}h planned · ${insight.completedCount} completed · ${insight.lowValuePercent}% low-value</span>
      </div>
    `;
  }

  // ── Workload Reality Check ──────────────────────────────────────

  function renderWorkloadCheck() {
    const active = getActiveTasks();
    if (!active.length) {
      els.workloadCheck.innerHTML = '<p class="workload-message">Add tasks to see your workload analysis.</p>';
      return;
    }

    const totalMinutes = active.reduce((s, t) => s + t.estimatedMinutes, 0);
    const meetingMinutes = schedule.filter((s) => s.type === 'meeting').reduce((s, ev) => {
      const [sh, sm] = ev.startTime.split(':').map(Number);
      const [eh, em] = ev.endTime.split(':').map(Number);
      return s + (eh * 60 + em) - (sh * 60 + sm);
    }, 0);
    const combinedMinutes = totalMinutes + meetingMinutes;
    const totalHours = (combinedMinutes / 60).toFixed(1);
    const capacityMinutes = WORKDAY_HOURS * 60;
    const diffMinutes = combinedMinutes - capacityMinutes;
    const urgentCount = active.filter(isUrgent).length;
    const trulyUrgent = active.filter((t) => {
      const h = (new Date(t.deadline) - Date.now()) / (1000 * 60 * 60);
      return t.priority === 'High' && (h < 4 || h < 0);
    }).length;

    let detail = '';
    let statusClass = 'workload-balanced';
    if (diffMinutes > 0) {
      detail = `Your schedule is overloaded by ${(diffMinutes / 60).toFixed(1)} hours (tasks + meetings).`;
      statusClass = 'workload-overloaded';
    } else if (urgentCount > 3 && trulyUrgent <= 3) {
      detail = `You are busy, but only ${trulyUrgent} task${trulyUrgent !== 1 ? 's are' : ' is'} truly critical right now.`;
      statusClass = 'workload-busy';
    } else if (combinedMinutes > capacityMinutes * 0.85) {
      detail = 'Nearly at capacity — defer low-value admin and batch documentation.';
      statusClass = 'workload-busy';
    } else {
      detail = 'Workload is demanding but manageable with focused sequencing.';
      statusClass = 'workload-balanced';
    }

    const barPct = Math.min(100, (combinedMinutes / capacityMinutes) * 100);
    const barColor = diffMinutes > 0 ? 'var(--high-red)' : barPct > 85 ? 'var(--medium-amber)' : 'var(--success)';

    els.workloadCheck.innerHTML = `
      <p class="workload-message">You have ${totalHours} hours of planned work today.</p>
      <p class="workload-detail ${statusClass}">${detail}</p>
      <div class="workload-bar"><div class="workload-bar-fill" style="width:${barPct}%;background:${barColor}"></div></div>
      <p class="workload-detail">${WORKDAY_HOURS}h capacity · ${urgentCount} urgent · ${trulyUrgent} critical · ${meetingMinutes}m in meetings</p>
    `;
  }

  // ── AI Focus Planner Timeline ───────────────────────────────────

  function renderFocusTimeline() {
    const active = getActiveTasks();
    if (!active.length) {
      els.focusTimeline.innerHTML = '<p class="empty-state">Timeline generates from tasks and schedule.</p>';
      return;
    }

    const ranked = getRankedTasks();
    const blocks = [];

    schedule.forEach((ev) => {
      blocks.push({
        time: ev.startTime,
        endTime: ev.endTime,
        label: ev.title,
        type: ev.type,
        kind: 'schedule'
      });
    });

    let cursorHour = 8.5;
    ranked.slice(0, 5).forEach((task, i) => {
      if (blocks.find((b) => b.label === task.name)) return;
      const startH = Math.floor(cursorHour);
      const startM = Math.round((cursorHour - startH) * 60);
      const endCursor = cursorHour + task.estimatedMinutes / 60;
      const endH = Math.floor(endCursor);
      const endM = Math.round((endCursor - endH) * 60);
      const fmt = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      blocks.push({
        time: fmt(startH, startM),
        endTime: fmt(endH, endM),
        label: task.name,
        type: i === 0 ? 'priority' : 'task',
        kind: 'planned',
        minutes: task.estimatedMinutes
      });
      cursorHour = endCursor + 0.17;
    });

    blocks.sort((a, b) => a.time.localeCompare(b.time));

    els.focusTimeline.innerHTML = `
      <div class="timeline-legend">
        <span class="tl-legend-item tl-priority">Priority focus</span>
        <span class="tl-legend-item tl-meeting">Meeting</span>
        <span class="tl-legend-item tl-task">Planned work</span>
        <span class="tl-legend-item tl-break">Break</span>
      </div>
      <div class="timeline-track">
        ${blocks.map((b) => `
          <div class="timeline-block block-${b.type}" data-task-match="${escapeHtml(b.label)}">
            <div class="timeline-time">${b.time}${b.endTime ? ' – ' + b.endTime : ''}</div>
            <div class="timeline-label">${escapeHtml(b.label)}</div>
            ${b.minutes ? `<div class="timeline-meta">${b.minutes}m · AI-suggested slot</div>` : ''}
          </div>
        `).join('')}
      </div>
      <p class="timeline-note">Timeline merges simulated calendar blocks with AI-ranked task slots. Defer: ${escapeHtml(ranked.filter((t) => t.priority === 'Low').slice(0, 2).map((t) => t.name).join('; ') || 'none')}</p>
    `;
  }

  // ── Break Intelligence ──────────────────────────────────────────

  function renderBreakIntelligence() {
    const active = getActiveTasks();
    if (!active.length) {
      els.breakIntelligence.innerHTML = '';
      return;
    }

    const ranked = getRankedTasks();
    const highEnergy = ranked.filter((t) => t.energyRequired === 'High');
    const nextMeeting = schedule.filter((s) => s.type === 'meeting').sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
    const mins = Math.floor(focusSession.elapsedSeconds / 60);

    const tips = [];
    if (highEnergy.length >= 2) {
      tips.push(`Schedule a 10-min break between "${highEnergy[0].name}" and "${highEnergy[1].name}".`);
    }
    if (nextMeeting) {
      tips.push(`Next meeting at ${nextMeeting.startTime} — wrap deep work 5 min early.`);
    }
    if (focusSession.active && mins >= BREAK_THRESHOLD_MINUTES) {
      tips.push(`You've worked ${mins} minutes. Take a short break before the next high-risk task.`);
    } else if (!focusSession.active) {
      tips.push('Start a focus session before tackling the Dubai delay or customs hold.');
    }
    tips.push('Optimal rhythm: 90 min focus → 10 min break → next critical task.');

    els.breakIntelligence.innerHTML = `<ul class="break-tips">${tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
  }

  function renderBreakRecommendation() {
    const active = getActiveTasks();
    if (!active.length || focusSession.active) {
      els.breakRecommendation.hidden = true;
      return;
    }
    const ranked = getRankedTasks();
    const top = ranked[0];
    const highEnergy = ranked.filter((t) => t.energyRequired === 'High');
    let text = `<strong>Break Intelligence:</strong> Start with "${top.name}". `;
    text += highEnergy.length >= 2
      ? 'Take a 5–10 min break after your first high-energy task.'
      : 'Maintain 90-minute focus cycles with short breaks.';
    els.breakRecommendation.innerHTML = text;
    els.breakRecommendation.className = 'break-recommendation demo-loaded';
    els.breakRecommendation.hidden = false;
  }

  function updateBreakUI() {
    const mins = Math.floor(focusSession.elapsedSeconds / 60);

    if (focusSession.onBreak) {
      els.breakMessage.textContent = 'On break — rest before your next high-focus task.';
      els.breakTimer.textContent = formatTimer(focusSession.elapsedSeconds);
      els.startFocusBtn.disabled = true;
      els.endFocusBtn.disabled = false;
      els.takeBreakBtn.disabled = true;
    } else if (focusSession.active) {
      els.breakTimer.textContent = formatTimer(focusSession.elapsedSeconds);
      els.startFocusBtn.disabled = true;
      els.endFocusBtn.disabled = false;
      els.takeBreakBtn.disabled = mins < 25;
      if (mins >= BREAK_THRESHOLD_MINUTES) {
        els.breakMessage.textContent = `You have worked ${mins} minutes. Take a short break before the next high-risk task.`;
        els.breakMessage.classList.add('break-alert');
      } else {
        els.breakMessage.textContent = `Focus session — ${mins} minute${mins !== 1 ? 's' : ''} elapsed.`;
        els.breakMessage.classList.remove('break-alert');
      }
    } else {
      els.breakMessage.textContent = 'Start a focus session to track your work rhythm.';
      els.breakMessage.classList.remove('break-alert');
      els.breakTimer.textContent = '00:00';
      els.startFocusBtn.disabled = false;
      els.endFocusBtn.disabled = true;
      els.takeBreakBtn.disabled = true;
    }

    if (focusSession.onBreak) {
      els.kpiBreak.textContent = 'On Break';
      els.kpiBreakCard.classList.add('kpi-break-active');
    } else if (focusSession.active) {
      els.kpiBreak.textContent = `Focus ${mins}m`;
      els.kpiBreakCard.classList.remove('kpi-break-active');
    } else {
      els.kpiBreak.textContent = 'Ready';
      els.kpiBreakCard.classList.remove('kpi-break-active');
    }

    renderBreakIntelligence();
    renderKPIs();
  }

  function startFocusSession() {
    focusSession.active = true;
    focusSession.onBreak = false;
    focusSession.elapsedSeconds = 0;
    if (focusSession.timerInterval) clearInterval(focusSession.timerInterval);
    focusSession.timerInterval = setInterval(() => {
      if (focusSession.active && !focusSession.onBreak) {
        focusSession.elapsedSeconds++;
        updateBreakUI();
      }
    }, 1000);
    updateBreakUI();
    renderBreakRecommendation();
  }

  function endFocusSession() {
    focusSession.active = false;
    focusSession.onBreak = false;
    focusSession.elapsedSeconds = 0;
    if (focusSession.timerInterval) clearInterval(focusSession.timerInterval);
    focusSession.timerInterval = null;
    updateBreakUI();
    renderBreakRecommendation();
  }

  function takeBreak() {
    focusSession.onBreak = true;
    focusSession.elapsedSeconds = 0;
    els.breakMessage.textContent = 'Break started — step away for 5–10 minutes.';
    els.breakMessage.classList.add('break-alert');
    setTimeout(() => {
      if (focusSession.onBreak) {
        focusSession.onBreak = false;
        focusSession.elapsedSeconds = 0;
        els.breakMessage.textContent = 'Break complete. Ready to resume focus.';
        els.breakMessage.classList.remove('break-alert');
        updateBreakUI();
      }
    }, 6000);
  }

  // ── Operations Assistant ────────────────────────────────────────

  function generateCustomerUpdate(task) {
    return OC.TaskIntelligence.analyze(task, { schedule, inbox }).customerUpdate || '';
  }

  function selectTask(taskId) {
    selectedTaskId = taskId;
    const task = tasks.find((t) => t.id === taskId);
    selectedTaskIntelligence = task
      ? OC.TaskIntelligence.analyze(task, { schedule, inbox })
      : null;
    saveState();
    renderTaskList();
    renderOpsAssistant();
    updateCommandButtons();
    document.querySelector('.card-assistant')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderOpsAssistant() {
    const task = tasks.find((t) => t.id === selectedTaskId);
    if (!task) {
      els.assistantStatus.textContent = 'No task selected';
      els.assistantAiBadge.hidden = true;
      selectedTaskIntelligence = null;
      els.opsAssistant.innerHTML = '<p class="empty-state">Select a task from the queue for AI-assisted guidance, escalation drafts, and focus recommendations.</p>';
      return;
    }

    const intel = selectedTaskIntelligence || OC.TaskIntelligence.analyze(task, { schedule, inbox });
    selectedTaskIntelligence = intel;

    els.assistantStatus.textContent = 'Analyzing';
    els.assistantAiBadge.hidden = false;

    const ranked = getRankedTasks();
    const rank = ranked.findIndex((t) => t.id === task.id) + 1;
    const relatedEmails = inbox.filter((e) => e.linkedTaskId === task.id);
    const isActive = (task.status || 'active') === 'active';

    els.opsAssistant.innerHTML = `
      <div class="assistant-header">
        <h3>${escapeHtml(task.name)}</h3>
        <div class="task-meta">
          <span class="badge ${badgeClass(task.priority)}">${task.priority}</span>
          <span class="badge badge-category">${task.category}</span>
          <span class="badge badge-muted">Rank #${rank || '—'}</span>
          <span class="badge badge-ai">${intel.confidence} confidence</span>
          ${task.sourceIntegration ? `<span class="badge badge-source">${escapeHtml(task.sourceIntegration.replace('simulated-', ''))}</span>` : ''}
        </div>
      </div>

      <div class="intel-grid">
        <div class="intel-card intel-action">
          <h4>Recommended Next Action</h4>
          <p>${escapeHtml(intel.nextAction)}</p>
        </div>
        <div class="intel-card intel-risk">
          <h4>Risk Explanation</h4>
          <p>${escapeHtml(intel.riskExplanation)}</p>
        </div>
        <div class="intel-card intel-inform">
          <h4>Who Should Be Informed</h4>
          <ul>${intel.informList.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
        </div>
        <div class="intel-card intel-focus">
          <h4>Suggested Focus Block</h4>
          <p>${escapeHtml(intel.focusBlock)}</p>
        </div>
      </div>

      ${relatedEmails.length ? `
        <div class="assistant-section">
          <h4>Related emails (${relatedEmails.length})</h4>
          <ul class="assistant-emails">${relatedEmails.map((e) => `<li><strong>${escapeHtml(e.subject)}</strong> — ${escapeHtml(e.from)}</li>`).join('')}</ul>
        </div>` : ''}

      ${task.externalRef ? `<p class="assistant-ref"><strong>Ref:</strong> ${escapeHtml(task.externalRef)}</p>` : ''}

      <div class="intel-drafts">
        <div class="intel-card intel-draft">
          <h4>Internal Escalation Note</h4>
          <div class="draft-text draft-sm">${escapeHtml(intel.escalationNote)}</div>
        </div>
        ${intel.customerUpdate ? `
        <div class="intel-card intel-draft">
          <h4>Customer Update Draft</h4>
          <div class="draft-text draft-sm">${escapeHtml(intel.customerUpdate)}</div>
        </div>` : ''}
      </div>

      <div class="assistant-actions">
        ${intel.customerUpdate ? '<button type="button" class="btn btn-secondary btn-sm" id="asstCopyCustomer">Copy Customer Update</button>' : ''}
        <button type="button" class="btn btn-secondary btn-sm" id="asstCopyEscalation">Copy Internal Escalation</button>
        ${isActive ? '<button type="button" class="btn btn-primary btn-sm" id="asstComplete">Mark Task Complete</button>' : ''}
        ${isActive ? '<button type="button" class="btn btn-secondary btn-sm" id="asstDefer">Defer Task</button>' : ''}
        <button type="button" class="btn btn-secondary btn-sm" id="clearSelection">Clear selection</button>
      </div>
    `;

    document.getElementById('asstCopyCustomer')?.addEventListener('click', () => {
      if (intel.customerUpdate) copyWithFeedback(document.getElementById('asstCopyCustomer'), intel.customerUpdate);
    });
    document.getElementById('asstCopyEscalation')?.addEventListener('click', () => {
      copyWithFeedback(document.getElementById('asstCopyEscalation'), intel.escalationNote);
    });
    document.getElementById('asstComplete')?.addEventListener('click', handleMarkComplete);
    document.getElementById('asstDefer')?.addEventListener('click', handleDeferTask);
    document.getElementById('clearSelection')?.addEventListener('click', () => {
      selectedTaskId = null;
      selectedTaskIntelligence = null;
      saveState();
      renderTaskList();
      renderOpsAssistant();
      updateCommandButtons();
    });
    updateCommandButtons();
  }

  // ── Task List ───────────────────────────────────────────────────

  function renderTaskList() {
    const active = getActiveTasks();
    const deferred = getDeferredTasks();

    if (!active.length && !deferred.length) {
      els.taskList.innerHTML = '<p class="empty-state">No tasks yet. Add a task or load the demo day.</p>';
      els.taskCount.textContent = '0 tasks';
      return;
    }

    const ranked = getRankedTasks();
    const completedCount = tasks.filter((t) => t.status === 'completed').length;
    els.taskCount.textContent = `${active.length} active${deferred.length ? ` · ${deferred.length} deferred` : ''}${completedCount ? ` · ${completedCount} done` : ''}`;

    let html = ranked.map((task, index) => renderTaskItem(task, index)).join('');

    if (deferred.length) {
      html += `<div class="deferred-banner">${deferred.length} task${deferred.length !== 1 ? 's' : ''} deferred — low-value work pushed to end of day</div>`;
      html += deferred.map((task, index) => renderTaskItem(task, index, true)).join('');
    }

    els.taskList.innerHTML = html;

    els.taskList.querySelectorAll('.task-item').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.delete-task')) return;
        selectTask(el.dataset.id);
      });
    });

    els.taskList.querySelectorAll('.delete-task').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        tasks = tasks.filter((t) => t.id !== btn.dataset.id);
        if (selectedTaskId === btn.dataset.id) selectedTaskId = null;
        saveState();
        renderAll();
      });
    });

    updateCommandButtons();
  }

  function renderTaskItem(task, index, isDeferred) {
    const urgent = isUrgent(task);
    const selected = task.id === selectedTaskId;
    return `
      <div class="task-item ${urgent && !isDeferred ? 'task-urgent' : ''} ${index === 0 && !isDeferred ? 'task-ranked-1' : ''} ${selected ? 'task-selected' : ''} ${isDeferred ? 'task-deferred' : ''}" data-id="${task.id}" tabindex="0" role="button">
        <div class="task-actions">
          <button type="button" class="btn btn-danger delete-task" data-id="${task.id}" title="Remove">✕</button>
        </div>
        <div class="task-header">
          <span class="task-name">${escapeHtml(task.name)}</span>
          ${!isDeferred ? `<span class="task-rank">Rank #${index + 1}</span>` : '<span class="badge badge-muted">Deferred</span>'}
        </div>
        <div class="task-meta">
          <span class="badge ${badgeClass(task.priority)}">${task.priority}</span>
          <span class="badge badge-category">${task.category}</span>
          ${task.blocksOtherWork ? '<span class="badge badge-blocks">Blocks work</span>' : ''}
          ${task.valueTier ? `<span class="badge badge-value-${task.valueTier}">${task.valueTier} value</span>` : ''}
        </div>
        <div class="task-details">
          <span>⏱ ${task.estimatedMinutes} min</span>
          <span>📅 ${formatDeadline(task.deadline)}</span>
          <span>⚡ ${task.energyRequired}</span>
        </div>
        ${task.notes ? `<p class="task-notes">${escapeHtml(task.notes)}</p>` : ''}
      </div>
    `;
  }

  // ── KPIs ────────────────────────────────────────────────────────

  function renderKPIs() {
    const active = getActiveTasks();
    const totalMinutes = active.reduce((s, t) => s + t.estimatedMinutes, 0);
    els.kpiTotal.textContent = active.length;
    els.kpiHigh.textContent = active.filter((t) => t.priority === 'High').length;
    els.kpiHours.textContent = (totalMinutes / 60).toFixed(1);
    els.kpiFocus.textContent = computeFocusScore() !== null ? computeFocusScore() + '%' : '—';
  }

  // ── Load Demo ───────────────────────────────────────────────────

  function loadDemoData() {
    const provider = OC.SimulatedData.createAirFreightDemoDay();
    OC.DataAdapter.useProvider(provider);

    demoLoaded = true;
    tasks = OC.DataAdapter.getTasks();
    inbox = OC.DataAdapter.getFullInbox();
    schedule = OC.DataAdapter.getSchedule();
    morningBrief = OC.DataAdapter.getMorningBrief();
    selectedTaskId = tasks[0]?.id || null;

    saveState();
    renderAll();
    updateBreakUI();

    els.demoToast.textContent = 'Air Freight Demo Day loaded — 8 tasks, 4 action emails, 5 calendar blocks (simulated).';
    els.demoToast.hidden = false;
    setTimeout(() => { els.demoToast.hidden = true; }, 6000);

    els.loadDemoBtn.textContent = 'Demo Loaded ✓';
    els.loadDemoBtn.disabled = true;
    setTimeout(() => {
      els.loadDemoBtn.textContent = 'Load Air Freight Demo Day';
      els.loadDemoBtn.disabled = false;
    }, 3000);

    document.getElementById('kpiGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Form ────────────────────────────────────────────────────────

  function setDefaultDeadline() {
    const input = document.getElementById('taskDeadline');
    const later = new Date();
    later.setHours(later.getHours() + 4);
    input.value = later.toISOString().slice(0, 16);
  }

  function handleTaskSubmit(e) {
    e.preventDefault();
    tasks.push({
      id: generateId(),
      name: document.getElementById('taskName').value.trim(),
      category: document.getElementById('taskCategory').value,
      priority: document.getElementById('taskPriority').value,
      estimatedMinutes: parseInt(document.getElementById('taskMinutes').value, 10),
      deadline: document.getElementById('taskDeadline').value,
      energyRequired: document.getElementById('taskEnergy').value,
      notes: document.getElementById('taskNotes').value.trim(),
      blocksOtherWork: document.getElementById('taskBlocks').checked,
      sourceIntegration: 'manual',
      status: 'active'
    });
    saveState();
    els.taskForm.reset();
    setDefaultDeadline();
    renderAll();
  }

  // ── Master Render ───────────────────────────────────────────────

  function renderAll() {
    renderDataSourceBadge();
    renderKPIs();
    renderMorningBrief();
    renderExecutiveDashboard();
    renderOpsBrief();
    renderSmartInbox();
    renderSchedule();
    renderProductivityAnalytics();
    renderTaskList();
    renderWorkloadCheck();
    renderFocusTimeline();
    renderBreakRecommendation();
    renderBreakIntelligence();
    renderOpsAssistant();
    renderEndOfDayInsight();
    updateCommandButtons();
  }

  function init() {
    els.currentDate.textContent = formatDate(new Date());
    loadState();
    setDefaultDeadline();

    els.taskForm.addEventListener('submit', handleTaskSubmit);
    els.loadDemoBtn.addEventListener('click', loadDemoData);
    els.startFocusBtn.addEventListener('click', startFocusSession);
    els.endFocusBtn.addEventListener('click', endFocusSession);
    els.takeBreakBtn.addEventListener('click', takeBreak);
    els.copyBriefBtn.addEventListener('click', handleCopyBrief);
    els.copyCustomerBtn.addEventListener('click', handleCopyCustomer);
    els.copyEscalationBtn.addEventListener('click', handleCopyEscalation);
    els.markCompleteBtn.addEventListener('click', handleMarkComplete);
    els.deferTaskBtn.addEventListener('click', handleDeferTask);
    els.deferLowBtn.addEventListener('click', handleDeferLowValue);

    renderAll();
    updateBreakUI();
  }

  init();
})();
