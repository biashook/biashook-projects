(async function () {
  'use strict';
  const R = window.BTRender, M = window.BTModel, app = document.getElementById('app');
  const SLUGS = ['k7q2m9', 'x3p8d1', 'r5w1t6', 'h9c4v2'];
  // 편의를 위해 마스터 비밀번호 평문을 sessionStorage 에 캐시한다 (탭 생명주기 동안만, 같은 출처에서 읽을 수 있음).
  const KEY = 'bt-hub:' + location.pathname.replace(/index\.html$/, '');
  let busy = false;
  let projects = null; // [{ slug, state: 'ok'|'notpublished'|'noowner'|'fetcherror'|'decryptfail', p }]

  function lockScreen(msg) {
    app.innerHTML = `<form class="lock" id="f"><div class="brand">BIASHOOK</div><h1>BIASHOOK 프로젝트</h1>
      <input type="password" id="pw" placeholder="마스터 비밀번호" autocomplete="current-password" autofocus>
      <button type="submit">열기</button><p class="err">${R.esc(msg || '')}</p></form>`;
    document.getElementById('f').addEventListener('submit', e => {
      e.preventDefault();
      if (busy) return;
      const pw = document.getElementById('pw').value;
      if (!pw) {
        document.querySelector('#f .err').textContent = '비밀번호를 입력하세요.';
        return;
      }
      unlock(pw);
    });
    document.getElementById('pw').focus();
  }

  async function fetchProject(slug, masterPw) {
    let payload;
    try {
      const r = await fetch(`../${slug}/data.enc.json`, { cache: 'no-store' });
      if (r.status === 404) return { slug, state: 'notpublished', p: null };
      if (!r.ok) return { slug, state: 'fetcherror', p: null };
      payload = await r.json();
    } catch (e) { return { slug, state: 'fetcherror', p: null }; }
    if (!payload || !payload.owner) return { slug, state: 'noowner', p: null };
    try {
      const p = await window.BTCrypto.decrypt(payload.owner, masterPw);
      return { slug, state: 'ok', p };
    } catch (e) { return { slug, state: 'decryptfail', p: null }; }
  }

  // 마스터 비밀번호가 맞는지 판단할 수 있는 것은 owner 사본이 존재해 복호화를 "시도"한 경우뿐이다.
  function wrongPassword(results) {
    const attempted = results.filter(r => r.state === 'ok' || r.state === 'decryptfail');
    return attempted.length > 0 && !results.some(r => r.state === 'ok');
  }

  async function unlock(pw) {
    busy = true;
    const btn = document.querySelector('#f button[type="submit"]');
    const prevText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '여는 중…'; }
    const results = await Promise.all(SLUGS.map(slug => fetchProject(slug, pw)));
    if (wrongPassword(results)) {
      try { sessionStorage.removeItem(KEY); } catch (x) { /* 무시 */ }
      busy = false;
      lockScreen('비밀번호가 맞지 않습니다.');
      return;
    }
    try { sessionStorage.setItem(KEY, pw); } catch (e) { /* 저장 불가 환경: 매번 입력 */ }
    projects = results;
    busy = false;
    if (btn) { btn.disabled = false; btn.textContent = prevText; }
    showHub();
  }

  async function tryAutoUnlock(pw) {
    const results = await Promise.all(SLUGS.map(slug => fetchProject(slug, pw)));
    if (wrongPassword(results)) {
      try { sessionStorage.removeItem(KEY); } catch (x) { /* 무시 */ }
      return false;
    }
    projects = results;
    return true;
  }

  function tabLabel(r, i) {
    if (r.state === 'ok') return `${R.STATUS[r.p.status] || ''} ${R.esc(r.p.name)}`;
    if (r.state === 'notpublished') return `프로젝트 ${i + 1} (미게시)`;
    if (r.state === 'noowner') return `프로젝트 ${i + 1} (사본 없음)`;
    return `프로젝트 ${i + 1} (열 수 없음)`;
  }

  function currentTabIndex() {
    const m = location.hash.match(/^#(\d+)/);
    const n = m ? parseInt(m[1], 10) : 1;
    return Math.min(Math.max(n, 1), SLUGS.length) - 1;
  }

  function tabBar(idx) {
    const tabs = projects.map((r, i) =>
      `<a href="#${i + 1}" class="tab${i === idx ? ' active' : ''}">${tabLabel(r, i)}</a>`).join('');
    return `<nav class="hub-tabs">
      <button type="button" class="tab-nav" id="prevTab" aria-label="이전 프로젝트">◀</button>
      <div class="tabs-scroll">${tabs}</div>
      <button type="button" class="tab-nav" id="nextTab" aria-label="다음 프로젝트">▶</button>
    </nav>`;
  }

  function chaseStrip(p) {
    const c = M.chase(p, M.iso(new Date()));
    if (!c.length) return '<div class="chase ok">✅ Chase 알림 없음</div>';
    return `<div class="chase">${c.map(x =>
      `<a class="alert ${x.level}" href="#m-${R.esc(x.milestoneId)}">${x.level === 'red' ? '🔴' : '🟡'} ${R.esc(x.text)}</a>`).join('')}</div>`;
  }

  function content(idx) {
    const r = projects[idx];
    if (r.state === 'ok') return `${chaseStrip(r.p)}${R.projectPage(r.p, m => '#m-' + m.id)}`;
    const msg = r.state === 'notpublished' ? '아직 게시된 내용이 없습니다.'
      : r.state === 'noowner' ? '대표용 사본 없음 (편집기에서 다시 내보내기)'
      : '열 수 없음';
    return `<div class="lock"><div class="brand">BIASHOOK</div><p class="muted">${R.esc(msg)}</p></div>`;
  }

  function showHub() {
    const idx = currentTabIndex();
    document.title = 'BIASHOOK 프로젝트';
    app.innerHTML = `${tabBar(idx)}<div class="hub-body">${content(idx)}</div>`;
  }

  function gotoTab(newIdx) {
    const n = ((newIdx % SLUGS.length) + SLUGS.length) % SLUGS.length;
    location.hash = '#' + (n + 1);
  }

  // 탭/이전·다음 버튼은 위임으로 처리하고, 로드맵 안의 마일스톤 링크(#m-...)는
  // 탭 해시를 건드리지 않도록 기본 동작을 막고 직접 스크롤한다.
  app.addEventListener('click', ev => {
    const t = ev.target;
    if (t.id === 'prevTab') { gotoTab(currentTabIndex() - 1); return; }
    if (t.id === 'nextTab') { gotoTab(currentTabIndex() + 1); return; }
    const a = t.closest('a[href^="#m-"]');
    if (!a) return;
    ev.preventDefault();
    const el = document.getElementById(a.getAttribute('href').slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.addEventListener('keydown', ev => {
    if (!projects) return;
    if (ev.target && /input|textarea/i.test(ev.target.tagName)) return;
    if (ev.key === 'ArrowLeft') gotoTab(currentTabIndex() - 1);
    else if (ev.key === 'ArrowRight') gotoTab(currentTabIndex() + 1);
  });
  window.addEventListener('hashchange', () => { if (projects) showHub(); });

  let saved = null;
  try { saved = sessionStorage.getItem(KEY); } catch (e) { /* 무시 */ }
  if (saved) {
    const ok = await tryAutoUnlock(saved);
    if (ok) showHub(); else lockScreen();
  } else {
    lockScreen();
  }
})();
