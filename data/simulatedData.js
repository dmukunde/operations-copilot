/**
 * Simulated Data Provider — realistic air freight ops data.
 * Replace this module with live API providers when integrations are ready.
 *
 * Data shape mirrors future integration contracts:
 *   - meta.integrations.{outlook,teams,gmail,googleCalendar,cargowise,airlineSystems}
 *   - morningBrief  (future: aggregated daily digest)
 *   - inbox[]       (future: Outlook / Gmail sync)
 *   - schedule[]    (future: Google Calendar / Teams)
 *   - tasks[]       (future: CargoWise / TMS)
 */
window.OperationsCopilot = window.OperationsCopilot || {};

(function (OC) {
  'use strict';

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function offsetFromNow(hours) {
    const d = new Date();
    d.setTime(d.getTime() + hours * 60 * 60 * 1000);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function scheduleTime(hoursFromMidnight, durationMin) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setMinutes(d.getMinutes() + hoursFromMidnight * 60);
    const start = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    d.setMinutes(d.getMinutes() + durationMin);
    const end = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return { start, end, isoStart: d.toISOString() };
  }

  function buildDemoPayload() {
    const taskIds = {
      dubai: 'task_dubai_delay',
      customs: 'task_customs_docs',
      overbook: 'task_airline_overbook',
      eta: 'task_customer_eta',
      dg: 'task_dg_docs',
      invoice: 'task_finance_invoice',
      meeting: 'task_ops_meeting',
      tracking: 'task_tracking_update'
    };

    const tasks = [
      {
        id: taskIds.dubai,
        name: 'Delayed shipment to Dubai (AWB 176-48291003)',
        category: 'Shipment',
        priority: 'High',
        estimatedMinutes: 120,
        deadline: offsetFromNow(-1),
        energyRequired: 'High',
        valueTier: 'high',
        notes: 'EK 512 missed DXB connection. 3 pallets rebooked for tomorrow. Customer SLA at risk.',
        blocksOtherWork: true,
        sourceIntegration: 'simulated-cargowise',
        externalRef: 'CW-SHP-2026-88421',
        status: 'active'
      },
      {
        id: taskIds.customs,
        name: 'Missing customs paperwork — commercial invoice mismatch',
        category: 'Customs',
        priority: 'High',
        estimatedMinutes: 50,
        deadline: offsetFromNow(2),
        energyRequired: 'High',
        valueTier: 'high',
        notes: 'JFK hold. Invoice value differs from packing list by $4,200.',
        blocksOtherWork: true,
        sourceIntegration: 'simulated-cargowise',
        externalRef: 'CW-CUS-2026-11209'
      },
      {
        id: taskIds.overbook,
        name: 'Airline overbooking — LH840 ORD→FRA capacity shortfall',
        category: 'Shipment',
        priority: 'High',
        estimatedMinutes: 40,
        deadline: offsetFromNow(3),
        energyRequired: 'Medium',
        valueTier: 'high',
        notes: 'Lufthansa overbooked 2 pallet positions. Need reallocation or split booking.',
        blocksOtherWork: true,
        sourceIntegration: 'simulated-airline',
        externalRef: 'LH-ORD-FRA-0726'
      },
      {
        id: taskIds.eta,
        name: 'Customer ETA request — Meridian Pharma (AWB 020-9918234)',
        category: 'Customer',
        priority: 'High',
        estimatedMinutes: 25,
        deadline: offsetFromNow(1.5),
        energyRequired: 'Medium',
        valueTier: 'high',
        notes: 'Temperature-controlled shipment. Customer needs confirmed delivery window.',
        blocksOtherWork: false,
        sourceIntegration: 'simulated-outlook',
        linkedEmailId: 'email_eta_meridian'
      },
      {
        id: taskIds.dg,
        name: 'Dangerous goods documentation review — UN3082 lithium batteries',
        category: 'Documentation',
        priority: 'High',
        estimatedMinutes: 45,
        deadline: offsetFromNow(4),
        energyRequired: 'High',
        valueTier: 'high',
        notes: 'DGD missing shipper signature. Cannot tender to airline until resolved.',
        blocksOtherWork: true,
        sourceIntegration: 'simulated-cargowise',
        externalRef: 'CW-DG-2026-0034'
      },
      {
        id: taskIds.invoice,
        name: 'Finance invoice approval — Q2 carrier charges batch',
        category: 'Admin',
        priority: 'Low',
        estimatedMinutes: 75,
        deadline: offsetFromNow(8),
        energyRequired: 'Low',
        valueTier: 'low',
        notes: '18 invoices ($142K total) pending manager approval in ERP.',
        blocksOtherWork: false,
        sourceIntegration: 'simulated-cargowise',
        externalRef: 'CW-FIN-2026-Q2'
      },
      {
        id: taskIds.meeting,
        name: 'Operations standup — morning exceptions review',
        category: 'Meeting',
        priority: 'Medium',
        estimatedMinutes: 30,
        deadline: offsetFromNow(1.5),
        energyRequired: 'Medium',
        valueTier: 'medium',
        notes: 'Teams call with handling, customs desk, and customer service.',
        blocksOtherWork: false,
        sourceIntegration: 'simulated-teams',
        externalRef: 'teams-ops-standup'
      },
      {
        id: taskIds.tracking,
        name: 'Shipment tracking update — 14 in-transit AWBs',
        category: 'Documentation',
        priority: 'Medium',
        estimatedMinutes: 35,
        deadline: offsetFromNow(5),
        energyRequired: 'Low',
        valueTier: 'medium',
        notes: 'Batch status refresh in TMS; notify account managers of delays.',
        blocksOtherWork: false,
        sourceIntegration: 'simulated-cargowise',
        externalRef: 'CW-TRK-BATCH-14'
      }
    ];

    const inbox = [
      {
        id: 'email_eta_meridian',
        source: 'simulated-outlook',
        from: 'Sarah Chen <s.chen@meridianpharma.com>',
        subject: 'URGENT: ETA for temperature-controlled shipment AWB 020-9918234',
        receivedAt: offsetFromNow(-0.5),
        requiresAction: true,
        actionReason: 'Customer awaiting confirmed delivery window',
        priority: 'High',
        preview: 'We need an updated ETA for our Frankfurt delivery. Product is temperature-sensitive…',
        linkedTaskId: taskIds.eta
      },
      {
        id: 'email_customs_jfk',
        source: 'simulated-outlook',
        from: 'US Customs Broker <alerts@customsconnect.com>',
        subject: 'HOLD: Missing documentation — AWB 176-48291003 / JFK',
        receivedAt: offsetFromNow(-2),
        requiresAction: true,
        actionReason: 'Customs hold requires corrected commercial invoice',
        priority: 'High',
        preview: 'Shipment held pending invoice correction. Value discrepancy flagged…',
        linkedTaskId: taskIds.customs
      },
      {
        id: 'email_lh_overbook',
        source: 'simulated-outlook',
        from: 'Lufthansa Cargo <allocations@lh-cargo.com>',
        subject: 'Capacity alert: LH840 ORD→FRA — overbooking notification',
        receivedAt: offsetFromNow(-1),
        requiresAction: true,
        actionReason: 'Airline overbooking requires reallocation decision',
        priority: 'High',
        preview: 'We regret to inform you that 2 of your 5 pallet positions on LH840 are overbooked…',
        linkedTaskId: taskIds.overbook
      },
      {
        id: 'email_dg_review',
        source: 'simulated-gmail',
        from: 'DG Compliance <compliance@airfreight-ops.com>',
        subject: 'DGD rejected — UN3082 shipment missing signature',
        receivedAt: offsetFromNow(-3),
        requiresAction: true,
        actionReason: 'Dangerous goods form rejected by airline',
        priority: 'High',
        preview: 'Shipper declaration rejected. Cannot tender until DGD is re-signed…',
        linkedTaskId: taskIds.dg
      },
      {
        id: 'email_newsletter',
        source: 'simulated-outlook',
        from: 'IATA Weekly <news@iata.org>',
        subject: 'IATA Air Freight Market Update — June 2026',
        receivedAt: offsetFromNow(-5),
        requiresAction: false,
        actionReason: null,
        priority: 'Low',
        preview: 'Global air cargo demand rose 4.2% YoY…',
        linkedTaskId: null
      },
      {
        id: 'email_fyi_capacity',
        source: 'simulated-outlook',
        from: 'Network Planning <planning@internal-ops.com>',
        subject: 'FYI: Peak season capacity forecast',
        receivedAt: offsetFromNow(-6),
        requiresAction: false,
        actionReason: null,
        priority: 'Low',
        preview: 'Sharing updated peak season forecast for Q3 planning…',
        linkedTaskId: null
      }
    ];

    const meetingBlock = scheduleTime(9, 30);
    const customsBlock = scheduleTime(10.5, 50);
    const focusBlock = scheduleTime(11.75, 120);

    const schedule = [
      {
        id: 'cal_standup',
        source: 'simulated-teams',
        type: 'meeting',
        title: 'Operations standup — morning exceptions',
        startTime: meetingBlock.start,
        endTime: meetingBlock.end,
        location: 'Microsoft Teams',
        linkedTaskId: taskIds.meeting,
        attendees: ['Handling Team', 'Customs Desk', 'Customer Service']
      },
      {
        id: 'cal_customs',
        source: 'simulated-google-calendar',
        type: 'operational',
        title: 'Customs documentation resolution block',
        startTime: customsBlock.start,
        endTime: customsBlock.end,
        location: 'Ops floor',
        linkedTaskId: taskIds.customs,
        attendees: []
      },
      {
        id: 'cal_focus_dubai',
        source: 'simulated-google-calendar',
        type: 'operational',
        title: 'Focus: Dubai delay recovery',
        startTime: focusBlock.start,
        endTime: focusBlock.end,
        location: 'Deep work block',
        linkedTaskId: taskIds.dubai,
        attendees: []
      },
      {
        id: 'cal_lunch',
        source: 'simulated-google-calendar',
        type: 'break',
        title: 'Lunch break',
        startTime: '12:30',
        endTime: '13:00',
        location: null,
        linkedTaskId: null,
        attendees: []
      },
      {
        id: 'cal_invoice',
        source: 'simulated-google-calendar',
        type: 'operational',
        title: 'Finance invoice batch review',
        startTime: '15:00',
        endTime: '16:15',
        location: 'ERP / Finance portal',
        linkedTaskId: taskIds.invoice,
        attendees: []
      }
    ];

    const morningBrief = {
      generatedAt: new Date().toISOString(),
      greeting: 'Good morning',
      summary: 'You have 8 operational items today with 4 critical blockers. Two shipments require immediate intervention — Dubai delay and JFK customs hold.',
      highlights: [
        'AWB 176-48291003 (Dubai) is overdue — customer SLA penalty risk',
        'JFK customs hold blocking 2 downstream deliveries',
        'LH840 overbooking affects ORD→FRA departures tomorrow'
      ],
      metrics: {
        actionEmails: inbox.filter((e) => e.requiresAction).length,
        meetingsToday: schedule.filter((s) => s.type === 'meeting').length,
        criticalTasks: tasks.filter((t) => t.priority === 'High').length,
        blockingTasks: tasks.filter((t) => t.blocksOtherWork).length
      },
      suggestedFirstMove: 'Resolve Dubai rebooking, then clear JFK customs documentation before the 10:30 ops standup.'
    };

    const shipments = [
      { awb: '176-48291003', route: 'ORD→DXB', status: 'delayed', delayHours: 18, valueUsd: 124000, customer: 'Gulf Trading Co.' },
      { awb: '020-9918234', route: 'JFK→FRA', status: 'at_risk', delayHours: 0, valueUsd: 89000, customer: 'Meridian Pharma' },
      { awb: '180-4422108', route: 'LAX→HKG', status: 'at_risk', delayHours: 4, valueUsd: 67000, customer: 'Pacific Electronics' },
      { awb: '157-8834210', route: 'ORD→FRA', status: 'at_risk', delayHours: 6, valueUsd: 52000, customer: 'EuroParts GmbH' },
      { awb: '235-1109822', route: 'MIA→GRU', status: 'on_track', delayHours: 0, valueUsd: 41000, customer: 'Brasil Med' },
      { awb: '074-5529104', route: 'DFW→LHR', status: 'on_track', delayHours: 0, valueUsd: 38000, customer: 'UK Auto Supply' },
      { awb: '016-8821044', route: 'SEA→NRT', status: 'on_track', delayHours: 0, valueUsd: 55000, customer: 'Tokyo Tech' },
      { awb: '125-9910233', route: 'ATL→CDG', status: 'on_track', delayHours: 0, valueUsd: 29000, customer: 'Paris Pharma' }
    ];

    const onTrack = shipments.filter((s) => s.status === 'on_track').length;
    const atRisk = shipments.filter((s) => s.status !== 'on_track').length;
    const revenueAtRisk = shipments
      .filter((s) => s.status !== 'on_track')
      .reduce((sum, s) => sum + s.valueUsd, 0);
    const avgDelay = (() => {
      const delayed = shipments.filter((s) => s.delayHours > 0);
      if (!delayed.length) return 0;
      return delayed.reduce((sum, s) => sum + s.delayHours, 0) / delayed.length;
    })();

    const executiveDashboard = {
      shipmentsOnTrack: onTrack,
      shipmentsAtRisk: atRisk,
      criticalBlockers: tasks.filter((t) => t.blocksOtherWork).length,
      revenueAtRisk: revenueAtRisk,
      revenueAtRiskFormatted: '$' + Math.round(revenueAtRisk / 1000) + 'K',
      slaAtRisk: 2,
      avgDelayExposure: avgDelay.toFixed(1) + ' hrs',
      avgDelayHours: avgDelay,
      leadershipAction: 'Authorize Dubai rebooking ($8.2K uplift) and escalate JFK customs hold to broker VP before 11:00 standup.',
      atRiskShipments: shipments.filter((s) => s.status !== 'on_track'),
      totalActiveShipments: shipments.length
    };

    const meta = {
      mode: 'simulated',
      loadedAt: new Date().toISOString(),
      integrations: {
        outlook: { connected: false, simulated: true, label: 'Outlook (simulated)' },
        teams: { connected: false, simulated: true, label: 'Microsoft Teams (simulated)' },
        gmail: { connected: false, simulated: true, label: 'Gmail (simulated)' },
        googleCalendar: { connected: false, simulated: true, label: 'Google Calendar (simulated)' },
        cargowise: { connected: false, simulated: true, label: 'CargoWise (simulated)' },
        airlineSystems: { connected: false, simulated: true, label: 'Airline Systems (simulated)' }
      }
    };

    return { meta, morningBrief, inbox, schedule, tasks, shipments, executiveDashboard };
  }

  function createProvider(payload) {
    const data = payload || buildDemoPayload();

    return {
      getMeta: () => data.meta,
      getMorningBrief: () => data.morningBrief,
      getInbox: () => data.inbox,
      getSchedule: () => data.schedule,
      getTasks: () => data.tasks.map((t) => ({ ...t, status: t.status || 'active' })),
      getShipments: () => data.shipments || [],
      getExecutiveDashboard: (taskOverride) => {
        const activeTasks = taskOverride || data.tasks;
        const blockers = activeTasks.filter((t) => t.status !== 'completed' && t.blocksOtherWork).length;
        return {
          ...data.executiveDashboard,
          criticalBlockers: blockers
        };
      },
      getAnalytics: (tasks) => OC.AnalyticsEngine.compute(tasks || data.tasks)
    };
  }

  OC.SimulatedData = {
    createAirFreightDemoDay: () => createProvider(buildDemoPayload()),
    buildDemoPayload
  };
})(window.OperationsCopilot);
