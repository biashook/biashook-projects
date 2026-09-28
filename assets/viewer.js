(async function () {
  'use strict';
  const R = window.BTRender, app = document.getElementById('app');
  // 편의를 위해 비밀번호 평문을 sessionStorage 에 캐시한다 (탭 생명주기 동안만, 같은 출처에서 읽을 수 있음).
  const KEY = 'bt-view:' + location.pathname.replace(/index\.html$/, '');
  let payload;
  try {
    const r = await fetch('data.enc.json', { cache: 'no-store' });
    if (r.status === 404) throw { notFound: true };
    if (!r.ok) throw new Error(r.status);
    payload = await r.json();
  } catch (e) {
    const msg = e && e.notFound ? '아직 게시된 내용이 없습니다.' : '내용을 불러오지 못했습니다.';
    app.innerHTML = `<div class="lock"><div class="brand">BIASHOOK</div><h1>BIASHOOK 프로젝트</h1><p class="muted">${R.esc(msg)}</p></div>`;
    return;
  }

  if (payload && payload.slug && !location.pathname.includes(`/${payload.slug}/`)) {
    app.innerHTML = '<div class="lock"><div class="brand">BIASHOOK</div><h1>BIASHOOK 프로젝트</h1><p class="muted">잘못된 데이터 파일입니다 (다른 프로젝트).</p></div>';
    return;
  }

  let busy = false;

  function lockScreen(msg) {
    app.innerHTML = `<form class="lock" id="f"><div class="brand">BIASHOOK</div><h1>BIASHOOK 프로젝트</h1>
      <input type="password" id="pw" placeholder="비밀번호" autocomplete="current-password" autofocus>
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

  async function unlock(pw) {
    busy = true;
    const btn = document.querySelector('#f button[type="submit"]');
    const prevText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '여는 중…'; }
    let p;
    try {
      p = await window.BTCrypto.decrypt(payload, pw);
    } catch (e) {
      try { sessionStorage.removeItem(KEY); } catch (x) { /* 무시 */ }
      busy = false;
      lockScreen('비밀번호가 맞지 않습니다.');
      return;
    }
    try { sessionStorage.setItem(KEY, pw); } catch (e) { /* 저장 불가 환경: 매번 입력 */ }
    try {
      show(p);
    } catch (e) {
      console.error(e);
      app.innerHTML = '<div class="lock"><div class="brand">BIASHOOK</div><h1>BIASHOOK 프로젝트</h1><p class="muted">데이터를 표시할 수 없습니다.</p></div>';
    } finally {
      busy = false;
      if (btn) { btn.disabled = false; btn.textContent = prevText; }
    }
  }

  function show(p) {
    document.title = `${p.name} · BIASHOOK`;
    const by = st => p.milestones.filter(m => m.status === st);
    const list = arr => arr.map(R.milestoneView).join('') || '<p class="muted">없음</p>';
    app.innerHTML = `${R.header(p)}
      <h2>로드맵</h2>${R.roadmap(p, m => '#m-' + m.id)}
      <h2>진행중 마일스톤</h2>${list(by('active'))}
      <h2>예정 마일스톤</h2>${list(by('planned'))}
      <h2>지난 결정 기록</h2>${list(by('done').reverse())}
      <footer class="muted">최종 업데이트 ${p.meta.updatedAt ? new Date(p.meta.updatedAt).toLocaleString('ko-KR') : '-'} · 읽기 전용</footer>`;
  }

  let saved = null;
  try { saved = sessionStorage.getItem(KEY); } catch (e) { /* 무시 */ }
  if (saved) {
    try {
      const p = await window.BTCrypto.decrypt(payload, saved);
      try { show(p); } catch (e) { console.error(e); app.innerHTML = '<div class="lock"><div class="brand">BIASHOOK</div><h1>BIASHOOK 프로젝트</h1><p class="muted">데이터를 표시할 수 없습니다.</p></div>'; }
    } catch (e) {
      try { sessionStorage.removeItem(KEY); } catch (x) { /* 무시 */ }
      lockScreen();
    }
  } else {
    lockScreen();
  }
})();
