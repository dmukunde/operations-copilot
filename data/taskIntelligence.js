/**
 * Task Intelligence Engine (V2)
 * Rule-based AI-style analysis for operations tasks.
 * Replace with LLM provider later; interface stays the same.
 */
window.OperationsCopilot = window.OperationsCopilot || {};

(function (OC) {
  'use strict';

  const STAKEHOLDERS = {
    Shipment: ['Account Manager', 'Station Handling Lead', 'Airline Allocations Desk'],
    Customer: ['Account Manager', 'Customer Service Director', 'Regional Ops Manager'],
    Customs: ['Customs Broker (JFK)', 'Compliance Officer', 'Shipper Documentation Team'],
    Documentation: ['DG Compliance Team', 'Airline Cargo Acceptance', 'Account Manager'],
    Meeting: ['Handling Team', 'Shift Supervisor'],
    Admin: ['Finance Controller', 'Ops Manager (FYI)'],
    Email: ['Network Planning', 'Carrier Relations'],
    Other: ['Ops Manager', 'Shift Lead']
  };

  function hoursUntil(deadline) {
    return (new Date(deadline) - Date.now()) / (1000 * 60 * 60);
  }

  function suggestFocusBlock(task, schedule) {
    const mins = task.estimatedMinutes;
    const linked = schedule?.find((s) => s.linkedTaskId === task.id);
    if (linked) {
      return `Use scheduled block ${linked.startTime}–${linked.endTime} (${mins} min). Protect this slot — no meetings or inbox during this window.`;
    }
    const energy = task.energyRequired === 'High' ? 'deep-focus' : 'standard';
    const duration = mins >= 90 ? '90–120 min' : mins >= 45 ? '45–60 min' : '25–30 min';
    const slot = task.priority === 'High' ? 'next available morning slot' : 'after critical blockers are cleared';
    return `Book a ${duration} ${energy} block during ${slot}. Recommended: mute Teams/email and batch interruptions after the block.`;
  }

  function buildNextAction(task) {
    const h = hoursUntil(task.deadline);
    const urgent = h < 0 ? 'IMMEDIATE — overdue. ' : h < 2 ? 'Within 2 hours. ' : '';

    const actions = {
      Shipment: `${urgent}Pull latest AWB status, confirm rebooking or routing alternatives, and update TMS within 30 minutes.`,
      Customer: `${urgent}Draft and send ETA update, then log touchpoint in CRM with committed follow-up time.`,
      Customs: `${urgent}Request corrected docs from shipper/broker, validate values against packing list, and submit release request.`,
      Documentation: `${urgent}Review DGD/compliance pack, obtain missing signatures, and re-tender to airline acceptance.`,
      Meeting: `Prepare exception summary (top 3 blockers + ETAs) and distribute agenda 15 minutes before start.`,
      Admin: `Batch with other finance tasks unless a blocker depends on approval — defer if ops critical path is active.`,
      Email: `Respond with capacity/allocation answer and log decision in carrier relations tracker.`
    };

    let action = actions[task.category] || `${urgent}Review context, confirm deadline, execute in priority order.`;
    if (task.blocksOtherWork) {
      action = 'Priority unblock: ' + action;
    }
    return action;
  }

  function buildRiskExplanation(task) {
    const h = hoursUntil(task.deadline);
    const risks = [];

    if (h < 0) risks.push(`Overdue by ${Math.abs(Math.round(h))}h — SLA breach and customer confidence at risk.`);
    else if (h < 2) risks.push(`Deadline within 2 hours — limited recovery window if upstream parties delay.`);
    if (task.blocksOtherWork) risks.push('Downstream deliveries and handoffs cannot proceed until this is resolved.');
    if (task.priority === 'High' && task.category === 'Shipment') {
      risks.push('Revenue exposure and penalty clauses may apply on key accounts.');
    }
    if (task.category === 'Customs') risks.push('Hold fees accrue daily; warehouse storage costs increase after 24h.');
    if (task.category === 'Documentation' && /dangerous goods|UN3082|DGD/i.test(task.name + task.notes)) {
      risks.push('Regulatory non-compliance — airline will refuse tender until DGD is valid.');
    }
    if (task.notes?.includes('SLA')) risks.push('Contractual SLA penalty flagged in notes.');
    if (!risks.length) risks.push('Moderate operational risk — monitor deadline and escalate if scope expands.');

    return risks.join(' ');
  }

  function buildInformList(task) {
    const base = STAKEHOLDERS[task.category] || STAKEHOLDERS.Other;
    const extra = [];
    if (task.priority === 'High' && task.category === 'Customer') extra.push('VP Customer Success (if no update within 1h)');
    if (task.blocksOtherWork) extra.push('Downstream station leads');
    if (/Dubai|DXB/i.test(task.name)) extra.push('DXB Station Manager', 'EK Cargo Partner Desk');
    if (/Meridian|Pharma/i.test(task.name + (task.notes || ''))) extra.push('Cold Chain Specialist');
    return [...new Set([...base, ...extra])];
  }

  function buildEscalationNote(task, nextAction, riskExplanation, informList) {
    const lines = [
      'INTERNAL ESCALATION NOTE',
      '────────────────────────',
      `Task: ${task.name}`,
      `Reference: ${task.externalRef || 'N/A'}`,
      `Priority: ${task.priority} | Category: ${task.category}`,
      `Deadline: ${new Date(task.deadline).toLocaleString('en-US')}`,
      '',
      'SITUATION',
      task.notes || 'No additional notes on file.',
      '',
      'RISK ASSESSMENT',
      riskExplanation,
      '',
      'RECOMMENDED ACTION',
      nextAction,
      '',
      'NOTIFY',
      informList.map((p) => '• ' + p).join('\n'),
      '',
      'Requested by: Operations Copilot | ' + new Date().toLocaleString('en-US')
    ];
    return lines.join('\n');
  }

  function buildCustomerUpdate(task) {
    const deadline = new Date(task.deadline);
    const isOverdue = deadline < new Date();
    const eligible = task.priority === 'High' || ['Shipment', 'Customer', 'Customs'].includes(task.category);
    if (!eligible) return null;

    const statusLine = isOverdue
      ? 'We are actively working to resolve a delay and apologize for any inconvenience caused.'
      : 'We are monitoring progress closely and will keep you informed of any material changes.';

    const opening = {
      Shipment: `Regarding your shipment (${task.name}):`,
      Customer: `Following up on your inquiry (${task.name}):`,
      Customs: `We are addressing a customs-related matter affecting your shipment:`,
      Documentation: `Regarding documentation for your shipment (${task.name}):`
    }[task.category] || `Regarding ${task.name}:`;

    return `${opening}\n\n${statusLine}\n\nCurrent status: Our operations team has prioritized this matter. Target resolution aligns with ${deadline.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.\n\n${task.notes ? 'Context: ' + task.notes + '\n\n' : ''}We will provide another update within 2 hours or sooner if there is a change.\n\nBest regards,\nOperations Team`;
  }

  OC.TaskIntelligence = {
    analyze(task, context = {}) {
      const nextAction = buildNextAction(task);
      const riskExplanation = buildRiskExplanation(task);
      const informList = buildInformList(task);
      const escalationNote = buildEscalationNote(task, nextAction, riskExplanation, informList);
      const customerUpdate = buildCustomerUpdate(task);
      const focusBlock = suggestFocusBlock(task, context.schedule || []);

      return {
        nextAction,
        riskExplanation,
        informList,
        escalationNote,
        customerUpdate,
        focusBlock,
        confidence: task.priority === 'High' ? 'High' : 'Medium'
      };
    },

    endOfDayInsight(tasks) {
      const active = tasks.filter((t) => (t.status || 'active') === 'active' || t.status === 'deferred');
      const completed = tasks.filter((t) => t.status === 'completed');
      const allWorked = [...active, ...completed];

      if (!allWorked.length) {
        return { message: null, highValuePercent: 0, totalHours: 0 };
      }

      const analytics = OC.AnalyticsEngine.compute(allWorked);
      const totalHours = (analytics.highValueMinutes + analytics.mediumValueMinutes + analytics.lowValueMinutes) / 60;
      const highPct = analytics.highValuePercent;

      let message;
      if (highPct < 35) {
        message = `You felt busy today, but only ${highPct}% of time was spent on high-value operational work. Consider deferring admin and batching email tomorrow.`;
      } else if (highPct < 50) {
        message = `You felt busy today, but only ${highPct}% of time was spent on high-value operational work. Protect more focus blocks for shipment and customs tasks.`;
      } else {
        message = `${highPct}% of planned time targets high-value operational work — strong focus alignment. Reserve remaining capacity for reactive items.`;
      }

      return {
        message,
        highValuePercent: highPct,
        lowValuePercent: analytics.lowValuePercent,
        totalHours: totalHours.toFixed(1),
        completedCount: completed.length
      };
    }
  };
})(window.OperationsCopilot);
