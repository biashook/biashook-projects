(function (root) {
  'use strict';
  const M = root.BTModel;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STATUS = { green: '🟢', yellow: '🟡', red: '🔴' };
  const MS_ICON = { done: '✔', active: '▶', planned: '○' };
  const VERDICT = { hit: '✅ 예상대로', partial: '⚠️ 일부', miss: '❌ 빗나감' };
  const CHOICE = { continue: '▶ 계속', revise: '🔄 수정', stop: '⏹ 중단' };
  const fmt = s => (s ? esc(String(s).slice(5).replace('-', '.')) : '');
  const period = (a, b) => {
    if (a && b) return `${fmt(a)}–${fmt(b)}`;
    if (a) return fmt(a);
    if (b) return fmt(b);
    return '';
  };

  function header(p) {
    const st = M.currentStage(p); const pr = st ? M.stageProgress(st) : null;
    const metrics = p.metrics.map(m => `<span class="chip">${esc(m.name)} <b>${esc(m.current)}/${esc(m.target)}${esc(m.unit)}</b> · ${M.metricPct(m)}%</span>`).join('');
    return `<header class="phead"><div class="brand">BIASHOOK</div>
      <h1>${STATUS[p.status] || ''} ${esc(p.name)}</h1>
      ${p.description ? `<p class="muted">${esc(p.description)}</p>` : ''}
      ${p.goal ? `<div class="goal">🎯 ${esc(p.goal)}</div>` : ''}
      <div class="chips">${metrics}${st ? `<span class="chip">🪜 ${esc(st.name)} · MVP ${pr.done}/${pr.total}</span>` : ''}</div></header>`;
  }

  function roadmap(p, linkFn) {
    if (!p.stages.length) return '<p class="muted">Stage 가 없습니다.</p>';
    return p.stages.map(s => {
      const pr = M.stageProgress(s);
      const ms = p.milestones.filter(m => m.stageId === s.id).map(m =>
        `<a class="ms ms-${MS_ICON[m.status] ? m.status : 'planned'}" href="${esc(linkFn(m))}">${MS_ICON[m.status] || ''} ${esc(m.title)}${m.due ? ` <small>${fmt(m.due)}</small>` : ''}</a>`
      ).join('<span class="ln"></span>');
      return `<section class="stage stage-${['done', 'active', 'planned'].includes(s.status) ? s.status : 'planned'}"><div class="stage-h"><b>🪜 ${esc(s.name)}</b>
        <span class="muted">${s.targetDate ? '목표 ' + fmt(s.targetDate) + ' · ' : ''}MVP ${pr.done}/${pr.total}</span>
        <span class="bar"><i style="width:${pr.pct}%"></i></span></div>
        <div class="tl">${ms || '<span class="muted">마일스톤 없음</span>'}</div></section>`;
    }).join('');
  }

  function milestoneView(m) {
    const rows = m.works.map(w => `<tr><td><span class="team">${esc(w.team)}</span></td><td>${esc(w.owner)}</td><td>${esc(w.what)}</td>
      <td class="nowrap">${period(w.start, w.end)}</td><td>${esc(w.expected)}</td>
      <td>${w.actual ? esc(w.actual) : '<span class="muted">대기</span>'}</td><td class="nowrap">${VERDICT[w.verdict] || ''}</td></tr>`).join('');
    const d = m.decision || {};
    return `<article class="mview" id="m-${esc(m.id)}"><h3>🚩 ${esc(m.title)} <small class="muted">${period(m.start, m.due)} · ${MS_ICON[m.status] || ''}</small></h3>
      ${m.works.length ? `<div class="tablewrap"><table><thead><tr><th>팀</th><th>담당</th><th>작업</th><th>기간</th><th>🔮 예상</th><th>📊 실제</th><th>판정</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">작업 없음</p>'}
      ${d.choice ? `<div class="decision"><b>🧭 ${CHOICE[d.choice] || ''}</b>${d.reason ? `<div>이유: ${esc(d.reason)}</div>` : ''}${d.nextAction ? `<div>다음 액션: ${esc(d.nextAction)}</div>` : ''}</div>` : ''}</article>`;
  }

  function projectPage(p, linkFn) {
    const by = st => p.milestones.filter(m => m.status === st);
    const list = arr => arr.map(milestoneView).join('') || '<p class="muted">없음</p>';
    return `${header(p)}
      <h2>로드맵</h2>${roadmap(p, linkFn)}
      <h2>진행중 마일스톤</h2>${list(by('active'))}
      <h2>예정 마일스톤</h2>${list(by('planned'))}
      <h2>지난 결정 기록</h2>${list(by('done').reverse())}
      <footer class="muted">최종 업데이트 ${p.meta.updatedAt ? new Date(p.meta.updatedAt).toLocaleString('ko-KR') : '-'} · 읽기 전용</footer>`;
  }

  root.BTRender = { esc, fmt, period, header, roadmap, milestoneView, projectPage, STATUS, MS_ICON, VERDICT, CHOICE };
})(this);
