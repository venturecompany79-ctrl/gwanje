/* Mission Control DS — 와이어프레임용 프리미티브 컴포넌트.
   원본 _ds_bundle.js 는 레포에 없어 와이어프레임이 렌더되지 않았다(TypeError: … reading 'Button').
   앱과 동일한 클래스(.btn/.badge/.pill-tab/.icon-btn/.input, components.css)를 그대로 쓴다.
   JSX 아님 — Babel 컴파일 대상이 아니므로 일반 <script> 로 먼저 로드된다. */
(function (global) {
  var h = React.createElement;

  // design.md: 앱 1차 = cobalt→흰색 pill(.btn--cta) / 마케팅 1차 = sunset pill(.btn--primary)
  var BTN = { buy: 'btn--cta', primary: 'btn--primary', secondary: 'btn--secondary', ghost: 'btn--ghost' };

  function Button(p) {
    var o = Object.assign({}, p);
    delete o.variant; delete o.children;
    o.className = ['btn', BTN[p.variant] || BTN.buy, p.className].filter(Boolean).join(' ');
    return h('button', o, p.children);
  }

  function Badge(p) {
    var o = Object.assign({}, p);
    delete o.tone; delete o.children;
    o.className = ['badge', p.tone ? 'badge--' + p.tone : 'badge--neutral', p.className].filter(Boolean).join(' ');
    return h('span', o, p.children);
  }

  function PillTab(p) {
    var o = Object.assign({}, p);
    delete o.active; delete o.children;
    o.className = ['pill-tab', p.active ? 'is-active' : '', p.className].filter(Boolean).join(' ');
    return h('button', o, p.children);
  }

  function IconButton(p) {
    var o = Object.assign({}, p);
    delete o.label; delete o.children;
    o.className = ['icon-btn', p.className].filter(Boolean).join(' ');
    o['aria-label'] = p.label;
    o.title = p.label;
    return h('button', o, p.children);
  }

  function Input(p) {
    var o = Object.assign({}, p);
    delete o.label; delete o.children;
    o.className = ['input', p.className].filter(Boolean).join(' ');
    if (o.value !== undefined && !o.onChange) { o.defaultValue = o.value; delete o.value; }
    var field = h('input', o);
    if (!p.label) return field;
    return h('label', { className: 'field' },
      h('span', { className: 'field-label' }, p.label), field);
  }


  /* <image-slot placeholder="…"> — 원본 번들이 등록하던 이미지 드롭 자리표시자.
     번들이 없어 빈 상자로만 보이던 것을 복원한다. */
  if (!customElements.get('image-slot')) {
    customElements.define('image-slot', class extends HTMLElement {
      connectedCallback() {
        if (this.dataset.ready) return;
        this.dataset.ready = '1';
        var t = document.createElement('span');
        t.textContent = this.getAttribute('placeholder') || '이미지 자리';
        t.className = 'image-slot-ph';
        this.appendChild(t);
      }
    });
  }

  global.MissionControlDS = { Button: Button, Badge: Badge, PillTab: PillTab, IconButton: IconButton, Input: Input };
})(window);
