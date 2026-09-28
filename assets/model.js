(function (root) {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const uid = () => Math.random().toString(36).slice(2, 10);
  const TEAMS = ['생산', '개발', '영업', '전사'];
  const blank = v => !String(v == null ? '' : v).trim();

  function weekRange(dateStr) {
    const d = parse(dateStr);
    const start = addDays(dateStr, -((d.getDay() + 6) % 7));
    const thu = parse(addDays(start, 3));
    const w1 = new Date(thu.getFullYear(), 0, 4);
    const week = 1 + Math.round(((thu - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
    return { start, end: addDays(start, 6), year: thu.getFullYear(), week };
  }

  function emptyProject(cfg) {
    return { id: cfg.id, name: cfg.name, description: '', status: 'green', goal: '',
      metrics: [], members: [], stages: [], milestones: [], meta: { updatedAt: null } };
  }
  const newStage = name => ({ id: uid(), name: name || '새 Stage', targetDate: '', status: 'planned', mvp: [] });
  const newMilestone = (stageId, title) => ({ id: uid(), stageId, title: title || '새 마일스톤', start: '', due: '',
    status: 'planned', works: [], decision: { choice: null, reason: '', nextAction: '' } });
  const newWork = init => Object.assign({ id: uid(), team: '개발', owner: '', what: '', start: '', end: '',
    expected: '', actual: '', verdict: null }, init);

  function eachWork(p, fn) { p.milestones.forEach(m => m.works.forEach(w => fn(m, w))); }

  function worksInWeek(p, dateStr) {
    const r = weekRange(dateStr); const out = [];
    eachWork(p, (m, w) => { if (w.start && w.end && w.start <= r.end && w.end >= r.start) out.push({ milestone: m, work: w }); });
    return out;
  }
  function pendingResults(p, dayStr) {
    const out = [];
    eachWork(p, (m, w) => { if (m.status !== 'done' && w.end && w.end < dayStr && blank(w.actual)) out.push({ milestone: m, work: w }); });
    return out;
  }

  function stageProgress(s) {
    const total = s.mvp.length, done = s.mvp.filter(x => x.done).length;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }
  const currentStage = p => p.stages.find(s => s.status === 'active') || null;
  function metricPct(m) { const t = Number(m.target); return t ? Math.round((Number(m.current) / t) * 100) : 0; }

  function chase(p, today) {
    const out = [];
    p.milestones.filter(m => m.status !== 'done').forEach(m => {
      m.works.forEach(w => {
        if (w.end && w.end < today && blank(w.actual))
          out.push({ level: 'red', type: 'result', milestoneId: m.id, workId: w.id, text: `결과 확인 필요 · ${w.what || '(작업)'}` });
        if (blank(w.expected))
          out.push({ level: 'yellow', type: 'expected', milestoneId: m.id, workId: w.id, text: `예상 결과 없음 · ${w.what || '(작업)'}` });
      });
      if (m.due && m.due < today)
        out.push({ level: 'red', type: 'late', milestoneId: m.id, text: `마일스톤 지연 · ${m.title}` });
      if (m.works.length && m.works.every(w => !blank(w.actual)) && !m.decision.choice)
        out.push({ level: 'yellow', type: 'decide', milestoneId: m.id, text: `결정 필요 · ${m.title}` });
    });
    return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'red' ? -1 : 1));
  }

  function setDecision(m, choice) { m.decision.choice = choice || null; if (choice) m.status = 'done'; else m.status = 'active'; }

  function completeStage(p, stageId) {
    const i = p.stages.findIndex(s => s.id === stageId); const s = p.stages[i];
    if (!s || s.status !== 'active' || !s.mvp.length || s.mvp.some(x => !x.done)) return false;
    s.status = 'done';
    const next = p.stages.slice(i + 1).find(x => x.status !== 'done');
    if (next) next.status = 'active';
    return true;
  }

  function copyNextAction(p, milestoneId) {
    const i = p.milestones.findIndex(m => m.id === milestoneId); const m = p.milestones[i];
    if (!m || blank(m.decision.nextAction)) return null;
    let next = p.milestones.slice(i + 1).find(x => x.status !== 'done');
    if (!next) { next = newMilestone(m.stageId, '다음 마일스톤'); p.milestones.push(next); }
    next.works.push(newWork({ what: m.decision.nextAction.trim() }));
    return next.id;
  }

  function normalize(d, cfg) {
    const base = emptyProject(cfg);
    d = d && typeof d === 'object' ? d : {};
    ['name', 'description', 'status', 'goal'].forEach(k => { if (typeof d[k] === 'string') base[k] = d[k]; });
    ['metrics', 'members'].forEach(k => { if (Array.isArray(d[k])) base[k] = d[k]; });
    if (Array.isArray(d.stages)) {
      base.stages = d.stages.map(s => {
        const merged = Object.assign(newStage(s && s.name), s || {});
        merged.mvp = Array.isArray(s && s.mvp) ? s.mvp : [];
        return merged;
      });
    }
    if (Array.isArray(d.milestones)) {
      base.milestones = d.milestones.map(m => {
        const merged = Object.assign(newMilestone(m && m.stageId, m && m.title), m || {});
        merged.works = Array.isArray(m && m.works) ? m.works.map(w => Object.assign(newWork(), w || {})) : [];
        merged.decision = Object.assign({ choice: null, reason: '', nextAction: '' }, (m && m.decision && typeof m.decision === 'object') ? m.decision : {});
        return merged;
      });
    }
    base.meta = (d.meta && typeof d.meta === 'object') ? Object.assign({ updatedAt: null }, d.meta) : { updatedAt: null };
    base.id = cfg.id;
    return base;
  }

  function directive(p, dateStr) {
    const r = weekRange(dateStr);
    const slack = name => (p.members.find(x => x.name === name) || {}).slackName || '';
    const teams = [];
    worksInWeek(p, dateStr).forEach(({ milestone, work }) => {
      let t = teams.find(x => x.team === work.team);
      if (!t) { t = { team: work.team, items: [] }; teams.push(t); }
      t.items.push({ owner: work.owner, slackName: slack(work.owner), what: work.what, expected: work.expected, end: work.end, milestone: milestone.title });
    });
    const pending = pendingResults(p, r.start).map(({ milestone, work }) =>
      ({ owner: work.owner, slackName: slack(work.owner), what: work.what, end: work.end, milestone: milestone.title }));
    return { project: p.name, week: r, teams, pendingResults: pending };
  }

  const api = { iso, addDays, uid, TEAMS, weekRange, emptyProject, normalize, newStage, newMilestone, newWork,
    worksInWeek, pendingResults, stageProgress, currentStage, metricPct, chase, setDecision,
    completeStage, copyNextAction, directive };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BTModel = api;
})(this);
